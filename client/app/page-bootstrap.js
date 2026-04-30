(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMatePageBootstrap = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function init() {
    const api = globalThis.WorkMateApiClient;
    const appConfig = globalThis.WorkMateAppConfig;
    const controllerRegistryModule = globalThis.WorkMateControllerRegistry
      || (typeof require === "function" ? require("./controller-registry.js") : null);
    const htmlUtils = globalThis.WorkMateHtmlUtils;
    const navigationModule = globalThis.WorkMateNavigation;
    const rendererRegistryModule = globalThis.WorkMateRendererRegistry
      || (typeof require === "function" ? require("../renderers/renderer-registry.js") : null);
    const runtimeContextModule = globalThis.WorkMateAppRuntimeContext
      || (typeof require === "function" ? require("./runtime-context.js") : null);
    const stateFactoryModule = globalThis.WorkMateStateFactory
      || (typeof require === "function" ? require("./state-factory.js") : null);

    if (!api || !appConfig || !htmlUtils || !navigationModule) {
      throw new Error("client/app/page-bootstrap.js dependencies are not loaded.");
    }

    if (!rendererRegistryModule || typeof rendererRegistryModule.create !== "function") {
      throw new Error("client/renderers/renderer-registry.js must be loaded before client/app/page-bootstrap.js.");
    }

    if (!stateFactoryModule || typeof stateFactoryModule.create !== "function") {
      throw new Error("client/app/state-factory.js must be loaded before client/app/page-bootstrap.js.");
    }

    if (!runtimeContextModule || typeof runtimeContextModule.create !== "function") {
      throw new Error("client/app/runtime-context.js must be loaded before client/app/page-bootstrap.js.");
    }

    if (!controllerRegistryModule || typeof controllerRegistryModule.create !== "function") {
      throw new Error("client/app/controller-registry.js must be loaded before client/app/page-bootstrap.js.");
    }

    const { escapeAttribute, escapeHtml } = htmlUtils;
    const currentPage = document.body?.dataset.page || "";
    const currentYear = new Date().getFullYear();
    const renderers = rendererRegistryModule.create({
      appConfig,
      currentPage,
      htmlUtils,
    });
    const runtimeContext = runtimeContextModule.create({
      appConfig,
      createStateFactory: stateFactoryModule.create,
      currentYear,
      managementSectionStorageKey: "workmate.managementSection",
      personalScopeStorageKey: "workmate.personalScopeEnabled",
      selectedOrganizationStorageKey: "workmate.selectedOrganizationId",
    });
    const controllerRegistry = controllerRegistryModule.create({
      api,
      appConfig,
      currentPage,
      currentYear,
      escapeAttribute,
      escapeHtml,
      navigationModule,
      renderers,
      runtimeContext,
    });

    controllerRegistry.bindHandlers();
    controllerRegistry.initCurrentPage();
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    init();
  }

  return Object.freeze({ init });
});
