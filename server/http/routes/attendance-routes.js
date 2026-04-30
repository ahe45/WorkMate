const { getCurrentDateKey } = require("../../modules/common/date");
const { exactRoute } = require("../router");
const { createJsonParser } = require("./route-utils");

function createAttendanceRoutes({
  attendanceService,
  authService,
  dashboardService,
  readJsonBody,
  resolveRequestedOrganizationId,
  sendJson,
}) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    exactRoute("POST", "/v1/clock/validate", async ({ request, response, authContext }) => {
      sendJson(response, 200, await attendanceService.buildValidationResult(authContext.principal, await parseJsonOrEmpty(request)));
    }, { auth: true }),

    exactRoute("POST", "/v1/clock/events", async ({ request, response, authContext }) => {
      sendJson(response, 201, await attendanceService.createClockEvent(authContext.principal, await parseJsonOrEmpty(request), request));
    }, { auth: true }),

    exactRoute("GET", "/v1/attendance/sessions", async ({ response, searchParams, authContext }) => {
      const organizationId = resolveRequestedOrganizationId(authContext.principal, searchParams.get("organizationId") || "");

      if (!organizationId) {
        sendJson(response, 200, { items: [] });
        return;
      }

      authService.assertOrganizationAccess(authContext.principal, organizationId);
      sendJson(response, 200, {
        items: await attendanceService.listAttendanceSessions({
          dateFrom: searchParams.get("dateFrom") || "",
          dateTo: searchParams.get("dateTo") || "",
          organizationId,
          siteId: searchParams.get("siteId") || "",
          userId: searchParams.get("userId") || "",
        }),
      });
    }, { auth: true }),

    exactRoute("GET", "/v1/dashboard/live-summary", async ({ response, searchParams, authContext }) => {
      const organizationId = resolveRequestedOrganizationId(authContext.principal, searchParams.get("organizationId") || "");

      if (!organizationId) {
        sendJson(response, 200, {
          anomalies: [],
          date: searchParams.get("date") || getCurrentDateKey(),
          kpis: {
            anomalyCount: 0,
            lateCount: 0,
            offsiteCount: 0,
            totalSessions: 0,
            wfhCount: 0,
            workingCount: 0,
          },
          sites: [],
        });
        return;
      }

      authService.assertOrganizationAccess(authContext.principal, organizationId);
      sendJson(response, 200, await dashboardService.getLiveSummary(organizationId, searchParams.get("date") || ""));
    }, { auth: true }),
  ];
}

module.exports = {
  createAttendanceRoutes,
};
