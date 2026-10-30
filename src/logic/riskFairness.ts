/**
 * Headless fairness harness for the risk ladder (B10, issue #70; PRD open question 264, ND-17): can
 * every placed treasure be grabbed without being hit, by timing or a Tail Dash, under the real
 * encounter rules (A1, A2), chases and moving hazards included. Each area's fairness file uses it.
 */
import { createEncounter, createEncounterContext, stepEncounter, type EncounterContext, type EncounterState } from './encounter';
import { shapeDistance } from './hazards';
import { inSightCover, routeDistance } from './hiding';
import { legSwimTuning } from './legs';
import { movingHazardPeriod, movingHazardSweep } from './movingHazards';
import { TILAPIA_SPECIES, routeLoopDistance, type PredatorRules, type PredatorTuning } from './predators';
import { LEGS, SWIM, TILAPIA, type TilapiaTuning } from './tuning';
import { inSafeArea, swimBounds, type HidingSpot, type Point, type TilapiaRoute, type ZoneLayout } from './zone';

/** Seconds per encounter step. */
export const DT = 1 / 60;
/** Seconds between two start times tried. */
export const START_STEP = 0.25;
/** Zone seeds other than the default that each area's fairness file also checks. */
export const EXTRA_SEEDS: readonly number[] = Object.freeze([1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321]);

const STEPS_PER_START = Math.round(START_STEP / DT);
const DASH_STEPS = Math.round(SWIM.dashDuration / DT);
const SEARCH_ANGLES = 360;

const cruiseSpeed = legSwimTuning(LEGS.count).maxSpeed;

/**
 * One zone under test: the zone, an encounter context with its own bounds, its start times, and the
 * steps to wait at the start after a visit. Start times cover the longest tilapia loop, every other
 * predator's wade along its loop and every moving hazard's cycle.
 */
export interface FairnessZone {
  zone: ZoneLayout;
  ctx: EncounterContext;
  longestLoop: number;
  startWindow: number;
  lastStartIndex: number;
  parkSteps: number;
}

/** The fairness view of a zone: its context, start window and park time. */
export function fairnessZone(zone: ZoneLayout): FairnessZone {
  const tilapia = tilapiaOf(zone);
  const longestLoop = Math.max(...zone.tilapiaRoutes.map((route) => loopSeconds(route, tilapia.patrolSpeed)));
  const species = zone.predatorRoutes.map((route) => route.species.tuning);
  const wades = zone.predatorRoutes.map((route) => loopSeconds(route, route.species.tuning.patrolSpeed));
  const cycles = (zone.movingHazards ?? []).map((spawn) => movingHazardPeriod(spawn.type));
  const startWindow = Math.max(longestLoop, ...wades, ...cycles);
  return {
    zone,
    ctx: createEncounterContext({ bounds: swimBounds(zone) }),
    longestLoop,
    startWindow,
    lastStartIndex: Math.floor(startWindow / START_STEP),
    parkSteps: Math.max(tailSteps(tilapia), ...species.map(tailSteps)),
  };
}

/** The tilapia tuning a zone plays: its own when set, else TILAPIA. */
export function tilapiaOf(zone: Pick<ZoneLayout, 'tilapia'>): Readonly<TilapiaTuning> {
  return zone.tilapia ?? TILAPIA;
}

/** Steps a warning and strike of this tuning last, so a parked axolotl outlasts any strike under way. */
export function tailSteps(tuning: PredatorTuning): number {
  return Math.ceil((Math.max(tuning.windup, tuning.minWindup) + tuning.lungeDuration) / DT);
}

/** Seconds a predator takes to patrol its whole closed loop at `speed`. */
export function loopSeconds(route: TilapiaRoute, speed: number): number {
  const points = route.waypoints;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    perimeter += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return perimeter / speed;
}

/** Every spot some find may be placed in. */
export function poolSpots(layout: Pick<ZoneLayout, 'finds' | 'spots'>): HidingSpot[] {
  const pooled = new Set(layout.finds.flatMap((find) => find.pool));
  return layout.spots.filter((spot) => pooled.has(spot.id));
}

/**
 * Reach in px from a predator's patrol loop: its lungeRange plus its leash when it chases off its
 * route. Mirrors dangerBar's predatorReach (issue #130, ND-11: the same reach as ND-3).
 */
function predatorReach(tuning: Readonly<PredatorTuning>, rules: Readonly<PredatorRules> | undefined): number {
  const leash = tuning.chase && !rules?.warnOnRoute ? tuning.chase.leash : 0;
  return tuning.lungeRange + leash;
}

/** Whether a point is farther than each predator's reach from its loop, the tilapia's (by the zone's tuning) included. */
function clearOfPredators(point: Point, zone: ZoneLayout): boolean {
  return (
    routeDistance(point, zone.tilapiaRoutes) > predatorReach(tilapiaOf(zone), TILAPIA_SPECIES.rules) &&
    zone.predatorRoutes.every(
      (route) => routeLoopDistance(point, route.waypoints) > predatorReach(route.species.tuning, route.species.rules),
    )
  );
}

/** Whether a point is outside every moving hazard's sweep grown by its touch reach. */
function clearOfMovingHazards(point: Point, zone: ZoneLayout): boolean {
  return (zone.movingHazards ?? []).every((spawn) => shapeDistance(point, movingHazardSweep(spawn)) > spawn.type.touchReach);
}

/**
 * Whether the axolotl can wait at a point (issue #130, ND-11): in the zone's water, farther than
 * every predator's lungeRange plus its leash from its loop (sight not counted) and clear of every
 * moving hazard.
 */
export function isSafeStart(point: Point, zone: ZoneLayout): boolean {
  const bounds = swimBounds(zone);
  const inBounds = point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  return inBounds && clearOfPredators(point, zone) && clearOfMovingHazards(point, zone);
}

/** Whether a point is farther than each predator route's species lunge range from that route. */
export function outOfPredatorReach(point: Point, zone: Pick<ZoneLayout, 'predatorRoutes'>): boolean {
  return zone.predatorRoutes.every((route) => routeLoopDistance(point, route.waypoints) > route.species.tuning.lungeRange);
}

/** Points on a circle round `centre`, in a fixed angle order. */
export function ringPoints(centre: Point, radius: number): Point[] {
  return Array.from({ length: SEARCH_ANGLES }, (_, i) => {
    const angle = (i * 2 * Math.PI) / SEARCH_ANGLES;
    return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  });
}

/**
 * The nearest safe start to a spot, searched ring by ring in 1 px steps out to the zone's diagonal
 * so the whole area is covered (issue #130, ND-11); the spot itself when already safe.
 */
export function nearestSafeStart(spot: Point, zone: ZoneLayout): Point {
  if (isSafeStart(spot, zone)) return { x: spot.x, y: spot.y };
  const maxRadius = Math.ceil(Math.hypot(zone.width, zone.height));
  for (let radius = 1; radius <= maxRadius; radius++) {
    const found = ringPoints(spot, radius).find((point) => isSafeStart(point, zone));
    if (found) return found;
  }
  throw new Error(`nearestSafeStart: no safe start in the area for (${spot.x}, ${spot.y})`);
}

/** Whether some predator route's species can warn at a point: within its lunge range of its route and outside the safe area. */
export function inPredatorReach(point: Point, zone: Pick<ZoneLayout, 'predatorRoutes' | 'safeArea'>): boolean {
  return !inSafeArea(point, zone.safeArea) && !outOfPredatorReach(point, zone);
}

/**
 * Where to wait to check that a pot is risky: the pot itself when it is open water, else the nearest
 * uncovered point on the straight way in from its safe start that a heron can reach, since a heron
 * cannot see into cover. Throws when no point on the way in is both uncovered and in reach.
 */
export function heronWaitPoint(pot: HidingSpot, zone: ZoneLayout): Point {
  if (!inSightCover(pot, zone)) return { x: pot.x, y: pot.y };
  const wayIn = swimPositions(nearestSafeStart(pot, zone), pot, false);
  const open = wayIn.filter((pos) => !inSightCover(pos, zone) && inPredatorReach(pos, zone));
  if (open.length === 0) throw new Error(`heronWaitPoint: no uncovered point a heron can reach on the way in to ${pot.id}`);
  return open[open.length - 1];
}

/** Axolotl centre after each step of a straight swim at full-leg top speed, the first DASH_STEPS dashing when `dash`. */
export function swimPositions(from: Point, to: Point, dash: boolean): Point[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const positions: Point[] = [];
  let travelled = 0;
  for (let index = 0; travelled < length; index++) {
    const speed = dash && index < DASH_STEPS ? SWIM.dashSpeed : cruiseSpeed;
    travelled = Math.min(length, travelled + speed * DT);
    const share = travelled / length;
    positions.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
  }
  return positions;
}

/** Start to spot (one Tail Dash for a Dash pot) and back, then waiting at the start for `parkSteps` until any strike is over. */
export function visitPath(start: Point, spot: HidingSpot, parkSteps: number): Point[] {
  const parked = Array.from({ length: parkSteps }, () => ({ x: start.x, y: start.y }));
  return [...swimPositions(start, spot, spot.container), ...swimPositions(spot, start, false), ...parked];
}

/** Whether following `path` from `state` takes a hit, from a predator, a still hazard or a moving hazard. */
export function pathHits(state: EncounterState, path: readonly Point[], ctx: EncounterContext): boolean {
  let current = state;
  for (const pos of path) {
    const result = stepEncounter(current, pos, DT, ctx);
    if (result.events.some((event) => event.type === 'hit')) return true;
    current = result.state;
  }
  return false;
}

/** The encounter after the axolotl waits at `pos` for `steps`. */
export function parkAt(state: EncounterState, pos: Point, steps: number, ctx: EncounterContext): EncounterState {
  let current = state;
  for (let i = 0; i < steps; i++) current = stepEncounter(current, pos, DT, ctx).state;
  return current;
}

/**
 * First start time in seconds, in START_STEP steps over the start window, whose visit takes no hit;
 * null when none. The visit steps the real encounter built from the zone, so its chases and moving
 * hazards play.
 */
export function firstFairStart(spot: HidingSpot, fair: FairnessZone): number | null {
  const start = nearestSafeStart(spot, fair.zone);
  const path = visitPath(start, spot, fair.parkSteps);
  let warm = createEncounter(fair.zone);
  for (let index = 0; index <= fair.lastStartIndex; index++) {
    if (!pathHits(warm, path, fair.ctx)) return index * START_STEP;
    warm = parkAt(warm, start, STEPS_PER_START, fair.ctx);
  }
  return null;
}
