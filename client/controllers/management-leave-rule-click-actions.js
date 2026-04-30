(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeaveRuleClickActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      reloadManagementAfterLeavePolicyAction,
      renderWorkspacePage,
      setInlineMessage,
      state,
    } = dependencies;

    if (!api || typeof reloadManagementAfterLeavePolicyAction !== "function" || typeof renderWorkspacePage !== "function" || !state) {
      throw new Error("WorkMateManagementLeaveRuleClickActions requires leave rule click dependencies.");
    }

    function getControlValue(id = "") {
      const control = document.getElementById(id);

      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        return control.value;
      }

      return "";
    }

    function getFieldValue(root, selector = "") {
      const control = root?.querySelector?.(selector);

      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        return control.value;
      }

      return "";
    }

    function getControlValueFromSelector(selector = "") {
      const control = document.querySelector(selector);

      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        return control.value;
      }

      return "";
    }

    function formatMonthDayValue(monthValue = "", dayValue = "") {
      const month = Math.max(1, Math.min(12, Number(monthValue) || 1));
      const day = Math.max(1, Math.min(31, Number(dayValue) || 1));

      return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function getMonthDayValueFromSelector(monthSelector = "", daySelector = "") {
      return formatMonthDayValue(
        getControlValueFromSelector(monthSelector),
        getControlValueFromSelector(daySelector),
      );
    }

    function getMonthDayValueFromRow(row, monthSelector = "", daySelector = "") {
      return formatMonthDayValue(
        getFieldValue(row, monthSelector),
        getFieldValue(row, daySelector),
      );
    }

    function getSelectedLeaveRuleFrequency() {
      const selected = document.querySelector("input[name='management-leave-rule-frequency']:checked");

      if (!(selected instanceof HTMLInputElement)) {
        return "YEARLY";
      }

      return ["IMMEDIATE", "MONTHLY", "YEARLY"].includes(selected.value) ? selected.value : "YEARLY";
    }

    function getSelectedLeaveRuleImmediateMode() {
      const selected = document.querySelector("input[name='management-leave-rule-immediate-mode']:checked");

      return selected instanceof HTMLInputElement && selected.value === "PRORATED" ? "PRORATED" : "FIXED";
    }

    function getSelectedLeaveRuleMonthlyMethod() {
      const selected = document.querySelector("input[name='management-leave-rule-monthly-method']:checked");

      return selected instanceof HTMLInputElement && ["FIXED", "CONTRACTUAL_HOURS", "ATTENDANCE_RATE"].includes(selected.value)
        ? selected.value
        : "FIXED";
    }

    function syncManagementLeaveRuleFrequencySections() {
      const selectedFrequency = getSelectedLeaveRuleFrequency();

      document.querySelectorAll("[data-management-leave-rule-frequency-section]").forEach((section) => {
        if (section instanceof HTMLElement) {
          section.hidden = String(section.dataset.managementLeaveRuleFrequencySection || "") !== selectedFrequency;
        }
      });

      syncManagementLeaveRuleImmediateSections();
      syncManagementLeaveRuleMonthlyMethodSections();
    }

    function syncManagementLeaveRuleImmediateSections() {
      const selectedMode = getSelectedLeaveRuleImmediateMode();

      document.querySelectorAll("[data-management-leave-rule-immediate-section]").forEach((section) => {
        if (section instanceof HTMLElement) {
          section.hidden = String(section.dataset.managementLeaveRuleImmediateSection || "") !== selectedMode;
        }
      });
    }

    function syncManagementLeaveRuleMonthlyMethodSections() {
      const selectedMethod = getSelectedLeaveRuleMonthlyMethod();

      document.querySelectorAll("[data-management-leave-rule-monthly-method-section]").forEach((section) => {
        if (section instanceof HTMLElement) {
          section.hidden = String(section.dataset.managementLeaveRuleMonthlyMethodSection || "") !== selectedMethod;
        }
      });
    }

    function syncManagementLeaveRuleRangeRemoveButtons() {
      [
        "[data-management-leave-rule-monthly-list='true']",
        "[data-management-leave-rule-yearly-list='true']",
      ].forEach((selector) => {
        const list = document.querySelector(selector);
        const rows = list instanceof HTMLElement
          ? Array.from(list.querySelectorAll("[data-management-leave-rule-monthly-row='true'], [data-management-leave-rule-yearly-row='true']"))
          : [];

        rows.forEach((row) => {
          row.querySelectorAll("[data-management-leave-rule-remove-range]").forEach((button) => {
            if (button instanceof HTMLButtonElement) {
              button.disabled = rows.length <= 1;
            }
          });
        });
      });
    }

    function addManagementLeaveRuleRange(frequency = "MONTHLY") {
      const isYearly = frequency === "YEARLY";
      const list = document.querySelector(isYearly
        ? "[data-management-leave-rule-yearly-list='true']"
        : "[data-management-leave-rule-monthly-list='true']");

      if (!(list instanceof HTMLElement)) {
        return;
      }

      const rowSelector = isYearly
        ? "[data-management-leave-rule-yearly-row='true']"
        : "[data-management-leave-rule-monthly-row='true']";
      const rows = Array.from(list.querySelectorAll(rowSelector));
      const template = rows[rows.length - 1];

      if (!(template instanceof HTMLElement)) {
        return;
      }

      const nextRow = template.cloneNode(true);

      if (!(nextRow instanceof HTMLElement)) {
        return;
      }

      const tenureSelector = isYearly
        ? "[data-management-leave-rule-yearly-tenure-years]"
        : "[data-management-leave-rule-monthly-tenure-months]";
      const sourceTenureControl = template.querySelector(tenureSelector);
      const nextTenureControl = nextRow.querySelector(tenureSelector);
      const nextTenure = Math.max(1, Number(sourceTenureControl instanceof HTMLInputElement ? sourceTenureControl.value : 0) || 0) + 1;

      if (nextTenureControl instanceof HTMLInputElement) {
        nextTenureControl.value = String(nextTenure);
      }

      list.append(nextRow);
      syncManagementLeaveRuleRangeRemoveButtons();
      nextTenureControl?.focus?.();
    }

    function removeManagementLeaveRuleRange(button) {
      const row = button?.closest?.("[data-management-leave-rule-monthly-row='true'], [data-management-leave-rule-yearly-row='true']");
      const list = row?.parentElement;

      if (!(row instanceof HTMLElement) || !(list instanceof HTMLElement)) {
        return;
      }

      const rows = list.querySelectorAll("[data-management-leave-rule-monthly-row='true'], [data-management-leave-rule-yearly-row='true']");

      if (rows.length <= 1) {
        return;
      }

      row.remove();
      syncManagementLeaveRuleRangeRemoveButtons();
    }

    function collectManagementLeaveRuleRanges(frequency = "MONTHLY") {
      if (frequency === "IMMEDIATE") {
        const immediateMode = getSelectedLeaveRuleImmediateMode();

        if (immediateMode === "PRORATED") {
          const roundingMethod = getControlValueFromSelector("[data-management-leave-rule-immediate-rounding-method]");

          return [{
            amountDays: getControlValueFromSelector("[data-management-leave-rule-immediate-prorated-annual-days]"),
            effectiveTo: getMonthDayValueFromSelector(
              "[data-management-leave-rule-immediate-expiry-month]",
              "[data-management-leave-rule-immediate-expiry-day]",
            ),
            immediateAccrualType: "PRORATED",
            maxAmountDays: getControlValueFromSelector("[data-management-leave-rule-immediate-max-days]"),
            minAmountDays: getControlValueFromSelector("[data-management-leave-rule-immediate-min-days]"),
            prorationBasis: getControlValueFromSelector("[data-management-leave-rule-immediate-proration-basis]"),
            prorationUnit: getControlValueFromSelector("[data-management-leave-rule-immediate-proration-unit]"),
            roundingIncrement: String(roundingMethod || "").toUpperCase() === "ROUND"
              ? getControlValueFromSelector("[data-management-leave-rule-immediate-rounding-increment]")
              : "1",
            roundingMethod,
          }];
        }

        return [{
          amountDays: getControlValueFromSelector("[data-management-leave-rule-immediate-fixed-amount]"),
          effectiveTo: getMonthDayValueFromSelector(
            "[data-management-leave-rule-immediate-fixed-expiry-month]",
            "[data-management-leave-rule-immediate-fixed-expiry-day]",
          ),
          immediateAccrualType: "FIXED",
        }];
      }

      const isYearly = frequency === "YEARLY";
      const monthlyAccrualMethod = isYearly ? "FIXED" : getSelectedLeaveRuleMonthlyMethod();
      const rowSelector = isYearly
        ? "[data-management-leave-rule-yearly-row='true']"
        : "[data-management-leave-rule-monthly-row='true']";

      return Array.from(document.querySelectorAll(rowSelector)).map((row) => isYearly
        ? {
          amountDays: getFieldValue(row, "[data-management-leave-rule-yearly-amount]"),
          effectiveFrom: getMonthDayValueFromRow(
            row,
            "[data-management-leave-rule-yearly-effective-from-month]",
            "[data-management-leave-rule-yearly-effective-from-day]",
          ),
          effectiveTo: getMonthDayValueFromRow(
            row,
            "[data-management-leave-rule-yearly-effective-to-month]",
            "[data-management-leave-rule-yearly-effective-to-day]",
          ),
          tenureYears: getFieldValue(row, "[data-management-leave-rule-yearly-tenure-years]"),
        }
        : {
          amountDays: getFieldValue(row, "[data-management-leave-rule-monthly-amount]"),
          attendanceAccrualMethod: monthlyAccrualMethod === "ATTENDANCE_RATE"
            ? getControlValueFromSelector("[data-management-leave-rule-monthly-attendance-method]")
            : "",
          attendanceRateThreshold: monthlyAccrualMethod === "ATTENDANCE_RATE"
            ? getControlValueFromSelector("[data-management-leave-rule-monthly-attendance-threshold]")
            : "",
          expiresAfterMonths: getFieldValue(row, "[data-management-leave-rule-monthly-expires]"),
          monthlyAccrualMethod,
          referenceDailyHours: monthlyAccrualMethod === "CONTRACTUAL_HOURS"
            ? getControlValueFromSelector("[data-management-leave-rule-monthly-reference-hours]")
            : "",
          tenureMonths: getFieldValue(row, "[data-management-leave-rule-monthly-tenure-months]"),
        });
    }

    function closeManagementLeaveRuleModal() {
      state.managementLeaveRuleModalOpen = false;
      state.managementLeaveRuleEditIds = "";
    }

    async function submitManagementLeaveRule() {
      const errorTarget = document.getElementById("management-leave-rule-error");
      const frequency = getSelectedLeaveRuleFrequency();
      const editRuleIds = String(getControlValue("management-leave-rule-ids") || state.managementLeaveRuleEditIds || "")
        .split(",")
        .map((ruleId) => ruleId.trim())
        .filter(Boolean)
        .join(",");
      const payload = {
        frequency,
        leaveGroupId: getControlValue("management-leave-rule-group"),
        name: getControlValue("management-leave-rule-name"),
        rules: collectManagementLeaveRuleRanges(frequency),
      };

      setInlineMessage(errorTarget, "");
      await api.requestWithAutoRefresh(editRuleIds
        ? `/v1/orgs/${state.selectedOrganizationId}/leave-accrual-rules/${encodeURIComponent(editRuleIds)}`
        : `/v1/orgs/${state.selectedOrganizationId}/leave-accrual-rules`, {
        body: JSON.stringify(payload),
        method: editRuleIds ? "PATCH" : "POST",
      });
      closeManagementLeaveRuleModal();
      await reloadManagementAfterLeavePolicyAction(editRuleIds ? "휴가 발생 규칙을 저장했습니다." : "휴가 발생 규칙을 생성했습니다.");
    }

    async function deleteManagementLeaveRule(ruleIds = "") {
      const normalizedRuleIds = String(ruleIds || "")
        .split(",")
        .map((ruleId) => ruleId.trim())
        .filter(Boolean)
        .join(",");

      if (!normalizedRuleIds) {
        return;
      }

      const confirmed = window.confirm("휴가 발생 규칙을 삭제하시겠습니까?");

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/leave-accrual-rules/${encodeURIComponent(normalizedRuleIds)}`, {
        method: "DELETE",
      });

      if (String(state.managementLeaveRuleEditIds || "").trim() === normalizedRuleIds) {
        closeManagementLeaveRuleModal();
      }

      await reloadManagementAfterLeavePolicyAction("휴가 발생 규칙을 삭제했습니다.");
    }

    return Object.freeze({
      addManagementLeaveRuleRange,
      closeManagementLeaveRuleModal,
      deleteManagementLeaveRule,
      removeManagementLeaveRuleRange,
      submitManagementLeaveRule,
      syncManagementLeaveRuleFrequencySections,
      syncManagementLeaveRuleImmediateSections,
      syncManagementLeaveRuleMonthlyMethodSections,
      syncManagementLeaveRuleRangeRemoveButtons,
    });
  }

  return Object.freeze({ create });
});
