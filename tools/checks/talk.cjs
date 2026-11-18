const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '../../talk/shots/');
const url = process.argv[2] || 'file://' + require('path').join(__dirname, '../../talk/index.html');
(async () => {
  const browser = await chromium.launch();
  const errs = [], reqs = [];
  async function open(w, h, touch) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    page.on('request', r => { if (!r.url().startsWith('data:')) reqs.push(r.url().replace(/.*unit-resolution\//, '')); });
    await page.goto(url); await page.waitForTimeout(600);
    return page;
  }
  const set = (page, id, v) => page.evaluate(([id, v]) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
  const say = async (page, tag) => console.log(tag.padEnd(8), '|', await page.textContent('#say'));
  const page = await open(1440, 900);
  const tapA = async (fx, fy) => { const b = await page.locator('#net-a').boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };
  await say(page, 'intro'); await page.screenshot({ path: dir + '00-intro.png' });
  await page.waitForTimeout(4300); await say(page, 'p1');
  await tapA(0.5, 0.45); await page.waitForTimeout(1250); await say(page, 'a1');
  await page.screenshot({ path: dir + '01-meant-and-spark.png' });
  await page.waitForTimeout(4700); await say(page, 'a2');
  await page.screenshot({ path: dir + '02-heard.png' });
  await page.waitForTimeout(4300); await say(page, 'p3');
  await set(page, 'slider-b', 0); await page.waitForTimeout(900);
  await tapA(0.5, 0.45); await page.waitForTimeout(3300); await say(page, 'a3');
  await page.screenshot({ path: dir + '03-second-mind-tight.png' });
  await page.waitForTimeout(1800); await say(page, 'p4');
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.6], [0.4, 0.75]]) { await tapA(x, y); await page.waitForTimeout(2300); }
  await say(page, 'a4'); await page.screenshot({ path: dir + '04-more-words.png' });
  await page.waitForTimeout(3800); await say(page, 'p5');
  await set(page, 'slider-a', 0); await set(page, 'slider-b', 1000); await page.waitForTimeout(1000);
  await tapA(0.5, 0.45); await page.waitForTimeout(3600); await say(page, 'a5');
  await page.screenshot({ path: dir + '05-first-tight-second-loose.png' });
  await page.waitForTimeout(3600); await say(page, 'end');
  await page.screenshot({ path: dir + '06-end.png' });
  // extra: second mind loose, several words
  await set(page, 'slider-a', 500); await set(page, 'slider-b', 720); await page.waitForTimeout(900);
  for (const [x, y] of [[0.5, 0.45], [0.55, 0.5], [0.45, 0.5]]) { await tapA(x, y); await page.waitForTimeout(2300); }
  await page.screenshot({ path: dir + '07-loose-several-words.png' });
  await page.close();
  const phone = await open(390, 800, true);
  await phone.waitForTimeout(4500);
  const b = await phone.locator('#net-a').boundingBox();
  await phone.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await phone.waitForTimeout(3600);
  await phone.screenshot({ path: dir + '08-phone.png' });
  console.log('phone   |', await phone.textContent('#say'));
  console.log('errors:', JSON.stringify(errs));
  console.log('requests:', JSON.stringify([...new Set(reqs)]));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
