# ADR 0028: Descent areas, the crayfish and dark water

- Status: Accepted
- Date: 2026-10-28
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (the crayfish and the dark stay gentle, and the fact card stays true), [ADR 0008](0008-gentle-fail-state.md) (a pinch shows only the leg-loss poof), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (frame time with the dark layer), [ADR 0014](0014-area-framework.md) (the framework this generalises), [ADR 0018](0018-chinampa-gardens-ghost-nets-and-predator-ladder.md) (boot bake memory, the layout ladder), [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) (the last generalisation, `warnOnRoute`, element kinds), [ADR 0022](0022-danger-pass-phase-2-seam-amendments.md) (living docs name no area), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the whole-water test and its depth bands), [ADR 0025](0025-procedural-background-music.md) (cues are data, made live in code), [ADR 0026](0026-procedural-sound-effects.md) (the ripple and the uh-oh)

This ADR records the build choices for issue #77, the spring cave habitat and its first area, Area 6: the named defaults ND-1 to ND-20 (PRD open questions 506 to 525; ND-k is open question 505 + k), which are provisional, and the owner's decisions on #77, which are final. The owner can override any named default on the implementing PR. Here it covers the shared parts the issue brings: areas of more than 2 rows, the descent shape test, dark water, the puzzle element kind, the crayfish's rules, moving hazards from a roof or the floor, and the music echo. Area 6's own facts are in its PRD N2 row and paragraphs, its open question rows and its Tuning values rows.

## Context

Area 6 is 5 x 3 screens, 2400 x 1080 world px: the first area of more than 2 rows. The area shape rule (PRD N2, owner decision on epic #32) says the first area that needs a shape the framework cannot express, more than 2 rows included, generalises the framework with an ADR, and [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) left areas of more than 2 rows untested. As for Area 5 (PRD open question 246), the generalisation is in this issue's PR, not its own (ND-2).

Area 6 is a descent: it starts top left and only goes across or down to its exit at the bottom right. It adds two new things (PRD N2, New things): the crayfish, a predator that walks the floor, and the glow-plants, its puzzle element, which light up dark water. Its moving hazards are two new types, a stalactite drip from a rock roof and a geyser vent from the floor: the owner's answer to ND-3, option B (owner reply in session, 2026-10-27/28, recorded on #77 and in the PRD). The owner then ruled that the stalactites must not come from the surface (owner reply in session, 2026-10-28): each hangs from real rock in the level, the underside of a rock ledge in the top row. They are danger parts, so they are not new things.

Constraints:

- Areas 1 to 5 build and play exactly as before: every existing golden snapshot stays byte-identical, and their layout, fairness and golden tests pass unchanged.
- `src/logic/` stays pure and the scenes stay thin ([ADR 0006](0006-testing-strategy.md)). No new dependencies and no network requests ([ADR 0007](0007-kid-safety-and-privacy.md)).
- No save field and no `SAVE_VERSION` bump: lit plants are trip state only, and new ids join under the save's additive rule ([ADR 0012](0012-save-on-device.md)).
- The puzzle stays simple for ages 8 to 12, a stuck player gets a gentle hint, and the exit is never locked behind a puzzle the player cannot see how to solve (N3).
- Living docs name no area anew ([ADR 0022](0022-danger-pass-phase-2-seam-amendments.md)).

## Decision

**The framework beyond 2 rows (ND-2).** Every place that might assume at most 2 rows was checked: the zone, the scenery bake's middle row, the camera, the depth bands, the bed and the art. Most already worked for any number of rows:

- The zone: `areaSize(wide, tall)` is `WORLD_H` x `tall` px high with the bed top `BED_DEPTH` above the bottom, and the swim bounds, the camera bounds and the in-trip messages' water rows (`screenWaterRows`) all read the zone's own size.
- The depth bands: `depthBands` splits the whole swim height into three equal bands, surface, middle and floor, whatever the number of rows, so the whole-water test ([ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md)) reads the same in a 3-row area. The bands are not the rows.
- The bed and its reeds are on the bottom row only, and every middle row is the shared flat deep chunk, baked once per area (`areaDeepBgKey`).

What changed:

- `areaRowKind(row, rows)` in `src/logic/zone.ts` names a row `'single'` (a one-row area), `'top'`, `'middle'` or `'bottom'`, and throws a `RangeError` for a row outside the area. `bakeAreaScenery` uses it in place of its own inline choice, so the logic and the art name rows the same way, and its result is the same for every 1-row and 2-row area.
- `src/logic/zone.test.ts` builds a synthetic 5 x 3 area from the canal's data and proves its size (2400 x 1080, bed top 1038), its swim bounds, its three equal depth bands, its row kinds, its reeds on the bottom row's bed and every snack inside the swim bounds of all three rows.
- A look's row details may differ by row: the spring cave look paints a rock roof with its sky opening and lit pool on the top row, rock walls at the row's ends on the top and bottom rows, and the rock bed on the bottom row; its middle rows are the shared flat deep chunk, with no walls. `bedEdgeY` is shared, so every look's bed edge joins between chunks.
- The dev build's area flag also finds a real area (`devAreaById` falls back to `areaById`), and boot does not add a real area twice.

Still assuming a direction: the stream mouth rule, for looks with a stream (ADR 0020).

**The descent shape test (ND-2).** In the area's layout test, like ADR 0020's U-turn shape test: the Home Spot is in the top-left screen, and the safe area is its column in the top row only; the main path starts at the start and ends at the exit; its y never decreases from one point to the next, so it only goes across or down; it passes through every row, top, middle and bottom, in order; the exit is in the bottom row and in the dark water; and the main path crosses each line between two rows exactly once, through a clear opening in that line.

**Dark water and its depth (ND-7, ND-9, ND-18).** An area's layout may hold one `darkWater` rectangle (`DarkWater` in `src/logic/glowPlants.ts`), fixed area data that makes no `rand()` draw, so it changes no seeded content. The pure rules decide what shows:

- The darkness may hide only `DARK_HIDDEN_PARTS`: scenery, snacks, treasure spots, their hint sparkles and finds. `DARK_SHOWN_PARTS`, never hidden, are the axolotl, the exit, the Home Spot, every predator, every moving hazard, every warning, a stranded axolotl and every glow-plant. The HUD is its own scene, so the darkness never covers the controls.
- Lights (`darkLights`): the axolotl's own glow, 120 px round its body centre and always on; the exit's faint glow, 160 px, which covers the exit's 40 px circle and its gate; then 200 px round each lit glow-plant. `shownInDark(part, pos, dark, lights)` is true when the part may not be hidden, the area has no dark water, `pos` is outside it, or a light reaches `pos`.
- Proofs (ND-9): `glowShowsBeforeReach(reach, closingStep)` holds when anything coming within `reach` of the body centre is inside the axolotl's glow at least one step sooner, and the layout test runs it on every snack, tadpoles and shrimp included. The layout test also shows the exit and every glow-plant with no plant lit, proves that nothing the darkness never hides is under it unseen (the Home Spot and every stranding place are out of the dark water, and every predator and moving hazard draws over it), and has a one-leg axolotl swim the main path to the exit with no plant lit.

The scene draws the dark water as one `RenderTexture` layer at `DEPTH.darkWater` (32), filled with the dark colour and with a soft light stamp erased for each light. The depth sits above `collectibles` (30), so the scenery, the treasure spots, the treasures and the snacks under it are hidden outside its light holes, and below `glowPlant` (33), the tilapia (35) and every predator, moving hazard, the halo, a stranded axolotl and the axolotl. Two parts break the depth rule, and each has its own fix:

- The exit draws at `DEPTH.homeSpot` (24), under the layer, so the exit's faint glow always cuts a light hole over it.
- Hint sparkles draw at `DEPTH.hint` (75), above the layer, so they are hidden by the rule (`shownInDark` with `'hint-sparkle'`), not by depth.

The Home Spot and its ring are under the layer too, so no Home Spot may be in the dark water, which the layout test proves. The layer is redrawn only when the camera view meets the dark water and a light has moved, grown or appeared since the last draw, measured in whole px. A new light grows in over 0.5 s (`lightShare`); under reduced motion (`glowMotion`) it appears at once. Lit and dark water differ in brightness, so they read in greyscale.

**The puzzle element kind (ND-8).** `ElementType.kind` becomes `'cycle' | 'puzzle'`. A `'cycle'` element runs a fixed timing cycle, as the mat pairs do. A `'puzzle'` element is always active (`activeFor` equals `period`), has no fact card and no meet range, so it is never met, and has no sweep (`elementSweep` is null), so it never blocks the explorer, never counts as a hazard for the snacks' keep-out rules and never costs a leg; the Shell perk plays no part. `ElementSpawn` gains an optional `glowPlant` geometry, `{ x, y, radius }`, copied wherever the mat pair is copied. A puzzle element counts as an area's one new timing or puzzle element (PRD N2, New things).

The first puzzle element is the glow-plant (`GLOW_PLANT`, id `'glow-plant'`), built with `glowPlantSpawn(id, spot)`, which throws a `RangeError` for a place that is not finite or a radius that is not above 0:

- Lighting: when the axolotl's body centre is within the plant's radius plus the ghost net reach (the Medium body's half height), `lightGlowPlants` appends the plant's id to the trip's lit ids, and it stays lit for the trip. Lighting is silent and emits no trip event.
- Trip state only: `TripState.litGlowPlants`, never saved; `createTrip` and `newTrip` start every plant unlit, being carried home included.
- The hint: `stepDarkHintClock` adds game time while the axolotl's centre is in the dark water and goes back to 0 out of the dark or when a new plant lights. The clock steps only while swimming, so it holds while the game is paused, the banking card shows or the axolotl is carried home. Once it reaches 20 s, `darkHintPlant` picks the unlit plant nearest the axolotl by centre distance, the first in element order on a tie, and the snapshot's `glowPlantHint` holds it only while swimming. The scene pulses it gently, once every 3 s; under reduced motion its outline brightens instead. The layout test proves the hint always points at an unlit plant while one is left, in any lighting order.
- The plants draw at `DEPTH.glowPlant`, just over the dark layer, so the darkness never hides a plant: an unlit plant is a dim teal outline.

**The crayfish's rules (ND-5, ND-14, ND-17, ND-18).** `CRAYFISH_SPECIES` (`'crayfish'`, "Crayfish") is a predator on the shared rules, with the rule options `warnOnRoute` and a new one, `levelStrike`. It is not a danger part: it is its area's one new predator.

- `levelStrike`, an opt-in shared rule option on `PredatorRules`: the aim locked at the end of the warning is level, straight toward the target's side, or along the facing when the target is straight above or below. The strike never moves the predator up or down, so it reaches only a target within its hit radius of the predator's height. ND-5 planned `warnOnRoute` alone, unless the owner's "pinch forward" needed the pinch held level along the floor; it does, so this one option was added, with its tests in `src/logic/crayfish.test.ts`. Every other species keeps `lockAim`.
- With `warnOnRoute`, it warns only while on its floor stretch, so after a pinch it walks back to its stretch before it warns again, and repeated pinches never walk it up off the floor.
- Its first tuning (`CRAYFISH` in `src/logic/tuning.ts`): a 0.8 s warning, the PRD's floor; a 90 px lunge range, so it warns by distance; a pinch at 400 px/s for 0.3 s, 120 px forward; a 1.8 s cooldown; a 60 px/s patrol; and the tilapia's hit, touch and body reach and gentle bump, so a pinch that connects costs a leg and a touch outside one costs none. Its chase (`CRAYFISH_CHASE`): sight 200, leash 0 and speed 120, so it chases along its stretch only, like the garter snake. Like any species, an area may tune it in its own data.
- A crayfish walks its own straight floor stretch: two waypoints on the floor lane, the bed top less 22 px. So its reach is the bottom only, and swimming up when the claws open dodges every pinch, which `src/logic/crayfish.test.ts` proves for a one-leg axolotl from any start and drift.
- Its warning is its claws raised and opened wide, a big shape change that reads in greyscale; under reduced motion they snap open. It is never shown holding, pinching down on or hurting the axolotl, its mouth is always closed, and a hit shows only the leg-loss poof.
- Its fact card, "Meet the crayfish", with the owner's text, is met within 180 px (`CRAYFISH_MEET_RANGE`) and shown once per save; it joins the Collection Book after the existing area cards, in area-table order.
- Sounds: no new sound. Its warning plays the ripple through the existing `telegraph` trip event, a pinch that costs a leg plays the uh-oh, and a bump plays nothing ([ADR 0026](0026-procedural-sound-effects.md)).

**Moving hazards from a roof or the floor (ND-3, option B).** A moving hazard type may say where its shaft starts, `MovingHazardType.from`: `'surface'`, the default, comes down from the water surface as before; `'roof'` comes down from a rock roof; `'floor'` goes up from the floor. A roof or floor spawn sets `baseY`, the world y of its base, and `movingHazardSpawn` throws a `RangeError` when that base is missing or not finite, or when a surface spawn is given one, so every punting pole is built and plays exactly as before. The shared rules read the base and the way the shaft goes (`movingHazardBaseY`, `movingHazardDirection`):

- The cycle is the same five phases, the same warning floor and the same whole-shaft touch: the shaft is the rect x ± halfWidth from the base out to the tip, and the whole of it costs a leg (A4). `depth` is the reach from the base, below a surface or roof, above a floor. The sweep (`movingHazardSweep`) is that rect at the full reach, so every rule that reads the sweep (the danger bar, the fairness harness, the snack and stranding keep-outs, the hiding bands, the meet range and the Dash pot tip) measures a roof or floor hazard where it really is.
- A hit comes from the real tip (`movingHazardTip`): below the base for a shaft going down, above it for one going up. `applyMovingHazard` in `src/logic/encounter.ts` sends that point as the hit's `from`.
- The moving hazard warning sound (`hazardSoundEdges`, `src/logic/hazardSounds.ts`) plays the ripple when any moving hazard type starts its warning with its sweep on screen where it really is, not only a surface shaft. The edge keeps its field name, `poleWarned`.
- A look says where its parts sit along the shaft (`MovingHazardLookPlace` in `src/art/movingHazardTextures.ts`): how much shaft is drawn back past the base behind the bow, how far the tip is held back at rest, where the warning cue and the ring sit, the art's shaft length, and whether a deeper spawn stacks shaft pieces (the pole only). The view places every look the same way from these, the pole at its old places, and crops a shaft that goes up from its top.
- Reduced motion and greyscale work as for the pole: the warning cue shows still at full alpha, the tip comes out to the base at once, the ring shows still at full size, and the strike still moves; every cue has an ink outline.

The two types (`STALACTITE_DRIP` and `GEYSER_VENT` in `src/logic/movingHazards.ts`, provisional values):

- The stalactite drip hangs from a rock roof. A thin stream of drips falls from under its tip, the stream as thin as the pole and with its touch reach, on the pole's 4 s cycle with a 1 s warning, a 0.4 s fall, a 0.6 s hold and a 0.4 s stop. Its warning is a drop swelling at the tip and small ripple rings just under it.
- In Area 6 each stalactite hangs from the underside of a rock ledge in the top row: its base (`baseY`) is the ledge's `y0`, 30 px under the waterline, the rock's underside in the area data, and its stream must sit wholly under the ledge's span, or the layout throws. The ledges are the area's bank overhangs, drawn as rock, so the roof is level geometry that is already there: two of them also hold the Common spots, and a third, east of the safe area, holds only the first stalactite. The stalactite's art grows down from the ledge's rock with no ink line across its root. Each stream still ends where the first pass's pole tip did, and each touch still reaches the top of the swim water, so every danger bar number stayed as it was.
- The geyser vent sits on the floor. It bursts a column of water and bubbles up to its height on a 5.2 s cycle, with a 1.2 s warning, a 0.4 s burst, a 0.8 s hold and a 0.6 s fall back; the column is 16 px wide, with the pole's touch reach. Its warning is bubbles rising from its mouth and a shimmer ring there; no column shows until it bursts.
- Each has its own look, its own fact card, provisional and checked against cited sources ("Stalactites" and "Geysers"), and its Collection Book entry after the crayfish's, in area-table order. Each is a danger part (ND-13), so it never counts as an area's new thing.

**The music echo (ND-16).** A cue may set `echo`, how much of it goes to the music's echo, above 0 and at most 1; absent means no echo, only the shared room reverb, so every other cue sounds as before. The audio engine has one echo, built with the graph: a 0.42 s delay that feeds back 0.38 of itself through a 2400 Hz low-pass, so each echo is softer and darker, into the music bus. When a cue with an echo starts, the music player sends that much of the cue's own bus to it; the send goes when the bus goes. Sounds never reach the echo. A dusk version keeps its day cue's echo. The spring cave's cue, Cenote Glow, sends 0.4, as in the approved sketch (`prototypes/music/sketches.html`), with two new music voices, `glass` and `drip`. The echo never reacts to danger (M5).

## Alternatives considered

| Option | Why not |
|---|---|
| Generalise the framework in its own PR first (the area shape rule's default) | The owner allowed it in the area's own PR for Area 5 (PRD open question 246), and little needed to change. The owner can still ask for its own PR (ND-2). |
| A per-row depth band (one band per screen row) | Changes the whole-water test for every area. Three equal bands of the swim height already work for any number of rows. |
| Rock walls on the middle rows too | The middle rows share one flat deep chunk, so each area bakes one middle chunk however tall it is. Walls there would need chunks of their own at each middle row's ends. |
| Darken each hidden object on its own | Every view would need a dark rule, and scenery baked into the background could not be hidden. One layer hides everything under it at once. |
| A dark layer over everything, with the shown parts lit by their own lights | Every predator, pole, warning and stranded axolotl would need a light hole, and a missed one would hide a threat. Drawing them above the layer makes "never hidden" hold by depth. |
| Redraw the dark layer every frame | Wastes fill time while nothing changes. It is redrawn only when the view meets the dark water and a light changed. |
| Make the glow-plant a `'cycle'` element that never ends | A cycle element's rules (blocking, cards, met ranges) would need exceptions. A `'puzzle'` kind says plainly that it has none of them. |
| Save lit plants | Adds a save field and a `SAVE_VERSION` bump, and a trip would start already solved. The owner made them trip-only. |
| A fact card for the glow-plants | The owner named only the crayfish's card. |
| The crayfish's pinch along `lockAim`, aimed at the axolotl | A pinch could rise off the floor at an axolotl above it, so swimming up would not always dodge it. `levelStrike` keeps the floor-only reach. |
| No echo, only the shared room reverb | The approved sketch has the echo, and it is what makes the cue sound like a cave. The other choice stays open on the PR (ND-16). |
| An echo per cue run | More nodes for each run. One echo, built with the graph, is shared by every run that sends to it. |
| The punting pole as the area's moving hazard (ND-3, option A) | The owner chose option B: two new types that do not come from the surface, a stalactite drip and a geyser vent. |
| A new kind of moving hazard for each base, with its own rules | The roof and floor hazards keep the pole's cycle, warning and whole-shaft touch; only the base and the way the shaft goes differ. One type with an optional `from` keeps every shared rule in one place. |
| Stalactites hanging from the cave roof over the top row, their streams starting at the waterline under the sky opening | The owner ruled that they must not come from the surface (2026-10-28). A base on the waterline reads as coming from the surface. |
| A new kind of rock roof in the area data for the stalactites | A new field in the shared area data, and a new prop to draw. The spring cave's rock ledges are already rock roofs under the water, built as bank overhangs. |
| Stalactites under rock roofs in the middle or bottom rows | The top row's water near the surface would lose the stalactites' danger, so the danger bar would need reworking. Under the top row's ledges every danger bar number stays. |
| A drip stream whose top end falls away too, so the stream moves down as a whole | The shaft would no longer start at its base, which every shared rule reads. The stream draws back toward the stalactite at the end, as the pole lifts. |

## Consequences

- An area may be any number of rows tall. Areas 1 to 5 build and play exactly as before, and their goldens are byte-identical; the only new snapshot is Area 6's own golden.
- A descent area proves its shape in its own layout test, as a U-turn area does.
- An area may have dark water. Its layout must keep every part the darkness never hides out of it or lit, and its tests prove the area can be finished with no plant lit.
- A puzzle element needs no fact card, no meet range and no sweep. A later puzzle element can reuse the kind.
- `levelStrike` is a shared rule option any later floor or level striker can turn on.
- A moving hazard may come down from a rock roof or up from the floor. A later roof or floor hazard is one type, one look and its fact card.
- A cue may have an echo; a cue without one sounds as before.
- No save field and no `SAVE_VERSION` bump.

Recorded residuals:

- Boot bake memory grows. Root cause: every area's scenery is baked at boot ([ADR 0014](0014-area-framework.md); ADR 0018's residual), and Area 6 bakes 11 more scenery chunks: 5 for its top row, 5 for its bottom row and 1 shared middle chunk, plus the spring cave props (the grotto, the rock ledges, the outflow marks, the glow-plants and the soft light). Bounded: one area, and its middle row is a single shared chunk. Not changed: baking on demand is still deferred to its own change.
- Frame time is not measured on a device (ND-19, PRD open question 524). Root cause: the [ADR 0013](0013-axolotl-rig-and-frame-budget.md) budget is measured on the owner's phone, which no build agent can run; the only measurement is the dev frame stats in `npm run dev`, reported on the PR. While the axolotl swims with the camera view on the dark water, its glow moves by a whole px on most frames, so the layer is cleared, filled and stamped once per light on most of those frames, and `darkLights` allocates its result every frame. Bounded: one layer the size of the dark water, at most 2 lights plus one per lit plant, and nothing drawn while the view is off the dark water. Not changed: it stays an owner check in the PR.

- The surface danger check (`hasSurfaceDanger`, [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md)) still counts every moving hazard as danger from the surface, a floor hazard included. Root cause: the check predates hazards that do not come from the surface. Bounded: it only makes the floor rule apply, which asks more of an area, never less, and an area with a roof hazard has danger from above anyway. Not changed: the bar's rule for every area stays as it is.

Follow-ups:

- The owner confirms the provisional named defaults (PRD open questions 506 to 525) on the PR, and checks frame time in the dark water on their devices (ADR 0013).
- The owner checks the stalactite and geyser fact card text against their cited sources, and the two hazards' provisional timings in play.
- Whether lighting a glow-plant should later get a soft glass chime, sketched and measured first (sound guide, section 7; ND-17).
