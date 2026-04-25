(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionWorkspaceKeyHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      closeAllDashboardGridPageSizeMenus,
      closeDashboardDetailModal,
      closeDashboardGridFilterMenu,
      closeDashboardSummaryModal,
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementWorkPolicyModal,
      closeManagementUnitModal,
      closeManagementWorksiteModal,
      closeScheduleUserFilter,
      currentPage,
      isWorkspaceGridContext,
      renderWorkspacePage,
      state,
    } = dependencies;

    if (!state) {
      throw new Error("WorkMateAppInteractionWorkspaceKeyHandler requires workspace key handler dependencies.");
    }

    function handleWorkspaceEnter(event) {
      if (currentPage !== "workspace" || event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) {
        return false;
      }

      const target = event.target;

      if (isWorkspaceGridContext() && target.dataset.dashboardGridFilterSearchInput === "true") {
        event.preventDefault();
        closeDashboardGridFilterMenu();
        return true;
      }

      if (state.currentWorkspaceView === "schedules" && target.dataset.scheduleUserFilterSearchInput === "true") {
        event.preventDefault();
        closeScheduleUserFilter();
        return true;
      }

      return false;
    }

    function handleWorkspaceEscape() {
      if (currentPage !== "workspace") {
        return false;
      }

      if (state.dashboardDetailUserId) {
        closeDashboardDetailModal();
        return true;
      }

      if (state.currentWorkspaceView === "management" && state.managementHolidayModalOpen) {
        closeManagementHolidayModal();
        return true;
      }

      if (state.currentWorkspaceView === "management" && state.managementJobTitleModalOpen) {
        closeManagementJobTitleModal();
        return true;
      }

      if (state.currentWorkspaceView === "management" && state.managementWorkPolicyModalOpen) {
        closeManagementWorkPolicyModal();
        return true;
      }

      if (state.currentWorkspaceView === "management" && state.managementUnitModalOpen) {
        closeManagementUnitModal();
        return true;
      }

      if (state.currentWorkspaceView === "management" && state.managementWorksiteModalOpen) {
        closeManagementWorksiteModal();
        return true;
      }

      if (state.dashboardGridFilterMenu) {
        closeDashboardGridFilterMenu();
        return true;
      }

      if (state.currentWorkspaceView === "schedules" && state.scheduleUserFilterOpen) {
        closeScheduleUserFilter();
        return true;
      }

      if (closeAllDashboardGridPageSizeMenus()) {
        renderWorkspacePage();
        return true;
      }

      if (state.dashboardSummaryFilter) {
        closeDashboardSummaryModal();
        return true;
      }

      return false;
    }

    function handleDocumentKeydown(event) {
      if (handleWorkspaceEnter(event)) {
        return true;
      }

      if (event.key !== "Escape") {
        return false;
      }

      return handleWorkspaceEscape();
    }

    return Object.freeze({
      handleDocumentKeydown,
    });
  }

  return Object.freeze({ create });
});
