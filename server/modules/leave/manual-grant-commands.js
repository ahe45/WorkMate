const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  normalizeAmount,
  normalizeDateKey,
} = require("./leave-utils");
const {
  resolveLeaveGroupAndType,
  upsertLeaveBalance,
} = require("./store");

function createManualLeaveGrantCommands({ withTransaction }) {
  if (typeof withTransaction !== "function") {
    throw new Error("createManualLeaveGrantCommands requires withTransaction dependency.");
  }

  async function createManualLeaveGrant(organizationId, payload = {}, options = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const userId = String(payload.userId || "").trim();
    const amountDays = normalizeAmount(payload.amountDays);
    const accrualDate = normalizeDateKey(payload.accrualDate, getCurrentDateKey());
    const expiresAt = normalizeDateKey(payload.expiresAt);
    const memo = String(payload.memo || "").trim();

    if (!normalizedOrganizationId) {
      throw createHttpError(400, "회사 정보를 찾을 수 없습니다.", "ORGANIZATION_REQUIRED");
    }

    if (!userId) {
      throw createHttpError(400, "휴가를 부여할 직원을 선택하세요.", "LEAVE_GRANT_USER_REQUIRED");
    }

    if (!amountDays) {
      throw createHttpError(400, "부여할 휴가 일수를 입력하세요.", "LEAVE_GRANT_AMOUNT_REQUIRED");
    }

    if (!accrualDate) {
      throw createHttpError(400, "휴가 발생일을 입력하세요.", "LEAVE_GRANT_DATE_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const [userRows] = await connection.query(
        `
          SELECT id
          FROM users
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedOrganizationId, userId],
      );

      if (!userRows[0]) {
        throw createHttpError(404, "직원을 찾을 수 없습니다.", "LEAVE_GRANT_USER_NOT_FOUND");
      }

      const leaveTarget = await resolveLeaveGroupAndType(connection, normalizedOrganizationId, {
        leaveGroupId: payload.leaveGroupId,
        leaveTypeId: payload.leaveTypeId,
      });
      const balanceYear = Number(accrualDate.slice(0, 4));
      const entryId = generateId();

      await connection.query(
        `
          INSERT INTO leave_accrual_entries (
            id, organization_id, user_id, leave_group_id, leave_type_id, balance_year, source_type,
            source_ref_id, accrual_date, expires_at, amount_days, memo, created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, 'MANUAL', NULL, ?, ?, ?, ?, ?)
        `,
        [
          entryId,
          normalizedOrganizationId,
          userId,
          leaveTarget.leaveGroupId,
          leaveTarget.leaveTypeId,
          balanceYear,
          accrualDate,
          expiresAt || null,
          amountDays,
          memo || null,
          String(options.actorUserId || "").trim() || null,
        ],
      );
      await upsertLeaveBalance(connection, {
        amountDays,
        balanceYear,
        leaveTypeId: leaveTarget.leaveTypeId,
        organizationId: normalizedOrganizationId,
        userId,
      });

      return {
        amountDays,
        entryId,
        userId,
      };
    });
  }

  return {
    createManualLeaveGrant,
  };
}

module.exports = {
  createManualLeaveGrantCommands,
};
