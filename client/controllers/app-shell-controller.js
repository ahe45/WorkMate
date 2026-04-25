(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAppShellController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      appConfig,
      closeAllDashboardGridPageSizeMenus,
      closeScheduleUserFilter,
      createDefaultDashboardGridState,
      currentPage,
      elements,
      PERSONAL_SCOPE_STORAGE_KEY,
      renderCompaniesPage,
      renderers,
      renderWorkspacePage,
      resetScheduleUserFilter,
      SELECTED_ORGANIZATION_STORAGE_KEY,
      setInlineMessage,
      state,
    } = dependencies;

    if (!appConfig || !elements || !renderers || !state) {
      throw new Error("WorkMateAppShellController requires app shell dependencies.");
    }

    function navigateTo(path, replace = false) {
      if (replace) {
        window.location.replace(path);
        return;
      }

      window.location.assign(path);
    }

    function persistSelectedOrganizationId(organizationId = "") {
      state.selectedOrganizationId = organizationId;

      if (organizationId) {
        window.localStorage.setItem(SELECTED_ORGANIZATION_STORAGE_KEY, organizationId);
        return;
      }

      window.localStorage.removeItem(SELECTED_ORGANIZATION_STORAGE_KEY);
    }

    function getSelectedCompany() {
      return state.companies.find((company) => String(company?.id || "") === String(state.selectedOrganizationId || "")) || null;
    }

    function findCompanyByCode(companyCode = "") {
      const normalizedCode = appConfig.normalizeCompanyCode(companyCode);
      return state.companies.find((company) => appConfig.normalizeCompanyCode(company?.code) === normalizedCode) || null;
    }

    function summarizeRoles(roles = [], organizationId = "") {
      const targetOrganizationId = String(organizationId || "").trim();

      if (!targetOrganizationId) {
        return "권한 정보 없음";
      }

      const labels = Array.from(new Set((Array.isArray(roles) ? roles : []).filter((role) => {
        const roleOrganizationId = String(role?.organizationId || "").trim();
        const scopeType = String(role?.scopeType || "").trim().toLowerCase();
        const scopeId = String(role?.scopeId || "").trim();

        if (roleOrganizationId) {
          return roleOrganizationId === targetOrganizationId;
        }

        if (scopeType === "organization" && scopeId) {
          return scopeId === targetOrganizationId;
        }

        return scopeType !== "platform";
      }).map((role) => {
        const roleCode = String(role?.roleCode || "").trim();
        const map = {
          APPROVER: "결재자",
          AUDITOR: "감사 담당",
          EMPLOYEE: "구성원",
          ORG_ADMIN: "조직 관리자",
          SITE_MANAGER: "사업장 관리자",
          SYSTEM_ADMIN: "시스템 관리자",
          UNIT_MANAGER: "부서 관리자",
        };

        return map[roleCode] || roleCode;
      }).filter(Boolean)));

      return labels.length > 0 ? labels.join(" · ") : "권한 정보 없음";
    }

    function setLoading(title) {
      if (!elements.viewRoot) {
        return;
      }

      elements.viewRoot.innerHTML = `
        <section class="view-stack">
          <article class="empty-state">
            <div>
              <strong>${title}</strong>
              <p>잠시만 기다려 주세요.</p>
            </div>
          </article>
        </section>
      `;
    }

    function updateTopbar(meta, mode, view = appConfig.defaultWorkspaceView) {
      if (elements.topbarPageKicker) {
        elements.topbarPageKicker.textContent = meta.kicker || "";
      }

      if (elements.topbarPageTitle) {
        elements.topbarPageTitle.textContent = meta.title || "";
      }

      if (elements.topbarPageDescription) {
        elements.topbarPageDescription.textContent = meta.description || "";
      }

      if (elements.topbarChipRow) {
        elements.topbarChipRow.innerHTML = renderers.renderTopbarChips(mode, state, view);
      }

      document.title = `${meta.title || "WorkMate"} | WorkMate`;
    }

    function updateUserMeta() {
      const loginEmail = String(state.user?.loginEmail || "").trim();
      const name = String(state.user?.name || "").trim();

      if (elements.currentUserName) {
        elements.currentUserName.textContent = currentPage === "companies"
          ? loginEmail || name || "로그인 필요"
          : name || loginEmail || "로그인 필요";
      }

      if (elements.currentUserDisplayName) {
        elements.currentUserDisplayName.textContent = name || "";
        elements.currentUserDisplayName.hidden = !name;
      }

      if (elements.currentUserRole) {
        if (currentPage !== "workspace") {
          elements.currentUserRole.hidden = true;
          elements.currentUserRole.textContent = "";
          return;
        }

        const activeOrganizationId = currentPage === "workspace"
          ? state.selectedOrganizationId || state.bootstrap?.organizationContext?.id || state.user?.organizationId || ""
          : "";

        elements.currentUserRole.hidden = false;
        elements.currentUserRole.textContent = summarizeRoles(state.user?.roles, activeOrganizationId);
      }
    }

    function updatePersonalScopeToggle() {
      if (!elements.personalScopeToggle) {
        return;
      }

      const enabled = Boolean(state.personalScopeEnabled);
      elements.personalScopeToggle.checked = enabled;
      elements.personalScopeToggle.setAttribute("aria-label", enabled ? "나의 일정만 보기" : "모두의 일정 보기");

      if (elements.personalScopeToggleLabel) {
        elements.personalScopeToggleLabel.textContent = enabled ? "나의 일정만 보기" : "모두의 일정 보기";
      }
    }

    function setPersonalScopeEnabled(enabled) {
      state.personalScopeEnabled = Boolean(enabled);
      window.localStorage.setItem(PERSONAL_SCOPE_STORAGE_KEY, state.personalScopeEnabled ? "true" : "false");
      state.dashboardDetailUserId = "";
      state.dashboardGridFilterMenu = null;
      state.dashboardGrids = createDefaultDashboardGridState();
      state.dashboardSummaryFilter = "";
      closeAllDashboardGridPageSizeMenus();
      closeScheduleUserFilter(false);
      resetScheduleUserFilter({ shouldRender: false });
      updatePersonalScopeToggle();

      if (currentPage === "companies") {
        renderCompaniesPage();
        return;
      }

      renderWorkspacePage();
    }

    function closeSidebar() {
      elements.sidebar?.classList.remove("open");
    }

    function toggleSidebar() {
      elements.sidebar?.classList.toggle("open");
    }

    function getCompanyCreateModal() {
      return document.getElementById("company-create-modal");
    }

    function getAccountSettingsModal() {
      return document.getElementById("account-settings-modal");
    }

    function getCompanySettingsModal() {
      return document.getElementById("company-settings-modal");
    }

    function openCompanyCreateModal() {
      const modal = getCompanyCreateModal();

      if (!modal) {
        return;
      }

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      setInlineMessage(document.getElementById("company-form-error"), "");
      window.requestAnimationFrame(() => {
        document.getElementById("company-code")?.focus();
      });
    }

    function closeCompanyCreateModal() {
      const modal = getCompanyCreateModal();

      if (!modal) {
        document.body.classList.remove("modal-open");
        return;
      }

      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      setInlineMessage(document.getElementById("company-form-error"), "");
      document.getElementById("company-form")?.reset();
    }

    function openAccountSettingsModal() {
      const modal = getAccountSettingsModal();

      if (!modal) {
        return;
      }

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      setInlineMessage(document.getElementById("account-settings-error"), "");
      window.requestAnimationFrame(() => {
        document.getElementById("account-settings-name")?.focus();
      });
    }

    function closeAccountSettingsModal() {
      const modal = getAccountSettingsModal();

      if (!modal) {
        document.body.classList.remove("modal-open");
        return;
      }

      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      setInlineMessage(document.getElementById("account-settings-error"), "");
      document.getElementById("account-settings-form")?.reset();
    }

    function openCompanySettingsModal(trigger) {
      const modal = getCompanySettingsModal();

      if (!modal) {
        return;
      }

      document.getElementById("company-settings-id").value = trigger?.dataset?.companyId || "";
      document.getElementById("company-settings-code").value = trigger?.dataset?.companyCode || "";
      document.getElementById("company-settings-name").value = trigger?.dataset?.companyName || "";
      setInlineMessage(document.getElementById("company-settings-error"), "");
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      window.requestAnimationFrame(() => {
        document.getElementById("company-settings-code")?.focus();
      });
    }

    function closeCompanySettingsModal() {
      const modal = getCompanySettingsModal();

      if (!modal) {
        document.body.classList.remove("modal-open");
        return;
      }

      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      setInlineMessage(document.getElementById("company-settings-error"), "");
      document.getElementById("company-settings-form")?.reset();
    }

    return Object.freeze({
      navigateTo,
      persistSelectedOrganizationId,
      getSelectedCompany,
      findCompanyByCode,
      setLoading,
      updateTopbar,
      updateUserMeta,
      updatePersonalScopeToggle,
      setPersonalScopeEnabled,
      closeSidebar,
      toggleSidebar,
      getCompanyCreateModal,
      getAccountSettingsModal,
      getCompanySettingsModal,
      openCompanyCreateModal,
      closeCompanyCreateModal,
      openAccountSettingsModal,
      closeAccountSettingsModal,
      openCompanySettingsModal,
      closeCompanySettingsModal,
    });
  }

  return Object.freeze({ create });
});
