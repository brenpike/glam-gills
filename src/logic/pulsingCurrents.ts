/**
 * Pure pulsing current rules (issue #105, ND-5 to ND-7): a spring vent that blows a strong current
 * along a band of water on a cycle. Each cycle runs, from the spawn's offset: `calmFor` calm, the
 * 0.8 s warning, while bubbles build at the vent, then the 1.5 s surge. Only the surge pushes, and it
 * pushes harder than any axolotl swims, so the axolotl crosses between surges. A surge never costs a
 * leg and never starts protected time: the pulsing current is a hazard type that never costs a leg,
 * so it is a threat with a fact card that is met (PRD N2's one new hazard), never a risk threat for
 * hiding spots, never a gap obstacle and never a past-current band.
 *
 * The push stops at the band's edge, since the current is the band only: a surge leaves the axolotl
 * just past the band's downstream edge, where its landing strip is (pulseLandingStrip).
 */
import { UNDERWATER_SPRINGS_FACT, PULSING_CURRENT_MEET_RANGE } from './factCards';
import type { CurrentPulse, HazardRect, HazardSpawn, HazardType, PulseFlow } from './hazards';
import { legSpeedFactor } from './legs';
import { GHOST_NETS, SWIM, TILAPIA } from './tuning';
import type { Point } from './zone';

/** Where a pulsing current is in its cycle, in cycle order. */
export type PulsePhaseName = 'calm' | 'warn' | 'surge';

/** A pulsing current's phase and how far through it, as a share in [0, 1). */
export interface PulsePhase {
  phase: PulsePhaseName;
  progress: number;
}

/** Pulsing current tuning (issue #105, ND-5 and ND-7). */
export interface PulsingCurrentTuning {
  /** Seconds of warning before each surge: the A2 telegraph floor. */
  warnFor: number;
  /** Seconds each surge lasts. */
  surgeFor: number;
  /** Speed in px/s a surge adds to the axolotl's movement, along its flow. */
  surgeSpeed: number;
  /** Shortest calm in seconds a spawn may have. */
  minCalm: number;
  /** Distance in px past the band's downstream edge that a surge's landing strip covers. */
  landingDepth: number;
  /** Distance in px from the body centre to the body edge, for crossing a band clear of it. */
  bodyReach: number;
}

/**
 * Provisional pulsing current values (issue #105, ND-5); tune in play. The owner's 0.8 s warning and
 * 1.5 s surge (#105, 2026-10-22). A surge adds 200 px/s, above the fastest swim, 150 px/s with the
 * speed perk's 15% cap, 172.5 px/s. Tail Dash takes a current at 0.3 of its speed, so a dash still
 * gets through. The shortest calm is 2.0 s, the owner's last. A surge's landing strip is 60 px deep.
 * bodyReach is the ghost net reach, the Medium body's half height.
 */
export const PULSING_CURRENTS: Readonly<PulsingCurrentTuning> = Object.freeze({
  warnFor: TILAPIA.minWindup,
  surgeFor: 1.5,
  surgeSpeed: 200,
  minCalm: 2.0,
  landingDepth: 60,
  bodyReach: GHOST_NETS.reach,
});

/**
 * The pulsing current hazard type (issue #105, ND-6): never costs a leg and touches nothing (reach
 * 0), met within PULSING_CURRENT_MEET_RANGE of its band, with the "Underwater springs" card.
 */
export const PULSING_CURRENT: Readonly<HazardType> = Object.freeze({
  id: 'pulsing-current',
  name: 'Pulsing current',
  costsLeg: false,
  reach: 0,
  meetRange: PULSING_CURRENT_MEET_RANGE,
  fact: UNDERWATER_SPRINGS_FACT,
});

/** A hazard spawn that is a pulsing current: its band and its pulse. */
export type PulsingCurrentSpawn = HazardSpawn & { readonly shape: HazardRect; readonly pulse: CurrentPulse };

/** Seconds a band `length` px along its flow takes a one-leg axolotl to cross, body edge to body edge. */
export function oneLegCrossSeconds(length: number, tuning: Pick<PulsingCurrentTuning, 'bodyReach'> = PULSING_CURRENTS): number {
  return (length + 2 * tuning.bodyReach) / (SWIM.maxSpeed * legSpeedFactor(1));
}

/** The band's length in px along its flow: its width for a left or right flow, else its height. */
export function bandLength(band: Readonly<HazardRect>, flow: PulseFlow): number {
  return flow === 'left' || flow === 'right' ? band.x1 - band.x0 : band.y1 - band.y0;
}

/** Seconds in one full cycle: the calm, the warning and the surge. */
export function pulsePeriod(pulse: Readonly<CurrentPulse>, tuning: Pick<PulsingCurrentTuning, 'warnFor' | 'surgeFor'> = PULSING_CURRENTS): number {
  return pulse.calmFor + tuning.warnFor + tuning.surgeFor;
}

/**
 * A pulsing current spawn for area data (issue #105, ND-5): a band from `x0` to `x1` and `y0` to
 * `y1` with `pulse`. Throws RangeError when the band is empty or not finite, the calm is under
 * PULSING_CURRENTS.minCalm, the offset is not finite, or a one-leg axolotl cannot cross the band
 * in the calm plus the warning.
 */
export function pulsingCurrentSpawn(
  id: string,
  band: Readonly<Omit<HazardRect, 'kind'>>,
  pulse: Readonly<CurrentPulse>,
  tuning: Readonly<PulsingCurrentTuning> = PULSING_CURRENTS,
): PulsingCurrentSpawn {
  const { x0, x1, y0, y1 } = band;
  if (![x0, x1, y0, y1].every(Number.isFinite) || !(x0 < x1) || !(y0 < y1)) {
    throw new RangeError(`pulsingCurrentSpawn ${id}: band x ${x0}..${x1}, y ${y0}..${y1} must be finite and not empty`);
  }
  if (!(pulse.calmFor >= tuning.minCalm) || !Number.isFinite(pulse.calmFor)) {
    throw new RangeError(`pulsingCurrentSpawn ${id}: calmFor ${pulse.calmFor} must be at least ${tuning.minCalm}`);
  }
  if (!Number.isFinite(pulse.offset)) {
    throw new RangeError(`pulsingCurrentSpawn ${id}: offset ${pulse.offset} must be finite`);
  }
  const shape: HazardRect = { kind: 'rect', x0, x1, y0, y1 };
  const crossing = oneLegCrossSeconds(bandLength(shape, pulse.flow), tuning);
  if (crossing > pulse.calmFor + tuning.warnFor) {
    throw new RangeError(
      `pulsingCurrentSpawn ${id}: a one-leg axolotl takes ${crossing} s to cross, more than the ${pulse.calmFor + tuning.warnFor} s calm and warning`,
    );
  }
  return { id, type: PULSING_CURRENT, shape, pulse: { calmFor: pulse.calmFor, flow: pulse.flow, offset: pulse.offset } };
}

/** True when the hazard is a pulsing current: it has a pulse and a band. */
export function isPulsingCurrent(hazard: Readonly<HazardSpawn>): hazard is Readonly<PulsingCurrentSpawn> {
  return hazard.pulse !== undefined && hazard.shape.kind === 'rect';
}

/** The hazards that are pulsing currents, in hazard order. */
export function pulsingCurrents(hazards: readonly Readonly<HazardSpawn>[]): Readonly<PulsingCurrentSpawn>[] {
  return hazards.filter(isPulsingCurrent);
}

/** Seconds into the cycle at `elementTime`, in [0, period), counted from the spawn's offset. */
function cycleSeconds(pulse: Readonly<CurrentPulse>, elementTime: number, tuning: Pick<PulsingCurrentTuning, 'warnFor' | 'surgeFor'>): number {
  const period = pulsePeriod(pulse, tuning);
  const seconds = (elementTime - pulse.offset) % period;
  return seconds < 0 ? (seconds + period) % period : seconds;
}

/** The pulse's phase at `elementTime` and how far through it, as a share in [0, 1). */
export function pulsePhase(
  pulse: Readonly<CurrentPulse>,
  elementTime: number,
  tuning: Pick<PulsingCurrentTuning, 'warnFor' | 'surgeFor'> = PULSING_CURRENTS,
): PulsePhase {
  const seconds = cycleSeconds(pulse, elementTime, tuning);
  if (seconds < pulse.calmFor) return { phase: 'calm', progress: seconds / pulse.calmFor };
  const surgeStart = pulse.calmFor + tuning.warnFor;
  if (seconds < surgeStart) return { phase: 'warn', progress: (seconds - pulse.calmFor) / tuning.warnFor };
  return { phase: 'surge', progress: (seconds - surgeStart) / tuning.surgeFor };
}

/** True when the pulse is surging at `elementTime`. */
export function pulseSurging(
  pulse: Readonly<CurrentPulse>,
  elementTime: number,
  tuning: Pick<PulsingCurrentTuning, 'warnFor' | 'surgeFor'> = PULSING_CURRENTS,
): boolean {
  return cycleSeconds(pulse, elementTime, tuning) >= pulse.calmFor + tuning.warnFor;
}

/** The unit step of a flow: (-1, 0) for left, (1, 0) for right, (0, -1) for up and (0, 1) for down. */
export function flowStep(flow: PulseFlow): Readonly<Point> {
  switch (flow) {
    case 'left':
      return LEFT;
    case 'right':
      return RIGHT;
    case 'up':
      return UP;
    case 'down':
      return DOWN;
  }
}

const LEFT: Readonly<Point> = Object.freeze({ x: -1, y: 0 });
const RIGHT: Readonly<Point> = Object.freeze({ x: 1, y: 0 });
const UP: Readonly<Point> = Object.freeze({ x: 0, y: -1 });
const DOWN: Readonly<Point> = Object.freeze({ x: 0, y: 1 });

/** True when `pos` is in the band, edges inclusive. */
export function inPulseBand(pos: Readonly<Point>, band: Readonly<HazardRect>): boolean {
  return pos.x >= band.x0 && pos.x <= band.x1 && pos.y >= band.y0 && pos.y <= band.y1;
}

/**
 * Adds to `out` the push in px/s of every pulsing current surging at `elementTime` whose band holds
 * `pos`, and returns `out`. Hazards that are not pulsing currents add nothing, so an area with none
 * leaves `out` as it was.
 */
export function addPulseCurrent(
  out: Point,
  pos: Readonly<Point>,
  hazards: readonly Readonly<HazardSpawn>[],
  elementTime: number,
  tuning: Readonly<PulsingCurrentTuning> = PULSING_CURRENTS,
): Point {
  for (const hazard of hazards) {
    if (!isPulsingCurrent(hazard) || !inPulseBand(pos, hazard.shape)) continue;
    if (!pulseSurging(hazard.pulse, elementTime, tuning)) continue;
    const step = flowStep(hazard.pulse.flow);
    out.x += step.x * tuning.surgeSpeed;
    out.y += step.y * tuning.surgeSpeed;
  }
  return out;
}

/**
 * The vent's mouth (issue #105, ND-7): the middle of the band's upstream edge, where the water comes
 * out and the warning bubbles build.
 */
export function ventMouth(spawn: Readonly<PulsingCurrentSpawn>): Point {
  const { x0, x1, y0, y1 } = spawn.shape;
  switch (spawn.pulse.flow) {
    case 'left':
      return { x: x1, y: (y0 + y1) / 2 };
    case 'right':
      return { x: x0, y: (y0 + y1) / 2 };
    case 'up':
      return { x: (x0 + x1) / 2, y: y1 };
    case 'down':
      return { x: (x0 + x1) / 2, y: y0 };
  }
}

/**
 * Where a surge leaves the axolotl (issue #105, ND-5): the strip `landingDepth` px deep just past
 * the band's downstream edge, across the band's whole cross width.
 */
export function pulseLandingStrip(
  spawn: Readonly<PulsingCurrentSpawn>,
  tuning: Pick<PulsingCurrentTuning, 'landingDepth'> = PULSING_CURRENTS,
): HazardRect {
  const { x0, x1, y0, y1 } = spawn.shape;
  const depth = tuning.landingDepth;
  switch (spawn.pulse.flow) {
    case 'left':
      return { kind: 'rect', x0: x0 - depth, x1: x0, y0, y1 };
    case 'right':
      return { kind: 'rect', x0: x1, x1: x1 + depth, y0, y1 };
    case 'up':
      return { kind: 'rect', x0, x1, y0: y0 - depth, y1: y0 };
    case 'down':
      return { kind: 'rect', x0, x1, y0: y1, y1: y1 + depth };
  }
}

/** How a pulsing current shows under the reduced-motion preference (issue #105, ND-7). */
export interface PulseMotion {
  /** The warning's bubbles: rising from the vent, or held still. */
  bubbles: 'rise' | 'still';
  /** The surge: flowing streaks, or the band darkened. */
  surge: 'streaks' | 'darken';
}

/** The pulsing current motion for the reduced-motion preference (issue #105, ND-7). */
export function pulseMotion(reduced: boolean): PulseMotion {
  return reduced ? { bubbles: 'still', surge: 'darken' } : { bubbles: 'rise', surge: 'streaks' };
}
