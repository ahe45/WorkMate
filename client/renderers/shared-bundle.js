(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateSharedRendererBundle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      htmlUtils,
    } = dependencies;

    if (!appConfig || !htmlUtils) {
      throw new Error("WorkMateSharedRendererBundle requires renderer dependencies.");
    }

    const resolverModule = globalThis.WorkMateRendererModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/renderers/module-resolver.js must be loaded before client/renderers/shared-bundle.js.");
    }

    const { escapeAttribute, escapeHtml } = htmlUtils;
    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const formattersModule = resolve(
      runtime,
      "WorkMateRendererFormatters",
      "./common/formatters.js",
      "client/renderers/common/formatters.js must be loaded before client/app/page-bootstrap.js.",
    );
    const displayModule = resolve(
      runtime,
      "WorkMateRendererDisplay",
      "./common/display.js",
      "client/renderers/common/display.js must be loaded before client/app/page-bootstrap.js.",
    );
    const workspaceStatsModule = resolve(
      runtime,
      "WorkMateWorkspaceStats",
      "./workspace/stats.js",
      "client/renderers/workspace/stats.js must be loaded before client/app/page-bootstrap.js.",
    );
    const shellRendererModule = resolve(
      runtime,
      "WorkMateShellRenderer",
      "./shell.js",
      "client/renderers/shell.js must be loaded before client/app/page-bootstrap.js.",
    );
    const {
      formatAttendanceMinutes,
      formatDate,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      parseJsonObject,
      toArray,
    } = formattersModule.create();
    const {
      renderBadge,
      renderBarList,
      renderEmptyState,
      renderMetricCard,
      renderMiniItem,
      renderMiniList,
      renderTimelineItem,
    } = displayModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
    });
    const {
      buildStats,
      filterPersonalScopeItems,
    } = workspaceStatsModule.create({
      toArray,
    });

    const shellRenderer = shellRendererModule.create({
      appConfig,
      buildStats,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderBadge,
      toArray,
    });
    const {
      COMPANY_PAGE_META,
      getViewMeta,
      renderSidebarNavigation,
      renderTopbarChips,
      summarizeRoles,
    } = shellRenderer;

    if (currentPage !== "workspace") {
      return Object.freeze({
        COMPANY_PAGE_META,
        buildStats,
        escapeAttribute,
        escapeHtml,
        filterPersonalScopeItems,
        formatDate,
        formatNumber,
        formatTime,
        getViewMeta,
        parseJsonObject,
        renderEmptyState,
        renderSidebarNavigation,
        renderTopbarChips,
        summarizeRoles,
        toArray,
      });
    }

    const statusMetaModule = resolve(
      runtime,
      "WorkMateRendererStatusMeta",
      "./common/status-meta.js",
      "client/renderers/common/status-meta.js must be loaded before client/app/page-bootstrap.js.",
    );
    const workPolicyUtilsModule = resolve(
      runtime,
      "WorkMateManagementWorkPolicyUtils",
      "./management/work-policy-utils.js",
      "client/renderers/management/work-policy-utils.js must be loaded before client/app/page-bootstrap.js.",
    );
    const dashboardGridRendererModule = resolve(
      runtime,
      "WorkMateDashboardGridRenderer",
      "./workspace/dashboard-grid.js",
      "client/renderers/workspace/dashboard-grid.js must be loaded before client/app/page-bootstrap.js.",
    );
    const dashboardTableRendererModule = resolve(
      runtime,
      "WorkMateDashboardTableRenderer",
      "./workspace/dashboard-table.js",
      "client/renderers/workspace/dashboard-table.js must be loaded before client/app/page-bootstrap.js.",
    );
    const scheduleUtilsModule = resolve(
      runtime,
      "WorkMateScheduleUtils",
      "./workspace/schedule-utils.js",
      "client/renderers/workspace/schedule-utils.js must be loaded before client/app/page-bootstrap.js.",
    );

    const {
      getApprovalStatusMeta,
      getAttendanceDetailStatusMeta,
      getScheduleTypeMeta,
      normalizeAttendanceDateKey,
    } = statusMetaModule.create({
      parseJsonObject,
    });
    const { buildWeekdayTemplateDays } = workPolicyUtilsModule.create();

    const LOCAL_ATTENDANCE_VIEW_MODES = Object.freeze(["month", "list"]);

    function normalizeAttendanceViewMode(viewMode = "") {
      const normalized = String(viewMode || "").trim().toLowerCase();
      return LOCAL_ATTENDANCE_VIEW_MODES.includes(normalized) ? normalized : "month";
    }

    const dashboardGridRenderer = dashboardGridRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatAttendanceMinutes,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getApprovalStatusMeta,
      getScheduleTypeMeta,
      renderBadge,
      renderMiniItem,
      renderMiniList,
    });
    const {
      getDashboardScheduleMeta,
      getDashboardTimeSortValue,
      getDashboardWorkStatusMeta,
      normalizeDashboardStatusFilter,
      renderDashboardDetailButton,
      renderDashboardDetailModal,
      renderDashboardSummaryModal,
    } = dashboardGridRenderer;

    const dashboardTableRenderer = dashboardTableRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatAttendanceMinutes,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getApprovalStatusMeta,
      getDashboardScheduleMeta,
      getDashboardTimeSortValue,
      getDashboardWorkStatusMeta,
    });
    const {
      buildDashboardRecords,
      buildLeaveBalanceRecords,
      formatLeaveDays,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderDashboardMonthlyWorkStats,
      renderTableCheckboxFilterMenu,
      resolveDashboardGridRecords,
    } = dashboardTableRenderer;

    const scheduleUtils = scheduleUtilsModule.create({
      formatTime,
      formatTimeRange,
      getScheduleTypeMeta,
      normalizeAttendanceViewMode,
      toArray,
    });
    const {
      ATTENDANCE_VIEW_MODES,
      SCHEDULE_DAY_NAMES,
      SCHEDULE_VIEW_MODES,
      SCHEDULE_WEEK_DAY_NAMES,
      addScheduleDays,
      buildProjectedShiftInstance,
      buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups,
      cloneScheduleDate,
      formatAttendanceRangeLabel,
      formatReportRangeLabel,
      formatScheduleDateKey,
      formatScheduleRangeLabel,
      getAttendanceRequestRange,
      getReportRequestRange,
      getScheduleRequestRange,
      getScheduleUserUnitName,
      iterateScheduleDates,
      normalizeScheduleViewMode,
      parseScheduleDate,
    } = scheduleUtils;

    return Object.freeze({
      ATTENDANCE_VIEW_MODES,
      COMPANY_PAGE_META,
      SCHEDULE_DAY_NAMES,
      SCHEDULE_VIEW_MODES,
      SCHEDULE_WEEK_DAY_NAMES,
      addScheduleDays,
      buildDashboardRecords,
      buildLeaveBalanceRecords,
      buildProjectedShiftInstance,
      buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups,
      buildStats,
      buildWeekdayTemplateDays,
      cloneScheduleDate,
      escapeAttribute,
      escapeHtml,
      filterPersonalScopeItems,
      formatAttendanceMinutes,
      formatAttendanceRangeLabel,
      formatDate,
      formatDateRange,
      formatLeaveDays,
      formatNumber,
      formatReportRangeLabel,
      formatScheduleDateKey,
      formatScheduleRangeLabel,
      formatTime,
      formatTimeRange,
      getApprovalStatusMeta,
      getAttendanceDetailStatusMeta,
      getAttendanceRequestRange,
      getDashboardGridState,
      getDashboardScheduleMeta,
      getDashboardTimeSortValue,
      getDashboardWorkStatusMeta,
      getReportRequestRange,
      getScheduleRequestRange,
      getScheduleTypeMeta,
      getScheduleUserUnitName,
      getViewMeta,
      hasDashboardGridFilter,
      iterateScheduleDates,
      normalizeAttendanceDateKey,
      normalizeAttendanceViewMode,
      normalizeDashboardStatusFilter,
      normalizeScheduleViewMode,
      parseJsonObject,
      parseScheduleDate,
      renderBadge,
      renderBarList,
      renderDashboardDetailButton,
      renderDashboardDetailModal,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderDashboardMonthlyWorkStats,
      renderDashboardSummaryModal,
      renderEmptyState,
      renderMetricCard,
      renderMiniItem,
      renderMiniList,
      renderSidebarNavigation,
      renderTableCheckboxFilterMenu,
      renderTimelineItem,
      renderTopbarChips,
      resolveDashboardGridRecords,
      summarizeRoles,
      toArray,
    });
  }

  return Object.freeze({ create });
});
