(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateWorkPolicyValueNormalizer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function parseManagementPolicyJson(value, fallback = {}) {
    if (!value) {
      return { ...fallback };
    }

    if (typeof value === "object") {
      return value;
    }

    try {
      return JSON.parse(String(value));
    } catch (error) {
      return { ...fallback };
    }
  }

  function normalizeManagementPolicyBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    if (typeof value === "string") {
      return ["1", "true", "y", "yes", "on"].includes(value.trim().toLowerCase());
    }

    return Boolean(value);
  }

  function normalizeManagementPolicyNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const numericValue = Math.round(Number(value));

    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, numericValue));
  }

  function normalizeManagementPolicyMinutes(value, fallback = 0, min = 0, max = 1440) {
    return normalizeManagementPolicyNumber(value, fallback, min, max);
  }

  function hasMeaningfulManagementPolicyValue(value) {
    return value !== undefined
      && value !== null
      && (typeof value !== "string" || value.trim() !== "");
  }

  function formatManagementPolicyClockTime(totalMinutes = 0) {
    const normalizedMinutes = Math.max(0, Math.min(1439, Math.round(Number(totalMinutes) || 0)));
    const hours = Math.floor(normalizedMinutes / 60);
    const minutes = normalizedMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeManagementPolicyClockTime(value = "", fallback = "") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return formatManagementPolicyClockTime(value);
    }

    const matched = String(value || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);

    if (!matched) {
      return fallback;
    }

    const hours = Number(matched[1]);
    const minutes = Number(matched[2]);

    if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
      return fallback;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeManagementPolicyStringEnum(value = "", allowedValues = [], fallback = "") {
    const normalizedValue = String(value || "").trim().toUpperCase();

    return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
  }

  function normalizeManagementPolicyStringList(value) {
    const source = Array.isArray(value)
      ? value
      : String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);

    return Array.from(new Set(source.map((entry) => String(entry || "").trim()).filter(Boolean)));
  }

  function normalizeManagementPolicyDayOfMonth(value, fallback = 1) {
    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 31 ? numericValue : fallback;
  }

  return Object.freeze({
    hasMeaningfulManagementPolicyValue,
    normalizeManagementPolicyBoolean,
    normalizeManagementPolicyClockTime,
    normalizeManagementPolicyDayOfMonth,
    normalizeManagementPolicyMinutes,
    normalizeManagementPolicyNumber,
    normalizeManagementPolicyStringEnum,
    normalizeManagementPolicyStringList,
    parseManagementPolicyJson,
  });
});
