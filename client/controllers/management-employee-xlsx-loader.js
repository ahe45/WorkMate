(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementEmployeeXlsxLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EMPLOYEE_IMPORT_XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  let xlsxLoaderPromise = null;

  function loadXlsxLibrary() {
    if (globalThis.XLSX) {
      return Promise.resolve(globalThis.XLSX);
    }

    if (xlsxLoaderPromise) {
      return xlsxLoaderPromise;
    }

    xlsxLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[data-management-employee-xlsx="${EMPLOYEE_IMPORT_XLSX_URL}"]`);

      if (existingScript instanceof HTMLScriptElement) {
        existingScript.addEventListener("load", () => {
          if (globalThis.XLSX) {
            resolve(globalThis.XLSX);
            return;
          }

          reject(new Error("엑셀 업로드 라이브러리를 초기화하지 못했습니다."));
        }, { once: true });
        existingScript.addEventListener("error", () => reject(new Error("엑셀 업로드 라이브러리를 불러오지 못했습니다.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = EMPLOYEE_IMPORT_XLSX_URL;
      script.async = true;
      script.dataset.managementEmployeeXlsx = EMPLOYEE_IMPORT_XLSX_URL;
      script.onload = () => {
        if (globalThis.XLSX) {
          resolve(globalThis.XLSX);
          return;
        }

        reject(new Error("엑셀 업로드 라이브러리를 초기화하지 못했습니다."));
      };
      script.onerror = () => reject(new Error("엑셀 업로드 라이브러리를 불러오지 못했습니다."));
      document.head.appendChild(script);
    }).catch((error) => {
      xlsxLoaderPromise = null;
      throw error;
    });

    return xlsxLoaderPromise;
  }

  return Object.freeze({
    loadXlsxLibrary,
  });
});
