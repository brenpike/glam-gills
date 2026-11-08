# HANDOFF — Open lake 2 Area 13: its own 16 treasures (issue #215)

> Source of truth: [issue #215](https://github.com/brenpike/glam-gills/issues/215) and the PRD rows named below. This handoff records what shipped, the decisions behind it, the learnings, and what a later strain must do. It does not repeat the PRD: read PRD open questions 745 to 754, F15, B3 and B4 there, and the tests named below.

## What this delivers

Issue #215 (0.70.0, one PR, branch `feature/215-area-13-treasures`) gives Area 13 (`open-lake-2`) 16 treasures of its own, `OPEN_LAKE_2_TREASURES` in `src/logic/catalogue.ts`. They are hidden on its 22 existing spots and 18 slots. Commits on the branch: `git log --oneline main..HEAD`.

- The Little mud turtle (Epic) is Area 13's special treasure.
- Two new Dream colours: Pitch black (Rare, solid) and Trench shine (Legendary, sheen).
- The Mini submarine is a big Back item.
- Icons, tank art and worn looks for all of them, the README bullet, and the 0.70.0 CHANGELOG section.
- PRD rows (open questions 745 to 754), the art guide and ADR 0040.

## Owner decisions (2026-11-07)

All recommendations were taken (Q1 to Q9; see PRD open questions 745 to 753). Named defaults ND-1 to ND-11 are posted on #215: <https://github.com/brenpike/glam-gills/issues/215#issuecomment-6715642589>.

## Learnings

- **Dream colour room.** The near-black value space was full under F15. Owner rule Q2 / ND-10 sets a same-kind 1.05:1 greyscale floor. It is held once by `greyscaleFloorApplies` in `src/art/dreamSeparation.ts`, and every existing per-colour separation test now calls it. Pitch black's body moved from #1a1210 to #1a1310 so the normal reddish check passes, so there is no per-colour exception. Trench shine against Olive at 1.02:1 is the one pair under the floor (sheen against solid, which is allowed, and pinned).
- **Test cost.** `wearableArt.test.ts` takes about 18 minutes alone; `axolotlRigStripe` 3 min 40 s; `cardCopyFit` 155 s; `tankUi` 77 s; `stylerUi` 70 s. The full `npm test` ran 199 files and 26607 tests in about 1138 s on a loaded machine. No timeout was raised and no case was dropped. The new tests live in new files: `src/logic/openLake2Treasures.test.ts`, `src/art/trenchDreamArt.test.ts`, `src/art/trenchWearableArt.test.ts` and `src/art/trenchTreasureArt.test.ts`.
- **Pins that break when a later area appends treasures.**
  - Tail slices such as `slice(-N)` and `at(-1)` in `treasureArt.test.ts`, `lakeTreasureArt.test.ts` and `openLakeTreasures.test.ts`. Area 12's tail pins were made positional (relative to Area 13's first entry).
  - The flat-mode canal swatch leave-out list in `treasureArt.test.ts` must gain each new swatch id.
  - The `PAGED_TRAYS` thresholds in `tankUi.test.ts`.
- **Measured.** Area 13's empty places have a mean of 5.305 and a most of 7 (`EMPTY_SLOTS` in `openLake2Layout.test.ts`). Boot textures: 82, and one copy is 8,075,808 bytes (PRD open question 745).
- **Parallel workers on one tree.** Declare every concurrent sibling scope, or workers report blocked on dirty paths they do not know.

## Merge-second checklist for Area 14

Applies to the Area 14 strain (`area-14-twin-trenches-213`, #213) if it merges after this branch.

- Rebase, and take version 0.71.0.
- Put its CHANGELOG section above `[0.70.0]`.
- Renumber its PRD open questions to follow 754, and update references to them.
- Put its README Area 14 bullet after Area 13's.
- Put its art guide section 12 rows after #215's.
- Update the cross-area test lines. Area 14 is the last area and, until #216, the only area with no own treasures.
- The `OPEN_LAKE_2_SHARED_TREASURES` alias was removed from `src/logic/openLake2Layout.ts`. Area 14 must build its shared set from catalogue exports such as `DEEP_CANAL_4_TREASURES`, never from Area 13's new treasures, and must not reuse Lagoon shine as its special treasure.
- Every new Dream colour for Area 14 or #216 follows the same-kind F15 floor (`greyscaleFloorApplies`).

## Follow-ups

- The CONTEXT.md catch-up (PRD open question 743).
- [Issue #222](https://github.com/brenpike/glam-gills/issues/222): the catalogue counts rule. Done: it merged in #225 before this branch, and this branch's PRD, art guide and README lines follow it.
- [Issue #223](https://github.com/brenpike/glam-gills/issues/223): the boot texture budget.
- Owner checks:
  - Icons read at Small and in the tank.
  - The new Dream colours look right on the axolotl and in greyscale.
  - Deep treasures are readable once a fading light is lit.
  - The Lake buoy net never reads as a ghost net.
  - Trench shine has no rim light, as Crystal shine has none (confirm).

## Pointers

- Issue: #215 (Area 13 treasures); epic #209; #213 (Area 14) and #216 (later strains).
- Code: `src/logic/catalogue.ts`, `src/logic/openLake2Layout.ts`, `src/art/dreamSeparation.ts`, `src/art/drawTreasures.ts`, `src/art/drawWearables.ts`, `src/art/palette.ts`, `src/art/treasurePalette.ts`.
- Tests: `src/logic/openLake2Treasures.test.ts`, `src/logic/openLake2Layout.test.ts`, `src/art/trenchDreamArt.test.ts`, `src/art/trenchWearableArt.test.ts`, `src/art/trenchTreasureArt.test.ts`.
- PRD: `docs/prds/axolotl-mvp.md` (F15, B3, B4, open questions 745 to 754). Art guide: `docs/art-style-guide.md`.
- Previous strain: [area-12-treasures-214.md](area-12-treasures-214.md).
- Owner process rules (no AI attribution, agents never merge) are in [spring-cave-area-7.md](spring-cave-area-7.md).
