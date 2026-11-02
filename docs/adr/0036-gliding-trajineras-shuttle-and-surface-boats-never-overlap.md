# ADR 0036: Gliding trajineras shuttle and surface boats never overlap

- Status: Accepted
- Date: 2026-11-01
- Amends: [ADR 0034](0034-two-lane-areas-black-bass-and-gliding-trajineras.md) (in part: how a gliding trajinera crosses its span and how it is drawn; its push, hold, lane, hull band and danger bar rules stay in force)
- Related: [ADR 0007](0007-kid-safety-and-privacy.md) (kid safety, which keeps the push gentle), [ADR 0021](0021-danger-pass-chase-rule-and-moving-hazards.md) (the punting pole, whose boat art the new check measures)

This ADR records the fix for the owner's play-test report on Area 8's surface boats (2026-11-01). Q1 to Q3 are the owner's decisions on that report, option A each (PRD open questions 595 to 597).

## Context

The owner played Area 8 and reported that the boats on the surface were a mess. The moored boats overlapped each other and the other boats. The moving boat was so clunky that the owner could not tell what it was, it vanished behind an invisible wall, and its purpose was unclear.

There were three root causes.

1. **Pole boat art was in no clearance check.** A punting pole's painted bow and shadow reach from 74 px left of the pole to 82 px right of it, far past its thin touch zone. The layout checks kept the pole's sweep clear of the other boats, but not its art. So the moored rows at x 960 to 1190, 2320 to 2660 and 3100 to 3500 were drawn over pole boats, and `trajinera-1`'s old route, x 1250 to 1550, overlapped `punting-pole-1`'s boat.
2. **Each moored row was one stretched texture.** Three 132 px hulls were painted in one 440 x 60 texture, then stretched to each row's rect. A short row squashed three hulls together: the row at x 1740 to 1840 held all three in 100 px.
3. **The gliding boat was cropped to its route.** Each frame the scene cropped the hull and its shadow to the 300 px span, so the hull grew out of an invisible line at one end and was cut off by another at the far end. The shadow also faded in and out at the span's ends.

The gliding hull was also painted as a striped 120 x 60 slab, with a dot row and vertical seams, so it read as a box more than a boat. The main path runs under its hull band, so the player seldom has to deal with the boat, and its push is easy to miss (Q2).

## Decision

**The gliding trajinera shuttles whole (owner Q1, option A).** Each boat goes back and forth over its own span and is always drawn whole, never cropped and never hidden.

- Each crossing still takes the 6 s crossing period. The whole hull rests at the end it starts from, then glides at 70 px/s and reaches the far end just as the crossing ends. The next crossing starts from there and heads back. The `direction` in the area data is the heading of the first crossing, the one that starts at the boat's offset.
- The rest is the period less the glide: rest = period − (span − hull length) / speed. It is at least `TRAJINERAS.restMin`, 1 s. So the longest span is `TRAJINERA_MAX_SPAN` = 120 + 70 x (6 − 1) = 470 px, and a span must be longer than the 120 px hull.
- The hull sprite faces its heading and is mirrored when it heads left.
- The shadow is the whole hull 1 s later (`shadowLead`). It is drawn at full alpha with no fade, under full and reduced motion. While the boat rests, the shadow hides under the hull. In the last 1 s of each rest it slides out from under the hull, so it warns 1 s before the boat moves. It faces the heading 1 s later.
- The push, the hold, the lane rules, the bob and the hull band are as ADR 0034 set them. The push is still gentle and never costs a leg. Under reduced motion the boats still glide but do not bob.

**Keep the gentle push and make it readable (owner Q2, option A).** The boat stays a timing element that pushes and never costs a leg. It is made readable by its look, the shuttle's rhythm and the shadow warning, then play-tested. Option B, a few snacks along the top of the water under the route, is a possible follow-up only if the push still feels pointless.

**Area 8's routes move clear of every pole boat.** `trajinera-1` runs x 1320 to 1720, heading right first, offset 0 s, resting 2.0 s at each end. `trajinera-2` runs x 2700 to 3040, heading left first, offset 3 s, resting about 2.86 s. Each route, with its art, is clear of every pole's boat, every moored row and the raised stretch of the divider. The main path still runs under both hull bands.

**Surface boats never overlap.** `src/art/surfaceBoats.ts` measures the x-extent of each surface boat's art: x − 74 to x + 82 for a punting pole (its bow and shadow frames), and the whole route widened by 10 px at each end for a gliding trajinera (its hull and shadow frames). A test over every area and every dev area keeps any two surface boats at least 8 px apart (`SURFACE_BOAT_GAP`). It has one named exception: Area 5's `chinampa-2/punting-pole-4` and `chinampa-2/punting-pole-5`, whose boats overlap (owner Q3, option A; issue #198). The test also checks that the exception still overlaps, so it fails when #198 is fixed and the exception must be removed then. Each gliding route is also kept at least 8 px from every moored row.

**Moored rows are whole boats in free water.** Each moored row is now a shade plus whole hulls.

- The shade (`deep-canal-moored-shade`) is still stretched to the row's rect, so the bank cover over the hiding spots is unchanged.
- The hulls are single 120 px boats (frame 132 x 36), drawn at 1:1 and never stretched, in three paint orders (`deep-canal-moored-hull-0`, `-1` and `-2`).
- Each surface boat's extent, widened by 8 px each side, is taken out of the row. Each stretch of water left gets as many whole hulls as fit, 14 px apart (`MOORED_HULL_GAP`), centred in it. A stretch narrower than one hull gets none.
- There are no mooring ropes.
- Area 8 has 4 moored hulls: one in the west row, one in the middle row and two in the east row. The row at x 1740 to 1840 gets the shade only.

**The gliding hull is repainted.** Its lower corner has a radius of 24 at the prow and 12 at the stern, so it points the way it goes. The pink and orange bands sit in the top 30 px under the cream rail, and teal runs to the bottom. The dot row and the vertical seams are gone, and two lengthwise plank lines run along the teal body. It uses no new colours, and its frame is unchanged.

## Consequences

- The boat never pops in or out, so the player can see what it is and where it will go. The rest and the shadow give a clear rhythm: the shadow slides out, then the boat follows.
- Area 8's golden snapshot was re-pinned by hand, for the new spans, the shuttle's pushes and their knock-on effects only. Area 8's one-leg times were measured again: the surface lane to the exit 63.6 s to 60.6 s, and the full route 223.2 s to 239.1 s. Both are still under their limits of 180 s and 360 s.
- The hiding spots, the bank cover rects and the danger bar are unchanged. Snacks still keep clear of each hull band, the top 60 px of water under the whole span, which now sits on the new spans.
- A new surface boat in any area is caught by the test if its art overlaps another surface boat's. Moored hulls take their places from the other boats, so moving a pole or a route moves the hulls with it.
- Area 5's pole overlap stays until #198 fixes it.
- The art style guide, the PRD (N3, the Tuning values and open questions 595 to 600) and CONTEXT.md describe the shuttle and the moored boats.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the one-way crossing and only fade the hull in and out at the span's ends | The boat would still appear from nowhere, and a solid hull that is half faded would block water the player cannot clearly see. |
| Shuttle with no rest | The shadow would have no time to warn before the boat moves, and the boat would never be still long enough to read as a boat. |
| Keep the stretched moored texture and move the rows | The rows are the hiding spots' bank cover, so moving them changes the hiding spots and the fairness proofs. Squashed or stretched hulls would still show at other widths. |
| Move the poles instead of the gliding routes | The poles' places meet the danger bar and the main path's 36 px gap. The gliding routes could move with less knock-on. |
| A few snacks along the top of the water under the route (Q2, option B) | It changes the snack layout and the fairness proofs. It is kept as a follow-up in case the push still feels pointless after play-testing. |
| Fix Area 5's pole overlap now (Q3) | It changes a finished area and its golden snapshot. It is tracked as issue #198 and named in the test. |
