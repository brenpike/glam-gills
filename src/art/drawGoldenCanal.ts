/**
 * Golden-hour deep canal decorations (issue #112, Area 11; guide 2, 7a, 10): papel picado banners in
 * the sky strip, marigold petal patches and water hyacinth rafts just under the surface, stake-and-weave
 * chinampa walls with ahuejote root curtains along the banks and at the area's ends, sunken trajinera
 * arches on the bed, and the lit lower row (light shafts and a bed glow). paintSinkingPetal is the one
 * marigold petal a later on-demand sprite lets sink slowly through the water.
 *
 * Every painter paints into the per-area background chunks that are already baked on demand
 * (sceneryCache.ts): no new scenery texture. Presentational only: no Phaser, no game state, no time
 * and no randomness, so a look that paints none of this keeps its random draws. Each decoration has a
 * place in world x (the placement tables below), and a chunk paints every decoration that reaches into
 * it, in world coordinates less the chunk's left edge, so a decoration crossing a chunk edge is drawn
 * whole in both chunks and meets itself there. The placements fit the Area 11 layout (10 by 2
 * screens, a U-turn): clear of the cormorants' stretches, the surface boats, the lures and the
 * gameplay places, as goldenCanalPlacement.test.ts checks.
 *
 * Readability (guide 2): the axolotl stays the brightest, warmest thing. Every decoration fill is
 * darker than the Leucistic belly and less colourful (OKLCH chroma) than the Leucistic body, and
 * every one is at the luminance floor 0.1687 or more, so ink is 3:1 or better against it wherever a
 * cue object passes over it. Shapes: round petals and flowers, rounded flags with scalloped edges and
 * round cut-outs, rounded wood. No letters (never text), no stars, no pointed shapes, no worm or bug
 * shapes, no faces, no skulls, and no dark opening, so nothing reads as a snack, a hint star, a hazard
 * or a hiding place. The rafts are scenery, not cover: thin, at the surface, behind every cue object.
 */
import { TAU, blob, ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { DEEP_CANAL_BED_TOP } from './habitatLook';
import { LW, RAY_END_Y, SURF, VIEW_H, VIEW_W } from './palette';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Marigold petal: a soft, sun-faded marigold (luminance 0.4843, OKLCH chroma 0.085). */
export const MARIGOLD_PETAL = '#e4ae84';
/** Lighter marigold petal (0.6398). Inside a patch, no ink. */
export const MARIGOLD_PETAL_LIGHT = '#f0cc98';
/** Marigold heart, a warm tan (0.3809). */
export const MARIGOLD_CENTRE = '#c4a072';
/** Water hyacinth raft leaf, a dusty green (0.3138), and its lighter glossy leaf (0.4618). */
export const RAFT_LEAF = '#86a070';
export const RAFT_LEAF_LIGHT = '#a8bc8c';
/** Water hyacinth raft flower, a dusty lilac (0.4259), and its centre, a soft gold (0.6169). */
export const RAFT_FLOWER = '#bba6d4';
export const RAFT_FLOWER_CENTRE = '#e4cc90';
/** Roots: the raft's hanging roots and the ahuejote root curtains, a pale root brown (0.2740). */
export const ROOT_BROWN = '#a08c70';
/** Chinampa wall: the backing (0.2141), the stakes (0.2740) and the woven withies (0.3400). */
export const WALL_BACK = '#8f7d63';
export const WALL_STAKE = ROOT_BROWN;
export const WALL_WEAVE = '#b39a76';
/** Papel picado flag colours, faded by the sun: pink, marigold, teal, lilac and gold. */
export const PAPEL_PICADO_COLOURS: readonly string[] = ['#dca2ac', MARIGOLD_PETAL, '#8fc0b4', RAFT_FLOWER, RAFT_FLOWER_CENTRE];
/** The banner string (0.2141). */
export const BANNER_STRING = WALL_BACK;
/** Sunken arch wood (0.2751) and its name-board, a faded cream (0.5463). */
export const ARCH_WOOD = '#a98a63';
export const ARCH_BOARD = '#d8c09a';
/** Silt heaped over the arch's feet: the deep canal bed's own top colour. */
export const ARCH_SILT = DEEP_CANAL_BED_TOP;
/** The golden light of the lower row, as [r, g, b]. Painted with the screen blend, so it only lightens. */
export const GOLDEN_LIGHT_RGB = [255, 224, 168] as const;

/** Every opaque fill a decoration uses, for the readability and contrast rules. */
export const GOLDEN_DECOR_FILLS: readonly string[] = [
  MARIGOLD_PETAL,
  MARIGOLD_PETAL_LIGHT,
  MARIGOLD_CENTRE,
  RAFT_LEAF,
  RAFT_LEAF_LIGHT,
  RAFT_FLOWER,
  RAFT_FLOWER_CENTRE,
  ROOT_BROWN,
  WALL_BACK,
  WALL_WEAVE,
  ...PAPEL_PICADO_COLOURS,
  ARCH_WOOD,
  ARCH_BOARD,
  ARCH_SILT,
];

/** Thin decoration outline: scenery sits under the hero's weight (guide 4b). */
const DECOR_LW = LW * 0.4;

// ---------------------------------------------------------------------------
// Placement tables (world x)
// ---------------------------------------------------------------------------

/** A papel picado banner: a string from `x0` to `x1` hung at `y`, sagging `sag` px at its middle. */
export interface BannerSpec {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly sag: number;
}

/**
 * Papel picado banners across the sky strip (y 0 to 86), hung high enough that every flag clears
 * the top of a floating cormorant's frame. Several cross a chunk edge.
 */
export const PAPEL_PICADO_BANNERS: readonly BannerSpec[] = [
  { x0: 80, x1: 340, y: 5, sag: 9 },
  { x0: 430, x1: 870, y: 4, sag: 10 },
  { x0: 1225, x1: 1370, y: 6, sag: 8 },
  { x0: 2180, x1: 2480, y: 5, sag: 9 },
  { x0: 3120, x1: 3330, y: 4, sag: 10 },
  { x0: 3670, x1: 3900, y: 6, sag: 8 },
  { x0: 4190, x1: 4340, y: 5, sag: 9 },
  { x0: 4560, x1: 4750, y: 4, sag: 10 },
];

/** A surface decoration centred at world `x`, `w` px wide. */
export interface SurfaceSpec {
  readonly x: number;
  readonly w: number;
}

/** Marigold petal patches floating just under the surface line. Several cross a chunk edge. */
export const MARIGOLD_PATCHES: readonly SurfaceSpec[] = [
  { x: 390, w: 60 },
  { x: 1300, w: 64 },
  { x: 2212, w: 56 },
  { x: 3292, w: 56 },
  { x: 3850, w: 56 },
];

/** Water hyacinth rafts floating at the surface, roots hanging. Scenery only, never cover. */
export const HYACINTH_RAFTS: readonly SurfaceSpec[] = [
  { x: 500, w: 64 },
  { x: 1816, w: 48 },
  { x: 3720, w: 72 },
  { x: 4250, w: 72 },
];

/**
 * Stretches of stake-and-weave chinampa wall, with their ahuejote root curtains, along the willow
 * banks. A bank chunk paints the wall only where a stretch reaches it, and only inside the bank's
 * rounded ends, so a bank over a surface boat or by a moving hazard keeps its willows but no wall.
 */
export const BANK_WALLS: readonly SurfaceSpec[] = [
  { x: 720, w: 232 },
  { x: 3178, w: 116 },
];

/** A sunken trajinera arch standing on the bed at world `x`, leaning by `tilt` radians. */
export interface ArchSpec {
  readonly x: number;
  readonly tilt: number;
}

/** Sunken trajinera arches on the bed, a screen or more from the sunken hull cave. One crosses a chunk edge. */
export const SUNKEN_ARCHES: readonly ArchSpec[] = [
  { x: 620, tilt: -0.08 },
  { x: 1440, tilt: 0.06 },
  { x: 2180, tilt: -0.05 },
  { x: 2770, tilt: 0.04 },
  { x: 3560, tilt: 0.09 },
];

// ---------------------------------------------------------------------------
// Chunk
// ---------------------------------------------------------------------------

/** What the golden painters need of one background chunk. */
export interface GoldenChunk {
  /** Chunk index along the world: its left edge is at world x `index * VIEW_W`. */
  readonly index: number;
  /** The chunk holds the surface and the sky ('single' and 'top' rows). */
  readonly hasSky: boolean;
  /** The chunk holds the bed ('single' and 'bottom' rows). */
  readonly hasBed: boolean;
  /** The chunk carries a willow bank (top row only), and which of its ends are rounded off. */
  readonly bank: { readonly capLeft: boolean; readonly capRight: boolean } | null;
  /** First and last chunk of its row: the edge chinampa walls go there. */
  readonly edgeLeft: boolean;
  readonly edgeRight: boolean;
  /** This chunk's bed edge y at a local x. */
  readonly bedEdge: (x: number) => number;
}

/** True when the world span [x0, x1] reaches into the chunk whose left edge is at world `wx0`. */
function spanReachesChunk(x0: number, x1: number, wx0: number): boolean {
  return x1 >= wx0 && x0 <= wx0 + VIEW_W;
}

/**
 * Paint the golden-hour decorations of one chunk. A row with the sky gets the banners, the marigold
 * patches, the hyacinth rafts and, on a bank chunk, each bank wall stretch (BANK_WALLS) that reaches
 * it, with its root curtains; a row with the bed gets the sunken arches. The first and last chunks
 * of a row with the sky or the bed get an edge chinampa wall. A middle row paints nothing: its one
 * flat chunk is shared by every column.
 */
export function paintGoldenDecor(ctx: CanvasRenderingContext2D, chunk: GoldenChunk): void {
  if (!chunk.hasSky && !chunk.hasBed) return;
  const wx0 = chunk.index * VIEW_W;
  if (chunk.hasSky) {
    for (const banner of PAPEL_PICADO_BANNERS) {
      if (spanReachesChunk(banner.x0 - 8, banner.x1 + 8, wx0)) paintBanner(ctx, banner, wx0);
    }
    for (const raft of HYACINTH_RAFTS) {
      if (spanReachesChunk(raft.x - raft.w / 2 - 12, raft.x + raft.w / 2 + 12, wx0)) paintHyacinthRaft(ctx, raft, wx0);
    }
    for (const patch of MARIGOLD_PATCHES) {
      if (spanReachesChunk(patch.x - patch.w / 2 - 8, patch.x + patch.w / 2 + 8, wx0)) paintMarigoldPatch(ctx, patch, wx0);
    }
    if (chunk.bank !== null) {
      for (const wall of BANK_WALLS) {
        if (spanReachesChunk(wall.x - wall.w / 2, wall.x + wall.w / 2, wx0)) paintBankWall(ctx, chunk.bank, wall, wx0);
      }
    }
  }
  if (chunk.hasBed) {
    for (const arch of SUNKEN_ARCHES) {
      if (spanReachesChunk(arch.x - ARCH_REACH, arch.x + ARCH_REACH, wx0)) paintSunkenArch(ctx, arch, wx0, chunk.bedEdge);
    }
  }
  const top = chunk.hasSky ? SURF - 8 : -EDGE_WALL_OVERRUN;
  if (chunk.edgeLeft) paintEdgeWall(ctx, 'left', top);
  if (chunk.edgeRight) paintEdgeWall(ctx, 'right', top);
}

// ---------------------------------------------------------------------------
// Papel picado banners
// ---------------------------------------------------------------------------

const FLAG_W = 20;
const FLAG_H = 22;
const FLAG_STEP = 28;
const FLAG_CORNER = 3;
const FLAG_SCALLOPS = 3;
/** Flower cut-out: a round heart and five round petals round it, none touching. */
const CUT_HEART_R = 1.8;
const CUT_PETAL_R = 1.6;
const CUT_RING = 4.6;

/** The y of a banner's string at world x: a parabola, `sag` lower at its middle. */
function bannerStringY(banner: BannerSpec, worldX: number): number {
  const t = (worldX - banner.x0) / (banner.x1 - banner.x0);
  return banner.y + 4 * banner.sag * t * (1 - t);
}

/**
 * One papel picado flag hanging from (x, top): a rounded top, a scalloped bottom edge and round
 * cut-outs (a flower and a row of dots) filled by the even-odd rule, so the sky shows through them.
 */
function flagPath(x: number, top: number): Path2D {
  const l = x - FLAG_W / 2;
  const r = x + FLAG_W / 2;
  const bottom = top + FLAG_H;
  const scallop = FLAG_W / FLAG_SCALLOPS;
  const p = new Path2D();
  p.moveTo(l + FLAG_CORNER, top);
  p.lineTo(r - FLAG_CORNER, top);
  p.quadraticCurveTo(r, top, r, top + FLAG_CORNER);
  p.lineTo(r, bottom);
  for (let i = 0; i < FLAG_SCALLOPS; i++) p.arc(r - scallop * (i + 0.5), bottom, scallop / 2, 0, Math.PI);
  p.lineTo(l, top + FLAG_CORNER);
  p.quadraticCurveTo(l, top, l + FLAG_CORNER, top);
  p.closePath();
  const cy = top + 9;
  ell(p, x, cy, CUT_HEART_R, CUT_HEART_R);
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - Math.PI / 2;
    ell(p, x + Math.cos(a) * CUT_RING, cy + Math.sin(a) * CUT_RING, CUT_PETAL_R, CUT_PETAL_R);
  }
  for (const dx of [-5.5, 0, 5.5]) ell(p, x + dx, bottom - 2.5, 1.2, 1.2);
  return p;
}

/** Paint a banner: its string with a round knot at each end, and its flags in turn of colour. */
function paintBanner(ctx: CanvasRenderingContext2D, banner: BannerSpec, wx0: number): void {
  const string = new Path2D();
  const midX = (banner.x0 + banner.x1) / 2;
  string.moveTo(banner.x0 - wx0, banner.y);
  string.quadraticCurveTo(midX - wx0, banner.y + 2 * banner.sag, banner.x1 - wx0, banner.y);
  inkMany(ctx, [seg(string, 1.6, BANNER_STRING, 1)]);
  const knots = new Path2D();
  ell(knots, banner.x0 - wx0, banner.y, 2.4, 2.4);
  ell(knots, banner.x1 - wx0, banner.y, 2.4, 2.4);
  shape(ctx, knots, BANNER_STRING, DECOR_LW);

  const count = Math.floor((banner.x1 - banner.x0 - FLAG_W) / FLAG_STEP);
  const first = midX - ((count - 1) * FLAG_STEP) / 2;
  for (let i = 0; i < count; i++) {
    const worldX = first + i * FLAG_STEP;
    const flag = flagPath(worldX - wx0, bannerStringY(banner, worldX) - 1);
    ctx.fillStyle = PAPEL_PICADO_COLOURS[i % PAPEL_PICADO_COLOURS.length];
    ctx.fill(flag, 'evenodd');
    ctx.lineWidth = DECOR_LW;
    ctx.strokeStyle = BANNER_STRING;
    ctx.stroke(flag);
  }
}

// ---------------------------------------------------------------------------
// Marigold petal patches and the sinking petal
// ---------------------------------------------------------------------------

const PETAL_RX = 4.2;
const PETAL_RY = 2.6;
/** Petal centres sit this far under SURF: just under the surface line. */
const PATCH_Y = SURF + 6;

/**
 * Paint a patch of marigold petals floating just under the surface: round petals merged into one
 * soft, thinly inked raft, every third petal lighter, and a few marigold hearts. Under the haze.
 */
function paintMarigoldPatch(ctx: CanvasRenderingContext2D, patch: SurfaceSpec, wx0: number): void {
  const count = Math.max(4, Math.round(patch.w / 6));
  const left = patch.x - patch.w / 2 - wx0;
  const silhouette = new Path2D();
  const light = new Path2D();
  const hearts = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = left + ((i + 0.5) * patch.w) / count + (((i * 37) % 5) - 2) * 0.6;
    const y = PATCH_Y + ((i * 13) % 3) * 1.4 - 1.4;
    const rot = (((i * 7) % 5) - 2) * 0.25;
    ell(silhouette, x, y, PETAL_RX, PETAL_RY, rot);
    if (i % 3 === 1) ell(light, x, y, PETAL_RX - 1.4, PETAL_RY - 1, rot);
    if (i % 4 === 2) ell(hearts, x, y - 0.4, 1.3, 1.3);
  }
  blob(ctx, silhouette, MARIGOLD_PETAL, DECOR_LW);
  ctx.fillStyle = MARIGOLD_PETAL_LIGHT;
  ctx.fill(light);
  ctx.fillStyle = MARIGOLD_CENTRE;
  ctx.fill(hearts);
}

/** The sinking petal's radii: a round petal, a little wider than tall. */
const SINKING_PETAL_RX = 4.6;
const SINKING_PETAL_RY = 3;
/** Texture frame of the sinking petal, centred: the spec for a later on-demand sprite bake (no texture is baked here). */
export const SINKING_PETAL_TEX: TexSize = frameFromBounds(
  -SINKING_PETAL_RX - DECOR_LW,
  -SINKING_PETAL_RX - DECOR_LW,
  SINKING_PETAL_RX + DECOR_LW,
  SINKING_PETAL_RX + DECOR_LW,
  4,
);

/** Paint one marigold petal centred at the origin: a round, thinly inked petal and a lighter fold line. */
export function paintSinkingPetal(ctx: CanvasRenderingContext2D): void {
  const petal = new Path2D();
  ell(petal, 0, 0, SINKING_PETAL_RX, SINKING_PETAL_RY, -0.3);
  shape(ctx, petal, MARIGOLD_PETAL, DECOR_LW);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = MARIGOLD_PETAL_LIGHT;
  ctx.stroke(line(-2.4, 0.6, 2.2, -0.6));
}

// ---------------------------------------------------------------------------
// Water hyacinth rafts
// ---------------------------------------------------------------------------

const RAFT_LEAF_RX = 8;
const RAFT_LEAF_RY = 6;
const RAFT_FLOWER_RING = 2.8;
const RAFT_FLOWER_PETAL = 2;

/** Paint a raft's hanging roots: thin wavy strands under it, behind its leaves. */
function paintRaftRoots(ctx: CanvasRenderingContext2D, left: number, w: number): void {
  const segs: Seg[] = [];
  const strands = Math.round(w / 10);
  for (let i = 0; i < strands; i++) {
    const x = left + ((i + 0.5) * w) / strands;
    const len = 22 + ((i * 11) % 4) * 6;
    const p = new Path2D();
    p.moveTo(x, SURF + 6);
    p.quadraticCurveTo(x + (i % 2 === 0 ? 4 : -4), SURF + 6 + len * 0.5, x + (i % 2 === 0 ? -1 : 1), SURF + 6 + len);
    segs.push(seg(p, 1.6, ROOT_BROWN, 0.9));
  }
  inkMany(ctx, segs);
}

/**
 * Paint a water hyacinth raft at the surface, seen from the side: hanging roots, a row of round
 * leaves on the water line merged into one inked clump with a few lighter glossy leaves, and a few
 * lilac flowers standing just above it. Small and thin, so it never reads as the chinampa's
 * blocking hyacinth mat.
 */
function paintHyacinthRaft(ctx: CanvasRenderingContext2D, raft: SurfaceSpec, wx0: number): void {
  const left = raft.x - raft.w / 2 - wx0;
  paintRaftRoots(ctx, left, raft.w);
  const count = Math.max(3, Math.round(raft.w / 12));
  const clump = new Path2D();
  const gloss = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = left + ((i + 0.5) * raft.w) / count;
    const y = SURF + 2 - (i % 2) * 2;
    ell(clump, x, y, RAFT_LEAF_RX, RAFT_LEAF_RY);
    if (i % 2 === 0) ell(gloss, x - 1.5, y - 1.2, RAFT_LEAF_RX - 3.5, RAFT_LEAF_RY - 3);
  }
  blob(ctx, clump, RAFT_LEAF, DECOR_LW);
  ctx.fillStyle = RAFT_LEAF_LIGHT;
  ctx.fill(gloss);

  const petals = new Path2D();
  const centres = new Path2D();
  for (const share of [0.25, 0.55, 0.8]) {
    const cx = left + share * raft.w;
    const cy = SURF - 7;
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 - Math.PI / 2;
      ell(petals, cx + Math.cos(a) * RAFT_FLOWER_RING, cy + Math.sin(a) * RAFT_FLOWER_RING, RAFT_FLOWER_PETAL, RAFT_FLOWER_PETAL);
    }
    ell(centres, cx, cy, 1.4, 1.4);
  }
  blob(ctx, petals, RAFT_FLOWER, DECOR_LW);
  ctx.fillStyle = RAFT_FLOWER_CENTRE;
  ctx.fill(centres);
}

// ---------------------------------------------------------------------------
// Chinampa walls and ahuejote root curtains
// ---------------------------------------------------------------------------

/** Bank wall stakes stand on a world-x grid this many px apart, so neighbouring bank chunks join. */
const BANK_STAKE_STEP = 14;
const BANK_WALL_TOP = 66;
const BANK_WALL_BOTTOM = 102;
const BANK_WEAVE_YS: readonly number[] = [76, 90];
/** A rounded bank end (bankCapLeft or bankCapRight) starts at most this far in; the wall stays inside it. */
const BANK_CAP_INSET = 124;
/** An open bank end runs past the chunk edge, so its ends hide in the neighbour chunk. */
const BANK_OVERRUN = 20;
/** Every this many stakes, a curtain of ahuejote roots hangs under the wall. */
const CURTAIN_EVERY = 5;

/** A woven withy across one stake gap [x0, x1] at y, waving with world x so it continues across chunk seams. */
function weavePath(x0: number, x1: number, y: number, wx0: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0, y + 1.4 * Math.sin((wx0 + x0) * 0.2));
  for (let x = x0 + 7; x <= x1; x += 7) p.lineTo(x, y + 1.4 * Math.sin((wx0 + x) * 0.2));
  return p;
}

/** One ahuejote root curtain under a bank stake: three thin wavy roots. */
function curtainSegs(x: number, k: number): Seg[] {
  const segs: Seg[] = [];
  for (const dx of [-4, 0, 4]) {
    const len = 30 + ((k * 7 + dx) % 4 === 0 ? 14 : 4) + Math.abs(dx) * 2;
    const p = new Path2D();
    p.moveTo(x + dx, BANK_WALL_BOTTOM - 4);
    p.quadraticCurveTo(x + dx + 5, BANK_WALL_BOTTOM + len * 0.5, x + dx - 2, BANK_WALL_BOTTOM + len);
    segs.push(seg(p, 1.6, ROOT_BROWN, 0.9));
  }
  return segs;
}

/**
 * Paint one stretch of stake-and-weave chinampa wall (`wall`, in world x) along a willow bank,
 * across the water line, and the ahuejote root curtains hanging under it. A rounded bank end stops
 * the wall inside it. The backing and the withies are painted stake gap by stake gap on the world-x
 * stake grid, so the gaps that cross a chunk edge are painted the same in both chunks.
 */
function paintBankWall(
  ctx: CanvasRenderingContext2D,
  bank: { readonly capLeft: boolean; readonly capRight: boolean },
  wall: SurfaceSpec,
  wx0: number,
): void {
  const x0 = Math.max(bank.capLeft ? BANK_CAP_INSET : -BANK_OVERRUN, wall.x - wall.w / 2 - wx0);
  const x1 = Math.min(bank.capRight ? VIEW_W - BANK_CAP_INSET : VIEW_W + BANK_OVERRUN, wall.x + wall.w / 2 - wx0);
  const firstK = Math.ceil((wx0 + x0) / BANK_STAKE_STEP);
  const lastK = Math.floor((wx0 + x1) / BANK_STAKE_STEP);
  const curtains: Seg[] = [];
  const stakes: Seg[] = [];
  const withies: Seg[] = [];
  ctx.fillStyle = WALL_BACK;
  for (let k = firstK; k <= lastK; k++) {
    const x = k * BANK_STAKE_STEP - wx0;
    if (k % CURTAIN_EVERY === 2) curtains.push(...curtainSegs(x, k));
    stakes.push(seg(line(x, BANK_WALL_TOP, x, BANK_WALL_BOTTOM), 4.4, WALL_STAKE, 1.2));
    if (k === lastK) continue;
    ctx.fillRect(x, BANK_WALL_TOP + 4, BANK_STAKE_STEP, BANK_WALL_BOTTOM - BANK_WALL_TOP - 8);
    for (const y of BANK_WEAVE_YS) withies.push(seg(weavePath(x, x + BANK_STAKE_STEP, y, wx0), 4, WALL_WEAVE, 1.2));
  }
  inkMany(ctx, curtains);
  inkMany(ctx, stakes);
  inkMany(ctx, withies);
}

/** Edge chinampa wall: its width from the area edge, its stakes, and its overrun past the chunk's top and bottom. */
export const EDGE_WALL_W = 28;
const EDGE_STAKES: readonly number[] = [4, 13, 22];
const EDGE_WALL_OVERRUN = 12;
/** Withies across the edge wall every this many px of y; VIEW_H is a whole number of them, so the rows join. */
export const EDGE_WEAVE_STEP = 24;

/**
 * Paint a stake-and-weave chinampa wall up the area's left or right edge, from `top` (just above the
 * surface on a sky row, past the chunk's top otherwise) to past the chunk's bottom, so a wall in two
 * rows meets itself at the row line. Its withies sit on a y grid that VIEW_H is a multiple of.
 */
function paintEdgeWall(ctx: CanvasRenderingContext2D, side: 'left' | 'right', top: number): void {
  const toX = (x: number): number => (side === 'left' ? x : VIEW_W - x);
  const bottom = VIEW_H + EDGE_WALL_OVERRUN;
  const backTop = top + 6;
  ctx.fillStyle = WALL_BACK;
  const backW = EDGE_STAKES[EDGE_STAKES.length - 1] + EDGE_WALL_OVERRUN;
  ctx.fillRect(side === 'left' ? -EDGE_WALL_OVERRUN : VIEW_W - backW + EDGE_WALL_OVERRUN, backTop, backW, bottom - backTop);
  inkMany(
    ctx,
    EDGE_STAKES.map((x) => seg(line(toX(x), top, toX(x), bottom), 6, WALL_STAKE, 1.4)),
  );
  const withies: Seg[] = [];
  for (let y = Math.max(0, Math.ceil((backTop + 4) / EDGE_WEAVE_STEP) * EDGE_WEAVE_STEP); y <= bottom; y += EDGE_WEAVE_STEP) {
    const p = new Path2D();
    p.moveTo(toX(-EDGE_WALL_OVERRUN), y);
    p.quadraticCurveTo(toX(EDGE_WALL_W / 2), y + 3, toX(EDGE_WALL_W + 2), y);
    withies.push(seg(p, 4, WALL_WEAVE, 1.2));
  }
  inkMany(ctx, withies);
}

// ---------------------------------------------------------------------------
// Sunken trajinera arches
// ---------------------------------------------------------------------------

const ARCH_HALF_W = 46;
const ARCH_POST_TOP = -62;
const ARCH_APEX_CONTROL = -102;
const ARCH_WOOD_W = 8;
const BOARD = { cy: -74, halfW: 25, halfH: 9, r: 5 } as const;
const ARCH_MOTIFS: readonly number[] = [-15, 0, 15];
/** How far an arch reaches either side of its world x, ink and silt included. */
const ARCH_REACH = ARCH_HALF_W + 20;

/** A point of an arch, given in its own frame (base centre at the origin), placed on the chunk. */
type ArchPlacer = (x: number, y: number) => readonly [number, number];

/** A piece of the arch's wood from `from` to `to` in the arch's frame: straight, or curved through the control point `via`. */
function archWoodPath(
  place: ArchPlacer,
  from: readonly [number, number],
  to: readonly [number, number],
  via?: readonly [number, number],
): Path2D {
  const p = new Path2D();
  const [ax, ay] = place(from[0], from[1]);
  p.moveTo(ax, ay);
  const [bx, by] = place(to[0], to[1]);
  if (via === undefined) {
    p.lineTo(bx, by);
  } else {
    const [cx, cy] = place(via[0], via[1]);
    p.quadraticCurveTo(cx, cy, bx, by);
  }
  return p;
}

/** The arch's name-board: a rounded rectangle in the arch's frame, corners rounded by quadratic curves. */
function archBoardPath(place: ArchPlacer): Path2D {
  const { cy, halfW, halfH, r } = BOARD;
  const pts: readonly (readonly [number, number])[] = [
    [-halfW + r, cy - halfH],
    [halfW - r, cy - halfH],
    [halfW, cy - halfH],
    [halfW, cy - halfH + r],
    [halfW, cy + halfH - r],
    [halfW, cy + halfH],
    [halfW - r, cy + halfH],
    [-halfW + r, cy + halfH],
    [-halfW, cy + halfH],
    [-halfW, cy + halfH - r],
    [-halfW, cy - halfH + r],
    [-halfW, cy - halfH],
  ];
  const p = new Path2D();
  const at = pts.map(([x, y]) => place(x, y));
  p.moveTo(at[0][0], at[0][1]);
  for (let i = 1; i < at.length; i += 3) {
    p.lineTo(at[i][0], at[i][1]);
    const corner = at[i + 1];
    const end = at[(i + 2) % at.length];
    p.quadraticCurveTo(corner[0], corner[1], end[0], end[1]);
  }
  p.closePath();
  return p;
}

/** The marigold motifs painted on the name-board: three round six-petal flowers. No letters. */
function paintArchMotifs(ctx: CanvasRenderingContext2D, place: ArchPlacer, tilt: number): void {
  const petals = new Path2D();
  const hearts = new Path2D();
  for (const mx of ARCH_MOTIFS) {
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6;
      const [px, py] = place(mx + Math.cos(a) * 3.4, BOARD.cy + Math.sin(a) * 3.4);
      ell(petals, px, py, 2.4, 1.8, a + tilt);
    }
    const [hx, hy] = place(mx, BOARD.cy);
    ell(hearts, hx, hy, 1.6, 1.6);
  }
  shape(ctx, petals, MARIGOLD_PETAL, 1);
  ctx.fillStyle = MARIGOLD_CENTRE;
  ctx.fill(hearts);
}

/**
 * Paint a sunken trajinera arch standing on the bed: two posts and a curved beam of old wood, a
 * name-board painted with marigolds (no letters), algae on the posts and silt heaped over its feet.
 * It is a frame with water showing through, never a dark opening, so it never reads as a hiding place.
 */
function paintSunkenArch(ctx: CanvasRenderingContext2D, arch: ArchSpec, wx0: number, bedEdge: (x: number) => number): void {
  const baseX = arch.x - wx0;
  const baseY = bedEdge(baseX) + 4;
  const cos = Math.cos(arch.tilt);
  const sin = Math.sin(arch.tilt);
  const place: ArchPlacer = (x, y) => [baseX + x * cos - y * sin, baseY + x * sin + y * cos];
  inkMany(ctx, [
    seg(archWoodPath(place, [-ARCH_HALF_W, 0], [-ARCH_HALF_W + 4, ARCH_POST_TOP]), ARCH_WOOD_W, ARCH_WOOD, LW * 0.6),
    seg(archWoodPath(place, [ARCH_HALF_W, 0], [ARCH_HALF_W - 4, ARCH_POST_TOP]), ARCH_WOOD_W, ARCH_WOOD, LW * 0.6),
    seg(
      archWoodPath(place, [-ARCH_HALF_W + 4, ARCH_POST_TOP], [ARCH_HALF_W - 4, ARCH_POST_TOP], [0, ARCH_APEX_CONTROL]),
      ARCH_WOOD_W,
      ARCH_WOOD,
      LW * 0.6,
    ),
  ]);
  shape(ctx, archBoardPath(place), ARCH_BOARD, DECOR_LW);
  paintArchMotifs(ctx, place, arch.tilt);

  const algae = new Path2D();
  for (const [x, y] of [
    [-ARCH_HALF_W + 1, -14],
    [ARCH_HALF_W - 2, -24],
  ] as const) {
    const [ax, ay] = place(x, y);
    ell(algae, ax, ay, 3, 5, arch.tilt);
  }
  ctx.fillStyle = RAFT_LEAF;
  ctx.fill(algae);

  const silt = new Path2D();
  for (const x of [-ARCH_HALF_W, ARCH_HALF_W]) {
    const [sx, sy] = place(x, 0);
    ell(silt, sx, sy + 1, 12, 4.5);
  }
  ctx.fillStyle = ARCH_SILT;
  ctx.fill(silt);
}

// ---------------------------------------------------------------------------
// Lit lower row
// ---------------------------------------------------------------------------

/** Light shafts stand on a world-x grid, so a shaft crossing a chunk edge is painted in both chunks. */
export const LIT_SHAFT_SPACING = 300;
const LIT_SHAFT_X0 = 140;
const LIT_SHAFT_W = 36;
/** The shafts' brightest alpha, at LIT_SHAFT_PEAK of the chunk's height; clear at the chunk's top edge. */
const LIT_SHAFT_ALPHA = 0.1;
const LIT_SHAFT_PEAK = 0.5;
/** The bed glow: clear at LIT_GLOW_TOP, brightest at the bed line, fading toward the chunk bottom. */
const LIT_GLOW_TOP = 240;
const LIT_GLOW_ALPHA = 0.16;
const LIT_GLOW_BED_Y = 322;
/** The rays run from the water top (SURF + 3) to RAY_END_Y; the lower row's shafts keep their slope. */
const RAY_DEPTH = RAY_END_Y - (SURF + 3);

/** The golden light at `alpha`, as a CSS colour. */
function goldenLight(alpha: number): string {
  const [r, g, b] = GOLDEN_LIGHT_RGB;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/**
 * Light a bottom-row chunk: slanted golden light shafts carrying on the rays' slope (`raySlant` px
 * of run over the rays' depth), and a warm glow over the bed. Both are painted with the screen blend,
 * so they only ever lighten, and both are clear at the chunk's top edge (y 0), so the row above
 * meets this one with no seam. The shafts sit on a world-x grid and the glow is even across x, so
 * neighbouring chunks join.
 */
export function paintLitLowerRow(ctx: CanvasRenderingContext2D, index: number, raySlant: number): void {
  const wx0 = index * VIEW_W;
  const run = (raySlant / RAY_DEPTH) * VIEW_H;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const shaft = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  shaft.addColorStop(0, goldenLight(0));
  shaft.addColorStop(LIT_SHAFT_PEAK, goldenLight(LIT_SHAFT_ALPHA));
  shaft.addColorStop(1, goldenLight(LIT_SHAFT_ALPHA * 0.3));
  ctx.fillStyle = shaft;
  const firstK = Math.floor((wx0 - LIT_SHAFT_W - LIT_SHAFT_X0) / LIT_SHAFT_SPACING);
  const lastK = Math.ceil((wx0 + VIEW_W + run - LIT_SHAFT_X0) / LIT_SHAFT_SPACING);
  for (let k = firstK; k <= lastK; k++) {
    const x = LIT_SHAFT_X0 + k * LIT_SHAFT_SPACING - wx0;
    if (x + LIT_SHAFT_W < 0 || x - run > VIEW_W) continue;
    const p = new Path2D();
    p.moveTo(x, 0);
    p.lineTo(x + LIT_SHAFT_W, 0);
    p.lineTo(x + LIT_SHAFT_W - run, VIEW_H);
    p.lineTo(x - run, VIEW_H);
    p.closePath();
    ctx.fill(p);
  }
  const glow = ctx.createLinearGradient(0, LIT_GLOW_TOP, 0, VIEW_H);
  glow.addColorStop(0, goldenLight(0));
  glow.addColorStop((LIT_GLOW_BED_Y - LIT_GLOW_TOP) / (VIEW_H - LIT_GLOW_TOP), goldenLight(LIT_GLOW_ALPHA));
  glow.addColorStop(1, goldenLight(LIT_GLOW_ALPHA * 0.4));
  ctx.fillStyle = glow;
  ctx.fillRect(0, LIT_GLOW_TOP, VIEW_W, VIEW_H - LIT_GLOW_TOP);
  ctx.restore();
}
