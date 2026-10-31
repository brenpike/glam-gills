import { describe, expect, it } from 'vitest';
import type { FactCard } from './factCards';
import { blockExplorer } from './hyacinthMats';
import {
  GLOW_PLANT,
  elementActive,
  elementSweep,
  hazardCentre,
  hazardMet,
  hazardShapeAt,
  hazardSweep,
  hazardTouches,
  legHazardAt,
  shapeDistance,
} from './hazards';
import type { ElementSpawn, HazardRect, HazardSpawn, HazardType } from './hazards';
import { swimBounds } from './zone';

const TEST_FACT: FactCard = {
  id: 'test-fact',
  name: 'Test fact',
  title: 'Test fact title',
  body: 'A fact used only in tests.',
};

const BITER: HazardType = {
  id: 'test-biter',
  name: 'Test biter',
  costsLeg: true,
  reach: 10,
  meetRange: 30,
  fact: TEST_FACT,
};

const WEED: HazardType = {
  id: 'test-weed',
  name: 'Test weed',
  costsLeg: false,
  reach: 5,
  meetRange: 20,
  fact: TEST_FACT,
};

const CIRCLE: HazardSpawn = {
  id: 'circle',
  type: BITER,
  shape: { kind: 'circle', x: 100, y: 100, r: 20 },
};

const RECT: HazardSpawn = {
  id: 'rect',
  type: WEED,
  shape: { kind: 'rect', x0: 200, x1: 300, y0: 50, y1: 150 },
};

const CYCLE: ElementSpawn = {
  id: 'pulse',
  type: { id: 'test-cycle', name: 'Test cycle', kind: 'cycle', period: 10, activeFor: 3 },
  offset: 2,
};

const MATS: ElementSpawn = {
  id: 'mats',
  type: {
    ...CYCLE.type,
    id: 'test-mats',
    name: 'Test mats',
    fact: TEST_FACT,
    meetRange: 180,
    openFor: 3,
    openingFor: 1,
    closingFor: 1,
    closedFor: 6,
  },
  offset: 2,
  matPair: { x0: 400, x1: 460, rowTop: 80, rowBottom: 360, channelY: 220, openHeight: 72 },
};

describe('shapeDistance', () => {
  it('is 0 inside a circle and on its edge', () => {
    expect(shapeDistance({ x: 100, y: 100 }, CIRCLE.shape)).toBe(0);
    expect(shapeDistance({ x: 120, y: 100 }, CIRCLE.shape)).toBe(0);
  });

  it('is the distance to the edge outside a circle', () => {
    expect(shapeDistance({ x: 150, y: 100 }, CIRCLE.shape)).toBe(30);
  });

  it('is 0 inside a rect and on its edge', () => {
    expect(shapeDistance({ x: 250, y: 100 }, RECT.shape)).toBe(0);
    expect(shapeDistance({ x: 300, y: 150 }, RECT.shape)).toBe(0);
  });

  it('is the straight distance beside a rect', () => {
    expect(shapeDistance({ x: 320, y: 100 }, RECT.shape)).toBe(20);
    expect(shapeDistance({ x: 250, y: 30 }, RECT.shape)).toBe(20);
  });

  it('is the distance to the nearest corner past a rect corner', () => {
    expect(shapeDistance({ x: 303, y: 154 }, RECT.shape)).toBe(5);
    expect(shapeDistance({ x: 197, y: 46 }, RECT.shape)).toBe(5);
  });
});

describe('hazardCentre', () => {
  it('is the circle centre', () => {
    expect(hazardCentre(CIRCLE.shape)).toEqual({ x: 100, y: 100 });
  });

  it('is the rect midpoint', () => {
    expect(hazardCentre(RECT.shape)).toEqual({ x: 250, y: 100 });
  });
});

describe('hazardTouches', () => {
  it('touches inside the shape', () => {
    expect(hazardTouches(CIRCLE, { x: 100, y: 100 })).toBe(true);
  });

  it('touches exactly at reach from the edge', () => {
    expect(hazardTouches(CIRCLE, { x: 130, y: 100 })).toBe(true);
  });

  it('does not touch just past reach', () => {
    expect(hazardTouches(CIRCLE, { x: 130.5, y: 100 })).toBe(false);
  });

  it('measures reach from a rect corner, not its bounding box', () => {
    expect(hazardTouches(RECT, { x: 303, y: 154 })).toBe(true);
    expect(hazardTouches(RECT, { x: 304, y: 155 })).toBe(false);
  });
});

describe('legHazardAt', () => {
  it('returns the touching leg hazard', () => {
    expect(legHazardAt([CIRCLE, RECT], { x: 110, y: 100 })).toBe(CIRCLE);
  });

  it('returns undefined when nothing touches', () => {
    expect(legHazardAt([CIRCLE, RECT], { x: 500, y: 500 })).toBeUndefined();
  });

  it('never returns a slow-only hazard even when touching it', () => {
    expect(hazardTouches(RECT, { x: 250, y: 100 })).toBe(true);
    expect(legHazardAt([RECT], { x: 250, y: 100 })).toBeUndefined();
  });

  it('returns the first leg hazard when several touch', () => {
    const second: HazardSpawn = { ...CIRCLE, id: 'second' };
    expect(legHazardAt([RECT, CIRCLE, second], { x: 100, y: 100 })).toBe(CIRCLE);
  });

  it('returns undefined for an empty list', () => {
    expect(legHazardAt([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe('hazardMet', () => {
  it('is met exactly at meet range from the edge', () => {
    expect(hazardMet(CIRCLE, { x: 150, y: 100 })).toBe(true);
  });

  it('is not met just past meet range', () => {
    expect(hazardMet(CIRCLE, { x: 150.5, y: 100 })).toBe(false);
  });

  it('is met inside the shape', () => {
    expect(hazardMet(RECT, { x: 250, y: 100 })).toBe(true);
  });

  it('uses meet range, not reach, for a slow-only rect', () => {
    expect(hazardMet(RECT, { x: 320, y: 100 })).toBe(true);
    expect(hazardTouches(RECT, { x: 320, y: 100 })).toBe(false);
  });
});

describe('elementActive', () => {
  it('is inactive before the window opens', () => {
    expect(elementActive(CYCLE, 1.9)).toBe(false);
  });

  it('is active from the window start, inclusive', () => {
    expect(elementActive(CYCLE, 2)).toBe(true);
    expect(elementActive(CYCLE, 4.9)).toBe(true);
  });

  it('is inactive from the window end, exclusive', () => {
    expect(elementActive(CYCLE, 5)).toBe(false);
    expect(elementActive(CYCLE, 11.9)).toBe(false);
  });

  it('repeats every period', () => {
    expect(elementActive(CYCLE, 12)).toBe(true);
    expect(elementActive(CYCLE, 15)).toBe(false);
  });

  it('wraps a window that crosses the period end', () => {
    const wrapping: ElementSpawn = { ...CYCLE, offset: 8 };
    expect(elementActive(wrapping, 8)).toBe(true);
    expect(elementActive(wrapping, 9.9)).toBe(true);
    expect(elementActive(wrapping, 10)).toBe(true);
    expect(elementActive(wrapping, 10.9)).toBe(true);
    expect(elementActive(wrapping, 11)).toBe(false);
    expect(elementActive(wrapping, 7.9)).toBe(false);
  });

  it('handles negative times', () => {
    expect(elementActive(CYCLE, -8)).toBe(true);
    expect(elementActive(CYCLE, -5.1)).toBe(true);
    expect(elementActive(CYCLE, -5)).toBe(false);
    expect(elementActive(CYCLE, -8.1)).toBe(false);
    expect(elementActive(CYCLE, -0.5)).toBe(false);
    expect(elementActive(CYCLE, -3)).toBe(false);
  });

  it('handles large times', () => {
    expect(elementActive(CYCLE, 1_000_002)).toBe(true);
    expect(elementActive(CYCLE, 1_000_005)).toBe(false);
  });

  it('is always active when activeFor covers the period', () => {
    const always: ElementSpawn = {
      ...CYCLE,
      type: { ...CYCLE.type, activeFor: 10 },
    };
    expect(elementActive(always, 0)).toBe(true);
    expect(elementActive(always, 9.99)).toBe(true);
  });

  it('is never active when activeFor is 0', () => {
    const never: ElementSpawn = { ...CYCLE, type: { ...CYCLE.type, activeFor: 0 } };
    expect(elementActive(never, 2)).toBe(false);
  });

  it('throws RangeError when period is not positive', () => {
    const zero: ElementSpawn = { ...CYCLE, type: { ...CYCLE.type, period: 0 } };
    const negative: ElementSpawn = { ...CYCLE, type: { ...CYCLE.type, period: -4 } };
    expect(() => elementActive(zero, 1)).toThrow(RangeError);
    expect(() => elementActive(negative, 1)).toThrow(RangeError);
  });
});

describe('mat element data', () => {
  it('keeps elementActive unchanged by the optional fact, meet range, timing and geometry', () => {
    for (let time = -12; time <= 24; time += 0.25) {
      expect(elementActive(MATS, time)).toBe(elementActive(CYCLE, time));
    }
  });
});

describe('elementSweep', () => {
  it('is the whole x0..x1 by rowTop..rowBottom rect of a mat pair', () => {
    expect(elementSweep(MATS)).toEqual({ kind: 'rect', x0: 400, x1: 460, y0: 80, y1: 360 });
  });

  it('is null for an element with no geometry', () => {
    expect(elementSweep(CYCLE)).toBeNull();
  });

  it('contains both mats at any channel height, so shapeDistance measures from it', () => {
    const sweep = elementSweep(MATS);
    if (!sweep) throw new Error('expected a sweep');
    expect(shapeDistance({ x: 430, y: 80 }, sweep)).toBe(0);
    expect(shapeDistance({ x: 430, y: 220 }, sweep)).toBe(0);
    expect(shapeDistance({ x: 430, y: 360 }, sweep)).toBe(0);
    expect(shapeDistance({ x: 540, y: 220 }, sweep)).toBe(80);
  });

  it('returns a new rect that shares nothing with the spawn', () => {
    const sweep = elementSweep(MATS);
    if (!sweep) throw new Error('expected a sweep');
    sweep.x0 = 0;
    expect(MATS.matPair?.x0).toBe(400);
  });
});

const DRIFTING_RECT: HazardSpawn = {
  ...RECT,
  id: 'drifting-rect',
  drift: { dx: 160, dy: -40, period: 16, offset: 0 },
};

const DRIFTING_CIRCLE: HazardSpawn = {
  ...CIRCLE,
  id: 'drifting-circle',
  drift: { dx: -60, dy: 30, period: 10, offset: 0 },
};

function rectAt(hazard: HazardSpawn, t: number): HazardRect {
  const shape = hazardShapeAt(hazard, t);
  if (shape.kind !== 'rect') throw new Error(`expected a rect, got ${shape.kind}`);
  return shape;
}

describe('hazardShapeAt', () => {
  it('returns the still hazard its own shape object at any time', () => {
    expect(hazardShapeAt(RECT, 0)).toBe(RECT.shape);
    expect(hazardShapeAt(CIRCLE, 7.3)).toBe(CIRCLE.shape);
  });

  it('starts at the place, reaches the far end at half a period and comes back', () => {
    expect(hazardShapeAt(DRIFTING_RECT, 0)).toEqual(RECT.shape);
    const far = rectAt(DRIFTING_RECT, 8);
    expect(far.x0).toBeCloseTo(360);
    expect(far.x1).toBeCloseTo(460);
    expect(far.y0).toBeCloseTo(10);
    expect(far.y1).toBeCloseTo(110);
    const back = rectAt(DRIFTING_RECT, 16);
    expect(back.x0).toBeCloseTo(200);
    expect(back.y0).toBeCloseTo(50);
  });

  it('is halfway along the path at a quarter period, keeping its size', () => {
    const mid = rectAt(DRIFTING_RECT, 4);
    expect(mid.x0).toBeCloseTo(280);
    expect(mid.x1).toBeCloseTo(380);
    expect(mid.y0).toBeCloseTo(30);
    expect(mid.y1).toBeCloseTo(130);
  });

  it('eases to a stop at both ends and moves fastest in the middle', () => {
    const step = 0.01;
    const moved = (t: number): number =>
      rectAt(DRIFTING_RECT, t + step).x0 - rectAt(DRIFTING_RECT, t).x0;
    expect(Math.abs(moved(0))).toBeLessThan(0.001);
    expect(Math.abs(moved(8))).toBeLessThan(0.001);
    expect(moved(4 - step / 2)).toBeCloseTo(160 * Math.PI / 16 * step, 4);
  });

  it('runs ahead by its offset', () => {
    const ahead: HazardSpawn = { ...DRIFTING_RECT, drift: { ...DRIFTING_RECT.drift!, offset: 3 } };
    for (const t of [0, 1.5, 5, 12]) {
      expect(hazardShapeAt(ahead, t)).toEqual(hazardShapeAt(DRIFTING_RECT, t + 3));
    }
    expect(rectAt(ahead, 5).x0).toBeCloseTo(360);
  });

  it('moves a circle by its centre and keeps its radius', () => {
    const far = hazardShapeAt(DRIFTING_CIRCLE, 5);
    expect(far.kind).toBe('circle');
    if (far.kind !== 'circle') return;
    expect(far.x).toBeCloseTo(40);
    expect(far.y).toBeCloseTo(130);
    expect(far.r).toBe(20);
  });

  it('never changes the spawn shape', () => {
    hazardShapeAt(DRIFTING_RECT, 8);
    hazardShapeAt(DRIFTING_CIRCLE, 5);
    expect(RECT.shape).toEqual({ kind: 'rect', x0: 200, x1: 300, y0: 50, y1: 150 });
    expect(CIRCLE.shape).toEqual({ kind: 'circle', x: 100, y: 100, r: 20 });
  });
});

describe('hazardSweep', () => {
  it('returns the still hazard its own shape object', () => {
    expect(hazardSweep(RECT)).toBe(RECT.shape);
    expect(hazardSweep(CIRCLE)).toBe(CIRCLE.shape);
  });

  it('bounds a rect over its whole path with positive dx and negative dy', () => {
    expect(hazardSweep(DRIFTING_RECT)).toEqual({ kind: 'rect', x0: 200, x1: 460, y0: 10, y1: 150 });
  });

  it('bounds a rect over its whole path with negative dx and positive dy', () => {
    const drifting: HazardSpawn = { ...RECT, drift: { dx: -50, dy: 70, period: 12, offset: 4 } };
    expect(hazardSweep(drifting)).toEqual({ kind: 'rect', x0: 150, x1: 300, y0: 50, y1: 220 });
  });

  it('bounds a circle over its whole path as a rect', () => {
    expect(hazardSweep(DRIFTING_CIRCLE)).toEqual({
      kind: 'rect',
      x0: 20,
      x1: 120,
      y0: 80,
      y1: 150,
    });
  });

  it('holds the shape at every time along the path', () => {
    const sweep = hazardSweep(DRIFTING_RECT);
    if (sweep.kind !== 'rect') throw new Error('expected a rect sweep');
    for (let t = 0; t < 16; t += 0.5) {
      const shape = rectAt(DRIFTING_RECT, t);
      expect(shape.x0).toBeGreaterThanOrEqual(sweep.x0 - 1e-9);
      expect(shape.x1).toBeLessThanOrEqual(sweep.x1 + 1e-9);
      expect(shape.y0).toBeGreaterThanOrEqual(sweep.y0 - 1e-9);
      expect(shape.y1).toBeLessThanOrEqual(sweep.y1 + 1e-9);
    }
  });
});

const GLOW_PLANT_SPAWN: ElementSpawn = {
  id: 'glow-plant-1',
  type: GLOW_PLANT,
  offset: 0,
  glowPlant: { x: 300, y: 200, radius: 14 },
};

describe('the glow-plant element (issue #77, ND-8)', () => {
  it('is a puzzle element with no fact card and no meet range', () => {
    expect(GLOW_PLANT).toEqual({ id: 'glow-plant', name: 'Glow-plant', kind: 'puzzle', period: 1, activeFor: 1 });
    expect(GLOW_PLANT).not.toHaveProperty('fact');
    expect(GLOW_PLANT).not.toHaveProperty('meetRange');
    expect(Object.isFrozen(GLOW_PLANT)).toBe(true);
  });

  it('is always active', () => {
    for (let time = -12; time <= 24; time += 0.25) {
      expect(elementActive(GLOW_PLANT_SPAWN, time)).toBe(true);
    }
  });

  it('has no sweep, so it is never a hit and never blocks', () => {
    expect(elementSweep(GLOW_PLANT_SPAWN)).toBeNull();
    const next = blockExplorer({ x: 260, y: 200 }, { x: 300, y: 200 }, [GLOW_PLANT_SPAWN], 0, {
      bounds: swimBounds(),
      nets: [],
      currents: [],
    });
    expect(next).toEqual({ x: 300, y: 200 });
  });
});

const TRAJINERA_ELEMENT: ElementSpawn = {
  id: 'test/boat-1',
  type: { id: 'test-boat', name: 'Test boat', kind: 'cycle', period: 6, activeFor: 6 },
  offset: 0,
  trajinera: { x0: 200, x1: 480, direction: 'right' },
};

describe('a gliding trajinera crossing on an element (issue #78, ND-8)', () => {
  it('has no sweep, so the boat is never a mat, never a hit and never blocks as one', () => {
    expect(elementSweep(TRAJINERA_ELEMENT)).toBeNull();
    const next = blockExplorer({ x: 260, y: 100 }, { x: 300, y: 100 }, [TRAJINERA_ELEMENT], 2, {
      bounds: swimBounds(),
      nets: [],
      currents: [],
    });
    expect(next).toEqual({ x: 300, y: 100 });
  });

  it('keeps its crossing clock always running', () => {
    for (let time = -12; time <= 24; time += 0.25) {
      expect(elementActive(TRAJINERA_ELEMENT, time)).toBe(true);
    }
  });
});
