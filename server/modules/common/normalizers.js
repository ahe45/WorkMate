function normalizeLoginEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function parseJsonValue(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
}

function parseJsonArrayValue(value, fallback = []) {
  const parsedValue = parseJsonValue(value, fallback);
  return Array.isArray(parsedValue) ? parsedValue : fallback;
}

function parseJsonObjectValue(value, fallback = {}) {
  const parsedValue = parseJsonValue(value, fallback);
  return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue) ? parsedValue : fallback;
}

function normalizeInviteChannels(inviteChannels = []) {
  const sourceValues = Array.isArray(inviteChannels) ? inviteChannels : [inviteChannels];

  return Array.from(new Set(sourceValues
    .map((value) => String(value || "").trim().toUpperCase())
    .map((value) => {
      if (value === "EMAIL" || value === "MAIL") {
        return "EMAIL";
      }

      if (value === "SMS" || value === "TEXT" || value === "MESSAGE" || value === "MOBILE") {
        return "SMS";
      }

      return "";
    })
    .filter(Boolean)));
}

module.exports = {
  normalizeInviteChannels,
  normalizeLoginEmail,
  parseJsonArrayValue,
  parseJsonObjectValue,
  parseJsonValue,
};
