(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyBreakNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      DEFAULT_BREAK_AUTO_RANGE,
      hasMeaningfulManagementPolicyValue,
      normalizeManagementPolicyClockTime,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyStringEnum,
    } = deps;

    function normalizeManagementPolicyBreakAutoRangeEntry(value = {}, fallback = null) {
      const source = value && typeof value === "object" ? value : {};

      return {
        breakMinutes: normalizeManagementPolicyMinutes(
          source.breakMinutes ?? source.autoBreakMinutes,
          fallback?.breakMinutes ?? 0,
          0,
          1440,
        ),
        minimumWorkMinutes: normalizeManagementPolicyMinutes(
          source.minimumWorkMinutes ?? source.autoMinimumWorkMinutes,
          fallback?.minimumWorkMinutes ?? 0,
          0,
          60000,
        ),
      };
    }

    function isValidManagementPolicyBreakAutoRange(range = {}) {
      return normalizeManagementPolicyMinutes(range.minimumWorkMinutes, 0, 0, 60000) > 0
        && normalizeManagementPolicyMinutes(range.breakMinutes, 0, 0, 1440) > 0;
    }

    function sortManagementPolicyBreakAutoRanges(ranges = []) {
      return ranges.slice().sort((left, right) => {
        const leftMinimum = normalizeManagementPolicyMinutes(left.minimumWorkMinutes, 0, 0, 60000);
        const rightMinimum = normalizeManagementPolicyMinutes(right.minimumWorkMinutes, 0, 0, 60000);

        if (leftMinimum !== rightMinimum) {
          return leftMinimum - rightMinimum;
        }

        return normalizeManagementPolicyMinutes(left.breakMinutes, 0, 0, 1440)
          - normalizeManagementPolicyMinutes(right.breakMinutes, 0, 0, 1440);
      });
    }

    function getManagementPolicyBreakAutoRangeSourceEntries(source = {}) {
      if (Array.isArray(source.autoBreakRanges)) {
        return source.autoBreakRanges;
      }

      if (Array.isArray(source.autoRanges)) {
        return source.autoRanges;
      }

      return [];
    }

    function normalizeManagementPolicyBreakAutoRanges(value = [], fallbackRanges = []) {
      const source = Array.isArray(value) ? value : [];
      const normalizedFallbackRanges = sortManagementPolicyBreakAutoRanges(
        (Array.isArray(fallbackRanges) ? fallbackRanges : [])
          .map((range) => normalizeManagementPolicyBreakAutoRangeEntry(range, DEFAULT_BREAK_AUTO_RANGE))
          .filter(isValidManagementPolicyBreakAutoRange),
      );

      return sortManagementPolicyBreakAutoRanges(source.map((entry, index) => {
        const fallbackRange = normalizedFallbackRanges[index]
          || normalizedFallbackRanges[normalizedFallbackRanges.length - 1]
          || null;

        return normalizeManagementPolicyBreakAutoRangeEntry(entry, fallbackRange);
      })).filter((range) => normalizedFallbackRanges.length === 0 || isValidManagementPolicyBreakAutoRange(range));
    }

    function createManagementPolicyBreakRuleFromAutoRanges(autoBreakRanges = [], mode = "AUTO", fixedStartTime = "", fixedEndTime = "") {
      const normalizedAutoBreakRanges = normalizeManagementPolicyBreakAutoRanges(autoBreakRanges, [DEFAULT_BREAK_AUTO_RANGE]);
      const lastAutoBreakRange = normalizedAutoBreakRanges[normalizedAutoBreakRanges.length - 1] || DEFAULT_BREAK_AUTO_RANGE;

      return {
        autoBreakMinutes: lastAutoBreakRange.breakMinutes,
        autoBreakRanges: normalizedAutoBreakRanges,
        autoMinimumWorkMinutes: lastAutoBreakRange.minimumWorkMinutes,
        fixedEndTime,
        fixedStartTime,
        mode,
      };
    }

    function getManagementPolicyLegacyBreakRuleFallback(source = {}) {
      const normalizedMode = normalizeManagementPolicyStringEnum(source.mode, ["AUTO", "FIXED"], "");
      const fixedStartTime = normalizeManagementPolicyClockTime(source.fixedStartTime, "");
      const fixedEndTime = normalizeManagementPolicyClockTime(source.fixedEndTime, "");
      const hasFixedRange = Boolean(fixedStartTime || fixedEndTime);
      const providedAutoBreakRanges = normalizeManagementPolicyBreakAutoRanges(
        getManagementPolicyBreakAutoRangeSourceEntries(source),
        [DEFAULT_BREAK_AUTO_RANGE],
      );
      const hasLegacySingleAutoRange = hasMeaningfulManagementPolicyValue(source.autoMinimumWorkMinutes)
        || hasMeaningfulManagementPolicyValue(source.autoBreakMinutes);

      if (providedAutoBreakRanges.length > 0 || hasLegacySingleAutoRange) {
        const legacyAutoBreakRanges = providedAutoBreakRanges.length > 0
          ? providedAutoBreakRanges
          : normalizeManagementPolicyBreakAutoRanges([source], [DEFAULT_BREAK_AUTO_RANGE]);

        return createManagementPolicyBreakRuleFromAutoRanges(
          legacyAutoBreakRanges,
          normalizedMode || (hasFixedRange ? "FIXED" : "AUTO"),
          fixedStartTime,
          fixedEndTime,
        );
      }

      const standardDailyMinutes = normalizeManagementPolicyMinutes(source.standardDailyMinutes, 0, 0, 1440);

      if (standardDailyMinutes >= 480) {
        return createManagementPolicyBreakRuleFromAutoRanges(
          [{ breakMinutes: 60, minimumWorkMinutes: 480 }],
          normalizedMode || "AUTO",
          fixedStartTime,
          fixedEndTime,
        );
      }

      if (standardDailyMinutes >= 240) {
        return createManagementPolicyBreakRuleFromAutoRanges(
          [{ breakMinutes: 30, minimumWorkMinutes: 240 }],
          normalizedMode || "AUTO",
          fixedStartTime,
          fixedEndTime,
        );
      }

      return createManagementPolicyBreakRuleFromAutoRanges(
        [{ breakMinutes: 30, minimumWorkMinutes: 240 }],
        normalizedMode || "",
        fixedStartTime,
        fixedEndTime,
      );
    }

    function normalizeManagementPolicyBreakRule(value = {}, legacy = {}) {
      const source = value && typeof value === "object" ? value : {};
      const fallbackRule = getManagementPolicyLegacyBreakRuleFallback(legacy);
      const sourceAutoBreakRanges = getManagementPolicyBreakAutoRangeSourceEntries(source);
      const hasLegacySingleAutoRange = hasMeaningfulManagementPolicyValue(source.autoMinimumWorkMinutes)
        || hasMeaningfulManagementPolicyValue(source.autoBreakMinutes);
      const autoBreakRanges = sourceAutoBreakRanges.length > 0
        ? normalizeManagementPolicyBreakAutoRanges(sourceAutoBreakRanges, [])
        : hasLegacySingleAutoRange
          ? normalizeManagementPolicyBreakAutoRanges([source], [])
          : normalizeManagementPolicyBreakAutoRanges(fallbackRule.autoBreakRanges, fallbackRule.autoBreakRanges);
      const lastAutoBreakRange = autoBreakRanges[autoBreakRanges.length - 1]
        || fallbackRule.autoBreakRanges[fallbackRule.autoBreakRanges.length - 1]
        || DEFAULT_BREAK_AUTO_RANGE;

      return {
        autoBreakMinutes: lastAutoBreakRange.breakMinutes,
        autoBreakRanges,
        autoMinimumWorkMinutes: lastAutoBreakRange.minimumWorkMinutes,
        fixedEndTime: normalizeManagementPolicyClockTime(source.fixedEndTime, fallbackRule.fixedEndTime),
        fixedStartTime: normalizeManagementPolicyClockTime(source.fixedStartTime, fallbackRule.fixedStartTime),
        mode: normalizeManagementPolicyStringEnum(source.mode, ["AUTO", "FIXED"], fallbackRule.mode),
      };
    }

    return Object.freeze({
      normalizeManagementPolicyBreakRule,
    });
  }

  return Object.freeze({ create });
});
