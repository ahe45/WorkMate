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
      formatManagementPolicyDuration,
      formatManagementWorkScheduleDayLabel,
      getManagementWorkPolicyInformation,
      getManagementWorkScheduleDayName,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMinimumRule,
      normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyTargetRule,
      normalizeManagementPolicyWorkingDays,
      renderEmptyState,
      toArray,
    } = deps;

    const controlsModule = globalThis.WorkMateWorkPolicyFormControls
      || (typeof require === "function" ? require("./work-policy-form-controls.js") : null);

    if (!controlsModule || typeof controlsModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-form-controls.js must be loaded before client/renderers/management/work-policy-form-sections.js.");
    }

    const controls = controlsModule.create({
      escapeAttribute,
      escapeHtml,
      formatManagementWorkScheduleDayLabel,
      getManagementWorkScheduleDayName,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyWorkingDays,
      toArray,
    });

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

      if (mode === "create") {
        const templatePolicy = defaultPolicy || null;
        const nextPolicyName = `근로정책 ${(workPolicies.length || (defaultPolicy ? 1 : 0)) + 1}`;
        const templatePolicyJson = templatePolicy?.policyJson && typeof templatePolicy.policyJson === "object"
          ? templatePolicy.policyJson
          : {};
        const templateWorkInformation = templatePolicyJson.workInformation && typeof templatePolicyJson.workInformation === "object"
          ? templatePolicyJson.workInformation
          : {};

        policy = {
          ...(templatePolicy || {}),
          id: "",
          isDefault: false,
          name: nextPolicyName,
          policyJson: {
            ...templatePolicyJson,
            workInformation: {
              ...templateWorkInformation,
              policyName: nextPolicyName,
            },
          },
        };
      }

      const info = getManagementWorkPolicyInformation(policy || {});

      return {
        hasPolicy: Boolean(policy) || mode === "create",
        info,
        policy,
      };
    }

    function renderManagementWorkPolicyTargetSection(info = {}, stats = {}) {
      const targetRule = info.targetRule || normalizeManagementPolicyTargetRule();

      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>적용 대상</h5>
          <span>${escapeHtml(info.policyName || "기본 근로정보")}</span>
        </div>
        <div class="workmate-work-policy-field-grid">
          <label class="field" for="management-work-policy-name">
            <span>정책명</span>
            <input id="management-work-policy-name" name="policyName" placeholder="예: 본사 선택근무 정책" type="text" value="${escapeAttribute(info.policyName || "기본 근로정보")}" />
          </label>
          <label class="field select-field" for="management-work-policy-type">
            <span>근로제 유형</span>
            <select id="management-work-policy-type" name="workType">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "고정근로", value: "FIXED" },
                { label: "선택적 근로시간제", value: "SELECTIVE" },
                { label: "탄력적 근로시간제", value: "FLEXIBLE" },
                { label: "스케줄 기반", value: "SCHEDULE_BASED" },
                { label: "간주근로", value: "DEEMED" },
                { label: "재량근로", value: "DISCRETIONARY" },
              ], info.workType)}
            </select>
          </label>
          <label class="field select-field" for="management-work-policy-target-scope">
            <span>적용 범위</span>
            <select id="management-work-policy-target-scope" name="targetScope">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "전체 회사", value: "ORGANIZATION" },
                { label: "조직 선택", value: "UNITS" },
                { label: "직급 선택", value: "JOB_TITLES" },
                { label: "근무지 선택", value: "SITES" },
                { label: "혼합 선택", value: "MIXED" },
              ], targetRule.scope)}
            </select>
          </label>
        </div>
        <div class="workmate-work-policy-target-grid">
          <div>
            <strong>조직</strong>
            <div>${controls.renderManagementWorkPolicyTargetChecklist("targetUnitIds", stats.units, targetRule.unitIds, "등록된 조직이 없습니다.")}</div>
          </div>
          <div>
            <strong>직급</strong>
            <div>${controls.renderManagementWorkPolicyTargetChecklist("targetJobTitleIds", stats.jobTitles, targetRule.jobTitleIds, "등록된 직급이 없습니다.")}</div>
          </div>
          <div>
            <strong>근무지</strong>
            <div>${controls.renderManagementWorkPolicyTargetChecklist("targetSiteIds", stats.sites, targetRule.siteIds, "등록된 근무지가 없습니다.")}</div>
          </div>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicySettlementSection(info = {}) {
      const rule = info.settlementRule || normalizeManagementPolicySettlementRule();

      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>정산 기준</h5>
          <span>${escapeHtml(rule.unit === "MONTH" ? "월 단위" : rule.unit === "WEEK" ? "주 단위" : rule.unit === "DAY" ? "일 단위" : "사용자 지정")}</span>
        </div>
        <div class="workmate-work-policy-field-grid">
          <label class="field select-field" for="management-work-policy-settlement-unit">
            <span>정산 단위</span>
            <select id="management-work-policy-settlement-unit" name="settlementUnit">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "일", value: "DAY" },
                { label: "주", value: "WEEK" },
                { label: "월", value: "MONTH" },
                { label: "사용자 지정", value: "CUSTOM" },
              ], rule.unit)}
            </select>
          </label>
          <label class="field select-field" for="management-work-policy-week-start">
            <span>주 시작 요일</span>
            <select id="management-work-policy-week-start" name="weekStartsOn">
              ${[1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${escapeAttribute(day)}"${Number(rule.weekStartsOn) === day ? " selected" : ""}>${escapeHtml(getManagementWorkScheduleDayName(day))}</option>`).join("")}
            </select>
          </label>
          <label class="field select-field" for="management-work-policy-month-basis">
            <span>월 정산 기준</span>
            <select id="management-work-policy-month-basis" name="monthBasis">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "매월 1일-말일", value: "CALENDAR_MONTH" },
                { label: "사용자 지정일", value: "CUSTOM_PERIOD" },
              ], rule.monthBasis)}
            </select>
          </label>
        </div>
        <div class="workmate-work-policy-field-grid">
          <label class="field" for="management-work-policy-period-start">
            <span>사용자 지정 시작일</span>
            <input id="management-work-policy-period-start" max="31" min="1" name="customPeriodStartDay" step="1" type="number" value="${escapeAttribute(rule.customPeriodStartDay)}" />
          </label>
          <label class="field" for="management-work-policy-period-end">
            <span>사용자 지정 종료일</span>
            <input id="management-work-policy-period-end" max="31" min="1" name="customPeriodEndDay" step="1" type="number" value="${escapeAttribute(rule.customPeriodEndDay)}" />
          </label>
        </div>
        <div class="workmate-work-policy-toggle-grid">
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="excludePublicHolidays" type="checkbox"${rule.excludePublicHolidays ? " checked" : ""} />
            <span>공휴일 제외</span>
          </label>
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="excludeSubstituteHolidays" type="checkbox"${rule.excludeSubstituteHolidays ? " checked" : ""} />
            <span>대체공휴일 제외</span>
          </label>
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="excludeCustomHolidays" type="checkbox"${rule.excludeCustomHolidays ? " checked" : ""} />
            <span>지정 공휴일 제외</span>
          </label>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyStandardSection(info = {}) {
      const rule = info.standardRule || normalizeManagementPolicyStandardRule();

      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>소정근로시간</h5>
          <span>${escapeHtml(rule.method === "WEEKLY_FIXED" ? "주 고정" : rule.method === "MONTHLY_FIXED" ? "월 고정" : rule.method === "SCHEDULE_TEMPLATE_SUM" ? "스케줄 합산" : "근로일 기준")}</span>
        </div>
        <div class="workmate-work-policy-field-grid">
          <label class="field select-field" for="management-work-policy-standard-method">
            <span>계산 방식</span>
            <select id="management-work-policy-standard-method" name="standardMethod">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "근로일 × 하루 소정근로시간", value: "WORKING_DAYS_TIMES_DAILY_STANDARD" },
                { label: "주 고정 소정시간", value: "WEEKLY_FIXED" },
                { label: "월 고정 소정시간", value: "MONTHLY_FIXED" },
                { label: "스케줄 템플릿 합산", value: "SCHEDULE_TEMPLATE_SUM" },
              ], rule.method)}
            </select>
          </label>
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-standard",
            label: "하루 소정근로시간",
            minutes: info.standardDailyMinutes,
            name: "standardDailyTime",
          })}
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-standard-weekly",
            label: "주 고정 소정시간",
            maxMinutes: 10080,
            minutes: rule.standardWeeklyMinutes,
            name: "standardWeeklyTime",
          })}
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-standard-monthly",
            label: "월 고정 소정시간",
            maxMinutes: 60000,
            minutes: rule.standardMonthlyMinutes,
            name: "standardMonthlyTime",
          })}
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyAdjustmentRow(adjustment = {}, index = 0) {
      const normalizedAdjustment = adjustment || {};

      return `
      <article class="workmate-work-policy-adjustment-row">
        <label class="field" for="management-work-policy-adjustment-name-${escapeAttribute(index)}">
          <span>규칙명</span>
          <input id="management-work-policy-adjustment-name-${escapeAttribute(index)}" name="minimumAdjustmentName_${escapeAttribute(index)}" placeholder="예: 금요일 선택근무 면제" type="text" value="${escapeAttribute(normalizedAdjustment.name || "")}" />
        </label>
        <label class="field select-field" for="management-work-policy-adjustment-type-${escapeAttribute(index)}">
          <span>유형</span>
          <select id="management-work-policy-adjustment-type-${escapeAttribute(index)}" name="minimumAdjustmentType_${escapeAttribute(index)}">
            ${controls.renderManagementWorkPolicySelectOptions([
              { label: "차감", value: "DEDUCT" },
              { label: "가산", value: "ADD" },
            ], normalizedAdjustment.type || "DEDUCT")}
          </select>
        </label>
        <label class="field select-field" for="management-work-policy-adjustment-repeat-${escapeAttribute(index)}">
          <span>반복</span>
          <select id="management-work-policy-adjustment-repeat-${escapeAttribute(index)}" name="minimumAdjustmentRepeatUnit_${escapeAttribute(index)}">
            ${controls.renderManagementWorkPolicySelectOptions([
              { label: "매일", value: "DAY" },
              { label: "매주", value: "WEEK" },
              { label: "매월", value: "MONTH" },
            ], normalizedAdjustment.repeatUnit || "WEEK")}
          </select>
        </label>
        <label class="field select-field" for="management-work-policy-adjustment-day-${escapeAttribute(index)}">
          <span>요일</span>
          <select id="management-work-policy-adjustment-day-${escapeAttribute(index)}" name="minimumAdjustmentDayOfWeek_${escapeAttribute(index)}">
            ${[1, 2, 3, 4, 5, 6, 7].map((day) => `<option value="${escapeAttribute(day)}"${Number(normalizedAdjustment.dayOfWeek || 5) === day ? " selected" : ""}>${escapeHtml(getManagementWorkScheduleDayName(day))}</option>`).join("")}
          </select>
        </label>
        <label class="field" for="management-work-policy-adjustment-month-day-${escapeAttribute(index)}">
          <span>월 반복 일자</span>
          <input id="management-work-policy-adjustment-month-day-${escapeAttribute(index)}" max="31" min="1" name="minimumAdjustmentDayOfMonth_${escapeAttribute(index)}" step="1" type="number" value="${escapeAttribute(normalizedAdjustment.dayOfMonth || 1)}" />
        </label>
        ${controls.renderManagementWorkPolicyTimeField({
          idBase: `management-work-policy-adjustment-minutes-${index}`,
          label: "조정 시간",
          maxMinutes: 10080,
          minutes: normalizedAdjustment.minutes || 0,
          name: `minimumAdjustmentMinutes_${index}`,
        })}
        ${controls.renderManagementWorkPolicyAdjustmentOptions(normalizedAdjustment, index)}
      </article>
    `;
    }

    function renderManagementWorkPolicyMinimumSection(info = {}) {
      const rule = info.minimumRule || normalizeManagementPolicyMinimumRule();
      const adjustmentRows = [...toArray(rule.adjustments), {}];

      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>최소근로시간</h5>
          <span>${escapeHtml(rule.method === "STANDARD_MINUS_ADJUSTMENTS" ? "소정 기준 조정" : rule.method === "SAME_AS_STANDARD" ? "소정과 동일" : rule.method === "FIXED" ? "고정 시간" : "근로일 합산")}</span>
        </div>
        <div class="workmate-work-policy-field-grid">
          <label class="field select-field" for="management-work-policy-minimum-method">
            <span>계산 방식</span>
            <select id="management-work-policy-minimum-method" name="minimumMethod">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "소정근로시간과 동일", value: "SAME_AS_STANDARD" },
                { label: "고정 시간 직접 입력", value: "FIXED" },
                { label: "소정근로시간에서 조정 규칙 적용", value: "STANDARD_MINUS_ADJUSTMENTS" },
                { label: "근로일별 최소시간 합산", value: "DAILY_MIN_SUM" },
              ], rule.method)}
            </select>
          </label>
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-min",
            label: "하루 최소근로시간",
            minutes: rule.dailyMinMinutes,
            name: "dailyMinTime",
          })}
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-min-weekly",
            label: "주 고정 최소근로시간",
            maxMinutes: 10080,
            minutes: rule.weeklyMinMinutes,
            name: "minimumWeeklyTime",
          })}
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-min-monthly",
            label: "월 고정 최소근로시간",
            maxMinutes: 60000,
            minutes: rule.monthlyMinMinutes,
            name: "minimumMonthlyTime",
          })}
        </div>
        <div class="workmate-work-policy-adjustment-list" data-management-work-policy-adjustment-list="true">
          ${adjustmentRows.map((adjustment, index) => renderManagementWorkPolicyAdjustmentRow(adjustment, index)).join("")}
        </div>
        <div class="workmate-work-policy-section-actions">
          <button class="outline-button" data-management-work-policy-adjustment-add="true" type="button">조정 규칙 추가</button>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyMaximumSection(info = {}) {
      const rule = info.maximumRule || normalizeManagementPolicyMaximumRule();

      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>최대근로시간 / 경고</h5>
          <span>${escapeHtml(`주 최대 ${formatManagementPolicyDuration(rule.weeklyMaxMinutes)}`)}</span>
        </div>
        <div class="workmate-work-policy-field-grid">
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-max",
            label: "일 최대근로시간",
            minutes: rule.dailyMaxMinutes,
            name: "dailyMaxTime",
          })}
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-max-weekly",
            label: "주 최대근로시간",
            maxMinutes: 10080,
            minutes: rule.weeklyMaxMinutes,
            name: "weeklyMaxTime",
          })}
          <label class="field select-field" for="management-work-policy-monthly-max-method">
            <span>월 최대 계산</span>
            <select id="management-work-policy-monthly-max-method" name="monthlyMaxMethod">
              ${controls.renderManagementWorkPolicySelectOptions([
                { label: "주 최대 기준 일수 비례", value: "WEEKLY_LIMIT_PRORATED" },
                { label: "월 고정 최대시간", value: "FIXED" },
              ], rule.monthlyMaxMethod)}
            </select>
          </label>
          ${controls.renderManagementWorkPolicyTimeField({
            idBase: "management-work-policy-max-monthly",
            label: "월 고정 최대근로시간",
            maxMinutes: 60000,
            minutes: rule.monthlyMaxMinutes,
            name: "monthlyMaxTime",
          })}
        </div>
        <div class="workmate-work-policy-toggle-grid">
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="alertOnDailyLimit" type="checkbox"${rule.alertOnDailyLimit ? " checked" : ""} />
            <span>일 한도 경고</span>
          </label>
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="alertOnWeeklyLimit" type="checkbox"${rule.alertOnWeeklyLimit ? " checked" : ""} />
            <span>주 한도 경고</span>
          </label>
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="alertOnRestTime" type="checkbox"${rule.alertOnRestTime ? " checked" : ""} />
            <span>휴게/휴식 경고</span>
          </label>
        </div>
      </section>
    `;
    }

    function renderManagementWorkPolicyLegacyHolidaySection(info = {}) {
      return `
      <section class="workmate-work-policy-section">
        <div class="workmate-work-policy-section-head">
          <h5>휴일 포함 기준</h5>
          <span>${escapeHtml(controls.formatManagementPolicyHolidayLabel(info))}</span>
        </div>
        <div class="workmate-work-policy-toggle-grid">
          <label class="checkbox-field workmate-work-policy-toggle">
            <input name="includeWeekends" type="checkbox"${info.includeWeekends ? " checked" : ""} />
            <span>주말 포함</span>
          </label>
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
        ${renderManagementWorkPolicyTargetSection(info, stats)}

        ${renderManagementWorkPolicySettlementSection(info)}

        <section class="workmate-work-policy-section">
          <div class="workmate-work-policy-section-head">
            <h5>근로 요일</h5>
            <span>${escapeHtml(controls.formatManagementPolicyDayLabel(info.workingDays))}</span>
          </div>
          <div class="workmate-work-policy-day-grid">
            ${controls.renderManagementWorkPolicyDayOptions(info)}
          </div>
        </section>

        ${renderManagementWorkPolicyStandardSection(info)}

        ${renderManagementWorkPolicyMinimumSection(info)}

        ${renderManagementWorkPolicyMaximumSection(info)}

        ${renderManagementWorkPolicyLegacyHolidaySection(info)}

        <p class="login-error hidden" id="management-work-policy-error" aria-live="polite"></p>
      </form>
    `;
    }

    return Object.freeze({
      buildManagementWorkPolicyModel,
      formatManagementPolicyTimeInput: controls.formatManagementPolicyTimeInput,
      renderManagementWorkPolicyAdjustmentRow,
      renderManagementWorkPolicyForm,
    });
  }

  return Object.freeze({
    create,
  });
});
