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
      formatTime,
      formatTimeRange,
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

  function buildScheduleCalendarModel(state = {}, stats = {}) {
    const viewMode = normalizeScheduleViewMode(state.scheduleViewMode);
    const range = getScheduleRequestRange(viewMode, state.scheduleDateCursor);
    const visibleDates = iterateScheduleDates(range.dateFrom, range.dateTo);
    const activeUsers = stats.activeUsers.slice().sort((left, right) => {
      const unitDiff = getScheduleUserUnitName(left).localeCompare(getScheduleUserUnitName(right), "ko");

      if (unitDiff !== 0) {
        return unitDiff;
      }

      return String(left?.name || "").localeCompare(String(right?.name || ""), "ko");
    });
    const activeUserIds = new Set(activeUsers.map((user) => String(user?.id || "")).filter(Boolean));
    const filterMode = state.scheduleUserFilterMode === "custom" ? "custom" : "all";
    const rawSelectedUserIds = new Set(toArray(state.scheduleSelectedUserIds).map((userId) => String(userId || "")).filter((userId) => activeUserIds.has(userId)));
    const selectedUserIds = filterMode === "custom" ? rawSelectedUserIds : new Set(activeUserIds);
    const userMap = new Map(stats.activeUsers.map((user) => [String(user?.id || ""), user]));
    const selectedUsers = activeUsers.filter((user) => selectedUserIds.has(String(user?.id || "")));
    const filteredUsers = (filterMode === "custom" ? selectedUsers : activeUsers)
      .slice()
      .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));
    const filteredUserIds = new Set(filteredUsers.map((user) => String(user?.id || "")));
    const calendarData = state.scheduleCalendarData || {};
    const realShiftInstances = toArray(calendarData.shiftInstances);
    const sourceLeaveRequests = toArray(calendarData.leaveRequests).length > 0
      ? toArray(calendarData.leaveRequests)
      : toArray(stats.leaveRequests);
    const patternShiftByUserId = new Map();
    const realShiftByUserDate = new Map();
    const leaveByUserDate = new Map();
    const entriesByDate = new Map();
    const entriesByUserDate = new Map();
    const dayTotals = new Map();

    [...realShiftInstances, ...toArray(stats.shiftInstances)].forEach((shift) => {
      const userId = String(shift?.userId || "");
      const scheduleMeta = getScheduleTypeMeta(shift?.trackType, shift?.scheduleTemplateName);

      if (!userId || patternShiftByUserId.has(userId) || scheduleMeta.label === "휴일") {
        return;
      }

      patternShiftByUserId.set(userId, shift);
    });

    realShiftInstances.forEach((shift) => {
      const userId = String(shift?.userId || "");
      const dateKey = String(shift?.shiftDate || "").trim();

      if (!userId || !dateKey) {
        return;
      }

      realShiftByUserDate.set(`${userId}:${dateKey}`, shift);
    });

    sourceLeaveRequests.forEach((leave) => {
      const startDate = parseScheduleDate(leave?.startDate || range.dateFrom);
      const endDate = parseScheduleDate(leave?.endDate || range.dateTo);
      const clippedStartDate = startDate.getTime() < parseScheduleDate(range.dateFrom).getTime()
        ? parseScheduleDate(range.dateFrom)
        : startDate;
      const clippedEndDate = endDate.getTime() > parseScheduleDate(range.dateTo).getTime()
        ? parseScheduleDate(range.dateTo)
        : endDate;
      let cursorDate = cloneScheduleDate(clippedStartDate);

      while (cursorDate.getTime() <= clippedEndDate.getTime()) {
        leaveByUserDate.set(`${String(leave?.userId || "")}:${formatScheduleDateKey(cursorDate)}`, leave);
        cursorDate = addScheduleDays(cursorDate, 1);
      }
    });

    filteredUsers.forEach((user) => {
      visibleDates.forEach((date) => {
        const dateKey = formatScheduleDateKey(date);
        const userId = String(user?.id || "");
        const entryKey = `${userId}:${dateKey}`;
        const leave = leaveByUserDate.get(entryKey);
        const shift = realShiftByUserDate.get(entryKey) || buildProjectedShiftInstance(patternShiftByUserId.get(userId), user, dateKey);
        const entry = leave
          ? buildScheduleEntryFromLeave(leave, user, dateKey)
          : shift
            ? buildScheduleEntryFromShift(shift, user)
            : null;

        if (!entry) {
          return;
        }

        const dateEntries = entriesByDate.get(dateKey) || [];
        dateEntries.push(entry);
        entriesByDate.set(dateKey, dateEntries);
        entriesByUserDate.set(entryKey, entry);
        dayTotals.set(dateKey, (dayTotals.get(dateKey) || 0) + Number(entry.durationHours || 0));
      });
    });

    entriesByDate.forEach((dateEntries, dateKey) => {
      entriesByDate.set(dateKey, dateEntries.slice().sort((left, right) => {
        const nameDiff = String(left?.userName || "").localeCompare(String(right?.userName || ""), "ko");

        if (nameDiff !== 0) {
          return nameDiff;
        }

        return Number(left?.startHour || 0) - Number(right?.startHour || 0);
      }));
    });

    const rowUsers = filteredUsers.filter((user) => visibleDates.some((date) => entriesByUserDate.has(`${String(user?.id || "")}:${formatScheduleDateKey(date)}`)));

    return {
      dateEntriesMap: entriesByDate,
      dayTotals,
      entriesByUserDate,
      filterMode,
      filteredUsers,
      range,
      rowUsers,
      selectedUserIds: Array.from(selectedUserIds),
      selectedUsers,
      userFilterGroups: buildScheduleUserFilterGroups(activeUsers),
      visibleDates,
    };
  }

  function renderScheduleUserFilter(state = {}, model = {}) {
    const selectedIds = new Set(toArray(model.selectedUserIds).map(String));
    const selectedUsers = toArray(model.selectedUsers);
    const groups = toArray(model.userFilterGroups);
    const isOpen = Boolean(state.scheduleUserFilterOpen);
    const isCustomFilter = model.filterMode === "custom";
    const label = isCustomFilter ? `${formatNumber(selectedUsers.length)}명 선택` : "전체 선택";
    const searchTerm = String(state.scheduleUserFilterSearch || "").trim();
    const normalizedSearchTerm = searchTerm.toLocaleLowerCase("ko");
    const filterOptions = groups.flatMap((group) => {
      const groupName = String(group.name || "미지정 조직");

      return toArray(group.users).map((user) => {
        const userId = String(user?.id || "");
        const labelText = `${groupName} · ${user?.name || "-"}`;
        const searchValue = [
          groupName,
          user?.name,
          user?.employeeNo,
          user?.jobTitle,
          getScheduleUserUnitName(user),
        ].map((value) => String(value || "").toLocaleLowerCase("ko")).join(" ");
        const hidden = Boolean(normalizedSearchTerm) && !searchValue.includes(normalizedSearchTerm);

        return {
          checked: selectedIds.has(userId),
          className: "workmate-schedule-user-filter-option",
          hidden,
          inputAttributes: `
            data-schedule-user-filter-option-input="true"
            data-schedule-user-filter-option="${escapeAttribute(userId)}"
          `,
          label: labelText,
          rowAttributes: `
            data-schedule-user-filter-option-row="true"
            data-schedule-user-filter-search-value="${escapeAttribute(searchValue)}"
          `,
          searchValue,
          title: `${labelText} · ${user?.employeeNo || "-"}`,
          userId,
        };
      });
    });
    const visibleOptions = filterOptions.filter((option) => !option.hidden);
    const visibleSelectedCount = visibleOptions.filter((option) => option.checked).length;
    const isAllVisibleSelected = visibleOptions.length > 0 && visibleSelectedCount === visibleOptions.length;
    const isPartiallyVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleOptions.length;

    return `
      <div class="workmate-schedule-user-filter">
        <button
          class="secondary-button workmate-schedule-user-filter-trigger${isCustomFilter ? " is-active" : ""}"
          data-schedule-user-filter-toggle="true"
          type="button"
          aria-expanded="${isOpen ? "true" : "false"}"
        >
          <span class="workmate-schedule-user-filter-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="M3 5.2h14l-5.5 6.1v3.9l-3 1v-4.9L3 5.2z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>
            </svg>
          </span>
          <strong>${escapeHtml(label)}</strong>
          <span class="workmate-schedule-user-filter-caret" aria-hidden="true">${isOpen ? "▴" : "▾"}</span>
        </button>
        ${isOpen ? `
          ${renderTableCheckboxFilterMenu({
            ariaLabel: "근무자 필터",
            className: "workmate-schedule-user-filter-menu",
            closeAttributes: 'data-schedule-user-filter-close="true"',
            footerButtons: `
              <button class="table-filter-footer-button subtle" data-schedule-user-filter-reset="true" type="button">초기화</button>
              <button class="table-filter-footer-button" data-schedule-user-filter-close="true" type="button">적용</button>
            `,
            isAllVisibleSelected,
            isPartiallyVisibleSelected,
            menuAttributes: `data-schedule-user-filter-options="${escapeAttribute(JSON.stringify(filterOptions.map((option) => ({
              label: option.label,
              searchValue: option.searchValue,
              title: option.title,
              userId: option.userId,
            }))))}"`,
            options: visibleOptions,
            searchInputAttributes: 'data-schedule-user-filter-search-input="true"',
            searchInputId: "schedule-user-filter-search",
            searchPlaceholder: "조직 또는 이름 검색",
            searchValue: searchTerm,
            selectAllAttributes: 'data-schedule-user-filter-select-all="true"',
            title: "근무자",
          })}
        ` : ""}
      </div>
    `;
  }

  function renderScheduleToolbar(state = {}, model = {}) {
    const rangeLabel = formatScheduleRangeLabel(state.scheduleViewMode, state.scheduleDateCursor);
    const viewMode = normalizeScheduleViewMode(state.scheduleViewMode);
    const isMonthView = viewMode === "month";
    const isAllMonthEntriesVisible = Boolean(state.scheduleMonthShowAllEntries);
    const monthAllButtonLabel = isAllMonthEntriesVisible ? "간략 보기" : "전체 보기";
    const todayButtonLabel = viewMode === "month" ? "이번달" : viewMode === "week" ? "이번주" : "오늘";
    const viewModeIconMap = {
      day: `
        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 5.5h12"></path>
          <path d="M7.5 9.5h9"></path>
          <rect x="5" y="4" width="14" height="16" rx="2"></rect>
          <path d="M8 14h8"></path>
        </svg>
      `,
      month: `
        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4.5" y="5.5" width="15" height="14" rx="2"></rect>
          <path d="M8 3.5v4"></path>
          <path d="M16 3.5v4"></path>
          <path d="M4.5 9.5h15"></path>
          <path d="M8 13h3"></path>
          <path d="M13 13h3"></path>
          <path d="M8 16h3"></path>
        </svg>
      `,
      week: `
        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4.5" y="6" width="15" height="13" rx="2"></rect>
          <path d="M4.5 10h15"></path>
          <path d="M8 4v4"></path>
          <path d="M16 4v4"></path>
          <path d="M8 14h8"></path>
          <path d="M8 16.5h6"></path>
        </svg>
      `,
    };

    return `
      <div class="workmate-schedule-toolbar">
        <div class="workmate-schedule-toolbar-row primary">
          <div class="workmate-schedule-nav">
            <button class="secondary-button workmate-schedule-nav-button" data-schedule-nav="prev" type="button" aria-label="이전">‹</button>
            <button class="secondary-button workmate-schedule-nav-button" data-schedule-nav="today" type="button">${escapeHtml(todayButtonLabel)}</button>
            <button class="secondary-button workmate-schedule-nav-button" data-schedule-nav="next" type="button" aria-label="다음">›</button>
            <strong>${escapeHtml(rangeLabel)}</strong>
          </div>
          <div class="workmate-schedule-month-all-slot">
            <button
              class="secondary-button workmate-schedule-month-all-button${isAllMonthEntriesVisible ? " is-active" : ""}${isMonthView ? "" : " is-placeholder"}"
              data-schedule-month-all="${isMonthView ? "true" : "false"}"
              type="button"
              ${isMonthView ? "" : 'tabindex="-1" aria-hidden="true" disabled'}
            >
              ${escapeHtml(isMonthView ? monthAllButtonLabel : "전체 보기")}
            </button>
          </div>
          <div class="workmate-schedule-filter-group">
            ${renderScheduleUserFilter(state, model)}
            <div class="workmate-schedule-view-switch" role="tablist" aria-label="근무일정 보기">
              ${SCHEDULE_VIEW_MODES.map((mode) => `
                <button
                  class="secondary-button workmate-schedule-view-button${viewMode === mode ? " is-active" : ""}"
                  data-schedule-mode="${escapeAttribute(mode)}"
                  type="button"
                >
                  ${viewModeIconMap[mode] || ""}
                  <span>${escapeHtml(mode === "month" ? "월" : mode === "week" ? "주" : "일")}</span>
                </button>
              `).join("")}
            </div>
          </div>
          <div class="workmate-schedule-toolbar-actions">
            <button class="secondary-button" type="button" disabled>다운로드</button>
          </div>
        </div>
      </div>
    `;
  }

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

  function renderScheduleView(state = {}) {
    const stats = buildStats(state);
    const model = buildScheduleCalendarModel(state, stats);

    if (state.scheduleCalendarLoading) {
      return `
        <section class="view-stack">
          <article class="panel-card workmate-schedule-shell">
            ${renderScheduleToolbar(state, model)}
            ${renderEmptyState("근무일정을 불러오는 중입니다.", "잠시만 기다려 주세요.")}
          </article>
        </section>
      `;
    }

    const boardMarkup = normalizeScheduleViewMode(state.scheduleViewMode) === "week"
      ? renderScheduleWeekView(model)
      : normalizeScheduleViewMode(state.scheduleViewMode) === "day"
        ? renderScheduleDayView(model)
        : renderScheduleMonthView(state, model);

    return `
      <section class="view-stack">
        <article class="panel-card workmate-schedule-shell">
          ${renderScheduleToolbar(state, model)}
          ${boardMarkup}
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
