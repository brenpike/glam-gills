import { describe, expect, it } from 'vitest';
import { currentAt, reedDragAt } from './environment';
import {
  createLegs,
  isProtected,
  legSpeedFactor,
  legSwimTuning,
  legWobble,
  presentCount,
  quantizeProgress,
  speedUpRegrowth,
  tryHit,
  updateLegs,
  type LegsState,
} from './legs';
import { stepSwim, type SwimState } from './swimPhysics';
import { LEGS, SWIM, type SwimTuning } from './tuning';
import { normalize, type Vec2 } from './vec';
import { buildCanalZone, swimBounds, type CurrentZone, type ZoneLayout } from './zone';

const FRAME = 1 / 60;
const LEG_COUNTS = [1, 2, 3, 4];

function hitOnce(legs: LegsState): LegsState {
  const result = tryHit(legs);
  if (!result.hit) throw new Error('expected the hit to land');
  return result.state;
}

/** Loses `count` legs, waiting out protected time between hits. */
function loseLegs(count: number): LegsState {
  let legs = createLegs();
  for (let i = 0; i < count; i++) {
    legs = updateLegs(hitOnce(legs), LEGS.protectedTime);
  }
  return legs;
}

function runFrames(legs: LegsState, seconds: number): LegsState {
  let next = legs;
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) next = updateLegs(next, FRAME);
  return next;
}

function swimStep(state: SwimState, steer: Vec2, zone: ZoneLayout, tuning: SwimTuning): SwimState {
  const pos = { x: state.x, y: state.y };
  const env = {
    current: currentAt(pos, zone.currents),
    dragMul: reedDragAt(pos, zone.reedPatches),
    bounds: swimBounds(),
    dashing: false,
  };
  return stepSwim(state, steer, env, FRAME, tuning);
}

function centreOf(current: CurrentZone): Vec2 {
  return { x: (current.x0 + current.x1) / 2, y: (current.y0 + current.y1) / 2 };
}

describe('createLegs', () => {
  it('starts with every leg present and no protection', () => {
    const legs = createLegs();
    expect(legs.slots).toHaveLength(LEGS.count);
    expect(legs.slots.every((slot) => slot.status === 'present' && slot.progress === 1)).toBe(true);
    expect(presentCount(legs)).toBe(4);
    expect(isProtected(legs)).toBe(false);
    expect(legs.regrowQueue).toEqual([]);
  });
});

describe('tryHit', () => {
  it('removes exactly one leg in slot order and starts protected time', () => {
    const start = createLegs();
    const result = tryHit(start);
    expect(result.hit).toBe(true);
    if (!result.hit) return;
    expect(result.legIndex).toBe(0);
    expect(result.tripOver).toBe(false);
    expect(presentCount(result.state)).toBe(3);
    expect(result.state.slots[0]).toEqual({ status: 'regrowing', progress: 0 });
    expect(result.state.protectedLeft).toBe(LEGS.protectedTime);
    expect(isProtected(result.state)).toBe(true);
    expect(presentCount(start)).toBe(4);
  });

  it('changes nothing during protected time', () => {
    const hitState = hitOnce(createLegs());
    const second = tryHit(updateLegs(hitState, LEGS.protectedTime / 2));
    expect(second.hit).toBe(false);
    expect(presentCount(second.state)).toBe(3);
  });

  it('loses legs in the fixed order 0, 1, 2, 3', () => {
    let legs = createLegs();
    const order: number[] = [];
    for (let i = 0; i < LEGS.count; i++) {
      const result = tryHit(legs);
      if (!result.hit) throw new Error('expected the hit to land');
      order.push(result.legIndex);
      legs = updateLegs(result.state, LEGS.protectedTime);
    }
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('removes a present leg while another regrows, keeping its progress', () => {
    const legs = updateLegs(hitOnce(createLegs()), 5);
    expect(legs.slots[0].status).toBe('regrowing');
    const progress = legs.slots[0].progress;
    expect(progress).toBeCloseTo(5 / LEGS.regrowTime, 9);

    const result = tryHit(legs);
    if (!result.hit) throw new Error('expected the hit to land');
    expect(result.legIndex).toBe(1);
    expect(result.state.slots[0]).toEqual({ status: 'regrowing', progress });
    expect(result.state.slots[1]).toEqual({ status: 'lost', progress: 0 });
    expect(result.state.regrowQueue).toEqual([0, 1]);
  });

  it('reports tripOver when the last present leg is lost, even with one regrowing', () => {
    const legs = loseLegs(3);
    expect(presentCount(legs)).toBe(1);
    expect(legs.slots.filter((slot) => slot.status === 'regrowing')).toHaveLength(1);
    const result = tryHit(legs);
    if (!result.hit) throw new Error('expected the hit to land');
    expect(result.tripOver).toBe(true);
    expect(presentCount(result.state)).toBe(0);
  });

  it('does nothing with no present leg', () => {
    const empty = updateLegs(hitOnce(loseLegs(3)), LEGS.protectedTime);
    const result = tryHit(empty);
    expect(result.hit).toBe(false);
    expect(result.state).toBe(empty);
  });
});

describe('updateLegs', () => {
  it('ends protected time after protectedTime of accumulated dt', () => {
    let legs = hitOnce(createLegs());
    legs = runFrames(legs, LEGS.protectedTime - 0.1);
    expect(isProtected(legs)).toBe(true);
    legs = runFrames(legs, 0.2);
    expect(isProtected(legs)).toBe(false);
    expect(tryHit(legs).hit).toBe(true);
  });

  it('regrows one leg at a time, first lost first, with rising progress', () => {
    let legs = loseLegs(2);
    expect(legs.regrowQueue).toEqual([0, 1]);
    let previous = legs.slots[0].progress;
    for (let i = 0; i < 10; i++) {
      legs = updateLegs(legs, 1);
      expect(legs.slots[0].progress).toBeGreaterThan(previous);
      expect(legs.slots[1]).toEqual({ status: 'lost', progress: 0 });
      previous = legs.slots[0].progress;
    }
  });

  it('regrows a lost leg after about regrowTime seconds', () => {
    const lost = hitOnce(createLegs());
    expect(presentCount(runFrames(lost, LEGS.regrowTime - 0.5))).toBe(3);
    expect(presentCount(runFrames(lost, LEGS.regrowTime + 0.5))).toBe(4);
  });

  it('carries leftover dt into the next queued leg', () => {
    const legs = hitOnce(updateLegs(hitOnce(createLegs()), LEGS.protectedTime));
    const remainingFirst = (1 - legs.slots[0].progress) * LEGS.regrowTime;
    const next = updateLegs(legs, remainingFirst + 3);
    expect(next.slots[0]).toEqual({ status: 'present', progress: 1 });
    expect(next.slots[1].status).toBe('regrowing');
    expect(next.slots[1].progress).toBeCloseTo(3 / LEGS.regrowTime, 9);
    expect(next.regrowQueue).toEqual([1]);
  });

  it('regrows every leg back to whole', () => {
    const legs = updateLegs(loseLegs(4), LEGS.regrowTime * LEGS.count + 1);
    expect(legs).toEqual(createLegs());
  });

  it('changes nothing for zero, negative or non-finite dt', () => {
    const legs = updateLegs(hitOnce(createLegs()), 0.5);
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(updateLegs(legs, dt)).toBe(legs);
    }
  });

  it('does not mutate its input', () => {
    const legs = hitOnce(createLegs());
    const snapshot = structuredClone(legs);
    updateLegs(legs, LEGS.regrowTime * 2);
    expect(legs).toEqual(snapshot);
  });
});

describe('speedUpRegrowth (A19)', () => {
  const SHORT = { ...LEGS, regrowTime: 13 };

  function withHead(legs: LegsState, progress: number): LegsState {
    const slots = legs.slots.map((slot, index) => (index === legs.regrowQueue[0] ? { ...slot, progress } : { ...slot }));
    return { ...legs, slots };
  }

  function eatOneByOne(legs: LegsState, snacks: number): { state: LegsState; boosted: number[] } {
    let state = legs;
    const boosted: number[] = [];
    for (let i = 0; i < snacks; i++) {
      const result = speedUpRegrowth(state, 1);
      state = result.state;
      boosted.push(...result.boosted);
    }
    return { state, boosted };
  }

  it('does nothing with four legs or with 0 snacks', () => {
    const whole = createLegs();
    const wholeResult = speedUpRegrowth(whole, 3);
    expect(wholeResult.state).toBe(whole);
    expect(wholeResult.boosted).toEqual([]);

    const lost = hitOnce(createLegs());
    const noSnack = speedUpRegrowth(lost, 0);
    expect(noSnack.state).toBe(lost);
    expect(noSnack.boosted).toEqual([]);
  });

  it('adds a fixed snackSpeedUp to the regrowing leg only', () => {
    const legs = updateLegs(hitOnce(loseLegs(1)), 1);
    const result = speedUpRegrowth(legs, 1);
    expect(LEGS.snackSpeedUp).toBe(0.1);
    expect(result.boosted).toEqual([0]);
    expect(result.state.slots[0]).toEqual({ status: 'regrowing', progress: legs.slots[0].progress + 0.1 });
    expect(result.state.slots.slice(1)).toEqual(legs.slots.slice(1));
    expect(result.state.regrowQueue).toEqual(legs.regrowQueue);
    expect(result.state.protectedLeft).toBe(legs.protectedLeft);
    expect(result.state.protectedLeft).toBeGreaterThan(0);
  });

  it('saves about 4 seconds of regrowth per snack at the base time', () => {
    const boosted = speedUpRegrowth(hitOnce(createLegs()), 1).state;
    const left = (1 - LEGS.snackSpeedUp) * LEGS.regrowTime;
    expect(left).toBeCloseTo(36, 9);
    expect(presentCount(runFrames(boosted, left - 0.5))).toBe(3);
    expect(presentCount(runFrames(boosted, left + 0.5))).toBe(4);
  });

  it('never goes past a full leg and never moves regrowth backwards', () => {
    for (const start of [0, 0.1, 0.35, 0.5, 0.79, 0.81, 0.95, 0.999]) {
      let legs = withHead(loseLegs(3), start);
      for (let i = 0; i < 40; i++) {
        const next = speedUpRegrowth(legs, 1).state;
        for (let slot = 0; slot < next.slots.length; slot++) {
          expect(next.slots[slot].progress, `start ${start} snack ${i}`).toBeLessThanOrEqual(1);
          expect(next.slots[slot].progress, `start ${start} snack ${i}`).toBeGreaterThanOrEqual(
            legs.slots[slot].progress,
          );
        }
        legs = next;
      }
      expect(legs.slots.every((slot) => slot.status === 'present' && slot.progress === 1)).toBe(true);
    }
  });

  it('finishes a leg when float rounding sums just under a full leg', () => {
    const tenth = { snackSpeedUp: 0.1 };
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += tenth.snackSpeedUp;
    expect(sum).toBeLessThan(1);

    const legs = withHead(loseLegs(2), 0);
    const result = speedUpRegrowth(legs, 10, tenth);
    expect(result.state.slots[0]).toEqual({ status: 'present', progress: 1 });
    expect(result.state.slots[1]).toEqual({ status: 'regrowing', progress: 0 });
    expect(result.state.regrowQueue).toEqual([1]);
    expect(result.boosted).toEqual(Array(10).fill(0));
  });

  it('drops any share left over when a snack finishes a leg', () => {
    const legs = withHead(loseLegs(2), 0.9);
    const result = speedUpRegrowth(legs, 1);
    expect(result.state.slots[0]).toEqual({ status: 'present', progress: 1 });
    expect(result.state.slots[1]).toEqual({ status: 'regrowing', progress: 0 });
    expect(result.state.regrowQueue).toEqual([1]);
    expect(result.boosted).toEqual([0]);
  });

  it('gives the same result for several snacks at once as one at a time', () => {
    const legs = withHead(loseLegs(3), 0.5);
    const atOnce = speedUpRegrowth(legs, 17);
    const oneByOne = eatOneByOne(legs, 17);
    expect(atOnce.state).toEqual(oneByOne.state);
    expect(atOnce.boosted).toEqual(oneByOne.boosted);
    expect(atOnce.boosted).toEqual([...Array(5).fill(0), ...Array(10).fill(1), 2, 2]);
  });

  it('does not boost with snacks left over after the last leg regrows', () => {
    const legs = withHead(loseLegs(1), 0.5);
    const result = speedUpRegrowth(legs, 10);
    expect(result.boosted).toEqual([0, 0, 0, 0, 0]);
    expect(result.state.slots).toEqual(createLegs().slots);
    expect(result.state.regrowQueue).toEqual([]);
  });

  it('finishes a leg the same way as regrowth over time', () => {
    for (const progress of [0, 0.3, 0.85]) {
      const legs = { ...withHead(loseLegs(2), progress), protectedLeft: 0 };
      const snacks = Math.ceil((1 - progress) / LEGS.snackSpeedUp - 1e-9);
      const bySnack = speedUpRegrowth(legs, snacks).state;
      const byTime = updateLegs(legs, (1 - progress) * LEGS.regrowTime);
      expect(bySnack.slots, `progress ${progress}`).toEqual(byTime.slots);
      expect(bySnack.regrowQueue, `progress ${progress}`).toEqual(byTime.regrowQueue);
    }
  });

  it('still adds 0.1 of a leg with a shorter regrowTime', () => {
    const lost = hitOnce(createLegs());
    const boosted = speedUpRegrowth(lost, 1, SHORT).state;
    expect(boosted.slots[0].progress).toBeCloseTo(0.1, 9);
    const left = (1 - SHORT.snackSpeedUp) * SHORT.regrowTime;
    expect(left).toBeCloseTo(0.9 * 13, 9);
    expect(presentCount(updateLegs(boosted, left - 0.1, SHORT))).toBe(3);
    expect(presentCount(updateLegs(boosted, left, SHORT))).toBe(4);
  });

  it('does not mutate its input', () => {
    const legs = withHead(loseLegs(2), 0.9);
    const snapshot = structuredClone(legs);
    speedUpRegrowth(legs, 5);
    expect(legs).toEqual(snapshot);
  });

  it('rejects snack counts that are not non-negative integers and out-of-range speed-ups', () => {
    const legs = hitOnce(createLegs());
    for (const snacks of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => speedUpRegrowth(legs, snacks)).toThrow(RangeError);
    }
    for (const snackSpeedUp of [0, -0.2, 1.01, Number.NaN]) {
      expect(() => speedUpRegrowth(legs, 1, { snackSpeedUp })).toThrow(RangeError);
    }
    expect(() => speedUpRegrowth(createLegs(), 0, { snackSpeedUp: 0 })).toThrow(RangeError);
    expect(speedUpRegrowth(legs, 1, { snackSpeedUp: 1 }).state.slots[0]).toEqual({ status: 'present', progress: 1 });
  });
});

describe('legSpeedFactor and legSwimTuning', () => {
  it('maps 4/3/2/1 present legs to 1/0.9/0.75/0.6', () => {
    expect([4, 3, 2, 1].map((present) => legSpeedFactor(present))).toEqual([1, 0.9, 0.75, 0.6]);
  });

  it('clamps out-of-range counts and rejects non-finite ones', () => {
    expect(legSpeedFactor(0)).toBe(0.6);
    expect(legSpeedFactor(9)).toBe(1);
    expect(() => legSpeedFactor(Number.NaN)).toThrow(RangeError);
  });

  it('scales only maxSpeed; Tail Dash values are unchanged', () => {
    for (const present of LEG_COUNTS) {
      const tuning = legSwimTuning(present);
      expect(tuning).toEqual({ ...SWIM, maxSpeed: SWIM.maxSpeed * legSpeedFactor(present) });
      expect(tuning.dashSpeed).toBe(SWIM.dashSpeed);
      expect(tuning.dashDuration).toBe(SWIM.dashDuration);
      expect(tuning.dashCooldown).toBe(SWIM.dashCooldown);
      expect(tuning.accel).toBe(SWIM.accel);
    }
  });

  it('beats every canal current with 1 to 4 legs', () => {
    const zone = buildCanalZone();
    expect(zone.currents.length).toBeGreaterThan(0);
    for (const present of LEG_COUNTS) {
      const tuning = legSwimTuning(present);
      for (const current of zone.currents) {
        const centre = centreOf(current);
        const flow = currentAt(centre, zone.currents);
        expect(tuning.maxSpeed).toBeGreaterThan(Math.hypot(flow.x, flow.y));

        const upstream = normalize({ x: -flow.x, y: -flow.y });
        let state: SwimState = { x: centre.x, y: centre.y, vx: 0, vy: 0, facing: 1 };
        for (let i = 0; i < 120; i++) state = swimStep(state, upstream, zone, tuning);
        const gained = (state.x - centre.x) * upstream.x + (state.y - centre.y) * upstream.y;
        expect(gained, `${current.id} with ${present} legs`).toBeGreaterThan(0);
      }
    }
  });

  it('gets home from the far east bound with one leg in bounded time', () => {
    const zone = buildCanalZone();
    const bounds = swimBounds();
    const tuning = legSwimTuning(1);
    const maxFrames = Math.round(90 / FRAME);
    for (const y of [bounds.minY, zone.start.y, bounds.maxY]) {
      let state: SwimState = { x: bounds.maxX, y, vx: 0, vy: 0, facing: -1 };
      let frames = 0;
      while (Math.hypot(zone.start.x - state.x, zone.start.y - state.y) > 8 && frames < maxFrames) {
        const steer = normalize({ x: zone.start.x - state.x, y: zone.start.y - state.y });
        state = swimStep(state, steer, zone, tuning);
        frames++;
      }
      expect(frames, `from y=${y}`).toBeLessThan(maxFrames);
    }
  });
});

describe('legWobble', () => {
  const samples = Array.from({ length: 200 }, (_, i) => (i * LEGS.wobblePeriod) / 200);

  function peakWobble(present: number, reduced: boolean): number {
    return Math.max(...samples.map((t) => Math.abs(legWobble(present, t, reduced))));
  }

  it('is 0 with every leg present', () => {
    expect(peakWobble(4, false)).toBe(0);
  });

  it('rises as legs drop, by wobbleAmp radians per missing leg', () => {
    const peaks = [3, 2, 1].map((present) => peakWobble(present, false));
    expect(peaks[0]).toBeGreaterThan(0);
    expect(peaks[1]).toBeGreaterThan(peaks[0]);
    expect(peaks[2]).toBeGreaterThan(peaks[1]);
    expect(peaks[2]).toBeCloseTo(3 * LEGS.wobbleAmp, 3);
  });

  it('is 0 under reduced motion', () => {
    for (const present of [0, ...LEG_COUNTS]) {
      expect(peakWobble(present, true)).toBe(0);
    }
  });
});

describe('quantizeProgress', () => {
  it('rounds down to fixed steps within 0..1', () => {
    expect(quantizeProgress(0, 4)).toBe(0);
    expect(quantizeProgress(0.3, 4)).toBe(0.25);
    expect(quantizeProgress(0.99, 4)).toBe(0.75);
    expect(quantizeProgress(1, 4)).toBe(1);
    expect(quantizeProgress(1.5, 4)).toBe(1);
    expect(quantizeProgress(-0.2, 4)).toBe(0);
    expect(quantizeProgress(Number.NaN, 4)).toBe(0);
  });

  it('rejects steps that are not positive integers', () => {
    expect(() => quantizeProgress(0.5, 0)).toThrow(RangeError);
    expect(() => quantizeProgress(0.5, 2.5)).toThrow(RangeError);
  });
});
