const mysql = require("mysql2/promise");

const { getDbConfig, quoteIdentifier, resolveDatabaseName } = require("../db");

const OBSOLETE_TABLES = Object.freeze([
  "attendance_event_evidence",
  "approval_steps",
  "export_jobs",
  "notifications",
  "overtime_requests",
  "schedule_change_requests",
  "site_allowed_beacons",
  "user_devices",
  "user_site_assignments",
]);

const FOREIGN_KEYS_TO_DROP = Object.freeze([
  {
    foreignKeyName: "fk_attendance_events_device",
    tableName: "attendance_events",
  },
]);

function parseArgs(argv = process.argv.slice(2)) {
  return {
    force: argv.includes("--force"),
  };
}

async function tableExists(connection, tableName) {
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

async function getTableRowCount(connection, tableName) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`);
  return Number(rows[0]?.count || 0);
}

async function foreignKeyExists(connection, tableName, foreignKeyName) {
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

async function dropForeignKeyIfExists(connection, tableName, foreignKeyName) {
  if (!(await foreignKeyExists(connection, tableName, foreignKeyName))) {
    return false;
  }

  await connection.query(
    `ALTER TABLE ${quoteIdentifier(tableName)} DROP FOREIGN KEY ${quoteIdentifier(foreignKeyName)}`,
  );
  return true;
}

async function main() {
  const { force } = parseArgs();
  const databaseName = resolveDatabaseName();
  const connection = await mysql.createConnection(getDbConfig(true));
  let inTransaction = false;

  try {
    const existingTables = [];
    const nonEmptyTables = [];

    for (const tableName of OBSOLETE_TABLES) {
      if (!(await tableExists(connection, tableName))) {
        continue;
      }

      existingTables.push(tableName);
      const rowCount = await getTableRowCount(connection, tableName);

      if (rowCount > 0) {
        nonEmptyTables.push({ rowCount, tableName });
      }
    }

    if (nonEmptyTables.length > 0 && !force) {
      throw new Error(
        `Refusing to drop non-empty tables in '${databaseName}': ${nonEmptyTables.map((item) => `${item.tableName}(${item.rowCount})`).join(", ")}. Re-run with --force if you want to drop them anyway.`,
      );
    }

    await connection.beginTransaction();
    inTransaction = true;

    const droppedForeignKeys = [];
    for (const dependency of FOREIGN_KEYS_TO_DROP) {
      if (await dropForeignKeyIfExists(connection, dependency.tableName, dependency.foreignKeyName)) {
        droppedForeignKeys.push(`${dependency.tableName}.${dependency.foreignKeyName}`);
      }
    }

    const droppedTables = [];
    for (const tableName of existingTables) {
      await connection.query(`DROP TABLE ${quoteIdentifier(tableName)}`);
      droppedTables.push(tableName);
    }

    await connection.commit();
    inTransaction = false;
    console.log(JSON.stringify({
      databaseName,
      droppedForeignKeys,
      droppedTables,
      forced: force,
    }, null, 2));
  } catch (error) {
    if (inTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to prune unused tables.");
  console.error(error.message || error);
  process.exitCode = 1;
});
