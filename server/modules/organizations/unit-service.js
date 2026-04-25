const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");

const UNIT_TYPES = new Set(["HEADQUARTERS", "DEPARTMENT", "TEAM"]);

function createOrganizationUnitService({ getOrganizationById, query, withTransaction }) {
  if (typeof getOrganizationById !== "function" || typeof query !== "function" || typeof withTransaction !== "function") {
    throw new Error("createOrganizationUnitService requires organization unit dependencies.");
  }

  function normalizeUnitPayload(payload = {}, { isTopLevel = false, parentUnitId = null } = {}) {
    const name = String(payload.name || "").trim();
    const requestedUnitType = String(payload.unitType || "").trim().toUpperCase();

    if (!name) {
      throw createHttpError(400, "조직명은 필수입니다.", "UNIT_CREATE_INVALID");
    }

    return {
      name,
      parentUnitId: parentUnitId || null,
      unitType: UNIT_TYPES.has(requestedUnitType)
        ? requestedUnitType
        : isTopLevel
          ? "DEPARTMENT"
          : "TEAM",
    };
  }

  function buildUnitPath(parentPath = "", code = "") {
    const path = `${String(parentPath || "").trim()}/${String(code || "").trim()}`.replace(/\/{2,}/g, "/");
    return path.startsWith("/") ? path : `/${path}`;
  }

  async function fetchUnitById(queryRunner, organizationId, unitId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          organization_id AS organizationId,
          parent_unit_id AS parentUnitId,
          code,
          name,
          unit_type AS unitType,
          status,
          sort_order AS sortOrder,
          path,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM units
        WHERE organization_id = ?
          AND id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId, unitId],
    );

    return rows[0] || null;
  }

  function isSystemRootUnit(unit = {}) {
    return String(unit?.code || "").trim().toUpperCase() === "ROOT"
      && !String(unit?.parentUnitId || "").trim();
  }

  async function fetchSystemRootUnit(queryRunner, organizationId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          organization_id AS organizationId,
          parent_unit_id AS parentUnitId,
          code,
          name,
          unit_type AS unitType,
          status,
          sort_order AS sortOrder,
          path,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM units
        WHERE organization_id = ?
          AND code = 'ROOT'
          AND parent_unit_id IS NULL
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    );

    return rows[0] || null;
  }

  async function generateUniqueUnitCode(queryRunner, organizationId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = `UNIT-${generateId().slice(0, 8).toUpperCase()}`;
      const [rows] = await queryRunner(
        `
          SELECT COUNT(*) AS count
          FROM units
          WHERE organization_id = ?
            AND code = ?
        `,
        [organizationId, code],
      );

      if (Number(rows[0]?.count || 0) === 0) {
        return code;
      }
    }

    throw createHttpError(500, "조직 코드를 생성하지 못했습니다.", "UNIT_CREATE_CODE_FAILED");
  }

  async function getNextUnitSortOrder(queryRunner, organizationId, parentUnitId = null) {
    const [rows] = parentUnitId
      ? await queryRunner(
        `
          SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder
          FROM units
          WHERE organization_id = ?
            AND parent_unit_id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, parentUnitId],
      )
      : await queryRunner(
        `
          SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder
          FROM units
          WHERE organization_id = ?
            AND parent_unit_id IS NULL
            AND deleted_at IS NULL
        `,
        [organizationId],
      );

    return Math.max(1, Number(rows[0]?.nextSortOrder || 1));
  }

  async function getUnitDeleteUsage(queryRunner, organizationId, unitId) {
    const [childRows] = await queryRunner(
      `
        SELECT COUNT(*) AS count
        FROM units
        WHERE organization_id = ?
          AND parent_unit_id = ?
          AND deleted_at IS NULL
      `,
      [organizationId, unitId],
    );
    const [siteRows] = await queryRunner(
      `
        SELECT COUNT(*) AS count
        FROM sites
        WHERE organization_id = ?
          AND primary_unit_id = ?
          AND deleted_at IS NULL
      `,
      [organizationId, unitId],
    );
    const [userRows] = await queryRunner(
      `
        SELECT COUNT(*) AS count
        FROM users
        WHERE organization_id = ?
          AND primary_unit_id = ?
          AND deleted_at IS NULL
      `,
      [organizationId, unitId],
    );
    const [jobTitleRows] = await queryRunner(
      `
        SELECT COUNT(*) AS count
        FROM job_title_units map
        INNER JOIN job_titles jt
          ON jt.id = map.job_title_id
         AND jt.organization_id = map.organization_id
         AND jt.deleted_at IS NULL
        WHERE map.organization_id = ?
          AND map.unit_id = ?
      `,
      [organizationId, unitId],
    );

    return {
      childCount: Number(childRows[0]?.count || 0),
      jobTitleCount: Number(jobTitleRows[0]?.count || 0),
      siteCount: Number(siteRows[0]?.count || 0),
      userCount: Number(userRows[0]?.count || 0),
    };
  }

  async function listUnits(organizationId) {
    return query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          parent_unit_id AS parentUnitId,
          code,
          name,
          unit_type AS unitType,
          status,
          sort_order AS sortOrder,
          path
        FROM units
        WHERE organization_id = :organizationId
          AND deleted_at IS NULL
        ORDER BY path, sort_order, name
      `,
      { organizationId },
    );
  }

  async function createUnit(organizationId, payload = {}) {
    const organization = await getOrganizationById(organizationId);

    if (!organization) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      const requestedParentUnitId = String(payload.parentUnitId || "").trim();
      const defaultRootUnit = !requestedParentUnitId
        ? await fetchSystemRootUnit(queryRunner, organizationId)
        : null;
      const resolvedParentUnitId = requestedParentUnitId || defaultRootUnit?.id || null;
      const parentUnit = resolvedParentUnitId
        ? defaultRootUnit && defaultRootUnit.id === resolvedParentUnitId
          ? defaultRootUnit
          : await fetchUnitById(queryRunner, organizationId, resolvedParentUnitId)
        : null;

      if (resolvedParentUnitId && !parentUnit) {
        throw createHttpError(404, "상위 조직을 찾을 수 없습니다.", "UNIT_PARENT_NOT_FOUND");
      }

      const normalized = normalizeUnitPayload(payload, {
        isTopLevel: !parentUnit || isSystemRootUnit(parentUnit),
        parentUnitId: resolvedParentUnitId,
      });
      const unitId = generateId();
      const code = await generateUniqueUnitCode(queryRunner, organizationId);
      const sortOrder = await getNextUnitSortOrder(queryRunner, organizationId, normalized.parentUnitId);
      const parentPath = String(parentUnit?.path || "").trim();
      const path = buildUnitPath(parentPath, code);

      await connection.query(
        `
          INSERT INTO units (
            id,
            organization_id,
            parent_unit_id,
            code,
            name,
            unit_type,
            status,
            sort_order,
            path
          )
          VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
        `,
        [
          unitId,
          organizationId,
          normalized.parentUnitId,
          code,
          normalized.name,
          normalized.unitType,
          sortOrder,
          path,
        ],
      );

      return fetchUnitById(queryRunner, organizationId, unitId);
    });
  }

  async function updateUnit(organizationId, unitId, payload = {}) {
    const organization = await getOrganizationById(organizationId);

    if (!organization) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      const targetUnit = await fetchUnitById(queryRunner, organizationId, unitId);

      if (!targetUnit) {
        throw createHttpError(404, "조직을 찾을 수 없습니다.", "UNIT_NOT_FOUND");
      }

      if (isSystemRootUnit(targetUnit)) {
        throw createHttpError(400, "기본 루트 조직은 수정할 수 없습니다.", "UNIT_UPDATE_ROOT_FORBIDDEN");
      }

      const requestedParentUnitId = String(payload.parentUnitId || "").trim();
      const defaultRootUnit = !requestedParentUnitId
        ? await fetchSystemRootUnit(queryRunner, organizationId)
        : null;
      const resolvedParentUnitId = requestedParentUnitId || defaultRootUnit?.id || null;

      if (resolvedParentUnitId && resolvedParentUnitId === unitId) {
        throw createHttpError(400, "조직 자신을 상위 조직으로 지정할 수 없습니다.", "UNIT_UPDATE_PARENT_SELF");
      }

      const parentUnit = resolvedParentUnitId
        ? defaultRootUnit && defaultRootUnit.id === resolvedParentUnitId
          ? defaultRootUnit
          : await fetchUnitById(queryRunner, organizationId, resolvedParentUnitId)
        : null;

      if (resolvedParentUnitId && !parentUnit) {
        throw createHttpError(404, "상위 조직을 찾을 수 없습니다.", "UNIT_PARENT_NOT_FOUND");
      }

      const targetPath = String(targetUnit.path || "").trim();
      const parentPath = String(parentUnit?.path || "").trim();

      if (parentPath && (parentPath === targetPath || parentPath.startsWith(`${targetPath}/`))) {
        throw createHttpError(400, "자신 또는 하위 조직 아래로 이동할 수 없습니다.", "UNIT_UPDATE_PARENT_CYCLE");
      }

      const normalized = normalizeUnitPayload(payload, {
        isTopLevel: !parentUnit || isSystemRootUnit(parentUnit),
        parentUnitId: resolvedParentUnitId,
      });
      const parentChanged = String(targetUnit.parentUnitId || "").trim() !== String(normalized.parentUnitId || "").trim();
      const nextPath = buildUnitPath(parentPath, targetUnit.code);
      const sortOrder = parentChanged
        ? await getNextUnitSortOrder(queryRunner, organizationId, normalized.parentUnitId)
        : Number(targetUnit.sortOrder || 1);

      await connection.query(
        `
          UPDATE units
          SET
            parent_unit_id = ?,
            name = ?,
            unit_type = ?,
            sort_order = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [
          normalized.parentUnitId,
          normalized.name,
          normalized.unitType,
          sortOrder,
          organizationId,
          unitId,
        ],
      );

      if (nextPath !== targetPath) {
        await connection.query(
          `
            UPDATE units
            SET
              path = CASE
                WHEN id = ? THEN ?
                ELSE CONCAT(?, SUBSTRING(path, ?))
              END,
              updated_at = CURRENT_TIMESTAMP(3)
            WHERE organization_id = ?
              AND deleted_at IS NULL
              AND (id = ? OR path LIKE ?)
          `,
          [
            unitId,
            nextPath,
            nextPath,
            targetPath.length + 1,
            organizationId,
            unitId,
            `${targetPath}/%`,
          ],
        );
      }

      return fetchUnitById(queryRunner, organizationId, unitId);
    });
  }

  async function deleteUnit(organizationId, unitId) {
    const organization = await getOrganizationById(organizationId);

    if (!organization) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      const targetUnit = await fetchUnitById(queryRunner, organizationId, unitId);

      if (!targetUnit) {
        throw createHttpError(404, "조직을 찾을 수 없습니다.", "UNIT_NOT_FOUND");
      }

      if (isSystemRootUnit(targetUnit)) {
        throw createHttpError(400, "기본 루트 조직은 삭제할 수 없습니다.", "UNIT_DELETE_ROOT_FORBIDDEN");
      }

      const usage = await getUnitDeleteUsage(queryRunner, organizationId, unitId);

      if (usage.childCount > 0) {
        throw createHttpError(409, "하위 조직이 남아 있어 삭제할 수 없습니다.", "UNIT_DELETE_HAS_CHILDREN");
      }

      if (usage.userCount > 0) {
        throw createHttpError(409, "구성원이 연결된 조직은 삭제할 수 없습니다.", "UNIT_DELETE_HAS_USERS");
      }

      if (usage.siteCount > 0) {
        throw createHttpError(409, "근무지와 연결된 조직은 삭제할 수 없습니다.", "UNIT_DELETE_HAS_SITES");
      }

      if (usage.jobTitleCount > 0) {
        throw createHttpError(409, "직급과 연결된 조직은 삭제할 수 없습니다.", "UNIT_DELETE_HAS_JOB_TITLES");
      }

      await connection.query(
        `
          UPDATE units
          SET
            deleted_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, unitId],
      );

      return {
        deleted: true,
        id: unitId,
      };
    });
  }

  return {
    createUnit,
    deleteUnit,
    listUnits,
    updateUnit,
  };
}

module.exports = {
  createOrganizationUnitService,
};
