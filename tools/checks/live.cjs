// usage: node live.cjs <base-url>   Loads home, talk/ and old/ at phone size with touch.
const { chromium } = require('playwright');
const base = process.argv[2].replace(/\/?$/, '/');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  for (const path of ['', 'talk/', 'old/']) {
    const page = await ctx.newPage(); const errs = [], bad = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const res = await page.goto(base + path + '?v=' + Date.now(), { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    let ran = '';
    if (path === '') {
      await page.tap('#together'); await page.waitForTimeout(4700); await page.tap('#see'); await page.waitForTimeout(1500);
      const intro = (await page.textContent('#intro')).trim().slice(0, 40);
      const c = await page.locator('#net').boundingBox(); await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height * 0.4); await page.waitForTimeout(900);
      ran = 'intro "' + intro + '…" then: ' + await page.textContent('#say');
    } else if (path === 'talk/') {
      const c = await page.locator('#net-a').boundingBox(); await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2); await page.waitForTimeout(900);
      ran = await page.textContent('#say');
    } else ran = 'title "' + await page.title() + '", canvas: ' + await page.locator('canvas').count();
    console.log(('/' + path).padEnd(7), res.status(), '| robots:', await page.locator('meta[name=robots]').count(), '|', ran, '| errors:', JSON.stringify(errs), JSON.stringify(bad));
    await page.screenshot({ path: require('os').tmpdir() + '/live-' + (path.replace('/', '') || 'home') + '.png' });
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
