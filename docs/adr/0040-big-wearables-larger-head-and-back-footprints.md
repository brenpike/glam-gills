# ADR 0040: Big Wearables get larger Head and Back footprints

- Status: Accepted
- Date: 2026-11-04
- Related: [ADR 0004](0004-art-pipeline.md) (the art pipeline, which bakes each drawing once), [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the big items soft and rounded), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (the rig of baked parts and its memory budget), [ADR 0039](0039-cormorant-dive-arc-and-golden-hour-area-look.md) (Area 11, whose treasures bring the first big items, and the iOS Safari memory fix of commit bbd5755)

This ADR records how issue #207, Area 11's treasures, lets a few Wearables draw bigger than their slot's footprint. The owner chose option A of question 2 on #207: big items get opt-in bigger footprints inside the existing texture frame. That decision is final. The footprint sizes and the list of big items are provisional until the owner reviews them on the PR.

## Context

Area 11's Wearables are the big, silly ones: a Propeller cap, a Wizard hat and a Jetpack, with Star sunglasses and a Robot suit. Every Wearable so far draws inside its slot's footprint (art style guide 6i). The Head footprint, `HEAD_FOOTPRINT`, is x 16 to 46 and y -44 to -19.5. The Back footprint, `backFootprint`, is a box on the torso's top edge with its outer edge at v -14. A propeller on a stalk, a tall pointed wizard hat or a jetpack with bubble puffs cannot fit those boxes and still read as what it is.

Every axolotl is drawn in the `AXO_TEX` frame, 166 x 142 units with its origin at (102, 79), so its top is at y -79. The rig ([ADR 0013](0013-axolotl-rig-and-frame-budget.md)) bakes each part into a texture sized to that part's ink box. The face part's ink box takes in the footprint of each worn Shirt, Neck, Back, Head and Face item (`facePartInk`). The Outfit tab's slot pictures are cropped to each slot's footprints over every look (`OUTFIT_SLOT_CROPS`).

Texture memory is tight. Baking every area's scenery at boot passed iOS Safari's per-page memory limit on an iPhone 13 and crashed the page (commit bbd5755, #203).

## Decision

**A big footprint is opt-in, per item.** The art layer names the big items in `BIG_WEARABLE_ART_SLUGS` (`src/art/drawWearables.ts`): `'propeller-cap'`, `'wizard-hat'` and `'jetpack'`. `wearsBigItem(outfit, slot)` says whether the item worn in a slot is one of them. Every other Wearable keeps its slot's footprint and draws exactly as before.

**The big Head footprint is `HEAD_BIG_FOOTPRINT`, x 16 to 56 and y -72 to -19.5** (`src/art/drawAxolotlParts.ts`). It is `HEAD_FOOTPRINT` grown forward to x 56 and up to y -72. Its back edge (x 16) and its lowest point (y -19.5) are unchanged, so it keeps every Head keep-clear rule of art style guide 6i. It stays 4 or more units inside the `AXO_TEX` frame. The Propeller cap and the Wizard hat draw inside it.

**The big Back footprint is `backBigFootprint`**, the Back box with its outer edge at v -30 (`BACK_BIG_BOX_MIN_V`) in place of -14. Every other edge is the Back box's own, so it grows only away from the body. `backFrameBox` takes the outer edge as an argument, defaulting to `BACK_BOX_MIN_V`. The Jetpack draws inside it.

**Both stay inside the existing `AXO_TEX` frame.** The frame does not grow, for any look.

**The face part grows only while a big item is worn.** `facePartInk` adds `HEAD_BIG_FOOTPRINT` or `backBigFootprint` in place of the slot's usual footprint when `wearsBigItem` is true for that slot. Only an axolotl wearing a big item bakes the taller face part. Every other bake keeps its size and its memory.

**The Head and Back slot crops take the union.** `OUTFIT_SLOT_CROPS` for Head and Back hold both the usual footprint and the big one (`src/art/outfitSlots.ts`), so a big item fits its slot picture on the Outfit tab. Every item in those two slots, big or not, is cropped from the larger box, so it shows slightly smaller on its picture button. The other six slots' crops are unchanged.

**The hero rule: the axolotl stays the hero.** A big item's visible paint stays under the axolotl's own. On every body look at the still pose, and on the smallest look (a Girl's Short-tailed Slim Baby) over the swim cycle at tail amplitudes 1 and 1.6, the axolotl's own visible paint is more than the big item's. The tests record the least share for each big item: 6.27 for the Propeller cap, 6.18 for the Wizard hat and 9.08 for the Jetpack, all on that smallest look mid-swim.

**The big items stay kid-safe (ADR 0007).** Every blade, ray and tip is rounded, the Jetpack puffs bubbles and never flames, and no item has letters, numbers, dials or grids.

## Consequences

- A later Head or Back item can opt in by adding its art slug to `BIG_WEARABLE_ART_SLUGS`. It must draw inside the big footprint and pass the hero rule.
- Outfits with no big item bake exactly as before, with the same face part size and the same memory.
- An axolotl wearing a big item bakes a taller face part, so its bake takes a little more texture memory. Only the axolotls wearing one pay it.
- Every Head and Back item now shows slightly smaller on the Outfit tab's slot picture, because the crop holds the big footprint too.
- There is no big Face footprint yet. The Star sunglasses keep `GLASSES_EXTENT` and get their flair from soft corner stars on the frame's outer edge. The Robot suit keeps the Shirt footprint. A big Face, Shirt, Neck, Tail, Socks or Feet footprint would need its own decision.
- The footprint sizes and the big item list are provisional. The owner can tune or reverse them on the PR, as art.

## Alternatives considered

| Option | Why not |
|---|---|
| Grow `AXO_TEX` for every look | Every bake of every axolotl would grow, worn items or not, and texture memory is the budget that crashed iOS Safari before (commit bbd5755). Most axolotls would pay for items they are not wearing. |
| Keep today's footprints | The Propeller cap, the Wizard hat and the Jetpack cannot read as themselves inside the Head and Back boxes, and the owner wants Area 11's looks big and silly. |

## Note: the Surfboard (issue #214)

Issue #214, Area 12's treasures, adds a fourth big item as the first Consequence allows: the Surfboard, art slug `'surfboard'` in `BIG_WEARABLE_ART_SLUGS`. It is a Back item and draws inside `backBigFootprint`, so the Jetpack and the Surfboard now both use the big Back box. It passes the hero rule: its least shares are 17.14 on the still looks and 16.69 on the smallest look mid-swim (`HERO_RECORD` in `src/art/lakeWearableArt.test.ts`). Every rule above is unchanged.
