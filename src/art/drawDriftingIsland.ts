/**
 * Drifting island painter: the lake's floating reed mat, a raft of matted tule with reeds standing up
 * from it and pale roots trailing below (issue #213; PRD N3; owner decision #209 Q7; guide 7w, 3g).
 *
 * Every shape, size and colour here is derived (provisional): the island is not in the approved
 * prototype. It is a floating island of tule (Schoenoplectus), the kind the Valley of Mexico lakes
 * had, so it is told from Area 5's water hyacinth mats (7b, ADR 0020) by everything but being a mat:
 * a flat straw-olive slab with thin upright reed stems and brown seed heads and long thin roots
 * trailing down, against a round-scalloped, glossy bright-green clump with lilac flowers. No flower,
 * no gloss, no scallops, no lilac.
 *
 * The half mat. The island is 240 px wide, which does not fit the lake's 128 x 112 texture cap, so
 * the painter draws one half (DRIFTING_ISLAND_HALF_TEX, 124 x 104): the right half of the mat,
 * 120 px from the island's centre line out to the round end, plus 4 px of padding. The scene shows it
 * twice, the second one mirrored (flipX), both placed on the island's centre line. The sprite is
 * anchored on its left edge at the top of the mat (originX 0, originY at the mat's water line), so
 * the two halves meet on the centre line. Shapes run past the left edge on purpose and are cut by the
 * canvas, so there is no ink or gap on the seam; the first reed and root stand 6 px or more from it.
 *
 * Back to front: the trailing roots, the reeds and their seed heads, the mat slab with its bumps
 * (inked together, so bumps merge into one inked silhouette), the matted straw lumps and lines
 * (inside the silhouette, no ink).
 *
 * Brightness (2, 10). No fill is as bright as the Leucistic belly #ffe3ed (0.8231): the lightest is the
 * straw detail (0.3269). The roots, the part the axolotl swims over, are the darkest and dullest (0.1076),
 * so the hero reads over them.
 *
 * Painters are still frames. No time, no randomness, no gradients, no game state, no Phaser: the drift,
 * the bob and the choice of mirror belong to the scene.
 */
import { ell, inkMany, seg, type Seg, type TexSize } from './canvasKit';
import { INK } from './palette';

// ---------------------------------------------------------------------------
// Colours and widths (guide 3g, 7w)
// ---------------------------------------------------------------------------

/** Mat slab: a straw olive #7d7a45, luminance 0.1871, 3.25:1 with ink. */
export const DRIFTING_ISLAND_MAT = '#7d7a45';
/** Matted straw lumps and lines on the slab: a lighter straw #a39d5d, luminance 0.3269. Inside the silhouette. */
export const DRIFTING_ISLAND_STRAW = '#a39d5d';
/** Reed stems: a tule green #4f9a52, luminance 0.2538. */
export const DRIFTING_ISLAND_REED = '#4f9a52';
/** Reed seed heads: a brown #7a5a30, luminance 0.1166. */
export const DRIFTING_ISLAND_SEED = '#7a5a30';
/** Trailing roots: a dull dark tan #6b5a3c, luminance 0.1076, the dullest part, so the axolotl reads over it. */
export const DRIFTING_ISLAND_ROOT = '#6b5a3c';

/** Ink width of the slab and the seed heads, px, outside the fill. */
export const DRIFTING_ISLAND_INK = 2.4;
/** Ink on each side of a reed or root tube, px. */
export const DRIFTING_ISLAND_TUBE_OL = 1.8;
/** Reed and root widths, px. */
export const DRIFTING_ISLAND_REED_W = 3;
export const DRIFTING_ISLAND_ROOT_W = 2.4;
/** Width of a straw line, px. */
export const DRIFTING_ISLAND_STRAW_W = 1.6;

// ---------------------------------------------------------------------------
// Frame, key and geometry (guide 7w)
// ---------------------------------------------------------------------------

/** Key the bake step uses (guide 7w). */
export const DRIFTING_ISLAND_KEY = 'drifting-island-half';

/** The half mat's reach from the island's centre line to the end of the slab, px, ink included: the island is twice this wide. */
export const DRIFTING_ISLAND_HALF_W = 120;
/** The slab's half width (its ellipse radius), so the slab plus ink reaches DRIFTING_ISLAND_HALF_W. */
export const DRIFTING_ISLAND_SLAB_RX = DRIFTING_ISLAND_HALF_W - DRIFTING_ISLAND_INK;
/** The slab's centre y and half height: it spans about -5.5 to 7.5 around the water line. */
export const DRIFTING_ISLAND_SLAB_CY = 1;
export const DRIFTING_ISLAND_SLAB_RY = 6.5;

/**
 * The half mat's frame: 124 x 104, anchored on the left edge (originX 0) at the water line, 38 above
 * the top (the tallest seed head with its ink) and 66 below (the longest root with its ink).
 */
export const DRIFTING_ISLAND_HALF_TEX: TexSize = { w: 124, h: 104, originX: 0, originY: 38 };

/** The y of a reed's base, inside the slab. */
const REED_BASE_Y = -3;
/** The y a root starts at, inside the slab. */
const ROOT_TOP_Y = 4;

/** A reed: base x, height above its base, and how far its tip leans (+x right). Tall ones carry a seed head. */
export interface DriftingIslandReed {
  readonly x: number;
  readonly h: number;
  readonly lean: number;
  readonly head: boolean;
}

export const DRIFTING_ISLAND_REEDS: readonly DriftingIslandReed[] = [
  { x: 8, h: 22, lean: -3, head: false },
  { x: 19, h: 26, lean: 2, head: true },
  { x: 31, h: 18, lean: 4, head: false },
  { x: 47, h: 26, lean: -2, head: true },
  { x: 60, h: 16, lean: 3, head: false },
  { x: 74, h: 25, lean: -4, head: true },
  { x: 88, h: 20, lean: 2, head: false },
  { x: 101, h: 24, lean: -3, head: true },
  { x: 112, h: 14, lean: 3, head: false },
];

/** A trailing root: x, length below ROOT_TOP_Y and sway. */
export interface DriftingIslandRoot {
  readonly x: number;
  readonly len: number;
  readonly sway: number;
}

export const DRIFTING_ISLAND_ROOTS: readonly DriftingIslandRoot[] = [
  { x: 10, len: 40, sway: 4 },
  { x: 22, len: 56, sway: -5 },
  { x: 36, len: 34, sway: 5 },
  { x: 50, len: 56, sway: -4 },
  { x: 64, len: 44, sway: 5 },
  { x: 79, len: 52, sway: -5 },
  { x: 93, len: 36, sway: 4 },
  { x: 107, len: 46, sway: -3 },
];

/** Slab bumps (centre, radii): the matted tops and the underside, merged into the slab's silhouette. */
const BUMPS: readonly (readonly [number, number, number, number])[] = [
  [40, -3.5, 26, 5],
  [88, -3, 22, 4.5],
  [60, 7.5, 30, 4],
];

/** Straw lumps inside the silhouette. */
const LUMPS: readonly (readonly [number, number, number, number, number])[] = [
  [30, -2, 14, 2, 0.05],
  [76, -1.5, 18, 2.2, -0.04],
  [105, 0.5, 7, 1.6, 0.1],
];

/** Straw lines inside the silhouette: each a start x, y and end x, y. */
const STRAW_LINES: readonly (readonly [number, number, number, number])[] = [
  [12, 3, 34, 4],
  [48, 4.5, 74, 3.5],
  [82, 2.6, 104, 3.2],
];

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

function rootTube(r: DriftingIslandRoot): Seg {
  const p = new Path2D();
  p.moveTo(r.x, ROOT_TOP_Y);
  p.bezierCurveTo(r.x + r.sway, ROOT_TOP_Y + r.len * 0.33, r.x - r.sway, ROOT_TOP_Y + r.len * 0.66, r.x + r.sway * 0.5, ROOT_TOP_Y + r.len);
  return seg(p, DRIFTING_ISLAND_ROOT_W, DRIFTING_ISLAND_ROOT, DRIFTING_ISLAND_TUBE_OL);
}

function reedTube(r: DriftingIslandReed): Seg {
  const p = new Path2D();
  p.moveTo(r.x, REED_BASE_Y);
  p.quadraticCurveTo(r.x + r.lean * 0.4, REED_BASE_Y - r.h * 0.55, r.x + r.lean, REED_BASE_Y - r.h);
  return seg(p, DRIFTING_ISLAND_REED_W, DRIFTING_ISLAND_REED, DRIFTING_ISLAND_TUBE_OL);
}

/** The seed head of a tall reed: a round-ended brown oval sitting on the tip. */
export function driftingIslandSeedHead(r: DriftingIslandReed): { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number } {
  return { cx: r.x + r.lean, cy: REED_BASE_Y - r.h + 1, rx: 2.4, ry: 4.2 };
}

/** Paint the right half of the drifting island (see the file header), anchored on the centre line at the water line. */
export function paintDriftingIslandHalf(ctx: CanvasRenderingContext2D): void {
  // trailing roots, behind everything
  inkMany(ctx, DRIFTING_ISLAND_ROOTS.map(rootTube));

  // reeds, then the seed heads: all inks first, then all fills, so each head merges into its stem
  inkMany(ctx, DRIFTING_ISLAND_REEDS.map(reedTube));
  const heads = DRIFTING_ISLAND_REEDS.filter((r) => r.head).map((r) => {
    const h = driftingIslandSeedHead(r);
    const p = new Path2D();
    ell(p, h.cx, h.cy, h.rx, h.ry);
    return p;
  });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * 1.8;
  for (const p of heads) ctx.stroke(p);
  ctx.fillStyle = DRIFTING_ISLAND_SEED;
  for (const p of heads) ctx.fill(p);

  // the slab and its bumps: all inks first, then all fills, one inked silhouette
  const slab: Path2D[] = [];
  const main = new Path2D();
  ell(main, 0, DRIFTING_ISLAND_SLAB_CY, DRIFTING_ISLAND_SLAB_RX, DRIFTING_ISLAND_SLAB_RY);
  slab.push(main);
  for (const [cx, cy, rx, ry] of BUMPS) {
    const p = new Path2D();
    ell(p, cx, cy, rx, ry);
    slab.push(p);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * DRIFTING_ISLAND_INK;
  for (const p of slab) ctx.stroke(p);
  ctx.fillStyle = DRIFTING_ISLAND_MAT;
  for (const p of slab) ctx.fill(p);

  // matted straw: lumps and lines inside the silhouette, no ink
  ctx.fillStyle = DRIFTING_ISLAND_STRAW;
  for (const [cx, cy, rx, ry, rot] of LUMPS) {
    const p = new Path2D();
    ell(p, cx, cy, rx, ry, rot);
    ctx.fill(p);
  }
  ctx.strokeStyle = DRIFTING_ISLAND_STRAW;
  ctx.lineWidth = DRIFTING_ISLAND_STRAW_W;
  for (const [x0, y0, x1, y1] of STRAW_LINES) {
    const p = new Path2D();
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    ctx.stroke(p);
  }
}
