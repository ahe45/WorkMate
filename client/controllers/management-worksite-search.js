(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksiteSearchController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      SOUTH_KOREA_VIEWBOX,
      getManagementWorksiteCountryCode,
      getManagementWorksitePlaceName,
      renderWorkspacePage,
      serializeManagementMapMetadata,
      setManagementWorksiteDraft,
      state,
      updateManagementWorksiteFormFields,
    } = dependencies;

    if (!SOUTH_KOREA_VIEWBOX || !renderWorkspacePage || !state) {
      throw new Error("WorkMateManagementWorksiteSearchController requires worksite search dependencies.");
    }

    let managementReverseLookupSequence = 0;

    function normalizeManagementWorksiteSearchText(value = "") {
      return String(value || "")
        .toLocaleLowerCase("ko")
        .replace(/\s+/g, " ")
        .trim();
    }

    function buildManagementWorksiteSearchScore(query = "", item = {}) {
      const normalizedQuery = normalizeManagementWorksiteSearchText(query);
      const tokens = Array.from(new Set(
        normalizedQuery
          .split(/[\s,]+/)
          .map((token) => token.trim())
          .filter((token) => token.length >= 2 || /^\d+$/.test(token))
      ));
      const address = item?.address || {};
      const searchText = normalizeManagementWorksiteSearchText([
        item?.display_name,
        item?.name,
        address?.road,
        address?.quarter,
        address?.borough,
        address?.city,
        address?.municipality,
        address?.state,
        address?.postcode,
      ].filter(Boolean).join(" "));
      const matchedTokenCount = tokens.filter((token) => searchText.includes(token)).length;
      let score = matchedTokenCount * 10;

      if (normalizedQuery && searchText.includes(normalizedQuery)) {
        score += 20;
      }

      const road = normalizeManagementWorksiteSearchText(address?.road || "");
      const borough = normalizeManagementWorksiteSearchText(address?.borough || address?.city_district || "");
      const city = normalizeManagementWorksiteSearchText(address?.city || address?.province || address?.state || "");

      if (road && normalizedQuery.includes(road)) {
        score += 12;
      }

      if (borough && normalizedQuery.includes(borough)) {
        score += 8;
      }

      if (city && normalizedQuery.includes(city)) {
        score += 6;
      }

      return score + Number(item?.importance || 0);
    }

    async function searchManagementWorksiteLocations(query = "") {
      const normalizedQuery = String(query || "").trim();
      state.managementWorksiteSearchQuery = normalizedQuery;

      if (!normalizedQuery) {
        state.managementWorksiteSearchResults = [];
        state.managementWorksiteSearchStatus = "검색어를 입력하세요.";
        renderWorkspacePage();
        return;
      }

      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", normalizedQuery);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "12");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("accept-language", "ko");
        url.searchParams.set("countrycodes", "kr");
        url.searchParams.set("viewbox", `${SOUTH_KOREA_VIEWBOX.left},${SOUTH_KOREA_VIEWBOX.top},${SOUTH_KOREA_VIEWBOX.right},${SOUTH_KOREA_VIEWBOX.bottom}`);
        url.searchParams.set("bounded", "1");

        const response = await fetch(url.toString(), {
          headers: {
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          },
        });

        if (!response.ok) {
          throw new Error("지도 위치 검색에 실패했습니다.");
        }

        const payload = await response.json();
        state.managementWorksiteSearchResults = Array.isArray(payload)
          ? payload
            .map((item) => ({
              address: item?.address || {},
              countryCode: getManagementWorksiteCountryCode(item),
              displayName: String(item?.display_name || "").trim(),
              lat: Number(item?.lat),
              lng: Number(item?.lon),
              mapMetadataJson: serializeManagementMapMetadata(item),
              matchScore: buildManagementWorksiteSearchScore(normalizedQuery, item),
              name: getManagementWorksitePlaceName({
                address: item?.address || {},
                displayName: item?.display_name || "",
                name: item?.name || "",
              }),
              placeId: String(item?.place_id || "").trim(),
            }))
            .filter((item) => item.countryCode === "KR" && Number.isFinite(item.lat) && Number.isFinite(item.lng))
            .sort((left, right) => right.matchScore - left.matchScore || String(left.displayName || "").localeCompare(String(right.displayName || ""), "ko"))
            .slice(0, 5)
          : [];
        state.managementWorksiteSearchStatus = state.managementWorksiteSearchResults.length > 0
          ? `${state.managementWorksiteSearchResults.length}개의 위치를 찾았습니다.`
          : "검색 결과가 없습니다.";
      } catch (error) {
        state.managementWorksiteSearchResults = [];
        state.managementWorksiteSearchStatus = error.message || "지도 위치 검색에 실패했습니다.";
      }

      renderWorkspacePage();
    }

    async function reverseGeocodeManagementWorksite(lat, lng, { updateName = false } = {}) {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
        return;
      }

      const lookupSequence = ++managementReverseLookupSequence;

      try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lng));
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("zoom", "18");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("accept-language", "ko");

        const response = await fetch(url.toString(), {
          headers: {
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.9",
          },
        });

        if (!response.ok) {
          throw new Error("위치 설명을 불러오지 못했습니다.");
        }

        const payload = await response.json();

        if (lookupSequence !== managementReverseLookupSequence) {
          return;
        }

        const nextPatch = {
          addressLine1: String(payload?.display_name || "").trim(),
          mapMetadataJson: serializeManagementMapMetadata(payload),
        };

        if (updateName && !String(state.managementWorksiteDraft.name || "").trim()) {
          nextPatch.name = getManagementWorksitePlaceName({
            address: payload?.address || {},
            displayName: payload?.display_name || "",
            name: payload?.name || "",
          });
        }

        setManagementWorksiteDraft(nextPatch);
        updateManagementWorksiteFormFields();
      } catch (error) {
        if (lookupSequence === managementReverseLookupSequence) {
          state.managementWorksiteSearchStatus = error.message || "위치 설명을 불러오지 못했습니다.";
        }
      }
    }

    return Object.freeze({
      buildManagementWorksiteSearchScore,
      normalizeManagementWorksiteSearchText,
      reverseGeocodeManagementWorksite,
      searchManagementWorksiteLocations,
    });
  }

  return Object.freeze({ create });
});
