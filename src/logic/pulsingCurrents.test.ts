import { describe, expect, it } from 'vitest';
import { UNDERWATER_SPRINGS_FACT } from './factCards';
import { hazardMet, legHazardAt, type HazardSpawn } from './hazards';
import { obstaclesOf } from './layoutGaps';
import { legSpeedFactor } from './legs';
import { PERK_CAPS } from './perks';
import {
  PULSING_CURRENT,
  PULSING_CURRENTS,
  addPulseCurrent,
  bandLength,
  flowStep,
  inPulseBand,
  isPulsingCurrent,
  oneLegCrossSeconds,
  pulseLandingStrip,
  pulseMotion,
  pulsePeriod,
  pulsePhase,
  pulseSurging,
  pulsingCurrentSpawn,
  pulsingCurrents,
  ventMouth,
} from './pulsingCurrents';
import { stepSwim, type SwimEnv } from './swimPhysics';
import { GHOST_NET } from './ghostNets';
import { SWIM, TILAPIA } from './tuning';
import { zoneThreats } from './hiding';
import type { Point } from './zone';

const BAND = { x0: 1000, x1: 1200, y0: 400, y1: 640 } as const;
const LEFT = pulsingCurrentSpawn('test/vent-1', BAND, { calmFor: 2.5, flow: 'left', offset: 0 });
const DOWN = pulsingCurrentSpawn('test/vent-2', { x0: 1800, x1: 2000, y0: 160, y1: 360 }, { calmFor: 2.2, flow: 'down', offset: 1 });
const NET: HazardSpawn = { id: 'test/net', type: GHOST_NET, shape: { kind: 'rect', x0: 300, x1: 340, y0: 200, y1: 260 } };

function zero(): Point {
  return { x: 0, y: 0 };
}

describe('PULSING_CURRENTS', () => {
  it("uses the owner's 0.8 s warning, the A2 floor, and 1.5 s surge, and a 2.0 s shortest calm", () => {
    expect(PULSING_CURRENTS.warnFor).toBe(0.8);
    expect(PULSING_CURRENTS.warnFor).toBe(TILAPIA.minWindup);
    expect(PULSING_CURRENTS.surgeFor).toBe(1.5);
    expect(PULSING_CURRENTS.minCalm).toBe(2.0);
  });

  it('surges faster than any axolotl swims, the speed perk at its cap included', () => {
    expect(PULSING_CURRENTS.surgeSpeed).toBe(200);
    expect(PULSING_CURRENTS.surgeSpeed).toBeGreaterThan(SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100));
  });
});

describe('PULSING_CURRENT', () => {
  it('never costs a leg and touches nothing, with the "Underwater springs" card met within 60 px', () => {
    expect(PULSING_CURRENT.costsLeg).toBe(false);
    expect(PULSING_CURRENT.reach).toBe(0);
    expect(PULSING_CURRENT.meetRange).toBe(60);
    expect(PULSING_CURRENT.fact).toBe(UNDERWATER_SPRINGS_FACT);
    expect(UNDERWATER_SPRINGS_FACT).toEqual({
      id: 'pulsing-current',
      name: 'Underwater springs',
      title: 'Underwater springs',
      body: "Long ago, springs bubbling up from underground filled Xochimilco's canals with clean water. Axolotls need cool, clean water to stay healthy.",
    });
  });

  it('is never a leg hit, even in the band while surging', () => {
    expect(legHazardAt([LEFT], { x: 1100, y: 500 })).toBeUndefined();
  });

  it('is met within 60 px of its band, edge included, and not past it', () => {
    expect(hazardMet(LEFT, { x: 940, y: 500 })).toBe(true);
    expect(hazardMet(LEFT, { x: 939, y: 500 })).toBe(false);
    expect(hazardMet(LEFT, { x: 1100, y: 500 })).toBe(true);
  });

  it('is never a risk threat for hiding spots and never a gap obstacle', () => {
    expect(zoneThreats({ tilapiaRoutes: [], hazards: [LEFT, NET] })).toEqual([]);
    const obstacles = obstaclesOf({ tilapiaRoutes: [], predatorRoutes: [], hazards: [LEFT, NET], movingHazards: [] });
    expect(obstacles.map((obstacle) => obstacle.id)).toEqual(['test/net']);
  });
});

describe('pulsingCurrentSpawn', () => {
  it('builds a band hazard with a copy of its pulse', () => {
    const pulse = { calmFor: 2.5, flow: 'left', offset: 0 } as const;
    const spawn = pulsingCurrentSpawn('test/vent', BAND, pulse);
    expect(spawn).toEqual({ id: 'test/vent', type: PULSING_CURRENT, shape: { kind: 'rect', ...BAND }, pulse });
    expect(spawn.pulse).not.toBe(pulse);
    expect(isPulsingCurrent(spawn)).toBe(true);
  });

  it('refuses an empty or non-finite band', () => {
    expect(() => pulsingCurrentSpawn('x', { x0: 10, x1: 10, y0: 0, y1: 50 }, LEFT.pulse)).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', { x0: 10, x1: 50, y0: 60, y1: 50 }, LEFT.pulse)).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', { x0: 10, x1: Infinity, y0: 0, y1: 50 }, LEFT.pulse)).toThrow(RangeError);
  });

  it('refuses a calm under 2.0 s, or not finite, and an offset not finite', () => {
    expect(() => pulsingCurrentSpawn('x', BAND, { calmFor: 1.99, flow: 'left', offset: 0 })).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', BAND, { calmFor: NaN, flow: 'left', offset: 0 })).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', BAND, { calmFor: 2.5, flow: 'left', offset: NaN })).toThrow(RangeError);
  });

  it('refuses a band a one-leg axolotl cannot cross, body edge to body edge, in the calm and the warning', () => {
    const oneLeg = SWIM.maxSpeed * legSpeedFactor(1);
    const longest = oneLeg * (2.0 + 0.8) - 2 * PULSING_CURRENTS.bodyReach;
    expect(oneLegCrossSeconds(longest)).toBeCloseTo(2.8, 10);
    expect(() => pulsingCurrentSpawn('x', { x0: 0, x1: Math.floor(longest), y0: 0, y1: 100 }, { calmFor: 2.0, flow: 'right', offset: 0 })).not.toThrow();
    expect(() => pulsingCurrentSpawn('x', { x0: 0, x1: Math.ceil(longest) + 1, y0: 0, y1: 100 }, { calmFor: 2.0, flow: 'right', offset: 0 })).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', { x0: 0, x1: 100, y0: 0, y1: Math.ceil(longest) + 1 }, { calmFor: 2.0, flow: 'up', offset: 0 })).toThrow(RangeError);
    expect(() => pulsingCurrentSpawn('x', { x0: 0, x1: 100, y0: 0, y1: Math.ceil(longest) + 1 }, { calmFor: 2.0, flow: 'left', offset: 0 })).not.toThrow();
  });

  it('measures a band along its flow', () => {
    expect(bandLength(LEFT.shape, 'left')).toBe(200);
    expect(bandLength(LEFT.shape, 'right')).toBe(200);
    expect(bandLength(LEFT.shape, 'up')).toBe(240);
    expect(bandLength(LEFT.shape, 'down')).toBe(240);
  });

  it('lists only the pulsing currents, in hazard order', () => {
    expect(pulsingCurrents([NET, DOWN, LEFT])).toEqual([DOWN, LEFT]);
    expect(isPulsingCurrent(NET)).toBe(false);
  });
});

describe('pulsePhase', () => {
  it('runs calm, then the warning, then the surge, from the offset', () => {
    expect(pulsePeriod(LEFT.pulse)).toBeCloseTo(4.8, 10);
    expect(pulsePhase(LEFT.pulse, 0)).toEqual({ phase: 'calm', progress: 0 });
    expect(pulsePhase(LEFT.pulse, 1.25)).toEqual({ phase: 'calm', progress: 0.5 });
    expect(pulsePhase(LEFT.pulse, 2.5)).toEqual({ phase: 'warn', progress: 0 });
    expect(pulsePhase(LEFT.pulse, 2.9).phase).toBe('warn');
    expect(pulsePhase(LEFT.pulse, 2.9).progress).toBeCloseTo(0.5, 10);
    expect(pulsePhase(LEFT.pulse, 3.3)).toEqual({ phase: 'surge', progress: 0 });
    expect(pulsePhase(LEFT.pulse, 4.05).progress).toBeCloseTo(0.5, 10);
    expect(pulsePhase(LEFT.pulse, 4.8)).toEqual({ phase: 'calm', progress: 0 });
  });

  it('counts from the offset, for any time, negative or large', () => {
    expect(pulsePhase(DOWN.pulse, 1)).toEqual({ phase: 'calm', progress: 0 });
    expect(pulsePhase(DOWN.pulse, 0).phase).toBe('surge');
    expect(pulsePhase(LEFT.pulse, -1).phase).toBe('surge');
    expect(pulsePhase(LEFT.pulse, 4.8 * 1000 + 3.4).phase).toBe('surge');
  });

  it('surges only in the surge, never in the calm or the warning', () => {
    for (let t = 0; t < 4.8; t += 0.05) {
      expect(pulseSurging(LEFT.pulse, t)).toBe(pulsePhase(LEFT.pulse, t).phase === 'surge');
    }
  });
});

describe('addPulseCurrent', () => {
  it('pushes at 200 px/s along the flow, only in the band and only while surging', () => {
    expect(addPulseCurrent(zero(), { x: 1100, y: 500 }, [LEFT], 3.5)).toEqual({ x: -200, y: 0 });
    expect(addPulseCurrent(zero(), { x: 1100, y: 500 }, [LEFT], 1)).toEqual({ x: 0, y: 0 });
    expect(addPulseCurrent(zero(), { x: 1100, y: 500 }, [LEFT], 3)).toEqual({ x: 0, y: 0 });
    expect(addPulseCurrent(zero(), { x: 990, y: 500 }, [LEFT], 3.5)).toEqual({ x: 0, y: 0 });
    expect(addPulseCurrent(zero(), { x: 1900, y: 200 }, [DOWN], 0.5)).toEqual({ x: 0, y: 200 });
  });

  it('counts the band edges in, adds to what is there and returns the same object', () => {
    const out = { x: 10, y: -5 };
    expect(addPulseCurrent(out, { x: 1000, y: 640 }, [LEFT], 3.5)).toBe(out);
    expect(out).toEqual({ x: -190, y: -5 });
  });

  it('adds nothing for hazards that are not pulsing currents', () => {
    const out = zero();
    addPulseCurrent(out, { x: 320, y: 230 }, [NET], 0);
    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('has one step for each flow', () => {
    expect(flowStep('left')).toEqual({ x: -1, y: 0 });
    expect(flowStep('right')).toEqual({ x: 1, y: 0 });
    expect(flowStep('up')).toEqual({ x: 0, y: -1 });
    expect(flowStep('down')).toEqual({ x: 0, y: 1 });
  });
});

describe('a surge on the swim', () => {
  const bounds = { minX: 40, maxX: 3800, minY: 94, maxY: 656 };

  function swimAgainst(start: Point, steer: Point, seconds: number, maxSpeed: number): Point {
    let state = { x: start.x, y: start.y, vx: steer.x * maxSpeed, vy: 0, facing: 1 as const };
    const tuning = { ...SWIM, maxSpeed };
    const dt = 1 / 60;
    for (let t = 3.3; t < 3.3 + seconds; t += dt) {
      const current = addPulseCurrent(zero(), state, [LEFT], t);
      const env: SwimEnv = { current, dragMul: 1, bounds, dashing: false };
      state = { ...stepSwim(state, steer, env, dt, tuning), facing: 1 };
    }
    return state;
  }

  it('pushes even the fastest swimmer back out of the band, and leaves it in the landing strip just past the downstream edge', () => {
    const fastest = SWIM.maxSpeed * (1 + PERK_CAPS.speed / 100);
    const end = swimAgainst({ x: 1150, y: 500 }, { x: 1, y: 0 }, PULSING_CURRENTS.surgeFor - 0.02, fastest);
    expect(end.x).toBeLessThan(1150);
    const still = swimAgainst({ x: 1050, y: 500 }, { x: 0, y: 0 }, PULSING_CURRENTS.surgeFor - 0.02, SWIM.maxSpeed);
    expect(still.x).toBeLessThan(BAND.x0);
    expect(inPulseBand(still, pulseLandingStrip(LEFT))).toBe(true);
  });
});

describe('the vent and the landing strip', () => {
  it('puts the vent mouth at the middle of the upstream edge', () => {
    expect(ventMouth(LEFT)).toEqual({ x: 1200, y: 520 });
    expect(ventMouth(DOWN)).toEqual({ x: 1900, y: 160 });
    expect(ventMouth(pulsingCurrentSpawn('r', BAND, { calmFor: 2, flow: 'right', offset: 0 }))).toEqual({ x: 1000, y: 520 });
    expect(ventMouth(pulsingCurrentSpawn('u', BAND, { calmFor: 2.5, flow: 'up', offset: 0 }))).toEqual({ x: 1100, y: 640 });
  });

  it('puts the landing strip 60 px deep just past the downstream edge, across the whole band', () => {
    expect(pulseLandingStrip(LEFT)).toEqual({ kind: 'rect', x0: 940, x1: 1000, y0: 400, y1: 640 });
    expect(pulseLandingStrip(DOWN)).toEqual({ kind: 'rect', x0: 1800, x1: 2000, y0: 360, y1: 420 });
    expect(pulseLandingStrip(pulsingCurrentSpawn('r', BAND, { calmFor: 2, flow: 'right', offset: 0 }))).toEqual({ kind: 'rect', x0: 1200, x1: 1260, y0: 400, y1: 640 });
    expect(pulseLandingStrip(pulsingCurrentSpawn('u', BAND, { calmFor: 2.5, flow: 'up', offset: 0 }))).toEqual({ kind: 'rect', x0: 1000, x1: 1200, y0: 340, y1: 400 });
  });
});

describe('pulseMotion', () => {
  it('rises the bubbles and streaks the surge with full motion, and holds the bubbles and darkens the band under reduced motion', () => {
    expect(pulseMotion(false)).toEqual({ bubbles: 'rise', surge: 'streaks' });
    expect(pulseMotion(true)).toEqual({ bubbles: 'still', surge: 'darken' });
  });
});
