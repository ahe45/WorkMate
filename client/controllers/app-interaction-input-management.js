(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionManagementInputHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      CURRENT_YEAR,
      currentPage,
      loadHolidayYear,
      normalizeManagementSection,
      setManagementJobTitleDescendantsChecked,
      state,
      syncManagementJobTitleTreeState,
      syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry,
      updateManagementWorkPolicyStageMetrics,
      updateManagementWorksiteFormFields,
    } = dependencies;

    if (!state || typeof loadHolidayYear !== "function") {
      throw new Error("WorkMateAppInteractionManagementInputHandler requires management input dependencies.");
    }

    function isManagementSection(section = "") {
      return currentPage === "workspace"
        && state.currentWorkspaceView === "management"
        && normalizeManagementSection(state.managementSection) === section;
    }

    function handleDocumentInput(event) {
      if (currentPage !== "workspace") {
        return false;
      }

      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        if (isManagementSection("worksites")
          && target instanceof HTMLTextAreaElement
          && target.closest("#management-worksite-form")) {
          syncManagementWorksiteDraftFromDom();
          return true;
        }

        return false;
      }

      if (isManagementSection("work-schedules")) {
        if (target.closest("#management-work-policy-form") || target.dataset.managementWorkPolicyPeriod) {
          updateManagementWorkPolicyStageMetrics();
          return true;
        }
      }

      if (isManagementSection("worksites")) {
        if (target.id === "management-worksite-search-query") {
          state.managementWorksiteSearchQuery = target.value || "";
          return true;
        }

        if (target.closest("#management-worksite-form")) {
          syncManagementWorksiteDraftFromDom();

          if (target.dataset.managementWorksiteCoordinate || target.dataset.managementWorksiteRadius === "true") {
            updateManagementWorksiteFormFields();
            syncManagementWorksiteMapGeometry(Boolean(target.dataset.managementWorksiteCoordinate));
          }

          return true;
        }
      }

      return false;
    }

    function handleDocumentChange(event) {
      if (currentPage !== "workspace") {
        return false;
      }

      const target = event.target;

      if (isManagementSection("work-schedules")) {
        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
          && (target.closest("#management-work-policy-form") || target.dataset.managementWorkPolicyPeriod)) {
          updateManagementWorkPolicyStageMetrics();
          return true;
        }
      }

      if (isManagementSection("holidays")) {
        if (target instanceof HTMLSelectElement && target.dataset.managementHolidayYearSelect === "true") {
          const nextYear = Math.max(1900, Math.min(2100, Number(target.value) || CURRENT_YEAR));
          loadHolidayYear(nextYear).catch((error) => {
            window.alert(error.message || "공휴일 정보를 불러오지 못했습니다.");
          });
          return true;
        }
      }

      if (isManagementSection("job-titles")) {
        if (target instanceof HTMLInputElement && target.closest("#management-job-title-form")) {
          const form = target.closest("#management-job-title-form");

          if (target.dataset.managementJobTitleSelectAll === "true") {
            form?.querySelectorAll('[data-management-job-title-unit-option="true"]').forEach((input) => {
              if (input instanceof HTMLInputElement) {
                input.checked = target.checked;
                input.indeterminate = false;
              }
            });
            syncManagementJobTitleTreeState(form);
            return true;
          }

          if (target.dataset.managementJobTitleUnitOption === "true") {
            setManagementJobTitleDescendantsChecked(form, target, target.checked);
            syncManagementJobTitleTreeState(form);
            return true;
          }
        }
      }

      if (isManagementSection("worksites")) {
        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.closest("#management-worksite-form")) {
          syncManagementWorksiteDraftFromDom();

          if (target.id === "management-worksite-lat" || target.id === "management-worksite-lng" || target.id === "management-worksite-radius") {
            updateManagementWorksiteFormFields();
            syncManagementWorksiteMapGeometry(true);
          }

          return true;
        }
      }

      return false;
    }

    return Object.freeze({
      handleDocumentChange,
      handleDocumentInput,
    });
  }

  return Object.freeze({ create });
});
