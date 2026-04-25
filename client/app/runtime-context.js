(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppRuntimeContext = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      createStateFactory,
      currentYear,
      personalScopeStorageKey,
      selectedOrganizationStorageKey,
    } = dependencies;

    if (
      !appConfig
      || typeof createStateFactory !== "function"
      || !personalScopeStorageKey
      || !selectedOrganizationStorageKey
    ) {
      throw new Error("WorkMateAppRuntimeContext requires runtime dependencies.");
    }

    const DEFAULT_MANAGEMENT_SECTION = appConfig.managementMenuSections?.[0]?.items?.[0]?.key || "worksites";
    const DEFAULT_WORKSITE_COORDS = Object.freeze({ lat: 37.4981, lng: 127.0276 });
    const SOUTH_KOREA_VIEWBOX = Object.freeze({
      bottom: 33.0,
      left: 124.0,
      right: 132.0,
      top: 38.9,
    });
    const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    const stateFactory = createStateFactory({
      currentYear,
      defaultWorksiteCoords: DEFAULT_WORKSITE_COORDS,
    });
    const {
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
    } = stateFactory;

    const state = {
      attendanceDateCursor: formatLocalDateKey(),
      attendanceRecordsData: createDefaultAttendanceRecordsState(),
      attendanceRecordsLoading: false,
      attendanceViewMode: "month",
      bootstrap: null,
      clockOutputText: "",
      companies: [],
      currentWorkspaceView: appConfig.defaultWorkspaceView,
      dashboardDetailUserId: "",
      dashboardGridFilterMenu: null,
      dashboardGrids: createDefaultDashboardGridState(),
      dashboardSummaryFilter: "",
      managementHolidayData: createDefaultManagementHolidayData(),
      managementHolidayDraft: createEmptyManagementHolidayDraft(currentYear),
      managementHolidayLoading: false,
      managementHolidayModalOpen: false,
      managementHolidayYear: currentYear,
      managementJobTitleDraft: createDefaultManagementJobTitleDraft(),
      managementJobTitleModalOpen: false,
      managementWorkPolicyDraft: createDefaultManagementWorkPolicyDraft(),
      managementWorkPolicyModalOpen: false,
      managementSection: DEFAULT_MANAGEMENT_SECTION,
      managementUnitDraft: createDefaultManagementUnitDraft(),
      managementUnitModalOpen: false,
      managementWorksiteDraft: createDefaultManagementWorksiteDraft(),
      managementWorksiteModalOpen: false,
      managementWorksiteSearchQuery: "",
      managementWorksiteSearchResults: [],
      managementWorksiteSearchStatus: "",
      personalScopeEnabled: window.localStorage.getItem(personalScopeStorageKey) === "true",
      reportDateCursor: formatLocalDateKey(),
      reportRecordsData: createDefaultAttendanceRecordsState(),
      reportRecordsLoading: false,
      scheduleCalendarData: createDefaultScheduleCalendarState(),
      scheduleCalendarLoading: false,
      scheduleDateCursor: formatLocalDateKey(),
      scheduleMonthExpandedDates: [],
      scheduleMonthShowAllEntries: false,
      scheduleSelectedUserIds: [],
      scheduleUserFilterMode: "all",
      scheduleUserFilterOpen: false,
      scheduleUserFilterSearch: "",
      scheduleViewMode: "month",
      selectedOrganizationId: window.localStorage.getItem(selectedOrganizationStorageKey) || "",
      user: null,
    };

    const elements = {
      brandHome: document.getElementById("brandHome"),
      clockValidateButton: document.getElementById("clock-validate-button"),
      currentUserDisplayName: document.getElementById("currentUserDisplayName"),
      currentUserName: document.getElementById("currentUserName"),
      currentUserRole: document.getElementById("currentUserRole"),
      logoutButton: document.getElementById("logoutButton"),
      menuToggle: document.getElementById("menuToggle"),
      personalScopeToggle: document.getElementById("personalScopeToggle"),
      personalScopeToggleLabel: document.getElementById("personalScopeToggleLabel"),
      refreshButton: document.getElementById("refreshButton"),
      sidebar: document.getElementById("sidebar"),
      sidebarCompanyName: document.getElementById("sidebarCompanyName"),
      switchCompanyButton: document.getElementById("switchCompanyButton"),
      topbarChipRow: document.getElementById("topbarChipRow"),
      topbarPageDescription: document.getElementById("topbarPageDescription"),
      topbarPageKicker: document.getElementById("topbarPageKicker"),
      topbarPageTitle: document.getElementById("topbarPageTitle"),
      viewRoot: document.getElementById("viewRoot"),
      workspaceNavRoot: document.getElementById("workspaceNavRoot"),
    };

    function setInlineMessage(target, message = "") {
      if (!target) {
        return;
      }

      target.textContent = message;
      target.classList.toggle("hidden", !message);
    }

    function resetScheduleCalendarState() {
      state.scheduleCalendarData = createDefaultScheduleCalendarState();
      state.scheduleCalendarLoading = false;
      state.scheduleMonthExpandedDates = [];
      state.scheduleMonthShowAllEntries = false;
      state.scheduleSelectedUserIds = [];
      state.scheduleUserFilterMode = "all";
      state.scheduleUserFilterOpen = false;
      state.scheduleUserFilterSearch = "";
      state.scheduleViewMode = "month";
      state.scheduleDateCursor = formatLocalDateKey();
    }

    function resetAttendanceRecordsState() {
      state.attendanceDateCursor = formatLocalDateKey();
      state.attendanceRecordsData = createDefaultAttendanceRecordsState();
      state.attendanceRecordsLoading = false;
      state.attendanceViewMode = "month";
    }

    function resetReportRecordsState() {
      state.reportDateCursor = formatLocalDateKey();
      state.reportRecordsData = createDefaultAttendanceRecordsState();
      state.reportRecordsLoading = false;
    }

    function resetManagementHolidayState() {
      state.managementHolidayYear = currentYear;
      state.managementHolidayDraft = createEmptyManagementHolidayDraft(currentYear);
      state.managementHolidayData = createDefaultManagementHolidayData({
        year: currentYear,
      });
      state.managementHolidayLoading = false;
      state.managementHolidayModalOpen = false;
    }

    return Object.freeze({
      CURRENT_YEAR: currentYear,
      DEFAULT_MANAGEMENT_SECTION,
      DEFAULT_WORKSITE_COORDS,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      SOUTH_KOREA_VIEWBOX,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultDashboardGridTableState,
      createDefaultManagementHolidayData,
      createDefaultManagementHolidayDraft,
      createDefaultManagementJobTitleDraft,
      createDefaultManagementUnitDraft,
      createDefaultManagementWorksiteDraft,
      createDefaultManagementWorkPolicyDraft,
      createDefaultScheduleCalendarState,
      createEmptyManagementHolidayDraft,
      elements,
      formatLocalDateKey,
      resetAttendanceRecordsState,
      resetManagementHolidayState,
      resetReportRecordsState,
      resetScheduleCalendarState,
      setInlineMessage,
      state,
    });
  }

  return Object.freeze({ create });
});
