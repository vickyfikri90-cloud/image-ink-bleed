window.initToggle = function initToggle(root, options = {}) {
  const field = root.querySelector('.toggle-field') || root;
  const labelEl = root.querySelector('.field-label');
  const rows = [...root.querySelectorAll('.toggle-row')];
  const onChange = options.onChange;

  if (!rows.length) {
    throw new Error('initToggle: missing toggle rows');
  }

  if (options.label && labelEl) {
    labelEl.textContent = options.label;
  }

  function applyRow(row, checked) {
    row.classList.toggle('is-on', checked);
    row.setAttribute('aria-checked', checked ? 'true' : 'false');
  }

  function isOn(row) {
    return row.classList.contains('is-on') || row.getAttribute('aria-checked') === 'true';
  }

  function bindRow(row, index) {
    applyRow(row, isOn(row));

    row.addEventListener('click', () => {
      if (row.disabled) return;

      const checked = !isOn(row);
      applyRow(row, checked);
      onChange?.(checked, row, index);
    });

    return {
      element: row,
      getChecked: () => isOn(row),
      setChecked(checked, shouldNotify = false) {
        applyRow(row, Boolean(checked));
        if (shouldNotify) onChange?.(Boolean(checked), row, index);
      },
      setDisabled(disabled) {
        row.disabled = Boolean(disabled);
        row.classList.toggle('is-disabled', Boolean(disabled));
      },
    };
  }

  const controls = rows.map(bindRow);
  const primary = controls[0];

  if (typeof options.checked === 'boolean') {
    primary.setChecked(options.checked);
  }

  if (typeof options.disabled === 'boolean') {
    primary.setDisabled(options.disabled);
  }

  if (options.rowLabel) {
    const text = primary.element.querySelector('.toggle-row__label');
    if (text) text.textContent = options.rowLabel;
  }

  return {
    element: field,
    rows: controls,
    getChecked: primary.getChecked,
    setChecked: primary.setChecked,
    setDisabled: primary.setDisabled,
  };
};
