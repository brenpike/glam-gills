/**
 * Area 14's layout (issue #213): the twin trenches' shape and rock, its threats, its sharp litter,
 * its drifting islands, its exit, its hiding spots by depth band, its treasure, its snacks, its
 * stranding places and its fading lights. The danger bar is proved in openLake3Danger.test.ts and
 * the fairness proofs in openLake3Fairness.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_3_TREASURES, DEEP_CANAL_4_TREASURES, RARITIES, type Rarity } from './catalogue';
import { waterScreenCount } from './dangerBar';
import { deepestWaterBand, depthBandAt, raritySpotsInDeepestBand, spotFitsBand } from './depthBand';
import { DRIFTING_ISLANDS, driftingIslandLoop, driftingIslands, islandSpanAt } from './driftingIslands';
import { exitGateBase } from './exitGate';
import { FADING_LIGHTS, fadingLights } from './fadingLights';
import { inDarkWater } from './glowPlants';
import { FADING_LIGHT, FADING_LIGHT_RADIUS } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, meetsThreatRiskRule, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples } from './layoutGaps';
import { SHARP_LITTER, SHARP_LITTER_RADIUS, litters } from './litter';
import {
  meetsSnackMotion,
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileSnackShare,
  oneLegCatchesTadpole,
  shrimpHomeClear,
  tadpoleWanderClear,
} from './mobileSnacks';
import { OPEN_LAKE_2_CARP, OPEN_LAKE_2_CORMORANT, OPEN_LAKE_2_LAYOUT, OPEN_LAKE_2_PELICAN_LINE, OPEN_LAKE_2_TILAPIA } from './openLake2Layout';
import {
  OPEN_LAKE_3_AREA_ID,
  OPEN_LAKE_3_CARP,
  OPEN_LAKE_3_CORMORANT,
  OPEN_LAKE_3_EXIT,
  OPEN_LAKE_3_LAYOUT,
  OPEN_LAKE_3_MUD_TURTLE,
  OPEN_LAKE_3_PELICAN_LINE,
  OPEN_LAKE_3_SHARED_TREASURES,
  OPEN_LAKE_3_SPECIAL_TREASURE_ID,
  OPEN_LAKE_3_START,
  OPEN_LAKE_3_TILAPIA,
} from './openLake3Layout';
import { OPEN_LAKE_LAYOUT } from './openLakeLayout';
import { PEBBLES, bodyInAnyRock, type RockWall } from './pebble';
import { pelicanLinePeriod, pelicanLineSweep, pelicanNarrowestGap } from './pelicanLine';
import { placeTreasures } from './placement';
import { CARP_SPECIES, CORMORANT_SPECIES, MUD_TURTLE_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import { CORMORANT_CHASE, FINDS, MUD_TURTLE, TRIP_TREASURES_BY_AREA, tripTreasureTuning } from './tuning';
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
/** Area 14's trip treasure slots (issue #213, Q1): one more than Area 13's 18. */
const TRIP_SLOTS = 19;
const STRANDING_ROUTE_CLEARANCE = 80;
/** Top of the west and east ledges. */
const LEDGE_TOP = 678;
/** Top of each pit terrace step. */
const TERRACE_TOP = 920;
/** Each pit, from its ledge to the ridge, over its terrace step and floor. */
const WEST_PIT = { x0: 960, x1: 1920 };
const EAST_PIT = { x0: 2400, x1: 3360 };
/** Each pit floor, between its terrace step and the ridge. */
const WEST_FLOOR = { x0: 1360, x1: 1920 };
const EAST_FLOOR = { x0: 2400, x1: 2960 };
/** The ridge between the pits. */
const RIDGE = { x0: 1920, x1: 2400 };
/** y of every cormorant's stretch, and the deepest y its 300 px dive reaches: 394, in band 2. */
const CORMORANT_STRETCH_Y = 94;
const CORMORANT_DIVE_Y = 394;
/** Half the exit gate's drawn width, which src/art/areaExitArt.test.ts keeps out of the rock. */
const GATE_HALF_W = 65;
/** Px each piece of sharp litter lies from its Legendary spot (issue #213, Q2 as amended). */
const LITTER_TO_LEGENDARY = { min: 64, max: 115 };
/** Px each piece of sharp litter keeps clear of every spot, light, exit, main path point, stranding place, snack home and turtle stretch end (issue #213, Q2). */
const LITTER_CLEARANCE = 64;
/** Px of drift path each drifting island has (issue #213, Q3). */
const ISLAND_PATH = 1200;
/** Spacing in px of the water grid the light reach proof floods. */
const FLOOD_STEP = 8;
/** The deepest band of each screen column, west to east: the 2x1, 2x3, 1x1, 2x3 and 2x1 segments. */
const COLUMN_DEPTHS = [1, 1, 3, 3, 1, 3, 3, 1, 1];
/** The main path's waypoints, named by the part of the swim each starts or ends. */
const TURN = { home: 0, westShallowsFarEnd: 5, westLedge: 8, backFromLedge: 9, overRidge: 12, intoEastPit: 13, eastShallowsFarEnd: 16, exit: 19 };
const CARP_IDS = [0, 1, 2, 3, 4, 5].map((n) => `carp-${n}`);
const CORMORANT_IDS = ['cormorant-0', 'cormorant-1'];
const TURTLE_IDS = ['mud-turtle-0', 'mud-turtle-1'];
const LINE_IDS = [1, 2].map((n) => `open-lake-3/pelican-line-${n}`);
const LIGHT_IDS = [1, 2, 3, 4].map((n) => `open-lake-3/fading-light-${n}`);
const ISLAND_IDS = [1, 2].map((n) => `open-lake-3/island-${n}`);
const LITTER_IDS = [1, 2, 3, 4].map((n) => `open-lake-3/litter-${n}`);

const zone = buildZone(OPEN_LAKE_3_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const exit = OPEN_LAKE_3_EXIT;
const walls: readonly RockWall[] = zone.rockWalls ?? [];
const lines = zone.pelicanLines ?? [];
const lights = fadingLights(zone.elements);
const islands = driftingIslands(zone.elements);
const litter = litters(zone.hazards);
const dark = zone.darkWater ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
const { safeArea } = zone;
const zonesBySeed = new Map<number, ZoneLayout>([[DEFAULT_ZONE_SEED, zone]]);

/** Area 14 built with `seed`, built once per seed. */
function openLake3(seed: number): ZoneLayout {
  const built = zonesBySeed.get(seed) ?? buildZone(OPEN_LAKE_3_LAYOUT, seed);
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

/** Whether an x is inside a span, edges included. */
function inSpan(x: number, span: { x0: number; x1: number }): boolean {
  return x >= span.x0 && x <= span.x1;
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

/** The deepest band any floor in screen column `column` reaches, sampled every 8 px of x. */
function deepestBandOf(column: number): number {
  const xs = Array.from({ length: SCREEN_W / 8 }, (_, i) => column * SCREEN_W + 4 + i * 8);
  return Math.max(...xs.map((x) => depthBandAt(floorUnder(x) - 1)));
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
    ...layout.tilapiaRoutes.map((route) => ({ id: route.id, waypoints: route.waypoints, strike: OPEN_LAKE_3_TILAPIA.lungeRange })),
    ...routesOf(layout, CARP_SPECIES.id).map((route) => ({ id: route.id, waypoints: route.waypoints, strike: route.species.tuning.lungeRange })),
  ];
}

/** Each mud turtle route with its snap reach: its lungeRange and its hit reach. */
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

/** A piece of litter's centre. */
function litterCentre(piece: (typeof litter)[number]): Point {
  return { x: piece.shape.x, y: piece.shape.y };
}

/** The places each piece of sharp litter keeps LITTER_CLEARANCE px from, by name (issue #213, Q2). */
function litterKeepClear(): [string, Point][] {
  const homes = [...(zone.mobileSnacks?.wanders ?? []), ...(zone.mobileSnacks?.homes ?? [])].flatMap((home) => home.points);
  return [
    ...zone.spots.map((spot): [string, Point] => [spot.id, spot]),
    ...lights.map((light): [string, Point] => [light.id, light.fadingLight]),
    ['exit', exit],
    ...zone.mainPath.map((point, i): [string, Point] => [`main path point ${i}`, point]),
    ...zone.strandingPlaces.map((place): [string, Point] => [place.id, place]),
    ...homes.map((point): [string, Point] => [`snack home at ${point.x}, ${point.y}`, point]),
    ...snapRoutes(zone).flatMap((snap) => snap.waypoints.map((point): [string, Point] => [`${snap.id} end at ${point.x}`, point])),
  ];
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

describe('OPEN_LAKE_3_LAYOUT', () => {
  it('is Area 14 data: 9 screens across, 3 down, depth banded, starting at the Home Spot', () => {
    expect(OPEN_LAKE_3_AREA_ID).toBe('open-lake-3');
    expect(OPEN_LAKE_3_LAYOUT.id).toBe(OPEN_LAKE_3_AREA_ID);
    expect([zone.width, zone.height, zone.bedTop]).toEqual([4320, 1080, 1038]);
    expect([zone.chunks, zone.rows]).toEqual([9, 3]);
    expect(zone.depthBanded).toBe(true);
    expect(OPEN_LAKE_3_LAYOUT.start).toBe(OPEN_LAKE_3_START);
    expect(zone.start).toEqual({ x: 2160, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 2160, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('open-lake-3/cave');
    for (const part of [zone.trajineras, zone.bailingBoats, zone.fishingBoats, zone.dragNets, zone.sideRooms, zone.bankOverhangs]) {
      expect(part).toBeUndefined();
    }
  });

  it('is frozen data, down to each wall, route, pelican line, bed, light, island, piece of litter and mobile snack', () => {
    for (const part of [OPEN_LAKE_3_LAYOUT, OPEN_LAKE_3_TILAPIA, OPEN_LAKE_3_CARP, OPEN_LAKE_3_CARP.tuning, OPEN_LAKE_3_CORMORANT, OPEN_LAKE_3_CORMORANT.tuning]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const part of [OPEN_LAKE_3_CORMORANT.tuning.chase, OPEN_LAKE_3_MUD_TURTLE, OPEN_LAKE_3_MUD_TURTLE.tuning, OPEN_LAKE_3_PELICAN_LINE, OPEN_LAKE_3_EXIT, OPEN_LAKE_3_START]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(Object.isFrozen(OPEN_LAKE_3_SHARED_TREASURES)).toBe(true);
    const { rockWalls, pelicanLines, reedBeds, tilapiaRoutes, predatorRoutes, mobileSnacks, elements, hazards } = OPEN_LAKE_3_LAYOUT;
    for (const part of [
      rockWalls,
      pelicanLines,
      reedBeds,
      tilapiaRoutes,
      predatorRoutes,
      elements,
      hazards,
      OPEN_LAKE_3_LAYOUT.mainPath,
      OPEN_LAKE_3_LAYOUT.strandingPlaces,
      OPEN_LAKE_3_LAYOUT.cave,
      OPEN_LAKE_3_LAYOUT.safeArea,
      OPEN_LAKE_3_LAYOUT.darkWater,
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
      expect(Object.isFrozen(element.fadingLight ?? element.island), element.id).toBe(true);
    }
    for (const piece of hazards) {
      expect(Object.isFrozen(piece), piece.id).toBe(true);
      expect(Object.isFrozen(piece.shape), piece.id).toBe(true);
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
    for (const point of OPEN_LAKE_3_LAYOUT.mainPath) expect(Object.isFrozen(point)).toBe(true);
    for (const place of OPEN_LAKE_3_LAYOUT.strandingPlaces) expect(Object.isFrozen(place), place.id).toBe(true);
  });

  it('has 20 snacks (3 worms, 3 bugs, 4 tadpoles and 10 shrimp), 2 tilapia, 6 carp, 2 cormorants, 2 mud turtles, 2 pelican lines of 3, 4 fading lights, 2 drifting islands, 4 pieces of litter, no wind and no pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = openLake3(seed);
      expect(layout.collectibles).toHaveLength(20);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([3, 3, 4, 10]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1']);
    expect(routesOf(zone, CARP_SPECIES.id).map((route) => [route.id, route.species])).toEqual(CARP_IDS.map((id) => [id, OPEN_LAKE_3_CARP]));
    expect(routesOf(zone, CORMORANT_SPECIES.id).map((route) => [route.id, route.species])).toEqual(CORMORANT_IDS.map((id) => [id, OPEN_LAKE_3_CORMORANT]));
    expect(routesOf(zone, MUD_TURTLE_SPECIES.id).map((route) => [route.id, route.species])).toEqual(TURTLE_IDS.map((id) => [id, OPEN_LAKE_3_MUD_TURTLE]));
    expect(zone.predatorRoutes).toHaveLength(CARP_IDS.length + CORMORANT_IDS.length + TURTLE_IDS.length);
    expect(lines.map((line) => [line.id, line.tuning.count])).toEqual(LINE_IDS.map((id) => [id, 3]));
    expect(lights.map((light) => light.id)).toEqual(LIGHT_IDS);
    expect(islands.map((island) => island.id)).toEqual(ISLAND_IDS);
    expect(zone.elements).toHaveLength(LIGHT_IDS.length + ISLAND_IDS.length);
    expect(litter.map((piece) => piece.id)).toEqual(LITTER_IDS);
    expect(zone.hazards).toHaveLength(LITTER_IDS.length);
    expect(winds(zone.elements)).toEqual([]);
    expect(OPEN_LAKE_3_LAYOUT.padCount).toBe(0);
    expect(OPEN_LAKE_3_LAYOUT.tilapia).toBe(OPEN_LAKE_3_TILAPIA);
  });

  it("plays its tilapia one step up the ladder from Area 13's: a 560 px/s strike reaching 185 px, a 1.25 s cooldown and a 90 px/s patrol, Area 13's warning and chase", () => {
    expect(OPEN_LAKE_3_TILAPIA).toEqual({ ...OPEN_LAKE_2_TILAPIA, lungeSpeed: 560, lungeRange: 185, cooldown: 1.25, patrolSpeed: 90 });
    expect([OPEN_LAKE_2_TILAPIA.lungeSpeed, OPEN_LAKE_2_TILAPIA.lungeRange, OPEN_LAKE_2_TILAPIA.cooldown, OPEN_LAKE_2_TILAPIA.patrolSpeed]).toEqual([540, 180, 1.3, 85]);
    expect(OPEN_LAKE_3_TILAPIA.chase).toBe(OPEN_LAKE_2_TILAPIA.chase);
    expect(() => tunedSpecies(TILAPIA_SPECIES, OPEN_LAKE_3_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one step up the ladder from Area 13's: a 1.15 s cooldown and an 85 px/s patrol, Area 13's other values and chase", () => {
    expect(OPEN_LAKE_3_CARP.id).toBe(CARP_SPECIES.id);
    expect(OPEN_LAKE_3_CARP.tuning).toEqual({ ...OPEN_LAKE_2_CARP.tuning, cooldown: 1.15, patrolSpeed: 85 });
    expect([OPEN_LAKE_2_CARP.tuning.cooldown, OPEN_LAKE_2_CARP.tuning.patrolSpeed]).toEqual([1.2, 80]);
    expect(OPEN_LAKE_3_CARP.tuning.chase).toBe(OPEN_LAKE_2_CARP.tuning.chase);
  });

  it("plays its cormorant one step up the ladder from Area 13's: a 300 px dive to y 394 at 490 px/s, a 2.3 s cooldown, a 50 px/s drift and a 330 px chase sight along its stretch", () => {
    expect(OPEN_LAKE_3_CORMORANT.id).toBe(CORMORANT_SPECIES.id);
    expect(OPEN_LAKE_3_CORMORANT.rules).toBe(CORMORANT_SPECIES.rules);
    expect(OPEN_LAKE_3_CORMORANT.tuning).toEqual({
      ...OPEN_LAKE_2_CORMORANT.tuning,
      lungeRange: 300,
      lungeSpeed: 490,
      cooldown: 2.3,
      patrolSpeed: 50,
      chase: { ...CORMORANT_CHASE, sight: 330 },
    });
    expect(OPEN_LAKE_3_CORMORANT.tuning.lungeDuration).toBe(1.8);
    expect(OPEN_LAKE_3_CORMORANT.tuning.chase?.sight).toBeGreaterThan(OPEN_LAKE_3_CORMORANT.tuning.lungeRange);
    expect(CORMORANT_STRETCH_Y + OPEN_LAKE_3_CORMORANT.tuning.lungeRange).toBe(CORMORANT_DIVE_Y);
    expect(depthBandAt(CORMORANT_DIVE_Y)).toBe(2);
    expect((Math.PI * OPEN_LAKE_3_CORMORANT.tuning.lungeRange) / OPEN_LAKE_3_CORMORANT.tuning.lungeSpeed).toBeGreaterThan(OPEN_LAKE_3_CORMORANT.tuning.lungeDuration);
  });

  it("glides its pelican lines one step up from Area 13's: a 2.6 s glide, so a 5.1 s cycle, every other value Area 13's", () => {
    expect(OPEN_LAKE_3_PELICAN_LINE).toEqual({ ...OPEN_LAKE_2_PELICAN_LINE, glideFor: 2.6 });
    for (const line of lines) {
      expect(line.tuning).toEqual(OPEN_LAKE_3_PELICAN_LINE);
      expect(pelicanLinePeriod(line), line.id).toBeCloseTo(5.1, 9);
    }
    expect(pelicanLinePeriod(lines[0])).toBeLessThan(pelicanLinePeriod((OPEN_LAKE_2_LAYOUT.pelicanLines ?? [])[0]));
  });

  it("plays its mud turtles one step up from Area 13's: a 22 px/s crawl and a 2.3 s cooldown, every other MUD_TURTLE value, built never to chase", () => {
    expect(OPEN_LAKE_3_MUD_TURTLE.id).toBe(MUD_TURTLE_SPECIES.id);
    expect(OPEN_LAKE_3_MUD_TURTLE.rules).toBe(MUD_TURTLE_SPECIES.rules);
    expect(OPEN_LAKE_3_MUD_TURTLE.tuning).toEqual({ ...MUD_TURTLE, patrolSpeed: 22, cooldown: 2.3 });
    expect([MUD_TURTLE.patrolSpeed, MUD_TURTLE.cooldown]).toEqual([20, 2.5]);
    for (const route of routesOf(zone, MUD_TURTLE_SPECIES.id)) expect(route.species.tuning.chase, route.id).toBeUndefined();
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = openLake3(seed);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.pelicanLines).toEqual(zone.pelicanLines);
      expect(layout.elements).toEqual(zone.elements);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.mainPath).toEqual(zone.mainPath);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.safeArea).toEqual(zone.safeArea);
      expect(layout.cave).toEqual(zone.cave);
      expect(layout.darkWater).toEqual(zone.darkWater);
    }
  });
});

describe('Area 14 twin trenches (the area shape rule)', () => {
  it('builds its stepped floor from seven rock walls: both shallows floors and the ridge from y 318, both ledges from y 678 and both terrace steps from y 920', () => {
    expect(walls).toEqual([
      { x0: 0, x1: 960, y0: BED_TOP, y1: zone.height },
      { x0: 960, x1: 1200, y0: LEDGE_TOP, y1: zone.height },
      { x0: 1200, x1: 1360, y0: TERRACE_TOP, y1: zone.height },
      { x0: RIDGE.x0, x1: RIDGE.x1, y0: BED_TOP, y1: zone.height },
      { x0: 2960, x1: 3040, y0: TERRACE_TOP, y1: zone.height },
      { x0: 3040, x1: 3360, y0: LEDGE_TOP, y1: zone.height },
      { x0: 3360, x1: zone.width, y0: BED_TOP, y1: zone.height },
    ]);
    expect(BED_TOP).toBe(318);
  });

  it('is twin trenches, no plain rectangle: 2x1, 2x3, a 1x1 ridge, 2x3 and 2x1 screens, west to east, 17 screens of water and band 3 its deepest', () => {
    const depths = Array.from({ length: zone.chunks }, (_, column) => deepestBandOf(column));
    expect(depths).toEqual(COLUMN_DEPTHS);
    expect(COLUMN_DEPTHS.reduce((sum, depth) => sum + depth, 0)).toBe(17);
    expect(waterScreenCount(zone)).toBe(17);
    expect(deepestWaterBand(OPEN_LAKE_3_LAYOUT)).toBe(3);
  });

  it('steps each pit down on its outer side, shallows to ledge to terrace step to floor, and makes it sheer on the ridge side', () => {
    const westSteps = [walls[0], walls[1], walls[2]];
    const eastSteps = [walls[6], walls[5], walls[4]];
    for (const steps of [westSteps, eastSteps]) {
      expect(steps.map((wall) => wall.y0)).toEqual([BED_TOP, LEDGE_TOP, TERRACE_TOP]);
      for (let i = 1; i < steps.length; i++) expect(rectGap(steps[i - 1], steps[i])).toBe(0);
    }
    expect([walls[2].x1, walls[4].x0]).toEqual([WEST_FLOOR.x0, EAST_FLOOR.x1]);
    expect([walls[0].x1, walls[6].x0]).toEqual([WEST_PIT.x0, EAST_PIT.x1]);
    expect([WEST_FLOOR.x1, EAST_FLOOR.x0]).toEqual([RIDGE.x0, RIDGE.x1]);
    for (const x of [RIDGE.x0 - 1, RIDGE.x1 + 1]) expect(floorUnder(x), `the pit floor at ${x}`).toBe(zone.bedTop);
    for (const x of [RIDGE.x0, RIDGE.x1]) expect(floorUnder(x), `the ridge at ${x}`).toBe(BED_TOP);
    for (const terrace of [walls[2], walls[4]]) {
      expect(terrace.x1 - terrace.x0).toBeLessThan(SCREEN_W / 2);
      expect(depthBandAt(terrace.y0)).toBe(3);
      expect(terrace.y0 - 2 * WORLD_H - 2 * PEBBLES.bodyReach).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
      expect(zone.bedTop - terrace.y0).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
  });

  it('puts the Home Spot and its safe area on the ridge between the pits, from the surface to y 360', () => {
    expect(zone.safeArea).toEqual({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H });
    expect(depthBandAt(zone.homeSpot.y)).toBe(1);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
    expect(safeArea.x0).toBeGreaterThan(RIDGE.x0);
    expect(safeArea.x1).toBeLessThan(RIDGE.x1);
    expect(bodyInAnyRock(zone.homeSpot, walls)).toBe(false);
  });

  it('makes both pits dark water from y 720 to the bed, ledge to ledge, and none of band 1 or band 2', () => {
    expect(dark).toEqual({ x0: WEST_PIT.x0, x1: EAST_PIT.x1, y0: 2 * WORLD_H, y1: zone.bedTop });
    expect(dark.x1 - dark.x0).toBe(2400);
    expect(dark.y1 - dark.y0).toBe(318);
    for (const pit of [WEST_PIT, EAST_PIT]) {
      for (let x = pit.x0; x <= pit.x1; x += 40) {
        for (let y = 2 * WORLD_H; y <= floorUnder(x); y += 40) expect(inDarkWater({ x, y }, dark), `${x}, ${y}`).toBe(true);
      }
    }
    for (let x = bounds.minX; x <= bounds.maxX; x += 40) {
      for (let y = bounds.minY; y < 2 * WORLD_H; y += 40) expect(inDarkWater({ x, y }, dark), `${x}, ${y}`).toBe(false);
    }
  });

  it('is no left-to-right run: west to the west shallows beds and back, down to the west ledge, back over the ridge, east to the east shallows beds and back, then down into the east pit to the exit', () => {
    const path = zone.mainPath;
    expect(path[TURN.home]).toEqual(zone.start);
    expect(path).toHaveLength(TURN.exit + 1);
    const west = path.slice(TURN.home, TURN.westShallowsFarEnd + 1);
    for (let i = 1; i < west.length; i++) expect(west[i].x, `west point ${i}`).toBeLessThanOrEqual(west[i - 1].x);
    const westFarEnd = path[TURN.westShallowsFarEnd];
    expect([depthBandAt(westFarEnd.y), floorUnder(westFarEnd.x)]).toEqual([1, BED_TOP]);
    expect(westFarEnd.x).toBeLessThan(walls[0].x1);
    const ledge = path[TURN.westLedge];
    expect([depthBandAt(ledge.y), floorUnder(ledge.x)]).toEqual([2, LEDGE_TOP]);
    const back = path.slice(TURN.backFromLedge, TURN.overRidge + 1);
    for (let i = 1; i < back.length; i++) expect(back[i].x, `back point ${TURN.backFromLedge + i}`).toBeGreaterThanOrEqual(back[i - 1].x);
    const overRidge = pathSamples(path.slice(0, TURN.overRidge + 1), 2).filter((point) => inSpan(point.x, RIDGE));
    for (const point of overRidge) expect(depthBandAt(point.y), `over the ridge at ${point.x}, ${point.y}`).toBe(1);
    const east = path.slice(TURN.overRidge, TURN.eastShallowsFarEnd + 1);
    for (let i = 1; i < east.length; i++) expect(east[i].x, `east point ${TURN.overRidge + i}`).toBeGreaterThanOrEqual(east[i - 1].x);
    const eastFarEnd = path[TURN.eastShallowsFarEnd];
    expect([depthBandAt(eastFarEnd.y), floorUnder(eastFarEnd.x)]).toEqual([1, BED_TOP]);
    expect(eastFarEnd.x).toBeGreaterThan(walls[6].x0);
    const home = path.slice(TURN.eastShallowsFarEnd, TURN.exit + 1);
    for (let i = 1; i < home.length; i++) expect(home[i].x, `back point ${TURN.eastShallowsFarEnd + i}`).toBeLessThanOrEqual(home[i - 1].x);
    for (const point of pathSamples(path.slice(TURN.intoEastPit), 2)) expect(point.x, `east of the ridge at ${point.x}`).toBeGreaterThan(RIDGE.x1);
    const deepest = Math.max(...path.map((point) => point.y));
    expect(path[TURN.exit].y).toBe(deepest);
    expect(depthBandAt(deepest)).toBe(3);
  });

  it('keeps the main path in water the body fits, out of every tilapia and carp strike, every turtle snap and every cormorant dive, and clear of the litter', () => {
    const samples = pathSamples(zone.mainPath, 2);
    expect(samples.filter((point) => !inBounds(point) || bodyInAnyRock(point, walls))).toEqual([]);
    const clearances = [
      ...strikeRoutes(zone).map(({ id, waypoints, strike }) => ({ id, waypoints, clear: strike })),
      ...snapRoutes(zone).map(({ id, waypoints, reach }) => ({ id, waypoints, clear: reach })),
      ...routesOf(zone, CORMORANT_SPECIES.id).map((route) => ({ id: route.id, waypoints: route.waypoints, clear: route.species.tuning.lungeRange })),
    ];
    for (const { id, waypoints, clear } of clearances) {
      const nearest = Math.min(...samples.map((point) => routeLoopDistance(point, waypoints)));
      expect(nearest, id).toBeGreaterThan(clear);
    }
    for (const piece of litter) {
      const nearest = Math.min(...samples.map((point) => Math.hypot(point.x - piece.shape.x, point.y - piece.shape.y)));
      expect(nearest, piece.id).toBeGreaterThanOrEqual(LITTER_CLEARANCE);
      expect(nearest, piece.id).toBeGreaterThan(SHARP_LITTER_RADIUS + SHARP_LITTER.reach);
    }
  });
});

describe('Area 14 exit', () => {
  it('puts the exit on the east pit floor east of its turtle, its gate on the bed and clear of the rock by its half-width, in the dark and out of the safe area', () => {
    expect(exit).toEqual({ x: 2880, y: 940, radius: 40 });
    expect(zone.mainPath[TURN.exit]).toEqual({ x: exit.x, y: exit.y });
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: zone.bedTop });
    expect(exit.x - GATE_HALF_W).toBeGreaterThan(EAST_FLOOR.x0);
    expect(exit.x + GATE_HALF_W).toBeLessThan(EAST_FLOOR.x1);
    expect(exit.x).toBeGreaterThan(xSpan(routesOf(zone, MUD_TURTLE_SPECIES.id)[1].waypoints).x1);
    expect(exit.y + exit.radius).toBeLessThan(zone.bedTop);
    expect(depthBandAt(exit.y)).toBe(3);
    expect(inDarkWater(exit, dark)).toBe(true);
    expect(inBounds(exit)).toBe(true);
    expect(inSafeArea(exit, safeArea)).toBe(false);
    expect(rectGap(pointRect(exit), safeArea)).toBeGreaterThan(exit.radius);
  });

  it('keeps the exit clear of every tilapia and carp strike, every turtle snap, every cormorant dive, every pelican sweep, every spot and the litter', () => {
    for (const { id, waypoints, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, waypoints), id).toBeGreaterThan(strike + exit.radius);
    for (const { id, waypoints, reach } of snapRoutes(zone)) expect(routeLoopDistance(exit, waypoints), id).toBeGreaterThan(reach + exit.radius);
    for (const route of routesOf(zone, CORMORANT_SPECIES.id)) expect(exit.y - exit.radius, route.id).toBeGreaterThan(CORMORANT_DIVE_Y + route.species.tuning.hitRadius);
    for (const line of lines) expect(rectGap(pelicanLineSweep(line), pointRect(exit)), line.id).toBeGreaterThan(exit.radius + line.tuning.touchReach);
    for (const piece of litter) expect(Math.hypot(piece.shape.x - exit.x, piece.shape.y - exit.y), piece.id).toBeGreaterThanOrEqual(LITTER_CLEARANCE);
    for (const seed of ALL_SEEDS) {
      for (const spot of openLake3(seed).spots) expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 14 threats', () => {
  it('glides one line of three pelicans over the west shallows and pit and one over the east ledge and shallows, each covering its shallows, clear of the safe area, dipping to y 300 above the shallows rock', () => {
    expect(lines.map((line) => [line.x0, line.x1])).toEqual([
      [40, 1820],
      [3080, 4280],
    ]);
    for (const [line, shallows] of [
      [lines[0], walls[0]],
      [lines[1], walls[6]],
    ] as const) {
      const sweep = pelicanLineSweep(line);
      expect(sweep.x0 <= Math.max(shallows.x0, bounds.minX) && sweep.x1 >= Math.min(shallows.x1, bounds.maxX), line.id).toBe(true);
      expect(sweep.y1, line.id).toBe(300);
      expect(shallows.y0 - sweep.y1, line.id).toBeLessThanOrEqual(line.tuning.touchReach);
      expect(rectGap(sweep, safeArea), line.id).toBeGreaterThan(line.tuning.touchReach + PEBBLES.bodyReach);
      expect(pelicanNarrowestGap(line), line.id).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
    expect(inSpan(lines[0].x1, WEST_PIT)).toBe(true);
    expect(inSpan(lines[1].x0, EAST_PIT)).toBe(true);
  });

  it('times the two lines out of step: half a cycle apart', () => {
    const [first, second] = lines;
    expect(pelicanLinePeriod(first)).toBe(pelicanLinePeriod(second));
    expect(second.offset - first.offset).toBeCloseTo(pelicanLinePeriod(first) / 2, 9);
  });

  it('floats one cormorant at y 94 over each pit, each diving into band 2 and out of the safe area by its body', () => {
    const cormorants = routesOf(zone, CORMORANT_SPECIES.id);
    expect(cormorants.map((route) => xSpan(route.waypoints))).toEqual([
      { x0: 1300, x1: 1600 },
      { x0: 2655, x1: 2750 },
    ]);
    const [west, east] = cormorants.map((route) => xSpan(route.waypoints));
    expect(inSpan(west.x0, WEST_PIT) && inSpan(west.x1, WEST_PIT)).toBe(true);
    expect(inSpan(east.x0, EAST_PIT) && inSpan(east.x1, EAST_PIT)).toBe(true);
    for (const route of cormorants) {
      expect(route.waypoints.map((point) => point.y), route.id).toEqual([CORMORANT_STRETCH_Y, CORMORANT_STRETCH_Y]);
      expect(route.waypoints[0].y, route.id).toBe(bounds.minY);
      for (const point of route.waypoints) {
        expect(rectGap(pointRect(point), safeArea), route.id).toBeGreaterThan(route.species.tuning.bodyRadius);
        expect(floorUnder(point.x), route.id).toBeGreaterThan(CORMORANT_DIVE_Y);
      }
    }
  });

  it('keeps the two tilapia and six carp in band 2 only, in the water, clear of the rock by their bodies and out of the safe area', () => {
    const routes = [...zone.tilapiaRoutes.map((route) => ({ route, body: OPEN_LAKE_3_TILAPIA.bodyRadius })), ...routesOf(zone, CARP_SPECIES.id).map((route) => ({ route, body: route.species.tuning.bodyRadius }))];
    for (const { route, body } of routes) {
      for (const point of loopSamples(route.waypoints)) {
        expect(depthBandAt(point.y), route.id).toBe(2);
        expect(inBounds(point), route.id).toBe(true);
        expect(bodyInAnyRock(point, walls, { bodyReach: body }), `${route.id} at ${point.x}, ${point.y}`).toBe(false);
        expect(inSafeArea(point, safeArea), route.id).toBe(false);
      }
    }
  });

  it('creeps one mud turtle on each pit floor in band 3, in the dark and clear of the rock', () => {
    const turtles = routesOf(zone, MUD_TURTLE_SPECIES.id);
    const [west, east] = turtles.map((route) => xSpan(route.waypoints));
    expect(west).toEqual({ x0: 1560, x1: 1730 });
    expect(east).toEqual({ x0: 2520, x1: 2700 });
    expect(inSpan(west.x0, WEST_FLOOR) && inSpan(west.x1, WEST_FLOOR)).toBe(true);
    expect(inSpan(east.x0, EAST_FLOOR) && inSpan(east.x1, EAST_FLOOR)).toBe(true);
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

  it('uses no heron, garter snake, crayfish or black bass, and has no wind and waves, current or moving hazard; its only fixed hazard is the sharp litter', () => {
    expect(new Set(zone.predatorRoutes.map((route) => route.species.id))).toEqual(new Set([CARP_SPECIES.id, CORMORANT_SPECIES.id, MUD_TURTLE_SPECIES.id]));
    expect(winds(zone.elements)).toEqual([]);
    expect(zone.currents).toEqual([]);
    expect(zone.movingHazards).toEqual([]);
    expect(zone.hazards.map((hazard) => hazard.type)).toEqual(LITTER_IDS.map(() => SHARP_LITTER));
  });
});

describe('Area 14 sharp litter (issue #213, Q2)', () => {
  it('lies a can and a bottle on each pit floor in band 3, in the dark, touching the bed and clear of the rock, and none outside the pits', () => {
    expect(litter.map((piece) => [piece.id, piece.litter, piece.shape.x])).toEqual([
      [LITTER_IDS[0], 'can', 1496],
      [LITTER_IDS[1], 'bottle', 1794],
      [LITTER_IDS[2], 'can', 2456],
      [LITTER_IDS[3], 'bottle', 2764],
    ]);
    for (const [floor, pieces] of [
      [WEST_FLOOR, litter.slice(0, 2)],
      [EAST_FLOOR, litter.slice(2)],
    ] as const) {
      expect(pieces.map((piece) => piece.litter).sort()).toEqual(['bottle', 'can']);
      for (const piece of pieces) expect(inSpan(piece.shape.x, floor), piece.id).toBe(true);
    }
    for (const piece of litter) {
      const centre = litterCentre(piece);
      expect(piece.shape.r, piece.id).toBe(SHARP_LITTER_RADIUS);
      expect(floorUnder(centre.x), piece.id).toBe(zone.bedTop);
      expect(zone.bedTop - (centre.y + piece.shape.r), piece.id).toBeGreaterThanOrEqual(0);
      expect(zone.bedTop - (centre.y + piece.shape.r), piece.id).toBeLessThanOrEqual(2);
      expect(depthBandAt(centre.y), piece.id).toBe(3);
      expect(inDarkWater(centre, dark), piece.id).toBe(true);
      expect(bodyInAnyRock(centre, walls, { bodyReach: piece.shape.r }), piece.id).toBe(false);
      expect(inSpan(centre.x, WEST_PIT) || inSpan(centre.x, EAST_PIT), piece.id).toBe(true);
    }
  });

  it('lies each piece 64 to 115 px from a Legendary spot, by the best treasure', () => {
    const legendaries = zone.spots.filter((spot) => spot.rarity === 'legendary');
    for (const piece of litter) {
      const nearest = Math.min(...legendaries.map((spot) => Math.hypot(spot.x - piece.shape.x, spot.y - piece.shape.y)));
      expect(nearest, piece.id).toBeGreaterThanOrEqual(LITTER_TO_LEGENDARY.min);
      expect(nearest, piece.id).toBeLessThanOrEqual(LITTER_TO_LEGENDARY.max);
    }
  });

  it('keeps each piece at least 64 px from every spot, light, the exit, every main path point, stranding place, snack home and turtle stretch end', () => {
    for (const piece of litter) {
      for (const [name, point] of litterKeepClear()) expect(Math.hypot(point.x - piece.shape.x, point.y - piece.shape.y), `${piece.id} to ${name}`).toBeGreaterThanOrEqual(LITTER_CLEARANCE);
    }
  });

  it('crosses no turtle stretch: each piece lies outside every turtle stretch and its body', () => {
    for (const piece of litter) {
      for (const route of routesOf(zone, MUD_TURTLE_SPECIES.id)) {
        const span = xSpan(route.waypoints);
        const reach = piece.shape.r + route.species.tuning.bodyRadius;
        expect(piece.shape.x < span.x0 - reach || piece.shape.x > span.x1 + reach, `${piece.id} and ${route.id}`).toBe(true);
      }
    }
  });

  it('counts each piece as a hiding-risk threat with its 18 px touch reach', () => {
    const shapes = zoneThreats(zone).filter((threat) => threat.kind === 'shape');
    expect(shapes.map((threat) => threat.strike)).toEqual(LITTER_IDS.map(() => SHARP_LITTER.reach));
    expect(SHARP_LITTER.reach).toBe(18);
    expect(SHARP_LITTER.costsLeg).toBe(true);
  });
});

describe('Area 14 drifting islands (issue #213, Q3)', () => {
  it('floats one 240 px island at 16 px/s under each pelican line, its 1200 px path inside the line span and the area', () => {
    expect(DRIFTING_ISLANDS).toEqual({ width: 240, speed: 16 });
    expect(islands.map((island) => island.island)).toEqual([
      { x0: 480, x1: 1680, direction: 'right' },
      { x0: 3080, x1: 4280, direction: 'left' },
    ]);
    islands.forEach((island, i) => {
      const line = lines[i];
      const { x0, x1 } = island.island;
      expect(x1 - x0, island.id).toBe(ISLAND_PATH);
      expect(x0 >= line.x0 && x1 <= line.x1, `${island.id} under ${line.id}`).toBe(true);
      expect(x0 >= bounds.minX && x1 <= bounds.maxX, island.id).toBe(true);
      expect(driftingIslandLoop(island), island.id).toBe((2 * (ISLAND_PATH - DRIFTING_ISLANDS.width)) / DRIFTING_ISLANDS.speed);
    });
  });

  it('drifts the two islands out of step: at time 0 the first sets off from its west end as the second is halfway along its path', () => {
    const [first, second] = islands;
    expect([first.offset, second.offset]).toEqual([0, 30]);
    expect(islandSpanAt(first, 0)).toEqual({ x0: 480, x1: 720 });
    expect(islandSpanAt(second, 0)).toEqual({ x0: 3560, x1: 3800 });
  });

  it('keeps every island inside its path and its line span at every second of its drift', () => {
    islands.forEach((island, i) => {
      const line = lines[i];
      for (let t = 0; t <= driftingIslandLoop(island); t++) {
        const span = islandSpanAt(island, t);
        expect(span.x1 - span.x0, `${island.id} at ${t} s`).toBe(DRIFTING_ISLANDS.width);
        expect(span.x0 >= Math.max(island.island.x0, line.x0) && span.x1 <= Math.min(island.island.x1, line.x1), `${island.id} at ${t} s`).toBe(true);
      }
    });
  });
});

describe('Area 14 hiding spots by depth band', () => {
  it.each(ALL_SEEDS)('fit their band, sit in the tule, meet the risk ladder against every threat, the litter included, and keep the turn clearance, for seed %i', (seed) => {
    const layout = openLake3(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    const threats = zoneThreats(layout);
    expect(threats.filter((threat) => threat.kind === 'shape')).toHaveLength(LITTER_IDS.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('open-lake-3/spot-reeds-'), spot.id).toBe(true);
      expect(spotFitsBand(spot), spot.id).toBe(true);
      expect(coversAt(spot, layout), spot.id).toContain('reeds');
      expect(meetsThreatRiskRule(spot, spot.rarity, threats), spot.id).toBe(true);
      expect(turnDistance(spot, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), spot.id).toBeGreaterThanOrEqual(60);
    }
    for (const spot of layout.spots) expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
  });

  it('has 6 Common, 8 Rare, 4 Epic and 5 Legendary spots, every pool larger than its treasures', () => {
    const spots = rarityCounts(zone.spots);
    expect(spots).toEqual([6, 8, 4, 5]);
    const treasures = rarityCounts(OPEN_LAKE_3_SHARED_TREASURES);
    expect(treasures).toEqual([4, 4, 2, 3]);
    RARITIES.forEach((rarity, i) => expect(spots[i], rarity).toBeGreaterThan(treasures[i]));
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('puts every spot of the special treasure rarity, Legendary, in band 3, the deepest band, and the deepest spot is Legendary', () => {
    const special = OPEN_LAKE_3_SHARED_TREASURES.find((treasure) => treasure.id === OPEN_LAKE_3_SPECIAL_TREASURE_ID);
    expect(special?.rarity).toBe('legendary');
    expect(deepestWaterBand(OPEN_LAKE_3_LAYOUT)).toBe(3);
    expect(raritySpotsInDeepestBand(zone.spots, 'legendary', deepestWaterBand(OPEN_LAKE_3_LAYOUT))).toBe(true);
    for (const rarity of ['common', 'rare', 'epic'] as const) expect(raritySpotsInDeepestBand(zone.spots, rarity, 3), rarity).toBe(rarity === 'epic');
    const deepestY = Math.max(...zone.spots.map((spot) => spot.y));
    const deepest = zone.spots.filter((spot) => spot.y === deepestY);
    expect(deepest.map((spot) => [spot.rarity, spot.x, spot.y])).toEqual([['legendary', 2610, 975]]);
  });

  it('hides three Commons in tule beds on each shallows floor, standing on the shallows rock in band 1, by the main path', () => {
    const commons = zone.spots.filter((spot) => spot.rarity === 'common');
    for (const shallows of [walls[0], walls[6]]) expect(commons.filter((spot) => inSpan(spot.x, shallows)), `shallows at ${shallows.x0}`).toHaveLength(3);
    for (const spot of commons) {
      expect(depthBandAt(spot.y), spot.id).toBe(1);
      expect(floorUnder(spot.x), spot.id).toBe(BED_TOP);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
    }
  });

  it('hides four Rares in tule beds on each ledge, standing on the ledge rock in band 2, off the main path', () => {
    const rares = zone.spots.filter((spot) => spot.rarity === 'rare');
    for (const ledge of [walls[1], walls[5]]) expect(rares.filter((spot) => inSpan(spot.x, ledge)), `ledge at ${ledge.x0}`).toHaveLength(4);
    for (const spot of rares) {
      expect(depthBandAt(spot.y), spot.id).toBe(2);
      expect(floorUnder(spot.x), spot.id).toBe(LEDGE_TOP);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
      const bed = OPEN_LAKE_3_LAYOUT.reedBeds.find((each) => each.columns.includes(spot.x) && each.rows.some((row) => row.y === spot.y));
      expect(bed?.baseY, spot.id).toBe(LEDGE_TOP);
    }
  });

  it('hides two Epics in each pit and the five Legendaries on the pit floors, in band 3, each within 200 px of a fading light', () => {
    const deep = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(FADING_LIGHTS.light).toBe(200);
    for (const [pit, counts] of [
      [WEST_PIT, [2, 2]],
      [EAST_PIT, [2, 3]],
    ] as const) {
      const inPit = deep.filter((spot) => inSpan(spot.x, pit));
      expect([inPit.filter((spot) => spot.rarity === 'epic').length, inPit.filter((spot) => spot.rarity === 'legendary').length], `pit at ${pit.x0}`).toEqual(counts);
    }
    for (const spot of deep) {
      expect(depthBandAt(spot.y), spot.id).toBe(3);
      expect(inDarkWater(spot, dark), spot.id).toBe(true);
      expect(nearestLight(spot), spot.id).toBeLessThanOrEqual(FADING_LIGHTS.light);
    }
    for (const spot of deep.filter((each) => each.rarity === 'legendary')) {
      expect(inSpan(spot.x, WEST_FLOOR) || inSpan(spot.x, EAST_FLOOR), spot.id).toBe(true);
    }
  });

  it('makes the cave a smooth-stone hollow on the west pit floor with no spot in it', () => {
    expect(zone.cave).toEqual({ id: 'open-lake-3/cave', x0: 1840, x1: 1890, y0: 990, y1: zone.bedTop });
    expect(zone.cave.x0).toBeGreaterThan(WEST_FLOOR.x0);
    expect(zone.cave.x1).toBeLessThan(WEST_FLOOR.x1);
    expect(zone.spots.filter((spot) => spot.cover === 'cave')).toEqual([]);
    for (const spot of zone.spots) expect(inRect(spot, zone.cave), spot.id).toBe(false);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = openLake3(seed);
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

describe('Area 14 treasure (B4; issue #213, Q1)', () => {
  const tuning = tripTreasureTuning(OPEN_LAKE_3_AREA_ID, { ...TRIP_TREASURES_BY_AREA, [OPEN_LAKE_3_AREA_ID]: { slots: TRIP_SLOTS } });
  const options = { extras: [OPEN_LAKE_3_SPECIAL_TREASURE_ID], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };
  const all = OPEN_LAKE_3_SHARED_TREASURES.map((treasure) => treasure.id);

  it("shares Area 10's whole set, the Refuge snow globe among them, and hides none of its own yet", () => {
    expect(OPEN_LAKE_3_SHARED_TREASURES).toBe(DEEP_CANAL_3_TREASURES);
    expect(OPEN_LAKE_3_LAYOUT.sharedTreasures).toBe(DEEP_CANAL_3_TREASURES);
    expect(OPEN_LAKE_3_LAYOUT.treasures).toEqual([]);
    expect(zone.sharedTreasures).toEqual(all);
    expect(zone.finds.map((find) => find.id)).toEqual(all);
    expect(OPEN_LAKE_3_SPECIAL_TREASURE_ID).toBe('deep-canal/refuge-snow-globe');
    expect(all).toContain(OPEN_LAKE_3_SPECIAL_TREASURE_ID);
  });

  it("never hides Area 11's set, Area 13's special treasure nor any open lake treasure", () => {
    expect(OPEN_LAKE_3_SHARED_TREASURES).not.toBe(DEEP_CANAL_4_TREASURES);
    expect(OPEN_LAKE_3_SPECIAL_TREASURE_ID).not.toBe('deep-canal/paint-shell-lagoon-shine');
    for (const id of all) expect(id.startsWith('deep-canal/'), id).toBe(true);
    const lakeIds = OPEN_LAKE_LAYOUT.treasures.map((treasure) => treasure.id);
    for (const id of all) expect(lakeIds, id).not.toContain(id);
  });

  it('places 200 trips without throwing: the 19 slots, the lost treasures and the Refuge snow globe', () => {
    expect(tuning.slots).toBe(TRIP_SLOTS);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(OPEN_LAKE_3_SPECIAL_TREASURE_ID);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });
});

describe('Area 14 snacks and stranding places', () => {
  const mix = zone.mobileSnacks;

  it("meets the later row of the snack ramp: 14 of its 20 snacks mobile, 70%, at least Area 13's share, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(14, OPEN_LAKE_3_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const share = mobileSnackShare(OPEN_LAKE_3_LAYOUT);
    expect(share).toBe(0.7);
    expect(share).toBeGreaterThanOrEqual(mobileSnackShare(OPEN_LAKE_2_LAYOUT));
  });

  it("moves its tadpoles and shrimp as the snack motion rules ask, with Area 13's shrimp rule, and a one-leg axolotl catches every tadpole", () => {
    expect(meetsSnackMotion(OPEN_LAKE_3_LAYOUT)).toBe(true);
    expect(mix?.shrimp).toEqual(OPEN_LAKE_2_LAYOUT.mobileSnacks?.shrimp);
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
  });

  it('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp, the litter kept clear of as a hazard', () => {
    const avoid = mobileSnackAvoid(zone);
    expect(avoid.hazards?.length).toBe(LITTER_IDS.length + walls.length);
    const drift = { amplitudeX: 16, amplitudeY: 8, periodX: 6.3, periodY: 5.04 };
    for (const wander of mix?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of mix?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('sits one shrimp home on the ridge by the safe area, so the ridge column has a snack', () => {
    const ridgeHomes = (mix?.homes ?? []).filter((home) => home.points.every((point) => inSpan(point.x, RIDGE)));
    expect(ridgeHomes).toHaveLength(1);
    for (const point of ridgeHomes[0].points) {
      expect(depthBandAt(point.y)).toBe(1);
      expect(inSafeArea(point, safeArea)).toBe(false);
      expect(floorUnder(point.x)).toBe(BED_TOP);
    }
  });

  it.each(ALL_SEEDS)('builds every snack start in the water, at least SNACK_HAZARD_CLEARANCE from the rock, with snacks in every screen column, for seed %i', (seed) => {
    const layout = openLake3(seed);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack), snack.id).toBe(true);
      for (const wall of walls) expect(rectGap(wall, pointRect(snack)), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
    for (let column = 0; column < layout.chunks; column++) {
      expect(layout.collectibles.some((snack) => columnOf(snack.x) === column), `column ${column}`).toBe(true);
    }
  });

  it('keeps four stranding places in band 2 over the pits, two over each, 80 px from every route, out of the safe area and every pelican sweep, clear of the spots', () => {
    expect(zone.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4].map((n) => `open-lake-3/strand-${n}`));
    expect(zone.strandingPlaces.filter((place) => inSpan(place.x, WEST_PIT))).toHaveLength(2);
    expect(zone.strandingPlaces.filter((place) => inSpan(place.x, EAST_PIT))).toHaveLength(2);
    for (const place of zone.strandingPlaces) {
      expect(depthBandAt(place.y), place.id).toBe(2);
      expect(inBounds(place), place.id).toBe(true);
      expect(bodyInAnyRock(place, walls), place.id).toBe(false);
      expect(inSafeArea(place, safeArea), place.id).toBe(false);
      for (const line of lines) expect(rectGap(pelicanLineSweep(line), pointRect(place)), place.id).toBeGreaterThan(line.tuning.touchReach);
      for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) expect(routeLoopDistance(place, route.waypoints), `${place.id} to ${route.id}`).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spot of zone.spots) expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
    }
  });
});

describe('Area 14 fading lights', () => {
  it('sets two fading lights in each pit, in the dark: one on its terrace step and one on its floor', () => {
    for (const light of lights) {
      expect(light.type, light.id).toEqual(FADING_LIGHT);
      expect(light.fadingLight.radius, light.id).toBe(FADING_LIGHT_RADIUS);
      expect(inDarkWater(light.fadingLight, dark), light.id).toBe(true);
      expect(depthBandAt(light.fadingLight.y), light.id).toBe(3);
      expect(bodyInAnyRock(light.fadingLight, walls), light.id).toBe(false);
    }
    const [westTerrace, westFloor, eastFloor, eastTerrace] = lights.map((light) => light.fadingLight);
    for (const [light, terrace] of [
      [westTerrace, walls[2]],
      [eastTerrace, walls[4]],
    ] as const) {
      expect(light.x > terrace.x0 && light.x < terrace.x1).toBe(true);
      expect(terrace.y0 - light.y).toBeLessThanOrEqual(FADING_LIGHTS.touchReach + light.radius + PEBBLES.bodyReach);
    }
    for (const [light, floor] of [
      [westFloor, WEST_FLOOR],
      [eastFloor, EAST_FLOOR],
    ] as const) {
      expect(light.x > floor.x0 && light.x < floor.x1).toBe(true);
      expect(zone.bedTop - light.y).toBeLessThanOrEqual(FADING_LIGHTS.touchReach + light.radius + PEBBLES.bodyReach + 8);
    }
  });

  it("lets the axolotl reach at least one light in each pit from the Home Spot without entering any turtle's snap reach: both terrace lights", () => {
    expect(snapRoutes(zone).map((snap) => snap.reach)).toEqual([136, 136]);
    expect(lightsReachedOutsideSnaps()).toEqual([LIGHT_IDS[0], LIGHT_IDS[3]]);
  });
});
