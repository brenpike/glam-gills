/**
 * Mobile snacks (PRD H4, A19, A21; open questions 269 to 275 and 278, ND-22 to ND-28 and ND-31):
 * the tadpole, which swims its own closed wander loop forever (issue #131, ND-1), and the freshwater
 * shrimp, which rests and flicks (src/logic/shrimpFlick.ts) and has a home of hop spots (issue
 * #131, ND-5). Fixed area data, never seeded; opt-in per area.
 */
import type { AreaData } from './areas';
import {
  SNACK_BOB_PX,
  drawnSnackX,
  drawnSnackY,
  headPoint,
  snackWander,
  wanderLegAt,
  wanderOffsetAlong,
  type Collectible,
  type SnackDrift,
  type SnackFrame,
  type SnackWander,
} from './collectibles';
import { drawnAxolotl } from './drawnAxolotl';
import { SHRIMP_FACT, SHRIMP_MEET_RANGE, TADPOLE_FACT, TADPOLE_MEET_RANGE } from './factCards';
import { elementSweep, hazardSweep, type HazardRect, type HazardShape } from './hazards';
import { zoneThreats, type Threat } from './hiding';
import { legSwimTuning } from './legs';
import { movingHazardSweep } from './movingHazards';
import { createSnackDarts, type SnackDartState } from './snackDart';
import { stepSwim, type SwimEnv, type SwimState } from './swimPhysics';
import { SHRIMP, SNACK_REACH, TADPOLES, type SwimTuning } from './tuning';
import type { Vec2 } from './vec';
import {
  SNACK_HAZARD_CLEARANCE,
  SURF,
  areaSize,
  inSafeArea,
  swimBounds,
  type AreaLayoutData,
  type CurrentZone,
  type HomeSpot,
  type Point,
  type SafeArea,
  type SwimBounds,
  type ZoneLayout,
} from './zone';

/** An area's tadpole rule (ND-24): its swim speed in px/s. Build it with tadpoleRule(). */
export interface TadpoleRule {
  readonly speed: number;
}

/**
 * An area's shrimp rule (ND-25). Build it with shrimpRule(). A ready shrimp drawn within
 * `triggerRadius` px of the head reach centre flicks `flickDistance` px straight away from the head
 * at `flickSpeed` px/s, then rests `restFor` seconds.
 */
export interface ShrimpRule {
  readonly triggerRadius: number;
  readonly restFor: number;
  readonly flickDistance: number;
  readonly flickSpeed: number;
}

/**
 * One tadpole wander loop as area data (issue #131, ND-1, ND-13): its turn points in world px, the
 * first its start, swum in order and back to the first, `offset` seconds ahead on its lap. Build it
 * with tadpoleWander().
 */
export interface TadpoleWander {
  readonly points: readonly Readonly<Point>[];
  readonly offset: number;
}

/** One shrimp home as area data (issue #131, ND-5, ND-13): its hop spots in world px, the first its start. Build it with shrimpHome(). */
export interface ShrimpHome {
  readonly points: readonly Readonly<Point>[];
}

/** An area's mobile snacks (ND-23; issue #131, ND-13): the rules, each tadpole's wander loop and each shrimp's home. Build it with mobileSnackMix(). */
export interface MobileSnackMix {
  readonly tadpole?: TadpoleRule;
  readonly wanders: readonly TadpoleWander[];
  readonly shrimp?: ShrimpRule;
  readonly homes: readonly ShrimpHome[];
}

/**
 * Where a mobile snack may not go (ND-26; issue #131, ND-7), built by mobileSnackAvoid(). Checked
 * by mobileSnackClear(), mobileSnackHardClear(), tadpoleWanderClear() and shrimpHomeClear().
 */
export interface MobileSnackAvoid {
  bounds: SwimBounds;
  homeSpot: HomeSpot;
  safeArea: SafeArea;
  currents: readonly CurrentZone[];
  /** Each mat pair's whole sweep (elementSweep); a box overlapping one, edges included, is not clear. */
  mats: readonly HazardRect[];
  /** Where each plastic worm is now; a box keeps SNACK_HAZARD_CLEARANCE px from each. */
  worms: readonly Readonly<Point>[];
  /**
   * Shapes a box keeps SNACK_HAZARD_CLEARANCE px from: every hazard by hazardSweep (a drifting
   * net's whole drift path), every element sweep, every moving hazard's sweep, and every rock wall
   * and side room (issue #105, ND-8).
   */
  keepAway: readonly HazardShape[];
  /**
   * Every hazard by hazardSweep (a drifting net's whole drift path), then every rock wall and side
   * room (issue #105, ND-8), which mobileSnackHardClear() keeps SNACK_HAZARD_CLEARANCE px from
   * (issue #131, ND-7). mobileSnackAvoid() always sets it; absent, mobileSnackHardClear() uses
   * `keepAway`, which holds every hazard sweep and more.
   */
  hazards?: readonly HazardShape[];
  /** The zone's B10 threats (zoneThreats); a box stays farther than each one's strike range. */
  threats: readonly Threat[];
}

/**
 * A mobile snack's drawn pose (ND-24, ND-25, ND-30; issue #131, ND-4): its frame, facing, body sway
 * and tilt in radians. The sprite's rotation is tilt plus sway.
 */
export interface MobileSnackPose {
  frame: number;
  facing: 1 | -1;
  sway: number;
  tilt: number;
}

/**
 * What a shrimp's pose needs from the trip's flick state (issue #131, ND-10): whether a flick is
 * under way, whether it rests after a flick, and the x sign of its last hop (0 before any hop or
 * after a straight up or down hop). A tadpole, worm or bug pose ignores it.
 */
export interface ShrimpPoseState {
  flicking: boolean;
  afterFlick: boolean;
  hopSign: -1 | 0 | 1;
}

/** What every mobile snack pose this frame shares: the scene clock (s), reduced motion and the head reach centre. */
export interface MobileSnackPoseScene {
  clock: number;
  reduced: boolean;
  head: Readonly<Point>;
}

/**
 * One row of the snack ramp (PRD H4, ND-31): the mobile share and tadpole speed an area must have,
 * both ranges inclusive. `mobile` false means the area has no mobile snacks at all.
 */
export interface SnackRampRow {
  readonly mobile: boolean;
  readonly minShare: number;
  readonly maxShare: number;
  readonly minTadpoleSpeed: number;
  readonly maxTadpoleSpeed: number;
}

/** The snack ramp (ND-31): one row for each of Areas 1 to 5, in area order, and one rule for Area 6 on. */
export interface SnackRamp {
  readonly rows: readonly SnackRampRow[];
  readonly later: SnackRampRow;
}

/** Tadpole tail frames (ND-24, ND-30). */
export const TADPOLE_TAIL_FRAMES = 4;
/** Tadpole tail frames a second, from the scene clock. */
export const TADPOLE_TAIL_FPS = 8;
/** Peak tadpole body sway in radians: 8 degrees either way. */
export const TADPOLE_SWAY = (8 * Math.PI) / 180;
/** Largest tadpole tilt in radians (issue #131, ND-4): 40 degrees either way. */
export const TADPOLE_MAX_TILT = (40 * Math.PI) / 180;
/** Seconds a tadpole takes to ease to a new leg's tilt after each corner (issue #131, ND-4). */
export const TADPOLE_TURN_SECONDS = 0.25;
/** Longest a one-leg axolotl may take to eat a tadpole in the catch proof, in seconds (issue #131, ND-8). */
export const TADPOLE_CATCH_SECONDS = 20;
/** How far outside a tadpole's home box each catch proof start is, in px (issue #131, ND-8). */
export const TADPOLE_CATCH_START_GAP = 100;
/** The shrimp's rest frame. */
export const SHRIMP_REST_FRAME = 0;
/** The shrimp's flick frame, tail tucked under. */
export const SHRIMP_FLICK_FRAME = 1;

/** Deepest y the wavy surface reaches: waveY (zone.ts) is SURF plus swells of 1.6 and 0.8 px. */
const SURFACE_PEAK_Y = SURF + 1.6 + 0.8;

/** Seconds per tadpole sway: one pass of the tail frames. */
const TADPOLE_SWAY_PERIOD = TADPOLE_TAIL_FRAMES / TADPOLE_TAIL_FPS;

/** A leg whose sideways part is under this share of its length is near-vertical (issue #131, ND-4). */
const NEAR_VERTICAL_SHARE = 0.25;

/** The catch proof's step in seconds. */
const CATCH_STEP_SECONDS = 1 / 60;

/** A drift that never moves, for the catch proof's snack frame: a tadpole is drawn on its loop with no drift. */
const STILL_DRIFT: Readonly<SnackDrift> = Object.freeze({ amplitudeX: 0, amplitudeY: 0, periodX: 1, periodY: 1 });

const NO_IDS: readonly string[] = Object.freeze([]);

/**
 * The snack ramp (PRD H4, open question 278, ND-31). Shares are fractions of the area's snacks.
 * Tadpole speeds (issue #131, ND-9): 35 to 45, 45 to 55, 55 to 65 and 65 to 72 px/s for Areas 2 to
 * 5, and 70 to 72 px/s from Area 6 on.
 */
export const SNACK_RAMP: Readonly<SnackRamp> = Object.freeze({
  rows: Object.freeze([
    Object.freeze({ mobile: false, minShare: 0, maxShare: 0, minTadpoleSpeed: 0, maxTadpoleSpeed: 0 }),
    Object.freeze({ mobile: true, minShare: 0.15, maxShare: 0.25, minTadpoleSpeed: 35, maxTadpoleSpeed: 45 }),
    Object.freeze({ mobile: true, minShare: 0.3, maxShare: 0.4, minTadpoleSpeed: 45, maxTadpoleSpeed: 55 }),
    Object.freeze({ mobile: true, minShare: 0.45, maxShare: 0.55, minTadpoleSpeed: 55, maxTadpoleSpeed: 65 }),
    Object.freeze({ mobile: true, minShare: 0.55, maxShare: 0.65, minTadpoleSpeed: 65, maxTadpoleSpeed: TADPOLES.maxSpeed }),
  ]),
  later: Object.freeze({ mobile: true, minShare: 0.55, maxShare: 0.7, minTadpoleSpeed: 70, maxTadpoleSpeed: TADPOLES.maxSpeed }),
});

function requireFinite(what: string, values: Readonly<Record<string, number>>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new RangeError(`${what}: ${name} must be finite, got ${value}`);
  }
}

/**
 * A tadpole rule for area data (ND-24, PRD open question 271). Throws RangeError unless `speed` is
 * above 0 and at most TADPOLES.maxSpeed px/s.
 */
export function tadpoleRule(speed: number): Readonly<TadpoleRule> {
  if (!(speed > 0 && speed <= TADPOLES.maxSpeed)) {
    throw new RangeError(`tadpoleRule: speed must be above 0 and at most ${TADPOLES.maxSpeed}, got ${speed}`);
  }
  return Object.freeze({ speed });
}

/** Frozen points from [x, y] pairs. */
function frozenPoints(pairs: readonly (readonly [number, number])[]): readonly Readonly<Point>[] {
  return Object.freeze(pairs.map(([x, y]) => Object.freeze({ x, y })));
}

/**
 * A tadpole wander loop for area data (issue #131, ND-1, ND-3, ND-13), for a tadpole that swims at
 * `rule`'s speed: `points` are 2 to TADPOLES.maxLoopPoints [x, y] pairs in world px, the first its
 * start, and `offset` is seconds ahead on its lap. Throws RangeError when the rule is outside its
 * limits, a value is not finite, there are too few or too many points, a leg takes less than
 * TADPOLES.minLegSeconds or more than TADPOLES.maxLegSeconds, the lap takes more than
 * TADPOLES.maxLapSeconds, or `offset` is outside [0, lap).
 */
export function tadpoleWander(
  rule: Readonly<TadpoleRule>,
  points: readonly (readonly [number, number])[],
  offset: number,
): Readonly<TadpoleWander> {
  tadpoleRule(rule.speed);
  if (points.length < 2 || points.length > TADPOLES.maxLoopPoints) {
    throw new RangeError(`tadpoleWander: needs 2 to ${TADPOLES.maxLoopPoints} points, got ${points.length}`);
  }
  points.forEach(([x, y], i) => requireFinite(`tadpoleWander point ${i}`, { x, y }));
  requireFinite('tadpoleWander', { offset });
  const frozen = frozenPoints(points);
  const wander = snackWander(frozen, rule.speed, offset);
  wander.legEnds.forEach((legEnd, i) => {
    const seconds = (legEnd - (i === 0 ? 0 : wander.legEnds[i - 1])) / rule.speed;
    if (seconds < TADPOLES.minLegSeconds || seconds > TADPOLES.maxLegSeconds) {
      throw new RangeError(`tadpoleWander: leg ${i} takes ${seconds} s, must be from ${TADPOLES.minLegSeconds} to ${TADPOLES.maxLegSeconds} s`);
    }
  });
  const lapSeconds = wander.lap / rule.speed;
  if (lapSeconds > TADPOLES.maxLapSeconds) {
    throw new RangeError(`tadpoleWander: lap takes ${lapSeconds} s, must be at most ${TADPOLES.maxLapSeconds} s`);
  }
  if (!(offset >= 0 && offset < lapSeconds)) {
    throw new RangeError(`tadpoleWander: offset ${offset} must be at least 0 and under ${lapSeconds}`);
  }
  return Object.freeze({ points: frozen, offset });
}

/**
 * A shrimp home for area data (issue #131, ND-5, ND-13): `points` are 1 to SHRIMP.maxHomeSpots hop
 * spots as [x, y] pairs in world px, the first its start. Throws RangeError when there are too few
 * or too many spots or a value is not finite.
 */
export function shrimpHome(points: readonly (readonly [number, number])[]): Readonly<ShrimpHome> {
  if (points.length < 1 || points.length > SHRIMP.maxHomeSpots) {
    throw new RangeError(`shrimpHome: needs 1 to ${SHRIMP.maxHomeSpots} spots, got ${points.length}`);
  }
  points.forEach(([x, y], i) => requireFinite(`shrimpHome spot ${i}`, { x, y }));
  return Object.freeze({ points: frozenPoints(points) });
}

/** The [x, y] pairs of the points, for checking hand-written area data again. */
function pointPairs(points: readonly Readonly<Point>[]): (readonly [number, number])[] {
  return points.map((point) => [point.x, point.y] as const);
}

/**
 * A shrimp rule for area data (ND-25, PRD open question 272). Throws RangeError when a value is not
 * finite, `triggerRadius` is not above the SNACK_REACH.radius eat reach, `restFor` is under
 * SHRIMP.minRest, `flickDistance` is outside SHRIMP.minFlick to SHRIMP.maxFlick, `flickSpeed` is not
 * above 0 or above SHRIMP.maxFlickSpeed, or the catch limit fails:
 * restFor x SHRIMP.catchSpeed >= triggerRadius + flickDistance - SNACK_REACH.radius.
 */
export function shrimpRule(
  triggerRadius: number,
  restFor: number,
  flickDistance: number,
  flickSpeed: number,
): Readonly<ShrimpRule> {
  requireFinite('shrimpRule', { triggerRadius, restFor, flickDistance, flickSpeed });
  if (!(triggerRadius > SNACK_REACH.radius)) {
    throw new RangeError(`shrimpRule: triggerRadius must be above ${SNACK_REACH.radius}, got ${triggerRadius}`);
  }
  if (!(restFor >= SHRIMP.minRest)) {
    throw new RangeError(`shrimpRule: restFor must be at least ${SHRIMP.minRest}, got ${restFor}`);
  }
  if (!(flickDistance >= SHRIMP.minFlick && flickDistance <= SHRIMP.maxFlick)) {
    throw new RangeError(`shrimpRule: flickDistance must be from ${SHRIMP.minFlick} to ${SHRIMP.maxFlick}, got ${flickDistance}`);
  }
  if (!(flickSpeed > 0 && flickSpeed <= SHRIMP.maxFlickSpeed)) {
    throw new RangeError(`shrimpRule: flickSpeed must be above 0 and at most ${SHRIMP.maxFlickSpeed}, got ${flickSpeed}`);
  }
  const reachToClose = triggerRadius + flickDistance - SNACK_REACH.radius;
  if (!(restFor * SHRIMP.catchSpeed >= reachToClose)) {
    throw new RangeError(`shrimpRule: restFor ${restFor} x ${SHRIMP.catchSpeed} must be at least ${reachToClose} (the catch limit)`);
  }
  return Object.freeze({ triggerRadius, restFor, flickDistance, flickSpeed });
}

/**
 * An area's mobile snacks for area data (ND-23; issue #131, ND-13). Checks every rule, wander loop
 * and home again with tadpoleRule(), tadpoleWander(), shrimpRule() and shrimpHome(), so a
 * hand-written value outside its limits throws too. Throws RangeError when there are wander loops
 * without a tadpole rule, homes without a shrimp rule, or any value is outside its limits.
 */
export function mobileSnackMix(mix: Readonly<MobileSnackMix>): Readonly<MobileSnackMix> {
  const { tadpole, shrimp } = mix;
  if (mix.wanders.length > 0 && !tadpole) throw new RangeError('mobileSnackMix: tadpole wander loops need a tadpole rule');
  if (mix.homes.length > 0 && !shrimp) throw new RangeError('mobileSnackMix: shrimp homes need a shrimp rule');
  const tadpoleChecked = tadpole ? tadpoleRule(tadpole.speed) : undefined;
  const wanders = tadpoleChecked
    ? mix.wanders.map((wander) => tadpoleWander(tadpoleChecked, pointPairs(wander.points), wander.offset))
    : [];
  const shrimpChecked = shrimp
    ? shrimpRule(shrimp.triggerRadius, shrimp.restFor, shrimp.flickDistance, shrimp.flickSpeed)
    : undefined;
  return Object.freeze({
    ...(tadpoleChecked ? { tadpole: tadpoleChecked } : {}),
    wanders: Object.freeze(wanders),
    ...(shrimpChecked ? { shrimp: shrimpChecked } : {}),
    homes: Object.freeze(mix.homes.map((home) => shrimpHome(pointPairs(home.points)))),
  });
}

/** The box from a to b, edges included. */
function legBox(a: Readonly<Point>, b: Readonly<Point>): HazardRect {
  return { kind: 'rect', x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
}

/** The box of each leg of the closed loop through `points`, leg i from points[i] to the next; none for a single point. */
function loopLegBoxes(points: readonly Readonly<Point>[]): HazardRect[] {
  if (points.length < 2) return [];
  return points.map((point, i) => legBox(point, points[(i + 1) % points.length]));
}

/**
 * One box per tadpole leg and per shrimp hop leg in the zone's mobile snacks, tadpoles first, in
 * data order, for SpitAvoid's `keepClear` (issue #131, ND-7): a spat plastic worm keeps clear of
 * each. A shrimp home with one hop spot has no legs. Empty when the zone has no mobile snacks.
 */
export function mobileLegBoxes(zone: Pick<ZoneLayout, 'mobileSnacks'>): HazardRect[] {
  const mix = zone.mobileSnacks;
  if (!mix) return [];
  return [...mix.wanders.flatMap((wander) => loopLegBoxes(wander.points)), ...mix.homes.flatMap((home) => loopLegBoxes(home.points))];
}

/**
 * The box a shrimp based at `spot` can be drawn in (ND-25, ND-26): its drift and the snack bob
 * either way. The bob counts even under reduced motion, so a motion change cannot move it out.
 */
export function shrimpBox(spot: Readonly<Point>, drift: Readonly<SnackDrift>): HazardRect {
  return writeShrimpBox(spot, drift, { kind: 'rect', x0: 0, x1: 0, y0: 0, y1: 0 });
}

/** Writes shrimpBox(spot, drift) into `out` and returns it, for a check that runs every frame. Allocates nothing. */
export function writeShrimpBox(spot: Readonly<Point>, drift: Readonly<SnackDrift>, out: HazardRect): HazardRect {
  const spreadY = drift.amplitudeY + SNACK_BOB_PX;
  out.kind = 'rect';
  out.x0 = spot.x - drift.amplitudeX;
  out.x1 = spot.x + drift.amplitudeX;
  out.y0 = spot.y - spreadY;
  out.y1 = spot.y + spreadY;
  return out;
}

/** The sweep of every element that has geometry (the mat pairs), in data order. */
function elementSweeps(zone: Pick<ZoneLayout, 'elements'>): HazardRect[] {
  return zone.elements.flatMap((element) => {
    const sweep = elementSweep(element);
    return sweep ? [sweep] : [];
  });
}

/**
 * What a mobile snack keeps out of in this zone (ND-26). `plasticWorms` is where each plastic worm
 * is now; absent means none beyond the zone's hazards, which already hold each worm's start.
 * Measures every moving hazard's sweep itself as well as through zoneThreats. Every rock wall and
 * side room is kept away from too (issue #105, ND-8), so no snack swims into rock or behind the pebble.
 */
export function mobileSnackAvoid(
  zone: Pick<
    ZoneLayout,
    | 'width'
    | 'bedTop'
    | 'homeSpot'
    | 'safeArea'
    | 'currents'
    | 'hazards'
    | 'elements'
    | 'movingHazards'
    | 'tilapiaRoutes'
    | 'tilapia'
    | 'predatorRoutes'
  > &
    Partial<Pick<ZoneLayout, 'rockWalls' | 'sideRooms'>>,
  plasticWorms: readonly Readonly<Point>[] = [],
): MobileSnackAvoid {
  const mats = elementSweeps(zone);
  const hazards = zone.hazards.map(hazardSweep);
  const rock = [...(zone.rockWalls ?? []), ...(zone.sideRooms ?? [])].map(
    (wall): HazardRect => ({ kind: 'rect', x0: wall.x0, x1: wall.x1, y0: wall.y0, y1: wall.y1 }),
  );
  return {
    bounds: swimBounds(zone),
    homeSpot: zone.homeSpot,
    safeArea: zone.safeArea,
    currents: zone.currents,
    mats,
    worms: plasticWorms,
    keepAway: [...hazards, ...mats, ...(zone.movingHazards ?? []).map(movingHazardSweep), ...rock],
    hazards: [...hazards, ...rock],
    threats: zoneThreats(zone),
  };
}

/** Distance from (px, py) to the rectangle x0..x1, y0..y1; 0 when inside or on it. Allocates nothing. */
function gapToRect(px: number, py: number, x0: number, x1: number, y0: number, y1: number): number {
  return Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));
}

/** Distance from (px, py) to the box; 0 when inside or on it. */
function gapToBox(px: number, py: number, box: Readonly<HazardRect>): number {
  return gapToRect(px, py, box.x0, box.x1, box.y0, box.y1);
}

function boxesOverlap(box: Readonly<HazardRect>, other: Readonly<{ x0: number; x1: number; y0: number; y1: number }>): boolean {
  return box.x1 >= other.x0 && box.x0 <= other.x1 && box.y1 >= other.y0 && box.y0 <= other.y1;
}

/** Distance between the box and a hazard shape; 0 when they touch or overlap. */
function boxShapeDistance(box: Readonly<HazardRect>, shape: Readonly<HazardShape>): number {
  if (shape.kind === 'circle') return Math.max(0, gapToBox(shape.x, shape.y, box) - shape.r);
  return Math.hypot(
    Math.max(shape.x0 - box.x1, 0, box.x0 - shape.x1),
    Math.max(shape.y0 - box.y1, 0, box.y0 - shape.y1),
  );
}

/**
 * The share along a segment where its coordinate a + share x d enters [lo, hi], by slab clipping:
 * -Infinity when it is always inside, Infinity when it never is.
 */
function slabEnter(a: number, d: number, lo: number, hi: number): number {
  if (d === 0) return a >= lo && a <= hi ? -Infinity : Infinity;
  return Math.min((lo - a) / d, (hi - a) / d);
}

/** The share along a segment where its coordinate a + share x d leaves [lo, hi]; the twin of slabEnter. */
function slabLeave(a: number, d: number, lo: number, hi: number): number {
  if (d === 0) return a >= lo && a <= hi ? Infinity : -Infinity;
  return Math.max((lo - a) / d, (hi - a) / d);
}

/** Whether the segment from (ax, ay) to (bx, by) meets the rectangle x0..x1, y0..y1 (edges count). Allocates nothing. */
function segmentMeetsRect(ax: number, ay: number, bx: number, by: number, x0: number, x1: number, y0: number, y1: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const enter = Math.max(0, slabEnter(ax, dx, x0, x1), slabEnter(ay, dy, y0, y1));
  const leave = Math.min(1, slabLeave(ax, dx, x0, x1), slabLeave(ay, dy, y0, y1));
  return enter <= leave;
}

/** Distance from (px, py) to the segment from (ax, ay) to (bx, by). Allocates nothing. */
function pointSegmentGap(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  return Math.hypot(px - (ax + along * abx), py - (ay + along * aby));
}

/**
 * Distance between the rectangle x0..x1, y0..y1 and the segment from a to b; 0 when they meet. Two
 * convex shapes apart are nearest at a corner of one of them, so the ends and the rectangle's
 * corners are enough. Allocates nothing.
 */
function rectSegmentGap(x0: number, x1: number, y0: number, y1: number, a: Readonly<Point>, b: Readonly<Point>): number {
  if (segmentMeetsRect(a.x, a.y, b.x, b.y, x0, x1, y0, y1)) return 0;
  return Math.min(
    gapToRect(a.x, a.y, x0, x1, y0, y1),
    gapToRect(b.x, b.y, x0, x1, y0, y1),
    pointSegmentGap(x0, y0, a.x, a.y, b.x, b.y),
    pointSegmentGap(x1, y0, a.x, a.y, b.x, b.y),
    pointSegmentGap(x0, y1, a.x, a.y, b.x, b.y),
    pointSegmentGap(x1, y1, a.x, a.y, b.x, b.y),
  );
}

/** Distance between the box and the segment from a to b; 0 when they meet. */
function boxSegmentDistance(box: Readonly<HazardRect>, a: Readonly<Point>, b: Readonly<Point>): number {
  return rectSegmentGap(box.x0, box.x1, box.y0, box.y1, a, b);
}

/** Distance between the box and a closed patrol loop, as routeLoopDistance measures; Infinity with no waypoints. */
function boxLoopDistance(box: Readonly<HazardRect>, waypoints: readonly Readonly<Point>[]): number {
  let best = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    best = Math.min(best, boxSegmentDistance(box, waypoints[i], waypoints[(i + 1) % waypoints.length]));
  }
  return best;
}

function boxThreatDistance(box: Readonly<HazardRect>, threat: Threat): number {
  return threat.kind === 'route' ? boxLoopDistance(box, threat.route.waypoints) : boxShapeDistance(box, threat.shape);
}

/** Whether the box is inside the bounds, below the highest wave, and out of the ring, safe area, currents and mats. */
function boxInOpenWater(box: Readonly<HazardRect>, avoid: MobileSnackAvoid): boolean {
  const { bounds, homeSpot } = avoid;
  if (box.x0 < bounds.minX || box.x1 > bounds.maxX || box.y0 < bounds.minY || box.y1 > bounds.maxY) return false;
  if (box.y0 <= SURFACE_PEAK_Y) return false;
  if (gapToBox(homeSpot.x, homeSpot.y, box) <= homeSpot.radius) return false;
  if (boxesOverlap(box, avoid.safeArea)) return false;
  for (let index = 0; index < avoid.currents.length; index++) if (boxesOverlap(box, avoid.currents[index])) return false;
  for (let index = 0; index < avoid.mats.length; index++) if (boxesOverlap(box, avoid.mats[index])) return false;
  return true;
}

/** Whether every plastic worm is SNACK_HAZARD_CLEARANCE px or more from the box. Allocates nothing. */
function boxClearOfWorms(box: Readonly<HazardRect>, worms: readonly Readonly<Point>[]): boolean {
  for (let index = 0; index < worms.length; index++) {
    if (gapToBox(worms[index].x, worms[index].y, box) < SNACK_HAZARD_CLEARANCE) return false;
  }
  return true;
}

/**
 * Whether a mobile snack's box (such as a leg box or shrimpBox) is a clear place for it (ND-26, PRD
 * open question 273): inside the bounds and below the highest wave; out of the Home Spot ring, the
 * safe area, every current and every mat sweep (edges count as inside); SNACK_HAZARD_CLEARANCE px
 * or more from every worm and every `keepAway` shape; and farther than its strike range from every
 * B10 threat, a route measured from its patrol loop.
 */
export function mobileSnackClear(box: Readonly<HazardRect>, avoid: MobileSnackAvoid): boolean {
  if (!boxInOpenWater(box, avoid) || !boxClearOfWorms(box, avoid.worms)) return false;
  for (let index = 0; index < avoid.keepAway.length; index++) {
    if (boxShapeDistance(box, avoid.keepAway[index]) < SNACK_HAZARD_CLEARANCE) return false;
  }
  for (let index = 0; index < avoid.threats.length; index++) {
    const threat = avoid.threats[index];
    if (!(boxThreatDistance(box, threat) > threat.strike)) return false;
  }
  return true;
}

/**
 * Whether the box meets the hard rules for every mobile snack (issue #131, ND-7): inside the bounds
 * and below the highest wave; out of the Home Spot ring, the safe area, every current and every mat
 * sweep (edges count as inside); and SNACK_HAZARD_CLEARANCE px or more from every plastic worm and
 * every hazard by hazardSweep (a ghost net by its whole drift path). Moving hazards and predators
 * are left to the threat rules of tadpoleWanderClear() and shrimpHomeClear().
 */
export function mobileSnackHardClear(box: Readonly<HazardRect>, avoid: MobileSnackAvoid): boolean {
  if (!boxInOpenWater(box, avoid) || !boxClearOfWorms(box, avoid.worms)) return false;
  const shapes = avoid.hazards ?? avoid.keepAway;
  for (let index = 0; index < shapes.length; index++) {
    if (!(boxShapeDistance(box, shapes[index]) >= SNACK_HAZARD_CLEARANCE)) return false;
  }
  return true;
}

/**
 * Whether a shrimp gliding in a straight line from base `from` to base `to` meets the hard rules
 * that do not move at every point on the way, its drift and bob included (issue #131, ND-7): at
 * each base between the two, its shrimpBox is inside the bounds and below the highest wave; out of
 * the Home Spot ring, the safe area, every current and every mat sweep (edges count as inside); and
 * SNACK_HAZARD_CLEARANCE px or more from every hazard by hazardSweep, as mobileSnackHardClear()
 * measures. Exact: the shrimpBox at base c meets a shape just when c meets the shape grown by the
 * shrimpBox's half size, so each rule is measured from the glide's path to its grown shape. The
 * plastic worms where they are now are left to the landing's own check, so a shrimp resting near a
 * spat worm can still glide away from it. Allocates nothing.
 */
export function shrimpGlideClear(
  from: Readonly<Point>,
  to: Readonly<Point>,
  drift: Readonly<SnackDrift>,
  avoid: MobileSnackAvoid,
): boolean {
  const halfX = drift.amplitudeX;
  const halfY = drift.amplitudeY + SNACK_BOB_PX;
  const { bounds, homeSpot, safeArea } = avoid;
  const topY = Math.min(from.y, to.y) - halfY;
  if (Math.min(from.x, to.x) - halfX < bounds.minX || Math.max(from.x, to.x) + halfX > bounds.maxX) return false;
  if (topY < bounds.minY || Math.max(from.y, to.y) + halfY > bounds.maxY || topY <= SURFACE_PEAK_Y) return false;
  const ringGap = rectSegmentGap(homeSpot.x - halfX, homeSpot.x + halfX, homeSpot.y - halfY, homeSpot.y + halfY, from, to);
  if (ringGap <= homeSpot.radius) return false;
  if (glideMeetsRect(from, to, safeArea, halfX, halfY)) return false;
  for (let index = 0; index < avoid.currents.length; index++) if (glideMeetsRect(from, to, avoid.currents[index], halfX, halfY)) return false;
  for (let index = 0; index < avoid.mats.length; index++) if (glideMeetsRect(from, to, avoid.mats[index], halfX, halfY)) return false;
  const shapes = avoid.hazards ?? avoid.keepAway;
  for (let index = 0; index < shapes.length; index++) {
    if (glideShapeGap(from, to, shapes[index], halfX, halfY) < SNACK_HAZARD_CLEARANCE) return false;
  }
  return true;
}

/** Whether a box of half size (halfX, halfY) whose centre glides from a to b meets the rectangle, edges included. */
function glideMeetsRect(
  a: Readonly<Point>,
  b: Readonly<Point>,
  rect: Readonly<{ x0: number; x1: number; y0: number; y1: number }>,
  halfX: number,
  halfY: number,
): boolean {
  return segmentMeetsRect(a.x, a.y, b.x, b.y, rect.x0 - halfX, rect.x1 + halfX, rect.y0 - halfY, rect.y1 + halfY);
}

/** The least distance, as boxShapeDistance measures it, between a hazard shape and a box of half size (halfX, halfY) whose centre glides from a to b. */
function glideShapeGap(a: Readonly<Point>, b: Readonly<Point>, shape: Readonly<HazardShape>, halfX: number, halfY: number): number {
  if (shape.kind === 'circle') {
    return Math.max(0, rectSegmentGap(shape.x - halfX, shape.x + halfX, shape.y - halfY, shape.y + halfY, a, b) - shape.r);
  }
  return rectSegmentGap(shape.x0 - halfX, shape.x1 + halfX, shape.y0 - halfY, shape.y1 + halfY, a, b);
}

/** Whether the box is farther than its strike range from every threat. */
function outOfThreatReach(box: Readonly<HazardRect>, threats: readonly Threat[]): boolean {
  return threats.every((threat) => boxThreatDistance(box, threat) > threat.strike);
}

/** Px between the samples tadpoleWanderClear() takes along a wander loop, at most. */
const WANDER_SAMPLE_PX = 2;

/** The longest run of true flags, counting round from the last back to the first. */
function longestCyclicRun(flags: readonly boolean[]): number {
  const firstFalse = flags.indexOf(false);
  if (firstFalse < 0) return flags.length;
  let best = 0;
  let run = 0;
  for (let step = 1; step <= flags.length; step++) {
    run = flags[(firstFalse + step) % flags.length] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Whether each sample along the loop through `points` is out of every threat's reach: evenly
 * spaced, at most WANDER_SAMPLE_PX px apart, the first at points[0].
 */
function loopSamplesOutOfReach(points: readonly Readonly<Point>[], threats: readonly Threat[]): boolean[] {
  const loop = snackWander(points, 1, 0);
  const count = Math.max(1, Math.ceil(loop.lap / WANDER_SAMPLE_PX));
  const start = points[0];
  return Array.from({ length: count }, (_, k) => {
    const along = (k * loop.lap) / count;
    const x = start.x + wanderOffsetAlong(loop, along, 'x');
    const y = start.y + wanderOffsetAlong(loop, along, 'y');
    return outOfThreatReach({ kind: 'rect', x0: x, x1: x, y0: y, y1: y }, threats);
  });
}

/**
 * Whether a tadpole's wander loop is a clear place for it (issue #131, ND-7): every turn point and
 * every leg's box meets mobileSnackHardClear(), and the longest stretch of the loop out of every
 * threat's reach (zoneThreats strike range; a predator from its patrol loop, a moving hazard from
 * its sweep) is at least TADPOLES.safeLoopShare of the loop, sampled along it at most
 * WANDER_SAMPLE_PX px apart.
 */
export function tadpoleWanderClear(wander: Readonly<TadpoleWander>, avoid: MobileSnackAvoid): boolean {
  const points = wander.points;
  if (!points.every((point) => mobileSnackHardClear(legBox(point, point), avoid))) return false;
  if (!loopLegBoxes(points).every((box) => mobileSnackHardClear(box, avoid))) return false;
  const samples = loopSamplesOutOfReach(points, avoid.threats);
  return longestCyclicRun(samples) >= TADPOLES.safeLoopShare * samples.length;
}

/**
 * Whether a shrimp's home is a clear place for it (issue #131, ND-7): every hop spot's drift-and-bob
 * box (shrimpBox) and every hop leg's box meets mobileSnackHardClear(), every hop leg's whole glide
 * passes shrimpGlideClear(), and at least SHRIMP.safeSpotShare of its hop spots have a drift-and-bob
 * box out of every threat's reach.
 */
export function shrimpHomeClear(home: Readonly<ShrimpHome>, drift: Readonly<SnackDrift>, avoid: MobileSnackAvoid): boolean {
  const spots = home.points;
  const spotBoxes = spots.map((spot) => shrimpBox(spot, drift));
  if (!spotBoxes.every((box) => mobileSnackHardClear(box, avoid))) return false;
  if (!loopLegBoxes(spots).every((box) => mobileSnackHardClear(box, avoid))) return false;
  if (spots.length > 1 && !spots.every((spot, i) => shrimpGlideClear(spot, spots[(i + 1) % spots.length], drift, avoid))) return false;
  const safe = spotBoxes.filter((box) => outOfThreatReach(box, avoid.threats)).length;
  return safe >= SHRIMP.safeSpotShare * spotBoxes.length;
}

/** The box around the points, edges included. */
function pointsBox(points: readonly Readonly<Point>[]): HazardRect {
  const box: HazardRect = { kind: 'rect', x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const point of points) {
    box.x0 = Math.min(box.x0, point.x);
    box.x1 = Math.max(box.x1, point.x);
    box.y0 = Math.min(box.y0, point.y);
    box.y1 = Math.max(box.y1, point.y);
  }
  return box;
}

/**
 * The 8 catch proof starts round the home box (issue #131, ND-8): its corners and edge middles,
 * TADPOLE_CATCH_START_GAP px outside it, each held inside the swim bounds.
 */
function catchStarts(home: Readonly<HazardRect>, bounds: SwimBounds): Point[] {
  const gap = TADPOLE_CATCH_START_GAP;
  const xs = [home.x0 - gap, (home.x0 + home.x1) / 2, home.x1 + gap];
  const ys = [home.y0 - gap, (home.y0 + home.y1) / 2, home.y1 + gap];
  const starts: Point[] = [];
  ys.forEach((y, row) => {
    xs.forEach((x, column) => {
      if (row === 1 && column === 1) return;
      starts.push({ x: Math.min(bounds.maxX, Math.max(bounds.minX, x)), y: Math.min(bounds.maxY, Math.max(bounds.minY, y)) });
    });
  });
  return starts;
}

/** The unit vector from (fromX, fromY) to (toX, toY); zero when they are the same place. */
function unitToward(fromX: number, fromY: number, toX: number, toY: number): Vec2 {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  return distance > 0 ? { x: (toX - fromX) / distance, y: (toY - fromY) / distance } : { x: 0, y: 0 };
}

/**
 * Whether an axolotl swimming with `tuning` from `start`, steering straight at where the tadpole is
 * drawn, has its head reach centre within SNACK_REACH.radius of it within TADPOLE_CATCH_SECONDS.
 */
function eatsTadpoleFrom(start: Readonly<Point>, tadpole: Collectible, bounds: SwimBounds, tuning: SwimTuning): boolean {
  const env: SwimEnv = { current: { x: 0, y: 0 }, dragMul: 1, bounds, dashing: false };
  const frame: SnackFrame = { driftT: 0, bobT: 0, bobbing: false, drift: STILL_DRIFT, bounds };
  let swim: SwimState = { x: start.x, y: start.y, vx: 0, vy: 0, facing: drawnSnackX(tadpole, 0, frame) < start.x ? -1 : 1 };
  const steps = Math.round(TADPOLE_CATCH_SECONDS / CATCH_STEP_SECONDS);
  for (let step = 0; step <= steps; step++) {
    frame.driftT = step * CATCH_STEP_SECONDS;
    const placeX = drawnSnackX(tadpole, 0, frame);
    const placeY = drawnSnackY(tadpole, 0, frame);
    const body = drawnAxolotl({ swim, t: 0, clock: frame.driftT, ambient: false, motionBob: 0, legsPresent: 1, swimming: true, squash: 1 });
    const head = headPoint(body);
    if (Math.hypot(placeX - head.x, placeY - head.y) <= SNACK_REACH.radius) return true;
    swim = stepSwim(swim, unitToward(swim.x, swim.y, placeX, placeY), env, CATCH_STEP_SECONDS, tuning);
  }
  return false;
}

/**
 * The one-leg catch proof for a tadpole (issue #131, ND-8): whether an axolotl with `tuning`
 * (by default a one-leg axolotl, legSwimTuning(1)) eats the tadpole swimming `wander` at `rule`'s
 * speed within TADPOLE_CATCH_SECONDS from each of 8 starts round its home box, the corners and
 * edge middles TADPOLE_CATCH_START_GAP px outside it, held inside `bounds`. Each run starts still,
 * at drift time 0, with no current, and steers straight at where the tadpole is drawn (drawnSnackX,
 * drawnSnackY) by stepSwim; the tadpole counts as eaten when the head reach centre (headPoint of
 * drawnAxolotl) is within SNACK_REACH.radius of it, inclusive. Throws RangeError when the rule or
 * the wander loop is outside its limits (tadpoleWander).
 */
export function oneLegCatchesTadpole(
  rule: Readonly<TadpoleRule>,
  wander: Readonly<TadpoleWander>,
  bounds: SwimBounds,
  tuning: SwimTuning = legSwimTuning(1),
): boolean {
  const checked = tadpoleWander(rule, pointPairs(wander.points), wander.offset);
  const start = checked.points[0];
  const tadpole: Collectible = {
    id: 'catch-proof-tadpole',
    kind: 'tadpole',
    x: start.x,
    y: start.y,
    collected: false,
    wander: snackWander(checked.points, rule.speed, checked.offset),
  };
  return catchStarts(pointsBox(checked.points), bounds).every((from) => eatsTadpoleFrom(from, tadpole, bounds, tuning));
}

/**
 * The fastest top speed of the mix's snacks in px/s (ND-28), counting only types with at least one
 * snack: a tadpole's speed, and a shrimp's flickDistance / (restFor + flickDistance / flickSpeed),
 * the farthest it gets a second over one rest and one flick. 0 with no mobile snacks.
 */
export function snackTopSpeed(mix: Readonly<MobileSnackMix>): number {
  const tadpole = mix.tadpole && mix.wanders.length > 0 ? mix.tadpole.speed : 0;
  const rule = mix.shrimp;
  const shrimp = rule && mix.homes.length > 0 ? rule.flickDistance / (rule.restFor + rule.flickDistance / rule.flickSpeed) : 0;
  return Math.max(tadpole, shrimp);
}

/**
 * The Snack magnet's pull for a trip in this zone (PRD A19, open question 275, ND-28):
 * max(`base`, 1.2 x the fastest top speed of its mobile snacks), and exactly `base` with none.
 * Worked as top x 6 / 5, so a whole speed gives the pull's exact value.
 */
export function snackMagnetSpeed(base: number, zone: Pick<ZoneLayout, 'mobileSnacks'>): number {
  if (!zone.mobileSnacks) return base;
  return Math.max(base, (snackTopSpeed(zone.mobileSnacks) * 6) / 5);
}

function isWormOrBug(snack: Readonly<{ kind: string }>): boolean {
  return snack.kind === 'worm' || snack.kind === 'bug';
}

/**
 * The one-time darters of a trip (PRD H4, open question 274, ND-27): null when the area has no dart
 * rule or its zone has shrimp, which replace them; otherwise createSnackDarts over the worms and
 * bugs only, so a tadpole is never a one-time darter. With no mobile snacks this is
 * createSnackDarts(zone.collectibles, area.snackDart).
 */
export function oneTimeDarts(
  area: Pick<AreaData, 'snackDart'>,
  zone: Pick<ZoneLayout, 'collectibles' | 'mobileSnacks'>,
): SnackDartState | null {
  if (!area.snackDart || (zone.mobileSnacks?.homes.length ?? 0) > 0) return null;
  return createSnackDarts(zone.collectibles.filter(isWormOrBug), area.snackDart);
}

/** The fact card id and meet range of a snack kind; null for a worm or a bug. */
function snackTypeMeet(kind: string): { id: string; range: number } | null {
  if (kind === 'tadpole') return { id: TADPOLE_FACT.id, range: TADPOLE_MEET_RANGE };
  if (kind === 'shrimp') return { id: SHRIMP_FACT.id, range: SHRIMP_MEET_RANGE };
  return null;
}

function isNewlyMet(
  snacks: readonly Collectible[],
  id: string,
  pos: Readonly<Point>,
  met: readonly string[],
  frame: SnackFrame,
): boolean {
  if (met.includes(id)) return false;
  return snacks.some((snack, index) => {
    const meet = snackTypeMeet(snack.kind);
    if (snack.collected || meet?.id !== id) return false;
    return Math.hypot(drawnSnackX(snack, index, frame) - pos.x, drawnSnackY(snack, index, frame) - pos.y) <= meet.range;
  });
}

/**
 * The snack type fact card ids the axolotl at `pos` meets now (PRD A21, C13, open question 276,
 * ND-29): each type not yet in `met` with an uncollected snack drawn (in `frame`) within its meet
 * range, inclusive, while `pos` is outside the safe area (edges count as inside). Tadpole first,
 * each id once. Returns a shared empty list when none.
 */
export function metSnackTypeIds(
  snacks: readonly Collectible[],
  pos: Readonly<Point>,
  safeArea: SafeArea,
  met: readonly string[],
  frame: SnackFrame,
): readonly string[] {
  if (inSafeArea(pos, safeArea)) return NO_IDS;
  const ids = [TADPOLE_FACT.id, SHRIMP_FACT.id].filter((id) => isNewlyMet(snacks, id, pos, met, frame));
  return ids.length > 0 ? ids : NO_IDS;
}

/** The x part of leg `leg` of the loop, from points[leg] to the next point. */
function legDx(wander: Readonly<SnackWander>, leg: number): number {
  return wander.points[(leg + 1) % wander.points.length].x - wander.points[leg].x;
}

/** The y part of leg `leg` of the loop, from points[leg] to the next point. */
function legDy(wander: Readonly<SnackWander>, leg: number): number {
  return wander.points[(leg + 1) % wander.points.length].y - wander.points[leg].y;
}

/** Whether the leg's sideways part is under NEAR_VERTICAL_SHARE of its length (issue #131, ND-4). */
function isNearVertical(wander: Readonly<SnackWander>, leg: number): boolean {
  const dx = legDx(wander, leg);
  return Math.abs(dx) < NEAR_VERTICAL_SHARE * Math.hypot(dx, legDy(wander, leg));
}

/**
 * A tadpole's facing on the leg (issue #131, ND-4): along the leg's sideways part, +1 for none; a
 * near-vertical leg keeps the facing of the last leg before it that is not, round the loop, and is
 * +1 when every leg is near-vertical.
 */
function legFacing(wander: Readonly<SnackWander>, leg: number): 1 | -1 {
  const count = wander.points.length;
  for (let back = 0; back < count; back++) {
    const at = (leg - back + count) % count;
    if (!isNearVertical(wander, at)) return legDx(wander, at) < 0 ? -1 : 1;
  }
  return 1;
}

/** The leg's angle from level in radians, head down positive, held to TADPOLE_MAX_TILT either way (issue #131, ND-4). */
function legPitch(wander: Readonly<SnackWander>, leg: number): number {
  const angle = Math.atan2(legDy(wander, leg), Math.abs(legDx(wander, leg)));
  return Math.min(TADPOLE_MAX_TILT, Math.max(-TADPOLE_MAX_TILT, angle));
}

/** Px along the loop at drift time `t` (s), as drawnSnackX places the tadpole: ((t + offset) x speed) mod lap. */
function wanderAlongAt(wander: Readonly<SnackWander>, t: number): number {
  if (!(wander.lap > 0)) return 0;
  const along = ((t + wander.offset) * wander.speed) % wander.lap;
  return along < 0 ? along + wander.lap : along;
}

/**
 * The tadpole's pitch on the leg it swims now (issue #131, ND-4, ND-11): the leg's pitch, eased
 * (smoothstep) from the leg before's over the first TADPOLE_TURN_SECONDS of the leg, or at once
 * under reduced motion.
 */
function easedPitch(wander: Readonly<SnackWander>, leg: number, t: number, reduced: boolean): number {
  const pitch = legPitch(wander, leg);
  const legStart = leg === 0 ? 0 : wander.legEnds[leg - 1];
  const intoLeg = (wanderAlongAt(wander, t) - legStart) / wander.speed;
  if (reduced || !(intoLeg < TADPOLE_TURN_SECONDS)) return pitch;
  const before = legPitch(wander, (leg - 1 + wander.points.length) % wander.points.length);
  const share = Math.max(0, intoLeg) / TADPOLE_TURN_SECONDS;
  return before + (pitch - before) * share * share * (3 - 2 * share);
}

/** Writes a tadpole's facing and tilt (issue #131, ND-4, ND-11) into `out`: facing +1 and tilt 0 with no wander loop. */
function writeTadpoleHeading(item: Collectible, frame: SnackFrame, reduced: boolean, out: MobileSnackPose): void {
  const wander = item.wander;
  if (!wander) {
    out.facing = 1;
    out.tilt = 0;
    return;
  }
  const leg = wanderLegAt(wander, frame.driftT);
  out.facing = legFacing(wander, leg);
  out.tilt = out.facing * easedPitch(wander, leg, frame.driftT, reduced);
}

function tadpolePose(item: Collectible, frame: SnackFrame, scene: MobileSnackPoseScene, out: MobileSnackPose): MobileSnackPose {
  writeTadpoleHeading(item, frame, scene.reduced, out);
  if (scene.reduced) {
    out.frame = 0;
    out.sway = 0;
    return out;
  }
  const tick = Math.floor(scene.clock * TADPOLE_TAIL_FPS);
  out.frame = ((tick % TADPOLE_TAIL_FRAMES) + TADPOLE_TAIL_FRAMES) % TADPOLE_TAIL_FRAMES;
  out.sway = TADPOLE_SWAY * Math.sin((2 * Math.PI * scene.clock) / TADPOLE_SWAY_PERIOD);
  return out;
}

/**
 * The drawn pose of the snack at `index` (ND-24, ND-25, ND-30; issue #131, ND-4, ND-10, ND-11),
 * written into `out` and returned, so the view allocates nothing. Everything comes from the drift
 * clock, the scene clock and the loop's build-time leg data. A tadpole's place stays exactly on its
 * loop. It faces along the leg it swims now, flipping at the corner; a near-vertical leg (sideways
 * part under a quarter of its length) keeps the facing it had, +1 when every leg is near-vertical.
 * Its tilt is facing x the leg's angle from level (head down positive), held to TADPOLE_MAX_TILT
 * either way, so its head points along the leg in both facings, eased from the leg before's over
 * the first TADPOLE_TURN_SECONDS after each corner. It shows tail frame floor(clock x 8) mod 4 and
 * sways up to 8 degrees either way; under reduced motion it shows frame 0 with no sway, and its tilt
 * changes at once. A shrimp, with no sway and no tilt, faces the head (+1 straight above or below
 * it), so its flick goes backward, while the head is within SHRIMP.holdDistance of where it is
 * drawn (inclusive), while `shrimp.flicking` and while `shrimp.afterFlick`; otherwise it faces
 * `shrimp.hopSign`, or the head when that is 0. It shows its flick frame while `shrimp.flicking`,
 * else its rest frame (at rest and while hopping); under reduced motion its rest frame. A worm or a
 * bug gets frame 0, facing +1, no sway and no tilt.
 */
export function mobileSnackPose(
  item: Collectible,
  index: number,
  frame: SnackFrame,
  scene: MobileSnackPoseScene,
  shrimp: Readonly<ShrimpPoseState>,
  out: MobileSnackPose,
): MobileSnackPose {
  if (item.kind === 'tadpole') return tadpolePose(item, frame, scene, out);
  out.sway = 0;
  out.tilt = 0;
  if (item.kind !== 'shrimp') {
    out.frame = 0;
    out.facing = 1;
    return out;
  }
  out.facing = shrimpFacing(item, index, frame, scene.head, shrimp);
  out.frame = shrimp.flicking && !scene.reduced ? SHRIMP_FLICK_FRAME : SHRIMP_REST_FRAME;
  return out;
}

/** A shrimp's facing (issue #131, ND-10): toward the head while held, flicking or resting after a flick, else its last hop's x sign. */
function shrimpFacing(
  item: Collectible,
  index: number,
  frame: SnackFrame,
  head: Readonly<Point>,
  shrimp: Readonly<ShrimpPoseState>,
): 1 | -1 {
  const x = drawnSnackX(item, index, frame);
  const towardHead = head.x < x ? -1 : 1;
  if (shrimp.hopSign === 0 || shrimp.flicking || shrimp.afterFlick) return towardHead;
  const held = Math.hypot(x - head.x, drawnSnackY(item, index, frame) - head.y) <= SHRIMP.holdDistance;
  return held ? towardHead : shrimp.hopSign;
}

function mobileSnackCount(mix: Readonly<MobileSnackMix> | undefined): number {
  return mix ? mix.wanders.length + mix.homes.length : 0;
}

/**
 * The share of an area's snacks that are mobile (ND-23, ND-31): tadpoles and shrimp over all its
 * snacks, worms and bugs included. 0 with no snacks.
 */
export function mobileSnackShare(layout: Pick<AreaLayoutData, 'snackWorms' | 'snackBugs' | 'mobileSnacks'>): number {
  const mobile = mobileSnackCount(layout.mobileSnacks);
  const total = layout.snackWorms + layout.snackBugs + mobile;
  return total === 0 ? 0 : mobile / total;
}

/**
 * Whether area `number`'s layout meets its SNACK_RAMP row (PRD H4, open question 278, ND-31): Area 1
 * has no mobile snacks; from Area 2 on, the area has both tadpoles and shrimp, its mobile share and
 * tadpole speed inside its row (Area 6 on: SNACK_RAMP.later). Throws RangeError when `number` is not
 * a whole number from 1.
 */
export function meetsSnackRamp(
  number: number,
  layout: Pick<AreaLayoutData, 'snackWorms' | 'snackBugs' | 'mobileSnacks'>,
): boolean {
  if (!Number.isInteger(number) || number < 1) {
    throw new RangeError(`meetsSnackRamp: area number must be a whole number from 1, got ${number}`);
  }
  const row = SNACK_RAMP.rows[number - 1] ?? SNACK_RAMP.later;
  const mix = layout.mobileSnacks;
  if (!row.mobile) return mobileSnackCount(mix) === 0;
  if (!mix?.tadpole || !mix.shrimp || mix.wanders.length === 0 || mix.homes.length === 0) return false;
  const share = mobileSnackShare(layout);
  const speed = mix.tadpole.speed;
  return (
    share >= row.minShare &&
    share <= row.maxShare &&
    speed >= row.minTadpoleSpeed &&
    speed <= row.maxTadpoleSpeed
  );
}

/** Whether the point is inside the swim bounds and below the highest wave. */
function inSwimWater(point: Readonly<Point>, bounds: SwimBounds): boolean {
  if (point.x < bounds.minX || point.x > bounds.maxX) return false;
  return point.y >= bounds.minY && point.y <= bounds.maxY && point.y > SURFACE_PEAK_Y;
}

/**
 * Whether a tadpole wander loop swum at `speed` px/s meets the snack motion rules (issue #131,
 * ND-1, ND-2, ND-3): TADPOLES.minLoopPoints to TADPOLES.maxLoopPoints turn points; a home box from
 * TADPOLES.minHomeWidth to TADPOLES.maxHomeWidth px wide and TADPOLES.minHomeHeight to
 * TADPOLES.maxHomeHeight px tall; every point inside `bounds` and below the highest wave; each leg
 * TADPOLES.minLegSeconds to TADPOLES.maxLegSeconds; and the lap at most TADPOLES.maxLapSeconds.
 */
function wanderMeetsMotion(wander: Readonly<TadpoleWander>, speed: number, bounds: SwimBounds): boolean {
  const points = wander.points;
  if (points.length < TADPOLES.minLoopPoints || points.length > TADPOLES.maxLoopPoints) return false;
  const home = pointsBox(points);
  const width = home.x1 - home.x0;
  const height = home.y1 - home.y0;
  if (width < TADPOLES.minHomeWidth || width > TADPOLES.maxHomeWidth) return false;
  if (height < TADPOLES.minHomeHeight || height > TADPOLES.maxHomeHeight) return false;
  if (!points.every((point) => inSwimWater(point, bounds))) return false;
  let lapSeconds = 0;
  for (let leg = 0; leg < points.length; leg++) {
    const next = points[(leg + 1) % points.length];
    const seconds = Math.hypot(next.x - points[leg].x, next.y - points[leg].y) / speed;
    if (!(seconds >= TADPOLES.minLegSeconds && seconds <= TADPOLES.maxLegSeconds)) return false;
    lapSeconds += seconds;
  }
  return lapSeconds <= TADPOLES.maxLapSeconds;
}

/**
 * Whether a shrimp home meets the snack motion rules (issue #131, ND-5): SHRIMP.minHomeSpots to
 * SHRIMP.maxHomeSpots hop spots in a box at most SHRIMP.maxHomeWidth x SHRIMP.maxHomeHeight px.
 */
function homeMeetsMotion(home: Readonly<ShrimpHome>): boolean {
  const points = home.points;
  if (points.length < SHRIMP.minHomeSpots || points.length > SHRIMP.maxHomeSpots) return false;
  const box = pointsBox(points);
  return box.x1 - box.x0 <= SHRIMP.maxHomeWidth && box.y1 - box.y0 <= SHRIMP.maxHomeHeight;
}

/**
 * Whether the layout's mobile snacks move as PRD H4's movement rules ask (issue #131, ND-2, ND-3,
 * ND-5): every tadpole wander loop has at least TADPOLES.minLoopPoints turn points and meets the
 * home area and direction change rules at the tadpole rule's speed, inside the swim bounds of an
 * area `screensWide` x `screensTall` screens; and every shrimp home has at least
 * SHRIMP.minHomeSpots hop spots in a box no bigger than SHRIMP.maxHomeWidth x SHRIMP.maxHomeHeight
 * px. False when there are wander loops but no tadpole rule. True with no mobile snacks, as there is
 * nothing to check; meetsSnackRamp() asks for them. The keep-out rules are tadpoleWanderClear() and
 * shrimpHomeClear(), and the catch proof is oneLegCatchesTadpole().
 */
export function meetsSnackMotion(layout: Pick<AreaLayoutData, 'screensWide' | 'screensTall' | 'mobileSnacks'>): boolean {
  const mix = layout.mobileSnacks;
  if (!mix) return true;
  const tadpole = mix.tadpole;
  if (mix.wanders.length > 0 && !tadpole) return false;
  const bounds = swimBounds(areaSize(layout.screensWide, layout.screensTall));
  const wandersMove = mix.wanders.every((wander) => tadpole !== undefined && wanderMeetsMotion(wander, tadpole.speed, bounds));
  return wandersMove && mix.homes.every(homeMeetsMotion);
}
