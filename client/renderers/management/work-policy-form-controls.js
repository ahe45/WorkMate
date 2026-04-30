(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyFormControls = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatManagementWorkScheduleDayLabel,
      getManagementWorkScheduleDayName,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyWorkingDays,
      toArray,
    } = deps;
    const MANAGEMENT_POLICY_WORKING_DAY_ORDER = [7, 1, 2, 3, 4, 5, 6];

    function formatManagementPolicyTimeInput(minutes = 0) {
      const numericMinutes = Number(minutes);

      if (!Number.isFinite(numericMinutes)) {
        return "";
      }

      const normalizedMinutes = Math.max(0, Math.round(numericMinutes));
      const hours = Math.floor(normalizedMinutes / 60);
      const minute = normalizedMinutes % 60;

      return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    function formatManagementPolicyDayLabel(dayNumbers = []) {
      const normalizedDayNumbers = Array.from(new Set(toArray(dayNumbers)
        .map((dayOfWeek) => Number(dayOfWeek))
        .filter((dayOfWeek) => Number.isInteger(dayOfWeek) && dayOfWeek >= 1 && dayOfWeek <= 7)))
        .sort((left, right) => MANAGEMENT_POLICY_WORKING_DAY_ORDER.indexOf(left) - MANAGEMENT_POLICY_WORKING_DAY_ORDER.indexOf(right));

      return normalizedDayNumbers.length > 0
        ? normalizedDayNumbers.map((dayOfWeek) => getManagementWorkScheduleDayName(dayOfWeek)).join(", ")
        : formatManagementWorkScheduleDayLabel([]);
    }

    function formatManagementPolicyHolidayLabel(info = {}) {
      const labels = [];

      if (info.includeWeekends) {
        labels.push("주말");
      }

      if (info.includePublicHolidays) {
        labels.push("공휴일");
      }

      if (info.includeSubstituteHolidays) {
        labels.push("대체공휴일");
      }

      if (info.includeCustomHolidays) {
        labels.push("지정 공휴일");
      }

      return labels.length > 0 ? labels.join(", ") : "휴일 제외";
    }

    function renderManagementWorkPolicyDayRules(info = {}) {
      const useBlankSelection = Boolean(info?.isCreateBlank);
      const dayRules = useBlankSelection && Array.isArray(info?.dayRules) && info.dayRules.length > 0
        ? info.dayRules
        : typeof normalizeManagementPolicyDayRules === "function"
          ? normalizeManagementPolicyDayRules(info.dayRules, info)
          : MANAGEMENT_POLICY_WORKING_DAY_ORDER.map((dayOfWeek) => ({ dayOfWeek, type: dayOfWeek >= 1 && dayOfWeek <= 5 ? "WORK" : dayOfWeek === 7 ? "PAID_HOLIDAY" : "UNPAID_OFF" }));
      const dayRuleTypeByDay = dayRules.reduce((map, rule) => {
        map.set(Number(rule?.dayOfWeek || 0), String(rule?.type || "").trim().toUpperCase());
        return map;
      }, new Map());
      const options = [
        { label: "근로", value: "WORK" },
        { label: "무급 휴무", value: "UNPAID_OFF" },
        { label: "유급 휴일", value: "PAID_HOLIDAY" },
      ];

      return MANAGEMENT_POLICY_WORKING_DAY_ORDER.map((dayOfWeek) => {
        const selectedType = dayRuleTypeByDay.get(dayOfWeek) || (useBlankSelection ? "" : "UNPAID_OFF");

        return `
        <article class="workmate-work-policy-day-rule-card">
          <strong class="workmate-work-policy-day-rule-name">${escapeHtml(getManagementWorkScheduleDayName(dayOfWeek))}</strong>
          <div class="workmate-work-policy-day-rule-options">
            ${options.map((option) => `
              <label class="workmate-work-policy-day-rule-option">
                <input
                  class="workmate-work-policy-day-rule-input"
                  name="dayRule${escapeAttribute(dayOfWeek)}"
                  type="radio"
                  value="${escapeAttribute(option.value)}"
                  ${selectedType === option.value ? "checked" : ""}
                />
                <span class="workmate-work-policy-day-rule-button">${escapeHtml(option.label)}</span>
              </label>
            `).join("")}
          </div>
        </article>
      `;
      }).join("");
    }

    function renderManagementWorkPolicyDurationOptions(type = "hour", selectedMinutes = 0, maxMinutes = 1440) {
      const normalizedMaxMinutes = Math.max(0, Math.round(Number(maxMinutes) || 1440));
      const maxHour = Math.floor(normalizedMaxMinutes / 60);
      const maxMinute = normalizedMaxMinutes % 60;
      const hasSelection = Number.isFinite(Number(selectedMinutes));
      const normalizedMinutes = hasSelection
        ? Math.max(0, Math.min(normalizedMaxMinutes, Math.round(Number(selectedMinutes) || 0)))
        : Number.NaN;
      const selectedHour = hasSelection ? Math.floor(normalizedMinutes / 60) : null;
      const selectedMinute = hasSelection ? normalizedMinutes % 60 : null;
      const maxValue = type === "hour" ? maxHour : 59;

      return Array.from({ length: maxValue + 1 }, (_, value) => {
        const isMinute = type === "minute";
        const isDisabled = isMinute && selectedHour === maxHour && value > maxMinute;
        const isActive = isMinute ? value === selectedMinute : value === selectedHour;
        const label = String(value).padStart(2, "0");

        return `
        <button
          class="workmate-duration-picker-option${isActive ? " is-active" : ""}"
          data-management-work-policy-time-option="${escapeAttribute(type)}"
          data-management-work-policy-time-value="${escapeAttribute(value)}"
          type="button"
          ${isDisabled ? "disabled" : ""}
        >${escapeHtml(label)}</button>
      `;
      }).join("");
    }

    function renderManagementWorkPolicyTimeField({
      allowBlank = false,
      idBase = "",
      label = "",
      maxMinutes = 1440,
      minutes = 0,
      name = "",
    } = {}) {
      const hasValue = Number.isFinite(Number(minutes));
      const value = allowBlank && !hasValue
        ? ""
        : formatManagementPolicyTimeInput(Math.min(Number(minutes) || 0, Number(maxMinutes) || 1440));
      const panelId = `${idBase}-picker`;

      return `
      <div class="field workmate-work-policy-time-field">
        <span>${escapeHtml(label)}</span>
        <div class="workmate-duration-picker" data-management-work-policy-time-max="${escapeAttribute(maxMinutes)}" data-management-work-policy-time-picker="${escapeAttribute(name)}">
          <input
            data-management-work-policy-time-hidden="${escapeAttribute(name)}"
            id="${escapeAttribute(idBase)}"
            name="${escapeAttribute(name)}"
            required
            type="hidden"
            value="${escapeAttribute(value)}"
          />
          <button
            aria-controls="${escapeAttribute(panelId)}"
            aria-expanded="false"
            class="workmate-duration-picker-trigger"
            data-management-work-policy-time-toggle="${escapeAttribute(name)}"
            type="button"
          >
            <span data-management-work-policy-time-display="${escapeAttribute(name)}">${escapeHtml(value)}</span>
          </button>
          <div class="workmate-duration-picker-panel" data-management-work-policy-time-panel="${escapeAttribute(name)}" hidden id="${escapeAttribute(panelId)}">
            <div class="workmate-duration-picker-column">
              <span>시간</span>
              <div class="workmate-duration-picker-options" data-management-work-policy-time-options="hour">
                ${renderManagementWorkPolicyDurationOptions("hour", minutes, maxMinutes)}
              </div>
            </div>
            <div class="workmate-duration-picker-column">
              <span>분</span>
              <div class="workmate-duration-picker-options" data-management-work-policy-time-options="minute">
                ${renderManagementWorkPolicyDurationOptions("minute", minutes, maxMinutes)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    }

    function renderManagementWorkPolicySelectOptions(options = [], selectedValue = "", placeholderLabel = "") {
      const normalizedSelectedValue = String(selectedValue || "").trim().toUpperCase();

      const placeholderMarkup = placeholderLabel
        ? `<option value=""${!normalizedSelectedValue ? " selected" : ""}>${escapeHtml(placeholderLabel)}</option>`
        : "";

      return `${placeholderMarkup}${toArray(options).map((option) => {
        const value = String(option?.value || "").trim();

        return `<option value="${escapeAttribute(value)}"${value === normalizedSelectedValue ? " selected" : ""}>${escapeHtml(option?.label || value)}</option>`;
      }).join("")}`;
    }

    return Object.freeze({
      formatManagementPolicyDayLabel,
      formatManagementPolicyHolidayLabel,
      formatManagementPolicyTimeInput,
      renderManagementWorkPolicyDayRules,
      renderManagementWorkPolicySelectOptions,
      renderManagementWorkPolicyTimeField,
    });
  }

  return Object.freeze({
    create,
  });
});
