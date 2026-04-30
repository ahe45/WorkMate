(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyFormSections = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatManagementWorkScheduleDayLabel,
      getManagementWorkPolicyInformation,
      getManagementWorkScheduleDayName,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyContractualRule,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyWorkingDays,
      renderEmptyState,
      toArray,
    } = deps;

    const controlsModule = globalThis.WorkMateWorkPolicyFormControls
      || (typeof require === "function" ? require("./work-policy-form-controls.js") : null);
    const breakSectionModule = globalThis.WorkMateWorkPolicyFormBreakSection
      || (typeof require === "function" ? require("./work-policy-form-break-section.js") : null);

    if (!controlsModule || typeof controlsModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-form-controls.js must be loaded before client/renderers/management/work-policy-form-sections.js.");
    }

    if (!breakSectionModule || typeof breakSectionModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-form-break-section.js must be loaded before client/renderers/management/work-policy-form-sections.js.");
    }

    const controls = controlsModule.create({
      escapeAttribute,
      escapeHtml,
      formatManagementWorkScheduleDayLabel,
      getManagementWorkScheduleDayName,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyWorkingDays,
      toArray,
    });
    const breakSection = breakSectionModule.create({
      controls,
      escapeAttribute,
    });

    function formatManagementWorkPolicyCurrencyValue(value = 0) {
      const hasValue = value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));

      if (!hasValue) {
        return "";
      }

      const numericValue = Math.max(0, Math.round(Number(value) || 0));
      return new Intl.NumberFormat("ko-KR").format(numericValue);
    }

    function createEmptyManagementWorkPolicyInfo() {
      const emptyDayRules = [7, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        type: "",
      }));

      return {
        breakRule: {
          autoBreakMinutes: Number.NaN,
          autoBreakRanges: [],
          autoMinimumWorkMinutes: Number.NaN,
          fixedEndTime: "",
          fixedStartTime: "",
          mode: "",
        },
        contractualRule: {
          customPeriodEndDay: "",
          customPeriodStartDay: "",
          includeHolidays: false,
          includePublicHolidays: false,
          minutes: Number.NaN,
          monthBasis: "",
          overtimeLimitMinutes: Number.NaN,
          overtimeLimitUnit: "",
          overtimeMinimumMinutes: Number.NaN,
          overtimeMinimumUnit: "",
          periodCount: "",
          periodUnit: "",
          unit: "",
          weekStartsOn: "",
        },
        dayRules: emptyDayRules,
        employmentTargetType: "",
        hourlyWage: "",
        isCreateBlank: true,
        policyName: "",
        targetRule: { scope: "ORGANIZATION" },
        weeklyHolidayDay: "",
        workingDays: [],
      };
    }

    function buildManagementWorkPolicyModel(state = {}, stats = {}, options = {}) {
      const workPolicies = toArray(stats.workPolicies);
      const normalizedPolicyId = String(options.policyId || state.managementWorkPolicyDraft?.policyId || "").trim();
      const mode = String(options.mode || state.managementWorkPolicyDraft?.mode || "edit").trim().toLowerCase();
      const defaultPolicy = stats.workPolicy
        || state.bootstrap?.workPolicy
        || workPolicies.find((policyEntry) => Boolean(policyEntry?.isDefault))
        || workPolicies[0]
        || null;
      let policy = normalizedPolicyId
        ? workPolicies.find((policyEntry) => String(policyEntry?.id || "").trim() === normalizedPolicyId) || null
        : defaultPolicy;

      const info = mode === "create"
        ? createEmptyManagementWorkPolicyInfo()
        : getManagementWorkPolicyInformation(policy || {});

      return {
        hasPolicy: Boolean(policy) || mode === "create",
        info,
        policy: mode === "create" ? null : policy,
      };
    }

    function renderManagementWorkPolicyWeekdayOptions(selectedDay = 7, placeholderLabel = "") {
      const normalizedSelectedDay = Number(selectedDay);
      const placeholderMarkup = placeholderLabel
        ? `<option value=""${!Number.isInteger(normalizedSelectedDay) ? " selected" : ""}>${escapeHtml(placeholderLabel)}</option>`
        : "";
      const options = [1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${escapeAttribute(day)}"${normalizedSelectedDay === day ? " selected" : ""}>${escapeHtml(getManagementWorkScheduleDayName(day))}</option>`).join("");
      return `${placeholderMarkup}${options}`;
    }

    function getManagementWorkPolicyPreviousDay(dayOfWeek = 1) {
      const numericDay = Number(dayOfWeek);
      return numericDay <= 1 ? 7 : numericDay - 1;
    }

    function renderManagementWorkPolicyMonthDayOptions(selectedDay = 1, placeholderLabel = "") {
      const normalizedSelectedDay = Number(selectedDay);
      const placeholderMarkup = placeholderLabel
        ? `<option value=""${!Number.isInteger(normalizedSelectedDay) ? " selected" : ""}>${escapeHtml(placeholderLabel)}</option>`
        : "";
      const options = Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        const label = day === 31 ? "말일" : `${day}일`;
        return `<option value="${escapeAttribute(day)}"${normalizedSelectedDay === day ? " selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");
      return `${placeholderMarkup}${options}`;
    }

    function renderManagementWorkPolicySharedPeriodFields(rule = {}, { allowBlank = false } = {}) {
      const rawPeriodUnit = String(rule.periodUnit || "").trim().toUpperCase();
      const periodUnit = rawPeriodUnit === "CUSTOM" ? "MONTH" : rawPeriodUnit;
      const weekStartsOn = allowBlank && !rule.weekStartsOn ? "" : Number(rule.weekStartsOn || 1);
      const monthStartDay = allowBlank && !rule.customPeriodStartDay
        ? ""
        : rule.monthBasis === "CUSTOM_PERIOD"
          ? Number(rule.customPeriodStartDay || 1)
          : 1;
      const monthEndDay = allowBlank && !rule.customPeriodEndDay
        ? ""
        : rule.monthBasis === "CUSTOM_PERIOD"
          ? Number(rule.customPeriodEndDay || 31)
          : 31;

      return `
        <div class="workmate-work-policy-period-layout" id="management-work-policy-period-layout">
          <div class="workmate-work-policy-period-group">
            <span class="workmate-work-policy-period-group-title">단위 기간</span>
            <div class="workmate-work-policy-field-grid is-two">
              <label class="field" for="management-work-policy-period-count">
                <span>기간</span>
                <input id="management-work-policy-period-count" max="365" min="1" name="periodCount" step="1" type="number" value="${escapeAttribute(allowBlank && !rule.periodCount ? "" : rule.periodCount || 1)}" />
              </label>
              <label class="field select-field" for="management-work-policy-period-unit">
                <span>단위</span>
                <select id="management-work-policy-period-unit" name="periodUnit">
                  ${controls.renderManagementWorkPolicySelectOptions([
                    { label: "일", value: "DAY" },
                    { label: "주", value: "WEEK" },
                    { label: "개월", value: "MONTH" },
                  ], periodUnit, allowBlank ? "선택" : "")}
                </select>
              </label>
            </div>
          </div>
          <div class="workmate-work-policy-period-group workmate-work-policy-period-range-field" id="management-work-policy-period-range-field"${allowBlank && !periodUnit ? " hidden" : ""}>
            <span class="workmate-work-policy-period-group-title">기간 범위</span>
            <div class="workmate-work-policy-field-grid is-two" id="management-work-policy-period-day-range-fields"${periodUnit === "DAY" ? "" : " hidden"}>
              <label class="field select-field" for="management-work-policy-period-day-start">
                <span>시작</span>
                <select id="management-work-policy-period-day-start" disabled>
                  <option selected>-</option>
                </select>
              </label>
              <label class="field select-field" for="management-work-policy-period-day-end">
                <span>종료</span>
                <select id="management-work-policy-period-day-end" disabled>
                  <option selected>-</option>
                </select>
              </label>
            </div>
            <div class="workmate-work-policy-field-grid is-two" id="management-work-policy-period-week-range-fields"${periodUnit === "WEEK" ? "" : " hidden"}>
              <label class="field select-field" for="management-work-policy-period-week-start">
                <span>시작</span>
                <select id="management-work-policy-period-week-start" name="periodWeekStart">
                  ${renderManagementWorkPolicyWeekdayOptions(weekStartsOn, allowBlank ? "선택" : "")}
                </select>
              </label>
              <label class="field select-field" for="management-work-policy-period-week-end">
                <span>종료</span>
                <select id="management-work-policy-period-week-end" name="periodWeekEnd">
                  ${renderManagementWorkPolicyWeekdayOptions(Number.isInteger(Number(weekStartsOn)) ? getManagementWorkPolicyPreviousDay(weekStartsOn) : "", allowBlank ? "선택" : "")}
                </select>
              </label>
            </div>
            <div class="workmate-work-policy-field-grid is-two" id="management-work-policy-period-month-range-fields"${periodUnit === "MONTH" ? "" : " hidden"}>
              <label class="field select-field" for="management-work-policy-period-month-start">
                <span>시작</span>
                <select id="management-work-policy-period-month-start" name="periodMonthStartDay">
                  ${renderManagementWorkPolicyMonthDayOptions(monthStartDay, allowBlank ? "선택" : "")}
                </select>
              </label>
              <label class="field select-field" for="management-work-policy-period-month-end">
                <span>종료</span>
                <select id="management-work-policy-period-month-end" name="periodMonthEndDay">
                  ${renderManagementWorkPolicyMonthDayOptions(monthEndDay, allowBlank ? "선택" : "")}
                </select>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    function renderManagementWorkPolicyIdentitySection(info = {}) {
      const isCreateBlank = Boolean(info?.isCreateBlank);
      const policyName = String(info.policyName || "").trim();
      const employmentTargetType = String(info.employmentTargetType || "").trim().toUpperCase();

      return `
      <section class="workmate-work-policy-section-stack">
        <div class="workmate-work-policy-section-head">
          <h5>기본 정보</h5>
        </div>
        <div class="workmate-work-policy-section">
          <div class="workmate-work-policy-field-grid workmate-work-policy-identity-grid">
            <label class="field" for="management-work-policy-name">
              <span>근로정책명</span>
              <input id="management-work-policy-name" name="policyName" placeholder="예: 본사 주 40시간 정책" type="text" value="${escapeAttribute(policyName)}" />
            </label>
            <label class="field select-field" for="management-work-policy-employment-target-type">
              <span>적용대상</span>
              <select id="management-work-policy-employment-target-type" name="employmentTargetType">
                ${controls.renderManagementWorkPolicySelectOptions([
                  { label: "임직원", value: "FULL_TIME" },
                  { label: "아르바이트", value: "PART_TIME" },
                ], employmentTargetType, isCreateBlank ? "선택" : "")}
              </select>
            </label>
            <label class="field" for="management-work-policy-hourly-wage" id="management-work-policy-hourly-wage-field">
              <span>시급</span>
              <div class="workmate-work-policy-suffix-field">
                <input id="management-work-policy-hourly-wage" inputmode="numeric" name="hourlyWage" pattern="[0-9,]*" placeholder="0" type="text" value="${escapeAttribute(formatManagementWorkPolicyCurrencyValue(info.hourlyWage))}"${employmentTargetType === "PART_TIME" ? "" : " disabled"} />
                <span>원</span>
              </div>
            </label>
          </div>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyWorkingDaySection(info = {}) {
      const sharedPeriodRule = info?.isCreateBlank
        ? (info.contractualRule || {})
        : normalizeManagementPolicyContractualRule(info.contractualRule, info, info.workingDays);

      return `
      <section class="workmate-work-policy-section-stack" id="management-work-policy-working-day-section">
        <div class="workmate-work-policy-section-head">
          <h5>근무일 규칙</h5>
        </div>
        <div class="workmate-work-policy-section">
          <div class="workmate-work-policy-field-grid is-single workmate-work-policy-day-rule-section">
            <div class="field workmate-work-policy-day-field">
              <span>요일별 근무 속성</span>
              <div class="workmate-work-policy-day-rule-grid">
                ${controls.renderManagementWorkPolicyDayRules(info)}
              </div>
            </div>
          </div>
          ${renderManagementWorkPolicySharedPeriodFields(sharedPeriodRule, { allowBlank: Boolean(info?.isCreateBlank) })}
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyContractualSection(info = {}) {
      const isCreateBlank = Boolean(info?.isCreateBlank);
      const rule = isCreateBlank
        ? (info.contractualRule || {})
        : normalizeManagementPolicyContractualRule(info.contractualRule, info, info.workingDays);
      const includeHolidays = normalizeManagementPolicyBoolean(rule.includeHolidays, false);
      const includePublicHolidays = normalizeManagementPolicyBoolean(rule.includePublicHolidays, false);

      return `
      <section class="workmate-work-policy-section-stack" id="management-work-policy-contractual-section">
        <div class="workmate-work-policy-section-head">
          <h5>근로시간 규칙</h5>
        </div>
        <div class="workmate-work-policy-section">
          <div class="workmate-work-policy-field-grid workmate-work-policy-contractual-options-grid">
            <label class="field select-field" for="management-work-policy-contractual-unit">
              <span>기준 단위</span>
              <select id="management-work-policy-contractual-unit" name="contractualUnit">
                ${controls.renderManagementWorkPolicySelectOptions([
                  { label: "1일", value: "DAY" },
                  { label: "1주", value: "WEEK" },
                  { label: "1개월", value: "MONTH" },
                ], rule.unit, isCreateBlank ? "선택" : "")}
              </select>
            </label>
            <div class="field workmate-work-policy-contractual-holiday-field">
              <span>휴일 포함</span>
              <div class="workmate-work-policy-contractual-holiday-options">
                <label class="checkbox-field workmate-work-policy-toggle">
                  <input name="includeHolidays" type="checkbox"${includeHolidays ? " checked" : ""} />
                  <span>유급 휴일</span>
                </label>
                <label class="checkbox-field workmate-work-policy-toggle">
                  <input name="includePublicHolidays" type="checkbox"${includePublicHolidays ? " checked" : ""} />
                  <span>공휴일</span>
                </label>
              </div>
            </div>
          </div>
          <div class="workmate-work-policy-field-grid workmate-work-policy-contractual-time-grid">
            ${controls.renderManagementWorkPolicyTimeField({
              allowBlank: isCreateBlank,
              idBase: "management-work-policy-contractual-time",
              label: "소정근로시간",
              maxMinutes: 60000,
              minutes: rule.minutes,
              name: "contractualTime",
            })}
            ${controls.renderManagementWorkPolicyTimeField({
              allowBlank: isCreateBlank,
              idBase: "management-work-policy-overtime-min-time",
              label: "연장근로 최소기준",
              maxMinutes: 60000,
              minutes: rule.overtimeMinimumMinutes,
              name: "overtimeMinimumTime",
            })}
            ${controls.renderManagementWorkPolicyTimeField({
              allowBlank: isCreateBlank,
              idBase: "management-work-policy-overtime-limit-time",
              label: "연장근로 최대기준",
              maxMinutes: 60000,
              minutes: rule.overtimeLimitMinutes,
              name: "overtimeLimitTime",
            })}
          </div>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyForm(model = {}, stats = {}) {
      if (!model.hasPolicy) {
        return renderEmptyState("기본 근무 정책을 찾을 수 없습니다.", "회사 기본 근무 정책이 생성된 뒤 근로정보를 설정할 수 있습니다.");
      }

      const info = model.info || getManagementWorkPolicyInformation(model.policy || {});

      return `
      <form class="workmate-form-stack workmate-work-policy-form" id="management-work-policy-form">
        ${renderManagementWorkPolicyIdentitySection(info)}
        ${renderManagementWorkPolicyWorkingDaySection(info)}
        ${renderManagementWorkPolicyContractualSection(info)}
        ${breakSection.renderManagementWorkPolicyBreakSection(info)}
        <p class="login-error hidden" id="management-work-policy-error" aria-live="polite"></p>
      </form>
    `;
    }

    return Object.freeze({
      buildManagementWorkPolicyModel,
      formatManagementPolicyTimeInput: controls.formatManagementPolicyTimeInput,
      renderManagementWorkPolicyBreakAutoRangeRow: breakSection.renderManagementWorkPolicyBreakAutoRangeRow,
      renderManagementWorkPolicyForm,
    });
  }

  return Object.freeze({
    create,
  });
});
