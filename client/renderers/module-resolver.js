(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateRendererModuleResolver = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function resolve(globalScope, globalKey, requirePath, errorMessage) {
    const resolvedModule = globalScope[globalKey]
      || (typeof require === "function" ? require(requirePath) : null);

    if (!resolvedModule || typeof resolvedModule.create !== "function") {
      throw new Error(errorMessage);
    }

    return resolvedModule;
  }

  return Object.freeze({ resolve });
});
