(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardGridFilterController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      closeAllDashboardGridPageSizeMenus,
      filterTableFilterOptionValues,
      getDashboardGridConfig,
      getVisibleTableFilterOptionInputs,
      renderWorkspacePage,
      state,
    } = dependencies;

    if (
      typeof closeAllDashboardGridPageSizeMenus !== "function"
      || typeof filterTableFilterOptionValues !== "function"
      || typeof getDashboardGridConfig !== "function"
      || typeof getVisibleTableFilterOptionInputs !== "function"
      || typeof renderWorkspacePage !== "function"
      || !state
    ) {
      throw new Error("WorkMateDashboardGridFilterController requires filter dependencies.");
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

    return Object.freeze({
      clearAllDashboardGridFilters,
      clearDashboardGridFilter,
      closeDashboardGridFilterMenu,
      getDashboardGridMenuOptionValues,
      normalizeDashboardGridFilterValues,
      openDashboardGridFilterMenu,
      refreshDashboardGridFilterMenu,
      removeDashboardGridFilterValue,
      selectDashboardGridFilterSearchResults,
      setDashboardGridFilterSearch,
      setDashboardGridFilterValues,
      toggleDashboardGridFilterValue,
      toggleDashboardGridVisibleFilterValues,
    });
  }

  return Object.freeze({ create });
});
