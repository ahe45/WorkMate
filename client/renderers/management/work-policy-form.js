(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyFormRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkPolicyFormRenderer(deps = {}) {
    const sectionsModule = globalThis.WorkMateWorkPolicyFormSections
      || (typeof require === "function" ? require("./work-policy-form-sections.js") : null);

    if (!sectionsModule || typeof sectionsModule.create !== "function") {
      throw new Error("client/renderers/management/work-policy-form-sections.js must be loaded before client/renderers/management/work-policy-form.js.");
    }

    return sectionsModule.create(deps);
  }

  return Object.freeze({
    create: createWorkPolicyFormRenderer,
  });
});
