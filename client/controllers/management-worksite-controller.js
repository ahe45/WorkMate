(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksiteController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementWorksiteDraft,
      currentPage,
      DEFAULT_WORKSITE_COORDS,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      normalizeManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      SOUTH_KOREA_VIEWBOX,
      state,
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementWorksiteDraft !== "function"
      || typeof normalizeManagementSection !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementWorksiteController requires worksite dependencies.");
    }

    let managementWorksiteDragState = {
      draggedId: "",
      overId: "",
      position: "",
    };

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/management-worksite-controller.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const draftControllerModule = resolve(
      runtime,
      "WorkMateManagementWorksiteDraftController",
      "./management-worksite-draft.js",
      "client/controllers/management-worksite-draft.js must be loaded before client/controllers/management-worksite-controller.js.",
    );
    const searchControllerModule = resolve(
      runtime,
      "WorkMateManagementWorksiteSearchController",
      "./management-worksite-search.js",
      "client/controllers/management-worksite-search.js must be loaded before client/controllers/management-worksite-controller.js.",
    );
    const mapControllerModule = resolve(
      runtime,
      "WorkMateManagementWorksiteMapController",
      "./management-worksite-map.js",
      "client/controllers/management-worksite-map.js must be loaded before client/controllers/management-worksite-controller.js.",
    );
    const actionControllerModule = resolve(
      runtime,
      "WorkMateManagementWorksiteActionController",
      "./management-worksite-actions.js",
      "client/controllers/management-worksite-actions.js must be loaded before client/controllers/management-worksite-controller.js.",
    );

    const draftController = draftControllerModule.create({
      createDefaultManagementWorksiteDraft,
      currentPage,
      DEFAULT_WORKSITE_COORDS,
      state,
    });
    const searchController = searchControllerModule.create({
      SOUTH_KOREA_VIEWBOX,
      getManagementWorksiteCountryCode: draftController.getManagementWorksiteCountryCode,
      getManagementWorksitePlaceName: draftController.getManagementWorksitePlaceName,
      renderWorkspacePage,
      serializeManagementMapMetadata: draftController.serializeManagementMapMetadata,
      setManagementWorksiteDraft: draftController.setManagementWorksiteDraft,
      state,
      updateManagementWorksiteFormFields: draftController.updateManagementWorksiteFormFields,
    });
    const mapController = mapControllerModule.create({
      createEmptyManagementWorksiteDraft: draftController.createEmptyManagementWorksiteDraft,
      currentPage,
      DEFAULT_WORKSITE_COORDS,
      getDefaultWorksiteCoords: draftController.getDefaultWorksiteCoords,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      normalizeManagementSection,
      reverseGeocodeManagementWorksite: searchController.reverseGeocodeManagementWorksite,
      setManagementWorksiteDraft: draftController.setManagementWorksiteDraft,
      state,
      syncManagementWorksiteDraftFromDom: draftController.syncManagementWorksiteDraftFromDom,
      updateManagementWorksiteFormFields: draftController.updateManagementWorksiteFormFields,
    });
    const actionController = actionControllerModule.create({
      api,
      createEmptyManagementWorksiteDraft: draftController.createEmptyManagementWorksiteDraft,
      createManagementWorksiteDraftFromSite: draftController.createManagementWorksiteDraftFromSite,
      getManagementWorksiteById: draftController.getManagementWorksiteById,
      getManagementWorksiteCountryCode: draftController.getManagementWorksiteCountryCode,
      refreshWorkspaceData,
      renderWorkspacePage,
      setManagementWorksiteDraft: draftController.setManagementWorksiteDraft,
      state,
      syncManagementWorksiteDraftFromDom: draftController.syncManagementWorksiteDraftFromDom,
    });

    function isManagementWorksiteReorderContext() {
      return currentPage === "workspace"
        && state.currentWorkspaceView === "management"
        && normalizeManagementSection(state.managementSection) === "worksites";
    }

    function clearManagementWorksiteDragMarkers() {
      document.querySelectorAll(".workmate-worksite-grid-row.is-dragging, .workmate-worksite-grid-row.drag-before, .workmate-worksite-grid-row.drag-after").forEach((element) => {
        element.classList.remove("is-dragging", "drag-before", "drag-after");
      });
    }

    function resetManagementWorksiteDragState() {
      managementWorksiteDragState = {
        draggedId: "",
        overId: "",
        position: "",
      };
      clearManagementWorksiteDragMarkers();
    }

    function getManagementWorksiteOrderedIdsFromDom() {
      const grid = document.querySelector("[data-management-worksite-order]");
      const rawValue = String(grid?.dataset?.managementWorksiteOrder || "").trim();

      if (!rawValue) {
        return [];
      }

      return rawValue.split(",").map((value) => String(value || "").trim()).filter(Boolean);
    }

    function setManagementWorksiteDragMarker(row, position = "before") {
      if (!(row instanceof HTMLElement)) {
        clearManagementWorksiteDragMarkers();
        return;
      }

      document.querySelectorAll(".workmate-worksite-grid-row.drag-before, .workmate-worksite-grid-row.drag-after").forEach((element) => {
        if (element !== row) {
          element.classList.remove("drag-before", "drag-after");
        }
      });

      row.classList.toggle("drag-before", position === "before");
      row.classList.toggle("drag-after", position === "after");
    }

    function moveManagementWorksiteOrder(orderedIds = [], draggedId = "", targetId = "", position = "before") {
      const normalizedDraggedId = String(draggedId || "").trim();
      const normalizedTargetId = String(targetId || "").trim();
      const sourceIds = Array.from(new Set((Array.isArray(orderedIds) ? orderedIds : []).map((value) => String(value || "").trim()).filter(Boolean)));

      if (!normalizedDraggedId || !normalizedTargetId || normalizedDraggedId === normalizedTargetId) {
        return sourceIds;
      }

      const nextIds = sourceIds.filter((value) => value !== normalizedDraggedId);
      const targetIndex = nextIds.indexOf(normalizedTargetId);

      if (targetIndex < 0) {
        return sourceIds;
      }

      nextIds.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, normalizedDraggedId);
      return nextIds;
    }

    function areOrderedIdsEqual(left = [], right = []) {
      if (left.length !== right.length) {
        return false;
      }

      return left.every((value, index) => value === right[index]);
    }

    async function reorderManagementWorksites(orderedIds = []) {
      const normalizedOrderedIds = Array.from(new Set((Array.isArray(orderedIds) ? orderedIds : []).map((value) => String(value || "").trim()).filter(Boolean)));

      if (!state.selectedOrganizationId || normalizedOrderedIds.length === 0) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/sites/reorder`, {
        body: JSON.stringify({
          orderedIds: normalizedOrderedIds,
        }),
        method: "POST",
      });

      await refreshWorkspaceData();
    }

    function handleManagementWorksiteDragStart(event) {
      if (!isManagementWorksiteReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const row = event.target.closest("[data-management-worksite-row]");

      if (!(row instanceof HTMLElement)) {
        return;
      }

      const draggedId = String(row.dataset.managementWorksiteRow || "").trim();
      const orderedIds = getManagementWorksiteOrderedIdsFromDom();

      if (!draggedId || orderedIds.length < 2) {
        event.preventDefault();
        return;
      }

      managementWorksiteDragState = {
        draggedId,
        overId: "",
        position: "",
      };
      clearManagementWorksiteDragMarkers();
      row.classList.add("is-dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
      }
    }

    function handleManagementWorksiteDragOver(event) {
      if (!isManagementWorksiteReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const draggedId = String(managementWorksiteDragState.draggedId || "").trim();

      if (!draggedId) {
        return;
      }

      const row = event.target.closest("[data-management-worksite-row]");

      if (!(row instanceof HTMLElement)) {
        return;
      }

      const targetId = String(row.dataset.managementWorksiteRow || "").trim();

      if (!targetId || targetId === draggedId) {
        row.classList.remove("drag-before", "drag-after");
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      const rect = row.getBoundingClientRect();
      const position = event.clientY >= rect.top + rect.height / 2 ? "after" : "before";
      managementWorksiteDragState.overId = targetId;
      managementWorksiteDragState.position = position;
      setManagementWorksiteDragMarker(row, position);
    }

    async function handleManagementWorksiteDrop(event) {
      if (!isManagementWorksiteReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const draggedId = String(managementWorksiteDragState.draggedId || "").trim();
      const row = event.target.closest("[data-management-worksite-row]");

      if (!draggedId || !(row instanceof HTMLElement)) {
        resetManagementWorksiteDragState();
        return;
      }

      const targetId = String(row.dataset.managementWorksiteRow || "").trim();
      const position = managementWorksiteDragState.position === "after" ? "after" : "before";
      const orderedIds = getManagementWorksiteOrderedIdsFromDom();
      const nextOrderedIds = moveManagementWorksiteOrder(orderedIds, draggedId, targetId, position);
      resetManagementWorksiteDragState();
      event.preventDefault();

      if (!targetId || areOrderedIdsEqual(orderedIds, nextOrderedIds)) {
        return;
      }

      await reorderManagementWorksites(nextOrderedIds);
    }

    function handleManagementWorksiteDragEnd() {
      resetManagementWorksiteDragState();
    }

    return Object.freeze({
      ...draftController,
      ...searchController,
      ...mapController,
      ...actionController,
      areOrderedIdsEqual,
      clearManagementWorksiteDragMarkers,
      getManagementWorksiteOrderedIdsFromDom,
      handleManagementWorksiteDragEnd,
      handleManagementWorksiteDragOver,
      handleManagementWorksiteDragStart,
      handleManagementWorksiteDrop,
      isManagementWorksiteReorderContext,
      moveManagementWorksiteOrder,
      reorderManagementWorksites,
      resetManagementWorksiteDragState,
      setManagementWorksiteDragMarker,
    });
  }

  return Object.freeze({ create });
});
