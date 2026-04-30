const {
  assertScheduleEntryToneConsistency,
  assertScheduleMonthEntriesSortedByName,
  getScheduleEntryToneState,
  saveShot,
} = require("./ui-verification-helpers");

async function verifySchedulesPage({
  artifactDir,
  baseUrl,
  companyCode,
  page,
}) {
  await page.goto(`${baseUrl}/companies/${companyCode}/workspace/schedules`, { waitUntil: "networkidle" });
  await page.waitForSelector(".workmate-schedule-shell", { timeout: 15000 });
  const scheduleGhostButtonCount = await page.locator(".ghost-button").count();

  if (scheduleGhostButtonCount > 0) {
    throw new Error(`근무일정 페이지에 ghost-button이 남아 있습니다. count=${scheduleGhostButtonCount}`);
  }

  const scheduleMonthShot = await saveShot(page, artifactDir, "schedules-month.png");
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
  const scheduleWeekShot = await saveShot(page, artifactDir, "schedules-week.png");
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
  const scheduleDayShot = await saveShot(page, artifactDir, "schedules-day.png");
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
      hasLeaveEntry: Boolean(leaveEntry),
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
    || (scheduleDayTimelineState.hasLeaveEntry && (
      scheduleDayTimelineState.leaveText !== "휴가"
      || !scheduleDayTimelineState.leaveHasUnifiedEntryClass
      || scheduleDayTimelineState.leaveGridColumnStart !== "1"
      || scheduleDayTimelineState.leaveGridColumnEnd !== "-1"
    ))
  ) {
    throw new Error(`근무일정 일 단위 표시가 올바르지 않습니다. today=${scheduleDayTodayButtonText}, corner=${scheduleDayCornerText}, metaCount=${scheduleDayUserMetaCount}, firstUser=${scheduleDayFirstUserText}, firstUserMeta=${scheduleDayFirstUserMetaText}, timeline=${JSON.stringify(scheduleDayTimelineState)}`);
  }

  return {
    artifacts: {
      schedulesDay: scheduleDayShot,
      schedulesMonth: scheduleMonthShot,
      schedulesWeek: scheduleWeekShot,
    },
    filteredScheduleUsers,
    scheduleDayCornerText,
    scheduleDayTimelineState,
    scheduleGhostButtonCount,
    scheduleMonthToolbarState,
    scheduleUserFilterTriggerState,
    scheduleViewModeIconCount,
    scheduleWeekFirstCellHeight,
    scheduleWeekHeaders,
    scheduleWeekUserAlignment,
  };
}

module.exports = {
  verifySchedulesPage,
};
