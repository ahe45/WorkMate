const {
  findCompanyButton,
  saveShot,
} = require("./ui-verification-helpers");

async function verifyLoginAndOpenWorkspace({
  artifactDir,
  baseUrl,
  loginEmail,
  loginPassword,
  page,
}) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  const loginShot = await saveShot(page, artifactDir, "login.png");

  await page.fill("#login-email", loginEmail);
  await page.fill("#login-password", loginPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/companies(?:$|\?)/, { timeout: 15000 });
  await page.waitForSelector(".topbar-right .user-meta", { timeout: 10000 });
  const topbarAccountName = (await page.locator("#currentUserName").first().innerText()).trim();
  const topbarAccountDisplayName = (await page.locator("#currentUserDisplayName").first().innerText()).trim();
  const companiesSidebarRoleCount = await page.locator("#currentUserRole").count();
  const expectedCompaniesAccountEmail = String(loginEmail || "").trim().toLowerCase();
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

  const companiesShot = await saveShot(page, artifactDir, "companies.png");
  const companiesGhostButtonCount = await page.locator(".ghost-button").count();

  if (companiesGhostButtonCount > 0) {
    throw new Error(`companies 페이지에 ghost-button이 남아 있습니다. count=${companiesGhostButtonCount}`);
  }

  const companyButton = await findCompanyButton(page);
  const companyCode = (await companyButton.getAttribute("data-company-open")) || "";
  await companyButton.click();
  await page.waitForURL(/\/workspace(?:\/|$)/, { timeout: 15000 });

  return {
    artifacts: {
      companies: companiesShot,
      login: loginShot,
    },
    companiesGhostButtonCount,
    companiesSidebarFooterCount,
    companiesTopbarRightState,
    companyCode,
    topbarAccountDisplayName,
    topbarAccountName,
  };
}

module.exports = {
  verifyLoginAndOpenWorkspace,
};
