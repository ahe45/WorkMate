(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateRendererDisplay = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatNumber,
    } = dependencies;

    if (
      typeof escapeAttribute !== "function"
      || typeof escapeHtml !== "function"
      || typeof formatNumber !== "function"
    ) {
      throw new Error("WorkMateRendererDisplay requires display dependencies.");
    }

    function renderBadge(label, tone = "blue") {
      return `<span class="badge ${escapeAttribute(tone)}">${escapeHtml(label)}</span>`;
    }

    function renderMetricCard(label, value, meta, tone = "tone-blue") {
      const titleAttribute = String(meta || "").trim()
        ? ` title="${escapeAttribute(String(meta || "").trim())}"`
        : "";

      return `
      <article class="metric-card ${escapeAttribute(tone)}"${titleAttribute}>
        <p>${escapeHtml(label)}</p>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `;
    }

    function renderEmptyState(title, description) {
      return `
      <article class="empty-state">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
      </article>
    `;
    }

    function renderMiniList(items = [], emptyTitle = "표시할 항목이 없습니다.", emptyDescription = "선택한 조건에 맞는 데이터가 아직 없습니다.") {
      if (items.length === 0) {
        return renderEmptyState(emptyTitle, emptyDescription);
      }

      return `<div class="mini-list">${items.join("")}</div>`;
    }

    function renderMiniItem(title, description, badges = "") {
      return `
      <article class="mini-item">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(description)}</span>
        </div>
        <div class="workmate-inline-badges">${badges}</div>
      </article>
    `;
    }

    function renderTimelineItem(title, description, badgeMarkup = "") {
      return `
      <article class="timeline-item">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(description)}</span>
        </div>
        ${badgeMarkup}
      </article>
    `;
    }

    function renderBarList(items = [], suffix = "건") {
      if (items.length === 0) {
        return renderEmptyState("집계 가능한 데이터가 없습니다.", "기본 데이터가 쌓이면 분포를 표시합니다.");
      }

      const maxValue = Math.max(1, ...items.map((item) => Number(item?.value || 0)));

      return `
      <div class="dashboard-bar-list">
        ${items.map((item, index) => {
          const width = Math.max(8, Math.round((Number(item?.value || 0) / maxValue) * 100));
          const tone = index % 3 === 0 ? "blue" : index % 3 === 1 ? "green" : "orange";

          return `
            <div class="dashboard-bar-item">
              <div class="dashboard-bar-head">
                <strong>${escapeHtml(item?.label || "-")}</strong>
                <span>${escapeHtml(`${formatNumber(item?.value || 0)}${suffix}`)}</span>
              </div>
              <div class="dashboard-bar-track">
                <span class="dashboard-bar-fill ${tone}" style="width: ${escapeAttribute(width)}%"></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
    }

    return Object.freeze({
      renderBadge,
      renderBarList,
      renderEmptyState,
      renderMetricCard,
      renderMiniItem,
      renderMiniList,
      renderTimelineItem,
    });
  }

  return Object.freeze({ create });
});
