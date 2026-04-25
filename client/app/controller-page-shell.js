(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerPageShell = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      currentPage,
      pageMethods,
      renderers,
      runtimeContext,
      sharedControllers,
    } = dependencies;

    if (!appConfig || !pageMethods || !renderers || !runtimeContext || !sharedControllers) {
      throw new Error("WorkMateControllerPageShell requires page shell dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-page-shell.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const {
      createDefaultDashboardGridState,
      elements,
      setInlineMessage,
      state,
    } = runtimeContext;

    const appShellControllerModule = resolve(
      runtime,
      "WorkMateAppShellController",
      "../controllers/app-shell-controller.js",
      "client/controllers/app-shell-controller.js must be loaded before client/app/page-bootstrap.js.",
    );

    return appShellControllerModule.create({
      appConfig,
      closeAllDashboardGridPageSizeMenus: sharedControllers.closeAllDashboardGridPageSizeMenus,
      closeScheduleUserFilter: sharedControllers.closeScheduleUserFilter,
      createDefaultDashboardGridState,
      currentPage,
      elements,
      PERSONAL_SCOPE_STORAGE_KEY: "workmate.personalScopeEnabled",
      renderCompaniesPage: (...args) => pageMethods.renderCompaniesPage(...args),
      renderers,
      renderWorkspacePage: (...args) => pageMethods.renderWorkspacePage(...args),
      resetScheduleUserFilter: sharedControllers.resetScheduleUserFilter,
      SELECTED_ORGANIZATION_STORAGE_KEY: "workmate.selectedOrganizationId",
      setInlineMessage,
      state,
    });
  }

  return Object.freeze({ create });
});
