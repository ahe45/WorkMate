(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionKeyHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const { state } = dependencies;

    if (!state) {
      throw new Error("WorkMateAppInteractionKeyHandler requires key handler dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/app-interaction-key-handler.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    let companiesKeyHandler = { handleDocumentKeydown: () => false };
    let workspaceKeyHandler = { handleDocumentKeydown: () => false };

    if (dependencies.currentPage === "companies") {
      const companiesKeyHandlerModule = resolve(
        runtime,
        "WorkMateAppInteractionCompaniesKeyHandler",
        "./app-interaction-key-companies.js",
        "client/controllers/app-interaction-key-companies.js must be loaded before client/controllers/app-interaction-key-handler.js.",
      );
      companiesKeyHandler = companiesKeyHandlerModule.create(dependencies);
    }

    if (dependencies.currentPage === "workspace") {
      const workspaceKeyHandlerModule = resolve(
        runtime,
        "WorkMateAppInteractionWorkspaceKeyHandler",
        "./app-interaction-key-workspace.js",
        "client/controllers/app-interaction-key-workspace.js must be loaded before client/controllers/app-interaction-key-handler.js.",
      );
      workspaceKeyHandler = workspaceKeyHandlerModule.create(dependencies);
    }

    function handleDocumentKeydown(event) {
      if (companiesKeyHandler.handleDocumentKeydown(event)) {
        return;
      }

      workspaceKeyHandler.handleDocumentKeydown(event);
    }

    return Object.freeze({
      handleDocumentKeydown,
    });
  }

  return Object.freeze({ create });
});
