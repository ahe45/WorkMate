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

    return Object.freeze({
      ...draftController,
      ...searchController,
      ...mapController,
      ...actionController,
    });
  }

  return Object.freeze({ create });
});
