/**
 * Bailing bucket painters (issue #107, Area 9; ND-2): a moored bailing boat, the bucket that comes
 * down from it on a short rope, the bucket's shadow and surface ripples (the warning), the bucket's
 * front wall and rim (which the scene draws over a peeking axolotl) and the splash ring at the
 * landing (guide 3c, 7 and 10).
 *
 * Every shape, size and colour here is derived (provisional). Nothing shows a person, a face or
 * text (Q3 A), and nothing grabs: the bucket is a round, open-topped, plain bucket with a bail
 * handle. It has no teeth, no claws, no hand, no jaw, no eye and no pointed part. A catch is a
 * scoop into a bucket and a toss, never a bite or a grip (A11, ADR 0007, ADR 0008).
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the
 * shadow's fade in over the warning, the dip, the toss arc and the reduced-motion fades belong to
 * the scene. Anchor points (a texture's origin):
 * - boat: the middle of a whole moored hull on the water line, local (0, 0). The hull is
 *   BAILING_BOAT_W wide, rises BAILING_BOAT_RISE_MID px above the water line in the middle (its two
 *   ends rise higher, like a trajinera's) and hangs BAILING_BOAT_DEPTH px below it. A short post
 *   rises from the middle of the deck to BAILING_BOAT_POST_TOP_Y, where the rope ties on. It is a
 *   whole hull, not the moored shade's hull that hangs from the water line (drawDeepCanal.ts
 *   paintMooredHull), and it has a post and no flower arch, so it is not a gliding trajinera;
 * - bucket: the middle of the bucket's rim ellipse, local (0, 0). The body hangs BAILING_BUCKET_H px
 *   below it; a bail handle arches BAILING_BAIL_RISE px above it, and a rope of BAILING_ROPE_LENGTH px
 *   runs up from the handle's top to BAILING_ROPE_TOP_Y, where the scene meets the boat's tie point;
 * - front: the same anchor point as the bucket. It paints the bucket's front wall and the front
 *   half of its lip, the same pixels the whole bucket ends with. The scene draws it over a peeking
 *   axolotl that sits in the bucket's mouth, so the axolotl shows over the back of the rim and
 *   inside the bucket and is covered by the front wall;
 * - shadow (the warning cue): the middle of the bucket-shaped shadow's rim ellipse. The scene
 *   puts it BAILING_SHADOW_ALONG px below the surface and fades it in over the warning;
 * - ripples: the centre of two broken rings on the water. The scene puts it BAILING_RIPPLES_ALONG px
 *   below the surface, over the bucket's x;
 * - splash: the centre of the landing splash ring. The scene puts it on the landing point.
 *
 * Greyscale: every part has an opaque ink outline and its fills are pale (the hull cream, the
 * bucket body, the lip, the rope and the white of the cue are each 9:1 or better with ink, so
 * each holds 3:1 or better on any background by the pair method). The hull bands are kept apart by
 * ink lines, the bucket reads as pale with two dark hoop lines and a dark mouth, the shadow as a
 * white bucket silhouette with a dark rim line, the ripples as four dark-white-dark arcs with
 * gaps, and the splash as a closed ring with drops over it, so none of them depends on hue.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { ANCHOR_METAL } from './drawAnchorDrop';
import { BOAT_SEAM, BOAT_SHINE, RAIL_LINE_W } from './drawDeepCanal';
import { BOAT_HULL, BOAT_ORANGE, BOAT_PINK, BOAT_TEAL } from './drawPuntingPole';
import { INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 10)
// ---------------------------------------------------------------------------

/** The bucket body: a pale warm enamel #f8e7a6, luminance 0.7986, 11.63:1 with ink. It reaches the outer edge. */
export const BAILING_BUCKET_BODY = '#f8e7a6';
/** The bucket's lip: white, with ink each side (14.39:1). */
export const BAILING_BUCKET_LIP = WHITE;
/** The inside of the bucket's mouth: a dark brown, inside the lip, so no ink of its own. */
export const BAILING_BUCKET_INSIDE = '#4a3626';
/** The bucket's shine strip, inside the silhouette, so no ink. */
export const BAILING_BUCKET_SHINE = 'rgba(255,255,255,0.7)';
/** The rope: a pale hemp #e8d3a0, luminance 0.6628, 9.77:1 with ink. It reaches the outer edge. */
export const BAILING_ROPE = '#e8d3a0';
/** The shadow cue: white, with ink all round (14.39:1). */
export const BAILING_SHADOW = WHITE;
/** The ripple arcs and the splash ring and drops: white, with ink each side. */
export const BAILING_RIPPLE = WHITE;

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Bailing boat (a whole moored trajinera hull)
// ---------------------------------------------------------------------------

/** The hull's length along the water line, px: both ends are half this far from the middle. */
export const BAILING_BOAT_W = 120;
/** How far the middle of the gunwale rises above the water line, px. */
export const BAILING_BOAT_RISE_MID = 8;
/** How far the two raised ends rise above the water line, px. */
export const BAILING_BOAT_RISE_END = 15;
/** How far the hull hangs below the water line, px. */
export const BAILING_BOAT_DEPTH = 18;
/** The post's top, px above the water line (negative is up): where the rope ties on. */
export const BAILING_BOAT_POST_TOP_Y = -30;
const BOAT_HALF_W = BAILING_BOAT_W / 2;
const BOAT_CORNER = 12;
const BOAT_LW = LW * 0.8;
/** Band edges down the hull, px from the water line: a cream rail above the first, three bands below. */
const BOAT_BAND_EDGES: readonly [number, number, number, number] = [-3, 3, 9, BAILING_BOAT_DEPTH + 2];
/** The order of the three paint colours down the hull, top to bottom. */
export const BAILING_BOAT_BANDS: readonly [string, string, string] = [BOAT_TEAL, BOAT_PINK, BOAT_ORANGE];
/** The post: width and the ink added each side. */
const POST_W = 5;
const POST_OL = 1.4;

/** The hull's outline, closed: raised ends, a dipping gunwale, rounded lower corners and a flat bottom. */
function boatHullPath(): Path2D {
  const p = new Path2D();
  p.moveTo(BOAT_HALF_W, -BAILING_BOAT_RISE_END);
  p.quadraticCurveTo(BOAT_HALF_W - 1, BAILING_BOAT_DEPTH - BOAT_CORNER * 0.4, BOAT_HALF_W - BOAT_CORNER, BAILING_BOAT_DEPTH);
  p.lineTo(-BOAT_HALF_W + BOAT_CORNER, BAILING_BOAT_DEPTH);
  p.quadraticCurveTo(-BOAT_HALF_W + 1, BAILING_BOAT_DEPTH - BOAT_CORNER * 0.4, -BOAT_HALF_W, -BAILING_BOAT_RISE_END);
  // control y so that the gunwale's middle is BAILING_BOAT_RISE_MID px up: the midpoint of the curve is
  // 0.5 * end y + 0.5 * control y
  p.quadraticCurveTo(0, 2 * -BAILING_BOAT_RISE_MID + BAILING_BOAT_RISE_END, BOAT_HALF_W, -BAILING_BOAT_RISE_END);
  p.closePath();
  return p;
}

/**
 * Texture frame of the boat (provisional): the hull with its ink and the post, plus 4 px of
 * padding. Anchor point is the middle of the hull on the water line, local (0, 0). Never stretched.
 */
export const BAILING_BOAT_TEX: TexSize = frameFromBounds(
  -BOAT_HALF_W - BOAT_LW / 2,
  BAILING_BOAT_POST_TOP_Y - POST_W / 2 - POST_OL,
  BOAT_HALF_W + BOAT_LW / 2,
  BAILING_BOAT_DEPTH + BOAT_LW / 2,
  PAD,
);

/**
 * Paint the boat around its anchor point: a post (BAILING_ROPE colour tube with ink) behind a whole
 * hull in BOAT_HULL cream, clipped bands (BAILING_BOAT_BANDS, top to bottom) under a cream rail, an
 * ink line under the rail and one between each pair of bands (so the bands stay apart in
 * greyscale), plank seams, a shine, an ink outline all round, last but for a small BOAT_ORANGE prow
 * ball on each end. No flower arch, no person, no face, no text.
 */
export function paintBailingBoat(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(line(0, -BAILING_BOAT_RISE_MID, 0, BAILING_BOAT_POST_TOP_Y), POST_W, BAILING_ROPE, POST_OL)]);

  const hull = boatHullPath();
  ctx.fillStyle = BOAT_HULL;
  ctx.fill(hull);

  ctx.save();
  ctx.clip(hull);
  const [e0, e1, e2, e3] = BOAT_BAND_EDGES;
  const edges = [
    [e0, e1],
    [e1, e2],
    [e2, e3],
  ] as const;
  edges.forEach(([top, bottom], i) => {
    ctx.fillStyle = BAILING_BOAT_BANDS[i];
    ctx.fillRect(-BOAT_HALF_W - 1, top, BAILING_BOAT_W + 2, bottom - top);
  });
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = BOAT_SEAM;
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    const x = -BOAT_HALF_W + BAILING_BOAT_W * f;
    ctx.stroke(line(x, e0, x, BAILING_BOAT_DEPTH));
  }
  // The rail line and the lines between the bands: thin ink, so the bands read apart in greyscale.
  ctx.lineWidth = RAIL_LINE_W;
  ctx.strokeStyle = INK;
  for (const y of [e0, e1, e2]) ctx.stroke(line(-BOAT_HALF_W - 1, y, BOAT_HALF_W + 1, y));
  ctx.restore();

  ctx.lineWidth = BOAT_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(boatHullPath());

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = BOAT_SHINE;
  ctx.stroke(line(-BOAT_HALF_W + 16, e0 - 2, -BOAT_HALF_W + 44, e0 - 2));

  for (const side of [-1, 1] as const) {
    const ball = new Path2D();
    ell(ball, side * (BOAT_HALF_W - 5), -BAILING_BOAT_RISE_END + 5, 3.4, 3.4);
    shape(ctx, ball, BOAT_ORANGE, 1.8);
  }
}

// ---------------------------------------------------------------------------
// Bucket (on its short rope) and its front wall and rim
// ---------------------------------------------------------------------------

/** The rim ellipse's half width and half height, px. The mouth is 40 px wide, inside the 48 px catch box. */
export const BAILING_BUCKET_RIM_RX = 20;
export const BAILING_BUCKET_RIM_RY = 5;
/** How far the body hangs below the rim's middle, px. */
export const BAILING_BUCKET_H = 26;
/** Half the body's width at the bottom, px: the body narrows toward the bottom, like any pail. */
const BUCKET_BOTTOM_HALF_W = 15;
/** Radius of the body's lower corners. */
const BUCKET_CORNER = 5;
/** How far the bail handle arches above the rim's middle, px. */
export const BAILING_BAIL_RISE = 15;
/** The rope's length from the handle's top to its top end, px. Short. */
export const BAILING_ROPE_LENGTH = 26;
/** The rope's top end, px above the rim's middle (negative is up). */
export const BAILING_ROPE_TOP_Y = -(BAILING_BAIL_RISE + BAILING_ROPE_LENGTH);
/** Ink of the body's outline. */
const BUCKET_LW = LW * 0.8;
/** The lip's tube: colour width and the ink added each side. */
const LIP_W = 3;
const LIP_OL = 1.2;
/** How far the lip's ink reaches past its centreline, px. */
const LIP_REACH = LIP_W / 2 + LIP_OL;
/** The rope's tube, and the bail handle's. */
const ROPE_W = 3.4;
const ROPE_OL = 1.2;
const BAIL_W = 2.2;
const BAIL_OL = 1.1;
/** Where the two ink hoop lines cross the body's middle, px below the rim's middle. */
const HOOP_YS: readonly number[] = [11, 20];

/** The body and the front half of the lip, closed: the bucket below the front edge of its mouth. */
function frontWallPath(): Path2D {
  const rx = BAILING_BUCKET_RIM_RX;
  const bx = BUCKET_BOTTOM_HALF_W;
  const h = BAILING_BUCKET_H;
  const p = new Path2D();
  p.moveTo(-rx, 0);
  p.lineTo(-bx, h - BUCKET_CORNER);
  p.quadraticCurveTo(-bx, h, -bx + BUCKET_CORNER, h);
  p.lineTo(bx - BUCKET_CORNER, h);
  p.quadraticCurveTo(bx, h, bx, h - BUCKET_CORNER);
  p.lineTo(rx, 0);
  // the front half of the rim ellipse, right to left through its lowest point
  p.ellipse(0, 0, rx, BAILING_BUCKET_RIM_RY, 0, 0, Math.PI, false);
  p.closePath();
  return p;
}

/** The front half of the lip alone, right to left through its lowest point. */
function frontLipPath(): Path2D {
  const p = new Path2D();
  p.ellipse(0, 0, BAILING_BUCKET_RIM_RX, BAILING_BUCKET_RIM_RY, 0, 0, Math.PI, false);
  return p;
}

/** A hoop line across the body at `y` at the middle: curved down in the middle, like a band round a pail seen from above. */
function hoopPath(y: number): Path2D {
  const p = new Path2D();
  p.moveTo(-BAILING_BUCKET_RIM_RX - 2, y);
  p.quadraticCurveTo(0, y + 2 * BAILING_BUCKET_RIM_RY * 0.7, BAILING_BUCKET_RIM_RX + 2, y);
  return p;
}

/**
 * Texture frame of the bucket (provisional): body, lip, bail handle and rope with their ink plus 4
 * px of padding. Anchor point is the middle of the rim ellipse, local (0, 0).
 */
export const BAILING_BUCKET_TEX: TexSize = frameFromBounds(
  -BAILING_BUCKET_RIM_RX - LIP_REACH,
  BAILING_ROPE_TOP_Y - ROPE_W / 2 - ROPE_OL,
  BAILING_BUCKET_RIM_RX + LIP_REACH,
  BAILING_BUCKET_H + BUCKET_LW / 2,
  PAD,
);

/**
 * Texture frame of the front wall and rim (provisional): the front wall and the front half of the
 * lip with their ink plus 4 px of padding. The same anchor point as the bucket, the middle of the
 * rim ellipse, so the scene draws it at the bucket's own position.
 */
export const BAILING_BUCKET_FRONT_TEX: TexSize = frameFromBounds(
  -BAILING_BUCKET_RIM_RX - LIP_REACH,
  -BAILING_BUCKET_RIM_RY - LIP_REACH,
  BAILING_BUCKET_RIM_RX + LIP_REACH,
  BAILING_BUCKET_H + BUCKET_LW / 2,
  PAD,
);

/**
 * Paint the front wall and rim around the rim's middle: the body below the front edge of the mouth
 * in BAILING_BUCKET_BODY (an ink outline round it), a BAILING_BUCKET_SHINE strip and two INK hoop
 * lines clipped to it, then the front half of the lip as a BAILING_BUCKET_LIP tube with an INK line
 * each side. The whole bucket ends with these same strokes.
 */
export function paintBailingBucketFront(ctx: CanvasRenderingContext2D): void {
  const wall = frontWallPath();
  shape(ctx, wall, BAILING_BUCKET_BODY, BUCKET_LW);

  ctx.save();
  ctx.clip(frontWallPath());
  ctx.lineWidth = 3;
  ctx.strokeStyle = BAILING_BUCKET_SHINE;
  ctx.stroke(line(-11, 8, -9, BAILING_BUCKET_H - 6));
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  for (const y of HOOP_YS) ctx.stroke(hoopPath(y));
  ctx.restore();

  inkMany(ctx, [seg(frontLipPath(), LIP_W, BAILING_BUCKET_LIP, LIP_OL)]);
}

/**
 * Paint the whole bucket around the middle of its rim, back to front: the rope (BAILING_ROPE tube
 * with ink), the bail handle (an ANCHOR_METAL wire with ink), the mouth (a BAILING_BUCKET_INSIDE
 * ellipse with the lip's full ring round it), then the front wall and rim
 * (paintBailingBucketFront). It is round and open at the top: a plain pail on a rope.
 */
export function paintBailingBucket(ctx: CanvasRenderingContext2D): void {
  const bail = new Path2D();
  bail.moveTo(-BAILING_BUCKET_RIM_RX + 1, 0);
  // control y so that the handle's top is BAILING_BAIL_RISE px up: the midpoint of the curve is 0.5 * control y
  bail.quadraticCurveTo(0, -2 * BAILING_BAIL_RISE, BAILING_BUCKET_RIM_RX - 1, 0);
  const segs: Seg[] = [
    seg(line(0, BAILING_ROPE_TOP_Y, 0, -BAILING_BAIL_RISE), ROPE_W, BAILING_ROPE, ROPE_OL),
    seg(bail, BAIL_W, ANCHOR_METAL, BAIL_OL),
  ];
  inkMany(ctx, segs);

  const mouth = new Path2D();
  ell(mouth, 0, 0, BAILING_BUCKET_RIM_RX, BAILING_BUCKET_RIM_RY);
  ctx.fillStyle = BAILING_BUCKET_INSIDE;
  ctx.fill(mouth);
  const ring = new Path2D();
  ell(ring, 0, 0, BAILING_BUCKET_RIM_RX, BAILING_BUCKET_RIM_RY);
  inkMany(ctx, [seg(ring, LIP_W, BAILING_BUCKET_LIP, LIP_OL)]);

  paintBailingBucketFront(ctx);
}

// ---------------------------------------------------------------------------
// Shadow (the warning cue)
// ---------------------------------------------------------------------------

/** Where the scene puts the shadow's centre: this many px below the surface, inside the catch box. */
export const BAILING_SHADOW_ALONG = 40;
/** The shadow's half width at the rim and at the bottom, and its body height, px. */
const SHADOW_RIM_RX = 21;
const SHADOW_RIM_RY = 5;
const SHADOW_BOTTOM_HALF_W = 16;
const SHADOW_H = 28;
const SHADOW_CORNER = 5;
const SHADOW_LW = 2.2;

/** The shadow's outline, closed: the back half of the rim ellipse over the top, then the tapering body. */
function shadowPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-SHADOW_RIM_RX, 0);
  p.ellipse(0, 0, SHADOW_RIM_RX, SHADOW_RIM_RY, 0, Math.PI, 2 * Math.PI, false);
  p.lineTo(SHADOW_BOTTOM_HALF_W, SHADOW_H - SHADOW_CORNER);
  p.quadraticCurveTo(SHADOW_BOTTOM_HALF_W, SHADOW_H, SHADOW_BOTTOM_HALF_W - SHADOW_CORNER, SHADOW_H);
  p.lineTo(-SHADOW_BOTTOM_HALF_W + SHADOW_CORNER, SHADOW_H);
  p.quadraticCurveTo(-SHADOW_BOTTOM_HALF_W, SHADOW_H, -SHADOW_BOTTOM_HALF_W, SHADOW_H - SHADOW_CORNER);
  p.closePath();
  return p;
}

/**
 * Texture frame of the shadow (provisional): the silhouette with its ink plus 4 px of padding.
 * Anchor point is the middle of its rim ellipse, local (0, 0). It is narrower than the 48 px catch
 * box, so it shows where the bucket will come down and not more.
 */
export const BAILING_SHADOW_TEX: TexSize = frameFromBounds(
  -SHADOW_RIM_RX - SHADOW_LW / 2,
  -SHADOW_RIM_RY - SHADOW_LW / 2,
  SHADOW_RIM_RX + SHADOW_LW / 2,
  SHADOW_H + SHADOW_LW / 2,
  PAD,
);

/**
 * Paint the shadow around its anchor point: a BAILING_SHADOW white bucket silhouette with an
 * opaque INK outline of 2.2, an INK ellipse for its mouth and two INK hoop lines. It is a
 * silhouette of a plain pail: round, open and smooth. The scene fades it in over the warning.
 */
export function paintBailingShadow(ctx: CanvasRenderingContext2D): void {
  shape(ctx, shadowPath(), BAILING_SHADOW, SHADOW_LW);

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  const mouth = new Path2D();
  ell(mouth, 0, 0, SHADOW_RIM_RX - 2, SHADOW_RIM_RY - 1);
  ctx.stroke(mouth);
  for (const y of [12, 21]) {
    const hoop = new Path2D();
    hoop.moveTo(-SHADOW_RIM_RX + 2, y);
    hoop.quadraticCurveTo(0, y + 6, SHADOW_RIM_RX - 2, y);
    ctx.save();
    ctx.clip(shadowPath());
    ctx.stroke(hoop);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Ripples (the warning on the water)
// ---------------------------------------------------------------------------

/** Where the scene puts the ripples' centre: this many px below the surface, over the bucket's x. */
export const BAILING_RIPPLES_ALONG = 6;
/** The two broken rings, [half width, half height]: a wide one and a narrower one inside it. */
export const BAILING_RIPPLE_RINGS: readonly (readonly [number, number])[] = [
  [24, 6],
  [14, 3.5],
];
/** The gap left open at each side of a ring, radians either side of the ring's left and right points. */
const RIPPLE_GAP = 0.45;
/** The arcs: colour width and the ink added each side. */
const RIPPLE_W = 2.4;
const RIPPLE_OL = 1.1;
/** How far an arc's ink reaches past its path, px. */
const RIPPLE_REACH = RIPPLE_W / 2 + RIPPLE_OL;

/** The front (lower) or back (upper) arc of a ring, with a gap at each side. */
function rippleArc(rx: number, ry: number, front: boolean): Path2D {
  const p = new Path2D();
  const a0 = front ? RIPPLE_GAP : Math.PI + RIPPLE_GAP;
  p.ellipse(0, 0, rx, ry, 0, a0, a0 + Math.PI - 2 * RIPPLE_GAP, false);
  return p;
}

/**
 * Texture frame of the ripples (provisional): the arcs with their ink plus 4 px of padding. Anchor
 * point is their middle, local (0, 0), BAILING_RIPPLES_ALONG px under the surface.
 */
export const BAILING_RIPPLES_TEX: TexSize = frameFromBounds(
  -BAILING_RIPPLE_RINGS[0][0] - RIPPLE_REACH,
  -BAILING_RIPPLE_RINGS[0][1] - RIPPLE_REACH,
  BAILING_RIPPLE_RINGS[0][0] + RIPPLE_REACH,
  BAILING_RIPPLE_RINGS[0][1] + RIPPLE_REACH,
  PAD,
);

/**
 * Paint the ripples around their anchor point: two rings (48 and 28 px wide), one inside the other,
 * each drawn as a front arc and a back arc with a gap at each side, four BAILING_RIPPLE arcs with an
 * INK line each side (one `inkMany` group), so they read dark, white, dark in greyscale. They are
 * broken, so they differ from every closed ring in the game, and not wavy lines like the anchor's.
 */
export function paintBailingRipples(ctx: CanvasRenderingContext2D): void {
  const segs: Seg[] = [];
  for (const [rx, ry] of BAILING_RIPPLE_RINGS) {
    for (const front of [false, true]) segs.push(seg(rippleArc(rx, ry, front), RIPPLE_W, BAILING_RIPPLE, RIPPLE_OL));
  }
  inkMany(ctx, segs);
}

// ---------------------------------------------------------------------------
// Splash ring (the landing)
// ---------------------------------------------------------------------------

/** The splash ring's half width and half height, px. */
export const BAILING_SPLASH_RX = 20;
export const BAILING_SPLASH_RY = 6;
/** The drops over the ring, [x, y] from its centre (negative y is up), and their radius. */
export const BAILING_SPLASH_DROPS: readonly (readonly [number, number])[] = [
  [-16, -9],
  [-8, -15],
  [0, -11],
  [8, -15],
  [16, -9],
];
export const BAILING_SPLASH_DROP_R = 2.8;
const SPLASH_W = 3;
const SPLASH_OL = 1.2;
const DROP_LW = 1.6;

/**
 * Texture frame of the splash (provisional): the ring and the drops with their ink plus 4 px of
 * padding. Anchor point is the ring's middle, local (0, 0), the landing point.
 */
export const BAILING_SPLASH_TEX: TexSize = frameFromBounds(
  -BAILING_SPLASH_RX - SPLASH_W / 2 - SPLASH_OL,
  -15 - BAILING_SPLASH_DROP_R - DROP_LW / 2,
  BAILING_SPLASH_RX + SPLASH_W / 2 + SPLASH_OL,
  BAILING_SPLASH_RY + SPLASH_W / 2 + SPLASH_OL,
  PAD,
);

/**
 * Paint the splash around its anchor point: one closed BAILING_RIPPLE ring (a white tube with an
 * INK line each side) and five white drops (BAILING_RIPPLE, ink 1.6) in an arch above it. The
 * scene plays it where the toss lands, and fades it out.
 */
export function paintBailingSplash(ctx: CanvasRenderingContext2D): void {
  const ring = new Path2D();
  ell(ring, 0, 0, BAILING_SPLASH_RX, BAILING_SPLASH_RY);
  inkMany(ctx, [seg(ring, SPLASH_W, BAILING_RIPPLE, SPLASH_OL)]);
  for (const [x, y] of BAILING_SPLASH_DROPS) {
    const drop = new Path2D();
    ell(drop, x, y, BAILING_SPLASH_DROP_R, BAILING_SPLASH_DROP_R);
    shape(ctx, drop, BAILING_RIPPLE, DROP_LW);
  }
}
