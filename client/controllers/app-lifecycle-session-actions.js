(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppLifecycleSessionActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      getSelectedCompany,
      navigateTo,
      persistSelectedOrganizationId,
      resetAttendanceRecordsState,
      resetManagementHolidayState,
      resetPersistedManagementSection,
      resetReportRecordsState,
      resetScheduleCalendarState,
      state,
      updateUserMeta,
    } = dependencies;

    if (!api || !appConfig || !state || typeof navigateTo !== "function") {
      throw new Error("WorkMateAppLifecycleSessionActions requires session dependencies.");
    }

    function hasStoredTokens() {
      return Boolean(api.getAccessToken() || api.getRefreshToken());
    }

    function handleProtectedFailure(error) {
      if (error?.status === 401) {
        api.clearAuthTokens();
        resetPersistedManagementSection();
        persistSelectedOrganizationId("");
        navigateTo(appConfig.loginRoutePath, true);
        return true;
      }

      return false;
    }

    async function resolveMe() {
      const payload = await api.requestWithAutoRefresh("/v1/me");
      state.user = payload?.user || null;
      updateUserMeta();
      return state.user;
    }

    async function loadCompanies() {
      const payload = await api.requestWithAutoRefresh("/v1/account/organizations");
      state.companies = Array.isArray(payload?.items) ? payload.items : [];

      if (state.selectedOrganizationId && !getSelectedCompany()) {
        persistSelectedOrganizationId("");
      }

      return state.companies;
    }

    async function switchActiveOrganization(organizationId = "") {
      const normalizedOrganizationId = String(organizationId || "").trim();

      if (!normalizedOrganizationId || String(state.user?.organizationId || "").trim() === normalizedOrganizationId) {
        return state.user;
      }

      const tokenPair = await api.requestWithAutoRefresh("/v1/auth/switch-organization", {
        body: JSON.stringify({ organizationId: normalizedOrganizationId }),
        method: "POST",
      });

      api.setAuthTokens(tokenPair, {
        persist: typeof api.usesPersistentAuthStorage === "function" ? api.usesPersistentAuthStorage() : false,
      });
      state.user = tokenPair?.user || state.user;
      updateUserMeta();
      return state.user;
    }

    async function logout() {
      try {
        if (api.getRefreshToken()) {
          await api.apiRequest("/v1/auth/logout", {
            body: JSON.stringify({ refreshToken: api.getRefreshToken() }),
            method: "POST",
          });
        }
      } catch (error) {
        // Ignore logout failures.
      }

      api.clearAuthTokens();
      resetPersistedManagementSection();
      persistSelectedOrganizationId("");
      state.bootstrap = null;
      state.companies = [];
      state.dashboardDetailUserId = "";
      resetManagementHolidayState();
      resetScheduleCalendarState();
      resetAttendanceRecordsState();
      resetReportRecordsState();
      state.user = null;
      navigateTo(appConfig.loginRoutePath, true);
    }

    return Object.freeze({
      handleProtectedFailure,
      hasStoredTokens,
      loadCompanies,
      logout,
      resolveMe,
      switchActiveOrganization,
    });
  }

  return Object.freeze({ create });
});
