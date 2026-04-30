(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeFormUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function buildInviteChannelDefaults({ inviteChannels = [], loginEmail = "", phone = "" } = {}) {
    const normalizedChannels = Array.from(new Set((Array.isArray(inviteChannels) ? inviteChannels : [])
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean)));

    if (normalizedChannels.length > 0) {
      return normalizedChannels;
    }

    const defaults = [];

    if (String(loginEmail || "").trim()) {
      defaults.push("EMAIL");
    }

    if (String(phone || "").trim()) {
      defaults.push("SMS");
    }

    return defaults;
  }

  function getInviteChannelLabel(inviteChannels = []) {
    const normalizedChannels = Array.from(new Set((Array.isArray(inviteChannels) ? inviteChannels : [inviteChannels])
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean)));

    if (normalizedChannels.includes("EMAIL") && normalizedChannels.includes("SMS")) {
      return "이메일과 문자";
    }

    if (normalizedChannels.includes("SMS")) {
      return "문자";
    }

    return "이메일";
  }

  function createEmptyManagementEmployeeInviteProgress() {
    return {
      active: false,
      channelLabel: "",
      message: "",
      progressLabel: "",
    };
  }

  function sanitizePersonnelCard(card = null) {
    if (!card || typeof card !== "object") {
      return null;
    }

    const name = String(card.name || "").trim();
    const type = String(card.type || "").trim();
    const dataUrl = typeof card.dataUrl === "string" ? String(card.dataUrl || "") : "";
    const size = Math.max(0, Number(card.size || 0) || 0);

    if (!name && !dataUrl) {
      return null;
    }

    return {
      dataUrl,
      name,
      size,
      type,
    };
  }

  function createEmptyManagementEmployeeExcelUpload() {
    return {
      activeCount: 0,
      draftCount: 0,
      fileName: "",
      fileSize: 0,
      fileType: "",
      inactiveCount: 0,
      invitedCount: 0,
      pendingCount: 0,
      payloadEntries: [],
      retiredCount: 0,
      reviewCount: 0,
      rowCount: 0,
      skippedRowCount: 0,
    };
  }

  function normalizeManagementEmployeeDateValue(value = "") {
    const rawValue = String(value || "").trim();
    const dateOnlyMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);

    if (dateOnlyMatch) {
      return dateOnlyMatch[1];
    }

    const parsedDate = new Date(rawValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return [
      parsedDate.getFullYear(),
      String(parsedDate.getMonth() + 1).padStart(2, "0"),
      String(parsedDate.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function splitManagementEmployeeFullName(name = "", fallback = {}) {
    const normalizedName = String(name || "").trim();
    const fallbackLastName = String(fallback?.lastName || "").trim();
    const fallbackFirstName = String(fallback?.firstName || "").trim();

    if (!normalizedName) {
      return {
        firstName: fallbackFirstName,
        lastName: fallbackLastName,
      };
    }

    const parts = normalizedName.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      return {
        firstName: parts.slice(1).join(" "),
        lastName: parts[0] || "",
      };
    }

    if (normalizedName.length > 1) {
      return {
        firstName: normalizedName.slice(1),
        lastName: normalizedName.slice(0, 1),
      };
    }

    return {
      firstName: "",
      lastName: normalizedName,
    };
  }

  function hasManagementEmployeeName(payload = {}) {
    return Boolean(
      String(payload.name || "").trim()
      || `${String(payload.lastName || "").trim()}${String(payload.firstName || "").trim()}`.trim()
    );
  }

  function formatManagementEmployeePhone(value = "") {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    if (digits.length <= 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function parseManagementEmployeeDate(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
      return null;
    }

    const [year, month, day] = normalizedValue.split("-").map((part) => Number(part));
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())
      || date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  function formatManagementEmployeeTenureLabel(joinDate = "", retireDate = "") {
    const startDate = parseManagementEmployeeDate(joinDate);

    if (!startDate) {
      return "입사일을 입력하면 자동 계산됩니다.";
    }

    const today = new Date();
    const endDate = parseManagementEmployeeDate(retireDate) || new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (endDate.getTime() < startDate.getTime()) {
      return "퇴사일이 입사일보다 빠릅니다.";
    }

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    if (days < 0) {
      months -= 1;
      days += new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return `${String(Math.max(0, years)).padStart(2, "0")}년${String(Math.max(0, months)).padStart(2, "0")}월${String(Math.max(0, days)).padStart(2, "0")}일`;
  }

  function hasManagementEmployeeRequiredFields(payload = {}, options = {}) {
    const requireInviteChannels = options.requireInviteChannels === true;

    if (!hasManagementEmployeeName(payload)) {
      return false;
    }

    if (!String(payload.employeeNo || "").trim()) {
      return false;
    }

    if (!String(payload.roleCode || "").trim()) {
      return false;
    }

    if (!String(payload.primaryUnitId || "").trim()) {
      return false;
    }

    if (!String(payload.jobTitleId || "").trim()) {
      return false;
    }

    if (!String(payload.workPolicyId || "").trim()) {
      return false;
    }

    if (!String(payload.joinDate || "").trim()) {
      return false;
    }

    if (!String(payload.loginEmail || "").trim()) {
      return false;
    }

    if (!String(payload.phone || "").trim()) {
      return false;
    }

    if (requireInviteChannels && (!Array.isArray(payload.inviteChannels) || payload.inviteChannels.length === 0)) {
      return false;
    }

    return true;
  }

  function validateInvitePayload(payload = {}) {
    if (!hasManagementEmployeeRequiredFields(payload)) {
      validateStandardPayload(payload);
    }

    if (!Array.isArray(payload.inviteChannels) || payload.inviteChannels.length === 0) {
      throw new Error("합류 요청 전송 방식을 하나 이상 선택하세요.");
    }
  }

  function validateStandardPayload(payload = {}) {
    if (!hasManagementEmployeeName(payload)) {
      throw new Error("성명을 입력하세요.");
    }

    if (!String(payload.employeeNo || "").trim()) {
      throw new Error("사번을 입력하세요.");
    }

    if (!String(payload.roleCode || "").trim()) {
      throw new Error("권한을 선택하세요.");
    }

    if (!String(payload.primaryUnitId || "").trim()) {
      throw new Error("조직을 선택하세요.");
    }

    if (!String(payload.jobTitleId || "").trim()) {
      throw new Error("직급을 선택하세요.");
    }

    if (!String(payload.workPolicyId || "").trim()) {
      throw new Error("근로정책을 선택하세요.");
    }

    if (!String(payload.joinDate || "").trim()) {
      throw new Error("입사일을 선택하세요.");
    }

    if (!String(payload.loginEmail || "").trim()) {
      throw new Error("이메일을 입력하세요.");
    }

    if (!String(payload.phone || "").trim()) {
      throw new Error("전화번호를 입력하세요.");
    }
  }

  return Object.freeze({
    buildInviteChannelDefaults,
    createEmptyManagementEmployeeExcelUpload,
    createEmptyManagementEmployeeInviteProgress,
    formatManagementEmployeePhone,
    formatManagementEmployeeTenureLabel,
    getInviteChannelLabel,
    hasManagementEmployeeName,
    hasManagementEmployeeRequiredFields,
    normalizeManagementEmployeeDateValue,
    parseManagementEmployeeDate,
    sanitizePersonnelCard,
    splitManagementEmployeeFullName,
    validateInvitePayload,
    validateStandardPayload,
  });
});
