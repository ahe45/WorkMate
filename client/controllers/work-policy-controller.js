(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkPolicyController(deps = {}) {
    const {
      api,
      createDefaultManagementWorkPolicyDraft,
      refreshWorkspaceData,
      renderers,
      renderWorkspacePage,
      setInlineMessage,
      state,
    } = deps;
    const workPolicyFormUtilsModule = globalThis.WorkMateWorkPolicyFormUtils
      || (typeof require === "function" ? require("./work-policy-form-utils.js") : null);
    const workPolicyPayloadBuilderModule = globalThis.WorkMateWorkPolicyPayloadBuilder
      || (typeof require === "function" ? require("./work-policy-payload-builder.js") : null);
    const workPolicyTimePickerModule = globalThis.WorkMateWorkPolicyTimePickerController
      || (typeof require === "function" ? require("./work-policy-time-picker-controller.js") : null);

    if (!workPolicyFormUtilsModule) {
      throw new Error("client/controllers/work-policy-form-utils.js must be loaded before client/controllers/work-policy-controller.js.");
    }

    if (!workPolicyPayloadBuilderModule || typeof workPolicyPayloadBuilderModule.create !== "function") {
      throw new Error("client/controllers/work-policy-payload-builder.js must be loaded before client/controllers/work-policy-controller.js.");
    }

    if (!workPolicyTimePickerModule || typeof workPolicyTimePickerModule.create !== "function") {
      throw new Error("client/controllers/work-policy-time-picker-controller.js must be loaded before client/controllers/work-policy-controller.js.");
    }

    const {
      buildManagementWorkPolicyDayRulesFromFormData,
      createManagementWorkPolicyAutoBreakRange,
      deriveManagementWorkPolicyMaximumRule,
      deriveManagementWorkPolicyStandardRule,
      formatManagementWorkPolicyCurrencyInputValue,
      getManagementWorkPolicyNextDayOfWeek,
      getManagementWorkPolicyPreviousDayOfWeek,
      getManagementWorkPolicyPrimaryWeeklyHolidayDay,
      getManagementWorkPolicyWorkingDaysFromDayRules,
      normalizeManagementWorkPolicyBoolean,
      normalizeManagementWorkPolicyEmploymentTargetType,
      normalizeManagementWorkPolicyEnum,
      normalizeManagementWorkPolicyNumber,
      normalizeManagementWorkPolicyPayload,
      normalizeManagementWorkPolicyTargetRulePayload,
      sortManagementWorkPolicyAutoBreakRanges,
    } = workPolicyFormUtilsModule;
    const {
      parseManagementWorkPolicyTimeValue,
    } = workPolicyTimePickerModule;

    function getManagementWorkPolicies() {
      const policies = Array.isArray(state.bootstrap?.workPolicies) ? state.bootstrap.workPolicies : [];

      if (policies.length > 0) {
        return policies;
      }

      return state.bootstrap?.workPolicy ? [state.bootstrap.workPolicy] : [];
    }

    function getManagementWorkPolicyById(policyId = "") {
      const normalizedPolicyId = String(policyId || "").trim();

      if (!normalizedPolicyId) {
        return null;
      }

      return getManagementWorkPolicies()
        .find((policy) => String(policy?.id || "").trim() === normalizedPolicyId) || null;
    }

    function createEmptyManagementWorkPolicyDraft(mode = "create", policyId = "") {
      return createDefaultManagementWorkPolicyDraft({
        mode,
        policyId: String(policyId || "").trim(),
      });
    }

    function openManagementWorkPolicyModal(policyId = "") {
      const normalizedPolicyId = String(policyId || "").trim();

      if (normalizedPolicyId && !getManagementWorkPolicyById(normalizedPolicyId)) {
        return;
      }

      state.managementWorkPolicyDraft = normalizedPolicyId
        ? createEmptyManagementWorkPolicyDraft("edit", normalizedPolicyId)
        : createEmptyManagementWorkPolicyDraft("create");
      state.managementWorkPolicyModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-work-policy-name")?.focus();
        updateManagementWorkPolicyStageMetrics();
      });
    }

    function closeManagementWorkPolicyModal() {
      if (!state.managementWorkPolicyModalOpen) {
        return;
      }

      closeManagementWorkPolicyTimePickers();
      state.managementWorkPolicyModalOpen = false;
      renderWorkspacePage();
    }

    function resetManagementWorkPolicyDraft() {
      const draftPolicyId = String(state.managementWorkPolicyDraft?.policyId || "").trim();

      state.managementWorkPolicyDraft = draftPolicyId
        ? createEmptyManagementWorkPolicyDraft("edit", draftPolicyId)
        : createEmptyManagementWorkPolicyDraft("create");
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.getElementById("management-work-policy-name")?.focus();
        updateManagementWorkPolicyStageMetrics();
      });
    }

    function readManagementWorkPolicyDraftFromDom() {
      const form = document.getElementById("management-work-policy-form");

      if (!(form instanceof HTMLFormElement)) {
        return null;
      }

      return {
        ...buildManagementWorkPolicyPayloadFromForm(new FormData(form), { validate: false }),
        holidayDateRules: typeof renderers.buildManagementWorkPolicyHolidayDateRules === "function"
          ? renderers.buildManagementWorkPolicyHolidayDateRules(state.managementHolidayData || {})
          : [],
      };
    }

    function getManagementWorkPolicyMetricPeriodValuesFromDom() {
      const values = {};

      document.querySelectorAll("[data-management-work-policy-period]").forEach((input) => {
        if (input instanceof HTMLInputElement) {
          values[String(input.dataset.managementWorkPolicyPeriod || "").trim()] = input.value || "";
        }
      });

      return values;
    }

    function setManagementWorkPolicyElementVisibility(target, isVisible) {
      const element = typeof target === "string"
        ? document.getElementById(target)
        : target;

      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.hidden = !isVisible;
    }

    function syncManagementWorkPolicySharedPeriodFields() {
      const periodUnitSelect = document.getElementById("management-work-policy-period-unit");
      const periodRangeField = document.getElementById("management-work-policy-period-range-field");
      const dayRangeFields = document.getElementById("management-work-policy-period-day-range-fields");
      const weekRangeFields = document.getElementById("management-work-policy-period-week-range-fields");
      const monthRangeFields = document.getElementById("management-work-policy-period-month-range-fields");
      const weekStartSelect = document.getElementById("management-work-policy-period-week-start");
      const weekEndSelect = document.getElementById("management-work-policy-period-week-end");
      const monthStartSelect = document.getElementById("management-work-policy-period-month-start");
      const monthEndSelect = document.getElementById("management-work-policy-period-month-end");
      const rawPeriodUnit = periodUnitSelect instanceof HTMLSelectElement ? String(periodUnitSelect.value || "").trim().toUpperCase() : "";
      const periodUnit = ["DAY", "WEEK", "MONTH"].includes(rawPeriodUnit) ? rawPeriodUnit : "";
      const activeElementId = document.activeElement instanceof HTMLElement ? document.activeElement.id : "";

      setManagementWorkPolicyElementVisibility(periodRangeField, Boolean(periodUnit));
      setManagementWorkPolicyElementVisibility(dayRangeFields, periodUnit === "DAY");
      setManagementWorkPolicyElementVisibility(weekRangeFields, periodUnit === "WEEK");
      setManagementWorkPolicyElementVisibility(monthRangeFields, periodUnit === "MONTH");

      if (!periodUnit) {
        return;
      }

      if (periodUnit === "WEEK" && weekStartSelect instanceof HTMLSelectElement && weekEndSelect instanceof HTMLSelectElement) {
        let weekStart = normalizeManagementWorkPolicyNumber(weekStartSelect.value, 1, 1, 7);
        let weekEnd = normalizeManagementWorkPolicyNumber(weekEndSelect.value, getManagementWorkPolicyPreviousDayOfWeek(weekStart), 1, 7);

        if (activeElementId === "management-work-policy-period-week-end") {
          weekStart = getManagementWorkPolicyNextDayOfWeek(weekEnd);
        } else {
          weekEnd = getManagementWorkPolicyPreviousDayOfWeek(weekStart);
        }

        weekStartSelect.value = String(weekStart);
        weekEndSelect.value = String(weekEnd);
      }

      if (periodUnit === "MONTH") {
        if (monthStartSelect instanceof HTMLSelectElement && !monthStartSelect.value) {
          monthStartSelect.value = "1";
        }

        if (monthEndSelect instanceof HTMLSelectElement && !monthEndSelect.value) {
          monthEndSelect.value = "31";
        }
      }
    }

    function syncManagementWorkPolicyHourlyWageField() {
      const employmentTargetTypeSelect = document.getElementById("management-work-policy-employment-target-type");
      const hourlyWageInput = document.getElementById("management-work-policy-hourly-wage");
      const employmentTargetType = normalizeManagementWorkPolicyEmploymentTargetType(
        employmentTargetTypeSelect instanceof HTMLSelectElement ? employmentTargetTypeSelect.value : "FULL_TIME",
        "FULL_TIME",
      );
      const isPartTimeTarget = employmentTargetType === "PART_TIME";

      if (hourlyWageInput instanceof HTMLInputElement) {
        hourlyWageInput.value = formatManagementWorkPolicyCurrencyInputValue(hourlyWageInput.value, {
          fallback: "",
        });
        hourlyWageInput.disabled = !isPartTimeTarget;
        hourlyWageInput.setAttribute("aria-disabled", isPartTimeTarget ? "false" : "true");
      }
    }

    function syncManagementWorkPolicyBreakRuleFields() {
      const breakModeSelect = document.getElementById("management-work-policy-break-mode");
      const autoFields = document.getElementById("management-work-policy-break-auto-fields");
      const fixedFields = document.getElementById("management-work-policy-break-fixed-fields");
      const breakMode = normalizeManagementWorkPolicyEnum(
        breakModeSelect instanceof HTMLSelectElement ? breakModeSelect.value : "",
        "",
      );

      setManagementWorkPolicyElementVisibility(autoFields, breakMode === "AUTO");
      setManagementWorkPolicyElementVisibility(fixedFields, breakMode === "FIXED");
    }

    function syncManagementWorkPolicyFormPresentation() {
      const form = document.getElementById("management-work-policy-form");

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      syncManagementWorkPolicyHourlyWageField();
      syncManagementWorkPolicySharedPeriodFields();
      syncManagementWorkPolicyBreakRuleFields();
    }

    function updateManagementWorkPolicyStageMetrics() {
      syncManagementWorkPolicyFormPresentation();
      const root = document.querySelector(".workmate-work-schedule-stage-metrics");
      const info = readManagementWorkPolicyDraftFromDom();

      if (!root || !info || typeof renderers.calculateManagementWorkPolicyStageMetrics !== "function") {
        return;
      }

      const metrics = renderers.calculateManagementWorkPolicyStageMetrics(info, getManagementWorkPolicyMetricPeriodValuesFromDom());

      metrics.forEach((metric) => {
        const unit = String(metric?.unit || "").trim();
        const card = root.querySelector(`[data-management-work-policy-unit="${unit}"]`);

        if (!unit || !card) {
          return;
        }

        const periodInput = card.querySelector(`[data-management-work-policy-period="${unit}"]`);
        const rangeLabel = card.querySelector(`[data-management-work-policy-range="${unit}"]`);

        if (periodInput instanceof HTMLInputElement && periodInput.value !== metric.inputValue) {
          periodInput.value = metric.inputValue || "";
        }

        if (rangeLabel instanceof HTMLElement) {
          rangeLabel.textContent = metric.periodLabel || "";
        }

        [
          ["standard", metric.standardLabel],
          ["max", metric.maxLabel],
        ].forEach(([key, label]) => {
          const valueNode = card.querySelector(`[data-management-work-policy-value="${unit}:${key}"]`);

          if (valueNode instanceof HTMLElement) {
            valueNode.textContent = label || "-";
          }

          const breakdownNode = card.querySelector(`[data-management-work-policy-breakdown="${unit}:${key}"]`);
          const breakdownItems = Array.isArray(metric.breakdown?.[key]) ? metric.breakdown[key] : [];

          if (breakdownNode instanceof HTMLElement) {
            breakdownNode.textContent = breakdownItems[0] || "";
          }
        });
      });
    }

    const workPolicyTimePickerController = workPolicyTimePickerModule.create({
      updateManagementWorkPolicyStageMetrics,
    });
    const {
      closeManagementWorkPolicyTimePickers,
      handleManagementWorkPolicyTimeOptionClick,
      setManagementWorkPolicyTimePickerOpen,
    } = workPolicyTimePickerController;

    function getManagementWorkPolicyDraftBasePolicy() {
      const draftPolicyId = String(state.managementWorkPolicyDraft?.policyId || "").trim();

      if (draftPolicyId) {
        return getManagementWorkPolicyById(draftPolicyId);
      }

      return getManagementWorkPolicies().find((policy) => Boolean(policy?.isDefault))
        || getManagementWorkPolicies()[0]
        || null;
    }

    function getManagementWorkPolicyDraftWorkType() {
      const basePolicy = getManagementWorkPolicyDraftBasePolicy();

      return normalizeManagementWorkPolicyEnum(
        basePolicy?.workInformation?.workType
          || basePolicy?.policyJson?.workInformation?.workType
          || basePolicy?.trackType,
        "FIXED",
      );
    }

    function getManagementWorkPolicyDraftEmploymentTargetType() {
      const basePolicy = getManagementWorkPolicyDraftBasePolicy();
      const storedHourlyWage = Number(
        basePolicy?.workInformation?.hourlyWage
          ?? basePolicy?.policyJson?.workInformation?.hourlyWage
          ?? 0,
      ) || 0;

      return normalizeManagementWorkPolicyEmploymentTargetType(
        basePolicy?.workInformation?.employmentTargetType
          || basePolicy?.policyJson?.workInformation?.employmentTargetType,
        storedHourlyWage > 0 ? "PART_TIME" : "FULL_TIME",
      );
    }

    function getManagementWorkPolicyDraftTargetRule() {
      const basePolicy = getManagementWorkPolicyDraftBasePolicy();

      return normalizeManagementWorkPolicyTargetRulePayload(
        basePolicy?.workInformation?.targetRule
          || basePolicy?.policyJson?.workInformation?.targetRule
        || { scope: "ORGANIZATION" },
      );
    }

    const workPolicyPayloadBuilder = workPolicyPayloadBuilderModule.create({
      buildManagementWorkPolicyDayRulesFromFormData,
      createManagementWorkPolicyAutoBreakRange,
      deriveManagementWorkPolicyMaximumRule,
      deriveManagementWorkPolicyStandardRule,
      getManagementWorkPolicyDraftEmploymentTargetType,
      getManagementWorkPolicyDraftTargetRule,
      getManagementWorkPolicyDraftWorkType,
      getManagementWorkPolicyPrimaryWeeklyHolidayDay,
      getManagementWorkPolicyWorkingDaysFromDayRules,
      normalizeManagementWorkPolicyBoolean,
      normalizeManagementWorkPolicyEmploymentTargetType,
      normalizeManagementWorkPolicyEnum,
      normalizeManagementWorkPolicyNumber,
      normalizeManagementWorkPolicyPayload,
      parseManagementWorkPolicyTimeValue,
      sortManagementWorkPolicyAutoBreakRanges,
    });
    const {
      buildManagementWorkPolicyPayloadFromForm,
    } = workPolicyPayloadBuilder;

    async function submitManagementWorkPolicyForm() {
      const form = document.getElementById("management-work-policy-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("근로정책 관리 폼을 찾을 수 없습니다.");
      }

      setInlineMessage(document.getElementById("management-work-policy-error"), "");

      const formData = new FormData(form);
      const payload = buildManagementWorkPolicyPayloadFromForm(formData, { validate: true });
      const { dailyMaxMinutes, standardDailyMinutes, standardRule, maximumRule, workingDays } = payload;

      if (workingDays.length === 0) {
        throw new Error("근로 요일을 하나 이상 선택하세요.");
      }

      if (standardDailyMinutes > dailyMaxMinutes) {
        throw new Error("소정근로시간이 연장근로 최대기준보다 클 수 없습니다.");
      }

      if (Number(standardRule?.standardWeeklyMinutes || 0) > Number(maximumRule?.weeklyMaxMinutes || 0)) {
        throw new Error("주 소정근로시간이 주 연장근로 최대기준보다 클 수 없습니다.");
      }

      const targetPolicyId = String(state.managementWorkPolicyDraft?.policyId || "").trim();

      const savedPolicy = await api.requestWithAutoRefresh(
        targetPolicyId
          ? `/v1/orgs/${state.selectedOrganizationId}/work-policies/${targetPolicyId}`
          : `/v1/orgs/${state.selectedOrganizationId}/work-policies`,
        {
          body: JSON.stringify(payload),
          method: targetPolicyId ? "PATCH" : "POST",
        },
      );

      closeManagementWorkPolicyTimePickers();
      state.managementWorkPolicyDraft = createEmptyManagementWorkPolicyDraft("edit", String(savedPolicy?.id || targetPolicyId || "").trim());
      state.managementWorkPolicyModalOpen = true;
      await refreshWorkspaceData();
      return savedPolicy;
    }

    async function deleteManagementWorkPolicy(policyId = "") {
      const normalizedPolicyId = String(policyId || "").trim();
      const policy = getManagementWorkPolicyById(normalizedPolicyId);

      if (!normalizedPolicyId || !policy) {
        return;
      }

      const label = String(policy?.workInformation?.policyName || policy?.name || "근로정책").trim() || "근로정책";
      const confirmed = window.confirm(`"${label}"을(를) 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/work-policies/${normalizedPolicyId}`, {
        method: "DELETE",
      });

      if (String(state.managementWorkPolicyDraft?.policyId || "").trim() === normalizedPolicyId) {
        closeManagementWorkPolicyTimePickers();
        state.managementWorkPolicyDraft = createEmptyManagementWorkPolicyDraft("create");
        state.managementWorkPolicyModalOpen = false;
      }

      await refreshWorkspaceData();
    }

    return Object.freeze({
      closeManagementWorkPolicyModal,
      closeManagementWorkPolicyTimePickers,
      deleteManagementWorkPolicy,
      handleManagementWorkPolicyTimeOptionClick,
      openManagementWorkPolicyModal,
      readManagementWorkPolicyDraftFromDom,
      resetManagementWorkPolicyDraft,
      setManagementWorkPolicyTimePickerOpen,
      submitManagementWorkPolicyForm,
      updateManagementWorkPolicyStageMetrics,
    });
  }

  return Object.freeze({
    create: createWorkPolicyController,
  });
});
