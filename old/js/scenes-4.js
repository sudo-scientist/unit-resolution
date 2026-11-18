// Act IV — how difference gets explained — and the sandbox.
// MARK, the third colour, is used only here: for labels imposed from outside.
import { WARM, COOL, PALE, MARK, rgba, lerp, clamp, smooth, rnd, glowStroke } from "./field.js";
import { NAMED_LABEL } from "./content.js";
import { circle } from "./scenes-1.js";
import { makeWall, drawWall, makePacket, drawPacket, fitOf, shedOf, twoMinds } from "./scenes-3.js";

const LABEL = NAMED_LABEL.trim() || "the label";

export const labels = {
  enter(f) { f.jitter = 0.6; this.layout(f); },
  melt(f, v) { f.clusters[13].hardT = lerp(0.06, 0.78, v); },
  layout(f) {
    const R = f.R, cx = this.cx = R.x + R.w * 0.3, cy = this.cy = R.cy + R.h * 0.08, s = R.s, specs = [];
    for (let i = 0; i < 13; i++) { const a = i * 2.4, d = Math.sqrt(i / 13) * s * 0.21; specs.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: s * 0.036, n: Math.floor(f.N * 0.05), hard: 0.96, centre: true }); }
    this.far = { x: R.x + R.w * 0.86, y: R.cy - R.h * 0.22, r: s * 0.12 };
    specs.push({ ...this.far, n: Math.floor(f.N * 0.2), hard: 0.14, noCollapse: true });
    f.setClusters(specs, 0);
  },
  button(f, id) { if (id === "replay") { f.st = 0; for (const c of f.clusters) c.vis = 1; } },
  update(f, dt, st) {
    const gone = f.reduced ? 0.82 : smooth(6.6, 8.6, st);
    for (const c of f.clusters) if (c.centre) c.vis = 1 - gone;
  },
  draw(f, g, st) {
    const F = this.far, cx = this.cx, cy = this.cy, dx = F.x - cx, dy = F.y - cy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const grow = smooth(1.6, 3.8, st), pull = f.reduced ? 0 : smooth(4.6, 6.4, st), tagOn = smooth(6.2, 6.8, st);
    const a0 = lerp(0, L - F.r - 14, pull), a1 = (L - F.r - 14) * grow;        // the line detaches from the centre and shrinks toward the far mind
    if (a1 - a0 > 2) {
      const col = pull > 0.05 ? [0, 1, 2].map(i => Math.round(lerp(PALE[i], MARK[i], pull))) : PALE;
      g.strokeStyle = rgba(col, f.reduced ? 0.35 : 0.8); g.lineWidth = 1.2; g.setLineDash(f.reduced ? [3, 6] : []); g.beginPath(); g.moveTo(cx + ux * a0, cy + uy * a0); g.lineTo(cx + ux * a1, cy + uy * a1);
      for (let d = Math.ceil(a0 / 40) * 40; d < a1; d += 40) { g.moveTo(cx + ux * d - uy * 4, cy + uy * d + ux * 4); g.lineTo(cx + ux * d + uy * 4, cy + uy * d - ux * 4); }
      g.stroke(); g.setLineDash([]);
      if (pull < 0.3 && grow > 0.6) f.tag("dist", "distance from the center", cx + ux * a1 * 0.62 + 40, cy + uy * a1 * 0.62 + 34, "dim");
    }
    if (st < 6.6 || f.reduced) f.tag("ctr", "the center", cx, cy + f.R.s * 0.27, f.reduced ? "dim" : "");
    if (tagOn > 0.02) {
      circle(g, F.x, F.y, F.r + 16 + (1 - tagOn) * 30); glowStroke(g, MARK, 0.95 * tagOn, 2, 1.4);
      f.tag("pin", `has ${LABEL}`, F.x, F.y + F.r + 40, "mark big");
    }
    f.tag("far", "Maven", F.x, F.y - F.r - 26 - (tagOn > 0 ? 14 : 0), "warm");
    f.api.readout(tagOn > 0.5 ? "The distance now reads as something inside her" : grow > 0.3 ? "A distance, measured from the center" : "The center does the naming");
  },
};

const WHY = ["never set fast", "held open by old threat", "attention leaves early", "flooded by sensation"];
export const collision = {
  enter(f, api) { f.jitter = 1; this.inside = api.val("inside"); this.layout(f); },
  layout(f) {
    const R = f.R, lane = R.h / 4, r = lane * 0.42, x0 = R.x + r + (f.phone ? 0 : R.w * 0.12), wx = this.wx = R.x + R.w * 0.52; this.r = r;
    this.wall = makeWall(f, 4, r * 0.4, wx);
    const n = [0.11, 0.16, 0.14, 0.34].map(k => Math.floor(f.N * k)), hard = [0.08, 0.45, 0.2, 0.3];
    f.setClusters([0, 1, 2, 3].map(i => ({ x: x0, y: R.y + lane * (i + 0.5), tx: x0, ty: R.y + lane * (i + 0.5), r: r * [1.15, 0.7, 0.95, 1][i], n: n[i], hard: hard[i], noCollapse: true, sx: 1, x0 })), 0);
  },
  button(f, id) { if (id === "replay") { f.st = 0; for (const c of f.clusters) { c.x = c.x0; c.sx = 1; } } },
  change(f, id, v) { if (id === "inside") this.inside = v; },
  update(f, dt, st) {
    const hit = smooth(1.2, 3.6, st), squash = smooth(3.3, 4.1, st), seen = this.seen = f.reduced ? 1 : smooth(4.6, 6, st), t = f.t;
    f.clusters.forEach((c, i) => {
      c.tx = lerp(c.x0, this.wx - c.r * 0.62 - 9, hit); c.sx = 1 - 0.42 * squash; if (f.reduced) c.x = c.tx;
      const dim = this.inside ? 1 : 1 - 0.88 * seen; c.vis = lerp(c.vis ?? 1, dim, f.reduced ? 1 : 0.08);
      for (const p of c.members) {
        p.a = i === 3 ? 1 : 0.85;
        if (f.reduced) continue;
        if (i === 1) { p.vx += (rnd(p.i, Math.floor(t * 30)) - 0.5) * 1.1; p.vy += (rnd(p.i + 3, Math.floor(t * 30)) - 0.5) * 1.1; }          // held taut, trembling
        if (i === 2) { p.vx += -(p.y - c.y) * 0.012 + Math.cos(t * 0.7 + p.ph) * 0.3; p.vy += (p.x - c.x) * 0.012; }                           // always leaving
        if (i === 3 && rnd(p.i, Math.floor(t * 8)) < 0.06) p.lit = 0.8;                                                                       // flooded
      }
    });
  },
  draw(f, g, st) {
    drawWall(f, g, this.wall); const seen = this.seen, r = this.r, x = this.wx + 14, ys = this.wall.slots.map(s => s.y);
    if (seen > 0.02) {
      for (const y of ys) { g.beginPath(); g.moveTo(x, y - r * 0.8); g.bezierCurveTo(x + r * 1.1, y - r * 0.8, x + r * 1.1, y + r * 0.8, x, y + r * 0.8); g.closePath(); g.fillStyle = rgba(PALE, 0.1 * seen); g.fill(); g.strokeStyle = rgba(PALE, 0.55 * seen); g.lineWidth = 1.2; g.stroke(); }
      const lab = f.reduced ? 1 : smooth(6.2, 7.2, st);
      if (lab > 0.02) { g.beginPath(); g.roundRect(x - 4, ys[0] - r * 1.15, r * 1.5 * lab + 8, ys[3] - ys[0] + r * 2.3, 6); glowStroke(g, MARK, 0.95 * lab, 2, 1.4); if (lab > 0.6) f.tag("one", "one name", x + r * 0.75, ys[0] - r * 1.15 - 16, "mark big"); }
      f.tag("out", "seen from outside", x + r * 0.75, ys[3] + r * 1.15 + 16, "dim");
    }
    if (this.inside || seen < 0.3) f.clusters.forEach((c, i) => f.tag("w" + i, WHY[i], f.phone ? f.R.x + 70 : c.x - c.r - 120, f.phone ? c.y - this.r * 1.1 : c.y, "warm"));
    f.api.readout(seen < 0.5 ? "Four different minds, one wall" : this.inside ? "Four different interiors behind one name" : "From outside: four alike impacts, one name");
  },
};

export const sharper = {
  enter(f, api) { f.jitter = 0.7; this.s = api.val("share"); this.layout(f); },
  change(f, id, v) { if (id === "share") { this.s = v; this.apply(f); } },
  layout(f) {
    const R = f.R, cols = 3, rows = 2; this.tok = [];
    for (let i = 0; i < 6; i++) this.tok.push({ x: R.x + R.w * ((i % cols) + 0.5) / cols, y: R.y + R.h * ((i / cols | 0) + 0.5) / rows });
    f.setClusters(this.tok.map(t => ({ ...t, r: 10, n: Math.floor(f.N * 0.9 / 6) })), 0);
    const M = f.phone ? 46 : 84; this.minds = Array.from({ length: M }, (_, i) => ({ x: R.x + rnd(i, 81) * R.w, y: R.y + rnd(i, 82) * R.h, cx: 0, cy: 0 }));
    for (const m of this.minds) { m.cx = m.x; m.cy = m.y; } this.apply(f);
  },
  apply(f) { const s = this.s, R = f.R, base = Math.min(R.w / 3, R.h / 2); this.rad = lerp(base * 0.56, base * 0.2, s); f.clusters.forEach((c, i) => { c.r = this.rad * (1 + (1 - s) * (rnd(i, 83) - 0.5) * 0.5); c.hardT = lerp(0.1, 1, s); }); },
  draw(f, g) {
    let gaps = 0; const s = this.s;
    for (const m of this.minds) {
      let best = null, bd = 1e9; f.clusters.forEach(c => { const d = Math.hypot(m.x - c.x, m.y - c.y); if (d < bd) { bd = d; best = c; } });
      const fits = bd < best.r * 1.05, pull = fits ? 0.25 + 0.6 * s : 0, tx = lerp(m.x, best.x + (m.x - best.x) * 0.5, pull), ty = lerp(m.y, best.y + (m.y - best.y) * 0.5, pull);
      m.cx = lerp(m.cx, tx, f.reduced ? 1 : 0.08); m.cy = lerp(m.cy, ty, f.reduced ? 1 : 0.08); if (!fits) gaps++;
      circle(g, m.cx, m.cy, fits ? 4 : 5.5); g.strokeStyle = rgba(fits ? COOL : WARM, fits ? 0.75 : 1); g.lineWidth = fits ? 1.1 : 1.8; g.stroke(); if (!fits) { g.fillStyle = rgba(WARM, 0.35); g.fill(); }
    }
    f.tag("k", "rings are minds · filled ones fit no token", f.R.cx, f.R.y - 22, "dim");
    f.api.readout(`<b>${gaps}</b> of ${this.minds.length} minds in the gaps<span class="meter"><i style="width:${gaps / this.minds.length * 100}%"></i></span>`);
  },
};

// shared by "what can change" and the sandbox: one open sender, a wall the reader can reshape
function pickSlot(wall, pk) { let b = 0, best = -1; wall.slots.forEach((s, i) => { const sc = Math.min(1, s.h / (2 * pk.r)) - Math.abs(s.y - pk.sy) / 5000; if (sc > best) { best = sc; b = i; } }); return b; }
function grabSlot(scene, f, m) { const w = scene.wall; if (Math.abs(m.x - w.x) > 44) return; scene.grab = w.slots.reduce((a, s) => Math.abs(s.y - m.y) < Math.abs(a.y - m.y) ? s : a); scene.gy = m.y; scene.gh = scene.grab.h; }
function dragSlot(scene, m) { if (scene.grab) scene.grab.h = clamp(scene.gh + Math.abs(m.y - scene.grab.y) * 2 - Math.abs(scene.gy - scene.grab.y) * 2, scene.pr * 0.4, scene.pr * 2.4); }

export const change = {
  enter(f, api) { if (api.melt > 0.3) api.setMelt(0.15); f.jitter = 0.8; this.pk = []; this.lastCost = null; this.last = -9; this.k = 0; this.extra = 0; this.v = api.val("slotw"); this.layout(f); },
  layout(f) {
    this.g = twoMinds(f, lerp(0.06, 1, f.api.melt)); const pr = this.pr = Math.max(16, f.R.s * 0.075);
    this.wall = makeWall(f, 3 + this.extra, lerp(pr * 0.5, pr * 2.3, this.v));
    if (f.reduced) { this.pk = [0.3, 0.5, 0.75].map((u, i) => ({ ...this.spawn(f, i), u })); this.lastCost = shedOf(this.pk[0], this.wall); }
  },
  melt(f, v) { f.setMelt(lerp(0.06, 1, v), 0); },
  change(f, id, v) { if (id === "slotw") { this.v = v; for (const s of this.wall.slots) s.h = lerp(this.pr * 0.5, this.pr * 2.3, v); if (f.reduced) this.layout(f); } },
  button(f, id) { if (id === "addslot" && this.extra < 4) { this.extra++; const old = this.wall.slots.map(s => s.h); this.wall = makeWall(f, 3 + this.extra, this.pr * 2.3); this.wall.slots.forEach((s, i) => { if (i < old.length) s.h = old[i]; }); if (f.reduced) { const e = this.extra; this.layout(f); this.wall.slots[this.wall.slots.length - 1].h = this.pr * 2.3; this.extra = e; this.pk.forEach(p => p.slot = pickSlot(this.wall, p)); this.lastCost = shedOf(this.pk[0], this.wall); } } },
  spawn(f, k) { const a = f.clusters[k % 4], b = f.clusters[4 + (k + 1) % 4], pk = makePacket(k * 50, 34, { kind: "open", r: this.pr * lerp(1, 0.4, smooth(0.4, 1, f.api.melt)), slot: 0, sx: a.x, sy: a.y, dx: b.x, dy: b.y, t: f.st, dur: 4.6 }); pk.slot = pickSlot(this.wall, pk); return pk; },
  down(f, m) { grabSlot(this, f, m); }, move(f, m) { dragSlot(this, m); }, up() { this.grab = null; },
  update(f, dt, st) {
    if (f.reduced) return;
    if (st - this.last > 1.5) { this.last = st; this.pk.push(this.spawn(f, ++this.k)); }
    for (const p of this.pk) { p.u = (st - p.t) / p.dur; if (p.u < 0.42) p.slot = pickSlot(this.wall, p); if (!p.counted && p.u > 0.5) { p.counted = true; this.lastCost = shedOf(p, this.wall); } }
    this.pk = this.pk.filter(p => p.u < 1);
  },
  draw(f, g) {
    drawWall(f, g, this.wall); for (const p of this.pk) drawPacket(f, g, p, clamp(p.u), this.wall);
    const { ax, bx, r } = this.g, y = f.R.cy + r + 14, c = this.lastCost;
    f.tag("a", "her pattern: unchanged", ax, y, "warm"); f.tag("w", "the wall: drag a slot", this.wall.x, f.R.y - 14, "");
    f.api.readout(c === null ? "Translation cost: waiting for a message" : `Translation cost <b>${c}</b> of 34 points shed per message${c === 0 ? " · arrives intact" : ""}<span class="meter"><i style="width:${c / 34 * 100}%"></i></span>`);
  },
};

export const sandbox = {
  enter(f, api) { this.api = api; this.pk = []; this.res = null; this.layout(f); },
  layout(f) {
    const api = this.api, m = api.val("match"), pr = this.pr = Math.max(16, f.R.s * 0.075);
    this.g = twoMinds(f, api.val("meltA"), api.val("meltB"));
    for (const c of f.clusters) { c.r *= lerp(1.35, 0.6, m); if (m > 0.6) { const keep = Math.round(c.members.length * (1 - 0.8 * smooth(0.6, 1, m))); c.members.slice(keep).forEach(p => { p.c = -1; p.a = 0.6; p.free = { x: c.x, y: c.y, w: c.r * 4, h: c.r * 4 }; }); c.members.length = keep; } }
    const hs = this.wall?.slots.map(s => s.h); this.wall = makeWall(f, f.phone ? 3 : 4, lerp(pr * 0.5, pr * 2.3, api.val("slotw"))); if (hs && !this.reslot) this.wall.slots.forEach((s, i) => s.h = hs[i] ?? s.h); this.reslot = false;
    f.jitter = lerp(1.3, 0.3, (api.val("meltA") + api.val("meltB")) / 2);
    if (f.reduced && this.pk.length) this.pk.forEach(p => p.u = 0.5);
  },
  change(f, id, v) {
    if (id === "meltA" || id === "meltB") { f.setMelt(v, id === "meltA" ? 0 : 1); return; }
    if (id === "slotw") this.reslot = true; if (id === "compress") return; this.layout(f);
  },
  button(f, id) {
    if (id !== "send") return; const api = this.api, a = f.clusters[this.pk.length % 4], b = f.clusters[4 + this.pk.length % 4], mA = api.val("meltA"), comp = api.val("compress");
    const n = Math.max(3, Math.round(34 * (1 - 0.85 * comp) * (1 - 0.6 * smooth(0.5, 1, mA))));
    const pk = makePacket(f.st * 100 | 0, n, { kind: "open", r: this.pr * lerp(1, 0.5, Math.max(comp, smooth(0.5, 1, mA))), slot: 0, sx: a.x, sy: a.y, dx: b.x, dy: b.y, t: f.st, dur: lerp(4.4, 1.6, comp), u: f.reduced ? 0.5 : 0 });
    pk.slot = pickSlot(this.wall, pk); this.pk = [pk]; this.res = null; if (f.reduced) this.res = [n, n - shedOf(pk, this.wall)];
  },
  down(f, m) { grabSlot(this, f, m); if (!this.grab) { const c = f.clusterAt(m.x, m.y); if (c) { c.up = !c.up; c.flash = 0.6; } } }, move(f, m) { dragSlot(this, m); }, up() { this.grab = null; },
  update(f, dt, st) { if (f.reduced) return; for (const p of this.pk) { p.u = (st - p.t) / p.dur; if (!p.counted && p.u > 0.5) { p.counted = true; this.res = [p.pts.length, p.pts.length - shedOf(p, this.wall)]; } } },
  draw(f, g) {
    drawWall(f, g, this.wall); for (const p of this.pk) if (p.u < 1.6) drawPacket(f, g, p, clamp(p.u), this.wall);
    const { ax, bx, r } = this.g, y = f.R.cy + r + 14; f.tag("a", "left mind", ax, y, "dim"); f.tag("b", "right mind", bx, y, "dim");
    const R = this.res; f.api.readout(R ? `Sent as <b>${R[0]}</b> of 34 points · arrived <b>${R[1]}</b> · fidelity <b>${Math.round(R[1] / 34 * 100)}%</b>${R[1] === 34 ? " · intact" : ""}<span class="meter"><i style="width:${R[1] / 34 * 100}%"></i></span>` : "Send a message. Try to get it across intact.");
  },
};
