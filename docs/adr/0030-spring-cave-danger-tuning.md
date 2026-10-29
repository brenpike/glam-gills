# ADR 0030: Spring cave danger tuning

- Status: Accepted
- Date: 2026-10-28
- Related: [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the moving hazard type and the strike-only placement rule), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the whole-water test and the relaxed fairness harness), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (the crayfish's level strike, the stalactite drip and the geyser vent, amended in part here), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (Area 7, retuned here)

This ADR records the retune of the spring cave's Areas 6 and 7 after the owner's first playtest (2026-10-28), which found both areas far too easy. Its values are provisional, recorded in PRD open question 542, and the owner can override any of them on the implementing PR. It amends ADR 0028 in part: the crayfish's pinch, and the stalactite drip's and geyser vent's values.

## Context

The owner played Areas 6 and 7 and found them far too easy. Four causes were found in the repo:

1. The crayfish's pinch was level (`levelStrike`, ADR 0028). It reached only 26 px, its hit reach, above the floor lane, so hovering just over a crayfish was safe.
2. Area 6's and Area 7's common carp hit only within 38 px of the carp's centre, against a 64 px body, and swept at 220 and 225 px/s. A sweep connected only when the bodies nearly fully overlapped, and it was easy to outswim.
3. The stalactite drips (10 px wide, out 1.4 s of every 4 s, about 170 px long) and the geyser columns (16 px wide, out 1.8 s of every 5.2 s, 140 px long) were thin, brief and short. Area 6's geyser and both of Area 7's stood off the main path.
4. Area 6 had 14 moving threats for its 15 screens, placed to keep off its main path.

The shared rules stay as they are: the 0.8 s warning floor (A2), one predator warning or striking at a time (A1), each sweep farther than every predator's strike from its loop, the risk ladder (B10), the whole-water danger test and the fairness proofs. A layout that could not meet them would stop the retune; none had to.

## Decision

**The crayfish's pinch is aimed.** `CRAYFISH_SPECIES` keeps `warnOnRoute` and drops `levelStrike`. Its pinch follows the aim locked at the end of the warning, straight at where the axolotl is when the claws close, up off the floor included, so an axolotl hovering over a crayfish within its 90 px reach is pinched. With `warnOnRoute` it walks back onto its stretch after a pinch before it warns again. `levelStrike` stays a shared rule option with its tests; no species uses it now. The dodge is to swim straight away when the claws open. `src/logic/crayfish.test.ts` measures it: a four-leg axolotl swimming straight away is never pinched from any start in reach, and a one-leg axolotl is never pinched from 28 px or more and is pinched from some starts nearer. Its other values are unchanged.

**The stalactite drip and the geyser vent are wider and stay out longer.** Their warnings and cycle lengths are unchanged:

- `STALACTITE_DRIP`: half width 8 (a 16 px stream), rest 1.0 s, hold 1.2 s, out 2.0 s of every 4 s, 216 px by default.
- `GEYSER_VENT`: half width 12 (a 24 px column, as wide as the chimney's mouth), rest 1.4 s, hold 1.6 s, out 2.6 s of every 5.2 s, 240 px by default.
- Their art is longer: `DRIP_STREAM_LENGTH` 280 px, so an area may set a stream of up to 250 px, and `GEYSER_COLUMN_LENGTH` 320 px, so an area may set a column of up to 304 px. The drips are 16 px across, the touch width.

**The carp hit when they touch you and sweep faster.** Both areas' carp hit within 50 px, the carp's 32 px half length plus the Medium axolotl's 18 px half height, and touch within 53 px. Their sweeps are faster and longer than the axolotl swims:

- Area 6 (`SPRING_CAVE_CARP`): a 0.85 s warning, 144 px at 320 px/s for 0.45 s, a 2.0 s cooldown, a 45 px/s patrol and a 130 px/s chase.
- Area 7 (`SPRING_CAVE_2_CARP`), one ladder step above: a 0.8 s warning (the floor), 153 px at 340 px/s for 0.45 s, a 1.8 s cooldown, a 50 px/s patrol and a 135 px/s chase.
- Both keep `CARP_CHASE`'s sight of 220 px and leash of 120 px, and their lunge ranges of 130 and 135 px.

**Area 6 gets more threats on its main path.** It has 17 moving threats, up from 14:

- `carp-6` patrols the middle row with the main path through its loop, and `carp-4` moved up off the geysers, so its loop crosses the path too.
- `stalactite-5` hangs from a new rock ledge over `carp-0`, just over the top-row path.
- `geyser-2` joins `geyser-1`. Both columns burst across the bottom-row path.
- Stalactites 1, 2 and 4 drip 216 px, and stalactite 3 as deep as the strike rule over `carp-1` allows, so the first three cross the main path.
- The offsets let a one-leg swim of the main path pass them all. The whole-water test needs `carp-1` to `carp-5`.

**Area 7 gets deeper streams and a geyser on its path.** It keeps its 17 moving threats:

- Each stalactite drips as deep as the shared rules allow, up to 250 px.
- `geyser-1` moved across the bottom-row path at x 600. `crayfish-0`'s stretch was shortened to x 360 to 490 and `carp-0`'s loop cut at its bottom right, so the column stays farther than their strikes.
- `stalactite-2` moved east of x 1140, so the Common spot at x 1056 keeps its band.
- `carp-3` moved west, so `stalactite-4` drips its full stream.
- Its narrowest main-path gap is 36 px, the safe passing width.

The reaches that place things are unchanged: the crayfish's 90 px, the carp's lunge range and its leash. So treasure bands, safe starts and snack keep-outs move only where a hazard sweep grew. Each area's fairness and golden tests were measured again.

## Alternatives considered

| Option | Why not |
|---|---|
| Q1: keep the level pinch and give the crayfish a bigger hit reach | A level pinch with a bigger reach still never reaches above that band, so the dodge stays swimming up a little. A bigger reach also breaks the shared hit reach that matches a Medium axolotl (F4). |
| Q1: keep the level pinch and let the crayfish climb off the floor | It would be a new movement rule, not a tuning, and the crayfish would leave the bed it is drawn walking on. |
| Q2: only speed up the carp's sweep | At a 38 px hit reach the sweep still connects only when the bodies nearly fully overlap, so a faster miss is still a miss. |
| Q2: a longer lunge range or leash for the carp | Lunge range and leash place the treasure bands and safe starts, so every spot and start would move. A faster, longer sweep from the same range makes the carp harder without moving them. |
| Q3: more stalactites and geysers at the old values | Thin, brief drips and columns stay easy to pass, and each new spawn must clear every strike. Wider drips and columns that stay out longer make each one count. |
| Q3: a shorter cycle for the drip and the geyser | It changes the warnings players have learned. A longer hold in the same cycle keeps the warnings and the rhythm. |
| Q4: Area 6's threats where they were, retuned only | They were placed to avoid the main path, so retuning them left the main path quiet. The added threats are on the path. |
| Q4: past 7 carp in Area 6 | The owner's limit is 7 carp in an area. The seventh carp, a fifth stalactite and a second geyser give 17 moving threats within it. |

## Consequences

- Areas 6 and 7 are harder along their main paths, and still pass every shared rule: the warning floor, one striker at a time, the strike-only rule, the risk ladder, the whole-water test and the one-leg proofs.
- A crayfish is no longer safe to hover over. The swim-away dodge has a measured edge: a one-leg axolotl right on a crayfish, nearer than 28 px, may not escape.
- `levelStrike` stays as shared code that no species uses. A later floor or level striker can turn it on.
- The stalactite drip and the geyser vent are retuned for every area that uses them, which today is Areas 6 and 7.
- No save field and no `SAVE_VERSION` bump.

Recorded residuals:

- The crayfish fact card still says "Axolotls stay safe by swimming up and away". Root cause: the card text is the owner's (PRD open question 519) and is outside this retune. Bounded: swimming away still dodges, and swimming up is away when the axolotl is above. Not changed: the owner can reword it.
- The values are not checked in play. Root cause: they are worked out from the owner's playtest and measured in headless tests only. Bounded: every value is provisional and in PRD open question 542. Not changed: the owner plays them on the PR.

Follow-ups:

- The owner plays Areas 6 and 7 on the PR and confirms or retunes the values in PRD open question 542.
