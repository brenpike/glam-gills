import { describe, expect, it } from 'vitest';
import { GEYSER_FACT, PUNTING_POLE_FACT, STALACTITE_FACT } from './factCards';
import {
  GEYSER_VENT,
  PUNTING_POLE,
  STALACTITE_DRIP,
  movingHazardBaseY,
  movingHazardDepth,
  movingHazardDirection,
  movingHazardFrom,
  movingHazardPeriod,
  movingHazardPhase,
  movingHazardShape,
  movingHazardSpawn,
  movingHazardSweep,
  movingHazardTip,
  movingHazardTipDepth,
  movingHazardTouches,
  type MovingHazardType,
} from './movingHazards';
import { PUNTING_POLES, SWIM, TILAPIA } from './tuning';
import { SURF } from './zone';

const POLE_X = 1000;
const POLE = movingHazardSpawn('test/punting-pole-1', PUNTING_POLE, POLE_X, 0);
const LATE_POLE = movingHazardSpawn('test/punting-pole-2', PUNTING_POLE, 1200, 2);
const SHALLOW_POLE = movingHazardSpawn('test/punting-pole-3', PUNTING_POLE, POLE_X, 0, 100);

/** Mid-phase times for POLE (offset 0): rest 0..1.6, warn 1.6..2.6, jab 2.6..2.9, hold 2.9..3.4, lift 3.4..4. */
const MID_REST = 0.8;
const MID_WARN = 2.1;
const MID_JAB = 2.75;
const MID_HOLD = 3.15;
const MID_LIFT = 3.7;
const HOLD_START = 2.9;

const REACH = PUNTING_POLES.touchReach;
const EDGE_X = POLE_X + PUNTING_POLES.halfWidth;
const FULL_TIP_Y = SURF + PUNTING_POLES.depth;

/** PUNTING_POLE with `changes` applied, for refused types. */
function poleWith(changes: Partial<MovingHazardType>): MovingHazardType {
  return { ...PUNTING_POLE, ...changes };
}

describe('PUNTING_POLE', () => {
  it('has its ids, fact card and danger-part mark', () => {
    expect(PUNTING_POLE.id).toBe('punting-pole');
    expect(PUNTING_POLE.name).toBe('Punting pole');
    expect(PUNTING_POLE.look).toBe('punting-pole');
    expect(PUNTING_POLE.fact).toBe(PUNTING_POLE_FACT);
    expect(PUNTING_POLE.dangerPart).toBe(true);
    expect(Object.isFrozen(PUNTING_POLE)).toBe(true);
  });

  it('takes its timing and sizes from PUNTING_POLES, on a 4 s cycle', () => {
    expect(PUNTING_POLE).toMatchObject(PUNTING_POLES);
    expect(movingHazardPeriod(PUNTING_POLE)).toBeCloseTo(4, 9);
  });
});

describe('movingHazardPhase', () => {
  it('runs rest, warn, jab, hold, lift over the cycle from offset 0', () => {
    expect(movingHazardPhase(POLE, 0)).toEqual({ phase: 'rest', progress: 0 });
    const mids = [MID_REST, MID_WARN, MID_JAB, MID_HOLD, MID_LIFT].map((t) => movingHazardPhase(POLE, t));
    expect(mids.map((mid) => mid.phase)).toEqual(['rest', 'warn', 'jab', 'hold', 'lift']);
    for (const mid of mids) expect(mid.progress).toBeCloseTo(0.5, 9);
  });

  it('switches phase at each boundary', () => {
    expect(movingHazardPhase(POLE, 1.59).phase).toBe('rest');
    expect(movingHazardPhase(POLE, 1.6).phase).toBe('warn');
    expect(movingHazardPhase(POLE, 2.59).phase).toBe('warn');
    expect(movingHazardPhase(POLE, 2.61).phase).toBe('jab');
    expect(movingHazardPhase(POLE, 2.91).phase).toBe('hold');
    expect(movingHazardPhase(POLE, 3.41).phase).toBe('lift');
    expect(movingHazardPhase(POLE, 3.99).phase).toBe('lift');
  });

  it('repeats every period, for later and negative times', () => {
    expect(movingHazardPhase(POLE, MID_HOLD + 4 * 25).phase).toBe('hold');
    const before = movingHazardPhase(POLE, MID_REST - 4);
    expect(before.phase).toBe('rest');
    expect(before.progress).toBeCloseTo(0.5, 9);
  });

  it('starts the cycle at the spawn offset', () => {
    expect(movingHazardPhase(LATE_POLE, 2)).toEqual({ phase: 'rest', progress: 0 });
    expect(movingHazardPhase(LATE_POLE, 2 + MID_JAB).phase).toBe('jab');
    const wrapped = movingHazardPhase(LATE_POLE, 0.5);
    expect(wrapped.phase).toBe('warn');
    expect(wrapped.progress).toBeCloseTo(0.9, 9);
  });
});

describe('movingHazardTipDepth', () => {
  it('is 0 at rest and during the warning', () => {
    expect(movingHazardTipDepth(POLE, MID_REST)).toBe(0);
    expect(movingHazardTipDepth(POLE, MID_WARN)).toBe(0);
  });

  it('goes down steadily over the jab, holds at the depth, and lifts steadily', () => {
    expect(movingHazardTipDepth(POLE, MID_JAB)).toBeCloseTo(90, 6);
    expect(movingHazardTipDepth(POLE, HOLD_START + 0.01)).toBe(PUNTING_POLES.depth);
    expect(movingHazardTipDepth(POLE, MID_HOLD)).toBe(PUNTING_POLES.depth);
    expect(movingHazardTipDepth(POLE, MID_LIFT)).toBeCloseTo(90, 6);
    expect(movingHazardTipDepth(POLE, 3.97)).toBeCloseTo(9, 6);
  });

  it('follows the spawn offset', () => {
    expect(movingHazardTipDepth(LATE_POLE, MID_HOLD)).toBe(0);
    expect(movingHazardTipDepth(LATE_POLE, 2 + MID_HOLD)).toBe(PUNTING_POLES.depth);
  });
});

describe('movingHazardShape', () => {
  it('is null at rest and during the warning', () => {
    expect(movingHazardShape(POLE, MID_REST)).toBeNull();
    expect(movingHazardShape(POLE, MID_WARN)).toBeNull();
  });

  it('is the shaft from the surface to the tip', () => {
    const jab = movingHazardShape(POLE, MID_JAB);
    expect(jab).not.toBeNull();
    expect(jab?.x0).toBe(995);
    expect(jab?.x1).toBe(1005);
    expect(jab?.y0).toBe(SURF);
    expect(jab?.y1).toBeCloseTo(SURF + 90, 6);
    expect(movingHazardShape(POLE, MID_HOLD)).toEqual({ kind: 'rect', x0: 995, x1: 1005, y0: SURF, y1: FULL_TIP_Y });
  });
});

describe('movingHazardSweep', () => {
  it('is the jab rect at full depth', () => {
    expect(movingHazardSweep(POLE)).toEqual({ kind: 'rect', x0: 995, x1: 1005, y0: SURF, y1: FULL_TIP_Y });
    expect(movingHazardSweep(POLE)).toEqual(movingHazardShape(POLE, MID_HOLD));
  });
});

describe('movingHazardTouches', () => {
  it('never touches at rest or during the warning, even on the shaft line', () => {
    expect(movingHazardTouches(POLE, MID_REST, { x: POLE_X, y: SURF + 20 })).toBe(false);
    expect(movingHazardTouches(POLE, MID_WARN, { x: POLE_X, y: SURF + 20 })).toBe(false);
  });

  it('touches within the touch reach beside the shaft, edge inclusive', () => {
    expect(movingHazardTouches(POLE, MID_HOLD, { x: EDGE_X + REACH, y: 200 })).toBe(true);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: EDGE_X + REACH + 0.01, y: 200 })).toBe(false);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: 995 - REACH, y: 200 })).toBe(true);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: 995 - REACH - 0.01, y: 200 })).toBe(false);
  });

  it('touches within the touch reach below the tip, edge inclusive', () => {
    expect(movingHazardTouches(POLE, MID_HOLD, { x: POLE_X, y: FULL_TIP_Y + REACH })).toBe(true);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: POLE_X, y: FULL_TIP_Y + REACH + 0.01 })).toBe(false);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: EDGE_X + 10, y: FULL_TIP_Y + 15.2 })).toBe(false);
    expect(movingHazardTouches(POLE, MID_HOLD, { x: EDGE_X + 10, y: FULL_TIP_Y + 14.9 })).toBe(true);
  });

  it('follows the tip during the jab', () => {
    const tipY = SURF + movingHazardTipDepth(POLE, MID_JAB);
    expect(movingHazardTouches(POLE, MID_JAB, { x: POLE_X, y: tipY + REACH - 0.01 })).toBe(true);
    expect(movingHazardTouches(POLE, MID_JAB, { x: POLE_X, y: tipY + REACH + 0.01 })).toBe(false);
  });
});

describe('a depth set on one spawn', () => {
  it('changes only that spawn', () => {
    expect(movingHazardDepth(SHALLOW_POLE)).toBe(100);
    expect(movingHazardDepth(POLE)).toBe(PUNTING_POLES.depth);
    expect(POLE).not.toHaveProperty('depth');
    expect(PUNTING_POLE.depth).toBe(PUNTING_POLES.depth);
    expect(movingHazardTipDepth(SHALLOW_POLE, MID_HOLD)).toBe(100);
    expect(movingHazardTipDepth(SHALLOW_POLE, MID_JAB)).toBeCloseTo(50, 6);
    expect(movingHazardSweep(SHALLOW_POLE).y1).toBe(SURF + 100);
  });

  it('moves its touch reach up with its tip', () => {
    const below = { x: POLE_X, y: SURF + 100 + REACH + 1 };
    expect(movingHazardTouches(SHALLOW_POLE, MID_HOLD, below)).toBe(false);
    expect(movingHazardTouches(POLE, MID_HOLD, below)).toBe(true);
  });
});

describe('movingHazardSpawn', () => {
  it('builds a spawn with its id, type, x and offset', () => {
    expect(LATE_POLE).toEqual({ id: 'test/punting-pole-2', type: PUNTING_POLE, x: 1200, offset: 2 });
  });

  it('refuses a warning under the 0.8 s floor', () => {
    expect(TILAPIA.minWindup).toBe(0.8);
    expect(() => movingHazardSpawn('w', poleWith({ warnFor: 0.79 }), 0, 0)).toThrow(RangeError);
    expect(() => movingHazardSpawn('w', poleWith({ warnFor: 0.79 }), 0, 0)).toThrow(/warnFor/);
    expect(() => movingHazardSpawn('w', poleWith({ warnFor: 0.8 }), 0, 0)).not.toThrow();
  });

  it('refuses a negative or missing phase time', () => {
    for (const key of ['restFor', 'jabFor', 'holdFor', 'liftFor'] as const) {
      expect(() => movingHazardSpawn('t', poleWith({ [key]: -0.1 }), 0, 0)).toThrow(RangeError);
      expect(() => movingHazardSpawn('t', poleWith({ [key]: Number.NaN }), 0, 0)).toThrow(RangeError);
    }
    expect(() => movingHazardSpawn('t', poleWith({ warnFor: -1 }), 0, 0)).toThrow(RangeError);
  });

  it('refuses a period of 0', () => {
    const still = poleWith({ restFor: 0, warnFor: 0, jabFor: 0, holdFor: 0, liftFor: 0 });
    expect(() => movingHazardSpawn('p', still, 0, 0)).toThrow(/period/);
  });

  it('refuses a depth not above 0, from the type or the spawn', () => {
    expect(() => movingHazardSpawn('d', poleWith({ depth: 0 }), 0, 0)).toThrow(RangeError);
    expect(() => movingHazardSpawn('d', PUNTING_POLE, 0, 0, 0)).toThrow(RangeError);
    expect(() => movingHazardSpawn('d', PUNTING_POLE, 0, 0, -20)).toThrow(RangeError);
    expect(() => movingHazardSpawn('d', PUNTING_POLE, 0, 0, Number.NaN)).toThrow(RangeError);
    expect(() => movingHazardSpawn('d', poleWith({ depth: 0 }), 0, 0, 60)).not.toThrow();
  });

  it('allows zero-length jab, hold and lift', () => {
    const snap = movingHazardSpawn('z', poleWith({ jabFor: 0, liftFor: 0 }), POLE_X, 0);
    expect(movingHazardPhase(snap, 2.7).phase).toBe('hold');
    expect(movingHazardTipDepth(snap, 2.7)).toBe(PUNTING_POLES.depth);
    expect(movingHazardPhase(snap, 3.2).phase).toBe('rest');
  });
});

describe('a step at SWIM.dtMax', () => {
  const stepTravel = SWIM.dashSpeed * SWIM.dtMax;

  it('moves less than the width of the touch band, even at top Tail Dash speed', () => {
    const band = 2 * (PUNTING_POLES.halfWidth + PUNTING_POLES.touchReach);
    expect(band).toBeGreaterThan(stepTravel);
  });

  it('never skips past the pole during the hold', () => {
    const steps = Math.floor(PUNTING_POLES.holdFor / SWIM.dtMax) - 1;
    for (const direction of [1, -1]) {
      for (let shift = 0; shift < stepTravel; shift += 0.25) {
        const startX = POLE_X - direction * (PUNTING_POLES.halfWidth + REACH + shift + 1);
        let touched = false;
        for (let step = 0; step <= steps; step += 1) {
          const t = HOLD_START + 0.001 + step * SWIM.dtMax;
          const pos = { x: startX + direction * stepTravel * step, y: SURF + 120 };
          touched ||= movingHazardTouches(POLE, t, pos);
        }
        expect(touched).toBe(true);
      }
    }
  });
});

describe('STALACTITE_DRIP and GEYSER_VENT (issue #77, ND-3, option B)', () => {
  it('have their ids, looks, fact cards, bases and danger-part marks', () => {
    expect([STALACTITE_DRIP.id, STALACTITE_DRIP.name, STALACTITE_DRIP.look]).toEqual(['stalactite-drip', 'Stalactite drip', 'stalactite-drip']);
    expect([GEYSER_VENT.id, GEYSER_VENT.name, GEYSER_VENT.look]).toEqual(['geyser-vent', 'Geyser vent', 'geyser-vent']);
    expect(STALACTITE_DRIP.fact).toBe(STALACTITE_FACT);
    expect(GEYSER_VENT.fact).toBe(GEYSER_FACT);
    expect([movingHazardFrom(PUNTING_POLE), movingHazardFrom(STALACTITE_DRIP), movingHazardFrom(GEYSER_VENT)]).toEqual(['surface', 'roof', 'floor']);
    expect(PUNTING_POLE).not.toHaveProperty('from');
    for (const type of [STALACTITE_DRIP, GEYSER_VENT]) {
      expect(type.dangerPart, type.id).toBe(true);
      expect(Object.isFrozen(type), type.id).toBe(true);
    }
  });

  it('warn at least as long as the pole, over the 0.8 s floor, on cycles of 4 s and 5.2 s', () => {
    expect(STALACTITE_DRIP.warnFor).toBe(PUNTING_POLES.warnFor);
    expect(GEYSER_VENT.warnFor).toBeGreaterThan(PUNTING_POLES.warnFor);
    expect(movingHazardPeriod(STALACTITE_DRIP)).toBeCloseTo(4, 9);
    expect(movingHazardPeriod(GEYSER_VENT)).toBeCloseTo(5.2, 9);
  });

  it('have their phase times: the drip out 2.0 s of its 4 s, the geyser out 2.6 s of its 5.2 s', () => {
    expect(STALACTITE_DRIP).toMatchObject({ restFor: 1.0, warnFor: 1.0, jabFor: 0.4, holdFor: 1.2, liftFor: 0.4 });
    expect(GEYSER_VENT).toMatchObject({ restFor: 1.4, warnFor: 1.2, jabFor: 0.4, holdFor: 1.6, liftFor: 0.6 });
    expect(STALACTITE_DRIP.jabFor + STALACTITE_DRIP.holdFor + STALACTITE_DRIP.liftFor).toBeCloseTo(2.0, 9);
    expect(GEYSER_VENT.jabFor + GEYSER_VENT.holdFor + GEYSER_VENT.liftFor).toBeCloseTo(2.6, 9);
  });

  it('touch with the pole\'s reach: the stream wider than the pole, the column wider still, each with its default depth', () => {
    expect([STALACTITE_DRIP.halfWidth, STALACTITE_DRIP.touchReach, STALACTITE_DRIP.depth]).toEqual([8, PUNTING_POLES.touchReach, 216]);
    expect([GEYSER_VENT.halfWidth, GEYSER_VENT.touchReach, GEYSER_VENT.depth]).toEqual([12, PUNTING_POLES.touchReach, 240]);
    expect(STALACTITE_DRIP.halfWidth).toBeGreaterThan(PUNTING_POLES.halfWidth);
    expect([STALACTITE_DRIP.meetRange, GEYSER_VENT.meetRange]).toEqual([180, 180]);
  });
});

describe('a roof hazard: the stalactite drip (issue #77, ND-3)', () => {
  const ROOF_Y = 300;
  const DRIP = movingHazardSpawn('test/drip-1', STALACTITE_DRIP, POLE_X, 0, 120, ROOF_Y);
  /** Mid-phase times from offset 0: rest 0..1.0, warn 1.0..2.0, fall 2.0..2.4, hold 2.4..3.6, stop 3.6..4. */
  const MID_DRIP_REST = 0.5;
  const MID_DRIP_WARN = 1.5;
  const MID_FALL = 2.2;
  const MID_DRIP_HOLD = 3.0;

  it('starts at its roof line and goes down', () => {
    expect(movingHazardBaseY(DRIP)).toBe(ROOF_Y);
    expect(movingHazardDirection(DRIP)).toBe(1);
    expect(DRIP).toEqual({ id: 'test/drip-1', type: STALACTITE_DRIP, x: POLE_X, offset: 0, depth: 120, baseY: ROOF_Y });
  });

  it('streams from the roof line down to its depth, and its sweep is that stream at full depth', () => {
    expect(movingHazardShape(DRIP, MID_DRIP_REST)).toBeNull();
    expect(movingHazardShape(DRIP, MID_DRIP_WARN)).toBeNull();
    expect(movingHazardShape(DRIP, MID_FALL)?.y1).toBeCloseTo(ROOF_Y + 60, 6);
    expect(movingHazardShape(DRIP, MID_DRIP_HOLD)).toEqual({ kind: 'rect', x0: 992, x1: 1008, y0: ROOF_Y, y1: ROOF_Y + 120 });
    expect(movingHazardSweep(DRIP)).toEqual({ kind: 'rect', x0: 992, x1: 1008, y0: ROOF_Y, y1: ROOF_Y + 120 });
  });

  it('has its tip below the roof line, at the roof line when not falling', () => {
    expect(movingHazardTip(DRIP, MID_DRIP_REST)).toEqual({ x: POLE_X, y: ROOF_Y });
    expect(movingHazardTip(DRIP, MID_DRIP_HOLD)).toEqual({ x: POLE_X, y: ROOF_Y + 120 });
  });

  it('touches the whole stream within its reach, and nothing above the roof line past its reach', () => {
    expect(movingHazardTouches(DRIP, MID_DRIP_HOLD, { x: POLE_X, y: ROOF_Y + 60 })).toBe(true);
    expect(movingHazardTouches(DRIP, MID_DRIP_HOLD, { x: POLE_X, y: ROOF_Y + 120 + REACH })).toBe(true);
    expect(movingHazardTouches(DRIP, MID_DRIP_HOLD, { x: POLE_X, y: ROOF_Y + 120 + REACH + 0.01 })).toBe(false);
    expect(movingHazardTouches(DRIP, MID_DRIP_HOLD, { x: POLE_X, y: ROOF_Y - REACH - 0.01 })).toBe(false);
    expect(movingHazardTouches(DRIP, MID_DRIP_WARN, { x: POLE_X, y: ROOF_Y + 60 })).toBe(false);
  });
});

describe('a floor hazard: the geyser vent (issue #77, ND-3)', () => {
  const FLOOR_Y = 1000;
  const VENT = movingHazardSpawn('test/vent-1', GEYSER_VENT, POLE_X, 0, undefined, FLOOR_Y);
  /** Mid-phase times from offset 0: rest 0..1.4, warn 1.4..2.6, burst 2.6..3.0, hold 3.0..4.6, fall 4.6..5.2. */
  const MID_VENT_REST = 0.7;
  const MID_VENT_WARN = 2.0;
  const MID_BURST = 2.8;
  const MID_VENT_HOLD = 3.8;
  const MID_FALL_BACK = 4.9;
  const TOP_Y = FLOOR_Y - GEYSER_VENT.depth;

  it('starts at the floor and goes up', () => {
    expect(movingHazardBaseY(VENT)).toBe(FLOOR_Y);
    expect(movingHazardDirection(VENT)).toBe(-1);
    expect(movingHazardPhase(VENT, MID_BURST).phase).toBe('jab');
  });

  it('bursts up from the floor to its height, holds, and falls back, as a column from the floor', () => {
    expect(movingHazardShape(VENT, MID_VENT_REST)).toBeNull();
    expect(movingHazardShape(VENT, MID_VENT_WARN)).toBeNull();
    const burst = movingHazardShape(VENT, MID_BURST);
    expect(burst?.y0).toBeCloseTo(FLOOR_Y - 120, 6);
    expect(burst?.y1).toBe(FLOOR_Y);
    expect(movingHazardShape(VENT, MID_VENT_HOLD)).toEqual({ kind: 'rect', x0: 988, x1: 1012, y0: TOP_Y, y1: FLOOR_Y });
    expect(movingHazardShape(VENT, MID_FALL_BACK)?.y0).toBeCloseTo(FLOOR_Y - 120, 6);
    expect(movingHazardSweep(VENT)).toEqual({ kind: 'rect', x0: 988, x1: 1012, y0: TOP_Y, y1: FLOOR_Y });
  });

  it('has its tip at the top of the column, above the floor', () => {
    expect(movingHazardTip(VENT, MID_VENT_REST)).toEqual({ x: POLE_X, y: FLOOR_Y });
    expect(movingHazardTip(VENT, MID_VENT_HOLD)).toEqual({ x: POLE_X, y: TOP_Y });
  });

  it('touches the whole column within its reach, above its top and beside it, edges inclusive', () => {
    expect(movingHazardTouches(VENT, MID_VENT_HOLD, { x: POLE_X, y: TOP_Y - REACH })).toBe(true);
    expect(movingHazardTouches(VENT, MID_VENT_HOLD, { x: POLE_X, y: TOP_Y - REACH - 0.01 })).toBe(false);
    expect(movingHazardTouches(VENT, MID_VENT_HOLD, { x: 1012 + REACH, y: FLOOR_Y - 40 })).toBe(true);
    expect(movingHazardTouches(VENT, MID_VENT_HOLD, { x: 1012 + REACH + 0.01, y: FLOOR_Y - 40 })).toBe(false);
    expect(movingHazardTouches(VENT, MID_VENT_WARN, { x: POLE_X, y: FLOOR_Y - 40 })).toBe(false);
    const tipY = movingHazardTip(VENT, MID_BURST).y;
    expect(movingHazardTouches(VENT, MID_BURST, { x: POLE_X, y: tipY - REACH + 0.01 })).toBe(true);
    expect(movingHazardTouches(VENT, MID_BURST, { x: POLE_X, y: tipY - REACH - 0.01 })).toBe(false);
  });
});

describe('a surface hazard keeps the surface as its base (issue #77, ND-3)', () => {
  it('starts the pole at the surface, going down, with its tip below it', () => {
    expect(movingHazardBaseY(POLE)).toBe(SURF);
    expect(movingHazardDirection(POLE)).toBe(1);
    expect(movingHazardTip(POLE, MID_HOLD)).toEqual({ x: POLE_X, y: FULL_TIP_Y });
    expect(POLE).not.toHaveProperty('baseY');
  });

  it('refuses a base for a surface type, and needs a finite one for a roof or floor type', () => {
    expect(() => movingHazardSpawn('b', PUNTING_POLE, 0, 0, undefined, 200)).toThrow(/takes no baseY/);
    expect(() => movingHazardSpawn('b', STALACTITE_DRIP, 0, 0)).toThrow(RangeError);
    expect(() => movingHazardSpawn('b', GEYSER_VENT, 0, 0)).toThrow(/needs a finite baseY/);
    expect(() => movingHazardSpawn('b', GEYSER_VENT, 0, 0, undefined, Number.NaN)).toThrow(RangeError);
    expect(() => movingHazardSpawn('b', GEYSER_VENT, 0, 0, undefined, 900)).not.toThrow();
  });
});
