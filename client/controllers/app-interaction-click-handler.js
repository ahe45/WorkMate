(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionClickHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      elements,
      handleProtectedFailure,
      loadManagementHolidayData,
      renderWorkspacePage,
      renderers,
      state,
    } = dependencies;

    if (!appConfig || !elements || !renderers || !state) {
      throw new Error("WorkMateAppInteractionClickHandler requires click handler dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/app-interaction-click-handler.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    let companiesClickHandler = { handleDocumentClick: async () => false };
    let managementClickHandler = { handleDocumentClick: async () => false };
    let workspaceClickHandler = { handleDocumentClick: async () => false };
    let loadHolidayYear = async () => {};

    if (currentPage === "companies") {
      const companiesClickHandlerModule = resolve(
        runtime,
        "WorkMateAppInteractionCompaniesClickHandler",
        "./app-interaction-click-companies.js",
        "client/controllers/app-interaction-click-companies.js must be loaded before client/controllers/app-interaction-click-handler.js.",
      );
      companiesClickHandler = companiesClickHandlerModule.create(dependencies);
    }

    if (currentPage === "workspace") {
      const managementClickHandlerModule = resolve(
        runtime,
        "WorkMateAppInteractionManagementClickHandler",
        "./app-interaction-click-management.js",
        "client/controllers/app-interaction-click-management.js must be loaded before client/controllers/app-interaction-click-handler.js.",
      );
      const workspaceClickHandlerModule = resolve(
        runtime,
        "WorkMateAppInteractionWorkspaceClickHandler",
        "./app-interaction-click-workspace.js",
        "client/controllers/app-interaction-click-workspace.js must be loaded before client/controllers/app-interaction-click-handler.js.",
      );

      loadHolidayYear = async (year) => {
        loadManagementHolidayData({ force: true, year }).then(() => {
          renderWorkspacePage();
        }).catch((error) => {
          if (!handleProtectedFailure(error)) {
            window.alert(error.message || "공휴일 정보를 불러오지 못했습니다.");
          }
        });
        renderWorkspacePage();
      };

      managementClickHandler = managementClickHandlerModule.create({
        ...dependencies,
        loadHolidayYear,
      });
      workspaceClickHandler = workspaceClickHandlerModule.create(dependencies);
    }

    async function handleDocumentClick(event) {
      if (await companiesClickHandler.handleDocumentClick(event)) {
        return;
      }

      if (await managementClickHandler.handleDocumentClick(event)) {
        return;
      }

      if (await workspaceClickHandler.handleDocumentClick(event)) {
        return;
      }
    }

    return Object.freeze({
      handleDocumentClick,
      loadHolidayYear,
    });
  }

  return Object.freeze({ create });
});
