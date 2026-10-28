/**
 * Stalactite drip painters: the stalactite hanging from the underside of a rock ledge, the drop that
 * swells at its tip, the stream of drips and the ripple rings under the drop (issue #77, ND-3,
 * option B; guide 3c, 7 and 10). The moving hazard look `stalactite-drip`.
 *
 * Every shape, size and colour here is derived (provisional). The rock is the spring cave's rock
 * (drawSpringCave.ts), so the stalactite reads as part of the ledge it hangs from. The water is a
 * pale blue-white with an ink outline, so the drips read in greyscale as light shapes in dark
 * lines. Nothing shows the stream hitting, pinning or holding the axolotl (A11, ADR 0007, ADR
 * 0008): a hit shows only the shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the drop's
 * swelling (a sprite alpha from 0 to 1 over the warning), the rings and the stream's length belong
 * to the scene. Every anchor sits on the stalactite's x:
 * - bow: the stalactite; its anchor is the rock's underside it hangs from (the spawn's base, a rock
 *   ledge's y0), and the rock runs down from there to its tip STALACTITE_TIP_Y px below;
 * - shadow: the centre of the drop at the stalactite's tip; the scene puts it DRIP_DROP_ALONG px
 *   below the rock;
 * - shaft: the lowest point of the stream, the logic's tip. The art runs DRIP_STREAM_LENGTH px up
 *   from it, the drips repeating every DRIP_SPACING px, so it can be cropped at any length and
 *   still reads as one stream; its top end, at the rock, hides behind the stalactite;
 * - ring: the centre of the ripple rings, DRIP_RING_ALONG px below the rock, just under the drop.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type TexSize } from './canvasKit';
import { SPRING_ROCK, SPRING_ROCK_CRACK, SPRING_ROCK_LIGHT, SPRING_ROCK_SHINE } from './drawSpringCave';
import { INK, LW } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 10)
// ---------------------------------------------------------------------------

/**
 * The water of the drips, the drop and the stream: a pale blue-white #dff7ff, luminance 0.8943,
 * 12.94:1 with ink. It reaches the outer edge, so it is held at 4.5:1 or better against ink.
 */
export const DRIP_WATER = '#dff7ff';
/** The one soft shine on each drip and on the drop. Inside the silhouette, so alpha is allowed. */
export const DRIP_SHINE = 'rgba(255,255,255,0.85)';
/** The ripple rings' line, white, with ink each side. */
export const DRIP_RING = '#ffffff';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Stalactite (the bow)
// ---------------------------------------------------------------------------

/** The stalactite's round tip, px below its anchor on the rock: past the lip of the ledge it hangs from. */
export const STALACTITE_TIP_Y = 28;
/** The stalactite's half width at its root, on the rock. */
export const STALACTITE_HALF_W = 18;
/** Ink of the stalactite's outline. */
const STALACTITE_LW = LW * 0.8;
/** Bands across the rock, [y, half width]: the rings of rock a stalactite grows in. Internal detail lines. */
const STALACTITE_BANDS: readonly (readonly [number, number])[] = [
  [6, 14],
  [12, 9],
  [18, 5],
];

/**
 * The stalactite's outline: a narrowing, slightly lumpy cone from its root on the rock down to its
 * round tip and back up. Closed along the root it is the fill; open there it is the inked edge, so
 * no ink line crosses the root and the cone grows out of the ledge's rock.
 */
function stalactitePath(closed: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(-STALACTITE_HALF_W, 0);
  p.quadraticCurveTo(-14, 8, -8, 14);
  p.quadraticCurveTo(-3.5, 20, -2.5, STALACTITE_TIP_Y - 2);
  p.quadraticCurveTo(0, STALACTITE_TIP_Y + 1, 2.5, STALACTITE_TIP_Y - 2);
  p.quadraticCurveTo(4, 20, 9, 13);
  p.quadraticCurveTo(14, 7, STALACTITE_HALF_W, 0);
  if (closed) p.closePath();
  return p;
}

/**
 * Texture frame of the stalactite (provisional): the cone with its ink plus 4 px of padding. Anchor
 * is the middle of its root, on the rock's underside, local (0, 0). The scene draws it over the
 * ledge's lip and over the stream, so the top of the stream hides behind it.
 */
export const STALACTITE_TEX: TexSize = frameFromBounds(
  -STALACTITE_HALF_W - STALACTITE_LW / 2,
  -STALACTITE_LW / 2,
  STALACTITE_HALF_W + STALACTITE_LW / 2,
  STALACTITE_TIP_Y + 1 + STALACTITE_LW / 2,
  PAD,
);

/**
 * Paint the stalactite around its anchor: one SPRING_ROCK cone with an opaque INK outline down its
 * sides and round its tip, none across its root, three crack bands across it (SPRING_ROCK_CRACK), a
 * lighter streak down its left (SPRING_ROCK_LIGHT) and one shine. No face, no text.
 */
export function paintStalactite(ctx: CanvasRenderingContext2D): void {
  const cone = stalactitePath(true);
  ctx.fillStyle = SPRING_ROCK;
  ctx.fill(cone);

  ctx.save();
  ctx.clip(cone);
  ctx.lineWidth = 3;
  ctx.strokeStyle = SPRING_ROCK_LIGHT;
  ctx.stroke(line(-9, 3, -4, 18));
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  for (const [y, half] of STALACTITE_BANDS) {
    const band = new Path2D();
    band.moveTo(-half, y);
    band.quadraticCurveTo(0, y + 3, half, y);
    ctx.stroke(band);
  }
  ctx.restore();

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_SHINE;
  ctx.stroke(line(-11, 4, -7, 11));

  ctx.lineWidth = STALACTITE_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(stalactitePath(false));
}

// ---------------------------------------------------------------------------
// Drop (the shadow: the warning cue)
// ---------------------------------------------------------------------------

/** Radius of the drop that swells at the stalactite's tip in the warning. */
export const DRIP_DROP_R = 4.5;
/**
 * Where the scene puts the drop's centre: this many px below the rock, 2 px under the stalactite's
 * tip, so its pointed top hides behind the tip and its round part hangs below it.
 */
export const DRIP_DROP_ALONG = STALACTITE_TIP_Y + 2;
/** The drop's ink outline, centred on its edge. */
const DROP_OUTLINE = 2;

/**
 * Texture frame of the drop (provisional): a round drop with a pointed top, with its outline, plus
 * 4 px of padding. Anchor is the round part's centre, local (0, 0).
 */
export const DRIP_DROP_TEX: TexSize = frameFromBounds(
  -DRIP_DROP_R - DROP_OUTLINE / 2,
  -DRIP_DROP_R * 2 - DROP_OUTLINE / 2,
  DRIP_DROP_R + DROP_OUTLINE / 2,
  DRIP_DROP_R + DROP_OUTLINE / 2,
  PAD,
);

/** A drop at (`x`, `y`): round below, pointed above, `r` across the round part. */
function dropPath(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x, y - 2 * r);
  p.quadraticCurveTo(x + r, y - r, x + r, y);
  p.quadraticCurveTo(x + r, y + r, x, y + r);
  p.quadraticCurveTo(x - r, y + r, x - r, y);
  p.quadraticCurveTo(x - r, y - r, x, y - 2 * r);
  p.closePath();
  return p;
}

/**
 * Paint the drop around its anchor: one DRIP_WATER drop with an opaque INK outline 2 wide on its
 * edge and one shine. The scene fades it in over the warning: the drop swelling at the tip is the
 * warning cue, and its ink outline holds it in greyscale.
 */
export function paintDripDrop(ctx: CanvasRenderingContext2D): void {
  shape(ctx, dropPath(0, 0, DRIP_DROP_R), DRIP_WATER, DROP_OUTLINE);
  const shine = new Path2D();
  ell(shine, -1.5, -1.5, 1.1, 1.6, -0.4);
  ctx.fillStyle = DRIP_SHINE;
  ctx.fill(shine);
}

// ---------------------------------------------------------------------------
// Ripple rings (the ring: the warning cue under the drop)
// ---------------------------------------------------------------------------

/** Where the scene puts the rings' centre: this many px below the rock, just under the swelling drop. */
export const DRIP_RING_ALONG = STALACTITE_TIP_Y + 16;
/** Radii of the ripple rings, px: an outer flat ellipse and a small inner one. */
export const DRIP_RING_RX = 18;
export const DRIP_RING_RY = 5;
export const DRIP_RING_INNER_RX = 7;
export const DRIP_RING_INNER_RY = 2.2;
/** The ring lines: colour width and the ink added each side. */
const RING_W = 2.4;
const RING_OL = 1.2;
/** How far the ring's ink reaches past its radii, px. */
const RING_REACH = RING_W / 2 + RING_OL;

/**
 * Texture frame of the ripple rings (provisional): the outer ellipse with its ink plus 4 px of
 * padding. Anchor is the rings' centre, local (0, 0), DRIP_RING_ALONG px under the rock.
 */
export const DRIP_RING_TEX: TexSize = frameFromBounds(
  -DRIP_RING_RX - RING_REACH,
  -DRIP_RING_RY - RING_REACH,
  DRIP_RING_RX + RING_REACH,
  DRIP_RING_RY + RING_REACH,
  PAD,
);

/**
 * Paint the ripple rings around their anchor: an outer and an inner flat ellipse, each a white line
 * with an ink line each side (one `inkMany` group), so they read dark, white, dark in greyscale.
 * Smaller and thinner than the pole's ripple rings, as a drip is smaller than a pole.
 */
export function paintDripRing(ctx: CanvasRenderingContext2D): void {
  const outer = new Path2D();
  ell(outer, 0, 0, DRIP_RING_RX, DRIP_RING_RY);
  const inner = new Path2D();
  ell(inner, 0, 0, DRIP_RING_INNER_RX, DRIP_RING_INNER_RY);
  inkMany(ctx, [seg(outer, RING_W, DRIP_RING, RING_OL), seg(inner, RING_W, DRIP_RING, RING_OL)]);
}

// ---------------------------------------------------------------------------
// Stream (the shaft)
// ---------------------------------------------------------------------------

/** The stream's thin water line: colour width and the ink added each side. */
export const DRIP_STREAM_W = 3;
const STREAM_OL = 1.2;
/** Drips along the stream: every DRIP_SPACING px, each DRIP_HALF_W across and DRIP_HALF_H tall. */
export const DRIP_SPACING = 18;
export const DRIP_HALF_W = 5;
const DRIP_HALF_H = 4.5;
/** The drips' ink outline. */
const DRIP_OUTLINE = 2;
/**
 * Length of the art from the tip up, px: enough for a 216 px stream, over Area 6's longest, 170 px
 * from the rock. The stream's touch width is the logic's 2 x halfWidth 5 (STALACTITE_DRIP in
 * src/logic/movingHazards.ts), the drips' width.
 */
export const DRIP_STREAM_LENGTH = 216;
/** Number of drips on the stream: the first at the tip, then every DRIP_SPACING px up the art. */
export const DRIP_COUNT = Math.floor((DRIP_STREAM_LENGTH - DRIP_HALF_H) / DRIP_SPACING) + 1;

/**
 * Texture frame of the stream (provisional): the drips and the line with their ink plus 4 px of
 * padding. Anchor is the stream's lowest point, local (0, 0), the logic's tip. The art runs up
 * from it by DRIP_STREAM_LENGTH. The scene crops it to the stream's length.
 */
export const DRIP_STREAM_TEX: TexSize = frameFromBounds(
  -DRIP_HALF_W - DRIP_OUTLINE / 2,
  -DRIP_STREAM_LENGTH - STREAM_OL - DRIP_STREAM_W / 2,
  DRIP_HALF_W + DRIP_OUTLINE / 2,
  DRIP_OUTLINE / 2,
  PAD,
);

/**
 * Paint the stream around its anchor (the tip). Back to front: the thin water line from the top of
 * the art down to the lowest drip (one `inkMany` tube, ink 1.2 a side), then the drips, each a
 * DRIP_WATER drop with an INK outline, every DRIP_SPACING px from the tip up, the lowest one's
 * round bottom on the anchor. The drips are the greyscale cue: light beads in dark lines.
 */
export function paintDripStream(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(line(0, -DRIP_STREAM_LENGTH, 0, -DRIP_HALF_H), DRIP_STREAM_W, DRIP_WATER, STREAM_OL)]);
  for (let i = 0; i < DRIP_COUNT; i++) {
    const y = -DRIP_HALF_H - i * DRIP_SPACING;
    const drip = new Path2D();
    ell(drip, 0, y, DRIP_HALF_W - DRIP_OUTLINE / 2, DRIP_HALF_H - DRIP_OUTLINE / 2);
    shape(ctx, drip, DRIP_WATER, DRIP_OUTLINE);
  }
}
