(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeExcelTemplateController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      formatLocalDateKey,
      loadXlsxLibrary,
      showToast,
      state,
    } = dependencies;

    if (
      typeof formatLocalDateKey !== "function"
      || typeof loadXlsxLibrary !== "function"
      || typeof showToast !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementEmployeeExcelTemplateController requires template dependencies.");
    }

    function toArray(items = []) {
      return Array.isArray(items) ? items : [];
    }

    function buildManagementEmployeeTemplateRows() {
      const firstUnitName = String(state.bootstrap?.units?.[0]?.name || "").trim();
      const firstJobTitleName = String(state.bootstrap?.jobTitles?.[0]?.name || "").trim();
      const firstWorkPolicyName = String(state.bootstrap?.workPolicies?.[0]?.name || "").trim();

      return [
        ["성", "이름", "사번", "권한", "조직", "직급", "근로정책", "입사일", "퇴사일", "이메일", "전화번호", "합류요청방식", "상태", "메모"],
        [
          "김",
          "민수",
          "E0001",
          "구성원",
          firstUnitName || "운영팀",
          firstJobTitleName || "사원",
          firstWorkPolicyName || "기본 근무정책",
          formatLocalDateKey(),
          "",
          "minsu.kim@example.com",
          "01012345678",
          "EMAIL,SMS",
          "미합류",
          "예시 데이터입니다.",
        ],
      ];
    }

    function buildManagementEmployeeTemplateReferenceRows() {
      const rows = [
        ["구분", "표시값", "코드 또는 참고값", "설명"],
        ["권한", "구성원", "EMPLOYEE", "기본 직원 권한"],
        ["권한", "조직 관리자", "ORG_ADMIN", "조직 단위 관리 권한"],
        ["권한", "시스템 관리자", "SYSTEM_ADMIN", "전체 시스템 관리 권한"],
        ["상태", "임시 저장", "DRAFT", "필수값 누락 가능, 합류 요청 미전송"],
        ["상태", "미합류", "PENDING", "필수값 저장 완료, 합류 요청 미전송"],
        ["상태", "합류요청", "INVITED", "필수값이 모두 있어야 정상 처리"],
        ["상태", "합류", "ACTIVE", "즉시 재직 상태로 반영"],
        ["상태", "비활성", "INACTIVE", "비활성 사용자로 반영"],
        ["상태", "퇴사", "RETIRED", "퇴사 처리 상태로 반영"],
        ["합류요청방식", "EMAIL", "EMAIL", "이메일 발송"],
        ["합류요청방식", "SMS", "SMS", "문자 발송"],
        ["합류요청방식", "EMAIL,SMS", "EMAIL,SMS", "이메일과 문자 동시 발송"],
        [],
        ["조직 참고", "이름", "ID", "조직 이름 또는 ID 중 하나를 입력"],
        ...toArray(state.bootstrap?.units).map((unit) => [
          "조직",
          String(unit?.name || "").trim(),
          String(unit?.id || "").trim(),
          String(unit?.path || "").trim() || "-",
        ]),
        [],
        ["직급 참고", "이름", "ID", "직급 이름 또는 ID 중 하나를 입력"],
        ...toArray(state.bootstrap?.jobTitles).map((jobTitle) => [
          "직급",
          String(jobTitle?.name || "").trim(),
          String(jobTitle?.id || "").trim(),
          String(jobTitle?.code || "").trim() || "-",
        ]),
        [],
        ["근로정책 참고", "이름", "ID", "근로정책 이름 또는 ID 중 하나를 입력"],
        ...toArray(state.bootstrap?.workPolicies).map((workPolicy) => [
          "근로정책",
          String(workPolicy?.name || "").trim(),
          String(workPolicy?.id || "").trim(),
          String(workPolicy?.policyType || workPolicy?.scheduleType || "").trim() || "-",
        ]),
      ];

      return rows;
    }

    async function downloadManagementEmployeeExcelTemplate() {
      const XLSX = await loadXlsxLibrary();
      const workbook = XLSX.utils.book_new();
      const templateSheet = XLSX.utils.aoa_to_sheet(buildManagementEmployeeTemplateRows());
      const referenceSheet = XLSX.utils.aoa_to_sheet(buildManagementEmployeeTemplateReferenceRows());

      templateSheet["!cols"] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 28 },
      ];
      referenceSheet["!cols"] = [
        { wch: 14 },
        { wch: 22 },
        { wch: 28 },
        { wch: 42 },
      ];

      XLSX.utils.book_append_sheet(workbook, templateSheet, "직원업로드");
      XLSX.utils.book_append_sheet(workbook, referenceSheet, "참고값");

      const workbookBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob(
        [workbookBuffer],
        { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      );
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "workmate-employee-upload-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      showToast("직원 업로드 양식을 다운로드했습니다.");
      return true;
    }

    return Object.freeze({
      downloadManagementEmployeeExcelTemplate,
    });
  }

  return Object.freeze({ create });
});
