import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_2_AREA, DEEP_CANAL_3_AREA, DEEP_CANAL_HABITAT, newThingsByArea, sourceFactCards, threatFactCards, threatIds } from './areas';
import { DEEP_CANAL_3_TREASURES, RARITIES, dreamColourById, type Treasure } from './catalogue';
import { createCollectibles, snackDriftMaxSpeed, snackX, snackY } from './collectibles';
import {
  carpCount,
  carpTarget,
  depthBands,
  floorQuietStretch,
  hasSurfaceDanger,
  longestQuietSwim,
  meetsDepthRule,
  meetsFloorRule,
  meetsWholeWaterDangerBar,
  movingHazardTypeCount,
  movingThreatCount,
  predatorTypeCount,
} from './dangerBar';
import { DEEP_CANAL_2_BASS, DEEP_CANAL_2_CARP, DEEP_CANAL_2_LAYOUT, DEEP_CANAL_2_TILAPIA } from './deepCanal2Layout';
import {
  DEEP_CANAL_3_AREA_ID,
  DEEP_CANAL_3_BASS,
  DEEP_CANAL_3_CARP,
  DEEP_CANAL_3_CRAYFISH,
  DEEP_CANAL_3_HERON,
  DEEP_CANAL_3_LAYOUT,
  DEEP_CANAL_3_SNAKE,
  DEEP_CANAL_3_TILAPIA,
} from './deepCanal3Layout';
import { DRAG_NET, DRAG_NETS, dragNetCatch, dragNetSweep, dragNetUnfairPoint, type DragNetSpawn } from './dragNets';
import { currentAt } from './environment';
import { exitGateBase } from './exitGate';
import { DRAG_NET_FACT, LURE_FACT, SHRIMP_FACT, TADPOLE_FACT } from './factCards';
import { shapeDistance, type HazardRect, type HazardShape } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, riskBands, routeDistance, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples, narrowestPathGap, obstaclesOf } from './layoutGaps';
import { legSwimTuning } from './legs';
import { LURES, TRAJINERA_LURE, fishingBoatBand, lureAt, lureLinePath, lurePath, type FishingBoatSpawn } from './lures';
import {
  meetsSnackMotion,
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileSnackClear,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpBox,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
} from './mobileSnacks';
import { TRAJINERA_WALTZ, tripCueFor } from './music';
import { ANCHOR_DROP, MUD_SEEP, movingHazardBaseY, movingHazardDepth, movingHazardPeriod, movingHazardSweep, movingHazardTouches } from './movingHazards';
import { MURKY_WATER, MURKY_WATER_TIMING, insideMurky, murkyCrossSeconds, murkyPatches } from './murkyWater';
import type { RockWall } from './pebble';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import {
  BLACK_BASS_SPECIES,
  CARP_SPECIES,
  CRAYFISH_SPECIES,
  GARTER_SNAKE_SPECIES,
  HERON_SPECIES,
  TILAPIA_SPECIES,
  routeLoopDistance,
  tunedSpecies,
  type PredatorRoute,
} from './predators';
import { RESCUE, STRANDING_CHANCE, areaStrandingChance } from './rescue';
import { isSafeStart, nearestSafeStart, poolSpots } from './riskFairness';
import { isShrimpFlickLandingClear } from './shrimpFlick';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  BLACK_BASS,
  BLACK_BASS_CHASE,
  CRAYFISH,
  CRAYFISH_CHASE,
  FINDS,
  GARTER_SNAKE,
  GARTER_SNAKE_CHASE,
  HERON,
  LEGS,
  RISK,
  SHRIMP,
  SNACK_REACH,
  SWIM,
  TADPOLES,
  tripTreasureTuning,
} from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  SURF,
  WORLD_H,
  buildZone,
  inHomeSpot,
  inSafeArea,
  isInsideCurrent,
  swimBounds,
  type Point,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
/** 60 seeds for the seeded snacks: the shipped seeds and 51 more. */
const SNACK_SEEDS = [...ALL_SEEDS, ...Array.from({ length: 51 }, (_, i) => (i + 1) * 7919)];
/** 200 trip seeds for treasure placement. */
const TRIP_SEEDS = Array.from({ length: 200 }, (_, i) => i * 104729 + 17);
const STRANDING_ROUTE_CLEARANCE = 80;
/** Least px from a stranding place to every anchor drop and mud seep sweep: the touch reach plus the rescue reach. */
const STRAND_HAZARD_CLEARANCE = ANCHOR_DROP.touchReach + RESCUE.reachRadius;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** Directions a shrimp's flick target is tried in. */
const FLICK_DIRECTIONS = 8;
/** The longest quiet swim the danger bar allows in px: one screen across. */
const QUIET_SWIM_LIMIT = SCREEN_W;
/** The widest a murky patch on the main path may be (issue #107). */
const ROUTE_PATCH_MAX_WIDTH = 200;
/** Seconds between two start times the one-leg run tries. */
const RUN_START_STEP = 0.25;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends. */
const LONGEST_QUIET_SWIM = { length: 413.02, from: { x: 440, y: 454 }, to: { x: 328, y: 94 } };
/** Longest quiet swim in each lane, counting only that lane's threats, in px, as measured: the lower lane has none. */
const LANE_QUIET_SWIM = { upper: 435.41, lower: null };
/** Longest quiet stretch of the floor lane in px, as measured. */
const FLOOR_QUIET_STRETCH = 399;
/** One-leg seconds along the main path from the Home Spot to the exit with no hit, as measured, and the start time that gives it. */
const ONE_LEG_RUN = { seconds: 82.37, start: 0 };
/** Empty treasure slots over the 200 fresh trips, as measured: 15 slots for 13 treasures. */
const EMPTY_SLOTS = { most: 8, mean: 5.71 };
const TILAPIA_IDS = ['tilapia-0', 'tilapia-1'];
const CARP_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `carp-${n}`);
const MOVER_IDS = [
  ...[1, 2, 3, 4, 5].map((n) => `deep-canal-3/anchor-drop-${n}`),
  ...[1, 2, 3, 4, 5, 6].map((n) => `deep-canal-3/mud-seep-${n}`),
];
const PATCH_IDS = [1, 2].map((n) => `deep-canal-3/murky-water-${n}`);
const BOAT_IDS = [1, 2, 3].map((n) => `deep-canal-3/fishing-trajinera-${n}`);
const NET_IDS = [1, 2].map((n) => `deep-canal-3/drag-net-${n}`);

const zone = buildZone(DEEP_CANAL_3_LAYOUT, DEFAULT_ZONE_SEED);
const area9 = buildZone(DEEP_CANAL_2_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const { exit } = DEEP_CANAL_3_AREA;
const movers = zone.movingHazards ?? [];
const patches = murkyPatches(zone.hazards);
const boats = zone.fishingBoats ?? [];
const nets = zone.dragNets ?? [];
const netSweeps = nets.map(dragNetSweep);
const lurePaths = boats.flatMap((boat) => boat.lures.map((_, index) => lurePath(boat, index)));
const lureLines = boats.flatMap((boat) => boat.lures.map((_, index) => lureLinePath(boat, index)));
const divider = zone.rockWalls ?? [];
const dividerSpan = {
  x0: Math.min(...divider.map((stone) => stone.x0)),
  x1: Math.max(...divider.map((stone) => stone.x1)),
  y0: Math.min(...divider.map((stone) => stone.y0)),
  y1: Math.max(...divider.map((stone) => stone.y1)),
};
const { safeArea } = zone;
/** The main path's waypoints, named by the part of the grand tour each starts or ends. */
const TOUR = {
  home: 0,
  forkPocket: 2,
  laneMouth: 3,
  joinPocket: 10,
  uTurnEast: 12,
  uTurnDown: 13,
  uTurnWest: 14,
  descentEnd: 15,
  climbFoot: 16,
  climbTop: 17,
  hubFork: 18,
  exit: 19,
};

function deepCanal3(seed: number): ZoneLayout {
  return buildZone(DEEP_CANAL_3_LAYOUT, seed);
}

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const limits = swimBounds(layout);
  return point.x >= limits.minX && point.x <= limits.maxX && point.y >= limits.minY && point.y <= limits.maxY;
}

/** A rect-like part as a rect shape. */
function rectOf(rect: { x0: number; x1: number; y0: number; y1: number }): HazardRect {
  return { kind: 'rect', x0: rect.x0, x1: rect.x1, y0: rect.y0, y1: rect.y1 };
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectDistance(first: HazardShape, second: HazardShape): number {
  if (first.kind !== 'rect' || second.kind !== 'rect') throw new Error('rectDistance: both shapes must be rects');
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

/** Whether a point is inside a rect, edges included. */
function inRect(point: Point, rect: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return point.x >= rect.x0 && point.x <= rect.x1 && point.y >= rect.y0 && point.y <= rect.y1;
}

/** The zone's predator routes of one species. */
function routesOf(layout: Pick<ZoneLayout, 'predatorRoutes'>, speciesId: string): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === speciesId);
}

/** Each tilapia route and predator route with its strike, its reach with the chase leash and its body radius. */
function strikeRoutes(layout: ZoneLayout): { route: TilapiaRoute; strike: number; reach: number }[] {
  const tuning = layout.tilapia ?? DEEP_CANAL_3_TILAPIA;
  return [
    ...layout.tilapiaRoutes.map((route) => ({ route, strike: tuning.lungeRange, reach: tuning.lungeRange + (tuning.chase?.leash ?? 0) })),
    ...layout.predatorRoutes.map((route) => {
      const { tuning: own, rules } = route.species;
      const leash = own.chase && !rules?.warnOnRoute ? own.chase.leash : 0;
      return { route, strike: own.lungeRange, reach: own.lungeRange + leash };
    }),
  ];
}

/** Least px from a shape to a closed patrol loop, sampled every px along the loop. */
function shapeRouteDistance(shape: HazardShape, waypoints: readonly Point[]): number {
  return Math.min(...loopSamples(waypoints).map((point) => shapeDistance(point, shape)));
}

/** The lane a point is in: over the divider, under it, in the rock, or in the water outside the divider's span. */
function laneOf(point: Point): 'upper' | 'lower' | 'rock' | 'open' {
  if (point.x < dividerSpan.x0 || point.x > dividerSpan.x1) return 'open';
  if (point.y < dividerSpan.y0) return 'upper';
  return point.y > dividerSpan.y1 ? 'lower' : 'rock';
}

/** The lane a whole loop keeps to, or 'both' when it leaves one lane. */
function loopLane(waypoints: readonly Point[]): string {
  const lanes = new Set(loopSamples(waypoints).map(laneOf));
  return lanes.size === 1 ? [...lanes][0] : 'both';
}

/** Whether a loop runs into the rock or through both lanes, so across the divider. */
function crossesDivider(waypoints: readonly Point[]): boolean {
  const lanes = new Set(loopSamples(waypoints).map(laneOf));
  return lanes.has('rock') || (lanes.has('upper') && lanes.has('lower'));
}

/**
 * The zone as one lane sees it: everything but that lane's water made rock, and only that lane's
 * threats, so a quiet swim there counts that lane's threats alone.
 */
function laneGeometry(layout: ZoneLayout, lane: 'upper' | 'lower'): ZoneLayout {
  const outside: RockWall[] = [
    { x0: 0, x1: dividerSpan.x0 - 1, y0: 0, y1: layout.height },
    { x0: dividerSpan.x1 + 1, x1: layout.width, y0: 0, y1: layout.height },
    lane === 'upper' ? { ...dividerSpan, y1: layout.height } : { ...dividerSpan, y0: 0 },
  ];
  const inLane = (spawn: (typeof movers)[number]) => {
    const sweep = movingHazardSweep(spawn);
    return laneOf({ x: spawn.x, y: (sweep.y0 + sweep.y1) / 2 }) === lane;
  };
  return {
    ...layout,
    rockWalls: outside,
    tilapiaRoutes: layout.tilapiaRoutes.filter((route) => loopLane(route.waypoints) === lane),
    predatorRoutes: layout.predatorRoutes.filter((route) => loopLane(route.waypoints) === lane),
    movingHazards: (layout.movingHazards ?? []).filter(inLane),
  };
}

/** The screen row a y is in, 0 at the top. */
function rowOf(y: number): number {
  return Math.floor(y / WORLD_H);
}

/** Where a shrimp at `spot` lands flicking `distance` px in each of FLICK_DIRECTIONS evenly spaced directions. */
function flickTargets(spot: Readonly<Point>, distance: number): Point[] {
  return Array.from({ length: FLICK_DIRECTIONS }, (_, i) => {
    const angle = (i * 2 * Math.PI) / FLICK_DIRECTIONS;
    return { x: spot.x + distance * Math.cos(angle), y: spot.y + distance * Math.sin(angle) };
  });
}

/** Points every `step` px along an open path. */
function pathSamples(path: readonly Point[], step: number): Point[] {
  return path.slice(1).flatMap((to, i) => {
    const from = path[i];
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    return Array.from({ length: count + 1 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / count, y: from.y + ((to.y - from.y) * k) / count }));
  });
}

/** The box round the points, edges included. */
function homeBoxOf(points: readonly Point[]): HazardRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { kind: 'rect', x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** The box of each leg of the closed loop through `points`, leg i from points[i] to the next. */
function legBoxesOf(points: readonly Point[]): HazardRect[] {
  return points.map((point, i) => homeBoxOf([point, points[(i + 1) % points.length]]));
}

/** The length of each leg of the closed loop through `points`, leg i from points[i] to the next. */
function loopLegLengths(points: readonly Point[]): number[] {
  return points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
}

/** The px of the main path inside the rect, measured every px along it. */
function pathLengthInside(rect: HazardRect): number {
  return zone.mainPath.slice(1).reduce((sum, to, i) => {
    const from = zone.mainPath[i];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length));
    const inside = Array.from({ length: steps }, (_, k) => ({ x: from.x + ((to.x - from.x) * (k + 0.5)) / steps, y: from.y + ((to.y - from.y) * (k + 0.5)) / steps }));
    return sum + (inside.filter((point) => inRect(point, rect)).length * length) / steps;
  }, 0);
}

/** One frame of a one-leg swim steered at `target`, with the area's current and its rock. */
function swimToward(state: SwimState, target: Point, layout: ZoneLayout): SwimState {
  const pos = { x: state.x, y: state.y };
  const steer = normalize({ x: target.x - pos.x, y: target.y - pos.y });
  const env = { current: currentAt(pos, layout.currents), dragMul: 1, bounds: swimBounds(layout), dashing: false };
  return stepSwim(state, steer, env, FRAME, legSwimTuning(1));
}

/** Where the head reach centre is for a swim: SNACK_REACH.headAhead px ahead of the body along its way, or along its facing when still. */
function headOf(state: SwimState): Point {
  const speed = Math.hypot(state.vx, state.vy);
  const way = speed > 1 ? { x: state.vx / speed, y: state.vy / speed } : { x: state.facing, y: 0 };
  return { x: state.x + way.x * SNACK_REACH.headAhead, y: state.y + way.y * SNACK_REACH.headAhead };
}

/** The id of the first timed threat that lands a hit on a swim at element time `t`, or null: a moving hazard, a lure or a drag net. */
function timedHitAt(state: SwimState, t: number, caught: Map<string, number | null>): string | null {
  const pos = { x: state.x, y: state.y };
  const touched = movers.find((spawn) => movingHazardTouches(spawn, t, pos));
  if (touched) return touched.id;
  const head = headOf(state);
  for (const boat of boats) {
    const eaten = boat.lures.findIndex((_, index) => Math.hypot(...subtract(lureAt(boat, index, t, false), head)) <= LURES.eatReach);
    if (eaten >= 0) return boat.lures[eaten].id;
  }
  return nets.find((net) => dragNetCatch(net, pos, t, caught.get(net.id) ?? null) !== null)?.id ?? null;
}

/** The two parts of `a` minus `b`. */
function subtract(a: Readonly<Point>, b: Readonly<Point>): [number, number] {
  return [a.x - b.x, a.y - b.y];
}

/**
 * A one-leg swim of the main path from the Home Spot to the exit, leaving at element time `start`:
 * its seconds, or null on a hit from a moving hazard, a lure or a drag net, or when over the limit.
 */
function oneLegRun(start: number): number | null {
  let state: SwimState = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: 1 };
  const targets = zone.mainPath.slice(1);
  const caught = new Map<string, number | null>();
  let next = 0;
  const maxFrames = Math.round(BEAT_MAX_SECONDS / FRAME);
  for (let frame = 0; frame < maxFrames; frame++) {
    const pos = { x: state.x, y: state.y };
    if (next === targets.length - 1 && Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius) return frame * FRAME;
    if (timedHitAt(state, start + frame * FRAME, caught) !== null) return null;
    const target = targets[next];
    if (next < targets.length - 1 && Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH) {
      next++;
      continue;
    }
    state = swimToward(state, target, zone);
  }
  return null;
}

/** The first start time, RUN_START_STEP apart over every timed threat's longest cycle, whose one-leg run lands no hit, with the run's seconds. */
function firstClearRun(): { start: number; seconds: number } | null {
  const window = Math.max(...movers.map((spawn) => movingHazardPeriod(spawn.type)), ...nets.map((net) => netPeriod(net)));
  for (let start = 0; start <= window; start += RUN_START_STEP) {
    const seconds = oneLegRun(start);
    if (seconds !== null) return { start, seconds };
  }
  return null;
}

/** Seconds in one cycle of a drag net. */
function netPeriod(net: Readonly<DragNetSpawn>): number {
  const { quietFor, warnFor, sweepFor } = net.dragNet.timing;
  return quietFor + warnFor + sweepFor;
}

/** Px from a point to the nearest edge of a moving threat's reach, as the danger bar measures it: below 0 inside. */
function reachMargin(point: Point, layout: ZoneLayout): number {
  const routes = strikeRoutes(layout).map(({ route, reach }) => routeLoopDistance(point, route.waypoints) - reach);
  const sweeps = (layout.movingHazards ?? []).map((spawn) => shapeDistance(point, movingHazardSweep(spawn)) - spawn.type.touchReach);
  return Math.min(...routes, ...sweeps);
}

/** Whether a Paint shell's Dream colour is patterned or a sheen. */
function isPatternedOrSheen(treasure: Treasure): boolean {
  if (treasure.category !== 'paintShell') return false;
  const kind = dreamColourById(treasure.dreamColour)?.kind;
  return kind === 'patterned' || kind === 'sheen';
}

/** A fishing boat's surface span: its whole drift span along the surface. */
function boatSpan(boat: Readonly<FishingBoatSpawn>): { x0: number; x1: number } {
  const band = fishingBoatBand(boat);
  return { x0: band.x0, x1: band.x1 };
}

describe('DEEP_CANAL_3_LAYOUT', () => {
  it('is Area 10 data: 10 screens across, 3 down, starting at the Home Spot', () => {
    expect(DEEP_CANAL_3_AREA_ID).toBe('deep-canal-3');
    expect(DEEP_CANAL_3_LAYOUT.id).toBe(DEEP_CANAL_3_AREA_ID);
    expect(zone.width).toBe(4800);
    expect(zone.height).toBe(1080);
    expect(zone.bedTop).toBe(1038);
    expect([zone.chunks, zone.rows]).toEqual([10, 3]);
    expect(zone.start).toEqual({ x: 180, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 180, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('deep-canal-3/cave');
    expect(zone.trajineras).toBeUndefined();
    expect(zone.bailingBoats).toBeUndefined();
  });

  it('is frozen data, down to each route, moving hazard, murky patch, stone, fishing boat, drag net and mobile snack', () => {
    expect(Object.isFrozen(DEEP_CANAL_3_LAYOUT)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_3_TILAPIA)).toBe(true);
    for (const species of [DEEP_CANAL_3_CARP, DEEP_CANAL_3_BASS, DEEP_CANAL_3_HERON, DEEP_CANAL_3_SNAKE, DEEP_CANAL_3_CRAYFISH]) {
      expect(Object.isFrozen(species), species.id).toBe(true);
      expect(Object.isFrozen(species.tuning), species.id).toBe(true);
    }
    for (const part of [
      DEEP_CANAL_3_LAYOUT.elements,
      DEEP_CANAL_3_LAYOUT.hazards,
      DEEP_CANAL_3_LAYOUT.tilapiaRoutes,
      DEEP_CANAL_3_LAYOUT.predatorRoutes,
      DEEP_CANAL_3_LAYOUT.bankOverhangs,
      DEEP_CANAL_3_LAYOUT.bankSpots,
      DEEP_CANAL_3_LAYOUT.caveSpots,
      DEEP_CANAL_3_LAYOUT.currentSpots,
      DEEP_CANAL_3_LAYOUT.currents,
      DEEP_CANAL_3_LAYOUT.mainPath,
      DEEP_CANAL_3_LAYOUT.strandingPlaces,
      DEEP_CANAL_3_LAYOUT.movingHazards,
      DEEP_CANAL_3_LAYOUT.rockWalls,
      DEEP_CANAL_3_LAYOUT.fishingBoats,
      DEEP_CANAL_3_LAYOUT.dragNets,
      DEEP_CANAL_3_LAYOUT.mobileSnacks,
      DEEP_CANAL_3_LAYOUT.mobileSnacks?.wanders,
      DEEP_CANAL_3_LAYOUT.mobileSnacks?.homes,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const route of DEEP_CANAL_3_LAYOUT.tilapiaRoutes) for (const point of route) expect(Object.isFrozen(point)).toBe(true);
    for (const route of DEEP_CANAL_3_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const stone of DEEP_CANAL_3_LAYOUT.rockWalls ?? []) expect(Object.isFrozen(stone)).toBe(true);
    for (const spawn of DEEP_CANAL_3_LAYOUT.movingHazards ?? []) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const patch of DEEP_CANAL_3_LAYOUT.hazards) {
      expect(Object.isFrozen(patch), patch.id).toBe(true);
      expect(Object.isFrozen(patch.shape), patch.id).toBe(true);
    }
    for (const boat of DEEP_CANAL_3_LAYOUT.fishingBoats ?? []) {
      expect(Object.isFrozen(boat), boat.id).toBe(true);
      expect(Object.isFrozen(boat.lures), boat.id).toBe(true);
      for (const lure of boat.lures) expect(Object.isFrozen(lure), lure.id).toBe(true);
    }
    for (const net of DEEP_CANAL_3_LAYOUT.dragNets ?? []) {
      for (const part of [net, net.dragNet, net.dragNet.stretch, net.dragNet.hollows, ...net.dragNet.hollows, net.dragNet.timing]) {
        expect(Object.isFrozen(part), net.id).toBe(true);
      }
    }
    for (const wander of DEEP_CANAL_3_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of DEEP_CANAL_3_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
  });

  it('has 52 snacks (8 worms, 8 bugs, 18 tadpoles and 18 shrimp), 2 tilapia, 10 carp, a black bass, a heron, a garter snake, a crayfish, 5 anchor drops, 6 mud seeps, 2 murky patches, 3 fishing boats, 2 drag nets and 15 treasure slots, and no reeds or pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = deepCanal3(seed);
      expect(layout.collectibles).toHaveLength(52);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([8, 8, 18, 18]);
      expect(layout.elements).toEqual([]);
      expect(layout.reeds).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(TILAPIA_IDS);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CARP_IDS.map((id) => [id, DEEP_CANAL_3_CARP]),
      ['bass-0', DEEP_CANAL_3_BASS],
      ['heron-0', DEEP_CANAL_3_HERON],
      ['garter-snake-0', DEEP_CANAL_3_SNAKE],
      ['crayfish-0', DEEP_CANAL_3_CRAYFISH],
    ]);
    expect(movers.map((spawn) => [spawn.id, spawn.type])).toEqual(MOVER_IDS.map((id) => [id, id.includes('anchor') ? ANCHOR_DROP : MUD_SEEP]));
    expect(zone.hazards.map((hazard) => [hazard.id, hazard.type])).toEqual(PATCH_IDS.map((id) => [id, MURKY_WATER]));
    expect(boats.map((boat) => boat.id)).toEqual(BOAT_IDS);
    expect(boats.flatMap((boat) => boat.lures)).toHaveLength(5);
    expect(nets.map((net) => [net.id, net.type])).toEqual(NET_IDS.map((id) => [id, DRAG_NET]));
    expect(DEEP_CANAL_3_LAYOUT.padCount).toBe(0);
    expect(DEEP_CANAL_3_LAYOUT.tilapia).toBe(DEEP_CANAL_3_TILAPIA);
    expect(tripTreasureTuning(DEEP_CANAL_3_AREA_ID).slots).toBe(15);
    expect(DEEP_CANAL_3_LAYOUT.treasures).toBe(DEEP_CANAL_3_TREASURES);
    expect(DEEP_CANAL_3_TREASURES).toHaveLength(13);
  });

  it("plays its tilapia one step up the ladder: a 480 px/s strike reaching 165 px, a 1.6 s cooldown and a 70 px/s patrol, Area 9's 0.8 s warning and full-bar chase", () => {
    expect(DEEP_CANAL_3_TILAPIA).toEqual({ ...DEEP_CANAL_2_TILAPIA, lungeSpeed: 480, lungeRange: 165, cooldown: 1.6, patrolSpeed: 70 });
    expect(DEEP_CANAL_3_TILAPIA.windup).toBe(0.8);
    expect(DEEP_CANAL_3_TILAPIA.chase).toBe(DEEP_CANAL_2_TILAPIA.chase);
    expect(() => tunedSpecies(TILAPIA_SPECIES, DEEP_CANAL_3_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one ladder step up from Area 9's: a 1.5 s cooldown and a 65 px/s patrol, Area 9's other values and chase (ND-4)", () => {
    expect(DEEP_CANAL_3_CARP.id).toBe(CARP_SPECIES.id);
    expect(DEEP_CANAL_3_CARP.tuning).toEqual({ ...DEEP_CANAL_2_CARP.tuning, cooldown: 1.5, patrolSpeed: 65 });
    expect(DEEP_CANAL_3_CARP.tuning.chase).toBe(DEEP_CANAL_2_CARP.tuning.chase);
  });

  it('plays its black bass with the owner values: a 0.8 s warning, a 520 px/s lunge for 0.45 s reaching 185 px, a 1.3 s cooldown, a 70 px/s patrol and the bass chase', () => {
    expect(DEEP_CANAL_3_BASS.id).toBe(BLACK_BASS_SPECIES.id);
    expect(DEEP_CANAL_3_BASS.rules).toEqual(BLACK_BASS_SPECIES.rules);
    expect(DEEP_CANAL_3_BASS.tuning).toEqual({ ...BLACK_BASS, lungeSpeed: 520, lungeRange: 185, cooldown: 1.3, patrolSpeed: 70, chase: BLACK_BASS_CHASE });
    expect(DEEP_CANAL_3_BASS.tuning).toEqual({ ...DEEP_CANAL_2_BASS.tuning, lungeSpeed: 520, lungeRange: 185, cooldown: 1.3, patrolSpeed: 70 });
    expect([DEEP_CANAL_3_BASS.tuning.windup, DEEP_CANAL_3_BASS.tuning.lungeDuration]).toEqual([0.8, 0.45]);
  });

  it("plays its heron, a wading stalker with no chase, one step tighter than Area 3's: a 1.0 s warning, a 120 px stab and a 2.5 s cooldown", () => {
    expect(DEEP_CANAL_3_HERON.id).toBe(HERON_SPECIES.id);
    expect(DEEP_CANAL_3_HERON.rules).toEqual(HERON_SPECIES.rules);
    expect(DEEP_CANAL_3_HERON.neverTouches).toBe(true);
    expect(DEEP_CANAL_3_HERON.tuning).toEqual({ ...HERON, windup: 1.0, lungeRange: 120, lungeSpeed: 120 / HERON.lungeDuration, cooldown: 2.5 });
    expect(DEEP_CANAL_3_HERON.tuning.chase).toBeUndefined();
    expect(DEEP_CANAL_3_HERON.tuning.windup).toBeLessThan(HERON.windup);
    expect(DEEP_CANAL_3_HERON.tuning.windup).toBeGreaterThanOrEqual(HERON.minWindup);
  });

  it('plays its garter snake: a 0.8 s warning, a 380 px/s dart for 0.35 s reaching 115 px, a 1.8 s cooldown, a 60 px/s patrol and the snake chase', () => {
    expect(DEEP_CANAL_3_SNAKE.id).toBe(GARTER_SNAKE_SPECIES.id);
    expect(DEEP_CANAL_3_SNAKE.rules).toEqual(GARTER_SNAKE_SPECIES.rules);
    expect(DEEP_CANAL_3_SNAKE.tuning).toEqual({ ...GARTER_SNAKE, lungeSpeed: 380, lungeRange: 115, cooldown: 1.8, patrolSpeed: 60, chase: GARTER_SNAKE_CHASE });
    expect([DEEP_CANAL_3_SNAKE.tuning.windup, DEEP_CANAL_3_SNAKE.tuning.lungeDuration]).toEqual([0.8, 0.35]);
  });

  it('plays its crayfish: a 0.8 s warning, a 420 px/s pinch for 0.3 s reaching 95 px, a 1.5 s cooldown, a 70 px/s patrol and the crayfish chase', () => {
    expect(DEEP_CANAL_3_CRAYFISH.id).toBe(CRAYFISH_SPECIES.id);
    expect(DEEP_CANAL_3_CRAYFISH.rules).toEqual(CRAYFISH_SPECIES.rules);
    expect(DEEP_CANAL_3_CRAYFISH.tuning).toEqual({ ...CRAYFISH, lungeSpeed: 420, lungeRange: 95, cooldown: 1.5, patrolSpeed: 70, chase: CRAYFISH_CHASE });
    expect([DEEP_CANAL_3_CRAYFISH.tuning.windup, DEEP_CANAL_3_CRAYFISH.tuning.lungeDuration]).toEqual([0.8, 0.3]);
  });

  it('adds exactly one new threat, the trajinera lure, and one new element, the drag net', () => {
    expect(newThingsByArea().find((things) => things.areaId === DEEP_CANAL_3_AREA_ID)).toEqual({
      areaId: DEEP_CANAL_3_AREA_ID,
      threats: ['trajinera-lure'],
      elements: ['drag-net'],
    });
    expect(TRAJINERA_LURE.costsLeg).toBe(true);
  });

  it('names the tilapia, every earlier predator, the murky water, the anchor drop, the mud seep and the lure as its threats, then the drag net, tadpole and shrimp cards', () => {
    const threats = ['tilapia', 'carp', 'black-bass', 'heron', 'garter-snake', 'crayfish', 'murky-water', 'anchor-drop', 'mud-seep', 'trajinera-lure'];
    expect(threatIds(DEEP_CANAL_3_LAYOUT)).toEqual(threats);
    expect(threatIds(zone)).toEqual(threats);
    const cards = threatFactCards(DEEP_CANAL_3_LAYOUT);
    expect(cards[cards.length - 1]).toBe(LURE_FACT);
    const expected = { ids: [...threats, 'drag-net', 'tadpole', 'shrimp'], cards: [...cards, DRAG_NET_FACT, TADPOLE_FACT, SHRIMP_FACT] };
    expect(sourceFactCards(DEEP_CANAL_3_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
  });

  it('holds the Fishing lines and Fishing nets fact cards', () => {
    const titles = sourceFactCards(DEEP_CANAL_3_LAYOUT).cards.map((card) => card.title);
    expect(titles).toEqual(expect.arrayContaining(['Fishing lines', 'Fishing nets']));
  });

  it('is in the deep canal habitat, numbered 10, after Area 9, with the Axolotl statue as its Rare special treasure, no look of its own, no darters and the default stranding chance', () => {
    expect(DEEP_CANAL_3_AREA.layout).toBe(DEEP_CANAL_3_LAYOUT);
    expect(DEEP_CANAL_3_AREA.number).toBe(10);
    expect(DEEP_CANAL_3_AREA.number).toBe(DEEP_CANAL_2_AREA.number + 1);
    expect(DEEP_CANAL_3_AREA.habitatId).toBe(DEEP_CANAL_HABITAT.id);
    expect(DEEP_CANAL_3_AREA.specialTreasureId).toBe('deep-canal/axolotl-statue');
    expect(DEEP_CANAL_3_TREASURES.find((treasure) => treasure.id === DEEP_CANAL_3_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(DEEP_CANAL_3_AREA.look).toBeUndefined();
    expect(DEEP_CANAL_3_AREA.snackDart).toBeUndefined();
    expect(DEEP_CANAL_3_AREA.strandingChance).toBeUndefined();
    expect(areaStrandingChance(DEEP_CANAL_3_AREA)).toBe(STRANDING_CHANCE);
    expect(STRANDING_CHANCE).toBe(0.4);
    expect(Object.isFrozen(DEEP_CANAL_3_AREA)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_3_AREA.exit)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_3_AREA.snackDrift)).toBe(true);
  });

  it("plays Trajinera Waltz, the deep canal cue, with no new cue (M3)", () => {
    expect(tripCueFor(DEEP_CANAL_3_AREA)).toBe(TRAJINERA_WALTZ);
  });

  it('adds two Dream colours, one of them a Legendary sheen, and every new patterned or sheen colour is Legendary (B3)', () => {
    const shells = DEEP_CANAL_3_TREASURES.filter((treasure) => treasure.category === 'paintShell');
    expect(shells).toHaveLength(2);
    expect(shells.some((shell) => shell.rarity === 'legendary' && isPatternedOrSheen(shell))).toBe(true);
    for (const shell of shells.filter(isPatternedOrSheen)) expect(shell.rarity, shell.id).toBe('legendary');
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = deepCanal3(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
      expect(layout.fishingBoats).toEqual(zone.fishingBoats);
      expect(layout.dragNets).toEqual(zone.dragNets);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
    }
  });
});

describe('Area 10 grand tour (the area shape rule)', () => {
  const path = zone.mainPath;
  const leg = (from: number, to: number) => path.slice(from, to + 1);

  it('puts the Home Spot top left, in the first screen column of the top row, with the safe area its column of the top row', () => {
    expect(zone.safeArea).toEqual({ x0: 40, x1: 330, y0: SURF, y1: WORLD_H });
    expect([Math.floor(zone.homeSpot.x / SCREEN_W), rowOf(zone.homeSpot.y)]).toEqual([0, 0]);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
    expect(path[TOUR.home]).toEqual(zone.start);
    expect(path[TOUR.exit]).toEqual({ x: exit.x, y: exit.y });
    for (const point of pathSamples(path, 2)) expect(inBounds(point, zone), `path at ${point.x}, ${point.y}`).toBe(true);
  });

  it('drops down and right from the Home Spot into the fork pocket in the middle row, never going back up or left', () => {
    const drop = leg(TOUR.home, TOUR.forkPocket);
    for (let i = 1; i < drop.length; i++) {
      expect(drop[i].x, `point ${i}`).toBeGreaterThanOrEqual(drop[i - 1].x);
      expect(drop[i].y, `point ${i}`).toBeGreaterThanOrEqual(drop[i - 1].y);
    }
    const pocket = path[TOUR.forkPocket];
    expect(rowOf(pocket.y)).toBe(1);
    expect(pocket.x).toBeLessThan(dividerSpan.x0);
    expect(laneOf(pocket)).toBe('open');
  });

  it('splits two lanes with an old-stone divider of stones at most 640 px wide, each touching the next, between a fork pocket and a join pocket, and swims the upper lane', () => {
    expect(divider).toHaveLength(2);
    for (const stone of divider) expect(stone.x1 - stone.x0).toBeLessThanOrEqual(640);
    for (let i = 1; i < divider.length; i++) expect(divider[i].x0).toBe(divider[i - 1].x1);
    for (let x = dividerSpan.x0; x <= dividerSpan.x1; x += 4) expect(divider.some((stone) => stone.x0 <= x && x <= stone.x1), `column ${x}`).toBe(true);
    expect(dividerSpan.x1 - dividerSpan.x0).toBeGreaterThanOrEqual(2 * SCREEN_W);
    const lane = pathSamples(leg(TOUR.laneMouth, TOUR.joinPocket), 2).filter((point) => point.x >= dividerSpan.x0 && point.x <= dividerSpan.x1);
    expect(lane.length).toBeGreaterThan(0);
    for (const point of lane) expect(laneOf(point), `path at ${point.x}, ${point.y}`).toBe('upper');
    expect(path[TOUR.joinPocket].x).toBeGreaterThan(dividerSpan.x1);
    expect(laneOf(path[TOUR.forkPocket])).toBe('open');
  });

  it('makes a U-turn: east along the top row past the join pocket, then down and back west', () => {
    const [east, turn, west] = [path[TOUR.uTurnEast], path[TOUR.uTurnDown], path[TOUR.uTurnWest]];
    expect(east.x).toBeGreaterThan(path[TOUR.joinPocket].x);
    expect(rowOf(path[TOUR.joinPocket + 1].y)).toBe(0);
    expect(rowOf(east.y)).toBe(0);
    expect(turn.x).toBe(east.x);
    expect(west.y).toBe(turn.y);
    expect(west.x).toBeLessThan(turn.x - SCREEN_W / 2);
  });

  it('descends through all three rows from the top of the U-turn to the bottom row, never going back up', () => {
    const descent = leg(TOUR.joinPocket + 1, TOUR.climbFoot);
    for (let i = 1; i < descent.length; i++) expect(descent[i].y, `point ${i}`).toBeGreaterThanOrEqual(descent[i - 1].y);
    expect(new Set(pathSamples(descent, 2).map((point) => rowOf(point.y)))).toEqual(new Set([0, 1, 2]));
    expect(rowOf(path[TOUR.descentEnd].y)).toBe(2);
  });

  it('climbs back up from the bottom row to the top row through a clear opening, out of every strike and touch', () => {
    const [foot, top] = [path[TOUR.climbFoot], path[TOUR.climbTop]];
    expect(foot.x).toBe(top.x);
    expect([rowOf(foot.y), rowOf(top.y)]).toEqual([2, 0]);
    for (const point of pathSamples([foot, top], 2)) {
      for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(point, route.waypoints), `${route.id} at ${point.y}`).toBeGreaterThan(strike);
      for (const spawn of movers) expect(shapeDistance(point, movingHazardSweep(spawn)), `${spawn.id} at ${point.y}`).toBeGreaterThan(spawn.type.touchReach);
      for (const shape of [...lurePaths, ...netSweeps, ...patches.map((patch) => patch.shape)]) expect(shapeDistance(point, shape)).toBeGreaterThan(0);
    }
  });

  it('forks at the hub at the top right: the main branch drops to the exit, and the treasure branch runs on east to a dead end past the side-canal inflow', () => {
    const hub = path[TOUR.hubFork];
    const current = zone.currents[0];
    expect(rowOf(hub.y)).toBe(0);
    expect(current.x0).toBeGreaterThan(hub.x);
    expect(current.force.x).toBeLessThan(0);
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past).toHaveLength(5);
    for (const spot of past) {
      expect(spot.x, spot.id).toBeGreaterThan(current.x1);
      expect(spot.x, spot.id).toBeGreaterThan(exit.x);
      expect(distanceToPath(spot, path), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
    for (const point of pathSamples(path, 2)) expect(point.x, `path at ${point.x}, ${point.y}`).toBeLessThan(current.x0);
  });

  it('puts the exit at the east end, low, in the last screen column, with its gate on the bed (#183)', () => {
    expect(exit).toEqual({ x: 4380, y: 940, radius: 40 });
    expect(Math.floor(exit.x / SCREEN_W)).toBe(zone.chunks - 1);
    expect(zone.bedTop - exit.y).toBeLessThanOrEqual(158);
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: zone.bedTop });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
  });

  it('lets a one-leg axolotl swim the main path from the Home Spot to the exit with no hit: out of every strike, past every timed anchor, seep, lure and drag net', () => {
    for (const point of pathSamples(path, 2)) {
      for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(point, route.waypoints), `${route.id} at ${point.x}, ${point.y}`).toBeGreaterThan(strike);
    }
    const run = firstClearRun();
    expect(run, 'every start time is hit').not.toBeNull();
    expect(run?.start).toBe(ONE_LEG_RUN.start);
    expect(run?.seconds).toBeCloseTo(ONE_LEG_RUN.seconds, 1);
    expect(run?.seconds ?? Infinity).toBeLessThan(BEAT_MAX_SECONDS);
  });
});

describe('Area 10 exit', () => {
  it('keeps the exit out of every predator strike, clear of every moving hazard, the current, every murky patch, every lure and its line and every drag-net stretch', () => {
    for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    for (const spawn of movers) expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + spawn.type.touchReach);
    for (const current of zone.currents) expect(shapeDistance(exit, rectOf(current))).toBeGreaterThan(exit.radius);
    for (const patch of patches) expect(shapeDistance(exit, patch.shape), patch.id).toBeGreaterThan(exit.radius);
    for (const shape of [...lurePaths, ...lureLines]) expect(shapeDistance(exit, shape)).toBeGreaterThan(exit.radius + LURES.eatReach);
    for (const sweep of netSweeps) expect(shapeDistance(exit, sweep)).toBeGreaterThan(exit.radius);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of deepCanal3(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 10 danger bar', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats and water as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = deepCanal3(seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.rockWalls).toEqual(zone.rockWalls);
    expect(layout.safeArea).toEqual(zone.safeArea);
  });

  it('has 27 moving threats for its 30 screens, at least ceil(0.75 x 30) = 23, 6 predator types and 2 moving hazard types, and every predator chases but the heron, built never to', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(30);
    expect(Math.ceil(0.75 * screens)).toBe(23);
    expect(movingThreatCount(zone)).toBe(27);
    expect(zone.tilapiaRoutes.length + zone.predatorRoutes.length).toBe(16);
    expect(movers).toHaveLength(11);
    expect(predatorTypeCount(zone)).toBe(6);
    expect(movingHazardTypeCount(zone)).toBe(2);
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) {
      if (route.species.id === HERON_SPECIES.id) expect(route.species.tuning.chase, route.id).toBeUndefined();
      else expect(route.species.tuning.chase, route.id).toBeDefined();
    }
  });

  it('never counts a murky patch, a lure or a drag net as a moving threat', () => {
    const bare: ZoneLayout = { ...zone, hazards: [], fishingBoats: [], dragNets: [] };
    expect(movingThreatCount(bare)).toBe(movingThreatCount(zone));
    expect(longestQuietSwim(bare)).toEqual(longestQuietSwim(zone));
  });

  it('never leaves a quiet swim in the whole water longer than one screen across', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 1);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it("passes each lane alone: no quiet swim longer than one screen across in either lane, counting only that lane's threats", () => {
    const upper = longestQuietSwim(laneGeometry(zone, 'upper'));
    const lower = longestQuietSwim(laneGeometry(zone, 'lower'));
    expect(upper?.length).toBeCloseTo(LANE_QUIET_SWIM.upper, 1);
    expect(lower).toBe(LANE_QUIET_SWIM.lower);
    for (const swim of [upper, lower]) expect(swim?.length ?? 0).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('keeps its own predators in each lane: the heron, the snake and two carp in the upper lane, a tilapia and two carp in the lower lane', () => {
    const lanes = Object.fromEntries([...zone.tilapiaRoutes, ...zone.predatorRoutes].map((route) => [route.id, loopLane(route.waypoints)]));
    expect(Object.keys(lanes).filter((id) => lanes[id] === 'upper')).toEqual(['carp-2', 'carp-5', 'heron-0', 'garter-snake-0']);
    expect(Object.keys(lanes).filter((id) => lanes[id] === 'lower')).toEqual(['tilapia-1', 'carp-3', 'carp-7']);
    expect(Object.values(lanes)).not.toContain('both');
  });

  it('patrols every depth: each tilapia, carp and bass loop reaches 24 px into two bands, each species together reaches all three, and the one bass loop reaches all three alone', () => {
    const bands = depthBands(zone);
    expect(meetsDepthRule(zone)).toBe(true);
    const reached = (route: TilapiaRoute) =>
      bands.filter((band) => {
        const ys = route.waypoints.map((point) => point.y);
        return Math.min(Math.max(...ys), band.bottom) - Math.max(Math.min(...ys), band.top) >= 24;
      });
    for (const routes of [zone.tilapiaRoutes, routesOf(zone, CARP_SPECIES.id), routesOf(zone, BLACK_BASS_SPECIES.id)]) {
      for (const route of routes) expect(reached(route).length, route.id).toBeGreaterThanOrEqual(2);
      expect(new Set(routes.flatMap((route) => reached(route))).size).toBe(3);
    }
    const [bass] = routesOf(zone, BLACK_BASS_SPECIES.id);
    expect(reached(bass)).toHaveLength(3);
  });

  it('has surface danger and keeps the floor lane quiet for no more than one screen across', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBeCloseTo(FLOOR_QUIET_STRETCH, 1);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('has 10 carp for its 30 screens, the carp target', () => {
    expect(carpTarget(30)).toBe(10);
    expect(carpCount(zone)).toBe(10);
  });

  it('keeps the heron and the snake on surface stretches and the crayfish on the floor lane, and every loop in the water, out of the safe area and clear of the rock', () => {
    const [heron] = routesOf(zone, HERON_SPECIES.id);
    const [snake] = routesOf(zone, GARTER_SNAKE_SPECIES.id);
    const [crayfish] = routesOf(zone, CRAYFISH_SPECIES.id);
    expect(heron.waypoints.map((point) => point.y)).toEqual([120, 120]);
    expect(snake.waypoints.map((point) => point.y)).toEqual([100, 100]);
    expect(crayfish.waypoints.map((point) => point.y)).toEqual([bounds.maxY, bounds.maxY]);
    for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) {
      const body = route.id.startsWith('tilapia') ? DEEP_CANAL_3_TILAPIA.bodyRadius : (route as PredatorRoute).species.tuning.bodyRadius;
      for (const point of loopSamples(route.waypoints)) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
        for (const stone of divider) expect(shapeDistance(point, rectOf(stone)), route.id).toBeGreaterThanOrEqual(body);
      }
    }
  });
});

describe('Area 10 anchor drops and mud seeps', () => {
  it('lowers each anchor from the surface at most 320 px, and sends each mud seep up from the bed at most 260 px', () => {
    for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(SURF);
      expect(movingHazardDepth(spawn), spawn.id).toBeLessThanOrEqual(320);
    }
    for (const spawn of movers.filter((each) => each.type === MUD_SEEP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(zone.bedTop);
      expect(movingHazardDepth(spawn), spawn.id).toBeLessThanOrEqual(260);
    }
  });

  it('keeps every sweep in the water, out of the safe area and the rock, clear of every murky patch, lure and drag-net stretch', () => {
    for (const spawn of movers) {
      const sweep = movingHazardSweep(spawn);
      expect(rectDistance(sweep, rectOf(safeArea)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
      expect(sweep.x0, spawn.id).toBeGreaterThan(bounds.minX);
      expect(sweep.x1, spawn.id).toBeLessThan(bounds.maxX);
      for (const stone of divider) expect(rectDistance(sweep, rectOf(stone)), spawn.id).toBeGreaterThan(0);
      for (const shape of [...patches.map((patch) => patch.shape), ...lurePaths, ...netSweeps]) expect(rectDistance(sweep, shape), spawn.id).toBeGreaterThan(spawn.type.touchReach);
    }
  });
});

describe('Area 10 murky water (issue #107, carried forward)', () => {
  const routePatches = patches.filter((patch) => pathSamples(zone.mainPath, 2).some((point) => insideMurky(point, [patch])));

  it('has two fixed murky patches, each costing no leg on touch, in the water and out of the safe area', () => {
    for (const patch of patches) {
      expect(patch.type.costsLeg, patch.id).toBe(false);
      expect(rectDistance(patch.shape, rectOf(safeArea)), patch.id).toBeGreaterThan(0);
    }
    expect(zoneThreats(zone)).toHaveLength(zoneThreats({ ...zone, hazards: [] }).length);
    for (const id of PATCH_IDS) expect(obstaclesOf(zone).map((obstacle) => obstacle.id)).not.toContain(id);
  });

  it('puts the first patch on the main path, at most 200 px wide, which a one-leg axolotl crosses along the path in under 3 s', () => {
    expect(routePatches.map((patch) => patch.id)).toEqual(PATCH_IDS.slice(0, 1));
    const oneLegSpeed = SWIM.maxSpeed * LEGS.speedByLegs[0];
    const [patch] = routePatches;
    const width = patch.shape.x1 - patch.shape.x0;
    expect(width).toBeLessThanOrEqual(ROUTE_PATCH_MAX_WIDTH);
    expect(murkyCrossSeconds(width)).toBeLessThan(MURKY_WATER_TIMING.legAt);
    expect(pathLengthInside(patch.shape) / oneLegSpeed).toBeLessThan(MURKY_WATER_TIMING.legAt);
    expect(pathLengthInside(patch.shape) / oneLegSpeed).toBeCloseTo(4 / 3, 2);
  });

  it('puts the second, wider patch over the sunken hull cave, a treasure dead end on the lower-lane bed off the main path', () => {
    const [, wide] = patches;
    expect(wide.shape.x1 - wide.shape.x0).toBeGreaterThan(ROUTE_PATCH_MAX_WIDTH);
    expect(laneOf({ x: wide.shape.x0, y: wide.shape.y0 })).toBe('lower');
    expect(rectDistance(wide.shape, rectOf(zone.cave))).toBe(0);
    for (const spot of zone.spots.filter((each) => each.cover === 'cave')) expect(insideMurky(spot, [wide]), spot.id).toBe(true);
    for (const point of pathSamples(zone.mainPath, 2)) expect(insideMurky(point, [wide])).toBe(false);
  });
});

describe('Area 10 trajinera lures (issue #108, ND-1)', () => {
  it('hangs 5 lures from 3 fishing trajineras drifting slowly across spans longer than a hull, at most one lure at each end of a hull', () => {
    expect(boats.map((boat) => boat.lures.length)).toEqual([1, 2, 2]);
    for (const boat of boats) {
      expect(boat.speed, boat.id).toBe(LURES.driftSpeed);
      expect(boat.x1 - boat.x0, boat.id).toBeGreaterThan(LURES.hullLength);
      expect(boat.lures.map((lure) => lure.along).every((along) => along === 0 || along === LURES.hullLength), boat.id).toBe(true);
      expect(new Set(boat.lures.map((lure) => lure.along)).size, boat.id).toBe(boat.lures.length);
    }
  });

  it('keeps every lure out of every predator strike, the safe area, the rock, the current and every murky patch and drag-net stretch', () => {
    for (const [index, shape] of lurePaths.entries()) {
      for (const { route, strike } of strikeRoutes(zone)) expect(shapeRouteDistance(shape, route.waypoints), `lure ${index} to ${route.id}`).toBeGreaterThan(strike);
      for (const line of [shape, lureLines[index]]) {
        expect(rectDistance(line, rectOf(safeArea)), `lure ${index}`).toBeGreaterThan(0);
        for (const stone of divider) expect(rectDistance(line, rectOf(stone)), `lure ${index}`).toBeGreaterThan(0);
        for (const current of zone.currents) expect(rectDistance(line, rectOf(current)), `lure ${index}`).toBeGreaterThan(0);
        for (const other of [...patches.map((patch) => patch.shape), ...netSweeps]) expect(rectDistance(line, other), `lure ${index}`).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a fishing boat overlap another surface boat: the other fishing boats, the moored rows, the anchor drops and the drag-net boats', () => {
    const spans = boats.map(boatSpan);
    for (const [index, span] of spans.entries()) {
      for (const [other, otherSpan] of spans.entries()) if (other !== index) expect(span.x1 < otherSpan.x0 || otherSpan.x1 < span.x0, BOAT_IDS[index]).toBe(true);
      for (const moored of zone.bankOverhangs ?? []) expect(span.x1 < moored.x0 || moored.x1 < span.x0, BOAT_IDS[index]).toBe(true);
      for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
        expect(Math.min(Math.abs(span.x0 - spawn.x), Math.abs(span.x1 - spawn.x)), `${BOAT_IDS[index]} to ${spawn.id}`).toBeGreaterThanOrEqual(LURES.hullLength);
        expect(span.x0 <= spawn.x && spawn.x <= span.x1, `${BOAT_IDS[index]} over ${spawn.id}`).toBe(false);
      }
      for (const sweep of netSweeps) {
        const edges = [sweep.x0, sweep.x1];
        for (const edge of edges) expect(Math.min(Math.abs(span.x0 - edge), Math.abs(span.x1 - edge)), BOAT_IDS[index]).toBeGreaterThanOrEqual(LURES.hullLength);
        expect(span.x1 < sweep.x0 || sweep.x1 < span.x0, BOAT_IDS[index]).toBe(true);
      }
    }
  });

  it('is a hiding-risk threat and a gap obstacle, but never a danger-bar threat', () => {
    expect(zoneThreats(zone).length - zoneThreats({ ...zone, fishingBoats: [] }).length).toBe(5);
    const ids = obstaclesOf(zone).map((obstacle) => obstacle.id);
    for (const lure of boats.flatMap((boat) => boat.lures)) expect(ids).toContain(lure.id);
  });
});

describe('Area 10 drag nets (issue #108, ND-2)', () => {
  it('works two stretches on the main path, each with two safe hollows: the first on the default 4 s quiet, 1 s warning and 2.5 s sweep, the second on a 3 s quiet, 1 s warning and 2 s sweep', () => {
    expect(nets.map((net) => net.dragNet.timing)).toEqual([DRAG_NETS, { quietFor: 3, warnFor: 1, sweepFor: 2 }]);
    for (const net of nets) {
      expect(net.dragNet.hollows, net.id).toHaveLength(2);
      for (const hollow of net.dragNet.hollows) expect(rectDistance(hollow, net.dragNet.stretch), net.id).toBe(0);
      expect(pathSamples(zone.mainPath, 2).some((point) => inRect(point, net.dragNet.stretch)), net.id).toBe(true);
    }
  });

  it('is fair from every point of every stretch: a one-leg axolotl starting at the warning reaches a hollow or leaves before the front (dragNetUnfairPoint)', () => {
    for (const net of nets) expect(dragNetUnfairPoint(net, bounds), net.id).toBeNull();
  });

  it('keeps every stretch in the water, out of the safe area and the rock, and is a hiding-risk threat but never a gap obstacle or a danger-bar threat', () => {
    for (const sweep of netSweeps) {
      expect(inBounds({ x: sweep.x0, y: sweep.y0 }, zone)).toBe(true);
      expect(inBounds({ x: sweep.x1, y: sweep.y1 }, zone)).toBe(true);
      expect(rectDistance(sweep, rectOf(safeArea))).toBeGreaterThan(0);
      for (const stone of divider) expect(rectDistance(sweep, rectOf(stone))).toBeGreaterThan(0);
    }
    expect(zoneThreats(zone).length - zoneThreats({ ...zone, dragNets: [] }).length).toBe(2);
    const ids = obstaclesOf(zone).map((obstacle) => obstacle.id);
    for (const id of NET_IDS) expect(ids).not.toContain(id);
    const bare: ZoneLayout = { ...zone, dragNets: [] };
    expect(movingThreatCount(bare)).toBe(movingThreatCount(zone));
  });
});

describe('Area 10 hiding spots (B5, B6, B10)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, with the turn clearance, for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('deep-canal-3/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it('bands every spot by its riskiest threat: Common over S + 60 from all, Rare over S, Epic over S / 2, Legendary within S / 2 of one', () => {
    for (const spot of zone.spots) {
      const bands = zoneThreats(zone).map((threat) => ({
        distance: threat.kind === 'route' ? routeLoopDistance(spot, threat.route.waypoints) : shapeDistance(spot, threat.shape),
        band: riskBands(threat.strike)[spot.rarity],
      }));
      for (const { distance, band } of bands) expect(distance, spot.id).toBeGreaterThan(band.over);
      expect(bands.some(({ distance, band }) => distance <= band.upTo), spot.id).toBe(true);
    }
  });

  it('has 6 Common, 5 Rare, 3 Epic and 4 Legendary spots, every pool larger than its Area 10 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([6, 5, 3, 4]);
    expect(RARITIES.map((rarity) => DEEP_CANAL_3_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    for (const rarity of RARITIES) {
      const treasures = DEEP_CANAL_3_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides Commons under the moored rows by the main path, over carp-2 and on the way to the hub, and Rares under the moored row by the fork pocket anchors, off the path', () => {
    const shallow = zone.spots.filter((spot) => spot.rarity === 'common' || spot.rarity === 'rare');
    for (const spot of shallow) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(spot.container, spot.id).toBe(false);
      expect(distanceToPath(spot, zone.mainPath) <= MAIN_PATH_REACH, spot.id).toBe(spot.rarity === 'common');
    }
    for (const moored of zone.bankOverhangs ?? []) expect(moored.y0, 'moored rows float at the surface').toBe(SURF);
  });

  it('puts an open Legendary spot and an Epic spot in the sunken hull cave under the wide murky patch, the Legendary within half the strike of tilapia-1', () => {
    const cave = zone.spots.filter((spot) => spot.cover === 'cave');
    expect(cave.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [1540, 975, 'legendary', false],
      [1660, 1000, 'epic', false],
    ]);
    expect(zone.cave).toEqual({ id: 'deep-canal-3/cave', x0: 1480, x1: 1680, y0: 950, y1: zone.bedTop });
    expect(laneOf({ x: zone.cave.x0, y: zone.cave.y0 })).toBe('lower');
    const tilapia = zone.tilapiaRoutes.find((route) => route.id === 'tilapia-1');
    if (!tilapia) throw new Error('no route tilapia-1');
    expect(routeLoopDistance(cave[0], tilapia.waypoints)).toBeLessThanOrEqual(DEEP_CANAL_3_TILAPIA.lungeRange / 2);
  });

  it('puts three open Legendary spots just past the side-canal inflow, within half the strike of carp-9, and two Epic spots past it farther off', () => {
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [4650, 220, 'legendary', false],
      [4650, 280, 'legendary', false],
      [4650, 340, 'legendary', false],
      [4580, 250, 'epic', false],
      [4580, 320, 'epic', false],
    ]);
    const [carp] = zone.predatorRoutes.filter((route) => route.id === 'carp-9');
    for (const spot of past) {
      expect(coversAt(spot, zone), spot.id).toEqual(['pastCurrent']);
      const away = routeLoopDistance(spot, carp.waypoints);
      if (spot.rarity === 'legendary') expect(away, spot.id).toBeLessThanOrEqual(DEEP_CANAL_3_CARP.tuning.lungeRange / 2);
      else expect(away, spot.id).toBeGreaterThan(DEEP_CANAL_3_CARP.tuning.lungeRange / 2);
    }
  });

  it('has no Dash pot: every Legendary spot is in the open, deep and near a threat, so the Legendary rule needs none (ADR 0032)', () => {
    expect(zone.spots.filter((spot) => spot.container)).toEqual([]);
    for (const spot of zone.spots.filter((each) => each.rarity === 'legendary')) expect(['cave', 'pastCurrent'], spot.id).toContain(spot.cover);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot, layout), spot.id).toBe(true);
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

  it.each(poolSpots(zone))("finds a safe start on #130's relaxed rule past every predator reach and every moving hazard, out of the rock, for $id", (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(isSafeStart(start, zone)).toBe(true);
    expect(reachMargin(start, zone)).toBeGreaterThan(0);
    for (const stone of divider) expect(inRect(start, stone)).toBe(false);
  });
});

describe('Area 10 placing treasure (B4)', () => {
  const tuning = tripTreasureTuning(DEEP_CANAL_3_AREA_ID);
  const options = { extras: [DEEP_CANAL_3_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 15 slots, the lost treasures and the Axolotl statue', () => {
    const all = DEEP_CANAL_3_TREASURES.map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(DEEP_CANAL_3_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('puts the 3 Legendaries in 3 distinct Legendary spots when all 13 treasures must be placed, the cave spot on some trips', () => {
    const all = DEEP_CANAL_3_TREASURES.map((treasure) => treasure.id);
    const legendaryIds = DEEP_CANAL_3_TREASURES.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id);
    const legendarySpotIds = zone.spots.filter((spot) => spot.rarity === 'legendary').map((spot) => spot.id);
    const caveId = zone.spots.find((spot) => spot.rarity === 'legendary' && spot.cover === 'cave')?.id;
    const used = new Set<string>();
    for (const tripSeed of TRIP_SEEDS) {
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      const legendarySpots = lost.filter((find) => legendaryIds.includes(find.id)).map((find) => find.spotId);
      expect(legendarySpots, `trip seed ${tripSeed}`).toHaveLength(legendaryIds.length);
      expect(new Set(legendarySpots).size, `trip seed ${tripSeed}`).toBe(legendaryIds.length);
      for (const spotId of legendarySpots) expect(legendarySpotIds, `trip seed ${tripSeed}`).toContain(spotId);
      for (const spotId of legendarySpots) used.add(spotId);
    }
    expect(caveId).toBeDefined();
    expect(used.has(caveId ?? '')).toBe(true);
  });

  it('leaves few of the 15 slots empty over 200 fresh trips', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 10 side-canal inflow and stranding places', () => {
  it("flows to the left at 72 px/s, as strong as Area 9's, which one leg still beats by 18 px/s, off the main path in the hub's dead end", () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -72, y: 0 });
    expect(Math.abs(current.force.x)).toBeGreaterThanOrEqual(Math.abs(area9.currents[0].force.x));
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(18);
    for (const point of pathSamples(zone.mainPath, 4)) expect(isInsideCurrent(point, current)).toBe(false);
    for (const patch of patches) expect(rectDistance(rectOf(current), patch.shape), patch.id).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)(
    'keeps about six stranding places 80 px from every route, clear of every sweep, the spots, the current, every murky patch, lure, line and drag-net stretch for seed %i',
    (seed) => {
      const layout = deepCanal3(seed);
      expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `deep-canal-3/strand-${n}`));
      for (const place of layout.strandingPlaces) {
        expect(inBounds(place, layout), place.id).toBe(true);
        expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
        expect(laneOf(place), place.id).not.toBe('rock');
        expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
        expect(insideMurky(place, patches), place.id).toBe(false);
        for (const shape of [...lurePaths, ...lureLines, ...netSweeps]) expect(shapeDistance(place, shape), place.id).toBeGreaterThan(RESCUE.reachRadius + LURES.eatReach);
        expect(routeDistance(place, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
        for (const spawn of layout.movingHazards ?? []) {
          expect(shapeDistance(place, movingHazardSweep(spawn)), `${place.id} to ${spawn.id}`).toBeGreaterThanOrEqual(STRAND_HAZARD_CLEARANCE);
        }
        for (const spot of layout.spots) {
          expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
        }
      }
    },
  );
});

describe('Area 10 gaps and routes (the level layout ladder)', () => {
  it("climbs between anchor-drop-4 and bass-0 through a gap tighter than Area 9's narrowest and never under the safe passing width", () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe('deep-canal-3/anchor-drop-4 and bass-0');
    expect(narrowest.width).toBeCloseTo(39, 9);
    expect(narrowest.width).toBeLessThan(narrowestPathGap(area9).width);
    expect(SAFE_PASSING_WIDTH).toBe(36);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('holds treasure off the main path in three dead ends: the sunken hull cave in the lower lane, the water past the inflow and the moored row by the fork pocket', () => {
    for (const spot of zone.spots.filter((each) => each.rarity !== 'common')) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
  });

  it.each(ALL_SEEDS)('puts snacks in both lanes and every screen column for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    for (const lane of ['upper', 'lower'] as const) {
      expect(layout.collectibles.filter((snack) => laneOf(snack) === lane).length, lane).toBeGreaterThanOrEqual(1);
    }
    for (let column = 0; column < layout.chunks; column++) {
      expect(layout.collectibles.some((snack) => Math.floor(snack.x / SCREEN_W) === column), `column ${column}`).toBe(true);
    }
  });
});

describe('Area 10 snacks', () => {
  const drift = DEEP_CANAL_3_AREA.snackDrift;
  const surfacePeak = 80 + 1.6 + 0.8;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every murky patch, lure, line and drag-net stretch, and out of the rock, for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    expect(layout.collectibles).toHaveLength(52);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      for (const shape of [...patches.map((patch) => patch.shape), ...lurePaths, ...lureLines, ...netSweeps]) {
        expect(shapeDistance(snack, shape), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
      for (const stone of divider) expect(shapeDistance(snack, rectOf(stone)), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of layout.movingHazards ?? []) expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the inflow, and only worms and bugs in it, for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(DEEP_CANAL_3_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    const items = createCollectibles(layout.collectibles);
    for (let t = 0; t <= 120; t += 0.5) {
      for (let index = 0; index < items.length; index++) {
        const snack = { x: snackX(items[index], index, t, drift, bounds), y: snackY(items[index], index, t, drift, bounds) };
        expect(inBounds(snack, layout)).toBe(true);
        expect(snack.y).toBeGreaterThan(surfacePeak);
        expect(inHomeSpot(snack, layout.homeSpot)).toBe(false);
      }
    }
  });

  it('drift a little faster than Area 9, slower than a one-leg axolotl swims against the inflow, and at most half the magnet pull', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(zone.currents[0].force.x);
    expect(drift).toEqual({ ...DEEP_CANAL_2_AREA.snackDrift, periodX: 6.7, periodY: 5.36 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_2_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('has no one-time darters: no dart rule, and its shrimp replace them', () => {
    expect(oneTimeDarts(DEEP_CANAL_3_AREA, zone)).toBeNull();
  });

  it.each(ALL_SEEDS)(
    'gives every shrimp a clear place, and every hop spot of its home a flick landing isShrimpFlickLandingClear allows in at least one of 8 directions, for seed %i',
    (seed) => {
      const layout = deepCanal3(seed);
      const avoid = mobileSnackAvoid(layout);
      const rule = layout.mobileSnacks?.shrimp;
      if (!rule) throw new Error('Area 10 has no shrimp rule');
      const homes = layout.mobileSnacks?.homes ?? [];
      expect(homes).toHaveLength(18);
      for (const home of homes) {
        const place = home.points[0];
        expect(mobileSnackClear(shrimpBox(place, drift), avoid), `shrimp at ${place.x}, ${place.y}`).toBe(true);
        for (const spot of home.points) {
          const lands = flickTargets(spot, rule.flickDistance).some((target) => isShrimpFlickLandingClear(spot.x, spot.y, home.points, target, drift, avoid, rule));
          expect(lands, `shrimp at ${spot.x}, ${spot.y}`).toBe(true);
        }
      }
    },
  );
});

describe('Area 10 mobile snacks', () => {
  const mix = zone.mobileSnacks;
  const drift = DEEP_CANAL_3_AREA.snackDrift;
  const keepAways = [...patches.map((patch) => patch.shape), ...lurePaths, ...lureLines, ...netSweeps];

  it('meets the later row of the snack ramp: 36 of its 52 snacks mobile, 69.2%, at most 0.7, its tadpoles at 72 px/s (ND-8)', () => {
    expect(meetsSnackRamp(10, DEEP_CANAL_3_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(36);
    const share = mobile / zone.collectibles.length;
    expect(share).toBeCloseTo(0.692, 3);
    expect(share).toBeGreaterThan(0.6875);
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(DEEP_CANAL_3_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('swims eighteen tadpoles on wander loops of 4 points, each leg 1.5 to 5 s, each an eighteenth of its own lap further on than the last', () => {
    const wanders = mix?.wanders ?? [];
    const speed = mix?.tadpole?.speed ?? 0;
    expect(wanders).toHaveLength(18);
    for (const [index, wander] of wanders.entries()) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      expect(wander.points.length, label).toBe(4);
      const legs = loopLegLengths(wander.points);
      for (const each of legs) {
        expect(each, label).toBeGreaterThanOrEqual(TADPOLES.minLegSeconds * speed);
        expect(each, label).toBeLessThanOrEqual(TADPOLES.maxLegSeconds * speed);
      }
      const lapSeconds = legs.reduce((sum, each) => sum + each, 0) / speed;
      expect(lapSeconds, label).toBeLessThanOrEqual(TADPOLES.maxLapSeconds);
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 18, 9);
    }
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall, never across the divider', () => {
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      const box = homeBoxOf(wander.points);
      expect(box.x1 - box.x0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
      expect(crossesDivider(wander.points), label).toBe(false);
    }
  });

  it('keeps every tadpole loop and every shrimp home out of the inflow and SNACK_HAZARD_CLEARANCE from every murky patch, lure, line and drag-net stretch', () => {
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      for (const box of legBoxesOf(wander.points)) {
        for (const current of zone.currents) expect(rectDistance(box, rectOf(current)), label).toBeGreaterThan(0);
        for (const shape of keepAways) expect(rectDistance(box, shape), label).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
    for (const home of mix?.homes ?? []) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      for (const spot of home.points) {
        const box = shrimpBox(spot, drift);
        for (const current of zone.currents) expect(rectDistance(box, rectOf(current)), label).toBeGreaterThan(0);
        for (const shape of keepAways) expect(rectDistance(box, shape), label).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('lets a one-leg axolotl catch every tadpole within 20 s (the one-leg catch proof)', () => {
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) {
      expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
  });

  it("gives its eighteen shrimp Area 9's shrimp rule, on homes of 3 hop spots in a box at most 200 x 160 px", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    expect(mix?.shrimp).toEqual(DEEP_CANAL_2_LAYOUT.mobileSnacks?.shrimp);
    const homes = mix?.homes ?? [];
    expect(homes).toHaveLength(18);
    for (const home of homes) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      expect(home.points, label).toHaveLength(3);
      const box = homeBoxOf(home.points);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = deepCanal3(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(86.4, 9);
  });
});

describe('Area 10 difficulty', () => {
  it('is harder than Area 9: more snacks, faster drift, more slots, stronger tilapia, carp and bass, more moving threats and a tighter gap', () => {
    expect(zone.collectibles.length).toBeGreaterThan(area9.collectibles.length);
    expect(snackDriftMaxSpeed(DEEP_CANAL_3_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_2_AREA.snackDrift));
    expect(tripTreasureTuning(DEEP_CANAL_3_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(DEEP_CANAL_2_AREA.id).slots);
    expect(DEEP_CANAL_3_TILAPIA.lungeRange).toBeGreaterThan(DEEP_CANAL_2_TILAPIA.lungeRange);
    expect(DEEP_CANAL_3_TILAPIA.cooldown).toBeLessThan(DEEP_CANAL_2_TILAPIA.cooldown);
    expect(DEEP_CANAL_3_CARP.tuning.cooldown).toBeLessThan(DEEP_CANAL_2_CARP.tuning.cooldown);
    expect(DEEP_CANAL_3_CARP.tuning.patrolSpeed).toBeGreaterThan(DEEP_CANAL_2_CARP.tuning.patrolSpeed);
    expect(DEEP_CANAL_3_BASS.tuning.lungeSpeed).toBeGreaterThan(DEEP_CANAL_2_BASS.tuning.lungeSpeed);
    expect(DEEP_CANAL_3_BASS.tuning.cooldown).toBeLessThan(DEEP_CANAL_2_BASS.tuning.cooldown);
    expect(movingThreatCount(zone)).toBeGreaterThan(movingThreatCount(area9));
    expect(narrowestPathGap(zone).width).toBeLessThan(narrowestPathGap(area9).width);
  });
});
