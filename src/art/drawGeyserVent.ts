/**
 * Geyser vent painters: the vent's rock chimney on the bed, the bubbles that rise from it, the
 * column of water and bubbles it bursts up and the shimmer ring at its mouth (issue #77, ND-3,
 * option B; guide 3c, 7 and 10). The moving hazard look `geyser-vent`.
 *
 * Every shape, size and colour here is derived (provisional). The rock is the spring cave's rock
 * (drawSpringCave.ts), so the vent reads as part of the bed. The water is a pale blue-white with an
 * ink outline, so the column and the bubbles read in greyscale as light shapes in dark lines. The
 * vent is never shown as fire or as hurting the axolotl (A11, ADR 0007, ADR 0008): a hit shows only
 * the shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the
 * bubbles' fading in (a sprite alpha from 0 to 1 over the warning), the ring and the column's height
 * belong to the scene. Every anchor sits on the vent's x:
 * - bow: the vent's chimney; its anchor is the bed top under it (the spawn's base). Its mouth is
 *   GEYSER_MOUTH_RISE px up, and its foot sinks into the bed;
 * - shadow: the centre of the bubble cluster; the scene puts it GEYSER_BUBBLES_RISE px above the bed;
 * - shaft: the top of the column, the logic's tip. The art runs GEYSER_COLUMN_LENGTH px DOWN from
 *   it (the column goes up, so its base is below its tip), the bubbles in it repeating every
 *   GEYSER_BUBBLE_SPACING px, so it can be cropped at any height; its bottom hides behind the chimney;
 * - ring: the centre of the shimmer ring, at the vent's mouth.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type TexSize } from './canvasKit';
import { SPRING_GROTTO_INTERIOR, SPRING_ROCK, SPRING_ROCK_CRACK, SPRING_ROCK_LIGHT, SPRING_ROCK_SHINE } from './drawSpringCave';
import { LW } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 10)
// ---------------------------------------------------------------------------

/**
 * The water of the column and the bubbles: a pale blue-white #e3f9ff, luminance 0.9130, 13.20:1 with
 * ink. It reaches the outer edge, so it is held at 4.5:1 or better against ink.
 */
export const GEYSER_WATER = '#e3f9ff';
/** The froth inside the column: white, a little brighter than the water. Inside the silhouette, no ink. */
export const GEYSER_FROTH = '#ffffff';
/** The shimmer ring's line, white, with ink each side. */
export const GEYSER_RING = '#ffffff';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Chimney (the bow)
// ---------------------------------------------------------------------------

/** The vent's mouth, px above the bed-top anchor. */
export const GEYSER_MOUTH_RISE = 14;
/** Half width of the mouth and of the chimney's foot. */
export const GEYSER_MOUTH_HALF_W = 12;
export const GEYSER_FOOT_HALF_W = 32;
/** How far the chimney's foot sinks below the bed top, px. */
export const GEYSER_FOOT_DROP = 18;
/** Ink of the chimney's outline. */
const CHIMNEY_LW = LW * 0.8;

/** The chimney's outline: a low, wide rock cone with a flat, open top at the mouth. */
function chimneyPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-GEYSER_FOOT_HALF_W, GEYSER_FOOT_DROP);
  p.quadraticCurveTo(-20, 4, -GEYSER_MOUTH_HALF_W - 2, -GEYSER_MOUTH_RISE + 2);
  p.quadraticCurveTo(-GEYSER_MOUTH_HALF_W, -GEYSER_MOUTH_RISE - 2, -GEYSER_MOUTH_HALF_W + 4, -GEYSER_MOUTH_RISE);
  p.lineTo(GEYSER_MOUTH_HALF_W - 4, -GEYSER_MOUTH_RISE);
  p.quadraticCurveTo(GEYSER_MOUTH_HALF_W, -GEYSER_MOUTH_RISE - 2, GEYSER_MOUTH_HALF_W + 2, -GEYSER_MOUTH_RISE + 2);
  p.quadraticCurveTo(20, 4, GEYSER_FOOT_HALF_W, GEYSER_FOOT_DROP);
  p.closePath();
  return p;
}

/**
 * Texture frame of the chimney (provisional): the cone and its mouth with their ink plus 4 px of
 * padding. Anchor is the bed top under the mouth, local (0, 0). The scene draws it over the column,
 * so the bottom of the column hides inside it.
 */
export const GEYSER_CHIMNEY_TEX: TexSize = frameFromBounds(
  -GEYSER_FOOT_HALF_W - CHIMNEY_LW / 2,
  -GEYSER_MOUTH_RISE - 2 - CHIMNEY_LW / 2,
  GEYSER_FOOT_HALF_W + CHIMNEY_LW / 2,
  GEYSER_FOOT_DROP + CHIMNEY_LW / 2,
  PAD,
);

/**
 * Paint the chimney around its anchor: one SPRING_ROCK cone with an opaque INK outline, the
 * mouth as a thin dark opening (SPRING_GROTTO_INTERIOR) on its top, two cracks (SPRING_ROCK_CRACK),
 * a lighter ledge (SPRING_ROCK_LIGHT) and one shine. No face, no fire, no text.
 */
export function paintGeyserChimney(ctx: CanvasRenderingContext2D): void {
  const cone = chimneyPath();
  shape(ctx, cone, SPRING_ROCK, CHIMNEY_LW);

  const mouth = new Path2D();
  ell(mouth, 0, -GEYSER_MOUTH_RISE + 2, GEYSER_MOUTH_HALF_W - 4, 2.4);
  ctx.fillStyle = SPRING_GROTTO_INTERIOR;
  ctx.fill(mouth);

  ctx.save();
  ctx.clip(cone);
  ctx.lineWidth = 3;
  ctx.strokeStyle = SPRING_ROCK_LIGHT;
  ctx.stroke(line(-20, 6, -10, -4));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  ctx.stroke(line(8, -6, 14, 6));
  ctx.stroke(line(-4, 4, 2, 12));
  ctx.restore();

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_SHINE;
  ctx.stroke(line(-15, -6, -12, -11));
}

// ---------------------------------------------------------------------------
// Bubbles (the shadow: the warning cue)
// ---------------------------------------------------------------------------

/** Where the scene puts the bubble cluster's centre: this many px above the bed top, over the mouth. */
export const GEYSER_BUBBLES_RISE = 32;
/** The bubbles of the cluster: [x, y, radius], round the anchor, the biggest at the top. */
export const GEYSER_BUBBLES: readonly (readonly [number, number, number])[] = [
  [-5, 8, 3],
  [5, 3, 3.5],
  [-3, -4, 4],
  [4, -11, 4.5],
];
/** The bubbles' ink outline, centred on each edge. */
const BUBBLE_OUTLINE = 2;

/**
 * Texture frame of the bubble cluster (provisional): every bubble with its outline, plus 4 px of
 * padding. Anchor is the cluster's centre, local (0, 0).
 */
export const GEYSER_BUBBLES_TEX: TexSize = frameFromBounds(-10, -17, 10, 13, PAD);

/**
 * Paint the bubble cluster around its anchor: four GEYSER_WATER bubbles, each with an opaque INK
 * outline 2 wide and one white shine. The scene fades it in over the warning: bubbles rising from
 * the mouth are the warning cue, and their ink outlines hold them in greyscale.
 */
export function paintGeyserBubbles(ctx: CanvasRenderingContext2D): void {
  for (const [x, y, r] of GEYSER_BUBBLES) {
    const bubble = new Path2D();
    ell(bubble, x, y, r, r);
    shape(ctx, bubble, GEYSER_WATER, BUBBLE_OUTLINE);
    const shine = new Path2D();
    ell(shine, x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.25);
    ctx.fillStyle = GEYSER_FROTH;
    ctx.fill(shine);
  }
}

// ---------------------------------------------------------------------------
// Shimmer ring (the ring: the warning cue at the mouth)
// ---------------------------------------------------------------------------

/** Radii of the shimmer ring at the mouth, px: one flat ellipse a little wider than the mouth. */
export const GEYSER_RING_RX = 16;
export const GEYSER_RING_RY = 4.5;
/** The ring line: colour width and the ink added each side. */
const RING_W = 2.6;
const RING_OL = 1.3;
/** How far the ring's ink reaches past its radii, px. */
const RING_REACH = RING_W / 2 + RING_OL;

/**
 * Texture frame of the shimmer ring (provisional): the ellipse with its ink plus 4 px of padding.
 * Anchor is the ring's centre, local (0, 0), at the vent's mouth.
 */
export const GEYSER_RING_TEX: TexSize = frameFromBounds(
  -GEYSER_RING_RX - RING_REACH,
  -GEYSER_RING_RY - RING_REACH,
  GEYSER_RING_RX + RING_REACH,
  GEYSER_RING_RY + RING_REACH,
  PAD,
);

/**
 * Paint the shimmer ring around its anchor: one flat ellipse, a white line with an ink line each
 * side, so it reads dark, white, dark in greyscale. One ring tells it from the pole's and the
 * drip's two.
 */
export function paintGeyserRing(ctx: CanvasRenderingContext2D): void {
  const ring = new Path2D();
  ell(ring, 0, 0, GEYSER_RING_RX, GEYSER_RING_RY);
  inkMany(ctx, [seg(ring, RING_W, GEYSER_RING, RING_OL)]);
}

// ---------------------------------------------------------------------------
// Column (the shaft)
// ---------------------------------------------------------------------------

/**
 * Column colour width in px: the logic's 2 x halfWidth 12 (GEYSER_VENT in
 * src/logic/movingHazards.ts), so the column is a 24 px column, as wide as the chimney's mouth
 * (2 x GEYSER_MOUTH_HALF_W).
 */
export const GEYSER_COLUMN_W = 24;
/** Ink added each side of the column. */
const COLUMN_OL = 2;
/**
 * Length of the art from the tip down, px: enough for a 304 px column, the longest the spring
 * cave's areas (Areas 6 and 7) may set, plus the 16 px the scene draws down inside the chimney.
 */
export const GEYSER_COLUMN_LENGTH = 320;
/** The froth bubbles inside the column: every GEYSER_BUBBLE_SPACING px, alternating side to side. */
export const GEYSER_BUBBLE_SPACING = 20;
const FROTH_R = 2.6;
/** The first froth bubble's distance below the tip. */
const FROTH_FIRST = 14;
/** Number of froth bubbles in the column. */
export const GEYSER_FROTH_COUNT = Math.floor((GEYSER_COLUMN_LENGTH - FROTH_FIRST) / GEYSER_BUBBLE_SPACING) + 1;

/**
 * Texture frame of the column (provisional): a vertical bar with its ink plus 4 px of padding.
 * Anchor is the column's top centre, local (0, 0), the logic's tip. The art runs DOWN from it by
 * GEYSER_COLUMN_LENGTH. The scene crops it to the column's height.
 */
export const GEYSER_COLUMN_TEX: TexSize = frameFromBounds(
  -GEYSER_COLUMN_W / 2 - COLUMN_OL,
  -COLUMN_OL,
  GEYSER_COLUMN_W / 2 + COLUMN_OL,
  GEYSER_COLUMN_LENGTH + GEYSER_COLUMN_W / 2 + COLUMN_OL,
  PAD,
);

/**
 * Paint the column around its anchor (the tip). Back to front: the water (one `inkMany` tube from
 * the round cap at the anchor down the art, ink 2 a side), then the froth bubbles inside it
 * (GEYSER_FROTH, no ink), every GEYSER_BUBBLE_SPACING px, side to side. Light water in dark lines is
 * the greyscale cue.
 */
export function paintGeyserColumn(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(line(0, GEYSER_COLUMN_W / 2, 0, GEYSER_COLUMN_LENGTH), GEYSER_COLUMN_W, GEYSER_WATER, COLUMN_OL)]);
  ctx.fillStyle = GEYSER_FROTH;
  for (let i = 0; i < GEYSER_FROTH_COUNT; i++) {
    const froth = new Path2D();
    ell(froth, i % 2 === 0 ? -3 : 3, FROTH_FIRST + i * GEYSER_BUBBLE_SPACING, FROTH_R, FROTH_R);
    ctx.fill(froth);
  }
}
