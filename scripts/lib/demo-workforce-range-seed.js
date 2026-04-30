const { generateId } = require("../../server/modules/common/ids");
const {
  addMinutesToSqlDateTime,
  buildAttendanceRangeScenario,
  buildScheduleRangeScenario,
  getMinutesBetween,
  iterateDateKeys,
  normalizeDateKeyValue,
  toSqlDateTime,
} = require("./demo-workforce-models");

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
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Asia/Seoul', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
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

module.exports = {
  clearAttendanceRangeDemoData,
  clearScheduleRangeDemoData,
  seedAttendanceRangeDemoData,
  seedScheduleRangeDemoData,
};
