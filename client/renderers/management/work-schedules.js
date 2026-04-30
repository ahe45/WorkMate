(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkSchedulesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkSchedulesRenderer(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getDashboardGridState,
      getScheduleTypeMeta,
      hasDashboardGridFilter,
      renderManagementModalHeaderActions,
      renderBadge,
      renderDashboardFilterMenu,
      renderEmptyState,
      renderManagementOrderCell,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

    const normalizerModule = globalThis.WorkMateWorkPolicyNormalizer
      || (typeof require === "function" ? require("./work-policy-normalizer.js") : null);
    const metricsModule = globalThis.WorkMateWorkPolicyMetrics
      || (typeof require === "function" ? require("./work-policy-metrics.js") : null);
    const formRendererModule = globalThis.WorkMateWorkPolicyFormRenderer
      || (typeof require === "function" ? require("./work-policy-form.js") : null);
    const scheduleListRendererModule = globalThis.WorkMateWorkScheduleListRenderer
      || (typeof require === "function" ? require("./work-schedule-list.js") : null);

    if (!normalizerModule || typeof normalizerModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-normalizer.js must be loaded before client/renderers/management/work-schedules.js.");
    }

    if (!metricsModule || typeof metricsModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-metrics.js must be loaded before client/renderers/management/work-schedules.js.");
    }

    if (!formRendererModule || typeof formRendererModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-form.js must be loaded before client/renderers/management/work-schedules.js.");
    }

    if (!scheduleListRendererModule || typeof scheduleListRendererModule.create !== "function") {
      throw new Error("client/renderers/management/work-schedule-list.js must be loaded before client/renderers/management/work-schedules.js.");
    }

    const MANAGEMENT_WORK_POLICY_GRID_TABLE_ID = "management-work-policies";

    const normalizer = normalizerModule.create({
      toArray,
    });
    const metrics = metricsModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
      normalizeManagementPolicyBoolean: normalizer.normalizeManagementPolicyBoolean,
      normalizeManagementPolicyDayOfWeek: normalizer.normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyDayOfMonth: normalizer.normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyHolidayDateRules: normalizer.normalizeManagementPolicyHolidayDateRules,
      normalizeManagementPolicyMaximumRule: normalizer.normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicySettlementRule: normalizer.normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule: normalizer.normalizeManagementPolicyStandardRule,
      normalizeManagementPolicyWorkingDays: normalizer.normalizeManagementPolicyWorkingDays,
      toArray,
    });
    const scheduleListRenderer = scheduleListRendererModule.create({
      escapeHtml,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getManagementWorkPolicyInformation: normalizer.getManagementWorkPolicyInformation,
      getScheduleTypeMeta,
      renderBadge,
      toArray,
    });
    const formRenderer = formRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatManagementPolicyDuration: metrics.formatManagementPolicyDuration,
      formatManagementWorkScheduleDayLabel: scheduleListRenderer.formatManagementWorkScheduleDayLabel,
      getManagementWorkPolicyInformation: normalizer.getManagementWorkPolicyInformation,
      getManagementWorkScheduleDayName: scheduleListRenderer.getManagementWorkScheduleDayName,
      normalizeManagementPolicyContractualRule: normalizer.normalizeManagementPolicyContractualRule,
      normalizeManagementPolicyDayRules: normalizer.normalizeManagementPolicyDayRules,
      normalizeManagementPolicyMaximumRule: normalizer.normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyBoolean: normalizer.normalizeManagementPolicyBoolean,
      normalizeManagementPolicyMaximumWorkRule: normalizer.normalizeManagementPolicyMaximumWorkRule,
      normalizeManagementPolicySettlementRule: normalizer.normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule: normalizer.normalizeManagementPolicyStandardRule,
      normalizeManagementPolicyStringList: normalizer.normalizeManagementPolicyStringList,
      normalizeManagementPolicyTargetRule: normalizer.normalizeManagementPolicyTargetRule,
      normalizeManagementPolicyWorkingDays: normalizer.normalizeManagementPolicyWorkingDays,
      renderEmptyState,
      toArray,
    });

    function getManagementWorkPolicies(stats = {}) {
      const policies = toArray(stats.workPolicies);

      if (policies.length > 0) {
        return policies;
      }

      return stats.workPolicy ? [stats.workPolicy] : [];
    }

    function sortManagementWorkPolicies(policies = []) {
      return toArray(policies)
        .slice()
        .sort((left, right) => {
          if (Boolean(left?.isDefault) !== Boolean(right?.isDefault)) {
            return left?.isDefault ? -1 : 1;
          }

          const leftUpdatedAt = new Date(left?.updatedAt || 0).getTime();
          const rightUpdatedAt = new Date(right?.updatedAt || 0).getTime();

          if (Number.isFinite(leftUpdatedAt) && Number.isFinite(rightUpdatedAt) && leftUpdatedAt !== rightUpdatedAt) {
            return rightUpdatedAt - leftUpdatedAt;
          }

          return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
            numeric: true,
            sensitivity: "base",
          });
        });
    }

    function getManagementWorkPolicyGridColumns() {
      return [
        { filterable: false, key: "sortOrder", label: "순서", sortable: false },
        {
          filterable: true,
          getFilterValue: (record) => String(record?.displayName || "").trim(),
          key: "name",
          label: "근로정책명",
          sortable: false,
        },
        { filterable: false, key: "employment", label: "적용대상", sortable: false },
        { filterable: false, key: "workDays", label: "근로일", sortable: false },
        { filterable: false, key: "unpaidOffDays", label: "무급 휴무일", sortable: false },
        { filterable: false, key: "paidHolidays", label: "유급 휴일", sortable: false },
        { filterable: false, key: "contractualRule", label: "소정근로규칙", sortable: false },
        { filterable: false, key: "maximumRule", label: "최대근로규칙", sortable: false },
        { filterable: false, key: "settings", label: "관리", sortable: false },
        { filterable: false, key: "delete", label: "삭제", sortable: false },
      ];
    }

    function normalizeManagementWorkPolicyUnit(value = "", fallback = "DAY") {
      const normalizedValue = String(value || "").trim().toUpperCase();
      return ["DAY", "WEEK", "MONTH"].includes(normalizedValue) ? normalizedValue : fallback;
    }

    function formatManagementWorkPolicyEmploymentSummary(info = {}) {
      const employmentTargetType = String(info.employmentTargetType || "").trim().toUpperCase();
      const isPartTime = employmentTargetType === "PART_TIME";

      return {
        detail: isPartTime ? `시급 ${formatNumber(info.hourlyWage || 0)}원` : "",
        label: isPartTime ? "아르바이트" : "임직원",
      };
    }

    function formatManagementWorkPolicyDayRuleRangeLabel(dayNumbers = []) {
      const dayDisplayOrder = [7, 1, 2, 3, 4, 5, 6];
      const normalizedDays = Array.from(new Set(toArray(dayNumbers)
        .map((dayOfWeek) => Number(dayOfWeek))
        .filter((dayOfWeek) => Number.isInteger(dayOfWeek) && dayDisplayOrder.includes(dayOfWeek))))
        .sort((left, right) => dayDisplayOrder.indexOf(left) - dayDisplayOrder.indexOf(right));

      if (normalizedDays.length === 0) {
        return "-";
      }

      if (normalizedDays.length === dayDisplayOrder.length) {
        return "매일";
      }

      const indices = normalizedDays.map((dayOfWeek) => dayDisplayOrder.indexOf(dayOfWeek));
      const ranges = [];
      let startIndex = indices[0];
      let previousIndex = indices[0];

      for (let index = 1; index < indices.length; index += 1) {
        const currentIndex = indices[index];

        if (currentIndex === previousIndex + 1) {
          previousIndex = currentIndex;
          continue;
        }

        ranges.push({ end: previousIndex, start: startIndex });
        startIndex = currentIndex;
        previousIndex = currentIndex;
      }

      ranges.push({ end: previousIndex, start: startIndex });

      if (ranges.length > 1 && ranges[0].start === 0 && ranges[ranges.length - 1].end === dayDisplayOrder.length - 1) {
        const firstRange = ranges.shift();
        const lastRange = ranges.pop();

        ranges.unshift({
          end: firstRange?.end ?? 0,
          start: lastRange?.start ?? 0,
        });
      }

      return ranges.map((range) => {
        const startDay = dayDisplayOrder[range.start];
        const endDay = dayDisplayOrder[range.end];
        const startLabel = scheduleListRenderer.getManagementWorkScheduleDayName(startDay);
        const endLabel = scheduleListRenderer.getManagementWorkScheduleDayName(endDay);

        return range.start === range.end
          ? startLabel
          : `${startLabel}-${endLabel}`;
      }).join(", ");
    }

    function formatManagementWorkPolicyDayRuleSummary(info = {}, type = "WORK") {
      const dayType = String(type || "").trim().toUpperCase();
      const matchingDayNumbers = toArray(info.dayRules)
        .filter((rule) => String(rule?.type || "").trim().toUpperCase() === dayType)
        .map((rule) => rule?.dayOfWeek);
      return formatManagementWorkPolicyDayRuleRangeLabel(matchingDayNumbers);
    }

    function formatManagementWorkPolicyRuleUnitLabel(unit = "WEEK") {
      const normalizedUnit = normalizeManagementWorkPolicyUnit(unit, "WEEK");
      return normalizedUnit === "MONTH"
        ? "월"
        : normalizedUnit === "DAY"
          ? "일"
          : "주";
    }

    function formatManagementWorkPolicyRuleSummary(unit = "WEEK", minutes = 0) {
      return `${formatManagementWorkPolicyRuleUnitLabel(unit)} ${metrics.formatManagementPolicyDuration(minutes)}`;
    }

    function formatManagementWorkPolicyContractualRuleSummary(info = {}) {
      const rule = info.contractualRule || {};

      return formatManagementWorkPolicyRuleSummary(rule.unit, rule.minutes);
    }

    function formatManagementWorkPolicyMaximumRuleSummary(info = {}) {
      const rule = info.contractualRule || {};

      return formatManagementWorkPolicyRuleSummary(rule.overtimeLimitUnit || rule.unit, rule.overtimeLimitMinutes);
    }

    function buildManagementWorkPolicyListModel(stats = {}) {
      const policies = sortManagementWorkPolicies(getManagementWorkPolicies(stats));

      const records = policies.map((policy, index) => {
        const info = normalizer.getManagementWorkPolicyInformation(policy || {});
        const employmentSummary = formatManagementWorkPolicyEmploymentSummary(info);
        const contractualRuleSummary = formatManagementWorkPolicyContractualRuleSummary(info);
        const maximumRuleSummary = formatManagementWorkPolicyMaximumRuleSummary(info);

        return {
          ...policy,
          contractualRuleSummary,
          displayName: info.policyName || policy?.name || "근로정책",
          employmentDetail: employmentSummary.detail,
          employmentLabel: employmentSummary.label,
          info,
          maximumRuleSummary,
          orderLabel: formatNumber(index + 1),
          paidHolidayLabel: formatManagementWorkPolicyDayRuleSummary(info, "PAID_HOLIDAY"),
          unpaidOffDayLabel: formatManagementWorkPolicyDayRuleSummary(info, "UNPAID_OFF"),
          workDayLabel: formatManagementWorkPolicyDayRuleSummary(info, "WORK"),
        };
      });

      return {
        records,
      };
    }

    function renderManagementWorkPolicyGridHead(isNameFilterActive = false) {
      return `
        <div class="workmate-work-policy-record-grid-head">
          <span class="workmate-worksite-grid-action-head">순서</span>
          <span class="workmate-work-policy-grid-head-cell${isNameFilterActive ? " is-filter-active" : ""}">
            <span class="table-header-shell has-filter">
              <span class="table-header-label workmate-work-policy-grid-head-label">근로정책명</span>
              <button
                class="table-filter-button"
                data-dashboard-grid-filter-open="true"
                data-dashboard-grid-table="${escapeAttribute(MANAGEMENT_WORK_POLICY_GRID_TABLE_ID)}"
                data-dashboard-grid-column="name"
                type="button"
                aria-label="정책명 필터 열기"
              >
                <span class="table-filter-glyph" aria-hidden="true"></span>
              </button>
            </span>
          </span>
          <span>적용대상</span>
          <span>근로일</span>
          <span>무급 휴무일</span>
          <span>유급 휴일</span>
          <span>소정근로규칙</span>
          <span>최대근로규칙</span>
          <span class="workmate-worksite-grid-action-head">관리</span>
          <span class="workmate-worksite-grid-action-head">삭제</span>
        </div>
      `;
    }

    function renderManagementWorkPolicyRecords(state = {}, stats = {}) {
      const model = buildManagementWorkPolicyListModel(stats);
      const gridColumns = getManagementWorkPolicyGridColumns();
      const gridState = getDashboardGridState(state, MANAGEMENT_WORK_POLICY_GRID_TABLE_ID);
      const { sortedRecords: filteredRecords } = resolveDashboardGridRecords(
        model.records,
        gridColumns,
        {
          ...gridState,
          sortRules: [],
        },
      );
      const isNameFilterActive = hasDashboardGridFilter(gridState, "name");
      const activePolicyId = state.managementWorkPolicyModalOpen
        ? String(state.managementWorkPolicyDraft?.policyId || "").trim()
        : "";

      if (model.records.length === 0) {
        return `
          <div class="workmate-work-policy-record-grid">
            ${renderManagementWorkPolicyGridHead(isNameFilterActive)}
            <button class="workmate-work-policy-record-grid-row workmate-worksite-empty-add-card" data-management-work-policy-open="" type="button">
              <span class="workmate-worksite-empty-add-label">+ 근로정책 추가</span>
            </button>
          </div>
        `;
      }

      if (filteredRecords.length === 0) {
        return `
          <div class="workmate-work-policy-record-grid">
            ${renderManagementWorkPolicyGridHead(isNameFilterActive)}
            <article class="workmate-grid-empty-row">
              <div class="workmate-worksite-grid-empty-copy">
                <strong>필터 결과가 없습니다.</strong>
                <p>${escapeHtml(isNameFilterActive ? "정책명 필터 조건과 일치하는 항목이 없습니다." : "표시할 근로정책이 없습니다.")}</p>
              </div>
            </article>
          </div>
        `;
      }

      return `
        <div class="workmate-work-policy-record-grid">
          ${renderManagementWorkPolicyGridHead(isNameFilterActive)}
          ${filteredRecords.map((record) => {
            const recordId = String(record?.id || "").trim();
            const isActive = activePolicyId && recordId === activePolicyId;

            return `
              <article class="workmate-work-policy-record-grid-row${isActive ? " is-active" : ""}">
                <div class="workmate-work-policy-record-grid-cell workmate-management-order-cell">
                  ${renderManagementOrderCell(record?.orderLabel || "-")}
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.displayName || "근로정책")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.employmentLabel || "-")}</strong>
                  ${record?.employmentDetail ? `<span>${escapeHtml(record.employmentDetail)}</span>` : ""}
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.workDayLabel || "-")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.unpaidOffDayLabel || "-")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.paidHolidayLabel || "-")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.contractualRuleSummary || "-")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.maximumRuleSummary || "-")}</strong>
                </div>
                <div class="workmate-work-policy-record-grid-cell workmate-worksite-grid-actions">
                  <button class="icon-button table-inline-icon-button workmate-worksite-record-action" data-management-work-policy-open="${escapeAttribute(recordId)}" type="button" aria-label="근로정책 관리">
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="2.6"></circle>
                      <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                    </svg>
                  </button>
                </div>
                <div class="workmate-work-policy-record-grid-cell workmate-worksite-grid-actions">
                  ${record?.isDefault
                    ? `<span class="workmate-work-policy-delete-lock">기본</span>`
                    : `
                      <button class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button" data-management-work-policy-delete="${escapeAttribute(recordId)}" type="button" aria-label="근로정책 삭제">
                        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4.5 7.5h15"></path>
                          <path d="M9.5 3.5h5"></path>
                          <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                          <path d="M10 10.5v5"></path>
                          <path d="M14 10.5v5"></path>
                        </svg>
                      </button>
                    `}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `;
    }

    function renderManagementWorkPolicyModal(state = {}, stats = {}) {
      if (!state.managementWorkPolicyModalOpen) {
        return "";
      }

      const draft = state.managementWorkPolicyDraft || {};
      const model = formRenderer.buildManagementWorkPolicyModel(state, stats, {
        mode: draft.mode,
        policyId: draft.policyId,
      });

      if (!model.hasPolicy) {
        return "";
      }

      const info = {
        ...(model.info || {}),
        holidayDateRules: normalizer.buildManagementWorkPolicyHolidayDateRules(stats.holidayData || {}),
      };
      return `
        <div class="modal" id="management-work-policy-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-work-policy-modal-title">
          <div class="modal-backdrop" data-management-work-policy-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-work-policy-modal-sheet">
            <header class="modal-header">
              <div>
                <h3 id="management-work-policy-modal-title">${escapeHtml(String(draft.mode || "").trim().toLowerCase() === "edit" ? "근로정책 수정" : "근로정책 추가")}</h3>
              </div>
              ${renderManagementModalHeaderActions(state, {
                closeAction: "data-management-work-policy-close",
                formId: "management-work-policy-form",
                modalType: "workPolicy",
              })}
            </header>
            <div class="modal-body workmate-work-policy-modal-body">
              <section class="panel-card workmate-work-policy-modal-panel">
                ${metrics.renderManagementWorkPolicyStageMetrics(info)}
                ${formRenderer.renderManagementWorkPolicyForm(model, stats)}
              </section>
            </div>
          </section>
        </div>
      `;
    }

    function renderManagementWorkSchedulesView(state = {}, stats = {}) {
      const gridColumns = getManagementWorkPolicyGridColumns();
      const records = buildManagementWorkPolicyListModel(stats).records;
      const hasRecords = records.length > 0;

      return `
        <section class="workmate-admin-content-stack">
          <article class="panel-card workmate-work-policy-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>근로정책 관리</h4>
                <p>적용대상, 요일별 근무 속성, 소정·최대근로 기준으로 근로정책을 관리합니다.</p>
              </div>
              ${hasRecords ? `
                <div class="workmate-topbar-actions workmate-worksite-panel-controls">
                  <button class="primary-button" data-management-work-policy-open="" type="button">근로정책 추가</button>
                </div>
              ` : `
                <div class="workmate-topbar-actions workmate-worksite-panel-controls is-placeholder" aria-hidden="true">
                  <span class="primary-button">근로정책 추가</span>
                </div>
              `}
            </div>
            ${renderManagementWorkPolicyRecords(state, stats)}
          </article>
          ${renderDashboardFilterMenu(state, MANAGEMENT_WORK_POLICY_GRID_TABLE_ID, gridColumns, records)}
          ${renderManagementWorkPolicyModal(state, stats)}
        </section>
      `;
    }

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules: normalizer.buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics: metrics.calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow: formRenderer.renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow: formRenderer.renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementWorkSchedulesView,
    });
  }

  return Object.freeze({
    create: createWorkSchedulesRenderer,
  });
});
