(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateApiClient = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ACCESS_TOKEN_STORAGE_KEY = "workmate.accessToken";
  const REFRESH_TOKEN_STORAGE_KEY = "workmate.refreshToken";
  const AUTH_STORAGE_MODE_KEY = "workmate.authStorageMode";

  function getStoredAuthMode() {
    return window.sessionStorage.getItem(AUTH_STORAGE_MODE_KEY) || window.localStorage.getItem(AUTH_STORAGE_MODE_KEY) || "";
  }

  function migrateLegacyPersistentTokens() {
    if (getStoredAuthMode()) {
      return;
    }

    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

    if (!accessToken && !refreshToken) {
      return;
    }

    if (accessToken) {
      window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    }

    if (refreshToken) {
      window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }

    window.sessionStorage.setItem(AUTH_STORAGE_MODE_KEY, "session");
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  function readStoredToken(key) {
    migrateLegacyPersistentTokens();
    return window.sessionStorage.getItem(key) || window.localStorage.getItem(key) || "";
  }

  function hasSessionTokens() {
    migrateLegacyPersistentTokens();
    return Boolean(
      window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
      window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
    );
  }

  function usesPersistentAuthStorage() {
    migrateLegacyPersistentTokens();
    return !hasSessionTokens() && Boolean(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
    );
  }

  function getApiBaseUrl() {
    const explicitBaseUrl = window.localStorage.getItem("workmate.apiBaseUrl");

    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/$/, "");
    }

    const currentOrigin = window.location.origin;
    return /^https?:\/\//i.test(currentOrigin) ? currentOrigin : "http://localhost:3001";
  }

  function buildApiUrl(resource) {
    if (/^https?:\/\//i.test(resource)) {
      return resource;
    }

    return new URL(resource, `${getApiBaseUrl()}/`).toString();
  }

  function getAccessToken() {
    return readStoredToken(ACCESS_TOKEN_STORAGE_KEY);
  }

  function getRefreshToken() {
    return readStoredToken(REFRESH_TOKEN_STORAGE_KEY);
  }

  function setAuthTokens(tokens = {}, options = {}) {
    const persist = options.persist === true;
    const storage = options.persist ? window.localStorage : window.sessionStorage;

    clearAuthTokens();
    storage.setItem(AUTH_STORAGE_MODE_KEY, persist ? "persistent" : "session");

    if (tokens.accessToken) {
      storage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
    }

    if (tokens.refreshToken) {
      storage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
    }
  }

  function clearAuthTokens() {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_STORAGE_MODE_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_MODE_KEY);
  }

  function shouldApplyJsonContentType(body, headers = {}) {
    if (!body) {
      return false;
    }

    const hasContentTypeHeader = Object.keys(headers || {}).some((headerName) => String(headerName).toLowerCase() === "content-type");
    return !hasContentTypeHeader && typeof body === "string";
  }

  async function requestWithAutoRefresh(resource, options = {}) {
    try {
      return await apiRequest(resource, options);
    } catch (error) {
      if (error.status !== 401 || !getRefreshToken() || options.skipRefreshRetry) {
        throw error;
      }

      const refreshed = await apiRequest("/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
        skipAuth: true,
        skipRefreshRetry: true,
      });

      setAuthTokens(refreshed, { persist: usesPersistentAuthStorage() });

      return apiRequest(resource, {
        ...options,
        skipRefreshRetry: true,
      });
    }
  }

  async function apiRequest(resource, options = {}) {
    const token = getAccessToken();
    const headers = {
      ...(shouldApplyJsonContentType(options.body, options.headers) ? { "Content-Type": "application/json" } : {}),
      ...(!options.skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(buildApiUrl(resource), {
      method: options.method || "GET",
      headers,
      body: options.body,
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || payload || "요청 처리 중 오류가 발생했습니다.");
      error.status = response.status;
      error.code = payload?.code || "";
      throw error;
    }

    return payload;
  }

  return {
    apiRequest,
    buildApiUrl,
    clearAuthTokens,
    getAccessToken,
    getRefreshToken,
    requestWithAutoRefresh,
    setAuthTokens,
  };
});
