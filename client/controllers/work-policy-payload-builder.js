(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyPayloadBuilder = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      buildManagementWorkPolicyDayRulesFromFormData,
      createManagementWorkPolicyAutoBreakRange,
      deriveManagementWorkPolicyMaximumRule,
      deriveManagementWorkPolicyStandardRule,
      getManagementWorkPolicyDraftEmploymentTargetType,
      getManagementWorkPolicyDraftTargetRule,
      getManagementWorkPolicyDraftWorkType,
      getManagementWorkPolicyPrimaryWeeklyHolidayDay,
      getManagementWorkPolicyWorkingDaysFromDayRules,
      normalizeManagementWorkPolicyBoolean,
      normalizeManagementWorkPolicyEmploymentTargetType,
      normalizeManagementWorkPolicyEnum,
      normalizeManagementWorkPolicyNumber,
      normalizeManagementWorkPolicyPayload,
      parseManagementWorkPolicyTimeValue,
      sortManagementWorkPolicyAutoBreakRanges,
    } = dependencies;

    if (
      typeof buildManagementWorkPolicyDayRulesFromFormData !== "function"
      || typeof createManagementWorkPolicyAutoBreakRange !== "function"
      || typeof deriveManagementWorkPolicyMaximumRule !== "function"
      || typeof deriveManagementWorkPolicyStandardRule !== "function"
      || typeof getManagementWorkPolicyDraftEmploymentTargetType !== "function"
      || typeof getManagementWorkPolicyDraftTargetRule !== "function"
      || typeof getManagementWorkPolicyDraftWorkType !== "function"
      || typeof getManagementWorkPolicyPrimaryWeeklyHolidayDay !== "function"
      || typeof getManagementWorkPolicyWorkingDaysFromDayRules !== "function"
      || typeof normalizeManagementWorkPolicyBoolean !== "function"
      || typeof normalizeManagementWorkPolicyEmploymentTargetType !== "function"
      || typeof normalizeManagementWorkPolicyEnum !== "function"
      || typeof normalizeManagementWorkPolicyNumber !== "function"
      || typeof normalizeManagementWorkPolicyPayload !== "function"
      || typeof parseManagementWorkPolicyTimeValue !== "function"
      || typeof sortManagementWorkPolicyAutoBreakRanges !== "function"
    ) {
      throw new Error("WorkMateWorkPolicyPayloadBuilder requires work policy payload dependencies.");
    }

    function readManagementWorkPolicyMinutesValue(value, label, minMinutes = 0, maxMinutes = 1440) {
      const totalMinutes = parseManagementWorkPolicyTimeValue(value);

      if (!Number.isFinite(totalMinutes) || totalMinutes < minMinutes || totalMinutes > maxMinutes) {
        throw new Error(`${label}을(를) 올바르게 입력하세요.`);
      }

      return totalMinutes;
    }

    function readManagementWorkPolicyMinutes(formData, fieldName, label, minMinutes = 0, maxMinutes = 1440) {
      return readManagementWorkPolicyMinutesValue(formData.get(fieldName), label, minMinutes, maxMinutes);
    }

    function readManagementWorkPolicyMinutesValueForPayload(value, label, minMinutes = 0, maxMinutes = 1440, { validate = true } = {}) {
      try {
        return readManagementWorkPolicyMinutesValue(value, label, minMinutes, maxMinutes);
      } catch (error) {
        if (validate) {
          throw error;
        }

        return Number.NaN;
      }
    }

    function readManagementWorkPolicyMinutesForPayload(formData, fieldName, label, minMinutes = 0, maxMinutes = 1440, { validate = true } = {}) {
      try {
        return readManagementWorkPolicyMinutes(formData, fieldName, label, minMinutes, maxMinutes);
      } catch (error) {
        if (validate) {
          throw error;
        }

        return Number.NaN;
      }
    }

    function readManagementWorkPolicyClockTimeForPayload(formData, fieldName, label, { validate = true } = {}) {
      const rawValue = String(formData.get(fieldName) || "").trim();

      if (!rawValue) {
        if (validate) {
          throw new Error(`${label}을(를) 올바르게 입력하세요.`);
        }

        return "";
      }

      const totalMinutes = parseManagementWorkPolicyTimeValue(rawValue);

      if (!Number.isFinite(totalMinutes) || totalMinutes < 0 || totalMinutes > 1439) {
        if (validate) {
          throw new Error(`${label}을(를) 올바르게 입력하세요.`);
        }

        return "";
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function buildManagementWorkPolicyAutoBreakRangesFromFormData(formData, { validate = true } = {}) {
      const minimumWorkValues = formData.getAll("breakAutoMinimumTime");
      const breakDurationValues = formData.getAll("breakAutoDurationTime");
      const rangeCount = Math.max(minimumWorkValues.length, breakDurationValues.length);
      const ranges = [];

      for (let index = 0; index < rangeCount; index += 1) {
        const rawMinimumWorkValue = String(minimumWorkValues[index] || "").trim();
        const rawBreakDurationValue = String(breakDurationValues[index] || "").trim();
        const isBlankRange = !rawMinimumWorkValue && !rawBreakDurationValue;

        if (!validate && isBlankRange) {
          continue;
        }

        const minimumWorkMinutes = readManagementWorkPolicyMinutesValueForPayload(
          rawMinimumWorkValue,
          `자동 휴게시간 기준 구간 ${index + 1}의 근로시간 기준`,
          1,
          60000,
          { validate },
        );
        const breakMinutes = readManagementWorkPolicyMinutesValueForPayload(
          rawBreakDurationValue,
          `자동 휴게시간 기준 구간 ${index + 1}의 휴게시간`,
          1,
          1440,
          { validate },
        );

        ranges.push(createManagementWorkPolicyAutoBreakRange(minimumWorkMinutes, breakMinutes));
      }

      const sortedRanges = sortManagementWorkPolicyAutoBreakRanges(ranges);

      if (validate) {
        if (sortedRanges.length === 0) {
          throw new Error("자동 휴게시간 기준 구간을 하나 이상 입력하세요.");
        }

        let previousMinimumWorkMinutes = 0;

        sortedRanges.forEach((range) => {
          const minimumWorkMinutes = normalizeManagementWorkPolicyNumber(range.minimumWorkMinutes, 0, 0, 60000);
          const breakMinutes = normalizeManagementWorkPolicyNumber(range.breakMinutes, 0, 0, 1440);

          if (minimumWorkMinutes <= 0) {
            throw new Error("자동 휴게시간 근로시간 기준을 올바르게 입력하세요.");
          }

          if (breakMinutes <= 0) {
            throw new Error("자동 휴게시간을 올바르게 입력하세요.");
          }

          if (previousMinimumWorkMinutes > 0 && minimumWorkMinutes === previousMinimumWorkMinutes) {
            throw new Error("자동 휴게시간 기준 구간의 근로시간 기준은 중복될 수 없습니다.");
          }

          previousMinimumWorkMinutes = minimumWorkMinutes;
        });

        return sortedRanges;
      }

      return sortedRanges.filter((range) => Number.isFinite(range.minimumWorkMinutes) && range.minimumWorkMinutes > 0
        && Number.isFinite(range.breakMinutes) && range.breakMinutes > 0);
    }

    function buildManagementWorkPolicyPayloadFromForm(formData, { validate = true } = {}) {
      const dayRules = buildManagementWorkPolicyDayRulesFromFormData(formData);
      const workingDays = getManagementWorkPolicyWorkingDaysFromDayRules(dayRules);
      const workType = getManagementWorkPolicyDraftWorkType();
      const hourlyWage = normalizeManagementWorkPolicyNumber(formData.get("hourlyWage"), 0, 0, 1000000000);
      const employmentTargetType = normalizeManagementWorkPolicyEmploymentTargetType(
        formData.get("employmentTargetType"),
        hourlyWage > 0 ? "PART_TIME" : getManagementWorkPolicyDraftEmploymentTargetType(),
      );
      const sharedPeriodUnit = normalizeManagementWorkPolicyEnum(formData.get("periodUnit"), "MONTH");
      const sharedPeriodCount = normalizeManagementWorkPolicyNumber(formData.get("periodCount"), 1, 1, 365);
      const sharedIncludeHolidays = normalizeManagementWorkPolicyBoolean(formData.get("includeHolidays"), false);
      const sharedIncludePublicHolidays = normalizeManagementWorkPolicyBoolean(formData.get("includePublicHolidays"), false);
      const sharedWeekStartsOn = normalizeManagementWorkPolicyNumber(formData.get("periodWeekStart"), 1, 1, 7);
      const sharedMonthStartDay = normalizeManagementWorkPolicyNumber(formData.get("periodMonthStartDay"), 1, 1, 31);
      const sharedMonthEndDay = normalizeManagementWorkPolicyNumber(formData.get("periodMonthEndDay"), 31, 1, 31);
      const contractualUnit = normalizeManagementWorkPolicyEnum(formData.get("contractualUnit"), "WEEK");
      const breakMode = normalizeManagementWorkPolicyEnum(formData.get("breakMode"), "");
      const sharedMonthBasis = sharedPeriodUnit === "MONTH" && (sharedMonthStartDay !== 1 || sharedMonthEndDay !== 31)
        ? "CUSTOM_PERIOD"
        : "CALENDAR_MONTH";
      const breakRule = {
        autoBreakMinutes: Number.NaN,
        autoBreakRanges: [],
        autoMinimumWorkMinutes: Number.NaN,
        fixedEndTime: "",
        fixedStartTime: "",
        mode: breakMode,
      };

      if (breakMode === "AUTO") {
        breakRule.autoBreakRanges = buildManagementWorkPolicyAutoBreakRangesFromFormData(formData, { validate });
        const lastAutoBreakRange = breakRule.autoBreakRanges[breakRule.autoBreakRanges.length - 1]
          || createManagementWorkPolicyAutoBreakRange(Number.NaN, Number.NaN);

        breakRule.autoMinimumWorkMinutes = lastAutoBreakRange.minimumWorkMinutes;
        breakRule.autoBreakMinutes = lastAutoBreakRange.breakMinutes;
      } else if (breakMode === "FIXED") {
        breakRule.fixedStartTime = readManagementWorkPolicyClockTimeForPayload(formData, "breakFixedStartTime", "고정 휴게시간 시작", { validate });
        breakRule.fixedEndTime = readManagementWorkPolicyClockTimeForPayload(formData, "breakFixedEndTime", "고정 휴게시간 종료", { validate });

        const fixedStartMinutes = parseManagementWorkPolicyTimeValue(breakRule.fixedStartTime);
        const fixedEndMinutes = parseManagementWorkPolicyTimeValue(breakRule.fixedEndTime);

        if (
          validate
          && Number.isFinite(fixedStartMinutes)
          && Number.isFinite(fixedEndMinutes)
          && fixedEndMinutes <= fixedStartMinutes
        ) {
          throw new Error("고정 휴게시간 종료 시각은 시작 시각보다 늦어야 합니다.");
        }
      } else if (validate) {
        throw new Error("휴게시간 부여 방식을 선택하세요.");
      }

      const contractualRule = {
        customPeriodEndDay: sharedMonthEndDay,
        customPeriodStartDay: sharedMonthStartDay,
        includeHolidays: sharedIncludeHolidays,
        includePublicHolidays: sharedIncludePublicHolidays,
        minutes: readManagementWorkPolicyMinutesForPayload(formData, "contractualTime", "소정근로시간", 1, 60000, { validate }),
        monthBasis: sharedMonthBasis,
        overtimeLimitMinutes: readManagementWorkPolicyMinutesForPayload(formData, "overtimeLimitTime", "연장근로 최대기준", 1, 60000, { validate }),
        overtimeLimitUnit: contractualUnit,
        overtimeMinimumMinutes: readManagementWorkPolicyMinutesForPayload(formData, "overtimeMinimumTime", "연장근로 최소기준", 0, 60000, { validate }),
        overtimeMinimumUnit: contractualUnit,
        periodCount: sharedPeriodCount,
        periodUnit: sharedPeriodUnit,
        unit: contractualUnit,
        weekStartsOn: sharedWeekStartsOn,
      };
      const maximumWorkRule = {
        customPeriodEndDay: sharedMonthEndDay,
        customPeriodStartDay: sharedMonthStartDay,
        includeHolidays: sharedIncludeHolidays,
        minutes: contractualRule.overtimeLimitMinutes,
        monthBasis: sharedMonthBasis,
        periodUnit: sharedPeriodUnit,
        unit: contractualUnit,
        weekStartsOn: sharedWeekStartsOn,
      };
      const derivedStandard = deriveManagementWorkPolicyStandardRule(contractualRule, workingDays, workType);
      const derivedMaximum = deriveManagementWorkPolicyMaximumRule(maximumWorkRule, workingDays);
      const includeHolidays = normalizeManagementWorkPolicyBoolean(sharedIncludeHolidays, false);
      const includePublicHolidays = normalizeManagementWorkPolicyBoolean(sharedIncludePublicHolidays, false);

      return normalizeManagementWorkPolicyPayload({
        breakRule,
        contractualRule,
        dayRules,
        dailyMaxMinutes: derivedMaximum.dailyMaxMinutes,
        employmentTargetType,
        hourlyWage: employmentTargetType === "PART_TIME" ? hourlyWage : 0,
        includeCustomHolidays: includePublicHolidays,
        includePublicHolidays,
        includeSubstituteHolidays: includePublicHolidays,
        includeWeekends: includeHolidays,
        maximumRule: derivedMaximum.maximumRule,
        maximumWorkRule,
        policyName: String(formData.get("policyName") || "기본 근로정보").trim(),
        settlementRule: {
          customPeriodEndDay: contractualRule.customPeriodEndDay,
          customPeriodStartDay: contractualRule.customPeriodStartDay,
          excludeCustomHolidays: !includePublicHolidays,
          excludePublicHolidays: !includePublicHolidays,
          excludeSubstituteHolidays: !includePublicHolidays,
          monthBasis: contractualRule.monthBasis,
          unit: contractualRule.periodUnit,
          weekStartsOn: contractualRule.weekStartsOn,
        },
        standardDailyMinutes: derivedStandard.standardDailyMinutes,
        standardRule: derivedStandard.standardRule,
        targetRule: getManagementWorkPolicyDraftTargetRule(),
        weeklyHolidayDay: getManagementWorkPolicyPrimaryWeeklyHolidayDay(dayRules, 7),
        workType,
        workingDays,
      });
    }

    return Object.freeze({
      buildManagementWorkPolicyAutoBreakRangesFromFormData,
      buildManagementWorkPolicyPayloadFromForm,
    });
  }

  return Object.freeze({
    create,
  });
});
