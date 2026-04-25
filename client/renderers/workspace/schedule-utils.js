(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateScheduleUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      formatTime,
      formatTimeRange,
      getScheduleTypeMeta,
      normalizeAttendanceViewMode,
      toArray,
    } = dependencies;

    if (typeof formatTime !== "function" || typeof formatTimeRange !== "function") {
      throw new Error("WorkMateScheduleUtils requires time format helpers.");
    }

    const SCHEDULE_DAY_NAMES = Object.freeze(["일", "월", "화", "수", "목", "금", "토"]);
    const SCHEDULE_WEEK_DAY_NAMES = Object.freeze(["일", "월", "화", "수", "목", "금", "토"]);
    const SCHEDULE_VIEW_MODES = Object.freeze(["month", "week", "day"]);
    const ATTENDANCE_VIEW_MODES = Object.freeze(["month", "list"]);
    function normalizeScheduleViewMode(viewMode = "") {
      const normalized = String(viewMode || "").trim().toLowerCase();
      return SCHEDULE_VIEW_MODES.includes(normalized) ? normalized : "month";
    }
    
    function padScheduleNumber(value) {
      return String(value || 0).padStart(2, "0");
    }
    
    function cloneScheduleDate(date) {
      const next = new Date(date);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    
    function parseScheduleDate(value = "") {
      const text = String(value || "").trim();
      const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text || Date.now());
    
      if (Number.isNaN(date.getTime())) {
        const fallback = new Date();
        fallback.setHours(0, 0, 0, 0);
        return fallback;
      }
    
      date.setHours(0, 0, 0, 0);
      return date;
    }
    
    function formatScheduleDateKey(date) {
      return `${date.getFullYear()}-${padScheduleNumber(date.getMonth() + 1)}-${padScheduleNumber(date.getDate())}`;
    }
    
    function addScheduleDays(date, offset = 0) {
      const next = cloneScheduleDate(date);
      next.setDate(next.getDate() + Number(offset || 0));
      return next;
    }
    
    function addScheduleMonths(date, offset = 0) {
      const next = cloneScheduleDate(date);
      next.setDate(1);
      next.setMonth(next.getMonth() + Number(offset || 0));
      return next;
    }
    
    function getScheduleMonthStart(date) {
      const next = cloneScheduleDate(date);
      next.setDate(1);
      return next;
    }
    
    function getScheduleMonthEnd(date) {
      const next = cloneScheduleDate(date);
      next.setMonth(next.getMonth() + 1, 0);
      return next;
    }
    
    function getScheduleWeekStart(date, weekStartsOn = 1) {
      const next = cloneScheduleDate(date);
      const diff = (next.getDay() - weekStartsOn + 7) % 7;
      next.setDate(next.getDate() - diff);
      return next;
    }
    
    function getScheduleWeekEnd(date, weekStartsOn = 1) {
      return addScheduleDays(getScheduleWeekStart(date, weekStartsOn), 6);
    }
    
    function getScheduleRequestRange(viewMode = "month", cursorValue = "") {
      const normalizedViewMode = normalizeScheduleViewMode(viewMode);
      const cursorDate = parseScheduleDate(cursorValue);
    
      if (normalizedViewMode === "day") {
        const dateKey = formatScheduleDateKey(cursorDate);
        return {
          cursorDate,
          dateFrom: dateKey,
          dateTo: dateKey,
          startDate: cursorDate,
          viewMode: normalizedViewMode,
          visibleEndDate: cursorDate,
          visibleStartDate: cursorDate,
        };
      }
    
      if (normalizedViewMode === "week") {
        const visibleStartDate = getScheduleWeekStart(cursorDate, 0);
        const visibleEndDate = getScheduleWeekEnd(cursorDate, 0);
    
        return {
          cursorDate,
          dateFrom: formatScheduleDateKey(visibleStartDate),
          dateTo: formatScheduleDateKey(visibleEndDate),
          startDate: cursorDate,
          viewMode: normalizedViewMode,
          visibleEndDate,
          visibleStartDate,
        };
      }
    
      const monthStart = getScheduleMonthStart(cursorDate);
      const monthEnd = getScheduleMonthEnd(cursorDate);
      const visibleStartDate = getScheduleWeekStart(monthStart, 0);
      const visibleEndDate = getScheduleWeekEnd(monthEnd, 0);
    
      return {
        cursorDate,
        dateFrom: formatScheduleDateKey(visibleStartDate),
        dateTo: formatScheduleDateKey(visibleEndDate),
        startDate: cursorDate,
        viewMode: normalizedViewMode,
        visibleEndDate,
        visibleStartDate,
      };
    }
    
    function getAttendanceRequestRange(viewMode = "month", cursorValue = "") {
      const normalizedViewMode = normalizeAttendanceViewMode(viewMode);
      const cursorDate = parseScheduleDate(cursorValue);
    
      if (normalizedViewMode === "list") {
        const dateKey = formatScheduleDateKey(cursorDate);
    
        return {
          cursorDate,
          dateFrom: dateKey,
          dateTo: dateKey,
          viewMode: normalizedViewMode,
          visibleEndDate: cursorDate,
          visibleStartDate: cursorDate,
        };
      }
    
      const visibleStartDate = getScheduleMonthStart(cursorDate);
      const visibleEndDate = getScheduleMonthEnd(cursorDate);
    
      return {
        cursorDate,
        dateFrom: formatScheduleDateKey(visibleStartDate),
        dateTo: formatScheduleDateKey(visibleEndDate),
        viewMode: normalizedViewMode,
        visibleEndDate,
        visibleStartDate,
      };
    }
    
    function getReportRequestRange(cursorValue = "") {
      const cursorDate = parseScheduleDate(cursorValue);
      const visibleStartDate = getScheduleMonthStart(cursorDate);
      const visibleEndDate = getScheduleMonthEnd(cursorDate);
    
      return {
        cursorDate,
        dateFrom: formatScheduleDateKey(visibleStartDate),
        dateTo: formatScheduleDateKey(visibleEndDate),
        visibleEndDate,
        visibleStartDate,
      };
    }
    
    function formatReportRangeLabel(cursorValue = "") {
      const range = getReportRequestRange(cursorValue);
      const formatCompactDate = (dateKey) => String(dateKey || "").replace(/-/g, ".");
    
      return `${formatCompactDate(range.dateFrom)} - ${formatCompactDate(range.dateTo)}`;
    }
    
    function formatScheduleRangeLabel(viewMode = "month", cursorValue = "") {
      const range = getScheduleRequestRange(viewMode, cursorValue);
      const cursorDate = range.cursorDate;
    
      if (range.viewMode === "day") {
        return `${cursorDate.getFullYear()}년 ${cursorDate.getMonth() + 1}월 ${cursorDate.getDate()}일 (${SCHEDULE_WEEK_DAY_NAMES[cursorDate.getDay()]})`;
      }
    
      if (range.viewMode === "week") {
        const startDate = range.visibleStartDate;
        const endDate = range.visibleEndDate;
        const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    
        if (sameMonth) {
          return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getDate()}일`;
        }
    
        return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;
      }
    
      return `${cursorDate.getFullYear()}년 ${cursorDate.getMonth() + 1}월`;
    }
    
    function formatAttendanceRangeLabel(viewMode = "month", cursorValue = "") {
      const range = getAttendanceRequestRange(viewMode, cursorValue);
      const cursorDate = range.cursorDate;
    
      if (range.viewMode === "list") {
        return `${cursorDate.getFullYear()}년 ${cursorDate.getMonth() + 1}월 ${cursorDate.getDate()}일 (${SCHEDULE_DAY_NAMES[cursorDate.getDay()]})`;
      }
    
      return `${cursorDate.getFullYear()}년 ${cursorDate.getMonth() + 1}월`;
    }
    
    function iterateScheduleDates(dateFrom = "", dateTo = "") {
      const startDate = parseScheduleDate(dateFrom);
      const endDate = parseScheduleDate(dateTo);
      const dates = [];
      let cursorDate = cloneScheduleDate(startDate);
    
      while (cursorDate.getTime() <= endDate.getTime()) {
        dates.push(cloneScheduleDate(cursorDate));
        cursorDate = addScheduleDays(cursorDate, 1);
      }
    
      return dates;
    }
    
    function getScheduleEntryToneClass(scheduleLabel = "", type = "shift") {
      if (type === "leave") {
        return "tone-leave";
      }
    
      if (type === "holiday") {
        return "tone-holiday";
      }
    
      const normalizedLabel = String(scheduleLabel || "").trim();
    
      if (normalizedLabel.includes("외근")) {
        return "tone-violet";
      }
    
      if (normalizedLabel.includes("사업") || normalizedLabel.includes("출장")) {
        return "tone-salmon";
      }
    
      if (normalizedLabel.includes("재택")) {
        return "tone-lilac";
      }
    
      return "tone-sky";
    }
    
    function getScheduleHourValue(value) {
      if (!value) {
        return 0;
      }
    
      const date = new Date(value);
    
      if (!Number.isNaN(date.getTime())) {
        return date.getHours() + (date.getMinutes() / 60);
      }
    
      const matched = String(value || "").match(/(\d{2}):(\d{2})/);
      return matched ? Number(matched[1]) + (Number(matched[2]) / 60) : 0;
    }
    
    function getScheduleDurationHours(startValue, endValue) {
      const duration = Math.max(0, getScheduleHourValue(endValue) - getScheduleHourValue(startValue));
      return duration > 0 ? duration : 0;
    }
    
    function buildProjectedShiftInstance(patternShift = null, user = {}, dateKey = "") {
      if (!patternShift || !dateKey) {
        return null;
      }
    
      const dayOfWeek = parseScheduleDate(dateKey).getDay();
      const scheduleMeta = getScheduleTypeMeta(patternShift?.trackType, patternShift?.scheduleTemplateName);
    
      if (dayOfWeek === 0 || dayOfWeek === 6 || scheduleMeta.label === "휴일") {
        return null;
      }
    
      const timeRange = formatTimeRange(patternShift?.plannedStartAt, patternShift?.plannedEndAt);
    
      if (timeRange === "-") {
        return null;
      }
    
      const startText = formatTime(patternShift?.plannedStartAt);
      const endText = formatTime(patternShift?.plannedEndAt);
    
      return {
        ...patternShift,
        id: `projected-${user?.id || ""}-${dateKey}`,
        plannedEndAt: `${dateKey}T${endText}:00`,
        plannedStartAt: `${dateKey}T${startText}:00`,
        shiftDate: dateKey,
        userId: user?.id || patternShift?.userId || "",
        userName: user?.name || patternShift?.userName || "-",
      };
    }
    
    function buildScheduleEntryFromShift(shift = {}, user = {}) {
      const scheduleMeta = getScheduleTypeMeta(shift?.trackType, shift?.scheduleTemplateName);
      const entryType = scheduleMeta.label === "휴일" ? "holiday" : "shift";
    
      return {
        colorClass: getScheduleEntryToneClass(scheduleMeta.label, entryType),
        dateKey: String(shift?.shiftDate || "").trim(),
        durationHours: getScheduleDurationHours(shift?.plannedStartAt, shift?.plannedEndAt),
        employeeNo: user?.employeeNo || "-",
        id: shift?.id || "",
        isProjected: String(shift?.id || "").startsWith("projected-"),
        primaryText: user?.name || shift?.userName || "-",
        scheduleLabel: scheduleMeta.label,
        secondaryText: formatTimeRange(shift?.plannedStartAt, shift?.plannedEndAt),
        siteName: shift?.siteName || user?.defaultSiteName || "-",
        startHour: getScheduleHourValue(shift?.plannedStartAt),
        templateName: shift?.scheduleTemplateName || "-",
        timeRange: formatTimeRange(shift?.plannedStartAt, shift?.plannedEndAt),
        title: user?.name || shift?.userName || "-",
        type: entryType,
        userId: user?.id || shift?.userId || "",
        userName: user?.name || shift?.userName || "-",
      };
    }
    
    function buildScheduleEntryFromLeave(leave = {}, user = {}, dateKey = "") {
      return {
        colorClass: getScheduleEntryToneClass(leave?.leaveTypeName || "휴가", "leave"),
        dateKey,
        durationHours: 8,
        employeeNo: user?.employeeNo || "-",
        id: `${leave?.id || "leave"}-${dateKey}`,
        isProjected: false,
        primaryText: user?.name || leave?.userName || "-",
        scheduleLabel: leave?.leaveTypeName || "휴가",
        secondaryText: "종일",
        siteName: leave?.requestReason || "휴가 일정",
        startHour: 9,
        templateName: leave?.leaveTypeName || "휴가",
        timeRange: "종일",
        title: user?.name || leave?.userName || "-",
        type: "leave",
        userId: user?.id || leave?.userId || "",
        userName: user?.name || leave?.userName || "-",
      };
    }
    
    function getScheduleUserUnitName(user = {}) {
      return user?.primaryUnitName || "미지정 조직";
    }
    
    function buildScheduleUserFilterGroups(users = []) {
      const groups = new Map();
    
      toArray(users).forEach((user) => {
        const unitName = getScheduleUserUnitName(user);
    
        if (!groups.has(unitName)) {
          groups.set(unitName, { name: unitName, users: [] });
        }
    
        groups.get(unitName).users.push(user);
      });
    
      return Array.from(groups.values())
        .map((group) => ({
          ...group,
          users: group.users.slice().sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko")),
        }))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
    }

    return Object.freeze({
      SCHEDULE_DAY_NAMES,
      SCHEDULE_WEEK_DAY_NAMES,
      SCHEDULE_VIEW_MODES,
      ATTENDANCE_VIEW_MODES,
      normalizeScheduleViewMode,
      padScheduleNumber,
      cloneScheduleDate,
      parseScheduleDate,
      formatScheduleDateKey,
      addScheduleDays,
      addScheduleMonths,
      getScheduleMonthStart,
      getScheduleMonthEnd,
      getScheduleWeekStart,
      getScheduleWeekEnd,
      getScheduleRequestRange,
      getAttendanceRequestRange,
      getReportRequestRange,
      formatReportRangeLabel,
      formatScheduleRangeLabel,
      formatAttendanceRangeLabel,
      iterateScheduleDates,
      getScheduleEntryToneClass,
      getScheduleHourValue,
      getScheduleDurationHours,
      buildProjectedShiftInstance,
      buildScheduleEntryFromShift,
      buildScheduleEntryFromLeave,
      getScheduleUserUnitName,
      buildScheduleUserFilterGroups,
    });
  }

  return Object.freeze({ create });
});
