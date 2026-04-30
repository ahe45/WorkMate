const { generateId } = require("../common/ids");

function createBootstrapLeaveManagementSchema(schemaHelpers = {}) {
  const {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    hasTableIndex,
  } = schemaHelpers;

  async function ensureLeaveManagementSchema(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_groups (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        parent_leave_group_id CHAR(36) NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        negative_limit_days DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        description TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_leave_groups_org_code (organization_id, code),
        KEY idx_leave_groups_org_parent (organization_id, parent_leave_group_id),
        KEY idx_leave_groups_org_status (organization_id, status),
        CONSTRAINT fk_leave_groups_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_leave_groups_parent FOREIGN KEY (parent_leave_group_id) REFERENCES leave_groups(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, "leave_groups", "parent_leave_group_id", "CHAR(36) NULL AFTER organization_id");

    if (!(await hasTableIndex(connection, "leave_groups", "idx_leave_groups_org_parent"))) {
      await connection.query("ALTER TABLE leave_groups ADD KEY idx_leave_groups_org_parent (organization_id, parent_leave_group_id)");
    }

    await addForeignKeyIfMissing(connection, "leave_groups", "fk_leave_groups_parent", "FOREIGN KEY (parent_leave_group_id) REFERENCES leave_groups(id)");
    await addColumnIfMissing(connection, "leave_types", "leave_group_id", "CHAR(36) NULL AFTER organization_id");

    if (!(await hasTableIndex(connection, "leave_types", "idx_leave_types_group"))) {
      await connection.query("ALTER TABLE leave_types ADD KEY idx_leave_types_group (leave_group_id)");
    }

    await addForeignKeyIfMissing(connection, "leave_types", "fk_leave_types_group", "FOREIGN KEY (leave_group_id) REFERENCES leave_groups(id)");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_accrual_rules (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        rule_set_id CHAR(36) NULL,
        rule_set_name VARCHAR(120) NULL,
        leave_group_id CHAR(36) NOT NULL,
        leave_type_id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'YEARLY',
        amount_days DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        basis_date_type VARCHAR(20) NOT NULL DEFAULT 'FISCAL_YEAR',
        tenure_months INT NULL,
        tenure_years INT NULL,
        annual_month TINYINT NOT NULL DEFAULT 1,
        annual_day TINYINT NOT NULL DEFAULT 1,
        monthly_day TINYINT NOT NULL DEFAULT 1,
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        expires_after_months INT NULL,
        monthly_accrual_method VARCHAR(30) NULL,
        reference_daily_minutes INT NULL,
        attendance_accrual_method VARCHAR(30) NULL,
        attendance_rate_threshold DECIMAL(5,2) NULL,
        immediate_accrual_type VARCHAR(20) NULL,
        proration_basis VARCHAR(20) NULL,
        proration_unit VARCHAR(20) NULL,
        rounding_method VARCHAR(20) NULL,
        rounding_increment DECIMAL(8,2) NULL,
        min_amount_days DECIMAL(8,2) NULL,
        max_amount_days DECIMAL(8,2) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        KEY idx_leave_accrual_rules_org_status (organization_id, status),
        KEY idx_leave_accrual_rules_rule_set (organization_id, rule_set_id),
        KEY idx_leave_accrual_rules_group (leave_group_id),
        CONSTRAINT fk_leave_accrual_rules_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_leave_accrual_rules_group FOREIGN KEY (leave_group_id) REFERENCES leave_groups(id),
        CONSTRAINT fk_leave_accrual_rules_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, "leave_accrual_rules", "rule_set_id", "CHAR(36) NULL AFTER organization_id");
    await addColumnIfMissing(connection, "leave_accrual_rules", "rule_set_name", "VARCHAR(120) NULL AFTER rule_set_id");
    await addColumnIfMissing(connection, "leave_accrual_rules", "tenure_months", "INT NULL AFTER basis_date_type");
    await addColumnIfMissing(connection, "leave_accrual_rules", "tenure_years", "INT NULL AFTER tenure_months");
    await addColumnIfMissing(connection, "leave_accrual_rules", "monthly_accrual_method", "VARCHAR(30) NULL AFTER expires_after_months");
    await addColumnIfMissing(connection, "leave_accrual_rules", "reference_daily_minutes", "INT NULL AFTER monthly_accrual_method");
    await addColumnIfMissing(connection, "leave_accrual_rules", "attendance_accrual_method", "VARCHAR(30) NULL AFTER reference_daily_minutes");
    await addColumnIfMissing(connection, "leave_accrual_rules", "attendance_rate_threshold", "DECIMAL(5,2) NULL AFTER attendance_accrual_method");
    await addColumnIfMissing(connection, "leave_accrual_rules", "immediate_accrual_type", "VARCHAR(20) NULL AFTER attendance_rate_threshold");
    await addColumnIfMissing(connection, "leave_accrual_rules", "proration_basis", "VARCHAR(20) NULL AFTER immediate_accrual_type");
    await addColumnIfMissing(connection, "leave_accrual_rules", "proration_unit", "VARCHAR(20) NULL AFTER proration_basis");
    await addColumnIfMissing(connection, "leave_accrual_rules", "rounding_method", "VARCHAR(20) NULL AFTER proration_unit");
    await addColumnIfMissing(connection, "leave_accrual_rules", "rounding_increment", "DECIMAL(8,2) NULL AFTER rounding_method");
    await addColumnIfMissing(connection, "leave_accrual_rules", "min_amount_days", "DECIMAL(8,2) NULL AFTER rounding_increment");
    await addColumnIfMissing(connection, "leave_accrual_rules", "max_amount_days", "DECIMAL(8,2) NULL AFTER min_amount_days");

    if (!(await hasTableIndex(connection, "leave_accrual_rules", "idx_leave_accrual_rules_rule_set"))) {
      await connection.query("ALTER TABLE leave_accrual_rules ADD KEY idx_leave_accrual_rules_rule_set (organization_id, rule_set_id)");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_accrual_entries (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        leave_group_id CHAR(36) NOT NULL,
        leave_type_id CHAR(36) NOT NULL,
        balance_year SMALLINT NOT NULL,
        source_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        source_ref_id CHAR(36) NULL,
        accrual_date DATE NOT NULL,
        expires_at DATE NULL,
        amount_days DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        memo TEXT NULL,
        created_by_user_id CHAR(36) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_leave_accrual_entries_rule_run (organization_id, user_id, leave_type_id, source_type, source_ref_id, accrual_date),
        KEY idx_leave_accrual_entries_org_date (organization_id, accrual_date),
        KEY idx_leave_accrual_entries_user_year (user_id, balance_year),
        CONSTRAINT fk_leave_accrual_entries_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT fk_leave_accrual_entries_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_leave_accrual_entries_group FOREIGN KEY (leave_group_id) REFERENCES leave_groups(id),
        CONSTRAINT fk_leave_accrual_entries_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
        CONSTRAINT fk_leave_accrual_entries_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [typeRows] = await connection.query(`
      SELECT id, organization_id AS organizationId, code, name
      FROM leave_types
      WHERE leave_group_id IS NULL
    `);

    for (const typeRow of typeRows) {
      const groupId = generateId();

      await connection.query(
        `
          INSERT INTO leave_groups (id, organization_id, code, name, negative_limit_days, description)
          VALUES (?, ?, ?, ?, 0.00, '기존 휴가 유형에서 자동 생성된 휴가정책입니다.')
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            updated_at = CURRENT_TIMESTAMP(3)
        `,
        [groupId, typeRow.organizationId, String(typeRow.code || "").trim(), String(typeRow.name || "").trim()],
      );

      const [groupRows] = await connection.query(
        `
          SELECT id
          FROM leave_groups
          WHERE organization_id = ?
            AND code = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [typeRow.organizationId, String(typeRow.code || "").trim()],
      );

      await connection.query(
        "UPDATE leave_types SET leave_group_id = ? WHERE id = ? AND leave_group_id IS NULL",
        [groupRows[0]?.id || groupId, typeRow.id],
      );
    }
  }

  return {
    ensureLeaveManagementSchema,
  };
}

module.exports = {
  createBootstrapLeaveManagementSchema,
};
