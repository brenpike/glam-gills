import { describe, expect, it } from 'vitest';
import { elementActive, elementSweep, type HazardRect } from './hazards';
import { PEBBLES, type RockWall } from './pebble';
import {
  GLIDING_TRAJINERA,
  TRAJINERAS,
  TRAJINERA_MAX_SPAN,
  bodyTouchesHull,
  createTrajineraLane,
  pushFromTrajineras,
  pushOutOfHull,
  tickTrajineraLane,
  trajineraBob,
  trajineraHull,
  trajineraHullBand,
  trajineraPush,
  trajineraShadow,
  trajineraSpawn,
  trajineras,
  type TrajineraSpawn,
} from './trajineras';
import { TILAPIA } from './tuning';
import { SURF, areaSize, swimBounds, type SwimBounds } from './zone';

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
    const lane = { ...createTrajineraLane([RIGHT, twin], BOUNDS, []), cooldowns: [0.2, 0] };
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
