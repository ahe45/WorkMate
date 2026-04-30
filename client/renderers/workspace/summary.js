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
      formatNumber,
      getViewMeta,
      renderBadge,
      renderBarList,
      renderMetricCard,
      renderMiniItem,
      renderMiniList,
      renderTimelineItem,
    } = dependencies;

    if (typeof buildStats !== "function" || typeof getViewMeta !== "function") {
      throw new Error("WorkMateSummaryRenderer requires stats and view metadata helpers.");
    }

    function formatMetricCount(value, unit = "건") {
      return `${formatNumber(value)}${unit}`;
    }

    function buildSummarySpec(view, stats, state) {
      const meta = getViewMeta(view);
      const summaryMap = {
        schedules: {
          metrics: [
            ["템플릿", formatMetricCount(stats.templates.length, "개"), "등록 완료", "tone-blue"],
            ["유닛", formatMetricCount(stats.units.length, "개"), "배치 그룹", "tone-green"],
            ["대상 사용자", formatMetricCount(stats.users.length, "명"), "스케줄 배포 가능", "tone-orange"],
            ["기본 근무 정책", stats.context?.defaultWorkPolicyName || "-", "현재 기준", "tone-purple"],
          ],
          primary: { description: "현재 회사에 등록된 템플릿입니다.", title: "템플릿 목록", type: "list", items: stats.templates.map((template) => renderMiniItem(template?.name || "-", `${template?.code || "-"} · ${template?.trackType || "FIXED"}`, renderBadge(template?.status || "ACTIVE", "blue"))) },
          secondary: { description: "담당자가 순서대로 확인할 작업입니다.", title: "스케줄 운영 메모", type: "timeline", items: [renderTimelineItem("1. 템플릿 생성", "근무 패턴을 템플릿으로 등록합니다.", renderBadge("필수", "blue")), renderTimelineItem("2. 사용자 배포", "사용자 단위로 일정 적용 기간을 설정합니다.", renderBadge("배포", "green")), renderTimelineItem("3. Clock 검증", "사업장과 사용자 조합으로 실제 인증 결과를 시뮬레이션합니다.", renderBadge("검증", "orange"))] },
        },
        leave: {
          metrics: [["활성 구성원", formatMetricCount(stats.activeUsers.length, "명"), "현재 재직", "tone-blue"], ["최근 입사자", formatMetricCount(stats.recentJoiners.length, "명"), "30일 내", "tone-green"], ["조직 수", formatMetricCount(stats.units.length, "개"), "영향 범위", "tone-orange"], ["사업장 수", formatMetricCount(stats.sites.length, "개"), "대체 인력 기준", "tone-purple"]],
          primary: { description: "휴가 요청이 몰릴 때 우선 확인할 팀 규모입니다.", title: "조직별 커버리지", type: "bars", items: stats.unitDistribution.slice(0, 8).map((unit) => ({ label: unit.name, value: unit.count })), suffix: "명" },
          secondary: { description: "실제 휴가 기능 연결 전에도 운영 기준을 정리할 수 있도록 구성했습니다.", title: "휴가 운영 메모", type: "list", items: [renderMiniItem("휴가 대상자 분류", "사업장과 조직이 정리돼 있으면 승인 대상 구성이 쉬워집니다.", renderBadge("조직 기준", "blue")), renderMiniItem("온보딩 인력 확인", "최근 입사자와 관리자 역할을 먼저 확인하세요.", renderBadge("우선 체크", "green")), renderMiniItem("연락망 보완", "연락처가 없으면 긴급 교대 연락이 지연될 수 있습니다.", renderBadge("리스크", "orange"))] },
        },
        requests: {
          metrics: [["후속 작업", "3건", "현재 큐", "tone-blue"], ["열린 경고", formatMetricCount(stats.anomalies.length, "건"), "우선 처리", "tone-green"], ["기본 사업장 누락", formatMetricCount(stats.usersMissingDefaultSite.length, "명"), "사용자 설정", "tone-orange"], ["정책 점검 사업장", formatMetricCount(Math.max(0, stats.sites.length - stats.authReadySites.length), "개"), "사업장 정책", "tone-purple"]],
          primary: { description: "운영자가 가장 먼저 처리할 항목 순서입니다.", title: "대기 중인 요청", type: "list", items: [renderMiniItem("출퇴근 이상 징후 처리", `${formatNumber(stats.anomalies.length)}건이 관리자 검토를 기다립니다.`, renderBadge("우선순위 높음", stats.anomalies.length > 0 ? "orange" : "green")), renderMiniItem("기본 사업장 보완", `${formatNumber(stats.usersMissingDefaultSite.length)}명의 사용자 설정이 비어 있습니다.`, renderBadge("사용자 관리", "blue")), renderMiniItem("사업장 인증 정책 확인", `${formatNumber(Math.max(0, stats.sites.length - stats.authReadySites.length))}개 사업장이 점검 필요합니다.`, renderBadge("정책", "gray"))] },
          secondary: { description: "승인 플로우 관점으로 배치했습니다.", title: "처리 단계", type: "timeline", items: [renderTimelineItem("접수", "요청과 이상 징후가 발생한 상태", renderBadge("1", "blue")), renderTimelineItem("검토", "관리자가 정책과 일정 영향을 확인", renderBadge("2", "green")), renderTimelineItem("정리", "사용자/사업장 설정을 보완하고 마감 데이터에 반영", renderBadge("3", "orange"))] },
        },
        reports: {
          metrics: [["활성 구성원", formatMetricCount(stats.activeUsers.length, "명"), "보고 대상", "tone-blue"], ["사업장", formatMetricCount(stats.sites.length, "개"), "현장 단위", "tone-green"], ["유닛", formatMetricCount(stats.units.length, "개"), "조직 단위", "tone-orange"], ["평균 근무분", `${formatNumber(stats.averageWorkMinutes)}분`, "오늘 세션 기준", "tone-purple"]],
          primary: { description: "세션 수와 정책 준비 상태를 함께 표기합니다.", title: "사업장 리포트", type: "list", items: stats.siteLoad.map((site) => renderMiniItem(site.name, `세션 ${formatNumber(site.count)}건`, renderBadge(site.ready ? "준비 완료" : "점검 필요", site.ready ? "green" : "orange"))) },
          secondary: { description: "인원 분포를 보고서 카드 형태로 요약합니다.", title: "조직 리포트", type: "list", items: stats.unitDistribution.map((unit) => renderMiniItem(unit.name, unit.path || "경로 정보 없음", renderBadge(`${formatNumber(unit.count)}명`, "blue"))) },
        },
      };

      return summaryMap[view] || {
        metrics: [["구성원", formatMetricCount(stats.activeUsers.length, "명"), "활성 사용자", "tone-blue"], ["사업장", formatMetricCount(stats.sites.length, "개"), "운영 단위", "tone-green"], ["유닛", formatMetricCount(stats.units.length, "개"), "조직 단위", "tone-orange"], ["세션", formatMetricCount(stats.sessions.length, "건"), "오늘 기준", "tone-purple"]],
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
