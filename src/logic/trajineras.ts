/**
 * Pure gliding trajinera rules (issue #78, ND-8 and ND-9): Area 8's timing element. Painted boats
 * glide across a span of the surface lane on a schedule, and each hull blocks the top of the water
 * as it passes. The hull is solid: every frame the body is held out of it the shortest way, down or
 * sideways and never up (blockAtTrajineras). A hull touch is also a gentle push aside, the feel on
 * top of the hold, with a short cooldown per boat: never a leg, never a hit, never a dropped find
 * and never protected time. The boat's shadow leads its hull as the warning. Boats only, never
 * fishing (the lures are Area 10's, #108). A boat is never a hazard spawn or a moving hazard, so the
 * danger bar never counts it.
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
 * The hull is solid and holds the body out every frame; on top of the hold, the push is 120 px/s,
 * gentler than the tilapia's 160 px/s bump, with a 0.5 s cooldown per boat. bodyReach is the
 * pebble's, the Medium body's half height.
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
 * rock walls a push or a hold never leaves or enters, and each boat's push cooldown in seconds, in
 * boat order.
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

/** One lane step: the lane with its cooldowns, the body centre held out of every hull, and the push, if any. */
export interface TrajineraLaneStep {
  lane: TrajineraLane;
  pos: Point;
  push: TrajineraPush | null;
}

/** A way out of a hull and the unit heading that leads further out of it. */
interface HullWay {
  way: Point;
  heading: Vec2;
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

/** pushOutOfHull's way out of the hull, with the heading that leads further out; null when no way is open. */
function wayOutOfHull(
  pos: Readonly<Point>,
  hull: Readonly<HazardRect>,
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Pick<TrajineraTuning, 'bodyReach'>,
): HullWay | null {
  const reach = tuning.bodyReach;
  const ways: HullWay[] = [
    { way: { x: pos.x, y: hull.y1 + reach }, heading: { x: 0, y: 1 } },
    { way: { x: hull.x0 - reach, y: pos.y }, heading: { x: -1, y: 0 } },
    { way: { x: hull.x1 + reach, y: pos.y }, heading: { x: 1, y: 0 } },
  ];
  let best: HullWay | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of ways) {
    const { way } = candidate;
    const distance = Math.hypot(way.x - pos.x, way.y - pos.y);
    if (distance >= bestDistance || !inBounds(way, bounds) || bodyInAnyRock(way, rocks, tuning)) continue;
    best = candidate;
    bestDistance = distance;
  }
  return best;
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
  return wayOutOfHull(pos, hull, bounds, rocks, tuning)?.way ?? null;
}

/** `value` moved the least float step toward `sign` (1 or -1): at least one unit in the last place. */
function stepFloat(value: number, sign: number): number {
  return value + sign * Math.max(Math.abs(value) * Number.EPSILON, Number.MIN_VALUE);
}

/**
 * The way moved along its heading by the least float steps until the body there touches the hull
 * no longer (bodyTouchesHull): a way a full body reach out can round to just inside it at a
 * fractional hull edge.
 */
function clearOfHull(out: Readonly<HullWay>, hull: Readonly<HazardRect>, tuning: Pick<TrajineraTuning, 'bodyReach'>): Point {
  const held = { x: out.way.x, y: out.way.y };
  while (bodyTouchesHull(held, hull, tuning)) {
    if (out.heading.x !== 0) held.x = stepFloat(held.x, out.heading.x);
    if (out.heading.y !== 0) held.y = stepFloat(held.y, out.heading.y);
  }
  return held;
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
  return pushFromHull(boat, trajineraHull(boat, t, tuning), pos, bounds, rocks, tuning);
}

/** trajineraPush with the boat's hull already found: null when `hull` is null. */
function pushFromHull(
  boat: Readonly<TrajineraSpawn>,
  hull: Readonly<HazardRect> | null,
  pos: Readonly<Point>,
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Readonly<TrajineraTuning>,
): TrajineraPush | null {
  if (hull === null || !bodyTouchesHull(pos, hull, tuning)) return null;
  const to = pushOutOfHull(pos, hull, bounds, rocks, tuning);
  if (to === null) return null;
  // INVARIANT: `to` is a full body reach from the hull and a touching body is closer, so length > 0.
  const length = Math.hypot(to.x - pos.x, to.y - pos.y);
  const impulse = { x: ((to.x - pos.x) / length) * tuning.pushSpeed, y: ((to.y - pos.y) / length) * tuning.pushSpeed };
  return { id: boat.id, from: { x: pos.x, y: pos.y }, to, impulse };
}

/** True when the body row at `y` from `x0` to `x1`, ends included, meets the wall grown by `reach` (bodyInRock). */
function rockMeetsRow(wall: Readonly<RockWall>, y: number, x0: number, x1: number, reach: number): boolean {
  if (!(y > wall.y0 - reach && y < wall.y1 + reach)) return false;
  return x0 <= x1 && x0 < wall.x1 + reach && x1 > wall.x0 - reach;
}

/**
 * Throws RangeError when the row under the boat's hull band, where a hold out of the hull goes
 * down, is out of the swim bounds or meets rock anywhere a touching body can be.
 */
function checkBandRow(
  boat: Readonly<TrajineraSpawn>,
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Pick<TrajineraTuning, 'hullDepth' | 'bodyReach'>,
): void {
  const reach = tuning.bodyReach;
  const row = SURF + tuning.hullDepth + reach;
  if (!(row >= bounds.minY && row <= bounds.maxY)) {
    throw new RangeError(`createTrajineraLane: ${boat.id} band row y ${row} is out of the swim bounds`);
  }
  const x0 = Math.max(bounds.minX, boat.trajinera.x0 - reach);
  const x1 = Math.min(bounds.maxX, boat.trajinera.x1 + reach);
  if (rocks.some((wall) => rockMeetsRow(wall, row, x0, x1, reach))) {
    throw new RangeError(`createTrajineraLane: ${boat.id} band row y ${row} meets rock`);
  }
}

/** Throws RangeError when two boats' spans are less than twice the body reach apart, overlap included. */
function checkSpanGaps(boats: readonly Readonly<TrajineraSpawn>[], tuning: Pick<TrajineraTuning, 'bodyReach'>): void {
  for (let first = 0; first < boats.length; first++) {
    for (let second = first + 1; second < boats.length; second++) {
      const a = boats[first].trajinera;
      const b = boats[second].trajinera;
      const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1);
      if (gap < 2 * tuning.bodyReach) {
        throw new RangeError(
          `createTrajineraLane: ${boats[first].id} and ${boats[second].id} spans are ${gap} px apart, under ${2 * tuning.bodyReach} px`,
        );
      }
    }
  }
}

/**
 * A new trip's lane: a copy of each boat, the bounds and the rocks, sharing no object with them,
 * and every push cooldown at 0. Throws RangeError when, for some boat, the row at
 * `SURF + hullDepth + bodyReach` is out of the bounds' y range or meets rock (bodyInRock) anywhere
 * from `max(bounds.minX, x0 - bodyReach)` to `min(bounds.maxX, x1 + bodyReach)`, or when two
 * boats' spans are less than `2 * bodyReach` apart, overlap included. So a hold out of a hull
 * always has a way down, and a body touches at most one hull.
 */
export function createTrajineraLane(
  boats: readonly Readonly<TrajineraSpawn>[],
  bounds: Readonly<SwimBounds>,
  rocks: readonly Readonly<RockWall>[],
  tuning: Pick<TrajineraTuning, 'hullDepth' | 'bodyReach'> = TRAJINERAS,
): TrajineraLane {
  for (const boat of boats) checkBandRow(boat, bounds, rocks, tuning);
  checkSpanGaps(boats, tuning);
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
  return pushFromReadyBoat(lane, pos, (index) => trajineraHull(lane.boats[index], t, tuning), tuning);
}

/** pushFromTrajineras with each boat's hull from `hullOf`, asked only for ready boats, in boat order. */
function pushFromReadyBoat(
  lane: TrajineraLane,
  pos: Readonly<Point>,
  hullOf: (index: number) => HazardRect | null,
  tuning: Readonly<TrajineraTuning>,
): TrajineraLanePush | null {
  for (let index = 0; index < lane.boats.length; index++) {
    if (lane.cooldowns[index] > 0) continue;
    const push = pushFromHull(lane.boats[index], hullOf(index), pos, lane.bounds, lane.rocks, tuning);
    if (push === null) continue;
    const cooldowns = [...lane.cooldowns];
    cooldowns[index] = tuning.pushCooldown;
    return { lane: { ...lane, cooldowns }, push };
  }
  return null;
}

/**
 * The body centre `pos` held out of `hulls` (the lane's boats' hulls, in boat order): a copy of
 * `pos` when it touches none, else pushOutOfHull's way out of the first hull it touches, moved on
 * by float steps until it touches that hull no longer. Throws Error when no way is open, or when the
 * held place is out of the bounds, in rock or touching a hull.
 */
function holdOutOfHulls(
  lane: TrajineraLane,
  pos: Readonly<Point>,
  hulls: readonly (HazardRect | null)[],
  tuning: Pick<TrajineraTuning, 'bodyReach'>,
): Point {
  let held: Point = { x: pos.x, y: pos.y };
  const touches = (hull: HazardRect | null): boolean => hull !== null && bodyTouchesHull(held, hull, tuning);
  for (let index = 0; index < hulls.length; index++) {
    const hull = hulls[index];
    if (hull === null || !bodyTouchesHull(pos, hull, tuning)) continue;
    const out = wayOutOfHull(pos, hull, lane.bounds, lane.rocks, tuning);
    if (out === null) {
      throw new Error(`blockAtTrajineras: no way out of ${lane.boats[index].id}'s hull is open at (${pos.x}, ${pos.y})`);
    }
    held = clearOfHull(out, hull, tuning);
    if (!inBounds(held, lane.bounds) || bodyInAnyRock(held, lane.rocks, tuning) || hulls.some(touches)) {
      throw new Error(`blockAtTrajineras: the way out of ${lane.boats[index].id}'s hull at (${held.x}, ${held.y}) is not clear`);
    }
    return held;
  }
  return held;
}

/** Every boat's hull at element time `t`, in boat order, each found once. */
function laneHulls(
  lane: TrajineraLane,
  t: number,
  tuning: Pick<TrajineraTuning, 'speed' | 'hullLength' | 'hullDepth'>,
): (HazardRect | null)[] {
  return lane.boats.map((boat) => trajineraHull(boat, t, tuning));
}

/**
 * The body centred on `pos` held out of every hull at element time `t` (trajineraHull, clipped to
 * its span, never bobbed): the hull is solid every frame, whatever the push cooldown. A copy of
 * `pos` when the body touches no hull; else pushOutOfHull's way out of the hull it touches, down or
 * sideways and never up, within the lane's bounds and out of its rocks. The result never touches
 * any hull (bodyTouchesHull is false), even at a fractional hull edge. createTrajineraLane's rules
 * mean a body touches at most one hull and always has a way out. Throws Error when no way is open,
 * which a lane createTrajineraLane built and a `pos` inside `lane.bounds` rule out.
 */
export function blockAtTrajineras(
  lane: TrajineraLane,
  pos: Readonly<Point>,
  t: number,
  tuning: Pick<TrajineraTuning, 'speed' | 'hullLength' | 'hullDepth' | 'bodyReach'> = TRAJINERAS,
): Point {
  return holdOutOfHulls(lane, pos, laneHulls(lane, t, tuning), tuning);
}

/**
 * One frame of the lane for the body centred on `pos` at element time `t`: every cooldown counts
 * down by `step` (tickTrajineraLane); then, unless `bumped`, the first ready boat whose hull touches
 * `pos` pushes it as pushFromTrajineras does, with that boat's cooldown started; then `pos` is held
 * out of every hull (blockAtTrajineras), whatever the cooldowns and the bump. On a push step
 * `push.to` is the held place. A body a full body reach under the hull band finds no hull at all;
 * otherwise each boat's hull is found once.
 */
export function stepTrajineraLane(
  lane: TrajineraLane,
  pos: Readonly<Point>,
  step: number,
  t: number,
  bumped: boolean,
  tuning: Readonly<TrajineraTuning> = TRAJINERAS,
): TrajineraLaneStep {
  const ticked = tickTrajineraLane(lane, step);
  if (pos.y - (SURF + tuning.hullDepth) >= tuning.bodyReach) {
    return { lane: ticked, pos: { x: pos.x, y: pos.y }, push: null };
  }
  const hulls = laneHulls(ticked, t, tuning);
  const pushed = bumped ? null : pushFromReadyBoat(ticked, pos, (index) => hulls[index], tuning);
  const held = holdOutOfHulls(ticked, pos, hulls, tuning);
  if (pushed === null) return { lane: ticked, pos: held, push: null };
  return { lane: pushed.lane, pos: held, push: { ...pushed.push, to: { x: held.x, y: held.y } } };
}
