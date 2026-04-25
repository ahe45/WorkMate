const { getCurrentDateKey } = require("../modules/common/date");

function createBootstrapPayloadBuilder(deps = {}) {
  const {
    attendanceService,
    authService,
    dashboardService,
    jobTitlesService,
    leaveService,
    organizationsService,
    schedulesService,
    sitesService,
    usersService,
  } = deps;

  async function listAccessibleOrganizations(principal) {
    if (!principal) {
      return [];
    }

    const managedOrganizations = await organizationsService.listManagedOrganizations(principal.id);
    const managedOrganizationMap = new Map(managedOrganizations.map((organization) => [String(organization.id), organization]));

    if (authService.hasPlatformRole(principal, ["SYSTEM_ADMIN"])) {
      const organizations = await organizationsService.listOrganizations();

      return organizations.map((organization) => managedOrganizationMap.get(String(organization.id)) || organization);
    }

    if (authService.isPlatformAccount(principal)) {
      return managedOrganizations;
    }

    const baseOrganization = await organizationsService.getOrganizationSummary(principal.organizationId);

    if (!baseOrganization || managedOrganizations.some((organization) => String(organization.id) === String(baseOrganization.id))) {
      return managedOrganizations;
    }

    return [...managedOrganizations, baseOrganization];
  }

  function resolveRequestedOrganizationId(principal, requestedOrganizationId = "") {
    if (requestedOrganizationId) {
      return requestedOrganizationId;
    }

    if (authService.isPlatformAccount(principal)) {
      return "";
    }

    return principal?.organizationId || "";
  }

  async function buildBootstrapPayload(principal, requestedOrganizationId = "") {
    const organizations = await listAccessibleOrganizations(principal);
    const organizationId = resolveRequestedOrganizationId(principal, requestedOrganizationId);

    if (!principal || !organizationId) {
      return {
        dashboard: null,
        dashboardMonthlySessions: [],
        jobTitles: [],
        leaveBalances: [],
        leaveRequests: [],
        organizationContext: null,
        organizations,
        workPolicy: null,
        workPolicies: [],
        scheduleTemplates: [],
        sessions: [],
        shiftInstances: [],
        sites: [],
        units: [],
        users: [],
      };
    }

    authService.assertOrganizationAccess(principal, organizationId);

    const targetDate = getCurrentDateKey();
    const balanceYear = Number(targetDate.slice(0, 4));
    const monthStartDate = `${targetDate.slice(0, 8)}01`;

    return {
      dashboard: await dashboardService.getLiveSummary(organizationId),
      dashboardMonthlySessions: await attendanceService.listAttendanceSessions({
        dateFrom: monthStartDate,
        dateTo: targetDate,
        organizationId,
      }),
      jobTitles: await jobTitlesService.listJobTitles(organizationId),
      leaveBalances: await leaveService.listLeaveBalances(organizationId, balanceYear),
      leaveRequests: await leaveService.listLeaveRequests(organizationId, targetDate),
      organizationContext: await organizationsService.getOrganizationContext(organizationId),
      organizations,
      workPolicy: await schedulesService.getDefaultWorkPolicy(organizationId),
      workPolicies: await schedulesService.listWorkPolicies(organizationId),
      scheduleTemplates: await schedulesService.listScheduleTemplates(organizationId),
      sessions: await attendanceService.listAttendanceSessions({
        dateFrom: targetDate,
        dateTo: targetDate,
        organizationId,
      }),
      shiftInstances: await schedulesService.listOrganizationShiftInstances(organizationId, targetDate, targetDate),
      sites: await sitesService.listSites(organizationId),
      units: await organizationsService.listUnits(organizationId),
      users: await usersService.listUsers(organizationId),
    };
  }

  return Object.freeze({
    buildBootstrapPayload,
    listAccessibleOrganizations,
    resolveRequestedOrganizationId,
  });
}

module.exports = {
  createBootstrapPayloadBuilder,
};
