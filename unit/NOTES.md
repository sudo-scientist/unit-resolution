# The unit picture: notes for the morning

Checked in headless Chromium (already on this machine; nothing installed into the repo).
Open `unit/index.html` straight from disk. Screenshots are in `shots/`.

## What works
- Beat one: drag either patch, or use the button. Both patches read `rgb(124, 124, 124)` before and after; `sameShade()` throws and marks the page if they ever differ.
- Beat two: touch, situation with replay, the slider across its whole range, opening both kinds of tile, the guide start to finish, Skip, and free play afterward.
- Full run by keyboard only, and with reduced motion on. No console errors. No requests beyond the three page files.
- 360 px wide up to 1440 px checked. Fixed seed, so a given screen size always gets the same field.

## Decisions I made alone
- Beat one: the graded ground is a band across the middle, with the text on the dark page above and below it, so text contrast holds. The patches are circles and may overlap; "met" is when they touch well. The flat tone for the button route is a dark gray.
- One model for the whole slider, not three modes. Link strength, how much light survives each step, dot positions, tile fill and outline sharpness are all continuous functions of the slider. Dots pull toward their group as the slider goes left, which is what opens the dark gap.
- At the left end the last touched tile stays softly lit until another is touched. Otherwise "touch a lit group" would be a race against the fade.
- The Touch control walks one dot per group in a fixed shuffled order. At the left end it alternates: light a tile, then open it. During "Open another." it opens the tile being pointed at.
- "Point them at a tile" is a slow breathing glow on one tile of the other kind (steady under reduced motion). A pointed tile opens on the first touch.
- Skip moves on one step. If a skipped step would leave the visitor unable to do the next one, the guide moves the slider to the left end itself.
- The next step can be taken while the previous after-line is still showing.
- After the guide ends, opening a tile still shows its line, then clears it.
- Outlines: the reach of each group's dots, softened, then let out until every dot is inside.
- Colors come from OKLCH at one lightness and one chroma; strays sit about half a turn of hue from their group.
- Slider keyboard step is 2% of the track. The middle mark is a small tick on the track.
- If frames run long, the canvas drops to fewer pixels per point (2, then 1.5, then 1) instead of dropping frames.
- No words were added. The slider's spoken value reuses the three slider labels.
- Narration hook: `STAGES` holds named stages; `stageChanged(name, part)` is called on every move and is empty.

## Still rough
- Frame rate is only measured in headless software rendering (about 16 ms a frame after the sharpness drop kicked in). Not yet seen on a real mid-range laptop or phone.
- Between the middle and the left end, two or three neighboring soft outlines still brush each other briefly.
- Keyboard users cannot choose which dot to touch; the Touch control chooses for them.
- A resize that changes the screen a lot rebuilds the field and drops any light in progress.
- A search of `unit/` for the retired words finds one of them inside browser property names in code (canvas and window size). None is in visible text or comments.
- Canvas 2D held up, so nothing was moved to WebGL.

## First three things to look at
1. Drag the slider slowly from the middle to the left with a touch in progress. This is the centerpiece; judge whether it feels like one change.
2. Beat one on a real phone: is the difference between the patches strong enough at that size?
3. Even-handedness: touch at the left end, then in the middle. Does the left read as quick and ready, and the middle as a better fit that costs time, without either looking like the right answer?
