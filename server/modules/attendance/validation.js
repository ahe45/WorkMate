const { createHttpError } = require("../common/http-error");
const { assertTransitionAllowed } = require("./state-machine");
const {
  haversineMeters,
  parseSummaryJson,
  toDateOnly,
} = require("./common");

function createAttendanceValidationService({ authService, query }) {
  async function loadUser(userId) {
    const rows = await query(
      `
        SELECT
          u.id,
          u.organization_id AS organizationId,
          u.name,
          u.default_site_id AS defaultSiteId,
          u.work_policy_id AS workPolicyId,
          u.timezone,
          u.employment_status AS employmentStatus
        FROM users u
        WHERE u.id = :userId
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      { userId },
    );
    return rows[0] || null;
  }

  async function loadShift(userId, workDate) {
    const rows = await query(
      `
        SELECT
          id,
          site_id AS siteId,
          work_policy_id AS workPolicyId,
          shift_date AS shiftDate,
          planned_start_at AS plannedStartAt,
          planned_end_at AS plannedEndAt,
          planned_break_minutes AS plannedBreakMinutes
        FROM shift_instances
        WHERE user_id = :userId
          AND shift_date = :workDate
        ORDER BY planned_start_at
        LIMIT 1
      `,
      { userId, workDate },
    );
    return rows[0] || null;
  }

  async function loadSite(siteId) {
    const rows = await query(
      `
        SELECT
          s.id,
          s.organization_id AS organizationId,
          s.name,
          s.lat,
          s.lng,
          s.geofence_radius_meters AS geofenceRadiusMeters
        FROM sites s
        WHERE s.id = :siteId
          AND s.deleted_at IS NULL
        LIMIT 1
      `,
      { siteId },
    );
    return rows[0] || null;
  }

  async function loadSession(userId, workDate) {
    const rows = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          user_id AS userId,
          site_id AS siteId,
          shift_instance_id AS shiftInstanceId,
          work_policy_id AS workPolicyId,
          work_date_local AS workDateLocal,
          status,
          current_state AS currentState,
          planned_start_at AS plannedStartAt,
          planned_end_at AS plannedEndAt
        FROM attendance_sessions
        WHERE user_id = :userId
          AND work_date_local = :workDate
        LIMIT 1
      `,
      { userId, workDate },
    );
    return rows[0] || null;
  }

  async function listAttendanceSessions(filters = {}) {
    const conditions = ["s.organization_id = :organizationId"];
    const params = { organizationId: filters.organizationId };

    if (filters.userId) {
      conditions.push("s.user_id = :userId");
      params.userId = filters.userId;
    }

    if (filters.siteId) {
      conditions.push("s.site_id = :siteId");
      params.siteId = filters.siteId;
    }

    if (filters.dateFrom) {
      conditions.push("s.work_date_local >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("s.work_date_local <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const rows = await query(
      `
        SELECT
          s.id,
          s.user_id AS userId,
          u.name AS userName,
          s.site_id AS siteId,
          si.name AS siteName,
          s.work_date_local AS workDateLocal,
          s.status,
          s.current_state AS currentState,
          s.planned_start_at AS plannedStartAt,
          s.planned_end_at AS plannedEndAt,
          s.actual_first_work_start_at AS actualFirstWorkStartAt,
          s.actual_last_work_end_at AS actualLastWorkEndAt,
          s.scheduled_minutes AS scheduledMinutes,
          s.gross_work_minutes AS grossWorkMinutes,
          s.recognized_work_minutes AS recognizedWorkMinutes,
          s.overtime_minutes AS overtimeMinutes,
          s.late_minutes AS lateMinutes,
          s.early_leave_minutes AS earlyLeaveMinutes,
          s.anomaly_count AS anomalyCount,
          s.summary_json AS summaryJson
        FROM attendance_sessions s
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN sites si ON si.id = s.site_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY s.work_date_local DESC, u.name
      `,
      params,
    );

    return rows.map((row) => ({
      ...row,
      summaryJson: parseSummaryJson(row.summaryJson),
    }));
  }

  async function resolveUserForClock(principal, payload) {
    const targetUserId = payload.userId || principal.id;
    const user = await loadUser(targetUserId);

    if (!user) {
      throw createHttpError(404, "사용자를 찾을 수 없습니다.", "CLOCK_USER_NOT_FOUND");
    }

    if (payload.userId && payload.userId !== principal.id && !authService.hasAnyRole(principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], user.organizationId)) {
      throw createHttpError(403, "다른 사용자의 근태를 변경할 권한이 없습니다.", "CLOCK_SCOPE_FORBIDDEN");
    }

    if (user.employmentStatus !== "ACTIVE") {
      throw createHttpError(403, "비활성 사용자는 근태 처리할 수 없습니다.", "CLOCK_USER_INACTIVE");
    }

    return user;
  }

  async function buildValidationResult(principal, payload = {}) {
    const user = await resolveUserForClock(principal, payload);
    const occurredAt = payload.occurredAt || new Date().toISOString();
    const workDate = toDateOnly(occurredAt);
    const shift = await loadShift(user.id, workDate);
    const resolvedSiteId = payload.siteId || shift?.siteId || user.defaultSiteId;
    const site = resolvedSiteId ? await loadSite(resolvedSiteId) : null;
    const session = await loadSession(user.id, workDate);
    const currentState = session?.currentState || "OFF_DUTY";
    let nextState = "";

    try {
      nextState = assertTransitionAllowed(currentState, payload.eventType);
    } catch (error) {
      throw createHttpError(409, "현재 상태에서 허용되지 않는 이벤트입니다.", "CLOCK_TRANSITION_INVALID");
    }

    const anomalyCodes = [];
    const evidenceRequired = [];
    const warnings = [];
    const gps = payload.signals?.gps || {};

    if (site) {
      if (!Number.isFinite(Number(gps.lat)) || !Number.isFinite(Number(gps.lng)) || !Number.isFinite(Number(site.lat)) || !Number.isFinite(Number(site.lng))) {
        anomalyCodes.push("GPS_SIGNAL_MISSING");
      } else {
        const distance = haversineMeters(Number(gps.lat), Number(gps.lng), Number(site.lat), Number(site.lng));

        if (distance > Number(site.geofenceRadiusMeters || 100)) {
          anomalyCodes.push("OUTSIDE_GEOFENCE");
          warnings.push(`사업장 반경을 ${Math.round(distance)}m 벗어났습니다.`);
        }
      }
    }

    return {
      approvalRequired: false,
      anomalyCodes,
      currentState,
      eventAccepted: true,
      evidenceRequired,
      nextState,
      resolvedShiftInstanceId: shift?.id || null,
      resolvedSiteId: site?.id || null,
      shift,
      user,
      warnings,
      workDate,
      workPolicyId: shift?.workPolicyId || user.workPolicyId,
    };
  }

  return Object.freeze({
    buildValidationResult,
    listAttendanceSessions,
  });
}

module.exports = {
  createAttendanceValidationService,
};
