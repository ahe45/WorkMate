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

    let navigationController = null;

    function hasStoredTokens() {
      return Boolean(api.getAccessToken() || api.getRefreshToken());
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

    function handleProtectedFailure(error) {
      if (error?.status === 401) {
        api.clearAuthTokens();
        persistSelectedOrganizationId("");
        navigateTo(appConfig.loginRoutePath, true);
        return true;
      }

      return false;
    }

    function renderCompaniesPage() {
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

      if (view !== "dashboard") {
        state.dashboardDetailUserId = "";
        state.dashboardSummaryFilter = "";
      }

      const isManagementGridView = view === "management"
        && ["worksites", "job-titles", "work-schedules"].includes(normalizeManagementSection(state.managementSection));

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

    async function resolveMe() {
      const payload = await api.requestWithAutoRefresh("/v1/me");
      state.user = payload?.user || null;
      updateUserMeta();
      return state.user;
    }

    async function loadCompanies() {
      const payload = await api.requestWithAutoRefresh("/v1/account/organizations");
      state.companies = Array.isArray(payload?.items) ? payload.items : [];

      if (state.selectedOrganizationId && !getSelectedCompany()) {
        persistSelectedOrganizationId("");
      }

      return state.companies;
    }

    async function loadBootstrap(organizationId = state.selectedOrganizationId) {
      if (!organizationId) {
        state.bootstrap = null;
        state.dashboardDetailUserId = "";
        state.dashboardGridFilterMenu = null;
        state.dashboardGrids = createDefaultDashboardGridState();
        state.dashboardSummaryFilter = "";
        resetScheduleCalendarState();
        resetAttendanceRecordsState();
        resetReportRecordsState();
        return null;
      }

      state.dashboardDetailUserId = "";
      state.dashboardGridFilterMenu = null;
      state.dashboardGrids = createDefaultDashboardGridState();
      state.dashboardSummaryFilter = "";
      state.scheduleCalendarData = createDefaultScheduleCalendarState();
      state.scheduleCalendarLoading = false;
      state.attendanceRecordsData = createDefaultAttendanceRecordsState();
      state.attendanceRecordsLoading = false;
      state.reportRecordsData = createDefaultAttendanceRecordsState();
      state.reportRecordsLoading = false;
      const query = new URLSearchParams({ organizationId });
      state.bootstrap = await api.requestWithAutoRefresh(`/v1/bootstrap?${query.toString()}`);
      return state.bootstrap;
    }

    async function refreshWorkspaceData() {
      await loadCompanies();
      await loadBootstrap();

      if (state.currentWorkspaceView === "schedules") {
        await loadScheduleCalendarData({ force: true });
      }

      if (state.currentWorkspaceView === "attendance") {
        await loadAttendanceRecordsData({ force: true });
      }

      if (state.currentWorkspaceView === "reports") {
        await loadReportRecordsData({ force: true });
      }

      if (state.currentWorkspaceView === "management" && normalizeManagementSection(state.managementSection) === "holidays") {
        await loadManagementHolidayData({ force: true });
      }

      renderWorkspacePage();
    }

    async function submitClock(simulateOnly) {
      const payload = {
        eventType: document.getElementById("clock-event-type")?.value || "CLOCK_IN",
        occurredAt: new Date().toISOString(),
        signals: {
          gps: {
            accuracyMeters: 20,
            lat: Number(document.getElementById("clock-lat")?.value || 0),
            lng: Number(document.getElementById("clock-lng")?.value || 0),
          },
        },
        siteId: document.getElementById("clock-site")?.value || "",
        sourceType: "WEB",
        userId: document.getElementById("clock-user")?.value || "",
      };
      const endpoint = simulateOnly ? "/v1/clock/validate" : "/v1/clock/events";
      const result = await api.requestWithAutoRefresh(endpoint, {
        body: JSON.stringify(payload),
        method: "POST",
      });

      setClockOutput(JSON.stringify(result, null, 2));

      if (!simulateOnly) {
        await refreshWorkspaceData();
        setClockOutput(JSON.stringify(result, null, 2));
      }
    }

    async function logout() {
      try {
        if (api.getRefreshToken()) {
          await api.apiRequest("/v1/auth/logout", {
            body: JSON.stringify({ refreshToken: api.getRefreshToken() }),
            method: "POST",
          });
        }
      } catch (error) {
        // Ignore logout failures.
      }

      api.clearAuthTokens();
      persistSelectedOrganizationId("");
      state.bootstrap = null;
      state.companies = [];
      state.dashboardDetailUserId = "";
      resetManagementHolidayState();
      resetScheduleCalendarState();
      resetAttendanceRecordsState();
      resetReportRecordsState();
      state.user = null;
      navigateTo(appConfig.loginRoutePath, true);
    }

    async function initAuthPage() {
      if (!hasStoredTokens()) {
        return;
      }

      try {
        await resolveMe();
        await loadCompanies();
        navigateTo(appConfig.companiesRoutePath, true);
      } catch (error) {
        api.clearAuthTokens();
        persistSelectedOrganizationId("");
      }
    }

    async function initCompaniesPage() {
      if (!hasStoredTokens()) {
        navigateTo(appConfig.loginRoutePath, true);
        return;
      }

      setLoading("회사 목록을 불러오는 중입니다.");

      try {
        await resolveMe();
        await loadCompanies();
        renderCompaniesPage();
      } catch (error) {
        if (!handleProtectedFailure(error)) {
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

      if (!hasStoredTokens()) {
        navigateTo(appConfig.loginRoutePath, true);
        return;
      }

      setLoading("워크스페이스를 불러오는 중입니다.");
      state.currentWorkspaceView = route.view;

      try {
        await resolveMe();
        await loadCompanies();

        const company = findCompanyByCode(route.companyCode);

        if (!company) {
          persistSelectedOrganizationId("");
          navigateTo(appConfig.companiesRoutePath, true);
          return;
        }

        persistSelectedOrganizationId(company.id);
        await loadBootstrap(company.id);

        if (route.view === "schedules") {
          await loadScheduleCalendarData({ force: true });
        }

        if (route.view === "attendance") {
          await loadAttendanceRecordsData({ force: true });
        }

        if (route.view === "reports") {
          await loadReportRecordsData({ force: true });
        }

        ensureNavigationController();
        renderWorkspacePage();
      } catch (error) {
        if (!handleProtectedFailure(error)) {
          window.alert(error.message || "워크스페이스를 불러오는 중입니다.");
        }
      }
    }

    return Object.freeze({
      handleProtectedFailure,
      initAuthPage,
      initCompaniesPage,
      initWorkspacePage,
      loadBootstrap,
      loadCompanies,
      logout,
      navigateToWorkspaceView,
      refreshWorkspaceData,
      renderCompaniesPage,
      renderWorkspacePage,
      submitClock,
    });
  }

  return Object.freeze({ create });
});
