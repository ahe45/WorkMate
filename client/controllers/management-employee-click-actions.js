(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeClickActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      captureManagementModalSnapshot,
      closeManagementEmployeeDeleteConfirmModal,
      closeManagementEmployeeExcelModal,
      closeManagementEmployeeInviteChannelModal,
      closeManagementEmployeeModal,
      downloadManagementEmployeeCardFile,
      downloadManagementEmployeeExcelTemplate,
      handleProtectedFailure,
      isManagementSection,
      openManagementEmployeeDeleteConfirmModal,
      openManagementEmployeeExcelModal,
      openManagementEmployeeInviteChannelModal,
      openManagementEmployeeModal,
      setInlineMessage,
      showToast,
      submitManagementEmployeeDelete,
      submitManagementEmployeeDraftForm,
      submitManagementEmployeeExcelUpload,
      submitManagementEmployeeInviteForm,
      submitManagementEmployeeSaveForm,
      syncManagementEmployeeActionButtons,
    } = dependencies;

    if (typeof isManagementSection !== "function" || typeof setInlineMessage !== "function") {
      throw new Error("WorkMateManagementEmployeeClickActions requires employee click dependencies.");
    }

    async function handleManagementEmployeeClick(target) {
      const managementEmployeeDeleteCloseButton = target.closest("[data-management-employee-delete-close]");
      const managementEmployeeDeleteOpenButton = target.closest("[data-management-employee-delete-open]");
      const managementEmployeeDeleteSubmitButton = target.closest("[data-management-employee-delete-submit]");
      const managementEmployeeExcelCloseButton = target.closest("[data-management-employee-excel-close]");
      const managementEmployeeInviteChannelButton = target.closest("[data-management-employee-invite-channel]");
      const managementEmployeeInviteChannelCloseButton = target.closest("[data-management-employee-invite-channel-close]");
      const managementEmployeeCloseButton = target.closest("[data-management-employee-close]");
      const managementEmployeeCardDownloadButton = target.closest("[data-management-employee-card-download]");
      const managementEmployeeExcelOpenButton = target.closest("[data-management-employee-excel-open]");
      const managementEmployeeExcelTemplateDownloadButton = target.closest("[data-management-employee-excel-template-download]");
      const managementEmployeeOpenButton = target.closest("[data-management-employee-open]");
      const managementEmployeeExcelSubmitButton = target.closest("[data-management-employee-excel-submit]");
      const managementEmployeeSubmitButton = target.closest("[data-management-employee-submit]");

      if (managementEmployeeCloseButton) {
        closeManagementEmployeeModal();
        return true;
      }

      if (managementEmployeeDeleteCloseButton) {
        closeManagementEmployeeDeleteConfirmModal?.();
        return true;
      }

      if (managementEmployeeInviteChannelCloseButton) {
        closeManagementEmployeeInviteChannelModal?.();
        return true;
      }

      if (managementEmployeeExcelCloseButton) {
        closeManagementEmployeeExcelModal();
        return true;
      }

      if (!isManagementSection("employees")) {
        return false;
      }

      if (managementEmployeeCardDownloadButton) {
        downloadManagementEmployeeCardFile?.();
        return true;
      }

      if (managementEmployeeExcelOpenButton) {
        openManagementEmployeeExcelModal();
        return true;
      }

      if (managementEmployeeExcelTemplateDownloadButton) {
        try {
          setInlineMessage(document.getElementById("management-employee-excel-error"), "");
          await downloadManagementEmployeeExcelTemplate();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-employee-excel-error"), error.message || "양식 다운로드를 처리하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementEmployeeExcelSubmitButton) {
        try {
          setInlineMessage(document.getElementById("management-employee-excel-error"), "");
          await submitManagementEmployeeExcelUpload();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-employee-excel-error"), error.message || "엑셀 업로드를 처리하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementEmployeeOpenButton) {
        openManagementEmployeeModal(managementEmployeeOpenButton.dataset.managementEmployeeOpen || "");
        return true;
      }

      if (managementEmployeeDeleteOpenButton) {
        try {
          openManagementEmployeeDeleteConfirmModal?.();
        } catch (error) {
          setInlineMessage(document.getElementById("management-employee-error"), error.message || "직원 삭제를 시작하지 못했습니다.");
        }

        return true;
      }

      if (managementEmployeeDeleteSubmitButton) {
        try {
          await submitManagementEmployeeDelete?.();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-employee-delete-error"), error.message || "직원 데이터를 삭제하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementEmployeeSubmitButton) {
        try {
          setInlineMessage(document.getElementById("management-employee-error"), "");

          const submitAction = String(managementEmployeeSubmitButton.dataset.managementEmployeeSubmit || "").trim();

          if (submitAction === "invite") {
            openManagementEmployeeInviteChannelModal?.();
          } else if (submitAction === "save") {
            await submitManagementEmployeeSaveForm({ closeModal: false });
            captureManagementModalSnapshot?.("employee");
            syncManagementEmployeeActionButtons?.();
          } else {
            await submitManagementEmployeeDraftForm();
          }
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-employee-error"), error.message || "직원 정보를 저장하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementEmployeeInviteChannelButton) {
        try {
          setInlineMessage(document.getElementById("management-employee-error"), "");
          await submitManagementEmployeeInviteForm({
            inviteChannels: [managementEmployeeInviteChannelButton.dataset.managementEmployeeInviteChannel || ""],
            closeModal: false,
          });
          captureManagementModalSnapshot?.("employee");
          syncManagementEmployeeActionButtons?.();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            showToast(error.message || "합류 요청을 보내지 못했습니다.", { tone: "error" });
            window.requestAnimationFrame(() => {
              setInlineMessage(document.getElementById("management-employee-error"), error.message || "합류 요청을 보내지 못했습니다.");
            });
          }
        }

        return true;
      }

      return false;
    }

    return Object.freeze({
      handleManagementEmployeeClick,
    });
  }

  return Object.freeze({ create });
});
