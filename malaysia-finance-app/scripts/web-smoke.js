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
    // Home's category tiles must form equal-width columns that fill the row at every screen size.
    for (const [w, h] of [[360, 740], [390, 844], [820, 1180], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(500);
      const problem = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="tile-grid"]');
        if (!grid) return 'no tile grid on Home';
        const g = grid.getBoundingClientRect();
        const cells = [...grid.querySelectorAll('[data-testid="tile-grid-cell"]')].map((c) => c.getBoundingClientRect());
        if (cells.length < 2) return null;
        const w0 = cells[0].width;
        if (cells.some((c) => Math.abs(c.width - w0) > 1)) return 'cells differ in width';
        const firstRow = cells.filter((c) => Math.abs(c.top - cells[0].top) < 2);
        if (firstRow.length < 2 && g.width >= 330) return `only ${firstRow.length} cell in the first row of a ${g.width}px grid`;
        if (cells.some((c) => c.left < g.left - 1 || c.right > g.right + 1)) return 'a cell sticks out of the grid';
        const right = Math.max(...firstRow.map((c) => c.right));
        if (firstRow.length === cells.length || firstRow.length >= 2) {
          const gap = firstRow.length > 1 ? firstRow[1].left - firstRow[0].right : 0;
          if (g.right - right > w0 / 2 + gap) return `the first row leaves ${Math.round(g.right - right)}px empty on the right`;
        }
        return null;
      });
      if (problem) errors.push(`Home tiles at ${w}px: ${problem}`);
    }
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
