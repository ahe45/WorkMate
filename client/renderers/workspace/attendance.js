(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAttendanceRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAttendanceRenderer(deps = {}) {
    const {
      ATTENDANCE_VIEW_MODES,
      SCHEDULE_DAY_NAMES,
      buildStats,
      escapeAttribute,
      escapeHtml,
      filterPersonalScopeItems,
      formatAttendanceMinutes,
      formatAttendanceRangeLabel,
      formatNumber,
      formatScheduleDateKey,
      formatTime,
      formatTimeRange,
      getAttendanceDetailStatusMeta,
      getAttendanceRequestRange,
      getScheduleUserUnitName,
      iterateScheduleDates,
      normalizeAttendanceDateKey,
      normalizeAttendanceViewMode,
      parseJsonObject,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderEmptyState,
      toArray,
    } = deps;

  function getAttendanceSessionsForView(state = {}, stats = {}) {
    const attendanceData = state.attendanceRecordsData || {};
    const hasLoadedRange = Boolean(attendanceData.loadedOrganizationId || attendanceData.dateFrom || attendanceData.dateTo);
    const sessions = hasLoadedRange ? toArray(attendanceData.sessions) : toArray(stats.sessions);

    return filterPersonalScopeItems(state, stats.users, sessions).map((session) => ({
      ...session,
      summaryJson: parseJsonObject(session?.summaryJson),
    }));
  }

  function getAttendanceLeaveRequestsForView(state = {}, stats = {}) {
    const attendanceData = state.attendanceRecordsData || {};
    const hasLoadedRange = Boolean(attendanceData.loadedOrganizationId || attendanceData.dateFrom || attendanceData.dateTo);
    const leaveRequests = hasLoadedRange ? toArray(attendanceData.leaveRequests) : toArray(stats.leaveRequests);
    return filterPersonalScopeItems(state, stats.users, leaveRequests);
  }

  function buildAttendanceRecord(session = {}, user = null) {
    const statusMeta = getAttendanceDetailStatusMeta(session);
    const plannedTimeText = formatTimeRange(session?.plannedStartAt, session?.plannedEndAt);
    const actualTimeText = formatTimeRange(session?.actualFirstWorkStartAt, session?.actualLastWorkEndAt);

    return {
      actualTimeText,
      anomalyCount: Number(session?.anomalyCount || 0),
      earlyLeaveMinutes: Number(session?.earlyLeaveMinutes || 0),
      employeeNo: user?.employeeNo || session?.employeeNo || "-",
      endTimeText: session?.actualLastWorkEndAt ? formatTime(session.actualLastWorkEndAt) : "-",
      grossWorkMinutes: Number(session?.grossWorkMinutes || 0),
      jobTitle: user?.jobTitle || "사원",
      lateMinutes: Number(session?.lateMinutes || 0),
      overtimeMinutes: Number(session?.overtimeMinutes || 0),
      plannedTimeText,
      primaryUnitName: user?.primaryUnitName || "-",
      recognizedWorkMinutes: Number(session?.recognizedWorkMinutes || 0),
      session,
      siteName: session?.siteName || user?.defaultSiteName || "-",
      startTimeText: session?.actualFirstWorkStartAt ? formatTime(session.actualFirstWorkStartAt) : "-",
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
      userId: String(session?.userId || user?.id || ""),
      userName: user?.name || session?.userName || "-",
      workDate: normalizeAttendanceDateKey(session?.workDateLocal || ""),
    };
  }

  function buildAttendanceLeaveRecord(leave = {}, user = null, workDate = "") {
    return {
      actualTimeText: "-",
      anomalyCount: 0,
      earlyLeaveMinutes: 0,
      employeeNo: user?.employeeNo || "-",
      endTimeText: "-",
      grossWorkMinutes: 0,
      jobTitle: user?.jobTitle || "사원",
      lateMinutes: 0,
      leave,
      leaveTypeName: leave?.leaveTypeName || "휴가",
      overtimeMinutes: 0,
      plannedTimeText: "-",
      primaryUnitName: user?.primaryUnitName || "-",
      recognizedWorkMinutes: 0,
      session: null,
      siteName: leave?.leaveTypeName || "휴가",
      startTimeText: "-",
      statusLabel: "휴가",
      statusTone: "blue",
      userId: String(leave?.userId || user?.id || ""),
      userName: user?.name || leave?.userName || "-",
      workDate,
    };
  }

  function buildAttendanceRecordsModel(state = {}, stats = {}) {
    const viewMode = normalizeAttendanceViewMode(state.attendanceViewMode);
    const range = getAttendanceRequestRange(viewMode, state.attendanceDateCursor);
    const visibleDates = iterateScheduleDates(range.dateFrom, range.dateTo);
    const users = stats.activeUsers
      .slice()
      .sort((left, right) => {
        const nameDiff = String(left?.name || "").localeCompare(String(right?.name || ""), "ko");
        return nameDiff || getScheduleUserUnitName(left).localeCompare(getScheduleUserUnitName(right), "ko");
      });
    const userMap = new Map(users.map((user) => [String(user?.id || ""), user]));
    const sessions = getAttendanceSessionsForView(state, stats);
    const leaveRequests = getAttendanceLeaveRequestsForView(state, stats);
    const recordsByUserDate = new Map(sessions.map((session) => {
      const record = buildAttendanceRecord(session, userMap.get(String(session?.userId || "")) || null);
      return [`${record.userId}:${record.workDate}`, record];
    }));

    leaveRequests.forEach((leave) => {
      const userId = String(leave?.userId || "");

      if (!userId) {
        return;
      }

      const startDate = normalizeAttendanceDateKey(leave?.startDate || "");
      const endDate = normalizeAttendanceDateKey(leave?.endDate || startDate);

      visibleDates.forEach((date) => {
        const dateKey = formatScheduleDateKey(date);

        if (dateKey < startDate || dateKey > endDate) {
          return;
        }

        recordsByUserDate.set(`${userId}:${dateKey}`, buildAttendanceLeaveRecord(leave, userMap.get(userId) || null, dateKey));
      });
    });

    const records = Array.from(recordsByUserDate.values());
    const totalGrossMinutes = records.reduce((total, record) => total + Number(record.grossWorkMinutes || 0), 0);
    const lateCount = records.filter((record) => record.lateMinutes > 0 || record.statusLabel === "지각").length;
    const earlyLeaveCount = records.filter((record) => record.earlyLeaveMinutes > 0 || record.statusLabel === "조퇴").length;
    const anomalyCount = records.reduce((total, record) => total + Number(record.anomalyCount || 0), 0);

    return {
      anomalyCount,
      earlyLeaveCount,
      lateCount,
      range,
      records: records.slice().sort((left, right) => String(left.userName).localeCompare(String(right.userName), "ko") || String(right.workDate).localeCompare(String(left.workDate))),
      recordsByUserDate,
      totalGrossMinutes,
      users,
      viewMode,
      visibleDates,
    };
  }

  function renderAttendanceToolbar(state = {}, model = {}) {
    const rangeLabel = formatAttendanceRangeLabel(model.viewMode, state.attendanceDateCursor);

    return `
      <div class="workmate-schedule-toolbar workmate-attendance-toolbar">
        <div class="workmate-schedule-toolbar-row primary">
          <div class="workmate-schedule-nav">
            <button class="secondary-button workmate-schedule-nav-button" data-attendance-nav="prev" type="button" aria-label="이전">‹</button>
            <button class="secondary-button workmate-schedule-nav-button" data-attendance-nav="today" type="button">오늘</button>
            <button class="secondary-button workmate-schedule-nav-button" data-attendance-nav="next" type="button" aria-label="다음">›</button>
            <strong>${escapeHtml(rangeLabel)}</strong>
          </div>
          <div class="workmate-attendance-filter-group">
            <div class="workmate-schedule-view-switch" role="tablist" aria-label="출퇴근기록 보기">
              ${ATTENDANCE_VIEW_MODES.map((mode) => `
                <button
                  class="secondary-button workmate-schedule-view-button${model.viewMode === mode ? " is-active" : ""}"
                  data-attendance-mode="${escapeAttribute(mode)}"
                  type="button"
                >
                  ${mode === "month" ? `
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4.5" y="5.5" width="15" height="14" rx="2"></rect>
                      <path d="M8 3.5v4"></path>
                      <path d="M16 3.5v4"></path>
                      <path d="M4.5 9.5h15"></path>
                      <path d="M8 13h3"></path>
                      <path d="M13 13h3"></path>
                      <path d="M8 16h3"></path>
                    </svg>
                  ` : `
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6.5h12"></path>
                      <path d="M6 11.5h12"></path>
                      <path d="M6 16.5h12"></path>
                      <path d="M4 6.5h.01"></path>
                      <path d="M4 11.5h.01"></path>
                      <path d="M4 16.5h.01"></path>
                    </svg>
                  `}
                  <span>${escapeHtml(mode === "month" ? "달력형" : "목록형")}</span>
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

  function renderAttendanceMonthCell(record = null) {
    if (!record) {
      return '<div class="workmate-attendance-month-cell is-empty"></div>';
    }

    const isAbsent = record.statusLabel === "결근";
    const isLeave = record.statusLabel === "휴가";

    return `
      <div class="workmate-attendance-month-cell has-record tone-${escapeAttribute(record.statusTone || "blue")}">
        ${isLeave ? `
          <strong class="workmate-attendance-leave">휴가</strong>
          <small>${escapeHtml(record.leaveTypeName || "휴가")}</small>
        ` : isAbsent ? `
          <strong class="workmate-attendance-absent">결근</strong>
        ` : `
          <div class="workmate-attendance-time-pair">
            <span class="${record.lateMinutes > 0 ? "is-alert" : ""}">${escapeHtml(record.startTimeText)}</span>
            <span class="${record.earlyLeaveMinutes > 0 ? "is-alert" : ""}">${escapeHtml(record.endTimeText)}</span>
          </div>
          <small>${escapeHtml(record.siteName || "-")}</small>
        `}
      </div>
    `;
  }

  function renderAttendanceMonthView(model = {}) {
    return `
      <section class="workmate-attendance-board month-view">
        <div class="workmate-attendance-month-scroll">
          <div class="workmate-attendance-month-board" style="--attendance-days: ${escapeAttribute(String(model.visibleDates.length || 1))};">
            <div class="workmate-attendance-month-head sticky-user">직원</div>
            ${model.visibleDates.map((date) => {
              const day = date.getDay();
              const isWeekend = day === 0 || day === 6;

              return `
                <div class="workmate-attendance-month-head${isWeekend ? " is-weekend" : ""}">
                  <strong>${escapeHtml(String(date.getDate()))}</strong>
                  <span>${escapeHtml(SCHEDULE_DAY_NAMES[day])}</span>
                </div>
              `;
            }).join("")}
            <div class="workmate-attendance-month-head total">합계</div>
            ${model.users.map((user) => {
              const userId = String(user?.id || "");
              const userRecords = model.visibleDates
                .map((date) => model.recordsByUserDate.get(`${userId}:${formatScheduleDateKey(date)}`) || null)
                .filter(Boolean);
              const totalMinutes = userRecords.reduce((total, record) => total + Number(record.grossWorkMinutes || 0), 0);

              return `
                <div class="workmate-attendance-user-cell">
                  <span>${escapeHtml(user?.employeeNo || "-")}</span>
                  <strong>${escapeHtml(user?.name || "-")}</strong>
                  <small>${escapeHtml(user?.primaryUnitName || "-")}</small>
                </div>
                ${model.visibleDates.map((date) => renderAttendanceMonthCell(model.recordsByUserDate.get(`${userId}:${formatScheduleDateKey(date)}`) || null)).join("")}
                <div class="workmate-attendance-total-cell">
                  <strong>${escapeHtml(formatNumber(userRecords.length))}</strong>
                  <span>${escapeHtml(formatAttendanceMinutes(totalMinutes))}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function getAttendanceGridColumns() {
    return [
      {
        align: "center",
        getFilterValue: (record) => record.employeeNo,
        getSortValue: (record) => record.employeeNo,
        key: "employeeNo",
        label: "사원번호",
        minWidth: "94px",
        width: "8%",
        render: (record) => escapeHtml(record.employeeNo || "-"),
      },
      {
        getFilterValue: (record) => record.userName,
        getSortValue: (record) => record.userName,
        key: "userName",
        label: "직원",
        minWidth: "104px",
        width: "10%",
        render: (record) => `<strong>${escapeHtml(record.userName || "-")}</strong>`,
      },
      {
        align: "center",
        getFilterValue: (record) => record.workDate,
        getSortValue: (record) => record.workDate,
        key: "workDate",
        label: "날짜",
        minWidth: "108px",
        width: "9%",
        render: (record) => escapeHtml(record.workDate || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.actualTimeText,
        getSortValue: (record) => record.startTimeText,
        key: "actualTimeText",
        label: "근무시간",
        minWidth: "128px",
        width: "12%",
        render: (record) => `<span class="${record.startTimeText === "-" ? "workmate-attendance-grid-alert" : ""}">${escapeHtml(record.actualTimeText || "-")}</span>`,
      },
      {
        align: "center",
        getFilterValue: (record) => record.plannedTimeText,
        getSortValue: (record) => record.plannedTimeText,
        key: "plannedTimeText",
        label: "근무일정",
        minWidth: "128px",
        width: "12%",
        render: (record) => escapeHtml(record.plannedTimeText || "-"),
      },
      {
        getFilterValue: (record) => record.primaryUnitName,
        getSortValue: (record) => record.primaryUnitName,
        key: "primaryUnitName",
        label: "조직",
        minWidth: "112px",
        width: "10%",
        render: (record) => escapeHtml(record.primaryUnitName || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => record.jobTitle,
        getSortValue: (record) => record.jobTitle,
        key: "jobTitle",
        label: "직무",
        minWidth: "84px",
        width: "7%",
        render: (record) => escapeHtml(record.jobTitle || "-"),
      },
      {
        getFilterValue: (record) => record.siteName,
        getSortValue: (record) => record.siteName,
        key: "siteName",
        label: "출근 장소",
        minWidth: "116px",
        width: "10%",
        render: (record) => escapeHtml(record.siteName || "-"),
      },
      {
        align: "center",
        getFilterValue: (record) => formatAttendanceMinutes(record.grossWorkMinutes),
        getSortValue: (record) => Number(record.grossWorkMinutes || 0),
        key: "grossWorkMinutes",
        label: "총 시간",
        minWidth: "96px",
        width: "8%",
        render: (record) => escapeHtml(formatAttendanceMinutes(record.grossWorkMinutes)),
      },
      {
        align: "center",
        getFilterValue: (record) => record.lateMinutes > 0 ? "있음" : "없음",
        getSortValue: (record) => Number(record.lateMinutes || 0),
        key: "lateMinutes",
        label: "지각",
        minWidth: "76px",
        width: "5%",
        render: (record) => `<span class="${record.lateMinutes > 0 ? "workmate-attendance-grid-alert" : ""}">${escapeHtml(record.lateMinutes > 0 ? `${formatNumber(record.lateMinutes)}분` : "-")}</span>`,
      },
      {
        align: "center",
        getFilterValue: (record) => record.earlyLeaveMinutes > 0 ? "있음" : "없음",
        getSortValue: (record) => Number(record.earlyLeaveMinutes || 0),
        key: "earlyLeaveMinutes",
        label: "조퇴",
        minWidth: "76px",
        width: "5%",
        render: (record) => `<span class="${record.earlyLeaveMinutes > 0 ? "workmate-attendance-grid-alert" : ""}">${escapeHtml(record.earlyLeaveMinutes > 0 ? `${formatNumber(record.earlyLeaveMinutes)}분` : "-")}</span>`,
      },
      {
        align: "center",
        getFilterValue: (record) => record.statusLabel,
        getSortValue: (record) => record.statusLabel,
        key: "statusLabel",
        label: "상태",
        minWidth: "88px",
        width: "7%",
        render: (record) => renderBadge(record.statusLabel || "-", record.statusTone || "gray"),
      },
    ];
  }

  function renderAttendanceListView(state = {}, model = {}) {
    const columns = getAttendanceGridColumns();

    return `
      <section class="workmate-attendance-board list-view workmate-attendance-grid-card">
        <div class="workmate-dashboard-table-shell">
          ${renderDashboardGridTable(
            "attendanceRecords",
            columns,
            model.records,
            state,
            "표시할 출퇴근기록이 없습니다.",
            "선택한 날짜에 생성된 출퇴근 세션이 없습니다."
          )}
        </div>
        ${renderDashboardFilterMenu(state, "attendanceRecords", columns, model.records)}
      </section>
    `;
  }

  function renderAttendanceView(state = {}) {
    const stats = buildStats(state);
    const model = buildAttendanceRecordsModel(state, stats);

    if (state.attendanceRecordsLoading) {
      return `
        <section class="view-stack">
          <article class="panel-card workmate-attendance-shell">
            ${renderAttendanceToolbar(state, model)}
            ${renderEmptyState("출퇴근기록을 불러오는 중입니다.", "잠시만 기다려 주세요.")}
          </article>
        </section>
      `;
    }

    return `
      <section class="view-stack">
        <article class="panel-card workmate-attendance-shell">
          ${renderAttendanceToolbar(state, model)}
          ${model.viewMode === "list" ? renderAttendanceListView(state, model) : renderAttendanceMonthView(model)}
        </article>
      </section>
    `;
  }

    return Object.freeze({
      renderAttendanceView,
    });
  }

  return Object.freeze({
    create: createAttendanceRenderer,
  });
});
