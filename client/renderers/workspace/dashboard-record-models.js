(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateDashboardRecordModels = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
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

    if (typeof escapeHtml !== "function" || typeof formatNumber !== "function") {
      throw new Error("WorkMateDashboardRecordModels requires dashboard record dependencies.");
    }

    function buildDashboardRecords(stats = {}) {
      const sessionByUserId = new Map(stats.sessions.map((session) => [String(session?.userId || ""), session]));
      const shiftByUserId = new Map(stats.shiftInstances.map((shift) => [String(shift?.userId || ""), shift]));
      const leaveByUserId = new Map(stats.leaveRequests.map((leave) => [String(leave?.userId || ""), leave]));
      const sortedUsers = stats.activeUsers
        .slice()
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));

      const combinedRecords = sortedUsers.map((user) => {
        const userId = String(user?.id || "");
        const leave = leaveByUserId.get(userId);
        const session = sessionByUserId.get(userId);
        const shift = shiftByUserId.get(userId);
        const workStatusMeta = getDashboardWorkStatusMeta(session, leave);
        const scheduleMeta = getDashboardScheduleMeta(shift, leave, session);
        const leaveStatusMeta = leave ? getApprovalStatusMeta(leave?.approvalStatus) : { label: "없음", tone: "gray" };
        const plannedTimeText = shift ? formatTimeRange(shift?.plannedStartAt, shift?.plannedEndAt) : "-";
        const startTimeText = session?.actualFirstWorkStartAt ? formatTime(session.actualFirstWorkStartAt) : "-";
        const endTimeText = session?.actualLastWorkEndAt ? formatTime(session.actualLastWorkEndAt) : "-";
        const siteName = session?.siteName || shift?.siteName || user?.defaultSiteName || "-";
        const detailStatus = String(session?.summaryJson?.detailStatus || "").trim().toUpperCase();
        const note = leave
          ? `${leave?.leaveTypeName || "휴가"}${leave?.requestReason ? ` · ${leave.requestReason}` : ""}`
          : Number(session?.anomalyCount || 0) > 0
            ? `이상 ${formatNumber(session?.anomalyCount || 0)}건`
            : session
              ? "정상"
              : "세션 없음";

        return {
          anomalyCount: Number(session?.anomalyCount || 0),
          detailStatus,
          earlyLeaveMinutes: Number(session?.earlyLeaveMinutes || 0),
          employeeNo: user?.employeeNo || "-",
          employmentType: user?.employmentType || "-",
          endTimeSort: getDashboardTimeSortValue(session?.actualLastWorkEndAt || ""),
          endTimeText,
          grossWorkMinutes: Number(session?.grossWorkMinutes || 0),
          jobTitle: user?.jobTitle || "사원",
          lateMinutes: Number(session?.lateMinutes || 0),
          leaveApprovalStatusLabel: leaveStatusMeta.label,
          leaveApprovalStatusTone: leaveStatusMeta.tone,
          leaveDateRangeText: leave ? formatDateRange(leave?.startDate, leave?.endDate) : "-",
          leaveReason: leave?.requestReason || "-",
          leaveTypeName: leave?.leaveTypeName || "-",
          note: note || "-",
          overtimeMinutes: Number(session?.overtimeMinutes || 0),
          phone: user?.phone || "-",
          plannedTimeSort: getDashboardTimeSortValue(shift?.plannedStartAt || ""),
          plannedTimeText,
          primaryUnitName: user?.primaryUnitName || "-",
          recognizedWorkMinutes: Number(session?.recognizedWorkMinutes || 0),
          returnedAtText: session?.summaryJson?.returnedAt ? formatTime(session.summaryJson.returnedAt) : "-",
          scheduleLabel: scheduleMeta.label,
          scheduleTone: scheduleMeta.tone,
          siteName,
          startTimeSort: getDashboardTimeSortValue(session?.actualFirstWorkStartAt || ""),
          startTimeText,
          userId,
          userLoginEmail: user?.loginEmail || "-",
          userName: user?.name || "-",
          workStatusFilterKey: workStatusMeta.filterKey,
          workStatusLabel: workStatusMeta.label,
          workStatusTone: workStatusMeta.tone,
        };
      });

      const statusCards = [
        { filter: "working", label: "출근/근무중", tone: "green" },
        { filter: "clocked_out", label: "퇴근", tone: "gray" },
        { filter: "off_duty", label: "휴무", tone: "gray" },
        { filter: "leave", label: "휴가", tone: "blue" },
      ].map((card) => ({
        ...card,
        count: combinedRecords.filter((record) => record.workStatusFilterKey === card.filter).length,
      }));

      return {
        combinedRecords,
        statusCards,
        statusRecords: combinedRecords,
      };
    }

    function buildDashboardMonthlyWorkStats(stats = {}, state = {}) {
      const currentUserEmail = String(state.user?.loginEmail || "").trim().toLowerCase();
      const currentUserId = String(state.user?.id || "").trim();
      const matchedUser = stats.users.find((user) =>
        String(user?.id || "") === currentUserId
        || String(user?.loginEmail || "").trim().toLowerCase() === currentUserEmail
      ) || null;
      const monthlySessions = stats.dashboardMonthlySessions.length > 0 ? stats.dashboardMonthlySessions : stats.sessions;
      const personalSessions = matchedUser
        ? monthlySessions.filter((session) => String(session?.userId || "") === String(matchedUser.id || ""))
        : [];
      const targetSessions = matchedUser ? personalSessions : monthlySessions;
      const workDateKeys = new Set(targetSessions.map((session) => String(session?.workDateLocal || "").slice(0, 10)).filter(Boolean));
      const scheduledMinutes = targetSessions.reduce((total, session) => total + Number(session?.scheduledMinutes || 0), 0);
      const recognizedMinutes = targetSessions.reduce((total, session) => total + Number(session?.recognizedWorkMinutes || 0), 0);
      const grossMinutes = targetSessions.reduce((total, session) => total + Number(session?.grossWorkMinutes || 0), 0);
      const overtimeMinutes = targetSessions.reduce((total, session) => total + Number(session?.overtimeMinutes || 0), 0);
      const lateCount = targetSessions.filter((session) => Number(session?.lateMinutes || 0) > 0).length;
      const completionRate = scheduledMinutes > 0 ? Math.min(100, Math.round((recognizedMinutes / scheduledMinutes) * 100)) : 0;

      return {
        basisLabel: matchedUser ? `${matchedUser.name || "내"} 기준` : "워크스페이스 전체 기준",
        completionRate,
        grossMinutes,
        lateCount,
        overtimeMinutes,
        recognizedMinutes,
        scheduledMinutes,
        sessionCount: targetSessions.length,
        workDayCount: workDateKeys.size,
      };
    }

    function renderDashboardMonthlyWorkStats(stats = {}, state = {}) {
      const monthlyStats = buildDashboardMonthlyWorkStats(stats, state);

      return `
      <article class="panel-card workmate-dashboard-my-stats-card">
        <div class="workmate-dashboard-my-stats-head">
          <div>
            <p class="page-kicker">Monthly work</p>
            <h3>내 근로 통계</h3>
          </div>
          <span>${escapeHtml(`이번달 · ${monthlyStats.basisLabel}`)}</span>
        </div>
        <div class="workmate-dashboard-my-stats-grid">
          <div>
            <span>누적 근무</span>
            <strong>${escapeHtml(formatAttendanceMinutes(monthlyStats.recognizedMinutes || monthlyStats.grossMinutes))}</strong>
          </div>
          <div>
            <span>근무일</span>
            <strong>${escapeHtml(`${formatNumber(monthlyStats.workDayCount)}일`)}</strong>
          </div>
          <div>
            <span>초과근무</span>
            <strong>${escapeHtml(formatAttendanceMinutes(monthlyStats.overtimeMinutes))}</strong>
          </div>
          <div>
            <span>지각</span>
            <strong>${escapeHtml(`${formatNumber(monthlyStats.lateCount)}회`)}</strong>
          </div>
        </div>
        <div class="workmate-dashboard-my-stats-progress" aria-label="이번달 예정 대비 인정근무율">
          <div>
            <span>예정 대비 인정근무</span>
            <strong>${escapeHtml(`${formatNumber(monthlyStats.completionRate)}%`)}</strong>
          </div>
          <i style="width: ${monthlyStats.completionRate}%;"></i>
        </div>
      </article>
    `;
    }

    function formatLeaveDays(value = 0) {
      const numberValue = Number(value || 0);
      const formatter = new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 1,
        minimumFractionDigits: Number.isInteger(numberValue) ? 0 : 1,
      });

      return `${formatter.format(numberValue)}일`;
    }

    function getLeaveBalanceCategory(balance = {}) {
      const text = `${balance?.leaveTypeCode || ""} ${balance?.leaveTypeName || ""}`.toUpperCase();

      if (text.includes("ANNUAL") || text.includes("YEAR") || text.includes("연차")) {
        return "annual";
      }

      if (text.includes("COMP") || text.includes("REWARD") || text.includes("보상")) {
        return "compensatory";
      }

      return "other";
    }

    function createLeaveBalanceBucket() {
      return {
        annualHeld: 0,
        annualUsed: 0,
        balanceYear: 0,
        compensatoryHeld: 0,
        compensatoryUsed: 0,
        otherHeld: 0,
        otherUsed: 0,
      };
    }

    function buildLeaveBalanceRecords(stats = {}) {
      const balanceByUserId = new Map();

      stats.leaveBalances.forEach((balance) => {
        const userId = String(balance?.userId || "");

        if (!userId) {
          return;
        }

        const bucket = balanceByUserId.get(userId) || createLeaveBalanceBucket();
        const category = getLeaveBalanceCategory(balance);
        const heldAmount = Number(balance?.remainingAmount || 0);
        const usedAmount = Number(balance?.usedAmount || 0);

        if (category === "annual") {
          bucket.annualHeld += heldAmount;
          bucket.annualUsed += usedAmount;
        } else if (category === "compensatory") {
          bucket.compensatoryHeld += heldAmount;
          bucket.compensatoryUsed += usedAmount;
        } else {
          bucket.otherHeld += heldAmount;
          bucket.otherUsed += usedAmount;
        }

        bucket.balanceYear = Number(balance?.balanceYear || bucket.balanceYear || new Date().getFullYear());
        balanceByUserId.set(userId, bucket);
      });

      const records = stats.activeUsers
        .slice()
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"))
        .map((user) => {
          const userId = String(user?.id || "");
          const bucket = balanceByUserId.get(userId) || createLeaveBalanceBucket();
          const totalHeld = bucket.annualHeld + bucket.compensatoryHeld + bucket.otherHeld;
          const totalUsed = bucket.annualUsed + bucket.compensatoryUsed + bucket.otherUsed;
          const statusMeta = totalHeld <= 3
            ? { label: "확인 필요", tone: "orange" }
            : totalHeld <= 10
              ? { label: "보통", tone: "blue" }
              : { label: "여유", tone: "green" };

          return {
            ...bucket,
            balanceStatusLabel: statusMeta.label,
            balanceStatusTone: statusMeta.tone,
            balanceYear: bucket.balanceYear || new Date().getFullYear(),
            employeeNo: user?.employeeNo || "-",
            primaryUnitName: user?.primaryUnitName || "-",
            totalHeld,
            totalUsed,
            userId,
            userName: user?.name || "-",
          };
        });
      const totals = records.reduce((accumulator, record) => ({
        annualHeld: accumulator.annualHeld + record.annualHeld,
        annualUsed: accumulator.annualUsed + record.annualUsed,
        compensatoryHeld: accumulator.compensatoryHeld + record.compensatoryHeld,
        compensatoryUsed: accumulator.compensatoryUsed + record.compensatoryUsed,
        otherHeld: accumulator.otherHeld + record.otherHeld,
        otherUsed: accumulator.otherUsed + record.otherUsed,
        totalHeld: accumulator.totalHeld + record.totalHeld,
        totalUsed: accumulator.totalUsed + record.totalUsed,
      }), {
        annualHeld: 0,
        annualUsed: 0,
        compensatoryHeld: 0,
        compensatoryUsed: 0,
        otherHeld: 0,
        otherUsed: 0,
        totalHeld: 0,
        totalUsed: 0,
      });

      return { records, totals };
    }

    return Object.freeze({
      buildDashboardMonthlyWorkStats,
      buildDashboardRecords,
      buildLeaveBalanceRecords,
      createLeaveBalanceBucket,
      formatLeaveDays,
      getLeaveBalanceCategory,
      renderDashboardMonthlyWorkStats,
    });
  }

  return Object.freeze({ create });
});
