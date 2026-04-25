function normalizeAuthOptions(authOptions) {
  if (authOptions === false) {
    return null;
  }

  if (authOptions === true || typeof authOptions === "undefined") {
    return {};
  }

  return authOptions && typeof authOptions === "object" ? authOptions : {};
}

function createRouteDefinition({ method, path = "", pattern = null, getParams = null, auth, handler }) {
  if (typeof handler !== "function") {
    throw new TypeError("Route handler must be a function.");
  }

  return Object.freeze({
    method: String(method || "").toUpperCase(),
    path: String(path || ""),
    pattern,
    getParams: typeof getParams === "function" ? getParams : null,
    auth: normalizeAuthOptions(auth),
    handler,
  });
}

function exactRoute(method, path, handler, options = {}) {
  return createRouteDefinition({
    method,
    path,
    auth: options.auth,
    handler,
  });
}

function regexRoute(method, pattern, handler, options = {}) {
  if (!(pattern instanceof RegExp)) {
    throw new TypeError("Route pattern must be a RegExp.");
  }

  return createRouteDefinition({
    method,
    pattern: new RegExp(pattern.source, pattern.flags.replace(/g/g, "")),
    getParams: options.getParams,
    auth: options.auth,
    handler,
  });
}

function matchRoute(route, method, pathname) {
  if (route.method !== method) {
    return null;
  }

  if (route.path) {
    return route.path === pathname ? { params: {} } : null;
  }

  if (!route.pattern) {
    return null;
  }

  const match = route.pattern.exec(pathname);

  if (!match) {
    return null;
  }

  const params = route.getParams ? route.getParams(match, pathname) : match.groups || {};
  return { params: params && typeof params === "object" ? params : {} };
}

async function dispatchRoute(routes, context, options = {}) {
  const method = String(context?.request?.method || "").toUpperCase();
  const pathname = String(context?.requestUrl?.pathname || "");
  const searchParams = context?.requestUrl?.searchParams;
  const authenticate = typeof options.authenticate === "function" ? options.authenticate : null;

  for (const route of Array.isArray(routes) ? routes : []) {
    const matchedRoute = matchRoute(route, method, pathname);

    if (!matchedRoute) {
      continue;
    }

    const authContext = route.auth && authenticate ? await authenticate(context.request, route.auth) : null;

    await route.handler({
      ...context,
      pathname,
      searchParams,
      params: matchedRoute.params,
      authContext,
      authenticatedAccount: authContext?.account || null,
    });

    return true;
  }

  return false;
}

module.exports = {
  dispatchRoute,
  exactRoute,
  regexRoute,
};
