(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerPageBindings = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      currentYear,
      renderers,
      runtimeContext,
      sharedControllers,
      shellController,
      lifecycleController,
    } = dependencies;

    if (!api || !appConfig || !renderers || !runtimeContext || !sharedControllers || !shellController || !lifecycleController) {
      throw new Error("WorkMateControllerPageBindings requires page binding dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-page-bindings.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const {
      elements,
      setInlineMessage,
      state,
    } = runtimeContext;

    const appFormControllerModule = resolve(
      runtime,
      "WorkMateAppFormController",
      "../controllers/app-form-controller.js",
      "client/controllers/app-form-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const appFormController = appFormControllerModule.create({
      api,
      appConfig,
      currentPage,
      elements,
      handleProtectedFailure: lifecycleController.handleProtectedFailure,
      loadCompanies: lifecycleController.loadCompanies,
      navigateTo: shellController.navigateTo,
      persistSelectedOrganizationId: shellController.persistSelectedOrganizationId,
      refreshWorkspaceData: lifecycleController.refreshWorkspaceData,
      renderCompaniesPage: lifecycleController.renderCompaniesPage,
      renderers,
      searchManagementWorksiteLocations: sharedControllers.searchManagementWorksiteLocations,
      setInlineMessage,
      state,
      submitClock: lifecycleController.submitClock,
      submitManagementHolidayForm: sharedControllers.submitManagementHolidayForm,
      submitManagementJobTitleForm: sharedControllers.submitManagementJobTitleForm,
      submitManagementUnitForm: sharedControllers.submitManagementUnitForm,
      submitManagementWorkPolicyForm: sharedControllers.submitManagementWorkPolicyForm,
      submitManagementWorksiteForm: sharedControllers.submitManagementWorksiteForm,
      syncManagementWorksiteDraftFromDom: sharedControllers.syncManagementWorksiteDraftFromDom,
      updateUserMeta: shellController.updateUserMeta,
      closeAccountSettingsModal: shellController.closeAccountSettingsModal,
      closeCompanyCreateModal: shellController.closeCompanyCreateModal,
      closeCompanySettingsModal: shellController.closeCompanySettingsModal,
    });

    const appInteractionControllerModule = resolve(
      runtime,
      "WorkMateAppInteractionController",
      "../controllers/app-interaction-controller.js",
      "client/controllers/app-interaction-controller.js must be loaded before client/app/page-bootstrap.js.",
    );
    const appInteractionController = appInteractionControllerModule.create({
      api,
      appConfig,
      clearAllDashboardGridFilters: sharedControllers.clearAllDashboardGridFilters,
      clearDashboardGridFilter: sharedControllers.clearDashboardGridFilter,
      closeAccountSettingsModal: shellController.closeAccountSettingsModal,
      closeAllDashboardGridPageSizeMenus: sharedControllers.closeAllDashboardGridPageSizeMenus,
      closeCompanyCreateModal: shellController.closeCompanyCreateModal,
      closeCompanySettingsModal: shellController.closeCompanySettingsModal,
      closeDashboardDetailModal: sharedControllers.closeDashboardDetailModal,
      closeDashboardGridFilterMenu: sharedControllers.closeDashboardGridFilterMenu,
      closeDashboardSummaryModal: sharedControllers.closeDashboardSummaryModal,
      closeManagementHolidayModal: sharedControllers.closeManagementHolidayModal,
      closeManagementJobTitleModal: sharedControllers.closeManagementJobTitleModal,
      closeManagementUnitModal: sharedControllers.closeManagementUnitModal,
      closeManagementWorkPolicyTimePickers: sharedControllers.closeManagementWorkPolicyTimePickers,
      closeManagementWorksiteModal: sharedControllers.closeManagementWorksiteModal,
      closeScheduleUserFilter: sharedControllers.closeScheduleUserFilter,
      closeSidebar: shellController.closeSidebar,
      currentPage,
      CURRENT_YEAR: currentYear,
      deleteManagementHoliday: sharedControllers.deleteManagementHoliday,
      deleteManagementJobTitle: sharedControllers.deleteManagementJobTitle,
      deleteManagementUnit: sharedControllers.deleteManagementUnit,
      deleteManagementWorksite: sharedControllers.deleteManagementWorksite,
      elements,
      expandScheduleMonthDate: sharedControllers.expandScheduleMonthDate,
      findCompanyByCode: shellController.findCompanyByCode,
      getAccountSettingsModal: shellController.getAccountSettingsModal,
      getCompanyCreateModal: shellController.getCompanyCreateModal,
      getCompanySettingsModal: shellController.getCompanySettingsModal,
      handleManagementJobTitleDragEnd: sharedControllers.handleManagementJobTitleDragEnd,
      handleManagementJobTitleDragOver: sharedControllers.handleManagementJobTitleDragOver,
      handleManagementJobTitleDragStart: sharedControllers.handleManagementJobTitleDragStart,
      handleManagementJobTitleDrop: sharedControllers.handleManagementJobTitleDrop,
      handleManagementWorkPolicyTimeOptionClick: sharedControllers.handleManagementWorkPolicyTimeOptionClick,
      handleProtectedFailure: lifecycleController.handleProtectedFailure,
      initWorkspacePage: lifecycleController.initWorkspacePage,
      isWorkspaceGridContext: sharedControllers.isWorkspaceGridContext,
      loadAttendanceRecordsData: sharedControllers.loadAttendanceRecordsData,
      loadManagementHolidayData: sharedControllers.loadManagementHolidayData,
      loadReportRecordsData: sharedControllers.loadReportRecordsData,
      loadScheduleCalendarData: sharedControllers.loadScheduleCalendarData,
      logout: lifecycleController.logout,
      moveDashboardGridPage: sharedControllers.moveDashboardGridPage,
      navigateTo: shellController.navigateTo,
      navigateToWorkspaceView: lifecycleController.navigateToWorkspaceView,
      normalizeManagementSection: sharedControllers.normalizeManagementSection,
      openAccountSettingsModal: shellController.openAccountSettingsModal,
      openCompanyCreateModal: shellController.openCompanyCreateModal,
      openCompanySettingsModal: shellController.openCompanySettingsModal,
      openDashboardDetailModal: sharedControllers.openDashboardDetailModal,
      openDashboardGridFilterMenu: sharedControllers.openDashboardGridFilterMenu,
      openDashboardSummaryModal: sharedControllers.openDashboardSummaryModal,
      openManagementHolidayModal: sharedControllers.openManagementHolidayModal,
      openManagementJobTitleModal: sharedControllers.openManagementJobTitleModal,
      openManagementUnitEditModal: sharedControllers.openManagementUnitEditModal,
      openManagementUnitModal: sharedControllers.openManagementUnitModal,
      openManagementWorksiteModal: sharedControllers.openManagementWorksiteModal,
      persistSelectedOrganizationId: shellController.persistSelectedOrganizationId,
      refreshDashboardGridFilterMenu: sharedControllers.refreshDashboardGridFilterMenu,
      refreshScheduleUserFilterMenu: sharedControllers.refreshScheduleUserFilterMenu,
      refreshWorkspaceData: lifecycleController.refreshWorkspaceData,
      removeDashboardGridFilterValue: sharedControllers.removeDashboardGridFilterValue,
      renderWorkspacePage: lifecycleController.renderWorkspacePage,
      renderers,
      resetManagementHolidayDraft: sharedControllers.resetManagementHolidayDraft,
      resetManagementJobTitleDraft: sharedControllers.resetManagementJobTitleDraft,
      resetManagementUnitDraft: sharedControllers.resetManagementUnitDraft,
      resetManagementWorksiteDraft: sharedControllers.resetManagementWorksiteDraft,
      resetScheduleUserFilter: sharedControllers.resetScheduleUserFilter,
      selectDashboardGridFilterSearchResults: sharedControllers.selectDashboardGridFilterSearchResults,
      selectManagementWorksiteSearchResult: sharedControllers.selectManagementWorksiteSearchResult,
      selectScheduleUserFilterSearchResults: sharedControllers.selectScheduleUserFilterSearchResults,
      setDashboardGridPage: sharedControllers.setDashboardGridPage,
      setDashboardGridPageSize: sharedControllers.setDashboardGridPageSize,
      setManagementJobTitleDescendantsChecked: sharedControllers.setManagementJobTitleDescendantsChecked,
      setManagementWorkPolicyTimePickerOpen: sharedControllers.setManagementWorkPolicyTimePickerOpen,
      setPersonalScopeEnabled: shellController.setPersonalScopeEnabled,
      setScheduleUserFilterValue: sharedControllers.setScheduleUserFilterValue,
      setLoading: shellController.setLoading,
      setVisibleScheduleUserFilterValues: sharedControllers.setScheduleVisibleUserFilterValues,
      state,
      submitClock: lifecycleController.submitClock,
      syncManagementJobTitleTreeState: sharedControllers.syncManagementJobTitleTreeState,
      syncManagementWorksiteDraftFromDom: sharedControllers.syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry: sharedControllers.syncManagementWorksiteMapGeometry,
      toggleDashboardGridFilterValue: sharedControllers.toggleDashboardGridFilterValue,
      toggleDashboardGridPageSizeMenu: sharedControllers.toggleDashboardGridPageSizeMenu,
      toggleDashboardGridSort: sharedControllers.toggleDashboardGridSort,
      toggleDashboardGridVisibleFilterValues: sharedControllers.toggleDashboardGridVisibleFilterValues,
      toggleScheduleMonthAllEntries: sharedControllers.toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter: sharedControllers.toggleScheduleUserFilter,
      updateManagementWorkPolicyStageMetrics: sharedControllers.updateManagementWorkPolicyStageMetrics,
      updateManagementWorksiteFormFields: sharedControllers.updateManagementWorksiteFormFields,
      adjustAttendanceCursor: sharedControllers.adjustAttendanceCursor,
      adjustReportCursor: sharedControllers.adjustReportCursor,
      adjustScheduleCursor: sharedControllers.adjustScheduleCursor,
    });

    function bindHandlers() {
      appFormController.bindFormHandlers();
      appInteractionController.bindInteractionHandlers();
    }

    return Object.freeze({
      bindHandlers,
    });
  }

  return Object.freeze({ create });
});
