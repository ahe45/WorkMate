const { createHttpError } = require("../common/http-error");

const DEFAULT_HOLIDAY_CALENDAR_CODE = "KR_PUBLIC";
const DEFAULT_HOLIDAY_CALENDAR_NAME = "대한민국 공휴일";
const DEFAULT_TIMEZONE = "Asia/Seoul";
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;
const HOLIDAY_SOURCE = Object.freeze({
  CUSTOM: "CUSTOM",
  SYSTEM: "SYSTEM",
});
const CUSTOM_HOLIDAY_REPEAT_UNIT = Object.freeze({
  MONTH: "MONTH",
  NONE: "NONE",
  WEEK: "WEEK",
  YEAR: "YEAR",
});

const HOLIDAY_KIND = Object.freeze({
  BUDDHA_BIRTHDAY: "BUDDHA_BIRTHDAY",
  CHILDREN_DAY: "CHILDREN_DAY",
  CHRISTMAS: "CHRISTMAS",
  CONSTITUTION_DAY: "CONSTITUTION_DAY",
  LABOR_DAY: "LABOR_DAY",
  LUNAR_NEW_YEAR: "LUNAR_NEW_YEAR",
  MEMORIAL_DAY: "MEMORIAL_DAY",
  NATIONAL_FOUNDATION_DAY: "NATIONAL_FOUNDATION_DAY",
  NEW_YEAR_DAY: "NEW_YEAR_DAY",
  SUBSTITUTION: "SUBSTITUTION",
  CHUSEOK: "CHUSEOK",
  INDEPENDENCE_MOVEMENT_DAY: "INDEPENDENCE_MOVEMENT_DAY",
  LIBERATION_DAY: "LIBERATION_DAY",
  HANGEUL_DAY: "HANGEUL_DAY",
});

const lunarFormatter = new Intl.DateTimeFormat("en-u-ca-chinese", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric",
});

function normalizeYear(value) {
  const year = Number(value);

  if (!Number.isInteger(year) || year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw createHttpError(400, "조회할 연도가 올바르지 않습니다.", "HOLIDAY_YEAR_INVALID");
  }

  return year;
}

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

function toDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getHolidayTypeLabel(kind = "") {
  switch (kind) {
    case HOLIDAY_KIND.INDEPENDENCE_MOVEMENT_DAY:
    case HOLIDAY_KIND.LIBERATION_DAY:
    case HOLIDAY_KIND.NATIONAL_FOUNDATION_DAY:
    case HOLIDAY_KIND.HANGEUL_DAY:
    case HOLIDAY_KIND.CONSTITUTION_DAY:
      return "국경일";
    case HOLIDAY_KIND.LUNAR_NEW_YEAR:
    case HOLIDAY_KIND.CHUSEOK:
      return "명절";
    case HOLIDAY_KIND.MEMORIAL_DAY:
      return "기념일";
    case HOLIDAY_KIND.SUBSTITUTION:
      return "대체공휴일";
    default:
      return "공휴일";
  }
}

function getHolidayTone(kind = "") {
  switch (kind) {
    case HOLIDAY_KIND.SUBSTITUTION:
      return "orange";
    case HOLIDAY_KIND.LUNAR_NEW_YEAR:
    case HOLIDAY_KIND.CHUSEOK:
      return "green";
    case HOLIDAY_KIND.INDEPENDENCE_MOVEMENT_DAY:
    case HOLIDAY_KIND.LIBERATION_DAY:
    case HOLIDAY_KIND.NATIONAL_FOUNDATION_DAY:
    case HOLIDAY_KIND.HANGEUL_DAY:
    case HOLIDAY_KIND.CONSTITUTION_DAY:
      return "blue";
    case HOLIDAY_KIND.LABOR_DAY:
      return "purple";
    default:
      return "gray";
  }
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

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveRepeatOccurrenceDate(year, month, day) {
  if (day > getDaysInMonth(year, month)) {
    return null;
  }

  return createUtcDate(year, month, day);
}

function getLunarDateParts(date) {
  const parts = lunarFormatter.formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  return {
    day: Number(partMap.get("day") || 0),
    month: Number(partMap.get("month") || 0),
    relatedYear: Number(partMap.get("relatedYear") || partMap.get("year") || 0),
  };
}

function findLunarDateInGregorianYear(year, lunarMonth, lunarDay) {
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = createUtcDate(year, month, day);

      if (date.getUTCMonth() + 1 !== month) {
        break;
      }

      const parts = getLunarDateParts(date);

      if (parts.relatedYear === year && parts.month === lunarMonth && parts.day === lunarDay) {
        return date;
      }
    }
  }

  throw createHttpError(500, "음력 공휴일을 계산하지 못했습니다.", "HOLIDAY_LUNAR_RESOLUTION_FAILED");
}

function buildHolidayEntry(date, {
  dateRangeKey = "",
  kind = "",
  name = "",
  substituteOf = [],
} = {}) {
  const dateKey = toDateKey(date);
  const substituteNames = Array.from(new Set((Array.isArray(substituteOf) ? substituteOf : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)));

  return {
    date,
    dateKey,
    dateRangeKey: String(dateRangeKey || `${kind}:${dateKey}`),
    isPaidHoliday: true,
    isSubstitute: kind === HOLIDAY_KIND.SUBSTITUTION,
    kind,
    name,
    substituteOf: substituteNames,
    tone: getHolidayTone(kind),
    typeLabel: getHolidayTypeLabel(kind),
    weekdayLabel: getWeekdayLabel(dateKey),
  };
}

function mergeHolidayEntries(target, source) {
  const nextNameSet = new Set(String(target?.name || "").split(" · ").map((value) => String(value || "").trim()).filter(Boolean));

  String(source?.name || "").split(" · ").map((value) => String(value || "").trim()).filter(Boolean).forEach((name) => {
    nextNameSet.add(name);
  });

  const substituteOf = new Set([...(target?.substituteOf || []), ...(source?.substituteOf || [])].map((value) => String(value || "").trim()).filter(Boolean));
  const mergedKinds = new Set([String(target?.kind || "").trim(), String(source?.kind || "").trim()].filter(Boolean));
  const isSubstitute = mergedKinds.has(HOLIDAY_KIND.SUBSTITUTION);
  const hasMultipleNames = nextNameSet.size > 1;
  const preferredKind = isSubstitute
    ? HOLIDAY_KIND.SUBSTITUTION
    : mergedKinds.has(HOLIDAY_KIND.LUNAR_NEW_YEAR)
      ? HOLIDAY_KIND.LUNAR_NEW_YEAR
      : mergedKinds.has(HOLIDAY_KIND.CHUSEOK)
        ? HOLIDAY_KIND.CHUSEOK
        : Array.from(mergedKinds)[0] || HOLIDAY_KIND.NEW_YEAR_DAY;

  return {
    ...target,
    isSubstitute,
    kind: preferredKind,
    name: Array.from(nextNameSet).join(" · "),
    substituteOf: Array.from(substituteOf),
    tone: isSubstitute ? getHolidayTone(preferredKind) : hasMultipleNames ? "orange" : getHolidayTone(preferredKind),
    typeLabel: isSubstitute ? "대체공휴일" : hasMultipleNames ? "중복 공휴일" : getHolidayTypeLabel(preferredKind),
  };
}

function buildBaseHolidayEntries(year) {
  const entries = [];
  const nationalDays = [
    {
      day: 1,
      kind: HOLIDAY_KIND.INDEPENDENCE_MOVEMENT_DAY,
      month: 3,
      name: "삼일절",
    },
    {
      day: 15,
      kind: HOLIDAY_KIND.LIBERATION_DAY,
      month: 8,
      name: "광복절",
    },
    {
      day: 3,
      kind: HOLIDAY_KIND.NATIONAL_FOUNDATION_DAY,
      month: 10,
      name: "개천절",
    },
    {
      day: 9,
      kind: HOLIDAY_KIND.HANGEUL_DAY,
      month: 10,
      name: "한글날",
    },
  ];

  if (year >= 2026) {
    nationalDays.push({
      day: 17,
      kind: HOLIDAY_KIND.CONSTITUTION_DAY,
      month: 7,
      name: "제헌절",
    });
  }

  entries.push(
    buildHolidayEntry(createUtcDate(year, 1, 1), {
      kind: HOLIDAY_KIND.NEW_YEAR_DAY,
      name: "신정",
    }),
    buildHolidayEntry(createUtcDate(year, 5, 5), {
      kind: HOLIDAY_KIND.CHILDREN_DAY,
      name: "어린이날",
    }),
    buildHolidayEntry(createUtcDate(year, 6, 6), {
      kind: HOLIDAY_KIND.MEMORIAL_DAY,
      name: "현충일",
    }),
    buildHolidayEntry(createUtcDate(year, 12, 25), {
      kind: HOLIDAY_KIND.CHRISTMAS,
      name: "성탄절",
    }),
  );

  if (year >= 2026) {
    entries.push(
      buildHolidayEntry(createUtcDate(year, 5, 1), {
        kind: HOLIDAY_KIND.LABOR_DAY,
        name: "노동절",
      }),
    );
  }

  nationalDays.forEach((holiday) => {
    entries.push(
      buildHolidayEntry(createUtcDate(year, holiday.month, holiday.day), {
        kind: holiday.kind,
        name: holiday.name,
      }),
    );
  });

  const lunarNewYear = findLunarDateInGregorianYear(year, 1, 1);
  const buddhaBirthday = findLunarDateInGregorianYear(year, 4, 8);
  const chuseok = findLunarDateInGregorianYear(year, 8, 15);
  const seollalRangeKey = `SEOLLAL:${year}`;
  const chuseokRangeKey = `CHUSEOK:${year}`;

  entries.push(
    buildHolidayEntry(addUtcDays(lunarNewYear, -1), {
      dateRangeKey: seollalRangeKey,
      kind: HOLIDAY_KIND.LUNAR_NEW_YEAR,
      name: "설날 연휴",
    }),
    buildHolidayEntry(lunarNewYear, {
      dateRangeKey: seollalRangeKey,
      kind: HOLIDAY_KIND.LUNAR_NEW_YEAR,
      name: "설날",
    }),
    buildHolidayEntry(addUtcDays(lunarNewYear, 1), {
      dateRangeKey: seollalRangeKey,
      kind: HOLIDAY_KIND.LUNAR_NEW_YEAR,
      name: "설날 연휴",
    }),
    buildHolidayEntry(buddhaBirthday, {
      kind: HOLIDAY_KIND.BUDDHA_BIRTHDAY,
      name: "부처님오신날",
    }),
    buildHolidayEntry(addUtcDays(chuseok, -1), {
      dateRangeKey: chuseokRangeKey,
      kind: HOLIDAY_KIND.CHUSEOK,
      name: "추석 연휴",
    }),
    buildHolidayEntry(chuseok, {
      dateRangeKey: chuseokRangeKey,
      kind: HOLIDAY_KIND.CHUSEOK,
      name: "추석",
    }),
    buildHolidayEntry(addUtcDays(chuseok, 1), {
      dateRangeKey: chuseokRangeKey,
      kind: HOLIDAY_KIND.CHUSEOK,
      name: "추석 연휴",
    }),
  );

  return entries
    .filter((entry) => entry.date.getUTCFullYear() === year)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function generateKoreanPublicHolidays(year) {
  const baseEntries = buildBaseHolidayEntries(year);
  const holidayMap = new Map();

  baseEntries.forEach((entry) => {
    if (!holidayMap.has(entry.dateKey)) {
      holidayMap.set(entry.dateKey, []);
    }

    holidayMap.get(entry.dateKey).push(entry);
  });

  const publicHolidayDateSet = new Set(holidayMap.keys());

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = createUtcDate(year, month, day);

      if (date.getUTCMonth() + 1 !== month) {
        break;
      }

      if (isSunday(date)) {
        publicHolidayDateSet.add(toDateKey(date));
      }
    }
  }

  const weekendEligibleKinds = new Set([
    HOLIDAY_KIND.BUDDHA_BIRTHDAY,
    HOLIDAY_KIND.CHILDREN_DAY,
    HOLIDAY_KIND.CHRISTMAS,
    HOLIDAY_KIND.CONSTITUTION_DAY,
    HOLIDAY_KIND.HANGEUL_DAY,
    HOLIDAY_KIND.INDEPENDENCE_MOVEMENT_DAY,
    HOLIDAY_KIND.LIBERATION_DAY,
    HOLIDAY_KIND.NATIONAL_FOUNDATION_DAY,
  ]);

  function findHolidayBlock(startDate, endDate) {
    let blockStart = new Date(startDate.getTime());
    let blockEnd = new Date(endDate.getTime());

    while (publicHolidayDateSet.has(toDateKey(addUtcDays(blockStart, -1)))) {
      blockStart = addUtcDays(blockStart, -1);
    }

    while (publicHolidayDateSet.has(toDateKey(addUtcDays(blockEnd, 1)))) {
      blockEnd = addUtcDays(blockEnd, 1);
    }

    return {
      endDateKey: toDateKey(blockEnd),
      startDateKey: toDateKey(blockStart),
    };
  }

  const substituteBlockMap = new Map();
  const groupedEntries = new Map();

  baseEntries.forEach((entry) => {
    if (!groupedEntries.has(entry.dateRangeKey)) {
      groupedEntries.set(entry.dateRangeKey, []);
    }

    groupedEntries.get(entry.dateRangeKey).push(entry);
  });

  baseEntries.forEach((entry) => {
    if (entry.kind === HOLIDAY_KIND.LUNAR_NEW_YEAR || entry.kind === HOLIDAY_KIND.CHUSEOK || entry.kind === HOLIDAY_KIND.LABOR_DAY) {
      return;
    }

    const date = entry.date;
    const overlapsOtherHoliday = (holidayMap.get(entry.dateKey) || []).some((candidate) => candidate.dateRangeKey !== entry.dateRangeKey);
    const qualifiesForWeekendSubstitute = weekendEligibleKinds.has(entry.kind) && isWeekend(date);

    if (!qualifiesForWeekendSubstitute && !overlapsOtherHoliday) {
      return;
    }

    const block = findHolidayBlock(date, date);
    const blockKey = `${block.startDateKey}|${block.endDateKey}`;

    if (!substituteBlockMap.has(blockKey)) {
      substituteBlockMap.set(blockKey, {
        endDate: parseDateKey(block.endDateKey),
        names: new Set(),
      });
    }

    substituteBlockMap.get(blockKey).names.add(entry.name);
  });

  [HOLIDAY_KIND.LUNAR_NEW_YEAR, HOLIDAY_KIND.CHUSEOK].forEach((groupKind) => {
    const groups = Array.from(groupedEntries.values()).filter((entries) => entries.some((entry) => entry.kind === groupKind));

    groups.forEach((entries) => {
      const dates = entries.map((entry) => entry.date);
      const hasSunday = dates.some((date) => isSunday(date));
      const overlapsOtherHoliday = entries.some((entry) => (holidayMap.get(entry.dateKey) || []).some((candidate) => candidate.dateRangeKey !== entry.dateRangeKey));

      if (!hasSunday && !overlapsOtherHoliday) {
        return;
      }

      const startDate = new Date(Math.min(...dates.map((date) => date.getTime())));
      const endDate = new Date(Math.max(...dates.map((date) => date.getTime())));
      const block = findHolidayBlock(startDate, endDate);
      const blockKey = `${block.startDateKey}|${block.endDateKey}`;

      if (!substituteBlockMap.has(blockKey)) {
        substituteBlockMap.set(blockKey, {
          endDate: parseDateKey(block.endDateKey),
          names: new Set(),
        });
      }

      substituteBlockMap.get(blockKey).names.add(groupKind === HOLIDAY_KIND.LUNAR_NEW_YEAR ? "설날" : "추석");
    });
  });

  const substituteEntries = [];

  Array.from(substituteBlockMap.values())
    .sort((left, right) => left.endDate.getTime() - right.endDate.getTime())
    .forEach((block) => {
      const substituteOf = Array.from(block.names).sort((left, right) => left.localeCompare(right, "ko"));
      let cursor = addUtcDays(block.endDate, 1);

      while (publicHolidayDateSet.has(toDateKey(cursor)) || isWeekend(cursor)) {
        cursor = addUtcDays(cursor, 1);
      }

      const substituteEntry = buildHolidayEntry(cursor, {
        kind: HOLIDAY_KIND.SUBSTITUTION,
        name: `대체공휴일(${substituteOf.join(" · ")})`,
        substituteOf,
      });

      substituteEntries.push(substituteEntry);
      publicHolidayDateSet.add(substituteEntry.dateKey);
    });

  const normalizedEntries = [...baseEntries, ...substituteEntries]
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .reduce((items, entry) => {
      const existing = items.get(entry.dateKey);

      if (!existing) {
        items.set(entry.dateKey, entry);
        return items;
      }

      items.set(entry.dateKey, mergeHolidayEntries(existing, entry));
      return items;
    }, new Map());

  const items = Array.from(normalizedEntries.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((entry) => ({
      date: entry.dateKey,
      id: "",
      isCustom: false,
      isPaidHoliday: entry.isPaidHoliday,
      isSubstitute: entry.isSubstitute,
      kind: entry.kind,
      name: entry.name,
      substituteOf: entry.substituteOf,
      tone: entry.tone,
      typeLabel: entry.typeLabel,
      weekdayLabel: entry.weekdayLabel,
    }));

  const summary = {
    holidayCount: Math.max(0, items.length - items.filter((item) => item.isSubstitute).length),
    lunarHolidayCount: items.filter((item) => [HOLIDAY_KIND.LUNAR_NEW_YEAR, HOLIDAY_KIND.CHUSEOK, HOLIDAY_KIND.BUDDHA_BIRTHDAY].includes(item.kind)).length,
    nationalHolidayCount: items.filter((item) => [
      HOLIDAY_KIND.CONSTITUTION_DAY,
      HOLIDAY_KIND.HANGEUL_DAY,
      HOLIDAY_KIND.INDEPENDENCE_MOVEMENT_DAY,
      HOLIDAY_KIND.LIBERATION_DAY,
      HOLIDAY_KIND.NATIONAL_FOUNDATION_DAY,
    ].includes(item.kind)).length,
    customHolidayCount: 0,
    substituteHolidayCount: items.filter((item) => item.isSubstitute).length,
    totalCount: items.length,
  };
  const notices = [
    `${year}년 기준 반복 법정 공휴일을 자동 동기화합니다.`,
    year >= 2026 ? "2026년 5월 1일부터 노동절을 공휴일로 포함합니다." : "노동절은 2026년 5월 1일부터 공휴일로 포함됩니다.",
    year >= 2026 ? "2026년 5월 11일부터 제헌절을 국경일 공휴일로 포함합니다." : "제헌절은 2026년 5월 11일부터 국경일 공휴일로 포함됩니다.",
    "선거일과 임시공휴일은 별도 정부 지정 일정이어서 자동 생성 대상에서 제외했습니다.",
    "노동절 대체공휴일은 2026년 4월 23일 기준 후속 대통령령 개정이 확정되지 않아 자동 반영하지 않았습니다.",
  ];

  return {
    items,
    notices,
    summary,
    year,
  };
}

module.exports = {
  DEFAULT_HOLIDAY_CALENDAR_CODE,
  DEFAULT_HOLIDAY_CALENDAR_NAME,
  DEFAULT_TIMEZONE,
  HOLIDAY_SOURCE,
  CUSTOM_HOLIDAY_REPEAT_UNIT,
  normalizeYear,
  normalizeHolidayName,
  normalizeCustomHolidayRepeatUnit,
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
  getHolidayTypeLabel,
  getHolidayTone,
  getCustomHolidayRepeatLabel,
  createCustomHolidayItem,
  expandCustomHolidayOccurrences,
  buildHolidaySummary,
  mergeHolidayItems,
  getDaysInMonth,
  resolveRepeatOccurrenceDate,
  getLunarDateParts,
  findLunarDateInGregorianYear,
  buildHolidayEntry,
  mergeHolidayEntries,
  buildBaseHolidayEntries,
  generateKoreanPublicHolidays,
};
