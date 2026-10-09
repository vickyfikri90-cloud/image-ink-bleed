window.initControlPanel = function initControlPanel(root) {
  const panel = root.querySelector('[data-control-panel]')
    || root.querySelector('[data-cp-panel]')
    || root.querySelector('.panel')
    || root;

  return {
    element: panel,
    append(node) {
      panel.appendChild(node);
    },
    setHTML(html) {
      panel.innerHTML = html;
    },
  };
};
