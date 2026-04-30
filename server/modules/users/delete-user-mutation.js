const { createHttpError } = require("../common/http-error");

function createUserDeleteMutation({
  mapUserMutationError,
  withTransaction,
}) {
  return async function deleteUser(organizationId, userId) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedOrganizationId || !normalizedUserId) {
      throw createHttpError(400, "삭제할 직원을 선택하세요.", "USER_DELETE_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const [rows] = await connection.query(
        `
          SELECT
            id,
            organization_id AS organizationId,
            account_id AS accountId,
            employee_no AS employeeNo,
            login_email AS loginEmail,
            name
          FROM users
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedOrganizationId, normalizedUserId],
      );
      const user = rows[0] || null;

      if (!user) {
        throw createHttpError(404, "삭제할 직원을 찾을 수 없습니다.", "USER_NOT_FOUND");
      }

      await connection.query(
        `
          UPDATE auth_refresh_tokens
          SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3))
          WHERE user_id = ?
            AND revoked_at IS NULL
        `,
        [normalizedUserId],
      );
      await connection.query(
        `
          UPDATE user_join_invitations
          SET
            revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3)),
            delivery_error = CASE
              WHEN consumed_at IS NULL THEN '직원 데이터 삭제로 폐기된 합류 요청입니다.'
              ELSE delivery_error
            END
          WHERE organization_id = ?
            AND user_id = ?
            AND consumed_at IS NULL
            AND revoked_at IS NULL
        `,
        [normalizedOrganizationId, normalizedUserId],
      );
      await connection.query(
        `
          UPDATE user_roles
          SET effective_to = UTC_TIMESTAMP(3)
          WHERE organization_id = ?
            AND user_id = ?
            AND (effective_to IS NULL OR effective_to >= UTC_TIMESTAMP(3))
        `,
        [normalizedOrganizationId, normalizedUserId],
      );
      await connection.query(
        `
          UPDATE users
          SET
            manager_user_id = NULL,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND manager_user_id = ?
            AND deleted_at IS NULL
        `,
        [normalizedOrganizationId, normalizedUserId],
      );
      await connection.query(
        `
          UPDATE users
          SET
            account_id = NULL,
            employee_no = CONCAT('__deleted__', REPLACE(id, '-', '')),
            login_email = NULL,
            password_hash = NULL,
            name = '삭제된 직원',
            first_name = NULL,
            last_name = NULL,
            phone = NULL,
            employment_status = 'INACTIVE',
            employment_type = NULL,
            primary_unit_id = NULL,
            job_title_id = NULL,
            default_site_id = NULL,
            track_type = NULL,
            work_policy_id = NULL,
            manager_user_id = NULL,
            note = NULL,
            personnel_card_json = NULL,
            invite_channels_json = NULL,
            join_request_status = 'DRAFT',
            metadata_json = NULL,
            deleted_at = UTC_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [normalizedOrganizationId, normalizedUserId],
      );

      return {
        deleted: true,
        id: normalizedUserId,
        organizationId: normalizedOrganizationId,
      };
    }).catch(mapUserMutationError);
  };
}

module.exports = {
  createUserDeleteMutation,
};
