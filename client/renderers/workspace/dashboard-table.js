(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardTableRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatAttendanceMinutes,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getApprovalStatusMeta,
      getDashboardScheduleMeta,
      getDashboardTimeSortValue,
      getDashboardWorkStatusMeta,
    } = dependencies;
    const dashboardGridStateModule = globalThis.WorkMateDashboardGridState
      || (typeof require === "function" ? require("./dashboard-grid-state.js") : null);
    const dashboardRecordModelsModule = globalThis.WorkMateDashboardRecordModels
      || (typeof require === "function" ? require("./dashboard-record-models.js") : null);

    if (typeof escapeHtml !== "function" || typeof escapeAttribute !== "function") {
      throw new Error("WorkMateDashboardTableRenderer requires HTML escaping helpers.");
    }

    if (!dashboardGridStateModule || typeof dashboardGridStateModule.create !== "function") {
      throw new Error("client/renderers/workspace/dashboard-grid-state.js must be loaded before client/renderers/workspace/dashboard-table.js.");
    }

    if (!dashboardRecordModelsModule || typeof dashboardRecordModelsModule.create !== "function") {
      throw new Error("client/renderers/workspace/dashboard-record-models.js must be loaded before client/renderers/workspace/dashboard-table.js.");
    }

    const {
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
    } = dashboardGridStateModule.create();
    const {
      buildDashboardMonthlyWorkStats,
      buildDashboardRecords,
      buildLeaveBalanceRecords,
      createLeaveBalanceBucket,
      formatLeaveDays,
      getLeaveBalanceCategory,
      renderDashboardMonthlyWorkStats,
    } = dashboardRecordModelsModule.create({
      escapeHtml,
      formatAttendanceMinutes,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getApprovalStatusMeta,
      getDashboardScheduleMeta,
      getDashboardTimeSortValue,
      getDashboardWorkStatusMeta,
    });

    function renderTableCheckboxFilterMenu({
      ariaLabel = "필터",
      className = "",
      closeAttributes = "",
      footerButtons = "",
      isAllVisibleSelected = false,
      isPartiallyVisibleSelected = false,
      menuAttributes = "",
      options = [],
      searchInputAttributes = "",
      searchInputId = "",
      searchValue = "",
      selectAllAttributes = "",
      style = "",
      title = "필터",
    } = {}) {
      const visibleOptionCount = options.length;
      const emptyMessage = searchValue ? "검색 결과가 없습니다." : "표시할 옵션이 없습니다.";

      return `
      <section class="table-filter-menu ${escapeAttribute(className)}" role="dialog" aria-label="${escapeAttribute(ariaLabel)}" ${menuAttributes} ${style ? `style="${escapeAttribute(style)}"` : ""}>
        <div class="table-filter-menu-head">
          <strong>${escapeHtml(title)}</strong>
          <button class="table-filter-close-button" ${closeAttributes} type="button" aria-label="닫기">×</button>
        </div>
        <label class="table-filter-search" for="${escapeAttribute(searchInputId)}">
          <input
            id="${escapeAttribute(searchInputId)}"
            type="search"
            placeholder="옵션 검색"
            value="${escapeAttribute(searchValue)}"
            ${searchInputAttributes}
          />
        </label>
        <div class="table-filter-select-all">
          <label class="table-filter-option table-filter-option-select-all">
            <input
              type="checkbox"
              ${selectAllAttributes}
              ${isAllVisibleSelected ? "checked" : ""}
              ${isPartiallyVisibleSelected ? 'data-table-filter-partial="true"' : ""}
            />
            <span>전체 선택</span>
          </label>
        </div>
        <div class="table-filter-options" data-table-filter-options="true">
          ${options.map((option) => `
            <label
              class="table-filter-option${option.className ? ` ${escapeAttribute(option.className)}` : ""}"
              title="${escapeAttribute(option.title || option.label || "")}"
              data-table-filter-option-row="true"
              data-table-filter-search-value="${escapeAttribute(String(option.searchValue || option.label || option.title || "").toLocaleLowerCase("ko"))}"
              ${option.rowAttributes || ""}
            >
              <input type="checkbox" ${option.inputAttributes || ""} ${option.checked ? "checked" : ""} />
              <span>${escapeHtml(option.label || "")}</span>
            </label>
          `).join("")}
          <div class="table-filter-empty" data-table-filter-empty="true" ${visibleOptionCount > 0 ? "hidden" : ""}>${escapeHtml(emptyMessage)}</div>
        </div>
        <div class="table-filter-menu-footer">${footerButtons}</div>
      </section>
    `;
    }

    function renderDashboardGridSortIcon(sortRule = null, sortRuleIndex = -1, totalSortRuleCount = 0) {
      const directionLabel = sortRule?.direction === "desc" ? "&darr;" : sortRule ? "&uarr;" : "&#8597;";
      const orderLabel = sortRule && totalSortRuleCount > 1 ? String(sortRuleIndex + 1) : "";
      return orderLabel
        ? `<span class="table-sort-arrow">${directionLabel}</span><span class="table-sort-order">${orderLabel}</span>`
        : `<span class="table-sort-arrow">${directionLabel}</span><span class="table-sort-order table-sort-order-hidden"></span>`;
    }

    function renderDashboardGridColumnStyle(column = {}) {
      const styles = [];

      if (column.width) styles.push(`width: ${column.width}`);
      if (column.minWidth) styles.push(`min-width: ${column.minWidth}`);
      if (column.maxWidth) styles.push(`max-width: ${column.maxWidth}`);
      if (column.align) styles.push(`text-align: ${column.align}`);

      return styles.length > 0 ? ` style="${escapeAttribute(styles.join("; "))}"` : "";
    }

    function renderDashboardGridHeader(tableId = "", column = {}, gridState = {}) {
      const activeSortRules = Array.isArray(gridState.sortRules) ? gridState.sortRules : [];
      const activeSortRuleIndex = activeSortRules.findIndex((rule) => rule.key === column.key);
      const activeSortRule = activeSortRuleIndex >= 0 ? activeSortRules[activeSortRuleIndex] : null;
      const isFilterActive = hasDashboardGridFilter(gridState, column.key);
      const hasFilter = column.filterable !== false;
      const isSortable = column.sortable !== false;
      const classNames = ["table-header-enhanced"];

      if (activeSortRule) classNames.push(activeSortRule.direction === "desc" ? "sorted-desc" : "sorted-asc");
      if (isFilterActive) classNames.push("filter-active");

      return `
      <th class="${classNames.join(" ")}" scope="col"${renderDashboardGridColumnStyle(column)}>
        <div class="table-header-shell ${hasFilter ? "has-filter" : "no-filter"}">
          ${isSortable ? `
            <button class="table-sort-button" data-dashboard-grid-sort="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}" type="button">
              <span class="table-header-label">${escapeHtml(column.label || "-")}</span>
              <span class="table-sort-icon" aria-hidden="true">${renderDashboardGridSortIcon(activeSortRule, activeSortRuleIndex, activeSortRules.length)}</span>
            </button>
          ` : `
            <span class="table-sort-button table-sort-button-static">
              <span class="table-header-label">${escapeHtml(column.label || "-")}</span>
            </span>
          `}
          ${hasFilter ? `
            <button class="table-filter-button" data-dashboard-grid-filter-open="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}" type="button" aria-label="${escapeAttribute(`${column.label || "컬럼"} 필터 열기`)}">
              <span class="table-filter-glyph" aria-hidden="true"></span>
            </button>
          ` : ""}
        </div>
      </th>
    `;
    }

    function renderDashboardGridFilters() {
      return "";
    }

    function renderDashboardGridPagination(tableId = "", gridState = {}, totalRows = 0) {
      const totalPages = getDashboardGridTotalPages(totalRows, gridState.pageSize);
      const currentPage = clampDashboardGridPage(gridState.page, totalPages);
      const pageSize = Number(gridState.pageSize || 0);
      const startRowNumber = totalRows === 0 ? 0 : pageSize > 0 ? ((currentPage - 1) * pageSize) + 1 : 1;
      const endRowNumber = totalRows === 0 ? 0 : pageSize > 0 ? Math.min(totalRows, startRowNumber + pageSize - 1) : totalRows;
      const visiblePageNumbers = getDashboardVisiblePageNumbers(totalPages, currentPage);
      const pageSizeLabel = pageSize > 0 ? `${pageSize}개` : "모두 표시";
      const pageSizeOptions = [10, 20, 50, 100, 500, 1000, 2000, 0];

      return `
      <div class="table-pagination">
        <div class="table-page-size">
          <span>표시 개수</span>
          <div class="table-page-size-select">
            <button type="button" class="page-size-trigger" data-dashboard-grid-page-size-trigger="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" aria-expanded="${gridState.pageSizeMenuOpen ? "true" : "false"}">
              <span>${escapeHtml(pageSizeLabel)}</span>
              <span class="page-size-caret">${gridState.pageSizeMenuOpen ? "▴" : "▾"}</span>
            </button>
            ${gridState.pageSizeMenuOpen ? `
              <div class="page-size-menu">
                ${pageSizeOptions.map((size) => `
                  <button type="button" class="page-size-option ${size === pageSize ? "active" : ""}" data-dashboard-grid-page-size-option="${escapeAttribute(String(size))}" data-dashboard-grid-table="${escapeAttribute(tableId)}">
                    ${size > 0 ? `${size}개` : "모두 표시"}
                  </button>
                `).join("")}
              </div>
            ` : ""}
          </div>
        </div>
        <div class="table-pagination-actions">
          <button type="button" class="page-btn" data-dashboard-grid-nav="prev" data-dashboard-grid-table="${escapeAttribute(tableId)}" ${currentPage === 1 ? "disabled" : ""}>이전</button>
          ${visiblePageNumbers.map((page, index) => {
            const previousPage = visiblePageNumbers[index - 1];
            const ellipsis = typeof previousPage === "number" && page - previousPage > 1
              ? '<span class="table-pagination-ellipsis">…</span>'
              : "";

            return `${ellipsis}
              <button type="button" class="page-btn ${page === currentPage ? "active" : ""}" data-dashboard-grid-page="${escapeAttribute(String(page))}" data-dashboard-grid-table="${escapeAttribute(tableId)}">${page}</button>`;
          }).join("")}
          <button type="button" class="page-btn" data-dashboard-grid-nav="next" data-dashboard-grid-table="${escapeAttribute(tableId)}" ${currentPage === totalPages ? "disabled" : ""}>다음</button>
        </div>
        <div class="table-pagination-summary">${startRowNumber}-${endRowNumber} / 총 ${totalRows}건</div>
      </div>
    `;
    }

    function renderDashboardGridTable(tableId = "", columns = [], records = [], state = {}, emptyTitle = "표시할 항목이 없습니다.", emptyDescription = "오늘 기준 데이터가 없습니다.") {
      const gridState = getDashboardGridState(state, tableId);
      const { sortedRecords } = resolveDashboardGridRecords(records, columns, gridState);
      const totalRows = sortedRecords.length;
      const totalPages = getDashboardGridTotalPages(totalRows, gridState.pageSize);
      const currentPage = clampDashboardGridPage(gridState.page, totalPages);
      const pageSize = Number(gridState.pageSize || 0);
      const startIndex = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
      const visibleRecords = pageSize > 0 ? sortedRecords.slice(startIndex, startIndex + pageSize) : sortedRecords;
      const isEmpty = visibleRecords.length === 0;

      return `
      ${renderDashboardGridFilters(tableId, columns, gridState)}
      <div class="table-wrap${isEmpty ? " is-empty" : ""}">
        <table>
          <thead>
            <tr>${columns.map((column) => renderDashboardGridHeader(tableId, column, gridState)).join("")}</tr>
          </thead>
          <tbody class="table-body${isEmpty ? " is-empty" : ""}">
            ${isEmpty ? `
              <tr class="table-empty-row">
                <td class="table-empty-cell" colspan="${escapeAttribute(String(columns.length || 1))}">
                  <strong>${escapeHtml(emptyTitle)}</strong><br />
                  <span>${escapeHtml(emptyDescription)}</span>
                </td>
              </tr>
            ` : visibleRecords.map((record) => `
              <tr>
                ${columns.map((column) => `<td${renderDashboardGridColumnStyle(column)}>${typeof column.render === "function" ? column.render(record) : escapeHtml(String(record?.[column.key] || "-"))}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${renderDashboardGridPagination(tableId, gridState, totalRows)}
    `;
    }

    function renderDashboardFilterMenu(state = {}, tableId = "", columns = [], records = []) {
      const filterMenu = state.dashboardGridFilterMenu || null;

      if (!filterMenu || filterMenu.tableId !== tableId) {
        return "";
      }

      const column = columns.find((item) => item.key === filterMenu.columnKey);

      if (!column) {
        return "";
      }

      const gridState = getDashboardGridState(state, tableId);
      const options = getDashboardGridFilterOptions(records, columns, gridState, column.key);
      const searchTerm = String(gridState.filterMenuSearch || "").trim();
      const normalizedSearchTerm = searchTerm.toLocaleLowerCase("ko");
      const visibleOptions = options.filter((option) => !normalizedSearchTerm || String(option || "").toLocaleLowerCase("ko").includes(normalizedSearchTerm));
      const selectionState = getDashboardGridFilterSelectionState(gridState, column.key, options);
      const visibleSelectedCount = visibleOptions.filter((value) => selectionState.selectedValueSet.has(value)).length;
      const isAllVisibleSelected = visibleOptions.length > 0 && visibleSelectedCount === visibleOptions.length;
      const isPartiallyVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleOptions.length;
      const top = Math.max(12, Number(filterMenu.top || 12));
      const left = Math.max(12, Number(filterMenu.left || 12));
      const searchInputId = `dashboard-grid-filter-search-${tableId}-${column.key}`;

      return `
      <div class="modal-backdrop table-filter-menu-overlay" data-dashboard-grid-filter-close="true" aria-hidden="true"></div>
      ${renderTableCheckboxFilterMenu({
        ariaLabel: `${column.label || "컬럼"} 필터`,
        className: "workmate-dashboard-filter-menu",
        closeAttributes: 'data-dashboard-grid-filter-close="true"',
        footerButtons: `
          <button class="table-filter-footer-button subtle" data-dashboard-grid-filter-clear="true" data-dashboard-grid-keep-menu="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}" type="button">초기화</button>
          <button class="table-filter-footer-button" data-dashboard-grid-filter-close="true" type="button">적용</button>
        `,
        isAllVisibleSelected,
        isPartiallyVisibleSelected,
        menuAttributes: `data-dashboard-grid-options="${escapeAttribute(JSON.stringify(options))}" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}"`,
        options: visibleOptions.map((option) => ({
          checked: selectionState.selectedValueSet.has(option),
          inputAttributes: `data-dashboard-grid-filter-option-input="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}" data-dashboard-grid-value="${escapeAttribute(option)}"`,
          label: option,
          title: option,
        })),
        searchInputAttributes: `data-dashboard-grid-filter-search-input="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}"`,
        searchInputId,
        searchValue: searchTerm,
        selectAllAttributes: `data-dashboard-grid-filter-select-all="true" data-dashboard-grid-table="${escapeAttribute(tableId)}" data-dashboard-grid-column="${escapeAttribute(column.key || "")}"`,
        style: `top: ${String(top)}px; left: ${String(left)}px;`,
        title: column.label || "컬럼 필터",
      })}
    `;
    }

    return Object.freeze({
      normalizeDashboardFilterValue,
      getDashboardGridState,
      hasDashboardGridFilter,
      getDashboardGridTotalPages,
      clampDashboardGridPage,
      getDashboardVisiblePageNumbers,
      getDashboardGridFilterSelectionState,
      compareDashboardValues,
      buildDashboardRecords,
      buildDashboardMonthlyWorkStats,
      renderDashboardMonthlyWorkStats,
      formatLeaveDays,
      getLeaveBalanceCategory,
      createLeaveBalanceBucket,
      buildLeaveBalanceRecords,
      resolveDashboardGridRecords,
      getDashboardGridFilterOptions,
      renderTableCheckboxFilterMenu,
      renderDashboardGridSortIcon,
      renderDashboardGridHeader,
      renderDashboardGridColumnStyle,
      renderDashboardGridFilters,
      renderDashboardGridPagination,
      renderDashboardGridTable,
      renderDashboardFilterMenu,
    });
  }

  return Object.freeze({ create });
});
