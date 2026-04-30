const { recordAuditLog } = require("../common/audit-log");
const { createHttpError } = require("../common/http-error");
const { buildAccountPrincipal } = require("./principals");

function buildJoinInviteConfirmPath(inviteToken = "") {
  const normalizedInviteToken = String(inviteToken || "").trim();

  return normalizedInviteToken
    ? `/join-invite?joinInvite=${encodeURIComponent(normalizedInviteToken)}`
    : "/join-invite";
}

function createAuthRegistrationService({
  accountsService,
  getClientMetadata,
  issueTokenPairForPrincipal,
  joinInvitationsService,
  loadUserAuthRecord,
  normalizeLoginEmail,
  withTransaction,
}) {
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
      const existingAccount = await loadUserAuthRecord(normalizedEmail);

      if (existingAccount?.id) {
        throw createHttpError(409, "이미 사용 중인 이메일입니다.", "AUTH_REGISTER_EMAIL_EXISTS");
      }

      const account = await accountsService.createAccount(connection, {
        loginEmail: normalizedEmail,
        name: normalizedName,
        password: normalizedPassword,
      });

      const principal = buildAccountPrincipal({
        accountId: account.id,
        employeeNo: "",
        id: "",
        loginEmail: account.loginEmail,
        name: normalizedName,
      });
      const tokenPair = await issueTokenPairForPrincipal(connection, principal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        (sql, params) => connection.query(sql, params),
        {
          action: "auth.register",
          actorUserId: null,
          entityId: account.id,
          entityType: "account",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            accountId: account.id,
            email: normalizedEmail,
          },
          organizationId: null,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return tokenPair;
    });
  }

  async function registerInviteAccount({ inviteToken = "", password = "", request }) {
    const normalizedInviteToken = String(inviteToken || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedInviteToken) {
      throw createHttpError(400, "합류 요청 링크가 올바르지 않습니다.", "AUTH_INVITE_TOKEN_REQUIRED");
    }

    if (normalizedPassword.length < 8) {
      throw createHttpError(400, "비밀번호는 8자 이상이어야 합니다.", "AUTH_REGISTER_PASSWORD_SHORT");
    }

    if (!joinInvitationsService || typeof joinInvitationsService.getInvitationContext !== "function") {
      throw createHttpError(500, "합류 요청 인증 서비스를 초기화하지 못했습니다.", "AUTH_INVITE_SERVICE_UNAVAILABLE");
    }

    const invitation = await joinInvitationsService.getInvitationContext({
      inviteToken: normalizedInviteToken,
    });
    const normalizedEmail = normalizeLoginEmail(invitation.loginEmail);
    const normalizedName = String(invitation.recipientName || "").trim() || normalizedEmail.split("@")[0] || "구성원";

    if (!normalizedEmail) {
      throw createHttpError(400, "합류 요청 이메일을 확인할 수 없습니다.", "AUTH_INVITE_EMAIL_REQUIRED");
    }

    if (invitation.accountExists) {
      throw createHttpError(409, "이미 가입된 이메일입니다. 로그인 후 합류를 진행하세요.", "AUTH_INVITE_ACCOUNT_EXISTS");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      const existingAccount = await accountsService.findAccountByEmailWithRunner(queryRunner, normalizedEmail);

      if (existingAccount) {
        throw createHttpError(409, "이미 가입된 이메일입니다. 로그인 후 합류를 진행하세요.", "AUTH_INVITE_ACCOUNT_EXISTS");
      }

      const account = await accountsService.createAccount(connection, {
        loginEmail: normalizedEmail,
        name: normalizedName,
        password: normalizedPassword,
      });

      const principal = buildAccountPrincipal({
        accountId: account.id,
        employeeNo: "",
        id: "",
        loginEmail: account.loginEmail,
        name: normalizedName,
      });
      const tokenPair = await issueTokenPairForPrincipal(connection, principal, request);
      const metadata = getClientMetadata(request);

      await recordAuditLog(
        queryRunner,
        {
          action: "auth.invite_register",
          actorUserId: null,
          entityId: account.id,
          entityType: "account",
          ipAddress: metadata.ipAddress,
          metadataJson: {
            accountId: account.id,
            email: normalizedEmail,
            inviteTokenUsed: true,
            organizationId: invitation.organizationId,
          },
          organizationId: null,
          requestId: metadata.requestId,
          userAgent: metadata.userAgent,
        },
      );

      return {
        ...tokenPair,
        redirectPath: buildJoinInviteConfirmPath(normalizedInviteToken),
      };
    });
  }

  async function resolveJoinInvitation({ inviteToken = "" } = {}) {
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedInviteToken) {
      throw createHttpError(400, "합류 요청 링크가 올바르지 않습니다.", "AUTH_INVITE_TOKEN_REQUIRED");
    }

    if (!joinInvitationsService || typeof joinInvitationsService.getInvitationContext !== "function") {
      throw createHttpError(500, "합류 요청 인증 서비스를 초기화하지 못했습니다.", "AUTH_INVITE_SERVICE_UNAVAILABLE");
    }

    return joinInvitationsService.getInvitationContext({
      inviteToken: normalizedInviteToken,
    });
  }

  return Object.freeze({
    buildJoinInviteConfirmPath,
    registerAccount,
    registerInviteAccount,
    resolveJoinInvitation,
  });
}

module.exports = {
  buildJoinInviteConfirmPath,
  createAuthRegistrationService,
};
