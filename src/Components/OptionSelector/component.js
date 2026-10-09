window.initOptionSelector = function initOptionSelector(root, options = {}) {
  const field = root.querySelector('.option-selector') || root;
  const wrap = root.querySelector('.option-selector__wrap');
  const input = root.querySelector('.option-selector__input');
  const menu = root.querySelector('.option-selector__menu');
  const labelEl = root.querySelector('.field-label');

  if (!wrap || !input || !menu) {
    throw new Error('initOptionSelector: missing option selector elements');
  }

  const defaultOptions = [
    'Achilees',
    'Matt Demon',
    'Odessey',
    'Christopher Nolan',
    'Christian Bale',
    'James Gunn',
    'Jason',
  ];

  const items = (options.options || defaultOptions).map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    return {
      value: item.value,
      label: item.label ?? String(item.value),
    };
  });

  const onChange = options.onChange;
  const escapeHtml = window.ComponentUtils?.escapeHtml || ((value) => String(value));

  let selectedValue = options.value ?? input.value ?? items[0]?.value ?? '';
  let filterActive = false;
  let activeIndex = 0;

  if (options.label && labelEl) {
    labelEl.textContent = options.label;
  }

  function selectedItem() {
    return items.find((item) => item.value === selectedValue)
      || items.find((item) => item.label === selectedValue)
      || null;
  }

  function selectedLabel() {
    return selectedItem()?.label ?? selectedValue;
  }

  input.value = selectedLabel();

  function getFiltered() {
    if (!filterActive) return items;

    const query = input.value.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => item.label.toLowerCase().includes(query));
  }

  function setActiveIndex(index) {
    const buttons = menu.querySelectorAll('.option-selector__option');
    if (!buttons.length) return;

    activeIndex = index;
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === activeIndex);
    });
    buttons[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function renderMenu() {
    const filtered = getFiltered();

    if (!filtered.length) {
      menu.innerHTML = '';
      wrap.classList.remove('is-menu-open');
      menu.classList.remove('is-open');
      return;
    }

    if (activeIndex >= filtered.length) {
      activeIndex = Math.max(filtered.length - 1, 0);
    }

    wrap.classList.add('is-menu-open');
    menu.classList.add('is-open');
    menu.innerHTML = filtered.map((item, index) => (
      `<button type="button" class="option-selector__option${index === activeIndex ? ' is-active' : ''}" role="option" data-index="${index}">${escapeHtml(item.label)}</button>`
    )).join('');
  }

  function isOpen() {
    return menu.classList.contains('is-open');
  }

  function openMenu() {
    document.dispatchEvent(new CustomEvent('option-selector:close-all', {
      detail: { except: wrap },
    }));
    renderMenu();
  }

  function closeMenu() {
    wrap.classList.remove('is-menu-open');
    menu.classList.remove('is-open');
    filterActive = false;
  }

  function commitSelection(item, shouldNotify = true) {
    if (!item) return;

    selectedValue = item.value;
    input.value = item.label;
    closeMenu();

    if (shouldNotify) onChange?.(item.value, item);
  }

  function selectActive() {
    const filtered = getFiltered();
    const item = filtered[activeIndex];
    if (item) commitSelection(item);
  }

  function revertToSelected() {
    input.value = selectedLabel();
    closeMenu();
  }

  window.ComponentUtils?.bindInputBehavior(input);

  input.addEventListener('focus', () => {
    filterActive = false;
    activeIndex = 0;
    openMenu();
  });

  input.addEventListener('input', () => {
    filterActive = true;
    activeIndex = 0;
    openMenu();
  });

  input.addEventListener('keydown', (event) => {
    const filtered = getFiltered();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen()) {
        activeIndex = 0;
        openMenu();
        return;
      }
      if (!filtered.length) return;
      setActiveIndex((activeIndex + 1) % filtered.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen()) {
        activeIndex = 0;
        openMenu();
        return;
      }
      if (!filtered.length) return;
      setActiveIndex((activeIndex - 1 + filtered.length) % filtered.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen()) selectActive();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      revertToSelected();
      input.blur();
    }
  });

  menu.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  menu.addEventListener('mousemove', (event) => {
    const option = event.target.closest('.option-selector__option');
    if (!option) return;

    const index = Number(option.dataset.index);
    if (Number.isNaN(index) || index === activeIndex) return;

    setActiveIndex(index);
  });

  menu.addEventListener('click', (event) => {
    const option = event.target.closest('.option-selector__option');
    if (!option) return;

    const filtered = getFiltered();
    commitSelection(filtered[Number(option.dataset.index)]);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.option-selector__wrap') === wrap) return;
    if (!isOpen()) return;
    revertToSelected();
  });

  document.addEventListener('option-selector:close-all', (event) => {
    if (event.detail?.except === wrap) return;
    if (isOpen()) revertToSelected();
  });

  return {
    element: field,
    input,
    getValue: () => selectedValue,
    getLabel: () => selectedLabel(),
    setValue(value, shouldNotify = false) {
      const match = items.find((item) => item.value === value)
        || items.find((item) => item.label === value);
      if (!match) return;
      commitSelection(match, shouldNotify);
    },
    openMenu,
    closeMenu: revertToSelected,
  };
};
