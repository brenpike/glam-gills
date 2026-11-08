/**
 * Pure drifting island rules (issue #213): floating reed mats at the surface of the open lake. Each
 * island drifts slowly back and forth along its path, turning at once at each end, and the element's
 * offset puts neighbouring islands out of step. An island is moving shelter from the pelican line
 * only: a bird whose scoop box would overlap an island at any moment of that scoop, from the start of
 * the plunge to the end of the rise, does not dip that scoop. An island never slows, blocks or pushes
 * the axolotl, is never a reed patch, is no cover for the hiding rules or from any other predator, is
 * never met and has no fact card. Its drift is gameplay, so it carries on under reduced motion.
 */
import {
  shapeDistance,
  type DriftingIslandPath,
  type ElementSpawn,
  type ElementType,
  type HazardRect,
} from './hazards';
import {
  pelicanLinePeriod,
  pelicanScoopBoxes,
  pelicanScoopHit,
  pelicanScoopNumber,
  type PelicanLineSpawn,
} from './pelicanLine';
import type { Point } from './zone';

/** Drifting island tuning (issue #213). */
export interface DriftingIslandTuning {
  /** Width in px of each island along x. */
  width: number;
  /** Speed in px/s each island drifts along its path. */
  speed: number;
}

/** Owner-approved drifting island values (issue #213): each island 240 px wide, drifting at 16 px/s. */
export const DRIFTING_ISLANDS: Readonly<DriftingIslandTuning> = Object.freeze({
  width: 240,
  speed: 16,
});

/**
 * The drifting island (issue #213), a timing element: always active (`activeFor` equals `period`)
 * because its drift clock always runs, with no fact card and no meet range, so it is never met. Its
 * own drift loop depends on its path (driftingIslandLoop). It has no sweep (elementSweep), so it never
 * blocks the axolotl and the snacks never keep away from it. Each spawn carries its own `island` path.
 */
export const DRIFTING_ISLAND: Readonly<ElementType> = Object.freeze({
  id: 'drifting-island',
  name: 'Drifting island',
  kind: 'cycle',
  period: 1,
  activeFor: 1,
});

/** A drifting island element, with its path. */
export type DriftingIslandSpawn = ElementSpawn & { island: DriftingIslandPath };

/** An island's x span at one moment, or every x it covers over a stretch of time. Inclusive edges. */
export interface IslandSpan {
  x0: number;
  x1: number;
}

/**
 * A drifting island element (DRIFTING_ISLAND) over `path`, `offset` seconds into its drift clock:
 * its first drift, heading `path.direction`, starts at `offset` from the path's end it heads away
 * from. Throws RangeError for a path that is not finite or has x0 not under x1, a path not longer than
 * one island, a direction that is not 'left' or 'right', or an offset that is not finite.
 */
export function driftingIslandSpawn(id: string, offset: number, path: Readonly<DriftingIslandPath>): DriftingIslandSpawn {
  const { x0, x1, direction } = path;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x0 < x1)) {
    throw new RangeError(`driftingIslandSpawn: ${id} needs a finite path with x0 < x1, got ${x0}..${x1}`);
  }
  if (!(x1 - x0 > DRIFTING_ISLANDS.width)) {
    throw new RangeError(`driftingIslandSpawn: ${id} path ${x1 - x0} px is not longer than the ${DRIFTING_ISLANDS.width} px island`);
  }
  if (direction !== 'left' && direction !== 'right') {
    throw new RangeError(`driftingIslandSpawn: ${id} direction must be left or right, got ${String(direction)}`);
  }
  if (!Number.isFinite(offset)) {
    throw new RangeError(`driftingIslandSpawn: ${id} offset must be finite, got ${offset}`);
  }
  return { id, type: DRIFTING_ISLAND, offset, island: { x0, x1, direction } };
}

/** True when the element is a drifting island: it has an island path. */
export function isDriftingIsland(element: Readonly<ElementSpawn>): element is Readonly<DriftingIslandSpawn> {
  return element.island !== undefined;
}

/** The elements that are drifting islands, in element order. */
export function driftingIslands(elements: readonly Readonly<ElementSpawn>[]): Readonly<DriftingIslandSpawn>[] {
  return elements.filter(isDriftingIsland);
}

/** Px the island's left edge travels from one end of its path to the other. */
function islandTravel(island: Readonly<DriftingIslandSpawn>): number {
  return island.island.x1 - island.island.x0 - DRIFTING_ISLANDS.width;
}

/** Seconds for one full drift there and back over the island's path. */
export function driftingIslandLoop(island: Readonly<DriftingIslandSpawn>): number {
  return (2 * islandTravel(island)) / DRIFTING_ISLANDS.speed;
}

/** Px the island has drifted by element time `t` since `t = offset`: negative before it. */
function driftedDistance(island: Readonly<DriftingIslandSpawn>, t: number): number {
  return DRIFTING_ISLANDS.speed * (t - island.offset);
}

/** How far in px the island's left edge is from its starting end after drifting `distance` px, in [0, travel]. */
function fromStart(distance: number, travel: number): number {
  const loop = 2 * travel;
  const driven = ((distance % loop) + loop) % loop;
  return driven <= travel ? driven : loop - driven;
}

/** The island's x span with its left edge `along` px from its starting end. */
function spanFromStart(island: Readonly<DriftingIslandSpawn>, along: number): IslandSpan {
  const { x0, x1, direction } = island.island;
  const left = direction === 'right' ? x0 + along : x1 - DRIFTING_ISLANDS.width - along;
  return { x0: left, x1: left + DRIFTING_ISLANDS.width };
}

/**
 * The island's x span at element time `t`, `DRIFTING_ISLANDS.width` wide: from `offset` it drifts
 * from the end it heads away from at `DRIFTING_ISLANDS.speed`, turns at once at the far end and
 * drifts back, over and over. Any finite `t` is valid, negative included. Not changed by reduced
 * motion.
 */
export function islandSpanAt(island: Readonly<DriftingIslandSpawn>, t: number): IslandSpan {
  return spanFromStart(island, fromStart(driftedDistance(island, t), islandTravel(island)));
}

/** Every x the island covers at some moment from element time `from` to `to`, `from` at most `to`. */
function islandSweepBetween(island: Readonly<DriftingIslandSpawn>, from: number, to: number): IslandSpan {
  const travel = islandTravel(island);
  const start = driftedDistance(island, from);
  const end = driftedDistance(island, to);
  if (end - start >= 2 * travel) return { x0: island.island.x0, x1: island.island.x1 };
  let near = Math.min(fromStart(start, travel), fromStart(end, travel));
  let far = Math.max(fromStart(start, travel), fromStart(end, travel));
  for (let turn = Math.ceil(start / travel); turn * travel <= end; turn++) {
    if (turn % 2 === 0) near = 0;
    else far = travel;
  }
  const nearSpan = spanFromStart(island, near);
  const farSpan = spanFromStart(island, far);
  return { x0: Math.min(nearSpan.x0, farSpan.x0), x1: Math.max(nearSpan.x1, farSpan.x1) };
}

/** Element times of the scoop holding element time `t`: the start of its plunge and the end of its rise. */
function scoopWindow(line: Readonly<PelicanLineSpawn>, t: number): { from: number; to: number } {
  const period = pelicanLinePeriod(line);
  const cycleStart = line.offset + pelicanScoopNumber(line, t) * period;
  const { glideFor, warnFor } = line.tuning;
  return { from: cycleStart + glideFor + warnFor, to: cycleStart + period };
}

/** True when the box and the span share any x, edges inclusive. */
function overlapsInX(box: Readonly<HazardRect>, span: Readonly<IslandSpan>): boolean {
  return box.x0 <= span.x1 && span.x0 <= box.x1;
}

/**
 * True when bird `bird` of `line` does not dip the scoop holding element time `t` (issue #213): its
 * scoop box overlaps some island of `islands`, edges inclusive, at any moment of that scoop, from the
 * start of the plunge to the end of the rise. The scoop holding `t` is the one of the cycle `t` is in
 * (pelicanScoopNumber), so through the glide and the warning it is the coming scoop, and the answer
 * stays the same for every `t` of one cycle. False with no islands. Throws RangeError for an index
 * that is not a bird of the line.
 */
export function pelicanBirdSheltered(
  line: Readonly<PelicanLineSpawn>,
  bird: number,
  t: number,
  islands: readonly Readonly<DriftingIslandSpawn>[],
): boolean {
  if (!Number.isInteger(bird) || bird < 0 || bird >= line.tuning.count) {
    throw new RangeError(`pelicanBirdSheltered: ${line.id} has no bird ${bird}`);
  }
  if (islands.length === 0) return false;
  const { from, to } = scoopWindow(line, t);
  const box = pelicanScoopBoxes(line, (from + to) / 2)[bird];
  if (box === undefined) throw new Error(`pelicanBirdSheltered: ${line.id} has no scoop box for bird ${bird}`);
  return islands.some((island) => overlapsInX(box, islandSweepBetween(island, from, to)));
}

/**
 * As pelicanScoopHit, but a bird sheltered by `islands` for this scoop (pelicanBirdSheltered) never
 * bumps: the index of the first unsheltered bird (leftmost first) whose scoop box is within the touch
 * reach of the body centre `pos` at element time `t`, edge inclusive, else null. With no islands it
 * returns exactly what pelicanScoopHit returns. It reads `pos` only and never moves the axolotl.
 */
export function shelteredScoopHit(
  line: Readonly<PelicanLineSpawn>,
  pos: Readonly<Point>,
  t: number,
  islands: readonly Readonly<DriftingIslandSpawn>[],
): number | null {
  if (islands.length === 0) return pelicanScoopHit(line, pos, t);
  const index = pelicanScoopBoxes(line, t).findIndex(
    (box, bird) => shapeDistance(pos, box) <= line.tuning.touchReach && !pelicanBirdSheltered(line, bird, t, islands),
  );
  return index === -1 ? null : index;
}
