(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionInputHandler = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      currentPage,
      loadHolidayYear,
      state,
    } = dependencies;

    if (!state) {
      throw new Error("WorkMateAppInteractionInputHandler requires input handler dependencies.");
    }

    if (currentPage !== "workspace") {
      return Object.freeze({
        bindInputHandlers: () => {},
      });
    }

    if (typeof loadHolidayYear !== "function") {
      throw new Error("WorkMateAppInteractionInputHandler requires input handler dependencies.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/app-interaction-input-handler.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const managementInputHandlerModule = resolve(
      runtime,
      "WorkMateAppInteractionManagementInputHandler",
      "./app-interaction-input-management.js",
      "client/controllers/app-interaction-input-management.js must be loaded before client/controllers/app-interaction-input-handler.js.",
    );
    const workspaceInputHandlerModule = resolve(
      runtime,
      "WorkMateAppInteractionWorkspaceInputHandler",
      "./app-interaction-input-workspace.js",
      "client/controllers/app-interaction-input-workspace.js must be loaded before client/controllers/app-interaction-input-handler.js.",
    );
    const managementInputHandler = managementInputHandlerModule.create(dependencies);
    const workspaceInputHandler = workspaceInputHandlerModule.create(dependencies);

    function bindInputHandlers() {
      document.addEventListener("input", (event) => {
        if (managementInputHandler.handleDocumentInput(event)) {
          return;
        }

        workspaceInputHandler.handleDocumentInput(event);
      });

      document.addEventListener("change", (event) => {
        if (managementInputHandler.handleDocumentChange(event)) {
          return;
        }

        workspaceInputHandler.handleDocumentChange(event);
      });

      document.addEventListener("focusout", (event) => {
        managementInputHandler.handleDocumentFocusOut?.(event);
      });

      document.addEventListener("dragover", (event) => {
        managementInputHandler.handleDocumentDragOver?.(event);
      });

      document.addEventListener("dragleave", (event) => {
        managementInputHandler.handleDocumentDragLeave?.(event);
      });

      document.addEventListener("drop", (event) => {
        managementInputHandler.handleDocumentDrop?.(event);
      });
    }

    return Object.freeze({
      bindInputHandlers,
    });
  }

  return Object.freeze({ create });
});
