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

    const managedOrganizations = await organizationsService.listManagedOrganizations(principal);
    const managedOrganizationMap = new Map(managedOrganizations.map((organization) => [String(organization.id), organization]));
    const accessibleOrganizationIds = Array.from(new Set((principal.accessibleOrganizationIds || [])
      .map((organizationId) => String(organizationId || "").trim())
      .filter(Boolean)));

    if (authService.hasPlatformRole(principal, ["SYSTEM_ADMIN"])) {
      const organizations = await organizationsService.listOrganizations();

      return organizations.map((organization) => managedOrganizationMap.get(String(organization.id)) || organization);
    }

    const organizationSummaries = (await Promise.all(
      accessibleOrganizationIds.map((organizationId) => organizationsService.getOrganizationSummary(organizationId)),
    ))
      .filter(Boolean)
      .map((organization) => managedOrganizationMap.get(String(organization.id)) || organization);

    const mergedById = new Map();

    organizationSummaries.forEach((organization) => {
      mergedById.set(String(organization.id), organization);
    });
    managedOrganizations.forEach((organization) => {
      mergedById.set(String(organization.id), organization);
    });

    return Array.from(mergedById.values())
      .sort((left, right) => {
        const leftIsCurrent = String(left?.id || "") === String(principal.organizationId || "");
        const rightIsCurrent = String(right?.id || "") === String(principal.organizationId || "");

        if (leftIsCurrent !== rightIsCurrent) {
          return leftIsCurrent ? -1 : 1;
        }

        return String(right?.createdAt || "").localeCompare(String(left?.createdAt || ""));
      });
  }

  function resolveRequestedOrganizationId(principal, requestedOrganizationId = "") {
    if (requestedOrganizationId) {
      return requestedOrganizationId;
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
        leaveAccrualEntries: [],
        leaveAccrualRules: [],
        leaveBalances: [],
        leaveGroups: [],
        leaveRequests: [],
        leaveTypes: [],
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

    await leaveService.runDueLeaveAccrualRules(organizationId, targetDate);

    return {
      dashboard: await dashboardService.getLiveSummary(organizationId),
      dashboardMonthlySessions: await attendanceService.listAttendanceSessions({
        dateFrom: monthStartDate,
        dateTo: targetDate,
        organizationId,
      }),
      jobTitles: await jobTitlesService.listJobTitles(organizationId),
      leaveAccrualEntries: await leaveService.listLeaveAccrualEntries(organizationId),
      leaveAccrualRules: await leaveService.listLeaveAccrualRules(organizationId),
      leaveBalances: await leaveService.listLeaveBalances(organizationId, balanceYear),
      leaveGroups: await leaveService.listLeaveGroups(organizationId),
      leaveRequests: await leaveService.listLeaveRequests(organizationId, targetDate),
      leaveTypes: await leaveService.listLeaveTypes(organizationId),
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
