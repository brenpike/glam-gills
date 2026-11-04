import { describe, expect, it } from 'vitest';
import {
  DEEP_CANAL_3_AREA,
  DEEP_CANAL_4_AREA,
  DEEP_CANAL_HABITAT,
  areaTimeOfDay,
  newThingsByArea,
  sourceFactCards,
  threatFactCards,
  threatIds,
} from './areas';
import { DEEP_CANAL_4_TREASURES, RARITIES, dreamColourById, type Treasure } from './catalogue';
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
import { DEEP_CANAL_3_BASS, DEEP_CANAL_3_CARP, DEEP_CANAL_3_LAYOUT, DEEP_CANAL_3_TILAPIA } from './deepCanal3Layout';
import {
  DEEP_CANAL_4_AREA_ID,
  DEEP_CANAL_4_BASS,
  DEEP_CANAL_4_CARP,
  DEEP_CANAL_4_CORMORANT,
  DEEP_CANAL_4_LAYOUT,
  DEEP_CANAL_4_TILAPIA,
} from './deepCanal4Layout';
import { currentAt } from './environment';
import { exitGateBase } from './exitGate';
import { CORMORANT_FACT, LURE_FACT, SHRIMP_FACT, TADPOLE_FACT } from './factCards';
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
  mobileSnackShare,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpBox,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
} from './mobileSnacks';
import { MUSIC_CUES, TRAJINERA_WALTZ, tripCueFor } from './music';
import { ANCHOR_DROP, MUD_SEEP, movingHazardBaseY, movingHazardDepth, movingHazardPeriod, movingHazardSweep, movingHazardTouches } from './movingHazards';
import { MURKY_WATER, MURKY_WATER_TIMING, insideMurky, murkyCrossSeconds, murkyPatches } from './murkyWater';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import {
  BLACK_BASS_SPECIES,
  CARP_SPECIES,
  CORMORANT_SPECIES,
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
import { CORMORANT, CORMORANT_CHASE, FINDS, LEGS, RISK, SHRIMP, SNACK_REACH, SWIM, TADPOLES, tripTreasureTuning } from './tuning';
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
/** y of every cormorant's stretch (PRD N3). */
const CORMORANT_STRETCH_Y = 94;
/** Deepest y a cormorant hits an axolotl at: its stretch, its dive depth and its hit reach (PRD open question 546). */
const CORMORANT_HIT_DEPTH = CORMORANT_STRETCH_Y + CORMORANT.lungeRange + CORMORANT.hitRadius;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends. */
const LONGEST_QUIET_SWIM = { length: 451.1, from: { x: 368, y: 654 }, to: { x: 40, y: 358 } };
/** Longest quiet stretch of the floor lane in px, as measured. */
const FLOOR_QUIET_STRETCH = 321;
/** One-leg seconds along the main path from the Home Spot to the exit with no hit, as measured, and the start time that gives it. */
const ONE_LEG_RUN = { seconds: 105.7, start: 0 };
/** Empty treasure slots over the 200 fresh trips, as measured: 16 slots for 3 treasures. */
const EMPTY_SLOTS = { most: 15, mean: 14.27 };
/** The narrowest gap the main path passes through, as measured. */
const NARROWEST_GAP = { between: 'deep-canal-4/mud-seep-3 and carp-6', width: 37.29 };
const TILAPIA_IDS = ['tilapia-0', 'tilapia-1'];
const CARP_IDS = [0, 1, 2, 3, 4, 5, 6].map((n) => `carp-${n}`);
const CORMORANT_IDS = [0, 1, 2].map((n) => `cormorant-${n}`);
const MOVER_IDS = [...[1, 2, 3, 4].map((n) => `deep-canal-4/anchor-drop-${n}`), ...[1, 2, 3].map((n) => `deep-canal-4/mud-seep-${n}`)];
const PATCH_IDS = [1, 2].map((n) => `deep-canal-4/murky-water-${n}`);
const BOAT_IDS = [1, 2].map((n) => `deep-canal-4/fishing-trajinera-${n}`);

const zone = buildZone(DEEP_CANAL_4_LAYOUT, DEFAULT_ZONE_SEED);
const area10 = buildZone(DEEP_CANAL_3_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const { exit } = DEEP_CANAL_4_AREA;
const movers = zone.movingHazards ?? [];
const patches = murkyPatches(zone.hazards);
const boats = zone.fishingBoats ?? [];
const lurePaths = boats.flatMap((boat) => boat.lures.map((_, index) => lurePath(boat, index)));
const lureLines = boats.flatMap((boat) => boat.lures.map((_, index) => lureLinePath(boat, index)));
const cormorants = routesOf(zone, CORMORANT_SPECIES.id);
const { safeArea } = zone;
/** The main path's waypoints, named by the part of the U-turn each starts or ends. */
const TURN = { home: 0, topEnd: 8, bottomStart: 9, exit: 23 };

function deepCanal4(seed: number): ZoneLayout {
  return buildZone(DEEP_CANAL_4_LAYOUT, seed);
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
  const tuning = layout.tilapia ?? DEEP_CANAL_4_TILAPIA;
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

/** The screen row a y is in, 0 at the top. */
function rowOf(y: number): number {
  return Math.floor(y / WORLD_H);
}

/** The screen column an x is in, 0 at the left. */
function columnOf(x: number): number {
  return Math.floor(x / SCREEN_W);
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

/** One frame of a one-leg swim steered at `target`, with the area's current. */
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

/** The id of the first timed threat that lands a hit on a swim at element time `t`, or null: a moving hazard or a lure. */
function timedHitAt(state: SwimState, t: number): string | null {
  const pos = { x: state.x, y: state.y };
  const touched = movers.find((spawn) => movingHazardTouches(spawn, t, pos));
  if (touched) return touched.id;
  const head = headOf(state);
  for (const boat of boats) {
    const eaten = boat.lures.findIndex((_, index) => Math.hypot(...subtract(lureAt(boat, index, t, false), head)) <= LURES.eatReach);
    if (eaten >= 0) return boat.lures[eaten].id;
  }
  return null;
}

/** The two parts of `a` minus `b`. */
function subtract(a: Readonly<Point>, b: Readonly<Point>): [number, number] {
  return [a.x - b.x, a.y - b.y];
}

/**
 * A one-leg swim of the main path from the Home Spot to the exit, leaving at element time `start`:
 * its seconds, or null on a hit from a moving hazard or a lure, or when over the limit.
 */
function oneLegRun(start: number): number | null {
  let state: SwimState = { x: zone.start.x, y: zone.start.y, vx: 0, vy: 0, facing: 1 };
  const targets = zone.mainPath.slice(1);
  let next = 0;
  const maxFrames = Math.round(BEAT_MAX_SECONDS / FRAME);
  for (let frame = 0; frame < maxFrames; frame++) {
    const pos = { x: state.x, y: state.y };
    if (next === targets.length - 1 && Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius) return frame * FRAME;
    if (timedHitAt(state, start + frame * FRAME) !== null) return null;
    const target = targets[next];
    if (next < targets.length - 1 && Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH) {
      next++;
      continue;
    }
    state = swimToward(state, target, zone);
  }
  return null;
}

/** The first start time, RUN_START_STEP apart over every moving hazard's longest cycle, whose one-leg run lands no hit, with the run's seconds. */
function firstClearRun(): { start: number; seconds: number } | null {
  const window = Math.max(...movers.map((spawn) => movingHazardPeriod(spawn.type)));
  for (let start = 0; start <= window; start += RUN_START_STEP) {
    const seconds = oneLegRun(start);
    if (seconds !== null) return { start, seconds };
  }
  return null;
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

/** A cormorant's stretch as its x span. */
function stretchSpan(route: Readonly<PredatorRoute>): { x0: number; x1: number } {
  const xs = route.waypoints.map((point) => point.x);
  return { x0: Math.min(...xs), x1: Math.max(...xs) };
}

/** Whether two x spans share any x. */
function spansOverlap(first: { x0: number; x1: number }, second: { x0: number; x1: number }): boolean {
  return first.x0 <= second.x1 && second.x0 <= first.x1;
}

describe('DEEP_CANAL_4_LAYOUT', () => {
  it('is Area 11 data: 10 screens across, 2 down, starting at the Home Spot', () => {
    expect(DEEP_CANAL_4_AREA_ID).toBe('deep-canal-4');
    expect(DEEP_CANAL_4_LAYOUT.id).toBe(DEEP_CANAL_4_AREA_ID);
    expect(zone.width).toBe(4800);
    expect(zone.height).toBe(720);
    expect(zone.bedTop).toBe(678);
    expect([zone.chunks, zone.rows]).toEqual([10, 2]);
    expect(zone.start).toEqual({ x: 180, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 180, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('deep-canal-4/cave');
    expect(zone.trajineras).toBeUndefined();
    expect(zone.bailingBoats).toBeUndefined();
    expect(zone.dragNets).toBeUndefined();
    expect(zone.rockWalls).toBeUndefined();
  });

  it('is frozen data, down to each route, moving hazard, murky patch, fishing boat and mobile snack', () => {
    expect(Object.isFrozen(DEEP_CANAL_4_LAYOUT)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_4_TILAPIA)).toBe(true);
    for (const species of [DEEP_CANAL_4_CARP, DEEP_CANAL_4_BASS, DEEP_CANAL_4_CORMORANT]) {
      expect(Object.isFrozen(species), species.id).toBe(true);
      expect(Object.isFrozen(species.tuning), species.id).toBe(true);
    }
    for (const part of [
      DEEP_CANAL_4_LAYOUT.elements,
      DEEP_CANAL_4_LAYOUT.hazards,
      DEEP_CANAL_4_LAYOUT.tilapiaRoutes,
      DEEP_CANAL_4_LAYOUT.predatorRoutes,
      DEEP_CANAL_4_LAYOUT.bankOverhangs,
      DEEP_CANAL_4_LAYOUT.bankSpots,
      DEEP_CANAL_4_LAYOUT.bankChunks,
      DEEP_CANAL_4_LAYOUT.caveSpots,
      DEEP_CANAL_4_LAYOUT.currentSpots,
      DEEP_CANAL_4_LAYOUT.currents,
      DEEP_CANAL_4_LAYOUT.mainPath,
      DEEP_CANAL_4_LAYOUT.strandingPlaces,
      DEEP_CANAL_4_LAYOUT.movingHazards,
      DEEP_CANAL_4_LAYOUT.fishingBoats,
      DEEP_CANAL_4_LAYOUT.mobileSnacks,
      DEEP_CANAL_4_LAYOUT.mobileSnacks?.wanders,
      DEEP_CANAL_4_LAYOUT.mobileSnacks?.homes,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const route of DEEP_CANAL_4_LAYOUT.tilapiaRoutes) for (const point of route) expect(Object.isFrozen(point)).toBe(true);
    for (const route of DEEP_CANAL_4_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const spawn of DEEP_CANAL_4_LAYOUT.movingHazards ?? []) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const patch of DEEP_CANAL_4_LAYOUT.hazards) {
      expect(Object.isFrozen(patch), patch.id).toBe(true);
      expect(Object.isFrozen(patch.shape), patch.id).toBe(true);
    }
    for (const boat of DEEP_CANAL_4_LAYOUT.fishingBoats ?? []) {
      expect(Object.isFrozen(boat), boat.id).toBe(true);
      expect(Object.isFrozen(boat.lures), boat.id).toBe(true);
      for (const lure of boat.lures) expect(Object.isFrozen(lure), lure.id).toBe(true);
    }
    for (const wander of DEEP_CANAL_4_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of DEEP_CANAL_4_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
  });

  it('has 46 snacks (7 worms, 7 bugs, 16 tadpoles and 16 shrimp), 2 tilapia, 7 carp, a black bass, 3 cormorants, 4 anchor drops, 3 mud seeps, 2 murky patches, 2 fishing boats and 16 treasure slots, and no reeds, pads or drag nets', () => {
    for (const seed of ALL_SEEDS) {
      const layout = deepCanal4(seed);
      expect(layout.collectibles).toHaveLength(46);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([7, 7, 16, 16]);
      expect(layout.elements).toEqual([]);
      expect(layout.reeds).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(TILAPIA_IDS);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CARP_IDS.map((id) => [id, DEEP_CANAL_4_CARP]),
      ['bass-0', DEEP_CANAL_4_BASS],
      ...CORMORANT_IDS.map((id) => [id, DEEP_CANAL_4_CORMORANT]),
    ]);
    expect(movers.map((spawn) => [spawn.id, spawn.type])).toEqual(MOVER_IDS.map((id) => [id, id.includes('anchor') ? ANCHOR_DROP : MUD_SEEP]));
    expect(zone.hazards.map((hazard) => [hazard.id, hazard.type])).toEqual(PATCH_IDS.map((id) => [id, MURKY_WATER]));
    expect(boats.map((boat) => boat.id)).toEqual(BOAT_IDS);
    expect(boats.flatMap((boat) => boat.lures)).toHaveLength(3);
    expect(DEEP_CANAL_4_LAYOUT.padCount).toBe(0);
    expect(DEEP_CANAL_4_LAYOUT.tilapia).toBe(DEEP_CANAL_4_TILAPIA);
    expect(tripTreasureTuning(DEEP_CANAL_4_AREA_ID).slots).toBe(16);
    expect(DEEP_CANAL_4_LAYOUT.treasures).toBe(DEEP_CANAL_4_TREASURES);
    expect(DEEP_CANAL_4_TREASURES).toHaveLength(3);
  });

  it("plays its tilapia one step up the ladder: a 500 px/s strike reaching 170 px, a 1.5 s cooldown and a 75 px/s patrol, Area 10's 0.8 s warning and full-bar chase", () => {
    expect(DEEP_CANAL_4_TILAPIA).toEqual({ ...DEEP_CANAL_3_TILAPIA, lungeSpeed: 500, lungeRange: 170, cooldown: 1.5, patrolSpeed: 75 });
    expect(DEEP_CANAL_4_TILAPIA.windup).toBe(0.8);
    expect(DEEP_CANAL_4_TILAPIA.chase).toBe(DEEP_CANAL_3_TILAPIA.chase);
    expect(() => tunedSpecies(TILAPIA_SPECIES, DEEP_CANAL_4_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one ladder step up from Area 10's: a 1.4 s cooldown and a 70 px/s patrol, Area 10's other values and chase", () => {
    expect(DEEP_CANAL_4_CARP.id).toBe(CARP_SPECIES.id);
    expect(DEEP_CANAL_4_CARP.tuning).toEqual({ ...DEEP_CANAL_3_CARP.tuning, cooldown: 1.4, patrolSpeed: 70 });
    expect(DEEP_CANAL_4_CARP.tuning.chase).toBe(DEEP_CANAL_3_CARP.tuning.chase);
  });

  it("plays its black bass one ladder step up from Area 10's: a 540 px/s lunge reaching 190 px, a 1.2 s cooldown and a 75 px/s patrol, Area 10's other values and the bass chase", () => {
    expect(DEEP_CANAL_4_BASS.id).toBe(BLACK_BASS_SPECIES.id);
    expect(DEEP_CANAL_4_BASS.rules).toEqual(BLACK_BASS_SPECIES.rules);
    expect(DEEP_CANAL_4_BASS.tuning).toEqual({ ...DEEP_CANAL_3_BASS.tuning, lungeSpeed: 540, lungeRange: 190, cooldown: 1.2, patrolSpeed: 75 });
    expect(DEEP_CANAL_4_BASS.tuning.chase).toBe(DEEP_CANAL_3_BASS.tuning.chase);
    expect([DEEP_CANAL_4_BASS.tuning.windup, DEEP_CANAL_4_BASS.tuning.lungeDuration]).toEqual([0.8, 0.45]);
  });

  it('plays its cormorant at its first ladder step: a 1.0 s warning, a 180 px dive at 450 px/s, a 2.5 s cooldown, a 40 px/s drift and the chase along its stretch (PRD open question 545)', () => {
    expect(DEEP_CANAL_4_CORMORANT.id).toBe(CORMORANT_SPECIES.id);
    expect(DEEP_CANAL_4_CORMORANT.rules).toEqual(CORMORANT_SPECIES.rules);
    expect(DEEP_CANAL_4_CORMORANT.rules).toEqual({ sightCover: true, warnOnRoute: true, diveArc: true });
    expect(DEEP_CANAL_4_CORMORANT.neverTouches).toBe(true);
    expect(DEEP_CANAL_4_CORMORANT.fact).toBe(CORMORANT_FACT);
    expect(DEEP_CANAL_4_CORMORANT.tuning).toEqual({ ...CORMORANT, chase: CORMORANT_CHASE });
    const { windup, minWindup, lungeRange, lungeSpeed, cooldown, patrolSpeed } = DEEP_CANAL_4_CORMORANT.tuning;
    expect([windup, lungeRange, lungeSpeed, cooldown, patrolSpeed]).toEqual([1.0, 180, 450, 2.5, 40]);
    expect(windup).toBeGreaterThanOrEqual(minWindup);
    expect(CORMORANT_CHASE).toEqual({ sight: 240, leash: 0, speed: 120 });
  });

  it('adds exactly one new threat, the cormorant, and no new timing or puzzle element', () => {
    expect(newThingsByArea().find((things) => things.areaId === DEEP_CANAL_4_AREA_ID)).toEqual({
      areaId: DEEP_CANAL_4_AREA_ID,
      threats: ['cormorant'],
      elements: [],
    });
    expect(DEEP_CANAL_4_CORMORANT.dangerPart).toBeUndefined();
  });

  it("names the tilapia, the carp, the black bass, the cormorant, the murky water, the anchor drop, the mud seep and the lure as its threats, then the tadpole and shrimp cards (ND-14, PRD rule 885's carry-forward)", () => {
    const threats = ['tilapia', 'carp', 'black-bass', 'cormorant', 'murky-water', 'anchor-drop', 'mud-seep', 'trajinera-lure'];
    expect(threatIds(DEEP_CANAL_4_LAYOUT)).toEqual(threats);
    expect(threatIds(zone)).toEqual(threats);
    const cards = threatFactCards(DEEP_CANAL_4_LAYOUT);
    expect(cards[3]).toBe(CORMORANT_FACT);
    expect(cards[cards.length - 1]).toBe(LURE_FACT);
    const expected = { ids: [...threats, 'tadpole', 'shrimp'], cards: [...cards, TADPOLE_FACT, SHRIMP_FACT] };
    expect(sourceFactCards(DEEP_CANAL_4_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
  });

  it('holds no heron, garter snake, crayfish, gliding trajinera, bailing bucket or drag net, and its timing slot is empty', () => {
    const species = new Set(zone.predatorRoutes.map((route) => route.species.id));
    for (const left of [HERON_SPECIES.id, GARTER_SNAKE_SPECIES.id, CRAYFISH_SPECIES.id]) expect(species.has(left), left).toBe(false);
    expect(DEEP_CANAL_4_LAYOUT.trajineras).toBeUndefined();
    expect(DEEP_CANAL_4_LAYOUT.bailingBoats).toBeUndefined();
    expect(DEEP_CANAL_4_LAYOUT.dragNets).toBeUndefined();
    expect(DEEP_CANAL_4_LAYOUT.elements).toEqual([]);
  });

  it('holds the Meet the cormorant and Fishing lines fact cards', () => {
    const titles = sourceFactCards(DEEP_CANAL_4_LAYOUT).cards.map((card) => card.title);
    expect(titles).toEqual(expect.arrayContaining(['Meet the cormorant', 'Fishing lines']));
  });

  it('is in the deep canal habitat, numbered 11, after Area 10, with the Little cormorant as its Rare special treasure, the golden-hour look at dusk, no darters and the default stranding chance', () => {
    expect(DEEP_CANAL_4_AREA.layout).toBe(DEEP_CANAL_4_LAYOUT);
    expect(DEEP_CANAL_4_AREA.number).toBe(11);
    expect(DEEP_CANAL_4_AREA.number).toBe(DEEP_CANAL_3_AREA.number + 1);
    expect(DEEP_CANAL_4_AREA.habitatId).toBe(DEEP_CANAL_HABITAT.id);
    expect(DEEP_CANAL_4_AREA.specialTreasureId).toBe('deep-canal/little-cormorant');
    expect(DEEP_CANAL_4_TREASURES.find((treasure) => treasure.id === DEEP_CANAL_4_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(DEEP_CANAL_4_AREA.look).toBe('deep-canal-golden');
    expect(areaTimeOfDay(DEEP_CANAL_4_AREA)).toBe('dusk');
    expect(DEEP_CANAL_4_AREA.snackDart).toBeUndefined();
    expect(DEEP_CANAL_4_AREA.strandingChance).toBeUndefined();
    expect(areaStrandingChance(DEEP_CANAL_4_AREA)).toBe(STRANDING_CHANCE);
    expect(Object.isFrozen(DEEP_CANAL_4_AREA)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_4_AREA.exit)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_4_AREA.snackDrift)).toBe(true);
  });

  it("plays Trajinera Waltz's dusk version, the deep canal cue at golden hour, with no new cue (M3, M4)", () => {
    const cue = tripCueFor(DEEP_CANAL_4_AREA);
    expect(cue).toBe(MUSIC_CUES[`${TRAJINERA_WALTZ.id}-dusk`]);
    expect(cue.version).toBe('dusk');
    expect(cue.dayId).toBe(TRAJINERA_WALTZ.id);
    expect(cue.name).toBe('Trajinera Waltz (dusk)');
  });

  it('adds two Dream colours, one of them a Legendary sheen, and every new patterned or sheen colour is Legendary (B3)', () => {
    const shells = DEEP_CANAL_4_TREASURES.filter((treasure) => treasure.category === 'paintShell');
    expect(shells).toHaveLength(2);
    expect(shells.some((shell) => shell.rarity === 'legendary' && isPatternedOrSheen(shell))).toBe(true);
    for (const shell of shells.filter(isPatternedOrSheen)) expect(shell.rarity, shell.id).toBe('legendary');
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = deepCanal4(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.fishingBoats).toEqual(zone.fishingBoats);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
    }
  });
});

describe('Area 11 U-turn (the area shape rule)', () => {
  const path = zone.mainPath;

  it('puts the Home Spot top left, in the first screen column of the top row, with the safe area its column of the top row', () => {
    expect(zone.safeArea).toEqual({ x0: 40, x1: 330, y0: SURF, y1: WORLD_H });
    expect([columnOf(zone.homeSpot.x), rowOf(zone.homeSpot.y)]).toEqual([0, 0]);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
    expect(path[TURN.home]).toEqual(zone.start);
    expect(path[TURN.exit]).toEqual({ x: exit.x, y: exit.y });
    expect(path).toHaveLength(TURN.exit + 1);
    for (const point of pathSamples(path, 2)) expect(inBounds(point, zone), `path at ${point.x}, ${point.y}`).toBe(true);
  });

  it('is a U-turn: east along the top row, down in the last column, back west along the bottom row to the exit under the Home Spot', () => {
    const top = path.slice(0, TURN.topEnd + 1);
    const bottom = path.slice(TURN.bottomStart);
    for (const point of pathSamples(top, 2)) expect(rowOf(point.y), `top row at ${point.x}, ${point.y}`).toBe(0);
    for (const point of pathSamples(bottom, 2)) expect(rowOf(point.y), `bottom row at ${point.x}, ${point.y}`).toBe(1);
    for (let i = 1; i < top.length; i++) expect(top[i].x, `top row point ${i}`).toBeGreaterThanOrEqual(top[i - 1].x);
    for (let i = 1; i < bottom.length; i++) expect(bottom[i].x, `bottom row point ${TURN.bottomStart + i}`).toBeLessThanOrEqual(bottom[i - 1].x);
    const [down, foot] = [path[TURN.topEnd], path[TURN.bottomStart]];
    expect(down.x).toBe(foot.x);
    expect(columnOf(down.x)).toBe(zone.chunks - 1);
    expect(columnOf(exit.x)).toBe(columnOf(zone.homeSpot.x));
  });

  it('runs deeper than y 300 wherever a cormorant could dive on it, and out of every cormorant dive and hit reach elsewhere (PRD open question 546)', () => {
    expect(CORMORANT_HIT_DEPTH).toBe(300);
    for (const point of pathSamples(path, 2)) {
      for (const route of cormorants) {
        const away = routeLoopDistance(point, route.waypoints);
        const label = `${route.id} at ${point.x}, ${point.y}`;
        expect(point.y > CORMORANT_HIT_DEPTH || away > CORMORANT.lungeRange + CORMORANT.hitRadius, label).toBe(true);
      }
    }
    for (const route of cormorants) {
      const { x0, x1 } = stretchSpan(route);
      const under = pathSamples(path.slice(0, TURN.topEnd + 1), 2).filter((point) => point.x >= x0 && point.x <= x1);
      expect(under.length, route.id).toBeGreaterThan(0);
      for (const point of under) expect(point.y, route.id).toBeGreaterThan(CORMORANT_HIT_DEPTH);
    }
  });

  it('puts the exit low in the first column, under the Home Spot and out of the safe area, with its gate on the bed (#183)', () => {
    expect(exit).toEqual({ x: 180, y: 620, radius: 40 });
    expect(exit.x).toBe(zone.start.x);
    expect(rowOf(exit.y)).toBe(1);
    expect(zone.bedTop - exit.y).toBeLessThanOrEqual(158);
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: zone.bedTop });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    expect(exit.y - exit.radius).toBeGreaterThan(zone.safeArea.y1);
  });

  it('lets a one-leg axolotl swim the main path from the Home Spot to the exit with no hit: out of every strike, past every timed anchor, seep and lure', () => {
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

describe('Area 11 exit', () => {
  it('keeps the exit out of every predator strike, clear of every moving hazard, the current, every murky patch, every lure and its line', () => {
    for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    for (const spawn of movers) expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + spawn.type.touchReach);
    for (const current of zone.currents) expect(shapeDistance(exit, rectOf(current))).toBeGreaterThan(exit.radius);
    for (const patch of patches) expect(shapeDistance(exit, patch.shape), patch.id).toBeGreaterThan(exit.radius);
    for (const shape of [...lurePaths, ...lureLines]) expect(shapeDistance(exit, shape)).toBeGreaterThan(exit.radius + LURES.eatReach);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of deepCanal4(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 11 cormorants (issue #112)', () => {
  it('floats three cormorants on 160 px stretches at y 94, in the water and farther than the dive and the body from the safe area', () => {
    expect(cormorants.map((route) => [route.id, ...route.waypoints.map((point) => point.x)])).toEqual([
      ['cormorant-0', 980, 1140],
      ['cormorant-1', 1930, 2090],
      ['cormorant-2', 3420, 3580],
    ]);
    for (const route of cormorants) {
      expect(route.waypoints.map((point) => point.y), route.id).toEqual([CORMORANT_STRETCH_Y, CORMORANT_STRETCH_Y]);
      expect(route.waypoints[0].y, route.id).toBe(bounds.minY);
      const { x0, x1 } = stretchSpan(route);
      expect(x1 - x0, route.id).toBe(160);
      for (const point of route.waypoints) expect(inBounds(point, zone), route.id).toBe(true);
      const body = route.species.tuning.bodyRadius;
      expect(shapeRouteDistance(rectOf(safeArea), route.waypoints), route.id).toBeGreaterThan(route.species.tuning.lungeRange + body);
    }
  });

  it('keeps every stretch in open water: out of the bank columns, the moored rows, the fishing boat spans and the lure paths', () => {
    for (const route of cormorants) {
      const span = stretchSpan(route);
      for (const column of zone.bankChunks) expect(spansOverlap(span, { x0: column * SCREEN_W, x1: (column + 1) * SCREEN_W }), `${route.id} in bank column ${column}`).toBe(false);
      for (const moored of zone.bankOverhangs ?? []) expect(spansOverlap(span, moored), `${route.id} under moored row ${moored.x0}`).toBe(false);
      for (const boat of boats) expect(spansOverlap(span, boatSpan(boat)), `${route.id} under ${boat.id}`).toBe(false);
      for (const shape of lurePaths) expect(shapeRouteDistance(shape, route.waypoints), route.id).toBeGreaterThan(route.species.tuning.lungeRange);
    }
  });

  it('dives no deeper than y 274, so it hits no axolotl deeper than y 300, and the danger bar counts its reach only as deep as it dives', () => {
    expect(CORMORANT_STRETCH_Y + CORMORANT.lungeRange).toBe(274);
    expect(CORMORANT.hitRadius).toBe(26);
    const leashed = tunedSpecies(CORMORANT_SPECIES, { ...CORMORANT, chase: { ...CORMORANT_CHASE, leash: 200 } });
    const widened: ZoneLayout = {
      ...zone,
      predatorRoutes: zone.predatorRoutes.map((route) => (route.species.id === CORMORANT_SPECIES.id ? { ...route, species: leashed } : route)),
    };
    expect(longestQuietSwim(widened)).toEqual(longestQuietSwim(zone));
    expect(floorQuietStretch(widened)).toBe(floorQuietStretch(zone));
  });

  it('lies wholly in the surface band, so the area has surface danger, and never counts toward the depth rule', () => {
    const [surface] = depthBands(zone);
    for (const route of cormorants) for (const point of route.waypoints) expect(point.y, route.id).toBeLessThanOrEqual(surface.bottom);
    expect(hasSurfaceDanger({ ...zone, movingHazards: [], tilapiaRoutes: [], predatorRoutes: cormorants })).toBe(true);
    expect(meetsDepthRule(zone)).toBe(true);
    expect(meetsDepthRule({ ...zone, predatorRoutes: zone.predatorRoutes.filter((route) => route.species.id !== CORMORANT_SPECIES.id) })).toBe(true);
  });
});

describe('Area 11 danger bar', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats and water as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = deepCanal4(seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.safeArea).toEqual(zone.safeArea);
  });

  it('has 20 moving threats for its 20 screens, at least ceil(0.75 x 20) = 15, 4 predator types and 2 moving hazard types, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(20);
    expect(Math.ceil(0.75 * screens)).toBe(15);
    expect(movingThreatCount(zone)).toBe(20);
    expect(zone.tilapiaRoutes.length + zone.predatorRoutes.length).toBe(13);
    expect(movers).toHaveLength(7);
    expect(predatorTypeCount(zone)).toBe(4);
    expect(movingHazardTypeCount(zone)).toBe(2);
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never counts a murky patch or a lure as a moving threat', () => {
    const bare: ZoneLayout = { ...zone, hazards: [], fishingBoats: [] };
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

  it('has 7 carp for its 20 screens, the carp target', () => {
    expect(carpTarget(20)).toBe(7);
    expect(carpCount(zone)).toBe(7);
  });

  it('keeps every loop in the water and out of the safe area, the tilapia and the bass east of the way down, in the treasure water', () => {
    for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) {
      for (const point of loopSamples(route.waypoints)) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
      }
    }
    const down = path0x(TURN.topEnd);
    for (const route of [...zone.tilapiaRoutes, ...routesOf(zone, BLACK_BASS_SPECIES.id)]) {
      for (const point of route.waypoints) expect(point.x, route.id).toBeGreaterThan(down);
    }
  });
});

/** The x of main path waypoint `index`. */
function path0x(index: number): number {
  return zone.mainPath[index].x;
}

describe('Area 11 anchor drops and mud seeps', () => {
  it('lowers each anchor from the surface 160 px, and sends each mud seep up from the bed 78 px', () => {
    for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(SURF);
      expect(movingHazardDepth(spawn), spawn.id).toBe(160);
    }
    for (const spawn of movers.filter((each) => each.type === MUD_SEEP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(zone.bedTop);
      expect(movingHazardDepth(spawn), spawn.id).toBe(78);
    }
  });

  it('keeps every sweep in the water, out of the safe area, clear of every murky patch and lure', () => {
    for (const spawn of movers) {
      const sweep = movingHazardSweep(spawn);
      expect(rectDistance(sweep, rectOf(safeArea)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
      expect(sweep.x0, spawn.id).toBeGreaterThan(bounds.minX);
      expect(sweep.x1, spawn.id).toBeLessThan(bounds.maxX);
      for (const shape of [...patches.map((patch) => patch.shape), ...lurePaths]) expect(rectDistance(sweep, shape), spawn.id).toBeGreaterThan(spawn.type.touchReach);
    }
  });

  it('hangs every anchor between the cormorants, never under a cormorant stretch, and runs the main path 40 px over every mud seep', () => {
    for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
      for (const route of cormorants) expect(spansOverlap(stretchSpan(route), { x0: spawn.x, x1: spawn.x }), `${spawn.id} under ${route.id}`).toBe(false);
    }
    for (const spawn of movers.filter((each) => each.type === MUD_SEEP)) {
      const sweep = movingHazardSweep(spawn);
      const over = pathSamples(zone.mainPath, 1).filter((point) => point.x >= sweep.x0 && point.x <= sweep.x1);
      expect(over.length, spawn.id).toBeGreaterThan(0);
      for (const point of over) expect(sweep.y0 - point.y, spawn.id).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('Area 11 murky water (issue #107, carried forward)', () => {
  const routePatches = patches.filter((patch) => pathSamples(zone.mainPath, 2).some((point) => insideMurky(point, [patch])));

  it('has two fixed murky patches, each costing no leg on touch, in the water and out of the safe area', () => {
    for (const patch of patches) {
      expect(patch.type.costsLeg, patch.id).toBe(false);
      expect(rectDistance(patch.shape, rectOf(safeArea)), patch.id).toBeGreaterThan(0);
    }
    expect(zoneThreats(zone)).toHaveLength(zoneThreats({ ...zone, hazards: [] }).length);
    for (const id of PATCH_IDS) expect(obstaclesOf(zone).map((obstacle) => obstacle.id)).not.toContain(id);
  });

  it("puts the first patch on the bottom row's way west, at most 200 px wide, which a one-leg axolotl crosses along the path in under 3 s", () => {
    expect(routePatches.map((patch) => patch.id)).toEqual(PATCH_IDS.slice(0, 1));
    const oneLegSpeed = SWIM.maxSpeed * LEGS.speedByLegs[0];
    const [patch] = routePatches;
    const width = patch.shape.x1 - patch.shape.x0;
    expect(width).toBeLessThanOrEqual(ROUTE_PATCH_MAX_WIDTH);
    expect(rowOf(patch.shape.y0)).toBe(1);
    expect(murkyCrossSeconds(width)).toBeLessThan(MURKY_WATER_TIMING.legAt);
    expect(pathLengthInside(patch.shape) / oneLegSpeed).toBeLessThan(MURKY_WATER_TIMING.legAt);
    expect(pathLengthInside(patch.shape) / oneLegSpeed).toBeCloseTo(4 / 3, 2);
  });

  it('puts the second, wider patch over the sunken hull cave, a treasure dead end on the bed east of the way down, off the main path', () => {
    const [, wide] = patches;
    expect(wide.shape.x1 - wide.shape.x0).toBeGreaterThan(ROUTE_PATCH_MAX_WIDTH);
    expect(rectDistance(wide.shape, rectOf(zone.cave))).toBe(0);
    for (const spot of zone.spots.filter((each) => each.cover === 'cave')) expect(insideMurky(spot, [wide]), spot.id).toBe(true);
    for (const point of pathSamples(zone.mainPath, 2)) expect(insideMurky(point, [wide])).toBe(false);
  });
});

describe('Area 11 trajinera lures (issue #108, carried forward)', () => {
  it('hangs 3 lures from 2 fishing trajineras drifting slowly across spans longer than a hull, at most one lure at each end of a hull', () => {
    expect(boats.map((boat) => boat.lures.length)).toEqual([2, 1]);
    for (const boat of boats) {
      expect(boat.speed, boat.id).toBe(LURES.driftSpeed);
      expect(boat.x1 - boat.x0, boat.id).toBeGreaterThan(LURES.hullLength);
      expect(boat.lures.map((lure) => lure.along).every((along) => along === 0 || along === LURES.hullLength), boat.id).toBe(true);
      expect(new Set(boat.lures.map((lure) => lure.along)).size, boat.id).toBe(boat.lures.length);
    }
  });

  it('keeps every lure out of every predator strike, the safe area, the current and every murky patch', () => {
    for (const [index, shape] of lurePaths.entries()) {
      for (const { route, strike } of strikeRoutes(zone)) expect(shapeRouteDistance(shape, route.waypoints), `lure ${index} to ${route.id}`).toBeGreaterThan(strike);
      for (const line of [shape, lureLines[index]]) {
        expect(rectDistance(line, rectOf(safeArea)), `lure ${index}`).toBeGreaterThan(0);
        for (const current of zone.currents) expect(rectDistance(line, rectOf(current)), `lure ${index}`).toBeGreaterThan(0);
        for (const patch of patches) expect(rectDistance(line, patch.shape), `lure ${index}`).toBeGreaterThan(0);
      }
    }
  });

  it('never lets a fishing boat overlap another surface boat: the other fishing boat, the moored rows and the anchor drops', () => {
    const spans = boats.map(boatSpan);
    for (const [index, span] of spans.entries()) {
      for (const [other, otherSpan] of spans.entries()) if (other !== index) expect(span.x1 < otherSpan.x0 || otherSpan.x1 < span.x0, BOAT_IDS[index]).toBe(true);
      for (const moored of zone.bankOverhangs ?? []) expect(span.x1 < moored.x0 || moored.x1 < span.x0, BOAT_IDS[index]).toBe(true);
      for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
        expect(Math.min(Math.abs(span.x0 - spawn.x), Math.abs(span.x1 - spawn.x)), `${BOAT_IDS[index]} to ${spawn.id}`).toBeGreaterThanOrEqual(LURES.hullLength);
        expect(span.x0 <= spawn.x && spawn.x <= span.x1, `${BOAT_IDS[index]} over ${spawn.id}`).toBe(false);
      }
    }
  });

  it('is a hiding-risk threat and a gap obstacle, but never a danger-bar threat', () => {
    expect(zoneThreats(zone).length - zoneThreats({ ...zone, fishingBoats: [] }).length).toBe(3);
    const ids = obstaclesOf(zone).map((obstacle) => obstacle.id);
    for (const lure of boats.flatMap((boat) => boat.lures)) expect(ids).toContain(lure.id);
    expect(TRAJINERA_LURE.costsLeg).toBe(true);
  });
});

describe('Area 11 hiding spots (B5, B6, B10)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, with the turn clearance, for seed %i', (seed) => {
    const layout = deepCanal4(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('deep-canal-4/spot-'), spot.id).toBe(true);
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

  it('has 4 Common, 3 Rare, 2 Epic and 3 Legendary spots, every pool larger than its Area 11 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([4, 3, 2, 3]);
    expect(RARITIES.map((rarity) => DEEP_CANAL_4_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([0, 2, 0, 1]);
    for (const rarity of RARITIES) {
      const treasures = DEEP_CANAL_4_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides Commons under the moored row past cormorant-1 by the main path, and Rares under the moored rows by anchor-drop-2 and anchor-drop-4, off the path', () => {
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
      [4540, 630, 'legendary', false],
      [4470, 640, 'epic', false],
    ]);
    expect(zone.cave).toEqual({ id: 'deep-canal-4/cave', x0: 4440, x1: 4740, y0: 600, y1: zone.bedTop });
    const tilapia = zone.tilapiaRoutes.find((route) => route.id === 'tilapia-1');
    if (!tilapia) throw new Error('no route tilapia-1');
    expect(routeLoopDistance(cave[0], tilapia.waypoints)).toBeLessThanOrEqual(DEEP_CANAL_4_TILAPIA.lungeRange / 2);
  });

  it('puts two open Legendary spots just past the side-canal inflow, each within half the strike of tilapia-0 or bass-0, and an Epic spot past it farther off', () => {
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [4580, 180, 'legendary', false],
      [4640, 200, 'legendary', false],
      [4530, 140, 'epic', false],
    ]);
    const near = [...zone.tilapiaRoutes.filter((route) => route.id === 'tilapia-0'), ...routesOf(zone, BLACK_BASS_SPECIES.id)];
    const halfStrike = (route: TilapiaRoute) => (route.id === 'tilapia-0' ? DEEP_CANAL_4_TILAPIA.lungeRange : DEEP_CANAL_4_BASS.tuning.lungeRange) / 2;
    for (const spot of past) {
      expect(coversAt(spot, zone), spot.id).toEqual(['pastCurrent']);
      const within = near.some((route) => routeLoopDistance(spot, route.waypoints) <= halfStrike(route));
      expect(within, spot.id).toBe(spot.rarity === 'legendary');
    }
  });

  it('has no Dash pot: every Legendary spot is in the open, deep and near a threat, so the Legendary rule needs none (ADR 0032)', () => {
    expect(zone.spots.filter((spot) => spot.container)).toEqual([]);
    for (const spot of zone.spots.filter((each) => each.rarity === 'legendary')) expect(['cave', 'pastCurrent'], spot.id).toContain(spot.cover);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = deepCanal4(seed);
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

  it.each(poolSpots(zone))("finds a safe start on #130's relaxed rule past every predator reach and every moving hazard for $id", (spot) => {
    const start = nearestSafeStart(spot, zone);
    expect(isSafeStart(start, zone)).toBe(true);
    expect(reachMargin(start, zone)).toBeGreaterThan(0);
  });
});

describe('Area 11 placing treasure (B4)', () => {
  const tuning = tripTreasureTuning(DEEP_CANAL_4_AREA_ID);
  const options = { extras: [DEEP_CANAL_4_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 16 slots, the lost treasures and the Little cormorant', () => {
    const all = DEEP_CANAL_4_TREASURES.map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(DEEP_CANAL_4_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('puts the Legendary Golden shine shell in a Legendary spot when every treasure must be placed, the cave spot on some trips', () => {
    const all = DEEP_CANAL_4_TREASURES.map((treasure) => treasure.id);
    const legendaryIds = DEEP_CANAL_4_TREASURES.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id);
    const legendarySpotIds = zone.spots.filter((spot) => spot.rarity === 'legendary').map((spot) => spot.id);
    const caveId = zone.spots.find((spot) => spot.rarity === 'legendary' && spot.cover === 'cave')?.id;
    const used = new Set<string>();
    for (const tripSeed of TRIP_SEEDS) {
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      const legendarySpots = lost.filter((find) => legendaryIds.includes(find.id)).map((find) => find.spotId);
      expect(legendarySpots, `trip seed ${tripSeed}`).toHaveLength(legendaryIds.length);
      for (const spotId of legendarySpots) expect(legendarySpotIds, `trip seed ${tripSeed}`).toContain(spotId);
      for (const spotId of legendarySpots) used.add(spotId);
    }
    expect(caveId).toBeDefined();
    expect(used.has(caveId ?? '')).toBe(true);
  });

  it('leaves the 16 slots mostly empty over 200 fresh trips, with only 3 treasures to fill them', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 11 side-canal inflow and stranding places', () => {
  it("flows to the left at 72 px/s, as strong as Area 10's, which one leg still beats by 18 px/s, off the main path east of the way down", () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -72, y: 0 });
    expect(Math.abs(current.force.x)).toBeGreaterThanOrEqual(Math.abs(area10.currents[0].force.x));
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(18);
    expect(current.x0).toBeGreaterThan(path0x(TURN.topEnd));
    for (const point of pathSamples(zone.mainPath, 4)) expect(isInsideCurrent(point, current)).toBe(false);
    for (const patch of patches) expect(rectDistance(rectOf(current), patch.shape), patch.id).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)(
    'keeps six stranding places 80 px from every route, clear of every sweep, the spots, the current, every murky patch, lure and line for seed %i',
    (seed) => {
      const layout = deepCanal4(seed);
      expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `deep-canal-4/strand-${n}`));
      for (const place of layout.strandingPlaces) {
        expect(inBounds(place, layout), place.id).toBe(true);
        expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
        expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
        expect(insideMurky(place, patches), place.id).toBe(false);
        for (const shape of [...lurePaths, ...lureLines]) expect(shapeDistance(place, shape), place.id).toBeGreaterThan(RESCUE.reachRadius + LURES.eatReach);
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

describe('Area 11 gaps and banks (the level layout ladder)', () => {
  it("passes between mud-seep-3 and carp-6 through a gap tighter than Area 10's narrowest and never under the safe passing width", () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe(NARROWEST_GAP.between);
    expect(narrowest.width).toBeCloseTo(NARROWEST_GAP.width, 1);
    expect(narrowest.width).toBeLessThan(narrowestPathGap(area10).width);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('holds treasure off the main path in two dead ends east of the way down, the sunken hull cave and the water past the inflow, and under the moored rows', () => {
    for (const spot of zone.spots.filter((each) => each.rarity !== 'common')) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
    for (const spot of zone.spots.filter((each) => each.rarity === 'epic' || each.rarity === 'legendary')) {
      expect(spot.x, spot.id).toBeGreaterThan(path0x(TURN.topEnd));
    }
  });

  it('shows its ahuejote banks only in top-row columns with no cormorant and no moored row', () => {
    expect(zone.bankChunks).toEqual([1, 3, 6]);
    for (const column of zone.bankChunks) {
      const span = { x0: column * SCREEN_W, x1: (column + 1) * SCREEN_W };
      for (const route of cormorants) expect(spansOverlap(span, stretchSpan(route)), `${route.id} in column ${column}`).toBe(false);
      for (const moored of zone.bankOverhangs ?? []) expect(spansOverlap(span, moored), `moored row in column ${column}`).toBe(false);
    }
  });

  it.each(ALL_SEEDS)('puts snacks in every screen column for seed %i', (seed) => {
    const layout = deepCanal4(seed);
    for (let column = 0; column < layout.chunks; column++) {
      expect(layout.collectibles.some((snack) => columnOf(snack.x) === column), `column ${column}`).toBe(true);
    }
  });
});

describe('Area 11 snacks', () => {
  const drift = DEEP_CANAL_4_AREA.snackDrift;
  const surfacePeak = 80 + 1.6 + 0.8;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every murky patch, lure and line, for seed %i', (seed) => {
    const layout = deepCanal4(seed);
    expect(layout.collectibles).toHaveLength(46);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      for (const shape of [...patches.map((patch) => patch.shape), ...lurePaths, ...lureLines]) {
        expect(shapeDistance(snack, shape), snack.id).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of layout.movingHazards ?? []) expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the inflow, and only worms and bugs in it, for seed %i', (seed) => {
    const layout = deepCanal4(seed);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(DEEP_CANAL_4_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = deepCanal4(seed);
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

  it('drift a little faster than Area 10, slower than a one-leg axolotl swims against the inflow, and at most half the magnet pull', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(zone.currents[0].force.x);
    expect(drift).toEqual({ ...DEEP_CANAL_3_AREA.snackDrift, periodX: 6.6, periodY: 5.28 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_3_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('has no one-time darters: no dart rule, and its shrimp replace them', () => {
    expect(oneTimeDarts(DEEP_CANAL_4_AREA, zone)).toBeNull();
  });

  it.each(ALL_SEEDS)(
    'gives every shrimp a clear place, and every hop spot of its home a flick landing isShrimpFlickLandingClear allows in at least one of 8 directions, for seed %i',
    (seed) => {
      const layout = deepCanal4(seed);
      const avoid = mobileSnackAvoid(layout);
      const rule = layout.mobileSnacks?.shrimp;
      if (!rule) throw new Error('Area 11 has no shrimp rule');
      const homes = layout.mobileSnacks?.homes ?? [];
      expect(homes).toHaveLength(16);
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

describe('Area 11 mobile snacks', () => {
  const mix = zone.mobileSnacks;
  const drift = DEEP_CANAL_4_AREA.snackDrift;
  const keepAways = [...patches.map((patch) => patch.shape), ...lurePaths, ...lureLines];

  it("meets the later row of the snack ramp: 32 of its 46 snacks mobile, 69.6%, at least Area 10's 69.2% and at most 0.7, its tadpoles at 72 px/s (ND-8)", () => {
    expect(meetsSnackRamp(11, DEEP_CANAL_4_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(32);
    const share = mobile / zone.collectibles.length;
    expect(share).toBeCloseTo(0.696, 3);
    expect(share).toBeGreaterThanOrEqual(mobileSnackShare(DEEP_CANAL_3_LAYOUT));
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(DEEP_CANAL_4_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('swims sixteen tadpoles on wander loops of 4 points, each leg 1.5 to 5 s, each a sixteenth of its own lap further on than the last', () => {
    const wanders = mix?.wanders ?? [];
    const speed = mix?.tadpole?.speed ?? 0;
    expect(wanders).toHaveLength(16);
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
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 16, 9);
    }
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall', () => {
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      const box = homeBoxOf(wander.points);
      expect(box.x1 - box.x0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
    }
  });

  it('keeps every tadpole loop and every shrimp home out of the inflow and SNACK_HAZARD_CLEARANCE from every murky patch, lure and line', () => {
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

  it("gives its sixteen shrimp Area 10's shrimp rule, on homes of 3 hop spots in a box at most 200 x 160 px", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    expect(mix?.shrimp).toEqual(DEEP_CANAL_3_LAYOUT.mobileSnacks?.shrimp);
    const homes = mix?.homes ?? [];
    expect(homes).toHaveLength(16);
    for (const home of homes) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      expect(home.points, label).toHaveLength(3);
      const box = homeBoxOf(home.points);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = deepCanal4(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(86.4, 9);
  });
});

describe('Area 11 difficulty', () => {
  it('is harder than Area 10: a higher mobile share, faster drift, more slots, stronger tilapia, carp and bass, the new cormorant and a tighter gap', () => {
    expect(mobileSnackShare(DEEP_CANAL_4_LAYOUT)).toBeGreaterThan(mobileSnackShare(DEEP_CANAL_3_LAYOUT));
    expect(snackDriftMaxSpeed(DEEP_CANAL_4_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_3_AREA.snackDrift));
    expect(tripTreasureTuning(DEEP_CANAL_4_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(DEEP_CANAL_3_AREA.id).slots);
    expect(DEEP_CANAL_4_TILAPIA.lungeRange).toBeGreaterThan(DEEP_CANAL_3_TILAPIA.lungeRange);
    expect(DEEP_CANAL_4_TILAPIA.cooldown).toBeLessThan(DEEP_CANAL_3_TILAPIA.cooldown);
    expect(DEEP_CANAL_4_CARP.tuning.cooldown).toBeLessThan(DEEP_CANAL_3_CARP.tuning.cooldown);
    expect(DEEP_CANAL_4_CARP.tuning.patrolSpeed).toBeGreaterThan(DEEP_CANAL_3_CARP.tuning.patrolSpeed);
    expect(DEEP_CANAL_4_BASS.tuning.lungeSpeed).toBeGreaterThan(DEEP_CANAL_3_BASS.tuning.lungeSpeed);
    expect(DEEP_CANAL_4_BASS.tuning.cooldown).toBeLessThan(DEEP_CANAL_3_BASS.tuning.cooldown);
    expect(routesOf(area10, CORMORANT_SPECIES.id)).toEqual([]);
    expect(cormorants).toHaveLength(3);
    expect(narrowestPathGap(zone).width).toBeLessThan(narrowestPathGap(area10).width);
  });
});
