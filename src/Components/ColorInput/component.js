window.initColorInput = function initColorInput(root, options = {}) {
  const utils = window.ComponentUtils;
  const hexInput = root.querySelector('[data-color-hex]');
  const opacityInput = root.querySelector('[data-color-opacity]');
  const swatch = root.querySelector('[data-color-swatch]');
  const preview = root.querySelector('[data-color-preview]');
  const onChange = options.onChange;

  function getColor() {
    return utils.colorWithOpacity(hexInput.value, opacityInput.value);
  }

  function updateUI(notify = true) {
    const color = getColor();
    if (swatch) swatch.style.background = color;
    if (preview) preview.style.background = color;
    if (notify) onChange?.(color);
  }

  utils.bindInputBehavior(hexInput);
  utils.bindInputBehavior(opacityInput);

  hexInput?.addEventListener('input', () => updateUI());
  opacityInput?.addEventListener('input', () => updateUI());

  if (opacityInput) {
    utils.bindNumericArrowKey(opacityInput, () => updateUI(), { isOpacity: true });
  }

  updateUI(false);

  return {
    element: root,
    hexInput,
    opacityInput,
    getColor,
    getHex: () => utils.normalizeHex(hexInput.value),
    updateUI,
  };
};
