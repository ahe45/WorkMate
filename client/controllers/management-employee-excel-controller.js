(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeExcelController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const excelImportParserModule = globalThis.WorkMateManagementEmployeeExcelImportParser
    || (typeof require === "function" ? require("./management-employee-excel-import-parser.js") : null);
  const excelTemplateControllerModule = globalThis.WorkMateManagementEmployeeExcelTemplateController
    || (typeof require === "function" ? require("./management-employee-excel-template-controller.js") : null);
  const xlsxLoaderModule = globalThis.WorkMateManagementEmployeeXlsxLoader
    || (typeof require === "function" ? require("./management-employee-xlsx-loader.js") : null);

  function create(dependencies = {}) {
    const {
      api,
      createEmptyManagementEmployeeExcelUpload,
      ensureManagementEmployeeExcelUploadState,
      formatLocalDateKey,
      formatManagementEmployeePhone,
      refreshWorkspaceData,
      renderWorkspacePage,
      setInlineMessage,
      showToast,
      state,
    } = dependencies;

    if (
      !api
      || typeof createEmptyManagementEmployeeExcelUpload !== "function"
      || typeof ensureManagementEmployeeExcelUploadState !== "function"
      || typeof formatLocalDateKey !== "function"
      || typeof formatManagementEmployeePhone !== "function"
      || typeof refreshWorkspaceData !== "function"
      || typeof renderWorkspacePage !== "function"
      || typeof setInlineMessage !== "function"
      || typeof showToast !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementEmployeeExcelController requires employee excel dependencies.");
    }

    if (!xlsxLoaderModule || typeof xlsxLoaderModule.loadXlsxLibrary !== "function") {
      throw new Error("client/controllers/management-employee-xlsx-loader.js must be loaded before client/controllers/management-employee-excel-controller.js.");
    }

    if (!excelImportParserModule || typeof excelImportParserModule.create !== "function") {
      throw new Error("client/controllers/management-employee-excel-import-parser.js must be loaded before client/controllers/management-employee-excel-controller.js.");
    }

    if (!excelTemplateControllerModule || typeof excelTemplateControllerModule.create !== "function") {
      throw new Error("client/controllers/management-employee-excel-template-controller.js must be loaded before client/controllers/management-employee-excel-controller.js.");
    }

    const { loadXlsxLibrary } = xlsxLoaderModule;
    const excelImportParser = excelImportParserModule.create({
      createEmptyManagementEmployeeExcelUpload,
      formatLocalDateKey,
      formatManagementEmployeePhone,
      loadXlsxLibrary,
      state,
    });
    const {
      buildEmployeeImportPreview,
      parseEmployeeImportRows,
    } = excelImportParser;
    const excelTemplateController = excelTemplateControllerModule.create({
      formatLocalDateKey,
      loadXlsxLibrary,
      showToast,
      state,
    });
    const {
      downloadManagementEmployeeExcelTemplate,
    } = excelTemplateController;

    async function importEmployeesFromPayloads(payloadEntries = []) {
      const result = {
        failedRows: [],
        importedCount: 0,
      };

      for (let index = 0; index < payloadEntries.length; index += 1) {
        const entry = payloadEntries[index] || {};
        const payload = entry.payload || {};

        if (!payload || typeof payload !== "object") {
          continue;
        }

        try {
          await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/users`, {
            body: JSON.stringify(payload),
            method: "POST",
          });
          result.importedCount += 1;
        } catch (error) {
          result.failedRows.push({
            index: Number(entry.index) || index + 2,
            message: error.message || "등록 실패",
          });
        }
      }

      return result;
    }

    async function handleManagementEmployeeExcelFileChange(input) {
      if (!(input instanceof HTMLInputElement)) {
        return false;
      }

      const file = input.files?.[0] || null;

      if (!file) {
        return false;
      }

      try {
        const rows = await parseEmployeeImportRows(file);
        const preview = buildEmployeeImportPreview(rows);

        state.managementEmployeeExcelUpload = {
          ...preview,
          fileName: String(file.name || "").trim(),
          fileSize: Math.max(0, Number(file.size || 0) || 0),
          fileType: String(file.type || "").trim() || "application/octet-stream",
        };
        renderWorkspacePage();
        window.requestAnimationFrame(() => {
          setInlineMessage(document.getElementById("management-employee-excel-error"), "");
          document.querySelector("[data-management-employee-excel-submit='true']")?.focus();
        });
      } finally {
        input.value = "";
      }

      return true;
    }

    async function submitManagementEmployeeExcelUpload() {
      const upload = ensureManagementEmployeeExcelUploadState();
      const payloadEntries = Array.isArray(upload.payloadEntries) ? upload.payloadEntries : [];

      if (payloadEntries.length <= 0) {
        throw new Error("업로드할 직원 데이터 파일을 먼저 선택하세요.");
      }

      setInlineMessage(document.getElementById("management-employee-excel-error"), "");

      const result = await importEmployeesFromPayloads(payloadEntries);
      const failedCount = result.failedRows.length;

      await refreshWorkspaceData();

      state.managementEmployeeExcelModalOpen = false;
      state.managementEmployeeExcelUpload = createEmptyManagementEmployeeExcelUpload();
      renderWorkspacePage();

      showToast(
        failedCount > 0
          ? `엑셀 업로드를 완료했습니다. ${result.importedCount}건 반영, ${failedCount}건 실패`
          : `엑셀 업로드를 완료했습니다. ${result.importedCount}건 반영됨`,
        failedCount > 0 ? { duration: 4200, tone: "error" } : undefined,
      );

      if (failedCount > 0) {
        window.alert(result.failedRows
          .slice(0, 10)
          .map((row) => `${row.index}행: ${row.message}`)
          .join("\n"));
      }

      return result;
    }

    return Object.freeze({
      downloadManagementEmployeeExcelTemplate,
      handleManagementEmployeeExcelFileChange,
      submitManagementEmployeeExcelUpload,
    });
  }

  return Object.freeze({ create });
});
