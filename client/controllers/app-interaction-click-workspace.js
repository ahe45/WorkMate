(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionWorkspaceClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      clearAllDashboardGridFilters,
      clearDashboardGridFilter,
      closeAllDashboardGridPageSizeMenus,
      closeDashboardDetailModal,
      closeDashboardGridFilterMenu,
      closeDashboardSummaryModal,
      closeScheduleUserFilter,
      closeSidebar,
      currentPage,
      elements,
      expandScheduleMonthDate,
      findCompanyByCode,
      isWorkspaceGridContext,
      loadAttendanceRecordsData,
      loadReportRecordsData,
      loadScheduleCalendarData,
      moveDashboardGridPage,
      navigateToWorkspaceView,
      openDashboardDetailModal,
      openDashboardGridFilterMenu,
      openDashboardSummaryModal,
      refreshDashboardGridFilterMenu,
      removeDashboardGridFilterValue,
      renderWorkspacePage,
      renderers,
      resetScheduleUserFilter,
      runWithManagementModalGuard,
      setDashboardGridPage,
      setDashboardGridPageSize,
      setLoading,
      state,
      toggleDashboardGridPageSizeMenu,
      toggleDashboardGridSort,
      toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter,
      adjustAttendanceCursor,
      adjustReportCursor,
      adjustScheduleCursor,
    } = dependencies;

    if (!appConfig || !elements || !renderers || !state) {
      throw new Error("WorkMateAppInteractionWorkspaceClickHandler requires workspace click dependencies.");
    }

    function isWorkspacePage() {
      return currentPage === "workspace";
    }

    async function handleDocumentClick(event) {
      if (!isWorkspacePage()) {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return false;
      }

      const attendanceModeButton = target.closest("[data-attendance-mode]");
      const attendanceNavButton = target.closest("[data-attendance-nav]");
      const dashboardDetailOpenButton = target.closest("[data-dashboard-detail-open]");
      const dashboardDetailCloseButton = target.closest("[data-dashboard-detail-close]");
      const dashboardSummaryOpenButton = target.closest("[data-dashboard-summary-open]");
      const dashboardSummaryCloseButton = target.closest("[data-dashboard-summary-close]");
      const dashboardGridSortButton = target.closest("[data-dashboard-grid-sort]");
      const dashboardGridFilterOpenButton = target.closest("[data-dashboard-grid-filter-open]");
      const dashboardGridFilterCloseButton = target.closest("[data-dashboard-grid-filter-close]");
      const dashboardGridFilterResetButton = target.closest("[data-dashboard-grid-filter-clear]");
      const dashboardGridClearFilterButton = target.closest("[data-dashboard-grid-clear-filter]");
      const dashboardGridClearAllButton = target.closest("[data-dashboard-grid-clear-all]");
      const dashboardGridPageButton = target.closest("[data-dashboard-grid-page]");
      const dashboardGridPageNavButton = target.closest("[data-dashboard-grid-nav]");
      const dashboardGridPageSizeTrigger = target.closest("[data-dashboard-grid-page-size-trigger]");
      const dashboardGridPageSizeOption = target.closest("[data-dashboard-grid-page-size-option]");
      const reportNavButton = target.closest("[data-report-nav]");
      const scheduleMonthAllButton = target.closest("[data-schedule-month-all]");
      const scheduleMonthExpandButton = target.closest("[data-schedule-month-expand]");
      const scheduleModeButton = target.closest("[data-schedule-mode]");
      const scheduleNavButton = target.closest("[data-schedule-nav]");
      const scheduleUserFilterToggleButton = target.closest("[data-schedule-user-filter-toggle]");
      const scheduleUserFilterCloseButton = target.closest("[data-schedule-user-filter-close]");
      const scheduleUserFilterResetButton = target.closest("[data-schedule-user-filter-reset]");
      const viewLink = target.closest("[data-view-link]");
      const navButton = target.closest(".nav-item[data-view]");
      const isWorkspaceGridView = isWorkspaceGridContext();

      if (attendanceModeButton && state.currentWorkspaceView === "attendance") {
        const nextMode = renderers.normalizeAttendanceViewMode(attendanceModeButton.dataset.attendanceMode || "");

        if (nextMode !== state.attendanceViewMode) {
          state.attendanceViewMode = nextMode;
          setLoading("출퇴근기록을 불러오는 중입니다.");
          await loadAttendanceRecordsData({ force: true });
        }

        renderWorkspacePage();
        return true;
      }

      if (attendanceNavButton && state.currentWorkspaceView === "attendance") {
        adjustAttendanceCursor(attendanceNavButton.dataset.attendanceNav || "");
        setLoading("출퇴근기록을 불러오는 중입니다.");
        await loadAttendanceRecordsData({ force: true });
        renderWorkspacePage();
        return true;
      }

      if (reportNavButton && state.currentWorkspaceView === "reports") {
        adjustReportCursor(reportNavButton.dataset.reportNav || "");
        setLoading("리포트를 불러오는 중입니다.");
        await loadReportRecordsData({ force: true });
        renderWorkspacePage();
        return true;
      }

      if (scheduleModeButton && state.currentWorkspaceView === "schedules") {
        const nextMode = renderers.normalizeScheduleViewMode(scheduleModeButton.dataset.scheduleMode || "");

        if (nextMode !== state.scheduleViewMode) {
          state.scheduleViewMode = nextMode;
          closeScheduleUserFilter(false);
          setLoading("근무일정을 불러오는 중입니다.");
          await loadScheduleCalendarData({ force: true });
        }

        renderWorkspacePage();
        return true;
      }

      if (scheduleNavButton && state.currentWorkspaceView === "schedules") {
        adjustScheduleCursor(scheduleNavButton.dataset.scheduleNav || "");
        closeScheduleUserFilter(false);
        setLoading("근무일정을 불러오는 중입니다.");
        await loadScheduleCalendarData({ force: true });
        renderWorkspacePage();
        return true;
      }

      if (scheduleMonthAllButton && state.currentWorkspaceView === "schedules") {
        toggleScheduleMonthAllEntries();
        return true;
      }

      if (scheduleMonthExpandButton && state.currentWorkspaceView === "schedules") {
        expandScheduleMonthDate(scheduleMonthExpandButton.dataset.scheduleMonthExpand || "");
        return true;
      }

      if (scheduleUserFilterToggleButton && state.currentWorkspaceView === "schedules") {
        toggleScheduleUserFilter();
        return true;
      }

      if (scheduleUserFilterCloseButton && state.currentWorkspaceView === "schedules") {
        closeScheduleUserFilter();
        return true;
      }

      if (scheduleUserFilterResetButton && state.currentWorkspaceView === "schedules") {
        resetScheduleUserFilter({ shouldRender: false });
        refreshScheduleUserFilterMenu(scheduleUserFilterResetButton.closest(".table-filter-menu"));
        return true;
      }

      if (dashboardDetailOpenButton && state.currentWorkspaceView === "dashboard") {
        openDashboardDetailModal(dashboardDetailOpenButton.dataset.dashboardDetailOpen || "");
        return true;
      }

      if (dashboardDetailCloseButton && state.currentWorkspaceView === "dashboard") {
        closeDashboardDetailModal();
        return true;
      }

      if (dashboardSummaryOpenButton && state.currentWorkspaceView === "dashboard") {
        openDashboardSummaryModal(dashboardSummaryOpenButton.dataset.dashboardSummaryOpen || "");
        return true;
      }

      if (dashboardSummaryCloseButton && state.currentWorkspaceView === "dashboard") {
        closeDashboardSummaryModal();
        return true;
      }

      if (dashboardGridSortButton && isWorkspaceGridView) {
        toggleDashboardGridSort(
          dashboardGridSortButton.dataset.dashboardGridTable || "",
          dashboardGridSortButton.dataset.dashboardGridColumn || "",
        );
        return true;
      }

      if (dashboardGridFilterOpenButton && isWorkspaceGridView) {
        openDashboardGridFilterMenu(
          dashboardGridFilterOpenButton,
          dashboardGridFilterOpenButton.dataset.dashboardGridTable || "",
          dashboardGridFilterOpenButton.dataset.dashboardGridColumn || "",
        );
        return true;
      }

      if (dashboardGridFilterCloseButton && isWorkspaceGridView) {
        closeDashboardGridFilterMenu();
        return true;
      }

      if (dashboardGridFilterResetButton && isWorkspaceGridView) {
        clearDashboardGridFilter(
          dashboardGridFilterResetButton.dataset.dashboardGridTable || "",
          dashboardGridFilterResetButton.dataset.dashboardGridColumn || "",
          {
            keepMenuOpen: dashboardGridFilterResetButton.dataset.dashboardGridKeepMenu === "true",
            shouldRender: false,
          },
        );
        refreshDashboardGridFilterMenu(dashboardGridFilterResetButton.closest(".table-filter-menu"));
        return true;
      }

      if (dashboardGridClearFilterButton && isWorkspaceGridView) {
        removeDashboardGridFilterValue(
          dashboardGridClearFilterButton.dataset.dashboardGridTable || "",
          dashboardGridClearFilterButton.dataset.dashboardGridColumn || "",
          dashboardGridClearFilterButton.dataset.dashboardGridValue || "",
        );
        return true;
      }

      if (dashboardGridClearAllButton && isWorkspaceGridView) {
        clearAllDashboardGridFilters(dashboardGridClearAllButton.dataset.dashboardGridTable || "");
        return true;
      }

      if (dashboardGridPageButton && isWorkspaceGridView) {
        setDashboardGridPage(
          dashboardGridPageButton.dataset.dashboardGridTable || "",
          dashboardGridPageButton.dataset.dashboardGridPage || "1",
        );
        return true;
      }

      if (dashboardGridPageNavButton && isWorkspaceGridView) {
        moveDashboardGridPage(
          dashboardGridPageNavButton.dataset.dashboardGridTable || "",
          dashboardGridPageNavButton.dataset.dashboardGridNav || "",
        );
        return true;
      }

      if (dashboardGridPageSizeTrigger && isWorkspaceGridView) {
        toggleDashboardGridPageSizeMenu(dashboardGridPageSizeTrigger.dataset.dashboardGridTable || "");
        return true;
      }

      if (dashboardGridPageSizeOption && isWorkspaceGridView) {
        setDashboardGridPageSize(
          dashboardGridPageSizeOption.dataset.dashboardGridTable || "",
          dashboardGridPageSizeOption.dataset.dashboardGridPageSizeOption || "20",
        );
        return true;
      }

      if (viewLink) {
        const route = appConfig.getWorkspaceRoute(window.location.pathname);
        const companyCode = findCompanyByCode(route?.companyCode)?.code || route?.companyCode || "";
        await runWithManagementModalGuard(async () => {
          navigateToWorkspaceView(companyCode, viewLink.dataset.viewLink || appConfig.defaultWorkspaceView);
          closeSidebar();
        });
        return true;
      }

      if (navButton) {
        const route = appConfig.getWorkspaceRoute(window.location.pathname);
        await runWithManagementModalGuard(async () => {
          navigateToWorkspaceView(route?.companyCode || "", navButton.dataset.view || appConfig.defaultWorkspaceView);
          closeSidebar();
        });
        return true;
      }

      if (state.currentWorkspaceView === "schedules" && state.scheduleUserFilterOpen) {
        const clickedInsideScheduleUserFilter = target.closest(".workmate-schedule-user-filter");

        if (!clickedInsideScheduleUserFilter) {
          closeScheduleUserFilter();
          return true;
        }
      }

      if (["dashboard", "attendance", "leave", "reports"].includes(state.currentWorkspaceView)) {
        const clickedPageSizeControl = target.closest(".table-page-size-select");

        if (!clickedPageSizeControl && closeAllDashboardGridPageSizeMenus()) {
          renderWorkspacePage();
          return true;
        }
      }

      if (elements.menuToggle && elements.sidebar?.classList.contains("open")) {
        const clickedInsideSidebar = elements.sidebar.contains(target);
        const clickedMenuToggle = elements.menuToggle.contains(target);

        if (!clickedInsideSidebar && !clickedMenuToggle) {
          closeSidebar();
          return true;
        }
      }

      return false;
    }

    return Object.freeze({
      handleDocumentClick,
    });
  }

  return Object.freeze({ create });
});
