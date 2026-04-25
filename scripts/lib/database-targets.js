const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const DEFAULT_DB_NAME = "WorkMate";
const DB_NAME_PATTERN = /^[A-Za-z0-9_]+$/;
const EPHEMERAL_DB_SUFFIXES = Object.freeze(["_test", "_ui", "_smoke", "_ci"]);

function normalizeDatabaseName(databaseName) {
  return String(databaseName || "").trim();
}

function assertSupportedDatabaseName(databaseName) {
  const normalizedDatabaseName = normalizeDatabaseName(databaseName);

  if (!normalizedDatabaseName) {
    throw new Error("DB_NAME must not be empty.");
  }

  if (!DB_NAME_PATTERN.test(normalizedDatabaseName)) {
    throw new Error(`Unsupported database name: ${normalizedDatabaseName}`);
  }

  return normalizedDatabaseName;
}

function loadProjectEnv(rootDir) {
  dotenv.config({
    path: path.join(rootDir, ".env"),
    quiet: true,
  });
}

function readProjectEnvDbName(rootDir) {
  const envPath = path.join(rootDir, ".env");

  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    return assertSupportedDatabaseName(parsed.DB_NAME || DEFAULT_DB_NAME);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return DEFAULT_DB_NAME;
    }

    throw error;
  }
}

function buildEphemeralDatabaseName(primaryDatabaseName, suffix) {
  const normalizedPrimaryDatabaseName = assertSupportedDatabaseName(primaryDatabaseName);
  const normalizedSuffix = String(suffix || "")
    .trim()
    .replace(/^_+/, "")
    .replace(/[^A-Za-z0-9_]/g, "_");

  if (!normalizedSuffix) {
    throw new Error("Ephemeral database suffix must not be empty.");
  }

  return assertSupportedDatabaseName(`${normalizedPrimaryDatabaseName}_${normalizedSuffix}`);
}

function applyEphemeralDatabaseName(rootDir, suffix) {
  const primaryDatabaseName = readProjectEnvDbName(rootDir);
  const databaseName = buildEphemeralDatabaseName(primaryDatabaseName, suffix);

  process.env.DB_NAME = databaseName;

  return {
    databaseName,
    primaryDatabaseName,
  };
}

function isPrimaryDatabaseName(rootDir, databaseName) {
  return normalizeDatabaseName(readProjectEnvDbName(rootDir)).toLowerCase()
    === normalizeDatabaseName(databaseName).toLowerCase();
}

function isEphemeralDatabaseName(databaseName) {
  const normalizedDatabaseName = normalizeDatabaseName(databaseName).toLowerCase();
  return EPHEMERAL_DB_SUFFIXES.some((suffix) => normalizedDatabaseName.endsWith(suffix));
}

module.exports = {
  EPHEMERAL_DB_SUFFIXES,
  applyEphemeralDatabaseName,
  assertSupportedDatabaseName,
  buildEphemeralDatabaseName,
  isEphemeralDatabaseName,
  isPrimaryDatabaseName,
  loadProjectEnv,
  readProjectEnvDbName,
};
