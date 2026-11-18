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
    var n = Math.round(clamp(w * h / 1700, 240, 640));
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
    var k = Math.round(clamp(n / 32, 12, 20));
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

  /* ---------- state ---------- */

  var canvas = document.getElementById('net');
  var ctx = canvas.getContext('2d');
  var net = null;
  var vw = 0, vh = 0, dpr = 1, fx = 0, fy = 0;      // viewport, and where the field sits in it
  var now = 0;                                       // seconds of visible running time
  var u = 0, e = 0;                                  // how far toward each end of the slider
  var X, Y, light, tile, hold, open, grow, scale, paint, bucket, w, wAlpha;
  var glowSprite = [], bloomSprite = null;
  var sharpCap = 2, slowFrames = 0, slowTime = 0;
  var paintStale = true, weightStale = true;
  var seal = 0;            // 0 while groups are loose, 1 once they are closed tiles

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

  function layout() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, sharpCap);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    var side = Math.max(16, vw * 0.035), top = Math.max(16, vh * 0.035);
    var floor = fieldFloor();
    fx = side; fy = top;
    intro.style.bottom = (vh - floor) + 'px';
    net = build(vw - side * 2, Math.max(120, floor - top - 12));
    X = new Float32Array(net.n); Y = new Float32Array(net.n);
    light = new Float32Array(net.n); grow = new Float32Array(net.n);
    paint = new Array(net.n); bucket = new Uint8Array(net.n);
    tile = new Float32Array(net.k); hold = new Float32Array(net.k); open = new Float32Array(net.k); scale = new Float32Array(net.k);
    w = new Float32Array(net.ln); wAlpha = new Uint8Array(net.ln);
    paintStale = weightStale = true;
    touches.length = 0; lastDot = -1; held = -1;
    openAt = new Float32Array(net.k); for (var g = 0; g < net.k; g++) openAt[g] = -1;
    pointed = -1;
  }

  // Where the field has to stop so the controls stay clear of it.
  function fieldFloor() {
    var box = document.getElementById('panel').getBoundingClientRect();
    return box.top > 0 ? box.top : vh;
  }

  /* ---------- link weights ---------- */

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

  /* ---------- the slider ---------- */

  var slider = document.getElementById('slider');
  var sGoal = 0.5, sNow = 0.5;      // 0 is the left end, 1 the right

  function readSlider() {
    sGoal = clamp(slider.value / 1000, 0, 1);
    if (sGoal <= 0.04) slider.setAttribute('aria-valuetext', 'Tight');
    else if (sGoal >= 0.96) slider.setAttribute('aria-valuetext', 'Loose');
    else slider.removeAttribute('aria-valuetext');
  }
  slider.addEventListener('input', readSlider);

  // The field follows the slider with a little give, so the change is one
  // continuous movement however the slider itself is moved.
  function follow(dt) {
    var before = sNow;
    if (calm) sNow = sGoal;
    else {
      sNow += (sGoal - sNow) * (1 - Math.exp(-dt * 12));
      if (Math.abs(sGoal - sNow) < 0.0004) sNow = sGoal;
    }
    if (sNow !== before) {
      u = smooth((0.5 - sNow) / 0.46);
      e = smooth((sNow - 0.5) / 0.46);
      weightStale = paintStale = true;
    }
    if (sNow <= 0.04 && did('gather')) relight();
    if (sNow >= 0.96 && did('loose')) relight();
    if (Math.abs(sNow - 0.5) < 0.07 && did('middle')) { stirAt = now; relightAt = now + (calm ? 0.1 : 1.5); }
  }

  /* ---------- touch ---------- */

  var held = -1;           // at the left end, the last touched group stays softly lit

  var touches = [];        // each: where it started, when, and how far it got
  var lastDot = -1;        // the visitor's last touch, kept for replays
  var walkAt = 0;

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

  function touchDot(i) {
    var T = {
      dot: i, at: now, far: 0,
      en: new Float32Array(net.n), dep: new Int16Array(net.n),
      show: new Float32Array(net.n), due: new Float32Array(net.n)
    };
    if (weightStale) weigh();
    spread(T);
    touches.push(T);
    if (touches.length > 4) touches.shift();
    lastDot = i;
    held = net.grp[i];
  }

  function nearest(px, py) {
    var best = Infinity, at = -1, d;
    for (var i = 0; i < net.n; i++) {
      d = (X[i] - px) * (X[i] - px) + (Y[i] - py) * (Y[i] - py);
      if (d < best) { best = d; at = i; }
    }
    return at;
  }

  /* ---------- the line of text ---------- */

  var sayEl = document.getElementById('say');
  var sayTimer = 0, standing = '';       // standing: what the guide is showing

  function show(text) {
    clearTimeout(sayTimer);
    if (calm) { sayEl.textContent = text; sayEl.classList.remove('out'); return; }
    sayEl.classList.add('out');
    sayTimer = setTimeout(function () {
      sayEl.textContent = text;
      sayEl.classList.remove('out');
    }, 200);
  }
  function readTime(text) { return Math.max(2800, 1100 + text.length * 50); }

  /* ---------- the guide ---------- */

  // Each step is its own named stage, with a prompt and a line for after.
  var STAGES = [
    { name: 'touch',
      prompt: 'Touch a dot.',
      after: "That's a thought. It brings up what's connected to it, then fades." },
    { name: 'gather',
      prompt: 'Drag the slider to Tight.',
      after: "Now the details are packed into groups. Touch one and the whole group comes up at once. It's fast, and it's the same every time." },
    { name: 'open',
      prompt: 'Touch a lit group to look inside.' },
    { name: 'open-other',
      prompt: 'Look inside another.' },
    { name: 'middle',
      prompt: 'Drag back toward the middle.',
      after: 'Now nothing is packed away. You can see every detail, odd ones included. But a thought takes longer, and brings up less at once.' },
    { name: 'loose',
      prompt: 'Drag all the way to Loose.',
      after: 'With nothing holding the details together, a thought brings up a little of everything, and nothing stands out.' },
    { name: 'end',
      lines: [
        'Your mind packs details into groups so it can use them fast. Usually the groups are right.',
        "Sometimes something gets packed in that doesn't belong, and you can't see it from outside.",
        "That's what happened with the two patches. Your mind packed each one together with its background, so you never saw the patch by itself.",
        'Some minds pack tightly. Some keep the details loose. Each way has a price.'
      ] }
  ];
  var LOOK_FROM = 2;       // looking inside a group starts at this stage
  var looking = false;
  var stirAt = -1, relightAt = 0;
  var guide = { at: -1, part: 'prompt', line: 0, first: -1, timer: 0, done: false };
  var skipBtn = document.getElementById('skip');

  // Called whenever the guide moves. A later pass can start a clip here,
  // keyed by stage name and part ('prompt', 'after', or a line number).
  function stageChanged(name, part) {}

  function relight() { touches.length = 0; touchDot(lastDot < 0 ? net.walk[0] : lastDot); }

  // A tile of the kind the visitor has not opened yet, nearest the middle.
  function pickOther() {
    var want = guide.first < 0 ? 1 : 1 - guide.first, best = Infinity, at = -1, d;
    for (var g = 0; g < net.k; g++) {
      if (net.has[g] !== want || openAt[g] >= 0) continue;
      d = Math.pow(net.cx[g] - net.w / 2, 2) + Math.pow(net.cy[g] - net.h / 2, 2);
      if (d < best) { best = d; at = g; }
    }
    return at;
  }

  function prompt(i) {
    clearTimeout(guide.timer);
    pointed = -1;
    if (i >= STAGES.length) { finish(); return; }
    guide.at = i; guide.part = 'prompt';
    if (i >= LOOK_FROM) looking = true;
    var st = STAGES[i];
    if (st.name === 'end') { guide.line = 0; endLine(); return; }
    if (st.name === 'open' || st.name === 'open-other') {
      // These two only make sense at the left end with something lit.
      if (sGoal > 0.02) { slider.value = 0; readSlider(); }
      if (st.name === 'open-other') pointed = pickOther();
      else if (held < 0) relight();
    }
    standing = st.prompt;
    show(standing);
    stageChanged(st.name, 'prompt');
  }

  function endLine() {
    var st = STAGES[guide.at];
    if (guide.line >= st.lines.length) { finish(); return; }
    standing = st.lines[guide.line];
    show(standing);
    stageChanged(st.name, guide.line);
    guide.timer = setTimeout(function () { guide.line++; endLine(); }, readTime(standing) + 900);
  }

  function finish() {
    clearTimeout(guide.timer);
    guide.done = true;
    looking = true;
    pointed = -1;
    standing = '';
    show('');
    skipBtn.hidden = true;
  }

  // Is the guide waiting for this step? While an after-line is still up,
  // the next step can already be taken.
  function wants(name) {
    if (guide.done || guide.at < 0) return 0;
    if (guide.part === 'prompt') return STAGES[guide.at].name === name ? 1 : 0;
    var next = STAGES[guide.at + 1];
    return next && next.name === name ? 2 : 0;
  }

  function did(name, text) {
    var how = wants(name);
    if (!how) return false;
    if (how === 2) guide.at++;
    var st = STAGES[guide.at], next = guide.at + 1;
    guide.part = 'after';
    pointed = -1;
    standing = text || st.after;
    show(standing);
    stageChanged(st.name, 'after');
    clearTimeout(guide.timer);
    guide.timer = setTimeout(function () { prompt(next); }, readTime(standing));
    return true;
  }

  function guideOpened(g, text) {
    var kind = net.has[g];
    if (wants('open')) { guide.first = kind; return did('open', text); }
    if (wants('open-other') && (guide.first < 0 || kind !== guide.first)) return did('open-other', text);
    return false;
  }

  skipBtn.addEventListener('click', function () {
    if (guide.done) return;
    clearTimeout(guide.timer);
    if (STAGES[guide.at].name === 'end') { guide.line++; endLine(); }
    else prompt(guide.at + 1);
  });

  /* ---------- opening a unit ---------- */

  var OPEN_CLEAN = 'Everything packed in here goes together.';
  var OPEN_STRAY = "See the odd one out? It got packed in with the rest. From outside, you couldn't tell.";
  var OPEN_FOR = 5.4;      // seconds a tile stays open, start to finish
  var openAt = null;       // per group: when it was opened, or -1
  var pointed = -1;        // a tile the guide is pointing at
  var noteTimer = 0;

  function openGroup(g) {
    openAt[g] = now;
    var text = net.has[g] ? OPEN_STRAY : OPEN_CLEAN;
    clearTimeout(noteTimer);
    if (guideOpened(g, text)) return;
    show(text);
    noteTimer = setTimeout(function () { show(standing); }, readTime(text));
  }

  function unfold() {
    for (var g = 0; g < net.k; g++) {
      if (openAt[g] < 0) continue;
      var age = now - openAt[g], o, j, i;
      if (calm) o = age < OPEN_FOR - 0.8 ? 1 : 0;
      else o = age < 0.7 ? smooth(age / 0.7) : age < OPEN_FOR - 0.8 ? 1 : 1 - smooth((age - OPEN_FOR + 0.8) / 0.8);
      var beat = calm ? (o ? 0.45 : 0) : Math.sin(Math.PI * clamp((age - 0.9) / 1.2, 0, 1));
      if (age >= OPEN_FOR) { openAt[g] = -1; o = 0; beat = 0; if (held === g) held = -1; }
      open[g] = o;
      for (j = 0; j < net.mem[g].length; j++) {
        i = net.mem[g][j];
        light[i] *= 1 - o;
        if (net.stray[i]) { grow[i] = beat; light[i] += 0.85 * beat; }
      }
      paintStale = true;
    }
  }

  // Back toward the middle, each dot that does not match pulses once.
  function stir() {
    if (relightAt && now >= relightAt) { relightAt = 0; relight(); }
    if (stirAt < 0) return;
    var x = (now - stirAt) / 1.4, beat = x >= 1 ? 0 : calm ? 0.6 : Math.sin(Math.PI * x);
    for (var i = 0; i < net.n; i++) if (net.stray[i]) { grow[i] = beat; light[i] += 0.85 * beat; }
    if (x >= 1) stirAt = -1;
  }

  // At the left end, touching a lit tile again opens it, once the guide has
  // introduced looking inside. Before that it is simply touched again.
  function canOpen(g) {
    return looking && u > 0.9 && sGoal < 0.1 && openAt[g] < 0 && ((g === held && hold[g] > 0.25) || g === pointed);
  }

  function tap(i) {
    var g = net.grp[i];
    if (openAt[g] >= 0) return;
    if (canOpen(g)) openGroup(g); else { touchDot(i); unveil(); did('touch'); }
  }

  var intro = document.getElementById('intro');
  function unveil() {
    if (intro.hidden) return;
    document.getElementById('field').classList.remove('veiled');
    intro.classList.add('out');
    setTimeout(function () { intro.hidden = true; }, calm ? 0 : 700);
  }

  var lastOpenedByKey = -1;
  function touchKey() {
    if (pointed >= 0 && canOpen(pointed)) { openGroup(pointed); return; }
    if (held >= 0 && canOpen(held) && lastOpenedByKey !== held) { lastOpenedByKey = held; openGroup(held); return; }
    lastOpenedByKey = -1;
    touchDot(net.walk[walkAt++ % net.walk.length]);
    unveil();
    did('touch');
  }

  function shine(dt) {
    var n = net.n, i, t, T, age, tau, g;
    for (i = 0; i < n; i++) light[i] = 0;
    for (g = 0; g < net.k; g++) {
      hold[g] = calm ? (g === held ? 1 : 0) : clamp(hold[g] + (g === held ? dt * 2.5 : -dt * 1.6), 0, 1);
      tile[g] = 0.42 * smooth(hold[g]);
    }
    if (pointed >= 0) {
      // The guide points at a tile by letting it breathe, slowly.
      tile[pointed] = Math.max(tile[pointed], calm ? 0.55 : 0.36 + 0.22 * Math.sin(now * TAU * 0.55));
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
  }

  canvas.addEventListener('pointerdown', function (ev) {
    if (!net || ev.button > 0) return;
    var box = canvas.getBoundingClientRect();
    tap(nearest(ev.clientX - box.left, ev.clientY - box.top));
  });

  var touchBtn = document.getElementById('touch');
  touchBtn.addEventListener('click', touchKey);

  /* ---------- drawing ---------- */

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
      var fade = 1 - 0.9 * seal * (1 - open[g]);
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

  /* ---------- the loop ---------- */

  var raf = 0, last = 0;

  function step(dt) {
    follow(dt);
    if (weightStale) {
      weigh();
      for (var t = 0; t < touches.length; t++) spread(touches[t]);
    }
    shine(dt);
    stir();
    unfold();
  }

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
    last = ms;
    now += dt;
    step(dt);
    draw();
    // If frames run long, draw fewer pixels rather than drop below a smooth rate.
    if (dt > 0) {
      slowTime += (ms - (frame.prev || ms)); slowFrames++;
      if (slowFrames >= 45) {
        if (slowTime / slowFrames > 23 && dpr > 1) {
          sharpCap = Math.max(1, dpr - 0.5);
          dpr = sharpCap;
          canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
        }
        slowFrames = 0; slowTime = 0;
      }
    }
    frame.prev = ms;
  }
  function run() { if (!raf && net && !document.hidden && !field.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function rest() { if (raf) cancelAnimationFrame(raf); raf = 0; frame.prev = 0; slowFrames = 0; slowTime = 0; }

  document.addEventListener('visibilitychange', function () { if (document.hidden) rest(); else run(); });

  var sizeTimer = 0, builtW = 0, builtH = 0;
  window.addEventListener('resize', function () {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () {
      // Phone toolbars come and go; only a real change of screen rebuilds the field.
      if (field.hidden) return;
      if (window.innerWidth === builtW && Math.abs(window.innerHeight - builtH) < builtH * 0.14) return;
      begin();
    }, 180);
  });

  function begin() {
    builtW = window.innerWidth; builtH = window.innerHeight;
    layout();
    run();
    if (guide.at < 0) { field.classList.add('veiled'); prompt(0); }
    else if (!guide.done && STAGES[guide.at].name === 'open-other' && guide.part === 'prompt') pointed = pickOther();
  }

  /* ---------- beat one: two patches of one gray ---------- */

  var hook = document.getElementById('hook');
  var field = document.getElementById('field');
  var stage = document.getElementById('stage');
  var hookLine = document.getElementById('hook-line');
  var patches = [document.getElementById('patch-a'), document.getElementById('patch-b')];
  var spots = [{ x: 0.15, y: 0.5 }, { x: 0.85, y: 0.5 }];   // patch centers, as parts of the stage
  var met = false;

  // The honesty check. Both patches must be the identical color at all
  // times; if they ever differ this throws and marks the page.
  function sameShade() {
    var a = getComputedStyle(patches[0]), b = getComputedStyle(patches[1]);
    if (a.backgroundColor !== b.backgroundColor || a.opacity !== '1' || b.opacity !== '1' ||
        a.filter !== 'none' || b.filter !== 'none' || a.mixBlendMode !== 'normal' || b.mixBlendMode !== 'normal') {
      document.documentElement.setAttribute('data-fault', 'patches');
      throw new Error('The two patches differ: ' + a.backgroundColor + ' / ' + b.backgroundColor);
    }
    return a.backgroundColor;
  }

  function place() {
    var box = stage.getBoundingClientRect(), size = patches[0].offsetWidth;
    for (var p = 0; p < 2; p++) {
      patches[p].style.transform = 'translate(' + (spots[p].x * box.width - size / 2) + 'px,' +
        (spots[p].y * box.height - size / 2) + 'px)';
    }
  }

  function meet() {
    if (met) return;
    met = true;
    sameShade();
    hook.classList.add('met');
    var text = 'They are the same. Your mind decided before you looked.';
    if (calm) { hookLine.textContent = text; return; }
    hookLine.classList.add('out');
    setTimeout(function () { hookLine.textContent = text; hookLine.classList.remove('out'); }, 320);
  }

  patches.forEach(function (el, p) {
    var grip = null;
    el.addEventListener('pointerdown', function (ev) {
      var box = stage.getBoundingClientRect();
      hook.classList.remove('gliding');
      grip = { dx: spots[p].x * box.width - ev.clientX, dy: spots[p].y * box.height - ev.clientY };
      el.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    el.addEventListener('pointermove', function (ev) {
      if (!grip) return;
      var box = stage.getBoundingClientRect(), half = el.offsetWidth / 2;
      spots[p].x = clamp(ev.clientX + grip.dx, half, box.width - half) / box.width;
      spots[p].y = clamp(ev.clientY + grip.dy, half, box.height - half) / box.height;
      place();
      sameShade();
      var gapX = (spots[0].x - spots[1].x) * box.width, gapY = (spots[0].y - spots[1].y) * box.height;
      if (Math.sqrt(gapX * gapX + gapY * gapY) < half * 1.6) meet();
    });
    var drop = function () { grip = null; };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  });

  // Without dragging: the patches slide together and the ground goes flat.
  document.getElementById('together').addEventListener('click', function () {
    var box = stage.getBoundingClientRect(), lap = patches[0].offsetWidth * 0.3 / box.width;
    hook.classList.add('gliding');
    hook.classList.add('level');
    spots[0].x = 0.5 - lap; spots[1].x = 0.5 + lap;
    spots[0].y = spots[1].y = 0.5;
    place();
    sameShade();
    setTimeout(meet, calm ? 0 : 1250);
  });

  document.getElementById('see').addEventListener('click', function () {
    hook.classList.add('gone');
    setTimeout(function () { hook.hidden = true; }, calm ? 0 : 720);
    field.hidden = false;
    begin();
    requestAnimationFrame(function () { field.classList.add('on'); });
    touchBtn.focus({ preventScroll: true });
  });

  window.addEventListener('resize', function () { if (!hook.hidden) place(); });

  makeSprites();
  place();
  sameShade();
})();
