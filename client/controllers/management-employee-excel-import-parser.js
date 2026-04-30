(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeExcelImportParser = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EMPLOYEE_IMPORT_HEADERS = Object.freeze({
    employeeNo: ["사번", "employee no", "employeeno", "employee number", "employeeNumber"],
    firstName: ["이름", "first name", "firstname", "givenname"],
    inviteChannels: ["합류요청방식", "전송방식", "invitechannels", "invitechannel", "channels", "methods"],
    joinDate: ["입사일", "join date", "joindate", "hiredate"],
    jobTitle: ["직급", "job title", "jobtitle", "position", "rank", "title"],
    lastName: ["성", "last name", "lastname", "familyname", "surname"],
    loginEmail: ["이메일", "email", "loginemail", "mail"],
    note: ["메모", "비고", "memo", "note"],
    phone: ["전화번호", "연락처", "phone", "mobile"],
    primaryUnit: ["조직", "부서", "unit", "unitname", "department"],
    retireDate: ["퇴사일", "retire date", "retiredate"],
    roleCode: ["권한", "role", "rolecode"],
    status: ["상태", "status"],
    workPolicy: ["근로정책", "work policy", "workpolicy", "policy"],
  });
  const ROLE_LABEL_TO_CODE = Object.freeze({
    "구성원": "EMPLOYEE",
    "마스터관리자": "MASTER_ADMIN",
    "마스터 관리자": "MASTER_ADMIN",
    "시스템 관리자": "SYSTEM_ADMIN",
    "조직 관리자": "ORG_ADMIN",
  });

  function create(dependencies = {}) {
    const {
      createEmptyManagementEmployeeExcelUpload,
      formatLocalDateKey,
      formatManagementEmployeePhone,
      loadXlsxLibrary,
      state,
    } = dependencies;

    if (
      typeof createEmptyManagementEmployeeExcelUpload !== "function"
      || typeof formatLocalDateKey !== "function"
      || typeof formatManagementEmployeePhone !== "function"
      || typeof loadXlsxLibrary !== "function"
      || !state
    ) {
      throw new Error("WorkMateManagementEmployeeExcelImportParser requires import parser dependencies.");
    }

    function normalizeImportHeader(header = "") {
      return String(header || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()_-]/g, "");
    }

    function findImportFieldKey(header = "") {
      const normalizedHeader = normalizeImportHeader(header);

      return Object.entries(EMPLOYEE_IMPORT_HEADERS).find(([, aliases]) => aliases.some((alias) => normalizeImportHeader(alias) === normalizedHeader))?.[0] || "";
    }

    function getImportFieldValue(row = {}, fieldKey = "") {
      const entries = Object.entries(row || {});
      const matchingEntry = entries.find(([header]) => findImportFieldKey(header) === fieldKey);
      return matchingEntry ? matchingEntry[1] : "";
    }

    function normalizeImportedDate(value = "") {
      const rawValue = typeof value === "number" ? String(value) : String(value || "").trim();

      if (!rawValue) {
        return "";
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
        return rawValue;
      }

      const delimiterMatch = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(rawValue);

      if (delimiterMatch) {
        return `${delimiterMatch[1]}-${delimiterMatch[2].padStart(2, "0")}-${delimiterMatch[3].padStart(2, "0")}`;
      }

      const serialNumber = Number(rawValue);

      if (Number.isFinite(serialNumber) && serialNumber > 25000) {
        const serialDate = new Date(Math.round((serialNumber - 25569) * 86400 * 1000));

        if (!Number.isNaN(serialDate.getTime())) {
          return [
            serialDate.getUTCFullYear(),
            String(serialDate.getUTCMonth() + 1).padStart(2, "0"),
            String(serialDate.getUTCDate()).padStart(2, "0"),
          ].join("-");
        }
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

    function normalizeImportedRoleCode(value = "") {
      const normalizedValue = String(value || "").trim();
      const upperValue = normalizedValue.toUpperCase();

      if (ROLE_LABEL_TO_CODE[normalizedValue]) {
        return ROLE_LABEL_TO_CODE[normalizedValue];
      }

      return ROLE_LABEL_TO_CODE[upperValue] ? ROLE_LABEL_TO_CODE[upperValue] : upperValue;
    }

    function normalizeImportedInviteChannels(value = "", payload = {}) {
      const rawValue = String(value || "").trim();

      if (!rawValue) {
        const defaults = [];

        if (payload.loginEmail) {
          defaults.push("EMAIL");
        }

        if (payload.phone) {
          defaults.push("SMS");
        }

        return defaults;
      }

      return rawValue.split(/[,+/|]/)
        .map((item) => String(item || "").trim().toUpperCase())
        .map((item) => {
          if (["EMAIL", "MAIL", "이메일"].includes(item)) {
            return "EMAIL";
          }

          if (["SMS", "TEXT", "MESSAGE", "문자"].includes(item)) {
            return "SMS";
          }

          return "";
        })
        .filter(Boolean);
    }

    function resolveImportedStatus(value = "") {
      const normalizedValue = String(value || "").trim().toLowerCase();

      if (!normalizedValue) {
        return { employmentStatus: "DRAFT", submissionMode: "DRAFT" };
      }

      if (normalizedValue.includes("미합류") || normalizedValue.includes("pending")) {
        return { employmentStatus: "PENDING", submissionMode: "STANDARD" };
      }

      if (normalizedValue.includes("합류요청") || normalizedValue.includes("invite") || normalizedValue.includes("request")) {
        return { employmentStatus: "INVITED", submissionMode: "INVITED" };
      }

      if (normalizedValue.includes("합류") || normalizedValue.includes("joined") || normalizedValue.includes("active")) {
        return { employmentStatus: "ACTIVE", submissionMode: "STANDARD" };
      }

      if (normalizedValue.includes("퇴사") || normalizedValue.includes("retired")) {
        return { employmentStatus: "RETIRED", submissionMode: "STANDARD" };
      }

      if (normalizedValue.includes("비활성") || normalizedValue.includes("inactive")) {
        return { employmentStatus: "INACTIVE", submissionMode: "STANDARD" };
      }

      return { employmentStatus: "DRAFT", submissionMode: "DRAFT" };
    }

    function splitImportedName(lastName = "", firstName = "") {
      const normalizedLastName = String(lastName || "").trim();
      const normalizedFirstName = String(firstName || "").trim();

      if (normalizedLastName || !normalizedFirstName) {
        return {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        };
      }

      if (normalizedFirstName.includes(" ")) {
        const parts = normalizedFirstName.split(/\s+/).filter(Boolean);
        return {
          firstName: parts.slice(1).join(" "),
          lastName: parts[0] || "",
        };
      }

      if (normalizedFirstName.length >= 2) {
        return {
          firstName: normalizedFirstName.slice(1),
          lastName: normalizedFirstName.slice(0, 1),
        };
      }

      return {
        firstName: normalizedFirstName,
        lastName: "",
      };
    }

    function toArray(items = []) {
      return Array.isArray(items) ? items : [];
    }

    function buildLookupMap(items = [], valueSelector, keySelector) {
      return toArray(items).reduce((map, item) => {
        const key = normalizeImportHeader(typeof keySelector === "function" ? keySelector(item) : item?.[keySelector]);
        const value = typeof valueSelector === "function" ? valueSelector(item) : item?.[valueSelector];

        if (key && value && !map.has(key)) {
          map.set(key, value);
        }

        return map;
      }, new Map());
    }

    function isImportedRowEmpty(row = {}) {
      return !Object.values(row || {}).some((value) => String(value || "").trim());
    }

    function hasImportedEmployeeRequiredFields(payload = {}) {
      return Boolean(
        String(payload.lastName || "").trim()
        && String(payload.firstName || "").trim()
        && String(payload.employeeNo || "").trim()
        && String(payload.roleCode || "").trim()
        && String(payload.primaryUnitId || "").trim()
        && String(payload.jobTitleId || "").trim()
        && String(payload.workPolicyId || "").trim()
        && String(payload.joinDate || "").trim()
        && String(payload.loginEmail || "").trim()
        && String(payload.phone || "").trim(),
      );
    }

    function createEmployeeImportLookup() {
      return {
        jobTitleById: buildLookupMap(state.bootstrap?.jobTitles, (item) => item?.id, (item) => item?.id),
        jobTitleByName: buildLookupMap(state.bootstrap?.jobTitles, (item) => item?.id, (item) => item?.name),
        unitById: buildLookupMap(state.bootstrap?.units, (item) => item?.id, (item) => item?.id),
        unitByName: buildLookupMap(state.bootstrap?.units, (item) => item?.id, (item) => item?.name),
        workPolicyById: buildLookupMap(state.bootstrap?.workPolicies, (item) => item?.id, (item) => item?.id),
        workPolicyByName: buildLookupMap(state.bootstrap?.workPolicies, (item) => item?.id, (item) => item?.name),
      };
    }

    function mapImportedEmployeeRow(row = {}, lookup = {}) {
      const splitName = splitImportedName(
        getImportFieldValue(row, "lastName"),
        getImportFieldValue(row, "firstName"),
      );
      const unitLabel = String(getImportFieldValue(row, "primaryUnit") || "").trim();
      const jobTitleLabel = String(getImportFieldValue(row, "jobTitle") || "").trim();
      const workPolicyLabel = String(getImportFieldValue(row, "workPolicy") || "").trim();
      const status = resolveImportedStatus(getImportFieldValue(row, "status"));
      const payload = {
        employeeNo: String(getImportFieldValue(row, "employeeNo") || "").trim(),
        employmentStatus: status.employmentStatus,
        firstName: splitName.firstName,
        jobTitleId: lookup.jobTitleByName.get(normalizeImportHeader(jobTitleLabel)) || lookup.jobTitleById.get(normalizeImportHeader(jobTitleLabel)) || "",
        joinDate: normalizeImportedDate(getImportFieldValue(row, "joinDate")) || formatLocalDateKey(),
        lastName: splitName.lastName,
        loginEmail: String(getImportFieldValue(row, "loginEmail") || "").trim().toLowerCase(),
        note: String(getImportFieldValue(row, "note") || "").trim(),
        phone: formatManagementEmployeePhone(getImportFieldValue(row, "phone") || ""),
        primaryUnitId: lookup.unitByName.get(normalizeImportHeader(unitLabel)) || lookup.unitById.get(normalizeImportHeader(unitLabel)) || "",
        retireDate: normalizeImportedDate(getImportFieldValue(row, "retireDate")),
        roleCode: normalizeImportedRoleCode(getImportFieldValue(row, "roleCode")),
        submissionMode: status.submissionMode,
        workPolicyId: lookup.workPolicyByName.get(normalizeImportHeader(workPolicyLabel)) || lookup.workPolicyById.get(normalizeImportHeader(workPolicyLabel)) || "",
      };

      payload.inviteChannels = normalizeImportedInviteChannels(getImportFieldValue(row, "inviteChannels"), payload);
      return payload;
    }

    async function parseEmployeeImportRows(file) {
      const XLSX = await loadXlsxLibrary();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
        throw new Error("엑셀 시트에서 읽을 데이터를 찾지 못했습니다.");
      }

      return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        defval: "",
        raw: false,
      });
    }

    function buildEmployeeImportPreview(rows = []) {
      const lookup = createEmployeeImportLookup();
      const preview = createEmptyManagementEmployeeExcelUpload();

      rows.forEach((row, index) => {
        if (isImportedRowEmpty(row)) {
          preview.skippedRowCount += 1;
          return;
        }

        const payload = mapImportedEmployeeRow(row, lookup);
        const employmentStatus = String(payload.employmentStatus || "").trim().toUpperCase();

        preview.payloadEntries.push({
          index: index + 2,
          payload,
        });
        preview.rowCount += 1;

        if (employmentStatus === "ACTIVE") {
          preview.activeCount += 1;
        } else if (employmentStatus === "INVITED") {
          preview.invitedCount += 1;
        } else if (employmentStatus === "PENDING") {
          preview.pendingCount += 1;
        } else if (employmentStatus === "INACTIVE") {
          preview.inactiveCount += 1;
        } else if (employmentStatus === "RETIRED") {
          preview.retiredCount += 1;
        } else {
          preview.draftCount += 1;
        }

        if (payload.submissionMode !== "DRAFT" && !hasImportedEmployeeRequiredFields(payload)) {
          preview.reviewCount += 1;
        }
      });

      return preview;
    }

    return Object.freeze({
      buildEmployeeImportPreview,
      parseEmployeeImportRows,
    });
  }

  return Object.freeze({ create });
});
