(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateSummaryRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      buildStats,
      escapeHtml,
      formatDate,
      formatNumber,
      getViewMeta,
      renderBadge,
      renderBarList,
      renderMetricCard,
      renderMiniItem,
      renderMiniList,
      renderTimelineItem,
      summarizeRoles,
    } = dependencies;

    if (typeof buildStats !== "function" || typeof getViewMeta !== "function") {
      throw new Error("WorkMateSummaryRenderer requires stats and view metadata helpers.");
    }

    function buildSummarySpec(view, stats, state) {
      const meta = getViewMeta(view);
      const currentOrganizationId = stats.context?.id || state.selectedOrganizationId || state.user?.organizationId || "";
      const summaryMap = {
        schedules: {
          metrics: [
            ["템플릿", formatNumber(stats.templates.length), "등록 완료", "tone-blue"],
            ["유닛", formatNumber(stats.units.length), "배치 그룹", "tone-green"],
            ["대상 사용자", formatNumber(stats.users.length), "스케줄 배포 가능", "tone-orange"],
            ["기본 근무 정책", stats.context?.defaultWorkPolicyName || "-", "현재 기준", "tone-purple"],
          ],
          primary: { description: "현재 회사에 등록된 템플릿입니다.", title: "템플릿 목록", type: "list", items: stats.templates.map((template) => renderMiniItem(template?.name || "-", `${template?.code || "-"} · ${template?.trackType || "FIXED"}`, renderBadge(template?.status || "ACTIVE", "blue"))) },
          secondary: { description: "담당자가 순서대로 확인할 작업입니다.", title: "스케줄 운영 메모", type: "timeline", items: [renderTimelineItem("1. 템플릿 생성", "근무 패턴을 템플릿으로 등록합니다.", renderBadge("필수", "blue")), renderTimelineItem("2. 사용자 배포", "사용자 단위로 일정 적용 기간을 설정합니다.", renderBadge("배포", "green")), renderTimelineItem("3. Clock 검증", "사업장과 사용자 조합으로 실제 인증 결과를 시뮬레이션합니다.", renderBadge("검증", "orange"))] },
        },
        leave: {
          metrics: [["활성 구성원", formatNumber(stats.activeUsers.length), "현재 재직", "tone-blue"], ["최근 입사자", formatNumber(stats.recentJoiners.length), "30일 내", "tone-green"], ["조직 수", formatNumber(stats.units.length), "영향 범위", "tone-orange"], ["사업장 수", formatNumber(stats.sites.length), "대체 인력 기준", "tone-purple"]],
          primary: { description: "휴가 요청이 몰릴 때 우선 확인할 팀 규모입니다.", title: "조직별 커버리지", type: "bars", items: stats.unitDistribution.slice(0, 8).map((unit) => ({ label: unit.name, value: unit.count })), suffix: "명" },
          secondary: { description: "실제 휴가 기능 연결 전에도 운영 기준을 정리할 수 있도록 구성했습니다.", title: "휴가 운영 메모", type: "list", items: [renderMiniItem("휴가 대상자 분류", "사업장과 조직이 정리돼 있으면 승인 대상 구성이 쉬워집니다.", renderBadge("조직 기준", "blue")), renderMiniItem("온보딩 인력 확인", "최근 입사자와 관리자 역할을 먼저 확인하세요.", renderBadge("우선 체크", "green")), renderMiniItem("연락망 보완", "연락처가 없으면 긴급 교대 연락이 지연될 수 있습니다.", renderBadge("리스크", "orange"))] },
        },
        requests: {
          metrics: [["후속 작업", "3", "현재 큐", "tone-blue"], ["열린 경고", formatNumber(stats.anomalies.length), "우선 처리", "tone-green"], ["기본 사업장 누락", formatNumber(stats.usersMissingDefaultSite.length), "사용자 설정", "tone-orange"], ["정책 점검 사업장", formatNumber(Math.max(0, stats.sites.length - stats.authReadySites.length)), "사업장 정책", "tone-purple"]],
          primary: { description: "운영자가 가장 먼저 처리할 항목 순서입니다.", title: "대기 중인 요청", type: "list", items: [renderMiniItem("출퇴근 이상 징후 처리", `${formatNumber(stats.anomalies.length)}건이 관리자 검토를 기다립니다.`, renderBadge("우선순위 높음", stats.anomalies.length > 0 ? "orange" : "green")), renderMiniItem("기본 사업장 보완", `${formatNumber(stats.usersMissingDefaultSite.length)}명의 사용자 설정이 비어 있습니다.`, renderBadge("사용자 관리", "blue")), renderMiniItem("사업장 인증 정책 확인", `${formatNumber(Math.max(0, stats.sites.length - stats.authReadySites.length))}개 사업장이 점검 필요합니다.`, renderBadge("정책", "gray"))] },
          secondary: { description: "승인 플로우 관점으로 배치했습니다.", title: "처리 단계", type: "timeline", items: [renderTimelineItem("접수", "요청과 이상 징후가 발생한 상태", renderBadge("1", "blue")), renderTimelineItem("검토", "관리자가 정책과 일정 영향을 확인", renderBadge("2", "green")), renderTimelineItem("정리", "사용자/사업장 설정을 보완하고 마감 데이터에 반영", renderBadge("3", "orange"))] },
        },
        messages: {
          metrics: [["사업장 그룹", formatNumber(stats.sites.length), "현장 공지", "tone-blue"], ["조직 그룹", formatNumber(stats.units.length), "부서 공지", "tone-green"], ["연락처 미등록", formatNumber(stats.usersMissingPhone.length), "보완 필요", "tone-orange"], ["활성 사용자", formatNumber(stats.activeUsers.length), "메시지 대상", "tone-purple"]],
          primary: { description: "세션이 많은 현장부터 공지 우선순위를 잡습니다.", title: "사업장 대상 그룹", type: "list", items: stats.siteLoad.slice(0, 4).map((site) => renderMiniItem(site.name, `오늘 세션 ${formatNumber(site.count)}건`, renderBadge(site.ready ? "정책 준비" : "정책 점검", site.ready ? "green" : "orange"))) },
          secondary: { description: "주 조직 기준으로 메시지 분류를 준비합니다.", title: "조직 대상 그룹", type: "list", items: stats.unitDistribution.slice(0, 4).map((unit) => renderMiniItem(unit.name, `${formatNumber(unit.count)}명`, renderBadge("대상 그룹", "blue"))) },
        },
        contracts: {
          metrics: [["최근 입사자", formatNumber(stats.recentJoiners.length), "서명 대상", "tone-blue"], ["연락처 미등록", formatNumber(stats.usersMissingPhone.length), "정보 보완", "tone-green"], ["기본 사업장 누락", formatNumber(stats.usersMissingDefaultSite.length), "배치 확인", "tone-orange"], ["활성 사용자", formatNumber(stats.activeUsers.length), "운영 대상", "tone-purple"]],
          primary: { description: "전자계약 화면에서 이어서 관리할 체크포인트입니다.", title: "온보딩 타임라인", type: "timeline", items: [renderTimelineItem("계약 대상자 선정", "최근 입사자와 신규 배치 인원을 확인합니다.", renderBadge("준비", "blue")), renderTimelineItem("필수 정보 점검", "이메일, 연락처, 사업장 기본값을 보완합니다.", renderBadge("점검", "green")), renderTimelineItem("서명 요청 발송", "계약 상태와 후속 업무를 남길 수 있도록 연결합니다.", renderBadge("실행", "orange"))] },
          secondary: { description: "최근 입사자를 우선 표기합니다.", title: "대상자 미리보기", type: "list", items: stats.recentJoiners.map((user) => renderMiniItem(user?.name || "-", `${user?.employeeNo || "-"} · ${formatDate(user?.joinDate)}`, renderBadge(user?.defaultSiteName || "사업장 미지정", user?.defaultSiteName ? "green" : "orange"))) },
        },
        closing: {
          metrics: [["열린 세션", formatNumber(stats.workingSessions.length), "마감 전 확인", "tone-blue"], ["열린 경고", formatNumber(stats.anomalies.length), "우선 대응", "tone-green"], ["사업장", formatNumber(stats.sites.length), "마감 대상", "tone-orange"], ["평균 근무분", `${formatNumber(stats.averageWorkMinutes)}분`, "오늘 세션 기준", "tone-purple"]],
          primary: { description: "세션과 정책 준비도를 기준으로 정리합니다.", title: "사업장별 마감 리스크", type: "list", items: stats.siteLoad.map((site) => renderMiniItem(site.name, `세션 ${formatNumber(site.count)}건`, renderBadge(site.ready ? "정책 준비" : "정책 점검", site.ready ? "green" : "orange"))) },
          secondary: { description: "담당자가 그대로 따라갈 수 있는 흐름입니다.", title: "마감 실행 순서", type: "timeline", items: [renderTimelineItem("1. 열린 세션 정리", "퇴근 누락과 열린 세션을 먼저 마감합니다.", renderBadge("세션", "blue")), renderTimelineItem("2. 경고 확인", "이상 징후와 지각 건을 검토합니다.", renderBadge("경고", "orange")), renderTimelineItem("3. 사업장 확정", "정책 준비 여부를 다시 확인하고 정산으로 넘깁니다.", renderBadge("확정", "green"))] },
        },
        reports: {
          metrics: [["활성 구성원", formatNumber(stats.activeUsers.length), "보고 대상", "tone-blue"], ["사업장", formatNumber(stats.sites.length), "현장 단위", "tone-green"], ["유닛", formatNumber(stats.units.length), "조직 단위", "tone-orange"], ["평균 근무분", `${formatNumber(stats.averageWorkMinutes)}분`, "오늘 세션 기준", "tone-purple"]],
          primary: { description: "세션 수와 정책 준비 상태를 함께 표기합니다.", title: "사업장 리포트", type: "list", items: stats.siteLoad.map((site) => renderMiniItem(site.name, `세션 ${formatNumber(site.count)}건`, renderBadge(site.ready ? "준비 완료" : "점검 필요", site.ready ? "green" : "orange"))) },
          secondary: { description: "인원 분포를 보고서 카드 형태로 요약합니다.", title: "조직 리포트", type: "list", items: stats.unitDistribution.map((unit) => renderMiniItem(unit.name, unit.path || "경로 정보 없음", renderBadge(`${formatNumber(unit.count)}명`, "blue"))) },
        },
        "company-settings": {
          metrics: [["회사 코드", stats.context?.code || "-", "식별자", "tone-blue"], ["시간대", stats.context?.timezone || "Asia/Seoul", "Timezone", "tone-green"], ["기본 근무 정책", stats.context?.defaultWorkPolicyName || "-", "Default policy", "tone-orange"], ["사업장", formatNumber(stats.sites.length), "운영 단위", "tone-purple"]],
          primary: { description: "운영 기준이 되는 기본 값입니다.", title: "회사 정보", type: "list", items: [renderMiniItem("회사 이름", stats.context?.name || "-", renderBadge("Organization", "blue")), renderMiniItem("회사 코드", stats.context?.code || "-", renderBadge("Code", "green")), renderMiniItem("시간대", stats.context?.timezone || "Asia/Seoul", renderBadge("Timezone", "gray")), renderMiniItem("기본 정책", stats.context?.defaultWorkPolicyName || "-", renderBadge("Policy", "orange"))] },
          secondary: { description: "지오펜스 및 인증 모드 준비 상태입니다.", title: "사업장 인증 정책", type: "list", items: stats.sites.map((site) => renderMiniItem(site?.name || "-", `반경 ${formatNumber(site?.geofenceRadiusMeters || 0)}m`, renderBadge(site?.authMode || (Number(site?.geofenceRadiusMeters || 0) > 0 ? "GPS" : "미설정"), site?.authMode || Number(site?.geofenceRadiusMeters || 0) > 0 ? "green" : "orange"))) },
        },
        profile: {
          metrics: [["이름", state.user?.name || "-", "현재 세션", "tone-blue"], ["이메일", state.user?.loginEmail || "-", "로그인 계정", "tone-green"], ["연결 회사", formatNumber(stats.companies.length), "워크스페이스", "tone-orange"], ["권한", summarizeRoles(state.user?.roles, currentOrganizationId), "현재 워크스페이스 기준", "tone-purple"]],
          primary: { description: "로그인 계정 기본 정보입니다.", title: "프로필", type: "list", items: [renderMiniItem("이름", state.user?.name || "-", renderBadge("Account", "blue")), renderMiniItem("이메일", state.user?.loginEmail || "-", renderBadge("Login", "green")), renderMiniItem("기본 조직", stats.context?.name || "-", renderBadge("Organization", "gray")), renderMiniItem("권한 요약", summarizeRoles(state.user?.roles, currentOrganizationId), renderBadge("Role", "orange"))] },
          secondary: { description: "현재 계정이 접근 가능한 워크스페이스입니다.", title: "연결된 회사", type: "list", items: stats.companies.map((company) => renderMiniItem(company?.name || "-", company?.code || "-", renderBadge(`${formatNumber(company?.userCount || 0)}명`, "blue"))) },
        },
      };

      return summaryMap[view] || {
        metrics: [["구성원", formatNumber(stats.activeUsers.length), "활성 사용자", "tone-blue"], ["사업장", formatNumber(stats.sites.length), "운영 단위", "tone-green"], ["유닛", formatNumber(stats.units.length), "조직 단위", "tone-orange"], ["세션", formatNumber(stats.sessions.length), "오늘 기준", "tone-purple"]],
        primary: { description: meta.description, title: meta.title, type: "list", items: [] },
        secondary: { description: "추가 데이터를 준비 중입니다.", title: "운영 메모", type: "timeline", items: [renderTimelineItem("데이터 준비", "현재 bootstrap 데이터와 연계된 화면입니다.", renderBadge("Guide", "blue"))] },
      };
    }

    function renderSummaryContent(content) {
      if (content.type === "bars") {
        return renderBarList(content.items || [], content.suffix || "건");
      }

      if (content.type === "timeline") {
        return `<div class="timeline-list">${(content.items || []).join("")}</div>`;
      }

      return renderMiniList(content.items || [], `${content.title} 데이터가 없습니다.`, "표시할 정보가 아직 없습니다.");
    }

    function renderSummaryView(view, state = {}) {
      const stats = buildStats(state);
      const meta = getViewMeta(view);
      const spec = buildSummarySpec(view, stats, state);

      return `
        <section class="view-stack">
          <section class="dashboard-hero">
            <article class="hero-card">
              <p class="page-kicker">${escapeHtml(meta.kicker)}</p>
              <h3>${escapeHtml(meta.title)} 화면을 AdmitCard 셸 스타일로 재구성했습니다.</h3>
              <p>${escapeHtml(meta.description)}</p>
            </article>
            <article class="panel-card workmate-hero-side">
              <div class="timeline-list">
                ${renderTimelineItem("회사", stats.context?.name || "회사 정보 없음", renderBadge("Workspace", "blue"))}
                ${renderTimelineItem("기본 정책", stats.context?.defaultWorkPolicyName || "-", renderBadge("Policy", "green"))}
                ${renderTimelineItem("시간대", stats.context?.timezone || "Asia/Seoul", renderBadge("Timezone", "gray"))}
              </div>
            </article>
          </section>

          <section class="metric-grid">
            ${spec.metrics.map((metric) => renderMetricCard(metric[0], metric[1], metric[2], metric[3])).join("")}
          </section>

          <section class="content-grid">
            <article class="panel-card">
              ${renderSummaryContent(spec.primary)}
            </article>
            <article class="panel-card">
              ${renderSummaryContent(spec.secondary)}
            </article>
          </section>
        </section>
      `;
    }

    return Object.freeze({
      renderSummaryView,
    });
  }

  return Object.freeze({ create });
});
