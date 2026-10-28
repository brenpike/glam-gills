# ADR 0029: Climb areas, rock walls, the pebble and pulsing currents

- Status: Accepted
- Date: 2026-10-28
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (the vents and the pebble stay gentle, and the fact card stays true), [ADR 0008](0008-gentle-fail-state.md) (a surge costs no leg), [ADR 0014](0014-area-framework.md) (the framework this extends), [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) (the mats, the first thing that blocks the explorer, and the U-turn shape test), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (moving hazards and the gap measure), [ADR 0022](0022-danger-pass-phase-2-seam-amendments.md) (living docs name no area), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the whole-water test and its grid), [ADR 0024](0024-mobile-snack-wander-loops-and-shrimp-hops.md) (mobile snack homes and their keep-outs), [ADR 0026](0026-procedural-sound-effects.md) (silent moments), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (the puzzle element kind and the descent shape test)

This ADR records the build choices for issue #105, the spring cave's second area, Area 7: the named defaults ND-1 to ND-16 (PRD open questions 526 to 541; ND-k is open question 525 + k), which are provisional, and the owner's decisions on #105, which are final. ND-3 is the owner's decision (2026-10-28). The owner can override any named default on the implementing PR. Here it covers the shared parts the issue brings: the climb shape test, solid rock walls and side rooms, the pebble, the pulsing current, the danger grid's rock rule and the snack keep-outs from rock. Area 7's own facts are in its PRD N2 row and paragraphs, its open question rows and its Tuning values rows.

## Context

Area 7 is 8 x 2 screens, 3840 x 720 world px. The owner's shape for it is a climb (owner decision on #105, 2026-10-22): start at the bottom, ride up past the vents, exit at the top. It adds two new things (PRD N2, New things): the pulsing current, a hazard that pushes but never costs a leg, and the pebble, its puzzle element, which opens an optional side path. The owner set the pebble's rules: it rolls one way only along a fixed groove, so it can never get stuck, it resets each trip, and the main route never depends on it.

The pebble must block a side path, and the side path must be walled, or the axolotl would swim round the pebble. Until now nothing in an area was solid but the swim bounds and the water hyacinth mats, which block on a cycle. So the area needs solid rock: the first solid terrain.

The pulsing current costs no leg, so it does not count toward the danger bar's moving hazard rule. The owner chose to carry Area 6's stalactite drips and geyser vents forward within the spring cave for that (owner decision on #105, 2026-10-28; ND-3), the same way the crayfish and the glow-plants are carried forward. No new moving hazard type is added.

Constraints:

- Areas 1 to 6 build and play exactly as before: every existing golden snapshot stays byte-identical, and their layout, fairness and golden tests pass unchanged. Every new field is optional and absent means none.
- `src/logic/` stays pure and the scenes stay thin ([ADR 0006](0006-testing-strategy.md)). No new dependencies and no network requests ([ADR 0007](0007-kid-safety-and-privacy.md)).
- No save field and no `SAVE_VERSION` bump: the pebble is trip state only, and new ids join under the save's additive rule ([ADR 0012](0012-save-on-device.md)).
- The puzzle stays simple for ages 8 to 12, a stuck player gets a gentle hint, and the exit is never locked behind a puzzle (N3).
- Living docs name no area anew ([ADR 0022](0022-danger-pass-phase-2-seam-amendments.md)).

## Decision

**The climb shape test (ND-2).** In the area's layout test, the mirror of ADR 0028's descent test: the Home Spot is in the bottom-left screen, and the safe area is its column in the bottom row only; the main path starts at the start and ends at the exit; its y never increases from one point to the next, so it only goes across or up; it passes through the bottom row, then the top row; the exit is in the top row, in the right-hand screen; and the main path crosses the line between the rows exactly once, going up through a clear opening in that line. Nothing in the framework assumed that a trip starts in the top row, so no framework change was needed: the zone, the camera, the depth bands, the bed and the safe area already read the area's own data.

**Rock walls and side rooms as layout data (ND-8).** An area's layout may hold `rockWalls`, solid rock rectangles (`RockWall` in `src/logic/pebble.ts`), and `sideRooms`, the water rectangles walled in behind a pebble. Both are fixed area data that make no `rand()` draw, so they change no seeded content, and both are copied onto the built zone. Rock is drawn as cave rock and blocks only the explorer: the predators, a following rescue and the snacks are not blocked, so the layout keeps them clear of it instead (the carp loops by their body and leash, the snacks and the mobile snack homes by the keep-outs below).

**How the explorer is blocked: each axis on its own.** `blockAtRock(prev, next, walls)` takes one swim step. Each wall is grown by the body reach, the ghost net reach (the Medium body's half height); a body centre inside a grown wall is in rock, and the grown edge itself is clear. When the step's end is in no rock, the step is returned as it is, the same object, so it can run every frame. Otherwise:

- A body already in rock, as at a bad start, is first put out the shortest way.
- Then x moves on its own, from the start's y: if that is in a wall, x stops at the wall's grown face on the side it came from.
- Then y moves on its own, from the new x: if that is in a wall, y stops at the grown face the same way.

So a step into a wall at a slant stops on one axis and slides along the other, and the axolotl glides along rock instead of sticking to it. A step is never longer than a wall is thick, so it never goes through one. The scene runs the pebble step first, then `blockAtRock`, after the mats, on every swimming frame.

**The pebble rolls one way only (ND-8).** The pebble (`PEBBLE`, id `'pebble'`) is a puzzle element of ADR 0028's kind: always active, with no fact card, no meet range and no sweep, so it is never met, never counts as a hazard for the snacks and never costs a leg. Its spawn carries a groove (`PebbleGroove`): a straight line from its start to its end and the pebble's radius. `pebbleSpawn` throws a `RangeError` for a place that is not finite, a radius not above 0 or a groove of no length.

- Its state is how far it has rolled along its groove (`PebbleState.along`), from 0 at the start, clamped to the groove.
- `stepPebbles` rolls it on only when the body touches it, came from behind its centre along the groove and moves forward along it; it rolls by at most the roll speed times the step, and never past the groove's end. A body pushing from the far side, or only touching it, is put out of the pebble and the pebble stays. Then the body is put out of every pebble it is in, along the line from the pebble's centre.
- So it can only roll toward the groove's end, and it stops there for good. It can never roll back into the doorway, and it can never be pushed into a place where it is stuck: the side room can always be reached once the pebble has rolled, and the layout test proves that once rolled it leaves at least the safe passing width open under the wall.
- Its state is trip state only, held by the scene for the trip and never saved; each trip starts with every pebble at the start of its groove (`createPebbles`).
- The hint: `stepPebbleHintClock` adds game time while the body centre is within the hint range of the edge of a pebble that has not rolled at all, goes back to 0 away from it or when a pebble rolls, and holds while paused; the scene steps it only while swimming, so it also holds while the banking card shows and during the carry home. Once it reaches the hint time, a still arrow shows behind the pebble, pointing the way it rolls. The arrow does not move, so reduced motion changes nothing.

The side room is optional: the main path, the exit, the Home Spot and every stranding place are out of it, and no snack starts in it, so the exit never needs the pebble. Each area with a pebble proves this, and that a one-leg axolotl can push the pebble the whole groove and swim in, in its own layout test.

**The pulsing current: a no-leg hazard on the element clock, kept out of the gap obstacles (ND-5, ND-6).** The pulsing current (`PULSING_CURRENT`, id `'pulsing-current'`) is a hazard type that never costs a leg and touches nothing (reach 0), with a meet range of 60 px from its band and the "Underwater springs" fact card. A spawn (`pulsingCurrentSpawn`) is a band rectangle with a pulse: its calm in seconds, its flow (left, right, up or down) and its offset. The warning and the surge are shared values (`PULSING_CURRENTS`): a 0.8 s warning, the A2 floor, and a 1.5 s surge at 200 px/s. `pulsingCurrentSpawn` throws a `RangeError` for an empty or non-finite band, a calm under 2.0 s, an offset that is not finite, or a band that a one-leg axolotl cannot cross, body edge to body edge, in the calm plus the warning.

- Clock: its cycle runs on the trip's element clock, the same clock as the mats, so it pauses with the game (A17), while the banking card shows and during the carry home, and restarts with each trip. It is not a moving hazard, which runs on the encounter's hazard clock: a moving hazard costs a leg and is a danger part, and the pulsing current is neither.
- Push: `addPulseCurrent` adds the surge's push to the steady current at the body centre, only inside the band and only while it surges. 200 px/s beats the fastest swim, 150 px/s, or 172.5 px/s at the speed perk's cap, so a surge pushes any swimmer back; a Tail Dash takes a current at 0.3 of its speed, so a dash still gets through. The push stops at the band's edge, since the current is the band only, so a surge leaves the axolotl just past the band's downstream edge, in its landing strip, 60 px deep across the band's width (`pulseLandingStrip`).
- Never a hit: a surge costs no leg and starts no protected time, and the Shell perk plays no part.
- Kept out of the threat measures: the risk ladder's threats (B10) are the predators and the hazards that cost a leg, so a band is never a risk threat for hiding spots. The gap measure's obstacles (`obstaclesOf` in `src/logic/layoutGaps.ts`) skip every hazard with a pulse, because a band is swum through, not round. The danger bar counts only predators and moving hazards, so a band is never a moving threat. And an area's `currents` stay its steady currents only, so a band never makes a past-current band.
- Counted as a current for snack homes: every hazard's sweep is in the mobile snack keep-outs, so every tadpole loop and shrimp home keeps `SNACK_HAZARD_CLEARANCE` from each whole band, calm or not (owner decision on #105, 2026-10-24), and seeded worms and bugs start that far from it too.
- Fair landings: each area with pulsing currents proves in its own layout test that every landing strip is in the swim bounds, out of every predator's strike and every crayfish's reach, clear of every moving hazard's touch, the rock, the side room, every other band and the steady current. So a surge never pushes the axolotl into a crayfish's reach, a dead end or a wall.
- Looks (ND-7): the vent's rock mouth sits at the middle of the band's upstream edge (`ventMouth`). In the warning, bubbles build at the mouth and rise into the band; while it surges, streaks flow along the band. Under reduced motion (`pulseMotion`) the bubbles hold still and the surging band darkens. In both, the surging band has an ink outline, so it reads in greyscale. It is silent (the sound guide's silent moments).

**The danger grid treats rock as not quiet (ND-4).** The whole-water test ([ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md)) walks a grid over the swim water and finds the longest swim through quiet points. A grid point inside a rock wall, edges included, is never quiet: rock is not water, so a quiet swim ends at the rock as it ends at a threat, and a quiet swim never runs through a wall. The geometry's `rockWalls` is optional, so every area without rock measures exactly as before.

**Mobile snack homes are kept off rock (ND-8, ND-9).** `mobileSnackAvoid` adds every rock wall and side room to the keep-outs (`keepAway`) and to the hard keep-outs (`hazards`), so every tadpole loop and shrimp home keeps `SNACK_HAZARD_CLEARANCE` from the rock and from the room behind the pebble: no snack swims into rock or waits behind the pebble. The zone build adds them to the shapes a seeded snack start is redrawn away from too, so no worm or bug starts in or near the room. Both are absent in every other area, so nothing else changes.

## Alternatives considered

| Option | Why not |
|---|---|
| A pebble that can be pushed either way, or rolls freely | It could be pushed back into the doorway, or wedged where it blocks the room for good. The owner's rule is one way only, so it can never get stuck. |
| A pebble that rolls itself once touched | The push is the puzzle: the player works out the way to push it. A one-way roll while pushed keeps it simple. |
| Save the rolled pebble | Adds a save field and a `SAVE_VERSION` bump, and later trips would start already solved. The owner made it reset each trip. |
| A side path walled by the swim bounds only, with no rock | The axolotl would swim round the pebble. The room needs real walls. |
| Rock that blocks with a push-out, as the mats do | A mat moves and pushes the explorer out along its channel. Rock never moves, so stopping each axis at its face is simpler and lets the axolotl slide along it. |
| Moving both axes together and stopping the whole step at the rock | The axolotl would stick to a wall it swims into at a slant. Each axis on its own slides along it. |
| Rock that blocks the predators too | Every predator route and chase would need a path round the rock. Keeping the routes clear of the rock in the layout is simpler and proved by the layout test. |
| The pulsing current as a moving hazard on the hazard clock | A moving hazard costs a leg and is a danger part, counted by the danger bar and the risk ladder. The pulsing current is neither, so it would need exceptions in every one of those rules. |
| The pulsing current as a gap obstacle | The axolotl swims through a band in the calm; measuring the main path's gaps round it would count the way through as blocked. |
| The pulsing current as a steady current with a cycle | A steady current makes a past-current band for hiding spots, and the owner keeps the treasure past the steady outflow. A band is not a hiding place. |
| A surge that keeps pushing past the band | It could carry the axolotl into a crayfish's reach or a wall. Stopping at the band's edge puts every landing in a strip the layout test checks. |
| A new moving hazard type to meet the danger bar | The owner chose to carry the stalactite drips and geyser vents forward within the habitat (ND-3). |
| A vent warning sound and a pebble roll sound | The owner chose none (2026-10-28): each is a silent moment in the sound guide (S2). |

## Consequences

- A climb area proves its shape in its own layout test, as a descent or U-turn area does.
- An area may have solid rock and a walled side room. The explorer's body never enters rock, the danger bar's quiet swims end at it, and no snack starts in or near it. Areas 1 to 6 have none and play exactly as before.
- A puzzle element may block the explorer by its own shape, as the pebble does, and still never be a hit.
- A later pebble is one spawn on a groove; a later climb, rock wall or side room is area data.
- An area may have pulsing currents. They are met and carry a fact card, but they are never a risk threat, a danger bar threat, a gap obstacle or a past-current band, and their bands are currents for snack homes.
- No save field and no `SAVE_VERSION` bump.

Recorded residuals:

- Boot bake memory grows a little. Root cause: every area's scenery is baked at boot ([ADR 0014](0014-area-framework.md); ADR 0018's residual), and Area 7 adds 8 scenery chunks for each of its 2 rows, plus one bake per rock wall size and the pebble, its hint arrow, the vent mouth, the warning bubble and the surge streak. Bounded: one area, small props. Not changed: baking on demand is still deferred to its own change.
- Frame time is not measured yet, not with the dev frame stats in `npm run dev` and not on a device. Root cause: the [ADR 0013](0013-axolotl-rig-and-frame-budget.md) budget is measured on the owner's phone, which no build agent can run. Bounded: the vents and the pebble reuse their sprites, and a frame allocates only a pebble's centre point. Not changed: it stays an owner check in the PR.
- Rock blocks only the explorer. Root cause: the predators, a following rescue and the snacks never read the rock. Bounded: the layout test keeps every carp loop clear of the rock by its body and leash and every snack and snack home away from it. A following rescue is not held out of the rock. Not changed.

Follow-ups:

- The owner confirms the provisional named defaults (PRD open questions 526 to 541) on the PR, and checks frame time in Area 7 on their devices (ADR 0013).
- The owner checks the "Underwater springs" fact card text against its cited sources, which were read through search summaries only.
- The owner checks the vent cycle, the surge and the pebble's roll and hint in play.
