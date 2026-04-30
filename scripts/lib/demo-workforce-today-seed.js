const { generateId } = require("../../server/modules/common/ids");
const { buildScenario } = require("./demo-workforce-models");

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
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Asia/Seoul', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
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

module.exports = {
  clearTodayDemoData,
  seedTodayDemoData,
};
