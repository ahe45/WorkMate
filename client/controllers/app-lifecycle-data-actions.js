(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppLifecycleDataActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultScheduleCalendarState,
      loadAttendanceRecordsData,
      loadCompanies,
      loadManagementHolidayData,
      loadReportRecordsData,
      loadScheduleCalendarData,
      normalizeManagementSection,
      renderWorkspacePage,
      resetAttendanceRecordsState,
      resetReportRecordsState,
      resetScheduleCalendarState,
      setClockOutput,
      state,
    } = dependencies;

    if (!api || !state || typeof renderWorkspacePage !== "function") {
      throw new Error("WorkMateAppLifecycleDataActions requires data lifecycle dependencies.");
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

    return Object.freeze({
      loadBootstrap,
      refreshWorkspaceData,
      submitClock,
    });
  }

  return Object.freeze({ create });
});
