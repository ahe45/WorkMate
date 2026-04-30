const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");

async function ensureDefaultLeaveType(connection, organizationId, group) {
  const [typeRows] = await connection.query(
    `
      SELECT id, code, name
      FROM leave_types
      WHERE organization_id = ?
        AND leave_group_id = ?
        AND status = 'ACTIVE'
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [organizationId, group.id],
  );

  if (typeRows[0]?.id) {
    return typeRows[0];
  }

  const leaveTypeId = generateId();

  await connection.query(
    `
      INSERT INTO leave_types (id, organization_id, leave_group_id, code, name, unit_type, status)
      VALUES (?, ?, ?, ?, ?, 'DAY', 'ACTIVE')
    `,
    [leaveTypeId, organizationId, group.id, group.code, group.name],
  );

  return {
    code: group.code,
    id: leaveTypeId,
    name: group.name,
  };
}

async function fetchLeaveGroupById(connection, organizationId, leaveGroupId) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        organization_id AS organizationId,
        parent_leave_group_id AS parentLeaveGroupId,
        code,
        name,
        negative_limit_days AS negativeLimitDays,
        description,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM leave_groups
      WHERE organization_id = ?
        AND id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [organizationId, leaveGroupId],
  );

  return rows[0] || null;
}

async function resolveLeaveGroupAndType(connection, organizationId, { leaveGroupId = "", leaveTypeId = "" } = {}) {
  const normalizedLeaveGroupId = String(leaveGroupId || "").trim();
  const normalizedLeaveTypeId = String(leaveTypeId || "").trim();

  if (normalizedLeaveTypeId) {
    const [rows] = await connection.query(
      `
        SELECT
          lt.id AS leaveTypeId,
          lt.code AS leaveTypeCode,
          lt.name AS leaveTypeName,
          lg.id AS leaveGroupId,
          lg.code AS leaveGroupCode,
          lg.name AS leaveGroupName
        FROM leave_types lt
        INNER JOIN leave_groups lg
          ON lg.id = lt.leave_group_id
         AND lg.deleted_at IS NULL
        WHERE lt.organization_id = ?
          AND lt.id = ?
          AND lt.status = 'ACTIVE'
        LIMIT 1
      `,
      [organizationId, normalizedLeaveTypeId],
    );

    if (!rows[0]) {
      throw createHttpError(404, "휴가 유형을 찾을 수 없습니다.", "LEAVE_TYPE_NOT_FOUND");
    }

    return rows[0];
  }

  if (!normalizedLeaveGroupId) {
    throw createHttpError(400, "휴가정책을 선택하세요.", "LEAVE_GROUP_REQUIRED");
  }

  const [groupRows] = await connection.query(
    `
      SELECT id, code, name
      FROM leave_groups
      WHERE organization_id = ?
        AND id = ?
        AND deleted_at IS NULL
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [organizationId, normalizedLeaveGroupId],
  );
  const group = groupRows[0] || null;

  if (!group) {
    throw createHttpError(404, "휴가정책을 찾을 수 없습니다.", "LEAVE_GROUP_NOT_FOUND");
  }

  const leaveType = await ensureDefaultLeaveType(connection, organizationId, group);

  return {
    leaveGroupCode: group.code,
    leaveGroupId: group.id,
    leaveGroupName: group.name,
    leaveTypeCode: leaveType.code,
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
  };
}

async function upsertLeaveBalance(connection, {
  amountDays,
  balanceYear,
  leaveTypeId,
  organizationId,
  userId,
}) {
  await connection.query(
    `
      INSERT INTO leave_balances (
        id, organization_id, user_id, leave_type_id, balance_year,
        opening_balance, accrued_amount, used_amount, remaining_amount
      )
      VALUES (?, ?, ?, ?, ?, 0.00, ?, 0.00, ?)
      ON DUPLICATE KEY UPDATE
        accrued_amount = accrued_amount + VALUES(accrued_amount),
        remaining_amount = remaining_amount + VALUES(remaining_amount),
        updated_at = CURRENT_TIMESTAMP(3)
    `,
    [generateId(), organizationId, userId, leaveTypeId, balanceYear, amountDays, amountDays],
  );
}

module.exports = {
  ensureDefaultLeaveType,
  fetchLeaveGroupById,
  resolveLeaveGroupAndType,
  upsertLeaveBalance,
};
