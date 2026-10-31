import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_AREA, DEEP_CANAL_HABITAT, SPRING_CAVE_2_AREA, newThingsByArea, sourceFactCards, threatFactCards, threatIds } from './areas';
import { DEEP_CANAL_TREASURES, RARITIES, dreamColourById, type Treasure } from './catalogue';
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
import {
  DEEP_CANAL_AREA_ID,
  DEEP_CANAL_BASS,
  DEEP_CANAL_CARP,
  DEEP_CANAL_LAYOUT,
  DEEP_CANAL_TILAPIA,
} from './deepCanalLayout';
import { currentAt } from './environment';
import { BLACK_BASS_FACT, CARP_FACT, PUNTING_POLE_FACT, SHRIMP_FACT, TADPOLE_FACT, TILAPIA_FACT } from './factCards';
import { shapeDistance, type HazardRect, type HazardShape } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, riskBands, routeDistance, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples, narrowestPathGap } from './layoutGaps';
import { legSwimTuning } from './legs';
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
import { PUNTING_POLE, movingHazardBaseY, movingHazardDepth, movingHazardDirection, movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import { PEBBLES, blockAtRock, bodyInAnyRock, type RockWall } from './pebble';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { BLACK_BASS_SPECIES, CARP_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import { RESCUE, areaStrandingChance } from './rescue';
import { isShrimpFlickLandingClear } from './shrimpFlick';
import { SPRING_CAVE_2_CARP, SPRING_CAVE_2_LAYOUT } from './springCave2Layout';
import { stepSwim, type SwimState } from './swimPhysics';
import { GLIDING_TRAJINERA, TRAJINERAS, TRAJINERA_MAX_SPAN, trajineraHullBand, trajineras } from './trajineras';
import { BLACK_BASS, BLACK_BASS_CHASE, CARP, FINDS, LEGS, RISK, SHRIMP, SWIM, TADPOLES, TILAPIA, TILAPIA_CHASE, tripTreasureTuning } from './tuning';
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
/** Least px from a stranding place to every pole sweep: the touch reach plus the rescue reach. */
const STRAND_HAZARD_CLEARANCE = PUNTING_POLE.touchReach + RESCUE.reachRadius;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** Directions a shrimp's flick target is tried in. */
const FLICK_DIRECTIONS = 8;
/** The owner's lanes (#78): the surface lane from the top of the swim water to the divider, the deep lane from the divider to the floor. */
const SURFACE_LANE = { top: 94, bottom: 340 };
const DEEP_LANE = { top: 380, bottom: 656 };
/** y of the low divider runs and of the raised run over `bass-1` (the owner's Q3). */
const LOW_RUN = { y0: 340, y1: 380 };
const RAISED_RUN = { y0: 200, y1: 240 };
/** The divider's thickness and the widest a stone may be (the owner's Q3). */
const STONE_THICKNESS = 40;
const STONE_MAX_WIDTH = 640;
/** Lowest y the bass under the raised run reaches, so the bass cover all three depth bands. */
const RAISED_BASS_TOP = 257;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends. */
const LONGEST_QUIET_SWIM = { length: 352.9, from: { x: 3576, y: 102 }, to: { x: 3792, y: 310 } };
/** Longest quiet swim in each lane, counting only that lane's threats, in px, as measured: the deep lane has none. */
const LANE_QUIET_SWIM = { surface: 414.39, deep: null };
/** Longest quiet stretch of the floor lane in px, as measured. */
const FLOOR_QUIET_STRETCH = 0;
/** One-leg seconds along each lane to the exit, as measured. */
const ONE_LEG_EXIT_SECONDS = { surface: 45.92, deep: 40.68 };
/** Empty treasure slots over the 200 fresh trips, as measured: 13 slots for 13 treasures. */
const EMPTY_SLOTS = { most: 6, mean: 3.995 };
const TILAPIA_IDS = ['tilapia-0', 'tilapia-1'];
const CARP_IDS = [0, 1, 2, 3, 4].map((n) => `carp-${n}`);
const BASS_IDS = ['bass-0', 'bass-1'];
const POLE_IDS = [1, 2, 3, 4].map((n) => `deep-canal-1/punting-pole-${n}`);
const BOAT_IDS = [1, 2].map((n) => `deep-canal-1/trajinera-${n}`);

const zone = buildZone(DEEP_CANAL_LAYOUT, DEFAULT_ZONE_SEED);
const area7 = buildZone(SPRING_CAVE_2_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const { exit } = DEEP_CANAL_AREA;
const divider = zone.rockWalls ?? [];
const boats = zone.trajineras ?? [];
const poles = zone.movingHazards ?? [];
const hullBands = boats.map((boat) => trajineraHullBand(boat));
const dividerWest = Math.min(...divider.map((stone) => stone.x0));
const dividerEast = Math.max(...divider.map((stone) => stone.x1));
const raisedStones = divider.filter((stone) => stone.y0 === RAISED_RUN.y0);
const raisedWest = Math.min(...raisedStones.map((stone) => stone.x0));
const raisedEast = Math.max(...raisedStones.map((stone) => stone.x1));

function deepCanal(seed: number): ZoneLayout {
  return buildZone(DEEP_CANAL_LAYOUT, seed);
}

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const limits = swimBounds(layout);
  return point.x >= limits.minX && point.x <= limits.maxX && point.y >= limits.minY && point.y <= limits.maxY;
}

/** A rock wall as a rect shape. */
function rectOf(rock: { x0: number; x1: number; y0: number; y1: number }): HazardRect {
  return { kind: 'rect', x0: rock.x0, x1: rock.x1, y0: rock.y0, y1: rock.y1 };
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectDistance(first: HazardShape, second: HazardShape): number {
  if (first.kind !== 'rect' || second.kind !== 'rect') throw new Error('rectDistance: both shapes must be rects');
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

/** Whether two rects share any point, edges included. */
function rectsMeet(first: { x0: number; x1: number; y0: number; y1: number }, second: { x0: number; x1: number; y0: number; y1: number }): boolean {
  return first.x1 >= second.x0 && first.x0 <= second.x1 && first.y1 >= second.y0 && first.y0 <= second.y1;
}

/** Least distance from a hazard shape to a closed loop, sampled along the loop. */
function shapeRouteDistance(shape: HazardShape, waypoints: readonly Point[]): number {
  return Math.min(...loopSamples(waypoints).map((point) => shapeDistance(point, shape)));
}

/** The zone's predator routes of one species. */
function routesOf(layout: Pick<ZoneLayout, 'predatorRoutes'>, speciesId: string): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === speciesId);
}

/** Each tilapia route and predator route with its strike and body radius. */
function strikeRoutes(layout: ZoneLayout): { route: TilapiaRoute; strike: number; body: number }[] {
  const tuning = layout.tilapia ?? TILAPIA;
  return [
    ...layout.tilapiaRoutes.map((route) => ({ route, strike: tuning.lungeRange, body: tuning.bodyRadius })),
    ...layout.predatorRoutes.map((route) => ({ route, strike: route.species.tuning.lungeRange, body: route.species.tuning.bodyRadius })),
  ];
}

/** Where a pole can touch the body centre: its sweep grown by the touch reach on every side. */
function touchZone(spawn: Readonly<MovingHazardSpawn>): HazardRect {
  const sweep = movingHazardSweep(spawn);
  const { touchReach } = spawn.type;
  return { kind: 'rect', x0: sweep.x0 - touchReach, x1: sweep.x1 + touchReach, y0: sweep.y0 - touchReach, y1: sweep.y1 + touchReach };
}

/** The divider stone under or over `x`, the lowest top first; undefined west or east of the divider. */
function dividerAt(x: number): { top: number; bottom: number } | undefined {
  const stones = divider.filter((stone) => stone.x0 <= x && x <= stone.x1);
  if (stones.length === 0) return undefined;
  return { top: Math.min(...stones.map((stone) => stone.y0)), bottom: Math.max(...stones.map((stone) => stone.y1)) };
}

/** The lane a point is in: over the divider, under it, or in a shared pocket west or east of it. */
function laneOf(point: Point): 'surface' | 'deep' | 'pocket' | 'rock' {
  const stone = dividerAt(point.x);
  if (stone === undefined) return 'pocket';
  if (point.y < stone.top) return 'surface';
  if (point.y > stone.bottom) return 'deep';
  return 'rock';
}

/**
 * The lane a whole loop keeps to, or 'both' when it crosses into the other lane or the rock. A loop
 * may reach into a shared pocket at the fork or the join, on its own lane's side of the divider's
 * low run.
 */
function loopLane(waypoints: readonly Point[]): string {
  const lanes = new Set(
    loopSamples(waypoints).map((point) => {
      const lane = laneOf(point);
      if (lane !== 'pocket') return lane;
      if (point.y < LOW_RUN.y0) return 'surface';
      return point.y > LOW_RUN.y1 ? 'deep' : 'rock';
    }),
  );
  return lanes.size === 1 ? [...lanes][0] : 'both';
}

/**
 * The zone as one lane sees it: the other lane's water and both shared pockets made rock, and only
 * that lane's threats, so a quiet swim there counts that lane's threats alone.
 */
function laneGeometry(layout: ZoneLayout, lane: 'surface' | 'deep'): ZoneLayout {
  const fill = divider.map((stone): RockWall => (lane === 'surface' ? { ...stone, y1: 2 * WORLD_H } : { ...stone, y0: 0 }));
  const pockets: RockWall[] = [
    { x0: 0, x1: dividerWest - 1, y0: 0, y1: 2 * WORLD_H },
    { x0: dividerEast + 1, x1: layout.width, y0: 0, y1: 2 * WORLD_H },
  ];
  return {
    ...layout,
    rockWalls: [...divider, ...fill, ...pockets],
    tilapiaRoutes: layout.tilapiaRoutes.filter((route) => loopLane(route.waypoints) === lane),
    predatorRoutes: layout.predatorRoutes.filter((route) => loopLane(route.waypoints) === lane),
    movingHazards: lane === 'surface' ? layout.movingHazards : [],
  };
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

/** One frame of a one-leg swim steered at `target`, with the area's current and its rock. */
function swimToward(state: SwimState, target: Point, layout: ZoneLayout): SwimState {
  const pos = { x: state.x, y: state.y };
  const steer = normalize({ x: target.x - pos.x, y: target.y - pos.y });
  const env = { current: currentAt(pos, layout.currents), dragMul: 1, bounds: swimBounds(layout), dashing: false };
  const swum = stepSwim(state, steer, env, FRAME, legSwimTuning(1));
  const blocked = blockAtRock(pos, swum, layout.rockWalls ?? []);
  return { ...swum, x: blocked.x, y: blocked.y };
}

/** Seconds a one-leg axolotl takes swimming through `targets` in order until `arrive`; Infinity when over the limit. */
function oneLegSeconds(from: Point, targets: readonly Point[], layout: ZoneLayout, arrive: (pos: Point) => boolean): number {
  let state: SwimState = { x: from.x, y: from.y, vx: 0, vy: 0, facing: 1 };
  let next = 0;
  const maxFrames = Math.round(BEAT_MAX_SECONDS / FRAME);
  for (let frame = 0; frame < maxFrames; frame++) {
    const pos = { x: state.x, y: state.y };
    if (next === targets.length - 1 && arrive(pos)) return frame * FRAME;
    const target = targets[next];
    if (next < targets.length - 1 && Math.hypot(target.x - pos.x, target.y - pos.y) <= WAYPOINT_REACH) {
      next++;
      continue;
    }
    state = swimToward(state, target, layout);
  }
  return Infinity;
}

/** The way along the deep lane: from the Home Spot down under the divider's west end, east along the lane, up to the exit. */
const DEEP_WAY: readonly Point[] = [
  { x: 120, y: 360 },
  { x: 520, y: 450 },
  { x: 3620, y: 450 },
  { x: exit.x, y: exit.y },
];

/** Whether a Paint shell's Dream colour is patterned or a sheen. */
function isPatternedOrSheen(treasure: Treasure): boolean {
  if (treasure.category !== 'paintShell') return false;
  const kind = dreamColourById(treasure.dreamColour)?.kind;
  return kind === 'patterned' || kind === 'sheen';
}

describe('DEEP_CANAL_LAYOUT', () => {
  it('is Area 8 data: 8 screens across, 2 down, starting at the Home Spot', () => {
    expect(DEEP_CANAL_AREA_ID).toBe('deep-canal-1');
    expect(DEEP_CANAL_LAYOUT.id).toBe(DEEP_CANAL_AREA_ID);
    expect(zone.width).toBe(3840);
    expect(zone.height).toBe(720);
    expect(zone.bedTop).toBe(678);
    expect([zone.chunks, zone.rows]).toEqual([8, 2]);
    expect(zone.start).toEqual({ x: 120, y: 360 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 360, radius: 72 });
    expect(zone.cave.id).toBe('deep-canal-1/cave');
  });

  it('is frozen data, down to each route, pole, boat, stone and mobile snack', () => {
    expect(Object.isFrozen(DEEP_CANAL_LAYOUT)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_TILAPIA)).toBe(true);
    for (const species of [DEEP_CANAL_CARP, DEEP_CANAL_BASS]) {
      expect(Object.isFrozen(species)).toBe(true);
      expect(Object.isFrozen(species.tuning)).toBe(true);
    }
    for (const part of [
      DEEP_CANAL_LAYOUT.elements,
      DEEP_CANAL_LAYOUT.hazards,
      DEEP_CANAL_LAYOUT.tilapiaRoutes,
      DEEP_CANAL_LAYOUT.predatorRoutes,
      DEEP_CANAL_LAYOUT.bankOverhangs,
      DEEP_CANAL_LAYOUT.bankSpots,
      DEEP_CANAL_LAYOUT.caveSpots,
      DEEP_CANAL_LAYOUT.currentSpots,
      DEEP_CANAL_LAYOUT.currents,
      DEEP_CANAL_LAYOUT.mainPath,
      DEEP_CANAL_LAYOUT.strandingPlaces,
      DEEP_CANAL_LAYOUT.movingHazards,
      DEEP_CANAL_LAYOUT.rockWalls,
      DEEP_CANAL_LAYOUT.trajineras,
      DEEP_CANAL_LAYOUT.mobileSnacks,
      DEEP_CANAL_LAYOUT.mobileSnacks?.wanders,
      DEEP_CANAL_LAYOUT.mobileSnacks?.homes,
      DEEP_CANAL_LAYOUT.mobileSnacks?.tadpole,
      DEEP_CANAL_LAYOUT.mobileSnacks?.shrimp,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const route of DEEP_CANAL_LAYOUT.tilapiaRoutes) for (const point of route) expect(Object.isFrozen(point)).toBe(true);
    for (const route of DEEP_CANAL_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const spawn of DEEP_CANAL_LAYOUT.movingHazards ?? []) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const boat of DEEP_CANAL_LAYOUT.trajineras ?? []) {
      expect(Object.isFrozen(boat), boat.id).toBe(true);
      expect(Object.isFrozen(boat.trajinera), boat.id).toBe(true);
    }
    for (const stone of DEEP_CANAL_LAYOUT.rockWalls ?? []) expect(Object.isFrozen(stone)).toBe(true);
    for (const wander of DEEP_CANAL_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of DEEP_CANAL_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
  });

  it('has 44 snacks (8 worms, 6 bugs, 14 tadpoles and 16 shrimp), 2 tilapia, 5 carp, 2 black bass, 4 punting poles, 2 gliding trajineras and 13 treasure slots, and no other hazards, elements, reeds or pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = deepCanal(seed);
      expect(layout.collectibles).toHaveLength(44);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([8, 6, 14, 16]);
      expect(layout.hazards).toEqual([]);
      expect(layout.elements).toEqual([]);
      expect(layout.reeds).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(TILAPIA_IDS);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CARP_IDS.map((id) => [id, DEEP_CANAL_CARP]),
      ...BASS_IDS.map((id) => [id, DEEP_CANAL_BASS]),
    ]);
    expect(poles.map((spawn) => [spawn.id, spawn.type])).toEqual(POLE_IDS.map((id) => [id, PUNTING_POLE]));
    expect(boats.map((boat) => [boat.id, boat.type.id])).toEqual(BOAT_IDS.map((id) => [id, GLIDING_TRAJINERA.id]));
    expect(trajineras(DEEP_CANAL_LAYOUT.trajineras ?? [])).toHaveLength(2);
    expect(DEEP_CANAL_LAYOUT.padCount).toBe(0);
    expect(DEEP_CANAL_LAYOUT.tilapia).toBe(DEEP_CANAL_TILAPIA);
    expect(tripTreasureTuning(DEEP_CANAL_AREA_ID).slots).toBe(13);
    expect(DEEP_CANAL_LAYOUT.treasures).toBe(DEEP_CANAL_TREASURES);
    expect(DEEP_CANAL_TREASURES).toHaveLength(13);
  });

  it("plays its tilapia one step up the ladder: the owner's 0.8 s warning, 440 px/s strike reaching 155 px, 1.8 s cooldown and 60 px/s patrol, with the full-bar chase", () => {
    expect(DEEP_CANAL_TILAPIA).toEqual({ ...TILAPIA, windup: 0.8, lungeSpeed: 440, lungeRange: 155, cooldown: 1.8, patrolSpeed: 60, chase: TILAPIA_CHASE });
    expect(DEEP_CANAL_TILAPIA.windup).toBe(DEEP_CANAL_TILAPIA.minWindup);
    expect(() => tunedSpecies(TILAPIA_SPECIES, DEEP_CANAL_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one ladder step up from Area 7's: a 1.7 s cooldown and a 55 px/s patrol, Area 7's other values and chase, the warning at the 0.8 s floor", () => {
    expect(DEEP_CANAL_CARP.id).toBe(CARP_SPECIES.id);
    expect(DEEP_CANAL_CARP.tuning).toEqual({ ...SPRING_CAVE_2_CARP.tuning, cooldown: 1.7, patrolSpeed: 55 });
    expect(DEEP_CANAL_CARP.tuning.chase).toBe(SPRING_CAVE_2_CARP.tuning.chase);
    expect(DEEP_CANAL_CARP.tuning.windup).toBe(CARP.minWindup);
    expect(DEEP_CANAL_CARP.tuning.cooldown).toBeLessThan(SPRING_CAVE_2_CARP.tuning.cooldown);
    expect(DEEP_CANAL_CARP.tuning.patrolSpeed).toBeGreaterThan(SPRING_CAVE_2_CARP.tuning.patrolSpeed);
    for (const route of routesOf(zone, CARP_SPECIES.id)) expect(route.species, route.id).toBe(DEEP_CANAL_CARP);
  });

  it("plays its black bass with the owner's values and the bass chase", () => {
    expect(DEEP_CANAL_BASS.id).toBe(BLACK_BASS_SPECIES.id);
    expect(DEEP_CANAL_BASS.rules).toEqual(BLACK_BASS_SPECIES.rules);
    expect(DEEP_CANAL_BASS.tuning).toEqual({ ...BLACK_BASS, chase: BLACK_BASS_CHASE });
    for (const route of routesOf(zone, BLACK_BASS_SPECIES.id)) expect(route.species, route.id).toBe(DEEP_CANAL_BASS);
  });

  it('adds exactly one new threat, the black bass, and one new element, the gliding trajinera', () => {
    expect(newThingsByArea().find((things) => things.areaId === DEEP_CANAL_AREA_ID)).toEqual({
      areaId: DEEP_CANAL_AREA_ID,
      threats: ['black-bass'],
      elements: ['gliding-trajinera'],
    });
  });

  it('names the tilapia, the carp, the black bass and the punting pole as its threats, with their cards, then the tadpole and shrimp cards, and no card for the trajinera', () => {
    const threats = ['tilapia', 'carp', 'black-bass', 'punting-pole'];
    expect(threatIds(DEEP_CANAL_LAYOUT)).toEqual(threats);
    expect(threatIds(zone)).toEqual(threats);
    expect(threatFactCards(DEEP_CANAL_LAYOUT)).toEqual([TILAPIA_FACT, CARP_FACT, BLACK_BASS_FACT, PUNTING_POLE_FACT]);
    const expected = { ids: [...threats, 'tadpole', 'shrimp'], cards: [TILAPIA_FACT, CARP_FACT, BLACK_BASS_FACT, PUNTING_POLE_FACT, TADPOLE_FACT, SHRIMP_FACT] };
    expect(sourceFactCards(DEEP_CANAL_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
    expect(GLIDING_TRAJINERA.fact).toBeUndefined();
  });

  it('is in the deep canal habitat, numbered 8, after Area 7, with the Little trajinera as its Rare special treasure, no look of its own, no darters and a 30% stranding chance', () => {
    expect(DEEP_CANAL_HABITAT).toEqual({ id: 'deep-canal', name: 'Deep canal', look: 'deep-canal' });
    expect(DEEP_CANAL_AREA.layout).toBe(DEEP_CANAL_LAYOUT);
    expect(DEEP_CANAL_AREA.number).toBe(SPRING_CAVE_2_AREA.number + 1);
    expect(DEEP_CANAL_AREA.habitatId).toBe(DEEP_CANAL_HABITAT.id);
    expect(DEEP_CANAL_AREA.specialTreasureId).toBe('deep-canal/little-trajinera');
    expect(DEEP_CANAL_TREASURES.find((treasure) => treasure.id === DEEP_CANAL_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(DEEP_CANAL_AREA.look).toBeUndefined();
    expect(DEEP_CANAL_AREA.snackDart).toBeUndefined();
    expect(areaStrandingChance(DEEP_CANAL_AREA)).toBe(0.3);
    expect(Object.isFrozen(DEEP_CANAL_AREA)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_AREA.exit)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_AREA.snackDrift)).toBe(true);
  });

  it('plays Trajinera Waltz, the deep canal cue (M3)', () => {
    expect(tripCueFor(DEEP_CANAL_AREA)).toBe(TRAJINERA_WALTZ);
  });

  it('adds two Dream colours, one of them a Legendary sheen, and every new patterned or sheen colour is Legendary (B3)', () => {
    const shells = DEEP_CANAL_TREASURES.filter((treasure) => treasure.category === 'paintShell');
    expect(shells.length).toBeGreaterThanOrEqual(2);
    expect(shells.some((shell) => shell.rarity === 'legendary' && isPatternedOrSheen(shell))).toBe(true);
    for (const shell of shells.filter(isPatternedOrSheen)) expect(shell.rarity, shell.id).toBe('legendary');
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = deepCanal(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.trajineras).toEqual(zone.trajineras);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
    }
  });
});

describe('Area 8 two lanes (the area shape rule)', () => {
  it('puts the Home Spot and its safe area in the shared pocket west of the divider, and the exit in the shared pocket east of it', () => {
    expect(zone.safeArea).toEqual({ x0: 40, x1: 330, y0: SURF, y1: 2 * WORLD_H });
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(dividerWest);
    expect(zone.safeArea.x1).toBeLessThan(dividerWest);
    expect(Math.floor(zone.homeSpot.x / SCREEN_W)).toBe(0);
    expect(exit.x - exit.radius).toBeGreaterThan(dividerEast);
    expect(Math.floor(exit.x / SCREEN_W)).toBe(zone.chunks - 1);
  });

  it('splits the water with a solid old-stone divider: 40 px thick stones at most 640 px wide, each touching the next with no gap', () => {
    expect(divider).toEqual([
      { x0: 600, x1: 1240, y0: 340, y1: 380 },
      { x0: 1240, x1: 1880, y0: 340, y1: 380 },
      { x0: 1880, x1: 1920, y0: 200, y1: 380 },
      { x0: 1920, x1: 2240, y0: 200, y1: 240 },
      { x0: 2240, x1: 2280, y0: 200, y1: 380 },
      { x0: 2280, x1: 2920, y0: 340, y1: 380 },
      { x0: 2920, x1: 3560, y0: 340, y1: 380 },
    ]);
    for (const stone of divider) {
      expect(Math.min(stone.x1 - stone.x0, stone.y1 - stone.y0)).toBe(STONE_THICKNESS);
      expect(stone.x1 - stone.x0).toBeLessThanOrEqual(STONE_MAX_WIDTH);
    }
    for (let i = 1; i < divider.length; i++) {
      expect(divider[i].x0, `stone ${i}`).toBe(divider[i - 1].x1);
      expect(rectsMeet(divider[i], divider[i - 1]), `stone ${i}`).toBe(true);
    }
  });

  it('runs the divider mostly at y 340 to 380, stepping up to y 200 to 240 for about one screen', () => {
    const low = divider.filter((stone) => stone.y0 === LOW_RUN.y0 && stone.y1 === LOW_RUN.y1);
    const lowWidth = low.reduce((sum, stone) => sum + stone.x1 - stone.x0, 0);
    expect(lowWidth / (dividerEast - dividerWest)).toBeGreaterThan(0.8);
    expect(raisedStones.every((stone) => stone.y0 === RAISED_RUN.y0)).toBe(true);
    expect(divider.filter((stone) => stone.y1 === RAISED_RUN.y1)).toHaveLength(1);
    expect(raisedEast - raisedWest).toBeGreaterThan(SCREEN_W * 0.75);
    expect(raisedEast - raisedWest).toBeLessThanOrEqual(SCREEN_W);
  });

  it('leaves no way between the lanes over the divider: every column from its west end to its east end meets a stone', () => {
    for (let x = dividerWest; x <= dividerEast; x++) {
      expect(divider.some((stone) => stone.x0 <= x && x <= stone.x1), `x ${x}`).toBe(true);
    }
    expect(SURFACE_LANE.bottom).toBe(LOW_RUN.y0);
    expect(DEEP_LANE.top).toBe(LOW_RUN.y1);
    expect([bounds.minY, bounds.maxY]).toEqual([SURFACE_LANE.top, DEEP_LANE.bottom]);
  });

  it('runs the main path from the Home Spot along the surface lane, over the divider and out of the rock, to the exit', () => {
    const path = zone.mainPath;
    expect(path[0]).toEqual(zone.start);
    expect(path[path.length - 1]).toEqual({ x: exit.x, y: exit.y });
    for (const point of pathSamples(path, 2)) {
      expect(['surface', 'pocket'], `path at ${point.x}, ${point.y}`).toContain(laneOf(point));
      expect(bodyInAnyRock(point, divider), `path at ${point.x}, ${point.y}`).toBe(false);
    }
  });

  it('lets a one-leg axolotl swim each lane from the Home Spot to the exit, against the rock, then home', () => {
    const arrive = (pos: Point) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius;
    const surface = oneLegSeconds(zone.start, zone.mainPath.slice(1), zone, arrive);
    const deep = oneLegSeconds(zone.start, DEEP_WAY.slice(1), zone, arrive);
    expect(pathSamples(DEEP_WAY, 2).filter((point) => laneOf(point) !== 'pocket').every((point) => laneOf(point) === 'deep')).toBe(true);
    expect(surface).toBeCloseTo(ONE_LEG_EXIT_SECONDS.surface, 1);
    expect(deep).toBeCloseTo(ONE_LEG_EXIT_SECONDS.deep, 1);
    expect(Math.max(surface, deep)).toBeLessThan(BEAT_MAX_SECONDS);
    const home = oneLegSeconds(exit, [...zone.mainPath].reverse().slice(1), zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });
});

describe('Area 8 exit', () => {
  it('sits low in the exit pocket, in the water, out of the safe area, within a gate opening of the bed', () => {
    expect(zone.bedTop - exit.y).toBeLessThanOrEqual(158);
    expect(exit).toEqual({ x: 3720, y: 600, radius: 40 });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
  });

  it('keeps the exit out of every predator strike, clear of every pole touch, the current and the rock', () => {
    for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    for (const spawn of poles) expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + spawn.type.touchReach);
    for (const current of zone.currents) expect(shapeDistance(exit, rectOf(current))).toBeGreaterThan(exit.radius);
    for (const stone of divider) expect(shapeDistance(exit, rectOf(stone))).toBeGreaterThan(exit.radius + PEBBLES.bodyReach);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of deepCanal(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 8 danger bar', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats, water and rock as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = deepCanal(seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.safeArea).toEqual(zone.safeArea);
    expect(layout.rockWalls).toEqual(zone.rockWalls);
  });

  it('has 13 moving threats for its 16 screens, at least 12, 3 predator types and the punting pole, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(16);
    expect(movingThreatCount(zone)).toBe(13);
    expect(movingThreatCount(zone)).toBeGreaterThanOrEqual(12);
    expect(predatorTypeCount(zone)).toBe(3);
    expect(movingHazardTypeCount(zone)).toBe(1);
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never leaves a quiet swim in the whole water longer than one screen across, counting the divider as no water', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 1);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(SCREEN_W);
  });

  it("never leaves a quiet swim longer than one screen across in either lane, counting only that lane's threats", () => {
    const surface = longestQuietSwim(laneGeometry(zone, 'surface'));
    const deep = longestQuietSwim(laneGeometry(zone, 'deep'));
    expect(surface?.length).toBeCloseTo(LANE_QUIET_SWIM.surface, 1);
    expect(deep).toBe(LANE_QUIET_SWIM.deep);
    for (const swim of [surface, deep]) expect(swim?.length ?? 0).toBeLessThanOrEqual(SCREEN_W);
  });

  it('patrols every depth: each tilapia, carp and bass loop reaches 24 px into two bands, and each species together reaches all three', () => {
    const bands = depthBands(zone);
    expect(bands.map((band) => [band.top, band.bottom])).toEqual([
      [94, expect.closeTo(281.33, 2)],
      [expect.closeTo(281.33, 2), expect.closeTo(468.67, 2)],
      [expect.closeTo(468.67, 2), 656],
    ]);
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
  });

  it('has surface danger and keeps the floor lane quiet for no more than one screen across', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBe(FLOOR_QUIET_STRETCH);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('has 5 carp for its 16 screens, the carp target', () => {
    expect(carpTarget(16)).toBe(5);
    expect(carpCount(zone)).toBe(5);
  });
});

describe('Area 8 lanes of threats', () => {
  const lanes = new Map([...zone.tilapiaRoutes, ...zone.predatorRoutes].map((route) => [route.id, loopLane(route.waypoints)]));

  it('keeps every predator loop wholly in one lane: one tilapia in each, the carp split between them and both bass in the deep lane', () => {
    expect(Object.fromEntries(lanes)).toEqual({
      'tilapia-0': 'surface',
      'tilapia-1': 'deep',
      'carp-0': 'surface',
      'carp-1': 'surface',
      'carp-2': 'deep',
      'carp-3': 'deep',
      'carp-4': 'deep',
      'bass-0': 'deep',
      'bass-1': 'deep',
    });
  });

  it('keeps every predator body clear of the divider, all but the bass under the raised run, which reaches up to y 257 under it', () => {
    for (const { route, body } of strikeRoutes(zone)) {
      const away = Math.min(...divider.map((stone) => shapeRouteDistance(rectOf(stone), route.waypoints)));
      if (route.id === 'bass-1') {
        expect(away, route.id).toBe(RAISED_BASS_TOP - RAISED_RUN.y1);
        continue;
      }
      expect(away, route.id).toBeGreaterThan(body);
    }
  });

  it('puts bass-1 under the raised run, reaching up to y 257, so the bass reach the surface band', () => {
    const [bass] = routesOf(zone, BLACK_BASS_SPECIES.id).filter((route) => route.id === 'bass-1');
    const top = Math.min(...bass.waypoints.map((point) => point.y));
    expect(top).toBe(RAISED_BASS_TOP);
    expect(top).toBeLessThanOrEqual(depthBands(zone)[0].bottom - 24);
    for (const point of bass.waypoints.filter((each) => each.y < DEEP_LANE.top)) {
      expect(point.x, `bass-1 at ${point.x}, ${point.y}`).toBeGreaterThan(raisedWest);
      expect(point.x, `bass-1 at ${point.x}, ${point.y}`).toBeLessThan(raisedEast);
    }
  });

  it('jabs every punting pole down in the surface lane, its touch clear of the divider, of every boat span and of the raised run', () => {
    expect(poles.length).toBeGreaterThanOrEqual(3);
    for (const spawn of poles) {
      const touch = touchZone(spawn);
      expect(movingHazardBaseY(spawn), spawn.id).toBe(SURF);
      expect(movingHazardDirection(spawn), spawn.id).toBe(1);
      expect(movingHazardDepth(spawn), spawn.id).toBe(240);
      expect(laneOf({ x: spawn.x, y: movingHazardSweep(spawn).y1 }), spawn.id).toBe('surface');
      for (const stone of divider) expect(rectDistance(movingHazardSweep(spawn), rectOf(stone)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
      for (const band of hullBands) expect(touch.x1 < band.x0 || touch.x0 > band.x1, spawn.id).toBe(true);
      expect(touch.x1 < raisedWest || touch.x0 > raisedEast, spawn.id).toBe(true);
    }
  });

  it('keeps every pole sweep farther than the strike from every patrol loop in its lane, the divider between it and the deep lane', () => {
    for (const spawn of poles) {
      for (const { route, strike } of strikeRoutes(zone).filter(({ route }) => loopLane(route.waypoints) === 'surface')) {
        expect(shapeRouteDistance(movingHazardSweep(spawn), route.waypoints), `${spawn.id} to ${route.id}`).toBeGreaterThan(strike);
      }
    }
  });

  it('keeps every predator loop in the water and out of the safe area', () => {
    for (const { route } of strikeRoutes(zone)) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
      }
    }
  });
});

describe('Area 8 gliding trajineras', () => {
  it('glides two boats out of step across spans of at most 300 px in the surface lane, west and east of the raised run and clear of the moored boats', () => {
    expect(TRAJINERA_MAX_SPAN).toBe(300);
    expect(boats.map((boat) => [boat.offset, boat.trajinera])).toEqual([
      [0, { x0: 1250, x1: 1550, direction: 'right' }],
      [3, { x0: 2700, x1: 3000, direction: 'left' }],
    ]);
    expect(boats[1].offset - boats[0].offset).toBe(GLIDING_TRAJINERA.period / 2);
    for (const boat of boats) {
      expect(boat.trajinera.x1 - boat.trajinera.x0, boat.id).toBeLessThanOrEqual(TRAJINERA_MAX_SPAN);
      const band = trajineraHullBand(boat);
      expect(band.x1 < raisedWest || band.x0 > raisedEast, boat.id).toBe(true);
      expect(band.x0, boat.id).toBeGreaterThan(dividerWest);
      expect(band.x1, boat.id).toBeLessThan(dividerEast);
      expect(band.y1 + TRAJINERAS.bodyReach, boat.id).toBeLessThan(SURFACE_LANE.bottom);
      for (const moored of zone.bankOverhangs ?? []) expect(rectsMeet(band, moored), boat.id).toBe(false);
    }
  });

  it('lets the main path pass under every hull, clear of it by the body reach', () => {
    for (const point of pathSamples(zone.mainPath, 2)) {
      for (const band of hullBands) {
        if (point.x < band.x0 || point.x > band.x1) continue;
        expect(point.y, `path at ${point.x}`).toBeGreaterThanOrEqual(band.y1 + TRAJINERAS.bodyReach);
      }
    }
  });

  it('keeps every tadpole loop and every shrimp home out of every hull band (as with a mat sweep)', () => {
    const drift = DEEP_CANAL_AREA.snackDrift;
    for (const wander of zone.mobileSnacks?.wanders ?? []) {
      for (const box of legBoxesOf(wander.points)) {
        for (const band of hullBands) expect(rectsMeet(box, band), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(false);
      }
    }
    for (const home of zone.mobileSnacks?.homes ?? []) {
      for (const spot of home.points) {
        for (const band of hullBands) expect(rectsMeet(shrimpBox(spot, drift), band), `home at ${home.points[0].x}`).toBe(false);
      }
    }
  });

  it('is never a threat: no hazard, moving hazard or predator, so the danger bar never counts it', () => {
    const ids = boats.map((boat) => boat.id);
    expect(zone.hazards.some((hazard) => ids.includes(hazard.id))).toBe(false);
    expect(poles.some((spawn) => ids.includes(spawn.id))).toBe(false);
    expect(threatIds(zone)).not.toContain(GLIDING_TRAJINERA.id);
  });
});

describe('Area 8 hiding spots (B5, B6, B10)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, with the turn clearance, for seed %i', (seed) => {
    const layout = deepCanal(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('deep-canal-1/spot-'), spot.id).toBe(true);
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

  it('has 6 Common, 5 Rare, 3 Epic and 4 Legendary spots, every pool larger than its Area 8 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([6, 5, 3, 4]);
    expect(RARITIES.map((rarity) => DEEP_CANAL_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    for (const rarity of RARITIES) {
      const treasures = DEEP_CANAL_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides Common and Rare spots under the moored boats in the surface lane: Commons by the main path, Rares away from it', () => {
    const shallow = zone.spots.filter((spot) => spot.rarity === 'common' || spot.rarity === 'rare');
    for (const spot of shallow) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(laneOf(spot), spot.id).toBe('surface');
      expect(spot.container, spot.id).toBe(false);
      const near = distanceToPath(spot, zone.mainPath) <= MAIN_PATH_REACH;
      expect(near, spot.id).toBe(spot.rarity === 'common');
    }
    for (const moored of zone.bankOverhangs ?? []) expect(moored.y0, 'moored boats float at the surface').toBe(SURF);
  });

  it('puts an Epic spot and an open Legendary spot in the sunken trajinera hull, a dead end on the deep-lane bed by carp-2', () => {
    const cave = zone.spots.filter((spot) => spot.cover === 'cave');
    expect(cave.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [730, 655, 'legendary', false],
      [790, 610, 'epic', false],
    ]);
    expect(zone.cave).toEqual({ id: 'deep-canal-1/cave', x0: 700, x1: 900, y0: 590, y1: zone.bedTop });
    expect(laneOf({ x: zone.cave.x0, y: zone.cave.y0 })).toBe('deep');
    const [carp] = routesOf(zone, CARP_SPECIES.id).filter((route) => route.id === 'carp-2');
    expect(routeLoopDistance(cave[0], carp.waypoints)).toBeLessThanOrEqual(DEEP_CANAL_CARP.tuning.lungeRange / 2);
  });

  it('puts three open Legendary spots just past the side-canal inflow, within half the bass strike of bass-0, and two Epic spots past it farther off', () => {
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [2990, 484, 'legendary', false],
      [2990, 540, 'legendary', false],
      [2980, 600, 'legendary', false],
      [2920, 560, 'epic', false],
      [2920, 630, 'epic', false],
    ]);
    const [bass] = routesOf(zone, BLACK_BASS_SPECIES.id);
    expect(bass.id).toBe('bass-0');
    for (const spot of past) {
      expect(coversAt(spot, zone), spot.id).toEqual(['pastCurrent']);
      expect(laneOf(spot), spot.id).toBe('deep');
      const away = routeLoopDistance(spot, bass.waypoints);
      if (spot.rarity === 'legendary') expect(away, spot.id).toBeLessThanOrEqual(DEEP_CANAL_BASS.tuning.lungeRange / 2);
      else expect(away, spot.id).toBeGreaterThan(DEEP_CANAL_BASS.tuning.lungeRange / 2);
    }
  });

  it('has no Dash pot: every Legendary spot is deep and near a threat, so the Legendary rule needs none (ADR 0032)', () => {
    expect(zone.spots.filter((spot) => spot.container)).toEqual([]);
    for (const spot of zone.spots.filter((each) => each.rarity === 'legendary')) {
      expect(['cave', 'pastCurrent'], spot.id).toContain(spot.cover);
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area and the rock, clear of the ring and spaced for seed %i', (seed) => {
    const layout = deepCanal(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot, layout), spot.id).toBe(true);
      expect(inSafeArea(spot, layout.safeArea), spot.id).toBe(false);
      expect(bodyInAnyRock(spot, divider), spot.id).toBe(false);
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

describe('Area 8 placing treasure (B4)', () => {
  const tuning = tripTreasureTuning(DEEP_CANAL_AREA_ID);
  const options = { extras: [DEEP_CANAL_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 13 slots, the lost treasures and the Little trajinera', () => {
    const all = DEEP_CANAL_TREASURES.map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(DEEP_CANAL_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('puts the 3 Legendaries in 3 distinct Legendary spots when all 13 treasures must be placed, the hull spot on some trips', () => {
    const all = DEEP_CANAL_TREASURES.map((treasure) => treasure.id);
    const legendaryIds = DEEP_CANAL_TREASURES.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id);
    const legendarySpotIds = zone.spots.filter((spot) => spot.rarity === 'legendary').map((spot) => spot.id);
    const hullId = zone.spots.find((spot) => spot.rarity === 'legendary' && spot.cover === 'cave')?.id;
    const used = new Set<string>();
    for (const tripSeed of TRIP_SEEDS) {
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      const legendarySpots = lost.filter((find) => legendaryIds.includes(find.id)).map((find) => find.spotId);
      expect(legendarySpots, `trip seed ${tripSeed}`).toHaveLength(legendaryIds.length);
      expect(new Set(legendarySpots).size, `trip seed ${tripSeed}`).toBe(legendaryIds.length);
      for (const spotId of legendarySpots) expect(legendarySpotIds, `trip seed ${tripSeed}`).toContain(spotId);
      for (const spotId of legendarySpots) used.add(spotId);
    }
    expect(hullId).toBeDefined();
    expect(used.has(hullId ?? '')).toBe(true);
  });

  it('leaves few of the 13 slots empty over 200 fresh trips', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 8 side-canal inflow and stranding places', () => {
  it('flows gently to the left at 73 px/s on the deep-lane bed, off the main path', () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -73, y: 0 });
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(17);
    expect(laneOf({ x: current.x0, y: current.y0 })).toBe('deep');
    expect(current.y0 - DEEP_LANE.top).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    for (const point of pathSamples(zone.mainPath, 4)) expect(isInsideCurrent(point, current)).toBe(false);
  });

  it.each(ALL_SEEDS)('keeps every stranding place in a lane, 80 px from every route, clear of the poles, the rock, the spots and the current for seed %i', (seed) => {
    const layout = deepCanal(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `deep-canal-1/strand-${n}`));
    expect(layout.strandingPlaces.map((place) => laneOf(place))).toEqual(['deep', 'surface', 'deep', 'deep', 'surface', 'surface']);
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(bodyInAnyRock(place, divider), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(routeDistance(place, [...layout.tilapiaRoutes, ...layout.predatorRoutes]), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spawn of layout.movingHazards ?? []) {
        expect(shapeDistance(place, movingHazardSweep(spawn)), `${place.id} to ${spawn.id}`).toBeGreaterThanOrEqual(STRAND_HAZARD_CLEARANCE);
      }
      for (const spot of layout.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 8 gaps and routes (the level layout ladder)', () => {
  it("swims the main path through a gap no wider than Area 7's narrowest, between pole-2 and tilapia-0, and never under the safe passing width", () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe('deep-canal-1/punting-pole-2 and tilapia-0');
    expect(narrowest.width).toBeCloseTo(SAFE_PASSING_WIDTH, 9);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    expect(narrowest.width).toBeLessThanOrEqual(narrowestPathGap(area7).width);
  });

  it('branches into two lanes that join at the exit, and has two dead ends holding treasure off the main path: the sunken hull and the water past the inflow', () => {
    const caveSpots = zone.spots.filter((spot) => spot.cover === 'cave');
    const pastSpots = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect([caveSpots.length, pastSpots.length]).toEqual([2, 5]);
    for (const spot of [...caveSpots, ...pastSpots]) expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
  });
});

describe('Area 8 snacks', () => {
  const drift = DEEP_CANAL_AREA.snackDrift;
  const surfacePeak = 80 + 1.6 + 0.8;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every pole sweep, every hull band and the rock for seed %i', (seed) => {
    const layout = deepCanal(seed);
    expect(layout.collectibles).toHaveLength(44);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      for (const stone of divider) expect(shapeDistance(snack, rectOf(stone)), `${snack.id} seed ${seed}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of layout.movingHazards ?? []) expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      for (const band of hullBands) expect(shapeDistance(snack, band), `${snack.id} seed ${seed}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the inflow, and only worms and bugs in it, for seed %i', (seed) => {
    const layout = deepCanal(seed);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(DEEP_CANAL_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = deepCanal(seed);
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

  it("drift a little faster than Area 7, slower than a one-leg axolotl swims against the inflow, and at most half the magnet pull", () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(zone.currents[0].force.x);
    expect(drift).toEqual({ ...SPRING_CAVE_2_AREA.snackDrift, periodX: 7.0, periodY: 5.6 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(SPRING_CAVE_2_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('has no one-time darters: no dart rule, and its shrimp replace them', () => {
    expect(oneTimeDarts(DEEP_CANAL_AREA, zone)).toBeNull();
  });

  it.each(ALL_SEEDS)(
    'gives every shrimp a clear place, and every hop spot of its home a flick landing isShrimpFlickLandingClear allows in at least one of 8 directions, for seed %i',
    (seed) => {
      const layout = deepCanal(seed);
      const avoid = mobileSnackAvoid(layout);
      const rule = layout.mobileSnacks?.shrimp;
      if (!rule) throw new Error('Area 8 has no shrimp rule');
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

describe('Area 8 mobile snacks', () => {
  const mix = zone.mobileSnacks;
  const drift = DEEP_CANAL_AREA.snackDrift;

  it("meets the later row of the snack ramp: 30 of its 44 snacks mobile, a share above Area 7's 27 of 40 and at most 0.7, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(8, DEEP_CANAL_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(30);
    const share = mobile / zone.collectibles.length;
    expect(share).toBeCloseTo(0.682, 3);
    expect(share).toBeGreaterThan(27 / 40);
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(DEEP_CANAL_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('swims fourteen tadpoles on wander loops of 4 points, each leg 1.5 to 5 s, each a fourteenth of its own lap further on than the last', () => {
    const wanders = mix?.wanders ?? [];
    const speed = mix?.tadpole?.speed ?? 0;
    expect(wanders).toHaveLength(14);
    for (const [index, wander] of wanders.entries()) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      expect(wander.points.length, label).toBe(4);
      const legs = loopLegLengths(wander.points);
      for (const leg of legs) {
        expect(leg, label).toBeGreaterThanOrEqual(TADPOLES.minLegSeconds * speed);
        expect(leg, label).toBeLessThanOrEqual(TADPOLES.maxLegSeconds * speed);
      }
      const lapSeconds = legs.reduce((sum, leg) => sum + leg, 0) / speed;
      expect(lapSeconds, label).toBeLessThanOrEqual(TADPOLES.maxLapSeconds);
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 14, 9);
    }
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall, keeping to one lane', () => {
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      const box = homeBoxOf(wander.points);
      expect(box.x1 - box.x0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
      expect(['surface', 'deep'], label).toContain(loopLane(wander.points));
    }
  });

  it('never swims a tadpole or hops a shrimp into the inflow or the rock', () => {
    const rects = [...zone.currents.map(rectOf), ...divider.map(rectOf)];
    for (const wander of mix?.wanders ?? []) {
      for (const point of pathSamples([...wander.points, wander.points[0]], 2)) {
        for (const rect of rects) expect(shapeDistance(point, rect), `loop at ${wander.points[0].x}`).toBeGreaterThan(0);
      }
    }
    for (const home of mix?.homes ?? []) {
      for (const spot of home.points) for (const rect of rects) expect(rectDistance(shrimpBox(spot, drift), rect), `home at ${home.points[0].x}`).toBeGreaterThan(0);
    }
  });

  it('lets a one-leg axolotl catch every tadpole within 20 s (the one-leg catch proof)', () => {
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) {
      expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
  });

  it("gives its sixteen shrimp Area 7's shrimp rule, on homes of 3 hop spots in a box at most 200 x 160 px", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    expect(mix?.shrimp).toEqual(SPRING_CAVE_2_LAYOUT.mobileSnacks?.shrimp);
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
    const layout = deepCanal(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(1.2 * 72, 9);
  });
});

describe('Area 8 difficulty', () => {
  it('is harder than Area 7: more snacks, faster drift, more slots, a stronger carp, one more predator type and a longer-reaching new predator', () => {
    expect(zone.collectibles.length).toBeGreaterThan(area7.collectibles.length);
    expect(snackDriftMaxSpeed(DEEP_CANAL_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(SPRING_CAVE_2_AREA.snackDrift));
    expect(tripTreasureTuning(DEEP_CANAL_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(SPRING_CAVE_2_AREA.id).slots);
    expect(DEEP_CANAL_CARP.tuning.cooldown).toBeLessThan(SPRING_CAVE_2_CARP.tuning.cooldown);
    expect(DEEP_CANAL_CARP.tuning.patrolSpeed).toBeGreaterThan(SPRING_CAVE_2_CARP.tuning.patrolSpeed);
    expect(predatorTypeCount(zone)).toBeGreaterThan(predatorTypeCount(area7));
    const area7Reach = Math.max(...area7.predatorRoutes.map((route) => route.species.tuning.lungeRange));
    expect(DEEP_CANAL_BASS.tuning.lungeRange).toBeGreaterThan(area7Reach);
  });
});
