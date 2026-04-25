(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateScheduleFilterController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      escapeAttribute,
      filterTableFilterOptionValues,
      formatLocalDateKey,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      renderWorkspacePage,
      state,
      syncTableCheckboxFilterMenuSelectionState,
    } = dependencies;

    if (!state || typeof renderWorkspacePage !== "function" || typeof formatLocalDateKey !== "function") {
      throw new Error("WorkMateScheduleFilterController requires state, renderWorkspacePage, and date helpers.");
    }

    function getScheduleActiveUserIds() {
      const users = Array.isArray(state.bootstrap?.users) ? state.bootstrap.users : [];

      return users
        .filter((user) => String(user?.employmentStatus || "").toUpperCase() === "ACTIVE")
        .map((user) => String(user?.id || "").trim())
        .filter(Boolean);
    }

    function getScheduleSelectedUserSetForMutation() {
      const activeIds = getScheduleActiveUserIds();

      if (state.scheduleUserFilterMode !== "custom") {
        return new Set(activeIds);
      }

      const activeIdSet = new Set(activeIds);

      return new Set(
        (Array.isArray(state.scheduleSelectedUserIds) ? state.scheduleSelectedUserIds : [])
          .map((userId) => String(userId || "").trim())
          .filter((userId) => activeIdSet.has(userId)),
      );
    }

    function applyScheduleUserSelection(selectedUserIds = [], { keepMenuOpen = true, shouldRender = true } = {}) {
      const activeIds = getScheduleActiveUserIds();
      const activeIdSet = new Set(activeIds);
      const normalizedIds = Array.from(new Set(
        (Array.isArray(selectedUserIds) ? selectedUserIds : [])
          .map((userId) => String(userId || "").trim())
          .filter((userId) => activeIdSet.has(userId)),
      ));

      if (activeIds.length > 0 && normalizedIds.length === activeIds.length) {
        state.scheduleUserFilterMode = "all";
        state.scheduleSelectedUserIds = [];
      } else {
        state.scheduleUserFilterMode = "custom";
        state.scheduleSelectedUserIds = normalizedIds;
      }

      state.scheduleUserFilterOpen = keepMenuOpen;

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function setScheduleUserFilterSearch(searchTerm = "") {
      state.scheduleUserFilterSearch = String(searchTerm || "");
      state.scheduleUserFilterOpen = true;
    }

    function closeScheduleUserFilter(shouldRender = true) {
      if (!state.scheduleUserFilterOpen && !state.scheduleUserFilterSearch) {
        return;
      }

      state.scheduleUserFilterOpen = false;
      state.scheduleUserFilterSearch = "";

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function toggleScheduleUserFilter() {
      if (state.scheduleUserFilterOpen) {
        closeScheduleUserFilter();
        return;
      }

      state.scheduleUserFilterSearch = "";
      state.scheduleUserFilterOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        refreshScheduleUserFilterMenu();
        document.querySelector("[data-schedule-user-filter-search-input]")?.focus();
      });
    }

    function getScheduleUserFilterMenuOptions(menu) {
      if (!(menu instanceof HTMLElement)) {
        return [];
      }

      try {
        const parsed = JSON.parse(menu.dataset.scheduleUserFilterOptions || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    function getScheduleSelectedUserSetForRender() {
      return getScheduleSelectedUserSetForMutation();
    }

    function refreshScheduleUserFilterMenu(menuElement = null) {
      const menu = menuElement instanceof HTMLElement ? menuElement : document.querySelector(".workmate-schedule-user-filter-menu");

      if (!(menu instanceof HTMLElement)) {
        return;
      }

      const optionListElement = menu.querySelector(".table-filter-option-list");
      const options = getScheduleUserFilterMenuOptions(menu);
      const visibleOptions = filterTableFilterOptionValues(options, state.scheduleUserFilterSearch, (option) => option?.searchValue || option?.label || "");
      const selectedUserIds = getScheduleSelectedUserSetForRender();

      if (optionListElement) {
        optionListElement.innerHTML = renderTableFilterOptionItems(visibleOptions.map((option) => {
          const userId = String(option?.userId || "");

          return {
            checked: selectedUserIds.has(userId),
            className: "workmate-schedule-user-filter-option",
            inputAttributes: `
              data-schedule-user-filter-option-input="true"
              data-schedule-user-filter-option="${escapeAttribute(userId)}"
            `,
            label: option?.label || "",
            searchValue: option?.searchValue || option?.label || "",
            title: option?.title || option?.label || "",
          };
        }));
      }

      syncTableCheckboxFilterMenuSelectionState(menu);
    }

    function selectScheduleUserFilterSearchResults(searchTerm = "", menuElement = null) {
      const menu = menuElement instanceof HTMLElement ? menuElement : document.querySelector(".workmate-schedule-user-filter-menu");
      const options = getScheduleUserFilterMenuOptions(menu);
      const visibleUserIds = filterTableFilterOptionValues(options, searchTerm, (option) => option?.searchValue || option?.label || "")
        .map((option) => String(option?.userId || "").trim())
        .filter(Boolean);

      setScheduleUserFilterSearch(searchTerm);
      applyScheduleUserSelection(visibleUserIds, { keepMenuOpen: true, shouldRender: false });
      refreshScheduleUserFilterMenu(menu);
    }

    function getVisibleScheduleUserFilterInputs() {
      return getVisibleTableFilterOptionInputs(document.querySelector(".workmate-schedule-user-filter-menu"))
        .filter((input) => input.dataset.scheduleUserFilterOptionInput === "true");
    }

    function setScheduleUserFilterValue(userId = "", shouldSelect = false, { shouldRender = true } = {}) {
      const normalizedUserId = String(userId || "").trim();

      if (!normalizedUserId) {
        return;
      }

      const selectedUserIds = getScheduleSelectedUserSetForMutation();

      if (shouldSelect) {
        selectedUserIds.add(normalizedUserId);
      } else {
        selectedUserIds.delete(normalizedUserId);
      }

      applyScheduleUserSelection(Array.from(selectedUserIds), { keepMenuOpen: true, shouldRender });
    }

    function setScheduleVisibleUserFilterValues(shouldSelect = false, { shouldRender = true } = {}) {
      const visibleUserIds = getVisibleScheduleUserFilterInputs()
        .map((input) => String(input.dataset.scheduleUserFilterOption || "").trim())
        .filter(Boolean);
      const selectedUserIds = getScheduleSelectedUserSetForMutation();

      visibleUserIds.forEach((userId) => {
        if (shouldSelect) {
          selectedUserIds.add(userId);
          return;
        }

        selectedUserIds.delete(userId);
      });

      applyScheduleUserSelection(Array.from(selectedUserIds), { keepMenuOpen: true, shouldRender });
    }

    function resetScheduleUserFilter({ shouldRender = true } = {}) {
      state.scheduleUserFilterMode = "all";
      state.scheduleSelectedUserIds = [];
      state.scheduleUserFilterOpen = true;

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function expandScheduleMonthDate(dateKey = "") {
      const normalizedDateKey = String(dateKey || "").trim();

      if (!normalizedDateKey) {
        return;
      }

      const expandedDates = new Set(
        (Array.isArray(state.scheduleMonthExpandedDates) ? state.scheduleMonthExpandedDates : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      );

      expandedDates.add(normalizedDateKey);
      state.scheduleMonthExpandedDates = Array.from(expandedDates);
      renderWorkspacePage();
    }

    function toggleScheduleMonthAllEntries() {
      state.scheduleMonthShowAllEntries = !Boolean(state.scheduleMonthShowAllEntries);

      if (!state.scheduleMonthShowAllEntries) {
        state.scheduleMonthExpandedDates = [];
      }

      renderWorkspacePage();
    }

    function getScheduleCursorDate() {
      return new Date(`${state.scheduleDateCursor || formatLocalDateKey()}T00:00:00`);
    }

    function adjustScheduleCursor(action = "") {
      const nextDate = getScheduleCursorDate();

      if (action === "today") {
        state.scheduleDateCursor = formatLocalDateKey();
        return;
      }

      if (state.scheduleViewMode === "day") {
        nextDate.setDate(nextDate.getDate() + (action === "prev" ? -1 : 1));
      } else if (state.scheduleViewMode === "week") {
        nextDate.setDate(nextDate.getDate() + (action === "prev" ? -7 : 7));
      } else {
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + (action === "prev" ? -1 : 1));
      }

      state.scheduleDateCursor = formatLocalDateKey(nextDate);
    }

    function getAttendanceCursorDate() {
      return new Date(`${state.attendanceDateCursor || formatLocalDateKey()}T00:00:00`);
    }

    function adjustAttendanceCursor(action = "") {
      const nextDate = getAttendanceCursorDate();

      if (action === "today") {
        state.attendanceDateCursor = formatLocalDateKey();
        return;
      }

      if (state.attendanceViewMode === "list") {
        nextDate.setDate(nextDate.getDate() + (action === "prev" ? -1 : 1));
      } else {
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + (action === "prev" ? -1 : 1));
      }

      state.attendanceDateCursor = formatLocalDateKey(nextDate);
    }

    function getReportCursorDate() {
      return new Date(`${state.reportDateCursor || formatLocalDateKey()}T00:00:00`);
    }

    function adjustReportCursor(action = "") {
      const nextDate = getReportCursorDate();

      if (action === "today") {
        state.reportDateCursor = formatLocalDateKey();
        return;
      }

      nextDate.setDate(1);
      nextDate.setMonth(nextDate.getMonth() + (action === "prev" ? -1 : 1));
      state.reportDateCursor = formatLocalDateKey(nextDate);
    }

    return Object.freeze({
      adjustAttendanceCursor,
      adjustReportCursor,
      adjustScheduleCursor,
      applyScheduleUserSelection,
      closeScheduleUserFilter,
      expandScheduleMonthDate,
      getAttendanceCursorDate,
      getReportCursorDate,
      getScheduleActiveUserIds,
      getScheduleCursorDate,
      getScheduleSelectedUserSetForMutation,
      getScheduleSelectedUserSetForRender,
      getScheduleUserFilterMenuOptions,
      getVisibleScheduleUserFilterInputs,
      refreshScheduleUserFilterMenu,
      resetScheduleUserFilter,
      selectScheduleUserFilterSearchResults,
      setScheduleUserFilterSearch,
      setScheduleUserFilterValue,
      setScheduleVisibleUserFilterValues,
      toggleScheduleMonthAllEntries,
      toggleScheduleUserFilter,
    });
  }

  return Object.freeze({ create });
});
