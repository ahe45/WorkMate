const { recordAuditLog } = require("../common/audit-log");
const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const { ensurePlatformInfrastructure } = require("../platform/infrastructure");
const { issueAccessToken, issueRefreshToken, verifyAccessToken, verifyRefreshToken } = require("./tokens");

function createAuthService({ query, withTransaction, verifyPassword, hashPassword, organizationsService }) {
  function parseJsonValue(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "object") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  async function loadRoles(userId) {
    return query(
      `
        SELECT
          r.code AS roleCode,
          ur.organization_id AS organizationId,
          ur.scope_type AS scopeType,
          ur.scope_id AS scopeId
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = :userId
          AND (ur.effective_to IS NULL OR ur.effective_to >= UTC_TIMESTAMP(3))
      `,
      { userId },
    );
  }

  async function loadManagedOrganizationIds(userId) {
    const rows = await query(
      `
        SELECT organization_id AS organizationId
        FROM admin_account_organizations
        WHERE admin_user_id = :userId
      `,
      { userId },
    );

    return rows.map((row) => String(row.organizationId));
  }

  async function loadPrincipalByUserId(userId) {
    const users = await query(
      `
        SELECT
          u.id,
          u.organization_id AS organizationId,
          u.employee_no AS employeeNo,
          u.login_email AS loginEmail,
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
        INNER JOIN organizations o ON o.id = u.organization_id
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

    const roles = await loadRoles(user.id);
    const metadataJson = parseJsonValue(user.metadataJson) || {};
    const isPlatformAccount = metadataJson.platformAccount === true;
    const managedOrganizationIds = await loadManagedOrganizationIds(user.id);
    const accessibleOrganizationIds = isPlatformAccount
      ? managedOrganizationIds
      : Array.from(new Set([String(user.organizationId), ...managedOrganizationIds]));

    return {
      ...user,
      accessibleOrganizationIds,
      isPlatformAccount,
      managedOrganizationIds,
      metadataJson,
      roles,
      roleCodes: roles.map((role) => role.roleCode),
    };
  }

  async function loadUserAuthRecord(loginEmail) {
    const rows = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          employment_status AS employmentStatus
        FROM users
        WHERE login_email = :loginEmail
          AND deleted_at IS NULL
        LIMIT 1
      `,
      { loginEmail },
    );

    return rows[0] || null;
  }

  function buildAuthPayload(principal) {
    return {
      sub: principal.id,
      userId: principal.id,
      orgId: principal.organizationId,
      email: principal.loginEmail,
    };
  }

  function getClientMetadata(request) {
    return {
      ipAddress: request.socket?.remoteAddress || "",
      requestId: request.headers["x-request-id"] || "",
      userAgent: request.headers["user-agent"] || "",
    };
  }

  async function storeRefreshToken(connection, { principal, refreshTokenJti, expiresAt, request }) {
    const metadata = getClientMetadata(request);

    await connection.query(
      `
        INSERT INTO auth_refresh_tokens (
          id, organization_id, user_id, token_jti, expires_at, ip_address, user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        generateId(),
        principal.organizationId,
        principal.id,
        refreshTokenJti,
        expiresAt,
        metadata.ipAddress || null,
        metadata.userAgent || null,
      ],
    );
  }

  async function issueTokenPairForPrincipal(connection, principal, request) {
    const accessToken = issueAccessToken(buildAuthPayload(principal));
    const refreshTokenResult = issueRefreshToken(buildAuthPayload(principal));
    const decodedRefresh = verifyRefreshToken(refreshTokenResult.token);

    await storeRefreshToken(connection, {
      principal,
      expiresAt: new Date(decodedRefresh.exp * 1000),
      refreshTokenJti: refreshTokenResult.jti,
      request,
    });

    return {
      accessToken,
      expiresIn: decodedRefresh.exp - decodedRefresh.iat,
      refreshToken: refreshTokenResult.token,
      tokenType: "Bearer",
      user: principal,
    };
  }

  function buildPlatformPrincipal({ id, loginEmail, name, employeeNo, platformContext }) {
    return {
      accessibleOrganizationIds: [],
      defaultSiteId: null,
      employeeNo,
      employmentStatus: "ACTIVE",
      id,
      isPlatformAccount: true,
      joinDate: getCurrentDateKey(),
      loginEmail,
      managedOrganizationIds: [],
      metadataJson: {
        platformAccount: true,
        source: "landing",
      },
      name,
      organizationId: platformContext.organizationId,
      organizationName: "WorkMate Platform",
      phone: null,
      primaryUnitId: platformContext.unitId,
      roleCodes: [],
      roles: [],
      timezone: "Asia/Seoul",
      trackType: "FIXED",
      workPolicyId: platformContext.workPolicyId,
    };
  }

  async function registerAccount({ loginEmail, name, password, request }) {
    const normalizedEmail = String(loginEmail || "").trim().toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      throw createHttpError(400, "이름, 이메일, 비밀번호를 모두 입력하세요.", "AUTH_REGISTER_REQUIRED");
    }

    if (normalizedPassword.length < 8) {
      throw createHttpError(400, "비밀번호는 8자 이상이어야 합니다.", "AUTH_REGISTER_PASSWORD_SHORT");
    }

    return withTransaction(async (connection) => {
      const platformContext = await ensurePlatformInfrastructure(connection);

      const [existingRows] = await connection.query(
        `
          SELECT id
          FROM users
          WHERE login_email = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedEmail],
      );

      if (existingRows[0]) {
        throw createHttpError(409, "이미 사용 중인 이메일입니다.", "AUTH_REGISTER_EMAIL_EXISTS");
      }

      const userId = generateId();
      const employeeNo = `ADM-${generateId().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const passwordHash = hashPassword(normalizedPassword);

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, NULL, 'ACTIVE', 'FULL_TIME', CURDATE(), 'Asia/Seoul', ?, NULL, 'FIXED', ?, NULL,
            JSON_OBJECT('platformAccount', true, 'source', 'landing'))
        `,
        [userId, platformContext.organizationId, employeeNo, normalizedEmail, passwordHash, normalizedName, platformContext.unitId, platformContext.workPolicyId],
      );

      const principal = buildPlatformPrincipal({
        employeeNo,
        id: userId,
        loginEmail: normalizedEmail,
        name: normalizedName,
        platformContext,
      });
      const tokenPair = await issueTokenPairForPrincipal(connection, principal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.register",
          actorUserId: userId,
          entityId: userId,
          entityType: "user",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            email: normalizedEmail,
            platformAccount: true,
          },
          organizationId: platformContext.organizationId,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return tokenPair;
    });
  }

  async function login({ loginEmail, password, request }) {
    const normalizedEmail = String(loginEmail || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      throw createHttpError(400, "이메일과 비밀번호를 모두 입력하세요.", "AUTH_LOGIN_REQUIRED");
    }

    const authRecord = await loadUserAuthRecord(normalizedEmail);

    if (!authRecord || !verifyPassword(password, authRecord.passwordHash)) {
      throw createHttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.", "AUTH_INVALID_CREDENTIALS");
    }

    if (authRecord.employmentStatus !== "ACTIVE") {
      throw createHttpError(403, "비활성 사용자입니다.", "AUTH_USER_INACTIVE");
    }

    return withTransaction(async (connection) => {
      const principal = await loadPrincipalByUserId(authRecord.id);

      if (!principal) {
        throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
      }

      const tokenPair = await issueTokenPairForPrincipal(connection, principal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.login",
          actorUserId: principal.id,
          entityId: principal.id,
          entityType: "user",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            platformAccount: principal.isPlatformAccount,
            roles: principal.roleCodes,
          },
          organizationId: principal.organizationId,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return tokenPair;
    });
  }

  async function refresh({ refreshToken, request }) {
    let decoded;

    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw createHttpError(401, "리프레시 토큰이 유효하지 않습니다.", "AUTH_REFRESH_INVALID");
    }

    const tokenRows = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          user_id AS userId,
          token_jti AS tokenJti,
          expires_at AS expiresAt,
          revoked_at AS revokedAt
        FROM auth_refresh_tokens
        WHERE token_jti = :tokenJti
        LIMIT 1
      `,
      { tokenJti: decoded.jti },
    );
    const tokenRecord = tokenRows[0];

    if (!tokenRecord || tokenRecord.revokedAt || new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
      throw createHttpError(401, "리프레시 토큰이 만료되었거나 폐기되었습니다.", "AUTH_REFRESH_REVOKED");
    }

    return withTransaction(async (connection) => {
      const principal = await loadPrincipalByUserId(tokenRecord.userId);

      if (!principal) {
        throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
      }

      const nextTokenPair = await issueTokenPairForPrincipal(connection, principal, request);
      const decodedNextRefresh = verifyRefreshToken(nextTokenPair.refreshToken);
      const metadata = getClientMetadata(request);

      await connection.query(
        `
          UPDATE auth_refresh_tokens
          SET revoked_at = UTC_TIMESTAMP(3),
              replaced_by_jti = ?
          WHERE token_jti = ?
        `,
        [decodedNextRefresh.jti, decoded.jti],
      );

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.refresh",
          actorUserId: principal.id,
          entityId: principal.id,
          entityType: "user",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            nextJti: decodedNextRefresh.jti,
            previousJti: decoded.jti,
          },
          organizationId: principal.organizationId,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return nextTokenPair;
    });
  }

  async function logout({ refreshToken, principal, request }) {
    if (!refreshToken) {
      return { success: true };
    }

    let decoded = null;

    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return { success: true };
    }

    await query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP(3))
        WHERE token_jti = :tokenJti
      `,
      { tokenJti: decoded.jti },
    );

    if (principal) {
      const metadata = getClientMetadata(request);
      await recordAuditLog(query, {
        action: "auth.logout",
        actorUserId: principal.id,
        entityId: principal.id,
        entityType: "user",
        ipAddress: metadata.ipAddress,
        organizationId: principal.organizationId,
        requestId: metadata.requestId,
        userAgent: metadata.userAgent,
      });
    }

    return { success: true };
  }

  function getBearerToken(request) {
    const authorizationHeader = String(request.headers.authorization || "");
    const [scheme, token] = authorizationHeader.split(" ");
    return scheme === "Bearer" ? token : "";
  }

  async function authenticateRequest(request, options = {}) {
    const required = options.required !== false;
    const token = getBearerToken(request);

    if (!token) {
      if (required) {
        throw createHttpError(401, "인증이 필요합니다.", "AUTH_REQUIRED");
      }

      return null;
    }

    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      throw createHttpError(401, "액세스 토큰이 유효하지 않습니다.", "AUTH_ACCESS_INVALID");
    }

    const principal = await loadPrincipalByUserId(decoded.userId || decoded.sub);

    if (!principal) {
      throw createHttpError(401, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
    }

    return {
      principal,
      tokenPayload: decoded,
    };
  }

  function isPlatformAccount(principal) {
    return principal?.isPlatformAccount === true;
  }

  function hasPlatformRole(principal, roleCodes = []) {
    if (!principal) {
      return false;
    }

    const requiredRoleCodes = new Set(roleCodes.map((roleCode) => String(roleCode || "").trim()).filter(Boolean));
    return (principal.roles || []).some((role) => requiredRoleCodes.has(String(role.roleCode || "").trim()) && String(role.scopeType || "").toLowerCase() === "platform");
  }

  function hasAnyRole(principal, roleCodes = [], organizationId = "") {
    if (!principal) {
      return false;
    }

    if (hasPlatformRole(principal, roleCodes)) {
      return true;
    }

    const requiredRoleCodes = new Set(roleCodes.map((roleCode) => String(roleCode || "").trim()).filter(Boolean));
    const targetOrganizationId = String(organizationId || "").trim();

    if (!targetOrganizationId) {
      return false;
    }

    return (principal.roles || []).some((role) => {
      const roleCode = String(role.roleCode || "").trim();
      const scopeType = String(role.scopeType || "").trim().toLowerCase();
      const scopeId = role.scopeId ? String(role.scopeId) : "";

      if (!requiredRoleCodes.has(roleCode)) {
        return false;
      }

      if (scopeType === "organization") {
        return scopeId === targetOrganizationId;
      }

      return (scopeType === "self" || !scopeType) && String(principal.organizationId) === targetOrganizationId;
    });
  }

  function assertRoles(principal, roleCodes, message = "권한이 없습니다.", organizationId = "") {
    if (!hasAnyRole(principal, roleCodes, organizationId)) {
      throw createHttpError(403, message, "AUTH_FORBIDDEN");
    }
  }

  function assertOrganizationAccess(principal, organizationId) {
    if (hasPlatformRole(principal, ["SYSTEM_ADMIN"])) {
      return true;
    }

    const accessibleIds = new Set((principal?.accessibleOrganizationIds || []).map((value) => String(value)));

    if (accessibleIds.has(String(organizationId))) {
      return true;
    }

    throw createHttpError(403, "선택한 회사에 접근할 수 없습니다.", "AUTH_SCOPE_FORBIDDEN");
  }

  return {
    assertOrganizationAccess,
    assertRoles,
    authenticateRequest,
    hasAnyRole,
    hasPlatformRole,
    isPlatformAccount,
    loadPrincipalByUserId,
    login,
    logout,
    refresh,
    registerAccount,
  };
}

module.exports = {
  createAuthService,
};
