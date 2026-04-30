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
      handleManagementEmployeeCardFileChange,
      handleManagementEmployeeCardFileDrop,
      handleManagementEmployeeExcelFileChange,
      loadHolidayYear,
      normalizeManagementSection,
      setInlineMessage,
      setManagementJobTitleDescendantsChecked,
      state,
      syncManagementEmployeeActionButtons,
      syncManagementJobTitleTreeState,
      syncManagementEmployeeJobTitleOptions,
      syncManagementModalDirtyState,
      syncManagementWorksiteDraftFromDom,
      syncManagementWorksiteMapGeometry,
      updateManagementEmployeePhoneInput,
      updateManagementEmployeeTenurePreview,
      validateManagementEmployeeField,
      updateManagementWorkPolicyStageMetrics,
      updateManagementWorksiteFormFields,
    } = dependencies;

    if (!state || typeof loadHolidayYear !== "function" || typeof setInlineMessage !== "function") {
      throw new Error("WorkMateAppInteractionManagementInputHandler requires management input dependencies.");
    }

    function isManagementSection(section = "") {
      return currentPage === "workspace"
        && state.currentWorkspaceView === "management"
        && normalizeManagementSection(state.managementSection) === section;
    }

    function syncManagementLeaveRuleRoundingIncrement() {
      const roundingMethodControl = document.querySelector("[data-management-leave-rule-immediate-rounding-method]");
      const roundingIncrementControl = document.querySelector("[data-management-leave-rule-immediate-rounding-increment]");

      if (!(roundingMethodControl instanceof HTMLSelectElement) || !(roundingIncrementControl instanceof HTMLSelectElement)) {
        return;
      }

      const shouldDisableIncrement = String(roundingMethodControl.value || "").toUpperCase() !== "ROUND";
      roundingIncrementControl.disabled = shouldDisableIncrement;

      if (shouldDisableIncrement) {
        roundingIncrementControl.value = "1";
      }
    }

    function getMonthDayMaxDay(month = 1) {
      const normalizedMonth = Math.max(1, Math.min(12, Number(month) || 1));

      return new Date(2000, normalizedMonth, 0).getDate();
    }

    function syncMonthDayPicker(picker = null) {
      if (!(picker instanceof HTMLElement)) {
        return;
      }

      const monthControl = picker.querySelector("[data-management-month-day-month]");
      const dayControl = picker.querySelector("[data-management-month-day-day]");

      if (!(monthControl instanceof HTMLSelectElement) || !(dayControl instanceof HTMLSelectElement)) {
        return;
      }

      const maxDay = getMonthDayMaxDay(monthControl.value);
      const currentDay = Math.min(Math.max(1, Number(dayControl.value) || 1), maxDay);
      dayControl.replaceChildren(...Array.from({ length: maxDay }, (_, index) => {
        const value = index + 1;
        const option = document.createElement("option");
        option.value = String(value).padStart(2, "0");
        option.textContent = `${value}일`;
        option.selected = value === currentDay;
        return option;
      }));
    }

    function handleDocumentInput(event) {
      if (currentPage !== "workspace") {
        return false;
      }

      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        if ((target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
          && target.closest("#management-employee-form")) {
          validateManagementEmployeeField?.(target, { force: false });
          syncManagementModalDirtyState("employee");
          if (typeof syncManagementEmployeeActionButtons === "function") {
            syncManagementEmployeeActionButtons();
          }
          return true;
        }

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
          syncManagementModalDirtyState("workPolicy");
          return true;
        }
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-unit-form")) {
        syncManagementModalDirtyState("unit");
        return true;
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-holiday-form")) {
        syncManagementModalDirtyState("holiday");
        return true;
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-job-title-form")) {
        syncManagementModalDirtyState("jobTitle");
        return true;
      }

      if (isManagementSection("employees")
        && target.closest("#management-employee-form")) {
        if (target.id === "management-employee-phone") {
          updateManagementEmployeePhoneInput(target);
        }

        if (target.id === "management-employee-unit" && typeof syncManagementEmployeeJobTitleOptions === "function") {
          syncManagementEmployeeJobTitleOptions(target.value || "");
        }

        if ((target.id === "management-employee-join-date" || target.id === "management-employee-retire-date")
          && typeof updateManagementEmployeeTenurePreview === "function") {
          updateManagementEmployeeTenurePreview();
        }

        validateManagementEmployeeField?.(target, { force: false });

        syncManagementModalDirtyState("employee");
        if (typeof syncManagementEmployeeActionButtons === "function") {
          syncManagementEmployeeActionButtons();
        }
        return true;
      }

      if (isManagementSection("worksites")) {
        if (target.id === "management-worksite-search-query") {
          state.managementWorksiteSearchQuery = target.value || "";
          return true;
        }

        if (target.closest("#management-worksite-form")) {
          syncManagementWorksiteDraftFromDom();
          syncManagementModalDirtyState("worksite");

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

      if (isManagementSection("leave-accrual-rules")
        && target instanceof HTMLSelectElement
        && target.dataset.managementLeaveRuleImmediateRoundingMethod === "true") {
        syncManagementLeaveRuleRoundingIncrement();
        return true;
      }

      if (isManagementSection("leave-accrual-rules")
        && target instanceof HTMLSelectElement
        && target.closest("[data-management-month-day-picker='true']")) {
        syncMonthDayPicker(target.closest("[data-management-month-day-picker='true']"));
        return true;
      }

      if (isManagementSection("work-schedules")) {
        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
          && (target.closest("#management-work-policy-form") || target.dataset.managementWorkPolicyPeriod)) {
          updateManagementWorkPolicyStageMetrics();
          syncManagementModalDirtyState("workPolicy");
          return true;
        }
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-unit-form")) {
        syncManagementModalDirtyState("unit");
        return true;
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-holiday-form")) {
        syncManagementModalDirtyState("holiday");
        return true;
      }

      if (isManagementSection("employees")) {
        if (target instanceof HTMLInputElement && target.dataset.managementEmployeeCardFile === "true") {
          handleManagementEmployeeCardFileChange(target).then(() => {
            syncManagementModalDirtyState("employee");
            if (typeof syncManagementEmployeeActionButtons === "function") {
              syncManagementEmployeeActionButtons();
            }
          }).catch((error) => {
            window.alert(error.message || "인사카드 파일을 처리하지 못했습니다.");
          });
          return true;
        }

        if (target instanceof HTMLInputElement && target.dataset.managementEmployeeExcelFile === "true") {
          handleManagementEmployeeExcelFileChange(target).catch((error) => {
            setInlineMessage(document.getElementById("management-employee-excel-error"), error.message || "엑셀 업로드에 실패했습니다.");
          });
          return true;
        }

        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
          && target.closest("#management-employee-form")) {
          if (target.id === "management-employee-phone") {
            updateManagementEmployeePhoneInput(target);
          }

          if (target.id === "management-employee-unit" && typeof syncManagementEmployeeJobTitleOptions === "function") {
            syncManagementEmployeeJobTitleOptions(target.value || "");
          }

          if ((target.id === "management-employee-join-date" || target.id === "management-employee-retire-date")
            && typeof updateManagementEmployeeTenurePreview === "function") {
            updateManagementEmployeeTenurePreview();
          }

          validateManagementEmployeeField?.(target, { force: false });

          syncManagementModalDirtyState("employee");
          if (typeof syncManagementEmployeeActionButtons === "function") {
            syncManagementEmployeeActionButtons();
          }
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
            syncManagementModalDirtyState("jobTitle");
            return true;
          }

          if (target.dataset.managementJobTitleUnitOption === "true") {
            setManagementJobTitleDescendantsChecked(form, target, target.checked);
            syncManagementJobTitleTreeState(form);
            syncManagementModalDirtyState("jobTitle");
            return true;
          }
        }
      }

      if (isManagementSection("worksites")) {
        if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.closest("#management-worksite-form")) {
          syncManagementWorksiteDraftFromDom();
          syncManagementModalDirtyState("worksite");

          if (target.id === "management-worksite-lat" || target.id === "management-worksite-lng" || target.id === "management-worksite-radius") {
            updateManagementWorksiteFormFields();
            syncManagementWorksiteMapGeometry(true);
          }

          return true;
        }
      }

      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        && target.closest("#management-job-title-form")) {
        syncManagementModalDirtyState("jobTitle");
        return true;
      }

      return false;
    }

    function getManagementEmployeeCardDropzone(target = null) {
      return target instanceof Element
        ? target.closest("[data-management-employee-card-dropzone]")
        : null;
    }

    function handleDocumentDragOver(event) {
      if (!isManagementSection("employees")) {
        return false;
      }

      const dropzone = getManagementEmployeeCardDropzone(event.target);

      if (!(dropzone instanceof HTMLElement)) {
        return false;
      }

      event.preventDefault();
      dropzone.classList.add("is-drag-over");

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }

      return true;
    }

    function handleDocumentDragLeave(event) {
      if (!isManagementSection("employees")) {
        return false;
      }

      const dropzone = getManagementEmployeeCardDropzone(event.target);

      if (!(dropzone instanceof HTMLElement)) {
        return false;
      }

      const relatedTarget = event.relatedTarget;

      if (!(relatedTarget instanceof Node) || !dropzone.contains(relatedTarget)) {
        dropzone.classList.remove("is-drag-over");
      }

      return true;
    }

    function handleDocumentDrop(event) {
      if (!isManagementSection("employees")) {
        return false;
      }

      const dropzone = getManagementEmployeeCardDropzone(event.target);

      if (!(dropzone instanceof HTMLElement)) {
        return false;
      }

      event.preventDefault();
      dropzone.classList.remove("is-drag-over");

      const file = event.dataTransfer?.files?.[0] || null;

      handleManagementEmployeeCardFileDrop?.(file).then(() => {
        syncManagementModalDirtyState("employee");
        if (typeof syncManagementEmployeeActionButtons === "function") {
          syncManagementEmployeeActionButtons();
        }
      }).catch((error) => {
        window.alert(error.message || "인사기록카드 파일을 처리하지 못했습니다.");
      });

      return true;
    }

    function handleDocumentFocusOut(event) {
      if (currentPage !== "workspace" || !isManagementSection("employees")) {
        return false;
      }

      const target = event.target;

      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        || !target.closest("#management-employee-form")) {
        return false;
      }

      if ((target.id === "management-employee-join-date" || target.id === "management-employee-retire-date")
        && typeof updateManagementEmployeeTenurePreview === "function") {
        updateManagementEmployeeTenurePreview();
      }

      validateManagementEmployeeField?.(target, { force: true });
      syncManagementModalDirtyState("employee");
      if (typeof syncManagementEmployeeActionButtons === "function") {
        syncManagementEmployeeActionButtons();
      }
      return true;
    }

    return Object.freeze({
      handleDocumentChange,
      handleDocumentDragLeave,
      handleDocumentDragOver,
      handleDocumentDrop,
      handleDocumentFocusOut,
      handleDocumentInput,
    });
  }

  return Object.freeze({ create });
});
