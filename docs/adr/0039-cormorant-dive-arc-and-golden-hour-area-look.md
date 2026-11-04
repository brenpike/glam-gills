# ADR 0039: The cormorant's dive arc and the golden-hour area look

- Status: Accepted
- Date: 2026-11-04
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the cormorant gentle and keeps letters off the sunken arch), [ADR 0008](0008-gentle-fail-state.md) (the gentle fail state, which a dive hit goes through like any hit), [ADR 0012](0012-save-on-device.md) (the new ids under its additive rule), [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (the frame budget the cormorant view and the petals keep), [ADR 0014](0014-area-framework.md) (the area framework and the rule of at most one new thing per area), [ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md) (area look variants, which the golden-hour look is), [ADR 0019](0019-heron-wading-stalker.md) (the heron, the cormorant's wading counterpart, and its sight cover), [ADR 0020](0020-u-turn-areas-garter-snake-and-hyacinth-mats.md) (the U-turn shape and `warnOnRoute`), [ADR 0023](0023-whole-water-danger-test-and-relaxed-fairness.md) (the whole-water danger test and the floor rule), [ADR 0031](0031-sheen-dream-colours-share-the-live-stripe.md) (the live stripe, which Golden shine shares), [ADR 0034](0034-two-lane-areas-black-bass-and-gliding-trajineras.md), [ADR 0035](0035-deep-canal-moving-hazards-anchor-drop-and-mud-seep.md), [ADR 0036](0036-gliding-trajineras-shuttle-and-surface-boats-never-overlap.md), [ADR 0037](0037-hub-areas-murky-water-and-the-bailing-bucket.md) and [ADR 0038](0038-grand-tour-areas-trajinera-lures-and-drag-nets.md) (the deep canal's earlier areas, whose hazards Area 11 carries forward)

This ADR records the build choices for issue #112, the deep canal's Area 11: a U-turn at golden hour with the cormorant as its one new predator. The owner's decisions on #112 are listed below, and they are final. The cormorant's design (ND-1 to ND-7, PRD open questions 544 to 550) and the named defaults in the code comments, ND-8 to ND-15 among them, are provisional until the owner reviews them on the PR.

Owner decisions on #112:

- 2026-10-24 (#130): an area with surface danger must also have predators on the floor. The cormorant floats on the surface and dives, so it is surface danger, and its area needs floor predators too. In the whole-water danger test its dive counts as reach only as deep as it really goes.
- 2026-10-29: the cormorant goes in a new Area 11, a fourth deep canal area after Area 10, as its one new predator (option A of PRD open question 544). Areas 8 to 10 and the one-new-thing rule are unchanged, and the cormorant is never in Areas 1 to 7 or the spring cave. It is designed now and built with its area.

## Context

The cormorant is the heron's diving counterpart: it floats at the surface and dives after the axolotl. Every predator so far strikes along a straight line (a lunge, a dart, a pinch or a sweep) or stabs at a fixed spot (the heron). None of those shapes is a dive that goes down, through the axolotl's place and back up to the surface. The PRD's design (N3, open question 546) names a new rule option for it, the dive arc, designed but not built.

Area 11's starting size, about 10 x 2 screens, and its empty timing or puzzle slot are provisional (ND-1). The area shape rule says the first area that needs a shape the framework cannot express generalises the framework in its own PR, with an ADR.

The deep canal look has no time of day of its own. The owner's Area 3 is the pond at dusk, the only area look variant so far ([ADR 0016](0016-heron-timer-warnings-and-area-look-variants.md)). A dusk or night look plays its habitat cue's dusk version (PRD M4).

Boot used to bake every area's full-screen scenery chunks up front. On an iPhone 13 that passed iOS Safari's per-page memory limit and crashed the page (commit bbd5755, #203). Scenery is now baked per area when a trip enters it (`SceneryCache`), and only the canal's and one other area's chunks are held. Any new look has to fit that budget.

## Decision

**The U-turn is plain area data, and the framework did not change.** Area 11 is 10 x 2 screens, 4800 x 720 px (`src/logic/deepCanal4Layout.ts`). Its start (x 180, y 200) and its Home Spot are top left, and its safe area is the Home Spot's column of the top row (x 40 to 330). The main path runs east along the top row, deeper than y 300 under the three cormorants and up under the moored row past `cormorant-1`, drops down in the last column, and runs back west along the bottom row to the exit, low in the first column under the Home Spot (x 180, y 620), so the open sign's arrow points left. It passes ADR 0020's U-turn shape test. The treasure water lies east of the way down: the side-canal inflow up top and the sunken hull cave on the bed.

The framework already reads the start, the safe area, the exit and the main path from each area's data, so the U-turn needed no framework change. This ADR records that in place of one. Area 11 adds no shared layout field and no element: its timing or puzzle slot stays empty (ND-1).

**The cormorant is a predator species on the shared rules (`CORMORANT_SPECIES` in `src/logic/predators.ts`; ND-2, ND-3).** Its id is `'cormorant'`, and it is not a danger part.

- Its rules are `sightCover`, `warnOnRoute` and the new `diveArc`. It hunts by sight and cannot see into cover, warns only while on its stretch, and never touches or bumps the axolotl (`neverTouches`).
- Its tuning (`CORMORANT` in `src/logic/tuning.ts`) is a 1.0 s warning over the 0.8 s floor, a 180 px lunge range, a dive at 450 px/s capped at 1.3 s, a 2.5 s cooldown and a 40 px/s drift. Its hit reach and body reach are the tilapia's.
- Its chase (`CORMORANT_CHASE`) has a sight of 240 px, a speed of 120 px/s and a leash of 0, so it chases along its stretch only. It uses neither `fixedStrikeSpot` nor `stillCooldown`, so `tunedSpecies` accepts its chase, and it passes the danger bar's chase check as any chasing predator does.
- Area 11 has three cormorants (`cormorant-0` to `cormorant-2`), each floating along a short straight stretch at y 94, between the anchor drops and the moored rows, over a part of the main path that runs deeper than y 300.

**The dive arc is a new shared rule option (`diveArc`; ND-15).** At the end of the warning the predator locks a dive arc toward the target's place then, the aim spot (`lockDiveArc`), kept as `PredatorState.dive`.

- The arc is U-shaped. It goes down from the predator's place through the aim spot's x and back up to its start height as far past it. Each half is a quarter ellipse, walked as straight pieces between 65 corners.
- Its bottom is at the aim spot's depth, never deeper than the lunge range below the nearest point of its route. With the stretch at y 94, the head goes no deeper than y 274, so it hits no axolotl deeper than y 300.
- Its width, start to far end, is 120 to 360 px (`DIVE_ARC_MIN_WIDTH`, `DIVE_ARC_MAX_WIDTH`). The far half is narrowed by bisection so its far end stays within the lunge range of the route. An aim spot straight below dives along the facing.
- The dive moves at the lunge speed. It lasts the arc's length over 450 px/s, at most 1.3 s: the longest arc, about 565 px, takes about 1.26 s. Each move is clamped as any move, so rock and the safe area stop it.
- A hit is the predator's head within its hit reach of the axolotl, anywhere along the arc, as the tilapia's strike connects. A dive that connects ends the strike, and the predator finishes the arc through the cooldown with no further hit.
- Through the cooldown it holds where it surfaced, keeping the dive's facing, turned away and drying its wings. After a cancelled warning it holds where it is. Then patrol swims it back to its stretch, where it can warn again.
- With `stillCooldown` or `slowTurn` as well, `stillCooldown` wins, then `diveArc`. Every species without the dive arc keeps its strike as built.

**The cormorant in the danger tests (ND-4).** Its in-reach area is its 180 px lunge range round its stretch, with no leash, so its dive counts as reach only as deep as it really goes. Its stretch lies wholly in the surface band, so Area 11 has surface danger and the floor rule applies. The black bass, the carp and the tilapia are its floor predators. The cormorant never counts toward the depth rule. It counts as a moving threat and as a predator species. No accepted danger bar rule changed.

Area 11 has 2 tilapia, 7 carp, a black bass and 3 cormorants, the tilapia, the carp and the black bass each one step tighter than in Area 10, plus 4 anchor drops lowered 160 px and 3 mud seeps 78 px tall. That makes 20 moving threats for its 20 screens, 4 predator types and 2 moving hazard types, and every predator chases. Its main path's narrowest gap, 37.29 px between `mud-seep-3` and `carp-6`, is tighter than Area 10's and never under the safe passing width. It carries forward 2 murky patches (a 120 px one on the bottom row's way west and a wide one over the sunken hull) and 2 fishing trajineras with 3 lures. Its snacks are 16 tadpoles, 16 shrimp, 7 worms and 7 bugs, so 32 of 46 are mobile, 69.6% (ND-8).

**The cormorant stays gentle.** Its bill is always closed. Its warning is the dive crouch pose only, with no "!" bubble and no glint. It is never shown grabbing, holding, lifting or carrying the axolotl, and a hit shows only the usual leg-loss poof (ADR 0007, ADR 0008). Under reduced motion the poses switch at once and nothing bobs, but the dive still moves, because it is gameplay. Its fact card is "Meet the cormorant" (ND-6), met within 180 px of a cormorant outside the Home Spot.

**The golden-hour look is an area look variant, `'deep-canal-golden'`, with time dusk.** It is the deep canal look with a warm coral and peach sky and wash, warm shallow and mid water fading to the deep canal's own deep stop, a warm haze and surface line, and warm light rays that slant further. It keeps the deep canal contrast rule. `AREA_LOOK_TIMES` gives it the time dusk, so the music rule plays the dusk version of Trajinera Waltz in Area 11 (PRD M4), with no new cue.

- Its decorations are painted into the area's existing scenery chunks (`goldenDecor`, `paintGoldenDecor` in `src/art/drawGoldenCanal.ts`): papel picado banners, marigold petal patches, water hyacinth rafts, chinampa walls with ahuejote root curtains, and sunken trajinera arches. The lower row is lit too (`lowerRowLight`). None of it draws randomness, so a look without it keeps its random draws and every other area bakes as before.
- The texture budget: 5 cormorant frames (two float frames, the warning, the dive and the drying pose) are baked at boot with the other predators. One sinking marigold petal texture is baked only when some area's look lets petals sink (ND-13), and at most one petal per screen of area width sinks. The look adds no new scenery texture: its chunks are the ones `SceneryCache` already bakes on demand when a trip enters the area, so the iOS Safari memory fix of commit bbd5755 holds.
- The water hyacinth rafts are scenery, not cover. They are thin, at the surface and behind every cue object. They hide no axolotl from any predator, and no hiding spot reads them.
- The sunken arch's name-board carries three round marigold flowers, never letters. The game shows no text in its art (ADR 0007), and no decoration has a star, a pointed shape, a worm or bug shape, a face or a dark opening, so nothing reads as a snack, a hint sparkle, a hazard or a hiding place.

**No new sounds.** A cormorant's warning and its hit play the same sounds as any predator's.

**Area 11's treasures are minimal and provisional.** It has 16 treasure slots and 3 new treasures, appended at the end of the catalogue (ADR 0012):

- the Little cormorant (`'deep-canal/little-cormorant'`), a Rare Floating Decoration and the area's special treasure;
- Marigold (`'marigold'`), a Rare solid Dream colour;
- Golden shine (`'golden-hour-shine'`), a Legendary sheen Dream colour on the shared live stripe (ADR 0031). Its name was shortened from Golden hour shine to fit the cards; the id keeps the longer form.

That follows the rule that each new area adds at least 2 Dream colours, one of them a Legendary patterned or sheen colour, and makes 28 Dream colours. Every other slot falls back by the treasure slot rule (B4).

## Consequences

- A U-turn deep canal area is area data. Areas 1 to 10 build, play and bake exactly as before.
- A later predator that dives can take the `diveArc` rule option. Its depth is capped by its own lunge range below its route, so the danger tests can count its reach without a special case.
- A later area can add a look variant with a time of day. Its music follows from the time, and its decorations go into its own scenery chunks, not new textures.
- The ids `'cormorant'`, `'deep-canal-4'`, `'deep-canal-golden'`, `'marigold'`, `'golden-hour-shine'` and `'deep-canal/little-cormorant'` are fixed for good (ADR 0012). The save format is unchanged: the met list only gains `'cormorant'`, and the Collection Book gains its card, 24 fact cards in all.
- The ND-n values, the treasure list and the decoration placements are provisional. The owner can tune or reverse any of them on the PR, as area data, tuning or art.

## Alternatives considered

| Option | Why not |
|---|---|
| Make the water hyacinth rafts cover | Cover would be a new hiding rule in an area whose one new thing is the cormorant (ADR 0014), and it would change what the cormorant and the heron can see. Scenery painted into the chunks cannot be a cue either. |
| Add new sounds for the dive or the drying | The shared warning and hit sounds already tell the player what happens, and a new sound would need its own design under the sound guide. |
| Add dragonflies or ambient fish to the golden-hour water | In this game fish and small creatures in the water mean danger or food (predators and snacks), so they would mislead a kid. They were dropped. |
| Give Area 11 Area 10's grand-tour shape | The provisional size is 10 x 2, and a U-turn fits it. It puts the cormorants over the top row's way east, with the way deeper than their dive, and the way back west along the bottom row out of their reach. |
