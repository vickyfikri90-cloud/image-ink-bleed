window.initImageInkBleedExperiment = function initImageInkBleedExperiment() {
  const preview = document.querySelector('[data-experiment-preview="image-ink-bleed"]');
  const panelRoot = document.querySelector('[data-experiment-panel="image-ink-bleed"]');
  if (!preview || !panelRoot || preview.dataset.experimentReady === '1') return;

  const utils = window.ComponentUtils;
  const P = 'exp-image-ink-bleed';
  const byId = (suffix) => document.getElementById(`${P}-${suffix}`);
  const EMBED_MAX_SIDE = 1600;

  const INK_MODES = [
    { value: 'original', label: 'Original colors' },
    { value: 'ink', label: 'Solid ink' },
  ];
  const BACKGROUNDS = [
    { value: 'color', label: 'Paper color' },
    { value: 'transparent', label: 'Transparent' },
    { value: 'image', label: 'From image' },
  ];
  const DIRECTIONS = [
    { value: 'left', label: 'Left → Right' },
    { value: 'right', label: 'Right → Left' },
    { value: 'top', label: 'Top → Bottom' },
    { value: 'bottom', label: 'Bottom → Top' },
    { value: 'center', label: 'Center out' },
  ];
  const TRIGGERS = [
    { value: 'load', label: 'On load' },
    { value: 'view', label: 'When in view' },
  ];

  const defaultImage = createDefaultImage();
  // `src` drives the preview (object URL); `embedSrc` is the downscaled data URL used in the snippet.
  let image = { src: defaultImage, embedSrc: defaultImage, name: 'ink-bleed.png' };

  const ink = window.initInkBleedImage(preview, {
    src: image.src,
    autoplay: false,
    onFallback: () => { byId('notice').hidden = false; },
  });

  const controls = {
    alt: byId('alt'),
    width: byId('width'),
    seed: byId('seed'),
    duration: byId('duration'),
    delay: byId('delay'),
  };

  const upload = window.initImageUpload(byId('image-root'), {
    fit: 'contain',
    onChange: (file, url) => onImageChange(file, url),
  });

  const inkMode = window.initOptionSelector(byId('ink-mode-root'), { options: INK_MODES, value: 'original', onChange: () => applyAll() });
  const background = window.initOptionSelector(byId('background-root'), { options: BACKGROUNDS, value: 'color', onChange: () => applyAll() });
  const direction = window.initOptionSelector(byId('direction-root'), { options: DIRECTIONS, value: 'left', onChange: () => applyAll() });
  const trigger = window.initOptionSelector(byId('trigger-root'), { options: TRIGGERS, value: 'load', onChange: () => snippet.update() });
  const inkColor = window.initColorSelector(byId('ink-color-root'), { value: '111111', onChange: () => applyAll() });
  const paperColor = window.initColorSelector(byId('paper-color-root'), { value: 'F4F2EE', onChange: () => applyAll() });

  const sliderDefs = {
    threshold: { min: 5, max: 100, value: 90 },
    grain: { min: 0, max: 100, value: 0 },
    sweep: { min: 0, max: 100, value: 40 },
    spread: { min: 0, max: 100, value: 50 },
    roughness: { min: 0, max: 100, value: 50 },
    fiber: { min: 0, max: 100, value: 50 },
    feather: { min: 1, max: 50, value: 15 },
    ghost: { min: 0, max: 100, value: 35 },
    'noise-scale': { min: 1, max: 20, value: 4 },
  };
  const sliders = Object.fromEntries(Object.entries(sliderDefs).map(([key, def]) => [
    key,
    window.initSlider(byId(`${key}-root`), { ...def, step: 1, onChange: () => applyAll() }),
  ]));
  const scrub = window.initSlider(byId('scrub-root'), {
    min: 0,
    max: 100,
    step: 1,
    value: 60,
    onChange: (value) => ink.setProgress(value / 100),
  });

  const easing = window.initCubicBezierInput(byId('easing-root'), { onChange: () => replay() });
  const embed = window.initToggle(byId('embed-root'), { onChange: () => snippet.update() });

  const snippet = window.initSnippetOutput(byId('snippet-root'), {
    filename: 'image-ink-bleed.html',
    getContent: generateSnippet,
    updateOnInit: false,
  });

  utils.bindInputWrapInputs(panelRoot);

  [controls.alt, controls.width, controls.seed].forEach((input) => {
    input.addEventListener('input', () => applyAll());
  });
  [controls.width, controls.seed].forEach((input) => utils.bindNumericArrowKey(input, () => applyAll()));
  [controls.duration, controls.delay].forEach((input) => {
    input.addEventListener('input', () => replay());
    utils.bindNumericArrowKey(input, () => replay());
  });

  byId('restart').addEventListener('click', () => ink.play());

  function onImageChange(file, url) {
    if (!file || !url) {
      image = { src: defaultImage, embedSrc: defaultImage, name: 'ink-bleed.png' };
      replay();
      return;
    }
    const keepsAlpha = /png|webp|gif|svg/i.test(file.type);
    image = { src: url, embedSrc: '', name: file.name };
    replay();
    toEmbeddableDataUrl(url, keepsAlpha).then((dataUrl) => {
      if (image.src !== url) return;
      image.embedSrc = dataUrl;
      snippet.update();
    });
  }

  function sliderValue(key) {
    return sliders[key].getValue();
  }

  function getConfig() {
    return {
      src: image.src,
      alt: controls.alt.value,
      width: Math.max(0, Math.round(utils.parsePx(controls.width.value, 720))),
      duration: Math.max(0, utils.parseMs(controls.duration.value, 2400)),
      delay: Math.max(0, utils.parseMs(controls.delay.value, 0)),
      easingRaw: easing.getRaw() || '0.45, 0, 0.25, 1',
      trigger: trigger.getValue(),
      inkMode: inkMode.getValue(),
      inkColor: inkColor.getColor(),
      background: background.getValue(),
      paperColor: paperColor.getColor(),
      threshold: sliderValue('threshold') / 100,
      paperGrain: sliderValue('grain') / 100,
      direction: direction.getValue(),
      directionAmount: sliderValue('sweep') / 100,
      spread: sliderValue('spread') / 100,
      roughness: sliderValue('roughness') / 100,
      fiber: sliderValue('fiber') / 100,
      feather: sliderValue('feather') / 100,
      ghost: sliderValue('ghost') / 100,
      noiseScale: sliderValue('noise-scale'),
      seed: Number(controls.seed.value) || 0,
    };
  }

  function syncVisibility(config) {
    byId('ink-color-root').hidden = config.inkMode !== 'ink';
    byId('paper-color-root').hidden = config.background !== 'color';
  }

  // Look changes redraw the frame picked with "Preview progress" so tweaks are visible mid-bleed.
  function applyAll() {
    const config = getConfig();
    syncVisibility(config);
    ink.set(config).then(() => ink.setProgress(scrub.getValue() / 100));
    snippet.update();
  }

  // Timing / image changes replay the whole entrance.
  function replay() {
    const config = getConfig();
    syncVisibility(config);
    ink.set(config).then(() => ink.play());
    snippet.update();
  }

  function collectSettings() {
    return {
      alt: controls.alt.value,
      width: controls.width.value,
      seed: controls.seed.value,
      duration: controls.duration.value,
      delay: controls.delay.value,
      easing: easing.getRaw(),
      inkMode: inkMode.getValue(),
      background: background.getValue(),
      direction: direction.getValue(),
      trigger: trigger.getValue(),
      inkColor: { hex: inkColor.getHex(), opacity: inkColor.getOpacity() },
      paperColor: { hex: paperColor.getHex(), opacity: paperColor.getOpacity() },
      sliders: Object.fromEntries(Object.keys(sliders).map((key) => [key, sliderValue(key)])),
      scrub: scrub.getValue(),
      embed: embed.getChecked(),
    };
  }

  function applySettings(data) {
    if (!data) return;
    ['alt', 'width', 'seed', 'duration', 'delay'].forEach((key) => {
      if (data[key] != null) controls[key].value = data[key];
    });
    if (data.easing != null) easing.setRaw(data.easing, false);
    if (data.inkMode) inkMode.setValue(data.inkMode);
    if (data.background) background.setValue(data.background);
    if (data.direction) direction.setValue(data.direction);
    if (data.trigger) trigger.setValue(data.trigger);
    if (data.inkColor) inkColor.setValue(data.inkColor.hex, data.inkColor.opacity);
    if (data.paperColor) paperColor.setValue(data.paperColor.hex, data.paperColor.opacity);
    Object.entries(data.sliders || {}).forEach(([key, value]) => sliders[key]?.setValue(value, false));
    if (data.scrub != null) scrub.setValue(data.scrub, false);
    if (data.embed != null) embed.setChecked(data.embed);
  }

  window.ExperimentSettings = window.ExperimentSettings || {};
  window.ExperimentSettings['image-ink-bleed'] = {
    collect: collectSettings,
    apply: applySettings,
  };

  const pending = window.__pendingExperimentDefaults?.['image-ink-bleed'];
  if (pending) applySettings(pending);
  replay();

  // ── Images ──────────────────────────────────────────────────────────────

  // Built-in sample: italic calligraphy-style word, black ink on white (white is keyed to paper).
  function createDefaultImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b0b0b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 400 230px "Cormorant Garamond", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
    ctx.fillText('Michelangelo', canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  }

  function toEmbeddableDataUrl(url, keepsAlpha) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, EMBED_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!keepsAlpha) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(keepsAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  }

  // ── Snippet ─────────────────────────────────────────────────────────────

  function generateSnippet() {
    const config = getConfig();
    const embedImage = embed.getChecked();
    const src = embedImage ? (image.embedSrc || image.src) : image.name;
    const options = { ...config };
    delete options.src;
    // `<` is escaped so a closing script tag typed into the alt text cannot end the inline script.
    const json = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
    const fileNote = embedImage ? '' : `\n    // Put "${image.name.replace(/[\\"]/g, '')}" next to this HTML file (or change the path below).`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Ink Bleed</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
      background: #fff;
    }

${window.InkBleedImageSnippet?.css || ''}
  </style>
</head>
<body>
  <div class="ink-bleed">
    <canvas class="ink-bleed__canvas"></canvas>
    <img class="ink-bleed__fallback" alt="${utils.escapeHtml(config.alt)}">
  </div>

  <script>
${window.InkBleedImageSnippet?.js || ''}
  <\/script>
  <script>
    // Ink bleed entrance — WebGPU shader built on https://shaders.com (MIT).
    // Browsers without WebGPU get a plain fade-in of the same image.${fileNote}
    window.initInkBleedImage(document.querySelector('.ink-bleed'), ${json({ ...options, src }).replace(/\n/g, '\n    ')});
  <\/script>
</body>
</html>`;
  }

  preview.__expImageInkBleed = ink;
  preview.dataset.experimentReady = '1';
};
