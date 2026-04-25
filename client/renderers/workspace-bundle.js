(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceRendererBundle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      shared,
    } = dependencies;

    if (!shared) {
      throw new Error("WorkMateWorkspaceRendererBundle requires shared renderer context.");
    }

    const resolverModule = globalThis.WorkMateRendererModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/renderers/module-resolver.js must be loaded before client/renderers/workspace-bundle.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const schedulesRendererModule = resolve(
      runtime,
      "WorkMateSchedulesRenderer",
      "./workspace/schedules.js",
      "client/renderers/workspace/schedules.js must be loaded before client/app/page-bootstrap.js.",
    );
    const leaveRendererModule = resolve(
      runtime,
      "WorkMateLeaveRenderer",
      "./workspace/leave.js",
      "client/renderers/workspace/leave.js must be loaded before client/app/page-bootstrap.js.",
    );
    const dashboardRendererModule = resolve(
      runtime,
      "WorkMateDashboardRenderer",
      "./workspace/dashboard.js",
      "client/renderers/workspace/dashboard.js must be loaded before client/app/page-bootstrap.js.",
    );
    const attendanceRendererModule = resolve(
      runtime,
      "WorkMateAttendanceRenderer",
      "./workspace/attendance.js",
      "client/renderers/workspace/attendance.js must be loaded before client/app/page-bootstrap.js.",
    );
    const reportsRendererModule = resolve(
      runtime,
      "WorkMateReportsRenderer",
      "./workspace/reports.js",
      "client/renderers/workspace/reports.js must be loaded before client/app/page-bootstrap.js.",
    );
    const summaryRendererModule = resolve(
      runtime,
      "WorkMateSummaryRenderer",
      "./workspace/summary.js",
      "client/renderers/workspace/summary.js must be loaded before client/app/page-bootstrap.js.",
    );

    const schedulesRenderer = schedulesRendererModule.create({
      SCHEDULE_DAY_NAMES: shared.SCHEDULE_DAY_NAMES,
      SCHEDULE_VIEW_MODES: shared.SCHEDULE_VIEW_MODES,
      SCHEDULE_WEEK_DAY_NAMES: shared.SCHEDULE_WEEK_DAY_NAMES,
      addScheduleDays: shared.addScheduleDays,
      buildProjectedShiftInstance: shared.buildProjectedShiftInstance,
      buildScheduleEntryFromLeave: shared.buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift: shared.buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups: shared.buildScheduleUserFilterGroups,
      buildStats: shared.buildStats,
      cloneScheduleDate: shared.cloneScheduleDate,
      escapeAttribute: shared.escapeAttribute,
      escapeHtml: shared.escapeHtml,
      formatNumber: shared.formatNumber,
      formatScheduleDateKey: shared.formatScheduleDateKey,
      formatScheduleRangeLabel: shared.formatScheduleRangeLabel,
      formatTime: shared.formatTime,
      formatTimeRange: shared.formatTimeRange,
      getScheduleRequestRange: shared.getScheduleRequestRange,
      getScheduleTypeMeta: shared.getScheduleTypeMeta,
      getScheduleUserUnitName: shared.getScheduleUserUnitName,
      iterateScheduleDates: shared.iterateScheduleDates,
      normalizeScheduleViewMode: shared.normalizeScheduleViewMode,
      parseScheduleDate: shared.parseScheduleDate,
      renderEmptyState: shared.renderEmptyState,
      renderTableCheckboxFilterMenu: shared.renderTableCheckboxFilterMenu,
      toArray: shared.toArray,
    });
    const { renderScheduleView } = schedulesRenderer;

    const leaveRenderer = leaveRendererModule.create({
      buildLeaveBalanceRecords: shared.buildLeaveBalanceRecords,
      buildStats: shared.buildStats,
      escapeHtml: shared.escapeHtml,
      formatLeaveDays: shared.formatLeaveDays,
      formatNumber: shared.formatNumber,
      renderDashboardFilterMenu: shared.renderDashboardFilterMenu,
      renderDashboardGridTable: shared.renderDashboardGridTable,
      renderMetricCard: shared.renderMetricCard,
    });
    const { renderLeaveView } = leaveRenderer;

    const dashboardRenderer = dashboardRendererModule.create({
      buildDashboardRecords: shared.buildDashboardRecords,
      buildStats: shared.buildStats,
      escapeAttribute: shared.escapeAttribute,
      escapeHtml: shared.escapeHtml,
      formatNumber: shared.formatNumber,
      normalizeDashboardStatusFilter: shared.normalizeDashboardStatusFilter,
      renderBadge: shared.renderBadge,
      renderDashboardDetailButton: shared.renderDashboardDetailButton,
      renderDashboardDetailModal: shared.renderDashboardDetailModal,
      renderDashboardFilterMenu: shared.renderDashboardFilterMenu,
      renderDashboardGridTable: shared.renderDashboardGridTable,
      renderDashboardMonthlyWorkStats: shared.renderDashboardMonthlyWorkStats,
      renderDashboardSummaryModal: shared.renderDashboardSummaryModal,
    });
    const { renderDashboardView } = dashboardRenderer;

    const attendanceRenderer = attendanceRendererModule.create({
      ATTENDANCE_VIEW_MODES: shared.ATTENDANCE_VIEW_MODES,
      SCHEDULE_DAY_NAMES: shared.SCHEDULE_DAY_NAMES,
      buildStats: shared.buildStats,
      escapeAttribute: shared.escapeAttribute,
      escapeHtml: shared.escapeHtml,
      filterPersonalScopeItems: shared.filterPersonalScopeItems,
      formatAttendanceMinutes: shared.formatAttendanceMinutes,
      formatAttendanceRangeLabel: shared.formatAttendanceRangeLabel,
      formatNumber: shared.formatNumber,
      formatScheduleDateKey: shared.formatScheduleDateKey,
      formatTime: shared.formatTime,
      formatTimeRange: shared.formatTimeRange,
      getAttendanceDetailStatusMeta: shared.getAttendanceDetailStatusMeta,
      getAttendanceRequestRange: shared.getAttendanceRequestRange,
      getScheduleUserUnitName: shared.getScheduleUserUnitName,
      iterateScheduleDates: shared.iterateScheduleDates,
      normalizeAttendanceDateKey: shared.normalizeAttendanceDateKey,
      normalizeAttendanceViewMode: shared.normalizeAttendanceViewMode,
      parseJsonObject: shared.parseJsonObject,
      renderBadge: shared.renderBadge,
      renderDashboardFilterMenu: shared.renderDashboardFilterMenu,
      renderDashboardGridTable: shared.renderDashboardGridTable,
      renderEmptyState: shared.renderEmptyState,
      toArray: shared.toArray,
    });
    const { renderAttendanceView } = attendanceRenderer;

    const reportsRenderer = reportsRendererModule.create({
      buildStats: shared.buildStats,
      escapeAttribute: shared.escapeAttribute,
      escapeHtml: shared.escapeHtml,
      filterPersonalScopeItems: shared.filterPersonalScopeItems,
      formatNumber: shared.formatNumber,
      formatReportRangeLabel: shared.formatReportRangeLabel,
      formatScheduleDateKey: shared.formatScheduleDateKey,
      getDashboardGridState: shared.getDashboardGridState,
      getReportRequestRange: shared.getReportRequestRange,
      iterateScheduleDates: shared.iterateScheduleDates,
      normalizeAttendanceDateKey: shared.normalizeAttendanceDateKey,
      parseJsonObject: shared.parseJsonObject,
      renderDashboardFilterMenu: shared.renderDashboardFilterMenu,
      renderDashboardGridTable: shared.renderDashboardGridTable,
      renderEmptyState: shared.renderEmptyState,
      renderMetricCard: shared.renderMetricCard,
      resolveDashboardGridRecords: shared.resolveDashboardGridRecords,
      toArray: shared.toArray,
    });
    const { renderReportsView } = reportsRenderer;

    const summaryRenderer = summaryRendererModule.create({
      buildStats: shared.buildStats,
      escapeHtml: shared.escapeHtml,
      formatDate: shared.formatDate,
      formatNumber: shared.formatNumber,
      getViewMeta: shared.getViewMeta,
      renderBadge: shared.renderBadge,
      renderBarList: shared.renderBarList,
      renderMetricCard: shared.renderMetricCard,
      renderMiniItem: shared.renderMiniItem,
      renderMiniList: shared.renderMiniList,
      renderTimelineItem: shared.renderTimelineItem,
      summarizeRoles: shared.summarizeRoles,
    });
    const { renderSummaryView } = summaryRenderer;

    return Object.freeze({
      renderAttendanceView,
      renderDashboardView,
      renderLeaveView,
      renderReportsView,
      renderScheduleView,
      renderSummaryView,
    });
  }

  return Object.freeze({ create });
});
