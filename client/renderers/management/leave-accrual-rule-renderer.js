(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeaveAccrualRuleRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const leaveRuleFormRendererModule = globalThis.WorkMateManagementLeaveRuleFormRenderer
    || (typeof require === "function" ? require("./leave-rule-form-renderer.js") : null);

  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatLeaveAmount,
      formatMonthDayValue,
      formatNumber,
      formatLeaveRuleSegmentLine,
      formatRuleBasis,
      formatRuleSummary,
      getAttendanceAccrualMethod,
      getMonthlyAccrualMethod,
      renderBadge,
      renderLeaveGroupOptions,
      renderLeaveGroupPathOptions,
      sortLeaveRuleSegments,
      toArray,
    } = deps;

    if (!leaveRuleFormRendererModule || typeof leaveRuleFormRendererModule.create !== "function") {
      throw new Error("client/renderers/management/leave-rule-form-renderer.js must be loaded before client/renderers/management/leave-accrual-rule-renderer.js.");
    }

    function formatLocalDateKey(date = new Date()) {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    }

    function renderUserOptions(users = []) {
      if (users.length === 0) {
        return '<option value="">부여 가능한 직원 없음</option>';
      }

      return users.map((user) => `
        <option value="${escapeAttribute(user?.id || "")}">${escapeHtml(`${user?.name || "-"} · ${user?.employeeNo || "-"}`)}</option>
      `).join("");
    }

    const {
      renderLeaveRuleForm,
    } = leaveRuleFormRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatMonthDayValue,
      getAttendanceAccrualMethod,
      getMonthlyAccrualMethod,
      renderLeaveGroupPathOptions,
      sortLeaveRuleSegments,
      toArray,
    });

    function renderLeaveRuleModal(state = {}, groups = [], ruleRecords = []) {
      if (!state.managementLeaveRuleModalOpen) {
        return "";
      }

      const editRuleIds = String(state.managementLeaveRuleEditIds || "")
        .split(",")
        .map((ruleId) => ruleId.trim())
        .filter(Boolean);
      const editRuleIdSet = new Set(editRuleIds);
      const targetRule = editRuleIds.length > 0
        ? toArray(ruleRecords).find((record) => toArray(record?.ruleIds).some((ruleId) => editRuleIdSet.has(String(ruleId || "").trim()))) || null
        : null;
      const isEditMode = Boolean(targetRule);

      return `
        <div class="modal workmate-leave-rule-modal" id="management-leave-rule-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-leave-rule-modal-title">
          <div class="modal-backdrop" data-management-leave-rule-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-leave-config-modal-sheet workmate-leave-rule-modal-sheet">
            <header class="modal-header">
              <div>
                <h3 id="management-leave-rule-modal-title">${escapeHtml(isEditMode ? "휴가 발생 규칙 관리" : "휴가 발생 규칙 등록")}</h3>
                <p>${escapeHtml(isEditMode ? "자동 발생 규칙의 기준과 구간을 수정합니다." : "입사 즉시, 월별 또는 연별 휴가 발생 기준을 생성합니다.")}</p>
              </div>
              <div class="workmate-management-modal-header-actions">
                <button class="outline-button" data-management-leave-rule-close="true" type="button">취소</button>
                <button class="primary-button" data-management-leave-rule-create="true" type="button">저장</button>
              </div>
            </header>
            <div class="modal-body workmate-leave-config-modal-body">
              ${renderLeaveRuleForm(groups, targetRule)}
            </div>
          </section>
        </div>
      `;
    }

    function renderLeaveRuleRecords(rules = [], canCreateRule = true) {
      if (rules.length === 0) {
        return `
          <div class="workmate-leave-rule-record-grid">
            <div class="workmate-leave-rule-record-grid-head">
              <span>순서</span>
              <span>규칙명</span>
              <span>휴가정책</span>
              <span>주기</span>
              <span>발생일수</span>
              <span>적용 기간</span>
              <span>상태</span>
              <span>관리</span>
              <span>삭제</span>
            </div>
            <button class="workmate-leave-rule-record-grid-row workmate-worksite-empty-add-card" data-management-leave-rule-open="true" type="button"${canCreateRule ? "" : " disabled"}>
              <span class="workmate-worksite-empty-add-label">${escapeHtml(canCreateRule ? "+ 휴가 발생 규칙 추가" : "휴가정책 생성 후 규칙 추가 가능")}</span>
            </button>
          </div>
        `;
      }

      return `
        <div class="workmate-leave-rule-record-grid">
          <div class="workmate-leave-rule-record-grid-head">
            <span>순서</span>
            <span>규칙명</span>
            <span>휴가정책</span>
            <span>주기</span>
            <span>발생일수</span>
            <span>적용 기간</span>
            <span>상태</span>
            <span>관리</span>
            <span>삭제</span>
          </div>
          ${rules.map((rule, index) => {
            const segments = sortLeaveRuleSegments(rule?.segments?.length ? rule.segments : [rule]);
            const ruleIds = toArray(rule?.ruleIds).length > 0
              ? toArray(rule.ruleIds)
              : String(rule?.id || "").split(",");
            const actionTarget = ruleIds.map((ruleId) => String(ruleId || "").trim()).filter(Boolean).join(",");
            const segmentCount = segments.length;
            const isImmediateProrated = String(rule?.frequency || "").toUpperCase() === "IMMEDIATE"
              && String(rule?.immediateAccrualType || "").toUpperCase() === "PRORATED";
            const amountSummary = segmentCount > 1
              ? `${formatNumber(segmentCount)}개 구간`
              : isImmediateProrated
                ? `연간 ${formatLeaveAmount(rule?.amountDays || segments[0]?.amountDays || 0)}`
                : formatLeaveAmount(rule?.amountDays || segments[0]?.amountDays || 0);

            return `
              <article class="workmate-leave-rule-record-grid-row">
                <div class="workmate-leave-rule-record-grid-cell workmate-management-order-cell">
                  <strong>${escapeHtml(formatNumber(index + 1))}</strong>
                </div>
                <div class="workmate-leave-rule-record-grid-cell">
                  <strong>${escapeHtml(rule?.name || "-")}</strong>
                  <span>${escapeHtml(segmentCount > 1 ? `${formatRuleBasis(rule)} · 구간 ${formatNumber(segmentCount)}개` : formatRuleBasis(rule))}</span>
                </div>
                <div class="workmate-leave-rule-record-grid-cell">
                  <span>${escapeHtml(rule?.leaveGroupName || "-")}</span>
                </div>
                <div class="workmate-leave-rule-record-grid-cell">
                  <span>${escapeHtml(segmentCount > 1 ? `${String(rule?.frequency || "").toUpperCase() === "MONTHLY" ? "월" : "연"} 주기` : formatRuleSummary(rule))}</span>
                </div>
                <div class="workmate-leave-rule-record-grid-cell">
                  <strong>${escapeHtml(amountSummary)}</strong>
                  ${segmentCount > 1 ? `<span>${escapeHtml(segments.map((segment) => formatLeaveAmount(segment?.amountDays || 0)).join(" / "))}</span>` : ""}
                </div>
                <div class="workmate-leave-rule-record-grid-cell workmate-leave-rule-segment-cell">
                  ${segments.map((segment) => `<span>${escapeHtml(formatLeaveRuleSegmentLine(segment))}</span>`).join("")}
                </div>
                <div class="workmate-leave-rule-record-grid-cell">
                  ${renderBadge(String(rule?.status || "ACTIVE") === "ACTIVE" ? "활성" : "비활성", String(rule?.status || "ACTIVE") === "ACTIVE" ? "green" : "gray")}
                </div>
                <div class="workmate-leave-rule-record-grid-cell workmate-leave-rule-action-cell">
                  <button
                    class="icon-button table-inline-icon-button workmate-worksite-record-action"
                    data-management-leave-rule-edit="${escapeAttribute(actionTarget)}"
                    type="button"
                    aria-label="휴가 발생 규칙 관리"
                    title="휴가 발생 규칙 관리"
                  >
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="2.6"></circle>
                      <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                    </svg>
                  </button>
                </div>
                <div class="workmate-leave-rule-record-grid-cell workmate-leave-rule-action-cell">
                  <button
                    class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button"
                    data-management-leave-rule-delete="${escapeAttribute(actionTarget)}"
                    type="button"
                    aria-label="휴가 발생 규칙 삭제"
                    title="휴가 발생 규칙 삭제"
                  >
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4.5 7.5h15"></path>
                      <path d="M9.5 3.5h5"></path>
                      <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                      <path d="M10 10.5v5"></path>
                      <path d="M14 10.5v5"></path>
                    </svg>
                  </button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `;
    }

    function renderManualGrantForm(groups = [], users = []) {
      const today = formatLocalDateKey();

      return `
        <div class="workmate-leave-policy-form" id="management-leave-manual-form">
          <label class="field select-field">
            <span>직원</span>
            <select id="management-leave-grant-user">${renderUserOptions(users)}</select>
          </label>
          <label class="field select-field">
            <span>휴가정책</span>
            <select id="management-leave-grant-group">${renderLeaveGroupOptions(groups)}</select>
          </label>
          <label class="field">
            <span>부여 일수</span>
            <input id="management-leave-grant-amount" min="0.5" step="0.5" type="number" value="1" />
          </label>
          <label class="field">
            <span>발생일</span>
            <input id="management-leave-grant-date" type="date" value="${escapeAttribute(today)}" />
          </label>
          <label class="field">
            <span>만료일</span>
            <input id="management-leave-grant-expires" type="date" />
          </label>
          <label class="field">
            <span>메모</span>
            <input id="management-leave-grant-memo" type="text" placeholder="예: 입사 초기 부여" />
          </label>
          <p class="form-inline-message hidden" id="management-leave-grant-error"></p>
          <button class="primary-button" data-management-leave-manual-grant="true" type="button">수동 부여</button>
        </div>
      `;
    }

    function renderManualGrantModal(state = {}, groups = [], users = []) {
      if (!state.managementLeaveManualGrantModalOpen) {
        return "";
      }

      return `
        <div class="modal workmate-leave-manual-modal" id="management-leave-manual-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-leave-manual-title">
          <div class="modal-backdrop" data-management-leave-manual-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-leave-manual-modal-sheet">
            <header class="modal-header">
              <div>
                <h3 id="management-leave-manual-title">수동 휴가 부여</h3>
                <p>직원별 휴가 발생 건을 직접 등록합니다.</p>
              </div>
              <button class="icon-button" data-management-leave-manual-close="true" type="button" aria-label="닫기">×</button>
            </header>
            <div class="modal-body workmate-leave-manual-modal-body">
              <section class="panel-card workmate-leave-policy-card">
                <div class="workmate-employee-section-head">
                  <strong>부여 정보</strong>
                  <span>직원, 휴가정책, 발생일을 지정하세요.</span>
                </div>
                ${renderManualGrantForm(groups, users)}
              </section>
            </div>
          </section>
        </div>
      `;
    }

    return Object.freeze({
      renderLeaveRuleModal,
      renderLeaveRuleRecords,
      renderManualGrantModal,
    });
  }

  return Object.freeze({ create });
});
