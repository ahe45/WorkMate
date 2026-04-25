const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");

function createUsersService({ query, withTransaction, hashPassword }) {
  function parseMetadata(metadataJson) {
    if (!metadataJson) {
      return {};
    }

    if (typeof metadataJson === "object") {
      return metadataJson;
    }

    try {
      return JSON.parse(String(metadataJson || "{}"));
    } catch (error) {
      return {};
    }
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

    return query(
      `
        SELECT
          u.id,
          u.organization_id AS organizationId,
          u.employee_no AS employeeNo,
          u.login_email AS loginEmail,
          u.name,
          u.phone,
          u.employment_status AS employmentStatus,
          u.employment_type AS employmentType,
          u.join_date AS joinDate,
          u.timezone,
          u.primary_unit_id AS primaryUnitId,
          un.name AS primaryUnitName,
          u.default_site_id AS defaultSiteId,
          s.name AS defaultSiteName,
          u.track_type AS trackType,
          u.work_policy_id AS workPolicyId,
          u.manager_user_id AS managerUserId,
          u.metadata_json AS metadataJson
        FROM users u
        LEFT JOIN units un ON un.id = u.primary_unit_id
        LEFT JOIN sites s ON s.id = u.default_site_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY u.created_at DESC
      `,
      params,
    );

    return rows.map((row) => {
      const metadata = parseMetadata(row.metadataJson);

      return {
        ...row,
        jobTitle: String(metadata.jobTitle || metadata.rank || metadata.position || "").trim() || "사원",
      };
    });
  }

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

  async function createUser(organizationId, payload = {}) {
    const employeeNo = String(payload.employeeNo || "").trim();
    const loginEmail = String(payload.loginEmail || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();

    if (!employeeNo || !loginEmail || !name || !payload.primaryUnitId || !payload.workPolicyId) {
      throw createHttpError(400, "필수 사용자 필드가 누락되었습니다.", "USER_CREATE_INVALID");
    }

    return withTransaction(async (connection) => {
      const id = generateId();
      const passwordHash = hashPassword(payload.password || "Passw0rd!");

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_OBJECT('source', 'admin'))
        `,
        [
          id,
          organizationId,
          employeeNo,
          loginEmail,
          passwordHash,
          name,
          payload.phone || null,
          payload.employmentStatus || "ACTIVE",
          payload.employmentType || "FULL_TIME",
          payload.joinDate || getCurrentDateKey(),
          payload.timezone || "Asia/Seoul",
          payload.primaryUnitId,
          payload.defaultSiteId || null,
          payload.trackType || "FIXED",
          payload.workPolicyId,
          payload.managerUserId || null,
        ],
      );

      if (payload.roleId) {
        await connection.query(
          `
            INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [generateId(), organizationId, id, payload.roleId, payload.scopeType || "self", payload.scopeId || null],
        );
      }

      const rows = await connection.query(
        `
          SELECT id, employee_no AS employeeNo, login_email AS loginEmail, name, employment_status AS employmentStatus
          FROM users
          WHERE id = ?
        `,
        [id],
      );

      return rows[0][0];
    });
  }

  async function updateUser(organizationId, userId, payload = {}) {
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

    await query(
      `
        UPDATE users
        SET
          name = COALESCE(:name, name),
          phone = COALESCE(:phone, phone),
          employment_status = COALESCE(:employmentStatus, employment_status),
          primary_unit_id = COALESCE(:primaryUnitId, primary_unit_id),
          default_site_id = COALESCE(:defaultSiteId, default_site_id),
          track_type = COALESCE(:trackType, track_type),
          work_policy_id = COALESCE(:workPolicyId, work_policy_id),
          manager_user_id = COALESCE(:managerUserId, manager_user_id)
        WHERE organization_id = :organizationId
          AND id = :userId
      `,
      {
        organizationId,
        userId,
        name: payload.name || null,
        phone: payload.phone || null,
        employmentStatus: payload.employmentStatus || null,
        primaryUnitId: payload.primaryUnitId || null,
        defaultSiteId: payload.defaultSiteId || null,
        trackType: payload.trackType || null,
        workPolicyId: payload.workPolicyId || null,
        managerUserId: payload.managerUserId || null,
      },
    );

    const rows = await query(
      `
        SELECT
          id,
          employee_no AS employeeNo,
          login_email AS loginEmail,
          name,
          employment_status AS employmentStatus
        FROM users
        WHERE id = :userId
      `,
      { userId },
    );

    return rows[0] || null;
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
        WHERE organization_id = :organizationId
          AND id = :userId
      `,
      {
        hasName: hasName ? 1 : 0,
        hasPhone: hasPhone ? 1 : 0,
        name: nextName || null,
        organizationId,
        phone: nextPhone || null,
        userId,
      },
    );

    const rows = await query(
      `
        SELECT
          id,
          employee_no AS employeeNo,
          login_email AS loginEmail,
          name,
          phone,
          employment_status AS employmentStatus
        FROM users
        WHERE id = :userId
      `,
      { userId },
    );

    return rows[0] || null;
  }

  return {
    createUser,
    getUserOrganizationId,
    listUsers,
    updateUserProfile,
    updateUser,
  };
}

module.exports = {
  createUsersService,
};
