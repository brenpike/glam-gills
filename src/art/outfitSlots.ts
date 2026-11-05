/**
 * Outfit slot pictures (guide 6i, 8, 11): the crop of each Wearable slot and
 * the footprint outlines the empty-slot cue strokes.
 *
 * Every crop is derived from the footprint geometry of drawAxolotlParts.ts: the
 * union of the slot's footprint over every Boy or girl, Tail, Body and Age (54
 * looks; size only scales the bake), over SWIM_PHASE_SAMPLES swim phases and
 * TAIL_AMP_SAMPLES tail amplitudes, padded by SLOT_CROP_PAD and rounded outward
 * to whole units, then kept inside the AXO_TEX frame. A grown footprint grows
 * its crop. The Head and Back crops also hold the opt-in big footprints
 * (HEAD_BIG_FOOTPRINT, backBigFootprint; issue #207), so a big item fits its
 * slot picture. Socks and Feet share one crop holding all four feet and sleeves.
 *
 * Crops are plain numbers worked out at load; footprint outlines are Path2D,
 * made only when asked for. Presentational only: no game state, no Phaser.
 */
import { TAU } from './canvasKit';
import { AXO_MAX_TAIL_AMP, AXO_TEX } from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  HEAD_BIG_FOOTPRINT,
  HEAD_FOOTPRINT,
  NECK_FOOTPRINT,
  TAIL_SLOT_REACH,
  WEARABLE_SLOTS,
  axolotlBodyGeometry,
  backBigFootprint,
  backFootprint,
  feetEnvelope,
  framePoint,
  legRectBounds,
  legSlotFrames,
  shirtGeometry,
  sockSleeveBounds,
  tailSlotBounds,
  tailSlotFrame,
  unionBounds,
  type AxolotlArtLook,
  type Bounds,
  type ShirtGeometry,
  type WearFrame,
  type WearableSlot,
} from './drawAxolotlParts';
import { RIG_STILL_POSE } from './axolotlRigParts';

/** The Face footprint (art guide 6i), in local units. */
export const FACE_FOOTPRINT: Bounds = Object.freeze({ minX: 14, minY: -18, maxX: 54, maxY: 6 });

/** Empty units round every footprint inside its slot crop (art guide 11). */
const SLOT_CROP_PAD = 4;
/** Swim phases each moving footprint is sampled at, a whole cycle from the still pose. */
const SWIM_PHASE_SAMPLES = 13;
/** Tail amplitudes the Tail footprint is sampled at: straight, the still pose, and the largest. */
const TAIL_AMP_SAMPLES: readonly number[] = [0, RIG_STILL_POSE.tailAmp, AXO_MAX_TAIL_AMP];
/** Steps along each half of the Shirt cue's ellipse edge. */
const SHIRT_CUE_STEPS = 32;

/** The AXO_TEX frame as a local box. */
const AXO_FRAME_BOUNDS: Bounds = Object.freeze({
  minX: -AXO_TEX.originX,
  minY: -AXO_TEX.originY,
  maxX: AXO_TEX.w - AXO_TEX.originX,
  maxY: AXO_TEX.h - AXO_TEX.originY,
});

/** Every Boy or girl, Tail, Body and Age (54 looks); size only scales the bake. */
function listBodyLooks(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const sex of AXO_SEXES)
    for (const tail of AXO_TAILS)
      for (const body of AXO_BODIES) for (const age of AXO_AGES) looks.push({ ...DEFAULT_ART_LOOK, sex, tail, body, age });
  return looks;
}

/** The sampled swim phases: SWIM_PHASE_SAMPLES steps round a whole cycle, starting at the still pose. */
function listSwimPhases(): number[] {
  return Array.from({ length: SWIM_PHASE_SAMPLES }, (_unused, index) => RIG_STILL_POSE.swimPhase + (TAU * index) / SWIM_PHASE_SAMPLES);
}

/** Boxes of the Tail footprint of `look` at every sampled swim phase and tail amplitude. */
function tailFootprintBoxes(look: AxolotlArtLook, swimPhases: readonly number[]): Bounds[] {
  const { tail } = axolotlBodyGeometry(look);
  return swimPhases.flatMap((swim) => TAIL_AMP_SAMPLES.map((amp) => tailSlotBounds(tailSlotFrame(tail, swim, amp))));
}

/** Boxes of the Feet envelope and the Sock sleeve of all four legs of `look` at every sampled swim phase. */
function legFootprintBoxes(look: AxolotlArtLook, swimPhases: readonly number[]): Bounds[] {
  return swimPhases.flatMap((swim) =>
    legSlotFrames(look, swim).flatMap((frame) => [legRectBounds(frame, feetEnvelope(frame)), sockSleeveBounds(frame)]),
  );
}

/**
 * Boxes of the footprint of `slot` on `look`, over every sampled swim phase and tail amplitude.
 * Head and Back give both the footprint and its opt-in big footprint.
 */
function slotFootprintBoxes(slot: WearableSlot, look: AxolotlArtLook, swimPhases: readonly number[]): Bounds[] {
  switch (slot) {
    case 'head':
      return [HEAD_FOOTPRINT, HEAD_BIG_FOOTPRINT];
    case 'neck':
      return [NECK_FOOTPRINT];
    case 'face':
      return [FACE_FOOTPRINT];
    case 'shirt':
      return [shirtGeometry(look).bounds];
    case 'back':
      return [backFootprint(look).bounds, backBigFootprint(look).bounds];
    case 'tail':
      return tailFootprintBoxes(look, swimPhases);
    case 'socks':
    case 'feet':
      return legFootprintBoxes(look, swimPhases);
  }
}

/** `box` grown by `pad`, rounded outward to whole units and kept inside the AXO_TEX frame. */
function paddedFrameCrop(box: Bounds, pad: number): Bounds {
  return Object.freeze({
    minX: Math.max(AXO_FRAME_BOUNDS.minX, Math.floor(box.minX - pad)),
    minY: Math.max(AXO_FRAME_BOUNDS.minY, Math.floor(box.minY - pad)),
    maxX: Math.min(AXO_FRAME_BOUNDS.maxX, Math.ceil(box.maxX + pad)),
    maxY: Math.min(AXO_FRAME_BOUNDS.maxY, Math.ceil(box.maxY + pad)),
  });
}

/** The crop of `slot`: its footprint over every body look, swim phase and tail amplitude, padded. */
function deriveSlotCrop(slot: WearableSlot, looks: readonly AxolotlArtLook[], swimPhases: readonly number[]): Bounds {
  const boxes = looks.flatMap((look) => slotFootprintBoxes(slot, look, swimPhases));
  return paddedFrameCrop(unionBounds(boxes), SLOT_CROP_PAD);
}

/** The Outfit slot crops in local units (art guide 11), each holding its slot's footprint over every look. */
function deriveOutfitSlotCrops(): Readonly<Record<WearableSlot, Bounds>> {
  const looks = listBodyLooks();
  const swimPhases = listSwimPhases();
  const legsCrop = deriveSlotCrop('socks', looks, swimPhases);
  const crops = {} as Record<WearableSlot, Bounds>;
  for (const slot of WEARABLE_SLOTS) {
    crops[slot] = slot === 'socks' || slot === 'feet' ? legsCrop : deriveSlotCrop(slot, looks, swimPhases);
  }
  return Object.freeze(crops);
}

/** The Outfit slot crops in local units (art guide 11); Socks and Feet share one crop holding all four feet. */
export const OUTFIT_SLOT_CROPS: Readonly<Record<WearableSlot, Bounds>> = deriveOutfitSlotCrops();

/** The closed box u0 to u1 along and v0 to v1 across `frame`. */
function framePolygon(frame: WearFrame, u0: number, u1: number, v0: number, v1: number): Path2D {
  const path = new Path2D();
  const corners = [framePoint(frame, u0, v0), framePoint(frame, u1, v0), framePoint(frame, u1, v1), framePoint(frame, u0, v1)];
  path.moveTo(corners[0].x, corners[0].y);
  for (const corner of corners.slice(1)) path.lineTo(corner.x, corner.y);
  path.closePath();
  return path;
}

/** The local box `bounds`, `inset` inside its edges. */
function insetBoxPath(bounds: Bounds, inset: number): Path2D {
  const local: WearFrame = { x: 0, y: 0, angle: 0 };
  return framePolygon(local, bounds.minX + inset, bounds.maxX - inset, bounds.minY + inset, bounds.maxY - inset);
}

/**
 * The Shirt footprint `inset` inside its edges: the inset torso ellipse from the front edge round the
 * rear (cut at the tail root) and back, then the neckline bowing back to its apex (as the Tank top).
 */
function shirtCuePath(shirt: ShirtGeometry, inset: number): Path2D {
  const ellipse = shirt.inset;
  const rx = ellipse.rx - inset;
  const ry = ellipse.ry - inset;
  const front = shirt.frontX - inset;
  const angleAt = (x: number): number => Math.acos(Math.min(1, Math.max(-1, (x - ellipse.cx) / rx)));
  const frontAngle = angleAt(front);
  const rearAngle = angleAt(shirt.rearX + inset);
  const angles = Array.from(
    { length: SHIRT_CUE_STEPS + 1 },
    (_unused, index) => frontAngle + ((rearAngle - frontAngle) * index) / SHIRT_CUE_STEPS,
  );
  const path = new Path2D();
  angles.forEach((angle, index) => {
    const x = ellipse.cx + rx * Math.cos(angle);
    const y = ellipse.cy - ry * Math.sin(angle);
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  for (const angle of [...angles].reverse()) path.lineTo(ellipse.cx + rx * Math.cos(angle), ellipse.cy + ry * Math.sin(angle));
  const apex = shirt.neckline.apexX - inset;
  path.quadraticCurveTo(2 * apex - front, ellipse.cy, front, ellipse.cy - ry * Math.sin(frontAngle));
  path.closePath();
  return path;
}

/**
 * The footprint outlines of `slot` on `look` at the still pose (art guide 6i), `inset` inside the
 * footprint (which includes its ink): a box for Head, Neck and Face, the Shirt shape, the Back box on
 * the torso edge, the Tail reach circle, and for Socks and Feet the Feet envelope of each of the four feet.
 */
export function slotFootprintPaths(slot: WearableSlot, look: AxolotlArtLook, inset: number): Path2D[] {
  switch (slot) {
    case 'head':
      return [insetBoxPath(HEAD_FOOTPRINT, inset)];
    case 'neck':
      return [insetBoxPath(NECK_FOOTPRINT, inset)];
    case 'face':
      return [insetBoxPath(FACE_FOOTPRINT, inset)];
    case 'shirt':
      return [shirtCuePath(shirtGeometry(look), inset)];
    case 'back': {
      const { frame, box } = backFootprint(look);
      return [framePolygon(frame, box.minU + inset, box.maxU - inset, box.minV + inset, box.maxV - inset)];
    }
    case 'tail': {
      const anchor = tailSlotFrame(axolotlBodyGeometry(look).tail, RIG_STILL_POSE.swimPhase, RIG_STILL_POSE.tailAmp);
      const path = new Path2D();
      path.arc(anchor.x, anchor.y, TAIL_SLOT_REACH - inset, 0, TAU);
      return [path];
    }
    case 'socks':
    case 'feet':
      return legSlotFrames(look, RIG_STILL_POSE.swimPhase).map((frame) => {
        const envelope = feetEnvelope(frame);
        return framePolygon(frame, envelope.u0 + inset, envelope.u1 - inset, inset - envelope.vHalf, envelope.vHalf - inset);
      });
  }
}
