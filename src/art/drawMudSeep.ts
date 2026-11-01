/**
 * Mud seep painters: the low mud mound with its dark seep opening on the bed, the silt flakes that
 * lift off it in the warning, the jagged crack that opens round it and the column of bubbles it
 * pushes up (the moving hazard look `mud-seep`, issue #194; guide 3c, 7 and 10).
 *
 * Every shape, size and colour here is derived (provisional). Nothing here is fire, steam, a
 * volcano, a face or text, and nothing shows the seep hurting the axolotl (A11, ADR 0007, ADR 0008):
 * a hit shows only the shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the
 * flakes' fading in (a sprite alpha from 0 to 1 over the warning), the crack's growth and the
 * column's height belong to the scene. Every anchor point (a texture's origin) sits on the seep's x:
 * - bow: a low, wide mound of pale mud, 80 px across at its foot and MUD_MOUTH_RISE px high, flat on
 *   top, with a dark seep opening in its top, a lighter streak and two thin cracks down its sides.
 *   Its anchor point is the bed top under it (the spawn's base). Its foot sinks MUD_FOOT_DROP px
 *   into the bed and has no ink line across its bottom, so the mound grows out of the bed;
 * - shadow (the warning cue): the centre of five silt flakes lifting off the mound, each a small,
 *   tilted, flat diamond of pale mud with straight edges, a pointed tip at both ends and a thin
 *   crease along its length, sitting loose in a loose cluster. The scene puts it MUD_SHADOW_ALONG px
 *   above the base and fades it in over the warning. Straight-edged diamonds are the only warning
 *   cue with corners, so they differ from the geyser's round bubbles, the pulsing vent's round
 *   bubble, the carp's rounded mud puff and the drip's drop;
 * - shaft: the top of the column, the logic's tip. The art runs MUD_COLUMN_LENGTH px DOWN from it
 *   (the column goes up from the bed, so its base is below its tip): a stack of big round bubbles,
 *   each MUD_BUBBLE_R x 2 px across and MUD_BUBBLE_SPACING px below the one above, so each overlaps
 *   the one above and shows the curve of its edge as an ink line across the column. The top bubble
 *   is whole and its top edge is on the anchor point. The column is never narrower than 2 x
 *   MUD_BUBBLE_HALF_WIDTH px (the logic's 2 x halfWidth 10): its narrowest places, where two bubbles
 *   meet, are about 21 px wide. It bulges to 24 px at each bubble's middle. It can be cropped at any
 *   length; its bottom, past the base, hides behind the mound;
 * - ring: the centre of one jagged crack in the bed round the mound, a flat closed zigzag ring 104
 *   px wide, a pale line with an ink line each side. It is at MUD_RING_ALONG px above the base.
 *   The zigzag has sharp teeth all round and is not a smooth ellipse, so it differs from the geyser's
 *   shimmer ring, the pole's and drip's rings, the garter snake's ring and the protected ring.
 *
 * Greyscale: every part has an opaque ink outline and its fills are pale (the mud and the bubbles are
 * 9:1 or better with ink, so each holds 3:1 or better on any background by the pair method). The
 * cue reads as five loose diamonds, the ring as one zigzag, the column as a stack of round bubbles
 * with a curved ink line across it at each one, and the mound as a low flat-topped heap with a dark
 * opening, so none of them depends on hue.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type TexSize } from './canvasKit';
import { INK, LW } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3c, 10)
// ---------------------------------------------------------------------------

/** The mound's mud: a pale mud #e2cfa6, luminance 0.6355, 9.40:1 with ink. It reaches the outer edge. */
export const MUD_SEEP_MOUND = '#e2cfa6';
/** The lighter streak on the mound. Inside the silhouette, so no ink. */
export const MUD_SEEP_MOUND_LIGHT = '#f2e6c8';
/** The cracks on the mound and the crease on each flake. Internal detail lines, not ink. */
export const MUD_SEEP_CRACK = '#a9895b';
/** The seep opening in the mound's top: dark mud. An inner detail, never an edge. */
export const MUD_SEEP_MOUTH = '#4a3626';
/** The bubbles of the column: a pale warm #efe3c4, luminance 0.7727, 11.28:1 with ink. They reach the outer edge. */
export const MUD_SEEP_BUBBLE = '#efe3c4';
/** The one soft shine on each bubble. Inside the silhouette, so alpha is allowed. */
export const MUD_SEEP_SHINE = 'rgba(255,255,255,0.9)';
/** The silt flakes: #ead9b4, luminance 0.7041, 10.34:1 with ink. They reach the outer edge. */
export const MUD_SEEP_FLAKE = '#ead9b4';
/** The jagged crack ring's line: a pale #f1e6c8 (11.58:1 with ink), with ink each side. */
export const MUD_SEEP_RING = '#f1e6c8';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Mound (the bow)
// ---------------------------------------------------------------------------

/** The top of the mound, px above the bed-top anchor point. */
export const MUD_MOUTH_RISE = 12;
/** Half width of the mound's flat top and of its foot. */
export const MUD_MOUTH_HALF_W = 14;
export const MUD_FOOT_HALF_W = 40;
/** How far the mound's foot sinks below the bed top, px. */
export const MUD_FOOT_DROP = 18;
/** Ink of the mound's outline. */
const MOUND_LW = LW * 0.8;

/** The mound's outline from the left foot, over the flat top, to the right foot. Closed along the foot for the fill. */
function moundPath(closed: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(-MUD_FOOT_HALF_W, MUD_FOOT_DROP);
  p.quadraticCurveTo(-30, 8, -24, -4);
  p.quadraticCurveTo(-21, -MUD_MOUTH_RISE, -MUD_MOUTH_HALF_W, -MUD_MOUTH_RISE);
  p.lineTo(MUD_MOUTH_HALF_W, -MUD_MOUTH_RISE);
  p.quadraticCurveTo(21, -MUD_MOUTH_RISE, 24, -4);
  p.quadraticCurveTo(30, 8, MUD_FOOT_HALF_W, MUD_FOOT_DROP);
  if (closed) p.closePath();
  return p;
}

/**
 * Texture frame of the mound (provisional): the heap with its ink plus 4 px of padding. Anchor point
 * is the bed top under the middle of the mound, local (0, 0). The scene draws it over the column, so
 * the bottom of the column hides inside it.
 */
export const MUD_MOUND_TEX: TexSize = frameFromBounds(
  -MUD_FOOT_HALF_W - MOUND_LW / 2,
  -MUD_MOUTH_RISE - MOUND_LW / 2,
  MUD_FOOT_HALF_W + MOUND_LW / 2,
  MUD_FOOT_DROP + MOUND_LW / 2,
  PAD,
);

/**
 * Paint the mound around its anchor point: one MUD_SEEP_MOUND heap with a dark opening
 * (MUD_SEEP_MOUTH) on its flat top, a lighter streak (MUD_SEEP_MOUND_LIGHT) and two thin cracks
 * (MUD_SEEP_CRACK) clipped to it, and an opaque INK outline over its top and sides, none across its
 * foot. No fire, no steam, no face, no text.
 */
export function paintMudMound(ctx: CanvasRenderingContext2D): void {
  const heap = moundPath(true);
  ctx.fillStyle = MUD_SEEP_MOUND;
  ctx.fill(heap);

  const mouth = new Path2D();
  ell(mouth, 0, -MUD_MOUTH_RISE + 1.5, MUD_MOUTH_HALF_W - 4, 2.4);
  ctx.fillStyle = MUD_SEEP_MOUTH;
  ctx.fill(mouth);

  ctx.save();
  ctx.clip(heap);
  ctx.lineWidth = 3;
  ctx.strokeStyle = MUD_SEEP_MOUND_LIGHT;
  ctx.stroke(line(-27, 6, -20, -4));
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = MUD_SEEP_CRACK;
  const crackA = new Path2D();
  crackA.moveTo(16, -7);
  crackA.lineTo(19, -1);
  crackA.lineTo(16, 5);
  crackA.lineTo(20, 12);
  ctx.stroke(crackA);
  const crackB = new Path2D();
  crackB.moveTo(-10, -4);
  crackB.lineTo(-7, 2);
  crackB.lineTo(-11, 8);
  ctx.stroke(crackB);
  ctx.restore();

  ctx.lineWidth = MOUND_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(moundPath(false));
}

// ---------------------------------------------------------------------------
// Silt flakes (the shadow: the warning cue)
// ---------------------------------------------------------------------------

/** Where the scene puts the flake cluster's centre: this many px above the bed top, over the mound. */
export const MUD_SHADOW_ALONG = 36;

/** One flake: its centre, its half length and half width (the diamond's two half diagonals) and its tilt in radians. */
export interface MudFlake {
  readonly x: number;
  readonly y: number;
  readonly halfLong: number;
  readonly halfShort: number;
  readonly rot: number;
}

/** The five flakes, loose round the anchor point, the biggest in the middle. */
export const MUD_FLAKES: readonly MudFlake[] = [
  { x: -9, y: 6, halfLong: 6.5, halfShort: 4, rot: -0.5 },
  { x: 8, y: 4, halfLong: 6, halfShort: 3.8, rot: 0.55 },
  { x: -2, y: -3, halfLong: 7, halfShort: 4.2, rot: 0.12 },
  { x: 11, y: -9, halfLong: 5, halfShort: 3.2, rot: -0.75 },
  { x: -11, y: -10, halfLong: 5, halfShort: 3.2, rot: 0.85 },
];
/** The flakes' ink outline, centred on each edge. */
const FLAKE_OUTLINE = 2;

/** A flake's four corners: the two ends of its long diagonal, then the two ends of its short one. */
function flakeCorners(f: MudFlake): [number, number][] {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return (
    [
      [f.halfLong, 0],
      [0, f.halfShort],
      [-f.halfLong, 0],
      [0, -f.halfShort],
    ] as const
  ).map(([x, y]): [number, number] => [f.x + x * c - y * s, f.y + x * s + y * c]);
}

/** The cluster's bounds, from the corners. */
const FLAKE_BOUNDS = MUD_FLAKES.flatMap(flakeCorners).reduce(
  (b, [x, y]) => ({ minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);

/**
 * Texture frame of the flake cluster (provisional): every flake with its outline plus 4 px of
 * padding. Anchor point is the cluster's centre, local (0, 0).
 */
export const MUD_FLAKES_TEX: TexSize = frameFromBounds(
  FLAKE_BOUNDS.minX - FLAKE_OUTLINE / 2,
  FLAKE_BOUNDS.minY - FLAKE_OUTLINE / 2,
  FLAKE_BOUNDS.maxX + FLAKE_OUTLINE / 2,
  FLAKE_BOUNDS.maxY + FLAKE_OUTLINE / 2,
  PAD,
);

/**
 * Paint the flake cluster around its anchor point: five tilted diamonds, each a MUD_SEEP_FLAKE
 * fill with an opaque INK outline 2 wide (round joins) and a thin MUD_SEEP_CRACK crease along its
 * long diagonal. The scene fades it in over the warning: flakes lifting off the mound are the
 * warning cue, and their ink outlines and straight edges hold them in greyscale.
 */
export function paintMudFlakes(ctx: CanvasRenderingContext2D): void {
  for (const flake of MUD_FLAKES) {
    const [a, b, c, d] = flakeCorners(flake);
    const diamond = new Path2D();
    diamond.moveTo(a[0], a[1]);
    diamond.lineTo(b[0], b[1]);
    diamond.lineTo(c[0], c[1]);
    diamond.lineTo(d[0], d[1]);
    diamond.closePath();
    shape(ctx, diamond, MUD_SEEP_FLAKE, FLAKE_OUTLINE);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = MUD_SEEP_CRACK;
    ctx.stroke(line(a[0] + (c[0] - a[0]) * 0.18, a[1] + (c[1] - a[1]) * 0.18, a[0] + (c[0] - a[0]) * 0.82, a[1] + (c[1] - a[1]) * 0.82));
  }
}

// ---------------------------------------------------------------------------
// Jagged crack (the ring: the warning cue in the bed)
// ---------------------------------------------------------------------------

/** Where the scene puts the crack's centre: this many px above the bed top, round the mound's foot. */
export const MUD_RING_ALONG = 2;
/** Radii of the crack ring, px: a flat ellipse wider than the mound's foot, which the teeth run round. */
export const MUD_RING_RX = 52;
export const MUD_RING_RY = 8;
/** How far each tooth sits in or out from the ellipse, px, and the number of teeth (points) all round. */
export const MUD_RING_TOOTH = 2.6;
export const MUD_RING_POINTS = 40;
/** The ring line: colour width and the ink added each side. */
const RING_W = 2.6;
const RING_OL = 1.3;
/** How far the ring's ink reaches past its path, px. */
const RING_REACH = RING_W / 2 + RING_OL;

/**
 * The zigzag ring's corners: MUD_RING_POINTS points spaced evenly along the ellipse's length,
 * alternately MUD_RING_TOOTH px out and in along its normal.
 */
export function mudRingCorners(): [number, number][] {
  const samples = 720;
  const outline: { x: number; y: number; at: number }[] = [];
  let at = 0;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const x = MUD_RING_RX * Math.cos(t);
    const y = MUD_RING_RY * Math.sin(t);
    if (i > 0) at += Math.hypot(x - outline[i - 1].x, y - outline[i - 1].y);
    outline.push({ x, y, at });
  }
  const corners: [number, number][] = [];
  let next = 0;
  for (let k = 0; k < MUD_RING_POINTS; k++) {
    const target = (k / MUD_RING_POINTS) * at;
    while (next < outline.length - 1 && outline[next].at < target) next++;
    const { x, y } = outline[next];
    // the ellipse's outward normal at (x, y) is the gradient of x^2 / rx^2 + y^2 / ry^2
    const nx = x / (MUD_RING_RX * MUD_RING_RX);
    const ny = y / (MUD_RING_RY * MUD_RING_RY);
    const len = Math.hypot(nx, ny);
    const off = k % 2 === 0 ? MUD_RING_TOOTH : -MUD_RING_TOOTH;
    corners.push([x + (off * nx) / len, y + (off * ny) / len]);
  }
  return corners;
}

/**
 * Texture frame of the crack ring (provisional): the zigzag with its ink plus 4 px of padding.
 * Anchor point is the ring's centre, local (0, 0), MUD_RING_ALONG px above the bed top.
 */
export const MUD_RING_TEX: TexSize = frameFromBounds(
  -MUD_RING_RX - MUD_RING_TOOTH - RING_REACH,
  -MUD_RING_RY - MUD_RING_TOOTH - RING_REACH,
  MUD_RING_RX + MUD_RING_TOOTH + RING_REACH,
  MUD_RING_RY + MUD_RING_TOOTH + RING_REACH,
  PAD,
);

/**
 * Paint the crack ring around its anchor point: one closed zigzag round a flat ellipse, a pale
 * (MUD_SEEP_RING) line with an opaque INK line each side (one `inkMany` tube), so it reads dark,
 * pale, dark in greyscale. Its sharp teeth set it apart from every smooth ring.
 */
export function paintMudRing(ctx: CanvasRenderingContext2D): void {
  const [first, ...rest] = mudRingCorners();
  const ring = new Path2D();
  ring.moveTo(first[0], first[1]);
  for (const [x, y] of rest) ring.lineTo(x, y);
  ring.closePath();
  inkMany(ctx, [seg(ring, RING_W, MUD_SEEP_RING, RING_OL)]);
}

// ---------------------------------------------------------------------------
// Bubble column (the shaft)
// ---------------------------------------------------------------------------

/** The deepest tip the art must reach, px above the base: the logic's deepest depth. */
export const MUD_ART_DEPTH = 260;
/**
 * Half the column's width the logic touches, px: the logic's halfWidth 10 (MUD_SEEP in
 * src/logic/movingHazards.ts). The art is never narrower than twice this.
 */
export const MUD_BUBBLE_HALF_WIDTH = 10;
/** Radius of one bubble, and the distance from one bubble's centre to the next one down. */
export const MUD_BUBBLE_R = 12;
export const MUD_BUBBLE_SPACING = 12;
/** Px of shaft art the scene draws back past the base, hidden inside the mound. */
export const MUD_SHAFT_PAST_BASE = 14;
/** Px the drawn tip is held back toward the base at rest. */
export const MUD_REST_BACK = 14;
/** Number of bubbles in the column. */
export const MUD_BUBBLE_COUNT = Math.ceil((MUD_ART_DEPTH + MUD_SHAFT_PAST_BASE - 2 * MUD_BUBBLE_R) / MUD_BUBBLE_SPACING) + 1;
/**
 * Length of the art from the tip down, px: the bottom of the last bubble. Enough for a 260 px
 * column plus the MUD_SHAFT_PAST_BASE px drawn inside the mound.
 */
export const MUD_COLUMN_LENGTH = 2 * MUD_BUBBLE_R + (MUD_BUBBLE_COUNT - 1) * MUD_BUBBLE_SPACING;
/** The bubbles' ink outline, centred on each edge. */
const BUBBLE_OUTLINE = 2;

/**
 * Texture frame of the column (provisional): the stack of bubbles with their ink plus 4 px of
 * padding. Anchor point is the top bubble's top edge, local (0, 0), the logic's tip. The art runs
 * DOWN from it by MUD_COLUMN_LENGTH. The scene crops it to the column's height.
 */
export const MUD_COLUMN_TEX: TexSize = frameFromBounds(
  -MUD_BUBBLE_R - BUBBLE_OUTLINE / 2,
  -BUBBLE_OUTLINE / 2,
  MUD_BUBBLE_R + BUBBLE_OUTLINE / 2,
  MUD_COLUMN_LENGTH + BUBBLE_OUTLINE / 2,
  PAD,
);

/**
 * Paint the column around its anchor point (the tip). The bubbles are drawn from the bottom one up,
 * so each covers the top of the one below: each a MUD_SEEP_BUBBLE disc with an opaque INK outline 2
 * wide and one soft shine (MUD_SEEP_SHINE) low on its left. The top bubble is whole, its top edge
 * on the anchor point. The curved ink lines where one bubble overlaps the next, and the scalloped
 * edge, are the greyscale cue.
 */
export function paintMudColumn(ctx: CanvasRenderingContext2D): void {
  for (let i = MUD_BUBBLE_COUNT - 1; i >= 0; i--) {
    const y = MUD_BUBBLE_R + i * MUD_BUBBLE_SPACING;
    const bubble = new Path2D();
    ell(bubble, 0, y, MUD_BUBBLE_R, MUD_BUBBLE_R);
    shape(ctx, bubble, MUD_SEEP_BUBBLE, BUBBLE_OUTLINE);
    const shine = new Path2D();
    ell(shine, -5, y + 5, 2.4, 1.4, -0.5);
    ctx.fillStyle = MUD_SEEP_SHINE;
    ctx.fill(shine);
  }
}
