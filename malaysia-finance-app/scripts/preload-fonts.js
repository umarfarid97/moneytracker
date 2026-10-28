// Run after `expo export --platform web`: adds <link rel="preload"> for the Manrope font files so the browser starts
// fetching them with the page instead of after the app has started. Usage: node scripts/preload-fonts.js
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '../dist');
const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const fonts = [...walk(path.join(dist, 'assets'))].filter((f) => /Manrope_(400Regular|500Medium|600SemiBold|700Bold)\.[0-9a-f]+\.ttf$/.test(f));
if (fonts.length === 0) {
  console.error('preload-fonts: no Manrope font files found in dist/assets');
  process.exit(1);
}
const links = fonts
  .map((f) => `<link rel="preload" href="${base}/${path.relative(dist, f).split(path.sep).join('/')}" as="font" type="font/ttf" crossorigin />`)
  .join('');
const file = path.join(dist, 'index.html');
const html = fs.readFileSync(file, 'utf8');
if (html.includes('rel="preload"')) process.exit(0);
fs.writeFileSync(file, html.replace('</head>', `${links}</head>`));
console.log(`preload-fonts: added ${fonts.length} preload links`);
