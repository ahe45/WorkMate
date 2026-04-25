const { generateId } = require("./ids");

const SYSTEM_ROLE_CODES = Object.freeze({
  APPROVER: "APPROVER",
  AUDITOR: "AUDITOR",
  EMPLOYEE: "EMPLOYEE",
  ORG_ADMIN: "ORG_ADMIN",
  SITE_MANAGER: "SITE_MANAGER",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  UNIT_MANAGER: "UNIT_MANAGER",
});

const SYSTEM_ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({ code: SYSTEM_ROLE_CODES.SYSTEM_ADMIN, name: "System Admin" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.ORG_ADMIN, name: "Organization Admin" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.UNIT_MANAGER, name: "Unit Manager" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.SITE_MANAGER, name: "Site Manager" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.APPROVER, name: "Approver" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.EMPLOYEE, name: "Employee" }),
  Object.freeze({ code: SYSTEM_ROLE_CODES.AUDITOR, name: "Auditor" }),
]);

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
  requireSystemRoleId,
};
