# HANDOFF — Area 13, the open lake trench (#212)

> Learnings and a rebase checklist from the strain that built Area 13 (issue #212, expect 0.68.0). Read this before rebasing or merging that branch.

## What this delivers

Area 13 `open-lake-2`, the second open lake area: a stepped dive down to the first pitch-black bottom. It adds the Valley of Mexico mud turtle (an ambusher that creeps, warns, then snaps), fading lights (touch one to light the dark; it slowly fades), the "Meet the mud turtle" fact card, and Area 13's hiding rules.

Files involved:

- `src/logic/openLake2Layout.ts`: the Area 13 layout.
- `src/logic/fadingLights.ts`: the fading light rules.
- `MUD_TURTLE` and `MUD_TURTLE_SPECIES`: the predator and its species card.
- `src/logic/hiding.ts`: Area 13 hides Area 11's treasure for now (ND-29).
- The mud turtle and fading light views, and `DarkCaveView`, which now takes a dark colour.

## Owner answers and named defaults

- The owner took the planner's recommendations for Q1 to Q4.
- Named defaults ND-1, ND-14, ND-15, ND-16, ND-25, ND-26, ND-27, ND-28 and ND-29 are recorded on #212.
- Comments on #212: issuecomment-6701488940 and issuecomment-6702225606.

PRD open questions added by this strain:

| PRD line | Item |
|---|---|
| 726 | Q1 |
| 727 | Q2 |
| 728 | Q3 |
| 729 | Q4 |
| 730 | ND-1 |
| 731 | ND-14 |
| 732 | ND-15 |
| 733 | ND-16 |
| 734 | ND-26 |
| 735 | ND-29 |

If this strain merges second, renumber them after the sibling's open questions.

## Learnings

- `TRIP_TREASURES_BY_AREA` keys must exist in `AREAS` (`placement.test.ts`), so a tuning entry is red until the area is registered.
- `fixedStrikeSpot` plus `stillCooldown` give a heron-style ambusher, and `tunedSpecies` refuses a chase. The danger bar needs every chaser at 112.5 to 150 px/s.
- Never name amphibians as prey on a card, because axolotls are amphibians.
- The `OPEN_LAKE_CARP` strike is 135, not 120.
- Reed patches span the surface to the floor, so a bed on a step gives cormorant sight cover above it.
- The exit gate half-width is 65 and must clear terrace rock (`areaExitArt` never draws a gate into rock). The exit moved from (2660, 990) to (2650, 940).
- Mock canvases in tests that bake lake textures (`pelicanArt`, `windArt`, `trenchTextures`) need a `createRadialGradient` stub when a painter adds a gradient.
- The one-leg run passes only for start times 3.05 to 3.20 s (pinned 3.15, 82.13 s). A shared tuning change re-measures it and never loosens it.
- `hiding.ts` `isDeep`, `meetsRarity` and `spotMatchesLabels` are test-only readers.
- Slow files time out under full-suite parallel load but pass alone: axolotlRig, axolotlRigStripe, wearableArt, chinampa2Layout, deepCanalFairness, deepCanalGolden, predators, springCave2Fairness, springCave2Golden, springCaveGolden, springCaveLayout, stylerUi.
- The plan had scope gaps several times: `TripSnapshot` in `tripEvents.ts`, `windArt.test.ts`, and the cross-area pins in `mobileSnacks`, `rescue` and `chestFilterUi`.

## Merge-second rebase checklist

- `areas.test.ts` lines ~1254 to 1257 become `[OPEN_LAKE_2_AREA]` only.
- `chestFilter.test.ts`: Area 13 only.
- `session.test.ts`: lines 623 to 661 are the sibling's; lines 297 and 1757 plus the `OPEN_LAKE_2_ID` const are ours.
- `openLakeLayout.test.ts`: lines 863, 873 and 917 are ours.
- `cardCopyFit.test.ts` special names: keep both sides.
- PRD:
  - H6 (line ~613) is one long line that will likely conflict.
  - Renumber the open questions.
  - The Area 13 paragraph sits after the Area 12 paragraph.
- Version: 0.69.0 if #214 merged as 0.68.0. Keep the CHANGELOG order.
- Art guide section 12: keep both sides.
- B4 still lacks Area 13's slot count (for #215).
