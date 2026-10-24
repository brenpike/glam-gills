# ADR 0022: Danger pass phase 2 seam amendments

- Status: Accepted
- Date: 2026-10-24
- Amends: [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (replaces only its phase 2 seams (ND-14), its "Fixed area data, not seeded" bullet (ND-23), its constraint that all five goldens stay byte-identical, and its Collection Book consequence; every other ADR 0021 rule stays in force)

This ADR records the owner's decisions of 2026-10-24 on issue #121 (Area 2's danger pass), made after the pre-PR local review of #121 and the zoom-out on its findings. The provisional parts are [PRD](../prds/axolotl-mvp.md) open question 302.

## Context

ADR 0021 set the contract for phase 2 of the danger pass: one strain per area, #121 (Area 2), #120 (Area 3), #119 (Area 4) and #118 (Area 5), each adding data to its own area's files. Building Area 2 showed five places where that contract and the code disagree:

- ND-23 says `snacksInCurrent` snacks stay worms or bugs, which reads as exactly that many snacks in the current. In code, `snackAreas` in `src/logic/zone.ts` places `snacksInCurrent` snacks in the first current, then one stripe of the swim bounds per remaining snack. The stripes span the full swim height, so a stripe snack can also start in the current. Area 2 has 5 to 7 snacks in its current on every test seed, and 6 on main's default pond seed.
- ADR 0021 says all five goldens stay byte-identical. That held for phase 1. In phase 2, lowering `snackWorms` and `snackBugs` by the mobile count changes the stripes, so the seeded snacks are drawn again and that area's golden changes.
- ADR 0021 lists each strain's files. #121 needed more: the Collection Book heading (issue #124, folded into #121's PR by the owner), shared tests that held only in one merge order, and Area 2's keys in its golden's projection.
- Shared tests in `zone.test.ts` and `areas.test.ts` pinned that every shipped area has no chase, moving hazards or mobile snacks. Each strain that adds a part to its area breaks those pins for its area, and fixed absence pins for the other areas break whichever strain merges next.
- Living docs (the PRD, CONTEXT.md, the art guide and ADR 0021) said which shipped areas have each part, so every merge had to edit the same sentences.

## Decision

**What `snacksInCurrent` means (amends ND-23).** `snacksInCurrent` is the number of snacks `snackAreas` places inside the first current on purpose. It is a floor, not an exact count: stripe snacks may also start there (5 to 7 in Area 2 on every test seed, 6 on main's default pond seed). Every snack in a current is a worm or a bug, because `mobileSnackClear` keeps tadpole lanes and shrimp boxes out of every current. An area's layout test pins the floor and the kinds, not an exact count. The owner chose this definition on 2026-10-24 over making the stripes skip currents (Alternatives).

**Mobile snacks and the seeded draw (amends ND-23 and the golden constraint).** Mobile snacks add no `rand()` draw, and an area without `mobileSnacks` builds exactly as before. A strain that lowers its area's `snackWorms` and `snackBugs` by the mobile count changes the stripes, so its area's seeded snacks are drawn again. It re-records only its own area's golden, on purpose; every other golden stays byte-identical. Seeded snack ids are session only (`AreaMemory.eatenSnacks` in `src/logic/session.ts` is never saved; `save.test.ts` pins it as a trip-only key), so saves are not affected.

**#121's extra files (amends ND-14's file lists).** By the owner's decision on #124 (2026-10-24), #121 also edits:

- `FACT_CARDS_HEADING` in `src/logic/collectionBook.ts`: the heading reads "Facts: N of M found" (PRD open question 301).
- The merge-order rewrites in `src/logic/zone.test.ts` and `src/logic/areas.test.ts`, so the shared tests hold in any merge order (below).
- Area 2's keys in the `src/logic/pondGolden.test.ts` projection.
- The comment-only `snacksInCurrent` docs in `src/logic/zone.ts` and the canal floor pin in `src/logic/zone.test.ts`.

Merge order: #121 first, then #120, #119 and #118. Each later strain rebases onto main, renumbers its PRD open questions after the last number on main, re-derives its Collection Book pins, and does not edit `collectionBook.ts`.

**Shared tests hold in any merge order (amends ND-14's proofs).** Shared tests check each area against its own data, so they pass whichever strains have merged. Each area pins its own chase, moving hazards and mobile snacks, present or absent, in its own layout test, and its own golden guards its behaviour. No shared test holds a fixed absence pin for an area another strain may change.

**Living docs say no area list.** The PRD, CONTEXT.md, the art style guide and ADR 0021 describe the shared parts without saying which shipped areas have them. Only per-area text (an area's N2 danger-pass paragraph, its rows and its own tests) says what that area has. ADRs before 0021 stay point-in-time records and are not edited.

## Alternatives considered

| Option | Why not |
|---|---|
| Stripes skip currents, so a current holds exactly `snacksInCurrent` snacks | Changes `snackAreas` for every area, so all five goldens move and Area 1 plays differently. The extras are worms or bugs, the same as on main. |
| Keep the old seeded draws, and replace some chosen seeded snacks with mobile ones | Needs a `buildZone` change, which ADR 0021 keeps out of phase 2. Seeded snack ids are session only, so keeping them gains the player nothing. |
| Fixed absence pins for unmerged areas in shared tests | Breaks any merge order but one: the next strain to add a part to its area fails a pin it does not own. |
| Amend ADR 0021 in place only | Loses the record of why the seams changed after ADR 0021 was accepted. An amended rule gets the next numbered ADR, as ADR 0010 did for ADR 0008. |

## Consequences

- An area's current may hold more snacks than its `snacksInCurrent`, and every one of them is a worm or a bug. Layout tests pin the floor and the kinds.
- Each phase 2 strain re-records its own golden when it lowers its seeded snack counts. Saves do not change, and no `SAVE_VERSION` bump is needed.
- The Collection Book heading is "Facts: N of M found". A new card joins the book when some area has it; each strain re-derives the Collection Book pins after rebasing.
- #120, #119 and #118 merge after #121, rebase onto main, and add no shared absence pins.
- Living docs stop naming shipped areas for each part, so later merges do not edit the same sentences.
- [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) status points here for the amended parts.

Recorded residual:

- The `snacksInCurrent` floor. Root cause: `snackAreas` gives each remaining snack a stripe that spans the full swim height, so a stripe can cross a current. Bounded: every extra snack in a current is a worm or a bug, because `mobileSnackClear` keeps mobile snacks out of currents; main already does the same, in every area with a current. Not changed: the fix (stripes skip currents) moves all five goldens and changes Area 1 (Alternatives). Raised by the pre-PR local review as findings `f48617e4e44dbedcb87b14eda4e84622eacdc2578dedba710c5ad92ff7799f43`, `bdefe39d8bf2b4a3159a13577bffd1a385e96bd3ccb857d20809650a0f17a785` and `14309c965cb5d08cae3b7a674ab7f407953733670e5488ae0e6ce38a52d97d09`; the owner's definition above answers them.

Follow-ups:

- #120, #119 and #118 each pin their own area's chase, moving hazards and mobile snacks, present or absent, in their own layout tests, by the shared-test rule above (findings `e2eca23eb687dd5def86969f5495f5b603f25507006e9a90cf1b292025c41249` and `829e90629de77b56281c63c8a642b06c5413171dbe1b800b70d9b939effc47b6`).
- #120 adds Area 3's tilapia tuning to the `src/logic/pond2Golden.test.ts` projection.
- The owner confirms the provisional parts (PRD open question 302) on the PR.
