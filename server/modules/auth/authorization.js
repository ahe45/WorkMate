const { createHttpError } = require("../common/http-error");

function hasPlatformRole(principal, roleCodes = []) {
  if (!principal) {
    return false;
  }

  const requiredRoleCodes = new Set(roleCodes.map((roleCode) => String(roleCode || "").trim()).filter(Boolean));
  return (principal.roles || []).some((role) => {
    const roleCode = String(role.roleCode || "").trim();

    return (
      (requiredRoleCodes.has(roleCode) || (roleCode === "MASTER_ADMIN" && requiredRoleCodes.has("SYSTEM_ADMIN")))
      && String(role.scopeType || "").toLowerCase() === "platform"
    );
  });
}

function hasAnyRole(principal, roleCodes = [], organizationId = "") {
  if (!principal) {
    return false;
  }

  if (hasPlatformRole(principal, roleCodes)) {
    return true;
  }

  const requiredRoleCodes = new Set(roleCodes.map((roleCode) => String(roleCode || "").trim()).filter(Boolean));
  const targetOrganizationId = String(organizationId || "").trim();

  if (!targetOrganizationId) {
    return false;
  }

  return (principal.roles || []).some((role) => {
    const roleCode = String(role.roleCode || "").trim();
    const scopeType = String(role.scopeType || "").trim().toLowerCase();
    const scopeId = role.scopeId ? String(role.scopeId) : "";

    if (!requiredRoleCodes.has(roleCode)) {
      return false;
    }

    if (scopeType === "organization") {
      return scopeId === targetOrganizationId;
    }

    return (scopeType === "self" || !scopeType) && String(principal.organizationId) === targetOrganizationId;
  });
}

function assertRoles(principal, roleCodes, message = "권한이 없습니다.", organizationId = "") {
  if (!hasAnyRole(principal, roleCodes, organizationId)) {
    throw createHttpError(403, message, "AUTH_FORBIDDEN");
  }
}

function assertOrganizationAccess(principal, organizationId) {
  if (hasPlatformRole(principal, ["SYSTEM_ADMIN"])) {
    return true;
  }

  const accessibleIds = new Set((principal?.accessibleOrganizationIds || []).map((value) => String(value)));

  if (accessibleIds.has(String(organizationId))) {
    return true;
  }

  throw createHttpError(403, "선택한 회사에 접근할 수 없습니다.", "AUTH_SCOPE_FORBIDDEN");
}

module.exports = {
  assertOrganizationAccess,
  assertRoles,
  hasAnyRole,
  hasPlatformRole,
};
