(function initPageAssetLoader(globalScope) {
  const manifest = globalScope.WorkMateAssetManifest;

  if (!manifest || typeof manifest.getPageScripts !== "function") {
    throw new Error("client/boot/asset-manifest.js must be loaded before client/boot/load-page-assets.js.");
  }

  function appendScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadCurrentPageAssets() {
    const currentPage = document.body?.dataset.page || "";
    const scripts = manifest.getPageScripts(currentPage);

    for (const src of scripts) {
      await appendScript(src);
    }
  }

  loadCurrentPageAssets().catch((error) => {
    console.error(error);
    window.alert("페이지 자산을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
  });
})(window);
