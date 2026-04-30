const { exactRoute } = require("../router");

function createSystemRoutes({ sendJson }) {
  return [
    exactRoute("GET", "/healthz", async ({ response }) => {
      sendJson(response, 200, { ok: true });
    }, { auth: false }),
  ];
}

module.exports = {
  createSystemRoutes,
};
