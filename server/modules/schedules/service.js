const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");

function toSqlDateTime(date, time) {
  return `${date} ${time}:00`;
}

function jsDayToBusinessDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

const { normalizeWorkInformationPayload, serializeWorkPolicy } = require("./work-policy");

function createSchedulesService({ query, withTransaction }) {
  async function listWorkPolicies(organizationId) {
    const rows = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          code,
          name,
          track_type AS trackType,
          timezone,
          standard_daily_minutes AS standardDailyMinutes,
          standard_weekly_minutes AS standardWeeklyMinutes,
          daily_max_minutes AS dailyMaxMinutes,
          late_grace_minutes AS lateGraceMinutes,
          early_leave_grace_minutes AS earlyLeaveGraceMinutes,
          policy_json AS policyJson,
          is_default AS isDefault,
          updated_at AS updatedAt
        FROM work_policies
        WHERE organization_id = :organizationId
          AND deleted_at IS NULL
        ORDER BY is_default DESC, updated_at DESC, name ASC
      `,
      { organizationId },
    );

    return rows.map((row) => serializeWorkPolicy(row));
  }

  async function getDefaultWorkPolicy(organizationId) {
    return (await listWorkPolicies(organizationId)).find((policy) => Boolean(policy?.isDefault)) || null;
  }

  async function getWorkPolicyById(organizationId, policyId) {
    const normalizedPolicyId = String(policyId || "").trim();

    if (!normalizedPolicyId) {
      return null;
    }

    return (await listWorkPolicies(organizationId))
      .find((policy) => String(policy?.id || "").trim() === normalizedPolicyId) || null;
  }

  function calculateWorkPolicyStandardWeeklyMinutes(workInformation = {}) {
    return workInformation.standardRule?.method === "WEEKLY_FIXED"
      ? workInformation.standardRule.standardWeeklyMinutes
      : workInformation.workingDays.length * workInformation.standardDailyMinutes;
  }

  function buildWorkPolicyCode(policyId = "") {
    const normalizedPolicyId = String(policyId || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return `WP-${(normalizedPolicyId || "POLICY").slice(0, 8)}`;
  }

  async function createWorkPolicy(organizationId, payload = {}) {
    const templatePolicy = await getDefaultWorkPolicy(organizationId);
    const policyId = generateId();
    const workInformation = normalizeWorkInformationPayload(payload, templatePolicy || {});
    const policyJson = {
      ...(templatePolicy?.policyJson || {}),
      workInformation: {
        ...workInformation,
        updatedAt: new Date().toISOString(),
      },
    };

    await query(
      `
        INSERT INTO work_policies (
          id,
          organization_id,
          code,
          name,
          track_type,
          timezone,
          standard_daily_minutes,
          standard_weekly_minutes,
          daily_max_minutes,
          policy_json,
          is_default
        )
        VALUES (
          :policyId,
          :organizationId,
          :code,
          :name,
          :trackType,
          :timezone,
          :standardDailyMinutes,
          :standardWeeklyMinutes,
          :dailyMaxMinutes,
          :policyJson,
          :isDefault
        )
      `,
      {
        code: buildWorkPolicyCode(policyId),
        dailyMaxMinutes: workInformation.dailyMaxMinutes,
        isDefault: templatePolicy ? 0 : 1,
        name: workInformation.policyName,
        organizationId,
        policyId,
        policyJson: JSON.stringify(policyJson),
        standardDailyMinutes: workInformation.standardDailyMinutes,
        standardWeeklyMinutes: calculateWorkPolicyStandardWeeklyMinutes(workInformation),
        timezone: templatePolicy?.timezone || "Asia/Seoul",
        trackType: workInformation.workType,
      },
    );

    return getWorkPolicyById(organizationId, policyId);
  }

  async function updateDefaultWorkPolicy(organizationId, payload = {}) {
    const existingPolicy = await getDefaultWorkPolicy(organizationId);

    if (!existingPolicy) {
      throw createHttpError(404, "기본 근무 정책을 찾을 수 없습니다.", "WORK_POLICY_NOT_FOUND");
    }

    return updateWorkPolicy(organizationId, existingPolicy.id, payload);
  }

  async function updateWorkPolicy(organizationId, policyId, payload = {}) {
    const existingPolicy = await getWorkPolicyById(organizationId, policyId);

    if (!existingPolicy) {
      throw createHttpError(404, "근로정책을 찾을 수 없습니다.", "WORK_POLICY_NOT_FOUND");
    }

    const workInformation = normalizeWorkInformationPayload(payload, existingPolicy);
    const policyJson = {
      ...(existingPolicy.policyJson || {}),
      workInformation: {
        ...workInformation,
        updatedAt: new Date().toISOString(),
      },
    };
    const standardWeeklyMinutes = calculateWorkPolicyStandardWeeklyMinutes(workInformation);

    await query(
      `
        UPDATE work_policies
        SET
          name = :name,
          track_type = :trackType,
          standard_daily_minutes = :standardDailyMinutes,
          standard_weekly_minutes = :standardWeeklyMinutes,
          daily_max_minutes = :dailyMaxMinutes,
          policy_json = :policyJson
        WHERE organization_id = :organizationId
          AND id = :policyId
          AND deleted_at IS NULL
      `,
      {
        dailyMaxMinutes: workInformation.dailyMaxMinutes,
        name: workInformation.policyName,
        organizationId,
        policyId: existingPolicy.id,
        policyJson: JSON.stringify(policyJson),
        standardDailyMinutes: workInformation.standardDailyMinutes,
        standardWeeklyMinutes,
        trackType: workInformation.workType,
      },
    );

    return getWorkPolicyById(organizationId, existingPolicy.id);
  }

  async function deleteWorkPolicy(organizationId, policyId) {
    const existingPolicy = await getWorkPolicyById(organizationId, policyId);

    if (!existingPolicy) {
      throw createHttpError(404, "근로정책을 찾을 수 없습니다.", "WORK_POLICY_NOT_FOUND");
    }

    if (existingPolicy.isDefault) {
      throw createHttpError(409, "기본 근로정책은 삭제할 수 없습니다.", "WORK_POLICY_DELETE_DEFAULT_FORBIDDEN");
    }

    const [userRows, templateRows] = await Promise.all([
      query(
        `
          SELECT COUNT(*) AS count
          FROM users
          WHERE organization_id = :organizationId
            AND work_policy_id = :policyId
            AND deleted_at IS NULL
        `,
        { organizationId, policyId: existingPolicy.id },
      ),
      query(
        `
          SELECT COUNT(*) AS count
          FROM schedule_templates
          WHERE organization_id = :organizationId
            AND work_policy_id = :policyId
            AND deleted_at IS NULL
        `,
        { organizationId, policyId: existingPolicy.id },
      ),
    ]);

    if (Number(userRows[0]?.count || 0) > 0) {
      throw createHttpError(409, "사용자에 연결된 근로정책은 삭제할 수 없습니다.", "WORK_POLICY_DELETE_HAS_USERS");
    }

    if (Number(templateRows[0]?.count || 0) > 0) {
      throw createHttpError(409, "근무일정 템플릿에 연결된 근로정책은 삭제할 수 없습니다.", "WORK_POLICY_DELETE_HAS_TEMPLATES");
    }

    await query(
      `
        UPDATE work_policies
        SET deleted_at = CURRENT_TIMESTAMP(3)
        WHERE organization_id = :organizationId
          AND id = :policyId
          AND deleted_at IS NULL
      `,
      { organizationId, policyId: existingPolicy.id },
    );

    return {
      deleted: true,
      id: existingPolicy.id,
    };
  }

  async function listScheduleTemplates(organizationId) {
    const templates = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          work_policy_id AS workPolicyId,
          code,
          name,
          track_type AS trackType,
          effective_from AS effectiveFrom,
          effective_to AS effectiveTo,
          cross_midnight AS crossMidnight,
          next_day_cutoff_time AS nextDayCutoffTime,
          default_site_id AS defaultSiteId,
          status
        FROM schedule_templates
        WHERE organization_id = :organizationId
          AND deleted_at IS NULL
        ORDER BY created_at DESC
      `,
      { organizationId },
    );

    for (const template of templates) {
      template.days = await query(
        `
          SELECT
            id,
            day_of_week AS dayOfWeek,
            is_working_day AS isWorkingDay,
            start_time AS startTime,
            end_time AS endTime,
            break_minutes AS breakMinutes,
            late_grace_minutes AS lateGraceMinutes,
            early_leave_grace_minutes AS earlyLeaveGraceMinutes
          FROM schedule_template_days
          WHERE schedule_template_id = :templateId
          ORDER BY day_of_week
        `,
        { templateId: template.id },
      );
    }

    return templates;
  }

  async function createScheduleTemplate(organizationId, payload = {}) {
    const code = String(payload.code || "").trim().toUpperCase();
    const name = String(payload.name || "").trim();
    const days = Array.isArray(payload.days) ? payload.days : [];

    if (!code || !name || !payload.workPolicyId) {
      throw createHttpError(400, "템플릿 코드, 이름, 정책은 필수입니다.", "SCHEDULE_TEMPLATE_INVALID");
    }

    return withTransaction(async (connection) => {
      const templateId = generateId();

      await connection.query(
        `
          INSERT INTO schedule_templates (
            id, organization_id, work_policy_id, code, name, track_type, effective_from, effective_to,
            cross_midnight, next_day_cutoff_time, default_site_id, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          templateId,
          organizationId,
          payload.workPolicyId,
          code,
          name,
          payload.trackType || "FIXED",
          payload.effectiveFrom || null,
          payload.effectiveTo || null,
          payload.crossMidnight ? 1 : 0,
          payload.nextDayCutoffTime || "04:00:00",
          payload.defaultSiteId || null,
        ],
      );

      for (const day of days) {
        await connection.query(
          `
            INSERT INTO schedule_template_days (
              id, schedule_template_id, day_of_week, is_working_day, start_time, end_time, break_minutes,
              late_grace_minutes, early_leave_grace_minutes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            generateId(),
            templateId,
            Number(day.dayOfWeek),
            day.isWorkingDay === false ? 0 : 1,
            day.startTime || null,
            day.endTime || null,
            Number.isFinite(Number(day.breakMinutes)) ? Number(day.breakMinutes) : null,
            Number.isFinite(Number(day.lateGraceMinutes)) ? Number(day.lateGraceMinutes) : null,
            Number.isFinite(Number(day.earlyLeaveGraceMinutes)) ? Number(day.earlyLeaveGraceMinutes) : null,
          ],
        );
      }

      const rows = await connection.query(
        `
          SELECT id, code, name, track_type AS trackType
          FROM schedule_templates
          WHERE id = ?
        `,
        [templateId],
      );

      return rows[0][0];
    });
  }

  async function resolveAssignmentTargets(connection, organizationId, payload) {
    if (payload.applyType === "USER") {
      return [{ id: payload.targetId }];
    }

    if (payload.applyType === "UNIT") {
      const [rows] = await connection.query(
        `
          SELECT id
          FROM users
          WHERE organization_id = ?
            AND primary_unit_id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, payload.targetId],
      );
      return rows;
    }

    if (payload.applyType === "SITE") {
      const [rows] = await connection.query(
        `
          SELECT id
          FROM users
          WHERE organization_id = ?
            AND default_site_id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, payload.targetId],
      );
      return rows;
    }

    throw createHttpError(400, "지원하지 않는 배포 대상입니다.", "SCHEDULE_ASSIGNMENT_APPLY_TYPE_INVALID");
  }

  async function createScheduleAssignment(organizationId, payload = {}) {
    if (!payload.scheduleTemplateId || !payload.applyType || !payload.targetId || !payload.effectiveFrom || !payload.effectiveTo) {
      throw createHttpError(400, "배포 필수 항목이 누락되었습니다.", "SCHEDULE_ASSIGNMENT_INVALID");
    }

    return withTransaction(async (connection) => {
      const assignmentId = generateId();

      await connection.query(
        `
          INSERT INTO schedule_assignments (
            id, organization_id, schedule_template_id, apply_type, target_id, effective_from, effective_to, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          assignmentId,
          organizationId,
          payload.scheduleTemplateId,
          payload.applyType,
          payload.targetId,
          payload.effectiveFrom,
          payload.effectiveTo,
        ],
      );

      const [templateRows] = await connection.query(
        `
          SELECT
            id,
            work_policy_id AS workPolicyId,
            default_site_id AS defaultSiteId,
            cross_midnight AS crossMidnight,
            next_day_cutoff_time AS nextDayCutoffTime
          FROM schedule_templates
          WHERE id = ?
        `,
        [payload.scheduleTemplateId],
      );
      const template = templateRows[0];
      const [dayRows] = await connection.query(
        `
          SELECT day_of_week AS dayOfWeek, is_working_day AS isWorkingDay, start_time AS startTime, end_time AS endTime, break_minutes AS breakMinutes
          FROM schedule_template_days
          WHERE schedule_template_id = ?
        `,
        [payload.scheduleTemplateId],
      );
      const targets = await resolveAssignmentTargets(connection, organizationId, payload);
      const dayMap = new Map(dayRows.map((day) => [Number(day.dayOfWeek), day]));
      const startDate = new Date(payload.effectiveFrom);
      const endDate = new Date(payload.effectiveTo);

      for (const target of targets) {
        for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
          const sqlDate = cursor.toISOString().slice(0, 10);
          const businessDay = jsDayToBusinessDay(cursor.getDay());
          const dayRule = dayMap.get(businessDay);

          if (!dayRule || !dayRule.isWorkingDay || !dayRule.startTime || !dayRule.endTime) {
            continue;
          }

          await connection.query(
            `
              INSERT IGNORE INTO shift_instances (
                id, organization_id, user_id, schedule_assignment_id, schedule_template_id, work_policy_id, site_id,
                shift_date, planned_start_at, planned_end_at, planned_break_minutes, cross_midnight, next_day_cutoff_time, status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
            `,
            [
              generateId(),
              organizationId,
              target.id,
              assignmentId,
              payload.scheduleTemplateId,
              template.workPolicyId,
              payload.siteId || template.defaultSiteId || null,
              sqlDate,
              toSqlDateTime(sqlDate, String(dayRule.startTime).slice(0, 5)),
              toSqlDateTime(sqlDate, String(dayRule.endTime).slice(0, 5)),
              Number.isFinite(Number(dayRule.breakMinutes)) ? Number(dayRule.breakMinutes) : 0,
              template.crossMidnight ? 1 : 0,
              template.nextDayCutoffTime || "04:00:00",
            ],
          );
        }
      }

      const [rows] = await connection.query(
        `
          SELECT id, apply_type AS applyType, target_id AS targetId, effective_from AS effectiveFrom, effective_to AS effectiveTo
          FROM schedule_assignments
          WHERE id = ?
        `,
        [assignmentId],
      );

      return rows[0];
    });
  }

  async function listShiftInstances(userId, dateFrom, dateTo) {
    return query(
      `
        SELECT
          id,
          user_id AS userId,
          schedule_template_id AS scheduleTemplateId,
          site_id AS siteId,
          shift_date AS shiftDate,
          planned_start_at AS plannedStartAt,
          planned_end_at AS plannedEndAt,
          planned_break_minutes AS plannedBreakMinutes,
          status
        FROM shift_instances
        WHERE user_id = :userId
          AND shift_date BETWEEN :dateFrom AND :dateTo
        ORDER BY shift_date, planned_start_at
      `,
      { userId, dateFrom, dateTo },
    );
  }

  async function listOrganizationShiftInstances(organizationId, dateFrom, dateTo) {
    return query(
      `
        SELECT
          si.id,
          si.organization_id AS organizationId,
          si.user_id AS userId,
          u.name AS userName,
          si.schedule_template_id AS scheduleTemplateId,
          st.code AS scheduleTemplateCode,
          st.name AS scheduleTemplateName,
          st.track_type AS trackType,
          si.site_id AS siteId,
          site.name AS siteName,
          si.shift_date AS shiftDate,
          si.planned_start_at AS plannedStartAt,
          si.planned_end_at AS plannedEndAt,
          si.status
        FROM shift_instances si
        INNER JOIN users u ON u.id = si.user_id
        LEFT JOIN schedule_templates st ON st.id = si.schedule_template_id
        LEFT JOIN sites site ON site.id = si.site_id
        WHERE si.organization_id = :organizationId
          AND si.shift_date BETWEEN :dateFrom AND :dateTo
        ORDER BY si.shift_date, u.name
      `,
      { organizationId, dateFrom, dateTo },
    );
  }

  return {
    createWorkPolicy,
    createScheduleAssignment,
    createScheduleTemplate,
    deleteWorkPolicy,
    getDefaultWorkPolicy,
    getWorkPolicyById,
    listOrganizationShiftInstances,
    listScheduleTemplates,
    listShiftInstances,
    listWorkPolicies,
    updateWorkPolicy,
    updateDefaultWorkPolicy,
  };
}

module.exports = {
  createSchedulesService,
};
