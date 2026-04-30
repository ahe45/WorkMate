(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateShellRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      buildStats,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderBadge,
      toArray,
    } = dependencies;

    if (!appConfig || typeof buildStats !== "function") {
      throw new Error("WorkMateShellRenderer requires appConfig and buildStats.");
    }

    const ROLE_LABELS = Object.freeze({
      EMPLOYEE: "구성원",
      MASTER_ADMIN: "마스터관리자",
      ORG_ADMIN: "조직 관리자",
      SYSTEM_ADMIN: "시스템 관리자",
    });
    const COMPANY_PAGE_META = Object.freeze({
      description: "접근 가능한 워크스페이스를 선택하거나 새 워크스페이스를 추가합니다.",
      kicker: "Workspace list",
      title: "워크스페이스 목록",
    });
    const VIEW_META = Object.freeze({
      dashboard: Object.freeze({ description: "오늘의 운영 지표와 이상 상태를 한 화면에서 점검합니다.", kicker: "Operations overview", title: "운영 대시보드" }),
      schedules: Object.freeze({ description: "템플릿 구성과 배치 준비 흐름을 기준으로 근무일정을 관리합니다.", kicker: "Schedule operations", title: "근무일정" }),
      attendance: Object.freeze({ description: "실시간 출퇴근 세션과 사업장별 상태를 추적합니다.", kicker: "Live attendance", title: "출퇴근기록" }),
      leave: Object.freeze({ description: "전 직원의 휴가 보유와 사용 현황을 유형별로 확인합니다.", kicker: "Leave balances", title: "휴가현황" }),
      requests: Object.freeze({ description: "월별 출퇴근 집계와 조직별 근로 데이터를 리포트로 확인합니다.", kicker: "Real-time report", title: "리포트" }),
      reports: Object.freeze({ description: "월별 출퇴근 집계와 조직별 근로 데이터를 리포트로 확인합니다.", kicker: "Real-time report", title: "리포트" }),
      management: Object.freeze({ description: "근무지와 조직 운영 기준을 서브메뉴 단위로 관리합니다.", kicker: "Admin console", title: "관리" }),
    });
    const NAV_ICONS = Object.freeze({
      attendance: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M7 4.5v3"></path><path d="M17 4.5v3"></path><rect x="4.5" y="6.5" width="15" height="13" rx="2"></rect><path d="M4.5 10.5h15"></path><path d="M8 14h3"></path><path d="M13 14h3"></path></svg>',
      dashboard: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M4.5 12.5 8.5 8l3 3 5-5 3 3"></path><path d="M4.5 18.5h15"></path></svg>',
      leave: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M12 4v16"></path><path d="M6 9c0-2.2 1.8-4 4-4h2"></path><path d="M18 15c0 2.2-1.8 4-4 4h-2"></path></svg>',
      management: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.08-1l2.05-1.6-2-3.46-2.48 1a7.03 7.03 0 0 0-1.73-1L14.5 3h-5l-.26 2.94a7.03 7.03 0 0 0-1.73 1l-2.48-1-2 3.46L5.08 11A7 7 0 0 0 5 12c0 .34.03.67.08 1l-2.05 1.6 2 3.46 2.48-1a7.03 7.03 0 0 0 1.73 1L9.5 21h5l.26-2.94a7.03 7.03 0 0 0 1.73-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z"></path></svg>',
      reports: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M6 17.5V11"></path><path d="M12 17.5V6.5"></path><path d="M18 17.5V9"></path><path d="M4.5 19.5h15"></path></svg>',
      requests: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><path d="M7 5.5h10A1.5 1.5 0 0 1 18.5 7v10A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z"></path><path d="M8.5 9h7"></path><path d="M8.5 12h7"></path><path d="M8.5 15h4"></path></svg>',
      schedules: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="5.5" width="15" height="14" rx="2"></rect><path d="M8 3.5v4"></path><path d="M16 3.5v4"></path><path d="M4.5 9.5h15"></path><path d="M8 13h3"></path><path d="M13 13h3"></path><path d="M8 16h8"></path></svg>',
    });
    function getRoleLabel(roleCode = "") {
      return ROLE_LABELS[String(roleCode || "").trim()] || String(roleCode || "").trim() || "-";
    }
    
    function isRoleActiveForOrganization(role = {}, organizationId = "") {
      const targetOrganizationId = String(organizationId || "").trim();
    
      if (!targetOrganizationId) {
        return false;
      }
    
      const roleOrganizationId = String(role?.organizationId || "").trim();
      const scopeType = String(role?.scopeType || "").trim().toLowerCase();
      const scopeId = String(role?.scopeId || "").trim();
    
      if (roleOrganizationId) {
        return roleOrganizationId === targetOrganizationId;
      }
    
      if (scopeType === "organization" && scopeId) {
        return scopeId === targetOrganizationId;
      }
    
      return scopeType !== "platform";
    }
    
    function summarizeRoles(roles = [], organizationId = "") {
      const labels = Array.from(new Set(toArray(roles)
        .filter((role) => isRoleActiveForOrganization(role, organizationId))
        .map((role) => getRoleLabel(role?.roleCode))));
      return labels.length > 0 ? labels.join(" · ") : "권한 정보 없음";
    }
    
    function getViewMeta(view = appConfig.defaultWorkspaceView) {
      return VIEW_META[view] || VIEW_META[appConfig.defaultWorkspaceView];
    }
    function renderTopbarChips(mode, state, view = appConfig.defaultWorkspaceView) {
      const stats = buildStats(state);
    
      if (mode === "companies") {
        return "";
      }
    
      return [
        renderBadge(stats.context?.code || "회사 코드 없음", "blue"),
        renderBadge(`구성원 ${formatNumber(stats.activeUsers.length)}명`, "green"),
        renderBadge(`사업장 ${formatNumber(stats.sites.length)}개`, "orange"),
        renderBadge(getViewMeta(view).title, "gray"),
      ].join("");
    }
    
    function renderSidebarNavigation(currentView = appConfig.defaultWorkspaceView) {
      return appConfig.workspaceMenuSections.map((section) => `
        <details class="nav-section" open>
          <summary class="nav-section-toggle">
            <span class="nav-section-title">${escapeHtml(section.title)}</span>
            <span class="nav-section-caret" aria-hidden="true"></span>
          </summary>
          <div class="nav-section-items">
            ${section.views.map((view) => `
              <button class="nav-item${currentView === view ? " active" : ""}" data-view="${escapeAttribute(view)}" type="button">
                <span class="nav-icon-wrap" aria-hidden="true">${NAV_ICONS[view] || NAV_ICONS.dashboard}</span>
                <span>${escapeHtml(appConfig.workspaceViewDefinitions[view]?.label || view)}</span>
              </button>
            `).join("")}
          </div>
        </details>
      `).join("");
    }

    return Object.freeze({
      COMPANY_PAGE_META,
      getViewMeta,
      renderSidebarNavigation,
      renderTopbarChips,
      summarizeRoles,
    });
  }

  return Object.freeze({ create });
});
