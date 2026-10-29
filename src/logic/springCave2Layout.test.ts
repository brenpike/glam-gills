import { describe, expect, it } from 'vitest';
import { SPRING_CAVE_2_AREA, SPRING_CAVE_AREA, SPRING_CAVE_HABITAT, newThingsByArea, sourceFactCards, threatFactCards, threatIds } from './areas';
import { RARITIES, SPRING_CAVE_2_TREASURES } from './catalogue';
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
import { CARP_FACT, CRAYFISH_FACT, GEYSER_FACT, SHRIMP_FACT, STALACTITE_FACT, TADPOLE_FACT, UNDERWATER_SPRINGS_FACT } from './factCards';
import { GLOW_PLANTS, darkHintPlant, darkLights, glowPlantReachable, glowPlants, inDarkWater, litByAny, shownInDark } from './glowPlants';
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
import {
  GEYSER_VENT,
  STALACTITE_DRIP,
  movingHazardBaseY,
  movingHazardDepth,
  movingHazardDirection,
  movingHazardSweep,
  type MovingHazardSpawn,
} from './movingHazards';
import {
  PEBBLE,
  PEBBLES,
  blockAtRock,
  bodyInAnyRock,
  bodyTouchesPebble,
  createPebbles,
  grooveLength,
  pebbleCentre,
  pebbles,
  stepPebbles,
  type PebbleState,
} from './pebble';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { CARP_SPECIES, CRAYFISH_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import {
  PULSING_CURRENT,
  PULSING_CURRENTS,
  addPulseCurrent,
  bandLength,
  flowStep,
  inPulseBand,
  oneLegCrossSeconds,
  pulseLandingStrip,
  pulsePeriod,
  pulsePhase,
  pulsingCurrents,
  type PulsingCurrentSpawn,
} from './pulsingCurrents';
import { RESCUE, areaStrandingChance } from './rescue';
import {
  SPRING_CAVE_2_AREA_ID,
  SPRING_CAVE_2_CARP,
  SPRING_CAVE_2_CRAYFISH,
  SPRING_CAVE_2_FLOOR_Y,
  SPRING_CAVE_2_GLOW_PLANT_RADIUS,
  SPRING_CAVE_2_LAYOUT,
} from './springCave2Layout';
import { SPRING_CAVE_CARP, SPRING_CAVE_CRAYFISH, SPRING_CAVE_LAYOUT } from './springCaveLayout';
import { stepSwim, type SwimState } from './swimPhysics';
import { CARP, CARP_CHASE, CRAYFISH, CRAYFISH_CHASE, FINDS, LEGS, RISK, SHRIMP, SNACK_REACH, SWIM, TADPOLES, tripTreasureTuning } from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
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
const CARP_STRIKE = SPRING_CAVE_2_CARP.tuning.lungeRange;
const CRAYFISH_STRIKE = SPRING_CAVE_2_CRAYFISH.tuning.lungeRange;
const STRANDING_ROUTE_CLEARANCE = 80;
/** Least px from a stranding place to every stalactite and geyser sweep: the touch reach plus the rescue reach. */
const STRAND_HAZARD_CLEARANCE = STALACTITE_DRIP.touchReach + RESCUE.reachRadius;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** Directions a shrimp's flick target is tried in. */
const FLICK_DIRECTIONS = 8;
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends (ND-4). */
const LONGEST_QUIET_SWIM = { length: 479.2, from: { x: 2920, y: 142 }, to: { x: 3376, y: 102 } };
/** Longest quiet stretch of the floor lane in px, as measured (ND-4). */
const FLOOR_QUIET_STRETCH = 204;
/** One-leg seconds along the main path to the exit, timing every vent, as measured (ND-5). */
const ONE_LEG_EXIT_SECONDS = 52.12;
/** Area 6's narrowest main-path gap, which Area 7's must be under (the level layout ladder). */
const AREA_6_NARROWEST = 40;
/** Empty treasure slots over the 200 fresh trips, as measured: 12 slots for 12 treasures (ND-12). */
const EMPTY_SLOTS = { most: 5, mean: 3.18 };
const CRAYFISH_IDS = [0, 1, 2].map((n) => `crayfish-${n}`);
const CARP_IDS = [0, 1, 2, 3, 4, 5].map((n) => `carp-${n}`);
const STALACTITE_IDS = [1, 2, 3, 4, 5, 6].map((n) => `spring-cave-2/stalactite-${n}`);
const GEYSER_IDS = [1, 2].map((n) => `spring-cave-2/geyser-${n}`);
const MOVING_HAZARD_IDS = [...STALACTITE_IDS, ...GEYSER_IDS];
/** The deepest stream a stalactite may drip: its art's longest stream (src/art/movingHazardArt.test.ts). */
const MAX_STREAM = 250;
/** Each stalactite's stream depth before the danger retune: no stream drips less. */
const OLD_STREAM_DEPTHS = [170, 170, 170, 170, 170, 216];
/** y of the main path along the bottom row, between the safe area and the climb, which `geyser-1` bursts across. */
const BOTTOM_PATH_Y = 560;
const VENT_IDS = [1, 2, 3].map((n) => `spring-cave-2/vent-${n}`);
const PLANT_IDS = [1, 2, 3].map((n) => `spring-cave-2/glow-plant-${n}`);
const PEBBLE_ID = 'spring-cave-2/pebble';

const zone = buildZone(SPRING_CAVE_2_LAYOUT, DEFAULT_ZONE_SEED);
const area6 = buildZone(SPRING_CAVE_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const dark = SPRING_CAVE_2_LAYOUT.darkWater ?? { x0: 0, x1: 0, y0: 0, y1: 0 };
const { exit } = SPRING_CAVE_2_AREA;
const vents = pulsingCurrents(zone.hazards);
const walls = zone.rockWalls ?? [];
const room = (zone.sideRooms ?? [])[0];

function springCave2(seed: number): ZoneLayout {
  return buildZone(SPRING_CAVE_2_LAYOUT, seed);
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

/** A rock wall or side room as a rect shape. */
function rectOf(rock: { x0: number; x1: number; y0: number; y1: number }): HazardRect {
  return { kind: 'rect', x0: rock.x0, x1: rock.x1, y0: rock.y0, y1: rock.y1 };
}

/** The zone's crayfish routes: its predator routes whose species is the crayfish. */
function crayfishOf(layout: Pick<ZoneLayout, 'predatorRoutes'>): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === CRAYFISH_SPECIES.id);
}

/** The zone's carp routes: its predator routes whose species is the common carp. */
function carpOf(layout: Pick<ZoneLayout, 'predatorRoutes'>): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
}

/** Each predator route with its strike: 90 px for a crayfish, 135 px for a carp. */
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

/** Seconds until `vent` next surges from element time `t`; 0 while it surges. */
function secondsToSurge(vent: Readonly<PulsingCurrentSpawn>, t: number): number {
  const phase = pulsePhase(vent.pulse, t);
  if (phase.phase === 'surge') return 0;
  if (phase.phase === 'calm') return (1 - phase.progress) * vent.pulse.calmFor + PULSING_CURRENTS.warnFor;
  return (1 - phase.progress) * PULSING_CURRENTS.warnFor;
}

/** The body centre grown by the body reach meets the band. */
function nearBand(pos: Point, vent: Readonly<PulsingCurrentSpawn>): boolean {
  return shapeDistance(pos, vent.shape) <= PULSING_CURRENTS.bodyReach;
}

/**
 * One frame of a one-leg swim steered at `target`, with the area's steady currents, its surges at
 * element time `t`, its rock and pebble. It waits just outside a vent's band until the band's next
 * surge is far enough off to cross it, the way a player waits for the calm.
 */
function swimToward(state: SwimState, target: Point, layout: ZoneLayout, t: number, pebbleStates: readonly PebbleState[]): { state: SwimState; pebbles: readonly PebbleState[] } {
  const pos = { x: state.x, y: state.y };
  const steer = normalize({ x: target.x - pos.x, y: target.y - pos.y });
  const ahead = { x: pos.x + steer.x * 4, y: pos.y + steer.y * 4 };
  const waiting = pulsingCurrents(layout.hazards).some((vent) => {
    if (nearBand(pos, vent) || !nearBand(ahead, vent)) return false;
    return secondsToSurge(vent, t) < oneLegCrossSeconds(bandLength(vent.shape, vent.pulse.flow)) + 0.2;
  });
  const current = addPulseCurrent(currentAt(pos, layout.currents), pos, layout.hazards, t);
  const env = { current, dragMul: reedDragAt(pos, layout.reedPatches), bounds: swimBounds(layout), dashing: false };
  const swum = stepSwim(state, waiting ? { x: 0, y: 0 } : steer, env, FRAME, legSwimTuning(1));
  const rolled = stepPebbles(pebbleStates, layout.elements, pos, swum, FRAME);
  const blocked = blockAtRock(pos, rolled.pos, layout.rockWalls ?? []);
  return { state: { ...swum, x: blocked.x, y: blocked.y }, pebbles: rolled.pebbles };
}

/** Seconds a one-leg axolotl takes swimming through `targets` in order until `arrive`; Infinity when over the limit. */
function oneLegSeconds(from: Point, targets: readonly Point[], layout: ZoneLayout, arrive: (pos: Point) => boolean): number {
  let state: SwimState = { x: from.x, y: from.y, vx: 0, vy: 0, facing: 1 };
  let pebbleStates: readonly PebbleState[] = createPebbles(layout.elements);
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
    const stepped = swimToward(state, target, layout, frame * FRAME, pebbleStates);
    state = stepped.state;
    pebbleStates = stepped.pebbles;
  }
  return Infinity;
}

/** The zone's moving hazards, the stalactites then the geysers, in data order. */
function movingHazardsOf(layout: { readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[] }): readonly Readonly<MovingHazardSpawn>[] {
  return layout.movingHazards ?? [];
}

/** Where a stalactite or geyser can touch the body centre: its sweep grown by the touch reach on every side. */
function touchZone(spawn: Readonly<MovingHazardSpawn>): HazardRect {
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
    const clear = !blockedAt({ x, y }, layout) && !bodyInAnyRock({ x, y }, layout.rockWalls ?? []);
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

/** Whether a point is inside the side room behind the pebble, edges included. */
function inRoom(point: Point): boolean {
  return point.x >= room.x0 && point.x <= room.x1 && point.y >= room.y0 && point.y <= room.y1;
}

describe('SPRING_CAVE_2_LAYOUT', () => {
  it('is Area 7 data: 8 screens across, 2 down, starting at the Home Spot', () => {
    expect(SPRING_CAVE_2_AREA_ID).toBe('spring-cave-2');
    expect(SPRING_CAVE_2_LAYOUT.id).toBe(SPRING_CAVE_2_AREA_ID);
    expect(zone.width).toBe(3840);
    expect(zone.height).toBe(720);
    expect(zone.bedTop).toBe(678);
    expect(zone.chunks).toBe(8);
    expect(zone.rows).toBe(2);
    expect(zone.start).toEqual({ x: 120, y: 560 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 560, radius: 72 });
    expect(zone.cave.id).toBe('spring-cave-2/cave');
  });

  it('is frozen data, down to each route, stalactite, geyser, vent, glow-plant, the pebble, the rock and each mobile snack', () => {
    expect(Object.isFrozen(SPRING_CAVE_2_LAYOUT)).toBe(true);
    for (const species of [SPRING_CAVE_2_CARP, SPRING_CAVE_2_CRAYFISH]) {
      expect(Object.isFrozen(species)).toBe(true);
      expect(Object.isFrozen(species.tuning)).toBe(true);
    }
    for (const part of [
      SPRING_CAVE_2_LAYOUT.elements,
      SPRING_CAVE_2_LAYOUT.hazards,
      SPRING_CAVE_2_LAYOUT.predatorRoutes,
      SPRING_CAVE_2_LAYOUT.bankOverhangs,
      SPRING_CAVE_2_LAYOUT.bankSpots,
      SPRING_CAVE_2_LAYOUT.mainPath,
      SPRING_CAVE_2_LAYOUT.strandingPlaces,
      SPRING_CAVE_2_LAYOUT.movingHazards,
      SPRING_CAVE_2_LAYOUT.darkWater,
      SPRING_CAVE_2_LAYOUT.rockWalls,
      SPRING_CAVE_2_LAYOUT.sideRooms,
      SPRING_CAVE_2_LAYOUT.mobileSnacks,
      SPRING_CAVE_2_LAYOUT.mobileSnacks?.wanders,
      SPRING_CAVE_2_LAYOUT.mobileSnacks?.homes,
      SPRING_CAVE_2_LAYOUT.mobileSnacks?.tadpole,
      SPRING_CAVE_2_LAYOUT.mobileSnacks?.shrimp,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const spawn of movingHazardsOf(SPRING_CAVE_2_LAYOUT)) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const hazard of SPRING_CAVE_2_LAYOUT.hazards) {
      expect(Object.isFrozen(hazard), hazard.id).toBe(true);
      expect(Object.isFrozen(hazard.shape), hazard.id).toBe(true);
      expect(Object.isFrozen(hazard.pulse), hazard.id).toBe(true);
    }
    for (const rock of [...(SPRING_CAVE_2_LAYOUT.rockWalls ?? []), ...(SPRING_CAVE_2_LAYOUT.sideRooms ?? [])]) expect(Object.isFrozen(rock)).toBe(true);
    for (const wander of SPRING_CAVE_2_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of SPRING_CAVE_2_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
    for (const route of SPRING_CAVE_2_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const element of SPRING_CAVE_2_LAYOUT.elements) {
      expect(Object.isFrozen(element), element.id).toBe(true);
      expect(Object.isFrozen(element.glowPlant ?? element.pebble), element.id).toBe(true);
    }
  });

  it('has 40 snacks (7 worms, 6 bugs, 12 tadpoles and 15 shrimp), 3 crayfish, 6 carp, 6 stalactites, 2 geysers, 3 vents, 3 glow-plants, the pebble and 12 treasure slots, and no tilapia, nets, reeds or pads (ND-3, ND-4, ND-11)', () => {
    for (const seed of ALL_SEEDS) {
      const layout = springCave2(seed);
      expect(layout.collectibles).toHaveLength(40);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([7, 6, 12, 15]);
      expect(layout.tilapiaRoutes).toEqual([]);
      expect(layout.hazards.map((hazard) => hazard.id)).toEqual(VENT_IDS);
      expect(layout.hazards.every((hazard) => hazard.type === PULSING_CURRENT)).toBe(true);
      expect(movingHazardsOf(layout).map((spawn) => spawn.id)).toEqual(MOVING_HAZARD_IDS);
      expect(layout.reeds).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CRAYFISH_IDS.map((id) => [id, SPRING_CAVE_2_CRAYFISH]),
      ...CARP_IDS.map((id) => [id, SPRING_CAVE_2_CARP]),
    ]);
    expect(movingHazardsOf(zone).map((spawn) => spawn.type)).toEqual([...STALACTITE_IDS.map(() => STALACTITE_DRIP), ...GEYSER_IDS.map(() => GEYSER_VENT)]);
    expect(zone.elements.map((element) => [element.id, element.type.id])).toEqual([...PLANT_IDS.map((id) => [id, 'glow-plant']), [PEBBLE_ID, 'pebble']]);
    expect(SPRING_CAVE_2_LAYOUT.elements.map((element) => element.type)).toEqual([GLOW_PLANT, GLOW_PLANT, GLOW_PLANT, PEBBLE]);
    expect(SPRING_CAVE_2_LAYOUT.padCount).toBe(0);
    expect(SPRING_CAVE_2_LAYOUT.tilapia).toBeUndefined();
    expect(tripTreasureTuning(SPRING_CAVE_2_AREA_ID).slots).toBe(12);
    expect(SPRING_CAVE_2_LAYOUT.treasures).toBe(SPRING_CAVE_2_TREASURES);
  });

  it("plays the crayfish one step up the ladder from Area 6, the owner's 1.6 s cooldown and 65 px/s patrol, chasing along its stretch only", () => {
    expect(SPRING_CAVE_2_CRAYFISH.id).toBe(CRAYFISH_SPECIES.id);
    expect(SPRING_CAVE_2_CRAYFISH.rules).toEqual(CRAYFISH_SPECIES.rules);
    expect(SPRING_CAVE_2_CRAYFISH.tuning).toEqual({ ...CRAYFISH, cooldown: 1.6, patrolSpeed: 65, chase: CRAYFISH_CHASE });
    expect(SPRING_CAVE_2_CRAYFISH.tuning.cooldown).toBeLessThan(SPRING_CAVE_CRAYFISH.tuning.cooldown);
    expect(SPRING_CAVE_2_CRAYFISH.tuning.patrolSpeed).toBeGreaterThan(SPRING_CAVE_CRAYFISH.tuning.patrolSpeed);
    expect(() => tunedSpecies(CRAYFISH_SPECIES, SPRING_CAVE_2_CRAYFISH.tuning)).not.toThrow();
    for (const route of crayfishOf(zone)) expect(route.species, route.id).toBe(SPRING_CAVE_2_CRAYFISH);
  });

  it('plays its common carp one step up the predator ladder from Area 6: a 0.8 s warning at the floor, a 153 px sweep at 340 px/s with Area 6\'s hit reach, and a 135 px/s chase (ND-4)', () => {
    expect(SPRING_CAVE_2_CARP.id).toBe(CARP_SPECIES.id);
    expect(SPRING_CAVE_2_CARP.tuning).toEqual({
      ...CARP,
      windup: 0.8,
      lungeSpeed: 340,
      lungeDuration: 0.45,
      lungeRange: 135,
      hitRadius: 50,
      contactRadius: 53,
      cooldown: 1.8,
      patrolSpeed: 50,
      chase: { ...CARP_CHASE, speed: 135 },
    });
    const { tuning } = SPRING_CAVE_2_CARP;
    expect(tuning.lungeSpeed * tuning.lungeDuration).toBeCloseTo(153, 9);
    expect(tuning.hitRadius).toBe(tuning.bodyRadius + SAFE_PASSING_WIDTH / 2);
    expect(tuning.contactRadius - tuning.hitRadius).toBe(CARP.contactRadius - CARP.hitRadius);
    expect(tuning.chase).toEqual({ sight: CARP_CHASE.sight, leash: CARP_CHASE.leash, speed: 135 });
    expect(Object.isFrozen(tuning.chase)).toBe(true);
    expect(tuning.windup).toBe(tuning.minWindup);
    expect(() => tunedSpecies(CARP_SPECIES, tuning)).not.toThrow();
    const area6Carp = SPRING_CAVE_CARP.tuning;
    expect(tuning.windup).toBeLessThan(area6Carp.windup);
    expect(tuning.lungeSpeed).toBeGreaterThan(area6Carp.lungeSpeed);
    expect(tuning.lungeSpeed * tuning.lungeDuration).toBeGreaterThan(area6Carp.lungeSpeed * area6Carp.lungeDuration);
    expect(tuning.lungeRange).toBeGreaterThan(area6Carp.lungeRange);
    expect(tuning.hitRadius).toBe(area6Carp.hitRadius);
    expect(tuning.cooldown).toBeLessThan(area6Carp.cooldown);
    expect(tuning.patrolSpeed).toBeGreaterThan(area6Carp.patrolSpeed);
    expect(tuning.chase?.speed).toBeGreaterThan(area6Carp.chase?.speed ?? Infinity);
    for (const route of carpOf(zone)) expect(route.species, route.id).toBe(SPRING_CAVE_2_CARP);
  });

  it('adds one new threat, the pulsing current, and one new element, the pebble', () => {
    expect(newThingsByArea().find((things) => things.areaId === SPRING_CAVE_2_AREA_ID)).toEqual({
      areaId: SPRING_CAVE_2_AREA_ID,
      threats: ['pulsing-current'],
      elements: ['pebble'],
    });
  });

  it('names the crayfish, the carp, the pulsing current, the stalactite drip and the geyser vent as its threats, with their cards, then the tadpole and shrimp cards, and no card for the glow-plant or the pebble', () => {
    const threats = ['crayfish', 'carp', 'pulsing-current', 'stalactite-drip', 'geyser-vent'];
    expect(threatIds(SPRING_CAVE_2_LAYOUT)).toEqual(threats);
    expect(threatIds(zone)).toEqual(threats);
    expect(threatFactCards(SPRING_CAVE_2_LAYOUT)).toEqual([CRAYFISH_FACT, CARP_FACT, UNDERWATER_SPRINGS_FACT, STALACTITE_FACT, GEYSER_FACT]);
    const expected = {
      ids: [...threats, 'tadpole', 'shrimp'],
      cards: [CRAYFISH_FACT, CARP_FACT, UNDERWATER_SPRINGS_FACT, STALACTITE_FACT, GEYSER_FACT, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(SPRING_CAVE_2_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
  });

  it('is in the spring cave habitat, numbered 7, with the Ancient clay pot as its special treasure, no look of its own, no darters and a 30% stranding chance', () => {
    expect(SPRING_CAVE_2_AREA.layout).toBe(SPRING_CAVE_2_LAYOUT);
    expect(SPRING_CAVE_2_AREA.number).toBe(7);
    expect(SPRING_CAVE_2_AREA.habitatId).toBe(SPRING_CAVE_HABITAT.id);
    expect(SPRING_CAVE_2_AREA.specialTreasureId).toBe('spring-cave/ancient-clay-pot');
    expect(SPRING_CAVE_2_TREASURES.find((treasure) => treasure.id === SPRING_CAVE_2_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(SPRING_CAVE_2_AREA.look).toBeUndefined();
    expect(SPRING_CAVE_2_AREA.snackDart).toBeUndefined();
    expect(areaStrandingChance(SPRING_CAVE_2_AREA)).toBe(0.3);
    expect(Object.isFrozen(SPRING_CAVE_2_AREA)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_2_AREA.exit)).toBe(true);
    expect(Object.isFrozen(SPRING_CAVE_2_AREA.snackDrift)).toBe(true);
  });

  it('plays Cenote Glow, the spring cave cue, with no new cue (M3; ND-15)', () => {
    expect(tripCueFor(SPRING_CAVE_2_AREA)).toBe(CENOTE_GLOW);
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = springCave2(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.elements).toEqual(zone.elements);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
      expect(layout.darkWater).toEqual(zone.darkWater);
      expect(layout.rockWalls).toEqual(zone.rockWalls);
      expect(layout.sideRooms).toEqual(zone.sideRooms);
    }
  });
});

describe('Area 7 climb (ND-2)', () => {
  const screenW = zone.width / zone.chunks;
  const screenH = zone.height / zone.rows;

  it('puts the Home Spot in the bottom-left screen, and the safe area in its column of the bottom row only', () => {
    expect([screenW, screenH]).toEqual([SCREEN_W, WORLD_H]);
    expect(Math.floor(zone.homeSpot.x / screenW)).toBe(0);
    expect(areaRowKind(Math.floor(zone.homeSpot.y / screenH), zone.rows)).toBe('bottom');
    expect(zone.safeArea).toEqual({ x0: 40, x1: 300, y0: WORLD_H, y1: 2 * WORLD_H });
    expect(zone.safeArea.x1).toBeLessThan(screenW);
    expect(zone.homeSpot.y - zone.homeSpot.radius).toBeGreaterThanOrEqual(zone.safeArea.y0);
  });

  it('only goes across or up along the main path, never back down, from the Home Spot to the exit', () => {
    const path = zone.mainPath;
    expect(path[0]).toEqual(zone.start);
    expect(path[path.length - 1]).toEqual({ x: exit.x, y: exit.y });
    for (let i = 1; i < path.length; i++) expect(path[i].y, `main path point ${i}`).toBeLessThanOrEqual(path[i - 1].y);
    const rows = path.map((point) => Math.floor(point.y / screenH));
    expect([...new Set(rows)]).toEqual([1, 0]);
  });

  it('ends at the exit in the top row, at the top right', () => {
    expect(areaRowKind(Math.floor(exit.y / screenH), zone.rows)).toBe('top');
    expect(Math.floor(exit.x / screenW)).toBe(zone.chunks - 1);
  });

  it('crosses the line between the rows once, going up through a clear opening', () => {
    const lineY = WORLD_H;
    const crossings = zone.mainPath.slice(1).flatMap((to, i) => {
      const from = zone.mainPath[i];
      return from.y > lineY && to.y <= lineY ? [from.x + ((to.x - from.x) * (lineY - from.y)) / (to.y - from.y)] : [];
    });
    expect(crossings).toHaveLength(1);
    expect(rowOpenings(zone, lineY).some(([from, to]) => crossings[0] >= from && crossings[0] <= to)).toBe(true);
  });
});

describe('Area 7 exit (ND-2)', () => {
  it('sits at the top right, in the water, out of the safe area', () => {
    expect(exit).toEqual({ x: 3720, y: 200, radius: 40 });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
  });

  it('keeps the exit out of every predator strike, clear of every stalactite and geyser sweep, every vent, the current, the rock and the room', () => {
    for (const { route, strike } of strikeRoutes(zone)) {
      expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    }
    for (const spawn of movingHazardsOf(zone)) {
      expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + spawn.type.touchReach);
    }
    for (const vent of vents) expect(shapeDistance(exit, vent.shape), vent.id).toBeGreaterThan(exit.radius);
    for (const current of zone.currents) expect(shapeDistance(exit, rectOf(current))).toBeGreaterThan(exit.radius);
    for (const rock of [...walls, room]) expect(shapeDistance(exit, rectOf(rock))).toBeGreaterThan(exit.radius + PEBBLES.bodyReach);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of springCave2(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 7 danger bar (ND-4)', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats, water and rock as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = springCave2(seed);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.safeArea).toEqual(zone.safeArea);
    expect(layout.rockWalls).toEqual(zone.rockWalls);
    expect([layout.width, layout.height, layout.bedTop]).toEqual([zone.width, zone.height, zone.bedTop]);
  });

  it('has 17 moving threats for its 16 screens, 2 predator types and 2 moving hazard types, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(16);
    expect(movingThreatCount(zone)).toBe(17);
    expect(movingThreatCount(zone)).toBeGreaterThanOrEqual(Math.ceil(0.75 * screens));
    expect(predatorTypeCount(zone)).toBe(2);
    expect(movingHazardTypeCount(zone)).toBe(2);
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never leaves a quiet swim in the whole water longer than one screen across, counting the rock as no water', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(LONGEST_QUIET_SWIM.length, 2);
    expect(swim?.from).toEqual(LONGEST_QUIET_SWIM.from);
    expect(swim?.to).toEqual(LONGEST_QUIET_SWIM.to);
    expect(swim?.length).toBeLessThanOrEqual(SCREEN_W);
  });

  it('patrols every depth: each carp loop reaches 24 px into two bands, and the carp together reach all three', () => {
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
    for (const route of carpOf(zone)) expect(reached(route).length, route.id).toBeGreaterThanOrEqual(2);
    expect(new Set(carpOf(zone).flatMap((route) => reached(route))).size).toBe(3);
  });

  it('has surface danger and keeps the floor lane quiet for no more than one screen across, the crayfish counting as floor predators', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBe(FLOOR_QUIET_STRETCH);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('has 6 carp for its 16 screens, over the carp target of 5 and at most 7, the crayfish on top', () => {
    expect(carpTarget(16)).toBe(5);
    expect(carpCount(zone)).toBe(6);
    expect(carpCount(zone)).toBeLessThanOrEqual(7);
  });
});

describe('Area 7 crayfish (ND-4)', () => {
  const stretches = crayfishOf(zone);

  it('are three floor stretches in the bottom row: crayfish-0 under the first vent, crayfish-1 under the steady outflow and crayfish-2 in the pebble room', () => {
    expect(stretches.map((route) => [route.id, ...route.waypoints.map((point) => point.x)])).toEqual([
      ['crayfish-0', 360, 490],
      ['crayfish-1', 2100, 2500],
      ['crayfish-2', 3640, 3780],
    ]);
    expect(stretches[2].waypoints.every((point) => inRoom(point))).toBe(true);
  });

  it('walk straight stretches of two waypoints on the floor lane, the bed top less 22, each its own', () => {
    expect(SPRING_CAVE_2_FLOOR_Y).toBe(zone.bedTop - 22);
    expect(SPRING_CAVE_2_FLOOR_Y).toBe(bounds.maxY);
    for (const route of stretches) {
      expect(route.waypoints, route.id).toHaveLength(2);
      expect(route.waypoints.map((point) => point.y), route.id).toEqual([SPRING_CAVE_2_FLOOR_Y, SPRING_CAVE_2_FLOOR_Y]);
    }
    for (let i = 0; i < stretches.length; i++) {
      for (let j = i + 1; j < stretches.length; j++) {
        const gap = Math.min(...loopSamples(stretches[i].waypoints).map((point) => routeLoopDistance(point, stretches[j].waypoints)));
        expect(gap, `${stretches[i].id} to ${stretches[j].id}`).toBeGreaterThan(2 * CRAYFISH_STRIKE);
      }
    }
  });

  it('keeps the main path out of every crayfish reach', () => {
    for (const point of pathSamples(zone.mainPath, 4)) {
      for (const route of stretches) expect(routeLoopDistance(point, route.waypoints), `${route.id} at ${point.x}, ${point.y}`).toBeGreaterThan(CRAYFISH_STRIKE);
    }
  });
});

describe('Area 7 stalactites and geyser vents (ND-3)', () => {
  const hazards = movingHazardsOf(zone);
  const stalactites = hazards.filter((spawn) => spawn.type === STALACTITE_DRIP);
  const geysers = hazards.filter((spawn) => spawn.type === GEYSER_VENT);

  it('has six stalactites in x order and two geysers, their offsets set so a one-leg swim of the main path can pass', () => {
    expect(stalactites.map((spawn) => [spawn.id, spawn.x, movingHazardDepth(spawn), spawn.offset])).toEqual([
      [STALACTITE_IDS[0], 857, 250, 0.5],
      [STALACTITE_IDS[1], 1144, 174, 0],
      [STALACTITE_IDS[2], 2350, 250, 0.5],
      [STALACTITE_IDS[3], 2900, 250, 2.4],
      [STALACTITE_IDS[4], 3392, 233, 0],
      [STALACTITE_IDS[5], 3560, 229, 2],
    ]);
    expect(geysers.map((spawn) => [spawn.id, spawn.x, movingHazardDepth(spawn), spawn.offset])).toEqual([
      [GEYSER_IDS[0], 600, 240, 1.4],
      [GEYSER_IDS[1], 2900, 240, 1],
    ]);
  });

  it('drips each stalactite at least its old depth, and as deep as the shared rules allow up to a 250 px stream', () => {
    expect(STALACTITE_DRIP.halfWidth).toBe(8);
    for (const [index, spawn] of stalactites.entries()) {
      expect(movingHazardDepth(spawn), spawn.id).toBeGreaterThanOrEqual(OLD_STREAM_DEPTHS[index]);
      expect(movingHazardDepth(spawn), spawn.id).toBeLessThanOrEqual(MAX_STREAM);
    }
    expect([0, 2, 3].map((index) => movingHazardDepth(stalactites[index]))).toEqual([MAX_STREAM, MAX_STREAM, MAX_STREAM]);
    const strikeLimited: [number, string][] = [
      [1, 'carp-5'],
      [4, 'carp-4'],
    ];
    for (const [index, id] of strikeLimited) {
      const spawn = stalactites[index];
      const route = zone.predatorRoutes.find((candidate) => candidate.id === id);
      if (!route) throw new Error(`no route ${id}`);
      expect(shapeRouteDistance(movingHazardSweep(spawn), route.waypoints), spawn.id).toBeGreaterThan(CARP_STRIKE);
      const deeper = { ...spawn, depth: movingHazardDepth(spawn) + 1 };
      expect(shapeRouteDistance(movingHazardSweep(deeper), route.waypoints), spawn.id).toBeLessThanOrEqual(CARP_STRIKE);
    }
    const last = stalactites[5];
    const lid = walls[0];
    expect(movingHazardSweep(last).y1).toBe(lid.y0 - 1);
  });

  it('moves stalactite-2 east of x 1140, so the Common spot at x 1056 stays over S + 60 from its stream, and stalactite-5 to the east end of its ledge', () => {
    const [, second, , , fifth] = stalactites;
    expect(second.x).toBeGreaterThan(1140);
    const spot = zone.spots.find((candidate) => candidate.x === 1056 && candidate.rarity === 'common');
    if (!spot) throw new Error('no Common spot at x 1056');
    expect(shapeDistance(spot, movingHazardSweep(second))).toBeGreaterThan(riskBands(STALACTITE_DRIP.touchReach).common.over);
    const ledge = (zone.bankOverhangs ?? []).find((candidate) => candidate.x0 <= fifth.x && fifth.x <= candidate.x1);
    expect(movingHazardSweep(fifth).x1).toBe(ledge?.x1);
  });

  it('hangs each stalactite from the underside of a rock ledge in the top row, never from the surface, its stream in the top row only', () => {
    const ledges = zone.bankOverhangs ?? [];
    for (const spawn of stalactites) {
      const sweep = movingHazardSweep(spawn);
      const roof = ledges.find((ledge) => ledge.x0 <= sweep.x0 && sweep.x1 <= ledge.x1 && ledge.y0 === movingHazardBaseY(spawn));
      expect(roof, spawn.id).toBeDefined();
      expect(movingHazardBaseY(spawn), spawn.id).toBe(110);
      expect(movingHazardDirection(spawn), spawn.id).toBe(1);
      expect(touchZone(spawn).y0, spawn.id).toBeLessThanOrEqual(bounds.minY);
      expect(touchZone(spawn).y1, spawn.id).toBeLessThanOrEqual(WORLD_H + PEBBLES.bodyReach);
    }
  });

  it('drips the last stalactite down onto the pebble room roof, so the top-right corner is no long quiet swim', () => {
    const last = stalactites[stalactites.length - 1];
    const lid = walls[0];
    expect(touchZone(last).y1).toBeGreaterThanOrEqual(lid.y0);
    expect(movingHazardSweep(last).y1).toBeLessThan(lid.y0);
    expect(last.x).toBeGreaterThan(lid.x0);
  });

  it('stands each geyser on the bed of the bottom row, its column at least 240 px up, out of the room', () => {
    expect(GEYSER_VENT.depth).toBe(240);
    for (const spawn of geysers) {
      expect(movingHazardDepth(spawn), spawn.id).toBeGreaterThanOrEqual(GEYSER_VENT.depth);
      expect(movingHazardBaseY(spawn), spawn.id).toBe(zone.bedTop);
      expect(movingHazardDirection(spawn), spawn.id).toBe(-1);
      expect(touchZone(spawn).y0, spawn.id).toBeGreaterThan(WORLD_H);
      expect(shapeDistance({ x: spawn.x, y: zone.bedTop }, rectOf(room)), spawn.id).toBeGreaterThan(0);
    }
  });

  it('bursts geyser-1 across the main path along the bottom row, between the safe area and the climb, at y 560', () => {
    const [first] = geysers;
    const climbX = zone.mainPath[2].x;
    const samples = pathSamples(zone.mainPath, 2).filter((point) => point.y === BOTTOM_PATH_Y);
    expect(samples.some((point) => shapeDistance(point, movingHazardSweep(first)) === 0)).toBe(true);
    expect(touchZone(first).x0).toBeGreaterThan(zone.safeArea.x1);
    expect(touchZone(first).x1).toBeLessThan(climbX);
  });

  it('keeps every touch zone clear of the safe area and the exit, and never overlaps two touch zones', () => {
    for (const spawn of hazards) {
      expect(touchZone(spawn).x0, spawn.id).toBeGreaterThan(zone.safeArea.x1);
      expect(shapeDistance(exit, touchZone(spawn)), spawn.id).toBeGreaterThan(exit.radius);
    }
    for (let i = 0; i < hazards.length; i++) {
      for (let j = i + 1; j < hazards.length; j++) {
        expect(rectDistance(touchZone(hazards[i]), touchZone(hazards[j])), `${hazards[i].id} to ${hazards[j].id}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every stalactite and geyser sweep farther than the strike from every patrol loop: 90 px for the crayfish, 135 px for the carp', () => {
    expect([CRAYFISH_STRIKE, CARP_STRIKE]).toEqual([90, 135]);
    for (const spawn of hazards) {
      for (const { route, strike } of strikeRoutes(zone)) {
        expect(shapeRouteDistance(movingHazardSweep(spawn), route.waypoints), `${spawn.id} to ${route.id}`).toBeGreaterThan(strike);
      }
    }
  });
});

describe('Area 7 pulsing vents (ND-5 to ND-7)', () => {
  it("has three vents along the main path, the owner's calms falling 2.5, 2.2 and 2.0 s, each with the 0.8 s warning and 1.5 s surge", () => {
    expect(vents.map((vent) => vent.id)).toEqual(VENT_IDS);
    expect(vents.map((vent) => vent.pulse.calmFor)).toEqual([2.5, 2.2, 2.0]);
    expect(vents.map((vent) => vent.pulse.flow)).toEqual(['left', 'down', 'left']);
    expect(vents.map((vent) => pulsePeriod(vent.pulse))).toEqual([4.8, expect.closeTo(4.5, 9), expect.closeTo(4.3, 9)]);
    expect(PULSING_CURRENTS.warnFor).toBe(0.8);
    expect(PULSING_CURRENTS.surgeFor).toBe(1.5);
  });

  it('puts each band across the main path, in the order the path meets them, and blows it back along the path', () => {
    const samples = pathSamples(zone.mainPath, 2);
    const firstIndex = vents.map((vent) => samples.findIndex((point) => inPulseBand(point, vent.shape)));
    expect(firstIndex.every((index) => index >= 0)).toBe(true);
    expect([...firstIndex].sort((a, b) => a - b)).toEqual(firstIndex);
    for (const vent of vents) {
      const index = samples.findIndex((point) => inPulseBand(point, vent.shape));
      const along = { x: samples[index + 1].x - samples[index].x, y: samples[index + 1].y - samples[index].y };
      const step = flowStep(vent.pulse.flow);
      expect(along.x * step.x + along.y * step.y, vent.id).toBeLessThan(0);
    }
  });

  it('lets a one-leg axolotl cross each band, body edge to body edge, in its calm and warning', () => {
    for (const vent of vents) {
      expect(bandLength(vent.shape, vent.pulse.flow), vent.id).toBe(vent.id === VENT_IDS[0] ? 160 : 200);
      expect(oneLegCrossSeconds(bandLength(vent.shape, vent.pulse.flow)), vent.id).toBeLessThanOrEqual(vent.pulse.calmFor + PULSING_CURRENTS.warnFor);
    }
  });

  it('lands every surge in open water: the landing strip in the swim bounds, out of every predator strike and crayfish reach, every stalactite and geyser touch, the rock, the room, every other band and the current', () => {
    for (const vent of vents) {
      const strip = pulseLandingStrip(vent);
      expect(strip.x0 >= bounds.minX && strip.x1 <= bounds.maxX && strip.y0 >= bounds.minY && strip.y1 <= bounds.maxY, vent.id).toBe(true);
      for (const { route, strike } of strikeRoutes(zone)) {
        expect(shapeRouteDistance(strip, route.waypoints), `${vent.id} to ${route.id}`).toBeGreaterThan(strike);
      }
      for (const spawn of movingHazardsOf(zone)) expect(rectDistance(strip, touchZone(spawn)), `${vent.id} to ${spawn.id}`).toBeGreaterThan(0);
      for (const rock of [...walls, room]) expect(rectDistance(strip, rectOf(rock)), vent.id).toBeGreaterThan(PEBBLES.bodyReach);
      for (const other of vents) if (other !== vent) expect(rectDistance(strip, other.shape), `${vent.id} to ${other.id}`).toBeGreaterThan(0);
      for (const current of zone.currents) expect(rectDistance(strip, rectOf(current)), vent.id).toBeGreaterThan(0);
    }
  });

  it('pushes even the fastest swimmer back out of each band during a surge, and never costs a leg', () => {
    for (const vent of vents) {
      const surgeAt = vent.pulse.offset + vent.pulse.calmFor + PULSING_CURRENTS.warnFor + 0.01;
      const middle = { x: (vent.shape.x0 + vent.shape.x1) / 2, y: (vent.shape.y0 + vent.shape.y1) / 2 };
      const push = addPulseCurrent({ x: 0, y: 0 }, middle, zone.hazards, surgeAt);
      expect(Math.hypot(push.x, push.y), vent.id).toBe(PULSING_CURRENTS.surgeSpeed);
      expect(vent.type.costsLeg).toBe(false);
    }
  });

  it('keeps the bands out of the safe area, the rock and the room, and apart from each other', () => {
    for (const vent of vents) {
      expect(inSafeArea({ x: vent.shape.x0, y: vent.shape.y0 }, zone.safeArea), vent.id).toBe(false);
      expect(vent.shape.x0, vent.id).toBeGreaterThan(zone.safeArea.x1);
      for (const rock of [...walls, room]) expect(rectDistance(vent.shape, rectOf(rock)), vent.id).toBeGreaterThan(0);
    }
    for (let i = 0; i < vents.length; i++) {
      for (let j = i + 1; j < vents.length; j++) expect(rectDistance(vents[i].shape, vents[j].shape), `${vents[i].id} to ${vents[j].id}`).toBeGreaterThan(0);
    }
  });
});

describe('Area 7 pebble and rock (ND-8, ND-9)', () => {
  const [pebble] = pebbles(zone.elements);
  const groove = pebble.pebble;

  it('walls a side room in the bottom right with solid rock: a lid over it and a wall down to the doorway', () => {
    expect(walls).toEqual([
      { x0: 3440, x1: 3840, y0: 340, y1: 380 },
      { x0: 3440, x1: 3480, y0: 380, y1: 560 },
    ]);
    expect(room).toEqual({ x0: 3480, x1: 3840, y0: 380, y1: 720 });
  });

  it('sets the pebble in the doorway on the bed, rolling 120 px east along its groove into the room', () => {
    expect(pebble.id).toBe(PEBBLE_ID);
    expect(groove).toEqual({ x0: 3460, y0: 634, x1: 3580, y1: 634, radius: 40 });
    expect(grooveLength(groove)).toBe(120);
    expect(groove.y0 + groove.radius).toBeLessThanOrEqual(zone.bedTop);
    for (const along of [0, 60, 120]) {
      const centre = pebbleCentre(groove, along);
      for (const wall of walls) expect(shapeDistance(centre, rectOf(wall)), `at ${along}`).toBeGreaterThan(groove.radius);
    }
  });

  it('blocks the doorway while it has not rolled: no body centre gets past the wall line from the bed to the lid', () => {
    const centre = pebbleCentre(groove, 0);
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      const point = { x: centre.x, y };
      if (y <= walls[0].y0 - PEBBLES.bodyReach) continue;
      expect(bodyInAnyRock(point, walls) || bodyTouchesPebble(point, centre, groove.radius), `y ${y}`).toBe(true);
    }
  });

  it('opens the doorway once rolled, at least the safe passing width under the wall', () => {
    const end = pebbleCentre(groove, grooveLength(groove));
    const open: number[] = [];
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      const point = { x: groove.x0, y };
      if (!bodyInAnyRock(point, walls) && !bodyTouchesPebble(point, end, groove.radius)) open.push(y);
    }
    expect(open.length).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('lets a one-leg axolotl push the pebble the whole groove from the main path side and swim into the room', () => {
    const outside = { x: 3300, y: 634 };
    const inside = { x: 3700, y: 520 };
    const seconds = oneLegSeconds(outside, [{ x: 3390, y: 634 }, { x: 3560, y: 560 }, inside], zone, (pos) => Math.hypot(pos.x - inside.x, pos.y - inside.y) <= WAYPOINT_REACH);
    expect(seconds).toBeLessThan(BEAT_MAX_SECONDS);
  });

  it('keeps the main path, the exit, every stranding place, the Home Spot and every snack start out of the room and the rock', () => {
    for (const point of pathSamples(zone.mainPath, 4)) {
      expect(inRoom(point), `path at ${point.x}, ${point.y}`).toBe(false);
      expect(bodyInAnyRock(point, walls), `path at ${point.x}, ${point.y}`).toBe(false);
    }
    expect(inRoom(exit)).toBe(false);
    expect(inRoom(zone.homeSpot)).toBe(false);
    for (const place of zone.strandingPlaces) expect(shapeDistance(place, rectOf(room)), place.id).toBeGreaterThan(SNACK_HAZARD_CLEARANCE);
    for (const seed of SNACK_SEEDS) {
      for (const snack of springCave2(seed).collectibles) {
        for (const rock of [...walls, room]) expect(shapeDistance(snack, rectOf(rock)), `${snack.id} seed ${seed}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('puts every Rare spot and the grotto in the room, so the special treasure is always behind the pebble', () => {
    const rares = zone.spots.filter((spot) => spot.rarity === 'rare');
    expect(rares).toHaveLength(5);
    for (const spot of rares) {
      expect(inRoom(spot), spot.id).toBe(true);
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
    }
    const special = zone.finds.find((find) => find.id === SPRING_CAVE_2_AREA.specialTreasureId);
    expect(special?.pool).toEqual(rares.map((spot) => spot.id));
    expect(inRoom({ x: zone.cave.x0, y: zone.cave.y0 })).toBe(true);
    expect(inRoom({ x: zone.cave.x1, y: zone.cave.y1 })).toBe(true);
  });

  it('keeps every room spot out of a pickup from outside the rock', () => {
    const reach = SNACK_REACH.headAhead + FINDS.pickupRadius + PEBBLES.bodyReach;
    for (const spot of zone.spots.filter((candidate) => inRoom(candidate))) {
      for (const wall of walls) expect(shapeDistance(spot, rectOf(wall)), spot.id).toBeGreaterThan(reach - PEBBLES.bodyReach - 10);
    }
  });
});

describe('Area 7 hiding spots (B5, B6, B10; ND-12)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, with the turn clearance, for seed %i', (seed) => {
    const layout = springCave2(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('spring-cave-2/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, layout.predatorRoutes), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it('bands every spot by its riskiest predator: Common over S + 60 from all, Rare over S, Epic over S / 2, Legendary within S / 2 of one', () => {
    for (const spot of zone.spots) {
      const bands = strikeRoutes(zone).map(({ route, strike }) => ({ distance: routeLoopDistance(spot, route.waypoints), band: riskBands(strike)[spot.rarity] }));
      for (const { distance, band } of bands) expect(distance, spot.id).toBeGreaterThan(band.over);
      expect(bands.some(({ distance, band }) => distance <= band.upTo), spot.id).toBe(true);
    }
  });

  it('has 6 Common, 5 Rare, 3 Epic and 3 Legendary spots, each pool larger than its Area 7 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([6, 5, 3, 3]);
    for (const rarity of RARITIES) {
      const treasures = SPRING_CAVE_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
  });

  it('hides the Common spots under the rock ledges along the main path in the top row, lit', () => {
    const commons = zone.spots.filter((spot) => spot.rarity === 'common');
    for (const spot of commons) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(spot.y, spot.id).toBeLessThan(WORLD_H);
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeLessThanOrEqual(MAIN_PATH_REACH);
      expect(inDarkWater(spot, dark), spot.id).toBe(false);
    }
  });

  it('puts the Legendary pots and two Epic spots just past the steady outflow, and the third Epic in the room grotto', () => {
    const deep = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(deep.map((spot) => [spot.cover, spot.rarity])).toEqual([
      ['cave', 'epic'],
      ['pastCurrent', 'legendary'],
      ['pastCurrent', 'legendary'],
      ['pastCurrent', 'legendary'],
      ['pastCurrent', 'epic'],
      ['pastCurrent', 'epic'],
    ]);
    for (const spot of deep) {
      expect(coversAt(spot, zone), spot.id).toEqual([spot.cover]);
      expect(spot.container, spot.id).toBe(spot.rarity === 'legendary');
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = springCave2(seed);
    const home = layout.homeSpot;
    for (const spot of layout.spots) {
      expect(inBounds(spot, layout), spot.id).toBe(true);
      expect(inSafeArea(spot, layout.safeArea), spot.id).toBe(false);
      expect(bodyInAnyRock(spot, walls), spot.id).toBe(false);
      expect(Math.hypot(spot.x - home.x, spot.y - home.y)).toBeGreaterThanOrEqual(home.radius + FINDS.pickupRadius + 8);
    }
    for (let i = 0; i < layout.spots.length; i++) {
      for (let j = i + 1; j < layout.spots.length; j++) {
        const [a, b] = [layout.spots[i], layout.spots[j]];
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} to ${b.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });

  it('never makes a past-current band from a vent: only the steady outflow has one', () => {
    expect(zone.currents).toHaveLength(1);
    expect(zone.spots.filter((spot) => spot.cover === 'pastCurrent').every((spot) => isInsideCurrent({ x: zone.currents[0].x1, y: spot.y }, zone.currents[0]))).toBe(true);
    for (const vent of vents) {
      for (const spot of zone.spots) expect(inPulseBand(spot, vent.shape), `${spot.id} in ${vent.id}`).toBe(false);
    }
  });
});

describe('Area 7 placing treasure (B4; ND-12)', () => {
  const tuning = tripTreasureTuning(SPRING_CAVE_2_AREA_ID);
  const options = { extras: [SPRING_CAVE_2_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 12 slots, the lost treasures and the Ancient clay pot', () => {
    const all = SPRING_CAVE_2_TREASURES.map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(SPRING_CAVE_2_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('leaves few of the 12 slots empty over 200 fresh trips', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 7 carp, steady outflow and stranding places', () => {
  it('keeps every carp loop in the water, its body out of the safe area, the rock and the room, and every predator loop clear of the rock by its chase', () => {
    for (const route of carpOf(zone)) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
      }
      for (const rock of [...walls, room]) {
        expect(shapeRouteDistance(rectOf(rock), route.waypoints), route.id).toBeGreaterThan(SPRING_CAVE_2_CARP.tuning.bodyRadius + (SPRING_CAVE_2_CARP.tuning.chase?.leash ?? 0));
      }
    }
  });

  it('flows gently and steadily to the left at 73 px/s on the bed of the bottom row, off the main path', () => {
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -73, y: 0 });
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(17);
    for (const point of pathSamples(zone.mainPath, 4)) expect(isInsideCurrent(point, current)).toBe(false);
    expect(pastCurrentBand(current)).toEqual({ edgeX: current.x1, farX: current.x1 + 140 });
  });

  it.each(ALL_SEEDS)('keeps every stranding place out of the dark and the room, 80 px from every route, clear of stalactites, geysers, vents, spots and the current for seed %i', (seed) => {
    const layout = springCave2(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `spring-cave-2/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(inDarkWater(place, dark), place.id).toBe(false);
      expect(inRoom(place), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(routeDistance(place, layout.predatorRoutes), place.id).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
      for (const spawn of movingHazardsOf(layout)) {
        expect(shapeDistance(place, movingHazardSweep(spawn)), `${place.id} to ${spawn.id}`).toBeGreaterThanOrEqual(STRAND_HAZARD_CLEARANCE);
      }
      for (const vent of vents) expect(shapeDistance(place, vent.shape), `${place.id} to ${vent.id}`).toBeGreaterThan(RESCUE.reachRadius);
      for (const spot of layout.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 7 gaps and routes (the level layout ladder)', () => {
  it('swims the main path through a gap tighter than Area 6 narrowest, between the first stalactite and carp-0 at the top of the climb, and never under the safe passing width', () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe('spring-cave-2/stalactite-1 and carp-0');
    expect(narrowest.width).toBeCloseTo(36, 9);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
    expect(narrowest.width).toBeLessThan(AREA_6_NARROWEST);
  });

  it('leaves at least three ways up between the rows, each at least the safe passing width', () => {
    const openings = rowOpenings(zone, WORLD_H).filter(([from, to]) => to - from >= SAFE_PASSING_WIDTH);
    expect(openings.length).toBeGreaterThanOrEqual(3);
  });

  it('has two dead ends holding treasure off the main path: the pebble room and the water past the steady outflow', () => {
    const roomSpots = zone.spots.filter((spot) => inRoom(spot));
    const pastSpots = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect([roomSpots.length, pastSpots.length]).toEqual([6, 5]);
    for (const spot of [...roomSpots, ...pastSpots]) expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
  });
});

describe('Area 7 dark stretch and glow-plants (ND-10)', () => {
  const plants = glowPlants(zone.elements);
  const unlit = darkLights({ axolotl: zone.start, exit, elements: zone.elements, lit: [] });

  it('is a stretch of the top row on the main path, with three glow-plants in it, each reachable and shown with no plant lit', () => {
    expect(zone.darkWater).toEqual({ x0: 2420, x1: 2780, y0: 80, y1: WORLD_H });
    expect(pathSamples(zone.mainPath, 4).some((point) => inDarkWater(point, dark))).toBe(true);
    expect(plants.map((plant) => plant.id)).toEqual(PLANT_IDS);
    for (const plant of plants) {
      expect(plant.glowPlant.radius, plant.id).toBe(SPRING_CAVE_2_GLOW_PLANT_RADIUS);
      expect(inDarkWater(plant.glowPlant, dark), plant.id).toBe(true);
      expect(glowPlantReachable(plant.glowPlant, bounds), plant.id).toBe(true);
      expect(shownInDark('glow-plant', plant.glowPlant, dark, []), plant.id).toBe(true);
    }
  });

  it('keeps the exit, the Home Spot, every stranding place, the vents, the pebble and the rock out of the dark', () => {
    expect(inDarkWater(exit, dark)).toBe(false);
    expect(litByAny(exit, unlit)).toBe(true);
    expect(inDarkWater(zone.homeSpot, dark)).toBe(false);
    for (const place of zone.strandingPlaces) expect(inDarkWater(place, dark), place.id).toBe(false);
    for (const vent of vents) expect(rectDistance(vent.shape, rectOf(dark)), vent.id).toBeGreaterThan(0);
    for (const rock of [...walls, room]) expect(rectDistance(rectOf(rock), rectOf(dark))).toBeGreaterThan(0);
  });

  it('keeps the hint on an unlit plant while one is left, in any lighting order', () => {
    const orders = [PLANT_IDS, [...PLANT_IDS].reverse(), [PLANT_IDS[1], PLANT_IDS[0], PLANT_IDS[2]]];
    for (const order of orders) {
      const lit: string[] = [];
      for (const id of order) {
        for (const body of darkGrid(60)) {
          const hinted = darkHintPlant(GLOW_PLANTS.hintAfter, body, zone.elements, lit);
          expect(hinted).not.toBeNull();
          expect(lit).not.toContain(hinted);
        }
        lit.push(id);
      }
    }
  });
});

describe('Area 7 snacks', () => {
  const drift = SPRING_CAVE_2_AREA.snackDrift;
  const surfacePeak = zone.currents.length > 0 ? 80 + 1.6 + 0.8 : 0;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every stalactite and geyser sweep and every vent band for seed %i', (seed) => {
    const layout = springCave2(seed);
    expect(layout.collectibles).toHaveLength(40);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of movingHazardsOf(layout)) expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      for (const vent of pulsingCurrents(layout.hazards)) expect(shapeDistance(snack, vent.shape), `${snack.id} to ${vent.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the steady outflow, and only worms and bugs in it, for seed %i', (seed) => {
    const layout = springCave2(seed);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(SPRING_CAVE_2_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = springCave2(seed);
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

  it('drift a little faster than Area 6, slower than a one-leg axolotl swims against the steady outflow, and at most half the magnet pull', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(zone.currents[0].force.x);
    expect(drift).toEqual({ ...SPRING_CAVE_AREA.snackDrift, periodX: 7.3, periodY: 5.84 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(SPRING_CAVE_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('has no one-time darters: no dart rule, and its shrimp replace them', () => {
    expect(oneTimeDarts(SPRING_CAVE_2_AREA, zone)).toBeNull();
  });

  it.each(ALL_SEEDS)('gives every shrimp a clear place and a clear flick target in at least one of 8 directions for seed %i', (seed) => {
    const layout = springCave2(seed);
    const avoid = mobileSnackAvoid(layout);
    const rule = layout.mobileSnacks?.shrimp;
    const spots = (layout.mobileSnacks?.homes ?? []).map((home) => home.points[0]);
    expect(spots).toHaveLength(15);
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

describe('Area 7 mobile snacks (ND-11)', () => {
  const mix = zone.mobileSnacks;
  const drift = SPRING_CAVE_2_AREA.snackDrift;

  it("meets the later row of the snack ramp: 27 of its 40 snacks mobile, a share above Area 6's 24 of 36 and at most 0.7, its tadpoles at 72 px/s", () => {
    expect(meetsSnackRamp(7, SPRING_CAVE_2_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(27);
    const share = mobile / zone.collectibles.length;
    expect(share).toBeGreaterThan(24 / 36);
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(SPRING_CAVE_2_LAYOUT)).toBe(true);
    expect(meetsSnackMotion({ screensWide: zone.chunks, screensTall: zone.rows, mobileSnacks: zone.mobileSnacks })).toBe(true);
  });

  it('swims twelve tadpoles on wander loops of 4 points, each leg 1.5 to 5 s, each a twelfth of its own lap further on than the last', () => {
    const wanders = mix?.wanders ?? [];
    const speed = mix?.tadpole?.speed ?? 0;
    expect(wanders).toHaveLength(12);
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
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 12, 9);
    }
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall, wholly in one screen row, nine in the top row and three in the bottom, no two centres closer than 240 px', () => {
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
    expect([0, 1].map((row) => rows.filter((each) => each === row).length)).toEqual([9, 3]);
    const centres = wanders.map((wander) => homeCentreOf(wander.points));
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        expect(Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y), `loops ${i} and ${j}`).toBeGreaterThanOrEqual(240);
      }
    }
  });

  it('never swims a tadpole or hops a shrimp into a vent band, the steady outflow, the rock or the room', () => {
    const rects = [...vents.map((vent) => vent.shape), ...zone.currents.map(rectOf), ...walls.map(rectOf), rectOf(room)];
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

  it("gives its fifteen shrimp Area 6's shrimp rule, on homes of 3 hop spots in a box at most 200 x 160 px, eleven in the top row and four in the bottom", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    const homes = mix?.homes ?? [];
    expect(homes).toHaveLength(15);
    for (const home of homes) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      expect(home.points, label).toHaveLength(3);
      const box = homeBoxOf(home.points);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
    const rows = homes.map((home) => homeRowOf(home.points));
    expect([0, 1].map((row) => rows.filter((each) => each === row).length)).toEqual([11, 4]);
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = springCave2(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(1.2 * 72, 9);
  });
});

describe('Area 7 difficulty', () => {
  it('is bigger than Area 6: more screens, more snacks, faster drift, more slots and a stronger carp', () => {
    expect((zone.width / SCREEN_W) * (zone.height / WORLD_H)).toBeGreaterThan((area6.width / SCREEN_W) * (area6.height / WORLD_H));
    expect(zone.collectibles.length).toBeGreaterThan(area6.collectibles.length);
    expect(snackDriftMaxSpeed(SPRING_CAVE_2_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(SPRING_CAVE_AREA.snackDrift));
    expect(tripTreasureTuning(SPRING_CAVE_2_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(SPRING_CAVE_AREA.id).slots);
    expect(SPRING_CAVE_2_CARP.tuning.lungeRange).toBeGreaterThan(SPRING_CAVE_CARP.tuning.lungeRange);
  });
});

describe('beating Area 7 (ND-5, ND-10)', () => {
  it('lets a one-leg axolotl swim the main path up the climb, timing every vent, to the exit with no plant lit, then home', () => {
    const toExit = oneLegSeconds(zone.start, zone.mainPath.slice(1), zone, (pos) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius);
    expect(toExit).toBeCloseTo(ONE_LEG_EXIT_SECONDS, 1);
    expect(toExit).toBeLessThan(BEAT_MAX_SECONDS);
    const home = oneLegSeconds(exit, [...zone.mainPath].reverse().slice(1), zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });
});
