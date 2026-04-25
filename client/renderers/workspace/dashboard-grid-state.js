(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardGridState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create() {
    function normalizeDashboardFilterValue(value = "") {
      const text = String(value ?? "").trim();
      return text || "미입력";
    }

    function getDashboardGridState(state = {}, tableId = "") {
      const gridState = state.dashboardGrids?.[tableId] || {};
      const normalizedFilters = Object.entries(
        gridState?.filters && typeof gridState.filters === "object" ? gridState.filters : {},
      ).reduce((accumulator, [key, value]) => {
        const normalizedKey = String(key || "").trim();

        if (!normalizedKey) {
          return accumulator;
        }

        const hasExplicitArray = Array.isArray(value);
        const normalizedValues = hasExplicitArray
          ? Array.from(new Set(value.map((entry) => normalizeDashboardFilterValue(entry))))
          : String(value ?? "").trim()
            ? [normalizeDashboardFilterValue(value)]
            : [];

        if (hasExplicitArray || normalizedValues.length > 0) {
          accumulator[normalizedKey] = normalizedValues;
        }

        return accumulator;
      }, {});
      const legacySortKey = String(gridState?.sortKey || "").trim();
      const legacySortDirection = String(gridState?.sortDirection || "asc").trim().toLowerCase() === "desc"
        ? "desc"
        : "asc";
      const sortRules = Array.isArray(gridState?.sortRules)
        ? gridState.sortRules
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
          .filter(Boolean)
        : legacySortKey
          ? [{ direction: legacySortDirection, key: legacySortKey }]
          : [{ direction: "asc", key: "userName" }];
      const pageSize = Number(gridState?.pageSize);

      return {
        filterMenuSearch: String(gridState?.filterMenuSearch || ""),
        filters: normalizedFilters,
        page: Math.max(1, Number(gridState?.page) || 1),
        pageSize: Number.isFinite(pageSize) && pageSize >= 0 ? pageSize : 20,
        pageSizeMenuOpen: Boolean(gridState?.pageSizeMenuOpen),
        sortRules,
      };
    }

    function hasDashboardGridFilter(gridState = {}, columnKey = "") {
      return Object.prototype.hasOwnProperty.call(gridState?.filters || {}, columnKey);
    }

    function getDashboardGridTotalPages(totalRows = 0, pageSize = 0) {
      if (Number(pageSize || 0) <= 0) {
        return 1;
      }

      return Math.max(1, Math.ceil(totalRows / pageSize));
    }

    function clampDashboardGridPage(page = 1, totalPages = 1) {
      return Math.min(Math.max(Number(page) || 1, 1), Math.max(1, Number(totalPages) || 1));
    }

    function getDashboardVisiblePageNumbers(totalPages = 1, currentPage = 1) {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
      }

      const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
      return Array.from(pages)
        .filter((page) => page > 0 && page <= totalPages)
        .sort((left, right) => left - right);
    }

    function getDashboardGridFilterSelectionState(gridState = {}, columnKey = "", optionValues = []) {
      const availableValues = optionValues.filter((value, index) => optionValues.indexOf(value) === index);
      const selectedValues = hasDashboardGridFilter(gridState, columnKey)
        ? (gridState.filters?.[columnKey] || []).filter((value) => availableValues.includes(value))
        : availableValues;

      return {
        availableValues,
        hasExplicitFilter: hasDashboardGridFilter(gridState, columnKey),
        selectedValues,
        selectedValueSet: new Set(selectedValues),
      };
    }

    function compareDashboardValues(leftValue, rightValue) {
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
      }

      const leftText = String(leftValue ?? "").trim();
      const rightText = String(rightValue ?? "").trim();

      if (!leftText && !rightText) {
        return 0;
      }

      if (!leftText) {
        return 1;
      }

      if (!rightText) {
        return -1;
      }

      return leftText.localeCompare(rightText, "ko", {
        numeric: true,
        sensitivity: "base",
      });
    }

    function resolveDashboardGridRecords(records = [], columns = [], gridState = {}) {
      const filters = gridState.filters || {};
      const filteredRecords = records.filter((record) => columns.every((column) => {
        const selectedValues = Array.isArray(filters[column.key]) ? filters[column.key] : [];

        if (!hasDashboardGridFilter(gridState, column.key) || typeof column.getFilterValue !== "function") {
          return true;
        }

        return selectedValues.includes(normalizeDashboardFilterValue(column.getFilterValue(record)));
      }));

      if (!Array.isArray(gridState.sortRules) || gridState.sortRules.length === 0) {
        return {
          filteredRecords,
          sortedRecords: filteredRecords,
        };
      }

      const columnsByKey = Object.fromEntries(columns.map((column) => [column.key, column]));
      const sortedRecords = filteredRecords
        .map((record, index) => ({ index, record }))
        .sort((leftEntry, rightEntry) => {
          for (const rule of gridState.sortRules) {
            const column = columnsByKey[rule.key];
            const leftValue = column && typeof column.getSortValue === "function"
              ? column.getSortValue(leftEntry.record)
              : leftEntry.record?.[rule.key];
            const rightValue = column && typeof column.getSortValue === "function"
              ? column.getSortValue(rightEntry.record)
              : rightEntry.record?.[rule.key];
            const comparison = compareDashboardValues(leftValue, rightValue);

            if (comparison !== 0) {
              return rule.direction === "desc" ? comparison * -1 : comparison;
            }
          }

          return leftEntry.index - rightEntry.index;
        })
        .map((entry) => entry.record);

      return {
        filteredRecords,
        sortedRecords,
      };
    }

    function getDashboardGridFilterOptions(records = [], columns = [], gridState = {}, columnKey = "") {
      const targetColumn = columns.find((column) => column.key === columnKey);

      if (!targetColumn || typeof targetColumn.getFilterValue !== "function") {
        return [];
      }

      const remainingColumns = columns.filter((column) => column.key !== columnKey);
      const adjustedGridState = {
        ...gridState,
        filters: Object.fromEntries(
          Object.entries(gridState?.filters || {}).filter(([key]) => key !== columnKey),
        ),
      };
      const { filteredRecords } = resolveDashboardGridRecords(records, remainingColumns, adjustedGridState);

      return Array.from(new Set(filteredRecords
        .map((record) => normalizeDashboardFilterValue(targetColumn.getFilterValue(record)))
        .filter(Boolean)))
        .sort((left, right) => compareDashboardValues(left, right));
    }

    return Object.freeze({
      clampDashboardGridPage,
      compareDashboardValues,
      getDashboardGridFilterOptions,
      getDashboardGridFilterSelectionState,
      getDashboardGridState,
      getDashboardGridTotalPages,
      getDashboardVisiblePageNumbers,
      hasDashboardGridFilter,
      normalizeDashboardFilterValue,
      resolveDashboardGridRecords,
    });
  }

  return Object.freeze({ create });
});
