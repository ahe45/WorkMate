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
      handleManagementJobTitleDragEnd = () => {},
      handleManagementJobTitleDragOver = () => {},
      handleManagementJobTitleDragStart = () => {},
      handleManagementJobTitleDrop = async () => {},
      handleManagementWorksiteDragEnd = () => {},
      handleManagementWorksiteDragOver = () => {},
      handleManagementWorksiteDragStart = () => {},
      handleManagementWorksiteDrop = async () => {},
      handleProtectedFailure,
      initWorkspacePage,
      logout,
      navigateTo,
      persistSelectedOrganizationId,
      refreshWorkspaceData,
      renderWorkspacePage,
      runWithManagementModalGuard,
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
    const gridTooltipState = {
      element: null,
      timer: null,
      tooltip: null,
    };

    function clearGridCellTooltip() {
      if (gridTooltipState.timer) {
        window.clearTimeout(gridTooltipState.timer);
        gridTooltipState.timer = null;
      }

      if (gridTooltipState.tooltip instanceof HTMLElement) {
        gridTooltipState.tooltip.remove();
      }

      gridTooltipState.element = null;
      gridTooltipState.tooltip = null;
    }

    function getGridTooltipCandidate(target = null) {
      if (!(target instanceof Element)) {
        return null;
      }

      return target.closest([
        ".result-grid-card tbody td > strong",
        ".result-grid-card tbody td > span",
        ".result-grid-card tbody td > small",
        ".result-grid-card tbody td .badge",
        ".result-grid-card tbody td",
        ".workmate-worksite-grid-cell strong",
        ".workmate-worksite-grid-cell span",
        ".workmate-worksite-grid-cell",
        ".workmate-title-record-grid-cell strong",
        ".workmate-title-record-grid-cell span",
        ".workmate-title-record-grid-cell small",
        ".workmate-title-record-grid-cell .workmate-title-unit-badge",
        ".workmate-title-record-grid-cell",
        ".workmate-work-policy-record-grid-cell strong",
        ".workmate-work-policy-record-grid-cell span",
        ".workmate-work-policy-record-grid-cell",
        ".workmate-work-schedule-grid-cell strong",
        ".workmate-work-schedule-grid-cell span",
        ".workmate-work-schedule-grid-cell",
        ".workmate-holiday-grid-cell strong",
        ".workmate-holiday-grid-cell span",
        ".workmate-holiday-grid-cell",
        ".workmate-leave-policy-record-grid-cell strong",
        ".workmate-leave-policy-record-grid-cell span",
        ".workmate-leave-policy-record-grid-cell",
        ".workmate-leave-rule-record-grid-cell strong",
        ".workmate-leave-rule-record-grid-cell span",
        ".workmate-leave-rule-record-grid-cell",
        ".workmate-leave-policy-entry-row > span",
        ".workmate-leave-policy-entry-row > strong",
        ".workmate-table-row > span",
        ".workmate-table-row > strong",
      ].join(", "));
    }

    function isGridTooltipCandidateOverflowing(element = null) {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
    }

    function getGridTooltipText(element = null) {
      if (!(element instanceof HTMLElement)) {
        return "";
      }

      return String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    }

    function positionGridCellTooltip(tooltip, anchor) {
      if (!(tooltip instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const spacing = 10;
      const maxLeft = Math.max(12, window.innerWidth - tooltip.offsetWidth - 12);
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - tooltip.offsetWidth / 2), maxLeft);
      let top = rect.bottom + spacing;

      if (top + tooltip.offsetHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - tooltip.offsetHeight - spacing);
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function showGridCellTooltip(anchor, text) {
      clearGridCellTooltip();

      if (!(anchor instanceof HTMLElement) || !text) {
        return;
      }

      const tooltip = document.createElement("div");
      tooltip.className = "table-cell-tooltip";
      tooltip.textContent = text;
      document.body.appendChild(tooltip);
      gridTooltipState.element = anchor;
      gridTooltipState.tooltip = tooltip;
      positionGridCellTooltip(tooltip, anchor);
    }

    function handleGridTooltipMouseOver(event) {
      const candidate = getGridTooltipCandidate(event.target);

      if (!(candidate instanceof HTMLElement) || candidate === gridTooltipState.element) {
        return;
      }

      clearGridCellTooltip();

      if (!isGridTooltipCandidateOverflowing(candidate)) {
        return;
      }

      const text = getGridTooltipText(candidate);

      if (!text || text === "-") {
        return;
      }

      gridTooltipState.element = candidate;
      gridTooltipState.timer = window.setTimeout(() => {
        if (gridTooltipState.element === candidate && document.body.contains(candidate)) {
          showGridCellTooltip(candidate, text);
        }
      }, 1000);
    }

    function handleGridTooltipMouseOut(event) {
      const candidate = getGridTooltipCandidate(event.target);

      if (!(candidate instanceof HTMLElement)) {
        return;
      }

      const relatedTarget = event.relatedTarget;

      if (relatedTarget instanceof Node && candidate.contains(relatedTarget)) {
        return;
      }

      if (candidate === gridTooltipState.element) {
        clearGridCellTooltip();
      }
    }

    function bindInteractionHandlers() {
      document.addEventListener("click", (event) => {
        clickHandler.handleDocumentClick(event).catch((error) => {
          window.alert(error.message || "작업 처리 중 오류가 발생했습니다.");
        });
      });

      inputHandler.bindInputHandlers();

      document.addEventListener("mouseover", handleGridTooltipMouseOver);
      document.addEventListener("mouseout", handleGridTooltipMouseOut);
      window.addEventListener("scroll", clearGridCellTooltip, true);
      window.addEventListener("resize", clearGridCellTooltip);

      document.addEventListener("dragstart", (event) => {
        handleManagementJobTitleDragStart(event);
        handleManagementWorksiteDragStart(event);
      });
      document.addEventListener("dragover", (event) => {
        handleManagementJobTitleDragOver(event);
        handleManagementWorksiteDragOver(event);
      });
      document.addEventListener("drop", (event) => {
        Promise.resolve()
          .then(() => handleManagementJobTitleDrop(event))
          .then(() => handleManagementWorksiteDrop(event))
          .catch((error) => {
            window.alert(error.message || "작업 처리 중 오류가 발생했습니다.");
          });
      });
      document.addEventListener("dragend", (event) => {
        handleManagementJobTitleDragEnd(event);
        handleManagementWorksiteDragEnd(event);
      });

      elements.clockValidateButton?.addEventListener("click", () => {
        submitClock(true).catch((error) => {
          window.alert(error.message || "검증 실행에 실패했습니다.");
        });
      });

      elements.logoutButton?.addEventListener("click", () => {
        runWithManagementModalGuard(async () => {
          logout().catch(() => {
            api.clearAuthTokens();
            persistSelectedOrganizationId("");
            navigateTo(appConfig.loginRoutePath, true);
          });
        }).catch(() => {});
      });

      elements.brandHome?.addEventListener("click", () => {
        if (currentPage === "workspace") {
          const route = appConfig.getWorkspaceRoute(window.location.pathname);
          runWithManagementModalGuard(async () => {
            navigateTo(appConfig.buildWorkspacePath(route?.companyCode || "", appConfig.defaultWorkspaceView));
          }).catch(() => {});
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
      elements.switchCompanyButton?.addEventListener("click", () => {
        runWithManagementModalGuard(async () => {
          navigateTo(appConfig.companiesRoutePath);
        }).catch(() => {});
      });
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
