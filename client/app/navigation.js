(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateNavigation = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createNavigationController({ buildWorkspacePath, normalizeWorkspaceView = (view) => String(view || "").trim(), onViewChange, state }) {
    function syncNavigationVisibility(navRoot) {
      if (!navRoot) {
        return;
      }

      navRoot.querySelectorAll(".nav-item[data-view]").forEach((item) => {
        item.classList.toggle("active", item.dataset.view === state.currentWorkspaceView);
      });
    }

    function navigateToWorkspaceView(companyCode, view, { replace = false } = {}) {
      const nextView = normalizeWorkspaceView(view);
      const nextPath = buildWorkspacePath(companyCode, nextView);

      if (replace) {
        window.history.replaceState({}, "", nextPath);
      } else {
        window.history.pushState({}, "", nextPath);
      }

      state.currentWorkspaceView = nextView;
      onViewChange?.(nextView);
    }

    return Object.freeze({
      navigateToWorkspaceView,
      syncNavigationVisibility,
    });
  }

  return Object.freeze({
    createNavigationController,
  });
});
