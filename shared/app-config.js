(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const loginRoutePath = "/login";
  const signupRoutePath = "/signup";
  const companiesRoutePath = "/companies";
  const defaultWorkspaceView = "dashboard";
  const managementMenuSections = Object.freeze([
    Object.freeze({
      key: "basic",
      title: "기본",
      items: Object.freeze([
        Object.freeze({
          description: "지도 기반 위치와 반경으로 인정 근무지를 설정합니다.",
          key: "worksites",
          label: "근무지 설정",
        }),
        Object.freeze({
          description: "상위 조직과 하위 조직 구조를 단계적으로 구성합니다.",
          key: "units",
          label: "조직 설정",
        }),
        Object.freeze({
          description: "직원 데이터에 연결된 직급 체계를 확인하고 관리 기준을 준비합니다.",
          key: "job-titles",
          label: "직급 설정",
        }),
        Object.freeze({
          description: "적용 대상, 정산 기준, 소정·최소·최대 근로시간 규칙을 설정합니다.",
          key: "work-schedules",
          label: "근로정책 설정",
        }),
        Object.freeze({
          description: "회사 공휴일과 휴무 기준일을 관리할 수 있는 화면입니다.",
          key: "holidays",
          label: "공휴일 설정",
        }),
      ]),
    }),
  ]);
  const workspaceMenuSections = Object.freeze([
    Object.freeze({
      key: "operations",
      title: "운영",
      views: Object.freeze(["dashboard", "schedules", "attendance", "leave", "reports"]),
    }),
    Object.freeze({
      key: "engagement",
      title: "커뮤니케이션",
      views: Object.freeze(["messages", "contracts", "closing"]),
    }),
    Object.freeze({
      key: "administration",
      title: "관리",
      views: Object.freeze(["management", "company-settings", "profile"]),
    }),
  ]);
  const pageTitles = Object.freeze({
    login: "로그인",
    signup: "회원가입",
    companies: "회사 선택",
    dashboard: "운영 대시보드",
    schedules: "근무일정",
    attendance: "출퇴근기록",
    leave: "휴가현황",
    requests: "리포트",
    messages: "메시지",
    contracts: "전자계약",
    closing: "마감 관리",
    reports: "리포트",
    management: "관리",
    "company-settings": "회사 설정",
    profile: "프로필",
  });
  const workspaceViewDefinitions = Object.freeze(
    workspaceMenuSections.reduce((definitions, section) => {
      section.views.forEach((view) => {
        definitions[view] = Object.freeze({
          label: pageTitles[view] || view,
          sectionKey: section.key,
          sectionTitle: section.title,
          view,
        });
      });

      return definitions;
    }, {}),
  );
  const workspaceViews = Object.freeze(Object.keys(workspaceViewDefinitions));
  const workspaceRoutePattern = /^\/companies\/([^/]+)\/workspace(?:\/([^/]+))?\/?$/i;

  function normalizeRoutePath(pathname = "/") {
    const normalizedValue = `/${String(pathname || "/").trim()}`
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/g, "");

    return normalizedValue || "/";
  }

  function normalizeCompanyCode(value = "") {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeWorkspaceView(view = "") {
    const normalized = String(view || "").trim().toLowerCase();
    if (normalized === "requests") {
      return "reports";
    }

    return workspaceViews.includes(normalized) ? normalized : defaultWorkspaceView;
  }

  function decodeRouteSegment(value = "") {
    try {
      return decodeURIComponent(String(value || ""));
    } catch (error) {
      return String(value || "");
    }
  }

  function getWorkspaceRoute(pathname = "") {
    const match = workspaceRoutePattern.exec(normalizeRoutePath(pathname));

    if (!match) {
      return null;
    }

    return {
      companyCode: normalizeCompanyCode(decodeRouteSegment(match[1] || "")),
      view: normalizeWorkspaceView(decodeRouteSegment(match[2] || "")),
    };
  }

  function buildWorkspacePath(companyCode = "", view = defaultWorkspaceView) {
    const normalizedCompanyCode = normalizeCompanyCode(companyCode);

    if (!normalizedCompanyCode) {
      return companiesRoutePath;
    }

    const basePath = `/companies/${encodeURIComponent(normalizedCompanyCode)}/workspace`;
    const normalizedView = normalizeWorkspaceView(view);
    return normalizedView === defaultWorkspaceView ? basePath : `${basePath}/${encodeURIComponent(normalizedView)}`;
  }

  return Object.freeze({
    buildWorkspacePath,
    companiesRoutePath,
    defaultWorkspaceView,
    getWorkspaceRoute,
    loginRoutePath,
    managementMenuSections,
    normalizeCompanyCode,
    normalizeRoutePath,
    normalizeWorkspaceView,
    pageTitles,
    signupRoutePath,
    workspaceMenuSections,
    workspaceViewDefinitions,
    workspaceViews,
  });
});
