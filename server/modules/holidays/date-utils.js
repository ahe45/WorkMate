const { createHttpError } = require("../common/http-error");

const DEFAULT_TIMEZONE = "Asia/Seoul";
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;

function normalizeYear(value) {
  const year = Number(value);

  if (!Number.isInteger(year) || year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw createHttpError(400, "조회할 연도가 올바르지 않습니다.", "HOLIDAY_YEAR_INVALID");
  }

  return year;
}

function createUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateKey(dateKey = "") {
  const [year, month, day] = String(dateKey || "").split("-").map((value) => Number(value || 0));
  return createUtcDate(year, month, day);
}

function normalizeDateKeyValue(value = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const rawValue = String(value || "").trim();
  const dateMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);

  return dateMatch ? dateMatch[1] : rawValue;
}

function toDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeHolidayDate(value = "") {
  const dateKey = normalizeDateKeyValue(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw createHttpError(400, "공휴일 날짜 형식이 올바르지 않습니다.", "HOLIDAY_DATE_INVALID");
  }

  normalizeYear(Number(dateKey.slice(0, 4)));
  const parsedDate = parseDateKey(dateKey);

  if (Number.isNaN(parsedDate.getTime()) || toDateKey(parsedDate) !== dateKey) {
    throw createHttpError(400, "공휴일 날짜 형식이 올바르지 않습니다.", "HOLIDAY_DATE_INVALID");
  }

  return dateKey;
}

function addUtcDays(date, amount = 0) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

function getUtcDayDifference(leftDate, rightDate) {
  return Math.round((leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000));
}

function isSaturday(date) {
  return date.getUTCDay() === 6;
}

function isSunday(date) {
  return date.getUTCDay() === 0;
}

function isWeekend(date) {
  return isSaturday(date) || isSunday(date);
}

function getWeekdayLabel(dateKey = "") {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    weekday: "short",
  }).format(parseDateKey(dateKey));
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveRepeatOccurrenceDate(year, month, day) {
  if (day > getDaysInMonth(year, month)) {
    return null;
  }

  return createUtcDate(year, month, day);
}

module.exports = {
  DEFAULT_TIMEZONE,
  normalizeYear,
  createUtcDate,
  parseDateKey,
  normalizeDateKeyValue,
  normalizeHolidayDate,
  toDateKey,
  addUtcDays,
  getUtcDayDifference,
  isSaturday,
  isSunday,
  isWeekend,
  getWeekdayLabel,
  getDaysInMonth,
  resolveRepeatOccurrenceDate,
};
