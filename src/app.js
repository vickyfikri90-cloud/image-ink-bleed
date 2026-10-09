(function () {
  const ID = 'image-ink-bleed';
  const STORAGE_KEY = `cp-kit-experiment-defaults-${ID}`;

  window.ExperimentSettings = window.ExperimentSettings || {};

  function loadDefaults() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  window.__pendingExperimentDefaults = { [ID]: loadDefaults() };

  document.getElementById('save-default-btn')?.addEventListener('click', () => {
    const settings = window.ExperimentSettings[ID]?.collect?.();
    if (!settings) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
    window.__pendingExperimentDefaults[ID] = settings;
  });

  window.initTooltip?.(document);
  window.initImageInkBleedExperiment?.();
})();
