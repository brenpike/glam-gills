import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AXO_LEG_ROOTS,
  AXO_PREVIEW_CROPS,
  AXO_REST_POSE,
  AXO_TEX,
  axolotlInkBounds,
  axolotlLegRoots,
  drawAxolotl,
} from './drawAxolotl';
import { CHEEK_HEART, INK, LEUCISTIC, LW, T_STATIC, WHITE } from './palette';
import { rigParts } from './axolotlRigParts';
import { NO_OUTFIT } from './drawWearables';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_SIZES,
  AXO_SIZE_SCALE,
  AXO_TAILS,
  BACK_ANCHOR_X,
  BACK_BIG_BOX_MIN_V,
  BACK_BOX_MAX_V,
  BACK_BOX_MIN_LENGTH,
  BACK_BOX_MIN_V,
  CHEEK_HEART_CENTRE,
  CHEEK_HEART_INK,
  CHEEK_HEART_LAYER,
  CHEEK_HEART_UNDER,
  CHEEK_HEART_ZONE,
  DEFAULT_ART_LOOK,
  EYES_LAYER,
  EYE_LID_INK,
  EYELASH_INK,
  EYELASH_UNDER,
  EYE_VARIANTS,
  FAR_EYE,
  FAR_GILL_ROOTS,
  FEET_ENVELOPE_HALF_WIDTH,
  GILL_STEM_OL,
  GILL_STEM_W,
  GILL_STYLES,
  GILL_STYLE_IDS,
  GLASSES_BAND,
  GLASSES_EXTENT,
  GLASSES_LENSES,
  GLASSES_TEMPLE_MIN_X,
  HEAD_ELLIPSE,
  HEAD_BIG_FOOTPRINT,
  HEAD_FOOTPRINT,
  HEAD_SLOT_ANCHOR,
  LASH_REACH,
  LEG_WEARABLE_LAYERS,
  MOUTH_VARIANTS,
  NECK_FOOTPRINT,
  NECK_SLOT_ANCHOR,
  NEAR_EYE,
  NEAR_GILL_ROOTS,
  PROTOTYPE_BELLY,
  PROTOTYPE_TAIL,
  PROTOTYPE_TORSO,
  SPOTS_OPTIONS,
  SHIRT_BACK_FRONT_LINE_X,
  SHIRT_FRONT_X,
  SHIRT_NECKLINE_DEPTH,
  SILHOUETTE_LAYER,
  SPOT_SETS,
  TAIL_SEGMENTS,
  TAIL_SLOT_POINT,
  TAIL_SLOT_REACH,
  TORSO_EDGE_BAND,
  WEARABLE_LAYERS,
  WEARABLE_SLOTS,
  FACE_SLOT_ANCHOR,
  FAR_EYE_ZONE as CODE_FAR_EYE_ZONE,
  FAR_LASH_REACH,
  GILL_ROOT_ZONE as CODE_GILL_ROOT_ZONE,
  MOUTH_ZONE as CODE_MOUTH_ZONE,
  NEAR_EYE_ZONE as CODE_NEAR_EYE_ZONE,
  NEAR_LASH_REACH,
  axolotlBodyGeometry,
  backBigFootprint,
  backFootprint,
  backFrameBox,
  backFrame,
  boundsOfPoints,
  cheekHeartPoints,
  eyeMarks,
  eyelashMarks,
  feetEnvelope,
  framePoint,
  gillGeometry,
  gillInkBounds,
  gillSpecs,
  glassesNotches,
  grumpyBrow,
  grumpyBrowInkBounds,
  glassesOutlinePoints,
  legAngle,
  legRectBounds,
  legSide,
  legSlotFrames,
  legWearableLayer,
  mouthInkBounds,
  MOUTH_INK,
  MOUTH_TICK_INK,
  paintCheekHeart,
  paintEye,
  paintMouth,
  quadBounds,
  shirtContains,
  shirtGeometry,
  shoeRect,
  sockFootPad,
  sockSleeveBounds,
  spotMarks,
  tailPointAt,
  tailSamples,
  tailSlotBounds,
  tailSlotFrame,
  unionBounds,
  type AxolotlArtLook,
  type BodyEllipse,
  type BodyMark,
  type Bounds,
  type EyeLash,
  type EyeSpot,
  type EyeVariant,
  type GillRoot,
  type LocalPoint,
  type MouthVariant,
  type SpotsOption,
  type WearableSlot,
  type ZoneCircle,
} from './drawAxolotlParts';

const TAU = Math.PI * 2;
/** Guide 11: at least 4 px padding at 1x. */
const FRAME_PAD = 4;
const PHASES = Array.from({ length: 721 }, (_, i) => (i / 720) * TAU);

/** Guide 6i keep-clear zones. */
const NEAR_EYE_ZONE = { x: 28, y: -6, r: 8.2 };
const FAR_EYE_ZONE = { x: 42, y: -7, r: 7.1 };
const GILL_ROOT_ZONE = { minX: -5, minY: -22, maxX: 12, maxY: 13 };

/**
 * Guide 6l asks for about 45% of the bead. Sleepy's lid, built exactly as 6l
 * describes, leaves about 43.6%, so "about" is held at 43%.
 */
const MIN_BEAD_SHARE = 0.43;

/** Share of the round bead (prototype radius) left visible below the lid, by grid sampling. */
function visibleBeadShare(variant: (typeof EYE_VARIANTS)[number]): number {
  const r = 1;
  const marks = eyeMarks(variant, r);
  const steps = 400;
  let inside = 0;
  let shown = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x = -r + ((i + 0.5) / steps) * 2 * r;
      const y = -r + ((j + 0.5) / steps) * 2 * r;
      if (Math.hypot(x, y) > r) continue;
      inside++;
      if (Math.hypot(x, y) <= marks.beadR && isBelowLid(marks.lid, x, y)) shown++;
    }
  }
  return shown / inside;
}

function isBelowLid(lid: ReturnType<typeof eyeMarks>['lid'], x: number, y: number): boolean {
  if (!lid) return true;
  const u = (x - lid.x1) / (lid.x2 - lid.x1);
  const m = 1 - u;
  const lidY = m * m * lid.y1 + 2 * u * m * lid.cy + u * u * lid.y2;
  return y >= lidY;
}

function boxCircleGap(b: Bounds, c: { x: number; y: number; r: number }): number {
  const dx = Math.max(b.minX - c.x, 0, c.x - b.maxX);
  const dy = Math.max(b.minY - c.y, 0, c.y - b.maxY);
  return Math.hypot(dx, dy) - c.r;
}

/** Blink squashes checked for lash paint: open, half shut and the 12% blink (guide 6c). */
const LASH_BLINKS = [1, 0.5, 0.12] as const;
/** Both lash strokes: the white under-stroke and the ink. */
const LASH_WIDTHS = [EYELASH_UNDER, EYELASH_INK] as const;
/** Lash readability floor: centre-line length clear of the bead. */
const MIN_LASH_INK_PAST_BEAD = 2.5;
/** Lash ends sit on the lash reach circle, this far inside r + LASH_REACH. */
const LASH_REACH_INSET = 0.05;
/** Lash corners stay right of this x, clear of the gill stems (stem ink ends at x 15.5). */
const LASH_MIN_X = 16.5;
/** Lash corners stay below this y: the Head slot's lowest painted point (guide 6i). */
const LASH_MIN_Y = -19.5;
/** Smallest drawn scale, in CSS px per local unit: Small (0.72) in the shrunk creator preview (0.6, PREVIEW_SCALE). */
const SMALLEST_PX_PER_UNIT = 0.72 * 0.6;

/**
 * Corners of a lash's butt-capped stroke `width` wide (its ends offset by half
 * the width each side, square to the lash), after the blink squash about the
 * eye centre. With butt caps these four corners bound all of its paint.
 */
function lashStrokeCorners(lash: EyeLash, width: number, blink: number): LocalPoint[] {
  const len = Math.hypot(lash.x2 - lash.x1, lash.y2 - lash.y1);
  const nx = (-(lash.y2 - lash.y1) / len) * (width / 2);
  const ny = ((lash.x2 - lash.x1) / len) * (width / 2);
  return [
    { x: lash.x1 + nx, y: (lash.y1 + ny) * blink },
    { x: lash.x1 - nx, y: (lash.y1 - ny) * blink },
    { x: lash.x2 + nx, y: (lash.y2 + ny) * blink },
    { x: lash.x2 - nx, y: (lash.y2 - ny) * blink },
  ];
}

/** Every corner of both lash strokes at every blink, relative to the eye centre. */
function allLashCorners(lash: EyeLash): LocalPoint[] {
  return LASH_BLINKS.flatMap((blink) => LASH_WIDTHS.flatMap((width) => lashStrokeCorners(lash, width, blink)));
}

/** Radius of the lash reach circle about an eye centre: every lash corner stays inside it. */
function lashReachR(spot: EyeSpot): number {
  return spot.r + LASH_REACH - LASH_REACH_INSET;
}

/** Whether a local point lies inside an axis-aligned ellipse. */
function isInEllipse(p: LocalPoint, e: BodyEllipse): boolean {
  return ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2 <= 1;
}

/**
 * Whether every corner of both lash strokes, at every blink, lies inside the
 * lash reach circle and the head, right of LASH_MIN_X and below LASH_MIN_Y.
 */
function lashPaintHolds(lash: EyeLash, spot: EyeSpot): boolean {
  const reachR = lashReachR(spot) + 1e-9;
  return allLashCorners(lash).every((corner) => {
    const local = { x: spot.x + corner.x, y: spot.y + corner.y };
    return (
      Math.hypot(corner.x, corner.y) <= reachR &&
      isInEllipse(local, HEAD_ELLIPSE) &&
      local.x >= LASH_MIN_X &&
      local.y >= LASH_MIN_Y
    );
  });
}

/** Length of a lash's centre line outside the bead circle: ink the bead never paints over. */
function inkPastBead(lash: EyeLash, beadR: number): number {
  const len = Math.hypot(lash.x2 - lash.x1, lash.y2 - lash.y1);
  const ux = (lash.x2 - lash.x1) / len;
  const uy = (lash.y2 - lash.y1) / len;
  const along = lash.x1 * ux + lash.y1 * uy;
  const disc = along * along - (lash.x1 * lash.x1 + lash.y1 * lash.y1 - beadR * beadR);
  if (disc <= 0) return len;
  const enter = Math.max(0, -along - Math.sqrt(disc));
  const leave = Math.min(len, -along + Math.sqrt(disc));
  return len - Math.max(0, leave - enter);
}

/** The AXO_TEX frame as local bounds, shrunk by `pad` on every side. */
function frameInner(pad: number): Bounds {
  return {
    minX: -AXO_TEX.originX + pad,
    minY: -AXO_TEX.originY + pad,
    maxX: AXO_TEX.w - AXO_TEX.originX - pad,
    maxY: AXO_TEX.h - AXO_TEX.originY - pad,
  };
}

function isInside(inner: Bounds, outer: Bounds): boolean {
  return (
    inner.minX >= outer.minX && inner.minY >= outer.minY && inner.maxX <= outer.maxX && inner.maxY <= outer.maxY
  );
}

function expectInside(inner: Bounds, outer: Bounds): void {
  expect(inner.minX).toBeGreaterThanOrEqual(outer.minX);
  expect(inner.minY).toBeGreaterThanOrEqual(outer.minY);
  expect(inner.maxX).toBeLessThanOrEqual(outer.maxX);
  expect(inner.maxY).toBeLessThanOrEqual(outer.maxY);
}

/** Every creator look of eyes, mouth, gills, spots, sex, tail, body and age (size scales the bake only). */
function everyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const eyes of EYE_VARIANTS)
    for (const mouth of MOUTH_VARIANTS)
      for (const gills of GILL_STYLE_IDS)
        for (const spots of SPOTS_OPTIONS)
          for (const sex of AXO_SEXES)
            for (const tail of AXO_TAILS)
              for (const body of AXO_BODIES)
                for (const age of AXO_AGES)
                  looks.push({ eyes, mouth, gills, spots, size: 'medium', sex, tail, body, age });
  return looks;
}
const EVERY_LOOK = everyLook();

/** Memoise a per-look check on the look fields it reads, so the full enumeration stays fast. */
function memoBy<T>(keyOf: (look: AxolotlArtLook) => string, compute: (look: AxolotlArtLook) => T) {
  const cache = new Map<string, T>();
  return (look: AxolotlArtLook): T => {
    const key = keyOf(look);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = compute(look);
    cache.set(key, value);
    return value;
  };
}

const SWIM_SAMPLES = PHASES.filter((_, i) => i % 20 === 0);
const GILL_SAMPLES = PHASES.filter((_, i) => i % 20 === 0);
/** The full enumeration is heavy; give it room when the whole suite runs in parallel. */
const ENUMERATION_TIMEOUT_MS = 30_000;
const TAIL_AMPS = [1, 1.6] as const;

/** Whether every point of a (rotated) mark ellipse lies inside an axis-aligned ellipse. */
function markInsideEllipse(m: BodyMark, e: BodyEllipse): boolean {
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * TAU;
    const lx = Math.cos(a) * m.rx;
    const ly = Math.sin(a) * m.ry;
    const x = m.x + lx * Math.cos(m.rot) - ly * Math.sin(m.rot);
    const y = m.y + lx * Math.sin(m.rot) + ly * Math.cos(m.rot);
    if (((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 > 1) return false;
  }
  return true;
}

/** Still pose (guide 9): tail and gills at t = T_STATIC, as the picture buttons draw them. */
const STILL_SWIM = (TAU * T_STATIC) / 1.2;
const STILL_GILL = (TAU * T_STATIC) / 0.8;
/** Near gill stem ink half-width: colour half-width plus outline (guide 6d). */
const STEM_INK_HALF = GILL_STEM_W / 2 + GILL_STEM_OL;
/**
 * Least share of each spot option's area left in view by the near gill stems
 * at the still pose, on every look. Patches ask less: on a Baby Slim with
 * Long gills the stems cover most of the back, and a blotch of area 110 or
 * more cannot fit clear of them, nor move further down a tail too thin to hold it.
 */
const SPOT_CLEAR_SHARE: Readonly<Record<SpotsOption, number>> = { none: 1, freckles: 0.7, dots: 0.7, patches: 0.5 };

function markArea(m: { readonly rx: number; readonly ry: number }): number {
  return Math.PI * m.rx * m.ry;
}

/** Smallest edge-to-edge gap between any two marks, as circles of their larger radius. */
function smallestEdgeGap(marks: readonly BodyMark[]): number {
  let gap = Infinity;
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      const reach = Math.max(marks[i].rx, marks[i].ry) + Math.max(marks[j].rx, marks[j].ry);
      gap = Math.min(gap, Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y) - reach);
    }
  }
  return gap;
}

/** Points along the centre lines of the three near gill stems of a look at the still pose. */
function nearStemPoints(look: AxolotlArtLook): [number, number][] {
  const points: [number, number][] = [];
  for (const spec of gillSpecs(look.gills, 'near', axolotlBodyGeometry(look).gillLength)) {
    const g = gillGeometry(spec, look.gills, STILL_GILL);
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const m = 1 - u;
      points.push([m * m * g.bx + 2 * u * m * g.cx + u * u * g.tx, m * m * g.by + 2 * u * m * g.cy + u * u * g.ty]);
    }
  }
  return points;
}

/** Points filling a (rotated) mark ellipse, on a 0.2 grid of its unit disc. */
function markFillPoints(m: BodyMark): [number, number][] {
  const points: [number, number][] = [];
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      if (i * i + j * j > 25) continue;
      const lx = (i / 5) * m.rx;
      const ly = (j / 5) * m.ry;
      points.push([m.x + lx * Math.cos(m.rot) - ly * Math.sin(m.rot), m.y + lx * Math.sin(m.rot) + ly * Math.cos(m.rot)]);
    }
  }
  return points;
}

/** Share of the marks' area outside the stem ink, sampled per mark and weighted by mark area. 1 for no marks. */
function clearAreaShare(marks: readonly BodyMark[], stems: readonly (readonly [number, number])[]): number {
  if (marks.length === 0) return 1;
  let clear = 0;
  let total = 0;
  for (const m of marks) {
    const points = markFillPoints(m);
    const inView = points.filter(([px, py]) =>
      stems.every(([sx, sy]) => Math.hypot(sx - px, sy - py) >= STEM_INK_HALF),
    ).length;
    clear += (markArea(m) * inView) / points.length;
    total += markArea(m);
  }
  return clear / total;
}

describe('creator look ids', () => {
  it('lists every option of guide 6l to 6o, plus Boy or girl, Tail, Body and Age', () => {
    expect(EYE_VARIANTS).toEqual(['happy', 'sleepy', 'determined', 'curious', 'grumpy']);
    expect(MOUTH_VARIANTS).toEqual(['smile', 'openD', 'tongueOut', 'smallO', 'bigGrin', 'catSmile', 'smirk', 'tongueTip']);
    expect(GILL_STYLE_IDS).toEqual(['fluffy', 'long', 'short']);
    expect(SPOTS_OPTIONS).toEqual(['none', 'freckles', 'dots', 'patches']);
    expect(AXO_SIZES).toEqual(['small', 'medium', 'large']);
    expect(AXO_SEXES).toEqual(['boy', 'girl']);
    expect(AXO_TAILS).toEqual(['short', 'medium', 'long']);
    expect(AXO_BODIES).toEqual(['slim', 'regular', 'chubby']);
    expect(AXO_AGES).toEqual(['baby', 'young', 'grownUp']);
  });

  it('defaults to the prototype face, gills, spots, body and age, as a Boy', () => {
    expect(DEFAULT_ART_LOOK).toEqual({
      eyes: 'happy',
      mouth: 'openD',
      gills: 'fluffy',
      spots: 'freckles',
      size: 'medium',
      sex: 'boy',
      tail: 'medium',
      body: 'regular',
      age: 'young',
    });
  });
});

describe('sizes (guide 6o)', () => {
  it('scales Small x0.72, Medium x0.85, Large x1', () => {
    expect(AXO_SIZE_SCALE).toEqual({ small: 0.72, medium: 0.85, large: 1 });
  });
});

/** Neighbouring Bodies: depth differs by at least this, and the deeper is at least this share deeper. */
const MIN_BODY_DEPTH_GAP = 8;
const MIN_BODY_DEPTH_SHARE = 0.2;
/** Same Body and Age: a Girl is at least this much deeper, her belly y radius at least this much bigger. */
const MIN_GIRL_DEPTH_GAIN = 6;
const MIN_GIRL_BELLY_GAIN = 3;
/** A Boy's peak fin reach over a Girl's, top and bottom. */
const MIN_BOY_FIN_RATIO = 1.45;

/** Body depth: the torso's full height, 2 x its y radius. */
function bodyDepth(look: AxolotlArtLook): number {
  return 2 * axolotlBodyGeometry(look).torso.ry;
}

/** Peak fin reach beyond the core (2-unit fin base plus fin x the largest rise), top and bottom, over the painted tail points. */
function peakFinReach(look: AxolotlArtLook): { top: number; bottom: number } {
  const samples = tailSamples(axolotlBodyGeometry(look).tail, 0, 1);
  return {
    top: Math.max(...samples.map((tp) => tp.finTop)),
    bottom: Math.max(...samples.map((tp) => tp.finBottom)),
  };
}

describe('body proportions (Boy or girl, Tail, Body, Age)', () => {
  const look = (over: Partial<AxolotlArtLook>): AxolotlArtLook => ({ ...DEFAULT_ART_LOOK, sex: 'girl', ...over });

  it('paint the prototype torso, belly and tail for a Young Regular Medium-tail Girl, bar the Girl cue', () => {
    const geo = axolotlBodyGeometry(look({}));
    expect(geo.torso).toEqual({ ...PROTOTYPE_TORSO, ry: PROTOTYPE_TORSO.ry + 3 });
    expect(geo.belly.rx).toBe(PROTOTYPE_BELLY.rx + 2);
    expect(geo.belly.ry).toBeCloseTo(PROTOTYPE_BELLY.ry + 3, 9);
    expect(geo.tail.length).toBe(PROTOTYPE_TAIL.length);
    expect([geo.tail.rootX, geo.tail.finTop, geo.tail.finBottom, geo.tail.finStart]).toEqual([-30, 9, 7, 3]);
    expect(geo.gillLength).toBe(1);
    expect(geo.legLengths).toEqual([14, 14, 15, 15]);
    expect(geo.toeLength).toBe(8.5);
  });

  it('paint the prototype torso and belly for the default Boy', () => {
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    expect(geo.torso).toEqual(PROTOTYPE_TORSO);
    expect(geo.belly).toEqual(PROTOTYPE_BELLY);
    expect(geo.tail).toEqual({ ...PROTOTYPE_TAIL, length: 48, finTop: 9 * 1.6, finBottom: 7 * 1.6, finStart: 1 });
  });

  it('set the tail core length by Tail, plus 4 for a Boy, x0.85 for a Baby', () => {
    for (const [tail, len] of [
      ['short', 36],
      ['medium', 44],
      ['long', 52],
    ] as const) {
      expect(axolotlBodyGeometry(look({ tail })).tail.length).toBe(len);
      expect(axolotlBodyGeometry(look({ tail, sex: 'boy' })).tail.length).toBe(len + 4);
      expect(axolotlBodyGeometry(look({ tail, age: 'baby' })).tail.length).toBeCloseTo(len * 0.85, 9);
    }
  });

  it('set torso and belly by Body', () => {
    const slim = axolotlBodyGeometry(look({ sex: 'boy', body: 'slim' }));
    expect([slim.torso.rx, slim.torso.ry, slim.belly.rx, slim.belly.ry]).toEqual([37, 15, 26, 4.2]);
    const chubby = axolotlBodyGeometry(look({ sex: 'boy', body: 'chubby' }));
    expect([chubby.torso.rx, chubby.torso.ry, chubby.belly.rx, chubby.belly.ry]).toEqual([39, 24, 28, 9.5]);
  });

  it('change only proportions by Age, keeping the head joint', () => {
    const baby = axolotlBodyGeometry(look({ age: 'baby' }));
    const grown = axolotlBodyGeometry(look({ age: 'grownUp' }));
    expect(baby.torso.rx).toBe(31);
    expect(grown.torso.rx).toBe(39);
    for (const geo of [baby, grown]) expect(geo.torso.cx + geo.torso.rx).toBe(29);
    expect(baby.gillLength).toBe(0.8);
    expect(grown.gillLength).toBe(1.12);
    expect(baby.legLengths).toEqual([14, 14, 15, 15].map((len) => len * 0.7));
    expect(baby.toeLength).toBeCloseTo(8.5 * 0.7, 9);
    expect(baby.tail.rootX - (baby.torso.cx - baby.torso.rx)).toBe(15);
    const young = axolotlBodyGeometry(look({}));
    expect(baby.legRoots[1].x).toBeGreaterThan(young.legRoots[1].x);
    expect(baby.legRoots[3].x).toBeGreaterThan(young.legRoots[3].x);
    expect(baby.legRoots[0]).toEqual(young.legRoots[0]);
    expect(baby.legRoots[2]).toEqual(young.legRoots[2]);
  });

  it('give a Boy taller fins starting nearer the body, and a Girl a rounder torso and a rounder, wider belly', () => {
    const boy = axolotlBodyGeometry(look({ sex: 'boy' }));
    const girl = axolotlBodyGeometry(look({}));
    expect(boy.tail.finTop).toBeCloseTo(girl.tail.finTop * 1.6, 9);
    expect(boy.tail.finBottom).toBeCloseTo(girl.tail.finBottom * 1.6, 9);
    expect([boy.tail.finStart, girl.tail.finStart]).toEqual([1, 3]);
    expect(girl.torso.ry - boy.torso.ry).toBeCloseTo(3, 9);
    expect(girl.belly.ry - boy.belly.ry).toBeCloseTo(3, 9);
    expect(girl.belly.rx - boy.belly.rx).toBeCloseTo(2, 9);
  });

  it('make each Body clearly deeper than the last: 8 or more and 20% or more, as a Boy or a Girl, at every Age', () => {
    for (const sex of AXO_SEXES) {
      for (const age of AXO_AGES) {
        const depths = AXO_BODIES.map((body) => bodyDepth(look({ sex, body, age })));
        for (let i = 1; i < depths.length; i++) {
          expect(depths[i] - depths[i - 1]).toBeGreaterThanOrEqual(MIN_BODY_DEPTH_GAP);
          expect(depths[i] / depths[i - 1]).toBeGreaterThanOrEqual(1 + MIN_BODY_DEPTH_SHARE);
        }
      }
    }
  });

  it('make a Girl clearly rounder than a Boy: 6 or more deeper, belly y radius 3 or more bigger, same Body and Age', () => {
    for (const body of AXO_BODIES) {
      for (const age of AXO_AGES) {
        const boy = axolotlBodyGeometry(look({ sex: 'boy', body, age }));
        const girl = axolotlBodyGeometry(look({ body, age }));
        expect(2 * girl.torso.ry).toBeGreaterThanOrEqual(2 * boy.torso.ry + MIN_GIRL_DEPTH_GAIN);
        expect(girl.belly.ry).toBeGreaterThanOrEqual(boy.belly.ry + MIN_GIRL_BELLY_GAIN);
      }
    }
  });

  it('give a Boy at least 1.45x the peak fin reach of a Girl, top and bottom, and an earlier fin start, at every Tail, Body and Age', () => {
    for (const tail of AXO_TAILS) {
      for (const body of AXO_BODIES) {
        for (const age of AXO_AGES) {
          const boy = peakFinReach(look({ sex: 'boy', tail, body, age }));
          const girl = peakFinReach(look({ tail, body, age }));
          expect(boy.top).toBeGreaterThanOrEqual(MIN_BOY_FIN_RATIO * girl.top);
          expect(boy.bottom).toBeGreaterThanOrEqual(MIN_BOY_FIN_RATIO * girl.bottom);
          const boyStart = axolotlBodyGeometry(look({ sex: 'boy', tail, body, age })).tail.finStart;
          expect(boyStart).toBeLessThan(axolotlBodyGeometry(look({ tail, body, age })).tail.finStart);
        }
      }
    }
  });

  it('read at the smallest drawn scale (Small in the shrunk preview, 0.432 px per unit)', () => {
    const px = (units: number): number => units * SMALLEST_PX_PER_UNIT;
    expect(SMALLEST_PX_PER_UNIT).toBeCloseTo(0.432, 9);
    for (const tail of AXO_TAILS) {
      for (const body of AXO_BODIES) {
        for (const age of AXO_AGES) {
          const boy = peakFinReach(look({ sex: 'boy', tail, body, age }));
          const girl = peakFinReach(look({ tail, body, age }));
          expect(px(boy.top - girl.top)).toBeGreaterThanOrEqual(2);
          expect(px(boy.top + boy.bottom - girl.top - girl.bottom)).toBeGreaterThanOrEqual(2);
          const boyDepth = bodyDepth(look({ sex: 'boy', tail, body, age }));
          expect(px(bodyDepth(look({ tail, body, age })) - boyDepth)).toBeGreaterThanOrEqual(2);
        }
      }
    }
    for (const sex of AXO_SEXES) {
      for (const age of AXO_AGES) {
        const depths = AXO_BODIES.map((body) => bodyDepth(look({ sex, body, age })));
        for (let i = 1; i < depths.length; i++) expect(px(depths[i] - depths[i - 1])).toBeGreaterThanOrEqual(3);
      }
    }
    for (const variant of EYE_VARIANTS) {
      for (const spot of [NEAR_EYE, FAR_EYE]) {
        const beadR = eyeMarks(variant, spot.r).beadR;
        for (const lash of eyelashMarks(variant, spot.r)) expect(px(inkPastBead(lash, beadR))).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never move the head', () => {
    expect(HEAD_ELLIPSE).toEqual({ cx: 26, cy: -1, rx: 27, ry: 22 });
  });

  it('keep the belly inside the torso', () => {
    for (const sex of AXO_SEXES) {
      for (const body of AXO_BODIES) {
        for (const age of AXO_AGES) {
          const geo = axolotlBodyGeometry(look({ sex, body, age }));
          expect(markInsideEllipse({ x: geo.belly.cx, y: geo.belly.cy, ...geo.belly, rot: 0.03 }, geo.torso)).toBe(
            true,
          );
        }
      }
    }
  });
});

describe('leg roots', () => {
  /** Ink stroke width of a whole leg tube (guide 6e: width 8, outline 3.1). */
  const LEG_TUBE_INK = 8 + 2 * 3.1;

  /** Leg roots drawAxolotl paints for `look`, read from its leg tube ink strokes. */
  function paintedLegRoots(look: AxolotlArtLook): { x: number; y: number }[] {
    const roots: { x: number; y: number }[] = [];
    class RecordingPath2D {
      first: { x: number; y: number } | null = null;
      moveTo(x: number, y: number): void {
        this.first ??= { x, y };
      }
      lineTo(): void {}
      quadraticCurveTo(): void {}
      closePath(): void {}
      ellipse(): void {}
      arc(): void {}
    }
    vi.stubGlobal('Path2D', RecordingPath2D);
    let lineWidth = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'stroke') {
            return (p: RecordingPath2D) => {
              if (lineWidth === LEG_TUBE_INK && p.first) roots.push(p.first);
            };
          }
          return () => {};
        },
        set: (_target, key, value: unknown) => {
          if (key === 'lineWidth') lineWidth = value as number;
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
    drawAxolotl(ctx, AXO_REST_POSE, LEUCISTIC, look);
    return roots;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AXO_LEG_ROOTS are the default look roots', () => {
    expect(axolotlLegRoots(DEFAULT_ART_LOOK)).toEqual(AXO_LEG_ROOTS);
  });

  it('are exactly what the painter uses, for every Boy or girl, Body and Age', () => {
    for (const sex of AXO_SEXES) {
      for (const body of AXO_BODIES) {
        for (const age of AXO_AGES) {
          const look = { ...DEFAULT_ART_LOOK, sex, body, age };
          expect(paintedLegRoots(look)).toEqual(axolotlLegRoots(look));
        }
      }
    }
  });

  it('follow the torso lower edge: each root stays inside the torso', () => {
    for (const sex of AXO_SEXES) {
      for (const body of AXO_BODIES) {
        for (const age of AXO_AGES) {
          const geo = axolotlBodyGeometry({ ...DEFAULT_ART_LOOK, sex, body, age });
          for (const root of geo.legRoots) {
            expect(markInsideEllipse({ ...root, rx: 0, ry: 0, rot: 0 }, geo.torso)).toBe(true);
          }
        }
      }
    }
  });
});

describe('gill styles (guide 6m)', () => {
  it('match the guide table', () => {
    expect(GILL_STYLES.fluffy).toEqual({
      nearLen: [34, 37, 31],
      farLen: [28, 32, 26],
      filamentU: [0.35, 0.6, 0.82],
      filamentLen: 13,
      tipLen: 8,
      nearBend: 5,
      farBend: 4,
    });
    expect(GILL_STYLES.long).toEqual({
      nearLen: [44, 48, 40],
      farLen: [36, 42, 34],
      filamentU: [0.5, 0.8],
      filamentLen: 13,
      tipLen: 10,
      nearBend: 6,
      farBend: 5,
    });
    expect(GILL_STYLES.short).toEqual({
      nearLen: [24, 26, 22],
      farLen: [20, 22, 18],
      filamentU: [0.45, 0.8],
      filamentLen: 9,
      tipLen: 6,
      nearBend: 4,
      farBend: 3,
    });
  });

  it('keep the guide 6d roots and angles for every style', () => {
    const rootsOf = (style: (typeof GILL_STYLE_IDS)[number]) =>
      (['far', 'near'] as const).flatMap((layer) =>
        gillSpecs(style, layer).map(({ bx, by, off, phase }) => ({ bx, by, off, phase })),
      );
    const fluffy = rootsOf('fluffy');
    expect(fluffy.map(({ bx, by, off }) => [bx, by, off])).toEqual([
      [6, -16, 1.4],
      [4, -8, 0.95],
      [6, 0, 0.5],
      [3, -12, 1.15],
      [1, -3, 0.65],
      [3, 7, 0.15],
    ]);
    for (const style of GILL_STYLE_IDS) expect(rootsOf(style)).toEqual(fluffy);
  });

  it('keep every root inside the gill-root zone (guide 6i)', () => {
    for (const style of GILL_STYLE_IDS) {
      for (const layer of ['far', 'near'] as const) {
        for (const { bx, by } of gillSpecs(style, layer)) {
          expect(bx).toBeGreaterThanOrEqual(GILL_ROOT_ZONE.minX);
          expect(bx).toBeLessThanOrEqual(GILL_ROOT_ZONE.maxX);
          expect(by).toBeGreaterThanOrEqual(GILL_ROOT_ZONE.minY);
          expect(by).toBeLessThanOrEqual(GILL_ROOT_ZONE.maxY);
        }
      }
    }
  });

  it('Long tips reach about y -63 (guide 6m)', () => {
    const top = Math.min(...PHASES.map((t) => gillInkBounds('long', t).minY));
    expect(top).toBeLessThan(-63);
    expect(top).toBeGreaterThan(-75);
  });

  it('fit inside AXO_TEX with padding at every flutter phase', () => {
    for (const style of GILL_STYLE_IDS) {
      for (const t of PHASES) {
        const b = gillInkBounds(style, t);
        expect(b.minX).toBeGreaterThanOrEqual(-AXO_TEX.originX + FRAME_PAD);
        expect(b.minY).toBeGreaterThanOrEqual(-AXO_TEX.originY + FRAME_PAD);
        expect(b.maxX).toBeLessThanOrEqual(AXO_TEX.w - AXO_TEX.originX - FRAME_PAD);
        expect(b.maxY).toBeLessThanOrEqual(AXO_TEX.h - AXO_TEX.originY - FRAME_PAD);
      }
    }
  });
});

describe('eye variants (guide 6l)', () => {
  const eyes: readonly [EyeSpot, { x: number; y: number; r: number }][] = [
    [NEAR_EYE, NEAR_EYE_ZONE],
    [FAR_EYE, FAR_EYE_ZONE],
  ];

  it('sit at the guide 6c centres', () => {
    expect(NEAR_EYE).toEqual({ x: 28, y: -6, r: 6.4 });
    expect(FAR_EYE).toEqual({ x: 42, y: -7, r: 5.3 });
  });

  it('keep every mark inside its eye zone', () => {
    for (const variant of EYE_VARIANTS) {
      for (const [spot, zone] of eyes) {
        expect(spot.x).toBe(zone.x);
        expect(spot.y).toBe(zone.y);
        const marks = eyeMarks(variant, spot.r);
        expect(marks.beadR).toBeLessThanOrEqual(zone.r);
        for (const g of marks.glints) {
          expect(Math.hypot(g.x, g.y) + g.r).toBeLessThanOrEqual(marks.beadR + 1e-9);
        }
        if (marks.lid) {
          const midX = (marks.lid.x1 + 2 * marks.lid.cx + marks.lid.x2) / 4;
          const midY = (marks.lid.y1 + 2 * marks.lid.cy + marks.lid.y2) / 4;
          expect(Math.hypot(midX, midY)).toBeLessThan(marks.beadR);
        }
      }
    }
  });

  it('show at least about 45% of the round bead', () => {
    for (const variant of EYE_VARIANTS) {
      expect(visibleBeadShare(variant)).toBeGreaterThanOrEqual(MIN_BEAD_SHARE);
    }
    expect(visibleBeadShare('happy')).toBeCloseTo(1, 2);
  });

  it('build each variant as the guide describes', () => {
    const r = NEAR_EYE.r;
    expect(eyeMarks('happy', r)).toEqual({
      beadR: r,
      glints: [
        { x: r * 0.3, y: -r * 0.35, r: r * 0.38 },
        { x: -r * 0.35, y: r * 0.35, r: r * 0.17 },
      ],
      lid: null,
    });
    expect(eyeMarks('curious', r).beadR).toBeCloseTo(7.04, 9);
    expect(eyeMarks('curious', FAR_EYE.r).beadR).toBeCloseTo(5.83, 9);
    expect(eyeMarks('curious', r).glints[0].r).toBeCloseTo(0.45 * r, 9);
    expect(eyeMarks('curious', r).lid).toBeNull();

    const sleepy = eyeMarks('sleepy', r);
    expect(sleepy.glints).toEqual([{ x: -0.3 * r, y: 0.45 * r, r: 0.17 * r }]);
    const sleepyLid = quadBounds(
      sleepy.lid!.x1,
      sleepy.lid!.y1,
      sleepy.lid!.cx,
      sleepy.lid!.cy,
      sleepy.lid!.x2,
      sleepy.lid!.y2,
      0,
    );
    expect(sleepyLid.maxY).toBeCloseTo(0.15 * r, 9);

    const determined = eyeMarks('determined', r).lid!;
    expect([determined.x1, determined.y1, determined.x2, determined.y2]).toEqual([-r, -0.6 * r, r, -0.25 * r]);
    expect(determined.y2).toBeGreaterThan(determined.y1);

    const grumpy = eyeMarks('grumpy', r);
    expect(grumpy.glints).toEqual([{ x: -r * 0.35, y: r * 0.35, r: r * 0.17 }]);
    expect([grumpy.lid!.x1, grumpy.lid!.y1, grumpy.lid!.x2, grumpy.lid!.y2]).toEqual([-r, -0.2 * r, r, 0.2 * r]);
  });

  it('half-shuts Grumpy (#87): a straight lid through the middle, sloping down toward the snout, glint 2 only', () => {
    for (const spot of [NEAR_EYE, FAR_EYE]) {
      const r = spot.r;
      const lid = eyeMarks('grumpy', r).lid!;
      expect(lid.cx).toBe(0);
      expect(lid.cy).toBeCloseTo((lid.y1 + lid.y2) / 2, 12);
      expect(lid.y2).toBeGreaterThan(lid.y1);
      expect(Math.abs((lid.y1 + lid.y2) / 2)).toBeLessThanOrEqual(0.1 * r);
    }
    const share = visibleBeadShare('grumpy');
    expect(share).toBeGreaterThanOrEqual(0.45);
    expect(share).toBeLessThanOrEqual(0.55);
    expect(share).toBeCloseTo(0.5, 2);
  });

  it('keeps Determined as it was, and tells it from Grumpy by the bead shown, the glints and the brow', () => {
    const r = NEAR_EYE.r;
    const determined = eyeMarks('determined', r);
    expect(determined.glints).toHaveLength(2);
    expect(visibleBeadShare('determined')).toBeCloseTo(0.7585, 3);
    expect(visibleBeadShare('determined')).toBeGreaterThanOrEqual(visibleBeadShare('grumpy') + 0.15);
    expect(eyeMarks('grumpy', r).glints).not.toEqual(determined.glints);
    const browed = EYE_VARIANTS.filter((variant) => browStrokes(variant, NEAR_EYE, 1).length > 0);
    expect(browed).toEqual(['grumpy']);
  });
});

/** One stroke paintEye made: the state it was painted under, the scale y and its place in the call order. */
interface EyeStroke {
  readonly lineWidth: number;
  readonly strokeStyle: string;
  readonly lineCap: string;
  readonly scaleY: number;
  readonly order: number;
}

/** Every stroke and the index of the bead fill paintEye makes, with the eye `colour` #123456. */
function recordEyeStrokes(variant: EyeVariant, spot: EyeSpot, blink: number, eyelashes = false) {
  class StubPath2D {
    moveTo(): void {}
    lineTo(): void {}
    quadraticCurveTo(): void {}
    closePath(): void {}
    ellipse(): void {}
  }
  vi.stubGlobal('Path2D', StubPath2D);
  const state = { lineWidth: 0, strokeStyle: '', fillStyle: '', lineCap: 'round', scaleY: 1 };
  const saved: (typeof state)[] = [];
  const strokes: EyeStroke[] = [];
  let order = 0;
  let beadAt = -1;
  const ctx = {
    save: () => saved.push({ ...state }),
    restore: () => Object.assign(state, saved.pop()!),
    translate: () => {},
    scale: (_x: number, y: number) => {
      state.scaleY *= y;
    },
    clip: () => {},
    fill: () => {
      if (state.fillStyle === '#123456' && beadAt < 0) beadAt = order;
      order++;
    },
    stroke: () => strokes.push({ ...state, order: order++ }),
    set lineCap(v: string) {
      state.lineCap = v;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
  } as unknown as CanvasRenderingContext2D;
  try {
    paintEye(ctx, variant, spot, blink, '#123456', undefined, eyelashes);
  } finally {
    vi.unstubAllGlobals();
  }
  return { strokes, beadAt, lineCapAfter: state.lineCap, unbalanced: saved.length };
}

/**
 * The brow strokes paintEye makes, a Girl's lashes on: each round-capped lash-white-wide stroke and
 * the stroke after it (lashes are butt-capped; the lid is ink only).
 */
function browStrokes(variant: EyeVariant, spot: EyeSpot, blink: number): EyeStroke[] {
  const { strokes } = recordEyeStrokes(variant, spot, blink, true);
  return strokes.flatMap((s, i) => (s.lineCap === 'round' && s.lineWidth === EYELASH_UNDER ? [s, strokes[i + 1]] : []));
}

describe('eye ring (guide 3b)', () => {
  const RING = { colour: '#cec9f0', width: 1.5 };

  interface Recorded {
    readonly calls: string[];
    readonly strokes: { lineWidth: number; strokeStyle: string; radius: number }[];
  }

  function recordPaint(ring: typeof RING | undefined): Recorded {
    const recorded: Recorded = { calls: [], strokes: [] };
    class StubPath2D {
      radius = 0;
      moveTo(): void {}
      lineTo(): void {}
      quadraticCurveTo(): void {}
      closePath(): void {}
      ellipse(_x: number, _y: number, rx: number): void {
        this.radius = rx;
      }
    }
    vi.stubGlobal('Path2D', StubPath2D);
    const state = { lineWidth: 0, strokeStyle: '', fillStyle: '' };
    const ctx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      clip: () => {},
      fill: (p: StubPath2D) => recorded.calls.push(`fill:${state.fillStyle}:${p.radius}`),
      stroke: (p: StubPath2D) => {
        recorded.calls.push('stroke');
        recorded.strokes.push({ lineWidth: state.lineWidth, strokeStyle: state.strokeStyle, radius: p.radius });
      },
      set lineWidth(v: number) {
        state.lineWidth = v;
      },
      set strokeStyle(v: string) {
        state.strokeStyle = v;
      },
      set fillStyle(v: string) {
        state.fillStyle = v;
      },
    } as unknown as CanvasRenderingContext2D;
    paintEye(ctx, 'happy', NEAR_EYE, 1, '#123456', ring);
    return recorded;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('strokes a ring just inside the bead edge, between bead and glints', () => {
    const { calls, strokes } = recordPaint(RING);
    expect(strokes).toEqual([
      { lineWidth: RING.width, strokeStyle: RING.colour, radius: NEAR_EYE.r - RING.width / 2 },
    ]);
    const beadAt = calls.indexOf(`fill:#123456:${NEAR_EYE.r}`);
    const ringAt = calls.indexOf('stroke');
    const glintAt = calls.findIndex((c) => c.startsWith(`fill:${WHITE}:`));
    expect(beadAt).toBeGreaterThanOrEqual(0);
    expect(ringAt).toBeGreaterThan(beadAt);
    expect(glintAt).toBeGreaterThan(ringAt);
  });

  it('strokes nothing when no ring is given', () => {
    expect(recordPaint(undefined).strokes).toEqual([]);
  });
});

/** The morph mouth slot fill handed to paintMouth when recording. */
const MOUTH_SLOT = '#123456';
/** Tongue fill (guide 3g, 6l). */
const TONGUE_FILL = '#ff9fb5';
/** Envelope bin width, in local units. */
const ENVELOPE_BIN = 0.25;
/** A dip counts once the lower edge rises and falls back by this much. */
const DIP_DEPTH = 1;
/** One-sided: the two ends of the mouth line differ in height by at least this much. */
const ONE_SIDED_DROP = 4;
/** Ink box width, height or lowest point must differ by at least this much to tell two mouths apart. */
const BOX_TRAIT_GAP = 2;

type MouthPathCommand =
  | { readonly op: 'move' | 'line'; readonly x: number; readonly y: number }
  | { readonly op: 'quad'; readonly cx: number; readonly cy: number; readonly x: number; readonly y: number }
  | { readonly op: 'ellipse'; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number }
  | { readonly op: 'close' };

class RecordingMouthPath {
  readonly commands: MouthPathCommand[] = [];
  moveTo(x: number, y: number): void {
    this.commands.push({ op: 'move', x, y });
  }
  lineTo(x: number, y: number): void {
    this.commands.push({ op: 'line', x, y });
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.commands.push({ op: 'quad', cx, cy, x, y });
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.commands.push({ op: 'ellipse', x, y, rx, ry });
  }
  closePath(): void {
    this.commands.push({ op: 'close' });
  }
}

/** One fill or stroke paintMouth made, with the style and width it used. */
interface MouthPaint {
  readonly kind: 'fill' | 'stroke';
  readonly style: string;
  readonly lineWidth: number;
  readonly path: RecordingMouthPath;
}

/** Every fill and stroke paintMouth makes for `variant`, in order. */
function recordMouthPaint(variant: MouthVariant): MouthPaint[] {
  const paints: MouthPaint[] = [];
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 0 };
  const ctx = {
    fill: (path: RecordingMouthPath) =>
      paints.push({ kind: 'fill', style: state.fillStyle, lineWidth: state.lineWidth, path }),
    stroke: (path: RecordingMouthPath) =>
      paints.push({ kind: 'stroke', style: state.strokeStyle, lineWidth: state.lineWidth, path }),
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
  } as unknown as CanvasRenderingContext2D;
  vi.stubGlobal('Path2D', RecordingMouthPath);
  try {
    paintMouth(ctx, variant, MOUTH_SLOT);
  } finally {
    vi.unstubAllGlobals();
  }
  return paints;
}

/** Centre-line sample points of recorded path commands. */
function samplePath(commands: readonly MouthPathCommand[]): LocalPoint[] {
  const points: LocalPoint[] = [];
  let pen: LocalPoint = { x: 0, y: 0 };
  for (const cmd of commands) {
    if (cmd.op === 'move' || cmd.op === 'line') {
      pen = { x: cmd.x, y: cmd.y };
      points.push(pen);
    } else if (cmd.op === 'quad') {
      for (let k = 1; k <= 128; k++) {
        const u = k / 128;
        const m = 1 - u;
        points.push({
          x: m * m * pen.x + 2 * u * m * cmd.cx + u * u * cmd.x,
          y: m * m * pen.y + 2 * u * m * cmd.cy + u * u * cmd.y,
        });
      }
      pen = { x: cmd.x, y: cmd.y };
    } else if (cmd.op === 'ellipse') {
      for (let k = 0; k < 256; k++) {
        const a = (k / 256) * TAU;
        points.push({ x: cmd.x + Math.cos(a) * cmd.rx, y: cmd.y + Math.sin(a) * cmd.ry });
      }
    }
  }
  return points;
}

/** The lowest sample (largest y) of a set of points. */
function lowestPoint(points: readonly LocalPoint[]): LocalPoint {
  return points.reduce((low, p) => (p.y > low.y ? p : low));
}

/** Whether a recorded path is an open line: no ellipse and no closePath. */
function isOpenLine(path: RecordingMouthPath): boolean {
  return path.commands.every((cmd) => cmd.op !== 'ellipse' && cmd.op !== 'close');
}

/** The first mouth-ink stroke that is an open line, or null for mouths drawn as closed shapes only. */
function mouthLineOf(paints: readonly MouthPaint[]): RecordingMouthPath | null {
  const found = paints.find((p) => p.kind === 'stroke' && p.lineWidth === MOUTH_INK && isOpenLine(p.path));
  return found ? found.path : null;
}

/** First and last points of an open line. */
function lineEnds(path: RecordingMouthPath): [LocalPoint, LocalPoint] {
  const points = samplePath(path.commands);
  return [points[0], points[points.length - 1]];
}

/** The slot-filled shape of a mouth, or null when it has none. */
function slotFillOf(paints: readonly MouthPaint[]): RecordingMouthPath | null {
  const found = paints.find((p) => p.kind === 'fill' && p.style === MOUTH_SLOT);
  return found ? found.path : null;
}

/** Ellipses filled with anything but the mouth slot: the tongues. */
function tongueEllipsesOf(paints: readonly MouthPaint[]): { x: number; y: number; rx: number; ry: number }[] {
  return paints
    .filter((p) => p.kind === 'fill' && p.style !== MOUTH_SLOT)
    .flatMap((p) => p.path.commands.flatMap((cmd) => (cmd.op === 'ellipse' ? [cmd] : [])));
}

/** Largest y of the mouth-ink centre lines in each ENVELOPE_BIN column, left to right. */
function lowerEnvelope(paints: readonly MouthPaint[]): number[] {
  const columns = new Map<number, number>();
  for (const paint of paints) {
    if (paint.kind !== 'stroke' || paint.lineWidth !== MOUTH_INK) continue;
    for (const p of samplePath(paint.path.commands)) {
      const column = Math.floor(p.x / ENVELOPE_BIN);
      columns.set(column, Math.max(columns.get(column) ?? -Infinity, p.y));
    }
  }
  return [...columns.keys()].sort((a, b) => a - b).map((column) => columns.get(column)!);
}

/** Lobes of the lower edge: a new dip starts only after it rises DIP_DEPTH and falls DIP_DEPTH again. */
function countDips(envelope: readonly number[]): number {
  let dips = 1;
  let high = envelope[0];
  let low = Infinity;
  let inDip = true;
  for (const y of envelope) {
    if (inDip) {
      high = Math.max(high, y);
      if (y <= high - DIP_DEPTH) {
        inDip = false;
        low = y;
      }
    } else {
      low = Math.min(low, y);
      if (y >= low + DIP_DEPTH) {
        inDip = true;
        high = y;
        dips++;
      }
    }
  }
  return dips;
}

/** What tells a mouth apart, measured from paintMouth and mouthInkBounds. */
interface MouthTraits {
  readonly filled: boolean;
  readonly tongueArea: number | null;
  readonly oneSided: boolean;
  readonly dips: number;
  readonly width: number;
  readonly height: number;
  readonly lowest: number;
}

function mouthTraits(variant: MouthVariant): MouthTraits {
  const paints = recordMouthPaint(variant);
  const tongues = tongueEllipsesOf(paints);
  const line = mouthLineOf(paints);
  const ends = line ? lineEnds(line) : null;
  const box = mouthInkBounds(variant);
  return {
    filled: slotFillOf(paints) !== null,
    tongueArea: tongues.length === 0 ? null : tongues.reduce((sum, t) => sum + Math.PI * t.rx * t.ry, 0),
    oneSided: ends !== null && Math.abs(ends[0].y - ends[1].y) >= ONE_SIDED_DROP,
    dips: countDips(lowerEnvelope(paints)),
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    lowest: box.maxY,
  };
}

/** Whether two mouths differ in at least one trait. */
function mouthsDiffer(a: MouthTraits, b: MouthTraits): boolean {
  if (a.filled !== b.filled || a.oneSided !== b.oneSided || a.dips !== b.dips) return true;
  if ((a.tongueArea === null) !== (b.tongueArea === null)) return true;
  if (a.tongueArea !== null && b.tongueArea !== null) {
    if (Math.max(a.tongueArea, b.tongueArea) >= 2 * Math.min(a.tongueArea, b.tongueArea)) return true;
  }
  return (
    Math.abs(a.width - b.width) >= BOX_TRAIT_GAP ||
    Math.abs(a.height - b.height) >= BOX_TRAIT_GAP ||
    Math.abs(a.lowest - b.lowest) >= BOX_TRAIT_GAP
  );
}

describe('mouth variants (guide 6l)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stay inside the mouth zone under the corner ticks', () => {
    for (const variant of MOUTH_VARIANTS) {
      const b = mouthInkBounds(variant);
      expect(b.minX).toBeGreaterThanOrEqual(26.4 - 1 - 1);
      expect(b.maxX).toBeLessThanOrEqual(50.4 + 1 + 1);
      expect(b.minY).toBeGreaterThanOrEqual(4.6 - 1 - 1);
      expect(b.maxY).toBeLessThanOrEqual(15.5 + 3.6 + 1.2 + 1);
    }
  });

  it('never reach an eye zone or the gill-root zone', () => {
    for (const variant of MOUTH_VARIANTS) {
      const b = mouthInkBounds(variant);
      expect(boxCircleGap(b, NEAR_EYE_ZONE)).toBeGreaterThan(0);
      expect(boxCircleGap(b, FAR_EYE_ZONE)).toBeGreaterThan(0);
      expect(b.minX).toBeGreaterThan(GILL_ROOT_ZONE.maxX);
    }
  });

  it('puts the corner ticks at the top for the open D', () => {
    expect(mouthInkBounds('openD').minY).toBeCloseTo(4.6 - 1, 9);
  });

  it('drops the smile to about y 13.8 and the tongue about 4 below the lip', () => {
    const smile = quadBounds(28, 10, 38, 19, 49, 7, 0);
    expect(Math.abs(smile.maxY - 13.8)).toBeLessThan(0.1);
    const lip = quadBounds(49, 7, 38, 22, 28, 10, 0).maxY;
    const tongueBottom = mouthInkBounds('tongueOut').maxY - 1.2;
    expect(tongueBottom - lip).toBeGreaterThan(3.5);
    expect(tongueBottom - lip).toBeLessThan(4.5);
  });

  it('Big grin opens at least 2 wider than the Open D, its lower lip at least 1 lower', () => {
    const openD = slotFillOf(recordMouthPaint('openD'))!;
    const bigGrin = slotFillOf(recordMouthPaint('bigGrin'))!;
    const opening = (path: RecordingMouthPath): number => {
      const xs = path.commands.flatMap((cmd) => (cmd.op === 'move' || cmd.op === 'quad' ? [cmd.x] : []));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(opening(openD)).toBe(21);
    expect(opening(bigGrin)).toBeGreaterThanOrEqual(opening(openD) + 2);
    const openDLip = lowestPoint(samplePath(openD.commands)).y;
    expect(openDLip).toBeCloseTo(15.3, 1);
    expect(lowestPoint(samplePath(bigGrin.commands)).y).toBeGreaterThanOrEqual(openDLip + 1);
  });

  it('Cat smile is an unfilled "w": two dips at least 4 apart, the middle at least 1.5 higher', () => {
    const paints = recordMouthPaint('catSmile');
    expect(slotFillOf(paints)).toBeNull();
    const line = mouthLineOf(paints)!;
    const [move, first, second] = line.commands;
    expect(line.commands.map((cmd) => cmd.op)).toEqual(['move', 'quad', 'quad']);
    if (move.op !== 'move' || first.op !== 'quad' || second.op !== 'quad') throw new Error('not a w');
    const firstLow = lowestPoint(samplePath([move, first]));
    const secondLow = lowestPoint(samplePath([{ op: 'move', x: first.x, y: first.y }, second]));
    expect(Math.abs(secondLow.x - firstLow.x)).toBeGreaterThanOrEqual(4);
    expect(Math.min(firstLow.y, secondLow.y) - first.y).toBeGreaterThanOrEqual(1.5);
    expect(countDips(lowerEnvelope(paints))).toBe(2);
  });

  it('Smirk is one-sided, lowest near its low end, with one tick at its raised end', () => {
    const paints = recordMouthPaint('smirk');
    expect(slotFillOf(paints)).toBeNull();
    const line = mouthLineOf(paints)!;
    const [start, end] = lineEnds(line);
    expect(Math.abs(start.y - end.y)).toBeGreaterThanOrEqual(ONE_SIDED_DROP);
    const [lowEnd, raisedEnd] = start.y > end.y ? [start, end] : [end, start];
    const lowest = lowestPoint(samplePath(line.commands));
    expect(Math.abs(lowest.x - lowEnd.x) / Math.abs(raisedEnd.x - lowEnd.x)).toBeLessThanOrEqual(0.4);
    const ticks = paints.filter((p) => p.kind === 'stroke' && p.lineWidth === MOUTH_TICK_INK);
    expect(ticks).toHaveLength(1);
    const tickStarts = ticks[0].path.commands.filter((cmd) => cmd.op === 'move');
    expect(tickStarts).toEqual([{ op: 'move', x: raisedEnd.x, y: raisedEnd.y }]);
  });

  it('Blep is the Smile line plus a small tongue poking at least 1.5 below it', () => {
    const tongueTip = recordMouthPaint('tongueTip');
    const smileLine = mouthLineOf(recordMouthPaint('smile'))!;
    expect(mouthLineOf(tongueTip)!.commands).toEqual(smileLine.commands);
    expect(slotFillOf(tongueTip)).toBeNull();
    expect(tongueTip.filter((p) => p.kind === 'fill').map((p) => p.style)).toEqual([TONGUE_FILL]);
    const [tongue] = tongueEllipsesOf(tongueTip);
    const [bigTongue] = tongueEllipsesOf(recordMouthPaint('tongueOut'));
    expect(tongue.rx * tongue.ry).toBeLessThanOrEqual(0.5 * bigTongue.rx * bigTongue.ry);
    expect(tongue.y + tongue.ry - lowestPoint(samplePath(smileLine.commands)).y).toBeGreaterThanOrEqual(1.5);
  });

  it('never paint white: no teeth (guide 6l)', () => {
    for (const variant of MOUTH_VARIANTS) {
      for (const paint of recordMouthPaint(variant)) expect(paint.style).not.toBe(WHITE);
    }
  });

  it('every pair of mouths differs in at least one trait', () => {
    const traits = MOUTH_VARIANTS.map(mouthTraits);
    const pairs: string[] = [];
    const alike: string[] = [];
    for (let i = 0; i < MOUTH_VARIANTS.length; i++) {
      for (let j = i + 1; j < MOUTH_VARIANTS.length; j++) {
        pairs.push(`${MOUTH_VARIANTS[i]} ${MOUTH_VARIANTS[j]}`);
        if (!mouthsDiffer(traits[i], traits[j])) alike.push(`${MOUTH_VARIANTS[i]} ${MOUTH_VARIANTS[j]}`);
      }
    }
    expect(traits.every((t) => !mouthsDiffer(t, t))).toBe(true);
    expect(pairs).toHaveLength(28);
    expect(alike).toEqual([]);
  });
});

describe('spots (guide 6n)', () => {
  it('Freckles are ten tiny round specks in one shoulder cluster, no bigger than 15 x 9', () => {
    const marks = spotMarks('freckles', STILL_SWIM, 1);
    expect(marks).toHaveLength(10);
    expect(SPOT_SETS.freckles.tail).toEqual([]);
    for (const m of marks) {
      expect(m.ry).toBe(m.rx);
      expect(m.rx).toBeGreaterThanOrEqual(0.8);
      expect(m.rx).toBeLessThanOrEqual(1.2);
    }
    expect(smallestEdgeGap(marks)).toBeGreaterThanOrEqual(0.8);
    const box = boundsOfPoints(marks.map((m): [number, number] => [m.x, m.y]), 0);
    expect(box.maxX - box.minX).toBeLessThanOrEqual(15);
    expect(box.maxY - box.minY).toBeLessThanOrEqual(9);
    expect(isInside(box, { minX: -35, minY: -11, maxX: -15, maxY: -2 })).toBe(true);
    expect(spotMarks('none', 0, 1)).toEqual([]);
  });

  it('Dots are six even, medium round dots along the back, then down the tail centre', () => {
    const set = SPOT_SETS.dots;
    expect(set.body.length + set.tail.length).toBe(6);
    expect(set.body.length).toBeGreaterThanOrEqual(2);
    expect(set.body.length).toBeLessThanOrEqual(3);
    for (const m of [...set.body, ...set.tail]) expect([m.rx, m.ry]).toEqual([2.8, 2.8]);
    for (const m of set.tail) {
      expect(m.s).toBeLessThanOrEqual(0.7);
      expect(Math.abs(m.v)).toBeLessThanOrEqual(0.1);
    }
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const marks = spotMarks('dots', STILL_SWIM, 1, geo.tail, geo.torso);
    const steps = marks.slice(1).map((m, i) => Math.hypot(m.x - marks[i].x, m.y - marks[i].y));
    const meanStep = steps.reduce((sum, step) => sum + step, 0) / steps.length;
    for (const step of steps) expect(Math.abs(step / meanStep - 1)).toBeLessThanOrEqual(0.2);
    expect(steps.every((_, i) => marks[i + 1].x < marks[i].x)).toBe(true);
  });

  it('Patches are three big, soft blotches over the back and tail, each of area 110 or more', () => {
    const set = SPOT_SETS.patches;
    expect([[2, 1], [1, 2]]).toContainEqual([set.body.length, set.tail.length]);
    for (const m of [...set.body, ...set.tail]) expect(markArea(m)).toBeGreaterThanOrEqual(110);
  });

  it('step up in size: 10 Freckles, 6 Dots each 4 Freckles or more, 3 Patches each 4 Dots or more', () => {
    const areasOf = (option: SpotsOption): number[] => [...SPOT_SETS[option].body, ...SPOT_SETS[option].tail].map(markArea);
    expect(SPOTS_OPTIONS.map((option) => areasOf(option).length)).toEqual([0, 10, 6, 3]);
    expect(Math.min(...areasOf('dots'))).toBeGreaterThanOrEqual(4 * Math.max(...areasOf('freckles')));
    expect(Math.min(...areasOf('patches'))).toBeGreaterThanOrEqual(4 * Math.max(...areasOf('dots')));
  });

  it('never land on the head (x > 0) at any swim phase or tail amplitude', () => {
    for (const option of SPOTS_OPTIONS) {
      for (const swim of PHASES.filter((_, i) => i % 10 === 0)) {
        for (const amp of [1, 1.6]) {
          for (const m of spotMarks(option, swim, amp)) {
            expect(m.x + Math.max(m.rx, m.ry)).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('place tail marks in tail space and keep them on the tail core', () => {
    for (const swim of [0, 1, 2.5, 4]) {
      for (const option of ['dots', 'patches'] as const) {
        const marks = spotMarks(option, swim, 1.6);
        const bodyCount = option === 'dots' ? 3 : 1;
        const tail = marks.slice(bodyCount);
        const specs = option === 'dots' ? [0.34, 0.54, 0.7] : [0.2, 0.47];
        expect(tail).toHaveLength(specs.length);
        tail.forEach((m, i) => {
          const tp = tailPointAt(specs[i], swim, 1.6);
          expect(m.x).toBeCloseTo(tp.x, 9);
          expect(Math.abs(m.y - tp.cy) + Math.max(m.rx, m.ry)).toBeLessThanOrEqual(tp.hc);
        });
      }
    }
  });
});

describe('eyelashes (Girl cue)', () => {
  const eyes = [NEAR_EYE, FAR_EYE] as const;

  it('are ink 2.0 over a white 3.6 under-stroke, reaching 4 past the bead radius', () => {
    expect([EYELASH_INK, EYELASH_UNDER, LASH_REACH]).toEqual([2, 3.6, 4]);
  });

  it('are three lashes per eye, every corner of both butt-capped strokes inside the lash reach circle at every blink', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        const lashes = eyelashMarks(variant, spot.r);
        expect(lashes).toHaveLength(3);
        for (const lash of lashes) {
          expect(Math.hypot(lash.x2 - lash.x1, lash.y2 - lash.y1)).toBeGreaterThan(1.2);
          for (const corner of allLashCorners(lash)) {
            expect(Math.hypot(corner.x, corner.y)).toBeLessThanOrEqual(lashReachR(spot) + 1e-9);
          }
        }
      }
    }
  });

  it('end on the lash reach circle at the same three angles on every variant', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        const lashes = eyelashMarks(variant, spot.r);
        const firstCornerOut = lashes.map((lash) =>
          Math.max(...lashStrokeCorners(lash, EYELASH_UNDER, 1).map((c) => Math.hypot(c.x, c.y))),
        );
        for (const reach of firstCornerOut) expect(reach).toBeCloseTo(lashReachR(spot), 6);
      }
    }
  });

  it('keep every corner inside the head, right of x 16.5 (clear of the gill stems) and below y -19.5 (the Head slot)', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        for (const lash of eyelashMarks(variant, spot.r)) {
          for (const corner of allLashCorners(lash)) {
            const local = { x: spot.x + corner.x, y: spot.y + corner.y };
            expect(isInEllipse(local, HEAD_ELLIPSE)).toBe(true);
            expect(local.x).toBeGreaterThanOrEqual(LASH_MIN_X);
            expect(local.y).toBeGreaterThanOrEqual(LASH_MIN_Y);
          }
        }
      }
    }
  });

  it('sit at the upper back of the bead, past its edge', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        const beadR = eyeMarks(variant, spot.r).beadR;
        for (const lash of eyelashMarks(variant, spot.r)) {
          expect(lash.x2).toBeLessThan(0);
          expect(lash.y2).toBeLessThan(0);
          expect(Math.hypot(lash.x2, lash.y2)).toBeGreaterThan(beadR);
        }
      }
    }
  });

  it('show at least 2.5 of ink past the bead on every variant and both eyes', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        const beadR = eyeMarks(variant, spot.r).beadR;
        for (const lash of eyelashMarks(variant, spot.r)) {
          expect(inkPastBead(lash, beadR)).toBeGreaterThanOrEqual(MIN_LASH_INK_PAST_BEAD);
        }
      }
    }
  });

  it('keep both root corners inside the bead, so the bead covers every root below the lid', () => {
    for (const variant of EYE_VARIANTS) {
      for (const spot of eyes) {
        const beadR = eyeMarks(variant, spot.r).beadR;
        for (const lash of eyelashMarks(variant, spot.r)) {
          for (const corner of lashStrokeCorners(lash, EYELASH_UNDER, 1).slice(0, 2)) {
            expect(Math.hypot(corner.x, corner.y)).toBeLessThan(beadR);
          }
        }
      }
    }
  });

  it('measure the Grumpy lashes on the #87 lid: lengths near 5.65 / 7.00 / 8.45, far 5.27 / 6.36 / 7.56, least ink past the bead 3.52', () => {
    const lengths = (spot: EyeSpot): number[] =>
      eyelashMarks('grumpy', spot.r).map((lash) => Math.hypot(lash.x2 - lash.x1, lash.y2 - lash.y1));
    const guide = [5.65, 7.0, 8.45, 5.27, 6.36, 7.56];
    [...lengths(NEAR_EYE), ...lengths(FAR_EYE)].forEach((len, i) => expect(len).toBeCloseTo(guide[i], 2));
    const leastPastBead = Math.min(
      ...eyes.flatMap((spot) => eyelashMarks('grumpy', spot.r).map((lash) => inkPastBead(lash, spot.r))),
    );
    expect(leastPastBead).toBeCloseTo(3.52, 2);
  });

  it('root on the back half of the lid line inside the bead and rise above it on lidded eyes', () => {
    for (const variant of ['sleepy', 'determined', 'grumpy'] as const) {
      for (const spot of eyes) {
        const marks = eyeMarks(variant, spot.r);
        const lid = marks.lid!;
        for (const lash of eyelashMarks(variant, spot.r)) {
          expect(Math.hypot(lash.x1, lash.y1)).toBeLessThan(marks.beadR);
          const u = (lash.x1 - lid.x1) / (lid.x2 - lid.x1);
          expect(u).toBeLessThan(0.5);
          expect(isBelowLid(lid, lash.x1, lash.y1 + 1e-6)).toBe(true);
          expect(isBelowLid(lid, lash.x1, lash.y1 - 1e-3)).toBe(false);
          expect(lash.y2).toBeLessThan(lash.y1);
        }
      }
    }
  });

  it('paint white under ink with butt caps, under the bead, inside the blink squash', () => {
    const calls: string[] = [];
    const lashCaps: string[] = [];
    class StubPath2D {
      moveTo(): void {}
      lineTo(): void {}
      quadraticCurveTo(): void {}
      closePath(): void {}
      ellipse(): void {}
    }
    vi.stubGlobal('Path2D', StubPath2D);
    const state = { lineWidth: 0, strokeStyle: '', fillStyle: '', lineCap: 'round' };
    const saved: string[] = [];
    const ctx = {
      save: () => saved.push(state.lineCap),
      restore: () => {
        state.lineCap = saved.pop()!;
      },
      translate: () => calls.push('translate'),
      scale: () => calls.push('scale'),
      clip: () => {},
      fill: () => calls.push(`fill:${state.fillStyle}`),
      stroke: () => {
        calls.push(`stroke:${state.strokeStyle}:${state.lineWidth}`);
        if (state.lineWidth === EYELASH_UNDER || state.lineWidth === EYELASH_INK) lashCaps.push(state.lineCap);
      },
      set lineCap(v: string) {
        state.lineCap = v;
      },
      set lineWidth(v: number) {
        state.lineWidth = v;
      },
      set strokeStyle(v: string) {
        state.strokeStyle = v;
      },
      set fillStyle(v: string) {
        state.fillStyle = v;
      },
    } as unknown as CanvasRenderingContext2D;
    paintEye(ctx, 'happy', NEAR_EYE, 0.12, '#123456', undefined, true);
    vi.unstubAllGlobals();
    const under = calls.indexOf(`stroke:${WHITE}:${EYELASH_UNDER}`);
    const ink = calls.findIndex((c) => c.startsWith('stroke:') && c.endsWith(`:${EYELASH_INK}`));
    expect(calls.indexOf('scale')).toBeLessThan(under);
    expect(under).toBeLessThan(ink);
    expect(ink).toBeLessThan(calls.indexOf('fill:#123456'));
    expect(lashCaps).toEqual(['butt', 'butt']);
    expect(state.lineCap).toBe('round');
    expect(saved).toEqual([]);
  });

  it('paint on layer 12, after every layer 11 mouth stroke, so no Wearable (layers 9.2 to 11.5) can cover them', () => {
    class StubPath2D {
      moveTo(): void {}
      lineTo(): void {}
      quadraticCurveTo(): void {}
      closePath(): void {}
      ellipse(): void {}
      arc(): void {}
    }
    vi.stubGlobal('Path2D', StubPath2D);
    const state: Record<string, unknown> = { lineWidth: 0, strokeStyle: '', lineCap: '' };
    const strokes: Record<string, unknown>[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_target, key) => (key === 'stroke' ? () => strokes.push({ ...state }) : () => {}),
        set: (_target, key, value: unknown) => {
          if (typeof key === 'string' && key in state) state[key] = value;
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
    drawAxolotl(ctx, AXO_REST_POSE, LEUCISTIC, { ...DEFAULT_ART_LOOK, sex: 'girl' });
    vi.unstubAllGlobals();
    const isLash = (stroke: Record<string, unknown>): boolean =>
      stroke.lineCap === 'butt' && (stroke.lineWidth === EYELASH_UNDER || stroke.lineWidth === EYELASH_INK);
    const lastMouth = strokes.map((stroke) => stroke.lineWidth).lastIndexOf(MOUTH_INK);
    expect(strokes.filter(isLash)).toHaveLength(4);
    expect(lastMouth).toBeGreaterThanOrEqual(0);
    expect(strokes.findIndex(isLash)).toBeGreaterThan(lastMouth);
  });
});

/** Blinks the rig bakes the eyes at (EYE_FRAME_BLINKS): open, half shut and the 12% blink. */
const RIG_BLINKS = [1, 0.56, 0.12] as const;

function pointSegmentDistance(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(p.x - a.x - u * vx, p.y - a.y - u * vy);
}

function cross(a: LocalPoint, b: LocalPoint, c: LocalPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Distance between segments ab and cd: 0 when they cross. */
function segmentGap(a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint): number {
  const crosses = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
  if (crosses) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

/** Whether p lies inside the convex polygon `poly` (either winding). */
function isInConvex(poly: readonly LocalPoint[], p: LocalPoint): boolean {
  const sides = poly.map((a, i) => Math.sign(cross(a, poly[(i + 1) % poly.length], p)));
  return sides.every((s) => s >= 0) || sides.every((s) => s <= 0);
}

/** Distance from segment ab to the convex polygon `poly`: 0 when they meet. */
function segmentPolygonGap(a: LocalPoint, b: LocalPoint, poly: readonly LocalPoint[]): number {
  if (isInConvex(poly, a) || isInConvex(poly, b)) return 0;
  return Math.min(...poly.map((c, i) => segmentGap(a, b, c, poly[(i + 1) % poly.length])));
}

/** A lash's ink stroke at a blink as a local polygon (corners in order round the butt-capped stroke). */
function lashInkPolygon(spot: EyeSpot, lash: EyeLash, blink: number): LocalPoint[] {
  const [a, b, c, d] = lashStrokeCorners(lash, EYELASH_INK, blink);
  return [a, c, d, b].map((p) => ({ x: spot.x + p.x, y: spot.y + p.y }));
}

/** Ends of a Grumpy brow's centre line in local units, back end first. */
function browEnds(spot: EyeSpot): [LocalPoint, LocalPoint] {
  const brow = grumpyBrow(spot);
  return [
    { x: spot.x + brow.x1, y: spot.y + brow.y1 },
    { x: spot.x + brow.x2, y: spot.y + brow.y2 },
  ];
}

/** Every Grumpy lash ink stroke of both eyes at every rig blink, as local polygons. */
const GRUMPY_LASH_INKS: readonly LocalPoint[][] = [NEAR_EYE, FAR_EYE].flatMap((spot) =>
  eyelashMarks('grumpy', spot.r).flatMap((lash) => RIG_BLINKS.map((blink) => lashInkPolygon(spot, lash, blink))),
);

/** Least distance from the brow's centre line to any Grumpy lash ink, both eyes, every rig blink. */
function browCentreToLashInk(spot: EyeSpot): number {
  const [a, b] = browEnds(spot);
  return Math.min(...GRUMPY_LASH_INKS.map((poly) => segmentPolygonGap(a, b, poly)));
}

const HEAD_EDGE_STEPS = 8000;
const HEAD_EDGE: readonly LocalPoint[] = Array.from({ length: HEAD_EDGE_STEPS }, (_, k) => {
  const a = (k / HEAD_EDGE_STEPS) * TAU;
  return { x: HEAD_ELLIPSE.cx + HEAD_ELLIPSE.rx * Math.cos(a), y: HEAD_ELLIPSE.cy + HEAD_ELLIPSE.ry * Math.sin(a) };
});

/**
 * How deep a local point sits inside the head ellipse: its distance to the head edge, negative
 * outside. Depth is concave inside a convex shape, so a stroke is as deep as its shallowest end.
 */
function headDepth(p: LocalPoint): number {
  const toEdge = Math.min(...HEAD_EDGE.map((e) => Math.hypot(e.x - p.x, e.y - p.y)));
  return isInEllipse(p, HEAD_ELLIPSE) ? toEdge : -toEdge;
}

/** Degrees the brow turns down toward the snout (y down, +x is the snout). */
function browDownAngle(brow: EyeLash): number {
  return (Math.atan2(brow.y2 - brow.y1, brow.x2 - brow.x1) * 180) / Math.PI;
}

describe('Grumpy brows (#87, guide 6l)', () => {
  const eyes = [NEAR_EYE, FAR_EYE] as const;

  it('are short strokes over the snout-side half of each bead, at the guide ends', () => {
    const ends = [...browEnds(NEAR_EYE), ...browEnds(FAR_EYE)].flatMap((p) => [p.x, p.y]);
    const guide = [28, -13.9, 32.5, -12.45, 42.4, -10.8, 46.8, -9.35];
    ends.forEach((value, i) => expect(value).toBeCloseTo(guide[i], 9));
    for (const spot of eyes) {
      const brow = grumpyBrow(spot);
      expect(brow.x1).toBeGreaterThanOrEqual(0);
      expect(brow.x2).toBeLessThanOrEqual(spot.r);
      expect(brow.y1).toBeLessThan(0);
      expect(brow.y2).toBeLessThan(0);
    }
    expect(() => grumpyBrow({ x: 0, y: 0, r: 6.4 })).toThrow(RangeError);
  });

  it('turn 12 to 20 degrees down toward the snout and run 4.6 or more on each eye', () => {
    const near = grumpyBrow(NEAR_EYE);
    const far = grumpyBrow(FAR_EYE);
    expect(browDownAngle(near)).toBeCloseTo(17.86, 2);
    expect(browDownAngle(far)).toBeCloseTo(18.24, 2);
    expect(Math.hypot(near.x2 - near.x1, near.y2 - near.y1)).toBeCloseTo(4.73, 2);
    expect(Math.hypot(far.x2 - far.x1, far.y2 - far.y1)).toBeCloseTo(4.63, 2);
    for (const brow of [near, far]) {
      expect(browDownAngle(brow)).toBeGreaterThanOrEqual(12);
      expect(browDownAngle(brow)).toBeLessThanOrEqual(20);
      expect(Math.hypot(brow.x2 - brow.x1, brow.y2 - brow.y1)).toBeGreaterThanOrEqual(4.6);
    }
  });

  it('paint lash ink 2.0 over lash white 3.6 with round caps, after the bead, outside the blink squash', () => {
    for (const spot of eyes) {
      for (const blink of RIG_BLINKS) {
        const { beadAt, lineCapAfter, unbalanced } = recordEyeStrokes('grumpy', spot, blink, true);
        const brow = browStrokes('grumpy', spot, blink);
        expect(brow.map((s) => [s.lineWidth, s.strokeStyle, s.lineCap, s.scaleY])).toEqual([
          [EYELASH_UNDER, WHITE, 'round', 1],
          [EYELASH_INK, INK, 'round', 1],
        ]);
        expect(brow[0].order).toBeGreaterThan(beadAt);
        expect(lineCapAfter).toBe('round');
        expect(unbalanced).toBe(0);
      }
    }
  });

  it('keep the brow ink 1.0 or more from every lash ink, and the white off it, at every rig blink', () => {
    expect(browCentreToLashInk(NEAR_EYE) - EYELASH_INK / 2).toBeCloseTo(1.26, 2);
    expect(browCentreToLashInk(FAR_EYE) - EYELASH_INK / 2).toBeCloseTo(1.13, 2);
    for (const spot of eyes) {
      expect(browCentreToLashInk(spot) - EYELASH_INK / 2).toBeGreaterThanOrEqual(1);
      expect(browCentreToLashInk(spot) - EYELASH_UNDER / 2).toBeGreaterThan(0);
    }
  });

  it('keep the white off the lid ink of the open eye', () => {
    for (const spot of eyes) {
      const lid = eyeMarks('grumpy', spot.r).lid!;
      const [a, b] = browEnds(spot);
      const lidA = { x: spot.x + lid.x1, y: spot.y + lid.y1 };
      const lidB = { x: spot.x + lid.x2, y: spot.y + lid.y2 };
      expect(segmentGap(a, b, lidA, lidB) - EYELASH_UNDER / 2 - EYE_LID_INK / 2).toBeGreaterThan(0.3);
    }
  });

  it('stay inside the head inset LW / 2, below y -18.5 (1 under the Head slot), in the face crop and clear of the mouth zone', () => {
    for (const spot of eyes) {
      const box = grumpyBrowInkBounds(spot);
      for (const end of browEnds(spot)) expect(headDepth(end)).toBeGreaterThanOrEqual(EYELASH_UNDER / 2 + LW / 2);
      expect(box.minY).toBeGreaterThanOrEqual(-18.5);
      expect(box.minY).toBeGreaterThanOrEqual(HEAD_FOOTPRINT.maxY + 1);
      expectInside(box, AXO_PREVIEW_CROPS.face);
      expect(box.maxY).toBeLessThan(CODE_MOUTH_ZONE.minY);
    }
    const near = grumpyBrowInkBounds(NEAR_EYE);
    const far = grumpyBrowInkBounds(FAR_EYE);
    const sides = [near.minX, near.minY, near.maxX, near.maxY, far.minX, far.minY, far.maxX, far.maxY];
    const guide = [26.2, -15.7, 34.3, -10.65, 40.6, -12.6, 48.6, -7.55];
    sides.forEach((value, i) => expect(value).toBeCloseTo(guide[i], 9));
    expect(headDepth(browEnds(FAR_EYE)[1])).toBeCloseTo(3.63, 2);
  });

  it('sit inside the rig eyes part box', () => {
    for (const look of [DEFAULT_ART_LOOK, { ...DEFAULT_ART_LOOK, eyes: 'grumpy' as const, sex: 'girl' as const }]) {
      const eyesBox = rigParts({ look, palette: LEUCISTIC, outfit: NO_OUTFIT }).find((part) => part.id === 'eyes')!.box;
      for (const spot of eyes) expectInside(grumpyBrowInkBounds(spot), eyesBox);
    }
  });
});

describe('cheek heart (#87, Girl cue, guide 6u)', () => {
  const points = cheekHeartPoints();
  const box = boundsOfPoints(
    points.map((p): [number, number] => [p.x, p.y]),
    0,
  );
  const zone = CHEEK_HEART_ZONE;
  const zoneBox = boundsOfPoints([[zone.x, zone.y]], zone.r);

  it('is 7 across, about 6.33 tall, centred at (18.2, 9.6), its curve box centre at about (18.2, 10.16)', () => {
    expect(CHEEK_HEART_CENTRE).toEqual({ x: 18.2, y: 9.6 });
    expect(box.maxX - box.minX).toBeCloseTo(7, 9);
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(7 - 1e-9);
    expect(box.maxY - box.minY).toBeCloseTo(6.33, 2);
    expect((box.minX + box.maxX) / 2).toBeCloseTo(18.2, 9);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(10.16, 2);
    expect([CHEEK_HEART_INK, CHEEK_HEART_UNDER, CHEEK_HEART_LAYER]).toEqual([1.6, 3.2, 10.2]);
  });

  it('holds all of its paint, white under-stroke included, in its zone: centre (18.2, 9.6), radius about 5.32 (the bottom tip, 3.72 out, plus the white 1.6)', () => {
    expect(zone.x).toBe(18.2);
    expect(zone.y).toBe(9.6);
    expect(zone.r).toBeCloseTo(5.32, 2);
    for (const p of points) {
      expect(Math.hypot(p.x - zone.x, p.y - zone.y) + CHEEK_HEART_UNDER / 2).toBeLessThanOrEqual(zone.r + 1e-9);
    }
  });

  it('sits below and behind the near eye, 13.0 or more from its centre', () => {
    expect(box.maxX).toBeLessThan(NEAR_EYE.x);
    expect(box.minY).toBeGreaterThan(NEAR_EYE.y);
    const gap = Math.hypot(zone.x - NEAR_EYE.x, zone.y - NEAR_EYE.y) - zone.r;
    expect(gap).toBeGreaterThanOrEqual(13);
    expect(gap).toBeCloseTo(13.1, 2);
  });

  it('keeps its zone off both eye zones, both lash reach circles and every lash of every variant at every blink', () => {
    for (const circle of [CODE_NEAR_EYE_ZONE, CODE_FAR_EYE_ZONE, NEAR_LASH_REACH, FAR_LASH_REACH]) {
      expect(Math.hypot(zone.x - circle.x, zone.y - circle.y)).toBeGreaterThan(zone.r + circle.r);
    }
    for (const variant of EYE_VARIANTS) {
      for (const spot of [NEAR_EYE, FAR_EYE]) {
        for (const lash of eyelashMarks(variant, spot.r)) {
          for (const blink of [...LASH_BLINKS, ...RIG_BLINKS]) {
            const [a, b, c, d] = lashStrokeCorners(lash, EYELASH_UNDER, blink);
            const poly = [a, c, d, b].map((p) => ({ x: spot.x + p.x, y: spot.y + p.y }));
            expect(isInConvex(poly, zone)).toBe(false);
            for (let i = 0; i < 4; i++) {
              expect(pointSegmentDistance(zone, poly[i], poly[(i + 1) % 4])).toBeGreaterThan(zone.r);
            }
          }
        }
      }
    }
  });

  it('keeps its zone off the gill-root zone, the mouth zone, the Head slot and the glasses band', () => {
    expect(boxCircleGap(CODE_GILL_ROOT_ZONE, zone)).toBeGreaterThan(0);
    expect(boxCircleGap(CODE_MOUTH_ZONE, zone)).toBeGreaterThan(0);
    expect(boxCircleGap(HEAD_FOOTPRINT, zone)).toBeGreaterThan(0);
    for (const lens of GLASSES_LENSES) {
      expect(Math.hypot(zone.x - lens.x, zone.y - lens.y)).toBeGreaterThan(zone.r + lens.r + GLASSES_BAND / 2);
    }
    expect(zoneBox.minX - CODE_GILL_ROOT_ZONE.maxX).toBeCloseTo(0.9, 1);
    expect(CODE_MOUTH_ZONE.minX - zoneBox.maxX).toBeCloseTo(0.9, 1);
  });

  it('stays inside the head inset LW / 2 and the face, gills and whole crops', () => {
    expect(headDepth(zone)).toBeGreaterThanOrEqual(zone.r + LW / 2);
    for (const crop of [AXO_PREVIEW_CROPS.face, AXO_PREVIEW_CROPS.gills, AXO_PREVIEW_CROPS.whole]) {
      expectInside(zoneBox, crop);
    }
  });

  it('paints the white under-stroke, then the fill, then the ink outline, on one closed path', () => {
    const calls: string[] = [];
    class StubPath2D {
      moveTo(): void {
        calls.push('moveTo');
      }
      lineTo(): void {}
      closePath(): void {
        calls.push('closePath');
      }
    }
    vi.stubGlobal('Path2D', StubPath2D);
    const state = { lineWidth: 0, strokeStyle: '', fillStyle: '' };
    const ctx = {
      fill: () => calls.push(`fill:${state.fillStyle}`),
      stroke: () => calls.push(`stroke:${state.strokeStyle}:${state.lineWidth}`),
      set lineWidth(v: number) {
        state.lineWidth = v;
      },
      set strokeStyle(v: string) {
        state.strokeStyle = v;
      },
      set fillStyle(v: string) {
        state.fillStyle = v;
      },
    } as unknown as CanvasRenderingContext2D;
    try {
      paintCheekHeart(ctx);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(calls).toEqual([
      'moveTo',
      'closePath',
      `stroke:${WHITE}:${CHEEK_HEART_UNDER}`,
      `fill:${CHEEK_HEART}`,
      `stroke:${INK}:${CHEEK_HEART_INK}`,
    ]);
  });
});

describe('every look (eyes, mouth, gills, spots, Boy or girl, Tail, Body, Age)', () => {
  /** Ids of every look failing `holds`; expected empty. */
  function failingLooks(holds: (look: AxolotlArtLook) => boolean): string[] {
    return EVERY_LOOK.filter((look) => !holds(look)).map((look) => Object.values(look).join(' '));
  }

  it('enumerates every combination', () => {
    expect(EVERY_LOOK).toHaveLength(5 * 8 * 3 * 4 * 2 * 3 * 3 * 3);
  });

  it('fits AXO_TEX with padding at sampled flutter phases and tail amplitudes 1 and 1.6', () => {
    const inner = frameInner(FRAME_PAD);
    const fits = memoBy(
      (look) => [look.gills, look.sex, look.tail, look.body, look.age].join('|'),
      (look) => {
        const boxes: Bounds[] = [];
        for (const swim of SWIM_SAMPLES) {
          for (const amp of TAIL_AMPS) boxes.push(axolotlInkBounds(look, swim, 0, amp));
        }
        for (const tfl of GILL_SAMPLES) boxes.push(axolotlInkBounds(look, 0, tfl, 1));
        return isInside(unionBounds(boxes), inner);
      },
    );
    expect(failingLooks(fits)).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('keeps eye marks inside the eye zones, lashes inside the lash reach circle and the head, clear of the gill stems and Head slot, and a Grumpy brow (no eye mark) to its own bound in the face crop', () => {
    const zones = [
      [NEAR_EYE, NEAR_EYE_ZONE],
      [FAR_EYE, FAR_EYE_ZONE],
    ] as const;
    const eyesHold = memoBy(
      (look) => `${look.eyes}|${look.sex}`,
      (look) =>
        zones.every(([spot, zone]) => {
          const marks = eyeMarks(look.eyes, spot.r);
          const glintsIn = marks.glints.every((g) => Math.hypot(g.x, g.y) + g.r <= marks.beadR + 1e-9);
          const lashes = look.sex === 'girl' ? eyelashMarks(look.eyes, spot.r) : [];
          const lashesIn = lashes.every((lash) => lashPaintHolds(lash, spot));
          const browIn = look.eyes !== 'grumpy' || isInside(grumpyBrowInkBounds(spot), AXO_PREVIEW_CROPS.face);
          return marks.beadR <= zone.r && glintsIn && lashesIn && browIn;
        }),
    );
    expect(failingLooks(eyesHold)).toEqual([]);
  });

  it('keeps the gill roots unchanged and inside the gill-root zone, and stems left of x 15.5', () => {
    const stemPad = GILL_STEM_W / 2 + GILL_STEM_OL;
    const rootInZone = (spec: GillRoot): boolean =>
      spec.bx >= GILL_ROOT_ZONE.minX &&
      spec.bx <= GILL_ROOT_ZONE.maxX &&
      spec.by >= GILL_ROOT_ZONE.minY &&
      spec.by <= GILL_ROOT_ZONE.maxY;
    const gillsHold = memoBy(
      (look) => `${look.gills}|${look.age}`,
      (look) =>
        (['far', 'near'] as const).every((layer) => {
          const specs = gillSpecs(look.gills, layer, axolotlBodyGeometry(look).gillLength);
          const roots = layer === 'far' ? FAR_GILL_ROOTS : NEAR_GILL_ROOTS;
          const unchanged = specs.every(
            (spec, i) =>
              spec.bx === roots[i].bx &&
              spec.by === roots[i].by &&
              spec.off === roots[i].off &&
              spec.phase === roots[i].phase,
          );
          const stemsLeft = specs.every((spec) =>
            PHASES.every((tfl) => {
              const g = gillGeometry(spec, look.gills, tfl);
              return quadBounds(g.bx, g.by, g.cx, g.cy, g.tx, g.ty, stemPad).maxX <= 15.5;
            }),
          );
          return unchanged && specs.every(rootInZone) && stemsLeft;
        }),
    );
    expect(failingLooks(gillsHold)).toEqual([]);
  });

  it('keeps every mouth in the unchanged mouth zone', () => {
    const zone: Bounds = { minX: 26.4 - 1 - 1, minY: 4.6 - 1 - 1, maxX: 50.4 + 1 + 1, maxY: 15.5 + 3.6 + 1.2 + 1 };
    expect(failingLooks((look) => isInside(mouthInkBounds(look.mouth), zone))).toEqual([]);
  });

  it('keeps spots off the head, body spots inside the torso and tail marks on the tail core', () => {
    const spotsHold = memoBy(
      (look) => [look.spots, look.sex, look.tail, look.body, look.age].join('|'),
      (look) => {
        const geo = axolotlBodyGeometry(look);
        const set = SPOT_SETS[look.spots];
        return SWIM_SAMPLES.every((swim) =>
          TAIL_AMPS.every((amp) => {
            const marks = spotMarks(look.spots, swim, amp, geo.tail, geo.torso);
            const offHead = marks.every((m) => m.x + Math.max(m.rx, m.ry) <= 0);
            const bodyIn = marks.slice(0, set.body.length).every((m) => markInsideEllipse(m, geo.torso));
            const tailOn = marks.slice(set.body.length).every((m, i) => {
              const tp = tailPointAt(set.tail[i].s, swim, amp, geo.tail);
              return Math.abs(m.x - tp.x) < 1e-9 && Math.abs(m.y - tp.cy) + Math.max(m.rx, m.ry) <= tp.hc;
            });
            return offHead && bodyIn && tailOn;
          }),
        );
      },
    );
    expect(failingLooks(spotsHold)).toEqual([]);
  });

  it('keeps most of each spot option in view past the near gill stems at the still pose', () => {
    const stemsOf = memoBy((look) => `${look.gills}|${look.age}`, nearStemPoints);
    const clearHolds = memoBy(
      (look) => [look.spots, look.gills, look.sex, look.tail, look.body, look.age].join('|'),
      (look) => {
        const geo = axolotlBodyGeometry(look);
        const marks = spotMarks(look.spots, STILL_SWIM, 1, geo.tail, geo.torso);
        return clearAreaShare(marks, stemsOf(look)) >= SPOT_CLEAR_SHARE[look.spots];
      },
    );
    expect(failingLooks(clearHolds)).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('puts the Tail slot anchor on the core top at tail point 4, with its footprint in the frame', () => {
    const inner = frameInner(0);
    const anchorHolds = memoBy(
      (look) => [look.sex, look.tail, look.body, look.age].join('|'),
      (look) => {
        const tail = axolotlBodyGeometry(look).tail;
        return SWIM_SAMPLES.every((swim) =>
          TAIL_AMPS.every((amp) => {
            const painted = tailSamples(tail, swim, amp)[TAIL_SLOT_POINT];
            const tp = tailPointAt(TAIL_SLOT_POINT / TAIL_SEGMENTS, swim, amp, tail);
            const anchor = { x: tp.x, y: tp.cy - tp.hc };
            const onCoreTop =
              Math.abs(anchor.x - painted.x) < 1e-9 && Math.abs(anchor.y - (painted.cy - painted.hc)) < 1e-9;
            const footprint = boundsOfPoints([[anchor.x, anchor.y]], TAIL_SLOT_REACH);
            return onCoreTop && isInside(footprint, inner);
          }),
        );
      },
    );
    expect(TAIL_SLOT_POINT).toBe(4);
    expect(failingLooks((look) => TAIL_SLOT_POINT > axolotlBodyGeometry(look).tail.finStart)).toEqual([]);
    expect(failingLooks(anchorHolds)).toEqual([]);
  });
});

describe('AXO_TEX and preview crops', () => {
  it('holds every gill style and Age at every flutter phase', () => {
    const inner = frameInner(FRAME_PAD);
    for (const style of GILL_STYLE_IDS) {
      for (const k of [0.8, 1, 1.12]) {
        for (const t of PHASES) expectInside(gillInkBounds(style, t, k), inner);
      }
    }
  });

  it('crops the face round both eye zones, every mouth, the snout, the cheek heart and the Grumpy brows', () => {
    const face = AXO_PREVIEW_CROPS.face;
    for (const zone of [NEAR_EYE_ZONE, FAR_EYE_ZONE]) {
      expectInside({ minX: zone.x - zone.r, minY: zone.y - zone.r, maxX: zone.x + zone.r, maxY: zone.y + zone.r }, face);
    }
    for (const variant of MOUTH_VARIANTS) expectInside(mouthInkBounds(variant), face);
    expect(face.maxX).toBeGreaterThanOrEqual(HEAD_ELLIPSE.cx + HEAD_ELLIPSE.rx + 3.5);
    const heart = CHEEK_HEART_ZONE;
    expectInside(boundsOfPoints([[heart.x, heart.y]], heart.r), face);
    for (const spot of [NEAR_EYE, FAR_EYE]) expectInside(grumpyBrowInkBounds(spot), face);
    expect(face).toEqual({ minX: 12, minY: -20, maxX: 58, maxY: 24 });
  });

  it('crops the gills round every style and Age at every flutter phase', () => {
    for (const style of GILL_STYLE_IDS) {
      for (const k of [0.8, 1, 1.12]) {
        for (const t of PHASES) expectInside(gillInkBounds(style, t, k), AXO_PREVIEW_CROPS.gills);
      }
    }
  });

  it('crops the spots round every spot mark of every look at sampled swim phases, padded, with the back of the head', () => {
    const boxes: Bounds[] = [];
    const spotLooks = EVERY_LOOK.filter((look) => look.eyes === 'happy' && look.mouth === 'smile' && look.gills === 'fluffy');
    for (const look of spotLooks) {
      const geo = axolotlBodyGeometry(look);
      for (const swim of SWIM_SAMPLES) {
        for (const m of spotMarks(look.spots, swim, 1, geo.tail, geo.torso)) {
          boxes.push(boundsOfPoints([[m.x, m.y]], Math.max(m.rx, m.ry) + FRAME_PAD));
        }
      }
    }
    expect(spotLooks).toHaveLength(4 * 2 * 3 * 3 * 3);
    expectInside(unionBounds(boxes), AXO_PREVIEW_CROPS.spots);
    expect(AXO_PREVIEW_CROPS.spots.maxX).toBeGreaterThanOrEqual(6);
  });

  it('crops the whole axolotl to the AXO_TEX frame, and every crop sits in the frame', () => {
    expect(AXO_PREVIEW_CROPS.whole).toEqual(frameInner(0));
    for (const crop of Object.values(AXO_PREVIEW_CROPS)) expectInside(crop, frameInner(0));
  });
});

// ---------------------------------------------------------------------------
// Wearable slots (guide 6a, 6i, 6k, 11)
// ---------------------------------------------------------------------------

/** Guide 6i lash reach circles: eye radius plus 4.0. */
const NEAR_LASH_REACH_ZONE = { x: 28, y: -6, r: 10.4 };
const FAR_LASH_REACH_ZONE = { x: 42, y: -7, r: 9.3 };
/** Guide 6i mouth zone. */
const MOUTH_ZONE_BOX: Bounds = { minX: 24.4, minY: 2.6, maxX: 52.4, maxY: 21.3 };

/** The Back box's forward corner is built on the front line (#88): it may pass it by floating-point rounding only. */
const BACK_FRONT_ROUNDING = 1e-9;

/** Every Boy or girl, Tail, Body, Age and size: the fields the slot geometry reads (162 looks). */
function everyBodyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const size of AXO_SIZES)
    for (const sex of AXO_SEXES)
      for (const tail of AXO_TAILS)
        for (const body of AXO_BODIES)
          for (const age of AXO_AGES) looks.push({ ...DEFAULT_ART_LOOK, size, sex, tail, body, age });
  return looks;
}
const EVERY_BODY_LOOK = everyBodyLook();
const lookId = (look: AxolotlArtLook): string => [look.size, look.sex, look.tail, look.body, look.age].join(' ');
/** Ids of every body look failing `holds`; expected empty. */
function failingBodyLooks(holds: (look: AxolotlArtLook) => boolean): string[] {
  return EVERY_BODY_LOOK.filter((look) => !holds(look)).map(lookId);
}

function boxesOverlap(a: Bounds, b: Bounds): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** Whether a box stays out of both eye zones and the gill-root zone (guide 6i). */
function clearOfEyesAndGills(b: Bounds): boolean {
  return (
    boxCircleGap(b, NEAR_EYE_ZONE) >= 0 && boxCircleGap(b, FAR_EYE_ZONE) >= 0 && !boxesOverlap(b, GILL_ROOT_ZONE)
  );
}

/** Whether a box also stays out of both lash reach circles (a Girl's lashes count as part of the eyes). */
function clearOfLashReach(b: Bounds): boolean {
  return boxCircleGap(b, NEAR_LASH_REACH_ZONE) >= 0 && boxCircleGap(b, FAR_LASH_REACH_ZONE) >= 0;
}

/** Shortest distance from a point to the outline of an axis-aligned ellipse, by sampling. */
function distToEllipseEdge(x: number, y: number, e: BodyEllipse): number {
  let best = Infinity;
  for (let k = 0; k < 720; k++) {
    const a = (k / 720) * TAU;
    best = Math.min(best, Math.hypot(x - (e.cx + Math.cos(a) * e.rx), y - (e.cy + Math.sin(a) * e.ry)));
  }
  return best;
}

function expectBoxNear(actual: Bounds, expected: Bounds, tolerance: number): void {
  expect(Math.abs(actual.minX - expected.minX)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.minY - expected.minY)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.maxX - expected.maxX)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.maxY - expected.maxY)).toBeLessThanOrEqual(tolerance);
}

describe('Wearable slots: layers and zones (guide 6a, 6i)', () => {
  it('lists the eight slots in PRD order', () => {
    const order: WearableSlot[] = ['head', 'neck', 'face', 'shirt', 'back', 'tail', 'socks', 'feet'];
    expect(WEARABLE_SLOTS).toEqual(order);
  });

  it('has the guide layer values, back to front: Tail, Shirt, Neck, Back, Head, Face, then the eyes', () => {
    expect(WEARABLE_LAYERS).toEqual({ shirt: 9.3, tail: 9.2, neck: 9.5, back: 9.7, head: 10.5, face: 11.5 });
    expect(LEG_WEARABLE_LAYERS).toEqual({ far: 2.5, near: 3.5 });
    expect([0, 1, 2, 3].map(legSide)).toEqual(['far', 'far', 'near', 'near']);
    expect([0, 1, 2, 3].map(legWearableLayer)).toEqual([2.5, 2.5, 3.5, 3.5]);
    const bodyLayers = Object.values(WEARABLE_LAYERS);
    expect(bodyLayers.every((layer) => layer < EYES_LAYER)).toBe(true);
    expect(EYES_LAYER).toBe(12);
    // The Back item is above the Shirt and the Neck item, and above the Tail item.
    expect(WEARABLE_LAYERS.back).toBeGreaterThan(WEARABLE_LAYERS.neck);
    expect(WEARABLE_LAYERS.neck).toBeGreaterThan(WEARABLE_LAYERS.shirt);
    expect(WEARABLE_LAYERS.back).toBeGreaterThan(WEARABLE_LAYERS.tail);
    // The Tail and Shirt items are above the near gills (layer 9), so the gills never hide them.
    expect(WEARABLE_LAYERS.shirt).toBeGreaterThan(WEARABLE_LAYERS.tail);
    expect(WEARABLE_LAYERS.tail).toBeGreaterThan(9);
  });

  it('paints Socks and Feet behind the silhouette, so they can cover nothing on the body, head or gills', () => {
    expect(SILHOUETTE_LAYER).toBe(4);
    expect(LEG_WEARABLE_LAYERS.far).toBeLessThan(LEG_WEARABLE_LAYERS.near);
    expect(LEG_WEARABLE_LAYERS.near).toBeLessThan(SILHOUETTE_LAYER);
  });

  it('exports the guide keep-clear zones', () => {
    for (const [code, guide] of [
      [CODE_NEAR_EYE_ZONE, NEAR_EYE_ZONE],
      [CODE_FAR_EYE_ZONE, FAR_EYE_ZONE],
      [NEAR_LASH_REACH, NEAR_LASH_REACH_ZONE],
      [FAR_LASH_REACH, FAR_LASH_REACH_ZONE],
    ] as [ZoneCircle, ZoneCircle][]) {
      expect(code.x).toBe(guide.x);
      expect(code.y).toBe(guide.y);
      expect(code.r).toBeCloseTo(guide.r, 9);
    }
    expect(CODE_GILL_ROOT_ZONE).toEqual(GILL_ROOT_ZONE);
    expect(CODE_MOUTH_ZONE).toEqual(MOUTH_ZONE_BOX);
    expect(SHIRT_BACK_FRONT_LINE_X).toBe(-5.5);
    expect(TORSO_EDGE_BAND).toBe(1);
    // 0.5 units from the front line to the gill-root zone (#88: 1.8 before).
    expect(GILL_ROOT_ZONE.minX - SHIRT_BACK_FRONT_LINE_X).toBeCloseTo(0.5, 9);
  });

  it('frames points as the leg and Back frames need: u along, v across', () => {
    const f = { x: 10, y: 20, angle: Math.PI / 2 };
    const p = framePoint(f, 3, 2);
    expect(p.x).toBeCloseTo(8, 9);
    expect(p.y).toBeCloseTo(23, 9);
  });
});

describe('Head, Neck and Face slots (guide 6i): on the head, they never move', () => {
  it('has the guide anchors', () => {
    expect(HEAD_SLOT_ANCHOR).toEqual({ x: 26, y: -23 });
    expect(NECK_SLOT_ANCHOR).toEqual({ x: 17, y: 16 });
    expect(FACE_SLOT_ANCHOR).toEqual({ x: 35, y: -6.5 });
  });

  it('keeps the Head footprint on the head top (#88): x 16 to 46, no lower than y -19.5, no higher than y -44', () => {
    expect(HEAD_FOOTPRINT).toEqual({ minX: 16, minY: -44, maxX: 46, maxY: -19.5 });
    expect(HEAD_SLOT_ANCHOR.x).toBeGreaterThanOrEqual(HEAD_FOOTPRINT.minX);
    expect(HEAD_SLOT_ANCHOR.x).toBeLessThanOrEqual(HEAD_FOOTPRINT.maxX);
    expect(clearOfEyesAndGills(HEAD_FOOTPRINT)).toBe(true);
    expect(clearOfLashReach(HEAD_FOOTPRINT)).toBe(true);
    // The lowest Head ink is the lowest lash corner allowed (the eyelash tests).
    expect(HEAD_FOOTPRINT.maxY).toBe(LASH_MIN_Y);
    // Clear of the gill stems, which stay left of about x 15.5.
    expect(HEAD_FOOTPRINT.minX).toBeGreaterThan(15.5);
  });

  it('has an opt-in big Head footprint (#207): x 16 to 56, y -72 to -19.5, holding the Head footprint, clear of the eyes, lashes, gill roots and cheek heart', () => {
    expect(HEAD_BIG_FOOTPRINT).toEqual({ minX: 16, minY: -72, maxX: 56, maxY: -19.5 });
    expect(isInside(HEAD_FOOTPRINT, HEAD_BIG_FOOTPRINT)).toBe(true);
    // Same back edge and lowest point as the Head footprint: it grows only forward and up.
    expect(HEAD_BIG_FOOTPRINT.minX).toBe(HEAD_FOOTPRINT.minX);
    expect(HEAD_BIG_FOOTPRINT.maxY).toBe(HEAD_FOOTPRINT.maxY);
    expect(HEAD_BIG_FOOTPRINT.maxY).toBe(LASH_MIN_Y);
    expect(HEAD_BIG_FOOTPRINT.minX).toBeGreaterThan(15.5);
    expect(clearOfEyesAndGills(HEAD_BIG_FOOTPRINT)).toBe(true);
    expect(clearOfLashReach(HEAD_BIG_FOOTPRINT)).toBe(true);
    expect(boxCircleGap(HEAD_BIG_FOOTPRINT, CHEEK_HEART_ZONE)).toBeGreaterThan(0);
    // FRAME_PAD or more inside the AXO_TEX frame: the padded top is y -75.
    expect(frameInner(FRAME_PAD).minY).toBe(-75);
    expect(isInside(HEAD_BIG_FOOTPRINT, frameInner(FRAME_PAD))).toBe(true);
    expect(HEAD_BIG_FOOTPRINT.minY - frameInner(FRAME_PAD).minY).toBe(3);
    expect(frameInner(FRAME_PAD).maxX - HEAD_BIG_FOOTPRINT.maxX).toBe(4);
  });

  it('keeps the Neck footprint under the chin (#88), x 2 to 42, y 13.1 to 22.75: clear of the eyes, lashes and gill roots, over the mouth-zone box', () => {
    expect(NECK_FOOTPRINT).toEqual({ minX: 2, minY: 13.1, maxX: 42, maxY: 22.75 });
    expect(clearOfEyesAndGills(NECK_FOOTPRINT)).toBe(true);
    expect(clearOfLashReach(NECK_FOOTPRINT)).toBe(true);
    // Below the gill-root zone, so the Neck item may reach behind x 12.
    expect(NECK_FOOTPRINT.minY).toBeGreaterThan(GILL_ROOT_ZONE.maxY);
    // The mouth zone is not keep-clear for a Wearable (#88): the mouth paints over the Neck item.
    expect(boxesOverlap(NECK_FOOTPRINT, MOUTH_ZONE_BOX)).toBe(true);
    expect(WEARABLE_LAYERS.neck).toBeLessThan(11);
    // The Neck item's paint keeps off the cheek heart zone (wearableArt.test.ts); the box only holds it.
    expect(boxCircleGap(NECK_FOOTPRINT, CHEEK_HEART_ZONE)).toBeLessThan(0);
  });

  it('keeps the Neck footprint no lower than LW / 2 under the head\'s lowest point, so nothing hangs below the silhouette', () => {
    // The outline ink is LW outside the head ellipse, so LW / 2 inside its outer edge is LW / 2 below the head's lowest point.
    expect(NECK_FOOTPRINT.maxY).toBeCloseTo(HEAD_ELLIPSE.cy + HEAD_ELLIPSE.ry + LW / 2, 9);
    // The Neck item's paint is held inside the silhouette on every look in wearableArt.test.ts.
    expect(NECK_FOOTPRINT.minX).toBeGreaterThan(HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx);
    expect(NECK_FOOTPRINT.maxX).toBeLessThan(HEAD_ELLIPSE.cx + HEAD_ELLIPSE.rx);
  });

  it('draws the glasses as one merged frame whose band keeps off both eye zones', () => {
    expect(GLASSES_LENSES).toEqual([
      { x: 28, y: -6, r: 9.95 },
      { x: 42, y: -7, r: 8.85 },
    ]);
    expect(GLASSES_BAND).toBe(3.5);
    const outline = glassesOutlinePoints(360);
    expect(outline.length).toBeGreaterThan(300);
    const half = GLASSES_BAND / 2;
    for (const p of outline) {
      // The band's inner edge lies on the eye zones: 1.8 units from each bead, never inside.
      const nearGap = Math.hypot(p.x - NEAR_EYE_ZONE.x, p.y - NEAR_EYE_ZONE.y) - half - NEAR_EYE_ZONE.r;
      const farGap = Math.hypot(p.x - FAR_EYE_ZONE.x, p.y - FAR_EYE_ZONE.y) - half - FAR_EYE_ZONE.r;
      expect(nearGap).toBeGreaterThanOrEqual(-1e-9);
      expect(farGap).toBeGreaterThanOrEqual(-1e-9);
    }
    // The notch gap to each zone is the guide's design: the band runs 1.75 either side of the outline.
    const [top, under] = glassesNotches();
    expect(Math.hypot(top.x - 35.3, top.y + 12.8)).toBeLessThan(0.1);
    expect(Math.hypot(under.x - 36.2, under.y + 0.3)).toBeLessThan(0.1);
    for (const notch of [top, under]) {
      expect(Math.hypot(notch.x - NEAR_EYE_ZONE.x, notch.y - NEAR_EYE_ZONE.y) - half).toBeGreaterThanOrEqual(
        NEAR_EYE_ZONE.r - 1e-9,
      );
      expect(Math.hypot(notch.x - FAR_EYE_ZONE.x, notch.y - FAR_EYE_ZONE.y) - half).toBeGreaterThanOrEqual(
        FAR_EYE_ZONE.r - 1e-9,
      );
    }
  });

  it('keeps the glasses at x 16.3 to 52.6, y -17.7 to 5.7, with the Head item 1.8 above and the gill-root zone clear', () => {
    expectBoxNear(GLASSES_EXTENT, { minX: 16.3, minY: -17.7, maxX: 52.6, maxY: 5.7 }, 0.05);
    expect(GLASSES_EXTENT.minY - HEAD_FOOTPRINT.maxY).toBeCloseTo(1.8, 1);
    expect(GLASSES_EXTENT.minX).toBeGreaterThan(GILL_ROOT_ZONE.maxX);
    expect(GLASSES_TEMPLE_MIN_X).toBe(14);
    expect(GLASSES_TEMPLE_MIN_X).toBeGreaterThan(GILL_ROOT_ZONE.maxX);
    // Inside the guide's footprint box.
    expectInside(GLASSES_EXTENT, { minX: 14, minY: -18, maxX: 54, maxY: 6 });
  });

  it('lets the glasses band reach the lash reach circles, because the eye layer paints above it', () => {
    expect(clearOfLashReach(GLASSES_EXTENT)).toBe(false);
    expect(EYES_LAYER).toBeGreaterThan(WEARABLE_LAYERS.face);
  });

  it('keeps the glasses band 1.40 clear of the cheek heart zone', () => {
    const gap = Math.min(
      ...glassesOutlinePoints(720).map((p) => Math.hypot(p.x - CHEEK_HEART_ZONE.x, p.y - CHEEK_HEART_ZONE.y)),
    ) - GLASSES_BAND / 2 - CHEEK_HEART_ZONE.r;
    expect(gap).toBeCloseTo(1.4, 2);
    expect(gap).toBeGreaterThan(0);
  });

  it('keeps the glasses about 1.0 from the near mouth tick and 0.7 from the Big grin back tick', () => {
    const gap = (tick: LocalPoint): number =>
      Math.min(...glassesOutlinePoints(720).map((p) => Math.hypot(p.x - tick.x, p.y - tick.y))) -
      GLASSES_BAND / 2 -
      MOUTH_TICK_INK / 2;
    expect(gap({ x: 26.4, y: 7.6 })).toBeGreaterThan(0.9);
    expect(gap({ x: 26.4, y: 7.6 })).toBeLessThan(1.1);
    expect(gap({ x: 25.6, y: 7.2 })).toBeGreaterThan(0.6);
    expect(gap({ x: 25.6, y: 7.2 })).toBeLessThan(0.8);
  });
});

describe('Shirt slot (guide 6i)', () => {
  it('has the torso centre as its anchor, and the front edge on the front line, x -5.5, with a 1.5-unit neckline (#88)', () => {
    expect(SHIRT_FRONT_X).toBe(-5.5);
    expect(SHIRT_FRONT_X).toBe(SHIRT_BACK_FRONT_LINE_X);
    expect(SHIRT_NECKLINE_DEPTH).toBe(1.5);
    for (const look of EVERY_BODY_LOOK) {
      const torso = axolotlBodyGeometry(look).torso;
      const shirt = shirtGeometry(look);
      expect(shirt.anchor).toEqual({ x: torso.cx, y: 4 });
      expect(shirt.neckline.x).toBe(-5.5);
      expect(shirt.neckline.apexX).toBeCloseTo(-7, 9);
      expect(shirt.neckline.yTop).toBeLessThan(shirt.neckline.yBottom);
    }
  });

  it('stays inside the torso ellipse inset 1 all round (#88: 3 before), so body colour shows between it and the outline', () => {
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const shirt = shirtGeometry(look);
        const inset = { ...torso, rx: torso.rx - TORSO_EDGE_BAND, ry: torso.ry - TORSO_EDGE_BAND };
        const { bounds } = shirt;
        for (let i = 0; i <= 24; i++) {
          for (let j = 0; j <= 12; j++) {
            const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 24;
            const y = bounds.minY + ((bounds.maxY - bounds.minY) * j) / 12;
            if (shirtContains(shirt, x, y) && !isInEllipse({ x, y }, inset)) return false;
          }
        }
        // The footprint box corners that matter: the extremes of the clipped inset ellipse lie on it.
        return (
          isInEllipse({ x: bounds.minX, y: shirt.anchor.y }, inset) &&
          isInEllipse({ x: bounds.maxX, y: shirt.anchor.y }, inset)
        );
      }),
    ).toEqual([]);
  });

  it('leaves at least 0.9 units of body between the Shirt and the torso edge, all round', () => {
    // Radii rx - 1 and ry - 1 put the Shirt 1 unit in along both axes; round the diagonals it is a little nearer.
    const worst = Math.min(
      ...EVERY_BODY_LOOK.map((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const shirt = shirtGeometry(look);
        let nearest = Infinity;
        for (let k = 0; k < 90; k++) {
          const a = (k / 90) * TAU;
          const x = shirt.inset.cx + Math.cos(a) * shirt.inset.rx;
          const y = shirt.inset.cy + Math.sin(a) * shirt.inset.ry;
          if (shirtContains(shirt, x, y)) nearest = Math.min(nearest, distToEllipseEdge(x, y, torso));
        }
        return nearest;
      }),
    );
    expect(worst).toBeCloseTo(0.93, 2);
    expect(worst).toBeGreaterThanOrEqual(0.9);
  });

  it('is cut at the tail root at the rear and at x -5.5 at the front, off the head and the gill-root zone', () => {
    expect(
      failingBodyLooks((look) => {
        const geo = axolotlBodyGeometry(look);
        const { bounds } = shirtGeometry(look);
        const headStart = HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx;
        return (
          bounds.minX >= geo.tail.rootX - 1e-9 &&
          bounds.maxX === -5.5 &&
          bounds.maxX <= SHIRT_BACK_FRONT_LINE_X &&
          GILL_ROOT_ZONE.minX - bounds.maxX >= 0.5 &&
          headStart - bounds.maxX >= 4.5 &&
          clearOfEyesAndGills(bounds) &&
          clearOfLashReach(bounds)
        );
      }),
    ).toEqual([]);
  });

  it('ends at the tail root, so it never meets the waving tail core', () => {
    expect(
      failingBodyLooks((look) => {
        const geo = axolotlBodyGeometry(look);
        const { bounds } = shirtGeometry(look);
        return SWIM_SAMPLES.every((swim) =>
          TAIL_AMPS.every((amp) =>
            tailSamples(geo.tail, swim, amp)
              .slice(1)
              .every((tp) => tp.x < bounds.minX),
          ),
        );
      }),
    ).toEqual([]);
  });

  it('never reaches a leg: every visible leg point lies outside the Shirt', () => {
    expect(
      failingBodyLooks((look) => {
        const geo = axolotlBodyGeometry(look);
        const shirt = shirtGeometry(look);
        return SWIM_SAMPLES.every((swim) =>
          legSlotFrames(look, swim).every((frame) => {
            for (let k = 0; k <= 20; k++) {
              const p = framePoint(frame, (frame.length * k) / 20, 0);
              const outsideTorso = !isInEllipse(p, geo.torso);
              if (outsideTorso && shirtContains(shirt, p.x, p.y)) return false;
            }
            return true;
          }),
        );
      }),
    ).toEqual([]);
  });

  it('measures x -38 to -5.5 and y -22 to 30 over every look', () => {
    const boxes = EVERY_BODY_LOOK.map((look) => shirtGeometry(look).bounds);
    expectBoxNear(unionBounds(boxes), { minX: -38, minY: -22, maxX: -5.5, maxY: 30 }, 0.05);
  });
});

describe('Back slot (guide 6i)', () => {
  it('rests on the torso top edge at x -17', () => {
    expect(BACK_ANCHOR_X).toBe(-17);
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const frame = backFrame(torso);
        const onEdge = ((frame.x - torso.cx) / torso.rx) ** 2 + ((frame.y - torso.cy) / torso.ry) ** 2;
        // Above the torso centre line, and the item turns to rise toward the snout (negative angle).
        return Math.abs(onEdge - 1) < 1e-9 && frame.x === -17 && frame.y < torso.cy && frame.angle < 0;
      }),
    ).toEqual([]);
  });

  it('turns to the edge tangent, which is exact: a step along x' + "'" + ' follows the edge', () => {
    for (const look of EVERY_BODY_LOOK) {
      const torso = axolotlBodyGeometry(look).torso;
      const frame = backFrame(torso);
      const eps = 1e-4;
      const topAt = (x: number): number =>
        torso.cy - torso.ry * Math.sqrt(1 - ((x - torso.cx) / torso.rx) ** 2);
      const slope = (topAt(frame.x + eps) - topAt(frame.x - eps)) / (2 * eps);
      expect(Math.tan(frame.angle)).toBeCloseTo(slope, 6);
    }
  });

  it('measures anchor y -22.8 to -9.1 and angle -0.374 to -0.070 over every look', () => {
    const frames = EVERY_BODY_LOOK.map((look) => backFootprint(look).frame);
    expect(Math.min(...frames.map((f) => f.y))).toBeCloseTo(-22.8, 1);
    expect(Math.max(...frames.map((f) => f.y))).toBeCloseTo(-9.1, 1);
    expect(Math.min(...frames.map((f) => f.angle))).toBeCloseTo(-0.374, 3);
    expect(Math.max(...frames.map((f) => f.angle))).toBeCloseTo(-0.07, 3);
  });

  it('has a look-dependent box (#88): y\' -14 to 3, 22 long or half the torso length (2 rx - 30), forward corner on the front line', () => {
    expect([BACK_BOX_MIN_V, BACK_BOX_MAX_V, BACK_BOX_MIN_LENGTH]).toEqual([-14, 3, 22]);
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const { frame, box, corners } = backFootprint(look);
        const forward = framePoint(frame, box.maxU, box.maxV);
        return (
          box.minV === BACK_BOX_MIN_V &&
          box.maxV === BACK_BOX_MAX_V &&
          Math.abs(box.maxU - box.minU - Math.max(22, (2 * torso.rx - 30) / 2)) < 1e-9 &&
          Math.abs(forward.x - SHIRT_BACK_FRONT_LINE_X) < 1e-9 &&
          corners.every((c) => c.x <= forward.x + 1e-9) &&
          JSON.stringify(backFrameBox(torso)) === JSON.stringify(box)
        );
      }),
    ).toEqual([]);
  });

  it('measures maxU 11.10 to 11.32 and minU -14.71 to -10.75: 22 long, 24 on a Young Chubby or Grown-up Slim or Regular, 26 on a Grown-up Chubby', () => {
    const boxes = EVERY_BODY_LOOK.map((look) => backFootprint(look).box);
    expect(Math.min(...boxes.map((b) => b.maxU))).toBeCloseTo(11.1, 2);
    expect(Math.max(...boxes.map((b) => b.maxU))).toBeCloseTo(11.32, 2);
    expect(Math.min(...boxes.map((b) => b.minU))).toBeCloseTo(-14.71, 2);
    expect(Math.max(...boxes.map((b) => b.minU))).toBeCloseTo(-10.75, 2);
    expect([...new Set(boxes.map((b) => Math.round(b.maxU - b.minU)))].sort()).toEqual([22, 24, 26]);
  });

  it('lays its body-side edge over the torso: both body-side corners inside the torso ellipse on every look', () => {
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const { frame, box } = backFootprint(look);
        return [box.minU, box.maxU].every((u) => isInEllipse(framePoint(frame, u, box.maxV), torso));
      }),
    ).toEqual([]);
  });

  it('has its four corners at x -32.8 to -5.5 and y -37.9 to -3.4 over every look', () => {
    const boxes = EVERY_BODY_LOOK.map((look) => backFootprint(look).bounds);
    expectBoxNear(unionBounds(boxes), { minX: -32.8, minY: -37.9, maxX: -5.5, maxY: -3.4 }, 0.06);
  });

  it('keeps its forward corner at x -5.5 or less, clear of the gill-root zone, the head, the eyes and the lashes', () => {
    expect(
      failingBodyLooks((look) => {
        const { bounds } = backFootprint(look);
        return (
          bounds.maxX <= SHIRT_BACK_FRONT_LINE_X + BACK_FRONT_ROUNDING &&
          GILL_ROOT_ZONE.minX - bounds.maxX >= 0.5 - BACK_FRONT_ROUNDING &&
          bounds.maxX < HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx &&
          clearOfEyesAndGills(bounds) &&
          clearOfLashReach(bounds)
        );
      }),
    ).toEqual([]);
  });

  it('keeps every gill root and its stem ink clear, with no root inside its footprint', () => {
    const stemInk = GILL_STEM_W / 2 + GILL_STEM_OL;
    const roots = [...FAR_GILL_ROOTS, ...NEAR_GILL_ROOTS];
    expect(
      failingBodyLooks((look) => {
        const { bounds } = backFootprint(look);
        return roots.every(
          (root) =>
            bounds.maxX <= root.bx - stemInk + 1e-9 || boxCircleGap(bounds, { x: root.bx, y: root.by, r: stemInk }) >= 0,
        );
      }),
    ).toEqual([]);
  });
});

describe('big Back slot (#207, guide 6i): opt-in, outer edge y\' -30', () => {
  it('is the Back box with only its outer edge moved out to y\' -30: same frame, length, body-side edge and forward corner', () => {
    expect(BACK_BIG_BOX_MIN_V).toBe(-30);
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        const big = backBigFootprint(look);
        const back = backFootprint(look);
        const forward = framePoint(big.frame, big.box.maxU, big.box.maxV);
        return (
          JSON.stringify(big.frame) === JSON.stringify(back.frame) &&
          JSON.stringify(big.box) === JSON.stringify({ ...back.box, minV: BACK_BIG_BOX_MIN_V }) &&
          JSON.stringify(backFrameBox(torso, BACK_BIG_BOX_MIN_V)) === JSON.stringify(big.box) &&
          Math.abs(forward.x - SHIRT_BACK_FRONT_LINE_X) < 1e-9 &&
          big.corners.every((c) => c.x <= forward.x + 1e-9) &&
          isInside(back.bounds, big.bounds)
        );
      }),
    ).toEqual([]);
  });

  it('leaves the Back box as it was: backFootprint and backFrameBox keep the outer edge at y\' -14', () => {
    expect(BACK_BOX_MIN_V).toBe(-14);
    expect(
      failingBodyLooks((look) => {
        const torso = axolotlBodyGeometry(look).torso;
        return backFootprint(look).box.minV === -14 && backFrameBox(torso).minV === -14;
      }),
    ).toEqual([]);
  });

  it('keeps its forward corner at x -5.5 or less, clear of the gill-root zone, the head, the eyes, the lashes and the cheek heart', () => {
    expect(
      failingBodyLooks((look) => {
        const { bounds } = backBigFootprint(look);
        return (
          bounds.maxX <= SHIRT_BACK_FRONT_LINE_X + BACK_FRONT_ROUNDING &&
          GILL_ROOT_ZONE.minX - bounds.maxX >= 0.5 - BACK_FRONT_ROUNDING &&
          bounds.maxX < HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx &&
          clearOfEyesAndGills(bounds) &&
          clearOfLashReach(bounds) &&
          boxCircleGap(bounds, CHEEK_HEART_ZONE) > 0
        );
      }),
    ).toEqual([]);
  });

  it('keeps every gill root and its stem ink clear, with no root inside its footprint', () => {
    const stemInk = GILL_STEM_W / 2 + GILL_STEM_OL;
    const roots = [...FAR_GILL_ROOTS, ...NEAR_GILL_ROOTS];
    expect(
      failingBodyLooks((look) => {
        const { bounds } = backBigFootprint(look);
        return roots.every(
          (root) =>
            bounds.maxX <= root.bx - stemInk + 1e-9 || boxCircleGap(bounds, { x: root.bx, y: root.by, r: stemInk }) >= 0,
        );
      }),
    ).toEqual([]);
  });

  it('has its four corners at x -38.0 to -5.5 and y -53.7 to -3.4 over every look, FRAME_PAD or more inside the AXO_TEX frame', () => {
    const inner = frameInner(FRAME_PAD);
    expect(failingBodyLooks((look) => isInside(backBigFootprint(look).bounds, inner))).toEqual([]);
    const all = unionBounds(EVERY_BODY_LOOK.map((look) => backBigFootprint(look).bounds));
    expectBoxNear(all, { minX: -38.0, minY: -53.7, maxX: -5.5, maxY: -3.4 }, 0.06);
    expect(all.minY - inner.minY).toBeGreaterThan(21);
  });
});

describe('Tail slot (guide 6i)', () => {
  it('has the anchor on the core top at tail point 4: (-42.6,-5.6), and (-43.7,-5.6) on the default Boy', () => {
    const proto = tailSlotFrame(PROTOTYPE_TAIL, 0, 0);
    expect(proto.x).toBeCloseTo(-42.6, 1);
    expect(proto.y).toBeCloseTo(-5.6, 1);
    expect(proto.angle).toBeCloseTo(0, 9);
    const boy = tailSlotFrame(axolotlBodyGeometry(DEFAULT_ART_LOOK).tail, 0, 0);
    expect(boy.x).toBeCloseTo(-43.7, 1);
    expect(boy.y).toBeCloseTo(-5.6, 1);
  });

  it('follows the tail wave: its anchor is the painted core top, and it turns with the local tail direction', () => {
    expect(
      failingBodyLooks((look) => {
        const tail = axolotlBodyGeometry(look).tail;
        return SWIM_SAMPLES.every((swim) =>
          TAIL_AMPS.every((amp) => {
            const painted = tailSamples(tail, swim, amp)[TAIL_SLOT_POINT];
            const frame = tailSlotFrame(tail, swim, amp);
            return (
              Math.abs(frame.x - painted.x) < 1e-9 &&
              Math.abs(frame.y - (painted.cy - painted.hc)) < 1e-9 &&
              Math.abs(frame.angle) < Math.PI / 2
            );
          }),
        );
      }),
    ).toEqual([]);
  });

  it('keeps its 17.5-unit footprint (#88: 9, then 12, before) clear of the eyes, lashes, gills and the head, and in the frame', () => {
    expect(TAIL_SLOT_REACH).toBe(17.5);
    const inner = frameInner(FRAME_PAD);
    expect(
      failingBodyLooks((look) => {
        const tail = axolotlBodyGeometry(look).tail;
        return SWIM_SAMPLES.every((swim) =>
          TAIL_AMPS.every((amp) => {
            const b = tailSlotBounds(tailSlotFrame(tail, swim, amp));
            return (
              clearOfEyesAndGills(b) &&
              clearOfLashReach(b) &&
              isInside(b, inner) &&
              b.maxX < HEAD_ELLIPSE.cx - HEAD_ELLIPSE.rx
            );
          }),
        );
      }),
    ).toEqual([]);
  });
});

describe('Socks and Feet slots (guide 6i, 6q)', () => {
  /** The leg angle the painter swings (guide 9), written out independently. */
  const swungAngle = (index: number, swim: number): number =>
    [Math.PI / 2 - 0.2, Math.PI / 2 + 0.5, Math.PI / 2 - 0.2, Math.PI / 2 + 0.5][index] +
    0.35 * Math.sin(swim + [Math.PI, 0, 0, Math.PI][index]);

  it('puts each frame at its leg root, turned with the paddle, with the look leg lengths', () => {
    for (const look of EVERY_BODY_LOOK) {
      const geo = axolotlBodyGeometry(look);
      for (const swim of [0, 1, 2.5, 4]) {
        const frames = legSlotFrames(look, swim);
        expect(frames).toHaveLength(4);
        frames.forEach((frame, i) => {
          expect(frame.index).toBe(i);
          expect(frame.side).toBe(i < 2 ? 'far' : 'near');
          expect(frame.x).toBe(geo.legRoots[i].x);
          expect(frame.y).toBe(geo.legRoots[i].y);
          expect(frame.angle).toBeCloseTo(swungAngle(i, swim), 12);
          expect(legAngle(i, swim)).toBeCloseTo(swungAngle(i, swim), 12);
          expect(frame.length).toBe(geo.legLengths[i]);
          expect(frame.toeLength).toBe(geo.toeLength);
          expect(frame.baby).toBe(look.age === 'baby');
          // Sleeve starts at the root: the root lies on its axis.
          const sleeve = sockSleeveBounds(frame);
          expect(frame.x).toBeGreaterThan(sleeve.minX);
          expect(frame.x).toBeLessThan(sleeve.maxX);
          expect(frame.y).toBeGreaterThan(sleeve.minY);
          expect(frame.y).toBeLessThan(sleeve.maxY);
        });
      }
    }
  });

  it('has the #88 pad, Shoe and Feet envelope in leg space (Young: l 14 or 15, t 8.5)', () => {
    const frames = legSlotFrames({ ...DEFAULT_ART_LOOK, age: 'young' }, 0);
    const far = frames[0];
    const near = frames[2];
    for (const [frame, l] of [
      [far, 14],
      [near, 15],
    ] as const) {
      const t = 8.5;
      const pad = sockFootPad(frame);
      expect(pad.u0).toBeCloseTo(l - 2, 9);
      expect(pad.u1).toBeCloseTo(l + t + 6, 9);
      expect(pad.vHalf).toBe(11.2);
      const shoe = shoeRect(frame);
      expect(shoe.u0).toBeCloseTo(l - 2, 9);
      expect(shoe.u1).toBeCloseTo(l + t + 7.6, 9);
      expect(shoe.vHalf).toBe(13.2);
      const env = feetEnvelope(frame);
      expect(env.u0).toBeCloseTo(l - 2, 9);
      expect(env.u1).toBeCloseTo(l + t + 10.3, 9);
      expect(env.vHalf).toBe(FEET_ENVELOPE_HALF_WIDTH);
      expect(env.vHalf).toBe(13.5);
      expect(pad.radius).toBeLessThanOrEqual(8);
      expect(shoe.radius).toBeLessThanOrEqual(8);
      expect(env.radius).toBe(0);
    }
  });

  it('narrows a Baby: pad +/-9.9, Shoe +/-12.2, toes 5.95, legs x0.7', () => {
    const baby = legSlotFrames({ ...DEFAULT_ART_LOOK, age: 'baby' }, 0);
    expect(baby.map((f) => f.length)).toEqual([14 * 0.7, 14 * 0.7, 15 * 0.7, 15 * 0.7]);
    expect(baby[0].toeLength).toBeCloseTo(5.95, 9);
    expect(sockFootPad(baby[0]).vHalf).toBe(9.9);
    expect(shoeRect(baby[0]).vHalf).toBe(12.2);
    expect(feetEnvelope(baby[0]).vHalf).toBe(13.5);
  });

  it('keeps the pad and the Shoe inside the Feet envelope, and the Shoe over the pad at the sides and front', () => {
    for (const look of EVERY_BODY_LOOK) {
      for (const frame of legSlotFrames(look, 0)) {
        const pad = sockFootPad(frame);
        const shoe = shoeRect(frame);
        const env = feetEnvelope(frame);
        for (const r of [pad, shoe]) {
          expect(r.u0).toBeGreaterThanOrEqual(env.u0);
          expect(r.u1).toBeLessThanOrEqual(env.u1);
          expect(r.vHalf).toBeLessThanOrEqual(env.vHalf);
        }
        // The Shoe's fill edge (ink edge less 1.4) lies 0.1 or more beyond the pad's ink edge at the sides and front.
        expect(shoe.vHalf - 1.4).toBeGreaterThanOrEqual(pad.vHalf + 0.1 - 1e-9);
        expect(shoe.u1 - 1.4).toBeGreaterThanOrEqual(pad.u1 + 0.1 - 1e-9);
        // At the back the pad starts 1.4 behind the Shoe's fill edge: the Sock shows above the Shoe.
        expect(shoe.u0 + 1.4 - pad.u0).toBeCloseTo(1.4, 9);
      }
    }
  });

  it('keeps pad and Shoe clear of the eyes, lashes and gill-root zone on every look and swim phase', () => {
    expect(
      failingBodyLooks((look) =>
        SWIM_SAMPLES.every((swim) =>
          legSlotFrames(look, swim).every((frame) =>
            [sockFootPad(frame), shoeRect(frame)].every((rect) => {
              const b = legRectBounds(frame, rect);
              return clearOfEyesAndGills(b) && clearOfLashReach(b);
            }),
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the Feet envelope off the eyes and lashes, and no more than 1 unit into the gill-root zone (behind the silhouette)', () => {
    // The envelope is a plain box, so its square corner can touch the zone's lower edge on a Baby Slim Boy's
    // far-front leg (built: 0.72 deep; #88, 0.79 before). No Shoe reaches the corner (radius 8), and every leg layer is behind
    // the silhouette, so no root is covered.
    const depth = (b: Bounds): number =>
      Math.max(
        0,
        Math.min(
          Math.min(b.maxX, GILL_ROOT_ZONE.maxX) - Math.max(b.minX, GILL_ROOT_ZONE.minX),
          Math.min(b.maxY, GILL_ROOT_ZONE.maxY) - Math.max(b.minY, GILL_ROOT_ZONE.minY),
        ),
      );
    expect(
      failingBodyLooks((look) =>
        SWIM_SAMPLES.every((swim) =>
          legSlotFrames(look, swim).every((frame) => {
            const b = legRectBounds(frame, feetEnvelope(frame));
            return (
              boxCircleGap(b, NEAR_EYE_ZONE) >= 0 &&
              boxCircleGap(b, FAR_EYE_ZONE) >= 0 &&
              clearOfLashReach(b) &&
              depth(b) <= 1 &&
              legWearableLayer(frame.index) < SILHOUETTE_LAYER
            );
          }),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the Sock sleeve off the eyes and lashes; it paints behind the silhouette, so it covers nothing', () => {
    expect(
      failingBodyLooks((look) =>
        SWIM_SAMPLES.every((swim) =>
          legSlotFrames(look, swim).every((frame) => {
            const b = sockSleeveBounds(frame);
            return (
              boxCircleGap(b, NEAR_EYE_ZONE) >= 0 &&
              boxCircleGap(b, FAR_EYE_ZONE) >= 0 &&
              clearOfLashReach(b) &&
              legWearableLayer(frame.index) < SILHOUETTE_LAYER
            );
          }),
        ),
      ),
    ).toEqual([]);
  });

  it('measures the Feet envelope lowest at y 58.87 (#88: 58.06 before) and x -62.6 to 47.2, in the frame with 4 or more units of padding', () => {
    const inner = frameInner(FRAME_PAD);
    const boxes: Bounds[] = [];
    for (const look of EVERY_BODY_LOOK) {
      for (const swim of SWIM_SAMPLES) {
        for (const frame of legSlotFrames(look, swim)) {
          for (const rect of [sockFootPad(frame), shoeRect(frame), feetEnvelope(frame)]) {
            boxes.push(legRectBounds(frame, rect));
          }
          boxes.push(sockSleeveBounds(frame));
        }
      }
    }
    const all = unionBounds(boxes);
    expectInside(all, inner);
    // Sampled swim phases, so a hair under the continuous lowest ink.
    expect(all.maxY).toBeLessThanOrEqual(58.88);
    expect(all.maxY).toBeGreaterThan(58.7);
    expect(all.minX).toBeCloseTo(-62.57, 1);
    expect(all.maxX).toBeCloseTo(47.18, 1);
  });
});

describe('every Wearable slot over every look and size', () => {
  it('has footprints that do not depend on the size, which only scales the bake', () => {
    const byKey = new Map<string, unknown>();
    const snapshot = (look: AxolotlArtLook): unknown => ({
      shirt: shirtGeometry(look),
      back: backFootprint(look),
      tail: tailSlotFrame(axolotlBodyGeometry(look).tail, 1, 1),
      legs: legSlotFrames(look, 1).map((f) => [sockFootPad(f), shoeRect(f), feetEnvelope(f)]),
    });
    for (const look of EVERY_BODY_LOOK) {
      const key = [look.sex, look.tail, look.body, look.age].join('|');
      const snap = snapshot(look);
      if (!byKey.has(key)) byKey.set(key, snap);
      expect(snap).toEqual(byKey.get(key));
    }
    expect(byKey.size).toBe(54);
  });

  it('keeps every slot footprint out of both eye zones, the Girl lash reach and the gill-root zone, in the frame', () => {
    const inner = frameInner(FRAME_PAD);
    const faceExempt = new Set<WearableSlot>(['face']);
    const lashExempt = (slot: WearableSlot): boolean => faceExempt.has(slot);
    // Per-slot boxes for a look. Face is the glasses band, checked on its outline above. Feet is the Shoe
    // (the Feet envelope is checked in the Socks and Feet tests).
    const boxesOf = (look: AxolotlArtLook): [WearableSlot, Bounds][] => {
      const geo = axolotlBodyGeometry(look);
      const out: [WearableSlot, Bounds][] = [
        ['head', HEAD_FOOTPRINT],
        ['neck', NECK_FOOTPRINT],
        ['face', GLASSES_EXTENT],
        ['shirt', shirtGeometry(look).bounds],
        ['back', backFootprint(look).bounds],
      ];
      for (const swim of SWIM_SAMPLES) {
        for (const amp of TAIL_AMPS) out.push(['tail', tailSlotBounds(tailSlotFrame(geo.tail, swim, amp))]);
        for (const frame of legSlotFrames(look, swim)) {
          out.push(['socks', legRectBounds(frame, sockFootPad(frame))]);
          out.push(['feet', legRectBounds(frame, shoeRect(frame))]);
        }
      }
      return out;
    };
    const slotsSeen = new Set<WearableSlot>();
    expect(
      failingBodyLooks((look) =>
        boxesOf(look).every(([slot, b]) => {
          slotsSeen.add(slot);
          const eyes = slot === 'face' || clearOfEyesAndGills(b);
          const lashes = lashExempt(slot) || clearOfLashReach(b);
          return eyes && lashes && isInside(b, inner);
        }),
      ),
    ).toEqual([]);
    expect([...slotsSeen].sort()).toEqual([...WEARABLE_SLOTS].sort());
    // Face has no box check; its band is checked against the eye zones on its outline, and the gill-root zone by x.
    expect(GLASSES_EXTENT.minX).toBeGreaterThan(GILL_ROOT_ZONE.maxX);
  });

  it('measures Head to y -44 and x 46, Back y -37.9, and the lowest ink 4 or more units inside the frame', () => {
    const inner = frameInner(FRAME_PAD);
    const backTop = Math.min(...EVERY_BODY_LOOK.map((look) => backFootprint(look).bounds.minY));
    expect(backTop).toBeCloseTo(-37.86, 2);
    expect(backTop).toBeGreaterThanOrEqual(inner.minY);
    expect(HEAD_FOOTPRINT.minY).toBe(-44);
    expect(HEAD_FOOTPRINT.minY).toBeGreaterThanOrEqual(inner.minY);
    expect(HEAD_FOOTPRINT.maxX).toBeLessThanOrEqual(inner.maxX);
    expect(AXO_TEX.h - AXO_TEX.originY - 58.87).toBeCloseTo(4.13, 2);
  });
});
