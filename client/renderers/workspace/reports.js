(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateReportsRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createReportsRenderer(deps = {}) {
    const {
      buildStats,
      escapeAttribute,
      escapeHtml,
      filterPersonalScopeItems,
      formatNumber,
      formatReportRangeLabel,
      formatScheduleDateKey,
      getDashboardGridState,
      getReportRequestRange,
      iterateScheduleDates,
      normalizeAttendanceDateKey,
      parseJsonObject,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderEmptyState,
      renderMetricCard,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

  function getReportSessionsForView(state = {}, stats = {}) {
    const reportData = state.reportRecordsData || {};
    const hasLoadedRange = Boolean(reportData.loadedOrganizationId || reportData.dateFrom || reportData.dateTo);
    const fallbackSessions = stats.dashboardMonthlySessions.length > 0 ? stats.dashboardMonthlySessions : stats.sessions;

    return filterPersonalScopeItems(state, stats.users, hasLoadedRange ? toArray(reportData.sessions) : fallbackSessions).map((session) => ({
      ...session,
      summaryJson: parseJsonObject(session?.summaryJson),
    }));
  }

  function getReportLeaveRequestsForView(state = {}, stats = {}) {
    const reportData = state.reportRecordsData || {};
    const hasLoadedRange = Boolean(reportData.loadedOrganizationId || reportData.dateFrom || reportData.dateTo);
    const leaveRequests = hasLoadedRange ? toArray(reportData.leaveRequests) : toArray(stats.leaveRequests);
    return filterPersonalScopeItems(state, stats.users, leaveRequests);
  }

  function formatReportMinutes(minutes = 0) {
    const normalizedMinutes = Math.max(0, Math.round(Number(minutes || 0)));
    const hours = Math.floor(normalizedMinutes / 60);
    const remainder = normalizedMinutes % 60;

    if (hours <= 0) {
      return `${formatNumber(remainder)}m`;
    }

    if (remainder <= 0) {
      return `${formatNumber(hours)}h`;
    }

    return `${formatNumber(hours)}h ${formatNumber(remainder)}m`;
  }

  function createReportBucket(user = {}) {
    return {
      actualPaidMinutes: 0,
      actualWorkDays: 0,
      actualWorkMinutes: 0,
      approvedPaidMinutes: 0,
      approvedOvertimeMinutes: 0,
      approvedWorkDays: 0,
      approvedWorkMinutes: 0,
      earlyLeaveMinutes: 0,
      employeeNo: user?.employeeNo || "-",
      jobTitle: user?.jobTitle || "사원",
      lateMinutes: 0,
      paidLeaveDays: 0,
      paidLeaveMinutes: 0,
      primaryUnitName: user?.primaryUnitName || "-",
      scheduledWorkDays: 0,
      scheduledWorkMinutes: 0,
      userId: String(user?.id || ""),
      userName: user?.name || "-",
    };
  }

  function buildReportRecordsModel(state = {}, stats = {}) {
    const range = getReportRequestRange(state.reportDateCursor);
    const visibleDates = iterateScheduleDates(range.dateFrom, range.dateTo);
    const sessions = getReportSessionsForView(state, stats);
    const leaveRequests = getReportLeaveRequestsForView(state, stats);
    const users = stats.activeUsers
      .slice()
      .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));
    const recordsByUserId = new Map(users.map((user) => [String(user?.id || ""), createReportBucket(user)]));
    const userLeaveDates = new Map();

    leaveRequests.forEach((leave) => {
      const userId = String(leave?.userId || "");

      if (!recordsByUserId.has(userId)) {
        return;
      }

      const startDate = normalizeAttendanceDateKey(leave?.startDate || "");
      const endDate = normalizeAttendanceDateKey(leave?.endDate || startDate);
      const leaveDates = userLeaveDates.get(userId) || new Set();

      visibleDates.forEach((date) => {
        const dateKey = formatScheduleDateKey(date);

        if (dateKey >= startDate && dateKey <= endDate) {
          leaveDates.add(dateKey);
        }
      });

      userLeaveDates.set(userId, leaveDates);
    });

    sessions.forEach((session) => {
      const userId = String(session?.userId || "");
      const record = recordsByUserId.get(userId);

      if (!record) {
        return;
      }

      const scheduledMinutes = Number(session?.scheduledMinutes || 0);
      const grossMinutes = Number(session?.grossWorkMinutes || 0);
      const recognizedMinutes = Number(session?.recognizedWorkMinutes || 0);
      const overtimeMinutes = Number(session?.overtimeMinutes || 0);
      const lateMinutes = Number(session?.lateMinutes || 0);
      const earlyLeaveMinutes = Number(session?.earlyLeaveMinutes || 0);

      if (scheduledMinutes > 0) {
        record.scheduledWorkDays += 1;
      }

      if (recognizedMinutes > 0) {
        record.approvedWorkDays += 1;
      }

      if (grossMinutes > 0) {
        record.actualWorkDays += 1;
      }

      record.scheduledWorkMinutes += scheduledMinutes;
      record.approvedWorkMinutes += recognizedMinutes;
      record.actualWorkMinutes += grossMinutes;
      record.approvedOvertimeMinutes += overtimeMinutes;
      record.lateMinutes += lateMinutes;
      record.earlyLeaveMinutes += earlyLeaveMinutes;
    });

    userLeaveDates.forEach((dates, userId) => {
      const record = recordsByUserId.get(userId);

      if (!record) {
        return;
      }

      record.paidLeaveDays = dates.size;
      record.paidLeaveMinutes = dates.size * 480;
    });

    const records = Array.from(recordsByUserId.values()).map((record) => ({
      ...record,
      actualPaidMinutes: record.actualWorkMinutes + record.paidLeaveMinutes,
      approvedPaidMinutes: record.approvedWorkMinutes + record.paidLeaveMinutes,
      actualOvertimeMinutes: Math.max(0, record.actualWorkMinutes - record.scheduledWorkMinutes),
    }));
    const totals = calculateReportTotals(records);

    return {
      range,
      records,
      totals,
    };
  }

  function calculateReportTotals(records = []) {
    return toArray(records).reduce((accumulator, record) => ({
      actualOvertimeMinutes: accumulator.actualOvertimeMinutes + Number(record?.actualOvertimeMinutes || 0),
      actualPaidMinutes: accumulator.actualPaidMinutes + Number(record?.actualPaidMinutes || 0),
      actualWorkMinutes: accumulator.actualWorkMinutes + Number(record?.actualWorkMinutes || 0),
      approvedPaidMinutes: accumulator.approvedPaidMinutes + Number(record?.approvedPaidMinutes || 0),
      approvedWorkMinutes: accumulator.approvedWorkMinutes + Number(record?.approvedWorkMinutes || 0),
      paidLeaveDays: accumulator.paidLeaveDays + Number(record?.paidLeaveDays || 0),
      paidLeaveMinutes: accumulator.paidLeaveMinutes + Number(record?.paidLeaveMinutes || 0),
      scheduledWorkMinutes: accumulator.scheduledWorkMinutes + Number(record?.scheduledWorkMinutes || 0),
    }), {
      actualOvertimeMinutes: 0,
      actualPaidMinutes: 0,
      actualWorkMinutes: 0,
      approvedPaidMinutes: 0,
      approvedWorkMinutes: 0,
      paidLeaveDays: 0,
      paidLeaveMinutes: 0,
      scheduledWorkMinutes: 0,
    });
  }

  function renderReportNumber(value = 0, className = "") {
    return `<span class="${escapeAttribute(className)}">${escapeHtml(formatNumber(value))}</span>`;
  }

  function renderReportMinutes(value = 0, className = "") {
    return `<span class="${escapeAttribute(className)}">${escapeHtml(formatReportMinutes(value))}</span>`;
  }

  function getReportGridColumns() {
    return [
      {
        align: "center",
        getFilterValue: (record) => record.employeeNo,
        getSortValue: (record) => record.employeeNo,
        key: "employeeNo",
        label: "사원번호",
        minWidth: "96px",
        width: "7%",
        render: (record) => escapeHtml(record.employeeNo || "-"),
      },
      {
        getFilterValue: (record) => record.userName,
        getSortValue: (record) => record.userName,
        key: "userName",
        label: "직원",
        minWidth: "98px",
        width: "7%",
        render: (record) => `<strong>${escapeHtml(record.userName || "-")}</strong>`,
      },
      {
        getFilterValue: (record) => record.primaryUnitName,
        getSortValue: (record) => record.primaryUnitName,
        key: "primaryUnitName",
        label: "조직",
        minWidth: "118px",
        width: "8%",
        render: (record) => escapeHtml(record.primaryUnitName || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.scheduledWorkDays,
        getSortValue: (record) => record.scheduledWorkDays,
        key: "scheduledWorkDays",
        label: "소정근무일수",
        minWidth: "112px",
        width: "7%",
        render: (record) => renderReportNumber(record.scheduledWorkDays),
      },
      {
        align: "center",
        getFilterValue: (record) => record.actualWorkDays,
        getSortValue: (record) => record.actualWorkDays,
        key: "actualWorkDays",
        label: "근무일수",
        minWidth: "112px",
        width: "7%",
        render: (record) => renderReportNumber(record.actualWorkDays),
      },
      {
        align: "center",
        getFilterValue: (record) => record.paidLeaveDays,
        getSortValue: (record) => record.paidLeaveDays,
        key: "paidLeaveDays",
        label: "유급휴가일수",
        minWidth: "112px",
        width: "7%",
        render: (record) => renderReportNumber(record.paidLeaveDays, record.paidLeaveDays > 0 ? "workmate-report-leave-value" : ""),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.scheduledWorkMinutes,
        key: "scheduledWorkMinutes",
        label: "소정근로시간",
        minWidth: "116px",
        width: "8%",
        render: (record) => renderReportMinutes(record.scheduledWorkMinutes),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.actualWorkMinutes,
        key: "actualWorkMinutes",
        label: "근로시간",
        minWidth: "116px",
        width: "8%",
        render: (record) => renderReportMinutes(record.actualWorkMinutes),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.actualPaidMinutes,
        key: "actualPaidMinutes",
        label: "유급시간",
        minWidth: "116px",
        width: "8%",
        render: (record) => renderReportMinutes(record.actualPaidMinutes),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.paidLeaveMinutes,
        key: "paidLeaveMinutes",
        label: "유급휴가시간",
        minWidth: "116px",
        width: "8%",
        render: (record) => renderReportMinutes(record.paidLeaveMinutes, record.paidLeaveMinutes > 0 ? "workmate-report-leave-value" : ""),
      },
      {
        align: "center",
        filterable: false,
        getSortValue: (record) => record.actualOvertimeMinutes,
        key: "actualOvertimeMinutes",
        label: "연장근로시간",
        minWidth: "140px",
        width: "9%",
        render: (record) => renderReportMinutes(record.actualOvertimeMinutes),
      },
      {
        align: "center",
        getFilterValue: (record) => record.lateMinutes > 0 ? "있음" : "없음",
        getSortValue: (record) => record.lateMinutes,
        key: "lateMinutes",
        label: "지각",
        minWidth: "84px",
        width: "5%",
        render: (record) => renderReportMinutes(record.lateMinutes, record.lateMinutes > 0 ? "workmate-attendance-grid-alert" : ""),
      },
      {
        align: "center",
        getFilterValue: (record) => record.earlyLeaveMinutes > 0 ? "있음" : "없음",
        getSortValue: (record) => record.earlyLeaveMinutes,
        key: "earlyLeaveMinutes",
        label: "조퇴",
        minWidth: "84px",
        width: "5%",
        render: (record) => renderReportMinutes(record.earlyLeaveMinutes, record.earlyLeaveMinutes > 0 ? "workmate-attendance-grid-alert" : ""),
      },
    ];
  }

  function renderReportToolbar(state = {}) {
    const rangeLabel = formatReportRangeLabel(state.reportDateCursor);

    return `
      <div class="workmate-report-toolbar">
        <div class="workmate-report-title-row">
          <div class="workmate-report-title">
            <h3>실시간 리포트</h3>
            <span aria-label="도움말">?</span>
          </div>
        </div>
        <div class="workmate-report-control-row">
          <div class="workmate-report-range-control">
            <button class="secondary-button workmate-schedule-nav-button" data-report-nav="prev" type="button" aria-label="이전">‹</button>
            <strong>${escapeHtml(rangeLabel)}</strong>
            <button class="secondary-button workmate-schedule-nav-button" data-report-nav="next" type="button" aria-label="다음">›</button>
          </div>
          <div class="workmate-report-spacer"></div>
          <div class="workmate-report-note">
            <span>근로시간 = 휴게시간이 차감된 시간</span>
            <span>유급시간 = 근로시간 + 유급휴가시간</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderReportMetricGrid(records = []) {
    const totals = calculateReportTotals(records);

    return `
      <section class="metric-grid">
        ${renderMetricCard("대상 직원", `${formatNumber(records.length)}명`, "필터 반영", "tone-blue")}
        ${renderMetricCard("소정근로시간", formatReportMinutes(totals.scheduledWorkMinutes), "그리드 합계", "tone-green")}
        ${renderMetricCard("근로시간", formatReportMinutes(totals.actualWorkMinutes), "그리드 합계", "tone-orange")}
        ${renderMetricCard("유급시간", formatReportMinutes(totals.actualPaidMinutes), "그리드 합계", "tone-purple")}
      </section>
    `;
  }

  function renderReportsView(state = {}) {
    const stats = buildStats(state);
    const model = buildReportRecordsModel(state, stats);
    const columns = getReportGridColumns();
    const reportGridState = getDashboardGridState(state, "reports");
    const { sortedRecords: filteredRecords } = resolveDashboardGridRecords(model.records, columns, reportGridState);

    if (state.reportRecordsLoading) {
      return `
        <section class="view-stack">
          <article class="panel-card workmate-report-shell">
            ${renderReportToolbar(state)}
            ${renderEmptyState("리포트를 불러오는 중입니다.", "월별 출퇴근 집계 데이터를 조회하고 있습니다.")}
          </article>
        </section>
      `;
    }

    return `
      <section class="view-stack">
        ${renderReportMetricGrid(filteredRecords)}
        <article class="panel-card workmate-report-shell">
          ${renderReportToolbar(state)}
          <section class="workmate-report-grid-panel result-grid-card">
            <div class="workmate-dashboard-table-shell">
              ${renderDashboardGridTable(
                "reports",
                columns,
                model.records,
                state,
                "표시할 리포트 데이터가 없습니다.",
                "선택한 월의 출퇴근 기록이 없습니다."
              )}
            </div>
          </section>
        </article>
        ${renderDashboardFilterMenu(state, "reports", columns, model.records)}
      </section>
    `;
  }

    return Object.freeze({
      formatReportMinutes,
      renderReportsView,
    });
  }

  return Object.freeze({
    create: createReportsRenderer,
  });
});
