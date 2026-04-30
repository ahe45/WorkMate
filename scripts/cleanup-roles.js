const mysql = require("mysql2/promise");
const path = require("path");

const { getDbConfig, resolveDatabaseName } = require("../db");
const { ensureSystemRoles, SYSTEM_ROLE_DEFINITIONS } = require("../server/modules/common/system-roles");
const { loadProjectEnv } = require("./lib/database-targets");

const root = path.join(__dirname, "..");
loadProjectEnv(root);

async function main() {
  const databaseName = resolveDatabaseName();
  const connection = await mysql.createConnection(getDbConfig(true));

  try {
    await connection.beginTransaction();
    const result = await ensureSystemRoles(connection.query.bind(connection));
    await connection.commit();

    const [roles] = await connection.query(
      `
        SELECT code, name, organization_id AS organizationId
        FROM roles
        ORDER BY code ASC, organization_id ASC
      `,
    );

    console.log(`Database '${databaseName}' roles cleaned.`);
    console.log(`Allowed roles: ${SYSTEM_ROLE_DEFINITIONS.map((role) => role.code).join(", ")}`);
    console.log(`Deleted roles: ${result.deletedRoles}`);
    console.log(`Deleted role bindings: ${result.deletedRoleBindings}`);
    console.log(`Reassigned duplicate role bindings: ${result.reassignedRoleBindings}`);
    console.log(`Remaining roles: ${roles.map((role) => `${role.code}${role.organizationId ? `@${role.organizationId}` : ""}`).join(", ")}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to clean roles.");
  console.error(error.message || error);
  process.exitCode = 1;
});
