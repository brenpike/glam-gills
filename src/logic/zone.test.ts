import { describe, expect, it } from 'vitest';
import { CANAL_TREASURES, RARITIES, treasureById, type Rarity } from './catalogue';
import { CHINAMPA_2_LAYOUT } from './chinampa2Layout';
import { CHINAMPA_LAYOUT } from './chinampaLayout';
import { depthBands } from './dangerBar';
import { netDrift } from './ghostNets';
import { glowPlantSpawn, type DarkWater } from './glowPlants';
import {
  elementSweep,
  hazardSweep,
  shapeDistance,
  type ElementSpawn,
  type ElementType,
  type HazardSpawn,
  type HazardType,
} from './hazards';
import { coversAt, inReeds, isDeep, routeDistance, spotMatchesLabels, turnDistance } from './hiding';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, movingHazardSweep } from './movingHazards';
import { POND_2_LAYOUT } from './pond2Layout';
import { POND_LAYOUT } from './pondLayout';
import { inSafeArea } from './tilapia';
import { createTrip } from './trip';
import { FINDS, LEGS, RISK, TILAPIA } from './tuning';
import {
  BED_TOP,
  CANAL_AREA_ID,
  CANAL_LAYOUT,
  DEFAULT_ZONE_SEED,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  STRANDING_PLACES,
  SURF,
  WORLD_H,
  ZONE_SCREENS,
  ZONE_W,
  areaRowKind,
  areaSize,
  buildCanalZone,
  buildZone,
  inHomeSpot,
  isInsideCurrent,
  swimBounds,
  waveY,
  type AreaLayoutData,
  type BankOverhang,
  type FixedPadData,
  type FixedSpotData,
  type HidingSpot,
  type Point,
  type SafeArea,
  type StrandingPlace,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [0xa70107, ...EXTRA_SEEDS];
const FIXED_SPOTS: readonly HidingSpot[] = [
  { id: 'canal/spot-cave-1', cover: 'cave', rarity: 'legendary', container: true, x: 1492, y: 206 },
  { id: 'canal/spot-cave-2', cover: 'cave', rarity: 'legendary', container: true, x: 1552, y: 206 },
  { id: 'canal/spot-cave-3', cover: 'cave', rarity: 'legendary', container: true, x: 1612, y: 206 },
  { id: 'canal/spot-cave-4', cover: 'cave', rarity: 'epic', container: false, x: 1492, y: 266 },
  { id: 'canal/spot-cave-5', cover: 'cave', rarity: 'epic', container: false, x: 1552, y: 266 },
  { id: 'canal/spot-cave-6', cover: 'cave', rarity: 'epic', container: false, x: 1612, y: 266 },
  { id: 'canal/spot-current-1', cover: 'pastCurrent', rarity: 'legendary', container: true, x: 1200, y: 140 },
  { id: 'canal/spot-current-2', cover: 'pastCurrent', rarity: 'legendary', container: true, x: 1200, y: 200 },
  { id: 'canal/spot-current-3', cover: 'pastCurrent', rarity: 'legendary', container: true, x: 1200, y: 260 },
  { id: 'canal/spot-current-4', cover: 'pastCurrent', rarity: 'epic', container: false, x: 1260, y: 140 },
  { id: 'canal/spot-current-5', cover: 'pastCurrent', rarity: 'epic', container: false, x: 1260, y: 200 },
  { id: 'canal/spot-current-6', cover: 'pastCurrent', rarity: 'epic', container: false, x: 1260, y: 260 },
];
/** Every reed spot, in build order: bed index, column x, depth y, rarity and id tag. */
const REED_SPOTS: readonly (readonly [number, number, number, 'common' | 'rare', string])[] = [
  [0, 316, 172, 'common', 'a'],
  [0, 372, 172, 'common', 'a'],
  [0, 428, 172, 'common', 'a'],
  [0, 484, 172, 'common', 'a'],
  [0, 316, 228, 'common', 'b'],
  [0, 372, 228, 'common', 'b'],
  [0, 428, 228, 'common', 'b'],
  [0, 484, 228, 'common', 'b'],
  [1, 580, 110, 'rare', 'top'],
  [1, 640, 110, 'rare', 'top'],
  [2, 1316, 288, 'rare', 'deep'],
  [2, 1376, 288, 'rare', 'deep'],
  [2, 1436, 288, 'rare', 'deep'],
  [3, 1700, 288, 'rare', 'deep'],
];
const STRANDING_SNAPSHOT: readonly StrandingPlace[] = [
  { id: 'canal/strand-1', x: 320, y: 110 },
  { id: 'canal/strand-2', x: 880, y: 292 },
  { id: 'canal/strand-3', x: 1340, y: 220 },
  { id: 'canal/strand-4', x: 1860, y: 260 },
];
const STRANDING_ROUTE_CLEARANCE = 80;

function expectZoneInvariants(zone: ZoneLayout): void {
  const bounds = swimBounds();
  expect(zone.reedPatches).toHaveLength(4);
  expect(zone.reeds.length).toBeGreaterThanOrEqual(20);
  expect(zone.reeds.length).toBeLessThanOrEqual(24);
  for (const patch of zone.reedPatches) {
    expect(patch.dragMul).toBe(2.5);
    const members = zone.reeds.filter((reed) => reed.bx >= patch.x0 && reed.bx <= patch.x1);
    expect(members.length).toBeGreaterThanOrEqual(5);
    expect(members.length).toBeLessThanOrEqual(6);
    expect(zone.start.x < patch.x0 || zone.start.x > patch.x1).toBe(true);
  }

  const snacks = zone.collectibles;
  expect(snacks).toHaveLength(16);
  expect(snacks.filter((snack) => snack.kind === 'worm')).toHaveLength(10);
  expect(snacks.filter((snack) => snack.kind === 'bug')).toHaveLength(6);
  expect(new Set(snacks.map((snack) => snack.id)).size).toBe(16);
  for (const snack of snacks) {
    expect(snack.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(snack.x).toBeLessThanOrEqual(bounds.maxX);
    expect(snack.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(snack.y).toBeLessThanOrEqual(bounds.maxY);
    expect(Math.hypot(snack.x - zone.start.x, snack.y - zone.start.y)).toBeGreaterThanOrEqual(90);
  }
  for (let i = 0; i < snacks.length; i++) {
    for (let j = i + 1; j < snacks.length; j++) {
      expect(Math.hypot(snacks[i].x - snacks[j].x, snacks[i].y - snacks[j].y)).toBeGreaterThanOrEqual(40);
    }
  }
  const inCurrent = snacks.filter((snack) => isInsideCurrent(snack, zone.currents[0]));
  expect(inCurrent.length).toBeGreaterThanOrEqual(CANAL_LAYOUT.snacksInCurrent);

  expect(zone.pads).toHaveLength(6);
  expect(zone.pads.some((pad) => pad.flower)).toBe(true);
  for (const pad of zone.pads) {
    expect(pad.x).toBeGreaterThanOrEqual(0);
    expect(pad.x).toBeLessThanOrEqual(ZONE_W);
  }
}

const TILAPIA_ROUTES: readonly TilapiaRoute[] = [
  {
    id: 'tilapia-0',
    waypoints: [
      { x: 700, y: 262 },
      { x: 790, y: 262 },
      { x: 790, y: 296 },
      { x: 700, y: 296 },
    ],
  },
  {
    id: 'tilapia-1',
    waypoints: [
      { x: 1080, y: 100 },
      { x: 1145, y: 100 },
      { x: 1145, y: 296 },
      { x: 1080, y: 296 },
    ],
  },
  {
    id: 'tilapia-2',
    waypoints: [
      { x: 1432, y: 110 },
      { x: 1588, y: 110 },
      { x: 1588, y: 144 },
      { x: 1432, y: 144 },
    ],
  },
];

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(point.x - (a.x + clamped * abx), point.y - (a.y + clamped * aby));
}

function crossProduct(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const abSplit = Math.sign(crossProduct(a, b, c)) * Math.sign(crossProduct(a, b, d)) < 0;
  const cdSplit = Math.sign(crossProduct(c, d, a)) * Math.sign(crossProduct(c, d, b)) < 0;
  return abSplit && cdSplit;
}

function distanceBetweenSegments(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
}

function loopSegments(waypoints: readonly Point[]): [Point, Point][] {
  return waypoints.map((point, i): [Point, Point] => [point, waypoints[(i + 1) % waypoints.length]]);
}

/** Minimum distance between two closed polylines (each route loop wraps to its first waypoint). */
function routeGap(first: TilapiaRoute, second: TilapiaRoute): number {
  let gap = Infinity;
  for (const [a, b] of loopSegments(first.waypoints)) {
    for (const [c, d] of loopSegments(second.waypoints)) {
      gap = Math.min(gap, distanceBetweenSegments(a, b, c, d));
    }
  }
  return gap;
}

function distanceToArea(pos: Point, area: SafeArea): number {
  const dx = Math.max(area.x0 - pos.x, 0, pos.x - area.x1);
  const dy = Math.max(area.y0 - pos.y, 0, pos.y - area.y1);
  return Math.hypot(dx, dy);
}

describe('zone constants', () => {
  it('matches the planned world geometry', () => {
    expect(ZONE_W).toBe(1920);
    expect(WORLD_H).toBe(360);
    expect(swimBounds()).toEqual({ minX: 40, maxX: 1880, minY: SURF + 14, maxY: BED_TOP - 22 });
  });
});

describe('waveY', () => {
  it('stays within SURF +/- 2.4', () => {
    for (let x = -50; x <= ZONE_W + 50; x += 7) {
      for (let t = 0; t <= 20; t += 0.37) {
        const y = waveY(x, t);
        expect(y).toBeGreaterThanOrEqual(SURF - 2.4);
        expect(y).toBeLessThanOrEqual(SURF + 2.4);
      }
    }
  });

  it('matches the prototype formula at a sample point', () => {
    expect(waveY(100, 2)).toBeCloseTo(SURF + 1.6 * Math.sin(4.5 + 3.2) + 0.8 * Math.sin(11 - 2.2), 12);
  });
});

describe('buildCanalZone', () => {
  it('is deterministic for the default seed', () => {
    expect(buildCanalZone()).toEqual(buildCanalZone());
    expect(buildCanalZone()).toEqual(buildCanalZone(0xa70107));
  });

  it('differs between seeds', () => {
    expect(buildCanalZone(1).collectibles).not.toEqual(buildCanalZone(2).collectibles);
  });

  it('has the fixed layout fields', () => {
    const zone = buildCanalZone();
    expect(zone.width).toBe(ZONE_W);
    expect(zone.height).toBe(WORLD_H);
    expect(zone.chunks).toBe(ZONE_SCREENS);
    expect(zone.start).toEqual({ x: 120, y: 200 });
    expect(zone.bankChunks).toEqual([1, 3]);
    expect(zone.sunChunk).toBe(0);
    expect(zone.currents).toEqual([
      { id: 'current-0', x0: 760, x1: 1160, y0: 120, y1: 280, force: { x: -70, y: 0 } },
    ]);
  });

  it('keeps reed parameters in the prototype ranges', () => {
    for (const reed of buildCanalZone().reeds) {
      expect(reed.by).toBeGreaterThanOrEqual(326);
      expect(reed.by).toBeLessThan(334);
      expect(reed.tipY).toBeGreaterThanOrEqual(34);
      expect(reed.tipY).toBeLessThan(72);
      expect(Math.abs(reed.lean)).toBeLessThanOrEqual(8);
      expect(Math.abs(reed.bend)).toBeLessThanOrEqual(5);
      expect(reed.amp).toBeGreaterThanOrEqual(4);
      expect(reed.amp).toBeLessThan(7.5);
      expect(reed.leafU).toBeGreaterThanOrEqual(0.25);
      expect(reed.leafU).toBeLessThan(0.65);
      expect([-1, 1]).toContain(reed.leafDir);
    }
  });

  it('satisfies layout invariants for the default seed', () => {
    expectZoneInvariants(buildCanalZone());
  });

  it.each(EXTRA_SEEDS)('satisfies layout invariants for seed %i', (seed) => {
    expectZoneInvariants(buildCanalZone(seed));
  });

  it.each([0xa70107, ...EXTRA_SEEDS])('places the safe area around the start for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const area = zone.safeArea;
    expect(zone.start.x).toBeGreaterThanOrEqual(area.x0);
    expect(zone.start.x).toBeLessThanOrEqual(area.x1);
    expect(zone.start.y).toBeGreaterThanOrEqual(area.y0);
    expect(zone.start.y).toBeLessThanOrEqual(area.y1);
  });

  it.each([0xa70107, ...EXTRA_SEEDS])('keeps tilapia routes in the water and out of the safe area for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const bounds = swimBounds();
    expect(zone.tilapiaRoutes.length).toBeGreaterThanOrEqual(1);
    for (const route of zone.tilapiaRoutes) {
      expect(route.waypoints.length).toBeGreaterThanOrEqual(2);
      for (const point of route.waypoints) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(point.x).toBeLessThanOrEqual(bounds.maxX);
        expect(point.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(point.y).toBeLessThanOrEqual(bounds.maxY);
        expect(distanceToArea(point, zone.safeArea)).toBeGreaterThanOrEqual(TILAPIA.bodyRadius);
        expect(inHomeSpot(point, zone.homeSpot)).toBe(false);
      }
    }
  });

  it('pins three tilapia routes, tilapia-0 to tilapia-2', () => {
    const routes = buildCanalZone().tilapiaRoutes;
    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1', 'tilapia-2']);
    expect(routes).toEqual(TILAPIA_ROUTES);
  });

  it('keeps every pair of tilapia routes at least twice the lunge range apart', () => {
    const routes = buildCanalZone().tilapiaRoutes;
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        expect(routeGap(routes[i], routes[j])).toBeGreaterThanOrEqual(2 * TILAPIA.lungeRange);
      }
    }
  });

  it('measures route gaps between closed loops, including the wrap segment', () => {
    const square: TilapiaRoute = { id: 'a', waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
    const left: TilapiaRoute = { id: 'b', waypoints: [{ x: -30, y: 5 }, { x: -20, y: 5 }] };
    const crossing: TilapiaRoute = { id: 'c', waypoints: [{ x: 5, y: -5 }, { x: 5, y: 15 }] };
    expect(routeGap(square, left)).toBeCloseTo(20, 9);
    expect(routeGap(square, crossing)).toBe(0);
    const [first, second, third] = buildCanalZone().tilapiaRoutes;
    expect(routeGap(first, second)).toBeCloseTo(290.0, 1);
    expect(routeGap(second, third)).toBeCloseTo(287.0, 1);
  });

  it('builds the safe area and routes without changing seeded content', () => {
    const zone = buildCanalZone();
    expect(zone.safeArea).toEqual({ x0: 40, x1: 300, y0: SURF, y1: BED_TOP });
    expect(buildCanalZone(7).safeArea).toEqual(zone.safeArea);
    expect(buildCanalZone(7).tilapiaRoutes).toEqual(zone.tilapiaRoutes);
  });
});

describe('seeded content golden pin (v0.4.0)', () => {
  it('keeps pads and snacks identical and pins the reeds for the default seed', () => {
    const zone = buildCanalZone();
    expect(zone.reeds).toHaveLength(22);
    expect(zone.reeds[0].bx).toBe(316);
    expect(zone.reeds[zone.reeds.length - 1].bx).toBeCloseTo(1715.3372168540955, 9);

    const padXs = [152.54123428836465, 562.476081745699, 777.9833907261491, 1064.4019156508148, 1536.3621501810849, 1760.0520987901837];
    expect(zone.pads).toHaveLength(padXs.length);
    padXs.forEach((x, i) => expect(zone.pads[i].x).toBeCloseTo(x, 9));

    const firstSnack = zone.collectibles[0];
    expect(firstSnack.id).toBe('snack-0');
    expect(firstSnack.kind).toBe('worm');
    expect(firstSnack.x).toBeCloseTo(72.8267567123597, 9);
    expect(firstSnack.y).toBeCloseTo(110.19012401765212, 9);
    const lastSnack = zone.collectibles[15];
    expect(lastSnack.id).toBe('snack-15');
    expect(lastSnack.kind).toBe('bug');
    expect(lastSnack.x).toBeCloseTo(1821.906239259988, 9);
    expect(lastSnack.y).toBeCloseTo(213.23013308318332, 9);

    const patchXs = [
      [302.3313205689192, 494.1486609131098],
      [564.2870107628405, 667.0625178907067],
      [1306, 1446],
      [1669.1009571608156, 1725.3372168540955],
    ];
    expect(zone.reedPatches).toHaveLength(patchXs.length);
    patchXs.forEach(([x0, x1], i) => {
      expect(zone.reedPatches[i].x0).toBeCloseTo(x0, 9);
      expect(zone.reedPatches[i].x1).toBeCloseTo(x1, 9);
    });
  });
});

describe('Home Spot', () => {
  it('rings the start with radius 72 in the canal area', () => {
    const zone = buildCanalZone();
    expect(CANAL_AREA_ID).toBe('canal');
    expect(zone.areaId).toBe('canal');
    expect({ x: zone.homeSpot.x, y: zone.homeSpot.y }).toEqual(zone.start);
    expect(zone.homeSpot.radius).toBe(72);
  });

  it.each(ALL_SEEDS)('keeps the ring inside the safe area and clear of snacks for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const spot = zone.homeSpot;
    const area = zone.safeArea;
    expect(spot.x - spot.radius).toBeGreaterThanOrEqual(area.x0);
    expect(spot.x + spot.radius).toBeLessThanOrEqual(area.x1);
    expect(spot.y - spot.radius).toBeGreaterThanOrEqual(area.y0);
    expect(spot.y + spot.radius).toBeLessThanOrEqual(area.y1);
    for (const snack of zone.collectibles) {
      expect(inHomeSpot(snack, spot)).toBe(false);
    }
  });

  it('counts the edge as inside and just beyond as outside', () => {
    const spot = buildCanalZone().homeSpot;
    expect(inHomeSpot({ x: spot.x, y: spot.y }, spot)).toBe(true);
    expect(inHomeSpot({ x: spot.x + spot.radius, y: spot.y }, spot)).toBe(true);
    expect(inHomeSpot({ x: spot.x, y: spot.y - spot.radius }, spot)).toBe(true);
    expect(inHomeSpot({ x: spot.x + spot.radius + 0.001, y: spot.y }, spot)).toBe(false);
    expect(inHomeSpot({ x: spot.x, y: spot.y - spot.radius - 0.001 }, spot)).toBe(false);
  });
});
describe('finds', () => {
  it('has one find per canal treasure, in catalogue order, with unique area-scoped ids', () => {
    const zone = buildCanalZone();
    const ids = zone.finds.map((find) => find.id);
    expect(ids).toEqual(CANAL_TREASURES.map((treasure) => treasure.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith(`${zone.areaId}/`)).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('gives every find a non-empty pool of spots of its own rarity for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const spotById = new Map(zone.spots.map((spot) => [spot.id, spot]));
    for (const find of zone.finds) {
      const rarity = treasureById(find.id)?.rarity;
      expect(rarity).toBeDefined();
      expect(find.pool.length).toBeGreaterThan(0);
      for (const spotId of find.pool) {
        expect(spotById.get(spotId)?.rarity).toBe(rarity);
      }
    }
  });

  it.each(ALL_SEEDS)('fits every trip in its pools over trip seeds 1..25, with and without lost treasures, for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const poolSpots = (rarity: Rarity): number =>
      new Set(zone.finds.filter((find) => treasureById(find.id)?.rarity === rarity).flatMap((find) => find.pool)).size;
    let lost: string[] = [];
    for (let tripSeed = 1; tripSeed <= 25; tripSeed++) {
      for (const returnedFinds of [[], lost]) {
        const placed = createTrip(zone, LEGS, [], tripSeed, { returnedFinds }).placed;
        for (const rarity of RARITIES) {
          const ofRarity = placed.filter((find) => treasureById(find.id)?.rarity === rarity).length;
          expect(ofRarity, `${rarity} on trip seed ${tripSeed}`).toBeLessThanOrEqual(poolSpots(rarity));
        }
      }
      lost = createTrip(zone, LEGS, [], tripSeed).placed.map((find) => find.id);
    }
  });
});

describe('hiding spots', () => {
  it.each(ALL_SEEDS)('uses unique canal spot ids that match their labels for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const ids = zone.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of zone.spots) {
      expect(spot.id.startsWith('canal/spot-')).toBe(true);
      expect(spotMatchesLabels(spot, zone)).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('puts every spot in its rarity band of distance to the tilapia, with its cover and B6 rules, for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const spot of zone.spots) {
      const distance = routeDistance(spot, zone.tilapiaRoutes);
      const band = RISK.band[spot.rarity];
      const where = `${spot.id} (${spot.rarity}) is ${distance.toFixed(1)} px from a route`;
      expect(distance, where).toBeGreaterThan(band.over);
      expect(distance, where).toBeLessThanOrEqual(band.upTo);
      expect(spotMatchesLabels(spot, zone), where).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('keeps every spot at least the turn clearance from every waypoint for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const spot of zone.spots) {
      const distance = turnDistance(spot, zone.tilapiaRoutes);
      expect(distance, `${spot.id} is ${distance.toFixed(1)} px from a waypoint`).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it.each(ALL_SEEDS)('keeps at least 6 spots in every rarity pool for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const counts = Object.fromEntries(RARITIES.map((rarity) => [rarity, zone.spots.filter((spot) => spot.rarity === rarity).length]));
    expect(counts).toEqual({ common: 8, rare: 7, epic: 6, legendary: 6 });
    for (const find of zone.finds) {
      expect(find.pool.length, find.id).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(ALL_SEEDS)('places spots in the water, outside the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const bounds = swimBounds();
    const home = zone.homeSpot;
    for (const spot of zone.spots) {
      expect(spot.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(spot.x).toBeLessThanOrEqual(bounds.maxX);
      expect(spot.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(spot.y).toBeLessThanOrEqual(bounds.maxY);
      expect(inSafeArea(spot, zone.safeArea)).toBe(false);
      expect(Math.hypot(spot.x - home.x, spot.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
    }
    for (let i = 0; i < zone.spots.length; i++) {
      for (let j = i + 1; j < zone.spots.length; j++) {
        const [a, b] = [zone.spots[i], zone.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
    const containers = zone.spots.filter((spot) => spot.container);
    for (let i = 0; i < containers.length; i++) {
      for (let j = i + 1; j < containers.length; j++) {
        const [a, b] = [containers[i], containers[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * FINDS.containerRadius);
      }
    }
  });

  it.each(ALL_SEEDS)('uses all five hiding kinds and keeps Common and Rare shallow for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const cover of ['reeds', 'pad', 'cave', 'pastCurrent'] as const) {
      expect(zone.spots.some((spot) => coversAt(spot, zone).includes(cover))).toBe(true);
    }
    expect(zone.spots.some((spot) => spot.container)).toBe(true);
    for (const spot of zone.spots.filter((other) => other.rarity === 'common' || other.rarity === 'rare')) {
      expect(isDeep(spot, zone)).toBe(false);
    }
  });

  it.each(ALL_SEEDS)('keeps every derived spot inside a reed patch or under a pad for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const spot of zone.spots) {
      expect(coversAt(spot, zone)).toContain(spot.cover);
    }
    expect(zone.spots.filter((spot) => spot.cover === 'reeds')).toHaveLength(14);
    expect(zone.spots.filter((spot) => spot.cover === 'pad')).toHaveLength(1);
  });

  it.each(EXTRA_SEEDS)('keeps finds, fixed spots, cave, path and Home Spot identical for seed %i', (seed) => {
    const base = buildCanalZone();
    const zone = buildCanalZone(seed);
    const fixed = (layout: ZoneLayout): HidingSpot[] =>
      layout.spots.filter((spot) => spot.cover === 'cave' || spot.cover === 'pastCurrent');
    expect(zone.finds.map((find) => find.id)).toEqual(base.finds.map((find) => find.id));
    expect(fixed(zone)).toEqual(fixed(base));
    expect(zone.cave).toEqual(base.cave);
    expect(zone.mainPath).toEqual(base.mainPath);
    expect(zone.homeSpot).toEqual(base.homeSpot);
    expect(zone.areaId).toBe(base.areaId);
  });

  it.each(ALL_SEEDS)('keeps reed spots on fixed columns inside their bed patch, and one spot under pad 2, for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    const spotById = new Map(zone.spots.map((spot) => [spot.id, spot]));
    for (const [bed, x, y, rarity, tag] of REED_SPOTS) {
      const spot = spotById.get(`canal/spot-reeds-${bed}-${x}-${tag}`);
      expect(spot).toEqual({ id: `canal/spot-reeds-${bed}-${x}-${tag}`, cover: 'reeds', rarity, container: false, x, y });
      expect(inReeds({ x, y }, [zone.reedPatches[bed]])).toBe(true);
    }
    const reedIds = zone.spots.filter((spot) => spot.cover === 'reeds').map((spot) => spot.id);
    expect(reedIds).toEqual(REED_SPOTS.map(([bed, x, , , tag]) => `canal/spot-reeds-${bed}-${x}-${tag}`));
    expect(zone.spots.filter((spot) => spot.cover === 'pad')).toEqual([
      { id: 'canal/spot-pad-2', cover: 'pad', rarity: 'rare', container: false, x: zone.pads[2].x, y: 100 },
    ]);
    expect(zone.pads[2].x).toBeGreaterThanOrEqual(700);
    expect(zone.pads[2].x).toBeLessThan(900);
  });

  it.each(EXTRA_SEEDS)('keeps every reed spot identical to the default seed for seed %i', (seed) => {
    const reedSpots = (layout: ZoneLayout): HidingSpot[] => layout.spots.filter((spot) => spot.cover === 'reeds');
    expect(reedSpots(buildCanalZone(seed))).toEqual(reedSpots(buildCanalZone()));
  });

  it('pins the fixed cave and past-current spots, the cave and the main path', () => {
    const zone = buildCanalZone();
    expect(zone.cave).toEqual({ id: 'canal/cave', x0: 1480, x1: 1640, y0: 200, y1: 318 });
    expect(zone.mainPath).toEqual([
      { x: 120, y: 200 },
      { x: 1840, y: 200 },
    ]);
    expect(SPOT_MIN_SPACING).toBe(56);
    expect(zone.spots.slice(0, 12)).toEqual(FIXED_SPOTS);
  });
});

describe('stranding places', () => {
  it.each(ALL_SEEDS)('uses unique canal/strand- ids that equal the fixed snapshot for seed %i', (seed) => {
    const places = buildCanalZone(seed).strandingPlaces;
    const ids = places.map((place) => place.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith('canal/strand-')).toBe(true);
    }
    expect(places).toEqual(STRANDING_SNAPSHOT);
  });

  it('is fixed area data: seed 7 equals the default seed and the constant', () => {
    expect(buildCanalZone(7).strandingPlaces).toEqual(buildCanalZone().strandingPlaces);
    expect(STRANDING_PLACES).toEqual(STRANDING_SNAPSHOT);
    expect(Object.isFrozen(STRANDING_PLACES)).toBe(true);
  });

  it('returns a copy, so editing a layout never changes the constant', () => {
    const zone = buildCanalZone();
    zone.strandingPlaces[0].x = 0;
    expect(buildCanalZone().strandingPlaces).toEqual(STRANDING_SNAPSHOT);
  });

  // Reachability with 1 to 4 legs (A9) is covered by the legs.test current tests: every place is
  // outside every current zone, and those tests show any leg count beats every canal current.
  it('keeps every place in the water, out of the safe area, clear of the ring, currents and cave', () => {
    const zone = buildCanalZone();
    const bounds = swimBounds();
    const home = zone.homeSpot;
    for (const place of zone.strandingPlaces) {
      expect(place.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(place.x).toBeLessThanOrEqual(bounds.maxX);
      expect(place.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(place.y).toBeLessThanOrEqual(bounds.maxY);
      expect(inSafeArea(place, zone.safeArea)).toBe(false);
      expect(Math.hypot(place.x - home.x, place.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
      for (const current of zone.currents) {
        expect(isInsideCurrent(place, current)).toBe(false);
      }
      expect(distanceToArea(place, zone.cave)).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SEEDS)('keeps every place at least SPOT_MIN_SPACING from every hiding spot for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const place of zone.strandingPlaces) {
      for (const spot of zone.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y)).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });

  it.each(ALL_SEEDS)('keeps every place at least 80 px from every tilapia route segment for seed %i', (seed) => {
    const zone = buildCanalZone(seed);
    for (const place of zone.strandingPlaces) {
      for (const route of zone.tilapiaRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          const distance = distanceToSegment(place, a, b);
          expect(distance, `${place.id} is ${distance.toFixed(1)} px from ${route.id}`).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
        }
      }
    }
  });
});

const TEST_LITTER: HazardType = {
  id: 'test-litter',
  name: 'Test litter',
  costsLeg: false,
  reach: 12,
  meetRange: 60,
  fact: { id: 'test-litter', name: 'test-litter', title: 'Meet the test-litter', body: 'A test-litter for tests.' },
};
const LITTER: readonly HazardSpawn[] = [
  { id: 'litter-0', type: TEST_LITTER, shape: { kind: 'circle', x: 600, y: 200, r: 14 } },
  { id: 'litter-1', type: TEST_LITTER, shape: { kind: 'circle', x: 960, y: 160, r: 14 } },
  { id: 'litter-2', type: TEST_LITTER, shape: { kind: 'rect', x0: 1400, x1: 1440, y0: 270, y1: 290 } },
];
const FIXED_PADS: readonly FixedPadData[] = [
  { x: 1000, rx: 24, flower: true, spot: { y: 100, rarity: 'common', tag: 'a' } },
  { x: 1340, rx: 22, flower: false },
  { x: 1780, rx: 23, flower: false, spot: { y: 96, rarity: 'rare', tag: 'b' } },
];

function canalWith(overrides: Partial<AreaLayoutData>): AreaLayoutData {
  return { ...CANAL_LAYOUT, ...overrides };
}

describe('fixed lily pads', () => {
  it.each(ALL_SEEDS)('appends the fixed pads after the seeded pads for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ fixedPads: FIXED_PADS }), seed);
    expect(zone.pads).toEqual([
      ...canal.pads,
      { x: 1000, rx: 24, flower: true },
      { x: 1340, rx: 22, flower: false },
      { x: 1780, rx: 23, flower: false },
    ]);
  });

  it.each(ALL_SEEDS)('appends a never-dropped spot under each fixed pad that has one for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ fixedPads: FIXED_PADS }), seed);
    expect(zone.spots).toEqual([
      ...canal.spots,
      { id: 'canal/spot-pad-a', cover: 'pad', rarity: 'common', container: false, x: 1000, y: 100 },
      { id: 'canal/spot-pad-b', cover: 'pad', rarity: 'rare', container: false, x: 1780, y: 96 },
    ]);
    for (const spot of zone.spots.slice(canal.spots.length)) {
      expect(coversAt(spot, zone)).toContain('pad');
    }
    expect(zone.collectibles).toEqual(canal.collectibles);
    expect(zone.reeds).toEqual(canal.reeds);
  });

  it('treats an empty fixedPads list like an absent one', () => {
    expect(buildZone(canalWith({ fixedPads: [] }), 7)).toEqual(buildCanalZone(7));
  });

  it.each(ALL_SEEDS)('builds no seeded pads and no seeded pad spot when padCount is 0 for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ padCount: 0, padSpotIndex: null }), seed);
    expect(zone.pads).toEqual([]);
    expect(zone.spots).toEqual(canal.spots.filter((spot) => spot.cover !== 'pad'));
    expect(zone.collectibles).toEqual(canal.collectibles);
    expect(zone.reeds).toEqual(canal.reeds);
  });

  it('keeps only the fixed pads when padCount is 0', () => {
    const zone = buildZone(canalWith({ padCount: 0, padSpotIndex: null, fixedPads: FIXED_PADS }), 3);
    expect(zone.pads.map((pad) => pad.x)).toEqual([1000, 1340, 1780]);
    expect(zone.spots.filter((spot) => spot.cover === 'pad').map((spot) => spot.id)).toEqual(['canal/spot-pad-a', 'canal/spot-pad-b']);
  });

  it.each(ALL_SEEDS)('keeps the seeded pads but adds no seeded pad spot when padSpotIndex is null for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ padSpotIndex: null }), seed);
    expect(zone.pads).toEqual(canal.pads);
    expect(zone.spots).toEqual(canal.spots.filter((spot) => spot.cover !== 'pad'));
  });
});

describe('snack hazard clearance', () => {
  it('is 80 px', () => {
    expect(SNACK_HAZARD_CLEARANCE).toBe(80);
  });

  it.each(ALL_SEEDS)('keeps every snack at least SNACK_HAZARD_CLEARANCE from every hazard shape for seed %i', (seed) => {
    const zone = buildZone(canalWith({ hazards: LITTER }), seed);
    expect(zone.collectibles).toHaveLength(16);
    for (const snack of zone.collectibles) {
      for (const hazard of zone.hazards) {
        const distance = shapeDistance(snack, hazard.shape);
        expect(distance, `${snack.id} is ${distance.toFixed(1)} px from ${hazard.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('tests hazards that sit where the canal would put snacks', () => {
    const tooClose = ALL_SEEDS.filter((seed) =>
      buildCanalZone(seed).collectibles.some((snack) => LITTER.some((hazard) => shapeDistance(snack, hazard.shape) < SNACK_HAZARD_CLEARANCE)),
    );
    expect(tooClose.length).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)('makes the same draws and snacks as the canal when no hazard is near for seed %i', (seed) => {
    const far: HazardSpawn[] = [{ id: 'far-0', type: TEST_LITTER, shape: { kind: 'circle', x: -1000, y: -1000, r: 10 } }];
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ hazards: far }), seed);
    expect(zone.collectibles).toEqual(canal.collectibles);
    expect(zone.pads).toEqual(canal.pads);
  });

  it('keeps the canal, which has no hazards, unchanged', () => {
    expect(CANAL_LAYOUT.hazards).toEqual([]);
    expect(CANAL_LAYOUT.fixedPads).toBeUndefined();
    expect(buildZone(CANAL_LAYOUT, 0xa70107)).toEqual(buildCanalZone());
  });
});

const TEST_MAT_TYPE: ElementType = {
  id: 'test-mats',
  name: 'Test mats',
  kind: 'cycle',
  period: 8,
  activeFor: 3,
  fact: { id: 'test-mats', name: 'Test mats', title: 'Meet the test mats', body: 'Test mats for tests.' },
  meetRange: 180,
  openFor: 3,
  openingFor: 1,
  closingFor: 1,
  closedFor: 4,
};
/** Mat pairs in the canal's upper water only, so every snack stripe keeps clear water below them. */
const MATS: readonly ElementSpawn[] = [
  { id: 'mats-0', type: TEST_MAT_TYPE, offset: 0, matPair: { x0: 700, x1: 760, rowTop: SURF, rowBottom: 150, channelY: 115, openHeight: 40 } },
  { id: 'mats-1', type: TEST_MAT_TYPE, offset: 4, matPair: { x0: 1500, x1: 1560, rowTop: SURF, rowBottom: 150, channelY: 115, openHeight: 40 } },
];
const PULSE: ElementSpawn = {
  id: 'pulse-0',
  type: { id: 'test-pulse', name: 'Test pulse', kind: 'cycle', period: 10, activeFor: 3 },
  offset: 2,
};

function sweepOf(element: ElementSpawn) {
  const sweep = elementSweep(element);
  if (!sweep) throw new Error(`expected a sweep on ${element.id}`);
  return sweep;
}

describe('elements', () => {
  it('copies every element, its type, fact card and mat pair, sharing no object with the data', () => {
    const zone = buildZone(canalWith({ elements: MATS }), 3);
    expect(zone.elements).toEqual(MATS);
    zone.elements.forEach((element, index) => {
      expect(element).not.toBe(MATS[index]);
      expect(element.type).not.toBe(MATS[index].type);
      expect(element.type.fact).not.toBe(MATS[index].type.fact);
      expect(element.matPair).not.toBe(MATS[index].matPair);
    });
  });

  it('adds no fact or mat pair key to an element that has none', () => {
    const [element] = buildZone(canalWith({ elements: [PULSE] }), 3).elements;
    expect(element).toStrictEqual(PULSE);
    expect(element).not.toHaveProperty('matPair');
    expect(element.type).not.toHaveProperty('fact');
  });

  it.each(ALL_SEEDS)('keeps every snack start at least SNACK_HAZARD_CLEARANCE from every mat sweep for seed %i', (seed) => {
    const zone = buildZone(canalWith({ elements: MATS }), seed);
    expect(zone.collectibles).toHaveLength(16);
    for (const snack of zone.collectibles) {
      for (const element of zone.elements) {
        const distance = shapeDistance(snack, sweepOf(element));
        expect(distance, `${snack.id} is ${distance.toFixed(1)} px from ${element.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('tests mat sweeps that sit where the canal would put snacks', () => {
    const tooClose = ALL_SEEDS.filter((seed) =>
      buildCanalZone(seed).collectibles.some((snack) => MATS.some((element) => shapeDistance(snack, sweepOf(element)) < SNACK_HAZARD_CLEARANCE)),
    );
    expect(tooClose.length).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)('makes no extra rand() draws when no element has a sweep for seed %i', (seed) => {
    expect(buildZone(canalWith({ elements: [PULSE] }), seed)).toStrictEqual({ ...buildCanalZone(seed), elements: [PULSE] });
  });

  it.each(ALL_SEEDS)('makes the same draws and snacks as the canal when no mat sweep is near for seed %i', (seed) => {
    const far: ElementSpawn[] = [{ ...MATS[0], matPair: { x0: -1000, x1: -940, rowTop: -400, rowBottom: -200, channelY: -300, openHeight: 72 } }];
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ elements: far }), seed);
    expect(zone.collectibles).toEqual(canal.collectibles);
    expect(zone.pads).toEqual(canal.pads);
  });
});

const BANK_OVERHANGS: readonly BankOverhang[] = [{ x0: 1760, x1: 1880, y0: SURF, y1: 140 }];
const BANK_SPOTS: readonly FixedSpotData[] = [
  [1790, 110, 'rare', false],
  [1850, 130, 'common', false],
];
const AREA_TILAPIA = { ...TILAPIA, windup: 0.85, lungeSpeed: 400, lungeRange: 145, cooldown: 2.2, patrolSpeed: 50 };

describe('bank cover', () => {
  it.each(ALL_SEEDS)('appends the never-dropped bank spots last, after the fixed pads, for seed %i', (seed) => {
    const withPads = buildZone(canalWith({ fixedPads: FIXED_PADS }), seed);
    const zone = buildZone(canalWith({ fixedPads: FIXED_PADS, bankOverhangs: BANK_OVERHANGS, bankSpots: BANK_SPOTS }), seed);
    expect(zone.spots).toEqual([
      ...withPads.spots,
      { id: 'canal/spot-bank-1', cover: 'bank', rarity: 'rare', container: false, x: 1790, y: 110 },
      { id: 'canal/spot-bank-2', cover: 'bank', rarity: 'common', container: false, x: 1850, y: 130 },
    ]);
    expect(zone.collectibles).toEqual(withPads.collectibles);
    expect(zone.reeds).toEqual(withPads.reeds);
    expect(zone.pads).toEqual(withPads.pads);
  });

  it('copies the bank overhangs, and puts every bank spot under the bank cover and in shallow water', () => {
    const zone = buildZone(canalWith({ bankOverhangs: BANK_OVERHANGS, bankSpots: BANK_SPOTS }), 3);
    expect(zone.bankOverhangs).toEqual(BANK_OVERHANGS);
    expect(zone.bankOverhangs?.[0]).not.toBe(BANK_OVERHANGS[0]);
    const bankSpots = zone.spots.filter((spot) => spot.cover === 'bank');
    expect(bankSpots).toHaveLength(BANK_SPOTS.length);
    for (const spot of bankSpots) {
      expect(coversAt(spot, zone)).toContain('bank');
      expect(isDeep(spot, zone)).toBe(false);
    }
  });

  it('builds no bank cover from bankChunks', () => {
    const canal = buildCanalZone();
    expect(canal.bankChunks).toEqual([1, 3]);
    expect(canal).not.toHaveProperty('bankOverhangs');
    expect(canal.spots.some((spot) => spot.cover === 'bank')).toBe(false);
    expect(canal.spots.some((spot) => coversAt(spot, canal).includes('bank'))).toBe(false);
  });

  it('treats an empty bankSpots list like an absent one', () => {
    expect(buildZone(canalWith({ bankSpots: [] }), 7)).toStrictEqual(buildCanalZone(7));
  });
});

/** A synthetic 5 x 3 area: the canal's data, 5 screens across and 3 down. */
const FIVE_BY_THREE = canalWith({ screensWide: 5, screensTall: 3 });

describe('an area three rows tall', () => {
  it('is 2400 x 1080 world px with the bed top at 1038', () => {
    expect(areaSize(5, 3)).toEqual({ width: 2400, height: 1080, bedTop: 1038 });
    const zone = buildZone(FIVE_BY_THREE, DEFAULT_ZONE_SEED);
    expect([zone.width, zone.height, zone.bedTop, zone.chunks, zone.rows]).toEqual([2400, 1080, 1038, 5, 3]);
  });

  it('swims from the surface down to the bed of the bottom row', () => {
    expect(swimBounds(areaSize(5, 3))).toEqual({ minX: 40, maxX: 2360, minY: SURF + 14, maxY: 1016 });
  });

  it('splits the whole swim height into three equal depth bands, top down', () => {
    const bands = depthBands(areaSize(5, 3));
    expect(bands).toHaveLength(3);
    expect(bands[0].top).toBe(SURF + 14);
    expect(bands[2].bottom).toBe(1016);
    for (const [index, band] of bands.entries()) {
      expect(band.bottom - band.top).toBeCloseTo((1016 - (SURF + 14)) / 3, 6);
      if (index > 0) expect(band.top).toBe(bands[index - 1].bottom);
    }
  });

  it('has a top, a middle and a bottom row', () => {
    expect([0, 1, 2].map((row) => areaRowKind(row, 3))).toEqual(['top', 'middle', 'bottom']);
  });

  it.each(ALL_SEEDS)('stands the reeds on the bottom row bed with the canal shapes for seed %i', (seed) => {
    const zone = buildZone(FIVE_BY_THREE, seed);
    const canal = buildCanalZone(seed);
    expect(zone.reeds).toHaveLength(canal.reeds.length);
    for (const [index, reed] of zone.reeds.entries()) {
      expect(reed).toEqual({ ...canal.reeds[index], by: reed.by });
      expect(reed.by - zone.bedTop).toBeCloseTo(canal.reeds[index].by - canal.bedTop, 9);
    }
    for (const patch of zone.reedPatches) expect([patch.y0, patch.y1]).toEqual([SURF, 1038]);
  });

  it.each(ALL_SEEDS)('starts every snack inside the swim bounds of all three rows for seed %i', (seed) => {
    const bounds = swimBounds(areaSize(5, 3));
    const snacks = buildZone(FIVE_BY_THREE, seed).collectibles;
    expect(snacks).toHaveLength(16);
    for (const snack of snacks) {
      expect(snack.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(snack.x).toBeLessThanOrEqual(bounds.maxX);
      expect(snack.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(snack.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });
});

describe('areaRowKind', () => {
  it('names the one row of a one-row area single', () => {
    expect(areaRowKind(0, 1)).toBe('single');
  });

  it('names the two rows of a two-row area top and bottom', () => {
    expect([areaRowKind(0, 2), areaRowKind(1, 2)]).toEqual(['top', 'bottom']);
  });

  it('names every row between the top and bottom middle', () => {
    expect([0, 1, 2, 3, 4].map((row) => areaRowKind(row, 5))).toEqual(['top', 'middle', 'middle', 'middle', 'bottom']);
  });

  it.each([
    [-1, 3],
    [3, 3],
    [0, 0],
    [0.5, 3],
  ])('throws a RangeError for row %d of %d rows', (row, rows) => {
    expect(() => areaRowKind(row, rows)).toThrow(RangeError);
  });
});

describe('per-area tilapia tuning', () => {
  it.each(ALL_SEEDS)('copies the tuning onto the layout with no rand() draws for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ tilapia: AREA_TILAPIA }), seed);
    expect(zone.tilapia).toEqual(AREA_TILAPIA);
    expect(zone.tilapia).not.toBe(AREA_TILAPIA);
    const { tilapia, ...rest } = zone;
    expect(tilapia).toBeDefined();
    expect(rest).toStrictEqual(canal);
  });
});

describe('existing layouts', () => {
  it.each([
    ['canal', CANAL_LAYOUT],
    ['pond-1', POND_LAYOUT],
    ['pond-2', POND_2_LAYOUT],
  ] as const)('%s has no bank overhangs or bank spots, and its zone copies its tilapia tuning only when it has one', (_, layout) => {
    expect(layout.bankOverhangs).toBeUndefined();
    expect(layout.bankSpots).toBeUndefined();
    for (const seed of ALL_SEEDS) {
      const zone = buildZone(layout, seed);
      if (layout.tilapia === undefined) expect(zone).not.toHaveProperty('tilapia');
      else expect(zone.tilapia).toEqual(layout.tilapia);
      expect(zone).not.toHaveProperty('bankOverhangs');
      expect(zone.spots.some((spot) => spot.cover === 'bank')).toBe(false);
    }
  });

  it('keeps the canal free of tilapia tuning', () => {
    expect(CANAL_LAYOUT.tilapia).toBeUndefined();
  });
});

const DRIFTING_NET: HazardSpawn = {
  id: 'net-0',
  type: TEST_LITTER,
  shape: { kind: 'rect', x0: 420, x1: 460, y0: 180, y1: 220 },
  drift: netDrift(160, 0, 16, 0),
};

describe('drifting nets in the snack starts (ND-11)', () => {
  it.each(ALL_SEEDS)('keeps every snack start SNACK_HAZARD_CLEARANCE from the whole drift path for seed %i', (seed) => {
    const zone = buildZone(canalWith({ hazards: [DRIFTING_NET] }), seed);
    expect(zone.collectibles).toHaveLength(16);
    for (const snack of zone.collectibles) {
      const distance = shapeDistance(snack, hazardSweep(DRIFTING_NET));
      expect(distance, `${snack.id} is ${distance.toFixed(1)} px from the drift path`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it('tests drift paths that reach snacks the still net would leave', () => {
    const still: HazardSpawn = { id: DRIFTING_NET.id, type: TEST_LITTER, shape: DRIFTING_NET.shape };
    const changed = ALL_SEEDS.filter(
      (seed) =>
        JSON.stringify(buildZone(canalWith({ hazards: [DRIFTING_NET] }), seed).collectibles) !==
        JSON.stringify(buildZone(canalWith({ hazards: [still] }), seed).collectibles),
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)('places snacks as before for a net with no drift for seed %i', (seed) => {
    const still: HazardSpawn = { id: 'net-0', type: TEST_LITTER, shape: { kind: 'circle', x: -1000, y: -1000, r: 10 } };
    expect(buildZone(canalWith({ hazards: [still] }), seed).collectibles).toEqual(buildCanalZone(seed).collectibles);
  });

  it('copies the drift, sharing no object with the data, and adds no drift key to a still hazard', () => {
    const still: HazardSpawn = { id: 'litter-0', type: TEST_LITTER, shape: { kind: 'circle', x: 600, y: 200, r: 14 } };
    const [net, litter] = buildZone(canalWith({ hazards: [DRIFTING_NET, still] }), 3).hazards;
    expect(net).toEqual(DRIFTING_NET);
    expect(net.drift).not.toBe(DRIFTING_NET.drift);
    expect(net.shape).not.toBe(DRIFTING_NET.shape);
    expect(litter).toStrictEqual(still);
    expect(litter).not.toHaveProperty('drift');
  });
});

const POLES = [movingHazardSpawn('canal/punting-pole-1', PUNTING_POLE, 640, 0), movingHazardSpawn('canal/punting-pole-2', PUNTING_POLE, 1300, 2, 120)];

describe('moving hazards in the layout (ND-8)', () => {
  it.each(ALL_SEEDS)('keeps every snack start SNACK_HAZARD_CLEARANCE from every moving hazard sweep for seed %i', (seed) => {
    const zone = buildZone(canalWith({ movingHazards: POLES }), seed);
    expect(zone.collectibles).toHaveLength(16);
    for (const snack of zone.collectibles) {
      for (const pole of POLES) {
        const distance = shapeDistance(snack, movingHazardSweep(pole));
        expect(distance, `${snack.id} is ${distance.toFixed(1)} px from ${pole.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('tests sweeps that sit where the canal would put snacks', () => {
    const tooClose = ALL_SEEDS.filter((seed) =>
      buildCanalZone(seed).collectibles.some((snack) => POLES.some((pole) => shapeDistance(snack, movingHazardSweep(pole)) < SNACK_HAZARD_CLEARANCE)),
    );
    expect(tooClose.length).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)('copies the spawns with no rand() draws when no sweep is near for seed %i', (seed) => {
    const far = [movingHazardSpawn('canal/punting-pole-9', PUNTING_POLE, -1000, 0)];
    const zone = buildZone(canalWith({ movingHazards: far }), seed);
    const { movingHazards, ...rest } = zone;
    expect(movingHazards).toEqual(far);
    expect(movingHazards?.[0]).not.toBe(far[0]);
    expect(rest).toStrictEqual(buildCanalZone(seed));
  });
});

const TADPOLE = tadpoleRule(60);
const MIX = mobileSnackMix({
  tadpole: TADPOLE,
  wanders: [
    tadpoleWander(TADPOLE, [[400, 200], [520, 200], [520, 320], [400, 320]], 0),
    tadpoleWander(TADPOLE, [[1700, 240], [1700, 140]], 1.5),
  ],
  shrimp: shrimpRule(60, 1.2, 60, 145),
  homes: [shrimpHome([[560, 140], [600, 160], [560, 180]]), shrimpHome([[1250, 250]]), shrimpHome([[1800, 130]])],
});

describe('mobile snacks in the layout (ND-22, ND-23; issue #131, ND-13)', () => {
  it.each(ALL_SEEDS)('keeps the seeded snacks and appends tadpoles then shrimp, with no rand() draw, for seed %i', (seed) => {
    const canal = buildCanalZone(seed);
    const zone = buildZone(canalWith({ mobileSnacks: MIX }), seed);
    const { mobileSnacks, collectibles, ...rest } = zone;
    expect(mobileSnacks).toEqual(MIX);
    expect(collectibles.slice(0, canal.collectibles.length)).toEqual(canal.collectibles);
    expect(collectibles.slice(canal.collectibles.length)).toStrictEqual([
      {
        id: 'snack-tadpole-1',
        kind: 'tadpole',
        x: 400,
        y: 200,
        wander: {
          points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }],
          legEnds: [120, 240, 360, 480],
          lap: 480,
          speed: 60,
          offset: 0,
        },
      },
      {
        id: 'snack-tadpole-2',
        kind: 'tadpole',
        x: 1700,
        y: 240,
        wander: { points: [{ x: 0, y: 0 }, { x: 0, y: -100 }], legEnds: [100, 200], lap: 200, speed: 60, offset: 1.5 },
      },
      { id: 'snack-shrimp-1', kind: 'shrimp', x: 560, y: 140, home: [{ x: 560, y: 140 }, { x: 600, y: 160 }, { x: 560, y: 180 }] },
      { id: 'snack-shrimp-2', kind: 'shrimp', x: 1250, y: 250, home: [{ x: 1250, y: 250 }] },
      { id: 'snack-shrimp-3', kind: 'shrimp', x: 1800, y: 130, home: [{ x: 1800, y: 130 }] },
    ]);
    const { collectibles: canalSnacks, ...canalRest } = canal;
    expect(canalSnacks).toHaveLength(16);
    expect(rest).toStrictEqual(canalRest);
  });

  it('copies the mix, sharing no object with the data', () => {
    const zone = buildZone(canalWith({ mobileSnacks: MIX }), 3);
    expect(zone.mobileSnacks).not.toBe(MIX);
    expect(zone.mobileSnacks?.tadpole).not.toBe(MIX.tadpole);
    expect(zone.mobileSnacks?.shrimp).not.toBe(MIX.shrimp);
    expect(zone.mobileSnacks?.wanders[0]).not.toBe(MIX.wanders[0]);
    expect(zone.mobileSnacks?.wanders[0].points[0]).not.toBe(MIX.wanders[0].points[0]);
    expect(zone.mobileSnacks?.homes[0]).not.toBe(MIX.homes[0]);
    expect(zone.mobileSnacks?.homes[0].points[0]).not.toBe(MIX.homes[0].points[0]);
  });

  it('gives each build its own spawn wander loops and homes, sharing no object with the data or each other', () => {
    const first = buildZone(canalWith({ mobileSnacks: MIX }), 3);
    const second = buildZone(canalWith({ mobileSnacks: MIX }), 3);
    const tadpoleOf = (zone: ZoneLayout) => zone.collectibles.find((snack) => snack.id === 'snack-tadpole-1');
    const shrimpOf = (zone: ZoneLayout) => zone.collectibles.find((snack) => snack.id === 'snack-shrimp-1');
    expect(tadpoleOf(first)?.wander).toEqual(tadpoleOf(second)?.wander);
    expect(tadpoleOf(first)?.wander).not.toBe(tadpoleOf(second)?.wander);
    expect(tadpoleOf(first)?.wander?.points).not.toBe(tadpoleOf(second)?.wander?.points);
    expect(shrimpOf(first)?.home).toEqual(shrimpOf(second)?.home);
    expect(shrimpOf(first)?.home).not.toBe(shrimpOf(second)?.home);
    expect(shrimpOf(first)?.home?.[0]).not.toBe(MIX.homes[0].points[0]);
    expect(shrimpOf(first)?.home?.[0]).not.toBe(first.mobileSnacks?.homes[0].points[0]);
  });

  it('builds only tadpoles or only shrimp, with no key for the missing rule', () => {
    const tadpoles = buildZone(canalWith({ mobileSnacks: mobileSnackMix({ tadpole: TADPOLE, wanders: MIX.wanders, homes: [] }) }), 3);
    expect(tadpoles.collectibles.filter((snack) => snack.kind === 'shrimp')).toEqual([]);
    expect(tadpoles.mobileSnacks).not.toHaveProperty('shrimp');
    const shrimp = buildZone(canalWith({ mobileSnacks: mobileSnackMix({ wanders: [], shrimp: MIX.shrimp, homes: MIX.homes }) }), 3);
    expect(shrimp.collectibles.filter((snack) => snack.kind === 'tadpole')).toEqual([]);
    expect(shrimp.mobileSnacks).not.toHaveProperty('tadpole');
  });

  it('refuses wander loops without a tadpole rule and homes without a shrimp rule', () => {
    expect(() => buildZone(canalWith({ mobileSnacks: { wanders: MIX.wanders, homes: [] } }), 3)).toThrow(RangeError);
    expect(() => buildZone(canalWith({ mobileSnacks: { wanders: [], homes: MIX.homes } }), 3)).toThrow(RangeError);
  });

  it.each([
    ['canal', CANAL_LAYOUT],
    ['pond-1', POND_LAYOUT],
    ['pond-2', POND_2_LAYOUT],
    ['chinampa-1', CHINAMPA_LAYOUT],
    ['chinampa-2', CHINAMPA_2_LAYOUT],
  ] as const)('%s gives its zone keys for moving hazards and mobile snacks only when its data has them', (_, layout) => {
    for (const seed of ALL_SEEDS) {
      const zone = buildZone(layout, seed);
      expect('movingHazards' in zone).toBe(layout.movingHazards !== undefined);
      expect('mobileSnacks' in zone).toBe(layout.mobileSnacks !== undefined);
      const seeded = zone.collectibles.filter((snack) => snack.kind === 'worm' || snack.kind === 'bug');
      expect(seeded.every((snack) => !('wander' in snack) && !('home' in snack))).toBe(true);
      if (layout.mobileSnacks === undefined) {
        expect(seeded).toEqual(zone.collectibles);
      }
    }
  });

  it('keeps the canal free of moving hazards and mobile snacks', () => {
    expect(CANAL_LAYOUT.movingHazards).toBeUndefined();
    expect(CANAL_LAYOUT.mobileSnacks).toBeUndefined();
  });
});

const DARK_WATER: DarkWater = { x0: 1200, x1: 1920, y0: SURF, y1: BED_TOP };
const GLOW_PLANTS_DATA: readonly ElementSpawn[] = [
  glowPlantSpawn('canal/glow-plant-1', { x: 1300, y: 290, radius: 14 }),
  glowPlantSpawn('canal/glow-plant-2', { x: 1700, y: 290, radius: 14 }),
];

describe('dark water and glow-plants in the layout (issue #77, ND-7 and ND-8)', () => {
  it.each(ALL_SEEDS)('copies the dark water with no rand() draw for seed %i', (seed) => {
    const zone = buildZone(canalWith({ darkWater: DARK_WATER }), seed);
    const { darkWater, ...rest } = zone;
    expect(darkWater).toEqual(DARK_WATER);
    expect(darkWater).not.toBe(DARK_WATER);
    expect(rest).toStrictEqual(buildCanalZone(seed));
  });

  it('adds no dark water key to a layout that has none', () => {
    expect(buildZone(CANAL_LAYOUT, DEFAULT_ZONE_SEED)).not.toHaveProperty('darkWater');
  });

  it.each(ALL_SEEDS)('copies each glow-plant and its geometry with no rand() draw for seed %i', (seed) => {
    const zone = buildZone(canalWith({ elements: GLOW_PLANTS_DATA }), seed);
    const { elements, ...rest } = zone;
    expect(elements).toEqual(GLOW_PLANTS_DATA);
    elements.forEach((element, index) => {
      expect(element).not.toBe(GLOW_PLANTS_DATA[index]);
      expect(element.glowPlant).not.toBe(GLOW_PLANTS_DATA[index].glowPlant);
      expect(element).not.toHaveProperty('matPair');
    });
    const { elements: canalElements, ...canalRest } = buildCanalZone(seed);
    expect(canalElements).toEqual([]);
    expect(rest).toStrictEqual(canalRest);
  });

  it.each([
    ['canal', CANAL_LAYOUT],
    ['pond-1', POND_LAYOUT],
    ['pond-2', POND_2_LAYOUT],
    ['chinampa-1', CHINAMPA_LAYOUT],
    ['chinampa-2', CHINAMPA_2_LAYOUT],
  ] as const)('keeps %s fully lit, with no glow-plant', (_, layout) => {
    expect(layout.darkWater).toBeUndefined();
    expect(layout.elements.some((element) => element.glowPlant !== undefined)).toBe(false);
    expect(buildZone(layout, DEFAULT_ZONE_SEED)).not.toHaveProperty('darkWater');
  });
});
