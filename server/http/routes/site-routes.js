const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser } = require("./route-utils");

function createSiteRoutes({ authService, readJsonBody, sendJson, sitesService }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/sites$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await sitesService.listSites(params.orgId, {
          status: searchParams.get("status") || "",
        }),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/sites$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await sitesService.createSite(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/sites\/reorder$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await sitesService.reorderSites(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/sites\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await sitesService.updateSite(params.orgId, params.siteId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], siteId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/sites\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await sitesService.deleteSite(params.orgId, params.siteId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], siteId: match[2] }),
    }),
  ];
}

module.exports = {
  createSiteRoutes,
};
