// Usage: node shots.mjs [stageIds,comma] [waitMs] [desktop|phone|both] [reduced]
import { chromium } from "playwright";
const only = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : null;
const wait = +(process.argv[3] || 3500), which = process.argv[4] || "both", reduced = process.argv[5] === "reduced";
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const browser = await chromium.launch();
const errors = [];
for (const [name, viewport] of Object.entries(sizes)) {
  if (which !== "both" && which !== name) continue;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: name === "phone" });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`${name}: ${e.message}`));
  await page.goto("http://localhost:8765/index.html");
  await page.waitForTimeout(800);
  const ids = await page.$$eval(".stage", els => els.map(e => e.id));
  for (const [i, id] of ids.entries()) {
    if (only && !only.includes(id.slice(2))) continue;
    await page.evaluate(id => { const e = document.getElementById(id); const top = e.getBoundingClientRect().top + scrollY; const off = innerWidth <= 820 ? innerHeight * 0.5 : (innerHeight - Math.min(e.offsetHeight, innerHeight)) / 2 ; scrollTo(0, id === "s-raw" ? 0 : top - (innerWidth <= 820 ? off - 20 : -(e.offsetHeight - innerHeight) / 2)); }, id);
    await page.waitForTimeout(1200);
    if (process.env.CLICK) for (let k = 0; k < +(process.env.CLICKN || 1); k++) { await page.click(process.env.CLICK); await page.waitForTimeout(+(process.env.CLICKGAP || 500)); }
    if (process.env.EVAL) await page.evaluate(process.env.EVAL);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `shots/${name}${reduced ? "-rm" : ""}-${String(i + 1).padStart(2, "0")}-${id.slice(2)}.png` });
  }
  if (!only) { const fps = await page.evaluate(() => Math.round(window.__field.fpsAcc)); console.log(name, "fps≈", fps, "N=", await page.evaluate(() => window.__field.N)); }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "console clean");
