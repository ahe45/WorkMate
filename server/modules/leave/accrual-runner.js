const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  addCalendarMonths,
  addDays,
  addMonths,
  buildAnnualExpiryDate,
  calculateProratedImmediateAmount,
  clampDay,
  getCompletedTenureYears,
  getDateParts,
  getInclusiveMonthCount,
  normalizeAmount,
  normalizeAttendanceRateThreshold,
  normalizeChoice,
  normalizeDateKey,
  normalizePositiveInteger,
  normalizeReferenceDailyMinutes,
} = require("./leave-utils");
const { upsertLeaveBalance } = require("./store");

function createLeaveAccrualRunner({ query, withTransaction }) {
  if (typeof query !== "function" || typeof withTransaction !== "function") {
    throw new Error("createLeaveAccrualRunner requires query and withTransaction dependencies.");
  }

  async function getAttendanceRateMetrics(connection, organizationId, userId, dateFrom, dateTo) {
    const normalizedDateFrom = normalizeDateKey(dateFrom);
    const normalizedDateTo = normalizeDateKey(dateTo);

    if (!normalizedDateFrom || !normalizedDateTo || normalizedDateTo < normalizedDateFrom) {
      return {
        attendedDays: 0,
        fullMonthCount: 0,
        rate: 100,
        scheduledDays: 0,
      };
    }

    const [summaryRows] = await connection.query(
      `
        SELECT
          COUNT(DISTINCT si.shift_date) AS scheduledDays,
          COUNT(DISTINCT CASE WHEN ats.recognized_work_minutes > 0 THEN ats.work_date_local END) AS attendedDays
        FROM shift_instances si
        LEFT JOIN attendance_sessions ats
          ON ats.organization_id = si.organization_id
         AND ats.user_id = si.user_id
         AND ats.work_date_local = si.shift_date
        WHERE si.organization_id = ?
          AND si.user_id = ?
          AND si.shift_date BETWEEN ? AND ?
          AND si.status <> 'CANCELLED'
      `,
      [organizationId, userId, normalizedDateFrom, normalizedDateTo],
    );
    const scheduledDays = Number(summaryRows[0]?.scheduledDays || 0);
    const attendedDays = Number(summaryRows[0]?.attendedDays || 0);
    const rate = scheduledDays > 0 ? Math.round(((attendedDays / scheduledDays) * 100 + Number.EPSILON) * 100) / 100 : 100;

    const [monthRows] = await connection.query(
      `
        SELECT
          DATE_FORMAT(si.shift_date, '%Y-%m') AS monthKey,
          COUNT(DISTINCT si.shift_date) AS scheduledDays,
          COUNT(DISTINCT CASE WHEN ats.recognized_work_minutes > 0 THEN ats.work_date_local END) AS attendedDays
        FROM shift_instances si
        LEFT JOIN attendance_sessions ats
          ON ats.organization_id = si.organization_id
         AND ats.user_id = si.user_id
         AND ats.work_date_local = si.shift_date
        WHERE si.organization_id = ?
          AND si.user_id = ?
          AND si.shift_date BETWEEN ? AND ?
          AND si.status <> 'CANCELLED'
        GROUP BY DATE_FORMAT(si.shift_date, '%Y-%m')
      `,
      [organizationId, userId, normalizedDateFrom, normalizedDateTo],
    );
    const fullMonthCount = scheduledDays > 0
      ? monthRows.filter((row) => Number(row.scheduledDays || 0) > 0
        && Number(row.attendedDays || 0) >= Number(row.scheduledDays || 0)).length
      : getInclusiveMonthCount(normalizedDateFrom, normalizedDateTo);

    return {
      attendedDays,
      fullMonthCount,
      rate,
      scheduledDays,
    };
  }

  async function calculateMonthlyAdjustedAmount(connection, organizationId, rule = {}, user = {}, accrualDate = "") {
    const method = normalizeChoice(rule.monthlyAccrualMethod, ["FIXED", "CONTRACTUAL_HOURS", "ATTENDANCE_RATE"], "FIXED");
    const baseAmount = normalizeAmount(rule.amountDays);

    if (!baseAmount || method === "FIXED") {
      return baseAmount;
    }

    if (method === "CONTRACTUAL_HOURS") {
      const referenceDailyMinutes = normalizeReferenceDailyMinutes(rule.referenceDailyMinutes || 480);
      const standardDailyMinutes = normalizePositiveInteger(user.standardDailyMinutes) || referenceDailyMinutes;

      return normalizeAmount(baseAmount * (standardDailyMinutes / referenceDailyMinutes));
    }

    const periodMonths = Math.max(1, normalizePositiveInteger(rule.tenureMonths) || 1);
    const periodEnd = addDays(accrualDate, -1);
    let periodStart = addCalendarMonths(accrualDate, -periodMonths);
    const joinDate = normalizeDateKey(user.joinDate);

    if (joinDate && periodStart && periodStart < joinDate) {
      periodStart = joinDate;
    }

    const metrics = await getAttendanceRateMetrics(connection, organizationId, user.id, periodStart, periodEnd);
    const threshold = normalizeAttendanceRateThreshold(rule.attendanceRateThreshold || 80);

    if (metrics.rate >= threshold) {
      return baseAmount;
    }

    const attendanceMethod = normalizeChoice(rule.attendanceAccrualMethod, ["PROPORTIONAL", "FULL_MONTHS"], "PROPORTIONAL");

    if (attendanceMethod === "FULL_MONTHS") {
      const periodMonthCount = Math.max(1, getInclusiveMonthCount(periodStart, periodEnd));

      return normalizeAmount((baseAmount / periodMonthCount) * metrics.fullMonthCount);
    }

    return normalizeAmount(baseAmount * (metrics.rate / 100));
  }

  async function resolveRuleAccrualForUser(connection, organizationId, rule = {}, user = {}, accrualDate = "") {
    const frequency = String(rule.frequency || "").trim().toUpperCase();
    const immediateType = normalizeChoice(rule.immediateAccrualType, ["FIXED", "PRORATED"], "FIXED");

    if (frequency === "IMMEDIATE" && immediateType === "PRORATED") {
      return calculateProratedImmediateAmount(rule, user, accrualDate);
    }

    const amountDays = frequency === "MONTHLY"
      ? await calculateMonthlyAdjustedAmount(connection, organizationId, rule, user, accrualDate)
      : normalizeAmount(rule.amountDays);
    const isImmediateFixedRule = frequency === "IMMEDIATE" && immediateType === "FIXED";
    const isTenureYearRule = normalizePositiveInteger(rule.tenureYears) > 0;
    const expiresAt = isTenureYearRule || (isImmediateFixedRule && rule.effectiveTo)
      ? buildAnnualExpiryDate(accrualDate, rule.effectiveTo)
      : addMonths(accrualDate, rule.expiresAfterMonths);

    return {
      amountDays,
      expiresAt,
    };
  }

  function isUserDueForAccrual(rule = {}, user = {}, accrualDate = "") {
    const normalizedAccrualDate = normalizeDateKey(accrualDate);
    const frequency = String(rule.frequency || "YEARLY").trim().toUpperCase();
    const tenureMonths = normalizePositiveInteger(rule.tenureMonths);
    const tenureYears = normalizePositiveInteger(rule.tenureYears);

    if (frequency === "IMMEDIATE") {
      return Boolean(normalizedAccrualDate && normalizeDateKey(user.joinDate) === normalizedAccrualDate);
    }

    if (tenureMonths) {
      const dueDate = addMonths(user.joinDate, tenureMonths);

      return Boolean(dueDate && normalizedAccrualDate && dueDate === normalizedAccrualDate);
    }

    if (tenureYears) {
      const annualMonth = clampDay(rule.annualMonth, 12);
      const annualDay = clampDay(rule.annualDay, 31);
      const accrualParts = getDateParts(normalizedAccrualDate);

      return accrualParts.month === annualMonth
        && accrualParts.day === annualDay
        && getCompletedTenureYears(user.joinDate, normalizedAccrualDate) >= tenureYears;
    }

    const basisDateType = String(rule.basisDateType || "FISCAL_YEAR").trim().toUpperCase();

    if (basisDateType !== "HIRE_DATE") {
      return true;
    }

    const accrualParts = getDateParts(accrualDate);
    const joinParts = getDateParts(user.joinDate);

    if (!accrualParts.day || !joinParts.day) {
      return false;
    }

    if (frequency === "MONTHLY") {
      return accrualParts.day === joinParts.day;
    }

    return accrualParts.month === joinParts.month && accrualParts.day === joinParts.day;
  }

  async function runLeaveAccrualRule(organizationId, ruleId, payload = {}, options = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedRuleId = String(ruleId || "").trim();
    const accrualDate = normalizeDateKey(payload.accrualDate, getCurrentDateKey());

    if (!normalizedOrganizationId || !normalizedRuleId) {
      throw createHttpError(400, "실행할 휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_REQUIRED");
    }

    if (!accrualDate) {
      throw createHttpError(400, "휴가 발생일을 입력하세요.", "LEAVE_RULE_RUN_DATE_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const [ruleRows] = await connection.query(
        `
          SELECT
            id,
            leave_group_id AS leaveGroupId,
            leave_type_id AS leaveTypeId,
            frequency,
            amount_days AS amountDays,
            basis_date_type AS basisDateType,
            tenure_months AS tenureMonths,
            tenure_years AS tenureYears,
            annual_month AS annualMonth,
          annual_day AS annualDay,
          monthly_day AS monthlyDay,
          effective_from AS effectiveFrom,
          effective_to AS effectiveTo,
          expires_after_months AS expiresAfterMonths,
          monthly_accrual_method AS monthlyAccrualMethod,
          reference_daily_minutes AS referenceDailyMinutes,
          attendance_accrual_method AS attendanceAccrualMethod,
          attendance_rate_threshold AS attendanceRateThreshold,
          immediate_accrual_type AS immediateAccrualType,
            proration_basis AS prorationBasis,
            proration_unit AS prorationUnit,
            rounding_method AS roundingMethod,
            rounding_increment AS roundingIncrement,
            min_amount_days AS minAmountDays,
            max_amount_days AS maxAmountDays,
            status
          FROM leave_accrual_rules
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedOrganizationId, normalizedRuleId],
      );
      const rule = ruleRows[0] || null;

      if (!rule || rule.status !== "ACTIVE") {
        throw createHttpError(404, "활성 휴가 발생 규칙을 찾을 수 없습니다.", "LEAVE_RULE_NOT_FOUND");
      }

      const effectiveFrom = normalizeDateKey(rule.effectiveFrom);
      const effectiveTo = normalizeDateKey(rule.effectiveTo);
      const isTenureYearRule = normalizePositiveInteger(rule.tenureYears) > 0;
      const frequency = String(rule.frequency || "").trim().toUpperCase();

      if (frequency !== "IMMEDIATE" && !isTenureYearRule && ((effectiveFrom && accrualDate < effectiveFrom) || (effectiveTo && accrualDate > effectiveTo))) {
        throw createHttpError(400, "선택한 발생일은 규칙 적용 기간 밖입니다.", "LEAVE_RULE_DATE_OUT_OF_RANGE");
      }

      const [userRows] = await connection.query(
        `
          SELECT
            u.id,
            u.join_date AS joinDate,
            COALESCE(wp.standard_daily_minutes, 480) AS standardDailyMinutes
          FROM users u
          LEFT JOIN work_policies wp
            ON wp.id = u.work_policy_id
           AND wp.organization_id = u.organization_id
           AND wp.deleted_at IS NULL
          WHERE u.organization_id = ?
            AND u.deleted_at IS NULL
            AND u.employment_status IN ('ACTIVE', 'PENDING', 'INVITED')
            AND u.join_date <= ?
            AND (u.retire_date IS NULL OR u.retire_date >= ?)
          ORDER BY u.name ASC
        `,
        [normalizedOrganizationId, accrualDate, accrualDate],
      );
      const targetUsers = userRows.filter((user) => isUserDueForAccrual(rule, user, accrualDate));
      const balanceYear = Number(accrualDate.slice(0, 4));
      let createdCount = 0;
      let skippedCount = 0;

      for (const user of targetUsers) {
        const [existingRows] = await connection.query(
          `
            SELECT id
            FROM leave_accrual_entries
            WHERE organization_id = ?
              AND user_id = ?
              AND leave_type_id = ?
              AND source_type = 'RULE'
              AND source_ref_id = ?
              AND accrual_date = ?
            LIMIT 1
          `,
          [normalizedOrganizationId, user.id, rule.leaveTypeId, normalizedRuleId, accrualDate],
        );

        if (existingRows[0]) {
          skippedCount += 1;
          continue;
        }

        const accrual = await resolveRuleAccrualForUser(connection, normalizedOrganizationId, rule, user, accrualDate);

        if (!accrual.amountDays) {
          skippedCount += 1;
          continue;
        }

        await connection.query(
          `
            INSERT INTO leave_accrual_entries (
              id, organization_id, user_id, leave_group_id, leave_type_id, balance_year, source_type,
              source_ref_id, accrual_date, expires_at, amount_days, memo, created_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, 'RULE', ?, ?, ?, ?, '규칙 기반 자동 발생', ?)
          `,
          [
            generateId(),
            normalizedOrganizationId,
            user.id,
            rule.leaveGroupId,
            rule.leaveTypeId,
            balanceYear,
            normalizedRuleId,
            accrualDate,
            accrual.expiresAt || null,
            accrual.amountDays,
            String(options.actorUserId || "").trim() || null,
          ],
        );
        await upsertLeaveBalance(connection, {
          amountDays: accrual.amountDays,
          balanceYear,
          leaveTypeId: rule.leaveTypeId,
          organizationId: normalizedOrganizationId,
          userId: user.id,
        });
        createdCount += 1;
      }

      return {
        createdCount,
        skippedCount,
        targetCount: targetUsers.length,
      };
    });
  }

  async function runDueLeaveAccrualRules(organizationId, targetDate = getCurrentDateKey()) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const accrualDate = normalizeDateKey(targetDate, getCurrentDateKey());

    if (!normalizedOrganizationId || !accrualDate) {
      return {
        createdCount: 0,
        ruleCount: 0,
        skippedCount: 0,
        targetCount: 0,
      };
    }

    const [, month, day] = accrualDate.split("-").map((part) => Number(part));
    const dueRules = await query(
      `
        SELECT id
        FROM leave_accrual_rules
        WHERE organization_id = :organizationId
          AND deleted_at IS NULL
          AND status = 'ACTIVE'
          AND (
            frequency = 'IMMEDIATE'
            OR
            tenure_years IS NOT NULL
            OR (
              effective_from <= :accrualDate
              AND (effective_to IS NULL OR effective_to >= :accrualDate)
            )
          )
          AND (
            frequency = 'IMMEDIATE'
            OR
            basis_date_type = 'HIRE_DATE'
            OR (frequency = 'MONTHLY' AND monthly_day = :day)
            OR (frequency = 'YEARLY' AND annual_month = :month AND annual_day = :day)
          )
        ORDER BY created_at ASC
      `,
      {
        accrualDate,
        day,
        month,
        organizationId: normalizedOrganizationId,
      },
    );
    const summary = {
      createdCount: 0,
      ruleCount: dueRules.length,
      skippedCount: 0,
      targetCount: 0,
    };

    for (const rule of dueRules) {
      const result = await runLeaveAccrualRule(normalizedOrganizationId, rule.id, { accrualDate });

      summary.createdCount += Number(result.createdCount || 0);
      summary.skippedCount += Number(result.skippedCount || 0);
      summary.targetCount += Number(result.targetCount || 0);
    }

    return summary;
  }

  return {
    runDueLeaveAccrualRules,
    runLeaveAccrualRule,
  };
}

module.exports = {
  createLeaveAccrualRunner,
};
