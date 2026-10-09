// Ink bleed image entrance — a custom WebGPU filter built on the open-source `shaders` library
// (https://shaders.com, MIT). The image is revealed the way ink soaks into paper: dense cores first,
// a faint wet "ghost" ahead of the ink, ragged fibrous edges and an optional writing-direction sweep.
window.initInkBleedImage = function initInkBleedImage(root, options = {}) {
  const SHADERS_CDN = 'https://cdn.jsdelivr.net/npm/shaders@4.0.3/dist/';
  const DIRECTIONS = { left: 0, right: 1, top: 2, bottom: 3, center: 4 };
  const BACKGROUNDS = { color: 0, transparent: 1, image: 2 };
  const TERMINAL_ERRORS = new Set(['unsupported', 'no-adapter', 'no-device', 'init-failed', 'device-lost', 'out-of-memory', 'gpu-error', 'render-failed', 'limit-exceeded', 'unrecoverable', 'rebuild_failed']);

  const wrap = root.querySelector('.ink-bleed') || root;
  let canvas = wrap.querySelector('.ink-bleed__canvas');
  let fallback = wrap.querySelector('.ink-bleed__fallback');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'ink-bleed__canvas';
    wrap.appendChild(canvas);
  }
  if (!fallback) {
    fallback = document.createElement('img');
    fallback.className = 'ink-bleed__fallback';
    fallback.alt = '';
    wrap.appendChild(fallback);
  }

  const config = {
    src: '',
    alt: '',
    width: 0,
    duration: 2400,
    delay: 0,
    easingRaw: '0.45, 0, 0.25, 1',
    trigger: 'load',
    inkMode: 'original',
    inkColor: '#111111',
    background: 'color',
    paperColor: '#F4F2EE',
    threshold: 0.9,
    spread: 0.5,
    roughness: 0.5,
    fiber: 0.5,
    feather: 0.15,
    ghost: 0.35,
    noiseScale: 4,
    direction: 'left',
    directionAmount: 0.4,
    seed: 0,
    paperGrain: 0,
  };

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let shader = null;
  let shaderPaper = false;
  let building = null;
  let failed = false;
  let progress = 0;
  let frame = 0;
  let delayTimer = null;
  let idleTimer = null;
  let observer = null;
  let destroyed = false;
  let imageRatio = 1;

  // ── Shader library ──────────────────────────────────────────────────────

  function loadLibrary() {
    if (window.__inkBleedShaders) return window.__inkBleedShaders;
    window.__inkBleedShaders = (async () => {
      // The library's ESM files read `process.env.NODE_ENV` while evaluating; shim it just for the import.
      const shim = typeof globalThis.process === 'undefined';
      if (shim) globalThis.process = { env: { NODE_ENV: 'production' } };
      try {
        const [js, std] = await Promise.all([
          import(`${SHADERS_CDN}js/index.js`),
          import(`${SHADERS_CDN}core/std/index.js`),
        ]);
        return { createShader: js.createShader, isWebGPUSupported: js.isWebGPUSupported, InkBleed: defineInkBleed(std) };
      } finally {
        if (shim) delete globalThis.process;
      }
    })();
    return window.__inkBleedShaders;
  }

  function defineInkBleed(std) {
    const { defineShader, wgsl, transformColor } = std;
    return defineShader({
      name: 'InkBleed',
      props: {
        progress: { default: 0 },
        spread: { default: 0.5 },
        roughness: { default: 0.5 },
        fiber: { default: 0.5 },
        feather: { default: 0.15 },
        ghost: { default: 0.35 },
        noiseScale: { default: 4 },
        direction: { default: 0 },
        directionAmount: { default: 0.4 },
        threshold: { default: 0.9 },
        inkMode: { default: 0 },
        inkColor: { default: '#111111', transform: transformColor },
        paperColor: { default: '#f4f2ee', transform: transformColor },
        background: { default: 0 },
        seed: { default: 0 },
      },
      effect: wgsl({
        alpha: 'straight',
        body: `
  let asp = vec2f(aspect, 1.0);
  let lumW = vec3f(0.2126, 0.7152, 0.0722);
  let th = max(threshold, 0.001);
  let src = textureSample(childTexture, childSampler, uv);
  let srcRgb = select(vec3f(0.0), src.rgb / max(src.a, 0.0001), src.a > 0.0001);
  let srcLum = dot(srcRgb, lumW);
  let dens = clamp((th - srcLum) / th, 0.0, 1.0) * src.a;

  // Neighbourhood taps: blurred ink density (stroke cores), blurred colour (wet look),
  // and a wider ring that estimates the bare paper under the ink.
  let radius = spread * 0.06 / asp;
  let paperRadius = max(spread * 0.06, 0.05) / asp;
  var blurD = dens;
  var blurC = src;
  var wsum = 1.0;
  var paperSum = srcRgb * (1.0 - dens);
  var paperW = 1.0 - dens;
  var lightest = srcRgb;
  var lightLum = srcLum;
  for (var i = 0; i < 16; i++) {
    let fi = f32(i);
    let ang = fi * 2.39996323 + seed * 0.37;
    let rr = sqrt((fi + 0.5) / 16.0);
    let o = vec2f(cos(ang), sin(ang)) * rr * radius;
    let s = textureSampleLevel(childTexture, childSampler, uv + o, 0.0);
    let sRgb = select(vec3f(0.0), s.rgb / max(s.a, 0.0001), s.a > 0.0001);
    let w = 1.0 - rr * 0.6;
    blurD += clamp((th - dot(sRgb, lumW)) / th, 0.0, 1.0) * s.a * w;
    blurC += s * w;
    wsum += w;
    let po = vec2f(cos(ang + 1.3), sin(ang + 1.3)) * (0.7 + rr) * paperRadius;
    let ps = textureSampleLevel(childTexture, childSampler, uv + po, 0.0);
    let psRgb = select(vec3f(0.0), ps.rgb / max(ps.a, 0.0001), ps.a > 0.0001);
    let psLum = dot(psRgb, lumW);
    let psd = clamp((th - psLum) / th, 0.0, 1.0) * ps.a;
    let pw = (1.0 - psd) * (1.0 - psd);
    paperSum += psRgb * pw;
    paperW += pw;
    if (psLum > lightLum) {
      lightLum = psLum;
      lightest = psRgb;
    }
  }
  blurD /= wsum;
  blurC /= wsum;
  let paperEst = mix(lightest, paperSum / max(paperW, 0.0001), smoothstep(0.0, 1.5, paperW));

  // fbm value noise: the coarse field drives timing, the fine stretched field makes fibrous edges
  var q = uv * asp * noiseScale + vec2f(seed * 13.17, seed * 7.31);
  var q2 = uv * asp * noiseScale * vec2f(9.0, 4.0) + vec2f(seed * 3.7, 41.0);
  var nC = 0.0;
  var nF = 0.0;
  var amp = 0.5;
  for (var k = 0; k < 5; k++) {
    let i1 = floor(q);
    let f1 = fract(q);
    let u1 = f1 * f1 * (3.0 - 2.0 * f1);
    let a1 = fract(sin(dot(i1, vec2f(127.1, 311.7))) * 43758.5453);
    let b1 = fract(sin(dot(i1 + vec2f(1.0, 0.0), vec2f(127.1, 311.7))) * 43758.5453);
    let c1 = fract(sin(dot(i1 + vec2f(0.0, 1.0), vec2f(127.1, 311.7))) * 43758.5453);
    let d1 = fract(sin(dot(i1 + vec2f(1.0, 1.0), vec2f(127.1, 311.7))) * 43758.5453);
    nC += amp * mix(mix(a1, b1, u1.x), mix(c1, d1, u1.x), u1.y);
    let i2 = floor(q2);
    let f2 = fract(q2);
    let u2 = f2 * f2 * (3.0 - 2.0 * f2);
    let a2 = fract(sin(dot(i2, vec2f(269.5, 183.3))) * 43758.5453);
    let b2 = fract(sin(dot(i2 + vec2f(1.0, 0.0), vec2f(269.5, 183.3))) * 43758.5453);
    let c2 = fract(sin(dot(i2 + vec2f(0.0, 1.0), vec2f(269.5, 183.3))) * 43758.5453);
    let d2 = fract(sin(dot(i2 + vec2f(1.0, 1.0), vec2f(269.5, 183.3))) * 43758.5453);
    nF += amp * mix(mix(a2, b2, u2.x), mix(c2, d2, u2.x), u2.y);
    q = q * 2.03 + vec2f(1.7, 9.2);
    q2 = vec2f(q2.x * 2.01 + q2.y * 0.35, q2.y * 2.01 - q2.x * 0.35) + vec2f(5.3, 2.8);
    amp *= 0.5;
  }
  nC = clamp((nC - 0.47) * 2.4 + 0.5, 0.0, 1.0);
  nF = nF - 0.47;

  // Sweep coordinate: 0 left→right, 1 right→left, 2 top→bottom, 3 bottom→top, 4 centre out
  var dirC = uv.x;
  if (direction > 0.5 && direction < 1.5) { dirC = 1.0 - uv.x; }
  else if (direction > 1.5 && direction < 2.5) { dirC = uv.y; }
  else if (direction > 2.5 && direction < 3.5) { dirC = 1.0 - uv.y; }
  else if (direction > 3.5) { dirC = clamp(length((uv - 0.5) * asp) / (0.5 * length(asp)), 0.0, 1.0); }

  // Arrival time per pixel: dense cores first, organic noise, optional sweep. Bare paper waits.
  let inkiness = max(dens, blurD);
  let inkW = smoothstep(0.02, 0.25, inkiness);
  let core = 1.0 - clamp(mix(dens, blurD * 1.6, 0.6), 0.0, 1.0);
  var t = mix(core, nC, roughness);
  t = mix(t, dirC, directionAmount);
  t = clamp(t + nF * fiber * 0.35, 0.0, 1.0);
  t = mix(1.0, t, inkW);

  // A faint wet ghost leads; the ink itself follows "lag" behind it
  // (starts slightly ahead so the first ink shows early; fully settled at progress 1)
  let fe = max(feather, 0.001);
  let lag = 0.2;
  let head = 0.12;
  let P = head + progress * (1.0 + fe + lag - head);
  let fillMain = smoothstep(0.0, 1.0, (P - lag - t) / fe);
  let fillGhost = smoothstep(0.0, 1.0, (P - t) / fe);
  var amount = clamp(max(fillGhost * ghost, fillMain), 0.0, 1.0) * smoothstep(0.0, 0.08, progress);

  // Wet front pools darker; colour stays soft (blurred) until the ink settles
  let front = fillMain * (1.0 - fillMain) * 4.0 * (1.0 - progress);
  let blurRgb = select(vec3f(0.0), blurC.rgb / max(blurC.a, 0.0001), blurC.a > 0.0001);
  let settled = max(fillMain, 1.0 - inkW);
  var inkRgb = mix(blurRgb, srcRgb, settled);
  var inkA = mix(blurC.a, src.a, settled);
  if (inkMode > 0.5) {
    inkRgb = inkColor.rgb;
    inkA = mix(blurD, dens, fillMain) * inkColor.a;
  }
  inkRgb = inkRgb * (1.0 - front * 0.4);

  // Paper underneath: solid colour (0), transparent (1) or the image's own paper (2)
  var paperRgb = paperColor.rgb;
  var paperA = paperColor.a;
  if (background > 0.5 && background < 1.5) { paperA = 0.0; }
  if (background > 1.5) {
    paperRgb = paperEst;
    paperA = src.a;
    if (inkMode < 0.5) { amount = max(amount, 1.0 - inkW); }
  }

  // On a colour or transparent paper the source's white is paper: "colour to alpha" against white
  // keeps every ink tone exact (over white paper the final frame equals the source).
  if (background < 1.5 && inkMode < 0.5) {
    let wa = clamp(max(max(1.0 - inkRgb.r, 1.0 - inkRgb.g), 1.0 - inkRgb.b), 0.0, 1.0);
    inkRgb = clamp((inkRgb - (1.0 - wa)) / max(wa, 0.0001), vec3f(0.0), vec3f(1.0));
    inkA = inkA * wa;
  }
  let a = amount * inkA;
  let outA = a + paperA * (1.0 - a);
  let outRgb = (inkRgb * a + paperRgb * paperA * (1.0 - a)) / max(outA, 0.0001);
  return vec4f(outRgb, outA);
`,
      }),
    });
  }

  // ── Props ───────────────────────────────────────────────────────────────

  function inkProps() {
    return {
      progress,
      spread: config.spread,
      roughness: config.roughness,
      fiber: config.fiber,
      feather: config.feather,
      ghost: config.ghost,
      noiseScale: config.noiseScale,
      direction: DIRECTIONS[config.direction] ?? 0,
      directionAmount: config.directionAmount,
      threshold: config.threshold,
      inkMode: config.inkMode === 'ink' ? 1 : 0,
      inkColor: config.inkColor,
      paperColor: config.paperColor,
      background: BACKGROUNDS[config.background] ?? 0,
      seed: config.seed,
    };
  }

  function paperProps() {
    return { roughness: config.paperGrain, grainScale: 1.2, displacement: config.paperGrain * 0.3, seed: config.seed };
  }

  function buildPreset() {
    const ink = {
      type: 'InkBleed',
      id: 'ink',
      props: inkProps(),
      children: [{ type: 'ImageTexture', id: 'img', props: { url: config.src, objectFit: 'cover' } }],
    };
    if (config.paperGrain <= 0) return { components: [ink] };
    return { components: [{ type: 'Paper', id: 'paper', props: paperProps(), children: [ink] }] };
  }

  async function ensureShader() {
    const wantPaper = config.paperGrain > 0;
    if (shader && shaderPaper === wantPaper) return shader;
    if (building) return building;
    building = (async () => {
      try {
        if (!navigator.gpu) throw new Error('unsupported');
        const lib = await loadLibrary();
        if (!lib.isWebGPUSupported()) throw new Error('unsupported');
        shader?.destroy();
        shader = null;
        const instance = await lib.createShader(canvas, buildPreset(), {
          components: [lib.InkBleed],
          disableTelemetry: true,
          // Recoverable device losses rebuild themselves; only terminal reasons need the fallback.
          onError: (reason) => { if (TERMINAL_ERRORS.has(reason)) showFallback(reason); },
        });
        if (destroyed) { instance.destroy(); return null; }
        shader = instance;
        shaderPaper = wantPaper;
        wrap.classList.remove('is-fallback');
        return shader;
      } catch (error) {
        showFallback(error?.message || error);
        return null;
      } finally {
        building = null;
      }
    })();
    return building;
  }

  function showFallback(reason) {
    if (!failed) console.warn('[ink-bleed] WebGPU unavailable, showing plain image:', reason);
    failed = true;
    wrap.classList.add('is-fallback');
    renderFallback();
    options.onFallback?.(reason);
  }

  function renderFallback() {
    fallback.style.opacity = String(Math.min(1, progress * 1.4));
    fallback.style.filter = `blur(${((1 - Math.min(1, progress * 1.2)) * 8).toFixed(2)}px)`;
  }

  // Keep the GPU idle once the animation is done; wake it for any change.
  function wake() {
    clearTimeout(idleTimer);
    shader?.resume();
    idleTimer = setTimeout(() => { if (!frame) shader?.pause(); }, 400);
  }

  function pushProgress() {
    if (failed) { renderFallback(); return; }
    if (!shader) return;
    shader.update('ink', { progress });
    wake();
  }

  // ── Timing ──────────────────────────────────────────────────────────────

  function parseBezier(raw) {
    const parts = String(raw).replace(/cubic-bezier\(|\)/g, '').split(',').map((n) => parseFloat(n));
    return parts.length === 4 && parts.every(Number.isFinite) ? parts : [0.45, 0, 0.25, 1];
  }

  function bezierEase(x1, y1, x2, y2) {
    const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return (x) => {
      if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
      let lo = 0;
      let hi = 1;
      let t = x;
      for (let i = 0; i < 24; i++) {
        const cx = curve(x1, x2, t);
        if (Math.abs(cx - x) < 1e-5) break;
        if (cx < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return curve(y1, y2, t);
    };
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(delayTimer);
  }

  async function play() {
    stop();
    setProgressValue(0);
    await ensureShader();
    if (destroyed) return;
    pushProgress();
    if (motionQuery.matches) { setProgressValue(1); pushProgress(); return; }

    const ease = bezierEase(...parseBezier(config.easingRaw));
    delayTimer = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const linear = config.duration > 0 ? Math.min(1, (now - start) / config.duration) : 1;
        setProgressValue(ease(linear));
        pushProgress();
        frame = linear < 1 ? requestAnimationFrame(tick) : 0;
        if (!frame) wake();
      };
      frame = requestAnimationFrame(tick);
    }, Math.max(0, config.delay));
  }

  function setProgressValue(value) {
    progress = Math.min(1, Math.max(0, value));
  }

  async function setProgress(value) {
    stop();
    setProgressValue(value);
    await ensureShader();
    pushProgress();
  }

  // ── Image + layout ──────────────────────────────────────────────────────

  function measureImage(src) {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function applyLayout() {
    wrap.style.aspectRatio = String(imageRatio);
    wrap.style.maxWidth = config.width > 0 ? `${config.width}px` : '';
    fallback.alt = config.alt || '';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', config.alt || '');
  }

  async function set(next = {}) {
    const srcChanged = next.src != null && next.src !== config.src;
    const prevPaper = config.paperGrain > 0;
    Object.keys(next).forEach((key) => {
      if (key in config && next[key] != null) config[key] = next[key];
    });
    if (srcChanged) {
      const src = config.src;
      fallback.src = src;
      const ratio = await measureImage(src);
      // A newer image may have been set while this one was loading.
      if (src !== config.src) return;
      if (ratio) imageRatio = ratio;
    }
    applyLayout();
    if (!shader || failed) return;
    if (prevPaper !== config.paperGrain > 0) {
      await ensureShader();
      pushProgress();
      return;
    }
    shader.update('ink', inkProps());
    if (srcChanged) shader.update('img', { url: config.src });
    if (config.paperGrain > 0) shader.update('paper', paperProps());
    wake();
  }

  function watchTrigger() {
    observer?.disconnect();
    observer = null;
    if (config.trigger === 'manual') { ensureShader().then(pushProgress); return; }
    if (config.trigger === 'view' && 'IntersectionObserver' in window) {
      ensureShader().then(pushProgress);
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        observer = null;
        play();
      }, { threshold: 0.35 });
      observer.observe(wrap);
      return;
    }
    play();
  }

  // A paused shader ignores layout changes, so resync its size and wake it to redraw.
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(() => {
    if (!shader) return;
    shader.resize();
    wake();
  }) : null;
  resizeObserver?.observe(wrap);

  function destroy() {
    destroyed = true;
    stop();
    clearTimeout(idleTimer);
    observer?.disconnect();
    resizeObserver?.disconnect();
    shader?.destroy();
    shader = null;
  }

  const ready = set(options).then(() => {
    if (options.autoplay !== false) watchTrigger();
  });

  return {
    element: wrap,
    ready,
    set,
    play,
    setProgress,
    getProgress: () => progress,
    isFallback: () => failed,
    destroy,
  };
};
