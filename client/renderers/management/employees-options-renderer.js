(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeesOptionsRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const ROLE_LABEL_OPTIONS = Object.freeze([
    Object.freeze({ code: "EMPLOYEE", label: "구성원" }),
    Object.freeze({ code: "ORG_ADMIN", label: "조직 관리자" }),
    Object.freeze({ code: "SYSTEM_ADMIN", label: "시스템 관리자" }),
    Object.freeze({ code: "MASTER_ADMIN", label: "마스터관리자" }),
  ]);
  const ROLE_OPTIONS = Object.freeze([
    Object.freeze({ code: "EMPLOYEE", label: "구성원" }),
    Object.freeze({ code: "ORG_ADMIN", label: "조직 관리자" }),
    Object.freeze({ code: "SYSTEM_ADMIN", label: "시스템 관리자" }),
  ]);

  function createManagementEmployeesOptionsRenderer(deps = {}) {
    const {
      escapeAttribute,
      escapeHtml,
      toArray,
    } = deps;

    function getRoleLabel(roleCode = "") {
      const normalizedRoleCode = String(roleCode || "").trim().toUpperCase();
      return ROLE_LABEL_OPTIONS.find((option) => option.code === normalizedRoleCode)?.label || normalizedRoleCode || "-";
    }

    function getEmployeeStatusMeta(status = "") {
      const normalizedStatus = String(status || "").trim().toUpperCase();

      if (normalizedStatus === "ACTIVE") {
        return { label: "합류", tone: "green" };
      }

      if (normalizedStatus === "INVITED") {
        return { label: "합류요청", tone: "orange" };
      }

      if (normalizedStatus === "EXPIRED") {
        return { label: "요청 만료", tone: "red" };
      }

      if (normalizedStatus === "PENDING") {
        return { label: "미합류", tone: "gray" };
      }

      if (normalizedStatus === "INACTIVE") {
        return { label: "비활성", tone: "gray" };
      }

      if (normalizedStatus === "RETIRED") {
        return { label: "퇴사", tone: "gray" };
      }

      return { label: "임시 저장", tone: "blue" };
    }

    function renderRequiredIcon() {
      return '<span class="workmate-required-icon" role="img" aria-label="필수" title="필수"></span>';
    }

    function formatManagementEmployeeDateKey(value = "") {
      const rawValue = String(value || "").trim();
      const dateKeyMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);

      return dateKeyMatch ? dateKeyMatch[1] : "";
    }

    function formatManagementEmployeeFullName(draft = {}) {
      const displayName = String(draft?.name || "").trim();

      if (displayName) {
        return displayName;
      }

      return `${String(draft?.lastName || "").trim()}${String(draft?.firstName || "").trim()}`.trim();
    }

    function hasManagementEmployeeRequiredFields(draft = {}) {
      return Boolean(
        formatManagementEmployeeFullName(draft)
        && String(draft?.employeeNo || "").trim()
        && String(draft?.roleCode || "").trim()
        && String(draft?.primaryUnitId || "").trim()
        && String(draft?.jobTitleId || "").trim()
        && String(draft?.workPolicyId || "").trim()
        && String(draft?.joinDate || "").trim()
        && String(draft?.loginEmail || "").trim()
        && String(draft?.phone || "").trim()
      );
    }

    function canRequestManagementEmployeeJoin(draft = {}, state = {}) {
      const normalizedStatus = String(draft?.managementStatus || draft?.employmentStatus || "").trim().toUpperCase();
      const employeeId = String(draft?.employeeId || draft?.id || "").trim();
      const isDirty = Boolean(state?.managementModalUi?.dirty?.employee);
      return Boolean(employeeId)
        && hasManagementEmployeeRequiredFields(draft)
        && !isDirty
        && normalizedStatus !== "ACTIVE";
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

    function formatManagementEmployeeTenure(joinDate = "", retireDate = "") {
      const startDate = parseManagementEmployeeDate(joinDate);

      if (!startDate) {
        return "입사일을 입력하면 자동 계산됩니다.";
      }

      const fallbackEndDate = new Date();
      const endDate = parseManagementEmployeeDate(retireDate) || new Date(
        fallbackEndDate.getFullYear(),
        fallbackEndDate.getMonth(),
        fallbackEndDate.getDate(),
      );

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

    function renderManagementEmployeeRoleOptions(selectedRoleCode = "") {
      const normalizedRoleCode = String(selectedRoleCode || "").trim().toUpperCase();
      const selectedRoleLabel = getRoleLabel(normalizedRoleCode);
      const hasSelectedLegacyRole = Boolean(
        normalizedRoleCode
        && !ROLE_OPTIONS.some((option) => option.code === normalizedRoleCode)
        && selectedRoleLabel !== normalizedRoleCode,
      );

      return `
        <option value="">권한을 선택하세요</option>
        ${hasSelectedLegacyRole
          ? `<option value="${escapeAttribute(normalizedRoleCode)}" selected>${escapeHtml(`${selectedRoleLabel} (사용 중지)`)}</option>`
          : ""}
        ${ROLE_OPTIONS.map((option) => `
          <option value="${escapeAttribute(option.code)}"${option.code === normalizedRoleCode ? " selected" : ""}>${escapeHtml(option.label)}</option>
        `).join("")}
      `;
    }

    function isManagementEmployeeHiddenRootUnit(unit = {}) {
      return String(unit?.code || "").trim().toUpperCase() === "ROOT"
        && !String(unit?.parentUnitId || "").trim();
    }

    function buildManagementEmployeeUnitMaps(units = []) {
      const allUnits = toArray(units);
      const hiddenRootIds = new Set(
        allUnits
          .filter((unit) => isManagementEmployeeHiddenRootUnit(unit))
          .map((unit) => String(unit?.id || "").trim())
          .filter(Boolean),
      );
      const visibleUnits = allUnits.filter((unit) => !hiddenRootIds.has(String(unit?.id || "").trim()));
      const unitById = new Map(
        visibleUnits
          .map((unit) => [String(unit?.id || "").trim(), unit])
          .filter(([unitId]) => Boolean(unitId)),
      );

      return {
        hiddenRootIds,
        unitById,
        visibleUnits,
      };
    }

    function formatManagementEmployeeUnitLabel(unit = {}, unitById = new Map(), hiddenRootIds = new Set()) {
      const names = [];
      let cursor = unit;
      let guard = 0;

      while (cursor && guard < 20) {
        const label = String(cursor?.name || "").trim();

        if (label) {
          names.unshift(label);
        }

        const parentUnitId = String(cursor?.parentUnitId || "").trim();

        if (!parentUnitId || hiddenRootIds.has(parentUnitId)) {
          break;
        }

        cursor = unitById.get(parentUnitId) || null;
        guard += 1;
      }

      return names.join("-") || "조직";
    }

    function getManagementEmployeeSelectableUnits(units = [], unitTreeModel = null) {
      if (unitTreeModel && Array.isArray(unitTreeModel.rows)) {
        const orderedUnits = toArray(unitTreeModel.rows).map((entry) => entry?.unit).filter(Boolean);
        const orderedUnitById = new Map(
          orderedUnits
            .map((unit) => [String(unit?.id || "").trim(), unit])
            .filter(([unitId]) => Boolean(unitId)),
        );
        const parentUnitIds = new Set(
          orderedUnits
            .map((unit) => String(unit?.parentUnitId || "").trim())
            .filter((unitId) => Boolean(unitId) && orderedUnitById.has(unitId)),
        );

        return orderedUnits.filter((unit) => !parentUnitIds.has(String(unit?.id || "").trim()));
      }

      const { visibleUnits, unitById } = buildManagementEmployeeUnitMaps(units);
      const parentUnitIds = new Set(
        visibleUnits
          .map((unit) => String(unit?.parentUnitId || "").trim())
          .filter((unitId) => Boolean(unitId) && unitById.has(unitId)),
      );

      return visibleUnits.filter((unit) => !parentUnitIds.has(String(unit?.id || "").trim()));
    }

    function renderManagementEmployeeUnitOptions(units = [], selectedUnitId = "", placeholder = "조직을 선택하세요", unitTreeModel = null) {
      const normalizedSelectedUnitId = String(selectedUnitId || "").trim();
      const { hiddenRootIds, unitById } = buildManagementEmployeeUnitMaps(units);
      const selectableUnits = getManagementEmployeeSelectableUnits(units, unitTreeModel);
      const selectableUnitIds = new Set(selectableUnits.map((unit) => String(unit?.id || "").trim()).filter(Boolean));
      const hasSelectedHiddenUnit = Boolean(
        normalizedSelectedUnitId
        && !selectableUnitIds.has(normalizedSelectedUnitId)
        && unitById.has(normalizedSelectedUnitId),
      );
      const selectedHiddenUnit = hasSelectedHiddenUnit ? unitById.get(normalizedSelectedUnitId) : null;

      return `
        <option value="">${escapeHtml(placeholder)}</option>
        ${selectedHiddenUnit ? `
          <option value="${escapeAttribute(normalizedSelectedUnitId)}" selected>${escapeHtml(`${formatManagementEmployeeUnitLabel(selectedHiddenUnit, unitById, hiddenRootIds)} (사용 중지)`)}</option>
        ` : ""}
        ${selectableUnits.map((unit) => {
          const unitId = String(unit?.id || "").trim();
          const label = formatManagementEmployeeUnitLabel(unit, unitById, hiddenRootIds);

          return `<option value="${escapeAttribute(unitId)}"${unitId === normalizedSelectedUnitId ? " selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("")}
      `;
    }

    function getManagementEmployeeAvailableJobTitles(jobTitles = [], unitId = "") {
      const normalizedUnitId = String(unitId || "").trim();

      if (!normalizedUnitId) {
        return [];
      }

      return toArray(jobTitles)
        .filter((jobTitle) => (
          toArray(jobTitle?.unitIds)
            .map((mappedUnitId) => String(mappedUnitId || "").trim())
            .includes(normalizedUnitId)
        ))
        .sort((left, right) => {
          const sortOrderGap = Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);

          if (sortOrderGap !== 0) {
            return sortOrderGap;
          }

          return String(left?.name || "").localeCompare(String(right?.name || ""), "ko", {
            numeric: true,
            sensitivity: "base",
          });
        });
    }

    function renderManagementEmployeeJobTitleOptions(jobTitles = [], selectedJobTitleId = "", unitId = "") {
      const normalizedSelectedJobTitleId = String(selectedJobTitleId || "").trim();
      const normalizedUnitId = String(unitId || "").trim();
      const availableJobTitles = getManagementEmployeeAvailableJobTitles(jobTitles, normalizedUnitId);
      const placeholder = normalizedUnitId ? "직급을 선택하세요" : "조직을 먼저 선택하세요";

      return `
        <option value="">${escapeHtml(placeholder)}</option>
        ${availableJobTitles.map((jobTitle) => {
          const jobTitleId = String(jobTitle?.id || "").trim();
          const label = String(jobTitle?.name || "").trim() || "-";

          return `<option value="${escapeAttribute(jobTitleId)}"${jobTitleId === normalizedSelectedJobTitleId ? " selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("")}
      `;
    }

    function renderManagementEmployeeSelectOptions(items = [], selectedId = "", placeholder = "선택하세요", valueKey = "id", labelKey = "name") {
      const normalizedSelectedId = String(selectedId || "").trim();

      return `
        <option value="">${escapeHtml(placeholder)}</option>
        ${toArray(items).map((item) => {
          const value = String(item?.[valueKey] || "").trim();
          const label = String(item?.[labelKey] || item?.name || "").trim();

          return `<option value="${escapeAttribute(value)}"${value === normalizedSelectedId ? " selected" : ""}>${escapeHtml(label || "-")}</option>`;
        }).join("")}
      `;
    }

    return Object.freeze({
      buildManagementEmployeeUnitMaps,
      canRequestManagementEmployeeJoin,
      formatManagementEmployeeDateKey,
      formatManagementEmployeeFullName,
      formatManagementEmployeeTenure,
      formatManagementEmployeeUnitLabel,
      getEmployeeStatusMeta,
      getManagementEmployeeAvailableJobTitles,
      getRoleLabel,
      hasManagementEmployeeRequiredFields,
      parseManagementEmployeeDate,
      renderManagementEmployeeJobTitleOptions,
      renderManagementEmployeeRoleOptions,
      renderManagementEmployeeSelectOptions,
      renderManagementEmployeeUnitOptions,
      renderRequiredIcon,
    });
  }

  return Object.freeze({
    create: createManagementEmployeesOptionsRenderer,
  });
});
