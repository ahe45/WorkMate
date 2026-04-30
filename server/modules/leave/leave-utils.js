function buildLeavePolicyCode(id = "") {
  const suffix = String(id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

  return `LEAVE-${suffix || Date.now()}`;
}

function normalizeDateKey(value = "", fallback = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const rawValue = String(value || "").trim();
  const dateOnly = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";
  const candidate = dateOnly || String(fallback || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return "";
  }

  const [year, month, day] = candidate.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day) {
    return "";
  }

  return candidate;
}

function normalizeMonthDay(value = "") {
  const rawValue = String(value || "").trim();
  const match = rawValue.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(2000, month - 1, day);

  if (Number.isNaN(date.getTime())
    || date.getMonth() !== month - 1
    || date.getDate() !== day) {
    return "";
  }

  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeAnnualDateKey(value = "") {
  const monthDay = normalizeMonthDay(value);

  return monthDay ? `2000-${monthDay}` : "";
}

function clampDay(value = 1, max = 31) {
  return Math.max(1, Math.min(max, Number(value) || 1));
}

function normalizePositiveInteger(value = 0) {
  const numberValue = Math.floor(Number(value || 0));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return numberValue;
}

function normalizeAmount(value = 0) {
  const amount = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return amount;
}

function addMonths(dateKey = "", monthCount = 0) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  const normalizedMonthCount = Number(monthCount || 0);

  if (!normalizedDateKey || !Number.isFinite(normalizedMonthCount) || normalizedMonthCount <= 0) {
    return "";
  }

  const [year, month, day] = normalizedDateKey.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1 + normalizedMonthCount, day);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addCalendarMonths(dateKey = "", monthCount = 0) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  const normalizedMonthCount = Number(monthCount || 0);

  if (!normalizedDateKey || !Number.isFinite(normalizedMonthCount)) {
    return "";
  }

  const [year, month, day] = normalizedDateKey.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1 + normalizedMonthCount, day);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toUtcDate(dateKey = "") {
  const normalizedDateKey = normalizeDateKey(dateKey);

  if (!normalizedDateKey) {
    return null;
  }

  const [year, month, day] = normalizedDateKey.split("-").map((part) => Number(part));

  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(dateKey = "", dayCount = 0) {
  const date = toUtcDate(dateKey);

  if (!date) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + Number(dayCount || 0));

  return formatUtcDate(date);
}

function getDateParts(dateKey = "") {
  const normalizedDateKey = normalizeDateKey(dateKey);

  if (!normalizedDateKey) {
    return {
      day: 0,
      month: 0,
      year: 0,
    };
  }

  const [year, month, day] = normalizedDateKey.split("-").map((part) => Number(part));
  return { day, month, year };
}

function getInclusiveDayCount(dateFrom = "", dateTo = "") {
  const start = toUtcDate(dateFrom);
  const end = toUtcDate(dateTo);

  if (!start || !end || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function getInclusiveMonthCount(dateFrom = "", dateTo = "") {
  const startParts = getDateParts(dateFrom);
  const endParts = getDateParts(dateTo);

  if (!startParts.year || !endParts.year || dateTo < dateFrom) {
    return 0;
  }

  return ((endParts.year - startParts.year) * 12) + (endParts.month - startParts.month) + 1;
}

function getMonthDayKey(dateKey = "") {
  const normalizedDateKey = normalizeDateKey(dateKey);

  return normalizedDateKey ? normalizedDateKey.slice(5, 10) : "";
}

function getCompletedTenureYears(joinDate = "", accrualDate = "") {
  const join = normalizeDateKey(joinDate);
  const accrual = normalizeDateKey(accrualDate);

  if (!join || !accrual || accrual < join) {
    return 0;
  }

  const [joinYear, joinMonth, joinDay] = join.split("-").map((part) => Number(part));
  const [accrualYear, accrualMonth, accrualDay] = accrual.split("-").map((part) => Number(part));
  let years = accrualYear - joinYear;

  if (accrualMonth < joinMonth || (accrualMonth === joinMonth && accrualDay < joinDay)) {
    years -= 1;
  }

  return Math.max(0, years);
}

function buildDateFromMonthDay(year = new Date().getFullYear(), monthDay = "") {
  const normalizedMonthDay = normalizeMonthDay(monthDay);

  if (!normalizedMonthDay) {
    return "";
  }

  return `${year}-${normalizedMonthDay}`;
}

function buildAnnualExpiryDate(accrualDate = "", annualExpiryDate = "") {
  const normalizedAccrualDate = normalizeDateKey(accrualDate);
  const expiryMonthDay = normalizeMonthDay(annualExpiryDate);

  if (!normalizedAccrualDate || !expiryMonthDay) {
    return "";
  }

  const accrualYear = Number(normalizedAccrualDate.slice(0, 4));
  const sameYearExpiryDate = buildDateFromMonthDay(accrualYear, expiryMonthDay);

  if (!sameYearExpiryDate) {
    return "";
  }

  return sameYearExpiryDate >= normalizedAccrualDate
    ? sameYearExpiryDate
    : buildDateFromMonthDay(accrualYear + 1, expiryMonthDay);
}

function getFiscalPeriodForDate(dateKey = "", expiryMonthDay = "12-31") {
  const normalizedDateKey = normalizeDateKey(dateKey);
  const normalizedExpiryMonthDay = normalizeMonthDay(expiryMonthDay) || "12-31";

  if (!normalizedDateKey) {
    return { endDate: "", startDate: "" };
  }

  const endDate = buildAnnualExpiryDate(normalizedDateKey, normalizedExpiryMonthDay);
  const previousEndDate = buildDateFromMonthDay(Number(endDate.slice(0, 4)) - 1, normalizedExpiryMonthDay);

  return {
    endDate,
    startDate: addDays(previousEndDate, 1),
  };
}

function normalizeChoice(value = "", allowedValues = [], fallback = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();

  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeRuleIdList(value = "") {
  const rawValue = String(value || "").trim();
  let decodedValue = rawValue;

  try {
    decodedValue = decodeURIComponent(rawValue);
  } catch (error) {
    decodedValue = rawValue;
  }

  return Array.from(new Set(decodedValue
    .split(",")
    .map((ruleId) => ruleId.trim())
    .filter(Boolean)));
}

function normalizeOptionalAmount(value = null) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const amount = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normalizeReferenceDailyMinutes(value = 480) {
  const minutes = Math.round(Number(value || 0));

  if (!Number.isFinite(minutes)) {
    return 480;
  }

  return Math.max(360, Math.min(600, minutes));
}

function normalizeAttendanceRateThreshold(value = 80) {
  const threshold = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 80;
  }

  return Math.max(1, Math.min(100, threshold));
}

function roundLeaveAmount(value = 0, method = "ROUND", increment = 0.5) {
  const normalizedValue = Number(value || 0);
  const normalizedIncrement = [0.25, 0.5, 1].includes(Number(increment)) ? Number(increment) : 0.5;
  const scaled = normalizedValue / normalizedIncrement;
  const normalizedMethod = normalizeChoice(method, ["FLOOR", "ROUND", "CEIL"], "ROUND");
  const rounded = normalizedMethod === "FLOOR"
    ? Math.floor(scaled)
    : normalizedMethod === "CEIL"
      ? Math.ceil(scaled)
      : Math.round(scaled);

  return Math.max(0, Math.round((rounded * normalizedIncrement + Number.EPSILON) * 100) / 100);
}

function calculateProratedImmediateAmount(rule = {}, user = {}, accrualDate = "") {
  const annualBaseDays = normalizeAmount(rule.amountDays);
  const basis = normalizeChoice(rule.prorationBasis, ["FISCAL_YEAR", "HIRE_YEAR"], "FISCAL_YEAR");
  const unit = normalizeChoice(rule.prorationUnit, ["REMAINING_DAYS", "REMAINING_MONTHS"], "REMAINING_DAYS");
  const roundingMethod = normalizeChoice(rule.roundingMethod, ["FLOOR", "ROUND", "CEIL"], "ROUND");
  const roundingIncrement = Number(rule.roundingIncrement || 0.5);
  const minAmountDays = normalizeOptionalAmount(rule.minAmountDays);
  const maxAmountDays = normalizeOptionalAmount(rule.maxAmountDays);
  const period = basis === "HIRE_YEAR"
    ? {
      endDate: addDays(addMonths(user.joinDate, 12), -1),
      startDate: normalizeDateKey(user.joinDate),
    }
    : getFiscalPeriodForDate(accrualDate, rule.effectiveTo || "2000-12-31");
  const totalUnits = unit === "REMAINING_MONTHS"
    ? getInclusiveMonthCount(period.startDate, period.endDate)
    : getInclusiveDayCount(period.startDate, period.endDate);
  const remainingUnits = unit === "REMAINING_MONTHS"
    ? getInclusiveMonthCount(accrualDate, period.endDate)
    : getInclusiveDayCount(accrualDate, period.endDate);
  const rawAmount = totalUnits > 0 ? annualBaseDays * (remainingUnits / totalUnits) : 0;
  let amountDays = roundLeaveAmount(rawAmount, roundingMethod, roundingIncrement);

  if (minAmountDays !== null) {
    amountDays = Math.max(amountDays, minAmountDays);
  }

  if (maxAmountDays !== null) {
    amountDays = Math.min(amountDays, maxAmountDays);
  }

  return {
    amountDays: normalizeAmount(amountDays),
    expiresAt: period.endDate,
  };
}

module.exports = {
  addCalendarMonths,
  addDays,
  addMonths,
  buildAnnualExpiryDate,
  buildDateFromMonthDay,
  buildLeavePolicyCode,
  calculateProratedImmediateAmount,
  clampDay,
  formatUtcDate,
  getCompletedTenureYears,
  getDateParts,
  getFiscalPeriodForDate,
  getInclusiveDayCount,
  getInclusiveMonthCount,
  getMonthDayKey,
  normalizeAmount,
  normalizeAnnualDateKey,
  normalizeAttendanceRateThreshold,
  normalizeChoice,
  normalizeDateKey,
  normalizeMonthDay,
  normalizeOptionalAmount,
  normalizePositiveInteger,
  normalizeReferenceDailyMinutes,
  normalizeRuleIdList,
  roundLeaveAmount,
  toUtcDate,
};
