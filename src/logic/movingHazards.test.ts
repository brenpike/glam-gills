import { describe, expect, it } from 'vitest';
import { ANCHOR_DROP_FACT, GEYSER_FACT, MUD_SEEP_FACT, PUNTING_POLE_FACT, STALACTITE_FACT } from './factCards';
import {
  ANCHOR_DROP,
  GEYSER_VENT,
  MUD_SEEP,
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

/** Points every 10 px along a shaft's centre line, from its base to its tip, both included. */
function shaftLinePoints(x: number, baseY: number, tipY: number): { x: number; y: number }[] {
  const steps = Math.ceil(Math.abs(tipY - baseY) / 10);
  return Array.from({ length: steps + 1 }, (_unused, step) => ({ x, y: baseY + ((tipY - baseY) * step) / steps }));
}

describe('ANCHOR_DROP and MUD_SEEP (issue #194)', () => {
  it('have their ids, names, looks, fact cards, bases and danger-part marks', () => {
    expect([ANCHOR_DROP.id, ANCHOR_DROP.name, ANCHOR_DROP.look]).toEqual(['anchor-drop', 'Anchor drop', 'anchor-drop']);
    expect([MUD_SEEP.id, MUD_SEEP.name, MUD_SEEP.look]).toEqual(['mud-seep', 'Mud seep', 'mud-seep']);
    expect(ANCHOR_DROP.fact).toBe(ANCHOR_DROP_FACT);
    expect(MUD_SEEP.fact).toBe(MUD_SEEP_FACT);
    expect(ANCHOR_DROP).not.toHaveProperty('from');
    expect([movingHazardFrom(ANCHOR_DROP), movingHazardFrom(MUD_SEEP)]).toEqual(['surface', 'floor']);
    for (const type of [ANCHOR_DROP, MUD_SEEP]) {
      expect(type.dangerPart, type.id).toBe(true);
      expect(Object.isFrozen(type), type.id).toBe(true);
    }
  });

  it('have their phase times, on cycles of 4.8 s and 5.6 s, each out 2.4 s', () => {
    expect(ANCHOR_DROP).toMatchObject({ restFor: 1.4, warnFor: 1.0, jabFor: 0.5, holdFor: 0.8, liftFor: 1.1 });
    expect(MUD_SEEP).toMatchObject({ restFor: 2.0, warnFor: 1.2, jabFor: 0.5, holdFor: 1.2, liftFor: 0.7 });
    expect(movingHazardPeriod(ANCHOR_DROP)).toBeCloseTo(4.8, 9);
    expect(movingHazardPeriod(MUD_SEEP)).toBeCloseTo(5.6, 9);
    expect(ANCHOR_DROP.jabFor + ANCHOR_DROP.holdFor + ANCHOR_DROP.liftFor).toBeCloseTo(2.4, 9);
    expect(MUD_SEEP.jabFor + MUD_SEEP.holdFor + MUD_SEEP.liftFor).toBeCloseTo(2.4, 9);
  });

  it('warn at least the 0.8 s floor', () => {
    expect(ANCHOR_DROP.warnFor).toBeGreaterThanOrEqual(TILAPIA.minWindup);
    expect(MUD_SEEP.warnFor).toBeGreaterThanOrEqual(TILAPIA.minWindup);
  });

  it('have their depths, widths, touch reaches and meet ranges', () => {
    expect([ANCHOR_DROP.depth, ANCHOR_DROP.halfWidth, ANCHOR_DROP.touchReach, ANCHOR_DROP.meetRange]).toEqual([200, 5, 18, 180]);
    expect([MUD_SEEP.depth, MUD_SEEP.halfWidth, MUD_SEEP.touchReach, MUD_SEEP.meetRange]).toEqual([180, 10, 18, 180]);
  });

  it('refuse a base for the anchor drop, and need a finite one for the mud seep', () => {
    expect(() => movingHazardSpawn('a', ANCHOR_DROP, 0, 0, undefined, 200)).toThrow(/takes no baseY/);
    expect(() => movingHazardSpawn('a', ANCHOR_DROP, 0, 0)).not.toThrow();
    expect(() => movingHazardSpawn('m', MUD_SEEP, 0, 0)).toThrow(/needs a finite baseY/);
    expect(() => movingHazardSpawn('m', MUD_SEEP, 0, 0, undefined, Number.NaN)).toThrow(RangeError);
    expect(() => movingHazardSpawn('m', MUD_SEEP, 0, 0, undefined, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => movingHazardSpawn('m', MUD_SEEP, 0, 0, undefined, 900)).not.toThrow();
  });
});

describe('a surface hazard: the anchor drop (issue #194)', () => {
  const ANCHOR = movingHazardSpawn('test/anchor-1', ANCHOR_DROP, POLE_X, 0);
  /** Mid-phase times from offset 0: rest 0..1.4, warn 1.4..2.4, drop 2.4..2.9, hold 2.9..3.7, pull up 3.7..4.8. */
  const MID_ANCHOR_REST = 0.7;
  const MID_ANCHOR_WARN = 1.9;
  const MID_DROP = 2.65;
  const MID_ANCHOR_HOLD = 3.3;
  const MID_PULL_UP = 4.25;
  const BED_Y = SURF + ANCHOR_DROP.depth;

  it('starts at the surface and goes down', () => {
    expect(movingHazardBaseY(ANCHOR)).toBe(SURF);
    expect(movingHazardDirection(ANCHOR)).toBe(1);
    expect(ANCHOR).toEqual({ id: 'test/anchor-1', type: ANCHOR_DROP, x: POLE_X, offset: 0 });
  });

  it('runs rest, warn, jab, hold, lift over its 4.8 s cycle', () => {
    const mids = [MID_ANCHOR_REST, MID_ANCHOR_WARN, MID_DROP, MID_ANCHOR_HOLD, MID_PULL_UP].map((t) => movingHazardPhase(ANCHOR, t));
    expect(mids.map((mid) => mid.phase)).toEqual(['rest', 'warn', 'jab', 'hold', 'lift']);
    for (const mid of mids) expect(mid.progress).toBeCloseTo(0.5, 9);
    expect(movingHazardPhase(ANCHOR, movingHazardPeriod(ANCHOR_DROP))).toEqual({ phase: 'rest', progress: 0 });
  });

  it('drops to its depth, holds, and pulls back up', () => {
    expect(movingHazardTipDepth(ANCHOR, MID_ANCHOR_REST)).toBe(0);
    expect(movingHazardTipDepth(ANCHOR, MID_ANCHOR_WARN)).toBe(0);
    expect(movingHazardTipDepth(ANCHOR, MID_DROP)).toBeCloseTo(100, 6);
    expect(movingHazardTipDepth(ANCHOR, MID_ANCHOR_HOLD)).toBe(200);
    expect(movingHazardTipDepth(ANCHOR, MID_PULL_UP)).toBeCloseTo(100, 6);
  });

  it('has its tip at the surface when not out, and at the canal bed when held', () => {
    expect(movingHazardTip(ANCHOR, MID_ANCHOR_WARN)).toEqual({ x: POLE_X, y: SURF });
    expect(movingHazardTip(ANCHOR, MID_ANCHOR_HOLD)).toEqual({ x: POLE_X, y: BED_Y });
  });

  it('is the chain from the surface to the anchor, and its sweep is that chain at full depth', () => {
    expect(movingHazardShape(ANCHOR, MID_ANCHOR_REST)).toBeNull();
    expect(movingHazardShape(ANCHOR, MID_ANCHOR_WARN)).toBeNull();
    expect(movingHazardShape(ANCHOR, MID_DROP)?.y1).toBeCloseTo(SURF + 100, 6);
    expect(movingHazardShape(ANCHOR, MID_ANCHOR_HOLD)).toEqual({ kind: 'rect', x0: 995, x1: 1005, y0: SURF, y1: BED_Y });
    expect(movingHazardSweep(ANCHOR)).toEqual({ kind: 'rect', x0: 995, x1: 1005, y0: SURF, y1: BED_Y });
  });

  it('touches along the whole chain and the anchor, base to tip, and nowhere at rest or in the warning', () => {
    const line = shaftLinePoints(POLE_X, SURF, BED_Y);
    for (const point of line) {
      expect(movingHazardTouches(ANCHOR, MID_ANCHOR_HOLD, point), `hold y=${point.y}`).toBe(true);
      expect(movingHazardTouches(ANCHOR, MID_ANCHOR_REST, point), `rest y=${point.y}`).toBe(false);
      expect(movingHazardTouches(ANCHOR, MID_ANCHOR_WARN, point), `warn y=${point.y}`).toBe(false);
    }
    expect(movingHazardTouches(ANCHOR, MID_ANCHOR_HOLD, { x: POLE_X, y: BED_Y + REACH })).toBe(true);
    expect(movingHazardTouches(ANCHOR, MID_ANCHOR_HOLD, { x: POLE_X, y: BED_Y + REACH + 0.01 })).toBe(false);
    expect(movingHazardTouches(ANCHOR, MID_ANCHOR_HOLD, { x: 1005 + REACH, y: SURF + 100 })).toBe(true);
    expect(movingHazardTouches(ANCHOR, MID_ANCHOR_HOLD, { x: 1005 + REACH + 0.01, y: SURF + 100 })).toBe(false);
  });
});

describe('a floor hazard: the mud seep (issue #194)', () => {
  const FLOOR_Y = 1000;
  const SEEP = movingHazardSpawn('test/seep-1', MUD_SEEP, POLE_X, 0, undefined, FLOOR_Y);
  /** Mid-phase times from offset 0: rest 0..2.0, warn 2.0..3.2, rise 3.2..3.7, hold 3.7..4.9, fade 4.9..5.6. */
  const MID_SEEP_REST = 1.0;
  const MID_SEEP_WARN = 2.6;
  const MID_RISE = 3.45;
  const MID_SEEP_HOLD = 4.3;
  const MID_FADE = 5.25;
  const TOP_Y = FLOOR_Y - MUD_SEEP.depth;

  it('starts at the floor and goes up', () => {
    expect(movingHazardBaseY(SEEP)).toBe(FLOOR_Y);
    expect(movingHazardDirection(SEEP)).toBe(-1);
    expect(SEEP).toEqual({ id: 'test/seep-1', type: MUD_SEEP, x: POLE_X, offset: 0, baseY: FLOOR_Y });
  });

  it('runs rest, warn, jab, hold, lift over its 5.6 s cycle', () => {
    const mids = [MID_SEEP_REST, MID_SEEP_WARN, MID_RISE, MID_SEEP_HOLD, MID_FADE].map((t) => movingHazardPhase(SEEP, t));
    expect(mids.map((mid) => mid.phase)).toEqual(['rest', 'warn', 'jab', 'hold', 'lift']);
    for (const mid of mids) expect(mid.progress).toBeCloseTo(0.5, 9);
    expect(movingHazardPhase(SEEP, movingHazardPeriod(MUD_SEEP))).toEqual({ phase: 'rest', progress: 0 });
  });

  it('rises to its height, holds, and fades back to the floor', () => {
    expect(movingHazardTipDepth(SEEP, MID_SEEP_REST)).toBe(0);
    expect(movingHazardTipDepth(SEEP, MID_SEEP_WARN)).toBe(0);
    expect(movingHazardTipDepth(SEEP, MID_RISE)).toBeCloseTo(90, 6);
    expect(movingHazardTipDepth(SEEP, MID_SEEP_HOLD)).toBe(180);
    expect(movingHazardTipDepth(SEEP, MID_FADE)).toBeCloseTo(90, 6);
  });

  it('has its tip at the floor when not out, and at the top of the column when held', () => {
    expect(movingHazardTip(SEEP, MID_SEEP_WARN)).toEqual({ x: POLE_X, y: FLOOR_Y });
    expect(movingHazardTip(SEEP, MID_SEEP_HOLD)).toEqual({ x: POLE_X, y: TOP_Y });
  });

  it('is a column from the floor to its top, and its sweep is that column at full height', () => {
    expect(movingHazardShape(SEEP, MID_SEEP_REST)).toBeNull();
    expect(movingHazardShape(SEEP, MID_SEEP_WARN)).toBeNull();
    const rise = movingHazardShape(SEEP, MID_RISE);
    expect(rise?.y0).toBeCloseTo(FLOOR_Y - 90, 6);
    expect(rise?.y1).toBe(FLOOR_Y);
    expect(movingHazardShape(SEEP, MID_SEEP_HOLD)).toEqual({ kind: 'rect', x0: 990, x1: 1010, y0: TOP_Y, y1: FLOOR_Y });
    expect(movingHazardSweep(SEEP)).toEqual({ kind: 'rect', x0: 990, x1: 1010, y0: TOP_Y, y1: FLOOR_Y });
  });

  it('touches along the whole column, base to tip, and nowhere at rest or in the warning', () => {
    const line = shaftLinePoints(POLE_X, FLOOR_Y, TOP_Y);
    for (const point of line) {
      expect(movingHazardTouches(SEEP, MID_SEEP_HOLD, point), `hold y=${point.y}`).toBe(true);
      expect(movingHazardTouches(SEEP, MID_SEEP_REST, point), `rest y=${point.y}`).toBe(false);
      expect(movingHazardTouches(SEEP, MID_SEEP_WARN, point), `warn y=${point.y}`).toBe(false);
    }
    expect(movingHazardTouches(SEEP, MID_SEEP_HOLD, { x: POLE_X, y: TOP_Y - REACH })).toBe(true);
    expect(movingHazardTouches(SEEP, MID_SEEP_HOLD, { x: POLE_X, y: TOP_Y - REACH - 0.01 })).toBe(false);
    expect(movingHazardTouches(SEEP, MID_SEEP_HOLD, { x: 1010 + REACH, y: FLOOR_Y - 40 })).toBe(true);
    expect(movingHazardTouches(SEEP, MID_SEEP_HOLD, { x: 1010 + REACH + 0.01, y: FLOOR_Y - 40 })).toBe(false);
  });
});
