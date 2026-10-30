/**
 * Dream colour overlay on the axolotl body (guide 6a layer 6.5, 3f, 4e, 6p, 9):
 * the pattern, clipped to the silhouette and fin fill (inset 2 on Hearts,
 * Tie-dye and Iridescent) and to x <= 14 so the face keeps the plain Dream
 * body colour, plus the Dream marker on the top fin. The rim light is the
 * morph rim painter in drawAxolotl. Local units, facing right.
 * Presentational only: no game state, no Phaser, no randomness.
 */
import { ell, shape } from './canvasKit';
import {
  TAIL_SEGMENTS,
  HEAD_ELLIPSE,
  torsoBackScale,
  torsoPoint,
  type BodyEllipse,
  type LocalPoint,
  type TailSample,
} from './drawAxolotlParts';
import { WHITE, type DreamLookId } from './palette';
import { DREAM_DIVIDER, DREAM_STAR, DREAM_SWATCH } from './treasurePalette';

/** Sheen glide period, seconds (guide 6p, 9): Iridescent and Crystal shine glide on the same beat. */
export const IRIDESCENT_GLIDE_S = 4;
/** Sheen stripe x under reduced motion (guide 6p, 9). */
export const IRIDESCENT_STILL_X = -10;
/** The pattern paints only where x <= this, so the face keeps the plain Dream body colour (guide 6p). */
export const DREAM_FACE_LIMIT_X = 14;
/** Clip inset from the silhouette and fin edges on DREAM_INSET_IDS (guide 6p). */
export const DREAM_PATTERN_INSET = 2;
/** Dream colours whose pattern clip is inset, so the colour next to the ink is always the body (guide 6p). */
export const DREAM_INSET_IDS: readonly DreamLookId[] = ['hearts', 'tie-dye', 'iridescent'];

/** Dream marker (guide 4e, 6p): three 4-point stars on the top fin band at these tail points. */
export const DREAM_MARKER_S: readonly number[] = [0.55, 0.68, 0.81];
/** Dream marker star outer radius. */
export const DREAM_MARKER_R = 2.6;
/** Dream marker ink width (guide 4e: 1.6 below R 6). */
export const DREAM_MARKER_INK = 1.6;

/** 4-point star inner radius over outer radius (guide 4e). */
const STAR_INNER = 0.38;
/** Divider width between Rainbow and Tie-dye bands (guide 3f). */
const DIVIDER_W = 1.2;
/** Points round each ellipse of the clip polygons. */
const ELLIPSE_STEPS = 96;
/** Float slack when checking that an inset tail point holds the inset. */
const INSET_SLACK = 1e-9;
/** Half-length of the long band and stripe quads, far past every look's silhouette. */
const BAND_REACH = 120;
/** How far stripe and band ends run past the fin edge, so the clip trims them. */
const EDGE_OVERSHOOT = 2;

/** Hearts (guide 6p): 6 wide x 5.5 tall, rotated alternately +0.3 and -0.3 rad. */
const HEART_W = 6;
const HEART_H = 5.5;
const HEART_ROT = 0.3;
const HEARTS_BODY: readonly LocalPoint[] = [
  { x: -24, y: -7 },
  { x: -12, y: 6 },
  { x: -2, y: -10 },
  { x: 6, y: 15 },
];

/** A tail-space position (guide 6i): s along the drawn tail, v times the core half-height (+ is down). */
interface TailPlace {
  readonly s: number;
  readonly v: number;
}
const HEARTS_TAIL: readonly TailPlace[] = [
  { s: 0.25, v: 0.3 },
  { s: 0.5, v: -0.3 },
  { s: 0.75, v: 0.1 },
];

/** Tie-dye spiral (guide 6p): centred (-10, 3) on the prototype torso, 2 turns, outer radius about 18, bands 5 wide. */
const SPIRAL_CENTRE: LocalPoint = { x: -10, y: 3 };
const SPIRAL_TURNS = 2;
const SPIRAL_OUTER_R = 18;
const SPIRAL_BAND_W = 5;
/** Spiral points per half-turn (one band colour per half-turn). */
const SPIRAL_STEPS_PER_HALF_TURN = 12;
/** Tie-dye tail stripes (guide 6p): one band every 0.12 of s. */
const STRIPE_STEP = 0.12;
/** How far along s each tail stripe's top end leans toward the tip. Derived (provisional). */
const STRIPE_SLANT = 0.04;

/** Sheen stripe pair (guide 6p): a light stripe 5 wide, a 2-unit gap, then a tint stripe 3 wide, slanted 45 degrees (Iridescent: white, then #8f7fe0). */
const IRIDESCENT_WHITE_W = 5;
const IRIDESCENT_GAP = 2;
const IRIDESCENT_TINT_W = 3;

/** Galaxy (guide 6p). Nebula radii; the body nebula's x radius stretches with the torso back end, as the body shine. */
const GALAXY_NEBULA_BODY = { x: -14, y: 0, rx: 14, ry: 8, rot: -0.2 } as const;
const GALAXY_NEBULA_TAIL = { s: 0.45, v: 0, rx: 10, ry: 6 } as const;
const GALAXY_STARS_BODY: readonly (LocalPoint & { readonly r: number })[] = [
  { x: -26, y: -8, r: 3 },
  { x: -16, y: 8, r: 2 },
  { x: -6, y: -6, r: 2.4 },
  { x: 4, y: 10, r: 1.8 },
];
const GALAXY_STARS_TAIL: readonly (TailPlace & { readonly r: number })[] = [
  { s: 0.1, v: -0.3, r: 2 },
  { s: 0.2, v: -0.4, r: 2.2 },
  { s: 0.35, v: 0.3, r: 1.6 },
  { s: 0.5, v: -0.2, r: 2.6 },
  { s: 0.65, v: 0.35, r: 1.8 },
  { s: 0.8, v: -0.1, r: 2 },
];
/** Galaxy dot radius (guide 6p). */
const GALAXY_DOT_R = 0.8;
/**
 * Derived (provisional): guide 6p asks for four dots between the stars but
 * gives no positions. Two body dots midway between body star pairs, two tail
 * dots between tail stars.
 */
const GALAXY_DOTS_BODY: readonly LocalPoint[] = [
  { x: -21, y: 0 },
  { x: -1, y: 2 },
];
const GALAXY_DOTS_TAIL: readonly TailPlace[] = [
  { s: 0.27, v: 0 },
  { s: 0.72, v: 0.1 },
];
/**
 * Glowworm (glow dots): a glowworm cave roof of round glowing dots with soft halos, no stars. Derived (provisional):
 * body points are prototype torso points moved by torsoPoint, tail points ride the painted tail (s, v) like Galaxy's.
 * Core radii 0.8 to 1.9; every dot sits at least its halo radius inside the silhouette on every look.
 */
const GLOW_DOTS_BODY: readonly (LocalPoint & { readonly r: number })[] = [
  { x: -30, y: 0, r: 1.3 },
  { x: -22, y: -7, r: 1.6 },
  { x: -20, y: 8, r: 1.1 },
  { x: -12, y: -2, r: 1.9 },
  { x: -9, y: 10, r: 1.4 },
  { x: -1, y: -8, r: 1.2 },
  { x: 1, y: 3, r: 1.6 },
  { x: 8, y: 9, r: 1.3 },
  { x: 9, y: -5, r: 1.5 },
];
const GLOW_DOTS_TAIL: readonly (TailPlace & { readonly r: number })[] = [
  { s: 0.12, v: -0.35, r: 1.3 },
  { s: 0.24, v: 0.4, r: 1.1 },
  { s: 0.36, v: -0.2, r: 1.5 },
  { s: 0.48, v: 0.35, r: 1 },
  { s: 0.6, v: -0.3, r: 1.2 },
  { s: 0.72, v: 0.15, r: 0.9 },
  { s: 0.84, v: -0.1, r: 0.8 },
];
/** Glow dot halo radius over core radius. */
export const GLOW_HALO_SCALE = 2.2;

/**
 * Derived (provisional): guide 6p asks for six stars, R 1.6 to 2.6, in the
 * Tie-dye galaxy spiral gaps but gives no positions. Prototype torso points
 * midway between spiral turns (and one past the outer turn, toward the tail).
 */
const TIE_DYE_GALAXY_STARS: readonly (LocalPoint & { readonly r: number })[] = [
  { x: -5.1, y: 3, r: 1.6 },
  { x: -10, y: 10.1, r: 1.8 },
  { x: -19.3, y: 3, r: 2 },
  { x: -10, y: -8.4, r: 2.2 },
  { x: 3.6, y: 3, r: 2.4 },
  { x: -28.1, y: 3, r: 2.6 },
];

/** One clip polygon in local units. */
export type DreamPolygon = readonly (readonly [number, number])[];

/** One piece of a Dream pattern in local units. Fills have no outline. */
export type DreamShape =
  | {
      readonly kind: 'heart';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly rot: number;
      readonly fill: string;
    }
  | { readonly kind: 'star'; readonly x: number; readonly y: number; readonly r: number; readonly fill: string }
  | { readonly kind: 'dot'; readonly x: number; readonly y: number; readonly r: number; readonly fill: string }
  | {
      readonly kind: 'ellipse';
      readonly x: number;
      readonly y: number;
      readonly rx: number;
      readonly ry: number;
      readonly rot: number;
      readonly fill: string;
    }
  | { readonly kind: 'polygon'; readonly points: DreamPolygon; readonly fill: string }
  | { readonly kind: 'line'; readonly points: DreamPolygon; readonly width: number; readonly stroke: string };

/**
 * True for the sheen Dream colours (Iridescent, Crystal shine): exactly the ones whose swatch pattern is 'stripes'.
 * A sheen glides its stripe pair along the body (dreamSheenAt, iridescentStripeX) instead of holding a static pattern.
 */
export function isSheenDream(id: DreamLookId): boolean {
  return DREAM_SWATCH[id].pattern === 'stripes';
}

/** What paintDreamPattern needs: the Dream colour, the look's torso, the painted tail samples and the sheen phase. */
export interface DreamPatternArgs {
  readonly id: DreamLookId;
  readonly torso: BodyEllipse;
  readonly tail: readonly TailSample[];
  /** Sheen phase in [0, 1) (dreamSheenAt), read by the sheen colours (isSheenDream); undefined holds the reduced-motion still stripe. */
  readonly sheen?: number;
}

/** Sheen phase in [0, 1) at `seconds`; one glide every IRIDESCENT_GLIDE_S. */
export function dreamSheenAt(seconds: number): number {
  const turns = seconds / IRIDESCENT_GLIDE_S;
  return turns - Math.floor(turns);
}

/** Sheen stripe x (any sheen colour): x 14 at sheen 0, gliding to the tail tip; IRIDESCENT_STILL_X when sheen is undefined. */
export function iridescentStripeX(sheen: number | undefined, tailTipX: number): number {
  if (sheen === undefined) return IRIDESCENT_STILL_X;
  return DREAM_FACE_LIMIT_X + sheen * (tailTipX - DREAM_FACE_LIMIT_X);
}

/** A tail point interpolated (and past the ends, extrapolated) along the painted samples at s. */
interface TailSpot {
  readonly x: number;
  readonly cy: number;
  readonly hc: number;
  readonly finTop: number;
  readonly finBottom: number;
  /** Slope angle of the tail centre line, in (-pi/2, pi/2). */
  readonly angle: number;
}

function tailSpotAt(tail: readonly TailSample[], s: number): TailSpot {
  const f = s * TAIL_SEGMENTS;
  const i = Math.min(Math.max(Math.floor(f), 0), TAIL_SEGMENTS - 1);
  const u = f - i;
  const a = tail[i];
  const b = tail[i + 1];
  const mix = (p: number, q: number): number => p + (q - p) * u;
  return {
    x: mix(a.x, b.x),
    cy: mix(a.cy, b.cy),
    hc: mix(a.hc, b.hc),
    finTop: mix(a.finTop, b.finTop),
    finBottom: mix(a.finBottom, b.finBottom),
    angle: Math.atan((b.cy - a.cy) / (b.x - a.x)),
  };
}

function tailPlacePoint(tail: readonly TailSample[], place: TailPlace): LocalPoint {
  const spot = tailSpotAt(tail, place.s);
  return { x: spot.x, y: spot.cy + place.v * spot.hc };
}

function ellipsePolygon(e: BodyEllipse): [number, number][] {
  return Array.from({ length: ELLIPSE_STEPS }, (_, k): [number, number] => {
    const a = (k / ELLIPSE_STEPS) * Math.PI * 2;
    return [e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)];
  });
}

/**
 * Tail and fins as painted in layer 4: the top fin edge from tip to root, then
 * the bottom fin edge from root to tip.
 */
function tailPolygon(tail: readonly TailSample[]): [number, number][] {
  const top = tail.map((tp): [number, number] => [tp.x, tp.cy - tp.hc - tp.finTop]).reverse();
  const bottom = tail.map((tp): [number, number] => [tp.x, tp.cy + tp.hc + tp.finBottom]);
  return [...top, ...bottom];
}

function signedArea(poly: DreamPolygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/** Unit normal of edge a to b, toward the inside of a polygon of orientation `side` (sign of its signed area). */
function inwardNormal(a: readonly [number, number], b: readonly [number, number], side: number): [number, number] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(side * -(b[1] - a[1])) / len, (side * (b[0] - a[0])) / len];
}

/** Every edge moved `d` along its inward normal; each vertex is the mitre of its two moved edges. */
function insetPolygon(poly: DreamPolygon, d: number): [number, number][] {
  if (d === 0) return poly.map(([x, y]): [number, number] => [x, y]);
  const side = Math.sign(signedArea(poly));
  const n = poly.length;
  return poly.map(([x, y], i): [number, number] => {
    const n1 = inwardNormal(poly[(i - 1 + n) % n], poly[i], side);
    const n2 = inwardNormal(poly[i], poly[(i + 1) % n], side);
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [x + (n1[0] + n2[0]) * k, y + (n1[1] + n2[1]) * k];
  });
}

/** The part of a polygon with x <= limit (Sutherland-Hodgman against one half-plane). */
function clipLeftOf(poly: DreamPolygon, limit: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const aIn = ax <= limit;
    const bIn = bx <= limit;
    if (aIn) out.push([ax, ay]);
    if (aIn !== bIn) out.push([limit, ay + ((by - ay) * (limit - ax)) / (bx - ax)]);
  }
  return out;
}

function isInPolygon(x: number, y: number, poly: DreamPolygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from (x, y) to the nearest edge of `poly`. */
function edgeDistance(x: number, y: number, poly: DreamPolygon): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

/**
 * The tail polygon shrunk by `inset`. A kept point is inside the tail and
 * `inset` or more from every tail edge, or inside `torsoInset` (the root sits
 * in the torso). On a strongly waved tail the fin corners near the tip are too
 * sharp to hold the inset, so points that fail drop from both fin edges, from
 * the nearer end in.
 */
function insetTailPolygon(tail: readonly TailSample[], inset: number, torsoInset: DreamPolygon): [number, number][] {
  const outline = tailPolygon(tail);
  const poly = insetPolygon(outline, inset);
  if (inset === 0) return poly;
  const last = poly.length - 1;
  let trim = 0;
  poly.forEach(([x, y], i) => {
    const inTail = isInPolygon(x, y, outline) && edgeDistance(x, y, outline) >= inset - INSET_SLACK;
    if (!inTail && !isInPolygon(x, y, torsoInset)) trim = Math.max(trim, Math.min(i, last - i) + 1);
  });
  return poly.slice(trim, poly.length - trim);
}

/**
 * Clip polygons whose union is the silhouette (head ellipse, the look's torso,
 * tail plus fins) shrunk by `inset`, cut at x <= DREAM_FACE_LIMIT_X, in that
 * order. Edges move along their normals. Every polygon winds the same way as
 * the layer 4 silhouette, so their nonzero union has no holes.
 */
export function dreamClipPolygons(torso: BodyEllipse, tail: readonly TailSample[], inset: number): DreamPolygon[] {
  const head = insetPolygon(ellipsePolygon(HEAD_ELLIPSE), inset);
  const body = insetPolygon(ellipsePolygon(torso), inset);
  return [head, body, insetTailPolygon(tail, inset, body)]
    .map((poly) => clipLeftOf(poly, DREAM_FACE_LIMIT_X))
    .filter((poly) => poly.length >= 3);
}

function bodyPoint(torso: BodyEllipse, p: LocalPoint): LocalPoint {
  return torsoPoint(torso, p.x, p.y);
}

function heartShapes(torso: BodyEllipse, tail: readonly TailSample[], fill: string): DreamShape[] {
  const centres = [...HEARTS_BODY.map((p) => bodyPoint(torso, p)), ...HEARTS_TAIL.map((p) => tailPlacePoint(tail, p))];
  return centres.map(
    (c, k): DreamShape => ({
      kind: 'heart',
      x: c.x,
      y: c.y,
      w: HEART_W,
      h: HEART_H,
      rot: k % 2 === 0 ? HEART_ROT : -HEART_ROT,
      fill,
    }),
  );
}

/** Point on the prototype-torso spiral at angle a (radians from its start), moved onto `torso`. */
function spiralPoint(torso: BodyEllipse, a: number, radialOffset = 0): [number, number] {
  const r = (SPIRAL_OUTER_R * a) / (SPIRAL_TURNS * Math.PI * 2) + radialOffset;
  const p = torsoPoint(torso, SPIRAL_CENTRE.x + r * Math.cos(a), SPIRAL_CENTRE.y + r * Math.sin(a));
  return [p.x, p.y];
}

/** The torso spiral: one band colour per half-turn, cycling `colours`, with a divider across each colour change. */
function spiralShapes(torso: BodyEllipse, colours: readonly string[]): DreamShape[] {
  const halfTurns = SPIRAL_TURNS * 2;
  const bands: DreamShape[] = [];
  const dividers: DreamShape[] = [];
  for (let h = 0; h < halfTurns; h++) {
    const points = Array.from({ length: SPIRAL_STEPS_PER_HALF_TURN + 1 }, (_, k) =>
      spiralPoint(torso, Math.PI * (h + k / SPIRAL_STEPS_PER_HALF_TURN)),
    );
    bands.push({ kind: 'line', points, width: SPIRAL_BAND_W, stroke: colours[h % colours.length] });
    if (h === 0) continue;
    const a = Math.PI * h;
    const half = SPIRAL_BAND_W / 2;
    dividers.push({
      kind: 'line',
      points: [spiralPoint(torso, a, -half), spiralPoint(torso, a, half)],
      width: DIVIDER_W,
      stroke: DREAM_DIVIDER,
    });
  }
  return [...bands, ...dividers];
}

/** Top (over the top fin edge) and bottom (under the bottom fin edge) points of the tail at s. */
function tailSpan(tail: readonly TailSample[], s: number): { top: [number, number]; bottom: [number, number] } {
  const spot = tailSpotAt(tail, s);
  return {
    top: [spot.x, spot.cy - spot.hc - spot.finTop - EDGE_OVERSHOOT],
    bottom: [spot.x, spot.cy + spot.hc + spot.finBottom + EDGE_OVERSHOOT],
  };
}

/** Tail stripes every STRIPE_STEP of s, top ends leaning toward the tip, cycling `colours`, with dividers. */
function tailStripeShapes(tail: readonly TailSample[], colours: readonly string[]): DreamShape[] {
  const count = Math.ceil(1 / STRIPE_STEP);
  const stripes: DreamShape[] = [];
  const dividers: DreamShape[] = [];
  for (let k = 0; k < count; k++) {
    const s0 = k * STRIPE_STEP;
    const s1 = s0 + STRIPE_STEP;
    const near = { bottom: tailSpan(tail, s0).bottom, top: tailSpan(tail, s0 + STRIPE_SLANT).top };
    const far = { bottom: tailSpan(tail, s1).bottom, top: tailSpan(tail, s1 + STRIPE_SLANT).top };
    const fill = colours[k % colours.length];
    stripes.push({ kind: 'polygon', points: [near.top, far.top, far.bottom, near.bottom], fill });
    if (k === 0) continue;
    dividers.push({ kind: 'line', points: [near.bottom, near.top], width: DIVIDER_W, stroke: DREAM_DIVIDER });
  }
  return [...stripes, ...dividers];
}

/** A long quad slanted 45 degrees, rising toward the snout, between offsets `from` and `to` across it from (x, y). */
function slantedBand(x: number, y: number, from: number, to: number, fill: string): DreamShape {
  const along: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];
  const across: [number, number] = [Math.SQRT1_2, Math.SQRT1_2];
  const corner = (t: number, o: number): [number, number] => [
    x + along[0] * t + across[0] * o,
    y + along[1] * t + across[1] * o,
  ];
  return {
    kind: 'polygon',
    points: [corner(-BAND_REACH, from), corner(BAND_REACH, from), corner(BAND_REACH, to), corner(-BAND_REACH, to)],
    fill,
  };
}

/** The sheen stripe pair: the light stripe centred on the sheen x on the body axis, the tint stripe behind it. */
function sheenShapes(
  torso: BodyEllipse,
  tail: readonly TailSample[],
  sheen: number | undefined,
  colours: readonly string[],
): DreamShape[] {
  const x = iridescentStripeX(sheen, tail[TAIL_SEGMENTS].x);
  const halfWhite = IRIDESCENT_WHITE_W / 2;
  const tintNear = -halfWhite - IRIDESCENT_GAP;
  return [
    slantedBand(x, torso.cy, -halfWhite, halfWhite, colours[0]),
    slantedBand(x, torso.cy, tintNear - IRIDESCENT_TINT_W, tintNear, colours[1]),
  ];
}

/** Rainbow bands 2 to 6 split x 14 to this look's tail tip equally; dividers at every band boundary. */
function rainbowShapes(tail: readonly TailSample[], colours: readonly string[]): DreamShape[] {
  const tipX = tail[TAIL_SEGMENTS].x;
  const painted = colours.slice(1);
  const width = (DREAM_FACE_LIMIT_X - tipX) / painted.length;
  const bands: DreamShape[] = [];
  const dividers: DreamShape[] = [];
  painted.forEach((fill, k) => {
    const x0 = DREAM_FACE_LIMIT_X - k * width;
    const x1 = x0 - width;
    bands.push({
      kind: 'polygon',
      points: [
        [x0, -BAND_REACH],
        [x0, BAND_REACH],
        [x1, BAND_REACH],
        [x1, -BAND_REACH],
      ],
      fill,
    });
    // The band 1 to 2 divider sits just left of x 14, so the face clip keeps all of it.
    const dx = k === 0 ? x0 - DIVIDER_W / 2 : x0;
    dividers.push({
      kind: 'line',
      points: [
        [dx, -BAND_REACH],
        [dx, BAND_REACH],
      ],
      width: DIVIDER_W,
      stroke: DREAM_DIVIDER,
    });
  });
  return [...bands, ...dividers];
}

function starShape(p: LocalPoint, r: number): DreamShape {
  return { kind: 'star', x: p.x, y: p.y, r, fill: DREAM_STAR };
}

function galaxyShapes(torso: BodyEllipse, tail: readonly TailSample[], nebula: string): DreamShape[] {
  const body = bodyPoint(torso, GALAXY_NEBULA_BODY);
  const tailNebula = tailSpotAt(tail, GALAXY_NEBULA_TAIL.s);
  const tailNebulaCentre = tailPlacePoint(tail, GALAXY_NEBULA_TAIL);
  const dots = [
    ...GALAXY_DOTS_BODY.map((p) => bodyPoint(torso, p)),
    ...GALAXY_DOTS_TAIL.map((p) => tailPlacePoint(tail, p)),
  ];
  return [
    {
      kind: 'ellipse',
      x: body.x,
      y: body.y,
      rx: GALAXY_NEBULA_BODY.rx * torsoBackScale(torso),
      ry: GALAXY_NEBULA_BODY.ry,
      rot: GALAXY_NEBULA_BODY.rot,
      fill: nebula,
    },
    {
      kind: 'ellipse',
      x: tailNebulaCentre.x,
      y: tailNebulaCentre.y,
      rx: GALAXY_NEBULA_TAIL.rx,
      ry: GALAXY_NEBULA_TAIL.ry,
      rot: tailNebula.angle,
      fill: nebula,
    },
    ...GALAXY_STARS_BODY.map((p) => starShape(bodyPoint(torso, p), p.r)),
    ...GALAXY_STARS_TAIL.map((p) => starShape(tailPlacePoint(tail, p), p.r)),
    ...dots.map((p): DreamShape => ({ kind: 'dot', x: p.x, y: p.y, r: GALAXY_DOT_R, fill: DREAM_STAR })),
  ];
}

/** Glowworm: each glow dot as a soft halo then its bright core, back to front, so halos never cover a core. */
function glowDotShapes(torso: BodyEllipse, tail: readonly TailSample[], core: string, halo: string): DreamShape[] {
  const dots = [
    ...GLOW_DOTS_BODY.map((p) => ({ ...bodyPoint(torso, p), r: p.r })),
    ...GLOW_DOTS_TAIL.map((p) => ({ ...tailPlacePoint(tail, p), r: p.r })),
  ];
  return [
    ...dots.map((d): DreamShape => ({ kind: 'dot', x: d.x, y: d.y, r: d.r * GLOW_HALO_SCALE, fill: halo })),
    ...dots.map((d): DreamShape => ({ kind: 'dot', x: d.x, y: d.y, r: d.r, fill: core })),
  ];
}

/**
 * The guide 6p pattern of Dream colour `id` as shapes in local units, back to
 * front, before clipping. Body positions move onto the look's torso
 * (torsoPoint); tail positions ride the painted tail. Solids have no pattern.
 */
export function dreamPatternShapes(
  id: DreamLookId,
  torso: BodyEllipse,
  tail: readonly TailSample[],
  sheen: number | undefined,
): DreamShape[] {
  const marks = DREAM_SWATCH[id].marks;
  switch (DREAM_SWATCH[id].pattern) {
    case 'plain':
      return [];
    case 'hearts':
      return heartShapes(torso, tail, marks[0]);
    case 'spiral':
      return [...tailStripeShapes(tail, marks), ...spiralShapes(torso, marks)];
    case 'stripes':
      return sheenShapes(torso, tail, sheen, marks);
    case 'bands':
      return rainbowShapes(tail, marks);
    case 'stars':
      return galaxyShapes(torso, tail, marks[0]);
    case 'spiral-stars':
      return [
        ...tailStripeShapes(tail, marks),
        ...spiralShapes(torso, marks),
        ...TIE_DYE_GALAXY_STARS.map((p) => starShape(bodyPoint(torso, p), p.r)),
      ];
    case 'glow-dots':
      return glowDotShapes(torso, tail, marks[0], marks[1]);
  }
}

/** Dream marker star centres: tail points DREAM_MARKER_S, midway between the top core edge and the top fin edge. */
export function dreamMarkerCentres(tail: readonly TailSample[]): LocalPoint[] {
  return DREAM_MARKER_S.map((s) => {
    const spot = tailSpotAt(tail, s);
    return { x: spot.x, y: spot.cy - spot.hc - spot.finTop / 2 };
  });
}

/**
 * Concave 4-point star (guide 4e): outer radius r, inner 0.38 r. Tip rounding
 * (0.15 r) is under half a pixel up to R 3, so tips stay sharp.
 */
function star4Path(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    const rad = k % 2 === 0 ? r : r * STAR_INNER;
    if (k === 0) p.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    else p.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  p.closePath();
  return p;
}

/** Heart of width w and height h centred on (x, y), tip down before rotating by rot. */
function heartPath(x: number, y: number, w: number, h: number, rot: number): Path2D {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const at = (u: number, v: number): [number, number] => [
    x + u * w * cos - v * h * sin,
    y + u * w * sin + v * h * cos,
  ];
  const p = new Path2D();
  p.moveTo(...at(0, -0.28));
  p.bezierCurveTo(...at(-0.12, -0.5), ...at(-0.5, -0.5), ...at(-0.5, -0.12));
  p.bezierCurveTo(...at(-0.5, 0.2), ...at(-0.15, 0.35), ...at(0, 0.5));
  p.bezierCurveTo(...at(0.15, 0.35), ...at(0.5, 0.2), ...at(0.5, -0.12));
  p.bezierCurveTo(...at(0.5, -0.5), ...at(0.12, -0.5), ...at(0, -0.28));
  p.closePath();
  return p;
}

function appendPolyline(p: Path2D, points: DreamPolygon, closed: boolean): void {
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  if (closed) p.closePath();
}

function polylinePath(points: DreamPolygon, closed: boolean): Path2D {
  const p = new Path2D();
  appendPolyline(p, points, closed);
  return p;
}

function paintDreamShape(ctx: CanvasRenderingContext2D, s: DreamShape): void {
  if (s.kind === 'line') {
    ctx.lineWidth = s.width;
    ctx.strokeStyle = s.stroke;
    ctx.stroke(polylinePath(s.points, false));
    return;
  }
  let p: Path2D;
  if (s.kind === 'heart') p = heartPath(s.x, s.y, s.w, s.h, s.rot);
  else if (s.kind === 'star') p = star4Path(s.x, s.y, s.r);
  else if (s.kind === 'polygon') p = polylinePath(s.points, true);
  else {
    p = new Path2D();
    if (s.kind === 'dot') ell(p, s.x, s.y, s.r, s.r);
    else ell(p, s.x, s.y, s.rx, s.ry, s.rot);
  }
  ctx.fillStyle = s.fill;
  ctx.fill(p);
}

/** Half-plane x <= DREAM_FACE_LIMIT_X, as a path far larger than any look. */
function faceLimitPath(): Path2D {
  return polylinePath(
    [
      [DREAM_FACE_LIMIT_X, -BAND_REACH],
      [DREAM_FACE_LIMIT_X, BAND_REACH],
      [-BAND_REACH, BAND_REACH],
      [-BAND_REACH, -BAND_REACH],
    ],
    true,
  );
}

/**
 * Layer 6.5 pattern (guide 6p): clipped to the silhouette `sil`, then to the
 * inset clip polygons (inset 2 on DREAM_INSET_IDS, 0 otherwise), then to
 * x <= 14. Solids paint nothing.
 */
export function paintDreamPattern(ctx: CanvasRenderingContext2D, sil: Path2D, args: DreamPatternArgs): void {
  const shapes = dreamPatternShapes(args.id, args.torso, args.tail, args.sheen);
  if (shapes.length === 0) return;
  const inset = DREAM_INSET_IDS.includes(args.id) ? DREAM_PATTERN_INSET : 0;
  const clip = new Path2D();
  for (const poly of dreamClipPolygons(args.torso, args.tail, inset)) appendPolyline(clip, poly, true);
  ctx.save();
  ctx.clip(sil);
  ctx.clip(clip);
  ctx.clip(faceLimitPath());
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  for (const s of shapes) paintDreamShape(ctx, s);
  ctx.restore();
}

/** Dream marker (guide 4e, 6p): white 4-point stars, R 2.6, with opaque ink 1.6. */
export function paintDreamMarker(ctx: CanvasRenderingContext2D, centres: readonly LocalPoint[]): void {
  for (const c of centres) shape(ctx, star4Path(c.x, c.y, DREAM_MARKER_R), WHITE, DREAM_MARKER_INK);
}
