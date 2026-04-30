const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  assertCompleteReorder,
  getNextSortOrder,
  listActiveOrderedIds,
  normalizeIdList,
  resequenceSortOrders,
} = require("../common/ordered-records");

const JOB_TITLES_ORDERING = Object.freeze({
  orderBy: "sort_order ASC, created_at DESC, name ASC, id ASC",
  tableName: "job_titles",
});

function createJobTitlesService({ query, withTransaction }) {
  function normalizeJobTitleName(value = "") {
    return String(value || "").trim();
  }

  function normalizeUnitIds(value = []) {
    const source = Array.isArray(value)
      ? value
      : value == null
        ? []
        : [value];

    return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean)));
  }

  async function ensureOrganizationExists(queryRunner, organizationId) {
    const [rows] = await queryRunner(
      `
        SELECT id
        FROM organizations
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    );

    if (!rows[0]) {
      throw createHttpError(404, "회사를 찾을 수 없습니다.", "ORG_NOT_FOUND");
    }
  }

  async function fetchJobTitleById(queryRunner, organizationId, jobTitleId) {
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          organization_id AS organizationId,
          name,
          status,
          sort_order AS sortOrder,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM job_titles
        WHERE organization_id = ?
          AND id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId, jobTitleId],
    );

    return rows[0] || null;
  }

  async function listActiveJobTitleIds(queryRunner, organizationId) {
    return listActiveOrderedIds(queryRunner, {
      ...JOB_TITLES_ORDERING,
      organizationId,
    });
  }

  async function getNextJobTitleSortOrder(queryRunner, organizationId) {
    return getNextSortOrder(queryRunner, {
      ...JOB_TITLES_ORDERING,
      organizationId,
    });
  }

  async function resequenceJobTitleSortOrders(queryRunner, organizationId, orderedIds = []) {
    return resequenceSortOrders(queryRunner, {
      ...JOB_TITLES_ORDERING,
      orderedIds,
      organizationId,
    });
  }

  async function assertNoDuplicateJobTitleName(queryRunner, organizationId, name, excludedJobTitleId = "") {
    const [rows] = excludedJobTitleId
      ? await queryRunner(
        `
          SELECT id
          FROM job_titles
          WHERE organization_id = ?
            AND name = ?
            AND id <> ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [organizationId, name, excludedJobTitleId],
      )
      : await queryRunner(
        `
          SELECT id
          FROM job_titles
          WHERE organization_id = ?
            AND name = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [organizationId, name],
      );

    if (rows[0]) {
      throw createHttpError(409, "이미 등록된 직급입니다.", "JOB_TITLE_NAME_EXISTS");
    }
  }

  async function fetchValidatedUnits(queryRunner, organizationId, unitIds = []) {
    if (unitIds.length === 0) {
      throw createHttpError(400, "적용 조직을 하나 이상 선택하세요.", "JOB_TITLE_UNITS_REQUIRED");
    }

    const placeholders = unitIds.map(() => "?").join(", ");
    const [rows] = await queryRunner(
      `
        SELECT
          id,
          parent_unit_id AS parentUnitId,
          code,
          name,
          path
        FROM units
        WHERE organization_id = ?
          AND id IN (${placeholders})
          AND deleted_at IS NULL
      `,
      [organizationId, ...unitIds],
    );

    if (rows.length !== unitIds.length) {
      throw createHttpError(400, "유효하지 않은 적용 조직이 포함되어 있습니다.", "JOB_TITLE_UNITS_INVALID");
    }

    if (rows.some((row) => String(row?.code || "").trim().toUpperCase() === "ROOT" && !String(row?.parentUnitId || "").trim())) {
      throw createHttpError(400, "기본 루트 조직은 적용 조직으로 선택할 수 없습니다.", "JOB_TITLE_UNITS_ROOT_FORBIDDEN");
    }

    return rows;
  }

  async function fetchJobTitleUnits(queryRunner, organizationId, jobTitleIds = []) {
    if (jobTitleIds.length === 0) {
      return [];
    }

    const placeholders = jobTitleIds.map(() => "?").join(", ");
    const [rows] = await queryRunner(
      `
        SELECT
          map.job_title_id AS jobTitleId,
          u.id,
          u.code,
          u.name,
          u.path
        FROM job_title_units map
        INNER JOIN units u
          ON u.id = map.unit_id
         AND u.organization_id = map.organization_id
         AND u.deleted_at IS NULL
        WHERE map.organization_id = ?
          AND map.job_title_id IN (${placeholders})
        ORDER BY u.path, u.sort_order, u.name
      `,
      [organizationId, ...jobTitleIds],
    );

    return rows;
  }

  async function buildJobTitleRecord(queryRunner, organizationId, jobTitleId) {
    const record = await fetchJobTitleById(queryRunner, organizationId, jobTitleId);

    if (!record) {
      return null;
    }

    const units = await fetchJobTitleUnits(queryRunner, organizationId, [jobTitleId]);

    return {
      ...record,
      unitIds: units.map((unit) => String(unit?.id || "").trim()).filter(Boolean),
      units: units.map((unit) => ({
        code: unit?.code || "",
        id: unit?.id || "",
        name: unit?.name || "",
        path: unit?.path || "",
      })),
    };
  }

  async function listJobTitles(organizationId) {
    await ensureOrganizationExists(async (sql, params) => [await query(sql, params)], organizationId);

    const titles = await query(
      `
        SELECT
          id,
          organization_id AS organizationId,
          name,
          status,
          sort_order AS sortOrder,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM job_titles
        WHERE organization_id = :organizationId
          AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at DESC, name ASC, id ASC
      `,
      { organizationId },
    );

    if (titles.length === 0) {
      return [];
    }

    const titleIds = titles.map((title) => String(title?.id || "").trim()).filter(Boolean);
    const units = await fetchJobTitleUnits(async (sql, params) => [await query(sql, params)], organizationId, titleIds);
    const unitsByJobTitleId = new Map();

    units.forEach((unit) => {
      const jobTitleId = String(unit?.jobTitleId || "").trim();

      if (!unitsByJobTitleId.has(jobTitleId)) {
        unitsByJobTitleId.set(jobTitleId, []);
      }

      unitsByJobTitleId.get(jobTitleId).push({
        code: unit?.code || "",
        id: unit?.id || "",
        name: unit?.name || "",
        path: unit?.path || "",
      });
    });

    return titles.map((title) => {
      const titleId = String(title?.id || "").trim();
      const appliedUnits = unitsByJobTitleId.get(titleId) || [];

      return {
        ...title,
        unitIds: appliedUnits.map((unit) => String(unit?.id || "").trim()).filter(Boolean),
        units: appliedUnits,
      };
    });
  }

  async function createJobTitle(organizationId, payload = {}) {
    const name = normalizeJobTitleName(payload.name);
    const unitIds = normalizeUnitIds(payload.unitIds);

    if (!name) {
      throw createHttpError(400, "직급명은 필수입니다.", "JOB_TITLE_CREATE_INVALID");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      await assertNoDuplicateJobTitleName(queryRunner, organizationId, name);
      const units = await fetchValidatedUnits(queryRunner, organizationId, unitIds);
      const jobTitleId = generateId();
      const sortOrder = await getNextJobTitleSortOrder(queryRunner, organizationId);

      await connection.query(
        `
          INSERT INTO job_titles (
            id,
            organization_id,
            name,
            status,
            sort_order
          )
          VALUES (?, ?, ?, 'ACTIVE', ?)
        `,
        [jobTitleId, organizationId, name, sortOrder],
      );

      for (const unit of units) {
        await connection.query(
          `
            INSERT INTO job_title_units (
              id,
              organization_id,
              job_title_id,
              unit_id
            )
            VALUES (?, ?, ?, ?)
          `,
          [generateId(), organizationId, jobTitleId, unit.id],
        );
      }

      return buildJobTitleRecord(queryRunner, organizationId, jobTitleId);
    });
  }

  async function updateJobTitle(organizationId, jobTitleId, payload = {}) {
    const normalizedJobTitleId = String(jobTitleId || "").trim();

    if (!normalizedJobTitleId) {
      throw createHttpError(400, "직급을 찾을 수 없습니다.", "JOB_TITLE_UPDATE_INVALID");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const existing = await fetchJobTitleById(queryRunner, organizationId, normalizedJobTitleId);

      if (!existing) {
        throw createHttpError(404, "직급을 찾을 수 없습니다.", "JOB_TITLE_NOT_FOUND");
      }

      const name = normalizeJobTitleName(payload.name || existing.name);
      const unitIds = normalizeUnitIds(payload.unitIds);

      if (!name) {
        throw createHttpError(400, "직급명은 필수입니다.", "JOB_TITLE_UPDATE_INVALID");
      }

      await assertNoDuplicateJobTitleName(queryRunner, organizationId, name, normalizedJobTitleId);
      const units = await fetchValidatedUnits(queryRunner, organizationId, unitIds);

      await connection.query(
        `
          UPDATE job_titles
          SET
            name = ?,
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [name, organizationId, normalizedJobTitleId],
      );

      await connection.query(
        `
          DELETE FROM job_title_units
          WHERE organization_id = ?
            AND job_title_id = ?
        `,
        [organizationId, normalizedJobTitleId],
      );

      for (const unit of units) {
        await connection.query(
          `
            INSERT INTO job_title_units (
              id,
              organization_id,
              job_title_id,
              unit_id
            )
            VALUES (?, ?, ?, ?)
          `,
          [generateId(), organizationId, normalizedJobTitleId, unit.id],
        );
      }

      return buildJobTitleRecord(queryRunner, organizationId, normalizedJobTitleId);
    });
  }

  async function deleteJobTitle(organizationId, jobTitleId) {
    const normalizedJobTitleId = String(jobTitleId || "").trim();

    if (!normalizedJobTitleId) {
      throw createHttpError(400, "직급을 찾을 수 없습니다.", "JOB_TITLE_DELETE_INVALID");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const existing = await fetchJobTitleById(queryRunner, organizationId, normalizedJobTitleId);

      if (!existing) {
        throw createHttpError(404, "직급을 찾을 수 없습니다.", "JOB_TITLE_NOT_FOUND");
      }

      await connection.query(
        `
          DELETE FROM job_title_units
          WHERE organization_id = ?
            AND job_title_id = ?
        `,
        [organizationId, normalizedJobTitleId],
      );

      await connection.query(
        `
          UPDATE job_titles
          SET
            deleted_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, normalizedJobTitleId],
      );

      await resequenceJobTitleSortOrders(queryRunner, organizationId);

      return {
        id: normalizedJobTitleId,
        success: true,
      };
    });
  }

  async function reorderJobTitles(organizationId, payload = {}) {
    const orderedIds = normalizeIdList(payload.orderedIds);

    if (orderedIds.length === 0) {
      throw createHttpError(400, "직급 순서 정보가 비어 있습니다.", "JOB_TITLE_REORDER_INVALID");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const currentIds = await listActiveJobTitleIds(queryRunner, organizationId);

      assertCompleteReorder({
        currentIds,
        emptyCode: "JOB_TITLE_REORDER_EMPTY",
        emptyMessage: "재정렬할 직급이 없습니다.",
        invalidCode: "JOB_TITLE_REORDER_INVALID",
        invalidMessage: "직급 순서 정보가 올바르지 않습니다.",
        orderedIds,
        unknownIdCode: "JOB_TITLE_REORDER_INVALID",
        unknownIdMessage: "유효하지 않은 직급이 포함되어 있습니다.",
      });
      await resequenceJobTitleSortOrders(queryRunner, organizationId, orderedIds);

      return {
        orderedIds,
        success: true,
      };
    });
  }

  return {
    createJobTitle,
    deleteJobTitle,
    listJobTitles,
    reorderJobTitles,
    updateJobTitle,
  };
}

module.exports = {
  createJobTitlesService,
};
