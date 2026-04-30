const { createHttpError } = require("../common/http-error");
const {
  addUtcDays,
  createUtcDate,
  getWeekdayLabel,
  toDateKey,
} = require("./date-utils");
const { buildSubstituteHolidayEntries } = require("./public-holiday-substitution");

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

  const substituteEntries = buildSubstituteHolidayEntries({
    baseEntries,
    buildHolidayEntry,
    holidayKind: HOLIDAY_KIND,
    holidayMap,
    year,
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
  HOLIDAY_KIND,
  getHolidayTypeLabel,
  getHolidayTone,
  getLunarDateParts,
  findLunarDateInGregorianYear,
  buildHolidayEntry,
  mergeHolidayEntries,
  buildBaseHolidayEntries,
  generateKoreanPublicHolidays,
};
