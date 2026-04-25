(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementJobTitleController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementJobTitleDraft,
      currentPage,
      normalizeManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      state,
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementJobTitleDraft !== "function"
      || typeof normalizeManagementSection !== "function"
      || typeof refreshWorkspaceData !== "function"
      || typeof renderWorkspacePage !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementJobTitleController requires job title dependencies.");
    }

    let managementJobTitleDragState = {
      draggedId: "",
      overId: "",
      position: "",
    };

    function createEmptyManagementJobTitleDraft() {
      return createDefaultManagementJobTitleDraft({
        initialUnitIds: [],
        unitIds: [],
      });
    }

    function createManagementJobTitleDraftFromRecord(jobTitle = {}) {
      const unitIds = Array.isArray(jobTitle?.unitIds)
        ? jobTitle.unitIds
        : Array.isArray(jobTitle?.units)
          ? jobTitle.units.map((unit) => String(unit?.id || "").trim())
          : [];

      return createDefaultManagementJobTitleDraft({
        initialName: String(jobTitle?.name || "").trim(),
        initialUnitIds: unitIds,
        jobTitleId: String(jobTitle?.id || "").trim(),
        name: String(jobTitle?.name || "").trim(),
        unitIds,
      });
    }

    function getManagementJobTitleById(jobTitleId = "") {
      const normalizedJobTitleId = String(jobTitleId || "").trim();

      if (!normalizedJobTitleId) {
        return null;
      }

      return (Array.isArray(state.bootstrap?.jobTitles) ? state.bootstrap.jobTitles : [])
        .find((jobTitle) => String(jobTitle?.id || "").trim() === normalizedJobTitleId) || null;
    }

    function isManagementJobTitleReorderContext() {
      return currentPage === "workspace"
        && state.currentWorkspaceView === "management"
        && normalizeManagementSection(state.managementSection) === "job-titles";
    }

    function clearManagementJobTitleDragMarkers() {
      document.querySelectorAll(".workmate-title-record-grid-row.is-dragging, .workmate-title-record-grid-row.drag-before, .workmate-title-record-grid-row.drag-after").forEach((element) => {
        element.classList.remove("is-dragging", "drag-before", "drag-after");
      });
    }

    function resetManagementJobTitleDragState() {
      managementJobTitleDragState = {
        draggedId: "",
        overId: "",
        position: "",
      };
      clearManagementJobTitleDragMarkers();
    }

    function getManagementJobTitleOrderedIdsFromDom() {
      const grid = document.querySelector("[data-management-job-title-order]");
      const rawValue = String(grid?.dataset?.managementJobTitleOrder || "").trim();

      if (!rawValue) {
        return [];
      }

      return rawValue.split(",").map((value) => String(value || "").trim()).filter(Boolean);
    }

    function setManagementJobTitleDragMarker(row, position = "before") {
      if (!(row instanceof HTMLElement)) {
        clearManagementJobTitleDragMarkers();
        return;
      }

      document.querySelectorAll(".workmate-title-record-grid-row.drag-before, .workmate-title-record-grid-row.drag-after").forEach((element) => {
        if (element !== row) {
          element.classList.remove("drag-before", "drag-after");
        }
      });

      row.classList.toggle("drag-before", position === "before");
      row.classList.toggle("drag-after", position === "after");
    }

    function moveManagementJobTitleOrder(orderedIds = [], draggedId = "", targetId = "", position = "before") {
      const normalizedDraggedId = String(draggedId || "").trim();
      const normalizedTargetId = String(targetId || "").trim();
      const sourceIds = Array.from(new Set((Array.isArray(orderedIds) ? orderedIds : []).map((value) => String(value || "").trim()).filter(Boolean)));

      if (!normalizedDraggedId || !normalizedTargetId || normalizedDraggedId === normalizedTargetId) {
        return sourceIds;
      }

      const nextIds = sourceIds.filter((value) => value !== normalizedDraggedId);
      const targetIndex = nextIds.indexOf(normalizedTargetId);

      if (targetIndex < 0) {
        return sourceIds;
      }

      nextIds.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, normalizedDraggedId);
      return nextIds;
    }

    function areOrderedIdsEqual(left = [], right = []) {
      if (left.length !== right.length) {
        return false;
      }

      return left.every((value, index) => value === right[index]);
    }

    function syncManagementJobTitleSelectAllState(scope = null) {
      const form = scope instanceof HTMLFormElement
        ? scope
        : scope instanceof HTMLElement
          ? scope.closest("#management-job-title-form")
          : document.getElementById("management-job-title-form");

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const selectAllInput = form.querySelector('[data-management-job-title-select-all="true"]');
      const unitInputs = Array.from(form.querySelectorAll('[data-management-job-title-unit-option="true"]'));

      if (!(selectAllInput instanceof HTMLInputElement)) {
        return;
      }

      if (unitInputs.length === 0) {
        selectAllInput.checked = false;
        selectAllInput.disabled = true;
        selectAllInput.indeterminate = false;
        return;
      }

      const checkedCount = unitInputs.filter((input) => input instanceof HTMLInputElement && input.checked).length;
      selectAllInput.disabled = false;
      selectAllInput.checked = checkedCount === unitInputs.length;
      selectAllInput.indeterminate = checkedCount > 0 && checkedCount < unitInputs.length;
    }

    function getManagementJobTitleUnitInputs(scope = null) {
      const form = scope instanceof HTMLFormElement
        ? scope
        : scope instanceof HTMLElement
          ? scope.closest("#management-job-title-form")
          : document.getElementById("management-job-title-form");

      if (!(form instanceof HTMLFormElement)) {
        return [];
      }

      return Array.from(form.querySelectorAll('[data-management-job-title-unit-option="true"]'))
        .filter((input) => input instanceof HTMLInputElement);
    }

    function setManagementJobTitleDescendantsChecked(scope = null, unitInput = null, checked = false) {
      if (!(unitInput instanceof HTMLInputElement)) {
        return;
      }

      const descendantIds = String(unitInput.dataset.managementJobTitleUnitDescendants || "")
        .split(",")
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      if (descendantIds.length === 0) {
        return;
      }

      const unitInputs = getManagementJobTitleUnitInputs(scope);
      const descendantIdSet = new Set(descendantIds);

      unitInputs.forEach((input) => {
        if (descendantIdSet.has(String(input.value || "").trim())) {
          input.checked = checked;
          input.indeterminate = false;
        }
      });
    }

    function syncManagementJobTitleTreeState(scope = null) {
      const unitInputs = getManagementJobTitleUnitInputs(scope);

      if (unitInputs.length === 0) {
        syncManagementJobTitleSelectAllState(scope);
        return;
      }

      const inputByUnitId = new Map(unitInputs.map((input) => [String(input.value || "").trim(), input]));

      unitInputs.forEach((input) => {
        input.indeterminate = false;
      });

      const updateParentState = (unitId = "") => {
        const normalizedUnitId = String(unitId || "").trim();

        if (!normalizedUnitId) {
          return;
        }

        const parentInput = inputByUnitId.get(normalizedUnitId);

        if (!(parentInput instanceof HTMLInputElement)) {
          return;
        }

        const childInputs = unitInputs.filter((input) => String(input.dataset.managementJobTitleParentUnitId || "").trim() === normalizedUnitId);

        if (childInputs.length === 0) {
          return;
        }

        const allChecked = childInputs.every((input) => input.checked && !input.indeterminate);
        const someChecked = childInputs.some((input) => input.checked || input.indeterminate);

        parentInput.checked = allChecked;
        parentInput.indeterminate = someChecked && !allChecked;

        updateParentState(parentInput.dataset.managementJobTitleParentUnitId || "");
      };

      const distinctParentIds = Array.from(new Set(
        unitInputs
          .map((input) => String(input.dataset.managementJobTitleParentUnitId || "").trim())
          .filter(Boolean),
      ));

      distinctParentIds.forEach((parentUnitId) => {
        updateParentState(parentUnitId);
      });

      syncManagementJobTitleSelectAllState(scope);
    }

    function openManagementJobTitleModal(jobTitleId = "") {
      if (jobTitleId) {
        const jobTitle = getManagementJobTitleById(jobTitleId);

        if (jobTitle) {
          state.managementJobTitleDraft = createManagementJobTitleDraftFromRecord(jobTitle);
        }
      } else {
        state.managementJobTitleDraft = createEmptyManagementJobTitleDraft();
      }

      state.managementJobTitleModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        getManagementJobTitleUnitInputs().forEach((input) => {
          if (input.checked) {
            setManagementJobTitleDescendantsChecked(input.closest("#management-job-title-form"), input, true);
          }
        });
        syncManagementJobTitleTreeState();
        syncManagementJobTitleSelectAllState();
        document.getElementById("management-job-title-name")?.focus();
      });
    }

    function closeManagementJobTitleModal() {
      if (!state.managementJobTitleModalOpen) {
        return;
      }

      state.managementJobTitleModalOpen = false;
      renderWorkspacePage();
    }

    function resetManagementJobTitleDraft() {
      const draftJobTitleId = String(state.managementJobTitleDraft?.jobTitleId || "").trim();

      if (draftJobTitleId) {
        const jobTitle = getManagementJobTitleById(draftJobTitleId);
        state.managementJobTitleDraft = jobTitle
          ? createManagementJobTitleDraftFromRecord(jobTitle)
          : createEmptyManagementJobTitleDraft();
      } else {
        state.managementJobTitleDraft = createEmptyManagementJobTitleDraft();
      }

      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        getManagementJobTitleUnitInputs().forEach((input) => {
          if (input.checked) {
            setManagementJobTitleDescendantsChecked(input.closest("#management-job-title-form"), input, true);
          }
        });
        syncManagementJobTitleTreeState();
        syncManagementJobTitleSelectAllState();
      });
    }

    async function submitManagementJobTitleForm() {
      const form = document.getElementById("management-job-title-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("직급 설정 폼을 찾을 수 없습니다.");
      }

      const formData = new FormData(form);
      const draft = state.managementJobTitleDraft || createDefaultManagementJobTitleDraft();
      const payload = {
        name: String(formData.get("name") || "").trim(),
        unitIds: formData.getAll("unitIds").map((value) => String(value || "").trim()).filter(Boolean),
      };

      if (!payload.name) {
        throw new Error("직급명을 입력하세요.");
      }

      if (payload.unitIds.length === 0) {
        throw new Error("적용 조직을 하나 이상 선택하세요.");
      }

      const targetJobTitleId = String(draft.jobTitleId || "").trim();

      await api.requestWithAutoRefresh(
        targetJobTitleId
          ? `/v1/orgs/${state.selectedOrganizationId}/job-titles/${targetJobTitleId}`
          : `/v1/orgs/${state.selectedOrganizationId}/job-titles`,
        {
          body: JSON.stringify(payload),
          method: targetJobTitleId ? "PATCH" : "POST",
        },
      );

      state.managementJobTitleDraft = createEmptyManagementJobTitleDraft();
      state.managementJobTitleModalOpen = false;
      await refreshWorkspaceData();
    }

    async function deleteManagementJobTitle(jobTitleId = "") {
      const normalizedJobTitleId = String(jobTitleId || "").trim();
      const jobTitle = getManagementJobTitleById(normalizedJobTitleId);

      if (!normalizedJobTitleId || !jobTitle) {
        return;
      }

      const confirmed = window.confirm(`"${jobTitle.name || "직급"}"을(를) 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/job-titles/${normalizedJobTitleId}`, {
        method: "DELETE",
      });

      if (String(state.managementJobTitleDraft?.jobTitleId || "").trim() === normalizedJobTitleId) {
        state.managementJobTitleDraft = createEmptyManagementJobTitleDraft();
        state.managementJobTitleModalOpen = false;
      }

      await refreshWorkspaceData();
    }

    async function reorderManagementJobTitles(orderedIds = []) {
      const normalizedOrderedIds = Array.from(new Set((Array.isArray(orderedIds) ? orderedIds : []).map((value) => String(value || "").trim()).filter(Boolean)));

      if (!state.selectedOrganizationId || normalizedOrderedIds.length === 0) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/job-titles/reorder`, {
        body: JSON.stringify({
          orderedIds: normalizedOrderedIds,
        }),
        method: "POST",
      });

      await refreshWorkspaceData();
    }

    function handleManagementJobTitleDragStart(event) {
      if (!isManagementJobTitleReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const row = event.target.closest("[data-management-job-title-row]");

      if (!(row instanceof HTMLElement)) {
        return;
      }

      const draggedId = String(row.dataset.managementJobTitleRow || "").trim();
      const orderedIds = getManagementJobTitleOrderedIdsFromDom();

      if (!draggedId || orderedIds.length < 2) {
        event.preventDefault();
        return;
      }

      managementJobTitleDragState = {
        draggedId,
        overId: "",
        position: "",
      };
      clearManagementJobTitleDragMarkers();
      row.classList.add("is-dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
      }
    }

    function handleManagementJobTitleDragOver(event) {
      if (!isManagementJobTitleReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const draggedId = String(managementJobTitleDragState.draggedId || "").trim();

      if (!draggedId) {
        return;
      }

      const row = event.target.closest("[data-management-job-title-row]");

      if (!(row instanceof HTMLElement)) {
        return;
      }

      const targetId = String(row.dataset.managementJobTitleRow || "").trim();

      if (!targetId || targetId === draggedId) {
        row.classList.remove("drag-before", "drag-after");
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      const rect = row.getBoundingClientRect();
      const position = event.clientY >= rect.top + rect.height / 2 ? "after" : "before";
      managementJobTitleDragState.overId = targetId;
      managementJobTitleDragState.position = position;
      setManagementJobTitleDragMarker(row, position);
    }

    async function handleManagementJobTitleDrop(event) {
      if (!isManagementJobTitleReorderContext() || !(event.target instanceof Element)) {
        return;
      }

      const draggedId = String(managementJobTitleDragState.draggedId || "").trim();
      const row = event.target.closest("[data-management-job-title-row]");

      if (!draggedId || !(row instanceof HTMLElement)) {
        resetManagementJobTitleDragState();
        return;
      }

      const targetId = String(row.dataset.managementJobTitleRow || "").trim();
      const position = managementJobTitleDragState.position === "after" ? "after" : "before";
      const orderedIds = getManagementJobTitleOrderedIdsFromDom();
      const nextOrderedIds = moveManagementJobTitleOrder(orderedIds, draggedId, targetId, position);
      resetManagementJobTitleDragState();
      event.preventDefault();

      if (!targetId || areOrderedIdsEqual(orderedIds, nextOrderedIds)) {
        return;
      }

      await reorderManagementJobTitles(nextOrderedIds);
    }

    function handleManagementJobTitleDragEnd() {
      resetManagementJobTitleDragState();
    }

    return Object.freeze({
      createEmptyManagementJobTitleDraft,
      createManagementJobTitleDraftFromRecord,
      getManagementJobTitleById,
      isManagementJobTitleReorderContext,
      clearManagementJobTitleDragMarkers,
      resetManagementJobTitleDragState,
      getManagementJobTitleOrderedIdsFromDom,
      setManagementJobTitleDragMarker,
      moveManagementJobTitleOrder,
      areOrderedIdsEqual,
      syncManagementJobTitleSelectAllState,
      getManagementJobTitleUnitInputs,
      setManagementJobTitleDescendantsChecked,
      syncManagementJobTitleTreeState,
      openManagementJobTitleModal,
      closeManagementJobTitleModal,
      resetManagementJobTitleDraft,
      submitManagementJobTitleForm,
      deleteManagementJobTitle,
      reorderManagementJobTitles,
      handleManagementJobTitleDragStart,
      handleManagementJobTitleDragOver,
      handleManagementJobTitleDrop,
      handleManagementJobTitleDragEnd,
    });
  }

  return Object.freeze({ create });
});
