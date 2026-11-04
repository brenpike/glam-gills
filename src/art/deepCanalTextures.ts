/**
 * Phaser glue for the deep canal props (issue #78): bakes the gliding trajinera hull and its leading
 * shadow, the moored shade, the moored hulls and the sunken old trajinera hull cave's back and
 * front into CanvasTextures. The old canal-bed stones are painted into the background chunks
 * (drawDeepCanal.ts paintCanalBedStones), and the side-canal inflow marks are the spring outflow's
 * texture (springCaveTextures.ts), so neither has a texture here. It also bakes Area 9's murky water
 * (issue #107, ND-1: each patch size's still, swirl and outline frames, the dim ring, the meter,
 * the cheek tint and the bubbles) and bailing bucket (ND-2: the boat, the bucket and its front
 * wall, the shadow, the ripples and the splash), so the deep canal bake covers them too. Area 10's
 * fishing trajinera (issue #108, ND-1: the hull, the rod, the shadow, the float bead and the lure)
 * and drag net (ND-2: the boat, the float, the lit float, the strands, one curtain per stretch
 * height and one hollow shade per hollow size) are baked only when some area has fishing boats or
 * drag nets. A lure's line and a net's float line are drawn live, never baked.
 * Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: every texture is drawn at `bakeScale` through the context transform,
 * so the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import { AREAS, type AreaData } from '../logic/areas';
import type { DragNetSpawn } from '../logic/dragNets';
import { murkyPatches } from '../logic/murkyWater';
import { SURF } from '../logic/zone';
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
  DRAG_NET_BOAT_TEX,
  DRAG_NET_FLOAT_LIT_TEX,
  DRAG_NET_FLOAT_TEX,
  DRAG_NET_STRANDS_TEX,
  dragNetCurtainTex,
  dragNetHollowShadeTex,
  paintDragNetBoat,
  paintDragNetCurtain,
  paintDragNetFloat,
  paintDragNetFloatLit,
  paintDragNetHollowShade,
  paintDragNetStrands,
} from './drawDragNet';
import {
  FISHING_BEAD_TEX,
  FISHING_BOAT_TEX,
  FISHING_LURE_TEX,
  FISHING_ROD_TEX,
  FISHING_SHADOW_TEX,
  paintFishingBead,
  paintFishingBoat,
  paintFishingLure,
  paintFishingRod,
  paintFishingShadow,
} from './drawFishingTrajinera';
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
  fishingBoat: 'deep-canal-fishing-boat',
  fishingRod: 'deep-canal-fishing-rod',
  fishingShadow: 'deep-canal-fishing-shadow',
  fishingBead: 'deep-canal-fishing-bead',
  fishingLure: 'deep-canal-fishing-lure',
  netBoat: 'deep-canal-net-boat',
  netFloat: 'deep-canal-net-float',
  netFloatLit: 'deep-canal-net-float-lit',
  netStrands: 'deep-canal-net-strands',
} as const;

/** Prefix of a drag net curtain's key (issue #108, ND-2): it ends with the curtain's height, `deep-canal-net-curtain-<h>`. */
export const NET_CURTAIN_KEY_PREFIX = 'deep-canal-net-curtain-';

/** Prefix of a drag net hollow shade's key (issue #108, ND-2): it ends with the hollow's size, `deep-canal-net-hollow-<w>x<h>`. */
export const NET_HOLLOW_KEY_PREFIX = 'deep-canal-net-hollow-';

/** The key a drag net hollow shade `w` x `h` logical px is found by in DragNetTextures.hollowShades. */
export function netHollowSizeKey(w: number, h: number): string {
  return `${w}x${h}`;
}

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

/** The fishing trajinera art (issue #108, ND-1), each in its drawFishingTrajinera.ts frame and anchor. */
export interface FishingTrajineraTextures {
  /** The hull (FISHING_BOAT_TEX, depth DEPTH.fishingBoat). Anchor is the middle of the hull on the water line. Never mirrored. */
  readonly boat: TexInfo;
  /** A rod (FISHING_ROD_TEX, depth DEPTH.fishingBoat), leaning to +x. Anchor is its holder; mirror it for the hull's left end. */
  readonly rod: TexInfo;
  /** The always-shown shadow (FISHING_SHADOW_TEX, depth DEPTH.fishingShadow). Same anchor as the hull. */
  readonly shadow: TexInfo;
  /** A line's float bead (FISHING_BEAD_TEX, depth DEPTH.fishingLure). Anchor is its centre, on the water line at the lure's x. */
  readonly bead: TexInfo;
  /** A lure (FISHING_LURE_TEX, depth DEPTH.fishingLure). Anchor is the worm's centre, at the lure's drawn position. */
  readonly lure: TexInfo;
}

/** The drag net art (issue #108, ND-2), each in its drawDragNet.ts frame and anchor. */
export interface DragNetTextures {
  /** A net boat (DRAG_NET_BOAT_TEX, depth DEPTH.dragNetBoat). Anchor is the middle of the hull on the water line. */
  readonly boat: TexInfo;
  /** A cork float (DRAG_NET_FLOAT_TEX, depth DEPTH.dragNetFloats). Anchor is its centre, on the rope. */
  readonly float: TexInfo;
  /** A lit float, the reduced-motion warning (DRAG_NET_FLOAT_LIT_TEX, depth DEPTH.dragNetFloats). Same anchor as `float`. */
  readonly floatLit: TexInfo;
  /** The wriggle-out strands (DRAG_NET_STRANDS_TEX, depth DEPTH.fx). Anchor is the caught axolotl's centre. */
  readonly strands: TexInfo;
  /**
   * One flat curtain (dragNetCurtainTex, depth DEPTH.dragNetMesh) per curtain height in the areas,
   * keyed by the height (dragNetCurtainHeight). Anchor is the top of the leading edge on the water
   * line. Painted for a sweep to the right: mirror it for a sweep to the left.
   */
  readonly curtains: ReadonlyMap<number, TexInfo>;
  /** One hollow shade (dragNetHollowShadeTex, depth DEPTH.dragNetMesh) per hollow size in the areas, keyed by netHollowSizeKey. Anchor is its top-left corner. */
  readonly hollowShades: ReadonlyMap<string, TexInfo>;
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
  /** Area 10's fishing trajinera (issue #108, ND-1), or null when no area has fishing boats. */
  readonly fishingTrajinera: FishingTrajineraTextures | null;
  /** Area 10's drag net (issue #108, ND-2), or null when no area has drag nets. */
  readonly dragNet: DragNetTextures | null;
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

/** Whether any of `areas` has a fishing trajinera (issue #108, ND-1). */
export function hasFishingBoats(areas: readonly Readonly<AreaData>[]): boolean {
  return areas.some((area) => (area.layout.fishingBoats ?? []).length > 0);
}

/** Every drag net in `areas`, in area order and then data order (issue #108, ND-2). */
function dragNetsOf(areas: readonly Readonly<AreaData>[]): Readonly<DragNetSpawn>[] {
  return areas.flatMap((area) => area.layout.dragNets ?? []);
}

/**
 * The height in logical px of a net's curtain (issue #108, ND-2, guide 7p): from the float line on
 * the water line (SURF) down to the stretch's bottom edge.
 */
export function dragNetCurtainHeight(net: Readonly<DragNetSpawn>): number {
  return net.dragNet.stretch.y1 - SURF;
}

/** The curtain height of every drag net in `areas`, each height once, in first-use order. */
export function dragNetCurtainHeights(areas: readonly Readonly<AreaData>[]): number[] {
  return [...new Set(dragNetsOf(areas).map(dragNetCurtainHeight))];
}

/** The [w, h] in logical px of every drag net hollow in `areas`, each size once, in first-use order. */
export function dragNetHollowSizes(areas: readonly Readonly<AreaData>[]): [number, number][] {
  const sizes = new Map<string, [number, number]>();
  for (const net of dragNetsOf(areas)) {
    for (const hollow of net.dragNet.hollows) {
      const size: [number, number] = [hollow.x1 - hollow.x0, hollow.y1 - hollow.y0];
      sizes.set(netHollowSizeKey(...size), size);
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

/** Bake the fishing trajinera art (issue #108, ND-1). */
function bakeFishingTrajinera(scene: Phaser.Scene, bakeScale: number): FishingTrajineraTextures {
  return {
    boat: bake(scene, DEEP_CANAL_TEX.fishingBoat, FISHING_BOAT_TEX, bakeScale, paintFishingBoat),
    rod: bake(scene, DEEP_CANAL_TEX.fishingRod, FISHING_ROD_TEX, bakeScale, paintFishingRod),
    shadow: bake(scene, DEEP_CANAL_TEX.fishingShadow, FISHING_SHADOW_TEX, bakeScale, paintFishingShadow),
    bead: bake(scene, DEEP_CANAL_TEX.fishingBead, FISHING_BEAD_TEX, bakeScale, paintFishingBead),
    lure: bake(scene, DEEP_CANAL_TEX.fishingLure, FISHING_LURE_TEX, bakeScale, paintFishingLure),
  };
}

/** Bake one flat drag net curtain `h` logical px tall (issue #108, ND-2). Throws RangeError for a height dragNetCurtainTex refuses. */
function bakeDragNetCurtain(scene: Phaser.Scene, bakeScale: number, h: number): TexInfo {
  return bake(scene, `${NET_CURTAIN_KEY_PREFIX}${h}`, dragNetCurtainTex(h), bakeScale, (ctx) => paintDragNetCurtain(ctx, h));
}

/** Bake one drag net hollow shade `w` x `h` logical px (issue #108, ND-2). Throws RangeError for a size dragNetHollowShadeTex refuses. */
function bakeDragNetHollowShade(scene: Phaser.Scene, bakeScale: number, w: number, h: number): TexInfo {
  const key = `${NET_HOLLOW_KEY_PREFIX}${netHollowSizeKey(w, h)}`;
  return bake(scene, key, dragNetHollowShadeTex(w, h), bakeScale, (ctx) => paintDragNetHollowShade(ctx, w, h));
}

/** Bake the drag net art (issue #108, ND-2): one curtain per height and one hollow shade per size of the nets in `areas`. */
function bakeDragNet(scene: Phaser.Scene, bakeScale: number, areas: readonly Readonly<AreaData>[]): DragNetTextures {
  const curtains = new Map<number, TexInfo>();
  for (const h of dragNetCurtainHeights(areas)) curtains.set(h, bakeDragNetCurtain(scene, bakeScale, h));
  const hollowShades = new Map<string, TexInfo>();
  for (const [w, h] of dragNetHollowSizes(areas)) {
    hollowShades.set(netHollowSizeKey(w, h), bakeDragNetHollowShade(scene, bakeScale, w, h));
  }
  return {
    boat: bake(scene, DEEP_CANAL_TEX.netBoat, DRAG_NET_BOAT_TEX, bakeScale, paintDragNetBoat),
    float: bake(scene, DEEP_CANAL_TEX.netFloat, DRAG_NET_FLOAT_TEX, bakeScale, paintDragNetFloat),
    floatLit: bake(scene, DEEP_CANAL_TEX.netFloatLit, DRAG_NET_FLOAT_LIT_TEX, bakeScale, paintDragNetFloatLit),
    strands: bake(scene, DEEP_CANAL_TEX.netStrands, DRAG_NET_STRANDS_TEX, bakeScale, paintDragNetStrands),
    curtains,
    hollowShades,
  };
}

/**
 * Bake the deep canal props at `bakeScale` texture pixels per logical unit, with one set of murky
 * patch frames for each of `murkyPatchSizesToBake`, [w, h] in logical px: by default every patch
 * size in AREAS. The fishing trajinera art is baked only when some area of `lureNetAreas` (by
 * default AREAS) has fishing boats, and the drag net art only when some has drag nets, with one
 * curtain per height and one hollow shade per size of its nets; else each is null. Throws
 * RangeError for a patch size murkyPatchTex refuses, or a curtain height or hollow size the drag net
 * art refuses.
 */
export function bakeDeepCanalTextures(
  scene: Phaser.Scene,
  bakeScale: number,
  murkyPatchSizesToBake: readonly (readonly [number, number])[] = murkyPatchSizes(AREAS),
  lureNetAreas: readonly Readonly<AreaData>[] = AREAS,
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
    fishingTrajinera: hasFishingBoats(lureNetAreas) ? bakeFishingTrajinera(scene, bakeScale) : null,
    dragNet: dragNetsOf(lureNetAreas).length > 0 ? bakeDragNet(scene, bakeScale, lureNetAreas) : null,
  };
}
