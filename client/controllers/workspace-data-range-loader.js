(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceDataRangeLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create() {
    function resolveOrganizationId(state = {}) {
      return state.selectedOrganizationId || state.bootstrap?.organizationContext?.id || "";
    }

    function hasLoadedRange(currentData = {}, organizationId = "", range = {}) {
      return currentData.loadedOrganizationId === organizationId
        && currentData.dateFrom === range.dateFrom
        && currentData.dateTo === range.dateTo;
    }

    async function loadRangeData(options = {}) {
      const {
        applyData,
        currentData,
        force = false,
        organizationId = "",
        range = {},
        request,
        resetData,
        setLoading,
      } = options;

      if (typeof applyData !== "function"
        || typeof request !== "function"
        || typeof resetData !== "function"
        || typeof setLoading !== "function") {
        throw new Error("WorkMateWorkspaceDataRangeLoader requires range loader callbacks.");
      }

      if (!organizationId) {
        resetData();
        setLoading(false);
        return null;
      }

      if (!force && hasLoadedRange(currentData, organizationId, range)) {
        return currentData;
      }

      setLoading(true);

      try {
        const payload = await request({ organizationId, range });
        return applyData(payload, { organizationId, range });
      } finally {
        setLoading(false);
      }
    }

    return Object.freeze({
      hasLoadedRange,
      loadRangeData,
      resolveOrganizationId,
    });
  }

  return Object.freeze({
    create,
  });
});
