const { createHttpError } = require("../../modules/common/http-error");
const { getCurrentDateKey } = require("../../modules/common/date");
const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser } = require("./route-utils");

function createScheduleRoutes({
  authService,
  leaveService,
  readJsonBody,
  schedulesService,
  sendJson,
  usersService,
}) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  async function getRequiredUserOrganizationId(userId) {
    const organizationId = await usersService.getUserOrganizationId(userId);

    if (!organizationId) {
      throw createHttpError(404, "사용자를 찾을 수 없습니다.", "USER_NOT_FOUND");
    }

    return organizationId;
  }

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/schedule-calendar$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);

      const dateFrom = searchParams.get("dateFrom") || getCurrentDateKey();
      const dateTo = searchParams.get("dateTo") || dateFrom;

      sendJson(response, 200, {
        leaveRequests: await leaveService.listLeaveRequestsInRange(params.orgId, dateFrom, dateTo),
        shiftInstances: await schedulesService.listOrganizationShiftInstances(params.orgId, dateFrom, dateTo),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/schedule-templates$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await schedulesService.listScheduleTemplates(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/work-policy$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, await schedulesService.getDefaultWorkPolicy(params.orgId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/work-policy$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await schedulesService.updateDefaultWorkPolicy(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/work-policies$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await schedulesService.listWorkPolicies(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/work-policies$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await schedulesService.createWorkPolicy(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/work-policies\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await schedulesService.updateWorkPolicy(params.orgId, params.policyId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], policyId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/work-policies\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await schedulesService.deleteWorkPolicy(params.orgId, params.policyId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], policyId: match[2] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/schedule-templates$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await schedulesService.createScheduleTemplate(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/schedule-assignments$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await schedulesService.createScheduleAssignment(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/users\/([^/]+)\/shift-instances$/, async ({ response, searchParams, params, authContext }) => {
      if (params.userId !== authContext.principal.id) {
        const organizationId = await getRequiredUserOrganizationId(params.userId);
        authService.assertOrganizationAccess(authContext.principal, organizationId);
        authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", organizationId);
      }

      sendJson(response, 200, {
        items: await schedulesService.listShiftInstances(
          params.userId,
          searchParams.get("dateFrom"),
          searchParams.get("dateTo"),
        ),
      });
    }, {
      auth: true,
      getParams: (match) => ({ userId: match[1] }),
    }),
  ];
}

module.exports = {
  createScheduleRoutes,
};
