# ADR 0043: The trench area, the mud turtle and fading lights

- Status: Accepted
- Date: 2026-11-07
- Amends: [ADR 0041](0041-stepped-lake-areas-depth-bands-and-banded-danger-rules.md) (in part: in a depth-banded area, band 3 or deeper now counts as deep for hiding, and a special treasure there may be Epic or Legendary; every other ADR 0041 rule stays in force), PRD B6 (deep for hiding) and PRD H6 (the special treasure's rarity, open question 136)
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the turtle gentle: no bite, hold or carry, and its card never says it eats axolotls), [ADR 0008](0008-gentle-fail-state.md) (the gentle fail state, which a snap goes through like any hit), [ADR 0012](0012-save-on-device.md) (the new ids under its additive rule), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md) (area look variants, which the still look is), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the shared predator rules), [ADR 0022](0022-danger-pass-phase-2-seam-amendments.md) (living docs name no area), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (dark water, its shown and hidden parts, the hint clock and the puzzle element kind), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (solid rock walls), [ADR 0039](0039-cormorant-dive-arc-and-golden-hour-area-look.md) (the iOS Safari memory fix and on-demand scenery chunks), [ADR 0042](0042-pelican-line-and-wind-and-waves.md) (the pelican line and wind and waves, Area 12's threat and timing element)

This ADR records the build choices for issue #212, the open lake's Area 13: its stepped trench, its one new predator, the Valley of Mexico mud turtle, and its one new puzzle element, the fading light. The owner took the planner's recommendations on all four questions of #212 (Q1 to Q4), and they are final. The tuning values and the named defaults in the code comments (ND-n) are provisional until the owner reviews them on the PR.

## Context

Area 12 ([ADR 0041](0041-stepped-lake-areas-depth-bands-and-banded-danger-rules.md)) is a bowl of two water rows, so it never used depth bands 3 and 4, and ADR 0041 kept the dark-water layer for the lake's pitch black. Area 13 is the first lake area with a band 3: a trench three rows deep whose pit floor is pitch black.

Three rules block that pit as built:

- **Hiding.** B6 says an Epic or Legendary spot hides deep: in a cave or other hollow, or past a current. A lake has no cave or current in its deep band, so the band rarity rule of ADR 0041 (the deep holds Epic and Legendary) could not be met.
- **The special treasure.** H6 and open question 136 keep every special treasure Common or Rare. ADR 0041 puts the special treasure in the deepest band, and in a band 3 that band holds only Epic and Legendary spots.
- **Dark water.** The glow-plant ([ADR 0028](0028-descent-areas-crayfish-and-dark-water.md)) stays lit for the whole trip, so once lit the dark is solved. A lake light that fades asks the player to come back to it.

Every predator so far swims or wades its route and strikes along the aim it locks. A pit floor suits a slow ambusher that creeps and snaps but never chases.

Real basis, checked 2026-11-06 (web research only; the game fetches nothing):

- Turtles of the World (Naturalis), Kinosternon hirtipes: the species ranges from the Big Bend region of Texas to the Valley of Mexico; it is found in lakes, ponds, streams, or rivers flowing into lakes; it is chiefly nocturnal; it eats insects, worms, small invertebrates, amphibians and small fish. The nominate subspecies, the Valley of Mexico mud turtle, lives only in the drainages of the Valley of Mexico.
- The iNaturalist record of Kinosternon hirtipes in Xochimilco (owner decision on #209), which is why the turtle swims in the game's lake.

"Axolotls stay safe by swimming away before they snap" is the game's rule (the snap goes to a spot fixed at the warning start), not a source claim. The fading light is game licence, not a real plant, and it has no fact card.

## Decision

**The trench is plain area data on the existing collision (`src/logic/openLake2Layout.ts`, ND-1 to ND-6).** Area 13 (`'open-lake-2'`) is 10 x 3 screens. Six existing `RockWall` rectangles build a stepped floor, so the walls block the body as every rock wall does: a shelf under y 318 on each side, a step under y 678 on each side of the pit, and a small terrace step on each side of the pit floor from y 920. The Home Spot and its safe area sit in the middle shallows over the pit. The main path is no left-to-right run: west over the shallows to the left shelf and back, down onto the left step, east through band 2 over the pit, up onto the right shelf and along it and back, then down into the pit to the exit on its floor.

- **Band 3 is pitch-black dark water.** The pit, band 3 between the two steps, is the area's one `darkWater` rectangle. The dark layer keeps the fade, light stamp and hide rules of ADR 0028, drawn in the lake's own colour, `LAKE_DARK` (band 4's deep stop, #04060f). The scene picks it by a look property (a look with depth bands takes `LAKE_DARK`, every other look `SPRING_DARK`), never by look id. A light's hole shows the band 3 water under it, dark indigo.
- **The look and the music.** Area 13 uses the open lake's still variant (`'open-lake-still'`, ND-15): overcast and still, with no streaming clouds. It has no wind and waves (ND-16). It plays the open lake's cue, Lagoon Breeze, in its day version. The open lake's refuge section and the area map read "Areas 12 and 13".
- **Predators one ladder step up (ND-19).** The tilapia, the carp, the cormorants and the pelican lines are each one step up the predator ladder from the area before. The band rule of ADR 0041 holds by band: the pelican lines and cormorants in band 1, the tilapia and carp in band 2, and the mud turtles alone in band 3.

**The mud turtle is an ambusher on the shared predator rules (`MUD_TURTLE_SPECIES` in `src/logic/predators.ts`, `MUD_TURTLE` in `src/logic/tuning.ts`, ND-11 to ND-13).** It is `'mud-turtle'`, Area 13's one new predator, and not a danger part. Area 13 has two on the pit floor.

- **Tuning.** It crawls along its stretch at 20 px/s. When the axolotl comes within 110 px of it, it warns for 1.2 s (the A2 floor is 0.8 s), then snaps its head out 110 px in 0.3 s and holds still through a 2.5 s cooldown. Hit, touch and body reach and the bump are the tilapia's, so they match a Medium axolotl at every size (PRD F4).
- **It never chases.** It plays two rule options, `fixedStrikeSpot` and `stillCooldown`. The snap goes to the spot the axolotl was in when the warning started, so swimming away dodges it, and through the cooldown the turtle stands still facing the axolotl. `tunedSpecies` throws for a chase given to a species with either rule, so no area can tune the turtle into a chaser. The danger bar's every-predator-chases rule passes it, as it passes the heron, since it is built never to chase ([ADR 0038](0038-grand-tour-areas-trajinera-lures-and-drag-nets.md)).
- **Gentle.** A snap that connects is one hit through the shared hit path ([ADR 0008](0008-gentle-fail-state.md)), so it costs one leg, the Shell perk can block it and protected time follows. A touch outside a snap is a gentle bump that costs no leg. Its beak is always closed and empty, and it never bites, grabs, holds, lifts or carries the axolotl ([ADR 0007](0007-kid-safety-and-privacy.md)).
- **Motion.** When it turns to a new facing, the turn shows over 0.3 s; under reduced motion it turns at once and holds its still pose. The snap still moves under reduced motion, because it is gameplay. It plays the shared warning sound (ND-26).
- **Fact card.** "Meet the mud turtle" (`MUD_TURTLE_FACT`, ND-14) is met within 180 px of a turtle, outside the Home Spot. It speaks of the species, and it never says the turtle eats axolotls.

**The fading light is a puzzle element whose light fades (`src/logic/fadingLights.ts`, ND-7 to ND-10).** It is `'fading-light'`, built with `fadingLightSpawn`, always active, with no `glowPlant` geometry, so the glow-plant rules never see it. Area 13 has four in the pit.

- **The cycle.** Touching a light, within its radius plus the glow-plant's body reach, lights it 200 px round, as a lit glow-plant. It stays fully lit for 15 s, then dims smoothly over 4 s and goes out. A touch relights it to full whether it is lit, dimming or out.
- **Trip state only.** The trip holds the seconds left on each touched light (`fadingLightTimers`). A new trip starts with every light unlit, being carried home included, and nothing is saved. The timers hold while the game is paused, the banking card shows or the axolotl is carried home.
- **A quantized share for the dark layer.** The share of light falls as (1 - cos(π · left / dimFor)) / 2 through the dim. `fadingLightCircles` rounds it up to the next of 8 steps (`quantizeFadingShare`), so a light keeps a step until it is out and the dark layer is redrawn only when a step changes.
- **The shared hint clock.** A light newly lit (from unlit or out) is a new light for the dark hint clock (`stepDarkHintClock`), the same clock the glow-plants use. After 20 s in the dark with no new light, the hint points at the light that is out or never touched nearest the axolotl, the first in element order on a tie (`fadingLightHint`).
- **Reduced motion.** The light holds full for 15 s, drops to half for the 4 s dim and then goes out. The hint shows still and brighter instead of pulsing.
- **Silent and never met.** Lighting, relighting and dimming play no sound, and there is no fading light card (ND-26). It never blocks, never costs a leg and is never a hit, as every puzzle element.
- **The snapshot.** `TripSnapshot.fadingLightHint` is optional: it is set only while swimming, else null, and the key is absent in an area with no fading lights. So every existing snapshot and its tests are unchanged.

**The darkness shows more parts (`DARK_SHOWN_PARTS` in `src/logic/glowPlants.ts`, ND-9).** The list gains `'fading-light'`, so a fading light shows even when out. With every light out, these still show: the axolotl's own glow, the exit, the Home Spot, every predator, every moving hazard, every warning, a stranded axolotl and each fading light's dim outline. The lights draw at the glow-plants' depth, over the dark layer. The darkness still hides only scenery, snacks, treasure spots, their hint sparkles and finds.

**Band 3 or deeper is deep for hiding (`isDeep` in `src/logic/hiding.ts`, ND-29).** This amends ADR 0041 in part and PRD B6. In an area that sets `depthBanded`, a point in band 3 or deeper is deep, with no cave or current. The band is read only when the area sets the flag, so an area without bands is unchanged. A Common or Rare spot there fails, because those rarities must not be deep. Area 13 holds Common spots on the shelves by the main path, Rare spots on the steps off it, and Epic and Legendary spots on the pit floor, every one of them within 200 px of a fading light.

**A special treasure may be Epic or Legendary only in a deep-banded area (ND-24, ND-28).** This amends PRD H6 (open question 136) and ADR 0041 in part. A special treasure is Common or Rare, unless its area is depth-banded and its deepest swimmable band is band 3 or deeper; there it may be Epic or Legendary, and every spot of its rarity lies in that band. Until its own treasures come (#215), Area 13 shares Area 11's whole set (`DEEP_CANAL_4_TREASURES`, ND-17), with 18 trip slots. Its special treasure is the Lagoon shine Paint shell, Legendary, in band 3.

**The exit gate must clear terrace rock (ND-5).** The exit is on the pit floor at (2650, 940), radius 40, east of the turtles, in the dark and out of the safe area. Its gate stands on the bed. The gate's drawn half-width is 65 px, so its drawn box must overlap no rock wall: the first place, (2660, 990), drew the gate into the east terrace step. `src/art/areaExitArt.test.ts` checks this for every area.

**The one-leg run is accepted as pinned (Q4).** A one-leg axolotl swims the main path from the Home Spot to the exit in 82.13 s, under the 180 s limit, leaving at element time 3.15 s. As measured, every start from 3.05 s to 3.20 s passes, so the window is narrow, and the owner accepted it as pinned at mid-window. A later shared tuning change re-measures the window and pins the start inside it again; it never loosens the run to fit. The pin lives in the area's own test (`src/logic/openLake2Fairness.test.ts`, ND-27).

## Consequences

- A later area can add a mud turtle as a predator route and fading lights as elements with `fadingLightSpawn`. A later depth-banded area can use band 3 as dark water drawn in `LAKE_DARK`.
- Areas 1 to 12 and the spring cave have no fading light and no mud turtle, so they build, play and bake as before. Their snapshots carry no `fadingLightHint` key. An area without `depthBanded` reads deep as before.
- The ids `'open-lake-2'`, `'mud-turtle'`, `'fading-light'` and the fading light ids of Area 13 are fixed for good (ADR 0012). The save format is unchanged: the met list only gains `'mud-turtle'`, and light state is never saved.
- The special treasure rule now has one exception. A later area that wants an Epic or Legendary special treasure must be depth-banded to band 3 or deeper.
- Every area's exit gate must clear its rock walls by its drawn half-width. The check runs for every area.
- The one-leg run's narrow start window may move with a later shared tuning change, and each such change must re-measure it.
- The turtle, light, layout and band values are provisional. The owner can tune or reverse them on the PR, as tuning, area data or art.

Recorded residuals:

- Area 13's dark layer is twice Area 6's (owner decision on #212, 2026-11-07, answer A; local review finding 35278ae50c0a1cf8085a6ae627905ea6baf848ff693f062ec5acbc02557e2ed1). Root cause: the dark layer of [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) is one render texture the size of the area's dark water, cleared, filled, faded at each fading edge and stamped with every light whenever a light moves, grows or appears while the camera view meets the dark water; the axolotl's glow moves a whole pixel on most swimming frames. Area 13's dark water (x 1440 to 3840, y 720 to the bed top at 1038) makes that layer 2400 x 318 px, about 763,000 px and 3.1 MB at 4 bytes a pixel, against Area 6's 1200 x 318 px and 1.5 MB, with three fading edges (left, right and top; the bed edge stays hard). Bounded: one layer in one area, at most 2 lights plus one per lit plant and one per lit or dimming fading light (4 in Area 13), nothing drawn while the view is off the pit, and a dimming light redraws only on a quantized step change. Ground: the owner's call, kept as built under the ADR 0028 design and its recorded frame-time residual, since frame time is not measured yet and no build agent can run the [ADR 0013](0013-axolotl-rig-and-frame-budget.md) budget on the owner's phone. Not changed: redrawing only the part the camera shows, for Areas 6, 7 and 13, was not chosen. The owner's on-device frame-time check (PRD open question 524) now includes Area 13's dark water. A measured frame time over budget there promotes this to a filed issue with the same scope.

## Alternatives considered

| Option | Why not |
|---|---|
| The mud turtle on the chase rule | A chasing turtle would be a slow tilapia. A real mud turtle waits and snaps, and a fixed snap spot gives a clear dodge in the dark. |
| Fading lights as glow-plants that stay lit | A plant that stays lit solves the dark once. The fade is the new puzzle: the player relights the way back. |
| A hint clock of its own for the fading lights | Two clocks in one dark would need their own rules for which hint wins. One shared clock keeps the rule the glow-plants already follow. |
| Band 3 lit only by its water colour, as ADR 0041 planned | The owner chose a pitch-black pit (Q4, ND-6). The water colour alone hides nothing, so the dark-water layer covers band 3. |
| Keep every special treasure Common or Rare | Band 3 holds only Epic and Legendary spots, so a Common or Rare special treasure could not sit in the deepest band, as ADR 0041 asks. |
| Count band 2 as deep too | Band 2 holds Rare spots off the path. Deep from band 3 down keeps the band table of ADR 0041. |
| Keep the exit at (2660, 990) | Its gate drew into the east terrace step. |
| Loosen the one-leg run to a wider window | The run measures a real swim. A loosened run would hide a timing change that makes the area unfair. |
