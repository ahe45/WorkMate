const { saveShot } = require("./ui-verification-helpers");

async function verifyAttendancePage({
  artifactDir,
  baseUrl,
  companyCode,
  page,
}) {
  await page.goto(`${baseUrl}/companies/${companyCode}/workspace/attendance`, { waitUntil: "networkidle" });
  await page.waitForSelector(".workmate-attendance-month-board", { timeout: 15000 });
  const attendanceTitle = (await page.locator("#topbarPageTitle").first().innerText()).trim();
  const attendanceMonthShot = await saveShot(page, artifactDir, "attendance-month.png");
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
  const attendanceListShot = await saveShot(page, artifactDir, "attendance-list.png");
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

  return {
    artifacts: {
      attendanceList: attendanceListShot,
      attendanceMonth: attendanceMonthShot,
    },
    attendanceAssumeButtonCount,
    attendanceCheckCount,
    attendanceFilterButtonCount,
    attendanceGhostButtonCount,
    attendanceLeaveCellCount,
    attendanceListDateLabel,
    attendanceListRows,
    attendanceListScrollState,
    attendanceListUserNames,
    attendanceMonthCells,
    attendanceMonthFhdScrollState,
    attendanceMonthRows,
    attendanceMonthScrollState,
    attendanceMonthUserNames,
    attendanceSummaryLineCount,
    attendanceTitle,
    attendanceViewModeIconCount,
    filteredAttendanceRows,
  };
}

module.exports = {
  verifyAttendancePage,
};
