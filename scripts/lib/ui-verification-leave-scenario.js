const { saveShot } = require("./ui-verification-helpers");

async function verifyLeavePage({
  artifactDir,
  baseUrl,
  companyCode,
  page,
}) {
  await page.goto(`${baseUrl}/companies/${companyCode}/workspace/leave`, { waitUntil: "networkidle" });
  await page.waitForSelector(".workmate-leave-grid-card .table-wrap", { timeout: 15000 });
  const leaveShot = await saveShot(page, artifactDir, "leave-balances.png");
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

  return {
    artifacts: {
      leaveBalances: leaveShot,
    },
    filteredLeaveRows,
    leaveHeaders,
    leavePaginationText,
    leaveRows,
  };
}

module.exports = {
  verifyLeavePage,
};
