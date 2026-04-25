(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateRendererStatusMeta = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      parseJsonObject,
    } = dependencies;

    if (typeof parseJsonObject !== "function") {
      throw new Error("WorkMateRendererStatusMeta requires parseJsonObject.");
    }

    function getAttendanceStateMeta(state = "") {
      const normalized = String(state || "").trim().toUpperCase();
      const map = {
        BREAK: { label: "휴식", tone: "gray" },
        CLOCKED_OUT: { label: "퇴근", tone: "gray" },
        OFFSITE: { label: "외근", tone: "orange" },
        OFF_DUTY: { label: "휴무", tone: "gray" },
        ON_BREAK: { label: "휴식", tone: "gray" },
        WFH_WORKING: { label: "재택", tone: "blue" },
        WORKING: { label: "출근", tone: "green" },
      };

      return map[normalized] || {
        label: normalized || "미기록",
        tone: normalized ? "blue" : "gray",
      };
    }

    function getAttendanceDetailStatusMeta(session = null) {
      if (!session) {
        return { label: "미기록", tone: "gray" };
      }

      const summary = parseJsonObject(session?.summaryJson);
      const detailStatus = String(summary?.detailStatus || "").trim().toUpperCase();
      const currentState = String(session?.currentState || "").trim().toUpperCase();

      if (detailStatus === "ABSENT" || currentState === "OFF_DUTY") {
        return { label: "결근", tone: "red" };
      }

      if (detailStatus === "EARLY_LEAVE" || Number(session?.earlyLeaveMinutes || 0) > 0) {
        return { label: "조퇴", tone: "orange" };
      }

      if (detailStatus === "LATE" || Number(session?.lateMinutes || 0) > 0) {
        return { label: "지각", tone: "red" };
      }

      if (detailStatus === "RETURNED") {
        return { label: "복귀", tone: "green" };
      }

      if (["OFFSITE", "WFH_WORKING"].includes(currentState) || detailStatus === "OFFSITE") {
        return { label: currentState === "WFH_WORKING" ? "재택" : "외근", tone: "blue" };
      }

      return getAttendanceStateMeta(currentState);
    }

    function normalizeAttendanceDateKey(value = "") {
      const text = String(value || "").trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
      }

      const date = new Date(text);

      if (Number.isNaN(date.getTime())) {
        return text.slice(0, 10);
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    function getScheduleTypeMeta(trackType = "", templateName = "") {
      const normalizedTrackType = String(trackType || "").trim().toUpperCase();
      const text = `${trackType || ""} ${templateName || ""}`.toUpperCase();

      if (text.includes("HOLIDAY") || text.includes("휴일")) {
        return { label: "휴일", tone: "gray" };
      }

      if (text.includes("BUSINESS") || text.includes("TRIP") || text.includes("출장") || text.includes("사업")) {
        return { label: "사업", tone: "orange" };
      }

      if (text.includes("OFFSITE") || text.includes("FIELD") || text.includes("외근")) {
        return { label: "외근", tone: "orange" };
      }

      if (text.includes("WFH") || text.includes("REMOTE") || text.includes("재택")) {
        return { label: "재택", tone: "blue" };
      }

      if (normalizedTrackType === "FIXED" || text.includes("내근")) {
        return { label: "내근", tone: "green" };
      }

      return {
        label: templateName || "근무",
        tone: "blue",
      };
    }

    function getApprovalStatusMeta(status = "") {
      const normalized = String(status || "").trim().toUpperCase();
      const map = {
        APPROVED: { label: "승인", tone: "green" },
        COMPLETED: { label: "완료", tone: "blue" },
        IN_REVIEW: { label: "검토 중", tone: "orange" },
        SUBMITTED: { label: "접수", tone: "orange" },
      };

      return map[normalized] || {
        label: normalized || "정보 없음",
        tone: "gray",
      };
    }

    return Object.freeze({
      getApprovalStatusMeta,
      getAttendanceDetailStatusMeta,
      getAttendanceStateMeta,
      getScheduleTypeMeta,
      normalizeAttendanceDateKey,
    });
  }

  return Object.freeze({ create });
});
