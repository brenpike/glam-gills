/**
 * The PRD F15 separation rule for Dream colours (issue #215, ND-10, owner decision Q2, 2026-11-07): "A patterned or
 * sheen Dream colour is told apart in greyscale by its own pattern cue, so its body keeps the 1.05:1 greyscale floor
 * only against Dream colours of its own kind; it keeps 0.075 in OKLab from every Dream colour, 1.5:1 from Plum, a sheen
 * 1.5:1 from Iridescent, and every cue check." Pure: the kinds are the catalogue's (solid, patterned or sheen).
 */
import { dreamColourById, type DreamKind } from '../logic/catalogue';
import type { DreamLookId } from './palette';

/** Greyscale floor (WCAG contrast ratio) between two Dream bodies of the same kind. */
export const DREAM_GREYSCALE_FLOOR = 1.05;
/** OKLab difference floor between any two Dream bodies. */
export const DREAM_OKLAB_FLOOR = 0.075;
/** Greyscale margin every Dream body keeps from Plum, and every sheen body from Iridescent. */
export const DREAM_GREYSCALE_MARGIN = 1.5;

/** The catalogue kind of Dream colour `id`; throws for an id the catalogue does not hold. */
export function dreamKind(id: DreamLookId): DreamKind {
  const colour = dreamColourById(id);
  if (!colour) throw new Error(`No catalogue Dream colour with id "${id}"`);
  return colour.kind;
}

/** True when the 1.05:1 greyscale floor holds between Dream colours `a` and `b`: only when both are the same kind. */
export function greyscaleFloorApplies(a: DreamLookId, b: DreamLookId): boolean {
  return dreamKind(a) === dreamKind(b);
}
