(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerSharedManagement = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      currentYear,
      loadManagementHolidayData,
      pageHandlers,
      renderers,
      runtimeContext,
    } = dependencies;

    if (!api || !appConfig || typeof loadManagementHolidayData !== "function" || !pageHandlers || !renderers || !runtimeContext) {
      throw new Error("WorkMateControllerSharedManagement requires shared management dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-shared-management.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const {
      DEFAULT_MANAGEMENT_SECTION,
      DEFAULT_WORKSITE_COORDS,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      SOUTH_KOREA_VIEWBOX,
      createDefaultManagementHolidayDraft,
      createDefaultManagementJobTitleDraft,
      createDefaultManagementWorkPolicyDraft,
      createDefaultManagementUnitDraft,
      createDefaultManagementWorksiteDraft,
      createEmptyManagementHolidayDraft,
      setInlineMessage,
      state,
    } = runtimeContext;

    const managementControllerModule = resolve(
      runtime,
      "WorkMateManagementController",
      "../controllers/management-controller.js",
      "client/controllers/management-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const managementController = managementControllerModule.create({
      api,
      appConfig,
      createDefaultManagementHolidayDraft,
      createDefaultManagementJobTitleDraft,
      createDefaultManagementUnitDraft,
      createDefaultManagementWorksiteDraft,
      createEmptyManagementHolidayDraft,
      currentPage,
      CURRENT_YEAR: currentYear,
      DEFAULT_MANAGEMENT_SECTION,
      DEFAULT_WORKSITE_COORDS,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      loadManagementHolidayData,
      refreshWorkspaceData: (...args) => pageHandlers.refreshWorkspaceData(...args),
      renderWorkspacePage: (...args) => pageHandlers.renderWorkspacePage(...args),
      SOUTH_KOREA_VIEWBOX,
      state,
    });
    const managementMethods = (({
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementUnitModal,
      closeManagementWorksiteModal,
      deleteManagementHoliday,
      deleteManagementJobTitle,
      deleteManagementUnit,
      deleteManagementWorksite,
      handleManagementJobTitleDragEnd,
      handleManagementJobTitleDragOver,
      handleManagementJobTitleDragStart,
      handleManagementJobTitleDrop,
      isWorkspaceGridContext,
      normalizeManagementSection,
      openManagementHolidayModal,
      openManagementJobTitleModal,
      openManagementUnitEditModal,
      openManagementUnitModal,
      openManagementWorksiteModal,
      resetManagementHolidayDraft,
      resetManagementJobTitleDraft,
      resetManagementUnitDraft,
      resetManagementWorksiteDraft,
      searchManagementWorksiteLocations,
      selectManagementWorksiteSearchResult,
      setManagementJobTitleDescendantsChecked,
      submitManagementHolidayForm,
      submitManagementJobTitleForm,
      submitManagementUnitForm,
      submitManagementWorksiteForm,
      syncManagementJobTitleTreeState,
      syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry,
      syncManagementWorksiteMapUi,
      updateManagementWorksiteFormFields,
    }) => ({
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementUnitModal,
      closeManagementWorksiteModal,
      deleteManagementHoliday,
      deleteManagementJobTitle,
      deleteManagementUnit,
      deleteManagementWorksite,
      handleManagementJobTitleDragEnd,
      handleManagementJobTitleDragOver,
      handleManagementJobTitleDragStart,
      handleManagementJobTitleDrop,
      isWorkspaceGridContext,
      normalizeManagementSection,
      openManagementHolidayModal,
      openManagementJobTitleModal,
      openManagementUnitEditModal,
      openManagementUnitModal,
      openManagementWorksiteModal,
      resetManagementHolidayDraft,
      resetManagementJobTitleDraft,
      resetManagementUnitDraft,
      resetManagementWorksiteDraft,
      searchManagementWorksiteLocations,
      selectManagementWorksiteSearchResult,
      setManagementJobTitleDescendantsChecked,
      submitManagementHolidayForm,
      submitManagementJobTitleForm,
      submitManagementUnitForm,
      submitManagementWorksiteForm,
      syncManagementJobTitleTreeState,
      syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry,
      syncManagementWorksiteMapUi,
      updateManagementWorksiteFormFields,
    }))(managementController);

    const workPolicyControllerModule = resolve(
      runtime,
      "WorkMateWorkPolicyController",
      "../controllers/work-policy-controller.js",
      "client/controllers/work-policy-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const workPolicyController = workPolicyControllerModule.create({
      api,
      createDefaultManagementWorkPolicyDraft,
      refreshWorkspaceData: (...args) => pageHandlers.refreshWorkspaceData(...args),
      renderWorkspacePage: (...args) => pageHandlers.renderWorkspacePage(...args),
      renderers,
      setInlineMessage,
      state,
    });
    const workPolicyMethods = (({
      closeManagementWorkPolicyModal,
      closeManagementWorkPolicyTimePickers,
      deleteManagementWorkPolicy,
      handleManagementWorkPolicyTimeOptionClick,
      openManagementWorkPolicyModal,
      resetManagementWorkPolicyDraft,
      setManagementWorkPolicyTimePickerOpen,
      submitManagementWorkPolicyForm,
      updateManagementWorkPolicyStageMetrics,
    }) => ({
      closeManagementWorkPolicyModal,
      closeManagementWorkPolicyTimePickers,
      deleteManagementWorkPolicy,
      handleManagementWorkPolicyTimeOptionClick,
      openManagementWorkPolicyModal,
      resetManagementWorkPolicyDraft,
      setManagementWorkPolicyTimePickerOpen,
      submitManagementWorkPolicyForm,
      updateManagementWorkPolicyStageMetrics,
    }))(workPolicyController);

    return Object.freeze({
      ...managementMethods,
      ...workPolicyMethods,
    });
  }

  return Object.freeze({ create });
});
