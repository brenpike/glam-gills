/**
 * Pure trajinera lure rules (issue #108, ND-1): Area 10's new hazard. Fishing trajineras drift slowly
 * back and forth across a span of the surface, and each hangs one or more lures on straight lines
 * below its hull. A lure looks like a snack, but eating it is a hit: the head reach centre within the
 * shared snack eat reach of the lure, where it is drawn, lands one hit through the shared hit path,
 * sourceId 'trajinera-lure'. Touching a line or a hull is never a hit. After a tug the lure is pulled
 * up and away for 5 s, and it comes back only once the head is out of its reach, so it never returns
 * onto the head. Lures are never snacks. Fishing boats are their own area data field,
 * `fishingBoats`, never in `hazards` or `elements`: a lure is a hiding-risk threat and a gap
 * obstacle, but not a danger-bar threat.
 */
import { SNACK_BOB_PERIOD, SNACK_BOB_PX } from './collectibles';
import { LURE_FACT, LURE_MEET_RANGE } from './factCards';
import type { HazardRect, HazardType } from './hazards';
import { SNACK_REACH } from './tuning';
import { SURF, type Point, type SwimBounds } from './zone';

/** Trajinera lure tuning (issue #108, ND-1). */
export interface LureTuning {
  /** Drift speed in px/s of a fishing boat, back and forth across its span. */
  driftSpeed: number;
  /** Hull length in px along the surface. */
  hullLength: number;
  /** Depth in px of the hull's draft, down from SURF. Looks and spacing only: the hull never blocks or hits. */
  hullDepth: number;
  /** Height in px of a lure's bob above and below its still position; none under reduced motion. */
  bobAmplitude: number;
  /** Seconds for one full bob. Must be greater than 0. */
  bobPeriod: number;
  /** Distance in px from the head reach centre within which a lure is eaten (inclusive). */
  eatReach: number;
  /** Seconds a tugged lure stays pulled up before it may come back. */
  pulledFor: number;
  /** Seconds a tugged lure takes to rise from its place to the boat; at once under reduced motion. Must be greater than 0. */
  liftFor: number;
}

/**
 * Provisional trajinera lure values (issue #108, ND-1); tune in play. A fishing boat drifts at a slow
 * 12 px/s, its hull the gliding trajinera's 120 px long with the same 60 px draft. A lure bobs like a
 * snack (SNACK_BOB_PX and SNACK_BOB_PERIOD), since it reads as one, and is eaten within the shared
 * snack eat reach (SNACK_REACH.radius). A tugged lure rises to its boat over 0.5 s and stays up 5 s.
 * The hull values are literals, not read from TRAJINERAS: trajineras.ts reaches zone.ts, which imports
 * this module, so a runtime import here would read TRAJINERAS before it exists. lures.test.ts pins
 * them equal to TRAJINERAS.hullLength and TRAJINERAS.hullDepth.
 */
export const LURES: Readonly<LureTuning> = Object.freeze({
  driftSpeed: 12,
  hullLength: 120,
  hullDepth: 60,
  bobAmplitude: SNACK_BOB_PX,
  bobPeriod: SNACK_BOB_PERIOD,
  eatReach: SNACK_REACH.radius,
  pulledFor: 5,
  liftFor: 0.5,
});

/**
 * The trajinera lure hazard type (issue #108, ND-1): eating one costs a leg, and its reach is the
 * shared snack eat reach, measured from the lure where it is drawn. It is met within LURE_MEET_RANGE
 * of a present lure, with the "Fishing lines" card. It is never a hazard spawn: fishing boats are
 * their own `fishingBoats` field.
 */
export const TRAJINERA_LURE: Readonly<HazardType> = Object.freeze({
  id: 'trajinera-lure',
  name: 'Trajinera lure',
  costsLeg: true,
  reach: SNACK_REACH.radius,
  meetRange: LURE_MEET_RANGE,
  fact: LURE_FACT,
});

/** Where area data hangs a lure: `along` px from the hull's left end, `depth` px below SURF. */
export interface LurePlace {
  along: number;
  depth: number;
}

/** One lure of a fishing boat: its id (`<boat id>-lure-<n>`, n from 1), place along the hull and depth below SURF. */
export interface FishingLure extends LurePlace {
  id: string;
}

/** Area data for a fishing boat: the surface span `x0..x1` its hull drifts across and its lures, in order. */
export interface FishingBoatPlan {
  x0: number;
  x1: number;
  lures: readonly LurePlace[];
}

/**
 * A fishing trajinera (issue #108, ND-1): its id, the surface span `x0..x1` its hull drifts across,
 * its drift speed in px/s, its start offset in seconds of element time and its lures, in order.
 */
export interface FishingBoatSpawn {
  id: string;
  x0: number;
  x1: number;
  speed: number;
  offset: number;
  lures: readonly FishingLure[];
}

/** A lure's line: a straight segment from its boat, at the surface, down to the lure where it is drawn. */
export interface LureLine {
  from: Point;
  to: Point;
}

/**
 * One lure's state: its id, whether it is pulled up, and the seconds left before it may come back (0
 * once it waits for the head to leave its reach). A lure that is not up has `upLeft` 0.
 */
export interface LureStatus {
  id: string;
  up: boolean;
  upLeft: number;
}

/**
 * The trip's lure state: one status per lure, in boat order and then lure order. Functions in this
 * module never mutate their input; they return new states.
 */
export interface LureState {
  lures: LureStatus[];
}

/**
 * One frame's tug: the state with every lure in reach pulled up, the lure that lands the frame's one
 * hit, and every lure tugged this frame, `lureId` first.
 */
export interface LureTug {
  state: LureState;
  lureId: string;
  tugged: string[];
}

type DriftTuning = Pick<LureTuning, 'hullLength'>;
type BobTuning = Pick<LureTuning, 'bobAmplitude' | 'bobPeriod'>;
type SpawnTuning = Pick<LureTuning, 'driftSpeed' | 'hullLength' | 'hullDepth' | 'bobAmplitude'>;

/** Throws RangeError when the span is not finite with x0 < x1 or is not longer than a hull. */
function checkSpan(id: string, plan: Readonly<FishingBoatPlan>, tuning: DriftTuning): void {
  const { x0, x1 } = plan;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) {
    throw new RangeError(`fishingBoatSpawn: ${id} needs a finite span with x0 < x1, got ${x0}..${x1}`);
  }
  if (!(x1 - x0 > tuning.hullLength)) {
    throw new RangeError(`fishingBoatSpawn: ${id} span ${x1 - x0} px is not longer than the ${tuning.hullLength} px hull`);
  }
}

/**
 * Throws RangeError when a lure is not on the hull, its path reaches past the swim bounds' x range or
 * floor, or the top of its bob is not below the hull's draft.
 */
function checkLure(
  id: string,
  plan: Readonly<FishingBoatPlan>,
  place: Readonly<LurePlace>,
  bounds: Readonly<SwimBounds>,
  tuning: SpawnTuning,
): void {
  const { along, depth } = place;
  if (!Number.isFinite(along) || along < 0 || along > tuning.hullLength) {
    throw new RangeError(`fishingBoatSpawn: ${id} lure along ${along} px is not on the ${tuning.hullLength} px hull`);
  }
  if (plan.x0 + along < bounds.minX || plan.x1 - tuning.hullLength + along > bounds.maxX) {
    throw new RangeError(`fishingBoatSpawn: ${id} lure at along ${along} px drifts out of the swim bounds`);
  }
  if (!Number.isFinite(depth) || !(depth - tuning.bobAmplitude > tuning.hullDepth)) {
    throw new RangeError(`fishingBoatSpawn: ${id} lure depth ${depth} px is not below the ${tuning.hullDepth} px hull`);
  }
  if (SURF + depth + tuning.bobAmplitude > bounds.maxY) {
    throw new RangeError(`fishingBoatSpawn: ${id} lure depth ${depth} px reaches below the swim bounds`);
  }
}

/**
 * A fishing boat for area data (issue #108, ND-1), drifting at `tuning.driftSpeed` over the plan's
 * span, `offset` seconds into its drift clock. Its lures get the ids `<id>-lure-1`, `<id>-lure-2` and
 * so on, in plan order. Throws RangeError for a span that is not finite with x0 < x1 or is not longer
 * than a hull, an offset that is not finite, no lures, or a lure that is not on the hull, drifts out
 * of `bounds` in x, reaches below `bounds.maxY` or bobs up into the hull's draft.
 */
export function fishingBoatSpawn(
  id: string,
  offset: number,
  plan: Readonly<FishingBoatPlan>,
  bounds: Readonly<SwimBounds>,
  tuning: SpawnTuning = LURES,
): FishingBoatSpawn {
  checkSpan(id, plan, tuning);
  if (!Number.isFinite(offset)) {
    throw new RangeError(`fishingBoatSpawn: ${id} offset must be finite, got ${offset}`);
  }
  if (plan.lures.length === 0) {
    throw new RangeError(`fishingBoatSpawn: ${id} needs at least one lure`);
  }
  for (const place of plan.lures) checkLure(id, plan, place, bounds, tuning);
  const lures = plan.lures.map((place, index): FishingLure => ({ id: `${id}-lure-${index + 1}`, along: place.along, depth: place.depth }));
  return { id, x0: plan.x0, x1: plan.x1, speed: tuning.driftSpeed, offset, lures };
}

/**
 * The hull's left end at element time `t`: it starts at `x0` at `t = -offset`, drifts right at the
 * boat's speed to the span's far end, then back to `x0`, and so on, turning at once at each end. Any
 * finite `t` is valid, negative included.
 */
function hullLeft(boat: Readonly<FishingBoatSpawn>, t: number, tuning: DriftTuning): number {
  const travel = boat.x1 - boat.x0 - tuning.hullLength;
  const loop = 2 * travel;
  const driven = (((boat.speed * (t + boat.offset)) % loop) + loop) % loop;
  return boat.x0 + (driven <= travel ? driven : loop - driven);
}

/** The whole hull at element time `t`: `hullLength` wide from hullLeft, from SURF down its draft. */
export function fishingBoatHull(
  boat: Readonly<FishingBoatSpawn>,
  t: number,
  tuning: Pick<LureTuning, 'hullLength' | 'hullDepth'> = LURES,
): HazardRect {
  const left = hullLeft(boat, t, tuning);
  return { kind: 'rect', x0: left, x1: left + tuning.hullLength, y0: SURF, y1: SURF + tuning.hullDepth };
}

/** Every place the hull can be: the boat's whole span, from SURF down its draft. */
export function fishingBoatBand(boat: Readonly<FishingBoatSpawn>, tuning: Pick<LureTuning, 'hullDepth'> = LURES): HazardRect {
  return { kind: 'rect', x0: boat.x0, x1: boat.x1, y0: SURF, y1: SURF + tuning.hullDepth };
}

/** The lure's x at element time `t`: its place along the drifting hull. */
function lureX(boat: Readonly<FishingBoatSpawn>, lure: Readonly<FishingLure>, t: number, tuning: DriftTuning): number {
  return hullLeft(boat, t, tuning) + lure.along;
}

/**
 * The bob in px of the boat's lure at `index` at element time `t`, added to its y: a sine of
 * `bobAmplitude`, out of step by the boat's offset and the lure's index. 0 under reduced motion.
 */
export function lureBob(boat: Readonly<FishingBoatSpawn>, index: number, t: number, reduced: boolean, tuning: BobTuning = LURES): number {
  if (reduced) return 0;
  return tuning.bobAmplitude * Math.sin((2 * Math.PI * (t + boat.offset)) / tuning.bobPeriod + index);
}

/** The lure's still position at element time `t`: on its drifting hull, `depth` px below SURF, with no bob. */
export function lureStill(boat: Readonly<FishingBoatSpawn>, index: number, t: number, tuning: DriftTuning = LURES): Point {
  const lure = boat.lures[index];
  return { x: lureX(boat, lure, t, tuning), y: SURF + lure.depth };
}

/**
 * Where the boat's lure at `index` hangs at element time `t` when it is not pulled up: its still
 * position plus its bob (lureBob). It is eaten here. Under reduced motion it is the still position.
 */
export function lureAt(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  t: number,
  reduced: boolean,
  tuning: DriftTuning & BobTuning = LURES,
): Point {
  const still = lureStill(boat, index, t, tuning);
  return { x: still.x, y: still.y + lureBob(boat, index, t, reduced, tuning) };
}

/**
 * The share, 0 to 1, of the way a lure is pulled up from where it hangs to its boat at SURF: 0 when
 * not up; rising evenly over the first `liftFor` seconds after a tug; 1 after that and while it waits
 * for the head to leave. Under reduced motion it is 1 at once while up, with no rise.
 */
export function lureLift(
  status: Readonly<LureStatus>,
  reduced: boolean,
  tuning: Pick<LureTuning, 'pulledFor' | 'liftFor'> = LURES,
): number {
  if (!status.up) return 0;
  if (reduced) return 1;
  return Math.min(1, Math.max(0, (tuning.pulledFor - status.upLeft) / tuning.liftFor));
}

/**
 * Where the boat's lure at `index` is drawn at element time `t`: lureAt, raised toward SURF by its
 * lureLift share, so a lure pulled all the way up is at its boat.
 */
export function lureDrawn(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  status: Readonly<LureStatus>,
  t: number,
  reduced: boolean,
  tuning: Readonly<LureTuning> = LURES,
): Point {
  const hang = lureAt(boat, index, t, reduced, tuning);
  const lift = lureLift(status, reduced, tuning);
  return { x: hang.x, y: hang.y + (SURF - hang.y) * lift };
}

/** The line of the boat's lure at `index` at element time `t`: straight down from its boat at SURF to the lure where it is drawn (lureDrawn). */
export function lureLine(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  status: Readonly<LureStatus>,
  t: number,
  reduced: boolean,
  tuning: Readonly<LureTuning> = LURES,
): LureLine {
  const to = lureDrawn(boat, index, status, t, reduced, tuning);
  return { from: { x: to.x, y: SURF }, to };
}

/** The x range the boat's lure at `index` covers as its hull drifts the whole span. */
function lureXRange(boat: Readonly<FishingBoatSpawn>, index: number, tuning: DriftTuning): { x0: number; x1: number } {
  const { along } = boat.lures[index];
  return { x0: boat.x0 + along, x1: boat.x1 - tuning.hullLength + along };
}

/**
 * The lure's whole path, for keep-outs and threats: every place its centre can hang as its hull
 * drifts, bob included, `bobAmplitude` px above and below its depth. A pulled-up lure is never eaten,
 * so its rise is not part of the path.
 */
export function lurePath(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  tuning: Pick<LureTuning, 'hullLength' | 'bobAmplitude'> = LURES,
): HazardRect {
  const { x0, x1 } = lureXRange(boat, index, tuning);
  const y = SURF + boat.lures[index].depth;
  return { kind: 'rect', x0, x1, y0: y - tuning.bobAmplitude, y1: y + tuning.bobAmplitude };
}

/**
 * Every place the line of the boat's lure at `index` can be as its hull drifts: from SURF down to the
 * bottom of the lure's path (lurePath).
 */
export function lureLinePath(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  tuning: Pick<LureTuning, 'hullLength' | 'bobAmplitude'> = LURES,
): HazardRect {
  const { x0, x1 } = lureXRange(boat, index, tuning);
  return { kind: 'rect', x0, x1, y0: SURF, y1: SURF + boat.lures[index].depth + tuning.bobAmplitude };
}

/** True when the head reach centre `head` is within `eatReach` of the lure at `lure`, edges included. */
export function lureInReach(head: Readonly<Point>, lure: Readonly<Point>, tuning: Pick<LureTuning, 'eatReach'> = LURES): boolean {
  return Math.hypot(lure.x - head.x, lure.y - head.y) <= tuning.eatReach;
}

/**
 * lureInReach of the boat's lure at `index` where it hangs at element time `t` (lureAt), read
 * without allocating, so it can run every step.
 */
function hangsInReach(
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  head: Readonly<Point>,
  t: number,
  reduced: boolean,
  tuning: Readonly<LureTuning>,
): boolean {
  const lure = boat.lures[index];
  const x = lureX(boat, lure, t, tuning);
  const y = SURF + lure.depth + lureBob(boat, index, t, reduced, tuning);
  return Math.hypot(x - head.x, y - head.y) <= tuning.eatReach;
}

/** Every lure of `boats` down and ready: none pulled up. Also the state after a carry home. */
export function createLureState(boats: readonly Readonly<FishingBoatSpawn>[]): LureState {
  return { lures: boats.flatMap((boat) => boat.lures.map((lure): LureStatus => ({ id: lure.id, up: false, upLeft: 0 }))) };
}

/** The ids of every lure that is down and within reach of `head` at element time `t`, in state order. */
function lureIdsInReach(
  state: Readonly<LureState>,
  boats: readonly Readonly<FishingBoatSpawn>[],
  head: Readonly<Point>,
  t: number,
  reduced: boolean,
  tuning: Readonly<LureTuning>,
): string[] | null {
  let ids: string[] | null = null;
  let flat = 0;
  for (const boat of boats) {
    for (let index = 0; index < boat.lures.length; index++, flat++) {
      // INVARIANT: state.lures is createLureState(boats)'s order, so flat indexes the same lure.
      if (state.lures[flat].up || !hangsInReach(boat, index, head, t, reduced, tuning)) continue;
      ids ??= [];
      ids.push(boat.lures[index].id);
    }
  }
  return ids;
}

/**
 * Eats the lures in reach of the head reach centre `head` at element time `t`: every lure that is
 * down and within `eatReach` of it, where it hangs (lureAt), edges included. Returns null, allocating
 * nothing, when no lure is in reach. Otherwise every lure in reach is pulled up for `pulledFor`
 * seconds, and the first of them in state order is the one that lands the frame's one hit: two lures
 * in reach on one frame land one hit. A tug always pulls the lure up, even when the caller's hit is
 * blocked by the Shell or protected time.
 */
export function eatLure(
  state: Readonly<LureState>,
  boats: readonly Readonly<FishingBoatSpawn>[],
  head: Readonly<Point>,
  t: number,
  reduced: boolean,
  tuning: Readonly<LureTuning> = LURES,
): LureTug | null {
  const tugged = lureIdsInReach(state, boats, head, t, reduced, tuning);
  if (tugged === null) return null;
  const lures = state.lures.map((status) => (tugged.includes(status.id) ? { id: status.id, up: true, upLeft: tuning.pulledFor } : status));
  return { state: { lures }, lureId: tugged[0], tugged };
}

/** One lure's status after `dt` seconds: its `upLeft` counted down, and back down once 0 and the head is out of reach. */
function tickStatus(
  status: Readonly<LureStatus>,
  boat: Readonly<FishingBoatSpawn>,
  index: number,
  head: Readonly<Point>,
  t: number,
  dt: number,
  reduced: boolean,
  tuning: Readonly<LureTuning>,
): LureStatus {
  const upLeft = Math.max(0, status.upLeft - dt);
  if (upLeft > 0) return { id: status.id, up: true, upLeft };
  if (hangsInReach(boat, index, head, t, reduced, tuning)) return upLeft === status.upLeft ? status : { id: status.id, up: true, upLeft };
  return { id: status.id, up: false, upLeft: 0 };
}

/**
 * Counts each pulled-up lure's time down by `dt` seconds, floored at 0. A lure at 0 comes back only
 * when the head reach centre `head` is out of its reach where it would hang at element time `t`
 * (lureAt), so it never returns onto the head; until then it stays up. Returns `state` itself when
 * `dt` is zero, negative or not finite, or when no lure changes, as when none is up or every lure up
 * waits for the head to leave.
 */
export function tickLures(
  state: Readonly<LureState>,
  boats: readonly Readonly<FishingBoatSpawn>[],
  head: Readonly<Point>,
  t: number,
  dt: number,
  reduced: boolean,
  tuning: Readonly<LureTuning> = LURES,
): LureState {
  if (!(dt > 0) || !Number.isFinite(dt) || !state.lures.some((status) => status.up)) return state;
  const lures: LureStatus[] = [];
  let changed = false;
  let flat = 0;
  for (const boat of boats) {
    for (let index = 0; index < boat.lures.length; index++, flat++) {
      const status = state.lures[flat];
      const next = status.up ? tickStatus(status, boat, index, head, t, dt, reduced, tuning) : status;
      changed ||= next !== status;
      lures.push(next);
    }
  }
  return changed ? { lures } : state;
}
