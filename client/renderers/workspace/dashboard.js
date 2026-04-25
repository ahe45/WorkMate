(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createDashboardRenderer(deps = {}) {
    const {
      buildDashboardRecords,
      buildStats,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      normalizeDashboardStatusFilter,
      renderBadge,
      renderDashboardDetailButton,
      renderDashboardDetailModal,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderDashboardMonthlyWorkStats,
      renderDashboardSummaryModal,
    } = deps;

  function renderDashboardView(state = {}) {
    const stats = buildStats(state);
    const { combinedRecords, statusCards, statusRecords } = buildDashboardRecords(stats);
    const selectedSummaryFilter = normalizeDashboardStatusFilter(state.dashboardSummaryFilter);
    const selectedDetailUserId = String(state.dashboardDetailUserId || "").trim();
    const overviewColumns = [
      {
        minWidth: "110px",
        getFilterValue: (record) => record.userName,
        getSortValue: (record) => record.userName,
        key: "userName",
        label: "이름",
        width: "12%",
        render: (record) => `<strong>${escapeHtml(record.userName || "-")}</strong>`,
      },
      {
        align: "center",
        minWidth: "86px",
        getFilterValue: (record) => record.employeeNo,
        getSortValue: (record) => record.employeeNo,
        key: "employeeNo",
        label: "사번",
        width: "8%",
        render: (record) => escapeHtml(record.employeeNo || "-"),
      },
      {
        minWidth: "128px",
        getFilterValue: (record) => record.primaryUnitName,
        getSortValue: (record) => record.primaryUnitName,
        key: "primaryUnitName",
        label: "조직",
        width: "12%",
        render: (record) => escapeHtml(record.primaryUnitName || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.jobTitle,
        getSortValue: (record) => record.jobTitle,
        key: "jobTitle",
        label: "직급",
        minWidth: "84px",
        width: "7%",
        render: (record) => escapeHtml(record.jobTitle || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.workStatusLabel,
        getSortValue: (record) => record.workStatusLabel,
        key: "workStatusLabel",
        label: "근무 상태",
        minWidth: "96px",
        width: "10%",
        render: (record) => renderBadge(record.workStatusLabel || "-", record.workStatusTone || "gray"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.scheduleLabel,
        getSortValue: (record) => record.scheduleLabel,
        key: "scheduleLabel",
        label: "근무 형태",
        minWidth: "96px",
        width: "10%",
        render: (record) => renderBadge(record.scheduleLabel || "-", record.scheduleTone || "gray"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.plannedTimeText,
        getSortValue: (record) => record.plannedTimeSort,
        key: "plannedTimeText",
        label: "예정 시간",
        minWidth: "104px",
        width: "11%",
        render: (record) => escapeHtml(record.plannedTimeText || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.startTimeText,
        getSortValue: (record) => record.startTimeSort,
        key: "startTimeText",
        label: "출근시간",
        minWidth: "92px",
        width: "9%",
        render: (record) => escapeHtml(record.startTimeText || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.endTimeText,
        getSortValue: (record) => record.endTimeSort,
        key: "endTimeText",
        label: "퇴근시간",
        minWidth: "92px",
        width: "9%",
        render: (record) => escapeHtml(record.endTimeText || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.siteName,
        getSortValue: (record) => record.siteName,
        key: "siteName",
        label: "사업장",
        minWidth: "124px",
        width: "9%",
        render: (record) => escapeHtml(record.siteName || "-"),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.userName,
        key: "detailAction",
        label: "상세",
        minWidth: "64px",
        render: (record) => renderDashboardDetailButton(record.userId),
        sortable: false,
        width: "5%",
      },
    ];

    return `
      <section class="view-stack">
        <section class="workmate-dashboard-summary-row">
          <div class="panel-card workmate-stat-stack workmate-dashboard-top-stack">
            <div class="workmate-dashboard-status-panel-head">
              <div>
                <p class="page-kicker">Today status</p>
                <h3>근무 현황</h3>
              </div>
              <span>오늘 기준</span>
            </div>
            ${statusCards.map((card) => `
              <button
                class="workmate-stat-card workmate-dashboard-status-card tone-${escapeAttribute(card.tone)}${selectedSummaryFilter === card.filter ? " is-active" : ""}"
                data-dashboard-summary-open="${escapeAttribute(card.filter)}"
                type="button"
              >
                <span>${escapeHtml(card.label)}</span>
                <strong>${escapeHtml(formatNumber(card.count || 0))}</strong>
              </button>
            `).join("")}
          </div>
          ${renderDashboardMonthlyWorkStats(stats, state)}
        </section>
        <article class="panel-card workmate-dashboard-table-panel result-grid-card workmate-dashboard-grid-card">
          <div class="workmate-dashboard-table-shell">
            ${renderDashboardGridTable(
              "overview",
              overviewColumns,
              combinedRecords,
              state,
              "표시할 근무 현황이 없습니다.",
              "오늘 기준 근무 상태, 일정, 휴가 데이터가 아직 없습니다."
            )}
          </div>
        </article>

        ${renderDashboardFilterMenu(state, "overview", overviewColumns, combinedRecords)}
        ${renderDashboardSummaryModal(selectedSummaryFilter, statusCards, statusRecords)}
        ${renderDashboardDetailModal(selectedDetailUserId, combinedRecords)}
      </section>
    `;
  }

    return Object.freeze({
      renderDashboardView,
    });
  }

  return Object.freeze({
    create: createDashboardRenderer,
  });
});
