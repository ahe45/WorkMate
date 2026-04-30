(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionManagementLeaveClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const leaveRuleClickActionsModule = globalThis.WorkMateManagementLeaveRuleClickActions
    || (typeof require === "function" ? require("./management-leave-rule-click-actions.js") : null);

  function create(dependencies = {}) {
    const {
      api,
      handleProtectedFailure,
      isManagementSection,
      refreshWorkspaceData,
      renderWorkspacePage,
      setInlineMessage,
      showToast,
      state,
    } = dependencies;

    if (!api || typeof isManagementSection !== "function" || typeof renderWorkspacePage !== "function" || !state) {
      throw new Error("WorkMateAppInteractionManagementLeaveClickHandler requires leave click dependencies.");
    }

    if (!leaveRuleClickActionsModule || typeof leaveRuleClickActionsModule.create !== "function") {
      throw new Error("client/controllers/management-leave-rule-click-actions.js must be loaded before client/controllers/app-interaction-click-management-leave.js.");
    }

    function getControlValue(id = "") {
      const control = document.getElementById(id);

      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        return control.value;
      }

      return "";
    }

    function mergeLeaveGroupIntoBootstrap(group = {}, parentLeaveGroupId = "") {
      const groupId = String(group?.id || "").trim();

      if (!groupId) {
        return;
      }

      if (!state.bootstrap || typeof state.bootstrap !== "object") {
        state.bootstrap = {};
      }

      if (!Array.isArray(state.bootstrap.leaveGroups)) {
        state.bootstrap.leaveGroups = [];
      }

      const normalizedParentLeaveGroupId = String(group?.parentLeaveGroupId || group?.parent_leave_group_id || parentLeaveGroupId || "").trim() || null;
      const normalizedGroup = {
        ...group,
        parentLeaveGroupId: normalizedParentLeaveGroupId,
        status: group?.status || "ACTIVE",
      };
      const existingIndex = state.bootstrap.leaveGroups.findIndex((leaveGroup) => String(leaveGroup?.id || "").trim() === groupId);

      if (existingIndex >= 0) {
        state.bootstrap.leaveGroups[existingIndex] = {
          ...state.bootstrap.leaveGroups[existingIndex],
          ...normalizedGroup,
          parentLeaveGroupId: normalizedParentLeaveGroupId,
        };
        return;
      }

      state.bootstrap.leaveGroups.unshift(normalizedGroup);
    }

    function getManagementLeaveGroupById(leaveGroupId = "") {
      const normalizedLeaveGroupId = String(leaveGroupId || "").trim();

      if (!normalizedLeaveGroupId) {
        return null;
      }

      return (Array.isArray(state.bootstrap?.leaveGroups) ? state.bootstrap.leaveGroups : [])
        .find((leaveGroup) => String(leaveGroup?.id || "").trim() === normalizedLeaveGroupId) || null;
    }

    function getManagementLeaveGroupParentId(leaveGroup = {}) {
      return String(leaveGroup?.parentLeaveGroupId || leaveGroup?.parent_leave_group_id || leaveGroup?.parentId || "").trim();
    }

    async function reloadManagementAfterLeavePolicyAction(message = "", afterRefresh = null) {
      if (typeof refreshWorkspaceData === "function") {
        await refreshWorkspaceData();
      }

      if (typeof afterRefresh === "function") {
        afterRefresh();
      }

      renderWorkspacePage();

      if (message) {
        showToast?.(message);
      }
    }

    const {
      addManagementLeaveRuleRange,
      closeManagementLeaveRuleModal,
      deleteManagementLeaveRule,
      removeManagementLeaveRuleRange,
      submitManagementLeaveRule,
      syncManagementLeaveRuleFrequencySections,
      syncManagementLeaveRuleImmediateSections,
      syncManagementLeaveRuleMonthlyMethodSections,
      syncManagementLeaveRuleRangeRemoveButtons,
    } = leaveRuleClickActionsModule.create({
      api,
      reloadManagementAfterLeavePolicyAction,
      renderWorkspacePage,
      setInlineMessage,
      state,
    });

    function closeManagementLeaveGroupModal() {
      state.managementLeaveGroupModalOpen = false;
      state.managementLeaveGroupParentId = "";
      state.managementLeaveGroupEditId = "";
    }

    async function submitManagementLeaveGroup() {
      const errorTarget = document.getElementById("management-leave-group-error");
      const editLeaveGroupId = String(getControlValue("management-leave-group-id") || state.managementLeaveGroupEditId || "").trim();
      const parentLeaveGroupId = String(getControlValue("management-leave-group-parent") || state.managementLeaveGroupParentId || "").trim() || null;
      const payload = {
        description: getControlValue("management-leave-group-description"),
        name: getControlValue("management-leave-group-name"),
        negativeLimitDays: getControlValue("management-leave-group-negative-limit"),
        parentLeaveGroupId,
      };

      setInlineMessage(errorTarget, "");
      const savedGroup = await api.requestWithAutoRefresh(editLeaveGroupId
        ? `/v1/orgs/${state.selectedOrganizationId}/leave-groups/${encodeURIComponent(editLeaveGroupId)}`
        : `/v1/orgs/${state.selectedOrganizationId}/leave-groups`, {
        body: JSON.stringify(payload),
        method: editLeaveGroupId ? "PATCH" : "POST",
      });
      closeManagementLeaveGroupModal();
      await reloadManagementAfterLeavePolicyAction(editLeaveGroupId ? "휴가정책을 저장했습니다." : "휴가정책을 생성했습니다.", () => {
        mergeLeaveGroupIntoBootstrap(savedGroup, parentLeaveGroupId);
      });
    }

    async function deleteManagementLeaveGroup(leaveGroupId = "") {
      const normalizedLeaveGroupId = String(leaveGroupId || "").trim();
      const targetLeaveGroup = getManagementLeaveGroupById(normalizedLeaveGroupId);

      if (!normalizedLeaveGroupId || !targetLeaveGroup) {
        return;
      }

      const confirmed = window.confirm(`"${targetLeaveGroup.name || "휴가정책"}"을(를) 삭제하시겠습니까?`);

      if (!confirmed) {
        return;
      }

      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/leave-groups/${encodeURIComponent(normalizedLeaveGroupId)}`, {
        method: "DELETE",
      });

      if (String(state.managementLeaveGroupEditId || "").trim() === normalizedLeaveGroupId
        || String(state.managementLeaveGroupParentId || "").trim() === normalizedLeaveGroupId) {
        closeManagementLeaveGroupModal();
      }

      await reloadManagementAfterLeavePolicyAction("휴가정책을 삭제했습니다.");
    }

    async function createManagementManualLeaveGrant() {
      const errorTarget = document.getElementById("management-leave-grant-error");

      setInlineMessage(errorTarget, "");
      await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/leave-grants/manual`, {
        body: JSON.stringify({
          accrualDate: getControlValue("management-leave-grant-date"),
          amountDays: getControlValue("management-leave-grant-amount"),
          expiresAt: getControlValue("management-leave-grant-expires"),
          leaveGroupId: getControlValue("management-leave-grant-group"),
          memo: getControlValue("management-leave-grant-memo"),
          userId: getControlValue("management-leave-grant-user"),
        }),
        method: "POST",
      });
      state.managementLeaveManualGrantModalOpen = false;
      await reloadManagementAfterLeavePolicyAction("휴가를 수동 부여했습니다.");
    }

    async function handleManagementLeaveClick(target) {
      const managementLeaveGroupCloseButton = target.closest("[data-management-leave-group-close]");
      const managementLeaveGroupCreateButton = target.closest("[data-management-leave-group-create]");
      const managementLeaveGroupDeleteButton = target.closest("[data-management-leave-group-delete]");
      const managementLeaveGroupEditButton = target.closest("[data-management-leave-group-edit]");
      const managementLeaveGroupOpenButton = target.closest("[data-management-leave-group-open]");
      const managementLeaveManualCloseButton = target.closest("[data-management-leave-manual-close]");
      const managementLeaveManualGrantButton = target.closest("[data-management-leave-manual-grant]");
      const managementLeaveManualOpenButton = target.closest("[data-management-leave-manual-open]");
      const managementLeaveRuleCloseButton = target.closest("[data-management-leave-rule-close]");
      const managementLeaveRuleAddRangeButton = target.closest("[data-management-leave-rule-add-range]");
      const managementLeaveRuleCreateButton = target.closest("[data-management-leave-rule-create]");
      const managementLeaveRuleDeleteButton = target.closest("[data-management-leave-rule-delete]");
      const managementLeaveRuleEditButton = target.closest("[data-management-leave-rule-edit]");
      const managementLeaveRuleFrequencyControl = target.closest("[data-management-leave-rule-frequency], [data-management-leave-rule-frequency-option]");
      const managementLeaveRuleImmediateModeControl = target.closest("[data-management-leave-rule-immediate-mode], [data-management-leave-rule-immediate-mode-option]");
      const managementLeaveRuleMonthlyMethodControl = target.closest("[data-management-leave-rule-monthly-method], [data-management-leave-rule-monthly-method-option]");
      const managementLeaveRuleOpenButton = target.closest("[data-management-leave-rule-open]");
      const managementLeaveRuleRemoveRangeButton = target.closest("[data-management-leave-rule-remove-range]");

      if (managementLeaveGroupCloseButton && state.managementLeaveGroupModalOpen) {
        closeManagementLeaveGroupModal();
        renderWorkspacePage();
        return true;
      }

      if (managementLeaveGroupOpenButton && isManagementSection("leave-policies")) {
        const requestedParentLeaveGroupId = String(managementLeaveGroupOpenButton.dataset.managementLeaveGroupOpen || "").trim();

        state.managementLeaveGroupEditId = "";
        state.managementLeaveGroupParentId = requestedParentLeaveGroupId && requestedParentLeaveGroupId !== "true"
          ? requestedParentLeaveGroupId
          : "";
        state.managementLeaveGroupModalOpen = true;
        renderWorkspacePage();

        window.requestAnimationFrame(() => {
          document.getElementById("management-leave-group-name")?.focus?.();
        });

        return true;
      }

      if (managementLeaveGroupEditButton && isManagementSection("leave-policies")) {
        const targetLeaveGroup = getManagementLeaveGroupById(managementLeaveGroupEditButton.dataset.managementLeaveGroupEdit || "");

        if (targetLeaveGroup) {
          state.managementLeaveGroupEditId = String(targetLeaveGroup.id || "").trim();
          state.managementLeaveGroupParentId = getManagementLeaveGroupParentId(targetLeaveGroup);
          state.managementLeaveGroupModalOpen = true;
          renderWorkspacePage();

          window.requestAnimationFrame(() => {
            document.getElementById("management-leave-group-name")?.focus?.();
          });
        }

        return true;
      }

      if (managementLeaveManualCloseButton && state.managementLeaveManualGrantModalOpen) {
        state.managementLeaveManualGrantModalOpen = false;
        renderWorkspacePage();
        return true;
      }

      if (managementLeaveManualOpenButton && isManagementSection("leave-accrual-rules")) {
        state.managementLeaveManualGrantModalOpen = true;
        renderWorkspacePage();

        window.requestAnimationFrame(() => {
          document.getElementById("management-leave-grant-user")?.focus?.();
        });

        return true;
      }

      if (managementLeaveRuleCloseButton && state.managementLeaveRuleModalOpen) {
        closeManagementLeaveRuleModal();
        renderWorkspacePage();
        return true;
      }

      if (managementLeaveRuleOpenButton && isManagementSection("leave-accrual-rules")) {
        state.managementLeaveRuleEditIds = "";
        state.managementLeaveRuleModalOpen = true;
        renderWorkspacePage();
        syncManagementLeaveRuleFrequencySections();
        syncManagementLeaveRuleRangeRemoveButtons();

        window.requestAnimationFrame(() => {
          document.getElementById("management-leave-rule-name")?.focus?.();
        });

        return true;
      }

      if (managementLeaveRuleEditButton && isManagementSection("leave-accrual-rules")) {
        state.managementLeaveRuleEditIds = String(managementLeaveRuleEditButton.dataset.managementLeaveRuleEdit || "").trim();
        state.managementLeaveRuleModalOpen = true;
        renderWorkspacePage();
        syncManagementLeaveRuleFrequencySections();
        syncManagementLeaveRuleRangeRemoveButtons();

        window.requestAnimationFrame(() => {
          syncManagementLeaveRuleFrequencySections();
          syncManagementLeaveRuleRangeRemoveButtons();
          document.getElementById("management-leave-rule-name")?.focus?.();
        });

        return true;
      }

      if (managementLeaveRuleFrequencyControl && isManagementSection("leave-accrual-rules")) {
        window.requestAnimationFrame(() => {
          syncManagementLeaveRuleFrequencySections();
          syncManagementLeaveRuleRangeRemoveButtons();
        });

        return true;
      }

      if (managementLeaveRuleImmediateModeControl && isManagementSection("leave-accrual-rules")) {
        window.requestAnimationFrame(() => {
          syncManagementLeaveRuleImmediateSections();
        });

        return true;
      }

      if (managementLeaveRuleMonthlyMethodControl && isManagementSection("leave-accrual-rules")) {
        window.requestAnimationFrame(() => {
          syncManagementLeaveRuleMonthlyMethodSections();
        });

        return true;
      }

      if (managementLeaveRuleAddRangeButton && isManagementSection("leave-accrual-rules")) {
        addManagementLeaveRuleRange(managementLeaveRuleAddRangeButton.dataset.managementLeaveRuleAddRange || "MONTHLY");
        return true;
      }

      if (managementLeaveRuleRemoveRangeButton && isManagementSection("leave-accrual-rules")) {
        removeManagementLeaveRuleRange(managementLeaveRuleRemoveRangeButton);
        return true;
      }

      if (managementLeaveGroupCreateButton && isManagementSection("leave-policies")) {
        try {
          await submitManagementLeaveGroup();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-leave-group-error"), error.message || "휴가정책을 저장하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementLeaveGroupDeleteButton && isManagementSection("leave-policies")) {
        try {
          await deleteManagementLeaveGroup(managementLeaveGroupDeleteButton.dataset.managementLeaveGroupDelete || "");
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            window.alert(error.message || "휴가정책을 삭제하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementLeaveManualGrantButton && isManagementSection("leave-accrual-rules")) {
        try {
          await createManagementManualLeaveGrant();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-leave-grant-error"), error.message || "휴가를 부여하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementLeaveRuleCreateButton && isManagementSection("leave-accrual-rules")) {
        try {
          await submitManagementLeaveRule();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("management-leave-rule-error"), error.message || "휴가 발생 규칙을 저장하지 못했습니다.");
          }
        }

        return true;
      }

      if (managementLeaveRuleDeleteButton && isManagementSection("leave-accrual-rules")) {
        try {
          await deleteManagementLeaveRule(managementLeaveRuleDeleteButton.dataset.managementLeaveRuleDelete || "");
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            window.alert(error.message || "휴가 발생 규칙을 삭제하지 못했습니다.");
          }
        }

        return true;
      }

      return false;
    }

    return Object.freeze({
      closeManagementLeaveGroupModal,
      closeManagementLeaveRuleModal,
      handleManagementLeaveClick,
    });
  }

  return Object.freeze({ create });
});
