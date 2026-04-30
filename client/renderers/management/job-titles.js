(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementJobTitlesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementJobTitlesRenderer(deps = {}) {
    const {
      buildManagementUnitModel,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderManagementModalHeaderActions,
      renderDashboardFilterMenu,
      renderManagementOrderCell,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

    const MANAGEMENT_JOB_TITLE_GRID_TABLE_ID = "management-job-titles";

  function getManagementSelectableUnits(stats = {}, unitTreeModel = null) {
    const model = unitTreeModel || buildManagementUnitModel(stats);

    return toArray(model.rows).map((entry) => ({
      ...entry.unit,
      pathLabel: entry.pathLabel,
    }));
  }

  function getManagementJobTitleGridColumns() {
    return [
      { filterable: false, key: "sortOrder", label: "순서", sortable: false },
      {
        filterable: true,
        getFilterValue: (record) => String(record?.name || "").trim(),
        key: "name",
        label: "직급",
        sortable: false,
      },
      {
        filterable: false,
        key: "units",
        label: "적용 조직",
        sortable: false,
      },
      { filterable: false, key: "settings", label: "관리", sortable: false },
      { filterable: false, key: "delete", label: "삭제", sortable: false },
    ];
  }

  function isManagementUnitDescendantOf(unit = {}, ancestorUnitId = "", unitById = new Map()) {
    const normalizedAncestorUnitId = String(ancestorUnitId || "").trim();
    let parentUnitId = String(unit?.parentUnitId || "").trim();
    let guard = 0;

    while (normalizedAncestorUnitId && parentUnitId && guard < 20) {
      if (parentUnitId === normalizedAncestorUnitId) {
        return true;
      }

      parentUnitId = String(unitById.get(parentUnitId)?.parentUnitId || "").trim();
      guard += 1;
    }

    return false;
  }

  function formatManagementJobTitleUnitBadgeLabel(unit = {}, organizationName = "") {
    const normalizedOrganizationName = String(organizationName || "").trim();
    const pathParts = String(unit?.pathLabel || unit?.name || "")
      .split("/")
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    if (normalizedOrganizationName && pathParts[0] === normalizedOrganizationName) {
      pathParts.shift();
    }

    return (pathParts.length > 0 ? pathParts : [String(unit?.name || "").trim() || "조직"]).join("-");
  }

  function getManagementJobTitleDisplayUnits(appliedUnits = [], unitById = new Map()) {
    const units = toArray(appliedUnits);

    return units.filter((unit) => {
      const unitId = String(unit?.id || "").trim();

      if (!unitId) {
        return false;
      }

      return !units.some((candidate) => {
        const candidateId = String(candidate?.id || "").trim();

        return candidateId && candidateId !== unitId && isManagementUnitDescendantOf(candidate, unitId, unitById);
      });
    });
  }

  function sortManagementJobTitles(jobTitles = []) {
    return toArray(jobTitles)
      .slice()
      .sort((left, right) => {
        const sortOrderGap = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);

        if (sortOrderGap !== 0) {
          return sortOrderGap;
        }

        return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }

  function buildManagementJobTitleModel(stats = {}) {
    const unitTreeModel = buildManagementUnitModel(stats);
    const selectableUnits = getManagementSelectableUnits(stats, unitTreeModel);
    const selectableUnitIds = new Set(selectableUnits.map((unit) => String(unit?.id || "").trim()).filter(Boolean));
    const selectableUnitById = new Map(selectableUnits.map((unit) => [String(unit?.id || "").trim(), unit]).filter(([unitId]) => Boolean(unitId)));
    const selectableUnitOrder = new Map(selectableUnits.map((unit, index) => [String(unit?.id || "").trim(), index]).filter(([unitId]) => Boolean(unitId)));
    const organizationName = String(unitTreeModel.organizationRootNode?.unit?.name || stats.context?.name || "").trim() || "현재 회사";
    const records = sortManagementJobTitles(stats.jobTitles)
      .map((jobTitle) => {
        const appliedUnits = toArray(jobTitle?.units)
          .map((unit) => selectableUnitById.get(String(unit?.id || "").trim()) || unit)
          .filter((unit) => selectableUnitIds.has(String(unit?.id || "").trim()))
          .sort((left, right) => {
            const leftOrder = selectableUnitOrder.get(String(left?.id || "").trim()) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = selectableUnitOrder.get(String(right?.id || "").trim()) ?? Number.MAX_SAFE_INTEGER;

            return leftOrder - rightOrder;
          });
        const displayUnits = getManagementJobTitleDisplayUnits(appliedUnits, selectableUnitById);
        const appliedUnitNames = displayUnits
          .map((unit) => formatManagementJobTitleUnitBadgeLabel(unit, organizationName))
          .filter(Boolean);

        return {
          ...jobTitle,
          appliedUnitCount: displayUnits.length,
          appliedUnitLabel: appliedUnitNames.join(", "),
          displayUnits,
          unitIds: appliedUnits.map((unit) => String(unit?.id || "").trim()).filter(Boolean),
          units: appliedUnits,
        };
      });

    return {
      organizationName,
      records,
      selectableUnits,
      selectableUnitTreeRoots: toArray(unitTreeModel.organizationRootNode?.children),
    };
  }

  function renderJobTitleGridHead(isNameFilterActive = false) {
    return `
      <div class="workmate-title-record-grid-head">
        <span class="workmate-worksite-grid-action-head">순서</span>
        <span class="workmate-title-record-grid-head-cell${isNameFilterActive ? " is-filter-active" : ""}">
          <span class="table-header-shell has-filter">
            <span class="table-header-label workmate-title-record-grid-head-label">직급</span>
            <button
              class="table-filter-button"
              data-dashboard-grid-filter-open="true"
              data-dashboard-grid-table="${escapeAttribute(MANAGEMENT_JOB_TITLE_GRID_TABLE_ID)}"
              data-dashboard-grid-column="name"
              type="button"
              aria-label="직급 필터 열기"
            >
              <span class="table-filter-glyph" aria-hidden="true"></span>
            </button>
          </span>
        </span>
        <span>적용 조직</span>
        <span class="workmate-worksite-grid-action-head">관리</span>
        <span class="workmate-worksite-grid-action-head">삭제</span>
      </div>
    `;
  }

  function renderManagementJobTitleRecords(state = {}, stats = {}, model = buildManagementJobTitleModel(stats)) {
    const selectedJobTitleId = String(state.managementJobTitleDraft?.jobTitleId || "").trim();
    const jobTitleGridColumns = getManagementJobTitleGridColumns();
    const jobTitleGridState = getDashboardGridState(state, MANAGEMENT_JOB_TITLE_GRID_TABLE_ID);
    const orderedJobTitleIds = model.records.map((record) => String(record?.id || "").trim()).filter(Boolean);
    const { sortedRecords: filteredRecords } = resolveDashboardGridRecords(
      model.records,
      jobTitleGridColumns,
      {
        ...jobTitleGridState,
        sortRules: [],
      },
    );
    const isNameFilterActive = hasDashboardGridFilter(jobTitleGridState, "name");

    if (model.selectableUnits.length === 0) {
      return `
        <div class="workmate-title-record-grid">
          ${renderJobTitleGridHead(isNameFilterActive)}
          <article class="workmate-grid-empty-row">
            <div class="workmate-worksite-grid-empty-copy">
              <strong>적용할 조직이 없습니다.</strong>
            </div>
          </article>
        </div>
      `;
    }

    if (model.records.length === 0) {
      return `
        <div class="workmate-title-record-grid">
          ${renderJobTitleGridHead(isNameFilterActive)}
          <button class="workmate-title-record-grid-row workmate-worksite-empty-add-card" data-management-job-title-open="" type="button">
            <span class="workmate-worksite-empty-add-label">+ 직급 추가</span>
          </button>
        </div>
      `;
    }

    if (filteredRecords.length === 0) {
      return `
        <div class="workmate-title-record-grid">
          ${renderJobTitleGridHead(isNameFilterActive)}
          <article class="workmate-grid-empty-row">
            <div class="workmate-worksite-grid-empty-copy">
              <strong>필터 결과가 없습니다.</strong>
              <p>${escapeHtml(isNameFilterActive ? "직급 필터 조건과 일치하는 항목이 없습니다." : "표시할 직급이 없습니다.")}</p>
            </div>
          </article>
        </div>
      `;
    }

    return `
      <div class="workmate-title-record-grid" data-management-job-title-order="${escapeAttribute(orderedJobTitleIds.join(","))}">
        ${renderJobTitleGridHead(isNameFilterActive)}
        ${filteredRecords.map((record, index) => {
          const isActive = selectedJobTitleId && String(record?.id || "").trim() === selectedJobTitleId;
          const displayUnits = toArray(record?.displayUnits);
          const recordId = String(record?.id || "").trim();
          const orderLabel = formatNumber(Number(record?.sortOrder || index + 1));

          return `
            <article class="workmate-title-record-grid-row${isActive ? " is-active" : ""}" data-management-job-title-row="${escapeAttribute(recordId)}" draggable="true">
              <div class="workmate-title-record-grid-cell workmate-management-order-cell">
                ${renderManagementOrderCell(orderLabel)}
              </div>
              <div class="workmate-title-record-grid-cell">
                <strong>${escapeHtml(record?.name || "직급")}</strong>
                <span>${escapeHtml(`${formatNumber(record?.appliedUnitCount || 0)}개 조직 적용`)}</span>
              </div>
              <div class="workmate-title-record-grid-cell">
                <div class="workmate-title-unit-badges">
                  ${displayUnits.length > 0
                    ? displayUnits.map((unit) => {
                      const unitName = formatManagementJobTitleUnitBadgeLabel(unit, model.organizationName);

                      return unitName
                        ? `<span class="workmate-title-unit-badge">${escapeHtml(unitName)}</span>`
                        : "";
                    }).filter(Boolean).join("")
                    : `<span class="workmate-title-unit-empty-label">-</span>`}
                </div>
              </div>
              <div class="workmate-worksite-grid-cell workmate-worksite-grid-actions">
                <button class="icon-button table-inline-icon-button workmate-worksite-record-action" data-management-job-title-open="${escapeAttribute(record?.id || "")}" type="button" aria-label="직급 관리">
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="2.6"></circle>
                    <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                  </svg>
                </button>
              </div>
              <div class="workmate-worksite-grid-cell workmate-worksite-grid-actions">
                <button class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button" data-management-job-title-delete="${escapeAttribute(record?.id || "")}" type="button" aria-label="직급 삭제">
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

  function renderManagementJobTitleUnitChecklist(model = {}, selectedUnitIds = []) {
    const selectedUnitIdSet = new Set(toArray(selectedUnitIds).map((unitId) => String(unitId || "").trim()).filter(Boolean));
    const selectableUnits = toArray(model.selectableUnits);

    if (selectableUnits.length === 0) {
      return `
        <div class="workmate-job-title-unit-empty">
          <strong>선택 가능한 조직이 없습니다.</strong>
          <span>조직 관리에서 먼저 적용 대상 조직을 생성하세요.</span>
        </div>
      `;
    }

    function collectDescendantUnitIds(node = {}) {
      const descendantIds = [];

      toArray(node?.children).forEach((childNode) => {
        const childUnitId = String(childNode?.unit?.id || "").trim();

        if (childUnitId) {
          descendantIds.push(childUnitId);
        }

        descendantIds.push(...collectDescendantUnitIds(childNode));
      });

      return descendantIds;
    }

    function renderUnitTree(nodes = [], parentUnitId = "") {
      return `
        <ul class="workmate-job-title-unit-tree-list">
          ${toArray(nodes).map((node) => {
            const unitId = String(node?.unit?.id || "").trim();
            const descendantIds = collectDescendantUnitIds(node);

            if (!unitId) {
              return "";
            }

            return `
              <li class="workmate-job-title-unit-tree-node">
                <label class="checkbox-field workmate-job-title-unit-tree-option">
                  <input
                    data-management-job-title-parent-unit-id="${escapeAttribute(parentUnitId)}"
                    data-management-job-title-unit-descendants="${escapeAttribute(descendantIds.join(","))}"
                    data-management-job-title-unit-option="true"
                    name="unitIds"
                    type="checkbox"
                    value="${escapeAttribute(unitId)}"${selectedUnitIdSet.has(unitId) ? " checked" : ""}
                  />
                  <span>${escapeHtml(node?.unit?.name || "조직")}</span>
                </label>
                ${Array.isArray(node?.children) && node.children.length > 0 ? renderUnitTree(node.children, unitId) : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    }

    const allSelected = selectableUnits.length > 0 && selectableUnits.every((unit) => selectedUnitIdSet.has(String(unit?.id || "").trim()));

    return `
      <div class="workmate-job-title-unit-toolbar">
        <label class="checkbox-field workmate-job-title-select-all">
          <input data-management-job-title-select-all="true" type="checkbox"${allSelected ? " checked" : ""} />
          <span>전체 선택</span>
        </label>
        <small>${escapeHtml(`총 ${formatNumber(selectableUnits.length)}개 조직`)}</small>
      </div>
      <div class="workmate-job-title-unit-tree">
        <strong class="workmate-job-title-unit-tree-root">${escapeHtml(model.organizationName || "현재 회사")}</strong>
        ${renderUnitTree(model.selectableUnitTreeRoots)}
      </div>
    `;
  }

  function renderManagementJobTitleModal(state = {}, stats = {}) {
    if (!state.managementJobTitleModalOpen) {
      return "";
    }

    const draft = state.managementJobTitleDraft || {};
    const model = buildManagementJobTitleModel(stats);
    const isEditMode = Boolean(String(draft.jobTitleId || "").trim());
    return `
      <div class="modal" id="management-job-title-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-job-title-modal-title">
        <div class="modal-backdrop" data-management-job-title-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-job-title-modal-sheet">
          <header class="modal-header">
            <div>
              <h3 id="management-job-title-modal-title">${escapeHtml(isEditMode ? "직급 관리 수정" : "직급 관리 등록")}</h3>
            </div>
            ${renderManagementModalHeaderActions(state, {
              closeAction: "data-management-job-title-close",
              disabled: model.selectableUnits.length === 0,
              formId: "management-job-title-form",
              modalType: "jobTitle",
            })}
          </header>
          <div class="modal-body workmate-job-title-modal-body">
            <form class="workmate-form-stack" id="management-job-title-form">
              <label class="field" for="management-job-title-name">
                <span>직급</span>
                <input id="management-job-title-name" name="name" placeholder="예: 대리" required type="text" value="${escapeAttribute(draft.name || "")}" />
              </label>
              <section class="workmate-job-title-unit-section">
                <div class="workmate-worksite-panel-head">
                  <div>
                    <h4>적용 조직</h4>
                    <p>생성된 조직 기준으로 직급을 적용할 조직을 체크하세요.</p>
                  </div>
                </div>
                ${renderManagementJobTitleUnitChecklist(model, draft.unitIds)}
              </section>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderManagementJobTitlesView(state = {}, stats = {}) {
    const model = buildManagementJobTitleModel(stats);
    const jobTitleGridColumns = getManagementJobTitleGridColumns();
    const jobTitleRecords = model.records;
    const hasJobTitles = jobTitleRecords.length > 0;
    const canAddJobTitles = model.selectableUnits.length > 0;

    return `
      <section class="workmate-admin-content-stack">
        <article class="panel-card workmate-title-record-panel">
          <div class="workmate-worksite-panel-head">
            <div>
              <h4>직급 관리</h4>
              <p>조직별로 사용할 직급명을 등록하고 노출 순서를 관리합니다.</p>
            </div>
            ${hasJobTitles && canAddJobTitles ? `
              <div class="workmate-topbar-actions workmate-worksite-panel-controls">
                <button class="primary-button" data-management-job-title-open="" type="button">직급 추가</button>
              </div>
            ` : `
              <div class="workmate-topbar-actions workmate-worksite-panel-controls is-placeholder" aria-hidden="true">
                <span class="primary-button">직급 추가</span>
              </div>
            `}
          </div>
          ${renderManagementJobTitleRecords(state, stats, model)}
        </article>
        ${renderDashboardFilterMenu(state, MANAGEMENT_JOB_TITLE_GRID_TABLE_ID, jobTitleGridColumns, jobTitleRecords)}
        ${renderManagementJobTitleModal(state, stats)}
      </section>
    `;
  }

    return Object.freeze({
      buildManagementJobTitleModel,
      renderManagementJobTitlesView,
    });
  }

  return Object.freeze({
    create: createManagementJobTitlesRenderer,
  });
});
