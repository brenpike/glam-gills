/**
 * Pure fading light rules (issue #212, ND-7 to ND-10): a puzzle element in the dark water. Touching a
 * light lights it, or relights it to full whether it is lit, dimming or out. A lit light stays fully
 * lit for a while, then dims smoothly and goes out. Light state is trip state only: the caller holds
 * the timers, and a new trip starts with every light unlit. Lighting, relighting and dimming are
 * silent, so there are no sound hooks (issue #212, ND-26). The glow-plant rules (glowPlants.ts) never
 * see a fading light, since it never carries `glowPlant`.
 */
import { GLOW_PLANTS, type DarkLight } from './glowPlants';
import { FADING_LIGHT, FADING_LIGHT_RADIUS, type ElementSpawn, type FadingLightSpot } from './hazards';
import type { Point } from './zone';

/** Fading light tuning (issue #212, ND-7 to ND-10). */
export interface FadingLightTuning {
  /** Radius in px of the light round a fully lit fading light. */
  light: number;
  /** Seconds a light stays fully lit after its last touch. */
  fullFor: number;
  /** Seconds over which a light dims to out after `fullFor`. */
  dimFor: number;
  /** Distance in px from the body centre to the body edge that touches a light. */
  touchReach: number;
  /** Seconds in the dark with no new light before the hint shows. */
  hintAfter: number;
  /** How many steps the light share is quantized into, so the view redraws only on a step change. */
  shareSteps: number;
}

/**
 * Fading light values (issue #212, ND-7 to ND-10): a 200 px light, as a lit glow-plant's, fully lit
 * for 15 s, then a 4 s dim, so a light is out 19 s after its last touch. The touch reach is the
 * glow-plant body reach. The hint shows after 20 s in the dark. The share is drawn in 8 steps.
 */
export const FADING_LIGHTS: Readonly<FadingLightTuning> = Object.freeze({
  light: GLOW_PLANTS.plantLight,
  fullFor: 15,
  dimFor: 4,
  touchReach: GLOW_PLANTS.bodyReach,
  hintAfter: 20,
  shareSteps: 8,
});

/**
 * Seconds left on each touched light, by element id (issue #212, ND-7): from `fullFor + dimFor`
 * at a touch down to 0, when the light is out. An absent id is a light never touched this trip.
 */
export type FadingLightTimers = Readonly<Record<string, number>>;

/** One step of the fading lights (issue #212, ND-7 and ND-8). */
export interface FadingLightStep {
  /** Game seconds since the last step; at least 0. */
  dt: number;
  /** The axolotl's body centre. */
  pos: Readonly<Point>;
  /** True while the timers hold: the game is paused, the banking card is up or the carry home runs. */
  paused: boolean;
}

/** The fading lights after one step. */
export interface FadingLightStepResult {
  timers: FadingLightTimers;
  /** True when this step lit a light that was unlit or out; feed it to stepDarkHintClock. */
  newLight: boolean;
}

/** A fading light element, with its geometry. */
export type FadingLightSpawn = Readonly<ElementSpawn> & { readonly fadingLight: Readonly<FadingLightSpot> };

/** The place a fading light is built from: `radius` absent means FADING_LIGHT_RADIUS. */
export type FadingLightSpotInput = Omit<FadingLightSpot, 'radius'> & { radius?: number };

/**
 * A fading light element at (`spot.x`, `spot.y`), always active (FADING_LIGHT), with no `glowPlant`.
 * Throws RangeError for a non-finite place or a radius that is not greater than 0.
 */
export function fadingLightSpawn(id: string, spot: Readonly<FadingLightSpotInput>): ElementSpawn {
  const radius = spot.radius ?? FADING_LIGHT_RADIUS;
  if (!Number.isFinite(spot.x) || !Number.isFinite(spot.y)) {
    throw new RangeError(`fadingLightSpawn: ${id} needs a finite place, got (${spot.x}, ${spot.y})`);
  }
  if (!(radius > 0) || !Number.isFinite(radius)) {
    throw new RangeError(`fadingLightSpawn: ${id} radius must be > 0, got ${radius}`);
  }
  return { id, type: FADING_LIGHT, offset: 0, fadingLight: { x: spot.x, y: spot.y, radius } };
}

/** The elements that are fading lights, in element order, with their geometry. */
export function fadingLights(elements: readonly Readonly<ElementSpawn>[]): FadingLightSpawn[] {
  return elements.filter((element): element is FadingLightSpawn => element.fadingLight !== undefined);
}

/** True when the axolotl's body centred on `pos` touches the light (edge inclusive). */
export function touchesFadingLight(
  pos: Readonly<Point>,
  spot: Readonly<FadingLightSpot>,
  tuning: Pick<FadingLightTuning, 'touchReach'> = FADING_LIGHTS,
): boolean {
  return Math.hypot(pos.x - spot.x, pos.y - spot.y) <= spot.radius + tuning.touchReach;
}

/** Seconds left on the light `id`: 0 when it is out or was never touched. */
export function fadingLightLeft(timers: FadingLightTimers, id: string): number {
  return timers[id] ?? 0;
}

/**
 * The fading lights after one step (issue #212, ND-7 and ND-8). While paused the timers hold and no
 * touch counts, so `timers` itself comes back. Otherwise every timer counts down by `dt`, never below
 * 0, then every light the body at `pos` touches, lit, dimming or out, is set back to
 * `fullFor + dimFor`. Returns `timers` itself when nothing changes. Throws RangeError for a negative
 * or non-finite `dt`.
 */
export function stepFadingLights(
  timers: FadingLightTimers,
  elements: readonly Readonly<ElementSpawn>[],
  step: Readonly<FadingLightStep>,
  tuning: Pick<FadingLightTuning, 'fullFor' | 'dimFor' | 'touchReach'> = FADING_LIGHTS,
): FadingLightStepResult {
  if (!(step.dt >= 0) || !Number.isFinite(step.dt)) {
    throw new RangeError(`stepFadingLights: dt must be a finite number >= 0, got ${step.dt}`);
  }
  if (step.paused) return { timers, newLight: false };
  const next: Record<string, number> = {};
  let changed = false;
  for (const [id, left] of Object.entries(timers)) {
    next[id] = Math.max(0, left - step.dt);
    if (next[id] !== left) changed = true;
  }
  let newLight = false;
  const full = tuning.fullFor + tuning.dimFor;
  for (const light of fadingLights(elements)) {
    if (!touchesFadingLight(step.pos, light.fadingLight, tuning)) continue;
    if (fadingLightLeft(timers, light.id) <= 0) newLight = true;
    if (next[light.id] !== full) changed = true;
    next[light.id] = full;
  }
  return { timers: changed ? next : timers, newLight };
}

/**
 * How lit a light with `left` seconds left is, from 0 (out) to 1 (fully lit) (issue #212, ND-7 and
 * ND-10). Fully lit while `left` is at least `dimFor`. Then with full motion it falls smoothly to 0,
 * (1 - cos(π · left / dimFor)) / 2; under reduced motion it holds at 0.5 until out. A relight is
 * always instant. Throws RangeError for a negative or non-finite `left`.
 */
export function fadingLightShare(
  left: number,
  reduced: boolean,
  tuning: Pick<FadingLightTuning, 'dimFor'> = FADING_LIGHTS,
): number {
  if (!(left >= 0) || !Number.isFinite(left)) {
    throw new RangeError(`fadingLightShare: left must be a finite number >= 0, got ${left}`);
  }
  if (left <= 0) return 0;
  if (left >= tuning.dimFor) return 1;
  if (reduced) return 0.5;
  return (1 - Math.cos((Math.PI * left) / tuning.dimFor)) / 2;
}

/**
 * The share rounded up to the next of `shareSteps` even steps, so a light keeps at least one step
 * until it is out and the view redraws only when the step changes. Throws RangeError for a share
 * outside [0, 1].
 */
export function quantizeFadingShare(
  share: number,
  tuning: Pick<FadingLightTuning, 'shareSteps'> = FADING_LIGHTS,
): number {
  if (!(share >= 0 && share <= 1)) {
    throw new RangeError(`quantizeFadingShare: share must be in [0, 1], got ${share}`);
  }
  return Math.ceil(share * tuning.shareSteps) / tuning.shareSteps;
}

/**
 * The circles of light round the fading lights for the dark layer (issue #212, ND-7 and ND-10), in
 * element order: each light's centre and `light` scaled by its quantized share. A light that is out
 * or never touched adds nothing.
 */
export function fadingLightCircles(
  elements: readonly Readonly<ElementSpawn>[],
  timers: FadingLightTimers,
  reduced: boolean,
  tuning: Pick<FadingLightTuning, 'light' | 'dimFor' | 'shareSteps'> = FADING_LIGHTS,
): DarkLight[] {
  const circles: DarkLight[] = [];
  for (const light of fadingLights(elements)) {
    const share = quantizeFadingShare(fadingLightShare(fadingLightLeft(timers, light.id), reduced, tuning), tuning);
    if (share > 0) circles.push({ x: light.fadingLight.x, y: light.fadingLight.y, radius: tuning.light * share });
  }
  return circles;
}

/**
 * The id of the fading light the hint points at (issue #212, ND-10), as darkHintPlant does for the
 * glow-plants: once the hint clock (stepDarkHintClock, fed the step's `newLight`) reaches
 * `hintAfter`, the light that is out or never touched nearest the axolotl at `pos` by centre
 * distance, the first in element order on a tie. Null before then, or when no light is out.
 */
export function fadingLightHint(
  seconds: number,
  pos: Readonly<Point>,
  elements: readonly Readonly<ElementSpawn>[],
  timers: FadingLightTimers,
  tuning: Pick<FadingLightTuning, 'hintAfter'> = FADING_LIGHTS,
): string | null {
  if (seconds < tuning.hintAfter) return null;
  let nearest: string | null = null;
  let nearestDistance = Infinity;
  for (const light of fadingLights(elements)) {
    if (fadingLightLeft(timers, light.id) > 0) continue;
    const distance = Math.hypot(pos.x - light.fadingLight.x, pos.y - light.fadingLight.y);
    if (distance < nearestDistance) {
      nearest = light.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}
