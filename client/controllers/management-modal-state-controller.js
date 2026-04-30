(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementModalStateController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      getManagementModalConfig,
      managementModalTypes,
      state,
      syncManagementEmployeeActionButtons,
    } = dependencies;

    if (
      typeof getManagementModalConfig !== "function"
      || !Array.isArray(managementModalTypes)
      || !state
      || typeof syncManagementEmployeeActionButtons !== "function"
    ) {
      throw new Error("WorkMateManagementModalStateController requires modal state dependencies.");
    }

    function ensureManagementModalUiState() {
      if (!state.managementModalUi || typeof state.managementModalUi !== "object") {
        state.managementModalUi = {};
      }

      if (!state.managementModalUi.confirm || typeof state.managementModalUi.confirm !== "object") {
        state.managementModalUi.confirm = {
          modalType: "",
          open: false,
        };
      }

      if (!state.managementModalUi.dirty || typeof state.managementModalUi.dirty !== "object") {
        state.managementModalUi.dirty = {};
      }

      if (!state.managementModalUi.initialSnapshots || typeof state.managementModalUi.initialSnapshots !== "object") {
        state.managementModalUi.initialSnapshots = {};
      }

      managementModalTypes.forEach((modalType) => {
        if (typeof state.managementModalUi.dirty[modalType] !== "boolean") {
          state.managementModalUi.dirty[modalType] = false;
        }

        if (typeof state.managementModalUi.initialSnapshots[modalType] !== "string") {
          state.managementModalUi.initialSnapshots[modalType] = "";
        }
      });

      if (typeof state.managementModalUi.confirm.modalType !== "string") {
        state.managementModalUi.confirm.modalType = "";
      }

      state.managementModalUi.confirm.open = Boolean(state.managementModalUi.confirm.open);
      return state.managementModalUi;
    }

    function getManagementModalSnapshotFieldKey(element) {
      const name = String(element?.name || "").trim();

      if (name) {
        return name;
      }

      const id = String(element?.id || "").trim();

      if (id) {
        return id;
      }

      return "";
    }

    function getManagementModalFormSnapshot(modalType = "") {
      const config = getManagementModalConfig(modalType);

      if (!config) {
        return "";
      }

      const form = document.getElementById(config.formId);

      if (!(form instanceof HTMLFormElement)) {
        return "";
      }

      const snapshot = Array.from(form.elements)
        .map((element) => {
          if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
            return null;
          }

          const key = getManagementModalSnapshotFieldKey(element);

          if (!key) {
            return null;
          }

          if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
            return {
              checked: Boolean(element.checked),
              disabled: Boolean(element.disabled),
              key,
              type: element.type,
              value: element.value || "on",
            };
          }

          if (element instanceof HTMLSelectElement && element.multiple) {
            return {
              disabled: Boolean(element.disabled),
              key,
              type: "select-multiple",
              value: Array.from(element.selectedOptions).map((option) => option.value),
            };
          }

          return {
            disabled: Boolean(element.disabled),
            key,
            type: element instanceof HTMLSelectElement ? "select" : element instanceof HTMLTextAreaElement ? "textarea" : element.type || "text",
            value: element.value,
          };
        })
        .filter(Boolean);

      return JSON.stringify(snapshot);
    }

    function updateManagementModalSaveButtonState(modalType = "") {
      const uiState = ensureManagementModalUiState();
      const isDirty = Boolean(uiState.dirty[String(modalType || "").trim()]);

      document.querySelectorAll(`[data-management-modal-save-button="${String(modalType || "").trim()}"]`).forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          const isBlocked = button.dataset.managementModalSaveBlocked === "true";
          button.disabled = isBlocked || !isDirty;
        }
      });
    }

    function syncManagementModalDirtyState(modalType = "") {
      const normalizedModalType = String(modalType || "").trim();
      const uiState = ensureManagementModalUiState();
      const config = getManagementModalConfig(normalizedModalType);

      if (!config || !config.isOpen()) {
        uiState.dirty[normalizedModalType] = false;
        updateManagementModalSaveButtonState(normalizedModalType);
        return false;
      }

      const nextSnapshot = getManagementModalFormSnapshot(normalizedModalType);
      const isDirty = Boolean(uiState.initialSnapshots[normalizedModalType])
        && nextSnapshot !== uiState.initialSnapshots[normalizedModalType];

      uiState.dirty[normalizedModalType] = isDirty;
      updateManagementModalSaveButtonState(normalizedModalType);
      return isDirty;
    }

    function captureManagementModalSnapshot(modalType = "") {
      const normalizedModalType = String(modalType || "").trim();
      const uiState = ensureManagementModalUiState();
      uiState.initialSnapshots[normalizedModalType] = getManagementModalFormSnapshot(normalizedModalType);
      uiState.dirty[normalizedModalType] = false;
      updateManagementModalSaveButtonState(normalizedModalType);

      if (normalizedModalType === "employee") {
        syncManagementEmployeeActionButtons();
      }
    }

    function clearManagementModalUiState(modalType = "") {
      const normalizedModalType = String(modalType || "").trim();
      const uiState = ensureManagementModalUiState();
      uiState.initialSnapshots[normalizedModalType] = "";
      uiState.dirty[normalizedModalType] = false;

      const clearedConfirm = uiState.confirm.open && uiState.confirm.modalType === normalizedModalType;

      if (clearedConfirm) {
        uiState.confirm.open = false;
        uiState.confirm.modalType = "";
      }

      updateManagementModalSaveButtonState(normalizedModalType);
      return clearedConfirm;
    }

    return Object.freeze({
      captureManagementModalSnapshot,
      clearManagementModalUiState,
      ensureManagementModalUiState,
      syncManagementModalDirtyState,
    });
  }

  return Object.freeze({ create });
});
