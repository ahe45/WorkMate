(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementSettingsRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementSettingsRenderer(deps = {}) {
    const {
      appConfig,
      buildStats,
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getDashboardGridState,
      getScheduleTypeMeta,
      hasDashboardGridFilter,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderEmptyState,
      renderMetricCard,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

    function getDefaultManagementSection() {
      return appConfig.managementMenuSections?.[0]?.items?.[0]?.key || "worksites";
    }

    function getManagementSectionState(state = {}) {
      const currentSection = String(state.managementSection || "").trim();
      const availableItems = (appConfig.managementMenuSections || []).flatMap((section) => toArray(section?.items));
      const activeItem = availableItems.find((item) => item?.key === currentSection) || availableItems[0] || { key: getDefaultManagementSection(), label: "근무지 관리" };

      return {
        activeKey: activeItem.key,
        activeLabel: activeItem.label,
      };
    }

    function formatCoordinate(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number.toFixed(6) : "-";
    }

    function renderManagementModalHeaderActions(state = {}, options = {}) {
      const modalType = String(options.modalType || "").trim();
      const formId = String(options.formId || "").trim();
      const closeAction = String(options.closeAction || "").trim();
      const isDirty = Boolean(state.managementModalUi?.dirty?.[modalType]);
      const isDisabled = !isDirty || Boolean(options.disabled);

      return `
        <div class="workmate-management-modal-header-actions">
          <button
            class="primary-button workmate-management-modal-save-button"
            data-management-modal-save-blocked="${options.disabled ? "true" : "false"}"
            data-management-modal-save-button="${escapeAttribute(modalType)}"
            form="${escapeAttribute(formId)}"
            type="submit"${isDisabled ? " disabled" : ""}
          >
            저장
          </button>
          <button class="icon-button" ${closeAction}="true" type="button" aria-label="닫기">×</button>
        </div>
      `;
    }

    function renderManagementModalConfirm(state = {}) {
      if (!state.managementModalUi?.confirm?.open) {
        return "";
      }

      return `
        <div class="modal workmate-management-confirm-modal" id="management-modal-confirm" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-modal-confirm-title">
          <div class="modal-backdrop" data-management-modal-confirm-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-management-confirm-sheet">
            <header class="modal-header workmate-management-confirm-header">
              <div>
                <h3 id="management-modal-confirm-title">변경사항을 저장할까요?</h3>
              </div>
            </header>
            <div class="modal-body workmate-management-confirm-body">
              <div class="toolbar-actions workmate-management-confirm-actions">
                <button class="outline-button" data-management-modal-confirm-action="cancel" type="button">취소</button>
                <button class="outline-button" data-management-modal-confirm-action="discard" type="button">저장 안 함</button>
                <button class="primary-button" data-management-modal-confirm-action="save" type="button">저장</button>
              </div>
            </div>
          </section>
        </div>
      `;
    }

    function renderManagementSidebar(state = {}) {
      const sectionState = getManagementSectionState(state);

      return `
      <aside class="workmate-admin-subnav" aria-label="관리 서브메뉴">
        ${(appConfig.managementMenuSections || []).map((section) => `
          <section class="workmate-admin-subnav-group">
            <div class="workmate-admin-subnav-items">
              ${toArray(section?.items).map((item) => `
                <button
                  class="workmate-admin-subnav-item${sectionState.activeKey === item?.key ? " active" : ""}"
                  data-management-section="${escapeAttribute(item?.key || "")}"
                  type="button"
                >
                  <strong>${escapeHtml(item?.label || "")}</strong>
                </button>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </aside>
    `;
    }

    const worksitesRendererModule = globalThis.WorkMateManagementWorksitesRenderer
      || (typeof require === "function" ? require("./worksites.js") : null);
    const unitsRendererModule = globalThis.WorkMateManagementUnitsRenderer
      || (typeof require === "function" ? require("./units.js") : null);
    const jobTitlesRendererModule = globalThis.WorkMateManagementJobTitlesRenderer
      || (typeof require === "function" ? require("./job-titles.js") : null);
    const holidaysRendererModule = globalThis.WorkMateManagementHolidaysRenderer
      || (typeof require === "function" ? require("./holidays.js") : null);
    const employeesRendererModule = globalThis.WorkMateManagementEmployeesRenderer
      || (typeof require === "function" ? require("./employees.js") : null);
    const leavePoliciesRendererModule = globalThis.WorkMateManagementLeavePoliciesRenderer
      || (typeof require === "function" ? require("./leave-policies.js") : null);
    const workSchedulesRendererModule = globalThis.WorkMateWorkSchedulesRenderer
      || (typeof require === "function" ? require("./work-schedules.js") : null);

    if (!worksitesRendererModule || typeof worksitesRendererModule.create !== "function") {
      throw new Error("client/renderers/management/worksites.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!unitsRendererModule || typeof unitsRendererModule.create !== "function") {
      throw new Error("client/renderers/management/units.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!jobTitlesRendererModule || typeof jobTitlesRendererModule.create !== "function") {
      throw new Error("client/renderers/management/job-titles.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!holidaysRendererModule || typeof holidaysRendererModule.create !== "function") {
      throw new Error("client/renderers/management/holidays.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!employeesRendererModule || typeof employeesRendererModule.create !== "function") {
      throw new Error("client/renderers/management/employees.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!leavePoliciesRendererModule || typeof leavePoliciesRendererModule.create !== "function") {
      throw new Error("client/renderers/management/leave-policies.js must be loaded before client/renderers/management/settings.js.");
    }

    if (!workSchedulesRendererModule || typeof workSchedulesRendererModule.create !== "function") {
      throw new Error("client/renderers/management/work-schedules.js must be loaded before client/renderers/management/settings.js.");
    }

    const worksitesRenderer = worksitesRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatCoordinate,
      formatNumber,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderManagementModalHeaderActions,
      renderDashboardFilterMenu,
      resolveDashboardGridRecords,
      toArray,
    });
    const unitsRenderer = unitsRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderManagementModalHeaderActions,
      toArray,
    });
    const jobTitlesRenderer = jobTitlesRendererModule.create({
      buildManagementUnitModel: unitsRenderer.buildManagementUnitModel,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderManagementModalHeaderActions,
      renderDashboardFilterMenu,
      renderManagementOrderCell: worksitesRenderer.renderManagementOrderCell,
      resolveDashboardGridRecords,
      toArray,
    });
    const holidaysRenderer = holidaysRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderManagementModalHeaderActions,
      renderBadge,
      renderEmptyState,
      toArray,
    });
    const employeesRenderer = employeesRendererModule.create({
      buildManagementUnitModel: unitsRenderer.buildManagementUnitModel,
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatNumber,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderMetricCard,
      toArray,
    });
    const leavePoliciesRenderer = leavePoliciesRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatNumber,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderMetricCard,
      toArray,
    });
    const workSchedulesRenderer = workSchedulesRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatDate,
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
      renderManagementOrderCell: worksitesRenderer.renderManagementOrderCell,
      resolveDashboardGridRecords,
      toArray,
    });
    const {
      buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementWorkSchedulesView,
    } = workSchedulesRenderer;

    function renderManagementView(state = {}) {
      const stats = buildStats(state);
      const sectionState = getManagementSectionState(state);

      return `
      <section class="workmate-admin-shell">
        ${renderManagementSidebar(state)}
        <div class="workmate-admin-stage">
          ${sectionState.activeKey === "worksites"
            ? worksitesRenderer.renderManagementWorksitesView(state, stats)
            : sectionState.activeKey === "units"
              ? unitsRenderer.renderManagementUnitsView(state, stats)
              : sectionState.activeKey === "job-titles"
                ? jobTitlesRenderer.renderManagementJobTitlesView(state, stats)
                : sectionState.activeKey === "employees"
                  ? employeesRenderer.renderManagementEmployeesView(state, stats)
                : sectionState.activeKey === "work-schedules"
                  ? renderManagementWorkSchedulesView(state, stats)
                  : sectionState.activeKey === "leave-policies"
                    ? leavePoliciesRenderer.renderManagementLeavePoliciesView(state, stats)
                    : sectionState.activeKey === "leave-accrual-rules"
                      ? leavePoliciesRenderer.renderManagementLeaveAccrualRulesView(state, stats)
                    : sectionState.activeKey === "leave-accrual-entries"
                      ? leavePoliciesRenderer.renderManagementLeaveAccrualEntriesView(state, stats)
                    : sectionState.activeKey === "holidays"
                      ? holidaysRenderer.renderManagementHolidaysView(state)
              : renderEmptyState("관리 메뉴를 선택하세요.", "구성할 관리 화면을 순차적으로 추가합니다.")}
        </div>
        ${renderManagementModalConfirm(state)}
      </section>
    `;
    }

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementView,
    });
  }

  return Object.freeze({
    create: createManagementSettingsRenderer,
  });
});
