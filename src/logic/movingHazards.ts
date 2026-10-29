import { GEYSER_FACT, PUNTING_POLE_FACT, STALACTITE_FACT, type FactCard } from './factCards';
import type { HazardRect } from './hazards';
import { PUNTING_POLES, TILAPIA } from './tuning';
import { SURF, type Point } from './zone';

/**
 * Where a moving hazard's shaft starts and which way it goes (issue #77, ND-3): 'surface' comes
 * down from the water surface, 'roof' comes down from a rock roof, and 'floor' goes up from the
 * floor.
 */
export type MovingHazardFrom = 'surface' | 'roof' | 'floor';

/**
 * A moving hazard type (N3, PRD open question 255, ND-8): a straight shaft that comes from its
 * base at its spawn's x on a fixed cycle and costs a leg on touch (A4). The base is the surface,
 * a rock roof or the floor (`from`); the shaft goes down from the surface or a roof and up from the
 * floor. Each cycle runs, from the spawn's offset: `restFor` at rest, `warnFor` warning (the A2
 * telegraph), `jabFor` with the tip going out to its reach at a steady speed, `holdFor` held there,
 * then `liftFor` with the tip going back to the base at a steady speed. The five times fill the
 * period. Every moving hazard type is a danger part (ND-13). `look` names the textures baked for it.
 */
export interface MovingHazardType {
  readonly id: string;
  readonly name: string;
  readonly look: string;
  readonly restFor: number;
  readonly warnFor: number;
  readonly jabFor: number;
  readonly holdFor: number;
  readonly liftFor: number;
  /** Where the shaft starts (issue #77, ND-3); absent means 'surface'. */
  readonly from?: MovingHazardFrom;
  /**
   * Reach in px the tip goes from the base: below the surface or roof, above the floor. Called the
   * depth for every type; a spawn may set its own.
   */
  readonly depth: number;
  /** Shaft half width in px. */
  readonly halfWidth: number;
  /** Distance in px from the shaft within which the body centre touches it (inclusive). */
  readonly touchReach: number;
  /** Range in px from the sweep within which the axolotl meets the hazard, unlocking `fact`. */
  readonly meetRange: number;
  readonly fact: FactCard;
  readonly dangerPart: true;
}

/** One moving hazard in area data (ND-8). Build it with movingHazardSpawn(). */
export interface MovingHazardSpawn {
  readonly id: string;
  readonly type: MovingHazardType;
  /** World x of the shaft's centre line. */
  readonly x: number;
  /** Seconds of hazard time at which the cycle starts (the start of the rest). */
  readonly offset: number;
  /** This spawn's own depth in px from its base; absent means `type.depth`. */
  readonly depth?: number;
  /**
   * World y of the base for a roof or floor type: the roof line it hangs from or the floor it
   * stands on (issue #77, ND-3). Absent for a surface type, whose base is the surface.
   */
  readonly baseY?: number;
}

/** Where a moving hazard is in its cycle, in cycle order. */
export type MovingHazardPhaseName = 'rest' | 'warn' | 'jab' | 'hold' | 'lift';

/** A moving hazard's phase and how far through it, as a share in [0, 1). */
export interface MovingHazardPhase {
  phase: MovingHazardPhaseName;
  progress: number;
}

/** The shortest warning in seconds: the A2 telegraph floor, the predators' minWindup. */
const WARN_FLOOR = TILAPIA.minWindup;

/** The punting pole (ND-9, ND-10): a trajinera's pole jabbing down from the surface. */
export const PUNTING_POLE: Readonly<MovingHazardType> = Object.freeze({
  id: 'punting-pole',
  name: 'Punting pole',
  look: 'punting-pole',
  restFor: PUNTING_POLES.restFor,
  warnFor: PUNTING_POLES.warnFor,
  jabFor: PUNTING_POLES.jabFor,
  holdFor: PUNTING_POLES.holdFor,
  liftFor: PUNTING_POLES.liftFor,
  depth: PUNTING_POLES.depth,
  halfWidth: PUNTING_POLES.halfWidth,
  touchReach: PUNTING_POLES.touchReach,
  meetRange: PUNTING_POLES.meetRange,
  fact: PUNTING_POLE_FACT,
  dangerPart: true,
});

/**
 * The stalactite drip (issue #77, ND-3, option B): a stream of drips falling from a stalactite's
 * tip under a rock roof on a fixed cycle; the whole stream touches. Provisional values; tune in
 * play. The same 4 s cycle and the same 1.0 s warning as the punting pole, with a 0.4 s fall, a
 * 1.2 s hold and a 0.4 s stop, so the stream is out 2.0 s of every 4 s. It is wider than the pole
 * (halfWidth 8, a 16 px stream) and falls 216 px by default, so a spawn under a roof reaches down
 * into the lane below it.
 */
export const STALACTITE_DRIP: Readonly<MovingHazardType> = Object.freeze({
  id: 'stalactite-drip',
  name: 'Stalactite drip',
  look: 'stalactite-drip',
  restFor: 1.0,
  warnFor: 1.0,
  jabFor: 0.4,
  holdFor: 1.2,
  liftFor: 0.4,
  from: 'roof',
  depth: 216,
  halfWidth: 8,
  touchReach: 18,
  meetRange: 180,
  fact: STALACTITE_FACT,
  dangerPart: true,
});

/**
 * The geyser vent (issue #77, ND-3, option B): a vent on the floor bursting a column of water and
 * bubbles up to its height on a fixed cycle; the whole column touches. Provisional values; tune in
 * play. A 5.2 s cycle with a longer warning (1.2 s) than the pole's, as it bursts up from below, a
 * 0.4 s burst, a 1.6 s hold and a 0.6 s fall back, so the column is out 2.6 s of every 5.2 s. The
 * column is wider than the drip stream (halfWidth 12, a 24 px column) and bursts 240 px by default.
 */
export const GEYSER_VENT: Readonly<MovingHazardType> = Object.freeze({
  id: 'geyser-vent',
  name: 'Geyser vent',
  look: 'geyser-vent',
  restFor: 1.4,
  warnFor: 1.2,
  jabFor: 0.4,
  holdFor: 1.6,
  liftFor: 0.6,
  from: 'floor',
  depth: 240,
  halfWidth: 12,
  touchReach: 18,
  meetRange: 180,
  fact: GEYSER_FACT,
  dangerPart: true,
});

/** Seconds in one full cycle: the sum of the five phase times. */
export function movingHazardPeriod(type: Readonly<MovingHazardType>): number {
  return type.restFor + type.warnFor + type.jabFor + type.holdFor + type.liftFor;
}

/** The spawn's depth in px from its base: its own when set, else its type's. */
export function movingHazardDepth(spawn: Readonly<MovingHazardSpawn>): number {
  return spawn.depth ?? spawn.type.depth;
}

/** Where the type's shaft starts: its own `from`, else 'surface'. */
export function movingHazardFrom(type: Readonly<MovingHazardType>): MovingHazardFrom {
  return type.from ?? 'surface';
}

/** World y of the spawn's base: the surface for a surface type, else the spawn's `baseY`. */
export function movingHazardBaseY(spawn: Readonly<MovingHazardSpawn>): number {
  return spawn.baseY ?? SURF;
}

/** Which way the spawn's shaft goes from its base, as a sign of y: 1 down (surface, roof), -1 up (floor). */
export function movingHazardDirection(spawn: Readonly<MovingHazardSpawn>): 1 | -1 {
  return movingHazardFrom(spawn.type) === 'floor' ? -1 : 1;
}

/**
 * A moving hazard spawn for area data (ND-8). `offset` is the hazard time at which the cycle
 * starts; any offset is valid. `depth`, when given, overrides the type's depth for this spawn only.
 * `baseY` is the world y of the base: needed for a roof or floor type, refused for a surface type
 * (issue #77, ND-3). Throws RangeError when `type.warnFor` is under the A2 floor (0.8 s), any phase
 * time is negative or not a number, the period is not above 0, the depth is not above 0, or the
 * base is missing, not finite or given to a surface type.
 */
export function movingHazardSpawn(
  id: string,
  type: Readonly<MovingHazardType>,
  x: number,
  offset: number,
  depth?: number,
  baseY?: number,
): MovingHazardSpawn {
  const times = [type.restFor, type.warnFor, type.jabFor, type.holdFor, type.liftFor];
  if (!times.every((seconds) => seconds >= 0)) {
    throw new RangeError(`movingHazardSpawn ${id}: phase times ${times.join(', ')} must all be at least 0`);
  }
  const period = movingHazardPeriod(type);
  if (!(period > 0)) {
    throw new RangeError(`movingHazardSpawn ${id}: period ${period} must be greater than 0`);
  }
  if (!(type.warnFor >= WARN_FLOOR)) {
    throw new RangeError(`movingHazardSpawn ${id}: warnFor ${type.warnFor} must be at least ${WARN_FLOOR}`);
  }
  const effectiveDepth = depth ?? type.depth;
  if (!(effectiveDepth > 0)) {
    throw new RangeError(`movingHazardSpawn ${id}: depth ${effectiveDepth} must be greater than 0`);
  }
  checkBaseY(id, type, baseY);
  const spawn: MovingHazardSpawn = depth === undefined ? { id, type, x, offset } : { id, type, x, offset, depth };
  return baseY === undefined ? spawn : { ...spawn, baseY };
}

/** Throws RangeError unless a surface type has no `baseY` and a roof or floor type has a finite one. */
function checkBaseY(id: string, type: Readonly<MovingHazardType>, baseY: number | undefined): void {
  const from = movingHazardFrom(type);
  if (from === 'surface') {
    if (baseY !== undefined) throw new RangeError(`movingHazardSpawn ${id}: a surface hazard starts at the surface, so it takes no baseY`);
    return;
  }
  if (baseY === undefined || !Number.isFinite(baseY)) {
    throw new RangeError(`movingHazardSpawn ${id}: a ${from} hazard needs a finite baseY, got ${baseY}`);
  }
}

/** Seconds into the cycle at `hazardTime`, in [0, period), counted from the spawn's offset. */
function cycleSeconds(spawn: Readonly<MovingHazardSpawn>, hazardTime: number): number {
  const period = movingHazardPeriod(spawn.type);
  const seconds = (hazardTime - spawn.offset) % period;
  return seconds < 0 ? (seconds + period) % period : seconds;
}

/** The tip's depth in px from the base `seconds` into the cycle, for a hazard reaching `depth`. */
function tipDepthAt(type: Readonly<MovingHazardType>, depth: number, seconds: number): number {
  const jabStart = type.restFor + type.warnFor;
  if (seconds < jabStart) return 0;
  const holdStart = jabStart + type.jabFor;
  if (seconds < holdStart) return (depth * (seconds - jabStart)) / type.jabFor;
  const liftStart = holdStart + type.holdFor;
  if (seconds < liftStart) return depth;
  return depth * (1 - (seconds - liftStart) / type.liftFor);
}

/** The hazard's phase at `hazardTime` and how far through it, as a share in [0, 1). */
export function movingHazardPhase(spawn: Readonly<MovingHazardSpawn>, hazardTime: number): MovingHazardPhase {
  const { restFor, warnFor, jabFor, holdFor, liftFor } = spawn.type;
  const seconds = cycleSeconds(spawn, hazardTime);
  const warnStart = restFor;
  const jabStart = warnStart + warnFor;
  const holdStart = jabStart + jabFor;
  const liftStart = holdStart + holdFor;
  if (seconds < warnStart) return { phase: 'rest', progress: seconds / restFor };
  if (seconds < jabStart) return { phase: 'warn', progress: (seconds - warnStart) / warnFor };
  if (seconds < holdStart) return { phase: 'jab', progress: (seconds - jabStart) / jabFor };
  if (seconds < liftStart) return { phase: 'hold', progress: (seconds - holdStart) / holdFor };
  return { phase: 'lift', progress: (seconds - liftStart) / liftFor };
}

/**
 * The tip's depth in px from the base at `hazardTime`: 0 at rest and during the warning, going out
 * at a steady speed to the depth over the jab, the depth through the hold, and back to the base at
 * a steady speed over the lift.
 */
export function movingHazardTipDepth(spawn: Readonly<MovingHazardSpawn>, hazardTime: number): number {
  return tipDepthAt(spawn.type, movingHazardDepth(spawn), cycleSeconds(spawn, hazardTime));
}

/**
 * The world point of the tip at `hazardTime`: the spawn's x, its depth from the base the way the
 * shaft goes (down from the surface or a roof, up from the floor). At the base at rest and during
 * the warning.
 */
export function movingHazardTip(spawn: Readonly<MovingHazardSpawn>, hazardTime: number): Point {
  return { x: spawn.x, y: movingHazardBaseY(spawn) + movingHazardDirection(spawn) * movingHazardTipDepth(spawn, hazardTime) };
}

/** The rect x ± halfWidth from the base to `reach` px along the shaft's way. */
function shaftRect(spawn: Readonly<MovingHazardSpawn>, reach: number): HazardRect {
  const { halfWidth } = spawn.type;
  const base = movingHazardBaseY(spawn);
  const end = base + movingHazardDirection(spawn) * reach;
  return { kind: 'rect', x0: spawn.x - halfWidth, x1: spawn.x + halfWidth, y0: Math.min(base, end), y1: Math.max(base, end) };
}

/**
 * The shaft at `hazardTime`: the rect x ± halfWidth from the base to the tip. Null at rest and
 * during the warning, when it is out of the water. At the first instant of the jab the rect has no
 * height yet, but it still touches within the touch reach of the base.
 */
export function movingHazardShape(spawn: Readonly<MovingHazardSpawn>, hazardTime: number): HazardRect | null {
  const { type } = spawn;
  const seconds = cycleSeconds(spawn, hazardTime);
  if (seconds < type.restFor + type.warnFor) return null;
  return shaftRect(spawn, tipDepthAt(type, movingHazardDepth(spawn), seconds));
}

/** Every place the shaft can be: the jab rect at full depth, x ± halfWidth from the base. */
export function movingHazardSweep(spawn: Readonly<MovingHazardSpawn>): HazardRect {
  return shaftRect(spawn, movingHazardDepth(spawn));
}

/**
 * True when the body centre `pos` is within the touch reach of the shaft at `hazardTime` (A4),
 * edge inclusive. Never true at rest or during the warning.
 */
export function movingHazardTouches(spawn: Readonly<MovingHazardSpawn>, hazardTime: number, pos: Readonly<Point>): boolean {
  const { type } = spawn;
  const seconds = cycleSeconds(spawn, hazardTime);
  if (seconds < type.restFor + type.warnFor) return false;
  const base = movingHazardBaseY(spawn);
  const tipY = base + movingHazardDirection(spawn) * tipDepthAt(type, movingHazardDepth(spawn), seconds);
  const dx = Math.max(spawn.x - type.halfWidth - pos.x, 0, pos.x - spawn.x - type.halfWidth);
  const dy = Math.max(Math.min(base, tipY) - pos.y, 0, pos.y - Math.max(base, tipY));
  return Math.hypot(dx, dy) <= type.touchReach;
}
