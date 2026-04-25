(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkspaceStats = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      toArray,
    } = dependencies;

    if (typeof toArray !== "function") {
      throw new Error("WorkMateWorkspaceStats requires toArray.");
    }

    function isPersonalScopeEnabled(state = {}) {
      return Boolean(state.personalScopeEnabled);
    }

    function getPersonalScopeUser(state = {}, users = []) {
      if (!isPersonalScopeEnabled(state)) {
        return null;
      }

      const currentUserId = String(state.user?.id || "").trim();
      const currentUserEmail = String(state.user?.loginEmail || "").trim().toLowerCase();

      return toArray(users).find((user) => {
        const userId = String(user?.id || "").trim();
        const userEmail = String(user?.loginEmail || "").trim().toLowerCase();

        return (currentUserId && userId === currentUserId)
          || (currentUserEmail && userEmail === currentUserEmail);
      }) || null;
    }

    function getPersonalScopeUserId(state = {}, users = []) {
      return String(getPersonalScopeUser(state, users)?.id || "").trim();
    }

    function filterPersonalScopeItems(state = {}, users = [], items = []) {
      if (!isPersonalScopeEnabled(state)) {
        return toArray(items);
      }

      const scopeUserId = getPersonalScopeUserId(state, users);

      if (!scopeUserId) {
        return [];
      }

      return toArray(items).filter((item) => {
        const itemUserId = String(item?.userId || item?.targetUserId || item?.requesterId || "").trim();
        return itemUserId === scopeUserId;
      });
    }

    function buildStats(state = {}) {
      const bootstrap = state.bootstrap || {};
      const rawUsers = toArray(bootstrap.users);
      const scopeUser = getPersonalScopeUser(state, rawUsers);
      const users = isPersonalScopeEnabled(state)
        ? scopeUser
          ? rawUsers.filter((user) => String(user?.id || "") === String(scopeUser.id || ""))
          : []
        : rawUsers;
      const sites = toArray(bootstrap.sites);
      const jobTitles = toArray(bootstrap.jobTitles);
      const units = toArray(bootstrap.units);
      const workPolicies = toArray(bootstrap.workPolicies);
      const templates = toArray(bootstrap.scheduleTemplates);
      const sessions = filterPersonalScopeItems(state, rawUsers, bootstrap.sessions);
      const dashboardMonthlySessions = filterPersonalScopeItems(state, rawUsers, bootstrap.dashboardMonthlySessions);
      const shiftInstances = filterPersonalScopeItems(state, rawUsers, bootstrap.shiftInstances);
      const leaveBalances = filterPersonalScopeItems(state, rawUsers, bootstrap.leaveBalances);
      const leaveRequests = filterPersonalScopeItems(state, rawUsers, bootstrap.leaveRequests);
      const anomalies = filterPersonalScopeItems(state, rawUsers, bootstrap.dashboard?.anomalies);
      const activeUsers = users.filter((user) => String(user?.employmentStatus || "").toUpperCase() === "ACTIVE");
      const workingSessions = sessions.filter((session) => !["CLOCKED_OUT", "OFF_DUTY"].includes(String(session?.currentState || "").toUpperCase()));
      const offsiteSessions = sessions.filter((session) => ["OFFSITE", "WFH_WORKING"].includes(String(session?.currentState || "").toUpperCase()));
      const usersMissingDefaultSite = users.filter((user) => !user?.defaultSiteId && !user?.defaultSiteName);
      const usersMissingPhone = users.filter((user) => !user?.phone);
      const recentJoiners = users.filter((user) => {
        const joinDate = new Date(user?.joinDate || "");
        return !Number.isNaN(joinDate.getTime()) && Date.now() - joinDate.getTime() <= 1000 * 60 * 60 * 24 * 30;
      });
      const authReadySites = sites.filter((site) => Number(site?.geofenceRadiusMeters || 0) > 0 || site?.authMode);
      const siteLoad = sites.map((site) => ({
        count: sessions.filter((session) => String(session?.siteId || "") === String(site?.id || "") || String(session?.siteName || "") === String(site?.name || "")).length,
        name: site?.name || "미지정 사업장",
        ready: Boolean(site?.authMode || Number(site?.geofenceRadiusMeters || 0) > 0),
      })).sort((left, right) => right.count - left.count || String(left.name).localeCompare(String(right.name), "ko"));
      const unitDistribution = units.map((unit) => ({
        count: users.filter((user) => String(user?.primaryUnitId || "") === String(unit?.id || "") || String(user?.primaryUnitName || "") === String(unit?.name || "")).length,
        name: unit?.name || unit?.code || "미분류",
        path: unit?.path || "",
      })).sort((left, right) => right.count - left.count || String(left.name).localeCompare(String(right.name), "ko"));
      const averageWorkMinutes = sessions.length > 0 ? Math.round(sessions.reduce((total, session) => total + Number(session?.grossWorkMinutes || 0), 0) / sessions.length) : 0;

      return {
        activeUsers,
        anomalies,
        authReadySites,
        averageWorkMinutes,
        companies: toArray(state.companies || bootstrap.organizations),
        context: bootstrap.organizationContext || null,
        dashboardMonthlySessions,
        holidayData: state.managementHolidayData || null,
        jobTitles,
        leaveBalances,
        leaveRequests,
        offsiteSessions,
        recentJoiners,
        sessions,
        siteLoad,
        sites,
        shiftInstances,
        templates,
        unitDistribution,
        units,
        users,
        usersMissingDefaultSite,
        usersMissingPhone,
        workPolicy: bootstrap.workPolicy || null,
        workPolicies,
        workingSessions,
      };
    }

    return Object.freeze({
      buildStats,
      filterPersonalScopeItems,
    });
  }

  return Object.freeze({ create });
});
