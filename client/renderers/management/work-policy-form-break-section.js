(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyFormBreakSection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      controls,
      escapeAttribute,
    } = deps;

    if (!controls || typeof controls.renderManagementWorkPolicyTimeField !== "function") {
      throw new Error("work-policy-form-break-section requires work policy form controls.");
    }

    function parseManagementWorkPolicyClockTimeToMinutes(value = "") {
      const matched = String(value || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);

      if (!matched) {
        return Number.NaN;
      }

      const hours = Number(matched[1]);
      const minutes = Number(matched[2]);

      if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
        return Number.NaN;
      }

      return (hours * 60) + minutes;
    }

    function normalizeManagementWorkPolicyBreakAutoRange(range = {}) {
      const source = range && typeof range === "object" ? range : {};
      const minimumWorkMinutes = Number(source.minimumWorkMinutes ?? source.autoMinimumWorkMinutes);
      const breakMinutes = Number(source.breakMinutes ?? source.autoBreakMinutes);

      return {
        breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : Number.NaN,
        minimumWorkMinutes: Number.isFinite(minimumWorkMinutes) ? minimumWorkMinutes : Number.NaN,
      };
    }

    function getManagementWorkPolicyBreakAutoRangesForRender(breakRule = {}, { allowBlank = false } = {}) {
      const sourceRanges = Array.isArray(breakRule.autoBreakRanges)
        ? breakRule.autoBreakRanges
        : Array.isArray(breakRule.autoRanges)
          ? breakRule.autoRanges
          : [];
      const ranges = sourceRanges
        .map((range) => normalizeManagementWorkPolicyBreakAutoRange(range))
        .filter((range) => Number.isFinite(range.minimumWorkMinutes) && Number.isFinite(range.breakMinutes))
        .sort((left, right) => left.minimumWorkMinutes - right.minimumWorkMinutes);

      if (ranges.length > 0) {
        return ranges;
      }

      const legacyRange = normalizeManagementWorkPolicyBreakAutoRange(breakRule);

      if (Number.isFinite(legacyRange.minimumWorkMinutes) && Number.isFinite(legacyRange.breakMinutes)) {
        return [legacyRange];
      }

      return [allowBlank
        ? { breakMinutes: Number.NaN, minimumWorkMinutes: Number.NaN }
        : { breakMinutes: 60, minimumWorkMinutes: 480 }];
    }

    function renderManagementWorkPolicyBreakAutoRangeRow(range = {}, index = 0, options = {}) {
      const allowBlank = Boolean(options.allowBlank);
      const canRemove = options.canRemove !== false;
      const normalizedRange = normalizeManagementWorkPolicyBreakAutoRange(range);

      return `
        <article
          class="workmate-work-policy-break-auto-row"
          data-management-work-policy-break-auto-row="true"
          data-management-work-policy-break-auto-row-index="${escapeAttribute(index)}"
        >
          <div class="workmate-work-policy-break-auto-row-grid">
            ${controls.renderManagementWorkPolicyTimeField({
              allowBlank,
              idBase: `management-work-policy-break-auto-minimum-time-${index}`,
              label: "근로시간 이상",
              maxMinutes: 60000,
              minutes: normalizedRange.minimumWorkMinutes,
              name: "breakAutoMinimumTime",
            })}
            ${controls.renderManagementWorkPolicyTimeField({
              allowBlank,
              idBase: `management-work-policy-break-auto-duration-time-${index}`,
              label: "휴게시간 부여",
              maxMinutes: 1440,
              minutes: normalizedRange.breakMinutes,
              name: "breakAutoDurationTime",
            })}
            <div class="workmate-work-policy-break-auto-row-action">
              <button
                aria-label="기준 구간 삭제"
                class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button workmate-work-policy-break-auto-remove"
                data-management-work-policy-break-auto-remove="${escapeAttribute(index)}"
                type="button"
                ${canRemove ? "" : "disabled"}
              >
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4.5 7.5h15"></path>
                  <path d="M9.5 3.5h5"></path>
                  <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                  <path d="M10 10.5v5"></path>
                  <path d="M14 10.5v5"></path>
                </svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }

    function renderManagementWorkPolicyBreakSection(info = {}) {
      const isCreateBlank = Boolean(info?.isCreateBlank);
      const breakRule = info?.breakRule && typeof info.breakRule === "object" ? info.breakRule : {};
      const breakMode = String(breakRule.mode || "").trim().toUpperCase();
      const autoBreakRanges = getManagementWorkPolicyBreakAutoRangesForRender(breakRule, {
        allowBlank: isCreateBlank,
      });

      return `
      <section class="workmate-work-policy-section-stack" id="management-work-policy-break-section">
        <div class="workmate-work-policy-section-head">
          <h5>휴게시간 규칙</h5>
        </div>
        <div class="workmate-work-policy-section">
          <div class="workmate-work-policy-field-grid is-single workmate-work-policy-break-mode-grid">
            <label class="field select-field" for="management-work-policy-break-mode">
              <span>부여 방식</span>
              <select id="management-work-policy-break-mode" name="breakMode">
                ${controls.renderManagementWorkPolicySelectOptions([
                  { label: "자동", value: "AUTO" },
                  { label: "고정", value: "FIXED" },
                ], breakMode, isCreateBlank ? "선택" : "")}
              </select>
            </label>
          </div>
          <div class="workmate-work-policy-break-fields" id="management-work-policy-break-auto-fields"${breakMode === "AUTO" ? "" : " hidden"}>
            <div class="workmate-work-policy-break-auto-header">
              <p class="workmate-work-policy-break-auto-helper">근로시간이 여러 기준에 해당하면 마지막 구간의 휴게시간이 적용됩니다.</p>
              <button class="secondary-button workmate-work-policy-break-auto-add" data-management-work-policy-break-auto-add="true" type="button">기준 구간 추가</button>
            </div>
            <div class="workmate-work-policy-break-auto-list" data-management-work-policy-break-auto-list="true">
              ${autoBreakRanges.map((range, index) => renderManagementWorkPolicyBreakAutoRangeRow(range, index, {
                allowBlank: isCreateBlank,
                canRemove: autoBreakRanges.length > 1,
              })).join("")}
            </div>
          </div>
          <div class="workmate-work-policy-break-fields" id="management-work-policy-break-fixed-fields"${breakMode === "FIXED" ? "" : " hidden"}>
            <div class="workmate-work-policy-field-grid is-two">
              ${controls.renderManagementWorkPolicyTimeField({
                allowBlank: isCreateBlank,
                idBase: "management-work-policy-break-fixed-start-time",
                label: "시작",
                maxMinutes: 1439,
                minutes: parseManagementWorkPolicyClockTimeToMinutes(breakRule.fixedStartTime),
                name: "breakFixedStartTime",
              })}
              ${controls.renderManagementWorkPolicyTimeField({
                allowBlank: isCreateBlank,
                idBase: "management-work-policy-break-fixed-end-time",
                label: "종료",
                maxMinutes: 1439,
                minutes: parseManagementWorkPolicyClockTimeToMinutes(breakRule.fixedEndTime),
                name: "breakFixedEndTime",
              })}
            </div>
          </div>
        </div>
      </section>
    `;
    }

    return Object.freeze({
      renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementWorkPolicyBreakSection,
    });
  }

  return Object.freeze({
    create,
  });
});
