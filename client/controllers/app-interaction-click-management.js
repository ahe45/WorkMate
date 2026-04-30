(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionManagementClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      currentPage,
      CURRENT_YEAR,
      MANAGEMENT_SECTION_STORAGE_KEY,
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementModalConfirm,
      closeManagementUnitModal,
      closeManagementWorkPolicyTimePickers,
      closeManagementWorksiteModal,
      closeManagementWorksiteSearchModal,
      deleteManagementHoliday,
      deleteManagementJobTitle,
      deleteManagementUnit,
      deleteManagementWorksite,
      handleManagementModalConfirmAction,
      handleProtectedFailure,
      loadHolidayYear,
      loadManagementHolidayData,
      normalizeManagementSection,
      openManagementHolidayModal,
      openManagementJobTitleModal,
      openManagementUnitEditModal,
      openManagementUnitModal,
      openManagementWorksiteModal,
      renderWorkspacePage,
      renderers,
      refreshWorkspaceData,
      setInlineMessage,
      showToast,
      selectManagementWorksiteSearchResult,
      runWithManagementModalGuard,
      state,
      syncManagementWorksiteDraftFromDom,
      syncManagementModalDirtyState,
    } = dependencies;
    const managementLeaveClickModule = globalThis.WorkMateAppInteractionManagementLeaveClickHandler
      || (typeof require === "function" ? require("./app-interaction-click-management-leave.js") : null);
    const managementEmployeeClickModule = globalThis.WorkMateManagementEmployeeClickActions
      || (typeof require === "function" ? require("./management-employee-click-actions.js") : null);
    const managementWorkPolicyClickModule = globalThis.WorkMateManagementWorkPolicyClickActions
      || (typeof require === "function" ? require("./management-work-policy-click-actions.js") : null);

    if (!renderWorkspacePage || !renderers || !state) {
      throw new Error("WorkMateAppInteractionManagementClickHandler requires management click dependencies.");
    }

    if (!managementLeaveClickModule || typeof managementLeaveClickModule.create !== "function") {
      throw new Error("client/controllers/app-interaction-click-management-leave.js must be loaded before client/controllers/app-interaction-click-management.js.");
    }

    if (!managementEmployeeClickModule || typeof managementEmployeeClickModule.create !== "function") {
      throw new Error("client/controllers/management-employee-click-actions.js must be loaded before client/controllers/app-interaction-click-management.js.");
    }

    if (!managementWorkPolicyClickModule || typeof managementWorkPolicyClickModule.create !== "function") {
      throw new Error("client/controllers/management-work-policy-click-actions.js must be loaded before client/controllers/app-interaction-click-management.js.");
    }

    function isManagementView() {
      return currentPage === "workspace" && state.currentWorkspaceView === "management";
    }

    function isManagementSection(section = "") {
      return normalizeManagementSection(state.managementSection) === section;
    }

    const managementLeaveClickHandler = managementLeaveClickModule.create({
      api,
      handleProtectedFailure,
      isManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      setInlineMessage,
      showToast,
      state,
    });
    const {
      closeManagementLeaveGroupModal,
      closeManagementLeaveRuleModal,
      handleManagementLeaveClick,
    } = managementLeaveClickHandler;
    const managementEmployeeClickHandler = managementEmployeeClickModule.create({
      ...dependencies,
      isManagementSection,
    });
    const managementWorkPolicyClickHandler = managementWorkPolicyClickModule.create({
      ...dependencies,
      isManagementSection,
    });
    const {
      handleManagementEmployeeClick,
    } = managementEmployeeClickHandler;
    const {
      handleManagementWorkPolicyClick,
    } = managementWorkPolicyClickHandler;

    function handleHolidayLoadFailure(error, fallbackMessage) {
      if (!handleProtectedFailure(error)) {
        window.alert(error.message || fallbackMessage);
      }
    }

    async function handleDocumentClick(event) {
      if (!isManagementView()) {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return false;
      }

      const managementHolidayCloseButton = target.closest("[data-management-holiday-close]");
      const managementHolidayDeleteButton = target.closest("[data-management-holiday-delete]");
      const managementHolidayOpenButton = target.closest("[data-management-holiday-open]");
      const managementHolidayYearNavButton = target.closest("[data-management-holiday-year-nav]");
      const managementJobTitleCloseButton = target.closest("[data-management-job-title-close]");
      const managementJobTitleDeleteButton = target.closest("[data-management-job-title-delete]");
      const managementJobTitleOpenButton = target.closest("[data-management-job-title-open]");
      const managementModalConfirmActionButton = target.closest("[data-management-modal-confirm-action]");
      const managementModalConfirmCloseButton = target.closest("[data-management-modal-confirm-close]");
      const managementSectionButton = target.closest("[data-management-section]");
      const managementUnitCloseButton = target.closest("[data-management-unit-close]");
      const managementUnitDeleteButton = target.closest("[data-management-unit-delete]");
      const managementUnitEditButton = target.closest("[data-management-unit-edit]");
      const managementUnitOpenButton = target.closest("[data-management-unit-open]");
      const managementWorksiteCloseButton = target.closest("[data-management-worksite-close]");
      const managementWorksiteDeleteButton = target.closest("[data-management-worksite-delete]");
      const managementWorksiteOpenButton = target.closest("[data-management-worksite-open]");
      const managementWorksiteSearchModalCloseButton = target.closest("[data-management-worksite-search-modal-close]");
      const managementWorksiteSearchResultButton = target.closest("[data-management-worksite-search-result]");
      const managementWorksiteSelectButton = target.closest("[data-management-worksite-select]");

      if (managementModalConfirmActionButton) {
        await handleManagementModalConfirmAction(managementModalConfirmActionButton.dataset.managementModalConfirmAction || "");
        return true;
      }

      if (managementModalConfirmCloseButton) {
        closeManagementModalConfirm();
        return true;
      }

      if (await handleManagementEmployeeClick(target)) {
        return true;
      }

      if (managementUnitCloseButton) {
        closeManagementUnitModal();
        return true;
      }

      if (managementJobTitleCloseButton) {
        closeManagementJobTitleModal();
        return true;
      }

      if (managementHolidayCloseButton) {
        closeManagementHolidayModal();
        return true;
      }

      if (managementWorksiteCloseButton) {
        closeManagementWorksiteModal();
        return true;
      }

      if (managementWorksiteSearchModalCloseButton) {
        closeManagementWorksiteSearchModal();
        return true;
      }

      if (await handleManagementWorkPolicyClick(target)) {
        return true;
      }

      if (managementSectionButton) {
        const nextSection = normalizeManagementSection(managementSectionButton.dataset.managementSection || "");

        await runWithManagementModalGuard(async () => {
          syncManagementWorksiteDraftFromDom();
          closeManagementWorkPolicyTimePickers();
          closeManagementLeaveGroupModal();
          state.managementLeaveManualGrantModalOpen = false;
          closeManagementLeaveRuleModal();
          state.managementSection = nextSection;

          if (MANAGEMENT_SECTION_STORAGE_KEY) {
            window.sessionStorage.setItem(MANAGEMENT_SECTION_STORAGE_KEY, state.managementSection);
          }

          if (state.managementSection === "holidays") {
            loadManagementHolidayData({ force: false }).then(() => {
              renderWorkspacePage();
            }).catch((error) => {
              handleHolidayLoadFailure(error, "공휴일 정보를 불러오지 못했습니다.");
            });
          }

          renderWorkspacePage();
        });
        return true;
      }

      if (await handleManagementLeaveClick(target)) {
        return true;
      }

      if (managementHolidayOpenButton && isManagementSection("holidays")) {
        openManagementHolidayModal(managementHolidayOpenButton.dataset.managementHolidayOpen || "");
        return true;
      }

      if (managementHolidayYearNavButton && isManagementSection("holidays")) {
        const offset = Number(managementHolidayYearNavButton.dataset.managementHolidayYearNav || 0);
        const nextYear = Math.max(1900, Math.min(2100, Number(state.managementHolidayYear || CURRENT_YEAR) + offset));
        await loadHolidayYear(nextYear);
        return true;
      }

      if (managementHolidayDeleteButton && isManagementSection("holidays")) {
        await deleteManagementHoliday(managementHolidayDeleteButton.dataset.managementHolidayDelete || "");
        return true;
      }

      if (managementJobTitleOpenButton) {
        openManagementJobTitleModal(managementJobTitleOpenButton.dataset.managementJobTitleOpen || "");
        return true;
      }

      if (managementJobTitleDeleteButton) {
        await deleteManagementJobTitle(managementJobTitleDeleteButton.dataset.managementJobTitleDelete || "");
        return true;
      }

      if (managementUnitOpenButton) {
        openManagementUnitModal(managementUnitOpenButton.dataset.managementUnitOpen || "");
        return true;
      }

      if (managementUnitEditButton) {
        openManagementUnitEditModal(managementUnitEditButton.dataset.managementUnitEdit || "");
        return true;
      }

      if (managementUnitDeleteButton) {
        await deleteManagementUnit(managementUnitDeleteButton.dataset.managementUnitDelete || "");
        return true;
      }

      if (managementWorksiteOpenButton) {
        openManagementWorksiteModal(managementWorksiteOpenButton.dataset.managementWorksiteOpen || "");
        return true;
      }

      if (managementWorksiteDeleteButton) {
        await deleteManagementWorksite(managementWorksiteDeleteButton.dataset.managementWorksiteDelete || "");
        return true;
      }

      if (managementWorksiteSearchResultButton) {
        selectManagementWorksiteSearchResult(managementWorksiteSearchResultButton.dataset.managementWorksiteSearchResult || "");
        syncManagementModalDirtyState("worksite");
        return true;
      }

      if (managementWorksiteSelectButton) {
        openManagementWorksiteModal(managementWorksiteSelectButton.dataset.managementWorksiteSelect || "");
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleDocumentClick,
    });
  }

  return Object.freeze({ create });
});
