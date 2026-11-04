import { describe, expect, it } from 'vitest';
import { LURE_FACT, LURE_MEET_RANGE } from './factCards';
import { shapeDistance } from './hazards';
import {
  LURES,
  TRAJINERA_LURE,
  createLureState,
  eatLure,
  fishingBoatBand,
  fishingBoatHull,
  fishingBoatSpawn,
  lureAt,
  lureBob,
  lureDrawn,
  lureInReach,
  lureLift,
  lureLine,
  lureLinePath,
  lurePath,
  lureStill,
  tickLures,
  type FishingBoatPlan,
  type LureState,
  type LureStatus,
} from './lures';
import { TRAJINERAS } from './trajineras';
import { SNACK_REACH } from './tuning';
import { SURF, areaSize, swimBounds, type Point, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(10, 3));
/** A 360 px span: the hull drifts 240 px each way, 20 s at 12 px/s. */
const PLAN: FishingBoatPlan = { x0: 1000, x1: 1360, lures: [{ along: 30, depth: 200 }, { along: 90, depth: 300 }] };
const BOAT = fishingBoatSpawn('deep-3/fishing-1', 0, PLAN, BOUNDS);
const TRAVEL = PLAN.x1 - PLAN.x0 - LURES.hullLength;
const DOWN: LureStatus = { id: 'deep-3/fishing-1-lure-1', up: false, upLeft: 0 };
const FAR: Point = { x: 4000, y: 900 };

/** The state with every lure of BOAT down. */
function freshState(): LureState {
  return createLureState([BOAT]);
}

describe('trajinera lure tuning (issue #108, ND-1)', () => {
  it('drifts at 12 px/s with the gliding trajinera hull, and eats within the snack eat reach', () => {
    expect(LURES.driftSpeed).toBe(12);
    expect(LURES.eatReach).toBe(SNACK_REACH.radius);
    expect(LURES.pulledFor).toBe(5);
  });

  it('keeps the hull length and draft equal to the gliding trajinera hull', () => {
    expect(LURES.hullLength).toBe(TRAJINERAS.hullLength);
    expect(LURES.hullDepth).toBe(TRAJINERAS.hullDepth);
  });

  it('is a leg-costing hazard type with the Fishing lines card', () => {
    expect(TRAJINERA_LURE).toEqual({
      id: 'trajinera-lure',
      name: 'Trajinera lure',
      costsLeg: true,
      reach: SNACK_REACH.radius,
      meetRange: LURE_MEET_RANGE,
      fact: LURE_FACT,
    });
    expect(TRAJINERA_LURE.fact).toBe(LURE_FACT);
    expect(Object.isFrozen(TRAJINERA_LURE)).toBe(true);
  });
});

describe('fishingBoatSpawn', () => {
  it('builds the boat with its span, drift speed, offset and numbered lures', () => {
    expect(BOAT).toEqual({
      id: 'deep-3/fishing-1',
      x0: 1000,
      x1: 1360,
      speed: 12,
      offset: 0,
      lures: [
        { id: 'deep-3/fishing-1-lure-1', along: 30, depth: 200 },
        { id: 'deep-3/fishing-1-lure-2', along: 90, depth: 300 },
      ],
    });
  });

  it('shares no objects with the plan', () => {
    expect(BOAT.lures[0]).not.toBe(PLAN.lures[0]);
  });

  it.each([
    ['an empty span', { ...PLAN, x1: 1000 }],
    ['a span no longer than a hull', { ...PLAN, x1: 1000 + LURES.hullLength }],
    ['a non-finite span', { ...PLAN, x0: Number.NaN }],
    ['no lures', { ...PLAN, lures: [] }],
    ['a lure off the hull', { ...PLAN, lures: [{ along: LURES.hullLength + 1, depth: 200 }] }],
    ['a lure before the hull', { ...PLAN, lures: [{ along: -1, depth: 200 }] }],
    ['a lure bobbing into the hull', { ...PLAN, lures: [{ along: 30, depth: LURES.hullDepth + LURES.bobAmplitude }] }],
    ['a lure below the swim bounds', { ...PLAN, lures: [{ along: 30, depth: BOUNDS.maxY - SURF }] }],
    ['a lure drifting out of the swim bounds', { ...PLAN, x0: BOUNDS.minX - 10, x1: BOUNDS.minX + 300, lures: [{ along: 0, depth: 200 }] }],
  ])('throws RangeError for %s', (_label, plan: FishingBoatPlan) => {
    expect(() => fishingBoatSpawn('bad', 0, plan, BOUNDS)).toThrow(RangeError);
  });

  it('throws RangeError for an offset that is not finite', () => {
    expect(() => fishingBoatSpawn('bad', Number.POSITIVE_INFINITY, PLAN, BOUNDS)).toThrow(RangeError);
  });
});

describe('drift', () => {
  it('starts at x0 and drifts right at 12 px/s', () => {
    expect(fishingBoatHull(BOAT, 0)).toEqual({ kind: 'rect', x0: 1000, x1: 1120, y0: SURF, y1: SURF + LURES.hullDepth });
    expect(fishingBoatHull(BOAT, 5).x0).toBeCloseTo(1060, 9);
  });

  it('turns at the far end and drifts back to x0', () => {
    const turn = TRAVEL / LURES.driftSpeed;
    expect(fishingBoatHull(BOAT, turn).x1).toBeCloseTo(PLAN.x1, 9);
    expect(fishingBoatHull(BOAT, turn + 5).x0).toBeCloseTo(PLAN.x1 - LURES.hullLength - 60, 9);
    expect(fishingBoatHull(BOAT, 2 * turn).x0).toBeCloseTo(PLAN.x0, 9);
  });

  it('keeps the whole hull in its span at every time, negative included', () => {
    for (let t = -50; t <= 50; t += 0.37) {
      const hull = fishingBoatHull(BOAT, t);
      expect(hull.x0).toBeGreaterThanOrEqual(PLAN.x0 - 1e-9);
      expect(hull.x1).toBeLessThanOrEqual(PLAN.x1 + 1e-9);
      expect(hull.x1 - hull.x0).toBeCloseTo(LURES.hullLength, 9);
    }
  });

  it('starts `offset` seconds into the drift', () => {
    const late = fishingBoatSpawn('deep-3/fishing-2', 5, PLAN, BOUNDS);
    expect(fishingBoatHull(late, 0).x0).toBeCloseTo(fishingBoatHull(BOAT, 5).x0, 9);
  });

  it('gives the whole span as the band every hull place fits in', () => {
    expect(fishingBoatBand(BOAT)).toEqual({ kind: 'rect', x0: 1000, x1: 1360, y0: SURF, y1: SURF + LURES.hullDepth });
  });

  it('carries each lure along its hull at its depth', () => {
    expect(lureStill(BOAT, 0, 5)).toEqual({ x: fishingBoatHull(BOAT, 5).x0 + 30, y: SURF + 200 });
    expect(lureStill(BOAT, 1, 5)).toEqual({ x: fishingBoatHull(BOAT, 5).x0 + 90, y: SURF + 300 });
  });
});

describe('bob and reduced motion', () => {
  it('does not bob under reduced motion: the eat position is the still position', () => {
    for (let t = 0; t < 5; t += 0.3) {
      expect(lureBob(BOAT, 0, t, true)).toBe(0);
      expect(lureAt(BOAT, 0, t, true)).toEqual(lureStill(BOAT, 0, t));
    }
  });

  it('bobs gently under full motion, within its amplitude', () => {
    const bobs: number[] = [];
    for (let t = 0; t < LURES.bobPeriod; t += 0.1) bobs.push(lureBob(BOAT, 0, t, false));
    expect(Math.max(...bobs.map(Math.abs))).toBeLessThanOrEqual(LURES.bobAmplitude);
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeGreaterThan(LURES.bobAmplitude);
    expect(lureAt(BOAT, 0, 0.6, false).y).toBeCloseTo(lureStill(BOAT, 0, 0.6).y + lureBob(BOAT, 0, 0.6, false), 9);
  });
});

describe('line geometry', () => {
  it('runs straight down from its boat at the surface to the lure where it is drawn', () => {
    const line = lureLine(BOAT, 1, DOWN, 7, false);
    const drawn = lureDrawn(BOAT, 1, DOWN, 7, false);
    expect(line.to).toEqual(drawn);
    expect(line.from).toEqual({ x: drawn.x, y: SURF });
    const hull = fishingBoatHull(BOAT, 7);
    expect(line.from.x).toBeGreaterThanOrEqual(hull.x0);
    expect(line.from.x).toBeLessThanOrEqual(hull.x1);
  });

  it('shortens as a tugged lure is pulled up to the boat', () => {
    const rising: LureStatus = { ...DOWN, up: true, upLeft: LURES.pulledFor - LURES.liftFor / 2 };
    const risen: LureStatus = { ...DOWN, up: true, upLeft: 1 };
    const hang = lureAt(BOAT, 0, 3, false);
    expect(lureDrawn(BOAT, 0, rising, 3, false).y).toBeCloseTo((hang.y + SURF) / 2, 9);
    expect(lureLine(BOAT, 0, risen, 3, false).to).toEqual({ x: hang.x, y: SURF });
  });
});

describe('lureLift', () => {
  it('is 0 down, rises over liftFor after a tug, and is 1 while up after that', () => {
    expect(lureLift(DOWN, false)).toBe(0);
    expect(lureLift({ ...DOWN, up: true, upLeft: LURES.pulledFor }, false)).toBe(0);
    expect(lureLift({ ...DOWN, up: true, upLeft: LURES.pulledFor - LURES.liftFor / 2 }, false)).toBeCloseTo(0.5, 9);
    expect(lureLift({ ...DOWN, up: true, upLeft: 2 }, false)).toBe(1);
    expect(lureLift({ ...DOWN, up: true, upLeft: 0 }, false)).toBe(1);
  });

  it('is 1 at once while up under reduced motion', () => {
    expect(lureLift({ ...DOWN, up: true, upLeft: LURES.pulledFor }, true)).toBe(1);
    expect(lureLift(DOWN, true)).toBe(0);
  });
});

describe('whole paths', () => {
  it('holds every place the lure can hang, bob included', () => {
    const path = lurePath(BOAT, 0);
    expect(path).toEqual({
      kind: 'rect',
      x0: 1030,
      x1: PLAN.x1 - LURES.hullLength + 30,
      y0: SURF + 200 - LURES.bobAmplitude,
      y1: SURF + 200 + LURES.bobAmplitude,
    });
    for (let t = -40; t <= 40; t += 0.41) expect(shapeDistance(lureAt(BOAT, 0, t, false), path)).toBe(0);
  });

  it('holds every place the line can be, from the surface down to the lure', () => {
    const band = lureLinePath(BOAT, 1);
    expect(band).toEqual({ kind: 'rect', x0: 1090, x1: PLAN.x1 - LURES.hullLength + 90, y0: SURF, y1: SURF + 300 + LURES.bobAmplitude });
    for (let t = -40; t <= 40; t += 0.41) {
      const line = lureLine(BOAT, 1, DOWN, t, false);
      expect(shapeDistance(line.from, band)).toBe(0);
      expect(shapeDistance(line.to, band)).toBe(0);
    }
  });
});

describe('eat check', () => {
  it('eats at exactly the eat reach from the lure where it is drawn, edges included', () => {
    const lure = lureAt(BOAT, 0, 2, false);
    expect(lureInReach({ x: lure.x + LURES.eatReach, y: lure.y }, lure)).toBe(true);
    expect(lureInReach({ x: lure.x, y: lure.y - LURES.eatReach }, lure)).toBe(true);
    expect(lureInReach({ x: lure.x + LURES.eatReach + 1e-6, y: lure.y }, lure)).toBe(false);
  });

  it('measures from the bobbing lure under full motion and the still lure under reduced motion', () => {
    const t = 0.6;
    const bobbed = lureAt(BOAT, 0, t, false);
    const still = lureStill(BOAT, 0, t);
    expect(bobbed.y).not.toBeCloseTo(still.y, 3);
    const edgeOfBob: Point = { x: bobbed.x, y: bobbed.y + LURES.eatReach };
    expect(eatLure(freshState(), [BOAT], edgeOfBob, t, false)).not.toBeNull();
    const reducedHit = eatLure(freshState(), [BOAT], { x: still.x, y: still.y + LURES.eatReach }, t, true);
    expect(reducedHit?.lureId).toBe('deep-3/fishing-1-lure-1');
    const pastStill = { x: still.x, y: still.y + LURES.eatReach + 1e-6 };
    expect(eatLure(freshState(), [BOAT], pastStill, t, true)).toBeNull();
  });

  it('returns null when no lure is in reach', () => {
    expect(eatLure(freshState(), [BOAT], FAR, 2, false)).toBeNull();
  });

  it('pulls the eaten lure up for 5 s and leaves the others down', () => {
    const tug = eatLure(freshState(), [BOAT], lureAt(BOAT, 0, 2, false), 2, false);
    expect(tug).not.toBeNull();
    expect(tug?.lureId).toBe('deep-3/fishing-1-lure-1');
    expect(tug?.tugged).toEqual(['deep-3/fishing-1-lure-1']);
    expect(tug?.state.lures).toEqual([
      { id: 'deep-3/fishing-1-lure-1', up: true, upLeft: 5 },
      { id: 'deep-3/fishing-1-lure-2', up: false, upLeft: 0 },
    ]);
  });

  it('never eats a lure that is pulled up', () => {
    const head = lureAt(BOAT, 0, 2, false);
    const tug = eatLure(freshState(), [BOAT], head, 2, false);
    expect(tug).not.toBeNull();
    if (tug === null) return;
    expect(eatLure(tug.state, [BOAT], head, 2, false)).toBeNull();
  });

  it('lands one hit when two lures are in reach on one frame, and pulls both up', () => {
    const twin = fishingBoatSpawn('deep-3/fishing-3', 0, { ...PLAN, lures: [{ along: 30, depth: 200 }, { along: 50, depth: 200 }] }, BOUNDS);
    const a = lureStill(twin, 0, 4);
    const b = lureStill(twin, 1, 4);
    const head = { x: (a.x + b.x) / 2, y: a.y };
    const tug = eatLure(createLureState([twin]), [twin], head, 4, true);
    expect(tug?.lureId).toBe('deep-3/fishing-3-lure-1');
    expect(tug?.tugged).toEqual(['deep-3/fishing-3-lure-1', 'deep-3/fishing-3-lure-2']);
    expect(tug?.state.lures.every((status) => status.up && status.upLeft === LURES.pulledFor)).toBe(true);
    if (tug === null) return;
    expect(eatLure(tug.state, [twin], head, 4, true)).toBeNull();
  });

  it('reads each boat of several in order', () => {
    const second = fishingBoatSpawn('deep-3/fishing-4', 0, { x0: 2000, x1: 2300, lures: [{ along: 60, depth: 250 }] }, BOUNDS);
    const boats = [BOAT, second];
    const tug = eatLure(createLureState(boats), boats, lureStill(second, 0, 1), 1, true);
    expect(tug?.lureId).toBe('deep-3/fishing-4-lure-1');
    expect(tug?.state.lures.map((status) => status.up)).toEqual([false, false, true]);
  });
});

describe('pull-up and return timing', () => {
  /** The state with BOAT's first lure just tugged at t = 2. */
  function tugged(): LureState {
    const tug = eatLure(freshState(), [BOAT], lureAt(BOAT, 0, 2, true), 2, true);
    if (tug === null) throw new Error('expected a tug');
    return tug.state;
  }

  it('stays up for 5 s, then comes back when the head is away', () => {
    let state = tugged();
    let t = 2;
    for (let step = 0; step < 39; step++) {
      t += 0.125;
      state = tickLures(state, [BOAT], FAR, t, 0.125, true);
    }
    expect(state.lures[0].up).toBe(true);
    expect(state.lures[0].upLeft).toBe(0.125);
    state = tickLures(state, [BOAT], FAR, t + 0.125, 0.125, true);
    expect(state.lures[0]).toEqual({ id: 'deep-3/fishing-1-lure-1', up: false, upLeft: 0 });
  });

  it('comes back in one long step that covers the 5 s', () => {
    expect(tickLures(tugged(), [BOAT], FAR, 8, 6, true).lures[0].up).toBe(false);
  });

  it('never returns onto the head: it waits up until the head is out of reach', () => {
    let state = tugged();
    const t = 7.5;
    const hang = lureAt(BOAT, 0, t, true);
    state = tickLures(state, [BOAT], hang, t, 5.5, true);
    expect(state.lures[0]).toEqual({ id: 'deep-3/fishing-1-lure-1', up: true, upLeft: 0 });
    const edge = { x: hang.x + LURES.eatReach, y: hang.y };
    const waiting = tickLures(state, [BOAT], edge, t, 0.1, true);
    expect(waiting).toBe(state);
    expect(eatLure(waiting, [BOAT], edge, t, true)).toBeNull();
    const away = { x: hang.x + LURES.eatReach + 1e-6, y: hang.y };
    expect(tickLures(state, [BOAT], away, t, 0.1, true).lures[0].up).toBe(false);
  });

  it('checks the head against where the lure would hang at that time, bob included', () => {
    const t = 7.6;
    const hang = lureAt(BOAT, 0, t, false);
    const state = tickLures(tugged(), [BOAT], hang, t, 5.6, false);
    expect(state.lures[0].up).toBe(true);
  });

  it('returns the same state for a zero, negative or non-finite step, or when no lure is up', () => {
    const state = tugged();
    expect(tickLures(state, [BOAT], FAR, 3, 0, true)).toBe(state);
    expect(tickLures(state, [BOAT], FAR, 3, -1, true)).toBe(state);
    expect(tickLures(state, [BOAT], FAR, 3, Number.NaN, true)).toBe(state);
    const fresh = freshState();
    expect(tickLures(fresh, [BOAT], FAR, 3, 0.1, true)).toBe(fresh);
  });

  it('never mutates its input', () => {
    const state = tugged();
    const before = structuredClone(state);
    tickLures(state, [BOAT], FAR, 9, 6, true);
    eatLure(freshState(), [BOAT], lureAt(BOAT, 1, 2, true), 2, true);
    expect(state).toEqual(before);
  });

  it('starts every lure down again from createLureState, as after a carry home', () => {
    expect(createLureState([BOAT]).lures).toEqual([
      { id: 'deep-3/fishing-1-lure-1', up: false, upLeft: 0 },
      { id: 'deep-3/fishing-1-lure-2', up: false, upLeft: 0 },
    ]);
  });
});
