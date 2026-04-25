const { createOrganizationAdminService } = require("./organization-admin-service");
const { createOrganizationUnitService } = require("./unit-service");

function createOrganizationsService({ query, withTransaction }) {
  async function listOrganizations() {
    return query(`
      SELECT
        id,
        code,
        name,
        status,
        timezone,
        0 AS isManaged,
        0 AS isDefault,
        metadata_json AS metadataJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM organizations
      WHERE deleted_at IS NULL
        AND code <> 'WORKMATE_PLATFORM'
      ORDER BY created_at DESC
    `);
  }

  async function getOrganizationById(organizationId) {
    const rows = await query(
      `
        SELECT
          id,
          code,
          name,
          status,
          timezone,
          metadata_json AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM organizations
        WHERE id = :organizationId
          AND deleted_at IS NULL
        LIMIT 1
      `,
      { organizationId },
    );

    return rows[0] || null;
  }

  async function getOrganizationSummary(organizationId) {
    const rows = await query(
      `
        SELECT
          o.id,
          o.code,
          o.name,
          o.status,
          o.timezone,
          o.created_at AS createdAt,
          o.updated_at AS updatedAt,
          0 AS isManaged,
          0 AS isDefault,
          COUNT(DISTINCT u.id) AS userCount,
          COUNT(DISTINCT s.id) AS siteCount
        FROM organizations o
        LEFT JOIN users u
          ON u.organization_id = o.id
         AND u.deleted_at IS NULL
        LEFT JOIN sites s
          ON s.organization_id = o.id
         AND s.deleted_at IS NULL
        WHERE o.id = :organizationId
          AND o.deleted_at IS NULL
        GROUP BY o.id, o.code, o.name, o.status, o.timezone, o.created_at, o.updated_at
        LIMIT 1
      `,
      { organizationId },
    );

    return rows[0] || null;
  }

  async function getOrganizationContext(organizationId) {
    const rows = await query(
      `
        SELECT
          o.id,
          o.code,
          o.name,
          o.status,
          o.timezone,
          wp.id AS defaultWorkPolicyId,
          wp.name AS defaultWorkPolicyName
        FROM organizations o
        LEFT JOIN work_policies wp
          ON wp.organization_id = o.id
         AND wp.is_default = 1
         AND wp.deleted_at IS NULL
        WHERE o.id = :organizationId
          AND o.deleted_at IS NULL
        LIMIT 1
      `,
      { organizationId },
    );

    return rows[0] || null;
  }

  async function listManagedOrganizations(adminUserId) {
    return query(
      `
        SELECT
          o.id,
          o.code,
          o.name,
          o.status,
          o.timezone,
          o.created_at AS createdAt,
          o.updated_at AS updatedAt,
          1 AS isManaged,
          map.is_default AS isDefault,
          COUNT(DISTINCT u.id) AS userCount,
          COUNT(DISTINCT s.id) AS siteCount
        FROM admin_account_organizations map
        INNER JOIN organizations o
          ON o.id = map.organization_id
         AND o.deleted_at IS NULL
        LEFT JOIN users u
          ON u.organization_id = o.id
         AND u.deleted_at IS NULL
        LEFT JOIN sites s
          ON s.organization_id = o.id
         AND s.deleted_at IS NULL
        WHERE map.admin_user_id = :adminUserId
        GROUP BY o.id, o.code, o.name, o.status, o.timezone, o.created_at, o.updated_at, map.is_default
        ORDER BY map.is_default DESC, o.created_at DESC
      `,
      { adminUserId },
    );
  }

  async function isManagedOrganization(adminUserId, organizationId) {
    const rows = await query(
      `
        SELECT COUNT(*) AS count
        FROM admin_account_organizations
        WHERE admin_user_id = :adminUserId
          AND organization_id = :organizationId
      `,
      { adminUserId, organizationId },
    );

    return Number(rows[0]?.count || 0) > 0;
  }

  const organizationUnitService = createOrganizationUnitService({
    getOrganizationById,
    query,
    withTransaction,
  });
  const organizationAdminService = createOrganizationAdminService({
    getOrganizationById,
    getOrganizationSummary,
    isManagedOrganization,
    withTransaction,
  });

  return {
    createUnit: organizationUnitService.createUnit,
    deleteUnit: organizationUnitService.deleteUnit,
    createManagedOrganization: organizationAdminService.createManagedOrganization,
    createOrganization: organizationAdminService.createOrganization,
    getOrganizationById,
    getOrganizationSummary,
    getOrganizationContext,
    isManagedOrganization,
    listManagedOrganizations,
    listOrganizations,
    listUnits: organizationUnitService.listUnits,
    updateManagedOrganization: organizationAdminService.updateManagedOrganization,
    updateUnit: organizationUnitService.updateUnit,
  };
}

module.exports = {
  createOrganizationsService,
};
