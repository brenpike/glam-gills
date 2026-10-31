import { afterEach, describe, expect, it, vi } from 'vitest';
import { AXO_REST_POSE, drawAxolotl } from './drawAxolotl';
import {
  AXO_AGES,
  AXO_BODIES,
  AXO_SEXES,
  AXO_TAILS,
  DEFAULT_ART_LOOK,
  HEAD_ELLIPSE,
  axolotlBodyGeometry,
  tailSamples,
  type AxolotlArtLook,
  type BodyEllipse,
  type TailSample,
} from './drawAxolotlParts';
import {
  DREAM_FACE_LIMIT_X,
  DREAM_INSET_IDS,
  DREAM_MARKER_INK,
  DREAM_PATTERN_INSET,
  IRIDESCENT_GLIDE_S,
  IRIDESCENT_STILL_X,
  dreamClipPolygons,
  dreamMarkerCentres,
  dreamPatternShapes,
  dreamSheenAt,
  iridescentStripeX,
  isSheenDream,
  type DreamPolygon,
  type DreamShape,
} from './drawDreamOverlay';
import { MORPH_LOOK_IDS } from './drawMorphs';
import {
  DREAM_EYE_RING,
  DREAM_RIM_LIGHT,
  DREAM_SLOTS,
  INK,
  MORPH_PALETTES,
  WHITE,
  axolotlPalette,
  dreamPalette,
  type DreamLookId,
  type MorphPalette,
} from './palette';
import { DREAM_SWATCH } from './treasurePalette';

const TAU = Math.PI * 2;
const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];
const SOLID_IDS: readonly DreamLookId[] = [
  'mint',
  'sky-blue',
  'lavender',
  'sunset-orange',
  'bubblegum',
  'midnight-blue',
  'lily-green',
  'firefly-gold',
  'poppy-red',
  'plum',
  'moonstone',
  'chocolate',
  'jade',
];
const DARK_IDS: readonly DreamLookId[] = ['midnight-blue', 'galaxy', 'tie-dye-galaxy', 'plum', 'chocolate', 'glowworm'];
const RIM_IDS: readonly DreamLookId[] = [
  'midnight-blue',
  'rainbow',
  'galaxy',
  'tie-dye-galaxy',
  'plum',
  'chocolate',
  'glowworm',
  'jade',
  'fiesta-shine',
];
const SWIM_SAMPLES = Array.from({ length: 13 }, (_, i) => (i / 12) * TAU);
const TAIL_AMPS = [1, 1.6] as const;
/** Guide 10 cue floor. */
const CUE_RATIO = 3;
/** Float slack on distances. */
const EPS = 1e-6;
/** Every Boy or girl, Tail, Body and Age look, plus swim samples and two amplitudes: give it room in a parallel run. */
const ENUMERATION_TIMEOUT_MS = 30_000;

function rgbOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** An rgba(r,g,b,a) mark laid over an opaque #rrggbb body, as #rrggbb. */
function laidOverBody(rgba: string, under: string): string {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(rgba);
  expect(match, rgba).not.toBeNull();
  const [r, g, b, a] = match!.slice(1).map(Number);
  const channel = (top: number, offset: number): string =>
    Math.round(a * top + (1 - a) * parseInt(under.slice(offset, offset + 2), 16))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r, 1)}${channel(g, 3)}${channel(b, 5)}`;
}

/** Channels of `from` mixed `t` of the way toward `to` in sRGB (guide 3f). */
function mixChannels(from: string, to: string, t: number): number[] {
  const a = rgbOf(from);
  const b = rgbOf(to);
  return a.map((v, i) => v + (b[i] - v) * t);
}

/** Linear-light sRGB channel (IEC 61966-2-1), as OKLab takes it. */
function linearChannel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** OKLab coordinates of a #rrggbb colour (Ottosson 2020, https://bottosson.github.io/posts/oklab/). */
function oklabOf(hex: string): [number, number, number] {
  const [r, g, b] = rgbOf(hex).map(linearChannel);
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Euclidean OKLab difference of two #rrggbb colours. */
function oklabDifference(a: string, b: string): number {
  const pa = oklabOf(a);
  const pb = oklabOf(b);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

function expectNear(hex: string, expected: number[], label: string): void {
  rgbOf(hex).forEach((v, i) => expect(Math.abs(v - expected[i]), `${label} channel ${i}`).toBeLessThanOrEqual(1));
}

function everyPair(): [string, DreamLookId, MorphPalette][] {
  return MORPH_LOOK_IDS.flatMap((morph) =>
    DREAM_IDS.map((id): [string, DreamLookId, MorphPalette] => [`${morph} + ${id}`, id, axolotlPalette(morph, id)]),
  );
}

describe('Dream colour slots (guide 3f)', () => {
  it('has the twenty-two Dream colours with the swatch body colours', () => {
    expect(DREAM_IDS).toHaveLength(22);
    expect(DREAM_IDS.slice(-10)).toEqual([
      'lily-green',
      'firefly-gold',
      'poppy-red',
      'plum',
      'moonstone',
      'chocolate',
      'crystal-shine',
      'glowworm',
      'jade',
      'fiesta-shine',
    ]);
    expect(DREAM_IDS).toEqual(Object.keys(DREAM_SWATCH));
    for (const id of DREAM_IDS) expect(DREAM_SLOTS[id].body, id).toBe(DREAM_SWATCH[id].body);
  });

  it('follows the 3f mixing rule within 1 per channel', () => {
    for (const id of DREAM_IDS) {
      const s = DREAM_SLOTS[id];
      expectNear(s.farSide, mixChannels(s.body, INK, 0.12), `${id} far side`);
      expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), `${id} fin`);
      expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), `${id} belly`);
      expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), `${id} near filament`);
      expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), `${id} far stem`);
      expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), `${id} far filament`);
    }
  });

  it('gives Lily green the 3f mixes of its two picks, a 9:1 body and a plain light swatch (issue #75)', () => {
    const s = DREAM_SLOTS['lily-green'];
    expect([s.body, s.gillNearStem]).toEqual(['#ddf274', '#4fb83a']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(9);
    expect(DREAM_SWATCH['lily-green']).toEqual({ body: '#ddf274', pattern: 'plain', marks: [], dark: false });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'lily-green').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('gives Firefly gold the 3f mixes of its two picks, a 9:1 body and a plain light swatch (issue #98)', () => {
    const s = DREAM_SLOTS['firefly-gold'];
    expect([s.body, s.gillNearStem]).toEqual(['#ffd52a', '#e08214']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    expect(contrastRatio(s.body, INK)).toBeCloseTo(10.15, 2);
    expect(Math.sqrt(contrastRatio(s.body, INK))).toBeCloseTo(3.19, 2);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(12.28, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.69, 2);
    expect(DREAM_SWATCH['firefly-gold']).toEqual({ body: '#ffd52a', pattern: 'plain', marks: [], dark: false });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'firefly-gold').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('keeps Firefly gold apart from every other Dream colour in greyscale and in colour (PRD F15)', () => {
    const body = DREAM_SLOTS['firefly-gold'].body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'firefly-gold').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [1.08, 0.166],
      'sky-blue': [1.08, 0.244],
      lavender: [1.11, 0.25],
      'sunset-orange': [1.12, 0.109],
      bubblegum: [1.11, 0.225],
      'midnight-blue': [6.97, 0.582],
      hearts: [1.24, 0.116],
      'tie-dye': [1.18, 0.102],
      iridescent: [1.06, 0.24],
      rainbow: [1.96, 0.268],
      galaxy: [8.27, 0.611],
      'tie-dye-galaxy': [7.93, 0.598],
      'lily-green': [1.15, 0.079],
      'poppy-red': [2.84, 0.333],
      plum: [4.39, 0.473],
      moonstone: [1.32, 0.202],
      chocolate: [6.61, 0.498],
      'crystal-shine': [2.38, 0.333],
      glowworm: [11.3, 0.684],
      jade: [1.48, 0.236],
      'fiesta-shine': [1.69, 0.317],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
  });

  it('gives Poppy red the 3f mixes of its two picks, a body over the 0.2 spot line, 3:1 cue floor and a plain swatch (issue #76)', () => {
    const s = DREAM_SLOTS['poppy-red'];
    expect([s.body, s.gillNearStem]).toEqual(['#e8402f', '#ffb02e']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // Guide 10 cue floor: the ink and the white edge both reach 3:1 or more against the body.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(3.57, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(4.03, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(4.32, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.21, 2);
    expect(DREAM_SWATCH['poppy-red']).toEqual({ body: '#e8402f', pattern: 'plain', marks: [], dark: false });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'poppy-red').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('keeps Poppy red apart from every other Dream colour in greyscale and in colour (PRD F15)', () => {
    const body = DREAM_SLOTS['poppy-red'].body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'poppy-red').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [3.08, 0.391],
      'sky-blue': [2.64, 0.367],
      lavender: [2.55, 0.327],
      'sunset-orange': [2.55, 0.272],
      bubblegum: [2.55, 0.29],
      'midnight-blue': [2.45, 0.375],
      hearts: [3.53, 0.384],
      'tie-dye': [3.36, 0.367],
      iridescent: [2.68, 0.338],
      rainbow: [1.45, 0.099],
      galaxy: [2.91, 0.39],
      'tie-dye-galaxy': [2.79, 0.37],
      'lily-green': [3.27, 0.393],
      'firefly-gold': [2.84, 0.333],
      plum: [1.54, 0.221],
      moonstone: [3.76, 0.415],
      chocolate: [2.32, 0.252],
      'crystal-shine': [1.19, 0.299],
      glowworm: [3.97, 0.454],
      jade: [1.93, 0.344],
      'fiesta-shine': [1.69, 0.201],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    // Crystal shine (Area 6) is now the closest pair, and it also carries its sheen stripes; Rainbow is next, with its bands and rim light.
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0]).map(([id]) => id);
    expect(closest.slice(0, 2)).toEqual(['crystal-shine', 'rainbow']);
  });

  it('gives Plum the 3f mixes of its two picks, a dark body under the 0.2 spot line, the white edge over 3:1 and a dark plain swatch (issue #118, ND-11)', () => {
    const s = DREAM_SLOTS.plum;
    expect([s.body, s.gillNearStem]).toEqual(['#933f93', '#f2a0ee']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // Guide 10 cue floor: a dark body, so the white edge reaches 3:1 or more and the ink does not.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(2.31, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(6.23, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    // The morph eye bead is under 3:1 on the body, so the Dream eye ring carries it.
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(2.8, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(3.27, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.12, 2);
    expect(DREAM_SWATCH.plum).toEqual({ body: '#933f93', pattern: 'plain', marks: [], dark: true });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'plum').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Plum apart from every other Dream colour in greyscale and in colour, Poppy red and Midnight blue most of all (PRD F15)', () => {
    const body = DREAM_SLOTS.plum.body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'plum').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [4.75, 0.455],
      'sky-blue': [4.07, 0.386],
      lavender: [3.94, 0.358],
      'sunset-orange': [3.93, 0.392],
      bubblegum: [3.94, 0.358],
      'midnight-blue': [1.59, 0.181],
      hearts: [5.45, 0.49],
      'tie-dye': [5.18, 0.477],
      iridescent: [4.14, 0.374],
      rainbow: [2.24, 0.255],
      galaxy: [1.88, 0.205],
      'tie-dye-galaxy': [1.81, 0.182],
      'lily-green': [5.05, 0.506],
      'firefly-gold': [4.39, 0.473],
      'poppy-red': [1.54, 0.221],
      moonstone: [5.81, 0.489],
      chocolate: [1.51, 0.195],
      'crystal-shine': [1.84, 0.257],
      glowworm: [2.57, 0.289],
      jade: [2.97, 0.364],
      'fiesta-shine': [2.6, 0.251],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(grey, `${id} greyscale margin`).toBeGreaterThanOrEqual(1.5);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    // Plum is a deep body between Midnight blue and Rainbow in value. Chocolate (issue #105), darker still, is now the
    // closest in greyscale, held to the same 1.5:1 margin; Poppy red is next.
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0]).map(([id]) => id);
    expect(closest.slice(0, 2)).toEqual(['chocolate', 'poppy-red']);
  });

  it('gives Moonstone the 3f mixes of its two picks, the lightest body, a 9:1 body and a plain light swatch (issue #77, ND-12)', () => {
    const s = DREAM_SLOTS.moonstone;
    expect([s.body, s.gillNearStem]).toEqual(['#f5f7fc', '#7f9fdc']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // Guide 10 light-body rule: the body is 9:1 or more with ink, so its worst case on any background is 3:1 or more.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(13.43, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(9);
    expect(Math.sqrt(contrastRatio(s.body, INK))).toBeCloseTo(3.66, 2);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(16.26, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(2.48, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.93, 2);
    for (const id of DREAM_IDS.filter((other) => other !== 'moonstone')) {
      expect(relativeLuminance(s.body), id).toBeGreaterThan(relativeLuminance(DREAM_SLOTS[id].body));
    }
    expect(DREAM_SWATCH.moonstone).toEqual({ body: '#f5f7fc', pattern: 'plain', marks: [], dark: false });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'moonstone').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('keeps Moonstone apart from every other Dream colour in greyscale and in colour, Hearts most of all (PRD F15)', () => {
    const body = DREAM_SLOTS.moonstone.body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'moonstone').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [1.22, 0.117],
      'sky-blue': [1.43, 0.14],
      lavender: [1.47, 0.141],
      'sunset-orange': [1.48, 0.159],
      bubblegum: [1.47, 0.148],
      'midnight-blue': [9.23, 0.599],
      hearts: [1.07, 0.089],
      'tie-dye': [1.12, 0.101],
      iridescent: [1.4, 0.123],
      rainbow: [2.59, 0.322],
      galaxy: [10.94, 0.637],
      'tie-dye-galaxy': [10.49, 0.625],
      'lily-green': [1.15, 0.169],
      'firefly-gold': [1.32, 0.202],
      'poppy-red': [3.76, 0.415],
      plum: [5.81, 0.489],
      chocolate: [8.74, 0.579],
      'crystal-shine': [3.16, 0.36],
      glowworm: [14.96, 0.726],
      jade: [1.95, 0.258],
      'fiesta-shine': [2.23, 0.289],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0])[0][0];
    expect(closest).toBe('hearts');
  });

  it('gives Chocolate the 3f mixes of its two picks, a dark body under the 0.2 spot line, the white edge over 3:1 and a dark plain swatch (issue #105, ND-13)', () => {
    const s = DREAM_SLOTS.chocolate;
    expect([s.body, s.gillNearStem]).toEqual(['#6c391d', '#ffa6c9']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // Guide 10 cue floor: a dark body, so the white edge reaches 3:1 or more and the ink does not (the rim light carries the outline).
    expect(contrastRatio(s.body, INK)).toBeCloseTo(1.54, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(9.37, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    // The morph eye bead is under 3:1 on the body, so the Dream eye ring carries it.
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(1.86, 2);
    expect(contrastRatio(s.body, DREAM_EYE_RING.colour)).toBeCloseTo(5.91, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(5.15, 2);
    // Mid-dark in greyscale: darker than Plum, lighter than Midnight blue.
    expect(relativeLuminance(s.body)).toBeCloseTo(0.062, 3);
    expect(relativeLuminance(s.body)).toBeLessThan(relativeLuminance(DREAM_SLOTS.plum.body));
    expect(relativeLuminance(s.body)).toBeGreaterThan(relativeLuminance(DREAM_SLOTS['midnight-blue'].body));
    expect(DREAM_SWATCH.chocolate).toEqual({ body: '#6c391d', pattern: 'plain', marks: [], dark: true });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'chocolate').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Chocolate apart from every other Dream colour in greyscale and in colour, Plum by 1.5:1 and Midnight blue by hue (PRD F15)', () => {
    const body = DREAM_SLOTS.chocolate.body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'chocolate').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [7.15, 0.515],
      'sky-blue': [6.13, 0.481],
      lavender: [5.93, 0.473],
      'sunset-orange': [5.92, 0.453],
      bubblegum: [5.93, 0.469],
      'midnight-blue': [1.06, 0.207],
      hearts: [8.2, 0.553],
      'tie-dye': [7.8, 0.537],
      iridescent: [6.24, 0.485],
      rainbow: [3.38, 0.328],
      galaxy: [1.25, 0.199],
      'tie-dye-galaxy': [1.2, 0.186],
      'lily-green': [7.6, 0.537],
      'firefly-gold': [6.61, 0.498],
      'poppy-red': [2.32, 0.252],
      plum: [1.51, 0.195],
      moonstone: [8.74, 0.579],
      'crystal-shine': [2.77, 0.281],
      glowworm: [1.71, 0.226],
      jade: [4.48, 0.395],
      'fiesta-shine': [3.92, 0.387],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    // Plum's own 1.5:1 greyscale margin holds for Chocolate; Midnight blue is the closest in value and is told apart by hue.
    expect(separation.plum[0]).toBeGreaterThanOrEqual(1.5);
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0])[0][0];
    expect(closest).toBe('midnight-blue');
  });

  it('gives Crystal shine the 3f mixes of its two picks, a teal body over the 0.2 spot line, both 3:1 cue edges, a sheen swatch and no rim light (Area 6 Legendary)', () => {
    const s = DREAM_SLOTS['crystal-shine'];
    expect([s.body, s.gillNearStem]).toEqual(['#2f9a9a', '#6a3fd8']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // A mid body: the ink and the white edge both reach the 3:1 cue floor, as on Poppy red.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(4.26, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(3.38, 2);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(5.15, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(1.87, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.26, 3);
    expect(DREAM_SWATCH['crystal-shine']).toEqual({
      body: '#2f9a9a',
      pattern: 'stripes',
      marks: ['rgba(255,255,255,0.7)', 'rgba(150,250,245,0.75)'],
      dark: false,
    });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'crystal-shine').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('keeps Crystal shine apart from every other Dream colour, Iridescent (shared stripe cue) by 1.5:1 and Poppy red and Rainbow most closely in value (PRD F15)', () => {
    const body = DREAM_SLOTS['crystal-shine'].body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'crystal-shine').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [2.58, 0.275],
      'sky-blue': [2.21, 0.238],
      lavender: [2.14, 0.267],
      'sunset-orange': [2.14, 0.288],
      bubblegum: [2.14, 0.297],
      'midnight-blue': [2.93, 0.279],
      hearts: [2.96, 0.351],
      'tie-dye': [2.81, 0.34],
      iridescent: [2.25, 0.274],
      rainbow: [1.22, 0.287],
      galaxy: [3.47, 0.313],
      'tie-dye-galaxy': [3.33, 0.307],
      'lily-green': [2.74, 0.334],
      'firefly-gold': [2.38, 0.333],
      'poppy-red': [1.19, 0.299],
      plum: [1.84, 0.257],
      moonstone: [3.16, 0.36],
      chocolate: [2.77, 0.281],
      glowworm: [4.74, 0.39],
      jade: [1.62, 0.134],
      'fiesta-shine': [1.41, 0.3],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    // Iridescent also glides a stripe pair, so Crystal shine is held 1.5:1 from it in value.
    expect(separation.iridescent[0]).toBeGreaterThanOrEqual(1.5);
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0]).map(([id]) => id);
    expect(closest.slice(0, 2)).toEqual(['poppy-red', 'rainbow']);
  });

  it('keeps the Crystal shine stripes lighter than the body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p, 10)', () => {
    const [light, tint] = DREAM_SWATCH['crystal-shine'].marks;
    const body = DREAM_SWATCH['crystal-shine'].body;
    const bodyInk = contrastRatio(body, INK);
    for (const mark of [light, tint]) {
      const laid = laidOverBody(mark, body);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(bodyInk);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(CUE_RATIO);
    }
    expect(DREAM_INSET_IDS).not.toContain('crystal-shine');
  });

  it('gives Glowworm the 3f mixes of its two picks, a night-blue body under the 0.2 spot line, the white edge over 3:1 and a dark glow-dots swatch (Area 7 Legendary)', () => {
    const s = DREAM_SLOTS.glowworm;
    expect([s.body, s.gillNearStem]).toEqual(['#101c52', '#4fe3c1']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // Guide 10 cue floor: a dark body, so the white edge reaches 3:1 or more and the ink does not (the rim light carries the outline).
    expect(contrastRatio(s.body, INK)).toBeCloseTo(1.11, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(16.03, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    // The morph eye bead is under 3:1 on the body, so the Dream eye ring carries it.
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(1.09, 2);
    expect(contrastRatio(s.body, DREAM_EYE_RING.colour)).toBeCloseTo(10.11, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(9.99, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.0155, 4);
    // Darker than every other Dream colour.
    for (const id of DREAM_IDS.filter((other) => other !== 'glowworm')) {
      expect(relativeLuminance(s.body), id).toBeLessThan(relativeLuminance(DREAM_SLOTS[id].body));
    }
    expect(DREAM_SWATCH.glowworm).toEqual({
      body: '#101c52',
      pattern: 'glow-dots',
      marks: ['#5ff2d2', 'rgba(95,242,210,0.3)'],
      dark: true,
    });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'glowworm').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Glowworm apart from every other Dream colour in greyscale and in colour, Galaxy most closely (PRD F15)', () => {
    const body = DREAM_SLOTS.glowworm.body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'glowworm').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [12.24, 0.659],
      'sky-blue': [10.49, 0.603],
      lavender: [10.15, 0.603],
      'sunset-orange': [10.13, 0.63],
      bubblegum: [10.15, 0.618],
      'midnight-blue': [1.62, 0.143],
      hearts: [14.02, 0.719],
      'tie-dye': [13.34, 0.706],
      iridescent: [10.66, 0.617],
      rainbow: [5.78, 0.515],
      galaxy: [1.37, 0.099],
      'tie-dye-galaxy': [1.43, 0.114],
      'lily-green': [13, 0.708],
      'firefly-gold': [11.3, 0.684],
      'poppy-red': [3.97, 0.454],
      plum: [2.57, 0.289],
      moonstone: [14.96, 0.726],
      chocolate: [1.71, 0.226],
      'crystal-shine': [4.74, 0.39],
      jade: [7.66, 0.523],
      'fiesta-shine': [6.7, 0.533],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    // Galaxy is the closest body; Glowworm's own cue is round glow dots, Galaxy's is stars.
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0])[0][0];
    expect(closest).toBe('galaxy');
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const tail = tailSamples(geo.tail, 0, 1);
    const kinds = (id: DreamLookId): string[] => [
      ...new Set(dreamPatternShapes(id, geo.torso, tail, undefined).map((shape) => shape.kind)),
    ];
    expect(kinds('glowworm')).toEqual(['dot']);
    expect(kinds('galaxy')).toContain('star');
  });

  it('gives Jade the 3f mixes of its two picks, a deep blue-green body over the 0.2 spot line, the rim light and a plain swatch (Area 8, issue #78)', () => {
    const s = DREAM_SLOTS.jade;
    expect([s.body, s.gillNearStem]).toEqual(['#3ec8a8', '#13806c']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // A mid body, as Rainbow: ink reaches the 3:1 cue floor against it, the white edge does not, so the rim light carries the outline.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(6.88, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(2.09, 2);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(8.32, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(2.32, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.452, 3);
    // Darker than Mint and Lily green.
    expect(relativeLuminance(s.body)).toBeLessThan(relativeLuminance(DREAM_SLOTS.mint.body));
    expect(relativeLuminance(s.body)).toBeLessThan(relativeLuminance(DREAM_SLOTS['lily-green'].body));
    expect(DREAM_SWATCH.jade).toEqual({ body: '#3ec8a8', pattern: 'plain', marks: [], dark: false });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'jade').extras).toEqual({ spot: 'rgba(43,35,80,0.30)', rim: DREAM_RIM_LIGHT });
  });

  it('keeps Jade apart from every other Dream colour, Mint, Lily green and Crystal shine (the other greens) by 1.5:1 (PRD F15)', () => {
    const body = DREAM_SLOTS.jade.body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'jade').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [1.6, 0.154],
      'sky-blue': [1.37, 0.158],
      lavender: [1.32, 0.213],
      'sunset-orange': [1.32, 0.214],
      bubblegum: [1.32, 0.247],
      'midnight-blue': [4.73, 0.412],
      hearts: [1.83, 0.242],
      'tie-dye': [1.74, 0.234],
      iridescent: [1.39, 0.21],
      rainbow: [1.33, 0.3],
      galaxy: [5.6, 0.446],
      'tie-dye-galaxy': [5.37, 0.44],
      'lily-green': [1.7, 0.216],
      'firefly-gold': [1.48, 0.236],
      'poppy-red': [1.93, 0.344],
      plum: [2.97, 0.364],
      moonstone: [1.95, 0.258],
      chocolate: [4.48, 0.395],
      'crystal-shine': [1.62, 0.134],
      glowworm: [7.66, 0.523],
      'fiesta-shine': [1.14, 0.311],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    for (const green of ['mint', 'lily-green', 'crystal-shine'] as const) {
      expect(separation[green][0], `${green} greyscale margin`).toBeGreaterThanOrEqual(1.5);
    }
    // Fiesta shine is the closest in value and is told apart by hue and its sheen stripes.
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0])[0][0];
    expect(closest).toBe('fiesta-shine');
  });

  it('gives Fiesta shine the 3f mixes of its two picks, a bright pink body over the 0.2 spot line, the rim light and a sheen swatch (Area 8 Legendary, issue #78)', () => {
    const s = DREAM_SLOTS['fiesta-shine'];
    expect([s.body, s.gillNearStem]).toEqual(['#ff78c8', '#ffd83a']);
    expectNear(s.farSide, mixChannels(s.body, INK, 0.12), 'far side');
    expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), 'fin');
    expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), 'belly');
    expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), 'near filament');
    expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), 'far stem');
    expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), 'far filament');
    // A mid body, as Rainbow: ink reaches the 3:1 cue floor against it, the white edge does not, so the rim light carries the outline.
    expect(contrastRatio(s.body, INK)).toBeCloseTo(6.01, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(2.39, 2);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(7.28, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(1.73, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.389, 3);
    expect(DREAM_SWATCH['fiesta-shine']).toEqual({
      body: '#ff78c8',
      pattern: 'stripes',
      marks: ['rgba(255,225,74,0.85)', 'rgba(64,224,208,0.8)'],
      dark: false,
    });
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'fiesta-shine').extras).toEqual({
      spot: 'rgba(43,35,80,0.30)',
      rim: DREAM_RIM_LIGHT,
    });
  });

  it('keeps Fiesta shine apart from every other Dream colour, Bubblegum (the other pink) and Iridescent (shared stripe cue) by 1.5:1 (PRD F15)', () => {
    const body = DREAM_SLOTS['fiesta-shine'].body;
    const separation = Object.fromEntries(
      DREAM_IDS.filter((id) => id !== 'fiesta-shine').map((id) => [
        id,
        [
          Number(contrastRatio(body, DREAM_SLOTS[id].body).toFixed(2)),
          Number(oklabDifference(body, DREAM_SLOTS[id].body).toFixed(3)),
        ],
      ]),
    );
    expect(separation).toEqual({
      mint: [1.83, 0.307],
      'sky-blue': [1.57, 0.245],
      lavender: [1.51, 0.177],
      'sunset-orange': [1.51, 0.211],
      bubblegum: [1.51, 0.141],
      'midnight-blue': [4.13, 0.412],
      hearts: [2.09, 0.301],
      'tie-dye': [1.99, 0.29],
      iridescent: [1.59, 0.191],
      rainbow: [1.16, 0.124],
      galaxy: [4.9, 0.445],
      'tie-dye-galaxy': [4.7, 0.425],
      'lily-green': [1.94, 0.351],
      'firefly-gold': [1.69, 0.317],
      'poppy-red': [1.69, 0.201],
      plum: [2.6, 0.251],
      moonstone: [2.23, 0.289],
      chocolate: [3.92, 0.387],
      'crystal-shine': [1.41, 0.3],
      glowworm: [6.7, 0.533],
      jade: [1.14, 0.311],
    });
    for (const [id, [grey, colour]] of Object.entries(separation)) {
      expect(grey, `${id} greyscale`).toBeGreaterThanOrEqual(1.05);
      expect(colour, `${id} OKLab`).toBeGreaterThanOrEqual(0.075);
    }
    expect(separation.bubblegum[0]).toBeGreaterThanOrEqual(1.5);
    expect(separation.iridescent[0]).toBeGreaterThanOrEqual(1.5);
    // Jade and Rainbow are the closest in value; hue tells them apart, and Fiesta shine also glides its sheen stripes.
    const closest = Object.entries(separation).sort(([, a], [, b]) => a[0] - b[0]).map(([id]) => id);
    expect(closest.slice(0, 2)).toEqual(['jade', 'rainbow']);
  });

  it('keeps the Fiesta shine stripes lighter than the body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p, 10)', () => {
    const [light, tint] = DREAM_SWATCH['fiesta-shine'].marks;
    const body = DREAM_SWATCH['fiesta-shine'].body;
    const bodyInk = contrastRatio(body, INK);
    for (const mark of [light, tint]) {
      const laid = laidOverBody(mark, body);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(bodyInk);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(CUE_RATIO);
    }
    expect(laidOverBody(light, body)).toBe('#ffd15d');
    expect(laidOverBody(tint, body)).toBe('#66cbce');
    expect(DREAM_INSET_IDS).not.toContain('fiesta-shine');
  });
});

describe('Dream palettes over every real morph (guide 3f, 6h, 6p)', () => {
  it('swap the body and gill slots and keep the morph eye and mouth', () => {
    for (const morph of MORPH_LOOK_IDS) {
      for (const id of DREAM_IDS) {
        const palette = axolotlPalette(morph, id);
        expect(palette, `${morph} + ${id}`).toMatchObject(DREAM_SLOTS[id]);
        expect(palette.eye).toBe(MORPH_PALETTES[morph].eye);
        expect(palette.mouth).toBe(MORPH_PALETTES[morph].mouth);
        expect(palette.dream).toEqual({ id });
      }
    }
  });

  it('turn the morph extras off: no speckles, flecks, shimmer, shine alpha or fin rays', () => {
    for (const [name, , palette] of everyPair()) {
      const keys = Object.keys(palette.extras ?? {});
      for (const key of keys) expect(['spot', 'rim', 'eyeRing'], `${name} ${key}`).toContain(key);
    }
  });

  it('carry the rim light on exactly Midnight blue, Rainbow, Galaxy, Tie-dye galaxy, Plum, Chocolate, Glowworm, Jade and Fiesta shine', () => {
    for (const [name, id, palette] of everyPair()) {
      if (RIM_IDS.includes(id)) expect(palette.extras?.rim, name).toEqual(DREAM_RIM_LIGHT);
      else expect(palette.extras?.rim, name).toBeUndefined();
    }
    expect(DREAM_RIM_LIGHT).toEqual({ colour: '#cec9f0', width: 2, fin: true });
    expect(DREAM_EYE_RING).toEqual({ colour: '#cec9f0', width: 1.5 });
  });

  it('use the 3b Dream spot colours: white on the dark bodies, ink on bodies of luminance 0.2 or more', () => {
    for (const [name, id, palette] of everyPair()) {
      const dark = DARK_IDS.includes(id);
      expect(relativeLuminance(palette.body) >= 0.2, name).toBe(!dark);
      expect(palette.extras?.spot, name).toBe(dark ? 'rgba(255,255,255,0.45)' : 'rgba(43,35,80,0.30)');
    }
  });

  it('keep the eye bead or its ring at 3:1 or more against the Dream body', () => {
    for (const [name, id, palette] of everyPair()) {
      const ring = palette.extras?.eyeRing;
      if (DARK_IDS.includes(id)) expect(ring, name).toEqual(DREAM_EYE_RING);
      const bead = contrastRatio(palette.eye, palette.body);
      const ringRatio = ring ? contrastRatio(ring.colour, palette.body) : 0;
      expect(Math.max(bead, ringRatio), name).toBeGreaterThanOrEqual(CUE_RATIO);
    }
  });

  it('return the real morph palette for no Dream colour, and one cached object per pair', () => {
    for (const morph of MORPH_LOOK_IDS) {
      expect(axolotlPalette(morph, null)).toBe(MORPH_PALETTES[morph]);
      expect(MORPH_PALETTES[morph].dream).toBeUndefined();
      for (const id of DREAM_IDS) {
        expect(axolotlPalette(morph, id)).toBe(axolotlPalette(morph, id));
        expect(axolotlPalette(morph, id)).toEqual(dreamPalette(MORPH_PALETTES[morph], id));
      }
    }
  });
});

/** Path2D stand-in that counts its points and remembers ellipses. */
class RecordingPath2D {
  points = 0;
  ellipses = 0;
  closed = false;
  moveTo(): void {
    this.points++;
  }
  lineTo(): void {
    this.points++;
  }
  quadraticCurveTo(): void {
    this.points++;
  }
  bezierCurveTo(): void {
    this.points++;
  }
  closePath(): void {
    this.closed = true;
  }
  ellipse(): void {
    this.ellipses++;
  }
  arc(): void {
    this.ellipses++;
  }
}

interface PaintCall {
  readonly op: 'fill' | 'stroke';
  readonly style: string;
  readonly lineWidth: number;
  readonly path: RecordingPath2D;
  /** Clips active when the call was made. */
  readonly clips: number;
}

/** Every fill and stroke drawAxolotl makes, in order. */
function recordAxolotl(palette: MorphPalette, look: AxolotlArtLook): PaintCall[] {
  vi.stubGlobal('Path2D', RecordingPath2D);
  const calls: PaintCall[] = [];
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 0, clips: 0 };
  const saved: number[] = [];
  const methods: Record<string, (path: RecordingPath2D) => void> = {
    save: () => saved.push(state.clips),
    restore: () => {
      state.clips = saved.pop() ?? 0;
    },
    clip: () => {
      state.clips++;
    },
    fill: (path) => calls.push({ op: 'fill', style: state.fillStyle, lineWidth: 0, path, clips: state.clips }),
    stroke: (path) =>
      calls.push({ op: 'stroke', style: state.strokeStyle, lineWidth: state.lineWidth, path, clips: state.clips }),
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => (typeof key === 'string' && key in methods ? methods[key] : () => {}),
      set: (_target, key, value: unknown) => {
        if (key === 'fillStyle' || key === 'strokeStyle') state[key] = value as string;
        if (key === 'lineWidth') state.lineWidth = value as number;
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  drawAxolotl(ctx, AXO_REST_POSE, palette, look);
  vi.unstubAllGlobals();
  return calls;
}

/** Indices of Dream marker fills: a white 4-point star path then stroked with ink 1.6. */
function markerFillIndices(calls: readonly PaintCall[]): number[] {
  return calls.flatMap((call, i) => {
    if (call.op !== 'fill' || call.style !== WHITE || call.path.points !== 8 || call.path.ellipses !== 0) return [];
    const inked = calls.some(
      (c) => c.op === 'stroke' && c.path === call.path && c.style === INK && c.lineWidth === DREAM_MARKER_INK,
    );
    return inked ? [i] : [];
  });
}

describe('Dream overlay paint order (guide 6a layer 6.5, 6p)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const dotsLook: AxolotlArtLook = { ...DEFAULT_ART_LOOK, spots: 'dots' };

  it('paints the Dream marker on every morph and Dream colour pair', () => {
    for (const [name, , palette] of everyPair()) {
      expect(markerFillIndices(recordAxolotl(palette, dotsLook)), name).toHaveLength(3);
    }
  });

  it('never paints the Dream marker on a real morph', () => {
    for (const morph of MORPH_LOOK_IDS) {
      expect(markerFillIndices(recordAxolotl(MORPH_PALETTES[morph], dotsLook)), morph).toEqual([]);
    }
  });

  it('paints the player spots after every overlay fill', () => {
    for (const [name, id, palette] of everyPair()) {
      const calls = recordAxolotl(palette, dotsLook);
      const spot = palette.extras?.spot;
      const spotFills = calls.flatMap((c, i) => (c.op === 'fill' && c.style === spot ? [i] : []));
      const patternFills = calls.flatMap((c, i) => (c.op === 'fill' && c.clips >= 3 ? [i] : []));
      const overlay = [...patternFills, ...markerFillIndices(calls)];
      expect(spotFills.length, name).toBeGreaterThan(0);
      expect(patternFills.length > 0, name).toBe(!SOLID_IDS.includes(id));
      expect(Math.max(...overlay), name).toBeLessThan(Math.min(...spotFills));
    }
  });
});

/** Every Boy or girl, Tail, Body and Age look. */
function everyBodyLook(): AxolotlArtLook[] {
  const looks: AxolotlArtLook[] = [];
  for (const sex of AXO_SEXES)
    for (const tail of AXO_TAILS)
      for (const body of AXO_BODIES)
        for (const age of AXO_AGES) looks.push({ ...DEFAULT_ART_LOOK, sex, tail, body, age });
  return looks;
}
const EVERY_BODY_LOOK = everyBodyLook();

function lookName(look: AxolotlArtLook): string {
  return [look.sex, look.tail, look.body, look.age].join(' ');
}

/** Distance from (x, y) to the ellipse edge: positive inside, negative outside. */
function ellipseDepth(x: number, y: number, e: BodyEllipse): number {
  const at = (a: number): number => Math.hypot(e.cx + e.rx * Math.cos(a) - x, e.cy + e.ry * Math.sin(a) - y);
  const steps = 180;
  let best = 0;
  for (let k = 1; k < steps; k++) if (at((k / steps) * TAU) < at((best / steps) * TAU)) best = k;
  let lo = ((best - 1) / steps) * TAU;
  let hi = ((best + 1) / steps) * TAU;
  for (let k = 0; k < 60; k++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (at(m1) < at(m2)) hi = m2;
    else lo = m1;
  }
  const dist = at((lo + hi) / 2);
  const inside = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
  return inside ? dist : -dist;
}

/** The layer 4 tail and fin polygon, as drawAxolotl paints it. */
function silhouetteTail(tail: readonly TailSample[]): [number, number][] {
  const top = tail.map((tp): [number, number] => [tp.x, tp.cy - tp.hc - tp.finTop]).reverse();
  const bottom = tail.map((tp): [number, number] => [tp.x, tp.cy + tp.hc + tp.finBottom]);
  return [...top, ...bottom];
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

function segmentDistance(x: number, y: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
}

/** Distance from (x, y) to the polygon edge: positive inside, negative outside. */
function polygonDepth(x: number, y: number, poly: DreamPolygon): number {
  let dist = Infinity;
  for (let i = 0; i < poly.length; i++) dist = Math.min(dist, segmentDistance(x, y, poly[i], poly[(i + 1) % poly.length]));
  return isInPolygon(x, y, poly) ? dist : -dist;
}

/** Points of `poly` that sit outside x <= 14 or closer than `inset` to the edge of their silhouette piece. */
function clipFailures(poly: DreamPolygon, depth: (x: number, y: number) => number, inset: number): string[] {
  return poly.flatMap(([x, y]) => {
    const failures: string[] = [];
    if (x > DREAM_FACE_LIMIT_X + EPS) failures.push(`(${x.toFixed(2)}, ${y.toFixed(2)}) past x 14`);
    const d = depth(x, y);
    if (d < inset - EPS) failures.push(`(${x.toFixed(2)}, ${y.toFixed(2)}) depth ${d.toFixed(4)}`);
    return failures;
  });
}

const INSETS = [0, DREAM_PATTERN_INSET] as const;

/** Every swim sample and tail amplitude of every look, with its torso and painted tail. */
function everyPose(): { name: string; torso: BodyEllipse; tail: TailSample[] }[] {
  return EVERY_BODY_LOOK.flatMap((look) => {
    const geo = axolotlBodyGeometry(look);
    return SWIM_SAMPLES.flatMap((swim) =>
      TAIL_AMPS.map((amp) => ({
        name: `${lookName(look)} swim ${swim.toFixed(2)} amp ${amp}`,
        torso: geo.torso,
        tail: tailSamples(geo.tail, swim, amp),
      })),
    );
  });
}
const EVERY_POSE = everyPose();

describe('Dream pattern clip (guide 6p)', () => {
  it('uses the 2-unit inset on Hearts, Tie-dye and Iridescent only', () => {
    expect([...DREAM_INSET_IDS].sort()).toEqual(['hearts', 'iridescent', 'tie-dye']);
    expect(DREAM_PATTERN_INSET).toBe(2);
  });

  it('stays at x <= 14 and inside the silhouette, inset where asked, on every look and swim pose', () => {
    const failures: string[] = [];
    for (const inset of INSETS) {
      for (const look of EVERY_BODY_LOOK) {
        const geo = axolotlBodyGeometry(look);
        const [head, torso] = dreamClipPolygons(geo.torso, tailSamples(geo.tail, 0, 1), inset);
        const ellipses: [DreamPolygon, BodyEllipse][] = [
          [head, HEAD_ELLIPSE],
          [torso, geo.torso],
        ];
        for (const [poly, e] of ellipses) {
          for (const failure of clipFailures(poly, (x, y) => ellipseDepth(x, y, e), inset)) {
            failures.push(`inset ${inset} ${lookName(look)}: ${failure}`);
          }
        }
      }
      for (const pose of EVERY_POSE) {
        const polys = dreamClipPolygons(pose.torso, pose.tail, inset);
        expect(polys).toHaveLength(3);
        const sil = silhouetteTail(pose.tail);
        const depth = (x: number, y: number): number => {
          const inTail = polygonDepth(x, y, sil);
          return inTail >= inset - EPS ? inTail : Math.max(inTail, ellipseDepth(x, y, pose.torso));
        };
        for (const failure of clipFailures(polys[2], depth, inset)) {
          failures.push(`inset ${inset} ${pose.name}: ${failure}`);
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('puts every Hearts and Galaxy shape centre inside the clip', () => {
    const failures: string[] = [];
    for (const id of ['hearts', 'galaxy'] as const) {
      const inset = DREAM_INSET_IDS.includes(id) ? DREAM_PATTERN_INSET : 0;
      for (const pose of EVERY_POSE) {
        const polys = dreamClipPolygons(pose.torso, pose.tail, inset);
        const shapes = dreamPatternShapes(id, pose.torso, pose.tail, undefined);
        for (const s of shapes) {
          if (!('x' in s)) continue;
          if (!polys.some((poly) => isInPolygon(s.x, s.y, poly))) {
            failures.push(`${id} ${s.kind} (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) on ${pose.name}`);
          }
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('puts every Glowworm glow dot and its halo inside the silhouette, on every look and swim pose', () => {
    const failures: string[] = [];
    for (const pose of EVERY_POSE) {
      const polys = dreamClipPolygons(pose.torso, pose.tail, 0);
      const sil = silhouetteTail(pose.tail);
      const depth = (x: number, y: number): number => Math.max(polygonDepth(x, y, sil), ellipseDepth(x, y, pose.torso));
      const shapes = dreamPatternShapes('glowworm', pose.torso, pose.tail, undefined);
      expect(shapes, pose.name).toHaveLength(32);
      for (const s of shapes) {
        if (s.kind !== 'dot') {
          failures.push(`${s.kind} on ${pose.name}`);
          continue;
        }
        if (!polys.some((poly) => isInPolygon(s.x, s.y, poly))) {
          failures.push(`dot (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) outside the clip on ${pose.name}`);
        }
        // Every dot, halo included, sits wholly inside the silhouette.
        const d = depth(s.x, s.y);
        if (d < s.r - EPS) failures.push(`dot r ${s.r.toFixed(2)} at (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) depth ${d.toFixed(2)} on ${pose.name}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  }, ENUMERATION_TIMEOUT_MS);

  it('draws the guide 6p counts: 7 hearts; Galaxy 2 nebulae, 10 stars, 4 dots; Tie-dye galaxy 6 stars', () => {
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const tail = tailSamples(geo.tail, 0, 1);
    const count = (id: DreamLookId, kind: DreamShape['kind']): number =>
      dreamPatternShapes(id, geo.torso, tail, undefined).filter((s) => s.kind === kind).length;
    expect(count('hearts', 'heart')).toBe(7);
    expect(count('galaxy', 'ellipse')).toBe(2);
    expect(count('galaxy', 'star')).toBe(10);
    expect(count('galaxy', 'dot')).toBe(4);
    expect(count('tie-dye-galaxy', 'star')).toBe(6);
    expect(count('rainbow', 'polygon')).toBe(5);
    expect(count('iridescent', 'polygon')).toBe(2);
    expect(count('crystal-shine', 'polygon')).toBe(2);
    expect(count('fiesta-shine', 'polygon')).toBe(2);
    // Glowworm: sixteen round glow dots (nine on the body, seven on the tail), each a halo under a core, and no stars.
    expect(count('glowworm', 'dot')).toBe(32);
    expect(count('glowworm', 'star')).toBe(0);
  });
});

describe('Dream marker (guide 4e, 6p)', () => {
  it('sits on the top fin band, midway between the core edge and the fin edge', () => {
    for (const pose of EVERY_POSE) {
      const centres = dreamMarkerCentres(pose.tail);
      expect(centres).toHaveLength(3);
      for (const c of centres) {
        const sil = silhouetteTail(pose.tail);
        expect(polygonDepth(c.x, c.y, sil), pose.name).toBeGreaterThan(0);
      }
    }
  });
});

describe('Dream greyscale cues (PRD F15, guide 6p)', () => {
  it('leaves exactly the thirteen solids plain', () => {
    const plain = DREAM_IDS.filter((id) => DREAM_SWATCH[id].pattern === 'plain');
    expect(plain).toEqual(SOLID_IDS);
  });

  it('gives the nine patterned and sheen colours seven distinct cues (the three sheens share stripes), each with a pattern', () => {
    const patterned = DREAM_IDS.filter((id) => !SOLID_IDS.includes(id));
    expect(patterned).toHaveLength(9);
    const cues = patterned.map((id) => DREAM_SWATCH[id].pattern);
    expect(new Set(cues).size).toBe(7);
    expect(patterned.filter((id) => DREAM_SWATCH[id].pattern === 'stripes')).toEqual(['iridescent', 'crystal-shine', 'fiesta-shine']);
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const tail = tailSamples(geo.tail, 0, 1);
    for (const id of DREAM_IDS) {
      const shapes = dreamPatternShapes(id, geo.torso, tail, undefined);
      expect(shapes.length > 0, id).toBe(!SOLID_IDS.includes(id));
    }
  });
});

describe('Sheen Dream colours (guide 6p, 9)', () => {
  it('flag exactly the stripes swatches, Iridescent, Crystal shine and Fiesta shine', () => {
    expect(DREAM_IDS.filter(isSheenDream)).toEqual(['iridescent', 'crystal-shine', 'fiesta-shine']);
    expect(DREAM_IDS.filter((id) => DREAM_SWATCH[id].pattern === 'stripes')).toEqual(DREAM_IDS.filter(isSheenDream));
  });

  it('glide the stripe pair of every sheen colour with the sheen phase, in the colour own marks', () => {
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const tail = tailSamples(geo.tail, 0, 1);
    for (const id of ['iridescent', 'crystal-shine', 'fiesta-shine'] as const) {
      const still = dreamPatternShapes(id, geo.torso, tail, undefined);
      const moved = dreamPatternShapes(id, geo.torso, tail, 0.5);
      expect(still, id).toHaveLength(2);
      expect(still.map((s) => (s.kind === 'polygon' ? s.fill : '')), id).toEqual(DREAM_SWATCH[id].marks);
      expect(moved, id).not.toEqual(still);
    }
    expect(dreamPatternShapes('iridescent', geo.torso, tail, 0.5)).not.toEqual(
      dreamPatternShapes('crystal-shine', geo.torso, tail, 0.5),
    );
    expect(dreamPatternShapes('crystal-shine', geo.torso, tail, 0.5)).not.toEqual(
      dreamPatternShapes('fiesta-shine', geo.torso, tail, 0.5),
    );
  });
});

describe('Iridescent glide (guide 6p, 9)', () => {
  it('repeats every 4 s', () => {
    expect(IRIDESCENT_GLIDE_S).toBe(4);
    expect(dreamSheenAt(0)).toBe(0);
    expect(dreamSheenAt(1)).toBeCloseTo(0.25, 12);
    expect(dreamSheenAt(4)).toBe(0);
    expect(dreamSheenAt(5)).toBeCloseTo(dreamSheenAt(1), 12);
    expect(dreamSheenAt(-1)).toBeCloseTo(0.75, 12);
    for (let t = 0; t < 12; t += 0.37) {
      expect(dreamSheenAt(t)).toBeGreaterThanOrEqual(0);
      expect(dreamSheenAt(t)).toBeLessThan(1);
    }
  });

  it('holds at x -10 under reduced motion and glides from x 14 toward the tail tip', () => {
    const tipX = -74;
    expect(iridescentStripeX(undefined, tipX)).toBe(IRIDESCENT_STILL_X);
    expect(IRIDESCENT_STILL_X).toBe(-10);
    expect(iridescentStripeX(0, tipX)).toBe(14);
    let last = Infinity;
    for (const sheen of [0, 0.25, 0.5, 0.75, 0.999]) {
      const x = iridescentStripeX(sheen, tipX);
      expect(x).toBeLessThan(last);
      expect(x).toBeGreaterThan(tipX);
      last = x;
    }
  });
});
