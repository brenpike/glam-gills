import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_2_AREA, DEEP_CANAL_AREA, DEEP_CANAL_HABITAT, newThingsByArea, sourceFactCards, threatFactCards, threatIds } from './areas';
import { BAILING_BUCKET, BAILING_BUCKETS, bailingCatchBox } from './bailingBuckets';
import { DEEP_CANAL_2_TREASURES, RARITIES, dreamColourById, type Treasure } from './catalogue';
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
  DEEP_CANAL_2_AREA_ID,
  DEEP_CANAL_2_BASS,
  DEEP_CANAL_2_CARP,
  DEEP_CANAL_2_LAYOUT,
  DEEP_CANAL_2_TILAPIA,
} from './deepCanal2Layout';
import { DEEP_CANAL_BASS, DEEP_CANAL_CARP, DEEP_CANAL_LAYOUT, DEEP_CANAL_TILAPIA } from './deepCanalLayout';
import { currentAt } from './environment';
import { exitGateBase } from './exitGate';
import {
  ANCHOR_DROP_FACT,
  BLACK_BASS_FACT,
  CARP_FACT,
  MUD_SEEP_FACT,
  MURKY_WATER_FACT,
  SHRIMP_FACT,
  TADPOLE_FACT,
  TILAPIA_FACT,
} from './factCards';
import { shapeDistance, type HazardRect, type HazardShape } from './hazards';
import { MAIN_PATH_REACH, coversAt, distanceToPath, riskBands, routeDistance, spotMatchesLabels, turnDistance, zoneThreats } from './hiding';
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
import { TRAJINERA_WALTZ, tripCueFor } from './music';
import { ANCHOR_DROP, MUD_SEEP, movingHazardBaseY, movingHazardDepth, movingHazardDirection, movingHazardSweep } from './movingHazards';
import { MURKY_WATER, MURKY_WATER_TIMING, insideMurky, murkyCrossSeconds, murkyPatches } from './murkyWater';
import type { RockWall } from './pebble';
import { SNACK_MAGNET_PULL_SPEED } from './perks';
import { placeTreasures } from './placement';
import { BLACK_BASS_SPECIES, CARP_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import { RESCUE, areaStrandingChance } from './rescue';
import { isShrimpFlickLandingClear } from './shrimpFlick';
import { stepSwim, type SwimState } from './swimPhysics';
import { BLACK_BASS, BLACK_BASS_CHASE, FINDS, LEGS, RISK, SHRIMP, SWIM, TADPOLES, TILAPIA, tripTreasureTuning } from './tuning';
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
/** The fewest and most screens back toward the hub a bailing boat's landing point lies (issue #107, ND-2: about 3). */
const LANDING_SCREENS_BACK = { least: 2.5, most: 3.5 };
/** Longest quiet swim in the whole water in px, as measured, and where it starts and ends. */
const LONGEST_QUIET_SWIM = { length: 296.57, from: { x: 2960, y: 126 }, to: { x: 2680, y: 102 } };
/** Longest quiet swim on each branch, counting only that branch's threats, in px, as measured. */
const BRANCH_QUIET_SWIM = { west: 121.14, east: 296.57 };
/** Longest quiet stretch of the floor lane in px, as measured. */
const FLOOR_QUIET_STRETCH = 58;
/** One-leg seconds along the main path from the Home Spot to the exit, as measured. */
const ONE_LEG_EXIT_SECONDS = 32.75;
/** Empty treasure slots over the 200 fresh trips, as measured: 14 slots for 13 treasures. */
const EMPTY_SLOTS = { most: 7, mean: 4.84 };
const TILAPIA_IDS = ['tilapia-0', 'tilapia-1'];
const CARP_IDS = [0, 1, 2, 3, 4, 5].map((n) => `carp-${n}`);
const BASS_IDS = ['bass-0', 'bass-1'];
const MOVER_IDS = [
  'deep-canal-2/anchor-drop-1',
  'deep-canal-2/anchor-drop-2',
  'deep-canal-2/mud-seep-1',
  'deep-canal-2/mud-seep-2',
];
const PATCH_IDS = [1, 2, 3].map((n) => `deep-canal-2/murky-water-${n}`);
const BOAT_IDS = [1, 2].map((n) => `deep-canal-2/bailing-bucket-${n}`);

const zone = buildZone(DEEP_CANAL_2_LAYOUT, DEFAULT_ZONE_SEED);
const area8 = buildZone(DEEP_CANAL_LAYOUT, DEFAULT_ZONE_SEED);
const bounds = swimBounds(zone);
const { exit } = DEEP_CANAL_2_AREA;
const movers = zone.movingHazards ?? [];
const patches = murkyPatches(zone.hazards);
const boats = zone.bailingBoats ?? [];
const catchBoxes = boats.map((boat) => bailingCatchBox(boat));
const routePatches = patches.filter((patch) => pathSamples(zone.mainPath, 2).some((point) => insideMurky(point, [patch])));
const { safeArea } = zone;

function deepCanal2(seed: number): ZoneLayout {
  return buildZone(DEEP_CANAL_2_LAYOUT, seed);
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
function strikeRoutes(layout: ZoneLayout): { route: TilapiaRoute; strike: number; reach: number; body: number }[] {
  const tuning = layout.tilapia ?? TILAPIA;
  return [
    ...layout.tilapiaRoutes.map((route) => ({
      route,
      strike: tuning.lungeRange,
      reach: tuning.lungeRange + (tuning.chase?.leash ?? 0),
      body: tuning.bodyRadius,
    })),
    ...layout.predatorRoutes.map((route) => ({
      route,
      strike: route.species.tuning.lungeRange,
      reach: route.species.tuning.lungeRange + (route.species.tuning.chase?.leash ?? 0),
      body: route.species.tuning.bodyRadius,
    })),
  ];
}

/** The branch a point is in: west of the safe area, east of it, or the hub, the safe area's column. */
function branchOf(point: Point): 'west' | 'east' | 'hub' {
  if (point.x < safeArea.x0) return 'west';
  return point.x > safeArea.x1 ? 'east' : 'hub';
}

/** The branch a whole loop keeps to, or 'both' when it reaches into the hub or the other branch. */
function loopBranch(waypoints: readonly Point[]): string {
  const branches = new Set(loopSamples(waypoints).map(branchOf));
  return branches.size === 1 ? [...branches][0] : 'both';
}

/**
 * The zone as one branch sees it: the other branch's water made rock, and only that branch's
 * threats, so a quiet swim there counts that branch's threats alone.
 */
function branchGeometry(layout: ZoneLayout, branch: 'west' | 'east'): ZoneLayout {
  const other: RockWall =
    branch === 'west' ? { x0: safeArea.x1 + 1, x1: layout.width, y0: 0, y1: 2 * WORLD_H } : { x0: 0, x1: safeArea.x0 - 1, y0: 0, y1: 2 * WORLD_H };
  return {
    ...layout,
    rockWalls: [other],
    tilapiaRoutes: layout.tilapiaRoutes.filter((route) => loopBranch(route.waypoints) === branch),
    predatorRoutes: layout.predatorRoutes.filter((route) => loopBranch(route.waypoints) === branch),
    movingHazards: (layout.movingHazards ?? []).filter((spawn) => branchOf({ x: spawn.x, y: SURF }) === branch),
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

describe('DEEP_CANAL_2_LAYOUT', () => {
  it('is Area 9 data: 9 screens across, 2 down, starting at the Home Spot', () => {
    expect(DEEP_CANAL_2_AREA_ID).toBe('deep-canal-2');
    expect(DEEP_CANAL_2_LAYOUT.id).toBe(DEEP_CANAL_2_AREA_ID);
    expect(zone.width).toBe(4320);
    expect(zone.height).toBe(720);
    expect(zone.bedTop).toBe(678);
    expect([zone.chunks, zone.rows]).toEqual([9, 2]);
    expect(zone.start).toEqual({ x: 2160, y: 360 });
    expect(zone.homeSpot).toEqual({ x: 2160, y: 360, radius: 72 });
    expect(zone.cave.id).toBe('deep-canal-2/cave');
    expect(zone.rockWalls).toBeUndefined();
    expect(zone.trajineras).toBeUndefined();
  });

  it('is frozen data, down to each route, moving hazard, murky patch, bailing boat and mobile snack', () => {
    expect(Object.isFrozen(DEEP_CANAL_2_LAYOUT)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_2_TILAPIA)).toBe(true);
    for (const species of [DEEP_CANAL_2_CARP, DEEP_CANAL_2_BASS]) {
      expect(Object.isFrozen(species)).toBe(true);
      expect(Object.isFrozen(species.tuning)).toBe(true);
    }
    for (const part of [
      DEEP_CANAL_2_LAYOUT.elements,
      DEEP_CANAL_2_LAYOUT.hazards,
      DEEP_CANAL_2_LAYOUT.tilapiaRoutes,
      DEEP_CANAL_2_LAYOUT.predatorRoutes,
      DEEP_CANAL_2_LAYOUT.bankOverhangs,
      DEEP_CANAL_2_LAYOUT.bankSpots,
      DEEP_CANAL_2_LAYOUT.caveSpots,
      DEEP_CANAL_2_LAYOUT.currentSpots,
      DEEP_CANAL_2_LAYOUT.currents,
      DEEP_CANAL_2_LAYOUT.mainPath,
      DEEP_CANAL_2_LAYOUT.strandingPlaces,
      DEEP_CANAL_2_LAYOUT.movingHazards,
      DEEP_CANAL_2_LAYOUT.bailingBoats,
      DEEP_CANAL_2_LAYOUT.mobileSnacks,
      DEEP_CANAL_2_LAYOUT.mobileSnacks?.wanders,
      DEEP_CANAL_2_LAYOUT.mobileSnacks?.homes,
      DEEP_CANAL_2_LAYOUT.mobileSnacks?.tadpole,
      DEEP_CANAL_2_LAYOUT.mobileSnacks?.shrimp,
    ]) {
      expect(part).toBeDefined();
      expect(Object.isFrozen(part)).toBe(true);
    }
    for (const route of DEEP_CANAL_2_LAYOUT.tilapiaRoutes) for (const point of route) expect(Object.isFrozen(point)).toBe(true);
    for (const route of DEEP_CANAL_2_LAYOUT.predatorRoutes) {
      expect(Object.isFrozen(route), route.id).toBe(true);
      expect(Object.isFrozen(route.waypoints), route.id).toBe(true);
      for (const point of route.waypoints) expect(Object.isFrozen(point), route.id).toBe(true);
    }
    for (const spawn of DEEP_CANAL_2_LAYOUT.movingHazards ?? []) expect(Object.isFrozen(spawn), spawn.id).toBe(true);
    for (const patch of DEEP_CANAL_2_LAYOUT.hazards) {
      expect(Object.isFrozen(patch), patch.id).toBe(true);
      expect(Object.isFrozen(patch.shape), patch.id).toBe(true);
    }
    for (const boat of DEEP_CANAL_2_LAYOUT.bailingBoats ?? []) {
      expect(Object.isFrozen(boat), boat.id).toBe(true);
      expect(Object.isFrozen(boat.bailing), boat.id).toBe(true);
      expect(Object.isFrozen(boat.bailing.landing), boat.id).toBe(true);
    }
    for (const wander of DEEP_CANAL_2_LAYOUT.mobileSnacks?.wanders ?? []) {
      expect(Object.isFrozen(wander), `tadpole at ${wander.points[0].x}`).toBe(true);
      for (const point of wander.points) expect(Object.isFrozen(point), `tadpole at ${wander.points[0].x}`).toBe(true);
    }
    for (const home of DEEP_CANAL_2_LAYOUT.mobileSnacks?.homes ?? []) {
      expect(Object.isFrozen(home), `shrimp at ${home.points[0].x}`).toBe(true);
      for (const spot of home.points) expect(Object.isFrozen(spot), `shrimp at ${spot.x}`).toBe(true);
    }
  });

  it('has 48 snacks (8 worms, 7 bugs, 16 tadpoles and 17 shrimp), 2 tilapia, 6 carp, 2 black bass, 2 anchor drops, 2 mud seeps, 3 murky patches, 2 bailing boats and 14 treasure slots, and no elements, reeds or pads', () => {
    for (const seed of ALL_SEEDS) {
      const layout = deepCanal2(seed);
      expect(layout.collectibles).toHaveLength(48);
      const kinds = layout.collectibles.map((snack) => snack.kind);
      expect(['worm', 'bug', 'tadpole', 'shrimp'].map((kind) => kinds.filter((each) => each === kind).length)).toEqual([8, 7, 16, 17]);
      expect(layout.elements).toEqual([]);
      expect(layout.reeds).toEqual([]);
      expect(layout.pads).toEqual([]);
    }
    expect(zone.tilapiaRoutes.map((route) => route.id)).toEqual(TILAPIA_IDS);
    expect(zone.predatorRoutes.map((route) => [route.id, route.species])).toEqual([
      ...CARP_IDS.map((id) => [id, DEEP_CANAL_2_CARP]),
      ...BASS_IDS.map((id) => [id, DEEP_CANAL_2_BASS]),
    ]);
    expect(movers.map((spawn) => [spawn.id, spawn.type])).toEqual([
      [MOVER_IDS[0], ANCHOR_DROP],
      [MOVER_IDS[1], ANCHOR_DROP],
      [MOVER_IDS[2], MUD_SEEP],
      [MOVER_IDS[3], MUD_SEEP],
    ]);
    expect(zone.hazards.map((hazard) => [hazard.id, hazard.type])).toEqual(PATCH_IDS.map((id) => [id, MURKY_WATER]));
    expect(patches).toHaveLength(3);
    expect(boats.map((boat) => [boat.id, boat.type])).toEqual(BOAT_IDS.map((id) => [id, BAILING_BUCKET]));
    expect(DEEP_CANAL_2_LAYOUT.padCount).toBe(0);
    expect(DEEP_CANAL_2_LAYOUT.tilapia).toBe(DEEP_CANAL_2_TILAPIA);
    expect(tripTreasureTuning(DEEP_CANAL_2_AREA_ID).slots).toBe(14);
    expect(DEEP_CANAL_2_LAYOUT.treasures).toBe(DEEP_CANAL_2_TREASURES);
    expect(DEEP_CANAL_2_TREASURES).toHaveLength(13);
  });

  it("plays its tilapia one step up the ladder: a 460 px/s strike reaching 160 px, a 1.7 s cooldown and a 65 px/s patrol, Area 8's other values and chase", () => {
    expect(DEEP_CANAL_2_TILAPIA).toEqual({ ...DEEP_CANAL_TILAPIA, lungeSpeed: 460, lungeRange: 160, cooldown: 1.7, patrolSpeed: 65 });
    expect(DEEP_CANAL_2_TILAPIA.chase).toBe(DEEP_CANAL_TILAPIA.chase);
    expect(DEEP_CANAL_2_TILAPIA.windup).toBe(DEEP_CANAL_2_TILAPIA.minWindup);
    expect(() => tunedSpecies(TILAPIA_SPECIES, DEEP_CANAL_2_TILAPIA)).not.toThrow();
  });

  it("plays its common carp one ladder step up from Area 8's: a 1.6 s cooldown and a 60 px/s patrol, Area 8's other values and chase (ND-3)", () => {
    expect(DEEP_CANAL_2_CARP.id).toBe(CARP_SPECIES.id);
    expect(DEEP_CANAL_2_CARP.tuning).toEqual({ ...DEEP_CANAL_CARP.tuning, cooldown: 1.6, patrolSpeed: 60 });
    expect(DEEP_CANAL_2_CARP.tuning.chase).toBe(DEEP_CANAL_CARP.tuning.chase);
    for (const route of routesOf(zone, CARP_SPECIES.id)) expect(route.species, route.id).toBe(DEEP_CANAL_2_CARP);
  });

  it("plays its black bass with a 500 px/s strike, a 1.4 s cooldown and a 65 px/s patrol, Area 8's other values and the bass chase", () => {
    expect(DEEP_CANAL_2_BASS.id).toBe(BLACK_BASS_SPECIES.id);
    expect(DEEP_CANAL_2_BASS.rules).toEqual(BLACK_BASS_SPECIES.rules);
    expect(DEEP_CANAL_2_BASS.tuning).toEqual({ ...BLACK_BASS, lungeSpeed: 500, cooldown: 1.4, patrolSpeed: 65, chase: BLACK_BASS_CHASE });
    expect(DEEP_CANAL_2_BASS.tuning).toEqual({ ...DEEP_CANAL_BASS.tuning, lungeSpeed: 500, cooldown: 1.4, patrolSpeed: 65 });
    for (const route of routesOf(zone, BLACK_BASS_SPECIES.id)) expect(route.species, route.id).toBe(DEEP_CANAL_2_BASS);
  });

  it('adds exactly one new threat, the murky water, and one new element, the bailing bucket; the anchor drop and the mud seep are danger parts', () => {
    expect(newThingsByArea().find((things) => things.areaId === DEEP_CANAL_2_AREA_ID)).toEqual({
      areaId: DEEP_CANAL_2_AREA_ID,
      threats: ['murky-water'],
      elements: ['bailing-bucket'],
    });
    expect(ANCHOR_DROP.dangerPart).toBe(true);
    expect(MUD_SEEP.dangerPart).toBe(true);
  });

  it('names the tilapia, the carp, the black bass, the murky water, the anchor drop and the mud seep as its threats, with their cards, then the tadpole and shrimp cards, and no card for the bailing bucket', () => {
    const threats = ['tilapia', 'carp', 'black-bass', 'murky-water', 'anchor-drop', 'mud-seep'];
    const cards = [TILAPIA_FACT, CARP_FACT, BLACK_BASS_FACT, MURKY_WATER_FACT, ANCHOR_DROP_FACT, MUD_SEEP_FACT];
    expect(threatIds(DEEP_CANAL_2_LAYOUT)).toEqual(threats);
    expect(threatIds(zone)).toEqual(threats);
    expect(threatFactCards(DEEP_CANAL_2_LAYOUT)).toEqual(cards);
    const expected = { ids: [...threats, 'tadpole', 'shrimp'], cards: [...cards, TADPOLE_FACT, SHRIMP_FACT] };
    expect(sourceFactCards(DEEP_CANAL_2_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(zone)).toEqual(expected);
    expect(BAILING_BUCKET.fact).toBeUndefined();
  });

  it('holds the Dirty water, Anchors and Mud bubbles fact cards', () => {
    const titles = sourceFactCards(DEEP_CANAL_2_LAYOUT).cards.map((card) => card.title);
    expect(titles).toEqual(expect.arrayContaining(['Dirty water', 'Anchors', 'Mud bubbles']));
  });

  it('is in the deep canal habitat, numbered 9, after Area 8, with the Little bailing bucket as its Rare special treasure, no look of its own, no darters and a 30% stranding chance', () => {
    expect(DEEP_CANAL_2_AREA.layout).toBe(DEEP_CANAL_2_LAYOUT);
    expect(DEEP_CANAL_2_AREA.number).toBe(9);
    expect(DEEP_CANAL_2_AREA.number).toBe(DEEP_CANAL_AREA.number + 1);
    expect(DEEP_CANAL_2_AREA.habitatId).toBe(DEEP_CANAL_HABITAT.id);
    expect(DEEP_CANAL_2_AREA.specialTreasureId).toBe('deep-canal/little-bailing-bucket');
    expect(DEEP_CANAL_2_TREASURES.find((treasure) => treasure.id === DEEP_CANAL_2_AREA.specialTreasureId)?.rarity).toBe('rare');
    expect(DEEP_CANAL_2_AREA.look).toBeUndefined();
    expect(DEEP_CANAL_2_AREA.snackDart).toBeUndefined();
    expect(areaStrandingChance(DEEP_CANAL_2_AREA)).toBe(0.3);
    expect(Object.isFrozen(DEEP_CANAL_2_AREA)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_2_AREA.exit)).toBe(true);
    expect(Object.isFrozen(DEEP_CANAL_2_AREA.snackDrift)).toBe(true);
  });

  it('plays Trajinera Waltz, the deep canal cue, with no new cue (M3)', () => {
    expect(tripCueFor(DEEP_CANAL_2_AREA)).toBe(TRAJINERA_WALTZ);
  });

  it('adds two Dream colours, one of them a Legendary sheen, and every new patterned or sheen colour is Legendary (B3)', () => {
    const shells = DEEP_CANAL_2_TREASURES.filter((treasure) => treasure.category === 'paintShell');
    expect(shells.length).toBeGreaterThanOrEqual(2);
    expect(shells.some((shell) => shell.rarity === 'legendary' && isPatternedOrSheen(shell))).toBe(true);
    for (const shell of shells.filter(isPatternedOrSheen)) expect(shell.rarity, shell.id).toBe('legendary');
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = deepCanal2(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.movingHazards).toEqual(zone.movingHazards);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.bailingBoats).toEqual(zone.bailingBoats);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.bankOverhangs).toEqual(zone.bankOverhangs);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
    }
  });
});

describe('Area 9 hub (the area shape rule)', () => {
  it('puts the Home Spot mid-area, in the middle screen column, with the safe area its column from the surface to the bed', () => {
    expect(zone.safeArea).toEqual({ x0: 2015, x1: 2305, y0: SURF, y1: 2 * WORLD_H });
    expect(Math.floor(zone.homeSpot.x / SCREEN_W)).toBe(Math.floor(zone.chunks / 2));
    expect(zone.homeSpot.x).toBe(zone.width / 2);
    expect(zone.homeSpot.x - zone.homeSpot.radius).toBeGreaterThan(safeArea.x0);
    expect(zone.homeSpot.x + zone.homeSpot.radius).toBeLessThan(safeArea.x1);
  });

  it('opens a west branch and an east branch from the hub, each at least 4 screens across', () => {
    expect(safeArea.x0 - bounds.minX).toBeGreaterThanOrEqual(4 * SCREEN_W - 50);
    expect(bounds.maxX - safeArea.x1).toBeGreaterThanOrEqual(4 * SCREEN_W - 50);
  });

  it('runs the main path from the Home Spot east along the east branch, never turning back west, to the exit', () => {
    const path = zone.mainPath;
    expect(path[0]).toEqual(zone.start);
    expect(path[path.length - 1]).toEqual({ x: exit.x, y: exit.y });
    for (let i = 1; i < path.length; i++) expect(path[i].x, `point ${i}`).toBeGreaterThan(path[i - 1].x);
    for (const point of pathSamples(path, 2)) {
      expect(inBounds(point, zone), `path at ${point.x}, ${point.y}`).toBe(true);
      expect(branchOf(point), `path at ${point.x}, ${point.y}`).not.toBe('west');
    }
  });

  it('puts the exit at the end of the east branch, low, in the last screen column, with its gate on the bed (#183)', () => {
    expect(exit).toEqual({ x: 4200, y: 600, radius: 40 });
    expect(Math.floor(exit.x / SCREEN_W)).toBe(zone.chunks - 1);
    expect(branchOf(exit)).toBe('east');
    expect(zone.bedTop - exit.y).toBeLessThanOrEqual(158);
    expect(exitGateBase(exit, zone)).toEqual({ x: exit.x, y: zone.bedTop });
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
  });

  it('lets a one-leg axolotl swim the main path from the Home Spot to the exit, then home', () => {
    const arrive = (pos: Point) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius;
    const out = oneLegSeconds(zone.start, zone.mainPath.slice(1), zone, arrive);
    expect(out).toBeCloseTo(ONE_LEG_EXIT_SECONDS, 1);
    expect(out).toBeLessThan(BEAT_MAX_SECONDS);
    const home = oneLegSeconds(exit, [...zone.mainPath].reverse().slice(1), zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });
});

describe('Area 9 exit', () => {
  it('keeps the exit out of every predator strike, clear of every anchor drop and mud seep, the current, every murky patch and every catch box', () => {
    for (const { route, strike } of strikeRoutes(zone)) expect(routeLoopDistance(exit, route.waypoints), route.id).toBeGreaterThan(strike + exit.radius);
    for (const spawn of movers) expect(shapeDistance(exit, movingHazardSweep(spawn)), spawn.id).toBeGreaterThan(exit.radius + spawn.type.touchReach);
    for (const current of zone.currents) expect(shapeDistance(exit, rectOf(current))).toBeGreaterThan(exit.radius);
    for (const patch of patches) expect(shapeDistance(exit, patch.shape), patch.id).toBeGreaterThan(exit.radius);
    for (const box of catchBoxes) expect(shapeDistance(exit, box)).toBeGreaterThan(exit.radius);
  });

  it.each(ALL_SEEDS)('keeps the exit clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    for (const spot of deepCanal2(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(exit.radius + FINDS.pickupRadius);
    }
  });
});

describe('Area 9 danger bar', () => {
  it('meets the full danger bar with the whole-water test on the default seed', () => {
    expect(meetsWholeWaterDangerBar(zone)).toBe(true);
  });

  it.each(EXTRA_SEEDS)('builds the same threats and water as the default seed for seed %i, so the bar holds for it too', (seed) => {
    const layout = deepCanal2(seed);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.movingHazards).toEqual(zone.movingHazards);
    expect(layout.safeArea).toEqual(zone.safeArea);
  });

  it('has 14 moving threats for its 18 screens, ceil(0.75 x 18), 3 predator types and 2 moving hazard types, and every predator chases', () => {
    const screens = (zone.width / SCREEN_W) * (zone.height / WORLD_H);
    expect(screens).toBe(18);
    expect(movingThreatCount(zone)).toBe(14);
    expect(movingThreatCount(zone)).toBe(Math.ceil(0.75 * screens));
    expect(zone.tilapiaRoutes.length + zone.predatorRoutes.length).toBe(10);
    expect(movers).toHaveLength(4);
    expect(predatorTypeCount(zone)).toBe(3);
    expect(movingHazardTypeCount(zone)).toBe(2);
    expect(zone.tilapia?.chase).toBeDefined();
    for (const route of zone.predatorRoutes) expect(route.species.tuning.chase, route.id).toBeDefined();
  });

  it('never counts a murky patch or a bailing boat as a moving threat', () => {
    const bare: ZoneLayout = { ...zone, hazards: [], bailingBoats: [] };
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

  it("never leaves a quiet swim longer than one screen across on either branch, counting only that branch's threats", () => {
    const west = longestQuietSwim(branchGeometry(zone, 'west'));
    const east = longestQuietSwim(branchGeometry(zone, 'east'));
    expect(west?.length).toBeCloseTo(BRANCH_QUIET_SWIM.west, 1);
    expect(east?.length).toBeCloseTo(BRANCH_QUIET_SWIM.east, 1);
    for (const swim of [west, east]) expect(swim?.length ?? 0).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('keeps every predator loop wholly on one branch: one tilapia, one bass and three carp on each', () => {
    const branches = Object.fromEntries([...zone.tilapiaRoutes, ...zone.predatorRoutes].map((route) => [route.id, loopBranch(route.waypoints)]));
    expect(branches).toEqual({
      'tilapia-0': 'west',
      'tilapia-1': 'east',
      'carp-0': 'west',
      'carp-1': 'west',
      'carp-2': 'west',
      'carp-3': 'east',
      'carp-4': 'east',
      'carp-5': 'east',
      'bass-0': 'west',
      'bass-1': 'east',
    });
    expect(movers.map((spawn) => branchOf({ x: spawn.x, y: SURF }))).toEqual(['east', 'east', 'west', 'east']);
  });

  it('patrols every depth: each tilapia, carp and bass loop reaches 24 px into two bands, and each species together reaches all three', () => {
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
  });

  it('has surface danger and keeps the floor lane quiet for no more than one screen across', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBeCloseTo(FLOOR_QUIET_STRETCH, 1);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('has 6 carp for its 18 screens, the carp target', () => {
    expect(carpTarget(18)).toBe(6);
    expect(carpCount(zone)).toBe(6);
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

describe('Area 9 anchor drops and mud seeps', () => {
  it('lowers each anchor from the surface 140 px, and sends each mud seep 200 px up from the bed, within their depth limits', () => {
    for (const spawn of movers.filter((each) => each.type === ANCHOR_DROP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(SURF);
      expect(movingHazardDirection(spawn), spawn.id).toBe(1);
      expect(movingHazardDepth(spawn), spawn.id).toBe(140);
      expect(movingHazardDepth(spawn), spawn.id).toBeLessThanOrEqual(320);
    }
    for (const spawn of movers.filter((each) => each.type === MUD_SEEP)) {
      expect(movingHazardBaseY(spawn), spawn.id).toBe(zone.bedTop);
      expect(movingHazardDirection(spawn), spawn.id).toBe(-1);
      expect(movingHazardDepth(spawn), spawn.id).toBe(200);
      expect(movingHazardDepth(spawn), spawn.id).toBeLessThanOrEqual(260);
    }
  });

  it('keeps every sweep in the water, out of the safe area, clear of every murky patch and every catch box', () => {
    for (const spawn of movers) {
      const sweep = movingHazardSweep(spawn);
      expect(rectDistance(sweep, rectOf(safeArea)), spawn.id).toBeGreaterThan(spawn.type.touchReach);
      expect(sweep.x0, spawn.id).toBeGreaterThan(bounds.minX);
      expect(sweep.x1, spawn.id).toBeLessThan(bounds.maxX);
      for (const patch of patches) expect(rectDistance(sweep, patch.shape), `${spawn.id} to ${patch.id}`).toBeGreaterThan(0);
      for (const box of catchBoxes) expect(rectDistance(sweep, box), spawn.id).toBeGreaterThan(spawn.type.touchReach);
    }
  });
});

describe('Area 9 murky water (issue #107, ND-1)', () => {
  it('has three fixed murky patches, each costing no leg on touch, in the water and out of the safe area', () => {
    for (const patch of patches) {
      expect(patch.type.costsLeg, patch.id).toBe(false);
      expect(patch.drift, patch.id).toBeUndefined();
      expect(rectDistance(patch.shape, rectOf(safeArea)), patch.id).toBeGreaterThan(0);
      expect(patch.shape.x0, patch.id).toBeGreaterThanOrEqual(0);
      expect(patch.shape.x1, patch.id).toBeLessThanOrEqual(zone.width);
    }
  });

  it('is never a touch hit, a hiding spot threat (B10) or a gap obstacle', () => {
    expect(zoneThreats(zone)).toHaveLength(zoneThreats({ ...zone, hazards: [] }).length);
    const ids = obstaclesOf(zone).map((obstacle) => obstacle.id);
    for (const id of PATCH_IDS) expect(ids).not.toContain(id);
  });

  it('puts two patches on the main path, each at most 200 px wide, which a one-leg axolotl crosses along the path in under 3 s', () => {
    expect(routePatches.map((patch) => patch.id)).toEqual(PATCH_IDS.slice(0, 2));
    const oneLegSpeed = SWIM.maxSpeed * LEGS.speedByLegs[0];
    for (const patch of routePatches) {
      const width = patch.shape.x1 - patch.shape.x0;
      expect(width, patch.id).toBeLessThanOrEqual(ROUTE_PATCH_MAX_WIDTH);
      expect(murkyCrossSeconds(width), patch.id).toBeLessThan(MURKY_WATER_TIMING.legAt);
      expect(pathLengthInside(patch.shape) / oneLegSpeed, patch.id).toBeLessThan(MURKY_WATER_TIMING.legAt);
    }
  });

  it('puts the third, wider patch over the sunken hull cave, an optional treasure dead end off the main path', () => {
    const [, , wide] = patches;
    expect(wide.shape.x1 - wide.shape.x0).toBeGreaterThan(ROUTE_PATCH_MAX_WIDTH);
    expect(branchOf({ x: wide.shape.x1, y: wide.shape.y0 })).toBe('west');
    expect(rectDistance(wide.shape, rectOf(zone.cave))).toBe(0);
    for (const spot of zone.spots.filter((each) => each.cover === 'cave')) expect(insideMurky(spot, [wide]), spot.id).toBe(true);
    for (const point of pathSamples(zone.mainPath, 2)) expect(insideMurky(point, [wide])).toBe(false);
  });
});

describe('Area 9 bailing buckets (issue #107, ND-2)', () => {
  it('moors two boats in the east branch, out of step by half the 7 s cycle, each catch box under its hull at the surface', () => {
    expect(BAILING_BUCKET.period).toBe(7);
    expect(boats.map((boat) => boat.offset)).toEqual([0, 3.5]);
    expect(boats[1].offset - boats[0].offset).toBe(BAILING_BUCKET.period / 2);
    for (const [index, boat] of boats.entries()) {
      const box = catchBoxes[index];
      expect(branchOf({ x: boat.bailing.x0, y: SURF }), boat.id).toBe('east');
      expect(box.x1 - box.x0, boat.id).toBe(BAILING_BUCKETS.catchWidth);
      expect([box.y0, box.y1], boat.id).toEqual([SURF, SURF + BAILING_BUCKETS.catchDepth]);
      expect(box.x0, boat.id).toBeGreaterThanOrEqual(boat.bailing.x0);
      expect(box.x1, boat.id).toBeLessThanOrEqual(boat.bailing.x1);
    }
  });

  it('runs the main path through every catch box, so the bucket is timed', () => {
    for (const box of catchBoxes) expect(pathSamples(zone.mainPath, 2).some((point) => inRect(point, box))).toBe(true);
  });

  it('is never a threat: no hazard, moving hazard or predator, so the danger bar never counts it', () => {
    expect(zone.hazards.some((hazard) => BOAT_IDS.includes(hazard.id))).toBe(false);
    expect(movers.some((spawn) => BOAT_IDS.includes(spawn.id))).toBe(false);
    expect(threatIds(zone)).not.toContain(BAILING_BUCKET.id);
  });

  it('lands each toss about 3 screens back toward the hub, out of the safe area, every predator reach with its leash, every sweep, every murky patch and every catch box', () => {
    for (const boat of boats) {
      const { landing } = boat.bailing;
      const back = (boat.bailing.bucketX - landing.x) / SCREEN_W;
      expect(back, boat.id).toBeGreaterThanOrEqual(LANDING_SCREENS_BACK.least);
      expect(back, boat.id).toBeLessThanOrEqual(LANDING_SCREENS_BACK.most);
      expect(branchOf(landing), boat.id).toBe('east');
      expect(inBounds(landing, zone), boat.id).toBe(true);
      expect(inSafeArea(landing, zone.safeArea), boat.id).toBe(false);
      expect(reachMargin(landing, zone), boat.id).toBeGreaterThan(0);
      expect(insideMurky(landing, patches), boat.id).toBe(false);
      for (const box of catchBoxes) expect(inRect(landing, box), boat.id).toBe(false);
    }
  });
});

describe('Area 9 hiding spots (B5, B6, B10)', () => {
  it.each(ALL_SEEDS)('match their labels against every threat, with the turn clearance, for seed %i', (seed) => {
    const layout = deepCanal2(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('deep-canal-2/spot-'), spot.id).toBe(true);
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

  it('has 6 Common, 5 Rare, 3 Epic and 4 Legendary spots, every pool larger than its Area 9 treasures', () => {
    expect(RARITIES.map((rarity) => zone.spots.filter((spot) => spot.rarity === rarity).length)).toEqual([6, 5, 3, 4]);
    expect(RARITIES.map((rarity) => DEEP_CANAL_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    for (const rarity of RARITIES) {
      const treasures = DEEP_CANAL_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      expect(zone.spots.filter((spot) => spot.rarity === rarity).length, rarity).toBeGreaterThan(treasures);
    }
    for (const find of zone.finds) expect(find.pool.length, find.id).toBeGreaterThan(0);
  });

  it('hides Commons under the moored rows by the main path in the east branch, and Rares under the moored rows of the west branch', () => {
    const shallow = zone.spots.filter((spot) => spot.rarity === 'common' || spot.rarity === 'rare');
    for (const spot of shallow) {
      expect(coversAt(spot, zone), spot.id).toEqual(['bank']);
      expect(spot.container, spot.id).toBe(false);
      expect(branchOf(spot), spot.id).toBe(spot.rarity === 'common' ? 'east' : 'west');
      const near = distanceToPath(spot, zone.mainPath) <= MAIN_PATH_REACH;
      expect(near, spot.id).toBe(spot.rarity === 'common');
    }
    for (const moored of zone.bankOverhangs ?? []) expect(moored.y0, 'moored rows float at the surface').toBe(SURF);
  });

  it('puts an open Legendary spot and an Epic spot in the sunken hull cave, a dead end on the west bed by carp-1', () => {
    const cave = zone.spots.filter((spot) => spot.cover === 'cave');
    expect(cave.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [330, 655, 'legendary', false],
      [470, 650, 'epic', false],
    ]);
    expect(zone.cave).toEqual({ id: 'deep-canal-2/cave', x0: 280, x1: 480, y0: 590, y1: zone.bedTop });
    expect(branchOf({ x: zone.cave.x1, y: zone.cave.y0 })).toBe('west');
    const [carp] = routesOf(zone, CARP_SPECIES.id).filter((route) => route.id === 'carp-1');
    expect(routeLoopDistance(cave[0], carp.waypoints)).toBeLessThanOrEqual(DEEP_CANAL_2_CARP.tuning.lungeRange / 2);
  });

  it('puts three open Legendary spots just past the side-canal inflow, within half the bass strike of bass-0, and two Epic spots past it farther off', () => {
    const past = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect(past.map((spot) => [spot.x, spot.y, spot.rarity, spot.container])).toEqual([
      [800, 490, 'legendary', false],
      [800, 550, 'legendary', false],
      [800, 610, 'legendary', false],
      [745, 520, 'epic', false],
      [745, 580, 'epic', false],
    ]);
    const [bass] = routesOf(zone, BLACK_BASS_SPECIES.id);
    expect(bass.id).toBe('bass-0');
    for (const spot of past) {
      expect(coversAt(spot, zone), spot.id).toEqual(['pastCurrent']);
      expect(branchOf(spot), spot.id).toBe('west');
      const away = routeLoopDistance(spot, bass.waypoints);
      if (spot.rarity === 'legendary') expect(away, spot.id).toBeLessThanOrEqual(DEEP_CANAL_2_BASS.tuning.lungeRange / 2);
      else expect(away, spot.id).toBeGreaterThan(DEEP_CANAL_2_BASS.tuning.lungeRange / 2);
    }
  });

  it('has no Dash pot: every Legendary spot is in the open, deep and near a threat, so the Legendary rule needs none (ADR 0032)', () => {
    expect(zone.spots.filter((spot) => spot.container)).toEqual([]);
    for (const spot of zone.spots.filter((each) => each.rarity === 'legendary')) {
      expect(['cave', 'pastCurrent'], spot.id).toContain(spot.cover);
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = deepCanal2(seed);
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
});

describe('Area 9 placing treasure (B4)', () => {
  const tuning = tripTreasureTuning(DEEP_CANAL_2_AREA_ID);
  const options = { extras: [DEEP_CANAL_2_AREA.specialTreasureId], tuning, mainPath: zone.mainPath, threats: zoneThreats(zone) };

  it('places every trip without throwing: the 14 slots, the lost treasures and the Little bailing bucket', () => {
    const all = DEEP_CANAL_2_TREASURES.map((treasure) => treasure.id);
    for (const tripSeed of TRIP_SEEDS) {
      const fresh = placeTreasures(zone.finds, zone.spots, [], tripSeed, options);
      expect(fresh.map((find) => find.id)).toContain(DEEP_CANAL_2_AREA.specialTreasureId);
      const lost = placeTreasures(zone.finds, zone.spots, [], tripSeed, { ...options, mustPlace: all });
      expect(lost).toHaveLength(all.length);
      expect(new Set(lost.map((find) => find.spotId)).size).toBe(all.length);
    }
  });

  it('puts the 3 Legendaries in 3 distinct Legendary spots when all 13 treasures must be placed, the cave spot on some trips', () => {
    const all = DEEP_CANAL_2_TREASURES.map((treasure) => treasure.id);
    const legendaryIds = DEEP_CANAL_2_TREASURES.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id);
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

  it('leaves few of the 14 slots empty over 200 fresh trips', () => {
    const empty = TRIP_SEEDS.map((tripSeed) => tuning.slots + 1 - placeTreasures(zone.finds, zone.spots, [], tripSeed, options).length);
    const mean = empty.reduce((sum, count) => sum + count, 0) / empty.length;
    expect(Math.max(...empty)).toBe(EMPTY_SLOTS.most);
    expect(mean).toBeCloseTo(EMPTY_SLOTS.mean, 1);
  });
});

describe('Area 9 side-canal inflow and stranding places', () => {
  it('flows gently to the left at 72 px/s on the west bed, off the main path', () => {
    expect(zone.currents).toHaveLength(1);
    const current = zone.currents[0];
    expect(current.force).toEqual({ x: -72, y: 0 });
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(current.force.x)).toBe(18);
    expect(branchOf({ x: current.x1, y: current.y0 })).toBe('west');
    for (const point of pathSamples(zone.mainPath, 4)) expect(isInsideCurrent(point, current)).toBe(false);
    for (const patch of patches) expect(rectDistance(rectOf(current), patch.shape), patch.id).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)(
    'keeps every stranding place 80 px from every route, clear of every sweep, the spots, the current, every murky patch and every catch box for seed %i',
    (seed) => {
      const layout = deepCanal2(seed);
      expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `deep-canal-2/strand-${n}`));
      expect(layout.strandingPlaces.map((place) => branchOf(place))).toEqual(['west', 'west', 'west', 'east', 'east', 'east']);
      for (const place of layout.strandingPlaces) {
        expect(inBounds(place, layout), place.id).toBe(true);
        expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
        expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
        expect(insideMurky(place, patches), place.id).toBe(false);
        for (const box of catchBoxes) expect(inRect(place, box), place.id).toBe(false);
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

describe('Area 9 gaps and routes (the level layout ladder)', () => {
  it("swims the main path under anchor-drop-1, over tilapia-1, through a gap no wider than Area 8's narrowest and never under the safe passing width", () => {
    const narrowest = narrowestPathGap(zone);
    expect(narrowest.between).toBe('deep-canal-2/anchor-drop-1 and tilapia-1');
    expect(narrowest.width).toBeCloseTo(42, 9);
    expect(SAFE_PASSING_WIDTH).toBe(36);
    expect(narrowest.width).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('branches west and east from the hub, with two dead ends holding treasure off the main path: the sunken hull cave and the water past the inflow', () => {
    const caveSpots = zone.spots.filter((spot) => spot.cover === 'cave');
    const pastSpots = zone.spots.filter((spot) => spot.cover === 'pastCurrent');
    expect([caveSpots.length, pastSpots.length]).toEqual([2, 5]);
    for (const spot of [...caveSpots, ...pastSpots]) {
      expect(distanceToPath(spot, zone.mainPath), spot.id).toBeGreaterThan(MAIN_PATH_REACH);
      expect(branchOf(spot), spot.id).toBe('west');
    }
    expect(zone.spots.filter((spot) => branchOf(spot) === 'west').length).toBeGreaterThan(zone.spots.filter((spot) => branchOf(spot) === 'east').length);
  });

  it.each(ALL_SEEDS)('puts snacks on both branches for seed %i', (seed) => {
    const layout = deepCanal2(seed);
    for (const branch of ['west', 'east'] as const) {
      expect(layout.collectibles.filter((snack) => branchOf(snack) === branch).length, branch).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('Area 9 snacks', () => {
  const drift = DEEP_CANAL_2_AREA.snackDrift;
  const surfacePeak = 80 + 1.6 + 0.8;

  it.each(SNACK_SEEDS)('build and start at least SNACK_HAZARD_CLEARANCE from every sweep, every murky patch and every catch box for seed %i', (seed) => {
    const layout = deepCanal2(seed);
    expect(layout.collectibles).toHaveLength(48);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
      for (const patch of patches) expect(shapeDistance(snack, patch.shape), `${snack.id} to ${patch.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      for (const box of catchBoxes) expect(shapeDistance(snack, box), `${snack.id} seed ${seed}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      if (snack.kind !== 'worm' && snack.kind !== 'bug') continue;
      for (const spawn of layout.movingHazards ?? []) expect(shapeDistance(snack, movingHazardSweep(spawn)), `${snack.id} to ${spawn.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
    }
  });

  it.each(ALL_SEEDS)('put at least snacksInCurrent (4) worms or bugs in the inflow, and only worms and bugs in it, for seed %i', (seed) => {
    const layout = deepCanal2(seed);
    const inside = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(inside.length).toBeGreaterThanOrEqual(DEEP_CANAL_2_LAYOUT.snacksInCurrent);
    expect(inside.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = deepCanal2(seed);
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

  it('drift a little faster than Area 8, slower than a one-leg axolotl swims against the inflow, and at most half the magnet pull', () => {
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - Math.abs(zone.currents[0].force.x);
    expect(drift).toEqual({ ...DEEP_CANAL_AREA.snackDrift, periodX: 6.8, periodY: 5.44 });
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('has no one-time darters: no dart rule, and its shrimp replace them', () => {
    expect(oneTimeDarts(DEEP_CANAL_2_AREA, zone)).toBeNull();
  });

  it.each(ALL_SEEDS)(
    'gives every shrimp a clear place, and every hop spot of its home a flick landing isShrimpFlickLandingClear allows in at least one of 8 directions, for seed %i',
    (seed) => {
      const layout = deepCanal2(seed);
      const avoid = mobileSnackAvoid(layout);
      const rule = layout.mobileSnacks?.shrimp;
      if (!rule) throw new Error('Area 9 has no shrimp rule');
      const homes = layout.mobileSnacks?.homes ?? [];
      expect(homes).toHaveLength(17);
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

describe('Area 9 mobile snacks', () => {
  const mix = zone.mobileSnacks;
  const drift = DEEP_CANAL_2_AREA.snackDrift;

  it('meets the later row of the snack ramp: 33 of its 48 snacks mobile, 68.75%, at most 0.7, its tadpoles at 72 px/s', () => {
    expect(meetsSnackRamp(9, DEEP_CANAL_2_LAYOUT)).toBe(true);
    expect(mix?.tadpole).toEqual({ speed: 72 });
    const mobile = (mix?.wanders.length ?? 0) + (mix?.homes.length ?? 0);
    expect(mobile).toBe(33);
    const share = mobile / zone.collectibles.length;
    expect(share).toBe(0.6875);
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask, on the layout and on the built zone (meetsSnackMotion)', () => {
    expect(meetsSnackMotion(DEEP_CANAL_2_LAYOUT)).toBe(true);
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
      for (const leg of legs) {
        expect(leg, label).toBeGreaterThanOrEqual(TADPOLES.minLegSeconds * speed);
        expect(leg, label).toBeLessThanOrEqual(TADPOLES.maxLegSeconds * speed);
      }
      const lapSeconds = legs.reduce((sum, leg) => sum + leg, 0) / speed;
      expect(lapSeconds, label).toBeLessThanOrEqual(TADPOLES.maxLapSeconds);
      expect(wander.offset, label).toBeCloseTo((index * lapSeconds) / 16, 9);
    }
  });

  it('gives every tadpole a home box 320 to 480 px wide and 150 to 360 px tall, keeping to one branch, on both branches', () => {
    const branches = new Set<string>();
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      const box = homeBoxOf(wander.points);
      expect(box.x1 - box.x0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
      const branch = loopBranch(wander.points);
      expect(['west', 'east'], label).toContain(branch);
      branches.add(branch);
    }
    expect([...branches].sort()).toEqual(['east', 'west']);
  });

  it('keeps every tadpole loop and every shrimp home out of the inflow, every murky patch and every catch box, by SNACK_HAZARD_CLEARANCE from the patches and boxes', () => {
    for (const wander of mix?.wanders ?? []) {
      const label = `loop at ${wander.points[0].x}, ${wander.points[0].y}`;
      for (const box of legBoxesOf(wander.points)) {
        for (const current of zone.currents) expect(rectDistance(box, rectOf(current)), label).toBeGreaterThan(0);
        for (const patch of patches) expect(rectDistance(box, patch.shape), `${label} to ${patch.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
        for (const catchBox of catchBoxes) expect(rectDistance(box, catchBox), label).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
    for (const home of mix?.homes ?? []) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      for (const spot of home.points) {
        const box = shrimpBox(spot, drift);
        for (const current of zone.currents) expect(rectDistance(box, rectOf(current)), label).toBeGreaterThan(0);
        for (const patch of patches) expect(rectDistance(box, patch.shape), `${label} to ${patch.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
        for (const catchBox of catchBoxes) expect(rectDistance(box, catchBox), label).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it('lets a one-leg axolotl catch every tadpole within 20 s (the one-leg catch proof)', () => {
    const rule = mix?.tadpole;
    for (const wander of mix?.wanders ?? []) {
      expect(rule && oneLegCatchesTadpole(rule, wander, bounds), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
  });

  it("gives its seventeen shrimp Area 8's shrimp rule, on homes of 3 hop spots in a box at most 200 x 160 px, on both branches", () => {
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 1.2, flickDistance: 60, flickSpeed: 150 });
    expect(mix?.shrimp).toEqual(DEEP_CANAL_LAYOUT.mobileSnacks?.shrimp);
    const homes = mix?.homes ?? [];
    expect(homes).toHaveLength(17);
    for (const home of homes) {
      const label = `home at ${home.points[0].x}, ${home.points[0].y}`;
      expect(home.points, label).toHaveLength(3);
      const box = homeBoxOf(home.points);
      expect(box.x1 - box.x0, label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(box.y1 - box.y0, label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
    expect(new Set(homes.map((home) => branchOf(home.points[0])))).toEqual(new Set(['west', 'east']));
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i', (seed) => {
    const layout = deepCanal2(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const wander of layout.mobileSnacks?.wanders ?? []) expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    for (const home of layout.mobileSnacks?.homes ?? []) expect(shrimpHomeClear(home, drift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
  });

  it('pulls its snacks with the Snack magnet at 1.2 times the tadpole speed, 86.4 px/s', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBeCloseTo(1.2 * 72, 9);
  });
});

describe('Area 9 difficulty', () => {
  it('is harder than Area 8: more snacks, faster drift, more slots, stronger tilapia, carp and bass, and more moving threats', () => {
    expect(zone.collectibles.length).toBeGreaterThan(area8.collectibles.length);
    expect(snackDriftMaxSpeed(DEEP_CANAL_2_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(DEEP_CANAL_AREA.snackDrift));
    expect(tripTreasureTuning(DEEP_CANAL_2_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(DEEP_CANAL_AREA.id).slots);
    expect(DEEP_CANAL_2_TILAPIA.lungeRange).toBeGreaterThan(DEEP_CANAL_TILAPIA.lungeRange);
    expect(DEEP_CANAL_2_TILAPIA.cooldown).toBeLessThan(DEEP_CANAL_TILAPIA.cooldown);
    expect(DEEP_CANAL_2_CARP.tuning.cooldown).toBeLessThan(DEEP_CANAL_CARP.tuning.cooldown);
    expect(DEEP_CANAL_2_CARP.tuning.patrolSpeed).toBeGreaterThan(DEEP_CANAL_CARP.tuning.patrolSpeed);
    expect(DEEP_CANAL_2_BASS.tuning.lungeSpeed).toBeGreaterThan(DEEP_CANAL_BASS.tuning.lungeSpeed);
    expect(DEEP_CANAL_2_BASS.tuning.cooldown).toBeLessThan(DEEP_CANAL_BASS.tuning.cooldown);
    expect(movingThreatCount(zone)).toBeGreaterThan(movingThreatCount(area8));
    expect(movingHazardTypeCount(zone)).toBeGreaterThan(movingHazardTypeCount(area8));
  });
});
