window.initSnippetOutput = function initSnippetOutput(root, options = {}) {
  const output = root.querySelector('[data-snippet-output]');
  const downloadBtn = root.querySelector('[data-snippet-download]');
  const getContent = options.getContent || (() => '');
  const filename = options.filename || 'snippet.html';

  function update() {
    if (output) output.value = getContent();
  }

  downloadBtn?.addEventListener('click', () => {
    const blob = new Blob([getContent()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });

  if (options.updateOnInit !== false) {
    update();
  }

  return {
    element: root,
    output,
    update,
  };
};
