const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser } = require("./route-utils");

function createHolidayRoutes({ authService, holidaysService, readJsonBody, sendJson }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/holidays$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, await holidaysService.syncHolidayCalendarYear(
        params.orgId,
        searchParams.get("year") || String(new Date().getFullYear()),
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/holidays\/custom$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await holidaysService.createCustomHoliday(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/holidays\/custom\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await holidaysService.updateCustomHoliday(params.orgId, params.holidayId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ holidayId: match[2], orgId: match[1] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/holidays\/custom\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await holidaysService.deleteCustomHoliday(params.orgId, params.holidayId));
    }, {
      auth: true,
      getParams: (match) => ({ holidayId: match[2], orgId: match[1] }),
    }),
  ];
}

module.exports = {
  createHolidayRoutes,
};
