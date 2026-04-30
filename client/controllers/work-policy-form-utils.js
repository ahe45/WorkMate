(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyFormUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MANAGEMENT_WORK_POLICY_DAY_RULE_ORDER = [7, 1, 2, 3, 4, 5, 6];

  function normalizeManagementWorkPolicyEnum(value = "", fallback = "") {
    return String(value || fallback).trim().toUpperCase();
  }

  function normalizeManagementWorkPolicyEmploymentTargetType(value = "", fallback = "FULL_TIME") {
    const normalizedValue = normalizeManagementWorkPolicyEnum(value, fallback);

    return ["FULL_TIME", "PART_TIME"].includes(normalizedValue) ? normalizedValue : fallback;
  }

  function normalizeManagementWorkPolicyDayRuleType(value = "", fallback = "UNPAID_OFF") {
    const normalizedValue = normalizeManagementWorkPolicyEnum(value, fallback);

    return ["WORK", "UNPAID_OFF", "PAID_HOLIDAY"].includes(normalizedValue) ? normalizedValue : fallback;
  }

  function normalizeManagementWorkPolicyBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      return ["1", "true", "y", "yes", "on"].includes(value.trim().toLowerCase());
    }

    return Boolean(value);
  }

  function normalizeManagementWorkPolicyNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const normalizedValue = typeof value === "string"
      ? value.replace(/,/g, "").trim()
      : value;
    const numericValue = Math.round(Number(normalizedValue));

    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, numericValue));
  }

  function formatManagementWorkPolicyCurrencyInputValue(value = "", { fallback = "" } = {}) {
    const digits = String(value ?? "").replace(/[^\d]/g, "");

    if (!digits) {
      return fallback;
    }

    return new Intl.NumberFormat("ko-KR").format(Number(digits));
  }

  function getManagementWorkPolicyPreviousDayOfWeek(dayOfWeek = 1) {
    const normalizedDay = normalizeManagementWorkPolicyNumber(dayOfWeek, 1, 1, 7);
    return normalizedDay <= 1 ? 7 : normalizedDay - 1;
  }

  function getManagementWorkPolicyNextDayOfWeek(dayOfWeek = 7) {
    const normalizedDay = normalizeManagementWorkPolicyNumber(dayOfWeek, 7, 1, 7);
    return normalizedDay >= 7 ? 1 : normalizedDay + 1;
  }

  function buildManagementWorkPolicyDayRulesFromFormData(formData) {
    return MANAGEMENT_WORK_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => {
      const rawValue = formData.get(`dayRule${dayOfWeek}`);

      return {
        dayOfWeek,
        type: rawValue === null || rawValue === ""
          ? ""
          : normalizeManagementWorkPolicyDayRuleType(rawValue, "UNPAID_OFF"),
      };
    });
  }

  function getManagementWorkPolicyWorkingDaysFromDayRules(dayRules = []) {
    return dayRules
      .filter((rule) => normalizeManagementWorkPolicyDayRuleType(rule?.type, "UNPAID_OFF") === "WORK")
      .map((rule) => normalizeManagementWorkPolicyNumber(rule?.dayOfWeek, 0, 1, 7))
      .filter(Boolean)
      .sort((left, right) => left - right);
  }

  function getManagementWorkPolicyPrimaryWeeklyHolidayDay(dayRules = [], fallback = 7) {
    const paidHolidayRule = dayRules.find((rule) => normalizeManagementWorkPolicyDayRuleType(rule?.type, "UNPAID_OFF") === "PAID_HOLIDAY");

    return normalizeManagementWorkPolicyNumber(paidHolidayRule?.dayOfWeek, fallback, 1, 7);
  }

  function getManagementWorkPolicyReferenceDayCount(unit = "DAY", config = {}, workingDayCount = 5) {
    const normalizedUnit = normalizeManagementWorkPolicyEnum(unit, "DAY");
    const includeHolidays = normalizeManagementWorkPolicyBoolean(config.includeHolidays, false);

    if (normalizedUnit === "DAY") {
      return 1;
    }

    if (normalizedUnit === "WEEK") {
      return includeHolidays ? 7 : Math.max(1, workingDayCount);
    }

    const customPeriodStartDay = normalizeManagementWorkPolicyNumber(config.customPeriodStartDay, 1, 1, 31);
    const customPeriodEndDay = normalizeManagementWorkPolicyNumber(config.customPeriodEndDay, 31, 1, 31);
    const customPeriodLength = customPeriodEndDay >= customPeriodStartDay
      ? (customPeriodEndDay - customPeriodStartDay) + 1
      : ((31 - customPeriodStartDay) + 1) + customPeriodEndDay;
    const usesCustomMonthRange = normalizeManagementWorkPolicyEnum(config.periodUnit, "MONTH") === "CUSTOM"
      || normalizeManagementWorkPolicyEnum(config.monthBasis, "CALENDAR_MONTH") === "CUSTOM_PERIOD";
    const calendarDays = usesCustomMonthRange
      ? customPeriodLength
      : 30;

    return includeHolidays
      ? calendarDays
      : Math.max(1, Math.round((calendarDays / 7) * Math.max(1, workingDayCount)));
  }

  function deriveManagementWorkPolicyStandardRule(contractualRule = {}, workingDays = [], workType = "FIXED") {
    const workingDayCount = Math.max(1, Array.isArray(workingDays) ? workingDays.length : 0);
    const unit = normalizeManagementWorkPolicyEnum(contractualRule.unit, "WEEK");
    const minutes = normalizeManagementWorkPolicyNumber(contractualRule.minutes, 2400, 1, 60000);
    const referenceDayCount = getManagementWorkPolicyReferenceDayCount(unit, contractualRule, workingDayCount);
    const weekReferenceDayCount = getManagementWorkPolicyReferenceDayCount("WEEK", contractualRule, workingDayCount);
    const monthReferenceDayCount = getManagementWorkPolicyReferenceDayCount("MONTH", contractualRule, workingDayCount);
    const standardDailyMinutes = unit === "DAY"
      ? minutes
      : Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
    const standardWeeklyMinutes = unit === "WEEK"
      ? minutes
      : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));
    const standardMonthlyMinutes = unit === "MONTH"
      ? minutes
      : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount));
    const normalizedWorkType = normalizeManagementWorkPolicyEnum(workType, "FIXED");
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

  function deriveManagementWorkPolicyMaximumRule(maximumWorkRule = {}, workingDays = []) {
    const workingDayCount = Math.max(1, Array.isArray(workingDays) ? workingDays.length : 0);
    const unit = normalizeManagementWorkPolicyEnum(maximumWorkRule.unit, "WEEK");
    const minutes = normalizeManagementWorkPolicyNumber(maximumWorkRule.minutes, 3120, 1, 60000);
    const referenceDayCount = getManagementWorkPolicyReferenceDayCount(unit, maximumWorkRule, workingDayCount);
    const weekReferenceDayCount = getManagementWorkPolicyReferenceDayCount("WEEK", maximumWorkRule, workingDayCount);
    const monthReferenceDayCount = getManagementWorkPolicyReferenceDayCount("MONTH", maximumWorkRule, workingDayCount);
    const dailyMaxMinutes = Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
    const weeklyMaxMinutes = unit === "WEEK"
      ? minutes
      : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));

    return {
      dailyMaxMinutes,
      maximumRule: {
        alertOnDailyLimit: true,
        alertOnRestTime: true,
        alertOnWeeklyLimit: true,
        dailyMaxMinutes,
        monthlyMaxMethod: unit === "MONTH" ? "FIXED" : "WEEKLY_LIMIT_PRORATED",
        monthlyMaxMinutes: unit === "MONTH"
          ? minutes
          : Math.max(0, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount)),
        weeklyMaxMinutes,
      },
    };
  }

  function createManagementWorkPolicyAutoBreakRange(minimumWorkMinutes = Number.NaN, breakMinutes = Number.NaN) {
    return {
      breakMinutes,
      minimumWorkMinutes,
    };
  }

  function sortManagementWorkPolicyAutoBreakRanges(ranges = []) {
    return ranges.slice().sort((left, right) => {
      const leftMinimum = normalizeManagementWorkPolicyNumber(left.minimumWorkMinutes, 0, 0, 60000);
      const rightMinimum = normalizeManagementWorkPolicyNumber(right.minimumWorkMinutes, 0, 0, 60000);

      if (leftMinimum !== rightMinimum) {
        return leftMinimum - rightMinimum;
      }

      return normalizeManagementWorkPolicyNumber(left.breakMinutes, 0, 0, 1440)
        - normalizeManagementWorkPolicyNumber(right.breakMinutes, 0, 0, 1440);
    });
  }

  function normalizeManagementWorkPolicyTargetRulePayload(targetRule = {}) {
    const normalizedScope = normalizeManagementWorkPolicyEnum(targetRule.scope, "ORGANIZATION");
    const normalizeIds = (values = []) => values
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (normalizedScope === "ORGANIZATION") {
      return {
        jobTitleIds: [],
        scope: normalizedScope,
        siteIds: [],
        unitIds: [],
      };
    }

    if (normalizedScope === "UNITS") {
      return {
        jobTitleIds: [],
        scope: normalizedScope,
        siteIds: [],
        unitIds: normalizeIds(targetRule.unitIds),
      };
    }

    if (normalizedScope === "JOB_TITLES") {
      return {
        jobTitleIds: normalizeIds(targetRule.jobTitleIds),
        scope: normalizedScope,
        siteIds: [],
        unitIds: [],
      };
    }

    if (normalizedScope === "SITES") {
      return {
        jobTitleIds: [],
        scope: normalizedScope,
        siteIds: normalizeIds(targetRule.siteIds),
        unitIds: [],
      };
    }

    return {
      jobTitleIds: normalizeIds(targetRule.jobTitleIds),
      scope: "MIXED",
      siteIds: normalizeIds(targetRule.siteIds),
      unitIds: normalizeIds(targetRule.unitIds),
    };
  }

  function normalizeManagementWorkPolicyPayload(payload = {}) {
    const normalizedWorkType = normalizeManagementWorkPolicyEnum(payload.workType, "FIXED");
    const normalizedEmploymentTargetType = normalizeManagementWorkPolicyEmploymentTargetType(payload.employmentTargetType, "FULL_TIME");

    return {
      ...payload,
      employmentTargetType: normalizedEmploymentTargetType,
      targetRule: normalizeManagementWorkPolicyTargetRulePayload(payload.targetRule || {}),
      workType: normalizedWorkType,
    };
  }

  return Object.freeze({
    buildManagementWorkPolicyDayRulesFromFormData,
    createManagementWorkPolicyAutoBreakRange,
    deriveManagementWorkPolicyMaximumRule,
    deriveManagementWorkPolicyStandardRule,
    formatManagementWorkPolicyCurrencyInputValue,
    getManagementWorkPolicyNextDayOfWeek,
    getManagementWorkPolicyPreviousDayOfWeek,
    getManagementWorkPolicyPrimaryWeeklyHolidayDay,
    getManagementWorkPolicyReferenceDayCount,
    getManagementWorkPolicyWorkingDaysFromDayRules,
    normalizeManagementWorkPolicyBoolean,
    normalizeManagementWorkPolicyDayRuleType,
    normalizeManagementWorkPolicyEmploymentTargetType,
    normalizeManagementWorkPolicyEnum,
    normalizeManagementWorkPolicyNumber,
    normalizeManagementWorkPolicyPayload,
    normalizeManagementWorkPolicyTargetRulePayload,
    sortManagementWorkPolicyAutoBreakRanges,
  });
});
