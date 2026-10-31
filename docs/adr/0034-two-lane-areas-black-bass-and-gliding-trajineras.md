# ADR 0034: Two-lane areas, the black bass and gliding trajineras

- Status: Accepted
- Date: 2026-10-30
- Amends: [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (in part: its statement that predators are not blocked by rock; every other ADR 0029 rule stays in force)
- Related: [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the shared predator rules and the punting pole, which the deep canal reuses), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the danger bar's whole-water test, which two lanes are measured against), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (rock walls, which the divider is made of), [ADR 0031](0031-sheen-dream-colours-share-the-live-stripe.md) (the sheen stripe that Fiesta shine shares), [ADR 0032](0032-legendary-spots-deep-and-dangerous-dash-pot-optional.md) (the Legendary rule that Area 8's open spots follow)

This ADR records the build choices for issue #78, the deep canal's Area 8: a two-lane area with a solid rock divider, a predator that cannot reach through rock, the black bass, and the gliding trajinera. Q2 and Q3 are the owner's decisions on #78. ND-5, ND-8, ND-9 and ND-12 are the named defaults in the code comments, and they are provisional until the owner reviews them on the PR.

## Context

Area 8 is the deep canal, 8 x 2 screens. The owner wanted a place that feels deep and busy: boats above, a dark lane of water below, and a big fish that hunts there. It adds two new things (PRD N2, New things): the black bass, its signature predator, and the gliding trajinera, its timing element.

Two problems came up.

The first is that rock did not stop predators. [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) made rock block only the explorer, and kept each carp loop and route clear of it instead. A divider that runs across most of the area would put predators in one lane within sight and reach of the axolotl in the other. A strike through rock would look wrong and feel unfair.

The second is that the black bass is big and fast with a long lunge. Left on the shared rules, it would turn toward the axolotl the moment a strike ended, so a dodge to the side would not beat it.

## Decision

**Two lanes with a solid rock divider (owner Q3).** Area 8's water is split from x 600 to x 3560 by a divider of rock walls into a surface lane over it and a deep lane under it. The lanes join again in the exit pocket on the east side, and share a pocket at the west where the Home Spot is. The divider is `rockWalls` area data (`src/logic/deepCanalLayout.ts`): seven stones, each touching the next, mostly 40 px thick. It steps up to y 188 to 228 for most of a screen over `bass-1`. No body passes between the lanes. The surface lane holds the punting poles, the moored boats and the gliding trajineras. The deep lane holds the black bass, the sunken trajinera hull and the side-canal inflow. Each lane has its own tilapia and its share of the carp. The main path runs along the surface lane to the exit.

**Predators never sense, chase or strike through rock (ND-12).** This applies to every predator in every area that has rock walls, not only Area 8.

- A target with rock between the predator's centre and itself counts as not exposed: the predator starts no warning, cancels a warning at its end, does not chase it and never hits it (`targetBehindRock`, set by `crossesRock` in `src/logic/encounter.ts`). Edges and corners count as rock, as the danger bar's grid counts them.
- A strike never connects while rock lies between its striking point and the target after the move.
- Every predator move (patrol, chase, strike, cooldown, glide) stops at the face of each rock wall grown by the predator's body radius, and slides along it.
- An area with no rock walls plays exactly as before. Area 7 has rock walls, and its golden snapshot stayed byte-identical with the rule in place. The rule changes no earlier area.

This replaces the sentence in ADR 0029 that predators are not blocked by rock. Its other rock rules stand: the explorer's body never enters rock, the danger bar's quiet swims end at it, and no snack starts in or near it.

**The black bass and its `slowTurn` rule (ND-5).** The black bass (`'black-bass'` in code) is a predator on the shared rules with its own tuning: a 0.8 s warning, a lunge of 180 px at 480 px/s over 0.45 s, a 1.5 s cooldown and a patrol speed of 60 px/s. It warns by distance at any depth and lunges straight along the aim locked at strike start. It is not a danger part: it is Area 8's one new predator.

Its new rule option is `slowTurn`. Through the cooldown after a strike the bass keeps the strike's facing and glides along the strike's aim, from its patrol speed slowing evenly to a stop at the cooldown's end, instead of turning away. After a cancelled warning it holds still, keeping its facing. Then it swims its route again. Dodging sideways beats it, and a player can read where it is going. With `stillCooldown` as well, `stillCooldown` wins. The `glide` direction is kept on the predator's state, so the glide is the same whatever the step size.

**Gliding trajineras: a timing element that is not a threat (ND-8, ND-9).** The gliding trajinera (`'gliding-trajinera'` in code) is a painted boat that glides across a span of the surface lane on a 6 s crossing clock, at 70 px/s. Its hull is 120 px long and blocks the top 60 px of water. Its shadow leads the hull by 1 s of travel as the warning. It is a timing element, so it never costs a leg and is never a hit, and the danger bar does not count it.

- A hull that touches the axolotl pushes it out the shortest way, down or sideways, at 120 px/s, gentler than the tilapia's bump. Each boat has a 0.5 s push cooldown. A push never costs a leg, never drops a find and never starts protected time.
- A push is reported as a trip result, not a trip event. `stepTrip` returns `pushed` and the `impulse` on the step result, and emits no `TripEvent`, so nothing downstream treats a push as a hit, a leg loss or a moment that needs a card or a sound of its own. A step that ends the trip never pushes.
- Snacks keep clear of each hull's band. Boats are painted bow only, with no people, and no fishing: the lures are Area 10's.
- The moored boats along the surface lane's bank, and a sunken trajinera hull on the deep-lane bed, are scenery and hiding cover. They are not timing elements: they never move or push. The moored boats give bank cover to Common and Rare treasure spots (B5), and the sunken hull is a dead end on the deep-lane bed with an open Legendary spot and an Epic spot, which follow [ADR 0032](0032-legendary-spots-deep-and-dangerous-dash-pot-optional.md).

**Reuse punting poles to meet the danger bar (owner Q2).** Area 8 uses at least 3 punting poles, which are an existing moving hazard and a danger part, instead of a new moving hazard. It has 4 in the surface lane, 2 s out of step with the next, each sweep ending 20 px over the divider and clear of every boat span. They give the surface lane its moving threat and meet the danger bar's rule of one moving hazard type. The black bass is the deep lane's signature threat. The pole's fact card, "Trajineras", stays as it is.

**Area 8's Dream colours.** Area 8 adds two Paint shells: Jade, a solid deep blue-green that is Rare, and Fiesta shine, a Legendary fiesta pink sheen that shares the live stripe of [ADR 0031](0031-sheen-dream-colours-share-the-live-stripe.md) with Iridescent and Crystal shine. That makes 22 Dream colours. They follow the rule that each new area adds at least 2 Dream colours, at least one of them a Legendary patterned or sheen colour.

## Consequences

- Every area with rock walls now has predators that stop at rock. Area 7's golden snapshot stayed byte-identical, and the earlier areas have no rock, so no earlier area changes.
- A layout can put rock between a predator and the axolotl and trust it to hold. The danger bar's grid already treated rock as not quiet, so the two agree.
- A second species can use `slowTurn` as area data. Nothing else needs to change.
- Area 8's fairness proofs are measured against the divider: the surface lane's spots and the deep lane's spots each meet their rarity's band against the threats that can reach them, and a hit cannot come through the divider.
- The trip result `pushed` is the one signal for a boat's push. A scene that wants a sound or a cue for it reads the result, as it reads `impulse` for a bump.
- The deep canal's look, bass and boat art, refuge and map entries are in the art style guide and the PRD.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep predators unblocked by rock, and keep each route clear of it by layout (ADR 0029) | A divider across most of the area cannot keep the routes clear of it. A predator would sense and strike the axolotl through solid rock, which looks wrong. |
| One open area, with the lanes marked by art only | Nothing would stop the bass and the poles from sharing one pool of water, and the owner's lanes (Q3) would not read as two ways to swim. |
| Let the black bass turn after a strike, like the tilapia | The big, fast bass could reverse at once and chase the dodge, so sidestepping would not beat it. The glide makes its strike readable and fair. |
| Make the gliding trajinera a moving hazard that costs a leg | It would be a second new hazard in one area, against the one-new-thing rule, and a boat is a timing element, not a threat. A push keeps it gentle (ADR 0008). |
| Report a push as a trip event | A trip event would add a case to every place that reads events, and a push is not a hit, a find or an ending. A step result carries it with nothing else to change. |
| Add a new moving hazard for Area 8 | Reusing the punting pole (Q2) keeps the surface lane true to the trajineras and adds no new hazard, art or fact card. |
