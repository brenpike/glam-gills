/**
 * Fishing trajinera painters (issue #108, Area 10; ND-1): the drifting fishing hull, its rod, its
 * always-visible shadow, the float bead on a lure's line, the lure and the line frames (rest, bob
 * and tug) (guide 3g and 7p).
 *
 * Every shape, size and colour here is derived (provisional). Nothing shows a person, a hand, a
 * face or text, and nothing hooks: no hook, barb, point, spinner, weight or metal is ever drawn on a
 * line. The line ties round the worm with an ink knot. A caught axolotl is never drawn held, hooked,
 * tangled, lifted or carried: the lure leaves it at once (A11, ADR 0007, ADR 0008).
 *
 * Painters are still frames. No time, no randomness, no game state, no Phaser. The drift, the bob,
 * the tug's timing, the reel up and the fades belong to the scene; the positions belong to the logic
 * (src/logic/lures.ts). The motion numbers are exported here as plain constants for the scene to
 * read. Anchor points (a texture's origin):
 * - boat: the middle of the whole hull on the water line, local (0, 0). The hull is FISHING_BOAT_W
 *   wide, both ends rise FISHING_BOAT_RISE_END px above the water line, the gunwale dips to
 *   FISHING_BOAT_RISE_MID px above it in the middle, and the hull hangs FISHING_BOAT_DEPTH px below
 *   it. It is double-ended, so it is never mirrored. It has no post and no flower arch, so it is told
 *   from the gliding trajinera and the bailing boat by shape;
 * - rod: the holder, a pebble ring on the gunwale, local (0, 0). The rod leans to +x; the scene
 *   mirrors it for the left end. The holder sits at FISHING_ROD_HOLDER from the hull's anchor and the
 *   tip at FISHING_ROD_TIP from the hull's anchor: right over the hull's end, where the logic hangs a
 *   lure at the end of its hull (`along` 0 or the hull's length, 60 px from its middle);
 * - shadow: the hull's anchor (the middle of the hull on the water line). The pool is drawn
 *   FISHING_SHADOW_CY px under it, so the frame's origin is above the frame (originY is negative);
 * - bead: its centre, on the line at the water line, at the lure's x from the logic;
 * - lure: the worm's centre (WORM_TEX), at the lure's drawn position from the logic. It lies level
 *   and never turns. The line is not a texture: it is drawn live as one straight upright vector line
 *   at the lure's x from the logic (see FISHING_LINE_W), never at a fixed offset along the hull, and
 *   paintFishingLureFrame shows how it meets the lure at each frame.
 *
 * Greyscale: the hull is cream over three darker bands that ink lines keep apart, with three flowers
 * and a thin inked rod out over each end; the shadow is a soft dark pool; the lure is the mid-tone
 * wavy ringed snack worm with a thin dark line straight up from it to a white-over-dark bead at the
 * water line. The line is the tell, by shape, never by hue.
 */
import { ell, frameFromBounds, inkMany, line, seg, shape, type TexSize } from './canvasKit';
import { BOAT_SEAM, BOAT_SHINE, RAIL_LINE_W, TRAJINERA_SHADOW_RGB } from './drawDeepCanal';
import { BOAT_FLOWER_CENTRE, BOAT_HULL, BOAT_ORANGE, BOAT_PINK, BOAT_TEAL, BOAT_YELLOW, POLE_WOOD } from './drawPuntingPole';
import { paintWorm, WORM_TEX } from './drawProps';
import { INK, LW, PEBBLE_A, WHITE } from './palette';

/** Texture frame padding at 1x (the guide asks for 4 px). */
const PAD = 4;

// ---------------------------------------------------------------------------
// Hull
// ---------------------------------------------------------------------------

/** The hull's length along the water line, px: the gliding trajinera's 120 (src/logic/trajineras.ts). */
export const FISHING_BOAT_W = 120;
/** How far the middle of the gunwale rises above the water line, px. */
export const FISHING_BOAT_RISE_MID = 8;
/** How far the two raised ends rise above the water line, px. */
export const FISHING_BOAT_RISE_END = 15;
/** How far the hull hangs below the water line, px. */
export const FISHING_BOAT_DEPTH = 18;
const HALF_W = FISHING_BOAT_W / 2;
const CORNER = 12;
const HULL_LW = LW * 0.8;
/** Band edges down the hull, px from the water line: a cream rail above the first, three bands below. */
const BAND_EDGES: readonly [number, number, number, number] = [-3, 3, 9, FISHING_BOAT_DEPTH + 2];
/** The order of the three paint colours down the hull, top to bottom. */
export const FISHING_BOAT_BANDS: readonly [string, string, string] = [BOAT_PINK, BOAT_ORANGE, BOAT_TEAL];
/** Where the three rail flowers sit along the hull, px from its middle, and their petal fills. */
export const FISHING_BOAT_FLOWER_X: readonly [number, number, number] = [-30, 0, 30];
const FLOWER_FILLS: readonly [string, string, string] = [BOAT_PINK, BOAT_YELLOW, BOAT_PINK];
const FLOWER_R = 5;
const FLOWER_CENTRE_R = 1.8;
const FLOWER_LW = 2.4;
/** The prow ball at each end: radius and ink. */
const PROW_R = 5;
const PROW_LW = 1.8;
/** The gunwale's quadratic control y, so that its middle is FISHING_BOAT_RISE_MID px up. */
const GUNWALE_CONTROL_Y = 2 * -FISHING_BOAT_RISE_MID + FISHING_BOAT_RISE_END;

/** The gunwale's y (negative is up) at x px from the hull's middle: the curve across the top of the hull. */
function gunwaleY(x: number): number {
  const t = (x + HALF_W) / FISHING_BOAT_W;
  const u = 1 - t;
  return u * u * -FISHING_BOAT_RISE_END + 2 * u * t * GUNWALE_CONTROL_Y + t * t * -FISHING_BOAT_RISE_END;
}

/** The hull's outline, closed: raised ends, a dipping gunwale, rounded lower corners and a flat bottom. */
function hullPath(): Path2D {
  const p = new Path2D();
  p.moveTo(HALF_W, -FISHING_BOAT_RISE_END);
  p.quadraticCurveTo(HALF_W - 1, FISHING_BOAT_DEPTH - CORNER * 0.4, HALF_W - CORNER, FISHING_BOAT_DEPTH);
  p.lineTo(-HALF_W + CORNER, FISHING_BOAT_DEPTH);
  p.quadraticCurveTo(-HALF_W + 1, FISHING_BOAT_DEPTH - CORNER * 0.4, -HALF_W, -FISHING_BOAT_RISE_END);
  p.quadraticCurveTo(0, GUNWALE_CONTROL_Y, HALF_W, -FISHING_BOAT_RISE_END);
  p.closePath();
  return p;
}

/**
 * Texture frame of the boat (provisional), as the guide's: 132 x 62, x -66 to 66 and y -38 to 24.
 * Anchor point is the middle of the hull on the water line, local (0, 0). The hull and its ink sit
 * well inside it, so the boat is never cropped, and it is never stretched or mirrored.
 */
export const FISHING_BOAT_TEX: TexSize = { w: 132, h: 62, originX: 66, originY: 38 };

/**
 * Paint the boat around its anchor point: one whole FISHING_BOAT_W hull in BOAT_HULL cream, clipped
 * bands (FISHING_BOAT_BANDS, top to bottom) under a cream rail, an ink line under the rail and one
 * between each pair of bands (so the bands stay apart in greyscale), plank seams (alpha, never ink),
 * an ink outline of 2.8 all round, one rail shine, three rail flowers (a white centre each) and a
 * BOAT_ORANGE prow ball on each end. No rod (paintFishingRod draws it), no post, no flower arch, no
 * person, no face, no text. The drag net's two boats are this same painting.
 */
export function paintFishingBoat(ctx: CanvasRenderingContext2D): void {
  const hull = hullPath();
  ctx.fillStyle = BOAT_HULL;
  ctx.fill(hull);

  ctx.save();
  ctx.clip(hull);
  const [e0, e1, e2, e3] = BAND_EDGES;
  const edges = [
    [e0, e1],
    [e1, e2],
    [e2, e3],
  ] as const;
  edges.forEach(([top, bottom], i) => {
    ctx.fillStyle = FISHING_BOAT_BANDS[i];
    ctx.fillRect(-HALF_W - 1, top, FISHING_BOAT_W + 2, bottom - top);
  });
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = BOAT_SEAM;
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    const x = -HALF_W + FISHING_BOAT_W * f;
    ctx.stroke(line(x, e0, x, FISHING_BOAT_DEPTH));
  }
  // The rail line and the lines between the bands: thin ink, so the bands read apart in greyscale.
  ctx.lineWidth = RAIL_LINE_W;
  ctx.strokeStyle = INK;
  for (const y of [e0, e1, e2]) ctx.stroke(line(-HALF_W - 1, y, HALF_W + 1, y));
  ctx.restore();

  ctx.lineWidth = HULL_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(hullPath());

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = BOAT_SHINE;
  ctx.stroke(line(-HALF_W + 16, e0 - 2, -HALF_W + 44, e0 - 2));

  FISHING_BOAT_FLOWER_X.forEach((x, i) => {
    const y = gunwaleY(x) - 1;
    const petals = new Path2D();
    ell(petals, x, y, FLOWER_R, FLOWER_R);
    shape(ctx, petals, FLOWER_FILLS[i], FLOWER_LW);
    const centre = new Path2D();
    ell(centre, x, y, FLOWER_CENTRE_R, FLOWER_CENTRE_R);
    ctx.fillStyle = BOAT_FLOWER_CENTRE;
    ctx.fill(centre);
  });

  for (const side of [-1, 1] as const) {
    const ball = new Path2D();
    ell(ball, side * (HALF_W - PROW_R - 1), -FISHING_BOAT_RISE_END + PROW_R - 1, PROW_R, PROW_R);
    shape(ctx, ball, BOAT_ORANGE, PROW_LW);
  }
}

// ---------------------------------------------------------------------------
// Rod
// ---------------------------------------------------------------------------

/** Where a rod's holder sits from the hull's anchor: 16 px in from the hull's end, on the gunwale. */
export const FISHING_ROD_HOLDER: Readonly<{ x: number; y: number }> = Object.freeze({ x: HALF_W - 16, y: -12 });
/**
 * Where a rod's tip is from the hull's anchor: right over the hull's end and 30 px above the water
 * line. The logic owns where a lure hangs (src/logic/lures.ts): a lure at a hull end (`along` 0 or
 * the hull's length) is FISHING_BOAT_W / 2 px from the hull's middle, under this tip (mirrored for
 * the left end). The line is drawn at the lure's x from the logic, so the art implies no offset.
 */
export const FISHING_ROD_TIP: Readonly<{ x: number; y: number }> = Object.freeze({ x: HALF_W, y: -30 });
/** The rod's tip from the holder: a straight tube rising 18 px over a run of 16 (a slope of 1.125). */
const ROD_RUN = FISHING_ROD_TIP.x - FISHING_ROD_HOLDER.x;
const ROD_RISE = FISHING_ROD_HOLDER.y - FISHING_ROD_TIP.y;
/** The rod tube: colour width and the ink added each side. */
const ROD_W = 3;
const ROD_OL = 1.2;
/** The holder ring: radius and ink. */
const HOLDER_R = 2;
const HOLDER_LW = 1.2;

/**
 * Texture frame of the rod (provisional): the tube and the holder ring with their ink plus 4 px of
 * padding. Anchor point is the holder, local (0, 0). The tip is right over the hull's end, so the
 * frame is smaller than the guide's 48 x 44.
 */
export const FISHING_ROD_TEX: TexSize = frameFromBounds(
  -HOLDER_R - HOLDER_LW / 2,
  -ROD_RISE - ROD_W / 2 - ROD_OL,
  ROD_RUN + ROD_W / 2 + ROD_OL,
  HOLDER_R + HOLDER_LW / 2,
  PAD,
);

/**
 * Paint the rod around the holder, leaning to +x: a straight POLE_WOOD tube with an INK line each
 * side from the holder out over the side to the tip, and the holder as a PEBBLE_A ring with INK
 * 1.2. No reel, no hand and no hook. The scene mirrors it for the hull's left end.
 */
export function paintFishingRod(ctx: CanvasRenderingContext2D): void {
  inkMany(ctx, [seg(line(0, 0, ROD_RUN, -ROD_RISE), ROD_W, POLE_WOOD, ROD_OL)]);
  const ring = new Path2D();
  ell(ring, 0, 0, HOLDER_R, HOLDER_R);
  shape(ctx, ring, PEBBLE_A, HOLDER_LW);
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

/** The shadow pool's radii and the y of its centre under the water line, px: from 20 to 44 px under it. */
export const FISHING_SHADOW_RX = 64;
export const FISHING_SHADOW_RY = 12;
export const FISHING_SHADOW_CY = 32;
/** The shadow's alpha in the middle, fading to 0 at its rim. See-through, no ink, no halo, no chevrons. */
export const FISHING_SHADOW_ALPHA = 0.32;

/**
 * Texture frame of the shadow (provisional), as the guide's: 140 x 36. Anchor point is the hull's
 * anchor, the middle of the hull on the water line. The pool is FISHING_SHADOW_CY px under it, so
 * the origin is above the frame (originY is negative): the frame runs from 14 to 50 px under the
 * anchor.
 */
export const FISHING_SHADOW_TEX: TexSize = frameFromBounds(
  -FISHING_SHADOW_RX,
  FISHING_SHADOW_CY - FISHING_SHADOW_RY,
  FISHING_SHADOW_RX,
  FISHING_SHADOW_CY + FISHING_SHADOW_RY,
  6,
);

/**
 * Paint the shadow around the hull's anchor: one soft ellipse in deep blue (TRAJINERA_SHADOW_RGB)
 * at FISHING_SHADOW_ALPHA in the middle fading to nothing at its rim. No ink, no halo, no chevrons,
 * so it never reads as the gliding trajinera's warning. It spans about the hull's own length: a line
 * at a hull end crosses only its faded rim, and ink keeps 3:1 over even its darkest point, so the
 * line still reads. The scene always shows it, under its boat, moving with it.
 */
export function paintFishingShadow(ctx: CanvasRenderingContext2D): void {
  const [r, g, b] = TRAJINERA_SHADOW_RGB;
  ctx.save();
  ctx.translate(0, FISHING_SHADOW_CY);
  ctx.scale(1, FISHING_SHADOW_RY / FISHING_SHADOW_RX);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, FISHING_SHADOW_RX);
  grad.addColorStop(0, `rgba(${r},${g},${b},${FISHING_SHADOW_ALPHA})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  const pool = new Path2D();
  ell(pool, 0, 0, FISHING_SHADOW_RX, FISHING_SHADOW_RX);
  ctx.fill(pool);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Line (drawn live) and float bead
// ---------------------------------------------------------------------------

/**
 * The line: ink, 1.6 wide and opaque, drawn live each frame as one straight upright vector line at
 * the lure's x from the logic (lureLine), from the rod tip's height down through the bead to the
 * lure's knot. It is 3:1 or better against every deep canal background, down to the deep stop at
 * the floor (3c).
 */
export const FISHING_LINE_COLOUR = INK;
export const FISHING_LINE_W = 1.6;

/** Stroke the line from (x1, y1) to (x2, y2): one straight opaque INK line, no fill, no glow, no end mark. */
export function paintFishingLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.lineWidth = FISHING_LINE_W;
  ctx.strokeStyle = FISHING_LINE_COLOUR;
  ctx.stroke(line(x1, y1, x2, y2));
}

/** The float bead: a ball of radius 4.5, its top half white and its bottom half pink. */
export const FISHING_BEAD_R = 4.5;
export const FISHING_BEAD_TOP = WHITE;
export const FISHING_BEAD_BOTTOM = BOAT_PINK;
const BEAD_LW = 1.6;
const BEAD_SPLIT_LW = 1.2;

/**
 * Texture frame of the bead (provisional): the ball with its ink plus 4 px of padding. Anchor point
 * is its centre. The guide asks for 18 x 18; the ball's ink needs a little more to keep 4 px of padding.
 */
export const FISHING_BEAD_TEX: TexSize = frameFromBounds(
  -FISHING_BEAD_R - BEAD_LW / 2,
  -FISHING_BEAD_R - BEAD_LW / 2,
  FISHING_BEAD_R + BEAD_LW / 2,
  FISHING_BEAD_R + BEAD_LW / 2,
  PAD,
);

/**
 * Paint the bead around its centre: a white ball with ink 1.6 round it, its bottom half pink, split
 * by an ink line of 1.2. The halves are 2.60:1 apart, so the split reads in greyscale. It moves
 * only with its boat.
 */
export function paintFishingBead(ctx: CanvasRenderingContext2D): void {
  const ball = new Path2D();
  ell(ball, 0, 0, FISHING_BEAD_R, FISHING_BEAD_R);
  shape(ctx, ball, FISHING_BEAD_TOP, BEAD_LW);

  ctx.save();
  const lowerHalf = new Path2D();
  lowerHalf.rect(-FISHING_BEAD_R - BEAD_LW, 0, 2 * (FISHING_BEAD_R + BEAD_LW), FISHING_BEAD_R + BEAD_LW);
  ctx.clip(lowerHalf);
  ctx.fillStyle = FISHING_BEAD_BOTTOM;
  ctx.fill(ball);
  ctx.restore();

  ctx.lineWidth = BEAD_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(ball);
  ctx.lineWidth = BEAD_SPLIT_LW;
  ctx.stroke(line(-FISHING_BEAD_R, 0, FISHING_BEAD_R, 0));
}

// ---------------------------------------------------------------------------
// Lure
// ---------------------------------------------------------------------------

/** Texture frame of the lure: the snack worm's, reused as it is (head at +x, 48 x 34). */
export const FISHING_LURE_TEX: TexSize = WORM_TEX;
/** The ink knot dot where the line ties on: radius 1.4, at the top of the worm's tube at its middle bend. */
export const FISHING_KNOT: Readonly<{ x: number; y: number; r: number }> = Object.freeze({ x: 1, y: -4.8, r: 1.4 });

/**
 * Paint the lure around the worm's centre: the snack worm as it is (paintWorm: wavy tube, ring
 * marks, highlight, bead eyes), so it reads as a snack, plus one ink knot dot. Its only tell is its
 * line. No hook, no barb, no point, no weight, no metal. It lies level and never turns.
 */
export function paintFishingLure(ctx: CanvasRenderingContext2D): void {
  paintWorm(ctx);
  const knot = new Path2D();
  ell(knot, FISHING_KNOT.x, FISHING_KNOT.y, FISHING_KNOT.r, FISHING_KNOT.r);
  ctx.fillStyle = INK;
  ctx.fill(knot);
}

/** The frames of a lure and its line, by name. */
export type FishingLureFrame = 'rest' | 'bobUp' | 'bobDown' | 'tug';

/**
 * How far each frame of the lure sits from its rest position along the line, px (negative is up):
 * rest 0; the bob's two ends (the logic's bob amplitude, SNACK_BOB_PX 2.5); the tug 10 px up, the
 * top of the jerk. The line's top end stays at the rod tip and its lower end moves with the lure.
 */
export const FISHING_LURE_FRAME_DY: Readonly<Record<FishingLureFrame, number>> = Object.freeze({
  rest: 0,
  bobUp: -2.5,
  bobDown: 2.5,
  tug: -10,
});

/**
 * Motion numbers for the scene, in px and seconds (looks only; the logic owns where a lure is eaten,
 * lureDrawn). Under full motion the lure bobs over `bobPeriod` and the hull and rods over
 * `hullBobPeriod`; a tug snaps the lure `tugPx` up and back in `tugFor` (one half sine) with the
 * axolotl's snag wriggle for `wriggleFor`; the lure is then reeled up at `reelSpeed` and fades over
 * the last `reelFade` s at the bead; a returned lure fades in at its eat position (from alpha 0.4
 * over `reducedFadeIn`, under full and reduced motion alike).
 * Under reduced motion there is no bob, jerk or wriggle: the lure fades out where it is over
 * `reducedFadeOut` and fades back in at its rest position over `reducedFadeIn`.
 */
export const FISHING_MOTION = Object.freeze({
  bobPx: 2.5,
  bobPeriod: 2.4,
  hullBobPx: 1.5,
  hullBobPeriod: 3,
  tugPx: 10,
  tugFor: 0.25,
  wriggleFor: 0.4,
  reelSpeed: 200,
  reelFade: 0.2,
  reducedFadeOut: 0.3,
  reducedFadeIn: 0.5,
});

/**
 * Paint one frame of a lure on its line around the lure's rest position (the worm's centre, local
 * (0, 0)), which the scene places at the lure's position from the logic: the line first, one
 * straight INK line from `lineLength` px above the rest position (the rod tip's height, which never
 * moves) down to the lure's drawn position, then the lure over its end. At the tug the line is
 * shortened with the lure. The line is always upright, at the lure's own x, so it implies no offset
 * along the hull; a lure at a hull end hangs straight under its rod tip.
 */
export function paintFishingLureFrame(ctx: CanvasRenderingContext2D, frame: FishingLureFrame, lineLength: number): void {
  const dy = FISHING_LURE_FRAME_DY[frame];
  paintFishingLine(ctx, 0, -lineLength, 0, dy);
  ctx.save();
  ctx.translate(0, dy);
  paintFishingLure(ctx);
  ctx.restore();
}
