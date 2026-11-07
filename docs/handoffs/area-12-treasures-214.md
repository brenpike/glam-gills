# HANDOFF — Open lake Area 12: its own 12 treasures (issue #214)

> Source of truth: [issue #214](https://github.com/brenpike/glam-gills/issues/214) and the PRD rows named below. This handoff records what shipped, the decisions behind it, the learnings, and the merge notes for the sibling strain. It does not repeat the PRD.

## What this delivers

Issue #214 (expect 0.69.0, one PR, branch `feature/214-area-12-treasures`) gives Area 12, the open lake, 12 treasures of its own. Until now it borrowed Area 11's Common and Rare treasures (`sharedTreasures`, issue #211). It is built as data on the area framework.

- Commons (4): Windsock (Decoration, Hanging), Pinwheel (Decoration, Floor), Wave socks (Wearable, Socks, Speed), and the Tule green Paint shell.
- Rares (8): Little pelican (Decoration, Floating; Area 12's special treasure), Twin volcanoes (Decoration, Floor), Little sailboat (Decoration, Floating), Cloud scarf (Wearable, Neck, Treasure sense), Pelican swim ring, Surfboard (a big Back item), Pelican slippers, and the Obsidian Paint shell.
- Two new solid Dream colours: Tule green (#043d00, a deep reed green) and Obsidian (#1f2925, green-black volcanic glass), each in its own Paint shell. That makes 33 Dream colours.
- The catalogue is now 163 treasures: 64 Decorations, 66 Wearables and 33 Paint shells.
- Icons, tank art and worn looks for all of them, and the cross-area treasure tests rewritten as general rules.
- PRD rows 736 to 744 (provisional numbers; see Merge notes), the art guide, README and CHANGELOG.

## Owner decisions (2026-11-07, Q1 to Q11)

Q1 to Q9 took the recommendations.

- **Q1** B3 exception: a depth-banded area whose deepest band is band 2 has no Epic or Legendary spot, so it adds at least 2 solid Dream colours instead of one Legendary patterned or sheen colour.
- **Q2** 12 treasures.
- **Q3** The Little pelican is Area 12's special treasure.
- **Q4** Keep 14 spots.
- **Q5** No sharing: Area 12 hides only its own treasures.
- **Q6** Keep every Dream check.
- **Q7** PRD line 957: change the two treasure sentences only.
- **Q8** CONTEXT.md follow-up (see below), not in this PR.
- **Q9** Deep Tule green.
- **Q10** (2026-11-07) Amend ADR 0040 so it covers the Surfboard's opt-in set. Done in this PR.
- **Q11** (2026-11-07) Answer A: fix the stale counts in this remediation, and file follow-up issue #222.

## Named defaults (ND-1 to ND-10)

Posted on #214: <https://github.com/brenpike/glam-gills/issues/214#issuecomment-6701679703>.

- ND-2 was amended to Tule green #043d00 and Obsidian #1f2925 (the colours that fit the value space; see Learnings).
- ND-9: Area 12 needed 60 textures (36 icons at 3 sizes, 12 silhouettes, 2 swatches, 5 tank sprites and 5 glows), against the estimate of about 55.
- ND-10 is the B3 exception (open question 737).

## Learnings

- **The Dream colour value space is full.** Every gap is taken except a sliver near black. The mid gap 0.3099 to 0.3104 is blocked by the cheek-heart fill #ff5c9a (luminance 0.3126). #215 and #216 will need a rule change before they can add solid Dream colours.
- **Slow catalogue-scaling sweeps were made cheaper or split.** The `stylerUi` matrix is split per canvas, the `treasureChest` harsh-word sweep is one pass, and the `tankUi` helpers are shared. Each new catalogue entry multiplies these sweeps, so keep them split.
- **Golden tests time out at 5000 ms under heavy machine load.** Rerun them with `--no-file-parallelism`.
- **`wearableArt.test.ts` takes 13 to 21 minutes on a loaded machine.** Run it alone, and do not read a slow run as a hang.
- **Counts copied by hand went stale.** Three review findings in this PR came from counts copied by hand. Current-state text now names its source instead: `AREAS`, `TANK_DECORATION_SHAPES`, `decorationMotion`, `MAX_DREAM_OPTIONS`, `MAX_OUTFIT_CHOICES`, `src/logic/catalogue.test.ts`, `treasureChest.test.ts`, `chestFilterUi.test.ts` and `stylerUi.test.ts`. Dated records keep their counts.
- **One flaky timeout, not this branch.** During review iteration 3, `src/logic/deepCanalFairness.test.ts` ("gives the same swim-away answer with the early stop as the full rollout ...") timed out once at 5000 ms under heavy load in a serial full run. This branch does not change it, and it passed when run alone. Rerun it alone with `npx vitest run src/logic/deepCanalFairness.test.ts`, and never raise its timeout.
- **CONTEXT.md follow-up.** After both open lake strains merge: update the Dream colour count to 33, add the B3 exception, and add entries for Tule green, Obsidian and Little pelican.

## Merge notes for the sibling strain `area-13-trench-212`

- The cross-area tests are now general rules, so they apply to Area 13 with no edit. Two need Area 13's data:
  - `src/logic/placement.test.ts`, "no Legendary find iff no Legendary spot": it fails if Area 13 has Legendary spots and no Legendary treasure.
  - `src/logic/cardCopyFit.test.ts`, the special-treasure list (about lines 966 to 979): it needs Area 13's special treasure.
- PRD rows 736 to 744 are provisional. The strain that merges second renumbers its rows from main's last number plus one, renumbers every reference, and posts a mapping line on its issue.
- CHANGELOG and version: the strain that merges second re-derives its version from main and keeps its section directly under `## [Unreleased]`.
- Merge result: `area-13-trench-212` merged first (#221, 0.68.0, PRD rows 726 to 735), so this branch took 0.69.0 and PRD rows 736 to 744.
- C11's Area group and Filter pages are count-free, so a new area's chip needs no C11 edit. With Area 13, `src/logic/chestFilterUi.test.ts` pins 7 and 6 pages at 460 x 320 and 320 x 440; a later area's chip can add an Area row and change those, so re-measure them there, not in the PRD. Keep the count-free wording over any "Area 1 to Area 13" text.
- The art guide's 7f Art and Motion rows and its section 8 and 12 tray and Dream tab rows no longer list or count Decorations, so later Decorations need no edit there. The Dream tab rows' 34 options and 17 pages follow `MAX_DREAM_OPTIONS` and `src/logic/stylerUi.test.ts`.
- The B3 test in `src/logic/areas.test.ts` asserts the shallow-area exception (solid Common or Rare Paint shells only) and fails if no area takes it. Area 13 is in band 3, so it is not under the exception; issue #215 adds the open lake's first Legendary sheen.

## Follow-ups and recorded decisions

- Follow-up: [issue #222](https://github.com/brenpike/glam-gills/issues/222), an AGENTS.md rule that living docs cite the code or test for a count instead of copying it.
- Follow-up: the CONTEXT.md catch-up (PRD open question 743; see Learnings).
- Decision: dated records keep the counts of their time by design and are not stale. These are the Testing Decisions "With Area N" entries, the open-question rows and the art guide "Area N UI fits" rows.
- Fixed in this PR, so no longer open: C11's "Area 1 to Area 11" and "eleven chips"; the Tuning "Treasures" canal line; art guide section 8's "up to 25 options" and "Forty-nine Decorations ship"; and ADR 0040 (amended by Q10).

## Pointers

- Issue: #214 (Area 12 treasures); #211 (Area 12 itself, epic #209); #215 and #216 (later strains that hit the Dream colour limit).
- Code: `src/logic/catalogue.ts`, `src/logic/openLakeLayout.ts`, `src/logic/openLakeTreasures.test.ts`, `src/art/drawTreasures.ts`, `src/art/drawWearables.ts`, `src/art/palette.ts`, `src/art/treasurePalette.ts`.
- PRD: `docs/prds/axolotl-mvp.md` (B3, B6, H6, C11, open questions 736 to 744). Art guide: `docs/art-style-guide.md`.
- Owner process rules (no AI attribution, agents never merge) are in [spring-cave-area-7.md](spring-cave-area-7.md).
