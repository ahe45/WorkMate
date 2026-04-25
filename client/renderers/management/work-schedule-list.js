(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkScheduleListRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkScheduleListRenderer(deps = {}) {
    const {
      escapeHtml,
      formatDateRange,
      formatNumber,
      formatTime,
      formatTimeRange,
      getManagementWorkPolicyInformation,
      getScheduleTypeMeta,
      renderBadge,
      toArray,
    } = deps;

  function getManagementWorkScheduleDayName(dayOfWeek = 0) {
    const normalizedDay = Number(dayOfWeek || 0);
    const labels = {
      1: "월",
      2: "화",
      3: "수",
      4: "목",
      5: "금",
      6: "토",
      7: "일",
    };

    return labels[normalizedDay] || "-";
  }

  function getManagementWorkScheduleWorkingDays(template = {}) {
    return toArray(template?.days)
      .filter((day) => Boolean(Number(day?.isWorkingDay ?? 1)) && (day?.startTime || day?.endTime))
      .slice()
      .sort((left, right) => Number(left?.dayOfWeek || 0) - Number(right?.dayOfWeek || 0));
  }

  function formatManagementWorkScheduleDayLabel(days = []) {
    const workingDays = toArray(days);
    const dayNumbers = workingDays.map((day) => Number(day?.dayOfWeek || 0)).filter(Boolean);
    const dayKey = dayNumbers.join(",");

    if (dayNumbers.length === 0) {
      return "근무일 없음";
    }

    if (dayKey === "1,2,3,4,5") {
      return "월-금";
    }

    if (dayKey === "1,2,3,4,5,6") {
      return "월-토";
    }

    if (dayKey === "1,2,3,4,5,6,7") {
      return "매일";
    }

    return dayNumbers.map(getManagementWorkScheduleDayName).join(", ");
  }

  function formatManagementWorkScheduleTimePattern(days = []) {
    const patterns = Array.from(new Set(toArray(days).map((day) => {
      const timeRange = formatTimeRange(day?.startTime || "", day?.endTime || "");
      const breakMinutes = Number(day?.breakMinutes || 0);

      return breakMinutes > 0
        ? `${timeRange} · 휴게 ${formatNumber(breakMinutes)}분`
        : timeRange;
    }).filter(Boolean)));

    if (patterns.length === 0) {
      return "-";
    }

    if (patterns.length === 1) {
      return patterns[0];
    }

    return `${patterns[0]} 외 ${formatNumber(patterns.length - 1)}개 패턴`;
  }

  function buildManagementWorkScheduleModel(stats = {}) {
    const templates = toArray(stats.templates);
    const sitesById = new Map(toArray(stats.sites).map((site) => [String(site?.id || "").trim(), site]).filter(([siteId]) => Boolean(siteId)));
    const typeOrder = ["내근", "외근", "사업", "재택", "휴일"];
    const typeCounts = new Map();
    const records = templates.map((template) => {
      const typeMeta = getScheduleTypeMeta(template?.trackType, template?.name);
      const workingDays = getManagementWorkScheduleWorkingDays(template);
      const defaultSiteId = String(template?.defaultSiteId || "").trim();
      const defaultSite = defaultSiteId ? sitesById.get(defaultSiteId) : null;
      const effectiveRange = formatDateRange(template?.effectiveFrom || "", template?.effectiveTo || "");
      const normalizedTypeLabel = String(typeMeta.label || "근무").trim() || "근무";

      typeCounts.set(normalizedTypeLabel, Number(typeCounts.get(normalizedTypeLabel) || 0) + 1);

      return {
        ...template,
        defaultSiteName: defaultSite?.name || (defaultSiteId ? "등록되지 않은 근무지" : "사용자 기본 근무지"),
        effectiveRange,
        typeLabel: normalizedTypeLabel,
        typeTone: typeMeta.tone || "blue",
        workingDayLabel: formatManagementWorkScheduleDayLabel(workingDays),
        workingDays,
        workingTimeLabel: formatManagementWorkScheduleTimePattern(workingDays),
      };
    }).sort((left, right) => {
      const leftTypeOrder = typeOrder.indexOf(left.typeLabel);
      const rightTypeOrder = typeOrder.indexOf(right.typeLabel);
      const normalizedLeftOrder = leftTypeOrder === -1 ? Number.MAX_SAFE_INTEGER : leftTypeOrder;
      const normalizedRightOrder = rightTypeOrder === -1 ? Number.MAX_SAFE_INTEGER : rightTypeOrder;

      if (normalizedLeftOrder !== normalizedRightOrder) {
        return normalizedLeftOrder - normalizedRightOrder;
      }

      return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
        numeric: true,
        sensitivity: "base",
      });
    });

    return {
      records,
      summary: {
        businessCount: Number(typeCounts.get("사업") || 0),
        fixedCount: Number(typeCounts.get("내근") || 0),
        offsiteCount: Number(typeCounts.get("외근") || 0) + Number(typeCounts.get("재택") || 0),
        totalCount: records.length,
      },
      typeCounts,
    };
  }

  function renderManagementWorkScheduleRows(records = []) {
    const rows = toArray(records);

    if (rows.length === 0) {
      return `
        <article class="workmate-grid-empty-row">
          <div class="workmate-worksite-grid-empty-copy">
            <strong>등록된 근무일정 템플릿이 없습니다.</strong>
            <p>현재 회사에 등록된 근무일정 템플릿을 찾을 수 없습니다.</p>
          </div>
        </article>
      `;
    }

    return `
      <div class="workmate-work-schedule-grid">
        <div class="workmate-work-schedule-grid-head">
          <span>유형</span>
          <span>근무일정</span>
          <span>근무 요일</span>
          <span>기본 시간</span>
          <span>기본 근무지</span>
          <span>적용기간</span>
          <span>상태</span>
        </div>
        ${rows.map((record) => `
          <article class="workmate-work-schedule-grid-row">
            <div class="workmate-work-schedule-grid-cell">
              ${renderBadge(record?.typeLabel || "근무", record?.typeTone || "blue")}
            </div>
            <div class="workmate-work-schedule-grid-cell">
              <strong>${escapeHtml(record?.name || "근무일정")}</strong>
              <span>${escapeHtml(record?.code || "-")}</span>
            </div>
            <div class="workmate-work-schedule-grid-cell">
              <strong>${escapeHtml(record?.workingDayLabel || "-")}</strong>
              <span>${escapeHtml(`근무일 ${formatNumber(record?.workingDays?.length || 0)}일`)}</span>
            </div>
            <div class="workmate-work-schedule-grid-cell">
              <strong>${escapeHtml(record?.workingTimeLabel || "-")}</strong>
              <span>${escapeHtml(record?.crossMidnight ? `익일 기준 ${formatTime(record?.nextDayCutoffTime || "04:00:00")} 마감` : "당일 근무")}</span>
            </div>
            <div class="workmate-work-schedule-grid-cell">
              <strong>${escapeHtml(record?.defaultSiteName || "-")}</strong>
              <span>${escapeHtml(record?.defaultSiteId ? "템플릿 기본값" : "개별 사용자 설정 사용")}</span>
            </div>
            <div class="workmate-work-schedule-grid-cell">
              <strong>${escapeHtml(record?.effectiveRange || "-")}</strong>
              <span>${escapeHtml(record?.effectiveTo ? "기간 제한" : "상시 적용")}</span>
            </div>
            <div class="workmate-work-schedule-grid-cell">
              ${renderBadge(record?.status || "ACTIVE", String(record?.status || "").toUpperCase() === "ACTIVE" ? "green" : "gray")}
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

    return Object.freeze({
      buildManagementWorkScheduleModel,
      formatManagementWorkScheduleDayLabel,
      formatManagementWorkScheduleTimePattern,
      getManagementWorkScheduleDayName,
      getManagementWorkScheduleWorkingDays,
      renderManagementWorkScheduleRows,
    });
  }

  return Object.freeze({
    create: createWorkScheduleListRenderer,
  });
});
