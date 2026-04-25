const mysql = require("mysql2/promise");

const { getDbConfig } = require("../db");
const { getCurrentDateKey } = require("../server/modules/common/date");
const { hashPassword } = require("../server/modules/auth/passwords");
const { generateId } = require("../server/modules/common/ids");
const { SYSTEM_ROLE_CODES, ensureSystemRoles, requireSystemRoleId } = require("../server/modules/common/system-roles");
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

function buildJobTitle(index) {
  const titles = ["사원", "주임", "대리", "과장", "차장"];
  return titles[Math.floor(index / 10) % titles.length];
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

async function getTargetOrganization(connection, organizationCode = "") {
  const params = [];
  let sql = `
    SELECT id, code, name
    FROM organizations
    WHERE deleted_at IS NULL
      AND code <> 'WORKMATE_PLATFORM'
  `;

  if (organizationCode) {
    sql += " AND code = ?";
    params.push(organizationCode);
  }

  sql += " ORDER BY created_at DESC LIMIT 1";
  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
}

async function getDefaultWorkPolicy(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, code, name
      FROM work_policies
      WHERE organization_id = ?
        AND deleted_at IS NULL
      ORDER BY is_default DESC, created_at
      LIMIT 1
    `,
    [organizationId],
  );

  return rows[0] || null;
}

async function ensureRootUnit(connection, organizationId) {
  const [rows] = await connection.query(
    `
      SELECT id, code, name, path
      FROM units
      WHERE organization_id = ?
        AND deleted_at IS NULL
      ORDER BY CASE WHEN parent_unit_id IS NULL THEN 0 ELSE 1 END, sort_order, created_at
      LIMIT 1
    `,
    [organizationId],
  );

  if (rows[0]) {
    return rows[0];
  }

  const unitId = generateId();
  await connection.query(
    `
      INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
      VALUES (?, ?, NULL, 'ROOT', '기본 조직', 'DEPARTMENT', 'ACTIVE', 1, '/ROOT')
    `,
    [unitId, organizationId],
  );

  return {
    code: "ROOT",
    id: unitId,
    name: "기본 조직",
    path: "/ROOT",
  };
}

async function ensureUnits(connection, organizationId, rootUnit) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name, path
      FROM units
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const unitMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const unitDefinitions = [
    { code: "SALES", name: "영업팀", sortOrder: 2 },
    { code: "OPS", name: "운영팀", sortOrder: 3 },
    { code: "FIN", name: "재무팀", sortOrder: 4 },
    { code: "HR", name: "인사팀", sortOrder: 5 },
    { code: "ENG", name: "개발팀", sortOrder: 6 },
  ];

  for (const definition of unitDefinitions) {
    if (unitMap.has(definition.code)) {
      continue;
    }

    const unitId = generateId();
    const path = `${String(rootUnit.path || "/ROOT").replace(/\/$/, "")}/${definition.code}`;
    await connection.query(
      `
        INSERT INTO units (id, organization_id, parent_unit_id, code, name, unit_type, status, sort_order, path)
        VALUES (?, ?, ?, ?, ?, 'TEAM', 'ACTIVE', ?, ?)
      `,
      [unitId, organizationId, rootUnit.id, definition.code, definition.name, definition.sortOrder, path],
    );
    unitMap.set(definition.code, { ...definition, id: unitId, path });
  }

  return unitDefinitions.map((definition) => unitMap.get(definition.code));
}

async function ensureSites(connection, organizationId, primaryUnitId) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM sites
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const siteMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const siteDefinitions = [
    {
      addressLine1: "서울시 강남구 테헤란로 100",
      code: "DEMO-HQ",
      geofenceRadiusMeters: 220,
      lat: 37.4981,
      lng: 127.0276,
      name: "데모 본사",
      postalCode: "06100",
    },
    {
      addressLine1: "서울시 영등포구 국제금융로 10",
      code: "DEMO-BRANCH",
      geofenceRadiusMeters: 180,
      lat: 37.5252,
      lng: 126.9252,
      name: "데모 사업장",
      postalCode: "07326",
    },
    {
      addressLine1: "경기도 성남시 분당구 판교역로 166",
      code: "DEMO-FIELD",
      geofenceRadiusMeters: 260,
      lat: 37.3947,
      lng: 127.1112,
      name: "데모 외근 거점",
      postalCode: "13494",
    },
  ];

  for (const definition of siteDefinitions) {
    if (siteMap.has(definition.code)) {
      continue;
    }

    const siteId = generateId();
    await connection.query(
      `
        INSERT INTO sites (
          id, organization_id, primary_unit_id, code, name, status, timezone, country_code, address_line1,
          postal_code, lat, lng, geofence_radius_meters, map_metadata_json
        )
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'Asia/Seoul', 'KR', ?, ?, ?, ?, ?, JSON_OBJECT('source', 'demo-workforce'))
      `,
      [
        siteId,
        organizationId,
        primaryUnitId,
        definition.code,
        definition.name,
        definition.addressLine1,
        definition.postalCode,
        definition.lat,
        definition.lng,
        definition.geofenceRadiusMeters,
      ],
    );
    siteMap.set(definition.code, { ...definition, id: siteId });
  }

  return Object.fromEntries(siteDefinitions.map((definition) => [definition.code, siteMap.get(definition.code)]));
}

async function ensureLeaveTypes(connection, organizationId) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM leave_types
      WHERE organization_id = ?
    `,
    [organizationId],
  );
  const leaveTypeMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const leaveTypeDefinitions = [
    { code: "ANNUAL", name: "연차휴가" },
    { code: "COMP", name: "보상휴가" },
    { code: "OTHER", name: "기타휴가" },
    { code: "SICK", name: "병가" },
  ];

  for (const definition of leaveTypeDefinitions) {
    const existing = leaveTypeMap.get(definition.code);

    if (existing) {
      if (existing.name !== definition.name) {
        await connection.query(
          `
            UPDATE leave_types
            SET name = ?
            WHERE id = ?
          `,
          [definition.name, existing.id],
        );
        existing.name = definition.name;
      }

      continue;
    }

    const leaveTypeId = generateId();
      await connection.query(
        `
          INSERT INTO leave_types (
          id, organization_id, code, name, unit_type, status
        )
        VALUES (?, ?, ?, ?, 'DAY', 'ACTIVE')
      `,
      [leaveTypeId, organizationId, definition.code, definition.name],
    );
    leaveTypeMap.set(definition.code, { ...definition, id: leaveTypeId });
  }

  return Object.fromEntries(leaveTypeDefinitions.map((definition) => [definition.code, leaveTypeMap.get(definition.code)]));
}

async function ensureScheduleTemplates(connection, organizationId, workPolicyId, siteMap) {
  const [existingRows] = await connection.query(
    `
      SELECT id, code, name
      FROM schedule_templates
      WHERE organization_id = ?
        AND deleted_at IS NULL
    `,
    [organizationId],
  );
  const templateMap = new Map(existingRows.map((row) => [String(row.code || "").toUpperCase(), row]));
  const templateDefinitions = [
    { code: "DEMO-OFFICE", defaultSiteId: siteMap["DEMO-HQ"]?.id || null, name: "내근 일정", trackType: "FIXED" },
    { code: "DEMO-FIELD", defaultSiteId: siteMap["DEMO-FIELD"]?.id || null, name: "외근 일정", trackType: "FIXED" },
    { code: "DEMO-BUSINESS", defaultSiteId: siteMap["DEMO-BRANCH"]?.id || null, name: "사업 일정", trackType: "FIXED" },
    { code: "DEMO-HOLIDAY", defaultSiteId: null, name: "휴일 일정", trackType: "FIXED" },
  ];

  for (const definition of templateDefinitions) {
    let template = templateMap.get(definition.code);

    if (!template) {
      const templateId = generateId();
      await connection.query(
        `
          INSERT INTO schedule_templates (
            id, organization_id, work_policy_id, code, name, track_type, effective_from, effective_to,
            cross_midnight, next_day_cutoff_time, default_site_id, status
          )
          VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NULL, 0, '04:00:00', ?, 'ACTIVE')
        `,
        [templateId, organizationId, workPolicyId, definition.code, definition.name, definition.trackType, definition.defaultSiteId],
      );
      template = { ...definition, id: templateId };
      templateMap.set(definition.code, template);
    }

    const [dayRows] = await connection.query(
      `
        SELECT COUNT(*) AS count
        FROM schedule_template_days
        WHERE schedule_template_id = ?
      `,
      [template.id],
    );

    if (Number(dayRows[0]?.count || 0) > 0) {
      continue;
    }

    const dayRules = buildTemplateDayRules(definition.code);
    for (const dayRule of dayRules) {
      await connection.query(
        `
          INSERT INTO schedule_template_days (
            id, schedule_template_id, day_of_week, is_working_day, start_time, end_time, break_minutes,
            late_grace_minutes, early_leave_grace_minutes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          generateId(),
          template.id,
          dayRule.dayOfWeek,
          dayRule.isWorkingDay,
          dayRule.startTime,
          dayRule.endTime,
          dayRule.breakMinutes,
          dayRule.lateGraceMinutes,
          dayRule.earlyLeaveGraceMinutes,
        ],
      );
    }
  }

  return Object.fromEntries(templateDefinitions.map((definition) => [definition.code, templateMap.get(definition.code)]));
}

async function ensureDemoUsers(connection, organization, workPolicyId, unitList, siteMap, desiredCount) {
  const queryRunner = connection.query.bind(connection);
  await ensureSystemRoles(queryRunner);
  const employeeRoleId = await requireSystemRoleId(queryRunner, SYSTEM_ROLE_CODES.EMPLOYEE);
  const emailPrefix = `demo.${String(organization.code || "").trim().toLowerCase()}.`;
  const [existingRows] = await connection.query(
    `
      SELECT
        id,
        employee_no AS employeeNo,
        login_email AS loginEmail,
        name,
        primary_unit_id AS primaryUnitId,
        default_site_id AS defaultSiteId
      FROM users
      WHERE organization_id = ?
        AND login_email LIKE ?
        AND deleted_at IS NULL
      ORDER BY employee_no
    `,
    [organization.id, `${emailPrefix}%`],
  );

  const currentCount = existingRows.length;

  if (currentCount < desiredCount) {
    const passwordHash = hashPassword("Passw0rd!");

    for (let index = currentCount; index < desiredCount; index += 1) {
      const unit = unitList[index % unitList.length];
      const defaultSiteCode = index % 3 === 0 ? "DEMO-HQ" : index % 3 === 1 ? "DEMO-BRANCH" : "DEMO-FIELD";
      const defaultSite = siteMap[defaultSiteCode] || siteMap["DEMO-HQ"];
      const userId = generateId();
      const serial = String(index + 1).padStart(3, "0");
      const employeeNo = `D${String(index + 1).padStart(4, "0")}`;
      const loginEmail = `${emailPrefix}${serial}@workmate.local`;
      const name = buildDisplayName(index);
      const jobTitle = buildJobTitle(index);
      const phone = `010-${String(7000 + index).padStart(4, "0")}-${String(1000 + index).padStart(4, "0")}`;
      const joinDay = String((index % 20) + 1).padStart(2, "0");
      const joinDate = `2026-03-${joinDay}`;

      await connection.query(
        `
          INSERT INTO users (
            id, organization_id, employee_no, login_email, password_hash, name, phone, employment_status,
            employment_type, join_date, timezone, primary_unit_id, default_site_id, track_type, work_policy_id,
            manager_user_id, metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'FULL_TIME', ?, 'Asia/Seoul', ?, ?, 'FIXED', ?, NULL,
            JSON_OBJECT('source', 'demo-workforce', 'demoWorkforce', true, 'jobTitle', ?))
        `,
        [
          userId,
          organization.id,
          employeeNo,
          loginEmail,
          passwordHash,
          name,
          phone,
          joinDate,
          unit.id,
          defaultSite?.id || null,
          workPolicyId,
          jobTitle,
        ],
      );

        await connection.query(
          `
            INSERT INTO user_roles (id, organization_id, user_id, role_id, scope_type, scope_id)
            VALUES (?, ?, ?, ?, 'self', NULL)
          `,
          [generateId(), organization.id, userId, employeeRoleId],
        );
    }
  }

  const [demoUsers] = await connection.query(
    `
      SELECT
        id,
        employee_no AS employeeNo,
        login_email AS loginEmail,
        name,
        primary_unit_id AS primaryUnitId,
        default_site_id AS defaultSiteId
      FROM users
      WHERE organization_id = ?
        AND login_email LIKE ?
        AND deleted_at IS NULL
      ORDER BY employee_no
    `,
    [organization.id, `${emailPrefix}%`],
  );

  for (let index = 0; index < demoUsers.length; index += 1) {
    const name = buildDisplayName(index);

    await connection.query(
      `
        UPDATE users
        SET name = ?,
          metadata_json = JSON_SET(
          COALESCE(metadata_json, JSON_OBJECT()),
          '$.source', 'demo-workforce',
          '$.demoWorkforce', true,
          '$.jobTitle', ?
        )
        WHERE id = ?
      `,
      [name, buildJobTitle(index), demoUsers[index].id],
    );
    demoUsers[index].name = name;
  }

  return demoUsers;
}

async function ensureLeaveBalances(connection, organizationId, demoUsers, leaveTypeMap, balanceYear) {
  const targetTypes = [
    { code: "ANNUAL", getAccrued: (index) => 15 + (index % 4), getOpening: (index) => index % 5 === 0 ? 2 : index % 7 === 0 ? 1 : 0, getUsed: (index) => 1 + (index % 7) },
    { code: "COMP", getAccrued: (index) => 2 + ((index % 5) * 0.5), getOpening: (index) => index % 6 === 0 ? 1 : 0, getUsed: (index) => (index % 4) * 0.5 },
    { code: "OTHER", getAccrued: (index) => 3 + (index % 3), getOpening: (index) => index % 8 === 0 ? 0.5 : 0, getUsed: (index) => index % 2 },
  ];
  let upsertedCount = 0;

  for (let index = 0; index < demoUsers.length; index += 1) {
    const user = demoUsers[index];

    for (const type of targetTypes) {
      const leaveType = leaveTypeMap[type.code];

      if (!leaveType?.id) {
        continue;
      }

      const openingBalance = Number(type.getOpening(index).toFixed(2));
      const accruedAmount = Number(type.getAccrued(index).toFixed(2));
      const usedAmount = Math.min(accruedAmount, Number(type.getUsed(index).toFixed(2)));
      const remainingAmount = Number((openingBalance + accruedAmount - usedAmount).toFixed(2));

      await connection.query(
        `
          INSERT INTO leave_balances (
            id, organization_id, user_id, leave_type_id, balance_year, opening_balance, accrued_amount,
            used_amount, remaining_amount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            opening_balance = VALUES(opening_balance),
            accrued_amount = VALUES(accrued_amount),
            used_amount = VALUES(used_amount),
            remaining_amount = VALUES(remaining_amount)
        `,
        [
          generateId(),
          organizationId,
          user.id,
          leaveType.id,
          balanceYear,
          openingBalance,
          accruedAmount,
          usedAmount,
          remainingAmount,
        ],
      );
      upsertedCount += 1;
    }
  }

  return upsertedCount;
}

async function clearTodayDemoData(connection, organizationId, demoUserIds, targetDate) {
  if (demoUserIds.length === 0) {
    return;
  }

  const userPlaceholders = demoUserIds.map(() => "?").join(", ");
  await connection.query(
    `
      DELETE FROM leave_requests
      WHERE organization_id = ?
        AND target_user_id IN (${userPlaceholders})
    `,
    [organizationId, ...demoUserIds],
  );

  await connection.query(
    `
      DELETE FROM attendance_anomalies
      WHERE organization_id = ?
        AND user_id IN (${userPlaceholders})
    `,
    [organizationId, ...demoUserIds],
  );
  await connection.query(
    `
      DELETE FROM attendance_events
      WHERE organization_id = ?
        AND user_id IN (${userPlaceholders})
    `,
    [organizationId, ...demoUserIds],
  );
  await connection.query(
    `
      DELETE FROM attendance_sessions
      WHERE organization_id = ?
        AND user_id IN (${userPlaceholders})
        AND work_date_local = ?
    `,
    [organizationId, ...demoUserIds, targetDate],
  );
  await connection.query(
    `
      DELETE FROM shift_instances
      WHERE organization_id = ?
        AND user_id IN (${userPlaceholders})
        AND shift_date = ?
    `,
    [organizationId, ...demoUserIds, targetDate],
  );
}

async function clearScheduleRangeDemoData(connection, organizationId, demoUserIds, dateFrom, dateTo, excludedDate = "") {
  if (demoUserIds.length === 0) {
    return 0;
  }

  const userPlaceholders = demoUserIds.map(() => "?").join(", ");
  const params = [organizationId, ...demoUserIds, dateFrom, dateTo];
  let excludedDateCondition = "";

  if (excludedDate) {
    excludedDateCondition = "AND si.shift_date <> ?";
    params.push(excludedDate);
  }

  const [result] = await connection.query(
    `
      DELETE si
      FROM shift_instances si
      LEFT JOIN schedule_templates st ON st.id = si.schedule_template_id
      LEFT JOIN attendance_sessions ats ON ats.shift_instance_id = si.id
      WHERE si.organization_id = ?
        AND si.user_id IN (${userPlaceholders})
        AND si.shift_date BETWEEN ? AND ?
        ${excludedDateCondition}
        AND si.schedule_assignment_id IS NULL
        AND st.code LIKE 'DEMO-%'
        AND ats.id IS NULL
    `,
    params,
  );

  return Number(result?.affectedRows || 0);
}

async function clearAttendanceRangeDemoData(connection, organizationId, demoUserIds, dateFrom, dateTo, excludedDate = "") {
  if (demoUserIds.length === 0) {
    return 0;
  }

  const userPlaceholders = demoUserIds.map(() => "?").join(", ");
  const params = [organizationId, ...demoUserIds, dateFrom, dateTo];
  let excludedDateCondition = "";

  if (excludedDate) {
    excludedDateCondition = "AND work_date_local <> ?";
    params.push(excludedDate);
  }

  const [sessionRows] = await connection.query(
    `
      SELECT id
      FROM attendance_sessions
      WHERE organization_id = ?
        AND user_id IN (${userPlaceholders})
        AND work_date_local BETWEEN ? AND ?
        ${excludedDateCondition}
        AND JSON_UNQUOTE(JSON_EXTRACT(summary_json, '$.source')) = 'demo-workforce-attendance-range'
    `,
    params,
  );
  const sessionIds = sessionRows.map((row) => row.id);

  if (sessionIds.length === 0) {
    return 0;
  }

  const sessionPlaceholders = sessionIds.map(() => "?").join(", ");

  await connection.query(
    `DELETE FROM attendance_anomalies WHERE session_id IN (${sessionPlaceholders})`,
    sessionIds,
  );
  await connection.query(
    `DELETE FROM attendance_events WHERE session_id IN (${sessionPlaceholders})`,
    sessionIds,
  );
  const [result] = await connection.query(
    `DELETE FROM attendance_sessions WHERE id IN (${sessionPlaceholders})`,
    sessionIds,
  );

  return Number(result?.affectedRows || 0);
}

async function seedScheduleRangeDemoData(connection, organization, demoUsers, siteMap, templateMap, workPolicyId, dateFrom, dateTo, excludedDate = "") {
  let insertedCount = 0;
  let skippedExistingCount = 0;

  for (const dateKey of iterateDateKeys(dateFrom, dateTo)) {
    if (dateKey === excludedDate) {
      continue;
    }

    for (let index = 0; index < demoUsers.length; index += 1) {
      const scenario = buildScheduleRangeScenario(index, dateKey);

      if (!scenario) {
        continue;
      }

      const user = demoUsers[index];
      const template = templateMap[scenario.scheduleCode];
      const site = scenario.siteCode ? siteMap[scenario.siteCode] : null;
      const [result] = await connection.query(
        `
          INSERT IGNORE INTO shift_instances (
            id, organization_id, user_id, schedule_assignment_id, schedule_template_id, work_policy_id, site_id,
            shift_date, planned_start_at, planned_end_at, planned_break_minutes, cross_midnight, next_day_cutoff_time, status
          )
          VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, '04:00:00', 'CONFIRMED')
        `,
        [
          generateId(),
          organization.id,
          user.id,
          template?.id || null,
          workPolicyId,
          site?.id || null,
          dateKey,
          toSqlDateTime(dateKey, scenario.startTime),
          toSqlDateTime(dateKey, scenario.endTime),
          scenario.breakMinutes,
        ],
      );

      if (Number(result?.affectedRows || 0) > 0) {
        insertedCount += 1;
      } else {
        skippedExistingCount += 1;
      }
    }
  }

  return { insertedCount, skippedExistingCount };
}

async function seedAttendanceRangeDemoData(connection, organization, demoUsers, workPolicyId, dateFrom, dateTo, excludedDate = "") {
  if (demoUsers.length === 0) {
    return { insertedCount: 0, skippedExistingCount: 0 };
  }

  const demoUserIds = demoUsers.map((user) => user.id);
  const userPlaceholders = demoUserIds.map(() => "?").join(", ");
  const params = [organization.id, ...demoUserIds, dateFrom, dateTo];
  let excludedDateCondition = "";

  if (excludedDate) {
    excludedDateCondition = "AND si.shift_date <> ?";
    params.push(excludedDate);
  }

  const [shiftRows] = await connection.query(
    `
      SELECT
        si.id AS shiftInstanceId,
        si.user_id AS userId,
        si.site_id AS siteId,
        si.shift_date AS shiftDate,
        TIME(si.planned_start_at) AS plannedStartTime,
        TIME(si.planned_end_at) AS plannedEndTime,
        si.planned_start_at AS plannedStartAt,
        si.planned_end_at AS plannedEndAt,
        si.planned_break_minutes AS plannedBreakMinutes,
        st.code AS scheduleCode,
        site.code AS siteCode
      FROM shift_instances si
      LEFT JOIN schedule_templates st ON st.id = si.schedule_template_id
      LEFT JOIN sites site ON site.id = si.site_id
      WHERE si.organization_id = ?
        AND si.user_id IN (${userPlaceholders})
        AND si.shift_date BETWEEN ? AND ?
        ${excludedDateCondition}
        AND si.schedule_assignment_id IS NULL
        AND st.code LIKE 'DEMO-%'
      ORDER BY si.shift_date, si.user_id
    `,
    params,
  );
  const userIndexById = new Map(demoUsers.map((user, index) => [String(user.id), index]));
  let insertedCount = 0;
  let skippedExistingCount = 0;

  for (const row of shiftRows) {
    const userId = String(row.userId || "");
    const userIndex = userIndexById.get(userId) || 0;
    const shiftDate = normalizeDateKeyValue(row.shiftDate);
    const startTime = String(row.plannedStartTime || "09:00:00").slice(0, 8);
    const endTime = String(row.plannedEndTime || "18:00:00").slice(0, 8);
    const breakMinutes = Number(row.plannedBreakMinutes || 0);
    const scheduledMinutes = Math.max(0, getMinutesBetween(startTime, endTime) - breakMinutes);
    const scenario = buildAttendanceRangeScenario(userIndex, shiftDate, row.scheduleCode || "");
    const actualFirstWorkStartAt = scenario.detailStatus === "ABSENT"
      ? null
      : addMinutesToSqlDateTime(shiftDate, startTime, scenario.actualStartOffset);
    const actualLastWorkEndAt = scenario.detailStatus === "ABSENT"
      ? null
      : addMinutesToSqlDateTime(shiftDate, endTime, scenario.actualEndOffset);
    const grossWorkMinutes = scenario.detailStatus === "ABSENT"
      ? 0
      : Math.max(0, scheduledMinutes + scenario.actualEndOffset - scenario.actualStartOffset);
    const recognizedWorkMinutes = scenario.detailStatus === "ABSENT"
      ? 0
      : Math.max(0, grossWorkMinutes - Math.max(0, scenario.lateMinutes - 10));
    const overtimeMinutes = scenario.detailStatus === "ABSENT"
      ? 0
      : Math.max(0, recognizedWorkMinutes - scheduledMinutes);
    const anomalyCount = scenario.detailStatus === "ABSENT" || scenario.lateMinutes > 0 || scenario.earlyLeaveMinutes > 0
      ? 1
      : 0;
    const [result] = await connection.query(
      `
        INSERT IGNORE INTO attendance_sessions (
          id, organization_id, user_id, site_id, shift_instance_id, work_policy_id, work_date_local, timezone, status, current_state,
          planned_start_at, planned_end_at, actual_first_work_start_at, actual_last_work_end_at, scheduled_minutes, gross_work_minutes,
          break_minutes, recognized_work_minutes, overtime_minutes, late_minutes, early_leave_minutes,
          anomaly_count, summary_json, opened_at, closed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Asia/Seoul', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          JSON_OBJECT('source', 'demo-workforce-attendance-range', 'siteCode', ?, 'scheduleCode', ?, 'detailStatus', ?, 'returnedAt', ?),
          ?, ?)
      `,
      [
        generateId(),
        organization.id,
        userId,
        row.siteId || null,
        row.shiftInstanceId,
        workPolicyId,
        shiftDate,
        scenario.status,
        scenario.currentState,
        row.plannedStartAt,
        row.plannedEndAt,
        actualFirstWorkStartAt,
        actualLastWorkEndAt,
        scheduledMinutes,
        grossWorkMinutes,
        breakMinutes,
        recognizedWorkMinutes,
        overtimeMinutes,
        scenario.lateMinutes,
        scenario.earlyLeaveMinutes,
        anomalyCount,
        row.siteCode || "",
        row.scheduleCode || "",
        scenario.detailStatus,
        scenario.detailStatus === "RETURNED" ? addMinutesToSqlDateTime(shiftDate, startTime, 145) : null,
        actualFirstWorkStartAt,
        actualLastWorkEndAt,
      ],
    );

    if (Number(result?.affectedRows || 0) > 0) {
      insertedCount += 1;
    } else {
      skippedExistingCount += 1;
    }
  }

  return { insertedCount, skippedExistingCount };
}

async function seedTodayDemoData(connection, organization, demoUsers, siteMap, templateMap, leaveTypeMap, workPolicyId, todayContext) {
  const siteCodeById = new Map(Object.values(siteMap).filter(Boolean).map((site) => [String(site.id), site.code]));

  for (let index = 0; index < demoUsers.length; index += 1) {
    const user = demoUsers[index];
    const scenario = buildScenario(index);
    const template = templateMap[scenario.scheduleCode];
    const site = scenario.siteCode ? siteMap[scenario.siteCode] : null;
    const shiftId = generateId();
    const plannedStartAt = scenario.scheduleCode === "DEMO-BUSINESS"
      ? todayContext.tripStart
      : scenario.scheduleCode === "DEMO-HOLIDAY"
        ? todayContext.holidayStart
        : todayContext.officeStart;
    const plannedEndAt = scenario.scheduleCode === "DEMO-BUSINESS"
      ? todayContext.tripEnd
      : scenario.scheduleCode === "DEMO-HOLIDAY"
        ? todayContext.holidayEnd
        : todayContext.officeEnd;
    const plannedBreakMinutes = scenario.scheduleCode === "DEMO-HOLIDAY" ? 0 : 60;

    await connection.query(
      `
        INSERT INTO shift_instances (
          id, organization_id, user_id, schedule_assignment_id, schedule_template_id, work_policy_id, site_id,
          shift_date, planned_start_at, planned_end_at, planned_break_minutes, cross_midnight, next_day_cutoff_time, status
        )
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, '04:00:00', 'CONFIRMED')
      `,
      [
        shiftId,
        organization.id,
        user.id,
        template?.id || null,
        workPolicyId,
        site?.id || null,
        todayContext.date,
        plannedStartAt,
        plannedEndAt,
        plannedBreakMinutes,
      ],
    );

    if (scenario.group === "leave") {
      const leaveType = leaveTypeMap[scenario.leaveTypeCode];
      const approvalStatus = scenario.leaveTypeCode === "ANNUAL" ? "APPROVED" : "SUBMITTED";
      const requestReason = scenario.leaveTypeCode === "ANNUAL" ? "연차 사용" : "건강 회복";

      await connection.query(
        `
          INSERT INTO leave_requests (
            id, organization_id, target_user_id, leave_type_id, start_date, end_date,
            partial_day_type, quantity, request_reason, approval_status
          )
          VALUES (?, ?, ?, ?, ?, ?, NULL, 1.00, ?, ?)
        `,
        [generateId(), organization.id, user.id, leaveType.id, todayContext.date, todayContext.date, requestReason, approvalStatus],
      );
      continue;
    }

    let status = "OPEN";
    let currentState = scenario.attendanceState;
    let actualFirstWorkStartAt = null;
    let actualLastWorkEndAt = null;
    let grossWorkMinutes = 0;
    let recognizedWorkMinutes = 0;
    let overtimeMinutes = 0;
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let anomalyCount = 0;
    let detailStatus = "";
    let openedAt = plannedStartAt;
    let closedAt = null;
    let siteId = site?.id || null;

    if (scenario.group === "working") {
      actualFirstWorkStartAt = todayContext.officeStart;
      grossWorkMinutes = 215 + (index % 4) * 12;
      recognizedWorkMinutes = grossWorkMinutes;
      anomalyCount = index % 7 === 0 ? 1 : 0;
      detailStatus = "WORKING";

      if (index % 10 === 0) {
        actualFirstWorkStartAt = todayContext.lateOfficeStart;
        lateMinutes = 14;
        detailStatus = "LATE";
      } else if (index % 6 === 0) {
        detailStatus = "RETURNED";
      }
    } else if (scenario.group === "remote") {
      actualFirstWorkStartAt = todayContext.remoteStart;
      grossWorkMinutes = 190 + (index % 3) * 15;
      recognizedWorkMinutes = grossWorkMinutes;
      detailStatus = "OFFSITE";
      if (currentState === "WFH_WORKING") {
        siteId = null;
      }
    } else if (scenario.group === "clocked_out") {
      status = "CLOSED";
      actualFirstWorkStartAt = scenario.scheduleCode === "DEMO-BUSINESS" ? todayContext.tripStart : todayContext.officeStart;
      actualLastWorkEndAt = todayContext.closeTime;
      grossWorkMinutes = scenario.scheduleCode === "DEMO-BUSINESS" ? 505 : 472;
      recognizedWorkMinutes = grossWorkMinutes - 15;
      overtimeMinutes = grossWorkMinutes > 480 ? grossWorkMinutes - 480 : 0;
      anomalyCount = index % 5 === 0 ? 1 : 0;
      closedAt = todayContext.closeTime;
      detailStatus = "CLOCKED_OUT";

      if (index % 6 === 0) {
        actualLastWorkEndAt = todayContext.earlyCloseTime;
        earlyLeaveMinutes = 18;
        detailStatus = "EARLY_LEAVE";
      }
    } else if (scenario.group === "off_duty") {
      status = "CLOSED";
      currentState = "OFF_DUTY";
      detailStatus = "ABSENT";
      openedAt = null;
      closedAt = null;
      siteId = null;
    }

    await connection.query(
      `
        INSERT INTO attendance_sessions (
          id, organization_id, user_id, site_id, shift_instance_id, work_policy_id, work_date_local, timezone, status, current_state,
          planned_start_at, planned_end_at, actual_first_work_start_at, actual_last_work_end_at, scheduled_minutes, gross_work_minutes,
          break_minutes, recognized_work_minutes, overtime_minutes, late_minutes, early_leave_minutes,
          anomaly_count, summary_json, opened_at, closed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Asia/Seoul', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          JSON_OBJECT('source', 'demo-workforce', 'siteCode', ?, 'detailStatus', ?, 'returnedAt', ?), ?, ?)
      `,
      [
        generateId(),
        organization.id,
        user.id,
        siteId,
        shiftId,
        workPolicyId,
        todayContext.date,
        status,
        currentState,
        scenario.group === "off_duty" ? null : plannedStartAt,
        scenario.group === "off_duty" ? null : plannedEndAt,
        actualFirstWorkStartAt,
        actualLastWorkEndAt,
        scenario.group === "off_duty" ? 0 : 480,
        grossWorkMinutes,
        scenario.group === "off_duty" ? 0 : plannedBreakMinutes,
        recognizedWorkMinutes,
        overtimeMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        anomalyCount,
        siteCodeById.get(String(siteId || "")) || "",
        detailStatus,
        detailStatus === "RETURNED" ? todayContext.returnAt : null,
        openedAt,
        closedAt,
      ],
    );
  }
}

async function main() {
  const { count, organizationCode, scheduleFrom, scheduleTo } = parseArgs();
  const connection = await mysql.createConnection(getDbConfig(true));

  try {
    await connection.beginTransaction();
    const organization = await getTargetOrganization(connection, organizationCode);

    if (!organization) {
      throw new Error("대상 조직을 찾을 수 없습니다.");
    }

    const workPolicy = await getDefaultWorkPolicy(connection, organization.id);

    if (!workPolicy) {
      throw new Error(`${organization.code} 조직의 기본 근무 정책을 찾을 수 없습니다.`);
    }

    const rootUnit = await ensureRootUnit(connection, organization.id);
    const unitList = await ensureUnits(connection, organization.id, rootUnit);
    const siteMap = await ensureSites(connection, organization.id, rootUnit.id);
    const leaveTypeMap = await ensureLeaveTypes(connection, organization.id);
    const templateMap = await ensureScheduleTemplates(connection, organization.id, workPolicy.id, siteMap);
    const demoUsers = await ensureDemoUsers(connection, organization, workPolicy.id, unitList, siteMap, count);
    const demoUserIds = demoUsers.map((user) => user.id);
    const todayContext = buildTodayContext();
    const leaveBalanceCount = await ensureLeaveBalances(
      connection,
      organization.id,
      demoUsers,
      leaveTypeMap,
      Number(todayContext.date.slice(0, 4)),
    );
    const scheduleRange = resolveScheduleRange(todayContext.date, scheduleFrom, scheduleTo);

    await clearTodayDemoData(connection, organization.id, demoUserIds, todayContext.date);
    await seedTodayDemoData(connection, organization, demoUsers, siteMap, templateMap, leaveTypeMap, workPolicy.id, todayContext);
    const deletedAttendanceSessions = await clearAttendanceRangeDemoData(
      connection,
      organization.id,
      demoUserIds,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const deletedScheduleInstances = await clearScheduleRangeDemoData(
      connection,
      organization.id,
      demoUserIds,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const scheduleSeedResult = await seedScheduleRangeDemoData(
      connection,
      organization,
      demoUsers,
      siteMap,
      templateMap,
      workPolicy.id,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );
    const attendanceSeedResult = await seedAttendanceRangeDemoData(
      connection,
      organization,
      demoUsers,
      workPolicy.id,
      scheduleRange.dateFrom,
      scheduleRange.dateTo,
      todayContext.date,
    );

    await connection.commit();
    console.log(JSON.stringify({
      addedUsers: demoUsers.length,
      organizationCode: organization.code,
      organizationName: organization.name,
      scheduleRange: {
        dateFrom: scheduleRange.dateFrom,
        dateTo: scheduleRange.dateTo,
        deletedInstances: deletedScheduleInstances,
        insertedInstances: scheduleSeedResult.insertedCount,
        skippedExistingInstances: scheduleSeedResult.skippedExistingCount,
      },
      attendanceRange: {
        dateFrom: scheduleRange.dateFrom,
        dateTo: scheduleRange.dateTo,
        deletedSessions: deletedAttendanceSessions,
        insertedSessions: attendanceSeedResult.insertedCount,
        skippedExistingSessions: attendanceSeedResult.skippedExistingCount,
      },
      leaveBalances: leaveBalanceCount,
      targetDate: todayContext.date,
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed demo workforce.");
  console.error(error.message || error);
  process.exitCode = 1;
});
