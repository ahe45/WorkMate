(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementUnitController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementUnitDraft,
      refreshWorkspaceData,
      renderWorkspacePage,
      state,
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementUnitDraft !== "function"
      || typeof refreshWorkspaceData !== "function"
      || typeof renderWorkspacePage !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementUnitController requires unit dependencies.");
    }

    function normalizeManagementUnitParentDraftValue(parentUnitId = "") {
      const normalizedParentUnitId = String(parentUnitId || "").trim();

      if (!normalizedParentUnitId) {
        return "";
      }

      const parentUnit = (Array.isArray(state.bootstrap?.units) ? state.bootstrap.units : [])
        .find((unit) => String(unit?.id || "").trim() === normalizedParentUnitId) || null;
      return String(parentUnit?.code || "").trim().toUpperCase() === "ROOT"
        && !String(parentUnit?.parentUnitId || "").trim()
        ? ""
        : normalizedParentUnitId;
    }

    function createEmptyManagementUnitDraft(parentUnitId = "") {
      const normalizedParentUnitId = normalizeManagementUnitParentDraftValue(parentUnitId);
      return createDefaultManagementUnitDraft({
        initialName: "",
        initialParentUnitId: normalizedParentUnitId,
        parentUnitId: normalizedParentUnitId,
      });
    }

    function createManagementUnitDraftFromUnit(unit = {}) {
      const parentUnitId = normalizeManagementUnitParentDraftValue(unit?.parentUnitId);
      const name = String(unit?.name || "").trim();
      return createDefaultManagementUnitDraft({
        initialName: name,
        initialParentUnitId: parentUnitId,
        name,
        parentUnitId,
        unitId: String(unit?.id || "").trim(),
      });
    }

    function getManagementUnitById(unitId = "") {
      const normalizedUnitId = String(unitId || "").trim();

      if (!normalizedUnitId) {
        return null;
      }

      return (Array.isArray(state.bootstrap?.units) ? state.bootstrap.units : [])
        .find((unit) => String(unit?.id || "").trim() === normalizedUnitId) || null;
    }

    function openManagementUnitModal(parentUnitId = "") {
      state.managementUnitDraft = createEmptyManagementUnitDraft(parentUnitId);
      state.managementUnitModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-unit-name")?.focus();
      });
    }

    function openManagementUnitEditModal(unitId = "") {
      const unit = getManagementUnitById(unitId);

      if (!unit) {
        return;
      }

      state.managementUnitDraft = createManagementUnitDraftFromUnit(unit);
      state.managementUnitModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-unit-name")?.focus();
      });
    }

    function closeManagementUnitModal() {
      if (!state.managementUnitModalOpen) {
        return;
      }

      state.managementUnitModalOpen = false;
      renderWorkspacePage();
    }

    function resetManagementUnitDraft() {
      const draftUnitId = String(state.managementUnitDraft?.unitId || "").trim();

      if (draftUnitId) {
        const unit = getManagementUnitById(draftUnitId);
        state.managementUnitDraft = unit
          ? createManagementUnitDraftFromUnit(unit)
          : createEmptyManagementUnitDraft(state.managementUnitDraft?.initialParentUnitId || "");
      } else {
        state.managementUnitDraft = createEmptyManagementUnitDraft(state.managementUnitDraft?.initialParentUnitId || "");
      }

      renderWorkspacePage();
    }

    async function submitManagementUnitForm() {
      const form = document.getElementById("management-unit-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("조직 관리 폼을 찾을 수 없습니다.");
      }

      const formData = new FormData(form);
      const draft = state.managementUnitDraft || createDefaultManagementUnitDraft();
      const payload = {
        name: String(formData.get("name") || "").trim(),
        parentUnitId: String(formData.get("parentUnitId") || "").trim() || null,
      };

      if (!payload.name) {
        throw new Error("조직명을 입력하세요.");
      }

      const targetUnitId = String(draft.unitId || "").trim();

      const savedUnit = await api.requestWithAutoRefresh(
        targetUnitId
          ? `/v1/orgs/${state.selectedOrganizationId}/units/${targetUnitId}`
          : `/v1/orgs/${state.selectedOrganizationId}/units`,
        {
          body: JSON.stringify(payload),
          method: targetUnitId ? "PATCH" : "POST",
        },
      );

      state.managementUnitDraft = createManagementUnitDraftFromUnit(savedUnit);
      state.managementUnitModalOpen = true;
      await refreshWorkspaceData();
      return savedUnit;
    }

    async function deleteManagementUnit(unitId = "") {
      const normalizedUnitId = String(unitId || "").trim();
      const targetUnit = getManagementUnitById(normalizedUnitId);

      if (!normalizedUnitId || !targetUnit) {
        return;
      }

      const confirmed = window.confirm(`"${targetUnit.name || "조직"}"을(를) 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/units/${normalizedUnitId}`, {
        method: "DELETE",
      });

      const currentDraftParentUnitId = String(state.managementUnitDraft?.parentUnitId || "").trim();
      const currentDraftInitialParentUnitId = String(state.managementUnitDraft?.initialParentUnitId || "").trim();

      if (currentDraftParentUnitId === normalizedUnitId || currentDraftInitialParentUnitId === normalizedUnitId) {
        state.managementUnitDraft = createEmptyManagementUnitDraft();
        state.managementUnitModalOpen = false;
      }

      if (String(state.managementUnitDraft?.unitId || "").trim() === normalizedUnitId) {
        state.managementUnitDraft = createEmptyManagementUnitDraft();
        state.managementUnitModalOpen = false;
      }

      await refreshWorkspaceData();
    }

    return Object.freeze({
      normalizeManagementUnitParentDraftValue,
      createEmptyManagementUnitDraft,
      createManagementUnitDraftFromUnit,
      getManagementUnitById,
      openManagementUnitModal,
      openManagementUnitEditModal,
      closeManagementUnitModal,
      resetManagementUnitDraft,
      submitManagementUnitForm,
      deleteManagementUnit,
    });
  }

  return Object.freeze({ create });
});
