(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeesRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const modalRendererModule = globalThis.WorkMateManagementEmployeesModalRenderer
    || (typeof require === "function" ? require("./employees-modal-renderer.js") : null);
  const optionsRendererModule = globalThis.WorkMateManagementEmployeesOptionsRenderer
    || (typeof require === "function" ? require("./employees-options-renderer.js") : null);

  function createManagementEmployeesRenderer(deps = {}) {
    const {
      buildManagementUnitModel,
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatNumber,
      renderBadge,
      renderDashboardFilterMenu,
      renderDashboardGridTable,
      renderMetricCard,
      toArray,
    } = deps;

    if (!modalRendererModule || typeof modalRendererModule.create !== "function") {
      throw new Error("client/renderers/management/employees-modal-renderer.js must be loaded before client/renderers/management/employees.js.");
    }

    if (!optionsRendererModule || typeof optionsRendererModule.create !== "function") {
      throw new Error("client/renderers/management/employees-options-renderer.js must be loaded before client/renderers/management/employees.js.");
    }

    const MANAGEMENT_EMPLOYEE_GRID_TABLE_ID = "managementEmployees";
    const employeeOptionsRenderer = optionsRendererModule.create({
      escapeAttribute,
      escapeHtml,
      toArray,
    });
    const {
      buildManagementEmployeeUnitMaps,
      canRequestManagementEmployeeJoin,
      formatManagementEmployeeDateKey,
      formatManagementEmployeeFullName,
      formatManagementEmployeeTenure,
      formatManagementEmployeeUnitLabel,
      getEmployeeStatusMeta,
      getRoleLabel,
      hasManagementEmployeeRequiredFields,
      renderManagementEmployeeJobTitleOptions,
      renderManagementEmployeeRoleOptions,
      renderManagementEmployeeSelectOptions,
      renderManagementEmployeeUnitOptions,
      renderRequiredIcon,
    } = employeeOptionsRenderer;

    function sortManagementEmployeeRecords(users = []) {
      return toArray(users)
        .slice()
        .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "ko"));
    }

    function buildManagementEmployeeRecords(stats = {}) {
      const { hiddenRootIds, unitById } = buildManagementEmployeeUnitMaps(stats.units);

      return sortManagementEmployeeRecords(stats.users).map((user) => {
        const statusMeta = getEmployeeStatusMeta(user?.managementStatus || user?.employmentStatus);
        const primaryUnitId = String(user?.primaryUnitId || "").trim();
        const primaryUnit = unitById.get(primaryUnitId);
        const primaryUnitLabel = primaryUnit
          ? formatManagementEmployeeUnitLabel(primaryUnit, unitById, hiddenRootIds)
          : String(user?.primaryUnitName || "").trim();

        return {
          ...user,
          jobTitleLabel: String(user?.jobTitle || "").trim() || "미지정",
          notePreview: String(user?.note || "").trim(),
          primaryUnitLabel,
          retireDateText: String(user?.retireDate || "").trim(),
          roleLabel: getRoleLabel(user?.roleCode),
          statusLabel: statusMeta.label,
          statusTone: statusMeta.tone,
        };
      });
    }

    function renderEmployeeStatusBadge(record = {}) {
      return renderBadge(record.statusLabel || "임시 저장", record.statusTone || "blue");
    }

    function renderEmployeeEditButton(record = {}) {
      return `
        <button
          class="icon-button table-inline-icon-button"
          data-management-employee-open="${escapeAttribute(record?.id || "")}"
          type="button"
          aria-label="직원 정보 관리"
          title="직원 정보 관리"
        >
          <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4.5 19.5h15"></path>
            <path d="m6.75 15.75 8.9-8.9 2.5 2.5-8.9 8.9-3.25.75.75-3.25Z"></path>
          </svg>
        </button>
      `;
    }

    function formatManagementEmployeeCardMeta(card = null) {
      const size = Math.max(0, Number(card?.size || 0) || 0);

      if (!size) {
        return "PDF 또는 이미지 파일을 선택하세요.";
      }

      return `${String(card?.type || "application/octet-stream").trim() || "application/octet-stream"} · ${formatNumber(Math.max(1, Math.round(size / 1024)))}KB`;
    }

    function formatManagementEmployeeExcelMeta(upload = {}) {
      const size = Math.max(0, Number(upload?.fileSize || 0) || 0);

      if (!size) {
        return "XLSX, XLS, CSV 파일을 선택하세요.";
      }

      return `${String(upload?.fileType || "application/octet-stream").trim() || "application/octet-stream"} · ${formatNumber(Math.max(1, Math.round(size / 1024)))}KB`;
    }

    function renderManagementEmployeeExcelPreview(state = {}) {
      const upload = state.managementEmployeeExcelUpload || {};
      const rowCount = Math.max(0, Number(upload.rowCount || 0) || 0);
      const reviewCount = Math.max(0, Number(upload.reviewCount || 0) || 0);
      const skippedRowCount = Math.max(0, Number(upload.skippedRowCount || 0) || 0);
      const inactiveGroupCount = Math.max(0, Number(upload.inactiveCount || 0) || 0) + Math.max(0, Number(upload.retiredCount || 0) || 0);

      if (!rowCount) {
        if (String(upload.fileName || "").trim()) {
          return `
            <div class="upload-preview-empty">
              <strong>업로드 미리보기</strong>
              <p>선택한 파일에서 반영 가능한 직원 데이터를 찾지 못했습니다.</p>
              ${skippedRowCount > 0 ? `<p>${escapeHtml(`빈 행 ${formatNumber(skippedRowCount)}건이 제외되었습니다.`)}</p>` : ""}
            </div>
          `;
        }

        return `
          <div class="upload-preview-empty">
            <strong>업로드 미리보기</strong>
            <p>직원 데이터 파일을 선택하면 실제 반영 전 예상 등록 건수와 상태 분포를 확인할 수 있습니다.</p>
          </div>
        `;
      }

      return `
        <div class="workmate-employee-excel-preview-head">
          <strong>업로드 미리보기</strong>
          <span>${escapeHtml(upload.fileName || "선택된 데이터 파일")}</span>
        </div>
        <div class="upload-preview-summary-grid">
          <article class="upload-preview-summary-item">
            <span>반영 대상</span>
            <strong>${escapeHtml(`${formatNumber(rowCount)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item">
            <span>미합류</span>
            <strong>${escapeHtml(`${formatNumber(upload.pendingCount || 0)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item">
            <span>합류 요청</span>
            <strong>${escapeHtml(`${formatNumber(upload.invitedCount || 0)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item">
            <span>합류 완료</span>
            <strong>${escapeHtml(`${formatNumber(upload.activeCount || 0)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item">
            <span>임시 저장</span>
            <strong>${escapeHtml(`${formatNumber(upload.draftCount || 0)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item">
            <span>비활성/퇴사</span>
            <strong>${escapeHtml(`${formatNumber(inactiveGroupCount)}건`)}</strong>
          </article>
          <article class="upload-preview-summary-item${reviewCount > 0 ? " is-caution" : ""}">
            <span>검토 필요</span>
            <strong>${escapeHtml(`${formatNumber(reviewCount)}건`)}</strong>
          </article>
        </div>
        <div class="workmate-employee-excel-preview-notes">
          <p>상태 값이 비어 있는 행은 임시 저장으로 등록됩니다.</p>
          <p>조직, 직급, 근로정책은 이름 또는 ID 기준으로 매칭합니다.</p>
          ${skippedRowCount > 0 ? `<p>${escapeHtml(`빈 행 ${formatNumber(skippedRowCount)}건은 업로드 대상에서 제외됩니다.`)}</p>` : ""}
          ${reviewCount > 0 ? `<p class="is-caution">${escapeHtml(`미합류/합류 요청/합류 완료 행 중 ${formatNumber(reviewCount)}건은 필수값 누락 가능성이 있어 업로드 전 파일 점검이 필요합니다.`)}</p>` : ""}
        </div>
      `;
    }

    const modalRenderer = modalRendererModule.create({
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
    });
    const {
      renderManagementEmployeeDeleteConfirmModal,
      renderManagementEmployeeExcelModal,
      renderManagementEmployeeInviteChannelModal,
      renderManagementEmployeeInviteProgressOverlay,
      renderManagementEmployeeModal,
    } = modalRenderer;

    function getManagementEmployeeGridColumns() {
      return [
        {
          align: "center",
          getFilterValue: (record) => record.statusLabel,
          getSortValue: (record) => record.statusLabel,
          key: "statusLabel",
          label: "상태",
          minWidth: "100px",
          render: (record) => renderEmployeeStatusBadge(record),
          width: "7%",
        },
        {
          getFilterValue: (record) => record.name,
          getSortValue: (record) => record.name,
          key: "name",
          label: "직원",
          minWidth: "110px",
          render: (record) => `<strong>${escapeHtml(record.name || "-")}</strong>`,
          width: "8%",
        },
        {
          align: "center",
          getFilterValue: (record) => record.employeeNo,
          getSortValue: (record) => record.employeeNo,
          key: "employeeNo",
          label: "사번",
          minWidth: "96px",
          render: (record) => escapeHtml(record.employeeNo || "-"),
          width: "8%",
        },
        {
          getFilterValue: (record) => record.roleLabel,
          getSortValue: (record) => record.roleLabel,
          key: "roleLabel",
          label: "권한",
          minWidth: "118px",
          render: (record) => escapeHtml(record.roleLabel || "-"),
          width: "9%",
        },
        {
          getFilterValue: (record) => record.primaryUnitLabel || record.primaryUnitName,
          getSortValue: (record) => record.primaryUnitLabel || record.primaryUnitName,
          key: "primaryUnitName",
          label: "조직",
          minWidth: "120px",
          render: (record) => escapeHtml(record.primaryUnitLabel || record.primaryUnitName || "-"),
          width: "10%",
        },
        {
          getFilterValue: (record) => record.jobTitleLabel,
          getSortValue: (record) => record.jobTitleLabel,
          key: "jobTitleLabel",
          label: "직급",
          minWidth: "98px",
          render: (record) => escapeHtml(record.jobTitleLabel || "-"),
          width: "8%",
        },
        {
          getFilterValue: (record) => record.workPolicyName,
          getSortValue: (record) => record.workPolicyName,
          key: "workPolicyName",
          label: "근로정책",
          minWidth: "132px",
          render: (record) => escapeHtml(record.workPolicyName || "-"),
          width: "10%",
        },
        {
          align: "center",
          getFilterValue: (record) => record.joinDate,
          getSortValue: (record) => record.joinDate,
          key: "joinDate",
          label: "입사일",
          minWidth: "108px",
          render: (record) => escapeHtml(formatManagementEmployeeDateKey(record.joinDate) || "-"),
          width: "8%",
        },
        {
          align: "center",
          getFilterValue: (record) => record.retireDateText,
          getSortValue: (record) => record.retireDateText,
          key: "retireDateText",
          label: "퇴사일",
          minWidth: "108px",
          render: (record) => escapeHtml(record.retireDateText ? formatDate(record.retireDateText) : "-"),
          width: "8%",
        },
        {
          getFilterValue: (record) => record.loginEmail,
          getSortValue: (record) => record.loginEmail,
          key: "loginEmail",
          label: "이메일",
          minWidth: "176px",
          render: (record) => escapeHtml(record.loginEmail || "-"),
          width: "13%",
        },
        {
          align: "center",
          getFilterValue: (record) => record.phone,
          getSortValue: (record) => record.phone,
          key: "phone",
          label: "전화번호",
          minWidth: "132px",
          render: (record) => escapeHtml(record.phone || "-"),
          width: "10%",
        },
        {
          align: "center",
          getSortValue: () => 0,
          key: "detailAction",
          label: "관리",
          filterable: false,
          minWidth: "72px",
          render: (record) => renderEmployeeEditButton(record),
          sortable: false,
          width: "5%",
        },
      ];
    }

    function renderManagementEmployeesView(state = {}, stats = {}) {
      const records = buildManagementEmployeeRecords(stats);
      const columns = getManagementEmployeeGridColumns();
      const activeCount = records.filter((record) => record.managementStatus === "ACTIVE").length;
      const pendingCount = records.filter((record) => record.managementStatus === "PENDING").length;
      const invitedCount = records.filter((record) => record.managementStatus === "INVITED").length;
      const expiredCount = records.filter((record) => record.managementStatus === "EXPIRED").length;
      const draftCount = records.filter((record) => record.managementStatus === "DRAFT").length;

      return `
        <section class="workmate-admin-content-stack">
          <article class="panel-card workmate-title-record-panel workmate-management-employee-record-panel">
            <div class="workmate-worksite-panel-head">
              <div>
                <h4>직원 관리</h4>
                <p>지정된 정책을 적용하여 직원 데이터를 관리하며, 워크스페이스에 합류 요청을 할 수 있습니다. </p>
              </div>
              <div class="workmate-employee-panel-actions">
                <button class="outline-button" data-management-employee-excel-open="true" type="button">엑셀 업로드</button>
                <button class="primary-button" data-management-employee-open="" type="button">직원 추가</button>
              </div>
            </div>

            <section class="metric-grid workmate-management-employee-metric-grid">
              ${renderMetricCard("전체 직원", `${formatNumber(records.length)}명`, "현재 집계", "tone-blue")}
              ${renderMetricCard("합류 완료", `${formatNumber(activeCount)}명`, "재직 상태", "tone-green")}
              ${renderMetricCard("미합류", `${formatNumber(pendingCount)}명`, "저장 완료", "tone-orange")}
              ${renderMetricCard("합류 요청", `${formatNumber(invitedCount)}명`, "초대 진행 중", "tone-purple")}
              ${renderMetricCard("요청 만료", `${formatNumber(expiredCount)}명`, "재전송 필요", "tone-red")}
              ${renderMetricCard("임시 저장", `${formatNumber(draftCount)}명`, "필수값 미완료", "tone-red")}
            </section>

            <article class="panel-card workmate-dashboard-table-panel result-grid-card workmate-management-employee-grid-card">
              <div class="workmate-dashboard-table-shell">
                ${renderDashboardGridTable(
                  MANAGEMENT_EMPLOYEE_GRID_TABLE_ID,
                  columns,
                  records,
                  state,
                  "표시할 직원 데이터가 없습니다.",
                  "직원 추가 또는 엑셀 업로드로 첫 직원 데이터를 등록하세요.",
                )}
              </div>
            </article>
          </article>

          ${renderDashboardFilterMenu(state, MANAGEMENT_EMPLOYEE_GRID_TABLE_ID, columns, records)}
          ${renderManagementEmployeeModal(state, stats)}
          ${renderManagementEmployeeDeleteConfirmModal(state)}
          ${renderManagementEmployeeInviteChannelModal(state)}
          ${renderManagementEmployeeInviteProgressOverlay(state)}
          ${renderManagementEmployeeExcelModal(state)}
        </section>
      `;
    }

    return Object.freeze({
      getManagementEmployeeGridColumns,
      renderManagementEmployeesView,
    });
  }

  return Object.freeze({
    create: createManagementEmployeesRenderer,
  });
});
