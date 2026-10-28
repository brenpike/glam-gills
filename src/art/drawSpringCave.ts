/**
 * Spring cave props (issue #77, ND-15 and ND-18; guide 3c, 7 and 10): the descent's row details
 * (a lit spring pool under the sky opening, grey-blue rock walls and the rock bed), the rock ledges
 * over the Common and Rare spots, the side grotto's back and front, the spring outflow marks, the
 * glow-plant in its three states (unlit, lit and hint-bright) and the soft light texture the
 * darkness cuts its holes with.
 *
 * Every value is derived (provisional). Presentational only: no Phaser, no game state, no
 * randomness. The painters take an explicit context and draw at logical scale; the bakes live in
 * springCaveTextures.ts. Every painter is a still frame, so each one is also its reduced-motion
 * version: the scene fades, pulses or snaps the sprites, never the painters.
 *
 * Contrast rule (guide 10, the pair method), the same as the pond, chinampa and canal looks keep:
 * every opaque background colour here, the rock, the rock bed slabs and the ledge shade, has
 * relative luminance 0.1687 or more, so ink #2b2350 is 3:1 or better against it. The pool light and
 * the outflow band only lighten (white at an alpha), so they never take a background under that
 * floor. The darkness (SPRING_DARK) is the one layer far under the floor on purpose: nothing that
 * must be seen in it is drawn in ink on it, but in a light colour. The unlit glow-plant is a dim
 * teal outline that is still 3:1 or better against the darkness; the lit plant is a bright fill with
 * its ink outline; the hint-bright plant is a thicker, brighter outline. In greyscale the order is
 * darkness, then the unlit outline, then the hint outline, then the lit fill.
 */
import { TAU, ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { CAVE_H, CAVE_TEX, CAVE_W } from './drawFinds';
import { INK, LW, SKY_HORIZON, SKY_TOP, SURF, VIEW_H, VIEW_W, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Grey-blue rock, luminance 0.2840, 4.58:1 with ink. Scenery, so the pair rule does not apply, but it is held to the floor. */
export const SPRING_ROCK = '#7f93ad';
/** Lighter rock, luminance 0.4465, 6.81:1 with ink. */
export const SPRING_ROCK_LIGHT = '#a3b4c9';
/** Darker rock, luminance 0.2307, 3.85:1 with ink: still over the floor. */
export const SPRING_ROCK_DARK = '#6f86a3';
/** Rock bed slabs, luminance 0.3289, 5.19:1 with ink. */
export const SPRING_BED_SLAB = '#8a9db6';
/** Cracks and strata on the rock. Internal detail lines, never ink. */
export const SPRING_ROCK_CRACK = 'rgba(52,68,96,0.55)';
/** Shine on the rock. */
export const SPRING_ROCK_SHINE = 'rgba(255,255,255,0.55)';
/** Glow moss on the grotto rock: luminance 0.3863. Inside the silhouette, so no ink. */
export const SPRING_MOSS = '#3fb8b4';
/** The lit pool under the sky opening: white over the water at this alpha. It only lightens. */
export const SPRING_POOL_LIGHT = 'rgba(232,251,255,0.30)';
/** The pool's ripple arcs. */
export const SPRING_POOL_RIPPLE = 'rgba(255,255,255,0.55)';
/** The inside of the grotto, a cold near-black (luminance 0.0046), 5.7:1 or more against the rock. */
export const SPRING_GROTTO_INTERIOR = '#050f1c';
/**
 * The shade under a rock ledge: the spring's mid blue #3c82b4 (luminance 0.2022, 3.46:1 with ink),
 * so even at its most solid it is over the luminance floor. As [r, g, b].
 */
export const SPRING_SHADE_RGB = [60, 130, 180] as const;
/** The darkness: a deep cold blue-black (luminance 0.0046). The dark layer is this colour with the lights cut out of it. */
export const SPRING_DARK = '#050f1c';

/** The unlit glow-plant's outline: a dim teal, luminance 0.2618, 5.71:1 against SPRING_DARK. */
export const GLOW_PLANT_DIM = '#2c9aa0';
/** The unlit glow-plant's faint body. */
export const GLOW_PLANT_DIM_FILL = 'rgba(44,154,160,0.16)';
/** The hint-bright glow-plant's outline: a bright mint, luminance 0.7675, 14.98:1 against SPRING_DARK. */
export const GLOW_PLANT_HINT = '#8ff5e4';
/** The hint-bright glow-plant's body. */
export const GLOW_PLANT_HINT_FILL = 'rgba(143,245,228,0.22)';
/** The ring of light round the hint-bright plant, at its centre. It fades to nothing at the edge. */
export const GLOW_PLANT_HINT_RING = 'rgba(143,245,228,0.30)';
/** The lit glow-plant's pods: luminance 0.9293, 13.42:1 with ink and 17.94:1 against SPRING_DARK. */
export const GLOW_PLANT_LIT = '#d9fff6';
/** The lit glow-plant's stalks and leaves, luminance 0.4478, 6.82:1 with ink. */
export const GLOW_PLANT_LIT_STEM = '#4dc4be';
/** The lit glow-plant's own halo, at its centre. It fades to nothing at the edge. */
export const GLOW_PLANT_LIT_HALO = 'rgba(160,255,235,0.55)';

// ---------------------------------------------------------------------------
// Row details: the lit spring pool, the rock walls and the rock bed
// ---------------------------------------------------------------------------

/** Which row of the descent a chunk is: the top row has the sky and the pool, the bottom row the bed. */
export type SpringRow = 'top' | 'middle' | 'bottom';

/** What the row painters need of a chunk. */
export interface SpringRowOptions {
  readonly row: SpringRow;
  /** The first chunk of its row: paint the rock wall on the left. */
  readonly edgeLeft: boolean;
  /** The last chunk of its row: paint the rock wall on the right. */
  readonly edgeRight: boolean;
  /** The bed's top edge at a chunk x. Default: a flat 322, the canal bed's mean. */
  readonly bedEdge?: (x: number) => number;
}

/** The bed's mean top edge in a chunk (the canal's: 322). */
export const SPRING_BED_EDGE_Y = 322;

/** Wall boulders: one every 60 px, so a pattern with a period of 6 tiles the 360 px chunk and its neighbours join. */
const WALL_STEP = 60;
/** The deepest a wall reaches into the chunk, px: under the swim bound (40), so the wall never covers the axolotl's reach. */
export const SPRING_WALL_REACH = 36;
const WALL_LW = LW * 0.75;
const WALL_FILLS: readonly string[] = [SPRING_ROCK, SPRING_ROCK_LIGHT, SPRING_ROCK_DARK];

interface Boulder {
  /** Centre, px in from the chunk edge. */
  readonly inset: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly fill: string;
}

/** The boulders of one wall, one per 60 px from one before the chunk to one past it. Nothing random: the index decides all. */
function wallBoulders(): readonly Boulder[] {
  const out: Boulder[] = [];
  for (let i = 0; i <= VIEW_H / WALL_STEP + 1; i++) {
    out.push({
      inset: 2 + (i % 2) * 6,
      y: (i - 1) * WALL_STEP + WALL_STEP / 2,
      rx: 24 + (i % 3) * 2,
      ry: 34,
      fill: WALL_FILLS[i % 3],
    });
  }
  return out;
}

/** Every wall boulder, shared by both walls. */
export const SPRING_WALL_BOULDERS: readonly Boulder[] = wallBoulders();

/** One wall at a chunk side: boulders from the deepest in, a crack across each and one shine. */
function paintWall(ctx: CanvasRenderingContext2D, side: 'left' | 'right'): void {
  const sign = side === 'left' ? 1 : -1;
  const edgeX = side === 'left' ? 0 : VIEW_W;
  for (const b of SPRING_WALL_BOULDERS) {
    const x = edgeX + sign * b.inset;
    const body = new Path2D();
    ell(body, x, b.y, b.rx, b.ry);
    shape(ctx, body, b.fill, WALL_LW);

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = SPRING_ROCK_CRACK;
    const crack = new Path2D();
    crack.moveTo(x + sign * b.rx * 0.2, b.y - b.ry * 0.5);
    crack.lineTo(x + sign * b.rx * 0.5, b.y - b.ry * 0.1);
    crack.lineTo(x + sign * b.rx * 0.35, b.y + b.ry * 0.35);
    ctx.stroke(crack);

    const shine = new Path2D();
    ell(shine, x + sign * b.rx * 0.38, b.y - b.ry * 0.45, b.rx * 0.2, b.ry * 0.08, sign * 0.4);
    ctx.fillStyle = SPRING_ROCK_SHINE;
    ctx.fill(shine);
  }
}

/**
 * The sky opening in the rock roof of a top chunk: a domed window from x 20 to 460, its sides and
 * round top inked, its foot on the waterline. Neighbouring chunks leave a 40 px rock pillar between
 * their windows. The sky in it is the canal's sky (SKY_TOP to SKY_HORIZON), so the opening is the
 * one bright patch of a roof that is otherwise grey-blue rock.
 */
export const SPRING_SKY_OPENING = { x0: 20, x1: 460, top: 8, shoulder: 32, foot: SURF + 3 } as const;
/** Cracks across the roof between the windows: [x, y, dx, dy]. Internal detail lines. */
const ROOF_CRACKS: readonly (readonly [number, number, number, number])[] = [
  [236, 2, 6, 4],
  [6, 52, 8, -6],
  [468, 30, -9, 8],
  [8, 20, 8, 5],
  [462, 62, -8, -4],
];

/** The window's outline, left foot up over the dome to the right foot. Open it is the inked edge; closed along the waterline it is the fill. */
function skyOpeningPath(closed: boolean): Path2D {
  const { x0, x1, top, shoulder, foot } = SPRING_SKY_OPENING;
  const p = new Path2D();
  p.moveTo(x0, foot);
  p.lineTo(x0, top + shoulder);
  p.quadraticCurveTo(x0, top, x0 + shoulder * 1.6, top);
  p.lineTo(x1 - shoulder * 1.6, top);
  p.quadraticCurveTo(x1, top, x1, top + shoulder);
  p.lineTo(x1, foot);
  if (closed) p.closePath();
  return p;
}

/**
 * Paint the sky opening in the roof of a top chunk, over the roof the look has painted: cracks in
 * the rock, then the window filled with sky and inked along its dome and sides. The foot is open, so
 * the sky meets the water. Nothing random, and no dark: the sky is lighter than the roof.
 */
export function paintSkyOpening(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  for (const [x, y, dx, dy] of ROOF_CRACKS) ctx.stroke(line(x, y, x + dx, y + dy));

  const { top, foot } = SPRING_SKY_OPENING;
  const sky = ctx.createLinearGradient(0, top, 0, foot);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = sky;
  ctx.fill(skyOpeningPath(true));
  ctx.lineWidth = LW * 0.8;
  ctx.strokeStyle = INK;
  ctx.stroke(skyOpeningPath(false));
}

/** Where the lit pool sits: the lower half of an ellipse across the chunk, hanging from the waterline (SURF + 3). */
export const SPRING_POOL = { cx: VIEW_W / 2, top: SURF + 3, rx: 250, ry: 80 } as const;
/** The pool's ripple arcs: [x, y, half width]. Short, level and in the pool. */
export const SPRING_POOL_RIPPLES: readonly (readonly [number, number, number])[] = [
  [80, SURF + 22, 20],
  [170, SURF + 34, 26],
  [262, SURF + 18, 18],
  [340, SURF + 40, 28],
  [420, SURF + 26, 20],
  [130, SURF + 58, 18],
  [300, SURF + 66, 22],
];
const POOL_RIPPLE_LW = 2;

/**
 * Paint the lit spring pool under the sky opening of a top chunk, over the water and the rays: a
 * pale light that is strongest under the surface and fades with depth, and level ripple arcs in it.
 * Light only, no ink and no dark: the pool brightens the water and never takes it under the floor.
 */
export function paintSpringPool(ctx: CanvasRenderingContext2D): void {
  const { cx, top, rx, ry } = SPRING_POOL;
  const g = ctx.createLinearGradient(0, top, 0, top + ry);
  g.addColorStop(0, SPRING_POOL_LIGHT);
  g.addColorStop(1, 'rgba(232,251,255,0)');
  const pool = new Path2D();
  pool.moveTo(cx - rx, top);
  pool.ellipse(cx, top, rx, ry, 0, Math.PI, 0, true);
  pool.closePath();
  ctx.fillStyle = g;
  ctx.fill(pool);

  ctx.lineWidth = POOL_RIPPLE_LW;
  ctx.strokeStyle = SPRING_POOL_RIPPLE;
  for (const [x, y, half] of SPRING_POOL_RIPPLES) {
    const arc = new Path2D();
    arc.moveTo(x - half, y);
    arc.quadraticCurveTo(x, y - 3.5, x + half, y);
    ctx.stroke(arc);
  }
}

/** Paint the rock walls of a chunk that is at the left or the right end of its row. */
export function paintRockWalls(ctx: CanvasRenderingContext2D, edgeLeft: boolean, edgeRight: boolean): void {
  if (edgeLeft) paintWall(ctx, 'left');
  if (edgeRight) paintWall(ctx, 'right');
}

/**
 * Rock bed slabs: [x, y below the bed edge, width, height, fill]. All inside the chunk (x 6 to 474),
 * so every chunk of the bottom row paints the same and none is cut at a chunk edge.
 */
const BED_SLABS: readonly (readonly [number, number, number, number, string])[] = [
  [14, 14, 74, 15, SPRING_BED_SLAB],
  [104, 24, 58, 12, SPRING_ROCK_LIGHT],
  [176, 12, 84, 15, SPRING_BED_SLAB],
  [278, 24, 64, 12, SPRING_ROCK_LIGHT],
  [354, 13, 78, 15, SPRING_BED_SLAB],
  [438, 25, 34, 11, SPRING_ROCK_LIGHT],
];
/** Small rocks that sit on the bed edge: [x, rx, ry, fill]. Their lower half is sunk into the bed. */
const BED_STONES: readonly (readonly [number, number, number, string])[] = [
  [60, 13, 8, SPRING_ROCK],
  [150, 9, 6, SPRING_ROCK_DARK],
  [232, 15, 9, SPRING_ROCK],
  [318, 10, 6, SPRING_ROCK_DARK],
  [404, 14, 8, SPRING_ROCK],
];
const BED_LW = LW * 0.6;

/**
 * Paint the rock bed over the bed a bottom chunk has painted: flat grey-blue slabs lying in it, each
 * with a crack, and small rocks sitting on its top edge. `bedEdge` gives the bed's top edge at a
 * chunk x, so the stones sit on the real edge; the slabs lie under it. Nothing random.
 */
export function paintRockBed(ctx: CanvasRenderingContext2D, bedEdge: (x: number) => number = () => SPRING_BED_EDGE_Y): void {
  for (const [x, dy, w, h, fill] of BED_SLABS) {
    const top = bedEdge(x + w / 2) + dy;
    const slab = new Path2D();
    ell(slab, x + w / 2, top + h / 2, w / 2, h / 2);
    shape(ctx, slab, fill, BED_LW);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = SPRING_ROCK_CRACK;
    ctx.stroke(line(x + w * 0.35, top + h * 0.3, x + w * 0.5, top + h * 0.7));
  }
  for (const [x, rx, ry, fill] of BED_STONES) {
    const stone = new Path2D();
    ell(stone, x, bedEdge(x) + 1, rx, ry);
    shape(ctx, stone, fill, BED_LW);
    const shine = new Path2D();
    ell(shine, x - rx * 0.35, bedEdge(x) + 1 - ry * 0.45, rx * 0.22, ry * 0.12, -0.4);
    ctx.fillStyle = SPRING_ROCK_SHINE;
    ctx.fill(shine);
  }
}

/**
 * Paint the row details of a chunk, with the chunk's top-left at local (0, 0), after the water,
 * the rays and (bottom row) the bed: the sky opening and the pool in a top chunk, the walls at the ends of a row and
 * the rock bed in a bottom chunk. A middle chunk with no end is plain water and paints nothing.
 */
export function paintSpringRowDetails(ctx: CanvasRenderingContext2D, o: SpringRowOptions): void {
  if (o.row === 'top') {
    paintSkyOpening(ctx);
    paintSpringPool(ctx);
  }
  if (o.row === 'bottom') paintRockBed(ctx, o.bedEdge);
  paintRockWalls(ctx, o.edgeLeft, o.edgeRight);
}

// ---------------------------------------------------------------------------
// Rock ledge (bank overhang)
// ---------------------------------------------------------------------------

/** The water under one rock ledge, as a rect of the zone: nominal 440 x 60, stretched to the rect like the bank overhang. */
export const ROCK_LEDGE_W = 440;
export const ROCK_LEDGE_H = 60;
/** Texture frame of the ledge. Anchor is the top-left corner of the rect, like the chinampa overhang. */
export const ROCK_LEDGE_TEX: TexSize = frameFromBounds(0, 0, ROCK_LEDGE_W, ROCK_LEDGE_H, 4);
/** The shade under the ledge, [y as a fraction of the height, alpha]: nearly solid over the spots, fading to nothing at the bottom. */
export const ROCK_LEDGE_SHADE_STOPS: readonly (readonly [number, number])[] = [
  [0, 0.9],
  [0.8, 0.8],
  [1, 0],
];
/** Width of one scallop on the ledge's lower edge. */
const LEDGE_SCALLOP = 44;
/** Stalactites under the ledge: [x, length below the lip]. */
const LEDGE_TEETH: readonly (readonly [number, number])[] = [
  [28, 16],
  [62, 24],
  [98, 14],
  [136, 26],
  [172, 18],
  [210, 28],
  [246, 14],
  [284, 24],
  [320, 18],
  [356, 26],
  [392, 16],
  [420, 22],
];
const LEDGE_TOOTH_LW = LW * 0.7;

/** The shade's outline: flat along the waterline, its sides sloping in toward the bottom. */
function ledgeShadePath(): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.lineTo(ROCK_LEDGE_W, 0);
  p.quadraticCurveTo(ROCK_LEDGE_W - 2, 34, ROCK_LEDGE_W - 26, ROCK_LEDGE_H);
  p.lineTo(26, ROCK_LEDGE_H);
  p.quadraticCurveTo(2, 34, 0, 0);
  p.closePath();
  return p;
}

/** The lip: flat on top, a scalloped lower edge. Open it is the inked edge; closed along the waterline it is the fill. */
function ledgeLipPath(closed: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(ROCK_LEDGE_W, 0);
  p.lineTo(ROCK_LEDGE_W, 10);
  for (let x = ROCK_LEDGE_W; x > 0; x -= LEDGE_SCALLOP) {
    p.quadraticCurveTo(x - LEDGE_SCALLOP / 2, 24, x - LEDGE_SCALLOP, 10);
  }
  p.lineTo(0, 0);
  if (closed) p.closePath();
  return p;
}

/**
 * Paint a rock ledge with its top-left corner at local (0, 0), the waterline: a blue shade over
 * the water that hides what is under the ledge (guide 7e, cover), stalactites hanging from the
 * lip, and the rock lip with its scalloped edge, a few strata cracks and shines. Drawn above hidden
 * treasures and under the haze, so it is scenery and no cue object.
 */
export function paintRockLedge(ctx: CanvasRenderingContext2D): void {
  const [r, g, b] = SPRING_SHADE_RGB;
  const grad = ctx.createLinearGradient(0, 0, 0, ROCK_LEDGE_H);
  for (const [t, a] of ROCK_LEDGE_SHADE_STOPS) grad.addColorStop(t, `rgba(${r},${g},${b},${a})`);
  ctx.fillStyle = grad;
  ctx.fill(ledgeShadePath());

  for (const [x, len] of LEDGE_TEETH) {
    const tooth = new Path2D();
    tooth.moveTo(x - 7, 10);
    tooth.quadraticCurveTo(x - 3, 10 + len * 0.6, x, 12 + len);
    tooth.quadraticCurveTo(x + 3, 10 + len * 0.6, x + 7, 10);
    tooth.closePath();
    shape(ctx, tooth, SPRING_ROCK_DARK, LEDGE_TOOTH_LW);
  }

  ctx.fillStyle = SPRING_ROCK;
  ctx.fill(ledgeLipPath(true));
  ctx.lineWidth = LW * 0.8;
  ctx.strokeStyle = INK;
  ctx.stroke(ledgeLipPath(false));

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SPRING_ROCK_CRACK;
  for (const [x0, x1] of [
    [20, 90],
    [130, 210],
    [260, 330],
    [370, 420],
  ] as const) {
    ctx.stroke(line(x0, 7, x1, 7));
  }
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = SPRING_ROCK_SHINE;
  for (const [x0, x1] of [
    [40, 80],
    [150, 200],
    [280, 320],
    [380, 410],
  ] as const) {
    ctx.stroke(line(x0, 3.5, x1, 3.5));
  }
}

// ---------------------------------------------------------------------------
// Side grotto
// ---------------------------------------------------------------------------

/** Outer size to the ink edge, the same as the cave's, so both bake and place alike (drawFinds CAVE_W x CAVE_H). */
export const GROTTO_W = CAVE_W;
export const GROTTO_H = CAVE_H;
/** Texture frame shared by the grotto back and front. Anchor is the base centre, on the bed. */
export const GROTTO_TEX: TexSize = CAVE_TEX;
/** The opening: half width, and the centre height of its round top (the top is a half circle on it). */
export const GROTTO_OPENING = { halfW: 56, rise: 52 } as const;
const GROTTO_LW = 3.5;

interface GrottoRock {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
  readonly fill: string;
}

/**
 * Eleven rocks round the opening, in drawing order: a low foot stone each side, so the rim meets the
 * bed with no gap; then two pillars of three, a low lintel of two and the keystone over them. The outer ink edge stays inside 180 x 136.
 */
export const GROTTO_ROCKS: readonly GrottoRock[] = [
  { x: -66, y: -9, rx: 15, ry: 9, rot: 0, fill: SPRING_ROCK_DARK },
  { x: 66, y: -9, rx: 15, ry: 9, rot: 0, fill: SPRING_ROCK },
  { x: -71, y: -24, rx: 17, ry: 24, rot: 0, fill: SPRING_ROCK },
  { x: -64, y: -62, rx: 19, ry: 22, rot: -0.2, fill: SPRING_ROCK_LIGHT },
  { x: -48, y: -96, rx: 22, ry: 22, rot: -0.4, fill: SPRING_ROCK },
  { x: -18, y: -112, rx: 24, ry: 20, rot: 0, fill: SPRING_ROCK_DARK },
  { x: 22, y: -112, rx: 24, ry: 20, rot: 0, fill: SPRING_ROCK },
  { x: 50, y: -96, rx: 22, ry: 22, rot: 0.4, fill: SPRING_ROCK_LIGHT },
  { x: 64, y: -62, rx: 19, ry: 22, rot: 0.2, fill: SPRING_ROCK },
  { x: 71, y: -24, rx: 17, ry: 24, rot: 0, fill: SPRING_ROCK_DARK },
  { x: 2, y: -122, rx: 12, ry: 10, rot: 0, fill: SPRING_ROCK_LIGHT },
];
/** Glow moss patches on the rocks: [x, y, rx, ry]. */
const GROTTO_MOSS: readonly (readonly [number, number, number, number])[] = [
  [-66, -44, 7, 3.4],
  [-46, -108, 6, 3],
  [52, -108, 7, 3.2],
  [66, -42, 6, 3],
];

/**
 * Paint the grotto interior with its base centre at local (0, 0): a cold near-black round-topped
 * opening, flat on the bed, a little bigger than the gap in the rocks so the front's ink covers its
 * edge. Drawn behind everything hidden; the front rocks cover the rest.
 */
export function paintGrottoBack(ctx: CanvasRenderingContext2D): void {
  const { halfW, rise } = GROTTO_OPENING;
  const opening = new Path2D();
  opening.moveTo(-halfW, 0);
  opening.lineTo(-halfW, -rise);
  opening.arc(0, -rise, halfW, Math.PI, TAU);
  opening.lineTo(halfW, 0);
  opening.closePath();
  ctx.fillStyle = SPRING_GROTTO_INTERIOR;
  ctx.fill(opening);
}

/**
 * Paint the grotto rim with its base centre at local (0, 0): grey-blue rocks with `shape` ink 3.5,
 * a pebble shine each and a little glow moss. No flag, no glow of its own.
 */
export function paintGrottoFront(ctx: CanvasRenderingContext2D): void {
  for (const rock of GROTTO_ROCKS) {
    const body = new Path2D();
    ell(body, rock.x, rock.y, rock.rx, rock.ry, rock.rot);
    shape(ctx, body, rock.fill, GROTTO_LW);

    const shine = new Path2D();
    ell(shine, rock.x - rock.rx * 0.38, rock.y - rock.ry * 0.45, rock.rx * 0.22, rock.ry * 0.1, -0.5);
    ctx.fillStyle = SPRING_ROCK_SHINE;
    ctx.fill(shine);
  }
  ctx.fillStyle = SPRING_MOSS;
  for (const [x, y, rx, ry] of GROTTO_MOSS) {
    const moss = new Path2D();
    ell(moss, x, y, rx, ry);
    ctx.fill(moss);
  }
}

// ---------------------------------------------------------------------------
// Spring outflow marks
// ---------------------------------------------------------------------------

/** The outflow's nominal rect: 160 x 120, the spring current's size. A different rect stretches it. */
export const OUTFLOW_W = 160;
export const OUTFLOW_H = 120;
/** Texture frame of the outflow marks. Anchor is the top-left corner of the current's rect. */
export const OUTFLOW_TEX: TexSize = frameFromBounds(0, 0, OUTFLOW_W, OUTFLOW_H, 4);
/** The lighter band of water at its widest, at the right end where the water comes in. */
export const OUTFLOW_BAND = 'rgba(232,251,255,0.26)';
const OUTFLOW_BAND_CLEAR = 'rgba(232,251,255,0)';
export const OUTFLOW_LINE = 'rgba(255,255,255,0.7)';
const OUTFLOW_LINE_WIDTH = 2.4;
export const OUTFLOW_CHEVRON_W = 9;
export const OUTFLOW_CHEVRON_H = 5;
const OUTFLOW_TRAIL = 30;
/** Flow marks, each a trail and a left-pointing chevron at its tip: [x of the tip, y]. All point left, the way the water runs. */
export const OUTFLOW_CHEVRONS: readonly (readonly [number, number])[] = [
  [30, 22],
  [76, 42],
  [34, 62],
  [86, 82],
  [44, 102],
];

/**
 * Paint the spring outflow marks with the rect's top-left at local (0, 0): a lighter band of water
 * that widens toward the right, where the water comes in, and five white flow lines each ending in
 * a left-pointing chevron. The chevrons are the shape cue that the water runs left, so it reads
 * without colour. Light only, so it never takes the water under the luminance floor. The scene's
 * flow streaks (motion) sit over it.
 */
export function paintSpringOutflow(ctx: CanvasRenderingContext2D): void {
  const mid = OUTFLOW_H / 2;
  const band = new Path2D();
  band.moveTo(OUTFLOW_W, 0);
  band.quadraticCurveTo(OUTFLOW_W * 0.55, 3, 0, mid);
  band.quadraticCurveTo(OUTFLOW_W * 0.55, OUTFLOW_H - 3, OUTFLOW_W, OUTFLOW_H);
  band.closePath();
  const g = ctx.createLinearGradient(0, 0, OUTFLOW_W, 0);
  g.addColorStop(0, OUTFLOW_BAND_CLEAR);
  g.addColorStop(1, OUTFLOW_BAND);
  ctx.fillStyle = g;
  ctx.fill(band);

  ctx.lineWidth = OUTFLOW_LINE_WIDTH;
  ctx.strokeStyle = OUTFLOW_LINE;
  for (const [tip, y] of OUTFLOW_CHEVRONS) {
    const trail = new Path2D();
    trail.moveTo(tip + OUTFLOW_TRAIL, y + 2);
    trail.quadraticCurveTo(tip + OUTFLOW_TRAIL * 0.5, y - 3, tip, y);
    ctx.stroke(trail);
    const head = new Path2D();
    head.moveTo(tip + OUTFLOW_CHEVRON_W, y - OUTFLOW_CHEVRON_H);
    head.lineTo(tip, y);
    head.lineTo(tip + OUTFLOW_CHEVRON_W, y + OUTFLOW_CHEVRON_H);
    ctx.stroke(head);
  }
}

// ---------------------------------------------------------------------------
// Glow-plant
// ---------------------------------------------------------------------------

/** The three states of a glow-plant (issue #77, ND-8 and ND-18): unlit, lit by a touch, and brightened by the hint. */
export type GlowPlantState = 'unlit' | 'lit' | 'hint';

/** Half the glow-plant frame, px: the halo reaches 40, so the frame is 88 across. */
export const GLOW_PLANT_HALF = 44;
/** Texture frame of every glow-plant state. Anchor is the plant's centre, the centre of its touch circle. */
export const GLOW_PLANT_TEX: TexSize = frameFromBounds(-GLOW_PLANT_HALF, -GLOW_PLANT_HALF, GLOW_PLANT_HALF, GLOW_PLANT_HALF, 0);
/** Radius of the lit plant's halo. */
export const GLOW_PLANT_HALO_RADIUS = 40;
/** Radius of the hint ring. */
export const GLOW_PLANT_RING_RADIUS = 34;
/** Outline widths: the unlit plant's dim outline, the hint-bright one (thicker as well as brighter) and the lit plant's ink. */
export const GLOW_PLANT_UNLIT_LW = 2.6;
export const GLOW_PLANT_HINT_LW = 3.6;
const GLOW_PLANT_LIT_LW = 2.6;

interface Pod {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/** Three pods, a tall one between two short ones, in plant-local px. None overlap, so the outline states show no crossing line. */
export const GLOW_PLANT_PODS: readonly Pod[] = [
  { x: -15, y: 0, rx: 6.5, ry: 8.5 },
  { x: 15, y: 0, rx: 6.5, ry: 8.5 },
  { x: 0, y: -9, rx: 8, ry: 11 },
];
/** The point where the stalks and the leaves meet: low in the frame, under the pods. */
const PLANT_BASE = { x: 0, y: 20 } as const;

/** One stalk from the base to the foot of a pod. */
function stalkPath(pod: Pod): Path2D {
  const p = new Path2D();
  p.moveTo(PLANT_BASE.x, PLANT_BASE.y);
  p.quadraticCurveTo(pod.x * 0.2, (PLANT_BASE.y + pod.y + pod.ry) / 2, pod.x, pod.y + pod.ry);
  return p;
}

/** Two leaf blades curving out from the base. */
function leafPaths(): readonly Path2D[] {
  return ([-1, 1] as const).map((s) => {
    const p = new Path2D();
    p.moveTo(PLANT_BASE.x, PLANT_BASE.y);
    p.quadraticCurveTo(s * 10, PLANT_BASE.y - 2, s * 21, PLANT_BASE.y - 12);
    return p;
  });
}

/** The pod outline as a path. */
function podPath(pod: Pod): Path2D {
  const p = new Path2D();
  ell(p, pod.x, pod.y, pod.rx, pod.ry);
  return p;
}

/** The outline states (unlit and hint): a thin line of one colour round a faint body, no ink. */
function paintPlantOutline(ctx: CanvasRenderingContext2D, stroke: string, fill: string, lw: number): void {
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  for (const pod of GLOW_PLANT_PODS) ctx.stroke(stalkPath(pod));
  for (const leaf of leafPaths()) ctx.stroke(leaf);
  for (const pod of GLOW_PLANT_PODS) {
    const body = podPath(pod);
    ctx.fillStyle = fill;
    ctx.fill(body);
    ctx.stroke(body);
  }
}

/** A soft round glow at the centre: `colour` at the middle, fading to nothing at `radius`. */
function paintPlantGlow(ctx: CanvasRenderingContext2D, colour: string, radius: number): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(160,255,235,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
}

/**
 * Paint one glow-plant state with its centre at local (0, 0), the centre of the touch circle.
 * - 'unlit': a dim teal outline (GLOW_PLANT_DIM) round a faint body; no ink and no fill of weight.
 * - 'hint': the same shape in a bright mint, a thicker outline and a faint ring of light round it.
 *   Under reduced motion the scene shows this state at once; with motion it pulses the sprite.
 * - 'lit': bright pods with their ink outline on teal stalks and leaves, inside a halo; a white
 *   core in each pod.
 * The three share one silhouette and one frame, so a swap is a texture change and the plant never
 * moves; they differ by brightness and weight, so they read in greyscale.
 */
export function paintGlowPlant(ctx: CanvasRenderingContext2D, state: GlowPlantState): void {
  if (state === 'unlit') {
    paintPlantOutline(ctx, GLOW_PLANT_DIM, GLOW_PLANT_DIM_FILL, GLOW_PLANT_UNLIT_LW);
    return;
  }
  if (state === 'hint') {
    paintPlantGlow(ctx, GLOW_PLANT_HINT_RING, GLOW_PLANT_RING_RADIUS);
    paintPlantOutline(ctx, GLOW_PLANT_HINT, GLOW_PLANT_HINT_FILL, GLOW_PLANT_HINT_LW);
    return;
  }
  paintPlantGlow(ctx, GLOW_PLANT_LIT_HALO, GLOW_PLANT_HALO_RADIUS);
  const tubes: Seg[] = [
    ...GLOW_PLANT_PODS.map((pod) => seg(stalkPath(pod), 3, GLOW_PLANT_LIT_STEM, 2)),
    ...leafPaths().map((leaf) => seg(leaf, 4, GLOW_PLANT_LIT_STEM, 2)),
  ];
  inkMany(ctx, tubes);
  for (const pod of GLOW_PLANT_PODS) {
    shape(ctx, podPath(pod), GLOW_PLANT_LIT, GLOW_PLANT_LIT_LW);
    const core = new Path2D();
    ell(core, pod.x, pod.y - pod.ry * 0.15, pod.rx * 0.4, pod.ry * 0.42);
    ctx.fillStyle = WHITE;
    ctx.fill(core);
  }
}

// ---------------------------------------------------------------------------
// Soft light
// ---------------------------------------------------------------------------

/** Half the soft light frame, px. The gradient fades to nothing at this radius. */
export const SOFT_LIGHT_HALF = 160;
/**
 * The radius the scene scales to a light's own radius: a light of radius R shows its sprite at
 * R / SOFT_LIGHT_RADIUS times logical size. Inside it, the light is at least SOFT_LIGHT_EDGE_ALPHA
 * strong, so a part exactly at a light's radius (inclusive, litByAny) is lit.
 */
export const SOFT_LIGHT_RADIUS = 128;
/** The light's strength at SOFT_LIGHT_RADIUS. */
export const SOFT_LIGHT_EDGE_ALPHA = 0.6;
/** Texture frame of the soft light. Anchor is the centre. */
export const SOFT_LIGHT_TEX: TexSize = frameFromBounds(-SOFT_LIGHT_HALF, -SOFT_LIGHT_HALF, SOFT_LIGHT_HALF, SOFT_LIGHT_HALF, 0);
/**
 * Gradient stops, [distance as a fraction of SOFT_LIGHT_HALF, alpha]: full strength out to half the
 * half-width, 0.9 at 0.65, SOFT_LIGHT_EDGE_ALPHA at SOFT_LIGHT_RADIUS (0.8), and nothing at the edge.
 */
export const SOFT_LIGHT_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.5, 1],
  [0.65, 0.9],
  [SOFT_LIGHT_RADIUS / SOFT_LIGHT_HALF, SOFT_LIGHT_EDGE_ALPHA],
  [1, 0],
];

/**
 * Paint the soft light centred at local (0, 0): a white disc that is full strength at the middle and
 * fades to nothing at SOFT_LIGHT_HALF. The darkness cuts its holes with it (an erase blend, so
 * strength is how much dark is taken away); colour is plain white and carries nothing. No ink.
 */
export function paintSoftLight(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, SOFT_LIGHT_HALF);
  for (const [t, a] of SOFT_LIGHT_STOPS) g.addColorStop(t, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(-SOFT_LIGHT_HALF, -SOFT_LIGHT_HALF, SOFT_LIGHT_HALF * 2, SOFT_LIGHT_HALF * 2);
}
