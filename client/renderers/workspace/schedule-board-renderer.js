(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateScheduleBoardRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
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
    } = deps;

    function renderScheduleEntryCard(entry = {}, compact = false) {
      if (compact) {
        return `
          <article class="workmate-schedule-entry ${escapeAttribute(entry.colorClass || "tone-sky")} compact">
            <strong>${escapeHtml(entry.userName || "-")}</strong>
            <span>${escapeHtml(entry.timeRange || "-")}</span>
            <span>${escapeHtml(entry.scheduleLabel || "-")}</span>
          </article>
        `;
      }

      return `
        <article class="workmate-schedule-entry ${escapeAttribute(entry.colorClass || "tone-sky")}">
          <strong>${escapeHtml(entry.userName || "-")}</strong>
          <span>${escapeHtml(entry.timeRange || "-")}</span>
          <small>${escapeHtml(entry.type === "leave" ? entry.scheduleLabel : `${entry.siteName || "-"} · ${entry.scheduleLabel || "-"}`)}</small>
        </article>
      `;
    }

    function renderScheduleMonthView(state = {}, model = {}) {
      const monthCursor = parseScheduleDate(state.scheduleDateCursor);
      const expandedDateSet = new Set(toArray(state.scheduleMonthExpandedDates).map((dateKey) => String(dateKey || "").trim()).filter(Boolean));
      const showAllEntries = Boolean(state.scheduleMonthShowAllEntries);
      const weekRows = [];

      for (let index = 0; index < model.visibleDates.length; index += 7) {
        weekRows.push(model.visibleDates.slice(index, index + 7));
      }

      return `
        <section class="workmate-schedule-board month-view">
          <div class="workmate-schedule-month-grid">
            ${SCHEDULE_DAY_NAMES.map((dayName) => `<div class="workmate-schedule-grid-head">${escapeHtml(dayName)}</div>`).join("")}
            ${weekRows.map((week) => week.map((date) => {
              const dateKey = formatScheduleDateKey(date);
              const dateEntries = model.dateEntriesMap.get(dateKey) || [];
              const isExpanded = showAllEntries || expandedDateSet.has(dateKey);
              const visibleEntries = isExpanded ? dateEntries : dateEntries.slice(0, 4);
              const hiddenCount = Math.max(0, dateEntries.length - visibleEntries.length);
              const isOutsideMonth = date.getMonth() !== monthCursor.getMonth();
              const isToday = dateKey === formatScheduleDateKey(new Date());

              return `
                <section class="workmate-schedule-month-cell${isOutsideMonth ? " outside-month" : ""}${isToday ? " is-today" : ""}${isExpanded ? " is-expanded" : ""}">
                  <div class="workmate-schedule-month-cell-head">
                    <strong>${escapeHtml(String(date.getDate()))}</strong>
                    <span>${escapeHtml(`${formatNumber(dateEntries.length)}건`)}</span>
                  </div>
                  <div class="workmate-schedule-entry-stack">
                    ${visibleEntries.map((entry) => renderScheduleEntryCard(entry, true)).join("")}
                    ${hiddenCount > 0 ? `
                      <button
                        class="workmate-schedule-more-button"
                        data-schedule-month-expand="${escapeAttribute(dateKey)}"
                        type="button"
                      >
                        +${escapeHtml(formatNumber(hiddenCount))}건
                      </button>
                    ` : ""}
                  </div>
                </section>
              `;
            }).join("")).join("")}
          </div>
        </section>
      `;
    }

    function renderScheduleWeekView(model = {}) {
      if (model.rowUsers.length === 0) {
        return renderEmptyState("표시할 근무자가 없습니다.", "근무자 필터를 조정하거나 일정 범위를 변경해 보세요.");
      }

      return `
        <section class="workmate-schedule-board week-view">
          <div class="workmate-schedule-week-board">
            <div class="workmate-schedule-week-head sticky-user">직원</div>
            ${model.visibleDates.map((date) => `
              <div class="workmate-schedule-week-head">
                <strong>${escapeHtml(`${date.getDate()}일(${SCHEDULE_WEEK_DAY_NAMES[date.getDay()]})`)}</strong>
              </div>
            `).join("")}
            ${model.rowUsers.map((user) => {
              const weeklyHours = model.visibleDates.reduce((total, date) => {
                const entry = model.entriesByUserDate.get(`${String(user?.id || "")}:${formatScheduleDateKey(date)}`);
                return total + Number(entry?.durationHours || 0);
              }, 0);

              return `
                <div class="workmate-schedule-week-user">
                  <strong>${escapeHtml(user?.name || "-")}</strong>
                  <span>${escapeHtml(`${user?.employeeNo || "-"} · ${formatNumber(weeklyHours)}h`)}</span>
                </div>
                ${model.visibleDates.map((date) => {
                  const entry = model.entriesByUserDate.get(`${String(user?.id || "")}:${formatScheduleDateKey(date)}`);

                  return `
                    <div class="workmate-schedule-week-cell">
                      ${entry ? renderScheduleEntryCard(entry, true) : '<span class="workmate-schedule-cell-empty">-</span>'}
                    </div>
                  `;
                }).join("")}
              `;
            }).join("")}
            <div class="workmate-schedule-week-summary-label">합계</div>
            ${model.visibleDates.map((date) => {
              const dateKey = formatScheduleDateKey(date);
              const count = (model.dateEntriesMap.get(dateKey) || []).length;
              return `
                <div class="workmate-schedule-week-summary">
                  <strong>${escapeHtml(formatNumber(Math.round(model.dayTotals.get(dateKey) || 0)))}h</strong>
                  <span>${escapeHtml(`${formatNumber(count)}명`)}</span>
                </div>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }

    function renderScheduleDayView(model = {}) {
      const hourLabels = Array.from({ length: 24 }, (_, index) => index);
      const selectedDate = model.visibleDates[0] || parseScheduleDate(formatScheduleDateKey(new Date()));

      if (model.rowUsers.length === 0) {
        return renderEmptyState("표시할 일정이 없습니다.", "근무자 필터를 조정하거나 다른 날짜를 선택해 보세요.");
      }

      return `
        <section class="workmate-schedule-board day-view">
          <div class="workmate-schedule-day-board">
            <div class="workmate-schedule-day-axis">
              <div class="workmate-schedule-day-corner">
                <strong>직원</strong>
              </div>
              <div class="workmate-schedule-day-hour-strip">
                ${hourLabels.map((hour) => `<span>${escapeHtml(String(hour))}</span>`).join("")}
              </div>
            </div>
            <div class="workmate-schedule-day-body">
              ${model.rowUsers.map((user) => {
                const entry = model.entriesByUserDate.get(`${String(user?.id || "")}:${formatScheduleDateKey(selectedDate)}`) || null;
                const dailyHours = Number(entry?.durationHours || 0);
                const isLeaveEntry = entry?.type === "leave";
                const gridStart = entry ? Math.max(1, Math.floor(Number(entry.startHour || 0)) + 1) : 1;
                const gridEnd = entry ? Math.max(gridStart + 1, Math.ceil(Number(entry.startHour || 0) + Number(entry.durationHours || 1)) + 1) : 2;

                return `
                  <div class="workmate-schedule-day-user">
                    <strong>${escapeHtml(user?.name || "-")}</strong>
                    <span>${escapeHtml(`${user?.employeeNo || "-"} · ${formatNumber(dailyHours)}h`)}</span>
                  </div>
                  <div class="workmate-schedule-day-track">
                    ${hourLabels.map(() => '<span class="workmate-schedule-day-gridline" aria-hidden="true"></span>').join("")}
                    ${entry ? `
                      <article
                        class="workmate-schedule-entry workmate-schedule-timeline-entry compact ${isLeaveEntry ? "is-full-row" : ""} ${escapeAttribute(entry.colorClass || "tone-sky")}"
                        style="grid-column: ${escapeAttribute(isLeaveEntry ? "1 / -1" : `${String(gridStart)} / ${String(gridEnd)}`)};"
                      >
                        ${isLeaveEntry ? `
                          <strong>휴가</strong>
                        ` : `
                          <strong>${escapeHtml(entry.timeRange || "-")}</strong>
                          <span>${escapeHtml(entry.scheduleLabel || "-")}</span>
                        `}
                      </article>
                    ` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </section>
      `;
    }

    function renderScheduleBoard(state = {}, model = {}) {
      const viewMode = normalizeScheduleViewMode(state.scheduleViewMode);

      if (viewMode === "week") {
        return renderScheduleWeekView(model);
      }

      if (viewMode === "day") {
        return renderScheduleDayView(model);
      }

      return renderScheduleMonthView(state, model);
    }

    return Object.freeze({
      renderScheduleBoard,
    });
  }

  return Object.freeze({ create });
});
