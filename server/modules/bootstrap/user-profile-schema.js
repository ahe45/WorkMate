const { generateId } = require("../common/ids");
const { SYSTEM_ROLE_CODES, requireSystemRoleId } = require("../common/system-roles");

function createBootstrapUserProfileSchema(schemaHelpers) {
  const {
    addColumnIfMissing,
    addForeignKeyIfMissing,
    hasTableIndex,
  } = schemaHelpers;

  function normalizeBootstrapRoleCode(value = "") {
    const normalizedValue = String(value || "").trim().toUpperCase();
    return Object.values(SYSTEM_ROLE_CODES).includes(normalizedValue) ? normalizedValue : "";
  }

  async function migrateUserMetadataRoleBindings(connection) {
    const [rows] = await connection.query(`
      SELECT
        id,
        organization_id AS organizationId,
        JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.roleCode')) AS roleCode
      FROM users
      WHERE organization_id IS NOT NULL
        AND metadata_json IS NOT NULL
        AND JSON_EXTRACT(metadata_json, '$.roleCode') IS NOT NULL
        AND deleted_at IS NULL
    `);

    for (const row of rows) {
      const userId = String(row.id || "").trim();
      const organizationId = String(row.organizationId || "").trim();
      const roleCode = normalizeBootstrapRoleCode(row.roleCode);

      if (!userId || !organizationId || !roleCode) {
        continue;
      }

      const [existingRows] = await connection.query(
        `
          SELECT id
          FROM user_roles
          WHERE organization_id = ?
            AND user_id = ?
            AND (effective_to IS NULL OR effective_to >= UTC_TIMESTAMP(3))
          LIMIT 1
        `,
        [organizationId, userId],
      );

      if (existingRows[0]?.id) {
        continue;
      }

      const roleId = await requireSystemRoleId((sql, params) => connection.query(sql, params), roleCode);
      await connection.query(
        `
          INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
          VALUES (?, ?, ?, ?, 'self', NULL)
        `,
        [generateId(), organizationId, userId, roleId],
      );
    }
  }

  async function ensureUserEmployeeProfileSchema(connection) {
    await addColumnIfMissing(connection, "users", "first_name", "VARCHAR(80) NULL AFTER name");
    await addColumnIfMissing(connection, "users", "last_name", "VARCHAR(80) NULL AFTER first_name");
    await addColumnIfMissing(connection, "users", "retire_date", "DATE NULL AFTER join_date");
    await addColumnIfMissing(connection, "users", "job_title_id", "CHAR(36) NULL AFTER primary_unit_id");
    await addColumnIfMissing(connection, "users", "note", "TEXT NULL AFTER manager_user_id");
    await addColumnIfMissing(connection, "users", "personnel_card_json", "JSON NULL AFTER note");
    await addColumnIfMissing(connection, "users", "invite_channels_json", "JSON NULL AFTER personnel_card_json");
    await addColumnIfMissing(connection, "users", "join_request_status", "VARCHAR(20) NOT NULL DEFAULT 'DRAFT' AFTER invite_channels_json");

    await connection.query(`
      UPDATE users
      SET
        first_name = COALESCE(NULLIF(first_name, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.firstName')), '')),
        last_name = COALESCE(NULLIF(last_name, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.lastName')), '')),
        note = COALESCE(NULLIF(note, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.note')), '')),
        retire_date = COALESCE(
          retire_date,
          CASE
            WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.retireDate')) REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.retireDate')), 10))
            ELSE NULL
          END
        ),
        personnel_card_json = COALESCE(personnel_card_json, JSON_EXTRACT(metadata_json, '$.personnelCard')),
        invite_channels_json = COALESCE(invite_channels_json, JSON_EXTRACT(metadata_json, '$.inviteChannels')),
        join_request_status = COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.joinRequestStatus')), ''),
          CASE
            WHEN employment_status = 'ACTIVE' THEN 'JOINED'
            WHEN employment_status = 'INVITED' THEN 'REQUESTED'
            WHEN employment_status = 'PENDING' THEN 'PENDING'
            ELSE 'DRAFT'
          END
        )
      WHERE metadata_json IS NOT NULL
    `);

    await connection.query(`
      UPDATE users u
      INNER JOIN job_titles jt
        ON jt.id = JSON_UNQUOTE(JSON_EXTRACT(u.metadata_json, '$.jobTitleId'))
       AND jt.organization_id = u.organization_id
       AND jt.deleted_at IS NULL
      SET u.job_title_id = jt.id
      WHERE u.job_title_id IS NULL
        AND u.metadata_json IS NOT NULL
    `);
    await connection.query(`
      UPDATE users u
      LEFT JOIN job_titles jt
        ON jt.id = u.job_title_id
       AND jt.organization_id = u.organization_id
      SET u.job_title_id = NULL
      WHERE u.job_title_id IS NOT NULL
        AND jt.id IS NULL
    `);

    if (!(await hasTableIndex(connection, "users", "idx_users_org_job_title"))) {
      await connection.query(`
        ALTER TABLE users
        ADD KEY idx_users_org_job_title (organization_id, job_title_id)
      `);
    }

    await addForeignKeyIfMissing(connection, "users", "fk_users_job_title", "FOREIGN KEY (job_title_id) REFERENCES job_titles(id)");
    await migrateUserMetadataRoleBindings(connection);
    await connection.query(`
      UPDATE users
      SET metadata_json = JSON_REMOVE(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.firstName',
        '$.lastName',
        '$.jobTitleId',
        '$.jobTitleName',
        '$.jobTitle',
        '$.rank',
        '$.position',
        '$.note',
        '$.personnelCard',
        '$.retireDate',
        '$.inviteChannels',
        '$.joinRequestStatus',
        '$.roleCode'
      )
      WHERE organization_id IS NOT NULL
        AND metadata_json IS NOT NULL
    `);
  }

  return {
    ensureUserEmployeeProfileSchema,
  };
}

module.exports = {
  createBootstrapUserProfileSchema,
};
