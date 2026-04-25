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
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyWorkingDays,
      toArray,
    } = deps;

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
      return formatManagementWorkScheduleDayLabel(toArray(dayNumbers).map((dayOfWeek) => ({ dayOfWeek })));
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

    function renderManagementWorkPolicyDayOptions(info = {}) {
      const selectedDays = new Set(normalizeManagementPolicyWorkingDays(info.workingDays, [1, 2, 3, 4, 5]).map((day) => Number(day)));

      return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => `
      <label class="checkbox-field workmate-work-policy-day-option">
        <input name="workingDays" type="checkbox" value="${escapeAttribute(dayOfWeek)}"${selectedDays.has(dayOfWeek) ? " checked" : ""} />
        <span>${escapeHtml(getManagementWorkScheduleDayName(dayOfWeek))}</span>
      </label>
    `).join("");
    }

    function renderManagementWorkPolicyDurationOptions(type = "hour", selectedMinutes = 0, maxMinutes = 1440) {
      const normalizedMaxMinutes = Math.max(0, Math.round(Number(maxMinutes) || 1440));
      const maxHour = Math.floor(normalizedMaxMinutes / 60);
      const maxMinute = normalizedMaxMinutes % 60;
      const normalizedMinutes = Math.max(0, Math.min(normalizedMaxMinutes, Math.round(Number(selectedMinutes) || 0)));
      const selectedHour = Math.floor(normalizedMinutes / 60);
      const selectedMinute = normalizedMinutes % 60;
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
      idBase = "",
      label = "",
      maxMinutes = 1440,
      minutes = 0,
      name = "",
    } = {}) {
      const value = formatManagementPolicyTimeInput(Math.min(Number(minutes) || 0, Number(maxMinutes) || 1440));
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

    function renderManagementWorkPolicySelectOptions(options = [], selectedValue = "") {
      const normalizedSelectedValue = String(selectedValue || "").trim().toUpperCase();

      return toArray(options).map((option) => {
        const value = String(option?.value || "").trim();

        return `<option value="${escapeAttribute(value)}"${value === normalizedSelectedValue ? " selected" : ""}>${escapeHtml(option?.label || value)}</option>`;
      }).join("");
    }

    function renderManagementWorkPolicyTargetChecklist(name = "", items = [], selectedIds = [], emptyLabel = "선택할 항목이 없습니다.") {
      const selectedIdSet = new Set(normalizeManagementPolicyStringList(selectedIds));
      const records = toArray(items).filter((item) => String(item?.id || "").trim());

      if (records.length === 0) {
        return `<span class="workmate-work-policy-target-empty">${escapeHtml(emptyLabel)}</span>`;
      }

      return records.map((item) => {
        const itemId = String(item?.id || "").trim();
        const itemName = String(item?.pathLabel || item?.name || item?.code || itemId).trim();

        return `
        <label class="checkbox-field workmate-work-policy-target-option">
          <input name="${escapeAttribute(name)}" type="checkbox" value="${escapeAttribute(itemId)}"${selectedIdSet.has(itemId) ? " checked" : ""} />
          <span>${escapeHtml(itemName)}</span>
        </label>
      `;
      }).join("");
    }

    function renderManagementWorkPolicyAdjustmentOptions(adjustment = {}, index = 0) {
      const appliesTo = new Set(normalizeManagementPolicyStringList(adjustment.appliesTo || ["WEEK", "MONTH"]));

      return `
      <div class="workmate-work-policy-adjustment-options">
        <label class="checkbox-field workmate-work-policy-toggle">
          <input name="minimumAdjustmentOnlyIfWorkingDay_${escapeAttribute(index)}" type="checkbox"${normalizeManagementPolicyBoolean(adjustment.onlyIfWorkingDay, true) ? " checked" : ""} />
          <span>근로일인 경우만</span>
        </label>
        <label class="checkbox-field workmate-work-policy-toggle">
          <input name="minimumAdjustmentSkipIfHoliday_${escapeAttribute(index)}" type="checkbox"${normalizeManagementPolicyBoolean(adjustment.skipIfHoliday, true) ? " checked" : ""} />
          <span>공휴일이면 제외</span>
        </label>
        ${["DAY", "WEEK", "MONTH"].map((unit) => `
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="minimumAdjustmentAppliesTo_${escapeAttribute(index)}" type="checkbox" value="${escapeAttribute(unit)}"${appliesTo.has(unit) ? " checked" : ""} />
            <span>${escapeHtml(unit === "DAY" ? "일 반영" : unit === "WEEK" ? "주 반영" : "월 반영")}</span>
          </label>
        `).join("")}
      </div>
    `;
    }

    return Object.freeze({
      formatManagementPolicyDayLabel,
      formatManagementPolicyHolidayLabel,
      formatManagementPolicyTimeInput,
      renderManagementWorkPolicyAdjustmentOptions,
      renderManagementWorkPolicyDayOptions,
      renderManagementWorkPolicySelectOptions,
      renderManagementWorkPolicyTargetChecklist,
      renderManagementWorkPolicyTimeField,
    });
  }

  return Object.freeze({
    create,
  });
});
