(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateAuthPage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SELECTED_ORGANIZATION_STORAGE_KEY = "workmate.selectedOrganizationId";

  function navigateTo(path, replace = false) {
    if (replace) {
      window.location.replace(path);
      return;
    }

    window.location.assign(path);
  }

  function persistSelectedOrganizationId(organizationId = "") {
    if (organizationId) {
      window.localStorage.setItem(SELECTED_ORGANIZATION_STORAGE_KEY, organizationId);
      return;
    }

    window.localStorage.removeItem(SELECTED_ORGANIZATION_STORAGE_KEY);
  }

  function setInlineMessage(target, message = "") {
    if (!target) {
      return;
    }

    target.textContent = message;
    target.classList.toggle("hidden", !message);
  }

  function createDependencies() {
    const api = window.WorkMateApiClient;
    const appConfig = window.WorkMateAppConfig;

    if (!api || !appConfig) {
      throw new Error("client/pages/auth-page.js dependencies are not loaded.");
    }

    return { api, appConfig };
  }

  function hasStoredTokens(api) {
    return Boolean(api.getAccessToken() || api.getRefreshToken());
  }

  async function resolveStoredSession(api, appConfig) {
    if (!hasStoredTokens(api)) {
      return;
    }

    try {
      await api.requestWithAutoRefresh("/v1/me");
      await api.requestWithAutoRefresh("/v1/account/organizations");
      navigateTo(appConfig.companiesRoutePath, true);
    } catch (error) {
      api.clearAuthTokens();
      persistSelectedOrganizationId("");
    }
  }

  async function submitLogin(api, appConfig, event) {
    event.preventDefault();
    const loginError = document.getElementById("login-error");
    setInlineMessage(loginError, "");

    try {
      const result = await api.apiRequest("/v1/auth/login", {
        body: JSON.stringify({
          loginEmail: document.getElementById("login-email")?.value || "",
          password: document.getElementById("login-password")?.value || "",
        }),
        method: "POST",
        skipAuth: true,
      });

      api.setAuthTokens(result, {
        persist: Boolean(document.getElementById("login-remember")?.checked),
      });
      navigateTo(appConfig.companiesRoutePath, true);
    } catch (error) {
      setInlineMessage(loginError, error.message || "로그인에 실패했습니다.");
    }
  }

  async function submitSignup(api, appConfig, event) {
    event.preventDefault();
    const accountError = document.getElementById("account-error");
    setInlineMessage(accountError, "");

    const password = document.getElementById("account-password")?.value || "";
    const confirmPassword = document.getElementById("account-confirm-password")?.value || "";

    if (password !== confirmPassword) {
      setInlineMessage(accountError, "비밀번호와 비밀번호 재확인이 일치하지 않습니다.");
      return;
    }

    try {
      const result = await api.apiRequest("/v1/account/register", {
        body: JSON.stringify({
          loginEmail: document.getElementById("account-email")?.value || "",
          name: document.getElementById("account-name")?.value || "",
          password,
        }),
        method: "POST",
        skipAuth: true,
      });

      api.setAuthTokens(result, { persist: false });
      navigateTo(appConfig.companiesRoutePath, true);
    } catch (error) {
      setInlineMessage(accountError, error.message || "회원가입에 실패했습니다.");
    }
  }

  async function init() {
    const currentPage = document.body?.dataset.page || "";

    if (!["login", "signup"].includes(currentPage)) {
      return;
    }

    const { api, appConfig } = createDependencies();
    await resolveStoredSession(api, appConfig);

    const loginForm = document.getElementById("login-form");
    const accountForm = document.getElementById("account-form");

    if (loginForm) {
      loginForm.addEventListener("submit", (event) => {
        submitLogin(api, appConfig, event).catch((error) => {
          console.error(error);
          setInlineMessage(document.getElementById("login-error"), "로그인에 실패했습니다.");
        });
      });
    }

    if (accountForm) {
      accountForm.addEventListener("submit", (event) => {
        submitSignup(api, appConfig, event).catch((error) => {
          console.error(error);
          setInlineMessage(document.getElementById("account-error"), "회원가입에 실패했습니다.");
        });
      });
    }
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
          console.error(error);
        });
      }, { once: true });
    } else {
      init().catch((error) => {
        console.error(error);
      });
    }
  }

  return Object.freeze({ init });
});
