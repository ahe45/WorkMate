(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppLifecycleController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      closeAllDashboardGridPageSizeMenus,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      createEmptyManagementHolidayDraft,
      currentPage,
      CURRENT_YEAR,
      elements,
      findCompanyByCode,
      formatLocalDateKey,
      getSelectedCompany,
      loadAttendanceRecordsData,
      loadManagementHolidayData,
      loadReportRecordsData,
      loadScheduleCalendarData,
      MANAGEMENT_SECTION_STORAGE_KEY,
      navigateTo,
      navigationModule,
      normalizeManagementSection,
      persistSelectedOrganizationId,
      renderers,
      setLoading,
      state,
      syncDashboardGridUiState,
      syncManagementWorksiteMapUi,
      syncWorkspaceOverlayState,
      updatePersonalScopeToggle,
      updateTopbar,
      updateUserMeta,
    } = dependencies;

    if (!api || !appConfig || !elements || !navigationModule || !renderers || !state) {
      throw new Error("WorkMateAppLifecycleController requires app lifecycle dependencies.");
    }

    const sessionActionsModule = globalThis.WorkMateAppLifecycleSessionActions
      || (typeof require === "function" ? require("./app-lifecycle-session-actions.js") : null);
    const workspaceActionsModule = globalThis.WorkMateAppLifecycleWorkspaceActions
      || (typeof require === "function" ? require("./app-lifecycle-workspace-actions.js") : null);
    const dataActionsModule = globalThis.WorkMateAppLifecycleDataActions
      || (typeof require === "function" ? require("./app-lifecycle-data-actions.js") : null);

    if (!sessionActionsModule || typeof sessionActionsModule.create !== "function") {
      throw new Error("client/controllers/app-lifecycle-session-actions.js must be loaded before client/controllers/app-lifecycle-controller.js.");
    }

    if (!workspaceActionsModule || typeof workspaceActionsModule.create !== "function") {
      throw new Error("client/controllers/app-lifecycle-workspace-actions.js must be loaded before client/controllers/app-lifecycle-controller.js.");
    }

    if (!dataActionsModule || typeof dataActionsModule.create !== "function") {
      throw new Error("client/controllers/app-lifecycle-data-actions.js must be loaded before client/controllers/app-lifecycle-controller.js.");
    }

    function setClockOutput(text = "") {
      state.clockOutputText = text || "";
      const clockOutput = document.getElementById("clock-output");

      if (clockOutput) {
        clockOutput.textContent = state.clockOutputText || "아직 실행 결과가 없습니다.";
      }
    }

    function resetScheduleCalendarState() {
      state.scheduleCalendarData = createDefaultScheduleCalendarState();
      state.scheduleCalendarLoading = false;
      state.scheduleMonthExpandedDates = [];
      state.scheduleMonthShowAllEntries = false;
      state.scheduleSelectedUserIds = [];
      state.scheduleUserFilterMode = "all";
      state.scheduleUserFilterOpen = false;
      state.scheduleUserFilterSearch = "";
      state.scheduleViewMode = "month";
      state.scheduleDateCursor = formatLocalDateKey();
    }

    function resetAttendanceRecordsState() {
      state.attendanceDateCursor = formatLocalDateKey();
      state.attendanceRecordsData = createDefaultAttendanceRecordsState();
      state.attendanceRecordsLoading = false;
      state.attendanceViewMode = "month";
    }

    function resetReportRecordsState() {
      state.reportDateCursor = formatLocalDateKey();
      state.reportRecordsData = createDefaultAttendanceRecordsState();
      state.reportRecordsLoading = false;
    }

    function resetManagementHolidayState() {
      state.managementHolidayYear = CURRENT_YEAR;
      state.managementHolidayDraft = createEmptyManagementHolidayDraft(CURRENT_YEAR);
      state.managementHolidayData = createDefaultManagementHolidayData({
        year: CURRENT_YEAR,
      });
      state.managementHolidayLoading = false;
      state.managementHolidayModalOpen = false;
    }

    function resetPersistedManagementSection() {
      state.managementSection = normalizeManagementSection("");

      if (MANAGEMENT_SECTION_STORAGE_KEY) {
        window.sessionStorage.removeItem(MANAGEMENT_SECTION_STORAGE_KEY);
      }
    }

    const sessionActions = sessionActionsModule.create({
      api,
      appConfig,
      getSelectedCompany,
      navigateTo,
      persistSelectedOrganizationId,
      resetAttendanceRecordsState,
      resetManagementHolidayState,
      resetPersistedManagementSection,
      resetReportRecordsState,
      resetScheduleCalendarState,
      state,
      updateUserMeta,
    });
    const workspaceActions = workspaceActionsModule.create({
      appConfig,
      closeAllDashboardGridPageSizeMenus,
      currentPage,
      CURRENT_YEAR,
      elements,
      findCompanyByCode,
      getSelectedCompany,
      handleProtectedFailure: sessionActions.handleProtectedFailure,
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
    });
    const dataActions = dataActionsModule.create({
      api,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultScheduleCalendarState,
      loadAttendanceRecordsData,
      loadCompanies: sessionActions.loadCompanies,
      loadManagementHolidayData,
      loadReportRecordsData,
      loadScheduleCalendarData,
      normalizeManagementSection,
      renderWorkspacePage: workspaceActions.renderWorkspacePage,
      resetAttendanceRecordsState,
      resetReportRecordsState,
      resetScheduleCalendarState,
      setClockOutput,
      state,
    });

    async function initAuthPage() {
      resetPersistedManagementSection();

      if (!sessionActions.hasStoredTokens()) {
        return;
      }

      try {
        await sessionActions.resolveMe();
        await sessionActions.loadCompanies();
        navigateTo(appConfig.companiesRoutePath, true);
      } catch (error) {
        api.clearAuthTokens();
        persistSelectedOrganizationId("");
      }
    }

    async function initCompaniesPage() {
      resetPersistedManagementSection();

      if (!sessionActions.hasStoredTokens()) {
        navigateTo(appConfig.loginRoutePath, true);
        return;
      }

      setLoading("회사 목록을 불러오는 중입니다.");

      try {
        await sessionActions.resolveMe();
        await sessionActions.loadCompanies();
        workspaceActions.renderCompaniesPage();
      } catch (error) {
        if (!sessionActions.handleProtectedFailure(error)) {
          window.alert(error.message || "회사 목록을 불러오지 못했습니다.");
        }
      }
    }

    async function initWorkspacePage() {
      const route = appConfig.getWorkspaceRoute(window.location.pathname);

      if (!route) {
        navigateTo(appConfig.companiesRoutePath, true);
        return;
      }

      if (!sessionActions.hasStoredTokens()) {
        navigateTo(appConfig.loginRoutePath, true);
        return;
      }

      setLoading("워크스페이스를 불러오는 중입니다.");
      state.currentWorkspaceView = route.view;

      if (route.view !== "management") {
        resetPersistedManagementSection();
      }

      try {
        await sessionActions.resolveMe();
        await sessionActions.loadCompanies();

        const company = findCompanyByCode(route.companyCode);

        if (!company) {
          persistSelectedOrganizationId("");
          navigateTo(appConfig.companiesRoutePath, true);
          return;
        }

        persistSelectedOrganizationId(company.id);
        await sessionActions.switchActiveOrganization(company.id);
        await dataActions.loadBootstrap(company.id);

        if (route.view === "schedules") {
          await loadScheduleCalendarData({ force: true });
        }

        if (route.view === "attendance") {
          await loadAttendanceRecordsData({ force: true });
        }

        if (route.view === "reports") {
          await loadReportRecordsData({ force: true });
        }

        workspaceActions.ensureNavigationController();
        workspaceActions.renderWorkspacePage();
      } catch (error) {
        if (!sessionActions.handleProtectedFailure(error)) {
          window.alert(error.message || "워크스페이스를 불러오는 중입니다.");
        }
      }
    }

    return Object.freeze({
      handleProtectedFailure: sessionActions.handleProtectedFailure,
      initAuthPage,
      initCompaniesPage,
      initWorkspacePage,
      loadBootstrap: dataActions.loadBootstrap,
      loadCompanies: sessionActions.loadCompanies,
      logout: sessionActions.logout,
      navigateToWorkspaceView: workspaceActions.navigateToWorkspaceView,
      refreshWorkspaceData: dataActions.refreshWorkspaceData,
      renderCompaniesPage: workspaceActions.renderCompaniesPage,
      renderWorkspacePage: workspaceActions.renderWorkspacePage,
      submitClock: dataActions.submitClock,
    });
  }

  return Object.freeze({ create });
});
