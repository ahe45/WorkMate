(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateStateFactory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      currentYear = new Date().getFullYear(),
      defaultWorksiteCoords = Object.freeze({ lat: 37.4981, lng: 127.0276 }),
    } = dependencies;

    const CURRENT_YEAR = currentYear;
    const DEFAULT_WORKSITE_COORDS = defaultWorksiteCoords;

    function formatLocalDateKey(date = new Date()) {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    }
    
    function createDefaultDashboardGridTableState(sortRules = [{ direction: "asc", key: "userName" }]) {
      return {
        filterMenuSearch: "",
        filters: {},
        page: 1,
        pageSize: 20,
        pageSizeMenuOpen: false,
        sortRules,
      };
    }
    
    function createDefaultDashboardGridState() {
      return {
        attendanceRecords: createDefaultDashboardGridTableState(),
        leaveBalances: createDefaultDashboardGridTableState(),
        overview: createDefaultDashboardGridTableState(),
        reports: createDefaultDashboardGridTableState(),
      };
    }
    
    function createDefaultScheduleCalendarState() {
      return {
        dateFrom: "",
        dateTo: "",
        leaveRequests: [],
        loadedOrganizationId: "",
        shiftInstances: [],
      };
    }
    
    function createDefaultAttendanceRecordsState() {
      return {
        dateFrom: "",
        dateTo: "",
        leaveRequests: [],
        loadedOrganizationId: "",
        sessions: [],
      };
    }
    
    function createDefaultManagementWorksiteDraft(overrides = {}) {
      return {
        addressLine1: "",
        geofenceRadiusMeters: 100,
        lat: DEFAULT_WORKSITE_COORDS.lat,
        lng: DEFAULT_WORKSITE_COORDS.lng,
        mapMetadataJson: "",
        name: "",
        primaryUnitId: "",
        siteId: "",
        ...overrides,
      };
    }
    
    function createDefaultManagementUnitDraft(overrides = {}) {
      return {
        initialName: "",
        initialParentUnitId: "",
        name: "",
        parentUnitId: "",
        unitId: "",
        ...overrides,
      };
    }
    
    function createDefaultManagementJobTitleDraft(overrides = {}) {
      return {
        initialName: "",
        initialUnitIds: [],
        jobTitleId: "",
        name: "",
        unitIds: [],
        ...overrides,
      };
    }

    function createDefaultManagementWorkPolicyDraft(overrides = {}) {
      return {
        mode: "create",
        policyId: "",
        ...overrides,
      };
    }
    
    function createDefaultManagementHolidayDraft(overrides = {}) {
      return {
        holidayDate: "",
        holidayId: "",
        name: "",
        repeatUnit: "NONE",
        ...overrides,
      };
    }
    
    function createEmptyManagementHolidayDraft(year = CURRENT_YEAR) {
      const normalizedYear = Math.max(1900, Math.min(2100, Number(year) || CURRENT_YEAR));
      const today = formatLocalDateKey();
    
      return createDefaultManagementHolidayDraft({
        holidayDate: String(today || "").startsWith(`${normalizedYear}-`)
          ? today
          : `${normalizedYear}-01-01`,
      });
    }
    
    function createDefaultManagementHolidayData(overrides = {}) {
      return {
        calendarCode: "",
        calendarId: "",
        calendarName: "",
        items: [],
        loadedOrganizationId: "",
        notices: [],
        summary: {
          customHolidayCount: 0,
          holidayCount: 0,
          lunarHolidayCount: 0,
          nationalHolidayCount: 0,
          substituteHolidayCount: 0,
          totalCount: 0,
        },
        year: CURRENT_YEAR,
        ...overrides,
      };
    }

    return Object.freeze({
      formatLocalDateKey,
      createDefaultDashboardGridTableState,
      createDefaultDashboardGridState,
      createDefaultScheduleCalendarState,
      createDefaultAttendanceRecordsState,
      createDefaultManagementWorksiteDraft,
      createDefaultManagementUnitDraft,
      createDefaultManagementJobTitleDraft,
      createDefaultManagementHolidayDraft,
      createEmptyManagementHolidayDraft,
      createDefaultManagementHolidayData,
      createDefaultManagementWorkPolicyDraft,
    });
  }

  return Object.freeze({ create });
});
