/**
 * Area 13's layout (issue #212): the trench's shape and rock, its threats, its exit, its hiding
 * spots by depth band, its treasure, its snacks, its stranding places and its fading lights. The
 * danger bar is proved in openLake2Danger.test.ts and the fairness proofs in openLake2Fairness.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { OPEN_LAKE_2_TREASURES, RARITIES, type Rarity } from './catalogue';
import { waterScreenCount } from './dangerBar';
import { DEEP_CANAL_4_CORMORANT, DEEP_CANAL_4_LAYOUT } from './deepCanal4Layout';
import { deepestWaterBand, depthBandAt, raritySpotsInDeepestBand, spotFitsBand } from './depthBand';
import { exitGateBase } from './exitGate';
import { FADING_LIGHTS, fadingLights } from './fadingLights';
import { inDarkWater } from './glowPlants';
import { FADING_LIGHT, FADING_LIGHT_RADIUS } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, meetsThreatRiskRule, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples } from './layoutGaps';
import {
  meetsSnackMotion,
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileSnackShare,
  oneLegCatchesTadpole,
  shrimpHomeClear,
  tadpoleWanderClear,
} from './mobileSnacks';
import {
  OPEN_LAKE_2_AREA_ID,
  OPEN_LAKE_2_CARP,
  OPEN_LAKE_2_CORMORANT,
  OPEN_LAKE_2_EXIT,
  OPEN_LAKE_2_LAYOUT,
  OPEN_LAKE_2_PELICAN_LINE,
  OPEN_LAKE_2_SPECIAL_TREASURE_ID,
  OPEN_LAKE_2_START,
  OPEN_LAKE_2_TILAPIA,
} from './openLake2Layout';
import { OPEN_LAKE_CARP, OPEN_LAKE_LAYOUT, OPEN_LAKE_TILAPIA } from './openLakeLayout';
import { PEBBLES, bodyInAnyRock, type RockWall } from './pebble';
import { PELICAN_LINE, pelicanLinePeriod, pelicanLineSweep, pelicanNarrowestGap } from './pelicanLine';
import { placeTreasures } from './placement';
import {
  CARP_SPECIES,
  CORMORANT_SPECIES,
  MUD_TURTLE_SPECIES,
  TILAPIA_SPECIES,
  routeLoopDistance,
  tunedSpecies,
  type PredatorRoute,
} from './predators';
import { CORMORANT_CHASE, FINDS, MUD_TURTLE, tripTreasureTuning } from './tuning';
import { winds } from './wind';
import {
  BED_TOP,
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  SURF,
  WORLD_H,
  buildZone,
  inSafeArea,
  swimBounds,
  type Point,
  type ZoneLayout,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
/** 200 trip seeds for treasure placement. */
const TRIP_SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);
const STRANDING_ROUTE_CLEARANCE = 80;
/** Top of the left and right steps (issue #212, ND-2). */
const STEP_TOP = 678;
/** Top of each pit terrace step (issue #212, ND-2). */
const TERRACE_TOP = 920;
/** The pit floor between the two terrace steps, and its middle, which splits it into west and east halves (ND-12). */
const PIT_FLOOR = { x0: 2080, x1: 2720, middle: 2400 };
/** The pit, from the left step to the right step, over its floor and both terrace steps. */
const PIT = { x0: 1920, x1: 2880 };
/** y of every cormorant's stretch (ND-19), and the deepest y its 290 px dive reaches: 384, in band 2. */
const CORMORANT_STRETCH_Y = 94;
const CORMORANT_DIVE_Y = 384;
/** Fewest spots each pool has (ND-18), in RARITIES order. */
const POOL_FLOOR = [4, 7, 3, 4];
/** Px between the two floor lights (ND-8). */
const FLOOR_LIGHT_GAP = 240;
/** Spacing in px of the water grid the light reach proof floods. */
const FLOOD_STEP = 8;
/** The deepest band of each screen column, west to east: the 3x1, 1x2, 2x3, 2x2 and 2x1 segments (ND-2). */
const COLUMN_DEPTHS = [1, 1, 1, 2, 3, 3, 2, 2, 1, 1];
/** The main path's waypoints, named by the part of the swim each starts or ends (ND-4). */
const TURN = { home: 0, leftShelfFarEnd: 3, stepFloor: 5, overPit: 7, rightStep: 9, rightShelf: 11, rightShelfFarEnd: 12, intoPit: 17, exit: 19 };
const CARP_IDS = [0, 1, 2, 3, 4, 5].map((n) => `carp-${n}`);
const CORMORANT_IDS = ['cormorant-0', 'cormorant-1'];
const TURTLE_IDS = ['mud-turtle-0', 'mud-turtle-1'];
const LINE_IDS = [1, 2].map((n) => `open-lake-2/pelican-line-${n}`);
const LIGHT_IDS = [1, 2, 3, 4].map((n) => `open-lake-2/fading-light-${n}`);
/** Empty treasure slots over the 200 fresh trips, as measured: 18 slots and the special treasure's for 16 treasures (issue #215). */
const EMPTY_SLOTS = { most: 7, mean: 5.305 };

const zone = buildZone(OPEN_LAKE_2_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const exit = OPEN_LAKE_2_EXIT;
const walls: readonly RockWall[] = zone.rockWalls ?? [];
const lines = zone.pelicanLines ?? [];
const lights = fadingLights(zone.elements);
const dark = zone.darkWater ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
const { safeArea } = zone;
const zonesBySeed = new Map<number, ZoneLayout>([[DEFAULT_ZONE_SEED, zone]]);

/** Area 13 built with `seed`, built once per seed. */
function openLake2(seed: number): ZoneLayout {
  const built = zonesBySeed.get(seed) ?? buildZone(OPEN_LAKE_2_LAYOUT, seed);
  zonesBySeed.set(seed, built);
  return built;
}

function inBounds(point: Point): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

/** Whether a point is inside a rect, edges included. */
function inRect(point: Point, rect: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return point.x >= rect.x0 && point.x <= rect.x1 && point.y >= rect.y0 && point.y <= rect.y1;
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectGap(first: { x0: number; x1: number; y0: number; y1: number }, second: { x0: number; x1: number; y0: number; y1: number }): number {
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

/** A point as a rect with no size. */
function pointRect(point: Point): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: point.x, x1: point.x, y0: point.y, y1: point.y };
}

/** The screen column an x is in, 0 at the left. */
function columnOf(x: number): number {
  return Math.floor(x / SCREEN_W);
}

/** The floor under `x`: the top of the highest rock wall whose x span holds it, else the bed. */
function floorUnder(x: number): number {
  return Math.min(zone.bedTop, ...walls.filter((wall) => wall.x0 <= x && x <= wall.x1).map((wall) => wall.y0));
}

/** Points every `step` px along an open path. */
function pathSamples(path: readonly Point[], step: number): Point[] {
  return path.slice(1).flatMap((to, i) => {
    const from = path[i];
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    return Array.from({ length: count + 1 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / count, y: from.y + ((to.y - from.y) * k) / count }));
  });
}

/** The zone's predator routes of one species. */
function routesOf(layout: Pick<ZoneLayout, 'predatorRoutes'>, speciesId: string): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === speciesId);
}

/** Each tilapia and carp route with its strike range. */
function strikeRoutes(layout: ZoneLayout): { id: string; waypoints: readonly Point[]; strike: number }[] {
  return [
    ...layout.tilapiaRoutes.map((route) => ({ id: route.id, waypoints: route.waypoints, strike: OPEN_LAKE_2_TILAPIA.lungeRange })),
    ...routesOf(layout, CARP_SPECIES.id).map((route) => ({ id: route.id, waypoints: route.waypoints, strike: route.species.tuning.lungeRange })),
  ];
}

/** Each mud turtle route with its snap reach: its lungeRange and its hit reach (ND-8). */
function snapRoutes(layout: ZoneLayout): { id: string; waypoints: readonly Point[]; reach: number }[] {
  return routesOf(layout, MUD_TURTLE_SPECIES.id).map((route) => ({
    id: route.id,
    waypoints: route.waypoints,
    reach: route.species.tuning.lungeRange + route.species.tuning.hitRadius,
  }));
}

/** The y span of a route's waypoints. */
function ySpan(waypoints: readonly Point[]): { top: number; bottom: number } {
  const ys = waypoints.map((point) => point.y);
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** The x span of a route's waypoints. */
function xSpan(waypoints: readonly Point[]): { x0: number; x1: number } {
  const xs = waypoints.map((point) => point.x);
  return { x0: Math.min(...xs), x1: Math.max(...xs) };
}

/** The count of each rarity in `items`, in RARITIES order. */
function rarityCounts(items: readonly { rarity: Rarity }[]): number[] {
  return RARITIES.map((rarity) => items.filter((item) => item.rarity === rarity).length);
}

/** Least px from a point to any fading light's centre. */
function nearestLight(point: Point): number {
  return Math.min(...lights.map((light) => Math.hypot(point.x - light.fadingLight.x, point.y - light.fadingLight.y)));
}

/**
 * The ids of the fading lights a body can reach from the Home Spot without entering any turtle's
 * snap reach: a flood every FLOOD_STEP px over the swim bounds, through every place the body fits
 * that is farther than each turtle's snap reach from its stretch, reaching a light when a flooded
 * place touches it.
 */
function lightsReachedOutsideSnaps(): string[] {
  const snaps = snapRoutes(zone);
  const columns = Math.floor((bounds.maxX - bounds.minX) / FLOOD_STEP) + 1;
  const rows = Math.floor((bounds.maxY - bounds.minY) / FLOOD_STEP) + 1;
  const pointOf = (cell: number): Point => ({ x: bounds.minX + (cell % columns) * FLOOD_STEP, y: bounds.minY + Math.floor(cell / columns) * FLOOD_STEP });
  const open = Array.from({ length: columns * rows }, (_, cell) => {
    const point = pointOf(cell);
    return !bodyInAnyRock(point, walls) && snaps.every((snap) => routeLoopDistance(point, snap.waypoints) > snap.reach);
  });
  const startCell = Math.round((zone.start.y - bounds.minY) / FLOOD_STEP) * columns + Math.round((zone.start.x - bounds.minX) / FLOOD_STEP);
  const reached = open.map(() => false);
  const queue = [startCell];
  reached[startCell] = true;
  for (let index = 0; index < queue.length; index++) {
    for (const next of floodNeighbours(queue[index], columns, rows)) {
      if (!open[next] || reached[next]) continue;
      reached[next] = true;
      queue.push(next);
    }
  }
  const flooded = queue.map(pointOf);
  return lights
    .filter((light) => flooded.some((point) => Math.hypot(point.x - light.fadingLight.x, point.y - light.fadingLight.y) <= light.fadingLight.radius + FADING_LIGHTS.touchReach))
    .map((light) => light.id);
}

/** The up to four grid cells next to `cell`. */
function floodNeighbours(cell: number, columns: number, rows: number): number[] {
  const [row, column] = [Math.floor(cell / columns), cell % columns];
  const steps = [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];
  return steps.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < columns).map(([r, c]) => r * columns + c);
}

describe('OPEN_LAKE_2_LAYOUT', () => {
  it('is Area 13 data: 10 screens across, 3 down, depth banded, starting at the Home Spot', () => {
    expect(OPEN_LAKE_2_AREA_ID).toBe('open-lake-2');
    expect(OPEN_LAKE_2_LAYOUT.id).toBe(OPEN_LAKE_2_AREA_ID);
    expect([zone.width, zone.height, zone.bedTop]).toEqual([4800, 1080, 1038]);
    expect([zone.chunks, zone.rows]).toEqual([10, 3]);
    expect(zone.depthBanded).toBe(true);
    expect(OPEN_LAKE_2_LAYOUT.start).toBe(OPEN_LAKE_2_START);
    expect(zone.start).toEqual({ x: 2160, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 2160, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('open-lake-2/cave');
    for (const part of [zone.trajineras, zone.bailingBoats, zone.fishingBoats, zone.dragNets, zone.sideRooms, zone.bankOverhangs]) {
      expect(part).toBeUndefined();
    }
  });

  it('is frozen data, down to each wall, route, pelican line, bed, light and mobile snack', () => {
    for (const part of [OPEN_LAKE_2_LAYOUT, OPEN_LAKE_2_TILAPIA, OPEN_LAKE_2_CARP, OPEN_LAKE_2_CARP.tuning, OPEN_LAKE_2_CORMORANT, OPEN_LAKE_2_CORMORANT.tuning]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const part of [OPEN_LAKE_2_CORMORANT.tuning.chase, OPEN_LAKE_2_PELICAN_LINE, OPEN_LAKE_2_EXIT, OPEN_LAKE_2_START, OPEN_LAKE_2_TREASURES]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    const { rockWalls, pelicanLines, reedBeds, tilapiaRoutes, predatorRoutes, mobileSnacks, elements } = OPEN_LAKE_2_LAYOUT;
    for (const part of [
      rockWalls,
      pelicanLines,
      reedBeds,
      tilapiaRoutes,
      predatorRoutes,
      elements,
      OPEN_LAKE_2_LAYOUT.mainPath,
      OPEN_LAKE_2_LAYOUT.strandingPlaces,
      OPEN_LAKE_2_LAYOUT.cave,
      OPEN_LAKE_2_LAYOUT.safeArea,
      OPEN_LAKE_2_LAYOUT.darkWater,
      mobileSnacks,
      mobileSnacks?.wanders,
      mobileSnacks?.homes,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const wall of rockWalls ?? []) expect(Object.isFrozen(wall)).toBe(true);
    for (const line of pelicanLines ?? []) {
      expect(Object.isFrozen(line), line.id).toBe(true);
      expect(Object.isFrozen(line.tuning), line.id).toBe(true);
    }
    for (const element of elements) {
      expect(Object.isFrozen(element), element.id).toBe(true);
      expect(Object.isFrozen(element.fadingLight), element.id).toBe(true);
    }
    for (const bed of reedBeds) {
      expect(Object.isFrozen(bed)).toBe(true);
      expect(Object.isFrozen(bed.columns)).toBe(true);
      expect(Object.isFrozen(bed.rows)).toBe(true);
      for (const row of bed.rows) expect(Object.isFrozen(row)).toBe(true);
    }
    for (const route of tilapiaRoutes) for (const point of route) expect(Object.isFrozen(point)).toBe(true);
    for (const route of predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const point of OPEN_LAKE_2_LAYOUT.mainPath) expect(Object.isFrozen(point)).toBe(true);
    for (const place of OPEN_LAKE_2_LAYOUT.strandingPlaces) expect(Object.isFrozen(place), place.id).toBe(true);
  });

  it('has 20 snacks (3 worms, 3 bugs, 4 tadpoles and 10 shrimp), 2 tilapia, 6 carp, 2 cormorants, 2 mud turtles, 2 pelican lines of 3, 4 fading lights, no wind, 18 treasure slots and no pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = openLake2(seed);
      expect(layout.collectibles).toHaveLength(20);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([3, 3, 4, 10]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1']);
    expect(routesOf(zone, CARP_SPECIES.id).map((route) => [route.id, route.species])).toEqual(CARP_IDS.map((id) => [id, OPEN_LAKE_2_CARP]));
    expect(routesOf(zone, CORMORANT_SPECIES.id).map((route) => [route.id, route.species])).toEqual(CORMORANT_IDS.map((id) => [id, OPEN_LAKE_2_CORMORANT]));
    expect(routesOf(zone, MUD_TURTLE_SPECIES.id).map((route) => [route.id, route.species])).toEqual(TURTLE_IDS.map((id) => [id, MUD_TURTLE_SPECIES]));
    expect(zone.predatorRoutes).toHaveLength(CARP_IDS.length + CORMORANT_IDS.length + TURTLE_IDS.length);
    expect(lines.map((line) => [line.id, line.tuning.count])).toEqual(LINE_IDS.map((id) => [id, 3]));
    expect(lights.map((light) => light.id)).toEqual(LIGHT_IDS);
    expect(zone.elements).toHaveLength(LIGHT_IDS.length);
    expect(winds(zone.elements)).toEqual([]);
    expect(OPEN_LAKE_2_LAYOUT.padCount).toBe(0);
    expect(OPEN_LAKE_2_LAYOUT.tilapia).toBe(OPEN_LAKE_2_TILAPIA);
    expect(tripTreasureTuning(OPEN_LAKE_2_AREA_ID).slots).toBe(18);
    expect(tripTreasureTuning(OPEN_LAKE_2_AREA_ID).slots).toBe(tripTreasureTuning(OPEN_LAKE_LAYOUT.id).slots + 1);
  });

  it("plays its tilapia one step up the ladder from Area 12's (ND-19): a 540 px/s strike reaching 180 px, a 1.3 s cooldown and an 85 px/s patrol, Area 12's warning and chase", () => {
    expect(OPEN_LAKE_2_TILAPIA).toEqual({ ...OPEN_LAKE_TILAPIA, lungeSpeed: 540, lungeRange: 180, cooldown: 1.3, patrolSpeed: 85 });
    expect([OPEN_LAKE_TILAPIA.lungeSpeed, OPEN_LAKE_TILAPIA.lungeRange, OPEN_LAKE_TILAPIA.cooldown, OPEN_LAKE_TILAPIA.patrolSpeed]).toEqual([520, 175, 1.4, 80]);
    expect(OPEN_LAKE_2_TILAPIA.chase).toBe(OPEN_LAKE_TILAPIA.chase);
    expect(() => tunedSpecies(TILAPIA_SPECIES, OPEN_LAKE_2_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one step up the ladder from Area 12's (ND-19): a 1.2 s cooldown and an 80 px/s patrol, Area 12's other values and chase", () => {
    expect(OPEN_LAKE_2_CARP.id).toBe(CARP_SPECIES.id);
    expect(OPEN_LAKE_2_CARP.tuning).toEqual({ ...OPEN_LAKE_CARP.tuning, cooldown: 1.2, patrolSpeed: 80 });
    expect([OPEN_LAKE_CARP.tuning.cooldown, OPEN_LAKE_CARP.tuning.patrolSpeed]).toEqual([1.3, 75]);
    expect(OPEN_LAKE_2_CARP.tuning.chase).toBe(OPEN_LAKE_CARP.tuning.chase);
  });

  it("plays its cormorant one step up the ladder from Area 11's (ND-19): a 290 px dive to y 384 at 470 px/s, capped at 1.8 s, a 2.4 s cooldown, a 45 px/s drift and a 320 px chase sight along its stretch", () => {
    expect(OPEN_LAKE_2_CORMORANT.id).toBe(CORMORANT_SPECIES.id);
    expect(OPEN_LAKE_2_CORMORANT.rules).toBe(CORMORANT_SPECIES.rules);
    expect(OPEN_LAKE_2_CORMORANT.tuning).toEqual({
      ...DEEP_CANAL_4_CORMORANT.tuning,
      lungeRange: 290,
      lungeSpeed: 470,
      lungeDuration: 1.8,
      cooldown: 2.4,
      patrolSpeed: 45,
      chase: { ...CORMORANT_CHASE, sight: 320 },
    });
    expect(OPEN_LAKE_2_CORMORANT.tuning.chase).toEqual({ sight: 320, leash: 0, speed: 120 });
    expect(OPEN_LAKE_2_CORMORANT.tuning.chase?.sight).toBeGreaterThan(OPEN_LAKE_2_CORMORANT.tuning.lungeRange);
    expect(CORMORANT_STRETCH_Y + OPEN_LAKE_2_CORMORANT.tuning.lungeRange).toBe(CORMORANT_DIVE_Y);
    expect(depthBandAt(CORMORANT_DIVE_Y)).toBe(2);
    expect((Math.PI * OPEN_LAKE_2_CORMORANT.tuning.lungeRange) / OPEN_LAKE_2_CORMORANT.tuning.lungeSpeed).toBeGreaterThan(OPEN_LAKE_2_CORMORANT.tuning.lungeDuration);
    expect(() => tunedSpecies(CORMORANT_SPECIES, { ...OPEN_LAKE_2_CORMORANT.tuning, chase: { ...CORMORANT_CHASE, sight: 290 } })).toThrow(RangeError);
  });

  it("glides its pelican lines one step up from Area 12's (ND-19): a 2.8 s glide, so a 5.3 s cycle, every other value PELICAN_LINE's", () => {
    expect(OPEN_LAKE_2_PELICAN_LINE).toEqual({ ...PELICAN_LINE, glideFor: 2.8 });
    for (const line of lines) {
      expect(line.tuning).toEqual(OPEN_LAKE_2_PELICAN_LINE);
      expect(pelicanLinePeriod(line), line.id).toBeCloseTo(5.3, 9);
    }
    expect(pelicanLinePeriod(lines[0])).toBeLessThan(pelicanLinePeriod((OPEN_LAKE_LAYOUT.pelicanLines ?? [])[0]));
  });

  it('plays the mud turtle with its own values and no chase (ND-12)', () => {
    for (const route of routesOf(zone, MUD_TURTLE_SPECIES.id)) {
      expect(route.species.tuning, route.id).toBe(MUD_TURTLE);
      expect(route.species.tuning.chase, route.id).toBeUndefined();
    }
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = openLake2(seed);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.pelicanLines).toEqual(zone.pelicanLines);
      expect(layout.elements).toEqual(zone.elements);
      expect(layout.mainPath).toEqual(zone.mainPath);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.safeArea).toEqual(zone.safeArea);
      expect(layout.cave).toEqual(zone.cave);
      expect(layout.darkWater).toEqual(zone.darkWater);
    }
  });
});

describe('Area 13 trench (the area shape rule, ND-2)', () => {
  it('builds its stepped floor from six rock walls: both shelves from y 318, both steps from y 678 and the two pit terrace steps from y 920', () => {
    expect(walls).toEqual([
      { x0: 0, x1: 1440, y0: BED_TOP, y1: zone.height },
      { x0: 1440, x1: 1920, y0: STEP_TOP, y1: zone.height },
      { x0: 1920, x1: 2080, y0: TERRACE_TOP, y1: zone.height },
      { x0: 2720, x1: 2880, y0: TERRACE_TOP, y1: zone.height },
      { x0: 2880, x1: 3840, y0: STEP_TOP, y1: zone.height },
      { x0: 3840, x1: zone.width, y0: BED_TOP, y1: zone.height },
    ]);
    expect(BED_TOP).toBe(318);
  });

  it('is a trench, no plain rectangle: 3x1, 1x2, 2x3, 2x2 and 2x1 screens, west to east, 17 screens of water and band 3 its deepest', () => {
    const depths = Array.from({ length: zone.chunks }, (_, column) => depthBandAt(floorUnder((column + 0.5) * SCREEN_W) - 1));
    expect(depths).toEqual(COLUMN_DEPTHS);
    expect(COLUMN_DEPTHS.reduce((sum, depth) => sum + depth, 0)).toBe(17);
    expect(waterScreenCount(zone)).toBe(17);
    expect(deepestWaterBand(OPEN_LAKE_2_LAYOUT)).toBe(3);
  });

  it('cuts one small terrace step on each side of the pit floor, each leaving room to pass over it, and the pit floor between them', () => {
    const [, leftStep, westTerrace, eastTerrace, rightStep] = walls;
    for (const [terrace, step] of [
      [westTerrace, leftStep],
      [eastTerrace, rightStep],
    ] as const) {
      expect(rectGap(terrace, step)).toBe(0);
      expect(terrace.x1 - terrace.x0).toBeLessThan(SCREEN_W / 2);
      expect(depthBandAt(terrace.y0)).toBe(3);
      expect(terrace.y0 - 2 * WORLD_H - 2 * PEBBLES.bodyReach).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
      expect(zone.bedTop - terrace.y0).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
    expect([westTerrace.x1, eastTerrace.x0]).toEqual([PIT_FLOOR.x0, PIT_FLOOR.x1]);
    expect([westTerrace.x0, eastTerrace.x1]).toEqual([PIT.x0, PIT.x1]);
    expect((PIT_FLOOR.x0 + PIT_FLOOR.x1) / 2).toBe(PIT_FLOOR.middle);
  });

  it('puts the Home Spot and its safe area in the middle shallows over the pit (ND-3)', () => {
    expect(zone.safeArea).toEqual({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H });
    expect(depthBandAt(zone.homeSpot.y)).toBe(1);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
    expect(safeArea.x0).toBeGreaterThan(PIT.x0);
    expect(safeArea.x1).toBeLessThan(PIT.x1);
    for (const wall of walls) expect(rectGap(wall, safeArea)).toBeGreaterThan(0);
  });

  it('makes the pit dark water from y 720 to the bed, between the steps (ND-6), and none of band 1 or band 2', () => {
    expect(dark).toEqual({ x0: 1440, x1: 3840, y0: 2 * WORLD_H, y1: zone.bedTop });
    for (let x = PIT.x0; x <= PIT.x1; x += 40) {
      for (let y = 2 * WORLD_H; y <= floorUnder(x); y += 40) expect(inDarkWater({ x, y }, dark), `${x}, ${y}`).toBe(true);
    }
    for (let x = bounds.minX; x <= bounds.maxX; x += 40) {
      for (let y = bounds.minY; y < 2 * WORLD_H; y += 40) expect(inDarkWater({ x, y }, dark), `${x}, ${y}`).toBe(false);
    }
  });

  it('is no left-to-right run (ND-4): west over the shallows to the left shelf beds and back, down onto the left step, east across band 2 over the pit, up onto the right shelf and back, then down into the pit to the exit', () => {
    const path = zone.mainPath;
    expect(path[TURN.home]).toEqual(zone.start);
    expect(path).toHaveLength(TURN.exit + 1);
    const west = path.slice(0, TURN.leftShelfFarEnd + 1);
    for (let i = 1; i < west.length; i++) expect(west[i].x, `west point ${i}`).toBeLessThanOrEqual(west[i - 1].x);
    for (const point of pathSamples(west, 2)) expect(depthBandAt(point.y), `${point.x}, ${point.y}`).toBe(1);
    expect(path[TURN.leftShelfFarEnd].x).toBeLessThanOrEqual(walls[0].x1 - SCREEN_W);
    const stepFloor = path[TURN.stepFloor];
    expect([depthBandAt(stepFloor.y), columnOf(stepFloor.x)]).toEqual([2, 3]);
    const east = path.slice(TURN.stepFloor, TURN.rightShelfFarEnd + 1);
    for (let i = 1; i < east.length; i++) expect(east[i].x, `east point ${TURN.stepFloor + i}`).toBeGreaterThanOrEqual(east[i - 1].x);
    const overPit = pathSamples(path.slice(TURN.stepFloor, TURN.rightStep + 1), 2).filter((point) => point.x >= PIT.x0 && point.x <= PIT.x1);
    expect(overPit.length).toBeGreaterThan(0);
    for (const point of overPit) expect(depthBandAt(point.y), `over the pit at ${point.x}, ${point.y}`).toBe(2);
    const rightShelf = path[TURN.rightShelfFarEnd];
    expect(rightShelf.x).toBeGreaterThan(walls[5].x0);
    expect(depthBandAt(rightShelf.y)).toBe(1);
    const back = path.slice(TURN.rightShelfFarEnd, TURN.intoPit + 1);
    for (let i = 1; i < back.length; i++) expect(back[i].x, `back point ${TURN.rightShelfFarEnd + i}`).toBeLessThanOrEqual(back[i - 1].x);
    const deepest = Math.max(...path.map((point) => point.y));
    expect(path[TURN.exit].y).toBe(deepest);
    expect(depthBandAt(deepest)).toBe(3);
    for (const point of path.slice(TURN.intoPit, TURN.exit + 1)) expect(point.x, `into the pit at ${point.x}`).toBeLessThan(PIT.x1);
  });

  it('keeps the main path in water the body fits, out of every tilapia and carp strike and every turtle snap, and out of the cormorant over columns 6 and 7', () => {
    const [, eastCormorant] = routesOf(zone, CORMORANT_SPECIES.id);
    const samples = pathSamples(zone.mainPath, 2);
    expect(samples.filter((point) => !inBounds(point) || bodyInAnyRock(point, walls))).toEqual([]);
    const clearances = [
      ...strikeRoutes(zone).map(({ id, waypoints, strike }) => ({ id, waypoints, clear: strike })),
      ...snapRoutes(zone).map(({ id, waypoints, reach }) => ({ id, waypoints, clear: reach })),
      { id: eastCormorant.id, waypoints: eastCormorant.waypoints, clear: OPEN_LAKE_2_CORMORANT.tuning.lungeRange },
    ];
    for (const { id, waypoints, clear } of clearances) {
      const nearest = Math.min(...samples.map((point) => routeLoopDistance(point, waypoints)));
      expect(nearest, id).toBeGreaterThan(clear);
    }
  });
});

describe('Area 13 exit (ND-5)', () => {
  it('puts the exit on the pit floor east of the turtles, its gate on the bed, in the dark and out of the safe area', () => {
    expect(exit).toEqual({ x: 2650, y: 940, radius: 40 });
    expect(zone.mainPath[TURN.exit]).toEqual({ x: exit.x, y: exit.y });
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: zone.bedTop });
    expect(exit.x - exit.radius).toBeGreaterThan(PIT_FLOOR.middle);
    expect(exit.x + exit.radius).toBeLessThan(PIT_FLOOR.x1);
    expect(exit.y + exit.radius).toBeLessThan(zone.bedTop);
    expect(depthBandAt(exit.y)).toBe(3);
    expect(inDarkWater(exit, dark)).toBe(true);
    expect(inBounds(exit)).toBe(true);
    expect(inSafeArea(exit, safeArea)).toBe(false);
    expect(rectGap(pointRect(exit), safeArea)).toBeGreaterThan(exit.radius);
  });

  it('keeps the exit clear of every tilapia and carp strike, every turtle snap, every cormorant dive, every pelican sweep and every spot', () => {
    for (const { id, waypoints, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, waypoints), id).toBeGreaterThan(strike + exit.radius);
    for (const { id, waypoints, reach } of snapRoutes(zone)) expect(routeLoopDistance(exit, waypoints), id).toBeGreaterThan(reach + exit.radius);
    for (const route of routesOf(zone, CORMORANT_SPECIES.id)) expect(exit.y - exit.radius, route.id).toBeGreaterThan(CORMORANT_DIVE_Y + route.species.tuning.hitRadius);
    for (const line of lines) expect(rectGap(pelicanLineSweep(line), pointRect(exit)), line.id).toBeGreaterThan(exit.radius + line.tuning.touchReach);
    for (const seed of ALL_SEEDS) {
      for (const spot of openLake2(seed).spots) expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 13 threats (ND-12, ND-16, ND-19)', () => {
  it('glides two lines of three pelicans over the left and right shelves, clear of the safe area, dipping to y 300 above the shelf rock', () => {
    expect(lines.map((line) => [line.x0, line.x1])).toEqual([
      [40, 1420],
      [3860, 4740],
    ]);
    for (const [line, shelf] of [
      [lines[0], walls[0]],
      [lines[1], walls[5]],
    ] as const) {
      const sweep = pelicanLineSweep(line);
      expect(Math.min(sweep.x1, shelf.x1) - Math.max(sweep.x0, shelf.x0), line.id).toBeGreaterThan(SCREEN_W);
      expect(sweep.x0 >= shelf.x0 && sweep.x1 <= shelf.x1, line.id).toBe(true);
      expect(sweep.y1, line.id).toBe(300);
      expect(shelf.y0 - sweep.y1, line.id).toBeLessThanOrEqual(line.tuning.touchReach);
      expect(rectGap(sweep, safeArea), line.id).toBeGreaterThan(line.tuning.touchReach + PEBBLES.bodyReach);
      expect(pelicanNarrowestGap(line), line.id).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
  });

  it('times the two lines out of step: half a cycle apart', () => {
    const [first, second] = lines;
    expect(pelicanLinePeriod(first)).toBe(pelicanLinePeriod(second));
    expect(second.offset - first.offset).toBeCloseTo(pelicanLinePeriod(first) / 2, 9);
  });

  it('floats the two cormorants at y 94, over column 3 and over columns 6 and 7, each diving into band 2 and out of the safe area by its body', () => {
    const cormorants = routesOf(zone, CORMORANT_SPECIES.id);
    expect(cormorants.map((route) => xSpan(route.waypoints))).toEqual([
      { x0: 1800, x1: 1900 },
      { x0: 2880, x1: 3080 },
    ]);
    const [west, east] = cormorants.map((route) => xSpan(route.waypoints));
    expect([columnOf(west.x0), columnOf(west.x1)]).toEqual([3, 3]);
    expect([columnOf(east.x0), columnOf(east.x1)]).toEqual([6, 6]);
    for (const route of cormorants) {
      expect(route.waypoints.map((point) => point.y), route.id).toEqual([CORMORANT_STRETCH_Y, CORMORANT_STRETCH_Y]);
      expect(route.waypoints[0].y, route.id).toBe(bounds.minY);
      for (const point of route.waypoints) expect(rectGap(pointRect(point), safeArea), route.id).toBeGreaterThan(route.species.tuning.bodyRadius);
    }
  });

  it('keeps the two tilapia and six carp in band 2 only, in the water, clear of the rock by their bodies and out of the safe area', () => {
    const routes = [...zone.tilapiaRoutes.map((route) => ({ route, body: OPEN_LAKE_2_TILAPIA.bodyRadius })), ...routesOf(zone, CARP_SPECIES.id).map((route) => ({ route, body: route.species.tuning.bodyRadius }))];
    for (const { route, body } of routes) {
      for (const point of loopSamples(route.waypoints)) {
        expect(depthBandAt(point.y), route.id).toBe(2);
        expect(inBounds(point), route.id).toBe(true);
        expect(bodyInAnyRock(point, walls, { bodyReach: body }), `${route.id} at ${point.x}, ${point.y}`).toBe(false);
        expect(inSafeArea(point, safeArea), route.id).toBe(false);
      }
    }
  });

  it('creeps the two mud turtles on the pit floor in band 3, one in its west half and one in its east half, in the dark and clear of the rock (ND-12)', () => {
    const turtles = routesOf(zone, MUD_TURTLE_SPECIES.id);
    const [west, east] = turtles.map((route) => xSpan(route.waypoints));
    expect(west).toEqual({ x0: 2120, x1: 2340 });
    expect(east).toEqual({ x0: 2400, x1: 2480 });
    expect(west.x0).toBeGreaterThanOrEqual(PIT_FLOOR.x0);
    expect(west.x1).toBeLessThanOrEqual(PIT_FLOOR.middle);
    expect(east.x0).toBeGreaterThanOrEqual(PIT_FLOOR.middle);
    expect(east.x1).toBeLessThanOrEqual(PIT_FLOOR.x1);
    for (const route of turtles) {
      const span = ySpan(route.waypoints);
      expect(span.top, route.id).toBe(span.bottom);
      expect(zone.bedTop - span.bottom, route.id).toBeGreaterThanOrEqual(route.species.tuning.bodyRadius);
      for (const point of loopSamples(route.waypoints)) {
        expect(depthBandAt(point.y), route.id).toBe(3);
        expect(inDarkWater(point, dark), route.id).toBe(true);
        expect(inBounds(point), route.id).toBe(true);
        expect(bodyInAnyRock(point, walls, { bodyReach: route.species.tuning.bodyRadius }), route.id).toBe(false);
      }
    }
  });

  it('uses no heron, garter snake, crayfish or black bass, and has no wind and waves, current or moving hazard (ND-16, ND-19)', () => {
    expect(new Set(zone.predatorRoutes.map((route) => route.species.id))).toEqual(new Set([CARP_SPECIES.id, CORMORANT_SPECIES.id, MUD_TURTLE_SPECIES.id]));
    expect(winds(zone.elements)).toEqual([]);
    expect(zone.currents).toEqual([]);
    expect(zone.movingHazards).toEqual([]);
    expect(zone.hazards).toEqual([]);
  });
});

describe('Area 13 hiding spots by depth band (B5, B6, B10, ND-18)', () => {
  it.each(ALL_SEEDS)('fit their band, sit in the tule, meet the risk ladder against every threat and keep the turn clearance, for seed %i', (seed) => {
    const layout = openLake2(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    const threats = zoneThreats(layout);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('open-lake-2/spot-reeds-'), spot.id).toBe(true);
      expect(spotFitsBand(spot), spot.id).toBe(true);
      expect(coversAt(spot, layout), spot.id).toContain('reeds');
      expect(meetsThreatRiskRule(spot, spot.rarity, threats), spot.id).toBe(true);
      expect(turnDistance(spot, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), spot.id).toBeGreaterThanOrEqual(60);
    }
    for (const spot of layout.spots) expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
  });

  it('has 5 Common, 10 Rare, 3 Epic and 4 Legendary spots, every pool at least its floor and larger than its treasures', () => {
    const spots = rarityCounts(zone.spots);
    expect(spots).toEqual([5, 10, 3, 4]);
    const treasures = rarityCounts(OPEN_LAKE_2_TREASURES);
    expect(treasures).toEqual([4, 7, 2, 3]);
    RARITIES.forEach((rarity, i) => {
      expect(spots[i], rarity).toBeGreaterThanOrEqual(POOL_FLOOR[i]);
      expect(spots[i], rarity).toBeGreaterThan(treasures[i]);
    });
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('puts every spot of the special treasure rarity, Epic, in band 3, the deepest band, with every Legendary spot (issue #215)', () => {
    const special = OPEN_LAKE_2_TREASURES.find((treasure) => treasure.id === OPEN_LAKE_2_SPECIAL_TREASURE_ID);
    expect(special?.rarity).toBe('epic');
    expect(deepestWaterBand(OPEN_LAKE_2_LAYOUT)).toBe(3);
    expect(raritySpotsInDeepestBand(zone.spots, 'epic', deepestWaterBand(OPEN_LAKE_2_LAYOUT))).toBe(true);
    for (const rarity of RARITIES) expect(raritySpotsInDeepestBand(zone.spots, rarity, 3), rarity).toBe(rarity === 'epic' || rarity === 'legendary');
  });

  it('hides the Commons in tule beds on both shelves, standing on the shelf rock in band 1, by the main path', () => {
    const commons = zone.spots.filter((spot) => spot.rarity === 'common');
    const shelves = [walls[0], walls[5]];
    for (const shelf of shelves) expect(commons.some((spot) => spot.x >= shelf.x0 && spot.x <= shelf.x1), `shelf at ${shelf.x0}`).toBe(true);
    for (const spot of commons) {
      expect(depthBandAt(spot.y), spot.id).toBe(1);
      expect(floorUnder(spot.x), spot.id).toBe(BED_TOP);
      expect(shelves.some((shelf) => spot.x >= shelf.x0 && spot.x <= shelf.x1), spot.id).toBe(true);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
    }
  });

  it('hides the Rares in tule beds on both steps, standing on the step rock in band 2, off the main path', () => {
    const rares = zone.spots.filter((spot) => spot.rarity === 'rare');
    for (const step of [walls[1], walls[4]]) expect(rares.some((spot) => spot.x >= step.x0 && spot.x <= step.x1), `step at ${step.x0}`).toBe(true);
    for (const spot of rares) {
      expect(depthBandAt(spot.y), spot.id).toBe(2);
      expect(floorUnder(spot.x), spot.id).toBe(STEP_TOP);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
      const bed = OPEN_LAKE_2_LAYOUT.reedBeds.find((each) => each.columns.includes(spot.x) && each.rows.some((row) => row.y === spot.y));
      expect(bed?.baseY, spot.id).toBe(STEP_TOP);
    }
  });

  it('hides the Epics and Legendaries in tule beds on the pit floor in band 3, each within 200 px of a fading light', () => {
    const deep = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(FADING_LIGHTS.light).toBe(200);
    for (const spot of deep) {
      expect(depthBandAt(spot.y), spot.id).toBe(3);
      expect(inDarkWater(spot, dark), spot.id).toBe(true);
      expect(spot.x >= PIT.x0 && spot.x <= PIT.x1, spot.id).toBe(true);
      expect(nearestLight(spot), spot.id).toBeLessThanOrEqual(FADING_LIGHTS.light);
    }
  });

  it('makes the cave a smooth-stone hollow on the pit floor with no spot in it', () => {
    expect(zone.cave).toEqual({ id: 'open-lake-2/cave', x0: 2090, x1: 2140, y0: 990, y1: zone.bedTop });
    expect(zone.cave.x0).toBeGreaterThan(PIT_FLOOR.x0);
    expect(zone.cave.x1).toBeLessThan(PIT_FLOOR.x1);
    expect(zone.spots.filter((spot) => spot.cover === 'cave')).toEqual([]);
    for (const spot of zone.spots) expect(inRect(spot, zone.cave), spot.id).toBe(false);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = openLake2(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot), spot.id).toBe(true);
      expect(bodyInAnyRock(spot, walls), spot.id).toBe(false);
      expect(inSafeArea(spot, layout.safeArea), spot.id).toBe(false);
      expect(Math.hypot(spot.x - home.x, spot.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
    }
    for (let i = 0; i < layout.spots.length; i++) {
      for (let j = i + 1; j < layout.spots.length; j++) {
        const [a, b] = [layout.spots[i], layout.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 13 treasure (B4; issue #215)', () => {
  const tuning = tripTreasureTuning(OPEN_LAKE_2_AREA_ID);
  const options = { extras: [OPEN_LAKE_2_SPECIAL_TREASURE_ID], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };
  const all = OPEN_LAKE_2_TREASURES.map((treasure) => treasure.id);
  const spotCounts = rarityCounts(zone.spots);

  it('hides its own 4 Common, 7 Rare, 2 Epic and 3 Legendary treasures in catalogue order, the Little mud turtle among them, and shares none', () => {
    expect(OPEN_LAKE_2_LAYOUT.treasures).toBe(OPEN_LAKE_2_TREASURES);
    expect(OPEN_LAKE_2_LAYOUT).not.toHaveProperty('sharedTreasures');
    expect(zone).not.toHaveProperty('sharedTreasures');
    expect(zone.finds.map((find) => find.id)).toEqual(all);
    expect(all).toContain(OPEN_LAKE_2_SPECIAL_TREASURE_ID);
    expect(OPEN_LAKE_2_TREASURES.find((treasure) => treasure.id === OPEN_LAKE_2_SPECIAL_TREASURE_ID)?.rarity).toBe('epic');
  });

  it("never hides Area 12's treasures nor any other area's", () => {
    const lakeIds = OPEN_LAKE_LAYOUT.treasures.map((treasure) => treasure.id);
    for (const id of all) {
      expect(id.startsWith('open-lake/'), id).toBe(true);
      expect(lakeIds, id).not.toContain(id);
    }
  });

  it("gives every treasure its rarity's whole pool: the 5 Common, 10 Rare, 3 Epic or 4 Legendary spots", () => {
    expect(spotCounts).toEqual([5, 10, 3, 4]);
    for (const treasure of OPEN_LAKE_2_TREASURES) {
      const pool = zone.spots.filter((spot) => spot.rarity === treasure.rarity).map((spot) => spot.id);
      expect(pool, treasure.id).toHaveLength(spotCounts[RARITIES.indexOf(treasure.rarity)]);
      expect(zone.finds.find((find) => find.id === treasure.id)?.pool, treasure.id).toEqual(pool);
    }
  });

  it("hides the Little mud turtle in band 3, Area 13's deepest band, on the pit floor", () => {
    const pool = zone.finds.find((find) => find.id === OPEN_LAKE_2_SPECIAL_TREASURE_ID)?.pool;
    const spots = zone.spots.filter((spot) => pool?.includes(spot.id));
    expect(spots).toHaveLength(spotCounts[RARITIES.indexOf('epic')]);
    expect(deepestWaterBand(OPEN_LAKE_2_LAYOUT)).toBe(3);
    for (const spot of spots) {
      expect(depthBandAt(spot.y), spot.id).toBe(3);
      expect(spot.x >= PIT.x0 && spot.x <= PIT.x1, spot.id).toBe(true);
    }
  });

  it('places 200 trips without throwing: the 18 slots, the lost treasures and the Little mud turtle', () => {
    expect(tuning.slots).toBe(18);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(OPEN_LAKE_2_SPECIAL_TREASURE_ID);
      for (const find of fresh) expect(zone.spots.find((spot) => spot.id === find.spotId)?.rarity, find.id).toBe(OPEN_LAKE_2_TREASURES.find((treasure) => treasure.id === find.id)?.rarity);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('leaves the slots its 16 treasures cannot fill empty over 200 fresh trips, as measured', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 2);
    expect(Math.min(...empty)).toBeGreaterThanOrEqual(tuning.slots + 1 - all.length);
  });
});

describe('Area 13 snacks and stranding places (ND-20, ND-21)', () => {
  const mix = zone.mobileSnacks;

  it("meets the later row of the snack ramp: 14 of its 20 snacks mobile, 70%, at least Area 12's share, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(13, OPEN_LAKE_2_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const share = mobileSnackShare(OPEN_LAKE_2_LAYOUT);
    expect(share).toBe(0.7);
    expect(share).toBeGreaterThanOrEqual(mobileSnackShare(OPEN_LAKE_LAYOUT));
    expect(share).toBeGreaterThanOrEqual(mobileSnackShare(DEEP_CANAL_4_LAYOUT));
  });

  it("moves its tadpoles and shrimp as the snack motion rules ask, with Area 12's shrimp rule, and a one-leg axolotl catches every tadpole", () => {
    expect(meetsSnackMotion(OPEN_LAKE_2_LAYOUT)).toBe(true);
    expect(mix?.shrimp).toEqual(OPEN_LAKE_LAYOUT.mobileSnacks?.shrimp);
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
  });

  it('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp', () => {
    const avoid = mobileSnackAvoid(zone);
    const drift = { amplitudeX: 16, amplitudeY: 8, periodX: 6.5, periodY: 5.2 };
    for (const wander of mix?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of mix?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('sits two shrimp homes on the pit terrace steps, one on each, by its fading light', () => {
    const terraces = [walls[2], walls[3]];
    for (const terrace of terraces) {
      const homes = (mix?.homes ?? []).filter((home) => home.points.every((point) => point.x >= terrace.x0 && point.x <= terrace.x1 && point.y < terrace.y0));
      expect(homes, `terrace at ${terrace.x0}`).toHaveLength(1);
      for (const point of homes[0].points) {
        expect(depthBandAt(point.y)).toBe(3);
        expect(nearestLight(point)).toBeLessThanOrEqual(FADING_LIGHTS.light);
      }
    }
  });

  it.each(ALL_SEEDS)('builds every snack start in the water, at least SNACK_HAZARD_CLEARANCE from the rock, with snacks in every screen column, for seed %i', (seed) => {
    const layout = openLake2(seed);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack), snack.id).toBe(true);
      for (const wall of walls) expect(rectGap(wall, pointRect(snack)), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
    for (let column = 0; column < layout.chunks; column++) {
      expect(layout.collectibles.some((snack) => columnOf(snack.x) === column), `column ${column}`).toBe(true);
    }
  });

  it('keeps four stranding places in band 2 over the steps, none in the pit, 80 px from every route, out of the safe area and every pelican sweep, clear of the spots', () => {
    expect(zone.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4].map((n) => `open-lake-2/strand-${n}`));
    for (const place of zone.strandingPlaces) {
      expect(depthBandAt(place.y), place.id).toBe(2);
      expect(floorUnder(place.x), place.id).toBe(STEP_TOP);
      expect(place.x < PIT.x0 || place.x > PIT.x1, place.id).toBe(true);
      expect(inBounds(place), place.id).toBe(true);
      expect(bodyInAnyRock(place, walls), place.id).toBe(false);
      expect(inSafeArea(place, safeArea), place.id).toBe(false);
      for (const line of lines) expect(rectGap(pelicanLineSweep(line), pointRect(place)), place.id).toBeGreaterThan(line.tuning.touchReach);
      for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) expect(routeLoopDistance(place, route.waypoints), `${place.id} to ${route.id}`).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spot of zone.spots) expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
    }
  });
});

describe('Area 13 fading lights (ND-8)', () => {
  it('sets four fading lights in the pit, in the dark: one on each terrace step and two on the pit floor, 240 px apart', () => {
    for (const light of lights) {
      expect(light.type, light.id).toEqual(FADING_LIGHT);
      expect(light.fadingLight.radius, light.id).toBe(FADING_LIGHT_RADIUS);
      expect(inDarkWater(light.fadingLight, dark), light.id).toBe(true);
      expect(depthBandAt(light.fadingLight.y), light.id).toBe(3);
      expect(bodyInAnyRock(light.fadingLight, walls), light.id).toBe(false);
    }
    const [west, floorWest, floorEast, east] = lights.map((light) => light.fadingLight);
    for (const [light, terrace] of [
      [west, walls[2]],
      [east, walls[3]],
    ] as const) {
      expect(light.x > terrace.x0 && light.x < terrace.x1).toBe(true);
      expect(terrace.y0 - light.y).toBeLessThanOrEqual(FADING_LIGHTS.touchReach + light.radius + PEBBLES.bodyReach);
    }
    for (const light of [floorWest, floorEast]) {
      expect(light.x > PIT_FLOOR.x0 && light.x < PIT_FLOOR.x1).toBe(true);
      expect(zone.bedTop - light.y).toBeLessThanOrEqual(FADING_LIGHTS.touchReach + light.radius + PEBBLES.bodyReach + 8);
    }
    expect(Math.hypot(floorEast.x - floorWest.x, floorEast.y - floorWest.y)).toBe(FLOOR_LIGHT_GAP);
  });

  it("lets the axolotl reach at least one light from the Home Spot without entering any turtle's snap reach: both terrace lights", () => {
    expect(snapRoutes(zone).map((snap) => snap.reach)).toEqual([136, 136]);
    expect(lightsReachedOutsideSnaps()).toEqual([LIGHT_IDS[0], LIGHT_IDS[3]]);
  });
});
