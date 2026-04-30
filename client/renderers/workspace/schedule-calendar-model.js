(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateScheduleCalendarModel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(deps = {}) {
    const {
      addScheduleDays,
      buildProjectedShiftInstance,
      buildScheduleEntryFromLeave,
      buildScheduleEntryFromShift,
      buildScheduleUserFilterGroups,
      cloneScheduleDate,
      formatScheduleDateKey,
      getScheduleRequestRange,
      getScheduleTypeMeta,
      getScheduleUserUnitName,
      iterateScheduleDates,
      normalizeScheduleViewMode,
      parseScheduleDate,
      toArray,
    } = deps;

    function buildScheduleCalendarModel(state = {}, stats = {}) {
      const viewMode = normalizeScheduleViewMode(state.scheduleViewMode);
      const range = getScheduleRequestRange(viewMode, state.scheduleDateCursor);
      const visibleDates = iterateScheduleDates(range.dateFrom, range.dateTo);
      const activeUsers = stats.activeUsers.slice().sort((left, right) => {
        const unitDiff = getScheduleUserUnitName(left).localeCompare(getScheduleUserUnitName(right), "ko");

        if (unitDiff !== 0) {
          return unitDiff;
        }

        return String(left?.name || "").localeCompare(String(right?.name || ""), "ko");
      });
      const activeUserIds = new Set(activeUsers.map((user) => String(user?.id || "")).filter(Boolean));
      const filterMode = state.scheduleUserFilterMode === "custom" ? "custom" : "all";
      const rawSelectedUserIds = new Set(toArray(state.scheduleSelectedUserIds).map((userId) => String(userId || "")).filter((userId) => activeUserIds.has(userId)));
      const selectedUserIds = filterMode === "custom" ? rawSelectedUserIds : new Set(activeUserIds);
      const selectedUsers = activeUsers.filter((user) => selectedUserIds.has(String(user?.id || "")));
      const filteredUsers = (filterMode === "custom" ? selectedUsers : activeUsers)
        .slice()
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));
      const calendarData = state.scheduleCalendarData || {};
      const realShiftInstances = toArray(calendarData.shiftInstances);
      const sourceLeaveRequests = toArray(calendarData.leaveRequests).length > 0
        ? toArray(calendarData.leaveRequests)
        : toArray(stats.leaveRequests);
      const patternShiftByUserId = new Map();
      const realShiftByUserDate = new Map();
      const leaveByUserDate = new Map();
      const entriesByDate = new Map();
      const entriesByUserDate = new Map();
      const dayTotals = new Map();

      [...realShiftInstances, ...toArray(stats.shiftInstances)].forEach((shift) => {
        const userId = String(shift?.userId || "");
        const scheduleMeta = getScheduleTypeMeta(shift?.trackType, shift?.scheduleTemplateName);

        if (!userId || patternShiftByUserId.has(userId) || scheduleMeta.label === "휴일") {
          return;
        }

        patternShiftByUserId.set(userId, shift);
      });

      realShiftInstances.forEach((shift) => {
        const userId = String(shift?.userId || "");
        const dateKey = String(shift?.shiftDate || "").trim();

        if (!userId || !dateKey) {
          return;
        }

        realShiftByUserDate.set(`${userId}:${dateKey}`, shift);
      });

      sourceLeaveRequests.forEach((leave) => {
        const startDate = parseScheduleDate(leave?.startDate || range.dateFrom);
        const endDate = parseScheduleDate(leave?.endDate || range.dateTo);
        const clippedStartDate = startDate.getTime() < parseScheduleDate(range.dateFrom).getTime()
          ? parseScheduleDate(range.dateFrom)
          : startDate;
        const clippedEndDate = endDate.getTime() > parseScheduleDate(range.dateTo).getTime()
          ? parseScheduleDate(range.dateTo)
          : endDate;
        let cursorDate = cloneScheduleDate(clippedStartDate);

        while (cursorDate.getTime() <= clippedEndDate.getTime()) {
          leaveByUserDate.set(`${String(leave?.userId || "")}:${formatScheduleDateKey(cursorDate)}`, leave);
          cursorDate = addScheduleDays(cursorDate, 1);
        }
      });

      filteredUsers.forEach((user) => {
        visibleDates.forEach((date) => {
          const dateKey = formatScheduleDateKey(date);
          const userId = String(user?.id || "");
          const entryKey = `${userId}:${dateKey}`;
          const leave = leaveByUserDate.get(entryKey);
          const shift = realShiftByUserDate.get(entryKey) || buildProjectedShiftInstance(patternShiftByUserId.get(userId), user, dateKey);
          const entry = leave
            ? buildScheduleEntryFromLeave(leave, user, dateKey)
            : shift
              ? buildScheduleEntryFromShift(shift, user)
              : null;

          if (!entry) {
            return;
          }

          const dateEntries = entriesByDate.get(dateKey) || [];
          dateEntries.push(entry);
          entriesByDate.set(dateKey, dateEntries);
          entriesByUserDate.set(entryKey, entry);
          dayTotals.set(dateKey, (dayTotals.get(dateKey) || 0) + Number(entry.durationHours || 0));
        });
      });

      entriesByDate.forEach((dateEntries, dateKey) => {
        entriesByDate.set(dateKey, dateEntries.slice().sort((left, right) => {
          const nameDiff = String(left?.userName || "").localeCompare(String(right?.userName || ""), "ko");

          if (nameDiff !== 0) {
            return nameDiff;
          }

          return Number(left?.startHour || 0) - Number(right?.startHour || 0);
        }));
      });

      const rowUsers = filteredUsers.filter((user) => visibleDates.some((date) => entriesByUserDate.has(`${String(user?.id || "")}:${formatScheduleDateKey(date)}`)));

      return {
        dateEntriesMap: entriesByDate,
        dayTotals,
        entriesByUserDate,
        filterMode,
        filteredUsers,
        range,
        rowUsers,
        selectedUserIds: Array.from(selectedUserIds),
        selectedUsers,
        userFilterGroups: buildScheduleUserFilterGroups(activeUsers),
        visibleDates,
      };
    }

    return Object.freeze({
      buildScheduleCalendarModel,
    });
  }

  return Object.freeze({ create });
});
