import { describe, expect, it } from 'vitest';
import { CANAL_AREA, POND_AREA } from './areas';
import { POND_TREASURES, RARITIES } from './catalogue';
import { createCollectibles, snackDriftMaxSpeed, snackX, snackY } from './collectibles';
import { longestQuietStretch, meetsRampDangerBar, movingHazardTypeCount } from './dangerBar';
import { currentAt, reedDragAt } from './environment';
import { hazardCentre, shapeDistance } from './hazards';
import { spotMatchesLabels, turnDistance, underPad } from './hiding';
import { legSwimTuning } from './legs';
import {
  meetsSnackRamp,
  mobileLegBoxes,
  mobileSnackAvoid,
  mobileSnackClear,
  oneTimeDarts,
  shrimpBox,
  shrimpHomeClear,
  snackMagnetSpeed,
  tadpoleWanderClear,
} from './mobileSnacks';
import { PERK_CAPS, SNACK_MAGNET_PULL_SPEED } from './perks';
import { PLASTIC_WORM } from './plasticWorms';
import { POND_AREA_ID, POND_LAYOUT, POND_TILAPIA } from './pondLayout';
import { TILAPIA_SPECIES, tunedSpecies } from './predators';
import { stepSwim, type SwimState } from './swimPhysics';
import { FINDS, LEGS, PLASTIC_WORMS, RISK, SNACK_REACH, SWIM, TILAPIA, TILAPIA_RAMP_CHASE, tripTreasureTuning } from './tuning';
import { normalize } from './vec';
import {
  DEFAULT_ZONE_SEED,
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
/** The pond's longest main path stretch with no chasing tilapia in reach, in px (issue #121, ND-2). */
const QUIET_STRETCH = 390;

const zone = buildZone(POND_LAYOUT, DEFAULT_ZONE_SEED);

function pond(seed: number): ZoneLayout {
  return buildZone(POND_LAYOUT, seed);
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
      expect(layout.strandingPlaces).toEqual(zone.strandingPlaces);
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
      expect(turnDistance(spot, layout.tilapiaRoutes), spot.id).toBeGreaterThanOrEqual(RISK.turnClearance);
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

describe('pond tilapia, current and stranding places', () => {
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

  it('keeps tilapia routes in the water and out of the safe area', () => {
    for (const route of zone.tilapiaRoutes) {
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

  it.each(ALL_SEEDS)('keeps every stranding place 80 px from every route and clear of spots, currents and the cave for seed %i', (seed) => {
    const layout = pond(seed);
    expect(layout.strandingPlaces.map((place) => place.id)).toEqual([1, 2, 3, 4, 5].map((n) => `pond-1/strand-${n}`));
    for (const place of layout.strandingPlaces) {
      expect(inBounds(place, layout), place.id).toBe(true);
      expect(inSafeArea(place, layout.safeArea), place.id).toBe(false);
      expect(layout.currents.some((current) => isInsideCurrent(place, current)), place.id).toBe(false);
      expect(shapeDistance(place, { kind: 'rect', ...layout.cave }), place.id).toBeGreaterThan(0);
      for (const route of layout.tilapiaRoutes) {
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

  it('sit farther than a lunge from every tilapia route', () => {
    for (const [index, worm] of worms.entries()) {
      for (const route of zone.tilapiaRoutes) {
        for (const [a, b] of loopSegments(route.waypoints)) {
          expect(distanceToSegment(worm, a, b), `worm ${index + 1} to ${route.id}`).toBeGreaterThan(WORM_ROUTE_CLEARANCE);
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

describe('pond tilapia chase (issue #121, ND-1)', () => {
  it('is TILAPIA with the ramp chase on a 60 px leash, the shortest of any area', () => {
    expect(POND_LAYOUT.tilapia).toBe(POND_TILAPIA);
    expect(POND_TILAPIA.chase).toEqual({ sight: 200, leash: 60, speed: 115 });
    const { chase, ...rest } = POND_TILAPIA;
    expect(chase).toBeDefined();
    expect(rest).toEqual(TILAPIA);
    expect(() => tunedSpecies(TILAPIA_SPECIES, POND_TILAPIA)).not.toThrow();
    expect(POND_TILAPIA.chase?.leash).toBeLessThan(TILAPIA_RAMP_CHASE.leash);
    expect(Object.isFrozen(POND_TILAPIA)).toBe(true);
    expect(Object.isFrozen(POND_TILAPIA.chase)).toBe(true);
  });

  it.each(ALL_SEEDS)('plays in the zone for seed %i', (seed) => {
    expect(pond(seed).tilapia).toEqual(POND_TILAPIA);
  });
});

describe('pond ramp danger bar (issue #121, ND-2, ND-3)', () => {
  it.each(ALL_SEEDS)('meets the Area 2 ramp bar with 4 chasing tilapia and no moving hazards for seed %i', (seed) => {
    const layout = pond(seed);
    expect(meetsRampDangerBar(2, layout)).toBe(true);
    expect(longestQuietStretch(layout)).toBe(QUIET_STRETCH);
    expect(movingHazardTypeCount(layout)).toBe(0);
    expect(layout.movingHazards ?? []).toHaveLength(0);
    expect(layout.tilapiaRoutes).toHaveLength(4);
  });
});

describe('pond mobile snacks (issue #121, ND-4 to ND-6; issue #131, ND-14)', () => {
  const mix = POND_LAYOUT.mobileSnacks;

  it('meets the Area 2 snack ramp', () => {
    expect(meetsSnackRamp(2, POND_LAYOUT)).toBe(true);
  });

  it('has 40 px/s tadpoles on two 2-point wander loops, 6 s a lap with the second 3 s ahead, and two shrimp on 1-spot homes', () => {
    expect(mix?.tadpole).toEqual({ speed: 40 });
    expect(mix?.wanders).toEqual([
      { points: [{ x: 320, y: 210 }, { x: 440, y: 210 }], offset: 0 },
      { points: [{ x: 1744, y: 140 }, { x: 1744, y: 260 }], offset: 3 },
    ]);
    expect(mix?.shrimp).toEqual({ triggerRadius: 60, restFor: 2, flickDistance: 36, flickSpeed: 100 });
    expect(mix?.homes).toEqual([{ points: [{ x: 860, y: 106 }] }, { points: [{ x: 2320, y: 130 }] }]);
  });

  it.each(ALL_SEEDS)('keeps every tadpole leg and shrimp clear of what a mobile snack avoids for seed %i', (seed) => {
    const layout = pond(seed);
    const avoid = mobileSnackAvoid(layout);
    for (const box of mobileLegBoxes(layout)) {
      expect(mobileSnackClear(box, avoid), `leg at ${box.x0}, ${box.y0}`).toBe(true);
    }
    for (const home of mix?.homes ?? []) {
      const spot = home.points[0];
      expect(mobileSnackClear(shrimpBox(spot, POND_AREA.snackDrift), avoid), `shrimp at ${spot.x}, ${spot.y}`).toBe(true);
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
