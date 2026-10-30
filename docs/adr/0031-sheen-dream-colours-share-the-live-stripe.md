# ADR 0031: Sheen Dream colours share the live stripe

- Status: Accepted
- Date: 2026-10-30
- Amends: [ADR 0013](0013-axolotl-rig-and-frame-budget.md) (in part: its Iridescent-only rig path, its stance that the only live drawing is the Iridescent tail stripe, and its list of rope-bent tail patterns; every other ADR 0013 rule stays in force)
- Related: [ADR 0004](0004-art-pipeline.md) (bake once, so the frame loop stays cheap), [ADR 0028](0028-descent-areas-crayfish-and-dark-water.md) (Area 6, which holds the Crystal shine Paint shell), [ADR 0029](0029-climb-areas-rock-walls-pebble-and-pulsing-currents.md) (Area 7, which holds the Glowworm Paint shell)

This ADR records how the axolotl rig draws more than one sheen Dream colour. It came with the spring cave's two Legendary Dream colours: Crystal shine, a sheen in Area 6, and Glowworm, a patterned colour in Area 7. The art is in the [art style guide](../art-style-guide.md) (3f, 6p, 9).

## Context

Playtests asked for more shimmery Dream colours. Iridescent was the only one, and the rig of [ADR 0013](0013-axolotl-rig-and-frame-budget.md) hard-coded it: the 16 sheen-step body bakes, the tail split into 'under' and `tail-over`, and the live tail stripe were all keyed on the Dream colour id `iridescent`.
ADR 0013's stance was that no texture is repainted after a bake, and that the only live drawing is the Iridescent tail stripe, a vector redraw with no texture upload.

Crystal shine is a teal body with a white and an aqua stripe pair that glides along the body like Iridescent's. Under ADR 0013 the rig had no way to draw it: a hard-coded `iridescent` check would treat it as a static pattern, bake its stripe into the tail and bend it with the rope.

Glowworm is a night-blue body with round glowing dots. It is a static pattern, like Galaxy, so it fits ADR 0013's rig as it is.

## Decision

**A sheen colour is any Dream colour whose swatch pattern is 'stripes'.** `isSheenDream(id)` in `src/art/drawDreamOverlay.ts` is true exactly when `DREAM_SWATCH[id].pattern` is `'stripes'`. Today that is Iridescent and Crystal shine. It replaces every hard-coded Iridescent check in the rig (`src/art/axolotlRig.ts`, `src/art/axolotlRigParts.ts`, `src/art/axolotlRigStripe.ts`).

**Every sheen colour takes the Iridescent path.** Each sheen colour gets, as Iridescent did:

- the body's 16 sheen-step bakes (`SHEEN_STEPS`, one every 0.25 s of the 4 s glide) plus the still frame, with the stripe at x -10;
- a moving tail shown in three layers: the tail baked 'under' (layers 4 to 6.2), the live stripe pair, and `tail-over` (layers 6.5 to 8), bent with the tail;
- the live tail stripe: a flat-colour vector overlay, redrawn only when the sheen colour, the shown tail or the sheen step changes.

The sheen colours glide on the same beat (`IRIDESCENT_GLIDE_S`, 4 s, from x 14 to the look's own tail tip) and hold the same still stripe at x -10 under reduced motion.

**The stripe reads its colour.** `tailStripe(id, ...)` takes the sheen colour and throws for any colour that is not a sheen. Its band fills and clip inset come per colour from `SHEEN_STRIPES`: the colour's `DREAM_SWATCH` marks, light band first, and the 2-unit `DREAM_PATTERN_INSET` only for colours in `DREAM_INSET_IDS`. Iridescent keeps its inset. Crystal shine has none, because both its stripes are lighter than its body, so ink is 3:1 or better against them (guide 6p).

**Glowworm is a rope-bent tail pattern.** Its tail dots bake into the tail like Galaxy's stars. On the WebGL rope they bend with the tail bake: the worst per-column span is 3.68 units at a full dash, so Glowworm joins `ROPE_PATTERN_DREAMS` (Hearts, Tie-dye, Tie-dye galaxy and Glowworm) in `src/art/axolotlRigFidelity.test.ts`, with a bound of 4.

## Consequences

- The per-axolotl budget does not change. An axolotl wears one Dream colour, so it draws at most one live stripe, as before.
- Memory for a sheen axolotl is Iridescent's. In ADR 0013's case (one bake of a Medium axolotl with no outfit, at bake scale 3), a Crystal shine axolotl takes 9.03 MiB on WebGL and 24.03 MiB on Canvas. A Glowworm axolotl takes what a plain or other Dream colour takes, 4.48 MiB and 11.83 MiB.
- A new sheen colour needs no rig code: a `DREAM_SWATCH` entry with pattern `'stripes'` and two marks (`#rrggbb` or `rgba(...)`) gets the bakes, the tail split and the live stripe. Its stripe must stay the two band quads `dreamPatternShapes` gives a sheen; `tailStripe` throws otherwise.
- ADR 0013's stance now reads: no texture is repainted after a bake, and the only live drawing is the sheen Dream tail stripe.
- Fidelity: the live-stripe checks in `src/art/axolotlRigFidelity.test.ts` and `src/art/axolotlRigStripe.test.ts` run for every sheen colour. The body stripe is exact at every sheen step, and the live tail stripe is within 0.1 per column on both renderers, for Iridescent and Crystal shine.
- The leak check gives the live stripe a tolerance: a sample of the `tail-stripe` part leaks only when it is outside the composed silhouette and more than `STRIPE_TOL` (0.1 units) from its edge. With no inset, Crystal shine's live stripe is cut on the Dream clip polygon itself, whose tail edges are chords between tail samples where `drawAxolotl`'s silhouette curves. Its corners sit on the edge or just past it: at most 0.0023 units past, measured on both renderers. Every other pattern part is still held to no leak at all.
- The `tailStripe` measurement item in ADR 0013's follow-ups now covers every sheen colour. It still runs only for a moving sheen axolotl, when the shown tail or the sheen step changes.

## Alternatives considered

| Option | Why not |
|---|---|
| A bespoke rig path per sheen colour | Each new sheen colour would need its own checks in the rig, its own bakes and its own tests, and the paths could drift apart. One rule from the swatch pattern keeps every sheen colour on the measured Iridescent path. |
| Baking the stripe into the tail | ADR 0013 measured this for Iridescent and turned it down. A baked stripe mask on the rope does not survive the shear (about 3 units off at a dash), and Canvas strip frames at every sheen step are 576 frames, about 88 MiB for one Medium axolotl's tail at bake scale 3. The same holds for every sheen colour. |
