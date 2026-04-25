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

    function updateManagementWorkPolicyStageMetrics() {
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
          ["min", metric.minLabel],
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

    function closeManagementWorkPolicyTimePickers(exceptPicker = null) {
      document.querySelectorAll("[data-management-work-policy-time-picker]").forEach((picker) => {
        if (!(picker instanceof HTMLElement) || picker === exceptPicker) {
          return;
        }

        const trigger = picker.querySelector("[data-management-work-policy-time-toggle]");
        const panel = picker.querySelector("[data-management-work-policy-time-panel]");

        picker.classList.remove("is-open");

        if (trigger instanceof HTMLElement) {
          trigger.setAttribute("aria-expanded", "false");
        }

        if (panel instanceof HTMLElement) {
          panel.hidden = true;
        }
      });
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

    function readManagementWorkPolicyMinutes(formData, fieldName, label, minMinutes = 0, maxMinutes = 1440) {
      const totalMinutes = parseManagementWorkPolicyTimeValue(formData.get(fieldName));

      if (!Number.isFinite(totalMinutes) || totalMinutes < minMinutes || totalMinutes > maxMinutes) {
        throw new Error(`${label}을(를) 올바르게 입력하세요.`);
      }

      return totalMinutes;
    }

    function readManagementWorkPolicyMinutesForPayload(formData, fieldName, label, minMinutes = 0, maxMinutes = 1440, { validate = true } = {}) {
      try {
        return readManagementWorkPolicyMinutes(formData, fieldName, label, minMinutes, maxMinutes);
      } catch (error) {
        if (validate) {
          throw error;
        }

        return Number.NaN;
      }
    }

    function readManagementWorkPolicyAdjustmentPayload(formData, { validate = true } = {}) {
      const indexes = new Set();

      Array.from(formData.keys()).forEach((key) => {
        const matched = String(key || "").match(/^minimumAdjustment(?:Name|Type|RepeatUnit|DayOfWeek|DayOfMonth|Minutes|OnlyIfWorkingDay|SkipIfHoliday|AppliesTo)_(\d+)$/);

        if (matched) {
          indexes.add(Number(matched[1]));
        }
      });

      return Array.from(indexes).sort((left, right) => left - right).map((index) => {
        const name = String(formData.get(`minimumAdjustmentName_${index}`) || "").trim();
        const minutes = readManagementWorkPolicyMinutesForPayload(
          formData,
          `minimumAdjustmentMinutes_${index}`,
          "최소근로시간 조정 시간",
          0,
          10080,
          { validate: false },
        );
        const hasContent = Boolean(name) || (Number.isFinite(minutes) && minutes > 0);

        if (!hasContent) {
          return null;
        }

        if (validate && (!Number.isFinite(minutes) || minutes <= 0)) {
          throw new Error("최소근로시간 조정 시간을 올바르게 입력하세요.");
        }

        return {
          appliesTo: formData.getAll(`minimumAdjustmentAppliesTo_${index}`).map((value) => String(value || "").trim()).filter(Boolean),
          dayOfMonth: Number(formData.get(`minimumAdjustmentDayOfMonth_${index}`) || 1),
          dayOfWeek: Number(formData.get(`minimumAdjustmentDayOfWeek_${index}`) || 5),
          minutes: Number.isFinite(minutes) ? minutes : 0,
          name: name || "근로시간 조정",
          onlyIfWorkingDay: formData.has(`minimumAdjustmentOnlyIfWorkingDay_${index}`),
          repeatUnit: String(formData.get(`minimumAdjustmentRepeatUnit_${index}`) || "WEEK").trim().toUpperCase(),
          skipIfHoliday: formData.has(`minimumAdjustmentSkipIfHoliday_${index}`),
          type: String(formData.get(`minimumAdjustmentType_${index}`) || "DEDUCT").trim().toUpperCase(),
        };
      }).filter(Boolean);
    }

    function buildManagementWorkPolicyPayloadFromForm(formData, { validate = true } = {}) {
      const workingDays = formData.getAll("workingDays")
        .map((value) => Number(value))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
      const standardDailyMinutes = readManagementWorkPolicyMinutesForPayload(formData, "standardDailyTime", "하루 소정근로시간", 1, 1440, { validate });
      const dailyMinMinutes = readManagementWorkPolicyMinutesForPayload(formData, "dailyMinTime", "하루 최소근로시간", 0, 1440, { validate });
      const dailyMaxMinutes = readManagementWorkPolicyMinutesForPayload(formData, "dailyMaxTime", "일 최대근로시간", 1, 1440, { validate });
      const standardWeeklyMinutes = readManagementWorkPolicyMinutesForPayload(formData, "standardWeeklyTime", "주 고정 소정시간", 0, 10080, { validate });
      const standardMonthlyMinutes = readManagementWorkPolicyMinutesForPayload(formData, "standardMonthlyTime", "월 고정 소정시간", 0, 60000, { validate });
      const weeklyMinMinutes = readManagementWorkPolicyMinutesForPayload(formData, "minimumWeeklyTime", "주 고정 최소근로시간", 0, 10080, { validate });
      const monthlyMinMinutes = readManagementWorkPolicyMinutesForPayload(formData, "minimumMonthlyTime", "월 고정 최소근로시간", 0, 60000, { validate });
      const weeklyMaxMinutes = readManagementWorkPolicyMinutesForPayload(formData, "weeklyMaxTime", "주 최대근로시간", 1, 10080, { validate });
      const monthlyMaxMinutes = readManagementWorkPolicyMinutesForPayload(formData, "monthlyMaxTime", "월 고정 최대근로시간", 0, 60000, { validate });

      return {
        dailyMaxMinutes,
        dailyMinMinutes,
        includeCustomHolidays: !formData.has("excludeCustomHolidays"),
        includePublicHolidays: !formData.has("excludePublicHolidays"),
        includeSubstituteHolidays: !formData.has("excludeSubstituteHolidays"),
        includeWeekends: formData.has("includeWeekends"),
        maximumRule: {
          alertOnDailyLimit: formData.has("alertOnDailyLimit"),
          alertOnRestTime: formData.has("alertOnRestTime"),
          alertOnWeeklyLimit: formData.has("alertOnWeeklyLimit"),
          dailyMaxMinutes,
          monthlyMaxMethod: String(formData.get("monthlyMaxMethod") || "WEEKLY_LIMIT_PRORATED").trim().toUpperCase(),
          monthlyMaxMinutes,
          weeklyMaxMinutes,
        },
        minimumRule: {
          adjustments: readManagementWorkPolicyAdjustmentPayload(formData, { validate }),
          dailyMinMinutes,
          method: String(formData.get("minimumMethod") || "DAILY_MIN_SUM").trim().toUpperCase(),
          monthlyMinMinutes,
          weeklyMinMinutes,
        },
        policyName: String(formData.get("policyName") || "기본 근로정보").trim(),
        settlementRule: {
          customPeriodEndDay: Number(formData.get("customPeriodEndDay") || 31),
          customPeriodStartDay: Number(formData.get("customPeriodStartDay") || 1),
          excludeCustomHolidays: formData.has("excludeCustomHolidays"),
          excludePublicHolidays: formData.has("excludePublicHolidays"),
          excludeSubstituteHolidays: formData.has("excludeSubstituteHolidays"),
          monthBasis: String(formData.get("monthBasis") || "CALENDAR_MONTH").trim().toUpperCase(),
          unit: String(formData.get("settlementUnit") || "MONTH").trim().toUpperCase(),
          weekStartsOn: Number(formData.get("weekStartsOn") || 1),
        },
        standardDailyMinutes,
        standardRule: {
          method: String(formData.get("standardMethod") || "WORKING_DAYS_TIMES_DAILY_STANDARD").trim().toUpperCase(),
          standardMonthlyMinutes,
          standardWeeklyMinutes,
        },
        targetRule: {
          jobTitleIds: formData.getAll("targetJobTitleIds").map((value) => String(value || "").trim()).filter(Boolean),
          scope: String(formData.get("targetScope") || "ORGANIZATION").trim().toUpperCase(),
          siteIds: formData.getAll("targetSiteIds").map((value) => String(value || "").trim()).filter(Boolean),
          unitIds: formData.getAll("targetUnitIds").map((value) => String(value || "").trim()).filter(Boolean),
        },
        workType: String(formData.get("workType") || "FIXED").trim().toUpperCase(),
        workingDays,
      };
    }

    async function submitManagementWorkPolicyForm() {
      const form = document.getElementById("management-work-policy-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("근로정책 설정 폼을 찾을 수 없습니다.");
      }

      setInlineMessage(document.getElementById("management-work-policy-error"), "");

      const formData = new FormData(form);
      const payload = buildManagementWorkPolicyPayloadFromForm(formData, { validate: true });
      const { dailyMaxMinutes, dailyMinMinutes, standardDailyMinutes, workingDays } = payload;

      if (workingDays.length === 0) {
        throw new Error("근로 요일을 하나 이상 선택하세요.");
      }

      if (dailyMinMinutes > standardDailyMinutes) {
        throw new Error("최소 근로시간은 하루 기준 근로시간보다 클 수 없습니다.");
      }

      if (standardDailyMinutes > dailyMaxMinutes) {
        throw new Error("하루 기준 근로시간은 최대 근로시간보다 클 수 없습니다.");
      }

      const targetPolicyId = String(state.managementWorkPolicyDraft?.policyId || "").trim();

      await api.requestWithAutoRefresh(
        targetPolicyId
          ? `/v1/orgs/${state.selectedOrganizationId}/work-policies/${targetPolicyId}`
          : `/v1/orgs/${state.selectedOrganizationId}/work-policies`,
        {
          body: JSON.stringify(payload),
          method: targetPolicyId ? "PATCH" : "POST",
        },
      );

      closeManagementWorkPolicyTimePickers();
      state.managementWorkPolicyDraft = createEmptyManagementWorkPolicyDraft("create");
      state.managementWorkPolicyModalOpen = false;
      await refreshWorkspaceData();
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
