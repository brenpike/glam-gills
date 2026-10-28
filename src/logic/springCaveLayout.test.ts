import { describe, expect, it } from 'vitest';
import { CHINAMPA_2_AREA, SPRING_CAVE_AREA, SPRING_CAVE_HABITAT, newThingsByArea, sourceFactCards, threatFactCards, threatIds } from './areas';
import { RARITIES, SPRING_CAVE_TREASURES } from './catalogue';
import { CHINAMPA_2_CARP, CHINAMPA_2_LAYOUT } from './chinampa2Layout';
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
import { currentAt, reedDragAt } from './environment';
import { CARP_FACT, CRAYFISH_FACT, PUNTING_POLE_FACT, SHRIMP_FACT, TADPOLE_FACT } from './factCards';
import {
  DARK_SHOWN_PARTS,
  GLOW_PLANTS,
  darkHintPlant,
  darkLights,
  glowPlantReachable,
  glowPlants,
  glowShowsBeforeReach,
  inDarkWater,
  litByAny,
  shownInDark,
} from './glowPlants';
import { GLOW_PLANT, shapeDistance, type HazardRect, type HazardShape } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, pastCurrentBand, riskBands, routeDistance, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
import { SAFE_PASSING_WIDTH, loopSamples, narrowestPathGap, obstaclesOf } from './layoutGaps';
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
import { CENOTE_GLOW, tripCueFor } from './music';
import { PUNTING_POLE, movingHazardDepth, movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import { PERK_CAPS, SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { CARP_SPECIES, CRAYFISH_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import { RESCUE, STRANDING_CHANCE, areaStrandingChance } from './rescue';
import {
  CRAYFISH_FLOOR_Y,
  GLOW_PLANT_RADIUS,
  SPRING_CAVE_AREA_ID,
  SPRING_CAVE_CARP,
  SPRING_CAVE_CRAYFISH,
  SPRING_CAVE_LAYOUT,
} from './springCaveLayout';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  CARP,
  CARP_CHASE,
  CRAYFISH,
  CRAYFISH_CHASE,
  FINDS,
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
  areaRowKind,
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
const CARP_STRIKE = SPRING_CAVE_CARP.tuning.lungeRange;
const CRAYFISH_STRIKE = SPRING_CAVE_CRAYFISH.tuning.lungeRange;
const STRANDING_ROUTE_CLEARANCE = 80;
/** Least px from a stranding place to every pole sweep: the touch reach plus the rescue reach. */
const STRAND_POLE_CLEARANCE = PUNTING_POLE.touchReach + RESCUE.reachRadius;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** Directions a shrimp's flick target is tried in. */
const FLICK_DIRECTIONS = 8;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends (issue #77, ND-4). */
const LONGEST_QUIET_SWIM = { length: 477.59, from: { x: 872, y: 102 }, to: { x: 1104, y: 430 } };
/** Longest quiet stretch of the floor lane in px, as measured (issue #77, ND-4). */
const FLOOR_QUIET_STRETCH = 370;
/** One-leg seconds along the main path to the exit, as measured (issue #77, ND-9). */
const ONE_LEG_EXIT_SECONDS = 62.35;
/** Area 5's narrowest main-path gap, which Area 6's must be under (the level layout ladder). */
const AREA_5_NARROWEST = 48;
/** The clear stretches of each line between two rows, out of every obstacle's keep-out, as measured (issue #77, ND-11). */
const ROW_OPENINGS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  360: [
    [40, 469],
    [961, 1219],
    [1711, 1969],
  ],
  720: [
    [40, 89],
    [551, 869],
    [1381, 1569],
    [2181, 2360],
  ],
};
/** Empty treasure slots over the 200 fresh trips, as measured: 11 slots for 12 treasures leave some empty (issue #77, ND-12). */
const EMPTY_SLOTS = { most: 4, mean: 2.4 };
const CRAYFISH_IDS = [0, 1, 2].map((n) => `crayfish-${n}`);
const CARP_IDS = [0, 1, 2, 3, 4, 5].map((n) => `carp-${n}`);
const POLE_IDS = [1, 2, 3, 4].map((n) => `spring-cave-1/punting-pole-${n}`);
const PLANT_IDS = [1, 2, 3, 4, 5, 6].map((n) => `spring-cave-1/glow-plant-${n}`);

const zone = buildZone(SPRING_CAVE_LAYOUT, DEFAULT_ZONE_SEED);
const area5 = buildZone(CHINAMPA_2_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const dark = SPRING_CAVE_LAYOUT.darkWater ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
const { exit } = SPRING_CAVE_AREA;

function springCave(seed: number): ZoneLayout {
  return buildZone(SPRING_CAVE_LAYOUT, seed);
}

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const limits = swimBounds(layout);
  return point.x >= limits.minX && point.x <= limits.maxX && point.y >= limits.minY && point.y <= limits.maxY;
}

/** Least distance from a hazard shape to a closed loop, sampled along the loop. */
function shapeRouteDistance(shape: HazardShape, waypoints: readonly Point[]): number {
  return Math.min(...loopSamples(waypoints).map((point) => shapeDistance(point, shape)));
}

/** Least distance between two rects; 0 when they touch or overlap. */
function rectDistance(first: HazardShape, second: HazardShape): number {
  if (first.kind !== 'rect' || second.kind !== 'rect') throw new Error('rectDistance: both shapes must be rects');
  const dx = Math.max(first.x0 - second.x1, 0, second.x0 - first.x1);
  const dy = Math.max(first.y0 - second.y1, 0, second.y0 - first.y1);
  return Math.hypot(dx, dy);
}

/** The zone's crayfish routes: its predator routes whose species is the crayfish. */
function crayfishOf(layout: Pick<ZoneLayout, 'predatorRoutes'>): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === CRAYFISH_SPECIES.id);
}

/** The zone's carp routes: its predator routes whose species is the common carp. */
function carpOf(layout: Pick<ZoneLayout, 'predatorRoutes'>): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
}

/** Each predator route with its strike: 90 px for a crayfish, 130 px for a carp. */
function strikeRoutes(layout: ZoneLayout): { route: TilapiaRoute; strike: number }[] {
  return layout.predatorRoutes.map((route) => ({ route, strike: route.species.tuning.lungeRange }));
}

/** Points every `step` px along an open path. */
function pathSamples(path: readonly Point[], step: number): Point[] {
  return path.slice(1).flatMap((to, i) => {
    const from = path[i];
    const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
    return Array.from({ length: count + 1 }, (_, k) => ({ x: from.x + ((to.x - from.x) * k) / count, y: from.y + ((to.y - from.y) * k) / count }));
  });
}

/** The box round the points, edges included: a tadpole's home box or a shrimp home's box. */
function homeBoxOf(points: readonly Point[]): HazardRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { kind: 'rect', x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** The middle of a home box. */
function homeCentreOf(points: readonly Point[]): Point {
  const box = homeBoxOf(points);
  return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
}

/** The screen row (0 on top) a home box sits wholly in, or -1 when it crosses the line between two rows. */
function homeRowOf(points: readonly Point[]): number {
  const box = homeBoxOf(points);
  const row = Math.floor(box.y0 / WORLD_H);
  return box.y1 <= (row + 1) * WORLD_H ? row : -1;
}

/** The length of each leg of the closed loop through `points`, leg i from points[i] to the next. */
function loopLegLengths(points: readonly Point[]): number[] {
  return points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
}

/** One frame of a one-leg swim steered at `target`, with the area's currents and reed drag. */
function swimToward(state: SwimState, target: Point, layout: ZoneLayout): SwimState {
  const pos = { x: state.x, y: state.y };
  const env = {
    current: currentAt(pos, layout.currents),
    dragMul: reedDragAt(pos, layout.reedPatches),
    bounds: swimBounds(layout),
    dashing: false,
  };
  const steer = normalize({ x: target.x - pos.x, y: target.y - pos.y });
  return stepSwim(state, steer, env, FRAME, legSwimTuning(1));
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

/** The zone's punting poles, in data order. */
function polesOf(layout: { readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[] }): readonly Readonly<MovingHazardSpawn>[] {
  return layout.movingHazards ?? [];
}

/** Where a pole can touch the body centre: its sweep grown by the touch reach on every side. */
function poleZone(spawn: Readonly<MovingHazardSpawn>): HazardRect {
  const sweep = movingHazardSweep(spawn);
  const { touchReach } = spawn.type;
  return { kind: 'rect', x0: sweep.x0 - touchReach, x1: sweep.x1 + touchReach, y0: sweep.y0 - touchReach, y1: sweep.y1 + touchReach };
}

/** Whether `point` is within any obstacle's keep-out (obstaclesOf): a route's strike or a shape's touch reach. */
function blockedAt(point: Point, layout: ZoneLayout): boolean {
  return obstaclesOf(layout).some((obstacle) => {
    const away = obstacle.kind === 'route' ? routeLoopDistance(point, obstacle.waypoints) : shapeDistance(point, obstacle.shape);
    return away <= obstacle.keepOut;
  });
}

/** The clear stretches of the line at `y` across the swim bounds, sampled every 1 px, as [from, to] pairs. */
function rowOpenings(layout: ZoneLayout, y: number): [number, number][] {
  const limits = swimBounds(layout);
  const openings: [number, number][] = [];
  let from: number | null = null;
  for (let x = limits.minX; x <= limits.maxX; x++) {
    const clear = !blockedAt({ x, y }, layout);
    if (clear && from === null) from = x;
    if (from !== null && (!clear || x === limits.maxX)) {
      openings.push([from, clear ? x : x - 1]);
      from = null;
    }
  }
  return openings;
}

/** Every point of the dark water on a grid `step` px apart, edges included. */
function darkGrid(step: number): Point[] {
  const points: Point[] = [];
  for (let x = dark.x0; x <= dark.x1; x += step) {
    for (let y = dark.y0; y <= dark.y1; y += step) points.push({ x, y });
  }
  return points;
}

describe('SPRING_CAVE_LAYOUT', () => {
  it('is Area 6 data: 5 screens across, 3 down, starting at the Home Spot', () => {
    expect(SPRING_CAVE_AREA_ID).toBe('spring-cave-1');
    expect(SPRING_CAVE_LAYOUT.id).toBe(SPRING_CAVE_AREA_ID);
    expect(zone.width).toBe(2400);
    expect(zone.height).toBe(1080);
    expect(zone.bedTop).toBe(1038);
    expect(zone.chunks).toBe(5);
    expect(zone.rows).toBe(3);
    expect(zone.start).toEqual({ x: 120, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('spring-cave-1/cave');
  });

  it('is frozen data, down to each crayfish stretch, carp loop, punting pole, glow-plant and mobile snack', () => {
    expect(Object.isFrozen(SPRING_CAVE_LAYOUT)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_CARP)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_CARP.tuning)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_CRAYFISH)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_CRAYFISH.tuning)).toBe(true);
    for (const part of [
      SPRING_CAVE_LAYOUT.elements,
      SPRING_CAVE_LAYOUT.predatorRoutes,
      SPRING_CAVE_LAYOUT.bankOverhangs,
      SPRING_CAVE_LAYOUT.bankSpots,
      SPRING_CAVE_LAYOUT.mainPath,
      SPRING_CAVE_LAYOUT.strandingPlaces,
      SPRING_CAVE_LAYOUT.movingHazards,
      SPRING_CAVE_LAYOUT.darkWater,
      SPRING_CAVE_LAYOUT.mobileSnacks,
      SPRING_CAVE_LAYOUT.mobileSnacks?.wanders,
      SPRING_CAVE_LAYOUT.mobileSnacks?.homes,
      SPRING_CAVE_LAYOUT.mobileSnacks?.tadpole,
      SPRING_CAVE_LAYOUT.mobileSnacks?.shrimp,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const spawn of polesOf(SPRING_CAVE_LAYOUT)) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const wander of SPRING_CAVE_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of SPRING_CAVE_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
    for (const route of SPRING_CAVE_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const element of SPRING_CAVE_LAYOUT.elements) {
      expect(Object.isFrozen(element), element.id).toBe(true);
      expect(Object.isFrozen(element.glowPlant), element.id).toBe(true);
    }
  });

  it('has 36 snacks (6 worms, 6 bugs, 13 tadpoles and 11 shrimp), 3 crayfish, 6 carp, 4 punting poles, 6 glow-plants and 11 treasure slots, and no tilapia, nets, reeds or pads (issue #77, ND-4, ND-8, ND-10)', () => {
    for (const seed of ALL_SEEDS) {
      const layout = springCave(seed);
      expect(layout.collectibles).toHaveLength(36);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([6, 6, 13, 11]);
      expect(layout.tilapiaRoutes).toEqual([]);
      expect(layout.hazards).toEqual([]);
      expect(polesOf(layout).map((spawn) => spawn.id)).toEqual(POLE_IDS);
      expect(layout.reeds).toEqual([]);
      expect(layout.reedPatches).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CRAYFISH_IDS.map((id) => [id, SPRING_CAVE_CRAYFISH]),
      ...CARP_IDS.map((id) => [id, SPRING_CAVE_CARP]),
    ]);
    expect(crayfishOf(zone).map((route) => route.id)).toEqual(CRAYFISH_IDS);
    expect(carpCount(zone)).toBe(6);
    for (const spawn of polesOf(zone)) expect(spawn.type, spawn.id).toBe(PUNTING_POLE);
    expect(zone.elements.map((element) => [element.id, element.type.id])).toEqual(PLANT_IDS.map((id) => [id, 'glow-plant']));
    expect(SPRING_CAVE_LAYOUT.elements.every((element) => element.type === GLOW_PLANT)).toBe(true);
    expect(SPRING_CAVE_LAYOUT.padCount).toBe(0);
    expect(SPRING_CAVE_LAYOUT.padSpotIndex).toBeNull();
    expect(SPRING_CAVE_LAYOUT.tilapia).toBeUndefined();
    expect(tripTreasureTuning(SPRING_CAVE_AREA_ID).slots).toBe(11);
    expect(SPRING_CAVE_LAYOUT.treasures).toBe(SPRING_CAVE_TREASURES);
  });

  it("plays the crayfish with the owner's values and its chase along its stretch only (issue #77, ND-5)", () => {
    expect(SPRING_CAVE_CRAYFISH.id).toBe(CRAYFISH_SPECIES.id);
    expect(SPRING_CAVE_CRAYFISH.rules).toEqual(CRAYFISH_SPECIES.rules);
    expect(SPRING_CAVE_CRAYFISH.rules?.warnOnRoute).toBe(true);
    expect(SPRING_CAVE_CRAYFISH.tuning).toEqual({ ...CRAYFISH, chase: CRAYFISH_CHASE });
    expect(SPRING_CAVE_CRAYFISH.tuning.chase).toBe(CRAYFISH_CHASE);
    expect(CRAYFISH_CHASE.leash).toBe(0);
    expect(() => tunedSpecies(CRAYFISH_SPECIES, SPRING_CAVE_CRAYFISH.tuning)).not.toThrow();
    for (const route of crayfishOf(zone)) expect(route.species, route.id).toBe(SPRING_CAVE_CRAYFISH);
  });

  it('plays its common carp one step up the predator ladder from Area 5, its warning over the floor, with its chase default (issue #77, ND-6)', () => {
    expect(SPRING_CAVE_CARP.id).toBe(CARP_SPECIES.id);
    expect(SPRING_CAVE_CARP.dangerPart).toBe(true);
    expect(SPRING_CAVE_CARP.tuning).toEqual({ ...CARP, windup: 0.925, lungeSpeed: 220, lungeDuration: 0.6, lungeRange: 130, cooldown: 2.2, patrolSpeed: 40, chase: CARP_CHASE });
    expect(SPRING_CAVE_CARP.tuning.chase).toBe(CARP_CHASE);
    expect(SPRING_CAVE_CARP.tuning.windup).toBeGreaterThan(SPRING_CAVE_CARP.tuning.minWindup);
    expect(SPRING_CAVE_CARP.tuning.minWindup).toBe(0.8);
    expect(() => tunedSpecies(CARP_SPECIES, SPRING_CAVE_CARP.tuning)).not.toThrow();
    const area5Carp = CHINAMPA_2_CARP.tuning;
    expect(SPRING_CAVE_CARP.tuning.windup).toBeLessThan(area5Carp.windup);
    expect(SPRING_CAVE_CARP.tuning.lungeSpeed).toBeGreaterThan(area5Carp.lungeSpeed);
    expect(SPRING_CAVE_CARP.tuning.lungeRange).toBeGreaterThan(area5Carp.lungeRange);
    expect(SPRING_CAVE_CARP.tuning.cooldown).toBeLessThan(area5Carp.cooldown);
    expect(SPRING_CAVE_CARP.tuning.patrolSpeed).toBeGreaterThan(area5Carp.patrolSpeed);
    for (const route of carpOf(zone)) expect(route.species, route.id).toBe(SPRING_CAVE_CARP);
  });

  it('adds one new threat, the crayfish, and one new element, the glow-plant', () => {
    expect(newThingsByArea().find((things) => things.areaId === SPRING_CAVE_AREA_ID)).toEqual({
      areaId: SPRING_CAVE_AREA_ID,
      threats: ['crayfish'],
      elements: ['glow-plant'],
    });
  });

  it('names the crayfish, the carp and the punting pole as its threats, and gives their cards, then the tadpole and shrimp cards, with no card for the glow-plant (issue #77, ND-8)', () => {
    expect(threatIds(SPRING_CAVE_LAYOUT)).toEqual(['crayfish', 'carp', 'punting-pole']);
    expect(threatIds(zone)).toEqual(['crayfish', 'carp', 'punting-pole']);
    expect(threatFactCards(SPRING_CAVE_LAYOUT)).toEqual([CRAYFISH_FACT, CARP_FACT, PUNTING_POLE_FACT]);
    const expected = {
      ids: ['crayfish', 'carp', 'punting-pole', 'tadpole', 'shrimp'],
      cards: [CRAYFISH_FACT, CARP_FACT, PUNTING_POLE_FACT, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(SPRING_CAVE_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
  });

  it('is in the spring cave habitat, numbered 6, with the Fossil ammonite as its special treasure, no look of its own, no darters and a 30% stranding chance (issue #77, ND-13)', () => {
    expect(SPRING_CAVE_AREA.layout).toBe(SPRING_CAVE_LAYOUT);
    expect(SPRING_CAVE_AREA.number).toBe(6);
    expect(SPRING_CAVE_AREA.habitatId).toBe(SPRING_CAVE_HABITAT.id);
    expect(SPRING_CAVE_AREA.specialTreasureId).toBe('spring-cave/fossil-ammonite');
    expect(SPRING_CAVE_TREASURES.find((treasure) => treasure.id === SPRING_CAVE_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(SPRING_CAVE_AREA.look).toBeUndefined();
    expect(SPRING_CAVE_AREA.snackDart).toBeUndefined();
    expect(SPRING_CAVE_AREA.strandingChance).toBe(0.3);
    expect(areaStrandingChance(SPRING_CAVE_AREA)).toBe(0.3);
    expect(areaStrandingChance(CHINAMPA_2_AREA)).toBe(STRANDING_CHANCE);
    expect(Object.isFrozen(SPRING_CAVE_AREA)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_AREA.exit)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_AREA.snackDrift)).toBe(true);
  });

  it('plays Cenote Glow, the spring cave cue (M3; issue #77, ND-16)', () => {
    expect(tripCueFor(SPRING_CAVE_AREA)).toBe(CENOTE_GLOW);
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = springCave(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.elements).toEqual(zone.elements);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.darkWater).toEqual(zone.darkWater);
    }
  });
});

describe('Area 6 descent (issue #77, ND-2)', () => {
  const screenW = zone.width / zone.chunks;
  const screenH = zone.height / zone.rows;

  it('puts the Home Spot in the top-left screen, and the safe area in its column of the top row only', () => {
    expect([screenW, screenH]).toEqual([SCREEN_W, WORLD_H]);
    expect(Math.floor(zone.homeSpot.x / screenW)).toBe(0);
    expect(Math.floor(zone.homeSpot.y / screenH)).toBe(0);
    expect(zone.safeArea).toEqual({ x0: 40, x1: 300, y0: SURF, y1: WORLD_H });
    expect(zone.safeArea.x1).toBeLessThan(screenW);
    expect(zone.safeArea.y1).toBeLessThanOrEqual(screenH);
  });

  it('only goes across or down along the main path, never back up, from the Home Spot to the exit', () => {
    const path = zone.mainPath;
    expect(path[0]).toEqual(zone.start);
    expect(path[path.length - 1]).toEqual({ x: exit.x, y: exit.y });
    for (let i = 1; i < path.length; i++) expect(path[i].y, `main path point ${i}`).toBeGreaterThanOrEqual(path[i - 1].y);
    const rows = path.map((point) => Math.floor(point.y / screenH));
    expect([...new Set(rows)]).toEqual([0, 1, 2]);
    expect(rows.map((row) => areaRowKind(row, zone.rows))).toContain('middle');
  });

  it('ends at the exit in the dark part of the bottom row', () => {
    expect(areaRowKind(Math.floor(exit.y / screenH), zone.rows)).toBe('bottom');
    expect(inDarkWater(exit, dark)).toBe(true);
  });

  it('crosses each line between two rows once, going down through a clear opening', () => {
    for (const lineY of [WORLD_H, 2 * WORLD_H]) {
      const crossings = zone.mainPath.slice(1).flatMap((to, i) => {
        const from = zone.mainPath[i];
        return from.y < lineY && to.y >= lineY ? [from.x + ((to.x - from.x) * (lineY - from.y)) / (to.y - from.y)] : [];
      });
      expect(crossings, `line at y ${lineY}`).toHaveLength(1);
      const openings = rowOpenings(zone, lineY);
      expect(openings.some(([from, to]) => crossings[0] >= from && crossings[0] <= to), `line at y ${lineY}`).toBe(true);
    }
  });
});

describe('Area 6 exit (issue #77, ND-2)', () => {
  it('sits at the dark bottom right, in the water, out of the safe area', () => {
    expect(exit).toEqual({ x: 2290, y: 940, radius: 40 });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
  });

  it('keeps the exit out of every predator strike, clear of every pole sweep, the current and the grotto', () => {
    for (const { route, strike } of strikeRoutes(zone)) {
      expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    }
    for (const spawn of polesOf(zone)) {
      expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + PUNTING_POLE.touchReach);
    }
    for (const current of zone.currents) {
      expect(shapeDistance(exit, { kind: 'rect', x0: current.x0, x1: current.x1, y0: current.y0, y1: current.y1 })).toBeGreaterThan(exit.radius);
    }
    expect(shapeDistance(exit, { kind: 'rect', ...zone.cave })).toBeGreaterThan(exit.radius);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of springCave(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 6 danger bar (issue #77, ND-4)', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats and water as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = springCave(seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.safeArea).toEqual(zone.safeArea);
    expect([layout.width, layout.height, layout.bedTop]).toEqual([zone.width, zone.height, zone.bedTop]);
  });

  it('has 13 moving threats for its 15 screens, 2 predator types and 1 moving hazard type, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(15);
    expect(movingThreatCount(zone)).toBe(13);
    expect(movingThreatCount(zone)).toBeGreaterThanOrEqual(Math.ceil(0.75 * screens));
    expect(predatorTypeCount(zone)).toBe(2);
    expect(movingHazardTypeCount(zone)).toBe(1);
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never leaves a quiet swim in the whole water longer than one screen across, up-and-down swims included', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 2);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(SCREEN_W);
  });

  it('patrols every depth: each carp loop reaches 24 px into two bands, and the carp together reach all three', () => {
    const bands = depthBands(zone);
    expect(bands.map((band) => [band.top, band.bottom])).toEqual([
      [94, expect.closeTo(401.33, 2)],
      [expect.closeTo(401.33, 2), expect.closeTo(708.67, 2)],
      [expect.closeTo(708.67, 2), 1016],
    ]);
    expect(meetsDepthRule(zone)).toBe(true);
    const reached = (route: TilapiaRoute) =>
      bands.filter((band) => {
        const ys = route.waypoints.map((point) => point.y);
        return Math.min(Math.max(...ys), band.bottom) - Math.max(Math.min(...ys), band.top) >= 24;
      });
    for (const route of carpOf(zone)) expect(reached(route).length, route.id).toBeGreaterThanOrEqual(2);
    expect(new Set(carpOf(zone).flatMap((route) => reached(route))).size).toBe(3);
  });

  it('has surface danger and keeps the floor lane quiet for no more than one screen across, the crayfish counting as floor predators', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBe(FLOOR_QUIET_STRETCH);
    expect(floorQuietStretch(zone)).toBeLessThanOrEqual(SCREEN_W);
    expect(meetsFloorRule(zone)).toBe(true);
    expect(floorQuietStretch({ ...zone, predatorRoutes: carpOf(zone) })).toBeGreaterThan(SCREEN_W);
  });

  it('has 6 carp for its 15 screens, over the carp target of 5, the crayfish on top, and needs every one of them', () => {
    expect(carpTarget(15)).toBe(5);
    expect(carpCount(zone)).toBe(6);
    expect(carpCount(zone)).toBeGreaterThanOrEqual(carpTarget(15));
    expect(carpCount(zone)).toBeLessThanOrEqual(7);
    for (const id of CARP_IDS) {
      const without = { ...zone, predatorRoutes: zone.predatorRoutes.filter((route) => route.id !== id) };
      expect(meetsWholeWaterDangerBar(without), `without ${id}`).toBe(false);
    }
  });
});

describe('Area 6 crayfish (issue #77, ND-5)', () => {
  const stretches = crayfishOf(zone);

  it('are three floor stretches in the bottom row: crayfish-0 at x 500 to 800, crayfish-1 at 1300 to 1640 and crayfish-2 at 1880 to 2160', () => {
    expect(stretches.map((route) => [route.id, ...route.waypoints.map((point) => point.x)])).toEqual([
      ['crayfish-0', 500, 800],
      ['crayfish-1', 1300, 1640],
      ['crayfish-2', 1880, 2160],
    ]);
  });

  it('walk straight stretches of two waypoints on the floor lane, the bed top less 22, 240 to 400 px long, each its own', () => {
    expect(CRAYFISH_FLOOR_Y).toBe(zone.bedTop - 22);
    expect(CRAYFISH_FLOOR_Y).toBe(bounds.maxY);
    for (const route of stretches) {
      expect(route.waypoints, route.id).toHaveLength(2);
      const [start, end] = route.waypoints;
      expect([start.y, end.y], route.id).toEqual([CRAYFISH_FLOOR_Y, CRAYFISH_FLOOR_Y]);
      expect(Math.abs(end.x - start.x), route.id).toBeGreaterThanOrEqual(240);
      expect(Math.abs(end.x - start.x), route.id).toBeLessThanOrEqual(400);
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(areaRowKind(Math.floor(point.y / WORLD_H), zone.rows), route.id).toBe('bottom');
      }
    }
    for (let i = 0; i < stretches.length; i++) {
      for (let j = i + 1; j < stretches.length; j++) {
        const gap = Math.min(...loopSamples(stretches[i].waypoints).map((point) => routeLoopDistance(point, stretches[j].waypoints)));
        expect(gap, `${stretches[i].id} to ${stretches[j].id}`).toBeGreaterThan(2 * CRAYFISH_STRIKE);
      }
    }
  });

  it('puts two of the three in the dark and keeps the main path out of every crayfish reach', () => {
    expect(stretches.filter((route) => route.waypoints.every((point) => inDarkWater(point, dark))).map((route) => route.id)).toEqual(['crayfish-1', 'crayfish-2']);
    for (const point of pathSamples(zone.mainPath, 4)) {
      for (const route of stretches) expect(routeLoopDistance(point, route.waypoints), `${route.id} at ${point.x}, ${point.y}`).toBeGreaterThan(CRAYFISH_STRIKE);
    }
  });
});

describe('Area 6 punting poles (issue #77, ND-3, option A)', () => {
  const poles = polesOf(zone);

  it('has four poles in x order, at fixed places, depths and offsets, 2 s out of step with the next', () => {
    expect(poles.map((spawn) => spawn.id)).toEqual(POLE_IDS);
    expect(poles.map((spawn) => [spawn.x, movingHazardDepth(spawn), spawn.offset])).toEqual([
      [400, 200, 0],
      [1150, 200, 2],
      [1450, 72, 0],
      [1900, 200, 2],
    ]);
    for (let i = 1; i < poles.length; i++) expect(poles[i].x, poles[i].id).toBeGreaterThan(poles[i - 1].x);
  });

  it('jabs each pole into the top row only, its touch zone clear of the safe area and the exit', () => {
    for (const spawn of poles) {
      const touch = poleZone(spawn);
      expect(touch.y1, spawn.id).toBeLessThanOrEqual(WORLD_H);
      expect(touch.x0, spawn.id).toBeGreaterThan(zone.safeArea.x1);
      expect(shapeDistance(exit, touch), spawn.id).toBeGreaterThan(exit.radius);
    }
  });

  it('keeps every pole sweep farther than the strike from every patrol loop: 90 px for the crayfish, 130 px for the carp (the strike-only pole rule)', () => {
    expect([CRAYFISH_STRIKE, CARP_STRIKE]).toEqual([90, 130]);
    for (const spawn of poles) {
      const sweep = movingHazardSweep(spawn);
      for (const { route, strike } of strikeRoutes(zone)) {
        expect(shapeRouteDistance(sweep, route.waypoints), `${spawn.id} to ${route.id}`).toBeGreaterThan(strike);
      }
    }
  });

  it('never overlaps two pole touch zones', () => {
    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        expect(rectDistance(poleZone(poles[i]), poleZone(poles[j])), `${poles[i].id} to ${poles[j].id}`).toBeGreaterThan(0);
      }
    }
  });

  it('jabs the first two poles across the main path in the top row, stops the short third one just over it, out of its touch reach, and keeps the fourth past the way down', () => {
    const samples = pathSamples(zone.mainPath, 2).filter((point) => point.y < WORLD_H);
    const crossing = poles.filter((spawn) => samples.some((point) => shapeDistance(point, movingHazardSweep(spawn)) === 0));
    expect(crossing.map((spawn) => spawn.id)).toEqual(POLE_IDS.slice(0, 2));
    const [, , short, last] = poles;
    expect(samples.some((point) => point.x === short.x)).toBe(true);
    for (const point of samples) expect(shapeDistance(point, movingHazardSweep(short)), `path at ${point.x}, ${point.y}`).toBeGreaterThan(short.type.touchReach);
    expect(last.x).toBeGreaterThan(Math.max(...zone.mainPath.filter((point) => point.y < WORLD_H).map((point) => point.x)));
  });
});

describe('Area 6 hiding spots (B5, B6, B10; issue #77, ND-11)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, S = 90 for the crayfish, S = 130 for the carp and the touch reach for the poles, with the turn clearance, for seed %i', (seed) => {
    const layout = springCave(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('spring-cave-1/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, layout.predatorRoutes), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it('bands every spot by its riskiest threat: Common over S + 60 from all, Rare over S, Epic over S / 2, Legendary within S / 2 of one', () => {
    for (const spot of zone.spots) {
      const bands = strikeRoutes(zone).map(({ route, strike }) => ({ distance: routeLoopDistance(spot, route.waypoints), band: riskBands(strike)[spot.rarity] }));
      for (const { distance, band } of bands) expect(distance, spot.id).toBeGreaterThan(band.over);
      expect(bands.some(({ distance, band }) => distance <= band.upTo), spot.id).toBe(true);
    }
  });

  it('has 6 Common, 6 Rare, 5 Epic and 5 Legendary spots, each pool larger than its Area 6 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([6, 6, 5, 5]);
    expect(RARITIES.map((rarity) => SPRING_CAVE_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 2]);
    for (const rarity of RARITIES) {
      const treasures = SPRING_CAVE_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides the Common spots under the rock ledges along the main path in the top row, lit', () => {
    const commons = zone.spots.filter((spot) => spot.rarity === 'common');
    for (const spot of commons) {
      expect(spot.cover, spot.id).toBe('bank');
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(spot.y, spot.id).toBeLessThan(WORLD_H);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
      expect(inDarkWater(spot, dark), spot.id).toBe(false);
    }
  });

  it('hides the Rare spots on the rock ledge in the dark, a dead end off the main path, so the special treasure is always in the dark', () => {
    const rares = zone.spots.filter((spot) => spot.rarity === 'rare');
    expect(rares).toHaveLength(6);
    for (const spot of rares) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(inDarkWater(spot, dark), spot.id).toBe(true);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
    const special = zone.finds.find((find) => find.id === SPRING_CAVE_AREA.specialTreasureId);
    expect(special?.pool).toEqual(rares.map((spot) => spot.id));
  });

  it('puts every Epic and Legendary spot deep in the dark, in the grotto or just past the spring outflow, Legendary ones in Dash pots', () => {
    const deep = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(deep.map((spot) => spot.cover)).toEqual([...Array(6).fill('cave'), ...Array(4).fill('pastCurrent')]);
    for (const spot of deep) {
      expect(coversAt(spot, zone), spot.id).toEqual([spot.cover]);
      expect(spot.container, spot.id).toBe(spot.rarity === 'legendary');
      expect(inDarkWater(spot, dark), spot.id).toBe(true);
    }
  });

  it('sets the grotto on the bed in the dark, a dead end off the main path, holding only the cave spots (B6)', () => {
    expect(zone.cave).toEqual({ id: 'spring-cave-1/cave', x0: 1920, x1: 2140, y0: 935, y1: 1038 });
    expect(zone.cave.y1).toBe(zone.bedTop);
    expect(inDarkWater({ x: zone.cave.x0, y: zone.cave.y0 }, dark)).toBe(true);
    for (const spot of zone.spots.filter((candidate) => candidate.cover === 'cave')) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = springCave(seed);
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

  it('has three rock ledges: two in the top row over the main path and one in the dark below it', () => {
    expect(zone.bankChunks).toEqual([]);
    expect(zone.bankOverhangs).toEqual([
      { x0: 860, x1: 1100, y0: 110, y1: 170 },
      { x0: 1610, x1: 1730, y0: 110, y1: 170 },
      { x0: 1330, x1: 1660, y0: 895, y1: 945 },
    ]);
  });
});

describe('Area 6 placing treasure (B4; issue #77, ND-12)', () => {
  const tuning = tripTreasureTuning(SPRING_CAVE_AREA_ID);
  const options = { extras: [SPRING_CAVE_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 11 slots, a slot left empty only once every Common and Rare is placed, the lost treasures and the Fossil ammonite', () => {
    const all = SPRING_CAVE_TREASURES.map((treasure) => treasure.id);
    const commonAndRare = SPRING_CAVE_TREASURES.filter((treasure) => treasure.rarity === 'common' || treasure.rarity === 'rare').map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      const freshIds = fresh.map((find) => find.id);
      const everySlotFilled = fresh.length === tuning.slots + 1;
      expect(everySlotFilled || commonAndRare.every((id) => freshIds.includes(id)), `trip seed ${tripSeed}`).toBe(true);
      expect(freshIds).toContain(SPRING_CAVE_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('leaves at most 4 of the 11 slots empty on a fresh trip, 2.4 on average over 200 fresh trips, as 12 treasures fill 11 slots', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.min(...empty)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 6 carp, spring outflow and stranding places', () => {
  it('keeps every carp loop in the water, its body out of the safe area', () => {
    for (const route of carpOf(zone)) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(point.x - SPRING_CAVE_CARP.tuning.bodyRadius > zone.safeArea.x1 || point.y - SPRING_CAVE_CARP.tuning.bodyRadius > zone.safeArea.y1, route.id).toBe(true);
      }
    }
  });

  it('flows gently and steadily to the left at 73 px/s in the dark, against the main path where the path crosses it', () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -73, y: 0 });
    expect(inDarkWater({ x: current.x0, y: current.y0 }, dark)).toBe(true);
    expect(inDarkWater({ x: current.x1, y: current.y1 }, dark)).toBe(true);
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(17);
    const crossings = zone.mainPath.slice(1).flatMap((to, i) => {
      const from = zone.mainPath[i];
      const across = from.y === to.y && from.y >= current.y0 && from.y <= current.y1;
      return across && Math.min(from.x, to.x) <= current.x0 && Math.max(from.x, to.x) >= current.x1 ? [Math.sign(to.x - from.x)] : [];
    });
    expect(crossings).toEqual([1]);
    expect(Math.sign(current.force.x)).toBe(-crossings[0]);
  });

  it('puts the spots past the spring outflow on its upstream side, the far side along the main path', () => {
    const current = zone.currents[0];
    expect(pastCurrentBand(current)).toEqual({ edgeX: current.x1, farX: current.x1 + 140 });
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past).toHaveLength(4);
    for (const spot of past) {
      expect(spot.x, spot.id).toBeGreaterThan(current.x1);
      expect(spot.x, spot.id).toBeLessThanOrEqual(current.x1 + 140);
      expect(spot.y, spot.id).toBeGreaterThanOrEqual(current.y0);
      expect(spot.y, spot.id).toBeLessThanOrEqual(current.y1);
    }
  });

  it.each(ALL_SEEDS)('keeps every stranding place out of the dark, 80 px from every route, clear of poles, spots, the current and the grotto for seed %i (ND-7)', (seed) => {
    const layout = springCave(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `spring-cave-1/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(inDarkWater(place, dark), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(shapeDistance(place, { kind: 'rect', ...layout.cave }), place.id).toBeGreaterThan(0);
      expect(routeDistance(place, layout.predatorRoutes), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spawn of polesOf(layout)) {
        expect(shapeDistance(place, movingHazardSweep(spawn)), `${place.id} to ${spawn.id}`).toBeGreaterThanOrEqual(STRAND_POLE_CLEARANCE);
      }
      for (const spot of layout.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 6 gaps and routes (the level layout ladder; issue #77, ND-11)', () => {
  it('swims the main path through a gap tighter than Area 5 narrowest, between the short pole and carp-1, and never under the safe passing width', () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe('spring-cave-1/punting-pole-3 and carp-1');
    expect(narrowest.width).toBeCloseTo(40, 9);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    expect(narrowest.width).toBeLessThan(AREA_5_NARROWEST);
  });

  it('leaves at least two ways down between each two rows, each clear opening at least the safe passing width', () => {
    for (const lineY of [WORLD_H, 2 * WORLD_H]) {
      const openings = rowOpenings(zone, lineY);
      expect(openings, `line at y ${lineY}`).toEqual(ROW_OPENINGS[lineY]);
      expect(openings.length, `line at y ${lineY}`).toBeGreaterThanOrEqual(2);
      for (const [from, to] of openings) expect(to - from, `line at y ${lineY} from ${from}`).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    }
  });

  it('has two dead ends holding treasure in the dark: the grotto and the Rare ledge, both off the main path', () => {
    const grotto = zone.spots.filter((spot) => spot.cover === 'cave');
    const ledge = zone.spots.filter((spot) => spot.rarity === 'rare');
    expect([grotto.length, ledge.length]).toEqual([6, 6]);
    for (const spot of [...grotto, ...ledge]) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
      expect(inDarkWater(spot, dark), spot.id).toBe(true);
    }
  });
});

describe('Area 6 dark water and glow-plants (issue #77, ND-7 to ND-9)', () => {
  const plants = glowPlants(zone.elements);
  const unlit = darkLights({ axolotl: zone.start, exit, elements: zone.elements, lit: [] });

  it('is the right half of the bottom row, from x 1200 and y 720 down to the bed', () => {
    expect(zone.darkWater).toEqual({ x0: 1200, x1: 2400, y0: 720, y1: 1038 });
    expect(dark.x1 - dark.x0).toBe(zone.width / 2);
    expect(dark.y0).toBe(2 * WORLD_H);
    expect(dark.y1).toBe(zone.bedTop);
  });

  it('has six glow-plants in the dark, each its own, each reachable from the swim bounds and shown with no plant lit', () => {
    expect(plants.map((plant) => plant.id)).toEqual(PLANT_IDS);
    for (const plant of plants) {
      expect(plant.glowPlant.radius, plant.id).toBe(GLOW_PLANT_RADIUS);
      expect(inDarkWater(plant.glowPlant, dark), plant.id).toBe(true);
      expect(glowPlantReachable(plant.glowPlant, bounds), plant.id).toBe(true);
      expect(shownInDark('glow-plant', plant.glowPlant, dark, []), plant.id).toBe(true);
    }
  });

  it('shows the exit and its whole circle with no plant lit, the axolotl far away at the Home Spot', () => {
    expect(shownInDark('exit', exit, dark, [])).toBe(true);
    for (let k = 0; k < 16; k += 1) {
      const angle = (k / 16) * Math.PI * 2;
      const edge = { x: exit.x + exit.radius * Math.cos(angle), y: exit.y + exit.radius * Math.sin(angle) };
      expect(litByAny(edge, unlit), `exit edge at ${k}`).toBe(true);
    }
  });

  it('puts nothing the darkness may never hide under it with no light: the Home Spot, every stranding place, predator stretch and pole are lit water or shown', () => {
    expect(inDarkWater(zone.homeSpot, dark)).toBe(false);
    for (const place of zone.strandingPlaces) expect(inDarkWater(place, dark), place.id).toBe(false);
    for (const route of zone.predatorRoutes) {
      for (const point of route.waypoints) expect(shownInDark('predator', point, dark, []), route.id).toBe(true);
    }
    for (const spawn of polesOf(zone)) expect(shownInDark('moving-hazard', { x: spawn.x, y: SURF }, dark, []), spawn.id).toBe(true);
    for (const pos of darkGrid(60)) {
      for (const part of DARK_SHOWN_PARTS) expect(shownInDark(part, pos, dark, []), `${part} at ${pos.x}, ${pos.y}`).toBe(true);
    }
  });

  it("swims tadpoles in the dark, and shows every snack, a tadpole or a shrimp included, in the axolotl's own glow at least one step before it is in reach", () => {
    const wanders = zone.mobileSnacks?.wanders ?? [];
    expect(wanders.filter((wander) => inDarkWater(homeCentreOf(wander.points), dark)).length).toBe(2);
    const eatReach = SNACK_REACH.headAhead + SNACK_REACH.radius;
    const magnetReach = SNACK_REACH.headAhead + PERK_CAPS.snackMagnet;
    const fastestSwim = Math.max(SWIM.dashSpeed, SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100));
    const fastestSnack = Math.max(zone.mobileSnacks?.tadpole?.speed ?? 0, zone.mobileSnacks?.shrimp?.flickSpeed ?? 0);
    const closingStep = (fastestSwim + fastestSnack) * SWIM.dtMax;
    expect(glowShowsBeforeReach(eatReach, closingStep)).toBe(true);
    expect(glowShowsBeforeReach(magnetReach, closingStep)).toBe(true);
    for (const body of darkGrid(120)) {
      const lights = darkLights({ axolotl: body, exit, elements: zone.elements, lit: [] });
      expect(shownInDark('snack', { x: body.x + magnetReach, y: body.y }, dark, lights), `snack by ${body.x}, ${body.y}`).toBe(true);
    }
  });

  it('keeps the hint on an unlit plant while one is left, in any lighting order', () => {
    const orders = [PLANT_IDS, [...PLANT_IDS].reverse(), [PLANT_IDS[3], PLANT_IDS[0], PLANT_IDS[5], PLANT_IDS[2], PLANT_IDS[1], PLANT_IDS[4]]];
    for (const order of orders) {
      const lit: string[] = [];
      for (const id of order) {
        for (const body of darkGrid(200)) {
          const hinted = darkHintPlant(GLOW_PLANTS.hintAfter, body, zone.elements, lit);
          expect(hinted).not.toBeNull();
          expect(lit).not.toContain(hinted);
          expect(PLANT_IDS).toContain(hinted);
        }
        lit.push(id);
      }
      expect(darkHintPlant(GLOW_PLANTS.hintAfter, { x: 1800, y: 900 }, zone.elements, lit)).toBeNull();
    }
  });
});

describe('Area 6 snacks', () => {
  const drift = SPRING_CAVE_AREA.snackDrift;
  const surfacePeak = SURF + 1.6 + 0.8;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every pole sweep for seed %i', (seed) => {
    const layout = springCave(seed);
    expect(layout.collectibles).toHaveLength(36);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of polesOf(layout)) {
        expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the spring outflow, and only worms and bugs in it, for seed %i (ADR 0022)', (seed) => {
    const layout = springCave(seed);
    expect(SPRING_CAVE_LAYOUT.snacksInCurrent).toBe(4);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(SPRING_CAVE_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = springCave(seed);
    const items = createCollectibles(layout.collectibles);
    for (let t = 0; t <= 120; t += 0.25) {
      for (let index = 0; index < items.length; index++) {
        const snack = { x: snackX(items[index], index, t, drift, bounds), y: snackY(items[index], index, t, drift, bounds) };
        expect(inBounds(snack, layout)).toBe(true);
        expect(snack.y).toBeGreaterThan(surfacePeak);
        expect(inHomeSpot(snack, layout.homeSpot)).toBe(false);
      }
    }
  });

  it('drift a little faster than Area 5, slower than a one-leg axolotl swims against the spring outflow, and at most half the magnet pull (issue #77, ND-10)', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.hypot(zone.currents[0].force.x, zone.currents[0].force.y);
    expect(oneLegNet).toBe(17);
    expect(drift).toEqual({ ...CHINAMPA_2_AREA.snackDrift, periodX: 7.4, periodY: 5.92 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(CHINAMPA_2_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it.each(ALL_SEEDS)('has no one-time darters: no dart rule, and its shrimp replace them, for seed %i', (seed) => {
    expect(SPRING_CAVE_AREA.snackDart).toBeUndefined();
    expect(oneTimeDarts(SPRING_CAVE_AREA, springCave(seed))).toBeNull();
  });

  it.each(ALL_SEEDS)('gives every shrimp a clear place and a clear flick target in at least one of 8 directions for seed %i', (seed) => {
    const layout = springCave(seed);
    const avoid = mobileSnackAvoid(layout);
    const rule = layout.mobileSnacks?.shrimp;
    expect(rule?.flickDistance).toBe(60);
    const spots = (layout.mobileSnacks?.homes ?? []).map((home) => home.points[0]);
    expect(spots).toHaveLength(11);
    for (const spot of spots) {
      expect(mobileSnackClear(shrimpBox(spot, drift), avoid), `shrimp at ${spot.x}, ${spot.y}`).toBe(true);
      const targets = Array.from({ length: FLICK_DIRECTIONS }, (_, i) => {
        const angle = (i * 2 * Math.PI) / FLICK_DIRECTIONS;
        return { x: spot.x + (rule?.flickDistance ?? 0) * Math.cos(angle), y: spot.y + (rule?.flickDistance ?? 0) * Math.sin(angle) };
      });
      expect(targets.some((target) => mobileSnackClear(shrimpBox(target, drift), avoid)), `shrimp at ${spot.x}, ${spot.y}`).toBe(true);
    }
  });
});

describe('Area 6 mobile snacks (issue #77, ND-10)', () => {
  const mix = zone.mobileSnacks;
  const drift = SPRING_CAVE_AREA.snackDrift;

  it("meets Area 6's row of the snack ramp: 24 of its 36 snacks mobile, a share above Area 5's 19 of 32 and at most 0.7, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(6, SPRING_CAVE_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(24);
    const share = mobile / zone.collectibles.length;
    expect(share).toBeGreaterThan(19 / 32);
    expect(share).toBeLessThanOrEqual(0.7);
    expect(mix?.tadpole?.speed).toBeGreaterThanOrEqual(CHINAMPA_2_LAYOUT.mobileSnacks?.tadpole?.speed ?? Infinity);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(SPRING_CAVE_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('swims thirteen tadpoles on wander loops of 4 or 5 points, legs 108 to 360 px, laps of 11.1 to 12.3 s, each a thirteenth of its own lap further on than the last', () => {
    const wanders = mix?.wanders ?? [];
    const speed = mix?.tadpole?.speed ?? 0;
    expect(wanders).toHaveLength(13);
    const laps: number[] = [];
    for (const [index, wander] of wanders.entries()) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      expect(wander.points.length, label).toBeGreaterThanOrEqual(TADPOLES.minLoopPoints);
      expect(wander.points.length, label).toBeLessThanOrEqual(5);
      const legs = loopLegLengths(wander.points);
      for (const leg of legs) {
        expect(leg, label).toBeGreaterThanOrEqual(TADPOLES.minLegSeconds * speed);
        expect(leg, label).toBeLessThanOrEqual(TADPOLES.maxLegSeconds * speed);
      }
      const lapSeconds = legs.reduce((sum, leg) => sum + leg, 0) / speed;
      expect(lapSeconds, label).toBeLessThanOrEqual(TADPOLES.maxLapSeconds);
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 13, 9);
      laps.push(lapSeconds);
    }
    expect(Math.min(...laps)).toBeCloseTo(11.1, 1);
    expect(Math.max(...laps)).toBeCloseTo(12.3, 1);
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall, wholly in one screen row, five in the top row and four in each other, no two centres closer than 240 px', () => {
    const wanders = mix?.wanders ?? [];
    for (const wander of wanders) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      const box = homeBoxOf(wander.points);
      expect(box.x1 - box.x0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
      expect(homeRowOf(wander.points), label).not.toBe(-1);
    }
    const rows = wanders.map((wander) => homeRowOf(wander.points));
    expect([0, 1, 2].map((row) => rows.filter((each) => each === row).length)).toEqual([5, 4, 4]);
    const centres = wanders.map((wander) => homeCentreOf(wander.points));
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        expect(Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y), `loops ${i} and ${j}`).toBeGreaterThanOrEqual(240);
      }
    }
  });

  it('lets a one-leg axolotl catch every tadpole within 20 s (the one-leg catch proof)', () => {
    const rule = mix?.tadpole;
    expect(rule).toBeDefined();
    const wanders = mix?.wanders ?? [];
    expect(wanders).toHaveLength(13);
    for (const wander of wanders) {
      expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
  });

  it("gives its eleven shrimp Area 6's shrimp rule: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s, on homes of exactly 3 hop spots in a box at most 200 x 160 px, four in the top row, four in the middle row and three in the bottom row", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    expect(mix?.shrimp?.flickSpeed).toBeGreaterThan(CHINAMPA_2_LAYOUT.mobileSnacks?.shrimp?.flickSpeed ?? Infinity);
    const homes = mix?.homes ?? [];
    expect(homes).toHaveLength(11);
    for (const home of homes) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      expect(home.points, label).toHaveLength(3);
      const box = homeBoxOf(home.points);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
    const rows = homes.map((home) => homeRowOf(home.points));
    expect([0, 1, 2].map((row) => rows.filter((each) => each === row).length)).toEqual([4, 4, 3]);
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = springCave(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) {
      expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
    for (const home of layout.mobileSnacks?.homes ?? []) {
      expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
    }
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(1.2 * 72, 9);
  });
});

describe('Area 6 difficulty', () => {
  it('is bigger than Area 5: more screens, more snacks, faster drift, more slots and a stronger carp', () => {
    expect(zone.width * zone.height).toBeGreaterThan(area5.width * area5.height);
    expect(zone.collectibles.length).toBeGreaterThan(area5.collectibles.length);
    expect(snackDriftMaxSpeed(SPRING_CAVE_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(CHINAMPA_2_AREA.snackDrift));
    expect(tripTreasureTuning(SPRING_CAVE_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(CHINAMPA_2_AREA.id).slots);
    expect(SPRING_CAVE_CARP.tuning.lungeRange).toBeGreaterThan(CHINAMPA_2_CARP.tuning.lungeRange);
  });
});

describe('beating Area 6 (issue #77, ND-9)', () => {
  it('lets a one-leg axolotl swim the main path down the descent, through the spring outflow, to the exit with no plant lit, then home', () => {
    const toExit = oneLegSeconds(zone.start, zone.mainPath.slice(1), zone, (pos) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius);
    expect(toExit).toBeCloseTo(ONE_LEG_EXIT_SECONDS, 1);
    expect(toExit).toBeLessThan(BEAT_MAX_SECONDS);
    const home = oneLegSeconds(exit, [zone.start], zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });
});
