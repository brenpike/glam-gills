import { describe, expect, it } from 'vitest';
import { markPoint } from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  EYE_ZONE_MARGIN,
  FAR_EYE,
  HEAD_ELLIPSE,
  MOUTH_VARIANTS,
  NEAR_EYE,
  SPOT_SETS,
  axolotlBodyGeometry,
  mouthInkBounds,
  spotMarks,
  tailSamples,
  unionBounds,
  type AxolotlArtLook,
  type BodyEllipse,
  type TailSample,
} from './drawAxolotlParts';
import { MORPH_LOOK_IDS } from './drawMorphs';
import {
  BLUSH,
  CHEEK_HEART,
  DREAM_SLOTS,
  INK,
  MORPH_PALETTES,
  T_STATIC,
  WHITE,
  type MorphLookId,
  type MorphMark,
  type MorphPalette,
} from './palette';

const TAU = Math.PI * 2;
const SWIM_SAMPLES = Array.from({ length: 37 }, (_, i) => (i / 36) * TAU);
const TAIL_AMPS = [1, 1.6] as const;
/** Eight morphs x 54 body looks x swim samples x tail amplitudes; give it room when the suite runs in parallel. */
const ENUMERATION_TIMEOUT_MS = 30_000;
/**
 * Marks stay this far inside the silhouette edge: guide 6h for the bodies
 * that pass alone, and the 2 px rim width on Wild, Axanthic and Melanoid, so
 * no mark covers the rim (the edge partner, guide 10).
 */
const INSET = 2;
/** Points checked round each mark circle. */
const CIRCLE_STEPS = 96;
/** Body marks at prototype x 0 or more keep their x (torsoPoint), so they sit where torso and head overlap. */
const HEAD_SIDE_MARKS: readonly string[] = ['copper (2, -9)', 'piebald (8, -8)'];

/** Every Boy or girl, Tail, Body and Age look; the face, gills, spots and size never move a morph mark. */
function everyBodyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const sex of AXO_SEXES)
    for (const tail of AXO_TAILS)
      for (const body of AXO_BODIES)
        for (const age of AXO_AGES) looks.push({ ...DEFAULT_ART_LOOK, sex, tail, body, age });
  return looks;
}
const EVERY_BODY_LOOK = everyBodyLook();

/** Every mark of a palette: speckles, flecks and shimmer. */
function marksOf(palette: MorphPalette): MorphMark[] {
  const extras = palette.extras;
  return [...(extras?.speckles?.marks ?? []), ...(extras?.flecks?.marks ?? []), ...(extras?.shimmer?.marks ?? [])];
}

function markName(id: MorphLookId, m: MorphMark): string {
  return m.space === 'body' ? `${id} (${m.x}, ${m.y})` : `${id} tail t ${m.t}`;
}

function lookName(look: AxolotlArtLook): string {
  return [look.sex, look.tail, look.body, look.age].join(' ');
}

/** Points round the circle (x, y, r). */
function circlePoints(x: number, y: number, r: number): [number, number][] {
  return Array.from({ length: CIRCLE_STEPS }, (_, i): [number, number] => {
    const a = (i / CIRCLE_STEPS) * TAU;
    return [x + r * Math.cos(a), y + r * Math.sin(a)];
  });
}

function isInEllipse(px: number, py: number, e: BodyEllipse): boolean {
  return ((px - e.cx) / e.rx) ** 2 + ((py - e.cy) / e.ry) ** 2 <= 1 + 1e-9;
}

/** Whether the painted tail core holds (px, py): the core edges join the tail samples with straight lines, as painted. */
function isOnTailCore(tail: readonly TailSample[], px: number, py: number): boolean {
  for (let i = 0; i < tail.length - 1; i++) {
    const a = tail[i];
    const b = tail[i + 1];
    if (px > a.x || px < b.x) continue;
    const u = (a.x - px) / (a.x - b.x);
    const cy = a.cy + (b.cy - a.cy) * u;
    const hc = a.hc + (b.hc - a.hc) * u;
    return Math.abs(py - cy) <= hc + 1e-9;
  }
  return false;
}

const EYE_ZONES = [NEAR_EYE, FAR_EYE].map((eye) => ({ x: eye.x, y: eye.y, r: eye.r + EYE_ZONE_MARGIN }));
/** Guide 6i mouth zone: the ink of every mouth plus 1 unit. */
const MOUTH_ZONE = unionBounds(MOUTH_VARIANTS.map(mouthInkBounds));

/** Whether the circle (x, y, r) stays out of both eye zones and the mouth zone. */
function isClearOfFace(x: number, y: number, r: number): boolean {
  const clearOfEyes = EYE_ZONES.every((zone) => Math.hypot(x - zone.x, y - zone.y) >= zone.r + r);
  const dx = Math.max(MOUTH_ZONE.minX - 1 - x, 0, x - MOUTH_ZONE.maxX - 1);
  const dy = Math.max(MOUTH_ZONE.minY - 1 - y, 0, y - MOUTH_ZONE.maxY - 1);
  return clearOfEyes && Math.hypot(dx, dy) >= r;
}

/** Failures of one body mark on one look: it must sit on the silhouette, inset, off the face; behind x 0 on the look's torso. */
function bodyMarkFailures(m: MorphMark & { space: 'body' }, look: AxolotlArtLook, tail: readonly TailSample[]): string[] {
  const torso = axolotlBodyGeometry(look).torso;
  const [x, y] = markPoint(m, tail, torso);
  const ring = circlePoints(x, y, m.r + INSET);
  const failures: string[] = [];
  if (!ring.every(([px, py]) => isInEllipse(px, py, torso) || isInEllipse(px, py, HEAD_ELLIPSE))) {
    failures.push('outside the silhouette inset');
  }
  if (m.x < 0 && !ring.every(([px, py]) => isInEllipse(px, py, torso))) failures.push("outside the look's torso");
  if (!isClearOfFace(x, y, m.r)) failures.push('on the face');
  return failures;
}

/** Failures of every mark of one morph on one look, at every sampled swim phase and tail amplitude. */
function lookFailures(id: MorphLookId, look: AxolotlArtLook): string[] {
  const geo = axolotlBodyGeometry(look);
  const failures: string[] = [];
  const marks = marksOf(MORPH_PALETTES[id]);
  for (const swim of SWIM_SAMPLES) {
    for (const amp of TAIL_AMPS) {
      const tail = tailSamples(geo.tail, swim, amp);
      for (const m of marks) {
        const where = `${markName(id, m)} on ${lookName(look)} swim ${swim.toFixed(2)} amp ${amp}`;
        if (m.space === 'body') {
          for (const failure of bodyMarkFailures(m, look, tail)) failures.push(`${where}: ${failure}`);
          continue;
        }
        const [x, y] = markPoint(m, tail, geo.torso);
        if (!circlePoints(x, y, m.r).every(([px, py]) => isOnTailCore(tail, px, py))) {
          failures.push(`${where}: off the tail core`);
        }
      }
    }
  }
  return failures;
}

describe('morph marks on every look (guide 3b, 6g, 6h)', () => {
  it('enumerates the eight morphs on every Boy or girl, Tail, Body and Age', () => {
    expect(MORPH_LOOK_IDS).toHaveLength(8);
    expect(EVERY_BODY_LOOK).toHaveLength(2 * 3 * 3 * 3);
  });

  it('keeps every mark 2 inside the silhouette and off the face, body marks on the torso, tail marks on the core', () => {
    const failures = MORPH_LOOK_IDS.flatMap((id) => EVERY_BODY_LOOK.flatMap((look) => lookFailures(id, look)));
    expect(failures).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('puts only the guide 3b head-side marks at x 0 or more', () => {
    const headSide = MORPH_LOOK_IDS.flatMap((id) =>
      marksOf(MORPH_PALETTES[id]).flatMap((m) => (m.space === 'body' && m.x >= 0 ? [markName(id, m)] : [])),
    );
    expect(headSide).toEqual(HEAD_SIDE_MARKS);
  });
});

/** The Freckles cluster box (PRD F1, guide 6n): Freckles fill one, no morph crowds one. */
const CLUSTER_BOX = { w: 15, h: 9 } as const;
/** Most morph marks in one cluster box on the default look: Wild's speckles, flecks and a tail speckle reach 4. */
const MORPH_MOST_IN_BOX = 4;
/** Float slack for products of decimal radii (1.75 x 1.6 is 2.8000000000000003). */
const RADIUS_SLACK = 1e-9;

/** Most points inside any w x h box (a fullest box can always slide to touch a point on its left and its top edge). */
function mostInBox(points: readonly (readonly [number, number])[], w: number, h: number): number {
  let most = 0;
  for (const [left] of points) {
    for (const [, top] of points) {
      const inBox = points.filter(([x, y]) => x >= left && x <= left + w && y >= top && y <= top + h).length;
      most = Math.max(most, inBox);
    }
  }
  return most;
}

/** Largest radius among the speckles and flecks of the given morphs (Piebald patches are its speckles). */
function largestSpeckleRadius(ids: readonly MorphLookId[]): number {
  const radii = ids.flatMap((id) => {
    const extras = MORPH_PALETTES[id].extras;
    return [...(extras?.speckles?.marks ?? []), ...(extras?.flecks?.marks ?? [])].map((m) => m.r);
  });
  return Math.max(...radii);
}

describe('player spots never look like morph marks (PRD F1, guide 3b, 6n)', () => {
  const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);

  it('Freckles put 9 or more specks in one 15 x 9 box, where no morph puts more than 4 marks', () => {
    const crowded: string[] = [];
    for (const id of MORPH_LOOK_IDS) {
      for (const swim of SWIM_SAMPLES) {
        for (const amp of TAIL_AMPS) {
          const tail = tailSamples(geo.tail, swim, amp);
          const points = marksOf(MORPH_PALETTES[id]).map((m) => markPoint(m, tail, geo.torso));
          const most = mostInBox(points, CLUSTER_BOX.w, CLUSTER_BOX.h);
          if (most > MORPH_MOST_IN_BOX) crowded.push(`${id} swim ${swim.toFixed(2)} amp ${amp}: ${most}`);
        }
      }
    }
    expect(crowded).toEqual([]);
    const freckles = spotMarks('freckles', (TAU * T_STATIC) / 1.2, 1, geo.tail, geo.torso);
    const specks = freckles.map((m): [number, number] => [m.x, m.y]);
    expect(mostInBox(specks, CLUSTER_BOX.w, CLUSTER_BOX.h)).toBeGreaterThanOrEqual(9);
  });

  it('Dots are 1.75 times or more the radius of the largest Wild or Copper speckle or fleck', () => {
    const largest = largestSpeckleRadius(['wild', 'copper']);
    expect(largest).toBe(1.6);
    const dots = [...SPOT_SETS.dots.body, ...SPOT_SETS.dots.tail];
    for (const m of dots) expect(Math.min(m.rx, m.ry)).toBeGreaterThanOrEqual(1.75 * largest - RADIUS_SLACK);
  });

  it('Patches are each twice the area of the largest Piebald patch or more', () => {
    const largest = largestSpeckleRadius(['piebald']);
    expect(largest).toBe(4.2);
    const patches = [...SPOT_SETS.patches.body, ...SPOT_SETS.patches.tail];
    for (const m of patches) expect(Math.PI * m.rx * m.ry).toBeGreaterThanOrEqual(2 * Math.PI * largest * largest);
  });
});

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const channel = (offset: number): number => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Guide 10 cue floor: 3:1. */
const CUE_RATIO = 3;

/** Guide 6u and 10 lash contrast rows: white under-stroke vs body, ink vs body. */
const LASH_CONTRAST: Readonly<Record<MorphLookId, readonly [number, number]>> = {
  leucistic: [1.62, 8.86],
  wild: [2.12, 6.8],
  'golden-albino': [1.42, 10.13],
  'white-albino': [1.08, 13.38],
  copper: [1.56, 9.24],
  piebald: [1.13, 12.75],
  axanthic: [4.53, 3.18],
  melanoid: [8.28, 1.74],
};

describe('girl eyelashes on every morph (guide 6u, 10)', () => {
  it('draw the ink over a white under-stroke at 14.39:1', () => {
    expect(contrastRatio(INK, WHITE)).toBeCloseTo(14.39, 2);
  });

  it('match the guide numbers for every morph', () => {
    for (const id of MORPH_LOOK_IDS) {
      const body = MORPH_PALETTES[id].body;
      const [white, ink] = LASH_CONTRAST[id];
      expect(contrastRatio(WHITE, body), `${id} white vs body`).toBeCloseTo(white, 2);
      expect(contrastRatio(INK, body), `${id} ink vs body`).toBeCloseTo(ink, 2);
    }
  });

  it('read on every body: the white edge carries the lash wherever the ink is under 3:1', () => {
    for (const id of MORPH_LOOK_IDS) {
      const body = MORPH_PALETTES[id].body;
      const white = contrastRatio(WHITE, body);
      const ink = contrastRatio(INK, body);
      expect(Math.max(white, ink), id).toBeGreaterThanOrEqual(CUE_RATIO);
      if (ink < CUE_RATIO) expect(white, id).toBeGreaterThanOrEqual(CUE_RATIO);
    }
  });
});

/** Every body the cheek heart sits on: the eight morphs, then the eighteen Dream colours (guide 3b, 3f). */
const HEART_BODIES: readonly (readonly [string, string])[] = [
  ...MORPH_LOOK_IDS.map((id): [string, string] => [id, MORPH_PALETTES[id].body]),
  ...Object.entries(DREAM_SLOTS).map(([id, slots]): [string, string] => [`dream ${id}`, slots.body]),
];

/**
 * Guide 6u and 10 cheek heart rows: white edge vs body, ink vs body, fill vs body. Rainbow #ff6b6b is
 * about as light as the fill (1.04:1) and the Hearts Dream pattern #ff5f8d (x 14 or less) matches it,
 * so the outline carries the heart there.
 */
const CHEEK_HEART_CONTRAST: Readonly<Record<string, readonly [number, number, number]>> = {
  leucistic: [1.62, 8.86, 1.78],
  wild: [2.12, 6.8, 1.37],
  'golden-albino': [1.42, 10.13, 2.04],
  'white-albino': [1.08, 13.38, 2.69],
  copper: [1.56, 9.24, 1.86],
  piebald: [1.13, 12.75, 2.57],
  axanthic: [4.53, 3.18, 1.56],
  melanoid: [8.28, 1.74, 2.86],
  'dream mint': [1.31, 10.99, 2.21],
  'dream sky-blue': [1.53, 9.42, 1.9],
  'dream lavender': [1.58, 9.11, 1.83],
  'dream sunset-orange': [1.58, 9.1, 1.83],
  'dream bubblegum': [1.58, 9.11, 1.83],
  'dream midnight-blue': [9.89, 1.45, 3.42],
  'dream hearts': [1.14, 12.59, 2.53],
  'dream tie-dye': [1.2, 11.98, 2.41],
  'dream iridescent': [1.5, 9.58, 1.93],
  'dream rainbow': [2.78, 5.19, 1.04],
  'dream galaxy': [11.73, 1.23, 4.05],
  'dream tie-dye-galaxy': [11.24, 1.28, 3.88],
  'dream lily-green': [1.23, 11.67, 2.35],
  'dream firefly-gold': [1.42, 10.15, 2.04],
  'dream poppy-red': [4.03, 3.57, 1.39],
  'dream plum': [6.23, 2.31, 2.15],
  'dream moonstone': [1.07, 13.43, 2.7],
  'dream chocolate': [9.37, 1.54, 3.24],
};

/** An rgba(r,g,b,a) colour laid over an opaque #rrggbb colour, as #rrggbb. */
function laidOver(rgba: string, under: string): string {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(rgba);
  expect(match, rgba).not.toBeNull();
  const [r, g, b, a] = match!.slice(1).map(Number);
  const channel = (top: number, offset: number): string =>
    Math.round(a * top + (1 - a) * parseInt(under.slice(offset, offset + 2), 16))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r, 1)}${channel(g, 3)}${channel(b, 5)}`;
}

describe('girl cheek heart on every body (guide 6u, 10)', () => {
  it('lists the eight morphs and the eighteen Dream colours', () => {
    expect(HEART_BODIES).toHaveLength(26);
    expect(Object.keys(CHEEK_HEART_CONTRAST)).toEqual(HEART_BODIES.map(([id]) => id));
  });

  it('fills #ff5c9a, 4.97:1 against its ink outline', () => {
    expect(CHEEK_HEART).toBe('#ff5c9a');
    expect(contrastRatio(CHEEK_HEART, INK)).toBeCloseTo(4.97, 2);
    expect(contrastRatio(CHEEK_HEART, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
  });

  it('match the guide numbers for every body', () => {
    for (const [id, body] of HEART_BODIES) {
      const [white, ink, fill] = CHEEK_HEART_CONTRAST[id];
      expect(contrastRatio(WHITE, body), `${id} white vs body`).toBeCloseTo(white, 2);
      expect(contrastRatio(INK, body), `${id} ink vs body`).toBeCloseTo(ink, 2);
      expect(contrastRatio(CHEEK_HEART, body), `${id} fill vs body`).toBeCloseTo(fill, 2);
    }
  });

  it('read on every body: the white edge or the ink gets 3:1 or more', () => {
    for (const [id, body] of HEART_BODIES) {
      expect(Math.max(contrastRatio(WHITE, body), contrastRatio(INK, body)), id).toBeGreaterThanOrEqual(CUE_RATIO);
    }
  });

  it('read stronger than the blush on every body: opaque, and further from the body than the blush laid over it', () => {
    expect(CHEEK_HEART).toMatch(/^#[0-9a-f]{6}$/i);
    for (const [id, body] of HEART_BODIES) {
      expect(contrastRatio(CHEEK_HEART, body), id).toBeGreaterThan(contrastRatio(laidOver(BLUSH, body), body));
    }
  });
});
