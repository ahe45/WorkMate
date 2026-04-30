(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateScheduleToolbarRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      SCHEDULE_VIEW_MODES,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      formatScheduleRangeLabel,
      getScheduleUserUnitName,
      normalizeScheduleViewMode,
      renderTableCheckboxFilterMenu,
      toArray,
    } = deps;

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

    return Object.freeze({
      renderScheduleToolbar,
      renderScheduleUserFilter,
    });
  }

  return Object.freeze({ create });
});
