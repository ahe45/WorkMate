const { getCurrentDateKey } = require("../../server/modules/common/date");

const DEFAULT_COUNT = 50;

function parseArgs(argv = process.argv.slice(2)) {
  let count = DEFAULT_COUNT;
  let organizationCode = "";
  let scheduleFrom = "";
  let scheduleTo = "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "");

    if (token === "--count" && argv[index + 1]) {
      count = Math.max(1, Number(argv[index + 1]) || DEFAULT_COUNT);
      index += 1;
      continue;
    }

    if (token.startsWith("--count=")) {
      count = Math.max(1, Number(token.split("=")[1]) || DEFAULT_COUNT);
      continue;
    }

    if (token === "--organization-code" && argv[index + 1]) {
      organizationCode = String(argv[index + 1] || "").trim().toUpperCase();
      index += 1;
      continue;
    }

    if (token.startsWith("--organization-code=")) {
      organizationCode = String(token.split("=")[1] || "").trim().toUpperCase();
      continue;
    }

    if (token === "--schedule-from" && argv[index + 1]) {
      scheduleFrom = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }

    if (token.startsWith("--schedule-from=")) {
      scheduleFrom = String(token.split("=")[1] || "").trim();
      continue;
    }

    if (token === "--schedule-to" && argv[index + 1]) {
      scheduleTo = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }

    if (token.startsWith("--schedule-to=")) {
      scheduleTo = String(token.split("=")[1] || "").trim();
    }
  }

  return {
    count,
    organizationCode,
    scheduleFrom,
    scheduleTo,
  };
}

function buildTodayContext() {
  const date = getCurrentDateKey();

  return {
    closeTime: `${date} 18:12:00.000`,
    date,
    earlyCloseTime: `${date} 17:32:00.000`,
    holidayEnd: `${date} 00:00:00.000`,
    holidayStart: `${date} 00:00:00.000`,
    lateOfficeStart: `${date} 09:24:00.000`,
    officeEnd: `${date} 18:00:00.000`,
    officeStart: `${date} 09:00:00.000`,
    remoteStart: `${date} 08:55:00.000`,
    returnAt: `${date} 11:20:00.000`,
    submittedAt: `${date} 08:10:00.000`,
    tripEnd: `${date} 19:00:00.000`,
    tripStart: `${date} 10:00:00.000`,
  };
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function parseDateKey(value = "") {
  const text = String(value || "").trim();
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!matched) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${text}`);
  }

  const date = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));

  if (Number.isNaN(date.getTime()) || formatDateKey(date) !== text) {
    throw new Error(`존재하지 않는 날짜입니다: ${text}`);
  }

  return date;
}

function addDateDays(date, offset = 0) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(offset || 0));
  return next;
}

function buildDefaultScheduleRange(todayDate) {
  const cursor = parseDateKey(todayDate);
  const startDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const endDate = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0);

  return {
    dateFrom: formatDateKey(startDate),
    dateTo: formatDateKey(endDate),
  };
}

function resolveScheduleRange(todayDate, scheduleFrom = "", scheduleTo = "") {
  const defaults = buildDefaultScheduleRange(todayDate);
  const dateFrom = scheduleFrom || defaults.dateFrom;
  const dateTo = scheduleTo || defaults.dateTo;

  if (parseDateKey(dateFrom).getTime() > parseDateKey(dateTo).getTime()) {
    throw new Error(`근무일정 생성 범위가 올바르지 않습니다: ${dateFrom} ~ ${dateTo}`);
  }

  return { dateFrom, dateTo };
}

function iterateDateKeys(dateFrom, dateTo) {
  const keys = [];
  const endDate = parseDateKey(dateTo);

  for (let cursor = parseDateKey(dateFrom); cursor.getTime() <= endDate.getTime(); cursor = addDateDays(cursor, 1)) {
    keys.push(formatDateKey(cursor));
  }

  return keys;
}

function toSqlDateTime(dateKey, timeValue) {
  return `${dateKey} ${String(timeValue || "00:00:00").slice(0, 8)}.000`;
}

function normalizeDateKeyValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateKey(value);
  }

  const text = String(value || "").trim();
  return text.includes("T") ? text.slice(0, 10) : text.slice(0, 10);
}

function parseTimeMinutes(timeValue = "00:00:00") {
  const [hours, minutes] = String(timeValue || "00:00:00").slice(0, 5).split(":").map((value) => Number(value || 0));
  return (hours * 60) + minutes;
}

function formatClockTime(minutes = 0) {
  const normalized = ((Math.round(Number(minutes || 0)) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}:00`;
}

function addMinutesToSqlDateTime(dateKey, timeValue, offsetMinutes = 0) {
  const date = parseDateKey(dateKey);
  const totalMinutes = parseTimeMinutes(timeValue) + Number(offsetMinutes || 0);
  date.setDate(date.getDate() + Math.floor(totalMinutes / 1440));

  return toSqlDateTime(formatDateKey(date), formatClockTime(totalMinutes));
}

function getMinutesBetween(startTime = "00:00:00", endTime = "00:00:00") {
  let endMinutes = parseTimeMinutes(endTime);
  const startMinutes = parseTimeMinutes(startTime);

  if (endMinutes < startMinutes) {
    endMinutes += 1440;
  }

  return Math.max(0, endMinutes - startMinutes);
}

function buildDisplayName(index) {
  const familyNames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
  const givenNames = [
    "도윤", "서준", "예준", "하준", "지호",
    "서연", "지우", "하윤", "민서", "채원",
    "지훈", "현우", "시우", "유진", "소율",
    "예린", "주원", "수빈", "다온", "민재",
  ];
  const familyName = familyNames[index % familyNames.length];
  const givenName = givenNames[Math.floor(index / familyNames.length) % givenNames.length];

  return `${familyName}${givenName}`;
}

function buildScenario(index) {
  if (index < 16) {
    return { attendanceState: "WORKING", group: "working", scheduleCode: "DEMO-OFFICE", siteCode: "DEMO-HQ" };
  }

  if (index < 22) {
    return { attendanceState: "OFFSITE", group: "remote", scheduleCode: "DEMO-FIELD", siteCode: "DEMO-FIELD" };
  }

  if (index < 26) {
    return { attendanceState: "WFH_WORKING", group: "remote", scheduleCode: "DEMO-OFFICE", siteCode: "" };
  }

  if (index < 34) {
    return { attendanceState: "CLOCKED_OUT", group: "clocked_out", scheduleCode: "DEMO-BUSINESS", siteCode: "DEMO-BRANCH" };
  }

  if (index < 40) {
    return { attendanceState: "CLOCKED_OUT", group: "clocked_out", scheduleCode: "DEMO-OFFICE", siteCode: "DEMO-HQ" };
  }

  if (index < 44) {
    return { attendanceState: "OFF_DUTY", group: "off_duty", scheduleCode: "DEMO-HOLIDAY", siteCode: "" };
  }

  return {
    attendanceState: "",
    group: "leave",
    leaveTypeCode: index < 48 ? "ANNUAL" : "SICK",
    scheduleCode: "DEMO-OFFICE",
    siteCode: "DEMO-HQ",
  };
}

function buildScheduleRangeScenario(index, dateKey) {
  const date = parseDateKey(dateKey);

  if (date.getDay() === 0 || date.getDay() === 6) {
    return null;
  }

  const rotation = (index + date.getDate() + date.getMonth() + 1) % 12;

  if (rotation < 5) {
    return { breakMinutes: 60, endTime: "18:00:00", scheduleCode: "DEMO-OFFICE", siteCode: "DEMO-HQ", startTime: "09:00:00" };
  }

  if (rotation < 7) {
    return { breakMinutes: 60, endTime: "18:30:00", scheduleCode: "DEMO-FIELD", siteCode: "DEMO-FIELD", startTime: "09:30:00" };
  }

  if (rotation < 9) {
    return { breakMinutes: 60, endTime: "19:00:00", scheduleCode: "DEMO-BUSINESS", siteCode: "DEMO-BRANCH", startTime: "10:00:00" };
  }

  if (rotation === 9) {
    return { breakMinutes: 60, endTime: "17:00:00", scheduleCode: "DEMO-OFFICE", siteCode: "DEMO-HQ", startTime: "08:00:00" };
  }

  if (rotation === 10) {
    return { breakMinutes: 60, endTime: "20:00:00", scheduleCode: "DEMO-OFFICE", siteCode: "DEMO-HQ", startTime: "11:00:00" };
  }

  return { breakMinutes: 60, endTime: "17:30:00", scheduleCode: "DEMO-FIELD", siteCode: "DEMO-FIELD", startTime: "08:30:00" };
}

function buildAttendanceRangeScenario(index, dateKey, scheduleCode = "") {
  const date = parseDateKey(dateKey);
  const seed = (index * 7) + date.getDate() + ((date.getMonth() + 1) * 11);
  const isAbsent = seed % 29 === 0;
  const isLate = !isAbsent && seed % 11 === 0;
  const isEarlyLeave = !isAbsent && seed % 13 === 0;
  const hasOvertime = !isAbsent && (scheduleCode === "DEMO-BUSINESS" || seed % 17 === 0);
  const isReturned = !isAbsent && !isLate && !isEarlyLeave && seed % 19 === 0;

  if (isAbsent) {
    return {
      actualEndOffset: 0,
      actualStartOffset: 0,
      currentState: "OFF_DUTY",
      detailStatus: "ABSENT",
      earlyLeaveMinutes: 0,
      lateMinutes: 0,
      status: "CLOSED",
    };
  }

  return {
    actualEndOffset: hasOvertime ? 24 + (seed % 4) * 8 : isEarlyLeave ? -35 : (seed % 5) - 2,
    actualStartOffset: isLate ? 18 + (seed % 5) : (seed % 7) - 3,
    currentState: "CLOCKED_OUT",
    detailStatus: isLate ? "LATE" : isEarlyLeave ? "EARLY_LEAVE" : isReturned ? "RETURNED" : "CLOCKED_OUT",
    earlyLeaveMinutes: isEarlyLeave ? 35 : 0,
    lateMinutes: isLate ? 18 + (seed % 5) : 0,
    status: "CLOSED",
  };
}

function buildTemplateDayRules(templateCode) {
  if (templateCode === "DEMO-HOLIDAY") {
    return Array.from({ length: 7 }, (_, index) => ({
      breakMinutes: null,
      dayOfWeek: index + 1,
      earlyLeaveGraceMinutes: null,
      endTime: null,
      isWorkingDay: 0,
      lateGraceMinutes: null,
      startTime: null,
    }));
  }

  const startTime = templateCode === "DEMO-BUSINESS" ? "10:00:00" : "09:00:00";
  const endTime = templateCode === "DEMO-BUSINESS" ? "19:00:00" : "18:00:00";

  return Array.from({ length: 7 }, (_, index) => ({
    breakMinutes: index < 5 ? 60 : null,
    dayOfWeek: index + 1,
    earlyLeaveGraceMinutes: index < 5 ? 10 : null,
    endTime: index < 5 ? endTime : null,
    isWorkingDay: index < 5 ? 1 : 0,
    lateGraceMinutes: index < 5 ? 10 : null,
    startTime: index < 5 ? startTime : null,
  }));
}

module.exports = {
  DEFAULT_COUNT,
  addMinutesToSqlDateTime,
  buildAttendanceRangeScenario,
  buildDisplayName,
  buildScenario,
  buildScheduleRangeScenario,
  buildTemplateDayRules,
  buildTodayContext,
  getMinutesBetween,
  iterateDateKeys,
  normalizeDateKeyValue,
  parseArgs,
  resolveScheduleRange,
  toSqlDateTime,
};
