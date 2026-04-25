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
      normalizeManagementPolicyMinimumRule: normalizer.normalizeManagementPolicyMinimumRule,
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
      normalizeManagementPolicyBoolean: normalizer.normalizeManagementPolicyBoolean,
      normalizeManagementPolicyMaximumRule: normalizer.normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMinimumRule: normalizer.normalizeManagementPolicyMinimumRule,
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
          label: "정책명",
          sortable: false,
        },
        { filterable: false, key: "type", label: "근로제 / 범위", sortable: false },
        { filterable: false, key: "rules", label: "기준 요약", sortable: false },
        { filterable: false, key: "templates", label: "연결 일정", sortable: false },
        { filterable: false, key: "settings", label: "설정", sortable: false },
        { filterable: false, key: "delete", label: "삭제", sortable: false },
      ];
    }

    function getManagementWorkPolicyTypeMeta(workType = "") {
      const normalizedWorkType = String(workType || "").trim().toUpperCase();
      const labels = {
        DEEMED: { label: "간주근로", tone: "orange" },
        DISCRETIONARY: { label: "재량근로", tone: "purple" },
        FIXED: { label: "고정근로", tone: "blue" },
        FLEXIBLE: { label: "탄력근로", tone: "green" },
        SCHEDULE_BASED: { label: "스케줄 기반", tone: "gray" },
        SELECTIVE: { label: "선택근로", tone: "teal" },
      };

      return labels[normalizedWorkType] || {
        label: normalizedWorkType || "근로정책",
        tone: "gray",
      };
    }

    function getManagementWorkPolicyScopeLabel(scope = "") {
      const normalizedScope = String(scope || "").trim().toUpperCase();
      const labels = {
        JOB_TITLES: "직급 선택",
        MIXED: "혼합 선택",
        ORGANIZATION: "전체 회사",
        SITES: "근무지 선택",
        UNITS: "조직 선택",
      };

      return labels[normalizedScope] || "적용 범위";
    }

    function getManagementWorkPolicyTargetNames(targetRule = {}, maps = {}) {
      const unitNames = toArray(targetRule.unitIds)
        .map((unitId) => maps.unitNameById.get(String(unitId || "").trim()) || "")
        .filter(Boolean);
      const jobTitleNames = toArray(targetRule.jobTitleIds)
        .map((jobTitleId) => maps.jobTitleNameById.get(String(jobTitleId || "").trim()) || "")
        .filter(Boolean);
      const siteNames = toArray(targetRule.siteIds)
        .map((siteId) => maps.siteNameById.get(String(siteId || "").trim()) || "")
        .filter(Boolean);

      return Array.from(new Set([...unitNames, ...jobTitleNames, ...siteNames]));
    }

    function formatManagementWorkPolicyTargetSummary(targetRule = {}, maps = {}) {
      const scopeLabel = getManagementWorkPolicyScopeLabel(targetRule.scope);
      const names = getManagementWorkPolicyTargetNames(targetRule, maps);

      if (targetRule.scope === "ORGANIZATION") {
        return {
          countLabel: "전체 구성원",
          label: scopeLabel,
        };
      }

      if (names.length === 0) {
        return {
          countLabel: "선택 항목 없음",
          label: scopeLabel,
        };
      }

      return {
        countLabel: `${formatNumber(names.length)}개 대상`,
        label: names.length === 1
          ? names[0]
          : `${names[0]} 외 ${formatNumber(names.length - 1)}개`,
      };
    }

    function formatManagementWorkPolicyHolidaySummary(info = {}) {
      const labels = [];

      if (info.includeWeekends) {
        labels.push("주말 포함");
      }

      if (info.settlementRule?.excludePublicHolidays) {
        labels.push("공휴일 제외");
      }

      if (info.settlementRule?.excludeSubstituteHolidays) {
        labels.push("대체공휴일 제외");
      }

      if (info.settlementRule?.excludeCustomHolidays) {
        labels.push("지정 휴일 제외");
      }

      return labels.length > 0 ? labels.join(" · ") : "휴일 기본값";
    }

    function buildManagementWorkPolicyListModel(stats = {}) {
      const policies = sortManagementWorkPolicies(getManagementWorkPolicies(stats));
      const unitNameById = new Map(toArray(stats.units).map((unit) => [String(unit?.id || "").trim(), String(unit?.name || unit?.code || "").trim()]));
      const jobTitleNameById = new Map(toArray(stats.jobTitles).map((jobTitle) => [String(jobTitle?.id || "").trim(), String(jobTitle?.name || "").trim()]));
      const siteNameById = new Map(toArray(stats.sites).map((site) => [String(site?.id || "").trim(), String(site?.name || "").trim()]));
      const templateCountByPolicyId = toArray(stats.templates).reduce((map, template) => {
        const policyId = String(template?.workPolicyId || "").trim();

        if (!policyId) {
          return map;
        }

        map.set(policyId, Number(map.get(policyId) || 0) + 1);
        return map;
      }, new Map());

      const records = policies.map((policy, index) => {
        const info = normalizer.getManagementWorkPolicyInformation(policy || {});
        const typeMeta = getManagementWorkPolicyTypeMeta(info.workType);
        const targetSummary = formatManagementWorkPolicyTargetSummary(info.targetRule || {}, {
          jobTitleNameById,
          siteNameById,
          unitNameById,
        });
        const workingDayLabel = scheduleListRenderer.formatManagementWorkScheduleDayLabel(
          toArray(info.workingDays).map((dayOfWeek) => ({ dayOfWeek })),
        );
        const policyId = String(policy?.id || "").trim();

        return {
          ...policy,
          dailyMaxLabel: metrics.formatManagementPolicyDuration(info.dailyMaxMinutes),
          dailyMinLabel: metrics.formatManagementPolicyDuration(info.dailyMinMinutes),
          defaultBadgeLabel: policy?.isDefault ? "기본 정책" : "",
          displayName: info.policyName || policy?.name || "근로정책",
          holidaySummary: formatManagementWorkPolicyHolidaySummary(info),
          info,
          linkedTemplateCount: Number(templateCountByPolicyId.get(policyId) || 0),
          orderLabel: formatNumber(index + 1),
          targetCountLabel: targetSummary.countLabel,
          targetSummary: targetSummary.label,
          typeLabel: typeMeta.label,
          typeTone: typeMeta.tone,
          workingDayLabel,
          workingRuleSummary: `${workingDayLabel} · 하루 ${metrics.formatManagementPolicyDuration(info.standardDailyMinutes)}`,
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
              <span class="table-header-label workmate-work-policy-grid-head-label">정책명</span>
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
          <span>근로제 / 범위</span>
          <span>기준 요약</span>
          <span>연결 일정</span>
          <span class="workmate-worksite-grid-action-head">설정</span>
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
                  <div class="workmate-work-policy-record-name">
                    <strong>${escapeHtml(record?.displayName || "근로정책")}</strong>
                    <div class="workmate-work-policy-record-badges">
                      ${record?.isDefault ? renderBadge("기본 정책", "blue") : ""}
                      ${renderBadge(record?.typeLabel || "근로정책", record?.typeTone || "gray")}
                    </div>
                  </div>
                  <span>${escapeHtml(record?.isDefault ? "회사 기본 정책" : "추가 정책")}</span>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.targetSummary || "-")}</strong>
                  <span>${escapeHtml(`${getManagementWorkPolicyScopeLabel(record?.info?.targetRule?.scope)} · ${record?.targetCountLabel || "선택 항목 없음"}`)}</span>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(record?.workingRuleSummary || "-")}</strong>
                  <span>${escapeHtml(`최소 ${record?.dailyMinLabel || "-"} · 최대 ${record?.dailyMaxLabel || "-"} · ${record?.holidaySummary || "휴일 기본값"}`)}</span>
                </div>
                <div class="workmate-work-policy-record-grid-cell">
                  <strong>${escapeHtml(`${formatNumber(record?.linkedTemplateCount || 0)}개`)}</strong>
                  <span>${escapeHtml(record?.linkedTemplateCount ? "연결된 근무일정" : "연결 일정 없음")}</span>
                </div>
                <div class="workmate-work-policy-record-grid-cell workmate-worksite-grid-actions">
                  <button class="icon-button table-inline-icon-button workmate-worksite-record-action" data-management-work-policy-open="${escapeAttribute(recordId)}" type="button" aria-label="근로정책 설정">
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

    function renderManagementWorkPolicyTemplatePanel(model = {}, stats = {}) {
      const selectedPolicyId = String(model?.policy?.id || "").trim();

      if (!selectedPolicyId) {
        return `
          <article class="workmate-grid-empty-row">
            <div class="workmate-worksite-grid-empty-copy">
              <strong>저장 후 연결 근무일정을 확인할 수 있습니다.</strong>
              <p>신규 정책은 저장한 뒤 템플릿과의 연결 현황이 표시됩니다.</p>
            </div>
          </article>
        `;
      }

      const scheduleModel = scheduleListRenderer.buildManagementWorkScheduleModel({
        ...stats,
        templates: toArray(stats.templates).filter((template) => String(template?.workPolicyId || "").trim() === selectedPolicyId),
      });

      return scheduleListRenderer.renderManagementWorkScheduleRows(scheduleModel.records);
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
      const saveLabel = String(draft.mode || "").trim().toLowerCase() === "edit"
        ? "근로정책 업데이트"
        : "근로정책 저장";
      const modalDescription = String(draft.mode || "").trim().toLowerCase() === "edit"
        ? "저장된 근로정책의 적용 대상과 계산 기준을 수정합니다."
        : "현재 근로정책 구성을 기반으로 새 정책을 추가합니다.";

      return `
        <div class="modal" id="management-work-policy-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-work-policy-modal-title">
          <div class="modal-backdrop" data-management-work-policy-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-work-policy-modal-sheet">
            <header class="modal-header">
              <div>
                <p class="page-kicker">Policy workspace</p>
                <h3 id="management-work-policy-modal-title">${escapeHtml(String(draft.mode || "").trim().toLowerCase() === "edit" ? "근로정책 설정 수정" : "근로정책 설정 등록")}</h3>
                <p>${escapeHtml(modalDescription)}</p>
              </div>
              <button class="icon-button" data-management-work-policy-close="true" type="button" aria-label="닫기">×</button>
            </header>
            <div class="modal-toolbar">
              <div class="page-indicator">
                ${model?.policy?.isDefault ? renderBadge("기본 정책", "blue") : renderBadge("추가 정책", "gray")}
                ${renderBadge(getManagementWorkPolicyTypeMeta(info.workType).label, getManagementWorkPolicyTypeMeta(info.workType).tone)}
              </div>
              <div class="toolbar-actions">
                <button class="outline-button" data-management-work-policy-close="true" type="button">취소</button>
                <button class="outline-button" data-management-work-policy-reset="true" type="button">초기화</button>
                <button class="primary-button" form="management-work-policy-form" type="submit">${escapeHtml(saveLabel)}</button>
              </div>
            </div>
            <div class="modal-body workmate-work-policy-modal-body">
              <div class="workmate-work-policy-modal-layout">
                <section class="panel-card workmate-work-policy-modal-panel">
                  ${metrics.renderManagementWorkPolicyStageMetrics(info)}
                  ${formRenderer.renderManagementWorkPolicyForm(model, stats)}
                </section>
                <section class="panel-card workmate-work-schedule-record-panel">
                  <div class="workmate-worksite-panel-head">
                    <div>
                      <h4>연결 근무일정</h4>
                      <p>선택한 근로정책을 사용하는 근무일정 템플릿만 표시합니다.</p>
                    </div>
                  </div>
                  ${renderManagementWorkPolicyTemplatePanel(model, stats)}
                </section>
              </div>
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
          <article class="panel-card workmate-work-schedule-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>근로정책 설정</h4>
                <p>근무지나 직급 설정과 같은 방식으로 정책을 추가하고 상세 기준은 모달에서 편집합니다.</p>
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
      renderManagementWorkSchedulesView,
    });
  }

  return Object.freeze({
    create: createWorkSchedulesRenderer,
  });
});
