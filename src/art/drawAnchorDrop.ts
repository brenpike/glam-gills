/**
 * Anchor drop painters: the bow of an old wooden work-canoe moored at the surface, the two chain
 * links that swing in its warning, the ripple lines under it and the chain with a small old anchor
 * on its end that drops from it (the moving hazard look `anchor-drop`, issue #194; guide 3c, 7 and
 * 10).
 *
 * Every shape, size and colour here is derived (provisional). Nothing shows a person, a face or text,
 * and nothing shows the anchor hurting the axolotl (A11, ADR 0007, ADR 0008): a hit shows only the
 * shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the cue's
 * fading in (a sprite alpha from 0 to 1 over the warning), the ripple lines' growth and the chain's
 * length belong to the scene. Every anchor point (a texture's origin) sits on the hazard's x:
 * - bow: the end of a moored work-canoe. Its anchor point is the water line under the middle of the
 *   hull (the spawn's base, the surface). The hull is a plain, double-ended wooden boat 68 px long:
 *   both ends rise to a point and the middle dips, in one pale wood with two plank lines, a lighter
 *   rim along the top edge and one small iron ring on its side. It has no painted bands, no flower
 *   arch, no prow ball and no flowers, and it is not flat-bottomed, so it is not the punting pole's
 *   painted trajinera bow (drawPuntingPole.ts), and not Area 8's gliding or moored trajineras
 *   (drawDeepCanal.ts), which are cream with painted bands. It rises ANCHOR_BOW_RISE px above the
 *   water line and dips ANCHOR_BOW_DIP px below it. The chain runs up behind the hull and shows only
 *   from under it;
 * - shadow (the warning cue): the centre of two chain links hanging one above the other, each a
 *   tall, upright, white, rounded-square loop 14 px wide and 24 px tall with a hole through it. The
 *   scene puts it ANCHOR_CUE_ALONG px below the base and fades it in over the warning. Tall and
 *   narrow, with a hole in each loop and straight sides, it is the only warning cue that is taller
 *   than it is wide and the only one made of loops with straight sides;
 * - shaft: the lowest point of the old anchor, the logic's tip. The art runs ANCHOR_SHAFT_LENGTH px
 *   UP from it (the anchor hangs below the boat, so its chain goes up to the base): first the small
 *   anchor (a ring on top, a short cross bar, a straight shank, a curved pair of arms and a leaf
 *   fluke on each arm), then the chain: a link every ANCHOR_LINK_PITCH px, each an upright
 *   rounded-square loop ANCHOR_CHAIN_W px wide, so it can be cropped at any length and still reads
 *   as one chain. The anchor's lowest point (the bottom of the arms) is on the anchor point. The
 *   chain's top, past the base, hides behind the hull;
 * - ring: the centre of three short wavy lines stacked one above the other, a wide one on top and a
 *   narrower one under each, like water spreading under the boat and pointing down at where the
 *   anchor will land. It is at ANCHOR_RING_ALONG px below the base. Open, wavy and stacked, it is
 *   not a closed ellipse, so it differs from the pole's two flat rings, the drip's two rings, the
 *   geyser's single shimmer ring, the garter snake's ring and the protected ring.
 *
 * Greyscale: every part has an opaque ink outline and its fills are pale (the wood, the iron and
 * the white of the cue and ripple lines are each 9:1 or better with ink, so each holds 3:1 or better
 * on any background by the pair method). The cue reads as two tall dark-white-dark loops with holes,
 * the ripple as three dark-white-dark wavy lines of falling length, the chain as a column of loops
 * with holes, and the anchor as an anchor shape, so none of them depends on hue.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type TexSize } from './canvasKit';
import { INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 10)
// ---------------------------------------------------------------------------

/** The canoe's wood: a plain pale wood #ecd4a2, luminance 0.6753, 9.94:1 with ink. It reaches the outer edge. */
export const ANCHOR_BOAT_WOOD = '#ecd4a2';
/** The lighter strip along the canoe's top edge. Inside the silhouette, so no ink. */
export const ANCHOR_BOAT_RIM = '#fbf0d2';
/** The canoe's two plank lines. Internal detail lines, not ink; inside the silhouette, so alpha is allowed. */
export const ANCHOR_BOAT_SEAM = 'rgba(120,84,44,0.55)';
/** The old iron of the anchor and the chain: a pale grey-blue #d3dae4, luminance 0.6959, 10.23:1 with ink. It reaches the outer edge. */
export const ANCHOR_METAL = '#d3dae4';
/** The two rust marks on the anchor. Inside the silhouette, so no ink. */
export const ANCHOR_RUST = '#b98f6c';
/** The cue's two links: white, with ink each side (14.39:1). */
export const ANCHOR_LINK_CUE = WHITE;
/** The ripple lines: white, with ink each side. */
export const ANCHOR_RING = WHITE;

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

/** A rounded rectangle as a closed path, centred on (cx, cy), `hw` and `hh` half the width and height, corner radius `r`. */
function roundedRect(cx: number, cy: number, hw: number, hh: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx - hw + r, cy - hh);
  p.lineTo(cx + hw - r, cy - hh);
  p.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + r);
  p.lineTo(cx + hw, cy + hh - r);
  p.quadraticCurveTo(cx + hw, cy + hh, cx + hw - r, cy + hh);
  p.lineTo(cx - hw + r, cy + hh);
  p.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - r);
  p.lineTo(cx - hw, cy - hh + r);
  p.quadraticCurveTo(cx - hw, cy - hh, cx - hw + r, cy - hh);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Canoe (the bow)
// ---------------------------------------------------------------------------

/** Half the canoe's length, px: both ends are this far from the middle. */
export const ANCHOR_BOW_HALF_L = 34;
/** How far the canoe's two pointed ends rise above the water line, px. */
export const ANCHOR_BOW_RISE = 22;
/** How far the canoe's flat bottom dips below the water line, px. */
export const ANCHOR_BOW_DIP = 4;
/** The top edge's lowest point in the middle, px above the water line. */
const BOW_MID_RISE = 12;
/** Ink of the canoe's outline. */
const BOW_LW = LW * 0.8;

/** The canoe's outline, closed: two raised pointed ends, a dipping top edge and a short flat bottom. */
function hullPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE);
  p.quadraticCurveTo(-30, 0, -14, ANCHOR_BOW_DIP);
  p.lineTo(14, ANCHOR_BOW_DIP);
  p.quadraticCurveTo(30, 0, ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE);
  // control y so that the top edge's middle is BOW_MID_RISE px up: the midpoint of the curve is
  // 0.5 * end y + 0.5 * control y
  p.quadraticCurveTo(0, 2 * -BOW_MID_RISE + ANCHOR_BOW_RISE, -ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE);
  p.closePath();
  return p;
}

/** The top edge alone, from one end to the other. */
function gunwalePath(): Path2D {
  const p = new Path2D();
  p.moveTo(-ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE);
  p.quadraticCurveTo(0, 2 * -BOW_MID_RISE + ANCHOR_BOW_RISE, ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE);
  return p;
}

/** A plank line across the canoe, from end to end: both ends at `endY`, the curve pulled toward `controlY` at x 0. */
function plankPath(endY: number, controlY: number): Path2D {
  const p = new Path2D();
  p.moveTo(-ANCHOR_BOW_HALF_L, endY);
  p.quadraticCurveTo(0, controlY, ANCHOR_BOW_HALF_L, endY);
  return p;
}

/**
 * Texture frame of the canoe (provisional): the hull with its ink plus 4 px of padding. Anchor point
 * is the water line under the middle of the hull, local (0, 0). The scene draws it over the chain,
 * so the top of the chain hides behind it.
 */
export const ANCHOR_BOW_TEX: TexSize = frameFromBounds(
  -ANCHOR_BOW_HALF_L - BOW_LW / 2,
  -ANCHOR_BOW_RISE - BOW_LW / 2,
  ANCHOR_BOW_HALF_L + BOW_LW / 2,
  ANCHOR_BOW_DIP + BOW_LW / 2,
  PAD,
);

/**
 * Paint the canoe around its anchor point: one ANCHOR_BOAT_WOOD hull, a lighter rim along its top
 * edge and two plank lines (ANCHOR_BOAT_SEAM), both clipped to the hull, one small iron ring on its
 * middle (an ink-edged ANCHOR_METAL tube), and an opaque INK outline all round, last. No painted
 * bands, no flowers, no people, no face, no text.
 */
export function paintAnchorBow(ctx: CanvasRenderingContext2D): void {
  const hull = hullPath();
  ctx.fillStyle = ANCHOR_BOAT_WOOD;
  ctx.fill(hull);

  ctx.save();
  ctx.clip(hull);
  ctx.lineWidth = 4;
  ctx.strokeStyle = ANCHOR_BOAT_RIM;
  ctx.stroke(gunwalePath());
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = ANCHOR_BOAT_SEAM;
  ctx.stroke(plankPath(-4, 4));
  ctx.stroke(plankPath(-16, 0));
  ctx.restore();

  const ring = new Path2D();
  ell(ring, 0, -2, 3, 3);
  inkMany(ctx, [seg(ring, 2.2, ANCHOR_METAL, 1.1)]);

  ctx.lineWidth = BOW_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(hullPath());
}

// ---------------------------------------------------------------------------
// Two chain links (the shadow: the warning cue)
// ---------------------------------------------------------------------------

/** Where the scene puts the cue's centre: this many px below the base (the water line), under the ripple lines. */
export const ANCHOR_CUE_ALONG = 56;
/** The cue's links: centreline half width and half height, corner radius, and the centres' distance from the middle. */
const CUE_HALF_W = 5;
const CUE_HALF_H = 10;
const CUE_CORNER = 3;
const CUE_OFFSET = 7;
/** The cue's tube: colour width and the ink added each side. */
const CUE_W = 4;
const CUE_OL = 1.6;
/** How far a link's ink reaches past its centreline, px. */
const CUE_REACH = CUE_W / 2 + CUE_OL;

/**
 * Texture frame of the cue (provisional): both links with their ink plus 4 px of padding. Anchor
 * point is the middle of the pair, local (0, 0).
 */
export const ANCHOR_CUE_TEX: TexSize = frameFromBounds(
  -CUE_HALF_W - CUE_REACH,
  -CUE_OFFSET - CUE_HALF_H - CUE_REACH,
  CUE_HALF_W + CUE_REACH,
  CUE_OFFSET + CUE_HALF_H + CUE_REACH,
  PAD,
);

/**
 * Paint the cue around its anchor point: two upright rounded-square links, one above the other and
 * overlapping in the middle, each a white (ANCHOR_LINK_CUE) tube with an opaque INK line each side,
 * so each reads dark, white, dark with a hole through it. The scene fades it in over the warning.
 */
export function paintAnchorCue(ctx: CanvasRenderingContext2D): void {
  for (const dy of [-CUE_OFFSET, CUE_OFFSET]) {
    inkMany(ctx, [seg(roundedRect(0, dy, CUE_HALF_W, CUE_HALF_H, CUE_CORNER), CUE_W, ANCHOR_LINK_CUE, CUE_OL)]);
  }
}

// ---------------------------------------------------------------------------
// Ripple lines (the ring: the warning cue under the boat)
// ---------------------------------------------------------------------------

/** Where the scene puts the ripple lines' centre: this many px below the base, just under the hull's bottom. */
export const ANCHOR_RING_ALONG = 20;
/** The lines, [half width, y]: wide on top, narrower under each. */
export const ANCHOR_RING_LINES: readonly (readonly [number, number])[] = [
  [24, -8],
  [16, 0],
  [8, 8],
];
/** Length of one wave of a line, px, and how far the curve's control point sits off the line. */
const WAVE_LEN = 8;
const WAVE_CONTROL = 2.4;
/** The lines: colour width and the ink added each side. */
const RING_W = 2.4;
const RING_OL = 1.1;
/** How far a line's ink reaches past its path, px. */
const RING_REACH = RING_W / 2 + RING_OL;

/** One wavy line from -hw to hw at height y: waves of WAVE_LEN px, each bulging the other way. */
function wavePath(hw: number, y: number): Path2D {
  const p = new Path2D();
  const n = Math.round((2 * hw) / WAVE_LEN);
  const step = (2 * hw) / n;
  p.moveTo(-hw, y);
  for (let k = 0; k < n; k++) {
    const x0 = -hw + k * step;
    p.quadraticCurveTo(x0 + step / 2, y + (k % 2 === 0 ? -WAVE_CONTROL : WAVE_CONTROL), x0 + step, y);
  }
  return p;
}

/**
 * Texture frame of the ripple lines (provisional): the three lines with their ink plus 4 px of
 * padding. Anchor point is their middle, local (0, 0), ANCHOR_RING_ALONG px under the base.
 */
export const ANCHOR_RING_TEX: TexSize = frameFromBounds(
  -ANCHOR_RING_LINES[0][0] - RING_REACH,
  ANCHOR_RING_LINES[0][1] - WAVE_CONTROL - RING_REACH,
  ANCHOR_RING_LINES[0][0] + RING_REACH,
  ANCHOR_RING_LINES[2][1] + WAVE_CONTROL + RING_REACH,
  PAD,
);

/**
 * Paint the ripple lines around their anchor point: three open wavy lines stacked 8 px apart, 48,
 * 32 and 16 px wide, each a white (ANCHOR_RING) line with an INK line each side (one `inkMany`
 * group), so they read dark, white, dark in greyscale. They are not closed, so they differ from
 * every ring in the game.
 */
export function paintAnchorRing(ctx: CanvasRenderingContext2D): void {
  inkMany(
    ctx,
    ANCHOR_RING_LINES.map(([hw, y]) => seg(wavePath(hw, y), RING_W, ANCHOR_RING, RING_OL)),
  );
}

// ---------------------------------------------------------------------------
// Old anchor and chain (the shaft)
// ---------------------------------------------------------------------------

/**
 * Chain width in px: the logic's 2 x halfWidth 5 (ANCHOR_DROP in src/logic/movingHazards.ts), the
 * width of one link's colour. Every link is this wide over its whole height.
 */
export const ANCHOR_CHAIN_W = 10;
/** A link's colour height, the distance from one link to the next, and its tube: colour width and ink each side. */
const LINK_H = 16;
export const ANCHOR_LINK_PITCH = 10;
const LINK_W = 2.6;
const LINK_OL = 1.2;
/** A link's centreline half width and half height, and corner radius. */
const LINK_HALF_W = (ANCHOR_CHAIN_W - LINK_W) / 2;
const LINK_HALF_H = (LINK_H - LINK_W) / 2;
const LINK_CORNER = 1.5;
/** The first link's bottom, px above the anchor point: it hangs through the anchor's ring. */
const CHAIN_START = 29;

/** The deepest tip the art must reach, px below the base: the logic's deepest depth. */
export const ANCHOR_ART_DEPTH = 320;
/** Px of shaft art the scene draws back past the base, hidden behind the hull. */
export const ANCHOR_SHAFT_PAST_BASE = 8;
/** Px the drawn tip is held back toward the base at rest. */
export const ANCHOR_REST_BACK = 8;
/** Number of links in the chain. */
export const ANCHOR_LINK_COUNT = Math.ceil((ANCHOR_ART_DEPTH + ANCHOR_SHAFT_PAST_BASE - CHAIN_START - LINK_H) / ANCHOR_LINK_PITCH) + 1;
/**
 * Length of the art from the tip up, px: the top of the chain's last link. Enough for a 320 px
 * anchor drop plus the ANCHOR_SHAFT_PAST_BASE px hidden behind the hull.
 */
export const ANCHOR_SHAFT_LENGTH = CHAIN_START + (ANCHOR_LINK_COUNT - 1) * ANCHOR_LINK_PITCH + LINK_H;

/** The anchor's metal tubes: shank and arms width, cross bar width, ring width and their ink. */
const SHANK_W = 5;
const SHANK_OL = 1.8;
const BAR_W = 3.4;
const TOP_RING_W = 2.6;
const TOP_RING_OL = 1.3;
/** Half the anchor's widest reach (the flukes), with ink: the art is never wider than this. */
const ANCHOR_HALF_W = 19;
/** Ink of the flukes. */
const FLUKE_LW = 2;
/** The centre of the small ring on top of the anchor, px above the anchor point. */
const EYE_RING_Y = -29;

/**
 * Texture frame of the shaft (provisional): the anchor and the chain with their ink plus 4 px of
 * padding. Anchor point is the anchor's lowest point, local (0, 0), the logic's tip. The art runs UP
 * from it by ANCHOR_SHAFT_LENGTH. The scene crops it to the drop's depth.
 */
export const ANCHOR_SHAFT_TEX: TexSize = frameFromBounds(
  -ANCHOR_HALF_W,
  -ANCHOR_SHAFT_LENGTH - LINK_OL,
  ANCHOR_HALF_W,
  SHANK_OL,
  PAD,
);

/**
 * Paint the shaft around its anchor point (the anchor's lowest point). Back to front: the chain
 * (every second link first, then the others over them, so they interlock; each an ANCHOR_METAL
 * rounded-square tube 10 px wide with ink 1.2 a side and a hole), then the anchor (one `inkMany`
 * group: shank, two arms, cross bar and ring), a leaf fluke on each arm tip (ANCHOR_METAL, ink 2)
 * and two ANCHOR_RUST marks. Pale iron in dark lines, loops with holes in a column and an anchor
 * shape are the greyscale cue.
 */
export function paintAnchorShaft(ctx: CanvasRenderingContext2D): void {
  for (const parity of [0, 1]) {
    for (let i = parity; i < ANCHOR_LINK_COUNT; i += 2) {
      const cy = -(CHAIN_START + i * ANCHOR_LINK_PITCH) - LINK_H / 2;
      inkMany(ctx, [seg(roundedRect(0, cy, LINK_HALF_W, LINK_HALF_H, LINK_CORNER), LINK_W, ANCHOR_METAL, LINK_OL)]);
    }
  }

  const arms = (side: 1 | -1): Path2D => {
    const p = new Path2D();
    p.moveTo(side * 13, -12);
    p.quadraticCurveTo(side * 12, -SHANK_W / 2, 0, -SHANK_W / 2);
    return p;
  };
  const ring = new Path2D();
  ell(ring, 0, EYE_RING_Y, 3.2, 3.2);
  inkMany(ctx, [
    seg(line(0, -24.6, 0, -SHANK_W / 2), SHANK_W, ANCHOR_METAL, SHANK_OL),
    seg(arms(-1), SHANK_W, ANCHOR_METAL, SHANK_OL),
    seg(arms(1), SHANK_W, ANCHOR_METAL, SHANK_OL),
    seg(line(-8, -20, 8, -20), BAR_W, ANCHOR_METAL, SHANK_OL),
    seg(ring, TOP_RING_W, ANCHOR_METAL, TOP_RING_OL),
  ]);

  for (const [x, rot] of [
    [-12.5, 0.93],
    [12.5, -0.93],
  ] as const) {
    const fluke = new Path2D();
    ell(fluke, x, -13, 4.6, 2.8, rot);
    shape(ctx, fluke, ANCHOR_METAL, FLUKE_LW);
  }

  ctx.fillStyle = ANCHOR_RUST;
  for (const [x, y] of [
    [0, -13],
    [6, -SHANK_W / 2],
  ] as const) {
    const rust = new Path2D();
    ell(rust, x, y, 1.2, 1.2);
    ctx.fill(rust);
  }
}
