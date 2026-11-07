/**
 * Pure wind and waves rules (issue #211, ND-10 and ND-11): the open lake's timing element. Gusts blow
 * along x across a span of the surface band and fade with depth. Each cycle runs, from the spawn's
 * offset: a calm, then the ripple warning on the surface, then the gust. Each gust blows the other
 * way from the one before, starting with the spawn's first direction. Only the gust pushes, and only
 * the axolotl: the wind never moves a snack or a predator, never pushes inside the safe area, never
 * costs a leg and never starts protected time. A one-leg axolotl still swims into the strongest gust.
 * Distinct from the pulsing current (pulsingCurrents.ts), which is one fixed band.
 */
import type { ElementSpawn, ElementType, GustDirection, WindSpan } from './hazards';
import { legSpeedFactor } from './legs';
import { SWIM, TILAPIA } from './tuning';
import { SURF, WORLD_H, inSafeArea, type Point, type SafeArea } from './zone';

/** Where wind and waves are in their cycle, in cycle order. */
export type WindPhaseName = 'calm' | 'warn' | 'gust';

/** The wind's phase and how far through it, as a share in [0, 1). */
export interface WindPhase {
  phase: WindPhaseName;
  progress: number;
}

/** Wind and waves tuning (issue #211, ND-10 and ND-11). */
export interface WindTuning {
  /** Seconds of calm at the start of each cycle. */
  calmFor: number;
  /** Seconds of ripple warning before each gust: at least the A2 telegraph floor. */
  warnFor: number;
  /** Seconds each gust lasts. */
  gustFor: number;
  /** Speed in px/s a gust adds along x at the surface (SURF) and above. */
  surfaceSpeed: number;
  /** Deepest y at which a spawn's push may fade to nothing; deeper water is always calm. */
  fadeY: number;
  /** Speed in px/s a one-leg axolotl keeps swimming straight into the strongest gust. */
  minHeadway: number;
}

/**
 * Provisional wind and waves values (issue #211, ND-10); tune in play. A 3.0 s calm, a 1.2 s ripple
 * warning, above the A2 0.8 s floor, then a 2.5 s gust. A gust adds 60 px/s at the surface, fading
 * linearly to 0 at y 360, the bottom of the first screen, so depth band 2 is calm. A one-leg axolotl
 * swims at 90 px/s, so it keeps 30 px/s into the strongest gust.
 */
export const WINDS: Readonly<WindTuning> = Object.freeze({
  calmFor: 3.0,
  warnFor: 1.2,
  gustFor: 2.5,
  surfaceSpeed: 60,
  fadeY: WORLD_H,
  minHeadway: 30,
});

/** Seconds in one full cycle: the calm, the warning and the gust. */
export function windPeriod(tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'> = WINDS): number {
  return tuning.calmFor + tuning.warnFor + tuning.gustFor;
}

/**
 * Wind and waves (issue #211, ND-10), a timing element: one cycle every windPeriod seconds, with no
 * fact card and no meet range, so it is never met. `activeFor` equals `period` because the wind's
 * clock always runs. It has no sweep (elementSweep), so the snacks never keep away from it. Each spawn
 * carries its own `wind` span.
 */
export const WIND: Readonly<ElementType> = Object.freeze({
  id: 'wind',
  name: 'Wind and waves',
  kind: 'cycle',
  period: windPeriod(WINDS),
  activeFor: windPeriod(WINDS),
});

/** A wind and waves element, with its span. */
export type WindSpawn = ElementSpawn & { wind: WindSpan };

/** The span a wind spawn is built from: `fadeY` absent means the tuning's `fadeY`. */
export type WindSpanInput = Omit<WindSpan, 'fadeY'> & { fadeY?: number };

/** Speed in px/s a one-leg axolotl keeps swimming straight into a gust at the surface. */
export function oneLegHeadway(tuning: Pick<WindTuning, 'surfaceSpeed'> = WINDS): number {
  return SWIM.maxSpeed * legSpeedFactor(1) - tuning.surfaceSpeed;
}

/** Throws RangeError when the tuning's warning is under the A2 floor or a one-leg axolotl keeps under `minHeadway`. */
function checkWindTuning(id: string, tuning: Readonly<WindTuning>): void {
  if (!(tuning.warnFor >= TILAPIA.minWindup)) {
    throw new RangeError(`windSpawn: ${id} warning ${tuning.warnFor} s is under the ${TILAPIA.minWindup} s floor`);
  }
  const headway = oneLegHeadway(tuning);
  if (!(headway >= tuning.minHeadway)) {
    throw new RangeError(`windSpawn: ${id} leaves a one-leg axolotl ${headway} px/s, under ${tuning.minHeadway} px/s`);
  }
}

/**
 * A wind and waves element (WIND) over `span`, `offset` seconds into its cycle clock. Throws
 * RangeError for a span that is not finite or has x0 not under x1, a fade depth not finite, not
 * below SURF or deeper than the tuning's `fadeY`, a direction that is not 'left' or 'right', an
 * offset that is not finite, or a tuning whose warning is under the A2 floor or that leaves a one-leg
 * axolotl under its `minHeadway` into the strongest gust.
 */
export function windSpawn(
  id: string,
  offset: number,
  span: Readonly<WindSpanInput>,
  tuning: Readonly<WindTuning> = WINDS,
): WindSpawn {
  const { x0, x1, direction } = span;
  const fadeY = span.fadeY ?? tuning.fadeY;
  if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x0 < x1)) {
    throw new RangeError(`windSpawn: ${id} needs a finite span with x0 < x1, got ${x0}..${x1}`);
  }
  if (!Number.isFinite(fadeY) || !(fadeY > SURF) || fadeY > tuning.fadeY) {
    throw new RangeError(`windSpawn: ${id} fadeY must be over ${SURF} and at most ${tuning.fadeY}, got ${fadeY}`);
  }
  if (direction !== 'left' && direction !== 'right') {
    throw new RangeError(`windSpawn: ${id} direction must be left or right, got ${String(direction)}`);
  }
  if (!Number.isFinite(offset)) {
    throw new RangeError(`windSpawn: ${id} offset must be finite, got ${offset}`);
  }
  checkWindTuning(id, tuning);
  return { id, type: WIND, offset, wind: { x0, x1, fadeY, direction } };
}

/** True when the element is wind and waves: it has a wind span. */
export function isWind(element: Readonly<ElementSpawn>): element is Readonly<WindSpawn> {
  return element.wind !== undefined;
}

/** The elements that are wind and waves, in element order. */
export function winds(elements: readonly Readonly<ElementSpawn>[]): Readonly<WindSpawn>[] {
  return elements.filter(isWind);
}

/** Seconds into the cycle at element time `t`, in [0, period), counted from the spawn's offset. */
function cycleSeconds(wind: Readonly<WindSpawn>, t: number, tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'>): number {
  const period = windPeriod(tuning);
  const seconds = (t - wind.offset) % period;
  return seconds < 0 ? (seconds + period) % period : seconds;
}

/** The wind's phase at element time `t` and how far through it, as a share in [0, 1). */
export function windPhase(
  wind: Readonly<WindSpawn>,
  t: number,
  tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'> = WINDS,
): WindPhase {
  const seconds = cycleSeconds(wind, t, tuning);
  if (seconds < tuning.calmFor) return { phase: 'calm', progress: seconds / tuning.calmFor };
  const gustStart = tuning.calmFor + tuning.warnFor;
  if (seconds < gustStart) return { phase: 'warn', progress: (seconds - tuning.calmFor) / tuning.warnFor };
  return { phase: 'gust', progress: (seconds - gustStart) / tuning.gustFor };
}

/** True when the wind is gusting at element time `t`. */
export function windGusting(
  wind: Readonly<WindSpawn>,
  t: number,
  tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'> = WINDS,
): boolean {
  return cycleSeconds(wind, t, tuning) >= tuning.calmFor + tuning.warnFor;
}

/**
 * The way the gust of the cycle holding element time `t` blows: the span's `direction` in the cycle
 * that starts at the offset and every second cycle from it, before or after, and the other way in the
 * rest. Its calm and warning share the gust's direction, so the ripples show the coming gust's way.
 */
export function gustDirection(
  wind: Readonly<WindSpawn>,
  t: number,
  tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'> = WINDS,
): GustDirection {
  const { direction } = wind.wind;
  if (Math.floor((t - wind.offset) / windPeriod(tuning)) % 2 === 0) return direction;
  return direction === 'right' ? 'left' : 'right';
}

/**
 * The wind's push in px/s along x at `pos` at element time `t`: + for right, - for left. Full
 * `surfaceSpeed` at SURF and above, fading linearly to 0 at the span's `fadeY`, and 0 below it, outside
 * `x0..x1` (edges inclusive) and outside the gust. Ignores the safe area; addWindForce keeps it calm.
 */
export function windForceAt(
  wind: Readonly<WindSpawn>,
  pos: Readonly<Point>,
  t: number,
  tuning: Readonly<WindTuning> = WINDS,
): number {
  const { x0, x1, fadeY } = wind.wind;
  if (pos.x < x0 || pos.x > x1 || pos.y >= fadeY) return 0;
  if (!windGusting(wind, t, tuning)) return 0;
  const share = Math.min(1, (fadeY - pos.y) / (fadeY - SURF));
  const speed = tuning.surfaceSpeed * share;
  return gustDirection(wind, t, tuning) === 'right' ? speed : -speed;
}

/**
 * Adds to `out.x` the push in px/s of every wind gusting at element time `t` over `pos`, and returns
 * `out`. Inside the safe area, edges included, nothing is added. Elements that are not wind add
 * nothing, so an area with none leaves `out` as it was. Allocates nothing.
 */
export function addWindForce(
  out: Point,
  pos: Readonly<Point>,
  elements: readonly Readonly<ElementSpawn>[],
  t: number,
  safeArea: Readonly<SafeArea>,
  tuning: Readonly<WindTuning> = WINDS,
): Point {
  if (inSafeArea(pos, safeArea)) return out;
  for (const element of elements) {
    if (!isWind(element)) continue;
    out.x += windForceAt(element, pos, t, tuning);
  }
  return out;
}

/** How wind and waves show at one moment (issue #211, ND-11). */
export interface WindPose {
  phase: WindPhaseName;
  /** Share in [0, 1) of the ripple warning gone by; 0 outside the warning. */
  warn: number;
  /** Share in [0, 1) of the gust gone by; 0 outside the gust. */
  gust: number;
  /** The way the cycle's gust blows (gustDirection), shown by the ripples and the gust alike. */
  direction: GustDirection;
  /** 'flow' moves the ripples and gust streaks; 'still' holds them still under reduced motion. */
  motion: 'flow' | 'still';
}

/**
 * The wind's pose at element time `t` for the view. Under reduced motion the ripples and streaks hold
 * still, but the warning and the gust still show, since the push is gameplay.
 */
export function windPose(
  wind: Readonly<WindSpawn>,
  t: number,
  reduced: boolean,
  tuning: Pick<WindTuning, 'calmFor' | 'warnFor' | 'gustFor'> = WINDS,
): WindPose {
  const { phase, progress } = windPhase(wind, t, tuning);
  return {
    phase,
    warn: phase === 'warn' ? progress : 0,
    gust: phase === 'gust' ? progress : 0,
    direction: gustDirection(wind, t, tuning),
    motion: reduced ? 'still' : 'flow',
  };
}
