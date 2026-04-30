const { generateId } = require("../common/ids");
const { issueAccessToken, issueRefreshToken, verifyRefreshToken } = require("./tokens");

function buildAuthPayload(principal) {
  const isUserPrincipal = principal.principalType === "user";

  return {
    accountId: principal.accountId || "",
    principalType: principal.principalType || (isUserPrincipal ? "user" : "account"),
    sub: principal.id,
    userId: isUserPrincipal ? principal.id : null,
    orgId: principal.organizationId || null,
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

function createAuthSessionTokens() {
  async function storeRefreshToken(connection, { principal, refreshTokenJti, expiresAt, request }) {
    const metadata = getClientMetadata(request);
    const userId = principal.principalType === "user" ? principal.id : null;
    const accountId = String(principal.accountId || "").trim() || null;

    await connection.query(
      `
        INSERT INTO auth_refresh_tokens (
          id, organization_id, account_id, user_id, token_jti, expires_at, ip_address, user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        generateId(),
        principal.organizationId || null,
        accountId,
        userId,
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

  return {
    getClientMetadata,
    issueTokenPairForPrincipal,
  };
}

module.exports = {
  createAuthSessionTokens,
  getClientMetadata,
};
