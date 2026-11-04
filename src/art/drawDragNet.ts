/**
 * Drag net painters (issue #108, Area 10; ND-2): the two boats a net hangs between (leaning in the
 * warning), the float line and its cork floats, the lit floats (the reduced-motion warning), the
 * mesh curtain with its heavy outline (the sweep), the safe hollows' shade and the strands that
 * show round a caught axolotl wriggling out (guide 3g and 7p).
 *
 * Every shape, size and colour here is derived (provisional). Nothing shows a person, a face or
 * text, and nothing grabs: the net never moves, holds or traps the axolotl, and no mesh line is ever
 * painted over it (the scene draws the axolotl in front of the curtain). A catch shows only the
 * shared leg-loss poof or the Shell sparkle and the wriggle-out strands (A11, ADR 0007, ADR 0008).
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the
 * float rise, the lean, the curtain's position, the billow and the fades belong to the scene; the
 * positions belong to the logic (src/logic/dragNets.ts). The motion numbers are exported here as
 * plain constants. The curtain is painted for a sweep to the right (its leading edge at +x); the
 * scene mirrors it for a sweep to the left. Anchor points (a texture's origin):
 * - boat: the middle of the hull on the water line, as the fishing trajinera's (it is that same
 *   painting with no rod). The scene puts its middle 60 px outside the stretch's edge, so its inner
 *   end sits on the edge;
 * - float: its centre, on the rope. The scene puts one every DRAG_NET_FLOAT_SPACING px from the
 *   stretch's edge (dragNetFloatXs);
 * - lit float: the same centre as the float, so it replaces it;
 * - float line: its start, local (0, 0), the water line at one boat's inner end. It runs to +x;
 * - curtain: the top of the leading edge, local (0, 0), on the water line. The band runs back from
 *   it, DRAG_NET_CURTAIN_W wide, down to `h` at the stretch's bottom edge, one texture per stretch
 *   height. The leading edge is the sweep front (the logic's sweepFront); the billow bows it only
 *   forward, so what is drawn always reaches at least as far as what catches;
 * - hollow shade: its top-left corner, the hollow's rect;
 * - strands: their centre, on the caught axolotl's centre.
 *
 * Greyscale: quiet is a row of pale floats on a rope between two boats; the warning lifts the floats
 * and tips the boats, and the lit floats gain a white ring (a shape, not a hue); the sweep is a
 * band outlined dark, white, dark with a heavier front edge and a pale lattice inside; the hollows
 * are darker pockets the band never covers.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { BAILING_ROPE } from './drawBailingBucket';
import { DEEP_CANAL_SHADE_RGB } from './drawDeepCanal';
import { FISHING_BOAT_TEX, paintFishingBoat } from './drawFishingTrajinera';
import { INK, PEBBLE_A, WHITE } from './palette';
import type { SweepDirection } from '../logic/dragNets';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/** The float line's rope: the bailing rope's pale hemp #e8d3a0, luminance 0.6628, 9.77:1 with ink. */
export const DRAG_NET_ROPE = BAILING_ROPE;
/** The cork floats: the Floating cork tan #ecd7a8, luminance 0.6926, 10.18:1 with ink. */
export const DRAG_NET_FLOAT = '#ecd7a8';
/** The lit floats' fill, the reduced-motion warning: #fff6c4, luminance 0.9116, 13.18:1 with ink. */
export const DRAG_NET_FLOAT_LIT = '#fff6c4';
/** The lit floats' ring, the curtain's edges and the strands: white, with ink, 14.39:1. */
export const DRAG_NET_EDGE = WHITE;
/** The mesh lattice: white at half strength. It only lightens the water, so it is internal and never an edge. */
export const DRAG_NET_MESH = 'rgba(255,255,255,0.5)';
/** The sinkers along the curtain's foot: pebble A #d4cfe6, 9.50:1 with ink. */
export const DRAG_NET_SINKER = PEBBLE_A;
/** The hollow shade's alpha over the moored hulls' shade colour #22808f (DEEP_CANAL_SHADE_RGB). */
export const DRAG_NET_SHADE_ALPHA = 0.5;

// ---------------------------------------------------------------------------
// Motion numbers for the scene (px, seconds, radians)
// ---------------------------------------------------------------------------

/** The width of the mesh curtain along the sweep, px. */
export const DRAG_NET_CURTAIN_W = 40;
/** The most the curtain's front edge bows forward at mid-depth, px; the foot sways this much either way, px. */
export const DRAG_NET_BOW_MAX = 6;
export const DRAG_NET_SWAY_MAX = 3;

/**
 * Looks-only timing for the scene. Quiet: floats bob `quietBobPx` over `quietBobPeriod`. Warning
 * (full motion): floats lift `riseLift` px over `riseFor` and hold, the boats tip `leanRad`. Reduced
 * motion: lit floats and the lean at once, held, no motion. Sweep: the front bows up to `DRAG_NET_BOW_MAX`
 * on a `billowPeriod` sine; the curtain lifts out over `liftFade` and the floats and boats settle
 * over `settleFor`. A catch: the snag wriggle for `catchWriggleFor` with the strands showing; under
 * reduced motion the strands show still and fade over the same time.
 */
export const DRAG_NET_MOTION = Object.freeze({
  quietBobPx: 1.5,
  quietBobPeriod: 2,
  riseLift: 5,
  riseFor: 0.4,
  leanRad: 0.12,
  billowPeriod: 0.8,
  liftFade: 0.3,
  settleFor: 0.4,
  catchWriggleFor: 0.8,
});

/** The lean in radians of both boats in the warning, tops toward the way the net will sweep (0 for a vertical sweep). */
export function dragNetBoatLean(sweep: SweepDirection): number {
  if (sweep === 'right') return DRAG_NET_MOTION.leanRad;
  if (sweep === 'left') return -DRAG_NET_MOTION.leanRad;
  return 0;
}

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------

/**
 * Texture frame of a net boat: the fishing trajinera's hull frame, the same anchor (the middle of the
 * hull on the water line). The lean is the scene's rotation about this anchor, so it never crops.
 */
export const DRAG_NET_BOAT_TEX: TexSize = FISHING_BOAT_TEX;

/**
 * Paint a net boat around its anchor: the fishing trajinera's hull, bands, flowers and prow balls
 * with no rod. It never drifts.
 */
export function paintDragNetBoat(ctx: CanvasRenderingContext2D): void {
  paintFishingBoat(ctx);
}

// ---------------------------------------------------------------------------
// Float line and floats
// ---------------------------------------------------------------------------

/** The rope tube: colour width and the ink added each side. */
export const DRAG_NET_ROPE_W = 2.4;
export const DRAG_NET_ROPE_OL = 1.1;
/** The floats sit on the rope every this many px from the stretch's edge. */
export const DRAG_NET_FLOAT_SPACING = 32;
/** A float's radii, px, an oval 14 x 9, and its ink. */
export const DRAG_NET_FLOAT_RX = 7;
export const DRAG_NET_FLOAT_RY = 4.5;
const FLOAT_LW = 1.6;

/** Where the floats sit along a rope of `length` px: every DRAG_NET_FLOAT_SPACING px from its start, never on an end. */
export function dragNetFloatXs(length: number): number[] {
  const xs: number[] = [];
  for (let x = DRAG_NET_FLOAT_SPACING; x < length; x += DRAG_NET_FLOAT_SPACING) xs.push(x);
  return xs;
}

/**
 * Paint the float line from its start, local (0, 0), to (`length`, 0): a DRAG_NET_ROPE tube with an
 * INK line each side. The scene draws it live as one vector tube between the boats' inner ends.
 */
export function paintDragNetFloatLine(ctx: CanvasRenderingContext2D, length: number): void {
  inkMany(ctx, [seg(line(0, 0, length, 0), DRAG_NET_ROPE_W, DRAG_NET_ROPE, DRAG_NET_ROPE_OL)]);
}

/**
 * Texture frame of a float (provisional): the oval with its ink plus 4 px of padding. Anchor point is
 * its centre. The guide asks for 22 x 16; the oval's ink needs a little more to keep 4 px of padding.
 */
export const DRAG_NET_FLOAT_TEX: TexSize = frameFromBounds(
  -DRAG_NET_FLOAT_RX - FLOAT_LW / 2,
  -DRAG_NET_FLOAT_RY - FLOAT_LW / 2,
  DRAG_NET_FLOAT_RX + FLOAT_LW / 2,
  DRAG_NET_FLOAT_RY + FLOAT_LW / 2,
  PAD,
);

/** Paint a float around its centre: a DRAG_NET_FLOAT oval, 14 x 9, with ink 1.6. */
export function paintDragNetFloat(ctx: CanvasRenderingContext2D): void {
  const oval = new Path2D();
  ell(oval, 0, 0, DRAG_NET_FLOAT_RX, DRAG_NET_FLOAT_RY);
  shape(ctx, oval, DRAG_NET_FLOAT, FLOAT_LW);
}

/** The lit float's ring: 2 wide, 3 px out from the float's ink, inked 1 on its outside. */
const LIT_RING_W = 2;
const LIT_RING_GAP = 3;
const LIT_RING_OL = 1;
/** The ring's centreline radii. */
const LIT_RX = DRAG_NET_FLOAT_RX + FLOAT_LW / 2 + LIT_RING_GAP + LIT_RING_W / 2;
const LIT_RY = DRAG_NET_FLOAT_RY + FLOAT_LW / 2 + LIT_RING_GAP + LIT_RING_W / 2;

/**
 * Texture frame of a lit float (provisional): the ring with its ink plus 4 px of padding. Anchor
 * point is the float's centre.
 */
export const DRAG_NET_FLOAT_LIT_TEX: TexSize = frameFromBounds(
  -(LIT_RX + LIT_RING_W / 2 + LIT_RING_OL),
  -(LIT_RY + LIT_RING_W / 2 + LIT_RING_OL),
  LIT_RX + LIT_RING_W / 2 + LIT_RING_OL,
  LIT_RY + LIT_RING_W / 2 + LIT_RING_OL,
  PAD,
);

/**
 * Paint a lit float around its centre: the float in the DRAG_NET_FLOAT_LIT fill with ink 1.6, and a
 * white ring 2 wide round it, 3 px clear of its ink and inked 1 on its outside only. It replaces the
 * float through the warning and the sweep under reduced motion, held steady, never blinked. Lit
 * against unlit is only 1.29:1 by value, so the ring, a new shape round every float, carries the
 * change in greyscale.
 */
export function paintDragNetFloatLit(ctx: CanvasRenderingContext2D): void {
  const oval = new Path2D();
  ell(oval, 0, 0, DRAG_NET_FLOAT_RX, DRAG_NET_FLOAT_RY);
  shape(ctx, oval, DRAG_NET_FLOAT_LIT, FLOAT_LW);

  // the ink on the ring's outside, then the white ring over its inner part
  const outer = new Path2D();
  ell(outer, 0, 0, LIT_RX + (LIT_RING_W + LIT_RING_OL) / 2, LIT_RY + (LIT_RING_W + LIT_RING_OL) / 2);
  ctx.lineWidth = LIT_RING_OL;
  ctx.strokeStyle = INK;
  ctx.stroke(outer);
  const ring = new Path2D();
  ell(ring, 0, 0, LIT_RX, LIT_RY);
  ctx.lineWidth = LIT_RING_W;
  ctx.strokeStyle = DRAG_NET_EDGE;
  ctx.stroke(ring);
}

// ---------------------------------------------------------------------------
// Mesh curtain
// ---------------------------------------------------------------------------

/** The lattice: a diamond cell this many px wide, lines this wide, no ink. */
export const DRAG_NET_CELL = 12;
const MESH_W = 1.2;
/** The top, foot and trailing edges: white width and the ink added each side. */
const EDGE_W = 2.4;
const EDGE_OL = 1.1;
/** The heavier front edge. */
const FRONT_W = 3;
const FRONT_OL = 1.4;
/** The sinkers along the foot: radius, ink, and the gap between them. */
const SINKER_R = 2.6;
const SINKER_LW = 1.2;
export const DRAG_NET_SINKER_SPACING = 24;

/** Throws RangeError unless `h` is finite and greater than 0. */
function checkHeight(h: number): void {
  if (!Number.isFinite(h) || !(h > 0)) throw new RangeError(`drag net curtain: height must be finite and greater than 0, got ${h}`);
}

/**
 * Texture frame of the curtain for a stretch `h` px tall (provisional): the band with its outline,
 * the sinkers and room for the full bow and sway, plus 4 px of padding. Anchor point is the top of
 * the leading edge, local (0, 0), on the water line. Baked one per stretch height. Throws RangeError
 * for an `h` that is not finite and greater than 0.
 */
export function dragNetCurtainTex(h: number): TexSize {
  checkHeight(h);
  const edgeReach = EDGE_W / 2 + EDGE_OL;
  const frontReach = FRONT_W / 2 + FRONT_OL;
  return frameFromBounds(
    -DRAG_NET_CURTAIN_W - DRAG_NET_SWAY_MAX - edgeReach,
    -edgeReach,
    DRAG_NET_BOW_MAX + frontReach,
    h + Math.max(edgeReach, SINKER_R + SINKER_LW / 2),
    PAD,
  );
}

/** The band's silhouette, closed: the front edge bowing forward by `bow` at mid-depth, the foot swaying by `sway`. */
function bandPath(h: number, bow: number, sway: number): Path2D {
  const p = new Path2D();
  p.moveTo(-DRAG_NET_CURTAIN_W, 0);
  p.lineTo(0, 0);
  // control x so that the front's middle is `bow` px forward: the midpoint of the curve is 0.5 * control x
  p.quadraticCurveTo(2 * bow, h / 2, 0, h);
  p.lineTo(-DRAG_NET_CURTAIN_W + sway, h);
  p.closePath();
  return p;
}

/** The top, trailing and foot edges as one open path, from the front's top to the front's foot. */
function edgesPath(h: number, sway: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.lineTo(-DRAG_NET_CURTAIN_W, 0);
  p.lineTo(-DRAG_NET_CURTAIN_W + sway, h);
  p.lineTo(0, h);
  return p;
}

/** The front edge alone, from the top down to the foot. */
function frontPath(h: number, bow: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.quadraticCurveTo(2 * bow, h / 2, 0, h);
  return p;
}

/** The diamond lattice over the band: lines at 45 degrees both ways, a cell DRAG_NET_CELL px wide. */
function latticePath(h: number): Path2D {
  const p = new Path2D();
  const reach = DRAG_NET_BOW_MAX + DRAG_NET_CELL;
  for (let x = -DRAG_NET_CURTAIN_W - DRAG_NET_SWAY_MAX - h; x <= reach; x += DRAG_NET_CELL) {
    p.moveTo(x, 0);
    p.lineTo(x + h, h);
  }
  for (let x = -DRAG_NET_CURTAIN_W - DRAG_NET_SWAY_MAX; x <= reach + h; x += DRAG_NET_CELL) {
    p.moveTo(x, 0);
    p.lineTo(x - h, h);
  }
  return p;
}

/**
 * Paint the curtain around the top of its leading edge, for a stretch `h` px tall. `bow` (0 to
 * DRAG_NET_BOW_MAX, clamped) is how far the front edge bows forward at mid-depth and `sway` (plus or
 * minus DRAG_NET_SWAY_MAX, clamped) how far the foot's trailing corner shifts: the bow is only ever
 * forward, so the front is never behind the logic's front. In order: the diamond lattice clipped to
 * the band (DRAG_NET_MESH, no ink, see-through: it only lightens the water), then the outline as one
 * `inkMany` group, the top, trailing and foot edges white 2.4 with ink 1.1 a side and the front
 * edge white 3 with ink 1.4 a side, so the band reads dark, white, dark in greyscale with a heavier
 * front, then DRAG_NET_SINKER sinkers (radius 2.6, ink 1.2) every 24 px along the foot. Throws
 * RangeError for an `h` that is not finite and greater than 0.
 */
export function paintDragNetCurtain(ctx: CanvasRenderingContext2D, h: number, bow = 0, sway = 0): void {
  checkHeight(h);
  const bowPx = Math.min(DRAG_NET_BOW_MAX, Math.max(0, bow));
  const swayPx = Math.min(DRAG_NET_SWAY_MAX, Math.max(-DRAG_NET_SWAY_MAX, sway));

  ctx.save();
  ctx.clip(bandPath(h, bowPx, swayPx));
  ctx.lineWidth = MESH_W;
  ctx.strokeStyle = DRAG_NET_MESH;
  ctx.stroke(latticePath(h));
  ctx.restore();

  const segs: Seg[] = [
    seg(edgesPath(h, swayPx), EDGE_W, DRAG_NET_EDGE, EDGE_OL),
    seg(frontPath(h, bowPx), FRONT_W, DRAG_NET_EDGE, FRONT_OL),
  ];
  inkMany(ctx, segs);

  for (let x = -DRAG_NET_SINKER_SPACING / 2; x > -DRAG_NET_CURTAIN_W; x -= DRAG_NET_SINKER_SPACING) {
    const sinker = new Path2D();
    ell(sinker, x, h, SINKER_R, SINKER_R);
    shape(ctx, sinker, DRAG_NET_SINKER, SINKER_LW);
  }
}

// ---------------------------------------------------------------------------
// Safe hollow shade
// ---------------------------------------------------------------------------

/**
 * Texture frame of a hollow's shade: exactly the `w` x `h` rect, anchor its top-left corner, with no
 * ink and no padding (it is a see-through wash). Throws RangeError unless both are finite and greater than 0.
 */
export function dragNetHollowShadeTex(w: number, h: number): TexSize {
  checkHeight(w);
  checkHeight(h);
  return { w, h, originX: 0, originY: 0 };
}

/**
 * Paint a hollow's shade over its `w` x `h` rect from the top-left corner: the moored hulls' shade
 * colour (DEEP_CANAL_SHADE_RGB) at DRAG_NET_SHADE_ALPHA, no ink. Over the shallow, mid and deep
 * stops it keeps the deep canal floor (0.1792 or more). It is always shown, in every phase, so a kid
 * can plan before the warning; the scene keeps the curtain out of the rect.
 */
export function paintDragNetHollowShade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const [r, g, b] = DEEP_CANAL_SHADE_RGB;
  ctx.fillStyle = `rgba(${r},${g},${b},${DRAG_NET_SHADE_ALPHA})`;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Wriggle-out strands
// ---------------------------------------------------------------------------

/** Texture frame of the strands (provisional), as the guide's: 64 x 48, anchor its centre. */
export const DRAG_NET_STRANDS_TEX: TexSize = { w: 64, h: 48, originX: 32, originY: 24 };
/** The strands: white width and the ink added each side. */
const STRAND_W = 2;
const STRAND_OL = 1;
/** One strand's start, bend and end in the first quadrant; the other three mirror it. */
const STRAND_START: readonly [number, number] = [10, 7];
const STRAND_BEND: readonly [number, number] = [20, 5];
const STRAND_END: readonly [number, number] = [24, 15];

/**
 * Paint the strands round the caught axolotl's centre: four short white strands (2 wide, ink 1 a
 * side, one `inkMany` group), one in each quarter, bending away from it, as the mesh parting for it.
 * They are drawn round the axolotl, never over it, and nothing is drawn on its body: it is never
 * shown held or trapped. Dark, white, dark in greyscale.
 */
export function paintDragNetStrands(ctx: CanvasRenderingContext2D): void {
  const segs: Seg[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const p = new Path2D();
      p.moveTo(sx * STRAND_START[0], sy * STRAND_START[1]);
      p.quadraticCurveTo(sx * STRAND_BEND[0], sy * STRAND_BEND[1], sx * STRAND_END[0], sy * STRAND_END[1]);
      segs.push(seg(p, STRAND_W, DRAG_NET_EDGE, STRAND_OL));
    }
  }
  inkMany(ctx, segs);
}
