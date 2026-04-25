const { randomBytes, scryptSync, timingSafeEqual } = require("crypto");

const PASSWORD_PREFIX = "scrypt";

function hashPassword(value) {
  const normalized = String(value || "");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 64).toString("hex");
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

function verifyPassword(value, hashedValue) {
  const normalizedHash = String(hashedValue || "");
  const [prefix, salt, storedHash] = normalizedHash.split("$");

  if (prefix !== PASSWORD_PREFIX || !salt || !storedHash) {
    return false;
  }

  const candidateHash = scryptSync(String(value || ""), salt, 64);
  const originalHash = Buffer.from(storedHash, "hex");

  if (candidateHash.length !== originalHash.length) {
    return false;
  }

  return timingSafeEqual(candidateHash, originalHash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
