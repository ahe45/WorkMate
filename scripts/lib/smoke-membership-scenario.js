const { jsonHeaders, request } = require("./http-test-client");

const SMOKE_ORGANIZATION_CODE = "SMOKE2";

async function findLatestInviteToken(databaseConnection, organizationId) {
  const [auditRows] = await databaseConnection.query(
    `
      SELECT metadata_json AS metadataJson
      FROM audit_logs
      WHERE action = 'user.join_invitation.issue'
        AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [organizationId],
  );
  const inviteMetadata = JSON.parse(String(auditRows[0]?.metadataJson || "{}"));
  const inviteUrl = String(inviteMetadata.inviteUrl || "");
  return inviteUrl ? new URL(inviteUrl).searchParams.get("joinInvite") || "" : "";
}

async function runMembershipSmokeScenario({
  authHeaders,
  baseUrl,
  currentDate,
  databaseConnection,
  originalOrganizationId,
}) {
  const managedOrganization = await request(baseUrl, "/v1/account/organizations", {
    body: JSON.stringify({
      code: SMOKE_ORGANIZATION_CODE,
      name: "Smoke Membership Org",
    }),
    headers: authHeaders,
    method: "POST",
  });
  const switchedAdmin = await request(baseUrl, "/v1/auth/switch-organization", {
    body: JSON.stringify({
      organizationId: managedOrganization.id,
    }),
    headers: authHeaders,
    method: "POST",
  });

  if (String(switchedAdmin?.user?.organizationId || "") !== String(managedOrganization.id)) {
    throw new Error("Admin membership switch failed.");
  }

  const switchedAdminHeaders = jsonHeaders(switchedAdmin.accessToken);
  const managedUsers = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users`, {
    headers: switchedAdminHeaders,
  });
  const managedCreator = managedUsers.items.find((item) => item.loginEmail === "admin@workmate.local");

  if (!managedCreator?.id) {
    throw new Error("Managed organization creator membership is missing.");
  }

  if (String(managedCreator.roleCode || "").trim().toUpperCase() !== "SYSTEM_ADMIN") {
    throw new Error("Managed organization creator did not receive SYSTEM_ADMIN role.");
  }

  if (String(managedCreator.primaryUnitId || "").trim()) {
    throw new Error("Managed organization creator should not have an initial unit assignment.");
  }

  if (String(managedCreator.jobTitleId || "").trim()) {
    throw new Error("Managed organization creator should not have an initial job title assignment.");
  }

  if (String(managedCreator.workPolicyId || "").trim()) {
    throw new Error("Managed organization creator should not have an initial work policy assignment.");
  }

  const unitPayload = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/units`, {
    headers: switchedAdminHeaders,
  });
  const rootUnit = unitPayload.items.find((item) => String(item.code || "").toUpperCase() === "ROOT");

  if (!rootUnit?.id) {
    throw new Error("Managed organization root unit is missing.");
  }

  const childUnit = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/units`, {
    body: JSON.stringify({
      name: "스모크팀",
      parentUnitId: rootUnit.id,
      unitType: "TEAM",
    }),
    headers: switchedAdminHeaders,
    method: "POST",
  });
  const jobTitle = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/job-titles`, {
    body: JSON.stringify({
      name: "스모크직급",
      unitIds: [childUnit.id],
    }),
    headers: switchedAdminHeaders,
    method: "POST",
  });
  const workPolicies = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/work-policies`, {
    headers: switchedAdminHeaders,
  });
  const defaultWorkPolicy = workPolicies.items.find((item) => item.isDefault) || workPolicies.items[0];

  if (!defaultWorkPolicy?.id) {
    throw new Error("Managed organization default work policy is missing.");
  }

  await request(baseUrl, "/v1/account/register", {
    body: JSON.stringify({
      loginEmail: "pending.member@example.com",
      name: "보류 임",
      password: "Passw0rd!",
    }),
    headers: jsonHeaders(),
    method: "POST",
  });

  const draftEmployee = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users`, {
    body: JSON.stringify({
      firstName: "보류",
      lastName: "임",
      submissionMode: "DRAFT",
    }),
    headers: switchedAdminHeaders,
    method: "POST",
  });

  if (String(draftEmployee?.managementStatus || draftEmployee?.employmentStatus || "").trim().toUpperCase() !== "DRAFT") {
    throw new Error("Draft employee did not start in DRAFT status.");
  }

  const pendingEmployee = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users/${draftEmployee.id}`, {
    body: JSON.stringify({
      firstName: "보류",
      jobTitleId: jobTitle.id,
      joinDate: currentDate,
      lastName: "임",
      loginEmail: "pending.member@example.com",
      phone: "010-2222-3333",
      primaryUnitId: childUnit.id,
      roleCode: "EMPLOYEE",
      submissionMode: "STANDARD",
      workPolicyId: defaultWorkPolicy.id,
    }),
    headers: switchedAdminHeaders,
    method: "PATCH",
  });

  if (String(pendingEmployee?.managementStatus || pendingEmployee?.employmentStatus || "").trim().toUpperCase() !== "PENDING") {
    throw new Error("Completed employee save did not move to PENDING status.");
  }

  const pendingAccountLogin = await request(baseUrl, "/v1/auth/login", {
    body: JSON.stringify({
      loginEmail: "pending.member@example.com",
      password: "Passw0rd!",
    }),
    headers: jsonHeaders(),
    method: "POST",
  });

  if (String(pendingAccountLogin?.user?.principalType || "").trim() !== "account" || String(pendingAccountLogin?.user?.organizationId || "").trim()) {
    throw new Error("Pending membership blocked account-level login.");
  }

  const pendingAccountCompanies = await request(baseUrl, "/v1/account/organizations", {
    headers: jsonHeaders(pendingAccountLogin.accessToken),
  });

  if (pendingAccountCompanies.items.some((item) => item.code === SMOKE_ORGANIZATION_CODE)) {
    throw new Error("Pending membership organization became visible before invite acceptance.");
  }

  const invitedPendingEmployee = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users/${draftEmployee.id}`, {
    body: JSON.stringify({
      firstName: "보류",
      inviteChannels: ["EMAIL"],
      jobTitleId: jobTitle.id,
      joinDate: currentDate,
      lastName: "임",
      loginEmail: "pending.member@example.com",
      phone: "010-2222-3333",
      primaryUnitId: childUnit.id,
      roleCode: "EMPLOYEE",
      submissionMode: "INVITED",
      workPolicyId: defaultWorkPolicy.id,
    }),
    headers: switchedAdminHeaders,
    method: "PATCH",
  });

  if (String(invitedPendingEmployee?.managementStatus || invitedPendingEmployee?.employmentStatus || "").trim().toUpperCase() !== "INVITED") {
    throw new Error("Pending employee invite did not move to INVITED status.");
  }

  await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users`, {
    body: JSON.stringify({
      employeeNo: "SMK-INV-001",
      firstName: "길동",
      inviteChannels: ["EMAIL"],
      jobTitleId: jobTitle.id,
      joinDate: currentDate,
      lastName: "홍",
      loginEmail: "employee@workmate.local",
      phone: "010-1234-5678",
      primaryUnitId: childUnit.id,
      roleCode: "EMPLOYEE",
      submissionMode: "INVITED",
      workPolicyId: defaultWorkPolicy.id,
    }),
    headers: switchedAdminHeaders,
    method: "POST",
  });

  const employeeCompaniesBeforeAccept = await request(baseUrl, "/v1/auth/login", {
    body: JSON.stringify({
      loginEmail: "employee@workmate.local",
      password: "Passw0rd!",
    }),
    headers: jsonHeaders(),
    method: "POST",
  }).then((loginResult) => request(baseUrl, "/v1/account/organizations", {
    headers: jsonHeaders(loginResult.accessToken),
  }));

  if (employeeCompaniesBeforeAccept.items.some((item) => item.code === SMOKE_ORGANIZATION_CODE)) {
    throw new Error("Invited organization became visible before invite acceptance.");
  }

  const inviteToken = await findLatestInviteToken(databaseConnection, managedOrganization.id);

  if (!inviteToken) {
    throw new Error("Invite token was not recorded in audit logs.");
  }

  const resolvedInvite = await request(baseUrl, `/v1/join-invitations/resolve?inviteToken=${encodeURIComponent(inviteToken)}`);

  if (!resolvedInvite.accountExists || String(resolvedInvite.loginEmail || "") !== "employee@workmate.local") {
    throw new Error("Invite resolution did not detect the existing employee account.");
  }

  const invitedEmployeeLogin = await request(baseUrl, "/v1/auth/login", {
    body: JSON.stringify({
      inviteToken,
      loginEmail: "employee@workmate.local",
      password: "Passw0rd!",
    }),
    headers: jsonHeaders(),
    method: "POST",
  });

  if (!String(invitedEmployeeLogin?.redirectPath || "").includes("/join-invite")) {
    throw new Error("Invite login did not redirect to the confirmation page.");
  }

  const acceptedEmployee = await request(baseUrl, "/v1/join-invitations/accept", {
    body: JSON.stringify({
      inviteToken,
    }),
    headers: jsonHeaders(invitedEmployeeLogin.accessToken),
    method: "POST",
  });

  if (String(acceptedEmployee?.user?.organizationId || "") !== String(managedOrganization.id)) {
    throw new Error("Invite acceptance did not land on the invited membership.");
  }

  const savedJoinedEmployee = await request(baseUrl, `/v1/orgs/${managedOrganization.id}/users/${acceptedEmployee.user.id}`, {
    body: JSON.stringify({
      note: "active-member-updated",
      phone: "010-9999-8888",
      submissionMode: "STANDARD",
    }),
    headers: switchedAdminHeaders,
    method: "PATCH",
  });

  if (String(savedJoinedEmployee?.managementStatus || savedJoinedEmployee?.employmentStatus || "").trim().toUpperCase() !== "ACTIVE") {
    throw new Error("Joined employee save should keep ACTIVE status.");
  }

  const acceptedEmployeeHeaders = jsonHeaders(acceptedEmployee.accessToken);
  const employeeCompaniesAfterAccept = await request(baseUrl, "/v1/account/organizations", {
    headers: acceptedEmployeeHeaders,
  });

  if (!employeeCompaniesAfterAccept.items.some((item) => item.code === SMOKE_ORGANIZATION_CODE)) {
    throw new Error("Accepted organization is missing from accessible companies.");
  }

  const switchedEmployeeBack = await request(baseUrl, "/v1/auth/switch-organization", {
    body: JSON.stringify({
      organizationId: originalOrganizationId,
    }),
    headers: acceptedEmployeeHeaders,
    method: "POST",
  });

  if (String(switchedEmployeeBack?.user?.organizationId || "") !== String(originalOrganizationId)) {
    throw new Error("Employee could not switch back to the original organization.");
  }
}

module.exports = {
  runMembershipSmokeScenario,
};
