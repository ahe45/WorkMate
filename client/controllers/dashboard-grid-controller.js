(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardGridController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      createDefaultDashboardGridState,
      createDefaultDashboardGridTableState,
      currentPage,
      escapeAttribute,
      filterTableFilterOptionValues,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      renderWorkspacePage,
      state,
      syncTableCheckboxFilterMenuSelectionState,
    } = dependencies;

    if (!state || typeof renderWorkspacePage !== "function") {
      throw new Error("WorkMateDashboardGridController requires state and renderWorkspacePage.");
    }

    function getDashboardGridConfig(tableId = "") {
      const normalizedTableId = String(tableId || "").trim();

      if (!normalizedTableId) {
        return null;
      }

      if (!state.dashboardGrids || typeof state.dashboardGrids !== "object") {
        state.dashboardGrids = createDefaultDashboardGridState();
      }

      if (!state.dashboardGrids[normalizedTableId]) {
        state.dashboardGrids[normalizedTableId] = createDefaultDashboardGridTableState();
      }

      const grid = state.dashboardGrids[normalizedTableId];

      if (!grid.filters || typeof grid.filters !== "object") {
        grid.filters = {};
      }

      Object.entries(grid.filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          grid.filters[key] = Array.from(new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean)));
          return;
        }

        const normalizedValue = String(value ?? "").trim();

        if (normalizedValue) {
          grid.filters[key] = [normalizedValue];
        } else {
          delete grid.filters[key];
        }
      });

      const legacySortKey = String(grid.sortKey || "").trim();
      const legacySortDirection = String(grid.sortDirection || "asc").trim().toLowerCase() === "desc" ? "desc" : "asc";
      const sourceSortRules = Array.isArray(grid.sortRules)
        ? grid.sortRules
        : legacySortKey
          ? [{ direction: legacySortDirection, key: legacySortKey }]
          : [{ direction: "asc", key: "userName" }];

      grid.sortRules = sourceSortRules
        .map((rule) => {
          const key = String(rule?.key || "").trim();

          if (!key) {
            return null;
          }

          return {
            direction: String(rule?.direction || "asc").trim().toLowerCase() === "desc" ? "desc" : "asc",
            key,
          };
        })
        .filter(Boolean);
      grid.page = Math.max(1, Number(grid.page) || 1);

      const pageSize = Number(grid.pageSize);
      grid.pageSize = Number.isFinite(pageSize) && pageSize >= 0 ? pageSize : 20;
      grid.pageSizeMenuOpen = Boolean(grid.pageSizeMenuOpen);
      grid.filterMenuSearch = String(grid.filterMenuSearch || "");

      return grid;
    }

    function closeAllDashboardGridPageSizeMenus(exceptTableId = "") {
      if (!state.dashboardGrids || typeof state.dashboardGrids !== "object") {
        return false;
      }

      let changed = false;

      Object.entries(state.dashboardGrids).forEach(([tableId, grid]) => {
        if (tableId === exceptTableId || !grid?.pageSizeMenuOpen) {
          return;
        }

        grid.pageSizeMenuOpen = false;
        changed = true;
      });

      return changed;
    }

    function getDashboardGridMenuOptionValues(menuElement = null) {
      const menu = menuElement instanceof HTMLElement ? menuElement : document.querySelector(".workmate-dashboard-filter-menu");

      if (!(menu instanceof HTMLElement)) {
        return [];
      }

      try {
        const values = JSON.parse(menu.dataset.dashboardGridOptions || "[]");
        return Array.isArray(values) ? values.map((value) => String(value ?? "")) : [];
      } catch (error) {
        return [];
      }
    }

    function normalizeDashboardGridFilterValues(values = [], optionValues = []) {
      const normalizedOptionValues = Array.from(new Set((Array.isArray(optionValues) ? optionValues : []).map((value) => String(value ?? ""))));
      const normalizedValues = Array.from(new Set((Array.isArray(values) ? values : [values]).map((value) => String(value ?? "").trim()).filter(Boolean)));

      if (normalizedOptionValues.length === 0) {
        return normalizedValues;
      }

      return normalizedValues.filter((value) => normalizedOptionValues.includes(value));
    }

    function syncDashboardGridUiState() {
      if (currentPage !== "workspace") {
        return;
      }

      document.querySelectorAll(".table-filter-menu").forEach((menu) => {
        if (menu instanceof HTMLElement) {
          syncTableCheckboxFilterMenuSelectionState(menu);
        }
      });
    }

    function syncWorkspaceOverlayState() {
      if (currentPage !== "workspace") {
        return;
      }

      const isDashboardModalOpen = state.currentWorkspaceView === "dashboard"
        && (Boolean(state.dashboardSummaryFilter) || Boolean(state.dashboardDetailUserId));
      const isManagementModalOpen = state.currentWorkspaceView === "management"
        && (
          Boolean(state.managementHolidayModalOpen)
          || Boolean(state.managementJobTitleModalOpen)
          || Boolean(state.managementWorkPolicyModalOpen)
          || Boolean(state.managementWorksiteModalOpen)
          || Boolean(state.managementUnitModalOpen)
        );
      document.body.classList.toggle("modal-open", isDashboardModalOpen || isManagementModalOpen);
    }

    function openDashboardSummaryModal(filter = "") {
      state.dashboardSummaryFilter = String(filter || "").trim();
      state.dashboardDetailUserId = "";
      state.dashboardGridFilterMenu = null;
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.querySelector("#dashboard-summary-modal [data-dashboard-summary-close]")?.focus();
      });
    }

    function closeDashboardSummaryModal() {
      if (!state.dashboardSummaryFilter) {
        syncWorkspaceOverlayState();
        return;
      }

      state.dashboardSummaryFilter = "";
      renderWorkspacePage();
    }

    function openDashboardDetailModal(userId = "") {
      state.dashboardDetailUserId = String(userId || "").trim();
      state.dashboardSummaryFilter = "";
      state.dashboardGridFilterMenu = null;
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.querySelector("#dashboard-detail-modal [data-dashboard-detail-close]")?.focus();
      });
    }

    function closeDashboardDetailModal() {
      if (!state.dashboardDetailUserId) {
        syncWorkspaceOverlayState();
        return;
      }

      state.dashboardDetailUserId = "";
      renderWorkspacePage();
    }

    function openDashboardGridFilterMenu(trigger, tableId = "", columnKey = "") {
      const table = String(tableId || "").trim();
      const column = String(columnKey || "").trim();

      if (!trigger || !table || !column) {
        return;
      }

      const grid = getDashboardGridConfig(table);
      const isSameMenu = state.dashboardGridFilterMenu
        && state.dashboardGridFilterMenu.tableId === table
        && state.dashboardGridFilterMenu.columnKey === column;

      closeAllDashboardGridPageSizeMenus();

      if (isSameMenu) {
        closeDashboardGridFilterMenu();
        return;
      }

      if (grid) {
        grid.filterMenuSearch = "";
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(320, Math.max(220, window.innerWidth - 24));
      const menuHeight = 420;
      const maxTop = Math.max(12, window.innerHeight - menuHeight - 12);
      const maxLeft = Math.max(12, window.innerWidth - menuWidth - 12);

      state.dashboardGridFilterMenu = {
        columnKey: column,
        left: Math.min(rect.left, maxLeft),
        tableId: table,
        top: Math.min(rect.bottom + 8, maxTop),
      };
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.querySelector(".workmate-dashboard-filter-menu [data-dashboard-grid-filter-search-input]")?.focus();
      });
    }

    function closeDashboardGridFilterMenu(shouldRender = true) {
      const openMenu = state.dashboardGridFilterMenu;

      if (!openMenu) {
        return;
      }

      const grid = getDashboardGridConfig(openMenu.tableId || "");

      if (grid) {
        grid.filterMenuSearch = "";
      }

      state.dashboardGridFilterMenu = null;

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function toggleDashboardGridSort(tableId = "", columnKey = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const currentRuleIndex = grid.sortRules.findIndex((rule) => rule.key === columnKey);

      if (currentRuleIndex < 0) {
        grid.sortRules.push({ direction: "asc", key: columnKey });
      } else if (grid.sortRules[currentRuleIndex].direction === "asc") {
        grid.sortRules[currentRuleIndex].direction = "desc";
      } else {
        grid.sortRules.splice(currentRuleIndex, 1);
      }

      grid.page = 1;
      closeDashboardGridFilterMenu(false);
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
    }

    function setDashboardGridFilterValues(tableId = "", columnKey = "", values = [], optionValues = getDashboardGridMenuOptionValues(), { keepMenuOpen = true, shouldRender = true } = {}) {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const normalizedOptions = Array.from(new Set((Array.isArray(optionValues) ? optionValues : []).map((value) => String(value ?? "").trim()).filter(Boolean)));
      const nextValues = normalizeDashboardGridFilterValues(values, normalizedOptions);

      if (normalizedOptions.length > 0 && nextValues.length === normalizedOptions.length) {
        delete grid.filters[columnKey];
      } else {
        grid.filters[columnKey] = nextValues;
      }

      grid.page = 1;
      closeAllDashboardGridPageSizeMenus();

      if (!keepMenuOpen) {
        closeDashboardGridFilterMenu(false);
      }

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function toggleDashboardGridFilterValue(tableId = "", columnKey = "", value = "", { shouldRender = true } = {}) {
      const grid = getDashboardGridConfig(tableId);
      const normalizedValue = String(value || "").trim();

      if (!grid || !columnKey || !normalizedValue) {
        return;
      }

      const optionValues = getDashboardGridMenuOptionValues();
      const currentValues = new Set(Array.isArray(grid.filters[columnKey]) ? grid.filters[columnKey] : optionValues);

      if (currentValues.has(normalizedValue)) {
        currentValues.delete(normalizedValue);
      } else {
        currentValues.add(normalizedValue);
      }

      setDashboardGridFilterValues(tableId, columnKey, Array.from(currentValues), optionValues, { keepMenuOpen: true, shouldRender });
    }

    function toggleDashboardGridVisibleFilterValues(tableId = "", columnKey = "", shouldSelect = false, { shouldRender = true } = {}) {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const optionValues = getDashboardGridMenuOptionValues();
      const visibleValues = getVisibleTableFilterOptionInputs(document.querySelector(".workmate-dashboard-filter-menu"))
        .filter((input) => input.dataset.dashboardGridFilterOptionInput === "true")
        .map((input) => String(input.dataset.dashboardGridValue || "").trim())
        .filter(Boolean);
      const currentValues = new Set(Array.isArray(grid.filters[columnKey]) ? grid.filters[columnKey] : optionValues);

      visibleValues.forEach((value) => {
        if (shouldSelect) {
          currentValues.add(value);
          return;
        }

        currentValues.delete(value);
      });

      setDashboardGridFilterValues(tableId, columnKey, Array.from(currentValues), optionValues, { keepMenuOpen: true, shouldRender });
    }

    function removeDashboardGridFilterValue(tableId = "", columnKey = "", value = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const currentValues = Array.isArray(grid.filters[columnKey]) ? grid.filters[columnKey] : [];

      setDashboardGridFilterValues(
        tableId,
        columnKey,
        currentValues.filter((entry) => entry !== value),
        currentValues,
        { keepMenuOpen: false },
      );
    }

    function clearDashboardGridFilter(tableId = "", columnKey = "", { keepMenuOpen = false, shouldRender = true } = {}) {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      delete grid.filters[columnKey];
      grid.page = 1;
      closeAllDashboardGridPageSizeMenus();

      if (!keepMenuOpen) {
        closeDashboardGridFilterMenu(false);
      }

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    function clearAllDashboardGridFilters(tableId = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid) {
        return;
      }

      grid.filters = {};
      grid.page = 1;
      closeDashboardGridFilterMenu(false);
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
    }

    function setDashboardGridFilterSearch(tableId = "", columnKey = "", searchTerm = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      grid.filterMenuSearch = String(searchTerm || "");
    }

    function refreshDashboardGridFilterMenu(menuElement = null) {
      const menu = menuElement instanceof HTMLElement ? menuElement : document.querySelector(".workmate-dashboard-filter-menu");

      if (!(menu instanceof HTMLElement)) {
        return;
      }

      const tableId = String(menu.dataset.dashboardGridTable || "").trim();
      const columnKey = String(menu.dataset.dashboardGridColumn || "").trim();
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeSelectionStart = activeElement instanceof HTMLInputElement && typeof activeElement.selectionStart === "number"
        ? activeElement.selectionStart
        : null;
      const activeSelectionEnd = activeElement instanceof HTMLInputElement && typeof activeElement.selectionEnd === "number"
        ? activeElement.selectionEnd
        : null;
      const focusState = activeElement?.dataset.dashboardGridFilterSearchInput === "true"
        ? { kind: "search" }
        : activeElement?.dataset.dashboardGridFilterSelectAll === "true"
          ? { kind: "selectAll" }
          : activeElement?.dataset.dashboardGridFilterOptionInput === "true"
            ? { kind: "option", value: String(activeElement.dataset.dashboardGridValue || "").trim() }
            : null;

      renderWorkspacePage();

      if (!focusState) {
        return;
      }

      window.requestAnimationFrame(() => {
        const nextMenu = document.querySelector(".workmate-dashboard-filter-menu");

        if (!(nextMenu instanceof HTMLElement)) {
          return;
        }

        if (
          String(nextMenu.dataset.dashboardGridTable || "").trim() !== tableId
          || String(nextMenu.dataset.dashboardGridColumn || "").trim() !== columnKey
        ) {
          return;
        }

        let nextFocusTarget = null;

        if (focusState.kind === "search") {
          nextFocusTarget = nextMenu.querySelector("[data-dashboard-grid-filter-search-input='true']");
        } else if (focusState.kind === "selectAll") {
          nextFocusTarget = nextMenu.querySelector("[data-dashboard-grid-filter-select-all='true']");
        } else if (focusState.kind === "option") {
          nextFocusTarget = Array.from(nextMenu.querySelectorAll("[data-dashboard-grid-filter-option-input='true']")).find((input) =>
            input instanceof HTMLInputElement
            && String(input.dataset.dashboardGridValue || "").trim() === focusState.value
          ) || null;
        }

        if (!(nextFocusTarget instanceof HTMLElement)) {
          return;
        }

        nextFocusTarget.focus();

        if (
          nextFocusTarget instanceof HTMLInputElement
          && activeSelectionStart !== null
          && activeSelectionEnd !== null
          && nextFocusTarget.type !== "checkbox"
        ) {
          nextFocusTarget.setSelectionRange(activeSelectionStart, activeSelectionEnd);
        }
      });
    }

    function selectDashboardGridFilterSearchResults(tableId = "", columnKey = "", searchTerm = "", menuElement = null) {
      const grid = getDashboardGridConfig(tableId);

      if (!grid || !columnKey) {
        return;
      }

      const menu = menuElement instanceof HTMLElement ? menuElement : document.querySelector(".workmate-dashboard-filter-menu");
      const optionValues = getDashboardGridMenuOptionValues(menu);

      setDashboardGridFilterSearch(tableId, columnKey, searchTerm);
      setDashboardGridFilterValues(
        tableId,
        columnKey,
        filterTableFilterOptionValues(optionValues, grid.filterMenuSearch),
        optionValues,
        { keepMenuOpen: true, shouldRender: false },
      );
      refreshDashboardGridFilterMenu(menu);
    }

    function toggleDashboardGridPageSizeMenu(tableId = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid) {
        return;
      }

      const shouldOpen = !grid.pageSizeMenuOpen;
      closeDashboardGridFilterMenu(false);
      closeAllDashboardGridPageSizeMenus(tableId);
      grid.pageSizeMenuOpen = shouldOpen;
      renderWorkspacePage();
    }

    function setDashboardGridPageSize(tableId = "", pageSize = 20) {
      const grid = getDashboardGridConfig(tableId);
      const normalizedPageSize = Number(pageSize);

      if (!grid) {
        return;
      }

      grid.pageSize = Number.isFinite(normalizedPageSize) && normalizedPageSize >= 0 ? normalizedPageSize : 20;
      grid.page = 1;
      grid.pageSizeMenuOpen = false;
      renderWorkspacePage();
    }

    function setDashboardGridPage(tableId = "", page = 1) {
      const grid = getDashboardGridConfig(tableId);

      if (!grid) {
        return;
      }

      grid.page = Math.max(1, Number(page) || 1);
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
    }

    function moveDashboardGridPage(tableId = "", direction = "") {
      const grid = getDashboardGridConfig(tableId);

      if (!grid) {
        return;
      }

      grid.page = Math.max(1, Number(grid.page || 1) + (direction === "next" ? 1 : -1));
      closeAllDashboardGridPageSizeMenus();
      renderWorkspacePage();
    }

    return Object.freeze({
      getDashboardGridConfig,
      closeAllDashboardGridPageSizeMenus,
      getDashboardGridMenuOptionValues,
      normalizeDashboardGridFilterValues,
      syncDashboardGridUiState,
      syncWorkspaceOverlayState,
      openDashboardSummaryModal,
      closeDashboardSummaryModal,
      openDashboardDetailModal,
      closeDashboardDetailModal,
      openDashboardGridFilterMenu,
      closeDashboardGridFilterMenu,
      toggleDashboardGridSort,
      setDashboardGridFilterValues,
      toggleDashboardGridFilterValue,
      toggleDashboardGridVisibleFilterValues,
      removeDashboardGridFilterValue,
      clearDashboardGridFilter,
      clearAllDashboardGridFilters,
      setDashboardGridFilterSearch,
      refreshDashboardGridFilterMenu,
      selectDashboardGridFilterSearchResults,
      toggleDashboardGridPageSizeMenu,
      setDashboardGridPageSize,
      setDashboardGridPage,
      moveDashboardGridPage,
    });
  }

  return Object.freeze({ create });
});
