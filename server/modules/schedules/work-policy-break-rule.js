const { createHttpError } = require("../common/http-error");
const {
  DEFAULT_BREAK_AUTO_RANGE,
} = require("./work-policy-defaults");
const {
  hasMeaningfulValue,
  normalizeClockTime,
  normalizeStringEnum,
  parseClockTimeToMinutes,
  sanitizeMinutes,
} = require("./work-policy-value-utils");

function normalizeBreakAutoRangeEntry(value = {}, fallback = null) {
  const source = value && typeof value === "object" ? value : {};

  return {
    breakMinutes: sanitizeMinutes(
      source.breakMinutes ?? source.autoBreakMinutes,
      fallback?.breakMinutes ?? 0,
      0,
      1440,
    ),
    minimumWorkMinutes: sanitizeMinutes(
      source.minimumWorkMinutes ?? source.autoMinimumWorkMinutes,
      fallback?.minimumWorkMinutes ?? 0,
      0,
      60000,
    ),
  };
}

function isValidBreakAutoRange(range = {}) {
  return sanitizeMinutes(range.minimumWorkMinutes, 0, 0, 60000) > 0
    && sanitizeMinutes(range.breakMinutes, 0, 0, 1440) > 0;
}

function sortBreakAutoRanges(ranges = []) {
  return ranges.slice().sort((left, right) => {
    const leftMinimum = sanitizeMinutes(left.minimumWorkMinutes, 0, 0, 60000);
    const rightMinimum = sanitizeMinutes(right.minimumWorkMinutes, 0, 0, 60000);

    if (leftMinimum !== rightMinimum) {
      return leftMinimum - rightMinimum;
    }

    return sanitizeMinutes(left.breakMinutes, 0, 0, 1440)
      - sanitizeMinutes(right.breakMinutes, 0, 0, 1440);
  });
}

function getBreakAutoRangeSourceEntries(source = {}) {
  if (Array.isArray(source.autoBreakRanges)) {
    return source.autoBreakRanges;
  }

  if (Array.isArray(source.autoRanges)) {
    return source.autoRanges;
  }

  return [];
}

function normalizeBreakAutoRanges(value = [], fallbackRanges = []) {
  const source = Array.isArray(value) ? value : [];
  const normalizedFallbackRanges = sortBreakAutoRanges(
    (Array.isArray(fallbackRanges) ? fallbackRanges : [])
      .map((range) => normalizeBreakAutoRangeEntry(range, DEFAULT_BREAK_AUTO_RANGE))
      .filter(isValidBreakAutoRange),
  );

  return sortBreakAutoRanges(source.map((entry, index) => {
    const fallbackRange = normalizedFallbackRanges[index]
      || normalizedFallbackRanges[normalizedFallbackRanges.length - 1]
      || null;

    return normalizeBreakAutoRangeEntry(entry, fallbackRange);
  })).filter((range) => normalizedFallbackRanges.length === 0 || isValidBreakAutoRange(range));
}

function createBreakRuleFromAutoRanges(autoBreakRanges = [], mode = "AUTO", fixedStartTime = "", fixedEndTime = "") {
  const normalizedAutoBreakRanges = normalizeBreakAutoRanges(autoBreakRanges, [DEFAULT_BREAK_AUTO_RANGE]);
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

function getLegacyBreakRuleFallback(source = {}) {
  const normalizedMode = normalizeStringEnum(source.mode, ["AUTO", "FIXED"], "");
  const fixedStartTime = normalizeClockTime(source.fixedStartTime, "");
  const fixedEndTime = normalizeClockTime(source.fixedEndTime, "");
  const hasFixedRange = Boolean(fixedStartTime || fixedEndTime);
  const providedAutoBreakRanges = normalizeBreakAutoRanges(getBreakAutoRangeSourceEntries(source), [DEFAULT_BREAK_AUTO_RANGE]);
  const hasLegacySingleAutoRange = hasMeaningfulValue(source.autoMinimumWorkMinutes) || hasMeaningfulValue(source.autoBreakMinutes);

  if (providedAutoBreakRanges.length > 0 || hasLegacySingleAutoRange) {
    const legacyAutoBreakRanges = providedAutoBreakRanges.length > 0
      ? providedAutoBreakRanges
      : normalizeBreakAutoRanges([source], [DEFAULT_BREAK_AUTO_RANGE]);

    return createBreakRuleFromAutoRanges(
      legacyAutoBreakRanges,
      normalizedMode || (hasFixedRange ? "FIXED" : "AUTO"),
      fixedStartTime,
      fixedEndTime,
    );
  }

  const standardDailyMinutes = sanitizeMinutes(source.standardDailyMinutes, 0, 0, 1440);

  if (standardDailyMinutes >= 480) {
    return createBreakRuleFromAutoRanges([{ breakMinutes: 60, minimumWorkMinutes: 480 }], normalizedMode || "AUTO", fixedStartTime, fixedEndTime);
  }

  if (standardDailyMinutes >= 240) {
    return createBreakRuleFromAutoRanges([{ breakMinutes: 30, minimumWorkMinutes: 240 }], normalizedMode || "AUTO", fixedStartTime, fixedEndTime);
  }

  return createBreakRuleFromAutoRanges([{ breakMinutes: 30, minimumWorkMinutes: 240 }], normalizedMode || "", fixedStartTime, fixedEndTime);
}

function normalizeBreakRule(value = {}, legacy = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallbackRule = getLegacyBreakRuleFallback(legacy);
  const sourceAutoBreakRanges = getBreakAutoRangeSourceEntries(source);
  const hasLegacySingleAutoRange = hasMeaningfulValue(source.autoMinimumWorkMinutes) || hasMeaningfulValue(source.autoBreakMinutes);
  const autoBreakRanges = sourceAutoBreakRanges.length > 0
    ? normalizeBreakAutoRanges(sourceAutoBreakRanges, [])
    : hasLegacySingleAutoRange
      ? normalizeBreakAutoRanges([source], [])
      : normalizeBreakAutoRanges(fallbackRule.autoBreakRanges, fallbackRule.autoBreakRanges);
  const lastAutoBreakRange = autoBreakRanges[autoBreakRanges.length - 1]
    || fallbackRule.autoBreakRanges[fallbackRule.autoBreakRanges.length - 1]
    || DEFAULT_BREAK_AUTO_RANGE;

  return {
    autoBreakMinutes: lastAutoBreakRange.breakMinutes,
    autoBreakRanges,
    autoMinimumWorkMinutes: lastAutoBreakRange.minimumWorkMinutes,
    fixedEndTime: normalizeClockTime(source.fixedEndTime, fallbackRule.fixedEndTime),
    fixedStartTime: normalizeClockTime(source.fixedStartTime, fallbackRule.fixedStartTime),
    mode: normalizeStringEnum(source.mode, ["AUTO", "FIXED"], fallbackRule.mode),
  };
}

function validateBreakRule(breakRule = {}) {
  const mode = normalizeStringEnum(breakRule.mode, ["AUTO", "FIXED"], "");

  if (!mode) {
    throw createHttpError(400, "휴게시간 부여 방식을 선택하세요.", "WORK_POLICY_BREAK_MODE_REQUIRED");
  }

  if (mode === "AUTO") {
    const autoBreakRanges = Array.isArray(breakRule.autoBreakRanges) ? breakRule.autoBreakRanges : [];

    if (autoBreakRanges.length === 0) {
      throw createHttpError(400, "자동 휴게시간 기준 구간을 하나 이상 설정하세요.", "WORK_POLICY_BREAK_AUTO_RANGES_REQUIRED");
    }

    let previousMinimumWorkMinutes = 0;

    autoBreakRanges.forEach((range, index) => {
      const minimumWorkMinutes = sanitizeMinutes(range.minimumWorkMinutes, 0, 0, 60000);
      const breakMinutes = sanitizeMinutes(range.breakMinutes, 0, 0, 1440);

      if (minimumWorkMinutes <= 0) {
        throw createHttpError(400, "자동 휴게시간 근로시간 기준이 올바르지 않습니다.", "WORK_POLICY_BREAK_AUTO_MIN_INVALID");
      }

      if (breakMinutes <= 0) {
        throw createHttpError(400, "자동 휴게시간이 올바르지 않습니다.", "WORK_POLICY_BREAK_AUTO_DURATION_INVALID");
      }

      if (index > 0 && minimumWorkMinutes === previousMinimumWorkMinutes) {
        throw createHttpError(400, "자동 휴게시간 기준 구간의 근로시간 기준은 중복될 수 없습니다.", "WORK_POLICY_BREAK_AUTO_MIN_DUPLICATED");
      }

      previousMinimumWorkMinutes = minimumWorkMinutes;
    });

    if (sanitizeMinutes(breakRule.autoMinimumWorkMinutes, 0, 0, 60000) <= 0) {
      throw createHttpError(400, "자동 휴게시간 근로시간 기준이 올바르지 않습니다.", "WORK_POLICY_BREAK_AUTO_MIN_INVALID");
    }

    if (sanitizeMinutes(breakRule.autoBreakMinutes, 0, 0, 1440) <= 0) {
      throw createHttpError(400, "자동 휴게시간이 올바르지 않습니다.", "WORK_POLICY_BREAK_AUTO_DURATION_INVALID");
    }

    return;
  }

  const fixedStartMinutes = parseClockTimeToMinutes(breakRule.fixedStartTime);
  const fixedEndMinutes = parseClockTimeToMinutes(breakRule.fixedEndTime);

  if (!Number.isFinite(fixedStartMinutes)) {
    throw createHttpError(400, "고정 휴게시간 시작 시각이 올바르지 않습니다.", "WORK_POLICY_BREAK_FIXED_START_INVALID");
  }

  if (!Number.isFinite(fixedEndMinutes)) {
    throw createHttpError(400, "고정 휴게시간 종료 시각이 올바르지 않습니다.", "WORK_POLICY_BREAK_FIXED_END_INVALID");
  }

  if (fixedEndMinutes <= fixedStartMinutes) {
    throw createHttpError(400, "고정 휴게시간 종료 시각은 시작 시각보다 늦어야 합니다.", "WORK_POLICY_BREAK_FIXED_RANGE_INVALID");
  }
}

module.exports = {
  createBreakRuleFromAutoRanges,
  normalizeBreakAutoRanges,
  normalizeBreakRule,
  validateBreakRule,
};
