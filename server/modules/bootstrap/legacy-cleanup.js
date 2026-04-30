const { quoteIdentifier } = require("../../../db");
const { generateId } = require("../common/ids");
const { parseJsonValue: parseCommonJsonValue } = require("../common/normalizers");

const LEGACY_PLATFORM_ORGANIZATION_CODE = "WORKMATE_PLATFORM";
const LEGACY_FIXED_IDS = Object.freeze({
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

function createBootstrapLegacyCleanup({ deleteHolidayDatesByOrganization, schemaHelpers }) {
  const {
    queryIfTableExists,
  } = schemaHelpers;

  function parseJsonValue(value) {
    return parseCommonJsonValue(value, {});
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

  async function listLegacyPlatformOrganizationIds(connection) {
    const [rows] = await connection.query(
      `
        SELECT id
        FROM organizations
        WHERE code = ?
      `,
      [LEGACY_PLATFORM_ORGANIZATION_CODE],
    );

    return rows.map((row) => String(row.id || "").trim()).filter(Boolean);
  }

  async function migrateLegacyPlatformUsersToAccountOnly(connection, organizationId) {
    const [userRows] = await connection.query(
      `
        SELECT id, metadata_json AS metadataJson
        FROM users
        WHERE organization_id = ?
      `,
      [organizationId],
    );

    for (const user of userRows) {
      const metadata = parseJsonValue(user.metadataJson);
      delete metadata.platformAccount;

      if (metadata.source === "landing") {
        metadata.source = "account";
      }

      if (!metadata.source) {
        metadata.source = "account";
      }

      await connection.query(
        `
          UPDATE users
          SET
            organization_id = NULL,
            primary_unit_id = NULL,
            default_site_id = NULL,
            work_policy_id = NULL,
            metadata_json = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [JSON.stringify(metadata), user.id],
      );
    }
  }

  async function cleanupLegacyPlatformOrganization(connection, organizationId) {
    await queryIfTableExists(
      connection,
      "auth_refresh_tokens",
      `
        UPDATE auth_refresh_tokens
        SET organization_id = NULL
        WHERE organization_id = ?
      `,
      [organizationId],
    );
    await queryIfTableExists(
      connection,
      "audit_logs",
      `
        UPDATE audit_logs
        SET organization_id = NULL
        WHERE organization_id = ?
      `,
      [organizationId],
    );
    await migrateLegacyPlatformUsersToAccountOnly(connection, organizationId);
    await connection.query(
      `
        UPDATE users
        SET default_site_id = NULL
        WHERE default_site_id IN (
          SELECT id
          FROM sites
          WHERE organization_id = ?
        )
      `,
      [organizationId],
    );
    await connection.query(
      `
        UPDATE users
        SET primary_unit_id = NULL
        WHERE primary_unit_id IN (
          SELECT id
          FROM units
          WHERE organization_id = ?
        )
      `,
      [organizationId],
    );
    await connection.query(
      `
        UPDATE users
        SET work_policy_id = NULL
        WHERE work_policy_id IN (
          SELECT id
          FROM work_policies
          WHERE organization_id = ?
        )
      `,
      [organizationId],
    );

    await queryIfTableExists(connection, "user_join_invitations", "DELETE FROM user_join_invitations WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "admin_account_organizations", "DELETE FROM admin_account_organizations WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "user_roles", "DELETE FROM user_roles WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "roles", "DELETE FROM roles WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "leave_requests", "DELETE FROM leave_requests WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "attendance_anomalies", "DELETE FROM attendance_anomalies WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "attendance_events", "DELETE FROM attendance_events WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "attendance_sessions", "DELETE FROM attendance_sessions WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "shift_instances", "DELETE FROM shift_instances WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "schedule_assignments", "DELETE FROM schedule_assignments WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(
      connection,
      "schedule_template_days",
      `
        DELETE FROM schedule_template_days
        WHERE schedule_template_id IN (
          SELECT id
          FROM schedule_templates
          WHERE organization_id = ?
        )
      `,
      [organizationId],
    );
    await queryIfTableExists(connection, "schedule_templates", "DELETE FROM schedule_templates WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "leave_balances", "DELETE FROM leave_balances WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "leave_types", "DELETE FROM leave_types WHERE organization_id = ?", [organizationId]);
    await deleteHolidayDatesByOrganization(connection, organizationId);
    await queryIfTableExists(connection, "holiday_calendars", "DELETE FROM holiday_calendars WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "job_title_units", "DELETE FROM job_title_units WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "job_titles", "DELETE FROM job_titles WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "sites", "DELETE FROM sites WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "units", "DELETE FROM units WHERE organization_id = ?", [organizationId]);
    await queryIfTableExists(connection, "work_policies", "DELETE FROM work_policies WHERE organization_id = ?", [organizationId]);
    await connection.query("DELETE FROM organizations WHERE id = ?", [organizationId]);
  }

  async function cleanupLegacyPlatformInfrastructure(connection) {
    const organizationIds = await listLegacyPlatformOrganizationIds(connection);

    for (const organizationId of organizationIds) {
      await cleanupLegacyPlatformOrganization(connection, organizationId);
    }
  }

  async function normalizeLegacyFixedIds(connection) {
    for (const legacyRoleId of LEGACY_FIXED_IDS.roles) {
      await replacePrimaryKeyValue(connection, "roles", legacyRoleId);
    }
  }

  return {
    cleanupLegacyPlatformInfrastructure,
    normalizeLegacyFixedIds,
  };
}

module.exports = {
  createBootstrapLegacyCleanup,
};
