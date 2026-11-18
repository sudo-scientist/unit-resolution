# Unit Resolution

An interactive, single-page working model of how minds resolve raw experience into units of meaning.

**Live:** https://sudo-scientist.github.io/unit-resolution/

Working draft, November 2026. The page carries `noindex, nofollow` and is shared by link.

## Run locally

No build step. Serve the folder with any static server (ES modules need `http://`, not `file://`):

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/.

## Layout

| File | What it holds |
| --- | --- |
| `index.html` | Page shell, hero text, open-edges panel |
| `style.css` | All styling; the three meaning colors are `--warm`, `--cool`, `--mark` |
| `main.js` | Builds stage sections and the stage map, tracks the active stage, wires controls |
| `js/content.js` | All stage text and control definitions, plus `NAMED_LABEL` |
| `js/field.js` | The one persistent field: points, clusters, membranes, collapsed units, links, minds |
| `js/scenes-1.js` … `scenes-4.js` | What the field does at each stage |
| `js/figures.js` | The in-text Müller-Lyer and Necker figures |
| `tools/` | Playwright screenshot script used to check every stage (not needed to run the site) |

## The one config constant

`NAMED_LABEL` at the top of `js/content.js` (default `"autism"`) is the only place a diagnosis is named. It appears only in stage 12. Set it to `""` and the page says "the label" instead.

## Checking changes

```bash
cd tools && npm install && npx playwright install chromium
node shots.mjs all 4500 both          # every stage, desktop + phone, into tools/shots/
node shots.mjs all 1200 desktop reduced   # reduced-motion versions
```

The script reports console errors and an approximate frame rate.
