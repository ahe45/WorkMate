const {
  addUtcDays,
  createUtcDate,
  isSunday,
  isWeekend,
  parseDateKey,
  toDateKey,
} = require("./date-utils");

function buildPublicHolidayDateSet(year, holidayMap) {
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

  return publicHolidayDateSet;
}

function findHolidayBlock(publicHolidayDateSet, startDate, endDate) {
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

function ensureSubstituteBlock(substituteBlockMap, block) {
  const blockKey = `${block.startDateKey}|${block.endDateKey}`;

  if (!substituteBlockMap.has(blockKey)) {
    substituteBlockMap.set(blockKey, {
      endDate: parseDateKey(block.endDateKey),
      names: new Set(),
    });
  }

  return substituteBlockMap.get(blockKey);
}

function groupBaseHolidayEntries(baseEntries = []) {
  return baseEntries.reduce((groupedEntries, entry) => {
    if (!groupedEntries.has(entry.dateRangeKey)) {
      groupedEntries.set(entry.dateRangeKey, []);
    }

    groupedEntries.get(entry.dateRangeKey).push(entry);
    return groupedEntries;
  }, new Map());
}

function buildSubstituteHolidayEntries({
  baseEntries = [],
  buildHolidayEntry,
  holidayKind,
  holidayMap = new Map(),
  year,
}) {
  const publicHolidayDateSet = buildPublicHolidayDateSet(year, holidayMap);
  const weekendEligibleKinds = new Set([
    holidayKind.BUDDHA_BIRTHDAY,
    holidayKind.CHILDREN_DAY,
    holidayKind.CHRISTMAS,
    holidayKind.CONSTITUTION_DAY,
    holidayKind.HANGEUL_DAY,
    holidayKind.INDEPENDENCE_MOVEMENT_DAY,
    holidayKind.LIBERATION_DAY,
    holidayKind.NATIONAL_FOUNDATION_DAY,
  ]);
  const substituteBlockMap = new Map();
  const groupedEntries = groupBaseHolidayEntries(baseEntries);

  baseEntries.forEach((entry) => {
    if (entry.kind === holidayKind.LUNAR_NEW_YEAR || entry.kind === holidayKind.CHUSEOK || entry.kind === holidayKind.LABOR_DAY) {
      return;
    }

    const date = entry.date;
    const overlapsOtherHoliday = (holidayMap.get(entry.dateKey) || []).some((candidate) => candidate.dateRangeKey !== entry.dateRangeKey);
    const qualifiesForWeekendSubstitute = weekendEligibleKinds.has(entry.kind) && isWeekend(date);

    if (!qualifiesForWeekendSubstitute && !overlapsOtherHoliday) {
      return;
    }

    const block = findHolidayBlock(publicHolidayDateSet, date, date);
    ensureSubstituteBlock(substituteBlockMap, block).names.add(entry.name);
  });

  [holidayKind.LUNAR_NEW_YEAR, holidayKind.CHUSEOK].forEach((groupKind) => {
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
      const block = findHolidayBlock(publicHolidayDateSet, startDate, endDate);

      ensureSubstituteBlock(substituteBlockMap, block).names.add(groupKind === holidayKind.LUNAR_NEW_YEAR ? "설날" : "추석");
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
        kind: holidayKind.SUBSTITUTION,
        name: `대체공휴일(${substituteOf.join(" · ")})`,
        substituteOf,
      });

      substituteEntries.push(substituteEntry);
      publicHolidayDateSet.add(substituteEntry.dateKey);
    });

  return substituteEntries;
}

module.exports = {
  buildSubstituteHolidayEntries,
};
