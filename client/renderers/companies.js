(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateCompaniesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createCompaniesRenderer(deps = {}) {
    const {
      COMPANY_PAGE_META,
      escapeAttribute,
      escapeHtml,
      formatNumber,
      toArray,
    } = deps;

  function renderCompanyCreateModal() {
    return `
      <div class="modal hidden" id="company-create-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="company-create-title">
        <div class="modal-backdrop" data-company-create-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-company-create-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Workspace add</p>
              <h3 id="company-create-title">회사 생성</h3>
            </div>
            <button class="icon-button" data-company-create-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-company-create-modal-body">
            <form class="workmate-form-stack" id="company-form">
              <label class="field" for="company-code">
                <span>회사 코드</span>
                <input id="company-code" type="text" placeholder="ALPHA" required />
              </label>
              <label class="field" for="company-name">
                <span>회사 이름</span>
                <input id="company-name" type="text" placeholder="알파 컴퍼니" required />
              </label>
              <p class="login-error hidden" id="company-form-error" aria-live="polite"></p>
              <div class="toolbar-actions">
                <button class="outline-button" data-company-create-close="true" type="button">취소</button>
                <button class="primary-button" type="submit">회사 생성</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderAccountSettingsModal(state = {}) {
    return `
      <div class="modal hidden" id="account-settings-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
        <div class="modal-backdrop" data-account-settings-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-account-settings-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Account settings</p>
              <h3 id="account-settings-title">계정 정보 수정</h3>
            </div>
            <button class="icon-button" data-account-settings-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-account-settings-modal-body">
            <form class="workmate-form-stack" id="account-settings-form">
              <label class="field" for="account-settings-name">
                <span>이름</span>
                <input id="account-settings-name" type="text" value="${escapeAttribute(state.user?.name || "")}" required />
              </label>
              <label class="field" for="account-settings-email">
                <span>이메일</span>
                <input id="account-settings-email" type="email" value="${escapeAttribute(state.user?.loginEmail || "")}" readonly />
              </label>
              <label class="field" for="account-settings-phone">
                <span>연락처</span>
                <input id="account-settings-phone" type="text" value="${escapeAttribute(state.user?.phone || "")}" placeholder="010-0000-0000" />
              </label>
              <p class="login-error hidden" id="account-settings-error" aria-live="polite"></p>
              <div class="toolbar-actions">
                <button class="outline-button" data-account-settings-close="true" type="button">취소</button>
                <button class="primary-button" type="submit">저장</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderCompanySettingsModal() {
    return `
      <div class="modal hidden" id="company-settings-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="company-settings-title">
        <div class="modal-backdrop" data-company-settings-close="true" aria-hidden="true"></div>
        <section class="modal-sheet workmate-company-settings-modal-sheet">
          <header class="modal-header">
            <div>
              <p class="page-kicker">Workspace settings</p>
              <h3 id="company-settings-title">워크스페이스 수정</h3>
            </div>
            <button class="icon-button" data-company-settings-close="true" type="button" aria-label="닫기">×</button>
          </header>
          <div class="modal-body workmate-company-settings-modal-body">
            <form class="workmate-form-stack" id="company-settings-form">
              <input id="company-settings-id" type="hidden" />
              <label class="field" for="company-settings-code">
                <span>회사 코드</span>
                <input id="company-settings-code" type="text" required />
              </label>
              <label class="field" for="company-settings-name">
                <span>회사 이름</span>
                <input id="company-settings-name" type="text" required />
              </label>
              <p class="login-error hidden" id="company-settings-error" aria-live="polite"></p>
              <div class="toolbar-actions">
                <button class="outline-button" data-company-settings-close="true" type="button">취소</button>
                <button class="primary-button" type="submit">저장</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  function renderWorkspaceEmptyState() {
    return `
      <div class="workmate-workspace-empty-state">
        <article class="workmate-grid-empty-row">
          <div class="workmate-worksite-grid-empty-copy">
            <strong>등록된 워크스페이스가 없습니다.</strong>
            <p>직급 관리 메뉴의 빈 목록과 같은 톤으로, 여기서 바로 첫 워크스페이스를 추가할 수 있습니다.</p>
          </div>
        </article>
        <button
          class="workmate-title-record-grid-row workmate-worksite-empty-add-card workmate-workspace-empty-add-card"
          data-company-create-open="true"
          type="button"
        >
          <span class="workmate-worksite-empty-add-label">+ 워크스페이스 추가</span>
        </button>
      </div>
    `;
  }

  function renderCompaniesView(state = {}) {
    const companies = toArray(state.companies);
    const managedOrganizationIds = new Set(toArray(state.user?.managedOrganizationIds).map((organizationId) => String(organizationId || "")));
    const selectedCompanyId = String(state.selectedOrganizationId || "");
    const hasCompanies = companies.length > 0;

    return `
      <section class="view-stack workmate-company-stage">
        <article class="panel-card workmate-company-stage-panel">
          <div class="workmate-company-stage-head">
            <p class="page-kicker">${escapeHtml(COMPANY_PAGE_META.kicker)}</p>
            <h3>워크스페이스 목록</h3>
          </div>

          ${hasCompanies ? `
            <div class="workmate-workspace-list">
              ${companies.map((company) => {
              const companyId = String(company?.id || "");
              const canManageCompany = Boolean(company?.isManaged) || managedOrganizationIds.has(companyId);

              return `
                <article
                  class="workmate-workspace-item${companyId === selectedCompanyId ? " is-active" : ""}"
                >
                  <button
                    class="workmate-workspace-item-main"
                    data-company-open="${escapeAttribute(company?.code || "")}"
                    data-company-id="${escapeAttribute(companyId)}"
                    type="button"
                  >
                    <div class="workmate-workspace-item-copy">
                      <div class="workmate-workspace-item-head">
                        <div>
                          <strong>${escapeHtml(company?.name || "-")}</strong>
                          <span class="workmate-workspace-item-code">${escapeHtml(company?.code || "-")}</span>
                        </div>
                        <div class="workmate-workspace-item-meta">
                          <span>사업장 ${escapeHtml(formatNumber(company?.siteCount || 0))}개</span>
                          <span>사용자 ${escapeHtml(formatNumber(company?.userCount || 0))}명</span>
                        </div>
                      </div>
                    </div>
                    <span class="workmate-workspace-item-cta" aria-hidden="true">접속하기</span>
                  </button>
                  ${canManageCompany ? `
                    <div class="workmate-workspace-item-actions">
                      <button
                        class="secondary-button workmate-workspace-settings-button"
                        data-company-settings-open="true"
                        data-company-id="${escapeAttribute(companyId)}"
                        data-company-code="${escapeAttribute(company?.code || "")}"
                        data-company-name="${escapeAttribute(company?.name || "")}"
                        type="button"
                      >
                        설정
                      </button>
                    </div>
                  ` : ""}
                </article>
              `;
            }).join("")}
            </div>
          ` : renderWorkspaceEmptyState()}

          ${hasCompanies ? `
            <button class="outline-button workmate-workspace-add-button" data-company-create-open="true" type="button">
              <span class="workmate-workspace-add-icon" aria-hidden="true">+</span>
              <span>워크스페이스 추가</span>
            </button>
          ` : ""}
        </article>

        ${renderCompanyCreateModal()}
        ${renderAccountSettingsModal(state)}
        ${renderCompanySettingsModal()}
      </section>
    `;
  }

    return Object.freeze({
      renderCompaniesView,
    });
  }

  return Object.freeze({
    create: createCompaniesRenderer,
  });
});
