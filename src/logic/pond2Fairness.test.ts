/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264, ND-17) on Area 3, with its herons and
 * carp (issue #133, ND-8), using the shared harness in riskFairness.ts.
 */
import { describe, expect, it } from 'vitest';
import { createEncounter } from './encounter';
import { inSightCover, routeDistance, turnDistance } from './hiding';
import { POND_2_LAYOUT } from './pond2Layout';
import { CARP_SPECIES, HERON_SPECIES, routeLoopDistance } from './predators';
import {
  DT,
  EXTRA_SEEDS,
  START_STEP,
  fairnessZone,
  firstFairStart,
  heronWaitPoint,
  inPredatorReach,
  nearestSafeStart,
  loopSeconds,
  pathHits,
  poolSpots,
  tailSteps,
  tilapiaOf,
} from './riskFairness';
import { CARP, HERON, RISK, TILAPIA } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds } from './zone';

const TAIL_STEPS = tailSteps(TILAPIA);
/** Least px from a safe start to every tilapia loop: a lunge plus Area 3's 100 px leash (issue #133, ND-8). */
const TILAPIA_START_CLEARANCE = TILAPIA.lungeRange + 100;
/** Least px from a safe start to every carp loop: a carp lunge plus its 80 px leash (issue #133, ND-8). */
const CARP_START_CLEARANCE = CARP.lungeRange + 80;

const pond2 = fairnessZone(buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED));

describe('risk fairness on the default Area 3 zone', () => {
  const { zone, ctx, longestLoop, startWindow, lastStartIndex, parkSteps } = pond2;
  const spots = poolSpots(zone);
  const herons = zone.predatorRoutes.filter((route) => route.species.id === HERON_SPECIES.id);
  const carps = zone.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
  /** Seconds a heron takes to wade there and back along its two-point stretch. */
  const wadeSeconds = herons.map((route) => {
    const [start, end] = route.waypoints;
    return (2 * Math.hypot(end.x - start.x, end.y - start.y)) / HERON.patrolSpeed;
  });
  /** Seconds a carp takes round its patrol loop (issue #133, ND-8). */
  const carpLoopSeconds = carps.map((route) => loopSeconds(route, route.species.tuning.patrolSpeed));

  it('has pool spots, two herons and two carp, start times over the longest tilapia loop and every heron and carp wade, and hazards that never hit', () => {
    expect(spots.length).toBeGreaterThan(0);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species.id])).toEqual([
      ['heron-0', 'heron'],
      ['heron-1', 'heron'],
      ['carp-0', 'carp'],
      ['carp-1', 'carp'],
    ]);
    expect(startWindow).toBeCloseTo(Math.max(longestLoop, ...wadeSeconds, ...carpLoopSeconds), 9);
    expect(startWindow).toBeGreaterThan(longestLoop);
    expect(startWindow).toBeGreaterThanOrEqual(Math.max(...wadeSeconds, ...carpLoopSeconds));
    expect(lastStartIndex).toBe(Math.floor(startWindow / START_STEP));
    expect(parkSteps).toBe(Math.max(TAIL_STEPS, tailSteps(HERON), ...carps.map((route) => tailSteps(route.species.tuning))));
    expect(parkSteps * DT).toBeGreaterThanOrEqual(HERON.windup + HERON.lungeDuration);
    expect(parkSteps * DT).toBeGreaterThanOrEqual(CARP.windup + CARP.lungeDuration);
    expect(zone.hazards.length).toBeGreaterThan(0);
    expect(zone.hazards.every((hazard) => !hazard.type.costsLeg)).toBe(true);
    expect(ctx.bounds).toEqual(swimBounds(zone));
  });

  it('catches a hit when the axolotl waits at each Legendary pot, or for a pot in cover at the nearest uncovered point on its way in that a heron can reach', () => {
    const pots = spots.filter((spot) => spot.rarity === 'legendary');
    expect(pots.length).toBeGreaterThan(0);
    expect(pots.some((pot) => inSightCover(pot, zone))).toBe(true);
    for (const pot of pots) {
      const wait = heronWaitPoint(pot, zone);
      expect(inSightCover(wait, zone), pot.id).toBe(false);
      expect(inPredatorReach(wait, zone), pot.id).toBe(true);
      const waiting = Array.from({ length: Math.ceil(startWindow / DT) }, () => ({ x: wait.x, y: wait.y }));
      expect(pathHits(createEncounter(zone), waiting, ctx), pot.id).toBe(true);
    }
  });

  it.each(spots)('finds a safe start more than 240 px from every tilapia loop, more than 200 px from every carp loop and out of every heron reach for $id', (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(tilapiaOf(zone).chase?.leash).toBe(100);
    expect([TILAPIA_START_CLEARANCE, CARP_START_CLEARANCE]).toEqual([240, 200]);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(TILAPIA_START_CLEARANCE);
    for (const route of carps) {
      expect(route.species.tuning.chase?.leash, route.id).toBe(80);
      expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(CARP_START_CLEARANCE);
    }
    for (const route of herons) {
      expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(HERON.lungeRange);
    }
  });

  it.each(spots)('lets the axolotl grab $id without a hit for some start time', (spot) => {
    expect(firstFairStart(spot, pond2), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  });

  it.each(spots)('keeps $id at least the turn clearance from every tilapia and heron waypoint', (spot) => {
    expect(turnDistance(spot, [...zone.tilapiaRoutes, ...zone.predatorRoutes])).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('Area 3 risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot and route identical to the default seed for seed %i', (seed) => {
    const layout = buildZone(POND_2_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(pond2.zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(pond2.zone.predatorRoutes);
    expect(layout.spots).toEqual(pond2.zone.spots);
    expect(layout.hazards).toEqual(pond2.zone.hazards);
  });
});
