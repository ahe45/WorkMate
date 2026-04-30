(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeavePolicyGroupsRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatLeaveAmount,
      formatNumber,
      toArray,
    } = deps;

    function getActiveLeaveGroups(state = {}) {
      return toArray(state.bootstrap?.leaveGroups)
        .filter((group) => String(group?.status || "").toUpperCase() === "ACTIVE");
    }

    function getLeaveGroupParentId(group = {}) {
      return String(group?.parentLeaveGroupId || group?.parent_leave_group_id || group?.parentId || "").trim();
    }

    function renderLeaveGroupOptions(groups = []) {
      if (groups.length === 0) {
        return '<option value="">휴가정책 없음</option>';
      }

      return groups.map((group) => `
        <option value="${escapeAttribute(group?.id || "")}">${escapeHtml(group?.name || "-")}</option>
      `).join("");
    }

    function formatLeaveGroupPathOptionLabel(group = {}, groupById = new Map()) {
      const names = [];
      let cursor = group;
      let guard = 0;

      while (cursor && guard < 20) {
        const label = String(cursor?.name || "").trim();

        if (label) {
          names.unshift(label);
        }

        const parentLeaveGroupId = getLeaveGroupParentId(cursor);

        if (!parentLeaveGroupId) {
          break;
        }

        cursor = groupById.get(parentLeaveGroupId) || null;
        guard += 1;
      }

      return names.join("-") || "휴가정책";
    }

    function renderLeaveGroupPathOptions(groups = [], selectedGroupId = "") {
      if (groups.length === 0) {
        return '<option value="">휴가정책 없음</option>';
      }

      const normalizedSelectedGroupId = String(selectedGroupId || "").trim();
      const parentGroupIds = new Set(
        toArray(groups)
          .map((group) => getLeaveGroupParentId(group))
          .filter(Boolean),
      );
      const selectableGroups = toArray(groups)
        .filter((group) => {
          const groupId = String(group?.id || "").trim();

          return groupId && !parentGroupIds.has(groupId);
        });

      if (selectableGroups.length === 0) {
        return '<option value="">선택 가능한 휴가정책 없음</option>';
      }

      const groupById = new Map(
        toArray(groups)
          .map((group) => [String(group?.id || "").trim(), group])
          .filter(([groupId]) => Boolean(groupId)),
      );

      return sortLeavePolicyGroups(selectableGroups)
        .slice()
        .sort((left, right) => formatLeaveGroupPathOptionLabel(left, groupById).localeCompare(
          formatLeaveGroupPathOptionLabel(right, groupById),
          "ko",
          {
            numeric: true,
            sensitivity: "base",
          },
        ))
        .map((group) => `
          <option value="${escapeAttribute(group?.id || "")}"${String(group?.id || "").trim() === normalizedSelectedGroupId ? " selected" : ""}>${escapeHtml(formatLeaveGroupPathOptionLabel(group, groupById))}</option>
        `).join("");
    }

    function sortLeavePolicyGroups(groups = []) {
      return toArray(groups)
        .slice()
        .sort((left, right) => {
          const leftCreatedAt = String(left?.createdAt || "");
          const rightCreatedAt = String(right?.createdAt || "");

          if (leftCreatedAt && rightCreatedAt && leftCreatedAt !== rightCreatedAt) {
            return leftCreatedAt.localeCompare(rightCreatedAt);
          }

          return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
            numeric: true,
            sensitivity: "base",
          });
        });
    }

    function buildLeavePolicyPathLabel(group = {}, groupById = new Map(), rootLabel = "휴가정책") {
      const names = [];
      let cursor = group;
      let guard = 0;

      while (cursor && guard < 20) {
        names.unshift(String(cursor?.name || "").trim() || "휴가정책");
        const parentLeaveGroupId = getLeaveGroupParentId(cursor);

        if (!parentLeaveGroupId) {
          break;
        }

        cursor = groupById.get(parentLeaveGroupId) || null;
        guard += 1;
      }

      return [rootLabel, ...names].filter(Boolean).join(" / ");
    }

    function buildLeavePolicyTreeModel(groups = []) {
      const orderedGroups = sortLeavePolicyGroups(groups);
      const groupById = new Map(
        orderedGroups
          .map((group) => [String(group?.id || "").trim(), group])
          .filter(([groupId]) => Boolean(groupId)),
      );
      const childrenByParentId = new Map();

      orderedGroups.forEach((group) => {
        const groupId = String(group?.id || "").trim();
        const parentLeaveGroupId = getLeaveGroupParentId(group);
        const normalizedParentLeaveGroupId = parentLeaveGroupId && groupById.has(parentLeaveGroupId)
          ? parentLeaveGroupId
          : "";

        if (!childrenByParentId.has(normalizedParentLeaveGroupId)) {
          childrenByParentId.set(normalizedParentLeaveGroupId, []);
        }

        childrenByParentId.get(normalizedParentLeaveGroupId)?.push(group);

        if (!childrenByParentId.has(groupId)) {
          childrenByParentId.set(groupId, []);
        }
      });

      const nodeById = new Map();

      function createNode(group = {}, depth = 0) {
        const groupId = String(group?.id || "").trim();
        const parentLeaveGroupId = getLeaveGroupParentId(group);
        const parentGroup = parentLeaveGroupId ? groupById.get(parentLeaveGroupId) : null;
        const children = toArray(childrenByParentId.get(groupId)).map((childGroup) => createNode(childGroup, depth + 1));
        const node = {
          childCount: children.length,
          children,
          depth,
          group,
          parentName: parentGroup?.name || "최상위 정책",
          pathLabel: buildLeavePolicyPathLabel(group, groupById),
        };

        nodeById.set(groupId, node);
        return node;
      }

      const rootChildren = toArray(childrenByParentId.get(""))
        .map((group) => createNode(group, 1));
      const rootNode = {
        childCount: rootChildren.length,
        children: rootChildren,
        depth: 0,
        group: {
          id: "",
          name: "휴가정책",
          parentLeaveGroupId: null,
        },
        isPolicyRoot: true,
        parentName: "정책 트리",
        pathLabel: "휴가정책",
      };

      return {
        groupById,
        nodeById,
        rootNode,
        rootNodes: [rootNode],
        totalCount: orderedGroups.length,
      };
    }

    function collectLeaveGroupDescendantIds(groups = [], leaveGroupId = "") {
      const normalizedLeaveGroupId = String(leaveGroupId || "").trim();
      const descendantIds = new Set();

      if (!normalizedLeaveGroupId) {
        return descendantIds;
      }

      let pendingIds = [normalizedLeaveGroupId];

      while (pendingIds.length > 0) {
        const parentId = pendingIds.pop();
        const childIds = toArray(groups)
          .filter((group) => getLeaveGroupParentId(group) === parentId)
          .map((group) => String(group?.id || "").trim())
          .filter(Boolean);

        childIds.forEach((childId) => {
          if (!descendantIds.has(childId)) {
            descendantIds.add(childId);
            pendingIds.push(childId);
          }
        });
      }

      return descendantIds;
    }

    function getLeaveGroupDepth(group = {}, groupById = new Map()) {
      let depth = 0;
      let cursor = group;
      let guard = 0;

      while (getLeaveGroupParentId(cursor) && guard < 20) {
        cursor = groupById.get(getLeaveGroupParentId(cursor)) || null;
        if (!cursor) {
          break;
        }
        depth += 1;
        guard += 1;
      }

      return depth;
    }

    function renderLeaveGroupParentOptions(groups = [], selectedParentLeaveGroupId = "", targetGroup = null) {
      const normalizedSelectedParentLeaveGroupId = String(selectedParentLeaveGroupId || "").trim();
      const targetGroupId = String(targetGroup?.id || "").trim();
      const excludedIds = collectLeaveGroupDescendantIds(groups, targetGroupId);

      if (targetGroupId) {
        excludedIds.add(targetGroupId);
      }

      const groupById = new Map(
        toArray(groups)
          .map((group) => [String(group?.id || "").trim(), group])
          .filter(([groupId]) => Boolean(groupId)),
      );
      const options = sortLeavePolicyGroups(groups)
        .filter((group) => {
          const groupId = String(group?.id || "").trim();

          return groupId && !excludedIds.has(groupId);
        })
        .sort((left, right) => {
          const leftPath = buildLeavePolicyPathLabel(left, groupById);
          const rightPath = buildLeavePolicyPathLabel(right, groupById);

          return leftPath.localeCompare(rightPath, "ko", {
            numeric: true,
            sensitivity: "base",
          });
        })
        .map((group) => {
          const groupId = String(group?.id || "").trim();
          const depthPrefix = getLeaveGroupDepth(group, groupById) > 0
            ? `${"-- ".repeat(getLeaveGroupDepth(group, groupById))}`
            : "";

          return `
            <option value="${escapeAttribute(groupId)}"${groupId === normalizedSelectedParentLeaveGroupId ? " selected" : ""}>
              ${escapeHtml(`${depthPrefix}${group?.name || "휴가정책"}`)}
            </option>
          `;
        }).join("");

      return `
        <option value=""${normalizedSelectedParentLeaveGroupId ? "" : " selected"}>휴가정책</option>
        ${options}
      `;
    }

    function renderLeaveGroupForm(parentGroup = null, parentLeaveGroupId = "", targetGroup = null, groups = []) {
      const isEditMode = Boolean(String(targetGroup?.id || "").trim());
      const normalizedParentLeaveGroupId = String(parentLeaveGroupId || parentGroup?.id || "").trim();

      return `
        <article class="panel-card workmate-leave-policy-card">
          <div class="workmate-employee-section-head">
            <strong>${escapeHtml(isEditMode ? "휴가정책 관리" : "휴가정책 생성")}</strong>
            <span>${escapeHtml(isEditMode ? "정책명, 초과 사용 제한, 설명을 관리합니다." : "연차, 보상휴가처럼 잔액을 묶어 관리할 단위입니다.")}</span>
          </div>
          <div class="workmate-leave-policy-form" id="management-leave-group-form">
            <input id="management-leave-group-id" type="hidden" value="${escapeAttribute(targetGroup?.id || "")}" />
            <label class="field select-field workmate-leave-parent-select-field is-span-2">
              <span>상위 휴가정책</span>
              <select id="management-leave-group-parent">
                ${renderLeaveGroupParentOptions(groups, normalizedParentLeaveGroupId, targetGroup)}
              </select>
            </label>
            <label class="field">
              <span>정책명</span>
              <input id="management-leave-group-name" type="text" placeholder="예: 연차휴가" value="${escapeAttribute(targetGroup?.name || "")}" />
            </label>
            <label class="field">
              <span>초과 사용 제한일</span>
              <input id="management-leave-group-negative-limit" min="0" step="0.5" type="number" value="${escapeAttribute(targetGroup?.negativeLimitDays ?? 0)}" />
            </label>
            <label class="field is-span-2">
              <span>설명</span>
              <textarea id="management-leave-group-description" rows="3" placeholder="운영 메모를 입력하세요.">${escapeHtml(targetGroup?.description || "")}</textarea>
            </label>
            <p class="form-inline-message hidden" id="management-leave-group-error"></p>
          </div>
        </article>
      `;
    }

    function renderLeaveGroupModal(state = {}, groups = []) {
      if (!state.managementLeaveGroupModalOpen) {
        return "";
      }

      const editLeaveGroupId = String(state.managementLeaveGroupEditId || "").trim();
      const targetGroup = editLeaveGroupId
        ? groups.find((group) => String(group?.id || "").trim() === editLeaveGroupId) || null
        : null;
      const parentLeaveGroupId = targetGroup
        ? getLeaveGroupParentId(targetGroup)
        : String(state.managementLeaveGroupParentId || "").trim();
      const parentGroup = parentLeaveGroupId
        ? groups.find((group) => String(group?.id || "").trim() === parentLeaveGroupId) || null
        : null;
      const isChildPolicy = Boolean(parentLeaveGroupId);
      const isEditMode = Boolean(targetGroup);
      const parentName = parentGroup?.name || "선택한 휴가정책";
      const modalTitle = isEditMode ? "휴가정책 관리" : isChildPolicy ? "하위 휴가정책 등록" : "휴가정책 등록";
      const modalCopy = isEditMode
        ? ""
        : isChildPolicy
        ? `"${parentName}" 아래에 하위 휴가정책을 생성합니다.`
        : "최상위 휴가정책을 생성합니다.";

      return `
        <div class="modal workmate-leave-group-modal" id="management-leave-group-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-leave-group-modal-title">
          <div class="modal-backdrop" data-management-leave-group-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-leave-config-modal-sheet workmate-leave-group-modal-sheet">
            <header class="modal-header">
              <div>
                <h3 id="management-leave-group-modal-title">${escapeHtml(modalTitle)}</h3>
                ${modalCopy ? `<p>${escapeHtml(modalCopy)}</p>` : ""}
              </div>
              <div class="workmate-management-modal-header-actions">
                <button class="outline-button" data-management-leave-group-close="true" type="button">취소</button>
                <button class="primary-button" data-management-leave-group-create="true" type="button">저장</button>
              </div>
            </header>
            <div class="modal-body workmate-leave-config-modal-body">
              ${renderLeaveGroupForm(parentGroup, parentLeaveGroupId, targetGroup, groups)}
            </div>
          </section>
        </div>
      `;
    }

    function renderLeaveGroupRecords(groups = []) {
      const model = buildLeavePolicyTreeModel(groups);

      function renderLeavePolicyTreeNodes(nodes = []) {
        return `
          <ul class="workmate-unit-tree-list">
            ${nodes.map((node) => {
              const groupId = String(node?.group?.id || "").trim();
              const isRoot = Boolean(node?.isPolicyRoot);
              const openValue = isRoot ? "true" : groupId;
              const childCount = Number(node?.childCount || 0) || 0;
              const assignedUserCount = Number(node?.group?.assignedUserCount || 0) || 0;
              const ruleCount = Number(node?.group?.ruleCount || 0) || 0;
              const accrualEntryCount = Number(node?.group?.accrualEntryCount || 0) || 0;
              const requestCount = Number(node?.group?.requestCount || 0) || 0;
              const deleteDisabled = childCount > 0
                || assignedUserCount > 0
                || ruleCount > 0
                || accrualEntryCount > 0
                || requestCount > 0;
              const deleteTitle = deleteDisabled
                ? "하위 정책, 부여 이력, 발생 규칙 또는 휴가 신청 이력이 있는 정책은 삭제할 수 없습니다."
                : "휴가정책 삭제";
              const actionsMarkup = `
                <button class="outline-button workmate-unit-add-child-button" data-management-leave-group-open="${escapeAttribute(openValue)}" type="button">
                  하위 정책 추가
                </button>
                ${!isRoot ? `
                  <button
                    class="icon-button table-inline-icon-button workmate-worksite-record-action"
                    data-management-leave-group-edit="${escapeAttribute(groupId)}"
                    type="button"
                    aria-label="휴가정책 관리"
                    title="휴가정책 관리"
                  >
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="2.6"></circle>
                      <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                    </svg>
                  </button>
                ` : ""}
                ${!isRoot ? `
                  <button
                    class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button"
                    data-management-leave-group-delete="${escapeAttribute(groupId)}"
                    type="button"
                    aria-label="휴가정책 삭제"
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
                  <article class="workmate-unit-card${isRoot ? " is-locked" : ""}">
                    <div class="workmate-unit-card-row">
                      <div class="workmate-unit-card-title">
                        <strong>${escapeHtml(node?.group?.name || "휴가정책")}</strong>
                        <span>${escapeHtml(isRoot ? "최상위 정책을 추가해 계층을 구성합니다." : node?.group?.description || node?.parentName || "휴가정책")}</span>
                      </div>
                      <div class="workmate-unit-card-meta">
                        <span>${escapeHtml(`하위 정책 ${formatNumber(node?.childCount || 0)}개`)}</span>
                        ${isRoot ? `<span>${escapeHtml(`전체 정책 ${formatNumber(model.totalCount)}개`)}</span>` : `<span>${escapeHtml(`초과 제한 ${formatLeaveAmount(node?.group?.negativeLimitDays || 0)}`)}</span>`}
                      </div>
                      <small class="workmate-unit-card-path">${escapeHtml(node?.pathLabel || node?.group?.name || "휴가정책")}</small>
                      <div class="workmate-unit-card-actions">
                        ${actionsMarkup}
                      </div>
                    </div>
                  </article>
                  ${Array.isArray(node?.children) && node.children.length > 0 ? renderLeavePolicyTreeNodes(node.children) : ""}
                </li>
              `;
            }).join("")}
          </ul>
        `;
      }

      return `
        <div class="workmate-unit-tree workmate-leave-policy-tree">
          ${renderLeavePolicyTreeNodes(model.rootNodes)}
        </div>
      `;
    }

    return Object.freeze({
      getActiveLeaveGroups,
      getLeaveGroupParentId,
      renderLeaveGroupModal,
      renderLeaveGroupOptions,
      renderLeaveGroupPathOptions,
      renderLeaveGroupRecords,
    });
  }

  return Object.freeze({ create });
});
