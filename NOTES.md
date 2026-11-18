# Notes

**The repo is public.** GitHub Pages refused to serve from a private repo on this account's plan ("Your current plan does not support GitHub Pages for this repository"), so, as the brief allowed, the repo was made public and Pages enabled from `main` root. Commits are authored with the account's GitHub noreply address; no real name or email is in the history or on the page.

Live: https://sudo-scientist.github.io/unit-resolution/

## Design decisions

- **One field, sixteen scenes.** A single canvas holds the same 1,000 points (520 on small or low-core devices) for the whole page. Each stage is a "scene" that re-assigns those points to clusters and sets targets; the engine eases toward them, so the reader sees the same material regroup instead of a new chart.
- **Own integrator instead of D3.** The brief allowed D3 for forces. The motion needed (springs to a home position in a cluster, jitter that scales with softness, cursor repulsion) is about forty lines, so the page has no JavaScript dependencies at all. Fonts (Newsreader, IBM Plex Mono) come from Google Fonts with system fallbacks.
- **Hardness is one number per cluster.** Membrane brightness, stillness, colour (warm to cool), how tightly points are held, and whether the cluster collapses to a single node all derive from it. The melting point slider just sets that number, which is why freezing and thawing look continuous. A cluster flashes at the moment it sets and its points get a small outward kick when it thaws.
- **Three colours, fixed meanings.** Warm = raw/open, cool = set, and the magenta mark = labels imposed from outside. The mark appears only in stages 12 and 13. The "sensitive" membrane in stage 11 is cool on purpose: it is a set unit in Shiloh's mind, and Act IV is where the third colour first intrudes. Neutral ink (the text colour) is used for things that are neither: mind outlines, ghosts of lost points, swallowed points, the measuring line.
- **Swallowed points are pale.** Stage 2 asks for swallowed points to be coloured. With only three meaning colours available, they turn the neutral pale tone.
- **In-field labels.** Small mono tags sit in the field ("a prior", "shared layer", "copy · 42 points") and a readout bottom-right states what is happening in numbers. These are there so a stage still reads with the text column ignored.
- **Stage text.** Kept to the Say material. Stage 11 runs longer than four sentences because the story beats are all in the brief and cutting any of them loses the sequence. Stage 4 adds one bridging sentence to introduce the term "portability" where it is shown.
- **Invented micro-labels.** Stage 5 needed words on the collapsed units. They are drawn from the story's own objects: clock, tick, kitchen, house, gear, rope, grouped as time / home / climbing / "things in the house". Stage 13's four lanes are labelled with shortened forms of the four reasons in the text. Stage 11 prints what was sent as short descriptions ("An explanation of what she meant") because the brief gives what he hears but not her words.
- **Technical asides.** "entity resolution" (stage 2), "lossy compression" (stage 4) and "codec" (stage 10) each appear once, in a small grey aside.
- **Melting point slider after Act II.** It stays on screen wherever it has something to act on. In stages 10, 11, 12 and 15 it sets how open the left-hand (or far) mind is, and in 10 and 15 a faster-setting sender emits more compact messages that lose less at the wall. It is hidden in stages 13 and 14, where no single mind is in focus, and in the sandbox, which has one slider per mind.
- **Stage 13 does not flip the camera.** The brief asks for the view to flip to the far side of the wall. Instead the near side dims to almost nothing and the far side shows four identical silhouettes, which makes the same point with less disorientation. "Look inside" brings the interiors back.
- **Stage 8's guided move** is a real camera move (zoom into a unit, step out through its membrane, look back with the boundary lit, step in again), about nine seconds.
- **Active stage** is whichever stage's text takes up the most of the readable area, and using any control makes its own stage active. This avoids a control driving the wrong scene when two stages are partly on screen.
- **Reduced motion.** With `prefers-reduced-motion`, there is no animation loop. Each scene settles instantly to a static end state and redraws only when a control changes. Timed sequences show their final frame; stage 3 shows static ripples that stop at the prior; stages 10 and 15 show packets frozen before, in and after the wall; stage 11 shows the sent and arrived shapes side by side.
- **Keyboard.** Every canvas-only gesture has a button equivalent: "Offer a stray point" (drag), "Take a unit up or down" (click a cluster), "Touch a thought" (hover), and the slot-shape slider (dragging a slot).
- **Glow without shadow blur.** Canvas `shadowBlur` halved the frame rate. Glows are the same path stroked wide and faint, then thin and bright.

## Verified

- Playwright screenshots of all 16 stages at 1440×900 and 390×844, plus a reduced-motion pass, plus slider extremes and the interactive states (misreading after five sends, collision with "look inside", ceiling cascade, reshaped wall).
- Console free of errors on every pass.
- About 60 fps on every stage at 1,000 points in headless Chromium.

## Cut or not done

- No drag-a-point on touch screens while scrolling vertically: the canvas lets vertical swipes scroll the page, so on a phone the "Offer a stray point" button is the reliable path.
- Stage 6: units hop between minds and minds with the same bundle drift together, but the two bundles are only told apart by arrangement (triangle vs row). It reads less clearly than the other stages.
- Stage 14: tokens do not visibly "spread fast" between minds; they tighten and the gap count rises.
- Stage 15: slots can be widened (slider or drag) and added, but not reshaped into arbitrary shapes.
- The sandbox's match threshold changes how tightly each mind clusters but does not affect whether a message arrives intact.
- Not tested on a real phone, in Safari or in Firefox. Only headless Chromium.
- `NAMED_LABEL = ""` was not screenshot-tested; the fallback string is a one-line substitution.

## What I'd improve next

1. Test on a real iPhone and in Safari and Firefox; tune the phone layout where the dock covers controls.
2. Give stage 6's bundles a clearer visual identity and make inheritance easier to see at a glance.
3. Make stage 13's four interiors differ more in motion, and try the literal camera flip.
4. Let the reader draw slot shapes in stage 15, with messages keeping whatever fits the outline.
5. Make the sandbox goal explicit: show a best-so-far fidelity and what changed it.
6. A short guided first-run hint for the melting point slider, since it is the most important control.

Live URL: https://sudo-scientist.github.io/unit-resolution/
