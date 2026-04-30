const { saveShot } = require("./ui-verification-helpers");

async function verifyReportsPage({
  artifactDir,
  baseUrl,
  companyCode,
  page,
}) {
  await page.goto(`${baseUrl}/companies/${companyCode}/workspace/reports`, { waitUntil: "networkidle" });
  await page.waitForSelector(".workmate-report-shell .table-wrap", { timeout: 15000 });
  const reportsShot = await saveShot(page, artifactDir, "reports.png");
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

  return {
    artifacts: {
      reports: reportsShot,
    },
  };
}

module.exports = {
  verifyReportsPage,
};
