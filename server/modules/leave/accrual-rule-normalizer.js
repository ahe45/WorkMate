const { getCurrentDateKey } = require("../common/date");
const { createHttpError } = require("../common/http-error");
const {
  clampDay,
  getDateParts,
  normalizeAmount,
  normalizeAnnualDateKey,
  normalizeAttendanceRateThreshold,
  normalizeChoice,
  normalizeDateKey,
  normalizeOptionalAmount,
  normalizePositiveInteger,
  normalizeReferenceDailyMinutes,
} = require("./leave-utils");

function normalizeLeaveAccrualRuleSegments(payload = {}, frequency = "YEARLY") {
  const rawSegments = Array.isArray(payload.rules) ? payload.rules : [];

  if (frequency === "IMMEDIATE") {
    const segment = rawSegments[0] || payload;
    const amountDays = normalizeAmount(segment.amountDays);
    const immediateAccrualType = normalizeChoice(segment.immediateAccrualType, ["FIXED", "PRORATED"], "FIXED");
    const effectiveTo = normalizeAnnualDateKey(segment.effectiveTo || "12-31");

    if (!amountDays) {
      throw createHttpError(400, immediateAccrualType === "PRORATED" ? "연간 기준 일수를 입력하세요." : "입사 즉시 발생 일수를 입력하세요.", "LEAVE_RULE_AMOUNT_REQUIRED");
    }

    if (!effectiveTo) {
      throw createHttpError(400, "입사 즉시 휴가의 소멸일시를 MM-DD 형식으로 입력하세요.", "LEAVE_RULE_IMMEDIATE_EXPIRY_REQUIRED");
    }

    const roundingMethod = immediateAccrualType === "PRORATED"
      ? normalizeChoice(segment.roundingMethod, ["FLOOR", "ROUND", "CEIL"], "ROUND")
      : null;
    const roundingIncrement = immediateAccrualType === "PRORATED"
      ? roundingMethod === "ROUND" && [0.25, 0.5, 1].includes(Number(segment.roundingIncrement))
        ? Number(segment.roundingIncrement)
        : 1
      : null;

    return [{
      amountDays,
      annualDay: 1,
      annualMonth: 1,
      basisDateType: "HIRE_DATE",
      effectiveFrom: getCurrentDateKey(),
      effectiveTo,
      expiresAfterMonths: null,
      attendanceAccrualMethod: null,
      attendanceRateThreshold: null,
      immediateAccrualType,
      maxAmountDays: normalizeOptionalAmount(segment.maxAmountDays),
      minAmountDays: normalizeOptionalAmount(segment.minAmountDays) ?? 0,
      monthlyAccrualMethod: null,
      monthlyDay: 1,
      prorationBasis: immediateAccrualType === "PRORATED"
        ? normalizeChoice(segment.prorationBasis, ["FISCAL_YEAR", "HIRE_YEAR"], "FISCAL_YEAR")
        : null,
      prorationUnit: immediateAccrualType === "PRORATED"
        ? normalizeChoice(segment.prorationUnit, ["REMAINING_DAYS", "REMAINING_MONTHS"], "REMAINING_DAYS")
        : null,
      referenceDailyMinutes: null,
      roundingIncrement,
      roundingMethod,
      tenureMonths: null,
      tenureYears: null,
    }];
  }

  if (rawSegments.length === 0) {
    const amountDays = normalizeAmount(payload.amountDays);
    const basisDateType = String(payload.basisDateType || "FISCAL_YEAR").trim().toUpperCase() === "HIRE_DATE" ? "HIRE_DATE" : "FISCAL_YEAR";
    const effectiveFrom = normalizeDateKey(payload.effectiveFrom, getCurrentDateKey());
    const effectiveTo = normalizeDateKey(payload.effectiveTo);
    const expiresAfterMonths = payload.expiresAfterMonths === "" || payload.expiresAfterMonths === null || payload.expiresAfterMonths === undefined
      ? null
      : normalizePositiveInteger(payload.expiresAfterMonths);

    if (!amountDays) {
      throw createHttpError(400, "휴가 발생 일수를 입력하세요.", "LEAVE_RULE_AMOUNT_REQUIRED");
    }

    if (!effectiveFrom) {
      throw createHttpError(400, "규칙 적용 시작일을 입력하세요.", "LEAVE_RULE_EFFECTIVE_FROM_REQUIRED");
    }

    return [{
      amountDays,
      annualDay: clampDay(payload.annualDay, 31),
      annualMonth: clampDay(payload.annualMonth, 12),
      basisDateType,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      expiresAfterMonths,
      attendanceAccrualMethod: null,
      attendanceRateThreshold: null,
      immediateAccrualType: null,
      maxAmountDays: null,
      minAmountDays: null,
      monthlyAccrualMethod: null,
      monthlyDay: clampDay(payload.monthlyDay, 31),
      prorationBasis: null,
      prorationUnit: null,
      referenceDailyMinutes: null,
      roundingIncrement: null,
      roundingMethod: null,
      tenureMonths: null,
      tenureYears: null,
    }];
  }

  return rawSegments.map((segment, index) => {
    const rowNumber = index + 1;
    const amountDays = normalizeAmount(segment.amountDays);

    if (!amountDays) {
      throw createHttpError(400, `${rowNumber}번째 구간의 발생 일수를 입력하세요.`, "LEAVE_RULE_AMOUNT_REQUIRED");
    }

    if (frequency === "MONTHLY") {
      const tenureMonths = normalizePositiveInteger(segment.tenureMonths);
      const expiresAfterMonths = normalizePositiveInteger(segment.expiresAfterMonths);
      const monthlyAccrualMethod = normalizeChoice(segment.monthlyAccrualMethod, ["FIXED", "CONTRACTUAL_HOURS", "ATTENDANCE_RATE"], "FIXED");
      const referenceDailyMinutes = monthlyAccrualMethod === "CONTRACTUAL_HOURS"
        ? normalizeReferenceDailyMinutes(Number(segment.referenceDailyHours || 0) > 0
          ? Number(segment.referenceDailyHours) * 60
          : segment.referenceDailyMinutes)
        : null;
      const attendanceAccrualMethod = monthlyAccrualMethod === "ATTENDANCE_RATE"
        ? normalizeChoice(segment.attendanceAccrualMethod, ["PROPORTIONAL", "FULL_MONTHS"], "PROPORTIONAL")
        : null;
      const attendanceRateThreshold = monthlyAccrualMethod === "ATTENDANCE_RATE"
        ? normalizeAttendanceRateThreshold(segment.attendanceRateThreshold || 80)
        : null;

      if (!tenureMonths) {
        throw createHttpError(400, `${rowNumber}번째 구간의 근속월수를 입력하세요.`, "LEAVE_RULE_TENURE_MONTHS_REQUIRED");
      }

      if (!expiresAfterMonths) {
        throw createHttpError(400, `${rowNumber}번째 구간의 유효 개월 수를 입력하세요.`, "LEAVE_RULE_EXPIRES_AFTER_REQUIRED");
      }

      return {
        amountDays,
        annualDay: 1,
        annualMonth: 1,
        basisDateType: "HIRE_DATE",
        effectiveFrom: getCurrentDateKey(),
        effectiveTo: null,
        expiresAfterMonths,
        attendanceAccrualMethod,
        attendanceRateThreshold,
        immediateAccrualType: null,
        maxAmountDays: null,
        minAmountDays: null,
        monthlyAccrualMethod,
        monthlyDay: 1,
        prorationBasis: null,
        prorationUnit: null,
        referenceDailyMinutes,
        roundingIncrement: null,
        roundingMethod: null,
        tenureMonths,
        tenureYears: null,
      };
    }

    const tenureYears = normalizePositiveInteger(segment.tenureYears);
    const effectiveFrom = normalizeAnnualDateKey(segment.effectiveFrom);
    const effectiveTo = normalizeAnnualDateKey(segment.effectiveTo);

    if (!tenureYears) {
      throw createHttpError(400, `${rowNumber}번째 구간의 근속연수를 입력하세요.`, "LEAVE_RULE_TENURE_YEARS_REQUIRED");
    }

    if (!effectiveFrom || !effectiveTo) {
      throw createHttpError(400, `${rowNumber}번째 구간의 발생일시와 소멸일시를 MM-DD 형식으로 입력하세요.`, "LEAVE_RULE_EFFECTIVE_PERIOD_REQUIRED");
    }

    const fromParts = getDateParts(effectiveFrom);

    return {
      amountDays,
      annualDay: fromParts.day || 1,
      annualMonth: fromParts.month || 1,
      basisDateType: "HIRE_DATE",
      effectiveFrom,
      effectiveTo,
      expiresAfterMonths: null,
      attendanceAccrualMethod: null,
      attendanceRateThreshold: null,
      immediateAccrualType: null,
      maxAmountDays: null,
      minAmountDays: null,
      monthlyAccrualMethod: null,
      monthlyDay: 1,
      prorationBasis: null,
      prorationUnit: null,
      referenceDailyMinutes: null,
      roundingIncrement: null,
      roundingMethod: null,
      tenureMonths: null,
      tenureYears,
    };
  });
}

function buildLeaveAccrualRuleName(name = "", frequency = "YEARLY", segment = {}, segmentCount = 1) {
  if (segmentCount <= 1) {
    return name;
  }

  const suffix = frequency === "MONTHLY"
    ? `근속 ${segment.tenureMonths}개월`
    : `근속 ${segment.tenureYears}년`;

  return `${name} - ${suffix}`;
}

module.exports = {
  buildLeaveAccrualRuleName,
  normalizeLeaveAccrualRuleSegments,
};
