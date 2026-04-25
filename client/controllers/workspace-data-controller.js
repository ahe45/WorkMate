(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceDataController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkspaceDataController(dependencies = {}) {
    const {
      CURRENT_YEAR,
      api,
      createDefaultAttendanceRecordsState,
      createDefaultManagementHolidayData,
      createDefaultScheduleCalendarState,
      renderers,
      resetManagementHolidayState,
      state,
    } = dependencies;

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/workspace-data-controller.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const rangeLoaderModule = resolve(
      runtime,
      "WorkMateWorkspaceDataRangeLoader",
      "./workspace-data-range-loader.js",
      "client/controllers/workspace-data-range-loader.js must be loaded before client/controllers/workspace-data-controller.js.",
    );
    const scheduleLoaderModule = resolve(
      runtime,
      "WorkMateWorkspaceScheduleDataLoader",
      "./workspace-data-schedule-loader.js",
      "client/controllers/workspace-data-schedule-loader.js must be loaded before client/controllers/workspace-data-controller.js.",
    );
    const sessionLoaderModule = resolve(
      runtime,
      "WorkMateWorkspaceSessionDataLoader",
      "./workspace-data-session-loader.js",
      "client/controllers/workspace-data-session-loader.js must be loaded before client/controllers/workspace-data-controller.js.",
    );
    const holidayLoaderModule = resolve(
      runtime,
      "WorkMateWorkspaceHolidayDataLoader",
      "./workspace-data-holiday-loader.js",
      "client/controllers/workspace-data-holiday-loader.js must be loaded before client/controllers/workspace-data-controller.js.",
    );

    const rangeLoader = rangeLoaderModule.create();
    const scheduleLoader = scheduleLoaderModule.create({
      api,
      createDefaultScheduleCalendarState,
      rangeLoader,
      renderers,
      state,
    });
    const sessionLoader = sessionLoaderModule.create({
      api,
      createDefaultAttendanceRecordsState,
      rangeLoader,
      renderers,
      state,
    });
    const holidayLoader = holidayLoaderModule.create({
      CURRENT_YEAR,
      api,
      createDefaultManagementHolidayData,
      rangeLoader,
      resetManagementHolidayState,
      state,
    });

    return Object.freeze({
      loadAttendanceRecordsData: sessionLoader.loadAttendanceRecordsData,
      loadManagementHolidayData: holidayLoader.loadManagementHolidayData,
      loadReportRecordsData: sessionLoader.loadReportRecordsData,
      loadScheduleCalendarData: scheduleLoader.loadScheduleCalendarData,
    });
  }

  return Object.freeze({
    create: createWorkspaceDataController,
  });
});
