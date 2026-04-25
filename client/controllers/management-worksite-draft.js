(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksiteDraftController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      createDefaultManagementWorksiteDraft,
      currentPage,
      DEFAULT_WORKSITE_COORDS,
      state,
    } = dependencies;

    if (typeof createDefaultManagementWorksiteDraft !== "function" || !state) {
      throw new Error("WorkMateManagementWorksiteDraftController requires worksite draft dependencies.");
    }

    function getDefaultWorksiteCoords() {
      const firstSite = Array.isArray(state.bootstrap?.sites)
        ? state.bootstrap.sites.find((site) => Number.isFinite(Number(site?.lat)) && Number.isFinite(Number(site?.lng)))
        : null;

      if (!firstSite) {
        return DEFAULT_WORKSITE_COORDS;
      }

      return {
        lat: Number(firstSite.lat),
        lng: Number(firstSite.lng),
      };
    }

    function createEmptyManagementWorksiteDraft() {
      const fallback = getDefaultWorksiteCoords();
      return createDefaultManagementWorksiteDraft({
        lat: fallback.lat,
        lng: fallback.lng,
      });
    }

    function serializeManagementMapMetadata(value) {
      if (!value) {
        return "";
      }

      if (typeof value === "string") {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch (error) {
        return "";
      }
    }

    function createManagementWorksiteDraftFromSite(site = {}) {
      return createDefaultManagementWorksiteDraft({
        addressLine1: String(site?.addressLine1 || "").trim(),
        geofenceRadiusMeters: Number.isFinite(Number(site?.geofenceRadiusMeters)) ? Number(site.geofenceRadiusMeters) : 100,
        lat: Number.isFinite(Number(site?.lat)) ? Number(site.lat) : getDefaultWorksiteCoords().lat,
        lng: Number.isFinite(Number(site?.lng)) ? Number(site.lng) : getDefaultWorksiteCoords().lng,
        mapMetadataJson: serializeManagementMapMetadata(site?.mapMetadataJson),
        name: String(site?.name || "").trim(),
        primaryUnitId: String(site?.primaryUnitId || "").trim(),
        siteId: String(site?.id || "").trim(),
      });
    }

    function setManagementWorksiteDraft(patch = {}) {
      state.managementWorksiteDraft = createDefaultManagementWorksiteDraft({
        ...state.managementWorksiteDraft,
        ...patch,
      });
    }

    function getManagementWorksiteById(siteId = "") {
      const normalizedSiteId = String(siteId || "").trim();

      if (!normalizedSiteId) {
        return null;
      }

      return (Array.isArray(state.bootstrap?.sites) ? state.bootstrap.sites : []).find((site) => String(site?.id || "").trim() === normalizedSiteId) || null;
    }

    function syncManagementWorksiteDraftFromDom() {
      if (currentPage !== "workspace" || state.currentWorkspaceView !== "management") {
        return state.managementWorksiteDraft;
      }

      const searchQueryInput = document.getElementById("management-worksite-search-query");
      const nameInput = document.getElementById("management-worksite-name");
      const unitSelect = document.getElementById("management-worksite-unit");
      const addressInput = document.getElementById("management-worksite-address");
      const latInput = document.getElementById("management-worksite-lat");
      const lngInput = document.getElementById("management-worksite-lng");
      const radiusInput = document.getElementById("management-worksite-radius");
      const siteIdInput = document.getElementById("management-worksite-site-id");
      const metadataInput = document.getElementById("management-worksite-map-metadata");

      state.managementWorksiteSearchQuery = searchQueryInput ? searchQueryInput.value : state.managementWorksiteSearchQuery || "";
      setManagementWorksiteDraft({
        addressLine1: addressInput ? addressInput.value : state.managementWorksiteDraft.addressLine1,
        geofenceRadiusMeters: Number.isFinite(Number(radiusInput?.value)) ? Number(radiusInput.value) : state.managementWorksiteDraft.geofenceRadiusMeters,
        lat: Number.isFinite(Number(latInput?.value)) ? Number(latInput.value) : state.managementWorksiteDraft.lat,
        lng: Number.isFinite(Number(lngInput?.value)) ? Number(lngInput.value) : state.managementWorksiteDraft.lng,
        mapMetadataJson: metadataInput ? metadataInput.value : state.managementWorksiteDraft.mapMetadataJson,
        name: nameInput ? nameInput.value : state.managementWorksiteDraft.name,
        primaryUnitId: unitSelect ? unitSelect.value : state.managementWorksiteDraft.primaryUnitId,
        siteId: siteIdInput ? siteIdInput.value : state.managementWorksiteDraft.siteId,
      });

      return state.managementWorksiteDraft;
    }

    function formatManagementCoordinate(value, digits = 7) {
      const number = Number(value);
      return Number.isFinite(number) ? number.toFixed(digits) : "";
    }

    function updateManagementWorksiteFormFields() {
      const draft = state.managementWorksiteDraft || createEmptyManagementWorksiteDraft();
      const coordinateLabel = document.getElementById("management-worksite-map-coords");
      const radiusLabel = document.getElementById("management-worksite-map-radius");
      const latInput = document.getElementById("management-worksite-lat");
      const lngInput = document.getElementById("management-worksite-lng");
      const radiusInput = document.getElementById("management-worksite-radius");
      const addressInput = document.getElementById("management-worksite-address");
      const nameInput = document.getElementById("management-worksite-name");
      const unitSelect = document.getElementById("management-worksite-unit");
      const siteIdInput = document.getElementById("management-worksite-site-id");
      const metadataInput = document.getElementById("management-worksite-map-metadata");

      if (latInput) {
        latInput.value = formatManagementCoordinate(draft.lat);
      }

      if (lngInput) {
        lngInput.value = formatManagementCoordinate(draft.lng);
      }

      if (radiusInput) {
        radiusInput.value = String(Math.max(20, Number(draft.geofenceRadiusMeters || 100)));
      }

      if (addressInput) {
        addressInput.value = draft.addressLine1 || "";
      }

      if (nameInput && !nameInput.matches(":focus")) {
        nameInput.value = draft.name || "";
      }

      if (unitSelect) {
        unitSelect.value = draft.primaryUnitId || "";
      }

      if (siteIdInput) {
        siteIdInput.value = draft.siteId || "";
      }

      if (metadataInput) {
        metadataInput.value = draft.mapMetadataJson || "";
      }

      if (coordinateLabel) {
        coordinateLabel.textContent = `${formatManagementCoordinate(draft.lat, 6)}, ${formatManagementCoordinate(draft.lng, 6)}`;
      }

      if (radiusLabel) {
        radiusLabel.textContent = `${Math.max(20, Number(draft.geofenceRadiusMeters || 100))}m`;
      }
    }

    function getManagementWorksitePlaceName(place = {}) {
      const candidates = [
        place?.name,
        place?.address?.amenity,
        place?.address?.shop,
        place?.address?.building,
        place?.address?.road,
        String(place?.displayName || "").split(",")[0],
      ];

      return candidates.map((value) => String(value || "").trim()).find(Boolean) || "새 근무지";
    }

    function getManagementWorksiteCountryCode(mapMetadata = {}) {
      const candidates = [
        mapMetadata?.address?.country_code,
        mapMetadata?.country_code,
      ];
      const normalized = candidates
        .map((value) => String(value || "").trim())
        .find((value) => /^[A-Za-z]{2}$/.test(value));

      return normalized ? normalized.toUpperCase() : "KR";
    }

    return Object.freeze({
      createEmptyManagementWorksiteDraft,
      createManagementWorksiteDraftFromSite,
      formatManagementCoordinate,
      getDefaultWorksiteCoords,
      getManagementWorksiteById,
      getManagementWorksiteCountryCode,
      getManagementWorksitePlaceName,
      serializeManagementMapMetadata,
      setManagementWorksiteDraft,
      syncManagementWorksiteDraftFromDom,
      updateManagementWorksiteFormFields,
    });
  }

  return Object.freeze({ create });
});
