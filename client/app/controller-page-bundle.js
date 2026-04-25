(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerPageBundle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      currentYear,
      navigationModule,
      renderers,
      runtimeContext,
      sharedControllers,
    } = dependencies;

    if (
      !api
      || !appConfig
      || !navigationModule
      || !renderers
      || !runtimeContext
      || !sharedControllers
    ) {
      throw new Error("WorkMateControllerPageBundle requires controller dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("./module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/app/controller-page-bundle.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const pageShellModule = resolve(
      runtime,
      "WorkMateControllerPageShell",
      "./controller-page-shell.js",
      "client/app/controller-page-shell.js must be loaded before client/app/controller-page-bundle.js.",
    );
    const pageLifecycleModule = resolve(
      runtime,
      "WorkMateControllerPageLifecycle",
      "./controller-page-lifecycle.js",
      "client/app/controller-page-lifecycle.js must be loaded before client/app/controller-page-bundle.js.",
    );
    const pageBindingsModule = resolve(
      runtime,
      "WorkMateControllerPageBindings",
      "./controller-page-bindings.js",
      "client/app/controller-page-bindings.js must be loaded before client/app/controller-page-bundle.js.",
    );
    const pageMethods = {
      renderCompaniesPage: () => {},
      renderWorkspacePage: () => {},
    };
    const shellController = pageShellModule.create({
      ...dependencies,
      pageMethods,
    });
    const lifecycleController = pageLifecycleModule.create({
      ...dependencies,
      shellController,
    });
    pageMethods.renderCompaniesPage = lifecycleController.renderCompaniesPage;
    pageMethods.renderWorkspacePage = lifecycleController.renderWorkspacePage;
    sharedControllers.setPageHandlers({
      refreshWorkspaceData: lifecycleController.refreshWorkspaceData,
      renderWorkspacePage: lifecycleController.renderWorkspacePage,
    });
    const bindings = pageBindingsModule.create({
      ...dependencies,
      lifecycleController,
      shellController,
    });

    function bindHandlers() {
      bindings.bindHandlers();
    }

    function initCurrentPage() {
      if (currentPage === "login" || currentPage === "signup") {
        lifecycleController.initAuthPage().catch(() => {});
        return;
      }

      if (currentPage === "companies") {
        lifecycleController.initCompaniesPage().catch(() => {});
        return;
      }

      if (currentPage === "workspace") {
        lifecycleController.initWorkspacePage().catch(() => {});
      }
    }

    return Object.freeze({
      bindHandlers,
      initCurrentPage,
    });
  }

  return Object.freeze({ create });
});
