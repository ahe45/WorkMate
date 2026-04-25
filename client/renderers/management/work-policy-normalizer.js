(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkPolicyNormalizer(deps = {}) {
    const {
      toArray,
    } = deps;

  function parseManagementPolicyJson(value, fallback = {}) {
    if (!value) {
      return { ...fallback };
    }

    if (typeof value === "object") {
      return value;
    }

    try {
      return JSON.parse(String(value));
    } catch (error) {
      return { ...fallback };
    }
  }

  function normalizeManagementPolicyBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      return ["1", "true", "y", "yes", "on"].includes(value.trim().toLowerCase());
    }

    return Boolean(value);
  }

  function normalizeManagementPolicyMinutes(value, fallback = 0, min = 0, max = 1440) {
    const numericValue = Math.round(Number(value));

    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, numericValue));
  }

  function normalizeManagementPolicyWorkingDays(value, fallback = [1, 2, 3, 4, 5]) {
    const source = Array.isArray(value)
      ? value
      : String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const days = Array.from(new Set(source
      .map((entry) => Number(entry))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)))
      .sort((left, right) => left - right);

    return days.length > 0 ? days : fallback.slice();
  }

  function normalizeManagementPolicyStringEnum(value = "", allowedValues = [], fallback = "") {
    const normalizedValue = String(value || "").trim().toUpperCase();

    return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
  }

  function normalizeManagementPolicyStringList(value) {
    const source = Array.isArray(value)
      ? value
      : String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);

    return Array.from(new Set(source.map((entry) => String(entry || "").trim()).filter(Boolean)));
  }

  function normalizeManagementPolicyDayOfWeek(value, fallback = 1) {
    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7 ? numericValue : fallback;
  }

  function normalizeManagementPolicyDayOfMonth(value, fallback = 1) {
    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 31 ? numericValue : fallback;
  }

  function normalizeManagementPolicyTargetRule(value = {}) {
    const source = value && typeof value === "object" ? value : {};

    return {
      jobTitleIds: normalizeManagementPolicyStringList(source.jobTitleIds),
      scope: normalizeManagementPolicyStringEnum(source.scope, ["ORGANIZATION", "UNITS", "JOB_TITLES", "SITES", "MIXED"], "ORGANIZATION"),
      siteIds: normalizeManagementPolicyStringList(source.siteIds),
      unitIds: normalizeManagementPolicyStringList(source.unitIds),
    };
  }

  function normalizeManagementPolicySettlementRule(value = {}, legacy = {}) {
    const source = value && typeof value === "object" ? value : {};

    return {
      customPeriodEndDay: normalizeManagementPolicyDayOfMonth(source.customPeriodEndDay, 31),
      customPeriodStartDay: normalizeManagementPolicyDayOfMonth(source.customPeriodStartDay, 1),
      excludeCustomHolidays: normalizeManagementPolicyBoolean(source.excludeCustomHolidays, !normalizeManagementPolicyBoolean(legacy.includeCustomHolidays, false)),
      excludePublicHolidays: normalizeManagementPolicyBoolean(source.excludePublicHolidays, !normalizeManagementPolicyBoolean(legacy.includePublicHolidays, false)),
      excludeSubstituteHolidays: normalizeManagementPolicyBoolean(source.excludeSubstituteHolidays, !normalizeManagementPolicyBoolean(legacy.includeSubstituteHolidays, false)),
      monthBasis: normalizeManagementPolicyStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], "CALENDAR_MONTH"),
      unit: normalizeManagementPolicyStringEnum(source.unit, ["DAY", "WEEK", "MONTH", "CUSTOM"], "MONTH"),
      weekStartsOn: normalizeManagementPolicyDayOfWeek(source.weekStartsOn, 1),
    };
  }

  function normalizeManagementPolicyStandardRule(value = {}, workingDays = [1, 2, 3, 4, 5], standardDailyMinutes = 480) {
    const source = value && typeof value === "object" ? value : {};

    return {
      method: normalizeManagementPolicyStringEnum(source.method, ["WORKING_DAYS_TIMES_DAILY_STANDARD", "WEEKLY_FIXED", "MONTHLY_FIXED", "SCHEDULE_TEMPLATE_SUM"], "WORKING_DAYS_TIMES_DAILY_STANDARD"),
      standardMonthlyMinutes: normalizeManagementPolicyMinutes(source.standardMonthlyMinutes, 0, 0, 60000),
      standardWeeklyMinutes: normalizeManagementPolicyMinutes(source.standardWeeklyMinutes, workingDays.length * standardDailyMinutes, 0, 10080),
    };
  }

  function normalizeManagementPolicyMinimumAdjustment(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const name = String(source.name || "").trim();
    const minutes = normalizeManagementPolicyMinutes(source.minutes, 0, 0, 10080);

    if (!name && minutes <= 0) {
      return null;
    }

    return {
      appliesTo: normalizeManagementPolicyStringList(source.appliesTo).filter((unit) => ["DAY", "WEEK", "MONTH", "CUSTOM"].includes(unit)),
      dayOfMonth: normalizeManagementPolicyDayOfMonth(source.dayOfMonth, 1),
      dayOfWeek: normalizeManagementPolicyDayOfWeek(source.dayOfWeek, 5),
      minutes,
      name: name || "근로시간 조정",
      onlyIfWorkingDay: normalizeManagementPolicyBoolean(source.onlyIfWorkingDay, true),
      repeatUnit: normalizeManagementPolicyStringEnum(source.repeatUnit, ["DAY", "WEEK", "MONTH"], "WEEK"),
      skipIfHoliday: normalizeManagementPolicyBoolean(source.skipIfHoliday, true),
      type: normalizeManagementPolicyStringEnum(source.type, ["DEDUCT", "ADD"], "DEDUCT"),
    };
  }

  function normalizeManagementPolicyMinimumRule(value = {}, dailyMinMinutes = 240, workingDays = [1, 2, 3, 4, 5]) {
    const source = value && typeof value === "object" ? value : {};

    return {
      adjustments: toArray(source.adjustments).map(normalizeManagementPolicyMinimumAdjustment).filter(Boolean),
      dailyMinMinutes: normalizeManagementPolicyMinutes(source.dailyMinMinutes, dailyMinMinutes, 0, 1440),
      method: normalizeManagementPolicyStringEnum(source.method, ["SAME_AS_STANDARD", "FIXED", "STANDARD_MINUS_ADJUSTMENTS", "DAILY_MIN_SUM"], "DAILY_MIN_SUM"),
      monthlyMinMinutes: normalizeManagementPolicyMinutes(source.monthlyMinMinutes, 0, 0, 60000),
      weeklyMinMinutes: normalizeManagementPolicyMinutes(source.weeklyMinMinutes, workingDays.length * dailyMinMinutes, 0, 10080),
    };
  }

  function normalizeManagementPolicyMaximumRule(value = {}, dailyMaxMinutes = 720) {
    const source = value && typeof value === "object" ? value : {};

    return {
      alertOnDailyLimit: normalizeManagementPolicyBoolean(source.alertOnDailyLimit, true),
      alertOnRestTime: normalizeManagementPolicyBoolean(source.alertOnRestTime, true),
      alertOnWeeklyLimit: normalizeManagementPolicyBoolean(source.alertOnWeeklyLimit, true),
      dailyMaxMinutes: normalizeManagementPolicyMinutes(source.dailyMaxMinutes, dailyMaxMinutes, 1, 1440),
      monthlyMaxMethod: normalizeManagementPolicyStringEnum(source.monthlyMaxMethod, ["WEEKLY_LIMIT_PRORATED", "FIXED"], "WEEKLY_LIMIT_PRORATED"),
      monthlyMaxMinutes: normalizeManagementPolicyMinutes(source.monthlyMaxMinutes, 0, 0, 60000),
      weeklyMaxMinutes: normalizeManagementPolicyMinutes(source.weeklyMaxMinutes, 3120, 1, 10080),
    };
  }

  function buildManagementWorkPolicyHolidayDateRules(holidayData = {}) {
    const items = Array.isArray(holidayData)
      ? holidayData
      : toArray(holidayData?.items);

    return items.map((item) => ({
      date: String(item?.date || item?.holidayDate || "").trim(),
      isCustom: Boolean(item?.isCustom),
      isSubstitute: Boolean(item?.isSubstitute),
    })).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  }

  function normalizeManagementPolicyHolidayDateRules(value = []) {
    return buildManagementWorkPolicyHolidayDateRules(value).reduce((map, item) => {
      map.set(item.date, item);
      return map;
    }, new Map());
  }

  function getManagementWorkPolicyInformation(policy = {}) {
    const policyJson = parseManagementPolicyJson(policy?.policyJson, {});
    const stored = policy?.workInformation && typeof policy.workInformation === "object"
      ? policy.workInformation
      : policyJson.workInformation && typeof policyJson.workInformation === "object"
        ? policyJson.workInformation
        : {};
    const standardDailyMinutes = normalizeManagementPolicyMinutes(
      stored.standardDailyMinutes ?? policy?.standardDailyMinutes,
      480,
      1,
      1440,
    );
    const dailyMaxMinutes = Math.max(standardDailyMinutes, normalizeManagementPolicyMinutes(
      stored.dailyMaxMinutes ?? policy?.dailyMaxMinutes,
      Math.max(720, standardDailyMinutes),
      1,
      1440,
    ));
    const dailyMinMinutes = Math.min(standardDailyMinutes, normalizeManagementPolicyMinutes(
      stored.dailyMinMinutes,
      Math.min(240, standardDailyMinutes),
      0,
      1440,
    ));
    const workingDays = normalizeManagementPolicyWorkingDays(stored.workingDays, [1, 2, 3, 4, 5]);
    const settlementRule = normalizeManagementPolicySettlementRule(stored.settlementRule, stored);
    const standardRule = normalizeManagementPolicyStandardRule(stored.standardRule, workingDays, standardDailyMinutes);
    const minimumRule = normalizeManagementPolicyMinimumRule(stored.minimumRule, dailyMinMinutes, workingDays);
    const maximumRule = normalizeManagementPolicyMaximumRule(stored.maximumRule, dailyMaxMinutes);

    return {
      dailyMaxMinutes,
      dailyMinMinutes,
      includeCustomHolidays: !settlementRule.excludeCustomHolidays,
      includePublicHolidays: !settlementRule.excludePublicHolidays,
      includeSubstituteHolidays: !settlementRule.excludeSubstituteHolidays,
      includeWeekends: normalizeManagementPolicyBoolean(stored.includeWeekends, false),
      maximumRule,
      minimumRule,
      policyName: String(stored.policyName || policy?.name || "기본 근로정보").trim(),
      settlementRule,
      standardDailyMinutes,
      standardRule,
      targetRule: normalizeManagementPolicyTargetRule(stored.targetRule),
      workType: normalizeManagementPolicyStringEnum(stored.workType || policy?.trackType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], "FIXED"),
      workingDays,
    };
  }

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules,
      getManagementWorkPolicyInformation,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyHolidayDateRules,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMinimumRule,
      normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule,
      normalizeManagementPolicyStringList,
      normalizeManagementPolicyTargetRule,
      normalizeManagementPolicyWorkingDays,
    });
  }

  return Object.freeze({
    create: createWorkPolicyNormalizer,
  });
});
