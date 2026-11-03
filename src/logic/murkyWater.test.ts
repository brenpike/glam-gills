import { describe, expect, it } from 'vitest';
import { MURKY_WATER_FACT, metThreatIds } from './factCards';
import { GHOST_NET } from './ghostNets';
import { hazardMet, legHazardAt, shapeDistance, type HazardSpawn } from './hazards';
import { zoneThreats } from './hiding';
import { obstaclesOf } from './layoutGaps';
import { legSpeedFactor } from './legs';
import {
  MURKY_WATER,
  MURKY_WATER_TIMING,
  createMurkyTimer,
  hasMurkyPatch,
  insideMurky,
  isMurkyPatch,
  murkyCrossSeconds,
  murkyPatchAt,
  murkyPatchSpawn,
  murkyPatches,
  stepMurkyTimer,
  type MurkyTimer,
} from './murkyWater';
import { pulsingCurrentSpawn } from './pulsingCurrents';
import { SWIM } from './tuning';

const PATCH = murkyPatchSpawn('test/murky-1', { x0: 1000, x1: 1200, y0: 400, y1: 640 });
const WIDE = murkyPatchSpawn('test/murky-2', { x0: 2000, x1: 2400, y0: 100, y1: 300 });
const NET: HazardSpawn = { id: 'test/net', type: GHOST_NET, shape: { kind: 'rect', x0: 300, x1: 340, y0: 200, y1: 260 } };
const VENT = pulsingCurrentSpawn('test/vent', { x0: 600, x1: 700, y0: 400, y1: 640 }, { calmFor: 2.5, flow: 'left', offset: 0 });
const SAFE_AREA = { x0: 0, x1: 200, y0: 0, y1: 720 };

/** Steps the timer `count` times by `dt`, each with the same `inside` and no protection, and returns the last step. */
function swimSteps(timer: MurkyTimer, inside: boolean, dt: number, count: number) {
  let step = stepMurkyTimer(timer, inside, dt, false);
  for (let index = 1; index < count; index++) step = stepMurkyTimer(step.timer, inside, dt, false);
  return step;
}

describe('MURKY_WATER_TIMING', () => {
  it('warns at 2 s, asks for a hit at 3 s and clears after 1 s in clean water (ND-1)', () => {
    expect(MURKY_WATER_TIMING).toEqual({ warnAt: 2, legAt: 3, clearAfter: 1 });
    expect(Object.isFrozen(MURKY_WATER_TIMING)).toBe(true);
  });
});

describe('MURKY_WATER', () => {
  it('never costs a leg on touch and touches nothing, with the "Dirty water" card met at range 0', () => {
    expect(MURKY_WATER.id).toBe('murky-water');
    expect(MURKY_WATER.costsLeg).toBe(false);
    expect(MURKY_WATER.reach).toBe(0);
    expect(MURKY_WATER.meetRange).toBe(0);
    expect(MURKY_WATER.fact).toBe(MURKY_WATER_FACT);
    expect(Object.isFrozen(MURKY_WATER)).toBe(true);
  });

  it('is never a touch hit, even with the centre in the patch', () => {
    expect(legHazardAt([PATCH], { x: 1100, y: 500 })).toBeUndefined();
  });

  it('is met when the centre is in the patch, edges included, and not 1 px outside', () => {
    expect(hazardMet(PATCH, { x: 1100, y: 500 })).toBe(true);
    expect(hazardMet(PATCH, { x: 1000, y: 400 })).toBe(true);
    expect(hazardMet(PATCH, { x: 999, y: 500 })).toBe(false);
    expect(hazardMet(PATCH, { x: 1100, y: 641 })).toBe(false);
  });

  it('is met only outside the Home Spot, through metThreatIds', () => {
    const inPatch = { x: 1100, y: 500 };
    const sighting = { id: PATCH.id, distance: shapeDistance(inPatch, PATCH.shape), meetRange: MURKY_WATER.meetRange };
    expect(metThreatIds(inPatch, SAFE_AREA, [sighting])).toEqual([PATCH.id]);
    expect(metThreatIds(inPatch, { ...SAFE_AREA, x1: 1300 }, [sighting])).toEqual([]);
  });

  it('is never a risk threat for hiding spots', () => {
    expect(zoneThreats({ tilapiaRoutes: [], hazards: [PATCH, WIDE] })).toEqual([]);
  });

  it('is never a gap obstacle, like a pulsing current, while a ghost net still is', () => {
    const obstacles = obstaclesOf({ tilapiaRoutes: [], predatorRoutes: [], hazards: [PATCH, NET, VENT, WIDE], movingHazards: [] });
    expect(obstacles.map((obstacle) => obstacle.id)).toEqual([NET.id]);
  });
});

describe('murkyPatchSpawn', () => {
  it('builds a murky water rect from the given edges', () => {
    expect(PATCH).toEqual({ id: 'test/murky-1', type: MURKY_WATER, shape: { kind: 'rect', x0: 1000, x1: 1200, y0: 400, y1: 640 } });
  });

  it.each([
    ['empty along x', { x0: 100, x1: 100, y0: 0, y1: 10 }],
    ['reversed along x', { x0: 200, x1: 100, y0: 0, y1: 10 }],
    ['empty along y', { x0: 0, x1: 10, y0: 50, y1: 50 }],
    ['reversed along y', { x0: 0, x1: 10, y0: 60, y1: 50 }],
    ['NaN', { x0: Number.NaN, x1: 10, y0: 0, y1: 10 }],
    ['infinite', { x0: 0, x1: Number.POSITIVE_INFINITY, y0: 0, y1: 10 }],
  ])('throws on a rect that is %s', (_label, rect) => {
    expect(() => murkyPatchSpawn('test/bad', rect)).toThrow(RangeError);
  });
});

describe('isMurkyPatch and murkyPatches', () => {
  it('picks the murky patches out of the hazards, in hazard order', () => {
    expect(isMurkyPatch(PATCH)).toBe(true);
    expect(isMurkyPatch(NET)).toBe(false);
    expect(isMurkyPatch(VENT)).toBe(false);
    expect(murkyPatches([NET, WIDE, VENT, PATCH])).toEqual([WIDE, PATCH]);
    expect(murkyPatches([NET, VENT])).toEqual([]);
  });
});

describe('insideMurky', () => {
  it('is true when the centre is in some patch, edges included', () => {
    const patches = [PATCH, WIDE];
    expect(insideMurky({ x: 1100, y: 500 }, patches)).toBe(true);
    expect(insideMurky({ x: 2400, y: 300 }, patches)).toBe(true);
    expect(insideMurky({ x: 1200, y: 640 }, patches)).toBe(true);
  });

  it('is false outside every patch and with no patches', () => {
    expect(insideMurky({ x: 1201, y: 500 }, [PATCH, WIDE])).toBe(false);
    expect(insideMurky({ x: 1100, y: 399 }, [PATCH, WIDE])).toBe(false);
    expect(insideMurky({ x: 1100, y: 500 }, [])).toBe(false);
  });
});

describe('hasMurkyPatch and murkyPatchAt', () => {
  it('says whether any hazard is a murky patch', () => {
    expect(hasMurkyPatch([NET, WIDE, VENT])).toBe(true);
    expect(hasMurkyPatch([NET, VENT])).toBe(false);
    expect(hasMurkyPatch([])).toBe(false);
  });

  it('finds the patch that holds the centre, edges included, among the hazards', () => {
    const hazards = [NET, WIDE, VENT, PATCH];
    expect(murkyPatchAt({ x: 1100, y: 500 }, hazards)).toBe(PATCH);
    expect(murkyPatchAt({ x: 2400, y: 300 }, hazards)).toBe(WIDE);
    expect(murkyPatchAt({ x: 1200, y: 640 }, hazards)).toBe(PATCH);
  });

  it('is undefined outside every patch, and inside a hazard that is not a patch', () => {
    const hazards = [NET, WIDE, VENT, PATCH];
    expect(murkyPatchAt({ x: 1201, y: 500 }, hazards)).toBeUndefined();
    expect(murkyPatchAt({ x: 650, y: 500 }, hazards)).toBeUndefined();
    expect(murkyPatchAt({ x: 1100, y: 500 }, [NET, VENT])).toBeUndefined();
  });
});

describe('murkyCrossSeconds', () => {
  it('is the width over the one-leg top speed', () => {
    const oneLegSpeed = SWIM.maxSpeed * legSpeedFactor(1);
    expect(murkyCrossSeconds(200)).toBeCloseTo(200 / oneLegSpeed, 9);
    expect(murkyCrossSeconds(0)).toBe(0);
  });

  it('crosses a 200 px route patch before the 3 s hit', () => {
    expect(murkyCrossSeconds(200)).toBeLessThan(MURKY_WATER_TIMING.legAt);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('throws on width %s', (width) => {
    expect(() => murkyCrossSeconds(width)).toThrow(RangeError);
  });
});

describe('stepMurkyTimer', () => {
  it('starts with nothing built, no clean time, no warning and an empty meter', () => {
    expect(createMurkyTimer()).toEqual({ built: 0, clean: 0 });
    const step = stepMurkyTimer(createMurkyTimer(), false, 0, false);
    expect(step).toEqual({ timer: { built: 0, clean: 0 }, warning: false, legDue: false, meter: 0 });
  });

  it('builds time inside a patch and shows it on the meter as time over 3 s', () => {
    const step = swimSteps(createMurkyTimer(), true, 0.5, 3);
    expect(step.timer).toEqual({ built: 1.5, clean: 0 });
    expect(step.warning).toBe(false);
    expect(step.legDue).toBe(false);
    expect(step.meter).toBeCloseTo(0.5, 9);
  });

  it('shows the warning from 2 s, not before', () => {
    expect(swimSteps(createMurkyTimer(), true, 0.25, 7).warning).toBe(false);
    const atWarn = swimSteps(createMurkyTimer(), true, 0.25, 8);
    expect(atWarn.timer.built).toBe(2);
    expect(atWarn.warning).toBe(true);
    expect(atWarn.legDue).toBe(false);
  });

  it('asks for one hit at 3 s and restarts the timer at 0', () => {
    const before = swimSteps(createMurkyTimer(), true, 0.5, 5);
    expect(before.legDue).toBe(false);
    expect(before.meter).toBeCloseTo(2.5 / 3, 9);
    const hit = stepMurkyTimer(before.timer, true, 0.5, false);
    expect(hit).toEqual({ timer: { built: 0, clean: 0 }, warning: false, legDue: true, meter: 0 });
    const after = stepMurkyTimer(hit.timer, true, 0.5, false);
    expect(after.legDue).toBe(false);
    expect(after.timer.built).toBe(0.5);
  });

  it('asks for the hit once on a long step that passes 3 s', () => {
    const step = stepMurkyTimer({ built: 2.9, clean: 0 }, true, 1, false);
    expect(step.legDue).toBe(true);
    expect(step.timer.built).toBe(0);
  });

  it('holds the timer on a protected step, inside or out, and asks for no hit', () => {
    const timer: MurkyTimer = { built: 2.9, clean: 0 };
    const inside = stepMurkyTimer(timer, true, 1, true);
    expect(inside).toEqual({ timer: { built: 2.9, clean: 0 }, warning: true, legDue: false, meter: 2.9 / 3 });
    const outside = stepMurkyTimer({ built: 1.5, clean: 0.5 }, false, 1, true);
    expect(outside.timer).toEqual({ built: 1.5, clean: 0.5 });
  });

  it('holds the built time with no drain while out for less than 1 s', () => {
    const step = swimSteps({ built: 2.5, clean: 0 }, false, 0.25, 3);
    expect(step.timer).toEqual({ built: 2.5, clean: 0.75 });
    expect(step.warning).toBe(true);
    expect(step.legDue).toBe(false);
    expect(step.meter).toBeCloseTo(2.5 / 3, 9);
  });

  it('resets the built time to 0 after 1 s in clean water', () => {
    const step = swimSteps({ built: 2.5, clean: 0 }, false, 0.25, 4);
    expect(step.timer).toEqual({ built: 0, clean: 1 });
    expect(step.warning).toBe(false);
    expect(step.meter).toBe(0);
  });

  it('starts the clean time over when the axolotl swims back in before 1 s', () => {
    const out = swimSteps({ built: 1, clean: 0 }, false, 0.5, 1);
    const back = stepMurkyTimer(out.timer, true, 0.5, false);
    expect(back.timer).toEqual({ built: 1.5, clean: 0 });
    const outAgain = swimSteps(back.timer, false, 0.5, 1);
    expect(outAgain.timer).toEqual({ built: 1.5, clean: 0.5 });
  });

  it('takes its tuning as an argument', () => {
    const step = stepMurkyTimer({ built: 0.75, clean: 0 }, true, 0.25, false, { warnAt: 0.5, legAt: 1, clearAfter: 0.25 });
    expect(step.legDue).toBe(true);
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])('throws on dt %s', (dt) => {
    expect(() => stepMurkyTimer(createMurkyTimer(), true, dt, false)).toThrow(RangeError);
  });
});
