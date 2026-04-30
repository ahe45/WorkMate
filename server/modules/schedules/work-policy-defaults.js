const DEFAULT_WORKING_DAYS = Object.freeze([1, 2, 3, 4, 5]);
const MANAGEMENT_POLICY_DAY_RULE_ORDER = Object.freeze([7, 1, 2, 3, 4, 5, 6]);
const DEFAULT_DAY_RULES = Object.freeze(MANAGEMENT_POLICY_DAY_RULE_ORDER.map((dayOfWeek) => Object.freeze({
  dayOfWeek,
  type: dayOfWeek >= 1 && dayOfWeek <= 5
    ? "WORK"
    : dayOfWeek === 7
      ? "PAID_HOLIDAY"
      : "UNPAID_OFF",
})));
const DEFAULT_CONTRACTUAL_RULE = Object.freeze({
  customPeriodEndDay: 31,
  customPeriodStartDay: 1,
  includeHolidays: false,
  includePublicHolidays: false,
  minutes: 2400,
  monthBasis: "CALENDAR_MONTH",
  overtimeLimitMinutes: 720,
  overtimeLimitUnit: "WEEK",
  overtimeMinimumMinutes: 0,
  overtimeMinimumUnit: "WEEK",
  periodCount: 1,
  periodUnit: "MONTH",
  unit: "WEEK",
  weekStartsOn: 1,
});
const DEFAULT_MAXIMUM_WORK_RULE = Object.freeze({
  customPeriodEndDay: 31,
  customPeriodStartDay: 1,
  includeHolidays: false,
  minutes: 3120,
  monthBasis: "CALENDAR_MONTH",
  periodUnit: "MONTH",
  unit: "WEEK",
  weekStartsOn: 1,
});
const DEFAULT_BREAK_AUTO_RANGE = Object.freeze({
  breakMinutes: 60,
  minimumWorkMinutes: 480,
});
const DEFAULT_BREAK_RULE = Object.freeze({
  autoBreakMinutes: DEFAULT_BREAK_AUTO_RANGE.breakMinutes,
  autoBreakRanges: Object.freeze([DEFAULT_BREAK_AUTO_RANGE]),
  autoMinimumWorkMinutes: DEFAULT_BREAK_AUTO_RANGE.minimumWorkMinutes,
  fixedEndTime: "",
  fixedStartTime: "",
  mode: "AUTO",
});
const DEFAULT_EMPLOYMENT_TARGET_TYPE = "FULL_TIME";
const DEFAULT_WORK_INFORMATION = Object.freeze({
  breakRule: DEFAULT_BREAK_RULE,
  contractualRule: DEFAULT_CONTRACTUAL_RULE,
  dayRules: DEFAULT_DAY_RULES,
  dailyMaxMinutes: 720,
  employmentTargetType: DEFAULT_EMPLOYMENT_TARGET_TYPE,
  hourlyWage: 0,
  includeCustomHolidays: false,
  includePublicHolidays: false,
  includeSubstituteHolidays: false,
  includeWeekends: false,
  maximumRule: Object.freeze({
    alertOnDailyLimit: true,
    alertOnRestTime: true,
    alertOnWeeklyLimit: true,
    dailyMaxMinutes: 720,
    monthlyMaxMethod: "WEEKLY_LIMIT_PRORATED",
    monthlyMaxMinutes: 0,
    weeklyMaxMinutes: 3120,
  }),
  maximumWorkRule: DEFAULT_MAXIMUM_WORK_RULE,
  policyName: "기본 근로정보",
  settlementRule: Object.freeze({
    customPeriodEndDay: 31,
    customPeriodStartDay: 1,
    excludeCustomHolidays: true,
    excludePublicHolidays: true,
    excludeSubstituteHolidays: true,
    monthBasis: "CALENDAR_MONTH",
    unit: "MONTH",
    weekStartsOn: 1,
  }),
  standardRule: Object.freeze({
    method: "WEEKLY_FIXED",
    standardMonthlyMinutes: 10286,
    standardWeeklyMinutes: 2400,
  }),
  standardDailyMinutes: 480,
  targetRule: Object.freeze({
    jobTitleIds: Object.freeze([]),
    scope: "ORGANIZATION",
    siteIds: Object.freeze([]),
    unitIds: Object.freeze([]),
  }),
  weeklyHolidayDay: 7,
  workType: "FIXED",
  workingDays: DEFAULT_WORKING_DAYS,
});

module.exports = {
  DEFAULT_BREAK_AUTO_RANGE,
  DEFAULT_CONTRACTUAL_RULE,
  DEFAULT_EMPLOYMENT_TARGET_TYPE,
  DEFAULT_MAXIMUM_WORK_RULE,
  DEFAULT_WORK_INFORMATION,
  DEFAULT_WORKING_DAYS,
  MANAGEMENT_POLICY_DAY_RULE_ORDER,
};
