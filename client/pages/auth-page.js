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

  function getJoinInviteToken() {
    const searchParams = new URLSearchParams(window.location.search || "");
    return String(searchParams.get("joinInvite") || searchParams.get("token") || "").trim();
  }

  function buildInviteRoute(path, inviteToken = "") {
    const normalizedInviteToken = String(inviteToken || "").trim();

    return normalizedInviteToken
      ? `${path}?joinInvite=${encodeURIComponent(normalizedInviteToken)}`
      : path;
  }

  function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function setInputValue(id, value = "") {
    const input = document.getElementById(id);

    if (input) {
      input.value = String(value || "");
    }
  }

  function setInputReadOnly(id, readOnly = false) {
    const input = document.getElementById(id);

    if (input) {
      input.readOnly = Boolean(readOnly);
      input.setAttribute("aria-readonly", readOnly ? "true" : "false");
    }
  }

  function setButtonDisabled(id, disabled = false) {
    const button = document.getElementById(id);

    if (button) {
      button.disabled = Boolean(disabled);
    }
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

  async function resolveStoredSession(api, appConfig, inviteToken = "") {
    if (String(inviteToken || "").trim()) {
      api.clearAuthTokens();
      persistSelectedOrganizationId("");
      return;
    }

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

  async function submitLogin(api, appConfig, event, inviteToken = "") {
    event.preventDefault();
    const loginError = document.getElementById("login-error");
    setInlineMessage(loginError, "");

    try {
      const result = await api.apiRequest("/v1/auth/login", {
        body: JSON.stringify({
          inviteToken: String(inviteToken || "").trim(),
          loginEmail: document.getElementById("login-email")?.value || "",
          password: document.getElementById("login-password")?.value || "",
        }),
        method: "POST",
        skipAuth: true,
      });

      api.setAuthTokens(result, {
        persist: Boolean(document.getElementById("login-remember")?.checked),
      });
      navigateTo(String(result?.redirectPath || "").trim() || appConfig.companiesRoutePath, true);
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

  async function prepareInviteLoginPage(api, inviteToken = "") {
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedInviteToken) {
      return;
    }

    const loginError = document.getElementById("login-error");

    try {
      const invitation = await resolveJoinInvitation(api, normalizedInviteToken);
      setInputValue("login-email", invitation.loginEmail || "");
      setInputReadOnly("login-email", true);
    } catch (error) {
      setInlineMessage(loginError, error.message || "합류 요청 정보를 확인하지 못했습니다.");
    }
  }

  async function resolveJoinInvitation(api, inviteToken = "") {
    const normalizedInviteToken = String(inviteToken || "").trim();

    if (!normalizedInviteToken) {
      throw new Error("합류 요청 링크가 올바르지 않습니다.");
    }

    return api.apiRequest(`/v1/join-invitations/resolve?inviteToken=${encodeURIComponent(normalizedInviteToken)}`, {
      skipAuth: true,
    });
  }

  async function resolveCurrentUser(api) {
    if (!hasStoredTokens(api)) {
      return null;
    }

    try {
      const result = await api.requestWithAutoRefresh("/v1/me");
      return result?.user || null;
    } catch (error) {
      api.clearAuthTokens();
      persistSelectedOrganizationId("");
      return null;
    }
  }

  async function submitJoinInviteSignup(api, event, inviteToken = "") {
    event.preventDefault();
    const signupError = document.getElementById("join-signup-error");
    setInlineMessage(signupError, "");

    const password = document.getElementById("join-signup-password")?.value || "";
    const confirmPassword = document.getElementById("join-signup-confirm-password")?.value || "";

    if (password !== confirmPassword) {
      setInlineMessage(signupError, "비밀번호와 비밀번호 재확인이 일치하지 않습니다.");
      return;
    }

    try {
      const result = await api.apiRequest("/v1/join-invitations/register", {
        body: JSON.stringify({
          inviteToken,
          password,
        }),
        method: "POST",
        skipAuth: true,
      });

      api.setAuthTokens(result, { persist: false });
      navigateTo(String(result?.redirectPath || "").trim() || buildInviteRoute("/join-invite", inviteToken), true);
    } catch (error) {
      setInlineMessage(signupError, error.message || "초대 가입에 실패했습니다.");
    }
  }

  async function submitJoinInviteAccept(api, appConfig, inviteToken = "") {
    const inviteError = document.getElementById("join-invite-error");
    const persist = api.usesPersistentAuthStorage();
    setInlineMessage(inviteError, "");
    setButtonDisabled("join-invite-accept", true);
    setButtonDisabled("join-invite-reject", true);

    try {
      const result = await api.requestWithAutoRefresh("/v1/join-invitations/accept", {
        body: JSON.stringify({
          inviteToken,
        }),
        method: "POST",
      });

      api.setAuthTokens(result, { persist });
      navigateTo(String(result?.redirectPath || "").trim() || appConfig.companiesRoutePath, true);
    } catch (error) {
      setButtonDisabled("join-invite-accept", false);
      setButtonDisabled("join-invite-reject", false);
      setInlineMessage(inviteError, error.message || "합류 승인에 실패했습니다.");
    }
  }

  async function submitJoinInviteReject(api, appConfig, inviteToken = "") {
    const inviteError = document.getElementById("join-invite-error");
    setInlineMessage(inviteError, "");
    setButtonDisabled("join-invite-accept", true);
    setButtonDisabled("join-invite-reject", true);

    try {
      const result = await api.requestWithAutoRefresh("/v1/join-invitations/reject", {
        body: JSON.stringify({
          inviteToken,
        }),
        method: "POST",
      });

      persistSelectedOrganizationId("");
      navigateTo(String(result?.redirectPath || "").trim() || appConfig.companiesRoutePath, true);
    } catch (error) {
      setButtonDisabled("join-invite-accept", false);
      setButtonDisabled("join-invite-reject", false);
      setInlineMessage(inviteError, error.message || "합류 거절에 실패했습니다.");
    }
  }

  async function initJoinInvitePage(api, appConfig, inviteToken = "") {
    const inviteError = document.getElementById("join-invite-error");
    const loginLink = document.getElementById("join-invite-login-link");

    setButtonDisabled("join-invite-accept", true);
    setButtonDisabled("join-invite-reject", true);

    if (loginLink) {
      loginLink.href = buildInviteRoute("/login", inviteToken);
    }

    let invitation = null;

    try {
      invitation = await resolveJoinInvitation(api, inviteToken);
    } catch (error) {
      setInlineMessage(inviteError, error.message || "합류 요청 정보를 확인하지 못했습니다.");
      return;
    }

    setInputValue("join-invite-organization", invitation.organizationName || invitation.organizationCode || "");
    setInputValue("join-invite-email", invitation.loginEmail || "");
    setInputValue("join-invite-name", invitation.recipientName || "");

    const currentUser = await resolveCurrentUser(api);

    if (!currentUser) {
      navigateTo(buildInviteRoute(invitation.accountExists ? "/login" : "/join-invite/signup", inviteToken), true);
      return;
    }

    if (normalizeEmail(currentUser.loginEmail) !== normalizeEmail(invitation.loginEmail)) {
      setInlineMessage(inviteError, "초대받은 이메일 계정으로 로그인해야 합니다. 다른 계정으로 다시 로그인하세요.");
      return;
    }

    setButtonDisabled("join-invite-accept", false);
    setButtonDisabled("join-invite-reject", false);
    document.getElementById("join-invite-accept")?.addEventListener("click", () => {
      submitJoinInviteAccept(api, appConfig, inviteToken).catch((error) => {
        console.error(error);
        setButtonDisabled("join-invite-accept", false);
        setButtonDisabled("join-invite-reject", false);
        setInlineMessage(inviteError, "합류 승인에 실패했습니다.");
      });
    });
    document.getElementById("join-invite-reject")?.addEventListener("click", () => {
      submitJoinInviteReject(api, appConfig, inviteToken).catch((error) => {
        console.error(error);
        setButtonDisabled("join-invite-accept", false);
        setButtonDisabled("join-invite-reject", false);
        setInlineMessage(inviteError, "합류 거절에 실패했습니다.");
      });
    });
  }

  async function initJoinInviteSignupPage(api, inviteToken = "") {
    const signupError = document.getElementById("join-signup-error");
    const loginLink = document.getElementById("join-signup-login-link");

    if (loginLink) {
      loginLink.href = buildInviteRoute("/login", inviteToken);
    }

    api.clearAuthTokens();
    persistSelectedOrganizationId("");

    let invitation = null;

    try {
      invitation = await resolveJoinInvitation(api, inviteToken);
    } catch (error) {
      setInlineMessage(signupError, error.message || "합류 요청 정보를 확인하지 못했습니다.");
      return;
    }

    if (invitation.accountExists) {
      navigateTo(buildInviteRoute("/login", inviteToken), true);
      return;
    }

    setInputValue("join-signup-email", invitation.loginEmail || "");
    setInputValue("join-signup-name", invitation.recipientName || "");

    document.getElementById("join-invite-signup-form")?.addEventListener("submit", (event) => {
      submitJoinInviteSignup(api, event, inviteToken).catch((error) => {
        console.error(error);
        setInlineMessage(signupError, "초대 가입에 실패했습니다.");
      });
    });
  }

  async function init() {
    const currentPage = document.body?.dataset.page || "";

    if (!["join-invite", "join-invite-signup", "login", "signup"].includes(currentPage)) {
      return;
    }

    const { api, appConfig } = createDependencies();
    const inviteToken = getJoinInviteToken();

    if (currentPage === "join-invite") {
      await initJoinInvitePage(api, appConfig, inviteToken);
      return;
    }

    if (currentPage === "join-invite-signup") {
      await initJoinInviteSignupPage(api, inviteToken);
      return;
    }

    await resolveStoredSession(api, appConfig, inviteToken);
    await prepareInviteLoginPage(api, currentPage === "login" ? inviteToken : "");

    const loginForm = document.getElementById("login-form");
    const accountForm = document.getElementById("account-form");

    if (loginForm) {
      loginForm.addEventListener("submit", (event) => {
        submitLogin(api, appConfig, event, inviteToken).catch((error) => {
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
