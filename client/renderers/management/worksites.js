(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksitesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementWorksitesRenderer(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      formatCoordinate,
      formatNumber,
      getDashboardGridState,
      hasDashboardGridFilter,
      renderManagementModalHeaderActions,
      renderDashboardFilterMenu,
      resolveDashboardGridRecords,
      toArray,
    } = deps;

    const MANAGEMENT_WORKSITE_GRID_TABLE_ID = "management-worksites";

  function renderWorksiteSearchResults(state = {}) {
    const results = toArray(state.managementWorksiteSearchResults);
    const status = String(state.managementWorksiteSearchStatus || "").trim();

    if (results.length === 0) {
      return `
        <div class="workmate-worksite-search-empty">
          <strong>${escapeHtml(status || "주소 또는 장소명을 검색해 기준 위치를 찾아보세요.")}</strong>
          <span>검색 결과를 선택하거나 지도에서 직접 클릭해 위치를 지정할 수 있습니다.</span>
        </div>
      `;
    }

    return `
      <div class="workmate-worksite-search-results">
        ${results.map((result, index) => `
          <button class="workmate-worksite-search-result" data-management-worksite-search-result="${escapeAttribute(index)}" type="button">
            <strong>${escapeHtml(result?.name || result?.displayName || "검색 결과")}</strong>
            <span>${escapeHtml(result?.displayName || "")}</span>
            <small>${escapeHtml(`${formatCoordinate(result?.lat)}, ${formatCoordinate(result?.lng)}`)}</small>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderManagementWorksiteSearchModal(state = {}) {
    if (!state.managementWorksiteModalOpen || !state.managementWorksiteSearchModalOpen) {
      return "";
    }

    const query = String(state.managementWorksiteSearchQuery || "").trim();
    return `
      <div class="modal workmate-worksite-search-modal" id="management-worksite-search-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-worksite-search-modal-title">
        <div class="modal-backdrop" data-management-worksite-search-modal-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-worksite-search-modal-sheet">
          <header class="modal-header">
            <div class="workmate-worksite-search-modal-copy">
              <h3 id="management-worksite-search-modal-title">검색 결과 선택</h3>
              <p>${escapeHtml(query ? `"${query}" 검색 결과입니다.` : "검색 결과를 선택하세요.")}</p>
            </div>
            <button class="icon-button" data-management-worksite-search-modal-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-worksite-search-modal-body">
            ${renderWorksiteSearchResults(state)}
          </div>
        </section>
      </div>
    `;
  }

  function renderManagementOrderCell(value = "") {
    return `
      <div class="workmate-management-order-content">
        <span class="workmate-management-order-handle" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M4 6h12"></path>
            <path d="M4 10h12"></path>
            <path d="M4 14h12"></path>
          </svg>
        </span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function getManagementWorksiteGridColumns() {
    return [
      { filterable: false, key: "sortOrder", label: "순서", sortable: false },
      {
        filterable: true,
        getFilterValue: (site) => String(site?.name || "").trim(),
        key: "name",
        label: "근무지명",
        sortable: false,
      },
      { filterable: false, key: "addressLine1", label: "주소", sortable: false },
      { filterable: false, key: "coordinates", label: "좌표", sortable: false },
      { filterable: false, key: "geofenceRadiusMeters", label: "인정 반경", sortable: false },
      { filterable: false, key: "settings", label: "관리", sortable: false },
      { filterable: false, key: "delete", label: "삭제", sortable: false },
    ];
  }

  function sortManagementWorksites(sites = []) {
    return toArray(sites)
      .slice()
      .sort((left, right) => {
        const sortOrderGap = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);

        if (sortOrderGap !== 0) {
          return sortOrderGap;
        }

        return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }

  function renderWorksiteGridHead(isNameFilterActive = false) {
    return `
      <div class="workmate-worksite-grid-head">
        <span class="workmate-worksite-grid-action-head">순서</span>
        <span class="workmate-worksite-grid-head-cell${isNameFilterActive ? " is-filter-active" : ""}">
          <span class="table-header-shell has-filter">
            <span class="table-header-label workmate-worksite-grid-head-label">근무지명</span>
            <button
              class="table-filter-button"
              data-dashboard-grid-filter-open="true"
              data-dashboard-grid-table="${escapeAttribute(MANAGEMENT_WORKSITE_GRID_TABLE_ID)}"
              data-dashboard-grid-column="name"
              type="button"
              aria-label="근무지명 필터 열기"
            >
              <span class="table-filter-glyph" aria-hidden="true"></span>
            </button>
          </span>
        </span>
        <span>주소</span>
        <span>좌표</span>
        <span>인정 반경</span>
        <span class="workmate-worksite-grid-action-head">관리</span>
        <span class="workmate-worksite-grid-action-head">삭제</span>
      </div>
    `;
  }

  function renderWorksiteRecords(state = {}, stats = {}) {
    const selectedSiteId = String(state.managementWorksiteDraft?.siteId || "").trim();
    const sites = sortManagementWorksites(stats.sites);
    const worksiteGridColumns = getManagementWorksiteGridColumns();
    const worksiteGridState = getDashboardGridState(state, MANAGEMENT_WORKSITE_GRID_TABLE_ID);
    const orderedSiteIds = sites.map((site) => String(site?.id || "").trim()).filter(Boolean);
    const unitNameById = new Map(
      toArray(stats.units)
        .filter((unit) => !(String(unit?.code || "").trim().toUpperCase() === "ROOT" && !String(unit?.parentUnitId || "").trim()))
        .map((unit) => [String(unit?.id || "").trim(), String(unit?.name || unit?.code || "").trim()]),
    );
    const { sortedRecords: filteredSites } = resolveDashboardGridRecords(
      sites,
      worksiteGridColumns,
      {
        ...worksiteGridState,
        sortRules: [],
      },
    );
    const isNameFilterActive = hasDashboardGridFilter(worksiteGridState, "name");

    if (sites.length === 0) {
      return `
        <div class="workmate-worksite-grid">
          ${renderWorksiteGridHead(isNameFilterActive)}
          <button class="workmate-worksite-grid-row workmate-worksite-empty-add-card" data-management-worksite-open="" type="button">
            <span class="workmate-worksite-empty-add-label">+ 근무지 추가</span>
          </button>
        </div>
      `;
    }

    if (filteredSites.length === 0) {
      return `
        <div class="workmate-worksite-grid">
          ${renderWorksiteGridHead(isNameFilterActive)}
          <article class="workmate-grid-empty-row">
            <div class="workmate-worksite-grid-empty-copy">
              <strong>필터 결과가 없습니다.</strong>
              <p>${escapeHtml(isNameFilterActive ? "근무지명 필터 조건과 일치하는 항목이 없습니다." : "표시할 근무지가 없습니다.")}</p>
            </div>
          </article>
        </div>
      `;
    }

    return `
      <div class="workmate-worksite-grid" data-management-worksite-order="${escapeAttribute(orderedSiteIds.join(","))}">
        ${renderWorksiteGridHead(isNameFilterActive)}
        ${filteredSites.map((site, index) => {
          const radius = Number(site?.geofenceRadiusMeters || 0);
          const isActive = selectedSiteId && String(site?.id || "") === selectedSiteId;
          const orderLabel = formatNumber(Number(site?.sortOrder || index + 1));
          const siteId = String(site?.id || "").trim();

          return `
            <article class="workmate-worksite-grid-row${isActive ? " is-active" : ""}" data-management-worksite-row="${escapeAttribute(siteId)}" draggable="true">
              <div class="workmate-worksite-grid-cell workmate-management-order-cell">
                ${renderManagementOrderCell(orderLabel)}
              </div>
              <div class="workmate-worksite-grid-cell">
                <div>
                  <strong>${escapeHtml(site?.name || "근무지")}</strong>
                  <span>${escapeHtml(unitNameById.get(String(site?.primaryUnitId || "").trim()) || "전체 조직")}</span>
                </div>
              </div>
              <div class="workmate-worksite-grid-cell">
                <span>${escapeHtml(site?.addressLine1 || "설명 없음")}</span>
              </div>
              <div class="workmate-worksite-grid-cell">
                <span>${escapeHtml(`${formatCoordinate(site?.lat)}, ${formatCoordinate(site?.lng)}`)}</span>
              </div>
              <div class="workmate-worksite-grid-cell">
                <strong>${escapeHtml(`${formatNumber(radius || 0)}m`)}</strong>
              </div>
              <div class="workmate-worksite-grid-cell workmate-worksite-grid-actions">
                <button class="icon-button table-inline-icon-button workmate-worksite-record-action" data-management-worksite-open="${escapeAttribute(site?.id || "")}" type="button" aria-label="근무지 관리">
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="2.6"></circle>
                    <path d="M19 12a7.4 7.4 0 0 0-.08-1.02l2.05-1.58-2-3.46-2.47 1a7.91 7.91 0 0 0-1.76-1.02L14.5 3h-5l-.24 2.92a7.91 7.91 0 0 0-1.76 1.02l-2.47-1-2 3.46 2.05 1.58A7.4 7.4 0 0 0 5 12c0 .34.03.68.08 1.02l-2.05 1.58 2 3.46 2.47-1a7.91 7.91 0 0 0 1.76 1.02L9.5 21h5l.24-2.92a7.91 7.91 0 0 0 1.76-1.02l2.47 1 2-3.46-2.05-1.58c.05-.34.08-.68.08-1.02Z"></path>
                  </svg>
                </button>
              </div>
              <div class="workmate-worksite-grid-cell workmate-worksite-grid-actions">
                <button class="icon-button table-inline-icon-button workmate-worksite-record-action workmate-worksite-delete-button" data-management-worksite-delete="${escapeAttribute(site?.id || "")}" type="button" aria-label="근무지 삭제">
                  <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4.5 7.5h15"></path>
                    <path d="M9.5 3.5h5"></path>
                    <path d="M8 7.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 17.5v-10"></path>
                    <path d="M10 10.5v5"></path>
                    <path d="M14 10.5v5"></path>
                  </svg>
                </button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderManagementWorksiteUnitOptions(units = [], selectedUnitId = "") {
    const normalizedSelectedUnitId = String(selectedUnitId || "").trim();
    const visibleUnits = toArray(units).filter((unit) => {
      const label = String(unit?.name || unit?.code || "").trim();
      const normalizedLabel = label.replace(/[?\uFFFD\s]/g, "");
      const isHiddenRoot = String(unit?.code || "").trim().toUpperCase() === "ROOT" && !String(unit?.parentUnitId || "").trim();
      return !isHiddenRoot && Boolean(label) && label !== "-" && Boolean(normalizedLabel);
    });
    const hasSelectedVisibleUnit = visibleUnits.some((unit) => String(unit?.id || "").trim() === normalizedSelectedUnitId);
    const hiddenSelectedUnit = !hasSelectedVisibleUnit && normalizedSelectedUnitId
      ? toArray(units).find((unit) => String(unit?.id || "").trim() === normalizedSelectedUnitId)
      : null;

    return `
      <option value=""${!normalizedSelectedUnitId ? " selected" : ""}>전체</option>
      ${hiddenSelectedUnit ? `<option value="${escapeAttribute(hiddenSelectedUnit?.id || "")}" selected hidden>전체</option>` : ""}
      ${visibleUnits.map((unit) => `
        <option value="${escapeAttribute(unit?.id || "")}"${String(unit?.id || "").trim() === normalizedSelectedUnitId ? " selected" : ""}>
          ${escapeHtml(unit?.name || unit?.code || "-")}
        </option>
      `).join("")}
    `;
  }

  function renderManagementWorksiteModal(state = {}, stats = {}) {
    if (!state.managementWorksiteModalOpen) {
      return "";
    }

    const draft = state.managementWorksiteDraft || {};
    const searchStatus = String(state.managementWorksiteSearchStatus || "").trim();
    return `
      <div class="modal" id="management-worksite-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-worksite-modal-title">
        <div class="modal-backdrop" data-management-worksite-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-worksite-modal-sheet">
          <header class="modal-header">
            <div>
              <h3 id="management-worksite-modal-title">${escapeHtml(draft.siteId ? "근무지 관리 수정" : "근무지 관리 등록")}</h3>
            </div>
            ${renderManagementModalHeaderActions(state, {
              closeAction: "data-management-worksite-close",
              formId: "management-worksite-form",
              modalType: "worksite",
            })}
          </header>
          <div class="modal-body workmate-worksite-modal-body">
            <div class="workmate-worksite-modal-layout">
              <section class="workmate-worksite-modal-map-stack">
                <div class="workmate-worksite-panel-head">
                  <div>
                    <h4>지도에서 위치 선택</h4>
                    <p>주소를 검색하거나 지도를 클릭해 기준 위치를 지정하세요.</p>
                  </div>
                </div>
                <form class="workmate-worksite-search-form" id="management-worksite-search-form">
                  <label class="field" for="management-worksite-search-query">
                    <span>주소 또는 장소명</span>
                    <div class="workmate-worksite-search-row">
                      <input
                        id="management-worksite-search-query"
                        name="managementWorksiteSearchQuery"
                        placeholder="예: 서울 강남구 테헤란로 152"
                        type="search"
                        value="${escapeAttribute(state.managementWorksiteSearchQuery || "")}"
                      />
                      <button class="primary-button workmate-worksite-search-submit" type="submit" aria-label="주소 검색" title="주소 검색">
                        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="11" cy="11" r="6"></circle>
                          <path d="m16 16 4.5 4.5"></path>
                        </svg>
                      </button>
                    </div>
                  </label>
                </form>
                <p class="workmate-worksite-search-helper">${escapeHtml(searchStatus || "검색 결과는 별도 창에서 선택할 수 있습니다.")}</p>
                <div class="workmate-worksite-map-shell">
                  <div class="workmate-worksite-map" id="management-worksite-map" aria-label="근무지 지도"></div>
                </div>
                <div class="workmate-worksite-map-footer">
                  <span>선택 좌표</span>
                  <strong id="management-worksite-map-coords">${escapeHtml(`${formatCoordinate(draft.lat)}, ${formatCoordinate(draft.lng)}`)}</strong>
                  <span>인정 반경</span>
                  <strong id="management-worksite-map-radius">${escapeHtml(`${formatNumber(draft.geofenceRadiusMeters || 0)}m`)}</strong>
                </div>
              </section>

              <section class="workmate-worksite-modal-form-stack">
                <div class="workmate-worksite-panel-head">
                  <div>
                    <h4>상세 설정</h4>
                    <p>이름, 설명, 반경, 조직 연결 정보를 함께 저장합니다.</p>
                  </div>
                </div>
                <form class="workmate-form-stack" id="management-worksite-form">
                  <div class="form-grid two">
                    <label class="field" for="management-worksite-name">
                      <span>근무지명</span>
                      <input id="management-worksite-name" name="name" placeholder="예: 서울 본사" required type="text" value="${escapeAttribute(draft.name || "")}" />
                    </label>
                    <label class="field select-field" for="management-worksite-unit">
                      <span>연결 조직</span>
                      <select id="management-worksite-unit" name="primaryUnitId">
                        ${renderManagementWorksiteUnitOptions(stats.units, draft.primaryUnitId)}
                      </select>
                    </label>
                  </div>
                  <label class="field" for="management-worksite-address">
                    <span>위치 설명</span>
                    <input id="management-worksite-address" name="addressLine1" placeholder="검색 결과 또는 선택한 위치 설명" type="text" value="${escapeAttribute(draft.addressLine1 || "")}" />
                  </label>
                  <div class="form-grid three">
                    <label class="field" for="management-worksite-lat">
                      <span>위도</span>
                      <input data-management-worksite-coordinate="lat" id="management-worksite-lat" name="lat" required step="0.000001" type="number" value="${escapeAttribute(draft.lat ?? "")}" />
                    </label>
                    <label class="field" for="management-worksite-lng">
                      <span>경도</span>
                      <input data-management-worksite-coordinate="lng" id="management-worksite-lng" name="lng" required step="0.000001" type="number" value="${escapeAttribute(draft.lng ?? "")}" />
                    </label>
                    <label class="field" for="management-worksite-radius">
                      <span>인정 반경(m)</span>
                      <input data-management-worksite-radius="true" id="management-worksite-radius" max="2000" min="20" name="geofenceRadiusMeters" required step="10" type="number" value="${escapeAttribute(draft.geofenceRadiusMeters ?? 100)}" />
                    </label>
                  </div>
                  <input id="management-worksite-site-id" name="siteId" type="hidden" value="${escapeAttribute(draft.siteId || "")}" />
                  <input id="management-worksite-map-metadata" name="mapMetadataJson" type="hidden" value="${escapeAttribute(draft.mapMetadataJson || "")}" />
                </form>
              </section>
            </div>
          </div>
        </section>
      </div>
      ${renderManagementWorksiteSearchModal(state)}
    `;
  }

  function renderManagementWorksitesView(state = {}, stats = {}) {
    const worksiteGridColumns = getManagementWorksiteGridColumns();
    const worksiteRecords = sortManagementWorksites(stats.sites);
    const hasWorksites = worksiteRecords.length > 0;

    return `
        <section class="workmate-admin-content-stack">
        <article class="panel-card workmate-worksite-record-panel">
          <div class="workmate-worksite-panel-head">
            <div>
              <h4>근무지 관리</h4>
              <p>위치 설명, 좌표, 인정 반경, 연결 조직 기준으로 근무지를 관리합니다.</p>
            </div>
            ${hasWorksites ? `
              <div class="workmate-topbar-actions workmate-worksite-panel-controls">
                <button class="primary-button" data-management-worksite-open="" type="button">근무지 추가</button>
              </div>
            ` : `
              <div class="workmate-topbar-actions workmate-worksite-panel-controls is-placeholder" aria-hidden="true">
                <span class="primary-button">근무지 추가</span>
              </div>
            `}
          </div>
          ${renderWorksiteRecords(state, stats)}
        </article>
        ${renderDashboardFilterMenu(state, MANAGEMENT_WORKSITE_GRID_TABLE_ID, worksiteGridColumns, worksiteRecords)}
        ${renderManagementWorksiteModal(state, stats)}
      </section>
    `;
  }

    return Object.freeze({
      getManagementWorksiteGridColumns,
      renderManagementOrderCell,
      renderManagementWorksitesView,
    });
  }

  return Object.freeze({
    create: createManagementWorksitesRenderer,
  });
});
