# ADR 0023: Whole-water danger test and relaxed fairness

- Status: Accepted
- Date: 2026-10-24
- Amends: [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (replaces only its danger bar part (ND-12), where the main path measure gives way to the whole-water test with the depth, floor and carp rules, and its fairness harness's safe start (ND-17), which no longer counts sight and is searched over the whole area; every other ADR 0021 rule stays in force)

This ADR records the owner's decisions of 2026-10-24 on issue #130 (danger pass phase 3, the shared parts), made after the owner's play test of phase 2. The provisional parts are [PRD](../prds/axolotl-mvp.md) open questions 343 to 353, one per named default, ND-k being open question 342 + k.

## Context

ADR 0021 set the danger bar and the ramp bar (ND-12): "in reach" sampled every 1 px along each area's main path, one line drawn by hand. Phase 2 placed each area's threats to cover that line. The owner's play test of 2026-10-24 found the areas no harder: in the two-screen-tall areas the axolotl could swim along the bottom and miss the poles and snakes, the surface danger did little, and the biggest area had one carp or none.

The cause is the measure, not the areas. An area passes while the floor, and in places the surface, has no threat in reach, because the main path goes round those quiet stretches.

The fairness harness (ADR 0021, ND-17) asked a safe start to be farther than the leash plus the larger of sight and lunge range from every chasing loop (400 px for a full-bar tilapia), and searched only 600 px from the spot. Once the whole water is covered, many spots would have no such start.

## Decision

**Owner decisions (2026-10-24, issue #130).**

1. Swimming predators (tilapia and carp) patrol at every depth: surface, middle and floor. They are not each held on one line.
2. An area with surface danger (garter snakes, herons, punting poles, or any threat from the top) also has predators on the floor.
3. About one carp for every 3 screens of water, from Area 2 on. A screen is 480 x 360 px, the same screens the danger bar counts.
4. The test checks all the water. The safest way from the start to the exit, through all the water, floor and surface included, must still meet the bar: no quiet stretch longer than one screen across (480 px). A level fails if any lane is quiet.
5. Area 2 gets real chasing tilapia at every depth, plus carp, and stays the gentlest area after the canal. Area 1 does not change.
6. The black bass (#78) follows the depth rule too, like the tilapia and the carp.
7. The spring cave (Areas 6 and 7) gets both the crayfish and the carp rule (about 5 carp per area), not one or the other.
8. How strict rule 1 is: each loop reaches into at least 2 of the 3 depth bands, and each species' loops together cover all 3 bands (ND-5).
9. The fairness rule is relaxed, because the areas are big and get bigger (ND-11).
10. Version: patch.

This issue builds the test, the rules and the relaxed fairness harness only, and changes no area. The area issues retune the areas after it merges: #132 (Area 2), #133 (Area 3), #134 (Area 4) and #135 (Area 5).

**The bars.** The full danger bar (from Area 4 on) keeps its moving threat count (at least ⌈0.75 × screens⌉), 2 predator species, 1 moving hazard type and every predator chasing. The ramp bar (Areas 2 and 3) keeps the tilapia chase, no moving hazard type in Area 2 and at most one in Area 3. In both, the whole-water test (ND-1) replaces the main path measure, and the depth rule (ND-5), the floor rule (ND-6) and the carp rule (ND-7) are added. Area 1 stays as it is. The gentle stakes stay (G2).

**ND-1 The whole-water test: quiet pockets (open question 343).** A grid covers the swim water, one point every 8 px (`QUIET_GRID_STEP`), its last row and column on the water's edges. Each point is in reach (ND-3), home (inside the safe area) or quiet. Quiet points that touch, diagonals included, make one quiet pocket. A quiet swim starts at an in-reach or home point, goes through quiet points of one pocket only, and ends at an in-reach or home point or at the water's edge. Its length is the shortest such way on the grid: 8 px across or up and down, about 11.3 px on a diagonal. `longestQuietSwim(layout)` gives the longest quiet swim and its two end points, and it is exact. The bar is at most 480 px. The bars take a quick bound per pocket first (twice the farthest swim from one point), skip any pocket whose bound is at most 480, and stop at the first swim over 480. Threats do not depend on the zone seed, so a layout test proves the bar on the default seed and checks that the threats match on other seeds. Grid diagonals count up to about 8% long, so the test errs a little on the strict side.

**ND-2 Which water counts (open question 344).** The swim water is `swimBounds(layout)`: x 40 to width − 40, y 94 to bedTop − 22, all open water, across the line between screen rows too (the area framework has no solid terrain, ADR 0018). Ghost nets, water hyacinth mats, currents and bank overhangs are water. The safe area is home: never quiet and never a threat. An area that later adds solid terrain teaches the test about it in its own PR.

**ND-3 In reach, unchanged (open question 345).** A predator is in reach within its lunge range plus its leash of its patrol loop (leash 0 with no chase or with the warn-on-route rule). A moving hazard is in reach within its touch reach of its whole sweep. Cover is ignored, and still hazards do not count. The risk ladder (B10) and the gap measure still ignore the leash (ADR 0021, ND-5).

**ND-4 Depth bands (open question 346).** The swim water's height splits into three equal bands: surface, middle and floor. One screen tall: y 94–161, 161–229, 229–296. Two screens tall: 94–281, 281–469, 469–656. Three screens tall: 94–401, 401–709, 709–1016.

**ND-5 The depth rule (decisions 1, 6 and 8; open question 347).** It covers tilapia routes, carp routes (species id `'carp'`) and, once it ships, the black bass. (a) Each loop reaches at least 24 px, a tilapia body, into at least two bands. (b) Each species' loops together reach at least 24 px into every band.

**ND-6 The floor rule (decision 2; open question 348).** An area has surface danger when it has any moving hazard, or any predator route lying wholly inside the surface band. Then the floor lane (y = bedTop − 22), sampled every 1 px with home as a threat point, has no stretch longer than 480 px out of every predator's reach. Only predators count here, not moving hazards.

**ND-7 The carp rule (decisions 3 and 7; open question 349).** The carp target is screens / 3, rounded to the nearest whole number, halves up: 2, 2, 4, 5, 5, 5, 5, 6 and 10 for Areas 2 to 10. An area passes with at least that many carp routes. The spring cave's crayfish come on top.

**ND-8 Names, and the old measure (open question 350).** New exports in `src/logic/dangerBar.ts`: `QUIET_GRID_STEP`, `longestQuietSwim`, `depthBands`, `meetsDepthRule`, `hasSurfaceDanger`, `floorQuietStretch`, `meetsFloorRule`, `carpTarget`, `carpCount`, `meetsWholeWaterDangerBar(layout)` and `meetsWholeWaterRampBar(areaNumber, layout)`, which throws a RangeError for any area but 2 and 3. `longestQuietStretch`, `meetsFullDangerBar` and `meetsRampDangerBar` stay unchanged until #136, so every area test on main still passes. Each area issue moves its own layout test to the new bar, and #136 removes the old bar functions once all four have merged.

**ND-9 Tests (open question 351).** In `src/logic/dangerBar.test.ts`, on made-up layouts and the dev area only; they assert nothing about Areas 1 to 5.

- Planner note: every made-up layout is a `Pick<ZoneLayout, ...>` type or a spread of a built zone, and never writes the `collectibles`, `lane`, `wander`, `home` or `mobileSnacks` fields, because #131 changes those types.
- Planner note: the dev area tests read only the dev danger area's threats, size, safe area and swim bounds. They pin its measured whole-water values. The dev area is not expected to meet the new bar.

**ND-10 Records and version (open question 352).** The PRD, CONTEXT.md (the same rows), this ADR, ADR 0021's status line pointing here, the carp's comment in `src/logic/tuning.ts` (comment only), living docs naming no area ([ADR 0022](0022-danger-pass-phase-2-seam-amendments.md)), and a patch bump.

- Planner note, PRD placement: the three new bullets (the depth rule, the floor rule and the carp rule) go right after N2's "In reach" bullet, before "Gentle stakes stay", with one sentence saying the old main path measure stays only until each area's own issue moves its layout test to the new bar. That sentence names no area.

**ND-11 The relaxed fair start (decision 9; open question 353).** A safe start only needs to be farther than the lunge range plus the leash from every predator loop (the same reach as ND-3); sight is no longer counted. It must still be clear of every moving hazard and inside the water. `nearestSafeStart` searches the whole area, ring by ring out to its diagonal, not 600 px, and still takes the nearest safe start. `firstFairStart` does not change. Each area's fairness test may raise its timeout.

- Planner note, the old clearance pins: two area fairness test files pinned the old rule, so they could not pass unchanged. Only these pins move to the ND-11 rule, and their tests are renamed to match: `src/logic/pondFairness.test.ts` uses 200 px (140 lunge + 60 leash) instead of 260; `src/logic/chinampaFairness.test.ts` uses 305 px for the tilapia (145 + 160) instead of 400, and 240 px for the carp (120 + 120) instead of 340. Every other check in every fairness file stays. No timeout changed.
- Known limit, the safe start search: `nearestSafeStart` samples rings 1 px apart, 360 angles per ring, so it can miss a safe pocket narrower than the gap between its sample points. Then the search finds no start and throws, so the fairness test fails loudly; it never passes unfairly. A denser ring search (one point per px of each ring) was tried and rejected: it still left gaps between rings and its cost grows quadratically with no bound (the fairness tests went from 27.5 s to 57.4 s). If a real area ever trips this, the follow-up is an exact nearest-point search.

**The dev area's measured values.** `DEV_DANGER_AREA` (6 x 2 screens, 12 screens) measured with the whole-water test:

| Measure | Value |
|---|---|
| Longest quiet swim | about 2235.1 px, from (1048, 94) on the top row to the bottom right corner, (2840, 656) |
| Depth bands | y 94 to about 281.33, about 281.33 to about 468.67, about 468.67 to 656 |
| Depth rule | fails: its tilapia loops each sit in one band |
| Surface danger | yes |
| Floor quiet stretch | 445 px, so the floor rule holds |
| Carp | 1, of the 4 its 12 screens need |
| Whole-water danger bar | not met |

Its old main path measure is unchanged: a longest quiet stretch of 899.16 px. It stays a showcase, not a bar proof (ADR 0021, ND-15).

## Alternatives considered

| Option | Why not |
|---|---|
| Safest route: the cheapest way from the Home Spot to the exit, time in reach costing the most, then the old measure along it and along every horizontal lane | A second way can still be quiet. |
| Lanes only: the old measure on every horizontal lane, every 8 px | Misses swims that go across at a slant, and up-and-down swims in tall areas such as Area 6. |
| Depth bands per screen row, or fixed 120 px bands at the top and the bottom | Not the named default (ND-4); the owner decides on the PR (open question 346). |
| Every loop spans all three bands | In a two-screen-tall area a loop would be about 560 px tall, leaving room for only about 4 or 5 of them in Area 4, not 10 predators. |
| The depth rule's part (b) only | Decision 8 also asks each loop to reach into at least 2 of the 3 bands. |
| Floor rule on every lane of the floor band, or a quiet-pocket test inside the floor band with predators only | Not the named default (ND-6); the owner decides on the PR (open question 348). |
| Carp target rounded up, or rounded down | Up makes Areas 7 and 8 need 6; down makes Area 2 need 1 and Area 5 need 4. |
| Keep the fair-start clearance and only widen the search | Once the water is covered, many spots would have no start that far from every chasing loop. |
| Count only the lunge range for a safe start, with no leash | Not the named default: ND-11 keeps the same reach as ND-3 (open question 353). |
| Amend ADR 0021 in place only | Loses the record of why the bar changed after ADR 0021 was accepted. An amended rule gets the next numbered ADR, as ADR 0022 did. |

## Consequences

- An area meets a bar only when every way through its water, surface, floor and between, meets it. The main path no longer decides the bar.
- Areas 2 to 5 do not meet the new bars until their own issues (#132 to #135) retune them; until then each area's layout test keeps the old main path measure, and the area plays exactly as before.
- `longestQuietStretch`, `meetsFullDangerBar` and `meetsRampDangerBar` stay until #136 removes them.
- Safe starts sit closer to predator loops than before (sight not counted), and the search covers the whole area. Two fairness files' clearance pins moved; no fairness check was dropped, and every golden stays byte-identical.
- [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) status points here for the amended parts.

Follow-ups:

- #132, #133, #134 and #135 each move their own area's layout test to `meetsWholeWaterDangerBar` or `meetsWholeWaterRampBar`. If a spot then has no fair start, that issue stops and asks the owner.
- #136 removes the old bar functions once all four have merged.
- The owner confirms the provisional parts (PRD open questions 343 to 353) on the PR.
