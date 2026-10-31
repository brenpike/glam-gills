/**
 * Deep canal props (issue #78, STEP-006; guide 3g, 7 and 10): the gliding trajinera hull and its
 * leading shadow, the moored hulls that cover the Common and Rare spots and hang over the banks,
 * the sunken old trajinera hull cave (back and front), the old canal-bed stones, and the side-canal
 * inflow marks.
 *
 * Every value is derived (provisional). Presentational only: no Phaser, no game state, no
 * randomness. The painters take an explicit context and draw at logical scale; the bakes belong to
 * the deep canal's texture module. Every painter is a still frame, so each one is also its
 * reduced-motion version: the scene glides, bobs, fades or snaps the sprites, never the painters.
 * Under reduced motion the boats still glide (it is gameplay) but never bob.
 *
 * Boats only (ND-8): no people, no faces, no text, no fishing line and no lure. The gliding and
 * moored hulls reuse the punting pole bow's boat colours (drawPuntingPole.ts), so one boat reads as
 * one boat across the game.
 *
 * Sizes come from the logic: the gliding hull and its shadow are TRAJINERAS.hullLength wide and
 * TRAJINERAS.hullDepth deep (src/logic/trajineras.ts), so the art is the rect the hull blocks. The
 * hull body is exactly that rect, plus its ink outside it; only the raised prow, the deck rail, the
 * flower arch and the prow ball rise above the water line (y 0), where nothing is blocked.
 *
 * Contrast rule (guide 10, the pair method), the same as the pond, chinampa, canal and spring cave
 * looks keep: every opaque background colour here (the hull cave wood, the old stones and the moored
 * shade at its most solid) has relative luminance 0.1687 or more, so ink #2b2350 is 3:1 or better
 * against it. The deep canal water is held to the same floor by its look, so ink is 3:1 or better
 * against the water the hulls, the shadow and the stones sit in. The boats' cream hull (0.8780) is
 * 12.72:1 with ink. The shadow only darkens a little (alpha 0.5 at most, fading with depth) and its
 * ink outline runs on the water's edge, where the water outside holds the 3:1.
 *
 * Greyscale: every boat and stone is held by an ink outline (ink luminance 0.0229), and each hull
 * has a light cream rail over darker painted bands. The shadow is a dark ring on the water with two
 * dark-white-dark chevrons that point the way the boat glides, so the warning reads with no colour.
 */
import { TRAJINERAS } from '../logic/trajineras';
import { TAU, blob, ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { CAVE_H, CAVE_TEX, CAVE_W } from './drawFinds';
import { BOAT_FLOWER_CENTRE, BOAT_HULL, BOAT_ORANGE, BOAT_PINK, BOAT_TEAL, BOAT_YELLOW, POLE_WOOD } from './drawPuntingPole';
import { OUTFLOW_TEX, paintSpringOutflow } from './drawSpringCave';
import { INK, LW, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/**
 * The moored hulls' shade under the boats: a deep blue-green #22808f (luminance 0.1776, 3.12:1 with
 * ink), so even at its most solid it is over the luminance floor. As [r, g, b].
 */
export const DEEP_CANAL_SHADE_RGB = [34, 128, 143] as const;
/** The gliding boat's shadow: a deep blue (as the punting pole's), see-through. As [r, g, b]. */
export const TRAJINERA_SHADOW_RGB = [12, 38, 78] as const;
/** The shadow's alpha at the water line and at the hull's depth: soft, never darker than 0.5. */
export const TRAJINERA_SHADOW_ALPHA_TOP = 0.5;
export const TRAJINERA_SHADOW_ALPHA_BOTTOM = 0.2;
/** A fainter halo round the shadow, no ink: the soft edge. */
export const TRAJINERA_SHADOW_HALO = 'rgba(12,38,78,0.14)';
/** Thin seams between planks on the new boats. Internal detail lines, never ink. */
export const BOAT_SEAM = 'rgba(43,35,80,0.22)';
/** One soft shine along a hull's rail. */
export const BOAT_SHINE = 'rgba(255,255,255,0.5)';

/** Old hull wood, luminance 0.2751, 4.46:1 with ink. */
export const HULL_CAVE_WOOD = '#a98a63';
/** Lighter old wood, luminance 0.3442, 5.40:1 with ink. */
export const HULL_CAVE_WOOD_LIGHT = '#b79a73';
/** Darker old wood, luminance 0.1790, 3.14:1 with ink: still over the floor. */
export const HULL_CAVE_WOOD_DARK = '#8f7048';
/** Plank seams and cracks on the old hull. Internal detail lines, never ink. */
export const HULL_CAVE_SEAM = 'rgba(52,34,20,0.5)';
/** What is left of the paint on the old hull: a faded pink, orange and teal (luminance 0.3776, 0.4085, 0.4140). */
export const HULL_CAVE_FADED_PINK = '#c79a9f';
export const HULL_CAVE_FADED_ORANGE = '#d9a066';
export const HULL_CAVE_FADED_TEAL = '#79b8ae';
/** Algae on the old hull, luminance 0.2890. Inside the silhouette, so no ink. */
export const HULL_CAVE_ALGAE = '#4fa36a';
/** Shine on the old hull. */
export const HULL_CAVE_SHINE = 'rgba(255,255,255,0.45)';
/** The inside of the hull cave, a cold near-black, far under the wood (luminance 0.0064; 5.77:1 against the wood and 4.06:1 against the dark wood). */
export const HULL_CAVE_INTERIOR = '#06141f';

/** Old canal-bed stone, a weathered grey-green: luminance 0.3067, 4.89:1 with ink. */
export const CANAL_STONE = '#8f9a86';
/** Lighter stone, luminance 0.4410, 6.73:1 with ink. */
export const CANAL_STONE_LIGHT = '#aab59f';
/** Darker stone, luminance 0.2372, 3.94:1 with ink: still over the floor. */
export const CANAL_STONE_DARK = '#7a8a7a';
/** Moss on the stones, luminance 0.2901. Inside the silhouette, so no ink. */
export const CANAL_STONE_MOSS = '#58a35a';
/** Cracks and seams in the stones. Internal detail lines, never ink. */
export const CANAL_STONE_CRACK = 'rgba(52,64,52,0.5)';
/** Shine on the stones. */
export const CANAL_STONE_SHINE = 'rgba(255,255,255,0.5)';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// The gliding hull
// ---------------------------------------------------------------------------

/** The hull's length along the lane and its depth below the water line, px: the rect the hull blocks (TRAJINERAS). */
export const TRAJINERA_HULL_W: number = TRAJINERAS.hullLength;
export const TRAJINERA_HULL_H: number = TRAJINERAS.hullDepth;
const HALF_L = TRAJINERA_HULL_W / 2;
const DEPTH = TRAJINERA_HULL_H;
/** Corner radius of the hull's lower corners. */
const HULL_CORNER = 12;
/** Height of the stern rail above the water line, and of the raised prow tip. */
const STERN_TOP = -8;
const PROW_TIP_Y = -26;
/** The prow tip's run in from the bow edge, px. */
const PROW_RUN = 10;
/** Where the bow edge meets the prow curve, above the water line. */
const PROW_FOOT = -14;

/** The gliding boat's arch, a polyline tube over the deck: feet and control point of a quadratic. */
const GLIDER_ARCH_FROM: readonly [number, number] = [-34, -12];
const GLIDER_ARCH_CONTROL: readonly [number, number] = [0, -86];
const GLIDER_ARCH_TO: readonly [number, number] = [34, -12];
const ARCH_STEPS = 14;
const ARCH_W = 5;
const ARCH_OL = 2.2;
/** The arch's highest point above the water line: the quadratic's apex, y -49. */
const ARCH_APEX = 0.25 * GLIDER_ARCH_FROM[1] + 0.5 * GLIDER_ARCH_CONTROL[1] + 0.25 * GLIDER_ARCH_TO[1];
const FLOWER_AT: readonly number[] = [0.14, 0.3, 0.5, 0.7, 0.86];
const FLOWER_FILLS: readonly string[] = [BOAT_PINK, BOAT_YELLOW, BOAT_ORANGE, BOAT_YELLOW, BOAT_PINK];
const FLOWER_R = 5;
const FLOWER_CENTRE_R = 1.8;
const FLOWER_LW = 2.4;
/** The prow ball at the raised end. */
const PROW_BALL: readonly [number, number, number] = [HALF_L - PROW_RUN - 8, PROW_TIP_Y - 1, 5];
/** The painted bands down the hull: top y, bottom y and colour, clipped to the hull. The cream shows above them. */
const GLIDER_BANDS: readonly (readonly [number, number, string])[] = [
  [8, 19, BOAT_PINK],
  [19, 30, BOAT_ORANGE],
  [30, DEPTH + 8, BOAT_TEAL],
];
/** White dots on the teal band: a row of them across the hull. */
const GLIDER_DOT_Y = 44;
const GLIDER_DOT_R = 2.2;
const GLIDER_DOT_STEP = 11;
/** Width of the ink gunwale line under the cream rail, on the gliding and the moored hulls. */
export const RAIL_LINE_W = 2;

/**
 * The extent of the art above the water line, px: the arch and its flowers, with their ink. The
 * flowers sit 3 px above the arch, so the highest flower top is ARCH_APEX - 3 - FLOWER_R - FLOWER_LW.
 */
const GLIDER_RISE = Math.ceil(-(ARCH_APEX - 3 - FLOWER_R - FLOWER_LW));

/**
 * Texture frame of the gliding hull (provisional): the hull body, TRAJINERA_HULL_W wide and
 * TRAJINERA_HULL_H deep, its ink outside, the raised prow, the rail and the flower arch above the
 * water line, plus 4 px of padding. Anchor is the top-centre of the hull's rect: local (0, 0) is
 * the middle of the hull's length, on the water line (SURF). The prow is at +x; the scene mirrors
 * the sprite for a boat that glides left.
 */
export const TRAJINERA_HULL_TEX: TexSize = frameFromBounds(-HALF_L - LW, -GLIDER_RISE, HALF_L + LW, DEPTH + LW, PAD);

/** A point on the gliding arch's quadratic curve at t (0 to 1). */
function gliderArchPoint(t: number): readonly [number, number] {
  const u = 1 - t;
  return [
    u * u * GLIDER_ARCH_FROM[0] + 2 * u * t * GLIDER_ARCH_CONTROL[0] + t * t * GLIDER_ARCH_TO[0],
    u * u * GLIDER_ARCH_FROM[1] + 2 * u * t * GLIDER_ARCH_CONTROL[1] + t * t * GLIDER_ARCH_TO[1],
  ];
}

/** The arch as a polyline, so its bounds are exact. */
function gliderArchPath(): Path2D {
  const path = new Path2D();
  for (let i = 0; i <= ARCH_STEPS; i++) {
    const [x, y] = gliderArchPoint(i / ARCH_STEPS);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/** The hull: a rounded flat bottom at the hull depth, straight sides, a low stern rail and a raised prow at +x. */
function gliderHullPath(): Path2D {
  const p = new Path2D();
  p.moveTo(-HALF_L, STERN_TOP);
  p.lineTo(-HALF_L, DEPTH - HULL_CORNER);
  p.quadraticCurveTo(-HALF_L, DEPTH, -HALF_L + HULL_CORNER, DEPTH);
  p.lineTo(HALF_L - HULL_CORNER, DEPTH);
  p.quadraticCurveTo(HALF_L, DEPTH, HALF_L, DEPTH - HULL_CORNER);
  p.lineTo(HALF_L, PROW_FOOT);
  p.quadraticCurveTo(HALF_L, PROW_TIP_Y, HALF_L - PROW_RUN, PROW_TIP_Y);
  p.quadraticCurveTo(0, -4, -HALF_L, STERN_TOP);
  p.closePath();
  return p;
}

/**
 * Paint the gliding trajinera hull around its anchor. Layer order, back to front: the flower arch
 * (one inked teal tube), the hull (a BOAT_HULL blob, ink LW all round), the painted bands clipped to
 * the hull (pink, orange, teal), a row of white dots on the teal band, three plank seams, one shine
 * along the rail, the prow ball and five flowers on the arch. No people, no faces, no text.
 */
export function paintTrajineraHull(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(gliderArchPath(), ARCH_W, BOAT_TEAL, ARCH_OL)]);

  const hull = gliderHullPath();
  blob(ctx, hull, BOAT_HULL, LW);

  ctx.save();
  ctx.clip(hull);
  for (const [top, bottom, colour] of GLIDER_BANDS) {
    ctx.fillStyle = colour;
    ctx.fillRect(-HALF_L - 4, top, TRAJINERA_HULL_W + 8, bottom - top);
  }
  ctx.fillStyle = WHITE;
  for (let x = -HALF_L + GLIDER_DOT_STEP; x < HALF_L - GLIDER_DOT_STEP / 2; x += GLIDER_DOT_STEP) {
    const dot = new Path2D();
    ell(dot, x, GLIDER_DOT_Y, GLIDER_DOT_R, GLIDER_DOT_R);
    ctx.fill(dot);
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = BOAT_SEAM;
  for (const x of [-HALF_L * 0.5, 0, HALF_L * 0.5]) ctx.stroke(line(x, 8, x, DEPTH));
  // The gunwale line: a thin ink line under the cream rail, so the rail reads light over dark in greyscale.
  ctx.lineWidth = RAIL_LINE_W;
  ctx.strokeStyle = INK;
  ctx.stroke(line(-HALF_L - 4, GLIDER_BANDS[0][0], HALF_L + 4, GLIDER_BANDS[0][0]));
  ctx.restore();

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = BOAT_SHINE;
  ctx.stroke(line(-HALF_L + 10, 0, -HALF_L * 0.3, -1));

  const ball = new Path2D();
  ell(ball, PROW_BALL[0], PROW_BALL[1], PROW_BALL[2], PROW_BALL[2]);
  blob(ctx, ball, BOAT_ORANGE, FLOWER_LW);

  FLOWER_AT.forEach((t, i) => {
    const [x, y] = gliderArchPoint(t);
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
// The leading shadow
// ---------------------------------------------------------------------------

/** The shadow's footprint is the hull's rect: where the hull will be one `shadowLead` later. */
export const TRAJINERA_SHADOW_W: number = TRAJINERA_HULL_W;
export const TRAJINERA_SHADOW_H: number = TRAJINERA_HULL_H;
/** How far the soft halo reaches past the footprint, px. */
export const TRAJINERA_SHADOW_HALO_PAD = 6;
/** The shadow's ink outline, centred on its edge: the greyscale cue. */
const SHADOW_OUTLINE = 2.4;
/** Corner radius of the footprint. */
const SHADOW_CORNER = 16;
/** Chevrons that point the way the boat glides (+x): a white tube with ink each side. */
const CHEVRON_X: readonly number[] = [-10, 12];
const CHEVRON_HALF_H = 10;
const CHEVRON_RUN = 10;
const CHEVRON_W = 3;
const CHEVRON_OL = 1.4;

/**
 * Texture frame of the shadow (provisional): the footprint with its outline and halo plus 4 px of
 * padding. Anchor is the same as the hull's: the middle of the footprint's length, on the water
 * line, local (0, 0). The shadow leads the hull, so the scene places it where the hull will be; it
 * fades the sprite in over the lead (one-time fades of 0.6 s or longer, guide 9, 10), and mirrors
 * it for a boat that glides left.
 */
export const TRAJINERA_SHADOW_TEX: TexSize = frameFromBounds(
  -HALF_L - TRAJINERA_SHADOW_HALO_PAD,
  -TRAJINERA_SHADOW_HALO_PAD,
  HALF_L + TRAJINERA_SHADOW_HALO_PAD,
  DEPTH + TRAJINERA_SHADOW_HALO_PAD,
  PAD,
);

/** A rounded rect from (x0, y0) to (x1, y1) with corner radius `r`. */
function roundedBox(x0: number, y0: number, x1: number, y1: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r);
  p.quadraticCurveTo(x1, y1, x1 - r, y1);
  p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r);
  p.lineTo(x0, y0 + r);
  p.quadraticCurveTo(x0, y0, x0 + r, y0);
  p.closePath();
  return p;
}

/**
 * Paint the leading shadow around its anchor: a faint halo (no ink), then the footprint as a
 * see-through deep blue that is darkest at the water line and fades with depth, with an opaque ink
 * outline 2.4 wide on its edge, then two white chevrons with ink each side that point +x. The
 * outline and the chevrons are the greyscale cues: the shadow reads as a dark ring with arrows
 * where the fill alone would barely show.
 */
export function paintTrajineraShadow(ctx: CanvasRenderingContext2D): void {
  const pad = TRAJINERA_SHADOW_HALO_PAD;
  ctx.fillStyle = TRAJINERA_SHADOW_HALO;
  ctx.fill(roundedBox(-HALF_L - pad, -pad, HALF_L + pad, DEPTH + pad, SHADOW_CORNER + pad));

  const [r, g, b] = TRAJINERA_SHADOW_RGB;
  const grad = ctx.createLinearGradient(0, 0, 0, DEPTH);
  grad.addColorStop(0, `rgba(${r},${g},${b},${TRAJINERA_SHADOW_ALPHA_TOP})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},${TRAJINERA_SHADOW_ALPHA_BOTTOM})`);
  const footprint = roundedBox(-HALF_L, 0, HALF_L, DEPTH, SHADOW_CORNER);
  ctx.fillStyle = grad;
  ctx.fill(footprint);
  ctx.lineWidth = SHADOW_OUTLINE;
  ctx.strokeStyle = INK;
  ctx.stroke(footprint);

  const mid = DEPTH / 2;
  const chevrons: Seg[] = CHEVRON_X.map((x) => {
    const p = new Path2D();
    p.moveTo(x - CHEVRON_RUN / 2, mid - CHEVRON_HALF_H);
    p.lineTo(x + CHEVRON_RUN / 2, mid);
    p.lineTo(x - CHEVRON_RUN / 2, mid + CHEVRON_HALF_H);
    return seg(p, CHEVRON_W, WHITE, CHEVRON_OL);
  });
  inkMany(ctx, chevrons);
}

// ---------------------------------------------------------------------------
// Moored hulls: cover over the spots and the bank overhang
// ---------------------------------------------------------------------------

/**
 * The water under a row of moored boats, as a rect of the zone: nominal 440 x 60, stretched to the
 * rect like the bank overhang and the rock ledge. The one texture serves both uses: the cover over
 * the Common and Rare spots, and the overhang on a bank.
 */
export const MOORED_W = 440;
export const MOORED_H = 60;
/** Texture frame of the moored hulls. Anchor is the top-left corner of the rect, like the chinampa overhang. */
export const MOORED_TEX: TexSize = frameFromBounds(0, 0, MOORED_W, MOORED_H, PAD);
/** The shade under the boats, [y as a fraction of the height, alpha]: nearly solid over the spots, fading to nothing at the bottom. */
export const MOORED_SHADE_STOPS: readonly (readonly [number, number])[] = [
  [0, 0.9],
  [0.8, 0.8],
  [1, 0],
];
/** How deep a moored hull hangs below the water line, px: above the spots, which sit about 30 down. */
export const MOORED_HULL_DEPTH = 26;
/** Width of a moored hull's lower corner curve. */
const MOORED_CORNER = 16;
const MOORED_LW = LW * 0.8;

interface MooredHull {
  /** Left end, px from the rect's left. */
  readonly x0: number;
  readonly w: number;
  /** The three painted bands, top to bottom. */
  readonly bands: readonly [string, string, string];
}

/**
 * Three hulls side by side, in drawing order, with 14 px between them, each with its own order of
 * the three paint colours so they do not read as one. All inside the rect (x 8 to 432).
 */
export const MOORED_HULLS: readonly MooredHull[] = [
  { x0: 8, w: 132, bands: [BOAT_PINK, BOAT_ORANGE, BOAT_TEAL] },
  { x0: 154, w: 132, bands: [BOAT_TEAL, BOAT_PINK, BOAT_ORANGE] },
  { x0: 300, w: 132, bands: [BOAT_ORANGE, BOAT_TEAL, BOAT_PINK] },
];
/** Band edges down a moored hull, px below the water line. The cream rail shows above the first. */
const MOORED_BAND_EDGES: readonly [number, number, number, number] = [9, 15, 21, MOORED_HULL_DEPTH + 4];

/** The shade's outline: flat along the waterline, its sides sloping in toward the bottom. */
function mooredShadePath(): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.lineTo(MOORED_W, 0);
  p.quadraticCurveTo(MOORED_W - 2, 34, MOORED_W - 26, MOORED_H);
  p.lineTo(26, MOORED_H);
  p.quadraticCurveTo(2, 34, 0, 0);
  p.closePath();
  return p;
}

/** A moored hull hanging from the water line: flat on top, a rounded flat bottom. Open it is the inked edge; closed along the water line it is the fill. */
function mooredHullPath(hull: MooredHull, closed: boolean): Path2D {
  const { x0, w } = hull;
  const x1 = x0 + w;
  const p = new Path2D();
  p.moveTo(x1, 0);
  p.quadraticCurveTo(x1 - 1, MOORED_HULL_DEPTH - MOORED_CORNER * 0.4, x1 - MOORED_CORNER, MOORED_HULL_DEPTH);
  p.lineTo(x0 + MOORED_CORNER, MOORED_HULL_DEPTH);
  p.quadraticCurveTo(x0 + 1, MOORED_HULL_DEPTH - MOORED_CORNER * 0.4, x0, 0);
  if (closed) p.closePath();
  return p;
}

/** Mooring ropes between neighbouring hulls: a short tan tube a hull to the next, at 5 px below the water line. */
function mooringRopes(): Seg[] {
  const ropes: Seg[] = [];
  for (let i = 0; i + 1 < MOORED_HULLS.length; i++) {
    const a = MOORED_HULLS[i];
    const b = MOORED_HULLS[i + 1];
    const p = new Path2D();
    p.moveTo(a.x0 + a.w - 4, 5);
    p.quadraticCurveTo((a.x0 + a.w + b.x0) / 2, 11, b.x0 + 4, 5);
    ropes.push(seg(p, 3, POLE_WOOD, 1.6));
  }
  return ropes;
}

/**
 * Paint the moored hulls with the rect's top-left at local (0, 0), the water line: a blue-green
 * shade over the water that hides what is under the boats (guide 7e, cover), the mooring ropes, and
 * three brightly painted hulls hanging from the water line, each a cream rail over three painted
 * bands, with plank seams, a shine and a prow ball. The hulls are filled to the water line and inked
 * along their lower edge and both ends, so no dark line crosses the surface above them. Drawn above
 * hidden treasures and under the haze, so it is scenery and no cue object.
 */
export function paintMooredHulls(ctx: CanvasRenderingContext2D): void {
  const [r, g, b] = DEEP_CANAL_SHADE_RGB;
  const grad = ctx.createLinearGradient(0, 0, 0, MOORED_H);
  for (const [t, a] of MOORED_SHADE_STOPS) grad.addColorStop(t, `rgba(${r},${g},${b},${a})`);
  ctx.fillStyle = grad;
  ctx.fill(mooredShadePath());

  inkMany(ctx, mooringRopes());

  for (const hull of MOORED_HULLS) {
    const fill = mooredHullPath(hull, true);
    ctx.fillStyle = BOAT_HULL;
    ctx.fill(fill);

    ctx.save();
    ctx.clip(fill);
    const [e0, e1, e2, e3] = MOORED_BAND_EDGES;
    const edges = [
      [e0, e1],
      [e1, e2],
      [e2, e3],
    ] as const;
    edges.forEach(([top, bottom], i) => {
      ctx.fillStyle = hull.bands[i];
      ctx.fillRect(hull.x0 - 2, top, hull.w + 4, bottom - top);
    });
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = BOAT_SEAM;
    for (const f of [0.25, 0.5, 0.75]) ctx.stroke(line(hull.x0 + hull.w * f, e0, hull.x0 + hull.w * f, MOORED_HULL_DEPTH));
    // The gunwale line: a thin ink line under the cream rail, so the rail reads light over dark in greyscale.
    ctx.lineWidth = RAIL_LINE_W;
    ctx.strokeStyle = INK;
    ctx.stroke(line(hull.x0 - 2, e0, hull.x0 + hull.w + 2, e0));
    ctx.restore();

    ctx.lineWidth = MOORED_LW;
    ctx.strokeStyle = INK;
    ctx.stroke(mooredHullPath(hull, false));

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = BOAT_SHINE;
    ctx.stroke(line(hull.x0 + 16, 3, hull.x0 + 44, 3));

    const ball = new Path2D();
    ell(ball, hull.x0 + hull.w - 5, 7, 3.6, 3.6);
    shape(ctx, ball, BOAT_ORANGE, 1.8);
  }
}

// ---------------------------------------------------------------------------
// Sunken old trajinera hull cave
// ---------------------------------------------------------------------------

/** Outer size to the ink edge, the same as the cave's, so both bake and place alike (drawFinds CAVE_W x CAVE_H). */
export const HULL_CAVE_W = CAVE_W;
export const HULL_CAVE_H = CAVE_H;
/** Texture frame shared by the hull cave back and front. Anchor is the base centre, on the bed. */
export const HULL_CAVE_TEX: TexSize = CAVE_TEX;
/** The opening: half width, and the centre height of its round top (the top is a half circle on it). */
export const HULL_CAVE_OPENING = { halfW: 50, rise: 46 } as const;
/** How much bigger the back is than the gap in the front, px, so the front's ink covers its edge. */
const HULL_CAVE_BACK_GROW = 2;
const HULL_CAVE_LW = 3.5;
/** The hull's keel (the flat top of the upturned boat), its height and half width, and the half width of its base. */
export const HULL_CAVE_BODY = { keelY: -124, keelHalfW: 46, shoulderY: -114, shoulderHalfW: 62, baseHalfW: 88 } as const;
/** Faded paint bands across the old hull: [top y, bottom y, colour]. */
const HULL_CAVE_BANDS: readonly (readonly [number, number, string])[] = [
  [-92, -84, HULL_CAVE_FADED_PINK],
  [-84, -76, HULL_CAVE_FADED_ORANGE],
  [-76, -62, HULL_CAVE_FADED_TEAL],
];
/** Plank seams across the hull, the y of each. */
const HULL_CAVE_SEAMS: readonly number[] = [-18, -36, -54, -72, -92, -108];
/** Algae patches on the hull: [x, y, rx, ry]. */
const HULL_CAVE_ALGAE_PATCHES: readonly (readonly [number, number, number, number])[] = [
  [-74, -14, 12, 5],
  [-64, -104, 10, 4.4],
  [74, -20, 12, 5.2],
  [44, -118, 9, 3.6],
];
/** Low stones at the hull's feet, so it sits sunk in the bed: [x, y, rx, ry, fill]. */
const HULL_CAVE_FEET: readonly (readonly [number, number, number, number, string])[] = [
  [-72, -7, 15, 7, CANAL_STONE_DARK],
  [73, -7, 15, 7, CANAL_STONE],
];

/**
 * The upturned hull's outline as one path: the flared left side up to the rounded keel and down the
 * right side, then the opening cut out of it as a second sub-path. Left open along the bed so the
 * base is never inked; fills with the even-odd rule so the opening is a hole. The sides flare from
 * the keel's width to the base, as a flat-bottomed boat's do.
 */
function hullCaveBodyPath(): Path2D {
  const { keelY, keelHalfW, shoulderY, shoulderHalfW, baseHalfW } = HULL_CAVE_BODY;
  const { halfW, rise } = HULL_CAVE_OPENING;
  const p = new Path2D();
  p.moveTo(-baseHalfW, 0);
  p.quadraticCurveTo(-baseHalfW + 8, -70, -shoulderHalfW, shoulderY);
  p.quadraticCurveTo(-shoulderHalfW + 4, keelY, -keelHalfW, keelY);
  p.lineTo(keelHalfW, keelY);
  p.quadraticCurveTo(shoulderHalfW - 4, keelY, shoulderHalfW, shoulderY);
  p.quadraticCurveTo(baseHalfW - 8, -70, baseHalfW, 0);
  // The opening, a hole: up the left side, over the round top and down the right.
  p.moveTo(-halfW, 0);
  p.lineTo(-halfW, -rise);
  p.arc(0, -rise, halfW, Math.PI, TAU);
  p.lineTo(halfW, 0);
  return p;
}

/** The shade flank: the right side of the hull, from the keel's right end down to the bed, in a curve that follows the flare. Clipped to the body. */
function hullCaveShadeFlank(): Path2D {
  const p = new Path2D();
  p.moveTo(34, HULL_CAVE_BODY.keelY - 2);
  p.lineTo(HULL_CAVE_W / 2, HULL_CAVE_BODY.keelY - 2);
  p.lineTo(HULL_CAVE_W / 2, 2);
  p.lineTo(70, 2);
  p.quadraticCurveTo(56, -64, 34, HULL_CAVE_BODY.keelY - 2);
  p.closePath();
  return p;
}

/**
 * Paint the hull cave interior with its base centre at local (0, 0): a cold near-black round-topped
 * opening, flat on the bed, HULL_CAVE_BACK_GROW px bigger than the gap in the front so the front's
 * ink covers its edge. Drawn behind everything hidden; the front covers the rest.
 */
export function paintHullCaveBack(ctx: CanvasRenderingContext2D): void {
  const halfW = HULL_CAVE_OPENING.halfW + HULL_CAVE_BACK_GROW;
  const rise = HULL_CAVE_OPENING.rise;
  const opening = new Path2D();
  opening.moveTo(-halfW, 0);
  opening.lineTo(-halfW, -rise);
  opening.arc(0, -rise, halfW, Math.PI, TAU);
  opening.lineTo(halfW, 0);
  opening.closePath();
  ctx.fillStyle = HULL_CAVE_INTERIOR;
  ctx.fill(opening);
}

/**
 * Paint the hull cave front with its base centre at local (0, 0): an old upturned trajinera, the
 * flat keel on top and the sides flared to the bed, in old wood with ink LW 3.5 round the outside
 * and round the opening (not along the bed). Inside the hull: faded paint bands, plank seams, algae
 * and a shine. A faded prow ball on the keel's right shoulder and two low stones at the feet. No
 * flag, no glow, no people.
 */
export function paintHullCaveFront(ctx: CanvasRenderingContext2D): void {
  const body = hullCaveBodyPath();
  ctx.fillStyle = HULL_CAVE_WOOD;
  ctx.fill(body, 'evenodd');

  ctx.save();
  ctx.clip(body, 'evenodd');
  for (const [top, bottom, colour] of HULL_CAVE_BANDS) {
    ctx.fillStyle = colour;
    ctx.fillRect(-HULL_CAVE_W / 2, top, HULL_CAVE_W, bottom - top);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = HULL_CAVE_SEAM;
  for (const y of HULL_CAVE_SEAMS) ctx.stroke(line(-HULL_CAVE_W / 2, y, HULL_CAVE_W / 2, y));
  ctx.fillStyle = HULL_CAVE_ALGAE;
  for (const [x, y, rx, ry] of HULL_CAVE_ALGAE_PATCHES) {
    const patch = new Path2D();
    ell(patch, x, y, rx, ry);
    ctx.fill(patch);
  }
  // A strip of lighter wood along the keel, a shine on it, and darker wood down the right flank, so the hull has a lit side and a shade side.
  ctx.fillStyle = HULL_CAVE_WOOD_LIGHT;
  ctx.fillRect(-HULL_CAVE_W / 2, HULL_CAVE_BODY.keelY, HULL_CAVE_W, 5);
  ctx.fillStyle = HULL_CAVE_WOOD_DARK;
  ctx.fill(hullCaveShadeFlank());
  ctx.lineWidth = 3;
  ctx.strokeStyle = HULL_CAVE_SHINE;
  ctx.stroke(line(-34, HULL_CAVE_BODY.keelY + 9, 28, HULL_CAVE_BODY.keelY + 9));
  ctx.restore();

  ctx.lineWidth = HULL_CAVE_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(body);

  const ball = new Path2D();
  ell(ball, 50, HULL_CAVE_BODY.keelY - 5, 5, 5);
  shape(ctx, ball, HULL_CAVE_FADED_ORANGE, 2.4);

  for (const [x, y, rx, ry, fill] of HULL_CAVE_FEET) {
    const stone = new Path2D();
    ell(stone, x, y, rx, ry);
    shape(ctx, stone, fill, HULL_CAVE_LW);
  }
}

// ---------------------------------------------------------------------------
// Old canal-bed stones
// ---------------------------------------------------------------------------

/** The bed's mean top edge in a chunk (the canal's: 322). */
export const CANAL_BED_EDGE_Y = 322;
const STONE_LW = LW * 0.6;
/** Corner radius of the old masonry. */
const STONE_CORNER = 3;

/**
 * Old paving slabs lying in the bed: [x, y below the bed edge, width, height, fill]. All inside the
 * chunk (x 6 to 474), so every bottom chunk paints the same and none is cut at a chunk edge.
 */
export const CANAL_BED_SLABS: readonly (readonly [number, number, number, number, string])[] = [
  [12, 16, 70, 14, CANAL_STONE],
  [96, 26, 56, 12, CANAL_STONE_LIGHT],
  [168, 14, 78, 14, CANAL_STONE],
  [262, 25, 62, 12, CANAL_STONE_LIGHT],
  [338, 15, 74, 14, CANAL_STONE],
  [420, 26, 52, 11, CANAL_STONE_LIGHT],
];
/** Worn blocks that stand on the bed edge, their lower part sunk: [centre x, width, height, tilt in rad, fill]. */
export const CANAL_BED_BLOCKS: readonly (readonly [number, number, number, number, string])[] = [
  [58, 24, 16, -0.08, CANAL_STONE],
  [146, 18, 12, 0.1, CANAL_STONE_DARK],
  [230, 26, 17, 0.05, CANAL_STONE],
  [320, 20, 13, -0.12, CANAL_STONE_DARK],
  [408, 24, 16, 0.07, CANAL_STONE],
];

/** A rounded block centred on (cx, cy), `w` wide and `h` tall, turned by `rot`. */
function blockPath(cx: number, cy: number, w: number, h: number, rot: number, r: number): Path2D {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const at = (x: number, y: number): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const hw = w / 2;
  const hh = h / 2;
  const p = new Path2D();
  p.moveTo(...at(-hw + r, -hh));
  p.lineTo(...at(hw - r, -hh));
  p.quadraticCurveTo(...at(hw, -hh), ...at(hw, -hh + r));
  p.lineTo(...at(hw, hh - r));
  p.quadraticCurveTo(...at(hw, hh), ...at(hw - r, hh));
  p.lineTo(...at(-hw + r, hh));
  p.quadraticCurveTo(...at(-hw, hh), ...at(-hw, hh - r));
  p.lineTo(...at(-hw, -hh + r));
  p.quadraticCurveTo(...at(-hw, -hh), ...at(-hw + r, -hh));
  p.closePath();
  return p;
}

/**
 * Paint the old canal-bed stones over the bed a bottom chunk has painted: flat paving slabs lying in
 * it, each with a seam, and worn blocks standing on its top edge, each with a moss cap and a shine.
 * `bedEdge` gives the bed's top edge at a chunk x, so the blocks sit on the real edge; the slabs lie
 * under it. Rectangular and weathered, so they read as old masonry and not as the pebbles or the
 * spring cave's round rock. Nothing random.
 */
export function paintCanalBedStones(ctx: CanvasRenderingContext2D, bedEdge: (x: number) => number = () => CANAL_BED_EDGE_Y): void {
  for (const [x, dy, w, h, fill] of CANAL_BED_SLABS) {
    const top = bedEdge(x + w / 2) + dy;
    shape(ctx, blockPath(x + w / 2, top + h / 2, w, h, 0, STONE_CORNER), fill, STONE_LW);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = CANAL_STONE_CRACK;
    ctx.stroke(line(x + w * 0.35, top + h * 0.25, x + w * 0.35, top + h * 0.75));
    ctx.stroke(line(x + w * 0.7, top + h * 0.25, x + w * 0.7, top + h * 0.75));
  }
  for (const [x, w, h, rot, fill] of CANAL_BED_BLOCKS) {
    const cy = bedEdge(x) + 1 - h * 0.3;
    shape(ctx, blockPath(x, cy, w, h, rot, STONE_CORNER), fill, STONE_LW);

    const moss = new Path2D();
    ell(moss, x + w * 0.1, cy - h / 2 + 2, w * 0.3, 1.8, rot);
    ctx.fillStyle = CANAL_STONE_MOSS;
    ctx.fill(moss);

    const shine = new Path2D();
    ell(shine, x - w * 0.28, cy - h * 0.1, w * 0.12, 1.2, rot);
    ctx.fillStyle = CANAL_STONE_SHINE;
    ctx.fill(shine);
  }
}

// ---------------------------------------------------------------------------
// Side-canal inflow marks (reused)
// ---------------------------------------------------------------------------

/**
 * The side-canal inflow's marks are the spring cave's outflow marks, reused as they are
 * (drawSpringCave.ts paintSpringOutflow): a lighter band of water that widens toward the right,
 * where the water comes in, and white flow lines each ending in a left-pointing chevron. They are
 * light only (white at an alpha, no ink and no dark), so they never take the deep canal water under
 * the luminance floor, and the chevrons carry the direction with no colour. Nominal rect 160 x 120,
 * anchored at its top-left corner. No new art: the water running left is the same cue.
 */
export const paintSideCanalInflow: (ctx: CanvasRenderingContext2D) => void = paintSpringOutflow;
/** Texture frame of the side-canal inflow marks: the spring outflow's. */
export const SIDE_CANAL_INFLOW_TEX: TexSize = OUTFLOW_TEX;
