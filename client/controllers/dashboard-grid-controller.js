(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardGridController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const dashboardGridFilterControllerModule = globalThis.WorkMateDashboardGridFilterController
    || (typeof require === "function" ? require("./dashboard-grid-filter-controller.js") : null);

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

    if (!dashboardGridFilterControllerModule || typeof dashboardGridFilterControllerModule.create !== "function") {
      throw new Error("client/controllers/dashboard-grid-filter-controller.js must be loaded before client/controllers/dashboard-grid-controller.js.");
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
          || Boolean(state.managementEmployeeExcelModalOpen)
          || Boolean(state.managementEmployeeModalOpen)
          || Boolean(state.managementJobTitleModalOpen)
          || Boolean(state.managementLeaveGroupModalOpen)
          || Boolean(state.managementLeaveManualGrantModalOpen)
          || Boolean(state.managementLeaveRuleModalOpen)
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

    const dashboardGridFilterController = dashboardGridFilterControllerModule.create({
      closeAllDashboardGridPageSizeMenus,
      filterTableFilterOptionValues,
      getDashboardGridConfig,
      getVisibleTableFilterOptionInputs,
      renderWorkspacePage,
      state,
    });
    const {
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
    } = dashboardGridFilterController;

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
