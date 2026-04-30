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

  function parseMetadataValue(value) {
    if (!value) {
      return {};
    }

    if (typeof value === "object") {
      return value;
    }

    try {
      return JSON.parse(String(value || "{}"));
    } catch (error) {
      return {};
    }
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

  async function loadAdminAccountSource(queryRunner, accountId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          phone,
          role_code AS roleCode
        FROM accounts
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [accountId],
    );

    return rows[0] || null;
  }

  async function findMembershipUserByAccount(queryRunner, organizationId, accountId) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedOrganizationId || !normalizedAccountId) {
      return null;
    }

    const [rows] = await queryRunner(
      `
        SELECT id
        FROM users
        WHERE organization_id = ?
          AND account_id = ?
          AND deleted_at IS NULL
          AND employment_status <> 'RETIRED'
        ORDER BY
          CASE employment_status
            WHEN 'ACTIVE' THEN 0
            WHEN 'INVITED' THEN 1
            WHEN 'PENDING' THEN 2
            WHEN 'DRAFT' THEN 3
            ELSE 4
          END ASC,
          created_at ASC
        LIMIT 1
      `,
      [normalizedOrganizationId, normalizedAccountId],
    );

    return rows[0] || null;
  }

  async function ensureManagedOrganizationAdminRole(connection, userId, organizationId) {
    const queryRunner = connection.query.bind(connection);
    await ensureSystemRoles(queryRunner);
    const roleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.SYSTEM_ADMIN);
    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM user_roles
        WHERE organization_id = ?
          AND user_id = ?
          AND role_id = ?
          AND (effective_to IS NULL OR effective_to >= UTC_TIMESTAMP(3))
        LIMIT 1
      `,
      [organizationId, userId, roleId],
    );

    if (existingRows[0]?.id) {
      return String(existingRows[0].id);
    }

    const bindingId = generateId();
    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES (?, ?, ?, ?, 'organization', ?)
      `,
      [bindingId, organizationId, userId, roleId, organizationId],
    );

    return bindingId;
  }

  async function createManagedOrganizationMembership(connection, adminPrincipal = {}, createdOrganization = {}) {
    const queryRunner = connection.query.bind(connection);
    const normalizedAccountId = String(adminPrincipal.accountId || "").trim();

    if (!normalizedAccountId) {
      throw createHttpError(400, "관리자 계정 연결 정보가 없습니다.", "ORG_ADMIN_ACCOUNT_MISSING");
    }

    const sourceAccount = await loadAdminAccountSource(queryRunner, normalizedAccountId);

    if (!sourceAccount) {
      throw createHttpError(404, "조직을 생성한 관리자 계정을 찾을 수 없습니다.", "ORG_ADMIN_USER_NOT_FOUND");
    }

    const existingMembership = await findMembershipUserByAccount(queryRunner, createdOrganization.organizationId, normalizedAccountId);

    if (existingMembership?.id) {
      await ensureManagedOrganizationAdminRole(connection, existingMembership.id, createdOrganization.organizationId);
      return {
        accountId: normalizedAccountId,
        userId: String(existingMembership.id),
      };
    }

    const membershipUserId = generateId();
    const employeeNo = `E${generateId().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const nextMetadata = {
      managedMembership: true,
      source: "account",
    };

    await connection.query(
      `
        INSERT INTO users (
          id, organization_id, account_id, employee_no, login_email, password_hash, name, phone, employment_status,
          employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
          manager_user_id, metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, NULL, ?, ?, NULL, ?)
      `,
      [
        membershipUserId,
        createdOrganization.organizationId,
        normalizedAccountId,
        employeeNo,
        String(sourceAccount.loginEmail || "").trim() || null,
        String(sourceAccount.passwordHash || "").trim() || null,
        String(sourceAccount.name || "").trim() || "조직 관리자",
        String(sourceAccount.phone || "").trim() || null,
        "FULL_TIME",
        new Date(),
        "Asia/Seoul",
        null,
        "FIXED",
        null,
        JSON.stringify(nextMetadata),
      ],
    );

    await ensureManagedOrganizationAdminRole(connection, membershipUserId, createdOrganization.organizationId);

    return {
      accountId: normalizedAccountId,
      userId: membershipUserId,
    };
  }

  async function assignAdminOrganization(connection, adminUserId, organizationId, accountId = "") {
    const normalizedAdminUserId = String(adminUserId || "").trim();
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAdminUserId || !normalizedOrganizationId) {
      throw createHttpError(400, "관리 조직 매핑에 필요한 정보가 부족합니다.", "ORG_ADMIN_MAPPING_INVALID");
    }

    const [existingRows] = await connection.query(
      normalizedAccountId
        ? `
            SELECT COUNT(*) AS count
            FROM admin_account_organizations map
            INNER JOIN users mapped_admin
              ON mapped_admin.id = map.admin_user_id
             AND mapped_admin.deleted_at IS NULL
            WHERE mapped_admin.account_id = ?
          `
        : `
            SELECT COUNT(*) AS count
            FROM admin_account_organizations
            WHERE admin_user_id = ?
          `,
      [normalizedAccountId || normalizedAdminUserId],
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
      [generateId(), normalizedAdminUserId, normalizedOrganizationId, isDefault],
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

  async function createManagedOrganization(adminPrincipal, payload = {}) {
    try {
      return await withTransaction(async (connection) => {
        const created = await insertOrganizationGraph(connection, payload, "account");
        const adminMembership = await createManagedOrganizationMembership(connection, adminPrincipal, created);
        await assignAdminOrganization(connection, adminMembership.userId, created.organizationId, adminMembership.accountId);
        return created.organization;
      });
    } catch (error) {
      mapCreateOrganizationError(error);
    }
  }

  async function updateManagedOrganization(adminPrincipal, organizationId, payload = {}) {
    const organization = await getOrganizationById(organizationId);

    if (!organization) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    if (!(await isManagedOrganization(adminPrincipal, organizationId))) {
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
