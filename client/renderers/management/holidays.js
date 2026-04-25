(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementHolidaysRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementHolidaysRenderer(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatNumber,
      renderBadge,
      renderEmptyState,
      toArray,
    } = deps;

  function formatManagementHolidayDate(value = "") {
    if (!value) {
      return "-";
    }

    const date = new Date(`${String(value || "").trim()}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }

    return new Intl.DateTimeFormat("ko-KR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(date);
  }

  function renderManagementHolidayYearOptions(selectedYear = new Date().getFullYear()) {
    const centerYear = Number(selectedYear || new Date().getFullYear());
    const years = [];

    for (let year = centerYear - 5; year <= centerYear + 5; year += 1) {
      years.push(year);
    }

    return years.map((year) => `
      <option value="${escapeAttribute(year)}"${year === centerYear ? " selected" : ""}>${escapeHtml(`${year}년`)}</option>
    `).join("");
  }

  function renderManagementHolidayRows(items = []) {
    const rows = toArray(items);

    if (rows.length === 0) {
      return `
        <article class="workmate-grid-empty-row">
          <div class="workmate-worksite-grid-empty-copy">
            <strong>등록된 공휴일이 없습니다.</strong>
            <p>선택한 연도 기준으로 생성된 공휴일이 없습니다.</p>
          </div>
        </article>
      `;
    }

    return `
      <div class="workmate-holiday-grid">
        <div class="workmate-holiday-grid-head">
          <span>날짜</span>
          <span>요일</span>
          <span>공휴일</span>
          <span>분류</span>
          <span>비고</span>
          <span class="workmate-worksite-grid-action-head">설정</span>
          <span class="workmate-worksite-grid-action-head">삭제</span>
        </div>
        ${rows.map((item) => `
          <article class="workmate-holiday-grid-row${item?.isCustom ? " is-custom" : ""}${item?.isSubstitute ? " is-substitute" : ""}">
            <div class="workmate-holiday-grid-cell">
              <strong>${escapeHtml(formatManagementHolidayDate(item?.date || ""))}</strong>
              <span>${escapeHtml(item?.date || "-")}</span>
            </div>
            <div class="workmate-holiday-grid-cell">
              <strong>${escapeHtml(item?.weekdayLabel || "-")}</strong>
            </div>
            <div class="workmate-holiday-grid-cell">
              <strong>${escapeHtml(item?.name || "공휴일")}</strong>
            </div>
            <div class="workmate-holiday-grid-cell">
              ${renderBadge(item?.typeLabel || "공휴일", item?.tone || "gray")}
            </div>
            <div class="workmate-holiday-grid-cell">
              <span>${escapeHtml(item?.isSubstitute && Array.isArray(item?.substituteOf) && item.substituteOf.length > 0
                ? `기준 공휴일: ${item.substituteOf.join(" · ")}`
                : item?.isCustom
                  ? [(item?.repeatLabel || "").trim(), item?.anchorDate && item.anchorDate !== item.date ? `기준일: ${item.anchorDate}` : ""].filter(Boolean).join(" · ") || "직접 지정한 공휴일"
                : item?.isPaidHoliday
                  ? "유급 공휴일"
                  : "-")}</span>
            </div>
            <div class="workmate-holiday-grid-cell workmate-worksite-grid-actions">
              ${item?.isCustom && item?.id
                ? `
                  <button class="icon-button table-inline-icon-button workmate-worksite-record-action" data-management-holiday-open="${escapeAttribute(item?.id || "")}" type="button" aria-label="지정 공휴일 설정">
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="2.6"></circle>
                      <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                    </svg>
                  </button>
                `
                : `<span class="workmate-holiday-grid-action-placeholder">-</span>`}
            </div>
            <div class="workmate-holiday-grid-cell workmate-worksite-grid-actions">
              ${item?.isCustom && item?.id
                ? `
                  <button class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button" data-management-holiday-delete="${escapeAttribute(item?.id || "")}" type="button" aria-label="지정 공휴일 삭제">
                    <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4.5 7.5h15"></path>
                      <path d="M9.5 3.5h5"></path>
                      <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                      <path d="M10 10.5v5"></path>
                      <path d="M14 10.5v5"></path>
                    </svg>
                  </button>
                `
                : `<span class="workmate-holiday-grid-action-placeholder">-</span>`}
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderManagementHolidayRepeatOptions(selectedRepeatUnit = "NONE") {
    const normalizedRepeatUnit = String(selectedRepeatUnit || "NONE").trim().toUpperCase() || "NONE";
    const options = [
      ["NONE", "반복 안 함"],
      ["YEAR", "년"],
      ["MONTH", "월"],
      ["WEEK", "주"],
    ];

    return options.map(([value, label]) => `
      <option value="${escapeAttribute(value)}"${value === normalizedRepeatUnit ? " selected" : ""}>${escapeHtml(label)}</option>
    `).join("");
  }

  function renderManagementHolidayModal(state = {}) {
    if (!state.managementHolidayModalOpen) {
      return "";
    }

    const draft = state.managementHolidayDraft || {};
    const selectedYear = Number(state.managementHolidayYear || new Date().getFullYear()) || new Date().getFullYear();
    const isEditMode = Boolean(String(draft.holidayId || "").trim());
    const minDate = isEditMode ? "1900-01-01" : `${selectedYear}-01-01`;
    const maxDate = isEditMode ? "2100-12-31" : `${selectedYear}-12-31`;
    const modalTitle = isEditMode ? "지정 공휴일 설정 수정" : "지정 공휴일 추가";
    const modalDescription = isEditMode
      ? "저장된 지정 공휴일의 날짜, 이름, 반복 주기를 수정합니다."
      : "창립기념일처럼 회사에서 직접 운영하는 휴일을 추가합니다.";
    const submitLabel = isEditMode ? "지정 공휴일 업데이트" : "지정 공휴일 추가";
    const hint = isEditMode
      ? "반복 규칙은 기준일을 바탕으로 선택한 연도 목록에 자동 반영됩니다."
      : `${selectedYear}년 안에서만 지정 공휴일을 추가할 수 있습니다.`;

    return `
      <div class="modal" id="management-holiday-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-holiday-modal-title">
        <div class="modal-backdrop" data-management-holiday-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-holiday-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Custom holiday</p>
              <h3 id="management-holiday-modal-title">${escapeHtml(modalTitle)}</h3>
              <p>${escapeHtml(modalDescription)}</p>
            </div>
            <button class="icon-button" data-management-holiday-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-holiday-modal-body">
            <form class="workmate-form-stack" id="management-holiday-form">
              <label class="field" for="management-holiday-date">
                <span>공휴일 날짜</span>
                <input id="management-holiday-date" name="holidayDate" max="${escapeAttribute(maxDate)}" min="${escapeAttribute(minDate)}" required type="date" value="${escapeAttribute(draft.holidayDate || minDate)}" />
              </label>
              <label class="field" for="management-holiday-name">
                <span>공휴일명</span>
                <input id="management-holiday-name" name="name" placeholder="예: 창립기념일" required type="text" value="${escapeAttribute(draft.name || "")}" />
              </label>
              <label class="field select-field" for="management-holiday-repeat-unit">
                <span>반복 주기</span>
                <select id="management-holiday-repeat-unit" name="repeatUnit">
                  ${renderManagementHolidayRepeatOptions(draft.repeatUnit || "NONE")}
                </select>
              </label>
              <p class="workmate-holiday-modal-hint">${escapeHtml(hint)}</p>
              <div class="toolbar-actions">
                <button class="outline-button" data-management-holiday-close="true" type="button">취소</button>
                <button class="outline-button" data-management-holiday-reset="true" type="button">초기화</button>
                <button class="primary-button" type="submit">${escapeHtml(submitLabel)}</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderManagementHolidaysView(state = {}) {
    const holidayData = state.managementHolidayData || {};
    const selectedYear = Number(state.managementHolidayYear || holidayData.year || new Date().getFullYear()) || new Date().getFullYear();
    const items = toArray(holidayData.items);
    const summary = holidayData.summary || {};
    const isLoading = Boolean(state.managementHolidayLoading);
    const customHolidayCount = Number(summary.customHolidayCount || 0);
    const holidayCount = Number(summary.holidayCount || 0);
    const substituteHolidayCount = Number(summary.substituteHolidayCount || 0);
    const totalCount = Number(summary.totalCount || 0);

    return `
      <section class="workmate-admin-content-stack">
        <article class="panel-card workmate-holiday-record-panel">
          <div class="workmate-worksite-panel-head">
            <div>
              <h4>공휴일 설정</h4>
            </div>
            <div class="workmate-topbar-actions workmate-worksite-panel-controls workmate-holiday-panel-controls">
              <div class="workmate-holiday-year-controls">
                <button class="outline-button workmate-holiday-year-nav-button" data-management-holiday-year-nav="-1" type="button" aria-label="이전 연도" title="이전 연도">
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14.5 6.5 9 12l5.5 5.5"></path>
                  </svg>
                </button>
                <label class="field select-field workmate-holiday-year-field">
                  <select data-management-holiday-year-select="true">
                    ${renderManagementHolidayYearOptions(selectedYear)}
                  </select>
                </label>
                <button class="outline-button workmate-holiday-year-nav-button" data-management-holiday-year-nav="1" type="button" aria-label="다음 연도" title="다음 연도">
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9.5 6.5 15 12l-5.5 5.5"></path>
                  </svg>
                </button>
              </div>
              <button class="primary-button" data-management-holiday-open="" type="button">지정 공휴일 추가</button>
            </div>
          </div>
          <div class="workmate-admin-stage-metrics workmate-holiday-stage-metrics">
            <div>
              <span>총 공휴일</span>
              <strong>${escapeHtml(formatNumber(totalCount))}</strong>
            </div>
            <div>
              <span>유급공휴일</span>
              <strong>${escapeHtml(formatNumber(holidayCount))}</strong>
            </div>
            <div>
              <span>대체공휴일</span>
              <strong>${escapeHtml(formatNumber(substituteHolidayCount))}</strong>
            </div>
            <div>
              <span>지정 공휴일</span>
              <strong>${escapeHtml(formatNumber(customHolidayCount))}</strong>
            </div>
          </div>
          ${isLoading
            ? renderEmptyState(`${selectedYear}년 공휴일을 불러오는 중입니다.`, "대한민국 공휴일 캘린더를 동기화하고 있습니다.")
            : renderManagementHolidayRows(items)}
        </article>
        ${renderManagementHolidayModal(state)}
      </section>
    `;
  }

    return Object.freeze({
      renderManagementHolidaysView,
    });
  }

  return Object.freeze({
    create: createManagementHolidaysRenderer,
  });
});
