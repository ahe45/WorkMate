(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksiteActionController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createEmptyManagementWorksiteDraft,
      createManagementWorksiteDraftFromSite,
      getManagementWorksiteById,
      getManagementWorksiteCountryCode,
      refreshWorkspaceData,
      renderWorkspacePage,
      setManagementWorksiteDraft,
      state,
      syncManagementWorksiteDraftFromDom,
    } = dependencies;

    if (!api || typeof createEmptyManagementWorksiteDraft !== "function" || typeof createManagementWorksiteDraftFromSite !== "function" || !state) {
      throw new Error("WorkMateManagementWorksiteActionController requires worksite action dependencies.");
    }

    function selectManagementWorksiteSearchResult(index) {
      syncManagementWorksiteDraftFromDom();
      const result = state.managementWorksiteSearchResults[Number(index)];

      if (!result) {
        return;
      }

      setManagementWorksiteDraft({
        addressLine1: result.displayName || state.managementWorksiteDraft.addressLine1,
        lat: result.lat,
        lng: result.lng,
        mapMetadataJson: result.mapMetadataJson || state.managementWorksiteDraft.mapMetadataJson,
        name: String(state.managementWorksiteDraft.name || "").trim() || result.name,
      });
      renderWorkspacePage();
    }

    function selectManagementWorksite(siteId = "") {
      const site = getManagementWorksiteById(siteId);

      if (!site) {
        return;
      }

      state.managementWorksiteDraft = createManagementWorksiteDraftFromSite(site);
      renderWorkspacePage();
    }

    function resetManagementWorksiteDraft() {
      state.managementWorksiteDraft = createEmptyManagementWorksiteDraft();
      state.managementWorksiteSearchQuery = "";
      state.managementWorksiteSearchResults = [];
      state.managementWorksiteSearchStatus = "";
      renderWorkspacePage();
    }

    function openManagementWorksiteModal(siteId = "") {
      state.managementWorksiteSearchQuery = "";
      state.managementWorksiteSearchResults = [];
      state.managementWorksiteSearchStatus = "";

      if (siteId) {
        const site = getManagementWorksiteById(siteId);

        if (site) {
          state.managementWorksiteDraft = createManagementWorksiteDraftFromSite(site);
        }
      } else {
        state.managementWorksiteDraft = createEmptyManagementWorksiteDraft();
      }

      state.managementWorksiteModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-worksite-search-query")?.focus();
      });
    }

    function closeManagementWorksiteModal() {
      if (!state.managementWorksiteModalOpen) {
        return;
      }

      state.managementWorksiteModalOpen = false;
      renderWorkspacePage();
    }

    async function submitManagementWorksiteForm() {
      syncManagementWorksiteDraftFromDom();
      const draft = state.managementWorksiteDraft || createEmptyManagementWorksiteDraft();
      let mapMetadata = {};

      try {
        mapMetadata = draft.mapMetadataJson ? JSON.parse(draft.mapMetadataJson) : {};
      } catch (error) {
        mapMetadata = {};
      }

      const payload = {
        addressLine1: String(draft.addressLine1 || "").trim() || null,
        countryCode: getManagementWorksiteCountryCode(mapMetadata),
        geofenceRadiusMeters: Math.max(20, Number(draft.geofenceRadiusMeters || 100)),
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        mapMetadataJson: mapMetadata,
        name: String(draft.name || "").trim(),
        primaryUnitId: String(draft.primaryUnitId || "").trim() || null,
        timezone: "Asia/Seoul",
      };

      if (!payload.name) {
        throw new Error("근무지명을 입력하세요.");
      }

      if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
        throw new Error("지도에서 기준 위치를 선택하세요.");
      }

      const isUpdate = Boolean(String(draft.siteId || "").trim());
      const endpoint = isUpdate
        ? `/v1/orgs/${state.selectedOrganizationId}/sites/${draft.siteId}`
        : `/v1/orgs/${state.selectedOrganizationId}/sites`;
      const method = isUpdate ? "PATCH" : "POST";
      const savedSite = await api.requestWithAutoRefresh(endpoint, {
        body: JSON.stringify(payload),
        method,
      });

      state.managementWorksiteDraft = createManagementWorksiteDraftFromSite({
        ...savedSite,
        addressLine1: savedSite?.addressLine1 || payload.addressLine1,
        geofenceRadiusMeters: savedSite?.geofenceRadiusMeters ?? payload.geofenceRadiusMeters,
        lat: savedSite?.lat ?? payload.lat,
        lng: savedSite?.lng ?? payload.lng,
        name: savedSite?.name || payload.name,
        primaryUnitId: savedSite?.primaryUnitId || payload.primaryUnitId,
      });
      state.managementWorksiteModalOpen = false;
      await refreshWorkspaceData();
    }

    async function deleteManagementWorksite(siteId = "") {
      const normalizedSiteId = String(siteId || "").trim();
      const site = getManagementWorksiteById(normalizedSiteId);

      if (!normalizedSiteId || !site) {
        return;
      }

      const confirmed = window.confirm(`"${site.name || "근무지"}"를 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/sites/${normalizedSiteId}`, {
        method: "DELETE",
      });

      if (String(state.managementWorksiteDraft?.siteId || "").trim() === normalizedSiteId) {
        state.managementWorksiteDraft = createEmptyManagementWorksiteDraft();
        state.managementWorksiteModalOpen = false;
      }

      await refreshWorkspaceData();
    }

    return Object.freeze({
      closeManagementWorksiteModal,
      deleteManagementWorksite,
      openManagementWorksiteModal,
      resetManagementWorksiteDraft,
      selectManagementWorksite,
      selectManagementWorksiteSearchResult,
      submitManagementWorksiteForm,
    });
  }

  return Object.freeze({ create });
});
