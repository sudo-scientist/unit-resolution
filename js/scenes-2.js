// End of Act I (culture) and Act II — how minds differ
import { WARM, COOL, PALE, rgba, lerp, clamp, smooth, rnd } from "./field.js";
import { spots, circle } from "./scenes-1.js";

export const culture = {
  enter(f) { f.jitter = 0.4; this.gen = 0; this.hops = []; this.lastHop = 0; this.layout(f); },
  layout(f) {
    const R = f.R, cols = f.phone ? 3 : 5, rows = 3, M = cols * rows, cw = R.w / cols, ch = R.h / rows, mr = Math.min(cw, ch) * 0.36;
    const n = Math.max(6, Math.floor(f.N * 0.92 / (M * 3))), specs = [];
    this.m = []; this.mr = mr;
    for (let i = 0; i < M; i++) {
      const type = (i * 7 + (i / cols | 0)) % 2, gx = R.x + cw * (i % cols + 0.5) + (rnd(i, 21) - 0.5) * cw * 0.2, gy = R.y + ch * ((i / cols | 0) + 0.5) + (rnd(i, 22) - 0.5) * ch * 0.2;
      const off = type ? [[-0.62, 0], [0, 0], [0.62, 0]] : [[0, -0.45], [-0.45, 0.35], [0.45, 0.35]];
      this.m.push({ i, type, gx, gy, x: gx, y: gy, off, born: -99 });
      off.forEach(o => specs.push({ x: gx + o[0] * mr, y: gy + o[1] * mr, r: mr * 0.2, n, hard: 0.74, noCollapse: true, mind: i }));
    }
    f.setClusters(specs, 0);
    f.minds = this.m.map(m => ({ x: m.x, y: m.y, r: mr, a: 0.16 }));
    if (f.reduced) { this.place(f, 1); [2, 7].forEach(i => this.reborn(f, this.m[i % M], 999)); }
  },
  place(f, u) {
    const R = f.R;
    this.m.forEach((m, i) => {
      const cx = R.x + R.w * (m.type ? 0.72 : 0.28); m.x = lerp(m.gx, cx, 0.42 * u); m.y = lerp(m.gy, R.cy, 0.12 * u);
      f.minds[i].x = m.x; f.minds[i].y = m.y;
      m.off.forEach((o, j) => { const c = f.clusters[i * 3 + j]; c.tx = m.x + o[0] * this.mr; c.ty = m.y + o[1] * this.mr; if (f.reduced) { c.x = c.tx; c.y = c.ty; } });
    });
  },
  reborn(f, m, st) { m.born = st; for (let j = 0; j < 3; j++) { const c = f.clusters[m.i * 3 + j]; c.hardT = 0.12; c.hard = 0.12; c.members.forEach(p => { p.a = 0; p.al = 0; }); } },
  update(f, dt, st) {
    if (f.reduced) return;
    this.place(f, smooth(2, 16, st));
    const gen = 1 + Math.floor(st / 5);
    if (gen !== this.gen) { this.gen = gen; if (gen > 1) for (let k = 0; k < 3; k++) this.reborn(f, this.m[Math.floor(rnd(gen, 30 + k) * this.m.length)], st); }
    for (const m of this.m) if (m.born > 0 && st - m.born > 2.2) { m.born = -99; for (let j = 0; j < 3; j++) { const c = f.clusters[m.i * 3 + j]; c.hardT = 0.74; c.members.forEach(p => { p.a = 1; p.x = m.x + (rnd(p.i, 40) - 0.5) * this.mr * 2; p.y = m.y + (rnd(p.i, 41) - 0.5) * this.mr * 2; }); } }
    if (st - this.lastHop > 0.45) { this.lastHop = st; const a = this.m[Math.floor(rnd(st * 10, 50) * this.m.length)], b = this.near(a)[Math.floor(rnd(st * 10, 51) * 2)]; if (b) this.hops.push({ a: a.i * 3 + Math.floor(rnd(st, 52) * 3), b: b.i * 3 + Math.floor(rnd(st, 53) * 3), t: st }); }
    this.hops = this.hops.filter(h => st - h.t < 1.1);
  },
  near(a) { return this.m.filter(b => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2); },
  under(f, g) { g.strokeStyle = rgba(PALE, 0.07); g.lineWidth = 1; for (const a of this.m) for (const b of this.near(a)) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } },
  draw(f, g, st) {
    g.globalCompositeOperation = "lighter";
    const dot = (x, y) => g.drawImage(f.spr.cool, x - 9, y - 9, 18, 18);
    if (f.reduced) this.m.forEach((a, i) => { if (i % 3 === 0) { const b = this.near(a)[0]; dot((a.x + b.x) / 2, (a.y + b.y) / 2); } });
    for (const h of this.hops) { const a = f.clusters[h.a], b = f.clusters[h.b], u = smooth(0, 1, (st - h.t) / 1.1); dot(lerp(a.x, b.x, u), lerp(a.y, b.y, u)); if (u > 0.95) b.flash = 0.5; }
    g.globalCompositeOperation = "source-over";
    for (const m of this.m) if (m.born > 0) f.tag("b" + m.i, "new mind", m.x, m.y - this.mr - 10, "dim");
    f.api.readout(`Generation <b>${f.reduced ? 4 : this.gen}</b> · new minds arrive with boundaries already drawn`);
  },
};

// ----- Act II shares one mind; the melting point slider drives it -----
export function oneMind(f, api, opts = {}) {
  const S = spots(f, 7), n = Math.floor(f.N * 0.84 / 7), r = f.R.s * 0.12;
  f.setClusters(S.map(([x, y]) => ({ x, y, r, n, mind: 0, noCollapse: opts.noCollapse })), 0.45);
  f.makeLinks(f.phone ? 110 : 190); applyMelt(f, api.melt);
}
export function applyMelt(f, v) {
  for (const c of f.clusters) c.hardT = lerp(0.06, 1, v);
  f.linkAmt = clamp(1.05 - v * 1.9); f.jitter = lerp(1.5, 0.15, v);
}
const meltWords = v => v < 0.3 ? "open: points cross, links form" : v < 0.62 ? "soft boundaries" : v < 0.85 ? "setting: boundaries harden" : "set: each unit is one thing";

export const melt = {
  enter(f, api) { oneMind(f, api); },
  layout(f) { oneMind(f, f.api); },
  melt(f, v) { applyMelt(f, v); },
  button(f, id, v, api) { api.setMelt(id === "preset-open" ? 0.08 : 0.97); applyMelt(f, api.melt); },
  draw(f) { f.api.readout(`Melting point <b>${Math.round(f.api.melt * 100)}</b> · ${meltWords(f.api.melt)}`); },
};

export const crossing = {
  enter(f, api) { if (api.melt > 0.45) api.setMelt(0.22); oneMind(f, api, { noCollapse: true }); this.go = -1; this.lit = false; f.cam = null; },
  layout(f) { oneMind(f, f.api, { noCollapse: true }); },
  leave(f) { f.cam = null; },
  melt(f, v) { applyMelt(f, v); },
  down(f, m) { const c = f.clusterAt(m.x, m.y); if (c && this.go < 0) { c.up = !c.up; c.flash = 0.6; } },
  button(f, id) { if (id === "updown") { this.ki = ((this.ki ?? -1) + 1) % (f.clusters.length * 2); const c = f.clusters[this.ki >> 1]; c.up = !c.up; c.flash = 0.6; return; } if (id !== "stepout") return; if (f.reduced) this.lit = !this.lit; else this.go = f.st; },
  update(f, dt, st) {
    if (this.go < 0) return; const T = st - this.go, c = f.clusters[0], W = f.W / 2, H = f.H / 2, out = { x: c.x + c.r * 2.4, y: c.y - c.r * 0.6 };
    const key = [[0, W, H, 1], [1.4, c.x, c.y, 3.2], [3.2, out.x, out.y, 2.6], [5.6, (c.x + out.x) / 2, (c.y + out.y) / 2, 2.2], [7.2, c.x, c.y, 3.2], [8.8, W, H, 1]];
    let i = key.findIndex(k => k[0] > T); if (i < 0) { this.go = -1; f.cam = null; return; }
    const a = key[i - 1], b = key[i], u = smooth(a[0], b[0], T);
    f.cam = { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), k: lerp(a[3], b[3], u) };
    this.lit = T > 3 && T < 7; if (this.lit) c.flash = Math.max(c.flash, 0.7);
  },
  draw(f) {
    const c = f.clusters[0], n = f.links.filter(l => clamp((f.linkAmt - l.th * 0.8) * 4) > 0.3).length;
    if (this.lit) { if (f.reduced) c.flash = 0.7; if (!f.cam) f.tag("out", "the unit, seen from outside", c.x, c.y - c.r - 26, "big"); }
    const phase = this.go < 0 ? "" : f.st - this.go < 3 ? "inside a unit" : f.st - this.go < 7 ? "outside, looking back at its boundary" : "home again";
    f.api.readout(phase ? `<b>${phase}</b>` : `<b>${n}</b> links cross a boundary · <b>${f.clusters.filter(c => c.up).length}</b> units held as one thing`);
  },
};

export const ceiling = {
  enter(f, api) { oneMind(f, api, { noCollapse: true }); this.act = f.clusters.map(() => 0); this.src = -1; },
  layout(f) { oneMind(f, f.api, { noCollapse: true }); this.act = f.clusters.map(() => 0); },
  melt(f, v) { applyMelt(f, v); },
  move(f, m) { const c = f.clusterAt(m.x, m.y); this.src = c ? c.k : -1; },
  down(f, m) { this.move(f, m); },
  change(f, id, v) { if (id === "touch") this.src = v ? 0 : -1; },
  update(f, dt) {
    const A = this.act; if (this.src >= 0) A[this.src] = 1;
    for (const l of f.links) {
      if (clamp((f.linkAmt - l.th * 0.8) * 4) < 0.3) continue; const a = l.p.c, b = l.q.c; if (a < 0 || b < 0) continue;
      if (A[a] > 0.5 || A[b] > 0.5) { l.lit = Math.max(l.lit, 0.5); if (A[a] > 0.5) A[b] = Math.min(1, A[b] + dt * 0.5); else A[a] = Math.min(1, A[a] + dt * 0.5); }
    }
    f.clusters.forEach((c, k) => { if (this.src < 0) A[k] *= Math.pow(0.5, dt); c.flash = Math.max(c.flash, A[k] * 0.35); for (const p of c.members) if (rnd(p.i, Math.floor(f.t * 6)) < A[k] * 0.3) p.lit = Math.max(p.lit, 0.55); });
  },
  draw(f) {
    const lit = this.act.filter(a => a > 0.5).length, held = f.links.filter(l => l.lit > 0.2).length, load = clamp((lit - 1) / 6 * 0.6 + held / Math.max(40, f.links.length * 0.5) * 0.4);
    f.api.readout(lit ? `Load <b>${Math.round(load * 100)}%</b> · <b>${lit}</b> ${lit === 1 ? "unit lit, and it stops at the boundary" : "units lit"} · <b>${held}</b> connections held<span class="meter"><i style="width:${load * 100}%"></i></span>` : "Touch a unit");
  },
};
