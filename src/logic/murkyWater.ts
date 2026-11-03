/**
 * Pure murky water rules (issue #107, ND-1): fixed patches of dirty water that the axolotl swims
 * through. A patch is a hazard type that never costs a leg on touch and touches nothing, so it is
 * never a touch hit, never a risk threat for hiding spots, never a danger-bar threat and never a gap
 * obstacle. Its cost comes from staying in: the murky timer builds while the axolotl's centre is in a
 * patch, warns at 2 s and asks for one hit through the shared hit path at 3 s, then restarts at 0.
 * One second in clean water resets the timer to 0; a shorter time out holds it where it is.
 */
import { MURKY_WATER_FACT, MURKY_WATER_MEET_RANGE } from './factCards';
import type { HazardRect, HazardSpawn, HazardType } from './hazards';
import { legSpeedFactor } from './legs';
import { SWIM } from './tuning';
import type { Point } from './zone';

/** Murky timer tuning (issue #107, ND-1). */
export interface MurkyWaterTuning {
  /** Seconds of built time at which the warning shows. */
  warnAt: number;
  /** Seconds of built time at which one hit is due. */
  legAt: number;
  /** Seconds in clean water after which the built time resets to 0. */
  clearAfter: number;
}

/**
 * Provisional murky timer values (issue #107, ND-1); tune in play. The warning shows at 2 s, a hit is
 * due at 3 s and 1 s in clean water clears the timer.
 */
export const MURKY_WATER_TIMING: Readonly<MurkyWaterTuning> = Object.freeze({
  warnAt: 2,
  legAt: 3,
  clearAfter: 1,
});

/**
 * The murky water hazard type (issue #107, ND-1): never costs a leg on touch and touches nothing
 * (reach 0). It is met once the axolotl's centre is in a patch (meet range 0), outside the Home Spot
 * as metThreatIds rules, with the "Dirty water" card.
 */
export const MURKY_WATER: Readonly<HazardType> = Object.freeze({
  id: 'murky-water',
  name: 'Murky water',
  costsLeg: false,
  reach: 0,
  meetRange: MURKY_WATER_MEET_RANGE,
  fact: MURKY_WATER_FACT,
});

/** A hazard spawn that is a murky patch: its rect. */
export type MurkyPatchSpawn = HazardSpawn & { readonly shape: HazardRect };

/**
 * A murky patch spawn for area data (issue #107): the rect from `x0` to `x1` and `y0` to `y1`.
 * Throws RangeError when the rect is empty or not finite.
 */
export function murkyPatchSpawn(id: string, rect: Readonly<Omit<HazardRect, 'kind'>>): MurkyPatchSpawn {
  const { x0, x1, y0, y1 } = rect;
  if (![x0, x1, y0, y1].every(Number.isFinite) || !(x0 < x1) || !(y0 < y1)) {
    throw new RangeError(`murkyPatchSpawn ${id}: rect x ${x0}..${x1}, y ${y0}..${y1} must be finite and not empty`);
  }
  return { id, type: MURKY_WATER, shape: { kind: 'rect', x0, x1, y0, y1 } };
}

/** True when the hazard is a murky patch: its type is murky water and its shape a rect. */
export function isMurkyPatch(hazard: Readonly<HazardSpawn>): hazard is Readonly<MurkyPatchSpawn> {
  return hazard.type.id === MURKY_WATER.id && hazard.shape.kind === 'rect';
}

/** The hazards that are murky patches, in hazard order. */
export function murkyPatches(hazards: readonly Readonly<HazardSpawn>[]): Readonly<MurkyPatchSpawn>[] {
  return hazards.filter(isMurkyPatch);
}

/** True when `pos` is in the patch, edges inclusive. */
function inPatch(pos: Readonly<Point>, { shape }: Readonly<MurkyPatchSpawn>): boolean {
  return pos.x >= shape.x0 && pos.x <= shape.x1 && pos.y >= shape.y0 && pos.y <= shape.y1;
}

/** True when `pos`, the axolotl's centre, is in some patch, edges inclusive. */
export function insideMurky(pos: Readonly<Point>, patches: readonly Readonly<MurkyPatchSpawn>[]): boolean {
  for (const patch of patches) if (inPatch(pos, patch)) return true;
  return false;
}

/** True when some hazard is a murky patch. Allocates nothing, so it can run every step. */
export function hasMurkyPatch(hazards: readonly Readonly<HazardSpawn>[]): boolean {
  for (const hazard of hazards) if (isMurkyPatch(hazard)) return true;
  return false;
}

/**
 * The first murky patch among `hazards`, in hazard order, that holds `pos` (the axolotl's centre),
 * edges inclusive, else undefined. Allocates nothing, so it can run every step.
 */
export function murkyPatchAt(
  pos: Readonly<Point>,
  hazards: readonly Readonly<HazardSpawn>[],
): Readonly<MurkyPatchSpawn> | undefined {
  for (const hazard of hazards) if (isMurkyPatch(hazard) && inPatch(pos, hazard)) return hazard;
  return undefined;
}

/**
 * Seconds a one-leg axolotl's centre takes to swim straight across a patch `width` px wide, at the
 * one-leg top speed. Throws RangeError when `width` is negative or not finite.
 */
export function murkyCrossSeconds(width: number): number {
  if (!Number.isFinite(width) || width < 0) {
    throw new RangeError(`murkyCrossSeconds: width must be finite and at least 0, got ${width}`);
  }
  return width / (SWIM.maxSpeed * legSpeedFactor(1));
}

/** The murky timer (issue #107, ND-1). */
export interface MurkyTimer {
  /** Seconds built up in murky water since the last reset. */
  readonly built: number;
  /** Seconds in clean water since the axolotl last swam in murky water. */
  readonly clean: number;
}

/** One step of the murky timer: the timer after the step and what it shows. */
export interface MurkyStep {
  timer: MurkyTimer;
  /** True when the built time is at or past the warning. */
  warning: boolean;
  /** True on the step whose built time reached the hit; the timer has restarted at 0. */
  legDue: boolean;
  /** The meter's share: built time over the hit time, clamped to 0..1. */
  meter: number;
}

/** A fresh murky timer: nothing built and no clean time. */
export function createMurkyTimer(): MurkyTimer {
  return { built: 0, clean: 0 };
}

/**
 * Steps the murky timer by `dt` seconds (issue #107, ND-1). A protected or tossed step holds the timer
 * as it is. Else, `inside` a patch, the built time grows by `dt` and the clean time is 0; at
 * `legAt` one hit is due and the built time restarts at 0. Outside, the clean time grows by `dt`,
 * and once it reaches `clearAfter` the built time resets to 0; before then it holds, with no drain.
 * Throws RangeError when `dt` is negative or not finite.
 */
export function stepMurkyTimer(
  timer: Readonly<MurkyTimer>,
  inside: boolean,
  dt: number,
  isProtected: boolean,
  tuning: Readonly<MurkyWaterTuning> = MURKY_WATER_TIMING,
): MurkyStep {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError(`stepMurkyTimer: dt must be finite and at least 0, got ${dt}`);
  }
  const next = isProtected ? { built: timer.built, clean: timer.clean } : swimMurkyTimer(timer, inside, dt, tuning);
  const legDue = !isProtected && inside && timer.built + dt >= tuning.legAt;
  return {
    timer: next,
    warning: next.built >= tuning.warnAt,
    legDue,
    meter: Math.min(1, Math.max(0, next.built / tuning.legAt)),
  };
}

/** The timer after one swimming step: built time in murky water, clean time out of it. */
function swimMurkyTimer(timer: Readonly<MurkyTimer>, inside: boolean, dt: number, tuning: Readonly<MurkyWaterTuning>): MurkyTimer {
  if (inside) {
    const built = timer.built + dt;
    return { built: built >= tuning.legAt ? 0 : built, clean: 0 };
  }
  const clean = timer.clean + dt;
  return { built: clean >= tuning.clearAfter ? 0 : timer.built, clean };
}
