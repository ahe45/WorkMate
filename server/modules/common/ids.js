const { createHash, randomUUID } = require("crypto");

function generateId() {
  return randomUUID();
}

function sha256(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

module.exports = {
  generateId,
  sha256,
};
