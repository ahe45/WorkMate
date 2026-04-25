(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorkPolicyUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create() {
    function formatScheduleTimeFromMinutes(minutes = 0) {
      const normalizedMinutes = ((Math.round(Number(minutes) || 0) % 1440) + 1440) % 1440;
      const hours = Math.floor(normalizedMinutes / 60);
      const minute = normalizedMinutes % 60;

      return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    }

    function normalizeManagementPolicyMinutes(value, fallback = 0, min = 0, max = 1440) {
      const numericValue = Math.round(Number(value));

      if (!Number.isFinite(numericValue)) {
        return fallback;
      }

      return Math.max(min, Math.min(max, numericValue));
    }

    function normalizeManagementPolicyWorkingDays(value, fallback = [1, 2, 3, 4, 5]) {
      const source = Array.isArray(value)
        ? value
        : String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
      const days = Array.from(new Set(source
        .map((entry) => Number(entry))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)))
        .sort((left, right) => left - right);

      return days.length > 0 ? days : fallback.slice();
    }

    function buildWeekdayTemplateDays(workInformation = {}) {
      const workingDays = new Set(normalizeManagementPolicyWorkingDays(workInformation?.workingDays, [1, 2, 3, 4, 5]));
      const standardDailyMinutes = normalizeManagementPolicyMinutes(workInformation?.standardDailyMinutes, 480, 1, 1440);
      const breakMinutes = standardDailyMinutes >= 480 ? 60 : standardDailyMinutes >= 240 ? 30 : 0;
      const startMinutes = 9 * 60;
      const endTime = formatScheduleTimeFromMinutes(startMinutes + standardDailyMinutes + breakMinutes);

      return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
        const isWorkingDay = workingDays.has(dayOfWeek);

        return isWorkingDay
          ? {
            breakMinutes,
            dayOfWeek,
            earlyLeaveGraceMinutes: 10,
            endTime,
            isWorkingDay: true,
            lateGraceMinutes: 10,
            startTime: "09:00:00",
          }
          : {
            dayOfWeek,
            isWorkingDay: false,
          };
      });
    }

    return Object.freeze({
      buildWeekdayTemplateDays,
      formatScheduleTimeFromMinutes,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyWorkingDays,
    });
  }

  return Object.freeze({ create });
});
