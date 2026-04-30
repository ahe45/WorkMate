(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyMetrics = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkPolicyMetrics(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatNumber,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyHolidayDateRules,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule,
      normalizeManagementPolicyWorkingDays,
      toArray,
    } = deps;

  function formatLocalDateKey(date = new Date()) {
    const sourceDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

    return [
      sourceDate.getFullYear(),
      String(sourceDate.getMonth() + 1).padStart(2, "0"),
      String(sourceDate.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function formatLocalMonthKey(date = new Date()) {
    const sourceDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

    return [
      sourceDate.getFullYear(),
      String(sourceDate.getMonth() + 1).padStart(2, "0"),
    ].join("-");
  }

  function createLocalDateFromKey(value = "", fallbackDate = new Date()) {
    const matched = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!matched) {
      return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
    }

    const year = Number(matched[1]);
    const monthIndex = Number(matched[2]) - 1;
    const day = Number(matched[3]);
    const date = new Date(year, monthIndex, day);

    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
      return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate());
    }

    return date;
  }

  function createLocalMonthStartFromKey(value = "", fallbackDate = new Date()) {
    const matched = String(value || "").trim().match(/^(\d{4})-(\d{2})$/);

    if (!matched) {
      return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
    }

    const year = Number(matched[1]);
    const monthIndex = Number(matched[2]) - 1;
    const date = new Date(year, monthIndex, 1);

    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) {
      return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
    }

    return date;
  }

  function addLocalDays(date = new Date(), days = 0) {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    nextDate.setDate(nextDate.getDate() + Number(days || 0));
    return nextDate;
  }

  function getManagementPolicyDayOfWeek(date = new Date()) {
    const jsDay = date.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  function getManagementPolicyWeekStart(date = new Date(), weekStartsOn = 1) {
    const sourceDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const startDate = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
    const normalizedWeekStartsOn = normalizeManagementPolicyDayOfWeek(weekStartsOn, 1);
    const diff = (getManagementPolicyDayOfWeek(startDate) - normalizedWeekStartsOn + 7) % 7;
    startDate.setDate(startDate.getDate() - diff);
    return startDate;
  }

  function formatManagementPolicyWeekInput(date = new Date()) {
    const sourceDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const targetDate = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());

    targetDate.setDate(targetDate.getDate() + 4 - getManagementPolicyDayOfWeek(targetDate));

    const weekYear = targetDate.getFullYear();
    const yearStart = new Date(weekYear, 0, 1);
    const weekNumber = Math.ceil((((targetDate - yearStart) / 86400000) + 1) / 7);

    return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
  }

  function getManagementPolicyWeekStartFromInput(value = "", fallbackDate = new Date(), weekStartsOn = 1) {
    const matched = String(value || "").trim().match(/^(\d{4})-W(\d{2})$/);
    const normalizedWeekStartsOn = normalizeManagementPolicyDayOfWeek(weekStartsOn, 1);

    if (!matched) {
      return getManagementPolicyWeekStart(fallbackDate, normalizedWeekStartsOn);
    }

    const weekYear = Number(matched[1]);
    const weekNumber = Math.max(1, Math.min(53, Number(matched[2]) || 1));
    const weekOneStart = getManagementPolicyWeekStart(new Date(weekYear, 0, 4), 1);

    return getManagementPolicyWeekStart(addLocalDays(weekOneStart, (weekNumber - 1) * 7), normalizedWeekStartsOn);
  }

  function getManagementPolicyMonthDayDate(year, monthIndex, dayOfMonth = 1) {
    const monthLastDay = new Date(year, monthIndex + 1, 0).getDate();
    const normalizedDay = Math.max(1, Math.min(monthLastDay, normalizeManagementPolicyDayOfMonth(dayOfMonth, 1)));

    return new Date(year, monthIndex, normalizedDay);
  }

  function getManagementPolicyMonthPeriodFromInput(value = "", fallbackDate = new Date(), settlementRule = {}) {
    const monthStart = createLocalMonthStartFromKey(value, fallbackDate);
    const rule = normalizeManagementPolicySettlementRule(settlementRule);

    if (rule.monthBasis !== "CUSTOM_PERIOD") {
      return {
        endDate: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
        inputValue: formatLocalMonthKey(monthStart),
        startDate: monthStart,
      };
    }

    const startDay = normalizeManagementPolicyDayOfMonth(rule.customPeriodStartDay, 1);
    const endDay = normalizeManagementPolicyDayOfMonth(rule.customPeriodEndDay, 31);
    const startDate = getManagementPolicyMonthDayDate(monthStart.getFullYear(), monthStart.getMonth(), startDay);
    const endMonthIndex = endDay < startDay ? monthStart.getMonth() + 1 : monthStart.getMonth();
    const endDate = getManagementPolicyMonthDayDate(monthStart.getFullYear(), endMonthIndex, endDay);

    return {
      endDate,
      inputValue: formatLocalMonthKey(monthStart),
      startDate,
    };
  }

  function formatManagementPolicyMetricDate(date = new Date(), options = {}) {
    return new Intl.DateTimeFormat("ko-KR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...options,
    }).format(date);
  }

  function formatManagementPolicyMetricPeriodLabel(unit = "", startDate = new Date(), endDate = startDate) {
    if (unit === "day") {
      return formatManagementPolicyMetricDate(startDate);
    }

    if (unit === "month") {
      const isCalendarMonth = startDate.getDate() === 1
        && endDate.getFullYear() === startDate.getFullYear()
        && endDate.getMonth() === startDate.getMonth()
        && endDate.getDate() === new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();

      if (isCalendarMonth) {
        return formatManagementPolicyMetricDate(startDate, { day: undefined });
      }
    }

    return `${formatManagementPolicyMetricDate(startDate)} - ${formatManagementPolicyMetricDate(endDate)}`;
  }

  function normalizeManagementWorkPolicyMetricInfo(info = {}) {
    const readMinutes = (value) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : Number.NaN;
    };
    const workingDays = normalizeManagementPolicyWorkingDays(info.workingDays, []);
    const standardDailyMinutes = readMinutes(info.standardDailyMinutes);
    const dailyMaxMinutes = readMinutes(info.dailyMaxMinutes);
    const settlementRule = normalizeManagementPolicySettlementRule(info.settlementRule, info);

    return {
      dailyMaxMinutes,
      holidayDateRules: normalizeManagementPolicyHolidayDateRules(info.holidayDateRules),
      includeWeekends: normalizeManagementPolicyBoolean(info.includeWeekends, false),
      maximumRule: normalizeManagementPolicyMaximumRule(info.maximumRule, dailyMaxMinutes),
      settlementRule,
      standardDailyMinutes,
      standardRule: normalizeManagementPolicyStandardRule(info.standardRule, workingDays, standardDailyMinutes),
      workingDays,
    };
  }

  function getManagementPolicyHolidayRule(date = new Date(), info = {}) {
    const dateKey = formatLocalDateKey(date);

    return info.holidayDateRules instanceof Map ? info.holidayDateRules.get(dateKey) : null;
  }

  function isManagementPolicyHolidayExcluded(date = new Date(), info = {}) {
    const holidayRule = getManagementPolicyHolidayRule(date, info);

    if (!holidayRule) {
      return false;
    }

    if (holidayRule.isCustom) {
      return Boolean(info.settlementRule?.excludeCustomHolidays);
    }

    if (holidayRule.isSubstitute) {
      return Boolean(info.settlementRule?.excludeSubstituteHolidays);
    }

    return Boolean(info.settlementRule?.excludePublicHolidays);
  }

  function getManagementWorkPolicyDates(info = {}, startDate = new Date(), endDate = startDate) {
    const workingDaySet = new Set(normalizeManagementPolicyWorkingDays(info.workingDays, []).map((day) => Number(day)));
    const dates = [];

    for (let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      cursor.getTime() <= endDate.getTime();
      cursor = addLocalDays(cursor, 1)) {
      const dayOfWeek = getManagementPolicyDayOfWeek(cursor);

      if (!workingDaySet.has(dayOfWeek)) {
        continue;
      }

      if (isManagementPolicyHolidayExcluded(cursor, info)) {
        continue;
      }

      dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    }

    return dates;
  }

  function formatManagementPolicyDuration(minutes = 0) {
    const numericMinutes = Number(minutes);

    if (!Number.isFinite(numericMinutes)) {
      return "-";
    }

    const normalizedMinutes = Math.max(0, Math.round(numericMinutes));
    const hours = Math.floor(normalizedMinutes / 60);
    const minute = normalizedMinutes % 60;

    return `${formatNumber(hours)}:${String(minute).padStart(2, "0")}`;
  }

  function getManagementPolicyPeriodCalendarDayCount(startDate = new Date(), endDate = startDate) {
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  }

  function calculateManagementPolicyStandardMinutes(info = {}, unit = "day", workDates = [], startDate = new Date(), endDate = startDate) {
    const method = info.standardRule?.method || "WORKING_DAYS_TIMES_DAILY_STANDARD";
    const workingDaysPerWeek = Math.max(1, info.workingDays.length || 1);

    if (method === "WEEKLY_FIXED") {
      if (unit === "week") {
        return info.standardRule.standardWeeklyMinutes;
      }

      return Math.round((info.standardRule.standardWeeklyMinutes / workingDaysPerWeek) * workDates.length);
    }

    if (method === "MONTHLY_FIXED") {
      if (unit === "month") {
        return info.standardRule.standardMonthlyMinutes;
      }

      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const monthWorkDates = getManagementWorkPolicyDates(info, monthStart, monthEnd);
      const divisor = Math.max(1, monthWorkDates.length);

      return Math.round((info.standardRule.standardMonthlyMinutes / divisor) * workDates.length);
    }

    return Number.isFinite(info.standardDailyMinutes) ? info.standardDailyMinutes * workDates.length : Number.NaN;
  }

  function calculateManagementPolicyMaximumMinutes(info = {}, unit = "day", startDate = new Date(), endDate = startDate) {
    if (unit === "week") {
      return info.maximumRule.weeklyMaxMinutes;
    }

    if (unit === "month") {
      if (info.maximumRule.monthlyMaxMethod === "FIXED" && info.maximumRule.monthlyMaxMinutes > 0) {
        return info.maximumRule.monthlyMaxMinutes;
      }

      return Math.round(info.maximumRule.weeklyMaxMinutes * (getManagementPolicyPeriodCalendarDayCount(startDate, endDate) / 7));
    }

    return info.maximumRule.dailyMaxMinutes;
  }

  function buildManagementWorkPolicyPeriodMetric(unit = "day", info = {}, inputValue = "", referenceDate = new Date()) {
    const normalizedInfo = normalizeManagementWorkPolicyMetricInfo(info);
    let startDate = createLocalDateFromKey(formatLocalDateKey(referenceDate), referenceDate);
    let endDate = startDate;
    let metricInputValue = formatLocalDateKey(startDate);
    let inputType = "date";
    let label = "일";

    if (unit === "week") {
      const weekInput = String(inputValue || "").trim();
      metricInputValue = /^\d{4}-W\d{2}$/.test(weekInput) ? weekInput : formatManagementPolicyWeekInput(referenceDate);
      startDate = getManagementPolicyWeekStartFromInput(metricInputValue, referenceDate, normalizedInfo.settlementRule.weekStartsOn);
      endDate = addLocalDays(startDate, 6);
      inputType = "week";
      label = "주";
    } else if (unit === "month") {
      const monthPeriod = getManagementPolicyMonthPeriodFromInput(inputValue, referenceDate, normalizedInfo.settlementRule);
      startDate = monthPeriod.startDate;
      endDate = monthPeriod.endDate;
      metricInputValue = monthPeriod.inputValue;
      inputType = "month";
      label = "월";
    } else {
      startDate = createLocalDateFromKey(inputValue, referenceDate);
      endDate = startDate;
      metricInputValue = formatLocalDateKey(startDate);
    }

    const workDates = getManagementWorkPolicyDates(normalizedInfo, startDate, endDate);
    const workdayCount = workDates.length;
    const standardMinutes = calculateManagementPolicyStandardMinutes(normalizedInfo, unit, workDates, startDate, endDate);
    const maxMinutes = calculateManagementPolicyMaximumMinutes(normalizedInfo, unit, startDate, endDate);
    const standardBreakdown = normalizedInfo.standardRule.method === "WORKING_DAYS_TIMES_DAILY_STANDARD" || normalizedInfo.standardRule.method === "SCHEDULE_TEMPLATE_SUM"
      ? [`근로일 ${formatNumber(workdayCount)}일 × ${formatManagementPolicyDuration(normalizedInfo.standardDailyMinutes)}`]
      : normalizedInfo.standardRule.method === "WEEKLY_FIXED"
        ? [`주 고정 ${formatManagementPolicyDuration(normalizedInfo.standardRule.standardWeeklyMinutes)} 기준`]
        : [`월 고정 ${formatManagementPolicyDuration(normalizedInfo.standardRule.standardMonthlyMinutes)} 기준`];
    const maxBreakdown = unit === "month" && normalizedInfo.maximumRule.monthlyMaxMethod === "WEEKLY_LIMIT_PRORATED"
      ? [`주 최대 ${formatManagementPolicyDuration(normalizedInfo.maximumRule.weeklyMaxMinutes)} × ${formatNumber(getManagementPolicyPeriodCalendarDayCount(startDate, endDate))}/7`]
      : [`${unit === "day" ? "일" : unit === "week" ? "주" : "월"} 최대 기준`];

    return {
      breakdown: {
        max: maxBreakdown,
        standard: standardBreakdown,
      },
      endDate,
      inputType,
      inputValue: metricInputValue,
      label,
      maxLabel: formatManagementPolicyDuration(maxMinutes),
      periodLabel: formatManagementPolicyMetricPeriodLabel(unit, startDate, endDate),
      standardLabel: formatManagementPolicyDuration(standardMinutes),
      startDate,
      unit,
      workdayCount,
    };
  }

  function getManagementWorkPolicyDefaultPeriodValues(referenceDate = new Date()) {
    return {
      day: formatLocalDateKey(referenceDate),
      month: formatLocalMonthKey(referenceDate),
      week: formatManagementPolicyWeekInput(referenceDate),
    };
  }

  function calculateManagementWorkPolicyStageMetrics(info = {}, periodValues = {}, referenceDate = new Date()) {
    const defaults = getManagementWorkPolicyDefaultPeriodValues(referenceDate);
    const values = {
      ...defaults,
      ...(periodValues && typeof periodValues === "object" ? periodValues : {}),
    };

    return ["day", "week", "month"].map((unit) => buildManagementWorkPolicyPeriodMetric(unit, info, values[unit], referenceDate));
  }

    function renderManagementWorkPolicyStageMetrics(info = {}) {
      const metrics = calculateManagementWorkPolicyStageMetrics(info);

      return `
      <section class="workmate-work-policy-stage-metrics-stack">
        <div class="workmate-work-policy-stage-metrics-label">기간별 기준</div>
        <div class="workmate-admin-stage-metrics workmate-work-schedule-stage-metrics">
          ${metrics.map((metric) => `
            <div class="workmate-work-policy-metric-card" data-management-work-policy-unit="${escapeAttribute(metric.unit)}">
              <div class="workmate-work-policy-metric-head">
                <label class="workmate-work-policy-metric-control">
                  <span>${escapeHtml(metric.label)}</span>
                  <input data-management-work-policy-period="${escapeAttribute(metric.unit)}" type="${escapeAttribute(metric.inputType)}" value="${escapeAttribute(metric.inputValue)}" aria-label="${escapeAttribute(`${metric.label} 기준 기간`)}" />
                </label>
                <span class="workmate-work-policy-metric-range" data-management-work-policy-range="${escapeAttribute(metric.unit)}">${escapeHtml(metric.periodLabel)}</span>
              </div>
              <dl class="workmate-work-policy-metric-values">
                <div>
                  <dt>소정</dt>
                  <dd data-management-work-policy-value="${escapeAttribute(`${metric.unit}:standard`)}">${escapeHtml(metric.standardLabel)}</dd>
                </div>
                <div>
                  <dt>최대</dt>
                  <dd data-management-work-policy-value="${escapeAttribute(`${metric.unit}:max`)}">${escapeHtml(metric.maxLabel)}</dd>
                </div>
              </dl>
              <div class="workmate-work-policy-metric-breakdown">
                <span data-management-work-policy-breakdown="${escapeAttribute(`${metric.unit}:standard`)}">${escapeHtml(toArray(metric.breakdown?.standard)[0] || "")}</span>
                <span data-management-work-policy-breakdown="${escapeAttribute(`${metric.unit}:max`)}">${escapeHtml(toArray(metric.breakdown?.max)[0] || "")}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

    return Object.freeze({
      calculateManagementWorkPolicyStageMetrics,
      formatManagementPolicyDuration,
      getManagementWorkPolicyDefaultPeriodValues,
      renderManagementWorkPolicyStageMetrics,
    });
  }

  return Object.freeze({
    create: createWorkPolicyMetrics,
  });
});
