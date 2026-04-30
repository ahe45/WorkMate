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
      MANAGEMENT_SECTION_STORAGE_KEY,
      setInlineMessage,
      showToast,
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
      showToast,
      state,
      submitClock: lifecycleController.submitClock,
      submitManagementHolidayForm: sharedControllers.submitManagementHolidayForm,
      submitManagementJobTitleForm: sharedControllers.submitManagementJobTitleForm,
      submitManagementUnitForm: sharedControllers.submitManagementUnitForm,
      submitManagementWorkPolicyForm: sharedControllers.submitManagementWorkPolicyForm,
      submitManagementWorksiteForm: sharedControllers.submitManagementWorksiteForm,
      syncManagementWorksiteDraftFromDom: sharedControllers.syncManagementWorksiteDraftFromDom,
      updateUserMeta: shellController.updateUserMeta,
      closeCompanyCreateModal: shellController.closeCompanyCreateModal,
      openCompanySettingsModal: shellController.openCompanySettingsModal,
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
      captureManagementModalSnapshot: sharedControllers.captureManagementModalSnapshot,
      clearAllDashboardGridFilters: sharedControllers.clearAllDashboardGridFilters,
      clearDashboardGridFilter: sharedControllers.clearDashboardGridFilter,
      closeAccountSettingsModal: shellController.closeAccountSettingsModal,
      closeAllDashboardGridPageSizeMenus: sharedControllers.closeAllDashboardGridPageSizeMenus,
      closeCompanyCreateModal: shellController.closeCompanyCreateModal,
      closeCompanySettingsModal: shellController.closeCompanySettingsModal,
      closeDashboardDetailModal: sharedControllers.closeDashboardDetailModal,
      closeDashboardGridFilterMenu: sharedControllers.closeDashboardGridFilterMenu,
      closeDashboardSummaryModal: sharedControllers.closeDashboardSummaryModal,
      closeManagementEmployeeExcelModal: sharedControllers.closeManagementEmployeeExcelModal,
      closeManagementEmployeeModal: sharedControllers.closeManagementEmployeeModal,
      closeManagementHolidayModal: sharedControllers.closeManagementHolidayModal,
      closeManagementJobTitleModal: sharedControllers.closeManagementJobTitleModal,
      closeManagementModalConfirm: sharedControllers.closeManagementModalConfirm,
      closeManagementWorkPolicyModal: sharedControllers.closeManagementWorkPolicyModal,
      closeManagementUnitModal: sharedControllers.closeManagementUnitModal,
      closeManagementWorkPolicyTimePickers: sharedControllers.closeManagementWorkPolicyTimePickers,
      closeManagementWorksiteModal: sharedControllers.closeManagementWorksiteModal,
      closeManagementWorksiteSearchModal: sharedControllers.closeManagementWorksiteSearchModal,
      closeScheduleUserFilter: sharedControllers.closeScheduleUserFilter,
      closeSidebar: shellController.closeSidebar,
      currentPage,
      CURRENT_YEAR: currentYear,
      MANAGEMENT_SECTION_STORAGE_KEY,
      deleteManagementHoliday: sharedControllers.deleteManagementHoliday,
      deleteManagementJobTitle: sharedControllers.deleteManagementJobTitle,
      deleteManagementWorkPolicy: sharedControllers.deleteManagementWorkPolicy,
      deleteManagementUnit: sharedControllers.deleteManagementUnit,
      deleteManagementWorksite: sharedControllers.deleteManagementWorksite,
      downloadManagementEmployeeCardFile: sharedControllers.downloadManagementEmployeeCardFile,
      downloadManagementEmployeeExcelTemplate: sharedControllers.downloadManagementEmployeeExcelTemplate,
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
      handleManagementWorksiteDragEnd: sharedControllers.handleManagementWorksiteDragEnd,
      handleManagementWorksiteDragOver: sharedControllers.handleManagementWorksiteDragOver,
      handleManagementWorksiteDragStart: sharedControllers.handleManagementWorksiteDragStart,
      handleManagementWorksiteDrop: sharedControllers.handleManagementWorksiteDrop,
      handleManagementEmployeeCardFileChange: sharedControllers.handleManagementEmployeeCardFileChange,
      handleManagementEmployeeCardFileDrop: sharedControllers.handleManagementEmployeeCardFileDrop,
      handleManagementEmployeeExcelFileChange: sharedControllers.handleManagementEmployeeExcelFileChange,
      handleManagementModalConfirmAction: sharedControllers.handleManagementModalConfirmAction,
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
      openManagementEmployeeDeleteConfirmModal: sharedControllers.openManagementEmployeeDeleteConfirmModal,
      openManagementEmployeeExcelModal: sharedControllers.openManagementEmployeeExcelModal,
      openManagementEmployeeInviteChannelModal: sharedControllers.openManagementEmployeeInviteChannelModal,
      openManagementEmployeeModal: sharedControllers.openManagementEmployeeModal,
      openManagementHolidayModal: sharedControllers.openManagementHolidayModal,
      openManagementJobTitleModal: sharedControllers.openManagementJobTitleModal,
      openManagementWorkPolicyModal: sharedControllers.openManagementWorkPolicyModal,
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
      setInlineMessage,
      showToast,
      submitManagementEmployeeDraftForm: sharedControllers.submitManagementEmployeeDraftForm,
      submitManagementEmployeeDelete: sharedControllers.submitManagementEmployeeDelete,
      submitManagementEmployeeExcelUpload: sharedControllers.submitManagementEmployeeExcelUpload,
      submitManagementEmployeeInviteForm: sharedControllers.submitManagementEmployeeInviteForm,
      submitManagementEmployeeSaveForm: sharedControllers.submitManagementEmployeeSaveForm,
      closeManagementEmployeeDeleteConfirmModal: sharedControllers.closeManagementEmployeeDeleteConfirmModal,
      closeManagementEmployeeInviteChannelModal: sharedControllers.closeManagementEmployeeInviteChannelModal,
      resetManagementEmployeeDraft: sharedControllers.resetManagementEmployeeDraft,
      resetManagementHolidayDraft: sharedControllers.resetManagementHolidayDraft,
      resetManagementJobTitleDraft: sharedControllers.resetManagementJobTitleDraft,
      resetManagementWorkPolicyDraft: sharedControllers.resetManagementWorkPolicyDraft,
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
      runWithManagementModalGuard: sharedControllers.runWithManagementModalGuard,
      setPersonalScopeEnabled: shellController.setPersonalScopeEnabled,
      setScheduleUserFilterValue: sharedControllers.setScheduleUserFilterValue,
      setLoading: shellController.setLoading,
      setVisibleScheduleUserFilterValues: sharedControllers.setScheduleVisibleUserFilterValues,
      state,
      submitClock: lifecycleController.submitClock,
      syncManagementJobTitleTreeState: sharedControllers.syncManagementJobTitleTreeState,
      syncManagementEmployeeActionButtons: sharedControllers.syncManagementEmployeeActionButtons,
      syncManagementEmployeeJobTitleOptions: sharedControllers.syncManagementEmployeeJobTitleOptions,
      syncManagementModalDirtyState: sharedControllers.syncManagementModalDirtyState,
      syncManagementWorksiteDraftFromDom: sharedControllers.syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry: sharedControllers.syncManagementWorksiteMapGeometry,
      toggleDashboardGridFilterValue: sharedControllers.toggleDashboardGridFilterValue,
      toggleDashboardGridPageSizeMenu: sharedControllers.toggleDashboardGridPageSizeMenu,
      toggleDashboardGridSort: sharedControllers.toggleDashboardGridSort,
      toggleDashboardGridVisibleFilterValues: sharedControllers.toggleDashboardGridVisibleFilterValues,
      toggleScheduleMonthAllEntries: sharedControllers.toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter: sharedControllers.toggleScheduleUserFilter,
      updateManagementEmployeePhoneInput: sharedControllers.updateManagementEmployeePhoneInput,
      updateManagementEmployeeTenurePreview: sharedControllers.updateManagementEmployeeTenurePreview,
      validateManagementEmployeeField: sharedControllers.validateManagementEmployeeField,
      validateManagementEmployeeFormFields: sharedControllers.validateManagementEmployeeFormFields,
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
