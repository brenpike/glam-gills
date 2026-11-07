/**
 * Wind and waves marks: the surface ripple arcs of the warning and the gust streaks with chevrons of
 * the gust (issue #211, Area 12; ND-10, ND-11; guide 2, 4 and 10).
 *
 * Every shape, size and colour here is derived (provisional). Two small sprites, both facing right
 * (the way a gust blows when its direction is 1); the scene mirrors them with faceSprite for a gust
 * blowing left, repeats them across the span and fades them with depth:
 * - the ripple arcs (WIND_RIPPLE_TEX): three nested curves bowing toward +x, growing in size, like a
 *   wave front travelling right, for the ripple warning on the surface;
 * - the gust streak (WIND_STREAK_TEX): a long line ending in a rounded chevron that points the way
 *   the gust blows, with two shorter lines trailing behind it, for the gust.
 *
 * Both are only lines with the single ink outline, so they read by shape without colour: the arcs are
 * curved and grow toward the way of the wind, the streak is straight and ends in a chevron. A mark is
 * never a face, a letter, a hazard shape or a snack. The pale colour is below the hero's belly, so the
 * axolotl stays the brightest thing; the ink holds every edge (11.5:1 with the pale colour).
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser: flow, still under
 * reduced motion, fading and the choice between warning and gust belong to the scene.
 */
import { frameFromBounds, inkMany, seg, type Seg, type TexSize } from './canvasKit';

// ---------------------------------------------------------------------------
// Colours and widths
// ---------------------------------------------------------------------------

/** The pale wind colour #cfeaf5, luminance 0.7870, 11.47:1 with ink; below the hero's belly (0.8231). */
export const WIND_MARK = '#cfeaf5';
/** Colour width of every line, px. */
export const WIND_LINE_W = 2.6;
/** Ink width added on each side of every line, px. */
export const WIND_LINE_INK = 2;

/** Padding round every sprite (the guide asks for 4 px at 1x). */
const WIND_PAD = 6;

type Pt = readonly [number, number];

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** One ripple arc: x of its ends, half its height, and how far it bows toward +x. */
export interface RippleArc {
  readonly x: number;
  readonly halfHeight: number;
  readonly bow: number;
}

/** The three ripple arcs, small to large, left to right: a wave front travelling right. */
export const WIND_RIPPLE_ARCS: readonly RippleArc[] = [
  { x: -12, halfHeight: 4, bow: 3 },
  { x: 0, halfHeight: 7, bow: 4 },
  { x: 12, halfHeight: 10, bow: 5 },
];

/** Length in px of the streak's long line, back from the chevron tip. */
export const WIND_STREAK_LEN = 52;
/** How far back and out the chevron's arms reach from its tip, px. */
export const WIND_CHEVRON_ARM = 8;
/** The streak's two shorter trailing lines, each [x start, x end, y], tip at local (0, 0), facing right. */
export const WIND_STREAK_TRAILS: readonly (readonly [number, number, number])[] = [
  [-40, -14, 11],
  [-46, -26, -11],
];

/** The long line of the streak, ending just inside the chevron tip. */
export const WIND_STREAK_MAIN: readonly [Pt, Pt] = [
  [-WIND_STREAK_LEN, 0],
  [-2, 0],
];

/** The chevron: its upper arm end, its tip and its lower arm end, pointing +x. */
export const WIND_CHEVRON: readonly [Pt, Pt, Pt] = [
  [-WIND_CHEVRON_ARM, -WIND_CHEVRON_ARM + 1],
  [0, 0],
  [-WIND_CHEVRON_ARM, WIND_CHEVRON_ARM - 1],
];

/** Every point the ripple arcs reach, ends and the bowed middles (a quadratic bows half its control offset). */
function rippleExtremes(): Pt[] {
  return WIND_RIPPLE_ARCS.flatMap((a): Pt[] => [
    [a.x, -a.halfHeight],
    [a.x, a.halfHeight],
    [a.x + a.bow, 0],
  ]);
}

/** Every point the streak reaches. */
function streakExtremes(): Pt[] {
  return [
    ...WIND_STREAK_MAIN,
    ...WIND_CHEVRON,
    ...WIND_STREAK_TRAILS.flatMap(([x0, x1, y]): Pt[] => [
      [x0, y],
      [x1, y],
    ]),
  ];
}

function texOf(points: readonly Pt[]): TexSize {
  const reach = WIND_LINE_W / 2 + WIND_LINE_INK;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return frameFromBounds(Math.min(...xs) - reach, Math.min(...ys) - reach, Math.max(...xs) + reach, Math.max(...ys) + reach, WIND_PAD);
}

/**
 * Texture frame of the ripple arcs (provisional): the three arcs with their ink plus 6 px of
 * padding. Anchor is the middle arc's centre. Facing right: the scene mirrors it for a leftward wind.
 */
export const WIND_RIPPLE_TEX: TexSize = texOf(rippleExtremes());

/**
 * Texture frame of the gust streak (provisional): the lines and the chevron with their ink plus 6 px
 * of padding. Anchor is the chevron tip, local (0, 0), pointing +x. Mirrored by the scene for a
 * leftward gust.
 */
export const WIND_STREAK_TEX: TexSize = texOf(streakExtremes());

// ---------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------

function straight(a: Pt, b: Pt): Path2D {
  const p = new Path2D();
  p.moveTo(a[0], a[1]);
  p.lineTo(b[0], b[1]);
  return p;
}

function tube(p: Path2D): Seg {
  return seg(p, WIND_LINE_W, WIND_MARK, WIND_LINE_INK);
}

/**
 * Paint the ripple arcs around the anchor: three curves bowing toward +x, all in one merged ink
 * group, each a rounded tube. No fill, no face, no text.
 */
export function paintWindRipple(ctx: CanvasRenderingContext2D): void {
  const tubes = WIND_RIPPLE_ARCS.map((a) => {
    const p = new Path2D();
    p.moveTo(a.x, -a.halfHeight);
    p.quadraticCurveTo(a.x + 2 * a.bow, 0, a.x, a.halfHeight);
    return tube(p);
  });
  inkMany(ctx, tubes);
}

/**
 * Paint the gust streak around the chevron tip: the long line, the chevron (two arms joined at the
 * tip with a round join, pointing +x) and the two shorter trailing lines, in one merged ink group.
 */
export function paintWindStreak(ctx: CanvasRenderingContext2D): void {
  const chevron = new Path2D();
  chevron.moveTo(WIND_CHEVRON[0][0], WIND_CHEVRON[0][1]);
  chevron.lineTo(WIND_CHEVRON[1][0], WIND_CHEVRON[1][1]);
  chevron.lineTo(WIND_CHEVRON[2][0], WIND_CHEVRON[2][1]);
  const trails = WIND_STREAK_TRAILS.map(([x0, x1, y]) => tube(straight([x0, y], [x1, y])));
  inkMany(ctx, [tube(straight(WIND_STREAK_MAIN[0], WIND_STREAK_MAIN[1])), tube(chevron), ...trails]);
}
