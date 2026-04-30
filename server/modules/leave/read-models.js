function createLeaveReadModels({ query }) {
  if (typeof query !== "function") {
    throw new Error("createLeaveReadModels requires query dependency.");
  }

  async function listLeaveBalances(organizationId, balanceYear = new Date().getFullYear()) {
    return query(
      `
        SELECT
          lb.id,
          lb.organization_id AS organizationId,
          lb.user_id AS userId,
          u.employee_no AS employeeNo,
          u.name AS userName,
          u.primary_unit_id AS primaryUnitId,
          un.name AS primaryUnitName,
          lb.leave_type_id AS leaveTypeId,
          lt.code AS leaveTypeCode,
          lt.name AS leaveTypeName,
          lg.id AS leaveGroupId,
          lg.name AS leaveGroupName,
          lb.balance_year AS balanceYear,
          lb.opening_balance AS openingBalance,
          lb.accrued_amount AS accruedAmount,
          lb.used_amount AS usedAmount,
          lb.remaining_amount AS remainingAmount
        FROM leave_balances lb
        INNER JOIN users u ON u.id = lb.user_id
        INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
        LEFT JOIN leave_groups lg ON lg.id = lt.leave_group_id
        LEFT JOIN units un ON un.id = u.primary_unit_id
        WHERE lb.organization_id = :organizationId
          AND lb.balance_year = :balanceYear
          AND u.deleted_at IS NULL
        ORDER BY u.name, lt.name
      `,
      { balanceYear, organizationId },
    );
  }

  async function listLeaveGroups(organizationId) {
    return query(
      `
        SELECT
          lg.id,
          lg.organization_id AS organizationId,
          lg.parent_leave_group_id AS parentLeaveGroupId,
          lg.code,
          lg.name,
          lg.negative_limit_days AS negativeLimitDays,
          lg.description,
          lg.status,
          COALESCE(SUM(lb.accrued_amount), 0) AS accruedAmount,
          COALESCE(SUM(lb.remaining_amount), 0) AS remainingAmount,
          COUNT(DISTINCT lb.user_id) AS assignedUserCount,
          (
            SELECT COUNT(*)
            FROM leave_groups child_lg
            WHERE child_lg.organization_id = lg.organization_id
              AND child_lg.parent_leave_group_id = lg.id
              AND child_lg.deleted_at IS NULL
              AND child_lg.status = 'ACTIVE'
          ) AS childCount,
          (
            SELECT COUNT(*)
            FROM leave_accrual_rules rule_lar
            WHERE rule_lar.organization_id = lg.organization_id
              AND rule_lar.leave_group_id = lg.id
              AND rule_lar.deleted_at IS NULL
              AND rule_lar.status = 'ACTIVE'
          ) AS ruleCount,
          (
            SELECT COUNT(*)
            FROM leave_accrual_entries entry_lae
            WHERE entry_lae.organization_id = lg.organization_id
              AND entry_lae.leave_group_id = lg.id
          ) AS accrualEntryCount,
          (
            SELECT COUNT(*)
            FROM leave_requests request_lr
            INNER JOIN leave_types request_lt
              ON request_lt.id = request_lr.leave_type_id
            WHERE request_lr.organization_id = lg.organization_id
              AND request_lt.leave_group_id = lg.id
              AND request_lr.cancelled_at IS NULL
          ) AS requestCount,
          lg.created_at AS createdAt,
          lg.updated_at AS updatedAt
        FROM leave_groups lg
        LEFT JOIN leave_types lt
          ON lt.leave_group_id = lg.id
         AND lt.status = 'ACTIVE'
        LEFT JOIN leave_balances lb
          ON lb.leave_type_id = lt.id
         AND lb.organization_id = lg.organization_id
        WHERE lg.organization_id = :organizationId
          AND lg.deleted_at IS NULL
        GROUP BY
          lg.id,
          lg.organization_id,
          lg.parent_leave_group_id,
          lg.code,
          lg.name,
          lg.negative_limit_days,
          lg.description,
          lg.status,
          lg.created_at,
          lg.updated_at
        ORDER BY lg.created_at DESC, lg.name ASC
      `,
      { organizationId },
    );
  }

  async function listLeaveTypes(organizationId) {
    return query(
      `
        SELECT
          lt.id,
          lt.organization_id AS organizationId,
          lt.leave_group_id AS leaveGroupId,
          lg.name AS leaveGroupName,
          lt.code,
          lt.name,
          lt.unit_type AS unitType,
          lt.status
        FROM leave_types lt
        LEFT JOIN leave_groups lg
          ON lg.id = lt.leave_group_id
         AND lg.deleted_at IS NULL
        WHERE lt.organization_id = :organizationId
          AND lt.status = 'ACTIVE'
        ORDER BY COALESCE(lg.name, lt.name), lt.name
      `,
      { organizationId },
    );
  }

  async function listLeaveAccrualRules(organizationId) {
    return query(
      `
        SELECT
          lar.id,
          lar.organization_id AS organizationId,
          lar.rule_set_id AS ruleSetId,
          lar.rule_set_name AS ruleSetName,
          lar.leave_group_id AS leaveGroupId,
          lg.name AS leaveGroupName,
          lar.leave_type_id AS leaveTypeId,
          lt.name AS leaveTypeName,
          lar.name,
          lar.frequency,
          lar.amount_days AS amountDays,
          lar.basis_date_type AS basisDateType,
          lar.tenure_months AS tenureMonths,
          lar.tenure_years AS tenureYears,
          lar.annual_month AS annualMonth,
          lar.annual_day AS annualDay,
          lar.monthly_day AS monthlyDay,
          lar.effective_from AS effectiveFrom,
          lar.effective_to AS effectiveTo,
          lar.expires_after_months AS expiresAfterMonths,
          lar.monthly_accrual_method AS monthlyAccrualMethod,
          lar.reference_daily_minutes AS referenceDailyMinutes,
          lar.attendance_accrual_method AS attendanceAccrualMethod,
          lar.attendance_rate_threshold AS attendanceRateThreshold,
          lar.immediate_accrual_type AS immediateAccrualType,
          lar.proration_basis AS prorationBasis,
          lar.proration_unit AS prorationUnit,
          lar.rounding_method AS roundingMethod,
          lar.rounding_increment AS roundingIncrement,
          lar.min_amount_days AS minAmountDays,
          lar.max_amount_days AS maxAmountDays,
          lar.status,
          lar.created_at AS createdAt,
          lar.updated_at AS updatedAt
        FROM leave_accrual_rules lar
        INNER JOIN leave_groups lg ON lg.id = lar.leave_group_id
        INNER JOIN leave_types lt ON lt.id = lar.leave_type_id
        WHERE lar.organization_id = :organizationId
          AND lar.deleted_at IS NULL
        ORDER BY lar.created_at DESC, lar.name ASC
      `,
      { organizationId },
    );
  }

  async function listLeaveAccrualEntries(organizationId, limit = 80) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 80));

    return query(
      `
        SELECT
          lae.id,
          lae.organization_id AS organizationId,
          lae.user_id AS userId,
          u.name AS userName,
          u.employee_no AS employeeNo,
          lae.leave_group_id AS leaveGroupId,
          lg.name AS leaveGroupName,
          lae.leave_type_id AS leaveTypeId,
          lt.name AS leaveTypeName,
          lae.balance_year AS balanceYear,
          lae.source_type AS sourceType,
          lae.source_ref_id AS sourceRefId,
          lar.name AS ruleName,
          lae.accrual_date AS accrualDate,
          lae.expires_at AS expiresAt,
          lae.amount_days AS amountDays,
          lae.memo,
          lae.created_at AS createdAt
        FROM leave_accrual_entries lae
        INNER JOIN users u ON u.id = lae.user_id
        INNER JOIN leave_groups lg ON lg.id = lae.leave_group_id
        INNER JOIN leave_types lt ON lt.id = lae.leave_type_id
        LEFT JOIN leave_accrual_rules lar ON lar.id = lae.source_ref_id
        WHERE lae.organization_id = :organizationId
          AND u.deleted_at IS NULL
        ORDER BY lae.accrual_date DESC, lae.created_at DESC
        LIMIT ${safeLimit}
      `,
      { organizationId },
    );
  }

  async function listLeaveRequests(organizationId, targetDate) {
    return query(
      `
        SELECT
          lr.id,
          lr.organization_id AS organizationId,
          lr.target_user_id AS userId,
          u.name AS userName,
          lt.name AS leaveTypeName,
          lr.start_date AS startDate,
          lr.end_date AS endDate,
          lr.partial_day_type AS partialDayType,
          lr.quantity,
          lr.request_reason AS requestReason,
          lr.approval_status AS approvalStatus
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.target_user_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.organization_id = :organizationId
          AND lr.start_date <= :targetDate
          AND lr.end_date >= :targetDate
          AND lr.cancelled_at IS NULL
          AND lr.approval_status <> 'REJECTED'
        ORDER BY u.name, lr.start_date, lr.created_at
      `,
      { organizationId, targetDate },
    );
  }

  async function listLeaveRequestsInRange(organizationId, dateFrom, dateTo) {
    return query(
      `
        SELECT
          lr.id,
          lr.organization_id AS organizationId,
          lr.target_user_id AS userId,
          u.name AS userName,
          lt.name AS leaveTypeName,
          lr.start_date AS startDate,
          lr.end_date AS endDate,
          lr.partial_day_type AS partialDayType,
          lr.quantity,
          lr.request_reason AS requestReason,
          lr.approval_status AS approvalStatus
        FROM leave_requests lr
        INNER JOIN users u ON u.id = lr.target_user_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.organization_id = :organizationId
          AND lr.start_date <= :dateTo
          AND lr.end_date >= :dateFrom
          AND lr.cancelled_at IS NULL
          AND lr.approval_status <> 'REJECTED'
        ORDER BY lr.start_date, u.name, lr.created_at
      `,
      { dateFrom, dateTo, organizationId },
    );
  }

  return {
    listLeaveAccrualEntries,
    listLeaveAccrualRules,
    listLeaveBalances,
    listLeaveGroups,
    listLeaveRequests,
    listLeaveRequestsInRange,
    listLeaveTypes,
  };
}

module.exports = {
  createLeaveReadModels,
};
