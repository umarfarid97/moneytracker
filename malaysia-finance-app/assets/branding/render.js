// Renders the SVG sources in this folder to the PNGs Expo uses. Run: node assets/branding/render.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..', 'images');
const jobs = [
  ['icon', 'icon.png', 1024, false],
  ['foreground', 'android-icon-foreground.png', 512, true],
  ['background', 'android-icon-background.png', 512, false],
  ['monochrome', 'android-icon-monochrome.png', 432, true],
  ['foreground', 'splash-icon.png', 512, true],
  ['favicon', 'favicon.png', 96, true],
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [src, name, size, alpha] of jobs) {
    const svg = fs.readFileSync(path.join(here, src + '.svg'), 'utf8');
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</div></body>`);
    await p.screenshot({ path: path.join(out, name), omitBackground: alpha });
  }
  await b.close();
})();
