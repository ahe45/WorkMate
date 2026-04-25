(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateTableFilterController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      escapeAttribute,
      escapeHtml,
    } = dependencies;

    if (typeof escapeAttribute !== "function" || typeof escapeHtml !== "function") {
      throw new Error("WorkMateTableFilterController requires HTML escaping helpers.");
    }

    function getVisibleTableFilterOptionInputs(menu) {
      if (!(menu instanceof HTMLElement)) {
        return [];
      }

      return Array.from(menu.querySelectorAll("[data-table-filter-option-row='true'] input[type='checkbox']"))
        .filter((input) => {
          const optionRow = input.closest("[data-table-filter-option-row='true']");

          return input instanceof HTMLInputElement
            && optionRow
            && !optionRow.hidden;
        });
    }

    function syncTableCheckboxFilterMenuSelectionState(menu) {
      if (!(menu instanceof HTMLElement)) {
        return;
      }

      const selectAllInput = menu.querySelector("[data-table-filter-select-all='true']");

      if (!(selectAllInput instanceof HTMLInputElement)) {
        return;
      }

      const visibleInputs = getVisibleTableFilterOptionInputs(menu);
      const selectedCount = visibleInputs.filter((input) => input.checked).length;
      const hasVisibleOptions = visibleInputs.length > 0;

      selectAllInput.checked = hasVisibleOptions && selectedCount === visibleInputs.length;
      selectAllInput.indeterminate = hasVisibleOptions && selectedCount > 0 && selectedCount < visibleInputs.length;
      selectAllInput.disabled = !hasVisibleOptions;
      selectAllInput.dataset.indeterminate = selectAllInput.indeterminate ? "true" : "false";
    }

    function filterTableFilterOptionValues(optionValues = [], searchTerm = "", getSearchValue = (value) => value) {
      const normalizedSearchTerm = String(searchTerm || "").trim().toLocaleLowerCase("ko");

      if (!normalizedSearchTerm) {
        return optionValues;
      }

      return optionValues.filter((value) =>
        String(getSearchValue(value) ?? "")
          .toLocaleLowerCase("ko")
          .includes(normalizedSearchTerm),
      );
    }

    function renderTableFilterOptionItems(optionItems = []) {
      if (optionItems.length === 0) {
        return '<div class="table-filter-empty" data-table-filter-empty="true">검색 결과가 없습니다.</div>';
      }

      return optionItems.map((option) => `
        <label
          class="table-filter-option${option.className ? ` ${escapeAttribute(option.className)}` : ""}"
          title="${escapeAttribute(option.title || option.label || "")}"
          data-table-filter-option-row="true"
          data-table-filter-search-value="${escapeAttribute(String(option.searchValue || option.label || option.title || "").toLocaleLowerCase("ko"))}"
          ${option.rowAttributes || ""}
        >
          <input
            type="checkbox"
            ${option.inputAttributes || ""}
            ${option.checked ? "checked" : ""}
          />
          <span>${escapeHtml(option.label || "")}</span>
        </label>
      `).join("");
    }

    return Object.freeze({
      filterTableFilterOptionValues,
      getVisibleTableFilterOptionInputs,
      renderTableFilterOptionItems,
      syncTableCheckboxFilterMenuSelectionState,
    });
  }

  return Object.freeze({ create });
});
