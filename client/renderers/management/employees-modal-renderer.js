(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeesModalRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createManagementEmployeesModalRenderer(deps = {}) {
    const {
      buildManagementUnitModel,
      canRequestManagementEmployeeJoin,
      escapeAttribute,
      escapeHtml,
      formatManagementEmployeeCardMeta,
      formatManagementEmployeeExcelMeta,
      formatManagementEmployeeFullName,
      formatManagementEmployeeTenure,
      getEmployeeStatusMeta,
      hasManagementEmployeeRequiredFields,
      renderBadge,
      renderManagementEmployeeExcelPreview,
      renderManagementEmployeeJobTitleOptions,
      renderManagementEmployeeRoleOptions,
      renderManagementEmployeeSelectOptions,
      renderManagementEmployeeUnitOptions,
      renderRequiredIcon,
    } = deps;

    function renderManagementEmployeeModal(state = {}, stats = {}) {
      if (!state.managementEmployeeModalOpen) {
        return "";
      }

      const draft = state.managementEmployeeDraft || {};
      const statusMeta = getEmployeeStatusMeta(draft.managementStatus || draft.employmentStatus);
      const hasSelectedUnit = Boolean(String(draft.primaryUnitId || "").trim());
      const hasRequiredFields = hasManagementEmployeeRequiredFields(draft);
      const canInvite = canRequestManagementEmployeeJoin(draft, state);
      const unitTreeModel = typeof buildManagementUnitModel === "function" ? buildManagementUnitModel(stats) : null;
      const tenureLabel = formatManagementEmployeeTenure(draft.joinDate, draft.retireDate);
      const fullName = formatManagementEmployeeFullName(draft);

      return `
        <div class="modal" id="management-employee-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-employee-modal-title">
          <div class="modal-backdrop" data-management-employee-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-employee-modal-sheet">
            <header class="modal-header">
              <div class="workmate-employee-modal-copy">
                <h3 id="management-employee-modal-title">${escapeHtml(draft.employeeId ? "직원 정보 관리" : "직원 추가")}</h3>
                <p>기본 인사 정보와 합류 요청 상태를 함께 관리합니다.</p>
              </div>
              <div class="workmate-management-modal-header-actions">
                ${renderBadge(statusMeta.label, statusMeta.tone)}
                <button class="icon-button" data-management-employee-close="true" type="button" aria-label="닫기">×</button>
              </div>
            </header>
            <div class="modal-body workmate-employee-modal-body">
              <form class="workmate-form-stack" id="management-employee-form">
                <section class="workmate-employee-form-section" aria-labelledby="management-employee-section-basic">
                  <div class="workmate-employee-section-head">
                    <strong id="management-employee-section-basic">기본 정보</strong>
                    <span>성명, 연락처, 사번을 입력합니다.</span>
                  </div>
                  <div class="workmate-employee-section-grid">
                    <label class="field" for="management-employee-name">
                      <span>성명 ${renderRequiredIcon()}</span>
                      <input id="management-employee-name" name="name" placeholder="예: 김민수" required type="text" value="${escapeAttribute(fullName)}" />
                    </label>
                    <label class="field" for="management-employee-no">
                      <span>사번 ${renderRequiredIcon()}</span>
                      <input id="management-employee-no" name="employeeNo" placeholder="예: E0001" required type="text" value="${escapeAttribute(draft.employeeNo || "")}" />
                    </label>
                    <div class="workmate-employee-composite-field is-span-2">
                      <span class="workmate-employee-composite-label">연락처 ${renderRequiredIcon()}</span>
                      <div class="workmate-employee-field-pair">
                        <label class="field" for="management-employee-email">
                          <span>이메일</span>
                          <input id="management-employee-email" name="loginEmail" placeholder="name@example.com" required type="email" value="${escapeAttribute(draft.loginEmail || "")}" />
                        </label>
                        <label class="field" for="management-employee-phone">
                          <span>전화번호</span>
                          <input id="management-employee-phone" name="phone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" required type="text" value="${escapeAttribute(draft.phone || "")}" />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="workmate-employee-form-section" aria-labelledby="management-employee-section-org">
                  <div class="workmate-employee-section-head">
                    <strong id="management-employee-section-org">조직 및 직무</strong>
                    <span>소속 조직과 직급을 지정합니다.</span>
                  </div>
                  <div class="workmate-employee-section-grid">
                    <label class="field select-field" for="management-employee-unit">
                      <span>조직 ${renderRequiredIcon()}</span>
                      <select id="management-employee-unit" name="primaryUnitId" required>
                        ${renderManagementEmployeeUnitOptions(stats.units, draft.primaryUnitId, "조직을 선택하세요", unitTreeModel)}
                      </select>
                    </label>
                    <label class="field select-field" for="management-employee-job-title">
                      <span>직급 ${renderRequiredIcon()}</span>
                      <select id="management-employee-job-title" name="jobTitleId" required${hasSelectedUnit ? "" : " disabled"}>
                        ${renderManagementEmployeeJobTitleOptions(stats.jobTitles, draft.jobTitleId, draft.primaryUnitId)}
                      </select>
                    </label>
                  </div>
                </section>

                <section class="workmate-employee-form-section" aria-labelledby="management-employee-section-history">
                  <div class="workmate-employee-section-head">
                    <strong id="management-employee-section-history">재직 상태 및 이력</strong>
                    <span>입퇴사일과 근속기간을 관리합니다.</span>
                  </div>
                  <div class="workmate-employee-section-grid workmate-employee-history-grid">
                    <label class="field" for="management-employee-join-date">
                      <span>입사일 ${renderRequiredIcon()}</span>
                      <input id="management-employee-join-date" name="joinDate" required type="date" value="${escapeAttribute(draft.joinDate || "")}" />
                    </label>
                    <label class="field" for="management-employee-retire-date">
                      <span>퇴사일</span>
                      <input id="management-employee-retire-date" name="retireDate" type="date" value="${escapeAttribute(draft.retireDate || "")}" />
                    </label>
                    <div class="workmate-employee-tenure-card" aria-live="polite">
                      <span>근속기간</span>
                      <strong id="management-employee-tenure-value">${escapeHtml(tenureLabel)}</strong>
                    </div>
                  </div>
                </section>

                <section class="workmate-employee-form-section" aria-labelledby="management-employee-section-system-policy">
                  <div class="workmate-employee-section-head">
                    <strong id="management-employee-section-system-policy">시스템 정책</strong>
                    <span>권한과 근로정책을 지정합니다.</span>
                  </div>
                  <div class="workmate-employee-section-grid">
                    <label class="field select-field" for="management-employee-role">
                      <span>권한 ${renderRequiredIcon()}</span>
                      <select id="management-employee-role" name="roleCode" required>
                        ${renderManagementEmployeeRoleOptions(draft.roleCode)}
                      </select>
                    </label>
                    <label class="field select-field" for="management-employee-work-policy">
                      <span>근로정책 ${renderRequiredIcon()}</span>
                      <select id="management-employee-work-policy" name="workPolicyId" required>
                        ${renderManagementEmployeeSelectOptions(stats.workPolicies, draft.workPolicyId, "근로정책을 선택하세요")}
                      </select>
                    </label>
                  </div>
                </section>

                <section class="workmate-employee-form-section" aria-labelledby="management-employee-section-extra">
                  <div class="workmate-employee-section-head">
                    <strong id="management-employee-section-extra">기타 정보</strong>
                    <span>메모와 인사기록카드 파일을 보관합니다.</span>
                  </div>
                  <label class="field" for="management-employee-note">
                    <span>메모</span>
                    <textarea id="management-employee-note" name="note" placeholder="직원 관리 참고사항을 남길 수 있습니다." rows="4">${escapeHtml(draft.note || "")}</textarea>
                  </label>
                  <div class="workmate-employee-upload-row">
                    <label class="field workmate-employee-file-field workmate-employee-card-dropzone" data-management-employee-card-dropzone="true" for="management-employee-card-file">
                      <span>인사기록카드 업로드</span>
                      <input accept=".pdf,.png,.jpg,.jpeg,.webp" class="workmate-employee-card-file-input" data-management-employee-card-file="true" id="management-employee-card-file" name="personnelCardFile" type="file" />
                      <span class="workmate-employee-card-dropzone-box">
                        <strong>파일을 선택하거나 여기에 드래그&드롭하세요</strong>
                        <em>파일 선택</em>
                      </span>
                    </label>
                    <div class="field workmate-employee-card-file-field">
                      <span>업로드된 파일</span>
                      <div class="workmate-employee-file-summary" id="management-employee-card-file-summary">
                        <div class="workmate-employee-file-summary-copy">
                          <strong id="management-employee-card-file-name">${escapeHtml(draft.personnelCard?.name || "업로드된 파일 없음")}</strong>
                          <span id="management-employee-card-file-meta">${escapeHtml(formatManagementEmployeeCardMeta(draft.personnelCard))}</span>
                        </div>
                        <button class="outline-button workmate-employee-card-download-button" data-management-employee-card-download="true" type="button"${draft.personnelCard?.dataUrl ? "" : " disabled"}>다운로드</button>
                      </div>
                    </div>
                  </div>
                </section>

                <div class="form-inline-message hidden" id="management-employee-error" role="alert"></div>
              </form>
            </div>
            <footer class="modal-toolbar workmate-employee-modal-toolbar">
              <div class="workmate-employee-toolbar-left-actions">
                <button class="outline-button" data-management-employee-close="true" type="button">취소</button>
                ${draft.employeeId ? '<button class="outline-button danger-button" data-management-employee-delete-open="true" type="button">직원 삭제</button>' : ""}
              </div>
              <div class="workmate-employee-toolbar-actions">
                <button class="secondary-button" data-management-employee-submit="draft" type="button"${hasRequiredFields ? " disabled" : ""}>임시 저장</button>
                <button class="primary-button" data-management-employee-submit="save" type="button">저장</button>
                <button class="ghost-button" data-management-employee-submit="invite" type="button"${canInvite ? "" : " disabled"}>합류 요청</button>
              </div>
            </footer>
          </section>
        </div>
      `;
    }

    function renderManagementEmployeeDeleteConfirmModal(state = {}) {
      if (!state.managementEmployeeDeleteConfirmOpen) {
        return "";
      }

      const draft = state.managementEmployeeDraft || {};
      const displayName = formatManagementEmployeeFullName(draft) || "선택한 직원";

      return `
        <div class="modal workmate-employee-delete-modal" id="management-employee-delete-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-employee-delete-title">
          <div class="modal-backdrop" data-management-employee-delete-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-employee-delete-sheet">
            <header class="modal-header">
              <div class="workmate-employee-modal-copy">
                <h3 id="management-employee-delete-title">직원 데이터 삭제</h3>
                <p>서비스 계정은 삭제하지 않고 이 워크스페이스의 직원 멤버십만 삭제합니다.</p>
              </div>
              <button class="icon-button" data-management-employee-delete-close="true" type="button" aria-label="닫기">×</button>
            </header>
            <div class="modal-body workmate-employee-delete-body">
              <div class="workmate-employee-delete-warning">
                <strong>${escapeHtml(displayName)} 직원 데이터를 삭제합니다.</strong>
                <span>${escapeHtml(draft.loginEmail || "-")} · ${escapeHtml(draft.employeeNo || "-")}</span>
              </div>
              <label class="field" for="management-employee-delete-password">
                <span>현재 로그인 계정 비밀번호</span>
                <input id="management-employee-delete-password" autocomplete="current-password" type="password" />
              </label>
              <p class="form-inline-message hidden" id="management-employee-delete-error" role="alert"></p>
            </div>
            <footer class="modal-toolbar workmate-employee-delete-toolbar">
              <button class="outline-button" data-management-employee-delete-close="true" type="button">취소</button>
              <button class="primary-button danger-primary-button" data-management-employee-delete-submit="true" type="button">최종 삭제</button>
            </footer>
          </section>
        </div>
      `;
    }

    function renderManagementEmployeeInviteChannelModal(state = {}) {
      if (!state.managementEmployeeInviteChannelModalOpen) {
        return "";
      }

      const isSending = Boolean(state.managementEmployeeInviteProgress?.active);

      return `
        <div class="modal workmate-employee-invite-channel-modal" id="management-employee-invite-channel-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-employee-invite-channel-title">
          <div class="modal-backdrop" data-management-employee-invite-channel-close="true" aria-hidden="true"></div>
          <section class="modal-sheet workmate-employee-invite-channel-sheet">
            <header class="modal-header">
              <div class="workmate-employee-modal-copy">
                <h3 id="management-employee-invite-channel-title">합류 요청 전송 방식 선택</h3>
                <p>이번 합류 요청을 어떤 방식으로 보낼지 선택하세요.</p>
              </div>
              <button class="icon-button" data-management-employee-invite-channel-close="true" type="button" aria-label="닫기">×</button>
            </header>
            <div class="modal-body workmate-employee-invite-channel-body">
              <button class="workmate-employee-invite-choice" data-management-employee-invite-channel="EMAIL" type="button"${isSending ? " disabled" : ""}>
                <strong>이메일로 보내기</strong>
                <span>직원 이메일로 합류 링크를 전송합니다.</span>
              </button>
              <button class="workmate-employee-invite-choice" data-management-employee-invite-channel="SMS" type="button"${isSending ? " disabled" : ""}>
                <strong>문자로 보내기</strong>
                <span>직원 전화번호로 합류 링크를 전송합니다.</span>
              </button>
            </div>
          </section>
        </div>
      `;
    }

    function renderManagementEmployeeInviteProgressOverlay(state = {}) {
      const progress = state.managementEmployeeInviteProgress || {};

      if (!progress.active) {
        return "";
      }

      const channelLabel = String(progress.channelLabel || "선택한 방식").trim();
      const message = String(progress.message || `${channelLabel}으로 합류 요청을 전송하고 있습니다.`).trim();
      const progressLabel = String(progress.progressLabel || "합류 요청 전송").trim();

      return `
        <div class="busy-overlay workmate-employee-invite-progress-overlay" data-management-employee-invite-progress="true" aria-hidden="false">
          <div class="busy-overlay-backdrop" aria-hidden="true"></div>
          <section class="busy-overlay-panel" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="busy-spinner" aria-hidden="true"></div>
            <strong>합류 요청 전송 중</strong>
            <p>${escapeHtml(`${message}\n잠시만 기다려 주세요.`)}</p>
            <div class="busy-overlay-progress" role="status" aria-live="polite">
              <div class="busy-overlay-progress-meta">
                <span>${escapeHtml(progressLabel)}</span>
                <span class="busy-overlay-progress-value">진행 중</span>
              </div>
              <div class="progress-bar is-indeterminate" aria-hidden="true">
                <span></span>
              </div>
            </div>
          </section>
        </div>
      `;
    }

    function renderManagementEmployeeExcelModal(state = {}) {
      if (!state.managementEmployeeExcelModalOpen) {
        return "";
      }

      const upload = state.managementEmployeeExcelUpload || {};
      const hasUploadRows = Math.max(0, Number(upload.rowCount || 0) || 0) > 0;

      return `
        <div class="modal" id="management-employee-excel-modal" aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="management-employee-excel-modal-title">
          <div class="modal-backdrop" data-management-employee-excel-close="true" aria-hidden="true"></div>
          <section class="modal-sheet upload-modal-sheet workmate-employee-excel-modal-sheet">
            <header class="modal-header">
              <div class="workmate-employee-modal-copy">
                <h3 id="management-employee-excel-modal-title">직원 데이터 업로드</h3>
                <p>직원 정보를 엑셀 파일로 등록하고, 상태별 반영 건수를 실행 전 미리 확인합니다.</p>
              </div>
              <button class="icon-button" data-management-employee-excel-close="true" type="button" aria-label="닫기">×</button>
            </header>
            <div class="modal-body workmate-employee-excel-modal-body">
              <div class="upload-grid workmate-employee-excel-upload-grid">
                <article class="upload-card">
                  <div class="workmate-employee-excel-card-copy">
                    <h4>직원 엑셀 업로드</h4>
                    <p>성, 이름, 사번, 권한, 조직, 직급, 근로정책, 입사일, 이메일, 전화번호 컬럼을 포함한 파일을 업로드하세요.</p>
                  </div>
                  <div class="upload-card-actions">
                    <button class="ghost-button upload-template-button" data-management-employee-excel-template-download="true" type="button">양식 다운로드</button>
                  </div>
                  <div class="workmate-employee-excel-card-meta">
                    <span>지원 형식</span>
                    <strong>XLSX, XLS, CSV</strong>
                  </div>
                  <div class="upload-dropzone">
                    <input class="upload-file-input" accept=".csv,.xlsx,.xls" data-management-employee-excel-file="true" id="management-employee-excel-file" type="file" />
                    <label class="secondary-button upload-select-button" data-management-employee-excel-trigger="true" for="management-employee-excel-file">파일 선택</label>
                    <strong id="management-employee-excel-file-name">${escapeHtml(upload.fileName || "선택된 데이터 파일이 없습니다.")}</strong>
                    <span>${escapeHtml(formatManagementEmployeeExcelMeta(upload))}</span>
                  </div>
                  <div class="workmate-employee-excel-card-hint">
                    <p>상태 컬럼은 임시 저장, 미합류, 합류요청, 합류, 비활성, 퇴사 값을 지원합니다.</p>
                    <p>미합류/합류 요청/합류 완료 행은 필수값이 누락되면 등록되지 않을 수 있습니다.</p>
                  </div>
                </article>
                <section class="upload-preview-panel workmate-employee-excel-preview-panel" aria-live="polite">
                  ${renderManagementEmployeeExcelPreview(state)}
                </section>
              </div>
              <div class="form-inline-message hidden" id="management-employee-excel-error" role="alert"></div>
            </div>
            <footer class="modal-toolbar upload-panel-footer workmate-employee-excel-toolbar">
              <button class="outline-button" data-management-employee-excel-close="true" type="button">취소</button>
              <button class="primary-button" data-management-employee-excel-submit="true" type="button"${hasUploadRows ? "" : " disabled"}>업로드 실행</button>
            </footer>
          </section>
        </div>
      `;
    }

    return Object.freeze({
      renderManagementEmployeeDeleteConfirmModal,
      renderManagementEmployeeExcelModal,
      renderManagementEmployeeInviteChannelModal,
      renderManagementEmployeeInviteProgressOverlay,
      renderManagementEmployeeModal,
    });
  }

  return Object.freeze({
    create: createManagementEmployeesModalRenderer,
  });
});
