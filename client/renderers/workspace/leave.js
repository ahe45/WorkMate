(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateLeaveRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createLeaveRenderer(deps = {}) {
    const {
      buildLeaveBalanceRecords,
      buildStats,
      escapeHtml,
      formatLeaveDays,
      formatNumber,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderMetricCard,
    } = deps;

  function renderLeaveView(state = {}) {
    const stats = buildStats(state);
    const { records, totals } = buildLeaveBalanceRecords(stats);
    const leaveColumns = [
      {
        getFilterValue: (record) => record.userName,
        getSortValue: (record) => record.userName,
        key: "userName",
        label: "이름",
        minWidth: "110px",
        render: (record) => `<strong>${escapeHtml(record.userName || "-")}</strong>`,
        width: "12%",
      },
      {
        align: "center",
        getFilterValue: (record) => record.employeeNo,
        getSortValue: (record) => record.employeeNo,
        key: "employeeNo",
        label: "사번",
        minWidth: "86px",
        render: (record) => escapeHtml(record.employeeNo || "-"),
        width: "8%",
      },
      {
        getFilterValue: (record) => record.primaryUnitName,
        getSortValue: (record) => record.primaryUnitName,
        key: "primaryUnitName",
        label: "조직",
        minWidth: "118px",
        render: (record) => escapeHtml(record.primaryUnitName || "-"),
        width: "12%",
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.totalHeld,
        key: "totalHeld",
        label: "전체 휴가 보유",
        minWidth: "104px",
        render: (record) => `<span class="workmate-leave-day-value is-total">${escapeHtml(formatLeaveDays(record.totalHeld))}</span>`,
        width: "17%",
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.annualHeld,
        key: "annualHeld",
        label: "연차휴가 보유",
        minWidth: "104px",
        render: (record) => `<span class="workmate-leave-day-value">${escapeHtml(formatLeaveDays(record.annualHeld))}</span>`,
        width: "17%",
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.compensatoryHeld,
        key: "compensatoryHeld",
        label: "보상휴가 보유",
        minWidth: "104px",
        render: (record) => `<span class="workmate-leave-day-value">${escapeHtml(formatLeaveDays(record.compensatoryHeld))}</span>`,
        width: "17%",
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.otherHeld,
        key: "otherHeld",
        label: "기타휴가 보유",
        minWidth: "104px",
        render: (record) => `<span class="workmate-leave-day-value">${escapeHtml(formatLeaveDays(record.otherHeld))}</span>`,
        width: "17%",
      },
    ];

    return `
      <section class="view-stack">
        <section class="metric-grid">
          ${renderMetricCard("대상 직원", `${formatNumber(records.length)}명`, "현재 재직", "tone-blue")}
          ${renderMetricCard("전체 휴가 보유", formatLeaveDays(totals.totalHeld), "현재 잔여", "tone-green")}
          ${renderMetricCard("연차휴가 보유", formatLeaveDays(totals.annualHeld), "현재 잔여", "tone-orange")}
          ${renderMetricCard("보상/기타 보유", formatLeaveDays(totals.compensatoryHeld + totals.otherHeld), "현재 잔여", "tone-purple")}
        </section>

        <article class="panel-card workmate-dashboard-table-panel result-grid-card workmate-leave-grid-card">
          <div class="workmate-dashboard-table-shell">
            ${renderDashboardGridTable(
              "leaveBalances",
              leaveColumns,
              records,
              state,
              "표시할 휴가 현황이 없습니다.",
              "현재 연도 기준 휴가 잔액 데이터가 없습니다."
            )}
          </div>
        </article>

        ${renderDashboardFilterMenu(state, "leaveBalances", leaveColumns, records)}
      </section>
    `;
  }

    return Object.freeze({
      renderLeaveView,
    });
  }

  return Object.freeze({
    create: createLeaveRenderer,
  });
});
