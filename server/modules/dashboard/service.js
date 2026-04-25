const { getCurrentDateKey } = require("../common/date");

function createDashboardService({ query }) {
  async function getLiveSummary(organizationId, workDate) {
    const targetDate = workDate || getCurrentDateKey();
    const [summaryRow] = await query(
      `
        SELECT
          COUNT(*) AS totalSessions,
          SUM(CASE WHEN current_state = 'WORKING' THEN 1 ELSE 0 END) AS workingCount,
          SUM(CASE WHEN current_state = 'OFFSITE' THEN 1 ELSE 0 END) AS offsiteCount,
          SUM(CASE WHEN current_state = 'WFH_WORKING' THEN 1 ELSE 0 END) AS wfhCount,
          SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) AS lateCount,
          SUM(CASE WHEN anomaly_count > 0 THEN 1 ELSE 0 END) AS anomalyCount
        FROM attendance_sessions
        WHERE organization_id = :organizationId
          AND work_date_local = :workDate
      `,
      { organizationId, workDate: targetDate },
    );
    const sites = await query(
      `
        SELECT
          si.id,
          si.name,
          COUNT(s.id) AS sessionCount,
          SUM(CASE WHEN s.current_state = 'WORKING' THEN 1 ELSE 0 END) AS workingCount,
          SUM(CASE WHEN s.current_state = 'OFFSITE' THEN 1 ELSE 0 END) AS offsiteCount,
          SUM(CASE WHEN s.current_state = 'WFH_WORKING' THEN 1 ELSE 0 END) AS wfhCount
        FROM sites si
        LEFT JOIN attendance_sessions s
          ON s.site_id = si.id
         AND s.work_date_local = :workDate
        WHERE si.organization_id = :organizationId
          AND si.deleted_at IS NULL
        GROUP BY si.id, si.name
        ORDER BY si.name
      `,
      { organizationId, workDate: targetDate },
    );
    const anomalies = await query(
      `
        SELECT
          a.id,
          a.anomaly_code AS anomalyCode,
          a.severity,
          a.status,
          a.detected_at AS detectedAt,
          u.name AS userName
        FROM attendance_anomalies a
        INNER JOIN users u ON u.id = a.user_id
        WHERE a.organization_id = :organizationId
          AND a.status = 'OPEN'
        ORDER BY a.detected_at DESC
        LIMIT 10
      `,
      { organizationId },
    );

    return {
      date: targetDate,
      kpis: summaryRow || {
        totalSessions: 0,
        workingCount: 0,
        offsiteCount: 0,
        wfhCount: 0,
        lateCount: 0,
        anomalyCount: 0,
      },
      sites,
      anomalies,
    };
  }

  return {
    getLiveSummary,
  };
}

module.exports = {
  createDashboardService,
};
