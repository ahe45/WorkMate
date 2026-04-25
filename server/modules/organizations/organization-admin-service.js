const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../common/system-roles");

function createOrganizationAdminService({
  getOrganizationById,
  getOrganizationSummary,
  isManagedOrganization,
  withTransaction,
}) {
  if (
    typeof getOrganizationById !== "function"
    || typeof getOrganizationSummary !== "function"
    || typeof isManagedOrganization !== "function"
    || typeof withTransaction !== "function"
  ) {
    throw new Error("createOrganizationAdminService requires organization admin dependencies.");
  }

  function mapCreateOrganizationError(error) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.code === "ER_DUP_ENTRY") {
      throw createHttpError(409, "이미 사용 중인 회사 코드입니다.", "ORG_CREATE_CODE_EXISTS");
    }

    throw error;
  }

  function normalizeOrganizationPayload(payload = {}) {
    const code = String(payload.code || "").trim().toUpperCase();
    const name = String(payload.name || "").trim();
    const timezone = String(payload.timezone || "Asia/Seoul").trim() || "Asia/Seoul";

    if (!code || !name) {
      throw createHttpError(400, "조직 코드와 이름은 필수입니다.", "ORG_CREATE_INVALID");
    }

    return {
      code,
      name,
      timezone,
    };
  }

  async function fetchOrganizationById(queryRunner, organizationId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          code,
          name,
          status,
          timezone,
          metadata_json AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM organizations
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    );

    return rows[0] || null;
  }

  async function insertOrganizationGraph(connection, payload = {}, metadataSource = "admin") {
    const normalized = normalizeOrganizationPayload(payload);
    const organizationId = generateId();
    const rootUnitId = generateId();
    const policyId = generateId();

    await connection.query(
      `
        INSERT INTO organizations (id, code, name, status, timezone, metadata_json)
        VALUES (?, ?, ?, 'ACTIVE', ?, JSON_OBJECT('source', ?, 'company', true))
      `,
      [organizationId, normalized.code, normalized.name, normalized.timezone, metadataSource],
    );

    await connection.query(
      `
        INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
        VALUES (?, ?, NULL, 'ROOT', '기본 조직', 'DEPARTMENT', 'ACTIVE', 1, '/ROOT')
      `,
      [rootUnitId, organizationId],
    );

    await connection.query(
      `
        INSERT INTO work_policies (
          id, organization_id, code, name, track_type, timezone, standard_daily_minutes, standard_weekly_minutes,
          daily_max_minutes, late_grace_minutes, early_leave_grace_minutes, is_default
        )
        VALUES (?, ?, 'DEFAULT', '기본 정책', 'FIXED', ?, 480, 2400, 720, 10, 10, 1)
      `,
      [policyId, organizationId, normalized.timezone],
    );

    return {
      defaultWorkPolicyId: policyId,
      organization: await fetchOrganizationById(connection.query.bind(connection), organizationId),
      organizationId,
      rootUnitId,
    };
  }

  async function assignAdminOrganization(connection, adminUserId, organizationId) {
    const [existingRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM admin_account_organizations
        WHERE admin_user_id = ?
      `,
      [adminUserId],
    );
    const isDefault = Number(existingRows[0]?.count || 0) === 0 ? 1 : 0;

    await connection.query(
      `
        INSERT INTO admin_account_organizations (id, admin_user_id, organization_id, is_default)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          updated_at = CURRENT_TIMESTAMP(3),
          is_default = VALUES(is_default)
      `,
      [generateId(), adminUserId, organizationId, isDefault],
    );
  }

  async function assignOrganizationAdminRole(connection, userId, organizationId) {
    const queryRunner = connection.query.bind(connection);
    await ensureSystemRoles(queryRunner);
    const roleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.ORG_ADMIN);

    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES (?, ?, ?, ?, 'organization', ?)
      `,
      [generateId(), organizationId, userId, roleId, organizationId],
    );
  }

  async function createOrganization(payload = {}) {
    try {
      return await withTransaction(async (connection) => {
        const created = await insertOrganizationGraph(connection, payload, "admin");
        return created.organization;
      });
    } catch (error) {
      mapCreateOrganizationError(error);
    }
  }

  async function createManagedOrganization(adminUserId, payload = {}) {
    try {
      return await withTransaction(async (connection) => {
        const created = await insertOrganizationGraph(connection, payload, "account");
        await assignAdminOrganization(connection, adminUserId, created.organizationId);
        await assignOrganizationAdminRole(connection, adminUserId, created.organizationId);
        return created.organization;
      });
    } catch (error) {
      mapCreateOrganizationError(error);
    }
  }

  async function updateManagedOrganization(adminUserId, organizationId, payload = {}) {
    const organization = await getOrganizationById(organizationId);

    if (!organization) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    if (!(await isManagedOrganization(adminUserId, organizationId))) {
      throw createHttpError(403, "수정할 수 없는 회사입니다.", "ORG_UPDATE_FORBIDDEN");
    }

    try {
      const normalized = normalizeOrganizationPayload({
        code: payload.code,
        name: payload.name,
        timezone: organization.timezone,
      });

      await withTransaction(async (connection) => {
        await connection.query(
          `
            UPDATE organizations
            SET
              code = ?,
              name = ?,
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?
              AND deleted_at IS NULL
          `,
          [
            normalized.code,
            normalized.name,
            organizationId,
          ],
        );
      });

      return getOrganizationSummary(organizationId);
    } catch (error) {
      mapCreateOrganizationError(error);
    }
  }

  return {
    createManagedOrganization,
    createOrganization,
    updateManagedOrganization,
  };
}

module.exports = {
  createOrganizationAdminService,
};
