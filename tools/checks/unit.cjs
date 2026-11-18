const { chromium } = require('playwright');
const dir = require('path').join(__dirname, '../../unit/shots/');
const url = process.argv[2] || 'file://' + require('path').join(__dirname, '../../unit/index.html');
(async () => {
  const browser = await chromium.launch();
  const errs = [], reqs = [];
  async function open(w, h) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    page.on('request', r => { if (!r.url().startsWith('data:')) reqs.push(r.url().replace(/.*unit-resolution\//, '')); });
    await page.goto(url); await page.waitForTimeout(500);
    return page;
  }
  const set = (page, v) => page.evaluate(v => { const s = document.getElementById('slider'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const say = async (page, tag) => console.log(tag.padEnd(10), '|', await page.textContent('#say'));
  const shades = page => page.evaluate(() => [...document.querySelectorAll('.patch')].map(p => getComputedStyle(p).backgroundColor).join(' = '));

  const page = await open(1440, 900);
  await page.screenshot({ path: dir + '01-beat-one-before.png' });
  console.log('patches before:', await shades(page));
  const a = await page.locator('#patch-a').boundingBox(), b = await page.locator('#patch-b').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + 10, b.y + b.height / 2 + 30, { steps: 30 }); await page.mouse.up();
  await page.waitForTimeout(4500);
  await page.screenshot({ path: dir + '02-beat-one-after.png' });
  console.log('patches after: ', await shades(page), '| fault:', await page.evaluate(() => document.documentElement.dataset.fault || 'none'));
  await page.click('#see'); await page.waitForTimeout(1500);
  await page.screenshot({ path: dir + '03-intro.png' });
  console.log('intro      |', (await page.textContent('#intro')).trim()); await say(page, 'p1');
  await page.mouse.click(720, 360); await page.waitForTimeout(650);
  await page.screenshot({ path: dir + '04-middle.png' }); await say(page, 'a1');
  console.log('intro hidden:', await page.evaluate(() => new Promise(r => setTimeout(() => r(document.getElementById('intro').hidden), 800))));
  await page.waitForTimeout(4200); await say(page, 'p2');
  await set(page, 0); await page.waitForTimeout(1300); await say(page, 'a2');
  await page.screenshot({ path: dir + '05-tight.png' });
  // before the guide introduces it, touching a lit group again only touches it
  await page.mouse.click(720, 360); await page.waitForTimeout(500); await page.mouse.click(720, 360); await page.waitForTimeout(700);
  await say(page, 'early');
  await page.waitForTimeout(7200); await say(page, 'p3');
  for (let n = 0; n < 2; n++) {
    await page.click('#touch'); await page.waitForTimeout(2000);
    const t = await page.textContent('#say');
    await page.screenshot({ path: dir + (t.startsWith('See') ? '07-inside-odd-one.png' : '06-inside-nothing-odd.png') });
    console.log('inside     |', t);
    await page.waitForTimeout(4600); await say(page, n ? 'p5' : 'p4');
  }
  for (const v of [250, 330, 400]) { await set(page, v); await page.waitForTimeout(1100); await page.mouse.click(720, 360); await page.waitForTimeout(350); await page.screenshot({ path: v === 250 ? dir + '08-halfway-gaps.png' : require('path').join(require('os').tmpdir(), 'gap') + v + '.png' }); }
  await set(page, 500); await page.waitForTimeout(1300); await say(page, 'a5');
  await page.screenshot({ path: dir + '09-back-to-middle-pulse.png' });
  await page.waitForTimeout(7500); await say(page, 'p6');
  await set(page, 1000); await page.waitForTimeout(1600); await say(page, 'a6');
  await page.screenshot({ path: dir + '10-loose.png' });
  await page.waitForTimeout(6500); await say(page, 'end1');
  await page.waitForTimeout(6300); await say(page, 'end2');
  await page.waitForTimeout(6400); await say(page, 'end3');
  await page.waitForTimeout(8700); await say(page, 'end4');
  await page.waitForTimeout(5800); await say(page, 'done');
  const body = await page.evaluate(() => document.body.innerText + ' ' + document.documentElement.outerHTML);
  for (const w of ['situation', 'All at once', 'Everywhere', 'ready to use', 'belonged']) console.log('old text "' + w + '":', body.includes(w) ? 'FOUND' : 'absent');
  await page.close();

  const phone = await open(390, 800);
  await phone.screenshot({ path: dir + '11-phone-beat-one.png' });
  await phone.click('#together'); await phone.waitForTimeout(4600); await phone.click('#see'); await phone.waitForTimeout(1500);
  await phone.screenshot({ path: dir + '12-phone-intro.png' });
  await phone.click('#touch'); await phone.waitForTimeout(600); await phone.click('#skip'); await set(phone, 0); await phone.waitForTimeout(1500);
  await phone.screenshot({ path: dir + '13-phone-tight.png' });
  await set(phone, 250); await phone.waitForTimeout(1300);
  await phone.screenshot({ path: dir + '14-phone-halfway.png' });
  console.log('errors:', JSON.stringify(errs));
  console.log('requests:', JSON.stringify([...new Set(reqs)]));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
