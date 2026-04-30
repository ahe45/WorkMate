const { createHttpError } = require("../common/http-error");
const {
  addUtcDays,
  createUtcDate,
  getUtcDayDifference,
  getWeekdayLabel,
  normalizeDateKeyValue,
  parseDateKey,
  resolveRepeatOccurrenceDate,
  toDateKey,
} = require("./date-utils");

const HOLIDAY_SOURCE = Object.freeze({
  CUSTOM: "CUSTOM",
});
const CUSTOM_HOLIDAY_REPEAT_UNIT = Object.freeze({
  MONTH: "MONTH",
  NONE: "NONE",
  WEEK: "WEEK",
  YEAR: "YEAR",
});

function normalizeHolidayName(value = "") {
  const name = String(value || "").trim();

  if (!name) {
    throw createHttpError(400, "공휴일명을 입력하세요.", "HOLIDAY_NAME_REQUIRED");
  }

  return name;
}

function normalizeCustomHolidayRepeatUnit(value = "") {
  const normalizedValue = String(value || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE).trim().toUpperCase() || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE;
  const allowedValues = new Set(Object.values(CUSTOM_HOLIDAY_REPEAT_UNIT));

  if (!allowedValues.has(normalizedValue)) {
    throw createHttpError(400, "반복 주기 값이 올바르지 않습니다.", "HOLIDAY_REPEAT_UNIT_INVALID");
  }

  return normalizedValue;
}

function getCustomHolidayRepeatLabel(repeatUnit = "") {
  switch (normalizeCustomHolidayRepeatUnit(repeatUnit)) {
    case CUSTOM_HOLIDAY_REPEAT_UNIT.YEAR:
      return "매년 반복";
    case CUSTOM_HOLIDAY_REPEAT_UNIT.MONTH:
      return "매월 반복";
    case CUSTOM_HOLIDAY_REPEAT_UNIT.WEEK:
      return "매주 반복";
    default:
      return "";
  }
}

function createCustomHolidayItem(row = {}, occurrenceDateKey = "") {
  const anchorDateKey = normalizeDateKeyValue(row?.holidayDate || row?.date || "");
  const dateKey = normalizeDateKeyValue(occurrenceDateKey || anchorDateKey);
  const repeatUnit = normalizeCustomHolidayRepeatUnit(row?.repeatUnit || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE);

  return {
    anchorDate: anchorDateKey,
    date: dateKey,
    id: String(row?.id || "").trim(),
    isCustom: true,
    isPaidHoliday: Boolean(Number(row?.isPaidHoliday ?? 1)),
    isRecurring: repeatUnit !== CUSTOM_HOLIDAY_REPEAT_UNIT.NONE,
    isSubstitute: false,
    kind: "CUSTOM",
    name: String(row?.name || "").trim() || "지정 공휴일",
    repeatLabel: getCustomHolidayRepeatLabel(repeatUnit),
    repeatUnit,
    substituteOf: [],
    tone: "purple",
    typeLabel: "지정 공휴일",
    weekdayLabel: dateKey ? getWeekdayLabel(dateKey) : "-",
  };
}

function expandCustomHolidayOccurrences(definition = {}, year) {
  const anchorDateKey = normalizeDateKeyValue(definition?.holidayDate || "");
  const repeatUnit = normalizeCustomHolidayRepeatUnit(definition?.repeatUnit || CUSTOM_HOLIDAY_REPEAT_UNIT.NONE);

  if (!anchorDateKey) {
    return [];
  }

  const anchorDate = parseDateKey(anchorDateKey);
  const anchorYear = anchorDate.getUTCFullYear();
  const anchorMonth = anchorDate.getUTCMonth() + 1;
  const anchorDay = anchorDate.getUTCDate();
  const yearStartDate = createUtcDate(year, 1, 1);
  const yearEndDate = createUtcDate(year, 12, 31);

  if (repeatUnit === CUSTOM_HOLIDAY_REPEAT_UNIT.NONE) {
    return anchorYear === year ? [createCustomHolidayItem(definition, anchorDateKey)] : [];
  }

  if (anchorDate.getTime() > yearEndDate.getTime()) {
    return [];
  }

  if (repeatUnit === CUSTOM_HOLIDAY_REPEAT_UNIT.YEAR) {
    if (year < anchorYear) {
      return [];
    }

    const occurrenceDate = resolveRepeatOccurrenceDate(year, anchorMonth, anchorDay);

    if (!occurrenceDate || occurrenceDate.getTime() < anchorDate.getTime()) {
      return [];
    }

    return [createCustomHolidayItem(definition, toDateKey(occurrenceDate))];
  }

  if (repeatUnit === CUSTOM_HOLIDAY_REPEAT_UNIT.MONTH) {
    if (year < anchorYear) {
      return [];
    }

    const items = [];
    const startMonth = year === anchorYear ? anchorMonth : 1;

    for (let month = startMonth; month <= 12; month += 1) {
      const occurrenceDate = resolveRepeatOccurrenceDate(year, month, anchorDay);

      if (!occurrenceDate || occurrenceDate.getTime() < anchorDate.getTime()) {
        continue;
      }

      items.push(createCustomHolidayItem(definition, toDateKey(occurrenceDate)));
    }

    return items;
  }

  if (repeatUnit === CUSTOM_HOLIDAY_REPEAT_UNIT.WEEK) {
    const startDate = anchorDate.getTime() > yearStartDate.getTime() ? anchorDate : yearStartDate;
    const daysFromAnchor = Math.max(0, getUtcDayDifference(startDate, anchorDate));
    const offsetDays = daysFromAnchor % 7 === 0 ? 0 : 7 - (daysFromAnchor % 7);
    const items = [];
    let cursor = addUtcDays(startDate, offsetDays);

    while (cursor.getTime() <= yearEndDate.getTime()) {
      if (cursor.getTime() >= anchorDate.getTime()) {
        items.push(createCustomHolidayItem(definition, toDateKey(cursor)));
      }

      cursor = addUtcDays(cursor, 7);
    }

    return items;
  }

  return [];
}

function buildHolidaySummary(generated = {}, customItems = []) {
  const generatedItems = Array.isArray(generated?.items) ? generated.items : [];
  const customDateKeys = Array.from(new Set(customItems.map((item) => String(item?.date || "").trim()).filter(Boolean)));
  const totalDateKeys = new Set([
    ...generatedItems.map((item) => String(item?.date || "").trim()).filter(Boolean),
    ...customDateKeys,
  ]);

  return {
    customHolidayCount: customDateKeys.length,
    holidayCount: Number(generated?.summary?.holidayCount || 0),
    lunarHolidayCount: Number(generated?.summary?.lunarHolidayCount || 0),
    nationalHolidayCount: Number(generated?.summary?.nationalHolidayCount || 0),
    substituteHolidayCount: Number(generated?.summary?.substituteHolidayCount || 0),
    totalCount: totalDateKeys.size,
  };
}

function mergeHolidayItems(generatedItems = [], customItems = []) {
  return [...generatedItems, ...customItems]
    .slice()
    .sort((left, right) => {
      const dateGap = String(left?.date || "").localeCompare(String(right?.date || ""));

      if (dateGap !== 0) {
        return dateGap;
      }

      const sourceRankGap = (left?.isCustom ? 1 : 0) - (right?.isCustom ? 1 : 0);

      if (sourceRankGap !== 0) {
        return sourceRankGap;
      }

      return String(left?.name || "").localeCompare(String(right?.name || ""), "ko");
    });
}

module.exports = {
  HOLIDAY_SOURCE,
  CUSTOM_HOLIDAY_REPEAT_UNIT,
  normalizeHolidayName,
  normalizeCustomHolidayRepeatUnit,
  getCustomHolidayRepeatLabel,
  createCustomHolidayItem,
  expandCustomHolidayOccurrences,
  buildHolidaySummary,
  mergeHolidayItems,
};
