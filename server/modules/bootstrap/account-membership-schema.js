const { generateId } = require("../common/ids");
const { normalizeLoginEmail, parseJsonValue } = require("../common/normalizers");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../common/system-roles");

function createBootstrapAccountMembershipSchema({ hashPassword, schemaHelpers } = {}) {
  const {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    hasTable,
    hasTableIndex,
    makeUuidForeignKeyColumnNullable,
    queryIfTableExists,
  } = schemaHelpers || {};

  async function ensureAccountMembershipSchema(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id CHAR(36) NOT NULL,
        login_email VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NULL,
        phone VARCHAR(30) NULL,
        role_code VARCHAR(50) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_accounts_login_email (login_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await addColumnIfMissing(connection, "accounts", "name", "VARCHAR(100) NULL AFTER password_hash");
    await addColumnIfMissing(connection, "accounts", "phone", "VARCHAR(30) NULL AFTER name");
    await addColumnIfMissing(connection, "accounts", "role_code", "VARCHAR(50) NULL AFTER phone");

    await addColumnIfMissing(connection, "users", "account_id", "CHAR(36) NULL AFTER organization_id");
    await makeUuidForeignKeyColumnNullable(
      connection,
      "users",
      "organization_id",
      "fk_users_org",
      "FOREIGN KEY (organization_id) REFERENCES organizations(id)",
    );

    if (await hasTableIndex(connection, "users", "uk_users_login_email")) {
      await connection.query(`
        ALTER TABLE users
        DROP INDEX uk_users_login_email
      `);
    }

    if (!(await hasTableIndex(connection, "users", "uk_users_org_login_email"))) {
      await connection.query(`
        ALTER TABLE users
        ADD UNIQUE KEY uk_users_org_login_email (organization_id, login_email)
      `);
    }

    if (!(await hasTableIndex(connection, "users", "idx_users_account"))) {
      await connection.query(`
        ALTER TABLE users
        ADD KEY idx_users_account (account_id)
      `);
    }

    await connection.query(`
      ALTER TABLE users
      MODIFY primary_unit_id CHAR(36) NULL
    `);
    await connection.query(`
      ALTER TABLE users
      MODIFY work_policy_id CHAR(36) NULL
    `);

    await addForeignKeyIfMissing(connection, "users", "fk_users_account", "FOREIGN KEY (account_id) REFERENCES accounts(id)");

    const [accountSeedRows] = await connection.query(
      `
        SELECT DISTINCT
          login_email AS loginEmail,
          password_hash AS passwordHash,
          name,
          phone,
          JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.roleCode')) AS roleCode
        FROM users
        WHERE login_email IS NOT NULL
          AND TRIM(login_email) <> ''
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `,
    );

    for (const row of accountSeedRows) {
      const normalizedLoginEmail = normalizeLoginEmail(row.loginEmail);
      const normalizedPasswordHash = String(row.passwordHash || "").trim() || hashPassword("Passw0rd!");
      const normalizedName = String(row.name || "").trim();
      const normalizedPhone = String(row.phone || "").trim();
      const normalizedRoleCode = String(row.roleCode || "").trim().toUpperCase();

      if (!normalizedLoginEmail) {
        continue;
      }

      const [existingAccountRows] = await connection.query(
        `
          SELECT id
          FROM accounts
          WHERE login_email = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [normalizedLoginEmail],
      );

      if (existingAccountRows[0]?.id) {
        await connection.query(
          `
            UPDATE accounts
            SET
              name = COALESCE(name, ?),
              phone = COALESCE(phone, ?),
              role_code = COALESCE(role_code, ?),
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?
          `,
          [
            normalizedName || null,
            normalizedPhone || null,
            normalizedRoleCode || null,
            existingAccountRows[0].id,
          ],
        );
        continue;
      }

      await connection.query(
        `
          INSERT INTO accounts (id, login_email, password_hash, name, phone, role_code)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          generateId(),
          normalizedLoginEmail,
          normalizedPasswordHash,
          normalizedName || null,
          normalizedPhone || null,
          normalizedRoleCode || null,
        ],
      );
    }

    await connection.query(`
      UPDATE users u
      INNER JOIN accounts a
        ON a.login_email = u.login_email
       AND a.deleted_at IS NULL
      SET
        u.account_id = a.id,
        u.password_hash = a.password_hash,
        u.updated_at = CURRENT_TIMESTAMP(3)
      WHERE u.login_email IS NOT NULL
        AND TRIM(u.login_email) <> ''
        AND (u.account_id IS NULL OR u.account_id <> a.id OR u.password_hash <> a.password_hash)
    `);
  }

  function buildManagedMembershipMetadata(sourceMetadataJson) {
    const metadata = parseJsonValue(sourceMetadataJson, {});
    delete metadata.source;
    delete metadata.roleCode;

    return {
      ...metadata,
      managedMembership: true,
      source: "account",
    };
  }

  async function findOrganizationMembershipUser(connection, organizationId, accountId) {
    const normalizedOrganizationId = String(organizationId || "").trim();
    const normalizedAccountId = String(accountId || "").trim();

    if (!normalizedOrganizationId || !normalizedAccountId) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT id
        FROM users
        WHERE organization_id = ?
          AND account_id = ?
          AND deleted_at IS NULL
          AND employment_status <> 'RETIRED'
        ORDER BY
          CASE employment_status
            WHEN 'ACTIVE' THEN 0
            WHEN 'INVITED' THEN 1
            WHEN 'PENDING' THEN 2
            WHEN 'DRAFT' THEN 3
            ELSE 4
          END ASC,
          created_at ASC
        LIMIT 1
      `,
      [normalizedOrganizationId, normalizedAccountId],
    );

    return rows[0] || null;
  }

  async function ensureManagedOrganizationAdminRoleForMembership(connection, userId, organizationId) {
    const queryRunner = connection.query.bind(connection);
    await ensureSystemRoles(queryRunner);
    const roleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.SYSTEM_ADMIN);
    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM user_roles
        WHERE organization_id = ?
          AND user_id = ?
          AND role_id = ?
          AND (effective_to IS NULL OR effective_to >= UTC_TIMESTAMP(3))
        LIMIT 1
      `,
      [organizationId, userId, roleId],
    );

    if (existingRows[0]?.id) {
      return String(existingRows[0].id);
    }

    const bindingId = generateId();
    await connection.query(
      `
        INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
        VALUES (?, ?, ?, ?, 'organization', ?)
      `,
      [bindingId, organizationId, userId, roleId, organizationId],
    );

    return bindingId;
  }

  async function ensureManagedOrganizationMemberships(connection) {
    if (!(await hasTable(connection, "admin_account_organizations"))) {
      return;
    }

    const [mappingRows] = await connection.query(
      `
        SELECT
          map.id,
          map.admin_user_id AS adminUserId,
          map.organization_id AS organizationId,
          source.account_id AS accountId,
          source.login_email AS loginEmail,
          source.password_hash AS passwordHash,
          source.name,
          source.phone,
          source.employment_type AS employmentType,
          source.join_date AS joinDate,
          source.timezone,
          source.track_type AS trackType,
          source.metadata_json AS metadataJson
        FROM admin_account_organizations map
        INNER JOIN users source
          ON source.id = map.admin_user_id
         AND source.deleted_at IS NULL
        WHERE source.account_id IS NOT NULL
        ORDER BY map.created_at ASC
      `,
    );

    for (const mapping of mappingRows) {
      const normalizedOrganizationId = String(mapping.organizationId || "").trim();
      const normalizedAccountId = String(mapping.accountId || "").trim();

      if (!normalizedOrganizationId || !normalizedAccountId) {
        continue;
      }

      let membershipUserId = String((await findOrganizationMembershipUser(connection, normalizedOrganizationId, normalizedAccountId))?.id || "").trim();

      if (!membershipUserId) {
        membershipUserId = generateId();
        const employeeNo = `E${generateId().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        const nextMetadata = buildManagedMembershipMetadata(mapping.metadataJson);

        await connection.query(
          `
            INSERT INTO users (
              id, organization_id, account_id, employee_no, login_email, password_hash, name, phone, employment_status,
              employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
              manager_user_id, metadata_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, NULL, ?, ?, NULL, ?)
          `,
          [
            membershipUserId,
            normalizedOrganizationId,
            normalizedAccountId,
            employeeNo,
            String(mapping.loginEmail || "").trim() || null,
            String(mapping.passwordHash || "").trim() || null,
            String(mapping.name || "").trim() || "조직 관리자",
            String(mapping.phone || "").trim() || null,
            String(mapping.employmentType || "").trim() || "FULL_TIME",
            mapping.joinDate || new Date(),
            String(mapping.timezone || "").trim() || "Asia/Seoul",
            null,
            String(mapping.trackType || "").trim() || "FIXED",
            null,
            JSON.stringify(nextMetadata),
          ],
        );
      } else {
        const [membershipRows] = await connection.query(
          `
            SELECT metadata_json AS metadataJson
            FROM users
            WHERE id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [membershipUserId],
        );
        const nextMetadata = buildManagedMembershipMetadata(membershipRows[0]?.metadataJson || mapping.metadataJson);

        await connection.query(
          `
            UPDATE users
            SET
              metadata_json = ?,
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE id = ?
              AND deleted_at IS NULL
          `,
          [JSON.stringify(nextMetadata), membershipUserId],
        );
      }

      await ensureManagedOrganizationAdminRoleForMembership(connection, membershipUserId, normalizedOrganizationId);

      if (String(mapping.adminUserId || "").trim() === membershipUserId) {
        continue;
      }

      const [duplicateRows] = await connection.query(
        `
          SELECT id
          FROM admin_account_organizations
          WHERE admin_user_id = ?
            AND organization_id = ?
          LIMIT 1
        `,
        [membershipUserId, normalizedOrganizationId],
      );

      if (duplicateRows[0]?.id && String(duplicateRows[0].id || "").trim() !== String(mapping.id || "").trim()) {
        await connection.query(
          `
            DELETE FROM admin_account_organizations
            WHERE id = ?
          `,
          [mapping.id],
        );
        continue;
      }

      await connection.query(
        `
          UPDATE admin_account_organizations
          SET
            admin_user_id = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [membershipUserId, mapping.id],
      );
    }
  }

  async function removeAccountProfileUsers(connection) {
    const [profileRows] = await connection.query(
      `
        SELECT id, account_id AS accountId
        FROM users
        WHERE organization_id IS NULL
      `,
    );
    const profileUserIds = profileRows.map((row) => String(row.id || "").trim()).filter(Boolean);

    if (profileUserIds.length === 0) {
      return;
    }

    const placeholders = profileUserIds.map(() => "?").join(", ");

    await queryIfTableExists(
      connection,
      "auth_refresh_tokens",
      `
        UPDATE auth_refresh_tokens art
        INNER JOIN users u
          ON u.id = art.user_id
        SET
          art.account_id = COALESCE(art.account_id, u.account_id),
          art.user_id = NULL,
          art.organization_id = NULL
        WHERE u.organization_id IS NULL
      `,
    );
    await queryIfTableExists(
      connection,
      "audit_logs",
      `
        UPDATE audit_logs
        SET actor_user_id = NULL
        WHERE actor_user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await connection.query(
      `
        DELETE FROM user_roles
        WHERE user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await queryIfTableExists(
      connection,
      "user_join_invitations",
      `
        UPDATE user_join_invitations
        SET created_by_user_id = NULL
        WHERE created_by_user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await queryIfTableExists(
      connection,
      "user_join_invitations",
      `
        DELETE FROM user_join_invitations
        WHERE user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await queryIfTableExists(
      connection,
      "admin_account_organizations",
      `
        DELETE FROM admin_account_organizations
        WHERE admin_user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await connection.query(
      `
        UPDATE users
        SET manager_user_id = NULL
        WHERE manager_user_id IN (${placeholders})
      `,
      profileUserIds,
    );
    await connection.query(
      `
        DELETE FROM users
        WHERE id IN (${placeholders})
      `,
      profileUserIds,
    );
  }

  return {
    ensureAccountMembershipSchema,
    ensureManagedOrganizationMemberships,
    removeAccountProfileUsers,
  };
}

module.exports = {
  createBootstrapAccountMembershipSchema,
};
