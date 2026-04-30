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
      managementSectionStorageKey,
      personalScopeStorageKey,
      selectedOrganizationStorageKey,
    } = dependencies;

    if (
      !appConfig
      || typeof createStateFactory !== "function"
      || !managementSectionStorageKey
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
      createDefaultManagementEmployeeDraft,
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
      managementEmployeeDraft: createDefaultManagementEmployeeDraft(),
      managementEmployeeDeleteConfirmOpen: false,
      managementEmployeeExcelModalOpen: false,
      managementEmployeeExcelUpload: null,
      managementEmployeeInviteChannelModalOpen: false,
      managementEmployeeInviteProgress: {
        active: false,
        channelLabel: "",
        message: "",
        progressLabel: "",
      },
      managementEmployeeModalOpen: false,
      managementJobTitleDraft: createDefaultManagementJobTitleDraft(),
      managementJobTitleModalOpen: false,
      managementLeaveGroupEditId: "",
      managementLeaveGroupModalOpen: false,
      managementLeaveGroupParentId: "",
      managementLeaveRuleEditIds: "",
      managementLeaveManualGrantModalOpen: false,
      managementLeaveRuleModalOpen: false,
      managementModalUi: {
        confirm: {
          modalType: "",
          open: false,
        },
        dirty: {
          employee: false,
          holiday: false,
          jobTitle: false,
          unit: false,
          workPolicy: false,
          worksite: false,
        },
        initialSnapshots: {
          employee: "",
          holiday: "",
          jobTitle: "",
          unit: "",
          workPolicy: "",
          worksite: "",
        },
      },
      managementWorkPolicyDraft: createDefaultManagementWorkPolicyDraft(),
      managementWorkPolicyModalOpen: false,
      managementSection: window.sessionStorage.getItem(managementSectionStorageKey) || DEFAULT_MANAGEMENT_SECTION,
      managementUnitDraft: createDefaultManagementUnitDraft(),
      managementUnitModalOpen: false,
      managementWorksiteDraft: createDefaultManagementWorksiteDraft(),
      managementWorksiteModalOpen: false,
      managementWorksiteSearchQuery: "",
      managementWorksiteSearchModalOpen: false,
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
      toast: {
        message: "",
        tone: "success",
        visible: false,
      },
      user: null,
    };

    let toastHideTimerId = 0;

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

    function ensureToastRoot() {
      let toastRoot = document.getElementById("workmate-toast-root");

      if (toastRoot instanceof HTMLElement) {
        return toastRoot;
      }

      toastRoot = document.createElement("div");
      toastRoot.id = "workmate-toast-root";
      toastRoot.className = "toast-root";
      document.body.appendChild(toastRoot);
      return toastRoot;
    }

    function syncToastUi() {
      const toastRoot = ensureToastRoot();
      const toastState = state.toast && typeof state.toast === "object"
        ? state.toast
        : { message: "", tone: "success", visible: false };

      toastRoot.classList.toggle("has-toast", Boolean(toastState.visible && toastState.message));

      if (!toastState.visible || !toastState.message) {
        toastRoot.replaceChildren();
        return;
      }

      const toastMessage = document.createElement("div");
      toastMessage.className = `toast-message${String(toastState.tone || "").trim().toLowerCase() === "error" ? " is-error" : ""}`;
      toastMessage.textContent = String(toastState.message || "").trim();
      toastRoot.replaceChildren(toastMessage);
    }

    function hideToast() {
      if (toastHideTimerId) {
        window.clearTimeout(toastHideTimerId);
        toastHideTimerId = 0;
      }

      state.toast = {
        message: "",
        tone: "success",
        visible: false,
      };
      syncToastUi();
    }

    function showToast(message = "", options = {}) {
      const normalizedMessage = String(message || "").trim();

      if (!normalizedMessage) {
        hideToast();
        return;
      }

      if (toastHideTimerId) {
        window.clearTimeout(toastHideTimerId);
        toastHideTimerId = 0;
      }

      state.toast = {
        message: normalizedMessage,
        tone: String(options.tone || "success").trim().toLowerCase() === "error" ? "error" : "success",
        visible: true,
      };
      syncToastUi();

      const duration = Math.max(1200, Math.min(10000, Number(options.duration) || 2600));
      toastHideTimerId = window.setTimeout(() => {
        hideToast();
      }, duration);
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
      MANAGEMENT_SECTION_STORAGE_KEY: managementSectionStorageKey,
      SOUTH_KOREA_VIEWBOX,
      createDefaultAttendanceRecordsState,
      createDefaultDashboardGridState,
      createDefaultDashboardGridTableState,
      createDefaultManagementHolidayData,
      createDefaultManagementHolidayDraft,
      createDefaultManagementEmployeeDraft,
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
      showToast,
      state,
    });
  }

  return Object.freeze({ create });
});
