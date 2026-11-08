/**
 * Sharp litter painters: the lake's pit-floor hazard, a dented can and a bottle with a chipped neck
 * (issue #213; PRD N3; owner decision #209 Q6; guide 7v, 3g and 10).
 *
 * Every shape, size and colour here is derived (provisional): the litter is not in the approved
 * prototype. It follows the rules of the other hazards: gentle and toy-like, never gory. Every corner
 * is round, every dent and chip is a smooth curve, no shard, no spike, no jagged edge, no red, no
 * face. The "sharp" of the name is the rule (a touch costs a leg, shown by the shared poof), never
 * the look.
 *
 * Kinds. Two kinds share one frame (LITTER_TEX), anchored on the centre of the sprite, which is the
 * litter's logic point, so a kind is a texture choice and nothing moves:
 * - `can`: a short wide drum with a lid on top, a rounded dent in its right side and a dark dent
 *   mark on its face. Cool steel grey-blue;
 * - `bottle`: a tall slim body with a shoulder and a neck, the lip chipped by one rounded notch on
 *   its right. Glass green. Told from the can by shape first: tall and slim, against short and wide.
 *
 * Rim group (as the mud turtle, 7t). Hazards must stay visible on the lake's near-black water, where
 * ink is only 1.41:1, so every part is inked LITTER_INK outside, filled with the pale rim, then its
 * core, LITTER_RIM_W smaller on every side: all the inks first, then all the rims, then all the cores,
 * so the rim runs all round the silhouette and no ink or rim shows across a joint. The rim, not the
 * ink, holds the edge in the dark.
 *
 * Greyscale cues (10): a pale ring round a darker body (rim about 0.77, body about 0.2), a tall
 * slim shape against a short wide one. None relies on hue.
 *
 * Painters are still frames. No time, no randomness, no gradients, no game state, no Phaser.
 */
import { ell, frameFromBounds, type TexSize } from './canvasKit';
import { INK } from './palette';

// ---------------------------------------------------------------------------
// Colours and widths (guide 3g, 7v)
// ---------------------------------------------------------------------------

/** Can rim: a very pale steel #d6e6ee, luminance 0.7706, 11.25:1 with ink; 1.8 px, just inside the ink, all round. */
export const LITTER_CAN_RIM = '#d6e6ee';
/** Can body: a steel grey-blue #6f8796, luminance 0.2291. */
export const LITTER_CAN_BODY = '#6f8796';
/** Can lid face: a lighter steel #9fb6c2, luminance 0.4472. */
export const LITTER_CAN_LID = '#9fb6c2';
/** Can dent mark and pull tab: a darker steel #4d6370, luminance 0.1167. Inside the silhouette. */
export const LITTER_CAN_DENT = '#4d6370';
/** Bottle rim: a pale glass mint #cdebdc, luminance 0.7756, 11.3:1 with ink; 1.8 px, all round. */
export const LITTER_BOTTLE_RIM = '#cdebdc';
/** Bottle glass: a green #3f8570, luminance 0.1900. */
export const LITTER_BOTTLE_BODY = '#3f8570';
/** Bottle label band: a pale green #9fcdb8, luminance 0.5449. Inside the silhouette. */
export const LITTER_BOTTLE_LABEL = '#9fcdb8';
/** Shine on both kinds: a soft white stripe. Inside the silhouette, so alpha is allowed. */
export const LITTER_SHINE = 'rgba(255,255,255,0.4)';
/** Groove lines on the can: a pale steel at half alpha. Inside the silhouette. */
export const LITTER_GROOVE = 'rgba(214,230,238,0.55)';

/** Ink width outside every part, px. Smaller than LW so a 20 to 28 px sprite keeps its body. */
export const LITTER_INK = 2.4;
/** Width of the rim, px: the core of every part is this much smaller on every side. */
export const LITTER_RIM_W = 1.8;
/** Width of a groove or shine stripe, px. */
export const LITTER_DETAIL_W = 1.6;

// ---------------------------------------------------------------------------
// Frame, keys and geometry (guide 7v)
// ---------------------------------------------------------------------------

/** The two kinds of litter the painter draws. */
export type LitterKind = 'can' | 'bottle';

/** Every kind of litter, in the order the bake step lists them. */
export const LITTER_KINDS: readonly LitterKind[] = ['can', 'bottle'];

/** Keys the bake step uses (guide 7v). */
export const LITTER_KEYS = {
  can: 'litter-can',
  bottle: 'litter-bottle',
} as const;

/** The can: half width, the y of its top and base, the lid ellipse. */
export const LITTER_CAN_HALF_W = 7;
export const LITTER_CAN_TOP_Y = -8;
export const LITTER_CAN_BASE_Y = 10;
export const LITTER_CAN_LID_RX = 7.5;
export const LITTER_CAN_LID_RY = 2.6;
/** The bottle: body and neck half widths, base and lip y. */
export const LITTER_BOTTLE_BODY_HALF_W = 5.5;
export const LITTER_BOTTLE_NECK_HALF_W = 3;
export const LITTER_BOTTLE_BASE_Y = 11;
export const LITTER_BOTTLE_LIP_Y = -11;

/**
 * One frame for both kinds: the widest and tallest outline (the bottle's, 13.4 px each side of the
 * centre tall, the can's, 10 px wide) plus 3 px of padding. About 26 x 34.
 */
export const LITTER_TEX: TexSize = frameFromBounds(-10, -14, 10, 14, 3);

/** A rounded corner radius used by the can's body and the bottle's silhouette. */
const CORNER = 3;

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** One part of a rim group: the outer outline, its core, and the core's fill. */
interface Part {
  readonly outer: Path2D;
  readonly core: Path2D;
  readonly rim: string;
  readonly fill: string;
}

/** The can body as a path inset by `d` on each side: a drum with one smooth round dent in its right side. */
function canBody(d: number): Path2D {
  const p = new Path2D();
  const l = -LITTER_CAN_HALF_W + d;
  const r = LITTER_CAN_HALF_W - d;
  const t = LITTER_CAN_TOP_Y;
  const b = LITTER_CAN_BASE_Y - d;
  p.moveTo(l + CORNER, t);
  p.lineTo(r - CORNER, t);
  p.quadraticCurveTo(r, t, r, t + CORNER);
  p.lineTo(r, -1);
  p.quadraticCurveTo(r - 5, 2.5, r, 6); // the dent: a smooth round bite into the side
  p.lineTo(r, b - CORNER);
  p.quadraticCurveTo(r, b, r - CORNER, b);
  p.lineTo(l + CORNER, b);
  p.quadraticCurveTo(l, b, l, b - CORNER);
  p.lineTo(l, t + CORNER);
  p.quadraticCurveTo(l, t, l + CORNER, t);
  p.closePath();
  return p;
}

/** The can lid as an ellipse inset by `d`. */
function canLid(d: number): Path2D {
  const p = new Path2D();
  ell(p, 0, LITTER_CAN_TOP_Y, LITTER_CAN_LID_RX - d, LITTER_CAN_LID_RY - d * 0.6);
  return p;
}

/**
 * The bottle silhouette inset by `d`: base, body, shoulder, neck and a lip chipped by one rounded
 * notch on the right. Every corner and the notch are smooth curves.
 */
function bottleShape(d: number): Path2D {
  const p = new Path2D();
  const bw = LITTER_BOTTLE_BODY_HALF_W - d;
  const nw = LITTER_BOTTLE_NECK_HALF_W - d;
  const b = LITTER_BOTTLE_BASE_Y - d;
  const lip = LITTER_BOTTLE_LIP_Y + d;
  p.moveTo(-bw + CORNER, b);
  p.lineTo(bw - CORNER, b);
  p.quadraticCurveTo(bw, b, bw, b - CORNER);
  p.lineTo(bw, -1);
  p.quadraticCurveTo(bw, -4.5, nw, -5.5); // the right shoulder
  p.lineTo(nw, -7.6 + d * 0.5);
  p.quadraticCurveTo(nw, -8.8 + d * 0.5, nw * 0.45, -8.8 + d * 0.5); // the chip: a round bite out of the lip, right side
  p.quadraticCurveTo(-nw * 0.1, -8.8 + d * 0.5, -nw * 0.25, lip + 1.2);
  p.quadraticCurveTo(-nw * 0.3, lip, -nw * 0.6, lip);
  p.quadraticCurveTo(-nw, lip, -nw, lip + 0.9);
  p.lineTo(-nw, -5.5);
  p.quadraticCurveTo(-bw, -4.5, -bw, -1); // the left shoulder
  p.lineTo(-bw, b - CORNER);
  p.quadraticCurveTo(-bw, b, -bw + CORNER, b);
  p.closePath();
  return p;
}

/** Paint a rim group: all the inks, then all the rims, then all the cores. */
function rimGroup(ctx: CanvasRenderingContext2D, parts: readonly Part[]): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * LITTER_INK;
  for (const part of parts) ctx.stroke(part.outer);
  for (const part of parts) {
    ctx.fillStyle = part.rim;
    ctx.fill(part.outer);
  }
  for (const part of parts) {
    ctx.fillStyle = part.fill;
    ctx.fill(part.core);
  }
}

/** A single stroked line in a detail colour. */
function detailLine(ctx: CanvasRenderingContext2D, colour: string, points: readonly [number, number][]): void {
  const p = new Path2D();
  p.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) p.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = colour;
  ctx.lineWidth = LITTER_DETAIL_W;
  ctx.stroke(p);
}

/** A filled detail ellipse, with no ink: internal detail, never an edge. */
function detailEllipse(ctx: CanvasRenderingContext2D, colour: string, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  const p = new Path2D();
  ell(p, cx, cy, rx, ry, rot);
  ctx.fillStyle = colour;
  ctx.fill(p);
}

// ---------------------------------------------------------------------------
// Painters
// ---------------------------------------------------------------------------

function paintCan(ctx: CanvasRenderingContext2D): void {
  rimGroup(ctx, [
    { outer: canBody(0), core: canBody(LITTER_RIM_W), rim: LITTER_CAN_RIM, fill: LITTER_CAN_BODY },
    { outer: canLid(0), core: canLid(LITTER_RIM_W), rim: LITTER_CAN_RIM, fill: LITTER_CAN_LID },
  ]);
  // the dent mark on the face, two grooves and the pull tab: inside the silhouette, no ink
  detailEllipse(ctx, LITTER_CAN_DENT, -1.5, 3, 2.6, 3.6, 0.3);
  detailLine(ctx, LITTER_GROOVE, [[-4.4, -3.6], [2.6, -3.6]]);
  detailLine(ctx, LITTER_GROOVE, [[-4.4, 7.4], [2.6, 7.4]]);
  detailLine(ctx, LITTER_SHINE, [[-4.4, -1.2], [-4.4, 0.8]]);
  detailEllipse(ctx, LITTER_CAN_DENT, 1, LITTER_CAN_TOP_Y, 2, 0.9);
}

function paintBottle(ctx: CanvasRenderingContext2D): void {
  rimGroup(ctx, [{ outer: bottleShape(0), core: bottleShape(LITTER_RIM_W), rim: LITTER_BOTTLE_RIM, fill: LITTER_BOTTLE_BODY }]);
  // the label band, one shine stripe and a small round glass bubble: inside the silhouette, no ink
  detailEllipse(ctx, LITTER_BOTTLE_LABEL, 0, 3.5, 3.4, 2.8);
  detailLine(ctx, LITTER_SHINE, [[-3.2, -1.5], [-3.2, 1.5]]);
  detailEllipse(ctx, LITTER_SHINE, 0.2, 8, 1, 1);
}

/** Paint one kind of litter, centred on the origin (the litter's logic point). */
export function paintLitter(ctx: CanvasRenderingContext2D, kind: LitterKind): void {
  if (kind === 'can') paintCan(ctx);
  else paintBottle(ctx);
}
