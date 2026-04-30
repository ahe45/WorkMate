const { regexRoute } = require("../router");
const { assertOrganizationManager, createJsonParser, getActorUserId } = require("./route-utils");

function createUserRoutes({ authService, readJsonBody, sendJson, usersService }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/users$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await usersService.listUsers(params.orgId, {
          employmentStatus: searchParams.get("employmentStatus") || "",
          unitId: searchParams.get("unitId") || "",
        }),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/users$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 201, await usersService.createUser(
        params.orgId,
        await parseJsonOrEmpty(request),
        {
          actorUserId: getActorUserId(authContext.principal),
          request,
        },
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/users\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);
      sendJson(response, 200, await usersService.updateUser(
        params.orgId,
        params.userId,
        await parseJsonOrEmpty(request),
        {
          actorUserId: getActorUserId(authContext.principal),
          request,
        },
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], userId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/users\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      assertOrganizationManager(authService, authContext.principal, params.orgId);

      const payload = await parseJsonOrEmpty(request);
      await authService.verifyPrincipalPassword(authContext.principal, payload.password);
      sendJson(response, 200, await usersService.deleteUser(
        params.orgId,
        params.userId,
        {
          actorUserId: getActorUserId(authContext.principal),
          request,
        },
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], userId: match[2] }),
    }),
  ];
}

module.exports = {
  createUserRoutes,
};
