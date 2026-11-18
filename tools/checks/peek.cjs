// usage: node peek.cjs <out.png> [w] [h] [js-file-of-steps]
const { chromium } = require('playwright');
(async () => {
  const [out, w = '1440', h = '900', steps] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  const errs = [], reqs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('request', r => { if (!r.url().startsWith('data:')) reqs.push(r.url()); });
  await page.goto('file://' + require('path').join(__dirname, '../../unit/index.html'));
  await page.waitForTimeout(600);
  if (steps) await require(steps)(page, out);
  else await page.screenshot({ path: out });
  console.log('errors:', JSON.stringify(errs));
  console.log('requests:', JSON.stringify(reqs.map(u => u.replace(/.*unit-resolution\//, ''))));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
