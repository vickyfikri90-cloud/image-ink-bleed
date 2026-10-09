(function () {
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var tip = null;
  var tipText = null;
  var current = null;
  var showTimer = 0;
  var uid = 0;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'kit-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.id = 'kit-tooltip';
    tipText = document.createElement('span');
    tipText.className = 'kit-tooltip__text';
    tip.appendChild(tipText);
    document.body.appendChild(tip);
    return tip;
  }

  function place(target, placement) {
    var gap = 6;
    var r = target.getBoundingClientRect();
    var t = tip.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var fits = {
      top: r.top - t.height - gap >= 4,
      bottom: r.bottom + t.height + gap <= vh - 4,
      left: r.left - t.width - gap >= 4,
      right: r.right + t.width + gap <= vw - 4,
    };
    var opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    var p = fits[placement] ? placement : (fits[opposite[placement]] ? opposite[placement] : placement);
    var x, y;
    if (p === 'top' || p === 'bottom') {
      x = r.left + r.width / 2 - t.width / 2;
      y = p === 'top' ? r.top - t.height - gap : r.bottom + gap;
    } else {
      x = p === 'left' ? r.left - t.width - gap : r.right + gap;
      y = r.top + r.height / 2 - t.height / 2;
    }
    var cx = clamp(x, 4, vw - t.width - 4);
    var cy = clamp(y, 4, vh - t.height - 4);
    tip.style.left = Math.round(cx) + 'px';
    tip.style.top = Math.round(cy) + 'px';
    tip.dataset.placement = p;
    // keep the arrow pointing at the target when the bubble was clamped
    if (p === 'top' || p === 'bottom') tip.style.setProperty('--kit-tooltip-arrow', Math.round(r.left + r.width / 2 - cx) + 'px');
    else tip.style.setProperty('--kit-tooltip-arrow', Math.round(r.top + r.height / 2 - cy) + 'px');
  }

  function show(target) {
    var text = target.getAttribute('data-tooltip');
    if (!text) return;
    ensureTip();
    clearTimeout(showTimer);
    current = target;
    tipText.textContent = text;
    tip.classList.add('is-open');
    if (!target.id) target.id = 'kit-tooltip-target-' + (++uid);
    target.setAttribute('aria-describedby', tip.id);
    place(target, target.getAttribute('data-tooltip-placement') || 'top');
  }

  function hide() {
    clearTimeout(showTimer);
    if (!tip) return;
    tip.classList.remove('is-open');
    if (current) current.removeAttribute('aria-describedby');
    current = null;
  }

  window.initTooltip = function initTooltip(root, options) {
    options = options || {};
    root = root || document;
    var delay = options.delay != null ? options.delay : 400;
    var scope = root === document ? document.documentElement : root;
    if (scope.__kitTooltip) return scope.__kitTooltip;

    function targetOf(event) {
      var el = event.target.closest && event.target.closest('[data-tooltip]');
      return el && scope.contains(el) ? el : null;
    }

    scope.addEventListener('pointerover', function (event) {
      var el = targetOf(event);
      if (!el || el === current) return;
      clearTimeout(showTimer);
      // Moving between tooltip targets swaps instantly; the first one waits.
      if (current) show(el);
      else showTimer = setTimeout(function () { show(el); }, delay);
    });
    scope.addEventListener('pointerout', function (event) {
      var el = targetOf(event);
      if (!el) return;
      if (event.relatedTarget && el.contains(event.relatedTarget)) return;
      hide();
    });
    scope.addEventListener('focusin', function (event) {
      var el = targetOf(event);
      if (el && el.matches(':focus-visible')) show(el);
    });
    scope.addEventListener('focusout', function (event) { if (targetOf(event)) hide(); });
    scope.addEventListener('pointerdown', function () { hide(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);

    var controller = {
      element: scope,
      attach: function (el, text, placement) {
        el.setAttribute('data-tooltip', text);
        if (placement) el.setAttribute('data-tooltip-placement', placement);
        return el;
      },
      show: function (el) { show(el); },
      hide: hide,
    };
    scope.__kitTooltip = controller;
    return controller;
  };
})();
