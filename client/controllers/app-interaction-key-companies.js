(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionCompaniesKeyHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      closeAccountSettingsModal,
      closeCompanyCreateModal,
      closeCompanySettingsModal,
      currentPage,
      getAccountSettingsModal,
      getCompanyCreateModal,
      getCompanySettingsModal,
    } = dependencies;

    if (currentPage !== "companies") {
      return Object.freeze({
        handleDocumentKeydown: () => false,
      });
    }

    function handleDocumentKeydown(event) {
      if (event.key !== "Escape") {
        return false;
      }

      if (!getCompanySettingsModal()?.classList.contains("hidden")) {
        closeCompanySettingsModal();
        return true;
      }

      if (!getAccountSettingsModal()?.classList.contains("hidden")) {
        closeAccountSettingsModal();
        return true;
      }

      if (!getCompanyCreateModal()?.classList.contains("hidden")) {
        closeCompanyCreateModal();
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleDocumentKeydown,
    });
  }

  return Object.freeze({ create });
});
