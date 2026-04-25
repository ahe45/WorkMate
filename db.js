const mysql = require("mysql2/promise");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const DEFAULT_DB_NAME = "WorkMate";
const DB_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

let pool;

function resolveDatabaseName() {
  const databaseName = String(process.env.DB_NAME || DEFAULT_DB_NAME).trim();

  if (!databaseName) {
    throw new Error("DB_NAME must not be empty.");
  }

  if (!DB_NAME_PATTERN.test(databaseName)) {
    throw new Error("DB_NAME can only contain letters, numbers, and underscores.");
  }

  return databaseName;
}

function quoteIdentifier(identifier) {
  if (!DB_NAME_PATTERN.test(identifier)) {
    throw new Error(`Unsupported identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function getDbConfig(includeDatabase = true) {
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    namedPlaceholders: true,
    multipleStatements: true,
  };

  if (includeDatabase) {
    config.database = resolveDatabaseName();
  }

  return config;
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig(true));
  }

  return pool;
}

async function query(sql, params = {}) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function withTransaction(executor) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await executor(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  DEFAULT_DB_NAME,
  getDbConfig,
  getPool,
  quoteIdentifier,
  query,
  resolveDatabaseName,
  withTransaction,
};
