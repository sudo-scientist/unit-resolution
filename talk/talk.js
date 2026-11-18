(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var SEED = 20261;        // fixed, so the field is the same on every load
  var SQUEEZE = 0.76;      // how far dots pull toward their group at the left end
  var BG = '#06070b';

  /* ---------- small tools ---------- */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Shortest signed arc from hue a to hue b, in degrees.
  function arc(a, b) { return ((b - a) % 360 + 540) % 360 - 180; }

  // OKLCH to sRGB bytes. Even lightness and saturation, so no hue dominates.
  function enc(v) {
    v = clamp(v, 0, 1);
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(v * 255);
  }
  function shade(L, C, h) {
    var hr = h * Math.PI / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
    var l = L + 0.3963377774 * a + 0.2158037573 * b;
    var m = L - 0.1055613458 * a - 0.0638541728 * b;
    var s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [
      enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      enc(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }
  function paintName(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  var calm = false;
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    calm = mq.matches;
    var onCalm = function (ev) { calm = ev.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onCalm);
    else if (mq.addListener) mq.addListener(onCalm);
  }

  /* ---------- the network ---------- */

  function convex(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function turn(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], hi = [], i;
    for (i = 0; i < pts.length; i++) {
      while (lo.length >= 2 && turn(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop();
      lo.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (hi.length >= 2 && turn(hi[hi.length - 2], hi[hi.length - 1], pts[i]) <= 0) hi.pop();
      hi.push(pts[i]);
    }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  // A smooth closed line through a ring of points.
  function ringPath(ring) {
    var cut = [], m = ring.length, j, a, b;
    for (j = 0; j < m; j++) {
      a = ring[j]; b = ring[(j + 1) % m];
      cut.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      cut.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    m = cut.length;
    var path = new Path2D();
    path.moveTo((cut[m - 1][0] + cut[0][0]) / 2, (cut[m - 1][1] + cut[0][1]) / 2);
    for (j = 0; j < m; j++) {
      b = cut[(j + 1) % m];
      path.quadraticCurveTo(cut[j][0], cut[j][1], (cut[j][0] + b[0]) / 2, (cut[j][1] + b[1]) / 2);
    }
    path.closePath();
    return path;
  }

  function build(w, h) {
    var rand = rng(SEED);
    var n = Math.round(clamp(w * h / 1500, 110, 420));
    var gap = Math.sqrt(w * h / n);
    var x = new Float32Array(n), y = new Float32Array(n);
    var i, j, c, g, d, dx, dy, m, best, bx = 0, by = 0, l, s;

    // Dots: best of several tries each, which spaces them out organically.
    for (i = 0; i < n; i++) {
      best = -1;
      for (c = 0; c < 14; c++) {
        var px = rand() * w, py = rand() * h;
        m = Infinity;
        for (j = 0; j < i; j++) {
          dx = x[j] - px; dy = y[j] - py; d = dx * dx + dy * dy;
          if (d < m) m = d;
        }
        if (m > best) { best = m; bx = px; by = py; }
      }
      x[i] = bx; y[i] = by;
    }

    // Groups: spread seeds, then settle them on the dots they own.
    var k = Math.round(clamp(n / 22, 6, 16));
    var cx = new Float32Array(k), cy = new Float32Array(k), pull = new Float32Array(k);
    var grp = new Int16Array(n);
    var far = new Float32Array(n), pick = Math.floor(rand() * n);
    for (i = 0; i < n; i++) far[i] = Infinity;
    for (c = 0; c < k; c++) {
      cx[c] = x[pick]; cy[c] = y[pick]; pull[c] = 0.9 + rand() * 0.22;
      best = -1;
      for (i = 0; i < n; i++) {
        dx = x[i] - cx[c]; dy = y[i] - cy[c]; d = dx * dx + dy * dy;
        if (d < far[i]) far[i] = d;
        if (far[i] > best) { best = far[i]; pick = i; }
      }
    }
    for (var pass = 0; pass < 10; pass++) {
      var sx = new Float32Array(k), sy = new Float32Array(k), sn = new Float32Array(k);
      for (i = 0; i < n; i++) {
        best = Infinity;
        for (c = 0; c < k; c++) {
          dx = x[i] - cx[c]; dy = y[i] - cy[c]; d = (dx * dx + dy * dy) * pull[c];
          if (d < best) { best = d; grp[i] = c; }
        }
        sx[grp[i]] += x[i]; sy[grp[i]] += y[i]; sn[grp[i]]++;
      }
      for (c = 0; c < k; c++) if (sn[c]) { cx[c] = sx[c] / sn[c]; cy[c] = sy[c] / sn[c]; }
    }
    var mem = [];
    for (c = 0; c < k; c++) mem.push([]);
    for (i = 0; i < n; i++) mem[grp[i]].push(i);

    // Hue is detail: smooth across the field, with small local differences.
    var hue = new Float32Array(n), h0 = rand() * 360;
    for (i = 0; i < n; i++) {
      var p = x[i] / w, q = y[i] / h;
      hue[i] = (h0 + 300 * (p * 0.88 + q * 0.48) +
        30 * Math.sin(p * 5.1 + 1.3) * Math.cos(q * 4.3 + 0.4) +
        (rand() - 0.5) * 16 + 720) % 360;
    }

    // Strays: in about one group in four, a few dots that do not match.
    var stray = new Uint8Array(n), has = new Uint8Array(k), order = [];
    for (c = 0; c < k; c++) order.push(c);
    for (c = k - 1; c > 0; c--) { j = Math.floor(rand() * (c + 1)); m = order[c]; order[c] = order[j]; order[j] = m; }
    var want = Math.round(k / 4);
    var byMiddle = function (gi) {
      return mem[gi].slice().sort(function (a, b) {
        return (Math.pow(x[a] - cx[gi], 2) + Math.pow(y[a] - cy[gi], 2)) -
               (Math.pow(x[b] - cx[gi], 2) + Math.pow(y[b] - cy[gi], 2));
      });
    };
    for (c = 0; c < want; c++) {
      g = order[c];
      var inner = byMiddle(g);
      inner.length = Math.max(3, Math.floor(inner.length * 0.55));
      var count = 1 + Math.floor(rand() * 3);
      while (count-- > 0 && inner.length) {
        stray[inner.splice(Math.floor(rand() * inner.length), 1)[0]] = 1;
      }
      has[g] = 1;
    }

    // The flat color of a group: the average hue of the dots that belong.
    var flat = new Float32Array(k);
    for (g = 0; g < k; g++) {
      var ax = 0, ay = 0;
      for (j = 0; j < mem[g].length; j++) {
        i = mem[g][j];
        if (stray[i]) continue;
        ax += Math.cos(hue[i] * Math.PI / 180); ay += Math.sin(hue[i] * Math.PI / 180);
      }
      flat[g] = (Math.atan2(ay, ax) * 180 / Math.PI + 360) % 360;
    }
    for (i = 0; i < n; i++) {
      if (stray[i]) hue[i] = (flat[grp[i]] + 180 + (rand() - 0.5) * 60 + 360) % 360;
    }

    // Links: a few near neighbors each, plus a small number of longer ones.
    var seen = {}, la = [], lb = [], reach = [];
    function join(a, b, isLong) {
      if (a === b) return false;
      var lo = Math.min(a, b), hi = Math.max(a, b), key = lo * n + hi;
      if (seen[key]) return false;
      seen[key] = 1; la.push(lo); lb.push(hi); reach.push(isLong ? 1 : 0);
      return true;
    }
    for (i = 0; i < n; i++) {
      var n1 = -1, n2 = -1, n3 = -1, d1 = Infinity, d2 = Infinity, d3 = Infinity;
      for (j = 0; j < n; j++) {
        if (j === i) continue;
        dx = x[j] - x[i]; dy = y[j] - y[i]; d = dx * dx + dy * dy;
        if (d < d1) { d3 = d2; n3 = n2; d2 = d1; n2 = n1; d1 = d; n1 = j; }
        else if (d < d2) { d3 = d2; n3 = n2; d2 = d; n2 = j; }
        else if (d < d3) { d3 = d; n3 = j; }
      }
      join(i, n1); join(i, n2); join(i, n3);
    }
    var extra = Math.round(n * 0.035), tries = 0;
    while (extra > 0 && tries++ < 6000) {
      i = Math.floor(rand() * n); j = Math.floor(rand() * n);
      d = Math.sqrt(Math.pow(x[i] - x[j], 2) + Math.pow(y[i] - y[j], 2));
      if (d > 2.5 * gap && d < 5.5 * gap && join(i, j, true)) extra--;
    }
    var ln = la.length;
    var A = new Int32Array(la), B = new Int32Array(lb);
    var base = new Float32Array(ln), inside = new Uint8Array(ln);
    for (l = 0; l < ln; l++) {
      var same = grp[A[l]] === grp[B[l]];
      inside[l] = same ? 1 : 0;
      base[l] = same ? 0.7 + 0.3 * rand() : (reach[l] ? 0.3 + 0.25 * rand() : 0.15 + 0.25 * rand());
      if (same && (stray[A[l]] || stray[B[l]])) base[l] = 1;   // strays are strongly linked in
      var ang = Math.atan2(y[B[l]] - y[A[l]], x[B[l]] - x[A[l]]);
      var mx = (x[A[l]] + x[B[l]]) / 2 / w, my = (y[A[l]] + y[B[l]]) / 2 / h;
      // Links that run one way are a little stronger, and the way bends across the field.
      var th = 0.3 + 0.9 * Math.sin(mx * 3.1) * Math.cos(my * 2.7);
      var r = 0.62 * (0.5 + 0.5 * Math.cos(2 * (ang - th))) + 0.38 * rand();
      base[l] *= 0.22 + 1.75 * Math.pow(r, 1.4);
    }

    // Which links leave each dot.
    var start = new Int32Array(n + 1), fill = new Int32Array(n);
    for (l = 0; l < ln; l++) { start[A[l] + 1]++; start[B[l] + 1]++; }
    for (i = 0; i < n; i++) start[i + 1] += start[i];
    var viaLink = new Int32Array(ln * 2), viaDot = new Int32Array(ln * 2);
    for (l = 0; l < ln; l++) {
      viaLink[start[A[l]] + fill[A[l]]] = l; viaDot[start[A[l]] + fill[A[l]]++] = B[l];
      viaLink[start[B[l]] + fill[B[l]]] = l; viaDot[start[B[l]] + fill[B[l]]++] = A[l];
    }

    // The outline of each group: a smooth closed line that hugs its dots.
    var edge = [], rings = [], flatPaint = [], edgePaint = [], pad = gap * 0.36;
    for (g = 0; g < k; g++) {
      var pts = [];
      for (j = 0; j < mem[g].length; j++) pts.push([x[mem[g][j]] - cx[g], y[mem[g][j]] - cy[g]]);
      // Measure how far the group reaches in every direction, soften that
      // into a rounded shape, then let it out until every dot is inside.
      var hull = convex(pts), hm = hull.length, ring = [], far0 = [], far1, short = 0, turns = 72;
      for (j = 0; j < turns; j++) {
        var dirx = Math.cos(j / turns * TAU), diry = Math.sin(j / turns * TAU), hit = 0;
        for (c = 0; c < hm; c++) {
          var P = hull[c], Q = hull[(c + 1) % hm];
          var ex = Q[0] - P[0], ey = Q[1] - P[1], den = dirx * ey - diry * ex;
          if (Math.abs(den) < 1e-9) continue;
          var along = (P[0] * ey - P[1] * ex) / den, on = (P[0] * diry - P[1] * dirx) / den;
          if (along > 0 && on >= -1e-6 && on <= 1 + 1e-6 && along > hit) hit = along;
        }
        far0.push(hit);
      }
      far1 = far0.slice();
      for (var soften = 0; soften < 10; soften++) {
        var prev = far1.slice();
        for (j = 0; j < turns; j++) {
          far1[j] = (prev[(j + turns - 1) % turns] + 2 * prev[j] + prev[(j + 1) % turns]) / 4;
        }
      }
      for (j = 0; j < turns; j++) short = Math.max(short, far0[j] - far1[j]);
      for (j = 0; j < turns; j++) {
        d = far1[j] + short + pad;
        ring.push([d * Math.cos(j / turns * TAU), d * Math.sin(j / turns * TAU)]);
      }
      edge.push(ringPath(ring));
      rings.push(ring);
      flatPaint.push(paintName(shade(0.78, 0.15, flat[g])));
      edgePaint.push(paintName(shade(0.9, 0.09, flat[g])));
    }

    // How far the groups must have pulled in before their outlines can be
    // drawn with a clear dark gap between every pair. Outlines only appear
    // once the dots are past this point, so two outlines never meet.
    var clear = Math.max(8, gap * 0.26), lo = 0.5, hi = 1, fit;
    var meets = function (q) {
      for (var ga = 0; ga < k; ga++) for (var gb = ga + 1; gb < k; gb++) {
        var ra = rings[ga], rb = rings[gb];
        for (var pa = 0; pa < ra.length; pa++) {
          var ax = cx[ga] + ra[pa][0] * q, ay = cy[ga] + ra[pa][1] * q;
          for (var pb = 0; pb < rb.length; pb++) {
            var ex = cx[gb] + rb[pb][0] * q - ax, ey = cy[gb] + rb[pb][1] * q - ay;
            if (ex * ex + ey * ey < clear * clear) return true;
          }
        }
      }
      return false;
    };
    for (c = 0; c < 12; c++) { fit = (lo + hi) / 2; if (meets(fit)) hi = fit; else lo = fit; }
    fit = lo;

    // Per-dot motion and size.
    var f1 = new Float32Array(n), f2 = new Float32Array(n), p1 = new Float32Array(n), p2 = new Float32Array(n);
    var rad = new Float32Array(n), r0 = clamp(gap * 0.07, 1.7, 3.1);
    for (i = 0; i < n; i++) {
      f1[i] = 0.45 + rand() * 0.5; f2[i] = 0.45 + rand() * 0.5;
      p1[i] = rand() * TAU; p2[i] = rand() * TAU;
      rad[i] = r0 * (0.82 + rand() * 0.4);
    }

    // The order the Touch control walks through: one settled dot per group.
    var walk = [];
    for (c = 0; c < k; c++) {
      var mid = byMiddle(order[c]);
      for (j = 0; j < mid.length; j++) if (!stray[mid[j]]) { walk.push(mid[j]); break; }
    }

    for (c = walk.length - 1; c > 0; c--) { j = Math.floor(rand() * (c + 1)); m = walk[c]; walk[c] = walk[j]; walk[j] = m; }

    return {
      n: n, k: k, ln: ln, gap: gap, w: w, h: h,
      x: x, y: y, grp: grp, hue: hue, stray: stray, has: has, flat: flat, mem: mem,
      cx: cx, cy: cy, A: A, B: B, base: base, inside: inside, q: fit, squeeze: Math.min(SQUEEZE, fit - 0.06), clear: clear,
      start: start, viaLink: viaLink, viaDot: viaDot,
      edge: edge, flatPaint: flatPaint, edgePaint: edgePaint,
      f1: f1, f2: f2, p1: p1, p2: p2, rad: rad, walk: walk
    };
  }

  /* ---------- shared ---------- */

  var now = 0;                                       // seconds of visible running time
  var glowSprite = [], bloomSprite = null;

  function makeSprites() {
    for (var b = 0; b < 36; b++) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'), col = shade(0.78, 0.15, b * 10);
      var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      var rgb = col[0] + ',' + col[1] + ',' + col[2];
      grad.addColorStop(0, 'rgba(' + rgb + ',0.6)');
      grad.addColorStop(0.22, 'rgba(' + rgb + ',0.22)');
      grad.addColorStop(0.55, 'rgba(' + rgb + ',0.05)');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      glowSprite.push(c);
    }
    bloomSprite = document.createElement('canvas'); bloomSprite.width = bloomSprite.height = 96;
    var bg = bloomSprite.getContext('2d'), bgrad = bg.createRadialGradient(48, 48, 0, 48, 48, 48);
    bgrad.addColorStop(0, 'rgba(255,255,255,0.85)');
    bgrad.addColorStop(0.12, 'rgba(255,255,255,0.38)');
    bgrad.addColorStop(0.4, 'rgba(255,255,255,0.09)');
    bgrad.addColorStop(1, 'rgba(255,255,255,0)');
    bg.fillStyle = bgrad; bg.fillRect(0, 0, 96, 96);
  }

  /* ---------- one mind: a field with its own slider ---------- */

  function makeField(canvas, sliderEl, onSlide) {
    var ctx = canvas.getContext('2d');
    var net = null, vw = 0, vh = 0, dpr = 1, fx = 0, fy = 0;
    var u = 0, e = 0, seal = 0;
    var X, Y, light, tile, hold, open, grow, scale, paint, bucket, w, wAlpha;
    var mark, since, level, heldSet;     // what each dot is showing once both sides have lit
    var paintStale = true, weightStale = true;
    var touches = [];
    var sGoal = sliderEl.value / 1000, sNow = -1;

    sliderEl.addEventListener('input', function () {
      sGoal = clamp(sliderEl.value / 1000, 0, 1);
      if (sGoal <= 0.04) sliderEl.setAttribute('aria-valuetext', 'Tight');
      else if (sGoal >= 0.96) sliderEl.setAttribute('aria-valuetext', 'Loose');
      else sliderEl.removeAttribute('aria-valuetext');
      onSlide();
    });

    // One rule for the whole slider. In the middle a link is as strong as it was
    // made. Toward the left, links inside a group lock on and links
    // out of it let go. Toward the right, every link pulls about the same.
    function weigh() {
      for (var l = 0; l < net.ln; l++) {
        var v = lerp(net.base[l], 0.7, e);
        w[l] = net.inside[l] ? lerp(v, 1, u) : v * (1 - u) * (1 - u);
      }
      weightStale = false;
    }

    // How bright a lit dot is, tau seconds after the light reaches it.
    function glow(tau) {
      if (tau <= 0) return 0;
      if (tau < 0.12) return smooth(tau / 0.12);
      var x = (tau - 0.12) / 2.1;
      return x >= 1 ? 0 : (1 - x) * (1 - x);
    }

    // Work out where one touch reaches. The touch has a fixed amount of light.
    // Each lit dot hands what it has to the dots beyond it, shared out by link
    // strength, so the more ways it branches the dimmer each branch.
    function spread(T) {
      var n = net.n, en = T.en, dep = T.dep, i, j, a, f, v, sum, out, part;
      for (i = 0; i < n; i++) { en[i] = 0; dep[i] = -1; }
      var keep = lerp(lerp(0.82, 0.97, e), 1, u);       // what survives each step
      var least = lerp(0.01, 0.003, e);                 // below this, light is gone
      var drag = 0.2 * (1 - e) * (1 - u);
      var front = [T.dot], d = 0;
      en[T.dot] = 1; dep[T.dot] = 0;
      while (front.length && d < 48) {
        var next = [];
        for (f = 0; f < front.length; f++) {
          i = front[f];
          if (en[i] < least) continue;
          sum = 0;
          for (a = net.start[i]; a < net.start[i + 1]; a++) {
            j = net.viaDot[a];
            if (dep[j] < 0 || dep[j] === d + 1) { v = w[net.viaLink[a]]; sum += v * v; }
          }
          if (sum < 1e-6) continue;
          out = en[i] * keep * sum / (sum + drag);
          for (a = net.start[i]; a < net.start[i + 1]; a++) {
            j = net.viaDot[a];
            if (dep[j] >= 0 && dep[j] !== d + 1) continue;
            v = w[net.viaLink[a]];
            part = out * v * v / sum;
            if (dep[j] < 0) {
              if (part < least * 0.5) continue;
              dep[j] = d + 1; next.push(j);
            }
            en[j] += part;
          }
        }
        front = next; d++;
      }

      // Turn that into what is shown. Toward the left end the touched group
      // takes over: all of it, evenly, at once, and nothing outside it.
      var pace = clamp(0.8 / Math.max(1, d), 0.035, 0.13) * Math.pow(1 - u, 1.5);
      if (calm) pace = 0;
      var home = net.grp[T.dot], cap = 1 - 0.45 * e;
      T.far = 0;
      for (i = 0; i < n; i++) {
        var seen = dep[i] >= 0 ? Math.min(cap, 1.15 * Math.sqrt(en[i])) : 0;
        if (seen < 0.04) seen = 0;
        T.show[i] = lerp(seen, net.grp[i] === home ? 1 : 0, u);
        T.due[i] = (dep[i] >= 0 ? dep[i] : d) * pace;
        if (T.show[i] > 0 && T.due[i] > T.far) T.far = T.due[i];
      }
    }

    function tint() {
      for (var i = 0; i < net.n; i++) {
        var g = net.grp[i], ue = seal * (1 - open[g]);
        var h = (net.hue[i] + arc(net.hue[i], net.flat[g]) * ue + 360) % 360;
        paint[i] = paintName(shade(0.78, 0.15, h));
        bucket[i] = Math.round(h / 10) % 36;
      }
      paintStale = false;
    }

    function draw() {
      var n = net.n, i, g, l, b, a, k;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, vw, vh);

      // Where every dot is right now.
      var amp = calm ? 0 : net.gap * 0.085;
      // Dots gather first, so the gaps are already there when outlines arrive.
      var gather = 1 - Math.pow(1 - u, 4), pulled = lerp(1, net.squeeze, gather);
      var sealNow = smooth((net.q - pulled) / (net.q - net.squeeze));
      if (sealNow !== seal) { seal = sealNow; paintStale = true; }
      for (g = 0; g < net.k; g++) scale[g] = lerp(pulled, 1.08, open[g]);
      for (i = 0; i < n; i++) {
        g = net.grp[i]; k = scale[g];
        X[i] = fx + net.cx[g] + (net.x[i] - net.cx[g]) * k + amp * Math.sin(now * net.f1[i] + net.p1[i]);
        Y[i] = fy + net.cy[g] + (net.y[i] - net.cy[g]) * k + amp * Math.cos(now * net.f2[i] + net.p2[i]);
      }

      // Tiles: the flat color of each group, stronger toward the left end.
      for (g = 0; g < net.k; g++) {
        a = seal * (1 - open[g]);
        if (a < 0.004) continue;
        k = scale[g];
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (fx + net.cx[g]), dpr * (fy + net.cy[g]));
        ctx.globalCompositeOperation = 'source-over';
        var lift = Math.min(1, tile[g]);
        ctx.globalAlpha = Math.pow(a, 1.3) * (0.34 + 0.6 * lift);
        ctx.fillStyle = net.flatPaint[g];
        if (lift > 0.01) {
          // A lit tile blooms a little past its own outline.
          ctx.shadowColor = net.flatPaint[g];
          ctx.shadowBlur = 46 * dpr * lift;
        }
        ctx.fill(net.edge[g]);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';

      // Links at rest, drawn in a few bands of faintness.
      var levels = 8;
      for (l = 0; l < net.ln; l++) {
        var og = Math.max(open[net.grp[net.A[l]]], open[net.grp[net.B[l]]]);
        a = 0.035 + 0.17 * Math.min(w[l], 1.6) / 1.6;
        a *= 1 - (net.inside[l] ? 0.75 : 0.8) * u * (1 - og);
        wAlpha[l] = Math.min(levels, Math.round(a / 0.21 * levels));
      }
      ctx.strokeStyle = 'rgb(188,200,230)';
      ctx.lineWidth = 1;
      for (b = 1; b <= levels; b++) {
        ctx.globalAlpha = b / levels * 0.21;
        ctx.beginPath();
        for (l = 0; l < net.ln; l++) if (wAlpha[l] === b) {
          ctx.moveTo(X[net.A[l]], Y[net.A[l]]); ctx.lineTo(X[net.B[l]], Y[net.B[l]]);
        }
        ctx.stroke();
      }

      // Links carrying light.
      for (l = 0; l < net.ln; l++) {
        a = Math.sqrt(Math.min(1, light[net.A[l]]) * Math.min(1, light[net.B[l]]));
        a *= 1 - 0.93 * seal * (1 - Math.max(open[net.grp[net.A[l]]], open[net.grp[net.B[l]]]));
        wAlpha[l] = a < 0.03 ? 0 : Math.max(1, Math.min(levels, Math.round(a * levels)));
      }
      ctx.strokeStyle = 'rgb(240,244,255)';
      for (b = 1; b <= levels; b++) {
        ctx.globalAlpha = b / levels * 0.8;
        ctx.lineWidth = 0.8 + 1.8 * b / levels;
        ctx.beginPath();
        for (l = 0; l < net.ln; l++) if (wAlpha[l] === b) {
          ctx.moveTo(X[net.A[l]], Y[net.A[l]]); ctx.lineTo(X[net.B[l]], Y[net.B[l]]);
        }
        ctx.stroke();
      }

      // Dots: a soft halo, a core in the dot's own color, and white where lit.
      if (paintStale) tint();
      for (i = 0; i < n; i++) {
        g = net.grp[i];
        var fade = Math.max(1 - 0.9 * seal, mark[i] === 1 || mark[i] === 2 ? 0.92 * level[i] : 0);
        b = Math.min(1, light[i]);
        var r = net.rad[i] * (1 + 0.9 * grow[i]);
        var hs = r * (7 + 16 * b);
        ctx.globalAlpha = Math.min(1, (0.2 + 0.45 * open[g] + 0.8 * b) * fade);
        ctx.drawImage(glowSprite[bucket[i]], X[i] - hs, Y[i] - hs, hs * 2, hs * 2);
        if (b > 0.02) {
          hs = r * (6 + 19 * b);
          ctx.globalAlpha = b * fade;
          ctx.drawImage(bloomSprite, X[i] - hs, Y[i] - hs, hs * 2, hs * 2);
        }
        ctx.globalAlpha = fade;
        ctx.fillStyle = paint[i];
        ctx.beginPath(); ctx.arc(X[i], Y[i], r, 0, TAU); ctx.fill();
        if (b > 0.02) {
          ctx.globalAlpha = b * 0.9 * fade;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(X[i], Y[i], r * 1.08, 0, TAU); ctx.fill();
        }
      }

      // Outlines: soft and wide at first, a hard line at the left end.
      var soft = 1 - seal, wide = Math.min(15, net.clear * 0.8);
      for (g = 0; g < net.k; g++) {
        var lit = Math.min(1, tile[g]);
        a = (1 - open[g]) * (Math.pow(seal, 2) * (0.5 + 0.5 * lit) + 0.6 * lit * Math.sqrt(seal) * soft);
        if (a < 0.004) continue;
        k = scale[g];
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (fx + net.cx[g]), dpr * (fy + net.cy[g]));
        ctx.strokeStyle = net.edgePaint[g];
        if (soft > 0.02) {
          ctx.globalAlpha = a * 0.16; ctx.lineWidth = (1.5 + wide * soft) / k; ctx.stroke(net.edge[g]);
          ctx.globalAlpha = a * 0.32; ctx.lineWidth = (1.5 + wide * 0.4 * soft) / k; ctx.stroke(net.edge[g]);
        }
        ctx.globalAlpha = Math.min(1, a); ctx.lineWidth = (1.5 + 2 * soft) / k; ctx.stroke(net.edge[g]);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function fit() {
      var box = canvas.getBoundingClientRect(), edge = Math.max(18, Math.min(box.width, box.height) * 0.05);
      vw = box.width; vh = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      fx = fy = edge;
      net = build(Math.max(80, vw - edge * 2), Math.max(80, vh - edge * 2));
      X = new Float32Array(net.n); Y = new Float32Array(net.n);
      light = new Float32Array(net.n); grow = new Float32Array(net.n);
      paint = new Array(net.n); bucket = new Uint8Array(net.n);
      mark = new Uint8Array(net.n); since = new Float32Array(net.n); level = new Float32Array(net.n);
      tile = new Float32Array(net.k); hold = new Float32Array(net.k);
      open = new Float32Array(net.k); scale = new Float32Array(net.k); heldSet = new Uint8Array(net.k);
      w = new Float32Array(net.ln); wAlpha = new Uint8Array(net.ln);
      touches.length = 0; sNow = -1;
      paintStale = weightStale = true;
    }

    function follow(dt) {
      var before = sNow;
      if (calm || sNow < 0) sNow = sGoal;
      else {
        sNow += (sGoal - sNow) * (1 - Math.exp(-dt * 12));
        if (Math.abs(sGoal - sNow) < 0.0004) sNow = sGoal;
      }
      if (sNow !== before) {
        u = smooth((0.5 - sNow) / 0.46);
        e = smooth((sNow - 0.5) / 0.46);
        weightStale = paintStale = true;
      }
    }

    function touch(i) {
      var T = {
        dot: i, at: now, far: 0,
        en: new Float32Array(net.n), dep: new Int16Array(net.n),
        show: new Float32Array(net.n), due: new Float32Array(net.n)
      };
      follow(0);
      if (weightStale) weigh();
      spread(T);
      touches.push(T);
      if (touches.length > 5) touches.shift();
      heldSet[net.grp[i]] = 1;
      return T;
    }

    // 1 holds steady, 2 pulses, 3 is a faint ring, 0 is nothing.
    function setMark(i, kind, when) {
      if (mark[i] === kind) return;
      var keep = mark[i] && kind && mark[i] !== 3 && kind !== 3;
      mark[i] = kind;
      if (!keep) since[i] = when;
    }

    function clear() {
      for (var i = 0; i < net.n; i++) mark[i] = 0;
      for (var g = 0; g < net.k; g++) heldSet[g] = 0;
      touches.length = 0;
    }

    function step(dt) {
      var n = net.n, i, g, t, T, age, tau;
      follow(dt);
      if (weightStale) { weigh(); for (t = 0; t < touches.length; t++) spread(touches[t]); }
      for (i = 0; i < n; i++) { light[i] = 0; grow[i] = 0; }
      for (g = 0; g < net.k; g++) {
        hold[g] = calm ? heldSet[g] : clamp(hold[g] + (heldSet[g] ? dt * 2.5 : -dt * 1.6), 0, 1);
        tile[g] = 0.42 * smooth(hold[g]);
      }
      for (t = touches.length - 1; t >= 0; t--) {
        T = touches[t]; age = now - T.at;
        if (age > T.far + 2.4) { touches.splice(t, 1); continue; }
        g = net.grp[T.dot];
        tile[g] = Math.max(tile[g], glow(age + 0.06));
        for (i = 0; i < n; i++) {
          if (T.show[i] <= 0) continue;
          tau = age - T.due[i];
          if (tau > 0) light[i] += T.show[i] * glow(tau);
        }
      }
      for (i = 0; i < n; i++) {
        level[i] = 0;
        if (!mark[i]) continue;
        var lv = calm ? (now >= since[i] ? 1 : 0) : smooth((now - since[i]) / 0.6);
        level[i] = lv;
        if (mark[i] === 1) light[i] = Math.max(light[i], 0.55 * lv);
        else if (mark[i] === 2) {
          var beat = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now * TAU * 0.8 + net.p1[i]);
          light[i] = Math.max(light[i], lv * (0.12 + 0.6 * beat));
          grow[i] = 0.4 * beat * lv;
        }
      }
      draw();
      // meant, but never heard: a faint ring where the light did not come
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1.3;
      for (i = 0; i < n; i++) {
        if (mark[i] !== 3 || level[i] <= 0) continue;
        ctx.globalAlpha = 0.62 * level[i];
        ctx.strokeStyle = paint[i];
        ctx.beginPath(); ctx.arc(X[i], Y[i], net.rad[i] * 3.1, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function nearest(px, py) {
      var best = Infinity, at = -1, d;
      for (var i = 0; i < net.n; i++) {
        d = (X[i] - px) * (X[i] - px) + (Y[i] - py) * (Y[i] - py);
        if (d < best) { best = d; at = i; }
      }
      return at;
    }

    function where(i) {
      var box = canvas.getBoundingClientRect();
      return { x: box.left + X[i], y: box.top + Y[i] };
    }

    return {
      fit: fit, step: step, touch: touch, setMark: setMark, clear: clear, nearest: nearest, where: where,
      net: function () { return net; },
      goal: function () { return sGoal; }
    };
  }

  /* ---------- two minds ---------- */

  var canvasA = document.getElementById('net-a'), canvasB = document.getElementById('net-b');
  var meant = null, heard = null;      // which dots have lit on each side so far
  var round = 0;                       // goes up whenever everything is cleared
  var walkAt = 0;

  function wipe() {
    round++;
    if (!meant) return;
    for (var i = 0; i < meant.length; i++) { meant[i] = 0; heard[i] = 0; }
    A.clear(); B.clear();
    var flying = document.querySelectorAll('.spark');
    for (var f = 0; f < flying.length; f++) flying[f].remove();
  }

  var A = makeField(canvasA, document.getElementById('slider-a'), wipe);
  var B = makeField(canvasB, document.getElementById('slider-b'), wipe);

  // A touch in the first mind lights what was meant. Then only the touched
  // dot makes the trip across.
  function send(i) {
    var T = A.touch(i), n = A.net().n, mine = round;
    for (var j = 0; j < n; j++) {
      if (T.show[j] > 0.12) { meant[j] = 1; A.setMark(j, 1, now + T.due[j] + 0.5); }
    }
    signal('sent');
    setTimeout(function () { if (mine === round) fly(i, mine); }, calm ? 200 : 650);
  }

  function fly(i, mine) {
    var from = A.where(i), to = B.where(i);
    if (calm) { land(i); return; }
    var el = document.createElement('div');
    el.className = 'spark';
    document.body.appendChild(el);
    var trip = el.animate([
      { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(0.6)', opacity: 0 },
      { transform: 'translate(' + from.x + 'px,' + from.y + 'px) scale(1)', opacity: 1, offset: 0.12 },
      { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(1)', opacity: 1 }
    ], { duration: 1000, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
    trip.onfinish = function () { el.remove(); if (mine === round) land(i); };
  }

  // The spark lights the same dot in the second mind, by that mind's own
  // packing. Then the two sides are compared, dot by dot.
  function land(i) {
    var T = B.touch(i), n = B.net().n, j;
    var fresh = new Uint8Array(n);
    for (j = 0; j < n; j++) if (T.show[j] > 0.12 && !heard[j]) { heard[j] = 1; fresh[j] = 1; }
    for (j = 0; j < n; j++) {
      if (heard[j]) B.setMark(j, meant[j] ? 1 : 2, now + (fresh[j] ? T.due[j] : 0) + 0.6);
      else if (meant[j]) B.setMark(j, 3, now + T.far + 0.7);
      else B.setMark(j, 0, 0);
    }
    signal('landed');
  }

  canvasA.addEventListener('pointerdown', function (ev) {
    if (!meant || ev.button > 0) return;
    var box = canvasA.getBoundingClientRect();
    send(A.nearest(ev.clientX - box.left, ev.clientY - box.top));
  });
  canvasA.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    var walk = A.net().walk;
    send(walk[walkAt++ % walk.length]);
  });

  /* ---------- the guide ---------- */

  var sayEl = document.getElementById('say');
  var sayTimer = 0, nextTimer = 0, stage = 0, shownAt = 0, count = 0;
  var LINES = {
    intro: 'Two minds. The same details, packed differently.',
    p1: 'Touch a dot in the first mind.',
    a1: "That's what was meant. Only one detail makes the trip across. That's a word.",
    a2: 'This is what was heard.',
    p3: 'Set the second mind to Tight and touch again.',
    a3: 'A whole group came up. Some of it was never meant.',
    p4: 'Send a few more words.',
    a4: 'Each word brings up another whole group.',
    p5: 'Now set the first mind to Tight and the second to Loose.',
    a5: 'A whole group was meant. One detail arrived.',
    end: 'Neither one got it wrong. They pack differently.'
  };

  function show(text) {
    clearTimeout(sayTimer);
    shownAt = Date.now();
    if (calm) { sayEl.textContent = text; return; }
    sayEl.classList.add('out');
    sayTimer = setTimeout(function () { sayEl.textContent = text; sayEl.classList.remove('out'); }, 200);
  }
  function readTime(text) { return Math.max(2800, 1100 + text.length * 50); }
  function then(ms, fn) { clearTimeout(nextTimer); nextTimer = setTimeout(fn, ms); }
  function goTo(n, key) { stage = n; count = 0; show(LINES[key]); }

  // Stages: 0 intro, 1 first touch, 2 waiting for the spark, 3 second mind
  // tight, 4 a few more words, 5 the other way round, 6 the end.
  function signal(what) {
    var tightB = B.goal() <= 0.04;
    if (what === 'sent' && stage <= 1) {
      clearTimeout(nextTimer);
      stage = 2; show(LINES.a1);
    } else if (what === 'landed' && stage === 2) {
      stage = 2.5;
      then(Math.max(700, shownAt + readTime(LINES.a1) - Date.now()), function () {
        show(LINES.a2);
        then(readTime(LINES.a2) + 600, function () { goTo(3, 'p3'); });
      });
    } else if (what === 'landed' && stage === 3 && tightB) {
      stage = 3.5; show(LINES.a3);
      then(readTime(LINES.a3) + 400, function () { goTo(4, 'p4'); });
    } else if (what === 'landed' && stage === 4 && tightB && ++count >= 3) {
      stage = 4.5; show(LINES.a4);
      then(readTime(LINES.a4) + 400, function () { goTo(5, 'p5'); });
    } else if (what === 'landed' && stage === 5 && A.goal() <= 0.04 && B.goal() >= 0.96) {
      stage = 5.5; show(LINES.a5);
      then(readTime(LINES.a5) + 400, function () { goTo(6, 'end'); });
    }
  }

  /* ---------- the loop ---------- */

  var raf = 0, last = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
    last = ms;
    now += dt;
    A.step(dt); B.step(dt);
  }
  function run() { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function rest() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) rest(); else run(); });

  function begin() {
    wipe();
    A.fit(); B.fit();
    meant = new Uint8Array(A.net().n); heard = new Uint8Array(A.net().n);
    run();
  }
  var sizeTimer = 0, builtW = 0, builtH = 0;
  window.addEventListener('resize', function () {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () {
      if (window.innerWidth === builtW && Math.abs(window.innerHeight - builtH) < builtH * 0.14) return;
      builtW = window.innerWidth; builtH = window.innerHeight;
      begin();
    }, 180);
  });

  makeSprites();
  builtW = window.innerWidth; builtH = window.innerHeight;
  begin();
  show(LINES.intro);
  then(readTime(LINES.intro) + 500, function () { if (stage === 0) goTo(1, 'p1'); });
})();
