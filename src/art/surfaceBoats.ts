/**
 * Where the boats at the surface are drawn, and where the moored hulls fit between them (Area 8).
 * Every surface boat has painted art wider than the zone it blocks: a punting pole's bow and
 * shadow reach well past its thin touch zone, and a gliding trajinera's hull and shadow frames
 * reach past its route. The moored boats' shade is stretched to each bank overhang rect, but each
 * moored hull is a whole, unstretched hull set only where no other surface boat is drawn.
 *
 * Pure: no Phaser calls, no game state, no randomness. It reads the layout data and the texture
 * frames only.
 */
import { movingHazardBaseY, type MovingHazardSpawn } from '../logic/movingHazards';
import type { TrajineraSpawn } from '../logic/trajineras';
import { SURF, type BankOverhang } from '../logic/zone';
import type { TexSize } from './canvasKit';
import { TRAJINERA_HULL_TEX, TRAJINERA_HULL_W, TRAJINERA_SHADOW_TEX } from './drawDeepCanal';
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

/** The layout data that holds surface boats: a zone's moving hazards and gliding trajineras. */
export interface SurfaceBoatSource {
  readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[];
  readonly trajineras?: readonly Readonly<TrajineraSpawn>[];
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

/**
 * The x-extent of every surface boat's art in `source`: each moving hazard whose base is the
 * surface (SURF) gets the union of its look's bow and shadow frames, and each gliding trajinera
 * its route widened by TRAJINERA_FRAME_OVERHANG. Moving hazards first, then trajineras, each in
 * data order. Throws when a surface moving hazard's look has no art.
 */
export function surfaceBoatSpans(source: Readonly<SurfaceBoatSource>): SurfaceBoatSpan[] {
  const hazards = (source.movingHazards ?? []).filter((spawn) => movingHazardBaseY(spawn) === SURF);
  return [...hazards.map(measureMovingHazardSpan), ...(source.trajineras ?? []).map(measureTrajineraSpan)];
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
