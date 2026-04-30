const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { normalizeWorkInformationPayload, serializeWorkPolicy } = require("./work-policy");

function createScheduleWorkPolicyService({ query }) {
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

  return Object.freeze({
    createWorkPolicy,
    deleteWorkPolicy,
    getDefaultWorkPolicy,
    getWorkPolicyById,
    listWorkPolicies,
    updateDefaultWorkPolicy,
    updateWorkPolicy,
  });
}

module.exports = {
  createScheduleWorkPolicyService,
};
