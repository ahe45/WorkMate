function createJsonParser(readJsonBody) {
  if (typeof readJsonBody !== "function") {
    throw new Error("readJsonBody is required to create API routes.");
  }

  return async function parseJsonOrEmpty(request) {
    if (String(request.headers["content-length"] || "0") === "0" && !request.headers["transfer-encoding"]) {
      return {};
    }

    return readJsonBody(request);
  };
}

function assertOrganizationManager(authService, principal, organizationId) {
  authService.assertOrganizationAccess(principal, organizationId);
  authService.assertRoles(principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", organizationId);
}

function getActorUserId(principal = null) {
  return principal?.principalType === "user" ? principal.id : "";
}

module.exports = {
  assertOrganizationManager,
  createJsonParser,
  getActorUserId,
};
