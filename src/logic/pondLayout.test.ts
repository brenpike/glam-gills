import { describe, expect, it } from 'vitest';
import { CANAL_AREA, POND_AREA } from './areas';
import { POND_TREASURES, RARITIES } from './catalogue';
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
  meetsWholeWaterRampBar,
  movingHazardTypeCount,
} from './dangerBar';
import { currentAt, reedDragAt } from './environment';
import { hazardCentre, shapeDistance } from './hazards';
import { spotMatchesLabels, turnDistance, underPad } from './hiding';
import { legSwimTuning } from './legs';
import {
  meetsSnackMotion,
  meetsSnackRamp,
  mobileSnackAvoid,
  oneLegCatchesTadpole,
  oneTimeDarts,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
} from './mobileSnacks';
import { PERK_CAPS, SNACK_MAGNET_PULL_SPEED } from './perks';
import { PLASTIC_WORM } from './plasticWorms';
import { POND_AREA_ID, POND_CARP, POND_LAYOUT, POND_TILAPIA } from './pondLayout';
import { CARP_SPECIES, TILAPIA_SPECIES, tunedSpecies } from './predators';
import { stepSwim, type SwimState } from './swimPhysics';
import { CARP, FINDS, LEGS, PLASTIC_WORMS, RISK, SNACK_REACH, SWIM, TILAPIA, TILAPIA_RAMP_CHASE, tripTreasureTuning } from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
  SCREEN_W,
  SNACK_HAZARD_CLEARANCE,
  SPOT_MIN_SPACING,
  SURF,
  buildCanalZone,
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
/** Least px from a plastic worm to every carp route: farther than a sweep can start (issue #132, ND-3). */
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
const FRAME = 1 / 60;
const BEAT_MAX_SECONDS = 180;
const WAYPOINT_REACH = 8;
/** How far in px a loop reaches into a depth band to count there: a tilapia body (issue #130, ND-5). */
const BAND_REACH = 24;

const zone = buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED);

function pond(seed: number): ZoneLayout {
  return buildZone(POND_LAYOUT, seed);
}

/** Every patrol loop in the zone: the tilapia routes, then the carp's. */
function predatorLoops(layout: ZoneLayout): TilapiaRoute[] {
  return [...layout.tilapiaRoutes, ...layout.predatorRoutes];
}

/** Px of the depth band that the y span of the loop's waypoints covers; 0 or less when they do not meet. */
function bandOverlap(route: TilapiaRoute, band: { top: number; bottom: number }): number {
  const ys = route.waypoints.map((point) => point.y);
  return Math.min(Math.max(...ys), band.bottom) - Math.max(Math.min(...ys), band.top);
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

/** Least distance between two closed loops; no pond loops cross, so the endpoint distances suffice. */
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

function inBounds(point: Point, layout: ZoneLayout): boolean {
  const bounds = swimBounds(layout);
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function wormCentres(layout: ZoneLayout): Point[] {
  return layout.hazards.map((hazard) => hazardCentre(hazard.shape));
}

/** One frame of a one-leg swim steered at `target`, with the pond's currents and reed drag. */
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

describe('POND_LAYOUT', () => {
  it('is Area 2 data: 5 screens across, 1 down, starting at the Home Spot', () => {
    expect(POND_AREA_ID).toBe('pond-1');
    expect(POND_LAYOUT.id).toBe(POND_AREA_ID);
    expect(zone.width).toBe(2400);
    expect(zone.height).toBe(360);
    expect(zone.chunks).toBe(5);
    expect(zone.rows).toBe(1);
    expect(zone.start).toEqual({ x: 120, y: 200 });
    expect(zone.homeSpot).toEqual({ x: 120, y: 200, radius: 72 });
    expect(zone.cave.id).toBe('pond-1/cave');
    expect(Object.isFrozen(POND_LAYOUT)).toBe(true);
    expect(Object.isFrozen(POND_LAYOUT.hazards)).toBe(true);
  });

  it('has 20 snacks, 6 plastic worms, 4 tilapia and 7 treasure slots', () => {
    for (const seed of ALL_SEEDS) {
      const layout = pond(seed);
      expect(layout.collectibles).toHaveLength(20);
      expect(layout.collectibles.filter((snack) => snack.kind === 'worm')).toHaveLength(10);
      expect(layout.collectibles.filter((snack) => snack.kind === 'bug')).toHaveLength(6);
      expect(layout.collectibles.filter((snack) => snack.kind === 'tadpole')).toHaveLength(2);
      expect(layout.collectibles.filter((snack) => snack.kind === 'shrimp')).toHaveLength(2);
      // At least the 4 placed in the stream; a stripe snack may also start there. Every one is a
      // worm or a bug, never a tadpole or a shrimp (ND-4).
      const inStream = layout.collectibles.filter((snack) => layout.currents.some((current) => isInsideCurrent(snack, current)));
      expect(inStream.length).toBeGreaterThanOrEqual(4);
      expect(inStream.map((snack) => snack.kind).filter((kind) => kind !== 'worm' && kind !== 'bug')).toEqual([]);
      expect(layout.tilapiaRoutes).toHaveLength(4);
    }
    expect(zone.hazards.map((hazard) => hazard.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `pond-1/plastic-worm-${n}`));
    for (const hazard of zone.hazards) {
      expect(hazard.type).toBe(PLASTIC_WORM);
      expect(hazard.shape).toMatchObject({ kind: 'circle', r: 0 });
    }
    expect(tripTreasureTuning(POND_AREA_ID).slots).toBe(7);
    expect(POND_LAYOUT.treasures).toBe(POND_TREASURES);
  });

  it('builds the same fixed content for every seed', () => {
    for (const seed of EXTRA_SEEDS) {
      const layout = pond(seed);
      expect(layout.spots).toEqual(zone.spots);
      expect(layout.finds).toEqual(zone.finds);
      expect(layout.pads).toEqual(zone.pads);
      expect(layout.hazards).toEqual(zone.hazards);
      expect(layout.tilapiaRoutes).toEqual(zone.tilapiaRoutes);
      expect(layout.predatorRoutes).toEqual(zone.predatorRoutes);
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
      expect(layout.mobileSnacks).toEqual(zone.mobileSnacks);
    }
  });
});

describe('pond hiding spots', () => {
  it.each(ALL_SEEDS)('match their labels, B6 and B10 included, for seed %i', (seed) => {
    const layout = pond(seed);
    const ids = layout.spots.map((spot) => spot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spot of layout.spots) {
      expect(spot.id.startsWith('pond-1/spot-'), spot.id).toBe(true);
      expect(spotMatchesLabels(spot, layout), spot.id).toBe(true);
      expect(turnDistance(spot, predatorLoops(layout)), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
    }
  });

  it.each(ALL_SEEDS)('give each rarity a pool at least as big as its pond treasures for seed %i', (seed) => {
    const layout = pond(seed);
    for (const rarity of RARITIES) {
      const treasures = POND_TREASURES.filter((treasure) => treasure.rarity === rarity).length;
      const spots = layout.spots.filter((spot) => spot.rarity === rarity).length;
      expect(spots, rarity).toBeGreaterThanOrEqual(treasures);
    }
    expect(RARITIES.map((rarity) => POND_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 2]);
    for (const find of layout.finds) {
      expect(find.pool.length, find.id).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SEEDS)('keep the Common and Rare pad spots for seed %i', (seed) => {
    const padSpots = pond(seed).spots.filter((spot) => spot.cover === 'pad');
    expect(padSpots.map((spot) => [spot.id, spot.rarity])).toEqual([
      ['pond-1/spot-pad-a', 'common'],
      ['pond-1/spot-pad-b', 'rare'],
    ]);
  });

  it.each(ALL_SEEDS)('sit in the water, out of the safe area, clear of the ring and spaced for seed %i', (seed) => {
    const layout = pond(seed);
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

describe('pond tilapia, carp, current and stranding places', () => {
  it('keeps every pair of tilapia routes more than twice the lunge range apart', () => {
    const gaps: number[] = [];
    for (let i = 0; i < zone.tilapiaRoutes.length; i++) {
      for (let j = i + 1; j < zone.tilapiaRoutes.length; j++) {
        gaps.push(routeGap(zone.tilapiaRoutes[i], zone.tilapiaRoutes[j]));
      }
    }
    expect(Math.min(...gaps)).toBeGreaterThan(2 * TILAPIA.lungeRange);
    expect(Math.min(...gaps)).toBeCloseTo(465.35, 2);
    // tilapia-0 moved beside the safe area and tilapia-1 to 211 px past carp-0 (issue #132, ND-2).
    expect(routeGap(zone.tilapiaRoutes[0], zone.tilapiaRoutes[1])).toBe(614);
  });

  it('keeps every carp loop more than the tilapia lunge range plus 60 px from every tilapia route, 210 px at the closest (issue #132, ND-3)', () => {
    const gaps = zone.predatorRoutes.flatMap((carp) => zone.tilapiaRoutes.map((route) => routeGap(carp, route)));
    expect(Math.min(...gaps)).toBeGreaterThan(TILAPIA.lungeRange + 60);
    expect(Math.min(...gaps)).toBe(210);
    expect(routeGap(zone.predatorRoutes[0], zone.tilapiaRoutes[1])).toBe(211);
    expect(routeGap(zone.predatorRoutes[1], zone.tilapiaRoutes[3])).toBe(210);
  });

  it('keeps the two carp loops more than twice the carp lunge range apart (issue #132, ND-3)', () => {
    const [first, second] = zone.predatorRoutes;
    expect(routeGap(first, second)).toBeGreaterThan(2 * CARP.lungeRange);
    expect(routeGap(first, second)).toBeCloseTo(1111.09, 2);
  });

  it('keeps tilapia and carp routes in the water and out of the safe area', () => {
    for (const route of predatorLoops(zone)) {
      for (const point of route.waypoints) {
        expect(inBounds(point, zone), route.id).toBe(true);
        expect(inSafeArea(point, zone.safeArea), route.id).toBe(false);
      }
    }
  });

  it('keeps home outside every current x span, so each current has a far side', () => {
    expect(zone.currents.length).toBeGreaterThan(0);
    for (const current of zone.currents) {
      expect(zone.homeSpot.x < current.x0 || zone.homeSpot.x > current.x1).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('keeps every stranding place 80 px from every tilapia and carp route and clear of spots, currents and the cave for seed %i', (seed) => {
    const layout = pond(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5].map((n) => `pond-1/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(shapeDistance(place, { kind: 'rect', ...layout.cave }), place.id).toBeGreaterThan(0);
      for (const route of predatorLoops(layout)) {
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

describe('pond exit', () => {
  const { exit } = POND_AREA;

  it('sits inside the bounds, out of the safe area and clear of the ring', () => {
    expect(inBounds(exit, zone)).toBe(true);
    expect(inSafeArea(exit, zone.safeArea)).toBe(false);
    expect(Math.hypot(exit.x - zone.homeSpot.x, exit.y - zone.homeSpot.y)).toBeGreaterThan(zone.homeSpot.radius + exit.radius);
  });

  it('is farther than a carp sweep plus the exit radius from every carp loop (issue #132, ND-3)', () => {
    for (const route of zone.predatorRoutes) {
      for (const [a, b] of loopSegments(route.waypoints)) {
        expect(distanceToSegment(exit, a, b), route.id).toBeGreaterThan(CARP.lungeRange + exit.radius);
      }
    }
  });

  it.each(ALL_SEEDS)('is clear of every hiding spot by the exit and pickup radii for seed %i', (seed) => {
    const clearance = exit.radius + FINDS.pickupRadius;
    for (const spot of pond(seed).spots) {
      expect(Math.hypot(spot.x - exit.x, spot.y - exit.y), spot.id).toBeGreaterThanOrEqual(clearance);
    }
  });
});

describe('pond plastic worms', () => {
  const worms = wormCentres(zone);

  it('sit outside the safe area and the Home Spot ring', () => {
    for (const worm of worms) {
      expect(inSafeArea(worm, zone.safeArea)).toBe(false);
      expect(Math.hypot(worm.x - zone.homeSpot.x, worm.y - zone.homeSpot.y)).toBeGreaterThan(zone.homeSpot.radius + PLASTIC_WORM.reach);
      expect(inBounds(worm, zone)).toBe(true);
    }
  });

  it('sit farther than a lunge from every tilapia route and a sweep from every carp route', () => {
    for (const [index, worm] of worms.entries()) {
      for (const route of zone.tilapiaRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_ROUTE_CLEARANCE);
        }
      }
      for (const route of zone.predatorRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_CARP_CLEARANCE);
        }
      }
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

describe('pond snacks', () => {
  const drift = POND_AREA.snackDrift;
  const surfacePeak = SURF + 1.6 + 0.8;

  it.each(ALL_SEEDS)('start at least SNACK_HAZARD_CLEARANCE from every plastic worm for seed %i', (seed) => {
    const layout = pond(seed);
    for (const snack of layout.collectibles) {
      for (const hazard of layout.hazards) {
        expect(shapeDistance(snack, hazard.shape), `${snack.id} to ${hazard.id}`).toBeGreaterThanOrEqual(SNACK_HAZARD_CLEARANCE);
      }
    }
  });

  it.each(ALL_SEEDS)('stay in the water and out of the ring while drifting for seed %i', (seed) => {
    const layout = pond(seed);
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

  it('drift slower than a one-leg axolotl swims against the strongest current, and at most half the magnet pull', () => {
    const strongestCurrent = Math.max(...zone.currents.map((current) => Math.hypot(current.force.x, current.force.y)));
    const oneLegNet = SWIM.maxSpeed * LEGS.speedByLegs[0] - strongestCurrent;
    expect(snackDriftMaxSpeed(drift)).toBeCloseTo(14.8, 1);
    expect(snackDriftMaxSpeed(drift)).toBeLessThan(oneLegNet);
    expect(snackDriftMaxSpeed(drift)).toBeLessThanOrEqual(SNACK_MAGNET_PULL_SPEED / 2);
  });
});

describe('pond difficulty', () => {
  const canal = buildCanalZone();

  it('is harder than the canal: wider, more tilapia, more snacks, faster drift and a hazard', () => {
    expect(zone.width).toBeGreaterThan(canal.width);
    expect(zone.tilapiaRoutes.length).toBeGreaterThan(canal.tilapiaRoutes.length);
    expect(zone.collectibles.length).toBeGreaterThan(canal.collectibles.length);
    expect(snackDriftMaxSpeed(POND_AREA.snackDrift)).toBeGreaterThan(snackDriftMaxSpeed(CANAL_AREA.snackDrift));
    expect(canal.hazards).toHaveLength(0);
    expect(zone.hazards.length).toBeGreaterThan(0);
  });
});

describe('beating the pond', () => {
  it('lets a one-leg axolotl swim the main path, through the stream, to the exit and back home', () => {
    const exit = POND_AREA.exit;
    const there = [...zone.mainPath.slice(1), exit];
    const toExit = oneLegSeconds(zone.start, there, zone, (pos) => Math.hypot(pos.x - exit.x, pos.y - exit.y) <= exit.radius);
    expect(toExit).toBeLessThan(BEAT_MAX_SECONDS);
    const back = [...zone.mainPath].reverse();
    const home = oneLegSeconds(exit, back, zone, (pos) => inHomeSpot(pos, zone.homeSpot));
    expect(home).toBeLessThan(BEAT_MAX_SECONDS);
  });

  it.each(ALL_SEEDS)('puts every snack the exit needs in the swim bounds for seed %i', (seed) => {
    const layout = pond(seed);
    const mobile = (POND_LAYOUT.mobileSnacks?.wanders.length ?? 0) + (POND_LAYOUT.mobileSnacks?.homes.length ?? 0);
    expect(layout.collectibles).toHaveLength(POND_LAYOUT.snackWorms + POND_LAYOUT.snackBugs + mobile);
    for (const snack of layout.collectibles) {
      expect(inBounds(snack, layout), snack.id).toBe(true);
    }
  });
});

describe('pond tilapia chase (issue #132, ND-1)', () => {
  it('is TILAPIA with the ramp chase as it is: sight 200, leash 80 and speed 115', () => {
    expect(POND_LAYOUT.tilapia).toBe(POND_TILAPIA);
    expect(POND_TILAPIA.chase).toBe(TILAPIA_RAMP_CHASE);
    expect(POND_TILAPIA.chase).toEqual({ sight: 200, leash: 80, speed: 115 });
    const { chase, ...rest } = POND_TILAPIA;
    expect(chase).toBeDefined();
    expect(rest).toEqual(TILAPIA);
    expect(() => tunedSpecies(TILAPIA_SPECIES, POND_TILAPIA)).not.toThrow();
    expect(Object.isFrozen(POND_TILAPIA)).toBe(true);
    expect(Object.isFrozen(POND_TILAPIA.chase)).toBe(true);
  });

  it.each(ALL_SEEDS)('plays in the zone for seed %i', (seed) => {
    expect(pond(seed).tilapia).toEqual(POND_TILAPIA);
  });
});

describe('pond common carp (issue #132, ND-3)', () => {
  it('is CARP with a chase of sight 220, leash 60 and speed 115, a danger part inside the chase limits', () => {
    expect(POND_CARP.id).toBe(CARP_SPECIES.id);
    expect(POND_CARP.id).toBe('carp');
    expect(POND_CARP.tuning).toEqual({ ...CARP, chase: { sight: 220, leash: 60, speed: 115 } });
    expect(POND_CARP.dangerPart).toBe(true);
    expect(() => tunedSpecies(CARP_SPECIES, POND_CARP.tuning)).not.toThrow();
    expect(Object.isFrozen(POND_CARP)).toBe(true);
    expect(Object.isFrozen(POND_CARP.tuning)).toBe(true);
    expect(Object.isFrozen(POND_CARP.tuning.chase)).toBe(true);
  });

  it.each(ALL_SEEDS)('plays every carp route in the zone for seed %i', (seed) => {
    const layout = pond(seed);
    expect(layout.predatorRoutes).toHaveLength(2);
    for (const route of layout.predatorRoutes) expect(route.species, route.id).toBe(POND_CARP);
  });
});

describe('pond whole-water ramp bar on the default seed (PRD N2; issue #132, ND-1 to ND-3, ND-6)', () => {
  it('meets the Area 2 whole-water ramp bar', () => {
    expect(meetsWholeWaterRampBar(2, zone)).toBe(true);
  });

  it('has a longest quiet swim of 241.4 px, from the bed to the surface between tilapia-1 and tilapia-2', () => {
    const swim = longestQuietSwim(zone);
    expect(swim?.length).toBeCloseTo(241.383, 2);
    expect(swim?.from).toEqual({ x: 1256, y: 296 });
    expect(swim?.to).toEqual({ x: 1168, y: 94 });
    expect(swim?.length).toBeLessThanOrEqual(SCREEN_W);
  });

  it('splits the swim water into three depth bands, and patrols each tilapia and carp loop through at least two', () => {
    const bands = depthBands(zone);
    expect(bands.map((band) => [band.top, band.bottom])).toEqual([
      [94, expect.closeTo(161.333, 2)],
      [expect.closeTo(161.333, 2), expect.closeTo(228.667, 2)],
      [expect.closeTo(228.667, 2), 296],
    ]);
    expect(meetsDepthRule(zone)).toBe(true);
    for (const route of predatorLoops(zone)) {
      expect(bands.filter((band) => bandOverlap(route, band) >= BAND_REACH).length, route.id).toBeGreaterThanOrEqual(2);
    }
    for (const species of [zone.tilapiaRoutes, zone.predatorRoutes]) {
      for (const band of bands) {
        expect(Math.max(...species.map((route) => bandOverlap(route, band))), `band from ${band.top}`).toBeGreaterThanOrEqual(BAND_REACH);
      }
    }
  });

  it('has no danger from the surface, so the floor rule holds, with a floor quiet stretch of 55 px', () => {
    expect(hasSurfaceDanger(zone)).toBe(false);
    expect(floorQuietStretch(zone)).toBe(55);
    expect(floorQuietStretch(zone)).toBeLessThanOrEqual(SCREEN_W);
    expect(meetsFloorRule(zone)).toBe(true);
  });

  it('has the 2 carp the carp rule asks for over 5 screens', () => {
    expect(carpCount(zone)).toBe(2);
    expect(carpCount(zone)).toBeGreaterThanOrEqual(carpTarget(5));
    expect(zone.predatorRoutes.map((route) => route.id)).toEqual(['carp-0', 'carp-1']);
  });

  it('has 4 chasing tilapia routes and no moving hazards', () => {
    expect(movingHazardTypeCount(zone)).toBe(0);
    expect(zone.movingHazards ?? []).toHaveLength(0);
    expect(zone.tilapiaRoutes).toHaveLength(4);
  });
});

describe('pond mobile snacks (issue #121, ND-4 to ND-6; issue #132, ND-5)', () => {
  const mix = POND_LAYOUT.mobileSnacks;

  it('meets the Area 2 snack ramp', () => {
    expect(meetsSnackRamp(2, POND_LAYOUT)).toBe(true);
  });

  it('has 40 px/s tadpoles on a west and an east wander loop half a lap out of step, and two shrimp on 3-spot homes', () => {
    expect(mix?.tadpole).toEqual({ speed: 40 });
    expect(mix?.wanders.map((wander) => wander.points.map((point) => [point.x, point.y]))).toEqual([
      [[492, 110], [630, 104], [812, 170], [700, 290], [600, 288], [492, 280]],
      [[1034, 135], [1024, 288], [1200, 290], [1346, 286], [1200, 250], [1100, 240]],
    ]);
    expect(mix?.wanders.map((wander) => wander.offset)).toEqual([0, expect.closeTo(10.6286, 3)]);
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 2, flickDistance: 36, flickSpeed: 100 });
    expect(mix?.homes.map((home) => home.points.map((point) => [point.x, point.y]))).toEqual([
      [[510, 120], [575, 140], [525, 190]],
      [[1650, 285], [1720, 285], [1690, 240]],
    ]);
  });

  it('moves its tadpoles and shrimp as the snack motion rules ask (issue #132, ND-5)', () => {
    expect(meetsSnackMotion(POND_LAYOUT)).toBe(true);
  });

  it('lets a one-leg axolotl catch each tadpole on its wander loop (issue #132, ND-5)', () => {
    const rule = mix?.tadpole;
    expect(rule).toBeDefined();
    expect(mix?.wanders).toHaveLength(2);
    for (const wander of mix?.wanders ?? []) {
      expect(oneLegCatchesTadpole(rule ?? { speed: 0 }, wander, swimBounds(zone)), `loop at ${wander.points[0].x}`).toBe(true);
    }
  });

  it.each(ALL_SEEDS)('passes tadpoleWanderClear and shrimpHomeClear for every tadpole and shrimp for seed %i (issue #131, ND-7)', (seed) => {
    const avoid = mobileSnackAvoid(pond(seed));
    for (const wander of mix?.wanders ?? []) {
      expect(tadpoleWanderClear(wander, avoid), `loop at ${wander.points[0].x}, ${wander.points[0].y}`).toBe(true);
    }
    for (const home of mix?.homes ?? []) {
      expect(shrimpHomeClear(home, POND_AREA.snackDrift, avoid), `home at ${home.points[0].x}, ${home.points[0].y}`).toBe(true);
    }
  });

  it('pulls with the Snack magnet at 48 px/s, 1.2 times the 40 px/s tadpole (issue #131, ND-8)', () => {
    expect(snackMagnetSpeed(SNACK_MAGNET_PULL_SPEED, zone)).toBe(48);
  });

  it.each(ALL_SEEDS)('has no one-time darters (ND-6) for seed %i', (seed) => {
    expect(oneTimeDarts(POND_AREA, pond(seed))).toBeNull();
  });
});
