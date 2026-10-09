(function () {
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  function hexToRgb(hex) {
    var h = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function rgbToHex(r, g, b) {
    return [r, g, b].map(function (n) {
      var s = Math.round(clamp(n, 0, 255)).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('').toUpperCase();
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }

  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  /*
   * One EyeDropper session per page, always ended explicitly.
   * On macOS, Chrome's picker runs as a separate helper process (ColorSampler). If the page
   * or iframe goes away while a pick is still open (reload, hot reload, tab closed, preview
   * torn down) the helper can be left running. So every pick gets an AbortController, and we
   * abort it on: pick finished, a second pick, popover closed, component destroyed, page
   * hidden / unloaded / frozen, and after a safety timeout.
   */
  var EYEDROPPER_TIMEOUT = 30000;
  var eyePick = null; // { controller, timer, owner }

  function endEyedropper() {
    var pick = eyePick;
    if (!pick) return;
    eyePick = null;
    clearTimeout(pick.timer);
    try { pick.controller.abort(); } catch (e) { /* already settled */ }
    if (pick.owner) pick.owner();
  }

  function startEyedropper(onPick, onEnd) {
    endEyedropper();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (!controller) return Promise.reject(new Error('AbortController unavailable'));
    var pick = { controller: controller, timer: 0, owner: onEnd };
    pick.timer = setTimeout(endEyedropper, EYEDROPPER_TIMEOUT);
    eyePick = pick;
    return new window.EyeDropper().open({ signal: controller.signal }).then(function (result) {
      if (eyePick === pick && result && result.sRGBHex) onPick(result.sRGBHex);
    }).catch(function () { /* cancelled: Escape, abort or timeout */ }).then(function () {
      if (eyePick === pick) endEyedropper();
    });
  }

  if (!window.__kitEyedropperGuards) {
    window.__kitEyedropperGuards = true;
    window.addEventListener('pagehide', endEyedropper);
    window.addEventListener('beforeunload', endEyedropper);
    document.addEventListener('freeze', endEyedropper);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') endEyedropper();
    });
  }

  window.initColorSelector = function initColorSelector(root, options) {
    options = options || {};
    var utils = window.ComponentUtils;
    var field = root.querySelector('.color-selector') || root;
    var wrap = root.querySelector('.color-selector__wrap');
    var trigger = root.querySelector('[data-color-trigger]');
    var swatch = root.querySelector('[data-color-swatch]');
    var hexInput = root.querySelector('[data-color-hex]');
    var opacityInput = root.querySelector('[data-color-opacity]');
    var popover = root.querySelector('.color-selector__popover');
    var sv = root.querySelector('[data-color-sv]');
    var svThumb = sv && sv.querySelector('.color-selector__thumb');
    var hue = root.querySelector('[data-color-hue]');
    var hueThumb = hue && hue.querySelector('.color-selector__thumb');
    var alpha = root.querySelector('[data-color-alpha]');
    var alphaThumb = alpha && alpha.querySelector('.color-selector__thumb');
    var alphaFill = root.querySelector('.color-selector__alpha-fill');
    var hInput = root.querySelector('[data-color-h]');
    var sInput = root.querySelector('[data-color-s]');
    var bInput = root.querySelector('[data-color-b]');
    var eyedropBtn = root.querySelector('[data-color-eyedropper]');
    var labelEl = root.querySelector('.field-label');
    if (!wrap || !trigger || !hexInput || !popover || !sv || !hue) {
      throw new Error('initColorSelector: missing color selector elements');
    }

    var onChange = options.onChange;
    if (options.label && labelEl) labelEl.textContent = options.label;

    var start = hexToRgb(options.value || hexInput.value) || { r: 0, g: 0, b: 0 };
    var hsv = rgbToHsv(start.r, start.g, start.b);
    var a = clamp(utils.parseOpacity(options.opacity != null ? options.opacity : (opacityInput ? opacityInput.value : 100), 1), 0, 1);

    function hex() { var c = hsvToRgb(hsv.h, hsv.s, hsv.v); return rgbToHex(c.r, c.g, c.b); }
    function getColor() { return utils.colorWithOpacity('#' + hex(), a); }

    function render(updateText) {
      var h = hex();
      var pure = hsvToRgb(hsv.h, 1, 1);
      var pureHex = '#' + rgbToHex(pure.r, pure.g, pure.b);
      if (swatch) swatch.style.background = getColor();
      sv.style.backgroundColor = pureHex;
      svThumb.style.left = (hsv.s * 100) + '%';
      svThumb.style.top = ((1 - hsv.v) * 100) + '%';
      svThumb.style.background = '#' + h;
      hueThumb.style.left = (hsv.h / 360 * 100) + '%';
      hueThumb.style.background = pureHex;
      if (alpha) {
        alphaFill.style.background = 'linear-gradient(90deg, rgba(0,0,0,0), #' + h + ')';
        alphaThumb.style.left = (a * 100) + '%';
        alphaThumb.style.background = getColor();
        alpha.setAttribute('aria-valuenow', String(Math.round(a * 100)));
      }
      sv.setAttribute('aria-valuetext', 'Saturation ' + Math.round(hsv.s * 100) + '%, brightness ' + Math.round(hsv.v * 100) + '%');
      hue.setAttribute('aria-valuenow', String(Math.round(hsv.h)));
      if (updateText !== false) {
        var focused = document.activeElement;
        if (focused !== hexInput) hexInput.value = h;
        if (opacityInput && focused !== opacityInput) opacityInput.value = String(Math.round(a * 100));
        if (hInput && focused !== hInput) hInput.value = String(Math.round(hsv.h));
        if (sInput && focused !== sInput) sInput.value = String(Math.round(hsv.s * 100));
        if (bInput && focused !== bInput) bInput.value = String(Math.round(hsv.v * 100));
      }
    }

    function commit(notify) {
      render();
      if (notify !== false && onChange) onChange(getColor(), { hex: '#' + hex(), opacity: Math.round(a * 100) });
    }

    function setHex(value, notify) {
      var rgb = hexToRgb(value);
      if (!rgb) return false;
      var next = rgbToHsv(rgb.r, rgb.g, rgb.b);
      // Keep the current hue for greys so the hue strip doesn't jump to red.
      if (!next.s || !next.v) next.h = hsv.h;
      hsv = next;
      commit(notify);
      return true;
    }

    /* H / S / B number fields: H 0–360, S and B 0–100 */
    function bindChannel(input, max, apply) {
      if (!input) return;
      utils.bindInputBehavior(input);
      var fromInput = function () {
        var n = parseFloat(String(input.value).trim());
        if (!Number.isFinite(n)) return;
        var c = clamp(n, 0, max);
        if (c !== n) input.value = String(Math.round(c));
        apply(c);
        commit();
      };
      input.addEventListener('input', fromInput);
      utils.bindNumericArrowKey(input, fromInput);
      input.addEventListener('blur', function () { render(); });
    }
    bindChannel(hInput, 360, function (v) { hsv.h = Math.min(v, 359.999); });
    bindChannel(sInput, 100, function (v) { hsv.s = v / 100; });
    bindChannel(bInput, 100, function (v) { hsv.v = v / 100; });

    /* drag areas */
    function drag(area, onPoint) {
      function at(event) {
        var r = area.getBoundingClientRect();
        onPoint(clamp((event.clientX - r.left) / (r.width || 1), 0, 1), clamp((event.clientY - r.top) / (r.height || 1), 0, 1));
      }
      function move(event) { at(event); }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        area.classList.remove('is-dragging');
      }
      area.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        area.focus();
        area.classList.add('is-dragging');
        at(event);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }

    drag(sv, function (x, y) { hsv.s = x; hsv.v = 1 - y; commit(); });
    drag(hue, function (x) { hsv.h = Math.min(x * 360, 359.999); commit(); });
    if (alpha) drag(alpha, function (x) { a = Math.round(x * 100) / 100; commit(); });

    function keys(area, handler) {
      area.addEventListener('keydown', function (event) {
        var big = event.shiftKey ? 10 : 1;
        var dx = event.key === 'ArrowRight' ? big : event.key === 'ArrowLeft' ? -big : 0;
        var dy = event.key === 'ArrowUp' ? big : event.key === 'ArrowDown' ? -big : 0;
        if (!dx && !dy) return;
        event.preventDefault();
        handler(dx, dy);
        commit();
      });
    }
    keys(sv, function (dx, dy) { hsv.s = clamp(hsv.s + dx / 100, 0, 1); hsv.v = clamp(hsv.v + dy / 100, 0, 1); });
    keys(hue, function (dx, dy) { hsv.h = clamp(hsv.h + dx + dy, 0, 359.999); });
    if (alpha) keys(alpha, function (dx, dy) { a = clamp(Math.round(a * 100 + dx + dy) / 100, 0, 1); });

    /* text inputs */
    utils.bindInputBehavior(hexInput);
    hexInput.addEventListener('input', function () {
      var rgb = hexToRgb(hexInput.value);
      if (!rgb) return;
      var next = rgbToHsv(rgb.r, rgb.g, rgb.b);
      if (!next.s || !next.v) next.h = hsv.h;
      hsv = next;
      render(false);
      if (onChange) onChange(getColor(), { hex: '#' + hex(), opacity: Math.round(a * 100) });
    });
    hexInput.addEventListener('change', function () { render(); });
    hexInput.addEventListener('blur', function () { render(); });
    if (opacityInput) {
      utils.bindInputBehavior(opacityInput);
      var fromOpacity = function () {
        a = utils.parseOpacity(opacityInput.value, a);
        render(false);
        if (onChange) onChange(getColor(), { hex: '#' + hex(), opacity: Math.round(a * 100) });
      };
      opacityInput.addEventListener('input', fromOpacity);
      utils.bindNumericArrowKey(opacityInput, fromOpacity, { isOpacity: true });
      opacityInput.addEventListener('blur', function () { render(); });
    }

    /* eyedropper — uses the browser EyeDropper API (Chrome, Edge, Opera) */
    if (eyedropBtn) {
      var eyeImg = eyedropBtn.querySelector('img');
      if (eyeImg && !eyeImg.getAttribute('src') && window.ComponentIcons) eyeImg.src = window.ComponentIcons.eyedropper || '';
      if (typeof window.EyeDropper !== 'function') {
        eyedropBtn.disabled = true;
        eyedropBtn.classList.add('is-disabled');
        eyedropBtn.setAttribute('data-tooltip', 'Eyedropper isn\u2019t supported in this browser');
      } else {
        var eyeOff = function () {
          eyedropBtn.classList.remove('is-active');
          eyedropBtn.setAttribute('aria-pressed', 'false');
        };
        eyedropBtn.addEventListener('click', function (event) {
          event.preventDefault();
          // A second click cancels the pick instead of starting another one.
          if (eyedropBtn.classList.contains('is-active')) { endEyedropper(); return; }
          eyedropBtn.classList.add('is-active');
          eyedropBtn.setAttribute('aria-pressed', 'true');
          startEyedropper(function (value) { setHex(value); }, eyeOff);
        });
      }
    }

    /* open / close */
    function isOpen() { return popover.classList.contains('is-open'); }
    function open() {
      if (isOpen()) return;
      document.dispatchEvent(new CustomEvent('dimension-menu:close-all'));
      document.dispatchEvent(new CustomEvent('option-selector:close-all'));
      document.dispatchEvent(new CustomEvent('color-selector:close-all', { detail: { except: wrap } }));
      popover.classList.add('is-open');
      wrap.classList.add('is-menu-open');
      trigger.setAttribute('aria-expanded', 'true');
      render();
    }
    function ownsPick() { return !!(eyePick && eyedropBtn && eyedropBtn.classList.contains('is-active')); }
    function close(returnFocus) {
      if (ownsPick()) endEyedropper();
      if (!isOpen()) return;
      popover.classList.remove('is-open');
      wrap.classList.remove('is-menu-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      if (isOpen()) close(); else open();
    });
    wrap.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(true); }
    });
    function onDocClick(event) {
      if (event.target.closest('.color-selector__wrap') === wrap) return;
      close();
    }
    function onCloseAll(event) {
      if (event.detail && event.detail.except === wrap) return;
      close();
    }
    function onOtherMenu() { close(); }
    document.addEventListener('click', onDocClick);
    document.addEventListener('color-selector:close-all', onCloseAll);
    document.addEventListener('dimension-menu:close-all', onOtherMenu);
    document.addEventListener('option-selector:close-all', onOtherMenu);

    render();

    return {
      element: field,
      hexInput: hexInput,
      opacityInput: opacityInput,
      getColor: getColor,
      getHex: function () { return '#' + hex(); },
      getOpacity: function () { return Math.round(a * 100); },
      setValue: function (value, opacity, notify) {
        if (opacity != null) a = clamp(utils.parseOpacity(opacity, a), 0, 1);
        if (!setHex(value, notify === true)) render();
      },
      /** Re-reads the hex and opacity inputs (ColorInput-compatible). */
      updateUI: function (notify) {
        if (opacityInput) a = clamp(utils.parseOpacity(opacityInput.value, a), 0, 1);
        if (!setHex(hexInput.value, notify !== false)) commit(notify);
      },
      open: open,
      close: function () { close(); },
      /** Ends any eyedropper pick and removes document listeners. Call before removing the element. */
      destroy: function () {
        if (ownsPick()) endEyedropper();
        close();
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('color-selector:close-all', onCloseAll);
        document.removeEventListener('dimension-menu:close-all', onOtherMenu);
        document.removeEventListener('option-selector:close-all', onOtherMenu);
      },
    };
  };

  /** Ends the page's eyedropper pick, if any (e.g. before a hot reload or route change). */
  window.cancelKitEyedropper = endEyedropper;
})();
