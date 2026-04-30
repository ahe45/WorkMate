const { createHttpError } = require("../common/http-error");
const { generateId } = require("../common/ids");
const {
  assertCompleteReorder,
  getNextSortOrder,
  listActiveOrderedIds,
  normalizeIdList,
  resequenceSortOrders,
} = require("../common/ordered-records");

const SITES_ORDERING = Object.freeze({
  orderBy: "sort_order ASC, created_at DESC, name ASC, id ASC",
  tableName: "sites",
});

function createSitesService({ query, withTransaction }) {
  function serializeJsonColumn(value, fallback = {}) {
    if (!value) {
      return JSON.stringify(fallback);
    }

    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  }

  function normalizeCoordinate(value, fallback = null) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    return fallback;
  }

  function normalizeGeofenceRadius(value, fallback = 100) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue)) {
      return Math.max(20, numericValue);
    }

    return Math.max(20, Number(fallback) || 100);
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

  async function fetchSiteById(queryRunner, organizationId, siteId) {
    const [rows] = await queryRunner(
      `
        SELECT
          s.id,
          s.organization_id AS organizationId,
          s.primary_unit_id AS primaryUnitId,
          s.name,
          s.status,
          s.timezone,
          s.address_line1 AS addressLine1,
          s.lat,
          s.lng,
          s.sort_order AS sortOrder,
          s.geofence_radius_meters AS geofenceRadiusMeters,
          s.map_metadata_json AS mapMetadataJson
        FROM sites s
        WHERE s.organization_id = ?
          AND s.id = ?
          AND s.deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId, siteId],
    );

    return rows[0] || null;
  }

  async function listActiveSiteIds(queryRunner, organizationId) {
    return listActiveOrderedIds(queryRunner, {
      ...SITES_ORDERING,
      organizationId,
    });
  }

  async function getNextSiteSortOrder(queryRunner, organizationId) {
    return getNextSortOrder(queryRunner, {
      ...SITES_ORDERING,
      organizationId,
    });
  }

  async function resequenceSiteSortOrders(queryRunner, organizationId, orderedIds = []) {
    return resequenceSortOrders(queryRunner, {
      ...SITES_ORDERING,
      orderedIds,
      organizationId,
    });
  }

  async function listSites(organizationId, filters = {}) {
    const conditions = ["s.organization_id = :organizationId", "s.deleted_at IS NULL"];
    const params = { organizationId };

    if (filters.status) {
      conditions.push("s.status = :status");
      params.status = filters.status;
    }

    return query(
      `
        SELECT
          s.id,
          s.organization_id AS organizationId,
          s.primary_unit_id AS primaryUnitId,
          s.name,
          s.status,
          s.timezone,
          s.country_code AS countryCode,
          s.address_line1 AS addressLine1,
          s.address_line2 AS addressLine2,
          s.postal_code AS postalCode,
          s.lat,
          s.lng,
          s.sort_order AS sortOrder,
          s.geofence_radius_meters AS geofenceRadiusMeters,
          s.map_metadata_json AS mapMetadataJson
        FROM sites s
        WHERE ${conditions.join(" AND ")}
        ORDER BY s.sort_order ASC, s.created_at DESC, s.name ASC, s.id ASC
      `,
      params,
    );
  }

  async function createSite(organizationId, payload = {}) {
    const name = String(payload.name || "").trim();
    const lat = normalizeCoordinate(payload.lat);
    const lng = normalizeCoordinate(payload.lng);

    if (!name) {
      throw createHttpError(400, "근무지 이름은 필수입니다.", "SITE_CREATE_INVALID");
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw createHttpError(400, "근무지 위도와 경도는 필수입니다.", "SITE_CREATE_COORDINATES_REQUIRED");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const siteId = generateId();
      const sortOrder = await getNextSiteSortOrder(queryRunner, organizationId);

      await connection.query(
        `
          INSERT INTO sites (
            id, organization_id, primary_unit_id, code, name, status, timezone, country_code, sort_order,
            address_line1, address_line2, postal_code, lat, lng, geofence_radius_meters, map_metadata_json
          )
          VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          siteId,
          organizationId,
          payload.primaryUnitId || null,
          null,
          name,
          payload.timezone || "Asia/Seoul",
          payload.countryCode || "KR",
          sortOrder,
          payload.addressLine1 || null,
          payload.addressLine2 || null,
          payload.postalCode || null,
          lat,
          lng,
          normalizeGeofenceRadius(payload.geofenceRadiusMeters, 100),
          serializeJsonColumn(payload.mapMetadataJson, { source: "admin" }),
        ],
      );

      return fetchSiteById(queryRunner, organizationId, siteId);
    });
  }

  async function updateSite(organizationId, siteId, payload = {}) {
    const existingRows = await query(
      `
        SELECT
          id,
          primary_unit_id AS primaryUnitId,
          name,
          timezone,
          country_code AS countryCode,
          address_line1 AS addressLine1,
          address_line2 AS addressLine2,
          postal_code AS postalCode,
          lat,
          lng,
          sort_order AS sortOrder,
          geofence_radius_meters AS geofenceRadiusMeters,
          map_metadata_json AS mapMetadataJson
        FROM sites
        WHERE organization_id = :organizationId
          AND id = :siteId
          AND deleted_at IS NULL
      `,
      { organizationId, siteId },
    );
    const existing = existingRows[0];

    if (!existing) {
      throw createHttpError(404, "근무지를 찾을 수 없습니다.", "SITE_NOT_FOUND");
    }

    const name = String(payload.name || existing.name || "").trim();
    const lat = normalizeCoordinate(payload.lat, normalizeCoordinate(existing.lat));
    const lng = normalizeCoordinate(payload.lng, normalizeCoordinate(existing.lng));

    if (!name) {
      throw createHttpError(400, "근무지 이름은 필수입니다.", "SITE_UPDATE_INVALID");
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw createHttpError(400, "근무지 위도와 경도는 필수입니다.", "SITE_UPDATE_COORDINATES_REQUIRED");
    }

    await query(
      `
        UPDATE sites
        SET
          primary_unit_id = :primaryUnitId,
          name = :name,
          timezone = :timezone,
          country_code = :countryCode,
          address_line1 = :addressLine1,
          address_line2 = :addressLine2,
          postal_code = :postalCode,
          lat = :lat,
          lng = :lng,
          geofence_radius_meters = :geofenceRadiusMeters,
          map_metadata_json = :mapMetadataJson
        WHERE organization_id = :organizationId
          AND id = :siteId
          AND deleted_at IS NULL
      `,
      {
        organizationId,
        siteId,
        primaryUnitId: payload.primaryUnitId || null,
        name,
        timezone: payload.timezone || existing.timezone || "Asia/Seoul",
        countryCode: payload.countryCode || existing.countryCode || "KR",
        addressLine1: payload.addressLine1 || null,
        addressLine2: payload.addressLine2 || null,
        postalCode: payload.postalCode || null,
        lat,
        lng,
        geofenceRadiusMeters: normalizeGeofenceRadius(payload.geofenceRadiusMeters, existing.geofenceRadiusMeters || 100),
        mapMetadataJson: serializeJsonColumn(payload.mapMetadataJson || existing.mapMetadataJson, { source: "admin-update" }),
      },
    );

    const updatedRows = await query(
      `
        SELECT
          s.id,
          s.organization_id AS organizationId,
          s.primary_unit_id AS primaryUnitId,
          s.name,
          s.status,
          s.timezone,
          s.address_line1 AS addressLine1,
          s.lat,
          s.lng,
          s.sort_order AS sortOrder,
          s.geofence_radius_meters AS geofenceRadiusMeters,
          s.map_metadata_json AS mapMetadataJson
        FROM sites s
        WHERE s.organization_id = :organizationId
          AND s.id = :siteId
          AND s.deleted_at IS NULL
      `,
      { organizationId, siteId },
    );

    return updatedRows[0] || null;
  }

  async function deleteSite(organizationId, siteId) {
    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const existing = await fetchSiteById(queryRunner, organizationId, siteId);

      if (!existing) {
        throw createHttpError(404, "근무지를 찾을 수 없습니다.", "SITE_NOT_FOUND");
      }

      await connection.query(
        `
          UPDATE sites
          SET
            deleted_at = CURRENT_TIMESTAMP(3),
            updated_at = CURRENT_TIMESTAMP(3)
          WHERE organization_id = ?
            AND id = ?
            AND deleted_at IS NULL
        `,
        [organizationId, siteId],
      );

      await resequenceSiteSortOrders(queryRunner, organizationId);

      return { id: siteId, success: true };
    });
  }

  async function reorderSites(organizationId, payload = {}) {
    const orderedIds = normalizeIdList(payload.orderedIds);

    if (orderedIds.length === 0) {
      throw createHttpError(400, "근무지 순서 정보가 비어 있습니다.", "SITE_REORDER_INVALID");
    }

    return withTransaction(async (connection) => {
      const queryRunner = connection.query.bind(connection);
      await ensureOrganizationExists(queryRunner, organizationId);
      const currentIds = await listActiveSiteIds(queryRunner, organizationId);

      assertCompleteReorder({
        currentIds,
        emptyCode: "SITE_REORDER_EMPTY",
        emptyMessage: "재정렬할 근무지가 없습니다.",
        invalidCode: "SITE_REORDER_INVALID",
        invalidMessage: "근무지 순서 정보가 올바르지 않습니다.",
        orderedIds,
        unknownIdCode: "SITE_REORDER_INVALID",
        unknownIdMessage: "유효하지 않은 근무지가 포함되어 있습니다.",
      });
      await resequenceSiteSortOrders(queryRunner, organizationId, orderedIds);

      return {
        orderedIds,
        success: true,
      };
    });
  }

  return {
    createSite,
    deleteSite,
    listSites,
    reorderSites,
    updateSite,
  };
}

module.exports = {
  createSitesService,
};
