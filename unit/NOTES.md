# The unit picture: notes

Published addresses:
- Home (this picture): https://sudo-scientist.github.io/unit-resolution/
- The talk sketch: https://sudo-scientist.github.io/unit-resolution/talk/
- The earlier page, unchanged: https://sudo-scientist.github.io/unit-resolution/old/

The home page is the root `index.html`, a copy of `unit/index.html` that loads `unit/unit.css` and `unit/unit.js`. Change both together. The scripts in `tools/` still point at the earlier page's old place.

Second pass. Checked in headless Chromium (already on this machine; nothing installed into the repo).
Open `unit/index.html` straight from disk. Screenshots are in `shots/`.

## What works
- Beat one is unchanged. Both patches read `rgb(124, 124, 124)` before and after; `sameShade()` throws if they ever differ.
- Beat two: intro until the first touch, touch, the Tight to Loose slider, looking inside both kinds of group, the guide start to finish, Skip, and free play afterward.
- Looking inside only works from guide step 3 on. Before that a second touch on a lit group just touches it again (checked).
- No console errors. No requests beyond the three page files. None of the first-pass text remains ("situation", "All at once", "Everywhere", "ready to use", "belonged": all absent).
- 360 px wide up to 1440 px checked. Fixed seed, so a given screen size always gets the same field.

## Decisions I made alone in this pass
- Intro: three lines centered over the field, with the field dimmed behind them so they stay readable. "Touch a dot." shows in the band at the same time, so the visitor knows how to go on. The Touch control dismisses it too.
- Situation removed. Each link keeps the one strength it had under the first situation, so the middle of the slider looks as it did.
- Gaps: when the field is built, the page measures how far the groups must pull in before every pair of outlines is a clear distance apart. Tiles and outlines only fade in past that point, and soft outline strokes are capped below the gap. Dots now pull in sooner (between the middle and about a third of the way left), and tiles fade in after that.
- Dots keep their own hue until the tiles fade in, so the ones that do not match stay visible for longer on the way left. They are told apart by hue alone: same size, same brightness, no mark.
- "Drag back toward the middle" completes within 7% of the middle. The odd dots pulse once there, then the last touch replays so the slower spread can be seen.
- The slider's spoken value is "Tight" or "Loose" at the ends and the plain number between.
- Skip moves on one step; skipping to a look-inside step moves the slider to Tight for the visitor.
- Kept from the first pass: the last touched tile stays softly lit at Tight; the guide points with a slow breathing glow; the canvas drops resolution if frames run long; `STAGES` holds named stages and `stageChanged(name, part)` is the empty hook for narration.

## Still rough
- Frame rate is still only measured in headless software rendering.
- Whether the odd dots are noticeable enough in plain sight is a judgment call: they sit about half a turn of hue from their neighbors and nothing else marks them. Worth a look on a real screen.
- Keyboard users cannot choose which dot to touch; the Touch control chooses for them.
- A search of `unit/` for the retired words finds one inside browser property names in code (canvas and window size), none in visible text or comments.

## First three things to look at
1. Drag slowly from the middle to Tight: dots gather, then tiles close. Does it still feel like one change?
2. In the middle, can you spot the odd dots before the pulse points them out?
3. Read the end lines against what you just did. Does the third one land?
