require("dotenv").config({ quiet: true });

const fs = require("fs");
const http = require("http");
const mysql = require("mysql2/promise");
const path = require("path");

const { getDbConfig, query, withTransaction } = require("./db");
const { readJsonBody } = require("./server/http/body");
const { createApiRoutes } = require("./server/http/api-routes");
const { dispatchRoute } = require("./server/http/router");
const { getCorsHeaders, sendJson } = require("./server/http/response");
const { createAttendanceService } = require("./server/modules/attendance/service");
const { createAuthService } = require("./server/modules/auth/service");
const { hashPassword, verifyPassword } = require("./server/modules/auth/passwords");
const { createBootstrapService } = require("./server/modules/bootstrap/service");
const { createDashboardService } = require("./server/modules/dashboard/service");
const { createHolidaysService } = require("./server/modules/holidays/service");
const { createJobTitlesService } = require("./server/modules/job-titles/service");
const { createLeaveService } = require("./server/modules/leave/service");
const { createOrganizationsService } = require("./server/modules/organizations/service");
const { createSchedulesService } = require("./server/modules/schedules/service");
const { createSitesService } = require("./server/modules/sites/service");
const { createUsersService } = require("./server/modules/users/service");

const port = Number(process.env.PORT) || 3001;
const root = __dirname;
const workspaceRoutePattern = /^\/companies\/[^/]+\/workspace(?:\/.*)?$/i;
const bootstrapService = createBootstrapService({ hashPassword });

const organizationsService = createOrganizationsService({ query, withTransaction });
const sitesService = createSitesService({ query, withTransaction });
const usersService = createUsersService({ hashPassword, query, withTransaction });
const schedulesService = createSchedulesService({ query, withTransaction });
const jobTitlesService = createJobTitlesService({ query, withTransaction });
const holidaysService = createHolidaysService({ query, withTransaction });
const leaveService = createLeaveService({ query });
const authService = createAuthService({ hashPassword, organizationsService, query, verifyPassword, withTransaction });
const attendanceService = createAttendanceService({ authService, query, withTransaction });
const dashboardService = createDashboardService({ query });
const apiRoutes = createApiRoutes({
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
});

function resolveStaticFile(pathname) {
  if (pathname === "/login" || pathname === "/login.html") {
    return path.join(root, "index.html");
  }

  if (pathname === "/companies" || pathname === "/companies.html") {
    return path.join(root, "companies.html");
  }

  if (workspaceRoutePattern.test(pathname)) {
    return path.join(root, "workspace.html");
  }

  if (pathname === "/signup" || pathname === "/signup.html") {
    return path.join(root, "signup.html");
  }

  if (pathname.startsWith("/styles/")) {
    return path.join(root, pathname);
  }

  if (pathname.startsWith("/shared/")) {
    return path.join(root, pathname);
  }

  if (pathname.startsWith("/client/")) {
    return path.join(root, pathname);
  }

  return "";
}

function sendFile(response, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(response, 404, { message: "요청한 리소스를 찾을 수 없습니다." });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };

  response.writeHead(200, {
    ...getCorsHeaders(),
    "Content-Type": contentTypes[extension] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, getCorsHeaders());
      response.end();
      return;
    }

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
      response.writeHead(302, {
        ...getCorsHeaders(),
        Location: "/login",
      });
      response.end();
      return;
    }

    const handled = await dispatchRoute(
      apiRoutes,
      {
        request,
        requestUrl,
        response,
      },
      {
        authenticate: (incomingRequest, authOptions) => authService.authenticateRequest(incomingRequest, authOptions),
      },
    );

    if (handled) {
      return;
    }

    sendFile(response, resolveStaticFile(requestUrl.pathname));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(response, statusCode, {
      code: error.code || "INTERNAL_SERVER_ERROR",
      details: error.details || null,
      message: error.message || "서버 오류가 발생했습니다.",
    });
  }
});

async function initializeServer() {
  const connection = await mysql.createConnection(getDbConfig(false));

  try {
    await bootstrapService.applySchema(connection);
  } finally {
    await connection.end();
  }

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("error", handleError);
      reject(error);
    };

    server.once("error", handleError);
    server.listen(port, () => {
      server.off("error", handleError);
      console.log(`WorkMate running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  initializeServer().catch((error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use.`);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  initializeServer,
  server,
};
