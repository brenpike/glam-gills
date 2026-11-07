import { describe, expect, it } from 'vitest';
import { elementActive, elementSweep, type ElementSpawn } from './hazards';
import { WATER_HYACINTH } from './hyacinthMats';
import { legSpeedFactor } from './legs';
import { mobileSnackAvoid } from './mobileSnacks';
import { stepSwim, type SwimEnv } from './swimPhysics';
import { SWIM, TILAPIA } from './tuning';
import {
  WIND,
  WINDS,
  addWindForce,
  gustDirection,
  isWind,
  oneLegHeadway,
  windForceAt,
  windGusting,
  windPeriod,
  windPhase,
  windPose,
  windSpawn,
  winds,
} from './wind';
import { SURF, type Point, type SafeArea } from './zone';

const SAFE: SafeArea = { x0: 40, x1: 300, y0: SURF, y1: 678 };
const RIGHT = windSpawn('test/wind-1', 0, { x0: 0, x1: 4320, direction: 'right' });
const LEFT = windSpawn('test/wind-2', 2, { x0: 1000, x1: 2000, fadeY: 220, direction: 'left' });
const GUST_T = 5;
const MATS: ElementSpawn = {
  id: 'test/mats',
  type: WATER_HYACINTH,
  offset: 0,
  matPair: { x0: 600, x1: 700, rowTop: SURF, rowBottom: 360, channelY: 220, openHeight: 80 },
};

function zero(): Point {
  return { x: 0, y: 0 };
}

describe('WINDS', () => {
  it('runs a 3.0 s calm, a 1.2 s warning at or above the A2 0.8 s floor and a 2.5 s gust', () => {
    expect(WINDS.calmFor).toBe(3.0);
    expect(WINDS.warnFor).toBe(1.2);
    expect(WINDS.warnFor).toBeGreaterThanOrEqual(TILAPIA.minWindup);
    expect(WINDS.gustFor).toBe(2.5);
    expect(windPeriod()).toBeCloseTo(6.7, 10);
  });

  it('pushes 60 px/s at the surface, fading to nothing at y 360', () => {
    expect(WINDS.surfaceSpeed).toBe(60);
    expect(WINDS.fadeY).toBe(360);
  });

  it('leaves a one-leg axolotl, 90 px/s, at least 30 px/s into the strongest gust', () => {
    expect(SWIM.maxSpeed * legSpeedFactor(1)).toBe(90);
    expect(oneLegHeadway()).toBe(30);
    expect(oneLegHeadway()).toBeGreaterThanOrEqual(WINDS.minHeadway);
  });
});

describe('WIND', () => {
  it('is a cycle element named Wind and waves whose clock always runs', () => {
    expect(WIND.id).toBe('wind');
    expect(WIND.name).toBe('Wind and waves');
    expect(WIND.kind).toBe('cycle');
    expect(WIND.period).toBeCloseTo(6.7, 10);
    expect(WIND.activeFor).toBe(WIND.period);
    for (let t = -7; t < 14; t += 0.25) expect(elementActive(RIGHT, t)).toBe(true);
  });

  it('has no fact card and no meet range, so it is never met', () => {
    expect(WIND.fact).toBeUndefined();
    expect(WIND.meetRange).toBeUndefined();
  });

  it('has no sweep, so the snacks never keep away from it', () => {
    expect(elementSweep(RIGHT)).toBeNull();
    const base = {
      width: 4320,
      bedTop: 678,
      homeSpot: { x: 120, y: 200, radius: 72 },
      safeArea: SAFE,
      currents: [],
      hazards: [],
      tilapiaRoutes: [],
      predatorRoutes: [],
    };
    const without = mobileSnackAvoid({ ...base, elements: [MATS] });
    const withWind = mobileSnackAvoid({ ...base, elements: [RIGHT, MATS, LEFT] });
    expect(withWind.mats).toEqual(without.mats);
    expect(withWind.keepAway).toEqual(without.keepAway);
  });
});

describe('windSpawn', () => {
  it('builds a wind element with a copy of its span, fading at y 360 unless told otherwise', () => {
    const span = { x0: 0, x1: 4320, direction: 'right' } as const;
    const spawn = windSpawn('test/wind', 1.5, span);
    expect(spawn).toEqual({ id: 'test/wind', type: WIND, offset: 1.5, wind: { ...span, fadeY: 360 } });
    expect(spawn.wind).not.toBe(span);
    expect(LEFT.wind.fadeY).toBe(220);
  });

  it('refuses a span that is empty or not finite', () => {
    expect(() => windSpawn('x', 0, { x0: 10, x1: 10, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: 20, x1: 10, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: 0, x1: Infinity, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: NaN, x1: 10, direction: 'left' })).toThrow(RangeError);
  });

  it('refuses a fade depth not below the surface, deeper than y 360 or not finite', () => {
    expect(() => windSpawn('x', 0, { x0: 0, x1: 10, fadeY: SURF, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: 0, x1: 10, fadeY: 361, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: 0, x1: 10, fadeY: NaN, direction: 'left' })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, { x0: 0, x1: 10, fadeY: 360, direction: 'left' })).not.toThrow();
  });

  it('refuses a direction other than left or right, and an offset not finite', () => {
    const up = { x0: 0, x1: 10, direction: 'up' } as unknown as Parameters<typeof windSpawn>[2];
    expect(() => windSpawn('x', 0, up)).toThrow(RangeError);
    expect(() => windSpawn('x', NaN, { x0: 0, x1: 10, direction: 'left' })).toThrow(RangeError);
  });

  it('refuses a warning under the A2 floor and a gust a one-leg axolotl keeps under 30 px/s into', () => {
    const span = { x0: 0, x1: 10, direction: 'left' } as const;
    expect(() => windSpawn('x', 0, span, { ...WINDS, warnFor: 0.79 })).toThrow(RangeError);
    expect(() => windSpawn('x', 0, span, { ...WINDS, warnFor: 0.8 })).not.toThrow();
    expect(() => windSpawn('x', 0, span, { ...WINDS, surfaceSpeed: 61 })).toThrow(RangeError);
  });

  it('lists only the wind elements, in element order', () => {
    expect(winds([MATS, LEFT, RIGHT])).toEqual([LEFT, RIGHT]);
    expect(isWind(MATS)).toBe(false);
  });
});

describe('windPhase', () => {
  it('runs calm, then the warning, then the gust, from the offset', () => {
    expect(windPhase(RIGHT, 0)).toEqual({ phase: 'calm', progress: 0 });
    expect(windPhase(RIGHT, 1.5)).toEqual({ phase: 'calm', progress: 0.5 });
    expect(windPhase(RIGHT, 3)).toEqual({ phase: 'warn', progress: 0 });
    expect(windPhase(RIGHT, 3.6).phase).toBe('warn');
    expect(windPhase(RIGHT, 3.6).progress).toBeCloseTo(0.5, 10);
    expect(windPhase(RIGHT, 4.2)).toEqual({ phase: 'gust', progress: 0 });
    expect(windPhase(RIGHT, 5.45).progress).toBeCloseTo(0.5, 10);
    expect(windPhase(RIGHT, 6.7)).toEqual({ phase: 'calm', progress: 0 });
  });

  it('counts from the offset, for any time, negative or large', () => {
    expect(windPhase(LEFT, 2)).toEqual({ phase: 'calm', progress: 0 });
    expect(windPhase(LEFT, 1).phase).toBe('gust');
    expect(windPhase(RIGHT, -1).phase).toBe('gust');
    expect(windPhase(RIGHT, 6.7 * 1000 + 4.5).phase).toBe('gust');
  });

  it('gusts only in the gust, never in the calm or the warning', () => {
    for (let t = 0; t < 6.7; t += 0.05) {
      expect(windGusting(RIGHT, t)).toBe(windPhase(RIGHT, t).phase === 'gust');
    }
  });
});

describe('gustDirection', () => {
  it('blows the first direction from the offset, then switches every gust', () => {
    expect(gustDirection(RIGHT, GUST_T)).toBe('right');
    expect(gustDirection(RIGHT, GUST_T + 6.7)).toBe('left');
    expect(gustDirection(RIGHT, GUST_T + 2 * 6.7)).toBe('right');
    expect(gustDirection(LEFT, 2 + 4.5)).toBe('left');
    expect(gustDirection(LEFT, 2 + 4.5 + 6.7)).toBe('right');
  });

  it('switches before the offset too, and holds one way through a whole cycle', () => {
    expect(gustDirection(RIGHT, -1)).toBe('left');
    expect(gustDirection(RIGHT, -1 - 6.7)).toBe('right');
    expect(gustDirection(RIGHT, 0.1)).toBe('right');
    expect(gustDirection(RIGHT, 3.5)).toBe('right');
    expect(gustDirection(RIGHT, 6.6)).toBe('right');
  });
});

describe('windForceAt', () => {
  it('pushes 60 px/s along the gust at the surface, only in the span and only while gusting', () => {
    expect(windForceAt(RIGHT, { x: 500, y: SURF }, GUST_T)).toBe(60);
    expect(windForceAt(RIGHT, { x: 500, y: SURF }, GUST_T + 6.7)).toBe(-60);
    expect(windForceAt(RIGHT, { x: 500, y: SURF }, 1)).toBe(0);
    expect(windForceAt(RIGHT, { x: 500, y: SURF }, 3.5)).toBe(0);
    expect(windForceAt(LEFT, { x: 999, y: SURF }, 2 + 4.5)).toBe(0);
    expect(windForceAt(LEFT, { x: 1000, y: SURF }, 2 + 4.5)).toBe(-60);
    expect(windForceAt(LEFT, { x: 2000, y: SURF }, 2 + 4.5)).toBe(-60);
    expect(windForceAt(LEFT, { x: 2001, y: SURF }, 2 + 4.5)).toBe(0);
  });

  it('fades linearly with depth to nothing at y 360, so depth band 2 is calm', () => {
    expect(windForceAt(RIGHT, { x: 500, y: SURF + 70 }, GUST_T)).toBeCloseTo(45, 10);
    expect(windForceAt(RIGHT, { x: 500, y: 220 }, GUST_T)).toBeCloseTo(30, 10);
    expect(windForceAt(RIGHT, { x: 500, y: 290 }, GUST_T)).toBeCloseTo(15, 10);
    expect(windForceAt(RIGHT, { x: 500, y: 360 }, GUST_T)).toBe(0);
    expect(windForceAt(RIGHT, { x: 500, y: 500 }, GUST_T)).toBe(0);
    expect(windForceAt(RIGHT, { x: 500, y: 700 }, GUST_T)).toBe(0);
    expect(windForceAt(RIGHT, { x: 500, y: SURF - 10 }, GUST_T)).toBe(60);
  });

  it("fades at the spawn's own fade depth", () => {
    expect(windForceAt(LEFT, { x: 1500, y: 150 }, 2 + 4.5)).toBeCloseTo(-30, 10);
    expect(windForceAt(LEFT, { x: 1500, y: 220 }, 2 + 4.5)).toBe(0);
  });
});

describe('addWindForce', () => {
  it('adds every gusting wind along x, adds to what is there and returns the same object', () => {
    const out = { x: 10, y: -5 };
    expect(addWindForce(out, { x: 1500, y: SURF }, [RIGHT, MATS, LEFT], GUST_T, SAFE)).toBe(out);
    expect(out).toEqual({ x: 10 + 60, y: -5 });
    expect(addWindForce(zero(), { x: 1500, y: SURF }, [LEFT], 2 + 4.5, SAFE)).toEqual({ x: -60, y: 0 });
  });

  it('never pushes inside the safe area, edges included', () => {
    expect(addWindForce(zero(), { x: 200, y: SURF }, [RIGHT], GUST_T, SAFE)).toEqual({ x: 0, y: 0 });
    expect(addWindForce(zero(), { x: 300, y: SURF }, [RIGHT], GUST_T, SAFE)).toEqual({ x: 0, y: 0 });
    expect(addWindForce(zero(), { x: 301, y: SURF }, [RIGHT], GUST_T, SAFE)).toEqual({ x: 60, y: 0 });
  });

  it('adds nothing for elements that are not wind, nor outside the gust', () => {
    expect(addWindForce(zero(), { x: 650, y: 200 }, [MATS], GUST_T, SAFE)).toEqual({ x: 0, y: 0 });
    expect(addWindForce(zero(), { x: 650, y: 200 }, [], GUST_T, SAFE)).toEqual({ x: 0, y: 0 });
    expect(addWindForce(zero(), { x: 650, y: SURF }, [RIGHT], 3.5, SAFE)).toEqual({ x: 0, y: 0 });
  });
});

describe('a gust on the swim', () => {
  const bounds = { minX: 40, maxX: 4280, minY: SURF, maxY: 656 };

  function swimInto(start: Point, steer: Point, from: number, seconds: number): Point {
    const maxSpeed = SWIM.maxSpeed * legSpeedFactor(1);
    let state = { x: start.x, y: start.y, vx: steer.x * maxSpeed, vy: 0, facing: 1 as const };
    const tuning = { ...SWIM, maxSpeed };
    const dt = 1 / 60;
    for (let t = from; t < from + seconds - dt / 2; t += dt) {
      const current = addWindForce(zero(), state, [RIGHT], t, SAFE);
      const env: SwimEnv = { current, dragMul: 1, bounds, dashing: false };
      state = { ...stepSwim(state, steer, env, dt, tuning), y: start.y, vy: 0, facing: 1 };
    }
    return state;
  }

  it('leaves a one-leg axolotl at least 30 px/s swimming straight into the strongest gust', () => {
    const gustStart = WINDS.calmFor + WINDS.warnFor;
    const seconds = WINDS.gustFor - 0.1;
    const end = swimInto({ x: 3000, y: SURF }, { x: -1, y: 0 }, gustStart + 0.05, seconds);
    expect(gustDirection(RIGHT, gustStart)).toBe('right');
    expect(3000 - end.x).toBeGreaterThanOrEqual(30 * seconds - 1e-6);
  });
});

describe('windPose', () => {
  it('shows the warning and the gust shares, with the coming gust direction', () => {
    expect(windPose(RIGHT, 1, false)).toEqual({ phase: 'calm', warn: 0, gust: 0, direction: 'right', motion: 'flow' });
    const warn = windPose(RIGHT, 3.6, false);
    expect(warn.phase).toBe('warn');
    expect(warn.warn).toBeCloseTo(0.5, 10);
    expect(warn.gust).toBe(0);
    const gust = windPose(RIGHT, 5.45 + 6.7, false);
    expect(gust.phase).toBe('gust');
    expect(gust.warn).toBe(0);
    expect(gust.gust).toBeCloseTo(0.5, 10);
    expect(gust.direction).toBe('left');
  });

  it('holds still under reduced motion, yet still shows the warning and the gust', () => {
    const still = windPose(RIGHT, 3.6, true);
    expect(still.motion).toBe('still');
    expect(still.warn).toBeCloseTo(0.5, 10);
    expect(windPose(RIGHT, 5.45, true).gust).toBeCloseTo(0.5, 10);
  });
});
