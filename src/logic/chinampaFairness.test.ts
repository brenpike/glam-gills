/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264, ND-17) on Area 4, the chinampa
 * gardens, with the shared harness in riskFairness.ts.
 */
import { describe, expect, it } from 'vitest';
import { CHINAMPA_CARP, CHINAMPA_LAYOUT, CHINAMPA_TILAPIA } from './chinampaLayout';
import { createEncounter } from './encounter';
import { meetsThreatRiskRule, routeDistance, turnDistance, zoneThreats } from './hiding';
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
import { RISK } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds } from './zone';

const chinampa = fairnessZone(buildZone(CHINAMPA_LAYOUT, DEFAULT_ZONE_SEED));

/** Ms each whole-seed sweep may take: every pool spot under nine chasing threats and two poles (issue #119, ND-10). */
const SEED_SWEEP_TIMEOUT = 120_000;

describe('risk fairness on the default Area 4 zone', () => {
  const { zone, ctx, longestLoop, startWindow, lastStartIndex, parkSteps } = chinampa;
  const spots = poolSpots(zone);

  it('plays its own tilapia tuning: loops at its patrol speed, strikes at 145 px, waits out its own strike', () => {
    expect(zone.tilapia).toEqual(CHINAMPA_TILAPIA);
    expect(createEncounter(zone).tilapia).toEqual(CHINAMPA_TILAPIA);
    expect(longestLoop).toBe(Math.max(...zone.tilapiaRoutes.map((route) => loopSeconds(route, CHINAMPA_TILAPIA.patrolSpeed))));
    expect(startWindow).toBe(longestLoop);
    expect(lastStartIndex).toBe(Math.floor(startWindow / START_STEP));
    expect(parkSteps).toBe(Math.max(tailSteps(CHINAMPA_TILAPIA), tailSteps(CHINAMPA_CARP.tuning)));
    expect(zone.hazards.length).toBeGreaterThan(0);
    expect(zone.hazards.every((hazard) => !hazard.type.costsLeg)).toBe(true);
    expect(ctx.bounds).toEqual(swimBounds(zone));
  });

  it('catches a hit when the axolotl waits at each Legendary pot', () => {
    const pots = spots.filter((spot) => spot.rarity === 'legendary');
    expect(pots.length).toBeGreaterThan(0);
    for (const pot of pots) {
      const waiting = Array.from({ length: Math.ceil(longestLoop / DT) }, () => ({ x: pot.x, y: pot.y }));
      expect(pathHits(createEncounter(zone), waiting, ctx), pot.id).toBe(true);
    }
  });

  it.each(spots)('bands $id by the Area 4 strike reach, S = 145', (spot) => {
    const threats = zoneThreats({ tilapiaRoutes: zone.tilapiaRoutes, tilapia: zone.tilapia });
    expect(threats.every((threat) => threat.strike === CHINAMPA_TILAPIA.lungeRange)).toBe(true);
    expect(meetsThreatRiskRule(spot, spot.rarity, threats)).toBe(true);
  });

  it.each(spots)('finds a safe start outside the Area 4 lunge range for $id', (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(CHINAMPA_TILAPIA.lungeRange);
  });

  it.each(spots)('lets the axolotl grab $id without a hit for some start time', (spot) => {
    expect(firstFairStart(spot, chinampa), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  });

  it.each(spots)('keeps $id at least the turn clearance from every waypoint', (spot) => {
    expect(turnDistance(spot, zone.tilapiaRoutes)).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('Area 4 risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot, route, net and the tilapia tuning identical to the default seed for seed %i', (seed) => {
    const layout = buildZone(CHINAMPA_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(chinampa.zone.tilapiaRoutes);
    expect(layout.tilapia).toEqual(chinampa.zone.tilapia);
    expect(layout.spots).toEqual(chinampa.zone.spots);
    expect(layout.hazards).toEqual(chinampa.zone.hazards);
  });

  it.each(EXTRA_SEEDS)('lets the axolotl grab every pool spot without a hit for seed %i', (seed) => {
    const fair = fairnessZone(buildZone(CHINAMPA_LAYOUT, seed));
    for (const spot of poolSpots(fair.zone)) {
      expect(firstFairStart(spot, fair), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
    }
  }, SEED_SWEEP_TIMEOUT);
});
