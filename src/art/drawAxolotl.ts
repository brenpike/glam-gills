/**
 * Axolotl painter. Port of drawAxolotl() from prototypes/art-styles/cartoon.js,
 * geometry from guide sections 6b-6g, layer order from 6a.
 *
 * The axolotl is authored facing right in local units (snout at +x). The caller
 * owns the transform: mirror, rotate and scale the sprite in the scene.
 * Presentational only: no game state, no randomness.
 */
import { blob, ell, inkMany, line, seg, type Seg, type TexSize } from './canvasKit';
import {
  BLUSH,
  BODY_SHINE,
  FIN_RAY,
  FRECKLE,
  INK,
  LEUCISTIC,
  LW,
  SUN,
  WHITE,
  type MorphExtras,
  type MorphMark,
  type MorphMarkSet,
  type MorphPalette,
  type MorphRim,
} from './palette';
import {
  DEFAULT_ART_LOOK,
  FAR_EYE,
  HEAD_ELLIPSE,
  NEAR_EYE,
  TAIL_SEGMENTS,
  axolotlBodyGeometry,
  boundsOfPoints,
  gillInkBounds,
  legAngle,
  legSlotFrames,
  paintCheekHeart,
  paintEye,
  paintGills,
  paintMouth,
  paintSpots,
  tailSamples,
  torsoBackScale,
  torsoPoint,
  unionBounds,
  type AxolotlArtLook,
  type BodyEllipse,
  type Bounds,
  type TailGeometry,
  type TailSample,
} from './drawAxolotlParts';
import { dreamMarkerCentres, paintDreamMarker, paintDreamPattern } from './drawDreamOverlay';
import { NO_OUTFIT, paintBodyWearable, paintLegWearables, wearsOnLegs, type ArtOutfit } from './drawWearables';

/**
 * Texture frame in logical units. Holds every look (every gill style, Boy or
 * girl, Tail, Body and Age) at every gill flutter phase and at the largest
 * tail amplitude (1.6), outline ink included, with at least 4 logical px of
 * padding on every side (guide 11): see axolotlInkBounds(). The far left is
 * a Grown-up Chubby Boy's Long tail tip (x -97.5); the top is Grown-up Long
 * gill ink (about y -74.4); the bottom is a regrowing rear leg's glints on a
 * Chubby Girl, whose deeper torso lowers the leg roots (about y 58.05); the
 * right is the snout ink (x 56.5), with the prototype frame's slack kept. Only
 * the bottom grew for the clearer Body and Boy or girl shapes. Size (guide 6o)
 * scales the bake, not this frame. Local x = 0 sits originX from the left;
 * local y = 0 sits originY from the top.
 */
export const AXO_TEX: TexSize = { w: 166, h: 142, originX: 102, originY: 79 };

/**
 * Picture-button crops in local units: `face` for Eyes and Mouth (both eye
 * zones, every mouth, the snout, a Girl's cheek heart and the Grumpy brows),
 * `gills` for Gills (every gill style at every flutter phase and Age), `spots`
 * for Spots (every spot mark of every Boy or girl, Tail, Body and Age at every
 * swim phase at tail amplitude 1, with 4 units of padding, plus the back of the
 * head to x 7), `whole` (the AXO_TEX frame) for every other option.
 */
export const AXO_PREVIEW_CROPS: Readonly<Record<'face' | 'gills' | 'spots' | 'whole', Bounds>> = {
  face: { minX: 12, minY: -20, maxX: 58, maxY: 24 },
  gills: { minX: -63, minY: -77, maxX: 25, maxY: 22 },
  spots: { minX: -85, minY: -22, maxX: 7, maxY: 20 },
  whole: {
    minX: -AXO_TEX.originX,
    minY: -AXO_TEX.originY,
    maxX: AXO_TEX.w - AXO_TEX.originX,
    maxY: AXO_TEX.h - AXO_TEX.originY,
  },
};

/** Local units are drawn at this scale in the scene (guide 6a). */
export const AXO_SCENE_SCALE = 0.95;

/** Largest tail amplitude the texture frame is sized for. */
export const AXO_MAX_TAIL_AMP = 1.6;

/** Per-leg status for leg loss and regrowth (issue #7). */
export type LegStatus = 'present' | 'regrowing' | 'lost';

/** Look of one leg. `progress` is 0..1 and only read while `status` is 'regrowing'. */
export interface LegLook {
  readonly status: LegStatus;
  readonly progress: number;
}

/**
 * Local root point of each leg, in leg draw order (same order as
 * `AxolotlPose.legs`): far-front, far-rear, near-front, near-rear. Matches guide 6e.
 * Presentational anchor for callers (for example a poof effect). Provisional.
 */
export interface LegRoot {
  readonly x: number;
  readonly y: number;
}
/** Leg roots of DEFAULT_ART_LOOK (the prototype torso). Equals axolotlLegRoots(DEFAULT_ART_LOOK). */
export const AXO_LEG_ROOTS: readonly LegRoot[] = [
  { x: 8, y: 15 },
  { x: -14, y: 17 },
  { x: 18, y: 15 },
  { x: -24, y: 17 },
];

/**
 * Leg roots the painter uses for `look`, in the same order as AXO_LEG_ROOTS.
 * They follow the torso's lower edge and back end (Body, Age, Boy or girl).
 */
export function axolotlLegRoots(look: AxolotlArtLook): LegRoot[] {
  return [...axolotlBodyGeometry(look).legRoots];
}

export interface AxolotlPose {
  /** Tail and leg cycle phase, radians (period 1.2 s at 2*pi * t / 1.2). */
  swimPhase: number;
  /** Gill flutter phase, radians (period 0.8 s at 2*pi * t / 0.8). */
  gillPhase: number;
  /** Eye height factor: 1 open down to 0.12 fully blinked. */
  blink: number;
  /** Tail wave amplitude: 1 normal, up to 1.6 while dashing. */
  tailAmp: number;
  /** Regeneration glints along the tail, 0 none to 1 full. */
  sparkle: number;
  /**
   * Optional per-leg looks, length 4, in leg draw order (see AXO_LEG_ROOTS):
   * far-front, far-rear, near-front, near-rear. Undefined draws all four legs
   * present, exactly as before. A missing entry counts as present.
   */
  legs?: readonly LegLook[];
  /**
   * Sheen phase in [0, 1) (dreamSheenAt), read only by the sheen Dream
   * colours (isSheenDream: Iridescent, Crystal shine): each one's stripe pair
   * glides from x 14 to the tail tip (guide 6p, 9). Undefined holds the
   * reduced-motion still stripe at x -10.
   */
  sheen?: number;
}

/** A calm, eyes-open pose. */
export const AXO_REST_POSE: AxolotlPose = {
  swimPhase: 0,
  gillPhase: 0,
  blink: 1,
  tailAmp: 1,
  sparkle: 0,
};

/** Leg tube and toe values (guide 6e). */
const LEG_W = 8;
const LEG_OL = 3.1;
const TOE_W = 4.2;
const TOE_OL = 2.6;
const TOE_SPLAY = 0.6;

/**
 * Leg angles in leg draw order (far-front, far-rear, near-front, near-rear); diagonal pairs swing
 * opposite. The same legAngle() the Socks and Feet frames turn with, so a Sock follows its paddle.
 */
export function legAngles(swim: number): number[] {
  return [0, 1, 2, 3].map((index) => legAngle(index, swim));
}

/** Leg end point and its three toe tips. */
export function legPoints(bx: number, by: number, ang: number, len: number, toeLen: number): [number, number][] {
  const ex = bx + Math.cos(ang) * len;
  const ey = by + Math.sin(ang) * len;
  const points: [number, number][] = [[ex, ey]];
  for (let d = -1; d <= 1; d++) {
    const ta = ang + d * TOE_SPLAY;
    points.push([ex + Math.cos(ta) * toeLen, ey + Math.sin(ta) * toeLen]);
  }
  return points;
}

/**
 * `k` (0..1, default 1) scales a growing leg; k = 1 is the normal leg, unchanged.
 */
function leg(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  ang: number,
  len: number,
  toeLen: number,
  colour: string,
  k = 1,
): void {
  const [[ex, ey], ...toes] = legPoints(bx, by, ang, len * k, toeLen * k);
  const ol = 0.5 + 0.5 * k;
  const segs: Seg[] = [seg(line(bx, by, ex, ey), LEG_W * k, colour, LEG_OL * ol)];
  for (const [tx, ty] of toes) segs.push(seg(line(ex, ey, tx, ty), TOE_W * k, colour, TOE_OL * ol));
  inkMany(ctx, segs);
}

// Leg ghost (lost / regrowing). Provisional values.
/** Outline radius around the leg tube and around each toe, just outside the inked leg. */
const GHOST_R_LEG = 8.2;
const GHOST_R_TOE = 5.6;
/** Pale under-line width beneath the dashed ghost ink. */
const GHOST_UNDER = 3.6;
/** Ghost ink alpha: faint when lost, a little firmer while regrowing. */
const GHOST_ALPHA_LOST = 0.55;
const GHOST_ALPHA_REGROW = 0.75;
/** Leg-regrowth glints: arm radius at full strength. */
export const LEG_GLINT_R = 3.8;
/** Below this progress no fill is drawn yet, only the outline and glints. */
const LEG_FILL_MIN = 0.04;
/** Twinkle arms: colour width and outline. */
export const GLINT_ARM_W = 3;
export const GLINT_ARM_OL = 1.6;
/** Regeneration glints along the tail: arm radius at full strength. */
export const REGEN_GLINT_R = 4.2;
/** A glint whose arm radius is below this is not painted. */
export const GLINT_MIN_R = 0.4;

function capsule(p: Path2D, x1: number, y1: number, x2: number, y2: number, r: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  p.moveTo(x1 + Math.cos(a + Math.PI / 2) * r, y1 + Math.sin(a + Math.PI / 2) * r);
  p.arc(x1, y1, r, a + Math.PI / 2, a + (3 * Math.PI) / 2);
  p.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  p.closePath();
}

/**
 * Faint dashed ink outline of the full leg: where it was, or is growing back.
 * Dashes and a pale under-line keep it readable on dark and light water without
 * colour. No stump, no red.
 */
function legGhost(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  ang: number,
  len: number,
  toeLen: number,
  alpha: number,
): void {
  const [[ex, ey], ...toes] = legPoints(bx, by, ang, len, toeLen);
  const g = new Path2D();
  capsule(g, bx, by, ex, ey, GHOST_R_LEG);
  for (const [tx, ty] of toes) capsule(g, ex, ey, tx, ty, GHOST_R_TOE);
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.lineWidth = GHOST_UNDER;
  ctx.strokeStyle = WHITE;
  ctx.stroke(g);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.setLineDash([3, 3]);
  ctx.stroke(g);
  ctx.restore();
}

function legProgress(look: LegLook): number {
  const p = look.progress;
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}

/** Where the tail regeneration glints sit (s along the tail), alternating above and below. */
const REGEN_GLINT_S: readonly number[] = [0.28, 0.42, 0.56, 0.7, 0.84];

/** Regeneration glint centres beside the tail, in REGEN_GLINT_S order. */
export function regenGlintSpots(tail: readonly TailSample[]): [number, number][] {
  return REGEN_GLINT_S.map((s, k): [number, number] => {
    const tp = tail[Math.round(s * TAIL_SEGMENTS)];
    const side = k % 2 === 0 ? -1 : 1;
    return [tp.x, tp.cy + side * (tp.hc + 3)];
  });
}

/**
 * Arm radius of tail regeneration glint `k` (REGEN_GLINT_S order) at this
 * sparkle (clamped to 0..1) and swim phase. Below GLINT_MIN_R it is not painted.
 */
export function regenGlintRadius(sparkle: number, swimPhase: number, k: number): number {
  const amount = Math.min(1, Math.max(0, sparkle));
  // Twinkle at the 1.2 s swim cycle, far below 3 flashes per second.
  return REGEN_GLINT_R * amount * (0.6 + 0.4 * Math.sin(swimPhase + k * 1.3));
}

/**
 * Arm radius of glint `k` (legGlintSpots order) beside regrowing leg
 * `legIndex` (leg draw order) at regrowth `progress` (0..1, clamped as
 * legProgress does) and swim phase. Below GLINT_MIN_R it is not painted.
 */
export function legGlintRadius(progress: number, swimPhase: number, legIndex: number, k: number): number {
  const strength = 0.6 + 0.4 * progress;
  return LEG_GLINT_R * strength * (0.6 + 0.4 * Math.sin(swimPhase + k * 1.3 + legIndex * 0.9));
}

/** Paint one rounded plus-shaped twinkle of arm radius `r` centred on (gx, gy). */
export function paintTwinkle(ctx: CanvasRenderingContext2D, gx: number, gy: number, r: number): void {
  inkMany(ctx, [
    seg(line(gx - r, gy, gx + r, gy), GLINT_ARM_W, SUN, GLINT_ARM_OL),
    seg(line(gx, gy - r, gx, gy + r), GLINT_ARM_W, SUN, GLINT_ARM_OL),
  ]);
  const core = new Path2D();
  ell(core, gx, gy, r * 0.32, r * 0.32);
  ctx.fillStyle = WHITE;
  ctx.fill(core);
}

/**
 * Regeneration glints: rounded plus-shaped twinkles along the tail. Never gory.
 * The tail is sampled only when the glints show.
 */
function paintRegenGlints(ctx: CanvasRenderingContext2D, tailGeo: TailGeometry, pose: AxolotlPose): void {
  const amount = Math.min(1, Math.max(0, pose.sparkle));
  if (amount <= 0.01) return;
  const tail = tailSamples(tailGeo, pose.swimPhase, pose.tailAmp);
  regenGlintSpots(tail).forEach(([gx, gy], k) => {
    const r = regenGlintRadius(pose.sparkle, pose.swimPhase, k);
    if (r < GLINT_MIN_R) return;
    paintTwinkle(ctx, gx, gy, r);
  });
}

/** Glint centres for one regrowing leg: beside the toes on both sides, and just past the toes. */
export function legGlintSpots(root: LegRoot, ang: number, len: number): [number, number][] {
  const ex = root.x + Math.cos(ang) * len;
  const ey = root.y + Math.sin(ang) * len;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  return [
    [ex - dy * 11 + dx * 3, ey + dx * 11 + dy * 3],
    [ex + dy * 11 + dx * 3, ey - dx * 11 + dy * 3],
    [ex + dx * 14, ey + dy * 14],
  ];
}

/**
 * Sparkles near each regrowing leg: rounded plus-shaped twinkles around the toes.
 * Size follows the swim phase (period 1.2 s, far below 3 flashes per second), so
 * they hold still when the phase is frozen. Still drawn at progress 0 and 1.
 */
function paintLegGlints(
  ctx: CanvasRenderingContext2D,
  pose: AxolotlPose,
  legRoots: readonly LegRoot[],
  legAng: readonly number[],
  legLen: readonly number[],
): void {
  const legs = pose.legs;
  if (!legs) return;
  for (let i = 0; i < 4; i++) {
    const look = legs[i];
    if (!look || look.status !== 'regrowing') continue;
    const progress = legProgress(look);
    legGlintSpots(legRoots[i], legAng[i], legLen[i]).forEach(([gx, gy], k) => {
      const r = legGlintRadius(progress, pose.swimPhase, i, k);
      if (r < GLINT_MIN_R) return;
      paintTwinkle(ctx, gx, gy, r);
    });
  }
}

function ellipseBounds(e: BodyEllipse, pad: number): Bounds {
  return { minX: e.cx - e.rx - pad, minY: e.cy - e.ry - pad, maxX: e.cx + e.rx + pad, maxY: e.cy + e.ry + pad };
}

/** Box of one leg in its widest look (the lost-leg ghost or the inked leg) plus its regrowth glints. */
export function legInkBounds(root: LegRoot, ang: number, len: number, toeLen: number): Bounds {
  const [end, ...toes] = legPoints(root.x, root.y, ang, len, toeLen);
  const ghostLeg = GHOST_R_LEG + GHOST_UNDER / 2;
  const ghostToe = GHOST_R_TOE + GHOST_UNDER / 2;
  const glintPad = LEG_GLINT_R + GLINT_ARM_W / 2 + GLINT_ARM_OL;
  return unionBounds([
    boundsOfPoints([[root.x, root.y], end], Math.max(ghostLeg, LEG_W / 2 + LEG_OL)),
    boundsOfPoints(toes, Math.max(ghostToe, TOE_W / 2 + TOE_OL)),
    boundsOfPoints(legGlintSpots(root, ang, len), glintPad),
  ]);
}

/**
 * Box holding everything drawAxolotl can paint for `look` at this swim phase,
 * gill phase and tail amplitude, outline ink included: silhouette, fins, legs
 * in every leg state, regrowth and regeneration glints at full strength, and
 * gills. The face sits inside the head. Size scales the bake, not this box.
 */
export function axolotlInkBounds(
  look: AxolotlArtLook,
  swimPhase: number,
  gillPhase: number,
  tailAmp: number,
): Bounds {
  const geo = axolotlBodyGeometry(look);
  const tail = tailSamples(geo.tail, swimPhase, tailAmp);
  const finEdges = tail.flatMap((tp): [number, number][] => [
    [tp.x, tp.cy - tp.hc - tp.finTop],
    [tp.x, tp.cy + tp.hc + tp.finBottom],
  ]);
  const legAng = legAngles(swimPhase);
  return unionBounds([
    gillInkBounds(look.gills, gillPhase, geo.gillLength),
    ellipseBounds(HEAD_ELLIPSE, LW),
    ellipseBounds(geo.torso, LW),
    boundsOfPoints(finEdges, LW),
    boundsOfPoints(regenGlintSpots(tail), REGEN_GLINT_R + GLINT_ARM_W / 2 + GLINT_ARM_OL),
    ...geo.legRoots.map((root, i) => legInkBounds(root, legAng[i], geo.legLengths[i], geo.toeLength)),
  ]);
}

// ---- Morph extras (guide 3b, 6h). Derived (provisional). ----------------------
// Painted only when the palette has extras, so the Leucistic path makes no new
// draw calls. Every helper clips to the merged silhouette, so nothing can spill
// onto the ink outline or outside the body.

/** Top edge y of an ellipse at x, or null when x is outside it. */
function ellTopAt(e: BodyEllipse, x: number): number | null {
  const u = (x - e.cx) / e.rx;
  if (Math.abs(u) > 1) return null;
  return e.cy - e.ry * Math.sqrt(1 - u * u);
}

/** Top silhouette edge of the tail polygon at x (linear between its points), or null outside it. */
function tailTopAt(topF: readonly (readonly [number, number])[], x: number): number | null {
  for (let i = 0; i < topF.length - 1; i++) {
    const [x0, y0] = topF[i];
    const [x1, y1] = topF[i + 1];
    if (x <= x0 && x >= x1) return x1 === x0 ? Math.min(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return null;
}

/**
 * The upper silhouette edge as a polyline: from the snout tip round the head,
 * back along the look's torso and on along the tail's outer top edge (topF)
 * to tail point `endIndex`. Follows the real outline, so a stroke along it,
 * clipped to the silhouette, lies just inside the ink.
 */
function upperOutline(
  topF: readonly (readonly [number, number])[],
  endIndex: number,
  torso: BodyEllipse,
): [number, number][] {
  const head = HEAD_ELLIPSE;
  const pts: [number, number][] = [];
  const arcSteps = 10;
  for (let k = 0; k <= arcSteps; k++) {
    const a = (k / arcSteps) * (Math.PI / 2);
    pts.push([head.cx + head.rx * Math.cos(a), head.cy - head.ry * Math.sin(a)]);
  }
  const xEnd = topF[endIndex][0];
  const xs = new Set<number>();
  for (let x = head.cx - 1; x > xEnd; x -= 1) xs.add(x);
  for (let i = 0; i <= endIndex; i++) if (topF[i][0] < head.cx) xs.add(topF[i][0]);
  for (const x of [...xs].sort((a, b) => b - a)) {
    let y = Infinity;
    for (const v of [ellTopAt(head, x), ellTopAt(torso, x), tailTopAt(topF, x)]) {
      if (v !== null && v < y) y = v;
    }
    if (Number.isFinite(y)) pts.push([x, y]);
  }
  return pts;
}

/**
 * Rim light: a stroke centred on the upper outline, clipped to the silhouette,
 * so `rim.width` px show just inside the ink. Never touches the lower edge.
 * `endIndex` is the last tail point: the look's fin band start, or the tail tip.
 */
function paintMorphRim(
  ctx: CanvasRenderingContext2D,
  sil: Path2D,
  topF: readonly (readonly [number, number])[],
  endIndex: number,
  torso: BodyEllipse,
  rim: MorphRim,
): void {
  const pts = upperOutline(topF, endIndex, torso);
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  ctx.save();
  ctx.clip(sil);
  ctx.lineWidth = rim.width * 2;
  ctx.strokeStyle = rim.colour;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.stroke(path);
  ctx.restore();
}

/**
 * Local point of a mark. Body marks move onto the look's torso (torsoPoint).
 * Tail marks interpolate the drawn tail polyline at `t` (0 root, 1 tip) and
 * sit `offset` x the local core half-height off the centre line, so they ride
 * the tail wave. `tail` is the painted tailSamples() of the look.
 */
export function markPoint(m: MorphMark, tail: readonly TailSample[], torso: BodyEllipse): [number, number] {
  if (m.space === 'body') {
    const p = torsoPoint(torso, m.x, m.y);
    return [p.x, p.y];
  }
  const f = Math.min(1, Math.max(0, m.t)) * TAIL_SEGMENTS;
  const i = Math.min(Math.floor(f), TAIL_SEGMENTS - 1);
  const u = f - i;
  const a = tail[i];
  const b = tail[i + 1];
  const cy = a.cy + (b.cy - a.cy) * u;
  const hc = a.hc + (b.hc - a.hc) * u;
  return [a.x + (b.x - a.x) * u, cy + m.offset * hc];
}

/** Round dots (Wild speckles and flecks), clipped to the silhouette. */
function paintMorphDots(
  ctx: CanvasRenderingContext2D,
  sil: Path2D,
  tail: readonly TailSample[],
  torso: BodyEllipse,
  set: MorphMarkSet,
): void {
  const dots = new Path2D();
  for (const m of set.marks) {
    const [x, y] = markPoint(m, tail, torso);
    ell(dots, x, y, m.r, m.r);
  }
  ctx.save();
  ctx.clip(sil);
  ctx.fillStyle = set.colour;
  ctx.fill(dots);
  ctx.restore();
}

/**
 * Four-point glints (guide 4e star: outer R, inner 0.38 R) with no outline,
 * clipped to the silhouette. Tip rounding (0.15 R) is under half a pixel at the
 * guide's R of 2, so tips stay sharp.
 */
function paintMorphShimmer(
  ctx: CanvasRenderingContext2D,
  sil: Path2D,
  tail: readonly TailSample[],
  torso: BodyEllipse,
  set: MorphMarkSet,
): void {
  const stars = new Path2D();
  for (const m of set.marks) {
    const [x, y] = markPoint(m, tail, torso);
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      const rad = k % 2 === 0 ? m.r : m.r * 0.38;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (k === 0) stars.moveTo(px, py);
      else stars.lineTo(px, py);
    }
    stars.closePath();
  }
  ctx.save();
  ctx.clip(sil);
  ctx.fillStyle = set.colour;
  ctx.fill(stars);
  ctx.restore();
}

/** Body shine colour: the prototype value unless the morph overrides the alpha. */
function bodyShineColour(extras: MorphExtras | undefined): string {
  const a = extras?.shineAlpha;
  return a === undefined ? BODY_SHINE : `rgba(255,255,255,${a})`;
}

/** Prototype body shine (guide 6g), placed on the prototype torso. */
const BODY_SHINE_ELL = { x: -16, y: -9, rx: 12, ry: 3, rot: -0.08 } as const;

/**
 * Paint leg `index` (leg draw order, see AXO_LEG_ROOTS) of `look` at `angle`
 * (legAngles), layers 2 and 3: the inked leg when `legLook` is undefined or
 * present, the faint ghost when lost, and the ghost plus the growing leg while
 * regrowing. The far pair (0, 1) takes the far-side colour. No Socks or Feet.
 */
export function paintAxolotlLeg(
  ctx: CanvasRenderingContext2D,
  look: AxolotlArtLook,
  index: number,
  angle: number,
  legLook: LegLook | undefined,
  palette: MorphPalette,
): void {
  const geo = axolotlBodyGeometry(look);
  const { x, y } = geo.legRoots[index];
  const len = geo.legLengths[index];
  const toeLen = geo.toeLength;
  const colour = index < 2 ? palette.farSide : palette.body;
  if (!legLook || legLook.status === 'present') {
    leg(ctx, x, y, angle, len, toeLen, colour);
  } else if (legLook.status === 'lost') {
    legGhost(ctx, x, y, angle, len, toeLen, GHOST_ALPHA_LOST);
  } else {
    const pr = legProgress(legLook);
    legGhost(ctx, x, y, angle, len, toeLen, GHOST_ALPHA_REGROW);
    if (pr >= LEG_FILL_MIN) leg(ctx, x, y, angle, len, toeLen, colour, pr);
  }
}

/**
 * Which of layers 4 to 8 paintBodyLayers paints: 'all' of them; 'under',
 * layers 4 to 6.2 (silhouette, fin bands and rays, belly, morph rim and
 * speckles), stopping before the 6.5 Dream block; 'over', only what follows
 * the Dream pattern (the Dream rim and marker, shines, flecks and shimmer,
 * spots). 'under', the pattern, then 'over' paint as 'all'.
 */
export type BodyLayers = 'all' | 'under' | 'over';

/**
 * Paint layers 4 to 8 of drawAxolotl: the merged silhouette, fin bands and
 * rays, belly, morph rim and speckles, the Dream overlay, shines, flecks and
 * shimmer, then spots. No Wearable: the Shirt (9.3) and Tail (9.2) items paint
 * over the near gills. `layers` (default 'all') paints only the 'under' or
 * 'over' part (BodyLayers).
 */
export function paintBodyLayers(
  ctx: CanvasRenderingContext2D,
  pose: AxolotlPose,
  palette: MorphPalette,
  look: AxolotlArtLook,
  layers: BodyLayers = 'all',
): void {
  const swim = pose.swimPhase;
  const extras = palette.extras;
  const geo = axolotlBodyGeometry(look);

  // tail geometry
  const tail = tailSamples(geo.tail, swim, pose.tailAmp);
  const topC: [number, number][] = [];
  const topF: [number, number][] = [];
  const botC: [number, number][] = [];
  const botF: [number, number][] = [];
  for (const tp of tail) {
    topC.push([tp.x, tp.cy - tp.hc]);
    topF.push([tp.x, tp.cy - tp.hc - tp.finTop]);
    botC.push([tp.x, tp.cy + tp.hc]);
    botF.push([tp.x, tp.cy + tp.hc + tp.finBottom]);
  }
  const N = TAIL_SEGMENTS;
  const { torso, belly } = geo;

  // 4. merged silhouette: tail + torso + head as one blob
  const sil = new Path2D();
  sil.moveTo(topF[N][0], topF[N][1]);
  for (let i = N; i >= 0; i--) sil.lineTo(topF[i][0], topF[i][1]);
  for (let i = 0; i <= N; i++) sil.lineTo(botF[i][0], botF[i][1]);
  sil.closePath();
  ell(sil, torso.cx, torso.cy, torso.rx, torso.ry);
  ell(sil, HEAD_ELLIPSE.cx, HEAD_ELLIPSE.cy, HEAD_ELLIPSE.rx, HEAD_ELLIPSE.ry);
  const i0 = geo.tail.finStart;
  let p: Path2D;
  if (layers !== 'over') {
    blob(ctx, sil, palette.body, LW);

    // 5. fin bands, fin rays, core edge (from the look's fin start: nearer the body on a Boy)
    const bandT = new Path2D();
    const bandB = new Path2D();
    bandT.moveTo(topC[i0][0], topC[i0][1]);
    bandB.moveTo(botC[i0][0], botC[i0][1]);
    for (let i = i0 + 1; i <= N; i++) {
      bandT.lineTo(topC[i][0], topC[i][1]);
      bandB.lineTo(botC[i][0], botC[i][1]);
    }
    for (let i = N; i >= i0; i--) {
      bandT.lineTo(topF[i][0], topF[i][1]);
      bandB.lineTo(botF[i][0], botF[i][1]);
    }
    bandT.closePath();
    bandB.closePath();
    ctx.fillStyle = palette.fin;
    ctx.fill(bandT);
    ctx.fill(bandB);

    const rays = new Path2D();
    for (const ri of [5, 8, 11]) {
      rays.moveTo(topC[ri][0], topC[ri][1]);
      rays.lineTo(topF[ri][0], topF[ri][1]);
      rays.moveTo(botC[ri][0], botC[ri][1]);
      rays.lineTo(botF[ri][0], botF[ri][1]);
    }
    for (let i = i0; i <= N; i++) {
      if (i === i0) rays.moveTo(topC[i][0], topC[i][1]);
      else rays.lineTo(topC[i][0], topC[i][1]);
    }
    for (let i = i0; i <= N; i++) {
      if (i === i0) rays.moveTo(botC[i][0], botC[i][1]);
      else rays.lineTo(botC[i][0], botC[i][1]);
    }
    if (extras?.finRays !== null) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = extras?.finRays ?? FIN_RAY;
      ctx.stroke(rays);
    }

    // 6. belly
    p = new Path2D();
    ell(p, belly.cx, belly.cy, belly.rx, belly.ry, 0.03);
    ctx.fillStyle = palette.belly;
    ctx.fill(p);

    // 6.2 morph rim light and speckles (clipped to the silhouette, under the shines); a Dream rim paints at 6.5
    if (extras?.rim && !palette.dream) paintMorphRim(ctx, sil, topF, extras.rim.fin ? N : i0, torso, extras.rim);
    if (extras?.speckles) paintMorphDots(ctx, sil, tail, torso, extras.speckles);
  }
  if (layers === 'under') return;

  // 6.5 Dream overlay (guide 6p): pattern, then the rim light (top fin edge included), then the Dream marker
  if (palette.dream) {
    if (layers === 'all') paintDreamPattern(ctx, sil, { id: palette.dream.id, torso, tail, sheen: pose.sheen });
    if (extras?.rim) paintMorphRim(ctx, sil, topF, extras.rim.fin ? N : i0, torso, extras.rim);
    paintDreamMarker(ctx, dreamMarkerCentres(tail));
  }

  // 7. shines (body, head); the body shine moves onto the look's torso
  if (extras?.shineAlpha !== 0) {
    const shine = torsoPoint(torso, BODY_SHINE_ELL.x, BODY_SHINE_ELL.y);
    p = new Path2D();
    ell(p, shine.x, shine.y, BODY_SHINE_ELL.rx * torsoBackScale(torso), BODY_SHINE_ELL.ry, BODY_SHINE_ELL.rot);
    ctx.fillStyle = bodyShineColour(extras);
    ctx.fill(p);
    p = new Path2D();
    ell(p, 17, -16, 7, 2.8, -0.35);
    ctx.fill(p);
  }

  // 7.5 morph flecks and shimmer glints (over the shines)
  if (extras?.flecks) paintMorphDots(ctx, sil, tail, torso, extras.flecks);
  if (extras?.shimmer) paintMorphShimmer(ctx, sil, tail, torso, extras.shimmer);

  // 8. spots (spot colour per morph, guide 3b; the player's Spots option, guide 6n)
  const spot = extras?.spot === undefined ? FRECKLE : extras.spot;
  if (spot !== null) paintSpots(ctx, look.spots, swim, pose.tailAmp, spot, geo.tail, torso);
}

/**
 * Paint layers 9.3 to 11.5 of drawAxolotl, which sit over the near gills and
 * the Tail item (9.2): the Shirt, Neck and Back items, blush, a Girl's cheek
 * heart, the Head item, the mouth, then the Face item.
 */
export function paintFaceLayers(
  ctx: CanvasRenderingContext2D,
  pose: AxolotlPose,
  palette: MorphPalette,
  look: AxolotlArtLook,
  outfit: ArtOutfit,
): void {
  const swim = pose.swimPhase;
  const extras = palette.extras;

  // 9.3 Shirt item (guide 6i): over the near gills, so they never hide it
  paintBodyWearable(ctx, 'shirt', outfit, look, swim, pose.tailAmp);

  // 9.5 Neck item, 9.7 Back item: from the body out, over the Shirt and the near gills
  paintBodyWearable(ctx, 'neck', outfit, look, swim, pose.tailAmp);
  paintBodyWearable(ctx, 'back', outfit, look, swim, pose.tailAmp);

  // 10. blush
  if (extras?.blush !== false) {
    const p = new Path2D();
    ell(p, 27, 9, 5, 3.3);
    ell(p, 44, 8, 4, 2.7);
    ctx.fillStyle = BLUSH;
    ctx.fill(p);
  }

  // 10.2 cheek heart: the Girl cue, off with the blush (the Collection Book silhouette)
  if (look.sex === 'girl' && extras?.blush !== false) paintCheekHeart(ctx);

  // 10.5 Head item
  paintBodyWearable(ctx, 'head', outfit, look, swim, pose.tailAmp);

  // 11. mouth
  paintMouth(ctx, look.mouth, palette.mouth);

  // 11.5 Face item (below the eyes on purpose: no Face item can cover them)
  paintBodyWearable(ctx, 'face', outfit, look, swim, pose.tailAmp);
}

/** Paint layer 12 of drawAxolotl: both eyes at eye height `blink`, far then near. */
export function paintEyes(
  ctx: CanvasRenderingContext2D,
  look: AxolotlArtLook,
  blink: number,
  palette: MorphPalette,
): void {
  // 12. eyes, far then near, so the near bead covers any far lash that reaches it (the Girl cue adds lashes)
  const extras = palette.extras;
  const eyelashes = look.sex === 'girl';
  paintEye(ctx, look.eyes, FAR_EYE, blink, palette.eye, extras?.eyeRing, eyelashes);
  paintEye(ctx, look.eyes, NEAR_EYE, blink, palette.eye, extras?.eyeRing, eyelashes);
}

/** Paint the top layer of drawAxolotl: the tail regeneration glints, then the leg-regrowth glints. */
export function paintAxolotlGlints(ctx: CanvasRenderingContext2D, pose: AxolotlPose, look: AxolotlArtLook): void {
  const geo = axolotlBodyGeometry(look);
  paintRegenGlints(ctx, geo.tail, pose);
  if (pose.legs) paintLegGlints(ctx, pose, geo.legRoots, legAngles(pose.swimPhase), geo.legLengths);
}

/**
 * Paint the axolotl in local units, facing right, origin at local (0, 0).
 * The caller sets the transform (see AXO_TEX for the frame). `look` picks the
 * creator parts (guide 6l to 6n) and the body proportions (Boy or girl, Tail,
 * Body, Age). Size is not painted here: the caller bakes and scales by
 * AXO_SIZE_SCALE (guide 6o).
 *
 * `outfit` is what the axolotl wears (guide 6a, 6i), none by default, and then
 * the painter makes exactly the calls it made before Wearables. Wearables paint
 * at their layers: Socks and Feet with their leg behind the silhouette (the Sock
 * first, then the Feet item), then, over the near gills (9), the Tail (9.2),
 * Shirt (9.3), Neck (9.5), Back (9.7), Head (10.5) and Face (11.5) items. Eyes
 * (layer 12) still paint last.
 * A leg wears its Socks and Feet only while its status is 'present', so a lost
 * or regrowing leg is the bare ghost; a Shirt never reads the leg state.
 */
export function drawAxolotl(
  ctx: CanvasRenderingContext2D,
  pose: AxolotlPose,
  palette: MorphPalette = LEUCISTIC,
  look: AxolotlArtLook = DEFAULT_ART_LOOK,
  outfit: ArtOutfit = NO_OUTFIT,
): void {
  const swim = pose.swimPhase;
  const tfl = pose.gillPhase;
  const geo = axolotlBodyGeometry(look);

  // 1. far gills (behind everything)
  paintGills(ctx, 'far', look.gills, tfl, palette.gillFarStem, palette.gillFarFilament, geo.gillLength);

  // 2-3. legs behind the body: far pair darker, then near pair
  // Order matches AXO_LEG_ROOTS: far-front, far-rear, near-front, near-rear.
  const legAng = legAngles(swim);
  // Socks and Feet (layers 2.5 far, 3.5 near): only on a present leg, after both legs of their side are painted.
  const legFrames = wearsOnLegs(outfit) ? legSlotFrames(look, swim) : null;
  const wearLegs = (first: number, last: number): void => {
    if (!legFrames) return;
    for (let i = first; i <= last; i++) {
      const status = pose.legs?.[i]?.status ?? 'present';
      if (status === 'present') paintLegWearables(ctx, outfit, legFrames[i]);
    }
  };
  for (let i = 0; i < 4; i++) {
    paintAxolotlLeg(ctx, look, i, legAng[i], pose.legs?.[i], palette);
    if (i === 1) wearLegs(0, 1);
    if (i === 3) wearLegs(2, 3);
  }

  // 4 to 8: silhouette, fins, belly, morph and Dream layers, shines, spots
  paintBodyLayers(ctx, pose, palette, look);

  // 9. near gills (in front of the body, sprouting from the cheek)
  paintGills(ctx, 'near', look.gills, tfl, palette.gillNearStem, palette.gillNearFilament, geo.gillLength);

  // 9.2 Tail item (guide 6i): over the near gills, so they never hide it
  paintBodyWearable(ctx, 'tail', outfit, look, swim, pose.tailAmp);

  // 9.3 to 11.5: Shirt, Neck and Back items, blush, cheek heart, Head item, mouth, Face item
  paintFaceLayers(ctx, pose, palette, look, outfit);

  // 12. eyes
  paintEyes(ctx, look, pose.blink, palette);

  // regeneration glints sit on top of everything
  paintAxolotlGlints(ctx, pose, look);
}
