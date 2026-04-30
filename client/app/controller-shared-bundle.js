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
        "captureManagementModalSnapshot",
        "closeDashboardDetailModal",
        "closeDashboardGridFilterMenu",
        "closeDashboardSummaryModal",
        "closeManagementEmployeeDeleteConfirmModal",
        "closeManagementEmployeeExcelModal",
        "closeManagementEmployeeInviteChannelModal",
        "closeManagementEmployeeModal",
        "closeManagementHolidayModal",
        "closeManagementJobTitleModal",
        "closeManagementModalConfirm",
        "closeManagementWorkPolicyModal",
        "closeManagementUnitModal",
        "closeManagementWorkPolicyTimePickers",
        "closeManagementWorksiteModal",
        "closeScheduleUserFilter",
        "deleteManagementHoliday",
        "deleteManagementJobTitle",
        "deleteManagementWorkPolicy",
        "deleteManagementUnit",
        "deleteManagementWorksite",
        "downloadManagementEmployeeCardFile",
        "downloadManagementEmployeeExcelTemplate",
        "expandScheduleMonthDate",
        "getActiveManagementModalType",
        "handleManagementJobTitleDragEnd",
        "handleManagementJobTitleDragOver",
        "handleManagementJobTitleDragStart",
        "handleManagementJobTitleDrop",
        "handleManagementEmployeeCardFileChange",
        "handleManagementEmployeeCardFileDrop",
        "handleManagementEmployeeExcelFileChange",
        "handleManagementModalConfirmAction",
        "handleManagementWorkPolicyTimeOptionClick",
        "loadAttendanceRecordsData",
        "loadManagementHolidayData",
        "loadReportRecordsData",
        "loadScheduleCalendarData",
        "moveDashboardGridPage",
        "openDashboardDetailModal",
        "openDashboardGridFilterMenu",
        "openDashboardSummaryModal",
        "openManagementEmployeeDeleteConfirmModal",
        "openManagementEmployeeExcelModal",
        "openManagementEmployeeInviteChannelModal",
        "openManagementEmployeeModal",
        "openManagementHolidayModal",
        "openManagementJobTitleModal",
        "openManagementWorkPolicyModal",
        "openManagementUnitEditModal",
        "openManagementUnitModal",
        "openManagementWorksiteModal",
        "refreshDashboardGridFilterMenu",
        "refreshScheduleUserFilterMenu",
        "removeDashboardGridFilterValue",
        "resetManagementEmployeeDraft",
        "resetManagementHolidayDraft",
        "resetManagementJobTitleDraft",
        "resetManagementWorkPolicyDraft",
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
        "runWithManagementModalGuard",
        "setScheduleUserFilterValue",
        "setScheduleVisibleUserFilterValues",
        "submitManagementEmployeeExcelUpload",
        "submitManagementEmployeeDraftForm",
        "submitManagementEmployeeDelete",
        "submitManagementEmployeePreferredForm",
        "submitManagementEmployeeInviteForm",
        "submitManagementEmployeeSaveForm",
        "submitManagementHolidayForm",
        "submitManagementJobTitleForm",
        "submitManagementUnitForm",
        "submitManagementWorkPolicyForm",
        "submitManagementWorksiteForm",
        "syncManagementEmployeeActionButtons",
        "syncManagementEmployeeJobTitleOptions",
        "syncDashboardGridUiState",
        "syncManagementJobTitleTreeState",
        "syncManagementModalDirtyState",
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
        "updateManagementEmployeePhoneInput",
        "validateManagementEmployeeField",
        "validateManagementEmployeeFormFields",
        "updateManagementWorkPolicyStageMetrics",
        "updateManagementWorksiteFormFields",
      ];
      const noopControllers = Object.fromEntries(noopSharedMethodNames.map((name) => [name, noopAsync]));
      const runWithManagementModalGuard = async (onProceed) => {
        if (typeof onProceed === "function") {
          await onProceed();
        }
      };

      return Object.freeze({
        ...noopControllers,
        closeAllDashboardGridPageSizeMenus: noopFalse,
        isWorkspaceGridContext: noopFalse,
        normalizeManagementSection,
        runWithManagementModalGuard,
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
