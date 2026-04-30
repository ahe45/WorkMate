const { exactRoute } = require("../router");

function createBootstrapRoutes({ buildBootstrapPayload, sendJson }) {
  return [
    exactRoute("GET", "/v1/bootstrap", async ({ response, searchParams, authContext }) => {
      sendJson(response, 200, await buildBootstrapPayload(authContext.principal, searchParams.get("organizationId") || ""));
    }, { auth: true }),
  ];
}

module.exports = {
  createBootstrapRoutes,
};
