const { spawnSync } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");
const { ensureServer } = require("./lib/test-server");
const { applyEphemeralDatabaseName, loadProjectEnv } = require("./lib/database-targets");
const { verifyAttendancePage } = require("./lib/ui-verification-attendance-scenario");
const { verifyDashboardPage } = require("./lib/ui-verification-dashboard-scenario");
const { verifyLoginAndOpenWorkspace } = require("./lib/ui-verification-entry-scenario");
const { ensureArtifactDir } = require("./lib/ui-verification-helpers");
const { verifyLeavePage } = require("./lib/ui-verification-leave-scenario");
const { verifyReportsPage } = require("./lib/ui-verification-reports-scenario");
const { verifySchedulesPage } = require("./lib/ui-verification-schedules-scenario");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = path.join(ROOT, "artifacts", "ui-check");
const START_TIMEOUT_MS = 20000;
const VERIFY_DEMO_WORKFORCE_COUNT = 48;

loadProjectEnv(ROOT);

const VERIFY_BASE_URL = process.env.VERIFY_BASE_URL || "";
const LOGIN_EMAIL = process.env.VERIFY_EMAIL || "admin@workmate.local";
const LOGIN_PASSWORD = process.env.VERIFY_PASSWORD || "Passw0rd!";

if (!VERIFY_BASE_URL) {
  const { databaseName } = applyEphemeralDatabaseName(ROOT, "ui");
  console.log(`Using isolated UI verification database '${databaseName}'.`);
}

async function run() {
  ensureArtifactDir(ARTIFACT_DIR);

  if (!VERIFY_BASE_URL) {
    const setupResult = spawnSync(process.execPath, ["scripts/setup-db.js", "--reset"], {
      cwd: ROOT,
      env: {
        ...process.env,
        SEED_DEMO_DATA: "true",
      },
      stdio: "inherit",
    });

    if (setupResult.status !== 0) {
      throw new Error("Database setup failed.");
    }

    const workforceSeedResult = spawnSync(process.execPath, ["scripts/seed-demo-workforce.js", `--count=${VERIFY_DEMO_WORKFORCE_COUNT}`], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });

    if (workforceSeedResult.status !== 0) {
      throw new Error("Demo workforce seed failed.");
    }
  }

  const serverSession = await ensureServer(ROOT, {
    baseUrl: VERIFY_BASE_URL,
    timeoutMs: START_TIMEOUT_MS,
  });
  const baseUrl = serverSession.baseUrl;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });

    const entryResult = await verifyLoginAndOpenWorkspace({
      artifactDir: ARTIFACT_DIR,
      baseUrl,
      loginEmail: LOGIN_EMAIL,
      loginPassword: LOGIN_PASSWORD,
      page,
    });
    const dashboardResult = await verifyDashboardPage({
      artifactDir: ARTIFACT_DIR,
      page,
    });
    const scheduleResult = await verifySchedulesPage({
      artifactDir: ARTIFACT_DIR,
      baseUrl,
      companyCode: entryResult.companyCode,
      page,
    });
    const attendanceResult = await verifyAttendancePage({
      artifactDir: ARTIFACT_DIR,
      baseUrl,
      companyCode: entryResult.companyCode,
      page,
    });
    const leaveResult = await verifyLeavePage({
      artifactDir: ARTIFACT_DIR,
      baseUrl,
      companyCode: entryResult.companyCode,
      page,
    });
    const reportsResult = await verifyReportsPage({
      artifactDir: ARTIFACT_DIR,
      baseUrl,
      companyCode: entryResult.companyCode,
      page,
    });

    console.log(JSON.stringify({
      artifacts: {
        attendanceList: attendanceResult.artifacts.attendanceList,
        attendanceMonth: attendanceResult.artifacts.attendanceMonth,
        companies: entryResult.artifacts.companies,
        dashboard: dashboardResult.artifacts.dashboard,
        dashboardStatusGridFilter: dashboardResult.artifacts.dashboardStatusGridFilter,
        dashboardWorkerDetail: dashboardResult.artifacts.dashboardWorkerDetail,
        dashboardWorkingModal: dashboardResult.artifacts.dashboardWorkingModal,
        leaveBalances: leaveResult.artifacts.leaveBalances,
        login: entryResult.artifacts.login,
        reports: reportsResult.artifacts.reports,
        schedulesDay: scheduleResult.artifacts.schedulesDay,
        schedulesMonth: scheduleResult.artifacts.schedulesMonth,
        schedulesWeek: scheduleResult.artifacts.schedulesWeek,
      },
      baseUrl,
      companyCode: entryResult.companyCode || null,
      companiesSidebarFooterCount: entryResult.companiesSidebarFooterCount,
      companiesGhostButtonCount: entryResult.companiesGhostButtonCount,
      companiesTopbarRightState: entryResult.companiesTopbarRightState,
      dashboardGhostButtonCount: dashboardResult.dashboardGhostButtonCount,
      dashboardTopState: dashboardResult.dashboardTopState,
      scheduleGhostButtonCount: scheduleResult.scheduleGhostButtonCount,
      scheduleMonthToolbarState: scheduleResult.scheduleMonthToolbarState,
      scheduleUserFilterTriggerState: scheduleResult.scheduleUserFilterTriggerState,
      scheduleViewModeIconCount: scheduleResult.scheduleViewModeIconCount,
      scheduleWeekHeaders: scheduleResult.scheduleWeekHeaders,
      scheduleWeekFirstCellHeight: scheduleResult.scheduleWeekFirstCellHeight,
      scheduleWeekUserAlignment: scheduleResult.scheduleWeekUserAlignment,
      scheduleDayCornerText: scheduleResult.scheduleDayCornerText,
      scheduleDayTimelineState: scheduleResult.scheduleDayTimelineState,
      topbarAccountName: entryResult.topbarAccountName,
      topbarAccountDisplayName: entryResult.topbarAccountDisplayName,
      workspaceTopbarRightState: dashboardResult.workspaceTopbarRightState,
      workspaceTopbarRole: dashboardResult.workspaceTopbarRole,
      attendanceTitle: attendanceResult.attendanceTitle,
      attendanceAssumeButtonCount: attendanceResult.attendanceAssumeButtonCount,
      attendanceCheckCount: attendanceResult.attendanceCheckCount,
      attendanceFilterButtonCount: attendanceResult.attendanceFilterButtonCount,
      attendanceGhostButtonCount: attendanceResult.attendanceGhostButtonCount,
      attendanceLeaveCellCount: attendanceResult.attendanceLeaveCellCount,
      attendanceViewModeIconCount: attendanceResult.attendanceViewModeIconCount,
      attendanceListDateLabel: attendanceResult.attendanceListDateLabel,
      attendanceListRows: attendanceResult.attendanceListRows,
      attendanceListScrollState: attendanceResult.attendanceListScrollState,
      attendanceListUserNames: attendanceResult.attendanceListUserNames.slice(0, 8),
      attendanceMonthCells: attendanceResult.attendanceMonthCells,
      attendanceMonthFhdScrollState: attendanceResult.attendanceMonthFhdScrollState,
      attendanceMonthRows: attendanceResult.attendanceMonthRows,
      attendanceMonthScrollState: attendanceResult.attendanceMonthScrollState,
      attendanceMonthUserNames: attendanceResult.attendanceMonthUserNames.slice(0, 8),
      attendanceSummaryLineCount: attendanceResult.attendanceSummaryLineCount,
      filteredAttendanceRows: attendanceResult.filteredAttendanceRows,
      filteredLeaveRows: leaveResult.filteredLeaveRows,
      filteredStatusRows: dashboardResult.filteredStatusRows || 0,
      leaveHeaders: leaveResult.leaveHeaders,
      leavePaginationText: leaveResult.leavePaginationText,
      leaveRows: leaveResult.leaveRows,
      filteredScheduleUsers: scheduleResult.filteredScheduleUsers,
      workingModalItems: dashboardResult.workingModalItems,
    }, null, 2));
  } finally {
    await browser?.close();

    if (serverSession.child) {
      serverSession.child.kill();
    }
  }
}

run().catch((error) => {
  console.error("UI verification failed.");
  console.error(error.message || error);
  process.exitCode = 1;
});
