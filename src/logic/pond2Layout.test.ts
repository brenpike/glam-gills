import { describe, expect, it } from 'vitest';
import { POND_2_AREA, POND_AREA } from './areas';
import { POND_2_TREASURES, RARITIES } from './catalogue';
import { createCollectibles, snackDriftMaxSpeed, snackX, snackY } from './collectibles';
import { longestQuietStretch, meetsRampDangerBar } from './dangerBar';
import { currentAt, reedDragAt } from './environment';
import { hazardCentre, shapeDistance } from './hazards';
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
  meetsSnackRamp,
  mobileSnackAvoid,
  mobileSnackClear,
  mobileSnackShare,
  oneTimeDarts,
  shrimpBox,
  snackMagnetSpeed,
  tadpoleLaneBox,
  type MobileSnackMix,
} from './mobileSnacks';
import { PERK_CAPS, SNACK_MAGNET_PULL_SPEED } from './perks';
import { PLASTIC_WORM } from './plasticWorms';
import { HERON_STRETCH_Y, POND_2_AREA_ID, POND_2_LAYOUT, POND_2_TILAPIA } from './pond2Layout';
import { POND_LAYOUT } from './pondLayout';
import { HERON_SPECIES, TILAPIA_SPECIES, routeLoopDistance, tunedSpecies } from './predators';
import { SNACK_DART } from './snackDart';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  FINDS,
  HERON,
  LEGS,
  PLASTIC_WORMS,
  RISK,
  SNACK_REACH,
  SWIM,
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
/** Longest stretch of the main path with no moving threat in reach, measured (issue #120, ND-7). */
const QUIET_STRETCH = 369;

const zone = buildZone(POND_2_LAYOUT, DEFAULT_ZONE_SEED);
const pond1 = buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED);
const herons = zone.predatorRoutes;

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

/** Distance from a point to the nearest heron stretch, the measure each heron's reach uses. */
function heronDistance(point: Point, layout: ZoneLayout = zone): number {
  return Math.min(...layout.predatorRoutes.map((route) => routeLoopDistance(point, route.waypoints)));
}

/** Whether some heron can warn at a point: within its reach of its stretch and outside the safe area. */
function inHeronReach(point: Point, layout: ZoneLayout): boolean {
  return heronDistance(point, layout) <= HERON.lungeRange && !inSafeArea(point, layout.safeArea);
}

/** Shortest distance from a point to any heron waypoint, where a heron turns. */
function heronTurnDistance(point: Point, layout: ZoneLayout = zone): number {
  return turnDistance(point, layout.predatorRoutes);
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
    expect(Object.isFrozen(pond2Mix().lanes)).toBe(true);
    expect(Object.isFrozen(pond2Mix().spots)).toBe(true);
    expect(pond2Mix().lanes.every((lane) => Object.isFrozen(lane))).toBe(true);
    expect(pond2Mix().spots.every((spot) => Object.isFrozen(spot))).toBe(true);
    expect(Object.isFrozen(POND_2_TILAPIA)).toBe(true);
    expect(Object.isFrozen(POND_2_TILAPIA.chase)).toBe(true);
  });

  it('has 24 snacks (10 worms, 6 bugs, 4 tadpoles and 4 shrimp), 5 plastic worms, 4 tilapia, two herons and 8 treasure slots', () => {
    for (const seed of ALL_SEEDS) {
      const layout = pond2(seed);
      expect(layout.collectibles).toHaveLength(24);
      expect(layout.collectibles.filter((snack) => snack.kind === 'worm')).toHaveLength(10);
      expect(layout.collectibles.filter((snack) => snack.kind === 'bug')).toHaveLength(6);
      expect(layout.collectibles.filter((snack) => snack.kind === 'tadpole')).toHaveLength(4);
      expect(layout.collectibles.filter((snack) => snack.kind === 'shrimp')).toHaveLength(4);
      expect(layout.tilapiaRoutes).toHaveLength(4);
      expect(layout.predatorRoutes).toHaveLength(2);
    }
    expect(zone.hazards.map((hazard) => hazard.id)).toEqual([1, 2, 3, 4, 5].map((n) => `pond-2/plastic-worm-${n}`));
    for (const hazard of zone.hazards) {
      expect(hazard.type).toBe(PLASTIC_WORM);
      expect(hazard.shape).toMatchObject({ kind: 'circle', r: 0 });
    }
    expect(tripTreasureTuning(POND_2_AREA_ID).slots).toBe(8);
    expect(POND_2_LAYOUT.treasures).toBe(POND_2_TREASURES);
  });

  it('has exactly two herons, heron-0 and heron-1, each on a two-point stretch, and no timing element (#111)', () => {
    expect(zone.predatorRoutes).toEqual([
      { id: 'heron-0', waypoints: [{ x: 2190, y: HERON_STRETCH_Y }, { x: 2370, y: HERON_STRETCH_Y }], species: HERON_SPECIES },
      { id: 'heron-1', waypoints: [{ x: 2440, y: HERON_STRETCH_Y }, { x: 2620, y: HERON_STRETCH_Y }], species: HERON_SPECIES },
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

  it('puts the deep Rare reeds and the Rare pad in heron-1\'s Rare band, right of the root arch and beyond every tilapia chase (issue #120, ND-8)', () => {
    const [, heron1] = herons;
    const chase = POND_2_TILAPIA.chase;
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
      for (const route of layout.predatorRoutes) {
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
  it('keeps every pair of tilapia routes more than twice the lunge range apart', () => {
    const gaps: number[] = [];
    for (let i = 0; i < zone.tilapiaRoutes.length; i++) {
      for (let j = i + 1; j < zone.tilapiaRoutes.length; j++) {
        gaps.push(routeGap(zone.tilapiaRoutes[i], zone.tilapiaRoutes[j]));
      }
    }
    expect(Math.min(...gaps)).toBeGreaterThan(2 * TILAPIA.lungeRange);
    expect(routeGap(zone.tilapiaRoutes[0], zone.tilapiaRoutes[1])).toBe(290);
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
    expect(zoneThreats(zone).filter((threat) => threat.kind === 'route' && !threat.tilapia)).toEqual(
      herons.map((route) => ({ kind: 'route', route, strike: HERON.lungeRange, tilapia: false })),
    );
  });

  it('keeps a deep lane below y 230 under each heron stretch that every heron and tilapia leave open', () => {
    expect(DEEP_LANE_Y).toBeGreaterThan(HERON_HIT_LOWEST_Y);
    for (const route of herons) {
      const [start, end] = route.waypoints;
      for (let x = start.x; x <= end.x; x += LANE_STEP) {
        const lane = { x, y: DEEP_LANE_Y };
        expect(inBounds(lane, zone), `${route.id} lane at x ${x}`).toBe(true);
        expect(heronDistance(lane), `${route.id} lane at x ${x}`).toBeGreaterThan(HERON.lungeRange + HERON.hitRadius);
        expect(inHeronReach(lane, zone), `${route.id} lane at x ${x}`).toBe(false);
        expect(routeDistance(lane, zone.tilapiaRoutes), `${route.id} lane at x ${x}`).toBeGreaterThan(TILAPIA.lungeRange);
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

  it('sits at the far end, inside the bounds, out of the safe area, every heron reach and the ring', () => {
    expect(exit.x).toBeGreaterThan(Math.max(...zone.currents.map((current) => current.x1)));
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    expect(heronDistance(exit)).toBeGreaterThan(HERON.lungeRange + exit.radius);
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

  it('sit farther than a lunge from every tilapia route and out of every heron reach', () => {
    for (const [index, worm] of worms.entries()) {
      for (const route of zone.tilapiaRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_ROUTE_CLEARANCE);
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

  it.each(ALL_SEEDS)('put at least 4 snacks in the stream for seed %i', (seed) => {
    const layout = pond2(seed);
    const inStream = layout.collectibles.filter((snack) => isInsideCurrent(snack, layout.currents[0]));
    expect(POND_2_LAYOUT.snacksInCurrent).toBe(4);
    expect(inStream.length).toBeGreaterThanOrEqual(POND_2_LAYOUT.snacksInCurrent);
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

  it('meet the Area 3 snack ramp: a third of the snacks swim, tadpoles at 35 px/s (issue #120, ND-4)', () => {
    const mix = pond2Mix();
    expect(meetsSnackRamp(3, POND_2_LAYOUT)).toBe(true);
    expect(mobileSnackShare(POND_2_LAYOUT)).toBeCloseTo(8 / 24, 9);
    expect(mix.tadpole).toEqual({ speed: 35 });
    expect(mix.shrimp).toEqual({ triggerRadius: 60, restFor: 1.7, flickDistance: 44, flickSpeed: 115 });
  });

  it('put four tadpoles on 120 px lanes, each a quarter of the lane loop out of step, and four shrimp', () => {
    const mix = pond2Mix();
    const loop = (2 * 120) / 35;
    expect(mix.lanes.map((lane) => [lane.x, lane.y, lane.dx, lane.dy])).toEqual([
      [320, 210, 120, 0],
      [560, 100, 120, 0],
      [1655, 140, 0, 120],
      [2420, 280, 120, 0],
    ]);
    mix.lanes.forEach((lane, i) => {
      expect(Math.hypot(lane.dx, lane.dy), `lane ${i + 1}`).toBe(120);
      expect(lane.offset, `lane ${i + 1}`).toBeCloseTo((i * loop) / 4, 9);
    });
    expect(mix.spots.map((spot) => [spot.x, spot.y])).toEqual([
      [860, 106],
      [1230, 106],
      [2320, 280],
      [2760, 140],
    ]);
  });

  it.each(ALL_SEEDS)('keep every tadpole lane and shrimp box clear of the threats, worms, stream and safe area for seed %i', (seed) => {
    const layout = pond2(seed);
    const avoid = mobileSnackAvoid(layout);
    const mix = layout.mobileSnacks;
    expect(mix).toBeDefined();
    for (const [index, lane] of (mix?.lanes ?? []).entries()) {
      expect(mobileSnackClear(tadpoleLaneBox(lane), avoid), `lane ${index + 1}`).toBe(true);
    }
    for (const [index, spot] of (mix?.spots ?? []).entries()) {
      expect(mobileSnackClear(shrimpBox(spot, drift), avoid), `shrimp ${index + 1}`).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('give every shrimp a clear 44 px flick target in some direction for seed %i', (seed) => {
    const layout = pond2(seed);
    const flick = pond2Mix().shrimp?.flickDistance ?? 0;
    expect(flick).toBe(44);
    for (const [index, spot] of pond2Mix().spots.entries()) {
      expect(shrimpCanFlick(layout, spot, flick), `shrimp ${index + 1}`).toBe(true);
    }
  });

  it('pull with the Snack magnet at 42 px/s, 1.2 times the 35 px/s tadpole', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBe(42);
  });
});

describe('Area 3 ramp bar (issue #120, ND-1, ND-2, ND-7)', () => {
  it('gives the tilapia the ramp chase, sight 200, leash 80 and speed 115, with every other value TILAPIA\'s', () => {
    expect(POND_2_LAYOUT.tilapia).toBe(POND_2_TILAPIA);
    expect(POND_2_TILAPIA.chase).toBe(TILAPIA_RAMP_CHASE);
    expect(POND_2_TILAPIA.chase).toEqual({ sight: 200, leash: 80, speed: 115 });
    const { chase, ...rest } = POND_2_TILAPIA;
    expect(chase).toBeDefined();
    expect(rest).toEqual(TILAPIA);
    expect(() => tunedSpecies(TILAPIA_SPECIES, POND_2_TILAPIA)).not.toThrow();
    for (const seed of ALL_SEEDS) {
      expect(pond2(seed).tilapia).toEqual(POND_2_TILAPIA);
    }
  });

  it('keeps the herons without a chase', () => {
    for (const route of herons) {
      expect(route.species, route.id).toBe(HERON_SPECIES);
      expect(route.species.tuning.chase, route.id).toBeUndefined();
    }
  });

  it('adds no moving hazard and no predator beyond the four tilapia and two herons', () => {
    expect(POND_2_LAYOUT.movingHazards).toBeUndefined();
    expect(POND_2_LAYOUT.tilapiaRoutes).toHaveLength(4);
    expect(POND_2_LAYOUT.predatorRoutes).toHaveLength(2);
  });

  it.each(ALL_SEEDS)('meets the Area 3 ramp danger bar, with a quiet stretch of 369 px, for seed %i', (seed) => {
    const layout = pond2(seed);
    expect(longestQuietStretch(layout)).toBe(QUIET_STRETCH);
    expect(QUIET_STRETCH).toBeLessThanOrEqual(SCREEN_W);
    expect(meetsRampDangerBar(3, layout)).toBe(true);
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
    expect(pond1.predatorRoutes).toHaveLength(0);
    expect(zone.predatorRoutes.map((route) => route.species.id)).toEqual(['heron', 'heron']);
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
    const mobile = pond2Mix().lanes.length + pond2Mix().spots.length;
    expect(layout.collectibles).toHaveLength(POND_2_LAYOUT.snackWorms + POND_2_LAYOUT.snackBugs + mobile);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
    }
  });
});
