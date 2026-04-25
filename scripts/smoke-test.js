const { spawnSync } = require("child_process");
const path = require("path");
const { getCurrentDateKey } = require("../server/modules/common/date");
const { ensureServer } = require("./lib/test-server");
const { applyEphemeralDatabaseName, loadProjectEnv } = require("./lib/database-targets");

const root = path.join(__dirname, "..");
loadProjectEnv(root);
const smokeBaseUrl = process.env.SMOKE_BASE_URL || "";

if (!smokeBaseUrl) {
  const { databaseName } = applyEphemeralDatabaseName(root, "test");
  console.log(`Using isolated smoke test database '${databaseName}'.`);
}

async function request(baseUrl, resource, options = {}) {
  const response = await fetch(`${baseUrl}${resource}`, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${resource} failed: ${payload.message || payload.error || response.status}`);
  }

  return payload;
}

async function main() {
  if (!smokeBaseUrl) {
    const setupResult = spawnSync(process.execPath, ["scripts/setup-db.js", "--reset"], {
      cwd: root,
      stdio: "inherit",
    });

    if (setupResult.status !== 0) {
      throw new Error("Database setup failed.");
    }
  }

  const serverSession = await ensureServer(root, {
    baseUrl: smokeBaseUrl,
    stdio: "inherit",
  });
  const baseUrl = serverSession.baseUrl;

  try {
    const loginResult = await request(baseUrl, "/v1/auth/login", {
      body: JSON.stringify({
        loginEmail: "admin@workmate.local",
        password: "Passw0rd!",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const authHeaders = {
      Authorization: `Bearer ${loginResult.accessToken}`,
      "Content-Type": "application/json",
    };

    const me = await request(baseUrl, "/v1/me", {
      headers: authHeaders,
    });
    if (!me.user?.id) {
      throw new Error("Current user payload is missing.");
    }

    const bootstrap = await request(baseUrl, "/v1/bootstrap", {
      headers: authHeaders,
    });
    const employee = bootstrap.users.find((user) => user.loginEmail === "employee@workmate.local");
    const site = bootstrap.sites[0];
    const template = bootstrap.scheduleTemplates[0];

    if (!employee || !site || !template) {
      throw new Error("Seed data is incomplete.");
    }

    await request(baseUrl, `/v1/orgs/${me.user.organizationId}/sites`, {
      headers: authHeaders,
    });
    await request(baseUrl, `/v1/orgs/${me.user.organizationId}/users`, {
      headers: authHeaders,
    });
    await request(baseUrl, "/v1/dashboard/live-summary", {
      headers: authHeaders,
    });

    await request(baseUrl, "/v1/clock/validate", {
      body: JSON.stringify({
        eventType: "CLOCK_IN",
        siteId: site.id,
        signals: {
          gps: {
            accuracyMeters: 20,
            lat: 37.4981,
            lng: 127.0276,
          },
        },
        userId: employee.id,
      }),
      headers: authHeaders,
      method: "POST",
    });

    await request(baseUrl, "/v1/clock/events", {
      body: JSON.stringify({
        clientEventId: "smoke-clock-in-001",
        eventType: "CLOCK_IN",
        siteId: site.id,
        signals: {
          gps: {
            accuracyMeters: 20,
            lat: 37.4981,
            lng: 127.0276,
          },
        },
        userId: employee.id,
      }),
      headers: authHeaders,
      method: "POST",
    });

    await request(baseUrl, "/v1/attendance/sessions", {
      headers: authHeaders,
    });

    const currentDate = getCurrentDateKey();
    await request(baseUrl, `/v1/users/${employee.id}/shift-instances?dateFrom=${currentDate}&dateTo=${currentDate}`, {
      headers: authHeaders,
    });

    console.log("SMOKE TEST PASSED");
  } finally {
    if (serverSession.child) {
      serverSession.child.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
