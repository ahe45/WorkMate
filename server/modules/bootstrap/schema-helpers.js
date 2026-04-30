const { quoteIdentifier } = require("../../../db");

function normalizeDatabaseName(databaseName) {
  return String(databaseName || "").trim().toLowerCase();
}

function createBootstrapSchemaHelpers() {
  async function getActiveDatabase(connection) {
    const [rows] = await connection.query("SELECT DATABASE() AS activeDatabase");
    return rows[0]?.activeDatabase || null;
  }

  async function assertActiveDatabase(connection, expectedDatabaseName) {
    const activeDatabase = await getActiveDatabase(connection);

    if (normalizeDatabaseName(activeDatabase) !== normalizeDatabaseName(expectedDatabaseName)) {
      throw new Error(`Active database mismatch. Expected ${expectedDatabaseName}, received ${activeDatabase || "(none)"}.`);
    }

    return activeDatabase;
  }

  function assertSchemaDoesNotSwitchDatabase(sql) {
    const forbiddenPattern = /\b(?:CREATE|DROP|ALTER)\s+DATABASE\b|\bUSE\s+[`"'A-Za-z0-9_]/i;

    if (forbiddenPattern.test(sql)) {
      throw new Error("db/schema.sql must not create, drop, alter, or switch databases.");
    }
  }

  async function ensureColumnExists(connection, tableName, columnName, definition) {
    const normalizedTableName = String(tableName || "").trim();
    const normalizedColumnName = String(columnName || "").trim();
    const supportedTables = new Set(["holiday_dates", "job_titles", "sites"]);

    if (!supportedTables.has(normalizedTableName) || !normalizedColumnName) {
      throw new Error(`Unsupported supplemental column target: ${normalizedTableName}.${normalizedColumnName}`);
    }

    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [normalizedTableName, normalizedColumnName],
    );

    if (Number(rows[0]?.count || 0) > 0) {
      return;
    }

    await connection.query(`
      ALTER TABLE ${quoteIdentifier(normalizedTableName)}
      ADD COLUMN ${quoteIdentifier(normalizedColumnName)} ${definition}
    `);
  }

  async function dropForeignKeyIfExists(connection, tableName, foreignKeyName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.table_constraints
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = ?
          AND constraint_type = 'FOREIGN KEY'
      `,
      [tableName, foreignKeyName],
    );

    if (Number(rows[0]?.count || 0) === 0) {
      return;
    }

    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} DROP FOREIGN KEY ${quoteIdentifier(foreignKeyName)}`,
    );
  }

  async function hasTable(connection, tableName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
      `,
      [tableName],
    );

    return Number(rows[0]?.count || 0) > 0;
  }

  async function hasColumn(connection, tableName, columnName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [tableName, columnName],
    );

    return Number(rows[0]?.count || 0) > 0;
  }

  async function dropForeignKeysForColumn(connection, tableName, columnName) {
    if (!(await hasTable(connection, tableName)) || !(await hasColumn(connection, tableName, columnName))) {
      return;
    }

    const [rows] = await connection.query(
      `
        SELECT DISTINCT constraint_name AS constraintName
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
          AND referenced_table_name IS NOT NULL
      `,
      [tableName, columnName],
    );

    for (const row of rows) {
      const constraintName = String(row.constraintName || "").trim();

      if (constraintName) {
        await dropForeignKeyIfExists(connection, tableName, constraintName);
      }
    }
  }

  async function dropIndexIfExists(connection, tableName, indexName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND index_name = ?
      `,
      [tableName, indexName],
    );

    if (Number(rows[0]?.count || 0) === 0) {
      return;
    }

    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} DROP INDEX ${quoteIdentifier(indexName)}`,
    );
  }

  async function dropColumnIfExists(connection, tableName, columnName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [tableName, columnName],
    );

    if (Number(rows[0]?.count || 0) === 0) {
      return;
    }

    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} DROP COLUMN ${quoteIdentifier(columnName)}`,
    );
  }

  async function dropTableIfExists(connection, tableName) {
    await connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`);
  }

  async function addColumnIfMissing(connection, tableName, columnName, definition) {
    if (await hasColumn(connection, tableName, columnName)) {
      return;
    }

    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(columnName)} ${definition}`,
    );
  }

  async function hasTableIndex(connection, tableName, indexName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND index_name = ?
      `,
      [tableName, indexName],
    );

    return Number(rows[0]?.count || 0) > 0;
  }

  async function hasForeignKey(connection, tableName, foreignKeyName) {
    const [rows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.table_constraints
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND constraint_name = ?
          AND constraint_type = 'FOREIGN KEY'
      `,
      [tableName, foreignKeyName],
    );

    return Number(rows[0]?.count || 0) > 0;
  }

  async function addForeignKeyIfMissing(connection, tableName, foreignKeyName, definition) {
    if (await hasForeignKey(connection, tableName, foreignKeyName)) {
      return;
    }

    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} ADD CONSTRAINT ${quoteIdentifier(foreignKeyName)} ${definition}`,
    );
  }

  async function makeUuidForeignKeyColumnNullable(connection, tableName, columnName, foreignKeyName, definition) {
    if (!(await hasTable(connection, tableName))) {
      return;
    }

    await dropForeignKeyIfExists(connection, tableName, foreignKeyName);
    await connection.query(
      `ALTER TABLE ${quoteIdentifier(tableName)} MODIFY ${quoteIdentifier(columnName)} CHAR(36) NULL`,
    );
    await addForeignKeyIfMissing(connection, tableName, foreignKeyName, definition);
  }

  async function queryIfTableExists(connection, tableName, sql, params = []) {
    if (!(await hasTable(connection, tableName))) {
      return;
    }

    await connection.query(sql, params);
  }

  return {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    assertActiveDatabase,
    assertSchemaDoesNotSwitchDatabase,
    dropColumnIfExists,
    dropForeignKeyIfExists,
    dropForeignKeysForColumn,
    dropIndexIfExists,
    dropTableIfExists,
    ensureColumnExists,
    hasColumn,
    hasTable,
    hasTableIndex,
    makeUuidForeignKeyColumnNullable,
    queryIfTableExists,
  };
}

module.exports = {
  createBootstrapSchemaHelpers,
};
