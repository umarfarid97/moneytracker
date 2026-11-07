// Real browser touch input: a row must scroll vertically, swipe horizontally and still open on tap.
async function spendingTouchSmoke(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${base}/demo`);
    await page.getByRole('button', { name: 'Load demo data', exact: true }).click();
    await page.getByText('Demo data loaded.', { exact: true }).waitFor();
    await page.goto(`${base}/spending`);
    const row = page.getByTestId('swipe-row').first();
    await row.waitFor();
    // Demo banners can put the first row below the tab bar. Start on a genuinely visible card.
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const cdp = await context.newCDPSession(page);
    const scrollTop = () => row.evaluate(el => {
      while (el && !(el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      if (!el) throw new Error('No spending scroller');
      return el.scrollTop;
    });
    const drag = async (x, y, dx, dy) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 15; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 15, y: y + dy * i / 15 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(400);
    };
    let box = await row.boundingBox();
    const before = await scrollTop();
    await drag(box.x + box.width / 2, box.y + box.height / 2, 8, -190);
    if ((await scrollTop()) < before + 80) throw new Error('Vertical touch drag on a spending card did not scroll');

    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    box = await row.boundingBox();
    await drag(box.x + box.width - 20, box.y + box.height / 2, -160, 0);
    const exposed = await row.getByRole('button', { name: 'Delete', exact: true }).evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    if (!exposed) throw new Error('Horizontal swipe did not expose Delete');

    await drag(box.x + 60, box.y + box.height / 2, 180, 0);
    await row.getByTestId('spending-note').tap();
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await context.close();
  }
}

module.exports = { spendingTouchSmoke };
