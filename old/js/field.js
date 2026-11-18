// The one living field: points, clusters, membranes, collapsed units, links, minds.
export const WARM = [242, 180, 106], COOL = [127, 196, 232], PALE = [233, 228, 216], MARK = [255, 61, 127];
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (c1, c2, t) => [0, 1, 2].map(i => Math.round(lerp(c1[i], c2[i], t)));
// deterministic pseudo-random so every load shows the same field
export const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

// a soft glow without shadowBlur (which is slow): the same path stroked wide and faint, then thin and bright
export function glowStroke(g, color, alpha, width, glow = 1) {
  if (glow > 0.02) { g.lineJoin = "round"; g.strokeStyle = rgba(color, alpha * 0.1 * glow); g.lineWidth = width + 12; g.stroke(); g.strokeStyle = rgba(color, alpha * 0.2 * glow); g.lineWidth = width + 5; g.stroke(); }
  g.strokeStyle = rgba(color, alpha); g.lineWidth = width; g.stroke();
}

function sprite(c) {
  const s = document.createElement("canvas"); s.width = s.height = 32;
  const g = s.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.22, rgba(c, 0.85)); gr.addColorStop(0.5, rgba(c, 0.16)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return s;
}

export class Field {
  constructor(canvas, overlay) {
    this.cv = canvas; this.ctx = canvas.getContext("2d"); this.overlay = overlay;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
    this.N = small ? 520 : 1000;
    this.points = []; this.clusters = []; this.minds = []; this.links = [];
    this.linkAmt = 0; this.jitter = 1; this.t = 0; this.scene = null; this.tags = new Map();
    this.mouse = { x: -999, y: -999, on: false, down: false };
    this.spr = { warm: sprite(WARM), cool: sprite(COOL), pale: sprite(PALE), mark: sprite(MARK) };
    for (let i = 0; i < this.N; i++) {
      const a = rnd(i, 1) * 6.283, r = Math.sqrt(rnd(i, 2));
      this.points.push({ i, x: 0, y: 0, vx: 0, vy: 0, c: -1, ox: Math.cos(a) * r, oy: Math.sin(a) * r, ph: rnd(i, 3) * 6.283, a: 1, al: 0, lit: 0, kind: "warm", size: 0.8 + rnd(i, 4) * 0.7, fx: rnd(i, 5), fy: rnd(i, 6), free: null });
    }
    this.resize(); this.scatter(true);
    addEventListener("resize", () => { this.resize(); this.scene?.layout?.(this); this.kick(); });
    const pos = e => { const b = canvas.getBoundingClientRect(); this.mouse.x = e.clientX - b.left; this.mouse.y = e.clientY - b.top; this.mouse.on = true; };
    canvas.addEventListener("pointermove", e => { pos(e); this.scene?.move?.(this, this.mouse); this.kick(); });
    canvas.addEventListener("pointerdown", e => { pos(e); this.mouse.down = true; this.scene?.down?.(this, this.mouse); this.kick(); });
    addEventListener("pointerup", () => { if (this.mouse.down) { this.mouse.down = false; this.scene?.up?.(this, this.mouse); this.kick(); } });
    canvas.addEventListener("pointerleave", () => { this.mouse.on = false; this.mouse.x = this.mouse.y = -999; });
    this.frames = 0; this.last = performance.now();
    requestAnimationFrame(n => this.loop(n));
  }

  resize() {
    const b = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    this.W = b.width; this.H = b.height; this.phone = innerWidth <= 820;
    this.cv.width = this.W * d; this.cv.height = this.H * d; this.ctx.setTransform(d, 0, 0, d, 0, 0);
    const x0 = this.phone ? 12 : Math.min(this.W * 0.05, 80) + 440;
    this.R = this.phone ? { x: 12, y: 58, w: this.W - 24, h: this.H - 84 } : { x: x0, y: 80, w: this.W - x0 - 40, h: this.H - 250 };
    this.R.cx = this.R.x + this.R.w / 2; this.R.cy = this.R.y + this.R.h / 2; this.R.s = Math.min(this.R.w, this.R.h);
  }

  // ----- layout helpers used by scenes -----
  scatter(place) {
    this.clusters = []; this.minds = []; this.links = []; this.linkAmt = 0;
    for (const p of this.points) { p.c = -1; p.a = 1; p.kind = "warm"; p.free = null; if (place) { p.x = p.fx * this.W; p.y = p.fy * this.H; } }
  }
  // specs: [{x,y,r,n,hard,mind,label}] ; points beyond the total stay free (alpha `rest`)
  setClusters(specs, rest = 0) {
    const old = this.clusters;
    this.clusters = specs.map((s, k) => ({ hard: 0.5, hardT: s.hard ?? 0.5, col: 0, up: false, flash: 0, mem: 0, memT: 1, noCollapse: false, ...s, hardT: s.hard ?? 0.5, hard: old[k]?.hard ?? 0.2, col: old[k]?.col ?? 0, mem: old[k]?.mem ?? 0 }));
    let i = 0;
    for (const p of this.points) { p.c = -1; p.a = rest; p.kind = "warm"; p.hold = false; p.free = { x: this.R.cx, y: this.R.cy, w: this.R.w, h: this.R.h }; }
    this.clusters.forEach((c, k) => { c.k = k; c.members = []; if (c.start !== undefined) i = c.start; for (let j = 0; j < c.n && i < this.N; j++, i++) { const p = this.points[i]; p.c = k; p.a = 1; c.members.push(p); } });
    this.used = this.clusters.reduce((s, c) => s + c.members.length, 0);
    return this.clusters;
  }
  makeLinks(count) {
    this.links = []; const cs = this.clusters; if (cs.length < 2) return;
    for (let k = 0; k < count; k++) {
      const a = cs[Math.floor(rnd(k, 11) * cs.length)]; let b = cs[Math.floor(rnd(k, 12) * cs.length)];
      if (a === b || a.mind !== b.mind) { b = cs[(a.k + 1) % cs.length]; if (a.mind !== b.mind) continue; }
      const p = a.members[Math.floor(rnd(k, 13) * a.members.length)], q = b.members[Math.floor(rnd(k, 14) * b.members.length)];
      if (p && q) this.links.push({ p, q, th: rnd(k, 15), lit: 0 });
    }
  }
  setMelt(v, mind = null) { for (const c of this.clusters) if (mind === null || c.mind === mind) c.hardT = v; }
  clusterAt(x, y) { return this.clusters.find(c => Math.hypot(c.x - x, c.y - y) < Math.max(c.r, 18)); }
  pointAt(x, y, rad = 22) { let best = null, bd = rad; for (const p of this.points) { if (p.al < 0.2) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; }

  tag(id, text, x, y, cls = "") {
    let el = this.tags.get(id);
    if (!el) { el = document.createElement("div"); this.overlay.appendChild(el); this.tags.set(id, el); }
    el.className = "tag " + cls; if (el.textContent !== text) el.textContent = text;
    el.style.left = x + "px"; el.style.top = y + "px"; el.style.opacity = 1; el._seen = this.frames;
  }
  clearTags() { for (const el of this.tags.values()) el.remove(); this.tags.clear(); }

  setScene(scene, api) {
    this.scene?.leave?.(this); this.clearTags();
    this.scene = scene; this.api = api; this.st = 0; this.minds = []; this.links = []; this.linkAmt = 0; this.jitter = 1; // scene clock, seconds
    scene.enter?.(this, api); scene.layout?.(this); this.kick();
  }
  // reduced motion: no loop; settle and draw once whenever something changes
  kick() { if (this.reduced) { this.st = Math.max(this.st, 999); for (let i = 0; i < 140; i++) this.step(1 / 30, true); this.draw(); } }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.reduced && !document.hidden) { this.st += dt; this.step(dt); this.draw(); }
    else if (this.reduced && this.frames === 0) this.kick();
    this.fpsAcc = lerp(this.fpsAcc ?? 60, 1 / Math.max(dt, 0.001), 0.05);
    requestAnimationFrame(n => this.loop(n));
  }

  step(dt, calm = false) {
    this.t += dt; const t = this.t, m = this.mouse, f = dt * 60, jit = calm ? 0 : this.jitter;
    for (const c of this.clusters) {
      const before = c.hard, rate = calm ? 1 : 1 - Math.pow(0.04, dt);
      c.hard = lerp(c.hard, c.hardT, rate * 0.9);
      if (before < 0.72 && c.hard >= 0.72) c.flash = 1;            // the moment it sets
      if (before > 0.5 && c.hard <= 0.5 && !calm) for (const p of c.members) { p.vx += p.ox * 1.6; p.vy += p.oy * 1.6; } // thaw
      c.flash *= Math.pow(0.03, dt);
      const colT = c.up ? 1 : c.noCollapse ? 0 : smooth(0.8, 0.98, c.hard);
      c.col = lerp(c.col, colT, calm ? 1 : 1 - Math.pow(0.02, dt));
      c.mem = lerp(c.mem, c.memT, calm ? 1 : 1 - Math.pow(0.05, dt));
      if (c.tx !== undefined) { c.x = lerp(c.x, c.tx, rate * 0.6); c.y = lerp(c.y, c.ty, rate * 0.6); }
    }
    for (const p of this.points) {
      p.al = lerp(p.al, p.a, calm ? 1 : 0.06 * f); p.lit *= Math.pow(0.25, dt);
      const c = p.c >= 0 ? this.clusters[p.c] : null;
      if (p.hold) { p.vx = p.vy = 0; continue; }
      if (c) {
        const soft = 1 - c.hard, wob = 1 + soft * 0.5 * Math.sin(t * 0.5 + p.ph) * (calm ? 0.3 : 1);
        const sc = c.r * 0.92 * wob * (1 - 0.9 * c.col);
        const tx = c.x + p.ox * sc * (c.sx ?? 1), ty = c.y + p.oy * sc, k = lerp(0.006, 0.07, c.hard);
        p.vx += (tx - p.x) * k * f; p.vy += (ty - p.y) * k * f;
        p.vx += (rnd(p.i, Math.floor(t * 3)) - 0.5) * soft * 0.5 * jit; p.vy += (rnd(p.i + 9, Math.floor(t * 3)) - 0.5) * soft * 0.5 * jit;
      } else {
        const b = p.free || { x: this.W / 2, y: this.H / 2, w: this.W, h: this.H };
        p.vx += Math.cos(t * 0.23 + p.ph) * 0.012 * jit + (rnd(p.i, Math.floor(t * 2)) - 0.5) * 0.06 * jit;
        p.vy += Math.sin(t * 0.19 + p.ph * 1.7) * 0.012 * jit + (rnd(p.i + 5, Math.floor(t * 2)) - 0.5) * 0.06 * jit;
        const hx = b.x + (p.fx - 0.5) * b.w, hy = b.y + (p.fy - 0.5) * b.h, kk = calm ? 0.08 : 0.0009;
        p.vx += (hx - p.x) * kk * f; p.vy += (hy - p.y) * kk * f;
      }
      if (m.on && !calm) { const dx = p.x - m.x, dy = p.y - m.y, d2 = dx * dx + dy * dy; if (d2 < 9000) { const s = (1 - d2 / 9000) * 0.9 * (c ? 1 - c.hard * 0.9 : 1) / (Math.sqrt(d2) + 1); p.vx += dx * s; p.vy += dy * s; } }
      const damp = calm ? 0.6 : c ? 0.86 : 0.965; p.vx *= damp; p.vy *= damp; p.x += p.vx * f; p.y += p.vy * f;
    }
    this.scene?.update?.(this, dt, this.st);
  }

  membrane(c, color, alpha, width, wobble, glow = 0) {
    const g = this.ctx, t = this.t; g.beginPath();
    for (let s = 0; s <= 56; s++) {
      const a = s / 56 * 6.2832, r = (c.r + 7) * (1 - 0.5 * c.col) * (1 + wobble * (0.05 * Math.sin(3 * a + t * 0.9 + c.k) + 0.035 * Math.sin(5 * a - t * 0.6 + c.k * 2)));
      const x = c.x + Math.cos(a) * r * (c.sx ?? 1), y = c.y + Math.sin(a) * r; s ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); glowStroke(g, color, alpha, width, glow);
  }

  draw() {
    const g = this.ctx; this.frames++; g.clearRect(0, 0, this.W, this.H);
    const cam = this.cam; if (cam) { g.save(); g.translate(this.W / 2, this.H / 2); g.scale(cam.k, cam.k); g.translate(-cam.x, -cam.y); }
    this.scene?.under?.(this, g, this.st);
    for (const md of this.minds) { g.beginPath(); g.arc(md.x, md.y, md.r, 0, 6.2832); g.strokeStyle = rgba(PALE, md.a ?? 0.1); g.lineWidth = 1; g.setLineDash([2, 6]); g.stroke(); g.setLineDash([]); if (md.fill) { g.fillStyle = rgba(PALE, 0.02); g.fill(); } }
    g.globalCompositeOperation = "lighter";
    // links that cross membranes, drawn as arcs
    if (this.linkAmt > 0.01) for (const l of this.links) {
      const a = clamp((this.linkAmt - l.th * 0.8) * 4) * 0.22 + l.lit * 0.7; if (a < 0.01 || l.p.c < 0) continue; l.lit *= 0.94;
      const mx = (l.p.x + l.q.x) / 2, my = (l.p.y + l.q.y) / 2, dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
      g.beginPath(); g.moveTo(l.p.x, l.p.y); g.quadraticCurveTo(mx - dy * 0.22, my + dx * 0.22, l.q.x, l.q.y);
      g.strokeStyle = rgba(WARM, a); g.lineWidth = 0.7 + l.lit; g.stroke();
    }
    for (const c of this.clusters) {
      if (c.mem < 0.02 || c.hidden) continue;
      const col = c.color || mix(WARM, COOL, smooth(0.35, 0.8, c.hard)), a = (lerp(0.16, 0.85, c.hard) * c.mem + c.flash * 0.5) * (c.vis ?? 1);
      this.membrane(c, col, a, lerp(0.7, 2.1, c.hard) + c.flash * 2, 1 - c.hard, smooth(0.45, 0.9, c.hard) + c.flash);
    }
    for (const p of this.points) {
      const c = p.c >= 0 ? this.clusters[p.c] : null, a = p.al * (c ? (1 - c.col * 0.97) * (c.vis ?? 1) : 1) * (c?.hidden ? 0 : 1); if (a < 0.02 && p.lit < 0.02) continue;
      const s = (5 + p.lit * 10) * p.size; g.globalAlpha = clamp(a * 0.85 + p.lit * (c ? c.vis ?? 1 : 1));
      g.drawImage(this.spr[p.kind], p.x - s, p.y - s, s * 2, s * 2);
    }
    for (const c of this.clusters) {
      if (c.col < 0.03 || c.hidden) continue; const s = (10 + Math.sqrt(c.members.length) * 1.7) * c.col * (1 + c.flash * 0.3);
      g.globalAlpha = clamp(c.col * 1.1) * (c.vis ?? 1); g.drawImage(this.spr[c.sprite || "cool"], c.x - s * 1.6, c.y - s * 1.6, s * 3.2, s * 3.2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    this.scene?.draw?.(this, g, this.st);
    if (cam) g.restore();
    for (const el of this.tags.values()) if (el._seen !== this.frames) el.style.opacity = 0;
  }
}
