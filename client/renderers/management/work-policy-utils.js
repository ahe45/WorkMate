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

    function parseManagementPolicyClockTime(value = "") {
      const matched = String(value || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);

      if (!matched) {
        return Number.NaN;
      }

      const hours = Number(matched[1]);
      const minutes = Number(matched[2]);

      if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
        return Number.NaN;
      }

      return (hours * 60) + minutes;
    }

    function getManagementPolicyBreakAutoRanges(breakRule = {}) {
      const sourceRanges = Array.isArray(breakRule.autoBreakRanges)
        ? breakRule.autoBreakRanges
        : Array.isArray(breakRule.autoRanges)
          ? breakRule.autoRanges
          : [];
      const normalizedRanges = sourceRanges.map((range) => ({
        breakMinutes: normalizeManagementPolicyMinutes(
          range?.breakMinutes ?? range?.autoBreakMinutes,
          0,
          0,
          1440,
        ),
        minimumWorkMinutes: normalizeManagementPolicyMinutes(
          range?.minimumWorkMinutes ?? range?.autoMinimumWorkMinutes,
          0,
          0,
          60000,
        ),
      })).filter((range) => range.minimumWorkMinutes > 0 && range.breakMinutes > 0)
        .sort((left, right) => left.minimumWorkMinutes - right.minimumWorkMinutes);

      if (normalizedRanges.length > 0) {
        return normalizedRanges;
      }

      const autoMinimumWorkMinutes = normalizeManagementPolicyMinutes(breakRule.autoMinimumWorkMinutes, 0, 0, 60000);
      const autoBreakMinutes = normalizeManagementPolicyMinutes(breakRule.autoBreakMinutes, 0, 0, 1440);

      return autoMinimumWorkMinutes > 0 && autoBreakMinutes > 0
        ? [{ breakMinutes: autoBreakMinutes, minimumWorkMinutes: autoMinimumWorkMinutes }]
        : [];
    }

    function getManagementWorkPolicyBreakMinutes(workInformation = {}, standardDailyMinutes = 0) {
      const breakRule = workInformation?.breakRule && typeof workInformation.breakRule === "object"
        ? workInformation.breakRule
        : {};
      const breakMode = String(breakRule.mode || "").trim().toUpperCase();

      if (breakMode === "AUTO") {
        return getManagementPolicyBreakAutoRanges(breakRule).reduce((appliedBreakMinutes, range) => (
          standardDailyMinutes >= range.minimumWorkMinutes
            ? range.breakMinutes
            : appliedBreakMinutes
        ), 0);
      }

      if (breakMode === "FIXED") {
        const fixedStartMinutes = parseManagementPolicyClockTime(breakRule.fixedStartTime);
        const fixedEndMinutes = parseManagementPolicyClockTime(breakRule.fixedEndTime);

        if (Number.isFinite(fixedStartMinutes) && Number.isFinite(fixedEndMinutes) && fixedEndMinutes > fixedStartMinutes) {
          return fixedEndMinutes - fixedStartMinutes;
        }
      }

      return standardDailyMinutes >= 480 ? 60 : standardDailyMinutes >= 240 ? 30 : 0;
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
      const breakMinutes = getManagementWorkPolicyBreakMinutes(workInformation, standardDailyMinutes);
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
      getManagementWorkPolicyBreakMinutes,
      normalizeManagementPolicyMinutes,
      normalizeManagementPolicyWorkingDays,
    });
  }

  return Object.freeze({ create });
});
