/**
 * Pure hazard sound edges (PRD S9, S11; issue #166, ND-4 to ND-7): the trip moments with no trip
 * event that play a sound. The router keeps the last HazardSnapshot of the trip, asks
 * hazardSoundEdges each frame with the camera's world view, then records the frame's snapshot with
 * hazardSnapshot. Edges come only while swimming and never on a trip's first frame.
 */
import type { EncounterState } from './encounter';
import { isSnagged } from './ghostNets';
import type { ElementSpawn, MatPair } from './hazards';
import { matPhase, WATER_HYACINTH } from './hyacinthMats';
import { movingHazardDepth, movingHazardPhase, type MovingHazardSpawn } from './movingHazards';
import type { TripState } from './trip';
import { SURF } from './zone';

/** The parts of a trip the hazard sound edges read. A TripState is one. */
export type HazardSoundTrip = Readonly<Pick<TripState, 'phase' | 'ghostNets' | 'elements' | 'elementTime'>> & {
  readonly encounter: Readonly<Pick<EncounterState, 'movingHazards' | 'hazardTime'>>;
};

/**
 * What one frame of a trip leaves for the next frame's edges: whether the explorer was snagged, and
 * the moving hazard clock (undefined when the trip has no moving hazards) and element clock. The
 * phases at both times come from the spawns.
 */
export interface HazardSnapshot {
  readonly snagged: boolean;
  readonly hazardTime: number | undefined;
  readonly elementTime: number;
}

/** The camera's world view: the world rect on screen, as Phaser's `camera.worldView` gives it. */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The hazard edges of one frame: the snag ended (wriggle free, ND-5), an on-screen punting pole
 * started its warning (the ripple, ND-4), and an on-screen mat pair started opening (ND-6). Each is
 * at most one a frame.
 */
export interface HazardEdges {
  readonly snagEnded: boolean;
  readonly poleWarned: boolean;
  readonly matsOpened: boolean;
}

/** No hazard edges. Shared, so a frame with none allocates nothing. */
export const NO_HAZARD_EDGES: HazardEdges = Object.freeze({ snagEnded: false, poleWarned: false, matsOpened: false });

/** The snapshot of `trip` at this frame, for the next frame's hazardSoundEdges. */
export function hazardSnapshot(trip: HazardSoundTrip): HazardSnapshot {
  return { snagged: isSnagged(trip.ghostNets), hazardTime: trip.encounter.hazardTime, elementTime: trip.elementTime };
}

/** Whether the rect `x0..x1` by `y0..y1` overlaps `view` with some area; touching edges do not count. */
function overlapsView(view: ViewRect, x0: number, x1: number, y0: number, y1: number): boolean {
  return x0 < view.x + view.width && x1 > view.x && y0 < view.y + view.height && y1 > view.y;
}

/** Whether the pole's shaft, x ± halfWidth from the surface down to its depth, overlaps `view`. */
function poleOnScreen(spawn: Readonly<MovingHazardSpawn>, view: ViewRect): boolean {
  const { halfWidth } = spawn.type;
  return overlapsView(view, spawn.x - halfWidth, spawn.x + halfWidth, SURF, SURF + movingHazardDepth(spawn));
}

/** Whether the mat pair's box, `x0..x1` by `rowTop..rowBottom`, overlaps `view`. */
function matsOnScreen(pair: Readonly<MatPair>, view: ViewRect): boolean {
  return overlapsView(view, pair.x0, pair.x1, pair.rowTop, pair.rowBottom);
}

/** Whether some on-screen pole goes from 'rest' at `before` to 'warn' at `now` (ND-4). */
function anyPoleWarned(
  spawns: readonly Readonly<MovingHazardSpawn>[],
  before: number,
  now: number,
  view: ViewRect,
): boolean {
  for (const spawn of spawns) {
    if (!poleOnScreen(spawn, view)) continue;
    if (movingHazardPhase(spawn, before).phase === 'rest' && movingHazardPhase(spawn, now).phase === 'warn') return true;
  }
  return false;
}

/** Whether some on-screen water hyacinth mat pair goes into 'opening' between `before` and `now` (ND-6). */
function anyMatsOpened(elements: readonly Readonly<ElementSpawn>[], before: number, now: number, view: ViewRect): boolean {
  for (const element of elements) {
    if (element.type.id !== WATER_HYACINTH.id || !element.matPair || !matsOnScreen(element.matPair, view)) continue;
    if (matPhase(element, before) !== 'opening' && matPhase(element, now) === 'opening') return true;
  }
  return false;
}

/**
 * The hazard edges from `prev`, the trip's snapshot on the last frame (undefined on its first
 * frame), to `trip` now, with the camera's world view `view` (issue #166, ND-4 to ND-7). None on the
 * first frame and none unless the trip is swimming now, so the carry start's endSnag plays no
 * wriggle. The snag ends when the explorer was snagged and is not now (ND-5). A pole warns when it
 * goes from 'rest' to 'warn' with its shaft on screen; several poles in one frame are one edge
 * (ND-4). Mats open when a water hyacinth pair goes into 'opening' with its box on screen; at most
 * one a frame (ND-6). The jab, hold, lift, open, closing and closed phases and off-screen starts give
 * none. Returns NO_HAZARD_EDGES when there are none.
 */
export function hazardSoundEdges(prev: HazardSnapshot | undefined, trip: HazardSoundTrip, view: ViewRect): HazardEdges {
  if (prev === undefined || trip.phase !== 'swimming') return NO_HAZARD_EDGES;
  const snagEnded = prev.snagged && !isSnagged(trip.ghostNets);
  const { movingHazards, hazardTime } = trip.encounter;
  const poleWarned =
    movingHazards !== undefined &&
    hazardTime !== undefined &&
    prev.hazardTime !== undefined &&
    anyPoleWarned(movingHazards, prev.hazardTime, hazardTime, view);
  const matsOpened = anyMatsOpened(trip.elements, prev.elementTime, trip.elementTime, view);
  if (!snagEnded && !poleWarned && !matsOpened) return NO_HAZARD_EDGES;
  return { snagEnded, poleWarned, matsOpened };
}
