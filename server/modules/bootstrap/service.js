const fs = require("fs");
const path = require("path");

const { quoteIdentifier, resolveDatabaseName } = require("../../../db");
const { applySchemaComments } = require("../../../db/schema-comments");
const { generateId } = require("../common/ids");
const { normalizeLoginEmail } = require("../common/normalizers");
const { SYSTEM_ROLE_CODES, ensureSystemRoles } = require("../common/system-roles");
const { createBootstrapAccountMembershipSchema } = require("./account-membership-schema");
const { createBootstrapDemoSeeder } = require("./demo-seed");
const { createBootstrapHolidaySchema } = require("./holiday-schema");
const { createBootstrapLeaveManagementSchema } = require("./leave-management-schema");
const { createBootstrapLegacyCleanup } = require("./legacy-cleanup");
const { createBootstrapObsoleteSchemaCleanup } = require("./obsolete-schema-cleanup");
const { createBootstrapSchemaHelpers } = require("./schema-helpers");
const { createBootstrapUserProfileSchema } = require("./user-profile-schema");

const DEFAULT_ACCOUNT_DEFINITIONS = Object.freeze([
  Object.freeze({
    employeeNo: "ADM-0001",
    loginEmail: "admin@uplusys.com",
    metadataRoleCode: SYSTEM_ROLE_CODES.MASTER_ADMIN,
    name: "마스터관리자",
    password: "control1@",
  }),
  Object.freeze({
    employeeNo: "USR-0001",
    loginEmail: "user@uplusys.com",
    metadataRoleCode: SYSTEM_ROLE_CODES.EMPLOYEE,
    name: "직원",
    password: "control1@",
  }),
]);

function createBootstrapService({ hashPassword }) {
  const schemaHelpers = createBootstrapSchemaHelpers();
  const {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    assertActiveDatabase,
    assertSchemaDoesNotSwitchDatabase,
    ensureColumnExists,
    hasTableIndex,
    makeUuidForeignKeyColumnNullable,
  } = schemaHelpers;
  const {
    deleteHolidayDatesByOrganization,
    ensureHolidayDatesOrganizationSchema,
  } = createBootstrapHolidaySchema(schemaHelpers);
  const {
    ensureAccountMembershipSchema,
    ensureManagedOrganizationMemberships,
    removeAccountProfileUsers,
  } = createBootstrapAccountMembershipSchema({
    hashPassword,
    schemaHelpers,
  });
  const {
    ensureLeaveManagementSchema,
  } = createBootstrapLeaveManagementSchema(schemaHelpers);
  const {
    cleanupLegacyPlatformInfrastructure,
    normalizeLegacyFixedIds,
  } = createBootstrapLegacyCleanup({
    deleteHolidayDatesByOrganization,
    schemaHelpers,
  });
  const {
    removeObsoleteSchema,
    simplifyUnimplementedSchema,
  } = createBootstrapObsoleteSchemaCleanup(schemaHelpers);
  const {
    ensureUserEmployeeProfileSchema,
  } = createBootstrapUserProfileSchema(schemaHelpers);

  const { seedDemoData } = createBootstrapDemoSeeder({
    assertActiveDatabase,
    hashPassword,
  });

  async function normalizeOrganizationScopedSortOrders(connection, tableName) {
    const normalizedTableName = String(tableName || "").trim();
    const supportedTables = new Set(["job_titles", "sites"]);

    if (!supportedTables.has(normalizedTableName)) {
      throw new Error(`Unsupported sort order normalization target: ${normalizedTableName}`);
    }

    const quotedTableName = quoteIdentifier(normalizedTableName);
    const [rows] = await connection.query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          sort_order AS sortOrder
        FROM ${quotedTableName}
        WHERE deleted_at IS NULL
        ORDER BY
          organization_id ASC,
          CASE WHEN sort_order > 0 THEN 0 ELSE 1 END ASC,
          sort_order ASC,
          created_at DESC,
          name ASC,
          id ASC
      `,
    );

    let currentOrganizationId = "";
    let nextSortOrder = 0;

    for (const row of rows) {
      const organizationId = String(row?.organizationId || "").trim();

      if (!organizationId) {
        continue;
      }

      if (organizationId !== currentOrganizationId) {
        currentOrganizationId = organizationId;
        nextSortOrder = 1;
      } else {
        nextSortOrder += 1;
      }

      if (Number(row?.sortOrder || 0) === nextSortOrder) {
        continue;
      }

      await connection.query(
        `
          UPDATE ${quotedTableName}
          SET
            sort_order = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [nextSortOrder, row.id],
      );
    }
  }

  async function applySchema(connection, { reset = false } = {}) {
    const databaseName = resolveDatabaseName();
    const quotedDatabaseName = quoteIdentifier(databaseName);

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${quotedDatabaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    if (reset) {
      await connection.query(`DROP DATABASE IF EXISTS ${quotedDatabaseName}`);
      await connection.query(`CREATE DATABASE ${quotedDatabaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }

    await connection.changeUser({ database: databaseName });
    const activeDatabaseName = await assertActiveDatabase(connection, databaseName);

    const [tableRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name = 'organizations'
      `,
      [activeDatabaseName],
    );
    const hasOrganizationsTable = Number(tableRows[0]?.count || 0) > 0;

    if (!hasOrganizationsTable || reset) {
      const schemaPath = path.join(__dirname, "..", "..", "..", "db", "schema.sql");
      const sql = fs.readFileSync(schemaPath, "utf8");
      assertSchemaDoesNotSwitchDatabase(sql);
      await assertActiveDatabase(connection, databaseName);
      await connection.query(sql);
    }

    await assertActiveDatabase(connection, databaseName);
    await ensureSupplementalSchema(connection);
    await applySchemaComments(connection);
    await seedDefaultAccounts(connection);
  }

  async function seedDefaultAccounts(connection) {
    await assertActiveDatabase(connection, resolveDatabaseName());

    for (const accountDefinition of DEFAULT_ACCOUNT_DEFINITIONS) {
      const loginEmail = normalizeLoginEmail(accountDefinition.loginEmail);

      if (!loginEmail) {
        continue;
      }

      const [accountRows] = await connection.query(
        `
          SELECT id, password_hash AS passwordHash, name, role_code AS roleCode
          FROM accounts
          WHERE login_email = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [loginEmail],
      );
      let accountId = String(accountRows[0]?.id || "").trim();
      let passwordHash = String(accountRows[0]?.passwordHash || "").trim();

      if (!accountId) {
        accountId = generateId();
        passwordHash = hashPassword(accountDefinition.password);

        await connection.query(
          `
            INSERT INTO accounts (id, login_email, password_hash, name, role_code)
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            accountId,
            loginEmail,
            passwordHash,
            accountDefinition.name,
            accountDefinition.metadataRoleCode,
          ],
        );
      } else {
        await connection.query(
          `
            UPDATE accounts
            SET
              name = COALESCE(name, ?),
              role_code = COALESCE(role_code, ?),
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?
          `,
          [
            accountDefinition.name,
            accountDefinition.metadataRoleCode,
            accountId,
          ],
        );
      }
    }
  }

  async function ensureSupplementalSchema(connection) {
    await assertActiveDatabase(connection, resolveDatabaseName());
    await ensureSystemRoles(connection.query.bind(connection));
    await normalizeLegacyFixedIds(connection);
    await ensureAccountMembershipSchema(connection);
    await connection.query(`
      ALTER TABLE sites
      MODIFY code VARCHAR(50) NULL
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_account_organizations (
        id CHAR(36) NOT NULL,
        admin_user_id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_admin_account_organizations_unique (admin_user_id, organization_id),
        KEY idx_admin_account_organizations_default (admin_user_id, is_default),
        CONSTRAINT fk_admin_account_organizations_user FOREIGN KEY (admin_user_id) REFERENCES users(id),
        CONSTRAINT fk_admin_account_organizations_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NULL,
        account_id CHAR(36) NULL,
        user_id CHAR(36) NULL,
        token_jti CHAR(36) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        replaced_by_jti CHAR(36) NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_auth_refresh_tokens_jti (token_jti),
        KEY idx_auth_refresh_tokens_account (account_id, expires_at),
        KEY idx_auth_refresh_tokens_user (user_id, expires_at),
        CONSTRAINT fk_auth_refresh_tokens_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_auth_refresh_tokens_account FOREIGN KEY (account_id) REFERENCES accounts(id),
        CONSTRAINT fk_auth_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, "auth_refresh_tokens", "account_id", "CHAR(36) NULL AFTER organization_id");
    await makeUuidForeignKeyColumnNullable(
      connection,
      "auth_refresh_tokens",
      "user_id",
      "fk_auth_refresh_tokens_user",
      "FOREIGN KEY (user_id) REFERENCES users(id)",
    );
    if (!(await hasTableIndex(connection, "auth_refresh_tokens", "idx_auth_refresh_tokens_account"))) {
      await connection.query(`
        ALTER TABLE auth_refresh_tokens
        ADD KEY idx_auth_refresh_tokens_account (account_id, expires_at)
      `);
    }
    await addForeignKeyIfMissing(connection, "auth_refresh_tokens", "fk_auth_refresh_tokens_account", "FOREIGN KEY (account_id) REFERENCES accounts(id)");
    await makeUuidForeignKeyColumnNullable(
      connection,
      "auth_refresh_tokens",
      "organization_id",
      "fk_auth_refresh_tokens_org",
      "FOREIGN KEY (organization_id) REFERENCES organizations(id)",
    );
    await cleanupLegacyPlatformInfrastructure(connection);
    await ensureManagedOrganizationMemberships(connection);
    await removeAccountProfileUsers(connection);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_join_invitations (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        created_by_user_id CHAR(36) NULL,
        invite_token_hash CHAR(64) NOT NULL,
        invite_channels_json JSON NULL,
        delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        delivery_mode VARCHAR(20) NULL,
        delivery_message_id VARCHAR(255) NULL,
        delivery_error VARCHAR(500) NULL,
        expires_at DATETIME(3) NOT NULL,
        sent_at DATETIME(3) NULL,
        failed_at DATETIME(3) NULL,
        consumed_at DATETIME(3) NULL,
        revoked_at DATETIME(3) NULL,
        replaced_by_invitation_id CHAR(36) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_join_invitations_token_hash (invite_token_hash),
        KEY idx_user_join_invitations_user (user_id, expires_at),
        KEY idx_user_join_invitations_org_user (organization_id, user_id, created_at),
        CONSTRAINT fk_user_join_invitations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_user_join_invitations_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_user_join_invitations_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        KEY idx_job_titles_org_status (organization_id, status),
        KEY idx_job_titles_org_name (organization_id, name),
        CONSTRAINT fk_job_titles_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS job_title_units (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        job_title_id CHAR(36) NOT NULL,
        unit_id CHAR(36) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_job_title_units_unique (job_title_id, unit_id),
        KEY idx_job_title_units_org (organization_id, unit_id),
        CONSTRAINT fk_job_title_units_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_job_title_units_job_title FOREIGN KEY (job_title_id) REFERENCES job_titles(id),
        CONSTRAINT fk_job_title_units_unit FOREIGN KEY (unit_id) REFERENCES units(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensureUserEmployeeProfileSchema(connection);
    await ensureHolidayDatesOrganizationSchema(connection);
    await ensureLeaveManagementSchema(connection);
    await ensureColumnExists(connection, "job_titles", "sort_order", "INT NOT NULL DEFAULT 0 AFTER status");
    await ensureColumnExists(connection, "sites", "sort_order", "INT NOT NULL DEFAULT 0 AFTER status");
    await simplifyUnimplementedSchema(connection);
    await removeObsoleteSchema(connection);
    await normalizeOrganizationScopedSortOrders(connection, "job_titles");
    await normalizeOrganizationScopedSortOrders(connection, "sites");
  }

  return {
    applySchema,
    ensureSupplementalSchema,
    seedDefaultAccounts,
    seedDemoData,
  };
}

module.exports = {
  createBootstrapService,
};
