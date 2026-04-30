const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser } = require("./route-utils");

function createOrganizationRoutes({ authService, organizationsService, readJsonBody, sendJson }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/units$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await organizationsService.listUnits(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/units$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await organizationsService.createUnit(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/units\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await organizationsService.updateUnit(params.orgId, params.unitId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], unitId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/units\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await organizationsService.deleteUnit(params.orgId, params.unitId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], unitId: match[2] }),
    }),
  ];
}

module.exports = {
  createOrganizationRoutes,
};
