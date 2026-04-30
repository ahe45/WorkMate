const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  normalizeChoice,
  normalizeRuleIdList,
} = require("./leave-utils");
const {
  buildLeaveAccrualRuleName,
  normalizeLeaveAccrualRuleSegments,
} = require("./accrual-rule-normalizer");
const { resolveLeaveGroupAndType } = require("./store");

function createLeaveAccrualRuleCommands({ withTransaction }) {
  if (typeof withTransaction !== "function") {
    throw new Error("createLeaveAccrualRuleCommands requires withTransaction dependency.");
  }

  async function createLeaveAccrualRule(organizationId, payload = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const name = String(payload.name || "").trim();
    const frequency = normalizeChoice(payload.frequency, ["IMMEDIATE", "MONTHLY", "YEARLY"], "YEARLY");

    if (!normalizedOrganizationId) {
      throw createHttpError(400, "회사 정보를 찾을 수 없습니다.", "ORGANIZATION_REQUIRED");
    }

    if (!name) {
      throw createHttpError(400, "규칙명을 입력하세요.", "LEAVE_RULE_NAME_REQUIRED");
    }

    const segments = normalizeLeaveAccrualRuleSegments(payload, frequency);

    return withTransaction(async (connection) => {
      const leaveTarget = await resolveLeaveGroupAndType(connection, normalizedOrganizationId, {
        leaveGroupId: payload.leaveGroupId,
        leaveTypeId: payload.leaveTypeId,
      });
      const ruleSetId = generateId();
      const ruleIds = [];

      for (const segment of segments) {
        const ruleId = generateId();
        ruleIds.push(ruleId);

        await connection.query(
          `
            INSERT INTO leave_accrual_rules (
              id, organization_id, rule_set_id, rule_set_name, leave_group_id, leave_type_id, name, frequency, amount_days,
              basis_date_type, tenure_months, tenure_years, annual_month, annual_day, monthly_day,
              effective_from, effective_to, expires_after_months, monthly_accrual_method, reference_daily_minutes,
              attendance_accrual_method, attendance_rate_threshold, immediate_accrual_type, proration_basis, proration_unit,
              rounding_method, rounding_increment, min_amount_days, max_amount_days, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
          `,
          [
            ruleId,
            normalizedOrganizationId,
            ruleSetId,
            name,
            leaveTarget.leaveGroupId,
            leaveTarget.leaveTypeId,
            buildLeaveAccrualRuleName(name, frequency, segment, segments.length),
            frequency,
            segment.amountDays,
            segment.basisDateType,
            segment.tenureMonths,
            segment.tenureYears,
            segment.annualMonth,
            segment.annualDay,
            segment.monthlyDay,
            segment.effectiveFrom,
            segment.effectiveTo,
            segment.expiresAfterMonths,
            segment.monthlyAccrualMethod,
            segment.referenceDailyMinutes,
            segment.attendanceAccrualMethod,
            segment.attendanceRateThreshold,
            segment.immediateAccrualType,
            segment.prorationBasis,
            segment.prorationUnit,
            segment.roundingMethod,
            segment.roundingIncrement,
            segment.minAmountDays,
            segment.maxAmountDays,
          ],
        );
      }

      return {
        createdCount: ruleIds.length,
        id: ruleIds[0] || "",
        ids: ruleIds,
        name,
        ruleSetId,
      };
    });
  }

  async function updateLeaveAccrualRuleSet(organizationId, ruleIds = "", payload = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedRuleIds = normalizeRuleIdList(ruleIds);
    const name = String(payload.name || "").trim();
    const frequency = normalizeChoice(payload.frequency, ["IMMEDIATE", "MONTHLY", "YEARLY"], "YEARLY");

    if (!normalizedOrganizationId || normalizedRuleIds.length === 0) {
      throw createHttpError(400, "수정할 휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_REQUIRED");
    }

    if (!name) {
      throw createHttpError(400, "규칙명을 입력하세요.", "LEAVE_RULE_NAME_REQUIRED");
    }

    const segments = normalizeLeaveAccrualRuleSegments(payload, frequency);

    return withTransaction(async (connection) => {
      const placeholders = normalizedRuleIds.map(() => "?").join(",");
      const [existingRows] = await connection.query(
        `
          SELECT id, rule_set_id AS ruleSetId
          FROM leave_accrual_rules
          WHERE organization_id = ?
            AND id IN (${placeholders})
            AND deleted_at IS NULL
          ORDER BY created_at ASC
        `,
        [normalizedOrganizationId, ...normalizedRuleIds],
      );

      if (existingRows.length === 0) {
        throw createHttpError(404, "휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_NOT_FOUND");
      }

      const existingRuleIds = existingRows.map((row) => String(row.id || "").trim()).filter(Boolean);
      const ruleSetId = String(existingRows[0]?.ruleSetId || "").trim() || generateId();
      const leaveTarget = await resolveLeaveGroupAndType(connection, normalizedOrganizationId, {
        leaveGroupId: payload.leaveGroupId,
        leaveTypeId: payload.leaveTypeId,
      });
      const savedRuleIds = [];

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const targetRuleId = existingRuleIds[index] || generateId();

        if (existingRuleIds[index]) {
          await connection.query(
            `
              UPDATE leave_accrual_rules
              SET
                rule_set_id = ?,
                rule_set_name = ?,
                leave_group_id = ?,
                leave_type_id = ?,
                name = ?,
                frequency = ?,
                amount_days = ?,
                basis_date_type = ?,
                tenure_months = ?,
                tenure_years = ?,
                annual_month = ?,
                annual_day = ?,
                monthly_day = ?,
                effective_from = ?,
                effective_to = ?,
                expires_after_months = ?,
                monthly_accrual_method = ?,
                reference_daily_minutes = ?,
                attendance_accrual_method = ?,
                attendance_rate_threshold = ?,
                immediate_accrual_type = ?,
                proration_basis = ?,
                proration_unit = ?,
                rounding_method = ?,
                rounding_increment = ?,
                min_amount_days = ?,
                max_amount_days = ?,
                status = 'ACTIVE',
                updated_at = CURRENT_TIMESTAMP(3)
              WHERE organization_id = ?
                AND id = ?
                AND deleted_at IS NULL
            `,
            [
              ruleSetId,
              name,
              leaveTarget.leaveGroupId,
              leaveTarget.leaveTypeId,
              buildLeaveAccrualRuleName(name, frequency, segment, segments.length),
              frequency,
              segment.amountDays,
              segment.basisDateType,
              segment.tenureMonths,
              segment.tenureYears,
              segment.annualMonth,
              segment.annualDay,
              segment.monthlyDay,
              segment.effectiveFrom,
              segment.effectiveTo,
              segment.expiresAfterMonths,
              segment.monthlyAccrualMethod,
              segment.referenceDailyMinutes,
              segment.attendanceAccrualMethod,
              segment.attendanceRateThreshold,
              segment.immediateAccrualType,
              segment.prorationBasis,
              segment.prorationUnit,
              segment.roundingMethod,
              segment.roundingIncrement,
              segment.minAmountDays,
              segment.maxAmountDays,
              normalizedOrganizationId,
              targetRuleId,
            ],
          );
        } else {
          await connection.query(
            `
              INSERT INTO leave_accrual_rules (
                id, organization_id, rule_set_id, rule_set_name, leave_group_id, leave_type_id, name, frequency, amount_days,
                basis_date_type, tenure_months, tenure_years, annual_month, annual_day, monthly_day,
                effective_from, effective_to, expires_after_months, monthly_accrual_method, reference_daily_minutes,
                attendance_accrual_method, attendance_rate_threshold, immediate_accrual_type, proration_basis, proration_unit,
                rounding_method, rounding_increment, min_amount_days, max_amount_days, status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `,
            [
              targetRuleId,
              normalizedOrganizationId,
              ruleSetId,
              name,
              leaveTarget.leaveGroupId,
              leaveTarget.leaveTypeId,
              buildLeaveAccrualRuleName(name, frequency, segment, segments.length),
              frequency,
              segment.amountDays,
              segment.basisDateType,
              segment.tenureMonths,
              segment.tenureYears,
              segment.annualMonth,
              segment.annualDay,
              segment.monthlyDay,
              segment.effectiveFrom,
              segment.effectiveTo,
              segment.expiresAfterMonths,
              segment.monthlyAccrualMethod,
              segment.referenceDailyMinutes,
              segment.attendanceAccrualMethod,
              segment.attendanceRateThreshold,
              segment.immediateAccrualType,
              segment.prorationBasis,
              segment.prorationUnit,
              segment.roundingMethod,
              segment.roundingIncrement,
              segment.minAmountDays,
              segment.maxAmountDays,
            ],
          );
        }

        savedRuleIds.push(targetRuleId);
      }

      const extraRuleIds = existingRuleIds.slice(segments.length);

      if (extraRuleIds.length > 0) {
        await connection.query(
          `
            UPDATE leave_accrual_rules
            SET
              status = 'INACTIVE',
              deleted_at = CURRENT_TIMESTAMP(3),
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE organization_id = ?
              AND id IN (${extraRuleIds.map(() => "?").join(",")})
              AND deleted_at IS NULL
          `,
          [normalizedOrganizationId, ...extraRuleIds],
        );
      }

      return {
        id: savedRuleIds[0] || "",
        ids: savedRuleIds,
        name,
        ruleSetId,
        updatedCount: savedRuleIds.length,
      };
    });
  }

  async function deleteLeaveAccrualRuleSet(organizationId, ruleIds = "") {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedRuleIds = normalizeRuleIdList(ruleIds);

    if (!normalizedOrganizationId || normalizedRuleIds.length === 0) {
      throw createHttpError(400, "삭제할 휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const placeholders = normalizedRuleIds.map(() => "?").join(",");
      const [existingRows] = await connection.query(
        `
          SELECT id
          FROM leave_accrual_rules
          WHERE organization_id = ?
            AND id IN (${placeholders})
            AND deleted_at IS NULL
        `,
        [normalizedOrganizationId, ...normalizedRuleIds],
      );

      if (existingRows.length === 0) {
        throw createHttpError(404, "휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_NOT_FOUND");
      }

      const existingRuleIds = existingRows.map((row) => String(row.id || "").trim()).filter(Boolean);

      await connection.query(
        `
          UPDATE leave_accrual_rules
          SET
            status = 'INACTIVE',
            deleted_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id IN (${existingRuleIds.map(() => "?").join(",")})
            AND deleted_at IS NULL
        `,
        [normalizedOrganizationId, ...existingRuleIds],
      );

      return {
        deleted: true,
        ids: existingRuleIds,
      };
    });
  }

  return {
    createLeaveAccrualRule,
    deleteLeaveAccrualRuleSet,
    updateLeaveAccrualRuleSet,
  };
}

module.exports = {
  createLeaveAccrualRuleCommands,
};
