const { saveShot } = require("./ui-verification-helpers");

async function verifyDashboardPage({
  artifactDir,
  page,
}) {
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

  const dashboardShot = await saveShot(page, artifactDir, "dashboard.png");
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
  const workingModalShot = await saveShot(page, artifactDir, "dashboard-working-modal.png");
  const workingModalItems = await page.locator(".workmate-dashboard-summary-list .mini-item").count();
  await page.locator('button[data-dashboard-summary-close="true"]').first().click();
  await page.waitForTimeout(200);

  const statusFilterButton = page.locator('[data-dashboard-grid-filter-open="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"]').first();
  await statusFilterButton.click();
  await page.waitForSelector(".workmate-dashboard-filter-menu", { timeout: 10000 });
  await page.locator('[data-dashboard-grid-filter-select-all="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"]').first().uncheck({ force: true });
  const statusFilterOptions = page.locator('[data-dashboard-grid-filter-option-input="true"][data-dashboard-grid-table="overview"][data-dashboard-grid-column="workStatusLabel"]');
  const statusFilterOptionState = await statusFilterOptions.evaluateAll((nodes) => nodes.map((node, index) => ({
    index,
    value: node.getAttribute("data-dashboard-grid-value") || "",
  })).filter((item) => item.value));
  const targetStatusFilterOption = statusFilterOptionState.find((item) => item.value === "출근") || statusFilterOptionState[0];

  if (!targetStatusFilterOption) {
    throw new Error("대시보드 상태 필터에서 선택할 수 있는 옵션을 찾지 못했습니다.");
  }

  await statusFilterOptions.nth(targetStatusFilterOption.index).check({ force: true });
  await page.locator('.workmate-dashboard-filter-menu .table-filter-footer-button[data-dashboard-grid-filter-close="true"]').first().click();
  await page.waitForSelector(".workmate-dashboard-filter-menu", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(300);
  const filteredShot = await saveShot(page, artifactDir, "dashboard-status-grid-filter.png");
  const filteredStatusRows = await page.locator(".workmate-dashboard-table-panel").first().locator("tbody tr").count();

  const detailButton = page.locator("[data-dashboard-detail-open]").first();
  await detailButton.click();
  await page.waitForSelector("#dashboard-detail-modal", { timeout: 10000 });
  const detailShot = await saveShot(page, artifactDir, "dashboard-worker-detail.png");
  await page.locator('button[data-dashboard-detail-close="true"]').first().click();
  await page.waitForTimeout(200);

  return {
    artifacts: {
      dashboard: dashboardShot,
      dashboardStatusGridFilter: filteredShot,
      dashboardWorkerDetail: detailShot,
      dashboardWorkingModal: workingModalShot,
    },
    dashboardGhostButtonCount,
    dashboardTopState,
    filteredStatusRows,
    workspaceTopbarRightState,
    workspaceTopbarRole,
    workingModalItems,
  };
}

module.exports = {
  verifyDashboardPage,
};
