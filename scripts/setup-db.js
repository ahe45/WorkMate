const mysql = require("mysql2/promise");
const path = require("path");

const { getDbConfig, resolveDatabaseName } = require("../db");
const { createBootstrapService } = require("../server/modules/bootstrap/service");
const { hashPassword } = require("../server/modules/auth/passwords");
const {
  isEphemeralDatabaseName,
  isPrimaryDatabaseName,
  loadProjectEnv,
} = require("./lib/database-targets");

const root = path.join(__dirname, "..");
loadProjectEnv(root);

async function main() {
  const reset = process.argv.includes("--reset");
  const databaseName = resolveDatabaseName();

  if (reset && !isEphemeralDatabaseName(databaseName) && process.env.ALLOW_DB_RESET !== "true") {
    if (isPrimaryDatabaseName(root, databaseName)) {
      throw new Error(
        `Refusing to reset primary database '${databaseName}'. Use an isolated *_test/*_ui database or set ALLOW_DB_RESET=true if you intend to drop it.`,
      );
    }

    throw new Error(
      `Refusing to reset non-ephemeral database '${databaseName}'. Rename it to an isolated suffix such as *_test/*_ui or set ALLOW_DB_RESET=true.`,
    );
  }

  const connection = await mysql.createConnection(getDbConfig(false));
  const bootstrapService = createBootstrapService({ hashPassword });

  try {
    await bootstrapService.applySchema(connection, { reset });
    if (isEphemeralDatabaseName(databaseName) || process.env.SEED_DEMO_DATA === "true") {
      await bootstrapService.seedDemoData(connection);
    }
    console.log(`Database '${databaseName}' is ready.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to set up database.");

  if (error.code === "AUTH_SWITCH_PLUGIN_ERROR" || String(error.message || "").includes("auth_gssapi_client")) {
    console.error(
      "현재 MariaDB 계정은 auth_gssapi_client 인증을 사용 중입니다. mysql_native_password 기반의 앱 전용 계정을 만들어 .env에 넣어주세요.",
    );
  } else {
    console.error(error.message || error);
  }

  process.exitCode = 1;
});
