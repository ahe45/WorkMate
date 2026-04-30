(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementModalController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const managementModalStateControllerModule = globalThis.WorkMateManagementModalStateController
    || (typeof require === "function" ? require("./management-modal-state-controller.js") : null);

  function create(dependencies = {}) {
    const {
      closeManagementEmployeeExcelModal,
      closeManagementEmployeeModal,
      closeManagementHolidayModal,
      closeManagementJobTitleModal,
      closeManagementUnitModal,
      closeManagementWorkPolicyModal,
      closeManagementWorksiteModal,
      openManagementEmployeeModal,
      openManagementHolidayModal,
      openManagementJobTitleModal,
      openManagementUnitEditModal,
      openManagementUnitModal,
      openManagementWorkPolicyModal,
      openManagementWorksiteModal,
      renderWorkspacePage,
      showToast,
      state,
      getManagementEmployeePreferredSubmissionMode,
      submitManagementEmployeePreferredForm,
      syncManagementEmployeeActionButtons,
      submitManagementHolidayForm,
      submitManagementJobTitleForm,
      submitManagementUnitForm,
      submitManagementWorkPolicyForm,
      submitManagementWorksiteForm,
    } = dependencies;

    if (
      typeof closeManagementEmployeeExcelModal !== "function"
      || typeof closeManagementEmployeeModal !== "function"
      || typeof openManagementEmployeeModal !== "function"
      || typeof getManagementEmployeePreferredSubmissionMode !== "function"
      || typeof submitManagementEmployeePreferredForm !== "function"
      || typeof closeManagementHolidayModal !== "function"
      || typeof closeManagementJobTitleModal !== "function"
      || typeof closeManagementUnitModal !== "function"
      || typeof closeManagementWorkPolicyModal !== "function"
      || typeof closeManagementWorksiteModal !== "function"
      || typeof openManagementHolidayModal !== "function"
      || typeof openManagementJobTitleModal !== "function"
      || typeof openManagementUnitEditModal !== "function"
      || typeof openManagementUnitModal !== "function"
      || typeof openManagementWorkPolicyModal !== "function"
      || typeof openManagementWorksiteModal !== "function"
      || typeof renderWorkspacePage !== "function"
      || typeof showToast !== "function"
      || typeof submitManagementHolidayForm !== "function"
      || typeof submitManagementJobTitleForm !== "function"
      || typeof submitManagementUnitForm !== "function"
      || typeof submitManagementWorkPolicyForm !== "function"
      || typeof submitManagementWorksiteForm !== "function"
      || typeof syncManagementEmployeeActionButtons !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementModalController requires management modal dependencies.");
    }

    if (!managementModalStateControllerModule || typeof managementModalStateControllerModule.create !== "function") {
      throw new Error("client/controllers/management-modal-state-controller.js must be loaded before client/controllers/management-modal-controller.js.");
    }

    const MANAGEMENT_MODAL_TYPES = Object.freeze([
      "employee",
      "holiday",
      "jobTitle",
      "unit",
      "workPolicy",
      "worksite",
    ]);

    let pendingManagementModalAction = null;

    function getManagementModalConfig(modalType = "") {
      const normalizedModalType = String(modalType || "").trim();
      const configs = {
        employee: {
          close: closeManagementEmployeeModal,
          formId: "management-employee-form",
          getSuccessToastMessage: () => getManagementEmployeePreferredSubmissionMode() === "DRAFT"
            ? "직원 정보를 임시 저장했습니다."
            : "직원 정보를 저장했습니다.",
          isOpen: () => Boolean(state.managementEmployeeModalOpen),
          submit: () => submitManagementEmployeePreferredForm({
            closeModal: false,
            showSuccessToast: false,
          }),
        },
        holiday: {
          close: closeManagementHolidayModal,
          formId: "management-holiday-form",
          getSuccessToastMessage: () => String(state.managementHolidayDraft?.holidayId || "").trim()
            ? "지정 공휴일을 저장했습니다."
            : "지정 공휴일을 추가했습니다.",
          isOpen: () => Boolean(state.managementHolidayModalOpen),
          submit: submitManagementHolidayForm,
        },
        jobTitle: {
          close: closeManagementJobTitleModal,
          formId: "management-job-title-form",
          getSuccessToastMessage: () => String(state.managementJobTitleDraft?.jobTitleId || "").trim()
            ? "직급 관리를 저장했습니다."
            : "직급을 추가했습니다.",
          isOpen: () => Boolean(state.managementJobTitleModalOpen),
          submit: submitManagementJobTitleForm,
        },
        unit: {
          close: closeManagementUnitModal,
          formId: "management-unit-form",
          getSuccessToastMessage: () => String(state.managementUnitDraft?.unitId || "").trim()
            ? "조직 관리를 저장했습니다."
            : "조직을 추가했습니다.",
          isOpen: () => Boolean(state.managementUnitModalOpen),
          submit: submitManagementUnitForm,
        },
        workPolicy: {
          close: closeManagementWorkPolicyModal,
          formId: "management-work-policy-form",
          getSuccessToastMessage: () => String(state.managementWorkPolicyDraft?.policyId || "").trim()
            ? "근로정책을 저장했습니다."
            : "근로정책을 추가했습니다.",
          isOpen: () => Boolean(state.managementWorkPolicyModalOpen),
          submit: submitManagementWorkPolicyForm,
        },
        worksite: {
          close: closeManagementWorksiteModal,
          formId: "management-worksite-form",
          getSuccessToastMessage: () => String(state.managementWorksiteDraft?.siteId || "").trim()
            ? "근무지 관리를 저장했습니다."
            : "근무지를 추가했습니다.",
          isOpen: () => Boolean(state.managementWorksiteModalOpen),
          submit: submitManagementWorksiteForm,
        },
      };

      return configs[normalizedModalType] || null;
    }

    const managementModalStateController = managementModalStateControllerModule.create({
      getManagementModalConfig,
      managementModalTypes: MANAGEMENT_MODAL_TYPES,
      state,
      syncManagementEmployeeActionButtons,
    });
    const {
      captureManagementModalSnapshot,
      clearManagementModalUiState,
      ensureManagementModalUiState,
      syncManagementModalDirtyState,
    } = managementModalStateController;

    function clearManagementModalState(modalType = "") {
      const normalizedModalType = String(modalType || "").trim();
      const clearedConfirm = clearManagementModalUiState(normalizedModalType);

      if (clearedConfirm) {
        pendingManagementModalAction = null;
      }
    }

    function getActiveManagementModalType() {
      if (state.managementEmployeeModalOpen) {
        return "employee";
      }

      if (state.managementWorkPolicyModalOpen) {
        return "workPolicy";
      }

      if (state.managementWorksiteModalOpen) {
        return "worksite";
      }

      if (state.managementUnitModalOpen) {
        return "unit";
      }

      if (state.managementJobTitleModalOpen) {
        return "jobTitle";
      }

      if (state.managementHolidayModalOpen) {
        return "holiday";
      }

      return "";
    }

    function closeManagementModalConfirm({ shouldRender = true } = {}) {
      const uiState = ensureManagementModalUiState();
      uiState.confirm.open = false;
      uiState.confirm.modalType = "";
      pendingManagementModalAction = null;

      if (shouldRender) {
        renderWorkspacePage();
      }
    }

    async function closeManagementModalImmediately(modalType = "") {
      const config = getManagementModalConfig(modalType);

      if (!config || !config.isOpen()) {
        clearManagementModalState(modalType);
        return;
      }

      clearManagementModalState(modalType);
      config.close();
    }

    async function submitManagementModal(modalType = "", options = {}) {
      const config = getManagementModalConfig(modalType);

      if (!config) {
        return;
      }

      const closeAfterSave = Boolean(options.closeAfterSave);
      const successToastMessage = typeof config.getSuccessToastMessage === "function"
        ? config.getSuccessToastMessage()
        : "변경사항을 저장했습니다.";

      await config.submit();

      if (closeAfterSave) {
        clearManagementModalState(modalType);
        config.close();
        showToast(successToastMessage);
        return;
      }

      captureManagementModalSnapshot(modalType);
      showToast(successToastMessage);
    }

    async function requestManagementModalAction(modalType = "", actions = {}) {
      const normalizedModalType = String(modalType || "").trim();
      const config = getManagementModalConfig(normalizedModalType);

      if (!config || !config.isOpen()) {
        if (typeof actions.onDiscard === "function") {
          await actions.onDiscard();
        }
        return true;
      }

      if (ensureManagementModalUiState().confirm.open) {
        return true;
      }

      if (!syncManagementModalDirtyState(normalizedModalType)) {
        if (typeof actions.onDiscard === "function") {
          await actions.onDiscard();
        }
        return true;
      }

      const uiState = ensureManagementModalUiState();
      uiState.confirm.open = true;
      uiState.confirm.modalType = normalizedModalType;
      pendingManagementModalAction = {
        modalType: normalizedModalType,
        onDiscard: typeof actions.onDiscard === "function" ? actions.onDiscard : null,
        onSave: typeof actions.onSave === "function" ? actions.onSave : null,
      };
      renderWorkspacePage();
      return true;
    }

    async function runWithManagementModalGuard(onProceed) {
      if (state.managementEmployeeExcelModalOpen) {
        closeManagementEmployeeExcelModal();

        if (typeof onProceed === "function") {
          await onProceed();
        }

        return true;
      }

      const activeModalType = getActiveManagementModalType();

      if (!activeModalType) {
        if (typeof onProceed === "function") {
          await onProceed();
        }
        return true;
      }

      return requestManagementModalAction(activeModalType, {
        onDiscard: async () => {
          await closeManagementModalImmediately(activeModalType);

          if (typeof onProceed === "function") {
            await onProceed();
          }
        },
        onSave: async () => {
          await submitManagementModal(activeModalType, { closeAfterSave: true });

          if (typeof onProceed === "function") {
            await onProceed();
          }
        },
      });
    }

    async function handleManagementModalConfirmAction(action = "") {
      const normalizedAction = String(action || "").trim().toLowerCase();

      if (normalizedAction === "cancel") {
        closeManagementModalConfirm();
        return true;
      }

      const pendingAction = pendingManagementModalAction;

      if (!pendingAction) {
        closeManagementModalConfirm();
        return true;
      }

      closeManagementModalConfirm({ shouldRender: false });

      if (normalizedAction === "discard") {
        await pendingAction.onDiscard?.();
        return true;
      }

      if (normalizedAction === "save") {
        await pendingAction.onSave?.();
        return true;
      }

      renderWorkspacePage();
      return true;
    }

    function bindManagementModalSnapshot(modalType = "", openAction = null, ...args) {
      openAction?.(...args);
      window.requestAnimationFrame(() => {
        captureManagementModalSnapshot(modalType);
      });
    }

    function openManagedHolidayModal(holidayId = "") {
      bindManagementModalSnapshot("holiday", openManagementHolidayModal, holidayId);
    }

    function openManagedEmployeeModal(employeeId = "") {
      bindManagementModalSnapshot("employee", openManagementEmployeeModal, employeeId);
    }

    function openManagedJobTitleModal(jobTitleId = "") {
      bindManagementModalSnapshot("jobTitle", openManagementJobTitleModal, jobTitleId);
    }

    function openManagedUnitModal(parentUnitId = "") {
      bindManagementModalSnapshot("unit", openManagementUnitModal, parentUnitId);
    }

    function openManagedUnitEditModal(unitId = "") {
      bindManagementModalSnapshot("unit", openManagementUnitEditModal, unitId);
    }

    function openManagedWorkPolicyModal(policyId = "") {
      bindManagementModalSnapshot("workPolicy", openManagementWorkPolicyModal, policyId);
    }

    function openManagedWorksiteModal(siteId = "") {
      bindManagementModalSnapshot("worksite", openManagementWorksiteModal, siteId);
    }

    async function requestCloseManagementHolidayModal() {
      return requestManagementModalAction("holiday", {
        onDiscard: () => closeManagementModalImmediately("holiday"),
        onSave: () => submitManagementModal("holiday", { closeAfterSave: true }),
      });
    }

    async function requestCloseManagementEmployeeModal() {
      return requestManagementModalAction("employee", {
        onDiscard: () => closeManagementModalImmediately("employee"),
        onSave: () => submitManagementModal("employee", { closeAfterSave: true }),
      });
    }

    async function requestCloseManagementJobTitleModal() {
      return requestManagementModalAction("jobTitle", {
        onDiscard: () => closeManagementModalImmediately("jobTitle"),
        onSave: () => submitManagementModal("jobTitle", { closeAfterSave: true }),
      });
    }

    async function requestCloseManagementUnitModal() {
      return requestManagementModalAction("unit", {
        onDiscard: () => closeManagementModalImmediately("unit"),
        onSave: () => submitManagementModal("unit", { closeAfterSave: true }),
      });
    }

    async function requestCloseManagementWorkPolicyModal() {
      return requestManagementModalAction("workPolicy", {
        onDiscard: () => closeManagementModalImmediately("workPolicy"),
        onSave: () => submitManagementModal("workPolicy", { closeAfterSave: true }),
      });
    }

    async function requestCloseManagementWorksiteModal() {
      return requestManagementModalAction("worksite", {
        onDiscard: () => closeManagementModalImmediately("worksite"),
        onSave: () => submitManagementModal("worksite", { closeAfterSave: true }),
      });
    }

    return Object.freeze({
      captureManagementModalSnapshot,
      clearManagementModalState,
      closeManagementEmployeeModal: requestCloseManagementEmployeeModal,
      closeManagementModalConfirm,
      getActiveManagementModalType,
      handleManagementModalConfirmAction,
      openManagementEmployeeModal: openManagedEmployeeModal,
      openManagementHolidayModal: openManagedHolidayModal,
      openManagementJobTitleModal: openManagedJobTitleModal,
      openManagementUnitEditModal: openManagedUnitEditModal,
      openManagementUnitModal: openManagedUnitModal,
      openManagementWorkPolicyModal: openManagedWorkPolicyModal,
      openManagementWorksiteModal: openManagedWorksiteModal,
      runWithManagementModalGuard,
      submitManagementHolidayForm: () => submitManagementModal("holiday"),
      submitManagementJobTitleForm: () => submitManagementModal("jobTitle"),
      submitManagementUnitForm: () => submitManagementModal("unit"),
      submitManagementWorkPolicyForm: () => submitManagementModal("workPolicy"),
      submitManagementWorksiteForm: () => submitManagementModal("worksite"),
      syncManagementModalDirtyState,
      closeManagementHolidayModal: requestCloseManagementHolidayModal,
      closeManagementJobTitleModal: requestCloseManagementJobTitleModal,
      closeManagementUnitModal: requestCloseManagementUnitModal,
      closeManagementWorkPolicyModal: requestCloseManagementWorkPolicyModal,
      closeManagementWorksiteModal: requestCloseManagementWorksiteModal,
    });
  }

  return Object.freeze({ create });
});
