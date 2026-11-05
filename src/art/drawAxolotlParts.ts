/**
 * Axolotl face, gill and spot parts for the character creator (guide 6l to 6o),
 * so a preview can swap each part on its own (guide 11). The end of the file
 * holds the Wearable slot geometry (guide 6i): anchors, footprints and
 * keep-clear zones for the eight slots. drawAxolotl() paints
 * its eye, mouth, gill and spot layers through these painters, and reads the
 * body proportions (Boy or girl, Tail, Body, Age) from axolotlBodyGeometry().
 *
 * Geometry lives in pure helpers (no canvas needed) so tests can check the
 * keep-clear zones of guide 6i and the texture frame. Painters build paths
 * from the same helpers. Local units, facing right, as in drawAxolotl.ts.
 * Presentational only: no game state, no randomness.
 */
import { ell, inkMany, line, seg, shape, type Seg } from './canvasKit';
import { CHEEK_HEART, INK, WHITE, type MorphEyeRing } from './palette';

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

/** Eye variants (guide 6l). */
export type EyeVariant = 'happy' | 'sleepy' | 'determined' | 'curious' | 'grumpy';
/** Mouth variants (guide 6l). */
export type MouthVariant = 'smile' | 'openD' | 'tongueOut' | 'smallO' | 'bigGrin' | 'catSmile' | 'smirk' | 'tongueTip';
/** Gill styles (guide 6m). */
export type GillStyleId = 'fluffy' | 'long' | 'short';
/** Spot options (guide 6n). */
export type SpotsOption = 'none' | 'freckles' | 'dots' | 'patches';
/** Sizes (guide 6o). */
export type AxoSize = 'small' | 'medium' | 'large';
/** Boy or girl. */
export type AxoSex = 'boy' | 'girl';
/** Tail lengths. */
export type AxoTail = 'short' | 'medium' | 'long';
/** Body builds. */
export type AxoBody = 'slim' | 'regular' | 'chubby';
/** Ages: proportions only, never the size scale. */
export type AxoAge = 'baby' | 'young' | 'grownUp';

export const EYE_VARIANTS: readonly EyeVariant[] = ['happy', 'sleepy', 'determined', 'curious', 'grumpy'];
export const MOUTH_VARIANTS: readonly MouthVariant[] = [
  'smile',
  'openD',
  'tongueOut',
  'smallO',
  'bigGrin',
  'catSmile',
  'smirk',
  'tongueTip',
];
export const GILL_STYLE_IDS: readonly GillStyleId[] = ['fluffy', 'long', 'short'];
export const SPOTS_OPTIONS: readonly SpotsOption[] = ['none', 'freckles', 'dots', 'patches'];
export const AXO_SIZES: readonly AxoSize[] = ['small', 'medium', 'large'];
export const AXO_SEXES: readonly AxoSex[] = ['boy', 'girl'];
export const AXO_TAILS: readonly AxoTail[] = ['short', 'medium', 'long'];
export const AXO_BODIES: readonly AxoBody[] = ['slim', 'regular', 'chubby'];
export const AXO_AGES: readonly AxoAge[] = ['baby', 'young', 'grownUp'];

/**
 * The creator look the painter needs. Same field names and ids as the logic
 * look; art never imports logic, so scenes pass the values across.
 */
export interface AxolotlArtLook {
  readonly eyes: EyeVariant;
  readonly mouth: MouthVariant;
  readonly gills: GillStyleId;
  readonly spots: SpotsOption;
  readonly size: AxoSize;
  readonly sex: AxoSex;
  readonly tail: AxoTail;
  readonly body: AxoBody;
  readonly age: AxoAge;
}

/**
 * The starting look. Its face, gills, body and age are the prototype's, with Freckles;
 * as a Boy it carries the Boy cue (a longer tail, taller fins).
 */
export const DEFAULT_ART_LOOK: AxolotlArtLook = {
  eyes: 'happy',
  mouth: 'openD',
  gills: 'fluffy',
  spots: 'freckles',
  size: 'medium',
  sex: 'boy',
  tail: 'medium',
  body: 'regular',
  age: 'young',
};

/** Uniform scale per size about local (0, 0), ink included (guide 6o). Large is the prototype scale. */
export const AXO_SIZE_SCALE: Readonly<Record<AxoSize, number>> = {
  small: 0.72,
  medium: 0.85,
  large: 1,
};

/** Axis-aligned box in local units. */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Box holding every point, grown by `pad` on each side. */
export function boundsOfPoints(points: readonly (readonly [number, number])[], pad: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x - pad);
    minY = Math.min(minY, y - pad);
    maxX = Math.max(maxX, x + pad);
    maxY = Math.max(maxY, y + pad);
  }
  return { minX, minY, maxX, maxY };
}

/** Smallest box holding every input box. */
export function unionBounds(boxes: readonly Bounds[]): Bounds {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

// ---------------------------------------------------------------------------
// Body proportions: Boy or girl, Tail, Body, Age
// ---------------------------------------------------------------------------

/** An axis-aligned ellipse in local units. */
export interface BodyEllipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** A point in local units. */
export interface LocalPoint {
  readonly x: number;
  readonly y: number;
}

/** Head ellipse (guide 6b). The same for every option, so the face, gills and slots never move. */
export const HEAD_ELLIPSE: BodyEllipse = { cx: 26, cy: -1, rx: 27, ry: 22 };
/** Prototype torso (guide 6b): Young, Regular. */
export const PROTOTYPE_TORSO: BodyEllipse = { cx: -8, cy: 4, rx: 37, ry: 19 };
/** Prototype belly (guide 6g): Young, Regular. */
export const PROTOTYPE_BELLY: BodyEllipse = { cx: -6, cy: 14, rx: 26, ry: 6.2 };

/** Tail shape. The core tapers from rootHalfHeight at the root to 2 at the tip (guide 6f). */
export interface TailGeometry {
  /** Local x of the tail root (s = 0). */
  readonly rootX: number;
  /** Core length from root to tip. */
  readonly length: number;
  readonly rootHalfHeight: number;
  /** Peak top fin reach beyond the core, on top of the 2-unit fin base. */
  readonly finTop: number;
  /** Peak bottom fin reach beyond the core, on top of the 2-unit fin base. */
  readonly finBottom: number;
  /** Tail point where the fin bands and core-edge lines start, and where a fin-free morph rim ends (guide 6b). */
  readonly finStart: number;
}

/** Prototype tail (guide 6b, 6f): Medium, with no Boy cue. */
export const PROTOTYPE_TAIL: TailGeometry = {
  rootX: -30,
  length: 44,
  rootHalfHeight: 13,
  finTop: 9,
  finBottom: 7,
  finStart: 3,
};

/** Everything the body painter reads from the Boy or girl, Tail, Body and Age options. */
export interface AxolotlBodyGeometry {
  readonly torso: BodyEllipse;
  readonly belly: BodyEllipse;
  readonly tail: TailGeometry;
  /** Leg roots in leg draw order: far-front, far-rear, near-front, near-rear (guide 6e). */
  readonly legRoots: readonly LocalPoint[];
  /** Leg tube lengths, in leg draw order. */
  readonly legLengths: readonly number[];
  readonly toeLength: number;
  /** Factor on gill stem, filament and tip lengths. */
  readonly gillLength: number;
}

interface BodyBuild {
  readonly torsoRx: number;
  readonly torsoRy: number;
  readonly bellyRx: number;
  readonly bellyRy: number;
}

/**
 * Body depth (2 x torso ry) differs by 8 or more, and by 20% or more, between
 * neighbouring Bodies. Belly x radii leave room for the Girl's wider belly
 * inside the torso (Chubby stays 28).
 */
const BODY_BUILDS: Readonly<Record<AxoBody, BodyBuild>> = {
  slim: { torsoRx: 37, torsoRy: 15, bellyRx: 26, bellyRy: 4.2 },
  regular: { torsoRx: 37, torsoRy: 19, bellyRx: 26, bellyRy: 6.2 },
  chubby: { torsoRx: 39, torsoRy: 24, bellyRx: 28, bellyRy: 9.5 },
};

interface AgeBuild {
  readonly torsoRxChange: number;
  readonly tailLength: number;
  readonly gillLength: number;
  readonly legLength: number;
}

const AGE_BUILDS: Readonly<Record<AxoAge, AgeBuild>> = {
  baby: { torsoRxChange: -6, tailLength: 0.85, gillLength: 0.8, legLength: 0.7 },
  young: { torsoRxChange: 0, tailLength: 1, gillLength: 1, legLength: 1 },
  grownUp: { torsoRxChange: 2, tailLength: 1, gillLength: 1.12, legLength: 1 },
};

const TAIL_CORE_LENGTHS: Readonly<Record<AxoTail, number>> = { short: 36, medium: 44, long: 52 };
const BOY_TAIL_EXTRA = 4;
/** Boy cue: clearly taller fins. */
const BOY_FIN_SCALE = 1.6;
/** Boy cue: the fin bands start nearer the body, so the fin reads longer. */
const BOY_FIN_START = 1;
/** Girl cue: torso and belly clearly rounder (added to both y radii). */
const GIRL_ROUND_EXTRA = 3;
/** Girl cue: a wider belly (added to its x radius). */
const GIRL_BELLY_WIDTH_EXTRA = 2;

/** INVARIANT: the torso's front end (the head joint) stays here for every option. */
const TORSO_FRONT_X = PROTOTYPE_TORSO.cx + PROTOTYPE_TORSO.rx;
const PROTOTYPE_TORSO_BACK_X = PROTOTYPE_TORSO.cx - PROTOTYPE_TORSO.rx;
/** How far the tail root sits in front of the torso's back end (guide 6b: -30 vs -45). */
const TAIL_ROOT_OVERLAP = PROTOTYPE_TAIL.rootX - PROTOTYPE_TORSO_BACK_X;
/** Belly centre above the torso's lowest point, for the prototype belly radius. */
const BELLY_DROP = PROTOTYPE_TORSO.cy + PROTOTYPE_TORSO.ry - PROTOTYPE_BELLY.cy;

/** Guide 6e roots, in leg draw order. */
const PROTOTYPE_LEG_ROOTS: readonly LocalPoint[] = [
  { x: 8, y: 15 },
  { x: -14, y: 17 },
  { x: 18, y: 15 },
  { x: -24, y: 17 },
];
const PROTOTYPE_LEG_LENGTHS: readonly number[] = [14, 14, 15, 15];
const PROTOTYPE_TOE_LENGTH = 8.5;

/** Stretch along x behind the head joint (x < 0): the torso's back end over the prototype's. */
export function torsoBackScale(torso: BodyEllipse): number {
  return (torso.cx - torso.rx) / PROTOTYPE_TORSO_BACK_X;
}

/**
 * Move a point placed on the prototype torso onto `torso`: behind x = 0 it
 * stretches with the back end, and y scales with the torso height about its
 * centre line. Head-side points (x >= 0) keep their x.
 */
export function torsoPoint(torso: BodyEllipse, x: number, y: number): LocalPoint {
  return {
    x: x < 0 ? x * torsoBackScale(torso) : x,
    y: torso.cy + (y - PROTOTYPE_TORSO.cy) * (torso.ry / PROTOTYPE_TORSO.ry),
  };
}

/**
 * Body proportions for a look (prototype = Young, Regular, Medium tail).
 * Age changes proportions only, never the size scale. The head never moves.
 */
export function axolotlBodyGeometry(look: AxolotlArtLook): AxolotlBodyGeometry {
  const build = BODY_BUILDS[look.body];
  const age = AGE_BUILDS[look.age];
  const isBoy = look.sex === 'boy';
  const girlExtra = isBoy ? 0 : GIRL_ROUND_EXTRA;
  const girlBellyWidth = isBoy ? 0 : GIRL_BELLY_WIDTH_EXTRA;
  const finScale = isBoy ? BOY_FIN_SCALE : 1;
  const boyTail = isBoy ? BOY_TAIL_EXTRA : 0;

  const torsoRx = build.torsoRx + age.torsoRxChange;
  const torso: BodyEllipse = {
    cx: TORSO_FRONT_X - torsoRx,
    cy: PROTOTYPE_TORSO.cy,
    rx: torsoRx,
    ry: build.torsoRy + girlExtra,
  };
  const ageStretch = torsoRx / build.torsoRx;
  const bellyRy = build.bellyRy + girlExtra;
  const belly: BodyEllipse = {
    cx: torso.cx + (PROTOTYPE_BELLY.cx - PROTOTYPE_TORSO.cx) * ageStretch,
    cy: torso.cy + torso.ry - BELLY_DROP - (bellyRy - PROTOTYPE_BELLY.ry),
    rx: build.bellyRx * ageStretch + girlBellyWidth,
    ry: bellyRy,
  };
  const tail: TailGeometry = {
    rootX: torso.cx - torso.rx + TAIL_ROOT_OVERLAP,
    length: (TAIL_CORE_LENGTHS[look.tail] + boyTail) * age.tailLength,
    rootHalfHeight: PROTOTYPE_TAIL.rootHalfHeight * (torso.ry / PROTOTYPE_TORSO.ry),
    finTop: PROTOTYPE_TAIL.finTop * finScale,
    finBottom: PROTOTYPE_TAIL.finBottom * finScale,
    finStart: isBoy ? BOY_FIN_START : PROTOTYPE_TAIL.finStart,
  };
  return {
    torso,
    belly,
    tail,
    legRoots: PROTOTYPE_LEG_ROOTS.map((root) => torsoPoint(torso, root.x, root.y)),
    legLengths: PROTOTYPE_LEG_LENGTHS.map((len) => len * age.legLength),
    toeLength: PROTOTYPE_TOE_LENGTH * age.legLength,
    gillLength: age.gillLength,
  };
}

// ---------------------------------------------------------------------------
// Eyes (guide 6c, 6l)
// ---------------------------------------------------------------------------

/** An eye placement: centre and prototype bead radius r. */
export interface EyeSpot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Guide 6c. */
export const NEAR_EYE: EyeSpot = { x: 28, y: -6, r: 6.4 };
export const FAR_EYE: EyeSpot = { x: 42, y: -7, r: 5.3 };

/** Lid line ink width (guide 6l). */
export const EYE_LID_INK = 2;

/** A filled circle relative to the eye centre. */
export interface EyeDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Lid line relative to the eye centre: a quadratic from (x1, y1) through
 * control (cx, cy) to (x2, y2). Straight lids put the control at the midpoint.
 * The bead shows only below the lid.
 */
export interface EyeLid {
  readonly x1: number;
  readonly y1: number;
  readonly cx: number;
  readonly cy: number;
  readonly x2: number;
  readonly y2: number;
}

/** Everything one eye paints, relative to its centre, before the blink squash. */
export interface EyeMarks {
  readonly beadR: number;
  readonly glints: readonly EyeDot[];
  readonly lid: EyeLid | null;
}

function straightLid(r: number, backY: number, snoutY: number): EyeLid {
  const y1 = backY * r;
  const y2 = snoutY * r;
  return { x1: -r, y1, cx: 0, cy: (y1 + y2) / 2, x2: r, y2 };
}

/**
 * Eye geometry for a variant at prototype bead radius r (guide 6l). Sleepy's
 * lid control sits at 0.3r so the curve's middle dips 0.15r below the centre.
 * Curious places its glints on the 1.1r bead; glint 1 radius is 0.45r.
 * Grumpy's lid runs through the centre, sloping down toward the snout, so the
 * lower half of the bead shows; its brow is grumpyBrow().
 */
export function eyeMarks(variant: EyeVariant, r: number): EyeMarks {
  const glint1: EyeDot = { x: r * 0.3, y: -r * 0.35, r: r * 0.38 };
  const glint2: EyeDot = { x: -r * 0.35, y: r * 0.35, r: r * 0.17 };
  switch (variant) {
    case 'happy':
      return { beadR: r, glints: [glint1, glint2], lid: null };
    case 'sleepy':
      return {
        beadR: r,
        glints: [{ x: -r * 0.3, y: r * 0.45, r: r * 0.17 }],
        lid: { x1: -r, y1: 0, cx: 0, cy: r * 0.3, x2: r, y2: 0 },
      };
    case 'determined':
      return { beadR: r, glints: [glint1, glint2], lid: straightLid(r, -0.6, -0.25) };
    case 'curious': {
      const big = r * 1.1;
      return {
        beadR: big,
        glints: [
          { x: big * 0.3, y: -big * 0.35, r: r * 0.45 },
          { x: -big * 0.35, y: big * 0.35, r: big * 0.17 },
        ],
        lid: null,
      };
    }
    case 'grumpy':
      return { beadR: r, glints: [glint2], lid: straightLid(r, -0.2, 0.2) };
  }
}

/** Eye keep-clear zone radius beyond the prototype bead radius (guide 6i). */
export const EYE_ZONE_MARGIN = 1.8;
/** Girl cue lashes: ink over a white under-stroke, so they read on Melanoid and in greyscale. */
export const EYELASH_INK = 2;
export const EYELASH_UNDER = 3.6;
/**
 * Girl cue lashes reach a circle this far past the prototype bead radius
 * (less LASH_REACH_INSET), beyond the eye zone, so they read at Small. They
 * paint on the eye layer (12), above every Wearable layer.
 */
export const LASH_REACH = 4;

/** One lash line relative to the eye centre, before the blink squash. */
export interface EyeLash {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Lash corners stay this far inside the lash reach circle. */
const LASH_REACH_INSET = 0.05;
/** Open eyes: lash roots sit this far inside the bead edge, so the bead covers them. */
const LASH_ROOT_INSET = 1;
/** Every variant: each lash aims at the lash reach circle at these angles (the upper back, facing right, y down). */
const LASH_END_ANGLES: readonly number[] = [Math.PI + 0.5, Math.PI + 0.85, Math.PI + 1.2];
/** Lidded eyes: lash roots along the lid, as fractions of the way from its back bead-edge end to its middle. */
const LID_LASH_ROOTS: readonly number[] = [0.3, 0.42, 0.55];

/** Distance from (x, y) along unit (dx, dy) to the circle of radius `reach` about the eye centre. */
function roomToReach(x: number, y: number, dx: number, dy: number, reach: number): number {
  const along = x * dx + y * dy;
  return -along + Math.sqrt(along * along - (x * x + y * y) + reach * reach);
}

/**
 * A lash from `root` aimed at the point at `angle` on the `reach` circle. It
 * stops where the first corner of its widest (butt-capped) stroke meets that
 * circle, so every painted corner stays within `reach` of the eye centre.
 */
function lashToward(root: LocalPoint, angle: number, reach: number): EyeLash {
  const dir = Math.atan2(Math.sin(angle) * reach - root.y, Math.cos(angle) * reach - root.x);
  const dx = Math.cos(dir);
  const dy = Math.sin(dir);
  const half = EYELASH_UNDER / 2;
  const len = Math.min(
    roomToReach(root.x - dy * half, root.y + dx * half, dx, dy, reach),
    roomToReach(root.x + dy * half, root.y - dx * half, dx, dy, reach),
  );
  return { x1: root.x, y1: root.y, x2: root.x + dx * len, y2: root.y + dy * len };
}

/** The lid line's point at curve parameter u (0 at the back end, 1 at the snout end). */
function lidPointAt(lid: EyeLid, u: number): LocalPoint {
  const m = 1 - u;
  return {
    x: m * m * lid.x1 + 2 * u * m * lid.cx + u * u * lid.x2,
    y: m * m * lid.y1 + 2 * u * m * lid.cy + u * u * lid.y2,
  };
}

/** Curve parameter where the lid line first meets the bead edge from its back end (x1 side). */
function lidBackParam(lid: EyeLid, beadR: number): number {
  let outside = 0;
  let inside = 0.5;
  for (let step = 0; step < 40; step++) {
    const mid = (outside + inside) / 2;
    const p = lidPointAt(lid, mid);
    if (Math.hypot(p.x, p.y) > beadR) outside = mid;
    else inside = mid;
  }
  return inside;
}

/**
 * Girl cue lashes for one eye at prototype bead radius r: three lashes aimed
 * at the upper back of the lash reach circle (r + LASH_REACH). Open eyes root
 * them 1 inside the bead edge on the same radial lines; lidded eyes root them
 * on the back half of the lid line, so they rise into the space above the lid.
 * Every corner of every butt-capped stroke stays inside that circle.
 */
export function eyelashMarks(variant: EyeVariant, r: number): EyeLash[] {
  const marks = eyeMarks(variant, r);
  const reach = r + LASH_REACH - LASH_REACH_INSET;
  const lid = marks.lid;
  if (lid) {
    const back = lidBackParam(lid, marks.beadR);
    return LASH_END_ANGLES.map((angle, i) =>
      lashToward(lidPointAt(lid, back + LID_LASH_ROOTS[i] * (0.5 - back)), angle, reach),
    );
  }
  const rootR = marks.beadR - LASH_ROOT_INSET;
  return LASH_END_ANGLES.map((angle) =>
    lashToward({ x: Math.cos(angle) * rootR, y: Math.sin(angle) * rootR }, angle, reach),
  );
}

/** Lashes use butt caps, so no paint reaches past a lash end (the lash reach circle holds every corner). */
function paintEyelashes(ctx: CanvasRenderingContext2D, lashes: readonly EyeLash[]): void {
  const path = new Path2D();
  for (const lash of lashes) {
    path.moveTo(lash.x1, lash.y1);
    path.lineTo(lash.x2, lash.y2);
  }
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineWidth = EYELASH_UNDER;
  ctx.strokeStyle = WHITE;
  ctx.stroke(path);
  ctx.lineWidth = EYELASH_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(path);
  ctx.restore();
}

/** A Grumpy brow line relative to its eye centre, from its back end (x1, y1) to its snout end (x2, y2). */
export type EyeBrow = EyeLash;

/**
 * Grumpy brows (guide 6l), relative to each eye centre: a short stroke over the
 * snout-side half of the bead, sloping down toward the snout (near about 17.9
 * degrees, far about 18.2). The near brow sits between the near eye's top lash
 * and the far eye's lashes; the far brow sits low, between the far lashes and
 * the head's top edge, just above the lid.
 */
const GRUMPY_BROWS: ReadonlyMap<EyeSpot, EyeBrow> = new Map([
  [NEAR_EYE, { x1: 0, y1: -7.9, x2: 4.5, y2: -6.45 }],
  [FAR_EYE, { x1: 0.4, y1: -3.8, x2: 4.8, y2: -2.35 }],
]);

/** The Grumpy brow of NEAR_EYE or FAR_EYE, relative to its centre. A RangeError for any other eye. */
export function grumpyBrow(spot: EyeSpot): EyeBrow {
  const brow = GRUMPY_BROWS.get(spot);
  if (!brow) throw new RangeError(`no Grumpy brow for the eye at (${spot.x}, ${spot.y})`);
  return brow;
}

/** Local box of a Grumpy brow's paint: the white under-stroke with its round caps. */
export function grumpyBrowInkBounds(spot: EyeSpot): Bounds {
  const brow = grumpyBrow(spot);
  return boundsOfPoints(
    [
      [spot.x + brow.x1, spot.y + brow.y1],
      [spot.x + brow.x2, spot.y + brow.y2],
    ],
    EYELASH_UNDER / 2,
  );
}

/**
 * Paint a Grumpy brow: lash ink 2.0 over the lash white 3.6, round caps (set
 * for the brow only, then restored), in the eye's translate but never squashed.
 */
function paintBrow(ctx: CanvasRenderingContext2D, spot: EyeSpot, brow: EyeBrow): void {
  const path = new Path2D();
  path.moveTo(brow.x1, brow.y1);
  path.lineTo(brow.x2, brow.y2);
  ctx.save();
  ctx.translate(spot.x, spot.y);
  ctx.lineCap = 'round';
  ctx.lineWidth = EYELASH_UNDER;
  ctx.strokeStyle = WHITE;
  ctx.stroke(path);
  ctx.lineWidth = EYELASH_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(path);
  ctx.restore();
}

function lidPath(lid: EyeLid): Path2D {
  const p = new Path2D();
  p.moveTo(lid.x1, lid.y1);
  p.quadraticCurveTo(lid.cx, lid.cy, lid.x2, lid.y2);
  return p;
}

/** Region below the lid, wide enough to hold the whole lower bead. */
function belowLidPath(lid: EyeLid, beadR: number): Path2D {
  const p = lidPath(lid);
  p.lineTo(lid.x2, beadR + 1);
  p.lineTo(lid.x1, beadR + 1);
  p.closePath();
  return p;
}

/**
 * Paint one eye. `blink` (1 open down to 0.12) squashes every variant
 * vertically about the eye centre. Lid lines are clipped to the bead. An
 * optional morph `ring` is stroked just inside the bead edge, under the glints.
 * `eyelashes` (the Girl cue) paints under the bead, inside the eye transform,
 * so a blink squashes them too. Grumpy's brow paints last, outside the blink
 * squash: squashed at blink 0.12 it would drop onto the closed eye and thin
 * to about 0.4 units.
 */
export function paintEye(
  ctx: CanvasRenderingContext2D,
  variant: EyeVariant,
  spot: EyeSpot,
  blink: number,
  colour: string,
  ring?: MorphEyeRing,
  eyelashes = false,
): void {
  const marks = eyeMarks(variant, spot.r);
  ctx.save();
  ctx.translate(spot.x, spot.y);
  ctx.scale(1, blink);
  if (eyelashes) paintEyelashes(ctx, eyelashMarks(variant, spot.r));
  if (marks.lid) {
    ctx.save();
    ctx.clip(belowLidPath(marks.lid, marks.beadR));
  }
  const bead = new Path2D();
  ell(bead, 0, 0, marks.beadR, marks.beadR);
  ctx.fillStyle = colour;
  ctx.fill(bead);
  if (ring) {
    // Morph eye ring (guide 3b): drawn inside the bead edge so the eye keeps its size.
    const ringPath = new Path2D();
    const ringR = marks.beadR - ring.width / 2;
    ell(ringPath, 0, 0, ringR, ringR);
    ctx.lineWidth = ring.width;
    ctx.strokeStyle = ring.colour;
    ctx.stroke(ringPath);
  }
  ctx.fillStyle = WHITE;
  for (const g of marks.glints) {
    const glint = new Path2D();
    ell(glint, g.x, g.y, g.r, g.r);
    ctx.fill(glint);
  }
  if (marks.lid) {
    ctx.restore();
    ctx.save();
    ctx.clip(bead);
    ctx.lineWidth = EYE_LID_INK;
    ctx.strokeStyle = INK;
    ctx.stroke(lidPath(marks.lid));
    ctx.restore();
  }
  ctx.restore();
  if (variant === 'grumpy') paintBrow(ctx, spot, grumpyBrow(spot));
}

// ---------------------------------------------------------------------------
// Cheek heart (Girl cue, guide 6u)
// ---------------------------------------------------------------------------

/**
 * Centre of the Girl cue cheek heart's curve (the middle of its smallest
 * enclosing circle): on the cheek below and behind the near eye, between the
 * gill-root zone and the mouth zone, near the near blush.
 */
export const CHEEK_HEART_CENTRE: LocalPoint = { x: 18.2, y: 9.6 };
/** Width of the heart curve (the outline's centre line). */
export const CHEEK_HEART_WIDTH = 7;
/** Outline ink, over a white under-stroke that shows 0.8 outside the ink. */
export const CHEEK_HEART_INK = 1.6;
export const CHEEK_HEART_UNDER = 3.2;
/** The heart paints at layer 10.2: after the blush (10), before the Head item (10.5). */
export const CHEEK_HEART_LAYER = 10.2;
/** Points round the heart curve. */
const CHEEK_HEART_STEPS = 48;
/** Half-width of the unscaled heart curve (x = 16 sin^3 t). */
const HEART_CURVE_HALF_WIDTH = 16;

/**
 * Points round the cheek heart in local units, from the top notch clockwise:
 * the heart curve x = 16 sin^3 t, y = -(13 cos t - 5 cos 2t - 2 cos 3t - cos 4t)
 * (y down), scaled to CHEEK_HEART_WIDTH across about CHEEK_HEART_CENTRE.
 */
export function cheekHeartPoints(): LocalPoint[] {
  const scale = CHEEK_HEART_WIDTH / (2 * HEART_CURVE_HALF_WIDTH);
  const points: LocalPoint[] = [];
  for (let k = 0; k < CHEEK_HEART_STEPS; k++) {
    const t = (k / CHEEK_HEART_STEPS) * Math.PI * 2;
    const x = HEART_CURVE_HALF_WIDTH * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    points.push({ x: CHEEK_HEART_CENTRE.x + x * scale, y: CHEEK_HEART_CENTRE.y + y * scale });
  }
  return points;
}

/**
 * Keep-clear circle about CHEEK_HEART_CENTRE holding all of the heart's paint,
 * white under-stroke included (round joins, as every axolotl line).
 */
export const CHEEK_HEART_ZONE: ZoneCircle = {
  x: CHEEK_HEART_CENTRE.x,
  y: CHEEK_HEART_CENTRE.y,
  r:
    Math.max(...cheekHeartPoints().map((p) => Math.hypot(p.x - CHEEK_HEART_CENTRE.x, p.y - CHEEK_HEART_CENTRE.y))) +
    CHEEK_HEART_UNDER / 2,
};

/**
 * Paint the cheek heart (layer 10.2, the Girl cue): the white under-stroke, then
 * the CHEEK_HEART fill over its inner half, then the ink outline.
 */
export function paintCheekHeart(ctx: CanvasRenderingContext2D): void {
  const [first, ...rest] = cheekHeartPoints();
  const path = new Path2D();
  path.moveTo(first.x, first.y);
  for (const p of rest) path.lineTo(p.x, p.y);
  path.closePath();
  ctx.lineWidth = CHEEK_HEART_UNDER;
  ctx.strokeStyle = WHITE;
  ctx.stroke(path);
  ctx.fillStyle = CHEEK_HEART;
  ctx.fill(path);
  ctx.lineWidth = CHEEK_HEART_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(path);
}

// ---------------------------------------------------------------------------
// Mouths (guide 6c, 6l)
// ---------------------------------------------------------------------------

/** Mouth outline ink (guide 6c, 6l). */
export const MOUTH_INK = 2.4;
/** Corner tick ink (guide 6c). */
export const MOUTH_TICK_INK = 2;
/** Tongue fill (guide 3g, 6l). Kept here: the palette belongs to the morph work. */
const TONGUE = '#ff9fb5';

/** A point in local units, as [x, y]. */
type MouthPoint = readonly [number, number];
/** A corner tick: from the mouth corner (x0, y0) out to the tick end (x1, y1). */
type MouthTick = readonly [number, number, number, number];

/** A filled open mouth: an upper and a lower quadratic lip between two corners, plus corner ticks. */
interface OpenMouth {
  readonly left: MouthPoint;
  readonly right: MouthPoint;
  readonly upperCtrl: MouthPoint;
  readonly lowerCtrl: MouthPoint;
  readonly ticks: readonly MouthTick[];
}

/** An unfilled mouth line: quadratics joined end to end from `start`, each as [control, end], plus corner ticks. */
interface MouthLine {
  readonly start: MouthPoint;
  readonly curves: readonly (readonly [MouthPoint, MouthPoint])[];
  readonly ticks: readonly MouthTick[];
}

/** An axis-aligned mouth ellipse. */
interface MouthEllipse {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

const MOUTH_LEFT: MouthPoint = [28, 10];
const MOUTH_RIGHT: MouthPoint = [49, 7];
/** Prototype corner ticks (guide 6c). */
const MOUTH_TICKS: readonly MouthTick[] = [
  [28, 10, 26.4, 7.6],
  [49, 7, 50.4, 4.6],
];
/** The prototype mouth (guide 6c). */
const OPEN_D: OpenMouth = {
  left: MOUTH_LEFT,
  right: MOUTH_RIGHT,
  upperCtrl: [38, 13],
  lowerCtrl: [38, 22],
  ticks: MOUTH_TICKS,
};
/** Wider and deeper than the Open D. Its ticks stand a little steeper, so they stay in the mouth zone. */
const BIG_GRIN: OpenMouth = {
  left: [27, 9.5],
  right: [50, 6.5],
  upperCtrl: [38.5, 12.5],
  lowerCtrl: [38.5, 27],
  ticks: [
    [27, 9.5, 25.6, 7.2],
    [50, 6.5, 51.2, 4.2],
  ],
};
const SMILE: MouthLine = { start: MOUTH_LEFT, curves: [[[38, 19], MOUTH_RIGHT]], ticks: MOUTH_TICKS };
/** A "w": two quadratic dips joined at a raised middle. No ticks. */
const CAT_SMILE: MouthLine = {
  start: [31, 10.5],
  curves: [
    [
      [34.75, 15.5],
      [38.5, 10],
    ],
    [
      [42.25, 14.5],
      [46, 8.5],
    ],
  ],
  ticks: [],
};
/** Low at the back, raised at the snout corner, with the prototype tick there only. */
const SMIRK: MouthLine = { start: [30, 12], curves: [[[41, 14], MOUTH_RIGHT]], ticks: [MOUTH_TICKS[1]] };
const TONGUE_ELL: MouthEllipse = { x: 40, y: 15.5, rx: 4.6, ry: 3.6 };
/** Blep: a small tongue tip under the Smile line. */
const TONGUE_TIP_ELL: MouthEllipse = { x: 39, y: 14.6, rx: 2.6, ry: 2.4 };
const SMALL_O_ELL: MouthEllipse = { x: 39, y: 11, rx: 3.4, ry: 4 };

/** Box of a quadratic Bezier, from its endpoints and in-range extremes. */
export function quadBounds(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  pad: number,
): Bounds {
  const points: [number, number][] = [
    [x0, y0],
    [x1, y1],
  ];
  const at = (u: number): [number, number] => {
    const m = 1 - u;
    return [m * m * x0 + 2 * u * m * cx + u * u * x1, m * m * y0 + 2 * u * m * cy + u * u * y1];
  };
  for (const [a, c, b] of [
    [x0, cx, x1],
    [y0, cy, y1],
  ]) {
    const den = a - 2 * c + b;
    if (den === 0) continue;
    const u = (a - c) / den;
    if (u > 0 && u < 1) points.push(at(u));
  }
  return boundsOfPoints(points, pad);
}

function ellBounds(e: MouthEllipse, pad: number): Bounds {
  return { minX: e.x - e.rx - pad, minY: e.y - e.ry - pad, maxX: e.x + e.rx + pad, maxY: e.y + e.ry + pad };
}

function tickBounds(ticks: readonly MouthTick[]): Bounds {
  const ends = ticks.flatMap(([x0, y0, x1, y1]): [number, number][] => [
    [x0, y0],
    [x1, y1],
  ]);
  return boundsOfPoints(ends, MOUTH_TICK_INK / 2);
}

function openMouthBounds(mouth: OpenMouth): Bounds {
  const [lx, ly] = mouth.left;
  const [rx, ry] = mouth.right;
  const pad = MOUTH_INK / 2;
  return unionBounds([
    quadBounds(lx, ly, mouth.upperCtrl[0], mouth.upperCtrl[1], rx, ry, pad),
    quadBounds(rx, ry, mouth.lowerCtrl[0], mouth.lowerCtrl[1], lx, ly, pad),
    tickBounds(mouth.ticks),
  ]);
}

function mouthLineBounds(mouthLine: MouthLine): Bounds {
  const pad = MOUTH_INK / 2;
  const boxes: Bounds[] = [];
  let from = mouthLine.start;
  for (const [ctrl, to] of mouthLine.curves) {
    boxes.push(quadBounds(from[0], from[1], ctrl[0], ctrl[1], to[0], to[1], pad));
    from = to;
  }
  if (mouthLine.ticks.length > 0) boxes.push(tickBounds(mouthLine.ticks));
  return unionBounds(boxes);
}

/** Box holding all ink and fill a mouth variant paints, outline included. */
export function mouthInkBounds(variant: MouthVariant): Bounds {
  const pad = MOUTH_INK / 2;
  switch (variant) {
    case 'openD':
      return openMouthBounds(OPEN_D);
    case 'tongueOut':
      return unionBounds([openMouthBounds(OPEN_D), ellBounds(TONGUE_ELL, pad)]);
    case 'smile':
      return mouthLineBounds(SMILE);
    case 'smallO':
      return ellBounds(SMALL_O_ELL, pad);
    case 'bigGrin':
      return openMouthBounds(BIG_GRIN);
    case 'catSmile':
      return mouthLineBounds(CAT_SMILE);
    case 'smirk':
      return mouthLineBounds(SMIRK);
    case 'tongueTip':
      return unionBounds([mouthLineBounds(SMILE), ellBounds(TONGUE_TIP_ELL, pad)]);
  }
}

function strokeMouthTicks(ctx: CanvasRenderingContext2D, ticks: readonly MouthTick[]): void {
  if (ticks.length === 0) return;
  const tickPath = new Path2D();
  for (const [x0, y0, x1, y1] of ticks) {
    tickPath.moveTo(x0, y0);
    tickPath.lineTo(x1, y1);
  }
  ctx.lineWidth = MOUTH_TICK_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(tickPath);
}

function paintOpenMouth(ctx: CanvasRenderingContext2D, mouth: OpenMouth, fill: string): void {
  const outline = new Path2D();
  outline.moveTo(mouth.left[0], mouth.left[1]);
  outline.quadraticCurveTo(mouth.upperCtrl[0], mouth.upperCtrl[1], mouth.right[0], mouth.right[1]);
  outline.quadraticCurveTo(mouth.lowerCtrl[0], mouth.lowerCtrl[1], mouth.left[0], mouth.left[1]);
  outline.closePath();
  ctx.fillStyle = fill;
  ctx.fill(outline);
  ctx.lineWidth = MOUTH_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(outline);
  strokeMouthTicks(ctx, mouth.ticks);
}

function paintMouthLine(ctx: CanvasRenderingContext2D, mouthLine: MouthLine): void {
  const linePath = new Path2D();
  linePath.moveTo(mouthLine.start[0], mouthLine.start[1]);
  for (const [ctrl, to] of mouthLine.curves) linePath.quadraticCurveTo(ctrl[0], ctrl[1], to[0], to[1]);
  ctx.lineWidth = MOUTH_INK;
  ctx.strokeStyle = INK;
  ctx.stroke(linePath);
  strokeMouthTicks(ctx, mouthLine.ticks);
}

function paintEllipseMouth(ctx: CanvasRenderingContext2D, e: MouthEllipse, fill: string): void {
  const p = new Path2D();
  ell(p, e.x, e.y, e.rx, e.ry);
  shape(ctx, p, fill, MOUTH_INK);
}

/**
 * Paint the mouth (layer 11). `fill` is the morph's mouth slot. Blep paints
 * its tongue first, so the Smile line crosses over the tongue's top.
 */
export function paintMouth(ctx: CanvasRenderingContext2D, variant: MouthVariant, fill: string): void {
  switch (variant) {
    case 'openD':
      paintOpenMouth(ctx, OPEN_D, fill);
      return;
    case 'tongueOut':
      paintOpenMouth(ctx, OPEN_D, fill);
      paintEllipseMouth(ctx, TONGUE_ELL, TONGUE);
      return;
    case 'smile':
      paintMouthLine(ctx, SMILE);
      return;
    case 'smallO':
      paintEllipseMouth(ctx, SMALL_O_ELL, fill);
      return;
    case 'bigGrin':
      paintOpenMouth(ctx, BIG_GRIN, fill);
      return;
    case 'catSmile':
      paintMouthLine(ctx, CAT_SMILE);
      return;
    case 'smirk':
      paintMouthLine(ctx, SMIRK);
      return;
    case 'tongueTip':
      paintEllipseMouth(ctx, TONGUE_TIP_ELL, TONGUE);
      paintMouthLine(ctx, SMILE);
      return;
  }
}

// ---------------------------------------------------------------------------
// Gills (guide 6d, 6m)
// ---------------------------------------------------------------------------

/** Per-style gill values (guide 6m). Stem lengths run top, middle, bottom. */
export interface GillStyle {
  readonly nearLen: readonly [number, number, number];
  readonly farLen: readonly [number, number, number];
  /** Where side filaments sit along the stem, one each side at each u. */
  readonly filamentU: readonly number[];
  /** Side filament length is filamentLen x (1.05 - 0.55u). */
  readonly filamentLen: number;
  readonly tipLen: number;
  readonly nearBend: number;
  readonly farBend: number;
}

export const GILL_STYLES: Readonly<Record<GillStyleId, GillStyle>> = {
  fluffy: {
    nearLen: [34, 37, 31],
    farLen: [28, 32, 26],
    filamentU: [0.35, 0.6, 0.82],
    filamentLen: 13,
    tipLen: 8,
    nearBend: 5,
    farBend: 4,
  },
  long: {
    nearLen: [44, 48, 40],
    farLen: [36, 42, 34],
    filamentU: [0.5, 0.8],
    filamentLen: 13,
    tipLen: 10,
    nearBend: 6,
    farBend: 5,
  },
  short: {
    nearLen: [24, 26, 22],
    farLen: [20, 22, 18],
    filamentU: [0.45, 0.8],
    filamentLen: 9,
    tipLen: 6,
    nearBend: 4,
    farBend: 3,
  },
};

/** Stem tube: colour width and outline per side (guide 6d). */
export const GILL_STEM_W = 6;
export const GILL_STEM_OL = 3;
/** Filament tube: colour width and outline per side (guide 6d). */
export const GILL_FILAMENT_W = 3.2;
export const GILL_FILAMENT_OL = 2.4;

/** Root, angle and flutter phase of one gill. Same for every style (guide 6m). */
export interface GillRoot {
  readonly bx: number;
  readonly by: number;
  /** Angle offset from straight back (added to pi). */
  readonly off: number;
  readonly phase: number;
}

/** Guide 6d, top, middle, bottom. */
export const FAR_GILL_ROOTS: readonly GillRoot[] = [
  { bx: 6, by: -16, off: 1.4, phase: 0.3 },
  { bx: 4, by: -8, off: 0.95, phase: 1.6 },
  { bx: 6, by: 0, off: 0.5, phase: 2.9 },
];
export const NEAR_GILL_ROOTS: readonly GillRoot[] = [
  { bx: 3, by: -12, off: 1.15, phase: 0.0 },
  { bx: 1, by: -3, off: 0.65, phase: 1.2 },
  { bx: 3, by: 7, off: 0.15, phase: 2.4 },
];

/** One gill of one style: its root plus stem length and bend. */
export interface GillSpec extends GillRoot {
  readonly len: number;
  readonly bend: number;
  /** Age factor on the stem, filament and tip lengths (`len` already carries it). */
  readonly lengthFactor: number;
}

export type GillLayer = 'far' | 'near';

/**
 * The three gills of a layer in a style, top to bottom. `lengthFactor` (Age)
 * scales stems, filaments and tips; roots, angles and bends never change.
 */
export function gillSpecs(style: GillStyleId, layer: GillLayer, lengthFactor = 1): GillSpec[] {
  const s = GILL_STYLES[style];
  const roots = layer === 'far' ? FAR_GILL_ROOTS : NEAR_GILL_ROOTS;
  const lens = layer === 'far' ? s.farLen : s.nearLen;
  const bend = layer === 'far' ? s.farBend : s.nearBend;
  return roots.map((root, i) => ({ ...root, len: lens[i] * lengthFactor, bend, lengthFactor }));
}

/** A straight filament from (x1, y1) to (x2, y2). */
export interface GillFilament {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Stem quadratic (root, control, tip) and filaments, side pairs first then the tip pair. */
export interface GillGeometry {
  readonly bx: number;
  readonly by: number;
  readonly cx: number;
  readonly cy: number;
  readonly tx: number;
  readonly ty: number;
  readonly filaments: readonly GillFilament[];
}

/** Gill geometry at flutter phase `tfl` (radians). */
export function gillGeometry(g: GillSpec, style: GillStyleId, tfl: number): GillGeometry {
  const s = GILL_STYLES[style];
  const { bx, by, len, bend, phase } = g;
  const a = Math.PI + g.off + 0.13 * Math.sin(tfl + phase);
  const tx = bx + Math.cos(a) * len;
  const ty = by + Math.sin(a) * len;
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const b = bend + 3 * Math.sin(tfl + phase + 1.2);
  const cx = (bx + tx) / 2 + nx * b;
  const cy = (by + ty) / 2 + ny * b;

  const pt = (u: number): [number, number] => {
    const m = 1 - u;
    return [m * m * bx + 2 * u * m * cx + u * u * tx, m * m * by + 2 * u * m * cy + u * u * ty];
  };
  const tan = (u: number): number =>
    Math.atan2(2 * (1 - u) * (cy - by) + 2 * u * (ty - cy), 2 * (1 - u) * (cx - bx) + 2 * u * (tx - cx));

  const filaments: GillFilament[] = [];
  for (const u of s.filamentU) {
    const p0 = pt(u);
    for (const sd of [-1, 1]) {
      const fa = tan(u) + sd * (0.95 - 0.25 * u) + 0.22 * Math.sin(tfl + phase + u * 4 + sd);
      const fl = s.filamentLen * g.lengthFactor * (1.05 - u * 0.55);
      filaments.push({ x1: p0[0], y1: p0[1], x2: p0[0] + Math.cos(fa) * fl, y2: p0[1] + Math.sin(fa) * fl });
    }
  }
  for (const sd of [-1, 1]) {
    const fa = tan(1) + sd * 0.38 + 0.18 * Math.sin(tfl + phase + 5 + sd);
    const tipLen = s.tipLen * g.lengthFactor;
    filaments.push({ x1: tx, y1: ty, x2: tx + Math.cos(fa) * tipLen, y2: ty + Math.sin(fa) * tipLen });
  }
  return { bx, by, cx, cy, tx, ty, filaments };
}

/**
 * Box holding all six gills of a style at flutter phase `tfl` and Age
 * `lengthFactor`, outline ink included. Conservative: a quadratic stem lies
 * inside the hull of its root, control and tip.
 */
export function gillInkBounds(style: GillStyleId, tfl: number, lengthFactor = 1): Bounds {
  const stemPad = GILL_STEM_W / 2 + GILL_STEM_OL;
  const filamentPad = GILL_FILAMENT_W / 2 + GILL_FILAMENT_OL;
  const boxes: Bounds[] = [];
  for (const layer of ['far', 'near'] as const) {
    for (const spec of gillSpecs(style, layer, lengthFactor)) {
      const geo = gillGeometry(spec, style, tfl);
      const stemHull: [number, number][] = [
        [geo.bx, geo.by],
        [geo.cx, geo.cy],
        [geo.tx, geo.ty],
      ];
      boxes.push(boundsOfPoints(stemHull, stemPad));
      const ends = geo.filaments.map((f): [number, number] => [f.x2, f.y2]);
      boxes.push(boundsOfPoints(ends, filamentPad));
    }
  }
  return unionBounds(boxes);
}

/** Paint one gill: its stem, then its filaments, in one ink pass at flutter phase `tfl`. */
export function paintGill(
  ctx: CanvasRenderingContext2D,
  g: GillSpec,
  style: GillStyleId,
  tfl: number,
  stemColour: string,
  filamentColour: string,
): void {
  const geo = gillGeometry(g, style, tfl);
  const stem = new Path2D();
  stem.moveTo(geo.bx, geo.by);
  stem.quadraticCurveTo(geo.cx, geo.cy, geo.tx, geo.ty);
  const segs: Seg[] = [seg(stem, GILL_STEM_W, stemColour, GILL_STEM_OL)];
  for (const f of geo.filaments) {
    segs.push(seg(line(f.x1, f.y1, f.x2, f.y2), GILL_FILAMENT_W, filamentColour, GILL_FILAMENT_OL));
  }
  inkMany(ctx, segs);
}

/** Paint the three gills of one layer (far: layer 1, near: layer 9), top to bottom, at Age `lengthFactor`. */
export function paintGills(
  ctx: CanvasRenderingContext2D,
  layer: GillLayer,
  style: GillStyleId,
  tfl: number,
  stemColour: string,
  filamentColour: string,
  lengthFactor = 1,
): void {
  for (const g of gillSpecs(style, layer, lengthFactor)) paintGill(ctx, g, style, tfl, stemColour, filamentColour);
}

// ---------------------------------------------------------------------------
// Tail space (guide 6f, 6i) and spots (guide 6g, 6n)
// ---------------------------------------------------------------------------

/** One point on the tail centreline: x, centre y and core half-height. */
export interface TailPoint {
  readonly x: number;
  readonly cy: number;
  readonly hc: number;
}

/** Tail wave amplitude at the tip for tailAmp 1 (guide 6f, 9). */
const TAIL_WAVE = 11;
/** Core half-height at the tip, and the fin reach at the root (guide 6b). */
const TAIL_TIP_HALF_HEIGHT = 2;
const TAIL_FIN_BASE = 2;

/**
 * Tail centreline at s (0 root, 1 tip) for a swim phase and amplitude
 * (guide 6f). The default tail is the prototype's: root x -30, tip x -74.
 */
export function tailPointAt(s: number, swim: number, tailAmp: number, tail: TailGeometry = PROTOTYPE_TAIL): TailPoint {
  return {
    x: tail.rootX - tail.length * s,
    cy: PROTOTYPE_TORSO.cy + TAIL_WAVE * tailAmp * s * Math.sin(swim - 4.5 * s),
    hc: TAIL_TIP_HALF_HEIGHT + (tail.rootHalfHeight - TAIL_TIP_HALF_HEIGHT) * Math.pow(1 - s, 1.1),
  };
}

/** Rotation of the local tail direction at s, in (-pi/2, pi/2). 0 when the tail is straight. */
export function tailAngleAt(s: number, swim: number, tailAmp: number, tail: TailGeometry = PROTOTYPE_TAIL): number {
  const dyds = TAIL_WAVE * tailAmp * (Math.sin(swim - 4.5 * s) - 4.5 * s * Math.cos(swim - 4.5 * s));
  return Math.atan(dyds / -tail.length);
}

/** Tail points painted from root to tip (guide 6f: 14 segments). */
export const TAIL_SEGMENTS = 14;
/** The Tail slot anchor sits on the core top at this tail point (guide 6i). */
export const TAIL_SLOT_POINT = 4;

/** One painted tail point plus its fin reach beyond the core, top and bottom. */
export interface TailSample extends TailPoint {
  readonly s: number;
  readonly finTop: number;
  readonly finBottom: number;
}

/** The TAIL_SEGMENTS + 1 tail points the painter joins, root first. */
export function tailSamples(tail: TailGeometry, swim: number, tailAmp: number): TailSample[] {
  const samples: TailSample[] = [];
  for (let i = 0; i <= TAIL_SEGMENTS; i++) {
    const s = i / TAIL_SEGMENTS;
    const rise = Math.sin(Math.PI * Math.pow(s, 0.8));
    samples.push({
      s,
      ...tailPointAt(s, swim, tailAmp, tail),
      finTop: TAIL_FIN_BASE + tail.finTop * rise,
      finBottom: TAIL_FIN_BASE + tail.finBottom * rise,
    });
  }
  return samples;
}

/** A body mark in local units. */
export interface BodyMark {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly rot: number;
}

/** A tail mark in tail space: v is a fraction of the core half-height, + is down (guide 6i). */
export interface TailMark {
  readonly s: number;
  readonly v: number;
  readonly rx: number;
  readonly ry: number;
}

export interface SpotSet {
  readonly body: readonly BodyMark[];
  readonly tail: readonly TailMark[];
}

const dot = (x: number, y: number, r: number): BodyMark => ({ x, y, rx: r, ry: r, rot: 0 });
const tailDot = (s: number, v: number, r: number): TailMark => ({ s, v, rx: r, ry: r });

/**
 * Guide 6n, placed on the prototype torso and tail (PRD F1). Each option
 * differs in count, size and placement, so they tell apart at a glance:
 * Freckles are ten tiny specks clustered on the shoulders, between the near
 * middle and bottom gill stems; Dots are six even, medium dots along the back,
 * then down the tail centre; Patches are three big, soft blotches, one on the
 * back and two on the tail. All stay off the head, and none looks like a morph
 * mark (3b): no morph clusters marks like Freckles, Dots are bigger than any
 * Wild or Copper speckle, and Patches are bigger than any Piebald patch.
 */
export const SPOT_SETS: Readonly<Record<SpotsOption, SpotSet>> = {
  none: { body: [], tail: [] },
  freckles: {
    body: [
      dot(-22, -10.5, 1.0),
      dot(-27, -9.5, 1.2),
      dot(-32, -8, 0.9),
      dot(-20, -6.5, 1.1),
      dot(-24, -6.5, 0.8),
      dot(-29, -5.5, 1.1),
      dot(-34, -4.5, 1.0),
      dot(-22, -3, 0.9),
      dot(-26, -3.5, 1.0),
      dot(-31, -2.5, 0.8),
    ],
    tail: [],
  },
  dots: {
    body: [dot(-18, -5, 2.8), dot(-28, -6.3, 2.8), dot(-36, -3.2, 2.8)],
    tail: [tailDot(0.34, -0.1, 2.8), tailDot(0.54, 0, 2.8), tailDot(0.7, 0.1, 2.8)],
  },
  patches: {
    body: [{ x: -25, y: -5, rx: 8.8, ry: 4.1, rot: 0 }],
    tail: [
      { s: 0.2, v: -0.15, rx: 6.2, ry: 5.8 },
      { s: 0.47, v: 0, rx: 6, ry: 6 },
    ],
  },
};

/**
 * Every mark of a spot option resolved to local units. Body marks move onto
 * `torso` (see torsoPoint); tail marks ride `tail` and its wave.
 */
export function spotMarks(
  option: SpotsOption,
  swim: number,
  tailAmp: number,
  tail: TailGeometry = PROTOTYPE_TAIL,
  torso: BodyEllipse = PROTOTYPE_TORSO,
): BodyMark[] {
  const set = SPOT_SETS[option];
  const body = set.body.map((m): BodyMark => ({ ...m, ...torsoPoint(torso, m.x, m.y) }));
  const tailMarks = set.tail.map((m): BodyMark => {
    const tp = tailPointAt(m.s, swim, tailAmp, tail);
    return { x: tp.x, y: tp.cy + m.v * tp.hc, rx: m.rx, ry: m.ry, rot: tailAngleAt(m.s, swim, tailAmp, tail) };
  });
  return [...body, ...tailMarks];
}

/** Paint spots (layer 8): flat fills, no outline. */
export function paintSpots(
  ctx: CanvasRenderingContext2D,
  option: SpotsOption,
  swim: number,
  tailAmp: number,
  colour: string,
  tail: TailGeometry = PROTOTYPE_TAIL,
  torso: BodyEllipse = PROTOTYPE_TORSO,
): void {
  ctx.fillStyle = colour;
  for (const m of spotMarks(option, swim, tailAmp, tail, torso)) {
    const p = new Path2D();
    ell(p, m.x, m.y, m.rx, m.ry, m.rot);
    ctx.fill(p);
  }
}

// ---------------------------------------------------------------------------
// Wearable slots (guide 6a, 6i, 6k, 11)
// ---------------------------------------------------------------------------
// Pure geometry for the eight Wearable slots: anchors, footprints (ink
// included) and keep-clear zones, resolved per AxolotlArtLook. The Head, Neck
// and Face numbers sit on the head and never move. The Tail, Shirt, Back,
// Socks and Feet numbers ride the look's tail, torso edge and leg roots. A
// footprint is a conservative local box unless its comment says otherwise.
// Painters (drawWearables.ts) and tests read these; nothing here paints.

/** The eight Wearable slots, in PRD order (guide 6i). */
export type WearableSlot = 'head' | 'neck' | 'face' | 'shirt' | 'back' | 'tail' | 'socks' | 'feet';
export const WEARABLE_SLOTS: readonly WearableSlot[] = [
  'head',
  'neck',
  'face',
  'shirt',
  'back',
  'tail',
  'socks',
  'feet',
];

/** Slots painted over the body or head: one layer each (guide 6a). */
export type BodyWearableSlot = Exclude<WearableSlot, 'socks' | 'feet'>;
/** Layer of each body Wearable (guide 6a). */
export const WEARABLE_LAYERS: Readonly<Record<BodyWearableSlot, number>> = {
  shirt: 9.3,
  tail: 9.2,
  neck: 9.5,
  back: 9.7,
  head: 10.5,
  face: 11.5,
};
/**
 * Layer of the Socks and Feet items, per leg side (guide 6a): the far pair
 * paints at 2.5 and the near pair at 3.5, both behind the silhouette (layer 4).
 * On one leg the Sock paints first, then the Feet item over it.
 */
export const LEG_WEARABLE_LAYERS = { far: 2.5, near: 3.5 } as const;
/** The silhouette layer: Socks and Feet sit behind it (guide 6a). */
export const SILHOUETTE_LAYER = 4;
/** The eye layer, above every Wearable layer; a Girl's lashes paint on it (guide 6a). */
export const EYES_LAYER = 12;

/** Side of a leg by its draw index: far-front, far-rear, then near-front, near-rear (guide 6e). */
export function legSide(legIndex: number): 'far' | 'near' {
  return legIndex < 2 ? 'far' : 'near';
}

/** Layer of the Socks and Feet items on a leg (guide 6a). */
export function legWearableLayer(legIndex: number): number {
  return LEG_WEARABLE_LAYERS[legSide(legIndex)];
}

/** A circle in local units. */
export interface ZoneCircle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Keep-clear zones (guide 6i). The eye zone is the prototype bead radius plus EYE_ZONE_MARGIN. */
export const NEAR_EYE_ZONE: ZoneCircle = { x: NEAR_EYE.x, y: NEAR_EYE.y, r: NEAR_EYE.r + EYE_ZONE_MARGIN };
export const FAR_EYE_ZONE: ZoneCircle = { x: FAR_EYE.x, y: FAR_EYE.y, r: FAR_EYE.r + EYE_ZONE_MARGIN };
/** Holds all six gill roots plus the stem ink. */
export const GILL_ROOT_ZONE: Bounds = { minX: -5, minY: -22, maxX: 12, maxY: 13 };
/**
 * Ink of the first four mouths plus 1 unit; every mouth variant stays inside it.
 * It boxes the mouth for the rig face part and the crops. It is not a keep-clear
 * zone for Wearables (#88): the mouth paints at 11, over the Neck (9.5) and Head
 * (10.5) items, so a Neck item under it never hides it.
 */
export const MOUTH_ZONE: Bounds = { minX: 24.4, minY: 2.6, maxX: 52.4, maxY: 21.3 };
/** A Girl's lash reach circle about an eye: the prototype bead radius plus LASH_REACH. */
export function lashReachCircle(spot: EyeSpot): ZoneCircle {
  return { x: spot.x, y: spot.y, r: spot.r + LASH_REACH };
}
export const NEAR_LASH_REACH: ZoneCircle = lashReachCircle(NEAR_EYE);
export const FAR_LASH_REACH: ZoneCircle = lashReachCircle(FAR_EYE);
/** No Shirt or Back ink past x -5.5: 0.5 units short of the gill-root zone (guide 6i; -6.8 before #88). */
export const SHIRT_BACK_FRONT_LINE_X = -5.5;
/** Width of the band just inside the torso edge that the Shirt never paints (guide 6i; 3 before #88). */
export const TORSO_EDGE_BAND = 1;

/** A wearable frame: an origin and the rotation of its u axis (x' for Back). v is u turned by +90 degrees. */
export interface WearFrame {
  readonly x: number;
  readonly y: number;
  /** Radians, y down. u runs along (cos angle, sin angle); v along (-sin angle, cos angle). */
  readonly angle: number;
}

/** A frame point (u along, v across) in local units. */
export function framePoint(frame: WearFrame, u: number, v: number): LocalPoint {
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  return { x: frame.x + u * c - v * s, y: frame.y + u * s + v * c };
}

// -- Head, Neck, Face: on the head, never move (guide 6i) --

/** Head item anchor: the head top. */
export const HEAD_SLOT_ANCHOR: LocalPoint = { x: 26, y: -23 };
/**
 * Head footprint: rests on the head outline, lowest point y -19.5, back edge x
 * 16. #88 grows it forward to x 46 (36 before) and lowers its top to y -44 (-46
 * before): the Head item may pass the head outline forward and up.
 */
export const HEAD_FOOTPRINT: Bounds = { minX: 16, minY: -44, maxX: 46, maxY: -19.5 };
/**
 * Big Head footprint (issue #207), opt-in for a named Head item: HEAD_FOOTPRINT
 * grown forward to x 56 and up to y -72, the same back edge (x 16) and lowest
 * point (y -19.5), so it keeps every Head keep-clear rule and stays 4 or more
 * units inside the AXO_TEX frame (top y -79).
 */
export const HEAD_BIG_FOOTPRINT: Bounds = { minX: 16, minY: -72, maxX: 56, maxY: -19.5 };

/** Neck item anchor: the throat. */
export const NECK_SLOT_ANCHOR: LocalPoint = { x: 17, y: 16 };
/**
 * Neck footprint (#88): a collar box under the chin, below GILL_ROOT_ZONE (y 13)
 * and over the mouth-zone box, its bottom LW / 2 under the head's lowest point
 * (y 22.75). The Neck item's paint, not this box, keeps clear of CHEEK_HEART_ZONE
 * and GILL_ROOT_ZONE and stays LW / 2 or more inside the outer edge of the
 * silhouette's outline on every look, so the outline's outer half always shows
 * and nothing hangs below it: the front legs stay visible.
 */
export const NECK_FOOTPRINT: Bounds = { minX: 2, minY: 13.1, maxX: 42, maxY: 22.75 };

/** Face item anchor: between the eyes. */
export const FACE_SLOT_ANCHOR: LocalPoint = { x: 35, y: -6.5 };
/** Glasses lens circles, near then far: the merged frame is their union outline. */
export const GLASSES_LENSES: readonly ZoneCircle[] = [
  { x: 28, y: -6, r: 9.95 },
  { x: 42, y: -7, r: 8.85 },
];
/** Glasses band width, centred on the union outline: its inner edge lies on the eye zones. */
export const GLASSES_BAND = 3.5;
/** Optional temple stub reaches back to this x at most. */
export const GLASSES_TEMPLE_MIN_X = 14;
/** Glasses outer extents, band included: x 16.3 to 52.6, y -17.7 to 5.7. */
export const GLASSES_EXTENT: Bounds = unionBounds(
  GLASSES_LENSES.map((lens) => boundsOfPoints([[lens.x, lens.y]], lens.r + GLASSES_BAND / 2)),
);

/** The two points where the lens circles cross: the top notch first, then the underside notch. */
export function glassesNotches(): [LocalPoint, LocalPoint] {
  const [a, b] = GLASSES_LENSES;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const half = Math.sqrt(a.r * a.r - along * along);
  const mx = a.x + (dx * along) / d;
  const my = a.y + (dy * along) / d;
  const top = { x: mx + (dy * half) / d, y: my - (dx * half) / d };
  const under = { x: mx - (dy * half) / d, y: my + (dx * half) / d };
  return top.y < under.y ? [top, under] : [under, top];
}

/**
 * Points on the glasses' merged outline (each lens circle, less the part inside
 * the other lens), `stepsPerLens` per circle before the cut. The band is centred on it.
 */
export function glassesOutlinePoints(stepsPerLens = 180): LocalPoint[] {
  const points: LocalPoint[] = [];
  GLASSES_LENSES.forEach((lens, i) => {
    const other = GLASSES_LENSES[1 - i];
    for (let k = 0; k < stepsPerLens; k++) {
      const a = (k / stepsPerLens) * Math.PI * 2;
      const p = { x: lens.x + Math.cos(a) * lens.r, y: lens.y + Math.sin(a) * lens.r };
      if (Math.hypot(p.x - other.x, p.y - other.y) >= other.r) points.push(p);
    }
  });
  return points;
}

// -- Shirt: the torso only (guide 6i) --

/** The Shirt's front edge, ink included: on the front line (-7.5 before #88). */
export const SHIRT_FRONT_X = SHIRT_BACK_FRONT_LINE_X;
/** The front edge has a neckline: a concave arc bowing back this far, to x -7 (3 before #88). */
export const SHIRT_NECKLINE_DEPTH = 1.5;

/** Shirt footprint for a look. */
export interface ShirtGeometry {
  /** The look's torso centre (cx, 4). */
  readonly anchor: LocalPoint;
  /** The torso ellipse inset by TORSO_EDGE_BAND all round: the Shirt, ink included, stays inside it. */
  readonly inset: BodyEllipse;
  /** The Shirt is cut at the tail root x at the rear (guide 6r). */
  readonly rearX: number;
  readonly frontX: number;
  /** The front edge: its ends on the inset ellipse, and the neckline apex x it bows back to. */
  readonly neckline: { readonly x: number; readonly yTop: number; readonly yBottom: number; readonly apexX: number };
  /** Box of the footprint: the inset ellipse between rearX and frontX. */
  readonly bounds: Bounds;
}

/** Shirt footprint of a look (guide 6i: over all 54 looks x -38 to -5.5, y -22 to 30). */
export function shirtGeometry(look: AxolotlArtLook): ShirtGeometry {
  const geo = axolotlBodyGeometry(look);
  const { torso } = geo;
  const inset: BodyEllipse = {
    cx: torso.cx,
    cy: torso.cy,
    rx: torso.rx - TORSO_EDGE_BAND,
    ry: torso.ry - TORSO_EDGE_BAND,
  };
  const rearX = Math.max(geo.tail.rootX, inset.cx - inset.rx);
  const frontX = SHIRT_FRONT_X;
  const halfAt = (x: number): number => inset.ry * Math.sqrt(Math.max(0, 1 - ((x - inset.cx) / inset.rx) ** 2));
  const nearestX = Math.min(Math.max(inset.cx, rearX), frontX);
  const half = halfAt(nearestX);
  const frontHalf = halfAt(frontX);
  return {
    anchor: { x: torso.cx, y: torso.cy },
    inset,
    rearX,
    frontX,
    neckline: {
      x: frontX,
      yTop: inset.cy - frontHalf,
      yBottom: inset.cy + frontHalf,
      apexX: frontX - SHIRT_NECKLINE_DEPTH,
    },
    bounds: { minX: rearX, minY: inset.cy - half, maxX: frontX, maxY: inset.cy + half },
  };
}

/** Whether (x, y) lies inside the Shirt's footprint (the inset ellipse, between rearX and frontX). */
export function shirtContains(shirt: ShirtGeometry, x: number, y: number): boolean {
  const e = shirt.inset;
  return x >= shirt.rearX && x <= shirt.frontX && ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
}

// -- Back: rides the torso top edge (guide 6i) --

/** The Back anchor sits on the torso top edge at this local x. */
export const BACK_ANCHOR_X = -17;
/** The Back box's outer edge, ink included: y' -14, proud of the back against the water (#88; -8 before). */
export const BACK_BOX_MIN_V = -14;
/** The Back box's body-side edge, ink included: y' 3 into the body, so the Back fill never meets the Shirt's fill (#88; 5 before). */
export const BACK_BOX_MAX_V = 3;
/** The Back box is this long along the edge, or half the torso length (2 rx - 30) when that is more (#88). */
export const BACK_BOX_MIN_LENGTH = 22;
/** The big Back box's outer edge, ink included (issue #207): y' -30, opt-in for a named Back item; every other edge as the Back box. */
export const BACK_BIG_BOX_MIN_V = -30;

/**
 * Back frame on a torso: the origin is the point on the top edge at
 * BACK_ANCHOR_X, and x' follows the edge's tangent toward the snout (it rises,
 * so the angle is negative while the anchor is behind the torso centre).
 */
export function backFrame(torso: BodyEllipse): WearFrame {
  const u = (BACK_ANCHOR_X - torso.cx) / torso.rx;
  const root = Math.sqrt(1 - u * u);
  return {
    x: BACK_ANCHOR_X,
    y: torso.cy - torso.ry * root,
    angle: Math.atan(((torso.ry / torso.rx) * u) / root),
  };
}

/** The Back footprint in its frame, ink included: x' along the edge toward the snout, y' across (+ into the body). */
export interface BackFrameBox {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}

/**
 * Back box on a torso (#88): its forward body-side corner (maxU, BACK_BOX_MAX_V)
 * sits on SHIRT_BACK_FRONT_LINE_X, the forward-most point of the box as the
 * frame rises toward the snout, and it runs back from there along the edge by
 * BACK_BOX_MIN_LENGTH or half the torso length (2 rx - 30), whichever is more.
 * `minV` is its outer edge: BACK_BOX_MIN_V, or BACK_BIG_BOX_MIN_V for the big box.
 */
export function backFrameBox(torso: BodyEllipse, minV: number = BACK_BOX_MIN_V): BackFrameBox {
  const frame = backFrame(torso);
  const maxU =
    (SHIRT_BACK_FRONT_LINE_X - frame.x + BACK_BOX_MAX_V * Math.sin(frame.angle)) / Math.cos(frame.angle);
  const length = Math.max(BACK_BOX_MIN_LENGTH, (2 * torso.rx - 30) / 2);
  return { minU: maxU - length, maxU, minV, maxV: BACK_BOX_MAX_V };
}

/** Back footprint for a look: its frame, its box in the frame, the four corners and the local box. */
export interface BackFootprint {
  readonly frame: WearFrame;
  readonly box: BackFrameBox;
  /** Corners in order: (minU,minV), (maxU,minV), (maxU,maxV), (minU,maxV). */
  readonly corners: readonly LocalPoint[];
  readonly bounds: Bounds;
}

/** The Back footprint of `look` with its outer edge at `outerV`. */
function buildBackFootprint(look: AxolotlArtLook, outerV: number): BackFootprint {
  const { torso } = axolotlBodyGeometry(look);
  const frame = backFrame(torso);
  const box = backFrameBox(torso, outerV);
  const { minU, maxU, minV, maxV } = box;
  const corners = [
    framePoint(frame, minU, minV),
    framePoint(frame, maxU, minV),
    framePoint(frame, maxU, maxV),
    framePoint(frame, minU, maxV),
  ];
  return { frame, box, corners, bounds: boundsOfPoints(corners.map((p): [number, number] => [p.x, p.y]), 0) };
}

/** The Back footprint of `look`: the Back box, outer edge BACK_BOX_MIN_V. */
export function backFootprint(look: AxolotlArtLook): BackFootprint {
  return buildBackFootprint(look, BACK_BOX_MIN_V);
}

/** The big Back footprint of `look` (issue #207), opt-in for a named Back item: outer edge BACK_BIG_BOX_MIN_V. */
export function backBigFootprint(look: AxolotlArtLook): BackFootprint {
  return buildBackFootprint(look, BACK_BIG_BOX_MIN_V);
}

// -- Tail: the core top at tail point 4 (guide 6i) --

/** The Tail footprint stays within this many units of its anchor: it holds the taller Golden bow's ink (#88; 9, then 12, before). */
export const TAIL_SLOT_REACH = 17.5;

/**
 * Tail anchor frame: the core top at TAIL_SLOT_POINT, turned with the local
 * tail direction (tailAngleAt) so a Tail item follows the wave.
 */
export function tailSlotFrame(tail: TailGeometry, swim: number, tailAmp: number): WearFrame {
  const s = TAIL_SLOT_POINT / TAIL_SEGMENTS;
  const tp = tailPointAt(s, swim, tailAmp, tail);
  return { x: tp.x, y: tp.cy - tp.hc, angle: tailAngleAt(s, swim, tailAmp, tail) };
}

/** Box of the Tail footprint about its anchor. */
export function tailSlotBounds(frame: WearFrame): Bounds {
  return boundsOfPoints([[frame.x, frame.y]], TAIL_SLOT_REACH);
}

// -- Socks and Feet: in leg space (guide 6i) --

/** A swinging leg's frame: origin at the leg root, u along the leg (guide 6i leg space). */
export interface LegSlotFrame extends WearFrame {
  /** Leg draw index: far-front, far-rear, near-front, near-rear. */
  readonly index: number;
  readonly side: 'far' | 'near';
  /** Leg tube length l. */
  readonly length: number;
  /** Toe length t. */
  readonly toeLength: number;
  /** A Baby's feet are narrower. */
  readonly baby: boolean;
}

/** Leg swing amplitude and rest angles (guide 6e, 9); the same as the leg painter's. */
export const LEG_SWING = 0.35;
const LEG_REST_ANGLES: readonly number[] = [Math.PI / 2 - 0.2, Math.PI / 2 + 0.5, Math.PI / 2 - 0.2, Math.PI / 2 + 0.5];
const LEG_SWING_OFFSETS: readonly number[] = [Math.PI, 0, 0, Math.PI];

/** Angle of leg `legIndex` at swim phase `swim`. */
export function legAngle(legIndex: number, swim: number): number {
  return LEG_REST_ANGLES[legIndex] + LEG_SWING * Math.sin(swim + LEG_SWING_OFFSETS[legIndex]);
}

/** The four leg frames of a look at a swim phase, in leg draw order. */
export function legSlotFrames(look: AxolotlArtLook, swim: number): LegSlotFrame[] {
  const geo = axolotlBodyGeometry(look);
  return geo.legRoots.map((root, index) => ({
    x: root.x,
    y: root.y,
    angle: legAngle(index, swim),
    index,
    side: legSide(index),
    length: geo.legLengths[index],
    toeLength: geo.toeLength,
    baby: look.age === 'baby',
  }));
}

/** A rounded rectangle in leg space, ink included: u from u0 to u1, v from -vHalf to +vHalf. */
export interface LegRect {
  readonly u0: number;
  readonly u1: number;
  readonly vHalf: number;
  /** Corner radius, already capped to half of each side. 0 for the Feet envelope. */
  readonly radius: number;
}

/** Corner radius of a foot pad and a Shoe, before it is capped to half of each side (guide 6i). */
export const FOOT_CORNER_RADIUS = 8;
/**
 * Sock sleeve: colour width 11.6, `ol` 2.4, so ink width 16.4, round ends (#88; colour 10.4 before):
 * the widest whose box stays clear of the near lash reach on a Slim look's near-front leg.
 */
export const SOCK_SLEEVE_W = 11.6;
export const SOCK_SLEEVE_OL = 2.4;
export const SOCK_SLEEVE_INK_W = SOCK_SLEEVE_W + 2 * SOCK_SLEEVE_OL;
/** Foot pad and Shoe start this far behind the leg end (u = l - 2.0). */
export const FOOT_BACK_U = 2;
/**
 * Feet envelope starts this far behind the leg end (u = l - 2.0, where the pad, a Shoe and the
 * Flippers start; #88, 3.0 before), so its wider back corner stays within 1 of the gill-root zone.
 */
export const FEET_ENVELOPE_BACK_U = 2;
/** Foot pad reaches this far past the toe tips (u = l + t + 6.0; #88, 5.3 before). */
export const SOCK_PAD_FRONT = 6;
/** Shoe reaches this far past the toe tips (u = l + t + 7.6; #88, 6.8 before): 1.5 or more past the pad's ink, ink included. */
export const SHOE_FRONT = 7.6;
/**
 * Feet envelope reaches this far past the toe tips (u = l + t + 10.3; #88, 10.0 before): as far as the
 * frame bottom allows at half width 13.5, its square corner lowest at y 58.87 (4 or more inside the frame).
 */
export const FEET_ENVELOPE_FRONT = 10.3;
/**
 * Foot pad, Shoe and Feet envelope half widths, ink included; a Baby's pad and Shoe are narrower (#88:
 * pad 10.2 and 8.9, Shoe 11.7 and 10.8, envelope 12 before).
 */
export const SOCK_PAD_HALF_WIDTH = { grown: 11.2, baby: 9.9 } as const;
export const SHOE_HALF_WIDTH = { grown: 13.2, baby: 12.2 } as const;
export const FEET_ENVELOPE_HALF_WIDTH = 13.5;

function legRect(frame: LegSlotFrame, back: number, front: number, vHalf: number, radius: number): LegRect {
  const u0 = frame.length - back;
  const u1 = frame.length + frame.toeLength + front;
  return { u0, u1, vHalf, radius: Math.min(radius, (u1 - u0) / 2, vHalf) };
}

/** The Sock's foot pad over the toes. It sits inside the Feet envelope. */
export function sockFootPad(frame: LegSlotFrame): LegRect {
  const half = frame.baby ? SOCK_PAD_HALF_WIDTH.baby : SOCK_PAD_HALF_WIDTH.grown;
  return legRect(frame, FOOT_BACK_U, SOCK_PAD_FRONT, half, FOOT_CORNER_RADIUS);
}

/** A rounded-rectangle Feet item (a Shoe). Its fill covers the Sock's foot pad. */
export function shoeRect(frame: LegSlotFrame): LegRect {
  const half = frame.baby ? SHOE_HALF_WIDTH.baby : SHOE_HALF_WIDTH.grown;
  return legRect(frame, FOOT_BACK_U, SHOE_FRONT, half, FOOT_CORNER_RADIUS);
}

/**
 * The Feet envelope: every Feet item (Shoe, Flippers) stays inside it. A plain
 * box (square corners, radius 0): its measured extents (lowest y 58.87, x
 * -62.6 to 47.2 over every look and swim phase; #88, y 58.06 and x -61.4 to
 * 45.8 before) are its corners.
 */
export function feetEnvelope(frame: LegSlotFrame): LegRect {
  return legRect(frame, FEET_ENVELOPE_BACK_U, FEET_ENVELOPE_FRONT, FEET_ENVELOPE_HALF_WIDTH, 0);
}

/** Local box of a leg-space rounded rectangle (exact: the inner corners grown by the corner radius). */
export function legRectBounds(frame: LegSlotFrame, rect: LegRect): Bounds {
  const inner = rect.vHalf - rect.radius;
  const corners: [number, number][] = [];
  for (const u of [rect.u0 + rect.radius, rect.u1 - rect.radius]) {
    for (const v of [-inner, inner]) {
      const p = framePoint(frame, u, v);
      corners.push([p.x, p.y]);
    }
  }
  return boundsOfPoints(corners, rect.radius);
}

/** Local box of the Sock sleeve: the leg root to the leg end, round ends, ink included. Behind the silhouette. */
export function sockSleeveBounds(frame: LegSlotFrame): Bounds {
  const end = framePoint(frame, frame.length, 0);
  return boundsOfPoints(
    [
      [frame.x, frame.y],
      [end.x, end.y],
    ],
    SOCK_SLEEVE_INK_W / 2,
  );
}
