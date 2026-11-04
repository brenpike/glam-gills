/**
 * Where the boats at the surface are drawn, and where the moored hulls fit between them (Areas 8 to 11).
 * Every surface boat has painted art wider than the zone it blocks: a punting pole's bow and
 * shadow reach well past its thin touch zone, a gliding trajinera's hull and shadow frames
 * reach past its route, a bailing boat's hull and its bucket's frames (Area 9, issue #107) need
 * not sit inside its span, a fishing trajinera's hull, shadow, rods and float beads (Area 10, issue
 * #108) reach past its drift span, and a drag net's two boats (leaning in the warning) sit outside
 * its stretch with the float line between them. The moored boats' shade is stretched to each bank overhang rect, but each
 * moored hull is a whole, unstretched hull set only where no other surface boat is drawn.
 *
 * Pure: no Phaser calls, no game state, no randomness. It reads the layout data and the texture
 * frames only.
 */
import type { BailingBoatSpawn } from '../logic/bailingBuckets';
import type { DragNetSpawn } from '../logic/dragNets';
import { fishingBoatBand, type FishingBoatSpawn } from '../logic/lures';
import { movingHazardBaseY, type MovingHazardSpawn } from '../logic/movingHazards';
import type { TrajineraSpawn } from '../logic/trajineras';
import { SURF, type BankOverhang } from '../logic/zone';
import type { TexSize } from './canvasKit';
import {
  BAILING_BOAT_TEX,
  BAILING_BUCKET_FRONT_TEX,
  BAILING_BUCKET_TEX,
  BAILING_RIPPLES_TEX,
  BAILING_SHADOW_TEX,
} from './drawBailingBucket';
import { TRAJINERA_HULL_TEX, TRAJINERA_HULL_W, TRAJINERA_SHADOW_TEX } from './drawDeepCanal';
import { DRAG_NET_BOAT_TEX, DRAG_NET_MOTION } from './drawDragNet';
import {
  FISHING_BEAD_TEX,
  FISHING_BOAT_TEX,
  FISHING_BOAT_W,
  FISHING_ROD_HOLDER,
  FISHING_ROD_TEX,
  FISHING_SHADOW_TEX,
} from './drawFishingTrajinera';
import { MOVING_HAZARD_LOOKS } from './movingHazardTextures';

/** Least clear water in px between a moored hull's frame and any other surface boat's art. */
export const SURFACE_BOAT_GAP = 8;
/** Water in px between neighbouring moored hulls' frames, hull to hull. */
export const MOORED_HULL_GAP = 14;

/** The x-extent of one surface boat's art, world px, with the id of the hazard or boat it belongs to. */
export interface SurfaceBoatSpan {
  readonly id: string;
  readonly x0: number;
  readonly x1: number;
}

/** The layout data that holds surface boats: a zone's moving hazards, gliding trajineras, bailing boats, fishing trajineras and drag nets. */
export interface SurfaceBoatSource {
  readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[];
  readonly trajineras?: readonly Readonly<TrajineraSpawn>[];
  readonly bailingBoats?: readonly Readonly<BailingBoatSpawn>[];
  readonly fishingBoats?: readonly Readonly<FishingBoatSpawn>[];
  readonly dragNets?: readonly Readonly<DragNetSpawn>[];
}

/** How far a frame centred on a hull-long rect reaches past either end of it, px: the larger side. */
function measureFrameOverhang(tex: TexSize, halfLength: number): number {
  return Math.max(tex.originX - halfLength, tex.w - tex.originX - halfLength);
}

/**
 * How far a gliding trajinera's art reaches past its hull rect along the lane, px: the larger of
 * the hull frame's and the shadow frame's overhang, on either side (the scene mirrors both).
 */
export const TRAJINERA_FRAME_OVERHANG: number = Math.max(
  measureFrameOverhang(TRAJINERA_HULL_TEX, TRAJINERA_HULL_W / 2),
  measureFrameOverhang(TRAJINERA_SHADOW_TEX, TRAJINERA_HULL_W / 2),
);

/** The union of a surface moving hazard's bow and shadow frame x-extents, both anchored at its x. Throws for a look with no art. */
function measureMovingHazardSpan(spawn: Readonly<MovingHazardSpawn>): SurfaceBoatSpan {
  const look = MOVING_HAZARD_LOOKS[spawn.type.look];
  if (look === undefined) {
    throw new Error(`surfaceBoatSpans: moving hazard ${spawn.id} has look "${spawn.type.look}", which has no art`);
  }
  const { bow, shadow } = look.parts;
  return {
    id: spawn.id,
    x0: spawn.x - Math.max(bow.tex.originX, shadow.tex.originX),
    x1: spawn.x + Math.max(bow.tex.w - bow.tex.originX, shadow.tex.w - shadow.tex.originX),
  };
}

/** A gliding trajinera's whole route, widened by TRAJINERA_FRAME_OVERHANG at each end. */
function measureTrajineraSpan(boat: Readonly<TrajineraSpawn>): SurfaceBoatSpan {
  const { x0, x1 } = boat.trajinera;
  return { id: boat.id, x0: x0 - TRAJINERA_FRAME_OVERHANG, x1: x1 + TRAJINERA_FRAME_OVERHANG };
}

/** The frames drawn around a bailing boat's bucket x: the bucket, its front wall, its shadow and its ripples. */
const BAILING_BUCKET_FRAMES: readonly TexSize[] = [BAILING_BUCKET_TEX, BAILING_BUCKET_FRONT_TEX, BAILING_SHADOW_TEX, BAILING_RIPPLES_TEX];

/**
 * A bailing boat's span: the union of its hull span, its hull frame (BAILING_BOAT_TEX) anchored at
 * the middle of that span, and the bucket, front wall, shadow and ripple frames anchored at its
 * bucket's x.
 */
function measureBailingBoatSpan(boat: Readonly<BailingBoatSpawn>): SurfaceBoatSpan {
  const { x0, x1, bucketX } = boat.bailing;
  const hullX = (x0 + x1) / 2;
  return {
    id: boat.id,
    x0: Math.min(x0, hullX - BAILING_BOAT_TEX.originX, ...BAILING_BUCKET_FRAMES.map((tex) => bucketX - tex.originX)),
    x1: Math.max(
      x1,
      hullX + BAILING_BOAT_TEX.w - BAILING_BOAT_TEX.originX,
      ...BAILING_BUCKET_FRAMES.map((tex) => bucketX + tex.w - tex.originX),
    ),
  };
}

/** A frame's x-extent from its anchor, px: `x0` to its left edge (negative) and `x1` to its right. */
interface FrameReach {
  readonly x0: number;
  readonly x1: number;
}

/** The x-extent from the anchor of `tex` placed at `at` px along x, mirrored when `mirrored`. */
function reachOf(tex: TexSize, at: number, mirrored: boolean): FrameReach {
  const left = -tex.originX;
  const right = tex.w - tex.originX;
  return mirrored ? { x0: at - right, x1: at - left } : { x0: at + left, x1: at + right };
}

/**
 * The x-extent from a fishing trajinera's hull middle of its hull and shadow frames, a rod frame at
 * each end (the right one leaning +x, the left mirrored) and a float bead frame at each lure's place
 * along the hull: the bead and the rods are drawn at the lures' logic x, the rods only at the ends.
 */
function measureFishingFrameReach(boat: Readonly<FishingBoatSpawn>): FrameReach {
  const reaches = [
    reachOf(FISHING_BOAT_TEX, 0, false),
    reachOf(FISHING_SHADOW_TEX, 0, false),
    reachOf(FISHING_ROD_TEX, FISHING_ROD_HOLDER.x, false),
    reachOf(FISHING_ROD_TEX, -FISHING_ROD_HOLDER.x, true),
    ...boat.lures.map((lure) => reachOf(FISHING_BEAD_TEX, lure.along - FISHING_BOAT_W / 2, false)),
  ];
  return { x0: Math.min(...reaches.map((reach) => reach.x0)), x1: Math.max(...reaches.map((reach) => reach.x1)) };
}

/**
 * A fishing trajinera's span: its whole drift span (fishingBoatBand), the hull middle running from
 * half a hull in from its west end to half a hull in from its east end, widened by its frames'
 * reach from the hull middle (measureFishingFrameReach) at each end.
 */
function measureFishingBoatSpan(boat: Readonly<FishingBoatSpawn>): SurfaceBoatSpan {
  const band = fishingBoatBand(boat);
  const reach = measureFishingFrameReach(boat);
  return { id: boat.id, x0: band.x0 + FISHING_BOAT_W / 2 + reach.x0, x1: band.x1 - FISHING_BOAT_W / 2 + reach.x1 };
}

/**
 * The most a frame reaches from its anchor along x, px, when it is turned up to `rad` either way
 * about the anchor: its farthest corner's reach along x and along y, turned by `rad`.
 */
function measureTurnedReach(tex: TexSize, rad: number): number {
  const reachX = Math.max(tex.originX, tex.w - tex.originX);
  const reachY = Math.max(tex.originY, tex.h - tex.originY);
  return reachX * Math.cos(rad) + reachY * Math.sin(rad);
}

/** How far a drag net boat's frame reaches from its anchor along x at its warning lean (DRAG_NET_MOTION.leanRad), px. */
export const DRAG_NET_BOAT_REACH: number = measureTurnedReach(DRAG_NET_BOAT_TEX, DRAG_NET_MOTION.leanRad);

/**
 * A drag net's span: both its boats, their middles FISHING_BOAT_W / 2 px outside the stretch's west
 * and east edges, each widened by DRAG_NET_BOAT_REACH, and so the float line and floats between them.
 */
function measureDragNetSpan(net: Readonly<DragNetSpawn>): SurfaceBoatSpan {
  const { x0, x1 } = net.dragNet.stretch;
  return { id: net.id, x0: x0 - FISHING_BOAT_W / 2 - DRAG_NET_BOAT_REACH, x1: x1 + FISHING_BOAT_W / 2 + DRAG_NET_BOAT_REACH };
}

/**
 * The x-extent of every surface boat's art in `source`: each moving hazard whose base is the
 * surface (SURF) gets the union of its look's bow and shadow frames, each gliding trajinera its
 * route widened by TRAJINERA_FRAME_OVERHANG, each bailing boat the union of its hull span and its
 * hull and bucket frames, each fishing trajinera its whole drift span widened by its frames, and each
 * drag net both its boats at their lean and the float line between them. Moving hazards first, then
 * trajineras, bailing boats, fishing trajineras and drag nets, each in data order. Throws when a
 * surface moving hazard's look has no art.
 */
export function surfaceBoatSpans(source: Readonly<SurfaceBoatSource>): SurfaceBoatSpan[] {
  const hazards = (source.movingHazards ?? []).filter((spawn) => movingHazardBaseY(spawn) === SURF);
  return [
    ...hazards.map(measureMovingHazardSpan),
    ...(source.trajineras ?? []).map(measureTrajineraSpan),
    ...(source.bailingBoats ?? []).map(measureBailingBoatSpan),
    ...(source.fishingBoats ?? []).map(measureFishingBoatSpan),
    ...(source.dragNets ?? []).map(measureDragNetSpan),
  ];
}

/** The left x of as many whole hulls as fit in x0..x1, MOORED_HULL_GAP apart and centred in it. */
function fitHullsInStretch(x0: number, x1: number, hullFrameW: number): number[] {
  const width = x1 - x0;
  if (width < hullFrameW) return [];
  const count = Math.floor((width + MOORED_HULL_GAP) / (hullFrameW + MOORED_HULL_GAP));
  const start = x0 + (width - (count * hullFrameW + (count - 1) * MOORED_HULL_GAP)) / 2;
  return Array.from({ length: count }, (_, index) => start + index * (hullFrameW + MOORED_HULL_GAP));
}

/**
 * The left x of each whole moored hull frame (`hullFrameW` wide) in `rect`, west to east. Each
 * span in `spans`, widened by SURFACE_BOAT_GAP each side, is taken out of the rect; each stretch
 * left gets as many hulls as fit, MOORED_HULL_GAP apart and centred in it. A hull is never
 * stretched, so a stretch narrower than one hull gets none. Throws RangeError for a hull frame
 * width that is not finite and above 0.
 */
export function mooredHullSlots(
  rect: Readonly<Pick<BankOverhang, 'x0' | 'x1'>>,
  spans: readonly Readonly<SurfaceBoatSpan>[],
  hullFrameW: number,
): number[] {
  if (!Number.isFinite(hullFrameW) || !(hullFrameW > 0)) {
    throw new RangeError(`mooredHullSlots: hull frame width must be finite and above 0, got ${hullFrameW}`);
  }
  const blocked = spans
    .map((span) => [span.x0 - SURFACE_BOAT_GAP, span.x1 + SURFACE_BOAT_GAP] as const)
    .sort((a, b) => a[0] - b[0]);
  const slots: number[] = [];
  let freeFrom = rect.x0;
  for (const [blockedX0, blockedX1] of blocked) {
    slots.push(...fitHullsInStretch(freeFrom, Math.min(blockedX0, rect.x1), hullFrameW));
    freeFrom = Math.max(freeFrom, blockedX1);
  }
  slots.push(...fitHullsInStretch(freeFrom, rect.x1, hullFrameW));
  return slots;
}
