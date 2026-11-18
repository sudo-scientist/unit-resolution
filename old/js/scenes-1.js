// Act I — how meaning forms
import { WARM, COOL, PALE, rgba, lerp, clamp, smooth, rnd, glowStroke } from "./field.js";

// k cluster centres laid out inside the view rect: a ring, with a centre once there are six or more
export function spots(f, k, rx = 0.36, ry = 0.36) {
  const R = f.R, out = [], ring = k >= 6 ? k - 1 : k;
  if (k === 1) return [[R.cx, R.cy]];
  if (k >= 6) out.push([R.cx, R.cy]);
  for (let i = 0; i < ring; i++) { const a = -Math.PI / 2 + (i + 0.5) / ring * 6.2832; out.push([R.cx + Math.cos(a) * R.w * rx, R.cy + Math.sin(a) * R.h * ry]); }
  return out;
}
export const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 6.2832); };

export const raw = {
  enter(f) { f.scatter(false); f.jitter = 1; },
  layout(f) { for (const p of f.points) p.free = null; },
};

export const units = {
  enter(f, api) { f.jitter = 0.6; this.apply(f, api.val("match")); },
  layout(f) { this.apply(f, this.v); },
  change(f, id, v) { if (id === "match") this.apply(f, v); },
  button(f, id) { // keyboard path for the drag: carry the next stray to the nearest unit
    if (id !== "offer") return; const p = f.points.find(p => p.c < 0 && !p.offered); if (!p) return; p.offered = true;
    const c = f.clusters.reduce((a, b) => Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a); p.x = c.x + c.r * 1.25; p.y = c.y; p.lit = 1; this.drag = p; this.up(f);
  },
  apply(f, v) {
    this.v = v; const K = 7, n7 = Math.floor(f.N * 0.84 / K), r0 = f.R.s * 0.12, S = spots(f, K);
    const groups = v < 0.17 ? [[0, 1, 2, 3], [4, 5, 6]] : v < 0.36 ? [[0, 1, 2], [3, 4], [5, 6]] : S.map((_, i) => [i]);
    const keep = 1 - 0.95 * smooth(0.62, 1, v);
    f.setClusters(groups.map(g => {
      const x = g.reduce((s, i) => s + S[i][0], 0) / g.length, y = g.reduce((s, i) => s + S[i][1], 0) / g.length;
      return { x, y, r: r0 * Math.sqrt(g.length) * (g.length > 1 ? 1.25 : lerp(0.45, 1, keep)), n: g.length > 1 ? n7 * g.length : Math.max(3, Math.round(n7 * keep)), start: g[0] * n7, hard: g.length > 1 ? 0.7 : 0.6, noCollapse: true, merged: g.length > 1 };
    }), 0.75);
    // swallowed: unlike points now filed under someone else's unit
    for (const c of f.clusters) if (c.merged) c.members.forEach((p, j) => { if (j >= n7) p.kind = "pale"; });
    this.single = v > 0.62; this.counts = [f.clusters.length, f.N - f.used];
  },
  down(f, m) { const p = f.pointAt(m.x, m.y, 26); if (p && p.c < 0) { p.hold = true; this.drag = p; } },
  move(f, m) { if (this.drag) { this.drag.x = m.x; this.drag.y = m.y; } },
  up(f) {
    const p = this.drag; if (!p) return; this.drag = null; p.hold = false;
    const c = f.clusters.find(c => Math.hypot(c.x - p.x, c.y - p.y) < c.r * 1.5); if (!c) { p.free = { x: p.x, y: p.y, w: 30, h: 30 }; return; }
    if (rnd(p.i, 7) > this.v * 0.85) { p.c = c.k; p.a = 1; c.members.push(p); c.flash = 0.8; this.note = ["absorbed: close enough to count as the same", f.st]; }
    else { const d = Math.hypot(p.x - c.x, p.y - c.y) || 1; p.vx = (p.x - c.x) / d * 9; p.vy = (p.y - c.y) / d * 9; p.free = { x: c.x + (p.x - c.x) / d * c.r * 2.2, y: c.y + (p.y - c.y) / d * c.r * 2.2, w: 20, h: 20 }; this.note = ["pushed away: not the same thing", f.st]; }
  },
  draw(f, g, st) {
    if (this.single) { g.strokeStyle = rgba(WARM, 0.3); g.lineWidth = 0.7; for (const p of f.points) if (p.c < 0) { circle(g, p.x, p.y, 5); g.stroke(); } }
    const sw = f.clusters.some(c => c.merged);
    f.api.readout(`<b>${this.counts[0]}</b> units · <b>${this.counts[1]}</b> loose points${sw ? " · pale points were different things" : this.single ? " · each one handled fresh" : ""}`);
    if (this.note && st - this.note[1] < 3.5) f.tag("note", this.note[0], f.R.cx, f.R.y + f.R.h + 14, "dim");
  },
};

export const priors = {
  enter(f, api) { f.jitter = 0.5; this.open = api.val("keepopen"); this.since = 0; this.layout(f); },
  layout(f) {
    const R = f.R; this.clock = { x: R.x + R.w * 0.14, y: R.cy };
    f.setClusters([{ x: R.x + R.w * 0.64, y: R.cy, r: R.s * 0.3, n: Math.floor(f.N * 0.6), hard: this.open ? 0.15 : 0.78, noCollapse: true }], 0.25);
  },
  change(f, id, v) { if (id === "keepopen") { this.open = v; f.clusters[0].hardT = v ? 0.15 : 0.78; this.since = Math.floor(f.st / 1.3) + 1; } },
  amp(j) { return this.open ? 1 : clamp(1 - (j - this.since) * 0.17); },
  draw(f, g, st) {
    const c = f.clusters[0], k = this.clock, period = 1.3, speed = 150, now = Math.floor(st / period);
    const rip = [];
    if (f.reduced) for (let j = 1; j < 9; j++) rip.push([j * 70, this.open ? 1 : 0, 0.5]);
    else for (let j = Math.max(0, now - 7); j <= now; j++) { const r = (st - j * period) * speed; rip.push([r, this.amp(j), clamp(1 - r / (f.R.w * 1.1)) * 0.6]); }
    for (const [r, amp, a] of rip) {
      if (a <= 0) continue;
      g.save(); g.beginPath(); g.rect(0, 0, f.W, f.H); g.arc(c.x, c.y, c.r + 7, 0, 6.2832); g.clip("evenodd"); circle(g, k.x, k.y, r); g.strokeStyle = rgba(WARM, a); g.lineWidth = 1.2; g.stroke(); g.restore();
      if (amp > 0.02) { g.save(); circle(g, c.x, c.y, c.r + 7); g.clip(); circle(g, k.x, k.y, r); g.strokeStyle = rgba(WARM, a * amp * 1.5); g.lineWidth = 1.2 + amp; g.stroke(); g.restore();
        if (!f.reduced) for (const p of c.members) if (Math.abs(Math.hypot(p.x - k.x, p.y - k.y) - r) < 5) p.lit = Math.max(p.lit, amp * 0.5); }
    }
    const beat = f.reduced ? 0 : Math.pow(1 - (st / period) % 1, 4);
    circle(g, k.x, k.y, 9 + beat * 4); g.strokeStyle = rgba(WARM, 0.9); g.lineWidth = 1.5; g.stroke();
    const ha = st / period * 6.2832 / 12; g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(k.x + Math.sin(ha) * 6, k.y - Math.cos(ha) * 6); g.stroke();
    f.tag("clock", "the kitchen clock", k.x, k.y + 30, "warm");
    const amp = f.reduced ? (this.open ? 1 : 0) : this.amp(now);
    f.tag("prior", this.open ? "kept open" : "a prior", c.x, c.y - c.r - 24, this.open ? "warm" : "");
    f.api.readout(`Tick arriving at <b>${Math.round(amp * 100)}%</b>${amp === 0 ? " · predicted, so it stops arriving" : ""}<span class="meter"><i style="width:${amp * 100}%"></i></span>`);
  },
};

export const portability = {
  enter(f, api) { f.jitter = 0.5; this.sent = -1; this.comp = api.val("compress"); this.layout(f); this.auto = true; },
  layout(f) {
    const R = f.R, r = Math.min(R.w * 0.23, R.h * 0.46), ax = R.x + r + 4, bx = R.x + R.w - r - 4, n = this.n = Math.min(90, Math.floor(f.N / 8));
    f.minds = [{ x: ax, y: R.cy, r }, { x: bx, y: R.cy, r }];
    const cr = r * 0.34;
    f.setClusters([
      { x: ax + r * 0.2, y: R.cy - r * 0.38, r: cr, n, hard: 0.62, noCollapse: true, mind: 0 },
      { x: ax - r * 0.42, y: R.cy + r * 0.05, r: cr * 0.8, n: 50, hard: 0.6, noCollapse: true, mind: 0 },
      { x: ax + r * 0.25, y: R.cy + r * 0.5, r: cr * 0.7, n: 40, hard: 0.6, noCollapse: true, mind: 0 },
      { x: bx + r * 0.3, y: R.cy + r * 0.45, r: cr * 0.75, n: 45, hard: 0.6, noCollapse: true, mind: 1 },
      { x: bx - r * 0.2, y: R.cy - r * 0.38, r: cr, n, hard: 0.62, noCollapse: true, mind: 1, hidden: true },
    ], 0);
    this.arrived = false; if (f.reduced) this.arrive(f);
  },
  button(f, id) { if (id === "send") this.send(f); },
  change(f, id, v) { if (id === "compress") { this.comp = v; if (this.arrived) this.arrive(f); } },
  send(f) { this.sent = f.st; this.arrived = false; f.clusters[4].hidden = true; f.clusters[0].up = true; this.auto = false; },
  kept() { return Math.max(4, Math.round(this.n * (1 - 0.88 * this.comp))); },
  arrive(f) {
    const c = f.clusters[4], k = this.kept(); this.arrived = true; c.hidden = false; c.flash = 1; f.clusters[0].up = false;
    c.members.forEach((p, j) => { p.a = j < k ? 1 : 0; if (!f.reduced && !this.wasArrived) { p.x = c.x; p.y = c.y; } });
  },
  update(f, dt, st) {
    if (this.auto && st > 1.6 && !f.reduced) this.send(f);
    if (this.sent < 0 || this.arrived) return;
    const T = st - this.sent, dur = lerp(3.4, 0.8, this.comp);
    if (T > 0.9 + dur) this.arrive(f);
  },
  draw(f, g, st) {
    const a = f.clusters[0], b = f.clusters[4], k = this.kept();
    if (this.sent >= 0 && !this.arrived) {
      const T = st - this.sent, dur = lerp(3.4, 0.8, this.comp), u = smooth(0, 1, clamp((T - 0.9) / dur));
      if (T > 0.9) { const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * f.R.h * 0.12, s = lerp(26, 9, this.comp);
        g.globalCompositeOperation = "lighter"; g.drawImage(f.spr.cool, x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); g.globalCompositeOperation = "source-over"; a.col = Math.min(a.col, 0.25); }
    }
    if (this.arrived) { // ghosts: what the unit dropped in order to travel
      g.strokeStyle = rgba(PALE, 0.28); g.lineWidth = 0.6;
      b.members.forEach((p, j) => { if (j >= k) { circle(g, b.x + p.ox * b.r * 0.92, b.y + p.oy * b.r * 0.92, 1.6); g.stroke(); } });
      f.tag("copy", `copy · ${k} points`, b.x, b.y - b.r - 22, "");
    }
    f.tag("orig", `original · ${this.n} points`, a.x, a.y - a.r - 22, "warm");
    f.tag("m0", "one mind", f.minds[0].x, f.minds[0].y + f.minds[0].r + 14, "dim"); f.tag("m1", "another", f.minds[1].x, f.minds[1].y + f.minds[1].r + 14, "dim");
    f.api.readout(this.arrived ? `Fidelity <b>${Math.round(k / this.n * 100)}%</b> · <b>${this.n - k}</b> points left behind<span class="meter"><i style="width:${k / this.n * 100}%"></i></span>` : `Compression <b>${Math.round(this.comp * 100)}%</b> · more compact travels faster`);
  },
};

const WORDS = [["clock", 0], ["tick", 0], ["kitchen", 1], ["house", 1], ["gear", 2], ["rope", 2]];
const OVER = ["time", "home", "climbing"];
export const words = {
  enter(f) { f.jitter = 0.4; this.layout(f); },
  layout(f) {
    const R = f.R, n = Math.floor(f.N * 0.9 / 6), gx = i => R.x + R.w * (0.2 + 0.3 * i), y = R.cy + R.h * 0.12, d = Math.min(R.w * 0.075, 60);
    this.g = [0, 1, 2].map(i => ({ x: gx(i), y, r: d * 1.9 }));
    f.setClusters(WORDS.map(([w, gi], i) => ({ x: gx(gi) + (i % 2 ? d : -d) * 2.2, y: y + (i % 2 ? 30 : -30), tx: gx(gi) + (i % 2 ? d : -d), ty: y, r: d * 0.8, n, hard: 0.3, word: w })), 0);
    for (const c of f.clusters) { c.hardT = 0.97; if (f.reduced) { c.x = c.tx; c.y = c.ty; } }
  },
  draw(f, g, st) {
    const a1 = smooth(1.6, 2.6, st), a2 = smooth(4, 5.5, st), a3 = smooth(7, 8.5, st), R = f.R;
    f.clusters.forEach(c => { if (a1 > 0.05) f.tag("w" + c.k, c.word, c.x, c.y + c.r * 0.5 + 24, ""); });
    
    this.g.forEach((o, i) => { if (a2 < 0.02) return; circle(g, o.x, o.y, lerp(o.r * 1.5, o.r, a2)); glowStroke(g, COOL, a2 * 0.75, 1.4); if (a2 > 0.5) f.tag("o" + i, OVER[i], o.x, o.y - o.r - 16, "big"); });
    if (a3 > 0.02) { g.beginPath(); g.ellipse(R.cx, this.g[0].y - 8, R.w * 0.47, this.g[0].r * 1.75, 0, 0, 6.2832); glowStroke(g, COOL, a3 * 0.5, 1.4); if (a3 > 0.5) f.tag("top", "things in the house", R.cx, this.g[0].y - this.g[0].r * 1.75 - 24, "big"); }
    f.api.readout(a2 < 0.5 ? "Units receive words" : a3 < 0.5 ? "Words cluster into a second layer" : "Clusters nest");
  },
};
