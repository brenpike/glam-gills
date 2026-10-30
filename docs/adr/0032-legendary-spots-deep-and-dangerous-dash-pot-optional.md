# ADR 0032: Legendary spots are deep and dangerous; Dash pots are optional

- Status: Accepted
- Date: 2026-10-30
- Related: [ADR 0012](0012-save-on-device.md) (the additive rule the Dash pot tip's load rule stays under), [ADR 0014](0014-area-framework.md) (the risk bands and the turn clearance a Legendary spot must meet), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the fairness harness the visit model lives in), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the relaxed fairness proofs a Legendary visit must pass), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (Area 6, which gains an open Legendary spot), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (Area 7, whose grotto widens to hold one), [ADR 0031](0031-sheen-dream-colours-share-the-live-stripe.md) (the Crystal shine and Glowworm Paint shells, which may now hide in those open spots)

This ADR records the owner's decision of 2026-10-30 that a Legendary treasure need not hide in a Dash pot. The owner's rule for Legendaries is that they are the rarest finds, more hidden and/or more dangerous to get. A Dash pot is one way to meet that rule, not the rule itself.

## Context

The owner never asked for every Legendary to be in a Dash pot. The pot-only rule crept in. The PRD's first B6 (2026-10-18) said Legendary treasures need Tail Dash and are in the cave or past the current. Issue #70's risk ladder (built in PR #84, owner decision 2026-10-20) then put every Legendary in a Dash pot. By then the code's rarity rule (`meetsRarity` in `src/logic/hiding.ts`) made a Legendary spot deep and in a container, and the PRD's Legendary risk band read "at most S / 2 pixels, and in a Dash pot".

The rule cost the layouts room. Each Dash pot needs its own spot, deep, within half a threat's strike reach and at least the spot spacing from every other spot. In Area 7 the strip past the steady outflow, between `crayfish-1`'s reach above its floor lane and the current's foot, fit only three pots, so the Legendary pool was exactly its three Legendaries and every trip that picked all three had no choice of spot (B4).

Other rules leaned on the old one. The Dash pot tip (B11) counted a banked Legendary as knowing how to break a pot, because every Legendary had come out of one. The Treasure Chest's unfound Legendary hint (C11) read "Break a Dash pot with Tail Dash!".

## Decision

**A Legendary spot is deep and in the Legendary risk band, in a Dash pot or in an area with a threat.** `meetsRarity` holds a Legendary spot when all three are true:

- It is deep: in a cave or other hollow, or past a current (B6), as an Epic spot is.
- It is in the Legendary risk band (B10, [ADR 0014](0014-area-framework.md)): at most S / 2 from some threat, and 60 px or more from every predator route turn.
- It is in a Dash pot, or the area has at least one threat the risk ladder measures (`riskDistance` is not `Infinity`). The risk rule is always true in an area with no threat, so there a Legendary still needs a Dash pot.

The Epic rule is unchanged: deep, no pot, more than S / 2 and at most S from a threat. Dash pots stay Legendary-only, so a pot always means a Legendary, but a Legendary no longer always means a pot.

**A Legendary visit uses Tail Dash, in a pot or in the open.** The fairness harness's `visitPath` (`src/logic/riskFairness.ts`) dashes on the way in to every Legendary spot: into a pot to break it, and into an open spot to dart in near danger. Tail Dash works anywhere and with any number of legs (A10), so a one-leg player can always make this visit. No fairness check is loosened. The dash is needed: Area 7's open spot passes the one-leg proof only with it.

**Areas 6 and 7 each gain an open Legendary spot.**

- Area 6: an open Legendary spot at (1992,790), past the spring outflow under `carp-5`. The two pots past the outflow move to (1872,790) and (1932,790) to make room. The spot is listed last, so the other spots keep their ids. Area 6 has 6 Legendary spots: 5 Dash pots and 1 open.
- Area 7: the grotto at the back of the pebble room widens from x 3740 to 3800 to x 3680 to 3800, and holds an open Legendary spot at (3700,630), just over `crayfish-2`'s floor lane, within its S / 2 and past the turn clearance from its west end. Area 7 has 4 Legendary spots for its 3 Legendaries: 3 Dash pots and 1 open.
- Areas 1 to 5 are unchanged. Every Legendary spot there is still in a Dash pot.

**The unfound Legendary hint names depth and danger.** `UNFOUND_HINTS.legendary` in `src/logic/treasureChest.ts` reads "Look deep, right next to danger!" in place of "Break a Dash pot with Tail Dash!". Both are 32 characters, so the Treasure Chest's row fit is unchanged.

**The Dash pot tip reads only its own flag.** `knowsDashPots` (`src/logic/dashPotTip.ts`) is true only when the save's `dashPotTipSeen` is true; a banked Legendary no longer counts, because it may have come from an open spot. To keep players who learned pots before the tip from seeing it, the save's load rule (`src/logic/save.ts`) reads a save with no `dashPotTipSeen` field, a save from before #149, as seen when a banked id is a Legendary, since every Legendary then hid in a Dash pot. A field that is present and not exactly true loads as not seen. There is no `SAVE_VERSION` bump: the field keeps its meaning, and a save that lacks it loads with a default under the additive rule of [ADR 0012](0012-save-on-device.md).

## Consequences

- Areas 1 to 5 play exactly as before. Their layouts, pools and golden snapshots do not change.
- Areas 6 and 7 place Legendaries in new spots, so their golden snapshots (`springCaveGolden.test.ts` and `springCave2Golden.test.ts`) were pinned again and the changes checked by hand. Their layout and fairness tests were measured again: every Legendary spot, open ones included, takes a hit when the axolotl waits at it, and passes the one-leg visit with Tail Dash.
- Area 7's Legendary pool is now larger than its Legendaries, as every other rarity's pool is, so its test no longer needs the pool to equal its treasures.
- The grotto art is centred on the cave's rect (`src/scenes/TreasureView.ts`), so in Area 7 it moves 30 px west, to x 3740. Its 180 px frame now spans x 3650 to 3830, inside the pebble room and the world's right edge.
- The Crystal shine and Glowworm Paint shells' pools are every Legendary spot in their area, the open ones included, so either may be found outside a Dash pot.
- A future area may hide a Legendary in an open spot, as long as the spot is deep, in the Legendary risk band and the area has a threat. It may still use Dash pots, and a pot may still be the only Legendary spot kind in an area with no threat.
- The Treasure Chest's Legendary hint now tells a player where to look, not how to open a pot. The Dash pot tip (B11) is still how a player learns to break one.

Recorded residuals:

- A save written by a build with #149 that holds a Legendary banked before #149 has `dashPotTipSeen` false, so the Dash pot tip may show once there. Root cause: that build counted the banked Legendary as knowing, so the tip never showed and the flag was never set. Bounded: the tip shows once, pauses nothing and waits while a threat is in reach (B11). Not changed: the save cannot tell a false flag written for that reason from a player who has not met a pot.
## Alternatives considered

| Option | Why not |
|---|---|
| Keep Dash pots required for every Legendary (the old rule) | It is not the owner's rule: it crept in. It also caps each area's Legendary spots at the pots its deepest, most dangerous water can fit, which left Area 7's pool with no choice of spot. |
| Any cover plus danger | A Legendary under reeds or a lily pad, in the Legendary risk band, would be less hidden than an Epic, which must be deep. The owner's rule asks for more hidden and/or more dangerous, never less hidden. |
| Dark water as a new hiding kind | It would be a new hiding rule across the PRD, the code and the art guide for one habitat. The open spots already sit deep in a hollow or past a current, which the existing rule measures. |
| Widen Area 7's current to fit a fourth Dash pot | The current's size sets the past-current strip, the snack keep-outs and the swim physics there. Moving it would move snacks and change how the area swims. Widening the grotto, a dead end, moves nothing else. |
| Visit open Legendary spots without a dash | Area 7's open spot fails the one-leg fairness proof without one. Tail Dash works anywhere and with any number of legs (A10), so a dash in the visit is fair, and it keeps the checks as strict as before. |
