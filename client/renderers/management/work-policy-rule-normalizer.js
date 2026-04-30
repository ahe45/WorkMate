(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyRuleNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkPolicyRuleNormalizer(deps = {}) {
    const {
      DEFAULT_CONTRACTUAL_RULE,
      DEFAULT_MAXIMUM_WORK_RULE,
      DEFAULT_WORKING_DAYS,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyNumber,
      normalizeManagementPolicyStringEnum,
      toArray,
    } = deps;

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

    function normalizeManagementPolicyStandardRule(value = {}, workingDays = DEFAULT_WORKING_DAYS, standardDailyMinutes = 480) {
      const source = value && typeof value === "object" ? value : {};

      return {
        method: normalizeManagementPolicyStringEnum(source.method, ["WORKING_DAYS_TIMES_DAILY_STANDARD", "WEEKLY_FIXED", "MONTHLY_FIXED", "SCHEDULE_TEMPLATE_SUM"], "WORKING_DAYS_TIMES_DAILY_STANDARD"),
        standardMonthlyMinutes: normalizeManagementPolicyMinutes(source.standardMonthlyMinutes, 0, 0, 60000),
        standardWeeklyMinutes: normalizeManagementPolicyMinutes(source.standardWeeklyMinutes, workingDays.length * standardDailyMinutes, 0, 10080),
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

    function getManagementPolicyLegacyHolidayFallback(source = {}) {
      return normalizeManagementPolicyBoolean(source.includeWeekends, false)
        || normalizeManagementPolicyBoolean(source.includePublicHolidays, false)
        || normalizeManagementPolicyBoolean(source.includeSubstituteHolidays, false)
        || normalizeManagementPolicyBoolean(source.includeCustomHolidays, false)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludePublicHolidays, true)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludeSubstituteHolidays, true)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludeCustomHolidays, true);
    }

    function getManagementPolicyLegacyPublicHolidayFallback(source = {}) {
      return normalizeManagementPolicyBoolean(source.includePublicHolidays, false)
        || normalizeManagementPolicyBoolean(source.includeSubstituteHolidays, false)
        || normalizeManagementPolicyBoolean(source.includeCustomHolidays, false)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludePublicHolidays, true)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludeSubstituteHolidays, true)
        || !normalizeManagementPolicyBoolean(source.settlementRule?.excludeCustomHolidays, true);
    }

    function getManagementPolicyReferenceDayCount(unit = "DAY", config = {}, workingDayCount = 5) {
      const normalizedUnit = normalizeManagementPolicyStringEnum(unit, ["DAY", "WEEK", "MONTH"], "DAY");
      const includeHolidays = normalizeManagementPolicyBoolean(config.includeHolidays, false);

      if (normalizedUnit === "DAY") {
        return 1;
      }

      if (normalizedUnit === "WEEK") {
        return includeHolidays ? 7 : Math.max(1, workingDayCount);
      }

      const customPeriodStartDay = normalizeManagementPolicyDayOfMonth(config.customPeriodStartDay, 1);
      const customPeriodEndDay = normalizeManagementPolicyDayOfMonth(config.customPeriodEndDay, 31);
      const customPeriodLength = customPeriodEndDay >= customPeriodStartDay
        ? (customPeriodEndDay - customPeriodStartDay) + 1
        : ((31 - customPeriodStartDay) + 1) + customPeriodEndDay;
      const usesCustomMonthRange = normalizeManagementPolicyStringEnum(config.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], "MONTH") === "CUSTOM"
        || normalizeManagementPolicyStringEnum(config.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], "CALENDAR_MONTH") === "CUSTOM_PERIOD";
      const calendarDays = usesCustomMonthRange
        ? customPeriodLength
        : 30;

      return includeHolidays
        ? calendarDays
        : Math.max(1, Math.round((calendarDays / 7) * Math.max(1, workingDayCount)));
    }

    function getManagementPolicyDerivedStandardRule({
      contractualRule = DEFAULT_CONTRACTUAL_RULE,
      workingDays = DEFAULT_WORKING_DAYS,
      workType = "FIXED",
    } = {}) {
      const workingDayCount = Math.max(1, toArray(workingDays).length || DEFAULT_WORKING_DAYS.length);
      const unit = normalizeManagementPolicyStringEnum(contractualRule.unit, ["DAY", "WEEK", "MONTH"], DEFAULT_CONTRACTUAL_RULE.unit);
      const minutes = normalizeManagementPolicyMinutes(contractualRule.minutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 60000);
      const referenceDayCount = getManagementPolicyReferenceDayCount(unit, contractualRule, workingDayCount);
      const weekReferenceDayCount = getManagementPolicyReferenceDayCount("WEEK", contractualRule, workingDayCount);
      const monthReferenceDayCount = getManagementPolicyReferenceDayCount("MONTH", contractualRule, workingDayCount);
      const standardDailyMinutes = unit === "DAY"
        ? minutes
        : Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
      const standardWeeklyMinutes = unit === "WEEK"
        ? minutes
        : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));
      const standardMonthlyMinutes = unit === "MONTH"
        ? minutes
        : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount));
      const normalizedWorkType = normalizeManagementPolicyStringEnum(workType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], "FIXED");
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

    function getManagementPolicyDerivedMaximumRule({
      maximumWorkRule = DEFAULT_MAXIMUM_WORK_RULE,
      workingDays = DEFAULT_WORKING_DAYS,
      alertOnDailyLimit = true,
      alertOnRestTime = true,
      alertOnWeeklyLimit = true,
    } = {}) {
      const workingDayCount = Math.max(1, toArray(workingDays).length || DEFAULT_WORKING_DAYS.length);
      const unit = normalizeManagementPolicyStringEnum(maximumWorkRule.unit, ["DAY", "WEEK", "MONTH"], DEFAULT_MAXIMUM_WORK_RULE.unit);
      const minutes = normalizeManagementPolicyMinutes(maximumWorkRule.minutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 60000);
      const referenceDayCount = getManagementPolicyReferenceDayCount(unit, maximumWorkRule, workingDayCount);
      const weekReferenceDayCount = getManagementPolicyReferenceDayCount("WEEK", maximumWorkRule, workingDayCount);
      const monthReferenceDayCount = getManagementPolicyReferenceDayCount("MONTH", maximumWorkRule, workingDayCount);
      const dailyMaxMinutes = Math.max(1, Math.round(minutes / Math.max(1, referenceDayCount)));
      const weeklyMaxMinutes = unit === "WEEK"
        ? minutes
        : Math.max(1, Math.round((minutes / Math.max(1, referenceDayCount)) * weekReferenceDayCount));

      return {
        dailyMaxMinutes,
        maximumRule: {
          alertOnDailyLimit: normalizeManagementPolicyBoolean(alertOnDailyLimit, true),
          alertOnRestTime: normalizeManagementPolicyBoolean(alertOnRestTime, true),
          alertOnWeeklyLimit: normalizeManagementPolicyBoolean(alertOnWeeklyLimit, true),
          dailyMaxMinutes,
          monthlyMaxMethod: unit === "MONTH" ? "FIXED" : "WEEKLY_LIMIT_PRORATED",
          monthlyMaxMinutes: unit === "MONTH"
            ? minutes
            : Math.max(0, Math.round((minutes / Math.max(1, referenceDayCount)) * monthReferenceDayCount)),
          weeklyMaxMinutes,
        },
      };
    }

    function normalizeManagementPolicyContractualRule(value = {}, legacy = {}, workingDays = DEFAULT_WORKING_DAYS) {
      const source = value && typeof value === "object" ? value : {};
      const fallbackUnitByMethod = {
        MONTHLY_FIXED: "MONTH",
        SCHEDULE_TEMPLATE_SUM: "DAY",
        WEEKLY_FIXED: "WEEK",
        WORKING_DAYS_TIMES_DAILY_STANDARD: "DAY",
      };
      const standardMethod = normalizeManagementPolicyStringEnum(legacy.standardRule?.method, ["WORKING_DAYS_TIMES_DAILY_STANDARD", "WEEKLY_FIXED", "MONTHLY_FIXED", "SCHEDULE_TEMPLATE_SUM"], "WORKING_DAYS_TIMES_DAILY_STANDARD");
      const fallbackUnit = fallbackUnitByMethod[standardMethod] || DEFAULT_CONTRACTUAL_RULE.unit;
      const fallbackMinutes = fallbackUnit === "MONTH"
        ? normalizeManagementPolicyMinutes(legacy.standardRule?.standardMonthlyMinutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 60000)
        : fallbackUnit === "WEEK"
          ? normalizeManagementPolicyMinutes(legacy.standardRule?.standardWeeklyMinutes, DEFAULT_CONTRACTUAL_RULE.minutes, 1, 10080)
          : normalizeManagementPolicyMinutes(legacy.standardDailyMinutes, 480, 1, 1440);
      const fallbackOvertimeLimitMinutes = fallbackUnit === "MONTH"
        ? normalizeManagementPolicyMinutes(legacy.maximumRule?.monthlyMaxMinutes, 0, 1, 60000)
        : fallbackUnit === "WEEK"
          ? normalizeManagementPolicyMinutes(legacy.maximumRule?.weeklyMaxMinutes, 3120, 1, 10080)
          : normalizeManagementPolicyMinutes(legacy.dailyMaxMinutes, 720, 1, 1440);
      const fallbackMonthBasis = normalizeManagementPolicyStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], legacy.settlementRule?.monthBasis || DEFAULT_CONTRACTUAL_RULE.monthBasis);
      const fallbackPeriodUnit = normalizeManagementPolicyStringEnum(source.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], legacy.settlementRule?.unit || DEFAULT_CONTRACTUAL_RULE.periodUnit);
      const periodUnit = fallbackPeriodUnit === "CUSTOM" || fallbackMonthBasis === "CUSTOM_PERIOD"
        ? "CUSTOM"
        : fallbackPeriodUnit;

      return {
        customPeriodEndDay: normalizeManagementPolicyDayOfMonth(source.customPeriodEndDay, legacy.settlementRule?.customPeriodEndDay || DEFAULT_CONTRACTUAL_RULE.customPeriodEndDay),
        customPeriodStartDay: normalizeManagementPolicyDayOfMonth(source.customPeriodStartDay, legacy.settlementRule?.customPeriodStartDay || DEFAULT_CONTRACTUAL_RULE.customPeriodStartDay),
        includeHolidays: normalizeManagementPolicyBoolean(source.includeHolidays, getManagementPolicyLegacyHolidayFallback(legacy)),
        includePublicHolidays: normalizeManagementPolicyBoolean(source.includePublicHolidays, getManagementPolicyLegacyPublicHolidayFallback(legacy)),
        minutes: normalizeManagementPolicyMinutes(source.minutes, fallbackMinutes, 1, 60000),
        monthBasis: periodUnit === "CUSTOM" ? "CUSTOM_PERIOD" : "CALENDAR_MONTH",
        overtimeLimitMinutes: normalizeManagementPolicyMinutes(source.overtimeLimitMinutes, fallbackOvertimeLimitMinutes, 1, 60000),
        overtimeLimitUnit: normalizeManagementPolicyStringEnum(source.overtimeLimitUnit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
        overtimeMinimumMinutes: normalizeManagementPolicyMinutes(source.overtimeMinimumMinutes, 0, 0, 60000),
        overtimeMinimumUnit: normalizeManagementPolicyStringEnum(source.overtimeMinimumUnit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
        periodCount: periodUnit === "CUSTOM"
          ? 1
          : normalizeManagementPolicyNumber(source.periodCount, DEFAULT_CONTRACTUAL_RULE.periodCount, 1, 365),
        periodUnit,
        unit: normalizeManagementPolicyStringEnum(source.unit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
        weekStartsOn: normalizeManagementPolicyDayOfWeek(source.weekStartsOn, legacy.settlementRule?.weekStartsOn || DEFAULT_CONTRACTUAL_RULE.weekStartsOn),
      };
    }

    function normalizeManagementPolicyMaximumWorkRule(value = {}, legacy = {}, workingDays = DEFAULT_WORKING_DAYS) {
      const source = value && typeof value === "object" ? value : {};
      const fallbackUnit = normalizeManagementPolicyStringEnum(
        legacy.maximumRule?.monthlyMaxMethod === "FIXED" && Number(legacy.maximumRule?.monthlyMaxMinutes || 0) > 0
          ? "MONTH"
          : "WEEK",
        ["DAY", "WEEK", "MONTH"],
        DEFAULT_MAXIMUM_WORK_RULE.unit,
      );
      const fallbackMinutes = fallbackUnit === "MONTH"
        ? normalizeManagementPolicyMinutes(legacy.maximumRule?.monthlyMaxMinutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 60000)
        : fallbackUnit === "DAY"
          ? normalizeManagementPolicyMinutes(legacy.dailyMaxMinutes, 720, 1, 1440)
          : normalizeManagementPolicyMinutes(legacy.maximumRule?.weeklyMaxMinutes, DEFAULT_MAXIMUM_WORK_RULE.minutes, 1, 10080);

      return {
        customPeriodEndDay: normalizeManagementPolicyDayOfMonth(source.customPeriodEndDay, legacy.settlementRule?.customPeriodEndDay || DEFAULT_MAXIMUM_WORK_RULE.customPeriodEndDay),
        customPeriodStartDay: normalizeManagementPolicyDayOfMonth(source.customPeriodStartDay, legacy.settlementRule?.customPeriodStartDay || DEFAULT_MAXIMUM_WORK_RULE.customPeriodStartDay),
        includeHolidays: normalizeManagementPolicyBoolean(source.includeHolidays, getManagementPolicyLegacyHolidayFallback(legacy)),
        minutes: normalizeManagementPolicyMinutes(source.minutes, fallbackMinutes, 1, 60000),
        monthBasis: normalizeManagementPolicyStringEnum(source.monthBasis, ["CALENDAR_MONTH", "CUSTOM_PERIOD"], legacy.settlementRule?.monthBasis || DEFAULT_MAXIMUM_WORK_RULE.monthBasis),
        periodUnit: normalizeManagementPolicyStringEnum(source.periodUnit, ["DAY", "WEEK", "MONTH", "CUSTOM"], legacy.settlementRule?.unit || DEFAULT_MAXIMUM_WORK_RULE.periodUnit),
        unit: normalizeManagementPolicyStringEnum(source.unit, ["DAY", "WEEK", "MONTH"], fallbackUnit),
        weekStartsOn: normalizeManagementPolicyDayOfWeek(source.weekStartsOn, legacy.settlementRule?.weekStartsOn || DEFAULT_MAXIMUM_WORK_RULE.weekStartsOn),
      };
    }

    return Object.freeze({
      getManagementPolicyDerivedMaximumRule,
      getManagementPolicyDerivedStandardRule,
      normalizeManagementPolicyContractualRule,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMaximumWorkRule,
      normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule,
    });
  }

  return Object.freeze({
    create: createWorkPolicyRuleNormalizer,
  });
});
