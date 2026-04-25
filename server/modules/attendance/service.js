const { recordAuditLog } = require("../common/audit-log");
const { generateId } = require("../common/ids");
const { toSqlDateTimeValue } = require("./common");
const { createAttendanceSessionStore } = require("./session-store");
const { createAttendanceValidationService } = require("./validation");

function createAttendanceService({ query, withTransaction, authService }) {
  const validationService = createAttendanceValidationService({
    authService,
    query,
  });
  const sessionStore = createAttendanceSessionStore();
  const { buildValidationResult, listAttendanceSessions } = validationService;
  const { ensureSession, recalculateSession } = sessionStore;

  async function createClockEvent(principal, payload = {}, request = null) {
    const validation = await buildValidationResult(principal, payload);
    const occurredAt = toSqlDateTimeValue(payload.occurredAt || new Date().toISOString());

    return withTransaction(async (connection) => {
      if (payload.clientEventId) {
        const [duplicateRows] = await connection.query(
          `
            SELECT id, session_id AS sessionId, current_state_after AS currentStateAfter
            FROM attendance_events
            WHERE user_id = ?
              AND client_event_id = ?
            LIMIT 1
          `,
          [validation.user.id, payload.clientEventId],
        );

        if (duplicateRows[0]) {
          return {
            currentState: duplicateRows[0].currentStateAfter,
            eventId: duplicateRows[0].id,
            idempotent: true,
            sessionId: duplicateRows[0].sessionId,
          };
        }
      }

      const session = await ensureSession(connection, validation);
      const eventId = generateId();
      const reasonText = payload.evidence?.reasonText || null;

      await connection.query(
        `
          INSERT INTO attendance_events (
            id, organization_id, session_id, user_id, site_id, shift_instance_id, event_type, current_state_before, current_state_after,
            occurred_at, source_type, client_event_id, reason_text, auth_result_json, metadata_json, created_by,
            gps_lat, gps_lng, gps_accuracy_meters, wifi_snapshot_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          eventId,
          validation.user.organizationId,
          session.id,
          validation.user.id,
          validation.resolvedSiteId,
          validation.resolvedShiftInstanceId,
          payload.eventType,
          session.currentState,
          validation.nextState,
          occurredAt,
          payload.sourceType || "WEB",
          payload.clientEventId || null,
          reasonText,
          JSON.stringify({
            anomalyCodes: validation.anomalyCodes,
            evidenceRequired: validation.evidenceRequired,
            warnings: validation.warnings,
          }),
          JSON.stringify({
            platform: payload.device?.platform || "",
            appVersion: payload.device?.appVersion || "",
          }),
          principal.id,
          payload.signals?.gps?.lat || null,
          payload.signals?.gps?.lng || null,
          payload.signals?.gps?.accuracyMeters || null,
          JSON.stringify(payload.signals?.wifi || {}),
        ],
      );

      for (const anomalyCode of validation.anomalyCodes) {
        await connection.query(
          `
            INSERT INTO attendance_anomalies (
              id, organization_id, session_id, attendance_event_id, user_id, anomaly_code, severity, status, details_json, detected_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'WARNING', 'OPEN', ?, UTC_TIMESTAMP(3))
          `,
          [
            generateId(),
            validation.user.organizationId,
            session.id,
            eventId,
            validation.user.id,
            anomalyCode,
            JSON.stringify({
              eventType: payload.eventType,
              warnings: validation.warnings,
            }),
          ],
        );
      }

      await recalculateSession(connection, session.id);

      if (request) {
        await recordAuditLog(
          (sql, params) => connection.query(sql, params),
          {
            organizationId: validation.user.organizationId,
            actorUserId: principal.id,
            action: "attendance.clock-event.create",
            entityType: "attendance_event",
            entityId: eventId,
            requestId: request.headers["x-request-id"] || "",
            ipAddress: request.socket?.remoteAddress || "",
            userAgent: request.headers["user-agent"] || "",
            afterJson: {
              eventType: payload.eventType,
              userId: validation.user.id,
              siteId: validation.resolvedSiteId,
              anomalyCodes: validation.anomalyCodes,
            },
          },
        );
      }

      const [sessionRows] = await connection.query(
        `
          SELECT
            id,
            current_state AS currentState,
            scheduled_minutes AS scheduledMinutes,
            gross_work_minutes AS grossWorkMinutes,
            recognized_work_minutes AS recognizedWorkMinutes,
            late_minutes AS lateMinutes,
            overtime_minutes AS overtimeMinutes
          FROM attendance_sessions
          WHERE id = ?
        `,
        [session.id],
      );

      return {
        currentState: sessionRows[0].currentState,
        eventId,
        sessionId: session.id,
        sessionSummary: {
          scheduledMinutes: sessionRows[0].scheduledMinutes,
          grossWorkMinutes: sessionRows[0].grossWorkMinutes,
          recognizedWorkMinutes: sessionRows[0].recognizedWorkMinutes,
          lateMinutes: sessionRows[0].lateMinutes,
          overtimeMinutes: sessionRows[0].overtimeMinutes,
        },
      };
    });
  }

  return {
    buildValidationResult,
    createClockEvent,
    listAttendanceSessions,
  };
}

module.exports = {
  createAttendanceService,
};
