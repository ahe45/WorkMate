(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementControllerComposition = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementHolidayDraft,
      createDefaultManagementJobTitleDraft,
      createDefaultManagementUnitDraft,
      createDefaultManagementWorksiteDraft,
      createEmptyManagementHolidayDraft,
      currentPage,
      CURRENT_YEAR,
      DEFAULT_WORKSITE_COORDS,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      loadManagementHolidayData,
      normalizeManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      SOUTH_KOREA_VIEWBOX,
      state,
    } = dependencies;

    if (!api || typeof normalizeManagementSection !== "function" || !state) {
      throw new Error("WorkMateManagementControllerComposition requires management controller dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/management-controller-composition.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const managementWorksiteControllerModule = resolve(
      runtime,
      "WorkMateManagementWorksiteController",
      "./management-worksite-controller.js",
      "client/controllers/management-worksite-controller.js must be loaded before client/controllers/management-controller-composition.js.",
    );
    const managementUnitControllerModule = resolve(
      runtime,
      "WorkMateManagementUnitController",
      "./management-unit-controller.js",
      "client/controllers/management-unit-controller.js must be loaded before client/controllers/management-controller-composition.js.",
    );
    const managementJobTitleControllerModule = resolve(
      runtime,
      "WorkMateManagementJobTitleController",
      "./management-job-title-controller.js",
      "client/controllers/management-job-title-controller.js must be loaded before client/controllers/management-controller-composition.js.",
    );
    const managementHolidayControllerModule = resolve(
      runtime,
      "WorkMateManagementHolidayController",
      "./management-holiday-controller.js",
      "client/controllers/management-holiday-controller.js must be loaded before client/controllers/management-controller-composition.js.",
    );

    const managementWorksiteController = managementWorksiteControllerModule.create({
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
    });
    const managementUnitController = managementUnitControllerModule.create({
      api,
      createDefaultManagementUnitDraft,
      refreshWorkspaceData,
      renderWorkspacePage,
      state,
    });
    const managementJobTitleController = managementJobTitleControllerModule.create({
      api,
      createDefaultManagementJobTitleDraft,
      currentPage,
      normalizeManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      state,
    });
    const managementHolidayController = managementHolidayControllerModule.create({
      api,
      createDefaultManagementHolidayDraft,
      createEmptyManagementHolidayDraft,
      CURRENT_YEAR,
      loadManagementHolidayData,
      renderWorkspacePage,
      state,
    });

    return Object.freeze({
      ...managementWorksiteController,
      ...managementUnitController,
      ...managementJobTitleController,
      ...managementHolidayController,
    });
  }

  return Object.freeze({ create });
});
