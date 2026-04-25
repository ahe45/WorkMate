(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionWorkspaceInputHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      currentPage,
      isWorkspaceGridContext,
      refreshDashboardGridFilterMenu,
      refreshScheduleUserFilterMenu,
      selectDashboardGridFilterSearchResults,
      selectScheduleUserFilterSearchResults,
      setScheduleUserFilterValue,
      setVisibleScheduleUserFilterValues,
      state,
      toggleDashboardGridFilterValue,
      toggleDashboardGridVisibleFilterValues,
    } = dependencies;

    if (!state) {
      throw new Error("WorkMateAppInteractionWorkspaceInputHandler requires workspace input dependencies.");
    }

    function handleDocumentInput(event) {
      if (currentPage !== "workspace") {
        return false;
      }

      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return false;
      }

      if (isWorkspaceGridContext() && target.dataset.dashboardGridFilterSearchInput === "true") {
        selectDashboardGridFilterSearchResults(
          target.dataset.dashboardGridTable || "",
          target.dataset.dashboardGridColumn || "",
          target.value || "",
          target.closest(".table-filter-menu"),
        );
        return true;
      }

      if (state.currentWorkspaceView === "schedules" && target.dataset.scheduleUserFilterSearchInput === "true") {
        selectScheduleUserFilterSearchResults(target.value || "", target.closest(".table-filter-menu"));
        return true;
      }

      return false;
    }

    function handleDocumentChange(event) {
      if (currentPage !== "workspace") {
        return false;
      }

      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return false;
      }

      if (state.currentWorkspaceView === "schedules" && target.dataset.scheduleUserFilterOptionInput === "true") {
        setScheduleUserFilterValue(
          target.dataset.scheduleUserFilterOption || "",
          target.checked,
          { shouldRender: false },
        );
        refreshScheduleUserFilterMenu(target.closest(".table-filter-menu"));
        return true;
      }

      if (state.currentWorkspaceView === "schedules" && target.dataset.scheduleUserFilterSelectAll === "true") {
        setVisibleScheduleUserFilterValues(target.checked, { shouldRender: false });
        refreshScheduleUserFilterMenu(target.closest(".table-filter-menu"));
        return true;
      }

      if (!isWorkspaceGridContext()) {
        return false;
      }

      if (target.dataset.dashboardGridFilterOptionInput === "true") {
        toggleDashboardGridFilterValue(
          target.dataset.dashboardGridTable || "",
          target.dataset.dashboardGridColumn || "",
          target.dataset.dashboardGridValue || "",
          { shouldRender: false },
        );
        refreshDashboardGridFilterMenu(target.closest(".table-filter-menu"));
        return true;
      }

      if (target.dataset.dashboardGridFilterSelectAll === "true") {
        toggleDashboardGridVisibleFilterValues(
          target.dataset.dashboardGridTable || "",
          target.dataset.dashboardGridColumn || "",
          target.checked,
          { shouldRender: false },
        );
        refreshDashboardGridFilterMenu(target.closest(".table-filter-menu"));
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleDocumentChange,
      handleDocumentInput,
    });
  }

  return Object.freeze({ create });
});
