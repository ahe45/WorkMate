function parseJsonColumn(value, fallback = {}) {
  if (!value) {
    return { ...fallback };
  }

  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString("utf8"), fallback);
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

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    return ["1", "true", "y", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function sanitizeNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numericValue));
}

function sanitizeMinutes(value, fallback = 0, min = 0, max = 1440) {
  return sanitizeNumber(value, fallback, min, max);
}

function hasMeaningfulValue(value) {
  return value !== undefined
    && value !== null
    && (typeof value !== "string" || value.trim() !== "");
}

function formatClockTime(totalMinutes = 0) {
  const normalizedMinutes = Math.max(0, Math.min(1439, Math.round(Number(totalMinutes) || 0)));
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeClockTime(value = "", fallback = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatClockTime(value);
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

function parseClockTimeToMinutes(value = "") {
  const matched = String(value || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);

  if (!matched) {
    return Number.NaN;
  }

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    return Number.NaN;
  }

  return (hours * 60) + minutes;
}

function normalizeStringEnum(value, allowedValues = [], fallback = "") {
  const normalizedValue = String(value || "").trim().toUpperCase();

  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

  return Array.from(new Set(source.map((entry) => String(entry || "").trim()).filter(Boolean)));
}

function normalizeDayOfWeek(value, fallback = 1) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7
    ? numericValue
    : fallback;
}

function normalizeDayOfMonth(value, fallback = 1) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 31
    ? numericValue
    : fallback;
}

module.exports = {
  hasMeaningfulValue,
  normalizeBoolean,
  normalizeClockTime,
  normalizeDayOfMonth,
  normalizeDayOfWeek,
  normalizeStringEnum,
  normalizeStringList,
  parseClockTimeToMinutes,
  parseJsonColumn,
  sanitizeMinutes,
  sanitizeNumber,
};
