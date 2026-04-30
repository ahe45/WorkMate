(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeavePoliciesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const leaveAccrualRuleRendererModule = globalThis.WorkMateManagementLeaveAccrualRuleRenderer
    || (typeof require === "function" ? require("./leave-accrual-rule-renderer.js") : null);

  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatNumber,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderMetricCard,
      toArray,
    } = deps;

    const MANAGEMENT_LEAVE_ACCRUAL_ENTRY_GRID_TABLE_ID = "managementLeaveAccrualEntries";

    if (!leaveAccrualRuleRendererModule || typeof leaveAccrualRuleRendererModule.create !== "function") {
      throw new Error("client/renderers/management/leave-accrual-rule-renderer.js must be loaded before client/renderers/management/leave-policies.js.");
    }

    function formatLeaveAmount(value = 0) {
      const numberValue = Number(value || 0);
      const formatter = new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(numberValue) ? 0 : 1,
      });

      return `${formatter.format(numberValue)}일`;
    }

    function formatDateValue(value = "") {
      return value ? formatDate(value) : "-";
    }

    function formatMonthDayValue(value = "") {
      const rawValue = String(value || "").trim();
      const match = rawValue.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);

      return match ? `${match[1]}-${match[2]}` : "-";
    }

    const leavePolicyGroupsRendererModule = globalThis.WorkMateManagementLeavePolicyGroupsRenderer
      || (typeof require === "function" ? require("./leave-policy-groups.js") : null);

    if (!leavePolicyGroupsRendererModule || typeof leavePolicyGroupsRendererModule.create !== "function") {
      throw new Error("client/renderers/management/leave-policy-groups.js must be loaded before client/renderers/management/leave-policies.js.");
    }

    const {
      getActiveLeaveGroups,
      getLeaveGroupParentId,
      renderLeaveGroupModal,
      renderLeaveGroupOptions,
      renderLeaveGroupPathOptions,
      renderLeaveGroupRecords,
    } = leavePolicyGroupsRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatLeaveAmount,
      formatNumber,
      toArray,
    });

    function getGrantableUsers(state = {}) {
      const allowedStatuses = new Set(["ACTIVE", "PENDING", "INVITED"]);

      return toArray(state.bootstrap?.users)
        .filter((user) => allowedStatuses.has(String(user?.employmentStatus || user?.managementStatus || "").toUpperCase()))
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));
    }

    function getLeaveAccrualRules(state = {}) {
      return toArray(state.bootstrap?.leaveAccrualRules);
    }

    function getLeaveAccrualEntries(state = {}) {
      return toArray(state.bootstrap?.leaveAccrualEntries);
    }

    function getLeaveEntrySourceLabel(entry = {}) {
      return String(entry?.sourceType || "").toUpperCase() === "RULE"
        ? "자동발생"
        : "수동부여";
    }

    function getMonthlyAccrualMethod(rule = {}) {
      const method = String(rule?.monthlyAccrualMethod || "").toUpperCase();

      return ["FIXED", "CONTRACTUAL_HOURS", "ATTENDANCE_RATE"].includes(method) ? method : "FIXED";
    }

    function getAttendanceAccrualMethod(rule = {}) {
      const method = String(rule?.attendanceAccrualMethod || "").toUpperCase();

      return method === "FULL_MONTHS" ? "FULL_MONTHS" : "PROPORTIONAL";
    }

    const leaveRuleModelsModule = globalThis.WorkMateManagementLeaveRuleModels
      || (typeof require === "function" ? require("./leave-rule-models.js") : null);

    if (!leaveRuleModelsModule || typeof leaveRuleModelsModule.create !== "function") {
      throw new Error("client/renderers/management/leave-rule-models.js must be loaded before client/renderers/management/leave-policies.js.");
    }

    const {
      buildLeaveRuleRecordModels,
      formatLeaveRuleSegmentLine,
      formatRuleBasis,
      formatRuleSummary,
      sortLeaveRuleSegments,
    } = leaveRuleModelsModule.create({
      formatDateValue,
      formatLeaveAmount,
      formatMonthDayValue,
      formatNumber,
      getMonthlyAccrualMethod,
      toArray,
    });

    const {
      renderLeaveRuleModal,
      renderLeaveRuleRecords,
      renderManualGrantModal,
    } = leaveAccrualRuleRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatLeaveAmount,
      formatLeaveRuleSegmentLine,
      formatMonthDayValue,
      formatNumber,
      formatRuleBasis,
      formatRuleSummary,
      getAttendanceAccrualMethod,
      getMonthlyAccrualMethod,
      renderBadge,
      renderLeaveGroupOptions,
      renderLeaveGroupPathOptions,
      sortLeaveRuleSegments,
      toArray,
    });

    function getLeaveAccrualEntryColumns() {
      return [
        {
          getFilterValue: (record) => getLeaveEntrySourceLabel(record),
          getSortValue: (record) => getLeaveEntrySourceLabel(record),
          key: "sourceTypeLabel",
          label: "유형",
          minWidth: "96px",
          width: "9%",
          render: (record) => renderBadge(getLeaveEntrySourceLabel(record), String(record?.sourceType || "").toUpperCase() === "RULE" ? "green" : "blue"),
        },
        {
          getFilterValue: (record) => record.userName,
          getSortValue: (record) => record.userName,
          key: "userName",
          label: "직원",
          minWidth: "112px",
          width: "12%",
          render: (record) => `<strong>${escapeHtml(record?.userName || "-")}</strong>`,
        },
        {
          align: "center",
          getFilterValue: (record) => record.employeeNo,
          getSortValue: (record) => record.employeeNo,
          key: "employeeNo",
          label: "사번",
          minWidth: "96px",
          width: "9%",
          render: (record) => escapeHtml(record?.employeeNo || "-"),
        },
        {
          getFilterValue: (record) => record.leaveGroupName || record.leaveTypeName,
          getSortValue: (record) => record.leaveGroupName || record.leaveTypeName,
          key: "leaveGroupName",
          label: "휴가정책",
          minWidth: "126px",
          width: "13%",
          render: (record) => escapeHtml(record?.leaveGroupName || record?.leaveTypeName || "-"),
        },
        {
          align: "center",
          getFilterValue: (record) => formatDateValue(record?.accrualDate),
          getSortValue: (record) => record?.accrualDate,
          key: "accrualDate",
          label: "발생일",
          minWidth: "104px",
          width: "10%",
          render: (record) => escapeHtml(formatDateValue(record?.accrualDate)),
        },
        {
          align: "center",
          getFilterValue: (record) => formatDateValue(record?.expiresAt),
          getSortValue: (record) => record?.expiresAt || "",
          key: "expiresAt",
          label: "만료일",
          minWidth: "104px",
          width: "10%",
          render: (record) => escapeHtml(formatDateValue(record?.expiresAt)),
        },
        {
          align: "center",
          filterable: false,
          getSortValue: (record) => Number(record?.amountDays || 0),
          key: "amountDays",
          label: "일수",
          minWidth: "78px",
          width: "7%",
          render: (record) => `<strong>${escapeHtml(formatLeaveAmount(record?.amountDays || 0))}</strong>`,
        },
        {
          getFilterValue: (record) => record.ruleName || record.memo || "-",
          getSortValue: (record) => record.ruleName || record.memo || "",
          key: "sourceDetail",
          label: "근거",
          minWidth: "148px",
          width: "15%",
          render: (record) => escapeHtml(record?.ruleName || record?.memo || "-"),
        },
      ];
    }

    function renderManagementLeavePoliciesView(state = {}) {
      const groups = getActiveLeaveGroups(state);
      const rootPolicyCount = groups.filter((group) => !getLeaveGroupParentId(group)).length;
      const childPolicyCount = Math.max(0, groups.length - rootPolicyCount);
      const maxDepth = (() => {
        const groupById = new Map(groups.map((group) => [String(group?.id || "").trim(), group]));

        return groups.reduce((maxValue, group) => {
          let depth = 1;
          let cursor = group;
          let guard = 0;

          while (getLeaveGroupParentId(cursor) && guard < 20) {
            cursor = groupById.get(getLeaveGroupParentId(cursor)) || null;
            depth += cursor ? 1 : 0;
            guard += 1;
          }

          return Math.max(maxValue, depth);
        }, groups.length > 0 ? 1 : 0);
      })();

      return `
        <section class="workmate-admin-content-stack">
          <article class="panel-card workmate-title-record-panel workmate-leave-policy-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>휴가정책 관리</h4>
                <p>휴가정책을 트리 구조로 구성하고 정책별 하위 정책을 관리합니다.</p>
              </div>
            </div>

            <section class="metric-grid workmate-leave-policy-metric-grid">
              ${renderMetricCard("전체 정책", `${formatNumber(groups.length)}개`, "등록 정책", "tone-blue")}
              ${renderMetricCard("최상위 정책", `${formatNumber(rootPolicyCount)}개`, "루트 정책", "tone-green")}
              ${renderMetricCard("하위 정책", `${formatNumber(childPolicyCount)}개`, "계층 정책", "tone-orange")}
              ${renderMetricCard("최대 깊이", `${formatNumber(maxDepth)}단계`, "트리 기준", "tone-purple")}
            </section>

            <article class="panel-card workmate-dashboard-table-panel workmate-leave-policy-record-card">
              ${renderLeaveGroupRecords(groups)}
            </article>
          </article>
          ${renderLeaveGroupModal(state, groups)}
        </section>
      `;
    }

    function renderManagementLeaveAccrualRulesView(state = {}) {
      const groups = getActiveLeaveGroups(state);
      const users = getGrantableUsers(state);
      const rules = getLeaveAccrualRules(state);
      const ruleRecords = buildLeaveRuleRecordModels(rules);
      const entries = getLeaveAccrualEntries(state);
      const activeRuleCount = ruleRecords.filter((rule) => String(rule?.status || "").toUpperCase() === "ACTIVE").length;
      const manualGrantCount = entries.filter((entry) => String(entry?.sourceType || "").toUpperCase() !== "RULE").length;
      const canCreateRule = groups.length > 0;
      const canManualGrant = groups.length > 0 && users.length > 0;

      return `
        <section class="workmate-admin-content-stack">
          <article class="panel-card workmate-title-record-panel workmate-leave-policy-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>휴가 생성 관리</h4>
                <p>휴가 발생 규칙을 추가하고 필요 시 직원별 수동 부여를 처리합니다.</p>
              </div>
              <div class="workmate-employee-panel-actions">
                <button class="primary-button" data-management-leave-rule-open="true" type="button"${canCreateRule ? "" : " disabled"}>휴가 발생 규칙 추가</button>
                <button class="outline-button" data-management-leave-manual-open="true" type="button"${canManualGrant ? "" : " disabled"}>수동 부여</button>
              </div>
            </div>

            <section class="metric-grid workmate-leave-policy-metric-grid">
              ${renderMetricCard("휴가 발생 규칙", `${formatNumber(ruleRecords.length)}개`, "전체 규칙", "tone-blue")}
              ${renderMetricCard("활성 규칙", `${formatNumber(activeRuleCount)}개`, "활성 상태", "tone-green")}
              ${renderMetricCard("수동 부여", `${formatNumber(manualGrantCount)}건`, "최근 원장 기준", "tone-orange")}
              ${renderMetricCard("대상 직원", `${formatNumber(users.length)}명`, "부여 가능", "tone-purple")}
            </section>

            <article class="panel-card workmate-dashboard-table-panel workmate-leave-policy-record-card">
              ${renderLeaveRuleRecords(ruleRecords, canCreateRule)}
            </article>
          </article>
          ${renderLeaveRuleModal(state, groups, ruleRecords)}
          ${renderManualGrantModal(state, groups, users)}
        </section>
      `;
    }

    function renderManagementLeaveAccrualEntriesView(state = {}) {
      const entries = getLeaveAccrualEntries(state);
      const columns = getLeaveAccrualEntryColumns();
      const manualCount = entries.filter((entry) => String(entry?.sourceType || "").toUpperCase() !== "RULE").length;
      const ruleCount = entries.length - manualCount;
      const totalAmount = entries.reduce((sum, entry) => sum + Number(entry?.amountDays || 0), 0);
      const userCount = new Set(entries.map((entry) => String(entry?.userId || "").trim()).filter(Boolean)).size;

      return `
        <section class="workmate-admin-content-stack">
          <article class="panel-card workmate-title-record-panel workmate-leave-policy-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>휴가 발생 내역</h4>
                <p>수동 부여와 자동 발생으로 생성된 휴가 원장을 직원 단위로 확인합니다.</p>
              </div>
            </div>

            <section class="metric-grid workmate-leave-policy-metric-grid">
              ${renderMetricCard("전체 발생", `${formatNumber(entries.length)}건`, "최근 원장", "tone-blue")}
              ${renderMetricCard("자동 발생", `${formatNumber(ruleCount)}건`, "규칙 기준", "tone-green")}
              ${renderMetricCard("수동 부여", `${formatNumber(manualCount)}건`, "관리자 등록", "tone-orange")}
              ${renderMetricCard("발생 일수", formatLeaveAmount(totalAmount), `${formatNumber(userCount)}명 대상`, "tone-purple")}
            </section>

            <article class="panel-card workmate-dashboard-table-panel result-grid-card workmate-management-employee-grid-card">
              <div class="workmate-dashboard-table-shell">
                ${renderDashboardGridTable(
                  MANAGEMENT_LEAVE_ACCRUAL_ENTRY_GRID_TABLE_ID,
                  columns,
                  entries,
                  state,
                  "표시할 휴가 발생 내역이 없습니다.",
                  "수동 부여 또는 자동 발생 처리 후 내역이 표시됩니다.",
                )}
              </div>
            </article>
          </article>

          ${renderDashboardFilterMenu(state, MANAGEMENT_LEAVE_ACCRUAL_ENTRY_GRID_TABLE_ID, columns, entries)}
        </section>
      `;
    }

    return Object.freeze({
      renderManagementLeaveAccrualEntriesView,
      renderManagementLeaveAccrualRulesView,
      renderManagementLeavePoliciesView,
    });
  }

  return Object.freeze({ create });
});
