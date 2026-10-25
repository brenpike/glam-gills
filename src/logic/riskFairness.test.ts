/**
 * Tests of the fairness harness itself (PRD open question 264, ND-17), on made-up zones: its safe
 * starts know the chase and moving hazards, and its visits play them. Each area's fairness file
 * checks that area.
 */
import { describe, expect, it } from 'vitest';
import { createEncounter } from './encounter';
import { shapeDistance } from './hazards';
import { routeDistance } from './hiding';
import { PUNTING_POLE, movingHazardPeriod, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { CARP_SPECIES, GARTER_SNAKE_SPECIES, HERON_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import {
  DT,
  fairnessZone,
  firstFairStart,
  isSafeStart,
  loopSeconds,
  nearestSafeStart,
  outOfPredatorReach,
  pathHits,
  ringPoints,
  tilapiaOf,
} from './riskFairness';
import { CARP, CARP_CHASE, GARTER_SNAKE, GARTER_SNAKE_CHASE, PUNTING_POLES, TILAPIA, TILAPIA_CHASE } from './tuning';
import { buildCanalZone, swimBounds, type HidingSpot, type Point, type TilapiaRoute, type ZoneLayout } from './zone';

const BASE = buildCanalZone();
const LOOP: TilapiaRoute = {
  id: 'tilapia-0',
  waypoints: [
    { x: 1000, y: 180 },
    { x: 1040, y: 180 },
    { x: 1040, y: 220 },
    { x: 1000, y: 220 },
  ],
};
const HERON_ROUTE: PredatorRoute = {
  id: 'heron-0',
  waypoints: [
    { x: 1400, y: 150 },
    { x: 1600, y: 150 },
  ],
  species: HERON_SPECIES,
};
const CARP_LOOP: PredatorRoute = {
  id: 'carp-0',
  waypoints: [
    { x: 400, y: 260 },
    { x: 440, y: 260 },
  ],
  species: CARP_SPECIES,
};
const CHASING_CARP_LOOP: PredatorRoute = { ...CARP_LOOP, species: tunedSpecies(CARP_SPECIES, { ...CARP, chase: CARP_CHASE }) };
const POLE_X = 1500;
const POLE = movingHazardSpawn('test/punting-pole', PUNTING_POLE, POLE_X, 0);

/** A made-up zone on the canal's water: one tilapia loop and no hazards, then `parts`. */
function madeUpZone(parts: Partial<ZoneLayout> = {}): ZoneLayout {
  return { ...BASE, tilapiaRoutes: [LOOP], predatorRoutes: [], hazards: [], ...parts };
}

/** A made-up open-water spot. */
function spotAt(id: string, x: number, y: number): HidingSpot {
  return { id, cover: 'reeds', rarity: 'common', container: false, x, y };
}

/** The safe start rule before the chase and moving hazards: in the water and out of every lungeRange. */
function lungeOnlySafeStart(point: Point, zone: ZoneLayout): boolean {
  const bounds = swimBounds(zone);
  const inBounds = point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  return inBounds && routeDistance(point, zone.tilapiaRoutes) > tilapiaOf(zone).lungeRange && outOfPredatorReach(point, zone);
}

/** Every point of the zone's water on a 10 px grid. */
function waterGrid(zone: ZoneLayout): Point[] {
  const bounds = swimBounds(zone);
  const points: Point[] = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += 10) {
    for (let y = bounds.minY; y <= bounds.maxY; y += 10) points.push({ x, y });
  }
  return points;
}

/** The axolotl waiting at `pos` for `seconds`. */
function waitAt(pos: Point, seconds: number): Point[] {
  return Array.from({ length: Math.ceil(seconds / DT) }, () => ({ x: pos.x, y: pos.y }));
}

/** Seconds to patrol a made-up route at its species' patrol speed; the tilapia's for LOOP. */
function routeSeconds(route: TilapiaRoute | PredatorRoute): number {
  const speed = 'species' in route ? route.species.tuning.patrolSpeed : TILAPIA.patrolSpeed;
  return loopSeconds(route, speed);
}

describe('fairness harness without a chase or a moving hazard', () => {
  const plain = madeUpZone({ predatorRoutes: [HERON_ROUTE, CARP_LOOP] });
  const spots = [spotAt('test/near-loop', 1160, 200), spotAt('test/near-heron', 1500, 160), spotAt('test/near-carp', 440, 250)];

  it('keeps a safe start out of each lungeRange only, as before the chase', () => {
    for (const point of waterGrid(plain)) {
      expect(isSafeStart(point, plain), `(${point.x}, ${point.y})`).toBe(lungeOnlySafeStart(point, plain));
    }
  });

  it('finds the nearest safe start just past the tilapia lungeRange', () => {
    const start = nearestSafeStart(spots[0], plain);
    expect(routeDistance(start, plain.tilapiaRoutes)).toBeGreaterThan(TILAPIA.lungeRange);
    expect(routeDistance(start, plain.tilapiaRoutes)).toBeLessThanOrEqual(TILAPIA.lungeRange + 1);
  });

  it('gives the same results with an empty moving hazard list and a tilapia tuning with no chase', () => {
    const same = madeUpZone({ predatorRoutes: [HERON_ROUTE, CARP_LOOP], movingHazards: [], tilapia: { ...TILAPIA } });
    const before = fairnessZone(plain);
    const after = fairnessZone(same);
    expect({ ...after, zone: null, ctx: null }).toEqual({ ...before, zone: null, ctx: null });
    expect(after.startWindow).toBe(Math.max(...[LOOP, HERON_ROUTE, CARP_LOOP].map(routeSeconds)));
    for (const spot of spots) {
      expect(nearestSafeStart(spot, same), spot.id).toEqual(nearestSafeStart(spot, plain));
      expect(firstFairStart(spot, after), spot.id).toBe(firstFairStart(spot, before));
      expect(firstFairStart(spot, before), spot.id).not.toBeNull();
    }
  });
});

describe('fairness harness with a chase', () => {
  const tilapiaReach = TILAPIA.lungeRange + TILAPIA_CHASE.leash;
  const carpReach = CARP.lungeRange + CARP_CHASE.leash;
  const chasing = madeUpZone({ tilapia: { ...TILAPIA, chase: TILAPIA_CHASE } });

  it('keeps a safe start farther than lungeRange plus leash from a chasing tilapia loop', () => {
    const inside = { x: 1040 + tilapiaReach, y: 200 };
    const outside = { x: 1040 + tilapiaReach + 1, y: 200 };
    expect(isSafeStart(inside, chasing)).toBe(false);
    expect(isSafeStart(inside, madeUpZone())).toBe(true);
    expect(isSafeStart(outside, chasing)).toBe(true);
    const start = nearestSafeStart({ x: 1040, y: 200 }, chasing);
    expect(routeDistance(start, chasing.tilapiaRoutes)).toBeGreaterThan(tilapiaReach);
    expect(routeDistance(start, chasing.tilapiaRoutes)).toBeLessThanOrEqual(tilapiaReach + 1);
  });

  it('keeps a safe start farther than lungeRange plus leash from a chasing predator loop, and only lungeRange from one that does not chase', () => {
    const chasingCarp = madeUpZone({ predatorRoutes: [CHASING_CARP_LOOP] });
    const stillCarp = madeUpZone({ predatorRoutes: [CARP_LOOP] });
    const inside = { x: 440 + carpReach, y: 260 };
    const outside = { x: 440 + carpReach + 1, y: 260 };
    expect(isSafeStart(inside, chasingCarp)).toBe(false);
    expect(isSafeStart(outside, chasingCarp)).toBe(true);
    expect(isSafeStart(inside, stillCarp)).toBe(true);
    expect(isSafeStart({ x: 440 + CARP.lungeRange, y: 260 }, stillCarp)).toBe(false);
    expect(isSafeStart({ x: 440 + CARP.lungeRange + 1, y: 260 }, stillCarp)).toBe(true);
    const start = nearestSafeStart({ x: 440, y: 250 }, chasingCarp);
    expect(routeLoopDistance(start, CARP_LOOP.waypoints)).toBeGreaterThan(carpReach);
  });

  it('plays the chase on a visit: a wait out of lungeRange but in sight is hit only when the tilapia chases', () => {
    const wait = { x: 1040 + TILAPIA.lungeRange + 60, y: 200 };
    const plain = fairnessZone(madeUpZone());
    const chase = fairnessZone(chasing);
    expect(pathHits(createEncounter(plain.zone), waitAt(wait, 20), plain.ctx)).toBe(false);
    expect(pathHits(createEncounter(chase.zone), waitAt(wait, 20), chase.ctx)).toBe(true);
  });

  it('finds a fair start for a spot by a chasing tilapia loop', () => {
    const spot = spotAt('test/by-chaser', 1040 + TILAPIA.lungeRange + 20, 200);
    expect(firstFairStart(spot, fairnessZone(chasing))).not.toBeNull();
  });
});

describe('fairness harness with a moving hazard', () => {
  const poled = madeUpZone({ movingHazards: [POLE] });
  const sweep = movingHazardSweep(POLE);
  const tipY = sweep.y1;

  it('keeps a safe start outside the sweep grown by the touch reach', () => {
    const reach = PUNTING_POLES.touchReach;
    const side = POLE_X + PUNTING_POLES.halfWidth + reach;
    expect(isSafeStart({ x: side, y: 200 }, poled)).toBe(false);
    expect(isSafeStart({ x: side + 1, y: 200 }, poled)).toBe(true);
    expect(isSafeStart({ x: POLE_X, y: tipY + reach }, poled)).toBe(false);
    expect(isSafeStart({ x: POLE_X, y: tipY + reach + 1 }, poled)).toBe(true);
    expect(isSafeStart({ x: POLE_X, y: 200 }, madeUpZone())).toBe(true);
    const start = nearestSafeStart({ x: POLE_X, y: 200 }, poled);
    expect(shapeDistance(start, sweep)).toBeGreaterThan(reach);
    expect(shapeDistance(start, sweep)).toBeLessThanOrEqual(reach + 1);
  });

  it('plays the pole on a visit: a wait in its sweep is hit only when the zone has the pole', () => {
    const plain = fairnessZone(madeUpZone());
    const pole = fairnessZone(poled);
    const wait = { x: POLE_X, y: 200 };
    const cycle = movingHazardPeriod(PUNTING_POLE);
    expect(pathHits(createEncounter(plain.zone), waitAt(wait, cycle), plain.ctx)).toBe(false);
    expect(pathHits(createEncounter(pole.zone), waitAt(wait, cycle), pole.ctx)).toBe(true);
  });

  it('tries start times over the pole cycle and finds a fair start for a spot in its sweep', () => {
    const fair = fairnessZone(poled);
    expect(fair.startWindow).toBe(Math.max(routeSeconds(LOOP), movingHazardPeriod(PUNTING_POLE)));
    expect(firstFairStart(spotAt('test/under-pole', POLE_X, 200), fair)).not.toBeNull();
  });
});

describe('fairness harness with the relaxed safe start (issue #130, ND-11)', () => {
  /** A made-up tilapia tuning that chases with this leash and sight. */
  function chasingTilapia(leash: number, sight: number): ZoneLayout {
    return madeUpZone({ tilapia: { ...TILAPIA, chase: { ...TILAPIA_CHASE, leash, sight } } });
  }

  /** A made-up route by LOOP's right end whose species plays the garter snake tuning with a 100 px leash. */
  function leashedRoute(species: Readonly<PredatorSpecies>): PredatorRoute {
    const tuning = { ...GARTER_SNAKE, chase: { ...GARTER_SNAKE_CHASE, leash: 100 } };
    return { id: 'leashed-0', waypoints: CARP_LOOP.waypoints, species: tunedSpecies(species, tuning) };
  }

  it('does not count sight: a start past lungeRange plus leash is safe however far the chaser sees', () => {
    const farSighted = chasingTilapia(60, 1000);
    const reach = TILAPIA.lungeRange + 60;
    expect(isSafeStart({ x: 1040 + reach, y: 200 }, farSighted)).toBe(false);
    expect(isSafeStart({ x: 1040 + reach + 1, y: 200 }, farSighted)).toBe(true);
  });

  it('counts the leash: a longer leash pushes the safe start farther from the loop', () => {
    for (const leash of [0, 50, 200]) {
      const zone = chasingTilapia(leash, TILAPIA_CHASE.sight);
      const reach = TILAPIA.lungeRange + leash;
      expect(isSafeStart({ x: 1040 + reach, y: 200 }, zone), `leash ${leash}`).toBe(false);
      expect(isSafeStart({ x: 1040 + reach + 1, y: 200 }, zone), `leash ${leash}`).toBe(true);
      const start = nearestSafeStart({ x: 1040, y: 200 }, zone);
      expect(routeDistance(start, zone.tilapiaRoutes), `leash ${leash}`).toBeGreaterThan(reach);
      expect(routeDistance(start, zone.tilapiaRoutes), `leash ${leash}`).toBeLessThanOrEqual(reach + 1);
    }
  });

  it('does not count the leash of a species with the warn-on-route rule', () => {
    const snake = madeUpZone({ predatorRoutes: [leashedRoute(GARTER_SNAKE_SPECIES)] });
    const free = madeUpZone({ predatorRoutes: [leashedRoute(CARP_SPECIES)] });
    const end = CARP_LOOP.waypoints[1];
    expect(isSafeStart({ x: end.x + GARTER_SNAKE.lungeRange, y: end.y }, snake)).toBe(false);
    expect(isSafeStart({ x: end.x + GARTER_SNAKE.lungeRange + 1, y: end.y }, snake)).toBe(true);
    expect(isSafeStart({ x: end.x + GARTER_SNAKE.lungeRange + 1, y: end.y }, free)).toBe(false);
    expect(isSafeStart({ x: end.x + GARTER_SNAKE.lungeRange + 100 + 1, y: end.y }, free)).toBe(true);
  });

  it('finds a far safe start past 600 px and still takes the nearest one', () => {
    const zone = chasingTilapia(560, TILAPIA_CHASE.sight);
    const reach = TILAPIA.lungeRange + 560;
    const spot = { x: 1040, y: 200 };
    const start = nearestSafeStart(spot, zone);
    expect(Math.hypot(start.x - spot.x, start.y - spot.y)).toBeGreaterThan(600);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(reach);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeLessThanOrEqual(reach + 1);
  });

  /**
   * A zone where a 300 px lungeRange (no chase) leaves one safe pocket, about 4 px across and 3 px
   * high, round (502, 208): x 500 to 504 between the strip routes, y 206.5 to 209.5 between the two
   * point routes. From (200, 200) it lies between two 1° rays, which cross x 502 at y 205.3 and
   * 210.5. With `farWater`, the water past x 1700 is safe too, about 1500 px from (200, 200).
   */
  function pocketZone(farWater: boolean): ZoneLayout {
    const strip = (id: string, x: number): TilapiaRoute => ({ id, waypoints: [{ x, y: 94 }, { x, y: 296 }] });
    const strips = [strip('strip-0', 200), strip('strip-1', 804), strip('strip-2', 1400), ...(farWater ? [] : [strip('strip-3', 1880)])];
    const caps: TilapiaRoute[] = [
      { id: 'cap-top', waypoints: [{ x: 502, y: 206.5 - 300 }] },
      { id: 'cap-bottom', waypoints: [{ x: 502, y: 209.5 + 300 }] },
    ];
    return madeUpZone({ tilapia: { ...TILAPIA, lungeRange: 300 }, tilapiaRoutes: [...strips, ...caps] });
  }

  it('keeps every ring point within 1 px of the next, however far out the ring is', () => {
    const centre = { x: 1040, y: 200 };
    for (const radius of [1, 57, 58, 600, 1000, 2000]) {
      const points = ringPoints(centre, radius);
      const widestGap = points.reduce((widest, point, index) => {
        const next = points[(index + 1) % points.length];
        return Math.max(widest, Math.hypot(next.x - point.x, next.y - point.y));
      }, 0);
      expect(points.length, `radius ${radius}`).toBeGreaterThanOrEqual(360);
      expect(widestGap, `radius ${radius}`).toBeLessThanOrEqual(1);
    }
  });

  it('finds a narrow safe pocket that lies between fixed 1° rays', () => {
    const zone = pocketZone(false);
    const spot = { x: 200, y: 200 };
    const start = nearestSafeStart(spot, zone);
    expect(isSafeStart(start, zone)).toBe(true);
    expect(start.x).toBeGreaterThan(500);
    expect(start.x).toBeLessThan(504);
    expect(start.y).toBeGreaterThan(206.5);
    expect(start.y).toBeLessThan(209.5);
    expect(Math.hypot(start.x - spot.x, start.y - spot.y)).toBeLessThanOrEqual(302);
  });

  it('takes the nearer narrow pocket over farther open water', () => {
    const zone = pocketZone(true);
    const spot = { x: 200, y: 200 };
    expect(isSafeStart({ x: 1750, y: 200 }, zone)).toBe(true);
    expect(nearestSafeStart(spot, zone)).toEqual(nearestSafeStart(spot, pocketZone(false)));
  });

  it('throws only when the whole area has no safe start', () => {
    const zone = chasingTilapia(5000, TILAPIA_CHASE.sight);
    expect(() => nearestSafeStart({ x: 1040, y: 200 }, zone)).toThrow('nearestSafeStart: no safe start in the area');
  });

  it('still keeps a safe start clear of every moving hazard', () => {
    const zone = madeUpZone({ tilapia: { ...TILAPIA, chase: TILAPIA_CHASE }, movingHazards: [POLE] });
    const sweep = movingHazardSweep(POLE);
    const side = POLE_X + PUNTING_POLES.halfWidth + PUNTING_POLES.touchReach;
    expect(routeDistance({ x: POLE_X, y: 200 }, zone.tilapiaRoutes)).toBeGreaterThan(TILAPIA.lungeRange + TILAPIA_CHASE.leash);
    expect(isSafeStart({ x: POLE_X, y: 200 }, zone)).toBe(false);
    expect(isSafeStart({ x: side, y: 200 }, zone)).toBe(false);
    expect(isSafeStart({ x: side + 1, y: 200 }, zone)).toBe(true);
    const start = nearestSafeStart({ x: POLE_X, y: 200 }, zone);
    expect(shapeDistance(start, sweep)).toBeGreaterThan(PUNTING_POLES.touchReach);
    expect(routeDistance(start, zone.tilapiaRoutes)).toBeGreaterThan(TILAPIA.lungeRange + TILAPIA_CHASE.leash);
  });
});
