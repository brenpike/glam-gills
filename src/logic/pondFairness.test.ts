/**
 * Risk ladder fairness (B10, issue #70; PRD open question 264, ND-17) on Area 2, the pond, with the
 * shared harness in riskFairness.ts.
 */
import { describe, expect, it } from 'vitest';
import { createEncounter } from './encounter';
import { routeDistance, turnDistance } from './hiding';
import { POND_LAYOUT, POND_TILAPIA } from './pondLayout';
import { DT, EXTRA_SEEDS, fairnessZone, firstFairStart, nearestSafeStart, pathHits, poolSpots } from './riskFairness';
import { RISK } from './tuning';
import { DEFAULT_ZONE_SEED, buildZone, swimBounds } from './zone';

const pond = fairnessZone(buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED));
/** A safe start's clearance from every tilapia loop: leash plus max(sight, lungeRange) (ND-17). */
const CHASE_REACH = 260;

describe('risk fairness on the default pond zone', () => {
  const { zone, ctx, longestLoop, lastStartIndex } = pond;
  const spots = poolSpots(zone);

  it('has pool spots, start times and hazards that never hit', () => {
    expect(spots.length).toBeGreaterThan(0);
    expect(lastStartIndex).toBeGreaterThan(0);
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

  it('reaches 260 pixels with the chase: the 60 pixel leash plus the 200 pixel sight (ND-17)', () => {
    expect(POND_TILAPIA.chase).toBeDefined();
    const chase = POND_TILAPIA.chase ?? { leash: 0, sight: 0 };
    expect(chase.leash + Math.max(chase.sight, POND_TILAPIA.lungeRange)).toBe(CHASE_REACH);
  });

  it.each(spots)('finds a safe start outside chase reach for $id', (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(CHASE_REACH);
  });

  it.each(spots)('lets the axolotl grab $id without a hit for some start time', (spot) => {
    expect(firstFairStart(spot, pond), `${spot.id} (${spot.rarity}) is hit at every start time`).not.toBeNull();
  });

  it.each(spots)('keeps $id at least the turn clearance from every waypoint', (spot) => {
    expect(turnDistance(spot, zone.tilapiaRoutes)).toBeGreaterThanOrEqual(RISK.turnClearance);
  });
});

describe('pond risk fairness on other seeds', () => {
  it.each(EXTRA_SEEDS)('keeps every spot and route identical to the default seed for seed %i', (seed) => {
    const layout = buildZone(POND_LAYOUT, seed);
    expect(layout.tilapiaRoutes).toEqual(pond.zone.tilapiaRoutes);
    expect(layout.spots).toEqual(pond.zone.spots);
    expect(layout.hazards).toEqual(pond.zone.hazards);
  });
});
