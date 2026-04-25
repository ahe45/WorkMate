(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const { api, appConfig, state } = dependencies;

    if (!api || !appConfig || !state) {
      throw new Error("WorkMateManagementController requires api, appConfig, and state.");
    }

    const resolverModule = globalThis.WorkMateAppModuleResolver
      || (typeof require === "function" ? require("../app/module-resolver.js") : null);

    if (!resolverModule || typeof resolverModule.resolve !== "function") {
      throw new Error("client/app/module-resolver.js must be loaded before client/controllers/management-controller.js.");
    }

    const { resolve } = resolverModule;
    const runtime = typeof globalThis !== "undefined" ? globalThis : globalScope;
    const managementSectionContextModule = resolve(
      runtime,
      "WorkMateManagementSectionContext",
      "./management-section-context.js",
      "client/controllers/management-section-context.js must be loaded before client/controllers/management-controller.js.",
    );
    const managementControllerCompositionModule = resolve(
      runtime,
      "WorkMateManagementControllerComposition",
      "./management-controller-composition.js",
      "client/controllers/management-controller-composition.js must be loaded before client/controllers/management-controller.js.",
    );
    const managementSectionContext = managementSectionContextModule.create(dependencies);
    const managementControllerComposition = managementControllerCompositionModule.create({
      ...dependencies,
      normalizeManagementSection: managementSectionContext.normalizeManagementSection,
    });

    return Object.freeze({
      ...managementSectionContext,
      ...managementControllerComposition,
    });
  }

  return Object.freeze({ create });
});
