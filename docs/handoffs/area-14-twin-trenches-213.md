# HANDOFF — Area 14, the twin trenches (#213)

> Learnings and a rebase checklist from the strain that built Area 14 (issue #213, expect 0.70.0). Read this before rebasing or merging that branch.

## What this delivers

Area 14 `open-lake-3`, the last open lake area: twin trenches, two pitch-black pits either side of a shallow ridge, in the late afternoon. The axolotl starts on the ridge, and the exit is on the east (far) pit floor, in the dark. It adds sharp litter (a dented can or a bottle with a chipped neck lying still on the pit floors, costing a leg on touch), drifting islands (tule reed mats that drift along the surface and take a pelican's scoop away), the "Litter in the water" fact card, and the `open-lake-late` look.

Files involved:

- `src/logic/openLake3Layout.ts`: the Area 14 layout.
- `src/logic/litter.ts` and `src/logic/hazards.ts`: the sharp litter rules (`SHARP_LITTER`, `litterSpawn`).
- `src/logic/driftingIslands.ts`: the drift and the shelter rule (`pelicanBirdSheltered`, `shelteredScoopHit`). `src/logic/pelicanLine.ts` is unchanged.
- `src/art/drawLitter.ts`, `src/art/drawDriftingIsland.ts`, and the pit shafts in `src/art/drawLake.ts`.
- `src/scenes/LitterView.ts`, `src/scenes/DriftingIslandView.ts`, and the sheltered-bird pose in `src/scenes/PelicanLineView.ts`.
- [ADR 0046](../adr/0046-twin-trenches-sharp-litter-and-drifting-islands.md).

## Owner answers and named defaults

- The owner took the planner's recommendations for Q1 to Q5 on 2026-11-07, and amended Q2 the same day (the litter spacing, below).
- The owner approved the "Litter in the water" card body word for word (Q5). Its four source checks stay open (open question 749).
- Named defaults ND-1 to ND-12 are recorded on #213. Open questions 760 and 761 are the build's layout calls, and 762 is the builder's guess, not the owner's.

PRD open questions added by this strain:

| PRD line | Open question | Item |
|---|---|---|
| 2176 | 745 | Q1, ND-9 |
| 2177 | 746 | Q2 (as amended), ND-4 |
| 2178 | 747 | Q3, ND-5, ND-6 |
| 2179 | 748 | Q4, ND-3, ND-7, ND-8 |
| 2180 | 749 | Q5 |
| 2181 | 750 | ND-1 |
| 2182 | 751 | ND-2 |
| 2183 | 752 | ND-3 |
| 2184 | 753 | ND-4 |
| 2185 | 754 | ND-5 |
| 2186 | 755 | ND-6, ND-12 |
| 2187 | 756 | ND-7 |
| 2188 | 757 | ND-8 |
| 2189 | 758 | ND-10 |
| 2190 | 759 | ND-11 |
| 2191 | 760 | Layout call: pelican line 2 and island 2 |
| 2192 | 761 | Layout call: the east terrace step and ledge |
| 2193 | 762 | Builder's guess: the island bob |
| 2194 | 763 | Records changed |

If this strain merges second, renumber them after the sibling's open questions.

## Learnings

- Q2's first rule, litter 60 to 100 px from a Legendary spot, could not be met under the shared hiding rules: a pit Legendary sits within the mud turtle's snap reach and at least 60 px from any route turn point, and with litter kept 64 px clear of the turtle's crawl path the closest spacing that fits is about 105 to 111 px. The owner amended it to 64 to 115 px. As built, each piece is about 112 px from its Legendary.
- The east pit was redesigned. With pelican line 2 over the east pit and the main path crossing it in band 2, the one-leg run had no passing start. Line 2 and island 2 moved over the east ledge and shallows (x 3080 to 4280), and the main path now crosses the east pit low, in band 3 at y 800 (open question 760). The east terrace step was narrowed and the east ledge widened to fit the ledge's Rare spots, so the pits are not mirror images (open question 761).
- The one-leg run passes only for start times 1.85 to 2.00 s (pinned 1.93 s, 82.92 s). Every scoop is timed as if no island sheltered it, so the islands cannot widen the window. A shared tuning change re-measures it and never loosens it (ADR 0046, recorded residuals).
- Some test files time out under full-suite parallel load but pass alone, as in the Area 13 handoff. Run a timed-out file alone with `npx vitest run <file>` before treating it as a failure.
- The pit shafts paint across the whole chunk width in bands 1 and 2, on a world-x grid, because the painter has no layout knowledge. The rock, drawn after them, hides them over the shallows floors and the ridge.
- The island bob values (1.5 px over 5 s, and the phase step in `DriftingIslandView.ts`) are provisional art, not tuned on a device (open question 762).
- The Melanoid axolotl over the island's trailing roots is about 1.24:1. The roots are under the contrast floor, a recorded exception (art guide 7w). It is flagged for the owner's render check.
- The litter and island sprites were built and tested with no canvas, so neither has been rendered. The pit shafts are checked only as recorded draw calls. The art guide's render check row lists what the owner should look at.

## Merge-second rebase checklist

The sibling strain area-13-treasures-215 merges first. Then on this branch:

- PRD open questions: renumber 745 to 763 after the sibling's rows. Update every reference to them in the PRD (C13, N2's "Area 14 as built" and its danger pass, N3's sharp litter and drifting islands, the Tuning values), in ADR 0046, and in the PR body. Post a one-line old-to-new mapping on #213.
- Version: re-derive to the next minor above the sibling's release, in `package.json`, both root version fields of `package-lock.json`, and the README's version line.
- CHANGELOG: put this strain's section above the sibling's, with the re-derived version.
- README: keep the sibling's Area 13 bullet before the Area 14 bullet.
- Cross-area test lines (`areas.test.ts`, `collectionBook.test.ts`, `cardCopyFit.test.ts`, `session.test.ts`, `refuge.test.ts`, `rescue.test.ts`, `mobileSnacks.test.ts`, `openLake2Area.test.ts`, `areaMap.test.ts`, `areaText.test.ts`, `zone.test.ts`, `glowPlants.test.ts`): make each true for both strains' changes.
- `src/logic/tuning.ts` and `src/logic/areas.ts`: keep both sides.
- Do not touch the sibling's README Area 13 bullet, PRD B3 and B4, the Area 13 hiding-spots tuning row, its open-question rows, or its art guide treasure rows.
