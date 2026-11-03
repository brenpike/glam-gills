/**
 * Pure bailing bucket rules (issue #107, ND-2): Area 9's timing element. A boat is moored at the
 * surface, and its bucket comes down on a rope on a fixed cycle: a long rest, a short warning (the
 * bucket's shadow and ripples on the water) and a dip. During the dip only, a catch box under the
 * bucket scoops up an axolotl whose centre is inside it and tosses it to the boat's fixed landing
 * point, back along the main path. A catch costs no leg and no hit, starts no protected time and
 * lands the axolotl with zero velocity. A boat is never a hazard spawn, a moving hazard or an
 * element in `elements`, so the danger bar never counts it.
 */
import type { ElementSpawn, ElementType, HazardRect } from './hazards';
import { SURF, type Point, type SwimBounds } from './zone';

/** Bailing bucket tuning (issue #107, ND-2). */
export interface BailingBucketTuning {
  /** Seconds the bucket rests at the start of each cycle. */
  restFor: number;
  /** Seconds of warning (shadow and ripples) after the rest. */
  warnFor: number;
  /** Seconds the bucket dips after the warning; the catch box is live only now. */
  dipFor: number;
  /** Width in px of the catch box, centred on the bucket's x. */
  catchWidth: number;
  /** Depth in px of the catch box, down from SURF. */
  catchDepth: number;
  /** Seconds the toss takes, from the bucket to the landing point. Must be greater than 0. */
  tossFor: number;
  /** Height in px above SURF the toss arc reaches halfway through. */
  tossRise: number;
}

/**
 * Provisional bailing bucket values (issue #107, ND-2); tune in play. A 7 s cycle: rest 5 s, warn
 * 1 s, dip 1 s. The catch box is 48 px wide and reaches 70 px down from the surface. The toss is a
 * 1.2 s arc that rises 40 px above the surface halfway through; under reduced motion it is a fade
 * out over the first half and a fade in over the second.
 */
export const BAILING_BUCKETS: Readonly<BailingBucketTuning> = Object.freeze({
  restFor: 5,
  warnFor: 1,
  dipFor: 1,
  catchWidth: 48,
  catchDepth: 70,
  tossFor: 1.2,
  tossRise: 40,
});

/**
 * The bailing bucket (issue #107, ND-2), a timing element: one cycle every 7 s (`period`, the rest,
 * warning and dip together), with no fact card and no meet range, so it is never met. `activeFor`
 * equals `period` because the cycle clock always runs; bucketPhase says which part of the cycle it
 * is in. It has no sweep (elementSweep); its catch box (bailingCatchBox) is what the snacks keep
 * clear of. Each spawn carries its own `bailing` boat.
 */
export const BAILING_BUCKET: Readonly<ElementType> = Object.freeze({
  id: 'bailing-bucket',
  name: 'Bailing bucket',
  kind: 'cycle',
  period: 7,
  activeFor: 7,
});

/**
 * A moored bailing boat: the surface span `x0..x1` its hull covers, the x of its bucket's centre
 * and the fixed point a caught axolotl is tossed to. Inclusive edges; `x0 < x1`.
 */
export interface BailingBoat {
  x0: number;
  x1: number;
  bucketX: number;
  landing: Point;
}

/** A bailing bucket element, with its boat. */
export type BailingBoatSpawn = ElementSpawn & { bailing: BailingBoat };

/** The part of the bucket's cycle: resting, warning (shadow and ripples) or dipping (catching). */
export type BucketPhase = 'rest' | 'warn' | 'dip';

/** Where a tossed axolotl is drawn and how opaque, from 0 (gone) to 1. */
export interface TossPose {
  pos: Point;
  alpha: number;
}

/** True when `pos` is inside the swim bounds, edges included. */
function inBounds(pos: Readonly<Point>, bounds: Readonly<SwimBounds>): boolean {
  return pos.x >= bounds.minX && pos.x <= bounds.maxX && pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

/** True when `pos` is inside the rect, edges included. */
function inRect(pos: Readonly<Point>, rect: Readonly<HazardRect>): boolean {
  return pos.x >= rect.x0 && pos.x <= rect.x1 && pos.y >= rect.y0 && pos.y <= rect.y1;
}

/** The catch box under a bucket at `bucketX`: `catchWidth` wide, from SURF down `catchDepth`. */
function catchBoxAt(bucketX: number, tuning: Pick<BailingBucketTuning, 'catchWidth' | 'catchDepth'>): HazardRect {
  const half = tuning.catchWidth / 2;
  return { kind: 'rect', x0: bucketX - half, x1: bucketX + half, y0: SURF, y1: SURF + tuning.catchDepth };
}

/** Throws RangeError when the span is not finite with x0 < x1, or the bucket's catch box is not under it. */
function checkSpan(id: string, boat: Readonly<BailingBoat>, box: Readonly<HazardRect>): void {
  const { x0, x1, bucketX } = boat;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) {
    throw new RangeError(`bailingBoatSpawn: ${id} needs a finite span with x0 < x1, got ${x0}..${x1}`);
  }
  if (!Number.isFinite(bucketX) || box.x0 < x0 || box.x1 > x1) {
    throw new RangeError(`bailingBoatSpawn: ${id} catch box ${box.x0}..${box.x1} is not under the span ${x0}..${x1}`);
  }
}

/** Throws RangeError when the catch box reaches out of the water: past the swim bounds' x range or below their floor. */
function checkCatchBox(id: string, box: Readonly<HazardRect>, bounds: Readonly<SwimBounds>): void {
  if (box.x0 < bounds.minX || box.x1 > bounds.maxX || box.y1 > bounds.maxY) {
    throw new RangeError(`bailingBoatSpawn: ${id} catch box x ${box.x0}..${box.x1}, y ${box.y0}..${box.y1} is outside the water`);
  }
}

/** Throws RangeError when the landing point is not finite, is out of the swim bounds or is in the boat's own catch box. */
function checkLanding(id: string, landing: Readonly<Point>, box: Readonly<HazardRect>, bounds: Readonly<SwimBounds>): void {
  if (!Number.isFinite(landing.x) || !Number.isFinite(landing.y) || !inBounds(landing, bounds)) {
    throw new RangeError(`bailingBoatSpawn: ${id} landing point (${landing.x}, ${landing.y}) is out of the swim bounds`);
  }
  if (inRect(landing, box)) {
    throw new RangeError(`bailingBoatSpawn: ${id} landing point (${landing.x}, ${landing.y}) is in its own catch box`);
  }
}

/**
 * A bailing bucket element (BAILING_BUCKET) on `boat`, `offset` seconds into its cycle clock: the
 * cycle starts its rest at `offset` and every period after. Throws RangeError for a span that is not
 * finite with x0 < x1, a catch box (bailingCatchBox) that is not under the span or reaches out of the
 * water (past `bounds` in x or below `bounds.maxY`), a landing point that is not finite, is out of
 * `bounds` or is in the boat's own catch box, or an offset that is not finite.
 */
export function bailingBoatSpawn(
  id: string,
  offset: number,
  boat: Readonly<BailingBoat>,
  bounds: Readonly<SwimBounds>,
  tuning: Pick<BailingBucketTuning, 'catchWidth' | 'catchDepth'> = BAILING_BUCKETS,
): BailingBoatSpawn {
  const box = catchBoxAt(boat.bucketX, tuning);
  checkSpan(id, boat, box);
  checkCatchBox(id, box, bounds);
  checkLanding(id, boat.landing, box, bounds);
  if (!Number.isFinite(offset)) {
    throw new RangeError(`bailingBoatSpawn: ${id} offset must be finite, got ${offset}`);
  }
  const { x0, x1, bucketX, landing } = boat;
  return { id, type: BAILING_BUCKET, offset, bailing: { x0, x1, bucketX, landing: { x: landing.x, y: landing.y } } };
}

/** The boat's catch box: `catchWidth` wide, centred on the bucket's x, from SURF down `catchDepth`. Live only in the dip. */
export function bailingCatchBox(
  boat: Readonly<BailingBoatSpawn>,
  tuning: Pick<BailingBucketTuning, 'catchWidth' | 'catchDepth'> = BAILING_BUCKETS,
): HazardRect {
  return catchBoxAt(boat.bailing.bucketX, tuning);
}

/**
 * The part of the cycle at element time `t`: 'rest' for the first `restFor` seconds from `offset`,
 * 'warn' for the next `warnFor`, then 'dip' to the end of the period. The cycle repeats every
 * period; any finite `t` is valid, negative included. Element time is always finite, so a
 * non-finite `t` is not checked for.
 */
export function bucketPhase(
  boat: Readonly<BailingBoatSpawn>,
  t: number,
  tuning: Pick<BailingBucketTuning, 'restFor' | 'warnFor'> = BAILING_BUCKETS,
): BucketPhase {
  const { period } = boat.type;
  const phase = (((t - boat.offset) % period) + period) % period;
  if (phase < tuning.restFor) return 'rest';
  if (phase < tuning.restFor + tuning.warnFor) return 'warn';
  return 'dip';
}

/** The catch box at element time `t` when the bucket dips, else null: the box catches only in the dip. */
export function liveCatchBox(
  boat: Readonly<BailingBoatSpawn>,
  t: number,
  tuning: Pick<BailingBucketTuning, 'restFor' | 'warnFor' | 'catchWidth' | 'catchDepth'> = BAILING_BUCKETS,
): HazardRect | null {
  return bucketPhase(boat, t, tuning) === 'dip' ? bailingCatchBox(boat, tuning) : null;
}

/**
 * True when the bucket dips at element time `t` and the axolotl centre `pos` is in its catch box,
 * edges included. It tests the same box as bailingCatchBox without building it, so it allocates
 * nothing and can run every step.
 */
export function catchesAxolotl(
  boat: Readonly<BailingBoatSpawn>,
  pos: Readonly<Point>,
  t: number,
  tuning: Pick<BailingBucketTuning, 'restFor' | 'warnFor' | 'catchWidth' | 'catchDepth'> = BAILING_BUCKETS,
): boolean {
  if (bucketPhase(boat, t, tuning) !== 'dip') return false;
  const half = tuning.catchWidth / 2;
  const { bucketX } = boat.bailing;
  return pos.x >= bucketX - half && pos.x <= bucketX + half && pos.y >= SURF && pos.y <= SURF + tuning.catchDepth;
}

/** Where the toss starts: the bucket at the surface. */
export function tossStart(boat: Readonly<BailingBoatSpawn>): Point {
  return { x: boat.bailing.bucketX, y: SURF };
}

/**
 * The point on the toss arc a share `progress` (0 to 1) of the way through: x moves evenly from the
 * bucket to the landing point, and y follows a parabola that is `tossRise` px above SURF halfway.
 */
function tossArcPoint(boat: Readonly<BailingBoatSpawn>, progress: number, tuning: Pick<BailingBucketTuning, 'tossRise'>): Point {
  const from = tossStart(boat);
  const to = boat.bailing.landing;
  const rise = (from.y + to.y) / 2 - (SURF - tuning.tossRise);
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress - rise * 4 * progress * (1 - progress),
  };
}

/**
 * The tossed axolotl `elapsed` seconds into a toss from the boat's bucket. Without reduced motion it
 * follows the arc (tossArcPoint) at full opacity. Under reduced motion it never moves along the arc:
 * it fades out at the bucket over the first half of `tossFor` and fades in at the landing point over
 * the second half. From `tossFor` on it is at the landing point at full opacity, where the toss ends.
 * Throws RangeError for a negative or non-finite `elapsed`.
 */
export function tossPose(
  boat: Readonly<BailingBoatSpawn>,
  elapsed: number,
  reduced: boolean,
  tuning: Pick<BailingBucketTuning, 'tossFor' | 'tossRise'> = BAILING_BUCKETS,
): TossPose {
  if (!(elapsed >= 0) || !Number.isFinite(elapsed)) {
    throw new RangeError(`tossPose: elapsed must be a finite number >= 0, got ${elapsed}`);
  }
  const landing = boat.bailing.landing;
  const progress = Math.min(1, elapsed / tuning.tossFor);
  if (progress >= 1) return { pos: { x: landing.x, y: landing.y }, alpha: 1 };
  if (!reduced) return { pos: tossArcPoint(boat, progress, tuning), alpha: 1 };
  if (progress < 0.5) return { pos: tossStart(boat), alpha: 1 - progress * 2 };
  return { pos: { x: landing.x, y: landing.y }, alpha: progress * 2 - 1 };
}

/** True when a toss `elapsed` seconds in has ended: the axolotl is at the landing point and swims again. */
export function tossDone(elapsed: number, tuning: Pick<BailingBucketTuning, 'tossFor'> = BAILING_BUCKETS): boolean {
  return elapsed >= tuning.tossFor;
}
