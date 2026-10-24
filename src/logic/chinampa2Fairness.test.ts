/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264, ND-17) on Area 5, with its garter
 * snakes, using the shared harness in riskFairness.ts.
 */
import { describe, expect, it } from 'vitest';
import { CHINAMPA_2_LAYOUT, CHINAMPA_2_TILAPIA } from './chinampa2Layout';
import { createEncounter } from './encounter';
import { meetsThreatRiskRule, routeDistance, turnDistance, zoneThreats } from './hiding';
import { routeLoopDistance } from './predators';
import {
  DT,
  EXTRA_SEEDS,
  START_STEP,
  fairnessZone,
  firstFairStart,
  loopSeconds,
  nearestSafeStart,
  pathHits,
  poolSpots,
  tailSteps,
} from './riskFairness';
import { GARTER_SNAKE, RISK } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds } from './zone';

const chinampa2 = fairnessZone(buildZone(CHINAMPA_2_LAYOUT, DEFAULT_ZONE_SEED));

describe('risk fairness on the default Area 5 zone', () => {
  const { zone, ctx, longestLoop, startWindow, lastStartIndex, parkSteps } = chinampa2;
  const spots = poolSpots(zone);
  const snakes = zone.predatorRoutes;
  /** Seconds a snake takes to swim there and back along its two-point stretch. */
  const swimSeconds = snakes.map((route) => {
    const [start, end] = route.waypoints;
    return (2 * Math.hypot(end.x - start.x, end.y - start.y)) / GARTER_SNAKE.patrolSpeed;
  });

  it('plays its own tilapia tuning and three garter snakes: start times over the longest loop and stretch, waiting out the longest strike', () => {
    expect(zone.tilapia).toEqual(CHINAMPA_2_TILAPIA);
    expect(createEncounter(zone).tilapia).toEqual(CHINAMPA_2_TILAPIA);
    expect(snakes.map((route) => [route.id, route.species.id])).toEqual([
      ['garter-snake-0', 'garter-snake'],
      ['garter-snake-1', 'garter-snake'],
      ['garter-snake-2', 'garter-snake'],
    ]);
    expect(longestLoop).toBe(Math.max(...zone.tilapiaRoutes.map((route) => loopSeconds(route, CHINAMPA_2_TILAPIA.patrolSpeed))));
    expect(startWindow).toBeCloseTo(Math.max(longestLoop, ...swimSeconds), 9);
    expect(lastStartIndex).toBe(Math.floor(startWindow / START_STEP));
    expect(parkSteps).toBe(Math.max(tailSteps(CHINAMPA_2_TILAPIA), tailSteps(GARTER_SNAKE)));
    expect(zone.hazards.length).toBeGreaterThan(0);
    expect(zone.hazards.every((hazard) => !hazard.type.costsLeg)).toBe(true);
    expect(ctx.bounds).toEqual(swimBounds(zone));
  });

  it('catches a hit when the axolotl waits at each Legendary pot', () => {
    const pots = spots.filter((spot) => spot.rarity === 'legendary');
    expect(pots.length).toBeGreaterThan(0);
    for (const pot of pots) {
      const waiting = Array.from({ length: Math.ceil(startWindow / DT) }, () => ({ x: pot.x, y: pot.y }));
      expect(pathHits(createEncounter(zone), waiting, ctx), pot.id).toBe(true);
    }
  });

  it.each(spots)('bands $id by S = 150 for the tilapia and S = 110 for the garter snakes', (spot) => {
    const threats = zoneThreats({ tilapiaRoutes: zone.tilapiaRoutes, tilapia: zone.tilapia, predatorRoutes: zone.predatorRoutes });
    expect(threats.map((threat) => threat.strike)).toEqual([150, 150, 150, 110, 110, 110]);
    expect(meetsThreatRiskRule(spot, spot.rarity, threats)).toBe(true);
  });

  it.each(spots)('finds a safe start outside the Area 5 lunge range and every snake reach for $id', (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(CHINAMPA_2_TILAPIA.lungeRange);
    for (const route of snakes) {
      expect(routeLoopDistance(start, route.waypoints), route.id).toBeGreaterThan(GARTER_SNAKE.lungeRange);
    }
  });

  it.each(spots)('lets the axolotl grab $id without a hit for some start time', (spot) => {
    expect(firstFairStart(spot, chinampa2), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  });

  it.each(spots)('keeps $id at least the turn clearance from every tilapia and snake waypoint', (spot) => {
    expect(turnDistance(spot, [...zone.tilapiaRoutes, ...snakes])).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('Area 5 risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot, route, net and the tilapia tuning identical to the default seed for seed %i', (seed) => {
    const layout = buildZone(CHINAMPA_2_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(chinampa2.zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(chinampa2.zone.predatorRoutes);
    expect(layout.tilapia).toEqual(chinampa2.zone.tilapia);
    expect(layout.spots).toEqual(chinampa2.zone.spots);
    expect(layout.hazards).toEqual(chinampa2.zone.hazards);
  });

  // Three chasing tilapia and five poles make this search slower (issue #118, ND-14); the timeout only gives headroom, the check is unchanged.
  it.each(EXTRA_SEEDS)(
    'lets the axolotl grab every pool spot without a hit for seed %i',
    (seed) => {
      const fair = fairnessZone(buildZone(CHINAMPA_2_LAYOUT, seed));
      for (const spot of poolSpots(fair.zone)) {
        expect(firstFairStart(spot, fair), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
      }
    },
    20_000,
  );
});
