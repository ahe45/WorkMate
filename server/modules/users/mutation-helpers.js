const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { normalizeLoginEmail: normalizeCommonLoginEmail } = require("../common/normalizers");
const { requireSystemRoleId } = require("../common/system-roles");
const { normalizeRoleCode } = require("./user-normalizers");

function createUserMutationHelpers({ accountsService } = {}) {
  function normalizeLoginEmail(value = "") {
    return typeof accountsService?.normalizeLoginEmail === "function"
      ? accountsService.normalizeLoginEmail(value)
      : normalizeCommonLoginEmail(value);
  }

  function assertRequiredUserFields(payload = {}, options = {}) {
    const errorPrefix = String(options.errorPrefix || "USER_CREATE").trim() || "USER_CREATE";
    const requireInviteChannels = options.requireInviteChannels === true;

    if (!String(payload.name || "").trim()
      && !`${String(payload.lastName || "").trim()}${String(payload.firstName || "").trim()}`.trim()) {
      throw createHttpError(400, "성명을 입력하세요.", `${errorPrefix}_NAME_REQUIRED`);
    }

    if (!String(payload.employeeNo || "").trim()) {
      throw createHttpError(400, "사번을 입력하세요.", `${errorPrefix}_EMPLOYEE_NO_REQUIRED`);
    }

    if (!String(payload.roleCode || "").trim()) {
      throw createHttpError(400, "권한을 선택하세요.", `${errorPrefix}_ROLE_REQUIRED`);
    }

    if (!String(payload.primaryUnitId || "").trim()) {
      throw createHttpError(400, "조직을 선택하세요.", `${errorPrefix}_UNIT_REQUIRED`);
    }

    if (!String(payload.jobTitleId || "").trim()) {
      throw createHttpError(400, "직급을 선택하세요.", `${errorPrefix}_JOB_TITLE_REQUIRED`);
    }

    if (!String(payload.workPolicyId || "").trim()) {
      throw createHttpError(400, "근로정책을 선택하세요.", `${errorPrefix}_POLICY_REQUIRED`);
    }

    if (!String(payload.joinDate || "").trim()) {
      throw createHttpError(400, "입사일을 선택하세요.", `${errorPrefix}_JOIN_DATE_REQUIRED`);
    }

    if (!String(payload.loginEmail || "").trim()) {
      throw createHttpError(400, "이메일을 입력하세요.", `${errorPrefix}_EMAIL_REQUIRED`);
    }

    if (!String(payload.phone || "").trim()) {
      throw createHttpError(400, "전화번호를 입력하세요.", `${errorPrefix}_PHONE_REQUIRED`);
    }

    if (requireInviteChannels && (!Array.isArray(payload.inviteChannels) || payload.inviteChannels.length === 0)) {
      throw createHttpError(400, "합류 요청 전송 방식을 하나 이상 선택하세요.", `${errorPrefix}_INVITE_CHANNEL_REQUIRED`);
    }
  }

  async function getJobTitleSummary(connection, organizationId, jobTitleId = "") {
    const normalizedJobTitleId = String(jobTitleId || "").trim();

    if (!normalizedJobTitleId) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT id, name
        FROM job_titles
        WHERE organization_id = ?
          AND id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId, normalizedJobTitleId],
    );

    return rows[0] || null;
  }

  async function findWorkspaceUserByLoginEmail(connection, organizationId = "", loginEmail = "", { excludedUserId = "" } = {}) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
    const normalizedExcludedUserId = String(excludedUserId || "").trim();

    if (!normalizedOrganizationId || !normalizedLoginEmail) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT id
        FROM users
        WHERE organization_id = ?
          AND login_email = ?
          AND deleted_at IS NULL
          ${normalizedExcludedUserId ? "AND id <> ?" : ""}
        LIMIT 1
      `,
      normalizedExcludedUserId
        ? [normalizedOrganizationId, normalizedLoginEmail, normalizedExcludedUserId]
        : [normalizedOrganizationId, normalizedLoginEmail],
    );

    return rows[0] || null;
  }

  function createWorkspaceLoginEmailExistsError() {
    return createHttpError(
      409,
      "이미 이 워크스페이스에 등록된 이메일입니다. 기존 직원 정보를 확인하세요.",
      "USER_LOGIN_EMAIL_EXISTS",
    );
  }

  async function assertWorkspaceLoginEmailAvailable(connection, organizationId = "", loginEmail = "", options = {}) {
    const existingUser = await findWorkspaceUserByLoginEmail(connection, organizationId, loginEmail, options);

    if (!existingUser) {
      return;
    }

    throw createWorkspaceLoginEmailExistsError();
  }

  async function resolveUserAccountBinding(connection, {
    currentAccountId = "",
    loginEmail = "",
  } = {}) {
    const normalizedCurrentAccountId = String(currentAccountId || "").trim();
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);
    const queryRunner = connection.query.bind(connection);
    const currentAccount = normalizedCurrentAccountId && accountsService?.findAccountByIdWithRunner
      ? await accountsService.findAccountByIdWithRunner(queryRunner, normalizedCurrentAccountId)
      : null;

    if (!normalizedLoginEmail) {
      return {
        account: null,
        shouldDetach: Boolean(currentAccount),
        staleAccountId: currentAccount?.id || "",
      };
    }

    const matchingAccount = accountsService?.findAccountByEmailWithRunner
      ? await accountsService.findAccountByEmailWithRunner(queryRunner, normalizedLoginEmail)
      : null;

    if (matchingAccount) {
      return {
        account: matchingAccount,
        shouldDetach: false,
        staleAccountId: currentAccount && currentAccount.id !== matchingAccount.id ? currentAccount.id : "",
      };
    }

    return {
      account: null,
      shouldDetach: Boolean(currentAccount),
      staleAccountId: "",
    };
  }

  async function cleanupStaleAccount(connection, accountId = "") {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId || typeof accountsService?.deleteAccountIfOrphaned !== "function") {
      return;
    }

    await accountsService.deleteAccountIfOrphaned(connection, normalizedAccountId);
  }

  function mapUserMutationError(error) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.code === "ER_DUP_ENTRY" && String(error?.message || "").includes("uk_users_org_login_email")) {
      throw createWorkspaceLoginEmailExistsError();
    }

    if (error?.code === "ER_DUP_ENTRY" && String(error?.message || "").includes("uk_users_org_employee_no")) {
      throw createHttpError(409, "이미 사용 중인 사번입니다. 다시 확인하세요.", "USER_EMPLOYEE_NO_EXISTS");
    }

    if (error?.code === "ER_DUP_ENTRY" && String(error?.message || "").includes("uk_accounts_login_email")) {
      throw createHttpError(409, "이미 사용 중인 로그인 이메일입니다. 다시 확인하세요.", "ACCOUNT_LOGIN_EMAIL_EXISTS");
    }

    throw error;
  }

  async function loadCurrentUserRoleCode(connection, organizationId, userId) {
    const [rows] = await connection.query(
      `
        SELECT r.code AS roleCode
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.organization_id = ?
          AND ur.user_id = ?
          AND (ur.effective_to IS NULL OR ur.effective_to >= UTC_TIMESTAMP(3))
        ORDER BY ur.created_at ASC, ur.effective_from ASC
        LIMIT 1
      `,
      [organizationId, userId],
    );

    return normalizeRoleCode(rows[0]?.roleCode || "");
  }

  async function replaceUserRole(connection, organizationId, userId, roleCode = "", roleId = "") {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const normalizedRoleId = String(roleId || "").trim()
      || (normalizedRoleCode ? await requireSystemRoleId((sql, params) => connection.query(sql, params), normalizedRoleCode) : "");

    await connection.query(
      `
        UPDATE user_roles
        SET effective_to = UTC_TIMESTAMP(3)
        WHERE organization_id = ?
          AND user_id = ?
          AND (effective_to IS NULL OR effective_to >= UTC_TIMESTAMP(3))
      `,
      [organizationId, userId],
    );

    if (!normalizedRoleId) {
      return;
    }

    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [generateId(), organizationId, userId, normalizedRoleId, "self", null],
    );
  }

  return {
    assertRequiredUserFields,
    assertWorkspaceLoginEmailAvailable,
    cleanupStaleAccount,
    getJobTitleSummary,
    loadCurrentUserRoleCode,
    mapUserMutationError,
    replaceUserRole,
    resolveUserAccountBinding,
  };
}

module.exports = {
  createUserMutationHelpers,
};
