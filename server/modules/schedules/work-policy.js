const { createHttpError } = require("../common/http-error");

const DEFAULT_WORK_INFORMATION = Object.freeze({
  dailyMaxMinutes: 720,
  dailyMinMinutes: 240,
  includeCustomHolidays: false,
  includePublicHolidays: false,
  includeSubstituteHolidays: false,
  includeWeekends: false,
  maximumRule: Object.freeze({
    alertOnDailyLimit: true,
    alertOnRestTime: true,
    alertOnWeeklyLimit: true,
    dailyMaxMinutes: 720,
    monthlyMaxMethod: "WEEKLY_LIMIT_PRORATED",
    monthlyMaxMinutes: 0,
    weeklyMaxMinutes: 3120,
  }),
  minimumRule: Object.freeze({
    adjustments: Object.freeze([]),
    dailyMinMinutes: 240,
    method: "DAILY_MIN_SUM",
    monthlyMinMinutes: 0,
    weeklyMinMinutes: 1920,
  }),
  policyName: "기본 근로정보",
  settlementRule: Object.freeze({
    customPeriodEndDay: 31,
    customPeriodStartDay: 1,
    excludeCustomHolidays: false,
    excludePublicHolidays: false,
    excludeSubstituteHolidays: false,
    monthBasis: "CALENDAR_MONTH",
    unit: "MONTH",
    weekStartsOn: 1,
  }),
  standardRule: Object.freeze({
    method: "WORKING_DAYS_TIMES_DAILY_STANDARD",
    standardMonthlyMinutes: 0,
    standardWeeklyMinutes: 2400,
  }),
  standardDailyMinutes: 480,
  targetRule: Object.freeze({
    jobTitleIds: Object.freeze([]),
    scope: "ORGANIZATION",
    siteIds: Object.freeze([]),
    unitIds: Object.freeze([]),
  }),
  workType: "FIXED",
  workingDays: Object.freeze([1, 2, 3, 4, 5]),
});

function parseJsonColumn(value, fallback = {}) {
  if (!value) {
    return { ...fallback };
  }

  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString("utf8"), fallback);
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

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    return ["1", "true", "y", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function sanitizeMinutes(value, fallback = 0, min = 0, max = 1440) {
  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numericValue));
}

function readPayloadMinutes(value, fallback, label, min = 0, max = 1440) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";

  if (!hasValue) {
    return fallback;
  }

  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
    throw createHttpError(400, `${label}이 올바르지 않습니다.`, "WORK_POLICY_MINUTES_INVALID");
  }

  return numericValue;
}

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

function normalizeStringEnum(value, allowedValues = [], fallback = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();

  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

  return Array.from(new Set(source.map((entry) => String(entry || "").trim()).filter(Boolean)));
}

function normalizeDayOfWeek(value, fallback = 1) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7
    ? numericValue
    : fallback;
}

function normalizeDayOfMonth(value, fallback = 1) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 31
    ? numericValue
    : fallback;
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

function normalizeSettlementRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.settlementRule) {
  const source = value && typeof value === "object" ? value : {};
  const customPeriodStartDay = normalizeDayOfMonth(source.customPeriodStartDay, fallback.customPeriodStartDay);
  const customPeriodEndDay = normalizeDayOfMonth(source.customPeriodEndDay, fallback.customPeriodEndDay);

  return {
    customPeriodEndDay,
    customPeriodStartDay,
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

function normalizeMinimumAdjustment(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const name = String(source.name || "").trim();
  const minutes = sanitizeMinutes(source.minutes, 0, 0, 10080);

  if (!name && minutes <= 0) {
    return null;
  }

  return {
    appliesTo: normalizeStringList(source.appliesTo).filter((unit) => ["DAY", "WEEK", "MONTH", "CUSTOM"].includes(unit)),
    dayOfMonth: normalizeDayOfMonth(source.dayOfMonth, 1),
    dayOfWeek: normalizeDayOfWeek(source.dayOfWeek, 5),
    minutes,
    name: name || "근로시간 조정",
    onlyIfWorkingDay: normalizeBoolean(source.onlyIfWorkingDay, true),
    repeatUnit: normalizeStringEnum(source.repeatUnit, ["DAY", "WEEK", "MONTH"], "WEEK"),
    skipIfHoliday: normalizeBoolean(source.skipIfHoliday, true),
    type: normalizeStringEnum(source.type, ["DEDUCT", "ADD"], "DEDUCT"),
  };
}

function normalizeMinimumRule(value = {}, fallback = DEFAULT_WORK_INFORMATION.minimumRule) {
  const source = value && typeof value === "object" ? value : {};

  return {
    adjustments: (Array.isArray(source.adjustments) ? source.adjustments : [])
      .map(normalizeMinimumAdjustment)
      .filter(Boolean),
    dailyMinMinutes: sanitizeMinutes(source.dailyMinMinutes, fallback.dailyMinMinutes, 0, 1440),
    method: normalizeStringEnum(source.method, ["SAME_AS_STANDARD", "FIXED", "STANDARD_MINUS_ADJUSTMENTS", "DAILY_MIN_SUM"], fallback.method),
    monthlyMinMinutes: sanitizeMinutes(source.monthlyMinMinutes, fallback.monthlyMinMinutes, 0, 60000),
    weeklyMinMinutes: sanitizeMinutes(source.weeklyMinMinutes, fallback.weeklyMinMinutes, 0, 10080),
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

function buildWorkInformationFromPolicy(policy = {}) {
  const policyJson = parseJsonColumn(policy.policyJson || policy.policy_json, {});
  const stored = policyJson.workInformation && typeof policyJson.workInformation === "object"
    ? policyJson.workInformation
    : {};
  const standardDailyMinutes = sanitizeMinutes(
    stored.standardDailyMinutes ?? policy.standardDailyMinutes,
    DEFAULT_WORK_INFORMATION.standardDailyMinutes,
    1,
    1440,
  );
  const dailyMaxMinutes = Math.max(standardDailyMinutes, sanitizeMinutes(
    stored.dailyMaxMinutes ?? policy.dailyMaxMinutes,
    Math.max(DEFAULT_WORK_INFORMATION.dailyMaxMinutes, standardDailyMinutes),
    1,
    1440,
  ));
  const dailyMinMinutes = Math.min(standardDailyMinutes, sanitizeMinutes(
    stored.dailyMinMinutes,
    Math.min(DEFAULT_WORK_INFORMATION.dailyMinMinutes, standardDailyMinutes),
    0,
    1440,
  ));
  const workingDays = normalizeWorkingDays(stored.workingDays, DEFAULT_WORK_INFORMATION.workingDays);
  const standardRule = normalizeStandardRule(stored.standardRule, {
    ...DEFAULT_WORK_INFORMATION.standardRule,
    standardWeeklyMinutes: workingDays.length * standardDailyMinutes,
  });
  const minimumRule = normalizeMinimumRule(stored.minimumRule, {
    ...DEFAULT_WORK_INFORMATION.minimumRule,
    dailyMinMinutes,
    weeklyMinMinutes: workingDays.length * dailyMinMinutes,
  });
  const maximumRule = normalizeMaximumRule(stored.maximumRule, {
    ...DEFAULT_WORK_INFORMATION.maximumRule,
    dailyMaxMinutes,
  });
  const settlementRule = normalizeSettlementRule(stored.settlementRule, {
    ...DEFAULT_WORK_INFORMATION.settlementRule,
    excludeCustomHolidays: !normalizeBoolean(stored.includeCustomHolidays, DEFAULT_WORK_INFORMATION.includeCustomHolidays),
    excludePublicHolidays: !normalizeBoolean(stored.includePublicHolidays, DEFAULT_WORK_INFORMATION.includePublicHolidays),
    excludeSubstituteHolidays: !normalizeBoolean(stored.includeSubstituteHolidays, DEFAULT_WORK_INFORMATION.includeSubstituteHolidays),
  });

  return {
    dailyMaxMinutes,
    dailyMinMinutes,
    includeCustomHolidays: !settlementRule.excludeCustomHolidays,
    includePublicHolidays: !settlementRule.excludePublicHolidays,
    includeSubstituteHolidays: !settlementRule.excludeSubstituteHolidays,
    includeWeekends: normalizeBoolean(stored.includeWeekends, DEFAULT_WORK_INFORMATION.includeWeekends),
    maximumRule,
    minimumRule,
    policyName: String(stored.policyName || policy.name || DEFAULT_WORK_INFORMATION.policyName).trim(),
    settlementRule,
    standardDailyMinutes,
    standardRule,
    targetRule: normalizeTargetRule(stored.targetRule, DEFAULT_WORK_INFORMATION.targetRule),
    workType: normalizeStringEnum(stored.workType || policy.trackType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], DEFAULT_WORK_INFORMATION.workType),
    workingDays,
  };
}

function normalizeWorkInformationPayload(payload = {}, existingPolicy = {}) {
  const current = buildWorkInformationFromPolicy(existingPolicy);
  const workingDays = normalizeWorkingDays(payload.workingDays, []);

  if (workingDays.length === 0) {
    throw createHttpError(400, "근로 요일을 하나 이상 선택하세요.", "WORK_POLICY_WORKING_DAYS_REQUIRED");
  }

  const standardDailyMinutes = readPayloadMinutes(
    payload.standardDailyMinutes,
    current.standardDailyMinutes,
    "하루 기준 근로시간",
    1,
    1440,
  );
  const dailyMinMinutes = readPayloadMinutes(
    payload.dailyMinMinutes,
    current.dailyMinMinutes,
    "최소 근로시간",
    0,
    1440,
  );
  const dailyMaxMinutes = readPayloadMinutes(
    payload.dailyMaxMinutes,
    current.dailyMaxMinutes,
    "최대 근로시간",
    1,
    1440,
  );
  const standardRule = normalizeStandardRule(payload.standardRule, {
    ...current.standardRule,
    standardWeeklyMinutes: workingDays.length * standardDailyMinutes,
  });
  const minimumRule = normalizeMinimumRule(payload.minimumRule, {
    ...current.minimumRule,
    dailyMinMinutes,
    weeklyMinMinutes: workingDays.length * dailyMinMinutes,
  });
  const maximumRule = normalizeMaximumRule(payload.maximumRule, {
    ...current.maximumRule,
    dailyMaxMinutes,
  });

  if (dailyMinMinutes > standardDailyMinutes) {
    throw createHttpError(400, "최소 근로시간은 하루 기준 근로시간보다 클 수 없습니다.", "WORK_POLICY_MIN_EXCEEDS_STANDARD");
  }

  if (standardDailyMinutes > dailyMaxMinutes) {
    throw createHttpError(400, "하루 기준 근로시간은 최대 근로시간보다 클 수 없습니다.", "WORK_POLICY_STANDARD_EXCEEDS_MAX");
  }

  return {
    dailyMaxMinutes,
    dailyMinMinutes,
    includeCustomHolidays: normalizeBoolean(payload.includeCustomHolidays, current.includeCustomHolidays),
    includePublicHolidays: normalizeBoolean(payload.includePublicHolidays, current.includePublicHolidays),
    includeSubstituteHolidays: normalizeBoolean(payload.includeSubstituteHolidays, current.includeSubstituteHolidays),
    includeWeekends: normalizeBoolean(payload.includeWeekends, current.includeWeekends),
    maximumRule,
    minimumRule,
    policyName: String(payload.policyName || current.policyName || DEFAULT_WORK_INFORMATION.policyName).trim(),
    settlementRule: normalizeSettlementRule(payload.settlementRule, current.settlementRule),
    standardDailyMinutes,
    standardRule,
    targetRule: normalizeTargetRule(payload.targetRule, current.targetRule),
    workType: normalizeStringEnum(payload.workType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], current.workType),
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
