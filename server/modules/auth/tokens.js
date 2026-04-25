const jwt = require("jsonwebtoken");
const { generateId } = require("../common/ids");

function buildJwtConfig() {
  return {
    accessSecret: process.env.JWT_ACCESS_SECRET || "workmate-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "workmate-refresh-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  };
}

function issueAccessToken(subject) {
  const config = buildJwtConfig();
  return jwt.sign(subject, config.accessSecret, {
    expiresIn: config.accessExpiresIn,
    jwtid: generateId(),
  });
}

function issueRefreshToken(subject) {
  const config = buildJwtConfig();
  const jti = generateId();

  return {
    token: jwt.sign(subject, config.refreshSecret, {
      expiresIn: config.refreshExpiresIn,
      jwtid: jti,
    }),
    jti,
  };
}

function verifyAccessToken(token) {
  return jwt.verify(String(token || ""), buildJwtConfig().accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(String(token || ""), buildJwtConfig().refreshSecret);
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
