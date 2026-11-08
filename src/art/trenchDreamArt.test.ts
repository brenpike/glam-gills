/**
 * Open lake Area 13 Dream colours (issue #215, ND-2): Pitch black, a warm near-black solid, and Trench shine, a deep
 * lake-blue sheen. Their 3f slots and mixes, their separation from every other Dream colour under the PRD F15 rule of
 * ND-10 (src/art/dreamSeparation.ts), their cue checks, the eye ring and cheek heart, and their Paint shell icon and
 * swatch digests. The painters run against a call-log context and a stub Path2D, as in lakeTreasureArt.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { DREAM_COLOURS, PITCH_BLACK, TRENCH_SHINE } from '../logic/catalogue';
import { tailStripe } from './axolotlRigStripe';
import { DEFAULT_ART_LOOK, axolotlBodyGeometry, tailSamples } from './drawAxolotlParts';
import { DREAM_INSET_IDS, dreamPatternShapes, isSheenDream } from './drawDreamOverlay';
import { MORPH_LOOK_IDS } from './drawMorphs';
import { DREAM_SWATCH_IDS, TREASURE_ICON_SLUGS, paintDreamSwatch, paintTreasureIcon, type TreasureIconSlug } from './drawTreasures';
import {
  DREAM_GREYSCALE_FLOOR,
  DREAM_GREYSCALE_MARGIN,
  DREAM_OKLAB_FLOOR,
  dreamKind,
  greyscaleFloorApplies,
} from './dreamSeparation';
import {
  BLUSH,
  CHEEK_HEART,
  DREAM_EYE_RING,
  DREAM_RIM_LIGHT,
  DREAM_SLOTS,
  INK,
  MORPH_PALETTES,
  WHITE,
  axolotlPalette,
  dreamPalette,
  type DreamLookId,
} from './palette';
import { BADGE_FILL, DREAM_RIM, DREAM_SWATCH, PAINT_SHELL_FILL } from './treasurePalette';

const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];
/** Guide 10 cue floor. */
const CUE_RATIO = 3;
const SIZES = [28, 32, 48, 80] as const;
/** The two Paint shells the open lake Area 13 added (issue #215, ND-3), the last two icon slugs. */
const TRENCH_SHELL_SLUGS: readonly TreasureIconSlug[] = ['paint-shell-pitch-black', 'paint-shell-trench-shine'];
/** Trench shine's stripe pair (ND-2): the fading light's gold bulb and its pale sky hint, at 0.85. */
const TRENCH_SHINE_MARKS = ['rgba(242,222,138,0.85)', 'rgba(207,238,255,0.85)'] as const;

/**
 * Call-log digests of the two Area 13 Paint shell icons (issue #215, ND-2), by slug then size, and of their swatches at
 * 32, pinned when they were authored. Re-pin these, and only these, when Pitch black or Trench shine is retuned on purpose.
 */
const TRENCH_SHELL_DIGESTS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  'paint-shell-pitch-black': { 28: '5e242d25ad994051:21', 32: 'd9844b0fa760e953:21', 48: 'af96386e84c18eca:21', 80: 'b9658aa122d03e25:21' },
  'paint-shell-trench-shine': { 28: 'ca55c749bba98985:21', 32: '5fdcb9e5eed55f79:21', 48: 'a88f2187e1e0f2f3:21', 80: 'de61bc51cb69f845:21' },
};
const PITCH_BLACK_SWATCH_DIGEST = 'bb44c20bcbf9fa07:21';
const TRENCH_SHINE_SWATCH_DIGEST = '66a00489983cb85d:21';

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

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

/** Channels of `from` mixed `t` of the way toward `to` in sRGB (guide 3f). */
function mixChannels(from: string, to: string, t: number): number[] {
  const a = rgbOf(from);
  const b = rgbOf(to);
  return a.map((v, i) => v + (b[i] - v) * t);
}

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

/** HSV hue of a #rrggbb colour, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return sector * 60;
}

/** HSV saturation of a #rrggbb colour, 0 to 1. */
function saturationOf(hex: string): number {
  const channels = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(...channels);
  return max === 0 ? 0 : (max - Math.min(...channels)) / max;
}

/** The red test of lakeTreasureArt.test.ts. */
const isReddish = (hex: string): boolean => saturationOf(hex) > 0.15 && (hueOf(hex) < 15 || hueOf(hex) > 345);

function expectNear(hex: string, expected: number[], label: string): void {
  rgbOf(hex).forEach((v, i) => expect(Math.abs(v - expected[i]), `${label} channel ${i}`).toBeLessThanOrEqual(1));
}

function expectThreeFMixes(id: DreamLookId): void {
  const s = DREAM_SLOTS[id];
  expectNear(s.farSide, mixChannels(s.body, INK, 0.12), `${id} far side`);
  expectNear(s.fin, mixChannels(s.body, WHITE, 0.4), `${id} fin`);
  expectNear(s.belly, mixChannels(s.body, WHITE, 0.55), `${id} belly`);
  expectNear(s.gillNearFilament, mixChannels(s.gillNearStem, WHITE, 0.22), `${id} near filament`);
  expectNear(s.gillFarStem, mixChannels(s.gillNearStem, INK, 0.1), `${id} far stem`);
  expectNear(s.gillFarFilament, mixChannels(s.gillNearFilament, INK, 0.08), `${id} far filament`);
}

/** Greyscale ratio (2 places) of two Dream bodies. */
function greyscaleOf(a: DreamLookId, b: DreamLookId): number {
  return Number(contrastRatio(DREAM_SLOTS[a].body, DREAM_SLOTS[b].body).toFixed(2));
}

/** OKLab difference (3 places) of two Dream bodies. */
function colourOf(a: DreamLookId, b: DreamLookId): number {
  return Number(oklabDifference(DREAM_SLOTS[a].body, DREAM_SLOTS[b].body).toFixed(3));
}

/** Greyscale ratio and OKLab difference of `id` against every other Dream body. */
function measureSeparation(id: DreamLookId): Record<string, [number, number]> {
  return Object.fromEntries(DREAM_IDS.filter((other) => other !== id).map((other) => [other, [greyscaleOf(id, other), colourOf(id, other)]]));
}

/** The PRD F15 floors of ND-10 for `id` against every other Dream colour, by the dreamSeparation.ts rule. */
function expectF15Floors(id: DreamLookId): void {
  for (const other of DREAM_IDS.filter((o) => o !== id)) {
    expect(colourOf(id, other), `${id} vs ${other} OKLab`).toBeGreaterThanOrEqual(DREAM_OKLAB_FLOOR);
    if (greyscaleFloorApplies(id, other)) {
      expect(greyscaleOf(id, other), `${id} vs ${other} greyscale`).toBeGreaterThanOrEqual(DREAM_GREYSCALE_FLOOR);
    }
  }
  if (id !== 'plum') expect(greyscaleOf(id, 'plum'), `${id} plum margin`).toBeGreaterThanOrEqual(DREAM_GREYSCALE_MARGIN);
  if (dreamKind(id) === 'sheen' && id !== 'iridescent') {
    expect(greyscaleOf(id, 'iridescent'), `${id} iridescent margin`).toBeGreaterThanOrEqual(DREAM_GREYSCALE_MARGIN);
  }
}

function sortIdsByGrey(separation: Record<string, [number, number]>): string[] {
  return Object.entries(separation)
    .sort(([, a], [, b]) => a[0] - b[0])
    .map(([id]) => id);
}

function sortIdsByColour(separation: Record<string, [number, number]>): string[] {
  return Object.entries(separation)
    .sort(([, a], [, b]) => a[1] - b[1])
    .map(([id]) => id);
}

// ---------------------------------------------------------------------------
// Call-log digests
// ---------------------------------------------------------------------------

class LogPath {
  readonly cmds: unknown[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) => (key === 'cmds' ? target.cmds : (...args: unknown[]) => recordPathCmd(target, key, args)),
    });
  }
}

function recordPathCmd(target: LogPath, key: string | symbol, args: unknown[]): void {
  target.cmds.push([String(key), ...args.map((a) => (a instanceof LogPath ? a.cmds : a))]);
}

/** FNV-1a digest pair of `text`, plus its length. */
function digest(text: string): string {
  const hash = (seed: number): string => {
    let x = seed;
    for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619) >>> 0;
    return x.toString(16).padStart(8, '0');
  };
  return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}:${text.length}`;
}

/** Every context call and property write `paint` makes, in order, as JSON. */
function callLogOf(paint: (ctx: CanvasRenderingContext2D) => void): string {
  const log: unknown[] = [];
  vi.stubGlobal('Path2D', LogPath);
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, key) =>
        (...args: unknown[]) => {
          log.push([String(key), ...args.map((a) => (a instanceof LogPath ? a.cmds : a))]);
        },
      set: (_target, key, value) => {
        log.push(['set', String(key), value]);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  try {
    paint(ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return JSON.stringify(log);
}

/** Digest of the normal icon of `slug` at `size`, as lakeTreasureArt.test.ts takes it. */
function iconDigest(slug: TreasureIconSlug, size: number): string {
  return digest(digest(callLogOf((ctx) => paintTreasureIcon(ctx, slug, size))));
}

/** Digest of the Dream swatch of `id` at 32, as lakeTreasureArt.test.ts takes it. */
function swatchDigest(id: (typeof DREAM_SWATCH_IDS)[number]): string {
  return digest(digest(callLogOf((ctx) => paintDreamSwatch(ctx, id, 32))));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('The PRD F15 separation rule (issue #215, ND-10, src/art/dreamSeparation.ts)', () => {
  it('names the floors once: 1.05:1 in greyscale, 0.075 in OKLab, and the 1.5:1 margin', () => {
    expect(DREAM_GREYSCALE_FLOOR).toBe(1.05);
    expect(DREAM_OKLAB_FLOOR).toBe(0.075);
    expect(DREAM_GREYSCALE_MARGIN).toBe(1.5);
  });

  it('reads each Dream colour kind from the catalogue, in step with the swatch pattern (a sheen glides stripes, a solid is plain)', () => {
    expect(new Set(DREAM_COLOURS.map((colour) => colour.id))).toEqual(new Set(DREAM_IDS));
    for (const id of DREAM_IDS) {
      expect(dreamKind(id) === 'sheen', id).toBe(DREAM_SWATCH[id].pattern === 'stripes');
      expect(dreamKind(id) === 'solid', id).toBe(DREAM_SWATCH[id].pattern === 'plain');
    }
    expect(['mint', 'iridescent', 'hearts', 'glowworm', 'pitch-black', 'trench-shine'].map((id) => dreamKind(id as DreamLookId))).toEqual([
      'solid',
      'sheen',
      'patterned',
      'patterned',
      'solid',
      'sheen',
    ]);
    expect(() => dreamKind('no-such-colour' as DreamLookId)).toThrow('no-such-colour');
  });

  it('holds the greyscale floor only between two Dream colours of the same kind, both ways round', () => {
    expect(greyscaleFloorApplies('pitch-black', 'obsidian')).toBe(true);
    expect(greyscaleFloorApplies('trench-shine', 'crystal-shine')).toBe(true);
    expect(greyscaleFloorApplies('glowworm', 'galaxy')).toBe(true);
    expect(greyscaleFloorApplies('trench-shine', 'olive')).toBe(false);
    expect(greyscaleFloorApplies('pitch-black', 'glowworm')).toBe(false);
    expect(greyscaleFloorApplies('hearts', 'iridescent')).toBe(false);
    for (const a of DREAM_IDS) {
      for (const b of DREAM_IDS) expect(greyscaleFloorApplies(a, b), `${a} vs ${b}`).toBe(greyscaleFloorApplies(b, a));
    }
  });
});

describe('Open lake Area 13 Dream colours (guide 3f, issue #215, ND-2)', () => {
  it('appends Pitch black and Trench shine after every earlier Dream colour, swatch and Paint shell, in the catalogue order', () => {
    expect(DREAM_IDS.slice(-3)).toEqual(['obsidian', 'pitch-black', 'trench-shine']);
    expect(DREAM_SWATCH_IDS.slice(-3)).toEqual(['obsidian', 'pitch-black', 'trench-shine']);
    expect(DREAM_SWATCH_IDS).toEqual(DREAM_IDS);
    expect(TREASURE_ICON_SLUGS.slice(-2)).toEqual(TRENCH_SHELL_SLUGS);
    expect([PITCH_BLACK.id, TRENCH_SHINE.id]).toEqual(['pitch-black', 'trench-shine']);
    expect(DREAM_SWATCH['pitch-black']).toEqual({ body: '#1a1310', pattern: 'plain', marks: [], dark: true });
    expect(DREAM_SWATCH['trench-shine']).toEqual({ body: '#4a7fee', pattern: 'stripes', marks: [...TRENCH_SHINE_MARKS], dark: false });
  });

  it('gives Pitch black the 3f mixes of its two picks, a warm near-black body under the 0.2 spot line, the white edge over 3:1, the eye ring and rim light', () => {
    const s = DREAM_SLOTS['pitch-black'];
    expect([s.body, s.gillNearStem]).toEqual(['#1a1310', '#f2de8a']);
    expect([s.farSide, s.fin, s.belly, s.gillNearFilament, s.gillFarStem, s.gillFarFilament]).toEqual([
      '#1c1518',
      '#767170',
      '#989593',
      '#f5e5a4',
      '#decb84',
      '#e5d59d',
    ]);
    expectThreeFMixes('pitch-black');
    expect(contrastRatio(s.body, INK)).toBeCloseTo(1.27, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(18.35, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(1.05, 2);
    expect(contrastRatio(s.body, DREAM_EYE_RING.colour)).toBeCloseTo(11.57, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(13.62, 2);
    expect(contrastRatio(s.farSide, s.gillFarStem)).toBeCloseTo(11.1, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.0072, 4);
    expect(dreamKind('pitch-black')).toBe('solid');
    expect(isSheenDream('pitch-black')).toBe(false);
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'pitch-black').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Pitch black apart from every other Dream colour by the F15 rule, below Glowworm, Obsidian the closest solid in value and colour (PRD F15)', () => {
    const separation = measureSeparation('pitch-black');
    expect(separation).toEqual({
      mint: [14.01, 0.71],
      'sky-blue': [12.01, 0.669],
      lavender: [11.61, 0.668],
      'sunset-orange': [11.59, 0.667],
      bubblegum: [11.61, 0.674],
      'midnight-blue': [1.85, 0.248],
      hearts: [16.05, 0.762],
      'tie-dye': [15.27, 0.746],
      iridescent: [12.21, 0.681],
      rainbow: [6.61, 0.544],
      galaxy: [1.56, 0.205],
      'tie-dye-galaxy': [1.63, 0.212],
      'lily-green': [14.88, 0.741],
      'firefly-gold': [12.93, 0.709],
      'poppy-red': [4.55, 0.467],
      plum: [2.95, 0.352],
      moonstone: [17.12, 0.782],
      chocolate: [1.96, 0.22],
      'crystal-shine': [5.43, 0.446],
      glowworm: [1.14, 0.125],
      jade: [8.76, 0.573],
      'fiesta-shine': [7.66, 0.588],
      olive: [4.98, 0.433],
      'lantern-shine': [5.99, 0.505],
      peach: [10.04, 0.631],
      'confetti-shine': [1.73, 0.277],
      marigold: [10.55, 0.649],
      'golden-hour-shine': [7.19, 0.535],
      lime: [9.38, 0.608],
      hyacinth: [5.7, 0.502],
      'lagoon-shine': [8.13, 0.558],
      'tule-green': [1.46, 0.16],
      obsidian: [1.23, 0.08],
      'trench-shine': [4.86, 0.462],
    });
    expectF15Floors('pitch-black');
    expect(relativeLuminance(DREAM_SLOTS['pitch-black'].body)).toBeLessThan(relativeLuminance(DREAM_SLOTS.glowworm.body));
    for (const id of DREAM_IDS.filter((other) => other !== 'pitch-black')) {
      expect(relativeLuminance(DREAM_SLOTS[id].body), id).toBeGreaterThan(relativeLuminance(DREAM_SLOTS['pitch-black'].body));
    }
    const solids = sortIdsByGrey(separation).filter((id) => dreamKind(id as DreamLookId) === 'solid');
    expect(solids[0]).toBe('obsidian');
    expect(sortIdsByColour(separation)[0]).toBe('obsidian');
  });

  it('gives Trench shine the 3f mixes of its two picks, a lake blue body over the 0.2 spot line, both 3:1 cue edges, a sheen swatch and no rim light', () => {
    const s = DREAM_SLOTS['trench-shine'];
    expect([s.body, s.gillNearStem]).toEqual(['#4a7fee', '#ffa86b']);
    expect([s.farSide, s.fin, s.belly, s.gillNearFilament, s.gillFarStem, s.gillFarFilament]).toEqual([
      '#4674db',
      '#92b2f5',
      '#aec5f7',
      '#ffbb8c',
      '#ea9b68',
      '#eeaf87',
    ]);
    expectThreeFMixes('trench-shine');
    expect(contrastRatio(s.body, INK)).toBeCloseTo(3.81, 2);
    expect(contrastRatio(s.body, INK)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(3.78, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(4.61, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(1.99, 2);
    expect(contrastRatio(s.farSide, s.gillFarStem)).toBeCloseTo(1.96, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.228, 3);
    expect(dreamKind('trench-shine')).toBe('sheen');
    expect(isSheenDream('trench-shine')).toBe(true);
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'trench-shine').extras).toEqual({ spot: 'rgba(43,35,80,0.30)' });
  });

  it('keeps Trench shine apart from every other Dream colour by the F15 rule: the other sheens by 1.05:1, Iridescent and Plum by 1.5:1, Hyacinth the closest in colour (PRD F15)', () => {
    const separation = measureSeparation('trench-shine');
    expect(separation).toEqual({
      mint: [2.88, 0.349],
      'sky-blue': [2.47, 0.263],
      lavender: [2.39, 0.268],
      'sunset-orange': [2.39, 0.36],
      bubblegum: [2.39, 0.308],
      'midnight-blue': [2.62, 0.229],
      hearts: [3.3, 0.421],
      'tie-dye': [3.14, 0.413],
      iridescent: [2.51, 0.282],
      rainbow: [1.36, 0.324],
      galaxy: [3.11, 0.274],
      'tie-dye-galaxy': [2.98, 0.267],
      'lily-green': [3.06, 0.437],
      'firefly-gold': [2.66, 0.438],
      'poppy-red': [1.07, 0.343],
      plum: [1.65, 0.207],
      moonstone: [3.52, 0.397],
      chocolate: [2.48, 0.328],
      'crystal-shine': [1.12, 0.166],
      glowworm: [4.25, 0.37],
      jade: [1.8, 0.254],
      'fiesta-shine': [1.58, 0.276],
      olive: [1.02, 0.288],
      'lantern-shine': [1.23, 0.337],
      peach: [2.07, 0.314],
      'confetti-shine': [2.81, 0.277],
      marigold: [2.17, 0.394],
      'golden-hour-shine': [1.48, 0.331],
      lime: [1.93, 0.37],
      hyacinth: [1.17, 0.104],
      'lagoon-shine': [1.67, 0.162],
      'tule-green': [3.32, 0.392],
      obsidian: [3.97, 0.39],
      'pitch-black': [4.86, 0.462],
    });
    expectF15Floors('trench-shine');
    const sheens = sortIdsByGrey(separation).filter((id) => dreamKind(id as DreamLookId) === 'sheen');
    expect(sheens.slice(0, 2)).toEqual(['crystal-shine', 'lantern-shine']);
    expect(sortIdsByColour(separation)[0]).toBe('hyacinth');
  });

  it('keeps the Trench shine stripes lighter than the body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p, 10)', () => {
    const [gold, sky] = DREAM_SWATCH['trench-shine'].marks;
    const body = DREAM_SWATCH['trench-shine'].body;
    const bodyInk = contrastRatio(body, INK);
    for (const mark of [gold, sky]) {
      const laid = laidOver(mark, body);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(bodyInk);
      expect(contrastRatio(laid, INK), mark).toBeGreaterThanOrEqual(CUE_RATIO);
    }
    expect(laidOver(gold, body)).toBe('#d9d099');
    expect(laidOver(sky, body)).toBe('#bbddfc');
    expect(contrastRatio(laidOver(gold, body), INK)).toBeCloseTo(9.21, 2);
    expect(contrastRatio(laidOver(sky, body), INK)).toBeCloseTo(10.19, 2);
    expect(DREAM_INSET_IDS).not.toContain('trench-shine');
  });

  it('glides its own stripe pair with the sheen phase, in colours no other sheen glides', () => {
    const geo = axolotlBodyGeometry(DEFAULT_ART_LOOK);
    const tail = tailSamples(geo.tail, 0, 1);
    const still = dreamPatternShapes('trench-shine', geo.torso, tail, undefined);
    expect(still).toHaveLength(2);
    expect(still.map((shape) => (shape.kind === 'polygon' ? shape.fill : ''))).toEqual([...TRENCH_SHINE_MARKS]);
    expect(dreamPatternShapes('trench-shine', geo.torso, tail, 0.5)).not.toEqual(still);
    for (const id of DREAM_IDS.filter((other) => other !== 'trench-shine' && isSheenDream(other))) {
      expect(DREAM_SWATCH[id].marks, id).not.toEqual(DREAM_SWATCH['trench-shine'].marks);
    }
  });

  it('paints its marks on the shared live stripe, gold first, lighter than the body and with no pattern inset (ADR 0031, guide 6p)', () => {
    const body = DREAM_SWATCH['trench-shine'].body;
    const polygonsOf = (id: DreamLookId, sheen: number | undefined) =>
      tailStripe(id, DEFAULT_ART_LOOK, 0, 1, sheen, Infinity).map((band) => band.polygons);
    for (const mark of TRENCH_SHINE_MARKS) expect(relativeLuminance(laidOver(mark, body)), mark).toBeGreaterThan(relativeLuminance(body));
    for (const sheen of [0, 0.5, 0.9, undefined]) {
      const stripe = tailStripe('trench-shine', DEFAULT_ART_LOOK, 0, 1, sheen, Infinity);
      expect(stripe.map((band) => [band.colour, band.alpha]), `sheen ${sheen}`).toEqual([
        [0xf2de8a, 0.85],
        [0xcfeeff, 0.85],
      ]);
      for (const band of stripe) expect(band.polygons.length, `sheen ${sheen}`).toBeGreaterThan(0);
      expect(stripe.map((band) => band.polygons), `sheen ${sheen}`).toEqual(polygonsOf('crystal-shine', sheen));
      expect(stripe.map((band) => band.polygons), `sheen ${sheen}`).not.toEqual(polygonsOf('iridescent', sheen));
    }
  });

  it('keeps every Area 13 body, gill and stripe off the rarity badge fills and off red; Pitch black a warm black', () => {
    const badges = Object.values(BADGE_FILL).map((fill) => fill.toLowerCase());
    const pitch = DREAM_SLOTS['pitch-black'];
    const trench = DREAM_SLOTS['trench-shine'];
    const picks = [pitch.body, pitch.gillNearStem, trench.body, trench.gillNearStem];
    for (const colour of picks) expect(badges, colour).not.toContain(colour.toLowerCase());
    const notRed = [pitch.body, pitch.gillNearStem, trench.body, trench.gillNearStem, ...TRENCH_SHINE_MARKS.map((mark) => laidOver(mark, trench.body))];
    for (const colour of notRed) expect(isReddish(colour), colour).toBe(false);
  });
});

describe('Pitch black and Trench shine over every real morph (guide 3f, 6u, 10)', () => {
  it('keep the eye bead or its ring at 3:1 or more against both bodies over every real morph; Pitch black always wears the Dream eye ring', () => {
    for (const morph of MORPH_LOOK_IDS) {
      for (const id of ['pitch-black', 'trench-shine'] as const) {
        const palette = axolotlPalette(morph, id);
        const ring = palette.extras?.eyeRing;
        if (id === 'pitch-black') expect(ring, `${morph} + ${id}`).toEqual(DREAM_EYE_RING);
        const bead = contrastRatio(palette.eye, palette.body);
        const ringRatio = ring ? contrastRatio(ring.colour, palette.body) : 0;
        expect(Math.max(bead, ringRatio), `${morph} + ${id}`).toBeGreaterThanOrEqual(CUE_RATIO);
      }
    }
  });

  it.each([
    ['pitch-black', 18.35, 1.27, 6.33],
    ['trench-shine', 3.78, 3.81, 1.3],
  ] as const)('reads the girl cheek heart on %s: the white edge or the ink at 3:1, the fill further from the body than the blush', (id, white, ink, fill) => {
    const body = DREAM_SLOTS[id].body;
    expect(contrastRatio(WHITE, body)).toBeCloseTo(white, 2);
    expect(contrastRatio(INK, body)).toBeCloseTo(ink, 2);
    expect(contrastRatio(CHEEK_HEART, body)).toBeCloseTo(fill, 2);
    expect(Math.max(contrastRatio(WHITE, body), contrastRatio(INK, body))).toBeGreaterThanOrEqual(CUE_RATIO);
    expect(contrastRatio(CHEEK_HEART, body)).toBeGreaterThan(contrastRatio(laidOver(BLUSH, body), body));
  });
});

describe('Pitch black and Trench shine Paint shells and swatches (issue #215, ND-2)', () => {
  it('draws Pitch black as a dark plain tile with the rim arc, and Trench shine as a stripe tile with no rim arc, both on the shipped shell', () => {
    for (const id of ['pitch-black', 'trench-shine'] as const) {
      const look = DREAM_SWATCH[id];
      const icon = callLogOf((ctx) => paintTreasureIcon(ctx, `paint-shell-${id}`, 48));
      const tile = callLogOf((ctx) => paintDreamSwatch(ctx, id, 32));
      for (const log of [icon, tile]) {
        expect(log, id).toContain(look.body);
        expect(log.includes(DREAM_RIM), id).toBe(look.dark);
        for (const mark of look.marks) expect(log, `${id} ${mark}`).toContain(mark);
      }
      expect(icon, id).toContain(PAINT_SHELL_FILL);
    }
  });

  it('pins the two Paint shell icons and swatches as authored, so they change only on purpose', () => {
    for (const size of SIZES) {
      for (const slug of TRENCH_SHELL_SLUGS) expect(iconDigest(slug, size), `${slug} ${size}`).toBe(TRENCH_SHELL_DIGESTS[slug][size]);
    }
    expect(swatchDigest('pitch-black'), 'pitch-black swatch').toBe(PITCH_BLACK_SWATCH_DIGEST);
    expect(swatchDigest('trench-shine'), 'trench-shine swatch').toBe(TRENCH_SHINE_SWATCH_DIGEST);
  });
});
