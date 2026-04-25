(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionManagementClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      currentPage,
      CURRENT_YEAR,
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementWorkPolicyModal,
      closeManagementUnitModal,
      closeManagementWorkPolicyTimePickers,
      closeManagementWorksiteModal,
      deleteManagementHoliday,
      deleteManagementJobTitle,
      deleteManagementWorkPolicy,
      deleteManagementUnit,
      deleteManagementWorksite,
      handleManagementWorkPolicyTimeOptionClick,
      handleProtectedFailure,
      loadHolidayYear,
      loadManagementHolidayData,
      normalizeManagementSection,
      openManagementHolidayModal,
      openManagementJobTitleModal,
      openManagementWorkPolicyModal,
      openManagementUnitEditModal,
      openManagementUnitModal,
      openManagementWorksiteModal,
      renderWorkspacePage,
      renderers,
      resetManagementHolidayDraft,
      resetManagementJobTitleDraft,
      resetManagementWorkPolicyDraft,
      resetManagementUnitDraft,
      resetManagementWorksiteDraft,
      selectManagementWorksiteSearchResult,
      setManagementWorkPolicyTimePickerOpen,
      state,
      syncManagementWorksiteDraftFromDom,
      updateManagementWorkPolicyStageMetrics,
    } = dependencies;

    if (!renderWorkspacePage || !renderers || !state) {
      throw new Error("WorkMateAppInteractionManagementClickHandler requires management click dependencies.");
    }

    function isManagementView() {
      return currentPage === "workspace" && state.currentWorkspaceView === "management";
    }

    function isManagementSection(section = "") {
      return normalizeManagementSection(state.managementSection) === section;
    }

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
      const managementHolidayResetButton = target.closest("[data-management-holiday-reset]");
      const managementHolidayYearNavButton = target.closest("[data-management-holiday-year-nav]");
      const managementJobTitleCloseButton = target.closest("[data-management-job-title-close]");
      const managementJobTitleDeleteButton = target.closest("[data-management-job-title-delete]");
      const managementJobTitleOpenButton = target.closest("[data-management-job-title-open]");
      const managementJobTitleResetButton = target.closest("[data-management-job-title-reset]");
      const managementSectionButton = target.closest("[data-management-section]");
      const managementUnitCloseButton = target.closest("[data-management-unit-close]");
      const managementUnitDeleteButton = target.closest("[data-management-unit-delete]");
      const managementUnitEditButton = target.closest("[data-management-unit-edit]");
      const managementUnitOpenButton = target.closest("[data-management-unit-open]");
      const managementUnitResetButton = target.closest("[data-management-unit-reset]");
      const managementWorkPolicyAdjustmentAddButton = target.closest("[data-management-work-policy-adjustment-add]");
      const managementWorkPolicyCloseButton = target.closest("[data-management-work-policy-close]");
      const managementWorkPolicyDeleteButton = target.closest("[data-management-work-policy-delete]");
      const managementWorkPolicyOpenButton = target.closest("[data-management-work-policy-open]");
      const managementWorkPolicyResetButton = target.closest("[data-management-work-policy-reset]");
      const managementWorkPolicyTimeOptionButton = target.closest("[data-management-work-policy-time-option]");
      const managementWorkPolicyTimePicker = target.closest("[data-management-work-policy-time-picker]");
      const managementWorkPolicyTimeToggleButton = target.closest("[data-management-work-policy-time-toggle]");
      const managementWorksiteCloseButton = target.closest("[data-management-worksite-close]");
      const managementWorksiteDeleteButton = target.closest("[data-management-worksite-delete]");
      const managementWorksiteOpenButton = target.closest("[data-management-worksite-open]");
      const managementWorksiteResetButton = target.closest("[data-management-worksite-reset]");
      const managementWorksiteSearchResultButton = target.closest("[data-management-worksite-search-result]");
      const managementWorksiteSelectButton = target.closest("[data-management-worksite-select]");

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

      if (managementWorkPolicyCloseButton) {
        closeManagementWorkPolicyModal();
        return true;
      }

      if (managementWorksiteCloseButton) {
        closeManagementWorksiteModal();
        return true;
      }

      if (isManagementSection("work-schedules")) {
        if (managementWorkPolicyAdjustmentAddButton) {
          const list = document.querySelector("[data-management-work-policy-adjustment-list='true']");

          if (list instanceof HTMLElement && typeof renderers.renderManagementWorkPolicyAdjustmentRow === "function") {
            const nextIndex = list.querySelectorAll(".workmate-work-policy-adjustment-row").length;
            list.insertAdjacentHTML("beforeend", renderers.renderManagementWorkPolicyAdjustmentRow({}, nextIndex));
            updateManagementWorkPolicyStageMetrics();
          }

          return true;
        }

        if (managementWorkPolicyTimeToggleButton) {
          const picker = managementWorkPolicyTimeToggleButton.closest("[data-management-work-policy-time-picker]");

          if (picker instanceof HTMLElement) {
            const isOpen = picker.classList.contains("is-open");
            closeManagementWorkPolicyTimePickers(picker);
            setManagementWorkPolicyTimePickerOpen(picker, !isOpen);
          }

          return true;
        }

        if (managementWorkPolicyTimeOptionButton) {
          handleManagementWorkPolicyTimeOptionClick(managementWorkPolicyTimeOptionButton);
          return true;
        }

        if (!managementWorkPolicyTimePicker) {
          closeManagementWorkPolicyTimePickers();
        }
      }

      if (managementSectionButton) {
        syncManagementWorksiteDraftFromDom();
        closeManagementWorkPolicyTimePickers();
        state.managementHolidayModalOpen = false;
        state.managementJobTitleModalOpen = false;
        state.managementWorkPolicyModalOpen = false;
        state.managementUnitModalOpen = false;
        state.managementWorksiteModalOpen = false;
        state.managementSection = normalizeManagementSection(managementSectionButton.dataset.managementSection || "");

        if (state.managementSection === "holidays") {
          loadManagementHolidayData({ force: false }).then(() => {
            renderWorkspacePage();
          }).catch((error) => {
            handleHolidayLoadFailure(error, "공휴일 정보를 불러오지 못했습니다.");
          });
        }

        renderWorkspacePage();
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

      if (managementHolidayResetButton && isManagementSection("holidays")) {
        resetManagementHolidayDraft();
        return true;
      }

      if (managementWorkPolicyOpenButton && isManagementSection("work-schedules")) {
        openManagementWorkPolicyModal(managementWorkPolicyOpenButton.dataset.managementWorkPolicyOpen || "");
        return true;
      }

      if (managementWorkPolicyDeleteButton && isManagementSection("work-schedules")) {
        await deleteManagementWorkPolicy(managementWorkPolicyDeleteButton.dataset.managementWorkPolicyDelete || "");
        return true;
      }

      if (managementWorkPolicyResetButton && isManagementSection("work-schedules")) {
        resetManagementWorkPolicyDraft();
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

      if (managementJobTitleResetButton) {
        resetManagementJobTitleDraft();
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

      if (managementUnitResetButton) {
        resetManagementUnitDraft();
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

      if (managementWorksiteResetButton) {
        resetManagementWorksiteDraft();
        return true;
      }

      if (managementWorksiteSearchResultButton) {
        selectManagementWorksiteSearchResult(managementWorksiteSearchResultButton.dataset.managementWorksiteSearchResult || "");
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
