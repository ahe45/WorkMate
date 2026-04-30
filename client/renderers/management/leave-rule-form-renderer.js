(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementLeaveRuleFormRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatMonthDayValue,
      getAttendanceAccrualMethod,
      getMonthlyAccrualMethod,
      renderLeaveGroupPathOptions,
      sortLeaveRuleSegments,
      toArray,
    } = deps;

    function renderRangeDeleteButton() {
      return `
        <button class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button workmate-leave-rule-range-remove" data-management-leave-rule-remove-range="true" type="button" aria-label="구간 삭제" title="삭제">
          <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M6 7l1 14h10l1-14" />
            <path d="M9 7V4h6v3" />
          </svg>
        </button>
      `;
    }

    function renderMonthlyLeaveRuleRangeRow({ amountDays = 1, expiresAfterMonths = 12, tenureMonths = 1 } = {}) {
      return `
        <div class="workmate-leave-rule-range-row workmate-leave-rule-range-row-monthly" data-management-leave-rule-monthly-row="true">
          <label class="field">
            <span>근속월수</span>
            <span class="workmate-leave-rule-unit-field">
              <input data-management-leave-rule-monthly-tenure-months="true" min="1" step="1" type="number" value="${escapeAttribute(tenureMonths)}" />
              <span>개월 이상 일 때</span>
            </span>
          </label>
          <label class="field">
            <span>발생 일수</span>
            <span class="workmate-leave-rule-unit-field">
              <input data-management-leave-rule-monthly-amount="true" min="0.5" step="0.5" type="number" value="${escapeAttribute(amountDays)}" />
              <span>일 발생</span>
            </span>
          </label>
          <label class="field workmate-leave-rule-field-divider-left">
            <span>유효 개월 수</span>
            <input data-management-leave-rule-monthly-expires="true" min="1" step="1" type="number" value="${escapeAttribute(expiresAfterMonths)}" />
          </label>
          ${renderRangeDeleteButton()}
        </div>
      `;
    }

    function renderMonthlyAccrualMethodFields(rule = {}) {
      const monthlyAccrualMethod = getMonthlyAccrualMethod(rule);
      const attendanceAccrualMethod = getAttendanceAccrualMethod(rule);
      const referenceDailyHours = Math.round((Number(rule?.referenceDailyMinutes || 480) / 60 + Number.EPSILON) * 100) / 100;

      return `
        <div class="workmate-leave-rule-monthly-method-stack">
          <div class="workmate-leave-rule-monthly-method-options" role="radiogroup" aria-label="월 주기 발생 방식">
            <label class="workmate-leave-rule-frequency-option is-compact" data-management-leave-rule-monthly-method-option="FIXED">
              <input data-management-leave-rule-monthly-method="FIXED" name="management-leave-rule-monthly-method" type="radio" value="FIXED"${monthlyAccrualMethod === "FIXED" ? " checked" : ""} />
              <span>
                <strong>고정 발생</strong>
                <small>설정한 발생 일수를 그대로 부여</small>
              </span>
            </label>
            <label class="workmate-leave-rule-frequency-option is-compact" data-management-leave-rule-monthly-method-option="CONTRACTUAL_HOURS">
              <input data-management-leave-rule-monthly-method="CONTRACTUAL_HOURS" name="management-leave-rule-monthly-method" type="radio" value="CONTRACTUAL_HOURS"${monthlyAccrualMethod === "CONTRACTUAL_HOURS" ? " checked" : ""} />
              <span>
                <strong>소정근로시간 비례</strong>
                <small>직원 1일 소정근로시간을 기준 근로시간에 비례 계산</small>
              </span>
            </label>
            <label class="workmate-leave-rule-frequency-option is-compact" data-management-leave-rule-monthly-method-option="ATTENDANCE_RATE">
              <input data-management-leave-rule-monthly-method="ATTENDANCE_RATE" name="management-leave-rule-monthly-method" type="radio" value="ATTENDANCE_RATE"${monthlyAccrualMethod === "ATTENDANCE_RATE" ? " checked" : ""} />
              <span>
                <strong>출근율 기반</strong>
                <small>직전 산정 기간의 출근율에 따라 발생 일수 조정</small>
              </span>
            </label>
          </div>
          <div class="workmate-leave-rule-monthly-method-panel is-contractual" data-management-leave-rule-monthly-method-section="CONTRACTUAL_HOURS"${monthlyAccrualMethod === "CONTRACTUAL_HOURS" ? "" : " hidden"}>
            <label class="field">
              <span>1일 소정근로시간 기준</span>
              <span class="workmate-leave-rule-unit-field">
                <input data-management-leave-rule-monthly-reference-hours="true" min="6" max="10" step="0.5" type="number" value="${escapeAttribute(referenceDailyHours || 8)}" />
                <span>시간 기준</span>
              </span>
            </label>
            <div class="workmate-leave-rule-method-note">
              <span>설명</span>
              <p>직원 1일 소정근로시간이 기준보다 짧으면 발생 일수를 비례 차감합니다.</p>
            </div>
          </div>
          <div class="workmate-leave-rule-monthly-method-panel is-attendance" data-management-leave-rule-monthly-method-section="ATTENDANCE_RATE"${monthlyAccrualMethod === "ATTENDANCE_RATE" ? "" : " hidden"}>
            <label class="field select-field">
              <span>발생 방식</span>
              <select data-management-leave-rule-monthly-attendance-method="true">
                <option value="PROPORTIONAL"${attendanceAccrualMethod === "PROPORTIONAL" ? " selected" : ""}>출근율만큼 비례 발생</option>
                <option value="FULL_MONTHS"${attendanceAccrualMethod === "FULL_MONTHS" ? " selected" : ""}>만근 월만큼 발생</option>
              </select>
            </label>
            <label class="field workmate-leave-rule-attendance-threshold-field">
              <span>비율</span>
              <span class="workmate-leave-rule-unit-field">
                <input data-management-leave-rule-monthly-attendance-threshold="true" min="1" max="100" step="0.1" type="number" value="${escapeAttribute(rule?.attendanceRateThreshold || 80)}" />
                <span>% 미만 기준</span>
              </span>
            </label>
            <div class="workmate-leave-rule-method-note">
              <span>설명</span>
              <p>기준 이상은 전체 발생, 미만은 선택 방식으로 조정합니다.</p>
            </div>
          </div>
        </div>
      `;
    }

    function getMonthDayParts(value = "", fallback = "12-31") {
      const normalizedValue = formatMonthDayValue(value);
      const normalizedFallback = formatMonthDayValue(fallback);
      const monthDay = normalizedValue === "-" ? normalizedFallback : normalizedValue;
      const [month, day] = String(monthDay === "-" ? "12-31" : monthDay).split("-").map((part) => Number(part));

      return {
        day: Number.isFinite(day) ? day : 31,
        month: Number.isFinite(month) ? month : 12,
      };
    }

    function getMonthDayMaxDay(month = 1) {
      const normalizedMonth = Math.max(1, Math.min(12, Number(month) || 1));

      return new Date(2000, normalizedMonth, 0).getDate();
    }

    function renderMonthDayOptions(maxValue = 12, selectedValue = 1, suffix = "") {
      return Array.from({ length: maxValue }, (_, index) => index + 1)
        .map((value) => `<option value="${escapeAttribute(String(value).padStart(2, "0"))}"${Number(selectedValue) === value ? " selected" : ""}>${escapeHtml(`${value}${suffix}`)}</option>`)
        .join("");
    }

    function renderMonthDayPicker({
      dayAttribute,
      monthAttribute,
      value = "12-31",
    } = {}) {
      const { day, month } = getMonthDayParts(value);
      const maxDay = getMonthDayMaxDay(month);
      const normalizedDay = Math.min(day, maxDay);

      return `
        <span class="workmate-leave-rule-month-day-picker" data-management-month-day-picker="true">
          <select data-management-month-day-month="true" ${monthAttribute}="true" aria-label="월 선택">
            ${renderMonthDayOptions(12, month, "월")}
          </select>
          <select data-management-month-day-day="true" ${dayAttribute}="true" aria-label="일 선택">
            ${renderMonthDayOptions(maxDay, normalizedDay, "일")}
          </select>
        </span>
      `;
    }

    function renderYearlyLeaveRuleRangeRow({
      amountDays = 15,
      effectiveFrom = "",
      effectiveTo = "",
      tenureYears = 1,
    } = {}) {
      const formattedStartDate = formatMonthDayValue(effectiveFrom);
      const formattedEndDate = formatMonthDayValue(effectiveTo);
      const startDate = formattedStartDate === "-" ? "01-01" : formattedStartDate;
      const endDate = formattedEndDate === "-" ? "12-31" : formattedEndDate;

      return `
        <div class="workmate-leave-rule-range-row workmate-leave-rule-range-row-yearly" data-management-leave-rule-yearly-row="true">
          <label class="field">
            <span>근속연수</span>
            <span class="workmate-leave-rule-unit-field">
              <input data-management-leave-rule-yearly-tenure-years="true" min="1" step="1" type="number" value="${escapeAttribute(tenureYears)}" />
              <span>년 이상 일 때</span>
            </span>
          </label>
          <label class="field">
            <span>발생 일수</span>
            <span class="workmate-leave-rule-unit-field">
              <input data-management-leave-rule-yearly-amount="true" min="0.5" step="0.5" type="number" value="${escapeAttribute(amountDays)}" />
              <span>일 발생</span>
            </span>
          </label>
          <label class="field workmate-leave-rule-field-divider-both">
            <span>발생일시</span>
            ${renderMonthDayPicker({
              dayAttribute: "data-management-leave-rule-yearly-effective-from-day",
              monthAttribute: "data-management-leave-rule-yearly-effective-from-month",
              value: startDate,
            })}
          </label>
          <label class="field">
            <span>소멸일시</span>
            ${renderMonthDayPicker({
              dayAttribute: "data-management-leave-rule-yearly-effective-to-day",
              monthAttribute: "data-management-leave-rule-yearly-effective-to-month",
              value: endDate,
            })}
          </label>
          ${renderRangeDeleteButton()}
        </div>
      `;
    }

    function renderImmediateLeaveRuleFields(rule = {}) {
      const immediateType = String(rule?.immediateAccrualType || "PRORATED").toUpperCase() === "FIXED" ? "FIXED" : "PRORATED";
      const expiryMonthDay = formatMonthDayValue(rule?.effectiveTo || "");
      const normalizedExpiryMonthDay = expiryMonthDay === "-" ? "12-31" : expiryMonthDay;
      const roundingMethod = ["FLOOR", "ROUND", "CEIL"].includes(String(rule?.roundingMethod || "").toUpperCase())
        ? String(rule.roundingMethod).toUpperCase()
        : "ROUND";
      const isRoundingIncrementDisabled = roundingMethod !== "ROUND";
      const roundingIncrement = isRoundingIncrementDisabled ? 1 : Number(rule?.roundingIncrement || 0.5);

      return `
        <div class="workmate-leave-rule-immediate-stack">
          <div class="workmate-leave-rule-immediate-mode" role="radiogroup" aria-label="입사 즉시 지급 방식">
            <label class="workmate-leave-rule-frequency-option is-compact" data-management-leave-rule-immediate-mode-option="PRORATED">
              <input data-management-leave-rule-immediate-mode="PRORATED" name="management-leave-rule-immediate-mode" type="radio" value="PRORATED"${immediateType === "PRORATED" ? " checked" : ""} />
              <span>
                <strong>연간 기준 비례 계산</strong>
                <small>연간 기준 일수를 입사일의 잔여 기간으로 계산</small>
              </span>
            </label>
            <label class="workmate-leave-rule-frequency-option is-compact" data-management-leave-rule-immediate-mode-option="FIXED">
              <input data-management-leave-rule-immediate-mode="FIXED" name="management-leave-rule-immediate-mode" type="radio" value="FIXED"${immediateType === "FIXED" ? " checked" : ""} />
              <span>
                <strong>고정 일수</strong>
                <small>입사일에 지정한 일수를 1회 부여</small>
              </span>
            </label>
          </div>

          <div class="workmate-leave-rule-immediate-panel" data-management-leave-rule-immediate-section="PRORATED"${immediateType === "PRORATED" ? "" : " hidden"}>
            <label class="field">
              <span>연간 기준 일수</span>
              <span class="workmate-leave-rule-unit-field">
                <input data-management-leave-rule-immediate-prorated-annual-days="true" min="0.5" step="0.5" type="number" value="${escapeAttribute(rule?.amountDays || 15)}" />
                <span>일 기준</span>
              </span>
            </label>
            <label class="field select-field">
              <span>기간 기준</span>
              <select data-management-leave-rule-immediate-proration-basis="true">
                <option value="FISCAL_YEAR"${String(rule?.prorationBasis || "FISCAL_YEAR").toUpperCase() === "FISCAL_YEAR" ? " selected" : ""}>회계연도 기준</option>
                <option value="HIRE_YEAR"${String(rule?.prorationBasis || "").toUpperCase() === "HIRE_YEAR" ? " selected" : ""}>입사일 기준 1년</option>
              </select>
            </label>
            <label class="field select-field">
              <span>계산 기준</span>
              <select data-management-leave-rule-immediate-proration-unit="true">
                <option value="REMAINING_DAYS"${String(rule?.prorationUnit || "REMAINING_DAYS").toUpperCase() === "REMAINING_DAYS" ? " selected" : ""}>잔여 일수</option>
                <option value="REMAINING_MONTHS"${String(rule?.prorationUnit || "").toUpperCase() === "REMAINING_MONTHS" ? " selected" : ""}>잔여 월수</option>
              </select>
            </label>
            <label class="field select-field">
              <span>반올림 방식</span>
              <select data-management-leave-rule-immediate-rounding-method="true">
                <option value="FLOOR"${roundingMethod === "FLOOR" ? " selected" : ""}>내림</option>
                <option value="ROUND"${roundingMethod === "ROUND" ? " selected" : ""}>반올림</option>
                <option value="CEIL"${roundingMethod === "CEIL" ? " selected" : ""}>올림</option>
              </select>
            </label>
            <label class="field select-field">
              <span>반올림 단위</span>
              <select data-management-leave-rule-immediate-rounding-increment="true"${isRoundingIncrementDisabled ? " disabled" : ""}>
                <option value="1"${roundingIncrement === 1 ? " selected" : ""}>1일 단위</option>
                <option value="0.5"${roundingIncrement === 0.5 ? " selected" : ""}>0.5일 단위</option>
              </select>
            </label>
            <label class="field">
              <span>소멸일시</span>
              ${renderMonthDayPicker({
                dayAttribute: "data-management-leave-rule-immediate-expiry-day",
                monthAttribute: "data-management-leave-rule-immediate-expiry-month",
                value: normalizedExpiryMonthDay,
              })}
            </label>
            <label class="field">
              <span>최소 부여일</span>
              <input data-management-leave-rule-immediate-min-days="true" min="0" step="0.5" type="number" value="${escapeAttribute(rule?.minAmountDays ?? 0)}" />
            </label>
            <label class="field">
              <span>최대 부여일</span>
              <input data-management-leave-rule-immediate-max-days="true" min="0.5" step="0.5" type="number" value="${escapeAttribute(rule?.maxAmountDays || rule?.amountDays || 15)}" />
            </label>
          </div>

          <div class="workmate-leave-rule-immediate-panel" data-management-leave-rule-immediate-section="FIXED"${immediateType === "FIXED" ? "" : " hidden"}>
            <label class="field">
              <span>발생 일수</span>
              <span class="workmate-leave-rule-unit-field">
                <input data-management-leave-rule-immediate-fixed-amount="true" min="0.5" step="0.5" type="number" value="${escapeAttribute(rule?.amountDays || 1)}" />
                <span>일 발생</span>
              </span>
            </label>
            <label class="field">
              <span>소멸일시</span>
              ${renderMonthDayPicker({
                dayAttribute: "data-management-leave-rule-immediate-fixed-expiry-day",
                monthAttribute: "data-management-leave-rule-immediate-fixed-expiry-month",
                value: normalizedExpiryMonthDay,
              })}
            </label>
          </div>
        </div>
      `;
    }

    function renderLeaveRuleForm(groups = [], rule = null) {
      const segments = sortLeaveRuleSegments(rule?.segments?.length ? rule.segments : rule ? [rule] : []);
      const primaryRule = segments[0] || rule || {};
      const frequency = ["IMMEDIATE", "MONTHLY", "YEARLY"].includes(String(primaryRule?.frequency || "").toUpperCase())
        ? String(primaryRule.frequency).toUpperCase()
        : "YEARLY";
      const isEditMode = Boolean(rule);
      const ruleIds = toArray(rule?.ruleIds).length > 0
        ? toArray(rule.ruleIds)
        : String(rule?.id || "").split(",");
      const normalizedRuleIds = ruleIds.map((ruleId) => String(ruleId || "").trim()).filter(Boolean).join(",");
      const monthlyRows = frequency === "MONTHLY" && segments.length > 0
        ? segments.map((segment) => renderMonthlyLeaveRuleRangeRow(segment)).join("")
        : renderMonthlyLeaveRuleRangeRow();
      const yearlyRows = frequency === "YEARLY" && segments.length > 0
        ? segments.map((segment) => renderYearlyLeaveRuleRangeRow(segment)).join("")
        : renderYearlyLeaveRuleRangeRow();

      return `
        <article class="panel-card workmate-leave-policy-card">
          <div class="workmate-employee-section-head">
            <strong>${escapeHtml(isEditMode ? "휴가 발생 규칙 관리" : "휴가 발생 규칙 추가")}</strong>
            <span>${escapeHtml(isEditMode ? "규칙 정보와 발생 구간을 수정합니다." : "근속 기간별 월 기준 또는 연 기준 발생 구간을 설정합니다.")}</span>
          </div>
          <div class="workmate-leave-rule-form" id="management-leave-rule-form">
            <input id="management-leave-rule-ids" type="hidden" value="${escapeAttribute(normalizedRuleIds)}" />
            <section class="workmate-leave-rule-section">
              <div class="workmate-leave-rule-section-head">
                <strong>기본 정보</strong>
                <span>규칙을 구분할 이름과 적용할 휴가정책을 선택합니다.</span>
              </div>
              <div class="workmate-leave-rule-basic-grid">
                <label class="field">
                  <span>규칙명</span>
                  <input id="management-leave-rule-name" type="text" placeholder="예: 입사일 기준 연차휴가 발생" value="${escapeAttribute(rule?.name || "")}" />
                </label>
                <label class="field select-field">
                  <span>휴가정책</span>
                  <select id="management-leave-rule-group">${renderLeaveGroupPathOptions(groups, primaryRule?.leaveGroupId || rule?.leaveGroupId || "")}</select>
                </label>
              </div>
            </section>

            <section class="workmate-leave-rule-section">
              <div class="workmate-leave-rule-section-head">
                <strong>발생 주기</strong>
                <span>근속연수 기준, 근속월수 기준, 입사 즉시 중 하나를 선택합니다.</span>
              </div>
              <div class="workmate-leave-rule-frequency-toggle" role="radiogroup" aria-label="발생 주기">
                <label class="workmate-leave-rule-frequency-option" data-management-leave-rule-frequency-option="YEARLY">
                  <input data-management-leave-rule-frequency="YEARLY" name="management-leave-rule-frequency" type="radio" value="YEARLY"${frequency === "YEARLY" ? " checked" : ""} />
                  <span>
                    <strong>연 주기</strong>
                    <small>근속연수별 발생 일수와 적용 시작/종료일을 설정</small>
                  </span>
                </label>
                <label class="workmate-leave-rule-frequency-option" data-management-leave-rule-frequency-option="MONTHLY">
                  <input data-management-leave-rule-frequency="MONTHLY" name="management-leave-rule-frequency" type="radio" value="MONTHLY"${frequency === "MONTHLY" ? " checked" : ""} />
                  <span>
                    <strong>월 주기</strong>
                    <small>근속월수별 발생 일수와 유효 개월 수를 설정</small>
                  </span>
                </label>
                <label class="workmate-leave-rule-frequency-option" data-management-leave-rule-frequency-option="IMMEDIATE">
                  <input data-management-leave-rule-frequency="IMMEDIATE" name="management-leave-rule-frequency" type="radio" value="IMMEDIATE"${frequency === "IMMEDIATE" ? " checked" : ""} />
                  <span>
                    <strong>입사 즉시</strong>
                    <small>합류일에 고정 일수 또는 비례 계산 휴가를 1회 부여</small>
                  </span>
                </label>
              </div>

              <div class="workmate-leave-rule-range-panel" data-management-leave-rule-frequency-section="YEARLY"${frequency === "YEARLY" ? "" : " hidden"}>
                <div class="workmate-leave-rule-range-panel-head">
                  <strong>연 주기 구간</strong>
                  <span>입사일 기준으로 지정한 근속연수에 도달하고 적용 기간 안에 있으면 휴가가 발생합니다.</span>
                </div>
                <div class="workmate-leave-rule-range-table">
                  <div class="workmate-leave-rule-range-head workmate-leave-rule-range-head-yearly" aria-hidden="true">
                    <span>근속연수</span>
                    <span>발생 일수</span>
                    <span>발생일시</span>
                    <span>소멸일시</span>
                    <span>삭제</span>
                  </div>
                  <div class="workmate-leave-rule-range-list" data-management-leave-rule-yearly-list="true">
                    ${yearlyRows}
                  </div>
                </div>
                <button class="text-button workmate-leave-rule-range-add" data-management-leave-rule-add-range="YEARLY" type="button">+ 구간 추가</button>
              </div>

              <div class="workmate-leave-rule-range-panel" data-management-leave-rule-frequency-section="MONTHLY"${frequency === "MONTHLY" ? "" : " hidden"}>
                <div class="workmate-leave-rule-range-panel-head">
                  <strong>월 주기 구간</strong>
                  <span>입사일 기준 근속월수에 도달하면 선택한 방식으로 휴가가 발생합니다.</span>
                </div>
                ${renderMonthlyAccrualMethodFields(primaryRule)}
                <div class="workmate-leave-rule-range-table">
                  <div class="workmate-leave-rule-range-head workmate-leave-rule-range-head-monthly" aria-hidden="true">
                    <span>근속월수</span>
                    <span>발생 일수</span>
                    <span>유효 개월 수</span>
                    <span>삭제</span>
                  </div>
                  <div class="workmate-leave-rule-range-list" data-management-leave-rule-monthly-list="true">
                    ${monthlyRows}
                  </div>
                </div>
                <button class="text-button workmate-leave-rule-range-add" data-management-leave-rule-add-range="MONTHLY" type="button">+ 구간 추가</button>
              </div>

              <div class="workmate-leave-rule-range-panel" data-management-leave-rule-frequency-section="IMMEDIATE"${frequency === "IMMEDIATE" ? "" : " hidden"}>
                <div class="workmate-leave-rule-range-panel-head">
                  <strong>입사 즉시 지급</strong>
                  <span>직원의 합류일에 한 번만 휴가를 부여합니다.</span>
                </div>
                ${renderImmediateLeaveRuleFields(primaryRule)}
              </div>
            </section>
            <p class="form-inline-message hidden" id="management-leave-rule-error"></p>
          </div>
        </article>
      `;
    }

    return Object.freeze({
      renderLeaveRuleForm,
    });
  }

  return Object.freeze({ create });
});
