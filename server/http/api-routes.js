const { createBootstrapPayloadBuilder } = require("./bootstrap-payload");
const { createAccountRoutes } = require("./routes/account-routes");
const { createAttendanceRoutes } = require("./routes/attendance-routes");
const { createAuthRoutes } = require("./routes/auth-routes");
const { createBootstrapRoutes } = require("./routes/bootstrap-routes");
const { createHolidayRoutes } = require("./routes/holiday-routes");
const { createJobTitleRoutes } = require("./routes/job-title-routes");
const { createLeaveRoutes } = require("./routes/leave-routes");
const { createOrganizationRoutes } = require("./routes/organization-routes");
const { createScheduleRoutes } = require("./routes/schedule-routes");
const { createSiteRoutes } = require("./routes/site-routes");
const { createSystemRoutes } = require("./routes/system-routes");
const { createUserRoutes } = require("./routes/user-routes");

function createApiRoutes(deps) {
  const {
    attendanceService,
    authService,
    dashboardService,
    holidaysService,
    jobTitlesService,
    leaveService,
    organizationsService,
    readJsonBody,
    schedulesService,
    sendJson,
    sitesService,
    usersService,
  } = deps;

  const bootstrapPayloadBuilder = createBootstrapPayloadBuilder({
    attendanceService,
    authService,
    dashboardService,
    jobTitlesService,
    leaveService,
    organizationsService,
    schedulesService,
    sitesService,
    usersService,
  });
  const {
    buildBootstrapPayload,
    listAccessibleOrganizations,
    resolveRequestedOrganizationId,
  } = bootstrapPayloadBuilder;

  return [
    ...createSystemRoutes({ sendJson }),
    ...createAuthRoutes({ authService, readJsonBody, sendJson, usersService }),
    ...createAccountRoutes({
      listAccessibleOrganizations,
      organizationsService,
      readJsonBody,
      sendJson,
    }),
    ...createBootstrapRoutes({ buildBootstrapPayload, sendJson }),
    ...createScheduleRoutes({
      authService,
      leaveService,
      readJsonBody,
      schedulesService,
      sendJson,
      usersService,
    }),
    ...createLeaveRoutes({ authService, leaveService, readJsonBody, sendJson }),
    ...createOrganizationRoutes({ authService, organizationsService, readJsonBody, sendJson }),
    ...createJobTitleRoutes({ authService, jobTitlesService, readJsonBody, sendJson }),
    ...createHolidayRoutes({ authService, holidaysService, readJsonBody, sendJson }),
    ...createSiteRoutes({ authService, readJsonBody, sendJson, sitesService }),
    ...createUserRoutes({ authService, readJsonBody, sendJson, usersService }),
    ...createAttendanceRoutes({
      attendanceService,
      authService,
      dashboardService,
      readJsonBody,
      resolveRequestedOrganizationId,
      sendJson,
    }),
  ];
}

module.exports = {
  createApiRoutes,
};
