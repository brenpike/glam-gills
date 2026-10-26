import { describe, expect, it } from 'vitest';
import { POND_2_AREA, POND_AREA, sourceFactCards } from './areas';
import { POND_2_TREASURES, RARITIES } from './catalogue';
import { createCollectibles, snackDriftMaxSpeed, snackWander, snackX, snackY, wanderOffsetAlong } from './collectibles';
import {
  carpCount,
  carpTarget,
  depthBands,
  floorQuietStretch,
  hasSurfaceDanger,
  longestQuietSwim,
  meetsDepthRule,
  meetsWholeWaterRampBar,
  movingHazardTypeCount,
} from './dangerBar';
import { currentAt, reedDragAt } from './environment';
import { CARP_FACT, HERON_FACT, PLASTIC_WORM_FACT, SHRIMP_FACT, TADPOLE_FACT, TILAPIA_FACT } from './factCards';
import { hazardCentre, shapeDistance, type HazardRect } from './hazards';
import {
  PAST_CURRENT_DEPTH,
  RISK_COMMON_MARGIN,
  coversAt,
  routeDistance,
  spotMatchesLabels,
  turnDistance,
  underPad,
  zoneThreats,
} from './hiding';
import { legSwimTuning } from './legs';
import {
  meetsSnackMotion,
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileLegBoxes,
  mobileSnackClear,
  mobileSnackHardClear,
  mobileSnackShare,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpBox,
  shrimpGlideClear,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
  type MobileSnackAvoid,
  type MobileSnackMix,
} from './mobileSnacks';
import { PERK_CAPS, SNACK_MAGNET_PULL_SPEED } from './perks';
import { PLASTIC_WORM } from './plasticWorms';
import { HERON_STRETCH_Y, POND_2_AREA_ID, POND_2_CARP, POND_2_LAYOUT, POND_2_TILAPIA } from './pond2Layout';
import { POND_LAYOUT } from './pondLayout';
import { CARP_SPECIES, HERON_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies, type PredatorRoute } from './predators';
import { SNACK_DART } from './snackDart';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  CARP,
  FINDS,
  HERON,
  LEGS,
  PLASTIC_WORMS,
  RISK,
  SHRIMP,
  SNACK_REACH,
  SWIM,
  TADPOLES,
  TILAPIA,
  TILAPIA_RAMP_CHASE,
  tripTreasureTuning,
} from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  SURF,
  buildZone,
  inHomeSpot,
  inSafeArea,
  isInsideCurrent,
  swimBounds,
  type CurrentZone,
  type Point,
  type TilapiaRoute,
  type ZoneLayout,
} from './zone';

const EXTRA_SEEDS = [1, 2, 3, 42, 1234, 0xdeadbeef, 0x12345678, 987654321];
const ALL_SEEDS = [DEFAULT_ZONE_SEED, ...EXTRA_SEEDS];
const STRANDING_ROUTE_CLEARANCE = 80;
/** Least px from a plastic worm to every tilapia route: farther than a lunge can start. */
const WORM_ROUTE_CLEARANCE = TILAPIA.lungeRange;
/** Least px from a plastic worm to every carp route: farther than a carp lunge can start (issue #133, ND-2). */
const WORM_CARP_CLEARANCE = CARP.lungeRange;
/**
 * Least px from a plastic worm to every current: the farthest a queasy axolotl at the speed perk
 * cap swims before queasy time ends, plus the body centre's farthest reach to a worm it eats. A
 * queasy one-leg axolotl cannot beat the stream, so it is never queasy inside it.
 */
const WORM_CURRENT_CLEARANCE =
  PLASTIC_WORMS.queasyTime * SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100) * PLASTIC_WORMS.speedFactor +
  SNACK_REACH.headAhead +
  PLASTIC_WORM.reach;
/** Deepest point a heron can warn at: its reach below its stretch. */
const HERON_REACH_LOWEST_Y = HERON_STRETCH_Y + HERON.lungeRange;
/** Lowest axolotl centre a heron stab can hit: a stab tip at the deepest warn point hits within its hit radius. */
const HERON_HIT_LOWEST_Y = HERON_REACH_LOWEST_Y + HERON.hitRadius;
/** y of the deep lane under the heron stretches, below every stab and inside the swim bounds. */
const DEEP_LANE_Y = 280;
/** Shortest length of a heron's wading stretch, in px. */
const HERON_STRETCH_MIN = 120;
/** Longest length of a heron's wading stretch, in px. */
const HERON_STRETCH_MAX = 200;
/** Left edge of the back half of Area 3, where the herons stand. */
const BACK_HALF_X = 1440;
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
const LANE_STEP = 4;
/** Directions tried for a shrimp's flick target: every 45 degrees. */
const FLICK_DIRECTIONS = 8;
/** Longest quiet swim in px allowed by the whole-water ramp bar: one screen across (issue #133, ND-7). */
const QUIET_SWIM_LIMIT = SCREEN_W;
/** Least px from the floor carp to every heron stretch: a heron's reach (issue #133, ND-3, Q1). */
const FLOOR_CARP_HERON_CLEARANCE = HERON.lungeRange;
/** Least px from every other carp to every heron stretch: a carp lunge plus a heron's reach (issue #133, ND-3). */
const CARP_HERON_CLEARANCE = CARP.lungeRange + HERON.lungeRange;
/** Least px between two carp loops: two carp lunges (issue #133, ND-3). */
const CARP_CARP_CLEARANCE = 2 * CARP.lungeRange;
/** Least px between two tadpole home centres (issue #133, ND-6). */
const TADPOLE_HOME_SPACING = 240;
/** x span the tadpole homes share, past the safe area and before the stream (issue #133, ND-6). */
const TADPOLE_HOMES_X = [300, 1880] as const;
/** Farthest px from the exit centre to a hop spot of the shrimp by the exit (issue #133, ND-6). */
const EXIT_SHRIMP_REACH = 100;
/** Area 3's tadpole speed in px/s (issue #131, ND-9). */
const TADPOLE_SPEED = 50;
/** Px a tilapia or carp loop must reach into a depth band for the band to count: a tilapia body (issue #130, ND-5). */
const BAND_REACH = 24;
/** Most px between the samples the tadpole threat rule takes along a wander loop (issue #131, ND-7). */
const WANDER_SAMPLE_PX = 2;
/**
 * Gap in px between each two tilapia loops, measured to 0.1 px. Option A on issue #133 drops the
 * tilapia-to-tilapia spacing for Area 3, so the two loops of each pair sit 48.1 px apart.
 */
const MEASURED_TILAPIA_GAPS: Readonly<Record<string, number>> = {
  'tilapia-0 to tilapia-1': 48.1,
  'tilapia-0 to tilapia-2': 610,
  'tilapia-0 to tilapia-3': 514.2,
  'tilapia-1 to tilapia-2': 696.1,
  'tilapia-1 to tilapia-3': 600,
  'tilapia-2 to tilapia-3': 48.1,
};
/** Longest quiet swim in px in the whole water, measured (issue #133, ND-7). */
const MEASURED_QUIET_SWIM = 334.4;
/** Longest stretch in px of the floor lane with no predator in reach, measured (issue #133, ND-7). */
const MEASURED_FLOOR_STRETCH = 210;
/** Seconds each tadpole takes round its wander loop, measured to 0.1 s (issue #133, ND-6). */
const MEASURED_LAPS: readonly number[] = [19, 19.2, 18.2, 16.9];

const zone = buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED);
const pond1 = buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED);
const herons = heronRoutes(zone);
const carps = carpRoutes(zone);

function pond2(seed: number): ZoneLayout {
  return buildZone(POND_2_LAYOUT, seed);
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const along = lengthSq === 0 ? 0 : ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(point.x - (a.x + clamped * abx), point.y - (a.y + clamped * aby));
}

function loopSegments(waypoints: readonly Point[]): [Point, Point][] {
  return waypoints.map((point, i): [Point, Point] => [point, waypoints[(i + 1) % waypoints.length]]);
}

/** Least distance between two closed loops; no Area 3 loops cross, so the endpoint distances suffice. */
function routeGap(first: TilapiaRoute, second: TilapiaRoute): number {
  let gap = Infinity;
  for (const [a, b] of loopSegments(first.waypoints)) {
    for (const [c, d] of loopSegments(second.waypoints)) {
      gap = Math.min(gap, distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
    }
  }
  return gap;
}

/** Distance from a point to a current rectangle; 0 inside. */
function currentDistance(point: Point, current: CurrentZone): number {
  return shapeDistance(point, { kind: 'rect', x0: current.x0, x1: current.x1, y0: current.y0, y1: current.y1 });
}

/** The zone's heron stretches, the predator routes whose species is the heron. */
function heronRoutes(layout: ZoneLayout): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === HERON_SPECIES.id);
}

/** The zone's carp loops, the predator routes whose species is the carp (issue #133, ND-3). */
function carpRoutes(layout: ZoneLayout): PredatorRoute[] {
  return layout.predatorRoutes.filter((route) => route.species.id === CARP_SPECIES.id);
}

/** Distance from a point to the nearest heron stretch, the measure each heron's reach uses. */
function heronDistance(point: Point, layout: ZoneLayout = zone): number {
  return Math.min(...heronRoutes(layout).map((route) => routeLoopDistance(point, route.waypoints)));
}

/** Whether some heron can warn at a point: within its reach of its stretch and outside the safe area. */
function inHeronReach(point: Point, layout: ZoneLayout): boolean {
  return heronDistance(point, layout) <= HERON.lungeRange && !inSafeArea(point, layout.safeArea);
}

/** Shortest distance from a point to any heron waypoint, where a heron turns. */
function heronTurnDistance(point: Point, layout: ZoneLayout = zone): number {
  return turnDistance(point, heronRoutes(layout));
}

/** The middle of a box round the points: halfway across and halfway down. */
function boxCentre(points: readonly Point[]): Point {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Px of the depth band that the y span of the loop's waypoints covers; 0 when they do not meet (issue #130, ND-5). */
function bandOverlap(route: TilapiaRoute, band: { top: number; bottom: number }): number {
  const ys = route.waypoints.map((point) => point.y);
  return Math.max(0, Math.min(Math.max(...ys), band.bottom) - Math.max(Math.min(...ys), band.top));
}

/** The box of one point, as the hard rules measure a tadpole turn point or a sample on its loop. */
function pointBox(point: Point): HazardRect {
  return { kind: 'rect', x0: point.x, x1: point.x, y0: point.y, y1: point.y };
}

/**
 * The share of a tadpole's wander loop in its longest stretch, counting round from the end back to
 * the start, where mobileSnackClear clears the loop, sampled evenly at most WANDER_SAMPLE_PX px apart
 * from its first point (issue #131, ND-7). Every hard rule holds all along a clear loop, so only the
 * threats decide which samples count.
 */
function longestClearShare(points: readonly Point[], avoid: MobileSnackAvoid): number {
  const loop = snackWander(points, 1, 0);
  const count = Math.max(1, Math.ceil(loop.lap / WANDER_SAMPLE_PX));
  const start = points[0];
  const clear = Array.from({ length: count }, (_, k) => {
    const along = (k * loop.lap) / count;
    const sample = { x: start.x + wanderOffsetAlong(loop, along, 'x'), y: start.y + wanderOffsetAlong(loop, along, 'y') };
    return mobileSnackClear(pointBox(sample), avoid);
  });
  if (clear.every(Boolean)) return 1;
  let best = 0;
  let run = 0;
  for (let step = 0; step < 2 * count; step++) {
    run = clear[step % count] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best / count;
}

/** Seconds a tadpole takes round its wander loop at Area 3's tadpole speed, TADPOLE_SPEED. */
function lapSeconds(points: readonly Point[]): number {
  const lap = loopSegments(points).reduce((total, [a, b]) => total + Math.hypot(b.x - a.x, b.y - a.y), 0);
  return lap / TADPOLE_SPEED;
}

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const bounds = swimBounds(layout);
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function wormCentres(layout: ZoneLayout): Point[] {
  return layout.hazards.map((hazard) => hazardCentre(hazard.shape));
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

/** Seconds a one-leg axolotl takes to swim through `targets` in order; Infinity when over the limit. */
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

/** Area 3's mobile snacks from its data; throws when it has none. */
function pond2Mix(): Readonly<MobileSnackMix> {
  const mix = POND_2_LAYOUT.mobileSnacks;
  if (!mix) throw new Error('Area 3 has no mobile snacks');
  return mix;
}

/** Whether a shrimp at `spot` has a flick target `distance` px away, in some of FLICK_DIRECTIONS, whose box is clear. */
function shrimpCanFlick(layout: ZoneLayout, spot: Point, distance: number): boolean {
  const avoid = mobileSnackAvoid(layout);
  for (let i = 0; i < FLICK_DIRECTIONS; i++) {
    const angle = (i * 2 * Math.PI) / FLICK_DIRECTIONS;
    const target = { x: spot.x + distance * Math.cos(angle), y: spot.y + distance * Math.sin(angle) };
    if (mobileSnackClear(shrimpBox(target, POND_2_AREA.snackDrift), avoid)) return true;
  }
  return false;
}

describe('POND_2_LAYOUT', () => {
  it('is Area 3 data: 6 screens across, 1 down, starting at the Home Spot', () => {
    expect(POND_2_AREA_ID).toBe('pond-2');
    expect(POND_2_LAYOUT.id).toBe(POND_2_AREA_ID);
    expect(zone.width).toBe(2880);
    expect(zone.height).toBe(360);
    expect(zone.chunks).toBe(6);
    expect(zone.rows).toBe(1);
    expect(zone.start).toEqual({ x: 120, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('pond-2/cave');
    expect(Object.isFrozen(POND_2_LAYOUT)).toBe(true);
    expect(Object.isFrozen(POND_2_LAYOUT.hazards)).toBe(true);
    expect(Object.isFrozen(POND_2_LAYOUT.predatorRoutes)).toBe(true);
    expect(Object.isFrozen(POND_2_LAYOUT.predatorRoutes[0].waypoints)).toBe(true);
    expect(Object.isFrozen(POND_2_LAYOUT.elements)).toBe(true);
    expect(Object.isFrozen(POND_2_LAYOUT.mobileSnacks)).toBe(true);
    expect(Object.isFrozen(pond2Mix().wanders)).toBe(true);
    expect(Object.isFrozen(pond2Mix().homes)).toBe(true);
    expect(pond2Mix().wanders.every((wander) => Object.isFrozen(wander) && wander.points.every((point) => Object.isFrozen(point)))).toBe(true);
    expect(pond2Mix().homes.every((home) => Object.isFrozen(home) && home.points.every((spot) => Object.isFrozen(spot)))).toBe(true);
    expect(Object.isFrozen(POND_2_TILAPIA)).toBe(true);
    expect(Object.isFrozen(POND_2_TILAPIA.chase)).toBe(true);
    expect(Object.isFrozen(POND_2_CARP)).toBe(true);
    expect(Object.isFrozen(POND_2_CARP.tuning)).toBe(true);
    expect(Object.isFrozen(POND_2_CARP.tuning.chase)).toBe(true);
    expect(POND_2_LAYOUT.predatorRoutes.every((route) => Object.isFrozen(route) && Object.isFrozen(route.waypoints))).toBe(true);
  });

  it('has 24 snacks (10 worms, 6 bugs, 4 tadpoles and 4 shrimp), 5 plastic worms, 4 tilapia, two herons, two carp and 8 treasure slots', () => {
    for (const seed of ALL_SEEDS) {
      const layout = pond2(seed);
      expect(layout.collectibles).toHaveLength(24);
      expect(layout.collectibles.filter((snack) => snack.kind === 'worm')).toHaveLength(10);
      expect(layout.collectibles.filter((snack) => snack.kind === 'bug')).toHaveLength(6);
      expect(layout.collectibles.filter((snack) => snack.kind === 'tadpole')).toHaveLength(4);
      expect(layout.collectibles.filter((snack) => snack.kind === 'shrimp')).toHaveLength(4);
      expect(layout.tilapiaRoutes).toHaveLength(4);
      expect(heronRoutes(layout)).toHaveLength(2);
      expect(carpRoutes(layout)).toHaveLength(2);
      expect(layout.predatorRoutes).toHaveLength(4);
    }
    expect(zone.hazards.map((hazard) => hazard.id)).toEqual([1, 2, 3, 4, 5].map((n) => `pond-2/plastic-worm-${n}`));
    for (const hazard of zone.hazards) {
      expect(hazard.type).toBe(PLASTIC_WORM);
      expect(hazard.shape).toMatchObject({ kind: 'circle', r: 0 });
    }
    expect(tripTreasureTuning(POND_2_AREA_ID).slots).toBe(8);
    expect(POND_2_LAYOUT.treasures).toBe(POND_2_TREASURES);
  });

  it('has exactly two herons, heron-0 and heron-1, each on a two-point stretch, then two carp, carp-0 and carp-1, and no timing element (#111; issue #133, ND-3)', () => {
    expect(zone.predatorRoutes).toEqual([
      { id: 'heron-0', waypoints: [{ x: 2190, y: HERON_STRETCH_Y }, { x: 2370, y: HERON_STRETCH_Y }], species: HERON_SPECIES },
      { id: 'heron-1', waypoints: [{ x: 2440, y: HERON_STRETCH_Y }, { x: 2620, y: HERON_STRETCH_Y }], species: HERON_SPECIES },
      {
        id: 'carp-0',
        waypoints: [{ x: 2100, y: 200 }, { x: 2200, y: 262 }, { x: 2480, y: 262 }, { x: 2480, y: 296 }, { x: 2100, y: 296 }],
        species: POND_2_CARP,
      },
      {
        id: 'carp-1',
        waypoints: [{ x: 1586, y: 110 }, { x: 1614, y: 110 }, { x: 1614, y: 190 }, { x: 1586, y: 190 }],
        species: POND_2_CARP,
      },
    ]);
    expect(zone.elements).toEqual([]);
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = pond2(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.pads).toEqual(zone.pads);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.elements).toEqual(zone.elements);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
    }
  });
});

describe('Area 3 hiding spots', () => {
  it.each(ALL_SEEDS)('match their labels, B6 and B10 for every threat included, for seed %i', (seed) => {
    const layout = pond2(seed);
    const ids = layout.spots.map((spot) => spot.id);
    const routes = [...layout.tilapiaRoutes, ...layout.predatorRoutes];
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('pond-2/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, routes), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it.each(ALL_SEEDS)('give each rarity a pool at least as big as its Area 3 treasures for seed %i', (seed) => {
    const layout = pond2(seed);
    for (const rarity of RARITIES) {
      const treasures = POND_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      const spots = layout.spots.filter((spot) => spot.rarity === rarity).length;
      expect(spots, rarity).toBeGreaterThanOrEqual(treasures);
    }
    expect(RARITIES.map((rarity) => POND_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 2]);
    for (const find of layout.finds) {
      expect(find.pool.length, find.id).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SEEDS)('keep the Common and Rare pad spots, out of every heron reach for seed %i', (seed) => {
    const layout = pond2(seed);
    const padSpots = layout.spots.filter((spot) => spot.cover === 'pad');
    expect(padSpots.map((spot) => [spot.id, spot.rarity])).toEqual([
      ['pond-2/spot-pad-a', 'common'],
      ['pond-2/spot-pad-b', 'rare'],
    ]);
    for (const spot of padSpots) {
      expect(heronDistance(spot, layout), spot.id).toBeGreaterThan(HERON.lungeRange);
      expect(inHeronReach(spot, layout), spot.id).toBe(false);
    }
  });

  it('puts every Epic and Legendary spot in a heron strike zone, in the root arch or past the stream', () => {
    const risky = zone.spots.filter((spot) => spot.rarity === 'epic' || spot.rarity === 'legendary');
    expect(risky.map((spot) => spot.cover)).toEqual([...Array(4).fill('cave'), ...Array(4).fill('pastCurrent')]);
    for (const spot of risky) {
      expect(inHeronReach(spot, zone), spot.id).toBe(true);
      expect(spot.y, spot.id).toBeLessThanOrEqual(HERON_REACH_LOWEST_Y);
      const band = spot.rarity === 'legendary' ? [-Infinity, HERON.lungeRange / 2] : [HERON.lungeRange / 2, HERON.lungeRange];
      expect(heronDistance(spot), spot.id).toBeGreaterThan(band[0]);
      expect(heronDistance(spot), spot.id).toBeLessThanOrEqual(band[1]);
    }
  });

  it('puts the deep Rare reeds and the Rare pad in heron-1\'s Rare band, right of the root arch and beyond every tilapia chase, 300 px (issue #120, ND-8; issue #133, ND-1)', () => {
    const [, heron1] = herons;
    const chase = POND_2_TILAPIA.chase;
    expect((chase?.leash ?? 0) + Math.max(chase?.sight ?? 0, TILAPIA.lungeRange)).toBe(300);
    const farSpots = zone.spots.filter((spot) => spot.rarity === 'rare' && spot.x > zone.cave.x1);
    expect(farSpots.map((spot) => [spot.id, spot.cover, spot.x, spot.y])).toEqual([
      ['pond-2/spot-reeds-2-2604-deep', 'reeds', 2604, 256],
      ['pond-2/spot-reeds-2-2660-deep', 'reeds', 2660, 256],
      ['pond-2/spot-reeds-2-2716-deep', 'reeds', 2716, 256],
      ['pond-2/spot-pad-b', 'pad', 2775, 100],
    ]);
    expect(chase).toBeDefined();
    for (const spot of farSpots) {
      expect(routeLoopDistance(spot, heron1.waypoints), spot.id).toBeGreaterThan(HERON.lungeRange);
      expect(routeLoopDistance(spot, heron1.waypoints), spot.id).toBeLessThanOrEqual(HERON.lungeRange + RISK_COMMON_MARGIN);
      expect(routeDistance(spot, zone.tilapiaRoutes), spot.id).toBeGreaterThan((chase?.leash ?? 0) + Math.max(chase?.sight ?? 0, TILAPIA.lungeRange));
    }
  });

  it.each(ALL_SEEDS)('keeps every Common and Rare spot farther than the heron reach from every stretch for seed %i', (seed) => {
    const layout = pond2(seed);
    for (const spot of layout.spots.filter((candidate) => candidate.rarity === 'common' || candidate.rarity === 'rare')) {
      for (const route of heronRoutes(layout)) {
        expect(routeLoopDistance(spot, route.waypoints), `${spot.id} to ${route.id}`).toBeGreaterThan(HERON.lungeRange);
      }
    }
  });

  it.each(ALL_SEEDS)('keeps every spot at least the turn clearance from every heron waypoint for seed %i', (seed) => {
    const layout = pond2(seed);
    for (const spot of layout.spots) {
      expect(heronTurnDistance(spot, layout), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = pond2(seed);
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

describe('Area 3 root arch, the cave', () => {
  it('hangs from just under the surface, inside the swim bounds and above the deepest heron warn point', () => {
    const bounds = swimBounds(zone);
    expect(zone.cave).toEqual({ id: 'pond-2/cave', x0: 2432, x1: 2568, y0: 96, y1: 200 });
    expect(zone.cave.y0).toBeGreaterThanOrEqual(bounds.minY);
    expect(zone.cave.y1).toBeLessThanOrEqual(HERON_REACH_LOWEST_Y);
    expect(POND_2_LAYOUT.bankChunks).toEqual([Math.floor((zone.cave.x0 + zone.cave.x1) / 2 / 480)]);
  });

  it('sits under heron-1, beyond the stream, the spots past it and heron-0', () => {
    const [first, second] = herons;
    const current = zone.currents[0];
    expect(second.id).toBe('heron-1');
    expect(zone.cave.x0).toBeGreaterThan(first.waypoints[1].x);
    expect(zone.cave.x1).toBeGreaterThan(second.waypoints[0].x);
    expect(zone.cave.x1).toBeLessThan(second.waypoints[1].x);
    expect(zone.cave.x0).toBeGreaterThan(current.x1 + PAST_CURRENT_DEPTH);
    for (const spot of zone.spots.filter((candidate) => candidate.cover === 'cave')) {
      expect(coversAt(spot, zone), spot.id).toEqual(['cave']);
    }
  });
});

describe('Area 3 tilapia, heron, current and stranding places', () => {
  it('pairs the tilapia loops, so their strikes overlap and leave open water between the pairs (issue #133, Option A)', () => {
    const gaps: Record<string, number> = {};
    for (let i = 0; i < zone.tilapiaRoutes.length; i++) {
      for (let j = i + 1; j < zone.tilapiaRoutes.length; j++) {
        const [first, second] = [zone.tilapiaRoutes[i], zone.tilapiaRoutes[j]];
        gaps[`${first.id} to ${second.id}`] = Math.round(routeGap(first, second) * 10) / 10;
      }
    }
    expect(gaps).toEqual(MEASURED_TILAPIA_GAPS);
  });

  it('keeps the carp apart and below the herons: over 240 px between the carp, the floor carp over a heron\'s reach from every stretch and the other carp over 230 px (issue #133, ND-3, Q1)', () => {
    const [floor, other] = carps;
    expect([floor.id, other.id]).toEqual(['carp-0', 'carp-1']);
    expect(routeGap(floor, other)).toBeGreaterThan(CARP_CARP_CLEARANCE);
    for (const heron of herons) {
      expect(routeGap(floor, heron), `${floor.id} to ${heron.id}`).toBeGreaterThan(FLOOR_CARP_HERON_CLEARANCE);
      expect(routeGap(other, heron), `${other.id} to ${heron.id}`).toBeGreaterThan(CARP_HERON_CLEARANCE);
    }
    expect([CARP_CARP_CLEARANCE, FLOOR_CARP_HERON_CLEARANCE, CARP_HERON_CLEARANCE]).toEqual([240, 110, 230]);
  });

  it('puts the floor carp on the bed under both heron stretches, rising into the middle band left of heron-0 (issue #133, ND-3)', () => {
    const [floor] = carps;
    const bed = swimBounds(zone).maxY;
    const [, , floorBand] = depthBands(zone);
    const xs = floor.waypoints.map((point) => point.x);
    expect(floor.waypoints.some((point) => point.y === bed)).toBe(true);
    expect(Math.min(...xs)).toBeLessThan(herons[0].waypoints[0].x);
    expect(Math.max(...xs)).toBeGreaterThan(herons[1].waypoints[0].x);
    for (const point of floor.waypoints.filter((candidate) => candidate.x >= herons[0].waypoints[0].x)) {
      expect(point.y, `${point.x}, ${point.y}`).toBeGreaterThan(floorBand.top);
    }
  });

  it('keeps tilapia routes and the heron stretches in the water and out of the safe area', () => {
    for (const route of [...zone.tilapiaRoutes, ...zone.predatorRoutes]) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
      }
    }
  });

  it('puts each heron stretch at y 120 in the back half, 120 to 200 px long, with a 110 px reach to y 230', () => {
    for (const route of herons) {
      const [start, end] = route.waypoints;
      expect(route.waypoints, route.id).toHaveLength(2);
      expect(start.y, route.id).toBe(HERON_STRETCH_Y);
      expect(end.y, route.id).toBe(HERON_STRETCH_Y);
      expect(start.x, route.id).toBeGreaterThanOrEqual(BACK_HALF_X);
      expect(end.x - start.x, route.id).toBeGreaterThanOrEqual(HERON_STRETCH_MIN);
      expect(end.x - start.x, route.id).toBeLessThanOrEqual(HERON_STRETCH_MAX);
    }
    expect(HERON_STRETCH_Y).toBe(120);
    expect(HERON_REACH_LOWEST_Y).toBe(230);
    expect(HERON_HIT_LOWEST_Y).toBe(256);
    expect(zoneThreats(zone).filter((threat) => threat.kind === 'route' && !threat.tilapia)).toEqual([
      ...herons.map((route) => ({ kind: 'route', route, strike: HERON.lungeRange, tilapia: false })),
      ...carps.map((route) => ({ kind: 'route', route, strike: CARP.lungeRange, tilapia: false })),
    ]);
  });

  it('keeps a deep lane below y 230 under each heron stretch, out of every heron\'s reach (issue #133, ND-5)', () => {
    expect(DEEP_LANE_Y).toBeGreaterThan(HERON_HIT_LOWEST_Y);
    for (const route of herons) {
      const [start, end] = route.waypoints;
      for (let x = start.x; x <= end.x; x += LANE_STEP) {
        const lane = { x, y: DEEP_LANE_Y };
        expect(inBounds(lane, zone), `${route.id} lane at x ${x}`).toBe(true);
        expect(heronDistance(lane), `${route.id} lane at x ${x}`).toBeGreaterThan(HERON.lungeRange + HERON.hitRadius);
        expect(inHeronReach(lane, zone), `${route.id} lane at x ${x}`).toBe(false);
      }
    }
  });

  it('keeps home outside every current x span, so each current has a far side', () => {
    expect(zone.currents.length).toBeGreaterThan(0);
    for (const current of zone.currents) {
      expect(zone.homeSpot.x < current.x0 || zone.homeSpot.x > current.x1).toBe(true);
    }
  });

  it('has a stream a little stronger than Area 2, that one leg still beats', () => {
    const strength = (current: CurrentZone) => Math.hypot(current.force.x, current.force.y);
    expect(zone.currents.map(strength)).toEqual([74]);
    expect(strength(zone.currents[0])).toBeGreaterThan(Math.max(...pond1.currents.map(strength)));
    expect(SWIM.maxSpeed * LEGS.speedByLegs[0] - strength(zone.currents[0])).toBeGreaterThan(0);
  });

  it.each(ALL_SEEDS)('keeps every stranding place 80 px from every route, out of every heron reach and clear of spots, currents and the cave for seed %i', (seed) => {
    const layout = pond2(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `pond-2/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(inHeronReach(place, layout), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(shapeDistance(place, { kind: 'rect', ...layout.cave }), place.id).toBeGreaterThan(0);
      for (const route of [...layout.tilapiaRoutes, ...layout.predatorRoutes]) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(place, a, b), `${place.id} to ${route.id}`).toBeGreaterThanOrEqual(STRANDING_ROUTE_CLEARANCE);
        }
      }
      for (const spot of layout.spots) {
        expect(Math.hypot(place.x - spot.x, place.y - spot.y), `${place.id} to ${spot.id}`).toBeGreaterThanOrEqual(SPOT_MIN_SPACING);
      }
    }
  });
});

describe('Area 3 exit', () => {
  const { exit } = POND_2_AREA;

  it('sits at the far end, inside the bounds, out of the safe area, every heron, carp and tilapia strike and the ring (issue #133, ND-3)', () => {
    expect(exit.x).toBeGreaterThan(Math.max(...zone.currents.map((current) => current.x1)));
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    expect(heronDistance(exit)).toBeGreaterThan(HERON.lungeRange + exit.radius);
    expect(routeDistance(exit, carps)).toBeGreaterThan(CARP.lungeRange + exit.radius);
    expect(routeDistance(exit, zone.tilapiaRoutes)).toBeGreaterThan(TILAPIA.lungeRange + exit.radius);
    expect(Math.hypot(exit.x - zone.homeSpot.x, exit.y - zone.homeSpot.y)).toBeGreaterThan(zone.homeSpot.radius + exit.radius);
  });

  it.each(ALL_SEEDS)('is clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    const clearance = exit.radius + FINDS.pickupRadius;
    for (const spot of pond2(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(clearance);
    }
  });
});

describe('Area 3 plastic worms', () => {
  const worms = wormCentres(zone);

  it('sit outside the safe area and the Home Spot ring', () => {
    for (const worm of worms) {
      expect(inSafeArea(worm, zone.safeArea)).toBe(false);
      expect(Math.hypot(worm.x - zone.homeSpot.x, worm.y - zone.homeSpot.y)).toBeGreaterThan(zone.homeSpot.radius + PLASTIC_WORM.reach);
      expect(inBounds(worm, zone)).toBe(true);
    }
  });

  it('sit farther than a lunge from every tilapia and carp route and out of every heron reach (issue #133, ND-2)', () => {
    for (const [index, worm] of worms.entries()) {
      for (const route of zone.tilapiaRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_ROUTE_CLEARANCE);
        }
      }
      for (const route of carps) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_CARP_CLEARANCE);
        }
      }
      expect(inHeronReach(worm, zone), `worm ${index + 1}`).toBe(false);
    }
  });

  it('never sit under a lily pad', () => {
    for (const worm of worms) {
      expect(underPad(worm, zone.pads)).toBe(false);
      for (const pad of zone.pads) {
        expect(Math.abs(worm.x - pad.x), `pad at ${pad.x} above worm at ${worm.x}`).toBeGreaterThan(pad.rx);
      }
    }
  });

  it('sit far enough from every current that queasy time ends before the axolotl reaches it', () => {
    expect(WORM_CURRENT_CLEARANCE).toBeCloseTo(371.5, 5);
    for (const [index, worm] of worms.entries()) {
      for (const current of zone.currents) {
        expect(currentDistance(worm, current), `worm ${index + 1} to ${current.id}`).toBeGreaterThanOrEqual(WORM_CURRENT_CLEARANCE);
      }
    }
  });
});

describe('Area 3 snacks', () => {
  const drift = POND_2_AREA.snackDrift;
  const surfacePeak = SURF + 1.6 + 0.8;

  it.each(ALL_SEEDS)('start at least SNACK_HAZARD_CLEARANCE from every plastic worm for seed %i', (seed) => {
    const layout = pond2(seed);
    for (const snack of layout.collectibles) {
      for (const hazard of layout.hazards) {
        expect(shapeDistance(snack, hazard.shape), `${snack.id} to ${hazard.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it.each(ALL_SEEDS)('put at least 4 snacks in the stream, every one a worm or a bug, for seed %i', (seed) => {
    const layout = pond2(seed);
    const inStream = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    const inAnyCurrent = layout.collectibles.filter((snack) => layout.currents.some((current) => isInsideCurrent(snack, current)));
    expect(POND_2_LAYOUT.snacksInCurrent).toBe(4);
    expect(inStream.length).toBeGreaterThanOrEqual(POND_2_LAYOUT.snacksInCurrent);
    expect(inAnyCurrent.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = pond2(seed);
    const bounds = swimBounds(layout);
    const items = createCollectibles(layout.collectibles);
    for (let t = 0; t <= 120; t += 0.25) {
      for (let index = 0; index < items.length; index++) {
        const snack = {
          x: snackX(items[index], index, t, drift, bounds),
          y: snackY(items[index], index, t, drift, bounds),
        };
        expect(inBounds(snack, layout)).toBe(true);
        expect(snack.y).toBeGreaterThan(surfacePeak);
        expect(inHomeSpot(snack, layout.homeSpot)).toBe(false);
      }
    }
  });

  it('drift a little faster than Area 2, slower than a one-leg axolotl swims against the stream, and at most half the magnet pull', () => {
    const strongestCurrent = Math.max(...zone.currents.map((current) => Math.hypot(current.force.x, current.force.y)));
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - strongestCurrent;
    expect(oneLegNet).toBe(16);
    expect(snackDriftMaxSpeed(drift)).toBeCloseTo(15.2, 1);
    expect(snackDriftMaxSpeed(drift)).toBeGreaterThan(snackDriftMaxSpeed(POND_AREA.snackDrift));
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });

  it('keep the shared dart rule in the area data, and the shrimp turn the darters off (issue #120, ND-4)', () => {
    expect(POND_2_AREA.snackDart).toBe(SNACK_DART);
    expect(SNACK_DART.darters).toBe(3);
    expect(POND_AREA.snackDart).toBeUndefined();
  });

  it.each(ALL_SEEDS)('have no one-time darters, because the shrimp replace them, for seed %i', (seed) => {
    expect(POND_2_AREA.snackDart).toBe(SNACK_DART);
    expect(oneTimeDarts(POND_2_AREA, pond2(seed))).toBeNull();
  });

  it('meet the Area 3 snack ramp: a third of the snacks swim, tadpoles at 50 px/s (issue #120, ND-4; issue #131, ND-9)', () => {
    const mix = pond2Mix();
    expect(meetsSnackRamp(3, POND_2_LAYOUT)).toBe(true);
    expect(mobileSnackShare(POND_2_LAYOUT)).toBeCloseTo(8 / 24, 9);
    expect(mix.tadpole).toEqual({ speed: 50 });
    expect(mix.shrimp).toEqual({ triggerRadius: 60, restFor: 1.7, flickDistance: 44, flickSpeed: 115 });
  });

  it('put four tadpoles on wander loops of 5 to 7 turn points, each a quarter of its own lap out of step, and four shrimp on homes of three hop spots (issue #131, ND-1, ND-5; issue #133, ND-6)', () => {
    const mix = pond2Mix();
    expect(mix.wanders.map((wander) => wander.points.map((point) => [point.x, point.y]))).toEqual([
      [[310, 140], [310, 290], [455, 290], [455, 205], [630, 205], [470, 205], [310, 215]],
      [[890, 110], [1050, 110], [1210, 110], [1210, 270], [1050, 270], [890, 270]],
      [[1140, 110], [1140, 280], [1245, 280], [1245, 195], [1460, 195], [1245, 110]],
      [[1740, 110], [1870, 110], [1870, 280], [1740, 280], [1550, 200]],
    ]);
    expect(mix.wanders.map((wander) => Math.round(lapSeconds(wander.points) * 10) / 10)).toEqual(MEASURED_LAPS);
    mix.wanders.forEach((wander, i) => {
      expect(wander.offset, `tadpole ${i + 1}`).toBeCloseTo((i * lapSeconds(wander.points)) / 4, 9);
    });
    expect(mix.homes.map((home) => home.points.map((point) => [point.x, point.y]))).toEqual([
      [[340, 230], [410, 250], [460, 215]],
      [[1130, 150], [1200, 200], [1130, 250]],
      [[1760, 150], [1820, 200], [1780, 250]],
      [[2750, 140], [2800, 115], [2815, 170]],
    ]);
  });

  it('meet the snack motion rules: 4 to 8 turn points, legs of 1.5 to 5 s, laps of at most 40 s, homes 320 to 480 px wide and 150 px tall, and hop homes of 3 to 6 spots in 200 x 160 px (issue #131, ND-2, ND-3, ND-5)', () => {
    expect(meetsSnackMotion(POND_2_LAYOUT)).toBe(true);
    for (const [index, wander] of pond2Mix().wanders.entries()) {
      const label = `tadpole ${index + 1}`;
      const xs = wander.points.map((point) => point.x);
      const ys = wander.points.map((point) => point.y);
      expect(wander.points.length, label).toBeGreaterThanOrEqual(TADPOLES.minLoopPoints);
      expect(wander.points.length, label).toBeLessThanOrEqual(TADPOLES.maxLoopPoints);
      expect(Math.max(...xs) - Math.min(...xs), label).toBeGreaterThanOrEqual(TADPOLES.minHomeWidth);
      expect(Math.max(...xs) - Math.min(...xs), label).toBeLessThanOrEqual(TADPOLES.maxHomeWidth);
      expect(Math.max(...ys) - Math.min(...ys), label).toBeGreaterThanOrEqual(TADPOLES.minHomeHeight);
      expect(Math.max(...ys) - Math.min(...ys), label).toBeLessThanOrEqual(TADPOLES.maxHomeHeight);
      for (const point of wander.points) {
        expect(inBounds(point, zone), `${label} at ${point.x}, ${point.y}`).toBe(true);
        expect(point.y, `${label} at ${point.x}, ${point.y}`).toBeGreaterThan(surfacePeak);
      }
      for (const [a, b] of loopSegments(wander.points)) {
        const seconds = Math.hypot(b.x - a.x, b.y - a.y) / TADPOLE_SPEED;
        expect(seconds, `${label} leg from ${a.x}, ${a.y}`).toBeGreaterThanOrEqual(TADPOLES.minLegSeconds);
        expect(seconds, `${label} leg from ${a.x}, ${a.y}`).toBeLessThanOrEqual(TADPOLES.maxLegSeconds);
      }
      expect(lapSeconds(wander.points), label).toBeLessThanOrEqual(TADPOLES.maxLapSeconds);
    }
    for (const [index, home] of pond2Mix().homes.entries()) {
      const label = `shrimp ${index + 1}`;
      const xs = home.points.map((point) => point.x);
      const ys = home.points.map((point) => point.y);
      expect(home.points.length, label).toBe(3);
      expect(home.points.length, label).toBeGreaterThanOrEqual(SHRIMP.minHomeSpots);
      expect(home.points.length, label).toBeLessThanOrEqual(SHRIMP.maxHomeSpots);
      expect(Math.max(...xs) - Math.min(...xs), label).toBeLessThanOrEqual(SHRIMP.maxHomeWidth);
      expect(Math.max(...ys) - Math.min(...ys), label).toBeLessThanOrEqual(SHRIMP.maxHomeHeight);
    }
  });

  it('spread the tadpole homes over x 300 to 1880, centres at least 240 px apart and none in the stream (issue #133, ND-6)', () => {
    const [left, right] = TADPOLE_HOMES_X;
    const centres = pond2Mix().wanders.map((wander) => boxCentre(wander.points));
    expect(centres).toEqual([
      { x: 470, y: 215 },
      { x: 1050, y: 190 },
      { x: 1300, y: 195 },
      { x: 1710, y: 195 },
    ]);
    for (const [index, wander] of pond2Mix().wanders.entries()) {
      for (const point of wander.points) {
        expect(point.x, `tadpole ${index + 1}`).toBeGreaterThan(left);
        expect(point.x, `tadpole ${index + 1}`).toBeLessThan(right);
      }
    }
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        expect(centres[j].x - centres[i].x, `tadpoles ${i + 1} and ${j + 1}`).toBeGreaterThanOrEqual(TADPOLE_HOME_SPACING);
      }
    }
  });

  it('put two shrimp homes in each half of Area 3, the last by the exit (issue #133, ND-6)', () => {
    const half = zone.width / 2;
    const homes = pond2Mix().homes;
    const halves = homes.map((home) => (boxCentre(home.points).x < half ? 'left' : 'right'));
    expect(halves).toEqual(['left', 'left', 'right', 'right']);
    const { exit } = POND_2_AREA;
    for (const spot of homes[homes.length - 1].points) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), `${spot.x}, ${spot.y}`).toBeLessThanOrEqual(EXIT_SHRIMP_REACH);
    }
  });

  it('let a one-leg axolotl catch each tadpole from every start round its home (issue #131, ND-8)', () => {
    const mix = pond2Mix();
    const rule = mix.tadpole;
    if (!rule) throw new Error('Area 3 has no tadpole rule');
    for (const [index, wander] of mix.wanders.entries()) {
      expect(oneLegCatchesTadpole(rule, wander, swimBounds(zone)), `tadpole ${index + 1}`).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('pass tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i (issue #131, ND-7)', (seed) => {
    const avoid = mobileSnackAvoid(pond2(seed));
    for (const [index, wander] of pond2Mix().wanders.entries()) {
      expect(tadpoleWanderClear(wander, avoid), `tadpole ${index + 1}`).toBe(true);
    }
    for (const [index, home] of pond2Mix().homes.entries()) {
      expect(shrimpHomeClear(home, drift, avoid), `shrimp ${index + 1}`).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('hold every tadpole turn point and leg, and every shrimp hop spot, hop leg and glide, to the hard rules for seed %i (issue #131, ND-7)', (seed) => {
    const layout = pond2(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const [index, wander] of pond2Mix().wanders.entries()) {
      for (const point of wander.points) {
        expect(mobileSnackHardClear(pointBox(point), avoid), `tadpole ${index + 1} at ${point.x}, ${point.y}`).toBe(true);
      }
    }
    const legBoxes = mobileLegBoxes(layout);
    expect(legBoxes).toHaveLength(7 + 6 + 6 + 5 + 4 * 3);
    for (const [index, box] of legBoxes.entries()) {
      expect(mobileSnackHardClear(box, avoid), `leg box ${index + 1}`).toBe(true);
    }
    for (const [index, home] of pond2Mix().homes.entries()) {
      home.points.forEach((spot, i) => {
        const next = home.points[(i + 1) % home.points.length];
        expect(mobileSnackHardClear(shrimpBox(spot, drift), avoid), `shrimp ${index + 1} at ${spot.x}, ${spot.y}`).toBe(true);
        expect(shrimpGlideClear(spot, next, drift, avoid), `shrimp ${index + 1} hop from ${spot.x}, ${spot.y}`).toBe(true);
      });
    }
  });

  it.each(ALL_SEEDS)('keep half of each tadpole loop, in one stretch, and half of each shrimp home\'s hop spots out of every threat\'s reach for seed %i (issue #131, ND-7)', (seed) => {
    const avoid = mobileSnackAvoid(pond2(seed));
    for (const [index, wander] of pond2Mix().wanders.entries()) {
      expect(longestClearShare(wander.points, avoid), `tadpole ${index + 1}`).toBeGreaterThanOrEqual(TADPOLES.safeLoopShare);
    }
    for (const [index, home] of pond2Mix().homes.entries()) {
      const safe = home.points.filter((spot) => mobileSnackClear(shrimpBox(spot, drift), avoid)).length;
      expect(safe, `shrimp ${index + 1}`).toBeGreaterThanOrEqual(SHRIMP.safeSpotShare * home.points.length);
    }
  });

  it.each(ALL_SEEDS)('give every shrimp hop spot a clear 44 px flick target in some direction for seed %i', (seed) => {
    const layout = pond2(seed);
    const flick = pond2Mix().shrimp?.flickDistance ?? 0;
    expect(flick).toBe(44);
    for (const [index, home] of pond2Mix().homes.entries()) {
      for (const spot of home.points) {
        expect(shrimpCanFlick(layout, spot, flick), `shrimp ${index + 1} at ${spot.x}, ${spot.y}`).toBe(true);
      }
    }
  });

  it('pull with the Snack magnet at 60 px/s, 1.2 times the 50 px/s tadpole (issue #131, ND-8)', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBe(60);
  });
});

describe('Area 3 whole-water ramp bar (issue #120, ND-1; issue #133, ND-1 to ND-3, ND-7)', () => {
  it('gives the tilapia the ramp chase on a 100 px leash, sight 200, leash 100 and speed 115, with every other value TILAPIA\'s', () => {
    expect(POND_2_LAYOUT.tilapia).toBe(POND_2_TILAPIA);
    expect(POND_2_TILAPIA.chase).toEqual({ sight: 200, leash: 100, speed: 115 });
    expect(POND_2_TILAPIA.chase).toEqual({ ...TILAPIA_RAMP_CHASE, leash: 100 });
    expect(Object.isFrozen(POND_2_TILAPIA)).toBe(true);
    expect(Object.isFrozen(POND_2_TILAPIA.chase)).toBe(true);
    const { chase, ...rest } = POND_2_TILAPIA;
    expect(chase).toBeDefined();
    expect(rest).toEqual(TILAPIA);
    expect(() => tunedSpecies(TILAPIA_SPECIES, POND_2_TILAPIA)).not.toThrow();
    for (const seed of ALL_SEEDS) {
      expect(pond2(seed).tilapia).toEqual(POND_2_TILAPIA);
    }
  });

  it('plays both carp as POND_2_CARP: CARP with a chase of sight 220, leash 80 and speed 115, and the carp species otherwise', () => {
    const { tuning, ...species } = POND_2_CARP;
    const { tuning: carpTuning, ...carpSpecies } = CARP_SPECIES;
    expect(species).toEqual(carpSpecies);
    expect(carpTuning).toBe(CARP);
    expect(tuning).toEqual({ ...CARP, chase: { sight: 220, leash: 80, speed: 115 } });
    expect(Object.isFrozen(POND_2_CARP)).toBe(true);
    expect(Object.isFrozen(tuning.chase)).toBe(true);
    for (const route of carps) {
      expect(route.species, route.id).toBe(POND_2_CARP);
    }
  });

  it('keeps the herons without a chase', () => {
    for (const route of herons) {
      expect(route.species, route.id).toBe(HERON_SPECIES);
      expect(route.species.tuning.chase, route.id).toBeUndefined();
    }
  });

  it('adds no moving hazard and no predator beyond the four tilapia, two herons and two carp', () => {
    expect(POND_2_LAYOUT.movingHazards).toBeUndefined();
    expect(POND_2_LAYOUT.tilapiaRoutes).toHaveLength(4);
    expect(POND_2_LAYOUT.predatorRoutes.map((route) => route.species.id)).toEqual(['heron', 'heron', 'carp', 'carp']);
  });

  it.each(ALL_SEEDS)('builds a zone with no moving hazards key, no moving hazard type and the default seed\'s threats for seed %i', (seed) => {
    const layout = pond2(seed);
    expect(layout).not.toHaveProperty('movingHazards');
    expect(movingHazardTypeCount(layout)).toBe(0);
    expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
    expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
    expect(layout.hazards).toEqual(zone.hazards);
    expect(layout.tilapia).toEqual(zone.tilapia);
  });

  it('meets the Area 3 whole-water ramp bar', () => {
    expect(meetsWholeWaterRampBar(3, zone)).toBe(true);
  });

  it('leaves no quiet swim longer than one screen: the longest is 334.4 px, from (544, 102) to (296, 296)', () => {
    const swim = longestQuietSwim(zone);
    expect(swim).not.toBeNull();
    expect(swim?.length).toBeCloseTo(MEASURED_QUIET_SWIM, 1);
    expect(swim?.from).toEqual({ x: 544, y: 102 });
    expect(swim?.to).toEqual({ x: 296, y: 296 });
    expect(MEASURED_QUIET_SWIM).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('patrols every depth: each tilapia and carp loop reaches 24 px into two bands, and each kind into all three', () => {
    const bands = depthBands(zone);
    expect(bands).toEqual([
      { top: 94, bottom: 94 + 202 / 3 },
      { top: 94 + 202 / 3, bottom: 94 + (2 * 202) / 3 },
      { top: 94 + (2 * 202) / 3, bottom: 296 },
    ]);
    expect(meetsDepthRule(zone)).toBe(true);
    const loops: TilapiaRoute[] = [...zone.tilapiaRoutes, ...carps];
    expect(loops.map((route) => route.id)).toEqual(['tilapia-0', 'tilapia-1', 'tilapia-2', 'tilapia-3', 'carp-0', 'carp-1']);
    for (const route of loops) {
      expect(bands.filter((band) => bandOverlap(route, band) >= BAND_REACH).length, route.id).toBeGreaterThanOrEqual(2);
    }
    for (const kind of [zone.tilapiaRoutes, carps]) {
      for (const [index, band] of bands.entries()) {
        const deepest = Math.max(...kind.map((route) => bandOverlap(route, band)));
        expect(deepest, `${kind[0].id} kind in band ${index}`).toBeGreaterThanOrEqual(BAND_REACH);
      }
    }
  });

  it('has danger from the surface, and a floor quiet stretch of 210 px, at most one screen', () => {
    expect(hasSurfaceDanger(zone)).toBe(true);
    expect(floorQuietStretch(zone)).toBeCloseTo(MEASURED_FLOOR_STRETCH, 9);
    expect(MEASURED_FLOOR_STRETCH).toBeLessThanOrEqual(QUIET_SWIM_LIMIT);
  });

  it('has two carp, at least the carp rule\'s target for its 6 screens', () => {
    expect(carpCount(zone)).toBe(2);
    expect(carpTarget(6)).toBe(2);
    expect(carpCount(zone)).toBeGreaterThanOrEqual(carpTarget(6));
  });
});

describe('Area 3 fact cards', () => {
  it('gives Area 3 its threat cards, then the tadpole and shrimp cards, from its data or its zone', () => {
    const expected = {
      ids: ['tilapia', 'heron', 'carp', 'plastic-worm', 'tadpole', 'shrimp'],
      cards: [TILAPIA_FACT, HERON_FACT, CARP_FACT, PLASTIC_WORM_FACT, TADPOLE_FACT, SHRIMP_FACT],
    };
    expect(sourceFactCards(POND_2_LAYOUT)).toEqual(expected);
    expect(sourceFactCards(buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED))).toEqual(expected);
  });
});

describe('Area 3 difficulty', () => {
  it('is a little longer and harder than Area 2: wider, more snacks, faster drift, a stronger stream, more slots, shrimp and two herons', () => {
    const strength = (layout: ZoneLayout) => Math.max(...layout.currents.map((current) => Math.hypot(current.force.x, current.force.y)));
    expect(zone.width).toBeGreaterThan(pond1.width);
    expect(zone.tilapiaRoutes.length).toBeGreaterThanOrEqual(pond1.tilapiaRoutes.length);
    expect(zone.collectibles.length).toBeGreaterThan(pond1.collectibles.length);
    expect(snackDriftMaxSpeed(POND_2_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(POND_AREA.snackDrift));
    expect(strength(zone)).toBeGreaterThan(strength(pond1));
    expect(tripTreasureTuning(POND_2_AREA_ID).slots).toBeGreaterThan(tripTreasureTuning(POND_AREA.id).slots);
    expect(zone.predatorRoutes.map((route) => route.species.id)).toEqual(['heron', 'heron', 'carp', 'carp']);
    expect(zone.hazards.length).toBeGreaterThan(0);
    expect(zone.collectibles.some((snack) => snack.kind === 'shrimp')).toBe(true);
  });
});

describe('beating Area 3', () => {
  it('lets a one-leg axolotl swim the main path, through the stream, to the exit and back home', () => {
    const exit = POND_2_AREA.exit;
    const there = [...zone.mainPath.slice(1), exit];
    const toExit = oneLegSeconds(zone.start, there, zone, (pos) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius);
    expect(toExit).toBeLessThan(BEAT_MAX_SECONDS);
    const back = [...zone.mainPath].reverse();
    const home = oneLegSeconds(exit, back, zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });

  it.each(ALL_SEEDS)('puts every snack the exit needs in the swim bounds for seed %i', (seed) => {
    const layout = pond2(seed);
    const mobile = pond2Mix().wanders.length + pond2Mix().homes.length;
    expect(layout.collectibles).toHaveLength(POND_2_LAYOUT.snackWorms + POND_2_LAYOUT.snackBugs + mobile);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
    }
  });
});
