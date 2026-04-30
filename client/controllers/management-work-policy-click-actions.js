(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorkPolicyClickActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      closeManagementWorkPolicyModal,
      closeManagementWorkPolicyTimePickers,
      deleteManagementWorkPolicy,
      handleManagementWorkPolicyTimeOptionClick,
      isManagementSection,
      openManagementWorkPolicyModal,
      renderers,
      setManagementWorkPolicyTimePickerOpen,
      syncManagementModalDirtyState,
      updateManagementWorkPolicyStageMetrics,
    } = dependencies;

    if (!renderers || typeof isManagementSection !== "function") {
      throw new Error("WorkMateManagementWorkPolicyClickActions requires work policy click dependencies.");
    }

    function syncManagementWorkPolicyBreakAutoRemoveButtons(list) {
      if (!(list instanceof HTMLElement)) {
        return;
      }

      const rows = Array.from(list.querySelectorAll("[data-management-work-policy-break-auto-row='true']"));
      const shouldDisableRemove = rows.length <= 1;

      rows.forEach((row) => {
        row.querySelectorAll("[data-management-work-policy-break-auto-remove]").forEach((button) => {
          if (button instanceof HTMLButtonElement) {
            button.disabled = shouldDisableRemove;
          }
        });
      });
    }

    async function handleManagementWorkPolicyClick(target) {
      const managementWorkPolicyCloseButton = target.closest("[data-management-work-policy-close]");
      const managementWorkPolicyAdjustmentAddButton = target.closest("[data-management-work-policy-adjustment-add]");
      const managementWorkPolicyBreakAutoAddButton = target.closest("[data-management-work-policy-break-auto-add]");
      const managementWorkPolicyBreakAutoRemoveButton = target.closest("[data-management-work-policy-break-auto-remove]");
      const managementWorkPolicyDeleteButton = target.closest("[data-management-work-policy-delete]");
      const managementWorkPolicyOpenButton = target.closest("[data-management-work-policy-open]");
      const managementWorkPolicyTimeOptionButton = target.closest("[data-management-work-policy-time-option]");
      const managementWorkPolicyTimePicker = target.closest("[data-management-work-policy-time-picker]");
      const managementWorkPolicyTimeToggleButton = target.closest("[data-management-work-policy-time-toggle]");

      if (managementWorkPolicyCloseButton) {
        closeManagementWorkPolicyModal();
        return true;
      }

      if (!isManagementSection("work-schedules")) {
        return false;
      }

      if (managementWorkPolicyAdjustmentAddButton) {
        const list = document.querySelector("[data-management-work-policy-adjustment-list='true']");

        if (list instanceof HTMLElement && typeof renderers.renderManagementWorkPolicyAdjustmentRow === "function") {
          const nextIndex = list.querySelectorAll(".workmate-work-policy-adjustment-row").length;
          list.insertAdjacentHTML("beforeend", renderers.renderManagementWorkPolicyAdjustmentRow({}, nextIndex));
          updateManagementWorkPolicyStageMetrics();
        }

        return true;
      }

      if (managementWorkPolicyBreakAutoAddButton) {
        const list = document.querySelector("[data-management-work-policy-break-auto-list='true']");

        if (list instanceof HTMLElement && typeof renderers.renderManagementWorkPolicyBreakAutoRangeRow === "function") {
          closeManagementWorkPolicyTimePickers();
          const nextIndex = Array.from(list.querySelectorAll("[data-management-work-policy-break-auto-row-index]"))
            .map((row) => Number(row instanceof HTMLElement ? row.dataset.managementWorkPolicyBreakAutoRowIndex : Number.NaN))
            .filter(Number.isFinite)
            .reduce((maxValue, value) => Math.max(maxValue, value), -1) + 1;

          list.insertAdjacentHTML("beforeend", renderers.renderManagementWorkPolicyBreakAutoRangeRow({}, nextIndex, {
            allowBlank: true,
            canRemove: true,
          }));
          syncManagementWorkPolicyBreakAutoRemoveButtons(list);
          updateManagementWorkPolicyStageMetrics();
          syncManagementModalDirtyState("workPolicy");

          const firstToggle = list.querySelector(`[data-management-work-policy-break-auto-row-index="${nextIndex}"] [data-management-work-policy-time-toggle]`);

          if (firstToggle instanceof HTMLElement) {
            firstToggle.focus();
          }
        }

        return true;
      }

      if (managementWorkPolicyBreakAutoRemoveButton) {
        const row = managementWorkPolicyBreakAutoRemoveButton.closest("[data-management-work-policy-break-auto-row='true']");
        const list = row?.closest("[data-management-work-policy-break-auto-list='true']");

        if (row instanceof HTMLElement && list instanceof HTMLElement) {
          const rows = list.querySelectorAll("[data-management-work-policy-break-auto-row='true']");

          if (rows.length > 1) {
            closeManagementWorkPolicyTimePickers();
            row.remove();
            syncManagementWorkPolicyBreakAutoRemoveButtons(list);
            updateManagementWorkPolicyStageMetrics();
            syncManagementModalDirtyState("workPolicy");
          }
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

      if (managementWorkPolicyOpenButton) {
        openManagementWorkPolicyModal(managementWorkPolicyOpenButton.dataset.managementWorkPolicyOpen || "");
        return true;
      }

      if (managementWorkPolicyDeleteButton) {
        await deleteManagementWorkPolicy(managementWorkPolicyDeleteButton.dataset.managementWorkPolicyDelete || "");
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleManagementWorkPolicyClick,
    });
  }

  return Object.freeze({ create });
});
