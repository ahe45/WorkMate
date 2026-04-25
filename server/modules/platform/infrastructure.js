const { generateId } = require("../common/ids");

const PLATFORM_CODES = Object.freeze({
  organizationCode: "WORKMATE_PLATFORM",
  unitCode: "PLATFORM",
  workPolicyCode: "PLATFORM",
});

async function ensurePlatformOrganization(connection) {
  const [rows] = await connection.query(
    `
      SELECT id, deleted_at AS deletedAt
      FROM organizations
      WHERE code = ?
      LIMIT 1
    `,
    [PLATFORM_CODES.organizationCode],
  );

  if (rows[0]?.id) {
    if (rows[0].deletedAt) {
      await connection.query(
        `
          UPDATE organizations
          SET
            name = 'WorkMate Platform',
            status = 'ACTIVE',
            timezone = 'Asia/Seoul',
            metadata_json = JSON_OBJECT('platformSystem', true, 'hidden', true),
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [rows[0].id],
      );
    }

    return String(rows[0].id);
  }

  const organizationId = generateId();
  await connection.query(
    `
      INSERT INTO organizations (id, code, name, status, timezone, metadata_json)
      VALUES (?, ?, 'WorkMate Platform', 'ACTIVE', 'Asia/Seoul', JSON_OBJECT('platformSystem', true, 'hidden', true))
    `,
    [organizationId, PLATFORM_CODES.organizationCode],
  );

  return organizationId;
}

async function ensurePlatformUnit(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, deleted_at AS deletedAt
      FROM units
      WHERE organization_id = ?
        AND code = ?
      LIMIT 1
    `,
    [organizationId, PLATFORM_CODES.unitCode],
  );

  if (rows[0]?.id) {
    if (rows[0].deletedAt) {
      await connection.query(
        `
          UPDATE units
          SET
            parent_unit_id = NULL,
            name = '플랫폼 운영',
            unit_type = 'DEPARTMENT',
            status = 'ACTIVE',
            sort_order = 1,
            path = '/PLATFORM',
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [rows[0].id],
      );
    }

    return String(rows[0].id);
  }

  const unitId = generateId();
  await connection.query(
    `
      INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
      VALUES (?, ?, NULL, ?, '플랫폼 운영', 'DEPARTMENT', 'ACTIVE', 1, '/PLATFORM')
    `,
    [unitId, organizationId, PLATFORM_CODES.unitCode],
  );

  return unitId;
}

async function ensurePlatformWorkPolicy(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, deleted_at AS deletedAt
      FROM work_policies
      WHERE organization_id = ?
        AND code = ?
      LIMIT 1
    `,
    [organizationId, PLATFORM_CODES.workPolicyCode],
  );

  if (rows[0]?.id) {
    if (rows[0].deletedAt) {
      await connection.query(
        `
          UPDATE work_policies
          SET
            name = '플랫폼 기본 정책',
            track_type = 'FIXED',
            timezone = 'Asia/Seoul',
            policy_json = JSON_OBJECT('platformSystem', true),
            is_default = 1,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE id = ?
        `,
        [rows[0].id],
      );
    }

    return String(rows[0].id);
  }

  const workPolicyId = generateId();
  await connection.query(
    `
      INSERT INTO work_policies (
        id, organization_id, code, name, track_type, timezone, standard_daily_minutes, standard_weekly_minutes,
        daily_max_minutes, late_grace_minutes, early_leave_grace_minutes, policy_json, is_default
      )
      VALUES (
        ?, ?, ?, '플랫폼 기본 정책', 'FIXED', 'Asia/Seoul', 480, 2400,
        720, 10, 10, JSON_OBJECT('platformSystem', true), 1
      )
    `,
    [workPolicyId, organizationId, PLATFORM_CODES.workPolicyCode],
  );

  return workPolicyId;
}

async function ensurePlatformInfrastructure(connection) {
  const organizationId = await ensurePlatformOrganization(connection);
  const unitId = await ensurePlatformUnit(connection, organizationId);
  const workPolicyId = await ensurePlatformWorkPolicy(connection, organizationId);

  return {
    organizationId,
    unitId,
    workPolicyId,
  };
}

module.exports = {
  PLATFORM_CODES,
  ensurePlatformInfrastructure,
};
