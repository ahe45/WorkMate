(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeFieldValidation = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      parseManagementEmployeeDate,
      setInlineMessage,
      showToast,
    } = dependencies;

    if (
      typeof parseManagementEmployeeDate !== "function"
      || typeof setInlineMessage !== "function"
      || typeof showToast !== "function"
    ) {
      throw new Error("WorkMateManagementEmployeeFieldValidation requires field validation dependencies.");
    }

    function getManagementEmployeeFieldName(control) {
      return String(control?.name || control?.id || "").trim();
    }

    function getManagementEmployeeFieldErrorId(control) {
      const baseId = String(control?.id || getManagementEmployeeFieldName(control) || "field").trim();
      return `${baseId}-error`;
    }

    function getManagementEmployeeFieldError(control) {
      const field = control?.closest?.(".field") || null;
      const fieldName = getManagementEmployeeFieldName(control);

      if (!field || !fieldName) {
        return null;
      }

      return field.querySelector(`[data-management-employee-field-error="${fieldName}"]`);
    }

    function getManagementEmployeeFieldValidationMessage(control) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
        || !control.closest("#management-employee-form")
        || control.disabled
        || control.type === "file") {
        return "";
      }

      const fieldName = getManagementEmployeeFieldName(control);
      const value = String(control.value || "").trim();

      if (control.required && !value) {
        return "필수값입니다.";
      }

      if (!value) {
        return "";
      }

      if (fieldName === "loginEmail") {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (control.validity?.typeMismatch || !emailPattern.test(value)) {
          return "이메일 형식이 올바르지 않습니다.";
        }
      }

      if (fieldName === "phone") {
        const digits = value.replace(/\D/g, "");

        if (!/^0\d{8,10}$/.test(digits)) {
          return "전화번호 형식이 올바르지 않습니다.";
        }
      }

      if (fieldName === "joinDate" || fieldName === "retireDate") {
        const currentDate = parseManagementEmployeeDate(value);

        if (!currentDate) {
          return "날짜 형식이 올바르지 않습니다.";
        }

        const joinDateInput = document.getElementById("management-employee-join-date");
        const retireDateInput = document.getElementById("management-employee-retire-date");
        const joinDate = parseManagementEmployeeDate(joinDateInput instanceof HTMLInputElement ? joinDateInput.value : "");
        const retireDate = parseManagementEmployeeDate(retireDateInput instanceof HTMLInputElement ? retireDateInput.value : "");

        if (joinDate && retireDate && retireDate.getTime() < joinDate.getTime()) {
          return fieldName === "joinDate"
            ? "입사일은 퇴사일 이전이어야 합니다."
            : "퇴사일은 입사일 이후여야 합니다.";
        }
      }

      return "";
    }

    function setManagementEmployeeFieldValidationMessage(control, message = "") {
      const field = control?.closest?.(".field") || null;
      const fieldName = getManagementEmployeeFieldName(control);

      if (!field || !fieldName) {
        return false;
      }

      const normalizedMessage = String(message || "").trim();
      const errorId = getManagementEmployeeFieldErrorId(control);
      let error = getManagementEmployeeFieldError(control);

      field.classList.toggle("is-invalid", Boolean(normalizedMessage));

      if (!normalizedMessage) {
        error?.remove();
        control.removeAttribute("aria-invalid");

        const describedBy = String(control.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter((id) => id && id !== errorId)
          .join(" ");

        if (describedBy) {
          control.setAttribute("aria-describedby", describedBy);
        } else {
          control.removeAttribute("aria-describedby");
        }

        return true;
      }

      if (!error) {
        error = document.createElement("p");
        error.className = "workmate-field-warning";
        error.dataset.managementEmployeeFieldError = fieldName;
        error.id = errorId;
        control.insertAdjacentElement("afterend", error);
      }

      error.textContent = normalizedMessage;
      control.setAttribute("aria-invalid", "true");

      const describedBySet = new Set(
        String(control.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter(Boolean),
      );
      describedBySet.add(errorId);
      control.setAttribute("aria-describedby", Array.from(describedBySet).join(" "));
      return false;
    }

    function validateManagementEmployeeField(control, options = {}) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
        return true;
      }

      const force = options.force !== false;
      const hasVisibleError = Boolean(getManagementEmployeeFieldError(control))
        || control.getAttribute("aria-invalid") === "true";

      if (!force && !hasVisibleError) {
        return true;
      }

      const message = getManagementEmployeeFieldValidationMessage(control);
      return setManagementEmployeeFieldValidationMessage(control, message);
    }

    function validateManagementEmployeeFormFields() {
      const form = document.getElementById("management-employee-form");

      if (!(form instanceof HTMLFormElement)) {
        return true;
      }

      return Array.from(form.querySelectorAll("input, select, textarea"))
        .filter((control) => control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
        .reduce((isValid, control) => validateManagementEmployeeField(control, { force: true }) && isValid, true);
    }

    function focusFirstInvalidManagementEmployeeField() {
      const form = document.getElementById("management-employee-form");

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const invalidControl = form.querySelector("[aria-invalid='true']");

      if (invalidControl instanceof HTMLInputElement
        || invalidControl instanceof HTMLSelectElement
        || invalidControl instanceof HTMLTextAreaElement) {
        invalidControl.focus();
      }
    }

    function notifyManagementEmployeeValidationFailure(message = "입력값을 확인하세요.") {
      const normalizedMessage = String(message || "").trim() || "입력값을 확인하세요.";

      setInlineMessage(document.getElementById("management-employee-error"), normalizedMessage);
      showToast(normalizedMessage, { duration: 3600, tone: "error" });
      focusFirstInvalidManagementEmployeeField();
    }

    return Object.freeze({
      notifyManagementEmployeeValidationFailure,
      validateManagementEmployeeField,
      validateManagementEmployeeFormFields,
    });
  }

  return Object.freeze({ create });
});
