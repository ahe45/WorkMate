(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceScheduleDataLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultScheduleCalendarState,
      rangeLoader,
      renderers,
      state,
    } = dependencies;

    if (!api || typeof createDefaultScheduleCalendarState !== "function" || !rangeLoader || !renderers || !state) {
      throw new Error("WorkMateWorkspaceScheduleDataLoader requires schedule data dependencies.");
    }

    async function loadScheduleCalendarData({ force = false } = {}) {
      const organizationId = rangeLoader.resolveOrganizationId(state);
      const range = renderers.getScheduleRequestRange(state.scheduleViewMode, state.scheduleDateCursor);

      return rangeLoader.loadRangeData({
        applyData: (payload, { organizationId, range }) => {
          state.scheduleCalendarData = {
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            leaveRequests: Array.isArray(payload?.leaveRequests) ? payload.leaveRequests : [],
            loadedOrganizationId: organizationId,
            shiftInstances: Array.isArray(payload?.shiftInstances) ? payload.shiftInstances : [],
          };
          return state.scheduleCalendarData;
        },
        currentData: state.scheduleCalendarData,
        force,
        organizationId,
        range,
        request: async ({ organizationId, range }) => {
          const query = new URLSearchParams({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
          });

          return api.requestWithAutoRefresh(`/v1/orgs/${organizationId}/schedule-calendar?${query.toString()}`);
        },
        resetData: () => {
          state.scheduleCalendarData = createDefaultScheduleCalendarState();
        },
        setLoading: (loading) => {
          state.scheduleCalendarLoading = loading;
        },
      });
    }

    return Object.freeze({
      loadScheduleCalendarData,
    });
  }

  return Object.freeze({
    create,
  });
});
