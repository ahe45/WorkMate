const { generateId } = require("./ids");

const SYSTEM_ROLE_CODES = Object.freeze({
  EMPLOYEE: "EMPLOYEE",
  MASTER_ADMIN: "MASTER_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
});

const SYSTEM_ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({ code: SYSTEM_ROLE_CODES.EMPLOYEE, name: "Employee" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.ORG_ADMIN, name: "Organization Admin" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.SYSTEM_ADMIN, name: "System Admin" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.MASTER_ADMIN, name: "Master Admin" }),
]);

const SYSTEM_ROLE_CODE_SET = new Set(SYSTEM_ROLE_DEFINITIONS.map((role) => role.code));

function buildPlaceholders(values = []) {
  return values.map(() => "?").join(", ");
}

async function findSystemRole(queryRunner, roleCode) {
  const [rows] = await queryRunner(
    `
      SELECT id, code, name
      FROM roles
      WHERE organization_id IS NULL
        AND code = ?
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [roleCode],
  );

  return rows[0] || null;
}

async function ensureSystemRoles(queryRunner) {
  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    const existingRole = await findSystemRole(queryRunner, definition.code);

    if (!existingRole) {
      await queryRunner(
        `
          INSERT INTO roles (id, organization_id, code, name)
          VALUES (?, NULL, ?, ?)
        `,
        [generateId(), definition.code, definition.name],
      );
      continue;
    }

    if (String(existingRole.name || "").trim() === definition.name) {
      continue;
    }

    await queryRunner(
      `
        UPDATE roles
        SET name = ?
        WHERE id = ?
      `,
      [definition.name, existingRole.id],
    );
  }

  return pruneUnsupportedSystemRoles(queryRunner);
}

async function pruneUnsupportedSystemRoles(queryRunner) {
  const [rows] = await queryRunner(
    `
      SELECT id, organization_id AS organizationId, code, created_at AS createdAt
      FROM roles
      ORDER BY
        CASE WHEN organization_id IS NULL THEN 0 ELSE 1 END ASC,
        created_at ASC,
        id ASC
    `,
  );

  const keepRoleIdsByCode = new Map();
  const duplicateRoleGroups = new Map();
  const obsoleteRoleIds = [];

  for (const row of rows) {
    const roleId = String(row?.id || "").trim();
    const roleCode = String(row?.code || "").trim().toUpperCase();
    const isSystemScoped = row?.organizationId === null || typeof row?.organizationId === "undefined";

    if (!roleId) {
      continue;
    }

    if (!SYSTEM_ROLE_CODE_SET.has(roleCode)) {
      obsoleteRoleIds.push(roleId);
      continue;
    }

    if (isSystemScoped && !keepRoleIdsByCode.has(roleCode)) {
      keepRoleIdsByCode.set(roleCode, roleId);
      continue;
    }

    if (!duplicateRoleGroups.has(roleCode)) {
      duplicateRoleGroups.set(roleCode, []);
    }

    duplicateRoleGroups.get(roleCode).push(roleId);
  }

  let reassignedRoleBindings = 0;
  let deletedRoleBindings = 0;
  let deletedRoles = 0;

  for (const [roleCode, roleIds] of duplicateRoleGroups.entries()) {
    const keepRoleId = keepRoleIdsByCode.get(roleCode);
    const duplicateRoleIds = roleIds.filter((roleId) => roleId && roleId !== keepRoleId);

    if (!keepRoleId || duplicateRoleIds.length === 0) {
      continue;
    }

    const placeholders = buildPlaceholders(duplicateRoleIds);
    const [updateResult] = await queryRunner(
      `
        UPDATE user_roles
        SET role_id = ?
        WHERE role_id IN (${placeholders})
      `,
      [keepRoleId, ...duplicateRoleIds],
    );
    reassignedRoleBindings += Number(updateResult?.affectedRows || 0);

    const [deleteResult] = await queryRunner(
      `
        DELETE FROM roles
        WHERE id IN (${placeholders})
      `,
      duplicateRoleIds,
    );
    deletedRoles += Number(deleteResult?.affectedRows || 0);
  }

  if (obsoleteRoleIds.length > 0) {
    const placeholders = buildPlaceholders(obsoleteRoleIds);
    const [userRoleDeleteResult] = await queryRunner(
      `
        DELETE FROM user_roles
        WHERE role_id IN (${placeholders})
      `,
      obsoleteRoleIds,
    );
    deletedRoleBindings += Number(userRoleDeleteResult?.affectedRows || 0);

    const [roleDeleteResult] = await queryRunner(
      `
        DELETE FROM roles
        WHERE id IN (${placeholders})
      `,
      obsoleteRoleIds,
    );
    deletedRoles += Number(roleDeleteResult?.affectedRows || 0);
  }

  return {
    deletedRoleBindings,
    deletedRoles,
    reassignedRoleBindings,
  };
}

async function requireSystemRoleId(queryRunner, roleCode) {
  const role = await findSystemRole(queryRunner, roleCode);

  if (!role?.id) {
    throw new Error(`System role not found: ${roleCode}`);
  }

  return String(role.id);
}

module.exports = {
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_DEFINITIONS,
  ensureSystemRoles,
  pruneUnsupportedSystemRoles,
  requireSystemRoleId,
};
