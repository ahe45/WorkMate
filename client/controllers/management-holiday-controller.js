(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementHolidayController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementHolidayDraft,
      createEmptyManagementHolidayDraft,
      CURRENT_YEAR,
      loadManagementHolidayData,
      renderWorkspacePage,
      state,
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementHolidayDraft !== "function"
      || typeof createEmptyManagementHolidayDraft !== "function"
      || typeof loadManagementHolidayData !== "function"
      || typeof renderWorkspacePage !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementHolidayController requires holiday dependencies.");
    }

    function createManagementHolidayDraftFromItem(item = {}) {
      return createDefaultManagementHolidayDraft({
        holidayDate: String(item?.anchorDate || item?.date || "").trim(),
        holidayId: String(item?.id || "").trim(),
        name: String(item?.name || "").trim(),
        repeatUnit: String(item?.repeatUnit || "NONE").trim().toUpperCase() || "NONE",
      });
    }

    function getManagementHolidayById(holidayId = "") {
      const normalizedHolidayId = String(holidayId || "").trim();

      if (!normalizedHolidayId) {
        return null;
      }

      return (Array.isArray(state.managementHolidayData?.items) ? state.managementHolidayData.items : [])
        .find((item) => item?.isCustom && String(item?.id || "").trim() === normalizedHolidayId) || null;
    }

    function openManagementHolidayModal(holidayId = "") {
      const normalizedHolidayId = String(holidayId || "").trim();
      const targetHoliday = getManagementHolidayById(normalizedHolidayId);

      state.managementHolidayDraft = targetHoliday
        ? createManagementHolidayDraftFromItem(targetHoliday)
        : createEmptyManagementHolidayDraft(state.managementHolidayYear || CURRENT_YEAR);
      state.managementHolidayModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-holiday-date")?.focus();
      });
    }

    function closeManagementHolidayModal() {
      if (!state.managementHolidayModalOpen) {
        return;
      }

      state.managementHolidayModalOpen = false;
      renderWorkspacePage();
    }

    function resetManagementHolidayDraft() {
      const targetHolidayId = String(state.managementHolidayDraft?.holidayId || "").trim();
      const targetHoliday = getManagementHolidayById(targetHolidayId);

      state.managementHolidayDraft = targetHoliday
        ? createManagementHolidayDraftFromItem(targetHoliday)
        : createEmptyManagementHolidayDraft(state.managementHolidayYear || CURRENT_YEAR);
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-holiday-date")?.focus();
      });
    }

    async function submitManagementHolidayForm() {
      const form = document.getElementById("management-holiday-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("지정 공휴일 폼을 찾을 수 없습니다.");
      }

      const formData = new FormData(form);
      const holidayDate = String(formData.get("holidayDate") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const repeatUnit = String(formData.get("repeatUnit") || "NONE").trim().toUpperCase() || "NONE";
      const targetHolidayId = String(state.managementHolidayDraft?.holidayId || "").trim();
      const selectedYear = Math.max(1900, Math.min(2100, Number(state.managementHolidayYear || CURRENT_YEAR) || CURRENT_YEAR));

      if (!holidayDate) {
        throw new Error("공휴일 날짜를 선택하세요.");
      }

      if (!name) {
        throw new Error("공휴일명을 입력하세요.");
      }

      if (!targetHolidayId && !holidayDate.startsWith(`${selectedYear}-`)) {
        throw new Error("조회 중인 연도 안에서 지정 공휴일을 추가하세요.");
      }

      const savedHoliday = await api.requestWithAutoRefresh(
        targetHolidayId
          ? `/v1/orgs/${state.selectedOrganizationId}/holidays/custom/${targetHolidayId}`
          : `/v1/orgs/${state.selectedOrganizationId}/holidays/custom`,
        {
          body: JSON.stringify({
            holidayDate,
            name,
            repeatUnit,
          }),
          method: targetHolidayId ? "PATCH" : "POST",
        },
      );

      state.managementHolidayDraft = createManagementHolidayDraftFromItem(savedHoliday);
      state.managementHolidayModalOpen = true;
      await loadManagementHolidayData({ force: true, year: selectedYear });
      renderWorkspacePage();
      return savedHoliday;
    }

    async function deleteManagementHoliday(holidayId = "") {
      const normalizedHolidayId = String(holidayId || "").trim();
      const items = Array.isArray(state.managementHolidayData?.items) ? state.managementHolidayData.items : [];
      const targetHoliday = items.find((item) => item?.isCustom && String(item?.id || "").trim() === normalizedHolidayId) || null;

      if (!normalizedHolidayId || !targetHoliday) {
        return;
      }

      const confirmed = window.confirm(targetHoliday?.isRecurring
        ? `"${targetHoliday.name || "지정 공휴일"}" 반복 규칙을 삭제하시겠습니까?\n모든 반복 일정이 함께 삭제됩니다.`
        : `"${targetHoliday.name || "지정 공휴일"}"을(를) 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/holidays/custom/${normalizedHolidayId}`, {
        method: "DELETE",
      });

      await loadManagementHolidayData({ force: true, year: state.managementHolidayYear || CURRENT_YEAR });
      renderWorkspacePage();
    }

    return Object.freeze({
      createManagementHolidayDraftFromItem,
      getManagementHolidayById,
      openManagementHolidayModal,
      closeManagementHolidayModal,
      resetManagementHolidayDraft,
      submitManagementHolidayForm,
      deleteManagementHoliday,
    });
  }

  return Object.freeze({ create });
});
