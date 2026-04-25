(function (globalScope, factory) {
  const htmlUtils = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = htmlUtils;
    return;
  }

  globalScope.WorkMateHtmlUtils = htmlUtils;
  globalScope.escapeHtml = htmlUtils.escapeHtml;
  globalScope.escapeAttribute = htmlUtils.escapeAttribute;
  globalScope.escapeRegExp = htmlUtils.escapeRegExp;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return Object.freeze({
    escapeAttribute,
    escapeHtml,
    escapeRegExp,
  });
});
