/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264, ND-17) on Area 6, the spring cave,
 * with its crayfish, its common carp, its dripping stalactites and its geyser vents (issue #77, ND-3
 * to ND-6), using the
 * shared harness in riskFairness.ts on #130's relaxed safe start (ND-11). It also proves the area
 * can be beaten with one leg and that every crayfish pinch is avoidable by swimming away (ND-5, ND-9).
 */
import { describe, expect, it } from 'vitest';
import { SPRING_CAVE_AREA } from './areas';
import { createEncounter, stepEncounter, type EncounterEvent, type EncounterState } from './encounter';
import { currentAt, reedDragAt } from './environment';
import { shapeDistance } from './hazards';
import { meetsThreatRiskRule, turnDistance, zoneThreats } from './hiding';
import { legSwimTuning } from './legs';
import { GEYSER_VENT, STALACTITE_DRIP, movingHazardPeriod, movingHazardSweep } from './movingHazards';
import { CARP_SPECIES, CRAYFISH_SPECIES, routeLoopDistance, type PredatorRoute } from './predators';
import {
  DT,
  EXTRA_SEEDS,
  START_STEP,
  fairnessZone,
  firstFairStart,
  isSafeStart,
  loopSeconds,
  nearestSafeStart,
  outOfPredatorReach,
  parkAt,
  pathHits,
  poolSpots,
  ringPoints,
  tailSteps,
  visitPath,
  type FairnessZone,
} from './riskFairness';
import { CRAYFISH_FLOOR_Y, SPRING_CAVE_CARP, SPRING_CAVE_CRAYFISH, SPRING_CAVE_LAYOUT } from './springCaveLayout';
import { stepSwim, type SwimEnv, type SwimState } from './swimPhysics';
import { CARP_CHASE, CRAYFISH_CHASE, RISK, SWIM } from './tuning';
import { normalize } from './vec';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds, type HidingSpot, type Point, type ZoneLayout } from './zone';

/** A safe start's clearance from every carp loop: its 130 px lunge plus its 120 px leash (issue #130, ND-11). */
const CARP_REACH = 250;
/** A safe start's clearance from every crayfish stretch: its 90 px lunge only, as it chases along its stretch (issue #77, ND-5). */
const CRAYFISH_REACH = 90;
/** Px between two rings of the wider search for a fair start, past the nearest safe start. */
const FAIR_START_RING_STEP = 20;
/** Points tried on each ring of the wider search, in a fixed angle order. */
const FAIR_START_RING_POINTS = 24;
/**
 * Spots whose nearest safe start is not fair with all four legs, as measured: two grotto spots by
 * `crayfish-2`'s stretch and two Rare spots on the ledge over `crayfish-1`, whose aimed pinch now
 * reaches up off the floor; each is grabbed from a safe start of the wider search instead.
 */
const FAR_START_SPOTS = ['spring-cave-1/spot-cave-1', 'spring-cave-1/spot-cave-4', 'spring-cave-1/spot-bank-7', 'spring-cave-1/spot-bank-9'];
/** Spots whose nearest safe start is not fair with one leg, as measured: each is grabbed from a safe start of the wider search instead. */
const ONE_LEG_FAR_START_SPOTS = [
  'spring-cave-1/spot-cave-1',
  'spring-cave-1/spot-cave-4',
  'spring-cave-1/spot-current-3',
  'spring-cave-1/spot-bank-7',
  'spring-cave-1/spot-bank-8',
  'spring-cave-1/spot-bank-9',
];
/** First start time in seconds, as measured, for a one-leg swim of the main path to the exit without a hit (issue #77, ND-9). */
const ONE_LEG_EXIT_START = 6.75;
/** Longest one-leg swim from the Home Spot to the exit, in seconds, before it counts as stuck. */
const ONE_LEG_SWIM_LIMIT = 180;
/** Px from a main path waypoint at which the swim steers for the next one. */
const WAYPOINT_REACH = 8;
/** Px above the floor lane where the axolotl waits for each crayfish to warn: well within its 90 px reach. */
const PINCH_WAIT_HEIGHT = 30;

const springCave = fairnessZone(buildZone(SPRING_CAVE_LAYOUT, DEFAULT_ZONE_SEED));
const oneLeg = legSwimTuning(1);
const STEPS_PER_START = Math.round(START_STEP / DT);
const DASH_STEPS = Math.round(SWIM.dashDuration / DT);
const UP: Point = { x: 0, y: -1 };

/** The visit path for a spot from a start: the harness's four-leg visit, or the one-leg visit. */
type VisitBuilder = (start: Point, spot: HidingSpot, parkSteps: number) => Point[];

/** Where a spot is grabbed from without a hit, and at what start time. */
interface FairStart {
  start: Point;
  time: number;
}

/** Axolotl centre after each step of a straight one-leg swim, the first DASH_STEPS dashing when `dash`. */
function oneLegSwimPositions(from: Point, to: Point, dash: boolean): Point[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const positions: Point[] = [];
  let travelled = 0;
  for (let index = 0; travelled < length; index++) {
    const speed = dash && index < DASH_STEPS ? SWIM.dashSpeed : oneLeg.maxSpeed;
    travelled = Math.min(length, travelled + speed * DT);
    const share = travelled / length;
    positions.push({ x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share });
  }
  return positions;
}

/** A one-leg visit: start to spot (one Tail Dash for a Legendary pot) and back, then waiting at the start for `parkSteps`. */
function oneLegVisitPath(start: Point, spot: HidingSpot, parkSteps: number): Point[] {
  const parked = Array.from({ length: parkSteps }, () => ({ x: start.x, y: start.y }));
  return [...oneLegSwimPositions(start, spot, spot.rarity === 'legendary'), ...oneLegSwimPositions(spot, start, false), ...parked];
}

/** First start time over the start window whose path takes no hit, the axolotl waiting at `wait` between tries; null when none. */
function firstFairTime(wait: Point, path: readonly Point[], fair: FairnessZone): number | null {
  let warm = createEncounter(fair.zone);
  for (let index = 0; index <= fair.lastStartIndex; index++) {
    if (!pathHits(warm, path, fair.ctx)) return index * START_STEP;
    warm = parkAt(warm, wait, STEPS_PER_START, fair.ctx);
  }
  return null;
}

/** Safe starts round a spot, ring by ring FAIR_START_RING_STEP px apart, out to the zone's diagonal. */
function listWiderSafeStarts(spot: Point, zone: ZoneLayout): Point[] {
  const maxRadius = Math.hypot(zone.width, zone.height);
  const everyNth = ringPoints(spot, 1).length / FAIR_START_RING_POINTS;
  const starts: Point[] = [];
  for (let radius = FAIR_START_RING_STEP; radius <= maxRadius; radius += FAIR_START_RING_STEP) {
    const ring = ringPoints(spot, radius).filter((_, index) => index % everyNth === 0);
    starts.push(...ring.filter((point) => isSafeStart(point, zone)));
  }
  return starts;
}

/**
 * The fair start for a spot: its nearest safe start when some start time grabs it without a hit,
 * else the first safe start of the wider search that does; null when none does.
 */
function findFairStart(spot: HidingSpot, fair: FairnessZone, visit: VisitBuilder): FairStart | null {
  const nearest = nearestSafeStart(spot, fair.zone);
  for (const start of [nearest, ...listWiderSafeStarts(spot, fair.zone)]) {
    const time = firstFairTime(start, visit(start, spot, fair.parkSteps), fair);
    if (time !== null) return { start, time };
  }
  return null;
}

/** The swim conditions at a point of the zone: its current and reed drag, no dash. */
function swimEnvAt(pos: Point, zone: ZoneLayout): SwimEnv {
  return { current: currentAt(pos, zone.currents), dragMul: reedDragAt(pos, zone.reedPatches), bounds: swimBounds(zone), dashing: false };
}

/** A unit direction square to the line from a warning predator to the axolotl, on the side of the way ahead. */
function sidestepDirection(pos: Point, predatorPos: Point, ahead: Point): Point {
  const away = normalize({ x: pos.x - predatorPos.x, y: pos.y - predatorPos.y });
  const side = { x: -away.y, y: away.x };
  return side.x * ahead.x + side.y * ahead.y >= 0 ? side : { x: -side.x, y: -side.y };
}

/** The sidestep for the first predator warning among `events`, or null when no predator warned this step. */
function warningSidestep(events: readonly EncounterEvent[], state: EncounterState, pos: Point, ahead: Point): Point | null {
  for (const event of events) {
    if (event.type !== 'telegraph') continue;
    const predator = state.predators.find((candidate) => candidate.routeId === event.sourceId);
    if (predator) return sidestepDirection(pos, predator.pos, ahead);
  }
  return null;
}

/** Whether a point is inside the area's exit circle (inclusive). */
function atExit(pos: Point): boolean {
  const { exit } = SPRING_CAVE_AREA;
  return Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius;
}

/**
 * A one-leg swim from the Home Spot along the main path to the exit, with the zone's current, from
 * the encounter `warm`. Whenever a predator warns, the axolotl swims square to it, on the side of
 * the way ahead, for `parkSteps`, the longest warning and strike, then steers on. Returns the hit's
 * source, or null when it reaches the exit with no hit; throws when it never reaches the exit.
 */
function oneLegExitHit(warm: EncounterState, fair: FairnessZone): string | null {
  const { zone } = fair;
  const targets = zone.mainPath.slice(1);
  let swim: SwimState = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: 1 };
  let encounter = warm;
  let next = 0;
  let sidestep: Point | null = null;
  let sidestepLeft = 0;
  for (let frame = 0; frame < ONE_LEG_SWIM_LIMIT / DT; frame++) {
    const pos = { x: swim.x, y: swim.y };
    if (next === targets.length - 1 && atExit(pos)) return null;
    if (next < targets.length - 1 && Math.hypot(targets[next].x - pos.x, targets[next].y - pos.y) <= WAYPOINT_REACH) next++;
    const ahead = normalize({ x: targets[next].x - pos.x, y: targets[next].y - pos.y });
    sidestepLeft--;
    swim = stepSwim(swim, sidestepLeft > 0 && sidestep ? sidestep : ahead, swimEnvAt(pos, zone), DT, oneLeg);
    const moved = { x: swim.x, y: swim.y };
    const result = stepEncounter(encounter, moved, DT, fair.ctx);
    const hit = result.events.find((event) => event.type === 'hit');
    if (hit?.type === 'hit') return hit.sourceId;
    encounter = result.state;
    const warned = warningSidestep(result.events, encounter, moved, ahead);
    if (warned) [sidestep, sidestepLeft] = [warned, fair.parkSteps];
  }
  throw new Error(`oneLegExitHit: no exit within ${ONE_LEG_SWIM_LIMIT} s`);
}

/** First start time, waiting at the Home Spot, for a one-leg swim to the exit with no hit; null when none over the start window. */
function firstOneLegExitStart(fair: FairnessZone): number | null {
  let warm = createEncounter(fair.zone);
  for (let index = 0; index <= fair.lastStartIndex; index++) {
    if (oneLegExitHit(warm, fair) === null) return index * START_STEP;
    warm = parkAt(warm, fair.zone.start, STEPS_PER_START, fair.ctx);
  }
  return null;
}

/** Steps of a crayfish's patrol along its two-waypoint stretch and back: the longest wait for its warning. */
function stretchSteps(route: PredatorRoute): number {
  return Math.ceil(loopSeconds(route, route.species.tuning.patrolSpeed) / DT);
}

/** The way straight away from `predatorPos` at `from`; straight up when right on it. */
function awayFrom(from: Point, predatorPos: Point): Point {
  return from.x === predatorPos.x && from.y === predatorPos.y ? UP : normalize({ x: from.x - predatorPos.x, y: from.y - predatorPos.y });
}

/**
 * Events while a one-leg axolotl swims straight away from the warning predator at `predatorPos`,
 * from `from`, for `parkSteps`, the longest warning and strike.
 */
function swimAwayEvents(warned: EncounterState, from: Point, predatorPos: Point, fair: FairnessZone): EncounterEvent[] {
  const away = awayFrom(from, predatorPos);
  let swim: SwimState = { x: from.x, y: from.y, vx: 0, vy: 0, facing: 1 };
  let encounter = warned;
  const events: EncounterEvent[] = [];
  for (let step = 0; step < fair.parkSteps; step++) {
    swim = stepSwim(swim, away, swimEnvAt({ x: swim.x, y: swim.y }, fair.zone), DT, oneLeg);
    const result = stepEncounter(encounter, { x: swim.x, y: swim.y }, DT, fair.ctx);
    encounter = result.state;
    events.push(...result.events);
  }
  return events;
}

/**
 * The axolotl waits PINCH_WAIT_HEIGHT above the middle of a crayfish's stretch until that crayfish
 * warns, then swims straight away from it with one leg (STEP-001's swim-away rule) until the
 * warning and strike are over. Returns every event from the warning on; throws when the crayfish
 * never warns.
 */
function swimAwayFromPinch(route: PredatorRoute, fair: FairnessZone): EncounterEvent[] {
  const [first, last] = route.waypoints;
  const wait = { x: (first.x + last.x) / 2, y: CRAYFISH_FLOOR_Y - PINCH_WAIT_HEIGHT };
  let encounter = createEncounter(fair.zone);
  for (let step = 0; step < stretchSteps(route); step++) {
    const result = stepEncounter(encounter, wait, DT, fair.ctx);
    encounter = result.state;
    const crayfish = encounter.predators.find((predator) => predator.routeId === route.id);
    if (crayfish && result.events.some((event) => event.type === 'telegraph' && event.sourceId === route.id)) {
      return [...result.events, ...swimAwayEvents(encounter, wait, crayfish.pos, fair)];
    }
  }
  throw new Error(`swimAwayFromPinch: ${route.id} never warns`);
}

/** The axolotl waiting at `at` for `seconds`, one point per step. */
function waitAt(at: Point, seconds: number): Point[] {
  return Array.from({ length: Math.ceil(seconds / DT) }, () => ({ x: at.x, y: at.y }));
}

/** Every encounter event, in order, along `path` from a fresh Area 6 encounter. */
function listEncounterEvents(path: readonly Point[]): EncounterEvent[] {
  let encounter = createEncounter(springCave.zone);
  const events: EncounterEvent[] = [];
  for (const pos of path) {
    const result = stepEncounter(encounter, pos, DT, springCave.ctx);
    encounter = result.state;
    events.push(...result.events);
  }
  return events;
}

/** Checks that a spot whose nearest safe start is not fair has a fair start, a safe start other than the nearest. */
function expectWiderFairStart(spot: HidingSpot, fair: FairStart | null): void {
  const { zone } = springCave;
  expect(fair, `${spot.id} has no fair start`).not.toBeNull();
  expect(isSafeStart(fair?.start ?? spot, zone), spot.id).toBe(true);
  expect(fair?.start, spot.id).not.toEqual(nearestSafeStart(spot, zone));
}

describe('risk fairness on the default Area 6 zone', () => {
  const { zone, ctx, startWindow, lastStartIndex, parkSteps } = springCave;
  const spots = poolSpots(zone);
  const crayfish = zone.predatorRoutes.filter((route) => route.species.id === CRAYFISH_SPECIES.id);
  const carp = zone.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
  const movingHazards = zone.movingHazards ?? [];

  it('plays three crayfish, seven carp, five stalactites and two geyser vents, no tilapia: start times over the longest stretch, loop and hazard cycle, waiting out the longest strike', () => {
    expect(zone.tilapiaRoutes).toEqual([]);
    expect(crayfish.map((route) => [route.id, route.species])).toEqual([0, 1, 2].map((n) => [`crayfish-${n}`, SPRING_CAVE_CRAYFISH]));
    expect(carp.map((route) => [route.id, route.species])).toEqual([0, 1, 2, 3, 4, 5, 6].map((n) => [`carp-${n}`, SPRING_CAVE_CARP]));
    expect(movingHazards.map((spawn) => spawn.type)).toEqual([...Array(5).fill(STALACTITE_DRIP), GEYSER_VENT, GEYSER_VENT]);
    const wades = zone.predatorRoutes.map((route) => loopSeconds(route, route.species.tuning.patrolSpeed));
    expect(startWindow).toBeCloseTo(Math.max(...wades, ...movingHazards.map((spawn) => movingHazardPeriod(spawn.type))), 9);
    expect(startWindow).toBeCloseTo(970 / 45, 9);
    expect(lastStartIndex).toBe(Math.floor(startWindow / START_STEP));
    expect(parkSteps).toBe(Math.max(tailSteps(SPRING_CAVE_CRAYFISH.tuning), tailSteps(SPRING_CAVE_CARP.tuning)));
    expect(zone.hazards).toEqual([]);
    expect(ctx.bounds).toEqual(swimBounds(zone));
  });

  it('catches a hit when the axolotl waits at each Legendary pot, the aimed pinch of crayfish-2 reaching up to the pots over its stretch', () => {
    const pots = spots.filter((spot) => spot.rarity === 'legendary');
    expect(pots).toHaveLength(5);
    for (const pot of pots) expect(pathHits(createEncounter(zone), waitAt(pot, startWindow), ctx), pot.id).toBe(true);
    const overCrayfish2 = pots.filter((pot) => routeLoopDistance(pot, crayfish[2].waypoints) <= CRAYFISH_REACH);
    expect(overCrayfish2.map((pot) => pot.id)).toEqual(['spring-cave-1/spot-cave-1', 'spring-cave-1/spot-cave-2', 'spring-cave-1/spot-cave-3']);
    for (const pot of overCrayfish2) {
      expect(pot.y, pot.id).toBeLessThan(CRAYFISH_FLOOR_Y);
      const events = listEncounterEvents(waitAt(pot, startWindow));
      const hit = events.find((event) => event.type === 'hit');
      expect(hit?.type === 'hit' && hit.sourceId, pot.id).toBe('crayfish-2');
      const pinch = events.find((event) => event.type === 'lunge' && event.sourceId === 'crayfish-2');
      expect(pinch?.type === 'lunge' && pinch.aim.y, pot.id).toBeLessThan(0);
    }
  });

  it.each(spots)('bands $id by S = 90 for the crayfish, S = 130 for the carp and the touch reach for the stalactites and the geyser', (spot) => {
    const threats = zoneThreats(zone);
    expect(threats.map((threat) => threat.strike)).toEqual([90, 90, 90, ...Array(7).fill(130), ...Array(7).fill(18)]);
    expect([STALACTITE_DRIP.touchReach, GEYSER_VENT.touchReach]).toEqual([18, 18]);
    expect(meetsThreatRiskRule(spot, spot.rarity, threats)).toBe(true);
  });

  it.each(spots)("finds a safe start on #130's relaxed rule past every carp reach, every crayfish lunge and every stalactite and geyser sweep for $id", (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(SPRING_CAVE_CARP.tuning.lungeRange + CARP_CHASE.leash).toBe(CARP_REACH);
    expect(SPRING_CAVE_CRAYFISH.tuning.lungeRange).toBe(CRAYFISH_REACH);
    expect(CRAYFISH_CHASE.leash).toBe(0);
    for (const route of carp) expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(CARP_REACH);
    for (const route of crayfish) expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(CRAYFISH_REACH);
    expect(outOfPredatorReach(start, zone)).toBe(true);
    for (const spawn of movingHazards) expect(shapeDistance(start, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
  });

  it.each(spots)('lets the axolotl grab $id without a hit from a safe start for some start time', (spot) => {
    const fair = findFairStart(spot, springCave, visitPath);
    expect(fair, `${spot.id} (${spot.rarity}) is hit from every safe start at every start time`).not.toBeNull();
    expect(isSafeStart(fair?.start ?? spot, zone)).toBe(true);
  });

  it('grabs every spot from its nearest safe start but four by crayfish-1 and crayfish-2, each grabbed from a safe start of the wider search', () => {
    const far = spots.filter((spot) => firstFairStart(spot, springCave) === null);
    expect(far.map((spot) => spot.id)).toEqual(FAR_START_SPOTS);
    for (const spot of far) expectWiderFairStart(spot, findFairStart(spot, springCave, visitPath));
  }, 60_000);

  it.each(spots)('keeps $id at least the turn clearance from every crayfish and carp waypoint', (spot) => {
    expect(turnDistance(spot, zone.predatorRoutes)).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('beating Area 6 with one leg (issue #77, ND-9)', () => {
  const { zone } = springCave;
  const spots = poolSpots(zone);

  it.each(spots)('lets a one-leg axolotl grab $id without a hit from a safe start for some start time', (spot) => {
    const fair = findFairStart(spot, springCave, oneLegVisitPath);
    expect(fair, `${spot.id} (${spot.rarity}) is hit from every safe start at every start time`).not.toBeNull();
    expect(isSafeStart(fair?.start ?? spot, zone)).toBe(true);
  });

  it('grabs every spot with one leg from its nearest safe start but six by crayfish-1, crayfish-2 and the spring outflow, each grabbed from a safe start of the wider search', () => {
    const far = spots.filter((spot) => {
      const start = nearestSafeStart(spot, zone);
      return firstFairTime(start, oneLegVisitPath(start, spot, springCave.parkSteps), springCave) === null;
    });
    expect(far.map((spot) => spot.id)).toEqual(ONE_LEG_FAR_START_SPOTS);
    for (const spot of far) expectWiderFairStart(spot, findFairStart(spot, springCave, oneLegVisitPath));
  }, 60_000);

  it('lets a one-leg axolotl swim the main path from the Home Spot to the exit with no hit, swimming aside whenever a predator warns', () => {
    expect(firstOneLegExitStart(springCave)).toBe(ONE_LEG_EXIT_START);
    expect(ONE_LEG_EXIT_START).toBeLessThanOrEqual(springCave.startWindow);
  }, 60_000);

  it.each(['crayfish-0', 'crayfish-1', 'crayfish-2'])('never lands a pinch from %s on a one-leg axolotl that swims straight away when its claws open', (id) => {
    const route = zone.predatorRoutes.find((candidate) => candidate.id === id);
    if (!route) throw new Error(`no route ${id}`);
    const events = swimAwayFromPinch(route, springCave);
    expect(events.some((event) => event.type === 'telegraph' && event.sourceId === id)).toBe(true);
    expect(events.filter((event) => event.type === 'hit')).toEqual([]);
  });
});

describe('Area 6 risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot, route, stalactite, geyser, current and the main path identical to the default seed for seed %i, so every proof holds for it too', (seed) => {
    const layout = buildZone(SPRING_CAVE_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(springCave.zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(springCave.zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(springCave.zone.movingHazards);
    expect(layout.spots).toEqual(springCave.zone.spots);
    expect(layout.finds).toEqual(springCave.zone.finds);
    expect(layout.hazards).toEqual(springCave.zone.hazards);
    expect(layout.currents).toEqual(springCave.zone.currents);
    expect(layout.mainPath).toEqual(springCave.zone.mainPath);
  });
});
