(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppLifecycleWorkspaceActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      closeAllDashboardGridPageSizeMenus,
      currentPage,
      CURRENT_YEAR,
      elements,
      findCompanyByCode,
      getSelectedCompany,
      handleProtectedFailure,
      loadAttendanceRecordsData,
      loadManagementHolidayData,
      loadReportRecordsData,
      loadScheduleCalendarData,
      navigationModule,
      normalizeManagementSection,
      renderers,
      resetPersistedManagementSection,
      setClockOutput,
      setLoading,
      state,
      syncDashboardGridUiState,
      syncManagementWorksiteMapUi,
      syncWorkspaceOverlayState,
      updatePersonalScopeToggle,
      updateTopbar,
      updateUserMeta,
    } = dependencies;

    if (!appConfig || !elements || !navigationModule || !renderers || !state) {
      throw new Error("WorkMateAppLifecycleWorkspaceActions requires workspace lifecycle dependencies.");
    }

    let navigationController = null;

    function renderCompaniesPage() {
      resetPersistedManagementSection();
      updateTopbar(renderers.COMPANY_PAGE_META, "companies");
      updateUserMeta();
      updatePersonalScopeToggle();

      if (elements.viewRoot) {
        elements.viewRoot.innerHTML = renderers.renderCompaniesView(state);
      }
    }

    function renderWorkspacePage() {
      const route = appConfig.getWorkspaceRoute(window.location.pathname);
      const view = appConfig.normalizeWorkspaceView(route?.view || state.currentWorkspaceView);
      const company = findCompanyByCode(route?.companyCode || getSelectedCompany()?.code || "");
      const meta = renderers.getViewMeta(view);

      state.currentWorkspaceView = view;

      if (view !== "management") {
        resetPersistedManagementSection();
      }

      if (view !== "dashboard") {
        state.dashboardDetailUserId = "";
        state.dashboardSummaryFilter = "";
      }

      const isManagementGridView = view === "management"
        && ["worksites", "job-titles", "employees", "work-schedules"].includes(normalizeManagementSection(state.managementSection));

      if (!["dashboard", "attendance", "leave", "reports"].includes(view) && !isManagementGridView) {
        state.dashboardGridFilterMenu = null;
        closeAllDashboardGridPageSizeMenus();
      }

      if (view === "management") {
        state.managementSection = normalizeManagementSection(state.managementSection);

        const shouldLoadHolidayData = state.managementSection === "holidays" || state.managementSection === "work-schedules";
        const holidayYear = state.managementSection === "holidays"
          ? Number(state.managementHolidayYear || CURRENT_YEAR) || CURRENT_YEAR
          : CURRENT_YEAR;

        if (shouldLoadHolidayData
          && !state.managementHolidayLoading
          && (state.managementHolidayData.loadedOrganizationId !== (state.selectedOrganizationId || state.bootstrap?.organizationContext?.id || "")
            || Number(state.managementHolidayData.year || 0) !== holidayYear)) {
          loadManagementHolidayData({ force: false, year: holidayYear }).then(() => {
            renderWorkspacePage();
          }).catch((error) => {
            if (!handleProtectedFailure(error)) {
              window.alert(error.message || "공휴일 정보를 불러오지 못했습니다.");
            }
          });
        }
      }

      updateTopbar(meta, "workspace", view);
      updateUserMeta();
      updatePersonalScopeToggle();

      if (elements.sidebarCompanyName) {
        elements.sidebarCompanyName.textContent = state.bootstrap?.organizationContext?.name || company?.name || "워크스페이스";
      }

      if (elements.workspaceNavRoot) {
        elements.workspaceNavRoot.innerHTML = renderers.renderSidebarNavigation(view);
        navigationController?.syncNavigationVisibility(elements.workspaceNavRoot);
      }

      if (elements.viewRoot) {
        elements.viewRoot.innerHTML = renderers.renderWorkspaceView(view, state);
      }

      setClockOutput(state.clockOutputText);
      syncWorkspaceOverlayState();
      syncDashboardGridUiState();
      syncManagementWorksiteMapUi().catch((error) => {
        if (state.currentWorkspaceView === "management") {
          state.managementWorksiteSearchStatus = error.message || "지도를 불러오지 못했습니다.";
        }
      });
    }

    function ensureNavigationController() {
      if (currentPage !== "workspace" || navigationController) {
        return;
      }

      navigationController = navigationModule.createNavigationController({
        buildWorkspacePath: appConfig.buildWorkspacePath,
        normalizeWorkspaceView: appConfig.normalizeWorkspaceView,
        onViewChange: (view) => {
          state.currentWorkspaceView = appConfig.normalizeWorkspaceView(view);

          if (state.currentWorkspaceView !== "management") {
            resetPersistedManagementSection();
          }

          if (state.currentWorkspaceView === "schedules") {
            setLoading("근무일정을 불러오는 중입니다.");
            loadScheduleCalendarData()
              .then(() => renderWorkspacePage())
              .catch((error) => {
                if (!handleProtectedFailure(error)) {
                  window.alert(error.message || "근무일정을 불러오지 못했습니다.");
                }
              });
            return;
          }

          if (state.currentWorkspaceView === "attendance") {
            setLoading("출퇴근기록을 불러오는 중입니다.");
            loadAttendanceRecordsData()
              .then(() => renderWorkspacePage())
              .catch((error) => {
                if (!handleProtectedFailure(error)) {
                  window.alert(error.message || "출퇴근기록을 불러오지 못했습니다.");
                }
              });
            return;
          }

          if (state.currentWorkspaceView === "reports") {
            setLoading("리포트를 불러오는 중입니다.");
            loadReportRecordsData()
              .then(() => renderWorkspacePage())
              .catch((error) => {
                if (!handleProtectedFailure(error)) {
                  window.alert(error.message || "리포트를 불러오지 못했습니다.");
                }
              });
            return;
          }

          renderWorkspacePage();
        },
        state,
      });
    }

    function navigateToWorkspaceView(companyCode = "", view = appConfig.defaultWorkspaceView) {
      ensureNavigationController();
      navigationController?.navigateToWorkspaceView(companyCode, view);
    }

    return Object.freeze({
      ensureNavigationController,
      navigateToWorkspaceView,
      renderCompaniesPage,
      renderWorkspacePage,
    });
  }

  return Object.freeze({ create });
});
