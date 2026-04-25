const { createHttpError } = require("../modules/common/http-error");
const { getCurrentDateKey } = require("../modules/common/date");
const { createBootstrapPayloadBuilder } = require("./bootstrap-payload");
const { exactRoute, regexRoute } = require("./router");

function createApiRoutes(deps) {
  const {
    attendanceService,
    authService,
    dashboardService,
    holidaysService,
    jobTitlesService,
    leaveService,
    organizationsService,
    readJsonBody,
    schedulesService,
    sendJson,
    sitesService,
    usersService,
  } = deps;

  function getPrincipal(context) {
    return context.authContext?.principal || null;
  }

  async function parseJsonOrEmpty(request) {
    if (String(request.headers["content-length"] || "0") === "0" && !request.headers["transfer-encoding"]) {
      return {};
    }

    return readJsonBody(request);
  }

  const bootstrapPayloadBuilder = createBootstrapPayloadBuilder({
    attendanceService,
    authService,
    dashboardService,
    jobTitlesService,
    leaveService,
    organizationsService,
    schedulesService,
    sitesService,
    usersService,
  });
  const {
    buildBootstrapPayload,
    listAccessibleOrganizations,
    resolveRequestedOrganizationId,
  } = bootstrapPayloadBuilder;


  async function getRequiredUserOrganizationId(userId) {
    const organizationId = await usersService.getUserOrganizationId(userId);

    if (!organizationId) {
      throw createHttpError(404, "사용자를 찾을 수 없습니다.", "USER_NOT_FOUND");
    }

    return organizationId;
  }

  async function sendAccessibleOrganizationList(response, principal) {
    sendJson(response, 200, {
      items: await listAccessibleOrganizations(principal),
    });
  }

  async function createManagedOrganization(request, response, principal) {
    const payload = await parseJsonOrEmpty(request);
    const organization = await organizationsService.createManagedOrganization(principal.id, payload);

    sendJson(response, 201, organization);
  }


  return [
    exactRoute("GET", "/healthz", async ({ response }) => {
      sendJson(response, 200, { ok: true });
    }, { auth: false }),

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
        loginEmail: payload.loginEmail,
        password: payload.password,
        request,
      });
      sendJson(response, 200, loginResult);
    }, { auth: false }),

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

    exactRoute("GET", "/v1/me", async ({ response, authContext }) => {
      sendJson(response, 200, {
        user: authContext.principal,
      });
    }, { auth: true }),

    exactRoute("PATCH", "/v1/me", async ({ request, response, authContext }) => {
      const principal = authContext.principal;
      const payload = await parseJsonOrEmpty(request);

      await usersService.updateUserProfile(principal.organizationId, principal.id, {
        name: payload.name,
        phone: payload.phone,
      });

      sendJson(response, 200, {
        user: await authService.loadPrincipalByUserId(principal.id),
      });
    }, { auth: true }),

    exactRoute("GET", "/v1/account/organizations", async ({ response, authContext }) => {
      await sendAccessibleOrganizationList(response, authContext.principal);
    }, { auth: true }),

    exactRoute("POST", "/v1/account/organizations", async ({ request, response, authContext }) => {
      await createManagedOrganization(request, response, authContext.principal);
    }, { auth: true }),

    regexRoute("PATCH", /^\/v1\/account\/organizations\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      const principal = authContext.principal;
      const payload = await parseJsonOrEmpty(request);
      const organization = await organizationsService.updateManagedOrganization(principal.id, params.organizationId, payload);

      sendJson(response, 200, organization);
    }, {
      auth: true,
      getParams: (match) => ({ organizationId: match[1] }),
    }),

      exactRoute("GET", "/v1/bootstrap", async ({ response, searchParams, authContext }) => {
        sendJson(response, 200, await buildBootstrapPayload(authContext.principal, searchParams.get("organizationId") || ""));
      }, { auth: true }),

      regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/schedule-calendar$/, async ({ response, searchParams, params, authContext }) => {
        authService.assertOrganizationAccess(authContext.principal, params.orgId);

        const dateFrom = searchParams.get("dateFrom") || getCurrentDateKey();
        const dateTo = searchParams.get("dateTo") || dateFrom;

        sendJson(response, 200, {
          leaveRequests: await leaveService.listLeaveRequestsInRange(params.orgId, dateFrom, dateTo),
          shiftInstances: await schedulesService.listOrganizationShiftInstances(params.orgId, dateFrom, dateTo),
        });
      }, {
        auth: true,
        getParams: (match) => ({ orgId: match[1] }),
      }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/units$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await organizationsService.listUnits(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/units$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await organizationsService.createUnit(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/units\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await organizationsService.updateUnit(params.orgId, params.unitId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], unitId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/units\/([^/]+)$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await organizationsService.deleteUnit(params.orgId, params.unitId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], unitId: match[2] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/job-titles$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await jobTitlesService.listJobTitles(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/job-titles$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await jobTitlesService.createJobTitle(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/job-titles\/reorder$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await jobTitlesService.reorderJobTitles(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/job-titles\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await jobTitlesService.updateJobTitle(params.orgId, params.jobTitleId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ jobTitleId: match[2], orgId: match[1] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/job-titles\/([^/]+)$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await jobTitlesService.deleteJobTitle(params.orgId, params.jobTitleId));
    }, {
      auth: true,
      getParams: (match) => ({ jobTitleId: match[2], orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/holidays$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, await holidaysService.syncHolidayCalendarYear(
        params.orgId,
        searchParams.get("year") || String(new Date().getFullYear()),
      ));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/holidays\/custom$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await holidaysService.createCustomHoliday(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/holidays\/custom\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await holidaysService.updateCustomHoliday(params.orgId, params.holidayId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ holidayId: match[2], orgId: match[1] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/holidays\/custom\/([^/]+)$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await holidaysService.deleteCustomHoliday(params.orgId, params.holidayId));
    }, {
      auth: true,
      getParams: (match) => ({ holidayId: match[2], orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/sites$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await sitesService.listSites(params.orgId, {
          status: searchParams.get("status") || "",
        }),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/sites$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await sitesService.createSite(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/sites\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await sitesService.updateSite(params.orgId, params.siteId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], siteId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/sites\/([^/]+)$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await sitesService.deleteSite(params.orgId, params.siteId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], siteId: match[2] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/users$/, async ({ response, searchParams, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await usersService.listUsers(params.orgId, {
          employmentStatus: searchParams.get("employmentStatus") || "",
          unitId: searchParams.get("unitId") || "",
        }),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/users$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await usersService.createUser(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/users\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await usersService.updateUser(params.orgId, params.userId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], userId: match[2] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/schedule-templates$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await schedulesService.listScheduleTemplates(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/work-policy$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, await schedulesService.getDefaultWorkPolicy(params.orgId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/work-policy$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await schedulesService.updateDefaultWorkPolicy(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/orgs\/([^/]+)\/work-policies$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      sendJson(response, 200, {
        items: await schedulesService.listWorkPolicies(params.orgId),
      });
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/work-policies$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await schedulesService.createWorkPolicy(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("PATCH", /^\/v1\/orgs\/([^/]+)\/work-policies\/([^/]+)$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await schedulesService.updateWorkPolicy(params.orgId, params.policyId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], policyId: match[2] }),
    }),

    regexRoute("DELETE", /^\/v1\/orgs\/([^/]+)\/work-policies\/([^/]+)$/, async ({ response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 200, await schedulesService.deleteWorkPolicy(params.orgId, params.policyId));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1], policyId: match[2] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/schedule-templates$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await schedulesService.createScheduleTemplate(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("POST", /^\/v1\/orgs\/([^/]+)\/schedule-assignments$/, async ({ request, response, params, authContext }) => {
      authService.assertOrganizationAccess(authContext.principal, params.orgId);
      authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", params.orgId);
      sendJson(response, 201, await schedulesService.createScheduleAssignment(params.orgId, await parseJsonOrEmpty(request)));
    }, {
      auth: true,
      getParams: (match) => ({ orgId: match[1] }),
    }),

    regexRoute("GET", /^\/v1\/users\/([^/]+)\/shift-instances$/, async ({ response, searchParams, params, authContext }) => {
      if (params.userId !== authContext.principal.id) {
        const organizationId = await getRequiredUserOrganizationId(params.userId);
        authService.assertOrganizationAccess(authContext.principal, organizationId);
        authService.assertRoles(authContext.principal, ["ORG_ADMIN", "SYSTEM_ADMIN"], "권한이 없습니다.", organizationId);
      }

      sendJson(response, 200, {
        items: await schedulesService.listShiftInstances(
          params.userId,
          searchParams.get("dateFrom"),
          searchParams.get("dateTo"),
        ),
      });
    }, {
      auth: true,
      getParams: (match) => ({ userId: match[1] }),
    }),

    exactRoute("POST", "/v1/clock/validate", async ({ request, response, authContext }) => {
      sendJson(response, 200, await attendanceService.buildValidationResult(authContext.principal, await parseJsonOrEmpty(request)));
    }, { auth: true }),

    exactRoute("POST", "/v1/clock/events", async ({ request, response, authContext }) => {
      sendJson(response, 201, await attendanceService.createClockEvent(authContext.principal, await parseJsonOrEmpty(request), request));
    }, { auth: true }),

    exactRoute("GET", "/v1/attendance/sessions", async ({ response, searchParams, authContext }) => {
      const organizationId = resolveRequestedOrganizationId(authContext.principal, searchParams.get("organizationId") || "");

      if (!organizationId) {
        sendJson(response, 200, { items: [] });
        return;
      }

      authService.assertOrganizationAccess(authContext.principal, organizationId);
      sendJson(response, 200, {
        items: await attendanceService.listAttendanceSessions({
          dateFrom: searchParams.get("dateFrom") || "",
          dateTo: searchParams.get("dateTo") || "",
          organizationId,
          siteId: searchParams.get("siteId") || "",
          userId: searchParams.get("userId") || "",
        }),
      });
    }, { auth: true }),

    exactRoute("GET", "/v1/dashboard/live-summary", async ({ response, searchParams, authContext }) => {
      const organizationId = resolveRequestedOrganizationId(authContext.principal, searchParams.get("organizationId") || "");

      if (!organizationId) {
        sendJson(response, 200, {
          anomalies: [],
          date: searchParams.get("date") || getCurrentDateKey(),
          kpis: {
            anomalyCount: 0,
            lateCount: 0,
            offsiteCount: 0,
            totalSessions: 0,
            wfhCount: 0,
            workingCount: 0,
          },
          sites: [],
        });
        return;
      }

      authService.assertOrganizationAccess(authContext.principal, organizationId);
      sendJson(response, 200, await dashboardService.getLiveSummary(organizationId, searchParams.get("date") || ""));
    }, { auth: true }),

  ];
}

module.exports = {
  createApiRoutes,
};
