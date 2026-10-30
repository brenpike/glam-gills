# ADR 0013: Live axolotls are a rig of baked parts, with a frame-time budget

- Status: Accepted. Amended in part by ADR 0031 (every sheen Dream colour takes the Iridescent path)
- Date: 2026-10-20
- Updated: 2026-10-21. The area framework ([ADR 0014](0014-area-framework.md), issue #73) adds a fourth measured case, the dev test area taller than one screen, and the `?area` dev flag. The decision is unchanged.
- Updated: 2026-10-21. Issues #87 and #88 change the parts table: the Tail and Shirt items move over the near gills, and a Girl's cheek heart joins the `face` part. The decision is unchanged.

## Context

[ADR 0004](0004-art-pipeline.md) bakes each drawing into a texture once, so the frame loop stays cheap. Live axolotls did not follow it.
Every moving axolotl (the canal explorer, the title axolotl, each Home Tank axolotl, the stranded axolotl, and the creator and restyle preview) was one `CanvasTexture` that repainted the whole of `drawAxolotl` for each new pose and uploaded the texture again (`createAxolotlTexture`).
A full repaint is costly on phones, and its cost grows with every look option, Dream colour and Wearable.

Two stopgaps held that cost down:

- **Low frame rate caps.** `SwimScene`, `TitleScene`, `HomeTankScene` and `AxolotlStyler` each had their own copy of a cap: below 45 fps (`LOW_FPS`), an axolotl repainted at most once every 1/30 s.
- **A secondary repaint budget.** `src/logic/repaintBudget.ts` let only one secondary axolotl (Home Tank swimmers, the stranded axolotl) repaint per frame, the one that had waited longest, after at least 0.03 s.

Both stopgaps traded smooth motion for frame time, and neither had a measured target.
There was no frame-time budget to say when the game is fast enough, and no tool to measure it (issue #46).

Phaser 3.90 can bend a texture with a `Rope` or a `Mesh`, but both are WebGL-only. The Canvas renderer, which Phaser falls back to when WebGL is not available, can only show whole frames.

## Decision

**A rig of baked parts.** Each live axolotl is a rig: one `Container` whose children are parts of `drawAxolotl`'s layer order (art style guide 6a), each baked once into its own texture.
The pure half (part specs, bake painters, re-bake keys and the per-frame placement) is in `src/art/axolotlRigParts.ts` and `src/art/axolotlRigStripe.ts`. The Phaser glue is in `src/art/axolotlRig.ts` (`createAxolotlRigBake`, `createAxolotlRigView`).
A pose only moves, turns and swaps frames of baked parts.

Parts, in draw order, with their 6a layers:

| Part | Layers | Shown as |
|---|---|---|
| `gill-far-0` to `gill-far-2` | 1 | Turned about the gill root, nearest flutter frame |
| `leg-0`, `leg-1` (far legs) | 2 | Turned about the leg root |
| `wear-leg-0`, `wear-leg-1` | 2.5 | Their Socks and Feet; only when the outfit wears something on the legs |
| `leg-2`, `leg-3` (near legs) | 3 | Turned about the leg root |
| `wear-leg-2`, `wear-leg-3` | 3.5 | As above |
| `body` | 4 to 8 | The straight-tail bake, clipped to x >= the tail root |
| `tail` | 4 to 8 | Drawn over the body; bent live |
| `tail-over` | 6.5 to 8 | Iridescent only; bent with the tail |
| `gill-near-0` to `gill-near-2` | 9 | As the far gills |
| `tail-item` | 9.2 | Only when a Tail item is worn; rides the shown tail's Tail frame, over the near gills |
| `face` | 9.3 to 11.5 | Shirt item, Neck item, Back item, blush, a Girl's cheek heart (10.2), Head item, mouth, Face item |
| `eyes` | 12 | Nearest blink frame; a Grumpy brow is part of it |
| Twinkles | (glints) | Regeneration and leg-regrowth glints, as pooled sprites from one shared twinkle sheet |

Issues #87 and #88 changed this table. Before them, `body` and `tail` held layers 4 to 8.2 (the Shirt item was 8.2, inside `body`), `tail-item` was 8.5 and came before the near gills, and `face` was 9.5 to 11.5. Now the Tail item (9.2) and the Shirt item (9.3) draw over the near gills, so a near gill never hides them: the near gills come before `tail-item`, and the Shirt is the first layer of `face`. The cheek heart (#87) paints in `face`, after the blush and before the Head item.

**The seam.** The body part holds x >= the tail root. The tail part holds x <= the tail root + 4 (`RIG_SEAM_OVERLAP`), so the two overlap by 4 units, more than the 3.5 unit outline. The tail's bend is 0 at the root.
The tail draws over the body, so the overlap always shows the tail's posed copy, and tail marks that reach past the root (a Patches spot) bend with the tail.

**The tail on WebGL.** The tail is a Phaser `Rope` over the straight-tail bake, with 17 columns (the seam column, the 15 `tailSamples` points, and one past the tip).
The rig writes the rope's vertices and UVs itself: each column keeps its x and moves straight up or down by the tail's bend at that column (`tailShear`), as `drawAxolotl`'s tail does.
The rope's own vertex placement offsets each point along the normal of the rope's path. That tilts the columns on a bent tail, which does not match `drawAxolotl`'s up-and-down wave, so the rig does not use it. `Mesh` is not used either (see Alternatives).

**The tail on Canvas.** `Rope` and `Mesh` are WebGL-only, so on Canvas the tail is a strip of baked frames: 12 swim phases over one swim cycle at 3 tail amplitudes (1, 1.2, and the dash maximum `AXO_MAX_TAIL_AMP`, 1.6), 36 frames. The strip frame nearest the live pose is shown, and the Tail item and the glints follow that shown pose.

**The still pose.** On both renderers, the still pose (`RIG_STILL_POSE`, the pose the scenes show under reduced motion) shows an exact still-tail bake.

**Frames for the other parts.**

- **Gills:** rigid sprites with 10 baked flutter frames over one gill cycle (`GILL_FLUTTER_FRAMES`). Each shows the nearest frame, turned by a small live rotation: the live stem angle less the frame's. Worst residual over 24 phases: stems 0.46 units, filament ends 1.28 (9 frames measured 1.45).
- **Eyes:** 3 frames, open (1), half (0.56) and closed (0.12), shown on the existing blink timing (`blinkAt` in `BootScene`).
- **Legs:** one texture per leg state: present, lost, or regrowing at each of the trip's 10 progress steps (`LEG_PROGRESS_STEPS`). Each is baked the first time it shows and kept with the bake. A lost or regrowing leg wears no sock or shoe.
- **Twinkles:** 13 baked radii, 0.6 to 4.2, shared by every axolotl at the same scale. A view shows at most 17 at once.

**Iridescent.** The body bakes 16 sheen steps (`SHEEN_STEPS`, one every 0.25 s of the 4 s glide) plus a still frame with the stripe at x -10. The still frame shows under reduced motion; picture buttons keep their own still bakes.
A moving Iridescent tail shows in three layers, so its stripe pair is never bent with the tail:

1. the tail baked 'under' (layers 4 to 6.2), bent as above;
2. the stripe pair, drawn live as a flat-colour vector overlay (a Phaser `Graphics`) from polygons that `tailStripe` works out from `drawAxolotl`'s own `dreamPatternShapes` and `dreamClipPolygons`, at the shown tail and sheen step;
3. `tail-over` (layers 6.5 to 8), bent with the tail.

The overlay is redrawn only when the shown tail or the sheen step changes. It repaints no texture and uploads nothing. On Canvas the tail stripe glides too.

**Re-bake keys.** Every part re-bakes when `rigAppearanceKey` changes: every look field (size included, through a `Record` over `AxolotlArtLook` that fails the build until a new field is keyed), the morph palette and Dream colour, the outfit, and the bake scale.
The re-bake is lazy: it runs once, on the next read of the baked parts or before the next frame, however many changes came first.
Each leg part is keyed again per leg by `legStateKey`. A pose never re-bakes.
Picture-button stills keep `bakeAxolotlStill`, one whole `drawAxolotl` bake, repainted only when the look or outfit shown changes.

**Where the rig is used.** The canal explorer and the title axolotl (sharing `BootScene`'s bake), each Home Tank axolotl (one bake each), the stranded axolotl, and the creator and restyle preview.

**Memory.** Estimated texture memory for one bake of a Medium axolotl with no outfit, at bake scale 3 (the largest, `VIEW.bakeScaleMax`), all legs present:

| Renderer | Plain or other Dream colour | Iridescent |
|---|---|---|
| WebGL | 4.48 MiB | 9.03 MiB |
| Canvas | 11.83 MiB | 24.03 MiB |

The twinkle sheet adds 0.17 MiB per scale, shared by every axolotl at that scale. Large axolotls take more, Small ones less. Each extra leg state adds one small leg texture.

**Removed.** `createAxolotlTexture` and `AxolotlTexture`, the four `LOW_FPS` caps (45 fps, 1/30 s) in `SwimScene`, `TitleScene`, `HomeTankScene` and `AxolotlStyler`, and `src/logic/repaintBudget.ts`.
No shared cap replaces them until the measurements below say one is needed.

**Stance.** No texture is repainted after a bake. The only live drawing is the Iridescent tail stripe, which is a vector redraw with no texture upload.

**Dev flags.** Five query flags exist only under `npm run dev`. `src/logic/devFlags.ts` parses them (pure), and `main.ts` loads the dev modules with `import.meta.env.DEV` dynamic imports:

- `?perf` adds the frame-time overlay (`src/scenes/PerfOverlay.ts`). It stores and sends nothing.
- `?compare` runs only the rig compare scene (`src/scenes/RigCompareScene.ts`): `drawAxolotl` painted live beside a rig view in the same pose, with keys to cycle every look option, morph, Dream colour, the full outfit, leg states and the pose, and an overlay toggle at 50% alpha.
- `?renderer=canvas` forces the Canvas renderer.
- `?area=<id>` swims every trip in that dev area (`src/logic/devAreas.ts`, [ADR 0014](0014-area-framework.md)), skipping the area map. Only `dev-test-area` exists.
- `?decor` adds three test Decorations to the Home Tank (`src/logic/devDecorations.ts`, art in `src/art/devDecorationArt.ts`): a Floating lily pad, a Hanging firefly jar and a wide Hanging string of lights. They are owned for the page session only, never saved and never in the Treasure Chest. Their bob and sway are transforms only, with no texture baked again.

None of them is in the `vite build` output: a search of the built files for the marker strings `glam-gills-dev-perf`, `glam-gills-dev-compare`, `glam-gills-dev-flags`, `glam-gills-dev-areas` and `glam-gills-dev-decor`, for the dev area id `dev-test-area`, for the dev Decoration ids `dev/test-*` and for their texture keys `tank-deco-dev-*`, finds nothing, and the build is a single index chunk.

## Budget

`FRAME_BUDGET` in `src/logic/frameStats.ts`:

| Measure | Limit | Where |
|---|---|---|
| p95 frame time | 33 ms (30 fps) | Desktop Chrome with DevTools 6x CPU throttling, the stand-in for a slow phone |
| p95 frame time | 16.7 ms (60 fps) | The owner's phone |
| Axolotl drawing, p95 per frame | 2 ms | The 6x throttled stand-in |

"Axolotl drawing" is the CPU time spent in the rig's `setPose` and in re-bakes each frame (`takeRigFrameMs`). It is timed only in dev builds, and is always 0 in production. It does not include GPU time.

## Method

Four cases, each on WebGL and with `?renderer=canvas`:

1. The canal, with the explorer and a stranded axolotl following on a rescue.
2. The Home Tank with four axolotls.
3. The title screen.
4. The dev test area, 6 x 2 screens, so taller than one screen, with the explorer and a stranded axolotl following on a rescue, while the camera scrolls both ways. It runs in a dev build with `?area=dev-test-area&perf`. The dev area is absent from the production build: a search of `dist` for `glam-gills-dev-areas` finds nothing. Every area is baked at boot ([ADR 0014](0014-area-framework.md)), and the dev area's scenery takes about 33 MB in a dev build, so this case also shows what a large area costs.

`?perf` times each frame from one render to the next, and the rig's share of it. It shows live p50 and p95 twice a second, and logs one line to the console for each 30 s window of frame time (`formatFrameSummary`): frames, p50, p95 and max frame time, axolotl p50 and p95, and bake count.
A window starts again when the running scenes change or the page is hidden.

The canal is measured on `main`'s canal layout at the time this merges. If the treasure looks work has landed by then, the canal case includes a revealed treasure showing. The results note which layout was used.

If the axolotl looks work has landed when the dev area case is measured, the explorer wears an outfit in it.

If a case misses the budget and areas need culling or streaming (drawing or loading only the part of an area near the camera), it must not change the canal's look: the canal shows the same at every point of a trip as it does now.

## Results

The owner runs these. Every cell is to be measured.

| Case | Device | Renderer | p50 | p95 | Axolotl p95 | Bakes |
|---|---|---|---|---|---|---|
| Canal, explorer and rescue | 6x throttled stand-in | WebGL | To be measured | To be measured | To be measured | To be measured |
| Canal, explorer and rescue | 6x throttled stand-in | Canvas | To be measured | To be measured | To be measured | To be measured |
| Canal, explorer and rescue | Owner's phone | WebGL | To be measured | To be measured | To be measured | To be measured |
| Canal, explorer and rescue | Owner's phone | Canvas | To be measured | To be measured | To be measured | To be measured |
| Home Tank, four axolotls | 6x throttled stand-in | WebGL | To be measured | To be measured | To be measured | To be measured |
| Home Tank, four axolotls | 6x throttled stand-in | Canvas | To be measured | To be measured | To be measured | To be measured |
| Home Tank, four axolotls | Owner's phone | WebGL | To be measured | To be measured | To be measured | To be measured |
| Home Tank, four axolotls | Owner's phone | Canvas | To be measured | To be measured | To be measured | To be measured |
| Title screen | 6x throttled stand-in | WebGL | To be measured | To be measured | To be measured | To be measured |
| Title screen | 6x throttled stand-in | Canvas | To be measured | To be measured | To be measured | To be measured |
| Title screen | Owner's phone | WebGL | To be measured | To be measured | To be measured | To be measured |
| Title screen | Owner's phone | Canvas | To be measured | To be measured | To be measured | To be measured |
| Dev test area (6 x 2), explorer and rescue | 6x throttled stand-in | WebGL | To be measured | To be measured | To be measured | To be measured |
| Dev test area (6 x 2), explorer and rescue | 6x throttled stand-in | Canvas | To be measured | To be measured | To be measured | To be measured |
| Dev test area (6 x 2), explorer and rescue | Owner's phone | WebGL | To be measured | To be measured | To be measured | To be measured |
| Dev test area (6 x 2), explorer and rescue | Owner's phone | Canvas | To be measured | To be measured | To be measured | To be measured |

## Measured fidelity

Headless tests in `src/art/axolotlRig.test.ts`, `src/art/axolotlRigFidelity.test.ts` and `src/art/axolotlRigStripe.test.ts` compare the composed rig with `drawAxolotl` over every look. Distances are in axolotl local units.

| Check | Asserted | Measured |
|---|---|---|
| Silhouette envelope | Within 1.0 on WebGL; exact on Canvas | 0.928 on the WebGL rope; 0 on the Canvas strip pose |
| Legs, wear legs, Tail item, twinkles | Within 1e-6 | Float noise (about 1e-14) |
| Keep-clear with a full outfit | 0 failures | 0: no Wearable covers the eyes, lash reach, or (over the silhouette) the gill roots, and the eyes paint last |
| Feet rule | A lost or regrowing leg's wear part paints nothing | Holds |
| Dream markers | Within 1.0 on WebGL; exact on Canvas | 0.283 on WebGL; 0 on Canvas |
| Dream pattern leaks outside the silhouette | 0 | 0 |
| Iridescent tail stripe, per column | Within 0.1 on both renderers | About 4e-14 |
| Still pose | Equals `drawAxolotl` within 1e-6 | Holds on both renderers |
| Seam guard | No body mark changes with the tail pose past the tail root + 4 | Holds |

Accepted approximations, each bounded by an asserted test, to confirm by eye in `?compare`:

- On the WebGL rope, the interior Dream patterns of the tail bend with the tail bake rather than sitting on the live tail. At a full dash, the worst per-column spans are Hearts 4.88, Tie-dye 12.38, Tie-dye galaxy 2.37 and Glowworm 3.68 (Glowworm since ADR 0031).
- The ink outline thins a little on the steepest bends of the rope tail.
- Gill flutter is quantized to 10 frames, with a small live turn.
- The Iridescent sheen steps every 0.25 s.
- The Canvas tail steps through 12 phases and 3 amplitudes.
- Twinkle radii are quantized to 13 values.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep repainting each pose, with the repaint budget and the low frame rate caps | The cost of a full repaint and texture upload grows with every look option and Wearable, and the caps lowered the axolotls' frame rate on exactly the slow devices they were meant to help. |
| Full-frame atlases of whole axolotls | Every look, Dream colour and outfit times every pose is far too many frames to bake or hold in memory. |
| Phaser `Mesh` for the tail | WebGL-only, like `Rope`, so Canvas still needs the strip. The tail bends as one strip of columns, which a `Rope` with written vertices already shows. |
| `Rope` with its own perpendicular offsets | Offsets each point along the path's normal, which tilts the columns on a bent tail. `drawAxolotl` moves each column straight up and down. |
| Bitmap or Geometry masks for the stripe | Children of a `Container` cannot be masked in Phaser 3.90, and every part is a child of the rig's `Container`. |
| A baked stripe mask on a rope | The inset Dream clip does not survive the shear: about 3 units off at a dash. |
| Canvas strip frames at every sheen step | 36 tail frames x 16 sheen steps is 576 frames, about 88 MiB for one Medium axolotl's tail alone at bake scale 3. |
| A `RenderTexture` redrawn every frame | A texture repaint every frame, which is the cost this decision removes. |
| Bending the art's stripe with the tail | Changes the Iridescent look in art style guide 6p, where the stripe is two straight bands the waving tail swims through. |

## Consequences

- A pose costs moving, turning and frame swaps, plus one vector redraw for a moving Iridescent tail. No texture is repainted or uploaded after a bake.
- Changing a look, Dream colour, outfit or bake scale re-bakes the whole rig once, lazily: on the next read of the baked parts or before the next frame, however many changes came first. A regrowing leg re-bakes one small leg texture at each of 10 progress steps, never every frame.
- Canvas bakes take more memory than WebGL (the 36-frame tail strip), and Iridescent about doubles both.
- Every frame of a part is painted by `drawAxolotl`'s own painters, so the rig follows the art style guide with no second copy of the art.
- A new look field fails the build until `rigAppearanceKey` keys it.
- Atlases from vector source art ([ADR 0004](0004-art-pipeline.md), guide section 11) are still later.

Follow-ups:

- The owner runs the measurements above on the 6x throttled stand-in and on the phone, and fills in the results.
- If a case misses the budget, add one shared cap in `src/logic/` for every scene, not one copy per scene.
- `tailStripe` costs roughly 0.4 to 0.8 ms per call in Node, unthrottled, and runs only when the shown tail or sheen step changes. It is a measurement item. If it shows up in axolotl drawing time, the next step is to cache the Dream clip polygons per look.
