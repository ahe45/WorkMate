const {
  mapUserRow,
  normalizeRoleCode,
} = require("./user-normalizers");

function createUserReadModels({ query }) {
  async function loadRoleCodesByUserId(organizationId) {
    const rows = await query(
      `
        SELECT
          ur.user_id AS userId,
          r.code AS roleCode
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.organization_id = :organizationId
          AND (ur.effective_to IS NULL OR ur.effective_to >= UTC_TIMESTAMP(3))
        ORDER BY ur.created_at ASC, ur.effective_from ASC
      `,
      { organizationId },
    );

    return rows.reduce((map, row) => {
      const userId = String(row.userId || "").trim();
      const roleCode = normalizeRoleCode(row.roleCode);

      if (!userId || !roleCode) {
        return map;
      }

      if (!map.has(userId)) {
        map.set(userId, []);
      }

      if (!map.get(userId).includes(roleCode)) {
        map.get(userId).push(roleCode);
      }

      return map;
    }, new Map());
  }

  async function listUsers(organizationId, filters = {}) {
    const conditions = ["u.organization_id = :organizationId", "u.deleted_at IS NULL"];
    const params = { organizationId };

    if (filters.unitId) {
      conditions.push("u.primary_unit_id = :unitId");
      params.unitId = filters.unitId;
    }

    if (filters.employmentStatus) {
      conditions.push("u.employment_status = :employmentStatus");
      params.employmentStatus = filters.employmentStatus;
    }

    const rows = await query(
      `
        SELECT
          u.id,
          u.organization_id AS organizationId,
          u.account_id AS accountId,
          u.employee_no AS employeeNo,
          COALESCE(a.login_email, u.login_email) AS loginEmail,
          u.name,
          u.first_name AS firstName,
          u.last_name AS lastName,
          u.phone,
          u.employment_status AS employmentStatus,
          u.employment_type AS employmentType,
          u.join_date AS joinDate,
          u.retire_date AS retireDate,
          u.timezone,
          u.primary_unit_id AS primaryUnitId,
          un.name AS primaryUnitName,
          u.job_title_id AS jobTitleId,
          jt.name AS jobTitleName,
          u.default_site_id AS defaultSiteId,
          s.name AS defaultSiteName,
          u.track_type AS trackType,
          u.work_policy_id AS workPolicyId,
          wp.name AS workPolicyName,
          u.manager_user_id AS managerUserId,
          u.note,
          u.personnel_card_json AS personnelCardJson,
          u.invite_channels_json AS inviteChannelsJson,
          u.join_request_status AS joinRequestStatus,
          latest_inv.expires_at AS latestInvitationExpiresAt,
          latest_inv.consumed_at AS latestInvitationConsumedAt,
          latest_inv.revoked_at AS latestInvitationRevokedAt,
          u.metadata_json AS metadataJson
        FROM users u
        LEFT JOIN accounts a
          ON a.id = u.account_id
         AND a.deleted_at IS NULL
        LEFT JOIN user_join_invitations latest_inv
          ON latest_inv.id = (
            SELECT inv.id
            FROM user_join_invitations inv
            WHERE inv.organization_id = u.organization_id
              AND inv.user_id = u.id
            ORDER BY inv.created_at DESC
            LIMIT 1
          )
        LEFT JOIN units un ON un.id = u.primary_unit_id
        LEFT JOIN job_titles jt
          ON jt.id = u.job_title_id
         AND jt.organization_id = u.organization_id
         AND jt.deleted_at IS NULL
        LEFT JOIN sites s ON s.id = u.default_site_id
        LEFT JOIN work_policies wp ON wp.id = u.work_policy_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY u.created_at DESC
      `,
      params,
    );
    const roleCodesByUserId = await loadRoleCodesByUserId(organizationId);
    return rows.map((row) => mapUserRow(row, roleCodesByUserId));
  }

  return {
    listUsers,
  };
}

module.exports = {
  createUserReadModels,
};
