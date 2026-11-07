# HANDOFF — Open lake Area 12: its own 12 treasures (issue #214)

> Source of truth: [issue #214](https://github.com/brenpike/glam-gills/issues/214) and the PRD rows named below. This handoff records what shipped, the decisions behind it, the learnings, and the merge result. It does not repeat the PRD.

## What this delivers

Issue #214 (0.69.0, one PR, branch `feature/214-area-12-treasures`) gives Area 12, the open lake, 12 treasures of its own. Until now it borrowed Area 11's Common and Rare treasures (`sharedTreasures`, issue #211). It is built as data on the area framework.

- Commons (4): Windsock (Decoration, Hanging), Pinwheel (Decoration, Floor), Wave socks (Wearable, Socks, Speed), and the Tule green Paint shell.
- Rares (8): Little pelican (Decoration, Floating; Area 12's special treasure), Twin volcanoes (Decoration, Floor), Little sailboat (Decoration, Floating), Cloud scarf (Wearable, Neck, Treasure sense), Pelican swim ring, Surfboard (a big Back item), Pelican slippers, and the Obsidian Paint shell.
- Two new solid Dream colours: Tule green (#043d00, a deep reed green) and Obsidian (#1f2925, green-black volcanic glass), each in its own Paint shell. That makes 33 Dream colours.
- The catalogue is now 163 treasures: 64 Decorations, 66 Wearables and 33 Paint shells.
- Icons, tank art and worn looks for all of them, and the cross-area treasure tests rewritten as general rules.
- PRD rows 736 to 744, the art guide, README and CHANGELOG.

## Owner decisions (2026-11-07, Q1 to Q15)

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
- **Q12** (2026-11-07) Answer A: README line 9 is count-free, and the missing Area 13 README bullet is tracked on epic #209.
- **Q13** (2026-11-07) Answer A: record the boot memory estimate of Area 12's 60 textures in PRD open question 736 and ND-9, add an owner check of boot memory on the owner's devices, and track a texture memory budget with a check in follow-up [issue #223](https://github.com/brenpike/glam-gills/issues/223). No budget or automated memory check in this PR.
- **Q14** (2026-11-07) Answer A: keep the full Decoration tray sweep in `src/logic/tankUi.test.ts` unchanged (see Follow-ups and recorded decisions).
- **Q15** (2026-11-07) Answer A: PRD open question 736 states the boot texture estimate once, with what it counts and the copies Phaser 3.90 keeps; ND-9 gives the short figures and points to it; the README's area map and Collection Book lines name examples (see Follow-ups and recorded decisions).

## Named defaults (ND-1 to ND-10)

Posted on #214: <https://github.com/brenpike/glam-gills/issues/214#issuecomment-6701679703>.

- ND-2 was amended to Tule green #043d00 and Obsidian #1f2925 (the colours that fit the value space; see Learnings).
- ND-9: Area 12 needed 60 textures (36 icons at 3 sizes, 12 silhouettes, 2 swatches, 5 tank sprites and 5 glows), against the estimate of about 55, all baked at boot. At bake scale 3, one copy of their pixels is 5,489,856 bytes (about 5.2 MiB); Phaser 3.90 holds 2 copies with the Canvas renderer (about 10.5 MiB) and 3 with WebGL (about 15.7 MiB). PRD open question 736 gives the method and what the estimate counts. The owner is to check boot memory on their devices, an iPhone with Safari included (Q13). The memory budget is follow-up #223.
- ND-10 is the B3 exception (open question 737).

## Learnings

- **The Dream colour value space is full.** Every gap is taken except a sliver near black. The mid gap 0.3099 to 0.3104 is blocked by the cheek-heart fill #ff5c9a (luminance 0.3126). #215 and #216 will need a rule change before they can add solid Dream colours.
- **Slow catalogue-scaling sweeps were made cheaper or split.** The `stylerUi` matrix is split per canvas, the `treasureChest` harsh-word sweep is one pass, and the `tankUi` helpers are shared. Each new catalogue entry multiplies these sweeps, so keep them split.
- **Golden tests time out at 5000 ms under heavy machine load.** Rerun them with `--no-file-parallelism`.
- **`wearableArt.test.ts` takes 13 to 21 minutes on a loaded machine.** Run it alone, and do not read a slow run as a hang.
- **Counts copied by hand went stale.** Three review findings in this PR came from counts copied by hand. Current-state text now names its source instead: `AREAS`, `TANK_DECORATION_SHAPES`, `decorationMotion`, `MAX_DREAM_OPTIONS`, `MAX_OUTFIT_CHOICES`, `src/logic/catalogue.test.ts`, `treasureChest.test.ts`, `chestFilterUi.test.ts` and `stylerUi.test.ts`. Dated records keep their counts.
- **Texture memory counts copies, not just pixels.** For each texture `bake` makes, Phaser 3.90 keeps the canvas and a same-size `ImageData`, and WebGL adds a GPU copy, so a texture holds 2 (Canvas renderer) or 3 (WebGL) times its width x height x 4 bytes. State what a memory figure counts, once, in the PRD, as open question 736 does. Three review findings in this PR came from the hand-written boot texture figure: its count, its absence, and its copies.
- **State a rule once and name it elsewhere, with one test predicate.** A rule restated in several docs drifts. Keep the rule in one place, refer to it by name elsewhere, and pin it with a single test predicate (for the B3 exception, `takesBand2Exception`).
- **One flaky timeout, not this branch.** During review iteration 3, `src/logic/deepCanalFairness.test.ts` ("gives the same swim-away answer with the early stop as the full rollout ...") timed out once at 5000 ms under heavy load in a serial full run. This branch does not change it, and it passed when run alone. Rerun it alone with `npx vitest run src/logic/deepCanalFairness.test.ts`, and never raise its timeout.
- **CONTEXT.md follow-up.** After both open lake strains merge: update the Dream colour count to 33, add the B3 exception, and add entries for Tule green, Obsidian and Little pelican.

## Merge result

`area-13-trench-212` merged first (#221, 0.68.0, PRD rows 726 to 735). This branch is 0.69.0 with PRD rows 736 to 744. Notes still useful to later areas (#215, #216):

- The cross-area tests are general rules, so they apply to a new area with no edit. Two need the new area's data:
  - `src/logic/placement.test.ts`, "no Legendary find iff no Legendary spot": it fails if the area has Legendary spots and no Legendary treasure.
  - `src/logic/cardCopyFit.test.ts`, the special-treasure list (about lines 966 to 979): it needs the new area's special treasure.
- C11's Area group and Filter pages are count-free, so a new area's chip needs no C11 edit. With Area 13, `src/logic/chestFilterUi.test.ts` pins 7 and 6 pages at 460 x 320 and 320 x 440; a later area's chip can add an Area row and change those, so re-measure them there, not in the PRD. Keep the count-free wording over any "Area 1 to Area 13" text.
- The art guide's 7f Art and Motion rows and its section 8 and 12 tray and Dream tab rows no longer list or count Decorations, so later Decorations need no edit there. The Dream tab rows' 34 options and 17 pages follow `MAX_DREAM_OPTIONS` and `src/logic/stylerUi.test.ts`.
- The B3 test in `src/logic/areas.test.ts` asserts the Band-2 exception (B3): an area for which `takesBand2Exception` holds adds solid Common or Rare Paint shells only. It fails if no area takes the exception. Area 13 is in band 3, so it is not under the exception; issue #215 adds the open lake's first Legendary sheen.

## Follow-ups and recorded decisions

- Follow-up: [issue #222](https://github.com/brenpike/glam-gills/issues/222), an AGENTS.md rule that living docs cite the code or test for a count instead of copying it.
- Follow-up: the missing Area 13 README bullet, tracked on epic #209 (Q12).
- Follow-up: the CONTEXT.md catch-up (PRD open question 743; see Learnings).
- Follow-up: [issue #223](https://github.com/brenpike/glam-gills/issues/223), a texture memory budget for boot-baked textures with a check (Q13). The boot bake of every treasure texture is inherited from main; this PR adds Area 12's 60, whose memory estimate is in PRD open question 736. Until #223 lands, the owner's device check is the guard. A review finding that asks for a memory budget, an automated memory check, or a memory figure computed in code in this PR repeats this decision, and so does one that asks to drop the recorded estimate.
- Decision (Q14): the Decoration tray sweep in `src/logic/tankUi.test.ts` stays whole: every max tray count, every tray count up to it, and every page, on each canvas. It grows with the catalogue, so each new Decoration makes the test run longer; the owner accepts that cost. It affects test run time only, never the game. A review finding that asks to sample its cases, drop cases, or add a run-time budget for it repeats this decision.
- Decision (Q15, 2026-11-07): README's area map line and Collection Book line name examples of the map's habitat tabs and of the fact cards, not every one, and give no total. Each later area or card then leaves them true, and they carry no Area 13 content (Q12). A review finding that asks to list every tab or card again, or to add a total, repeats this decision.
- Decision: dated records keep the counts of their time by design and are not stale. These are the Testing Decisions "With Area N" entries, the open-question rows and the art guide "Area N UI fits" rows.
- Fixed in this PR, so no longer open: C11's "Area 1 to Area 11" and "eleven chips"; the Tuning "Treasures" canal line; art guide section 8's "up to 25 options" and "Forty-nine Decorations ship"; and ADR 0040 (amended by Q10).

## Pointers

- Issue: #214 (Area 12 treasures); #211 (Area 12 itself, epic #209); #215 and #216 (later strains that hit the Dream colour limit).
- Code: `src/logic/catalogue.ts`, `src/logic/openLakeLayout.ts`, `src/logic/openLakeTreasures.test.ts`, `src/art/drawTreasures.ts`, `src/art/drawWearables.ts`, `src/art/palette.ts`, `src/art/treasurePalette.ts`.
- PRD: `docs/prds/axolotl-mvp.md` (B3, B6, H6, C11, open questions 736 to 744). Art guide: `docs/art-style-guide.md`.
- Owner process rules (no AI attribution, agents never merge) are in [spring-cave-area-7.md](spring-cave-area-7.md).
