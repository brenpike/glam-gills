import { describe, expect, it } from 'vitest';
import {
  FADING_LIGHTS,
  fadingLightCircles,
  fadingLightHint,
  fadingLightLeft,
  fadingLightShare,
  fadingLightSpawn,
  fadingLights,
  quantizeFadingShare,
  stepFadingLights,
  touchesFadingLight,
  type FadingLightStep,
  type FadingLightTimers,
} from './fadingLights';
import {
  GLOW_PLANTS,
  darkHintPlant,
  darkLights,
  darknessMayHide,
  glowPlantSpawn,
  glowPlants,
  lightGlowPlants,
  stepDarkHintClock,
} from './glowPlants';
import { FADING_LIGHT, FADING_LIGHT_RADIUS, elementActive, elementSweep, type ElementSpawn } from './hazards';
import { WATER_HYACINTH } from './hyacinthMats';
import type { Point } from './zone';

const AWAY: Point = { x: 200, y: 200 };
const FULL = FADING_LIGHTS.fullFor + FADING_LIGHTS.dimFor;

const LIGHTS: readonly ElementSpawn[] = [
  fadingLightSpawn('test/fading-light-1', { x: 1300, y: 900 }),
  fadingLightSpawn('test/fading-light-2', { x: 1600, y: 800 }),
  fadingLightSpawn('test/fading-light-3', { x: 1900, y: 1000 }),
];
const MAT: ElementSpawn = {
  id: 'test/mats-1',
  type: WATER_HYACINTH,
  offset: 0,
  matPair: { x0: 400, x1: 460, rowTop: 80, rowBottom: 360, channelY: 220, openHeight: 72 },
};
const PLANT = glowPlantSpawn('test/glow-plant-1', { x: 2200, y: 760, radius: 14 });
const ELEMENTS: readonly ElementSpawn[] = [MAT, ...LIGHTS, PLANT];
const LIGHT_IDS = LIGHTS.map((light) => light.id);
const AT_FIRST: Point = { x: 1300, y: 900 };

function step(overrides: Partial<FadingLightStep>): FadingLightStep {
  return { dt: 0.05, pos: AWAY, paused: false, ...overrides };
}

/** The timers after `seconds` of swimming away from every light in `dt` steps. */
function swimAway(timers: FadingLightTimers, seconds: number, dt = 0.5): FadingLightTimers {
  let next = timers;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) next = stepFadingLights(next, ELEMENTS, step({ dt })).timers;
  return next;
}

describe('the fading light element (issue #212, ND-7 and ND-26)', () => {
  it('is an always-active puzzle element with no fact card, no meet range and no sweep', () => {
    expect(FADING_LIGHT).toEqual({ id: 'fading-light', name: 'Fading light', kind: 'puzzle', period: 1, activeFor: 1 });
    expect(FADING_LIGHT.fact).toBeUndefined();
    expect(FADING_LIGHT.meetRange).toBeUndefined();
    expect(Object.isFrozen(FADING_LIGHT)).toBe(true);
    for (const light of LIGHTS) {
      expect(elementSweep(light)).toBeNull();
      expect(elementActive(light, 0)).toBe(true);
      expect(elementActive(light, 123.4)).toBe(true);
    }
  });

  it('has the agreed tuning: a 200 px light, 15 s full, a 4 s dim, the glow-plant reach and a 20 s hint', () => {
    expect(FADING_LIGHTS).toEqual({ light: 200, fullFor: 15, dimFor: 4, touchReach: GLOW_PLANTS.bodyReach, hintAfter: 20, shareSteps: 8 });
    expect(FADING_LIGHTS.light).toBe(GLOW_PLANTS.plantLight);
    expect(Object.isFrozen(FADING_LIGHTS)).toBe(true);
  });

  it('never hides in the dark', () => {
    expect(darknessMayHide('fading-light')).toBe(false);
  });
});

describe('fading light spawns (issue #212, ND-7)', () => {
  it('builds a fading light with a 14 px radius by default and its own copy of the geometry', () => {
    const spot = { x: 1300, y: 900 };
    const spawn = fadingLightSpawn('test/fading-light-9', spot);
    expect(FADING_LIGHT_RADIUS).toBe(14);
    expect(spawn).toEqual({ id: 'test/fading-light-9', type: FADING_LIGHT, offset: 0, fadingLight: { ...spot, radius: 14 } });
    expect(spawn.type).toBe(FADING_LIGHT);
    expect(spawn.fadingLight).not.toBe(spot);
    expect(spawn.glowPlant).toBeUndefined();
  });

  it('keeps a given radius', () => {
    expect(fadingLightSpawn('test/fading-light-9', { x: 1, y: 1, radius: 20 }).fadingLight).toEqual({ x: 1, y: 1, radius: 20 });
  });

  it.each([
    ['a zero radius', { x: 1, y: 1, radius: 0 }],
    ['a negative radius', { x: 1, y: 1, radius: -4 }],
    ['a NaN radius', { x: 1, y: 1, radius: Number.NaN }],
    ['an infinite radius', { x: 1, y: 1, radius: Infinity }],
    ['a NaN x', { x: Number.NaN, y: 1 }],
    ['an infinite y', { x: 1, y: -Infinity }],
  ])('throws RangeError for %s', (_, spot) => {
    expect(() => fadingLightSpawn('test/bad', spot)).toThrow(RangeError);
  });

  it('lists only the fading lights, in element order', () => {
    expect(fadingLights(ELEMENTS).map((light) => light.id)).toEqual(LIGHT_IDS);
    expect(fadingLights([MAT, PLANT])).toEqual([]);
  });
});

describe('lighting and relighting (issue #212, ND-7 and ND-8)', () => {
  const spot = { x: 1300, y: 900, radius: 14 };

  it('counts a touch when the body edge reaches the light, edge included', () => {
    const reach = spot.radius + FADING_LIGHTS.touchReach;
    expect(touchesFadingLight({ x: spot.x + reach, y: spot.y }, spot)).toBe(true);
    expect(touchesFadingLight({ x: spot.x + reach + 0.1, y: spot.y }, spot)).toBe(false);
  });

  it('starts every light unlit', () => {
    for (const id of LIGHT_IDS) expect(fadingLightLeft({}, id)).toBe(0);
  });

  it('lights an unlit light on touch to the full 19 s', () => {
    const result = stepFadingLights({}, ELEMENTS, step({ pos: AT_FIRST }));
    expect(result).toEqual({ timers: { [LIGHT_IDS[0]]: FULL }, newLight: true });
    expect(FULL).toBe(19);
  });

  it.each([
    ['fully lit', 17],
    ['dimming', 2],
    ['out', 0],
  ])('relights a %s light to full', (_, left) => {
    const result = stepFadingLights({ [LIGHT_IDS[0]]: left }, ELEMENTS, step({ dt: 1, pos: AT_FIRST }));
    expect(fadingLightLeft(result.timers, LIGHT_IDS[0])).toBe(FULL);
    expect(fadingLightShare(fadingLightLeft(result.timers, LIGHT_IDS[0]), false)).toBe(1);
  });

  it('counts only an unlit or out light as a new light', () => {
    expect(stepFadingLights({ [LIGHT_IDS[0]]: 0 }, ELEMENTS, step({ pos: AT_FIRST })).newLight).toBe(true);
    expect(stepFadingLights({ [LIGHT_IDS[0]]: 2 }, ELEMENTS, step({ pos: AT_FIRST })).newLight).toBe(false);
    expect(stepFadingLights({ [LIGHT_IDS[0]]: 17 }, ELEMENTS, step({ pos: AT_FIRST })).newLight).toBe(false);
    expect(stepFadingLights({}, ELEMENTS, step({})).newLight).toBe(false);
  });

  it('counts every timer down, never below 0, and keeps out lights out', () => {
    const result = stepFadingLights({ [LIGHT_IDS[0]]: 10, [LIGHT_IDS[1]]: 0.3 }, ELEMENTS, step({ dt: 0.5 }));
    expect(result).toEqual({ timers: { [LIGHT_IDS[0]]: 9.5, [LIGHT_IDS[1]]: 0 }, newLight: false });
  });

  it('returns the same timers when nothing changes', () => {
    const none: FadingLightTimers = {};
    expect(stepFadingLights(none, ELEMENTS, step({})).timers).toBe(none);
    const out: FadingLightTimers = { [LIGHT_IDS[0]]: 0 };
    expect(stepFadingLights(out, ELEMENTS, step({ dt: 1 })).timers).toBe(out);
    const held: FadingLightTimers = { [LIGHT_IDS[0]]: FULL };
    expect(stepFadingLights(held, ELEMENTS, step({ dt: 0, pos: AT_FIRST })).timers).toBe(held);
  });

  it('never changes the timers it was given or the elements', () => {
    const timers: FadingLightTimers = { [LIGHT_IDS[0]]: 10 };
    const before = structuredClone(ELEMENTS);
    stepFadingLights(timers, ELEMENTS, step({ dt: 1, pos: { x: 1600, y: 800 } }));
    expect(timers).toEqual({ [LIGHT_IDS[0]]: 10 });
    expect(ELEMENTS).toEqual(before);
  });

  it.each([-0.1, Number.NaN, Infinity])('throws RangeError for a dt of %s', (dt) => {
    expect(() => stepFadingLights({}, ELEMENTS, step({ dt }))).toThrow(RangeError);
  });
});

describe('the paused hold (issue #212, ND-7)', () => {
  it('freezes the timers and ignores touches while paused', () => {
    const timers: FadingLightTimers = { [LIGHT_IDS[0]]: 3, [LIGHT_IDS[1]]: 0 };
    const result = stepFadingLights(timers, ELEMENTS, step({ dt: 5, pos: { x: 1600, y: 800 }, paused: true }));
    expect(result.timers).toBe(timers);
    expect(result.newLight).toBe(false);
  });

  it('picks up where it left off after the hold', () => {
    let timers = stepFadingLights({}, ELEMENTS, step({ pos: AT_FIRST })).timers;
    timers = stepFadingLights(timers, ELEMENTS, step({ dt: 60, paused: true })).timers;
    timers = stepFadingLights(timers, ELEMENTS, step({ dt: 1 })).timers;
    expect(fadingLightLeft(timers, LIGHT_IDS[0])).toBe(FULL - 1);
  });
});

describe('dim timing (issue #212, ND-7)', () => {
  const lit = stepFadingLights({}, ELEMENTS, step({ pos: AT_FIRST })).timers;

  it('stays fully lit for 15 s after the last touch', () => {
    for (const seconds of [0, 5, 14.5, 15]) {
      expect(fadingLightShare(fadingLightLeft(swimAway(lit, seconds), LIGHT_IDS[0]), false), `${seconds} s`).toBe(1);
    }
  });

  it('dims smoothly from 15 s and is out at 19 s', () => {
    const shares = [15.5, 16, 17, 18, 18.5].map((seconds) =>
      fadingLightShare(fadingLightLeft(swimAway(lit, seconds), LIGHT_IDS[0]), false),
    );
    for (const share of shares) expect(share).toBeGreaterThan(0);
    for (const share of shares) expect(share).toBeLessThan(1);
    for (let index = 1; index < shares.length; index += 1) expect(shares[index]).toBeLessThan(shares[index - 1]);
    expect(fadingLightShare(fadingLightLeft(swimAway(lit, 19), LIGHT_IDS[0]), false)).toBe(0);
    expect(fadingLightShare(fadingLightLeft(swimAway(lit, 25), LIGHT_IDS[0]), false)).toBe(0);
  });

  it('eases in and out of the dim, half lit halfway', () => {
    expect(fadingLightShare(FADING_LIGHTS.dimFor, false)).toBe(1);
    expect(fadingLightShare(FADING_LIGHTS.dimFor / 2, false)).toBeCloseTo(0.5, 10);
    expect(fadingLightShare(3.9, false)).toBeGreaterThan(0.99);
    expect(fadingLightShare(0.1, false)).toBeLessThan(0.01);
    expect(fadingLightShare(0, false)).toBe(0);
  });

  it.each([-0.1, Number.NaN, Infinity])('throws RangeError for a left of %s', (left) => {
    expect(() => fadingLightShare(left, false)).toThrow(RangeError);
  });
});

describe('reduced motion (issue #212, ND-10)', () => {
  it('holds full, drops to half for the last 4 s, then goes out', () => {
    expect(fadingLightShare(FULL, true)).toBe(1);
    expect(fadingLightShare(FADING_LIGHTS.dimFor, true)).toBe(1);
    for (const left of [3.99, 2, 0.01]) expect(fadingLightShare(left, true), `${left} s left`).toBe(0.5);
    expect(fadingLightShare(0, true)).toBe(0);
  });

  it('relights at once to full', () => {
    const relit = stepFadingLights({ [LIGHT_IDS[0]]: 1 }, ELEMENTS, step({ pos: AT_FIRST })).timers;
    expect(fadingLightShare(fadingLightLeft(relit, LIGHT_IDS[0]), true)).toBe(1);
  });
});

describe('quantization (issue #212, ND-7)', () => {
  it('rounds the share up to the next of 8 steps, so a light keeps a step until it is out', () => {
    expect(quantizeFadingShare(0)).toBe(0);
    expect(quantizeFadingShare(0.001)).toBe(0.125);
    expect(quantizeFadingShare(0.125)).toBe(0.125);
    expect(quantizeFadingShare(0.126)).toBe(0.25);
    expect(quantizeFadingShare(0.5)).toBe(0.5);
    expect(quantizeFadingShare(0.999)).toBe(1);
    expect(quantizeFadingShare(1)).toBe(1);
  });

  it('gives only a few distinct levels over a whole dim', () => {
    const levels = new Set<number>();
    for (let left = FULL; left >= 0; left -= 0.01) levels.add(quantizeFadingShare(fadingLightShare(Math.max(0, left), false)));
    levels.add(quantizeFadingShare(fadingLightShare(0, false)));
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
  });

  it.each([-0.1, 1.1, Number.NaN])('throws RangeError for a share of %s', (share) => {
    expect(() => quantizeFadingShare(share)).toThrow(RangeError);
  });
});

describe('the fading light circles (issue #212, ND-7)', () => {
  it('adds nothing for unlit or out lights', () => {
    expect(fadingLightCircles(ELEMENTS, {}, false)).toEqual([]);
    expect(fadingLightCircles(ELEMENTS, { [LIGHT_IDS[0]]: 0 }, false)).toEqual([]);
  });

  it('gives each lit light its centre and the 200 px light scaled by its quantized share, in element order', () => {
    const timers: FadingLightTimers = { [LIGHT_IDS[2]]: FULL, [LIGHT_IDS[0]]: 2 };
    expect(fadingLightCircles(ELEMENTS, timers, false)).toEqual([
      { x: 1300, y: 900, radius: 100 },
      { x: 1900, y: 1000, radius: 200 },
    ]);
    expect(fadingLightCircles(ELEMENTS, { [LIGHT_IDS[0]]: 0.5 }, true)).toEqual([{ x: 1300, y: 900, radius: 100 }]);
  });

  it('keeps the same radii between steps inside one quantized level', () => {
    const before = fadingLightCircles(ELEMENTS, { [LIGHT_IDS[0]]: 2.2 }, false);
    const after = fadingLightCircles(ELEMENTS, { [LIGHT_IDS[0]]: 2.1 }, false);
    expect(after).toEqual(before);
  });

  it('ignores a timer that names no fading light', () => {
    expect(fadingLightCircles(ELEMENTS, { [MAT.id]: FULL, [PLANT.id]: FULL, 'test/none': FULL }, false)).toEqual([]);
  });
});

describe('the hint (issue #212, ND-10)', () => {
  /** The hint clock and timers after `seconds` in the dark at `pos`, in 0.5 s steps. */
  function darkClock(seconds: number, pos: Point) {
    let timers: FadingLightTimers = {};
    let clock = 0;
    for (let elapsed = 0; elapsed < seconds; elapsed += 0.5) {
      const result = stepFadingLights(timers, ELEMENTS, step({ dt: 0.5, pos }));
      timers = result.timers;
      clock = stepDarkHintClock(clock, { dt: 0.5, inDark: true, newLight: result.newLight, paused: false });
    }
    return { clock, timers };
  }

  it('shows after 20 s in the dark with no new light, pointing at the nearest unlit light', () => {
    expect(fadingLightHint(19.9, { x: 1580, y: 800 }, ELEMENTS, {})).toBeNull();
    const { clock, timers } = darkClock(20, AWAY);
    expect(clock).toBe(20);
    expect(fadingLightHint(clock, { x: 1580, y: 800 }, ELEMENTS, timers)).toBe(LIGHT_IDS[1]);
  });

  it('points at a fully faded light but never at a lit or dimming one', () => {
    expect(fadingLightHint(20, { x: 1300, y: 900 }, ELEMENTS, { [LIGHT_IDS[0]]: 0 })).toBe(LIGHT_IDS[0]);
    expect(fadingLightHint(20, { x: 1300, y: 900 }, ELEMENTS, { [LIGHT_IDS[0]]: 0.5 })).toBe(LIGHT_IDS[1]);
    const allLit = Object.fromEntries(LIGHT_IDS.map((id) => [id, 3]));
    expect(fadingLightHint(20, { x: 1300, y: 900 }, ELEMENTS, allLit)).toBeNull();
  });

  it('breaks a tie by element order', () => {
    const twins = [fadingLightSpawn('test/fading-b', { x: 1000, y: 900 }), fadingLightSpawn('test/fading-a', { x: 1200, y: 900 })];
    expect(fadingLightHint(20, { x: 1100, y: 900 }, twins, {})).toBe('test/fading-b');
  });

  it('restarts the clock on a new light, but not on a relight of a dimming light', () => {
    const lit = stepFadingLights({}, ELEMENTS, step({ dt: 0.5, pos: AT_FIRST }));
    expect(stepDarkHintClock(15, { dt: 0.5, inDark: true, newLight: lit.newLight, paused: false })).toBe(0);
    const relit = stepFadingLights({ [LIGHT_IDS[0]]: 2 }, ELEMENTS, step({ dt: 0.5, pos: AT_FIRST }));
    expect(stepDarkHintClock(15, { dt: 0.5, inDark: true, newLight: relit.newLight, paused: false })).toBe(15.5);
  });

  it('holds the clock while paused, as stepDarkHintClock does', () => {
    expect(stepDarkHintClock(12, { dt: 1, inDark: true, newLight: false, paused: true })).toBe(12);
    expect(stepFadingLights({ [LIGHT_IDS[0]]: 0 }, ELEMENTS, step({ pos: AT_FIRST, paused: true })).newLight).toBe(false);
  });
});

describe('the glow-plant rules ignore fading lights (issue #212, ND-7)', () => {
  it('never lists, lights, lights up or hints at a fading light', () => {
    expect(glowPlants(ELEMENTS).map((plant) => plant.id)).toEqual([PLANT.id]);
    expect(lightGlowPlants([], ELEMENTS, AT_FIRST)).toEqual([]);
    expect(darkLights({ axolotl: AWAY, exit: AWAY, elements: ELEMENTS, lit: LIGHT_IDS })).toHaveLength(2);
    expect(darkHintPlant(20, AT_FIRST, ELEMENTS, [])).toBe(PLANT.id);
    expect(darkHintPlant(20, AT_FIRST, LIGHTS, [])).toBeNull();
  });

  it('is never touched by a fading light step', () => {
    const result = stepFadingLights({}, ELEMENTS, step({ pos: { x: 2200, y: 760 } }));
    expect(result.timers).toEqual({});
    expect(result.newLight).toBe(false);
  });
});
