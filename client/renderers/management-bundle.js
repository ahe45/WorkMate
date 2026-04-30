(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementRendererBundle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      shared,
    } = dependencies;

    if (!appConfig || !shared) {
      throw new Error("WorkMateManagementRendererBundle requires renderer dependencies.");
    }

    const resolverModule = globalThis.WorkMateRendererModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/renderers/module-resolver.js must be loaded before client/renderers/management-bundle.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const managementSettingsRendererModule = resolve(
      runtime,
      "WorkMateManagementSettingsRenderer",
      "./management/settings.js",
      "client/renderers/management/settings.js must be loaded before client/app/page-bootstrap.js.",
    );

    const managementSettingsRenderer = managementSettingsRendererModule.create({
      appConfig,
      buildStats: shared.buildStats,
      escapeAttribute: shared.escapeAttribute,
      escapeHtml: shared.escapeHtml,
      formatDate: shared.formatDate,
      formatDateRange: shared.formatDateRange,
      formatNumber: shared.formatNumber,
      formatTime: shared.formatTime,
      formatTimeRange: shared.formatTimeRange,
      getDashboardGridState: shared.getDashboardGridState,
      getScheduleTypeMeta: shared.getScheduleTypeMeta,
      hasDashboardGridFilter: shared.hasDashboardGridFilter,
      renderBadge: shared.renderBadge,
      renderDashboardFilterMenu: shared.renderDashboardFilterMenu,
      renderDashboardGridTable: shared.renderDashboardGridTable,
      renderEmptyState: shared.renderEmptyState,
      renderMetricCard: shared.renderMetricCard,
      resolveDashboardGridRecords: shared.resolveDashboardGridRecords,
      toArray: shared.toArray,
    });
    const {
      buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementView,
    } = managementSettingsRenderer;

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementView,
    });
  }

  return Object.freeze({ create });
});
