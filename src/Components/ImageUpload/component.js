window.initImageUpload = function initImageUpload(root, options) {
  options = options || {};
  var utils = window.ComponentUtils;
  var field = root.querySelector('.image-upload') || root;
  var drop = root.querySelector('.image-upload__drop');
  var input = root.querySelector('input[type="file"]');
  var img = root.querySelector('[data-upload-image]');
  var nameEl = root.querySelector('[data-upload-name]');
  var metaEl = root.querySelector('[data-upload-meta]');
  var clearBtn = root.querySelector('[data-upload-clear]');
  var labelEl = root.querySelector('.field-label');
  if (!drop || !input || !img) throw new Error('initImageUpload: missing image upload elements');

  var accept = options.accept || input.getAttribute('accept') || 'image/*';
  input.setAttribute('accept', accept);
  var maxSize = options.maxSize;
  var onChange = options.onChange;
  var onError = options.onError;
  var state = null; // { file, url, name, owned }

  if (options.label && labelEl) labelEl.textContent = options.label;
  if (options.fit) img.style.objectFit = options.fit;
  utils.fillIcons(root);

  function release() {
    if (state && state.owned) URL.revokeObjectURL(state.url);
  }

  function render() {
    var filled = !!state;
    field.classList.toggle('is-filled', filled);
    drop.classList.toggle('is-filled', filled);
    if (filled) img.src = state.url; else img.removeAttribute('src');
    img.alt = filled ? state.name : '';
    if (nameEl) nameEl.textContent = filled ? state.name : '';
    if (metaEl) metaEl.textContent = filled && state.file ? utils.formatFileSize(state.file.size) : '';
    if (clearBtn) clearBtn.hidden = !filled;
  }

  function notify() {
    if (onChange) onChange(state ? state.file : null, state ? state.url : '');
  }

  function setFile(file, shouldNotify) {
    if (file && !utils.acceptMatches(file, accept)) { if (onError) onError('type', file); return false; }
    if (file && maxSize && file.size > maxSize) { if (onError) onError('size', file); return false; }
    release();
    state = file ? { file: file, url: URL.createObjectURL(file), name: file.name, owned: true } : null;
    render();
    if (shouldNotify !== false) notify();
    return true;
  }

  function setURL(url, name, shouldNotify) {
    release();
    state = url ? { file: null, url: url, name: name || 'Image', owned: false } : null;
    render();
    if (shouldNotify) notify();
  }

  utils.bindDropTarget(drop, input, function (files) { setFile(files[0]); });
  if (clearBtn) {
    clearBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      setFile(null);
    });
  }

  if (options.value) setURL(options.value, options.name, false);
  else render();

  return {
    element: field,
    input: input,
    getFile: function () { return state ? state.file : null; },
    getURL: function () { return state ? state.url : ''; },
    setFile: function (file, shouldNotify) { return setFile(file, shouldNotify === true); },
    setURL: setURL,
    clear: function (shouldNotify) { setFile(null, shouldNotify === true); },
  };
};
