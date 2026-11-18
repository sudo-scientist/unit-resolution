// Act III — when minds meet. Also the shared wall and packets reused in Act IV.
import { WARM, COOL, PALE, rgba, lerp, clamp, smooth, rnd, glowStroke } from "./field.js";
import { circle } from "./scenes-1.js";

// ----- the shared layer: a wall of hardened, default-shaped slots -----
export function makeWall(f, count, h, x = f.R.cx) {
  const R = f.R, slots = []; for (let i = 0; i < count; i++) slots.push({ y: R.y + R.h * (i + 0.5) / count, h });
  return { x, slots, top: R.y, bottom: R.y + R.h };
}
export function drawWall(f, g, wall, color = COOL) {
  g.save();
  let y = wall.top; g.beginPath();
  for (const s of [...wall.slots].sort((a, b) => a.y - b.y)) {
    g.moveTo(wall.x, y); g.lineTo(wall.x, s.y - s.h / 2);
    for (const e of [-1, 1]) { g.moveTo(wall.x - 9, s.y + e * s.h / 2); g.lineTo(wall.x + 9, s.y + e * s.h / 2); }
    y = s.y + s.h / 2;
  }
  g.moveTo(wall.x, y); g.lineTo(wall.x, wall.bottom); glowStroke(g, color, 0.9, 2); g.restore();
}
// a packet of material: `pts` are unit-disk offsets; kind "open" is loose and detailed, "set" is one compact node
export function makePacket(seed, n, o) {
  const pts = []; for (let j = 0; j < n; j++) { const a = rnd(seed + j, 61) * 6.2832, r = Math.sqrt(rnd(seed + j, 62)); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return { pts, counted: false, ...o };
}
export const fitOf = (pk, wall) => clamp(wall.slots[pk.slot].h / (2 * pk.r), 0.08, 1);
export const shedOf = (pk, wall) => pk.kind === "set" ? 0 : pk.pts.filter(p => Math.abs(p[1]) > fitOf(pk, wall)).length;
export function drawPacket(f, g, pk, u, wall) {
  const s = wall.slots[pk.slot], x = lerp(pk.sx, pk.dx, u), dir = Math.sign(pk.dx - pk.sx), d = (x - wall.x) * dir;
  const y = d < 0 ? lerp(pk.sy, s.y, smooth(0.05, 0.42, u)) : lerp(s.y, pk.dy, smooth(0.58, 0.95, u));
  g.globalCompositeOperation = "lighter";
  if (pk.kind === "set") { g.drawImage(f.spr.cool, x - 15, y - 15, 30, 30); g.globalCompositeOperation = "source-over"; return; }
  const r = pk.r, fit = fitOf(pk, wall), q = clamp(1 - Math.abs(d) / (r * 2.6)), sy = d < 0 ? lerp(1, fit, smooth(0, 1, q)) : fit, sx = 1 + q * 0.7 * (1 - fit);
  const cool = d > 0 ? smooth(0, r * 2, d) * (1 - fit * 0.9) : 0;
  for (const p of pk.pts) {
    const shed = Math.abs(p[1]) > fit;
    if (shed && d > -r * 0.7) { // trimmed at the slot: falls away as a ghost
      const k = d + r * 0.7, a = clamp(1 - k / (r * 5)) * 0.7; if (a <= 0) continue;
      g.globalAlpha = a; g.drawImage(f.spr.pale, wall.x - dir * (10 + Math.abs(p[0]) * 12) - 4, s.y + Math.sign(p[1]) * (s.h / 2 + 5 + k * 0.45 * Math.abs(p[1])) - 4, 8, 8); continue;
    }
    const px = x + p[0] * r * sx, py = y + p[1] * r * sy;
    g.globalAlpha = 0.9 * (1 - cool); g.drawImage(f.spr.warm, px - 5, py - 5, 10, 10);
    if (cool > 0.02) { g.globalAlpha = 0.9 * cool; g.drawImage(f.spr.cool, px - 5, py - 5, 10, 10); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  g.beginPath(); g.ellipse(x, y, r * sx + 5, Math.max(3, r * sy + 5), 0, 0, 6.2832); g.strokeStyle = rgba(d > 0 ? COOL : WARM, 0.28 + q * 0.4); g.lineWidth = 1 + q; g.stroke();
}
// two minds facing each other: left keeps more open, right sets fast
export function twoMinds(f, ha = 0.14, hb = 0.95, gap = 0.5) {
  const R = f.R, r = Math.min(R.w * (0.25 - gap * 0.08), R.h * 0.42), ax = R.x + r + 2, bx = R.x + R.w - r - 2, n = Math.floor(f.N * 0.42 / 4);
  f.minds = [{ x: ax, y: R.cy, r, a: 0.14 }, { x: bx, y: R.cy, r, a: 0.14 }];
  const off = [[0, -0.5], [-0.5, 0.05], [0.42, 0.1], [-0.05, 0.58]];
  f.setClusters([...off.map(o => ({ x: ax + o[0] * r, y: R.cy + o[1] * r, r: r * 0.25, n, hard: ha, mind: 0 })), ...off.map(o => ({ x: bx - o[0] * r, y: R.cy + o[1] * r, r: r * 0.25, n, hard: hb, mind: 1 }))], 0);
  return { ax, bx, r };
}

export const gap = {
  enter(f, api) { f.jitter = 0.8; this.pk = []; this.cost = 0; this.last = -9; this.k = 0; if (api.melt > 0.3) api.setMelt(0.15); this.layout(f); },
  melt(f, v) { f.setMelt(lerp(0.06, 1, v), 0); },
  layout(f) {
    this.g = twoMinds(f, lerp(0.06, 1, f.api.melt)); const pr = this.pr = Math.max(16, f.R.s * 0.075);
    this.wall = makeWall(f, f.phone ? 3 : 5, pr * 0.5);
    if (f.reduced) { this.pk = [0.28, 0.5, 0.74].map((u, i) => ({ ...this.spawn(f, i, "open"), u })).concat([{ ...this.spawn(f, 7, "set"), u: 0.4 }]); this.cost = this.pk.reduce((s, p) => s + (p.u >= 0.5 ? shedOf(p, this.wall) : 0), 0); }
  },
  spawn(f, k, kind) {
    const w = this.wall, slot = k % w.slots.length, a = f.clusters[k % 4], b = f.clusters[4 + (k + 1) % 4], open = kind === "open";
    return makePacket(k * 50, 34, { kind, r: open ? this.pr * lerp(1, 0.4, smooth(0.4, 1, f.api.melt)) : this.pr, slot, sx: open ? a.x : b.x, sy: open ? a.y : b.y, dx: open ? b.x : a.x, dy: open ? b.y : a.y, t: f.st, dur: open ? 5.2 : 1.7 });
  },
  update(f, dt, st) {
    if (f.reduced) return;
    if (st - this.last > 1.25) { this.last = st; this.k++; this.pk.push(this.spawn(f, this.k, this.k % 2 ? "open" : "set")); }
    for (const p of this.pk) { p.u = (st - p.t) / p.dur; if (!p.counted && p.u > 0.5) { p.counted = true; this.cost += shedOf(p, this.wall); } }
    this.pk = this.pk.filter(p => p.u < 1);
  },
  draw(f, g) {
    drawWall(f, g, this.wall); for (const p of this.pk) drawPacket(f, g, p, clamp(p.u), this.wall);
    const { ax, bx, r } = this.g, y = f.R.cy + r + 14;
    f.tag("a", f.api.melt < 0.5 ? "keeps more open" : "now setting faster", ax, y, "warm"); f.tag("b", "sets fast", bx, y, ""); f.tag("w", "shared layer", this.wall.x, f.R.y - 14, "");
    f.api.readout(`Translation cost <b>${this.cost}</b> points shed · paid by one side<span class="meter"><i style="width:${clamp(this.cost / 400) * 100}%"></i></span>`);
  },
};

// ----- misreading -----
const SENT = ["“Could you put your climbing gear away?”", "An explanation of what she meant", "A careful request"];
const GOT = ["“You’re messy.”", "“You’re wrong about what you felt.”", "A lecture"];
const N = 42;
function srcShape(i) { // detailed, loosely bound
  return Array.from({ length: N }, (_, j) => { const t = j / N;
    if (i % 3 === 0) { const a = t * 11; return [Math.cos(a) * (0.2 + t * 0.8), Math.sin(a) * (0.2 + t * 0.8)]; }
    if (i % 3 === 1) { const a = t * 6.2832; return [Math.sin(a * 2) * 0.95, Math.sin(a * 3) * 0.7]; }
    const a = t * 6.2832 * 3; return [Math.cos(a) * (j % 3 ? 0.95 : 0.4), Math.sin(a) * (j % 3 ? 0.6 : 0.25) + Math.cos(t * 20) * 0.15]; });
}
function dstShape(i, labelled) { // re-clustered on arrival: a few blunt corners
  const k = labelled ? 1 : [3, 2, 4][i % 3];
  return Array.from({ length: N }, (_, j) => { if (k === 1) return [(rnd(j, 71) - 0.5) * 0.12, (rnd(j, 72) - 0.5) * 0.12]; const a = (j % k) / k * 6.2832 - Math.PI / 2 + (k === 4 ? 0.785 : 0); return [Math.cos(a) * 0.6 + (rnd(j, 73) - 0.5) * 0.08, Math.sin(a) * 0.6 + (rnd(j, 74) - 0.5) * 0.08]; });
}
export const misreading = {
  enter(f, api) { f.jitter = 0.7; this.msgs = []; this.count = 0; this.labelAt = -1; this.box = api.figure("transcript"); if (this.box) this.box.innerHTML = `<div class="k">Nothing sent yet. Press send.</div>`; this.layout(f); },
  melt(f, v) { f.setMelt(lerp(0.06, 1, v), 0); },
  layout(f) { this.g = twoMinds(f, lerp(0.06, 1, Math.min(f.api.melt, 0.2)), 0.95, 0.7); if (this.labelAt >= 0) this.labelAt = 0; },
  button(f, id) {
    if (id !== "send") return; const i = this.count++, labelled = this.labelAt >= 0;
    this.msgs.push({ i, t: f.st, a: srcShape(i), b: dstShape(i, labelled), labelled }); if (this.msgs.length > 2) this.msgs.shift();
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<div><span class="k">Sent ${i + 1}</span><span class="sent">${SENT[i % 3]}</span></div><div><span class="k">Arrived</span><span class="got">${labelled ? "“sensitive”" : GOT[i % 3]}</span></div>`;
    if (i === 0) this.box.innerHTML = ""; this.box.prepend(row); while (this.box.children.length > 4) this.box.lastChild.remove();
    if (this.count === 3) this.labelAt = f.reduced ? 0 : f.st + 3.1; // after three sends, the word sets
  },
  draw(f, g, st) {
    const { ax, bx, r } = this.g, y0 = f.R.cy, sr = Math.max(20, r * 0.34), on = this.labelAt >= 0 && st >= this.labelAt;
    for (const m of this.msgs) {
      const u = f.reduced ? 1 : clamp((st - m.t) / 3), last = m === this.msgs[this.msgs.length - 1]; if (!last && (u >= 1 || f.reduced)) continue;
      const x0 = ax + r * 0.55, x1 = bx - r * 0.55, mo = m.labelled ? smooth(0.2, 0.36, u) : smooth(0.52, 0.88, u), e = smooth(0, 1, u);
      const draw = (cx, cy, k, alpha) => { g.globalCompositeOperation = "lighter"; for (let j = 0; j < N; j++) { const px = cx + lerp(m.a[j][0], m.b[j][0], k) * sr, py = cy + lerp(m.a[j][1], m.b[j][1], k) * sr; g.globalAlpha = alpha * (1 - k); g.drawImage(f.spr.warm, px - 5, py - 5, 10, 10); g.globalAlpha = alpha * k; g.drawImage(f.spr.cool, px - 6, py - 6, 12, 12); } g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; };
      if (f.reduced) { draw(lerp(x0, x1, 0.18), y0 - sr * 1.5, 0, 1); draw(lerp(x0, x1, 0.82), y0 - sr * 1.5, 1, 1); }
      else draw(lerp(x0, x1, e), y0 - Math.sin(e * Math.PI) * sr * 1.3, mo, u < 1 ? 1 : clamp(1 - (st - m.t - 3) / 2.5));
      if (f.reduced) { f.tag("s", "sent", lerp(x0, x1, 0.18), y0 - sr * 2.9, "warm"); f.tag("g", "arrived", lerp(x0, x1, 0.82), y0 - sr * 2.9, ""); }
    }
    if (on) { const k = f.reduced ? 1 : clamp((st - this.labelAt) * 3); circle(g, ax, y0, r * lerp(1.5, 1.08, smooth(0, 1, k))); glowStroke(g, COOL, 0.95, 3, 1.5 + (1 - k) * 2); f.tag("lab", "“sensitive”", ax, y0 - r * 1.08 - 18, "big"); }
    f.tag("a", "Maven", ax, y0 + r * 1.08 + 16, "warm"); f.tag("b", "Shiloh", bx, y0 + r * 1.08 + 16, "");
    f.api.readout(this.count === 0 ? "Press send" : on ? "Every message now arrives as the same shape" : `<b>${this.count}</b> sent · each one re-clustered on arrival`);
  },
};
