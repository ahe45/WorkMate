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
      renderEmptyState,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

    function getDefaultManagementSection() {
      return appConfig.managementMenuSections?.[0]?.items?.[0]?.key || "worksites";
    }

    function getManagementSectionState(state = {}) {
      const currentSection = String(state.managementSection || "").trim();
      const availableItems = (appConfig.managementMenuSections || []).flatMap((section) => toArray(section?.items));
      const activeItem = availableItems.find((item) => item?.key === currentSection) || availableItems[0] || { key: getDefaultManagementSection(), label: "근무지 설정" };

      return {
        activeKey: activeItem.key,
        activeLabel: activeItem.label,
      };
    }

    function formatCoordinate(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number.toFixed(6) : "-";
    }

    function renderManagementSidebar(state = {}) {
      const sectionState = getManagementSectionState(state);

      return `
      <aside class="workmate-admin-subnav" aria-label="관리 서브메뉴">
        ${(appConfig.managementMenuSections || []).map((section) => `
          <section class="workmate-admin-subnav-group">
            <p class="workmate-admin-subnav-title">${escapeHtml(section?.title || "")}</p>
            <div class="workmate-admin-subnav-items">
              ${toArray(section?.items).map((item) => `
                <button
                  class="workmate-admin-subnav-item${sectionState.activeKey === item?.key ? " active" : ""}"
                  data-management-section="${escapeAttribute(item?.key || "")}"
                  type="button"
                >
                  <strong>${escapeHtml(item?.label || "")}</strong>
                  <span>${escapeHtml(item?.description || "")}</span>
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
      renderDashboardFilterMenu,
      resolveDashboardGridRecords,
      toArray,
    });
    const unitsRenderer = unitsRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
      toArray,
    });
    const jobTitlesRenderer = jobTitlesRendererModule.create({
      buildManagementUnitModel: unitsRenderer.buildManagementUnitModel,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderDashboardFilterMenu,
      renderManagementOrderCell: worksitesRenderer.renderManagementOrderCell,
      resolveDashboardGridRecords,
      toArray,
    });
    const holidaysRenderer = holidaysRendererModule.create({
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderBadge,
      renderEmptyState,
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
                : sectionState.activeKey === "work-schedules"
                  ? renderManagementWorkSchedulesView(state, stats)
                  : sectionState.activeKey === "holidays"
                    ? holidaysRenderer.renderManagementHolidaysView(state)
              : renderEmptyState("관리 메뉴를 선택하세요.", "구성할 관리 화면을 순차적으로 추가합니다.")}
        </div>
      </section>
    `;
    }

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules,
      calculateManagementWorkPolicyStageMetrics,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementView,
    });
  }

  return Object.freeze({
    create: createManagementSettingsRenderer,
  });
});
