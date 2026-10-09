#!/usr/bin/env node
// Builds index.html: the Experiment Tool control panel with only the Image Ink Bleed experiment.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (rel) => fs.readFileSync(path.join(root, 'src', rel), 'utf8');

const controls = ['ColorInput', 'ColorSelector', 'CubicBezierInput', 'ImageUpload', 'OptionSelector', 'Slider', 'SnippetOutput', 'Toggle', 'Tooltip'];

const styles = [
  'Components/shared/base.css',
  'Components/ControlPanel/component.css',
  ...controls.map((name) => `Components/${name}/component.css`),
  'Components/InkBleedImage/component.css',
].map(read).join('\n');

const scripts = [
  'Components/shared/icons.js',
  'Components/shared/utils.js',
  ...controls.map((name) => `Components/${name}/component.js`),
  'Components/InkBleedImage/component.js',
  'image-ink-bleed-snippet-embed.js',
  'image-ink-bleed-app.js',
  'app.js',
].map(read).join('\n').replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
  <title>Image Ink Bleed</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&family=Inter:wght@100..900&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, system-ui, sans-serif;
      background: #fff;
      overflow: hidden;
    }

${styles}
  </style>
</head>
<body>
${read('shell.html')}
  <script>
${scripts}
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
