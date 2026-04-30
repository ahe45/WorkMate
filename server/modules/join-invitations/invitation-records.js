const { createHttpError } = require("../common/http-error");
const { sha256 } = require("../common/ids");
const { normalizeInviteChannels, normalizeLoginEmail: normalizeCommonLoginEmail, parseJsonValue } = require("../common/normalizers");
const { normalizeInviteToken } = require("./delivery");

async function loadInvitationTarget(queryRunner, organizationId, userId) {
  const [rows] = await queryRunner(
    `
      SELECT
        u.id,
        u.organization_id AS organizationId,
        u.account_id AS accountId,
        COALESCE(a.login_email, u.login_email) AS loginEmail,
        COALESCE(a.password_hash, u.password_hash) AS passwordHash,
        u.name AS userName,
        u.phone,
        u.employment_status AS employmentStatus,
        u.metadata_json AS metadataJson,
        o.code AS organizationCode,
        o.name AS organizationName
      FROM users u
      INNER JOIN organizations o
        ON o.id = u.organization_id
      LEFT JOIN accounts a
        ON a.id = u.account_id
       AND a.deleted_at IS NULL
      WHERE u.organization_id = ?
        AND u.id = ?
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [organizationId, userId],
  );

  return rows[0] || null;
}

async function loadInvitationRecord(queryRunner, inviteToken) {
  const normalizedInviteToken = normalizeInviteToken(inviteToken);

  if (!normalizedInviteToken) {
    throw createHttpError(400, "합류 요청 링크가 올바르지 않습니다.", "WORKSPACE_JOIN_INVITE_REQUIRED");
  }

  const [rows] = await queryRunner(
    `
      SELECT
        inv.id,
        inv.organization_id AS organizationId,
        inv.user_id AS userId,
        inv.invite_channels_json AS inviteChannelsJson,
        inv.delivery_status AS deliveryStatus,
        inv.expires_at AS expiresAt,
        inv.consumed_at AS consumedAt,
        inv.revoked_at AS revokedAt,
        inv.replaced_by_invitation_id AS replacedByInvitationId,
        u.account_id AS accountId,
        COALESCE(a.login_email, u.login_email) AS loginEmail,
        u.name AS userName,
        u.employment_status AS employmentStatus,
        u.metadata_json AS metadataJson,
        o.code AS organizationCode,
        o.name AS organizationName
      FROM user_join_invitations inv
      INNER JOIN users u
        ON u.id = inv.user_id
       AND u.organization_id = inv.organization_id
       AND u.deleted_at IS NULL
      LEFT JOIN accounts a
        ON a.id = u.account_id
       AND a.deleted_at IS NULL
      INNER JOIN organizations o
        ON o.id = inv.organization_id
       AND o.deleted_at IS NULL
      WHERE inv.invite_token_hash = ?
      LIMIT 1
    `,
    [sha256(normalizedInviteToken)],
  );

  return rows[0] || null;
}

function assertInvitationUsable(invitation = null) {
  if (!invitation) {
    throw createHttpError(404, "합류 요청 링크를 찾을 수 없습니다.", "WORKSPACE_JOIN_INVITE_NOT_FOUND");
  }

  if (invitation.revokedAt) {
    throw createHttpError(410, "이 합류 요청 링크는 이미 폐기되었습니다. 새 초대 메일을 요청하세요.", "WORKSPACE_JOIN_INVITE_REVOKED");
  }

  if (invitation.consumedAt) {
    throw createHttpError(409, "이미 사용된 합류 요청 링크입니다. 새 초대 메일을 요청하세요.", "WORKSPACE_JOIN_INVITE_ALREADY_USED");
  }

  const expiresAtTime = new Date(invitation.expiresAt).getTime();

  if (!Number.isFinite(expiresAtTime) || expiresAtTime <= Date.now()) {
    throw createHttpError(410, "합류 요청 링크가 만료되었습니다. 새 초대 메일을 요청하세요.", "WORKSPACE_JOIN_INVITE_EXPIRED");
  }
}

function normalizeInvitationLoginEmail(accountsService, value = "") {
  return typeof accountsService?.normalizeLoginEmail === "function"
    ? accountsService.normalizeLoginEmail(value)
    : normalizeCommonLoginEmail(value);
}

function assertInvitationExpectedIdentity(invitation, {
  expectedAccountId = "",
  expectedLoginEmail = "",
  expectedUserId = "",
} = {}) {
  const normalizedExpectedAccountId = String(expectedAccountId || "").trim();
  const normalizedExpectedUserId = String(expectedUserId || "").trim();
  const normalizedExpectedLoginEmail = String(expectedLoginEmail || "").trim().toLowerCase();

  if (normalizedExpectedUserId && String(invitation.userId || "").trim() !== normalizedExpectedUserId) {
    throw createHttpError(403, "초대받은 계정으로 로그인하세요.", "WORKSPACE_JOIN_INVITE_USER_MISMATCH");
  }

  if (normalizedExpectedLoginEmail && String(invitation.loginEmail || "").trim().toLowerCase() !== normalizedExpectedLoginEmail) {
    throw createHttpError(403, "초대받은 계정으로 로그인하세요.", "WORKSPACE_JOIN_INVITE_LOGIN_MISMATCH");
  }

  if (normalizedExpectedAccountId && String(invitation.accountId || "").trim() && String(invitation.accountId || "").trim() !== normalizedExpectedAccountId) {
    throw createHttpError(403, "초대받은 계정으로 로그인하세요.", "WORKSPACE_JOIN_INVITE_ACCOUNT_MISMATCH");
  }

  return {
    normalizedExpectedAccountId,
    normalizedExpectedLoginEmail,
    normalizedExpectedUserId,
  };
}

async function buildInvitationContext({
  accountsService,
  inviteToken = "",
  queryRunner,
} = {}) {
  const invitation = await loadInvitationRecord(queryRunner, inviteToken);

  assertInvitationUsable(invitation);

  const normalizedLoginEmail = normalizeInvitationLoginEmail(accountsService, invitation.loginEmail);
  const existingAccount = normalizedLoginEmail
    ? await accountsService.findAccountByEmailWithRunner(queryRunner, normalizedLoginEmail)
    : null;

  return {
    accountExists: Boolean(existingAccount),
    expiresAt: invitation.expiresAt,
    inviteChannels: normalizeInviteChannels(parseJsonValue(invitation.inviteChannelsJson)),
    loginEmail: normalizedLoginEmail,
    organizationCode: String(invitation.organizationCode || "").trim().toUpperCase(),
    organizationId: invitation.organizationId,
    organizationName: String(invitation.organizationName || "").trim(),
    recipientName: String(invitation.userName || "").trim(),
  };
}

module.exports = {
  assertInvitationExpectedIdentity,
  assertInvitationUsable,
  buildInvitationContext,
  loadInvitationRecord,
  loadInvitationTarget,
  normalizeInvitationLoginEmail,
};
