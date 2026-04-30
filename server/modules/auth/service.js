const { recordAuditLog } = require("../common/audit-log");
const { createHttpError } = require("../common/http-error");
const { assertOrganizationAccess, assertRoles, hasAnyRole, hasPlatformRole } = require("./authorization");
const { createAuthPrincipalStore } = require("./principals");
const { createAuthRegistrationService } = require("./registration-service");
const { createAuthSessionService } = require("./session-service");
const { createAuthSessionTokens } = require("./session-tokens");

function createAuthService({ accountsService, joinInvitationsService, query, withTransaction, verifyPassword, hashPassword, organizationsService }) {
  const {
    loadAccountPrincipalById,
    loadDefaultMembershipUserId,
    loadMembershipUserIdForOrganization,
    loadPrincipalByUserId,
    loadUserAuthRecord,
    normalizeLoginEmail,
  } = createAuthPrincipalStore({ accountsService, query });
  const {
    getClientMetadata,
    issueTokenPairForPrincipal,
  } = createAuthSessionTokens();
  const {
    buildJoinInviteConfirmPath,
    registerAccount,
    registerInviteAccount,
    resolveJoinInvitation,
  } = createAuthRegistrationService({
    accountsService,
    getClientMetadata,
    issueTokenPairForPrincipal,
    joinInvitationsService,
    loadUserAuthRecord,
    normalizeLoginEmail,
    withTransaction,
  });
  const {
    authenticateRequest,
    logout,
    refresh,
  } = createAuthSessionService({
    getClientMetadata,
    issueTokenPairForPrincipal,
    loadAccountPrincipalById,
    loadPrincipalByUserId,
    query,
    withTransaction,
  });

  async function login({ inviteToken = "", loginEmail, password, request }) {
    const normalizedEmail = normalizeLoginEmail(loginEmail);
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedEmail || !password) {
      throw createHttpError(400, "이메일과 비밀번호를 모두 입력하세요.", "AUTH_LOGIN_REQUIRED");
    }

    const authRecord = await loadUserAuthRecord(normalizedEmail);

    if (!authRecord || !verifyPassword(password, authRecord.passwordHash)) {
      throw createHttpError(401, "이메일 또는 비밀번호가 올바르지 않습니다.", "AUTH_INVALID_CREDENTIALS");
    }

    let inviteRedirectPath = "";

    if (normalizedInviteToken) {
      if (!joinInvitationsService || typeof joinInvitationsService.getInvitationContext !== "function") {
        throw createHttpError(500, "합류 요청 인증 서비스를 초기화하지 못했습니다.", "AUTH_INVITE_SERVICE_UNAVAILABLE");
      }

      const invitation = await joinInvitationsService.getInvitationContext({
        inviteToken: normalizedInviteToken,
      });

      if (normalizeLoginEmail(invitation.loginEmail) !== normalizedEmail) {
        throw createHttpError(403, "초대받은 계정으로 로그인하세요.", "AUTH_INVITE_LOGIN_MISMATCH");
      }

      inviteRedirectPath = buildJoinInviteConfirmPath(normalizedInviteToken);
    }

    const targetUserId = await loadDefaultMembershipUserId(authRecord.id);
    const targetPrincipal = targetUserId
      ? await loadPrincipalByUserId(targetUserId)
      : await loadAccountPrincipalById(authRecord.id);

    if (!targetPrincipal) {
      throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
    }

    if (targetPrincipal.employmentStatus !== "ACTIVE" && !inviteRedirectPath) {
      const normalizedEmploymentStatus = String(targetPrincipal.employmentStatus || "").trim().toUpperCase();

      if (normalizedEmploymentStatus === "INVITED") {
        throw createHttpError(403, "합류 요청 메일의 링크를 통해 다시 로그인하세요.", "AUTH_INVITE_TOKEN_REQUIRED");
      }

      if (normalizedEmploymentStatus === "PENDING") {
        throw createHttpError(403, "관리자가 아직 합류 요청을 보내지 않은 직원입니다.", "AUTH_JOIN_REQUEST_PENDING");
      }

      throw createHttpError(403, "비활성 사용자입니다.", "AUTH_USER_INACTIVE");
    }

    return withTransaction(async (connection) => {
      const resolvedPrincipal = targetUserId
        ? await loadPrincipalByUserId(targetUserId)
        : await loadAccountPrincipalById(authRecord.id);

      if (!resolvedPrincipal) {
        throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
      }

      const tokenPair = await issueTokenPairForPrincipal(connection, resolvedPrincipal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.login",
          actorUserId: resolvedPrincipal.principalType === "user" ? resolvedPrincipal.id : null,
          entityId: resolvedPrincipal.id,
          entityType: resolvedPrincipal.principalType === "user" ? "user" : "account",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            inviteAccepted: false,
            inviteTokenPresent: Boolean(inviteRedirectPath),
            roles: resolvedPrincipal.roleCodes,
          },
          organizationId: resolvedPrincipal.organizationId,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return inviteRedirectPath
        ? {
          ...tokenPair,
          redirectPath: inviteRedirectPath,
        }
        : tokenPair;
    });
  }

  async function acceptJoinInvitation({ inviteToken = "", principal = null, request }) {
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedInviteToken) {
      throw createHttpError(400, "합류 요청 링크가 올바르지 않습니다.", "AUTH_INVITE_TOKEN_REQUIRED");
    }

    if (!principal || !String(principal.accountId || "").trim()) {
      throw createHttpError(401, "로그인이 필요합니다.", "AUTH_REQUIRED");
    }

    if (!joinInvitationsService || typeof joinInvitationsService.acceptInvitationForLogin !== "function") {
      throw createHttpError(500, "합류 요청 인증 서비스를 초기화하지 못했습니다.", "AUTH_INVITE_SERVICE_UNAVAILABLE");
    }

    const inviteAcceptance = await joinInvitationsService.acceptInvitationForLogin({
      actorAccountId: principal.accountId,
      actorUserId: principal.principalType === "user" ? principal.id : "",
      expectedAccountId: principal.accountId,
      expectedLoginEmail: principal.loginEmail,
      inviteToken: normalizedInviteToken,
      request,
    });

    return withTransaction(async (connection) => {
      const targetPrincipal = await loadPrincipalByUserId(inviteAcceptance.userId);

      if (!targetPrincipal) {
        throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
      }

      const tokenPair = await issueTokenPairForPrincipal(connection, targetPrincipal, request);

      return {
        ...tokenPair,
        invitationId: inviteAcceptance.invitationId,
        redirectPath: "/companies",
        workspaceRedirectPath: inviteAcceptance.redirectPath,
      };
    });
  }

  async function rejectJoinInvitation({ inviteToken = "", principal = null, request }) {
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedInviteToken) {
      throw createHttpError(400, "합류 요청 링크가 올바르지 않습니다.", "AUTH_INVITE_TOKEN_REQUIRED");
    }

    if (!principal || !String(principal.accountId || "").trim()) {
      throw createHttpError(401, "로그인이 필요합니다.", "AUTH_REQUIRED");
    }

    if (!joinInvitationsService || typeof joinInvitationsService.rejectInvitationForLogin !== "function") {
      throw createHttpError(500, "합류 요청 인증 서비스를 초기화하지 못했습니다.", "AUTH_INVITE_SERVICE_UNAVAILABLE");
    }

    const inviteRejection = await joinInvitationsService.rejectInvitationForLogin({
      actorAccountId: principal.accountId,
      actorUserId: principal.principalType === "user" ? principal.id : "",
      expectedAccountId: principal.accountId,
      expectedLoginEmail: principal.loginEmail,
      inviteToken: normalizedInviteToken,
      request,
    });

    return {
      invitationId: inviteRejection.invitationId,
      redirectPath: "/companies",
    };
  }

  async function updateAccountProfile(accountId = "", payload = {}) {
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedAccountId) {
      throw createHttpError(400, "계정을 찾을 수 없습니다.", "ACCOUNT_ID_REQUIRED");
    }

    return withTransaction(async (connection) => {
      await accountsService.updateAccount(connection, normalizedAccountId, {
        name: payload.name,
        phone: payload.phone,
      });

      return loadAccountPrincipalById(normalizedAccountId);
    });
  }

  async function verifyPrincipalPassword(principal = null, password = "") {
    const normalizedAccountId = String(principal?.accountId || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedAccountId) {
      throw createHttpError(401, "계정 인증 정보가 없습니다.", "AUTH_ACCOUNT_REQUIRED");
    }

    if (!normalizedPassword) {
      throw createHttpError(400, "비밀번호를 입력하세요.", "AUTH_PASSWORD_REQUIRED");
    }

    const account = await withTransaction(async (connection) => accountsService.findAccountByIdWithRunner(
      connection.query.bind(connection),
      normalizedAccountId,
    ));

    if (!account || !verifyPassword(normalizedPassword, account.passwordHash)) {
      throw createHttpError(401, "비밀번호가 올바르지 않습니다.", "AUTH_PASSWORD_INVALID");
    }

    return true;
  }

  async function switchOrganization({ organizationId = "", principal, request }) {
    const normalizedOrganizationId = String(organizationId || "").trim();

    if (!principal || !normalizedOrganizationId) {
      throw createHttpError(400, "전환할 워크스페이스를 선택하세요.", "AUTH_SWITCH_ORGANIZATION_REQUIRED");
    }

    assertOrganizationAccess(principal, normalizedOrganizationId);

    return withTransaction(async (connection) => {
      let targetPrincipal = null;

      if (String(principal.accountId || "").trim()) {
        const targetUserId = await loadMembershipUserIdForOrganization(principal.accountId, normalizedOrganizationId);

        if (targetUserId) {
          targetPrincipal = await loadPrincipalByUserId(targetUserId);
        }
      }

      if (!targetPrincipal) {
        targetPrincipal = await loadPrincipalByUserId(principal.id);
      }

      if (!targetPrincipal) {
        throw createHttpError(404, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
      }

      const tokenPair = await issueTokenPairForPrincipal(connection, targetPrincipal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.switch_organization",
          actorUserId: targetPrincipal.id,
          entityId: targetPrincipal.id,
          entityType: "user",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            accountId: targetPrincipal.accountId || null,
            organizationId: normalizedOrganizationId,
          },
          organizationId: normalizedOrganizationId,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return tokenPair;
    });
  }

  return {
    assertOrganizationAccess,
    assertRoles,
    authenticateRequest,
    acceptJoinInvitation,
    hasAnyRole,
    hasPlatformRole,
    loadPrincipalByUserId,
    login,
    logout,
    refresh,
    rejectJoinInvitation,
    registerAccount,
    registerInviteAccount,
    resolveJoinInvitation,
    switchOrganization,
    updateAccountProfile,
    verifyPrincipalPassword,
  };
}

module.exports = {
  createAuthService,
};
