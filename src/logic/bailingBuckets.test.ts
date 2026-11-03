import { describe, expect, it } from 'vitest';
import {
  BAILING_BUCKET,
  BAILING_BUCKETS,
  bailingBoatSpawn,
  bailingCatchBox,
  bucketPhase,
  catchesAxolotl,
  liveCatchBox,
  tossDone,
  tossPose,
  tossStart,
  type BailingBoat,
} from './bailingBuckets';
import { elementSweep } from './hazards';
import { SURF, areaSize, swimBounds, type SwimBounds } from './zone';

const BOUNDS: SwimBounds = swimBounds(areaSize(9, 2));
const BOAT: BailingBoat = { x0: 3000, x1: 3120, bucketX: 3060, landing: { x: 1800, y: 400 } };
const SPAWN = bailingBoatSpawn('deep-2/bailing-1', 0, BOAT, BOUNDS);
/** Starts its rest 3.5 s later than SPAWN, so the two never dip together. */
const LATE = bailingBoatSpawn('deep-2/bailing-2', 3.5, { ...BOAT, x0: 3600, x1: 3720, bucketX: 3660 }, BOUNDS);

describe('bailing bucket tuning (issue #107, ND-2)', () => {
  it('runs a 7 s cycle: rest 5 s, warn 1 s, dip 1 s', () => {
    expect(BAILING_BUCKET.period).toBe(7);
    expect(BAILING_BUCKETS.restFor).toBe(5);
    expect(BAILING_BUCKETS.warnFor).toBe(1);
    expect(BAILING_BUCKETS.dipFor).toBe(1);
    expect(BAILING_BUCKETS.restFor + BAILING_BUCKETS.warnFor + BAILING_BUCKETS.dipFor).toBe(BAILING_BUCKET.period);
  });

  it('catches in a box 48 px wide from the surface down 70 px, and tosses for 1.2 s', () => {
    expect(BAILING_BUCKETS.catchWidth).toBe(48);
    expect(BAILING_BUCKETS.catchDepth).toBe(70);
    expect(BAILING_BUCKETS.tossFor).toBe(1.2);
  });

  it('is a cycle element with no fact card and no meet range, always running', () => {
    expect(BAILING_BUCKET).toEqual({ id: 'bailing-bucket', name: 'Bailing bucket', kind: 'cycle', period: 7, activeFor: 7 });
    expect(BAILING_BUCKET.fact).toBeUndefined();
    expect(BAILING_BUCKET.meetRange).toBeUndefined();
    expect(Object.isFrozen(BAILING_BUCKET)).toBe(true);
    expect(Object.isFrozen(BAILING_BUCKETS)).toBe(true);
  });
});

describe('bailingBoatSpawn', () => {
  it('carries the span, the bucket x, the offset and the landing point', () => {
    expect(SPAWN).toEqual({ id: 'deep-2/bailing-1', type: BAILING_BUCKET, offset: 0, bailing: BOAT });
    expect(SPAWN.bailing).not.toBe(BOAT);
    expect(SPAWN.bailing.landing).not.toBe(BOAT.landing);
  });

  it('has no element sweep', () => {
    expect(elementSweep(SPAWN)).toBeNull();
  });

  it.each([
    ['a reversed span', { x0: 3120, x1: 3000 }],
    ['an empty span', { x0: 3000, x1: 3000 }],
    ['a non-finite span', { x1: Number.POSITIVE_INFINITY }],
    ['a catch box past the span west end', { bucketX: 3010 }],
    ['a catch box past the span east end', { bucketX: 3110 }],
    ['a non-finite bucket x', { bucketX: Number.NaN }],
  ])('throws for %s', (_label, change) => {
    expect(() => bailingBoatSpawn('bad', 0, { ...BOAT, ...change }, BOUNDS)).toThrow(RangeError);
  });

  it('throws for a catch box outside the water', () => {
    expect(() => bailingBoatSpawn('west', 0, { ...BOAT, x0: 0, x1: 100, bucketX: 50 }, BOUNDS)).toThrow(/outside the water/);
    const east = BOUNDS.maxX + 40;
    expect(() => bailingBoatSpawn('east', 0, { ...BOAT, x0: east - 100, x1: east, bucketX: east - 50 }, BOUNDS)).toThrow(
      /outside the water/,
    );
    const shallow: SwimBounds = { ...BOUNDS, maxY: SURF + BAILING_BUCKETS.catchDepth - 1 };
    expect(() => bailingBoatSpawn('shallow', 0, { ...BOAT, landing: { x: 1800, y: SURF + 20 } }, shallow)).toThrow(
      /outside the water/,
    );
  });

  it('accepts a catch box flush with the swim bounds', () => {
    const half = BAILING_BUCKETS.catchWidth / 2;
    const flush = { ...BOAT, x0: BOUNDS.minX, x1: BOUNDS.minX + 100, bucketX: BOUNDS.minX + half };
    expect(() => bailingBoatSpawn('flush', 0, flush, BOUNDS)).not.toThrow();
  });

  it.each([
    ['west of the bounds', { x: BOUNDS.minX - 1, y: 400 }],
    ['east of the bounds', { x: BOUNDS.maxX + 1, y: 400 }],
    ['above the bounds', { x: 1800, y: BOUNDS.minY - 1 }],
    ['below the bounds', { x: 1800, y: BOUNDS.maxY + 1 }],
    ['not finite', { x: Number.NaN, y: 400 }],
  ])('throws for a landing point %s', (_label, landing) => {
    expect(() => bailingBoatSpawn('bad', 0, { ...BOAT, landing }, BOUNDS)).toThrow(/out of the swim bounds/);
  });

  it('throws for a landing point in its own catch box', () => {
    expect(() => bailingBoatSpawn('bad', 0, { ...BOAT, landing: { x: 3060, y: SURF + 30 } }, BOUNDS)).toThrow(/own catch box/);
  });

  it('throws for an offset that is not finite', () => {
    expect(() => bailingBoatSpawn('bad', Number.NaN, BOAT, BOUNDS)).toThrow(/offset/);
  });
});

describe('bailingCatchBox', () => {
  it('is 48 px wide centred on the bucket, from SURF down 70 px', () => {
    expect(bailingCatchBox(SPAWN)).toEqual({ kind: 'rect', x0: 3036, x1: 3084, y0: SURF, y1: SURF + 70 });
  });
});

describe('bucketPhase', () => {
  it.each([
    [0, 'rest'],
    [4.999, 'rest'],
    [5, 'warn'],
    [5.999, 'warn'],
    [6, 'dip'],
    [6.999, 'dip'],
    [7, 'rest'],
    [13.5, 'dip'],
    [-1, 'dip'],
    [-2, 'warn'],
    [-7, 'rest'],
  ] as const)('is %s s into the cycle: %s', (t, phase) => {
    expect(bucketPhase(SPAWN, t)).toBe(phase);
  });

  it('starts the cycle at the offset', () => {
    expect(bucketPhase(LATE, 3.4)).toBe('dip');
    expect(bucketPhase(LATE, 3.5)).toBe('rest');
    expect(bucketPhase(LATE, 8.5)).toBe('warn');
    expect(bucketPhase(LATE, 9.5)).toBe('dip');
  });

  it('runs two boats with offsets 3.5 s apart out of step: they never dip together', () => {
    for (let tenth = 0; tenth < 140; tenth++) {
      const t = tenth / 10;
      expect(bucketPhase(SPAWN, t) === 'dip' && bucketPhase(LATE, t) === 'dip', `t ${t}`).toBe(false);
    }
  });
});

describe('catching', () => {
  const inside = { x: 3060, y: SURF + 35 };

  it('makes the catch box live only during the dip', () => {
    expect(liveCatchBox(SPAWN, 2)).toBeNull();
    expect(liveCatchBox(SPAWN, 5.5)).toBeNull();
    expect(liveCatchBox(SPAWN, 6.5)).toEqual(bailingCatchBox(SPAWN));
  });

  it('catches an axolotl centre in the box only during the dip', () => {
    expect(catchesAxolotl(SPAWN, inside, 2)).toBe(false);
    expect(catchesAxolotl(SPAWN, inside, 5.5)).toBe(false);
    expect(catchesAxolotl(SPAWN, inside, 6.5)).toBe(true);
  });

  it('catches on the box edges, and never a centre just outside them', () => {
    expect(catchesAxolotl(SPAWN, { x: 3036, y: SURF + 70 }, 6.5)).toBe(true);
    expect(catchesAxolotl(SPAWN, { x: 3084, y: SURF }, 6.5)).toBe(true);
    expect(catchesAxolotl(SPAWN, { x: 3035.9, y: SURF + 35 }, 6.5)).toBe(false);
    expect(catchesAxolotl(SPAWN, { x: 3084.1, y: SURF + 35 }, 6.5)).toBe(false);
    expect(catchesAxolotl(SPAWN, { x: 3060, y: SURF + 70.1 }, 6.5)).toBe(false);
  });
});

describe('the toss', () => {
  const start = tossStart(SPAWN);
  const landing = BOAT.landing;

  it('starts at the bucket on the surface', () => {
    expect(start).toEqual({ x: 3060, y: SURF });
  });

  it('follows an arc from the bucket to the landing point over 1.2 s, rising above the surface halfway', () => {
    expect(tossPose(SPAWN, 0, false)).toEqual({ pos: start, alpha: 1 });
    const half = tossPose(SPAWN, 0.6, false);
    expect(half.alpha).toBe(1);
    expect(half.pos.x).toBeCloseTo((start.x + landing.x) / 2, 9);
    expect(half.pos.y).toBeCloseTo(SURF - BAILING_BUCKETS.tossRise, 9);
    expect(tossPose(SPAWN, 1.2, false)).toEqual({ pos: landing, alpha: 1 });
  });

  it('moves x evenly and never leaves the line between the ends in x', () => {
    for (let step = 0; step <= 12; step++) {
      const { pos } = tossPose(SPAWN, step / 10, false);
      expect(pos.x).toBeCloseTo(start.x + ((landing.x - start.x) * step) / 12, 9);
      expect(pos.y).toBeLessThanOrEqual(Math.max(start.y, landing.y) + 1e-9);
    }
  });

  it('under reduced motion fades out at the bucket, then fades in at the landing point, over the same 1.2 s', () => {
    expect(tossPose(SPAWN, 0, true)).toEqual({ pos: start, alpha: 1 });
    const fading = tossPose(SPAWN, 0.3, true);
    expect(fading.pos).toEqual(start);
    expect(fading.alpha).toBeCloseTo(0.5, 9);
    expect(tossPose(SPAWN, 0.6, true)).toEqual({ pos: landing, alpha: 0 });
    const showing = tossPose(SPAWN, 0.9, true);
    expect(showing.pos).toEqual(landing);
    expect(showing.alpha).toBeCloseTo(0.5, 9);
    expect(tossPose(SPAWN, 1.2, true)).toEqual({ pos: landing, alpha: 1 });
  });

  it('stays at the landing point after the toss ends', () => {
    expect(tossPose(SPAWN, 5, false)).toEqual({ pos: landing, alpha: 1 });
    expect(tossPose(SPAWN, 5, true)).toEqual({ pos: landing, alpha: 1 });
  });

  it('ends at 1.2 s', () => {
    expect(tossDone(1.19)).toBe(false);
    expect(tossDone(1.2)).toBe(true);
  });

  it('throws for a negative or non-finite elapsed time', () => {
    expect(() => tossPose(SPAWN, -0.1, false)).toThrow(RangeError);
    expect(() => tossPose(SPAWN, Number.NaN, true)).toThrow(RangeError);
    expect(() => tossPose(SPAWN, Number.POSITIVE_INFINITY, false)).toThrow(RangeError);
  });

  it('returns a landing point that shares no object with the boat', () => {
    expect(tossPose(SPAWN, 2, false).pos).not.toBe(SPAWN.bailing.landing);
  });
});
