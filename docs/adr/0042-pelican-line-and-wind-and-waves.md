# ADR 0042: The pelican line and wind and waves

- Status: Accepted
- Date: 2026-11-06
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the pelican gentle: no catch, hold or lift), [ADR 0008](0008-gentle-fail-state.md) (the gentle fail state, which a scoop hit goes through like any hit), [ADR 0012](0012-save-on-device.md) (the new ids under its additive rule), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the shared predator chase rule and timing elements), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the danger tests and the safe passing width), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (the pulsing current, which wind is distinct from), [ADR 0038](0038-grand-tour-areas-trajinera-lures-and-drag-nets.md) (the drag net, the first timing element that costs a leg), [ADR 0041](0041-stepped-lake-areas-depth-bands-and-banded-danger-rules.md) (Area 12's stepped, depth-banded floor and the banded danger rules)

This ADR records the build choices for issue #211, the open lake's Area 12: its one new threat, the American white pelican line, and its timing element, wind and waves. Wind and waves in place of a sluice gate exit was the owner's choice. The tuning values and the named defaults in the code comments (ND-5, ND-6, ND-10, ND-11, ND-14, ND-20) are provisional until the owner reviews them on the PR.

## Context

Every predator so far hunts: it patrols, sees the axolotl, warns and strikes, under the shared chase rules ([ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md)). The pelican on the lake does not. American white pelicans forage by floating in a line on the surface and dipping their bills together to scoop fish. That is a formation on a schedule, which suits the game's telegraph rule (PRD A2): a warning before every strike, at least the minimum wind-up time.

The lake also needs a timing element of its own. The pulsing current ([ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md)) is one fixed zone that pushes along its flow. A lake is open water with a wide surface, where a gust of wind that blows one way and then the other fits better.

Real basis, checked 2026-11-05 (web research only; the game fetches nothing):

- Milenio, "Cientos de pelícanos llegan a Xochimilco para refugiarse del frío extremo de EU y Canadá", 2025-02-11. The American white pelican (Pelecanus erythrorhynchos) winters at Xochimilco, hundreds of them, and some form groups and plunge their bills into the water together.
- National Audubon Society, Guide to North American Birds, American White Pelican: it forages by swimming on the surface and dipping its bill to scoop fish into its pouch, may forage in a line, and does not dive from the air for fish.
- Findholt and Anderson 1995, Colonial Waterbirds 18(1):58-68: the diet of American white pelicans nesting at Pathfinder Reservoir, Wyoming, which included tiger salamanders (Ambystoma tigrinum). The fact card never says a pelican eats an axolotl.

"Axolotls stay safe by swimming down deep" is the game's rule (the scoop goes only so deep), read from the surface feeding, not a source claim.

## Decision

**The pelican line is a scheduled formation, not chase logic (`src/logic/pelicanLine.ts`, ND-5, ND-6).** A pelican line is its own area field (`pelicanLines`), built with `pelicanLineSpawn`. It is never a predator species, never in `hazards` or `elements`, and has no leash, sight or cover. Its birds float at the surface (SURF), a fixed spacing apart, and glide as one back and forth along a span. On one shared cycle every line runs five phases: glide, warn, plunge, hold, rise.

- **Cycle.** The provisional tuning (`PELICAN_LINE`) is 3 birds 200 px apart, each with a 100 px scoop box. The line glides at 50 px/s for 3.0 s, warns 1.0 s, plunges 0.4 s to 220 px below SURF, holds 0.5 s and rises over 0.6 s: a 5.5 s cycle. The line holds still from the start of the warning to the end of the rise, and turns at once at each end of its span.
- **Warning.** The warning (heads up, pouches open) is at least the A2 floor of 0.8 s, which `pelicanLineSpawn` enforces (it takes the floor from the tilapia's `minWindup`). The warning plays the shared ripple sound when an on-screen line goes into the warning, at most once a frame with the moving hazards' warnings (`src/logic/hazardSounds.ts`, ND-14). The wind and waves play none.
- **Synced plunge.** Every bill plunges, holds and rises together. Each bird makes a scoop box, `scoopWidth` wide and from SURF down to the bill, live from the start of the plunge to the end of the rise.
- **Gaps.** The gap between two neighbour scoop boxes, with both touch reaches (18 px, the ghost net's) taken off, is 200 - 100 - 2 x 18 = 64 px clear. `pelicanLineSpawn` throws for a gap under `SAFE_PASSING_WIDTH`, so the axolotl can always slip between two boxes. It can also dive under the dip. The dip reaches y 300 in Area 12, in the shelf water and out of band 2.
- **Two lines, out of step.** Area 12 has two lines of three, half a cycle apart (offsets 0 and 2.75 s): one over the left shelf and the shallows west of the safe area, one over the shallows east of it and the right shelf, short of the exit.

**A scoop that connects is a leg hit and a gentle push, never a catch (ADR 0007, ND-6; `src/logic/trip.ts`).** When a body centre is within the touch reach of a scoop box (`pelicanScoopHit`), the trip lands one hit through the shared hit path with source `'pelican'`, from the bill (the bottom middle of that bird's box). The first such scoop of a step also gives a gentle push away from the bill, never up, at the tilapia's bump speed (`PELICAN_PUSH_SPEED`).

- **Once per scoop per line.** The trip keeps the number of the last scoop that landed per line (`pelicanScoopNumber`), so one scoop hits at most once. A scoop while protected still counts as landed and still pushes. A predator bump in the same step wins over the push, and the push wins over a trajinera push.
- **Never a hold.** A scoop never holds, lifts or carries the axolotl. It sets no `outOfHull` or `landed` and emits no event of its own; the hit's events play the shared hit, which shows only the usual leg-loss poof. Dashing gives no immunity. During a bailing bucket toss no scoop acts, and while the axolotl is carried the scoops are not stepped.
- **Fact card.** "Meet the pelican" (`PELICAN_FACT`, ND-20) is met within `PELICAN_MEET_RANGE` (180 px) of a bird, outside the Home Spot.

**Wind and waves is a cycle element (`src/logic/wind.ts`, ND-10, ND-11).** One cycle runs a calm, then a ripple warning on the surface, then a gust. The provisional tuning (`WINDS`) is a 3.0 s calm, a 1.2 s warning, above the A2 floor, and a 2.5 s gust: a 6.7 s cycle.

- **Direction alternates.** Each gust blows the other way from the one before, starting with the spawn's first direction. The calm and the warning share the coming gust's direction, so the ripples show which way it will blow.
- **It fades with depth.** A gust adds 60 px/s along x at SURF and above, fading linearly to 0 at y 360 (`fadeY`, the bottom of the first screen), so depth band 2 is calm.
- **Calm in the safe area.** `addWindForce` adds nothing inside the safe area, edges included.
- **Only the axolotl.** The wind never moves a snack or a predator. It is added to the steady current's own result after the vents, on the same element time, and allocates nothing.
- **Silent and not met.** The wind has no fact card, no meet range and no sweep, so snacks never keep away from it, and it plays no sound. It never costs a leg and never starts protected time.
- **Still swimmable.** A one-leg axolotl swims at 90 px/s, so against the strongest gust it keeps 30 px/s of headway. `windSpawn` throws for a tuning that leaves it under `minHeadway` (30 px/s) or a warning under the A2 floor.
- **Reduced motion.** The ripples and gust streaks hold still, but the warning and the gust still show, because the push is gameplay.
- **Distinct from the pulsing current.** The pulsing current is one fixed zone with one flow. The wind spans the surface band, changes direction each gust and fades with depth.

**Module structure.** `SAFE_PASSING_WIDTH` moved to `src/logic/ghostNets.ts`, and `layoutGaps` re-exports it. `pelicanLine` therefore does not import `layoutGaps`, which closed an import cycle through perks. `src/logic/moduleCycles.test.ts` guards the cycle.

## Consequences

- A later area can add a pelican line as area data with `pelicanLineSpawn`, and the danger bar counts it as a moving threat (ADR 0041). A later area can add wind as an element with `windSpawn`.
- Areas 1 to 11 and the spring cave have no pelican line and no wind, so they build, play and bake as before.
- The ids `'pelican'`, `'wind'` and the line and wind ids of Area 12 are fixed for good (ADR 0012). The save format is unchanged: the met list only gains `'pelican'`.
- A scoop's push is a new source of impulse in a trip step, ranked below a predator bump and above a trajinera push. A later hazard that pushes must take a place in that order.
- The cycle, spacing, dip, speed, gust and fade values are provisional. The owner can tune or reverse them on the PR, as tuning.

## Alternatives considered

| Option | Why not |
|---|---|
| Pelicans on the shared predator chase rule | A pelican hunting by sight would be a diver or a lunger like the cormorant, and a real line forages together on a beat. A formation on a schedule is readable, and it gives the axolotl a clear gap between boxes. |
| The scoop as a bump only, with no leg cost | A bump with no cost would make the pelican the only hazard that does nothing, in an area where it is the one new threat. The shared hit is the gentle fail state ([ADR 0008](0008-gentle-fail-state.md)). The push keeps the bump feel. |
| Wind as a variant of the pulsing current | The pulsing current is one fixed zone with one flow. Wind alternates its direction, fades with depth, spans the surface and keeps the safe area calm. |
| A sluice gate exit | The owner chose wind and waves for the lake's timing element. |
