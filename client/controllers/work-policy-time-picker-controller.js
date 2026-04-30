(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyTimePickerController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function formatManagementWorkPolicyTimeValue(totalMinutes = 0, maxMinutes = 60000) {
    const normalizedMaxMinutes = Math.max(0, Math.round(Number(maxMinutes) || 60000));
    const normalizedMinutes = Math.max(0, Math.min(normalizedMaxMinutes, Math.round(Number(totalMinutes) || 0)));
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function parseManagementWorkPolicyTimeValue(value) {
    const matched = String(value || "").trim().match(/^(\d{1,4}):([0-5]\d)$/);

    if (!matched) {
      return Number.NaN;
    }

    const hours = Number(matched[1]);
    const minutes = Number(matched[2]);

    if (!Number.isInteger(hours) || hours < 0) {
      return Number.NaN;
    }

    return (hours * 60) + minutes;
  }

  function getManagementWorkPolicyTimeParts(value = "") {
    const totalMinutes = parseManagementWorkPolicyTimeValue(value);
    const normalizedMinutes = Number.isFinite(totalMinutes) ? totalMinutes : 0;

    return {
      hours: Math.floor(normalizedMinutes / 60),
      minutes: normalizedMinutes % 60,
    };
  }

  function create(dependencies = {}) {
    const {
      updateManagementWorkPolicyStageMetrics,
    } = dependencies;

    if (typeof updateManagementWorkPolicyStageMetrics !== "function") {
      throw new Error("WorkMateWorkPolicyTimePickerController requires time picker dependencies.");
    }

    function closeManagementWorkPolicyTimePickers(exceptPicker = null) {
      document.querySelectorAll("[data-management-work-policy-time-picker]").forEach((picker) => {
        if (!(picker instanceof HTMLElement) || picker === exceptPicker) {
          return;
        }

        const trigger = picker.querySelector("[data-management-work-policy-time-toggle]");
        const panel = picker.querySelector("[data-management-work-policy-time-panel]");

        picker.classList.remove("is-open");
        picker.classList.remove("is-open-upward");

        if (trigger instanceof HTMLElement) {
          trigger.setAttribute("aria-expanded", "false");
        }

        if (panel instanceof HTMLElement) {
          panel.hidden = true;
        }
      });
    }

    function syncManagementWorkPolicyTimePickerPlacement(picker) {
      if (!(picker instanceof HTMLElement)) {
        return;
      }

      const panel = picker.querySelector("[data-management-work-policy-time-panel]");

      if (!(panel instanceof HTMLElement) || panel.hidden) {
        picker.classList.remove("is-open-upward");
        return;
      }

      const pickerRect = picker.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const viewportPadding = 16;
      const panelHeight = Math.ceil(panelRect.height);
      const spaceAbove = pickerRect.top - viewportPadding;
      const spaceBelow = window.innerHeight - pickerRect.bottom - viewportPadding;
      const shouldOpenUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow;

      picker.classList.toggle("is-open-upward", shouldOpenUpward);
    }

    function setManagementWorkPolicyTimePickerOpen(picker, isOpen) {
      if (!(picker instanceof HTMLElement)) {
        return;
      }

      const trigger = picker.querySelector("[data-management-work-policy-time-toggle]");
      const panel = picker.querySelector("[data-management-work-policy-time-panel]");

      picker.classList.toggle("is-open", Boolean(isOpen));

      if (trigger instanceof HTMLElement) {
        trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }

      if (panel instanceof HTMLElement) {
        panel.hidden = !isOpen;
      }

      if (isOpen) {
        syncManagementWorkPolicyTimePickerPlacement(picker);
        return;
      }

      picker.classList.remove("is-open-upward");
    }

    function syncManagementWorkPolicyTimePickerOptions(picker, value = "") {
      if (!(picker instanceof HTMLElement)) {
        return;
      }

      const { hours, minutes } = getManagementWorkPolicyTimeParts(value);
      const maxMinutes = Math.max(0, Math.round(Number(picker.dataset.managementWorkPolicyTimeMax || 1440) || 1440));
      const maxHour = Math.floor(maxMinutes / 60);
      const maxMinute = maxMinutes % 60;

      picker.querySelectorAll("[data-management-work-policy-time-option='hour']").forEach((option) => {
        if (option instanceof HTMLElement) {
          option.classList.toggle("is-active", Number(option.dataset.managementWorkPolicyTimeValue || -1) === hours);
        }
      });

      picker.querySelectorAll("[data-management-work-policy-time-option='minute']").forEach((option) => {
        if (!(option instanceof HTMLButtonElement)) {
          return;
        }

        const minuteValue = Number(option.dataset.managementWorkPolicyTimeValue || -1);
        const isDisabled = hours === maxHour && minuteValue > maxMinute;

        option.disabled = isDisabled;
        option.classList.toggle("is-active", minuteValue === minutes);
      });
    }

    function setManagementWorkPolicyTimePickerValue(picker, nextValue = "") {
      if (!(picker instanceof HTMLElement)) {
        return;
      }

      const hiddenInput = picker.querySelector("[data-management-work-policy-time-hidden]");
      const display = picker.querySelector("[data-management-work-policy-time-display]");
      const maxMinutes = Math.max(0, Math.round(Number(picker.dataset.managementWorkPolicyTimeMax || 1440) || 1440));
      const normalizedValue = formatManagementWorkPolicyTimeValue(parseManagementWorkPolicyTimeValue(nextValue), maxMinutes);

      if (hiddenInput instanceof HTMLInputElement) {
        hiddenInput.value = normalizedValue;
      }

      if (display instanceof HTMLElement) {
        display.textContent = normalizedValue;
      }

      syncManagementWorkPolicyTimePickerOptions(picker, normalizedValue);
      updateManagementWorkPolicyStageMetrics();

      if (hiddenInput instanceof HTMLInputElement) {
        hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function handleManagementWorkPolicyTimeOptionClick(optionButton) {
      if (!(optionButton instanceof HTMLElement)) {
        return;
      }

      const picker = optionButton.closest("[data-management-work-policy-time-picker]");
      const hiddenInput = picker?.querySelector("[data-management-work-policy-time-hidden]");

      if (!(picker instanceof HTMLElement) || !(hiddenInput instanceof HTMLInputElement)) {
        return;
      }

      const { hours, minutes } = getManagementWorkPolicyTimeParts(hiddenInput.value || "");
      const optionType = String(optionButton.dataset.managementWorkPolicyTimeOption || "").trim();
      const optionValue = Number(optionButton.dataset.managementWorkPolicyTimeValue || 0);
      const maxMinutes = Math.max(0, Math.round(Number(picker.dataset.managementWorkPolicyTimeMax || 1440) || 1440));
      const maxHour = Math.floor(maxMinutes / 60);
      const maxMinute = maxMinutes % 60;
      const nextHours = optionType === "hour" ? optionValue : hours;
      const nextMinutes = nextHours === maxHour
        ? Math.min(optionType === "minute" ? optionValue : minutes, maxMinute)
        : optionType === "minute"
          ? optionValue
          : minutes;

      setManagementWorkPolicyTimePickerValue(picker, formatManagementWorkPolicyTimeValue((nextHours * 60) + nextMinutes, maxMinutes));
    }

    return Object.freeze({
      closeManagementWorkPolicyTimePickers,
      handleManagementWorkPolicyTimeOptionClick,
      setManagementWorkPolicyTimePickerOpen,
    });
  }

  return Object.freeze({
    create,
    formatManagementWorkPolicyTimeValue,
    parseManagementWorkPolicyTimeValue,
  });
});
