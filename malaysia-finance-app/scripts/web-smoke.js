// Loads the exported web build in headless Chromium and fails on any uncaught error or blank page.
// Usage: npx expo export --platform web && node scripts/web-smoke.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../dist');
const wasm = path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

server.listen(0, async () => {
  const errors = [];
  let text = '';
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    // sql.js fetches its wasm from a CDN; serve the local copy so the check works offline.
    await page.route('**/cdn.jsdelivr.net/**', (r) => r.fulfill({ body: fs.readFileSync(wasm), contentType: 'application/wasm' }));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForTimeout(6000);
    text = (await page.innerText('body')).trim();
    await browser.close();
  } catch (e) {
    errors.push(String(e));
  }
  server.close();
  if (errors.length || text.length < 20) {
    console.error('Web smoke test failed.', errors, `Body text: "${text.slice(0, 100)}"`);
    process.exit(1);
  }
  console.log('Web smoke test passed.');
});
