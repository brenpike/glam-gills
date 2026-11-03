/**
 * Phaser glue for the deep canal props (issue #78): bakes the gliding trajinera hull and its leading
 * shadow, the moored shade, the moored hulls and the sunken old trajinera hull cave's back and
 * front into CanvasTextures. The old canal-bed stones are painted into the background chunks
 * (drawDeepCanal.ts paintCanalBedStones), and the side-canal inflow marks are the spring outflow's
 * texture (springCaveTextures.ts), so neither has a texture here. It also bakes Area 9's murky water
 * (issue #107, ND-1: each patch size's still, swirl and outline frames, the dim ring, the meter,
 * the cheek tint and the bubbles) and bailing bucket (ND-2: the boat, the bucket and its front
 * wall, the shadow, the ripples and the splash), so the deep canal bake covers them too.
 * Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the context transform,
 * so the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import { AREAS, type AreaData } from '../logic/areas';
import { murkyPatches } from '../logic/murkyWater';
import {
  BAILING_BOAT_TEX,
  BAILING_BUCKET_FRONT_TEX,
  BAILING_BUCKET_TEX,
  BAILING_RIPPLES_TEX,
  BAILING_SHADOW_TEX,
  BAILING_SPLASH_TEX,
  paintBailingBoat,
  paintBailingBucket,
  paintBailingBucketFront,
  paintBailingRipples,
  paintBailingShadow,
  paintBailingSplash,
} from './drawBailingBucket';
import {
  HULL_CAVE_TEX,
  MOORED_HULL_BANDS,
  MOORED_HULL_TEX,
  MOORED_TEX,
  TRAJINERA_HULL_TEX,
  TRAJINERA_SHADOW_TEX,
  paintHullCaveBack,
  paintHullCaveFront,
  paintMooredHull,
  paintMooredShade,
  paintTrajineraHull,
  paintTrajineraShadow,
} from './drawDeepCanal';
import {
  MURKY_BUBBLES_TEX,
  MURKY_CHEEKS_TEX,
  MURKY_DIM_TEX,
  MURKY_METER_TEX,
  MURKY_SWIRL_FRAMES,
  murkyPatchTex,
  paintMurkyBubbles,
  paintMurkyCheeks,
  paintMurkyDimRing,
  paintMurkyMeter,
  paintMurkyOutline,
  paintMurkyStill,
  paintMurkySwirl,
} from './drawMurkyWater';
import { bake, type TexInfo } from './textures';

/** Fixed texture keys of the deep canal props. */
export const DEEP_CANAL_TEX = {
  trajineraHull: 'deep-canal-trajinera-hull',
  trajineraShadow: 'deep-canal-trajinera-shadow',
  mooredShade: 'deep-canal-moored-shade',
  hullCaveBack: 'deep-canal-hull-cave-back',
  hullCaveFront: 'deep-canal-hull-cave-front',
  bailingBoat: 'deep-canal-bailing-boat',
  bailingBucket: 'deep-canal-bailing-bucket',
  bailingBucketFront: 'deep-canal-bailing-bucket-front',
  bailingShadow: 'deep-canal-bailing-shadow',
  bailingRipples: 'deep-canal-bailing-ripples',
  bailingSplash: 'deep-canal-bailing-splash',
  murkyDimRing: 'deep-canal-murky-dim-ring',
  murkyMeter: 'deep-canal-murky-meter',
  murkyCheeks: 'deep-canal-murky-cheeks',
  murkyBubbles: 'deep-canal-murky-bubbles',
} as const;

/**
 * Prefix of a murky patch's keys (issue #107, ND-1): each ends with the patch's size
 * (murkyPatchSizeKey), then `-still`, `-outline` or `-swirl-<frame>`.
 */
export const MURKY_PATCH_KEY_PREFIX = 'deep-canal-murky-patch-';

/** The key a murky patch `w` x `h` logical px is found by in MurkyWaterTextures.patches. */
export function murkyPatchSizeKey(w: number, h: number): string {
  return `${w}x${h}`;
}

/** Prefix of a moored hull's key: one texture per band order, `deep-canal-moored-hull-<variant>`. */
export const MOORED_HULL_KEY_PREFIX = 'deep-canal-moored-hull-';

/** The key the moored hull of band order `variant` (an index into MOORED_HULL_BANDS) is baked under. */
export function mooredHullKey(variant: number): string {
  return `${MOORED_HULL_KEY_PREFIX}${variant}`;
}

/** The sunken hull cave back and front: the same frame, HULL_CAVE_TEX (the cave's CAVE_W x CAVE_H). */
export interface HullCaveTextures {
  /** Dark interior (depth DEPTH.caveBack). Anchor is the base centre on the bed, the same as the cave. */
  readonly back: TexInfo;
  /** The upturned old hull (depth DEPTH.caveFront). Same frame and anchor as `back`. */
  readonly front: TexInfo;
}

/** One murky patch size's frames (issue #107, ND-1): all in murkyPatchTex, anchored at the patch's centre, drawn at 1:1. */
export interface MurkyPatchTextures {
  /** The cloud with no swirl, for reduced motion. */
  readonly still: TexInfo;
  /** The cloud's swirl loop, MURKY_SWIRL_FRAMES frames in loop order. */
  readonly swirl: readonly TexInfo[];
  /** The dotted outline, the same in every frame, drawn over the cloud. */
  readonly outline: TexInfo;
}

/** The murky water art (issue #107, ND-1). */
export interface MurkyWaterTextures {
  /** Every patch size in the areas, keyed by murkyPatchSizeKey. */
  readonly patches: ReadonlyMap<string, MurkyPatchTextures>;
  /** The dim ring round the axolotl in a patch (MURKY_DIM_TEX). Anchor is the axolotl's centre. */
  readonly dimRing: TexInfo;
  /** The ring meter at share 0 (MURKY_METER_TEX); bakeMurkyMeter re-bakes it at another share. Anchor is its centre. */
  readonly meter: TexInfo;
  /** The warning's cheek tint (MURKY_CHEEKS_TEX), in the axolotl's local units. Anchor is the axolotl's local origin. */
  readonly cheeks: TexInfo;
  /** The warning's bubble cluster (MURKY_BUBBLES_TEX). Anchor is the cluster's centre. */
  readonly bubbles: TexInfo;
}

/** The bailing bucket art (issue #107, ND-2), each in its drawBailingBucket.ts frame and anchor. */
export interface BailingBucketTextures {
  /** The moored bailing boat (BAILING_BOAT_TEX). Anchor is the middle of the hull on the water line. */
  readonly boat: TexInfo;
  /** The whole bucket on its rope (BAILING_BUCKET_TEX). Anchor is the middle of the rim ellipse. */
  readonly bucket: TexInfo;
  /** The bucket's front wall and rim (BAILING_BUCKET_FRONT_TEX), over a peeking axolotl. Same anchor as `bucket`. */
  readonly front: TexInfo;
  /** The warning's bucket-shaped shadow (BAILING_SHADOW_TEX). Anchor is the middle of its rim ellipse. */
  readonly shadow: TexInfo;
  /** The warning's broken ripple rings (BAILING_RIPPLES_TEX). Anchor is their centre. */
  readonly ripples: TexInfo;
  /** The landing splash ring (BAILING_SPLASH_TEX). Anchor is the landing point. */
  readonly splash: TexInfo;
}

export interface DeepCanalTextures {
  /**
   * The gliding trajinera hull (TRAJINERA_HULL_TEX). Anchor is the top-centre of the hull's rect, on
   * the water line. The prow is at +x: mirror the sprite for a boat that glides left.
   */
  readonly trajineraHull: TexInfo;
  /**
   * The gliding trajinera's leading shadow (TRAJINERA_SHADOW_TEX). Same anchor as the hull: the
   * middle of the footprint's length, on the water line. Its chevrons point +x: mirror it for a boat
   * that glides left.
   */
  readonly trajineraShadow: TexInfo;
  /**
   * The shade under the moored boats (depth DEPTH.caveFront, above hidden treasure icons).
   * MOORED_TEX, nominal MOORED_W x MOORED_H logical px (440 x 60): anchor is the top-left corner of
   * the zone's bank overhang rect, so place it at (x0, y0) and stretch it to the rect's size.
   */
  readonly mooredShade: TexInfo;
  /**
   * One moored hull per band order of MOORED_HULL_BANDS, in that order (MOORED_HULL_TEX, depth
   * DEPTH.caveFront, over the shade). Anchor is the hull's left end on the water line; shown at 1:1,
   * never stretched.
   */
  readonly mooredHulls: readonly TexInfo[];
  /** The sunken old trajinera hull, the cave of Area 8. */
  readonly hullCave: HullCaveTextures;
  /** Area 9's murky water (issue #107, ND-1). */
  readonly murkyWater: MurkyWaterTextures;
  /** Area 9's bailing bucket (issue #107, ND-2). */
  readonly bailingBucket: BailingBucketTextures;
}

/** The [w, h] in logical px of every murky patch in `areas`, each size once, in first-use order. */
export function murkyPatchSizes(areas: readonly Readonly<AreaData>[]): [number, number][] {
  const sizes = new Map<string, [number, number]>();
  for (const area of areas) {
    for (const { shape } of murkyPatches(area.layout.hazards)) {
      const size: [number, number] = [shape.x1 - shape.x0, shape.y1 - shape.y0];
      sizes.set(murkyPatchSizeKey(...size), size);
    }
  }
  return [...sizes.values()];
}

/** Bake one murky patch size's still, swirl and outline frames. Throws RangeError for a size murkyPatchTex refuses. */
function bakeMurkyPatch(scene: Phaser.Scene, bakeScale: number, w: number, h: number): MurkyPatchTextures {
  const prefix = `${MURKY_PATCH_KEY_PREFIX}${murkyPatchSizeKey(w, h)}`;
  const tex = murkyPatchTex(w, h);
  return {
    still: bake(scene, `${prefix}-still`, tex, bakeScale, (ctx) => paintMurkyStill(ctx, w, h)),
    swirl: Array.from({ length: MURKY_SWIRL_FRAMES }, (_, frame) =>
      bake(scene, `${prefix}-swirl-${frame}`, tex, bakeScale, (ctx) => paintMurkySwirl(ctx, w, h, frame)),
    ),
    outline: bake(scene, `${prefix}-outline`, tex, bakeScale, (ctx) => paintMurkyOutline(ctx, w, h)),
  };
}

/**
 * Bake (re-bake under the same key, DEEP_CANAL_TEX.murkyMeter) the murky meter at `share` of full
 * (0 to 1, held to that range by paintMurkyMeter), for a scene that shows the timer building.
 */
export function bakeMurkyMeter(scene: Phaser.Scene, bakeScale: number, share: number): TexInfo {
  return bake(scene, DEEP_CANAL_TEX.murkyMeter, MURKY_METER_TEX, bakeScale, (ctx) => paintMurkyMeter(ctx, share));
}

/** Bake the murky water art, one set of patch frames per size in `patchSizes` (each size once). */
function bakeMurkyWater(scene: Phaser.Scene, bakeScale: number, patchSizes: readonly (readonly [number, number])[]): MurkyWaterTextures {
  const patches = new Map<string, MurkyPatchTextures>();
  for (const [w, h] of patchSizes) {
    const key = murkyPatchSizeKey(w, h);
    if (!patches.has(key)) patches.set(key, bakeMurkyPatch(scene, bakeScale, w, h));
  }
  return {
    patches,
    dimRing: bake(scene, DEEP_CANAL_TEX.murkyDimRing, MURKY_DIM_TEX, bakeScale, paintMurkyDimRing),
    meter: bakeMurkyMeter(scene, bakeScale, 0),
    cheeks: bake(scene, DEEP_CANAL_TEX.murkyCheeks, MURKY_CHEEKS_TEX, bakeScale, paintMurkyCheeks),
    bubbles: bake(scene, DEEP_CANAL_TEX.murkyBubbles, MURKY_BUBBLES_TEX, bakeScale, paintMurkyBubbles),
  };
}

/** Bake the bailing bucket art. */
function bakeBailingBucket(scene: Phaser.Scene, bakeScale: number): BailingBucketTextures {
  return {
    boat: bake(scene, DEEP_CANAL_TEX.bailingBoat, BAILING_BOAT_TEX, bakeScale, paintBailingBoat),
    bucket: bake(scene, DEEP_CANAL_TEX.bailingBucket, BAILING_BUCKET_TEX, bakeScale, paintBailingBucket),
    front: bake(scene, DEEP_CANAL_TEX.bailingBucketFront, BAILING_BUCKET_FRONT_TEX, bakeScale, paintBailingBucketFront),
    shadow: bake(scene, DEEP_CANAL_TEX.bailingShadow, BAILING_SHADOW_TEX, bakeScale, paintBailingShadow),
    ripples: bake(scene, DEEP_CANAL_TEX.bailingRipples, BAILING_RIPPLES_TEX, bakeScale, paintBailingRipples),
    splash: bake(scene, DEEP_CANAL_TEX.bailingSplash, BAILING_SPLASH_TEX, bakeScale, paintBailingSplash),
  };
}

/**
 * Bake the deep canal props at `bakeScale` texture pixels per logical unit, with one set of murky
 * patch frames for each of `murkyPatchSizesToBake`, [w, h] in logical px: by default every patch
 * size in AREAS. Throws RangeError for a patch size murkyPatchTex refuses.
 */
export function bakeDeepCanalTextures(
  scene: Phaser.Scene,
  bakeScale: number,
  murkyPatchSizesToBake: readonly (readonly [number, number])[] = murkyPatchSizes(AREAS),
): DeepCanalTextures {
  return {
    trajineraHull: bake(scene, DEEP_CANAL_TEX.trajineraHull, TRAJINERA_HULL_TEX, bakeScale, paintTrajineraHull),
    trajineraShadow: bake(scene, DEEP_CANAL_TEX.trajineraShadow, TRAJINERA_SHADOW_TEX, bakeScale, paintTrajineraShadow),
    mooredShade: bake(scene, DEEP_CANAL_TEX.mooredShade, MOORED_TEX, bakeScale, paintMooredShade),
    mooredHulls: MOORED_HULL_BANDS.map((bands, variant) =>
      bake(scene, mooredHullKey(variant), MOORED_HULL_TEX, bakeScale, (ctx) => paintMooredHull(ctx, bands)),
    ),
    hullCave: {
      back: bake(scene, DEEP_CANAL_TEX.hullCaveBack, HULL_CAVE_TEX, bakeScale, paintHullCaveBack),
      front: bake(scene, DEEP_CANAL_TEX.hullCaveFront, HULL_CAVE_TEX, bakeScale, paintHullCaveFront),
    },
    murkyWater: bakeMurkyWater(scene, bakeScale, murkyPatchSizesToBake),
    bailingBucket: bakeBailingBucket(scene, bakeScale),
  };
}
