import { chromium } from "playwright";
const url = "https://sudo-scientist.github.io/unit-resolution/";
const b = await chromium.launch(), errs = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const p = await b.newPage({ viewport });
  p.on("console", m => m.type() === "error" && errs.push(m.text())); p.on("pageerror", e => errs.push(e.message));
  p.on("requestfailed", r => errs.push("failed: " + r.url()));
  await p.goto(url, { waitUntil: "networkidle" });
  const n = await p.$$eval(".stage", e => e.length);
  for (const id of ["s-melt", "s-labels", "s-sandbox"]) { await p.evaluate(id => document.getElementById(id).scrollIntoView({ behavior: "instant", block: "center" }), id); await p.waitForTimeout(2500); }
  console.log(viewport.width, "stages:", n, "active:", await p.textContent("#map-toggle"), "fps:", await p.evaluate(() => Math.round(__field.fpsAcc)));
  if (viewport.width > 1000) await p.screenshot({ path: "shots/live.png" });
}
await b.close(); console.log(errs.length ? errs.join("\n") : "live console clean");
