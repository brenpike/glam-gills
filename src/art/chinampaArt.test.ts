/**
 * Chinampa look, root tangle, garden plot bank, overhang, gap edge, ghost net, snag cue and water
 * hyacinth mat art (issues #76 and #103; guide 3c, 3g, 7a, 7b, 7e, 10), headless. The painters run against a recording context
 * and a stub Path2D, and the Phaser bake runs against a fake scene whose canvases record. No Phaser
 * is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHINAMPA_TEX,
  bakeChinampaTextures,
  ghostNetKey,
  ghostNetTexture,
} from './chinampaTextures';
import {
  AHUEJOTE_FOLIAGE,
  AHUEJOTE_STRAND,
  CHINAMPA_BANK_CAP_INSET,
  CHINAMPA_PLOT_TOP,
  CHINAMPA_SOIL,
  CHINAMPA_SOIL_RIDGE,
  CHINAMPA_STAKE,
  CHINAMPA_WEAVE,
  CORN_COB,
  CORN_LEAF,
  CORN_STALK,
  CORN_TASSEL,
  GAP_EDGE_BOTTOM_TEX,
  GAP_EDGE_FLARE,
  GAP_EDGE_FRINGE,
  GAP_EDGE_H,
  GAP_EDGE_TOP_TEX,
  GAP_EDGE_W,
  GHOST_NET_CELL,
  GHOST_NET_FLOAT,
  GHOST_NET_KNOT,
  GHOST_NET_MESH,
  GHOST_NET_PAD,
  GHOST_NET_ROPE,
  HYACINTH_FLOWER,
  HYACINTH_FLOWER_CENTRE,
  HYACINTH_LEAF,
  HYACINTH_LEAF_LIGHT,
  HYACINTH_MAT_H,
  HYACINTH_MAT_TEX,
  HYACINTH_MAT_W,
  HYACINTH_SHINE,
  LETTUCE_INNER,
  LETTUCE_OUTER,
  MARIGOLD_CENTRE,
  MARIGOLD_PETAL,
  OVERHANG_H,
  OVERHANG_SHADE_RGB,
  OVERHANG_SHADE_STOPS,
  OVERHANG_TEX,
  OVERHANG_W,
  SNAG_CUE_TEX,
  chinampaBankExtent,
  chinampaTreeXs,
  ghostNetTextureSize,
  paintBankOverhang,
  paintChinampaBank,
  paintChinampaBankRoots,
  paintGapEdge,
  paintGhostNet,
  paintHyacinthMat,
  paintSnagCue,
  ROOT_TANGLE_BARK,
  ROOT_TANGLE_BARK_LIGHT,
  ROOT_TANGLE_GRAIN,
  ROOT_TANGLE_H,
  ROOT_TANGLE_HOLLOW_PAD,
  ROOT_TANGLE_INTERIOR,
  ROOT_TANGLE_OPENING,
  ROOT_TANGLE_OUTLINE,
  ROOT_TANGLE_ROOTLET,
  ROOT_TANGLE_ROOTS,
  ROOT_TANGLE_SHINE,
  ROOT_TANGLE_TEX,
  ROOT_TANGLE_W,
  paintRootTangleBack,
  paintRootTangleFront,
} from './drawChinampa';
import { CAVE_H, CAVE_TEX, CAVE_W } from './drawFinds';
import { paintLogFront, paintRootArchFront } from './drawPond';
import { paintBackgroundChunk } from './drawScenery';
import { CHINAMPA_LAYOUT } from '../logic/chinampaLayout';
import { mulberry32 } from '../logic/rng';
import type { TexSize } from './canvasKit';
import { homeSpotInBottomRow } from '../scenes/HomeSpotView';
import {
  CHINAMPA_BED_BOTTOM,
  CHINAMPA_BED_LIP,
  CHINAMPA_BED_TOP,
  CHINAMPA_HAZE,
  CHINAMPA_MUD,
  CHINAMPA_SURFACE_LINE,
  CHINAMPA_WATER_DEEP,
  CHINAMPA_WATER_MID,
  CHINAMPA_WATER_SHALLOW,
  AREA_LOOK_IDS,
  HABITAT_LOOK_IDS,
  habitatLook,
  isHabitatLookId,
  type HabitatLook,
} from './habitatLook';
import {
  AXANTHIC,
  BANK_SOIL,
  COPPER,
  EYE,
  GRASS,
  GOLDEN_ALBINO,
  INK,
  LEUCISTIC,
  LW,
  MELANOID,
  PIEBALD,
  SKY_HORIZON,
  SKY_TOP,
  SOIL_DETAIL,
  SUN,
  SURF,
  VIEW_H,
  VIEW_W,
  TILAPIA_BELLY,
  TILAPIA_BODY,
  TILAPIA_FIN,
  WHITE,
  WHITE_ALBINO,
  WILD,
  WATER_GRADIENT_END_Y,
  WATER_STOP_MID,
} from './palette';

vi.mock('phaser', () => ({}));

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

/** Mix two colours in sRGB, as a canvas does for gradients and alpha: t = 0 is `a`. */
function mix(a: string, b: Rgb, t: number): string {
  const ca = channelsOf(a);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - t) + b[i] * t) as unknown as Rgb);
}

/** A colour with an `rgba(r,g,b,a)` overlay laid over it. */
function overlay(base: string, rgba: string): string {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(rgba);
  expect(m, rgba).not.toBeNull();
  return mix(base, [Number(m![1]), Number(m![2]), Number(m![3])], Number(m![4]));
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
    out.push(mix(c0, channelsOf(c1), u));
  }
  return out;
}

/** Hue in degrees, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** WCAG luminance floor of the pond contrast rule, which the chinampa look keeps: ink is 3:1 or better on any colour at or above it. */
const LUMINANCE_FLOOR = 0.1687;
const PAIR_FLOOR = 3;
const GRADIENT_SAMPLES = 40;

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

/** A linear gradient that remembers its stops. Its string form lists them, so a painted style tells gradients apart. */
class GradientStub {
  readonly stops: [number, string][] = [];
  addColorStop(t: number, colour: string): void {
    this.stops.push([t, colour]);
  }
  toString(): string {
    return `gradient(${this.stops.map(([t, c]) => `${t}:${c}`).join(',')})`;
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
  /** The gradient the fill was painted with, or null for a plain colour. */
  readonly gradient: GradientStub | null;
  /** The paint was made under a clip, so it may run past the texture frame on purpose. */
  readonly clipped: boolean;
}

/** A call on the context that changes state without painting, with its arguments (scale, clip, translate). */
interface StateCall {
  readonly name: string;
  readonly args: unknown[];
}

let stateCalls: StateCall[] = [];

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  stateCalls = [];
  /** Clips set at each save level: a paint under any of them is clipped. */
  const levels: number[] = [0];
  const clipped = (): boolean => levels.some((n) => n > 0);
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const styleOf = (target: Record<string, unknown>, name: string): { style: string; gradient: GradientStub | null } => {
    const value = name === 'fill' || name === 'fillRect' ? target.fillStyle : target.strokeStyle;
    return { style: String(value), gradient: value instanceof GradientStub ? value : null };
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => new GradientStub();
      return (...args: unknown[]) => {
        const path = args[0] as LogPath | undefined;
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          out.push({
            op: name,
            cmds: path.cmds,
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
            clipped: clipped(),
          });
        } else if (name === 'fillRect') {
          out.push({
            op: 'fill',
            cmds: [['fillRect', ...(args as number[])]],
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
            clipped: clipped(),
          });
        } else {
          if (name === 'save') levels.push(0);
          if (name === 'restore' && levels.length > 1) levels.pop();
          if (name === 'clip') levels[levels.length - 1]++;
          stateCalls.push({ name, args });
        }
      };
    },
    set: (target, key, value) => {
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

const strokes = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'stroke');
const fills = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'fill');
/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: Painted[]): string => JSON.stringify(painted.map((p) => [p.op, p.cmds, p.style, p.lineWidth]));

/** A fake scene that records every canvas texture created. */
function fakeScene(created: { key: string; w: number; h: number }[]): never {
  return {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string, w: number, h: number) => {
        created.push({ key, w, h });
        return {
          context: new Proxy(
            {},
            { get: (_target, key) => (key === 'createLinearGradient' ? () => new GradientStub() : () => undefined), set: () => true },
          ),
          refresh: () => undefined,
        };
      },
    },
  } as never;
}

// ---------------------------------------------------------------------------
// The look
// ---------------------------------------------------------------------------

describe('chinampa look (guide 3c, 7a)', () => {
  const look = habitatLook('chinampa');

  it('is a habitat look, listed after the pond and before the area variants', () => {
    expect(isHabitatLookId('chinampa')).toBe(true);
    expect([...HABITAT_LOOK_IDS]).toEqual(['canal', 'pond', 'chinampa', 'spring-cave']);
    expect(AREA_LOOK_IDS.indexOf('chinampa')).toBe(2);
    expect(look.id).toBe('chinampa');
  });

  it('is the documented derived values', () => {
    expect(look.water).toEqual({
      shallow: '#7ee8b8',
      mid: '#3dbf9e',
      deep: '#1e8676',
      stopMid: WATER_STOP_MID,
      gradientEndY: WATER_GRADIENT_END_Y,
    });
    expect([CHINAMPA_WATER_SHALLOW, CHINAMPA_WATER_MID, CHINAMPA_WATER_DEEP]).toEqual(['#7ee8b8', '#3dbf9e', '#1e8676']);
    expect(look.haze).toBe('rgba(70,200,160,0.12)');
    expect(look.haze).toBe(CHINAMPA_HAZE);
    expect(look.surfaceFill).toBe(CHINAMPA_WATER_SHALLOW);
    expect(look.surfaceLine).toBe('rgba(232,255,244,0.95)');
    expect(look.surfaceLine).toBe(CHINAMPA_SURFACE_LINE);
    expect(look.bed).toMatchObject({
      top: '#9aa268',
      bottom: '#7d8a54',
      lip: '#c9cf8e',
      mud: 'rgba(104,118,66,0.45)',
    });
    expect([CHINAMPA_BED_TOP, CHINAMPA_BED_BOTTOM, CHINAMPA_BED_LIP, CHINAMPA_MUD]).toEqual([
      look.bed.top,
      look.bed.bottom,
      look.bed.lip,
      look.bed.mud,
    ]);
  });

  it('says what its area needs, so no caller compares look ids', () => {
    expect(look.cave).toEqual({ kind: 'rootTangle', anchor: 'bed' });
    expect(look.stream).toBe(false);
    expect(look.pondProps).toBe(false);
    expect(look.firefliesPerScreen).toBe(0);
    expect(look.edgeReeds).toBeNull();
    expect(look.airWash).toBeNull();
    expect(look.rayAlphaScale).toBe(1);
    expect(look.sky).toEqual({ top: SKY_TOP, horizon: SKY_HORIZON });
    expect(look.bank).toBe('plots');
    expect(look.currentGap).toBe(true);
    expect(look.chinampaProps).toBe(true);
  });

  it('leaves the canal, the pond and the dusk pond with willow banks, no gap edges and no chinampa props', () => {
    for (const id of ['canal', 'pond', 'pond-dusk'] as const) {
      const other = habitatLook(id);
      expect(other.bank, id).toBe('willows');
      expect(other.currentGap, id).toBe(false);
      expect(other.chinampaProps, id).toBe(false);
    }
  });

  it('is a clear green-teal, cooler than the pond and greener than the canal, stop by stop', () => {
    const pond = habitatLook('pond');
    const canal = habitatLook('canal');
    expect(look.water.stopMid).toBe(pond.water.stopMid);
    expect(look.water.gradientEndY).toBe(pond.water.gradientEndY);
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      const h = hueOf(look.water[stop]);
      // Cooler than the pond: a higher hue than the pond's, and green-teal (150 to 175 degrees).
      expect(h, `${stop} against the pond`).toBeGreaterThan(hueOf(pond.water[stop]));
      expect(h).toBeGreaterThanOrEqual(150);
      expect(h).toBeLessThanOrEqual(175);
      // Still greener than the canal's aqua and blue.
      expect(h, `${stop} against the canal`).toBeLessThan(hueOf(canal.water[stop]));
    }
  });

  it('has a darker bottom row: the deep water and the bed bottom are the darkest stops', () => {
    const w = look.water;
    expect(luminance(w.shallow)).toBeGreaterThan(luminance(w.mid));
    expect(luminance(w.mid)).toBeGreaterThan(luminance(w.deep));
    expect(luminance(look.bed.bottom)).toBeLessThan(luminance(look.bed.top));
    expect(luminance(look.bed.top)).toBeLessThan(luminance(look.bed.lip));
  });

  it('has rich silt: many mud dots and few pebbles, like the pond', () => {
    expect(look.bed.mudCount).toBeGreaterThan(habitatLook('canal').bed.mudCount);
    expect(look.bed.pebbleCount).toBeLessThan(habitatLook('canal').bed.pebbleCount);
  });
});

// ---------------------------------------------------------------------------
// Contrast (guide 10, the pair method)
// ---------------------------------------------------------------------------

/** Every colour a cue object can sit on in the chinampa look, sampled: water, bed, haze over both, mud dots, the lip. */
function chinampaBackgrounds(): { name: string; hex: string }[] {
  const water = sampleGradient(
    [
      [0, chinampaLook().water.shallow],
      [chinampaLook().water.stopMid, chinampaLook().water.mid],
      [1, chinampaLook().water.deep],
    ],
    GRADIENT_SAMPLES,
  );
  const bed = sampleGradient(
    [
      [0, chinampaLook().bed.top],
      [1, chinampaLook().bed.bottom],
    ],
    GRADIENT_SAMPLES,
  );
  const out: { name: string; hex: string }[] = [];
  water.forEach((hex, i) =>
    out.push({ name: `water ${i}`, hex }, { name: `water ${i} with haze`, hex: overlay(hex, chinampaLook().haze) }),
  );
  bed.forEach((hex, i) =>
    out.push(
      { name: `bed ${i}`, hex },
      { name: `bed ${i} with haze`, hex: overlay(hex, chinampaLook().haze) },
      { name: `bed ${i} with mud`, hex: overlay(hex, chinampaLook().bed.mud) },
      { name: `bed ${i} with mud and haze`, hex: overlay(overlay(hex, chinampaLook().bed.mud), chinampaLook().haze) },
    ),
  );
  out.push({ name: 'bed lip', hex: chinampaLook().bed.lip });
  out.push({ name: 'surface fill', hex: chinampaLook().surfaceFill });
  return out;
}

function chinampaLook(): HabitatLook {
  return habitatLook('chinampa');
}

/** The cue fills whose pair with ink is under 9:1 or that are new (guide 10 table), by name. */
const CUE_FILLS: readonly (readonly [string, string])[] = [
  ['Leucistic body', LEUCISTIC.body],
  ['Wild body', WILD.body],
  ['Golden albino body', GOLDEN_ALBINO.body],
  ['White albino body', WHITE_ALBINO.body],
  ['Copper body', COPPER.body],
  ['Piebald body', PIEBALD.body],
  ['Axanthic body', AXANTHIC.body],
  ['Melanoid body', MELANOID.body],
  ['tilapia body', TILAPIA_BODY],
  ['tilapia fin', TILAPIA_FIN],
  ['tilapia belly', TILAPIA_BELLY],
  ['white', WHITE],
  ['sun yellow', SUN],
];

describe('chinampa contrast (guide 10, the pond contrast rule)', () => {
  const backgrounds = chinampaBackgrounds();

  it('samples more than the stops', () => {
    expect(backgrounds.length).toBeGreaterThan(200);
  });

  it('every background has luminance 0.1687 or more, so ink is 3:1 or better on it', () => {
    for (const { name, hex } of backgrounds) {
      expect(luminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('keeps each stop, the bed and the haze-lightened deep water over the floor on their own', () => {
    for (const hex of [chinampaLook().water.shallow, chinampaLook().water.mid, chinampaLook().water.deep, chinampaLook().bed.top, chinampaLook().bed.bottom, chinampaLook().bed.lip]) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
    // The haze lightens the deep stop and the bed bottom, so the rule holds under it too.
    expect(luminance(overlay(chinampaLook().water.deep, chinampaLook().haze))).toBeGreaterThan(luminance(chinampaLook().water.deep));
    expect(luminance(overlay(chinampaLook().bed.bottom, chinampaLook().haze))).toBeGreaterThan(luminance(chinampaLook().bed.bottom));
    expect(luminance(overlay(chinampaLook().water.mid, chinampaLook().haze))).toBeGreaterThan(luminance(chinampaLook().water.mid));
  });

  it.each(CUE_FILLS)('%s keeps 3:1 or more by the pair method on every chinampa background', (_name, fill) => {
    for (const { name, hex } of backgrounds) {
      const best = Math.max(contrast(INK, hex), contrast(fill, hex));
      expect(best, name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('documents the luminances and ratios the comments print', () => {
    const rows: readonly (readonly [string, string, number, number])[] = [
      ['water shallow', CHINAMPA_WATER_SHALLOW, 0.6561, 9.68],
      ['water mid', CHINAMPA_WATER_MID, 0.4072, 6.27],
      ['water deep', CHINAMPA_WATER_DEEP, 0.1863, 3.24],
      ['bed top', CHINAMPA_BED_TOP, 0.3371, 5.31],
      ['bed bottom', CHINAMPA_BED_BOTTOM, 0.2318, 3.86],
      ['bed lip', CHINAMPA_BED_LIP, 0.59, 8.77],
    ];
    for (const [name, hex, lum, ratio] of rows) {
      expect(luminance(hex).toFixed(4), name).toBe(lum.toFixed(4));
      expect(contrast(hex, INK).toFixed(2), name).toBe(ratio.toFixed(2));
    }
    const mudOnBottom = overlay(CHINAMPA_BED_BOTTOM, CHINAMPA_MUD);
    expect(mudOnBottom).toBe('#74814c');
    expect(luminance(mudOnBottom).toFixed(4)).toBe('0.1994');
    expect(luminance(overlay(mudOnBottom, CHINAMPA_HAZE)).toFixed(4)).toBe('0.2216');
    expect(luminance(overlay(CHINAMPA_WATER_DEEP, CHINAMPA_HAZE)).toFixed(4)).toBe('0.2113');
  });
});

// ---------------------------------------------------------------------------
// Root tangle: frame
// ---------------------------------------------------------------------------

/** A point of a cubic root at parameter t. */
function cubicPoint(spec: readonly number[], t: number): { x: number; y: number } {
  const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = spec;
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
    y: u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
  };
}

describe('root tangle frame', () => {
  it('is the cave frame: CAVE_W x CAVE_H to the ink edge, anchor at the base centre on the bed', () => {
    expect(ROOT_TANGLE_W).toBe(CAVE_W);
    expect(ROOT_TANGLE_H).toBe(CAVE_H);
    expect(ROOT_TANGLE_TEX).toEqual(CAVE_TEX);
    // Same anchor as the canal cave and the hollow log: the base centre, so the cave swap needs no offset.
    expect(ROOT_TANGLE_TEX.originX).toBe(ROOT_TANGLE_TEX.w / 2);
    expect(ROOT_TANGLE_TEX.h - ROOT_TANGLE_TEX.originY).toBe(2);
  });

  it('keeps the ink of every root inside the frame, so no outline is cut', () => {
    const left = -ROOT_TANGLE_TEX.originX;
    const right = ROOT_TANGLE_TEX.w - ROOT_TANGLE_TEX.originX;
    const top = -ROOT_TANGLE_TEX.originY;
    const bottom = ROOT_TANGLE_TEX.h - ROOT_TANGLE_TEX.originY;
    for (const spec of ROOT_TANGLE_ROOTS) {
      const reach = spec[8] / 2 + ROOT_TANGLE_OUTLINE;
      for (let i = 0; i <= 60; i++) {
        const { x, y } = cubicPoint(spec, i / 60);
        const label = JSON.stringify(spec);
        expect(x - reach, label).toBeGreaterThanOrEqual(left);
        expect(x + reach, label).toBeLessThanOrEqual(right);
        expect(y - reach, label).toBeGreaterThanOrEqual(top);
        expect(y + reach, label).toBeLessThanOrEqual(bottom);
      }
    }
  });

  it('covers the hollow edge all round with root colour or root ink', () => {
    const { halfW, sides, ry, floor } = ROOT_TANGLE_OPENING;
    const pad = ROOT_TANGLE_HOLLOW_PAD;
    // Sample the hollow's outline (with the back's pad) and find its nearest rim root centreline.
    const outline: { x: number; y: number }[] = [];
    for (let y = floor; y >= -sides; y -= 2) outline.push({ x: -halfW - pad, y }, { x: halfW + pad, y });
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI + (Math.PI * i) / 60;
      outline.push({ x: (halfW + pad) * Math.cos(a), y: -sides + (ry + pad) * Math.sin(a) });
    }
    const rims = ROOT_TANGLE_ROOTS.slice(0, 2);
    const samples = rims.flatMap((spec) => Array.from({ length: 121 }, (_, i) => cubicPoint(spec, i / 120)));
    for (const p of outline) {
      const nearest = Math.min(...samples.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
      // Half a rim root plus its ink: the hollow's edge is under the root, never bare water.
      expect(nearest, `${p.x.toFixed(0)},${p.y.toFixed(0)}`).toBeLessThanOrEqual(13 / 2 + ROOT_TANGLE_OUTLINE);
    }
  });
});

// ---------------------------------------------------------------------------
// Root tangle: painters
// ---------------------------------------------------------------------------

describe('root tangle painters', () => {
  const back = record(paintRootTangleBack);
  const front = record(paintRootTangleFront);

  it('paints the back as one flat cool near-black hollow: an arch with straight sides and an elliptical top', () => {
    expect(back).toHaveLength(1);
    expect(back[0].op).toBe('fill');
    expect(back[0].style).toBe(ROOT_TANGLE_INTERIOR);
    const names = back[0].cmds.map((c) => c[0]);
    expect(names).toContain('ellipse');
    expect(names).toContain('lineTo');
    expect(names[names.length - 1]).toBe('closePath');
  });

  it('paints the front as inked tubes: every root outlined in ink 2.6 a side, then rootlets 2 a side, no glow', () => {
    const inks = strokes(front).filter((s) => s.style === INK);
    // Eleven roots (2 rim, 2 outer, 4 crossing, 2 foot, plus the ones above) in two groups, and four rootlets.
    expect(inks.length).toBe(ROOT_TANGLE_ROOTS.length + 4);
    const widths = inks.map((s) => s.lineWidth);
    for (const spec of ROOT_TANGLE_ROOTS) expect(widths).toContain(spec[8] + 2 * ROOT_TANGLE_OUTLINE);
    expect(widths).toContain(3.4 + 2 * 2);
    // Ink first, then colour, in each group, so overlapping roots share no line.
    const order = strokes(front).map((s) => s.style);
    const firstBark = order.indexOf(ROOT_TANGLE_BARK);
    expect(order.slice(0, firstBark).every((s) => s === INK)).toBe(true);
    expect(order).toContain(ROOT_TANGLE_BARK_LIGHT);
    expect(order).toContain(ROOT_TANGLE_ROOTLET);
    expect(order).toContain(ROOT_TANGLE_GRAIN);
    expect(order).toContain(ROOT_TANGLE_SHINE);
    // Nothing is filled on the front: no soil mat, no glow.
    expect(fills(front)).toHaveLength(0);
  });

  it('is still: painting twice gives the same shapes, with no randomness', () => {
    expect(signature(record(paintRootTangleFront))).toBe(signature(front));
    expect(signature(record(paintRootTangleBack))).toBe(signature(back));
  });

  it('is a different silhouette from the hollow log and the dusk pond root arch', () => {
    const logFront = record((ctx) => paintLogFront(ctx, CAVE_W, CAVE_H));
    const archFront = record(paintRootArchFront);
    expect(signature(front)).not.toBe(signature(logFront));
    expect(signature(front)).not.toBe(signature(archFront));
    // A woven dome: crossing roots over the rim and no soil mat or end face.
    const bezierRoots = strokes(front).filter((s) => s.style === INK && s.cmds.some((c) => c[0] === 'bezierCurveTo'));
    expect(bezierRoots.length).toBe(ROOT_TANGLE_ROOTS.length);
  });
});

// ---------------------------------------------------------------------------
// Root tangle: greyscale (guide 10)
// ---------------------------------------------------------------------------

describe('root tangle greyscale cue', () => {
  const deepest = overlay(CHINAMPA_WATER_DEEP, CHINAMPA_HAZE);

  it('shows the hollow by value alone: the near-black is 3:1 or more against the roots', () => {
    expect(luminance(ROOT_TANGLE_INTERIOR)).toBeLessThan(0.01);
    expect(contrast(ROOT_TANGLE_BARK, ROOT_TANGLE_INTERIOR)).toBeGreaterThanOrEqual(3);
    expect(contrast(ROOT_TANGLE_BARK_LIGHT, ROOT_TANGLE_INTERIOR)).toBeGreaterThanOrEqual(3);
  });

  it('shows the hollow against the deepest chinampa water, haze included, and the bed', () => {
    expect(contrast(ROOT_TANGLE_INTERIOR, deepest)).toBeGreaterThanOrEqual(3);
    expect(contrast(ROOT_TANGLE_INTERIOR, CHINAMPA_BED_BOTTOM)).toBeGreaterThanOrEqual(3);
    expect(contrast(ROOT_TANGLE_INTERIOR, CHINAMPA_BED_TOP)).toBeGreaterThanOrEqual(3);
  });

  it('shows the pale rootlets over the hollow at 7:1 or more, and keeps the root colours over the floor', () => {
    expect(contrast(ROOT_TANGLE_ROOTLET, ROOT_TANGLE_INTERIOR)).toBeGreaterThanOrEqual(7);
    // Scenery, but still held to the floor so ink reads at 3:1 on the roots.
    for (const hex of [ROOT_TANGLE_BARK, ROOT_TANGLE_BARK_LIGHT, ROOT_TANGLE_ROOTLET]) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('tells the crossing roots from the rim roots by value too, not by hue alone', () => {
    expect(luminance(ROOT_TANGLE_BARK_LIGHT)).toBeGreaterThan(luminance(ROOT_TANGLE_BARK));
    // The ink line between them carries the rest (ink 2.6 a side is 3.5 x the shape ink LW, drawn between the groups).
    expect(contrast(INK, ROOT_TANGLE_BARK)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(LW).toBe(3.5);
  });

  it('documents the luminances the comments print', () => {
    expect(luminance(ROOT_TANGLE_BARK).toFixed(4)).toBe('0.1714');
    expect(luminance(ROOT_TANGLE_BARK_LIGHT).toFixed(4)).toBe('0.2481');
    expect(luminance(ROOT_TANGLE_ROOTLET).toFixed(4)).toBe('0.4336');
    expect(luminance(ROOT_TANGLE_INTERIOR).toFixed(4)).toBe('0.0076');
  });
});

// ---------------------------------------------------------------------------
// Helpers for the new painters
// ---------------------------------------------------------------------------

const seeded = (seed: number): (() => number) => mulberry32(seed);

/** The (x, y) points a recorded path visits; an ellipse counts as the two corners of its bounding box. */
function pointsOf(cmds: readonly Cmd[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const [name, ...a] of cmds) {
    if (name === 'moveTo' || name === 'lineTo') pts.push({ x: a[0], y: a[1] });
    else if (name === 'quadraticCurveTo') pts.push({ x: a[2], y: a[3] });
    else if (name === 'bezierCurveTo') pts.push({ x: a[4], y: a[5] });
    else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = a;
      const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
      const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
      pts.push({ x: cx - hx, y: cy - hy }, { x: cx + hx, y: cy + hy });
    }
  }
  return pts;
}

/**
 * Every unclipped paint of `painted` keeps its path and half its stroke inside `tex`, so no ink is cut by the
 * texture edge. `flipY` mirrors y first, for a painter that scales the context by (1, -1).
 */
function expectInsideFrame(painted: readonly Painted[], tex: TexSize, flipY = false): void {
  const left = -tex.originX;
  const right = tex.w - tex.originX;
  const top = -tex.originY;
  const bottom = tex.h - tex.originY;
  for (const p of painted) {
    if (p.clipped) continue;
    const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
    for (const pt of pointsOf(p.cmds)) {
      const y = flipY ? -pt.y : pt.y;
      const label = `${p.op} ${p.style} ${JSON.stringify(pt)}`;
      expect(pt.x - half, label).toBeGreaterThanOrEqual(left);
      expect(pt.x + half, label).toBeLessThanOrEqual(right);
      expect(y - half, label).toBeGreaterThanOrEqual(top);
      expect(y + half, label).toBeLessThanOrEqual(bottom);
    }
  }
}

const styleSet = (painted: readonly Painted[]): Set<string> => new Set(painted.map((p) => p.style));

/** Every colour and luminance the new scenery and props add, by name. All are held to the luminance floor where they meet ink. */
const NEW_FILLS: readonly (readonly [string, string, number])[] = [
  ['garden soil', CHINAMPA_SOIL, 0.1957],
  ['soil ridge', CHINAMPA_SOIL_RIDGE, 0.2523],
  ['wattle stake', CHINAMPA_STAKE, 0.5861],
  ['wattle weave', CHINAMPA_WEAVE, 0.3535],
  ['corn stalk', CORN_STALK, 0.4043],
  ['corn leaf', CORN_LEAF, 0.5042],
  ['corn cob', CORN_COB, 0.6771],
  ['corn tassel', CORN_TASSEL, 0.5578],
  ['marigold petal', MARIGOLD_PETAL, 0.4614],
  ['marigold centre', MARIGOLD_CENTRE, 0.2143],
  ['lettuce outer', LETTUCE_OUTER, 0.686],
  ['lettuce heart', LETTUCE_INNER, 0.5366],
  ['ahuejote foliage', AHUEJOTE_FOLIAGE, 0.4051],
  ['ahuejote strand', AHUEJOTE_STRAND, 0.2978],
  ['net mesh', GHOST_NET_MESH, 0.4908],
  ['net rope', GHOST_NET_ROPE, 0.2413],
  ['net knot', GHOST_NET_KNOT, 0.5765],
  ['net float', GHOST_NET_FLOAT, 0.7261],
  ['hyacinth leaf', HYACINTH_LEAF, 0.2963],
  ['hyacinth leaf plate', HYACINTH_LEAF_LIGHT, 0.5212],
  ['hyacinth flower', HYACINTH_FLOWER, 0.467],
  ['hyacinth flower centre', HYACINTH_FLOWER_CENTRE, 0.756],
];

// ---------------------------------------------------------------------------
// Garden plot bank and ahuejote roots (guide 7a, 7b)
// ---------------------------------------------------------------------------

describe('chinampa colours (guide 3g, 10)', () => {
  it.each(NEW_FILLS)('%s is at the luminance floor or more, so its ink outline is 3:1 or better', (_name, hex, lum) => {
    expect(luminance(hex).toFixed(4)).toBe(lum.toFixed(4));
    expect(luminance(hex)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('keeps the canal bank soil under the floor out of the chinampa: the garden soil is lighter', () => {
    expect(luminance(BANK_SOIL)).toBeLessThan(LUMINANCE_FLOOR);
    expect(luminance(CHINAMPA_SOIL)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });
});

describe('chinampa bank (guide 7a)', () => {
  const rec = (index: number, capLeft: boolean, capRight: boolean, seed = 5): Painted[] =>
    record((ctx) => paintChinampaBank(ctx, { index, capLeft, capRight, rand: seeded(seed) }));
  const bank = rec(1, true, true);

  it('rounds a capped end in 20 px from the chunk edge, like the overhang rects, and runs an open end past the edge', () => {
    expect(chinampaBankExtent({ capLeft: true, capRight: true })).toEqual({ x0: 20, x1: 460 });
    expect(chinampaBankExtent({ capLeft: false, capRight: false })).toEqual({ x0: -10, x1: VIEW_W + 10 });
    expect(CHINAMPA_BANK_CAP_INSET).toBe(20);
  });

  it('is the garden: soil, wattle stakes, and corn, marigolds and lettuce on top, with no canal soil, strata or grass cap', () => {
    const styles = styleSet(bank);
    for (const colour of [CHINAMPA_SOIL, CHINAMPA_STAKE, CHINAMPA_WEAVE, CORN_COB, CORN_LEAF, MARIGOLD_PETAL, MARIGOLD_CENTRE, LETTUCE_OUTER]) {
      expect(styles.has(colour), colour).toBe(true);
    }
    for (const colour of [BANK_SOIL, GRASS, SOIL_DETAIL]) expect(styles.has(colour), colour).toBe(false);
  });

  it('stands the crops on the plot top: every corn, marigold and lettuce is painted above the soil line plus its own height', () => {
    const cobs = bank.filter((p) => p.op === 'fill' && p.style === CORN_COB);
    const petals = bank.filter((p) => p.op === 'fill' && p.style === MARIGOLD_PETAL);
    const lettuce = bank.filter((p) => p.op === 'fill' && p.style === LETTUCE_OUTER);
    expect(cobs.length).toBeGreaterThanOrEqual(3);
    expect(petals.length).toBeGreaterThanOrEqual(3);
    expect(lettuce.length).toBeGreaterThanOrEqual(3);
    for (const p of [...cobs, ...petals, ...lettuce]) {
      for (const pt of pointsOf(p.cmds)) expect(pt.y).toBeLessThan(CHINAMPA_PLOT_TOP + 8);
    }
    // Corn is the tallest crop: its cobs sit higher than a lettuce does.
    const topOf = (ps: Painted[]): number => Math.min(...ps.flatMap((p) => pointsOf(p.cmds).map((pt) => pt.y)));
    expect(topOf(cobs)).toBeLessThan(topOf(lettuce));
  });

  it('keeps the crops inside the chunk, clear of the end of a capped plot', () => {
    const { x0, x1 } = chinampaBankExtent({ capLeft: true, capRight: true });
    for (const p of bank.filter((q) => q.op === 'fill' && [CORN_COB, MARIGOLD_PETAL, LETTUCE_OUTER].includes(q.style))) {
      for (const pt of pointsOf(p.cmds)) {
        expect(pt.x).toBeGreaterThan(x0);
        expect(pt.x).toBeLessThan(x1);
      }
    }
  });

  it('joins neighbouring plots: an open end paints the stakes on the same 16 px grid at the chunk seams', () => {
    const open = rec(2, false, false);
    const stakes = open.find((p) => p.op === 'stroke' && p.style === CHINAMPA_STAKE);
    expect(stakes).toBeDefined();
    const xs = stakes!.cmds.filter((c) => c[0] === 'moveTo').map((c) => c[1]);
    expect(xs[0]).toBe(8);
    expect(xs[xs.length - 1]).toBe(472);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBe(16);
    // 472 and the next chunk's first stake, 8 + 480, are 16 apart.
    expect(8 + VIEW_W - 472).toBe(16);
  });

  it('has two slim ahuejote trees, a tall narrow column unlike the canal willow crown, kept in from the ends', () => {
    expect(chinampaTreeXs({ capLeft: true, capRight: true })).toEqual([100, 380]);
    expect(chinampaTreeXs({ capLeft: false, capRight: false })).toEqual([100, 380]);
    const foliage = bank.find((p) => p.op === 'fill' && p.style === AHUEJOTE_FOLIAGE);
    expect(foliage).toBeDefined();
    const pts = pointsOf(foliage!.cmds);
    const xs = pts.map((pt) => pt.x);
    const ys = pts.map((pt) => pt.y);
    // Two columns, each narrower than 20 px and taller than 40 px.
    const first = pts.filter((pt) => pt.x < 240);
    expect(Math.max(...first.map((pt) => pt.x)) - Math.min(...first.map((pt) => pt.x))).toBeLessThan(20);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(40);
    expect(Math.min(...xs)).toBeGreaterThan(0);
  });

  it('draws only the crops from the random source, and a different chunk or seed grows a different garden', () => {
    expect(signature(rec(1, true, true))).toBe(signature(bank));
    expect(signature(rec(2, true, true))).not.toBe(signature(bank));
    expect(signature(rec(1, true, true, 6))).not.toBe(signature(bank));
    let draws = 0;
    record((ctx) =>
      paintChinampaBank(ctx, {
        index: 1,
        capLeft: true,
        capRight: true,
        rand: () => {
          draws++;
          return 0.5;
        },
      }),
    );
    // 7 specks of 3 draws each, then 3 per crop: a crop every 28 px between 46 and 434.
    const crops = Math.floor((434 - 46) / 28) + 1;
    expect(draws).toBe(7 * 3 + 3 * crops);
  });
});

describe('chinampa bank roots (guide 7a)', () => {
  const roots = record((ctx) => paintChinampaBankRoots(ctx, { capLeft: true, capRight: true }));

  it('hangs five roots under each of the two trees, thick red-brown tubes with pale rootlets, all reaching down', () => {
    const bark = strokes(roots).filter((p) => p.style === ROOT_TANGLE_BARK);
    expect(bark).toHaveLength(10);
    expect(strokes(roots).filter((p) => p.style === ROOT_TANGLE_ROOTLET)).toHaveLength(10);
    for (const p of strokes(roots)) {
      for (const pt of pointsOf(p.cmds)) expect(pt.y).toBeGreaterThanOrEqual(0);
    }
    expect(fills(roots)).toHaveLength(0);
  });

  it('is still, and the root painter reads no random source', () => {
    expect(signature(record((ctx) => paintChinampaBankRoots(ctx, { capLeft: true, capRight: true })))).toBe(signature(roots));
  });
});

describe('chinampa chunks (guide 7a)', () => {
  const chunk = (look: 'canal' | 'chinampa', row: 'top' | 'middle' | 'bottom', hasBank = true): Painted[] =>
    record((ctx) =>
      paintBackgroundChunk(ctx, {
        row,
        index: 1,
        hasSun: false,
        hasBank,
        bankCapLeft: true,
        bankCapRight: true,
        look,
        rand: seeded(3),
      }),
    );
  const water = (rec: Painted[]): number => rec.findIndex((p) => p.gradient !== null && p.gradient.stops.length === 3);

  it('paints the chinampa top row as garden plots and the canal top row as before: soil, grass and willows', () => {
    const garden = styleSet(chunk('chinampa', 'top'));
    const canal = styleSet(chunk('canal', 'top'));
    expect(garden.has(CHINAMPA_SOIL)).toBe(true);
    expect(garden.has(BANK_SOIL)).toBe(false);
    expect(garden.has(GRASS)).toBe(false);
    expect(canal.has(BANK_SOIL)).toBe(true);
    expect(canal.has(GRASS)).toBe(true);
    expect(canal.has(CHINAMPA_SOIL)).toBe(false);
  });

  it('puts the roots in the water: painted after the water and the rays, ten of them under the two trees', () => {
    const rec = chunk('chinampa', 'top');
    const at = water(rec);
    expect(at).toBeGreaterThan(-1);
    const after = rec.slice(at).filter((p) => p.op === 'stroke' && p.style === ROOT_TANGLE_BARK);
    expect(after).toHaveLength(10);
    // The trunks are painted before the water, with the bank.
    const before = rec.slice(0, at).filter((p) => p.op === 'stroke' && p.style === ROOT_TANGLE_BARK);
    expect(before.length).toBeGreaterThan(0);
  });

  it('paints no bank and no roots on a chunk without one', () => {
    const styles = styleSet(chunk('chinampa', 'top', false));
    for (const colour of [CHINAMPA_SOIL, CHINAMPA_STAKE, ROOT_TANGLE_BARK, CORN_COB]) expect(styles.has(colour), colour).toBe(false);
  });

  it('has a darker bottom row with no seam: the top row ends on the deep stop, and the middle and bottom rows start on it', () => {
    const look = habitatLook('chinampa');
    const top = chunk('chinampa', 'top');
    const stops = top[water(top)].gradient!.stops;
    expect(stops[stops.length - 1]).toEqual([1, look.water.deep]);
    expect(WATER_GRADIENT_END_Y).toBeLessThanOrEqual(VIEW_H);
    for (const row of ['middle', 'bottom'] as const) {
      const rec = chunk('chinampa', row);
      expect(rec[0].cmds[0][0]).toBe('fillRect');
      expect(rec[0].style).toBe(look.water.deep);
    }
    expect(luminance(look.water.deep)).toBeLessThan(luminance(look.water.mid));
    expect(luminance(look.water.deep)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(luminance(look.bed.bottom)).toBeLessThan(luminance(look.bed.top));
    expect(luminance(look.bed.bottom)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });
});

// ---------------------------------------------------------------------------
// The overhang under a bank (guide 7e)
// ---------------------------------------------------------------------------

/** The shade's alpha at local y (0 to OVERHANG_H), interpolated between its stops. */
function shadeAlphaAt(y: number): number {
  const t = y / OVERHANG_H;
  for (let k = 0; k < OVERHANG_SHADE_STOPS.length - 1; k++) {
    const [t0, a0] = OVERHANG_SHADE_STOPS[k];
    const [t1, a1] = OVERHANG_SHADE_STOPS[k + 1];
    if (t <= t1) return a0 + ((a1 - a0) * (t - t0)) / (t1 - t0);
  }
  return OVERHANG_SHADE_STOPS[OVERHANG_SHADE_STOPS.length - 1][1];
}

/** The clean chinampa water at world y, before haze. */
function waterAt(worldY: number): string {
  const { water } = habitatLook('chinampa');
  const t = Math.min(1, Math.max(0, (worldY - SURF) / (water.gradientEndY - SURF)));
  return sampleGradient(
    [
      [0, water.shallow],
      [water.stopMid, water.mid],
      [1, water.deep],
    ],
    1000,
  )[Math.round(t * 1000)];
}

describe('bank overhang (guide 7e)', () => {
  const art = record(paintBankOverhang);

  it('is the size of the zone rects: 440 x 60, anchored at the top-left corner', () => {
    for (const rect of CHINAMPA_LAYOUT.bankOverhangs ?? []) {
      expect(rect.x1 - rect.x0).toBe(OVERHANG_W);
      expect(rect.y1 - rect.y0).toBe(OVERHANG_H);
      expect(rect.x0 % VIEW_W).toBe(CHINAMPA_BANK_CAP_INSET);
      expect(rect.y0).toBe(SURF);
    }
    expect(OVERHANG_TEX.originX).toBe(4);
    expect(OVERHANG_TEX.originY).toBe(4);
    expect(OVERHANG_TEX.w).toBe(OVERHANG_W + 8);
    expect(OVERHANG_TEX.h).toBe(OVERHANG_H + 8);
  });

  it('keeps its ink inside the frame', () => {
    expectInsideFrame(art, OVERHANG_TEX);
  });

  it('shades the water first, then hangs the roots, then lays the soil lip over them: shade, curtain, rootlets, lip', () => {
    expect(art[0].gradient).not.toBeNull();
    expect(art[0].gradient!.stops).toEqual(
      OVERHANG_SHADE_STOPS.map(([t, a]) => [t, `rgba(${OVERHANG_SHADE_RGB.join(',')},${a})`]),
    );
    expect(strokes(art).filter((p) => p.style === ROOT_TANGLE_BARK)).toHaveLength(11);
    expect(strokes(art).filter((p) => p.style === ROOT_TANGLE_ROOTLET)).toHaveLength(11);
    const lip = fills(art).filter((p) => p.style === CHINAMPA_SOIL);
    expect(lip).toHaveLength(1);
    expect(art.indexOf(lip[0])).toBeGreaterThan(art.findIndex((p) => p.style === ROOT_TANGLE_ROOTLET));
    const last = art[art.length - 1];
    expect(last.op).toBe('stroke');
    expect(last.style).toBe(INK);
    // The edge is scalloped: quadratic curves along the lower edge.
    expect(last.cmds.filter((c) => c[0] === 'quadraticCurveTo').length).toBeGreaterThanOrEqual(10);
  });

  it('hides what is under the bank: nearly solid over the spots (y 16 to 44 of the rect), fading to nothing at the bottom', () => {
    for (let y = 16; y <= 44; y++) expect(shadeAlphaAt(y), `y ${y}`).toBeGreaterThanOrEqual(0.75);
    expect(shadeAlphaAt(0)).toBeGreaterThanOrEqual(0.85);
    expect(shadeAlphaAt(OVERHANG_H)).toBe(0);
    // Monotone down: a shade that only fades, so the bottom edge shows no band.
    for (let y = 1; y <= OVERHANG_H; y++) expect(shadeAlphaAt(y)).toBeLessThanOrEqual(shadeAlphaAt(y - 1));
  });

  it('is the deep chinampa water colour, so the shade never takes a background under the floor', () => {
    expect(toHex(OVERHANG_SHADE_RGB as unknown as Rgb)).toBe(CHINAMPA_WATER_DEEP);
    const haze = habitatLook('chinampa').haze;
    for (let y = 0; y <= OVERHANG_H; y++) {
      const bg = overlay(waterAt(SURF + y), `rgba(${OVERHANG_SHADE_RGB.join(',')},${shadeAlphaAt(y)})`);
      expect(luminance(bg), `shade y ${y}`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(luminance(overlay(bg, haze)), `shade and haze y ${y}`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, bg), `ink y ${y}`).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  }, 30_000);

  it('reads as a dark band by value alone, 3:1 or better against the open water below it at the hidden spots', () => {
    const under = overlay(waterAt(SURF + 30), `rgba(${OVERHANG_SHADE_RGB.join(',')},${shadeAlphaAt(30)})`);
    expect(contrast(waterAt(SURF + 60), under)).toBeGreaterThanOrEqual(1.15);
    expect(luminance(under)).toBeLessThan(luminance(waterAt(SURF + 60)));
    expect(contrast(CHINAMPA_SOIL, INK)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });
});

// ---------------------------------------------------------------------------
// The gap between two chinampas (guide 7b)
// ---------------------------------------------------------------------------

describe('gap edges (guide 7b)', () => {
  const bottom = record((ctx) => paintGapEdge(ctx, 'bottom'));
  const bottomCalls = [...stateCalls];
  const top = record((ctx) => paintGapEdge(ctx, 'top'));
  const topCalls = [...stateCalls];

  it('is sized from the current rect: its width plus a 40 px flare each side', () => {
    const current = CHINAMPA_LAYOUT.currents[0];
    expect(current.x1 - current.x0 + 2 * GAP_EDGE_FLARE).toBe(GAP_EDGE_W);
  });

  it('mirrors the top edge: it scales the context by (1, -1), the bottom edge does not', () => {
    expect(topCalls.some((c) => c.name === 'scale' && c.args[0] === 1 && c.args[1] === -1)).toBe(true);
    expect(bottomCalls.some((c) => c.name === 'scale')).toBe(false);
    expect(signature(top)).toBe(signature(bottom));
  });

  it('anchors both on the face line: the top body hangs above it, the bottom body sits below it, roots reach into the gap', () => {
    expect(GAP_EDGE_TOP_TEX.originY).toBe(GAP_EDGE_H + 4);
    expect(GAP_EDGE_BOTTOM_TEX.originY).toBe(GAP_EDGE_FRINGE + 4);
    expect(GAP_EDGE_TOP_TEX.w).toBe(GAP_EDGE_W + 8);
    expect(GAP_EDGE_BOTTOM_TEX.w).toBe(GAP_EDGE_W + 8);
    expect(GAP_EDGE_TOP_TEX.originX).toBe(GAP_EDGE_W / 2 + 4);
    expect(GAP_EDGE_TOP_TEX.h).toBe(GAP_EDGE_BOTTOM_TEX.h);
  });

  it('keeps its ink inside the frame, the bottom edge as painted and the top edge mirrored', () => {
    expectInsideFrame(bottom, GAP_EDGE_BOTTOM_TEX);
    expectInsideFrame(top, GAP_EDGE_TOP_TEX, true);
  });

  it('is a chinampa edge, not a log or a rock: garden soil, wattle stakes with a woven band, and streaming roots', () => {
    const styles = styleSet(bottom);
    for (const colour of [CHINAMPA_SOIL, CHINAMPA_SOIL_RIDGE, CHINAMPA_STAKE, CHINAMPA_WEAVE, ROOT_TANGLE_BARK]) {
      expect(styles.has(colour), colour).toBe(true);
    }
    expect(fills(bottom).filter((p) => p.style === CHINAMPA_SOIL)).toHaveLength(1);
  });

  it('streams its roots to the left, the way the current flows: every root ends left of where it starts', () => {
    const streamers = strokes(bottom).filter((p) => p.style === ROOT_TANGLE_BARK);
    expect(streamers).toHaveLength(5);
    for (const p of streamers) {
      const [move, curve] = p.cmds;
      expect(curve[3]).toBeLessThan(move[1]);
      // Reaching into the gap: above the face line for the bottom edge.
      expect(curve[4]).toBeLessThan(0);
      expect(-curve[4]).toBeLessThanOrEqual(GAP_EDGE_FRINGE);
    }
  });
});

// ---------------------------------------------------------------------------
// The ghost net (guide 3g, 10)
// ---------------------------------------------------------------------------

describe('ghost net (guide 3g, 10)', () => {
  const NET_SIZES: readonly (readonly [number, number])[] = [
    [60, 70],
    [50, 100],
    [60, 76],
  ];
  const nets = new Map(NET_SIZES.map(([w, h]) => [`${w}x${h}`, record((ctx) => paintGhostNet(ctx, w, h))]));
  const net = nets.get('60x70')!;
  const netCalls = (() => {
    record((ctx) => paintGhostNet(ctx, 60, 70));
    return [...stateCalls];
  })();

  it('is torn grey-green mesh: a diamond lattice of strands in two directions, ringed in ink', () => {
    const strands = strokes(net).slice(0, 4);
    expect(strands.map((p) => p.style)).toEqual([INK, INK, GHOST_NET_MESH, GHOST_NET_MESH]);
    for (const p of strands) expect(p.clipped).toBe(true);
    const [down, up] = strands.slice(2);
    for (const group of [down, up]) {
      expect(group.cmds.filter((c) => c[0] === 'moveTo').length).toBeGreaterThanOrEqual(6);
    }
    // One direction runs down and right, the other down and left.
    const dx = (group: Painted): number[] => {
      const moves = group.cmds.filter((c) => c[0] === 'moveTo');
      const lines = group.cmds.filter((c) => c[0] === 'lineTo');
      return lines.map((l, i) => l[1] - moves[i][1]);
    };
    expect(dx(down).every((v) => v > 0)).toBe(true);
    expect(dx(up).every((v) => v < 0)).toBe(true);
  });

  it('is cut off at a ragged edge with a rip through it: two outlines under an even-odd clip', () => {
    const clip = netCalls.find((c) => c.name === 'clip');
    expect(clip).toBeDefined();
    expect(clip!.args[1]).toBe('evenodd');
    const shape = clip!.args[0] as { cmds: Cmd[] };
    expect(shape.cmds.filter((c) => c[0] === 'closePath')).toHaveLength(2);
    expect(shape.cmds.filter((c) => c[0] === 'moveTo')).toHaveLength(2);
  });

  it('has knotted edges: a rope along the top and both sides, knots along it, and strands dangling from the tears', () => {
    const rope = strokes(net).filter((p) => p.style === GHOST_NET_ROPE);
    expect(rope).toHaveLength(3);
    const knots = fills(net).find((p) => p.style === GHOST_NET_KNOT && p.cmds.filter((c) => c[0] === 'ellipse').length >= 10);
    expect(knots).toBeDefined();
    const dangling = strokes(net).find((p) => p.style === GHOST_NET_MESH && !p.clipped);
    expect(dangling).toBeDefined();
    expect(dangling!.cmds.filter((c) => c[0] === 'quadraticCurveTo').length).toBeGreaterThanOrEqual(4);
  });

  it('floats on two floats from the top rope, so it hangs old and loose, anchored in place', () => {
    const floats = fills(net).find((p) => p.style === GHOST_NET_FLOAT);
    expect(floats).toBeDefined();
    expect(floats!.cmds.filter((c) => c[0] === 'ellipse')).toHaveLength(2);
  });

  it('paints only net colours and ink: no face, no body, nothing caught in it, never a trap (ADR 0007)', () => {
    const allowed = new Set([INK, GHOST_NET_MESH, GHOST_NET_ROPE, GHOST_NET_KNOT, GHOST_NET_FLOAT]);
    for (const [size, rec] of nets) {
      for (const style of styleSet(rec)) expect(allowed.has(style), `${size} ${style}`).toBe(true);
    }
  });

  it('leaves a rip wider than the mesh holes, so the net reads torn and loose', () => {
    const clip = netCalls.find((c) => c.name === 'clip')!.args[0] as { cmds: Cmd[] };
    const [, rip] = (() => {
      const moves = clip.cmds.map((c, i) => [c[0], i] as const).filter(([n]) => n === 'moveTo');
      return [clip.cmds.slice(moves[0][1], moves[1][1]), clip.cmds.slice(moves[1][1])];
    })();
    const pts = pointsOf(rip);
    const width = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    const height = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    const hole = GHOST_NET_CELL / Math.SQRT2;
    expect(width).toBeGreaterThan(hole * 1.5);
    expect(height).toBeGreaterThan(hole * 1.2);
  });

  it('draws each size differently and still, with no random source', () => {
    const sigs = new Set([...nets.values()].map(signature));
    expect(sigs.size).toBe(NET_SIZES.length);
    expect(signature(record((ctx) => paintGhostNet(ctx, 60, 70)))).toBe(signature(net));
  });

  it('keeps its ink inside the frame of its size, anchored at the rect centre', () => {
    for (const [w, h] of NET_SIZES) {
      const tex = ghostNetTextureSize(w, h);
      expectInsideFrame(nets.get(`${w}x${h}`)!, tex);
      expect(tex.originX).toBe(Math.ceil(w / 2 + GHOST_NET_PAD + 4));
      expect(tex.w - tex.originX).toBeGreaterThanOrEqual(w / 2 + GHOST_NET_PAD);
    }
  });
});

describe('ghost net greyscale cue (guide 10)', () => {
  const backgrounds = chinampaBackgrounds();

  it('reads the mesh by value: the strand is light (7:1 or more with ink) between dark ink lines, 3:1 or better against every chinampa background', () => {
    expect(contrast(GHOST_NET_MESH, INK)).toBeGreaterThanOrEqual(7);
    for (const { name, hex } of backgrounds) expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('holds the lattice open: the hole between strands is wider than the ink-ringed strand', () => {
    const strand = 3 + 2 * 1.2;
    const hole = GHOST_NET_CELL / Math.SQRT2 - strand;
    expect(hole).toBeGreaterThanOrEqual(6);
    expect(strand).toBeGreaterThanOrEqual(5);
  });

  it('tells the rope, the mesh and the knots apart by value, not hue: each step is 1.5:1 or more', () => {
    expect(contrast(GHOST_NET_MESH, GHOST_NET_ROPE)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(GHOST_NET_KNOT, GHOST_NET_ROPE)).toBeGreaterThanOrEqual(1.5);
    expect(luminance(GHOST_NET_ROPE)).toBeLessThan(luminance(GHOST_NET_MESH));
    expect(luminance(GHOST_NET_MESH)).toBeLessThan(luminance(GHOST_NET_KNOT));
    expect(luminance(GHOST_NET_KNOT)).toBeLessThan(luminance(GHOST_NET_FLOAT));
  });

  it('is grey-green: low saturation, a green-leaning hue between the water and grey', () => {
    for (const hex of [GHOST_NET_MESH, GHOST_NET_ROPE, GHOST_NET_KNOT, GHOST_NET_FLOAT]) {
      const [r, g, b] = channelsOf(hex);
      expect(g, hex).toBeGreaterThanOrEqual(r);
      expect(g, hex).toBeGreaterThanOrEqual(b);
      expect(Math.max(r, g, b) - Math.min(r, g, b), hex).toBeLessThanOrEqual(40);
      expect(hueOf(hex), hex).toBeGreaterThan(90);
      expect(hueOf(hex), hex).toBeLessThan(150);
    }
  });
});

// ---------------------------------------------------------------------------
// The snag cue (guide 3g, 10)
// ---------------------------------------------------------------------------

describe('snag cue (guide 3g, 10)', () => {
  const cue = record(paintSnagCue);

  it('is a 40 x 46 texture (about 33 x 39 to the ink edge), anchored on the bottom dot', () => {
    expect(SNAG_CUE_TEX.w).toBe(40);
    expect(SNAG_CUE_TEX.h).toBe(46);
    expect(SNAG_CUE_TEX.originX).toBe(20);
    expect(SNAG_CUE_TEX.originY).toBe(42);
    expect(SNAG_CUE_TEX.h - SNAG_CUE_TEX.originY).toBe(4);
  });

  it('keeps its ink inside the frame', () => {
    expectInsideFrame(cue, SNAG_CUE_TEX);
  });

  it('is a white thought bubble with two trailing dots, inked, holding a scrap of the net mesh and a knot', () => {
    expect(fills(cue).filter((p) => p.style === WHITE)).toHaveLength(3);
    for (const p of cue.filter((q) => q.op === 'stroke' && q.style === INK && !q.clipped)) {
      expect(p.lineWidth).toBeGreaterThanOrEqual(1.4);
    }
    const mesh = strokes(cue).filter((p) => p.style === GHOST_NET_MESH);
    expect(mesh).toHaveLength(2);
    for (const p of mesh) expect(p.clipped).toBe(true);
    expect(fills(cue).some((p) => p.style === GHOST_NET_KNOT)).toBe(true);
  });

  it('is a cue object that keeps 3:1 on every chinampa background: white and ink are 9:1 or more as a pair', () => {
    expect(contrast(WHITE, INK)).toBeGreaterThanOrEqual(9);
    for (const { name, hex } of chinampaBackgrounds()) {
      expect(Math.max(contrast(INK, hex), contrast(WHITE, hex)), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('is still and uses no random source', () => {
    expect(signature(record(paintSnagCue))).toBe(signature(cue));
  });
});

// ---------------------------------------------------------------------------
// The water hyacinth mats (issue #103; guide 3g, 7b, 10)
// ---------------------------------------------------------------------------

/** The hero's belly: no mat fill is lighter (guide 7c hierarchy). */
const MAT_HERO_BELLY = '#ffe3ed';

/** The ellipses of a recorded path as [cx, cy, rx, ry, rot], in order. */
function ellipsesOf(p: Painted): number[][] {
  return p.cmds.filter((c) => c[0] === 'ellipse').map((c) => c.slice(1) as number[]);
}

/** The bounding box of a rotated ellipse as [minX, minY, maxX, maxY]. */
function ellipseBounds([cx, cy, rx, ry, rot]: readonly number[]): [number, number, number, number] {
  const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
  const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
  return [cx - hx, cy - hy, cx + hx, cy + hy];
}

describe('water hyacinth mat colours (guide 3g, 10)', () => {
  it('keeps the plates lighter than the leaves and the flowers lighter than the leaves, by value, not hue alone', () => {
    expect(contrast(HYACINTH_LEAF_LIGHT, HYACINTH_LEAF)).toBeGreaterThanOrEqual(1.6);
    expect(contrast(HYACINTH_FLOWER, HYACINTH_LEAF)).toBeGreaterThanOrEqual(1.4);
    expect(contrast(HYACINTH_FLOWER_CENTRE, HYACINTH_FLOWER)).toBeGreaterThanOrEqual(1.5);
    expect(luminance(HYACINTH_LEAF_LIGHT)).toBeGreaterThan(luminance(HYACINTH_LEAF));
    expect(luminance(HYACINTH_FLOWER)).toBeGreaterThan(luminance(HYACINTH_LEAF));
  });

  it('is never lighter than the hero belly, so the axolotl stays the brightest thing on screen', () => {
    for (const hex of [HYACINTH_LEAF, HYACINTH_LEAF_LIGHT, HYACINTH_FLOWER, HYACINTH_FLOWER_CENTRE]) {
      expect(luminance(hex), hex).toBeLessThan(luminance(MAT_HERO_BELLY));
    }
  });

  it('documents the ratios with ink the comments print', () => {
    const rows: readonly (readonly [string, string, number])[] = [
      ['leaf', HYACINTH_LEAF, 4.75],
      ['leaf plate', HYACINTH_LEAF_LIGHT, 7.83],
      ['flower', HYACINTH_FLOWER, 7.09],
      ['flower centre', HYACINTH_FLOWER_CENTRE, 11.05],
    ];
    for (const [name, hex, ratio] of rows) expect(contrast(hex, INK).toFixed(2), name).toBe(ratio.toFixed(2));
  });

  it('keeps the gloss see-through, inside the silhouette', () => {
    const alpha = Number(/^rgba\(\d+,\d+,\d+,([\d.]+)\)$/.exec(HYACINTH_SHINE)![1]);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });
});

describe('water hyacinth mat frame (guide 7b)', () => {
  it('is 100 x 120 to the rect edge, anchored at the top-left corner of the rect with 4 px of padding, like the overhang', () => {
    expect(HYACINTH_MAT_W).toBe(100);
    expect(HYACINTH_MAT_H).toBe(120);
    expect(HYACINTH_MAT_TEX.originX).toBe(4);
    expect(HYACINTH_MAT_TEX.originY).toBe(4);
    expect(HYACINTH_MAT_TEX.w).toBe(HYACINTH_MAT_W + 8);
    expect(HYACINTH_MAT_TEX.h).toBe(HYACINTH_MAT_H + 8);
  });
});

describe.each(['upper', 'lower'] as const)('water hyacinth mat, %s (guide 7b, 10)', (side) => {
  const art = record((ctx) => paintHyacinthMat(ctx, side));
  const silhouette = art[1];

  it('keeps its ink inside the frame, with the 4 px of padding', () => {
    expectInsideFrame(art, HYACINTH_MAT_TEX);
  });

  it('is one scalloped, inked silhouette of round leaves: an ink outline 2 x LW wide outside the leaf fill, same path', () => {
    const outline = art[0];
    expect(outline.op).toBe('stroke');
    expect(outline.style).toBe(INK);
    expect(outline.lineWidth).toBe(2 * LW);
    expect(silhouette.op).toBe('fill');
    expect(silhouette.style).toBe(HYACINTH_LEAF);
    expect(silhouette.cmds).toEqual(outline.cmds);
    expect(ellipsesOf(silhouette)).toHaveLength(40);
    expect(new Set(silhouette.cmds.map((c) => c[0]))).toEqual(new Set(['moveTo', 'ellipse']));
  });

  it('keeps every leaf inside the rect and reaches within 2 px of all four sides, so what is drawn is what blocks', () => {
    const boxes = ellipsesOf(silhouette).map(ellipseBounds);
    const minX = Math.min(...boxes.map((b) => b[0]));
    const minY = Math.min(...boxes.map((b) => b[1]));
    const maxX = Math.max(...boxes.map((b) => b[2]));
    const maxY = Math.max(...boxes.map((b) => b[3]));
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(HYACINTH_MAT_W);
    expect(maxY).toBeLessThanOrEqual(HYACINTH_MAT_H);
    expect(minX).toBeLessThan(2);
    expect(minY).toBeLessThan(2);
    expect(HYACINTH_MAT_W - maxX).toBeLessThan(2);
    expect(HYACINTH_MAT_H - maxY).toBeLessThan(2);
  });

  it('scallops the channel edge: leaves along it touch it and dip between, within 3 px, so the edge is bumpy but the channel is not narrowed', () => {
    const edgeY = (box: readonly number[]): number => (side === 'lower' ? box[1] : HYACINTH_MAT_H - box[3]);
    const along = ellipsesOf(silhouette)
      .map(ellipseBounds)
      .filter((box) => edgeY(box) < 3);
    // one row of five leaves touches the channel edge
    expect(along).toHaveLength(5);
    for (const box of along) expect(edgeY(box)).toBeGreaterThanOrEqual(0);
  });

  it('paints glossy light plates on a third of the leaves, each inked 1.6 and with one shine, over the leaves', () => {
    const plates = fills(art).find((p) => p.style === HYACINTH_LEAF_LIGHT)!;
    expect(ellipsesOf(plates)).toHaveLength(14);
    const edge = strokes(art).find((p) => p.cmds === plates.cmds)!;
    expect(edge.style).toBe(INK);
    expect(edge.lineWidth).toBe(1.6);
    expect(art.indexOf(plates)).toBeGreaterThan(art.indexOf(silhouette));
    const gloss = fills(art).filter((p) => p.style === HYACINTH_SHINE);
    expect(gloss).toHaveLength(1);
    expect(ellipsesOf(gloss[0])).toHaveLength(14);
    // every plate is smaller than its leaf, so it sits inside it
    const leaves = ellipsesOf(silhouette);
    for (const [cx, cy, rx, ry] of ellipsesOf(plates)) {
      expect(leaves.some((l) => Math.abs(l[0] - cx) < 1e-9 && Math.abs(l[1] - cy) < 1e-9 && l[2] > rx && l[3] > ry)).toBe(true);
    }
  });

  it('has three lilac flowers, each a six-petal rosette with a sun-yellow centre, upright, near the channel edge and inside the rect', () => {
    const petals = fills(art).find((p) => p.style === HYACINTH_FLOWER)!;
    const centres = fills(art).find((p) => p.style === HYACINTH_FLOWER_CENTRE)!;
    expect(ellipsesOf(petals)).toHaveLength(18);
    const middles = ellipsesOf(centres);
    expect(middles).toHaveLength(3);
    for (const [cx, cy, rx, ry] of middles) {
      expect(rx).toBe(ry);
      expect(cx).toBeGreaterThan(8);
      expect(cx).toBeLessThan(HYACINTH_MAT_W - 8);
      // the half of the mat nearest the channel
      if (side === 'lower') expect(cy).toBeLessThan(HYACINTH_MAT_H / 2);
      else expect(cy).toBeGreaterThan(HYACINTH_MAT_H / 2);
    }
    for (const box of ellipsesOf(petals).map(ellipseBounds)) {
      expect(box[0]).toBeGreaterThanOrEqual(0);
      expect(box[2]).toBeLessThanOrEqual(HYACINTH_MAT_W);
      expect(box[1]).toBeGreaterThanOrEqual(0);
      expect(box[3]).toBeLessThanOrEqual(HYACINTH_MAT_H);
    }
    // the rosette's petals and centre are inked
    for (const colour of [HYACINTH_FLOWER, HYACINTH_FLOWER_CENTRE]) {
      const fill = fills(art).find((p) => p.style === colour)!;
      expect(strokes(art).some((p) => p.cmds === fill.cmds && p.style === INK)).toBe(true);
    }
  });

  it('paints only mat colours and ink: no face, no eye, no mouth, nothing alive that could look hurt or scary (ADR 0007)', () => {
    expect(styleSet(art)).toEqual(
      new Set([INK, HYACINTH_LEAF, HYACINTH_LEAF_LIGHT, HYACINTH_SHINE, HYACINTH_FLOWER, HYACINTH_FLOWER_CENTRE]),
    );
    expect(styleSet(art).has(EYE)).toBe(false);
    expect(styleSet(art).has(WHITE)).toBe(false);
  });

  it('is still: painting twice gives the same shapes, and the painter reads no random source', () => {
    expect(signature(record((ctx) => paintHyacinthMat(ctx, side)))).toBe(signature(art));
  });
});

describe('water hyacinth mats, upper against lower (guide 7b)', () => {
  const upper = record((ctx) => paintHyacinthMat(ctx, 'upper'));
  const lower = record((ctx) => paintHyacinthMat(ctx, 'lower'));

  it('are the same painting about the channel edge: every leaf of the upper mat is the lower mat\'s leaf mirrored in y, its tilt reversed', () => {
    const a = ellipsesOf(lower[1]);
    const b = ellipsesOf(upper[1]);
    expect(b).toHaveLength(a.length);
    a.forEach(([cx, cy, rx, ry, rot], i) => {
      expect(b[i][0]).toBeCloseTo(cx, 9);
      expect(b[i][1]).toBeCloseTo(HYACINTH_MAT_H - cy, 9);
      expect(b[i][2]).toBe(rx);
      expect(b[i][3]).toBe(ry);
      expect(b[i][4]).toBeCloseTo(-rot, 9);
    });
    expect(signature(upper)).not.toBe(signature(lower));
  });

  it('keeps the gloss on the upper left of every plate in both, so the light comes from above and the flowers stay upright', () => {
    for (const art of [upper, lower]) {
      const plates = ellipsesOf(fills(art).find((p) => p.style === HYACINTH_LEAF_LIGHT)!);
      const gloss = ellipsesOf(fills(art).find((p) => p.style === HYACINTH_SHINE)!);
      gloss.forEach(([gx, gy], i) => {
        expect(gx).toBeLessThan(plates[i][0]);
        expect(gy).toBeLessThan(plates[i][1]);
      });
    }
  });

  it('reads in greyscale as an inked, scalloped clump of round plates, against the water by its ink outline alone', () => {
    // the water the mat floats on, shallow to deep, never takes ink under 3:1 (the chinampa floor, guide 3c)
    for (const { hex } of chinampaBackgrounds()) expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(lower[0].lineWidth).toBe(2 * LW);
  });
});

// ---------------------------------------------------------------------------
// Home Spot row
// ---------------------------------------------------------------------------

describe('Home Spot burrow row', () => {
  it('puts a one-row area Home Spot, and a bottom-row Home Spot of a tall area, on the bed as before', () => {
    expect(homeSpotInBottomRow({ y: 200 }, 318)).toBe(true);
    expect(homeSpotInBottomRow({ y: 0 }, 318)).toBe(true);
    expect(homeSpotInBottomRow({ y: 400 }, 678)).toBe(true);
    expect(homeSpotInBottomRow({ y: 360 }, 678)).toBe(true);
  });

  it('puts the Home Spot of Area 4, top left in the top row, off the bed', () => {
    expect(homeSpotInBottomRow({ y: CHINAMPA_LAYOUT.start.y }, 678)).toBe(false);
    expect(homeSpotInBottomRow({ y: 359 }, 678)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

describe('bakeChinampaTextures', () => {
  const bake = (scale: number, ghostNetSizes?: readonly { w: number; h: number }[]) => {
    const created: { key: string; w: number; h: number }[] = [];
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeChinampaTextures(fakeScene(created), scale, ghostNetSizes === undefined ? {} : { ghostNetSizes });
    return { art, created };
  };

  it('bakes the root tangle back and front under their own keys, in the cave frame', () => {
    const { art, created } = bake(2);
    expect(created.map((c) => c.key)).toEqual(expect.arrayContaining([CHINAMPA_TEX.rootTangleBack, CHINAMPA_TEX.rootTangleFront]));
    expect(new Set(created.map((c) => c.key)).size).toBe(created.length);
    for (const info of [art.rootTangle.back, art.rootTangle.front]) {
      expect(info.scale).toBe(2);
      expect(info.w).toBe(CAVE_TEX.w);
      expect(info.h).toBe(CAVE_TEX.h);
      expect(info.originX).toBe(CAVE_TEX.originX);
      expect(info.originY).toBe(CAVE_TEX.originY);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
      // The base is the bottom of the frame less the 2 px pad.
      expect(info.originNormY).toBeCloseTo(CAVE_TEX.originY / CAVE_TEX.h, 6);
    }
    expect(art.rootTangle.back.pxW).toBe(art.rootTangle.front.pxW);
    expect(art.rootTangle.back.pxH).toBe(art.rootTangle.front.pxH);
  });

  it('bakes the overhang, the two gap edges, the snag cue and the two hyacinth mats under fixed keys, and no ghost net unless asked', () => {
    const { art, created } = bake(2);
    expect(created.map((c) => c.key).sort()).toEqual(Object.values(CHINAMPA_TEX).sort());
    expect(art.ghostNets).toEqual({});
    const sizes = [
      [art.overhang, OVERHANG_TEX],
      [art.gapEdges.top, GAP_EDGE_TOP_TEX],
      [art.gapEdges.bottom, GAP_EDGE_BOTTOM_TEX],
      [art.snagCue, SNAG_CUE_TEX],
      [art.hyacinthMats.upper, HYACINTH_MAT_TEX],
      [art.hyacinthMats.lower, HYACINTH_MAT_TEX],
    ] as const;
    for (const [info, tex] of sizes) {
      expect(info.scale).toBe(2);
      expect(info.w).toBe(tex.w);
      expect(info.h).toBe(tex.h);
      expect(info.originX).toBe(tex.originX);
      expect(info.originY).toBe(tex.originY);
    }
    // The overhang's anchor is the top-left corner of the rect; the snag cue's is its bottom dot.
    expect(art.overhang.originNormX).toBeCloseTo(4 / OVERHANG_TEX.w, 6);
    expect(art.overhang.originNormY).toBeCloseTo(4 / OVERHANG_TEX.h, 6);
    expect(art.snagCue.originNormX).toBeCloseTo(0.5, 6);
    // Both hyacinth mats anchor at the top-left corner of the mat's rect, like the overhang.
    for (const info of [art.hyacinthMats.upper, art.hyacinthMats.lower]) {
      expect(info.originNormX).toBeCloseTo(4 / HYACINTH_MAT_TEX.w, 6);
      expect(info.originNormY).toBeCloseTo(4 / HYACINTH_MAT_TEX.h, 6);
    }
  });

  it('bakes the two hyacinth mats under their own keys, with no bake option needed', () => {
    const { art, created } = bake(2);
    expect(CHINAMPA_TEX.hyacinthMatUpper).toBe('chinampa-hyacinth-mat-upper');
    expect(CHINAMPA_TEX.hyacinthMatLower).toBe('chinampa-hyacinth-mat-lower');
    expect(art.hyacinthMats.upper.key).toBe('chinampa-hyacinth-mat-upper');
    expect(art.hyacinthMats.lower.key).toBe('chinampa-hyacinth-mat-lower');
    expect(created.filter((c) => c.key.startsWith('chinampa-hyacinth-mat-')).map((c) => c.key).sort()).toEqual([
      'chinampa-hyacinth-mat-lower',
      'chinampa-hyacinth-mat-upper',
    ]);
    // Asking for ghost nets changes nothing about the mats.
    expect(bake(2, [{ w: 60, h: 70 }]).art.hyacinthMats.upper.w).toBe(art.hyacinthMats.upper.w);
  });

  it('bakes one ghost net per distinct rect size, keyed by size, anchored at the rect centre', () => {
    const asked = [
      { w: 60, h: 70 },
      { w: 60, h: 70 },
      { w: 50, h: 100 },
    ];
    const { art, created } = bake(2, asked);
    expect(created.filter((c) => c.key.startsWith('chinampa-ghost-net-')).map((c) => c.key).sort()).toEqual([
      ghostNetKey(50, 100),
      ghostNetKey(60, 70),
    ]);
    expect(ghostNetKey(60, 70)).toBe('chinampa-ghost-net-60x70');
    expect(Object.keys(art.ghostNets).sort()).toEqual([ghostNetKey(50, 100), ghostNetKey(60, 70)]);
    for (const { w, h } of asked) {
      const info = ghostNetTexture(art, w, h);
      const tex = ghostNetTextureSize(w, h);
      expect(info.w).toBe(tex.w);
      expect(info.h).toBe(tex.h);
      expect(info.originX).toBe(tex.originX);
      expect(info.originY).toBe(tex.originY);
      // Centred across: the rect is symmetrical about the anchor.
      expect(tex.originX).toBe(tex.w - tex.originX);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
    }
    expect(() => ghostNetTexture(art, 10, 10)).toThrow(/no ghost net baked/);
  });
});
