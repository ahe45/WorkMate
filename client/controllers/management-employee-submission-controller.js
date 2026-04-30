(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeSubmissionController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
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
    } = dependencies;

    if (
      !api
      || typeof createDefaultManagementEmployeeDraft !== "function"
      || typeof createEmptyManagementEmployeeDraft !== "function"
      || typeof createEmptyManagementEmployeeInviteProgress !== "function"
      || typeof createManagementEmployeeDraftFromUser !== "function"
      || typeof formatManagementEmployeePhone !== "function"
      || typeof getInviteChannelLabel !== "function"
      || typeof hasManagementEmployeeRequiredFields !== "function"
      || typeof normalizeManagementEmployeeDateValue !== "function"
      || typeof notifyManagementEmployeeValidationFailure !== "function"
      || typeof refreshWorkspaceData !== "function"
      || typeof renderWorkspacePage !== "function"
      || typeof sanitizePersonnelCard !== "function"
      || typeof setInlineMessage !== "function"
      || typeof setManagementEmployeeInviteProgress !== "function"
      || typeof showToast !== "function"
      || typeof splitManagementEmployeeFullName !== "function"
      || !state
      || typeof validateInvitePayload !== "function"
      || typeof validateManagementEmployeeFormFields !== "function"
      || typeof validateStandardPayload !== "function"
    ) {
      throw new Error("WorkMateManagementEmployeeSubmissionController requires submission dependencies.");
    }

    function readManagementEmployeePayloadFromForm() {
      const form = document.getElementById("management-employee-form");

      if (!(form instanceof HTMLFormElement)) {
        throw new Error("직원 관리 폼을 찾을 수 없습니다.");
      }

      const formData = new FormData(form);
      const draft = state.managementEmployeeDraft || createEmptyManagementEmployeeDraft();
      const name = String(formData.get("name") || "").trim();
      const splitName = splitManagementEmployeeFullName(name, draft);

      return {
        employeeId: String(draft.employeeId || "").trim(),
        employeeNo: String(formData.get("employeeNo") || "").trim(),
        firstName: splitName.firstName,
        inviteChannels: Array.isArray(draft.inviteChannels)
          ? draft.inviteChannels.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)
          : [],
        jobTitleId: String(formData.get("jobTitleId") || "").trim(),
        joinDate: String(formData.get("joinDate") || "").trim(),
        lastName: splitName.lastName,
        loginEmail: String(formData.get("loginEmail") || "").trim().toLowerCase(),
        name,
        note: String(formData.get("note") || "").trim(),
        personnelCard: sanitizePersonnelCard(draft.personnelCard),
        phone: formatManagementEmployeePhone(formData.get("phone") || ""),
        primaryUnitId: String(formData.get("primaryUnitId") || "").trim(),
        retireDate: String(formData.get("retireDate") || "").trim(),
        roleCode: String(formData.get("roleCode") || "").trim().toUpperCase(),
        workPolicyId: String(formData.get("workPolicyId") || "").trim(),
      };
    }

    function readManagementEmployeePayloadFromState() {
      const draft = state.managementEmployeeDraft || createEmptyManagementEmployeeDraft();

      return {
        employeeId: String(draft.employeeId || "").trim(),
        employeeNo: String(draft.employeeNo || "").trim(),
        firstName: String(draft.firstName || "").trim(),
        inviteChannels: Array.isArray(draft.inviteChannels)
          ? draft.inviteChannels.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)
          : [],
        jobTitleId: String(draft.jobTitleId || "").trim(),
        joinDate: normalizeManagementEmployeeDateValue(draft.joinDate),
        lastName: String(draft.lastName || "").trim(),
        loginEmail: String(draft.loginEmail || "").trim().toLowerCase(),
        name: String(draft.name || "").trim(),
        note: String(draft.note || "").trim(),
        personnelCard: sanitizePersonnelCard(draft.personnelCard),
        phone: formatManagementEmployeePhone(draft.phone || ""),
        primaryUnitId: String(draft.primaryUnitId || "").trim(),
        retireDate: normalizeManagementEmployeeDateValue(draft.retireDate),
        roleCode: String(draft.roleCode || "").trim().toUpperCase(),
        workPolicyId: String(draft.workPolicyId || "").trim(),
      };
    }

    function getManagementEmployeeCurrentStatus(sourcePayload = null) {
      const draft = state.managementEmployeeDraft || {};
      const payload = sourcePayload && typeof sourcePayload === "object"
        ? sourcePayload
        : readManagementEmployeePayloadFromState();

      return String(
        draft.managementStatus
        || draft.employmentStatus
        || payload.managementStatus
        || payload.employmentStatus
        || "",
      ).trim().toUpperCase();
    }

    function getManagementEmployeePayloadSnapshot(sourcePayload = null) {
      if (sourcePayload && typeof sourcePayload === "object") {
        return sourcePayload;
      }

      const form = document.getElementById("management-employee-form");

      if (form instanceof HTMLFormElement) {
        return readManagementEmployeePayloadFromForm();
      }

      return readManagementEmployeePayloadFromState();
    }

    function getManagementEmployeePreferredSubmissionMode(sourcePayload = null) {
      const payload = getManagementEmployeePayloadSnapshot(sourcePayload);
      return hasManagementEmployeeRequiredFields(payload) ? "STANDARD" : "DRAFT";
    }

    function syncManagementEmployeeActionButtons(sourcePayload = null) {
      const payload = getManagementEmployeePayloadSnapshot(sourcePayload);
      const hasRequiredFields = hasManagementEmployeeRequiredFields(payload);
      const currentStatus = getManagementEmployeeCurrentStatus(payload);
      const employeeId = String(payload.employeeId || state.managementEmployeeDraft?.employeeId || "").trim();
      const isDirty = Boolean(state.managementModalUi?.dirty?.employee);
      const canInvite = Boolean(employeeId) && hasRequiredFields && !isDirty && currentStatus !== "ACTIVE";

      document.querySelectorAll("[data-management-employee-submit='draft']").forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.disabled = hasRequiredFields;
        }
      });

      document.querySelectorAll("[data-management-employee-submit='save']").forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.disabled = false;
        }
      });

      document.querySelectorAll("[data-management-employee-submit='invite']").forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.disabled = !canInvite;
        }
      });

      return {
        canInvite,
        canSave: true,
        preferredSubmissionMode: hasRequiredFields ? "STANDARD" : "DRAFT",
      };
    }

    function openManagementEmployeeInviteChannelModal() {
      const payload = readManagementEmployeePayloadFromForm();
      const validationFailureMessage = "필수값 또는 형식이 올바르지 않은 항목을 확인하세요.";

      setInlineMessage(document.getElementById("management-employee-error"), "");

      if (!validateManagementEmployeeFormFields()) {
        notifyManagementEmployeeValidationFailure(validationFailureMessage);
        throw new Error(validationFailureMessage);
      }

      try {
        validateStandardPayload(payload);
      } catch (error) {
        notifyManagementEmployeeValidationFailure(error.message || validationFailureMessage);
        throw error;
      }

      state.managementEmployeeInviteChannelModalOpen = true;
      renderWorkspacePage();
      window.requestAnimationFrame(() => {
        document.querySelector("[data-management-employee-invite-channel]")?.focus();
      });
    }

    async function persistManagementEmployee(submissionMode = "DRAFT", options = {}) {
      const normalizedSubmissionMode = String(submissionMode || "DRAFT").trim().toUpperCase();
      const formPayload = readManagementEmployeePayloadFromForm();
      const payload = {
        ...formPayload,
        inviteChannels: Array.isArray(options.inviteChannels)
          ? options.inviteChannels.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)
          : formPayload.inviteChannels,
      };
      const employeeId = String(payload.employeeId || "").trim();
      const isInviteSubmission = normalizedSubmissionMode === "INVITED";
      const shouldCloseModal = isInviteSubmission ? false : options.closeModal !== false;
      const shouldShowSuccessToast = options.showSuccessToast !== false;

      setInlineMessage(document.getElementById("management-employee-error"), "");

      if (isInviteSubmission) {
        if (!validateManagementEmployeeFormFields()) {
          const message = "필수값 또는 형식이 올바르지 않은 항목을 확인하세요.";

          notifyManagementEmployeeValidationFailure(message);
          throw new Error(message);
        }
        validateInvitePayload(payload);
      } else if (normalizedSubmissionMode === "STANDARD") {
        if (!validateManagementEmployeeFormFields()) {
          const message = "필수값 또는 형식이 올바르지 않은 항목을 확인하세요.";

          notifyManagementEmployeeValidationFailure(message);
          throw new Error(message);
        }
        validateStandardPayload(payload);
      }

      if (isInviteSubmission) {
        const channelLabel = getInviteChannelLabel(payload.inviteChannels);
        state.managementEmployeeDraft = createDefaultManagementEmployeeDraft({
          ...state.managementEmployeeDraft,
          ...payload,
          employmentStatus: String(state.managementEmployeeDraft?.employmentStatus || "PENDING").trim().toUpperCase(),
          managementStatus: String(state.managementEmployeeDraft?.managementStatus || state.managementEmployeeDraft?.employmentStatus || "PENDING").trim().toUpperCase(),
        });
        setManagementEmployeeInviteProgress({
          active: true,
          channelLabel,
          message: `${channelLabel}로 합류 요청을 전송하고 있습니다.`,
          progressLabel: "메일/문자 발송 처리",
        });
      }

      try {
        const savedEmployee = await api.requestWithAutoRefresh(
          employeeId
            ? `/v1/orgs/${state.selectedOrganizationId}/users/${employeeId}`
            : `/v1/orgs/${state.selectedOrganizationId}/users`,
          {
            body: JSON.stringify({
              ...payload,
              submissionMode: normalizedSubmissionMode,
            }),
            method: employeeId ? "PATCH" : "POST",
          },
        );

        state.managementEmployeeDraft = savedEmployee
          ? createManagementEmployeeDraftFromUser(savedEmployee)
          : createEmptyManagementEmployeeDraft();

        if (shouldCloseModal) {
          state.managementEmployeeModalOpen = false;
        } else {
          state.managementEmployeeModalOpen = true;
        }

        if (!isInviteSubmission) {
          state.managementEmployeeInviteChannelModalOpen = false;
        }

        await refreshWorkspaceData();

        if (shouldShowSuccessToast) {
          showToast(isInviteSubmission
            ? "직원 정보를 저장하고 합류 요청을 보냈습니다."
            : normalizedSubmissionMode === "STANDARD"
              ? "직원 정보를 저장했습니다."
              : "직원 정보를 임시 저장했습니다.");
        }

        return savedEmployee;
      } finally {
        if (isInviteSubmission) {
          state.managementEmployeeInviteProgress = createEmptyManagementEmployeeInviteProgress();
          document.body?.classList.remove("app-busy");
          renderWorkspacePage();
        }
      }
    }

    async function submitManagementEmployeeDraftForm(options = {}) {
      return persistManagementEmployee("DRAFT", options);
    }

    async function submitManagementEmployeeSaveForm(options = {}) {
      return persistManagementEmployee("STANDARD", options);
    }

    async function submitManagementEmployeeInviteForm(options = {}) {
      return persistManagementEmployee("INVITED", {
        ...options,
        closeModal: false,
      });
    }

    async function submitManagementEmployeePreferredForm(options = {}) {
      return persistManagementEmployee(getManagementEmployeePreferredSubmissionMode(), options);
    }

    return Object.freeze({
      getManagementEmployeePreferredSubmissionMode,
      openManagementEmployeeInviteChannelModal,
      readManagementEmployeePayloadFromForm,
      readManagementEmployeePayloadFromState,
      submitManagementEmployeeDraftForm,
      submitManagementEmployeeInviteForm,
      submitManagementEmployeePreferredForm,
      submitManagementEmployeeSaveForm,
      syncManagementEmployeeActionButtons,
    });
  }

  return Object.freeze({ create });
});
