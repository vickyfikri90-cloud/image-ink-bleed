window.initCubicBezierInput = function initCubicBezierInput(root, options = {}) {
  const utils = window.ComponentUtils;
  const textInput = root.querySelector('[data-bezier-text]');
  const svg = root.querySelector('[data-bezier-svg]');
  const curve = root.querySelector('[data-bezier-curve]');
  const line1 = root.querySelector('[data-bezier-line1]');
  const line2 = root.querySelector('[data-bezier-line2]');
  const handleP1 = root.querySelector('[data-bezier-p1]');
  const handleP2 = root.querySelector('[data-bezier-p2]');
  const onChange = options.onChange;

  const PLOT = { left: 29, top: 25, width: 150, height: 150 };
  const Y_MIN = -0.5;
  const Y_MAX = 1.5;
  const DEFAULT_VALUES = [0.7, 0, 0.25, 1];

  let values = [...DEFAULT_VALUES];
  let dragging = null;

  function clampX(value) {
    return Math.min(1, Math.max(0, value));
  }

  function clampY(value) {
    return Math.min(Y_MAX, Math.max(Y_MIN, value));
  }

  function clampValues(nextValues) {
    return [
      clampX(nextValues[0]),
      clampY(nextValues[1]),
      clampX(nextValues[2]),
      clampY(nextValues[3]),
    ];
  }

  function roundValue(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? rounded : rounded;
  }

  function parseRaw(raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return [...DEFAULT_VALUES];

    let inner = trimmed;
    if (trimmed.startsWith('cubic-bezier(') && trimmed.endsWith(')')) {
      inner = trimmed.slice('cubic-bezier('.length, -1);
    }

    const parts = inner.split(',').map((part) => parseFloat(part.trim()));
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
      return clampValues(parts);
    }

    return null;
  }

  function formatRaw(nextValues) {
    return nextValues.map(roundValue).join(', ');
  }

  function formatCss(nextValues) {
    return `cubic-bezier(${nextValues.map(roundValue).join(', ')})`;
  }

  function getEasing() {
    const parsed = parseRaw(textInput?.value);
    if (parsed) return formatCss(parsed);

    const raw = textInput?.value.trim();
    if (!raw) return formatCss(DEFAULT_VALUES);
    if (raw.startsWith('cubic-bezier(')) return raw;
    return raw;
  }

  function bezierToSvg(x, y) {
    return {
      x: PLOT.left + x * PLOT.width,
      y: PLOT.top + (1 - y) * PLOT.height,
    };
  }

  function pointFromClient(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const local = point.matrixTransform(matrix.inverse());
    return {
      x: clampX((local.x - PLOT.left) / PLOT.width),
      y: clampY(1 - ((local.y - PLOT.top) / PLOT.height)),
    };
  }

  function updateVisual() {
    const [x1, y1, x2, y2] = values;
    const start = bezierToSvg(0, 0);
    const end = bezierToSvg(1, 1);
    const p1 = bezierToSvg(x1, y1);
    const p2 = bezierToSvg(x2, y2);

    curve.setAttribute(
      'd',
      `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`
    );

    line1.setAttribute('x1', start.x);
    line1.setAttribute('y1', start.y);
    line1.setAttribute('x2', p1.x);
    line1.setAttribute('y2', p1.y);

    line2.setAttribute('x1', end.x);
    line2.setAttribute('y1', end.y);
    line2.setAttribute('x2', p2.x);
    line2.setAttribute('y2', p2.y);

    handleP1.setAttribute('cx', p1.x);
    handleP1.setAttribute('cy', p1.y);
    handleP2.setAttribute('cx', p2.x);
    handleP2.setAttribute('cy', p2.y);

    handleP1.setAttribute('aria-valuetext', `${roundValue(x1)}, ${roundValue(y1)}`);
    handleP2.setAttribute('aria-valuetext', `${roundValue(x2)}, ${roundValue(y2)}`);
  }

  function setValues(nextValues, notify = true, updateText = true) {
    values = clampValues(nextValues);

    if (updateText && textInput) {
      textInput.value = formatRaw(values);
    }

    updateVisual();

    if (notify) onChange?.(getEasing());
  }

  function setRaw(raw, notify = true) {
    const parsed = parseRaw(raw);
    if (parsed) {
      setValues(parsed, notify, true);
      return true;
    }

    updateVisual();
    if (notify) onChange?.(getEasing());
    return false;
  }

  function updateFromText(notify = true, normalize = false) {
    const parsed = parseRaw(textInput?.value);
    if (!parsed) {
      if (notify) onChange?.(getEasing());
      return;
    }

    values = parsed;
    if (normalize && textInput) {
      textInput.value = formatRaw(values);
    }
    updateVisual();
    if (notify) onChange?.(getEasing());
  }

  function stopDragging() {
    if (!dragging) return;

    dragging.handle.classList.remove('is-dragging');
    dragging = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);

    if (textInput) textInput.value = formatRaw(values);
    onChange?.(getEasing());
  }

  function onPointerMove(event) {
    if (!dragging) return;

    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;

    const nextValues = [...values];
    if (dragging.index === 0) {
      nextValues[0] = point.x;
      nextValues[1] = point.y;
    } else {
      nextValues[2] = point.x;
      nextValues[3] = point.y;
    }

    setValues(nextValues, false, false);
  }

  function startDragging(handle, index, event) {
    event.preventDefault();
    dragging = { handle, index };
    handle.classList.add('is-dragging');
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  }

  function nudgeHandle(index, dx, dy) {
    const nextValues = [...values];
    nextValues[index * 2] = clampX(nextValues[index * 2] + dx);
    nextValues[index * 2 + 1] = clampY(nextValues[index * 2 + 1] + dy);
    setValues(nextValues, true, true);
  }

  function bindHandle(handle, index) {
    handle.addEventListener('pointerdown', (event) => startDragging(handle, index, event));

    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 0.05 : 0.01;
      let handled = false;

      if (event.key === 'ArrowLeft') {
        nudgeHandle(index, -step, 0);
        handled = true;
      } else if (event.key === 'ArrowRight') {
        nudgeHandle(index, step, 0);
        handled = true;
      } else if (event.key === 'ArrowUp') {
        nudgeHandle(index, 0, step);
        handled = true;
      } else if (event.key === 'ArrowDown') {
        nudgeHandle(index, 0, -step);
        handled = true;
      }

      if (handled) event.preventDefault();
    });
  }

  if (textInput) {
    utils.bindInputBehavior(textInput);
    textInput.addEventListener('input', () => updateFromText(true, false));
    textInput.addEventListener('change', () => updateFromText(true, true));
  }

  bindHandle(handleP1, 0);
  bindHandle(handleP2, 1);

  const initialRaw = options.value ?? textInput?.value ?? formatRaw(DEFAULT_VALUES);
  setRaw(initialRaw, false);

  return {
    element: root.querySelector('.cubic-bezier-field') || root,
    textInput,
    getRaw: () => textInput?.value.trim() ?? '',
    getValue: getEasing,
    getValues: () => [...values],
    setRaw,
    setValues: (x1, y1, x2, y2) => setValues([x1, y1, x2, y2]),
    updateUI: (notify = false) => setValues(values, notify, true),
  };
};
