import { describe, expect, it } from 'vitest';
import {
  DRAG_NET,
  DRAG_NETS,
  canEscapeDragNet,
  dragNetCatch,
  dragNetPeriod,
  dragNetPhase,
  dragNetSpawn,
  dragNetSweep,
  dragNetUnfairPoint,
  inDragNetHollow,
  sweepFront,
  sweepNumber,
  type DragNetPlan,
  type DragNetRect,
  type SweepDirection,
} from './dragNets';
import { DRAG_NET_FACT, DRAG_NET_MEET_RANGE } from './factCards';
import { legSpeedFactor } from './legs';
import { SWIM } from './tuning';
import { areaSize, swimBounds, type Point, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(10, 1));
/** The whole water depth, so the net can only be left through its left or right edge. */
const STRETCH: DragNetRect = { x0: 1000, x1: 1600, y0: BOUNDS.minY, y1: BOUNDS.maxY };
const HOLLOW_1: DragNetRect = { x0: 1170, x1: 1190, y0: BOUNDS.minY, y1: BOUNDS.maxY };
const HOLLOW_2: DragNetRect = { x0: 1400, x1: 1420, y0: BOUNDS.minY, y1: BOUNDS.maxY };
const PLAN: DragNetPlan = { stretch: STRETCH, sweep: 'right', hollows: [HOLLOW_1, HOLLOW_2] };
const NET = dragNetSpawn('deep-3/net-1', 0, PLAN);
/** The second stretch's timing: 3 s quiet, the default 1.0 s warning and a 2.0 s sweep. */
const STRETCH_2_TIMING = { quietFor: 3, warnFor: 1, sweepFor: 2 };
const MID_Y = (BOUNDS.minY + BOUNDS.maxY) / 2;
/** The default cycle: the sweep runs from 5 s to 7.5 s. */
const SWEEP_START = DRAG_NETS.quietFor + DRAG_NETS.warnFor;

/** The net on `sweep`, with hollows away from every point the catch tests use. */
function netSweeping(sweep: SweepDirection) {
  const stretch: DragNetRect = { x0: 1000, x1: 1400, y0: 100, y1: 290 };
  const hollow: DragNetRect = { x0: 1380, x1: 1400, y0: 270, y1: 290 };
  return dragNetSpawn(`net-${sweep}`, 0, { stretch, sweep, hollows: [hollow, { ...hollow, x0: 1000, x1: 1020 }] });
}

describe('drag net tuning (issue #108, ND-2)', () => {
  it('defaults to 4 s quiet, a 1.0 s warning and a 2.5 s sweep', () => {
    expect(DRAG_NETS).toEqual({ quietFor: 4, warnFor: 1, sweepFor: 2.5 });
    expect(Object.isFrozen(DRAG_NETS)).toBe(true);
  });

  it('is a cycle element with the Fishing nets card, met within DRAG_NET_MEET_RANGE, always running', () => {
    expect(DRAG_NET).toEqual({
      id: 'drag-net',
      name: 'Drag net',
      kind: 'cycle',
      period: 7.5,
      activeFor: 7.5,
      fact: DRAG_NET_FACT,
      meetRange: DRAG_NET_MEET_RANGE,
    });
    expect(Object.isFrozen(DRAG_NET)).toBe(true);
  });
});

describe('dragNetSpawn', () => {
  it('carries the stretch, the sweep, the hollows, the default timing and the offset', () => {
    expect(NET).toEqual({
      id: 'deep-3/net-1',
      type: DRAG_NET,
      offset: 0,
      dragNet: {
        stretch: { kind: 'rect', ...STRETCH },
        sweep: 'right',
        hollows: [
          { kind: 'rect', ...HOLLOW_1 },
          { kind: 'rect', ...HOLLOW_2 },
        ],
        timing: DRAG_NETS,
      },
    });
    expect(NET.dragNet.timing).not.toBe(DRAG_NETS);
    expect(dragNetPeriod(NET)).toBe(7.5);
  });

  it('takes its own timing from area data', () => {
    const net = dragNetSpawn('deep-3/net-2', 1.5, PLAN, STRETCH_2_TIMING);
    expect(net.dragNet.timing).toEqual(STRETCH_2_TIMING);
    expect(net.offset).toBe(1.5);
    expect(dragNetPeriod(net)).toBe(6);
  });

  it.each([
    ['an empty stretch', { ...PLAN, stretch: { ...STRETCH, x1: STRETCH.x0 } }],
    ['a reversed stretch', { ...PLAN, stretch: { ...STRETCH, y0: STRETCH.y1, y1: STRETCH.y0 } }],
    ['a non-finite stretch', { ...PLAN, stretch: { ...STRETCH, x1: Number.POSITIVE_INFINITY } }],
    ['an empty hollow', { ...PLAN, hollows: [{ ...HOLLOW_1, x1: HOLLOW_1.x0 }, HOLLOW_2] }],
    ['a hollow past the stretch', { ...PLAN, hollows: [HOLLOW_1, { ...HOLLOW_2, x0: 1590, x1: 1610 }] }],
    ['a hollow above the stretch', { ...PLAN, hollows: [{ ...HOLLOW_1, y0: BOUNDS.minY - 1 }, HOLLOW_2] }],
  ] as [string, DragNetPlan][])('throws for %s', (_label, plan) => {
    expect(() => dragNetSpawn('bad', 0, plan)).toThrow(RangeError);
  });

  it('throws unless there are exactly 2 hollows', () => {
    const one = { ...PLAN, hollows: [HOLLOW_1] } as unknown as DragNetPlan;
    const three = { ...PLAN, hollows: [HOLLOW_1, HOLLOW_2, HOLLOW_2] } as unknown as DragNetPlan;
    expect(() => dragNetSpawn('one', 0, one)).toThrow(/exactly 2 hollows/);
    expect(() => dragNetSpawn('three', 0, three)).toThrow(/exactly 2 hollows/);
  });

  it.each([
    ['a negative quiet', { quietFor: -1 }],
    ['a zero warning', { warnFor: 0 }],
    ['a zero sweep', { sweepFor: 0 }],
    ['a non-finite sweep', { sweepFor: Number.NaN }],
  ])('throws for %s', (_label, change) => {
    expect(() => dragNetSpawn('bad', 0, PLAN, { ...DRAG_NETS, ...change })).toThrow(RangeError);
  });

  it('throws for a non-finite offset', () => {
    expect(() => dragNetSpawn('bad', Number.NaN, PLAN)).toThrow(/offset must be finite/);
  });
});

describe('dragNetPhase', () => {
  it('is quiet for 4 s, warns for 1 s and sweeps for 2.5 s, then repeats', () => {
    expect(dragNetPhase(NET, 0)).toBe('quiet');
    expect(dragNetPhase(NET, 3.99)).toBe('quiet');
    expect(dragNetPhase(NET, 4)).toBe('warn');
    expect(dragNetPhase(NET, 4.99)).toBe('warn');
    expect(dragNetPhase(NET, 5)).toBe('sweep');
    expect(dragNetPhase(NET, 7.49)).toBe('sweep');
    expect(dragNetPhase(NET, 7.5)).toBe('quiet');
    expect(dragNetPhase(NET, 7.5 + 4.5)).toBe('warn');
  });

  it('runs on the offset and handles negative time', () => {
    const late = dragNetSpawn('late', 2, PLAN);
    expect(dragNetPhase(late, 1)).toBe('sweep');
    expect(dragNetPhase(late, 2)).toBe('quiet');
    expect(dragNetPhase(late, 6)).toBe('warn');
    expect(dragNetPhase(NET, -1)).toBe('sweep');
    expect(dragNetPhase(NET, -3)).toBe('warn');
  });

  it('follows its own timing: 3 s quiet, 1 s warning and a 2 s sweep', () => {
    const net = dragNetSpawn('deep-3/net-2', 0, PLAN, STRETCH_2_TIMING);
    expect(dragNetPhase(net, 2.99)).toBe('quiet');
    expect(dragNetPhase(net, 3)).toBe('warn');
    expect(dragNetPhase(net, 4)).toBe('sweep');
    expect(dragNetPhase(net, 6)).toBe('quiet');
  });
});

describe('sweepNumber', () => {
  it('counts whole cycles since the offset and changes at the start of each quiet', () => {
    expect(sweepNumber(NET, 0)).toBe(0);
    expect(sweepNumber(NET, 7.49)).toBe(0);
    expect(sweepNumber(NET, 7.5)).toBe(1);
    expect(sweepNumber(NET, -0.1)).toBe(-1);
  });
});

describe('sweepFront', () => {
  it('is null in the quiet and the warning', () => {
    expect(sweepFront(NET, 0)).toBeNull();
    expect(sweepFront(NET, 4.5)).toBeNull();
  });

  it('crosses the stretch at a steady speed over the sweep', () => {
    expect(sweepFront(NET, SWEEP_START)).toBe(STRETCH.x0);
    expect(sweepFront(NET, SWEEP_START + 1.25)).toBeCloseTo(1300, 9);
    expect(sweepFront(NET, SWEEP_START + 2.5 - 1e-9)).toBeCloseTo(STRETCH.x1, 4);
  });

  it.each([
    ['right', 1000, 1400],
    ['left', 1400, 1000],
    ['down', 100, 290],
    ['up', 290, 100],
  ] as [SweepDirection, number, number][])('moves %s from %d towards %d', (sweep, from, to) => {
    const net = netSweeping(sweep);
    expect(sweepFront(net, SWEEP_START)).toBe(from);
    expect(sweepFront(net, SWEEP_START + 1.25)).toBeCloseTo((from + to) / 2, 9);
  });
});

describe('dragNetCatch', () => {
  const halfway = SWEEP_START + 1.25;

  it('catches behind the front in the sweep and not ahead of it', () => {
    expect(dragNetCatch(NET, { x: 1250, y: MID_Y }, halfway, null)).toBe(0);
    expect(dragNetCatch(NET, { x: 1300, y: MID_Y }, halfway, null)).toBe(0);
    expect(dragNetCatch(NET, { x: 1350, y: MID_Y }, halfway, null)).toBeNull();
  });

  it('never catches in the quiet or the warning', () => {
    expect(dragNetCatch(NET, { x: 1000, y: MID_Y }, 2, null)).toBeNull();
    expect(dragNetCatch(NET, { x: 1000, y: MID_Y }, 4.9, null)).toBeNull();
  });

  it('never catches in a hollow, edges included', () => {
    expect(inDragNetHollow(NET, { x: 1180, y: MID_Y })).toBe(true);
    expect(inDragNetHollow(NET, { x: HOLLOW_1.x1, y: MID_Y })).toBe(true);
    expect(dragNetCatch(NET, { x: 1180, y: MID_Y }, halfway, null)).toBeNull();
    expect(dragNetCatch(NET, { x: HOLLOW_1.x0, y: MID_Y }, halfway, null)).toBeNull();
    expect(dragNetCatch(NET, { x: HOLLOW_1.x0 - 1, y: MID_Y }, halfway, null)).toBe(0);
  });

  it('never catches outside the stretch', () => {
    expect(dragNetCatch(NET, { x: STRETCH.x0 - 1, y: MID_Y }, halfway, null)).toBeNull();
    expect(dragNetCatch(NET, { x: 1100, y: BOUNDS.maxY + 1 }, halfway, null)).toBeNull();
    expect(dragNetCatch(NET, { x: STRETCH.x0, y: MID_Y }, halfway, null)).toBe(0);
  });

  it.each([
    ['right', { x: 1100, y: 200 }, { x: 1300, y: 200 }],
    ['left', { x: 1300, y: 200 }, { x: 1100, y: 200 }],
    ['down', { x: 1200, y: 150 }, { x: 1200, y: 250 }],
    ['up', { x: 1200, y: 250 }, { x: 1200, y: 150 }],
  ] as [SweepDirection, Point, Point][])('sweeping %s, catches behind the front only', (sweep, behind, ahead) => {
    const net = netSweeping(sweep);
    expect(dragNetCatch(net, behind, halfway, null)).toBe(0);
    expect(dragNetCatch(net, ahead, halfway, null)).toBeNull();
  });

  it('catches at most once per sweep, and again in the next sweep', () => {
    const pos = { x: 1100, y: MID_Y };
    const caught = dragNetCatch(NET, pos, halfway, null);
    expect(caught).toBe(0);
    expect(dragNetCatch(NET, pos, halfway + 0.5, caught)).toBeNull();
    expect(dragNetCatch(NET, { x: 1350, y: MID_Y }, 7.4, caught)).toBeNull();
    expect(dragNetCatch(NET, pos, 7.5 + halfway, caught)).toBe(1);
    expect(dragNetCatch(NET, pos, 7.5 + halfway, 1)).toBeNull();
  });

  it('has no Tail Dash input, so dashing gives no immunity', () => {
    expect(dragNetCatch.length).toBe(4);
  });

  it('only reads the axolotl, never moving or holding it', () => {
    const pos = Object.freeze({ x: 1100, y: MID_Y });
    expect(dragNetCatch(NET, pos, halfway, null)).toBe(0);
    expect(pos).toEqual({ x: 1100, y: MID_Y });
  });
});

describe('dragNetSweep', () => {
  it('is the whole stretch, a fresh rect each call', () => {
    expect(dragNetSweep(NET)).toEqual({ kind: 'rect', ...STRETCH });
    expect(dragNetSweep(NET)).not.toBe(NET.dragNet.stretch);
  });
});

describe('drag net fairness', () => {
  const oneLegSpeed = SWIM.maxSpeed * legSpeedFactor(1);

  it('counts a one-leg axolotl at 90 px/s', () => {
    expect(oneLegSpeed).toBe(90);
  });

  it('escapes from inside a hollow at once', () => {
    expect(canEscapeDragNet(NET, { x: 1180, y: MID_Y }, BOUNDS)).toBe(true);
  });

  it('escapes back past the start edge only within the warning', () => {
    const justIn = STRETCH.x0 + oneLegSpeed * DRAG_NETS.warnFor - 1;
    expect(canEscapeDragNet(NET, { x: justIn, y: MID_Y }, BOUNDS)).toBe(true);
    const tight = dragNetSpawn('tight', 0, { ...PLAN, hollows: [HOLLOW_2, HOLLOW_2] });
    expect(canEscapeDragNet(tight, { x: justIn + 2, y: MID_Y }, BOUNDS)).toBe(false);
  });

  it('cannot leave past an edge with no water beyond it', () => {
    const walled = dragNetSpawn('walled', 0, {
      ...PLAN,
      stretch: { ...STRETCH, x0: BOUNDS.minX },
      hollows: [HOLLOW_2, HOLLOW_2],
    });
    expect(canEscapeDragNet(walled, { x: BOUNDS.minX + 1, y: MID_Y }, BOUNDS)).toBe(false);
  });

  it('leaves through the top or bottom when there is water past it', () => {
    const shallow = dragNetSpawn('shallow', 0, {
      ...PLAN,
      stretch: { ...STRETCH, y0: 150, y1: 240 },
      hollows: [
        { ...HOLLOW_2, y0: 150, y1: 170 },
        { ...HOLLOW_2, y0: 220, y1: 240 },
      ],
    });
    expect(canEscapeDragNet(shallow, { x: 1250, y: 160 }, BOUNDS)).toBe(true);
    expect(dragNetUnfairPoint(shallow, BOUNDS)).toBeNull();
  });

  it('finds the net fair from every point when its hollows cover the gap', () => {
    expect(dragNetUnfairPoint(NET, BOUNDS)).toBeNull();
    expect(dragNetUnfairPoint(NET, BOUNDS, 1)).toBeNull();
  });

  it('names a point no one-leg axolotl can escape from when both hollows are near the start', () => {
    const unfair = dragNetSpawn('unfair', 0, {
      ...PLAN,
      hollows: [
        { ...HOLLOW_1, x0: 1050, x1: 1070 },
        { ...HOLLOW_1, x0: 1080, x1: 1100 },
      ],
    });
    const point = dragNetUnfairPoint(unfair, BOUNDS);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThan(1200);
    expect(point!.x).toBeLessThan(1300);
    expect(canEscapeDragNet(unfair, point!, BOUNDS)).toBe(false);
  });

  it('can find a stretch fair on the default timing and unfair on the shorter 2.0 s sweep', () => {
    const long: DragNetPlan = { ...PLAN, stretch: { ...STRETCH, x1: 1900 } };
    expect(dragNetUnfairPoint(dragNetSpawn('deep-3/net-1', 0, long), BOUNDS)).toBeNull();
    const fast = dragNetUnfairPoint(dragNetSpawn('deep-3/net-2', 0, long, STRETCH_2_TIMING), BOUNDS);
    expect(fast).not.toBeNull();
    expect(fast!.x).toBeGreaterThan(1590);
    expect(fast!.x).toBeLessThan(1630);
  });

  it('throws for a step that is not finite and greater than 0', () => {
    expect(() => dragNetUnfairPoint(NET, BOUNDS, 0)).toThrow(RangeError);
    expect(() => dragNetUnfairPoint(NET, BOUNDS, Number.NaN)).toThrow(RangeError);
  });
});
