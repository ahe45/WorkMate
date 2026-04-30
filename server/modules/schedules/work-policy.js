const { createHttpError } = require("../common/http-error");
const {
  DEFAULT_CONTRACTUAL_RULE,
  DEFAULT_EMPLOYMENT_TARGET_TYPE,
  DEFAULT_MAXIMUM_WORK_RULE,
  DEFAULT_WORK_INFORMATION,
  DEFAULT_WORKING_DAYS,
  MANAGEMENT_POLICY_DAY_RULE_ORDER,
} = require("./work-policy-defaults");
const {
  normalizeBreakRule,
  validateBreakRule,
} = require("./work-policy-break-rule");
const {
  normalizeBoolean,
  normalizeDayOfMonth,
  normalizeDayOfWeek,
  normalizeStringEnum,
  normalizeStringList,
  parseJsonColumn,
  sanitizeMinutes,
  sanitizeNumber,
} = require("./work-policy-value-utils");

function normalizeWorkingDays(value, fallback = DEFAULT_WORK_INFORMATION.workingDays) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  const days = Array.from(new Set(source
    .map((entry) => Number(entry))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)))
    .sort((left, right) => left - right);

  return days.length > 0 ? days : Array.from(fallback);
}

function normalizeDayRuleType(value = "", fallback = "UNPAID_OFF") {
  return normalizeStringEnum(value, ["WORK", "UNPAID_OFF", "PAID_HOLIDAY"], fallback);
}

function buildLegacyDayRules(workingDays = DEFAULT_WORKING_DAYS, weeklyHolidayDay = 7) {
  const workingDaySet = new Set(normalizeWorkingDays(workingDays, DEFAULT_WORKING_DAYS));
  const paidHolidayDay = normalizeDayOfWeek(weeklyHolidayDay, 7);

  return MANAGEMENT_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    type: workingDaySet.has(dayOfWeek)
      ? "WORK"
      : dayOfWeek === paidHolidayDay
        ? "PAID_HOLIDAY"
        : "UNPAID_OFF",
  }));
}

function normalizeDayRules(value = [], legacy = {}) {
  const fallbackRules = buildLegacyDayRules(legacy.workingDays, legacy.weeklyHolidayDay);
  const dayRuleMap = fallbackRules.reduce((map, rule) => {
    map.set(rule.dayOfWeek, rule.type);
    return map;
  }, new Map());
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([dayOfWeek, type]) => ({
        dayOfWeek,
        type: type && typeof type === "object" ? type.type : type,
      }))
      : [];

  source.forEach((entry) => {
    const dayOfWeek = normalizeDayOfWeek(entry?.dayOfWeek, 0);

    if (!dayOfWeek) {
      return;
    }

    dayRuleMap.set(dayOfWeek, normalizeDayRuleType(entry?.type, dayRuleMap.get(dayOfWeek) || "UNPAID_OFF"));
  });

  return MANAGEMENT_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    type: dayRuleMap.get(dayOfWeek) || "UNPAID_OFF",
  }));
}

function getWorkingDaysFromDayRules(dayRules = [], fallback = DEFAULT_WORKING_DAYS) {
  const workDays = dayRules
    .filter((rule) => normalizeDayRuleType(rule?.type, "UNPAID_OFF") === "WORK")
    .map((rule) => normalizeDayOfWeek(rule?.dayOfWeek, 0))
    .filter(Boolean);

  return normalizeWorkingDays(workDays, fallback);
}

function getPrimaryWeeklyHolidayDay(dayRules = [], fallback = 7) {
  const paidHolidayRule = normalizeDayRules(dayRules, {
    weeklyHolidayDay: fallback,
    workingDays: DEFAULT_WORKING_DAYS,
  }).find((rule) => rule.type === "PAID_HOLIDAY");

  return normalizeDayOfWeek(paidHolidayRule?.dayOfWeek, fallback);
}

function normalizeTargetRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.targetRule) {
  const source = value && typeof value === "object" ? value : {};

  return {
    jobTitleIds: normalizeStringList(source.jobTitleIds ?? fallback.jobTitleIds),
    scope: normalizeStringEnum(source.scope, ["ORGANIZATION", "UNITS", "JOB_TITLES", "SITES", "MIXED"], fallback.scope),
    siteIds: normalizeStringList(source.siteIds ?? fallback.siteIds),
    unitIds: normalizeStringList(source.unitIds ?? fallback.unitIds),
  };
}

function normalizeEmploymentTargetType(value = "", fallback = DEFAULT_EMPLOYMENT_TARGET_TYPE) {
  return normalizeStringEnum(value, ["FULL_TIME", "PART_TIME"], fallback);
}

function normalizeSettlementRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.settlementRule) {
  const source = value && typeof value === "object" ? value : {};

  return {
    customPeriodEndDay: normalizeDayOfMonth(source.customPeriodEndDay, fallback.customPeriodEndDay),
    customPeriodStartDay: normalizeDayOfMonth(source.customPeriodStartDay, fallback.customPeriodStartDay),
    excludeCustomHolidays: normalizeBoolean(source.excludeCustomHolidays, fallback.excludeCustomHolidays),
    excludePublicHolidays: normalizeBoolean(source.excludePublicHolidays, fallback.excludePublicHolidays),
    excludeSubstituteHolidays: normalizeBoolean(source.excludeSubstituteHolidays, fallback.excludeSubstituteHolidays),
    monthBasis: normalizeStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], fallback.monthBasis),
    unit: normalizeStringEnum(source.unit, ["DAY", "WEEK", "MONTH", "CUSTOM"], fallback.unit),
    weekStartsOn: normalizeDayOfWeek(source.weekStartsOn, fallback.weekStartsOn),
  };
}

function normalizeStandardRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.standardRule) {
  const source = value && typeof value === "object" ? value : {};

  return {
    method: normalizeStringEnum(source.method, ["WORKING_DAYS_TIMES_DAILY_STANDARD", "WEEKLY_FIXED", "MONTHLY_FIXED", "SCHEDULE_TEMPLATE_SUM"], fallback.method),
    standardMonthlyMinutes: sanitizeMinutes(source.standardMonthlyMinutes, fallback.standardMonthlyMinutes, 0, 60000),
    standardWeeklyMinutes: sanitizeMinutes(source.standardWeeklyMinutes, fallback.standardWeeklyMinutes, 0, 10080),
  };
}

function normalizeMaximumRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.maximumRule) {
  const source = value && typeof value === "object" ? value : {};

  return {
    alertOnDailyLimit: normalizeBoolean(source.alertOnDailyLimit, fallback.alertOnDailyLimit),
    alertOnRestTime: normalizeBoolean(source.alertOnRestTime, fallback.alertOnRestTime),
    alertOnWeeklyLimit: normalizeBoolean(source.alertOnWeeklyLimit, fallback.alertOnWeeklyLimit),
    dailyMaxMinutes: sanitizeMinutes(source.dailyMaxMinutes, fallback.dailyMaxMinutes, 1, 1440),
    monthlyMaxMethod: normalizeStringEnum(source.monthlyMaxMethod, ["WEEKLY_LIMIT_PRORATED", "FIXED"], fallback.monthlyMaxMethod),
    monthlyMaxMinutes: sanitizeMinutes(source.monthlyMaxMinutes, fallback.monthlyMaxMinutes, 0, 60000),
    weeklyMaxMinutes: sanitizeMinutes(source.weeklyMaxMinutes, fallback.weeklyMaxMinutes, 1, 10080),
  };
}

function getLegacyHolidayFallback(source = {}) {
  return normalizeBoolean(source.includeWeekends, false)
    || normalizeBoolean(source.includePublicHolidays, false)
    || normalizeBoolean(source.includeSubstituteHolidays, false)
    || normalizeBoolean(source.includeCustomHolidays, false)
    || !normalizeBoolean(source.settlementRule?.excludePublicHolidays, true)
    || !normalizeBoolean(source.settlementRule?.excludeSubstituteHolidays, true)
    || !normalizeBoolean(source.settlementRule?.excludeCustomHolidays, true);
}

function getLegacyPublicHolidayFallback(source = {}) {
  return normalizeBoolean(source.includePublicHolidays, false)
    || normalizeBoolean(source.includeSubstituteHolidays, false)
    || normalizeBoolean(source.includeCustomHolidays, false)
    || !normalizeBoolean(source.settlementRule?.excludePublicHolidays, true)
    || !normalizeBoolean(source.settlementRule?.excludeSubstituteHolidays, true)
    || !normalizeBoolean(source.settlementRule?.excludeCustomHolidays, true);
}

function getReferenceDayCount(unit = "DAY", config = {}, workingDayCount = 5) {
  const normalizedUnit = normalizeStringEnum(unit, ["DAY", "WEEK", "MONTH"], "DAY");
  const includeHolidays = normalizeBoolean(config.includeHolidays, false);

  if (normalizedUnit === "DAY") {
    return 1;
  }

  if (normalizedUnit === "WEEK") {
    return includeHolidays ? 7 : Math.max(1, workingDayCount);
  }

  const customPeriodStartDay = normalizeDayOfMonth(config.customPeriodStartDay, 1);
  const customPeriodEndDay = normalizeDayOfMonth(config.customPeriodEndDay, 31);
  const customPeriodLength = customPeriodEndDay >= customPeriodStartDay
    ? (customPeriodEndDay - customPeriodStartDay) + 1
    : ((31 - customPeriodStartDay) + 1) + customPeriodEndDay;
  const usesCustomMonthRange = normalizeStringEnum(config.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], "MONTH") === "CUSTOM"
    || normalizeStringEnum(config.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], "CALENDAR_MONTH") === "CUSTOM_PERIOD";
  const calendarDays = usesCustomMonthRange
    ? customPeriodLength
    : 30;

  return includeHolidays
    ? calendarDays
    : Math.max(1, Math.round((calendarDays / 7) * Math.max(1, workingDayCount)));
}

function normalizeContractualRule(value = {}, legacy = {}, workingDays = DEFAULT_WORKING_DAYS) {
  const source = value && typeof value === "object" ? value : {};
  const fallbackUnitByMethod = {
    MONTHLY_FIXED: "MONTH",
    SCHEDULE_TEMPLATE_SUM: "DAY",
    WEEKLY_FIXED: "WEEK",
    WORKING_DAYS_TIMES_DAILY_STANDARD: "DAY",
  };
  const standardMethod = normalizeStringEnum(legacy.standardRule?.method, ["WORKING_DAYS_TIMES_DAILY_STANDARD", "WEEKLY_FIXED", "MONTHLY_FIXED", "SCHEDULE_TEMPLATE_SUM"], "WORKING_DAYS_TIMES_DAILY_STANDARD");
  const fallbackUnit = fallbackUnitByMethod[standardMethod] || DEFAULT_CONTRACTUAL_RULE.unit;
  const fallbackMinutes = fallbackUnit === "MONTH"
    ? sanitizeMinutes(legacy.standardRule?.standardMonthlyMinutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 60000)
    : fallbackUnit === "WEEK"
      ? sanitizeMinutes(legacy.standardRule?.standardWeeklyMinutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 10080)
      : sanitizeMinutes(legacy.standardDailyMinutes, 480, 1, 1440);
  const fallbackOvertimeLimitMinutes = fallbackUnit === "MONTH"
    ? sanitizeMinutes(legacy.maximumRule?.monthlyMaxMinutes, 0, 1, 60000)
    : fallbackUnit === "WEEK"
      ? sanitizeMinutes(legacy.maximumRule?.weeklyMaxMinutes, 3120, 1, 10080)
      : sanitizeMinutes(legacy.dailyMaxMinutes, 720, 1, 1440);
  const fallbackMonthBasis = normalizeStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], legacy.settlementRule?.monthBasis || DEFAULT_CONTRACTUAL_RULE.monthBasis);
  const fallbackPeriodUnit = normalizeStringEnum(source.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], legacy.settlementRule?.unit || DEFAULT_CONTRACTUAL_RULE.periodUnit);
  const periodUnit = fallbackPeriodUnit === "CUSTOM" || fallbackMonthBasis === "CUSTOM_PERIOD"
    ? "CUSTOM"
    : fallbackPeriodUnit;

  return {
    customPeriodEndDay: normalizeDayOfMonth(source.customPeriodEndDay, legacy.settlementRule?.customPeriodEndDay || DEFAULT_CONTRACTUAL_RULE.customPeriodEndDay),
    customPeriodStartDay: normalizeDayOfMonth(source.customPeriodStartDay, legacy.settlementRule?.customPeriodStartDay || DEFAULT_CONTRACTUAL_RULE.customPeriodStartDay),
    includeHolidays: normalizeBoolean(source.includeHolidays, getLegacyHolidayFallback(legacy)),
    includePublicHolidays: normalizeBoolean(source.includePublicHolidays, getLegacyPublicHolidayFallback(legacy)),
    minutes: sanitizeMinutes(source.minutes, fallbackMinutes, 1, 60000),
    monthBasis: periodUnit === "CUSTOM" ? "CUSTOM_PERIOD" : "CALENDAR_MONTH",
    overtimeLimitMinutes: sanitizeMinutes(source.overtimeLimitMinutes, fallbackOvertimeLimitMinutes, 1, 60000),
    overtimeLimitUnit: normalizeStringEnum(source.overtimeLimitUnit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
    overtimeMinimumMinutes: sanitizeMinutes(source.overtimeMinimumMinutes, 0, 0, 60000),
    overtimeMinimumUnit: normalizeStringEnum(source.overtimeMinimumUnit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
    periodCount: periodUnit === "CUSTOM"
      ? 1
      : sanitizeNumber(source.periodCount, DEFAULT_CONTRACTUAL_RULE.periodCount, 1, 365),
    periodUnit,
    unit: normalizeStringEnum(source.unit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
    weekStartsOn: normalizeDayOfWeek(source.weekStartsOn, legacy.settlementRule?.weekStartsOn || DEFAULT_CONTRACTUAL_RULE.weekStartsOn),
  };
}

function normalizeMaximumWorkRule(value = {}, legacy = {}, workingDays = DEFAULT_WORKING_DAYS) {
  const source = value && typeof value === "object" ? value : {};
  const fallbackUnit = legacy.maximumRule?.monthlyMaxMethod === "FIXED" && Number(legacy.maximumRule?.monthlyMaxMinutes || 0) > 0
    ? "MONTH"
    : "WEEK";
  const fallbackMinutes = fallbackUnit === "MONTH"
    ? sanitizeMinutes(legacy.maximumRule?.monthlyMaxMinutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 60000)
    : fallbackUnit === "DAY"
      ? sanitizeMinutes(legacy.dailyMaxMinutes, 720, 1, 1440)
      : sanitizeMinutes(legacy.maximumRule?.weeklyMaxMinutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 10080);

  return {
    customPeriodEndDay: normalizeDayOfMonth(source.customPeriodEndDay, legacy.settlementRule?.customPeriodEndDay || DEFAULT_MAXIMUM_WORK_RULE.customPeriodEndDay),
    customPeriodStartDay: normalizeDayOfMonth(source.customPeriodStartDay, legacy.settlementRule?.customPeriodStartDay || DEFAULT_MAXIMUM_WORK_RULE.customPeriodStartDay),
    includeHolidays: normalizeBoolean(source.includeHolidays, getLegacyHolidayFallback(legacy)),
    minutes: sanitizeMinutes(source.minutes, fallbackMinutes, 1, 60000),
    monthBasis: normalizeStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], legacy.settlementRule?.monthBasis || DEFAULT_MAXIMUM_WORK_RULE.monthBasis),
    periodUnit: normalizeStringEnum(source.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], legacy.settlementRule?.unit || DEFAULT_MAXIMUM_WORK_RULE.periodUnit),
    unit: normalizeStringEnum(source.unit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
    weekStartsOn: normalizeDayOfWeek(source.weekStartsOn, legacy.settlementRule?.weekStartsOn || DEFAULT_MAXIMUM_WORK_RULE.weekStartsOn),
  };
}

function deriveStandardFromContractualRule(contractualRule = DEFAULT_CONTRACTUAL_RULE, workingDays = DEFAULT_WORKING_DAYS, workType = DEFAULT_WORK_INFORMATION.workType) {
  const workingDayCount = Math.max(1, workingDays.length || DEFAULT_WORKING_DAYS.length);
  const unit = normalizeStringEnum(contractualRule.unit, ["DAY", "WEEK", "MONTH"], DEFAULT_CONTRACTUAL_RULE.unit);
  const minutes = sanitizeMinutes(contractualRule.minutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 60000);
  const referenceDayCount = getReferenceDayCount(unit, contractualRule, workingDayCount);
  const weekReferenceDayCount = getReferenceDayCount("WEEK", contractualRule, workingDayCount);
  const monthReferenceDayCount = getReferenceDayCount("MONTH", contractualRule, workingDayCount);
  const standardDailyMinutes = unit === "DAY"
    ? minutes
    : Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
  const standardWeeklyMinutes = unit === "WEEK"
    ? minutes
    : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));
  const standardMonthlyMinutes = unit === "MONTH"
    ? minutes
    : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount));
  const normalizedWorkType = normalizeStringEnum(workType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], DEFAULT_WORK_INFORMATION.workType);
  const method = normalizedWorkType === "SCHEDULE_BASED"
    ? "SCHEDULE_TEMPLATE_SUM"
    : unit === "WEEK"
      ? "WEEKLY_FIXED"
      : unit === "MONTH"
        ? "MONTHLY_FIXED"
        : "WORKING_DAYS_TIMES_DAILY_STANDARD";

  return {
    standardDailyMinutes,
    standardRule: {
      method,
      standardMonthlyMinutes,
      standardWeeklyMinutes,
    },
  };
}

function deriveMaximumFromRule(maximumWorkRule = DEFAULT_MAXIMUM_WORK_RULE, workingDays = DEFAULT_WORKING_DAYS, alertSource = DEFAULT_WORK_INFORMATION.maximumRule) {
  const workingDayCount = Math.max(1, workingDays.length || DEFAULT_WORKING_DAYS.length);
  const unit = normalizeStringEnum(maximumWorkRule.unit, ["DAY", "WEEK", "MONTH"], DEFAULT_MAXIMUM_WORK_RULE.unit);
  const minutes = sanitizeMinutes(maximumWorkRule.minutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 60000);
  const referenceDayCount = getReferenceDayCount(unit, maximumWorkRule, workingDayCount);
  const weekReferenceDayCount = getReferenceDayCount("WEEK", maximumWorkRule, workingDayCount);
  const monthReferenceDayCount = getReferenceDayCount("MONTH", maximumWorkRule, workingDayCount);
  const dailyMaxMinutes = Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
  const weeklyMaxMinutes = unit === "WEEK"
    ? minutes
    : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));

  return {
    dailyMaxMinutes,
    maximumRule: {
      alertOnDailyLimit: normalizeBoolean(alertSource.alertOnDailyLimit, true),
      alertOnRestTime: normalizeBoolean(alertSource.alertOnRestTime, true),
      alertOnWeeklyLimit: normalizeBoolean(alertSource.alertOnWeeklyLimit, true),
      dailyMaxMinutes,
      monthlyMaxMethod: unit === "MONTH" ? "FIXED" : "WEEKLY_LIMIT_PRORATED",
      monthlyMaxMinutes: unit === "MONTH"
        ? minutes
        : Math.max(0, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount)),
      weeklyMaxMinutes,
    },
  };
}

function buildWorkInformationFromPolicy(policy = {}) {
  const policyJson = parseJsonColumn(policy.policyJson || policy.policy_json, {});
  const stored = policyJson.workInformation && typeof policyJson.workInformation === "object"
    ? policyJson.workInformation
    : {};
  const dayRules = normalizeDayRules(stored.dayRules, stored);
  const workingDays = getWorkingDaysFromDayRules(dayRules, DEFAULT_WORK_INFORMATION.workingDays);
  const workType = normalizeStringEnum(stored.workType || policy.trackType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], DEFAULT_WORK_INFORMATION.workType);
  const breakRule = normalizeBreakRule(stored.breakRule, stored);
  const contractualRule = normalizeContractualRule(stored.contractualRule, stored, workingDays);
  const alertSource = normalizeMaximumRule(stored.maximumRule, DEFAULT_WORK_INFORMATION.maximumRule);
  const maximumWorkRule = normalizeMaximumWorkRule(stored.maximumWorkRule, stored, workingDays);
  const derivedStandard = deriveStandardFromContractualRule(contractualRule, workingDays, workType);
  const derivedMaximum = deriveMaximumFromRule(maximumWorkRule, workingDays, alertSource);
  const includeHolidays = normalizeBoolean(contractualRule.includeHolidays, false);
  const includePublicHolidays = normalizeBoolean(contractualRule.includePublicHolidays, false);
  const employmentTargetType = normalizeEmploymentTargetType(
    stored.employmentTargetType,
    Number(stored.hourlyWage || 0) > 0 ? "PART_TIME" : DEFAULT_EMPLOYMENT_TARGET_TYPE,
  );

  return {
    breakRule,
    contractualRule,
    dayRules,
    dailyMaxMinutes: derivedMaximum.dailyMaxMinutes,
    employmentTargetType,
    hourlyWage: employmentTargetType === "PART_TIME"
      ? sanitizeNumber(stored.hourlyWage, DEFAULT_WORK_INFORMATION.hourlyWage, 0, 1000000000)
      : 0,
    includeCustomHolidays: includePublicHolidays,
    includePublicHolidays,
    includeSubstituteHolidays: includePublicHolidays,
    includeWeekends: includeHolidays,
    maximumRule: normalizeMaximumRule(derivedMaximum.maximumRule, DEFAULT_WORK_INFORMATION.maximumRule),
    maximumWorkRule,
    policyName: String(stored.policyName || policy.name || DEFAULT_WORK_INFORMATION.policyName).trim(),
    settlementRule: normalizeSettlementRule({
      customPeriodEndDay: contractualRule.customPeriodEndDay,
      customPeriodStartDay: contractualRule.customPeriodStartDay,
      excludeCustomHolidays: !includePublicHolidays,
      excludePublicHolidays: !includePublicHolidays,
      excludeSubstituteHolidays: !includePublicHolidays,
      monthBasis: contractualRule.monthBasis,
      unit: contractualRule.periodUnit,
      weekStartsOn: contractualRule.weekStartsOn,
    }, DEFAULT_WORK_INFORMATION.settlementRule),
    standardDailyMinutes: derivedStandard.standardDailyMinutes,
    standardRule: normalizeStandardRule(derivedStandard.standardRule, DEFAULT_WORK_INFORMATION.standardRule),
    targetRule: normalizeTargetRule(stored.targetRule, DEFAULT_WORK_INFORMATION.targetRule),
    weeklyHolidayDay: getPrimaryWeeklyHolidayDay(dayRules, normalizeDayOfWeek(stored.weeklyHolidayDay, DEFAULT_WORK_INFORMATION.weeklyHolidayDay)),
    workType,
    workingDays,
  };
}

function normalizeWorkInformationPayload(payload = {}, existingPolicy = {}) {
  const current = buildWorkInformationFromPolicy(existingPolicy);
  const dayRules = normalizeDayRules(payload.dayRules, payload);
  const workingDays = getWorkingDaysFromDayRules(dayRules, []);

  if (workingDays.length === 0) {
    throw createHttpError(400, "근로 요일을 하나 이상 선택하세요.", "WORK_POLICY_WORKING_DAYS_REQUIRED");
  }

  const workType = normalizeStringEnum(payload.workType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], current.workType);
  const breakRule = normalizeBreakRule(payload.breakRule, current.breakRule || current);
  validateBreakRule(breakRule);
  const legacySource = {
    ...current,
    breakRule,
    dailyMaxMinutes: payload.dailyMaxMinutes ?? current.dailyMaxMinutes,
    includeCustomHolidays: payload.includeCustomHolidays ?? current.includeCustomHolidays,
    includePublicHolidays: payload.includePublicHolidays ?? current.includePublicHolidays,
    includeSubstituteHolidays: payload.includeSubstituteHolidays ?? current.includeSubstituteHolidays,
    includeWeekends: payload.includeWeekends ?? current.includeWeekends,
    maximumRule: payload.maximumRule || current.maximumRule,
    settlementRule: payload.settlementRule || current.settlementRule,
    standardDailyMinutes: payload.standardDailyMinutes ?? current.standardDailyMinutes,
    standardRule: payload.standardRule || current.standardRule,
  };
  const contractualRule = normalizeContractualRule(payload.contractualRule, legacySource, workingDays);
  const alertSource = normalizeMaximumRule(payload.maximumRule, current.maximumRule);
  const maximumWorkRule = normalizeMaximumWorkRule(payload.maximumWorkRule, legacySource, workingDays);
  const derivedStandard = deriveStandardFromContractualRule(contractualRule, workingDays, workType);
  const derivedMaximum = deriveMaximumFromRule(maximumWorkRule, workingDays, alertSource);

  if (derivedStandard.standardDailyMinutes > derivedMaximum.dailyMaxMinutes) {
    throw createHttpError(400, "소정근로시간이 연장근로 최대기준보다 클 수 없습니다.", "WORK_POLICY_STANDARD_EXCEEDS_MAX");
  }

  if (derivedStandard.standardRule.standardWeeklyMinutes > derivedMaximum.maximumRule.weeklyMaxMinutes) {
    throw createHttpError(400, "주 소정근로시간이 주 연장근로 최대기준보다 클 수 없습니다.", "WORK_POLICY_STANDARD_WEEKLY_EXCEEDS_MAX");
  }

  const includeHolidays = normalizeBoolean(contractualRule.includeHolidays, false);
  const includePublicHolidays = normalizeBoolean(contractualRule.includePublicHolidays, false);
  const normalizedHourlyWage = sanitizeNumber(payload.hourlyWage, current.hourlyWage, 0, 1000000000);
  const employmentTargetType = normalizeEmploymentTargetType(
    payload.employmentTargetType,
    normalizedHourlyWage > 0 ? "PART_TIME" : current.employmentTargetType,
  );

  return {
    breakRule,
    contractualRule,
    dayRules,
    dailyMaxMinutes: derivedMaximum.dailyMaxMinutes,
    employmentTargetType,
    hourlyWage: employmentTargetType === "PART_TIME" ? normalizedHourlyWage : 0,
    includeCustomHolidays: includePublicHolidays,
    includePublicHolidays,
    includeSubstituteHolidays: includePublicHolidays,
    includeWeekends: includeHolidays,
    maximumRule: normalizeMaximumRule(derivedMaximum.maximumRule, current.maximumRule),
    maximumWorkRule,
    policyName: String(payload.policyName || current.policyName || DEFAULT_WORK_INFORMATION.policyName).trim(),
    settlementRule: normalizeSettlementRule({
      customPeriodEndDay: contractualRule.customPeriodEndDay,
      customPeriodStartDay: contractualRule.customPeriodStartDay,
      excludeCustomHolidays: !includePublicHolidays,
      excludePublicHolidays: !includePublicHolidays,
      excludeSubstituteHolidays: !includePublicHolidays,
      monthBasis: contractualRule.monthBasis,
      unit: contractualRule.periodUnit,
      weekStartsOn: contractualRule.weekStartsOn,
    }, current.settlementRule),
    standardDailyMinutes: derivedStandard.standardDailyMinutes,
    standardRule: normalizeStandardRule(derivedStandard.standardRule, current.standardRule),
    targetRule: normalizeTargetRule(payload.targetRule, current.targetRule),
    weeklyHolidayDay: getPrimaryWeeklyHolidayDay(dayRules, normalizeDayOfWeek(payload.weeklyHolidayDay, current.weeklyHolidayDay)),
    workType,
    workingDays,
  };
}

function serializeWorkPolicy(row = {}) {
  const policyJson = parseJsonColumn(row.policyJson, {});

  return {
    ...row,
    isDefault: Boolean(Number(row.isDefault || 0)),
    policyJson,
    workInformation: buildWorkInformationFromPolicy({
      ...row,
      policyJson,
    }),
  };
}

module.exports = {
  DEFAULT_WORK_INFORMATION,
  buildWorkInformationFromPolicy,
  normalizeWorkInformationPayload,
  serializeWorkPolicy,
};
