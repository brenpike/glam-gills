/**
 * Murky water painters (issue #107, ND-1): the brown patch cloud of dirty water with its swirl
 * frames and still frame, the dotted outline that marks a patch in greyscale, the dim ring round
 * the axolotl while it is in a patch, the small ring meter that fills as the murky timer builds,
 * and the warning cue (a cheek tint and a few little bubbles). Guide 3c (murky water state), 3g,
 * 7j, 9 and 10.
 *
 * Every shape, size and colour here is derived (provisional). Nothing here is scary: no face, no
 * skull, no text, no red, no sickness drawn on the axolotl beyond a soft cheek tint, and nothing
 * shows the water hurting the axolotl (A11, ADR 0007, ADR 0008). The cost of a long stay is the
 * shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. Which swirl frame
 * shows, when the cue shows and the share the meter is drawn at belong to the scene. Anchor points
 * (a texture's origin):
 * - cloud and outline: the patch's centre, local (0, 0). A patch is a hazard rect, so the art takes
 *   its width and height. The painted cloud and the dots stay inside the rect, so what the player
 *   sees is the rect the logic tests. The frame is the rect plus 4 px of padding (murkyPatchTex);
 * - dim ring: the axolotl's centre, local (0, 0), sized for the default look at Large like the
 *   protected halo. Its hole is wider than the axolotl, so the hero is never dimmed;
 * - meter: the ring's centre. The scene puts it a little above the axolotl;
 * - cheeks: the axolotl's local origin, on its two cheeks (the queasy cheek patches' places, so the
 *   eyes, the mouth and a girl's cheek heart stay clear);
 * - bubbles: the centre of the three-bubble cluster. The scene puts it above the axolotl's head.
 *
 * See-through: the cloud is two layers of one khaki brown at alpha 0.34 and 0.22, so its densest
 * place is 0.485 (under MURKY_CLOUD_MAX_ALPHA). Laid over any deep canal water or bed colour it keeps
 * a luminance of 0.1687 or more, the floor at which ink holds 3:1 (guide 10, the pair method), so
 * the axolotl, a threat or the exit seen through it keeps its ink outline at 3:1. The dim ring
 * keeps that floor too, on top of the cloud.
 *
 * Greyscale: the cloud is a soft tint, so it carries nothing alone. The patch is marked by a ring of
 * small opaque dots (a pale fill with an ink outline) round its rect: smaller, closer and tan,
 * against the Home Spot's big white dots on a circle, and a rounded rectangle, not a circle. The
 * meter is a ring that fills clockwise from the top with an ink tick at the warning share, so
 * progress reads by arc length. The bubbles are three round, ink-outlined discs of falling size.
 */
import { ell, frameFromBounds, inkMany, seg, shape, TAU, type TexSize } from './canvasKit';
import { QUEASY_CHEEK_INNER_FRACTION, QUEASY_CHEEK_LOCAL } from './drawPond';
import { INK } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 3g, 10)
// ---------------------------------------------------------------------------

/** The cloud's outer layer: a khaki brown at alpha 0.34. No ink: the cloud is a soft tint. */
export const MURKY_CLOUD_OUTER = 'rgba(168,128,72,0.34)';
/** The cloud's inner layer, 62 percent of the rect: adds 0.22, so the middle is 0.485. */
export const MURKY_CLOUD_INNER = 'rgba(168,128,72,0.22)';
/** The most opaque the cloud gets anywhere, as 1 - (1 - 0.34) x (1 - 0.22). */
export const MURKY_CLOUD_MAX_ALPHA = 0.5;
/** The swirl lines: pale silt, alpha 0.42. Inside the cloud, so no ink. */
export const MURKY_SWIRL = 'rgba(226,198,140,0.42)';
/** The outline dots' fill: a pale warm #f1e6c8, luminance 0.7946, 11.58:1 with ink. */
export const MURKY_DOT = '#f1e6c8';
/** The dim ring, two layers of one dark khaki: alpha 0.26 and 0.16. No ink. */
export const MURKY_DIM_OUTER = 'rgba(150,118,66,0.26)';
export const MURKY_DIM_INNER = 'rgba(150,118,66,0.16)';
/** The meter's empty track: #f1e6c8 (the dots' pale), 11.58:1 with ink. */
export const MURKY_METER_TRACK = '#f1e6c8';
/** The meter's fill: a dark brown #6b4423, luminance about 0.0777, 4.7:1 against the track. */
export const MURKY_METER_FILL = '#6b4423';
/** The cheek tint: a muddy ochre over the cheeks, in two layers (alpha 0.30 and 0.22), no ink. */
export const MURKY_CHEEK_OUTER = 'rgba(176,132,48,0.30)';
export const MURKY_CHEEK_INNER = 'rgba(176,132,48,0.22)';
/** The little bubbles' fill: a pale #eaf3e4, luminance about 0.88, 12.7:1 with ink. They reach the outer edge. */
export const MURKY_BUBBLE = '#eaf3e4';
/** The one soft shine on each bubble. Inside the silhouette, so alpha is allowed. */
export const MURKY_BUBBLE_SHINE = 'rgba(255,255,255,0.9)';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Patch cloud: still frame and swirl frames
// ---------------------------------------------------------------------------

/** The smallest side of a patch the art draws, px. A smaller rect throws a RangeError. */
export const MURKY_MIN_SIDE = 48;
/** How far the cloud's body is inset from the rect, px; the lobes fill this gap, so they reach the rect. */
export const MURKY_LOBE_DEPTH = 6;
/** About how far apart the lobes along an edge are, px. */
export const MURKY_LOBE_SPACING = 32;
/** The inner layer's size as a fraction of the rect. */
export const MURKY_INNER_FRACTION = 0.62;
/** Swirl frames in one loop, and the loop's length in seconds (slow, guide 9). Frame 0 is where the loop starts. */
export const MURKY_SWIRL_FRAMES = 6;
export const MURKY_SWIRL_PERIOD = 4;
/** Swirls: about one per this many px of patch width; the most radius one gets; the arcs and how far each sweeps. */
export const MURKY_SWIRL_SPACING = 170;
export const MURKY_SWIRL_MAX_R = 50;
export const MURKY_SWIRL_ARCS = 3;
export const MURKY_SWIRL_SWEEP = 1.3;
/** Width of a swirl line. */
export const MURKY_SWIRL_W = 3;

function checkSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < MURKY_MIN_SIDE || height < MURKY_MIN_SIDE) {
    throw new RangeError(`murky patch ${width} x ${height} must be finite and at least ${MURKY_MIN_SIDE} px each way`);
  }
}

/**
 * Texture frame of a patch's cloud and of its dotted outline (provisional): the rect, `width` by
 * `height`, plus 4 px of padding. Anchor point is the patch's centre, local (0, 0). Throws RangeError
 * for a rect under MURKY_MIN_SIDE or not finite.
 */
export function murkyPatchTex(width: number, height: number): TexSize {
  checkSize(width, height);
  return frameFromBounds(-width / 2, -height / 2, width / 2, height / 2, PAD);
}

/** Add a clockwise rounded rect, `a` and `b` half sides and `c` corner radius, centred on (0, 0). */
function roundedRect(p: Path2D, a: number, b: number, c: number): void {
  p.moveTo(-a + c, -b);
  p.lineTo(a - c, -b);
  p.arc(a - c, -b + c, c, -Math.PI / 2, 0);
  p.lineTo(a, b - c);
  p.arc(a - c, b - c, c, 0, Math.PI / 2);
  p.lineTo(-a + c, b);
  p.arc(-a + c, b - c, c, Math.PI / 2, Math.PI);
  p.lineTo(-a, -b + c);
  p.arc(-a + c, -b + c, c, Math.PI, Math.PI * 1.5);
  p.closePath();
}

/** The lobe count along an edge of this length. */
function lobeCount(length: number): number {
  return Math.max(2, Math.round(length / MURKY_LOBE_SPACING));
}

/** The corner radius for a rect with these half sides. */
function cornerOf(a: number, b: number): number {
  return Math.min(24, a * 0.5, b * 0.5);
}

/** One lobe: an ellipse centre, radii. The ones on the top and bottom edges are wide; the ones on the sides are tall. */
export interface MurkyLobe {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/**
 * The lobes that make the cloud's edge uneven, for a patch `width` by `height`: ellipses centred on
 * the inset edge, MURKY_LOBE_DEPTH deep, so the outermost of each reaches exactly the rect. Top,
 * bottom, left, then right; each edge's lobes in order.
 */
export function murkyLobes(width: number, height: number): MurkyLobe[] {
  checkSize(width, height);
  const hw = width / 2;
  const hh = height / 2;
  const d = MURKY_LOBE_DEPTH;
  const spanX = hw - 2 * d;
  const spanY = hh - 2 * d;
  const lobes: MurkyLobe[] = [];
  const nx = lobeCount(2 * spanX);
  for (const y of [-(hh - d), hh - d]) {
    for (let i = 0; i < nx; i++) lobes.push({ x: -spanX + ((i + 0.5) * 2 * spanX) / nx, y, rx: (spanX / nx) * 1.1, ry: d });
  }
  const ny = lobeCount(2 * spanY);
  for (const x of [-(hw - d), hw - d]) {
    for (let i = 0; i < ny; i++) lobes.push({ x, y: -spanY + ((i + 0.5) * 2 * spanY) / ny, rx: d, ry: (spanY / ny) * 1.1 });
  }
  return lobes;
}

/**
 * Paint the cloud body around the patch's centre: the outer layer (a rounded rect inset
 * MURKY_LOBE_DEPTH with the lobes round its edge, filled once so the overlaps do not darken) in
 * MURKY_CLOUD_OUTER, then the inner layer in MURKY_CLOUD_INNER. No ink, no swirl.
 */
function paintCloudBody(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const a = width / 2 - MURKY_LOBE_DEPTH;
  const b = height / 2 - MURKY_LOBE_DEPTH;
  const outer = new Path2D();
  roundedRect(outer, a, b, cornerOf(a, b));
  for (const l of murkyLobes(width, height)) ell(outer, l.x, l.y, l.rx, l.ry);
  ctx.fillStyle = MURKY_CLOUD_OUTER;
  ctx.fill(outer);

  const ia = (width / 2) * MURKY_INNER_FRACTION;
  const ib = (height / 2) * MURKY_INNER_FRACTION;
  const inner = new Path2D();
  roundedRect(inner, ia, ib, cornerOf(ia, ib));
  ctx.fillStyle = MURKY_CLOUD_INNER;
  ctx.fill(inner);
}

/**
 * Paint the reduced-motion still frame of a patch's cloud, around its centre: the cloud body only.
 * Nothing in it swirls or has a swirl line, so it is the same whatever the time.
 */
export function paintMurkyStill(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  checkSize(width, height);
  paintCloudBody(ctx, width, height);
}

/** One swirl's centre and radius. */
export interface MurkySwirl {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * The swirls of a patch `width` by `height`: one about every MURKY_SWIRL_SPACING px along its
 * width, on its middle line, each as big as the patch allows up to MURKY_SWIRL_MAX_R and no smaller
 * than 8 px.
 */
export function murkySwirls(width: number, height: number): MurkySwirl[] {
  checkSize(width, height);
  const n = Math.max(1, Math.round(width / MURKY_SWIRL_SPACING));
  const r = Math.max(8, Math.min(MURKY_SWIRL_MAX_R, height / 2 - 12, width / (2 * n) - 10));
  return Array.from({ length: n }, (_, i) => ({ x: -width / 2 + ((i + 0.5) * width) / n, y: 0, r }));
}

/**
 * Paint one swirl frame of a patch's cloud, around its centre: the cloud body, then in every swirl
 * MURKY_SWIRL_ARCS pale arcs (MURKY_SWIRL) of growing radius, a third of a turn apart, that turn
 * one MURKY_SWIRL_FRAMES-th of a full turn more with each `frame`. Frame MURKY_SWIRL_FRAMES is
 * frame 0, so the loop has no jump. Any whole `frame` works.
 */
export function paintMurkySwirl(ctx: CanvasRenderingContext2D, width: number, height: number, frame: number): void {
  checkSize(width, height);
  paintCloudBody(ctx, width, height);
  const turn = (((Math.trunc(frame) % MURKY_SWIRL_FRAMES) + MURKY_SWIRL_FRAMES) % MURKY_SWIRL_FRAMES) * (TAU / MURKY_SWIRL_FRAMES);
  ctx.lineWidth = MURKY_SWIRL_W;
  ctx.strokeStyle = MURKY_SWIRL;
  for (const s of murkySwirls(width, height)) {
    for (let k = 0; k < MURKY_SWIRL_ARCS; k++) {
      const start = turn + (k * TAU) / MURKY_SWIRL_ARCS;
      const arc = new Path2D();
      arc.arc(s.x, s.y, s.r * (0.4 + 0.3 * k), start, start + MURKY_SWIRL_SWEEP);
      ctx.stroke(arc);
    }
  }
}

// ---------------------------------------------------------------------------
// Dotted outline (the greyscale cue)
// ---------------------------------------------------------------------------

/** Radius of one outline dot, its ink line and the gap between dot centres along the edge, px (the Home Spot's are 3, 2.0 and 16). */
export const MURKY_DOT_R = 2.2;
export const MURKY_DOT_INK = 1.6;
export const MURKY_DOT_SPACING = 12;
/** How far in from the rect the dot centres sit, so a dot's ink stays inside the rect. */
const DOT_INSET = MURKY_DOT_R + MURKY_DOT_INK / 2;

/**
 * Where the outline's dots are, around the patch's centre: evenly spaced round a rounded rect
 * inset DOT_INSET from the patch's rect, one about every MURKY_DOT_SPACING px (at least 8), going
 * clockwise from the top edge's start.
 */
export function murkyDotPoints(width: number, height: number): [number, number][] {
  checkSize(width, height);
  const a = width / 2 - DOT_INSET;
  const b = height / 2 - DOT_INSET;
  const c = cornerOf(a, b);
  const edgeX = 2 * (a - c);
  const edgeY = 2 * (b - c);
  const corner = (Math.PI * c) / 2;
  const total = 2 * edgeX + 2 * edgeY + 4 * corner;
  const n = Math.max(8, Math.round(total / MURKY_DOT_SPACING));
  /** Each piece of the outline: its length and where it is at distance t along it. */
  const pieces: [number, (t: number) => [number, number]][] = [
    [edgeX, (t) => [-a + c + t, -b]],
    [corner, (t) => [a - c + c * Math.sin(t / c), -b + c - c * Math.cos(t / c)]],
    [edgeY, (t) => [a, -b + c + t]],
    [corner, (t) => [a - c + c * Math.cos(t / c), b - c + c * Math.sin(t / c)]],
    [edgeX, (t) => [a - c - t, b]],
    [corner, (t) => [-a + c - c * Math.sin(t / c), b - c + c * Math.cos(t / c)]],
    [edgeY, (t) => [-a, b - c - t]],
    [corner, (t) => [-a + c - c * Math.cos(t / c), -b + c - c * Math.sin(t / c)]],
  ];
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let s = (i * total) / n;
    let placed = false;
    for (const [length, at] of pieces) {
      if (s <= length) {
        points.push(at(s));
        placed = true;
        break;
      }
      s -= length;
    }
    // float error can leave a hair past the last piece: put the dot at its end
    if (!placed) points.push(pieces[pieces.length - 1][1](pieces[pieces.length - 1][0]));
  }
  return points;
}

/**
 * Paint the dotted outline around the patch's centre: one MURKY_DOT disc per place in
 * murkyDotPoints, each with an opaque INK outline MURKY_DOT_INK wide. Opaque and the same in every
 * frame, so it is baked once and holds the patch's edge in greyscale and under reduced motion.
 */
export function paintMurkyOutline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const dots = new Path2D();
  for (const [x, y] of murkyDotPoints(width, height)) ell(dots, x, y, MURKY_DOT_R, MURKY_DOT_R);
  shape(ctx, dots, MURKY_DOT, MURKY_DOT_INK);
}

// ---------------------------------------------------------------------------
// Dim ring round the axolotl
// ---------------------------------------------------------------------------

/**
 * Radii of the dim ring's outer and inner edges, px: sized for the default look at Large, with a
 * hole wider than the axolotl (about 121 x 85 in the scene) so it is never dimmed. Like the
 * protected halo, the scene scales it for the look (protectedHaloLookScale).
 */
export const MURKY_DIM_OUTER_RX = 104;
export const MURKY_DIM_OUTER_RY = 70;
export const MURKY_DIM_HOLE_RX = 70;
export const MURKY_DIM_HOLE_RY = 46;
/** The soft inner band's edges: a band between these adds the second layer. */
export const MURKY_DIM_BAND_OUT_RX = 92;
export const MURKY_DIM_BAND_OUT_RY = 62;
export const MURKY_DIM_BAND_IN_RX = 80;
export const MURKY_DIM_BAND_IN_RY = 53;

/** Texture frame of the dim ring (provisional): its outer edge plus 4 px of padding. Anchor point is its centre. */
export const MURKY_DIM_TEX: TexSize = frameFromBounds(-MURKY_DIM_OUTER_RX, -MURKY_DIM_OUTER_RY, MURKY_DIM_OUTER_RX, MURKY_DIM_OUTER_RY, PAD);

/**
 * Paint the dim ring around its centre: the band between the outer and hole ellipses in
 * MURKY_DIM_OUTER, and a narrower band in MURKY_DIM_INNER on top of it for a softer look. Both
 * are filled even-odd, so the middle stays clear. No ink, no gradient.
 */
export function paintMurkyDimRing(ctx: CanvasRenderingContext2D): void {
  const outer = new Path2D();
  ell(outer, 0, 0, MURKY_DIM_OUTER_RX, MURKY_DIM_OUTER_RY);
  ell(outer, 0, 0, MURKY_DIM_HOLE_RX, MURKY_DIM_HOLE_RY);
  ctx.fillStyle = MURKY_DIM_OUTER;
  ctx.fill(outer, 'evenodd');
  const band = new Path2D();
  ell(band, 0, 0, MURKY_DIM_BAND_OUT_RX, MURKY_DIM_BAND_OUT_RY);
  ell(band, 0, 0, MURKY_DIM_BAND_IN_RX, MURKY_DIM_BAND_IN_RY);
  ctx.fillStyle = MURKY_DIM_INNER;
  ctx.fill(band, 'evenodd');
}

// ---------------------------------------------------------------------------
// Ring meter
// ---------------------------------------------------------------------------

/** The meter ring's radius to the middle of its band, the band's width and the ink added each side, px. */
export const MURKY_METER_R = 12;
export const MURKY_METER_W = 5;
export const MURKY_METER_OL = 1.6;
/** The share of the ring at which the warning cue shows: 2 s of 3 s (MURKY_WATER_TIMING). An ink tick marks it. */
export const MURKY_METER_WARN_SHARE = 2 / 3;
/** Width of the warning tick. */
const METER_TICK_W = 1.8;
/** Where the fill starts: straight up, in canvas angles (y down). It fills clockwise. */
export const MURKY_METER_START = -Math.PI / 2;

const METER_REACH = MURKY_METER_R + MURKY_METER_W / 2 + MURKY_METER_OL;

/** Texture frame of the meter (provisional): the ring with its ink plus 4 px of padding. Anchor point is its centre. */
export const MURKY_METER_TEX: TexSize = frameFromBounds(-METER_REACH, -METER_REACH, METER_REACH, METER_REACH, PAD);

/** A fill share held to 0..1; a share that is not a number is 0. */
export function clampMurkyShare(share: number): number {
  return Number.isNaN(share) ? 0 : Math.min(1, Math.max(0, share));
}

/**
 * Paint the ring meter around its centre at `share` (0 empty, 1 full; held to that range): the
 * track, a MURKY_METER_TRACK band in an ink tube, then the MURKY_METER_FILL arc from the top
 * clockwise over `share` of the circle (butt ends, none at 0), then an ink tick across the band at
 * MURKY_METER_WARN_SHARE. Arc length, not hue, shows how full it is.
 */
export function paintMurkyMeter(ctx: CanvasRenderingContext2D, share: number): void {
  const filled = clampMurkyShare(share);
  const track = new Path2D();
  track.arc(0, 0, MURKY_METER_R, 0, TAU);
  inkMany(ctx, [seg(track, MURKY_METER_W, MURKY_METER_TRACK, MURKY_METER_OL)]);

  if (filled > 0) {
    const fill = new Path2D();
    fill.arc(0, 0, MURKY_METER_R, MURKY_METER_START, MURKY_METER_START + TAU * filled);
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineWidth = MURKY_METER_W;
    ctx.strokeStyle = MURKY_METER_FILL;
    ctx.stroke(fill);
    ctx.restore();
  }

  const angle = MURKY_METER_START + TAU * MURKY_METER_WARN_SHARE;
  const tick = new Path2D();
  tick.moveTo(Math.cos(angle) * (MURKY_METER_R - MURKY_METER_W / 2 - MURKY_METER_OL), Math.sin(angle) * (MURKY_METER_R - MURKY_METER_W / 2 - MURKY_METER_OL));
  tick.lineTo(Math.cos(angle) * METER_REACH, Math.sin(angle) * METER_REACH);
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = METER_TICK_W;
  ctx.strokeStyle = INK;
  ctx.stroke(tick);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Warning cue: cheek tint
// ---------------------------------------------------------------------------

/**
 * Texture frame of the cheek tint (provisional): the two cheek patches plus 2 px of padding. Anchor
 * point is the axolotl's local origin, so the sprite lines up with the body (as the queasy cheeks).
 */
export const MURKY_CHEEKS_TEX: TexSize = frameFromBounds(
  Math.min(...QUEASY_CHEEK_LOCAL.map((c) => c.x - c.rx)),
  Math.min(...QUEASY_CHEEK_LOCAL.map((c) => c.y - c.ry)),
  Math.max(...QUEASY_CHEEK_LOCAL.map((c) => c.x + c.rx)),
  Math.max(...QUEASY_CHEEK_LOCAL.map((c) => c.y + c.ry)),
  2,
);

/**
 * Paint the cheek tint in the axolotl's local units, origin at its local (0, 0): the two cheek
 * patches of the queasy tint's places, an outer layer in MURKY_CHEEK_OUTER and the inner
 * QUEASY_CHEEK_INNER_FRACTION of it in MURKY_CHEEK_INNER. No ink, and see-through, so the blush,
 * the mouth and a girl's cheek heart stay readable. A muddy ochre, not the queasy leaf green.
 */
export function paintMurkyCheeks(ctx: CanvasRenderingContext2D): void {
  const outer = new Path2D();
  const inner = new Path2D();
  for (const c of QUEASY_CHEEK_LOCAL) {
    ell(outer, c.x, c.y, c.rx, c.ry);
    ell(inner, c.x, c.y, c.rx * QUEASY_CHEEK_INNER_FRACTION, c.ry * QUEASY_CHEEK_INNER_FRACTION);
  }
  ctx.fillStyle = MURKY_CHEEK_OUTER;
  ctx.fill(outer);
  ctx.fillStyle = MURKY_CHEEK_INNER;
  ctx.fill(inner);
}

// ---------------------------------------------------------------------------
// Warning cue: little bubbles
// ---------------------------------------------------------------------------

/** One little bubble: its centre and radius. */
export interface MurkyBubble {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** The three bubbles, rising and shrinking, a little off the straight. The anchor point is the bottom one's centre. */
export const MURKY_BUBBLES: readonly MurkyBubble[] = Object.freeze([
  Object.freeze({ x: 0, y: 0, r: 4.6 }),
  Object.freeze({ x: 7, y: -11, r: 3.6 }),
  Object.freeze({ x: -2, y: -20, r: 2.8 }),
]);
/** The bubbles' ink outline, centred on each edge. */
export const MURKY_BUBBLE_INK = 1.6;

/** Texture frame of the bubbles (provisional): every bubble with its outline plus 4 px of padding. */
export const MURKY_BUBBLES_TEX: TexSize = frameFromBounds(
  Math.min(...MURKY_BUBBLES.map((b) => b.x - b.r)) - MURKY_BUBBLE_INK / 2,
  Math.min(...MURKY_BUBBLES.map((b) => b.y - b.r)) - MURKY_BUBBLE_INK / 2,
  Math.max(...MURKY_BUBBLES.map((b) => b.x + b.r)) + MURKY_BUBBLE_INK / 2,
  Math.max(...MURKY_BUBBLES.map((b) => b.y + b.r)) + MURKY_BUBBLE_INK / 2,
  PAD,
);

/**
 * Paint the little bubbles around the cluster's anchor point: three MURKY_BUBBLE discs, each with an
 * opaque INK outline MURKY_BUBBLE_INK wide and one soft shine (MURKY_BUBBLE_SHINE) at its upper
 * left. The scene fades or lifts them in the warning; the outlined round discs of falling size hold
 * in greyscale.
 */
export function paintMurkyBubbles(ctx: CanvasRenderingContext2D): void {
  for (const b of MURKY_BUBBLES) {
    const disc = new Path2D();
    ell(disc, b.x, b.y, b.r, b.r);
    shape(ctx, disc, MURKY_BUBBLE, MURKY_BUBBLE_INK);
    const shine = new Path2D();
    ell(shine, b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.28, b.r * 0.2, -0.5);
    ctx.fillStyle = MURKY_BUBBLE_SHINE;
    ctx.fill(shine);
  }
}
