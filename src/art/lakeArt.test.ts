/**
 * Open lake art (issue #211, Area 12; guide 2, 7a and 10), headless: the sky with Popocatepetl and
 * Iztaccihuatl, the streaming clouds, the water colours by depth band and the lakebed painter. The
 * painters run against a recording context and a stub Path2D (the same approach as
 * springCaveArt.test.ts): every fill and stroke is kept with the style and width it was painted under.
 * No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IZTACCIHUATL,
  LAKE_BED_FILLS,
  LAKE_DARK,
  LAKE_LIP,
  LAKE_LIP_H,
  LAKE_LIP_HIGHLIGHT,
  LAKE_LIP_SHADE,
  LAKE_LIP_UNDERLINE,
  LAKE_LUMINANCE_FLOOR,
  LAKE_MOUNTAIN_BASE_Y,
  LAKE_ROOT,
  LAKE_SILT_BOTTOM,
  LAKE_SILT_FLECK_DARK,
  LAKE_SILT_FLECK_LIGHT,
  LAKE_SILT_TOP,
  LAKE_SKY_BAND_BOTTOM,
  LAKE_SKY_FILLS,
  LAKE_SKY_HORIZON,
  LAKE_SKY_TOP,
  LAKE_SNOW,
  LAKE_SNOW_SHADE,
  LAKE_STONE,
  LAKE_STONE_DARK,
  LAKE_STONE_LIGHT,
  LAKE_STONE_SHINE,
  LAKE_VOLCANO_BODY,
  LAKE_VOLCANO_SHADE,
  LAKE_WATER_BANDS,
  POPOCATEPETL,
  STREAK_ROWS,
  lakeWaterBand,
  lakeWaterStops,
  mountainTop,
  paintLakeSky,
  paintLakeVolcanoes,
  paintLakebed,
  paintStreamingClouds,
  type LakeBand,
  type LakeRect,
} from './drawLake';
import { habitatLook } from './habitatLook';
import { INK, LEUCISTIC, LW, SURF, VIEW_W } from './palette';

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

function channelsOf(hex: string): Rgb {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

function toHex(c: Rgb): string {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** OKLCH chroma of a #rrggbb colour: how colourful it looks, whatever its lightness. */
function oklchChroma(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(a, bb);
}

function parseRgba(value: string): { rgb: Rgb; alpha: number } {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(value);
  expect(m, value).not.toBeNull();
  return { rgb: [Number(m![1]), Number(m![2]), Number(m![3])], alpha: Number(m![4]) };
}

/** A colour with an `rgba(r,g,b,a)` colour laid over it, as a canvas mixes it in sRGB. */
function overlay(base: string, rgba: string): string {
  const { rgb, alpha } = parseRgba(rgba);
  const ca = channelsOf(base);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - alpha) + rgb[i] * alpha) as unknown as Rgb);
}

/** Linear gradient stops sampled at `n + 1` points, interpolated in sRGB. */
function sampleGradient(stops: readonly (readonly [number, string])[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    const u = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = channelsOf(c0);
    const b = channelsOf(c1);
    out.push(toHex([0, 1, 2].map((j) => a[j] * (1 - u) + b[j] * u) as unknown as Rgb));
  }
  return out;
}

const FLOOR = LAKE_LUMINANCE_FLOOR;
const PAIR_FLOOR = 3;
const LIT_BANDS: readonly LakeBand[] = [1, 2];
const LATER_BANDS: readonly LakeBand[] = [3, 4];

// ---------------------------------------------------------------------------
// Recording context
// ---------------------------------------------------------------------------

type Cmd = [string, ...number[]];

class LogPath {
  readonly cmds: Cmd[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) =>
        key === 'cmds' ? target.cmds : (...args: number[]) => void target.cmds.push([String(key), ...args]),
    });
  }
}

class GradientStub {
  readonly stops: [number, string][] = [];
  constructor(readonly extent: readonly number[]) {}
  addColorStop(t: number, colour: string): void {
    this.stops.push([t, colour]);
  }
  toString(): string {
    return `linear(${this.stops.map(([t, c]) => `${t}:${c}`).join(',')})`;
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
  readonly gradient: GradientStub | null;
}

interface Recording {
  readonly painted: Painted[];
  /** Every method name called on the context. */
  readonly calls: Map<string, number>;
  /** Every value written to `lineJoin`. */
  readonly lineJoins: string[];
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function recordAll(paint: (ctx: CanvasRenderingContext2D) => void): Recording {
  vi.stubGlobal('Path2D', LogPath);
  const painted: Painted[] = [];
  const calls = new Map<string, number>();
  const lineJoins: string[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const styleOf = (target: Record<string, unknown>, name: string): { style: string; gradient: GradientStub | null } => {
    const value = name === 'fill' || name === 'fillRect' ? target.fillStyle : target.strokeStyle;
    return { style: String(value), gradient: value instanceof GradientStub ? value : null };
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...a: number[]) => new GradientStub(a);
      return (...args: unknown[]) => {
        calls.set(name, (calls.get(name) ?? 0) + 1);
        const path = args[0] as LogPath | undefined;
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          painted.push({ op: name, cmds: path.cmds, ...styleOf(target, name), lineWidth: target.lineWidth as number });
        } else if (name === 'fillRect') {
          painted.push({
            op: 'fill',
            cmds: [['fillRect', ...(args as number[])]],
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
          });
        }
      };
    },
    set: (target, key, value) => {
      if (String(key) === 'lineJoin') lineJoins.push(String(value));
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return { painted, calls, lineJoins };
}

const record = (paint: (ctx: CanvasRenderingContext2D) => void): Painted[] => recordAll(paint).painted;

afterEach(() => vi.unstubAllGlobals());

/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: Painted[]): string =>
  JSON.stringify(painted.map((p) => [p.op, p.cmds, p.style, p.op === 'stroke' ? p.lineWidth : 0]));

/** A small seeded rand (mulberry32): the painters take their randomness injected. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pt {
  x: number;
  y: number;
}

/** Every (x, y) a recorded path names, control points included; an ellipse counts as the corners of its bounding box. */
function pointsOf(cmds: readonly Cmd[]): Pt[] {
  const pts: Pt[] = [];
  for (const [name, ...a] of cmds) {
    if (name === 'moveTo' || name === 'lineTo') pts.push({ x: a[0], y: a[1] });
    else if (name === 'quadraticCurveTo') pts.push({ x: a[0], y: a[1] }, { x: a[2], y: a[3] });
    else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = a;
      const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
      const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
      pts.push({ x: cx - hx, y: cy - hy }, { x: cx + hx, y: cy + hy });
    } else if (name === 'fillRect') pts.push({ x: a[0], y: a[1] }, { x: a[0] + a[2], y: a[1] + a[3] });
  }
  return pts;
}

/** The bounding box of a painted path, grown by half its stroke width. */
function boxOf(p: Painted): { x0: number; y0: number; x1: number; y1: number } {
  const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
  const pts = pointsOf(p.cmds);
  return {
    x0: Math.min(...pts.map((q) => q.x)) - half,
    y0: Math.min(...pts.map((q) => q.y)) - half,
    x1: Math.max(...pts.map((q) => q.x)) + half,
    y1: Math.max(...pts.map((q) => q.y)) + half,
  };
}

const ellipses = (p: Painted): Cmd[] => p.cmds.filter((c) => c[0] === 'ellipse');

// ---------------------------------------------------------------------------
// Water by depth band
// ---------------------------------------------------------------------------

describe('lake water by depth band', () => {
  it('has four bands, 1 to 4, each readable by lakeWaterBand', () => {
    expect(LAKE_WATER_BANDS.map((b) => b.band)).toEqual([1, 2, 3, 4]);
    for (const b of LAKE_WATER_BANDS) expect(lakeWaterBand(b.band)).toBe(b);
    expect(LAKE_WATER_BANDS.filter((b) => b.lit).map((b) => b.band)).toEqual([1, 2]);
  });

  it('stops run at 0, the water mid stop and 1', () => {
    for (const b of LAKE_WATER_BANDS) {
      const stops = lakeWaterStops(b.band);
      expect(stops.map(([t]) => t)).toEqual([0, 0.45, 1]);
      expect(stops.map(([, c]) => c)).toEqual([b.shallow, b.mid, b.deep]);
    }
  });

  it.each(LIT_BANDS)('band %i: every stop and every sample of its gradient is at the luminance floor or more', (band) => {
    for (const hex of sampleGradient(lakeWaterStops(band), 40)) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(FLOOR);
      // The floor is the 3:1 ink rule.
      expect(contrast(hex, INK), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it.each(LIT_BANDS)('band %i: the haze only lightens, so every haze blend is over the floor too', (band) => {
    const w = lakeWaterBand(band);
    for (const stop of sampleGradient(lakeWaterStops(band), 40)) {
      const blended = overlay(stop, w.haze);
      expect(luminance(blended), `${stop} under ${w.haze}`).toBeGreaterThanOrEqual(luminance(stop));
      expect(luminance(blended), blended).toBeGreaterThanOrEqual(FLOOR);
    }
  });

  it('band 1 is sunlit blue-green and band 2 is dusky blue, dimmer than band 1 at every stop', () => {
    const b1 = lakeWaterBand(1);
    const b2 = lakeWaterBand(2);
    // Green channel above blue in band 1's deep stop is not needed; the band 1 hue sits between green and blue (HSL 170 to 200).
    for (const hex of [b1.shallow, b1.mid, b1.deep]) {
      const [r, g, b] = channelsOf(hex);
      expect(g, hex).toBeGreaterThan(r);
      expect(b, hex).toBeGreaterThanOrEqual(g - 20);
      expect(Math.abs(g - b), hex).toBeLessThan(40);
    }
    // Band 2 is bluer: blue clearly over green.
    for (const hex of [b2.shallow, b2.mid, b2.deep]) {
      const [, g, b] = channelsOf(hex);
      expect(b - g, hex).toBeGreaterThanOrEqual(30);
    }
    expect(luminance(b2.shallow)).toBeLessThan(luminance(b1.shallow));
    expect(luminance(b2.mid)).toBeLessThan(luminance(b1.mid));
    expect(luminance(b2.deep)).toBeLessThan(luminance(b1.deep));
    // Dim, never black: the deepest band 2 stop is the floor of the rule.
    expect(luminance(b2.deep).toFixed(4)).toBe('0.1897');
    expect(luminance(b2.deep)).toBeGreaterThan(FLOOR);
  });

  it('every band gets darker down its own gradient and band over band', () => {
    for (const b of LAKE_WATER_BANDS) {
      expect(luminance(b.shallow)).toBeGreaterThan(luminance(b.mid));
      expect(luminance(b.mid)).toBeGreaterThan(luminance(b.deep));
    }
    for (const band of [1, 2, 3] as const) {
      expect(luminance(lakeWaterBand(band).deep), `deep of ${band}`).toBeGreaterThan(luminance(lakeWaterBand((band + 1) as LakeBand).shallow) * 0.9);
      expect(luminance(lakeWaterBand(band).shallow)).toBeGreaterThan(luminance(lakeWaterBand((band + 1) as LakeBand).shallow));
    }
  });

  it('band 3 is dark indigo and band 4 near-black, both defined for later areas and neither pure black', () => {
    const [r3, g3, b3] = channelsOf(lakeWaterBand(3).mid);
    expect(b3).toBeGreaterThan(r3);
    expect(b3).toBeGreaterThan(g3);
    for (const band of LATER_BANDS) {
      expect(lakeWaterBand(band).lit).toBe(false);
      for (const hex of [lakeWaterBand(band).shallow, lakeWaterBand(band).mid, lakeWaterBand(band).deep]) {
        expect(hex).not.toBe('#000000');
        expect(luminance(hex), hex).toBeGreaterThan(0);
        expect(luminance(hex), hex).toBeLessThan(FLOOR);
      }
    }
    expect(luminance(lakeWaterBand(3).shallow)).toBeLessThan(luminance(lakeWaterBand(2).deep));
    expect(luminance(lakeWaterBand(4).shallow)).toBeLessThan(luminance(lakeWaterBand(3).deep));
    expect(luminance(lakeWaterBand(4).deep)).toBeLessThan(0.01);
  });

  it('the axolotl stays the brightest thing in the water: every lit stop is darker than the Leucistic belly', () => {
    const belly = luminance(LEUCISTIC.belly);
    for (const band of LIT_BANDS) {
      for (const hex of sampleGradient(lakeWaterStops(band), 20)) expect(luminance(hex)).toBeLessThan(belly);
    }
  });
});

// ---------------------------------------------------------------------------
// Sky and mountains
// ---------------------------------------------------------------------------

describe('lake sky', () => {
  it('paints one gradient over the sky band, from the sky top to the horizon', () => {
    const out = record(paintLakeSky);
    expect(out).toHaveLength(1);
    expect(out[0].cmds).toEqual([['fillRect', 0, 0, VIEW_W, LAKE_SKY_BAND_BOTTOM]]);
    expect(out[0].gradient?.stops).toEqual([
      [0, LAKE_SKY_TOP],
      [1, LAKE_SKY_HORIZON],
    ]);
    expect(LAKE_SKY_BAND_BOTTOM).toBe(SURF + 6);
  });

  it('every sky and mountain colour is at the luminance floor or more, so ink is 3:1 or better', () => {
    for (const hex of LAKE_SKY_FILLS) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(FLOOR);
      expect(contrast(hex, INK), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
    expect(luminance(LAKE_SKY_TOP).toFixed(4)).toBe('0.4143');
    expect(luminance(LAKE_SKY_HORIZON).toFixed(4)).toBe('0.7913');
  });

  it('the sky is lighter at the horizon than at the top, so it is wide and hazy', () => {
    expect(luminance(LAKE_SKY_HORIZON)).toBeGreaterThan(luminance(LAKE_SKY_TOP));
  });
});

describe('Popocatepetl and Iztaccihuatl', () => {
  // The chunk of world x 0 to 480 holds neither; find the chunks that hold each.
  const chunkOf = (m: { x: number }): number => Math.floor(m.x / VIEW_W) * VIEW_W;
  const popoChunk = chunkOf(POPOCATEPETL);
  const iztaChunk = chunkOf(IZTACCIHUATL);

  it('are small and pale on the horizon: far under a screen wide and under half the sky band tall', () => {
    expect(POPOCATEPETL.w).toBeLessThanOrEqual(100);
    expect(IZTACCIHUATL.w).toBeLessThanOrEqual(200);
    expect(POPOCATEPETL.h).toBeLessThanOrEqual(40);
    expect(IZTACCIHUATL.h).toBeLessThan(POPOCATEPETL.h);
    // Popocatepetl is the taller cone, Iztaccihuatl the longer ridge.
    expect(POPOCATEPETL.h).toBeGreaterThan(IZTACCIHUATL.h);
    expect(IZTACCIHUATL.w).toBeGreaterThan(POPOCATEPETL.w);
    // Iztaccihuatl lies to the left (north), Popocatepetl to the right, and they do not overlap.
    expect(IZTACCIHUATL.x + IZTACCIHUATL.w / 2).toBeLessThan(POPOCATEPETL.x - POPOCATEPETL.w / 2);
  });

  it('a chunk that neither reaches paints nothing', () => {
    expect(record((ctx) => paintLakeVolcanoes(ctx, 0))).toHaveLength(0);
    expect(record((ctx) => paintLakeVolcanoes(ctx, 8 * VIEW_W))).toHaveLength(0);
  });

  it('paint snow caps: the cone has a lit and a shaded snow band and a shaded flank', () => {
    const styles = record((ctx) => paintLakeVolcanoes(ctx, popoChunk)).map((p) => p.style);
    expect(styles).toContain(LAKE_VOLCANO_BODY);
    expect(styles).toContain(LAKE_VOLCANO_SHADE);
    expect(styles).toContain(LAKE_SNOW);
    expect(styles).toContain(LAKE_SNOW_SHADE);
  });

  it('paint the ridge with its own snow', () => {
    const out = record((ctx) => paintLakeVolcanoes(ctx, iztaChunk));
    expect(out.map((p) => p.style)).toContain(LAKE_SNOW);
    expect(out.map((p) => p.style)).toContain(LAKE_VOLCANO_BODY);
  });

  it('stay inside the sky band, in the chunk they are painted in and on the horizon, with only thin ink strokes', () => {
    const top = mountainTop(POPOCATEPETL);
    for (const chunk of [popoChunk, iztaChunk]) {
      const out = record((ctx) => paintLakeVolcanoes(ctx, chunk));
      expect(out.length).toBeGreaterThan(0);
      for (const p of out) {
        const b = boxOf(p);
        expect(b.y0, p.style).toBeGreaterThanOrEqual(top - 3);
        expect(b.y1, p.style).toBeLessThanOrEqual(LAKE_SKY_BAND_BOTTOM);
        if (p.op === 'stroke') {
          expect(p.style).toBe(INK);
          expect(p.lineWidth).toBeLessThan(LW);
        }
      }
    }
    expect(LAKE_MOUNTAIN_BASE_Y).toBeGreaterThan(SURF + 3);
    expect(LAKE_MOUNTAIN_BASE_Y).toBeLessThanOrEqual(LAKE_SKY_BAND_BOTTOM);
  });

  it('are painted in chunk coordinates: moving the chunk right by a screen moves the cone left by a screen', () => {
    const at = (chunk: number): number => {
      const out = record((ctx) => paintLakeVolcanoes(ctx, chunk));
      const cone = out.find((p) => p.op === 'stroke' && boxOf(p).x1 - boxOf(p).x0 < IZTACCIHUATL.w);
      expect(cone).toBeDefined();
      return boxOf(cone!).x0;
    };
    // Same mountains, chunk shifted by 100 px, as long as the cone still reaches both.
    expect(at(popoChunk) - at(popoChunk + 100)).toBeCloseTo(100, 6);
  });

  it('are drawn whole in both chunks when they cross a chunk edge', () => {
    const cone = (chunk: number): { x0: number; x1: number } => {
      // The chunk left of the cone also reaches the ridge; the cone is the narrow outline.
      const out = record((ctx) => paintLakeVolcanoes(ctx, chunk)).filter(
        (p) => p.op === 'stroke' && boxOf(p).x1 - boxOf(p).x0 < IZTACCIHUATL.w,
      );
      expect(out).toHaveLength(1);
      const b = boxOf(out[0]);
      return { x0: b.x0, x1: b.x1 };
    };
    // A chunk whose left edge is 20 px left of the cone's centre cuts the cone's left foot; one whose right edge is 20 px right of it cuts the right foot.
    const atLeftEdge = cone(POPOCATEPETL.x + 20);
    const atRightEdge = cone(POPOCATEPETL.x + 20 - VIEW_W);
    const half = POPOCATEPETL.w / 2;
    expect(atLeftEdge.x0).toBeLessThan(0);
    expect(atLeftEdge.x1 - atLeftEdge.x0).toBeGreaterThan(POPOCATEPETL.w);
    expect(atRightEdge.x1).toBeGreaterThan(VIEW_W);
    expect(atRightEdge.x1 - atRightEdge.x0).toBeCloseTo(atLeftEdge.x1 - atLeftEdge.x0, 6);
    expect(half).toBeGreaterThan(20);
  });

  it('draw no randomness: the same chunk gives the same pixels', () => {
    expect(signature(record((ctx) => paintLakeVolcanoes(ctx, popoChunk)))).toBe(
      signature(record((ctx) => paintLakeVolcanoes(ctx, popoChunk))),
    );
  });
});

// ---------------------------------------------------------------------------
// Streaming clouds
// ---------------------------------------------------------------------------

describe('streaming clouds', () => {
  const clouds = (seed: number): Painted[] => record((ctx) => paintStreamingClouds(ctx, seeded(seed)));

  it('paints one white cloud per row, outlined in ink and thinner than the hero outline', () => {
    const out = clouds(1);
    const fills = out.filter((p) => p.op === 'fill');
    expect(fills).toHaveLength(STREAK_ROWS.length);
    for (const f of fills) expect(f.style).toBe('#ffffff');
    const inks = out.filter((p) => p.op === 'stroke' && p.style === INK);
    expect(inks).toHaveLength(STREAK_ROWS.length);
    for (const s of inks) expect(s.lineWidth).toBeLessThan(2 * LW);
  });

  it('is deterministic for an injected rand, and moves with it', () => {
    expect(signature(clouds(7))).toBe(signature(clouds(7)));
    expect(signature(clouds(7))).not.toBe(signature(clouds(8)));
  });

  it('streams: each cloud has a long thin streak drawn out behind a round head', () => {
    for (const p of clouds(3).filter((q) => q.op === 'fill')) {
      const e = ellipses(p).map(([, , , rx, ry]) => rx / ry);
      // The head puff is round, the streak is at least ten times as long as it is high.
      expect(Math.min(...e)).toBeCloseTo(1, 6);
      expect(Math.max(...e)).toBeGreaterThanOrEqual(10);
      // The puffs run in a trail: the head is the right-most.
      const xs = ellipses(p).map((c) => c[1]);
      expect(xs[0]).toBe(Math.max(...xs));
    }
  });

  it('stays inside the sky, left to right, and above the volcano tops, for any rand', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 9, 11]) {
      for (const p of clouds(seed)) {
        const b = boxOf(p);
        expect(b.x0).toBeGreaterThanOrEqual(0);
        expect(b.x1).toBeLessThanOrEqual(VIEW_W);
        expect(b.y0).toBeGreaterThanOrEqual(0);
        expect(b.y1).toBeLessThan(mountainTop(POPOCATEPETL));
      }
    }
    for (const rand of [() => 0, () => 0.999999]) {
      for (const p of record((ctx) => paintStreamingClouds(ctx, rand))) {
        const b = boxOf(p);
        expect(b.x0).toBeGreaterThanOrEqual(0);
        expect(b.x1).toBeLessThanOrEqual(VIEW_W);
        expect(b.y1).toBeLessThan(mountainTop(POPOCATEPETL));
      }
    }
  });

  it('paints only round shapes: no straight edges', () => {
    for (const p of clouds(2)) {
      expect(p.cmds.every((c) => c[0] === 'moveTo' || c[0] === 'ellipse'), p.style).toBe(p.style !== 'rgba(207,238,255,0.9)');
    }
  });
});

// ---------------------------------------------------------------------------
// Lakebed
// ---------------------------------------------------------------------------

const RECTS: readonly LakeRect[] = [
  { x: 0, y: 200, w: 480, h: 160 },
  { x: 480, y: 280, w: 300, h: 80 },
  { x: 900, y: 120, w: 90, h: 240 },
  { x: 1000, y: 300, w: 40, h: 8 },
  { x: 1100, y: 330, w: 30, h: 4 },
];

describe('lakebed', () => {
  const bed = (rects: readonly LakeRect[], seed = 1): Recording => recordAll((ctx) => paintLakebed(ctx, rects, seeded(seed)));

  it('paints nothing for no rects, and nothing for an empty rect', () => {
    expect(bed([]).painted).toHaveLength(0);
    for (const r of [
      { x: 10, y: 10, w: 0, h: 50 },
      { x: 10, y: 10, w: 50, h: 0 },
      { x: 10, y: 10, w: -5, h: 50 },
      { x: 10, y: 10, w: 50, h: -5 },
    ]) {
      expect(bed([r]).painted).toHaveLength(0);
    }
  });

  it('is deterministic for an injected rand, and moves with it', () => {
    const sig = (seed: number): string => signature(bed(RECTS, seed).painted);
    expect(sig(5)).toBe(sig(5));
    expect(sig(5)).not.toBe(sig(6));
  });

  it('paints nothing outside the given rects, ink and stroke width included, and clips to each one', () => {
    for (const r of RECTS) {
      for (const seed of [1, 2, 3, 4]) {
        const rec = bed([r], seed);
        expect(rec.calls.get('clip')).toBe(1);
        expect(rec.painted.length).toBeGreaterThan(0);
        for (const p of rec.painted) {
          const b = boxOf(p);
          const label = `${p.op} ${p.style} in ${JSON.stringify(r)}`;
          expect(b.x0, label).toBeGreaterThanOrEqual(r.x);
          expect(b.x1, label).toBeLessThanOrEqual(r.x + r.w);
          expect(b.y0, label).toBeGreaterThanOrEqual(r.y);
          expect(b.y1, label).toBeLessThanOrEqual(r.y + r.h);
        }
      }
    }
    // Several rects together: still each paint belongs to one of them.
    for (const p of bed(RECTS).painted) {
      const b = boxOf(p);
      expect(
        RECTS.some((r) => b.x0 >= r.x && b.x1 <= r.x + r.w && b.y0 >= r.y && b.y1 <= r.y + r.h),
        `${p.op} ${p.style}`,
      ).toBe(true);
    }
  });

  it('puts a light lip on each rect top edge, flat across its whole width, so a ledge reads as a terrace', () => {
    const out = bed(RECTS).painted;
    for (const r of RECTS) {
      const lipH = Math.min(LAKE_LIP_H, r.h);
      const lip = out.find((p) => p.style === LAKE_LIP && p.cmds[0][1] === r.x && p.cmds[0][2] === r.y);
      expect(lip, JSON.stringify(r)).toBeDefined();
      expect(lip!.cmds).toEqual([['fillRect', r.x, r.y, r.w, lipH]]);
    }
    expect(LAKE_LIP_H).toBeGreaterThanOrEqual(4);
  });

  it('paints the lip after every other mark, so it lies on top and stones and roots never cover it', () => {
    const out = bed([RECTS[0]]).painted;
    const lipIndex = out.findIndex((p) => p.style === LAKE_LIP);
    const lastOther = out.reduce((n, p, i) => (p.style !== LAKE_LIP && p.style !== LAKE_LIP_HIGHLIGHT && p.style !== LAKE_LIP_UNDERLINE ? i : n), -1);
    expect(lipIndex).toBeGreaterThan(lastOther);
    // No stone starts above the lip's bottom; a root hangs from it, its top ink tucked under the lip.
    for (const p of out) {
      if (p.style === LAKE_STONE_SHINE || [LAKE_STONE, LAKE_STONE_DARK, LAKE_STONE_LIGHT].includes(p.style)) {
        expect(boxOf(p).y0).toBeGreaterThanOrEqual(RECTS[0].y + LAKE_LIP_H);
      }
      if (p.style === LAKE_ROOT || (p.op === 'stroke' && p.style === INK && p.lineWidth > 3)) {
        expect(boxOf(p).y0).toBeGreaterThanOrEqual(RECTS[0].y + LAKE_LIP_H - 3);
      }
    }
  });

  it('fills each rect with silt, a top to bottom gradient over the whole rect', () => {
    const out = bed(RECTS).painted;
    for (const r of RECTS) {
      const silt = out.find((p) => p.gradient !== null && p.cmds[0][1] === r.x && p.cmds[0][2] === r.y);
      expect(silt, JSON.stringify(r)).toBeDefined();
      expect(silt!.cmds).toEqual([['fillRect', r.x, r.y, r.w, r.h]]);
      expect(silt!.gradient!.extent).toEqual([0, r.y, 0, r.y + r.h]);
      expect(silt!.gradient!.stops).toEqual([
        [0, LAKE_SILT_TOP],
        [1, LAKE_SILT_BOTTOM],
      ]);
    }
  });

  it('lays smooth stones and tule roots on a big rect: round inked stones and curved roots, with silt flecks', () => {
    const out = bed([RECTS[0]]).painted;
    const stones = out.filter((p) => p.op === 'fill' && [LAKE_STONE, LAKE_STONE_DARK, LAKE_STONE_LIGHT].includes(p.style));
    expect(stones.length).toBeGreaterThanOrEqual(3);
    for (const s of stones) {
      expect(s.cmds.some((c) => c[0] === 'ellipse')).toBe(true);
      // Every stone has an ink outline of the same path.
      expect(out.some((p) => p.op === 'stroke' && p.style === INK && p.cmds === s.cmds)).toBe(true);
    }
    const roots = out.filter((p) => p.op === 'stroke' && p.style === LAKE_ROOT);
    expect(roots.length).toBeGreaterThanOrEqual(2);
    for (const root of roots) expect(root.cmds.some((c) => c[0] === 'quadraticCurveTo')).toBe(true);
    const flecks = out.filter((p) => p.style === LAKE_SILT_FLECK_DARK || p.style === LAKE_SILT_FLECK_LIGHT);
    expect(flecks).toHaveLength(2);
    expect(flecks[0].cmds.length).toBeGreaterThan(10);
  });

  it('keeps a small or thin rect to silt and lip: no stone or root where they would not fit', () => {
    const out = bed([{ x: 10, y: 10, w: 30, h: 5 }]).painted;
    expect(out.some((p) => [LAKE_STONE, LAKE_STONE_DARK, LAKE_STONE_LIGHT, LAKE_ROOT].includes(p.style))).toBe(false);
    expect(out.some((p) => p.style === LAKE_LIP)).toBe(true);
  });

  it('draws no text, no images, no sharp joins and no straight-edged marks', () => {
    const rec = bed(RECTS);
    for (const name of ['fillText', 'strokeText', 'measureText', 'drawImage', 'putImageData']) expect(rec.calls.has(name), name).toBe(false);
    expect(rec.lineJoins.filter((j) => j !== 'round')).toEqual([]);
    for (const p of rec.painted.filter((q) => !q.cmds.some((c) => c[0] === 'fillRect'))) {
      expect(p.cmds.some((c) => c[0] === 'lineTo'), `${p.op} ${p.style}`).toBe(false);
    }
  });

  it('uses only the bed colours and ink: no other opaque fill, no other line', () => {
    const allowed = new Set<string>([
      ...LAKE_BED_FILLS,
      LAKE_SILT_FLECK_DARK,
      LAKE_SILT_FLECK_LIGHT,
      LAKE_LIP_SHADE,
      LAKE_STONE_SHINE,
      LAKE_LIP_HIGHLIGHT,
      LAKE_LIP_UNDERLINE,
    ]);
    for (const p of bed(RECTS).painted) {
      if (p.gradient) continue;
      expect(p.op === 'stroke' ? [INK, LAKE_ROOT] : [...allowed], `${p.op} ${p.style}`).toContain(p.style);
    }
  });

  it('keeps all marks thin: scenery sits under the hero outline weight', () => {
    for (const p of bed(RECTS).painted.filter((q) => q.op === 'stroke')) expect(p.lineWidth).toBeLessThan(LW * 1.2);
  });

  it('keeps no state between calls: painting other rects in between does not change the result', () => {
    const a = signature(bed(RECTS, 3).painted);
    bed(RECTS, 9);
    expect(signature(bed(RECTS, 3).painted)).toBe(a);
  });
});

describe('lakebed colours', () => {
  it('every opaque bed fill is at the luminance floor or more, so ink is 3:1 or better', () => {
    for (const hex of LAKE_BED_FILLS) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(FLOOR);
      expect(contrast(hex, INK), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('every silt sample, with its flecks and the lip shade over it, is over the floor', () => {
    const silt = sampleGradient(
      [
        [0, LAKE_SILT_TOP],
        [1, LAKE_SILT_BOTTOM],
      ],
      40,
    );
    for (const hex of silt) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(FLOOR);
      for (const rgba of [LAKE_SILT_FLECK_DARK, LAKE_SILT_FLECK_LIGHT, LAKE_LIP_SHADE]) {
        const blended = overlay(hex, rgba);
        expect(luminance(blended), `${hex} under ${rgba}`).toBeGreaterThanOrEqual(FLOOR);
        expect(contrast(blended, INK), blended).toBeGreaterThanOrEqual(PAIR_FLOOR);
      }
    }
    expect(luminance(overlay(LAKE_SILT_BOTTOM, LAKE_SILT_FLECK_DARK)).toFixed(4)).toBe('0.1845');
  });

  it('the lip and its underside stay over the floor', () => {
    expect(luminance(overlay(LAKE_LIP, LAKE_LIP_UNDERLINE))).toBeGreaterThanOrEqual(FLOOR);
    expect(luminance(overlay(LAKE_LIP, LAKE_LIP_HIGHLIGHT))).toBeGreaterThanOrEqual(luminance(LAKE_LIP));
  });

  it('the lip is lighter than the silt, so the top edge reads in greyscale too', () => {
    expect(luminance(LAKE_LIP)).toBeGreaterThan(luminance(LAKE_SILT_TOP));
    expect(contrast(LAKE_LIP, LAKE_SILT_TOP)).toBeGreaterThanOrEqual(1.3);
  });

  it('the axolotl stays the brightest: every bed fill is darker than the Leucistic belly and less colourful than its body', () => {
    const belly = luminance(LEUCISTIC.belly);
    const bodyChroma = oklchChroma(LEUCISTIC.body);
    for (const hex of LAKE_BED_FILLS) {
      expect(luminance(hex), hex).toBeLessThan(belly);
      expect(oklchChroma(hex), hex).toBeLessThan(bodyChroma);
    }
  });

  it('keeps the exact documented luminances', () => {
    const lums: readonly (readonly [string, string])[] = [
      [LAKE_SILT_TOP, '0.3787'],
      [LAKE_SILT_BOTTOM, '0.2084'],
      [LAKE_STONE, '0.3272'],
      [LAKE_STONE_DARK, '0.2307'],
      [LAKE_STONE_LIGHT, '0.4487'],
      [LAKE_ROOT, '0.2740'],
      [LAKE_LIP, '0.5264'],
    ];
    for (const [hex, lum] of lums) expect(luminance(hex).toFixed(4), hex).toBe(lum);
  });
});

// ---------------------------------------------------------------------------
// Open lake still variant (issue #212, Area 13)
// ---------------------------------------------------------------------------

describe('open lake still variant (issue #212)', () => {
  const still = habitatLook('open-lake-still');
  const lake = habitatLook('open-lake');

  it('has an overcast grey-blue sky, every stop at the luminance floor or more', () => {
    expect(still.sky).toEqual({ top: '#8a9bad', horizon: '#c4ced8' });
    expect(luminance(still.sky.top).toFixed(4)).toBe('0.3186');
    expect(luminance(still.sky.horizon).toFixed(4)).toBe('0.6084');
    expect(luminance(still.sky.top)).toBeGreaterThanOrEqual(FLOOR);
    expect(luminance(still.sky.horizon)).toBeGreaterThanOrEqual(FLOOR);
    expect(luminance(still.sky.horizon)).toBeGreaterThan(luminance(still.sky.top));
  });

  it('lays a flat cool grey air wash, and the sky seen through it stays at the floor or more', () => {
    expect(still.airWash).toBe('rgba(140,150,160,0.16)');
    const top = overlay(still.sky.top, still.airWash!);
    const horizon = overlay(still.sky.horizon, still.airWash!);
    expect(top).toBe('#8a9aab');
    expect(horizon).toBe('#bbc5cf');
    expect(luminance(top)).toBeGreaterThanOrEqual(FLOOR);
    expect(luminance(horizon)).toBeGreaterThanOrEqual(FLOOR);
  });

  it('paints no streaming clouds, so the ordinary day clouds stand in the still air', () => {
    expect(still.streamingClouds).toBe(false);
    expect(lake.streamingClouds).toBe(false);
  });

  it('strikes the rays at half strength, white, at the day slant', () => {
    expect(still.rayAlphaScale).toBe(0.5);
    expect(lake.rayAlphaScale).toBe(1);
    expect(still.rayTint).toEqual(lake.rayTint);
    expect(still.raySlant).toBe(lake.raySlant);
  });

  it('is the open lake with only its id, sky, wash and ray strength changed, so the water stays by depth band', () => {
    expect({ ...still, id: 'open-lake', sky: lake.sky, airWash: lake.airWash, rayAlphaScale: lake.rayAlphaScale }).toEqual(lake);
  });

  it('exports LAKE_DARK as band 4 deep stop, near-black, and not held to the floor', () => {
    expect(LAKE_DARK).toBe('#04060f');
    expect(LAKE_DARK).toBe(lakeWaterBand(4).deep);
    expect(luminance(LAKE_DARK)).toBeLessThan(FLOOR);
  });
});
