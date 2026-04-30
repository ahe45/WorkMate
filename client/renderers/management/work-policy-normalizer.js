(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const valueNormalizerModule = globalThis.WorkMateWorkPolicyValueNormalizer
    || (typeof require === "function" ? require("./work-policy-value-normalizer.js") : null);
  const breakNormalizerModule = globalThis.WorkMateWorkPolicyBreakNormalizer
    || (typeof require === "function" ? require("./work-policy-break-normalizer.js") : null);
  const dayRuleNormalizerModule = globalThis.WorkMateWorkPolicyDayRuleNormalizer
    || (typeof require === "function" ? require("./work-policy-day-rule-normalizer.js") : null);
  const ruleNormalizerModule = globalThis.WorkMateWorkPolicyRuleNormalizer
    || (typeof require === "function" ? require("./work-policy-rule-normalizer.js") : null);

  function createWorkPolicyNormalizer(deps = {}) {
    const {
      toArray,
    } = deps;

    const DEFAULT_WORKING_DAYS = Object.freeze([1, 2, 3, 4, 5]);
    const DEFAULT_CONTRACTUAL_RULE = Object.freeze({
      customPeriodEndDay: 31,
      customPeriodStartDay: 1,
      includeHolidays: false,
      includePublicHolidays: false,
      minutes: 2400,
      monthBasis: "CALENDAR_MONTH",
      overtimeLimitMinutes: 720,
      overtimeLimitUnit: "WEEK",
      overtimeMinimumMinutes: 0,
      overtimeMinimumUnit: "WEEK",
      periodCount: 1,
      periodUnit: "MONTH",
      unit: "WEEK",
      weekStartsOn: 1,
    });
    const DEFAULT_MAXIMUM_WORK_RULE = Object.freeze({
      customPeriodEndDay: 31,
      customPeriodStartDay: 1,
      includeHolidays: false,
      minutes: 3120,
      monthBasis: "CALENDAR_MONTH",
      periodUnit: "MONTH",
      unit: "WEEK",
      weekStartsOn: 1,
    });
    const DEFAULT_BREAK_AUTO_RANGE = Object.freeze({
      breakMinutes: 60,
      minimumWorkMinutes: 480,
    });
    const DEFAULT_EMPLOYMENT_TARGET_TYPE = "FULL_TIME";

    if (!valueNormalizerModule || typeof valueNormalizerModule.parseManagementPolicyJson !== "function") {
      throw new Error("client/renderers/management/work-policy-value-normalizer.js must be loaded before client/renderers/management/work-policy-normalizer.js.");
    }

    if (!breakNormalizerModule || typeof breakNormalizerModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-break-normalizer.js must be loaded before client/renderers/management/work-policy-normalizer.js.");
    }

    if (!dayRuleNormalizerModule || typeof dayRuleNormalizerModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-day-rule-normalizer.js must be loaded before client/renderers/management/work-policy-normalizer.js.");
    }

    if (!ruleNormalizerModule || typeof ruleNormalizerModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-rule-normalizer.js must be loaded before client/renderers/management/work-policy-normalizer.js.");
    }

    const {
      hasMeaningfulManagementPolicyValue,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyClockTime,
      normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyNumber,
      normalizeManagementPolicyStringEnum,
      normalizeManagementPolicyStringList,
      parseManagementPolicyJson,
    } = valueNormalizerModule;

    const dayRuleNormalizer = dayRuleNormalizerModule.create({
      DEFAULT_WORKING_DAYS,
      normalizeManagementPolicyStringEnum,
      toArray,
    });
    const {
      getManagementPolicyPrimaryWeeklyHolidayDay,
      getManagementPolicyWorkingDaysFromDayRules,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyWorkingDays,
    } = dayRuleNormalizer;

    const {
      normalizeManagementPolicyBreakRule,
    } = breakNormalizerModule.create({
      DEFAULT_BREAK_AUTO_RANGE,
      hasMeaningfulManagementPolicyValue,
      normalizeManagementPolicyClockTime,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyStringEnum,
    });

    const {
      getManagementPolicyDerivedMaximumRule,
      getManagementPolicyDerivedStandardRule,
      normalizeManagementPolicyContractualRule,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMaximumWorkRule,
      normalizeManagementPolicySettlementRule,
      normalizeManagementPolicyStandardRule,
    } = ruleNormalizerModule.create({
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
    });

    function normalizeManagementPolicyTargetRule(value = {}) {
      const source = value && typeof value === "object" ? value : {};

      return {
        jobTitleIds: normalizeManagementPolicyStringList(source.jobTitleIds),
        scope: normalizeManagementPolicyStringEnum(source.scope, ["ORGANIZATION", "UNITS", "JOB_TITLES", "SITES", "MIXED"], "ORGANIZATION"),
        siteIds: normalizeManagementPolicyStringList(source.siteIds),
        unitIds: normalizeManagementPolicyStringList(source.unitIds),
      };
    }

    function normalizeManagementPolicyEmploymentTargetType(value = "", fallback = DEFAULT_EMPLOYMENT_TARGET_TYPE) {
      return normalizeManagementPolicyStringEnum(value, ["FULL_TIME", "PART_TIME"], fallback);
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
      const dayRules = normalizeManagementPolicyDayRules(stored.dayRules, stored);
      const workingDays = getManagementPolicyWorkingDaysFromDayRules(dayRules, DEFAULT_WORKING_DAYS);
      const workType = normalizeManagementPolicyStringEnum(stored.workType || policy?.trackType, ["FIXED", "SELECTIVE", "FLEXIBLE", "SCHEDULE_BASED", "DEEMED", "DISCRETIONARY"], "FIXED");
      const targetRule = normalizeManagementPolicyTargetRule(stored.targetRule);
      const contractualRule = normalizeManagementPolicyContractualRule(stored.contractualRule, stored, workingDays);
      const alertSource = normalizeManagementPolicyMaximumRule(stored.maximumRule, 720);
      const breakRule = normalizeManagementPolicyBreakRule(stored.breakRule, stored);
      const maximumWorkRule = normalizeManagementPolicyMaximumWorkRule(stored.maximumWorkRule, stored, workingDays);
      const derivedStandard = getManagementPolicyDerivedStandardRule({
        contractualRule,
        workingDays,
        workType,
      });
      const derivedMaximum = getManagementPolicyDerivedMaximumRule({
        alertOnDailyLimit: alertSource.alertOnDailyLimit,
        alertOnRestTime: alertSource.alertOnRestTime,
        alertOnWeeklyLimit: alertSource.alertOnWeeklyLimit,
        maximumWorkRule,
        workingDays,
      });
      const includeHolidays = normalizeManagementPolicyBoolean(contractualRule.includeHolidays, false);
      const includePublicHolidays = normalizeManagementPolicyBoolean(contractualRule.includePublicHolidays, false);
      const employmentTargetType = normalizeManagementPolicyEmploymentTargetType(
        stored.employmentTargetType,
        Number(stored.hourlyWage || 0) > 0 ? "PART_TIME" : DEFAULT_EMPLOYMENT_TARGET_TYPE,
      );
      const settlementRule = {
        customPeriodEndDay: contractualRule.customPeriodEndDay,
        customPeriodStartDay: contractualRule.customPeriodStartDay,
        excludeCustomHolidays: !includePublicHolidays,
        excludePublicHolidays: !includePublicHolidays,
        excludeSubstituteHolidays: !includePublicHolidays,
        monthBasis: contractualRule.monthBasis,
        unit: contractualRule.periodUnit,
        weekStartsOn: contractualRule.weekStartsOn,
      };

      return {
        breakRule,
        contractualRule,
        dayRules,
        dailyMaxMinutes: derivedMaximum.dailyMaxMinutes,
        employmentTargetType,
        hourlyWage: employmentTargetType === "PART_TIME"
          ? normalizeManagementPolicyNumber(stored.hourlyWage, 0, 0, 1000000000)
          : 0,
        includeCustomHolidays: includePublicHolidays,
        includePublicHolidays,
        includeSubstituteHolidays: includePublicHolidays,
        includeWeekends: includeHolidays,
        maximumRule: derivedMaximum.maximumRule,
        maximumWorkRule,
        policyName: String(stored.policyName || policy?.name || "기본 근로정보").trim(),
        settlementRule,
        standardDailyMinutes: derivedStandard.standardDailyMinutes,
        standardRule: normalizeManagementPolicyStandardRule(derivedStandard.standardRule, workingDays, derivedStandard.standardDailyMinutes),
        targetRule,
        weeklyHolidayDay: getManagementPolicyPrimaryWeeklyHolidayDay(dayRules, normalizeManagementPolicyDayOfWeek(stored.weeklyHolidayDay, 7)),
        workType,
        workingDays,
      };
    }

    return Object.freeze({
      buildManagementWorkPolicyHolidayDateRules,
      getManagementPolicyDerivedMaximumRule,
      getManagementPolicyPrimaryWeeklyHolidayDay,
      getManagementPolicyDerivedStandardRule,
      getManagementPolicyWorkingDaysFromDayRules,
      getManagementWorkPolicyInformation,
      normalizeManagementPolicyBoolean,
      normalizeManagementPolicyBreakRule,
      normalizeManagementPolicyContractualRule,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyDayOfMonth,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyHolidayDateRules,
      normalizeManagementPolicyMaximumRule,
      normalizeManagementPolicyMaximumWorkRule,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyNumber,
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
