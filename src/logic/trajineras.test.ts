import { describe, expect, it } from 'vitest';
import { DEEP_CANAL_LAYOUT } from './deepCanalLayout';
import { currentAt } from './environment';
import { elementActive, elementSweep, type HazardRect } from './hazards';
import { PEBBLES, bodyInAnyRock, type RockWall } from './pebble';
import { stepSwim, type SwimState } from './swimPhysics';
import {
  GLIDING_TRAJINERA,
  TRAJINERAS,
  TRAJINERA_MAX_SPAN,
  blockAtTrajineras,
  bodyTouchesHull,
  createTrajineraLane,
  pushFromTrajineras,
  pushOutOfHull,
  stepTrajineraLane,
  tickTrajineraLane,
  trajineraBob,
  trajineraHull,
  trajineraHullBand,
  trajineraPush,
  trajineraShadow,
  trajineraSpawn,
  trajineras,
  type TrajineraLane,
  type TrajineraSpawn,
} from './trajineras';
import { TILAPIA } from './tuning';
import { SURF, areaSize, swimBounds, type CurrentZone, type Point, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(8, 2));
const REACH = TRAJINERAS.bodyReach;
const HULL_BOTTOM = SURF + TRAJINERAS.hullDepth;
const RIGHT = trajineraSpawn('deep/boat-1', 0, { x0: 1000, x1: 1280, direction: 'right' });
const LEFT = trajineraSpawn('deep/boat-2', 3, { x0: 2000, x1: 2280, direction: 'left' });

function hullAt(boat: TrajineraSpawn, t: number): HazardRect {
  const hull = trajineraHull(boat, t);
  if (hull === null) throw new Error(`expected a hull for ${boat.id} at ${t}`);
  return hull;
}

describe('trajinera tuning (issue #78, ND-8, ND-9)', () => {
  it('glides at 70 px/s, starts a crossing every 6 s and blocks the top 60 px of water', () => {
    expect(TRAJINERAS.speed).toBe(70);
    expect(GLIDING_TRAJINERA.period).toBe(6);
    expect(TRAJINERAS.hullDepth).toBe(60);
  });

  it('leads the hull with the shadow by 1 s of travel, 70 px', () => {
    expect(TRAJINERAS.shadowLead).toBe(1);
    expect(TRAJINERAS.shadowLead * TRAJINERAS.speed).toBe(70);
  });

  it('pushes no harder than the tilapia bump, with a short cooldown', () => {
    expect(TRAJINERAS.pushSpeed).toBeGreaterThan(0);
    expect(TRAJINERAS.pushSpeed).toBeLessThanOrEqual(TILAPIA.bumpSpeed);
    expect(TRAJINERAS.pushCooldown).toBeGreaterThan(0);
    expect(TRAJINERAS.pushCooldown).toBeLessThanOrEqual(1);
  });

  it('measures the body with the pebble reach', () => {
    expect(TRAJINERAS.bodyReach).toBe(PEBBLES.bodyReach);
  });

  it('fits a hull across the longest span within one crossing period', () => {
    expect(TRAJINERA_MAX_SPAN + TRAJINERAS.hullLength).toBe(TRAJINERAS.speed * GLIDING_TRAJINERA.period);
    expect(TRAJINERA_MAX_SPAN).toBeGreaterThan(0);
  });
});

describe('the gliding trajinera element', () => {
  it('is a timing element with no fact card and no meet range', () => {
    expect(GLIDING_TRAJINERA.id).toBe('gliding-trajinera');
    expect(GLIDING_TRAJINERA.kind).toBe('cycle');
    expect(GLIDING_TRAJINERA).not.toHaveProperty('fact');
    expect(GLIDING_TRAJINERA).not.toHaveProperty('meetRange');
    expect(Object.isFrozen(GLIDING_TRAJINERA)).toBe(true);
  });

  it('has no element sweep, so it is never a mat', () => {
    expect(elementSweep(RIGHT)).toBeNull();
  });

  it('keeps its crossing clock always running', () => {
    for (const t of [0, 1.5, 5.99, -2, 600]) expect(elementActive(RIGHT, t)).toBe(true);
  });
});

describe('trajineraSpawn', () => {
  it('builds a boat with its own copy of the crossing', () => {
    const crossing = { x0: 100, x1: 300, direction: 'left' as const };
    const boat = trajineraSpawn('boat', 1.5, crossing);
    expect(boat).toStrictEqual({ id: 'boat', type: GLIDING_TRAJINERA, offset: 1.5, trajinera: crossing });
    expect(boat.trajinera).not.toBe(crossing);
  });

  it('takes a span of exactly TRAJINERA_MAX_SPAN', () => {
    expect(() => trajineraSpawn('boat', 0, { x0: 0, x1: TRAJINERA_MAX_SPAN, direction: 'right' })).not.toThrow();
  });

  it.each([
    ['no width', { x0: 100, x1: 100 }],
    ['a reversed span', { x0: 300, x1: 100 }],
    ['a span that is not finite', { x0: 100, x1: Number.POSITIVE_INFINITY }],
    ['a NaN edge', { x0: Number.NaN, x1: 100 }],
    ['a span over TRAJINERA_MAX_SPAN', { x0: 0, x1: TRAJINERA_MAX_SPAN + 1 }],
  ])('refuses %s', (_, span) => {
    expect(() => trajineraSpawn('boat', 0, { ...span, direction: 'right' })).toThrow(RangeError);
  });

  it('refuses a direction that is not left or right', () => {
    const crossing = { x0: 0, x1: 100, direction: 'up' } as unknown as TrajineraSpawn['trajinera'];
    expect(() => trajineraSpawn('boat', 0, crossing)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('refuses offset %s', (offset) => {
    expect(() => trajineraSpawn('boat', offset, { x0: 0, x1: 100, direction: 'right' })).toThrow(RangeError);
  });
});

describe('trajineras', () => {
  it('lists the boats in element order and skips every other element', () => {
    const other = { id: 'plant', type: GLIDING_TRAJINERA, offset: 0 };
    expect(trajineras([LEFT, other, RIGHT])).toEqual([LEFT, RIGHT]);
    expect(trajineras([])).toEqual([]);
  });
});

describe('trajineraHullBand', () => {
  it('is the span across the top 60 px of water', () => {
    expect(trajineraHullBand(RIGHT)).toEqual({ kind: 'rect', x0: 1000, x1: 1280, y0: SURF, y1: SURF + 60 });
  });

  it.each([0.5, 1, 2.75, 4, 5.3])('holds the hull at %s s', (t) => {
    const band = trajineraHullBand(RIGHT);
    const hull = hullAt(RIGHT, t);
    expect(hull.x0).toBeGreaterThanOrEqual(band.x0);
    expect(hull.x1).toBeLessThanOrEqual(band.x1);
    expect(hull.y0).toBe(band.y0);
    expect(hull.y1).toBe(band.y1);
  });
});

describe('trajineraHull', () => {
  it('has no hull at the very start of a crossing', () => {
    expect(trajineraHull(RIGHT, 0)).toBeNull();
  });

  it('glides the nose in from the upstream end at 70 px/s, clipped to the span', () => {
    expect(hullAt(RIGHT, 1)).toEqual({ kind: 'rect', x0: 1000, x1: 1070, y0: SURF, y1: HULL_BOTTOM });
    expect(hullAt(RIGHT, 2)).toEqual({ kind: 'rect', x0: 1020, x1: 1140, y0: SURF, y1: HULL_BOTTOM });
  });

  it('glides the tail out of the far end', () => {
    expect(hullAt(RIGHT, 5).x0).toBeCloseTo(1230, 9);
    expect(hullAt(RIGHT, 5).x1).toBe(1280);
  });

  it('is gone once the tail leaves the span, until the next crossing', () => {
    const crossing = (280 + TRAJINERAS.hullLength) / TRAJINERAS.speed;
    expect(crossing).toBeLessThan(GLIDING_TRAJINERA.period);
    expect(trajineraHull(RIGHT, crossing - 0.01)).not.toBeNull();
    expect(trajineraHull(RIGHT, crossing)).toBeNull();
    expect(trajineraHull(RIGHT, 5.9999)).toBeNull();
  });

  it('repeats every crossing period, for any time, negative included', () => {
    for (const t of [0.4, 1, 3.3, 5.5]) {
      const hull = hullAt(RIGHT, t);
      for (const later of [hullAt(RIGHT, t + 6), hullAt(RIGHT, t - 60)]) {
        expect(later.x0).toBeCloseTo(hull.x0, 9);
        expect(later.x1).toBeCloseTo(hull.x1, 9);
        expect(later.y0).toBe(hull.y0);
        expect(later.y1).toBe(hull.y1);
      }
    }
  });

  it('glides a left boat in from the right end', () => {
    const boat = trajineraSpawn('boat', 0, { x0: 2000, x1: 2280, direction: 'left' });
    expect(hullAt(boat, 1)).toEqual({ kind: 'rect', x0: 2210, x1: 2280, y0: SURF, y1: HULL_BOTTOM });
    expect(hullAt(boat, 2)).toEqual({ kind: 'rect', x0: 2140, x1: 2260, y0: SURF, y1: HULL_BOTTOM });
  });

  it('starts each crossing at its offset', () => {
    expect(trajineraHull(LEFT, 3)).toBeNull();
    expect(hullAt(LEFT, 4)).toEqual({ kind: 'rect', x0: 2210, x1: 2280, y0: SURF, y1: HULL_BOTTOM });
  });

  it('keeps two boats with offsets 0 and 3 out of step', () => {
    for (let t = 0; t < 12; t += 0.25) {
      const rightPhase = ((t - RIGHT.offset) % 6 + 6) % 6;
      const leftPhase = ((t - LEFT.offset) % 6 + 6) % 6;
      expect(Math.abs(rightPhase - leftPhase)).toBe(3);
    }
  });
});

describe('trajineraShadow', () => {
  it('leads the hull by 70 px mid-crossing', () => {
    const shadow = trajineraShadow(RIGHT, 2);
    expect(shadow).toEqual({ kind: 'rect', x0: 1090, x1: 1210, y0: SURF, y1: HULL_BOTTOM });
    expect(shadow?.x1).toBe(hullAt(RIGHT, 2).x1 + 70);
  });

  it('shows 1 s before the hull enters, as the warning', () => {
    expect(trajineraHull(RIGHT, 5.5 + 6)).not.toBeNull();
    expect(trajineraHull(RIGHT, 6)).toBeNull();
    expect(trajineraShadow(RIGHT, 5.5)).toEqual(trajineraHull(RIGHT, 6.5));
    expect(trajineraShadow(RIGHT, 5.5)).not.toBeNull();
  });

  it('leads a left boat to the left', () => {
    const boat = trajineraSpawn('boat', 0, { x0: 2000, x1: 2280, direction: 'left' });
    expect(trajineraShadow(boat, 2)?.x0).toBe(hullAt(boat, 2).x0 - 70);
  });
});

describe('trajineraBob', () => {
  it('never bobs under reduced motion', () => {
    for (let t = 0; t < 5; t += 0.1) expect(trajineraBob(RIGHT, t, true)).toBe(0);
  });

  it('bobs gently within the amplitude in full motion', () => {
    const bobs = Array.from({ length: 50 }, (_, i) => trajineraBob(RIGHT, i * 0.1, false));
    for (const bob of bobs) expect(Math.abs(bob)).toBeLessThanOrEqual(TRAJINERAS.bobAmplitude);
    expect(bobs.some((bob) => Math.abs(bob) > 1)).toBe(true);
  });

  it('bobs two boats out of step', () => {
    expect(trajineraBob(RIGHT, 0.6, false)).not.toBeCloseTo(trajineraBob(LEFT, 0.6, false), 3);
  });

  it('never moves the hull: reduced motion leaves the glide as it is', () => {
    expect(trajineraHull(RIGHT, 2)).toEqual(hullAt(RIGHT, 2));
  });
});

describe('bodyTouchesHull', () => {
  const hull: HazardRect = { kind: 'rect', x0: 1000, x1: 1120, y0: SURF, y1: HULL_BOTTOM };

  it('touches inside and within the body reach', () => {
    expect(bodyTouchesHull({ x: 1060, y: 110 }, hull)).toBe(true);
    expect(bodyTouchesHull({ x: 1060, y: HULL_BOTTOM + REACH - 0.5 }, hull)).toBe(true);
  });

  it('leaves the reach edge clear', () => {
    expect(bodyTouchesHull({ x: 1060, y: HULL_BOTTOM + REACH }, hull)).toBe(false);
    expect(bodyTouchesHull({ x: 1000 - REACH, y: 110 }, hull)).toBe(false);
  });
});

describe('pushOutOfHull', () => {
  const hull: HazardRect = { kind: 'rect', x0: 1000, x1: 1120, y0: SURF, y1: HULL_BOTTOM };

  it('goes straight down when that is shortest', () => {
    expect(pushOutOfHull({ x: 1060, y: 130 }, hull, BOUNDS, [])).toEqual({ x: 1060, y: HULL_BOTTOM + REACH });
  });

  it('goes sideways when that is shortest', () => {
    expect(pushOutOfHull({ x: 1005, y: 100 }, hull, BOUNDS, [])).toEqual({ x: 1000 - REACH, y: 100 });
    expect(pushOutOfHull({ x: 1115, y: 100 }, hull, BOUNDS, [])).toEqual({ x: 1120 + REACH, y: 100 });
  });

  it('never goes up', () => {
    const pos = { x: 1060, y: BOUNDS.minY };
    const way = pushOutOfHull(pos, hull, BOUNDS, []);
    expect(way?.y).toBeGreaterThanOrEqual(pos.y);
  });

  it('takes down on a tie', () => {
    const square: HazardRect = { kind: 'rect', x0: 1000, x1: 1100, y0: SURF, y1: 180 };
    expect(pushOutOfHull({ x: 1050, y: 150 }, square, BOUNDS, [])).toEqual({ x: 1050, y: 180 + REACH });
  });

  it('never goes out of the swim bounds', () => {
    const atEdge: HazardRect = { kind: 'rect', x0: 30, x1: 150, y0: SURF, y1: HULL_BOTTOM };
    expect(pushOutOfHull({ x: 45, y: 100 }, atEdge, BOUNDS, [])).toEqual({ x: 45, y: HULL_BOTTOM + REACH });
  });

  it('never goes into rock', () => {
    const below: RockWall = { x0: 1040, x1: 1080, y0: 160, y1: 300 };
    expect(pushOutOfHull({ x: 1060, y: 130 }, hull, BOUNDS, [below])).toEqual({ x: 1000 - REACH, y: 130 });
  });

  it('is null when every way is out of bounds or in rock', () => {
    const walls: RockWall[] = [
      { x0: 900, x1: 990, y0: SURF, y1: 300 },
      { x0: 1130, x1: 1200, y0: SURF, y1: 300 },
      { x0: 990, x1: 1130, y0: 160, y1: 300 },
    ];
    expect(pushOutOfHull({ x: 1060, y: 110 }, hull, BOUNDS, walls)).toBeNull();
  });
});

describe('trajineraPush', () => {
  it('pushes a touching body out the shortest way at the push speed', () => {
    const push = trajineraPush(RIGHT, { x: 1100, y: 130 }, 2, BOUNDS, []);
    expect(push).toEqual({
      id: 'deep/boat-1',
      from: { x: 1100, y: 130 },
      to: { x: 1100, y: HULL_BOTTOM + REACH },
      impulse: { x: 0, y: TRAJINERAS.pushSpeed },
    });
  });

  it('never pushes harder than the tilapia bump', () => {
    for (const pos of [{ x: 1022, y: 100 }, { x: 1138, y: 100 }, { x: 1080, y: 140 }]) {
      const push = trajineraPush(RIGHT, pos, 2, BOUNDS, []);
      expect(push).not.toBeNull();
      expect(Math.hypot(push?.impulse.x ?? 0, push?.impulse.y ?? 0)).toBeCloseTo(TRAJINERAS.pushSpeed, 9);
      expect(Math.hypot(push?.impulse.x ?? 0, push?.impulse.y ?? 0)).toBeLessThanOrEqual(TILAPIA.bumpSpeed);
    }
  });

  it('pushes sideways ahead of the nose', () => {
    const push = trajineraPush(RIGHT, { x: 1138, y: 100 }, 2, BOUNDS, []);
    expect(push?.to).toEqual({ x: 1140 + REACH, y: 100 });
    expect(push?.impulse).toEqual({ x: TRAJINERAS.pushSpeed, y: 0 });
  });

  it('gives no push away from the hull or while the hull is out of its span', () => {
    expect(trajineraPush(RIGHT, { x: 1100, y: HULL_BOTTOM + REACH }, 2, BOUNDS, [])).toBeNull();
    expect(trajineraPush(RIGHT, { x: 1100, y: 100 }, 0, BOUNDS, [])).toBeNull();
    expect(trajineraPush(RIGHT, { x: 1200, y: 100 }, 1, BOUNDS, [])).toBeNull();
  });
});

describe('the trajinera lane', () => {
  const touching = { x: 1100, y: 130 };

  it('copies the boats, bounds and rocks with every cooldown at 0', () => {
    const rocks: RockWall[] = [{ x0: 0, x1: 10, y0: 0, y1: 10 }];
    const lane = createTrajineraLane([RIGHT, LEFT], BOUNDS, rocks);
    expect(lane).toEqual({ boats: [RIGHT, LEFT], bounds: BOUNDS, rocks, cooldowns: [0, 0] });
    expect(lane.boats[0]).not.toBe(RIGHT);
    expect(lane.boats[0].trajinera).not.toBe(RIGHT.trajinera);
    expect(lane.bounds).not.toBe(BOUNDS);
    expect(lane.rocks[0]).not.toBe(rocks[0]);
  });

  it('ticks nothing and keeps the lane itself when every cooldown is 0', () => {
    const lane = createTrajineraLane([RIGHT], BOUNDS, []);
    expect(tickTrajineraLane(lane, 0.1)).toBe(lane);
  });

  it('counts cooldowns down to 0 and no further', () => {
    const lane = { ...createTrajineraLane([RIGHT, LEFT], BOUNDS, []), cooldowns: [0.5, 0.05] };
    expect(tickTrajineraLane(lane, 0.1).cooldowns).toEqual([0.4, 0]);
  });

  it('pushes from the first ready boat and starts its cooldown', () => {
    const lane = createTrajineraLane([RIGHT, LEFT], BOUNDS, []);
    const pushed = pushFromTrajineras(lane, touching, 2);
    expect(pushed?.push).toEqual(trajineraPush(RIGHT, touching, 2, BOUNDS, []));
    expect(pushed?.lane.cooldowns).toEqual([TRAJINERAS.pushCooldown, 0]);
    expect(lane.cooldowns).toEqual([0, 0]);
  });

  it('gives no push from a boat in its cooldown', () => {
    const lane = { ...createTrajineraLane([RIGHT], BOUNDS, []), cooldowns: [0.2] };
    expect(pushFromTrajineras(lane, touching, 2)).toBeNull();
  });

  it('lets a ready boat push while another is in its cooldown', () => {
    const twin = trajineraSpawn('deep/boat-3', 0, RIGHT.trajinera);
    const lane = { ...createTrajineraLane([LEFT, twin], BOUNDS, []), cooldowns: [0.2, 0] };
    expect(pushFromTrajineras(lane, touching, 2)?.push.id).toBe('deep/boat-3');
  });

  it('gives no push when nothing touches', () => {
    expect(pushFromTrajineras(createTrajineraLane([RIGHT, LEFT], BOUNDS, []), { x: 600, y: 300 }, 2)).toBeNull();
  });

  it('keeps pushing the axolotl out of the hull until it is clear, the cooldown apart', () => {
    let lane = createTrajineraLane([RIGHT], BOUNDS, []);
    let pushes = 0;
    for (let step = 0; step < 60; step++) {
      lane = tickTrajineraLane(lane, 1 / 60);
      const pushed = pushFromTrajineras(lane, touching, 2 + step / 60);
      if (pushed) {
        pushes += 1;
        lane = pushed.lane;
      }
    }
    expect(pushes).toBe(2);
  });
});

const DT = 1 / 60;
const BAND_ROW = HULL_BOTTOM + REACH;
const AREA_8_BOATS = DEEP_CANAL_LAYOUT.trajineras ?? [];
const AREA_8_ROCKS = DEEP_CANAL_LAYOUT.rockWalls ?? [];

/** `value` moved down by `steps` units in the last place. */
function floatBelow(value: number, steps: number): number {
  const bits = new BigInt64Array(new Float64Array([value]).buffer);
  bits[0] -= BigInt(steps);
  return new Float64Array(bits.buffer)[0];
}

/** A right boat whose span ends three units in the last place under 1024, where x1 + reach rounds into the hull. */
const EDGE = trajineraSpawn('deep/boat-edge', 0, { x0: 800, x1: floatBelow(1024, 3), direction: 'right' });

/** A swim state at rest at `pos`. */
function restingAt(pos: Point): SwimState {
  return { x: pos.x, y: pos.y, vx: 0, vy: 0, facing: 1 };
}

/** Each hull of the lane at `t` that the body centred on `pos` touches, as text. */
function touchedHulls(lane: TrajineraLane, pos: Point, t: number): string[] {
  return lane.boats
    .map((boat) => trajineraHull(boat, t))
    .filter((hull): hull is HazardRect => hull !== null && bodyTouchesHull(pos, hull))
    .map((hull) => `(${pos.x}, ${pos.y}) touches ${hull.x0}..${hull.x1} at ${t}`);
}

/** stepTrajineraLane built from the exported pieces: tick, pushFromTrajineras, then blockAtTrajineras. */
function fullStep(lane: TrajineraLane, pos: Point, t: number, bumped: boolean) {
  const ticked = tickTrajineraLane(lane, DT);
  const pushed = bumped ? null : pushFromTrajineras(ticked, pos, t);
  const held = blockAtTrajineras(ticked, pos, t);
  return { lane: pushed ? pushed.lane : ticked, pos: held, push: pushed ? { ...pushed.push, to: held } : null };
}

/** Every failure of a held place in `lane` at `t`: out of bounds, in rock or touching a hull. */
function heldFailures(lane: TrajineraLane, pos: Point, t: number): string[] {
  const held = blockAtTrajineras(lane, pos, t);
  const { minX, maxX, minY, maxY } = lane.bounds;
  const failures = touchedHulls(lane, held, t);
  if (held.x < minX || held.x > maxX || held.y < minY || held.y > maxY) failures.push(`(${held.x}, ${held.y}) out of bounds`);
  if (bodyInAnyRock(held, lane.rocks)) failures.push(`(${held.x}, ${held.y}) in rock`);
  return failures;
}

describe('the solid hull (blockAtTrajineras, stepTrajineraLane)', () => {
  const lane = createTrajineraLane([RIGHT, LEFT], BOUNDS, []);

  it('holds the body below, left and right of a hull', () => {
    expect(blockAtTrajineras(lane, { x: 1080, y: 150 }, 2)).toEqual({ x: 1080, y: BAND_ROW });
    expect(blockAtTrajineras(lane, { x: 1025, y: 100 }, 2)).toEqual({ x: 1020 - REACH, y: 100 });
    expect(blockAtTrajineras(lane, { x: 1135, y: 100 }, 2)).toEqual({ x: 1140 + REACH, y: 100 });
  });

  it('never holds the body up, from the top of the swim bounds inside the band', () => {
    const pos = { x: 1080, y: BOUNDS.minY };
    const held = blockAtTrajineras(lane, pos, 2);
    expect(held).toEqual({ x: 1080, y: BAND_ROW });
    expect(held.y).toBeGreaterThanOrEqual(pos.y);
  });

  it('returns a copy of the body centre when it touches no hull', () => {
    const pos = { x: 600, y: 120 };
    const held = blockAtTrajineras(lane, pos, 2);
    expect(held).toEqual(pos);
    expect(held).not.toBe(pos);
  });

  it('holds the body during the cooldown, with no push', () => {
    const cooling = { ...lane, cooldowns: [0.4, 0] };
    const result = stepTrajineraLane(cooling, { x: 1080, y: 150 }, DT, 2, false);
    expect(result.push).toBeNull();
    expect(result.pos).toEqual({ x: 1080, y: BAND_ROW });
    expect(result.lane.cooldowns[0]).toBeCloseTo(0.4 - DT, 9);
    expect(result.lane.cooldowns[0]).toBeGreaterThan(0);
  });

  it('holds the body on a bumped step, with no push and no cooldown started', () => {
    const result = stepTrajineraLane(lane, { x: 1080, y: 150 }, DT, 2, true);
    expect(result.push).toBeNull();
    expect(result.lane.cooldowns).toEqual([0, 0]);
    expect(result.pos).toEqual({ x: 1080, y: BAND_ROW });
  });

  it.each([
    ['right', RIGHT, { x: 1100, y: 100 }, 0, 1280 + REACH],
    ['left', LEFT, { x: 2140, y: 100 }, 3, 2000 - REACH],
  ])('holds a body parked in front of a boat gliding %s ahead of the nose', (direction, boat, parked, start, end) => {
    let current = createTrajineraLane([boat], BOUNDS, []);
    let pos: Point = parked;
    for (let frame = 0; frame <= 360; frame++) {
      const t = start + frame * DT;
      const result = stepTrajineraLane(current, pos, DT, t, false);
      current = result.lane;
      pos = result.pos;
      const hull = trajineraHull(boat, t);
      if (hull === null) continue;
      expect(bodyTouchesHull(pos, hull)).toBe(false);
      if (direction === 'right') expect(pos.x).toBeGreaterThanOrEqual(hull.x1 + REACH);
      else expect(pos.x).toBeLessThanOrEqual(hull.x0 - REACH);
    }
    expect(pos).toEqual({ x: end, y: parked.y });
  });

  it('never moves a body past either span end, while the clipped hull grows out of its span line', () => {
    for (let t = 0; t < 6; t += 0.05) {
      expect(blockAtTrajineras(lane, { x: 1280 + REACH, y: 100 }, t)).toEqual({ x: 1280 + REACH, y: 100 });
      expect(blockAtTrajineras(lane, { x: 1000 - REACH, y: 100 }, t)).toEqual({ x: 1000 - REACH, y: 100 });
    }
    expect(hullAt(RIGHT, 0.1).x1 - hullAt(RIGHT, 0.1).x0).toBeCloseTo(7, 9);
    expect(blockAtTrajineras(lane, { x: 1000 - REACH + 1, y: 100 }, 0.1)).toEqual({ x: 1000 - REACH, y: 100 });
  });

  it('takes the next nearest way when rock blocks the nearest', () => {
    const rock: RockWall = { x0: 960, x1: 990, y0: 90, y1: 120 };
    const walled = createTrajineraLane([RIGHT], BOUNDS, [rock]);
    expect(blockAtTrajineras(lane, { x: 1025, y: 100 }, 2)).toEqual({ x: 1020 - REACH, y: 100 });
    expect(blockAtTrajineras(walled, { x: 1025, y: 100 }, 2)).toEqual({ x: 1025, y: BAND_ROW });
  });

  it('holds a body that a steady current drives up into a hull', () => {
    const currents: CurrentZone[] = [{ id: 'up', x0: 1000, x1: 1300, y0: 90, y1: 220, force: { x: 0, y: -73 } }];
    let current = lane;
    let state = restingAt({ x: 1100, y: 200 });
    let holds = 0;
    const failures: string[] = [];
    for (let frame = 0; frame < 360; frame++) {
      const t = frame * DT;
      const env = { current: currentAt(state, currents), dragMul: 1, bounds: BOUNDS, dashing: false };
      const swum = stepSwim(state, { x: 0, y: 0 }, env, DT);
      const result = stepTrajineraLane(current, swum, DT, t, false);
      if (result.pos.x !== swum.x || result.pos.y !== swum.y) holds += 1;
      failures.push(...touchedHulls(current, result.pos, t));
      const velocity = result.push ? result.push.impulse : { x: swum.vx, y: swum.vy };
      state = { ...swum, x: result.pos.x, y: result.pos.y, vx: velocity.x, vy: velocity.y };
      current = result.lane;
    }
    expect(failures).toEqual([]);
    expect(holds).toBeGreaterThan(0);
  });

  it("never ends a frame touching Area 8's trajinera-1 while Up is held through the cooldown (the review's case)", () => {
    let current = createTrajineraLane(AREA_8_BOATS, BOUNDS, AREA_8_ROCKS);
    const boat = current.boats[0];
    expect(boat.trajinera).toEqual({ x0: 1250, x1: 1550, direction: 'right' });
    expect(boat.offset).toBe(0);
    let state = restingAt({ x: 1390, y: 157 });
    let pushes = 0;
    let cooldownHolds = 0;
    for (let frame = 0; frame < 60; frame++) {
      const t = 2 + frame * DT;
      const env = { current: { x: 0, y: 0 }, dragMul: 1, bounds: BOUNDS, dashing: false };
      const swum = stepSwim(state, { x: 0, y: -1 }, env, DT);
      const result = stepTrajineraLane(current, swum, DT, t, false);
      if (result.push) pushes += 1;
      const held = result.pos.x !== swum.x || result.pos.y !== swum.y;
      if (held && !result.push && result.lane.cooldowns[0] > 0) cooldownHolds += 1;
      const hull = trajineraHull(boat, t);
      expect(hull).not.toBeNull();
      if (hull) expect(bodyTouchesHull(result.pos, hull)).toBe(false);
      const velocity = result.push ? result.push.impulse : { x: swum.vx, y: swum.vy };
      state = { ...swum, x: result.pos.x, y: result.pos.y, vx: velocity.x, vy: velocity.y };
      current = result.lane;
    }
    expect(pushes).toBeGreaterThanOrEqual(1);
    expect(cooldownHolds).toBeGreaterThan(0);
  });

  it('rounds a hold at a hull edge just under a power of two clear of the hull', () => {
    const edged = createTrajineraLane([EDGE, LEFT], BOUNDS, []);
    const hull = hullAt(EDGE, 4);
    expect(hull.x1).toBe(floatBelow(1024, 3));
    const pos = { x: 1023, y: 100 };
    const raw = pushOutOfHull(pos, hull, BOUNDS, []);
    expect(raw).toEqual({ x: hull.x1 + REACH, y: 100 });
    expect(raw && bodyTouchesHull(raw, hull)).toBe(true);
    const held = blockAtTrajineras(edged, pos, 4);
    expect(bodyTouchesHull(held, hull)).toBe(false);
    expect(held.y).toBe(100);
    expect(held.x - (hull.x1 + REACH)).toBeLessThan(1e-9);
  });

  it.each([
    ["Area 8's lane", () => createTrajineraLane(AREA_8_BOATS, BOUNDS, AREA_8_ROCKS)],
    ['a lane with a hull edge just under a power of two', () => createTrajineraLane([EDGE, LEFT], BOUNDS, [])],
  ])('holds every place across the band at many times in bounds, out of rock and clear of every hull: %s', (_, build) => {
    const grid = build();
    const failures: string[] = [];
    for (const boat of grid.boats) {
      const { x0, x1 } = boat.trajinera;
      for (let x = x0 - 40; x <= x1 + 40; x += 7.3) {
        for (let y = BOUNDS.minY; y <= BAND_ROW + 2; y += 3.1) {
          for (let t = 0; t < 12; t += 0.13) failures.push(...heldFailures(grid, { x, y }, t));
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives the same result under the band with the early exit as the full computation', () => {
    const cooling = { ...lane, cooldowns: [0.3, 0] };
    for (const y of [BAND_ROW - 0.001, BAND_ROW, BAND_ROW + 0.5, 300, BOUNDS.maxY]) {
      for (let x = 960; x <= 1320; x += 11) {
        for (let t = 0; t < 6; t += 0.37) {
          for (const from of [lane, cooling]) {
            expect(stepTrajineraLane(from, { x, y }, DT, t, false)).toEqual(fullStep(from, { x, y }, t, false));
          }
        }
      }
    }
  });

  it("pushes on a push step as pushFromTrajineras does, to the held place", () => {
    const pos = { x: 1080, y: 150 };
    const result = stepTrajineraLane(lane, pos, DT, 2, false);
    expect(result.push).toEqual(pushFromTrajineras(tickTrajineraLane(lane, DT), pos, 2)?.push);
    expect(result.push?.to).toEqual(result.pos);
    expect(result.lane.cooldowns).toEqual([TRAJINERAS.pushCooldown, 0]);
  });
});

describe('createTrajineraLane rules', () => {
  it('refuses rock under a hull band', () => {
    const under: RockWall = { x0: 1100, x1: 1200, y0: 170, y1: 300 };
    expect(() => createTrajineraLane([RIGHT], BOUNDS, [under])).toThrow(RangeError);
  });

  it('refuses rock meeting the band row within the body reach past a span end, and accepts it just clear', () => {
    const meets: RockWall = { x0: 1280 + 2 * REACH - 1, x1: 1400, y0: 150, y1: 300 };
    const clear: RockWall = { x0: 1280 + 2 * REACH, x1: 1400, y0: 150, y1: 300 };
    expect(() => createTrajineraLane([RIGHT], BOUNDS, [meets])).toThrow(RangeError);
    expect(() => createTrajineraLane([RIGHT], BOUNDS, [clear])).not.toThrow();
  });

  it.each([
    ['under the bounds', { ...BOUNDS, maxY: BAND_ROW - 1 }],
    ['over the bounds', { ...BOUNDS, minY: BAND_ROW + 1 }],
  ])('refuses a band row %s', (_, bounds) => {
    expect(() => createTrajineraLane([RIGHT], bounds, [])).toThrow(RangeError);
  });

  it('refuses spans closer than twice the body reach, overlap included', () => {
    const near = trajineraSpawn('deep/near', 0, { x0: 1280 + 2 * REACH - 1, x1: 1500, direction: 'left' });
    const over = trajineraSpawn('deep/over', 0, { x0: 1200, x1: 1400, direction: 'left' });
    const apart = trajineraSpawn('deep/apart', 0, { x0: 1280 + 2 * REACH, x1: 1500, direction: 'left' });
    expect(() => createTrajineraLane([RIGHT, near], BOUNDS, [])).toThrow(RangeError);
    expect(() => createTrajineraLane([over, RIGHT], BOUNDS, [])).toThrow(RangeError);
    expect(() => createTrajineraLane([RIGHT, apart], BOUNDS, [])).not.toThrow();
  });

  it("accepts Area 8's boats, bounds and divider", () => {
    expect(AREA_8_BOATS).toHaveLength(2);
    expect(AREA_8_ROCKS.length).toBeGreaterThan(0);
    expect(() => createTrajineraLane(AREA_8_BOATS, BOUNDS, AREA_8_ROCKS)).not.toThrow();
  });
});
