/**
 * The PRD F15 separation rule for Dream colours (issue #215, ND-10, owner decision Q2, 2026-11-07): "A patterned or
 * sheen Dream colour is told apart in greyscale by its own pattern cue, so its body keeps the 1.05:1 greyscale floor
 * only against Dream colours of its own kind; it keeps 0.075 in OKLab from every Dream colour, 1.5:1 from Plum, a sheen
 * 1.5:1 from Iridescent, and every cue check." Pure: the kinds are the catalogue's (solid, patterned or sheen), the
 * bodies the palette's, and every floor is checked against the unrounded measure.
 */
import { dreamColourById, type DreamKind } from '../logic/catalogue';
import { DREAM_SLOTS, type DreamLookId } from './palette';

/** Greyscale floor (WCAG contrast ratio) between two Dream bodies of the same kind. */
export const DREAM_GREYSCALE_FLOOR = 1.05;
/** OKLab difference floor between any two Dream bodies. */
export const DREAM_OKLAB_FLOOR = 0.075;
/** Greyscale margin every Dream body keeps from Plum, and every sheen body from Iridescent. */
export const DREAM_GREYSCALE_MARGIN = 1.5;

/** One PRD F15 floor a Dream body misses: the pair, the measure, the floor and the unrounded value. */
export interface DreamSeparationFailure {
  readonly pair: readonly [DreamLookId, DreamLookId];
  readonly measure: 'oklab' | 'greyscale';
  readonly floor: number;
  readonly value: number;
}

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

/** True when the 1.5:1 greyscale margin holds between Dream colours `a` and `b`: either is Plum, or one is Iridescent and the other a sheen. */
export function greyscaleMarginApplies(a: DreamLookId, b: DreamLookId): boolean {
  if (a === 'plum' || b === 'plum') return true;
  return (a === 'iridescent' && dreamKind(b) === 'sheen') || (b === 'iridescent' && dreamKind(a) === 'sheen');
}

/** Unrounded WCAG 2 contrast ratio of the bodies of Dream colours `a` and `b`. */
export function dreamGreyscaleRatio(a: DreamLookId, b: DreamLookId): number {
  const la = computeRelativeLuminance(DREAM_SLOTS[a].body);
  const lb = computeRelativeLuminance(DREAM_SLOTS[b].body);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Unrounded Euclidean OKLab difference of the bodies of Dream colours `a` and `b`. */
export function dreamOklabDifference(a: DreamLookId, b: DreamLookId): number {
  const pa = convertToOklab(DREAM_SLOTS[a].body);
  const pb = convertToOklab(DREAM_SLOTS[b].body);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

/**
 * Every PRD F15 floor Dream colour `id` misses against every other Dream colour, on unrounded measures: 0.075 in OKLab
 * from all, 1.05:1 in greyscale where greyscaleFloorApplies, and 1.5:1 where greyscaleMarginApplies or the other colour
 * is in `heldApart`. A value exactly on a floor passes. Empty when every floor holds. Throws for an id, or a `heldApart`
 * id, the catalogue does not hold.
 */
export function dreamSeparationFailures(id: DreamLookId, heldApart: readonly DreamLookId[] = []): DreamSeparationFailure[] {
  dreamKind(id);
  heldApart.forEach(dreamKind);
  const others = (Object.keys(DREAM_SLOTS) as DreamLookId[]).filter((other) => other !== id);
  return others.flatMap((other) => listPairFailures(id, other, heldApart.includes(other)));
}

/** The floors the pair `id` and `other` misses, OKLab first, then the greyscale floor, then the margin. */
function listPairFailures(id: DreamLookId, other: DreamLookId, held: boolean): DreamSeparationFailure[] {
  const failures: DreamSeparationFailure[] = [];
  const oklab = dreamOklabDifference(id, other);
  if (oklab < DREAM_OKLAB_FLOOR) failures.push({ pair: [id, other], measure: 'oklab', floor: DREAM_OKLAB_FLOOR, value: oklab });
  const greyscale = dreamGreyscaleRatio(id, other);
  if (greyscaleFloorApplies(id, other) && greyscale < DREAM_GREYSCALE_FLOOR) {
    failures.push({ pair: [id, other], measure: 'greyscale', floor: DREAM_GREYSCALE_FLOOR, value: greyscale });
  }
  if ((held || greyscaleMarginApplies(id, other)) && greyscale < DREAM_GREYSCALE_MARGIN) {
    failures.push({ pair: [id, other], measure: 'greyscale', floor: DREAM_GREYSCALE_MARGIN, value: greyscale });
  }
  return failures;
}

/** The 0 to 255 channels of a #rrggbb colour; throws for any other form. */
function readChannels(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Not a #rrggbb colour: "${hex}"`);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function computeRelativeLuminance(hex: string): number {
  const [r, g, b] = readChannels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Linear-light sRGB channel (IEC 61966-2-1), as OKLab takes it. */
function toLinearChannel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** OKLab coordinates of a #rrggbb colour (Ottosson 2020, https://bottosson.github.io/posts/oklab/). */
function convertToOklab(hex: string): [number, number, number] {
  const [r, g, b] = readChannels(hex).map(toLinearChannel);
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
