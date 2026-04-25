function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toDateOnly(dateValue) {
  const date = new Date(dateValue);
  return date.toISOString().slice(0, 10);
}

function toSqlDateTimeValue(dateValue) {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function isWorkingState(state) {
  return ["WORKING", "WFH_WORKING", "OFFSITE"].includes(state);
}

function parseSummaryJson(summaryJson) {
  if (!summaryJson) {
    return {};
  }

  if (typeof summaryJson === "object") {
    return summaryJson;
  }

  try {
    return JSON.parse(String(summaryJson || "{}"));
  } catch (error) {
    return {};
  }
}

module.exports = {
  haversineMeters,
  isWorkingState,
  parseSummaryJson,
  toDateOnly,
  toSqlDateTimeValue,
};
