// Small figures that sit in the text column. Drawn in neutral ink only.
const S = "http://www.w3.org/2000/svg";
const svg = (vb, inner) => `<svg xmlns="${S}" viewBox="${vb}" fill="none" stroke="#e9e4d8" stroke-width="1.6" stroke-linecap="round" role="img">${inner}</svg>`;
const button = (label, pressed) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (pressed !== undefined) b.setAttribute("aria-pressed", pressed); return b; };

export const FIGURES = {
  illusions(box) {
    // Müller-Lyer: two equal lines; the fins make them look unequal.
    const x1 = 70, x2 = 250, fin = 22;
    const line = (y, dir) => `<path d="M${x1} ${y}H${x2}M${x1} ${y}l${dir * fin} -14M${x1} ${y}l${dir * fin} 14M${x2} ${y}l${-dir * fin} -14M${x2} ${y}l${-dir * fin} 14"/>`;
    const ml = document.createElement("div");
    ml.innerHTML = svg("0 0 320 120", `<title>Two lines of equal length that look unequal</title>${line(36, 1)}${line(88, -1)}<g class="guides" stroke-dasharray="3 5" stroke-width="1" opacity="0"><path d="M${x1} 10V112M${x2} 10V112"/></g>`);
    const cap = document.createElement("p"); cap.className = "cap"; cap.textContent = "Both lines are the same length. Knowing that does not change what you see.";
    const g = button("Show guides", false);
    g.addEventListener("click", () => { const on = g.getAttribute("aria-pressed") !== "true"; g.setAttribute("aria-pressed", on); ml.querySelector(".guides").setAttribute("opacity", on ? 0.8 : 0); });

    // Necker cube: the same twelve edges set two ways.
    const a = [[60, 44], [130, 44], [130, 114], [60, 114]], b = a.map(([x, y]) => [x + 34, y - 26]);
    const poly = pts => `M${pts.map(p => p.join(" ")).join("L")}Z`;
    const edges = a.map((p, i) => `M${p.join(" ")}L${b[i].join(" ")}`).join("");
    const nk = document.createElement("div");
    nk.innerHTML = svg("0 0 320 130", `<title>A wireframe cube that can be seen two ways</title><path d="${poly(a)}${poly(b)}${edges}" opacity="0.75"/><path class="face" d="${poly(a)}" fill="rgba(233,228,216,0.13)" stroke-width="2.4"/><text class="lab" x="200" y="74" fill="#9a968c" stroke="none" font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="1">SET ONE WAY</text>`);
    let front = 0;
    const flip = () => { front ^= 1; nk.querySelector(".face").setAttribute("d", poly(front ? b : a)); nk.querySelector(".lab").textContent = front ? "SET THE OTHER WAY" : "SET ONE WAY"; };
    const fb = button("Flip the cube");
    fb.addEventListener("click", flip);
    const cap2 = document.createElement("p"); cap2.className = "cap"; cap2.textContent = "The same material, setting two ways.";
    const btns = document.createElement("div"); btns.className = "btns"; btns.append(g);
    const btns2 = document.createElement("div"); btns2.className = "btns"; btns2.append(fb);
    box.append(ml, cap, btns, nk, cap2, btns2);
  },

  transcript(box) {
    box.classList.add("transcript");
    box.setAttribute("aria-live", "polite");
    box.innerHTML = `<div class="k">Nothing sent yet</div>`;
  },
};
