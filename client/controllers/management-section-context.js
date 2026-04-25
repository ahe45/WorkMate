(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementSectionContext = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      DEFAULT_MANAGEMENT_SECTION,
      state,
    } = dependencies;

    if (!appConfig || !state) {
      throw new Error("WorkMateManagementSectionContext requires appConfig and state.");
    }

    function normalizeManagementSection(value = "") {
      const normalized = String(value || "").trim();
      const availableSections = (appConfig.managementMenuSections || [])
        .flatMap((section) => Array.isArray(section?.items) ? section.items : [])
        .map((item) => String(item?.key || "").trim())
        .filter(Boolean);

      return availableSections.includes(normalized) ? normalized : DEFAULT_MANAGEMENT_SECTION;
    }

    function isWorkspaceGridContext() {
      if (currentPage !== "workspace") {
        return false;
      }

      if (["dashboard", "attendance", "leave", "reports"].includes(state.currentWorkspaceView)) {
        return true;
      }

      return state.currentWorkspaceView === "management"
        && ["worksites", "job-titles", "work-schedules"].includes(normalizeManagementSection(state.managementSection));
    }

    return Object.freeze({
      isWorkspaceGridContext,
      normalizeManagementSection,
    });
  }

  return Object.freeze({ create });
});
