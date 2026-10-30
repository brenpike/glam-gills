/**
 * Axolotl rig parts (issue #46): the pure half of the rig of baked parts. Each
 * part is a piece of drawAxolotl's layer order (guide 6a) baked once into its
 * own texture and moved live by the glue in axolotlRig.ts: gills and legs turn
 * about their roots, the tail bends along tailSamples, the eyes swap blink
 * frames, and twinkles are small sprites. This module holds the part specs
 * (pivots and ink boxes), the bake painters, the re-bake keys and the per-frame
 * placement. No Phaser here, no game state, no randomness.
 *
 * Every part paints in axolotl local units (facing right, guide 6a); the glue
 * maps a part's pivot to its texture anchor (pivotOffset from the box top-left).
 * The tail and the body are paintBodyLayers split at the tail root: the tail
 * part holds x <= rootX + RIG_SEAM_OVERLAP and the body part x >= rootX, so the
 * seam overlaps by more than the outline width (LW) and the tail's bend is 0 there.
 * The body draws first and the tail over it, so the overlap always shows the
 * tail's posed copy (still bake, rope or strip) and never the body's straight
 * one: tail marks that reach past the root (a Patches spot) bend with the tail.
 *
 * A sheen Dream tail (isSheenDream: Iridescent, Crystal shine) that moves
 * shows in three layers, so its stripe pair is never bent: the tail part
 * baked 'under' (layers 4 to 6.2), then the stripe
 * pair drawn live from rigPlacement's `stripe` polygons (tailStripe at the
 * shown tail), then the 'tail-over' part (6.5 to 8, the BodyLayers 'over'
 * split). The still tail shows its full bake (the still stripe at x -10). The
 * tail has no sheen variant; the body bakes the 16 sheen steps and the still stripe.
 */
import { TAU } from './canvasKit';
import {
  AXO_MAX_TAIL_AMP,
  GLINT_ARM_OL,
  GLINT_ARM_W,
  GLINT_MIN_R,
  REGEN_GLINT_R,
  legGlintRadius,
  legGlintSpots,
  legInkBounds,
  paintAxolotlLeg,
  paintBodyLayers,
  paintEyes,
  paintFaceLayers,
  paintTwinkle,
  regenGlintRadius,
  regenGlintSpots,
  type AxolotlPose,
  type BodyLayers,
  type LegLook,
} from './drawAxolotl';
import {
  CHEEK_HEART_ZONE,
  FAR_EYE,
  FAR_LASH_REACH,
  GILL_FILAMENT_OL,
  GILL_FILAMENT_W,
  GILL_STEM_OL,
  GILL_STEM_W,
  GLASSES_EXTENT,
  HEAD_ELLIPSE,
  HEAD_FOOTPRINT,
  MOUTH_ZONE,
  NEAR_EYE,
  NEAR_LASH_REACH,
  NECK_FOOTPRINT,
  TAIL_SEGMENTS,
  axolotlBodyGeometry,
  backFootprint,
  boundsOfPoints,
  feetEnvelope,
  gillGeometry,
  gillSpecs,
  grumpyBrowInkBounds,
  legAngle,
  legRectBounds,
  legSlotFrames,
  paintGill,
  shirtGeometry,
  sockSleeveBounds,
  tailPointAt,
  tailSamples,
  tailSlotBounds,
  tailSlotFrame,
  unionBounds,
  type AxolotlArtLook,
  type AxolotlBodyGeometry,
  type BodyEllipse,
  type Bounds,
  type GillLayer,
  type GillSpec,
  type LocalPoint,
  type TailSample,
  type WearFrame,
  type ZoneCircle,
} from './drawAxolotlParts';
import { outfitKey, paintBodyWearable, paintLegWearables, wearsOnLegs, wornSlug, type ArtOutfit } from './drawWearables';
import { tailStripe, type TailStripe } from './axolotlRigStripe';
import { isSheenDream } from './drawDreamOverlay';
import { LW, T_STATIC, type DreamLookId, type MorphPalette } from './palette';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The still pose every part is baked at (guide 9): tail and gills at
 * t = T_STATIC on the 1.2 s swim and 0.8 s gill cycles, eyes open. The same
 * expressions the scenes use for their reduced-motion still pose.
 */
export const RIG_STILL_POSE: AxolotlPose = Object.freeze({
  swimPhase: (TAU * T_STATIC) / 1.2,
  gillPhase: (TAU * T_STATIC) / 0.8,
  blink: 1,
  tailAmp: 1,
  sparkle: 0,
});

/** The tail part reaches this far past the tail root, over the body part (at least LW). */
export const RIG_SEAM_OVERLAP = 4;
/** Empty units round every part's ink inside its box (guide 11). */
export const RIG_PAD = 4;
/** Canvas tail strip: swim phases over one cycle, from the still phase. */
export const TAIL_STRIP_PHASES = 12;
/** Canvas tail strip: tail amplitudes, normal to dashing. */
export const TAIL_STRIP_AMPS: readonly number[] = [1, 1.2, AXO_MAX_TAIL_AMP];
/** Eye frames: open, half and closed eye heights (AxolotlPose.blink). */
export const EYE_FRAME_BLINKS: readonly number[] = [1, 0.56, 0.12];
/** Gill flutter frames over one gill cycle, from the still phase. */
export const GILL_FLUTTER_FRAMES = 10;
/** Sheen steps over one glide (AxolotlPose.sheen is a phase in [0, 1)). */
export const SHEEN_STEPS = 16;
/** Twinkle arm radii, 0.6 to 4.2 by 0.3 (13 frames). */
export const TWINKLE_RADII: readonly number[] = Array.from({ length: 13 }, (_, i) => (6 + 3 * i) / 10);
/** Box of every twinkle frame about its centre (0, 0), ink included, plus RIG_PAD. */
export const TWINKLE_BOX: Bounds = boundsOfPoints(
  [[0, 0]],
  TWINKLE_RADII[TWINKLE_RADII.length - 1] + GLINT_ARM_W / 2 + GLINT_ARM_OL + RIG_PAD,
);

/** How far the seam clips reach from local (0, 0): far past any ink, and finite, as Path2D needs. */
const SEAM_CLIP_REACH = 1000;
/** Phases closer than this count as the same (isStillTail). */
const STILL_EPS = 1e-9;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RigRenderer = 'webgl' | 'canvas';

/** Everything a bake reads: re-bake when rigAppearanceKey changes. */
export interface RigAppearance {
  readonly look: AxolotlArtLook;
  readonly palette: MorphPalette;
  readonly outfit: ArtOutfit;
}

type GillIndex = 0 | 1 | 2;
type LegIndex = 0 | 1 | 2 | 3;

export type RigPartId =
  | `gill-far-${GillIndex}`
  | `leg-${LegIndex}`
  | `wear-leg-${LegIndex}`
  | 'tail'
  | 'tail-over'
  | 'body'
  | 'tail-item'
  | `gill-near-${GillIndex}`
  | 'face'
  | 'eyes';

/**
 * One baked part: where it joins the axolotl and the box its texture covers.
 * Parts draw in rigParts order; the body and the tail share layers 4 to 8,
 * the body first, so the tail covers the seam overlap. A sheen Dream tail adds
 * 'tail-over' (6.5 to 8) over the live stripe pair.
 */
export interface RigPartSpec {
  readonly id: RigPartId;
  /** The first 6a layer the part paints. */
  readonly layer: number;
  /** The last 6a layer the part paints (the same as `layer` for a one-layer part). */
  readonly topLayer: number;
  /** The joint the part turns or bends about, in local units. Local (0, 0) for parts that never move. */
  readonly pivot: LocalPoint;
  /** Ink box in local units, RIG_PAD included. The tail's box is the straight tail. */
  readonly box: Bounds;
  /** The pivot measured from the box's top-left corner (box.minX, box.minY). */
  readonly pivotOffset: LocalPoint;
  /** How many `variant.frame` values the part bakes (gills GILL_FLUTTER_FRAMES (10), eyes 3, others 1). */
  readonly frames: number;
  /**
   * Largest |dy| tailShear gives over the canvas strip poses and the still pose:
   * a bent tail frame needs the box grown by this above and below. 0 for every other part.
   */
  readonly maxDy: number;
}

/** A tail pose: swim phase and tail amplitude. */
export interface RigTailPose {
  readonly swimPhase: number;
  readonly tailAmp: number;
}

/** What to bake for one part texture. Every field is optional; parts ignore fields they do not read. */
export interface RigPartVariant {
  /** Gill flutter frame (0..9) or eye frame (0..2). Default 0. */
  readonly frame?: number;
  /** The leg's look, for 'leg-i' and 'wear-leg-i'. Undefined is present. */
  readonly leg?: LegLook;
  /** Tail pose for 'tail' and 'tail-over'. Undefined is the straight tail (tail amplitude 0). */
  readonly tailPose?: RigTailPose;
  /** Layers of 'tail': 'all' (4 to 8, the default), or 'under' (4 to 6.2) below the live sheen stripe. */
  readonly tailLayers?: 'all' | 'under';
  /** Sheen phase in [0, 1) for a sheen Dream 'body'. Undefined is the still stripe at x -10. */
  readonly sheen?: number;
}

export interface RigGillPlacement {
  /** Gill flutter frame to show. */
  frame: number;
  /** Turn about the gill root, radians: the live stem chord angle less the frame's. */
  rotation: number;
}

export interface RigLegPlacement {
  /** Turn about the leg root, radians: the live leg angle less the still leg angle. */
  rotation: number;
  /** legStateKey of the leg: re-bake the leg part when it changes. */
  stateKey: string;
  /** Whether the leg wears its Socks and Feet (only while present, guide 6q). */
  wears: boolean;
}

export type RigTailMode = 'still' | 'rope' | 'strip';

/**
 * How the tail shows. 'still': the tail part baked at the still pose. 'rope'
 * (WebGL): the straight tail bent by `dy` along tailColumnXs. 'strip' (Canvas):
 * strip frame `frame`, baked at tailStripPose. `dy` always holds the shear of
 * the shown tail (shownTail); `frame` always holds the strip frame nearest the live pose.
 */
export interface RigTailPlacement {
  mode: RigTailMode;
  dy: number[];
  frame: number;
}

/** A pose the tail can show: swim phase and amplitude (mutable, for reuse). */
export interface RigShownTail {
  swimPhase: number;
  tailAmp: number;
}

/** The Tail item's frame origin, and its turn from the still Tail frame, radians. */
export interface RigTailItemPlacement {
  x: number;
  y: number;
  rotation: number;
}

/** One twinkle sprite: centre in local units and its TWINKLE_RADII frame. */
export interface RigTwinkle {
  x: number;
  y: number;
  frame: number;
}

/** Everything the glue sets per frame. Reuse one per axolotl (rigPlacement's `out`). */
export interface RigPlacement {
  /** Far gills 0 to 2, then near gills 0 to 2. */
  readonly gills: RigGillPlacement[];
  /** In leg draw order: far-front, far-rear, near-front, near-rear. */
  readonly legs: RigLegPlacement[];
  readonly tail: RigTailPlacement;
  readonly shownTail: RigShownTail;
  readonly tailItem: RigTailItemPlacement;
  eyesFrame: number;
  /** sheenFrame(pose.sheen) on a sheen Dream axolotl, else null. */
  sheenFrame: number | null;
  /**
   * The sheen stripe pair to draw live between 'tail' ('under') and
   * 'tail-over': tailStripe at the sheen colour, the shown tail and sheen step, to x
   * rootX + RIG_SEAM_OVERLAP. Both bands hold no polygons on a still tail or an axolotl with no sheen colour.
   */
  readonly stripe: TailStripe;
  /** Regeneration glints along the shown tail, then the glints beside each regrowing leg. */
  readonly twinkles: RigTwinkle[];
}

// ---------------------------------------------------------------------------
// Per-look geometry
// ---------------------------------------------------------------------------

/** What the rig reads from a look, worked out once per look object. */
interface RigLookGeometry {
  readonly geo: AxolotlBodyGeometry;
  /** Far gills 0 to 2, then near gills 0 to 2. */
  readonly gills: readonly GillSpec[];
  readonly stillLegAngles: readonly number[];
  readonly stillTailFrame: WearFrame;
  /** tailColumnXs(look). */
  readonly columnXs: readonly number[];
  /** Tail centre y of each tail sample on the straight tail. */
  readonly straightCys: readonly number[];
}

const lookGeometryCache = new WeakMap<AxolotlArtLook, RigLookGeometry>();

function rigLookGeometry(look: AxolotlArtLook): RigLookGeometry {
  const cached = lookGeometryCache.get(look);
  if (cached) return cached;
  const geo = axolotlBodyGeometry(look);
  const straight = tailSamples(geo.tail, RIG_STILL_POSE.swimPhase, 0);
  const tip = straight[straight.length - 1];
  const made: RigLookGeometry = {
    geo,
    gills: [...gillSpecs(look.gills, 'far', geo.gillLength), ...gillSpecs(look.gills, 'near', geo.gillLength)],
    stillLegAngles: [0, 1, 2, 3].map((index) => legAngle(index, RIG_STILL_POSE.swimPhase)),
    stillTailFrame: tailSlotFrame(geo.tail, RIG_STILL_POSE.swimPhase, RIG_STILL_POSE.tailAmp),
    columnXs: [geo.tail.rootX + RIG_SEAM_OVERLAP, ...straight.map((tp) => tp.x), tip.x - RIG_PAD - LW],
    straightCys: straight.map((tp) => tp.cy),
  };
  lookGeometryCache.set(look, made);
  return made;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** Every AxolotlArtLook field: the Record type makes a new look field a type error here until it is keyed. */
const LOOK_KEY_FIELDS: Readonly<Record<keyof AxolotlArtLook, true>> = {
  eyes: true,
  mouth: true,
  gills: true,
  spots: true,
  size: true,
  sex: true,
  tail: true,
  body: true,
  age: true,
};

/**
 * Re-bake key of every part for an appearance at a bake scale: every look
 * field (size included), the palette (morph and Dream colour), the outfit and
 * the scale. Never reads a pose. Leg state is keyed per leg (legStateKey).
 */
export function rigAppearanceKey(appearance: RigAppearance, scale: number): string {
  const fields = Object.keys(LOOK_KEY_FIELDS) as (keyof AxolotlArtLook)[];
  return [
    ...fields.map((field) => `${field}=${appearance.look[field]}`),
    JSON.stringify(appearance.palette),
    outfitKey(appearance.outfit),
    `scale=${scale}`,
  ].join('|');
}

/** Re-bake key of one leg part: 'present' (or undefined), 'lost', or `regrowing:${progress}`. */
export function legStateKey(leg?: LegLook): string {
  if (!leg || leg.status === 'present') return 'present';
  if (leg.status === 'lost') return 'lost';
  return `regrowing:${leg.progress}`;
}

// ---------------------------------------------------------------------------
// Tail bend
// ---------------------------------------------------------------------------

/**
 * Rope columns of the tail part, in local x, from the seam toward the tail tip
 * (x falls along the array): the overlap column rootX + RIG_SEAM_OVERLAP, then
 * the tailSamples x of every tail point root first, then the box's far edge
 * past the tip (tip x - RIG_PAD - LW). TAIL_SEGMENTS + 3 columns.
 */
export function tailColumnXs(look: AxolotlArtLook): readonly number[] {
  return rigLookGeometry(look).columnXs;
}

/**
 * The tail's bend at a pose: dy of each tailColumnXs column (local units, + is
 * down), the tailSamples centre y at the pose less the straight tail's. 0 at
 * the overlap column and at the root; the last column copies the tip.
 */
export function tailShear(look: AxolotlArtLook, swimPhase: number, tailAmp: number, out: number[] = []): number[] {
  const g = rigLookGeometry(look);
  const samples = g.straightCys.length;
  out.length = samples + 2;
  out[0] = 0;
  for (let i = 0; i < samples; i++) {
    out[i + 1] = tailPointAt(i / TAIL_SEGMENTS, swimPhase, tailAmp, g.geo.tail).cy - g.straightCys[i];
  }
  out[samples + 1] = out[samples];
  return out;
}

/** Canvas strip pose `phaseIndex` (0..11) at amplitude `ampIndex` (TAIL_STRIP_AMPS). */
export function tailStripPose(phaseIndex: number, ampIndex: number): RigTailPose {
  return {
    swimPhase: RIG_STILL_POSE.swimPhase + (TAU * phaseIndex) / TAIL_STRIP_PHASES,
    tailAmp: TAIL_STRIP_AMPS[ampIndex],
  };
}

/** `phase` less `base`, wrapped into [0, TAU). */
function phaseFrom(phase: number, base: number): number {
  return (((phase - base) % TAU) + TAU) % TAU;
}

/** Nearest of `steps` evenly spaced phases from `base` round one cycle. */
function nearestCycleStep(phase: number, base: number, steps: number): number {
  return Math.round(phaseFrom(phase, base) / (TAU / steps)) % steps;
}

/** Index of the value in `values` nearest `value` (the first on a tie). */
function nearestIndex(values: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - value) < Math.abs(values[best] - value)) best = i;
  }
  return best;
}

/** The canvas strip frame nearest a tail pose: frame = ampIndex * TAIL_STRIP_PHASES + phaseIndex. */
export function nearestTailStrip(
  swimPhase: number,
  tailAmp: number,
): { phaseIndex: number; ampIndex: number; frame: number } {
  const phaseIndex = nearestCycleStep(swimPhase, RIG_STILL_POSE.swimPhase, TAIL_STRIP_PHASES);
  const ampIndex = nearestIndex(TAIL_STRIP_AMPS, tailAmp);
  return { phaseIndex, ampIndex, frame: ampIndex * TAIL_STRIP_PHASES + phaseIndex };
}

/** Whether a tail pose is the still pose: the still swim phase (within 1e-9, modulo 2 pi) at amplitude 1. */
export function isStillTail(swimPhase: number, tailAmp: number): boolean {
  const offset = phaseFrom(swimPhase, RIG_STILL_POSE.swimPhase);
  const onPhase = offset <= STILL_EPS || TAU - offset <= STILL_EPS;
  return onPhase && Math.abs(tailAmp - RIG_STILL_POSE.tailAmp) <= STILL_EPS;
}

// ---------------------------------------------------------------------------
// Sheen
// ---------------------------------------------------------------------------

/** Sheen step (0..15) for a sheen phase in [0, 1); null for the still stripe (undefined). */
export function sheenFrame(sheen: number | undefined): number | null {
  if (sheen === undefined) return null;
  if (!Number.isFinite(sheen)) throw new RangeError(`sheen must be finite, got ${sheen}`);
  return Math.min(SHEEN_STEPS - 1, Math.max(0, Math.floor(sheen * SHEEN_STEPS)));
}

/** The sheen phase sheen step `step` is baked at. */
export function sheenStepValue(step: number): number {
  return step / SHEEN_STEPS;
}

// ---------------------------------------------------------------------------
// Part specs
// ---------------------------------------------------------------------------

const GILL_FAR_IDS = ['gill-far-0', 'gill-far-1', 'gill-far-2'] as const;
const GILL_NEAR_IDS = ['gill-near-0', 'gill-near-1', 'gill-near-2'] as const;
const LEG_IDS = ['leg-0', 'leg-1', 'leg-2', 'leg-3'] as const;
const WEAR_LEG_IDS = ['wear-leg-0', 'wear-leg-1', 'wear-leg-2', 'wear-leg-3'] as const;

function padBounds(b: Bounds, pad: number): Bounds {
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

function circleBounds(c: ZoneCircle): Bounds {
  return boundsOfPoints([[c.x, c.y]], c.r);
}

function makeSpec(
  id: RigPartId,
  layers: readonly [number, number],
  pivot: LocalPoint,
  ink: Bounds,
  frames = 1,
  maxDy = 0,
): RigPartSpec {
  const box = padBounds(ink, RIG_PAD);
  return {
    id,
    layer: layers[0],
    topLayer: layers[1],
    pivot,
    box,
    pivotOffset: { x: pivot.x - box.minX, y: pivot.y - box.minY },
    frames,
    maxDy,
  };
}

/** Gill flutter phase of frame `k`. */
function gillFramePhase(k: number): number {
  return RIG_STILL_POSE.gillPhase + (TAU * k) / GILL_FLUTTER_FRAMES;
}

/** Ink box of one gill over its flutter frames: the stem hull and the filament ends. */
function gillPartInk(spec: GillSpec, look: AxolotlArtLook): Bounds {
  const stemPad = GILL_STEM_W / 2 + GILL_STEM_OL;
  const filamentPad = GILL_FILAMENT_W / 2 + GILL_FILAMENT_OL;
  const boxes: Bounds[] = [];
  for (let k = 0; k < GILL_FLUTTER_FRAMES; k++) {
    const g = gillGeometry(spec, look.gills, gillFramePhase(k));
    boxes.push(
      boundsOfPoints(
        [
          [g.bx, g.by],
          [g.cx, g.cy],
          [g.tx, g.ty],
        ],
        stemPad,
      ),
    );
    boxes.push(boundsOfPoints(g.filaments.map((f): [number, number] => [f.x2, f.y2]), filamentPad));
  }
  return unionBounds(boxes);
}

/** Ink box of leg `index` at the still angle in every leg state, plus its Socks and Feet when worn. */
function legPartInk(g: RigLookGeometry, look: AxolotlArtLook, outfit: ArtOutfit, index: number): Bounds {
  const { geo } = g;
  const leg = legInkBounds(geo.legRoots[index], g.stillLegAngles[index], geo.legLengths[index], geo.toeLength);
  if (!wearsOnLegs(outfit)) return leg;
  const frame = legSlotFrames(look, RIG_STILL_POSE.swimPhase)[index];
  return unionBounds([leg, sockSleeveBounds(frame), legRectBounds(frame, feetEnvelope(frame))]);
}

/**
 * Ink box of the part of ellipse `e` (outlined LW outside it) between x
 * `fromX` and `toX`, or null when none of its ink lies there. Ink in the slice
 * is within LW of an ellipse point in the slice grown by LW; the tallest such
 * point is the one nearest the centre.
 */
function ellipseInkSlice(e: BodyEllipse, fromX: number, toX: number): Bounds | null {
  const minX = Math.max(e.cx - e.rx - LW, fromX);
  const maxX = Math.min(e.cx + e.rx + LW, toX);
  if (minX > maxX) return null;
  const nearestX = Math.min(Math.max(e.cx, minX - LW), maxX + LW);
  const u = (nearestX - e.cx) / e.rx;
  const half = e.ry * Math.sqrt(Math.max(0, 1 - u * u));
  return { minX, minY: e.cy - half - LW, maxX, maxY: e.cy + half + LW };
}

/** Top and bottom fin edge points of a tail sample. */
function finEdges(tp: TailSample): [number, number][] {
  return [
    [tp.x, tp.cy - tp.hc - tp.finTop],
    [tp.x, tp.cy + tp.hc + tp.finBottom],
  ];
}

/** Fin edge points of the tail polygon at x >= `fromX`: the samples there, plus the edges cut at `fromX`. */
function finEdgesFrom(samples: readonly TailSample[], fromX: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    if (a.x >= fromX) points.push(...finEdges(a));
    const b = samples[i + 1];
    if (b && a.x > fromX && b.x < fromX) {
      const t = (a.x - fromX) / (a.x - b.x);
      const [[, aTop], [, aBottom]] = finEdges(a);
      const [[, bTop], [, bBottom]] = finEdges(b);
      points.push([fromX, aTop + (bTop - aTop) * t], [fromX, aBottom + (bBottom - aBottom) * t]);
    }
  }
  return points;
}

/** Drop the null slices and union the rest. */
function unionOf(boxes: readonly (Bounds | null)[]): Bounds {
  return unionBounds(boxes.filter((b): b is Bounds => b !== null));
}

/** Ink box of the straight tail part: the tail polygon and the torso and head ink at x <= the seam. */
function tailPartInk(g: RigLookGeometry): Bounds {
  const { geo } = g;
  const seamX = geo.tail.rootX + RIG_SEAM_OVERLAP;
  const straight = tailSamples(geo.tail, RIG_STILL_POSE.swimPhase, 0);
  const fins = boundsOfPoints(
    straight.flatMap((tp) => finEdges(tp)),
    LW,
  );
  return unionOf([
    { ...fins, maxX: Math.min(fins.maxX, seamX) },
    ellipseInkSlice(geo.torso, -Infinity, seamX),
    ellipseInkSlice(HEAD_ELLIPSE, -Infinity, seamX),
  ]);
}

/** Ink box of the body part: the torso, the head and the tail polygon's ink at x >= the tail root. */
function bodyPartInk(g: RigLookGeometry): Bounds {
  const { geo } = g;
  const rootX = geo.tail.rootX;
  const straight = tailSamples(geo.tail, RIG_STILL_POSE.swimPhase, 0);
  const fins = boundsOfPoints(finEdgesFrom(straight, rootX - LW), LW);
  return unionOf([
    { ...fins, minX: Math.max(fins.minX, rootX) },
    ellipseInkSlice(geo.torso, rootX, Infinity),
    ellipseInkSlice(HEAD_ELLIPSE, rootX, Infinity),
  ]);
}

/** Largest |tailShear| over the canvas strip poses and the still pose. */
function tailMaxDy(look: AxolotlArtLook): number {
  const poses: RigTailPose[] = [RIG_STILL_POSE];
  for (let j = 0; j < TAIL_STRIP_AMPS.length; j++) {
    for (let k = 0; k < TAIL_STRIP_PHASES; k++) poses.push(tailStripPose(k, j));
  }
  const dy: number[] = [];
  let most = 0;
  for (const pose of poses) {
    for (const d of tailShear(look, pose.swimPhase, pose.tailAmp, dy)) most = Math.max(most, Math.abs(d));
  }
  return most;
}

/**
 * Ink box of the face part: the head (the blush sits on the cheeks inside it),
 * a Girl's cheek heart zone, the mouth zone (every mouth) and the footprint of
 * each worn Shirt, Neck, Back, Head and Face item.
 */
function facePartInk(look: AxolotlArtLook, outfit: ArtOutfit): Bounds {
  const head: Bounds = {
    minX: HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx,
    minY: HEAD_ELLIPSE.cy - HEAD_ELLIPSE.ry,
    maxX: HEAD_ELLIPSE.cx + HEAD_ELLIPSE.rx,
    maxY: HEAD_ELLIPSE.cy + HEAD_ELLIPSE.ry,
  };
  const boxes: Bounds[] = [head, circleBounds(CHEEK_HEART_ZONE), MOUTH_ZONE];
  if (wornSlug(outfit, 'shirt') !== undefined) boxes.push(shirtGeometry(look).bounds);
  if (wornSlug(outfit, 'neck') !== undefined) boxes.push(NECK_FOOTPRINT);
  if (wornSlug(outfit, 'back') !== undefined) boxes.push(backFootprint(look).bounds);
  if (wornSlug(outfit, 'head') !== undefined) boxes.push(HEAD_FOOTPRINT);
  if (wornSlug(outfit, 'face') !== undefined) boxes.push(GLASSES_EXTENT);
  return unionBounds(boxes);
}

/**
 * The parts of an appearance in draw order (guide 6a): far gills (1), far legs
 * (2), their Socks and Feet (2.5, only when the outfit wears on the legs), near
 * legs (3) and theirs (3.5), the body then the tail (both 4 to 8: the tail
 * draws over the seam overlap), 'tail-over' (6.5 to 8, only on a sheen Dream
 * palette (isSheenDream); the tail's pivot, box and maxDy), near gills (9), the Tail item
 * (9.2, only when one is worn), the face (9.3 to 11.5, the Shirt item first)
 * and the eyes (12).
 */
export function rigParts(appearance: RigAppearance): RigPartSpec[] {
  const { look, palette, outfit } = appearance;
  const g = rigLookGeometry(look);
  const { geo } = g;
  const legWear = wearsOnLegs(outfit);
  const parts: RigPartSpec[] = [];
  const pushGills = (ids: readonly RigPartId[], first: number, layer: number): void => {
    ids.forEach((id, k) => {
      const spec = g.gills[first + k];
      parts.push(makeSpec(id, [layer, layer], { x: spec.bx, y: spec.by }, gillPartInk(spec, look), GILL_FLUTTER_FRAMES));
    });
  };
  const pushLegs = (first: number, legLayer: number, wearLayer: number): void => {
    const pair = [first, first + 1];
    const inks = pair.map((i) => legPartInk(g, look, outfit, i));
    pair.forEach((i, k) => parts.push(makeSpec(LEG_IDS[i], [legLayer, legLayer], geo.legRoots[i], inks[k])));
    if (!legWear) return;
    pair.forEach((i, k) => parts.push(makeSpec(WEAR_LEG_IDS[i], [wearLayer, wearLayer], geo.legRoots[i], inks[k])));
  };

  pushGills(GILL_FAR_IDS, 0, 1);
  pushLegs(0, 2, 2.5);
  pushLegs(2, 3, 3.5);
  const tailRoot: LocalPoint = { x: geo.tail.rootX, y: g.straightCys[0] };
  parts.push(makeSpec('body', [4, 8], { x: 0, y: 0 }, bodyPartInk(g)));
  const tailInk = tailPartInk(g);
  const tailDy = tailMaxDy(look);
  parts.push(makeSpec('tail', [4, 8], tailRoot, tailInk, 1, tailDy));
  if (palette.dream && isSheenDream(palette.dream.id)) parts.push(makeSpec('tail-over', [6.5, 8], tailRoot, tailInk, 1, tailDy));
  pushGills(GILL_NEAR_IDS, 3, 9);
  if (wornSlug(outfit, 'tail') !== undefined) {
    const frame = g.stillTailFrame;
    parts.push(makeSpec('tail-item', [9.2, 9.2], { x: frame.x, y: frame.y }, tailSlotBounds(frame)));
  }
  parts.push(makeSpec('face', [9.3, 11.5], { x: 0, y: 0 }, facePartInk(look, outfit)));
  const eyes = unionBounds([
    circleBounds(FAR_LASH_REACH),
    circleBounds(NEAR_LASH_REACH),
    grumpyBrowInkBounds(FAR_EYE),
    grumpyBrowInkBounds(NEAR_EYE),
  ]);
  parts.push(makeSpec('eyes', [12, 12], { x: 0, y: 0 }, eyes, EYE_FRAME_BLINKS.length));
  return parts;
}

// ---------------------------------------------------------------------------
// Bake painters
// ---------------------------------------------------------------------------

/** `variant.frame` (default 0), or a RangeError when the part has no such frame. */
function frameOf(id: RigPartId, variant: RigPartVariant, frames: number): number {
  const frame = variant.frame ?? 0;
  if (!Number.isInteger(frame) || frame < 0 || frame >= frames) {
    throw new RangeError(`rig part ${id} has no frame ${frame} (it has ${frames})`);
  }
  return frame;
}

/** Clip to the band of local x from `fromX` to `toX` (finite), reaching far past any ink across the body axis. */
function clipToXBand(ctx: CanvasRenderingContext2D, fromX: number, toX: number): void {
  const band = new Path2D();
  band.moveTo(fromX, -SEAM_CLIP_REACH);
  band.lineTo(toX, -SEAM_CLIP_REACH);
  band.lineTo(toX, SEAM_CLIP_REACH);
  band.lineTo(fromX, SEAM_CLIP_REACH);
  band.closePath();
  ctx.clip(band);
}

/** paintBodyLayers (`layers` of them) at a tail pose and sheen, clipped to an x band. */
function paintBodySlice(
  ctx: CanvasRenderingContext2D,
  appearance: RigAppearance,
  tailPose: RigTailPose,
  sheen: number | undefined,
  fromX: number,
  toX: number,
  layers: BodyLayers,
): void {
  const pose: AxolotlPose = { ...RIG_STILL_POSE, swimPhase: tailPose.swimPhase, tailAmp: tailPose.tailAmp, sheen };
  ctx.save();
  clipToXBand(ctx, fromX, toX);
  paintBodyLayers(ctx, pose, appearance.palette, appearance.look, layers);
  ctx.restore();
}

function paintRigGill(
  ctx: CanvasRenderingContext2D,
  appearance: RigAppearance,
  layer: GillLayer,
  index: number,
  frame: number,
): void {
  const { look, palette } = appearance;
  const spec = rigLookGeometry(look).gills[(layer === 'far' ? 0 : 3) + index];
  const stem = layer === 'far' ? palette.gillFarStem : palette.gillNearStem;
  const filament = layer === 'far' ? palette.gillFarFilament : palette.gillNearFilament;
  paintGill(ctx, spec, look.gills, gillFramePhase(frame), stem, filament);
}

function paintRigWearLeg(ctx: CanvasRenderingContext2D, appearance: RigAppearance, index: number, leg?: LegLook): void {
  const { look, outfit } = appearance;
  if ((leg?.status ?? 'present') !== 'present' || !wearsOnLegs(outfit)) return;
  paintLegWearables(ctx, outfit, legSlotFrames(look, RIG_STILL_POSE.swimPhase)[index]);
}

/**
 * Paint one part's bake in axolotl local units (the glue maps the pivot to the
 * texture anchor). Gill g frame k: paintGill at the still gill phase plus
 * 2 pi k / GILL_FLUTTER_FRAMES (10). Legs: paintAxolotlLeg at the still leg angle in `variant.leg`.
 * A wear-leg paints its Socks and Feet in the still leg frame, and nothing on
 * a lost or regrowing leg. Tail: paintBodyLayers (`variant.tailLayers`,
 * default 'all') at `variant.tailPose` (default straight) and the still stripe,
 * clipped to x <= rootX + RIG_SEAM_OVERLAP. Tail-over: the same with the
 * 'over' layers. Body: paintBodyLayers straight at `variant.sheen`, clipped to
 * x >= rootX. Tail item, face: their painters at the still pose. Eyes:
 * paintEyes at EYE_FRAME_BLINKS[frame].
 */
export function paintRigPart(
  ctx: CanvasRenderingContext2D,
  id: RigPartId,
  appearance: RigAppearance,
  variant: RigPartVariant = {},
): void {
  const { look, palette, outfit } = appearance;
  const still = RIG_STILL_POSE;
  const straight: RigTailPose = { swimPhase: still.swimPhase, tailAmp: 0 };
  const rootX = rigLookGeometry(look).geo.tail.rootX;
  const tailPose = variant.tailPose ?? straight;
  const seamX = rootX + RIG_SEAM_OVERLAP;
  switch (id) {
    case 'tail':
      paintBodySlice(ctx, appearance, tailPose, undefined, -SEAM_CLIP_REACH, seamX, variant.tailLayers ?? 'all');
      return;
    case 'tail-over':
      paintBodySlice(ctx, appearance, tailPose, undefined, -SEAM_CLIP_REACH, seamX, 'over');
      return;
    case 'body':
      paintBodySlice(ctx, appearance, straight, variant.sheen, rootX, SEAM_CLIP_REACH, 'all');
      return;
    case 'tail-item':
      paintBodyWearable(ctx, 'tail', outfit, look, still.swimPhase, still.tailAmp);
      return;
    case 'face':
      paintFaceLayers(ctx, still, palette, look, outfit);
      return;
    case 'eyes':
      paintEyes(ctx, look, EYE_FRAME_BLINKS[frameOf(id, variant, EYE_FRAME_BLINKS.length)], palette);
      return;
  }
  const farGill = GILL_FAR_IDS.indexOf(id as (typeof GILL_FAR_IDS)[number]);
  const nearGill = GILL_NEAR_IDS.indexOf(id as (typeof GILL_NEAR_IDS)[number]);
  const leg = LEG_IDS.indexOf(id as (typeof LEG_IDS)[number]);
  const wearLeg = WEAR_LEG_IDS.indexOf(id as (typeof WEAR_LEG_IDS)[number]);
  if (farGill >= 0) paintRigGill(ctx, appearance, 'far', farGill, frameOf(id, variant, GILL_FLUTTER_FRAMES));
  else if (nearGill >= 0) paintRigGill(ctx, appearance, 'near', nearGill, frameOf(id, variant, GILL_FLUTTER_FRAMES));
  else if (leg >= 0) paintAxolotlLeg(ctx, look, leg, rigLookGeometry(look).stillLegAngles[leg], variant.leg, palette);
  else if (wearLeg >= 0) paintRigWearLeg(ctx, appearance, wearLeg, variant.leg);
  else throw new RangeError(`unknown rig part ${String(id)}`);
}

/** Paint twinkle frame `frame` centred on local (0, 0): paintTwinkle at TWINKLE_RADII[frame]. */
export function paintTwinkleFrame(ctx: CanvasRenderingContext2D, frame: number): void {
  if (!Number.isInteger(frame) || frame < 0 || frame >= TWINKLE_RADII.length) {
    throw new RangeError(`no twinkle frame ${frame} (there are ${TWINKLE_RADII.length})`);
  }
  paintTwinkle(ctx, 0, 0, TWINKLE_RADII[frame]);
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/** A fresh placement to pass as rigPlacement's `out` every frame. */
export function createRigPlacement(): RigPlacement {
  return {
    gills: Array.from({ length: 6 }, () => ({ frame: 0, rotation: 0 })),
    legs: Array.from({ length: 4 }, () => ({ rotation: 0, stateKey: 'present', wears: true })),
    tail: { mode: 'still', dy: [], frame: 0 },
    shownTail: { swimPhase: RIG_STILL_POSE.swimPhase, tailAmp: RIG_STILL_POSE.tailAmp },
    tailItem: { x: 0, y: 0, rotation: 0 },
    eyesFrame: 0,
    sheenFrame: null,
    stripe: [
      { colour: 0, alpha: 0, polygons: [] },
      { colour: 0, alpha: 0, polygons: [] },
    ],
    twinkles: [],
  };
}

/**
 * Stem chord angle of a gill at flutter phase `tfl`: atan2(ty - by, tx - bx)
 * of gillGeometry, whose tip sits `len` along this angle from the root.
 * INVARIANT: matches gillGeometry's stem angle (axolotlRig.test.ts checks it).
 */
function gillChordAngle(spec: GillSpec, tfl: number): number {
  return Math.PI + spec.off + 0.13 * Math.sin(tfl + spec.phase);
}

/** Regrowth progress clamped to 0..1, as drawAxolotl reads it (a non-finite progress is 0). */
function legProgress(leg: LegLook): number {
  const p = leg.progress;
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}

/** Set twinkle `count` of `out` (reusing its object) and return the new count; radii under GLINT_MIN_R are skipped. */
function putTwinkle(out: RigTwinkle[], count: number, x: number, y: number, r: number): number {
  if (r < GLINT_MIN_R) return count;
  const frame = Math.min(TWINKLE_RADII.length - 1, Math.max(0, Math.round((r - TWINKLE_RADII[0]) / 0.3)));
  const twinkle = out[count];
  if (twinkle) {
    twinkle.x = x;
    twinkle.y = y;
    twinkle.frame = frame;
  } else {
    out.push({ x, y, frame });
  }
  return count + 1;
}

function placeGills(g: RigLookGeometry, pose: AxolotlPose, out: RigGillPlacement[]): void {
  const frame = nearestCycleStep(pose.gillPhase, RIG_STILL_POSE.gillPhase, GILL_FLUTTER_FRAMES);
  const framePhase = gillFramePhase(frame);
  for (let i = 0; i < g.gills.length; i++) {
    const spec = g.gills[i];
    out[i].frame = frame;
    out[i].rotation = gillChordAngle(spec, pose.gillPhase) - gillChordAngle(spec, framePhase);
  }
}

function placeLegs(g: RigLookGeometry, pose: AxolotlPose, out: RigLegPlacement[]): void {
  for (let i = 0; i < 4; i++) {
    const leg = pose.legs?.[i];
    out[i].rotation = legAngle(i, pose.swimPhase) - g.stillLegAngles[i];
    out[i].stateKey = legStateKey(leg);
    out[i].wears = (leg?.status ?? 'present') === 'present';
  }
}

function placeTail(
  look: AxolotlArtLook,
  pose: AxolotlPose,
  renderer: RigRenderer,
  sheenDream: DreamLookId | null,
  out: RigPlacement,
): void {
  const strip = nearestTailStrip(pose.swimPhase, pose.tailAmp);
  const sheenStill = pose.sheen === undefined || sheenDream === null;
  const shown = out.shownTail;
  if (isStillTail(pose.swimPhase, pose.tailAmp) && sheenStill) {
    out.tail.mode = 'still';
    shown.swimPhase = RIG_STILL_POSE.swimPhase;
    shown.tailAmp = RIG_STILL_POSE.tailAmp;
  } else if (renderer === 'webgl') {
    out.tail.mode = 'rope';
    shown.swimPhase = pose.swimPhase;
    shown.tailAmp = pose.tailAmp;
  } else {
    out.tail.mode = 'strip';
    shown.swimPhase = RIG_STILL_POSE.swimPhase + (TAU * strip.phaseIndex) / TAIL_STRIP_PHASES;
    shown.tailAmp = TAIL_STRIP_AMPS[strip.ampIndex];
  }
  out.tail.frame = strip.frame;
  tailShear(look, shown.swimPhase, shown.tailAmp, out.tail.dy);
}

/** The tailStripe inputs a placement's `stripe` was last filled for. */
interface StripeInputs {
  sheenDream: DreamLookId;
  look: AxolotlArtLook;
  swimPhase: number;
  tailAmp: number;
  sheen: number | undefined;
}

const stripeInputs = new WeakMap<RigPlacement, StripeInputs>();

/**
 * Fill `out.stripe` for the shown tail on a moving sheen Dream tail, else empty both bands.
 * Runs tailStripe only when the sheen colour, the look, the shown tail or the sheen step changed since `out` was last filled.
 */
function placeStripe(g: RigLookGeometry, look: AxolotlArtLook, sheenDream: DreamLookId | null, out: RigPlacement): void {
  if (sheenDream === null || out.tail.mode === 'still') {
    for (const band of out.stripe) band.polygons.length = 0;
    stripeInputs.delete(out);
    return;
  }
  const sheen = out.sheenFrame === null ? undefined : sheenStepValue(out.sheenFrame);
  const { swimPhase, tailAmp } = out.shownTail;
  const last = stripeInputs.get(out);
  if (last && last.sheenDream === sheenDream && last.look === look && last.swimPhase === swimPhase && last.tailAmp === tailAmp && last.sheen === sheen) {
    return;
  }
  stripeInputs.delete(out);
  tailStripe(sheenDream, look, swimPhase, tailAmp, sheen, g.geo.tail.rootX + RIG_SEAM_OVERLAP, out.stripe);
  stripeInputs.set(out, { sheenDream, look, swimPhase, tailAmp, sheen });
}

function placeTwinkles(g: RigLookGeometry, pose: AxolotlPose, shown: RigShownTail, out: RigTwinkle[]): void {
  let count = 0;
  const sparkle = Math.min(1, Math.max(0, pose.sparkle));
  if (REGEN_GLINT_R * sparkle >= GLINT_MIN_R) {
    const spots = regenGlintSpots(tailSamples(g.geo.tail, shown.swimPhase, shown.tailAmp));
    for (let k = 0; k < spots.length; k++) {
      count = putTwinkle(out, count, spots[k][0], spots[k][1], regenGlintRadius(pose.sparkle, pose.swimPhase, k));
    }
  }
  for (let i = 0; i < 4; i++) {
    const leg = pose.legs?.[i];
    if (!leg || leg.status !== 'regrowing') continue;
    const progress = legProgress(leg);
    const spots = legGlintSpots(g.geo.legRoots[i], legAngle(i, pose.swimPhase), g.geo.legLengths[i]);
    for (let k = 0; k < spots.length; k++) {
      count = putTwinkle(out, count, spots[k][0], spots[k][1], legGlintRadius(progress, pose.swimPhase, i, k));
    }
  }
  out.length = count;
}

/**
 * Where every part shows for a live pose. Gills: the nearest flutter frame,
 * turned by the live stem chord angle less the frame's. Legs: turned by the
 * live leg angle less the still one. Tail: 'still' at the still tail (and a
 * still sheen, or no sheen colour), else 'rope' on WebGL and 'strip' on Canvas.
 * The Tail item rides the shown tail's Tail frame. Eyes: the nearest
 * EYE_FRAME_BLINKS. Stripe: on a sheen Dream tail (`sheenDream`, null for
 * none) that is not 'still', that colour's stripe pair at the shown tail and the shown sheen step (the still stripe
 * when the sheen is undefined), else empty. Twinkles: the regeneration glints
 * along the shown tail and the glints beside each regrowing leg, sized as
 * drawAxolotl sizes them, each at the nearest TWINKLE_RADII frame. Reuses `out` (allocation-light); the
 * per-look geometry is cached by look object, so pass the same look each frame.
 */
export function rigPlacement(
  look: AxolotlArtLook,
  pose: AxolotlPose,
  renderer: RigRenderer,
  sheenDream: DreamLookId | null,
  out: RigPlacement = createRigPlacement(),
): RigPlacement {
  const g = rigLookGeometry(look);
  placeGills(g, pose, out.gills);
  placeLegs(g, pose, out.legs);
  placeTail(look, pose, renderer, sheenDream, out);
  const frame = tailSlotFrame(g.geo.tail, out.shownTail.swimPhase, out.shownTail.tailAmp);
  out.tailItem.x = frame.x;
  out.tailItem.y = frame.y;
  out.tailItem.rotation = frame.angle - g.stillTailFrame.angle;
  out.eyesFrame = nearestIndex(EYE_FRAME_BLINKS, pose.blink);
  out.sheenFrame = sheenDream === null ? null : sheenFrame(pose.sheen);
  placeStripe(g, look, sheenDream, out);
  placeTwinkles(g, pose, out.shownTail, out.twinkles);
  return out;
}
