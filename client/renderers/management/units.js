(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementUnitsRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementUnitsRenderer(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderManagementModalHeaderActions,
      toArray,
    } = deps;

  function isManagementHiddenRootUnit(unit = {}) {
    return String(unit?.code || "").trim().toUpperCase() === "ROOT"
      && !String(unit?.parentUnitId || "").trim();
  }

  function sortManagementUnits(units = []) {
    return toArray(units)
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

  function buildManagementUnitPathLabel(unit = {}, unitById = new Map(), hiddenRootIds = new Set(), rootLabel = "") {
    const names = [];
    let cursor = unit;
    let guard = 0;

    while (cursor && guard < 20) {
      names.unshift(String(cursor?.name || "").trim() || "조직");
      const parentUnitId = String(cursor?.parentUnitId || "").trim();

      if (!parentUnitId || hiddenRootIds.has(parentUnitId)) {
        break;
      }

      cursor = unitById.get(parentUnitId) || null;
      guard += 1;
    }

    const normalizedRootLabel = String(rootLabel || "").trim();

    if (normalizedRootLabel) {
      names.unshift(normalizedRootLabel);
    }

    return names.join(" / ");
  }

  function buildManagementUnitModel(stats = {}) {
    const organizationName = String(stats.context?.name || "").trim() || "현재 회사";
    const allUnits = sortManagementUnits(stats.units);
    const hiddenRootIds = new Set(
      allUnits
        .filter((unit) => isManagementHiddenRootUnit(unit))
        .map((unit) => String(unit?.id || "").trim())
        .filter(Boolean),
    );
    const unitById = new Map(
      allUnits
        .map((unit) => [String(unit?.id || "").trim(), unit])
        .filter(([unitId]) => Boolean(unitId)),
    );
    const visibleUnits = allUnits.filter((unit) => !hiddenRootIds.has(String(unit?.id || "").trim()));
    const memberCountByUnitId = new Map();
    const jobTitleCountByUnitId = new Map();
    const siteCountByUnitId = new Map();

    toArray(stats.users).forEach((user) => {
      const unitId = String(user?.primaryUnitId || "").trim();

      if (!unitId) {
        return;
      }

      memberCountByUnitId.set(unitId, Number(memberCountByUnitId.get(unitId) || 0) + 1);
    });

    toArray(stats.sites).forEach((site) => {
      const unitId = String(site?.primaryUnitId || "").trim();

      if (!unitId) {
        return;
      }

      siteCountByUnitId.set(unitId, Number(siteCountByUnitId.get(unitId) || 0) + 1);
    });

    toArray(stats.jobTitles).forEach((jobTitle) => {
      toArray(jobTitle?.units).forEach((unit) => {
        const unitId = String(unit?.id || "").trim();

        if (!unitId) {
          return;
        }

        jobTitleCountByUnitId.set(unitId, Number(jobTitleCountByUnitId.get(unitId) || 0) + 1);
      });
    });

    const childrenByParentId = new Map();

    visibleUnits.forEach((unit) => {
      const unitId = String(unit?.id || "").trim();
      const rawParentUnitId = String(unit?.parentUnitId || "").trim();
      const normalizedParentUnitId = rawParentUnitId && unitById.has(rawParentUnitId) && !hiddenRootIds.has(rawParentUnitId)
        ? rawParentUnitId
        : "";

      if (!childrenByParentId.has(normalizedParentUnitId)) {
        childrenByParentId.set(normalizedParentUnitId, []);
      }

      childrenByParentId.get(normalizedParentUnitId)?.push(unit);

      if (!childrenByParentId.has(unitId)) {
        childrenByParentId.set(unitId, []);
      }
    });

    Array.from(childrenByParentId.values()).forEach((entries) => {
      entries.sort((left, right) => {
        const sortOrderGap = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);

        if (sortOrderGap !== 0) {
          return sortOrderGap;
        }

        return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
          numeric: true,
          sensitivity: "base",
        });
      });
    });

    const nodeById = new Map();
    const rows = [];

    function visit(parentUnitId = "", depth = 0) {
      toArray(childrenByParentId.get(parentUnitId)).forEach((unit) => {
        const unitId = String(unit?.id || "").trim();
        const parentName = parentUnitId
          ? String(unitById.get(parentUnitId)?.name || "").trim() || organizationName
          : organizationName;
        const childCount = toArray(childrenByParentId.get(unitId)).length;
        const jobTitleCount = Number(jobTitleCountByUnitId.get(unitId) || 0);
        const memberCount = Number(memberCountByUnitId.get(unitId) || 0);
        const siteCount = Number(siteCountByUnitId.get(unitId) || 0);
        const row = {
          childCount,
          depth,
          jobTitleCount,
          memberCount,
          parentName,
          pathLabel: buildManagementUnitPathLabel(unit, unitById, hiddenRootIds, organizationName),
          siteCount,
          unit,
        };

        rows.push(row);
        nodeById.set(unitId, {
          ...row,
          children: [],
          isDeletable: childCount === 0 && memberCount === 0 && siteCount === 0 && jobTitleCount === 0,
        });
        visit(unitId, depth + 1);
      });
    }

    visit("");

    const treeRoots = [];

    rows.forEach((row) => {
      const unitId = String(row?.unit?.id || "").trim();
      const node = nodeById.get(unitId);
      const rawParentUnitId = String(row?.unit?.parentUnitId || "").trim();
      const normalizedParentUnitId = rawParentUnitId && nodeById.has(rawParentUnitId) ? rawParentUnitId : "";

      if (!normalizedParentUnitId) {
        treeRoots.push(node);
        return;
      }

      nodeById.get(normalizedParentUnitId)?.children.push(node);
    });

    const organizationRootNode = {
      childCount: treeRoots.length,
      children: treeRoots,
      depth: 0,
      isDeletable: false,
      isOrganizationRoot: true,
      jobTitleCount: toArray(stats.jobTitles).length,
      memberCount: toArray(stats.users).length,
      parentName: "현재 회사",
      pathLabel: organizationName,
      siteCount: toArray(stats.sites).length,
      unit: {
        id: "",
        name: organizationName,
        parentUnitId: null,
      },
    };

    return {
      organizationRootNode,
      treeRoots: [organizationRootNode],
      rows,
      unitById,
      visibleUnits,
    };
  }

  function renderManagementUnitParentOptions(stats = {}, selectedParentUnitId = "", excludedUnitId = "") {
    const model = buildManagementUnitModel(stats);
    const normalizedSelectedParentUnitId = String(selectedParentUnitId || "").trim();
    const normalizedExcludedUnitId = String(excludedUnitId || "").trim();
    const excludedUnit = normalizedExcludedUnitId ? model.unitById.get(normalizedExcludedUnitId) : null;
    const excludedUnitPath = String(excludedUnit?.path || "").trim();
    const organizationName = String(model.organizationRootNode?.unit?.name || stats.context?.name || "").trim() || "현재 회사";

    return `
      <option value=""${!normalizedSelectedParentUnitId ? " selected" : ""}>${escapeHtml(organizationName)}</option>
      ${model.rows.filter((entry) => {
        const unitId = String(entry?.unit?.id || "").trim();
        const unitPath = String(entry?.unit?.path || "").trim();

        if (!normalizedExcludedUnitId) {
          return true;
        }

        if (unitId === normalizedExcludedUnitId) {
          return false;
        }

        return !(excludedUnitPath && unitPath.startsWith(`${excludedUnitPath}/`));
      }).map((entry) => {
        const unitId = String(entry?.unit?.id || "").trim();
        const depthPrefix = entry.depth > 0 ? `${"-- ".repeat(entry.depth)}` : "";

        return `
          <option value="${escapeAttribute(unitId)}"${unitId === normalizedSelectedParentUnitId ? " selected" : ""}>
            ${escapeHtml(`${depthPrefix}${entry?.unit?.name || "조직"}`)}
          </option>
        `;
      }).join("")}
    `;
  }

  function renderManagementUnitRecords(state = {}, stats = {}) {
    const model = buildManagementUnitModel(stats);

    function renderManagementUnitTreeNodes(nodes = []) {
      return `
        <ul class="workmate-unit-tree-list">
          ${nodes.map((node) => {
            const unitId = String(node?.unit?.id || "").trim();
            const deleteDisabled = !node?.isDeletable;
            const deleteTitle = deleteDisabled
              ? "하위 조직, 연결 구성원, 연결 근무지 또는 연결 직급이 있는 조직은 삭제할 수 없습니다."
              : "조직 삭제";
            const isLocked = deleteDisabled || Boolean(node?.isOrganizationRoot);
            const showDeleteButton = !Boolean(node?.isOrganizationRoot);
            const showEditButton = !Boolean(node?.isOrganizationRoot);
            const actionsMarkup = `
              <button class="outline-button workmate-unit-add-child-button" data-management-unit-open="${escapeAttribute(unitId)}" type="button">
                하위 조직 추가
              </button>
              ${showEditButton ? `
                <button
                  class="icon-button table-inline-icon-button workmate-worksite-record-action"
                  data-management-unit-edit="${escapeAttribute(unitId)}"
                  type="button"
                  aria-label="조직 관리"
                  title="조직 관리"
                >
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="2.6"></circle>
                    <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                  </svg>
                </button>
              ` : ""}
              ${showDeleteButton ? `
                <button
                  class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button"
                  data-management-unit-delete="${escapeAttribute(unitId)}"
                  type="button"
                  aria-label="조직 삭제"
                  title="${escapeAttribute(deleteTitle)}"
                  ${deleteDisabled ? "disabled" : ""}
                >
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4.5 7.5h15"></path>
                    <path d="M9.5 3.5h5"></path>
                    <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                    <path d="M10 10.5v5"></path>
                    <path d="M14 10.5v5"></path>
                  </svg>
                </button>
              ` : ""}
            `;

            return `
              <li class="workmate-unit-tree-node">
                <article class="workmate-unit-card${isLocked ? " is-locked" : ""}">
                  <div class="workmate-unit-card-row">
                    <div class="workmate-unit-card-title">
                      <strong>${escapeHtml(node?.unit?.name || "조직")}</strong>
                      <span>${escapeHtml(node?.parentName || "최상위 조직")}</span>
                    </div>
                    <div class="workmate-unit-card-meta">
                      <span>${escapeHtml(`하위 조직 ${formatNumber(node?.childCount || 0)}개`)}</span>
                      <span>${escapeHtml(`구성원 ${formatNumber(node?.memberCount || 0)}명`)}</span>
                    </div>
                    <small class="workmate-unit-card-path">${escapeHtml(node?.pathLabel || node?.unit?.name || "조직")}</small>
                    <div class="workmate-unit-card-actions">
                      ${actionsMarkup}
                    </div>
                  </div>
                </article>
                ${Array.isArray(node?.children) && node.children.length > 0 ? renderManagementUnitTreeNodes(node.children) : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    }

    return `
      <div class="workmate-unit-tree">
        ${renderManagementUnitTreeNodes(model.treeRoots)}
      </div>
    `;
  }

  function renderManagementUnitModal(state = {}, stats = {}) {
    if (!state.managementUnitModalOpen) {
      return "";
    }

    const draft = state.managementUnitDraft || {};
    const model = buildManagementUnitModel(stats);
    const normalizedUnitId = String(draft.unitId || "").trim();
    const isEditMode = Boolean(normalizedUnitId);
    const targetUnit = isEditMode ? model.unitById.get(normalizedUnitId) : null;
    const parentUnit = model.unitById.get(String(draft.parentUnitId || "").trim()) || null;
    const organizationName = String(model.organizationRootNode?.unit?.name || stats.context?.name || "").trim() || "현재 회사";
    const modalTitle = isEditMode ? "조직 관리" : "조직 추가";
    return `
      <div class="modal" id="management-unit-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-unit-modal-title">
        <div class="modal-backdrop" data-management-unit-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-unit-modal-sheet">
          <header class="modal-header">
            <div>
              <h3 id="management-unit-modal-title">${escapeHtml(modalTitle)}</h3>
            </div>
            ${renderManagementModalHeaderActions(state, {
              closeAction: "data-management-unit-close",
              formId: "management-unit-form",
              modalType: "unit",
            })}
          </header>
          <div class="modal-body workmate-unit-modal-body">
            <form class="workmate-form-stack" id="management-unit-form">
              <label class="field select-field" for="management-unit-parent">
                <span>상위 조직</span>
                <select id="management-unit-parent" name="parentUnitId">
                  ${renderManagementUnitParentOptions(stats, draft.parentUnitId, draft.unitId)}
                </select>
              </label>
              <label class="field" for="management-unit-name">
                <span>조직명</span>
                <input id="management-unit-name" name="name" placeholder="예: 운영본부" required type="text" value="${escapeAttribute(draft.name || "")}" />
              </label>
              <p class="workmate-unit-modal-hint">${escapeHtml(isEditMode ? "상위 조직을 바꾸면 해당 조직이 선택한 상위 조직 아래로 이동합니다." : "상위 조직을 선택하면 해당 조직 아래에 새 하위 조직이 생성됩니다.")}</p>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderManagementUnitsView(state = {}, stats = {}) {
    const model = buildManagementUnitModel(stats);

    return `
      <section class="workmate-admin-content-stack">
        <article class="panel-card workmate-unit-record-panel">
          <div class="workmate-worksite-panel-head">
            <div>
              <h4>조직 관리</h4>
              <p>최상위 조직 아래 하위 조직을 구성하고 사용자 연결 기준을 관리합니다.</p>
            </div>
          </div>
          <div class="workmate-admin-stage-metrics workmate-unit-stage-metrics">
            <div>
              <span>총 조직 수</span>
              <strong>${escapeHtml(formatNumber(model.visibleUnits.length))}</strong>
            </div>
            <div>
              <span>최상위 조직</span>
              <strong>${escapeHtml(formatNumber(model.rows.filter((entry) => Number(entry.depth || 0) === 0).length))}</strong>
            </div>
            <div>
              <span>구성원 연결 조직</span>
              <strong>${escapeHtml(formatNumber(toArray(stats.users).filter((user) => String(user?.primaryUnitId || "").trim()).length))}</strong>
            </div>
          </div>
          ${renderManagementUnitRecords(state, stats)}
        </article>
        ${renderManagementUnitModal(state, stats)}
      </section>
    `;
  }

    return Object.freeze({
      buildManagementUnitModel,
      renderManagementUnitsView,
    });
  }

  return Object.freeze({
    create: createManagementUnitsRenderer,
  });
});
