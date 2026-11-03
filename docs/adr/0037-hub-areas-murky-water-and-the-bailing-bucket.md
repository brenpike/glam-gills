# ADR 0037: Hub areas, murky water and the bailing bucket

- Status: Accepted
- Date: 2026-11-02
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the murky water, the bucket and the fact card gentle), [ADR 0008](0008-gentle-fail-state.md) (the gentle fail state, which a bucket catch never touches), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the shared hit path and the moving hazards), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the danger bar's whole-water test, which each hub branch meets), [ADR 0024](0024-mobile-snack-wander-loops-and-shrimp-hops.md) (the snack homes, which keep out of the patches and the catch boxes), [ADR 0032](0032-legendary-spots-deep-and-dangerous-dash-pot-optional.md) (the Legendary rule that Area 9's open spots follow), [ADR 0034](0034-two-lane-areas-black-bass-and-gliding-trajineras.md) (the black bass, carried forward, and the gliding trajinera, the last timing element added), [ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md) (the anchor drop and the mud seep, which Area 9 is the first real area to place)

This ADR records the build choices for issue #107, the deep canal's Area 9: the first hub area, its new hazard, murky water, and its timing element, the bailing bucket. The owner's decisions on #107 are listed below, and they are final. ND-1 to ND-5 are the named defaults in the code comments, and they are provisional until the owner reviews them on the PR.

Owner decisions on #107:

- 2026-10-22: the level layout ladder on #32 applies: more branching routes, dead ends that hold treasure, and tighter gaps than the area before, while staying beatable with one leg and every hit avoidable with skill.
- 2026-10-22: Area 9's one timing element is the bailing bucket. It is not a bird or any predator, and a predator is never shown grabbing or lifting the axolotl (PRD A11, ADR 0007, ADR 0008). It warns with the bucket's shadow and ripples, then dips near the surface on a cycle of about 7 s with a 1.0 s warning, reaching the top 70 px of water under its boat. There are 2 bailing boats. A caught axolotl peeks out of the bucket, surprised and never hurt, and splashes in at a fixed safe landing spot about 3 screens back along the route, never inside a predator's reach. A catch never costs a leg or a hit and starts no protected time. Under reduced motion the axolotl fades out at the bucket and fades in at the landing spot.
- 2026-10-22: murky water is Area 9's new hazard: 3 fixed patches, a warning at 2 s inside, a leg lost at 3 s, the timer reset after 1 s in clean water, and a small ring meter. Patches on the required route are at most 200 px wide. Wider patches hold optional treasure. The fact card is "Dirty water", with the owner's copy. The same decisions set the area's size, its predators and their ladder values, its treasures and its look: the trajineras are moored and do not glide.
- 2026-10-22: the area's shape is a hub: it starts in the middle, with branches to both sides. The exit is down one branch and the treasures down the others.
- 2026-10-23: the danger bar of #117 and the snack ramp (PRD H4) apply.
- 2026-10-24: the whole-water danger test of #130 and the snack motion rules of #131 apply. In a hub, every branch counts. The murky patches stay still, so they do not count toward the bar, and the bailing bucket costs no leg, so it is not a threat for the bar. Snack homes keep out of every murky patch and out of the buckets' reach.

Named defaults: ND-1 is the murky water's rules and values, ND-2 the bailing bucket's rules and values, ND-3 Area 9's carp tuning, ND-4 the perk on each Area 9 Wearable, and ND-5 the sounds for a murky hit and a bucket catch.

## Context

Areas 1 to 8 all start on the left, at x 120, with the Home Spot there. The PRD's area shape rule says the first area that needs a shape the framework cannot express, such as the Home Spot not on the left, generalises the framework in its own PR, with an ADR. Area 9 is the first area whose Home Spot is not on the left.

Every hazard so far costs a leg on touch, or costs nothing and only slows or pushes. Murky water is the first that costs a leg for staying in it too long, and nothing for touching it.

Every timing element so far blocks, pushes or carries the axolotl in the water. The bailing bucket lifts the axolotl out of the water and puts it down somewhere else. That is close to a predator grabbing it, which the game never shows (PRD A11, ADR 0007, ADR 0008), so its rules have to keep it clearly gentle.

## Decision

**The hub is plain area data, and the framework did not change (owner, 2026-10-22).** Area 9 is 9 x 2 screens. Its start (x 2160, y 360) and its Home Spot sit in the middle, and its safe area is the Home Spot's column, from x 2015 to x 2305 and from the surface to the bed (`src/logic/deepCanal2Layout.ts`). The west branch holds the treasure: Rare spots under its moored rows, the sunken hull cave under the wide murky patch, and the water past the side-canal inflow on the bed. The east branch holds the main path, which runs east from the Home Spot and never turns back west, to the exit low at the branch's end, with its gate on the bed. Each branch is at least 4 screens across.

The framework already reads the start, the safe area, the exit and the main path from each area's data, and no rule assumes the Home Spot is on the left. So Area 9 needed no change to the framework, and this ADR records that in place of a framework change. The only shared layout field the area adds is `bailingBoats`, for its timing element.

Each branch meets the danger bar on its own (owner, 2026-10-24). Every predator loop stays wholly on one branch: one tilapia, one black bass and three carp on each. No quiet swim on either branch is longer than one screen across, counting only that branch's threats. Area 9's moving hazards are two anchor drops on the main path in the east branch and two mud seeps on the bed, one in each branch ([ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md)). They are danger parts, so murky water is Area 9's one new hazard and the bailing bucket its one new timing element.

**Murky water is a time-inside hazard on fixed patches, and it is not a danger-bar threat (ND-1).** Murky water (`'murky-water'` in code, `MURKY_WATER` in `src/logic/murkyWater.ts`) is a hazard type that never costs a leg on touch and has a touch reach of 0. A patch is a fixed rect of area data with no drift.

- Area 9 has 3 patches. Two are 160 px wide, over the main path in the east branch, so a one-leg axolotl crosses each along the path in under 3 s. The third is 320 px wide, over the sunken hull cave in the west branch. It is an optional treasure dead end, and the main path never enters it. Every patch is out of the safe area.
- The murky timer builds while the axolotl's centre is in a patch. At 2 s the warning shows. At 3 s one hit is due, and the timer restarts at 0. One second in clean water resets the timer to 0. A shorter time out holds it where it is, with no drain.
- The hit goes through the shared hit path (`hitEncounter` in `src/logic/encounter.ts`), with source id `'murky-water'`, from the centre of the patch. So a Shell perk can block it, a lost leg starts protected time, and losing the last leg carries the axolotl home, as for any hit. The timer holds while protected time runs and during a bucket toss.
- A patch is never a touch hit, a risk threat for hiding spots, a gap obstacle or a danger-bar threat. It is swum through, not round, like a pulsing current. Snack homes, stranding places, the exit and every moving hazard sweep keep clear of every patch.
- The "Dirty water" card (card id `'murky-water'`) shows the first time the axolotl's centre enters a patch outside the Home Spot. Its copy is the owner's, checked against the sources in the code comments.
- A murky hit plays the uh-oh, like any hit (ND-5). Nothing shows the water hurting the axolotl: the cue is a soft cheek tint and a few little bubbles, and the cost is the shared leg-loss poof (ADR 0007, ADR 0008).

**The bailing bucket is a timing element, not a predator (ND-2).** The bailing bucket (`'bailing-bucket'` in code, `BAILING_BUCKET` in `src/logic/bailingBuckets.ts`) is a moored boat whose bucket comes down on a rope on a fixed 7 s cycle: a 5 s rest, a 1 s warning (the bucket's shadow and ripples at the surface) and a 1 s dip. During the dip only, a catch box 48 px wide, reaching 70 px down from the surface under the bucket, catches an axolotl whose centre is inside it.

- A caught axolotl is tossed to its boat's fixed landing point, back toward the hub. The toss is a 1.2 s arc, and under reduced motion a fade out at the bucket and a fade in at the landing point. It lands with zero velocity and swims on.
- A catch never costs a leg and is never a hit. It drops no find, uses no Shell and starts no protected time. Its only cost is distance. The murky timer resets on a catch.
- During the toss the axolotl is out of the water. Time still runs, so legs regrow and protected time counts down, but every predator sees the axolotl as hidden, as if behind rock, so none warns at it, chases it or strikes it. No hazard, moving hazard, find, rescue or meeting acts on it.
- Each landing point is in the swim bounds, out of the safe area and out of every predator's reach with its leash, every sweep, every murky patch and every catch box. Area 9's two boats are half a cycle out of step, moored over the main path near the exit, and each tosses the axolotl about 3 screens back toward the hub. The main path runs through both catch boxes, so a player has to time them.
- A boat is never a hazard spawn, a moving hazard or an entry in `elements`. It is its own `bailingBoats` area data, as the gliding trajineras are their own `trajineras`. So the danger bar never counts it, and it has no fact card. No snack starts near a catch box.
- Nothing shows a predator lifting the axolotl. The bucket is a plain round open bucket with a bail handle, with no teeth, claws, hand, jaw or eye. The art shows no person, no face and no text. A catch reads as a scoop into a bucket and a toss, never a bite or a grip (PRD A11, ADR 0007, ADR 0008). A catch and a splash-down play no sound (ND-5).

**Area 9's predators, treasures and Dream colours.** Area 9's tilapia and black bass take the owner's ladder values, and its carp one step up from Area 8's (ND-3). Its 12 treasures are the owner's, with the Little bailing bucket as the Rare special treasure. Each Wearable has one existing perk at the value for its rarity, and no two share a perk type (ND-4). The PR lists them for the owner to check. Area 9 adds two Paint shells: Olive, the owner's Rare solid, and Lantern shine, a Legendary lantern orange sheen. That follows the rule that each new area adds at least 2 Dream colours, at least one of them a Legendary patterned or sheen colour, and makes 24 Dream colours.

## Consequences

- A hub, or any shape with the Home Spot away from the left, is area data. A later area with that shape needs no framework change. The 2-row limit and the exit-on-the-right case of the area shape rule are untouched: Area 9 is 2 rows.
- In a hub, the danger bar and the snack rules are proved branch by branch, counting only each branch's threats.
- A time-inside hazard is a hazard type with no touch cost plus a timer that hits through the shared hit path. A Shell, protected time and the carry home work on it with no new rules.
- A hazard that costs no leg on touch is already left out of hiding spot risk. A murky patch is also left out of gap obstacles (`obstaclesOf` in `src/logic/layoutGaps.ts`).
- The trip has a new out-of-water state, the toss, in which nothing can hit the axolotl. A later element that lifts the axolotl out can reuse it.
- Area 9 places both [ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md) types, so the ids `'anchor-drop'` and `'mud-seep'` are fixed for good, and their two fact cards are in the Collection Book.
- The ND-n values are provisional. The owner can tune any of them in play as area data or tuning, with nothing else to change.

## Alternatives considered

| Option | Why not |
|---|---|
| Generalise the area framework for a Home Spot not on the left first | The start, the safe area, the exit and the main path were already area data, and nothing assumed the left. A framework change would have changed nothing. |
| Make murky water cost a leg on touch | It would be one more touch hazard. The owner's water is something to swim through quickly, not to dodge, and a touch cost would make the wide treasure patch unreachable without a hit. |
| Drain the murky timer slowly in clean water | A drain is harder to read than the owner's clean reset after 1 s, and a short dip out would still leave most of the time built up. |
| Count murky patches toward the danger bar | They stay still (owner, 2026-10-24). The bar counts only predators and moving hazards. |
| Show the bailing bucket as a bird or a hand that lifts the axolotl | A predator is never shown grabbing or lifting the axolotl (PRD A11, ADR 0007, ADR 0008). A plain bucket and a toss stay gentle. |
| Make a catch cost a leg, or start protected time | A catch is a timing element, not a threat. The owner chose a cost of distance only. Protected time would let a caught player swim past threats unharmed. |
| Put bailing boats in `elements` | The danger bar and other `elements` readers would need a case to leave them out. Their own area data field, as the trajineras have, keeps every other element rule unchanged. |
| Let predators keep hunting during the toss | The axolotl is out of the water. A strike that landed on the toss or a chase waiting at the landing point would turn a gentle catch into a hit. |
