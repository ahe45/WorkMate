const fs = require("fs");
const path = require("path");

const { quoteIdentifier, resolveDatabaseName } = require("../../../db");
const { applySchemaComments } = require("../../../db/schema-comments");
const { generateId } = require("../common/ids");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../common/system-roles");
const { ensurePlatformInfrastructure } = require("../platform/infrastructure");

const LEGACY_FIXED_IDS = Object.freeze({
  platform: Object.freeze({
    organizationId: "22222222-2222-2222-2222-222222222201",
    unitId: "22222222-2222-2222-2222-222222222202",
    workPolicyId: "22222222-2222-2222-2222-222222222203",
  }),
  roles: Object.freeze([
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
    "00000000-0000-0000-0000-000000000004",
    "00000000-0000-0000-0000-000000000005",
    "00000000-0000-0000-0000-000000000006",
    "00000000-0000-0000-0000-000000000007",
  ]),
});

function createDemoIds() {
  return Object.freeze({
    orgId: generateId(),
    hqUnitId: generateId(),
    opsUnitId: generateId(),
    policyId: generateId(),
    siteId: generateId(),
    adminUserId: generateId(),
    employeeUserId: generateId(),
    adminRoleBindingId: generateId(),
    employeeRoleBindingId: generateId(),
    templateId: generateId(),
    assignmentId: generateId(),
  });
}

function createBootstrapService({ hashPassword }) {
  function normalizeDatabaseName(databaseName) {
    return String(databaseName || "").trim().toLowerCase();
  }

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

  async function listReferencingColumns(connection, tableName) {
    const [rows] = await connection.query(
      `
        SELECT
          table_name AS tableName,
          column_name AS columnName
        FROM information_schema.key_column_usage
        WHERE referenced_table_schema = DATABASE()
          AND referenced_table_name = ?
          AND referenced_column_name = 'id'
      `,
      [tableName],
    );

    return rows;
  }

  async function replacePrimaryKeyValue(connection, tableName, oldId) {
    const normalizedId = String(oldId || "").trim();

    if (!normalizedId) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT id
        FROM ${quoteIdentifier(tableName)}
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedId],
    );

    if (!rows[0]?.id) {
      return null;
    }

    const nextId = generateId();
    const referencingColumns = await listReferencingColumns(connection, tableName);

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    try {
      await connection.query(
        `
          UPDATE ${quoteIdentifier(tableName)}
          SET id = ?
          WHERE id = ?
        `,
        [nextId, normalizedId],
      );

      for (const reference of referencingColumns) {
        await connection.query(
          `
            UPDATE ${quoteIdentifier(reference.tableName)}
            SET ${quoteIdentifier(reference.columnName)} = ?
            WHERE ${quoteIdentifier(reference.columnName)} = ?
          `,
          [nextId, normalizedId],
        );
      }
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    return nextId;
  }

  async function ensureHolidayDateSourceUniqueKey(connection) {
    const tableName = "holiday_dates";
    const nextIndexName = "uk_holiday_dates_calendar_date_source";
    const legacyIndexName = "uk_holiday_dates_calendar_date";

    if (!(await hasTableIndex(connection, tableName, nextIndexName))) {
      await connection.query(`
        ALTER TABLE ${quoteIdentifier(tableName)}
        ADD UNIQUE KEY ${quoteIdentifier(nextIndexName)} (holiday_calendar_id, holiday_date, holiday_source)
      `);
    }

    if (await hasTableIndex(connection, tableName, legacyIndexName)) {
      await connection.query(`
        ALTER TABLE ${quoteIdentifier(tableName)}
        DROP INDEX ${quoteIdentifier(legacyIndexName)}
      `);
    }
  }

  async function simplifyUnimplementedSchema(connection) {
    if (await hasTable(connection, "leave_requests")) {
      await addColumnIfMissing(
        connection,
        "leave_requests",
        "approval_status",
        "VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER request_reason",
      );
      await addColumnIfMissing(
        connection,
        "leave_requests",
        "cancelled_at",
        "DATETIME(3) NULL AFTER approval_status",
      );

      if (await hasTable(connection, "approval_requests") && await hasColumn(connection, "leave_requests", "approval_request_id")) {
        await connection.query(`
          UPDATE leave_requests lr
          INNER JOIN approval_requests ar ON ar.id = lr.approval_request_id
          SET
            lr.approval_status = ar.status,
            lr.cancelled_at = ar.cancelled_at
        `);
      }

      await dropForeignKeyIfExists(connection, "leave_requests", "fk_leave_requests_approval");
      await dropIndexIfExists(connection, "leave_requests", "uk_leave_requests_approval");
      await dropColumnIfExists(connection, "leave_requests", "approval_request_id");
    }

    await dropTableIfExists(connection, "approval_requests");
    await dropTableIfExists(connection, "files");
    await dropTableIfExists(connection, "site_allowed_wifi_networks");
    await dropTableIfExists(connection, "site_auth_policies");

    const obsoleteColumns = [
      ["schedule_assignments", "priority_order"],
      ["schedule_assignments", "created_by"],
      ["shift_instances", "source_type"],
      ["shift_instances", "shift_metadata_json"],
      ["work_policies", "weekly_warning_threshold_minutes"],
      ["work_policies", "weekly_hard_lock_threshold_minutes"],
      ["work_policies", "clock_in_early_window_minutes"],
      ["work_policies", "clock_in_late_window_minutes"],
      ["work_policies", "auto_break_enabled"],
      ["work_policies", "auto_break_rules_json"],
      ["work_policies", "next_day_cutoff_time"],
      ["work_policies", "night_work_start"],
      ["work_policies", "night_work_end"],
      ["work_policies", "require_pre_approval_for_overtime"],
      ["work_policies", "allow_post_approval_overtime"],
      ["work_policies", "allow_clock_out_from_offsite"],
      ["work_policies", "allow_wfh"],
    ];

    await dropForeignKeyIfExists(connection, "schedule_assignments", "fk_schedule_assignments_created_by");

    for (const [tableName, columnName] of obsoleteColumns) {
      await dropColumnIfExists(connection, tableName, columnName);
    }
  }

  async function removeObsoleteSchema(connection) {
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_final_decision_by");
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_requester");
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_target");
    await dropForeignKeyIfExists(connection, "attendance_events", "fk_attendance_events_device");
    await dropForeignKeyIfExists(connection, "attendance_anomalies", "fk_attendance_anomalies_resolved_by");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_requester");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_target");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_org_type_status");

    const obsoleteColumns = [
      ["approval_requests", "source_entity_type"],
      ["approval_requests", "source_entity_id"],
      ["approval_requests", "title"],
      ["approval_requests", "reason"],
      ["approval_requests", "current_step_order"],
      ["approval_requests", "final_decision_at"],
      ["approval_requests", "final_decision_by"],
      ["approval_requests", "request_type"],
      ["approval_requests", "requester_id"],
      ["approval_requests", "requested_from"],
      ["approval_requests", "requested_to"],
      ["approval_requests", "request_payload_json"],
      ["approval_requests", "target_user_id"],
      ["attendance_events", "occurred_at_local"],
      ["attendance_events", "device_id"],
      ["attendance_events", "beacon_snapshot_json"],
      ["attendance_anomalies", "resolved_at"],
      ["attendance_anomalies", "resolved_by_user_id"],
      ["attendance_sessions", "night_minutes"],
      ["attendance_sessions", "holiday_minutes"],
      ["attendance_sessions", "summary_status"],
      ["attendance_sessions", "last_recalculated_at"],
      ["leave_balances", "source_type"],
      ["leave_types", "deduct_balance_flag"],
      ["leave_types", "paid_flag"],
      ["leave_types", "requires_approval"],
      ["roles", "is_system_role"],
      ["roles", "permissions_json"],
      ["schedule_template_days", "core_time_start"],
      ["schedule_template_days", "core_time_end"],
      ["schedule_template_days", "day_rule_json"],
      ["schedule_templates", "template_json"],
      ["site_allowed_wifi_networks", "ssid"],
      ["user_unit_assignments", "assignment_type"],
      ["user_unit_assignments", "is_primary"],
      ["users", "locale"],
      ["users", "last_login_at"],
      ["users", "profile_image_file_id"],
      ["users", "retire_date"],
    ];

    for (const [tableName, columnName] of obsoleteColumns) {
      await dropColumnIfExists(connection, tableName, columnName);
    }

    await dropTableIfExists(connection, "user_unit_assignments");
  }

  async function normalizeLegacyFixedIds(connection) {
    for (const legacyRoleId of LEGACY_FIXED_IDS.roles) {
      await replacePrimaryKeyValue(connection, "roles", legacyRoleId);
    }

    await replacePrimaryKeyValue(connection, "organizations", LEGACY_FIXED_IDS.platform.organizationId);
    await replacePrimaryKeyValue(connection, "units", LEGACY_FIXED_IDS.platform.unitId);
    await replacePrimaryKeyValue(connection, "work_policies", LEGACY_FIXED_IDS.platform.workPolicyId);
  }

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
  }

  async function ensureSupplementalSchema(connection) {
    await assertActiveDatabase(connection, resolveDatabaseName());
    await ensureSystemRoles(connection.query.bind(connection));
    await normalizeLegacyFixedIds(connection);
    await ensurePlatformInfrastructure(connection);
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
        organization_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
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
        KEY idx_auth_refresh_tokens_user (user_id, expires_at),
        CONSTRAINT fk_auth_refresh_tokens_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_auth_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS holiday_calendars (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_holiday_calendars_org_code (organization_id, code),
        CONSTRAINT fk_holiday_calendars_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS holiday_dates (
        id CHAR(36) NOT NULL,
        holiday_calendar_id CHAR(36) NOT NULL,
        holiday_date DATE NOT NULL,
        name VARCHAR(150) NOT NULL,
        is_paid_holiday TINYINT(1) NOT NULL DEFAULT 1,
        holiday_source VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
        repeat_unit VARCHAR(20) NOT NULL DEFAULT 'NONE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_holiday_dates_calendar_date_source (holiday_calendar_id, holiday_date, holiday_source),
        CONSTRAINT fk_holiday_dates_calendar FOREIGN KEY (holiday_calendar_id) REFERENCES holiday_calendars(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await ensureColumnExists(connection, "holiday_dates", "holiday_source", "VARCHAR(20) NOT NULL DEFAULT 'SYSTEM' AFTER is_paid_holiday");
    await ensureColumnExists(connection, "holiday_dates", "repeat_unit", "VARCHAR(20) NOT NULL DEFAULT 'NONE' AFTER holiday_source");
    await ensureHolidayDateSourceUniqueKey(connection);
    await ensureColumnExists(connection, "job_titles", "sort_order", "INT NOT NULL DEFAULT 0 AFTER status");
    await ensureColumnExists(connection, "sites", "sort_order", "INT NOT NULL DEFAULT 0 AFTER status");
    await simplifyUnimplementedSchema(connection);
    await removeObsoleteSchema(connection);
    await normalizeOrganizationScopedSortOrders(connection, "job_titles");
    await normalizeOrganizationScopedSortOrders(connection, "sites");
  }

  function buildTodayShiftWindow() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    return {
      date,
      startAt: `${date} 09:00:00.000`,
      endAt: `${date} 18:00:00.000`,
    };
  }

  async function seedDemoData(connection) {
    await assertActiveDatabase(connection, resolveDatabaseName());
    const [orgRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM organizations
        WHERE code <> 'WORKMATE_PLATFORM'
      `,
    );
    const orgCount = Number(orgRows[0]?.count || 0);

    if (orgCount > 0) {
      return null;
    }

    const DEMO_IDS = createDemoIds();
    const queryRunner = connection.query.bind(connection);
    const demoPasswordHash = hashPassword("Passw0rd!");
    await ensureSystemRoles(queryRunner);
    const orgAdminRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.ORG_ADMIN);
    const employeeRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.EMPLOYEE);
    const shiftWindow = buildTodayShiftWindow();

    await connection.query(
      `
        INSERT INTO organizations (id, code, name, status, timezone, metadata_json)
        VALUES (?, ?, ?, 'ACTIVE', 'Asia/Seoul', JSON_OBJECT('seed', true))
      `,
      [DEMO_IDS.orgId, "WORKMATE", "WorkMate Holdings"],
    );

    await connection.query(
      `
        INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
        VALUES
          (?, ?, NULL, 'HQ', '본사', 'HEADQUARTERS', 'ACTIVE', 1, '/HQ'),
          (?, ?, ?, 'OPS', '운영팀', 'TEAM', 'ACTIVE', 2, '/HQ/OPS')
      `,
      [DEMO_IDS.hqUnitId, DEMO_IDS.orgId, DEMO_IDS.opsUnitId, DEMO_IDS.orgId, DEMO_IDS.hqUnitId],
    );

    await connection.query(
      `
        INSERT INTO work_policies (
          id, organization_id, code, name, track_type, timezone, standard_daily_minutes, standard_weekly_minutes,
          daily_max_minutes, late_grace_minutes, early_leave_grace_minutes, policy_json, is_default
        )
        VALUES (
          ?, ?, 'STD-9TO6', '기본 09:00~18:00', 'FIXED', 'Asia/Seoul', 480, 2400,
          720, 10, 10, JSON_OBJECT('seed', true), 1
        )
      `,
      [DEMO_IDS.policyId, DEMO_IDS.orgId],
    );

    await connection.query(
      `
        INSERT INTO sites (
          id, organization_id, primary_unit_id, code, name, status, sort_order, timezone, country_code, address_line1,
          postal_code, lat, lng, geofence_radius_meters, map_metadata_json
        )
        VALUES (?, ?, ?, 'SEOUL-HQ', '서울 본사', 'ACTIVE', 1, 'Asia/Seoul', 'KR', '서울시 강남구 테헤란로 100', '06100', 37.4981, 127.0276, 200, JSON_OBJECT('seed', true))
      `,
      [DEMO_IDS.siteId, DEMO_IDS.orgId, DEMO_IDS.hqUnitId],
    );

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES
            (?, ?, 'A0001', 'admin@workmate.local', ?, '시스템 관리자', '010-0000-0001', 'ACTIVE', 'FULL_TIME', CURDATE(), 'Asia/Seoul', ?, ?, 'FIXED', ?, NULL, JSON_OBJECT('seed', true, 'kind', 'admin')),
            (?, ?, 'E0001', 'employee@workmate.local', ?, '홍길동', '010-0000-0002', 'ACTIVE', 'FULL_TIME', CURDATE(), 'Asia/Seoul', ?, ?, 'FIXED', ?, ?, JSON_OBJECT('seed', true, 'kind', 'employee'))
        `,
      [
        DEMO_IDS.adminUserId,
        DEMO_IDS.orgId,
        demoPasswordHash,
        DEMO_IDS.hqUnitId,
        DEMO_IDS.siteId,
        DEMO_IDS.policyId,
        DEMO_IDS.employeeUserId,
        DEMO_IDS.orgId,
        demoPasswordHash,
        DEMO_IDS.opsUnitId,
        DEMO_IDS.siteId,
        DEMO_IDS.policyId,
        DEMO_IDS.adminUserId,
      ],
    );

    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES
          (?, ?, ?, ?, 'organization', ?),
          (?, ?, ?, ?, 'self', NULL)
      `,
        [
          DEMO_IDS.adminRoleBindingId,
          DEMO_IDS.orgId,
          DEMO_IDS.adminUserId,
          orgAdminRoleId,
          DEMO_IDS.orgId,
          DEMO_IDS.employeeRoleBindingId,
          DEMO_IDS.orgId,
          DEMO_IDS.employeeUserId,
          employeeRoleId,
        ],
      );

      await connection.query(
        `
          INSERT INTO schedule_templates (
            id, organization_id, work_policy_id, code, name, track_type, effective_from, effective_to,
            cross_midnight, next_day_cutoff_time, default_site_id, status
          )
          VALUES (?, ?, ?, 'WEEKDAY-0900', '주간 기본 템플릿', 'FIXED', CURDATE(), NULL, 0, '04:00:00', ?, 'ACTIVE')
        `,
        [DEMO_IDS.templateId, DEMO_IDS.orgId, DEMO_IDS.policyId, DEMO_IDS.siteId],
      );

    const dayValues = [];
    const dayParams = [];

    for (let day = 1; day <= 5; day += 1) {
      dayValues.push("(?, ?, ?, 1, '09:00:00', '18:00:00', 60, 10, 10)");
      dayParams.push(generateId(), DEMO_IDS.templateId, day);
    }

    for (let day = 6; day <= 7; day += 1) {
      dayValues.push("(?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL)");
      dayParams.push(generateId(), DEMO_IDS.templateId, day);
    }

    await connection.query(
      `
        INSERT INTO schedule_template_days (
          id, schedule_template_id, day_of_week, is_working_day, start_time, end_time, break_minutes,
          late_grace_minutes, early_leave_grace_minutes
        )
        VALUES ${dayValues.join(", ")}
      `,
      dayParams,
    );

    await connection.query(
      `
        INSERT INTO schedule_assignments (
          id, organization_id, schedule_template_id, apply_type, target_id, effective_from, effective_to, status
        )
        VALUES (?, ?, ?, 'USER', ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'ACTIVE')
      `,
      [DEMO_IDS.assignmentId, DEMO_IDS.orgId, DEMO_IDS.templateId, DEMO_IDS.employeeUserId],
    );

    await connection.query(
      `
        INSERT INTO shift_instances (
          id, organization_id, user_id, schedule_assignment_id, schedule_template_id, work_policy_id, site_id,
          shift_date, planned_start_at, planned_end_at, planned_break_minutes, cross_midnight, next_day_cutoff_time, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, 0, '04:00:00', 'CONFIRMED')
      `,
      [
        generateId(),
        DEMO_IDS.orgId,
        DEMO_IDS.employeeUserId,
        DEMO_IDS.assignmentId,
        DEMO_IDS.templateId,
        DEMO_IDS.policyId,
        DEMO_IDS.siteId,
        shiftWindow.date,
        shiftWindow.startAt,
        shiftWindow.endAt,
      ],
    );

    return DEMO_IDS;
  }

  return {
    applySchema,
    ensureSupplementalSchema,
    seedDemoData,
  };
}

module.exports = {
  createBootstrapService,
};
