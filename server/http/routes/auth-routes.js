const { exactRoute } = require("../router");
const { createJsonParser } = require("./route-utils");

function createAuthRoutes({ authService, readJsonBody, sendJson, usersService }) {
  const parseJsonOrEmpty = createJsonParser(readJsonBody);

  return [
    exactRoute("POST", "/v1/account/register", async ({ request, response }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.registerAccount({
        loginEmail: payload.loginEmail,
        name: payload.name,
        password: payload.password,
        request,
      });
      sendJson(response, 201, result);
    }, { auth: false }),

    exactRoute("POST", "/v1/auth/login", async ({ request, response }) => {
      const payload = await parseJsonOrEmpty(request);
      const loginResult = await authService.login({
        inviteToken: payload.inviteToken,
        loginEmail: payload.loginEmail,
        password: payload.password,
        request,
      });
      sendJson(response, 200, loginResult);
    }, { auth: false }),

    exactRoute("GET", "/v1/join-invitations/resolve", async ({ response, searchParams }) => {
      const inviteToken = searchParams.get("inviteToken") || searchParams.get("joinInvite") || "";
      const invitation = await authService.resolveJoinInvitation({
        inviteToken,
      });

      sendJson(response, 200, invitation);
    }, { auth: false }),

    exactRoute("POST", "/v1/join-invitations/register", async ({ request, response }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.registerInviteAccount({
        inviteToken: payload.inviteToken,
        password: payload.password,
        request,
      });

      sendJson(response, 201, result);
    }, { auth: false }),

    exactRoute("POST", "/v1/join-invitations/accept", async ({ request, response, authContext }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.acceptJoinInvitation({
        inviteToken: payload.inviteToken,
        principal: authContext.principal,
        request,
      });

      sendJson(response, 200, result);
    }, { auth: true }),

    exactRoute("POST", "/v1/join-invitations/reject", async ({ request, response, authContext }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.rejectJoinInvitation({
        inviteToken: payload.inviteToken,
        principal: authContext.principal,
        request,
      });

      sendJson(response, 200, result);
    }, { auth: true }),

    exactRoute("POST", "/v1/auth/refresh", async ({ request, response }) => {
      const payload = await parseJsonOrEmpty(request);
      const refreshed = await authService.refresh({
        refreshToken: payload.refreshToken,
        request,
      });
      sendJson(response, 200, refreshed);
    }, { auth: false }),

    exactRoute("POST", "/v1/auth/logout", async ({ request, response, authContext }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.logout({
        principal: authContext?.principal || null,
        refreshToken: payload.refreshToken,
        request,
      });
      sendJson(response, 200, result);
    }, { auth: { required: false } }),

    exactRoute("POST", "/v1/auth/switch-organization", async ({ request, response, authContext }) => {
      const payload = await parseJsonOrEmpty(request);
      const result = await authService.switchOrganization({
        organizationId: payload.organizationId,
        principal: authContext.principal,
        request,
      });
      sendJson(response, 200, result);
    }, { auth: true }),

    exactRoute("GET", "/v1/me", async ({ response, authContext }) => {
      sendJson(response, 200, {
        user: authContext.principal,
      });
    }, { auth: true }),

    exactRoute("PATCH", "/v1/me", async ({ request, response, authContext }) => {
      const principal = authContext.principal;
      const payload = await parseJsonOrEmpty(request);

      if (principal.principalType === "account" || !principal.organizationId) {
        const accountUser = await authService.updateAccountProfile(principal.accountId, {
          name: payload.name,
          phone: payload.phone,
        });

        sendJson(response, 200, {
          user: accountUser,
        });
        return;
      }

      await usersService.updateUserProfile(principal.organizationId, principal.id, {
        name: payload.name,
        phone: payload.phone,
      });

      sendJson(response, 200, {
        user: await authService.loadPrincipalByUserId(principal.id),
      });
    }, { auth: true }),
  ];
}

module.exports = {
  createAuthRoutes,
};
