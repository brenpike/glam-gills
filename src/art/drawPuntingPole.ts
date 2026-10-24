/**
 * Punting pole painters: the trajinera's bow, the pole, the boat's shadow and the tip's ripple ring
 * (issue #117; PRD N3, open question 256, ND-9). The moving hazard look `punting-pole`.
 *
 * Every shape, size and colour here is derived (provisional). It follows guide sections 2, 4, 5, 10
 * and the garter snake's ripple ring (7k). The boat is a Xochimilco trajinera: a flat, bright,
 * painted hull with a flower arch over the deck. There are no people on it, and the pole is never
 * shown hitting, pinning or holding the axolotl (A11, ADR 0007, ADR 0008): a hit shows only the
 * shared leg-loss poof.
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The cycle, the
 * shadow's darkening (a sprite alpha from 0 to 1 over the warning), the tip's dip, the ripple's
 * growth and the shaft's length belong to the scene. Every anchor sits on the pole's x:
 * - bow: on the water line, directly over the pole (the surface y, SURF);
 * - shadow: the centre of the flat ellipse on the water under the bow; the scene puts it
 *   PUNTING_SHADOW_DROP px below the surface;
 * - shaft: the tip centre, the lowest point of the shaft. The art runs POLE_SHAFT_LENGTH px up from
 *   it. The scene puts the anchor at the tip (surface y plus the tip depth) and crops or scales it;
 *   the top end is hidden behind the bow or cropped. The node rings repeat every POLE_NODE_SPACING
 *   px along the shaft, so it can be cropped at any height and still reads as one pole;
 * - ring: the centre of the ring, on the water line at the pole's x.
 */
import { blob, ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { LW } from './palette';

// ---------------------------------------------------------------------------
// Colours (guide 3g, 10)
// ---------------------------------------------------------------------------

/**
 * Trajinera hull: a warm cream #fff0c9. Reaches the outer edge, so it is held at 9:1 or better
 * against ink, and the lightest thing on the boat.
 */
export const BOAT_HULL = '#fff0c9';
/** Painted band and arch colours, all bright and all 4.5:1 or better against ink. */
export const BOAT_PINK = '#ff6fa8';
export const BOAT_ORANGE = '#ffa23a';
export const BOAT_TEAL = '#2fc7b8';
/** Flower petals on the arch, a sunny yellow #ffe14a. */
export const BOAT_YELLOW = '#ffe14a';
/** Flower centres. */
export const BOAT_FLOWER_CENTRE = '#ffffff';
/**
 * Pole wood: a warm tan #d9b27a, over 7:1 with ink. The nodes are the greyscale tell inside the
 * silhouette: darker rings (more than 2:1 darker than the wood) on a light shaft.
 */
export const POLE_WOOD = '#d9b27a';
export const POLE_NODE = '#8a5a30';
/** The tip's worn end, darker than the wood so the tip reads in greyscale. */
export const POLE_FERRULE = '#7a5230';
/** The one soft shine along the shaft. Inside the silhouette, so alpha is allowed. */
export const POLE_SHINE = 'rgba(255,255,255,0.5)';
/**
 * The boat's shadow on the water, a deep blue at full strength. See-through, so the water shows
 * through it. The scene fades the whole sprite in over the warning, so this is the darkest it
 * gets. The ink outline is the greyscale cue: it holds the shape where the dark fill barely shows.
 */
export const BOAT_SHADOW = 'rgba(12,38,78,0.55)';
/** The ripple ring's line, white, with ink each side. */
export const POLE_RING = '#ffffff';

// ---------------------------------------------------------------------------
// Bow
// ---------------------------------------------------------------------------

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

/** Ink of the flower blobs, thinner than the hull's LW. */
const FLOWER_LW = 2.4;
/** The arch tube: colour width and the ink added each side. */
const ARCH_W = 5;
const ARCH_OL = 2.2;
/** Arch feet and control point. The feet tuck behind the hull's top edge, so the arch grows from the deck. */
const ARCH_FROM: readonly [number, number] = [-34, -4];
const ARCH_CONTROL: readonly [number, number] = [0, -76];
const ARCH_TO: readonly [number, number] = [30, -4];
const ARCH_STEPS = 14;
/** Where the flowers sit along the arch (0 is the left foot, 1 the right foot), and their petals. */
const FLOWER_AT: readonly number[] = [0.14, 0.3, 0.5, 0.7, 0.86];
const FLOWER_FILLS: readonly string[] = [BOAT_PINK, BOAT_YELLOW, BOAT_ORANGE, BOAT_YELLOW, BOAT_PINK];
const FLOWER_R = 5;
const FLOWER_CENTRE_R = 1.8;
/** The prow ball at the raised end. */
const PROW_BALL: readonly [number, number, number] = [70, -25, 5];

/** A point on the arch's quadratic curve at t (0 to 1). */
function archPoint(t: number): readonly [number, number] {
  const u = 1 - t;
  return [
    u * u * ARCH_FROM[0] + 2 * u * t * ARCH_CONTROL[0] + t * t * ARCH_TO[0],
    u * u * ARCH_FROM[1] + 2 * u * t * ARCH_CONTROL[1] + t * t * ARCH_TO[1],
  ];
}

/**
 * The arch as a polyline, so its bounds are exact. The scene never sees the arch: it is part of
 * the bow texture.
 */
function archPath(): Path2D {
  const path = new Path2D();
  for (let i = 0; i <= ARCH_STEPS; i++) {
    const [x, y] = archPoint(i / ARCH_STEPS);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/** The hull: a flat bottom, a low stern on the left and a raised prow on the right. */
function hullPath(): Path2D {
  const hull = new Path2D();
  hull.moveTo(-60, -12);
  hull.quadraticCurveTo(-56, 4, -44, 6);
  hull.lineTo(46, 6);
  hull.quadraticCurveTo(62, 4, 70, -22);
  hull.quadraticCurveTo(5, -4, -60, -12);
  hull.closePath();
  return hull;
}

/** The painted bands across the hull: top y, bottom y and colour, clipped to the hull. The cream hull shows above them, thicker toward the prow. */
const BANDS: readonly (readonly [number, number, string])[] = [
  [-7, -3, BOAT_PINK],
  [-3, 1, BOAT_ORANGE],
  [1, 8, BOAT_TEAL],
];

/**
 * Texture frame of the bow (provisional): the hull, the prow ball and the flower arch, with their
 * ink, plus 4 px of padding. Anchor is the water line directly over the pole, local (0, 0): the
 * hull sits mostly above it and its flat bottom dips a little below it. The prow is at +x. The
 * scene draws it over the shaft, so the top of the shaft hides behind the boat.
 */
export const PUNTING_BOW_TEX: TexSize = frameFromBounds(-64, -52, 78, 10, PAD);

/**
 * Paint the bow around its anchor. Layer order, back to front: the arch (one inked tube of
 * BOAT_TEAL), the hull (a BOAT_HULL blob), the three painted bands clipped to the hull (BOAT_PINK,
 * BOAT_ORANGE, BOAT_TEAL), the prow ball (a BOAT_ORANGE blob), and five flowers along the arch
 * (a petal blob each, a white centre). No people, no faces, no text.
 */
export function paintPuntingBow(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(archPath(), ARCH_W, BOAT_TEAL, ARCH_OL)]);

  const hull = hullPath();
  blob(ctx, hull, BOAT_HULL, LW);

  ctx.save();
  ctx.clip(hull);
  for (const [top, bottom, colour] of BANDS) {
    ctx.fillStyle = colour;
    ctx.fillRect(-70, top, 150, bottom - top);
  }
  ctx.restore();

  const ball = new Path2D();
  ell(ball, PROW_BALL[0], PROW_BALL[1], PROW_BALL[2], PROW_BALL[2]);
  blob(ctx, ball, BOAT_ORANGE, FLOWER_LW);

  FLOWER_AT.forEach((t, i) => {
    const [x, y] = archPoint(t);
    const petals = new Path2D();
    ell(petals, x, y - 3, FLOWER_R, FLOWER_R);
    blob(ctx, petals, FLOWER_FILLS[i], FLOWER_LW);
    const centre = new Path2D();
    ell(centre, x, y - 3, FLOWER_CENTRE_R, FLOWER_CENTRE_R);
    ctx.fillStyle = BOAT_FLOWER_CENTRE;
    ctx.fill(centre);
  });
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

/** Radii of the boat's shadow on the water, px: a wide, flat ellipse, longer than the hull. */
export const PUNTING_SHADOW_RX = 68;
export const PUNTING_SHADOW_RY = 9;
/** Where the scene puts the shadow's centre: this many px below the surface (the hull's bottom is 6). */
export const PUNTING_SHADOW_DROP = 14;
/** The shadow's ink outline, centred on its edge. */
const SHADOW_OUTLINE = 2.4;

/**
 * Texture frame of the shadow (provisional): the ellipse with its outline plus 4 px of padding.
 * Anchor is the ellipse centre, local (0, 0). The scene fades the sprite in over the warning, so
 * the shadow darkens as the cue, then holds it through the jab.
 */
export const PUNTING_SHADOW_TEX: TexSize = frameFromBounds(
  -PUNTING_SHADOW_RX - SHADOW_OUTLINE / 2,
  -PUNTING_SHADOW_RY - SHADOW_OUTLINE / 2,
  PUNTING_SHADOW_RX + SHADOW_OUTLINE / 2,
  PUNTING_SHADOW_RY + SHADOW_OUTLINE / 2,
  PAD,
);

/**
 * Paint the shadow around its anchor: one see-through BOAT_SHADOW ellipse with an opaque INK
 * outline 2.4 wide on its edge. The outline is the greyscale cue (10): it reads as a dark ring
 * on the water where the fill alone would barely show.
 */
export function paintPuntingShadow(ctx: CanvasRenderingContext2D): void {
  const shadow = new Path2D();
  ell(shadow, 0, 0, PUNTING_SHADOW_RX, PUNTING_SHADOW_RY);
  shape(ctx, shadow, BOAT_SHADOW, SHADOW_OUTLINE);
}

// ---------------------------------------------------------------------------
// Ripple ring
// ---------------------------------------------------------------------------

/** Radii of the ring where the tip dips, px: two concentric wide, flat ellipses. */
export const PUNTING_RING_RX = 24;
export const PUNTING_RING_RY = 8;
export const PUNTING_RING_INNER_RX = 11;
export const PUNTING_RING_INNER_RY = 3.8;
/** The ring lines: colour width and the ink added each side. */
const RING_W = 3;
const RING_OL = 1.4;
/** How far the ring's ink reaches past its radii, px. */
const RING_REACH = RING_W / 2 + RING_OL;

/**
 * Texture frame of the ring (provisional): the outer ellipse with its ink plus 4 px of padding.
 * Anchor is the ring centre, local (0, 0), on the water line at the pole's x. The scene shows
 * it, still, while the tip dips to the surface in the warning; it may grow it by scale.
 */
export const PUNTING_RING_TEX: TexSize = frameFromBounds(
  -PUNTING_RING_RX - RING_REACH,
  -PUNTING_RING_RY - RING_REACH,
  PUNTING_RING_RX + RING_REACH,
  PUNTING_RING_RY + RING_REACH,
  PAD,
);

/**
 * Paint the ring around its anchor: an outer and an inner flat ellipse, each a white line with an
 * ink line each side (one `inkMany` group, so each is outlined and reads dark, white, dark in
 * greyscale). White and ink are 14.39:1, so the rings are 3.79:1 or better on any background.
 * Two rings tell it from the garter snake's single ripple line (7k).
 */
export function paintPuntingRing(ctx: CanvasRenderingContext2D): void {
  const outer = new Path2D();
  ell(outer, 0, 0, PUNTING_RING_RX, PUNTING_RING_RY);
  const inner = new Path2D();
  ell(inner, 0, 0, PUNTING_RING_INNER_RX, PUNTING_RING_INNER_RY);
  inkMany(ctx, [seg(outer, RING_W, POLE_RING, RING_OL), seg(inner, RING_W, POLE_RING, RING_OL)]);
}

// ---------------------------------------------------------------------------
// Shaft
// ---------------------------------------------------------------------------

/** Shaft colour width in px: the logic's 2 x halfWidth 5 (src/logic/tuning.ts PUNTING_POLES), so the pole is a 10 px pole. */
export const POLE_SHAFT_W = 10;
/** Ink added each side of the shaft. */
const SHAFT_OL = 2.2;
/**
 * Length of the art from the tip up, px: enough for the full 180 px depth plus 44 px above the
 * surface, so the top stays behind the bow's arch at full depth.
 */
export const POLE_SHAFT_LENGTH = 224;
/** The worn end at the tip, px along the shaft, and the node rings' spacing and width. */
const FERRULE_LEN = 9;
export const POLE_NODE_SPACING = 32;
const NODE_W = 3.2;
/** The first node's distance above the tip; the rest follow every POLE_NODE_SPACING. */
const NODE_FIRST = 20;

/**
 * Texture frame of the shaft (provisional): a vertical bar with its ink plus 4 px of padding.
 * Anchor is the tip centre, local (0, 0), the lowest point of the shaft (the logic's tip). The
 * art runs up from it by POLE_SHAFT_LENGTH. The scene crops or scales it to the tip depth.
 */
export const PUNTING_SHAFT_TEX: TexSize = frameFromBounds(
  -POLE_SHAFT_W / 2 - SHAFT_OL,
  -POLE_SHAFT_LENGTH - SHAFT_OL,
  POLE_SHAFT_W / 2 + SHAFT_OL,
  SHAFT_OL,
  PAD,
);

/** The tubes of the shaft: the wood from the top down to the worn end, then the worn end, whose round cap ends at the anchor. */
function shaftTubes(): Seg[] {
  const tipCentre = -POLE_SHAFT_W / 2;
  const ferruleTop = tipCentre - FERRULE_LEN;
  return [
    seg(line(0, -POLE_SHAFT_LENGTH + POLE_SHAFT_W / 2, 0, ferruleTop), POLE_SHAFT_W, POLE_WOOD, SHAFT_OL),
    seg(line(0, ferruleTop, 0, tipCentre), POLE_SHAFT_W, POLE_FERRULE, SHAFT_OL),
  ];
}

/** Number of node rings on the shaft. */
export const POLE_NODE_COUNT = Math.floor((POLE_SHAFT_LENGTH - NODE_FIRST) / POLE_NODE_SPACING) + 1;

/**
 * Paint the shaft around its anchor (the tip). Layer order, back to front: the wood and the worn
 * end (one `inkMany` group, so they merge with no seam, ink 2.2 a side), the node rings (POLE_NODE,
 * no ink, straight across the wood, every POLE_NODE_SPACING px), the one soft shine down the left.
 * The nodes are the greyscale cue inside the silhouette: dark rings on a light shaft.
 */
export function paintPuntingShaft(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, shaftTubes());

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = POLE_NODE;
  ctx.lineWidth = NODE_W;
  for (let i = 0; i < POLE_NODE_COUNT; i++) {
    const y = -(NODE_FIRST + i * POLE_NODE_SPACING);
    ctx.stroke(line(-POLE_SHAFT_W / 2, y, POLE_SHAFT_W / 2, y));
  }
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = POLE_SHINE;
  ctx.stroke(line(-2, -POLE_SHAFT_LENGTH + 12, -2, -NODE_FIRST + 4));
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shaft pieces (issue #118, ND-4)
// ---------------------------------------------------------------------------

/**
 * The lowest art row a stacked shaft piece copies, px above the tip: midway between the first two
 * node rings, inside the wood and the shine and above the worn end and its cap.
 */
export const POLE_TILE_FROM = NODE_FIRST + POLE_NODE_SPACING / 2;
/**
 * The highest art row a shaft piece shows when the pole is stacked, px above the tip: five node
 * spacings above POLE_TILE_FROM, so it is also midway between two rings, and under the shine's top
 * and the wood's top cap. The stacked copies repeat every POLE_TILE_TO - POLE_TILE_FROM px, a whole
 * number of node spacings, so they join with no seam and the rings keep their spacing.
 */
export const POLE_TILE_TO = POLE_TILE_FROM + 5 * POLE_NODE_SPACING;

/**
 * Where the shaft is drawn in pieces for a spawn whose own depth needs more art than
 * POLE_SHAFT_LENGTH (issue #118, ND-4). `length` is the drawn length from the tip up, px;
 * `fullLength` is the spawn's longest drawn length (its depth plus the px above the surface).
 *
 * A pole whose full length fits the art is one piece: the art cropped at the length, as before.
 * A longer pole is the art's bottom (the tip and the worn end) up to POLE_TILE_TO, then copies of
 * the rows POLE_TILE_FROM to POLE_TILE_TO, piece k drawn k x (POLE_TILE_TO - POLE_TILE_FROM) px
 * above the logic tip, while a piece still has rows to show. A piece's rows are px above the tip in
 * the art; its lift is px above the logic tip where its anchor is drawn. Count and per-piece bounds
 * are separate functions, so a view places its pieces with no allocation.
 */
export function poleShaftPieceCount(length: number, fullLength: number): number {
  if (fullLength <= POLE_SHAFT_LENGTH) return 1;
  let count = 1;
  while (poleShaftPieceTo(count, length, fullLength) > POLE_TILE_FROM) count++;
  return count;
}

/** The lowest art row piece `index` shows, px above the tip: 0 for the base piece. */
export function poleShaftPieceFrom(index: number): number {
  return index === 0 ? 0 : POLE_TILE_FROM;
}

/** Px above the logic tip where piece `index` has its anchor: 0 for the base piece. */
export function poleShaftPieceLift(index: number): number {
  return index * (POLE_TILE_TO - POLE_TILE_FROM);
}

/**
 * The highest art row piece `index` shows, px above the tip. The one piece of a pole that fits the
 * art is cropped at the length (0 to POLE_SHAFT_LENGTH); a stacked piece shows up to POLE_TILE_TO
 * or the length, which is held to 0 to `fullLength`.
 */
export function poleShaftPieceTo(index: number, length: number, fullLength: number): number {
  if (index === 0 && fullLength <= POLE_SHAFT_LENGTH) return Math.min(POLE_SHAFT_LENGTH, Math.max(0, length));
  return Math.min(POLE_TILE_TO, Math.min(fullLength, Math.max(0, length)) - poleShaftPieceLift(index));
}
