/**
 * Pure gliding trajinera rules (issue #78, ND-8 and ND-9): Area 8's timing element. Painted boats
 * glide across a span of the surface lane on a schedule, and each hull blocks the top of the water
 * as it passes. A hull touch is a gentle push aside, out of the hull the shortest way, down or
 * sideways: never a leg, never a hit, never a dropped find and never protected time. The boat's
 * shadow leads its hull as the warning. Boats only, never fishing (the lures are Area 10's, #108).
 * A boat is never a hazard spawn or a moving hazard, so the danger bar never counts it.
 */
import type { ElementSpawn, ElementType, HazardRect, TrajineraCrossing } from './hazards';
import { PEBBLES, bodyInAnyRock, type RockWall } from './pebble';
import type { Vec2 } from './vec';
import { SURF, type Point, type SwimBounds } from './zone';

/** Gliding trajinera tuning (issue #78, ND-8 and ND-9). */
export interface TrajineraTuning {
  /** Glide speed in px/s. */
  speed: number;
  /** Hull length in px along the lane. */
  hullLength: number;
  /** Depth in px of water the hull blocks, down from SURF. */
  hullDepth: number;
  /** Seconds of travel the shadow leads the hull by: the warning. */
  shadowLead: number;
  /** Speed in px/s of a push; at most the tilapia bump speed. */
  pushSpeed: number;
  /** Seconds after a boat pushes before that boat can push again. */
  pushCooldown: number;
  /** Distance in px from the body centre to the body edge that meets the hull. */
  bodyReach: number;
  /** Height in px of the bob above and below the boat's resting line; none under reduced motion. */
  bobAmplitude: number;
  /** Seconds for one full bob. Must be greater than 0. */
  bobPeriod: number;
}

/**
 * Provisional trajinera values (issue #78, ND-8 and ND-9); tune in play. Boats glide at 70 px/s
 * and each hull blocks the top 60 px of water. The shadow leads the hull by 1 s of travel, 70 px.
 * The push is 120 px/s, gentler than the tilapia's 160 px/s bump, with a 0.5 s cooldown per boat.
 * bodyReach is the pebble's, the Medium body's half height.
 */
export const TRAJINERAS: Readonly<TrajineraTuning> = Object.freeze({
  speed: 70,
  hullLength: 120,
  hullDepth: 60,
  shadowLead: 1,
  pushSpeed: 120,
  pushCooldown: 0.5,
  bodyReach: PEBBLES.bodyReach,
  bobAmplitude: 2,
  bobPeriod: 2.4,
});

/**
 * The gliding trajinera (issue #78, ND-8), a timing element: a new crossing starts every 6 s
 * (`period`), with no fact card and no meet range, so it is never met. `activeFor` equals `period`
 * because the crossing clock always runs; trajineraHull says when the hull is in its span. It has no
 * sweep (elementSweep), so it is never a mat; its hull band (trajineraHullBand) is what the snacks
 * keep clear of. Each spawn carries its own `trajinera` crossing.
 */
export const GLIDING_TRAJINERA: Readonly<ElementType> = Object.freeze({
  id: 'gliding-trajinera',
  name: 'Gliding trajinera',
  kind: 'cycle',
  period: 6,
  activeFor: 6,
});

/** The longest span in px a hull crosses within one crossing period, nose in to tail out. */
export const TRAJINERA_MAX_SPAN: number =
  TRAJINERAS.speed * GLIDING_TRAJINERA.period - TRAJINERAS.hullLength;

/** A gliding trajinera element, with its crossing. */
export type TrajineraSpawn = ElementSpawn & { trajinera: TrajineraCrossing };

/** One push out of a hull: the boat, where the body centre was, where it is pushed to and the impulse in px/s. */
export interface TrajineraPush {
  id: string;
  from: Point;
  to: Point;
  impulse: Vec2;
}

/**
 * The trip's gliding trajineras (issue #78, ND-8): the boats in element order, the swim bounds and
 * rock walls a push never leaves or enters, and each boat's push cooldown in seconds, in boat order.
 */
export interface TrajineraLane {
  boats: TrajineraSpawn[];
  bounds: SwimBounds;
  rocks: RockWall[];
  cooldowns: number[];
}

/** A lane push: the lane with the pushing boat's cooldown started, and the push. */
export interface TrajineraLanePush {
  lane: TrajineraLane;
  push: TrajineraPush;
}

/**
 * A gliding trajinera element (GLIDING_TRAJINERA) crossing `crossing`, `offset` seconds into its
 * crossing clock. Throws RangeError for a span that is not finite, has no width or is longer than
 * TRAJINERA_MAX_SPAN, a direction that is not 'left' or 'right', or an offset that is not finite.
 */
export function trajineraSpawn(id: string, offset: number, crossing: Readonly<TrajineraCrossing>): TrajineraSpawn {
  const { x0, x1, direction } = crossing;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) {
    throw new RangeError(`trajineraSpawn: ${id} needs a finite span with x0 < x1, got ${x0}..${x1}`);
  }
  if (x1 - x0 > TRAJINERA_MAX_SPAN) {
    throw new RangeError(`trajineraSpawn: ${id} span ${x1 - x0} px is over ${TRAJINERA_MAX_SPAN} px`);
  }
  if (direction !== 'left' && direction !== 'right') {
    throw new RangeError(`trajineraSpawn: ${id} direction must be left or right, got ${String(direction)}`);
  }
  if (!Number.isFinite(offset)) {
    throw new RangeError(`trajineraSpawn: ${id} offset must be finite, got ${offset}`);
  }
  return { id, type: GLIDING_TRAJINERA, offset, trajinera: { x0, x1, direction } };
}

/** The elements that are gliding trajineras, in element order, with their crossings. */
export function trajineras(elements: readonly Readonly<ElementSpawn>[]): TrajineraSpawn[] {
  return elements.filter((element): element is TrajineraSpawn => element.trajinera !== undefined);
}

/** The top `tuning.hullDepth` px of water from SURF across the boat's span: every place its hull can be. */
export function trajineraHullBand(
  boat: Readonly<TrajineraSpawn>,
  tuning: Pick<TrajineraTuning, 'hullDepth'> = TRAJINERAS,
): HazardRect {
  const { x0, x1 } = boat.trajinera;
  return { kind: 'rect', x0, x1, y0: SURF, y1: SURF + tuning.hullDepth };
}

/**
 * The hull at element time `t`, clipped to the span, or null while it is out of the span. Each
 * crossing starts at `offset` and every `period` seconds after: the nose enters the span's
 * upstream end and glides at `speed` until the tail leaves the far end. Any `t` is valid.
 */
export function trajineraHull(
  boat: Readonly<TrajineraSpawn>,
  t: number,
  tuning: Pick<TrajineraTuning, 'speed' | 'hullLength' | 'hullDepth'> = TRAJINERAS,
): HazardRect | null {
  const { period } = boat.type;
  const { x0, x1, direction } = boat.trajinera;
  const phase = (((t - boat.offset) % period) + period) % period;
  const travelled = tuning.speed * phase;
  if (!(travelled > 0) || travelled >= x1 - x0 + tuning.hullLength) return null;
  const nose = direction === 'right' ? x0 + travelled : x1 - travelled;
  const tail = direction === 'right' ? nose - tuning.hullLength : nose + tuning.hullLength;
  return {
    kind: 'rect',
    x0: Math.max(x0, Math.min(nose, tail)),
    x1: Math.min(x1, Math.max(nose, tail)),
    y0: SURF,
    y1: SURF + tuning.hullDepth,
  };
}

/**
 * The shadow at element time `t`, the warning: where the hull will be `shadowLead` seconds later,
 * so it leads the hull by `shadowLead` seconds of travel and shows before the hull enters. Null
 * while that place is out of the span.
 */
export function trajineraShadow(
  boat: Readonly<TrajineraSpawn>,
  t: number,
  tuning: Pick<TrajineraTuning, 'speed' | 'hullLength' | 'hullDepth' | 'shadowLead'> = TRAJINERAS,
): HazardRect | null {
  return trajineraHull(boat, t + tuning.shadowLead, tuning);
}

/**
 * The boat's bob in px at time `t`, added to its drawn y: a slow sine of `bobAmplitude`, out of step
 * by the boat's offset. 0 under reduced motion: the boats still glide, since that is gameplay, but
 * never bob. Looks only: the hull and the push never bob.
 */
export function trajineraBob(
  boat: Readonly<TrajineraSpawn>,
  t: number,
  reduced: boolean,
  tuning: Pick<TrajineraTuning, 'bobAmplitude' | 'bobPeriod'> = TRAJINERAS,
): number {
  if (reduced) return 0;
  return tuning.bobAmplitude * Math.sin((2 * Math.PI * (t + boat.offset)) / tuning.bobPeriod);
}

/** Distance from `pos` to the rect; 0 inside or on it. */
function rectDistance(pos: Readonly<Point>, rect: Readonly<HazardRect>): number {
  const dx = Math.max(rect.x0 - pos.x, 0, pos.x - rect.x1);
  const dy = Math.max(rect.y0 - pos.y, 0, pos.y - rect.y1);
  return Math.hypot(dx, dy);
}

/** True when the body centred on `pos` touches the hull: closer than the body reach (edges are clear). */
export function bodyTouchesHull(
  pos: Readonly<Point>,
  hull: Readonly<HazardRect>,
  tuning: Pick<TrajineraTuning, 'bodyReach'> = TRAJINERAS,
): boolean {
  return rectDistance(pos, hull) < tuning.bodyReach;
}

/** True when `pos` is inside the swim bounds, edges included. */
function inBounds(pos: Readonly<Point>, bounds: Readonly<SwimBounds>): boolean {
  return pos.x >= bounds.minX && pos.x <= bounds.maxX && pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

/**
 * Where the body centred on `pos` goes out of the hull: the nearest of straight down under it,
 * left of it and right of it, each at the body reach from the hull, and never up. A way that ends
 * out of the swim bounds or in rock is never taken; down wins a tie, then left. Null when no way
 * is open.
 */
export function pushOutOfHull(
  pos: Readonly<Point>,
  hull: Readonly<HazardRect>,
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Pick<TrajineraTuning, 'bodyReach'> = TRAJINERAS,
): Point | null {
  const reach = tuning.bodyReach;
  const ways: Point[] = [
    { x: pos.x, y: hull.y1 + reach },
    { x: hull.x0 - reach, y: pos.y },
    { x: hull.x1 + reach, y: pos.y },
  ];
  let best: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const way of ways) {
    const distance = Math.hypot(way.x - pos.x, way.y - pos.y);
    if (distance >= bestDistance || !inBounds(way, bounds) || bodyInAnyRock(way, rocks, tuning)) continue;
    best = way;
    bestDistance = distance;
  }
  return best;
}

/**
 * The push from the boat's hull at element time `t` on the body centred on `pos`, ignoring the
 * cooldown: the impulse points from `pos` to pushOutOfHull's way at `pushSpeed`. Null when the hull
 * is out of its span, the body does not touch it or no way out is open.
 */
export function trajineraPush(
  boat: Readonly<TrajineraSpawn>,
  pos: Readonly<Point>,
  t: number,
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Readonly<TrajineraTuning> = TRAJINERAS,
): TrajineraPush | null {
  const hull = trajineraHull(boat, t, tuning);
  if (hull === null || !bodyTouchesHull(pos, hull, tuning)) return null;
  const to = pushOutOfHull(pos, hull, bounds, rocks, tuning);
  if (to === null) return null;
  // INVARIANT: `to` is a full body reach from the hull and a touching body is closer, so length > 0.
  const length = Math.hypot(to.x - pos.x, to.y - pos.y);
  const impulse = { x: ((to.x - pos.x) / length) * tuning.pushSpeed, y: ((to.y - pos.y) / length) * tuning.pushSpeed };
  return { id: boat.id, from: { x: pos.x, y: pos.y }, to, impulse };
}

/**
 * A new trip's lane: a copy of each boat, the bounds and the rocks, sharing no object with them,
 * and every push cooldown at 0.
 */
export function createTrajineraLane(
  boats: readonly Readonly<TrajineraSpawn>[],
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
): TrajineraLane {
  return {
    boats: boats.map((boat) => ({ ...boat, trajinera: { ...boat.trajinera } })),
    bounds: { ...bounds },
    rocks: rocks.map((rock) => ({ ...rock })),
    cooldowns: boats.map(() => 0),
  };
}

/**
 * The lane with every push cooldown counted down by `step` seconds, floored at 0. Returns `lane`
 * itself when every cooldown is already 0, so it can run every frame.
 */
export function tickTrajineraLane(lane: TrajineraLane, step: number): TrajineraLane {
  if (lane.cooldowns.every((left) => left === 0)) return lane;
  return { ...lane, cooldowns: lane.cooldowns.map((left) => Math.max(0, left - step)) };
}

/**
 * The first boat, in boat order, whose cooldown is 0 and whose hull at element time `t` pushes the
 * body centred on `pos` (trajineraPush), with that boat's cooldown started. Null when no boat
 * pushes. A push never costs a leg, never hits, drops nothing and starts no protected time.
 */
export function pushFromTrajineras(
  lane: TrajineraLane,
  pos: Readonly<Point>,
  t: number,
  tuning: Readonly<TrajineraTuning> = TRAJINERAS,
): TrajineraLanePush | null {
  for (let index = 0; index < lane.boats.length; index++) {
    if (lane.cooldowns[index] > 0) continue;
    const push = trajineraPush(lane.boats[index], pos, t, lane.bounds, lane.rocks, tuning);
    if (push === null) continue;
    const cooldowns = [...lane.cooldowns];
    cooldowns[index] = tuning.pushCooldown;
    return { lane: { ...lane, cooldowns }, push };
  }
  return null;
}
