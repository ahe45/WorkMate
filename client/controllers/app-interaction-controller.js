(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppInteractionController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      api,
      appConfig,
      currentPage,
      elements,
      handleManagementJobTitleDragEnd,
      handleManagementJobTitleDragOver,
      handleManagementJobTitleDragStart,
      handleManagementJobTitleDrop,
      handleProtectedFailure,
      initWorkspacePage,
      logout,
      navigateTo,
      persistSelectedOrganizationId,
      refreshWorkspaceData,
      renderWorkspacePage,
      setPersonalScopeEnabled,
      state,
      submitClock,
    } = dependencies;

    if (!appConfig || !elements || !state) {
      throw new Error("WorkMateAppInteractionController requires app interaction dependencies.");
    }

    const clickHandlerModule = globalThis.WorkMateAppInteractionClickHandler
      || (typeof require === "function" ? require("./app-interaction-click-handler.js") : null);
    const inputHandlerModule = globalThis.WorkMateAppInteractionInputHandler
      || (typeof require === "function" ? require("./app-interaction-input-handler.js") : null);
    const keyHandlerModule = globalThis.WorkMateAppInteractionKeyHandler
      || (typeof require === "function" ? require("./app-interaction-key-handler.js") : null);

    if (!clickHandlerModule || typeof clickHandlerModule.create !== "function") {
      throw new Error("client/controllers/app-interaction-click-handler.js must be loaded before client/controllers/app-interaction-controller.js.");
    }

    if (!inputHandlerModule || typeof inputHandlerModule.create !== "function") {
      throw new Error("client/controllers/app-interaction-input-handler.js must be loaded before client/controllers/app-interaction-controller.js.");
    }

    if (!keyHandlerModule || typeof keyHandlerModule.create !== "function") {
      throw new Error("client/controllers/app-interaction-key-handler.js must be loaded before client/controllers/app-interaction-controller.js.");
    }

    const clickHandler = clickHandlerModule.create(dependencies);
    const inputHandler = inputHandlerModule.create({
      ...dependencies,
      loadHolidayYear: clickHandler.loadHolidayYear,
    });
    const keyHandler = keyHandlerModule.create(dependencies);

    function bindInteractionHandlers() {
      document.addEventListener("click", (event) => {
        clickHandler.handleDocumentClick(event).catch((error) => {
          window.alert(error.message || "작업 처리 중 오류가 발생했습니다.");
        });
      });

      inputHandler.bindInputHandlers();

      document.addEventListener("dragstart", handleManagementJobTitleDragStart);
      document.addEventListener("dragover", handleManagementJobTitleDragOver);
      document.addEventListener("drop", (event) => {
        handleManagementJobTitleDrop(event).catch((error) => {
          window.alert(error.message || "작업 처리 중 오류가 발생했습니다.");
        });
      });
      document.addEventListener("dragend", handleManagementJobTitleDragEnd);

      elements.clockValidateButton?.addEventListener("click", () => {
        submitClock(true).catch((error) => {
          window.alert(error.message || "검증 실행에 실패했습니다.");
        });
      });

      elements.logoutButton?.addEventListener("click", () => {
        logout().catch(() => {
          api.clearAuthTokens();
          persistSelectedOrganizationId("");
          navigateTo(appConfig.loginRoutePath, true);
        });
      });

      elements.brandHome?.addEventListener("click", () => {
        if (currentPage === "workspace") {
          const route = appConfig.getWorkspaceRoute(window.location.pathname);
          navigateTo(appConfig.buildWorkspacePath(route?.companyCode || "", appConfig.defaultWorkspaceView));
          return;
        }

        navigateTo(appConfig.companiesRoutePath);
      });

      elements.menuToggle?.addEventListener("click", () => {
        elements.sidebar?.classList.toggle("open");
      });
      elements.personalScopeToggle?.addEventListener("change", (event) => {
        setPersonalScopeEnabled(Boolean(event.target?.checked));
      });
      elements.switchCompanyButton?.addEventListener("click", () => navigateTo(appConfig.companiesRoutePath));
      elements.refreshButton?.addEventListener("click", () => {
        refreshWorkspaceData().catch((error) => {
          if (!handleProtectedFailure(error)) {
            window.alert(error.message || "새로고침에 실패했습니다.");
          }
        });
      });

      window.addEventListener("popstate", () => {
        if (currentPage === "workspace") {
          initWorkspacePage().catch(() => {});
        }
      });

      document.addEventListener("keydown", keyHandler.handleDocumentKeydown);
    }

    return Object.freeze({
      bindInteractionHandlers,
    });
  }

  return Object.freeze({ create });
});
