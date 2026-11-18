import { STAGES, ACTS } from "./js/content.js";
import { Field } from "./js/field.js";
import { SCENES } from "./js/scenes.js";
import { FIGURES } from "./js/figures.js";

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

const field = new Field($("#field"), $("#overlay"));
const text = $("#text"), dock = $("#dock"), meltWrap = $("#melt-wrap"), meltIn = $("#melt"), readout = $("#readout");
const MELT_FROM = STAGES.findIndex(s => s.id === "melt");
const values = {};                         // values[stageId][controlId]
let current = -1;

const api = {
  val: id => values[STAGES[current].id]?.[id],
  get melt() { return meltIn.value / 100; },
  setMelt(v) { meltIn.value = Math.round(v * 100); },
  readout(html) { if (readout.innerHTML !== html) readout.innerHTML = html; },
  figure: id => $(`#fig-${id}`),
};

// ---------- build the stage sections ----------
STAGES.forEach((s, n) => {
  values[s.id] = {};
  let sec;
  if (n === 0) sec = $(".hero");
  else {
    sec = el("section", "stage"); sec.dataset.stage = s.id;
    const inner = el("div", "inner");
    const eb = el("div", "eyebrow", s.act === "V" ? "After the stages" : `Act ${s.act} · ${String(n + 1).padStart(2, "0")}`);
    if (s.speculative) eb.append(el("span", "spec", "speculative"));
    inner.append(eb, el("h2", "", s.title));
    s.body.forEach(p => inner.append(el("p", "", p)));
    if (s.hint) inner.append(el("p", "hint", s.hint));
    if (s.controls) inner.append(buildControls(s));
    if (s.figure) { const f = el("div", "figure"); f.id = `fig-${s.figure}`; inner.append(f); FIGURES[s.figure]?.(f, field); }
    if (s.aside) inner.append(el("p", "aside", s.aside));
    sec.append(inner); text.append(sec);
  }
  sec.id = `s-${s.id}`; sec.tabIndex = -1;
});

function buildControls(s) {
  const wrap = el("div", "controls"), btns = el("div", "btns");
  for (const c of s.controls) {
    const cid = `${s.id}-${c.id}`;
    if (c.type === "range") {
      values[s.id][c.id] = c.value / 100;
      const box = el("div", "ctl"), lab = el("label", "", c.label); lab.htmlFor = cid;
      const inp = el("input", c.id.startsWith("melt") ? "" : "neutral"); inp.type = "range"; inp.min = 0; inp.max = 100; inp.value = c.value; inp.id = cid;
      inp.addEventListener("input", () => { values[s.id][c.id] = inp.value / 100; fire("change", c.id, inp.value / 100, s); });
      box.append(lab, inp, el("div", "ends", `<span>${c.ends[0]}</span><span>${c.ends[1]}</span>`)); wrap.append(box);
    } else {
      const b = el("button", "", c.label); b.type = "button"; b.id = cid;
      if (c.type === "toggle") {
        values[s.id][c.id] = false; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => { const v = !values[s.id][c.id]; values[s.id][c.id] = v; b.setAttribute("aria-pressed", v); fire("change", c.id, v, s); });
      } else b.addEventListener("click", () => fire("button", c.id, undefined, s));
      btns.append(b);
    }
  }
  if (btns.children.length) wrap.append(btns);
  return wrap;
}

function fire(kind, id, v, s) {
  const n = STAGES.indexOf(s); if (n !== current) go(n);   // a control always drives its own stage
  field.scene?.[kind]?.(field, id, v, api); field.kick();
}

// ---------- stage map ----------
const map = $("#map"), list = $("#map-list"), toggle = $("#map-toggle");
let act = null;
STAGES.forEach((s, n) => {
  if (s.act !== act) { act = s.act; list.append(el("li", "act", s.act === "V" ? ACTS.V : `Act ${s.act} · ${ACTS[s.act]}`)); }
  const li = el("li"), a = el("a", "", `${String(n + 1).padStart(2, "0")} ${s.title}`); a.href = `#s-${s.id}`;
  a.addEventListener("click", () => { map.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
  li.append(a); list.append(li);
});
{ const li = el("li"), a = el("a", "", "Open edges"); a.href = "#edges"; a.addEventListener("click", () => map.classList.remove("open")); li.append(a); list.append(li); }
toggle.addEventListener("click", () => { const o = map.classList.toggle("open"); toggle.setAttribute("aria-expanded", o); });
addEventListener("keydown", e => { if (e.key === "Escape") { map.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });

// ---------- which stage is active ----------
const sections = STAGES.map(s => $(`#s-${s.id}`));
function pick() {
  // the active stage is the one whose text occupies most of the readable area
  const top = field.phone ? innerHeight * 0.5 : 0, bot = innerHeight;
  let n = 0, best = 0;
  sections.forEach((sec, i) => { const r = (sec.querySelector(".inner") || sec).getBoundingClientRect(), v = Math.min(r.bottom, bot) - Math.max(r.top, top); if (v > best) { best = v; n = i; } });
  if (scrollY < 40) n = 0;
  if (n !== current) go(n);
}
function go(n) {
  current = n; const s = STAGES[n];
  const showMelt = n >= MELT_FROM && s.id !== "sandbox";
  meltWrap.hidden = !showMelt; dock.hidden = false; readout.innerHTML = "";
  [...list.querySelectorAll("a")].forEach((a, i) => a.classList.toggle("on", i === n));
  toggle.textContent = n === 0 ? "Stages" : `${String(n + 1).padStart(2, "0")} / ${STAGES.length}` + (field.phone ? "" : ` · ${s.title}`);
  toggle.setAttribute("aria-label", `Stages. Current: ${s.title}`);
  field.setScene(SCENES[s.id] || SCENES.raw, api);
}
meltIn.addEventListener("input", () => { field.scene?.melt?.(field, api.melt, api); field.kick(); });
addEventListener("scroll", pick, { passive: true });
addEventListener("resize", pick);
pick();

window.__field = field; // handy for tests and for thinking with the model in the console
