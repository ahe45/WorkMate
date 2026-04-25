const DEFAULT_TIME_ZONE = "Asia/Seoul";

function getDateKeyInTimeZone(referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(referenceDate);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

function getCurrentDateKey(timeZone = DEFAULT_TIME_ZONE) {
  return getDateKeyInTimeZone(new Date(), timeZone);
}

module.exports = {
  DEFAULT_TIME_ZONE,
  getCurrentDateKey,
  getDateKeyInTimeZone,
};
