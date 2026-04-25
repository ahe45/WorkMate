(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceHolidayDataLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      CURRENT_YEAR,
      api,
      createDefaultManagementHolidayData,
      rangeLoader,
      resetManagementHolidayState,
      state,
    } = dependencies;

    if (!api || typeof createDefaultManagementHolidayData !== "function" || !rangeLoader || typeof resetManagementHolidayState !== "function" || !state) {
      throw new Error("WorkMateWorkspaceHolidayDataLoader requires holiday data dependencies.");
    }

    function createHolidayLoadingState(organizationId, year) {
      return createDefaultManagementHolidayData({
        calendarCode: String(state.managementHolidayData?.calendarCode || "").trim(),
        calendarId: String(state.managementHolidayData?.calendarId || "").trim(),
        calendarName: String(state.managementHolidayData?.calendarName || "").trim(),
        loadedOrganizationId: organizationId,
        year,
      });
    }

    async function loadManagementHolidayData({ force = false, year = state.managementHolidayYear } = {}) {
      const organizationId = rangeLoader.resolveOrganizationId(state);
      const normalizedYear = Math.max(1900, Math.min(2100, Number(year) || CURRENT_YEAR));

      if (!organizationId) {
        resetManagementHolidayState();
        return null;
      }

      const alreadyLoaded = !force
        && state.managementHolidayData.loadedOrganizationId === organizationId
        && Number(state.managementHolidayData.year || 0) === normalizedYear;

      if (alreadyLoaded) {
        return state.managementHolidayData;
      }

      state.managementHolidayYear = normalizedYear;
      state.managementHolidayData = createHolidayLoadingState(organizationId, normalizedYear);
      state.managementHolidayLoading = true;

      try {
        const query = new URLSearchParams({
          year: String(normalizedYear),
        });
        const payload = await api.requestWithAutoRefresh(`/v1/orgs/${organizationId}/holidays?${query.toString()}`);

        state.managementHolidayData = createDefaultManagementHolidayData({
          calendarCode: String(payload?.calendarCode || "").trim(),
          calendarId: String(payload?.calendarId || "").trim(),
          calendarName: String(payload?.calendarName || "").trim(),
          items: Array.isArray(payload?.items) ? payload.items : [],
          loadedOrganizationId: organizationId,
          notices: Array.isArray(payload?.notices) ? payload.notices : [],
          summary: payload?.summary && typeof payload.summary === "object"
            ? {
              customHolidayCount: Number(payload.summary.customHolidayCount || 0),
              holidayCount: Number(payload.summary.holidayCount || 0),
              lunarHolidayCount: Number(payload.summary.lunarHolidayCount || 0),
              nationalHolidayCount: Number(payload.summary.nationalHolidayCount || 0),
              substituteHolidayCount: Number(payload.summary.substituteHolidayCount || 0),
              totalCount: Number(payload.summary.totalCount || 0),
            }
            : createDefaultManagementHolidayData().summary,
          year: Number(payload?.year || normalizedYear) || normalizedYear,
        });
        state.managementHolidayYear = Number(state.managementHolidayData.year || normalizedYear) || normalizedYear;
        return state.managementHolidayData;
      } finally {
        state.managementHolidayLoading = false;
      }
    }

    return Object.freeze({
      loadManagementHolidayData,
    });
  }

  return Object.freeze({
    create,
  });
});
