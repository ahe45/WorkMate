(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionCompaniesClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      closeAccountSettingsModal,
      closeCompanyCreateModal,
      closeCompanySettingsModal,
      navigateTo,
      openAccountSettingsModal,
      openCompanyCreateModal,
      openCompanySettingsModal,
      persistSelectedOrganizationId,
    } = dependencies;

    if (!appConfig || typeof navigateTo !== "function") {
      throw new Error("WorkMateAppInteractionCompaniesClickHandler requires company click dependencies.");
    }

    async function handleDocumentClick(event) {
      if (currentPage !== "companies") {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (!target) {
        return false;
      }

      const accountSettingsOpenButton = target.closest("[data-account-settings-open]");
      const accountSettingsCloseButton = target.closest("[data-account-settings-close]");
      const companySettingsOpenButton = target.closest("[data-company-settings-open]");
      const companySettingsCloseButton = target.closest("[data-company-settings-close]");
      const companyCreateOpenButton = target.closest("[data-company-create-open]");
      const companyCreateCloseButton = target.closest("[data-company-create-close]");
      const companyButton = target.closest("[data-company-open]");

      if (accountSettingsOpenButton) {
        openAccountSettingsModal();
        return true;
      }

      if (accountSettingsCloseButton) {
        closeAccountSettingsModal();
        return true;
      }

      if (companySettingsOpenButton) {
        openCompanySettingsModal(companySettingsOpenButton);
        return true;
      }

      if (companySettingsCloseButton) {
        closeCompanySettingsModal();
        return true;
      }

      if (companyCreateOpenButton) {
        openCompanyCreateModal();
        return true;
      }

      if (companyCreateCloseButton) {
        closeCompanyCreateModal();
        return true;
      }

      if (companyButton) {
        persistSelectedOrganizationId(companyButton.dataset.companyId || "");
        navigateTo(appConfig.buildWorkspacePath(
          companyButton.dataset.companyOpen || "",
          appConfig.defaultWorkspaceView,
        ));
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleDocumentClick,
    });
  }

  return Object.freeze({ create });
});
