const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser, getActorUserId } = require("./route-utils");

function createLeaveRoutes({ authService, leaveService, readJsonBody, sendJson }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/leave-management$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);

      sendJson(response, 200, {
        accrualEntries: await leaveService.listLeaveAccrualEntries(params.orgId),
        accrualRules: await leaveService.listLeaveAccrualRules(params.orgId),
        groups: await leaveService.listLeaveGroups(params.orgId),
        types: await leaveService.listLeaveTypes(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/leave-groups$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await leaveService.createLeaveGroup(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/leave-groups\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await leaveService.updateLeaveGroup(params.orgId, params.leaveGroupId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], leaveGroupId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/leave-groups\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await leaveService.deleteLeaveGroup(params.orgId, params.leaveGroupId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], leaveGroupId: match[2] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/leave-grants\/manual$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await leaveService.createManualLeaveGrant(
        params.orgId,
        await parseJsonOrEmpty(request),
        {
          actorUserId: getActorUserId(authContext.principal),
        },
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/leave-accrual-rules$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await leaveService.createLeaveAccrualRule(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/leave-accrual-rules\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await leaveService.updateLeaveAccrualRuleSet(params.orgId, params.ruleIds, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], ruleIds: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/leave-accrual-rules\/([^/]+)$/, async ({ response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await leaveService.deleteLeaveAccrualRuleSet(params.orgId, params.ruleIds));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], ruleIds: match[2] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/leave-accrual-rules\/([^/]+)\/run$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await leaveService.runLeaveAccrualRule(
        params.orgId,
        params.ruleId,
        await parseJsonOrEmpty(request),
        {
          actorUserId: getActorUserId(authContext.principal),
        },
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], ruleId: match[2] }),
    }),
  ];
}

module.exports = {
  createLeaveRoutes,
};
