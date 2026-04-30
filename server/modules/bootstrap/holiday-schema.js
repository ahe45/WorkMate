function createBootstrapHolidaySchema(helpers = {}) {
  const {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    dropColumnIfExists,
    dropForeignKeyIfExists,
    dropForeignKeysForColumn,
    dropIndexIfExists,
    dropTableIfExists,
    ensureColumnExists,
    hasColumn,
    hasTable,
    hasTableIndex,
  } = helpers;

  async function deleteHolidayDatesByOrganization(connection, organizationId) {
    if (!(await hasTable(connection, "holiday_dates"))) {
      return;
    }

    if (await hasColumn(connection, "holiday_dates", "organization_id")) {
      await connection.query("DELETE FROM holiday_dates WHERE organization_id = ?", [organizationId]);
    }

    if ((await hasColumn(connection, "holiday_dates", "holiday_calendar_id")) && (await hasTable(connection, "holiday_calendars"))) {
      await connection.query(
        `
          DELETE FROM holiday_dates
          WHERE holiday_calendar_id IN (
            SELECT id
            FROM holiday_calendars
            WHERE organization_id = ?
          )
        `,
        [organizationId],
      );
    }
  }

  async function createHolidayDatesTableIfMissing(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS holiday_dates (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        holiday_date DATE NOT NULL,
        name VARCHAR(150) NOT NULL,
        is_paid_holiday TINYINT(1) NOT NULL DEFAULT 1,
        holiday_source VARCHAR(20) NOT NULL DEFAULT 'CUSTOM',
        repeat_unit VARCHAR(20) NOT NULL DEFAULT 'NONE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_holiday_dates_org_date_source (organization_id, holiday_date, holiday_source),
        CONSTRAINT fk_holiday_dates_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async function deleteNonCustomHolidayDates(connection) {
    if (!(await hasTable(connection, "holiday_dates"))) {
      return;
    }

    await connection.query(`
      ALTER TABLE holiday_dates
      MODIFY holiday_source VARCHAR(20) NOT NULL DEFAULT 'CUSTOM'
    `);
    await connection.query(`
      DELETE FROM holiday_dates
      WHERE holiday_source <> 'CUSTOM'
    `);
  }

  async function deleteUnscopedHolidayDates(connection) {
    if (!(await hasTable(connection, "holiday_dates")) || !(await hasColumn(connection, "holiday_dates", "organization_id"))) {
      return;
    }

    await connection.query(`
      DELETE FROM holiday_dates
      WHERE organization_id IS NULL
    `);
    await connection.query(`
      DELETE hd
      FROM holiday_dates hd
      LEFT JOIN organizations org
        ON org.id = hd.organization_id
      WHERE org.id IS NULL
    `);
  }

  async function deduplicateOrganizationHolidayDates(connection) {
    if (!(await hasTable(connection, "holiday_dates")) || !(await hasColumn(connection, "holiday_dates", "organization_id"))) {
      return;
    }

    await connection.query(`
      DELETE hd
      FROM holiday_dates hd
      INNER JOIN (
        SELECT
          organization_id,
          holiday_date,
          holiday_source,
          MIN(id) AS keep_id
        FROM (
          SELECT
            id,
            organization_id,
            holiday_date,
            holiday_source
          FROM holiday_dates
          WHERE organization_id IS NOT NULL
        ) scoped_holiday_dates
        GROUP BY organization_id, holiday_date, holiday_source
        HAVING COUNT(*) > 1
      ) duplicates
        ON duplicates.organization_id = hd.organization_id
       AND duplicates.holiday_date = hd.holiday_date
       AND duplicates.holiday_source = hd.holiday_source
      WHERE hd.id <> duplicates.keep_id
    `);
  }

  async function ensureHolidayDatesOrganizationSchema(connection) {
    await createHolidayDatesTableIfMissing(connection);
    await addColumnIfMissing(connection, "holiday_dates", "organization_id", "CHAR(36) NULL AFTER id");
    await ensureColumnExists(connection, "holiday_dates", "holiday_source", "VARCHAR(20) NOT NULL DEFAULT 'CUSTOM' AFTER is_paid_holiday");
    await ensureColumnExists(connection, "holiday_dates", "repeat_unit", "VARCHAR(20) NOT NULL DEFAULT 'NONE' AFTER holiday_source");

    if ((await hasColumn(connection, "holiday_dates", "holiday_calendar_id")) && (await hasTable(connection, "holiday_calendars"))) {
      await connection.query(`
        UPDATE holiday_dates hd
        INNER JOIN holiday_calendars hc
          ON hc.id = hd.holiday_calendar_id
        SET hd.organization_id = hc.organization_id
        WHERE hd.organization_id IS NULL
      `);
    }

    await deleteNonCustomHolidayDates(connection);
    await deleteUnscopedHolidayDates(connection);
    await deduplicateOrganizationHolidayDates(connection);
    await dropForeignKeyIfExists(connection, "holiday_dates", "fk_holiday_dates_org");
    await dropForeignKeysForColumn(connection, "holiday_dates", "holiday_calendar_id");
    await dropIndexIfExists(connection, "holiday_dates", "uk_holiday_dates_calendar_date_source");
    await dropIndexIfExists(connection, "holiday_dates", "uk_holiday_dates_calendar_date");
    await dropIndexIfExists(connection, "holiday_dates", "idx_holiday_dates_calendar");
    await connection.query(`
      ALTER TABLE holiday_dates
      MODIFY organization_id CHAR(36) NOT NULL
    `);

    if (!(await hasTableIndex(connection, "holiday_dates", "uk_holiday_dates_org_date_source"))) {
      await connection.query(`
        ALTER TABLE holiday_dates
        ADD UNIQUE KEY uk_holiday_dates_org_date_source (organization_id, holiday_date, holiday_source)
      `);
    }

    await addForeignKeyIfMissing(
      connection,
      "holiday_dates",
      "fk_holiday_dates_org",
      "FOREIGN KEY (organization_id) REFERENCES organizations(id)",
    );
    await dropColumnIfExists(connection, "holiday_dates", "holiday_calendar_id");
    await dropTableIfExists(connection, "holiday_calendars");
  }

  return {
    deleteHolidayDatesByOrganization,
    ensureHolidayDatesOrganizationSchema,
  };
}

module.exports = {
  createBootstrapHolidaySchema,
};
