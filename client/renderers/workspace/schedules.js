(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateSchedulesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createSchedulesRenderer(deps = {}) {
    const {
      SCHEDULE_DAY_NAMES,
      SCHEDULE_VIEW_MODES,
      SCHEDULE_WEEK_DAY_NAMES,
      addScheduleDays,
      buildProjectedShiftInstance,
      buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups,
      buildStats,
      cloneScheduleDate,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      formatScheduleDateKey,
      formatScheduleRangeLabel,
      getScheduleRequestRange,
      getScheduleTypeMeta,
      getScheduleUserUnitName,
      iterateScheduleDates,
      normalizeScheduleViewMode,
      parseScheduleDate,
      renderEmptyState,
      renderTableCheckboxFilterMenu,
      toArray,
    } = deps;

    const calendarModelModule = globalThis.WorkMateScheduleCalendarModel
      || (typeof require === "function" ? require("./schedule-calendar-model.js") : null);
    const toolbarRendererModule = globalThis.WorkMateScheduleToolbarRenderer
      || (typeof require === "function" ? require("./schedule-toolbar-renderer.js") : null);
    const boardRendererModule = globalThis.WorkMateScheduleBoardRenderer
      || (typeof require === "function" ? require("./schedule-board-renderer.js") : null);

    if (!calendarModelModule || typeof calendarModelModule.create !== "function") {
      throw new Error("client/renderers/workspace/schedule-calendar-model.js must be loaded before client/renderers/workspace/schedules.js.");
    }

    if (!toolbarRendererModule || typeof toolbarRendererModule.create !== "function") {
      throw new Error("client/renderers/workspace/schedule-toolbar-renderer.js must be loaded before client/renderers/workspace/schedules.js.");
    }

    if (!boardRendererModule || typeof boardRendererModule.create !== "function") {
      throw new Error("client/renderers/workspace/schedule-board-renderer.js must be loaded before client/renderers/workspace/schedules.js.");
    }

    const calendarModel = calendarModelModule.create({
      addScheduleDays,
      buildProjectedShiftInstance,
      buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups,
      cloneScheduleDate,
      formatScheduleDateKey,
      getScheduleRequestRange,
      getScheduleTypeMeta,
      getScheduleUserUnitName,
      iterateScheduleDates,
      normalizeScheduleViewMode,
      parseScheduleDate,
      toArray,
    });
    const toolbarRenderer = toolbarRendererModule.create({
      SCHEDULE_VIEW_MODES,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      formatScheduleRangeLabel,
      getScheduleUserUnitName,
      normalizeScheduleViewMode,
      renderTableCheckboxFilterMenu,
      toArray,
    });
    const boardRenderer = boardRendererModule.create({
      SCHEDULE_DAY_NAMES,
      SCHEDULE_WEEK_DAY_NAMES,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      formatScheduleDateKey,
      normalizeScheduleViewMode,
      parseScheduleDate,
      renderEmptyState,
      toArray,
    });

    function renderScheduleView(state = {}) {
      const stats = buildStats(state);
      const model = calendarModel.buildScheduleCalendarModel(state, stats);
      const toolbarMarkup = toolbarRenderer.renderScheduleToolbar(state, model);

      if (state.scheduleCalendarLoading) {
        return `
          <section class="view-stack">
            <article class="panel-card workmate-schedule-shell">
              ${toolbarMarkup}
              ${renderEmptyState("근무일정을 불러오는 중입니다.", "잠시만 기다려 주세요.")}
            </article>
          </section>
        `;
      }

      return `
        <section class="view-stack">
          <article class="panel-card workmate-schedule-shell">
            ${toolbarMarkup}
            ${boardRenderer.renderScheduleBoard(state, model)}
          </article>
        </section>
      `;
    }

    return Object.freeze({
      renderScheduleView,
    });
  }

  return Object.freeze({
    create: createSchedulesRenderer,
  });
});
