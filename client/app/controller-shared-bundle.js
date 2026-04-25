(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerSharedBundle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const { currentPage } = dependencies;
    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-shared-bundle.js.");
    }

    const noopAsync = async () => {};
    const noopFalse = () => false;
    const normalizeManagementSection = (value = "") => String(value || "").trim();
    const pageHandlers = {
      refreshWorkspaceData: async () => {},
      renderWorkspacePage: () => {},
    };

    function setPageHandlers(nextHandlers = {}) {
      if (typeof nextHandlers.refreshWorkspaceData === "function") {
        pageHandlers.refreshWorkspaceData = nextHandlers.refreshWorkspaceData;
      }

      if (typeof nextHandlers.renderWorkspacePage === "function") {
        pageHandlers.renderWorkspacePage = nextHandlers.renderWorkspacePage;
      }
    }

    if (currentPage !== "workspace") {
      const noopSharedMethodNames = [
        "adjustAttendanceCursor",
        "adjustReportCursor",
        "adjustScheduleCursor",
        "clearAllDashboardGridFilters",
        "clearDashboardGridFilter",
        "closeDashboardDetailModal",
        "closeDashboardGridFilterMenu",
        "closeDashboardSummaryModal",
        "closeManagementHolidayModal",
        "closeManagementJobTitleModal",
        "closeManagementUnitModal",
        "closeManagementWorkPolicyTimePickers",
        "closeManagementWorksiteModal",
        "closeScheduleUserFilter",
        "deleteManagementHoliday",
        "deleteManagementJobTitle",
        "deleteManagementUnit",
        "deleteManagementWorksite",
        "expandScheduleMonthDate",
        "handleManagementJobTitleDragEnd",
        "handleManagementJobTitleDragOver",
        "handleManagementJobTitleDragStart",
        "handleManagementJobTitleDrop",
        "handleManagementWorkPolicyTimeOptionClick",
        "loadAttendanceRecordsData",
        "loadManagementHolidayData",
        "loadReportRecordsData",
        "loadScheduleCalendarData",
        "moveDashboardGridPage",
        "openDashboardDetailModal",
        "openDashboardGridFilterMenu",
        "openDashboardSummaryModal",
        "openManagementHolidayModal",
        "openManagementJobTitleModal",
        "openManagementUnitEditModal",
        "openManagementUnitModal",
        "openManagementWorksiteModal",
        "refreshDashboardGridFilterMenu",
        "refreshScheduleUserFilterMenu",
        "removeDashboardGridFilterValue",
        "resetManagementHolidayDraft",
        "resetManagementJobTitleDraft",
        "resetManagementUnitDraft",
        "resetManagementWorksiteDraft",
        "resetScheduleUserFilter",
        "searchManagementWorksiteLocations",
        "selectDashboardGridFilterSearchResults",
        "selectManagementWorksiteSearchResult",
        "selectScheduleUserFilterSearchResults",
        "setDashboardGridPage",
        "setDashboardGridPageSize",
        "setManagementJobTitleDescendantsChecked",
        "setManagementWorkPolicyTimePickerOpen",
        "setScheduleUserFilterValue",
        "setScheduleVisibleUserFilterValues",
        "submitManagementHolidayForm",
        "submitManagementJobTitleForm",
        "submitManagementUnitForm",
        "submitManagementWorkPolicyForm",
        "submitManagementWorksiteForm",
        "syncDashboardGridUiState",
        "syncManagementJobTitleTreeState",
        "syncManagementWorksiteDraftFromDom",
        "syncManagementWorksiteMapGeometry",
        "syncManagementWorksiteMapUi",
        "syncWorkspaceOverlayState",
        "toggleDashboardGridFilterValue",
        "toggleDashboardGridPageSizeMenu",
        "toggleDashboardGridSort",
        "toggleDashboardGridVisibleFilterValues",
        "toggleScheduleMonthAllEntries",
        "toggleScheduleUserFilter",
        "updateManagementWorkPolicyStageMetrics",
        "updateManagementWorksiteFormFields",
      ];
      const noopControllers = Object.fromEntries(noopSharedMethodNames.map((name) => [name, noopAsync]));

      return Object.freeze({
        ...noopControllers,
        closeAllDashboardGridPageSizeMenus: noopFalse,
        isWorkspaceGridContext: noopFalse,
        normalizeManagementSection,
        setPageHandlers,
      });
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const workspaceSharedModule = resolve(
      runtime,
      "WorkMateControllerSharedWorkspace",
      "./controller-shared-workspace.js",
      "client/app/controller-shared-workspace.js must be loaded before client/app/controller-shared-bundle.js.",
    );
    const managementSharedModule = resolve(
      runtime,
      "WorkMateControllerSharedManagement",
      "./controller-shared-management.js",
      "client/app/controller-shared-management.js must be loaded before client/app/controller-shared-bundle.js.",
    );
    const workspaceMethods = workspaceSharedModule.create({
      ...dependencies,
      pageHandlers,
    });
    const managementMethods = managementSharedModule.create({
      ...dependencies,
      loadManagementHolidayData: workspaceMethods.loadManagementHolidayData,
      pageHandlers,
    });

    return Object.freeze({
      ...managementMethods,
      ...workspaceMethods,
      setPageHandlers,
    });
  }

  return Object.freeze({ create });
});
