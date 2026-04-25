(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppFormController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      currentPage,
      handleProtectedFailure,
      loadCompanies,
      persistSelectedOrganizationId,
      refreshWorkspaceData,
      renderCompaniesPage,
      renderers,
      searchManagementWorksiteLocations,
      setInlineMessage,
      state,
      submitClock,
      submitManagementHolidayForm,
      submitManagementJobTitleForm,
      submitManagementUnitForm,
      submitManagementWorkPolicyForm,
      submitManagementWorksiteForm,
      syncManagementWorksiteDraftFromDom,
      updateUserMeta,
      closeAccountSettingsModal,
      closeCompanyCreateModal,
      closeCompanySettingsModal,
    } = dependencies;

    if (!api || !setInlineMessage || !state) {
      throw new Error("WorkMateAppFormController requires app form dependencies.");
    }

    async function handleFormSubmit(event) {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (form.id === "account-settings-form") {
        event.preventDefault();
        setInlineMessage(document.getElementById("account-settings-error"), "");

        try {
          const payload = await api.requestWithAutoRefresh("/v1/me", {
            body: JSON.stringify({
              name: document.getElementById("account-settings-name")?.value || "",
              phone: document.getElementById("account-settings-phone")?.value || "",
            }),
            method: "PATCH",
          });

          state.user = payload?.user || state.user;
          closeAccountSettingsModal();

          if (currentPage === "companies") {
            renderCompaniesPage();
          } else {
            updateUserMeta();
          }
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("account-settings-error"), error.message || "계정 정보를 저장하지 못했습니다.");
          }
        }
        return;
      }

      if (form.id === "company-settings-form") {
        event.preventDefault();
        setInlineMessage(document.getElementById("company-settings-error"), "");

        try {
          await api.requestWithAutoRefresh(`/v1/account/organizations/${document.getElementById("company-settings-id")?.value || ""}`, {
            body: JSON.stringify({
              code: document.getElementById("company-settings-code")?.value || "",
              name: document.getElementById("company-settings-name")?.value || "",
            }),
            method: "PATCH",
          });

          closeCompanySettingsModal();
          await loadCompanies();
          renderCompaniesPage();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("company-settings-error"), error.message || "워크스페이스 정보를 저장하지 못했습니다.");
          }
        }
        return;
      }

      if (form.id === "company-form") {
        event.preventDefault();
        setInlineMessage(document.getElementById("company-form-error"), "");

        try {
          const created = await api.requestWithAutoRefresh("/v1/account/organizations", {
            body: JSON.stringify({
              code: document.getElementById("company-code")?.value || "",
              name: document.getElementById("company-name")?.value || "",
            }),
            method: "POST",
          });

          persistSelectedOrganizationId(created?.id || "");
          closeCompanyCreateModal();
          await loadCompanies();
          renderCompaniesPage();
        } catch (error) {
          if (!handleProtectedFailure(error)) {
            setInlineMessage(document.getElementById("company-form-error"), error.message || "회사 생성에 실패했습니다.");
          }
        }
        return;
      }

      if (currentPage !== "workspace") {
        return;
      }

      event.preventDefault();

      try {
        if (form.id === "management-unit-form") {
          await submitManagementUnitForm();
          return;
        }

        if (form.id === "management-job-title-form") {
          await submitManagementJobTitleForm();
          return;
        }

        if (form.id === "management-holiday-form") {
          await submitManagementHolidayForm();
          return;
        }

        if (form.id === "management-work-policy-form") {
          await submitManagementWorkPolicyForm();
          return;
        }

        if (form.id === "management-worksite-search-form") {
          syncManagementWorksiteDraftFromDom();
          await searchManagementWorksiteLocations(document.getElementById("management-worksite-search-query")?.value || "");
          return;
        }

        if (form.id === "management-worksite-form") {
          await submitManagementWorksiteForm();
          return;
        }

        if (form.id === "site-form") {
          await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/sites`, {
            body: JSON.stringify({
              code: document.getElementById("site-code")?.value || "",
              name: document.getElementById("site-name")?.value || "",
              primaryUnitId: document.getElementById("site-unit")?.value || null,
            }),
            method: "POST",
          });
        } else if (form.id === "user-form") {
          const defaultWorkPolicyId = state.bootstrap?.organizationContext?.defaultWorkPolicyId;

          if (!defaultWorkPolicyId) {
            throw new Error("기본 근무 정책을 찾을 수 없습니다.");
          }

          await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/users`, {
            body: JSON.stringify({
              defaultSiteId: document.getElementById("user-site")?.value || null,
              employeeNo: document.getElementById("user-employee-no")?.value || "",
              loginEmail: document.getElementById("user-email")?.value || "",
              name: document.getElementById("user-name")?.value || "",
              primaryUnitId: document.getElementById("user-unit")?.value || "",
              workPolicyId: defaultWorkPolicyId,
            }),
            method: "POST",
          });
        } else if (form.id === "template-form") {
          const defaultWorkPolicyId = state.bootstrap?.organizationContext?.defaultWorkPolicyId;

          if (!defaultWorkPolicyId) {
            throw new Error("기본 근무 정책을 찾을 수 없습니다.");
          }

          await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/schedule-templates`, {
            body: JSON.stringify({
              code: document.getElementById("template-code")?.value || "",
              days: renderers.buildWeekdayTemplateDays(state.bootstrap?.workPolicy?.workInformation || {}),
              name: document.getElementById("template-name")?.value || "",
              trackType: "FIXED",
              workPolicyId: defaultWorkPolicyId,
            }),
            method: "POST",
          });
        } else if (form.id === "assignment-form") {
          await api.requestWithAutoRefresh(`/v1/orgs/${state.selectedOrganizationId}/schedule-assignments`, {
            body: JSON.stringify({
              applyType: "USER",
              effectiveFrom: document.getElementById("assignment-from")?.value || "",
              effectiveTo: document.getElementById("assignment-to")?.value || "",
              scheduleTemplateId: document.getElementById("assignment-template")?.value || "",
              targetId: document.getElementById("assignment-user")?.value || "",
            }),
            method: "POST",
          });
        } else if (form.id === "clock-form") {
          await submitClock(false);
          return;
        } else {
          return;
        }

        await refreshWorkspaceData();
      } catch (error) {
        if (!handleProtectedFailure(error)) {
          if (form.id === "management-work-policy-form") {
            setInlineMessage(document.getElementById("management-work-policy-error"), error.message || "근로정보를 저장하지 못했습니다.");
          } else {
            window.alert(error.message || "요청 처리에 실패했습니다.");
          }
        }
      }
    }

    function bindFormHandlers() {
      document.addEventListener("submit", (event) => {
        handleFormSubmit(event).catch((error) => {
          window.alert(error.message || "요청 처리에 실패했습니다.");
        });
      });
    }

    return Object.freeze({
      bindFormHandlers,
    });
  }

  return Object.freeze({ create });
});
