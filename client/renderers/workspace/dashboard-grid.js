(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardGridRenderer = factory();
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
      getScheduleTypeMeta,
      renderBadge,
      renderMiniItem,
      renderMiniList,
    } = dependencies;

    if (typeof escapeHtml !== "function" || typeof escapeAttribute !== "function") {
      throw new Error("WorkMateDashboardGridRenderer requires HTML escaping helpers.");
    }

  function getDashboardWorkStatusMeta(session = null, leave = null) {
    if (leave) {
      return { filterKey: "leave", label: "미출근", tone: "gray" };
    }

    if (!session) {
      return { filterKey: "off_duty", label: "미출근", tone: "gray" };
    }

    const currentState = String(session?.currentState || "").trim().toUpperCase();
    const detailStatus = String(session?.summaryJson?.detailStatus || "").trim().toUpperCase();

    if (currentState === "OFF_DUTY") {
      return { filterKey: "off_duty", label: "미출근", tone: "gray" };
    }

    if (["OFFSITE", "WFH_WORKING"].includes(currentState)) {
      return { filterKey: "remote", label: "외근", tone: "orange" };
    }

    if (currentState === "CLOCKED_OUT") {
      if (detailStatus === "EARLY_LEAVE" || Number(session?.earlyLeaveMinutes || 0) > 0) {
        return { filterKey: "clocked_out", label: "조퇴", tone: "orange" };
      }

      return { filterKey: "clocked_out", label: "퇴근", tone: "gray" };
    }

    if (detailStatus === "RETURNED") {
      return { filterKey: "working", label: "복귀", tone: "green" };
    }

    if (detailStatus === "LATE" || Number(session?.lateMinutes || 0) > 0) {
      return { filterKey: "working", label: "지각", tone: "orange" };
    }

    return { filterKey: "working", label: "출근", tone: "green" };
  }

  function getDashboardScheduleMeta(shift = null, leave = null, session = null) {
    if (leave) {
      return { label: "휴가", tone: "blue" };
    }

    if (String(session?.currentState || "").trim().toUpperCase() === "OFF_DUTY") {
      return { label: "휴무", tone: "gray" };
    }

    if (!shift) {
      return { label: "-", tone: "gray" };
    }

    const scheduleMeta = getScheduleTypeMeta(shift?.trackType, shift?.scheduleTemplateName);
    const normalizedLabel = String(scheduleMeta?.label || "").trim();

    if (normalizedLabel === "재택") {
      return { label: "외근", tone: "orange" };
    }

    if (normalizedLabel === "휴일") {
      return { label: "휴무", tone: "gray" };
    }

    if (["내근", "외근", "사업"].includes(normalizedLabel)) {
      return { label: normalizedLabel, tone: scheduleMeta.tone };
    }

    return { label: "-", tone: "gray" };
  }

  function renderDashboardDetailButton(userId = "") {
    return `
      <button
        class="table-inline-button primary workmate-dashboard-detail-button"
        data-dashboard-detail-open="${escapeAttribute(userId)}"
        type="button"
        aria-label="근무 상세보기"
        title="상세보기"
      >
        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3.5 12s3.5-6 8.5-6 8.5 6 8.5 6-3.5 6-8.5 6-8.5-6-8.5-6Z"></path>
          <circle cx="12" cy="12" r="2.75"></circle>
        </svg>
      </button>
    `;
  }

  function normalizeDashboardStatusFilter(value = "") {
    const normalized = String(value || "").trim().toLowerCase();
    const allowed = new Set(["working", "remote", "clocked_out", "off_duty", "leave"]);
    return allowed.has(normalized) ? normalized : "";
  }

  function getDashboardStatusFilterLabel(filter = "") {
    const map = {
      clocked_out: "퇴근",
      leave: "휴가",
      off_duty: "휴무",
      remote: "외근/재택",
      working: "출근/근무중",
    };

    return map[normalizeDashboardStatusFilter(filter)] || "전체";
  }

  function matchesDashboardStatusFilter(record = {}, filter = "") {
    const normalizedFilter = normalizeDashboardStatusFilter(filter);

    if (!normalizedFilter) {
      return true;
    }

    return String(record?.workStatusFilterKey || "") === normalizedFilter;
  }

  function getDashboardTimeSortValue(value) {
    if (!value) {
      return Number.MAX_SAFE_INTEGER;
    }

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }

    const matched = String(value || "").match(/(\d{2}):(\d{2})/);

    if (!matched) {
      return Number.MAX_SAFE_INTEGER;
    }

    return (Number(matched[1]) * 60) + Number(matched[2]);
  }

  function renderDashboardSummaryModal(selectedFilter = "", summaryCards = [], records = []) {
    const normalizedFilter = normalizeDashboardStatusFilter(selectedFilter);

    if (!normalizedFilter) {
      return "";
    }

    const summaryCard = summaryCards.find((card) => card.filter === normalizedFilter) || null;
    const filteredRecords = records.filter((record) => matchesDashboardStatusFilter(record, normalizedFilter));

    return `
      <div class="modal" id="dashboard-summary-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="dashboard-summary-title">
        <div class="modal-backdrop" data-dashboard-summary-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-dashboard-summary-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Worker list</p>
              <h3 id="dashboard-summary-title">${escapeHtml(summaryCard?.label || getDashboardStatusFilterLabel(normalizedFilter))}</h3>
            </div>
            <button class="icon-button" data-dashboard-summary-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-dashboard-summary-modal-body">
            <div class="workmate-inline-badges">
              ${renderBadge(`${formatNumber(filteredRecords.length)}명`, summaryCard?.tone || "blue")}
              ${renderBadge("오늘 기준", "gray")}
            </div>
            <div class="workmate-dashboard-summary-list">
              ${renderMiniList(
                filteredRecords.map((record) => renderMiniItem(
                  record.userName,
                  `${record.primaryUnitName} · ${record.jobTitle} · ${record.siteName}${record.startTimeText !== "-" ? ` · 출근 ${record.startTimeText}` : ""}`,
                  `${renderBadge(record.workStatusLabel, record.workStatusTone)}${renderBadge(record.scheduleLabel, record.scheduleTone)}`
                )),
                "표시할 근무자가 없습니다.",
                "선택한 상태에 해당하는 근무자가 없습니다."
              )}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderDashboardDetailField(label = "", value = "-") {
    return `
      <div class="workmate-dashboard-detail-field">
        <span>${escapeHtml(label || "-")}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    `;
  }

  function renderDashboardDetailModal(selectedUserId = "", records = []) {
    const normalizedUserId = String(selectedUserId || "").trim();

    if (!normalizedUserId) {
      return "";
    }

    const record = records.find((item) => String(item?.userId || "") === normalizedUserId) || null;

    if (!record) {
      return "";
    }

    return `
      <div class="modal" id="dashboard-detail-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="dashboard-detail-title">
        <div class="modal-backdrop" data-dashboard-detail-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-dashboard-detail-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Worker detail</p>
              <h3 id="dashboard-detail-title">${escapeHtml(record.userName || "-")} 근무 상세</h3>
            </div>
            <button class="icon-button" data-dashboard-detail-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-dashboard-detail-modal-body">
            <div class="workmate-dashboard-detail-summary">
              <div class="workmate-dashboard-detail-identity">
                <strong>${escapeHtml(record.userName || "-")}</strong>
                <p>${escapeHtml(`${record.primaryUnitName} · ${record.jobTitle}`)}</p>
              </div>
              <div class="workmate-inline-badges">
                ${renderBadge(record.workStatusLabel, record.workStatusTone)}
                ${renderBadge(record.scheduleLabel, record.scheduleTone)}
                ${renderBadge(record.siteName || "-", "gray")}
              </div>
            </div>
            <div class="workmate-dashboard-detail-grid workmate-info-grid">
              ${renderDashboardDetailField("사번", record.employeeNo)}
              ${renderDashboardDetailField("로그인 ID", record.userLoginEmail)}
              ${renderDashboardDetailField("연락처", record.phone)}
              ${renderDashboardDetailField("조직", record.primaryUnitName)}
              ${renderDashboardDetailField("직급", record.jobTitle)}
              ${renderDashboardDetailField("사업장", record.siteName)}
              ${renderDashboardDetailField("예정 시간", record.plannedTimeText)}
              ${renderDashboardDetailField("출근시간", record.startTimeText)}
              ${renderDashboardDetailField("퇴근시간", record.endTimeText)}
              ${renderDashboardDetailField("지각", record.lateMinutes > 0 ? `${formatNumber(record.lateMinutes)}분` : "-")}
              ${renderDashboardDetailField("조퇴", record.earlyLeaveMinutes > 0 ? `${formatNumber(record.earlyLeaveMinutes)}분` : "-")}
              ${renderDashboardDetailField("복귀시각", record.returnedAtText)}
              ${renderDashboardDetailField("근무분", record.grossWorkMinutes > 0 ? `${formatNumber(record.grossWorkMinutes)}분` : "-")}
              ${renderDashboardDetailField("인정근무분", record.recognizedWorkMinutes > 0 ? `${formatNumber(record.recognizedWorkMinutes)}분` : "-")}
              ${renderDashboardDetailField("초과근무분", record.overtimeMinutes > 0 ? `${formatNumber(record.overtimeMinutes)}분` : "-")}
              ${renderDashboardDetailField("이상 건수", record.anomalyCount > 0 ? `${formatNumber(record.anomalyCount)}건` : "0건")}
              ${renderDashboardDetailField("휴가 유형", record.leaveTypeName)}
              ${renderDashboardDetailField("휴가 기간", record.leaveDateRangeText)}
              ${renderDashboardDetailField("휴가 사유", record.leaveReason)}
              ${renderDashboardDetailField("휴가 승인", record.leaveApprovalStatusLabel)}
            </div>
          </div>
        </section>
      </div>
    `;
  }

    return Object.freeze({
      getDashboardWorkStatusMeta,
      getDashboardScheduleMeta,
      renderDashboardDetailButton,
      normalizeDashboardStatusFilter,
      getDashboardStatusFilterLabel,
      matchesDashboardStatusFilter,
      getDashboardTimeSortValue,
      renderDashboardSummaryModal,
      renderDashboardDetailField,
      renderDashboardDetailModal,
    });
  }

  return Object.freeze({ create });
});
