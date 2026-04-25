(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceSessionDataLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultAttendanceRecordsState,
      rangeLoader,
      renderers,
      state,
    } = dependencies;

    if (!api || typeof createDefaultAttendanceRecordsState !== "function" || !rangeLoader || !renderers || !state) {
      throw new Error("WorkMateWorkspaceSessionDataLoader requires session data dependencies.");
    }

    async function requestCalendarBackedSessions({ organizationId, range }) {
      const sessionsQuery = new URLSearchParams({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        organizationId,
      });
      const calendarQuery = new URLSearchParams({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      const [payload, calendarPayload] = await Promise.all([
        api.requestWithAutoRefresh(`/v1/attendance/sessions?${sessionsQuery.toString()}`),
        api.requestWithAutoRefresh(`/v1/orgs/${organizationId}/schedule-calendar?${calendarQuery.toString()}`),
      ]);

      return { calendarPayload, payload };
    }

    function buildSessionData({ calendarPayload, payload }, { organizationId, range }) {
      return {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        leaveRequests: Array.isArray(calendarPayload?.leaveRequests) ? calendarPayload.leaveRequests : [],
        loadedOrganizationId: organizationId,
        sessions: Array.isArray(payload?.items) ? payload.items : [],
      };
    }

    async function loadSessionRangeData(options = {}) {
      const {
        currentData,
        force = false,
        loadingKey,
        range,
        targetKey,
      } = options;
      const organizationId = rangeLoader.resolveOrganizationId(state);

      return rangeLoader.loadRangeData({
        applyData: (payload, meta) => {
          state[targetKey] = buildSessionData(payload, meta);
          return state[targetKey];
        },
        currentData,
        force,
        organizationId,
        range,
        request: requestCalendarBackedSessions,
        resetData: () => {
          state[targetKey] = createDefaultAttendanceRecordsState();
        },
        setLoading: (loading) => {
          state[loadingKey] = loading;
        },
      });
    }

    async function loadAttendanceRecordsData({ force = false } = {}) {
      return loadSessionRangeData({
        currentData: state.attendanceRecordsData,
        force,
        loadingKey: "attendanceRecordsLoading",
        range: renderers.getAttendanceRequestRange(state.attendanceViewMode, state.attendanceDateCursor),
        targetKey: "attendanceRecordsData",
      });
    }

    async function loadReportRecordsData({ force = false } = {}) {
      return loadSessionRangeData({
        currentData: state.reportRecordsData,
        force,
        loadingKey: "reportRecordsLoading",
        range: renderers.getReportRequestRange(state.reportDateCursor),
        targetKey: "reportRecordsData",
      });
    }

    return Object.freeze({
      loadAttendanceRecordsData,
      loadReportRecordsData,
    });
  }

  return Object.freeze({
    create,
  });
});
