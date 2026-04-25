(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateRendererFormatters = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create() {
    function toArray(value) {
      return Array.isArray(value) ? value : [];
    }

    function formatNumber(value) {
      return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
    }

    function formatDate(value, options = {}) {
      if (!value) {
        return "-";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value || "");
      }

      return new Intl.DateTimeFormat("ko-KR", {
        day: "numeric",
        month: "long",
        ...options,
      }).format(date);
    }

    function formatDateTime(value) {
      return formatDate(value, { hour: "2-digit", minute: "2-digit" });
    }

    function formatTime(value) {
      if (!value) {
        return "-";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        const matched = String(value || "").match(/(\d{2}):(\d{2})/);
        return matched ? `${matched[1]}:${matched[2]}` : String(value || "");
      }

      return new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
      }).format(date);
    }

    function formatDateRange(startValue, endValue) {
      if (!startValue && !endValue) {
        return "-";
      }

      if (!endValue || String(startValue || "") === String(endValue || "")) {
        return formatDate(startValue);
      }

      return `${formatDate(startValue)} - ${formatDate(endValue)}`;
    }

    function formatTimeRange(startValue, endValue) {
      const startText = formatTime(startValue);
      const endText = formatTime(endValue);

      if (startText === "-" && endText === "-") {
        return "-";
      }

      if (startText === "-" || endText === "-") {
        return startText !== "-" ? startText : endText;
      }

      return `${startText} - ${endText}`;
    }

    function parseJsonObject(value) {
      if (!value) {
        return {};
      }

      if (typeof value === "object") {
        return value;
      }

      try {
        const parsed = JSON.parse(String(value || "{}"));
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function formatAttendanceMinutes(minutes = 0) {
      const normalizedMinutes = Math.max(0, Math.round(Number(minutes || 0)));
      const hours = Math.floor(normalizedMinutes / 60);
      const remainder = normalizedMinutes % 60;

      if (hours <= 0) {
        return `${formatNumber(remainder)}분`;
      }

      if (remainder <= 0) {
        return `${formatNumber(hours)}시간`;
      }

      return `${formatNumber(hours)}시간 ${formatNumber(remainder)}분`;
    }

    return Object.freeze({
      formatAttendanceMinutes,
      formatDate,
      formatDateRange,
      formatDateTime,
      formatNumber,
      formatTime,
      formatTimeRange,
      parseJsonObject,
      toArray,
    });
  }

  return Object.freeze({ create });
});
