const { recordAuditLog } = require("../common/audit-log");
const { createHttpError } = require("../common/http-error");
const { verifyAccessToken, verifyRefreshToken } = require("./tokens");

function createAuthSessionService({
  getClientMetadata,
  issueTokenPairForPrincipal,
  loadAccountPrincipalById,
  loadPrincipalByUserId,
  query,
  withTransaction,
}) {
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
          account_id AS accountId,
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
      const principal = tokenRecord.userId
        ? await loadPrincipalByUserId(tokenRecord.userId)
        : await loadAccountPrincipalById(tokenRecord.accountId);

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
          actorUserId: principal.principalType === "user" ? principal.id : null,
          entityId: principal.id,
          entityType: principal.principalType === "user" ? "user" : "account",
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
        actorUserId: principal.principalType === "user" ? principal.id : null,
        entityId: principal.id,
        entityType: principal.principalType === "user" ? "user" : "account",
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

    const principal = decoded.userId
      ? await loadPrincipalByUserId(decoded.userId)
      : await loadAccountPrincipalById(decoded.accountId || decoded.sub);

    if (!principal) {
      throw createHttpError(401, "사용자 정보를 찾을 수 없습니다.", "AUTH_USER_NOT_FOUND");
    }

    return {
      principal,
      tokenPayload: decoded,
    };
  }

  return Object.freeze({
    authenticateRequest,
    logout,
    refresh,
  });
}

module.exports = {
  createAuthSessionService,
};
