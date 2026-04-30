(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeCardController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EMPLOYEE_MAX_CARD_FILE_BYTES = 10 * 1024 * 1024;
  const EMPLOYEE_CARD_FILE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);
  const EMPLOYEE_CARD_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

  function create(dependencies = {}) {
    const {
      createDefaultManagementEmployeeDraft,
      sanitizePersonnelCard,
      setManagementEmployeeCardSummary,
      showToast,
      state,
    } = dependencies;

    if (
      typeof createDefaultManagementEmployeeDraft !== "function"
      || typeof sanitizePersonnelCard !== "function"
      || typeof setManagementEmployeeCardSummary !== "function"
      || typeof showToast !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementEmployeeCardController requires employee card dependencies.");
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
    }

    function validateManagementEmployeeCardFile(file) {
      if (!file) {
        state.managementEmployeeDraft = createDefaultManagementEmployeeDraft({
          ...(state.managementEmployeeDraft || {}),
          personnelCard: null,
        });
        setManagementEmployeeCardSummary(null);
        return true;
      }

      if (file.size > EMPLOYEE_MAX_CARD_FILE_BYTES) {
        throw new Error("인사카드 파일은 10MB 이하만 업로드할 수 있습니다.");
      }

      const extension = String(file.name || "").split(".").pop()?.trim().toLowerCase() || "";
      const fileType = String(file.type || "").trim().toLowerCase();

      if (!EMPLOYEE_CARD_FILE_EXTENSIONS.has(extension)
        || (fileType && !EMPLOYEE_CARD_FILE_TYPES.has(fileType))) {
        throw new Error("인사카드 파일은 PDF 또는 이미지 파일만 업로드할 수 있습니다.");
      }

      return true;
    }

    async function setManagementEmployeeCardFile(file = null) {
      validateManagementEmployeeCardFile(file);

      if (!file) {
        return true;
      }

      const dataUrl = await readFileAsDataUrl(file);
      state.managementEmployeeDraft = createDefaultManagementEmployeeDraft({
        ...(state.managementEmployeeDraft || {}),
        personnelCard: {
          dataUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        },
      });
      setManagementEmployeeCardSummary(state.managementEmployeeDraft.personnelCard);
      return true;
    }

    async function handleManagementEmployeeCardFileChange(input) {
      if (!(input instanceof HTMLInputElement)) {
        return false;
      }

      const file = input.files?.[0] || null;

      try {
        return await setManagementEmployeeCardFile(file);
      } catch (error) {
        input.value = "";
        throw error;
      }
    }

    async function handleManagementEmployeeCardFileDrop(file = null) {
      return setManagementEmployeeCardFile(file);
    }

    function downloadManagementEmployeeCardFile() {
      const card = sanitizePersonnelCard(state.managementEmployeeDraft?.personnelCard);

      if (!card?.dataUrl) {
        showToast("다운로드할 인사기록카드 파일이 없습니다.", { duration: 2800, tone: "error" });
        return false;
      }

      const link = document.createElement("a");
      link.href = card.dataUrl;
      link.download = card.name || "personnel-card";
      document.body.append(link);
      link.click();
      link.remove();
      return true;
    }

    return Object.freeze({
      downloadManagementEmployeeCardFile,
      handleManagementEmployeeCardFileChange,
      handleManagementEmployeeCardFileDrop,
    });
  }

  return Object.freeze({ create });
});
