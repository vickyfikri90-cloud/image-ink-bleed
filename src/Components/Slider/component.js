window.initSlider = function initSlider(root, options = {}) {
  const utils = window.ComponentUtils;
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const step = options.step ?? 1;
  const tickCount = options.tickCount ?? 0;
  const onChange = options.onChange;

  const input = root.querySelector('.slider-value-input');
  const track = root.querySelector('.slider-track');
  const fill = root.querySelector('.slider-fill');
  const thumb = root.querySelector('.slider-thumb');

  if (!input || !track || !fill || !thumb) {
    throw new Error('initSlider: missing slider elements');
  }

  let dragging = false;

  function clamp(value) {
    return Math.min(max, Math.max(min, value));
  }

  function parseValue(raw) {
    const n = parseFloat(String(raw).trim());
    return Number.isFinite(n) ? clamp(n) : min;
  }

  const defaultValue = parseValue(options.value ?? input.value);

  function getTickValues() {
    if (tickCount < 2) return null;

    return Array.from({ length: tickCount }, (_, index) => (
      min + (index / (tickCount - 1)) * (max - min)
    ));
  }

  function snapToTick(value) {
    const ticks = getTickValues();
    if (!ticks) return value;

    let nearest = ticks[0];
    let nearestDistance = Math.abs(value - nearest);

    ticks.forEach((tick) => {
      const distance = Math.abs(value - tick);
      if (distance < nearestDistance) {
        nearest = tick;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  function formatValue(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function toPercent(value) {
    if (max === min) return 0;
    return ((value - min) / (max - min)) * 100;
  }

  function setValue(raw, shouldNotify = true) {
    let value = parseValue(raw);
    const ticks = getTickValues();

    if (ticks) {
      value = snapToTick(value);
    } else if (step > 0) {
      value = Math.round((value - min) / step) * step + min;
      value = clamp(value);
    }

    input.value = formatValue(value);
    const percent = toPercent(value);
    fill.style.width = `${percent}%`;
    thumb.style.left = `${percent}%`;

    if (shouldNotify) onChange?.(value);
    return value;
  }

  function valueFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    const value = min + ratio * (max - min);
    return setValue(value);
  }

  function getCurrentTickIndex() {
    const ticks = getTickValues();
    if (!ticks) return -1;

    const current = parseValue(input.value);
    let index = ticks.findIndex((tick) => Math.abs(tick - current) < 0.001);
    if (index !== -1) return index;

    let nearestIndex = 0;
    let nearestDistance = Math.abs(current - ticks[0]);
    ticks.forEach((tick, tickIndex) => {
      const distance = Math.abs(current - tick);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = tickIndex;
      }
    });

    return nearestIndex;
  }

  function stopDragging() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    valueFromClientX(event.clientX);
  }

  track.addEventListener('pointerdown', (event) => {
    if (event.target === thumb) return;
    valueFromClientX(event.clientX);
  });

  thumb.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    thumb.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  });

  thumb.addEventListener('dblclick', (event) => {
    event.preventDefault();
    setValue(defaultValue);
  });

  input.addEventListener('input', () => {
    setValue(input.value);
  });

  input.addEventListener('change', () => {
    setValue(input.value);
  });

  if (tickCount >= 2) {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      const ticks = getTickValues();
      if (!ticks) return;

      event.preventDefault();

      let index = getCurrentTickIndex();
      index += event.key === 'ArrowUp' ? 1 : -1;
      index = Math.min(ticks.length - 1, Math.max(0, index));
      setValue(ticks[index]);
    });
  } else {
    utils.bindNumericArrowKey(input, () => setValue(input.value));
  }

  setValue(defaultValue, false);

  return {
    element: root.querySelector('.slider-field')
      || root.querySelector('.slider-tick-field')
      || root,
    input,
    track,
    getTickValues,
    getValue: () => parseValue(input.value),
    getDefaultValue: () => defaultValue,
    resetToDefault: () => setValue(defaultValue),
    setValue,
  };
};
