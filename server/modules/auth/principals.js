const { getCurrentDateKey } = require("../common/date");
const { normalizeLoginEmail: normalizeCommonLoginEmail, parseJsonValue } = require("../common/normalizers");

function createAuthPrincipalStore({ accountsService, query }) {
  function normalizeLoginEmail(value = "") {
    return typeof accountsService?.normalizeLoginEmail === "function"
      ? accountsService.normalizeLoginEmail(value)
      : normalizeCommonLoginEmail(value);
  }

  async function loadRoles(accountId = "", userId = "") {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedAccountId && !normalizedUserId) {
      return [];
    }

    return query(
      `
        SELECT
          ur.user_id AS userId,
          r.code AS roleCode,
          ur.organization_id AS organizationId,
          ur.scope_type AS scopeType,
          ur.scope_id AS scopeId
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        INNER JOIN users u ON u.id = ur.user_id
        WHERE (${normalizedAccountId ? "u.account_id = :accountId" : "0 = 1"}
          OR ${normalizedUserId ? "u.id = :userId" : "0 = 1"})
          AND (ur.effective_to IS NULL OR ur.effective_to >= UTC_TIMESTAMP(3))
      `,
      {
        accountId: normalizedAccountId || null,
        userId: normalizedUserId || null,
      },
    );
  }

  async function loadManagedOrganizationIds(accountId = "", userId = "") {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedAccountId && !normalizedUserId) {
      return [];
    }

    const rows = await query(
      `
        SELECT DISTINCT map.organization_id AS organizationId
        FROM admin_account_organizations map
        INNER JOIN users u
          ON u.id = map.admin_user_id
         AND u.deleted_at IS NULL
        WHERE (${normalizedAccountId ? "u.account_id = :accountId" : "0 = 1"}
          OR ${normalizedUserId ? "u.id = :userId" : "0 = 1"})
      `,
      {
        accountId: normalizedAccountId || null,
        userId: normalizedUserId || null,
      },
    );

    return rows.map((row) => String(row.organizationId));
  }

  async function loadAccessibleOrganizationIds(accountId = "", userId = "") {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedUserId = String(userId || "").trim();

    if (!normalizedAccountId && !normalizedUserId) {
      return [];
    }

    const rows = await query(
      `
        SELECT DISTINCT organization_id AS organizationId
        FROM users
        WHERE deleted_at IS NULL
          AND employment_status = 'ACTIVE'
          AND (${normalizedAccountId ? "account_id = :accountId" : "0 = 1"}
            OR ${normalizedUserId ? "id = :userId" : "0 = 1"})
      `,
      {
        accountId: normalizedAccountId || null,
        userId: normalizedUserId || null,
      },
    );

    return rows.map((row) => String(row.organizationId || "").trim()).filter(Boolean);
  }

  async function loadPrincipalByUserId(userId) {
    const users = await query(
      `
        SELECT
          u.id,
          u.organization_id AS organizationId,
          u.account_id AS accountId,
          u.employee_no AS employeeNo,
          COALESCE(a.login_email, u.login_email) AS loginEmail,
          u.name,
          u.phone,
          u.employment_status AS employmentStatus,
          u.join_date AS joinDate,
          u.timezone,
          u.primary_unit_id AS primaryUnitId,
          u.default_site_id AS defaultSiteId,
          u.track_type AS trackType,
          u.work_policy_id AS workPolicyId,
          u.metadata_json AS metadataJson,
          o.name AS organizationName
        FROM users u
        LEFT JOIN organizations o
          ON o.id = u.organization_id
         AND o.deleted_at IS NULL
        LEFT JOIN accounts a
          ON a.id = u.account_id
         AND a.deleted_at IS NULL
        WHERE u.id = :userId
          AND u.deleted_at IS NULL
          AND u.employment_status <> 'RETIRED'
        LIMIT 1
      `,
      { userId },
    );

    const user = users[0];

    if (!user) {
      return null;
    }

    const roles = await loadRoles(user.accountId, user.id);
    const metadataJson = parseJsonValue(user.metadataJson) || {};
    const managedOrganizationIds = await loadManagedOrganizationIds(user.accountId, user.id);
    const accountOrganizationIds = await loadAccessibleOrganizationIds(user.accountId, user.id);
    const primaryOrganizationId = String(user.organizationId || "").trim();
    const accessibleOrganizationIds = Array.from(new Set([
      primaryOrganizationId,
      ...accountOrganizationIds,
      ...managedOrganizationIds,
    ].filter(Boolean)));

    return {
      ...user,
      accessibleOrganizationIds,
      accountId: String(user.accountId || "").trim(),
      managedOrganizationIds,
      metadataJson,
      principalType: "user",
      roles,
      roleCodes: roles.map((role) => role.roleCode),
    };
  }

  async function loadAccountPrincipalById(accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId || !accountsService?.findAccountByIdWithRunner) {
      return null;
    }

    const account = await accountsService.findAccountByIdWithRunner(
      async (sql, params) => [await query(sql, params)],
      normalizedAccountId,
    );

    if (!account) {
      return null;
    }

    const managedOrganizationIds = await loadManagedOrganizationIds(account.id, "");
    const accountOrganizationIds = await loadAccessibleOrganizationIds(account.id, "");
    const roleCode = String(account.roleCode || "").trim().toUpperCase();
    const roles = roleCode
      ? [{
        organizationId: null,
        roleCode,
        scopeId: null,
        scopeType: "platform",
        userId: null,
      }]
      : [];

    return {
      accountId: String(account.id || "").trim(),
      accessibleOrganizationIds: Array.from(new Set([
        ...accountOrganizationIds,
        ...managedOrganizationIds,
      ].filter(Boolean))),
      defaultSiteId: null,
      employeeNo: "",
      employmentStatus: "ACTIVE",
      id: String(account.id || "").trim(),
      joinDate: getCurrentDateKey(),
      loginEmail: account.loginEmail,
      managedOrganizationIds,
      metadataJson: {
        source: "account",
      },
      name: String(account.name || "").trim(),
      organizationId: null,
      organizationName: null,
      phone: String(account.phone || "").trim(),
      primaryUnitId: null,
      principalType: "account",
      roleCodes: roles.map((role) => role.roleCode),
      roles,
      timezone: "Asia/Seoul",
      trackType: null,
      workPolicyId: null,
    };
  }

  async function loadUserAuthRecord(loginEmail) {
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (!normalizedLoginEmail) {
      return null;
    }

    return accountsService?.getAccountAuthRecord
      ? accountsService.getAccountAuthRecord(normalizedLoginEmail)
      : null;
  }

  async function loadDefaultMembershipUserId(accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      return "";
    }

    const rows = await query(
      `
        SELECT id
        FROM users
        WHERE account_id = :accountId
          AND deleted_at IS NULL
          AND employment_status = 'ACTIVE'
        ORDER BY
          CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END ASC,
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
      { accountId: normalizedAccountId },
    );

    return String(rows[0]?.id || "").trim();
  }

  async function loadMembershipUserIdForOrganization(accountId = "", organizationId = "") {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedOrganizationId = String(organizationId || "").trim();

    if (!normalizedAccountId || !normalizedOrganizationId) {
      return "";
    }

    const rows = await query(
      `
        SELECT id
        FROM users
        WHERE account_id = :accountId
          AND organization_id = :organizationId
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
      {
        accountId: normalizedAccountId,
        organizationId: normalizedOrganizationId,
      },
    );

    return String(rows[0]?.id || "").trim();
  }

  return {
    loadAccountPrincipalById,
    loadDefaultMembershipUserId,
    loadMembershipUserIdForOrganization,
    loadPrincipalByUserId,
    loadUserAuthRecord,
    normalizeLoginEmail,
  };
}

function buildAccountPrincipal({ accountId, id, loginEmail, name, employeeNo }) {
  return {
    accountId: String(accountId || "").trim(),
    accessibleOrganizationIds: [],
    defaultSiteId: null,
    employeeNo,
    employmentStatus: "ACTIVE",
    id: String(accountId || id || "").trim(),
    joinDate: getCurrentDateKey(),
    loginEmail,
    managedOrganizationIds: [],
    metadataJson: {
      source: "account",
    },
    name,
    organizationId: null,
    organizationName: null,
    phone: null,
    primaryUnitId: null,
    principalType: "account",
    roleCodes: [],
    roles: [],
    timezone: "Asia/Seoul",
    trackType: null,
    workPolicyId: null,
  };
}

module.exports = {
  buildAccountPrincipal,
  createAuthPrincipalStore,
};
