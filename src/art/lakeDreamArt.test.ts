import { describe, expect, it } from 'vitest';
import { MORPH_LOOK_IDS } from './drawMorphs';
import { dreamSeparationFailures } from './dreamSeparation';
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
} from './palette';
import { DREAM_SWATCH } from './treasurePalette';

const DREAM_IDS = Object.keys(DREAM_SLOTS) as DreamLookId[];
/** Guide 10 cue floor. */
const CUE_RATIO = 3;

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

/** OKLab chroma and hue angle in degrees of a #rrggbb colour. */
function measureOklabChromaHue(hex: string): [number, number] {
  const [, a, b] = oklabOf(hex);
  return [Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

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

/** Greyscale ratio (2 places) and OKLab difference (3 places) of `id` against every other Dream body. */
function measureSeparation(id: DreamLookId): Record<string, [number, number]> {
  const body = DREAM_SLOTS[id].body;
  return Object.fromEntries(
    DREAM_IDS.filter((other) => other !== id).map((other) => [
      other,
      [
        Number(contrastRatio(body, DREAM_SLOTS[other].body).toFixed(2)),
        Number(oklabDifference(body, DREAM_SLOTS[other].body).toFixed(3)),
      ],
    ]),
  );
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

describe('Open lake Dream colours (guide 3f, issue #214, ND-2)', () => {
  it('appends Tule green and Obsidian after every earlier Dream colour and before the Area 13 colours, both plain dark solids', () => {
    expect(DREAM_IDS.slice(-5)).toEqual(['lagoon-shine', 'tule-green', 'obsidian', 'pitch-black', 'trench-shine']);
    expect(DREAM_SWATCH['tule-green']).toEqual({ body: '#043d00', pattern: 'plain', marks: [], dark: true });
    expect(DREAM_SWATCH.obsidian).toEqual({ body: '#1f2925', pattern: 'plain', marks: [], dark: true });
  });

  it('gives Tule green the 3f mixes of its two picks, a deep green body under the 0.2 spot line, the white edge over 3:1, the eye ring and rim light', () => {
    const s = DREAM_SLOTS['tule-green'];
    expect([s.body, s.gillNearStem]).toEqual(['#043d00', '#f0c860']);
    expect([s.farSide, s.fin, s.belly, s.gillNearFilament, s.gillFarStem, s.gillFarFilament]).toEqual([
      '#093a0a',
      '#688b66',
      '#8ea88c',
      '#f3d483',
      '#dcb85e',
      '#e3c67f',
    ]);
    expectThreeFMixes('tule-green');
    // Guide 10 cue floor: a dark body, so the white edge reaches 3:1 or more and the ink does not (the rim light carries the outline).
    expect(contrastRatio(s.body, INK)).toBeCloseTo(1.15, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(12.55, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    // The morph eye bead is under 3:1 on the body, so the Dream eye ring carries it.
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(1.39, 2);
    expect(contrastRatio(s.body, DREAM_EYE_RING.colour)).toBeCloseTo(7.91, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(7.85, 2);
    expect(contrastRatio(s.farSide, s.gillFarStem)).toBeCloseTo(6.82, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.0336, 4);
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'tule-green').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Tule green apart from every other Dream colour, Plum by 1.5:1, Galaxy most closely in value and Obsidian in colour (PRD F15)', () => {
    const separation = measureSeparation('tule-green');
    expect(separation).toEqual({
      mint: [9.58, 0.587],
      'sky-blue': [8.21, 0.561],
      lavender: [7.95, 0.573],
      'sunset-orange': [7.93, 0.558],
      bubblegum: [7.95, 0.584],
      'midnight-blue': [1.27, 0.237],
      hearts: [10.98, 0.644],
      'tie-dye': [10.45, 0.629],
      iridescent: [8.35, 0.583],
      rainbow: [4.52, 0.47],
      galaxy: [1.07, 0.215],
      'tie-dye-galaxy': [1.12, 0.221],
      'lily-green': [10.18, 0.612],
      'firefly-gold': [8.85, 0.585],
      'poppy-red': [3.11, 0.405],
      plum: [2.02, 0.326],
      moonstone: [11.71, 0.672],
      chocolate: [1.34, 0.165],
      'crystal-shine': [3.71, 0.327],
      glowworm: [1.28, 0.191],
      jade: [6, 0.443],
      'fiesta-shine': [5.24, 0.525],
      olive: [3.41, 0.301],
      'lantern-shine': [4.1, 0.408],
      peach: [6.87, 0.537],
      'confetti-shine': [1.18, 0.308],
      marigold: [7.22, 0.535],
      'golden-hour-shine': [4.92, 0.412],
      lime: [6.42, 0.468],
      hyacinth: [3.9, 0.441],
      'lagoon-shine': [5.56, 0.451],
      obsidian: [1.19, 0.101],
      'pitch-black': [1.46, 0.16],
      'trench-shine': [3.32, 0.392],
    });
    expect(dreamSeparationFailures('tule-green')).toEqual([]);
    // It sits in the near-black window between Obsidian and Galaxy: hue tells Galaxy and Tie-dye galaxy apart (green
    // against blue-violet), and they also carry stars. Obsidian, the closest in colour, is darker and nearly grey.
    expect(sortIdsByGrey(separation).slice(0, 2)).toEqual(['galaxy', 'tie-dye-galaxy']);
    expect(sortIdsByColour(separation)[0]).toBe('obsidian');
    expect(relativeLuminance(DREAM_SLOTS['tule-green'].body)).toBeGreaterThan(relativeLuminance(DREAM_SLOTS.obsidian.body));
    expect(relativeLuminance(DREAM_SLOTS['tule-green'].body)).toBeLessThan(relativeLuminance(DREAM_SLOTS.galaxy.body));
  });

  it('gives Obsidian the 3f mixes of its two picks, a green-black body under the 0.2 spot line, the white edge over 3:1, the eye ring and rim light', () => {
    const s = DREAM_SLOTS.obsidian;
    expect([s.body, s.gillNearStem]).toEqual(['#1f2925', '#8fe8b4']);
    expect([s.farSide, s.fin, s.belly, s.gillNearFilament, s.gillFarStem, s.gillFarFilament]).toEqual([
      '#20282a',
      '#797f7c',
      '#9a9f9d',
      '#a8edc5',
      '#85d4aa',
      '#9eddbc',
    ]);
    expectThreeFMixes('obsidian');
    // Guide 10 cue floor: a dark body, so the white edge reaches 3:1 or more and the ink does not (the rim light carries the outline).
    expect(contrastRatio(s.body, INK)).toBeCloseTo(1.04, 2);
    expect(contrastRatio(s.body, WHITE)).toBeCloseTo(14.98, 2);
    expect(contrastRatio(s.body, WHITE)).toBeGreaterThanOrEqual(CUE_RATIO);
    // The morph eye bead is under 3:1 on the body, so the Dream eye ring carries it.
    expect(contrastRatio(s.body, MORPH_PALETTES.leucistic.eye)).toBeCloseTo(1.16, 2);
    expect(contrastRatio(s.body, DREAM_EYE_RING.colour)).toBeCloseTo(9.44, 2);
    expect(contrastRatio(s.body, s.gillNearStem)).toBeCloseTo(10.25, 2);
    expect(contrastRatio(s.farSide, s.gillFarStem)).toBeCloseTo(8.58, 2);
    expect(relativeLuminance(s.body)).toBeCloseTo(0.0201, 4);
    expect(dreamPalette(MORPH_PALETTES.leucistic, 'obsidian').extras).toEqual({
      spot: 'rgba(255,255,255,0.45)',
      rim: DREAM_RIM_LIGHT,
      eyeRing: DREAM_EYE_RING,
    });
  });

  it('keeps Obsidian apart from every other Dream colour, Plum by 1.5:1, Glowworm most closely in value and Pitch black and Tule green in colour (PRD F15)', () => {
    const separation = measureSeparation('obsidian');
    expect(separation).toEqual({
      mint: [11.43, 0.632],
      'sky-blue': [9.8, 0.592],
      lavender: [9.48, 0.594],
      'sunset-orange': [9.46, 0.595],
      bubblegum: [9.48, 0.603],
      'midnight-blue': [1.51, 0.189],
      hearts: [13.1, 0.687],
      'tie-dye': [12.46, 0.672],
      iridescent: [9.96, 0.606],
      rainbow: [5.4, 0.483],
      galaxy: [1.28, 0.153],
      'tie-dye-galaxy': [1.33, 0.16],
      'lily-green': [12.14, 0.666],
      'firefly-gold': [10.56, 0.637],
      'poppy-red': [3.71, 0.412],
      plum: [2.41, 0.295],
      moonstone: [13.97, 0.706],
      chocolate: [1.6, 0.162],
      'crystal-shine': [4.43, 0.367],
      glowworm: [1.07, 0.104],
      jade: [7.15, 0.494],
      'fiesta-shine': [6.26, 0.524],
      olive: [4.06, 0.359],
      'lantern-shine': [4.89, 0.441],
      peach: [8.2, 0.561],
      'confetti-shine': [1.41, 0.24],
      marigold: [8.61, 0.579],
      'golden-hour-shine': [5.87, 0.463],
      lime: [7.66, 0.533],
      hyacinth: [4.65, 0.434],
      'lagoon-shine': [6.64, 0.48],
      'tule-green': [1.19, 0.101],
      'pitch-black': [1.23, 0.08],
      'trench-shine': [3.97, 0.39],
    });
    expect(dreamSeparationFailures('obsidian')).toEqual([]);
    // It sits in the near-black window between Glowworm and Tule green: hue tells Glowworm apart (green-black against
    // night blue), and Glowworm also carries its glow dots. Tule green is a clear green, a step lighter. Pitch black
    // (Area 13, issue #215), the closest in colour, is a step darker and warm.
    expect(sortIdsByGrey(separation).slice(0, 2)).toEqual(['glowworm', 'tule-green']);
    expect(sortIdsByColour(separation).slice(0, 3)).toEqual(['pitch-black', 'tule-green', 'glowworm']);
    expect(relativeLuminance(DREAM_SLOTS.obsidian.body)).toBeGreaterThan(relativeLuminance(DREAM_SLOTS.glowworm.body));
  });

  it('tells Tule green and Obsidian apart by value and by chroma: a clear green against a green-black grey', () => {
    const [tuleChroma, tuleHue] = measureOklabChromaHue(DREAM_SLOTS['tule-green'].body);
    const [obsidianChroma, obsidianHue] = measureOklabChromaHue(DREAM_SLOTS.obsidian.body);
    expect(Number(tuleChroma.toFixed(3))).toBe(0.105);
    expect(Number(tuleHue.toFixed(1))).toBe(141.7);
    expect(Number(obsidianChroma.toFixed(3))).toBe(0.016);
    expect(Number(obsidianHue.toFixed(1))).toBe(168.8);
  });

  it('keep the Dream eye ring at 3:1 or more against both bodies over every real morph', () => {
    for (const morph of MORPH_LOOK_IDS) {
      for (const id of ['tule-green', 'obsidian'] as const) {
        const palette = axolotlPalette(morph, id);
        expect(palette.extras?.eyeRing, `${morph} + ${id}`).toEqual(DREAM_EYE_RING);
        expect(contrastRatio(DREAM_EYE_RING.colour, palette.body), `${morph} + ${id}`).toBeGreaterThanOrEqual(CUE_RATIO);
      }
    }
  });
});
