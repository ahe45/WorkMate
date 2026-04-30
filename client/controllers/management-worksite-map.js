(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.WorkMateManagementWorksiteMapController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function create(dependencies = {}) {
    const {
      createEmptyManagementWorksiteDraft,
      currentPage,
      DEFAULT_WORKSITE_COORDS,
      getDefaultWorksiteCoords,
      LEAFLET_CSS_URL,
      LEAFLET_JS_URL,
      normalizeManagementSection,
      reverseGeocodeManagementWorksite,
      setManagementWorksiteDraft,
      state,
      syncManagementWorksiteDraftFromDom,
      updateManagementWorksiteFormFields,
    } = dependencies;

    if (!DEFAULT_WORKSITE_COORDS || typeof createEmptyManagementWorksiteDraft !== "function" || !state) {
      throw new Error("WorkMateManagementWorksiteMapController requires worksite map dependencies.");
    }

    let leafletLoadPromise = null;
    let managementMapContext = {
      circle: null,
      container: null,
      map: null,
      marker: null,
    };

    function notifyManagementWorksiteDraftInput() {
      const latInput = document.getElementById("management-worksite-lat");

      if (latInput instanceof HTMLInputElement) {
        latInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function destroyManagementMap() {
      if (managementMapContext.map) {
        managementMapContext.map.off();
        managementMapContext.map.remove();
      }

      managementMapContext = {
        circle: null,
        container: null,
        map: null,
        marker: null,
      };
    }

    function syncManagementWorksiteMapGeometry(centerMap = false) {
      if (!managementMapContext.map || !managementMapContext.marker || !managementMapContext.circle) {
        return;
      }

      const draft = state.managementWorksiteDraft || createEmptyManagementWorksiteDraft();
      const lat = Number.isFinite(Number(draft.lat)) ? Number(draft.lat) : getDefaultWorksiteCoords().lat;
      const lng = Number.isFinite(Number(draft.lng)) ? Number(draft.lng) : getDefaultWorksiteCoords().lng;
      const radius = Math.max(20, Number(draft.geofenceRadiusMeters || 100));
      const nextLatLng = [lat, lng];

      managementMapContext.marker.setLatLng(nextLatLng);
      managementMapContext.circle.setLatLng(nextLatLng);
      managementMapContext.circle.setRadius(radius);

      if (centerMap) {
        const zoom = managementMapContext.map.getZoom() || 16;
        managementMapContext.map.setView(nextLatLng, zoom, { animate: false });
      }
    }

    async function ensureLeafletAssets() {
      if (window.L) {
        return window.L;
      }

      const existingCss = document.getElementById("workmate-leaflet-css");
      if (!existingCss) {
        const link = document.createElement("link");
        link.id = "workmate-leaflet-css";
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS_URL;
        document.head.appendChild(link);
      }

      if (!leafletLoadPromise) {
        leafletLoadPromise = new Promise((resolve, reject) => {
          const existingScript = document.getElementById("workmate-leaflet-script");

          if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.L), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Leaflet 지도를 불러오지 못했습니다.")), { once: true });
            return;
          }

          const script = document.createElement("script");
          script.id = "workmate-leaflet-script";
          script.src = LEAFLET_JS_URL;
          script.async = true;
          script.onload = () => resolve(window.L);
          script.onerror = () => reject(new Error("Leaflet 지도를 불러오지 못했습니다."));
          document.body.appendChild(script);
        }).catch((error) => {
          leafletLoadPromise = null;
          throw error;
        });
      }

      return leafletLoadPromise;
    }

    async function syncManagementWorksiteMapUi() {
      if (
        currentPage !== "workspace"
        || state.currentWorkspaceView !== "management"
        || normalizeManagementSection(state.managementSection) !== "worksites"
        || !state.managementWorksiteModalOpen
      ) {
        destroyManagementMap();
        return;
      }

      let container = document.getElementById("management-worksite-map");

      if (!container) {
        destroyManagementMap();
        return;
      }

      const L = await ensureLeafletAssets();

      if (
        currentPage !== "workspace"
        || state.currentWorkspaceView !== "management"
        || normalizeManagementSection(state.managementSection) !== "worksites"
        || !state.managementWorksiteModalOpen
      ) {
        destroyManagementMap();
        return;
      }

      container = document.getElementById("management-worksite-map");

      if (!container) {
        destroyManagementMap();
        return;
      }

      if (managementMapContext.container !== container) {
        destroyManagementMap();

        const map = L.map(container, {
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([DEFAULT_WORKSITE_COORDS.lat, DEFAULT_WORKSITE_COORDS.lng], {
          draggable: true,
        }).addTo(map);

        const circle = L.circle([DEFAULT_WORKSITE_COORDS.lat, DEFAULT_WORKSITE_COORDS.lng], {
          color: "#2d63f5",
          fillColor: "#2d63f5",
          fillOpacity: 0.14,
          radius: 100,
          weight: 2,
        }).addTo(map);

        map.on("click", (event) => {
          syncManagementWorksiteDraftFromDom();
          setManagementWorksiteDraft({
            lat: Number(event.latlng?.lat || DEFAULT_WORKSITE_COORDS.lat),
            lng: Number(event.latlng?.lng || DEFAULT_WORKSITE_COORDS.lng),
          });
          updateManagementWorksiteFormFields();
          syncManagementWorksiteMapGeometry(false);
          notifyManagementWorksiteDraftInput();
          reverseGeocodeManagementWorksite(state.managementWorksiteDraft.lat, state.managementWorksiteDraft.lng, {
            updateName: !String(state.managementWorksiteDraft.name || "").trim(),
          }).catch(() => {});
        });

        marker.on("dragend", () => {
          const position = marker.getLatLng();
          syncManagementWorksiteDraftFromDom();
          setManagementWorksiteDraft({
            lat: Number(position?.lat || DEFAULT_WORKSITE_COORDS.lat),
            lng: Number(position?.lng || DEFAULT_WORKSITE_COORDS.lng),
          });
          updateManagementWorksiteFormFields();
          syncManagementWorksiteMapGeometry(false);
          notifyManagementWorksiteDraftInput();
          reverseGeocodeManagementWorksite(state.managementWorksiteDraft.lat, state.managementWorksiteDraft.lng, {
            updateName: !String(state.managementWorksiteDraft.name || "").trim(),
          }).catch(() => {});
        });

        managementMapContext = {
          circle,
          container,
          map,
          marker,
        };
      }

      syncManagementWorksiteDraftFromDom();
      syncManagementWorksiteMapGeometry(true);
      window.requestAnimationFrame(() => managementMapContext.map?.invalidateSize());
    }

    return Object.freeze({
      destroyManagementMap,
      ensureLeafletAssets,
      notifyManagementWorksiteDraftInput,
      syncManagementWorksiteMapGeometry,
      syncManagementWorksiteMapUi,
    });
  }

  return Object.freeze({ create });
});
