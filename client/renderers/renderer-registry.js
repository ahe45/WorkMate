(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateRendererRegistry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      htmlUtils,
    } = dependencies;

    if (!appConfig || !htmlUtils) {
      throw new Error("WorkMateRendererRegistry requires renderer dependencies.");
    }

    const sharedBundleModule = globalThis.WorkMateSharedRendererBundle
      || (typeof require === "function" ? require("./shared-bundle.js") : null);
    if (!sharedBundleModule || typeof sharedBundleModule.create !== "function") {
      throw new Error("client/renderers/shared-bundle.js must be loaded before client/renderers/renderer-registry.js.");
    }

    const shared = sharedBundleModule.create({
      appConfig,
      currentPage,
      htmlUtils,
    });

    if (currentPage === "companies") {
      const companiesRendererModule = globalThis.WorkMateCompaniesRenderer
        || (typeof require === "function" ? require("./companies.js") : null);

      if (!companiesRendererModule || typeof companiesRendererModule.create !== "function") {
        throw new Error("client/renderers/companies.js must be loaded before client/renderers/renderer-registry.js.");
      }

      const companiesRenderer = companiesRendererModule.create({
        COMPANY_PAGE_META: shared.COMPANY_PAGE_META,
        escapeAttribute: shared.escapeAttribute,
        escapeHtml: shared.escapeHtml,
        formatNumber: shared.formatNumber,
        renderEmptyState: shared.renderEmptyState,
        toArray: shared.toArray,
      });

      return Object.freeze({
        COMPANY_PAGE_META: shared.COMPANY_PAGE_META,
        buildManagementWorkPolicyHolidayDateRules: () => [],
        buildStats: shared.buildStats,
        buildWeekdayTemplateDays: () => [],
        calculateManagementWorkPolicyStageMetrics: () => ({}),
        getAttendanceRequestRange: () => ({}),
        getReportRequestRange: () => ({}),
        getScheduleRequestRange: () => ({}),
        getViewMeta: shared.getViewMeta,
        normalizeAttendanceViewMode: (viewMode = "") => String(viewMode || "").trim().toLowerCase() || "month",
        normalizeScheduleViewMode: (viewMode = "") => String(viewMode || "").trim().toLowerCase() || "month",
        renderCompaniesView: companiesRenderer.renderCompaniesView,
        renderManagementWorkPolicyAdjustmentRow: () => "",
        renderManagementWorkPolicyBreakAutoRangeRow: () => "",
        renderSidebarNavigation: shared.renderSidebarNavigation,
        renderTopbarChips: shared.renderTopbarChips,
        renderWorkspaceView: () => "",
      });
    }

    const workspaceBundleModule = globalThis.WorkMateWorkspaceRendererBundle
      || (typeof require === "function" ? require("./workspace-bundle.js") : null);
    const managementBundleModule = globalThis.WorkMateManagementRendererBundle
      || (typeof require === "function" ? require("./management-bundle.js") : null);

    if (!workspaceBundleModule || typeof workspaceBundleModule.create !== "function") {
      throw new Error("client/renderers/workspace-bundle.js must be loaded before client/renderers/renderer-registry.js.");
    }

    if (!managementBundleModule || typeof managementBundleModule.create !== "function") {
      throw new Error("client/renderers/management-bundle.js must be loaded before client/renderers/renderer-registry.js.");
    }

    const workspaceBundle = workspaceBundleModule.create({ shared });
    const managementBundle = managementBundleModule.create({
      appConfig,
      shared,
    });

    function renderWorkspaceView(view = appConfig.defaultWorkspaceView, state = {}) {
      const normalizedView = appConfig.normalizeWorkspaceView(view);

      if (normalizedView === "dashboard") {
        return workspaceBundle.renderDashboardView(state);
      }

      if (normalizedView === "schedules") {
        return workspaceBundle.renderScheduleView(state);
      }

      if (normalizedView === "attendance") {
        return workspaceBundle.renderAttendanceView(state);
      }

      if (normalizedView === "leave") {
        return workspaceBundle.renderLeaveView(state);
      }

      if (normalizedView === "reports") {
        return workspaceBundle.renderReportsView(state);
      }

      if (normalizedView === "management") {
        return managementBundle.renderManagementView(state);
      }

      return workspaceBundle.renderSummaryView(normalizedView, state);
    }

    return Object.freeze({
      COMPANY_PAGE_META: shared.COMPANY_PAGE_META,
      buildManagementWorkPolicyHolidayDateRules: managementBundle.buildManagementWorkPolicyHolidayDateRules,
      buildStats: shared.buildStats,
      buildWeekdayTemplateDays: shared.buildWeekdayTemplateDays,
      calculateManagementWorkPolicyStageMetrics: managementBundle.calculateManagementWorkPolicyStageMetrics,
      getAttendanceRequestRange: shared.getAttendanceRequestRange,
      getReportRequestRange: shared.getReportRequestRange,
      getScheduleRequestRange: shared.getScheduleRequestRange,
      getViewMeta: shared.getViewMeta,
      normalizeAttendanceViewMode: shared.normalizeAttendanceViewMode,
      normalizeScheduleViewMode: shared.normalizeScheduleViewMode,
      renderManagementWorkPolicyAdjustmentRow: managementBundle.renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow: managementBundle.renderManagementWorkPolicyBreakAutoRangeRow,
      renderSidebarNavigation: shared.renderSidebarNavigation,
      renderTopbarChips: shared.renderTopbarChips,
      renderWorkspaceView,
    });
  }

  return Object.freeze({ create });
});
