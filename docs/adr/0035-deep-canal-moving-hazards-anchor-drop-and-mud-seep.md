# ADR 0035: Deep canal moving hazards, the anchor drop and the mud seep

- Status: Accepted
- Date: 2026-11-01
- Updated: 2026-11-01. The owner approved both fact cards' copy (PRD open questions 592 and 593).
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the new hazards and their cards gentle), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the moving hazard type and its shaft rule, which both new hazards use as they are, and ids that are fixed for good once saved), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the danger bar's whole-water test, which counts them), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (the stalactite drip and the geyser vent, the last moving hazard types added), [ADR 0030](0030-spring-cave-danger-tuning.md) (the drip's and the geyser's fixed art lengths, which these follow)

This ADR records the build choices for issue #194: two new moving hazard types for the deep canal, the anchor drop and the mud seep, each with its own fact card and art. Q1 to Q3 are the owner's decisions on #194 (2026-11-01). Every value here is provisional, and the owner can tune any of them once a real area places them.

## Context

The danger bar asks each area for at least one moving hazard type that costs a leg. The game had three: the punting pole, the stalactite drip and the geyser vent. The drip and the geyser belong to the spring cave's rock, so the pole was the only one that fits open canal water. Area 8, the deep canal, had to reuse punting poles for its moving threat ([ADR 0034](0034-two-lane-areas-black-bass-and-gliding-trajineras.md), owner Q2 on #78). The deep canal areas still to come need moving hazards of their own, so issue #194 adds them.

## Decision

**Two deep canal types, each with its own fact card (owner Q1).**

- The anchor drop (`'anchor-drop'` in code, `ANCHOR_DROP` in `src/logic/movingHazards.ts`): a boat's anchor lowered on its chain from the surface to the canal bed, then pulled back up.
- The mud seep (`'mud-seep'` in code, `MUD_SEEP`): a seep in the canal floor that sends a column of bubbles up out of the mud.
- Each has its own fact card in `src/logic/factCards.ts`. The anchor card is titled "Anchors". The mud seep card is titled "Mud bubbles", and its card id stays `'mud-seep'`. The owner approved both cards' copy (PRD open questions 592 and 593), with its sources and the points the owner checked in the code comments.

**The existing shaft rule, with no new movement shape (owner Q2).** Both types are plain moving hazard types on the shared rule of [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md): a straight shaft that goes out from its base on a fixed cycle of rest, warning, out, hold and back. The whole drawn shaft costs a leg on touch, so for the anchor drop the chain costs a leg as well as the anchor. There is no end-only touch and no swing or arc. Their values:

| | Anchor drop | Mud seep |
|---|---|---|
| Comes from | the surface, going down | the floor, going up |
| Rest, warning, out, hold, back (s) | 1.4, 1.0, 0.5, 0.8, 1.1 | 2.0, 1.2, 0.5, 1.2, 0.7 |
| Cycle | 4.8 s, out 2.4 s of it | 5.6 s, out 2.4 s of it |
| Depth by default | 200 px | 180 px |
| Deepest an area may set | 320 px | 260 px |
| Half width | 5 (a 10 px chain, as narrow as the pole) | 10 (a 20 px column, narrower than the geyser's) |
| Touch reach | 18 px | 18 px |

The anchor drop has the pole's 1.0 s warning and a slower pull back up. The mud seep has the geyser's 1.2 s warning, since it rises from below, and a short fade.

**Dev danger area only, for now (owner Q3).** The two types are placed only in the dev danger area (`src/logic/devAreas.ts`), so they can be seen and tested in play. Areas 1 to 8 are unchanged, and so are their golden snapshots. Area 9 (#107) is the first real area to place them.

**Build choices.**

- Each type has a fixed deepest depth, 320 px for the anchor drop and 260 px for the mud seep. Its art is drawn that long in one piece, with no stacking of art pieces, as ADR 0030 did for the drip and the geyser. A shorter depth crops the same art.
- The hit zone is never wider than the drawn shaft. The anchor's chain is drawn 10 px wide, the same as its hit width, and the anchor itself is drawn wider. The mud seep's bubbles are drawn a little wider than its 20 px hit width: about 21 px where two bubbles meet and 24 px across each bubble's middle. A near miss on the drawn edge does not cost a leg, which favours the player.
- Each warning cue and ring is distinct in greyscale, by shape, not by colour. The anchor drop's cue is two tall chain links with straight sides and its ring is three stacked wavy lines. The mud seep's cue is five loose silt diamonds with corners and its ring is one zigzag crack. No other hazard uses these shapes.
- Neither hazard is scary. The anchor is a small old anchor under a plain wooden work-canoe, with no people and no faces. The mud seep is a mud mound and round bubbles, with no fire, steam or volcano. A hit shows only the shared leg-loss poof ([ADR 0007](0007-kid-safety-and-privacy.md), ADR 0008).
- The two fact cards stay out of the Collection Book until a real area places their hazards. A card that no area can unlock would be a gap the player could never fill.

## Consequences

- Adding the two types is a data-only extension of the shared moving hazard part. The danger bar's code is unchanged: it already counts moving hazards and their types by id, whatever the type.
- The two looks and their textures ship in the production build but no real area uses them until Area 9.
- In the dev danger area, the two cards show again each session. The save's repair step drops met hazard ids that no real area knows, so the dev cards are not kept.
- The ids `'anchor-drop'` and `'mud-seep'` become fixed for good once a real area saves them ([ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md)). Until Area 9 (#107) ships they can still be renamed.
- Any later area can place either type as area data, with its own depth up to the type's deepest, and nothing else needs to change.

## Alternatives considered

| Option | Why not |
|---|---|
| Generalise shaft art so pieces can be stacked to any depth | No area needs a deeper shaft than the fixed deepest depths. One piece of art per type, as the drip and the geyser have, is simpler and is tested the same way. |
| Only the anchor's end costs a leg, not the chain | It would be a new touch rule for one type. The chain is drawn as part of the shaft, so a touch on it that did not count would look unfair the other way, and the owner chose the existing rule (Q2). |
| A swinging or arcing movement shape for the anchor | A new movement shape needs new rules, new fairness proofs and new danger bar sums. The straight shaft already reads as an anchor going down and coming up (Q2). |
| Place them in Area 8 now | Area 8 shipped with punting poles and its golden snapshot. Placing them would change a finished area. Area 9 places them first (Q3). |
| Reuse punting poles again in later deep canal areas | Every deep canal area would have the same moving threat, and the danger bar's need for variety would never be met by something new (Q1). |
