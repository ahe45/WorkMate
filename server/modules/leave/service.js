function createLeaveService({ query }) {
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
          lb.balance_year AS balanceYear,
          lb.opening_balance AS openingBalance,
          lb.accrued_amount AS accruedAmount,
          lb.used_amount AS usedAmount,
          lb.remaining_amount AS remainingAmount
        FROM leave_balances lb
        INNER JOIN users u ON u.id = lb.user_id
        INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
        LEFT JOIN units un ON un.id = u.primary_unit_id
        WHERE lb.organization_id = :organizationId
          AND lb.balance_year = :balanceYear
          AND u.deleted_at IS NULL
        ORDER BY u.name, lt.name
      `,
      { balanceYear, organizationId },
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
    listLeaveBalances,
    listLeaveRequests,
    listLeaveRequestsInRange,
  };
}

module.exports = {
  createLeaveService,
};
