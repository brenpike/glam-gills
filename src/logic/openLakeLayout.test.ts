import { describe, expect, it } from 'vitest';
import {
  AREAS,
  DEEP_CANAL_4_AREA,
  HABITATS,
  OPEN_LAKE_AREA,
  OPEN_LAKE_HABITAT,
  areaById,
  areaFactCards,
  areaTimeOfDay,
  newThingsByArea,
  sourceFactCards,
  threatFactCards,
  threatIds,
  unlockedAreaIds,
} from './areas';
import { OPEN_LAKE_TREASURES, RARITIES, type Rarity } from './catalogue';
import { createCollectibles, snackDriftMaxSpeed, snackX, snackY, type SnackDrift } from './collectibles';
import {
  carpCount,
  carpTarget,
  floorQuietStretch,
  hasSurfaceDanger,
  legCostingMovingHazardTypeCount,
  longestQuietSwim,
  meetsBandDepthRule,
  meetsDepthRule,
  meetsFloorRule,
  meetsWholeWaterDangerBar,
  movingThreatCount,
  predatorTypeCount,
  waterDepthBands,
  waterScreenCount,
} from './dangerBar';
import { DEEP_CANAL_4_CARP, DEEP_CANAL_4_LAYOUT, DEEP_CANAL_4_TILAPIA } from './deepCanal4Layout';
import { deepestWaterBand, depthBandAt, raritySpotsInDeepestBand, spotFitsBand } from './depthBand';
import { reedDragAt } from './environment';
import { exitGateBase } from './exitGate';
import { CARP_FACT, PELICAN_FACT, SHRIMP_FACT, TADPOLE_FACT, TILAPIA_FACT } from './factCards';
import { MAIN_PATH_REACH, distanceToPath, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples } from './layoutGaps';
import { legSwimTuning } from './legs';
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
  OPEN_LAKE_AREA_ID,
  OPEN_LAKE_CARP,
  OPEN_LAKE_EXIT,
  OPEN_LAKE_LAYOUT,
  OPEN_LAKE_TILAPIA,
} from './openLakeLayout';
import { PEBBLES, blockAtRock, bodyInAnyRock, type RockWall } from './pebble';
import { PELICAN_LINE, pelicanLinePeriod, pelicanLineSweep, pelicanNarrowestGap, pelicanScoopHit } from './pelicanLine';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { CARP_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies } from './predators';
import { stepSwim, type SwimState } from './swimPhysics';
import { FINDS, LEGS, RISK, SWIM, tripTreasureTuning } from './tuning';
import { LAGOON_BREEZE, tripCueFor } from './music';
import { STRANDING_CHANCE, areaStrandingChance } from './rescue';
import { NO_STARS, type AreaStarsRecord } from './stars';
import { normalize } from './vec';
import { WINDS, addWindForce, oneLegHeadway, windForceAt, winds } from './wind';
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
/** 60 seeds for the seeded snacks: the shipped seeds and 51 more. */
const SNACK_SEEDS = [...ALL_SEEDS, ...Array.from({ length: 51 }, (_, i) => (i + 1) * 7919)];
/** 200 trip seeds for treasure placement. */
const TRIP_SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);
const STRANDING_ROUTE_CLEARANCE = 80;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** The longest quiet swim the danger bar allows in px: one screen across. */
const QUIET_SWIM_LIMIT = SCREEN_W;
/** A y on the terrace steps' rock, under their tops. */
const STEP_PROBE_Y = 600;
/** Spacing in px of the water grid the finishable proof floods. */
const FLOOD_STEP = 8;
/** Area 12's special treasure, its own Rare Little pelican (issue #214, ND-1). */
const SPECIAL_TREASURE_ID = 'open-lake/little-pelican';
/** Area 12's snack drift, from its area data: a little faster than Area 11's. */
const DRIFT: Readonly<SnackDrift> = OPEN_LAKE_AREA.snackDrift;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends. */
const LONGEST_QUIET_SWIM = { length: 460.8, from: { x: 3912, y: 318 }, to: { x: 4280, y: 94 } };
/** Longest quiet stretch of the floor lane in px, as measured. */
const FLOOR_QUIET_STRETCH = 362;
/**
 * The one-leg run, as measured: it leaves the Home Spot at element time `start`, holds `hold` s at the
 * bottom of the bowl, and reaches the exit `seconds` after it left.
 */
const ONE_LEG_RUN = { start: 73.35, hold: 3.65, seconds: 62.57 };
/** Empty treasure slots over the 200 fresh trips, as measured: 17 slots and the special treasure's for 12 treasures, every one placed on every trip (issue #214, ND-7). */
const EMPTY_SLOTS = { most: 6, mean: 6 };
/** The main path's waypoints, named by the part of the swim each starts or ends. */
const TURN = { home: 0, shelfFarEnd: 3, bowlBottom: 8, rightShelf: 9, exit: 10 };
const TILAPIA_IDS = ['tilapia-0', 'tilapia-1'];
const CARP_IDS = [0, 1, 2, 3].map((n) => `carp-${n}`);
const LINE_IDS = [1, 2].map((n) => `open-lake-1/pelican-line-${n}`);

const zone = buildZone(OPEN_LAKE_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const exit = OPEN_LAKE_EXIT;
const walls: readonly RockWall[] = zone.rockWalls ?? [];
const lines = zone.pelicanLines ?? [];
const [leftShelf, rightShelf, leftStep, rightStep] = walls;
const { safeArea } = zone;
const zonesBySeed = new Map<number, ZoneLayout>([[DEFAULT_ZONE_SEED, zone]]);
let floodedWater: { reached: boolean[]; columns: number; rows: number } | null = null;

/** Area 12 built with `seed`, built once per seed. */
function openLake(seed: number): ZoneLayout {
  const built = zonesBySeed.get(seed) ?? buildZone(OPEN_LAKE_LAYOUT, seed);
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

/** Whether a point is inside any rock wall, edges included: rock, not water. */
function inRock(point: Point): boolean {
  return walls.some((wall) => inRect(point, wall));
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectGap(first: { x0: number; x1: number; y0: number; y1: number }, second: { x0: number; x1: number; y0: number; y1: number }): number {
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

/** The screen row a y is in, 0 at the top. */
function rowOf(y: number): number {
  return Math.floor(y / WORLD_H);
}

/** The screen column an x is in, 0 at the left. */
function columnOf(x: number): number {
  return Math.floor(x / SCREEN_W);
}

/** Points every `step` px along an open path. */
function pathSamples(path: readonly Point[], step: number): Point[] {
  return path.slice(1).flatMap((to, i) => {
    const from = path[i];
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    return Array.from({ length: count + 1 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / count, y: from.y + ((to.y - from.y) * k) / count }));
  });
}

/** Each tilapia route and predator route with its strike range. */
function strikeRoutes(layout: ZoneLayout): { id: string; waypoints: readonly Point[]; strike: number }[] {
  return [
    ...layout.tilapiaRoutes.map((route) => ({ id: route.id, waypoints: route.waypoints, strike: OPEN_LAKE_TILAPIA.lungeRange })),
    ...layout.predatorRoutes.map((route) => ({ id: route.id, waypoints: route.waypoints, strike: route.species.tuning.lungeRange })),
  ];
}

/** The y span of a route's waypoints. */
function ySpan(waypoints: readonly Point[]): { top: number; bottom: number } {
  const ys = waypoints.map((point) => point.y);
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** The id of the pelican line whose scoop bumps a body centred at `pos` at element time `t`, or null. */
function scoopHitAt(pos: Readonly<Point>, t: number): string | null {
  return lines.find((line) => pelicanScoopHit(line, pos, t) !== null)?.id ?? null;
}

/** One frame of a one-leg swim steered by `steer`, with every gust over `pos` blowing, stopped at the rock. */
function swimFrame(state: SwimState, steer: Point, t: number): SwimState {
  const pos = { x: state.x, y: state.y };
  const current = addWindForce({ x: 0, y: 0 }, pos, zone.elements, t, safeArea);
  const env = { current, dragMul: reedDragAt(pos, zone.reedPatches), bounds, dashing: false };
  const swum = stepSwim(state, steer, env, FRAME, legSwimTuning(1));
  const blocked = blockAtRock(pos, swum, walls);
  return { ...swum, x: blocked.x, y: blocked.y, vx: blocked.x === swum.x ? swum.vx : 0, vy: blocked.y === swum.y ? swum.vy : 0 };
}

/**
 * A one-leg swim of the main path from the Home Spot to the exit, leaving at element time `start`,
 * every gust blowing on it and every pelican scoop timed: it holds `hold` s at the bottom of the bowl,
 * out of every scoop and gust, before it climbs to the right shelf. Its seconds, or null on a scoop
 * or when over the limit.
 */
function oneLegRun(start: number, hold: number): number | null {
  let state: SwimState = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: -1 };
  const targets = zone.mainPath.slice(1);
  const holdAt = TURN.bowlBottom - 1;
  let next = 0;
  let leaveAt = Infinity;
  for (let frame = 0; frame < Math.round(BEAT_MAX_SECONDS / FRAME); frame++) {
    const t = start + frame * FRAME;
    const pos = { x: state.x, y: state.y };
    if (next === targets.length - 1 && Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius) return frame * FRAME;
    if (scoopHitAt(pos, t) !== null) return null;
    const target = targets[next];
    const reached = Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH;
    if (reached && next === holdAt && leaveAt === Infinity) leaveAt = t + hold;
    if (reached && next < targets.length - 1 && !(next === holdAt && t < leaveAt)) {
      next++;
      continue;
    }
    const steer = reached ? { x: 0, y: 0 } : normalize({ x: target.x - pos.x, y: target.y - pos.y });
    state = swimFrame(state, steer, t);
  }
  return null;
}

/** The water grid every FLOOD_STEP px over the swim bounds, flooded from the Home Spot through every place the body fits. */
function floodWater(): { reached: boolean[]; columns: number; rows: number } {
  if (floodedWater) return floodedWater;
  const columns = Math.floor((bounds.maxX - bounds.minX) / FLOOD_STEP) + 1;
  const rows = Math.floor((bounds.maxY - bounds.minY) / FLOOD_STEP) + 1;
  const open = Array.from({ length: columns * rows }, (_, cell) => !bodyInAnyRock(gridPoint(cell, columns), walls));
  const reached = open.map(() => false);
  const queue = [nearestCell(zone.start, columns)];
  reached[queue[0]] = true;
  for (let index = 0; index < queue.length; index++) {
    for (const next of gridNeighbours(queue[index], columns, rows)) {
      if (!open[next] || reached[next]) continue;
      reached[next] = true;
      queue.push(next);
    }
  }
  floodedWater = { reached, columns, rows };
  return floodedWater;
}

/** The world point of grid cell `cell`. */
function gridPoint(cell: number, columns: number): Point {
  return { x: bounds.minX + (cell % columns) * FLOOD_STEP, y: bounds.minY + Math.floor(cell / columns) * FLOOD_STEP };
}

/** The grid cell nearest a point in the swim bounds. */
function nearestCell(point: Point, columns: number): number {
  const column = Math.round((Math.min(Math.max(point.x, bounds.minX), bounds.maxX) - bounds.minX) / FLOOD_STEP);
  const row = Math.round((Math.min(Math.max(point.y, bounds.minY), bounds.maxY) - bounds.minY) / FLOOD_STEP);
  return row * columns + Math.min(column, columns - 1);
}

/** The up to four cells next to `cell`. */
function gridNeighbours(cell: number, columns: number, rows: number): number[] {
  const [row, column] = [Math.floor(cell / columns), cell % columns];
  const steps = [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];
  return steps.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < columns).map(([r, c]) => r * columns + c);
}

/** Whether a point is water, not rock, and the flood from the Home Spot reaches a body place within one grid step of it. */
function inConnectedWater(point: Point): boolean {
  if (inRock(point) || !inBounds(point)) return false;
  const { reached, columns, rows } = floodWater();
  const centre = nearestCell(point, columns);
  const [row, column] = [Math.floor(centre / columns), centre % columns];
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
    for (let c = Math.max(0, column - 1); c <= Math.min(columns - 1, column + 1); c++) if (reached[r * columns + c]) return true;
  }
  return false;
}

/** The count of each rarity in `items`, in RARITIES order. */
function rarityCounts(items: readonly { rarity: Rarity }[]): number[] {
  return RARITIES.map((rarity) => items.filter((item) => item.rarity === rarity).length);
}

describe('OPEN_LAKE_LAYOUT', () => {
  it('is Area 12 data: 9 screens across, 2 down, depth banded, starting at the Home Spot', () => {
    expect(OPEN_LAKE_AREA_ID).toBe('open-lake-1');
    expect(OPEN_LAKE_LAYOUT.id).toBe(OPEN_LAKE_AREA_ID);
    expect([zone.width, zone.height, zone.bedTop]).toEqual([4320, 720, 678]);
    expect([zone.chunks, zone.rows]).toEqual([9, 2]);
    expect(zone.depthBanded).toBe(true);
    expect(zone.start).toEqual({ x: 2160, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 2160, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('open-lake-1/cave');
    for (const part of [zone.trajineras, zone.bailingBoats, zone.fishingBoats, zone.dragNets, zone.darkWater, zone.sideRooms, zone.bankOverhangs]) {
      expect(part).toBeUndefined();
    }
  });

  it('is frozen data, down to each wall, route, pelican line, bed and mobile snack', () => {
    expect(Object.isFrozen(OPEN_LAKE_LAYOUT)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_TILAPIA)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_CARP)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_CARP.tuning)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_EXIT)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_TREASURES)).toBe(true);
    const { rockWalls, pelicanLines, reedBeds, tilapiaRoutes, predatorRoutes, mobileSnacks } = OPEN_LAKE_LAYOUT;
    for (const part of [
      rockWalls,
      pelicanLines,
      reedBeds,
      tilapiaRoutes,
      predatorRoutes,
      OPEN_LAKE_LAYOUT.elements,
      OPEN_LAKE_LAYOUT.mainPath,
      OPEN_LAKE_LAYOUT.strandingPlaces,
      OPEN_LAKE_LAYOUT.cave,
      OPEN_LAKE_LAYOUT.safeArea,
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
    for (const element of OPEN_LAKE_LAYOUT.elements) expect(Object.isFrozen(element), element.id).toBe(true);
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
    for (const point of OPEN_LAKE_LAYOUT.mainPath) expect(Object.isFrozen(point)).toBe(true);
    for (const place of OPEN_LAKE_LAYOUT.strandingPlaces) expect(Object.isFrozen(place), place.id).toBe(true);
  });

  it('has 20 snacks (3 worms, 3 bugs, 4 tadpoles and 10 shrimp), 2 tilapia, 4 carp, 2 pelican lines of 3, one wind and 17 treasure slots, and no pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = openLake(seed);
      expect(layout.collectibles).toHaveLength(20);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([3, 3, 4, 10]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(TILAPIA_IDS);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual(CARP_IDS.map((id) => [id, OPEN_LAKE_CARP]));
    expect(lines.map((line) => [line.id, line.tuning.count])).toEqual(LINE_IDS.map((id) => [id, 3]));
    expect(winds(zone.elements).map((wind) => wind.id)).toEqual(['open-lake-1/wind-1']);
    expect(zone.elements).toHaveLength(1);
    expect(OPEN_LAKE_LAYOUT.padCount).toBe(0);
    expect(OPEN_LAKE_LAYOUT.tilapia).toBe(OPEN_LAKE_TILAPIA);
    expect(tripTreasureTuning(OPEN_LAKE_AREA_ID).slots).toBe(17);
    expect(tripTreasureTuning(OPEN_LAKE_AREA_ID).slots).toBe(tripTreasureTuning(DEEP_CANAL_4_LAYOUT.id).slots + 1);
    expect(OPEN_LAKE_LAYOUT.treasures).toBe(OPEN_LAKE_TREASURES);
    expect(OPEN_LAKE_LAYOUT).not.toHaveProperty('sharedTreasures');
  });

  it("plays its tilapia one step up the ladder from Area 11's (ND-19): a 520 px/s strike reaching 175 px, a 1.4 s cooldown and an 80 px/s patrol, Area 11's warning and chase", () => {
    expect(OPEN_LAKE_TILAPIA).toEqual({ ...DEEP_CANAL_4_TILAPIA, lungeSpeed: 520, lungeRange: 175, cooldown: 1.4, patrolSpeed: 80 });
    expect(OPEN_LAKE_TILAPIA.windup).toBe(0.8);
    expect(OPEN_LAKE_TILAPIA.chase).toBe(DEEP_CANAL_4_TILAPIA.chase);
    expect(() => tunedSpecies(TILAPIA_SPECIES, OPEN_LAKE_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one step up the ladder from Area 11's (ND-19): a 1.3 s cooldown and a 75 px/s patrol, Area 11's other values and chase", () => {
    expect(OPEN_LAKE_CARP.id).toBe(CARP_SPECIES.id);
    expect(OPEN_LAKE_CARP.tuning).toEqual({ ...DEEP_CANAL_4_CARP.tuning, cooldown: 1.3, patrolSpeed: 75 });
    expect(OPEN_LAKE_CARP.tuning.chase).toBe(DEEP_CANAL_4_CARP.tuning.chase);
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = openLake(seed);
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
    }
  });
});

describe('Area 12 bowl (the area shape rule)', () => {
  it('fills both shelves with rock from y 318 down, columns 0 to 2 and 6 to 8, leaving 12 screens of water', () => {
    expect(leftShelf).toEqual({ x0: 0, x1: 3 * SCREEN_W, y0: BED_TOP, y1: zone.height });
    expect(rightShelf).toEqual({ x0: 6 * SCREEN_W, x1: zone.width, y0: BED_TOP, y1: zone.height });
    expect(BED_TOP).toBe(318);
    expect(waterScreenCount(zone)).toBe(12);
    expect(deepestWaterBand(OPEN_LAKE_LAYOUT)).toBe(2);
  });

  it('cuts at most one small terrace step on each side of the deep middle, each leaving room to pass over it and between them', () => {
    expect(walls).toHaveLength(4);
    for (const [step, shelf] of [
      [leftStep, leftShelf],
      [rightStep, rightShelf],
    ] as const) {
      expect(rectGap(step, shelf)).toBe(0);
      expect(step.x1 - step.x0).toBeLessThan(SCREEN_W / 2);
      expect(step.y1).toBe(zone.height);
      expect(rowOf(step.y0)).toBe(1);
      expect(step.y0 - BED_TOP - 2 * PEBBLES.bodyReach).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
      expect(zone.bedTop - step.y0).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
    expect(leftStep.x0).toBe(leftShelf.x1);
    expect(rightStep.x1).toBe(rightShelf.x0);
    expect(rightStep.x0 - leftStep.x1 - 2 * PEBBLES.bodyReach).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('puts the Home Spot and its safe area in the middle shallows: the centre column of the top row', () => {
    expect(zone.safeArea).toEqual({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H });
    expect([columnOf(zone.homeSpot.x), rowOf(zone.homeSpot.y)]).toEqual([4, 0]);
    expect([columnOf(safeArea.x0), columnOf(safeArea.x1), rowOf(safeArea.y1 - 1)]).toEqual([4, 4, 0]);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
    for (const wall of walls) expect(rectGap(wall, safeArea)).toBeGreaterThan(0);
  });

  it('puts the exit at the far east end of the right shelf, its gate on the shelf rock, out of the safe area and every pelican sweep', () => {
    expect(exit).toEqual({ x: 4180, y: 270, radius: 40 });
    expect(zone.mainPath[TURN.exit]).toEqual({ x: exit.x, y: exit.y });
    expect(columnOf(exit.x)).toBe(zone.chunks - 1);
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: BED_TOP });
    expect(exit.y + exit.radius).toBeLessThan(BED_TOP);
    expect(inBounds(exit)).toBe(true);
    expect(inSafeArea(exit, safeArea)).toBe(false);
    for (const line of lines) expect(rectGap(pelicanLineSweep(line), { x0: exit.x, x1: exit.x, y0: exit.y, y1: exit.y }), line.id).toBeGreaterThan(exit.radius + line.tuning.touchReach);
    for (const { id, waypoints, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, waypoints), id).toBeGreaterThan(strike + exit.radius);
  });

  it('is no left-to-right run: west across the left shelf and back, down through the bowl into band 2 and up, then east along the right shelf to the exit', () => {
    const path = zone.mainPath;
    expect(path[TURN.home]).toEqual(zone.start);
    expect(path).toHaveLength(TURN.exit + 1);
    const out = path.slice(0, TURN.shelfFarEnd + 1);
    for (let i = 1; i < out.length; i++) expect(out[i].x, `out point ${i}`).toBeLessThanOrEqual(out[i - 1].x);
    expect(path[TURN.shelfFarEnd].x).toBeLessThan(leftShelf.x1 - SCREEN_W);
    const back = path.slice(TURN.shelfFarEnd, TURN.bowlBottom + 1);
    for (let i = 1; i < back.length; i++) expect(back[i].x, `back point ${TURN.shelfFarEnd + i}`).toBeGreaterThanOrEqual(back[i - 1].x);
    const deepest = Math.max(...path.map((point) => point.y));
    expect(depthBandAt(deepest)).toBe(2);
    expect(path[TURN.bowlBottom].y).toBe(deepest);
    expect(path[TURN.bowlBottom].x).toBeGreaterThan(leftStep.x1);
    expect(path[TURN.bowlBottom].x).toBeLessThan(rightStep.x0);
    const along = pathSamples(path.slice(TURN.rightShelf), 2);
    for (const point of along) expect(depthBandAt(point.y), `right shelf at ${point.x}, ${point.y}`).toBe(1);
    for (let i = TURN.rightShelf + 1; i < path.length; i++) expect(path[i].x).toBeGreaterThan(path[i - 1].x);
  });

  it('keeps the main path in water the body fits, out of every tilapia and carp strike', () => {
    for (const point of pathSamples(zone.mainPath, 2)) {
      expect(inBounds(point), `path at ${point.x}, ${point.y}`).toBe(true);
      expect(bodyInAnyRock(point, walls), `path at ${point.x}, ${point.y}`).toBe(false);
      for (const { id, waypoints, strike } of strikeRoutes(zone)) expect(routeLoopDistance(point, waypoints), `${id} at ${point.x}, ${point.y}`).toBeGreaterThan(strike);
    }
  });
});

describe('Area 12 threats (ND-5, ND-10, ND-17, ND-19)', () => {
  it('glides two lines of three pelicans over the shelves and the shallows, clear of the safe area and of each other', () => {
    expect(lines.map((line) => [line.x0, line.x1])).toEqual([
      [40, 1900],
      [2420, 3900],
    ]);
    for (const line of lines) {
      expect(line.tuning).toEqual(PELICAN_LINE);
      const sweep = pelicanLineSweep(line);
      expect(rectGap(sweep, safeArea), line.id).toBeGreaterThan(line.tuning.touchReach + PEBBLES.bodyReach);
      expect(rowOf(sweep.y1), line.id).toBe(0);
    }
    expect(lines[1].x0 - lines[0].x1).toBeGreaterThan(2 * PELICAN_LINE.touchReach);
    for (const [line, shelf] of [
      [lines[0], leftShelf],
      [lines[1], rightShelf],
    ] as const) {
      const sweep = pelicanLineSweep(line);
      expect(Math.min(sweep.x1, shelf.x1) - Math.max(sweep.x0, shelf.x0), line.id).toBeGreaterThan(SCREEN_W);
      expect(shelf.y0 - sweep.y1, line.id).toBeLessThanOrEqual(line.tuning.touchReach);
    }
  });

  it('times the two lines out of step: half a cycle apart', () => {
    const [first, second] = lines;
    expect(pelicanLinePeriod(first)).toBe(pelicanLinePeriod(second));
    expect(second.offset - first.offset).toBeCloseTo(pelicanLinePeriod(first) / 2, 9);
  });

  it('dips each bill into the shelf water above y 318, out of band 2 by more than the touch and body reach', () => {
    const dipBottom = SURF + PELICAN_LINE.dipDepth;
    expect(dipBottom).toBe(300);
    expect(dipBottom).toBeLessThan(BED_TOP);
    expect(dipBottom + PELICAN_LINE.touchReach + PEBBLES.bodyReach).toBeLessThanOrEqual(WORLD_H);
  });

  it('leaves every gap between two scoops at least the safe passing width', () => {
    for (const line of lines) expect(pelicanNarrowestGap(line), line.id).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('blows one wind and waves over the whole surface band, fading to calm at the top of band 2, which one leg still swims into', () => {
    const [wind] = winds(zone.elements);
    expect(wind.wind).toEqual({ x0: bounds.minX, x1: bounds.maxX, fadeY: WORLD_H, direction: 'right' });
    expect(oneLegHeadway(WINDS)).toBeGreaterThanOrEqual(WINDS.minHeadway);
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - WINDS.surfaceSpeed).toBe(oneLegHeadway(WINDS));
    const gust = WINDS.calmFor + WINDS.warnFor;
    expect(Math.abs(windForceAt(wind, { x: 2000, y: SURF }, gust))).toBe(WINDS.surfaceSpeed);
    expect(windForceAt(wind, { x: 2000, y: WORLD_H }, gust)).toBe(0);
  });

  it('keeps the two tilapia and four carp in band 2 only, in the water and clear of the rock by their bodies', () => {
    const routes = [...zone.tilapiaRoutes.map((route) => ({ route, body: OPEN_LAKE_TILAPIA.bodyRadius })), ...zone.predatorRoutes.map((route) => ({ route, body: route.species.tuning.bodyRadius }))];
    for (const { route, body } of routes) {
      for (const point of loopSamples(route.waypoints)) {
        expect(depthBandAt(point.y), route.id).toBe(2);
        expect(inBounds(point), route.id).toBe(true);
        expect(bodyInAnyRock(point, walls, { bodyReach: body }), `${route.id} at ${point.x}, ${point.y}`).toBe(false);
        expect(inSafeArea(point, safeArea), route.id).toBe(false);
      }
    }
  });

  it('has no steady current and no moving hazard (ND-17)', () => {
    expect(zone.currents).toEqual([]);
    expect(zone.movingHazards).toEqual([]);
    expect(zone.hazards).toEqual([]);
  });
});

describe('Area 12 danger pass (issue #211, ND-8, ND-9)', () => {
  it('meets the full danger bar with the whole-water test', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it('counts 12 moving threats for its 12 screens of water, at least ceil(0.75 x 12) = 9, 2 predator types and the pelican line in the moving hazard slot', () => {
    expect(movingThreatCount(zone)).toBe(12);
    expect(Math.ceil(0.75 * waterScreenCount(zone))).toBe(9);
    expect(predatorTypeCount(zone)).toBe(2);
    expect(legCostingMovingHazardTypeCount(zone)).toBe(1);
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never leaves a quiet swim in the whole water longer than one screen across, rock counted as no water', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 1);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('has surface danger and keeps the floor lane over the stepped floor quiet for no more than one screen across', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBeCloseTo(FLOOR_QUIET_STRETCH, 1);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('meets the band rule: the tilapia and the carp each reach both edges of band 2, within 24 px', () => {
    expect(meetsBandDepthRule(zone)).toBe(true);
    expect(meetsDepthRule(zone)).toBe(true);
    for (const routes of [zone.tilapiaRoutes, zone.predatorRoutes]) {
      const spans = routes.map((route) => ySpan(route.waypoints));
      expect(Math.min(...spans.map((span) => span.top))).toBeLessThanOrEqual(WORLD_H + 24);
      expect(Math.max(...spans.map((span) => span.bottom))).toBeGreaterThanOrEqual(bounds.maxY - 24);
    }
  });

  it('has the carp target from its screens of water: 4 carp for 12 screens', () => {
    expect(carpTarget(waterScreenCount(zone))).toBe(4);
    expect(carpCount(zone)).toBe(4);
  });

  it('gives every band its own danger: the pelican lines in band 1, the tilapia and carp in band 2', () => {
    const [band1, band2] = waterDepthBands(zone);
    expect(waterDepthBands(zone)).toHaveLength(2);
    for (const line of lines) {
      const sweep = pelicanLineSweep(line);
      expect(Math.max(sweep.y0, bounds.minY)).toBeGreaterThanOrEqual(band1.top);
      expect(sweep.y1).toBeLessThanOrEqual(band1.bottom);
    }
    for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) {
      const span = ySpan(route.waypoints);
      expect(span.top, route.id).toBeGreaterThanOrEqual(band2.top);
      expect(span.bottom, route.id).toBeLessThanOrEqual(band2.bottom);
    }
  });
});

describe('Area 12 hiding spots (B5, B6, B10, ND-2)', () => {
  it.each(ALL_SEEDS)('match their labels against every tilapia and carp, with the turn clearance, and fit their band, for seed %i', (seed) => {
    const layout = openLake(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('open-lake-1/spot-reeds-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(spotFitsBand(spot), spot.id).toBe(true);
      expect(turnDistance(spot, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it('never counts a pelican line or the wind as a hiding-risk threat', () => {
    const bare: ZoneLayout = { ...zone, pelicanLines: [], elements: [] };
    expect(zoneThreats(zone)).toHaveLength(6);
    expect(zoneThreats(bare)).toEqual(zoneThreats(zone));
  });

  it('has 5 Common and 9 Rare spots, every pool larger than its treasures, and every Rare spot in the deepest band', () => {
    expect(rarityCounts(zone.spots)).toEqual([5, 9, 0, 0]);
    expect(rarityCounts(OPEN_LAKE_TREASURES)).toEqual([4, 8, 0, 0]);
    for (const rarity of ['common', 'rare'] as const) {
      const treasures = OPEN_LAKE_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    expect(raritySpotsInDeepestBand(zone.spots, 'rare', deepestWaterBand(OPEN_LAKE_LAYOUT))).toBe(true);
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides the Commons in tule beds on the shelves, standing on the shelf rock, by the main path', () => {
    const shelfBeds = OPEN_LAKE_LAYOUT.reedBeds.filter((bed) => bed.baseY === BED_TOP);
    expect(shelfBeds).toHaveLength(2);
    const commons = zone.spots.filter((spot) => spot.rarity === 'common');
    for (const spot of commons) {
      expect(depthBandAt(spot.y), spot.id).toBe(1);
      expect(inRect({ x: spot.x, y: BED_TOP }, leftShelf) || inRect({ x: spot.x, y: BED_TOP }, rightShelf), spot.id).toBe(true);
      expect(shelfBeds.some((bed) => bed.columns.includes(spot.x)), spot.id).toBe(true);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
    }
  });

  it('hides the Rares in tule beds on the bowl floor and the terrace steps, in band 2, off the main path', () => {
    const rares = zone.spots.filter((spot) => spot.rarity === 'rare');
    const floorOf = (x: number) => (inRect({ x, y: STEP_PROBE_Y }, leftStep) || inRect({ x, y: STEP_PROBE_Y }, rightStep) ? leftStep.y0 : zone.bedTop);
    for (const spot of rares) {
      expect(depthBandAt(spot.y), spot.id).toBe(2);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
      const bed = OPEN_LAKE_LAYOUT.reedBeds.find((each) => each.columns.includes(spot.x) && each.rows.some((row) => row.y === spot.y));
      expect(bed, spot.id).toBeDefined();
      expect(bed?.baseY ?? zone.bedTop, spot.id).toBe(floorOf(spot.x));
    }
  });

  it('makes the cave a smooth-stone hollow on the bowl floor with no spot in it', () => {
    expect(zone.cave).toEqual({ id: 'open-lake-1/cave', x0: 2120, x1: 2260, y0: 610, y1: zone.bedTop });
    expect(zone.cave.x0).toBeGreaterThan(leftStep.x1);
    expect(zone.cave.x1).toBeLessThan(rightStep.x0);
    expect(zone.spots.filter((spot) => spot.cover === 'cave')).toEqual([]);
    for (const spot of zone.spots) expect(inRect(spot, zone.cave), spot.id).toBe(false);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and the exit and spaced for seed %i', (seed) => {
    const layout = openLake(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot), spot.id).toBe(true);
      expect(bodyInAnyRock(spot, walls), spot.id).toBe(false);
      expect(inSafeArea(spot, layout.safeArea), spot.id).toBe(false);
      expect(Math.hypot(spot.x - home.x, spot.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
    for (let i = 0; i < layout.spots.length; i++) {
      for (let j = i + 1; j < layout.spots.length; j++) {
        const [a, b] = [layout.spots[i], layout.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 12 treasure (B4; issue #214, ND-7)', () => {
  const tuning = tripTreasureTuning(OPEN_LAKE_AREA_ID);
  const options = { extras: [SPECIAL_TREASURE_ID], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };
  const all = OPEN_LAKE_TREASURES.map((treasure) => treasure.id);

  it('hides its own 4 Common and 8 Rare treasures in catalogue order, the Little pelican among them, and shares none', () => {
    expect(zone).not.toHaveProperty('sharedTreasures');
    expect(zone.finds.map((find) => find.id)).toEqual(all);
    expect(all).toContain(SPECIAL_TREASURE_ID);
    expect(OPEN_LAKE_TREASURES.find((treasure) => treasure.id === SPECIAL_TREASURE_ID)?.rarity).toBe('rare');
  });

  it("gives every treasure its rarity's whole pool: the 5 Common spots or the 9 Rare spots", () => {
    for (const treasure of OPEN_LAKE_TREASURES) {
      const pool = zone.spots.filter((spot) => spot.rarity === treasure.rarity).map((spot) => spot.id);
      expect(pool, treasure.id).toHaveLength(treasure.rarity === 'common' ? 5 : 9);
      expect(zone.finds.find((find) => find.id === treasure.id)?.pool, treasure.id).toEqual(pool);
    }
  });

  it("hides the Little pelican in band 2, Area 12's deepest band", () => {
    const pool = zone.finds.find((find) => find.id === SPECIAL_TREASURE_ID)?.pool;
    const spots = zone.spots.filter((spot) => pool?.includes(spot.id));
    expect(spots).toHaveLength(9);
    expect(deepestWaterBand(OPEN_LAKE_LAYOUT)).toBe(2);
    for (const spot of spots) expect(depthBandAt(spot.y), spot.id).toBe(2);
  });

  it('places 200 trips without throwing: the 17 slots, the lost treasures and the Little pelican', () => {
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(SPECIAL_TREASURE_ID);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('leaves the slots its 12 treasures cannot fill empty over 200 fresh trips, as measured', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 2);
    expect(Math.min(...empty)).toBeGreaterThanOrEqual(tuning.slots + 1 - all.length);
  });
});

describe('Area 12 snacks and stranding places', () => {
  const mix = zone.mobileSnacks;
  const area11Drift = DEEP_CANAL_4_AREA.snackDrift;

  it("meets the later row of the snack ramp: 14 of its 20 snacks mobile, 70%, at least Area 11's 69.6% and at most 0.7, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(12, OPEN_LAKE_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const share = mobileSnackShare(OPEN_LAKE_LAYOUT);
    expect(share).toBe(0.7);
    expect(share).toBeGreaterThanOrEqual(mobileSnackShare(DEEP_CANAL_4_LAYOUT));
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone', () => {
    expect(meetsSnackMotion(OPEN_LAKE_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('lets a one-leg axolotl catch every tadpole within 20 s (the one-leg catch proof)', () => {
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) {
      expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
  });

  it("gives its shrimp Area 11's shrimp rule", () => {
    expect(mix?.shrimp).toEqual(DEEP_CANAL_4_LAYOUT.mobileSnacks?.shrimp);
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = openLake(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, DRIFT, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it.each(SNACK_SEEDS)('build every snack start in the water, at least SNACK_HAZARD_CLEARANCE from the rock, for seed %i', (seed) => {
    const layout = openLake(seed);
    expect(layout.collectibles).toHaveLength(20);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack), snack.id).toBe(true);
      for (const wall of walls) expect(rectGap(wall, { x0: snack.x, x1: snack.x, y0: snack.y, y1: snack.y }), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('puts snacks in every screen column for seed %i', (seed) => {
    const layout = openLake(seed);
    for (let column = 0; column < layout.chunks; column++) {
      expect(layout.collectibles.some((snack) => columnOf(snack.x) === column), `column ${column}`).toBe(true);
    }
  });

  it('keep the seeded snacks in the water and out of the rock while drifting', () => {
    const items = createCollectibles(zone.collectibles).filter((item) => item.kind === 'worm' || item.kind === 'bug');
    for (let t = 0; t <= 60; t += 0.5) {
      items.forEach((item, index) => {
        const snack = { x: snackX(item, index, t, DRIFT, bounds), y: snackY(item, index, t, DRIFT, bounds) };
        expect(inBounds(snack), item.id).toBe(true);
        expect(inRock(snack), item.id).toBe(false);
      });
    }
  });

  it("drifts a little faster than Area 11, slower than a one-leg axolotl and at most half the magnet pull", () => {
    expect(DRIFT).toEqual({ ...area11Drift, periodX: 6.5, periodY: 5.2 });
    expect(snackDriftMaxSpeed(DRIFT)).toBeGreaterThan(snackDriftMaxSpeed(area11Drift));
    expect(snackDriftMaxSpeed(DRIFT)).toBeLessThan(SWIM.maxSpeed * LEGS.speedByLegs[0]);
    expect(snackDriftMaxSpeed(DRIFT)).toBeLessThan(oneLegHeadway());
    expect(snackDriftMaxSpeed(DRIFT)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it.each(ALL_SEEDS)('keeps four stranding places in band 2, 80 px from every route, out of the safe area, the cave and every pelican sweep, clear of the spots, for seed %i', (seed) => {
    const layout = openLake(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4].map((n) => `open-lake-1/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(depthBandAt(place.y), place.id).toBe(2);
      expect(inBounds(place), place.id).toBe(true);
      expect(bodyInAnyRock(place, walls), place.id).toBe(false);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(inRect(place, layout.cave), place.id).toBe(false);
      for (const line of lines) expect(rectGap(pelicanLineSweep(line), { x0: place.x, x1: place.x, y0: place.y, y1: place.y }), place.id).toBeGreaterThan(line.tuning.touchReach);
      for (const { id, waypoints } of strikeRoutes(layout)) expect(routeLoopDistance(place, waypoints), `${place.id} to ${id}`).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spot of layout.spots) expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
    }
  });
});

describe('Area 12 always finishable', () => {
  it.each(ALL_SEEDS)('puts every snack start in water joined to the Home Spot, none in rock, for seed %i', (seed) => {
    for (const snack of openLake(seed).collectibles) expect(inConnectedWater(snack), snack.id).toBe(true);
  });

  it('puts every mobile snack home, spot, stranding place, the Home Spot and the exit in water joined to the Home Spot, none in rock', () => {
    const homes = [...(zone.mobileSnacks?.wanders ?? []), ...(zone.mobileSnacks?.homes ?? [])].flatMap((home) => home.points);
    for (const point of homes) expect(inConnectedWater(point), `snack home at ${point.x}, ${point.y}`).toBe(true);
    for (const spot of zone.spots) expect(inConnectedWater(spot), spot.id).toBe(true);
    for (const place of zone.strandingPlaces) expect(inConnectedWater(place), place.id).toBe(true);
    expect(inConnectedWater(zone.homeSpot)).toBe(true);
    expect(inConnectedWater(exit)).toBe(true);
  });

  it('lets a one-leg axolotl swim the main path to the exit with no scoop under every gust, timing each scoop with one hold at the bottom of the bowl', () => {
    const seconds = oneLegRun(ONE_LEG_RUN.start, ONE_LEG_RUN.hold);
    expect(seconds, 'the measured run is scooped').not.toBeNull();
    expect(seconds).toBeCloseTo(ONE_LEG_RUN.seconds, 1);
    expect(seconds ?? Infinity).toBeLessThan(BEAT_MAX_SECONDS);
    const bottom = zone.mainPath[TURN.bowlBottom];
    for (const line of lines) expect(rectGap(pelicanLineSweep(line), { x0: bottom.x, x1: bottom.x, y0: bottom.y, y1: bottom.y }), line.id).toBeGreaterThan(line.tuning.touchReach);
    expect(bottom.y).toBeGreaterThan(WINDS.fadeY);
  });

  it('builds the same content for every seed: every place the proofs read', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = openLake(seed);
      expect(layout.mainPath).toEqual(zone.mainPath);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.homeSpot).toEqual(zone.homeSpot);
    }
  });
});

describe('Area 12 registration (issue #211)', () => {
  /** A stars record with the exit star saved for each area id. */
  function beaten(areaIds: readonly string[]): AreaStarsRecord {
    return Object.fromEntries(areaIds.map((id) => [id, { ...NO_STARS, exit: true }]));
  }

  it('is Area 12, at its place in AREAS, in the open lake, with its layout, exit, special treasure and windy look', () => {
    expect(OPEN_LAKE_AREA).toMatchObject({
      id: OPEN_LAKE_AREA_ID,
      number: 12,
      habitatId: OPEN_LAKE_HABITAT.id,
      specialTreasureId: SPECIAL_TREASURE_ID,
      look: 'open-lake-windy',
    });
    expect(OPEN_LAKE_AREA.layout).toBe(OPEN_LAKE_LAYOUT);
    expect(OPEN_LAKE_AREA.exit).toBe(OPEN_LAKE_EXIT);
    expect(AREAS[OPEN_LAKE_AREA.number - 1]).toBe(OPEN_LAKE_AREA);
    expect(areaById(OPEN_LAKE_AREA_ID)).toBe(OPEN_LAKE_AREA);
    expect(areaTimeOfDay(OPEN_LAKE_AREA)).toBe('day');
    expect(Object.isFrozen(OPEN_LAKE_AREA)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_AREA.exit)).toBe(true);
    expect(Object.isFrozen(OPEN_LAKE_AREA.snackDrift)).toBe(true);
  });

  it('puts the open lake habitat, with its own look, last in HABITATS', () => {
    expect(OPEN_LAKE_HABITAT).toEqual({ id: 'open-lake', name: 'Open lake', look: 'open-lake' });
    expect(HABITATS.at(-1)).toBe(OPEN_LAKE_HABITAT);
  });

  it('keeps the default stranding chance and no one-time darters', () => {
    expect(OPEN_LAKE_AREA.strandingChance).toBeUndefined();
    expect(areaStrandingChance(OPEN_LAKE_AREA)).toBe(STRANDING_CHANCE);
    expect(OPEN_LAKE_AREA.snackDart).toBeUndefined();
  });

  it('unlocks once Area 11 is beaten, and not before', () => {
    const throughArea10 = AREAS.slice(0, 10).map((area) => area.id);
    expect(unlockedAreaIds(beaten(throughArea10))).not.toContain(OPEN_LAKE_AREA_ID);
    expect(unlockedAreaIds(beaten([...throughArea10, DEEP_CANAL_4_AREA.id])).at(-1)).toBe(OPEN_LAKE_AREA_ID);
  });

  it('adds exactly one new threat, the pelican line, and one new timing element, the wind and waves', () => {
    expect(newThingsByArea().find((things) => things.areaId === OPEN_LAKE_AREA_ID)).toEqual({
      areaId: OPEN_LAKE_AREA_ID,
      threats: ['pelican'],
      elements: ['wind'],
    });
  });

  it('names the tilapia, the carp and the pelican as its threats, from its data or its zone', () => {
    expect(threatIds(OPEN_LAKE_LAYOUT)).toEqual(['tilapia', 'carp', 'pelican']);
    expect(threatIds(zone)).toEqual(['tilapia', 'carp', 'pelican']);
    expect(threatFactCards(OPEN_LAKE_LAYOUT)).toEqual([TILAPIA_FACT, CARP_FACT, PELICAN_FACT]);
  });

  it('gives its threat cards, then the tadpole and shrimp cards, and puts the pelican card last in the area cards through Area 12', () => {
    expect(sourceFactCards(OPEN_LAKE_LAYOUT)).toEqual({
      ids: ['tilapia', 'carp', 'pelican', 'tadpole', 'shrimp'],
      cards: [TILAPIA_FACT, CARP_FACT, PELICAN_FACT, TADPOLE_FACT, SHRIMP_FACT],
    });
    expect(areaFactCards(AREAS.slice(0, OPEN_LAKE_AREA.number)).at(-1)).toBe(PELICAN_FACT);
  });

  it("plays the open lake's cue, Lagoon Breeze, in its day version", () => {
    expect(tripCueFor(OPEN_LAKE_AREA)).toBe(LAGOON_BREEZE);
  });
});
