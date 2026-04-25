(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerSharedWorkspace = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      currentPage,
      currentYear,
      escapeAttribute,
      escapeHtml,
      pageHandlers,
      renderers,
      runtimeContext,
    } = dependencies;

    if (
      !api
      || !pageHandlers
      || !renderers
      || !runtimeContext
      || typeof escapeAttribute !== "function"
      || typeof escapeHtml !== "function"
    ) {
      throw new Error("WorkMateControllerSharedWorkspace requires shared workspace dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-shared-workspace.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const {
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridTableState,
      createDefaultDashboardGridState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      formatLocalDateKey,
      resetManagementHolidayState,
      state,
    } = runtimeContext;

    const tableFilterControllerModule = resolve(
      runtime,
      "WorkMateTableFilterController",
      "../controllers/table-filter-controller.js",
      "client/controllers/table-filter-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const tableFilterController = tableFilterControllerModule.create({
      escapeAttribute,
      escapeHtml,
    });
    const {
      filterTableFilterOptionValues,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      syncTableCheckboxFilterMenuSelectionState,
    } = tableFilterController;

    const scheduleFilterControllerModule = resolve(
      runtime,
      "WorkMateScheduleFilterController",
      "../controllers/schedule-filter-controller.js",
      "client/controllers/schedule-filter-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const scheduleFilterController = scheduleFilterControllerModule.create({
      escapeAttribute,
      filterTableFilterOptionValues,
      formatLocalDateKey,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      renderWorkspacePage: (...args) => pageHandlers.renderWorkspacePage(...args),
      state,
      syncTableCheckboxFilterMenuSelectionState,
    });
    const scheduleMethods = (({
      adjustAttendanceCursor,
      adjustReportCursor,
      adjustScheduleCursor,
      closeScheduleUserFilter,
      expandScheduleMonthDate,
      refreshScheduleUserFilterMenu,
      resetScheduleUserFilter,
      selectScheduleUserFilterSearchResults,
      setScheduleUserFilterValue,
      setScheduleVisibleUserFilterValues,
      toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter,
    }) => ({
      adjustAttendanceCursor,
      adjustReportCursor,
      adjustScheduleCursor,
      closeScheduleUserFilter,
      expandScheduleMonthDate,
      refreshScheduleUserFilterMenu,
      resetScheduleUserFilter,
      selectScheduleUserFilterSearchResults,
      setScheduleUserFilterValue,
      setScheduleVisibleUserFilterValues,
      toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter,
    }))(scheduleFilterController);

    const workspaceDataControllerModule = resolve(
      runtime,
      "WorkMateWorkspaceDataController",
      "../controllers/workspace-data-controller.js",
      "client/controllers/workspace-data-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const workspaceDataController = workspaceDataControllerModule.create({
      CURRENT_YEAR: currentYear,
      api,
      createDefaultAttendanceRecordsState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      renderers,
      resetManagementHolidayState,
      state,
    });

    const dashboardGridControllerModule = resolve(
      runtime,
      "WorkMateDashboardGridController",
      "../controllers/dashboard-grid-controller.js",
      "client/controllers/dashboard-grid-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const dashboardGridController = dashboardGridControllerModule.create({
      createDefaultDashboardGridState,
      createDefaultDashboardGridTableState,
      currentPage,
      escapeAttribute,
      filterTableFilterOptionValues,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      renderWorkspacePage: (...args) => pageHandlers.renderWorkspacePage(...args),
      state,
      syncTableCheckboxFilterMenuSelectionState,
    });
    const dashboardGridMethods = (({
      clearAllDashboardGridFilters,
      clearDashboardGridFilter,
      closeAllDashboardGridPageSizeMenus,
      closeDashboardDetailModal,
      closeDashboardGridFilterMenu,
      closeDashboardSummaryModal,
      moveDashboardGridPage,
      openDashboardDetailModal,
      openDashboardGridFilterMenu,
      openDashboardSummaryModal,
      refreshDashboardGridFilterMenu,
      removeDashboardGridFilterValue,
      selectDashboardGridFilterSearchResults,
      setDashboardGridPage,
      setDashboardGridPageSize,
      syncDashboardGridUiState,
      syncWorkspaceOverlayState,
      toggleDashboardGridFilterValue,
      toggleDashboardGridPageSizeMenu,
      toggleDashboardGridSort,
      toggleDashboardGridVisibleFilterValues,
    }) => ({
      clearAllDashboardGridFilters,
      clearDashboardGridFilter,
      closeAllDashboardGridPageSizeMenus,
      closeDashboardDetailModal,
      closeDashboardGridFilterMenu,
      closeDashboardSummaryModal,
      moveDashboardGridPage,
      openDashboardDetailModal,
      openDashboardGridFilterMenu,
      openDashboardSummaryModal,
      refreshDashboardGridFilterMenu,
      removeDashboardGridFilterValue,
      selectDashboardGridFilterSearchResults,
      setDashboardGridPage,
      setDashboardGridPageSize,
      syncDashboardGridUiState,
      syncWorkspaceOverlayState,
      toggleDashboardGridFilterValue,
      toggleDashboardGridPageSizeMenu,
      toggleDashboardGridSort,
      toggleDashboardGridVisibleFilterValues,
    }))(dashboardGridController);

    return Object.freeze({
      ...dashboardGridMethods,
      ...scheduleMethods,
      loadAttendanceRecordsData: workspaceDataController.loadAttendanceRecordsData,
      loadManagementHolidayData: workspaceDataController.loadManagementHolidayData,
      loadReportRecordsData: workspaceDataController.loadReportRecordsData,
      loadScheduleCalendarData: workspaceDataController.loadScheduleCalendarData,
    });
  }

  return Object.freeze({ create });
});
