const { createHttpError } = require("../common/http-error");
const { createUserMutationService } = require("./mutation-service");
const { createUserReadModels } = require("./read-models");

function createUsersService({ accountsService, joinInvitationsService, query, withTransaction }) {
  const { listUsers } = createUserReadModels({ query });
  const {
    createUser,
    deleteUser,
    updateUser,
  } = createUserMutationService({
    accountsService,
    joinInvitationsService,
    listUsers,
    query,
    withTransaction,
  });

  async function getUserOrganizationId(userId) {
    const rows = await query(
      `
        SELECT organization_id AS organizationId
        FROM users
        WHERE id = :userId
          AND deleted_at IS NULL
        LIMIT 1
      `,
      { userId },
    );

    return rows[0]?.organizationId || null;
  }

  async function updateUserProfile(organizationId, userId, payload = {}) {
    const existingUsers = await query(
      `
        SELECT id
        FROM users
        WHERE organization_id = :organizationId
          AND id = :userId
          AND deleted_at IS NULL
      `,
      { organizationId, userId },
    );

    if (!existingUsers[0]) {
      throw createHttpError(404, "사용자를 찾을 수 없습니다.", "USER_NOT_FOUND");
    }

    const hasName = Object.prototype.hasOwnProperty.call(payload, "name");
    const hasPhone = Object.prototype.hasOwnProperty.call(payload, "phone");
    const nextName = hasName ? String(payload.name || "").trim() : "";
    const nextPhone = hasPhone ? String(payload.phone || "").trim() : "";

    if (hasName && !nextName) {
      throw createHttpError(400, "이름을 입력하세요.", "USER_PROFILE_NAME_REQUIRED");
    }

    await query(
      `
        UPDATE users
        SET
          name = CASE WHEN :hasName = 1 THEN :name ELSE name END,
          phone = CASE WHEN :hasPhone = 1 THEN :phone ELSE phone END
        WHERE id = :userId
          AND (:organizationId IS NULL OR organization_id = :organizationId)
      `,
      {
        hasName: hasName ? 1 : 0,
        hasPhone: hasPhone ? 1 : 0,
        name: nextName || null,
        organizationId: organizationId || null,
        phone: nextPhone || null,
        userId,
      },
    );

    const rows = await query(
      `
        SELECT
          u.id,
          u.employee_no AS employeeNo,
          COALESCE(a.login_email, u.login_email) AS loginEmail,
          u.name,
          u.phone,
          u.employment_status AS employmentStatus
        FROM users u
        LEFT JOIN accounts a
          ON a.id = u.account_id
         AND a.deleted_at IS NULL
        WHERE u.id = :userId
      `,
      { userId },
    );

    return rows[0] || null;
  }

  return {
    createUser,
    deleteUser,
    getUserOrganizationId,
    listUsers,
    updateUser,
    updateUserProfile,
  };
}

module.exports = {
  createUsersService,
};
