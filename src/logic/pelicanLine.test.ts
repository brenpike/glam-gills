import { describe, expect, it } from 'vitest';
import { SAFE_PASSING_WIDTH } from './layoutGaps';
import {
  PELICAN_LINE,
  PELICAN_PHASES,
  pelicanBirdCount,
  pelicanBirdPositions,
  pelicanLinePeriod,
  pelicanLinePhase,
  pelicanLineSpawn,
  pelicanLineSweep,
  pelicanNarrowestGap,
  pelicanPose,
  pelicanScoopBoxes,
  pelicanScoopHit,
  pelicanScoopNumber,
  type PelicanLinePlan,
  type PelicanLineTuning,
} from './pelicanLine';
import { TILAPIA } from './tuning';
import { SURF, areaSize, swimBounds, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(9, 2));
/** A 1000 px span: the 500 px line has 500 px to glide, 10 s of gliding each way. */
const PLAN: PelicanLinePlan = { x0: 1000, x1: 2000 };
const LINE = pelicanLineSpawn('lake-1/pelicans-1', 0, PLAN, BOUNDS);
const WARN_START = PELICAN_LINE.glideFor;
const PLUNGE_START = WARN_START + PELICAN_LINE.warnFor;
const HOLD_START = PLUNGE_START + PELICAN_LINE.plungeFor;
const RISE_START = HOLD_START + PELICAN_LINE.holdFor;
const PERIOD = RISE_START + PELICAN_LINE.riseFor;
const MID_HOLD = HOLD_START + PELICAN_LINE.holdFor / 2;
const DIP_Y = SURF + PELICAN_LINE.dipDepth;

/** The default tuning with `changes` on top. */
function tuned(changes: Partial<PelicanLineTuning>): PelicanLineTuning {
  return { ...PELICAN_LINE, ...changes };
}

describe('pelican line tuning (issue #211, ND-5, ND-6)', () => {
  it('has the provisional values', () => {
    expect(PELICAN_LINE).toEqual({
      count: 3,
      spacing: 200,
      scoopWidth: 100,
      glideSpeed: 50,
      glideFor: 3.0,
      warnFor: 1.0,
      plungeFor: 0.4,
      holdFor: 0.5,
      riseFor: 0.6,
      dipDepth: 220,
      touchReach: 18,
      bobAmplitude: 2,
      bobPeriod: 2.4,
    });
    expect(Object.isFrozen(PELICAN_LINE)).toBe(true);
  });

  it('warns for at least the A2 floor of 0.8 s', () => {
    expect(PELICAN_LINE.warnFor).toBeGreaterThanOrEqual(TILAPIA.minWindup);
    expect(TILAPIA.minWindup).toBe(0.8);
  });

  it('lists the phases in cycle order', () => {
    expect(PELICAN_PHASES).toEqual(['glide', 'warn', 'plunge', 'hold', 'rise']);
    expect(Object.isFrozen(PELICAN_PHASES)).toBe(true);
  });
});

describe('pelicanLineSpawn', () => {
  it('keeps the span, offset and a frozen copy of the tuning', () => {
    const input = tuned({});
    const line = pelicanLineSpawn('p', 1.5, PLAN, BOUNDS, input);
    expect(line).toEqual({ id: 'p', x0: 1000, x1: 2000, offset: 1.5, tuning: PELICAN_LINE });
    expect(Object.isFrozen(line.tuning)).toBe(true);
    input.count = 4;
    expect(line.tuning.count).toBe(3);
  });

  it('accepts a hold of 0 s and a touch reach of 0', () => {
    expect(() => pelicanLineSpawn('p', 0, PLAN, BOUNDS, tuned({ holdFor: 0, touchReach: 0 }))).not.toThrow();
  });

  it.each([
    ['a span that is not finite', { x0: Number.NaN, x1: 2000 }],
    ['a span with x0 not below x1', { x0: 2000, x1: 2000 }],
    ['a span no longer than the line', { x0: 1000, x1: 1500 }],
    ['a span past the left of the swim bounds', { x0: BOUNDS.minX - 1, x1: 1000 }],
    ['a span past the right of the swim bounds', { x0: 1000, x1: BOUNDS.maxX + 1 }],
  ])('throws a RangeError for %s', (_, plan) => {
    expect(() => pelicanLineSpawn('p', 0, plan, BOUNDS)).toThrow(RangeError);
  });

  it('throws a RangeError for an offset that is not finite', () => {
    expect(() => pelicanLineSpawn('p', Number.POSITIVE_INFINITY, PLAN, BOUNDS)).toThrow(RangeError);
  });

  it('throws a RangeError when the dip reaches below the swim bounds', () => {
    expect(() => pelicanLineSpawn('p', 0, PLAN, { ...BOUNDS, maxY: DIP_Y - 1 })).toThrow(/reaches below the swim bounds/);
    expect(() => pelicanLineSpawn('p', 0, PLAN, { ...BOUNDS, maxY: DIP_Y })).not.toThrow();
  });

  it.each([
    ['one bird', { count: 1 }],
    ['a count that is not whole', { count: 2.5 }],
    ['a warning under the A2 floor', { warnFor: 0.79 }],
    ['a glide speed of 0', { glideSpeed: 0 }],
    ['a glide time that is not finite', { glideFor: Number.NaN }],
    ['a plunge of 0 s', { plungeFor: 0 }],
    ['a rise of 0 s', { riseFor: 0 }],
    ['a negative hold', { holdFor: -0.1 }],
    ['a dip depth of 0', { dipDepth: 0 }],
    ['a negative touch reach', { touchReach: -1 }],
    ['a negative bob', { bobAmplitude: -1 }],
    ['a bob period of 0', { bobPeriod: 0 }],
  ])('throws a RangeError for %s', (_, changes) => {
    expect(() => pelicanLineSpawn('p', 0, PLAN, BOUNDS, tuned(changes))).toThrow(RangeError);
  });

  it('throws a RangeError when a gap after both touch reaches is under the safe passing width', () => {
    const spacing = PELICAN_LINE.scoopWidth + 2 * PELICAN_LINE.touchReach + SAFE_PASSING_WIDTH;
    expect(() => pelicanLineSpawn('p', 0, PLAN, BOUNDS, tuned({ spacing: spacing - 1 }))).toThrow(/safe passing width/);
    expect(() => pelicanLineSpawn('p', 0, PLAN, BOUNDS, tuned({ spacing }))).not.toThrow();
  });
});

describe('pelican line cycle', () => {
  it('runs a 5.5 s cycle', () => {
    expect(pelicanLinePeriod(LINE)).toBeCloseTo(5.5, 10);
    expect(PERIOD).toBeCloseTo(5.5, 10);
  });

  it.each([
    [0, 'glide', 0],
    [1.5, 'glide', 0.5],
    [WARN_START, 'warn', 0],
    [WARN_START + 0.5, 'warn', 0.5],
    [PLUNGE_START, 'plunge', 0],
    [PLUNGE_START + 0.2, 'plunge', 0.5],
    [HOLD_START, 'hold', 0],
    [RISE_START, 'rise', 0],
    [RISE_START + 0.3, 'rise', 0.5],
  ] as const)('is in %s s: %s, %s of the way through', (t, phase, progress) => {
    const result = pelicanLinePhase(LINE, t);
    expect(result.phase).toBe(phase);
    expect(result.progress).toBeCloseTo(progress, 6);
  });

  it('repeats every period, before the offset too', () => {
    for (const t of [0.4, 3.2, 4.1, 4.6, 5.2]) {
      expect(pelicanLinePhase(LINE, t + PERIOD).phase).toBe(pelicanLinePhase(LINE, t).phase);
      expect(pelicanLinePhase(LINE, t - 2 * PERIOD).phase).toBe(pelicanLinePhase(LINE, t).phase);
    }
  });

  it('starts its cycle at the offset', () => {
    const late = pelicanLineSpawn('late', 2, PLAN, BOUNDS);
    expect(pelicanLinePhase(late, 2 + WARN_START).phase).toBe('warn');
    expect(pelicanLinePhase(late, 1.9).phase).toBe('rise');
  });

  it('skips a hold of 0 s', () => {
    const line = pelicanLineSpawn('p', 0, PLAN, BOUNDS, tuned({ holdFor: 0 }));
    expect(pelicanLinePhase(line, HOLD_START).phase).toBe('rise');
  });

  it('counts one scoop per cycle, changing at the start of each glide', () => {
    expect(pelicanScoopNumber(LINE, 0)).toBe(0);
    expect(pelicanScoopNumber(LINE, PLUNGE_START)).toBe(0);
    expect(pelicanScoopNumber(LINE, PERIOD - 0.01)).toBe(0);
    expect(pelicanScoopNumber(LINE, PERIOD)).toBe(1);
    expect(pelicanScoopNumber(LINE, -0.01)).toBe(-1);
  });
});

describe('pelican bird positions', () => {
  it('has three birds 200 px apart on the surface, the first half a scoop box in from x0 at the offset', () => {
    expect(pelicanBirdCount(LINE)).toBe(3);
    expect(pelicanBirdPositions(LINE, 0)).toEqual([
      { x: 1050, y: SURF },
      { x: 1250, y: SURF },
      { x: 1450, y: SURF },
    ]);
  });

  it('glides as one at 50 px/s through the glide', () => {
    const xs = pelicanBirdPositions(LINE, 2).map((bird) => bird.x);
    expect(xs[0]).toBeCloseTo(1150, 6);
    expect(xs[1] - xs[0]).toBeCloseTo(200, 6);
    expect(xs[2] - xs[1]).toBeCloseTo(200, 6);
  });

  it('holds still from the start of the warning to the end of the rise', () => {
    const still = pelicanBirdPositions(LINE, WARN_START)[0].x;
    for (const t of [WARN_START + 0.5, PLUNGE_START, MID_HOLD, RISE_START + 0.5, PERIOD - 1e-9]) {
      expect(pelicanBirdPositions(LINE, t)[0].x).toBeCloseTo(still, 6);
    }
    expect(still).toBeCloseTo(1200, 6);
  });

  it('stays in its span, turns at the right end after 500 px of gliding and glides back', () => {
    const atEnd = 3 * PERIOD + 1;
    const lastX = (t: number) => pelicanBirdPositions(LINE, t)[2].x;
    for (let t = 0; t < 12 * PERIOD; t += 0.1) {
      expect(lastX(t) + PELICAN_LINE.scoopWidth / 2).toBeLessThanOrEqual(PLAN.x1 + 1e-6);
      expect(pelicanBirdPositions(LINE, t)[0].x - PELICAN_LINE.scoopWidth / 2).toBeGreaterThanOrEqual(PLAN.x0 - 1e-6);
    }
    expect(lastX(atEnd)).toBeCloseTo(PLAN.x1 - PELICAN_LINE.scoopWidth / 2, 6);
    expect(lastX(atEnd + 1)).toBeCloseTo(PLAN.x1 - PELICAN_LINE.scoopWidth / 2 - 50, 6);
  });

  it('gives the same positions for the same time', () => {
    expect(pelicanBirdPositions(LINE, 17.3)).toEqual(pelicanBirdPositions(LINE, 17.3));
  });
});

describe('pelican scoop boxes', () => {
  it('has none through the glide and the warning', () => {
    for (const t of [0, 1.5, WARN_START, PLUNGE_START - 0.01]) expect(pelicanScoopBoxes(LINE, t)).toEqual([]);
  });

  it('has one 100 px box per bird, centred on it, from SURF down to the dip depth through the hold', () => {
    const birds = pelicanBirdPositions(LINE, MID_HOLD);
    const boxes = pelicanScoopBoxes(LINE, MID_HOLD);
    expect(boxes).toHaveLength(3);
    boxes.forEach((box, index) => {
      expect(box).toEqual({ kind: 'rect', x0: birds[index].x - 50, x1: birds[index].x + 50, y0: SURF, y1: DIP_Y });
    });
  });

  it('goes down over the plunge and back up over the rise at a steady speed', () => {
    expect(pelicanScoopBoxes(LINE, PLUNGE_START)[0].y1).toBeCloseTo(SURF, 6);
    expect(pelicanScoopBoxes(LINE, PLUNGE_START + 0.2)[0].y1).toBeCloseTo(SURF + 110, 6);
    expect(pelicanScoopBoxes(LINE, RISE_START + 0.3)[0].y1).toBeCloseTo(SURF + 110, 6);
  });

  it('keeps every gap at least the safe passing width after both touch reaches, through the whole scoop', () => {
    for (let t = PLUNGE_START; t < PERIOD; t += 0.05) {
      const boxes = pelicanScoopBoxes(LINE, t);
      for (let index = 1; index < boxes.length; index += 1) {
        const clear = boxes[index].x0 - boxes[index - 1].x1 - 2 * PELICAN_LINE.touchReach;
        expect(clear).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
        expect(clear).toBeCloseTo(pelicanNarrowestGap(LINE), 6);
      }
    }
  });

  it('gives the narrowest gap as 200 - 100 - 2 * 18 = 64 px', () => {
    expect(pelicanNarrowestGap(LINE)).toBe(64);
    expect(pelicanNarrowestGap(LINE)).toBeGreaterThanOrEqual(SAFE_PASSING_WIDTH);
  });

  it('sweeps the whole span from SURF down to the dip depth', () => {
    expect(pelicanLineSweep(LINE)).toEqual({ kind: 'rect', x0: 1000, x1: 2000, y0: SURF, y1: DIP_Y });
  });
});

describe('pelicanScoopHit', () => {
  const birds = pelicanBirdPositions(LINE, MID_HOLD);
  const midY = SURF + 100;

  it('gives the index of the bird whose scoop box holds the body centre', () => {
    expect(pelicanScoopHit(LINE, { x: birds[0].x, y: midY }, MID_HOLD)).toBe(0);
    expect(pelicanScoopHit(LINE, { x: birds[2].x, y: midY }, MID_HOLD)).toBe(2);
  });

  it('bumps at the touch reach from a box edge, inclusive, and not 1 px past it', () => {
    const edge = birds[1].x + 50;
    expect(pelicanScoopHit(LINE, { x: edge + 18, y: midY }, MID_HOLD)).toBe(1);
    expect(pelicanScoopHit(LINE, { x: edge + 19, y: midY }, MID_HOLD)).toBeNull();
  });

  it('never bumps through the glide or the warning, even right at a bird', () => {
    for (const t of [0, 2, WARN_START, WARN_START + 0.9]) {
      const bird = pelicanBirdPositions(LINE, t)[0];
      expect(pelicanScoopHit(LINE, { x: bird.x, y: SURF + 10 }, t)).toBeNull();
    }
  });

  it('bumps near the surface at the first instant of the plunge', () => {
    const bird = pelicanBirdPositions(LINE, PLUNGE_START)[0];
    expect(pelicanScoopHit(LINE, { x: bird.x, y: SURF + 18 }, PLUNGE_START)).toBe(0);
    expect(pelicanScoopHit(LINE, { x: bird.x, y: SURF + 19 }, PLUNGE_START)).toBeNull();
  });

  it('never bumps an axolotl that dives under the dip', () => {
    for (let t = PLUNGE_START; t < PERIOD; t += 0.05) {
      for (const bird of pelicanBirdPositions(LINE, t)) {
        expect(pelicanScoopHit(LINE, { x: bird.x, y: DIP_Y + 19 }, t)).toBeNull();
      }
    }
  });

  it('never bumps an axolotl in the middle of a gap, from SURF to the dip depth', () => {
    for (let t = PLUNGE_START; t < PERIOD; t += 0.05) {
      const now = pelicanBirdPositions(LINE, t);
      for (let index = 1; index < now.length; index += 1) {
        const middle = (now[index - 1].x + now[index].x) / 2;
        for (let y = SURF; y <= DIP_Y; y += 10) {
          for (let dx = -SAFE_PASSING_WIDTH / 2; dx <= SAFE_PASSING_WIDTH / 2; dx += 2) {
            expect(pelicanScoopHit(LINE, { x: middle + dx, y }, t)).toBeNull();
          }
        }
      }
    }
  });

  it('lets a caller bump at most once per scoop with the scoop number', () => {
    const pos = { x: birds[0].x, y: midY };
    let bumpedScoop: number | null = null;
    let bumps = 0;
    for (let t = 0; t < 3 * PERIOD; t += 0.05) {
      if (pelicanScoopHit(LINE, { ...pos, x: pelicanBirdPositions(LINE, t)[0].x }, t) === null) continue;
      const scoop = pelicanScoopNumber(LINE, t);
      if (scoop === bumpedScoop) continue;
      bumpedScoop = scoop;
      bumps += 1;
    }
    expect(bumps).toBe(3);
  });

  it('never changes the position it reads', () => {
    const pos = Object.freeze({ x: birds[0].x, y: midY });
    expect(pelicanScoopHit(LINE, pos, MID_HOLD)).toBe(0);
    expect(pos).toEqual({ x: birds[0].x, y: midY });
  });
});

describe('pelicanPose', () => {
  it('shows the frame of the phase', () => {
    expect(pelicanPose(LINE, 0, 1, true).frame).toBe(0);
    expect(pelicanPose(LINE, 0, WARN_START + 0.1, true).frame).toBe(1);
    expect(pelicanPose(LINE, 0, PLUNGE_START + 0.1, true).frame).toBe(2);
    expect(pelicanPose(LINE, 0, MID_HOLD, true).frame).toBe(3);
    expect(pelicanPose(LINE, 0, RISE_START + 0.1, true).frame).toBe(4);
  });

  it('sits on SURF at its bird with no bob under reduced motion', () => {
    for (const t of [0, 0.6, 1.3, 2.9, MID_HOLD]) {
      const birds = pelicanBirdPositions(LINE, t);
      for (let index = 0; index < 3; index += 1) {
        expect(pelicanPose(LINE, index, t, true).pos).toEqual(birds[index]);
      }
    }
  });

  it('bobs up to 2 px either way without reduced motion, out of step from bird to bird', () => {
    const offsets = [0, 1, 2].map((index) => pelicanPose(LINE, index, 0.6, false).pos.y - SURF);
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(2);
    expect(new Set(offsets.map((offset) => offset.toFixed(3))).size).toBe(3);
  });

  it('faces the way the line glides, and holds that facing through the stop', () => {
    expect(pelicanPose(LINE, 0, 1, true).facing).toBe(1);
    expect(pelicanPose(LINE, 0, MID_HOLD, true).facing).toBe(1);
    expect(pelicanPose(LINE, 0, 4 * PERIOD + 1, true).facing).toBe(-1);
    expect(pelicanPose(LINE, 0, 4 * PERIOD + MID_HOLD, true).facing).toBe(-1);
  });

  it('gives the bills depth below SURF', () => {
    expect(pelicanPose(LINE, 1, 1, true).billDepth).toBe(0);
    expect(pelicanPose(LINE, 1, MID_HOLD, true).billDepth).toBe(220);
    expect(pelicanPose(LINE, 1, PLUNGE_START + 0.2, true).billDepth).toBeCloseTo(110, 6);
  });

  it.each([-1, 3, 1.5])('throws a RangeError for bird %s', (index) => {
    expect(() => pelicanPose(LINE, index, 0, true)).toThrow(RangeError);
  });
});
