(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyDayRuleNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MANAGEMENT_POLICY_DAY_RULE_ORDER = Object.freeze([7, 1, 2, 3, 4, 5, 6]);

  function create(deps = {}) {
    const {
      DEFAULT_WORKING_DAYS,
      normalizeManagementPolicyStringEnum,
      toArray,
    } = deps;

    if (
      !Array.isArray(DEFAULT_WORKING_DAYS)
      || typeof normalizeManagementPolicyStringEnum !== "function"
      || typeof toArray !== "function"
    ) {
      throw new Error("WorkMateWorkPolicyDayRuleNormalizer requires day rule dependencies.");
    }

    function normalizeManagementPolicyWorkingDays(value, fallback = DEFAULT_WORKING_DAYS) {
      const source = Array.isArray(value)
        ? value
        : String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const days = Array.from(new Set(source
        .map((entry) => Number(entry))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)))
        .sort((left, right) => left - right);

      return days.length > 0 ? days : fallback.slice();
    }

    function normalizeManagementPolicyDayRuleType(value = "", fallback = "UNPAID_OFF") {
      return normalizeManagementPolicyStringEnum(value, ["WORK", "UNPAID_OFF", "PAID_HOLIDAY"], fallback);
    }

    function normalizeManagementPolicyDayOfWeek(value, fallback = 1) {
      const numericValue = Number(value);

      return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7 ? numericValue : fallback;
    }

    function buildManagementPolicyLegacyDayRules(workingDays = DEFAULT_WORKING_DAYS, weeklyHolidayDay = 7) {
      const workingDaySet = new Set(normalizeManagementPolicyWorkingDays(workingDays, DEFAULT_WORKING_DAYS));
      const paidHolidayDay = normalizeManagementPolicyDayOfWeek(weeklyHolidayDay, 7);

      return MANAGEMENT_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => ({
        dayOfWeek,
        type: workingDaySet.has(dayOfWeek)
          ? "WORK"
          : dayOfWeek === paidHolidayDay
            ? "PAID_HOLIDAY"
            : "UNPAID_OFF",
      }));
    }

    function normalizeManagementPolicyDayRules(value = [], legacy = {}) {
      const fallbackRules = buildManagementPolicyLegacyDayRules(legacy.workingDays, legacy.weeklyHolidayDay);
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
        const dayOfWeek = normalizeManagementPolicyDayOfWeek(entry?.dayOfWeek, 0);

        if (!dayOfWeek) {
          return;
        }

        dayRuleMap.set(dayOfWeek, normalizeManagementPolicyDayRuleType(entry?.type, dayRuleMap.get(dayOfWeek) || "UNPAID_OFF"));
      });

      return MANAGEMENT_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => ({
        dayOfWeek,
        type: dayRuleMap.get(dayOfWeek) || "UNPAID_OFF",
      }));
    }

    function getManagementPolicyWorkingDaysFromDayRules(dayRules = [], fallback = DEFAULT_WORKING_DAYS) {
      const workDays = toArray(dayRules)
        .filter((rule) => normalizeManagementPolicyDayRuleType(rule?.type, "UNPAID_OFF") === "WORK")
        .map((rule) => normalizeManagementPolicyDayOfWeek(rule?.dayOfWeek, 0))
        .filter(Boolean);

      return normalizeManagementPolicyWorkingDays(workDays, fallback);
    }

    function getManagementPolicyPrimaryWeeklyHolidayDay(dayRules = [], fallback = 7) {
      const paidHolidayRule = normalizeManagementPolicyDayRules(dayRules, {
        weeklyHolidayDay: fallback,
        workingDays: DEFAULT_WORKING_DAYS,
      }).find((rule) => rule.type === "PAID_HOLIDAY");

      return normalizeManagementPolicyDayOfWeek(paidHolidayRule?.dayOfWeek, fallback);
    }

    return Object.freeze({
      getManagementPolicyPrimaryWeeklyHolidayDay,
      getManagementPolicyWorkingDaysFromDayRules,
      normalizeManagementPolicyDayOfWeek,
      normalizeManagementPolicyDayRules,
      normalizeManagementPolicyWorkingDays,
    });
  }

  return Object.freeze({
    create,
  });
});
