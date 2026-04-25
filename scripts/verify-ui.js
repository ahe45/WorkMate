const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { ensureServer } = require("./lib/test-server");
const { applyEphemeralDatabaseName, loadProjectEnv } = require("./lib/database-targets");

const ROOT = path.join(__dirname, "..");
const ARTIFACT_DIR = path.join(ROOT, "artifacts", "ui-check");
const START_TIMEOUT_MS = 20000;

loadProjectEnv(ROOT);

const VERIFY_BASE_URL = process.env.VERIFY_BASE_URL || "";
const LOGIN_EMAIL = process.env.VERIFY_EMAIL || "admin@workmate.local";
const LOGIN_PASSWORD = process.env.VERIFY_PASSWORD || "Passw0rd!";

if (!VERIFY_BASE_URL) {
  const { databaseName } = applyEphemeralDatabaseName(ROOT, "ui");
  console.log(`Using isolated UI verification database '${databaseName}'.`);
}

function ensureArtifactDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function saveShot(page, name) {
  const target = path.join(ARTIFACT_DIR, name);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function getScheduleEntryToneState(page, selector) {
  const entries = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
    const toneClass = Array.from(node.classList).find((className) => className.startsWith("tone-")) || "";
    const spans = Array.from(node.querySelectorAll("span"));
    const label = (spans.at(-1)?.textContent || node.querySelector("strong")?.textContent || "").trim();

    return {
      compact: node.classList.contains("compact"),
      hasUnifiedClass: node.classList.contains("workmate-schedule-entry"),
      height: Math.round(node.getBoundingClientRect().height),
      label,
      toneClass,
    };
  })).then((items) => items.filter((entry) => entry.label && entry.toneClass));

  const tonesByLabel = entries.reduce((map, entry) => {
    if (!map[entry.label]) {
      map[entry.label] = [];
    }

    if (!map[entry.label].includes(entry.toneClass)) {
      map[entry.label].push(entry.toneClass);
    }

    return map;
  }, {});

  return { entries, tonesByLabel };
}

function assertScheduleEntryToneConsistency(viewName, state, referenceTonesByLabel = {}) {
  const expectedToneByLabel = {
    "내근": "tone-sky",
    "외근": "tone-violet",
    "사업": "tone-salmon",
    "출장": "tone-salmon",
    "재택": "tone-lilac",
    "휴가": "tone-leave",
    "휴일": "tone-holiday",
  };
  const inconsistentLabels = Object.entries(state.tonesByLabel)
    .filter(([, tones]) => tones.length !== 1)
    .map(([label, tones]) => `${label}:${tones.join(",")}`);
  const mismatchedLabels = state.entries
    .filter((entry) => referenceTonesByLabel[entry.label]?.length === 1 && referenceTonesByLabel[entry.label][0] !== entry.toneClass)
    .map((entry) => `${entry.label}:${entry.toneClass}->${referenceTonesByLabel[entry.label][0]}`);
  const unexpectedLabels = state.entries
    .filter((entry) => expectedToneByLabel[entry.label] && expectedToneByLabel[entry.label] !== entry.toneClass)
    .map((entry) => `${entry.label}:${entry.toneClass}->${expectedToneByLabel[entry.label]}`);
  const nonUnifiedEntries = state.entries.filter((entry) => !entry.hasUnifiedClass || !entry.compact);

  if (inconsistentLabels.length > 0 || mismatchedLabels.length > 0 || unexpectedLabels.length > 0 || nonUnifiedEntries.length > 0) {
    throw new Error(`근무일정 ${viewName} 카드 tone/UI가 일관되지 않습니다. inconsistent=${inconsistentLabels.join("|")}, mismatched=${mismatchedLabels.join("|")}, unexpected=${unexpectedLabels.join("|")}, nonUnified=${JSON.stringify(nonUnifiedEntries.slice(0, 3))}`);
  }
}

async function assertScheduleMonthEntriesSortedByName(page) {
  const unsortedCells = await page.locator(".workmate-schedule-month-cell").evaluateAll((cells) => cells
    .map((cell, index) => {
      const names = Array.from(cell.querySelectorAll(".workmate-schedule-entry.compact strong"))
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      const sortedNames = names.slice().sort((left, right) => left.localeCompare(right, "ko"));

      return {
        index,
        names,
        sorted: names.every((name, nameIndex) => name === sortedNames[nameIndex]),
      };
    })
    .filter((cell) => cell.names.length > 1 && !cell.sorted));

  if (unsortedCells.length > 0) {
    throw new Error(`월 단위 근무일정 카드가 직원 이름 오름차순이 아닙니다. cells=${JSON.stringify(unsortedCells.slice(0, 3))}`);
  }
}

async function findCompanyButton(page) {
  const preferred = page.locator('[data-company-open="TEST"]').first();

  if (await preferred.count()) {
    return preferred;
  }

  const seeded = page.locator('[data-company-open="WORKMATE"]').first();

  if (await seeded.count()) {
    return seeded;
  }

  const fallback = page.locator("[data-company-open]").first();

  if (!(await fallback.count())) {
    throw new Error("접속 가능한 워크스페이스 버튼을 찾지 못했습니다.");
  }

  return fallback;
}

async function run() {
  ensureArtifactDir();

  if (!VERIFY_BASE_URL) {
    const setupResult = spawnSync(process.execPath, ["scripts/setup-db.js", "--reset"], {
      cwd: ROOT,
      stdio: "inherit",
    });

    if (setupResult.status !== 0) {
      throw new Error("Database setup failed.");
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

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    const loginShot = await saveShot(page, "login.png");

    await page.fill("#login-email", LOGIN_EMAIL);
    await page.fill("#login-password", LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/companies(?:$|\?)/, { timeout: 15000 });
    await page.waitForSelector(".topbar-right .user-meta", { timeout: 10000 });
    const topbarAccountName = (await page.locator("#currentUserName").first().innerText()).trim();
    const topbarAccountDisplayName = (await page.locator("#currentUserDisplayName").first().innerText()).trim();
    const companiesSidebarRoleCount = await page.locator("#currentUserRole").count();
    const expectedCompaniesAccountEmail = String(LOGIN_EMAIL || "").trim().toLowerCase();
    const companiesSidebarFooterCount = await page.locator(".sidebar-footer").count();
    const companiesTopbarRightState = await page.locator(".topbar-right").first().evaluate((node) => ({
      accountActionsBorderLeft: (() => {
        const accountActions = node.querySelector(".workmate-topbar-account-actions");
        return accountActions ? getComputedStyle(accountActions).borderLeftWidth : "0px";
      })(),
      accountActionsCount: node.querySelectorAll(".workmate-topbar-account-actions").length,
      logoutButtonCount: node.querySelectorAll("#logoutButton.topbar-logout-button").length,
      logoutRightOfMeta: (() => {
        const logout = node.querySelector("#logoutButton.topbar-logout-button");
        const meta = node.querySelector(".user-meta");
        return logout && meta ? meta.getBoundingClientRect().right <= logout.getBoundingClientRect().left : false;
      })(),
      scopeLabel: node.querySelector("#personalScopeToggleLabel")?.textContent.trim() || "",
      scopeLeftOfMeta: (() => {
        const scope = node.querySelector(".workmate-topbar-scope-switch");
        const meta = node.querySelector(".user-meta");
        return scope && meta ? scope.getBoundingClientRect().right <= meta.getBoundingClientRect().left : false;
      })(),
      scopeSwitchCount: node.querySelectorAll("#personalScopeToggle").length,
      userMetaCount: node.querySelectorAll(".user-meta").length,
    }));

    if (
      topbarAccountName !== expectedCompaniesAccountEmail
      || !topbarAccountDisplayName
      || companiesSidebarRoleCount > 0
      || companiesSidebarFooterCount !== 0
      || companiesTopbarRightState.accountActionsCount !== 1
      || companiesTopbarRightState.userMetaCount !== 1
      || companiesTopbarRightState.scopeSwitchCount !== 1
      || companiesTopbarRightState.scopeLabel !== "모두의 일정 보기"
      || !companiesTopbarRightState.scopeLeftOfMeta
      || !companiesTopbarRightState.logoutRightOfMeta
      || companiesTopbarRightState.logoutButtonCount !== 1
      || companiesTopbarRightState.accountActionsBorderLeft === "0px"
    ) {
      throw new Error(`companies topbar 계정정보가 올바르지 않습니다. email=${topbarAccountName}, name=${topbarAccountDisplayName}, roleElementCount=${companiesSidebarRoleCount}, footerCount=${companiesSidebarFooterCount}, topbar=${JSON.stringify(companiesTopbarRightState)}`);
    }

    const companiesShot = await saveShot(page, "companies.png");
    const companiesGhostButtonCount = await page.locator(".ghost-button").count();

    if (companiesGhostButtonCount > 0) {
      throw new Error(`companies 페이지에 ghost-button이 남아 있습니다. count=${companiesGhostButtonCount}`);
    }

    const companyButton = await findCompanyButton(page);
    const companyCode = (await companyButton.getAttribute("data-company-open")) || "";
    await companyButton.click();
    await page.waitForURL(/\/workspace(?:\/|$)/, { timeout: 15000 });
    await page.waitForSelector(".workmate-dashboard-top-stack", { timeout: 15000 });
    await page.waitForSelector("#currentUserRole", { timeout: 10000 });
    const workspaceTopbarRole = (await page.locator("#currentUserRole").first().innerText()).trim();
    const workspaceTopbarRightState = await page.locator(".topbar-right").first().evaluate((node) => ({
      accountActionsBorderLeft: (() => {
        const accountActions = node.querySelector(".workmate-topbar-account-actions");
        return accountActions ? getComputedStyle(accountActions).borderLeftWidth : "0px";
      })(),
      accountActionsCount: node.querySelectorAll(".workmate-topbar-account-actions").length,
      logoutButtonCount: node.querySelectorAll("#logoutButton.topbar-logout-button").length,
      logoutRightOfSwitchCompany: (() => {
        const logout = node.querySelector("#logoutButton.topbar-logout-button");
        const switchCompany = node.querySelector("#switchCompanyButton");
        return logout && switchCompany ? switchCompany.getBoundingClientRect().right <= logout.getBoundingClientRect().left : false;
      })(),
      scopeLabel: node.querySelector("#personalScopeToggleLabel")?.textContent.trim() || "",
      scopeLeftOfMeta: (() => {
        const scope = node.querySelector(".workmate-topbar-scope-switch");
        const meta = node.querySelector(".user-meta");
        return scope && meta ? scope.getBoundingClientRect().right <= meta.getBoundingClientRect().left : false;
      })(),
      scopeSwitchCount: node.querySelectorAll("#personalScopeToggle").length,
      switchCompanyRightOfMeta: (() => {
        const switchCompany = node.querySelector("#switchCompanyButton");
        const meta = node.querySelector(".user-meta");
        return switchCompany && meta ? meta.getBoundingClientRect().right <= switchCompany.getBoundingClientRect().left : false;
      })(),
      switchCompanyButtonCount: node.querySelectorAll("#switchCompanyButton").length,
      userMetaCount: node.querySelectorAll(".user-meta").length,
    }));
    const workspaceSidebarFooterCount = await page.locator(".sidebar-footer").count();
    const dashboardGhostButtonCount = await page.locator(".ghost-button").count();
    const dashboardTopState = await page.evaluate(() => {
      const row = document.querySelector(".workmate-dashboard-summary-row");
      const stack = document.querySelector(".workmate-dashboard-top-stack");
      const statsCard = document.querySelector(".workmate-dashboard-my-stats-card");
      const statusCards = Array.from(document.querySelectorAll(".workmate-dashboard-status-card"));
      const rowRect = row?.getBoundingClientRect();
      const stackRect = stack?.getBoundingClientRect();
      const statsRect = statsCard?.getBoundingClientRect();
      const cardStyles = statusCards.map((card) => {
        const style = getComputedStyle(card);
        return {
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          label: card.querySelector("span")?.textContent.trim() || "",
        };
      });

      return {
        cardLabels: statusCards.map((card) => card.querySelector("span")?.textContent.trim() || ""),
        cardCount: statusCards.length,
        cardStyles,
        hasStatusPanelCard: stack?.classList.contains("panel-card") || false,
        myStatsCardTitle: statsCard?.querySelector("h3")?.textContent.trim() || "",
        myStatsMetricCount: statsCard?.querySelectorAll(".workmate-dashboard-my-stats-grid > div").length || 0,
        myStatsProgressText: statsCard?.querySelector(".workmate-dashboard-my-stats-progress strong")?.textContent.trim() || "",
        rowWidth: Math.round(rowRect?.width || 0),
        stackColumnCount: stack ? getComputedStyle(stack).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
        stackLeft: Math.round(stackRect?.left || 0),
        stackTitle: stack?.querySelector(".workmate-dashboard-status-panel-head h3")?.textContent.trim() || "",
        stackWidth: Math.round(stackRect?.width || 0),
        statsLeft: Math.round(statsRect?.left || 0),
      };
    });

    if (
      !workspaceTopbarRole
      || workspaceTopbarRole === "권한 정보 없음"
      || workspaceSidebarFooterCount !== 0
      || workspaceTopbarRightState.accountActionsCount !== 1
      || workspaceTopbarRightState.userMetaCount !== 1
      || workspaceTopbarRightState.scopeSwitchCount !== 1
      || workspaceTopbarRightState.scopeLabel !== "모두의 일정 보기"
      || !workspaceTopbarRightState.scopeLeftOfMeta
      || !workspaceTopbarRightState.switchCompanyRightOfMeta
      || workspaceTopbarRightState.switchCompanyButtonCount !== 1
      || workspaceTopbarRightState.logoutButtonCount !== 1
      || !workspaceTopbarRightState.logoutRightOfSwitchCompany
      || workspaceTopbarRightState.accountActionsBorderLeft === "0px"
      || dashboardGhostButtonCount > 0
      || dashboardTopState.cardCount !== 4
      || dashboardTopState.cardLabels.includes("외근/재택")
      || dashboardTopState.cardStyles.some((style) => style.backgroundImage === "none" || style.boxShadow === "none")
      || new Set(dashboardTopState.cardStyles.map((style) => style.backgroundImage)).size < 3
      || !dashboardTopState.hasStatusPanelCard
      || dashboardTopState.stackTitle !== "근무 현황"
      || dashboardTopState.stackColumnCount !== 2
      || dashboardTopState.stackWidth > Math.ceil(dashboardTopState.rowWidth * 0.52)
      || dashboardTopState.statsLeft <= dashboardTopState.stackLeft
      || dashboardTopState.myStatsCardTitle !== "내 근로 통계"
      || dashboardTopState.myStatsMetricCount !== 4
      || !dashboardTopState.myStatsProgressText.endsWith("%")
    ) {
      throw new Error(`workspace topbar, 대시보드 상단 카드 또는 버튼 분류가 올바르지 않습니다. role=${workspaceTopbarRole}, footerCount=${workspaceSidebarFooterCount}, topbar=${JSON.stringify(workspaceTopbarRightState)}, ghostButtons=${dashboardGhostButtonCount}, top=${JSON.stringify(dashboardTopState)}`);
    }

    const dashboardShot = await saveShot(page, "dashboard.png");
    const dashboardHeaders = await page.locator(".workmate-dashboard-grid-card thead th").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim().replace(/\s+/g, " ")));

    if (dashboardHeaders.slice(0, 3).some((header, index) => !header.includes(["이름", "사번", "조직"][index]))) {
      throw new Error(`대시보드 그리드 기본 컬럼 순서가 올바르지 않습니다. headers=${dashboardHeaders.join("|")}`);
    }

    const dashboardAllScopeRows = await page.locator(".workmate-dashboard-grid-card tbody tr:not(.table-empty-row)").count();
    await page.locator("#personalScopeToggle").check({ force: true });
    await page.waitForFunction(() => document.querySelector("#personalScopeToggleLabel")?.textContent.trim() === "나의 일정만 보기");
    await page.waitForTimeout(200);
    const dashboardPersonalScopeRows = await page.locator(".workmate-dashboard-grid-card tbody tr:not(.table-empty-row)").count();
    const personalScopeLabel = (await page.locator("#personalScopeToggleLabel").first().innerText()).trim();
    await page.locator("#personalScopeToggle").uncheck({ force: true });
    await page.waitForFunction(() => document.querySelector("#personalScopeToggleLabel")?.textContent.trim() === "모두의 일정 보기");
    await page.waitForTimeout(200);
    const dashboardRestoredScopeRows = await page.locator(".workmate-dashboard-grid-card tbody tr:not(.table-empty-row)").count();

    if (
      personalScopeLabel !== "나의 일정만 보기"
      || dashboardAllScopeRows < 2
      || dashboardPersonalScopeRows > 1
      || dashboardRestoredScopeRows !== dashboardAllScopeRows
    ) {
      throw new Error(`개인 일정 보기 스위치가 올바르게 작동하지 않습니다. all=${dashboardAllScopeRows}, personal=${dashboardPersonalScopeRows}, restored=${dashboardRestoredScopeRows}, label=${personalScopeLabel}`);
    }

    const workingCard = page.locator('[data-dashboard-summary-open="working"]').first();
    await workingCard.click();
    await page.waitForSelector("#dashboard-summary-modal", { timeout: 10000 });
    const workingModalShot = await saveShot(page, "dashboard-working-modal.png");
    const workingModalItems = await page.locator(".workmate-dashboard-summary-list .mini-item").count();
    await page.locator('button[data-dashboard-summary-close="true"]').first().click();
    await page.waitForTimeout(200);

    const statusFilterButton = page.locator('[data-dashboard-grid-filter-open="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"]').first();
    await statusFilterButton.click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { timeout: 10000 });
    await page.locator('[data-dashboard-grid-filter-select-all="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"]').first().uncheck({ force: true });
    await page.locator('[data-dashboard-grid-filter-option-input="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"][data-dashboard-grid-value="출근"]').first().check({ force: true });
    await page.locator('.workmate-dashboard-filter-menu .table-filter-footer-button[data-dashboard-grid-filter-close="true"]').first().click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { state: "detached", timeout: 10000 });
    await page.waitForTimeout(300);
    const filteredShot = await saveShot(page, "dashboard-status-grid-filter.png");
    const visibleRows = await page.locator(".workmate-dashboard-table-panel").first().locator("tbody tr").count();

    const detailButton = page.locator("[data-dashboard-detail-open]").first();
    await detailButton.click();
    await page.waitForSelector("#dashboard-detail-modal", { timeout: 10000 });
    const detailShot = await saveShot(page, "dashboard-worker-detail.png");
    await page.locator('button[data-dashboard-detail-close="true"]').first().click();
    await page.waitForTimeout(200);

    await page.goto(`${baseUrl}/companies/${companyCode}/workspace/schedules`, { waitUntil: "networkidle" });
    await page.waitForSelector(".workmate-schedule-shell", { timeout: 15000 });
    const scheduleGhostButtonCount = await page.locator(".ghost-button").count();

    if (scheduleGhostButtonCount > 0) {
      throw new Error(`근무일정 페이지에 ghost-button이 남아 있습니다. count=${scheduleGhostButtonCount}`);
    }

    const scheduleMonthShot = await saveShot(page, "schedules-month.png");
    const scheduleMonthEntryToneState = await getScheduleEntryToneState(page, ".workmate-schedule-entry.compact");
    assertScheduleEntryToneConsistency("월 단위", scheduleMonthEntryToneState);
    await assertScheduleMonthEntriesSortedByName(page);
    const scheduleMonthTodayButtonText = (await page.locator('[data-schedule-nav="today"]').first().innerText()).trim();
    const scheduleViewModeIconCount = await page.locator("[data-schedule-mode] .button-icon").count();
    const scheduleUserFilterTriggerState = await page.locator("[data-schedule-user-filter-toggle='true']").first().evaluate((node) => {
      const label = node.querySelector("strong");
      return {
        labelText: label?.textContent.trim() || "",
        labelWidth: Math.round(label?.getBoundingClientRect().width || 0),
        triggerWidth: Math.round(node.getBoundingClientRect().width),
      };
    });
    const scheduleMonthToolbarState = await page.evaluate(() => {
      const allButton = document.querySelector('[data-schedule-month-all="true"]');
      const filterGroup = document.querySelector(".workmate-schedule-filter-group");

      if (!allButton || !filterGroup) {
        return null;
      }

      const allRect = allButton.getBoundingClientRect();
      const filterRect = filterGroup.getBoundingClientRect();

      return {
        allButtonText: allButton.textContent.trim(),
        allButtonRight: Math.round(allRect.right),
        filterLeft: Math.round(filterRect.left),
        isAllButtonLeftOfFilter: allRect.right <= filterRect.left,
      };
    });

    if (
      !scheduleMonthToolbarState?.isAllButtonLeftOfFilter
      || scheduleMonthTodayButtonText !== "이번달"
      || scheduleViewModeIconCount !== 3
      || scheduleUserFilterTriggerState.labelText !== "전체 선택"
      || scheduleUserFilterTriggerState.triggerWidth > 128
      || scheduleUserFilterTriggerState.triggerWidth <= scheduleUserFilterTriggerState.labelWidth
    ) {
      throw new Error(`근무일정 툴바가 올바르지 않습니다. state=${JSON.stringify(scheduleMonthToolbarState)}, today=${scheduleMonthTodayButtonText}, icons=${scheduleViewModeIconCount}, filter=${JSON.stringify(scheduleUserFilterTriggerState)}`);
    }

    await page.locator('[data-schedule-mode="week"]').first().click();
    await page.waitForSelector(".workmate-schedule-week-board", { timeout: 15000 });
    const scheduleWeekShot = await saveShot(page, "schedules-week.png");
    const scheduleWeekTodayButtonText = (await page.locator('[data-schedule-nav="today"]').first().innerText()).trim();
    const scheduleWeekEntryToneState = await getScheduleEntryToneState(page, ".workmate-schedule-week-cell .workmate-schedule-entry.compact");
    assertScheduleEntryToneConsistency("주 단위", scheduleWeekEntryToneState, scheduleMonthEntryToneState.tonesByLabel);
    const firstScheduleUser = (await page.locator(".workmate-schedule-week-user strong").first().innerText()).trim();
    const scheduleWeekHeaders = await page.locator(".workmate-schedule-week-head:not(.sticky-user) strong").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
    const scheduleWeekFirstCellHeight = await page.locator(".workmate-schedule-week-cell").first().evaluate((node) => Math.round(node.getBoundingClientRect().height));
    const scheduleWeekUserAlignment = await page.locator(".workmate-schedule-week-user").first().evaluate((node) => ({
      justifyItems: getComputedStyle(node).justifyItems,
      textAlign: getComputedStyle(node).textAlign,
    }));

    if (
      scheduleWeekHeaders.length !== 7
      || scheduleWeekTodayButtonText !== "이번주"
      || !scheduleWeekHeaders.every((text) => /^\d{1,2}일\([일월화수목금토]\)$/.test(text))
      || scheduleWeekHeaders.map((text) => text.match(/\((.)\)$/)?.[1] || "").join("|") !== "일|월|화|수|목|금|토"
      || scheduleWeekFirstCellHeight > 72
      || scheduleWeekUserAlignment.justifyItems !== "center"
      || scheduleWeekUserAlignment.textAlign !== "center"
    ) {
      throw new Error(`근무일정 주 단위 표시가 올바르지 않습니다. today=${scheduleWeekTodayButtonText}, headers=${scheduleWeekHeaders.join(",")}, cellHeight=${scheduleWeekFirstCellHeight}, alignment=${JSON.stringify(scheduleWeekUserAlignment)}`);
    }

    await page.locator('[data-schedule-user-filter-toggle="true"]').first().click();
    await page.waitForSelector(".workmate-schedule-user-filter-menu", { timeout: 10000 });
    await page.locator('[data-schedule-user-filter-select-all="true"]').first().uncheck({ force: true });
    await page.locator(".workmate-schedule-user-filter-option").filter({ hasText: firstScheduleUser }).first().locator('[data-schedule-user-filter-option-input="true"]').check({ force: true });
    await page.locator('.workmate-schedule-user-filter-menu .table-filter-footer-button[data-schedule-user-filter-close="true"]').first().click();
    await page.waitForTimeout(250);
    const filteredScheduleUsers = await page.locator(".workmate-schedule-week-user strong").count();

    await page.locator('[data-schedule-user-filter-toggle="true"]').first().click();
    await page.waitForSelector(".workmate-schedule-user-filter-menu", { timeout: 10000 });
    await page.locator('[data-schedule-user-filter-select-all="true"]').first().check({ force: true });
    await page.locator('.workmate-schedule-user-filter-menu .table-filter-footer-button[data-schedule-user-filter-close="true"]').first().click();
    await page.waitForTimeout(250);

    await page.locator('[data-schedule-mode="day"]').first().click();
    await page.waitForSelector(".workmate-schedule-day-board", { timeout: 15000 });
    const scheduleDayShot = await saveShot(page, "schedules-day.png");
    const scheduleDayTodayButtonText = (await page.locator('[data-schedule-nav="today"]').first().innerText()).trim();
    const scheduleDayEntryToneState = await getScheduleEntryToneState(page, ".workmate-schedule-timeline-entry.workmate-schedule-entry.compact");
    assertScheduleEntryToneConsistency("일 단위", scheduleDayEntryToneState, scheduleMonthEntryToneState.tonesByLabel);
    const scheduleDayCornerText = (await page.locator(".workmate-schedule-day-corner strong").first().innerText()).trim();
    const scheduleDayUserMetaCount = await page.locator(".workmate-schedule-day-user span").count();
    const scheduleDayFirstUserText = (await page.locator(".workmate-schedule-day-user").first().innerText()).trim();
    const scheduleDayFirstUserMetaText = (await page.locator(".workmate-schedule-day-user span").first().innerText()).trim();
    const scheduleDayTimelineState = await page.evaluate(() => {
      const shiftEntry = document.querySelector(".workmate-schedule-timeline-entry:not(.is-full-row)");
      const leaveEntry = document.querySelector(".workmate-schedule-timeline-entry.is-full-row");

      return {
        cornerAlignment: {
          justifyItems: getComputedStyle(document.querySelector(".workmate-schedule-day-corner")).justifyItems,
          textAlign: getComputedStyle(document.querySelector(".workmate-schedule-day-corner")).textAlign,
        },
        firstTrackHeight: Math.round(document.querySelector(".workmate-schedule-day-track")?.getBoundingClientRect().height || 0),
        firstUserLines: (document.querySelector(".workmate-schedule-day-user")?.innerText || "").split(/\n+/).filter(Boolean),
        firstUserAlignment: {
          justifyItems: getComputedStyle(document.querySelector(".workmate-schedule-day-user")).justifyItems,
          textAlign: getComputedStyle(document.querySelector(".workmate-schedule-day-user")).textAlign,
        },
        leaveGridColumnEnd: leaveEntry ? getComputedStyle(leaveEntry).gridColumnEnd : "",
        leaveGridColumnStart: leaveEntry ? getComputedStyle(leaveEntry).gridColumnStart : "",
        leaveHasUnifiedEntryClass: leaveEntry ? leaveEntry.classList.contains("workmate-schedule-entry") : false,
        leaveText: leaveEntry?.textContent.trim().replace(/\s+/g, " ") || "",
        shiftDisplay: shiftEntry ? getComputedStyle(shiftEntry).display : "",
        shiftHasUnifiedEntryClass: shiftEntry ? shiftEntry.classList.contains("workmate-schedule-entry") : false,
        shiftStrong: shiftEntry?.querySelector("strong")?.textContent.trim() || "",
        shiftText: shiftEntry?.textContent.trim() || "",
        shiftSpan: shiftEntry?.querySelector("span")?.textContent.trim() || "",
      };
    });

    if (
      scheduleDayCornerText !== "직원"
      || scheduleDayTodayButtonText !== "오늘"
      || scheduleDayUserMetaCount < 1
      || scheduleDayFirstUserText.split(/\n+/).filter(Boolean).length !== 2
      || !/^[A-Z0-9-]+ · [\d,]+h$/.test(scheduleDayFirstUserMetaText)
      || scheduleDayTimelineState.cornerAlignment.justifyItems !== "center"
      || scheduleDayTimelineState.cornerAlignment.textAlign !== "center"
      || scheduleDayTimelineState.firstUserAlignment.justifyItems !== "center"
      || scheduleDayTimelineState.firstUserAlignment.textAlign !== "center"
      || scheduleDayTimelineState.firstTrackHeight > 60
      || scheduleDayTimelineState.shiftDisplay !== "flex"
      || !scheduleDayTimelineState.shiftHasUnifiedEntryClass
      || !/^\d{2}:\d{2}\s-\s\d{2}:\d{2}$/.test(scheduleDayTimelineState.shiftStrong)
      || !scheduleDayTimelineState.shiftSpan
      || scheduleDayTimelineState.shiftSpan.includes("·")
      || scheduleDayTimelineState.leaveText !== "휴가"
      || !scheduleDayTimelineState.leaveHasUnifiedEntryClass
      || scheduleDayTimelineState.leaveGridColumnStart !== "1"
      || scheduleDayTimelineState.leaveGridColumnEnd !== "-1"
    ) {
      throw new Error(`근무일정 일 단위 표시가 올바르지 않습니다. today=${scheduleDayTodayButtonText}, corner=${scheduleDayCornerText}, metaCount=${scheduleDayUserMetaCount}, firstUser=${scheduleDayFirstUserText}, firstUserMeta=${scheduleDayFirstUserMetaText}, timeline=${JSON.stringify(scheduleDayTimelineState)}`);
    }

    await page.goto(`${baseUrl}/companies/${companyCode}/workspace/attendance`, { waitUntil: "networkidle" });
    await page.waitForSelector(".workmate-attendance-month-board", { timeout: 15000 });
    const attendanceTitle = (await page.locator("#topbarPageTitle").first().innerText()).trim();
    const attendanceMonthShot = await saveShot(page, "attendance-month.png");
    const attendanceMonthRows = await page.locator(".workmate-attendance-user-cell").count();
    const attendanceMonthCells = await page.locator(".workmate-attendance-month-cell.has-record").count();
    const attendanceFilterButtonCount = await page.locator(".workmate-attendance-filter-button").count();
    const attendanceAssumeButtonCount = await page.locator(".workmate-attendance-assume-button").count();
    const attendanceCheckCount = await page.locator(".workmate-attendance-check").count();
    const attendanceGhostButtonCount = await page.locator(".ghost-button").count();
    const attendanceViewModeIconCount = await page.locator("[data-attendance-mode] .button-icon").count();
    const attendanceSummaryLineCount = await page.locator(".workmate-attendance-summary-line").count();
    const attendanceLeaveCellCount = await page.locator(".workmate-attendance-month-cell").filter({ hasText: "휴가" }).count();
    const attendanceMonthUserNames = await page.locator(".workmate-attendance-user-cell strong").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
    const attendanceMonthUserNamesSorted = attendanceMonthUserNames.slice().sort((left, right) => left.localeCompare(right, "ko"));
    const attendanceMonthScrollState = await page.evaluate(() => {
      const scroll = document.querySelector(".workmate-attendance-month-scroll");

      if (!scroll) {
        return null;
      }

      scroll.scrollTop = 240;
      scroll.scrollLeft = 240;

      return {
        clientHeight: scroll.clientHeight,
        clientWidth: scroll.clientWidth,
        scrollHeight: scroll.scrollHeight,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
        scrollWidth: scroll.scrollWidth,
      };
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(100);
    const attendanceMonthFhdScrollState = await page.evaluate(() => {
      const scroll = document.querySelector(".workmate-attendance-month-scroll");
      const headers = Array.from(document.querySelectorAll(".workmate-attendance-month-head"));
      const employeeHeader = headers[0] || null;
      const firstDateHeader = headers[1] || null;

      if (!scroll) {
        return null;
      }

      scroll.scrollLeft = 240;

      return {
        clientWidth: scroll.clientWidth,
        employeeColumnWidth: employeeHeader ? Math.round(employeeHeader.getBoundingClientRect().width) : 0,
        firstDateColumnWidth: firstDateHeader ? Math.round(firstDateHeader.getBoundingClientRect().width) : 0,
        scrollLeft: scroll.scrollLeft,
        scrollWidth: scroll.scrollWidth,
      };
    });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.waitForTimeout(100);

    if (
      attendanceTitle !== "출퇴근기록"
      || attendanceFilterButtonCount !== 0
      || attendanceAssumeButtonCount !== 0
      || attendanceCheckCount !== 0
      || attendanceGhostButtonCount > 0
      || attendanceViewModeIconCount !== 2
      || attendanceSummaryLineCount !== 0
      || attendanceLeaveCellCount < 1
      || attendanceMonthRows < 1
      || attendanceMonthCells < 1
      || attendanceMonthUserNames.join("|") !== attendanceMonthUserNamesSorted.join("|")
      || !attendanceMonthScrollState
      || attendanceMonthScrollState.scrollHeight <= attendanceMonthScrollState.clientHeight
      || attendanceMonthScrollState.scrollTop <= 0
      || !attendanceMonthFhdScrollState
      || attendanceMonthFhdScrollState.scrollWidth > attendanceMonthFhdScrollState.clientWidth + 1
      || attendanceMonthFhdScrollState.scrollLeft > 0
      || attendanceMonthFhdScrollState.employeeColumnWidth > 70
      || attendanceMonthFhdScrollState.firstDateColumnWidth < 45
    ) {
      throw new Error(`출퇴근 달력형 데이터, 버튼, 아이콘, 요약 라인, 휴가 표시, 정렬 또는 스크롤이 올바르지 않습니다. title=${attendanceTitle}, filterButtons=${attendanceFilterButtonCount}, assumeButtons=${attendanceAssumeButtonCount}, checks=${attendanceCheckCount}, ghostButtons=${attendanceGhostButtonCount}, icons=${attendanceViewModeIconCount}, summaryLines=${attendanceSummaryLineCount}, leaveCells=${attendanceLeaveCellCount}, rows=${attendanceMonthRows}, cells=${attendanceMonthCells}, names=${attendanceMonthUserNames.slice(0, 8).join(",")}, scroll=${JSON.stringify(attendanceMonthScrollState)}, fhdScroll=${JSON.stringify(attendanceMonthFhdScrollState)}`);
    }

    await page.locator('[data-attendance-mode="list"]').first().click();
    await page.waitForSelector(".workmate-attendance-grid-card .table-wrap", { timeout: 15000 });
    const attendanceListShot = await saveShot(page, "attendance-list.png");
    const attendanceListRows = await page.locator(".workmate-attendance-grid-card tbody tr").count();
    const attendanceListDateLabel = (await page.locator(".workmate-attendance-toolbar .workmate-schedule-nav strong").first().innerText()).trim();
    const attendanceListUserNames = await page.locator(".workmate-attendance-grid-card tbody tr td:nth-child(2) strong").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
    const attendanceListUserNamesSorted = attendanceListUserNames.slice().sort((left, right) => left.localeCompare(right, "ko"));
    const attendanceListScrollState = await page.evaluate(() => {
      const scroll = document.querySelector(".workmate-attendance-grid-card .table-wrap");

      if (!scroll) {
        return null;
      }

      scroll.scrollTop = 240;
      scroll.scrollLeft = 240;

      return {
        clientHeight: scroll.clientHeight,
        clientWidth: scroll.clientWidth,
        scrollHeight: scroll.scrollHeight,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
        scrollWidth: scroll.scrollWidth,
      };
    });

    if (
      attendanceListRows < 1
      || attendanceListDateLabel.includes(" - ")
      || attendanceListUserNames.join("|") !== attendanceListUserNamesSorted.join("|")
      || !attendanceListScrollState
      || attendanceListScrollState.scrollWidth <= attendanceListScrollState.clientWidth
      || attendanceListScrollState.scrollLeft <= 0
    ) {
      throw new Error(`출퇴근 목록형 표시, 정렬 또는 스크롤이 올바르지 않습니다. rows=${attendanceListRows}, label=${attendanceListDateLabel}, names=${attendanceListUserNames.slice(0, 8).join(",")}, scroll=${JSON.stringify(attendanceListScrollState)}`);
    }

    await page.locator('[data-dashboard-grid-filter-open="true"][data-dashboard-grid-table="attendanceRecords"][data-dashboard-grid-column="statusLabel"]').first().click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { timeout: 10000 });
    await page.locator('[data-dashboard-grid-filter-search-input="true"]').fill("출근");
    await page.locator('.workmate-dashboard-filter-menu .table-filter-footer-button[data-dashboard-grid-filter-close="true"]').first().click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { state: "detached", timeout: 10000 });
    await page.waitForTimeout(250);
    const filteredAttendanceRows = await page.locator(".workmate-attendance-grid-card tbody tr").count();

    if (filteredAttendanceRows < 1) {
      throw new Error("출퇴근 목록형 그리드 필터 적용 후 표시할 행이 없습니다.");
    }

    await page.goto(`${baseUrl}/companies/${companyCode}/workspace/leave`, { waitUntil: "networkidle" });
    await page.waitForSelector(".workmate-leave-grid-card .table-wrap", { timeout: 15000 });
    const leaveShot = await saveShot(page, "leave-balances.png");
    const leaveTitle = (await page.locator("#topbarPageTitle").first().innerText()).trim();
    const leaveActiveNavText = (await page.locator('.nav-item.active[data-view="leave"]').first().innerText()).trim();
    const leaveRows = await page.locator(".workmate-leave-grid-card tbody tr").count();
    const leaveMetricCards = await page.locator(".metric-card").count();
    const leaveGhostButtonCount = await page.locator(".ghost-button").count();
    const leaveHeaders = await page.locator(".workmate-leave-grid-card thead th").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim().replace(/\s+/g, " ")));
    const leavePaginationText = (await page.locator(".workmate-leave-grid-card .table-pagination-summary").first().innerText()).trim();
    const leaveUserNames = await page.locator(".workmate-leave-grid-card tbody tr td:first-child strong").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
    const leaveUserNamesSorted = leaveUserNames.slice().sort((left, right) => left.localeCompare(right, "ko"));
    const leaveFirstOrg = (await page.locator(".workmate-leave-grid-card tbody tr td:nth-child(3)").first().innerText()).trim();

    if (
      leaveTitle !== "휴가현황"
      || !leaveActiveNavText.includes("휴가현황")
      || leaveRows !== 20
      || leaveMetricCards < 4
      || leaveGhostButtonCount > 0
      || !leavePaginationText.includes("총 50건")
      || leaveUserNames.join("|") !== leaveUserNamesSorted.join("|")
      || leaveHeaders.slice(0, 3).some((header, index) => !header.includes(["이름", "사번", "조직"][index]))
      || !leaveHeaders.some((header) => header.includes("전체 휴가 보유"))
      || !leaveHeaders.some((header) => header.includes("연차휴가 보유"))
      || !leaveHeaders.some((header) => header.includes("보상휴가 보유"))
      || !leaveHeaders.some((header) => header.includes("기타휴가 보유"))
      || leaveHeaders.some((header) => header.includes("사용") || header.includes("상태"))
    ) {
      throw new Error(`휴가 현황 그리드가 올바르지 않습니다. title=${leaveTitle}, nav=${leaveActiveNavText}, rows=${leaveRows}, metrics=${leaveMetricCards}, ghost=${leaveGhostButtonCount}, pagination=${leavePaginationText}, headers=${leaveHeaders.join("|")}, names=${leaveUserNames.slice(0, 8).join(",")}`);
    }

    await page.locator('[data-dashboard-grid-filter-open="true"][data-dashboard-grid-table="leaveBalances"][data-dashboard-grid-column="primaryUnitName"]').first().click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { timeout: 10000 });
    await page.locator('[data-dashboard-grid-filter-select-all="true"][data-dashboard-grid-table="leaveBalances"][data-dashboard-grid-column="primaryUnitName"]').first().uncheck({ force: true });
    await page.locator(".workmate-dashboard-filter-menu .table-filter-option").filter({ hasText: leaveFirstOrg }).first().locator('[data-dashboard-grid-filter-option-input="true"][data-dashboard-grid-table="leaveBalances"][data-dashboard-grid-column="primaryUnitName"]').check({ force: true });
    await page.locator('.workmate-dashboard-filter-menu .table-filter-footer-button[data-dashboard-grid-filter-close="true"]').first().click();
    await page.waitForSelector(".workmate-dashboard-filter-menu", { state: "detached", timeout: 10000 });
    await page.waitForTimeout(250);
    const filteredLeaveRows = await page.locator(".workmate-leave-grid-card tbody tr").count();

    if (filteredLeaveRows < 1) {
      throw new Error(`휴가 현황 조직 필터 적용 후 표시할 행이 없습니다. org=${leaveFirstOrg}`);
    }

    await page.goto(`${baseUrl}/companies/${companyCode}/workspace/reports`, { waitUntil: "networkidle" });
    await page.waitForSelector(".workmate-report-shell .table-wrap", { timeout: 15000 });
    const reportsShot = await saveShot(page, "reports.png");
    const reportTitle = (await page.locator("#topbarPageTitle").first().innerText()).trim();
    const reportActiveNavText = (await page.locator('.nav-item.active[data-view="reports"]').first().innerText()).trim();
    const requestNavCount = await page.locator('.nav-item[data-view="requests"]').count();
    const reportGhostButtonCount = await page.locator(".ghost-button").count();
    const reportToolbarButtonCount = await page.locator(".workmate-report-toolbar button").count();
    const reportSummaryGridCount = await page.locator(".workmate-report-summary-grid").count();
    const reportInactiveButtonCount = await page.locator(".workmate-report-download-button, .workmate-report-icon-button, .workmate-report-filter-button, .workmate-report-select-button, .workmate-report-filter-chip").count();
    const reportRangeText = (await page.locator(".workmate-report-range-control strong").first().innerText()).trim();
    const reportRows = await page.locator(".workmate-report-grid-panel tbody tr").count();
    const reportHeaders = await page.locator(".workmate-report-grid-panel thead th").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim().replace(/\s+/g, " ")));
    const reportPaginationText = (await page.locator(".workmate-report-grid-panel .table-pagination-summary").first().innerText()).trim();

    if (
      reportTitle !== "리포트"
      || !reportActiveNavText.includes("리포트")
      || requestNavCount !== 0
      || reportGhostButtonCount > 0
      || reportToolbarButtonCount !== 2
      || reportSummaryGridCount !== 0
      || reportInactiveButtonCount !== 0
      || reportRangeText !== "2026.04.01 - 2026.04.30"
      || reportRows !== 20
      || !reportPaginationText.includes("총 50건")
      || !reportHeaders.some((header) => header.includes("사원번호"))
      || !reportHeaders.some((header) => header.includes("조직"))
      || reportHeaders.some((header) => header.includes("본조직"))
      || !reportHeaders.some((header) => header.includes("소정근무일수"))
      || !reportHeaders.some((header) => header.includes("유급시간"))
      || !reportHeaders.some((header) => header.includes("연장근로시간"))
      || reportHeaders.some((header) => header.includes("실제 "))
      || reportHeaders.some((header) => header.includes("승인된"))
      || reportHeaders.some((header) => header.includes("주의"))
    ) {
      throw new Error(`리포트 화면이 올바르지 않습니다. title=${reportTitle}, nav=${reportActiveNavText}, requests=${requestNavCount}, ghost=${reportGhostButtonCount}, toolbarButtons=${reportToolbarButtonCount}, summary=${reportSummaryGridCount}, inactiveButtons=${reportInactiveButtonCount}, range=${reportRangeText}, rows=${reportRows}, pagination=${reportPaginationText}, headers=${reportHeaders.join("|")}`);
    }

    await page.locator('[data-report-nav="next"]').first().click();
    await page.waitForSelector(".workmate-report-shell .table-wrap", { timeout: 15000 });
    const mayReportRangeText = (await page.locator(".workmate-report-range-control strong").first().innerText()).trim();
    const mayReportRows = await page.locator(".workmate-report-grid-panel tbody tr").count();

    if (mayReportRangeText !== "2026.05.01 - 2026.05.31" || mayReportRows !== 20) {
      throw new Error(`5월 리포트 데이터가 올바르지 않습니다. range=${mayReportRangeText}, rows=${mayReportRows}`);
    }

    console.log(JSON.stringify({
      artifacts: {
        attendanceList: attendanceListShot,
        attendanceMonth: attendanceMonthShot,
        companies: companiesShot,
        dashboard: dashboardShot,
        dashboardStatusGridFilter: filteredShot,
        dashboardWorkerDetail: detailShot,
        dashboardWorkingModal: workingModalShot,
        leaveBalances: leaveShot,
        login: loginShot,
        reports: reportsShot,
        schedulesDay: scheduleDayShot,
        schedulesMonth: scheduleMonthShot,
        schedulesWeek: scheduleWeekShot,
      },
      baseUrl,
      companyCode: companyCode || null,
      companiesSidebarFooterCount,
      companiesGhostButtonCount,
      companiesTopbarRightState,
      dashboardGhostButtonCount,
      dashboardTopState,
      scheduleGhostButtonCount,
      scheduleMonthToolbarState,
      scheduleUserFilterTriggerState,
      scheduleViewModeIconCount,
      scheduleWeekHeaders,
      scheduleWeekFirstCellHeight,
      scheduleWeekUserAlignment,
      scheduleDayCornerText,
      scheduleDayTimelineState,
      topbarAccountName,
      topbarAccountDisplayName,
      workspaceTopbarRightState,
      workspaceTopbarRole,
      attendanceTitle,
      attendanceAssumeButtonCount,
      attendanceCheckCount,
      attendanceFilterButtonCount,
      attendanceGhostButtonCount,
      attendanceLeaveCellCount,
      attendanceViewModeIconCount,
      attendanceListDateLabel,
      attendanceListRows,
      attendanceListScrollState,
      attendanceListUserNames: attendanceListUserNames.slice(0, 8),
      attendanceMonthCells,
      attendanceMonthFhdScrollState,
      attendanceMonthRows,
      attendanceMonthScrollState,
      attendanceMonthUserNames: attendanceMonthUserNames.slice(0, 8),
      attendanceSummaryLineCount,
      filteredAttendanceRows,
      filteredLeaveRows,
      filteredStatusRows: visibleRows || 0,
      leaveHeaders,
      leavePaginationText,
      leaveRows,
      filteredScheduleUsers,
      workingModalItems,
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
