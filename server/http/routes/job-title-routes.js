const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser } = require("./route-utils");

function createJobTitleRoutes({ authService, jobTitlesService, readJsonBody, sendJson }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/job-titles$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await jobTitlesService.listJobTitles(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/job-titles$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await jobTitlesService.createJobTitle(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/job-titles\/reorder$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await jobTitlesService.reorderJobTitles(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/job-titles\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await jobTitlesService.updateJobTitle(params.orgId, params.jobTitleId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ jobTitleId: match[2], orgId: match[1] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/job-titles\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await jobTitlesService.deleteJobTitle(params.orgId, params.jobTitleId));
    }, {
      auth: true,
      getParams: (match) => ({ jobTitleId: match[2], orgId: match[1] }),
    }),
  ];
}

module.exports = {
  createJobTitleRoutes,
};
