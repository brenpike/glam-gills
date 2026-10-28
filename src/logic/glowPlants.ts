/**
 * Pure dark water and glow-plant rules (issue #77, ND-7 to ND-9): the dark part of an area, the
 * light that shows through it, lighting a glow-plant by touch, what the darkness may hide, the hint
 * towards the nearest unlit plant and the reduced-motion switches. Lit plants are trip state only:
 * the caller holds the lit ids, and a new trip starts with none.
 */
import { GLOW_PLANT, shapeDistance, type ElementSpawn, type GlowPlantSpot } from './hazards';
import { GHOST_NETS } from './tuning';
import type { Point, SwimBounds } from './zone';

/** The dark part of an area (issue #77, ND-7), in world px. Inclusive edges; `x0 < x1` and `y0 < y1`. */
export interface DarkWater {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** One soft circle of light through the dark water, centred on (`x`, `y`). Inclusive edge. */
export interface DarkLight {
  x: number;
  y: number;
  radius: number;
}

/** Glow-plant and dark water tuning (issue #77, ND-7 and ND-8). */
export interface GlowPlantTuning {
  /** Radius in px of the axolotl's own glow, always on, round its body centre. */
  axolotlGlow: number;
  /** Radius in px of the light round each lit glow-plant. */
  plantLight: number;
  /** Radius in px of the exit's faint glow. */
  exitGlow: number;
  /** Distance in px from the body centre to the body edge that touches a plant. */
  bodyReach: number;
  /** Seconds in the dark with no new plant lit before the hint shows. */
  hintAfter: number;
  /** Seconds over which a new light grows in with full motion. */
  lightFadeIn: number;
}

/**
 * Provisional glow-plant values (issue #77, ND-7 and ND-8); tune in play. The axolotl glows about
 * 120 px round its body centre and a lit plant about 200 px round its own centre. The exit's faint
 * glow, 160 px round the exit, covers the exit's 40 px circle with room for its gate. bodyReach is
 * the ghost net reach, the Medium body's half height, as for the mats. The hint shows after 20 s.
 */
export const GLOW_PLANTS: Readonly<GlowPlantTuning> = Object.freeze({
  axolotlGlow: 120,
  plantLight: 200,
  exitGlow: 160,
  bodyReach: GHOST_NETS.reach,
  hintAfter: 20,
  lightFadeIn: 0.5,
});

/**
 * Every part of the swim view, for the dark water rule (issue #77, ND-7). Only scenery, snacks,
 * treasure spots, their hint sparkles and finds may be hidden; everything else always shows.
 */
export type DarkWaterPart =
  | 'scenery'
  | 'snack'
  | 'treasure-spot'
  | 'hint-sparkle'
  | 'find'
  | 'axolotl'
  | 'exit'
  | 'home-spot'
  | 'predator'
  | 'moving-hazard'
  | 'warning'
  | 'stranded-axolotl'
  | 'glow-plant';

/** The parts the darkness may hide, in DarkWaterPart order (issue #77, ND-7). */
export const DARK_HIDDEN_PARTS: readonly DarkWaterPart[] = Object.freeze([
  'scenery',
  'snack',
  'treasure-spot',
  'hint-sparkle',
  'find',
]);

/** The parts the darkness never hides, in DarkWaterPart order (issue #77, ND-7 and ND-9). */
export const DARK_SHOWN_PARTS: readonly DarkWaterPart[] = Object.freeze([
  'axolotl',
  'exit',
  'home-spot',
  'predator',
  'moving-hazard',
  'warning',
  'stranded-axolotl',
  'glow-plant',
]);

/** How the glow-plants move under the reduced-motion preference (issue #77, ND-8 and ND-18). */
export interface GlowMotion {
  /** Seconds over which a new light grows in; 0 means it appears at once. */
  lightFadeIn: number;
  /** How the hinted plant shows: a gentle pulse, or under reduced motion a brighter outline. */
  hint: 'pulse' | 'brighten';
}

/** One step of the hint clock (issue #77, ND-8). */
export interface DarkHintStep {
  /** Game seconds since the last step; at least 0. */
  dt: number;
  /** True when the axolotl's body centre is in the dark water (inDarkWater). */
  inDark: boolean;
  /** True when this step lit a plant that was unlit. */
  newLight: boolean;
  /** True while the clock holds: the game is paused, the banking card is up or the carry home runs. */
  paused: boolean;
}

/** The input to darkLights: the axolotl's body centre, the exit's centre, the elements and the lit plant ids. */
export interface DarkLightSource {
  axolotl: Readonly<Point>;
  exit: Readonly<Point>;
  elements: readonly Readonly<ElementSpawn>[];
  lit: readonly string[];
}

/** True when `pos` is in the dark water (edges inclusive). */
export function inDarkWater(pos: Readonly<Point>, dark: Readonly<DarkWater>): boolean {
  return pos.x >= dark.x0 && pos.x <= dark.x1 && pos.y >= dark.y0 && pos.y <= dark.y1;
}

/** True when the darkness may hide `part` (issue #77, ND-7). */
export function darknessMayHide(part: DarkWaterPart): boolean {
  return DARK_HIDDEN_PARTS.includes(part);
}

/** True when `pos` is within any of the lights (edges inclusive). */
export function litByAny(pos: Readonly<Point>, lights: readonly Readonly<DarkLight>[]): boolean {
  return lights.some((light) => Math.hypot(pos.x - light.x, pos.y - light.y) <= light.radius);
}

/**
 * True when `part` at `pos` shows: the darkness may not hide it, the area has no dark water
 * (`dark` undefined), `pos` is outside the dark water, or a light reaches `pos`.
 */
export function shownInDark(
  part: DarkWaterPart,
  pos: Readonly<Point>,
  dark: Readonly<DarkWater> | undefined,
  lights: readonly Readonly<DarkLight>[],
): boolean {
  if (!darknessMayHide(part) || dark === undefined || !inDarkWater(pos, dark)) return true;
  return litByAny(pos, lights);
}

/**
 * A glow-plant element at (`spot.x`, `spot.y`), always active (GLOW_PLANT). Throws RangeError for a
 * non-finite place or a radius that is not greater than 0.
 */
export function glowPlantSpawn(id: string, spot: Readonly<GlowPlantSpot>): ElementSpawn {
  if (!Number.isFinite(spot.x) || !Number.isFinite(spot.y)) {
    throw new RangeError(`glowPlantSpawn: ${id} needs a finite place, got (${spot.x}, ${spot.y})`);
  }
  if (!(spot.radius > 0) || !Number.isFinite(spot.radius)) {
    throw new RangeError(`glowPlantSpawn: ${id} radius must be > 0, got ${spot.radius}`);
  }
  return { id, type: GLOW_PLANT, offset: 0, glowPlant: { x: spot.x, y: spot.y, radius: spot.radius } };
}

/** The elements that are glow-plants, in element order, with their geometry. */
export function glowPlants(
  elements: readonly Readonly<ElementSpawn>[],
): (Readonly<ElementSpawn> & { readonly glowPlant: Readonly<GlowPlantSpot> })[] {
  return elements.filter(
    (element): element is Readonly<ElementSpawn> & { readonly glowPlant: Readonly<GlowPlantSpot> } =>
      element.glowPlant !== undefined,
  );
}

/** True when the axolotl's body centred on `pos` touches the plant (edge inclusive). */
export function touchesGlowPlant(
  pos: Readonly<Point>,
  spot: Readonly<GlowPlantSpot>,
  tuning: Pick<GlowPlantTuning, 'bodyReach'> = GLOW_PLANTS,
): boolean {
  return Math.hypot(pos.x - spot.x, pos.y - spot.y) <= spot.radius + tuning.bodyReach;
}

/**
 * `lit` with the id of every unlit glow-plant the body at `pos` touches appended, in element order.
 * Returns `lit` itself when no new plant is touched, so it can run every swimming frame. A lit plant
 * stays lit: no id is ever removed.
 */
export function lightGlowPlants(
  lit: readonly string[],
  elements: readonly Readonly<ElementSpawn>[],
  pos: Readonly<Point>,
  tuning: Pick<GlowPlantTuning, 'bodyReach'> = GLOW_PLANTS,
): readonly string[] {
  const touched = glowPlants(elements)
    .filter((plant) => !lit.includes(plant.id) && touchesGlowPlant(pos, plant.glowPlant, tuning))
    .map((plant) => plant.id);
  return touched.length === 0 ? lit : [...lit, ...touched];
}

/**
 * The lights through the dark water: the axolotl's own glow, the exit's faint glow, then one light
 * for each lit glow-plant, in element order. A lit id that names no glow-plant adds nothing.
 */
export function darkLights(
  source: Readonly<DarkLightSource>,
  tuning: Pick<GlowPlantTuning, 'axolotlGlow' | 'exitGlow' | 'plantLight'> = GLOW_PLANTS,
): DarkLight[] {
  const plantLights = glowPlants(source.elements)
    .filter((plant) => source.lit.includes(plant.id))
    .map((plant): DarkLight => ({ x: plant.glowPlant.x, y: plant.glowPlant.y, radius: tuning.plantLight }));
  return [
    { x: source.axolotl.x, y: source.axolotl.y, radius: tuning.axolotlGlow },
    { x: source.exit.x, y: source.exit.y, radius: tuning.exitGlow },
    ...plantLights,
  ];
}

/**
 * The hint clock after one step (issue #77, ND-8): seconds in the dark with no new plant lit. It
 * holds while paused, goes back to 0 when the axolotl is out of the dark or lights a new plant, and
 * otherwise adds `dt`. Throws RangeError for a negative or non-finite `dt`.
 */
export function stepDarkHintClock(seconds: number, step: Readonly<DarkHintStep>): number {
  if (!(step.dt >= 0) || !Number.isFinite(step.dt)) {
    throw new RangeError(`stepDarkHintClock: dt must be a finite number >= 0, got ${step.dt}`);
  }
  if (step.paused) return seconds;
  if (!step.inDark || step.newLight) return 0;
  return seconds + step.dt;
}

/**
 * The id of the glow-plant the hint points at (issue #77, ND-8): once the hint clock reaches
 * `hintAfter`, the unlit plant nearest the axolotl at `pos` by centre distance, the first in
 * element order on a tie. Null before then, or when every plant is lit.
 */
export function darkHintPlant(
  seconds: number,
  pos: Readonly<Point>,
  elements: readonly Readonly<ElementSpawn>[],
  lit: readonly string[],
  tuning: Pick<GlowPlantTuning, 'hintAfter'> = GLOW_PLANTS,
): string | null {
  if (seconds < tuning.hintAfter) return null;
  let nearest: string | null = null;
  let nearestDistance = Infinity;
  for (const plant of glowPlants(elements)) {
    if (lit.includes(plant.id)) continue;
    const distance = Math.hypot(pos.x - plant.glowPlant.x, pos.y - plant.glowPlant.y);
    if (distance < nearestDistance) {
      nearest = plant.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** The glow-plant motion for the reduced-motion preference (issue #77, ND-18). */
export function glowMotion(reduced: boolean, tuning: Pick<GlowPlantTuning, 'lightFadeIn'> = GLOW_PLANTS): GlowMotion {
  return reduced ? { lightFadeIn: 0, hint: 'brighten' } : { lightFadeIn: tuning.lightFadeIn, hint: 'pulse' };
}

/**
 * How far a light lit `sinceLit` seconds ago has grown in, from 0 to 1: at once under a 0 s fade
 * (reduced motion), else linearly over `motion.lightFadeIn`. Throws RangeError for a negative or
 * non-finite `sinceLit`.
 */
export function lightShare(sinceLit: number, motion: Readonly<GlowMotion>): number {
  if (!(sinceLit >= 0) || !Number.isFinite(sinceLit)) {
    throw new RangeError(`lightShare: sinceLit must be a finite number >= 0, got ${sinceLit}`);
  }
  if (motion.lightFadeIn <= 0) return 1;
  return Math.min(1, sinceLit / motion.lightFadeIn);
}

/**
 * True when anything that comes within `reachPx` of the axolotl's body centre is inside its own glow
 * at least one step sooner (issue #77, ND-9): `reachPx` plus the most the gap can close in one
 * step, `closingStepPx`, is under the glow radius.
 */
export function glowShowsBeforeReach(
  reachPx: number,
  closingStepPx: number,
  tuning: Pick<GlowPlantTuning, 'axolotlGlow'> = GLOW_PLANTS,
): boolean {
  return reachPx + closingStepPx < tuning.axolotlGlow;
}

/**
 * True when a body centre inside `bounds` can touch the plant (issue #77, ND-9): the plant's touch
 * circle meets the swim bounds.
 */
export function glowPlantReachable(
  spot: Readonly<GlowPlantSpot>,
  bounds: Readonly<SwimBounds>,
  tuning: Pick<GlowPlantTuning, 'bodyReach'> = GLOW_PLANTS,
): boolean {
  const box = { kind: 'rect', x0: bounds.minX, x1: bounds.maxX, y0: bounds.minY, y1: bounds.maxY } as const;
  return shapeDistance(spot, box) <= spot.radius + tuning.bodyReach;
}
