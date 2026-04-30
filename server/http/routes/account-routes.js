const { exactRoute, regexRoute } = require("../router");
const { createJsonParser } = require("./route-utils");

function createAccountRoutes({
  listAccessibleOrganizations,
  organizationsService,
  readJsonBody,
  sendJson,
}) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  async function sendAccessibleOrganizationList(response, principal) {
    sendJson(response, 200, {
      items: await listAccessibleOrganizations(principal),
    });
  }

  async function createManagedOrganization(request, response, principal) {
    const payload = await parseJsonOrEmpty(request);
    const organization = await organizationsService.createManagedOrganization(principal, payload);

    sendJson(response, 201, organization);
  }

  return [
    exactRoute("GET", "/v1/account/organizations", async ({ response, authContext }) => {
      await sendAccessibleOrganizationList(response, authContext.principal);
    }, { auth: true }),

    exactRoute("POST", "/v1/account/organizations", async ({ request, response, authContext }) => {
      await createManagedOrganization(request, response, authContext.principal);
    }, { auth: true }),

    regexRoute("PATCH", /^\/v1\/account\/organizations\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      const principal = authContext.principal;
      const payload = await parseJsonOrEmpty(request);
      const organization = await organizationsService.updateManagedOrganization(principal, params.organizationId, payload);

      sendJson(response, 200, organization);
    }, {
      auth: true,
      getParams: (match) => ({ organizationId: match[1] }),
    }),
  ];
}

module.exports = {
  createAccountRoutes,
};
