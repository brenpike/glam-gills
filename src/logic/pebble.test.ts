import { describe, expect, it } from 'vitest';
import { elementActive, elementSweep, GLOW_PLANT, type ElementSpawn } from './hazards';
import { glowPlantSpawn } from './glowPlants';
import {
  PEBBLE,
  PEBBLES,
  blockAtRock,
  bodyInAnyRock,
  bodyInRock,
  bodyTouchesPebble,
  createPebbles,
  grooveLength,
  nearUnrolledPebble,
  pebbleCentre,
  pebbleHintShown,
  pebbleRolled,
  pebbleSpawn,
  pebbles,
  rollDirection,
  stepPebbleHintClock,
  stepPebbles,
  type PebbleState,
  type RockWall,
} from './pebble';
import { GHOST_NETS } from './tuning';
import type { Point } from './zone';

const WALL: RockWall = { x0: 1000, x1: 1040, y0: 200, y1: 400 };
const LID: RockWall = { x0: 1000, x1: 1400, y0: 160, y1: 200 };
const PEBBLE_ROCK: ElementSpawn = pebbleSpawn('test/pebble-1', { x0: 1020, y0: 600, x1: 1140, y1: 600, radius: 40 });
const PLANT = glowPlantSpawn('test/glow-plant-1', { x: 300, y: 300, radius: 14 });
const ELEMENTS: readonly ElementSpawn[] = [PLANT, PEBBLE_ROCK];
const START: readonly PebbleState[] = createPebbles(ELEMENTS);
const DT = 1 / 60;

/** Pushes from `from` toward +x for `seconds`, the body moving 2 px a frame, stopped by the pebbles each frame. */
function pushFor(from: Point, seconds: number, states: readonly PebbleState[] = START): { pos: Point; pebbles: readonly PebbleState[] } {
  let pos = from;
  let current = states;
  for (let t = 0; t < seconds; t += DT) {
    const step = stepPebbles(current, ELEMENTS, pos, { x: pos.x + 2, y: pos.y }, DT);
    pos = step.pos;
    current = step.pebbles;
  }
  return { pos, pebbles: current };
}

describe('PEBBLE and PEBBLES', () => {
  it('is a puzzle element: always active, with no fact card, no meet range and no sweep', () => {
    expect(PEBBLE).toEqual({ id: 'pebble', name: 'Pebble', kind: 'puzzle', period: 1, activeFor: 1 });
    expect(elementActive(PEBBLE_ROCK, 0.3)).toBe(true);
    expect(elementSweep(PEBBLE_ROCK)).toBeNull();
  });

  it('rolls at 40 px/s, shows the hint after 10 s within 160 px, and meets rock and pebble at the body reach', () => {
    expect(PEBBLES).toEqual({ bodyReach: GHOST_NETS.reach, rollSpeed: 40, hintRange: 160, hintAfter: 10 });
  });
});

describe('pebbleSpawn', () => {
  it('builds a pebble element with its own copy of the groove', () => {
    const groove = { x0: 10, y0: 20, x1: 30, y1: 20, radius: 5 };
    const spawn = pebbleSpawn('p', groove);
    expect(spawn).toEqual({ id: 'p', type: PEBBLE, offset: 0, pebble: groove });
    expect(spawn.pebble).not.toBe(groove);
  });

  it('refuses a groove that is not finite, a radius not above 0 and a groove of no length', () => {
    expect(() => pebbleSpawn('p', { x0: NaN, y0: 0, x1: 1, y1: 0, radius: 5 })).toThrow(RangeError);
    expect(() => pebbleSpawn('p', { x0: 0, y0: 0, x1: 10, y1: 0, radius: 0 })).toThrow(RangeError);
    expect(() => pebbleSpawn('p', { x0: 0, y0: 0, x1: 10, y1: 0, radius: Infinity })).toThrow(RangeError);
    expect(() => pebbleSpawn('p', { x0: 5, y0: 5, x1: 5, y1: 5, radius: 4 })).toThrow(RangeError);
  });

  it('lists the pebbles in element order and starts each trip with every pebble at the start of its groove', () => {
    expect(pebbles(ELEMENTS)).toEqual([PEBBLE_ROCK]);
    expect(pebbles([PLANT])).toEqual([]);
    expect(START).toEqual([{ id: 'test/pebble-1', along: 0 }]);
    expect(PLANT.type).toBe(GLOW_PLANT);
  });
});

describe('the groove', () => {
  const groove = PEBBLE_ROCK.pebble!;

  it('runs from its start to its end, one way, clamped to the groove', () => {
    expect(grooveLength(groove)).toBe(120);
    expect(rollDirection(groove)).toEqual({ x: 1, y: 0 });
    expect(pebbleCentre(groove, 0)).toEqual({ x: 1020, y: 600 });
    expect(pebbleCentre(groove, 60)).toEqual({ x: 1080, y: 600 });
    expect(pebbleCentre(groove, 500)).toEqual({ x: 1140, y: 600 });
    expect(pebbleCentre(groove, -5)).toEqual({ x: 1020, y: 600 });
    expect(pebbleRolled(groove, 119.9)).toBe(false);
    expect(pebbleRolled(groove, 120)).toBe(true);
  });
});

describe('rock walls', () => {
  it('holds the body out of the wall grown by the body reach; the grown edge itself is clear', () => {
    expect(bodyInRock({ x: 982, y: 300 }, WALL)).toBe(false);
    expect(bodyInRock({ x: 983, y: 300 }, WALL)).toBe(true);
    expect(bodyInRock({ x: 1020, y: 418 }, WALL)).toBe(false);
    expect(bodyInRock({ x: 1020, y: 417 }, WALL)).toBe(true);
    expect(bodyInAnyRock({ x: 1200, y: 190 }, [WALL, LID])).toBe(true);
    expect(bodyInAnyRock({ x: 1200, y: 230 }, [WALL, LID])).toBe(false);
  });

  it('leaves a step that meets no rock as it is, the same object', () => {
    const next = { x: 900, y: 300 };
    expect(blockAtRock({ x: 890, y: 300 }, next, [WALL])).toBe(next);
    expect(blockAtRock({ x: 890, y: 300 }, next, [])).toBe(next);
  });

  it('stops a step into a wall at its grown face, on each axis, and lets the other axis slide', () => {
    expect(blockAtRock({ x: 980, y: 300 }, { x: 985, y: 304 }, [WALL])).toEqual({ x: 982, y: 304 });
    expect(blockAtRock({ x: 1060, y: 300 }, { x: 1055, y: 300 }, [WALL])).toEqual({ x: 1058, y: 300 });
    expect(blockAtRock({ x: 1020, y: 420 }, { x: 1022, y: 415 }, [WALL])).toEqual({ x: 1022, y: 418 });
    expect(blockAtRock({ x: 1200, y: 220 }, { x: 1201, y: 216 }, [WALL, LID])).toEqual({ x: 1201, y: 218 });
  });

  it('puts a body already in rock out the shortest way first', () => {
    expect(blockAtRock({ x: 1001, y: 300 }, { x: 1002, y: 300 }, [WALL])).toEqual({ x: 982, y: 300 });
  });

  it('never lets a fast swim go through a wall', () => {
    let pos: Point = { x: 900, y: 300 };
    for (let i = 0; i < 200; i += 1) pos = blockAtRock(pos, { x: pos.x + 5.5, y: pos.y }, [WALL]);
    expect(pos.x).toBe(982);
  });
});

describe('stepPebbles', () => {
  const groove = PEBBLE_ROCK.pebble!;

  it('leaves a step that touches no pebble as it is, the same objects', () => {
    const next = { x: 800, y: 600 };
    const step = stepPebbles(START, ELEMENTS, { x: 798, y: 600 }, next, DT);
    expect(step.pos).toBe(next);
    expect(step.pebbles).toBe(START);
  });

  it('rolls the pebble at 40 px/s while the body pushes it from behind, the body held at its edge', () => {
    const touching = { x: 1020 - 58, y: 600 };
    const { pos, pebbles: after } = pushFor({ x: touching.x - 1, y: 600 }, 1);
    expect(after[0].along).toBeGreaterThan(38);
    expect(after[0].along).toBeLessThanOrEqual(40.5);
    const centre = pebbleCentre(groove, after[0].along);
    expect(Math.hypot(pos.x - centre.x, pos.y - centre.y)).toBeCloseTo(58, 6);
    expect(bodyTouchesPebble(pos, centre, groove.radius)).toBe(false);
  });

  it('rolls no farther than the groove end, then stays, and the pushing body stops at it', () => {
    const { pebbles: after, pos } = pushFor({ x: 950, y: 600 }, 6);
    expect(after[0].along).toBe(120);
    expect(pos.x).toBeCloseTo(1140 - 58, 6);
    const again = pushFor(pos, 1, after);
    expect(again.pebbles[0].along).toBe(120);
  });

  it('never rolls back: a body pushing from the far side, or just touching it, is put out and the pebble stays', () => {
    const rolled: PebbleState[] = [{ id: 'test/pebble-1', along: 60 }];
    const centre = pebbleCentre(groove, 60);
    const fromFront = stepPebbles(rolled, ELEMENTS, { x: centre.x + 60, y: 600 }, { x: centre.x + 55, y: 600 }, DT);
    expect(fromFront.pebbles[0].along).toBe(60);
    expect(fromFront.pos.x).toBeCloseTo(centre.x + 58, 6);
    const still = stepPebbles(START, ELEMENTS, { x: 1020 - 57, y: 600 }, { x: 1020 - 57, y: 600 }, DT);
    expect(still.pebbles).toBe(START);
    expect(still.pos.x).toBeCloseTo(1020 - 58, 6);
  });

  it('does not roll on a 0 step', () => {
    const step = stepPebbles(START, ELEMENTS, { x: 960, y: 600 }, { x: 963, y: 600 }, 0);
    expect(step.pebbles).toBe(START);
  });

  it('puts a body at the very centre out behind it', () => {
    const step = stepPebbles(START, ELEMENTS, { x: 1020, y: 600 }, { x: 1020, y: 600 }, DT);
    expect(step.pos).toEqual({ x: 962, y: 600 });
  });
});

describe('the pebble hint', () => {
  it('is near only an unrolled pebble, within 160 px of its edge', () => {
    expect(nearUnrolledPebble({ x: 1020 - 200, y: 600 }, START, ELEMENTS)).toBe(true);
    expect(nearUnrolledPebble({ x: 1020 - 201, y: 600 }, START, ELEMENTS)).toBe(false);
    expect(nearUnrolledPebble({ x: 1000, y: 600 }, [{ id: 'test/pebble-1', along: 1 }], ELEMENTS)).toBe(false);
  });

  it('counts game time near it, holds while paused, and goes back to 0 away from it or on a roll', () => {
    let clock = 0;
    clock = stepPebbleHintClock(clock, { dt: 4, near: true, rolled: false, paused: false });
    clock = stepPebbleHintClock(clock, { dt: 5, near: true, rolled: false, paused: true });
    expect(clock).toBe(4);
    clock = stepPebbleHintClock(clock, { dt: 6, near: true, rolled: false, paused: false });
    expect(clock).toBe(10);
    expect(pebbleHintShown(clock)).toBe(true);
    expect(pebbleHintShown(9.99)).toBe(false);
    expect(stepPebbleHintClock(clock, { dt: 0.1, near: false, rolled: false, paused: false })).toBe(0);
    expect(stepPebbleHintClock(clock, { dt: 0.1, near: true, rolled: true, paused: false })).toBe(0);
  });

  it('refuses a step below 0 or not finite', () => {
    expect(() => stepPebbleHintClock(0, { dt: -1, near: true, rolled: false, paused: false })).toThrow(RangeError);
    expect(() => stepPebbleHintClock(0, { dt: NaN, near: true, rolled: false, paused: false })).toThrow(RangeError);
  });
});
