(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateControllerRegistry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      currentYear,
      escapeAttribute,
      escapeHtml,
      navigationModule,
      renderers,
      runtimeContext,
    } = dependencies;

    if (
      !api
      || !appConfig
      || !navigationModule
      || !renderers
      || !runtimeContext
      || typeof escapeAttribute !== "function"
      || typeof escapeHtml !== "function"
    ) {
      throw new Error("WorkMateControllerRegistry requires controller dependencies.");
    }

    const sharedBundleModule = globalThis.WorkMateControllerSharedBundle
      || (typeof require === "function" ? require("./controller-shared-bundle.js") : null);
    const pageBundleModule = globalThis.WorkMateControllerPageBundle
      || (typeof require === "function" ? require("./controller-page-bundle.js") : null);

    if (!sharedBundleModule || typeof sharedBundleModule.create !== "function") {
      throw new Error("client/app/controller-shared-bundle.js must be loaded before client/app/controller-registry.js.");
    }

    if (!pageBundleModule || typeof pageBundleModule.create !== "function") {
      throw new Error("client/app/controller-page-bundle.js must be loaded before client/app/controller-registry.js.");
    }

    const sharedControllers = sharedBundleModule.create({
      api,
      appConfig,
      currentPage,
      currentYear,
      escapeAttribute,
      escapeHtml,
      renderers,
      runtimeContext,
    });

    return pageBundleModule.create({
      api,
      appConfig,
      currentPage,
      currentYear,
      navigationModule,
      renderers,
      runtimeContext,
      sharedControllers,
    });
  }

  return Object.freeze({ create });
});
