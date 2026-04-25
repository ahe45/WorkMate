const { generateId } = require("../common/ids");
const { isWorkingState } = require("./common");

function createAttendanceSessionStore() {
  async function ensureSession(connection, validation) {
    const [existingRows] = await connection.query(
      `
        SELECT
          id,
          current_state AS currentState
        FROM attendance_sessions
        WHERE user_id = ?
          AND work_date_local = ?
        LIMIT 1
      `,
      [validation.user.id, validation.workDate],
    );

    if (existingRows[0]) {
      return existingRows[0];
    }

    const sessionId = generateId();
    const scheduledMinutes = validation.shift
      ? Math.max(
          0,
          Math.round((new Date(validation.shift.plannedEndAt) - new Date(validation.shift.plannedStartAt)) / 60000) -
            Number(validation.shift.plannedBreakMinutes || 0),
        )
      : 0;

    await connection.query(
      `
        INSERT INTO attendance_sessions (
          id, organization_id, user_id, site_id, shift_instance_id, work_policy_id, work_date_local, timezone,
          status, current_state, planned_start_at, planned_end_at, scheduled_minutes, opened_at, summary_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'OFF_DUTY', ?, ?, ?, UTC_TIMESTAMP(3), JSON_OBJECT('source', 'clock'))
      `,
      [
        sessionId,
        validation.user.organizationId,
        validation.user.id,
        validation.resolvedSiteId,
        validation.resolvedShiftInstanceId,
        validation.workPolicyId,
        validation.workDate,
        validation.user.timezone || "Asia/Seoul",
        validation.shift?.plannedStartAt || null,
        validation.shift?.plannedEndAt || null,
        scheduledMinutes,
      ],
    );

    return {
      id: sessionId,
      currentState: "OFF_DUTY",
    };
  }

  async function recalculateSession(connection, sessionId) {
    const [sessionRows] = await connection.query(
      `
        SELECT
          s.id,
          s.planned_start_at AS plannedStartAt,
          s.planned_end_at AS plannedEndAt,
          s.scheduled_minutes AS scheduledMinutes,
          wp.late_grace_minutes AS lateGraceMinutes,
          wp.early_leave_grace_minutes AS earlyLeaveGraceMinutes
        FROM attendance_sessions s
        INNER JOIN work_policies wp ON wp.id = s.work_policy_id
        WHERE s.id = ?
      `,
      [sessionId],
    );
    const session = sessionRows[0];
    const [events] = await connection.query(
      `
        SELECT event_type AS eventType, occurred_at AS occurredAt, current_state_after AS currentStateAfter
        FROM attendance_events
        WHERE session_id = ?
        ORDER BY occurred_at, created_at
      `,
      [sessionId],
    );

    let grossMinutes = 0;
    let firstWorkStart = null;
    let lastWorkEnd = null;

    for (let index = 0; index < events.length - 1; index += 1) {
      const currentEvent = events[index];
      const nextEvent = events[index + 1];

      if (isWorkingState(currentEvent.currentStateAfter)) {
        const startAt = new Date(currentEvent.occurredAt);
        const endAt = new Date(nextEvent.occurredAt);
        grossMinutes += Math.max(0, Math.round((endAt - startAt) / 60000));

        if (!firstWorkStart) {
          firstWorkStart = currentEvent.occurredAt;
        }
      }
    }

    const lastEvent = events[events.length - 1] || null;
    if (lastEvent?.eventType === "CLOCK_OUT" || lastEvent?.eventType === "WFH_END") {
      lastWorkEnd = lastEvent.occurredAt;
    }

    if (!firstWorkStart && events[0]) {
      firstWorkStart = events[0].occurredAt;
    }

    let lateMinutes = 0;
    if (session.plannedStartAt && firstWorkStart) {
      const lateThreshold = new Date(new Date(session.plannedStartAt).getTime() + Number(session.lateGraceMinutes || 0) * 60000);
      lateMinutes = Math.max(0, Math.round((new Date(firstWorkStart) - lateThreshold) / 60000));
    }

    let earlyLeaveMinutes = 0;
    if (session.plannedEndAt && lastWorkEnd) {
      const earlyThreshold = new Date(new Date(session.plannedEndAt).getTime() - Number(session.earlyLeaveGraceMinutes || 0) * 60000);
      earlyLeaveMinutes = Math.max(0, Math.round((earlyThreshold - new Date(lastWorkEnd)) / 60000));
    }

    const recognizedMinutes = grossMinutes;
    const overtimeMinutes = Math.max(0, recognizedMinutes - Number(session.scheduledMinutes || 0));
    const [anomalyRows] = await connection.query(
      "SELECT COUNT(*) AS count FROM attendance_anomalies WHERE session_id = ? AND status = 'OPEN'",
      [sessionId],
    );
    const anomalyCount = Number(anomalyRows[0]?.count || 0);
    const currentState = lastEvent?.currentStateAfter || "OFF_DUTY";

    await connection.query(
      `
        UPDATE attendance_sessions
        SET
          current_state = ?,
          status = ?,
          actual_first_work_start_at = ?,
          actual_last_work_end_at = ?,
          gross_work_minutes = ?,
          break_minutes = 0,
          recognized_work_minutes = ?,
          overtime_minutes = ?,
          late_minutes = ?,
          early_leave_minutes = ?,
          anomaly_count = ?,
          summary_json = ?,
          closed_at = ?
        WHERE id = ?
      `,
      [
        currentState,
        currentState === "OFF_DUTY" ? "CLOSED" : "OPEN",
        firstWorkStart,
        lastWorkEnd,
        grossMinutes,
        recognizedMinutes,
        overtimeMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        anomalyCount,
        JSON.stringify({
          grossMinutes,
          recognizedMinutes,
          overtimeMinutes,
          lateMinutes,
          earlyLeaveMinutes,
        }),
        currentState === "OFF_DUTY" ? new Date() : null,
        sessionId,
      ],
    );
  }

  return Object.freeze({
    ensureSession,
    recalculateSession,
  });
}

module.exports = {
  createAttendanceSessionStore,
};
