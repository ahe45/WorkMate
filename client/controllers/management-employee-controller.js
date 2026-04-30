(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      createDefaultManagementEmployeeDraft,
      formatLocalDateKey,
      refreshWorkspaceData,
      renderWorkspacePage,
      setInlineMessage,
      showToast,
      state,
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementEmployeeDraft !== "function"
      || typeof formatLocalDateKey !== "function"
      || typeof refreshWorkspaceData !== "function"
      || typeof renderWorkspacePage !== "function"
      || typeof setInlineMessage !== "function"
      || typeof showToast !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementEmployeeController requires employee management dependencies.");
    }

    const employeeCardControllerModule = globalThis.WorkMateManagementEmployeeCardController
      || (typeof require === "function" ? require("./management-employee-card-controller.js") : null);
    const employeeExcelControllerModule = globalThis.WorkMateManagementEmployeeExcelController
      || (typeof require === "function" ? require("./management-employee-excel-controller.js") : null);
    const employeeFieldValidationModule = globalThis.WorkMateManagementEmployeeFieldValidation
      || (typeof require === "function" ? require("./management-employee-field-validation.js") : null);
    const employeeFormUtilsModule = globalThis.WorkMateManagementEmployeeFormUtils
      || (typeof require === "function" ? require("./management-employee-form-utils.js") : null);
    const employeeSubmissionControllerModule = globalThis.WorkMateManagementEmployeeSubmissionController
      || (typeof require === "function" ? require("./management-employee-submission-controller.js") : null);

    if (!employeeCardControllerModule || typeof employeeCardControllerModule.create !== "function") {
      throw new Error("client/controllers/management-employee-card-controller.js must be loaded before client/controllers/management-employee-controller.js.");
    }

    if (!employeeExcelControllerModule || typeof employeeExcelControllerModule.create !== "function") {
      throw new Error("client/controllers/management-employee-excel-controller.js must be loaded before client/controllers/management-employee-controller.js.");
    }

    if (!employeeFormUtilsModule) {
      throw new Error("client/controllers/management-employee-form-utils.js must be loaded before client/controllers/management-employee-controller.js.");
    }

    if (!employeeFieldValidationModule || typeof employeeFieldValidationModule.create !== "function") {
      throw new Error("client/controllers/management-employee-field-validation.js must be loaded before client/controllers/management-employee-controller.js.");
    }

    if (!employeeSubmissionControllerModule || typeof employeeSubmissionControllerModule.create !== "function") {
      throw new Error("client/controllers/management-employee-submission-controller.js must be loaded before client/controllers/management-employee-controller.js.");
    }

    const {
      buildInviteChannelDefaults,
      createEmptyManagementEmployeeExcelUpload,
      createEmptyManagementEmployeeInviteProgress,
      formatManagementEmployeePhone,
      formatManagementEmployeeTenureLabel,
      getInviteChannelLabel,
      hasManagementEmployeeRequiredFields,
      normalizeManagementEmployeeDateValue,
      parseManagementEmployeeDate,
      sanitizePersonnelCard,
      splitManagementEmployeeFullName,
      validateInvitePayload,
      validateStandardPayload,
    } = employeeFormUtilsModule;
    const employeeFieldValidation = employeeFieldValidationModule.create({
      parseManagementEmployeeDate,
      setInlineMessage,
      showToast,
    });
    const {
      notifyManagementEmployeeValidationFailure,
      validateManagementEmployeeField,
      validateManagementEmployeeFormFields,
    } = employeeFieldValidation;

    function getManagementEmployeeById(employeeId = "") {
      const normalizedEmployeeId = String(employeeId || "").trim();

      if (!normalizedEmployeeId) {
        return null;
      }

      return (Array.isArray(state.bootstrap?.users) ? state.bootstrap.users : [])
        .find((user) => String(user?.id || "").trim() === normalizedEmployeeId) || null;
    }

    function setManagementEmployeeInviteProgress(progress = {}) {
      const active = progress.active === true;
      state.managementEmployeeInviteProgress = active
        ? {
          active: true,
          channelLabel: String(progress.channelLabel || "").trim(),
          message: String(progress.message || "").trim(),
          progressLabel: String(progress.progressLabel || "").trim(),
        }
        : createEmptyManagementEmployeeInviteProgress();

      document.body?.classList.toggle("app-busy", active);
      renderWorkspacePage();
    }

    function createEmptyManagementEmployeeDraft() {
      return createDefaultManagementEmployeeDraft({
        inviteChannels: ["EMAIL"],
        joinDate: formatLocalDateKey(),
      });
    }

    function ensureManagementEmployeeExcelUploadState() {
      if (!state.managementEmployeeExcelUpload || typeof state.managementEmployeeExcelUpload !== "object") {
        state.managementEmployeeExcelUpload = createEmptyManagementEmployeeExcelUpload();
      }

      return state.managementEmployeeExcelUpload;
    }

    function createManagementEmployeeDraftFromUser(user = {}) {
      const card = sanitizePersonnelCard(user?.personnelCard);

      return createDefaultManagementEmployeeDraft({
        employeeId: String(user?.id || "").trim(),
        employeeNo: String(user?.employeeNo || "").trim(),
        employmentStatus: String(user?.employmentStatus || "").trim().toUpperCase(),
        firstName: String(user?.firstName || "").trim(),
        inviteChannels: buildInviteChannelDefaults({
          inviteChannels: user?.inviteChannels,
          loginEmail: user?.loginEmail,
          phone: user?.phone,
        }),
        joinDate: normalizeManagementEmployeeDateValue(user?.joinDate) || formatLocalDateKey(),
        jobTitleId: String(user?.jobTitleId || "").trim(),
        lastName: String(user?.lastName || "").trim(),
        loginEmail: String(user?.loginEmail || "").trim(),
        managementStatus: String(user?.managementStatus || user?.employmentStatus || "").trim().toUpperCase(),
        name: String(user?.name || "").trim(),
        note: String(user?.note || "").trim(),
        personnelCard: card,
        phone: String(user?.phone || "").trim(),
        primaryUnitId: String(user?.primaryUnitId || "").trim(),
        retireDate: normalizeManagementEmployeeDateValue(user?.retireDate),
        roleCode: String(user?.roleCode || "").trim().toUpperCase(),
        workPolicyId: String(user?.workPolicyId || "").trim(),
      });
    }

    function updateManagementEmployeePhoneInput(input) {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const nextValue = formatManagementEmployeePhone(input.value || "");

      if (input.value === nextValue) {
        return;
      }

      input.value = nextValue;
    }

    function updateManagementEmployeeTenurePreview() {
      const target = document.getElementById("management-employee-tenure-value");
      const joinDateInput = document.getElementById("management-employee-join-date");
      const retireDateInput = document.getElementById("management-employee-retire-date");
      const joinDateValue = joinDateInput instanceof HTMLInputElement ? joinDateInput.value : "";
      const retireDateValue = retireDateInput instanceof HTMLInputElement ? retireDateInput.value : "";

      if (!target) {
        return false;
      }

      state.managementEmployeeDraft = createDefaultManagementEmployeeDraft({
        ...state.managementEmployeeDraft,
        joinDate: joinDateValue,
        retireDate: retireDateValue,
      });
      target.textContent = formatManagementEmployeeTenureLabel(
        joinDateValue,
        retireDateValue,
      );
      return true;
    }

    function getManagementEmployeeAvailableJobTitles(unitId = "") {
      const normalizedUnitId = String(unitId || "").trim();

      if (!normalizedUnitId) {
        return [];
      }

      return toArray(state.bootstrap?.jobTitles)
        .filter((jobTitle) => (
          toArray(jobTitle?.unitIds)
            .map((mappedUnitId) => String(mappedUnitId || "").trim())
            .includes(normalizedUnitId)
        ))
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

    function syncManagementEmployeeJobTitleOptions(selectedUnitId = "") {
      const unitSelect = document.getElementById("management-employee-unit");
      const jobTitleSelect = document.getElementById("management-employee-job-title");

      if (!(jobTitleSelect instanceof HTMLSelectElement)) {
        return false;
      }

      const normalizedSelectedUnitId = String(
        selectedUnitId || (unitSelect instanceof HTMLSelectElement ? unitSelect.value : ""),
      ).trim();
      const currentJobTitleId = String(jobTitleSelect.value || "").trim();
      const availableJobTitles = getManagementEmployeeAvailableJobTitles(normalizedSelectedUnitId);
      const availableJobTitleIds = new Set(
        availableJobTitles
          .map((jobTitle) => String(jobTitle?.id || "").trim())
          .filter(Boolean),
      );
      const placeholderOption = document.createElement("option");

      placeholderOption.value = "";
      placeholderOption.textContent = normalizedSelectedUnitId ? "직급을 선택하세요" : "조직을 먼저 선택하세요";
      jobTitleSelect.replaceChildren(placeholderOption);

      availableJobTitles.forEach((jobTitle) => {
        const option = document.createElement("option");

        option.value = String(jobTitle?.id || "").trim();
        option.textContent = String(jobTitle?.name || "").trim() || "-";
        jobTitleSelect.append(option);
      });

      jobTitleSelect.disabled = !normalizedSelectedUnitId;
      jobTitleSelect.value = availableJobTitleIds.has(currentJobTitleId) ? currentJobTitleId : "";

      state.managementEmployeeDraft = createDefaultManagementEmployeeDraft({
        ...(state.managementEmployeeDraft || {}),
        jobTitleId: jobTitleSelect.value,
        primaryUnitId: normalizedSelectedUnitId,
      });
      syncManagementEmployeeActionButtons();

      return true;
    }

    function setManagementEmployeeCardSummary(card = null) {
      const cardName = document.getElementById("management-employee-card-file-name");
      const cardMeta = document.getElementById("management-employee-card-file-meta");
      const downloadButton = document.querySelector("[data-management-employee-card-download]");
      const normalizedCard = sanitizePersonnelCard(card);

      if (cardName) {
        cardName.textContent = normalizedCard?.name || "업로드된 파일 없음";
      }

      if (cardMeta) {
        cardMeta.textContent = normalizedCard?.size
          ? `${normalizedCard.type || "application/octet-stream"} · ${Math.max(1, Math.round(normalizedCard.size / 1024))}KB`
          : "PDF 또는 이미지 파일을 선택하세요.";
      }

      if (downloadButton instanceof HTMLButtonElement) {
        downloadButton.disabled = !normalizedCard?.dataUrl;
      }
    }

    function openManagementEmployeeModal(employeeId = "") {
      const employee = getManagementEmployeeById(employeeId);
      state.managementEmployeeDraft = employee
        ? createManagementEmployeeDraftFromUser(employee)
        : createEmptyManagementEmployeeDraft();
      state.managementEmployeeModalOpen = true;
      state.managementEmployeeDeleteConfirmOpen = false;
      state.managementEmployeeInviteChannelModalOpen = false;
      state.managementEmployeeInviteProgress = createEmptyManagementEmployeeInviteProgress();
      document.body?.classList.remove("app-busy");
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        setInlineMessage(document.getElementById("management-employee-error"), "");
        syncManagementEmployeeJobTitleOptions(state.managementEmployeeDraft?.primaryUnitId);
        setManagementEmployeeCardSummary(state.managementEmployeeDraft?.personnelCard);
        document.getElementById("management-employee-name")?.focus();
      });
    }

    function openManagementEmployeeExcelModal() {
      state.managementEmployeeExcelUpload = createEmptyManagementEmployeeExcelUpload();
      state.managementEmployeeExcelModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        setInlineMessage(document.getElementById("management-employee-excel-error"), "");
        document.querySelector("#management-employee-excel-modal .icon-button")?.focus();
      });
    }

    function closeManagementEmployeeModal() {
      if (!state.managementEmployeeModalOpen) {
        return;
      }

      state.managementEmployeeModalOpen = false;
      state.managementEmployeeDeleteConfirmOpen = false;
      state.managementEmployeeInviteChannelModalOpen = false;
      state.managementEmployeeInviteProgress = createEmptyManagementEmployeeInviteProgress();
      document.body?.classList.remove("app-busy");
      renderWorkspacePage();
    }

    function closeManagementEmployeeExcelModal() {
      if (!state.managementEmployeeExcelModalOpen) {
        return;
      }

      state.managementEmployeeExcelModalOpen = false;
      state.managementEmployeeExcelUpload = createEmptyManagementEmployeeExcelUpload();
      renderWorkspacePage();
    }

    function resetManagementEmployeeDraft() {
      const employeeId = String(state.managementEmployeeDraft?.employeeId || "").trim();
      const employee = getManagementEmployeeById(employeeId);

      state.managementEmployeeDraft = employee
        ? createManagementEmployeeDraftFromUser(employee)
        : createEmptyManagementEmployeeDraft();
      state.managementEmployeeDeleteConfirmOpen = false;
      state.managementEmployeeInviteProgress = createEmptyManagementEmployeeInviteProgress();
      document.body?.classList.remove("app-busy");
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        setInlineMessage(document.getElementById("management-employee-error"), "");
        syncManagementEmployeeJobTitleOptions(state.managementEmployeeDraft?.primaryUnitId);
        setManagementEmployeeCardSummary(state.managementEmployeeDraft?.personnelCard);
      });
    }

    function closeManagementEmployeeInviteChannelModal() {
      if (!state.managementEmployeeInviteChannelModalOpen) {
        return;
      }

      if (state.managementEmployeeInviteProgress?.active) {
        return;
      }

      state.managementEmployeeInviteChannelModalOpen = false;
      renderWorkspacePage();
    }

    function openManagementEmployeeDeleteConfirmModal() {
      const employeeId = String(state.managementEmployeeDraft?.employeeId || "").trim();

      if (!employeeId) {
        throw new Error("삭제할 직원을 먼저 저장하거나 선택하세요.");
      }

      state.managementEmployeeDeleteConfirmOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        setInlineMessage(document.getElementById("management-employee-delete-error"), "");
        document.getElementById("management-employee-delete-password")?.focus();
      });
    }

    function closeManagementEmployeeDeleteConfirmModal() {
      if (!state.managementEmployeeDeleteConfirmOpen) {
        return;
      }

      state.managementEmployeeDeleteConfirmOpen = false;
      renderWorkspacePage();
    }

    async function submitManagementEmployeeDelete() {
      const employeeId = String(state.managementEmployeeDraft?.employeeId || "").trim();
      const password = String(document.getElementById("management-employee-delete-password")?.value || "");
      const errorTarget = document.getElementById("management-employee-delete-error");

      setInlineMessage(errorTarget, "");

      if (!employeeId) {
        throw new Error("삭제할 직원을 찾을 수 없습니다.");
      }

      if (!password) {
        setInlineMessage(errorTarget, "비밀번호를 입력하세요.");
        return null;
      }

      const submitButton = document.querySelector("[data-management-employee-delete-submit]");

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
      }

      try {
        const result = await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/users/${employeeId}`, {
          body: JSON.stringify({ password }),
          method: "DELETE",
        });

        state.managementEmployeeDeleteConfirmOpen = false;
        state.managementEmployeeInviteChannelModalOpen = false;
        state.managementEmployeeModalOpen = false;
        state.managementEmployeeDraft = createEmptyManagementEmployeeDraft();
        await refreshWorkspaceData();
        showToast("직원 데이터를 삭제했습니다.");
        return result;
      } catch (error) {
        setInlineMessage(errorTarget, error.message || "직원 데이터를 삭제하지 못했습니다.");
        throw error;
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
        }
      }
    }

    const employeeSubmissionController = employeeSubmissionControllerModule.create({
      api,
      createDefaultManagementEmployeeDraft,
      createEmptyManagementEmployeeDraft,
      createEmptyManagementEmployeeInviteProgress,
      createManagementEmployeeDraftFromUser,
      formatManagementEmployeePhone,
      getInviteChannelLabel,
      hasManagementEmployeeRequiredFields,
      normalizeManagementEmployeeDateValue,
      notifyManagementEmployeeValidationFailure,
      refreshWorkspaceData,
      renderWorkspacePage,
      sanitizePersonnelCard,
      setInlineMessage,
      setManagementEmployeeInviteProgress,
      showToast,
      splitManagementEmployeeFullName,
      state,
      validateInvitePayload,
      validateManagementEmployeeFormFields,
      validateStandardPayload,
    });
    const {
      getManagementEmployeePreferredSubmissionMode,
      openManagementEmployeeInviteChannelModal,
      submitManagementEmployeeDraftForm,
      submitManagementEmployeeInviteForm,
      submitManagementEmployeePreferredForm,
      submitManagementEmployeeSaveForm,
      syncManagementEmployeeActionButtons,
    } = employeeSubmissionController;

    const employeeCardController = employeeCardControllerModule.create({
      createDefaultManagementEmployeeDraft,
      sanitizePersonnelCard,
      setManagementEmployeeCardSummary,
      showToast,
      state,
    });
    const {
      downloadManagementEmployeeCardFile,
      handleManagementEmployeeCardFileChange,
      handleManagementEmployeeCardFileDrop,
    } = employeeCardController;

    const employeeExcelController = employeeExcelControllerModule.create({
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
    });
    const {
      downloadManagementEmployeeExcelTemplate,
      handleManagementEmployeeExcelFileChange,
      submitManagementEmployeeExcelUpload,
    } = employeeExcelController;

    return Object.freeze({
      closeManagementEmployeeDeleteConfirmModal,
      closeManagementEmployeeInviteChannelModal,
      closeManagementEmployeeExcelModal,
      closeManagementEmployeeModal,
      createEmptyManagementEmployeeDraft,
      createManagementEmployeeDraftFromUser,
      downloadManagementEmployeeCardFile,
      downloadManagementEmployeeExcelTemplate,
      formatManagementEmployeePhone,
      getManagementEmployeeById,
      handleManagementEmployeeCardFileChange,
      handleManagementEmployeeCardFileDrop,
      handleManagementEmployeeExcelFileChange,
      openManagementEmployeeDeleteConfirmModal,
      openManagementEmployeeExcelModal,
      openManagementEmployeeInviteChannelModal,
      openManagementEmployeeModal,
      resetManagementEmployeeDraft,
      getManagementEmployeePreferredSubmissionMode,
      submitManagementEmployeeExcelUpload,
      submitManagementEmployeeDraftForm,
      submitManagementEmployeeDelete,
      submitManagementEmployeePreferredForm,
      submitManagementEmployeeInviteForm,
      submitManagementEmployeeSaveForm,
      syncManagementEmployeeActionButtons,
      syncManagementEmployeeJobTitleOptions,
      updateManagementEmployeeTenurePreview,
      updateManagementEmployeePhoneInput,
      validateManagementEmployeeField,
      validateManagementEmployeeFormFields,
    });
  }

  return Object.freeze({ create });
});
