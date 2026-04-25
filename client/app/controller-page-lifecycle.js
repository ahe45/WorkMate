(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerPageLifecycle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      currentYear,
      navigationModule,
      renderers,
      runtimeContext,
      sharedControllers,
      shellController,
    } = dependencies;

    if (!api || !appConfig || !navigationModule || !renderers || !runtimeContext || !sharedControllers || !shellController) {
      throw new Error("WorkMateControllerPageLifecycle requires page lifecycle dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-page-lifecycle.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const {
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      createEmptyManagementHolidayDraft,
      elements,
      formatLocalDateKey,
      state,
    } = runtimeContext;

    const appLifecycleControllerModule = resolve(
      runtime,
      "WorkMateAppLifecycleController",
      "../controllers/app-lifecycle-controller.js",
      "client/controllers/app-lifecycle-controller.js must be loaded before client/app/page-bootstrap.js.",
    );

    return appLifecycleControllerModule.create({
      api,
      appConfig,
      closeAllDashboardGridPageSizeMenus: sharedControllers.closeAllDashboardGridPageSizeMenus,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      createEmptyManagementHolidayDraft,
      currentPage,
      CURRENT_YEAR: currentYear,
      elements,
      findCompanyByCode: shellController.findCompanyByCode,
      formatLocalDateKey,
      getSelectedCompany: shellController.getSelectedCompany,
      loadAttendanceRecordsData: sharedControllers.loadAttendanceRecordsData,
      loadManagementHolidayData: sharedControllers.loadManagementHolidayData,
      loadReportRecordsData: sharedControllers.loadReportRecordsData,
      loadScheduleCalendarData: sharedControllers.loadScheduleCalendarData,
      navigateTo: shellController.navigateTo,
      navigationModule,
      normalizeManagementSection: sharedControllers.normalizeManagementSection,
      persistSelectedOrganizationId: shellController.persistSelectedOrganizationId,
      renderers,
      setLoading: shellController.setLoading,
      state,
      syncDashboardGridUiState: sharedControllers.syncDashboardGridUiState,
      syncManagementWorksiteMapUi: sharedControllers.syncManagementWorksiteMapUi,
      syncWorkspaceOverlayState: sharedControllers.syncWorkspaceOverlayState,
      updatePersonalScopeToggle: shellController.updatePersonalScopeToggle,
      updateTopbar: shellController.updateTopbar,
      updateUserMeta: shellController.updateUserMeta,
    });
  }

  return Object.freeze({ create });
});
