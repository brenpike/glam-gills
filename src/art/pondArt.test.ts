/**
 * Pond look art (issue #75; guide 3c, 7a, 7b, 10), headless. The painters run against
 * a recording context and a stub Path2D (the same approach as predatorArt.test.ts, plus
 * linear gradients): every fill and stroke is kept with the style, width and alpha it
 * was painted under, every context call is logged, and the Phaser bakes run against a
 * fake scene whose canvases record. No Phaser is loaded.
 */
import { describe, expect, it, vi } from 'vitest';
import { CAVE_H, CAVE_TEX, CAVE_W } from './drawFinds';
import { CHEEK_HEART_ZONE, FAR_EYE_ZONE, NEAR_EYE_ZONE } from './drawAxolotlParts';
import {
  FIREFLY_BAND,
  FIREFLY_BODY,
  FIREFLY_GLOW,
  FIREFLY_HALO_INNER,
  FIREFLY_HALO_OUTER,
  FIREFLY_TEX,
  FIREFLY_WING,
  LOG_BARK,
  LOG_CUT,
  LOG_INTERIOR,
  PLASTIC_WORM_BLUE,
  PLASTIC_WORM_GLINT,
  PLASTIC_WORM_PINK,
  PLASTIC_WORM_TEX,
  QUEASY_CHEEKS_TEX,
  QUEASY_CHEEK_INNER,
  QUEASY_CHEEK_LOCAL,
  QUEASY_CHEEK_OUTER,
  ROOT_ARCH_ANCHOR_Y,
  ROOT_ARCH_H,
  ROOT_ARCH_INTERIOR,
  ROOT_ARCH_OPENING,
  ROOT_ARCH_TEX,
  ROOT_ARCH_W,
  ROOT_BARK,
  ROOT_MAT,
  ROOT_ROOTLET,
  ROOT_SHINE,
  logGeometry,
  logTextureSize,
  paintFirefly,
  paintLogBack,
  paintLogFront,
  paintPlasticWorm,
  paintQueasyCheeks,
  paintRootArchBack,
  paintRootArchFront,
  type PlasticWormColour,
} from './drawPond';
import { paintWorm } from './drawProps';
import {
  STREAM_BAND,
  STREAM_STONE_OVERFLOW,
  STREAM_TAPER,
  paintBackgroundChunk,
  streamColumnFor,
  type ChunkOptions,
} from './drawScenery';
import {
  AREA_LOOK_IDS,
  DUSK_AIR_WASH,
  DUSK_BED_BOTTOM,
  DUSK_BED_LIP,
  DUSK_BED_TOP,
  DUSK_HAZE,
  DUSK_MUD,
  DUSK_REED_LEAF,
  DUSK_REED_STALK,
  DUSK_REED_STALK_LIGHT,
  DUSK_SKY_HORIZON,
  DUSK_SKY_TOP,
  DUSK_SURFACE_LINE,
  DUSK_WATER_DEEP,
  DUSK_WATER_MID,
  DUSK_WATER_SHALLOW,
  POND_BED_BOTTOM,
  POND_BED_LIP,
  POND_BED_TOP,
  POND_CATTAIL,
  POND_HAZE,
  POND_MUD,
  POND_REED_LEAF,
  POND_REED_STALK,
  POND_REED_STALK_LIGHT,
  POND_SURFACE_LINE,
  POND_WATER_DEEP,
  POND_WATER_MID,
  POND_WATER_SHALLOW,
  HABITAT_LOOK_IDS,
  habitatLook,
  isAreaLookId,
  isHabitatLookId,
  type AreaLookId,
} from './habitatLook';
import { DEPTH } from './layers';
import {
  AXANTHIC,
  BANK_SOIL,
  BED_BOTTOM,
  BED_LIP,
  BED_TOP,
  COPPER,
  EYE,
  GOLDEN_ALBINO,
  HAZE,
  INK,
  LEUCISTIC,
  LW,
  MELANOID,
  MUD,
  PEBBLE_B,
  PEBBLE_COLOURS,
  PEBBLE_D,
  PEBBLE_E,
  PEBBLE_SHINE,
  PIEBALD,
  SKY_HORIZON,
  SKY_TOP,
  SOIL_DETAIL,
  SUN,
  SURF,
  SURFACE_LINE,
  SURFACE_LINE_WIDTH,
  TILAPIA_BELLY,
  TILAPIA_BODY,
  TILAPIA_FIN,
  VIEW_W,
  WATER_DEEP,
  WATER_GRADIENT_END_Y,
  WATER_MID,
  WATER_SHALLOW,
  WATER_STOP_MID,
  WHITE,
  WHITE_ALBINO,
  WILD,
} from './palette';
import { POND_TEX, bakePondTextures } from './pondTextures';
import { areaBgKey, areaDeepBgKey, bakeAreaScenery, type AreaSceneryOptions } from './textures';
import { POND_2_LAYOUT } from '../logic/pond2Layout';
import { POND_LAYOUT } from '../logic/pondLayout';

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
function relativeLuminance(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => {
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

/** Mix two colours in sRGB, as a canvas does for gradients and alpha: t = 0 is `a`. */
function mix(a: string, b: Rgb, t: number): string {
  const ca = channelsOf(a);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - t) + b[i] * t) as unknown as Rgb);
}

/** `rgba(r,g,b,a)` as its colour and alpha. */
function parseRgba(value: string): { rgb: Rgb; alpha: number } {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(value);
  expect(m, value).not.toBeNull();
  return { rgb: [Number(m![1]), Number(m![2]), Number(m![3])], alpha: Number(m![4]) };
}

/** A colour with an `rgba` overlay laid over it. */
function overlay(base: string, rgba: string): string {
  const { rgb, alpha } = parseRgba(rgba);
  return mix(base, rgb, alpha);
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

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

/** A Path2D stand-in that keeps its commands (nested paths inline). */
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

/** A linear gradient that remembers where it runs and its colour stops. */
interface Gradient {
  readonly kind: 'gradient';
  readonly coords: number[];
  readonly stops: [number, string][];
  addColorStop(offset: number, colour: string): void;
}

/** One draw call with the style it was painted under. */
interface Op {
  readonly op: string;
  readonly args: unknown[];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly globalAlpha: number;
}

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
  readonly gradients: Gradient[];
}

function plain(value: unknown): unknown {
  if (value instanceof LogPath) return value.cmds;
  if (value && typeof value === 'object' && (value as Gradient).kind === 'gradient') {
    const g = value as Gradient;
    return { gradient: g.coords, stops: g.stops };
  }
  return value;
}

/** A context that records every draw call and path call. Supports save, restore and linear gradients. */
function recordingContext(): Recording {
  const ops: Op[] = [];
  const calls: [string, unknown[]][] = [];
  const gradients: Gradient[] = [];
  let state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  const stack: Record<string, unknown>[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name) || name in state) return state[name];
        return (...args: unknown[]) => {
          if (name === 'save') {
            stack.push({ ...state });
            return undefined;
          }
          if (name === 'restore') {
            state = stack.pop() ?? state;
            return undefined;
          }
          if (name === 'createLinearGradient') {
            const g: Gradient = {
              kind: 'gradient',
              coords: args as number[],
              stops: [],
              addColorStop: (offset, colour) => void g.stops.push([offset, colour]),
            };
            gradients.push(g);
            calls.push([name, args]);
            return g;
          }
          calls.push([name, args.map(plain)]);
          if (DRAW_OPS.has(name)) {
            ops.push({
              op: name,
              args: args.map(plain),
              fillStyle: plain(state.fillStyle),
              strokeStyle: plain(state.strokeStyle),
              lineWidth: state.lineWidth as number,
              globalAlpha: state.globalAlpha as number,
            });
          }
          return undefined;
        };
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, calls, gradients };
}

/** Run `paint` with Path2D stubbed and return what it drew. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Recording {
  vi.stubGlobal('Path2D', LogPath);
  const rec = recordingContext();
  try {
    paint(rec.ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return rec;
}

/** A deterministic random source in [0, 1). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const chunk = (opts: Omit<ChunkOptions, 'rand'>, seed = 7): Recording =>
  record((ctx) => paintBackgroundChunk(ctx, { ...opts, rand: seeded(seed) }));

/** A 53-bit string hash (cyrb53), so no Node module is needed. */
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Fingerprint of every context call a recording saw, so a pixel-identical repaint gives the same string. */
function fingerprint(rec: Recording): string {
  return hashString(JSON.stringify(rec.calls));
}

/** {@link fingerprint} plus the fill, stroke, width and alpha every draw was painted under, so a colour change shows too. */
function styledFingerprint(rec: Recording): string {
  return hashString(JSON.stringify([rec.calls, rec.ops]));
}

/** The path commands of a recorded op. */
const cmdsOf = (op: Op): unknown[][] => op.args[0] as unknown[][];
const hasCmd = (op: Op, name: string): boolean => Array.isArray(op.args[0]) && cmdsOf(op).some((c) => c[0] === name);
/** The x of every translate that plants an edge reed: reed bases sit on the bed (y over 300), clear of the bed lip's (0, 4.5). */
const reedBaseXs = (rec: Recording): number[] =>
  rec.calls
    .filter(([name, args]) => name === 'translate' && (args[1] as number) > 300 && args[0] !== 0)
    .map(([, args]) => args[0] as number);
const ellipsesOf = (op: Op): number[][] => cmdsOf(op).filter((c) => c[0] === 'ellipse').map((c) => c.slice(1) as number[]);

// ---------------------------------------------------------------------------
// Habitat looks
// ---------------------------------------------------------------------------

describe('habitat looks (guide 3c, 7a)', () => {
  it('the canal look equals today\'s palette constants', () => {
    const canal = habitatLook('canal');
    expect(canal.id).toBe('canal');
    expect(canal.water).toEqual({
      shallow: WATER_SHALLOW,
      mid: WATER_MID,
      deep: WATER_DEEP,
      stopMid: WATER_STOP_MID,
      gradientEndY: WATER_GRADIENT_END_Y,
    });
    expect(canal.haze).toBe(HAZE);
    expect(canal.surfaceFill).toBe(WATER_SHALLOW);
    expect(canal.surfaceLine).toBe(SURFACE_LINE);
    expect(canal.surfaceLineWidth).toBe(SURFACE_LINE_WIDTH);
    expect(canal.bed).toEqual({
      top: BED_TOP,
      bottom: BED_BOTTOM,
      lip: BED_LIP,
      mud: MUD,
      mudCount: 12,
      pebbles: PEBBLE_COLOURS,
      pebbleShine: PEBBLE_SHINE,
      pebbleCount: 16,
    });
    expect(canal.edgeReeds).toBeNull();
  });

  it('throws on an unknown id and never falls back to the canal', () => {
    expect(() => habitatLook('moon')).toThrow(RangeError);
    expect(() => habitatLook('')).toThrow(/unknown habitat look/);
    expect(isHabitatLookId('pond')).toBe(true);
    expect(isHabitatLookId('moon')).toBe(false);
  });

  it('has one look per shipped id', () => {
    expect(HABITAT_LOOK_IDS).toEqual(['canal', 'pond', 'chinampa', 'spring-cave']);
    for (const id of HABITAT_LOOK_IDS) expect(habitatLook(id).id).toBe(id);
  });

  it('the pond look is the documented derived values (guide 3c, 7a)', () => {
    const pond = habitatLook('pond');
    expect(pond.water).toEqual({
      shallow: '#a4e57a',
      mid: '#58bf6a',
      deep: '#2f8f58',
      stopMid: WATER_STOP_MID,
      gradientEndY: WATER_GRADIENT_END_Y,
    });
    expect(POND_WATER_SHALLOW).toBe('#a4e57a');
    expect(POND_WATER_MID).toBe('#58bf6a');
    expect(POND_WATER_DEEP).toBe('#2f8f58');
    expect(pond.haze).toBe('rgba(130,210,90,0.12)');
    expect(pond.surfaceFill).toBe(POND_WATER_SHALLOW);
    expect(pond.surfaceLine).toBe('rgba(246,255,226,0.95)');
    expect(pond.surfaceLineWidth).toBe(SURFACE_LINE_WIDTH);
    expect(pond.bed.top).toBe('#b8a064');
    expect(pond.bed.bottom).toBe('#9a8450');
    expect(pond.bed.lip).toBe('#d9c48c');
    expect(pond.bed.mud).toBe('rgba(120,96,47,0.45)');
    expect(pond.edgeReeds).toEqual({ stalk: '#3a8a40', stalkLight: '#4a9a44', leaf: '#58a843', cattail: '#a8693a' });
    expect([POND_HAZE, POND_SURFACE_LINE, POND_BED_TOP, POND_BED_BOTTOM, POND_BED_LIP, POND_MUD]).toHaveLength(6);
  });

  it('is a warmer green than the canal, with the same stops and a soft bed', () => {
    const canal = habitatLook('canal');
    const pond = habitatLook('pond');
    expect(pond.water.stopMid).toBe(canal.water.stopMid);
    expect(pond.water.gradientEndY).toBe(canal.water.gradientEndY);
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      const h = hueOf(pond.water[stop]);
      // Yellow-green to green, against the canal's blue-green teal and blue.
      expect(h).toBeGreaterThan(80);
      expect(h).toBeLessThan(150);
      expect(hueOf(canal.water[stop])).toBeGreaterThan(170);
      expect(h).toBeLessThan(hueOf(canal.water[stop]));
    }
    expect(pond.bed.mudCount).toBeGreaterThan(canal.bed.mudCount);
    expect(pond.bed.pebbleCount).toBeLessThan(canal.bed.pebbleCount);
  });
});

// ---------------------------------------------------------------------------
// The canal stays pixel-identical
// ---------------------------------------------------------------------------

describe('the canal chunk is unchanged', () => {
  /** Fingerprints of the canal chunk painted by the code before the pond look existed (issue #75). */
  const CANAL_FINGERPRINTS: readonly (readonly [string, Omit<ChunkOptions, 'rand'>, number, string])[] = [
    ['single, sun, bank capped left', { index: 0, hasSun: true, hasBank: true, bankCapLeft: true, bankCapRight: false }, 1, '059f12403ae51e'],
    ['single, plain', { index: 2, hasSun: false, hasBank: false }, 2, '073fa96639651b'],
    ['top, bank capped right', { row: 'top', index: 1, hasSun: false, hasBank: true, bankCapLeft: false, bankCapRight: true }, 3, '011e06b2faf715'],
    ['middle', { row: 'middle', index: 1, hasSun: false, hasBank: false }, 4, '134c7db58eeb4d'],
    ['bottom', { row: 'bottom', index: 3, hasSun: false, hasBank: false }, 5, '1bf7764b015b88'],
  ];

  it.each(CANAL_FINGERPRINTS)('%s paints exactly what it did', (_name, opts, seed, expected) => {
    expect(fingerprint(chunk(opts, seed))).toBe(expected);
  });

  /** Styled fingerprints (colours included) of the same canal chunks, painted by the code before the dusk look existed (issue #98). */
  const CANAL_STYLED: readonly string[] = ['18d47ad439a3db', '11055af293477e', '19571c25f534e8', '03839d6e81f3c4', '14f9012eaade3e'];

  it.each(CANAL_FINGERPRINTS.map(([name, opts, seed], i) => [name, opts, seed, CANAL_STYLED[i]] as const))(
    '%s paints the same colours as it did',
    (_name, opts, seed, expected) => {
      expect(styledFingerprint(chunk(opts, seed))).toBe(expected);
    },
  );

  it('ignores the edge flags and an explicit canal look', () => {
    const opts = { index: 2, hasSun: false, hasBank: false } as const;
    const base = fingerprint(chunk(opts, 2));
    expect(fingerprint(chunk({ ...opts, look: 'canal', edgeLeft: true, edgeRight: true }, 2))).toBe(base);
  });
});

describe('the pond chunk is unchanged', () => {
  /** Fingerprints of the pond chunk painted by the code before the dusk look existed (issue #98). */
  const POND_FINGERPRINTS: readonly (readonly [string, Omit<ChunkOptions, 'rand'>, number, string])[] = [
    [
      'single, sun, bank capped left, stream, both edges',
      { index: 0, hasSun: true, hasBank: true, bankCapLeft: true, bankCapRight: false, look: 'pond', stream: true, edgeLeft: true, edgeRight: true },
      1,
      '00a54b1c245175',
    ],
    ['top, bank capped right, stream', { row: 'top', index: 1, hasSun: false, hasBank: true, bankCapRight: true, look: 'pond', stream: true }, 3, '06b622c482b30c'],
    ['middle', { row: 'middle', index: 1, hasSun: false, hasBank: false, look: 'pond' }, 4, '0812d89af1afdf'],
    ['bottom, both edges', { row: 'bottom', index: 3, hasSun: false, hasBank: false, look: 'pond', edgeLeft: true, edgeRight: true }, 5, '07130c1d7fd900'],
  ];

  it.each(POND_FINGERPRINTS)('%s paints exactly what it did', (_name, opts, seed, expected) => {
    expect(styledFingerprint(chunk(opts, seed))).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Pond contrast (guide 10, the pair method)
// ---------------------------------------------------------------------------

const GRADIENT_SAMPLES = 40;
const PAIR_FLOOR = 3;

/** Every colour a cue object can sit on in a pond look, sampled: water, bed, haze over both, mud dots, edge reeds. */
function pondBackgrounds(id: AreaLookId = 'pond'): { name: string; hex: string }[] {
  const pond = habitatLook(id);
  const water = sampleGradient(
    [
      [0, pond.water.shallow],
      [pond.water.stopMid, pond.water.mid],
      [1, pond.water.deep],
    ],
    GRADIENT_SAMPLES,
  );
  const bed = sampleGradient(
    [
      [0, pond.bed.top],
      [1, pond.bed.bottom],
    ],
    GRADIENT_SAMPLES,
  );
  const out: { name: string; hex: string }[] = [];
  water.forEach((hex, i) => out.push({ name: `water ${i}`, hex }, { name: `water ${i} with haze`, hex: overlay(hex, pond.haze) }));
  bed.forEach((hex, i) =>
    out.push(
      { name: `bed ${i}`, hex },
      { name: `bed ${i} with haze`, hex: overlay(hex, pond.haze) },
      { name: `bed ${i} with mud`, hex: overlay(hex, pond.bed.mud) },
      { name: `bed ${i} with mud and haze`, hex: overlay(overlay(hex, pond.bed.mud), pond.haze) },
    ),
  );
  out.push({ name: 'bed lip', hex: pond.bed.lip });
  const reeds = pond.edgeReeds!;
  for (const [name, hex] of Object.entries(reeds)) out.push({ name: `edge reed ${name}`, hex });
  return out;
}

/** The cue fills whose pair with ink is under 9:1 or that are new (guide 10 table), by name. */
const CUE_FILLS: readonly (readonly [string, string])[] = [
  ['Leucistic body', LEUCISTIC.body],
  ['Wild body', WILD.body],
  ['Wild rim', '#e2e4b8'],
  ['Golden albino body', GOLDEN_ALBINO.body],
  ['White albino body', WHITE_ALBINO.body],
  ['Copper body', COPPER.body],
  ['Piebald body', PIEBALD.body],
  ['Axanthic body', AXANTHIC.body],
  ['Axanthic rim', '#e4e6eb'],
  ['Melanoid body', MELANOID.body],
  ['Melanoid rim', '#cec9f0'],
  ['tilapia body', TILAPIA_BODY],
  ['tilapia fin', TILAPIA_FIN],
  ['tilapia belly', TILAPIA_BELLY],
  ['white', WHITE],
  ['sun yellow', SUN],
  ['plastic worm pink', PLASTIC_WORM_PINK],
  ['plastic worm blue', PLASTIC_WORM_BLUE],
];

describe('pond contrast (guide 10, the pair method)', () => {
  const backgrounds = pondBackgrounds();

  it('samples more than the stops', () => {
    expect(backgrounds.length).toBeGreaterThan(200);
  });

  it('ink is 3:1 or better on every pond background, so any cue outline holds on its own', () => {
    for (const { name, hex } of backgrounds) {
      expect(contrastRatio(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it.each(CUE_FILLS)('%s keeps 3:1 or more by the pair method on every pond background', (_name, fill) => {
    for (const { name, hex } of backgrounds) {
      const best = Math.max(contrastRatio(INK, hex), contrastRatio(fill, hex));
      expect(best, name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('the Leucistic residual of the canal does not appear in the pond', () => {
    const worst = Math.min(
      ...backgrounds.map(({ hex }) => Math.max(contrastRatio(INK, hex), contrastRatio(LEUCISTIC.body, hex))),
    );
    expect(worst).toBeGreaterThanOrEqual(PAIR_FLOOR);
    // The canal's own worst case for this pair is 2.98 (guide 10).
    const canal = habitatLook('canal');
    const canalWater = sampleGradient(
      [
        [0, canal.water.shallow],
        [canal.water.stopMid, canal.water.mid],
        [1, canal.water.deep],
      ],
      200,
    );
    const canalWorst = Math.min(
      ...canalWater.map((hex) => Math.max(contrastRatio(INK, hex), contrastRatio(LEUCISTIC.body, hex))),
    );
    expect(canalWorst).toBeLessThan(PAIR_FLOOR);
  });

  it('documents the pond colour ratios the guide prints (3c, 7a)', () => {
    const ratios: readonly (readonly [string, string, number])[] = [
      ['water shallow vs ink', POND_WATER_SHALLOW, 9.64],
      ['water mid vs ink', POND_WATER_MID, 6.22],
      ['water deep vs ink', POND_WATER_DEEP, 3.56],
      ['bed top vs ink', POND_BED_TOP, 5.65],
      ['bed bottom vs ink', POND_BED_BOTTOM, 3.97],
      ['bed lip vs ink', POND_BED_LIP, 8.38],
      ['reed stalk vs ink', POND_REED_STALK, 3.35],
      ['reed stalk light vs ink', POND_REED_STALK_LIGHT, 4.11],
      ['reed leaf vs ink', POND_REED_LEAF, 4.86],
      ['cattail vs ink', POND_CATTAIL, 3.25],
      ['log bark vs ink', LOG_BARK, 3.72],
      ['log cut face vs ink', LOG_CUT, 9.5],
      ['plastic worm pink vs ink', PLASTIC_WORM_PINK, 4.48],
      ['plastic worm blue vs ink', PLASTIC_WORM_BLUE, 4.25],
    ];
    for (const [name, hex, printed] of ratios) {
      expect(contrastRatio(hex, INK).toFixed(2), name).toBe(printed.toFixed(2));
    }
  });
});

// ---------------------------------------------------------------------------
// Pond chunk
// ---------------------------------------------------------------------------

/** The first gradient fill of a recording and its stop colours. */
const gradientStops = (rec: Recording, index: number): string[] => rec.gradients[index].stops.map(([, c]) => c);

describe('pond background chunk', () => {
  const single: Omit<ChunkOptions, 'rand'> = { index: 0, hasSun: false, hasBank: false };
  const pondBottom: Omit<ChunkOptions, 'rand'> = { row: 'bottom', index: 0, hasSun: false, hasBank: false, look: 'pond' };

  it('paints the pond water gradient, not the canal one', () => {
    const rec = chunk({ ...single, look: 'pond' });
    // Gradient 0 is the sky, 1 the water, 2 and later the rays, the last the bed.
    expect(gradientStops(rec, 1)).toEqual([POND_WATER_SHALLOW, POND_WATER_MID, POND_WATER_DEEP]);
    expect(rec.gradients[1].stops.map(([o]) => o)).toEqual([0, WATER_STOP_MID, 1]);
    expect(rec.gradients[1].coords).toEqual([0, 80, 0, WATER_GRADIENT_END_Y]);
    expect(gradientStops(rec, rec.gradients.length - 1)).toEqual([POND_BED_TOP, POND_BED_BOTTOM]);
    const colours = JSON.stringify(rec.ops);
    for (const canalColour of [WATER_SHALLOW, WATER_MID, WATER_DEEP, BED_TOP, BED_BOTTOM, BED_LIP]) {
      expect(colours).not.toContain(canalColour);
    }
  });

  it('a tall pond area meets its rows with no seam: the middle is flat pond deep water', () => {
    const middle = chunk({ row: 'middle', index: 1, hasSun: false, hasBank: false, look: 'pond' });
    expect(middle.ops).toHaveLength(1);
    expect(middle.ops[0].fillStyle).toBe(POND_WATER_DEEP);
    const bottom = chunk(pondBottom);
    expect(bottom.ops[0].fillStyle).toBe(POND_WATER_DEEP);
  });

  it('paints a soft mud bed: many mud dots and few pebbles', () => {
    const pond = chunk(pondBottom);
    const canal = chunk({ ...pondBottom, look: 'canal' });
    const dots = (rec: Recording, mud: string): number => rec.ops.filter((o) => o.op === 'fill' && o.fillStyle === mud).length;
    const pebbles = (rec: Recording): number =>
      rec.ops.filter((o) => o.op === 'stroke' && o.strokeStyle === INK && o.lineWidth === 2.6).length;
    expect(dots(pond, POND_MUD)).toBe(22);
    expect(pebbles(pond)).toBe(5);
    expect(dots(canal, MUD)).toBe(12);
    expect(pebbles(canal)).toBe(16);
  });

  it('paints reeds and cattails at the area edges, rooted in the bed', () => {
    const none = chunk(pondBottom);
    const left = chunk({ ...pondBottom, edgeLeft: true });
    const right = chunk({ ...pondBottom, edgeRight: true });
    const both = chunk({ ...pondBottom, edgeLeft: true, edgeRight: true });
    const reedStrokes = (rec: Recording): Op[] =>
      rec.ops.filter(
        (o) =>
          o.op === 'stroke' &&
          [POND_REED_STALK, POND_REED_STALK_LIGHT, POND_REED_LEAF, POND_CATTAIL].includes(o.strokeStyle as string),
      );
    expect(reedStrokes(none)).toHaveLength(0);
    // Six reeds, each a stalk and a leaf and maybe a cattail head.
    expect(reedStrokes(left).length).toBeGreaterThanOrEqual(12);
    expect(reedStrokes(right).length).toBeGreaterThanOrEqual(12);
    expect(reedStrokes(both).length).toBe(reedStrokes(left).length + reedStrokes(right).length);
    // Left reeds sit in the first 60 px, right reeds in the last 60.
    expect(reedBaseXs(left)).toHaveLength(6);
    expect(Math.max(...reedBaseXs(left))).toBeLessThanOrEqual(60);
    expect(reedBaseXs(right)).toHaveLength(6);
    expect(Math.min(...reedBaseXs(right))).toBeGreaterThanOrEqual(VIEW_W - 60);
    // The canal paints none of this.
    const canal = chunk({ ...pondBottom, look: 'canal', edgeLeft: true, edgeRight: true });
    expect(reedBaseXs(canal)).toHaveLength(0);
  });

  it('the right edge reeds stay low, under the stream band', () => {
    const right = chunk({ ...pondBottom, edgeRight: true });
    const tops = right.ops
      .filter((o) => o.op === 'stroke' && o.strokeStyle === POND_REED_STALK && hasCmd(o, 'quadraticCurveTo'))
      .map((o) => {
        const q = cmdsOf(o).find((c) => c[0] === 'quadraticCurveTo')!;
        return -(q[4] as number);
      });
    expect(tops.length).toBeGreaterThan(0);
    for (const h of tops) expect(h).toBeLessThanOrEqual(44);
  });

  it('paints the stream flowing in at the right edge only when asked, on a water row', () => {
    const top: Omit<ChunkOptions, 'rand'> = { row: 'top', index: 4, hasSun: false, hasBank: false, look: 'pond' };
    const off = chunk(top);
    const on = chunk({ ...top, stream: true });
    expect(on.gradients.length).toBe(off.gradients.length + 1);
    const stream = on.gradients.find((g) => g.coords.length === 4 && g.coords[1] === 0 && g.coords[3] === 0)!;
    expect(stream.coords[2]).toBe(VIEW_W);
    expect(stream.coords[0]).toBe(VIEW_W - STREAM_BAND.reach);
    // The lighter band fades to nothing at its tip.
    expect(parseRgba(stream.stops[0][1]).alpha).toBe(0);
    expect(parseRgba(stream.stops[1][1]).alpha).toBeGreaterThan(0);
    // Five flow lines, each a trail and a chevron, all pointing left (the chevron tip is its leftmost point).
    const flow = on.ops.filter((o) => o.op === 'stroke' && o.strokeStyle === 'rgba(255,255,255,0.6)');
    expect(flow).toHaveLength(10);
    const heads = flow.filter((o) => hasCmd(o, 'lineTo') && cmdsOf(o).filter((c) => c[0] === 'lineTo').length === 2);
    expect(heads).toHaveLength(5);
    for (const head of heads) {
      const points = cmdsOf(head).map((c) => [c[1], c[2]] as [number, number]);
      expect(points[1][0]).toBeLessThan(points[0][0]);
      expect(points[1][0]).toBeLessThan(points[2][0]);
    }
    // No stream on a row with no water: a bottom row never takes one.
    const bottom = chunk({ ...pondBottom, stream: true });
    expect(fingerprint(bottom)).toBe(fingerprint(chunk(pondBottom)));
  });

  it('keeps the stream inside the canal current rows', () => {
    expect(STREAM_BAND.y0).toBe(120);
    expect(STREAM_BAND.y1).toBe(280);
  });

  it('every background gradient stop of the pond chunk is a documented pond colour', () => {
    const rec = chunk({ ...single, look: 'pond', stream: true, edgeLeft: true, edgeRight: true });
    const used = new Set(rec.gradients.flatMap((g) => g.stops.map(([, c]) => c)));
    expect(used.has(POND_WATER_SHALLOW) && used.has(POND_WATER_DEEP) && used.has(POND_BED_TOP)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Area looks and the dusk pond (issue #98)
// ---------------------------------------------------------------------------

/** WCAG luminance floor of the pond contrast rule: ink #2b2350 is 3:1 or better on any colour at or above it. */
const LUMINANCE_FLOOR = 0.1687;

describe('area looks (issue #98)', () => {
  it('lists the habitat looks, then the dusk variant; only the habitat looks key the area map', () => {
    expect(AREA_LOOK_IDS).toEqual(['canal', 'pond', 'chinampa', 'spring-cave', 'pond-dusk']);
    expect(HABITAT_LOOK_IDS).toEqual(['canal', 'pond', 'chinampa', 'spring-cave']);
    for (const id of AREA_LOOK_IDS) expect(habitatLook(id).id).toBe(id);
    expect(isAreaLookId('pond-dusk')).toBe(true);
    expect(isHabitatLookId('pond-dusk')).toBe(false);
    expect(isAreaLookId('moon')).toBe(false);
    expect(() => habitatLook('pond-night')).toThrow(RangeError);
  });

  it('every look says what its area needs, so no caller compares look ids', () => {
    const table = AREA_LOOK_IDS.map((id) => {
      const look = habitatLook(id);
      return [id, look.stream, look.cave, look.pondProps, look.firefliesPerScreen];
    });
    expect(table).toEqual([
      ['canal', false, { kind: 'rocks', anchor: 'bed' }, false, 0],
      ['pond', true, { kind: 'log', anchor: 'bed' }, true, 0],
      ['chinampa', false, { kind: 'rootTangle', anchor: 'bed' }, false, 0],
      ['spring-cave', false, { kind: 'grotto', anchor: 'bed' }, false, 0],
      ['pond-dusk', true, { kind: 'rootArch', anchor: 'bank' }, true, 2],
    ]);
  });

  it('the daytime looks keep the prototype sky, no wash and full rays', () => {
    for (const id of ['canal', 'pond'] as const) {
      const look = habitatLook(id);
      expect(look.sky).toEqual({ top: SKY_TOP, horizon: SKY_HORIZON });
      expect(look.airWash).toBeNull();
      expect(look.rayAlphaScale).toBe(1);
    }
  });

  it('the dusk look is the documented derived values', () => {
    const dusk = habitatLook('pond-dusk');
    expect(dusk.sky).toEqual({ top: '#c9a6e0', horizon: '#ffcf9e' });
    expect([DUSK_SKY_TOP, DUSK_SKY_HORIZON]).toEqual(['#c9a6e0', '#ffcf9e']);
    expect(dusk.airWash).toBe('rgba(150,80,100,0.14)');
    expect(dusk.rayAlphaScale).toBe(0.6);
    expect(dusk.water).toEqual({
      shallow: '#b4d872',
      mid: '#6fae5c',
      deep: '#428a4e',
      stopMid: WATER_STOP_MID,
      gradientEndY: WATER_GRADIENT_END_Y,
    });
    expect(dusk.haze).toBe('rgba(225,170,95,0.12)');
    expect(dusk.surfaceFill).toBe(DUSK_WATER_SHALLOW);
    expect(dusk.surfaceLine).toBe('rgba(255,236,204,0.95)');
    expect(DUSK_SURFACE_LINE).toBe(dusk.surfaceLine);
    expect(dusk.surfaceLineWidth).toBe(SURFACE_LINE_WIDTH);
    expect(dusk.bed).toEqual({
      top: '#b09060',
      bottom: '#9a7c4c',
      lip: '#d4b884',
      mud: 'rgba(120,96,47,0.40)',
      mudCount: 22,
      pebbles: PEBBLE_COLOURS,
      pebbleShine: PEBBLE_SHINE,
      pebbleCount: 5,
    });
    expect(dusk.edgeReeds).toEqual({ stalk: '#4a8848', stalkLight: '#5a9646', leaf: '#68a644', cattail: POND_CATTAIL });
  });

  it('dusk is the pond slightly warmer and dimmer, stop by stop, and still a green pond', () => {
    const pond = habitatLook('pond');
    const dusk = habitatLook('pond-dusk');
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      const h = hueOf(dusk.water[stop]);
      expect(h).toBeLessThan(hueOf(pond.water[stop]));
      expect(h).toBeGreaterThan(60);
      const l = relativeLuminance(dusk.water[stop]);
      expect(l).toBeLessThan(relativeLuminance(pond.water[stop]));
      // Slightly: every stop keeps more than 0.8 of the pond's luminance.
      expect(l).toBeGreaterThan(0.8 * relativeLuminance(pond.water[stop]));
    }
    for (const stop of ['top', 'bottom', 'lip'] as const) {
      expect(relativeLuminance(dusk.bed[stop])).toBeLessThan(relativeLuminance(pond.bed[stop]));
      expect(hueOf(dusk.bed[stop])).toBeLessThan(hueOf(pond.bed[stop]));
    }
    expect(hueOf(dusk.edgeReeds!.stalk)).toBeLessThan(hueOf(pond.edgeReeds!.stalk));
    expect(hueOf(dusk.edgeReeds!.leaf)).toBeLessThan(hueOf(pond.edgeReeds!.leaf));
    // The sky through the wash is dimmer than the day sky.
    expect(relativeLuminance(overlay(DUSK_SKY_TOP, DUSK_AIR_WASH))).toBeLessThan(relativeLuminance(SKY_TOP));
    expect(relativeLuminance(overlay(DUSK_SKY_HORIZON, DUSK_AIR_WASH))).toBeLessThan(relativeLuminance(SKY_HORIZON));
    expect(dusk.rayAlphaScale).toBeLessThan(pond.rayAlphaScale);
  });
});

describe('dusk contrast (guide 10, the pond contrast rule)', () => {
  const backgrounds = pondBackgrounds('pond-dusk');

  it('samples more than the stops', () => {
    expect(backgrounds.length).toBeGreaterThan(200);
  });

  it('every dusk background has luminance 0.1687 or more, so ink is 3:1 or better on it', () => {
    for (const { name, hex } of backgrounds) {
      expect(relativeLuminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrastRatio(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it.each(CUE_FILLS)('%s keeps 3:1 or more by the pair method on every dusk background', (_name, fill) => {
    for (const { name, hex } of backgrounds) {
      const best = Math.max(contrastRatio(INK, hex), contrastRatio(fill, hex));
      expect(best, name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('the sky seen through the wash keeps the rule; the bank soil is the recorded exception', () => {
    const sky = sampleGradient(
      [
        [0, DUSK_SKY_TOP],
        [1, DUSK_SKY_HORIZON],
      ],
      GRADIENT_SAMPLES,
    );
    for (const hex of sky) expect(relativeLuminance(overlay(hex, DUSK_AIR_WASH)), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(overlay(DUSK_SKY_TOP, DUSK_AIR_WASH)).toBe('#c29acf');
    expect(overlay(DUSK_SKY_HORIZON, DUSK_AIR_WASH)).toBe('#f0bd96');
    expect(relativeLuminance(overlay(DUSK_SKY_TOP, DUSK_AIR_WASH))).toBeCloseTo(0.3909, 4);
    expect(relativeLuminance(overlay(DUSK_SKY_HORIZON, DUSK_AIR_WASH))).toBeCloseTo(0.5712, 4);
    // Recorded beside DUSK_AIR_WASH: the bank soil is under the floor in every look, and a little more under the wash.
    expect(relativeLuminance(BANK_SOIL)).toBeLessThan(LUMINANCE_FLOOR);
    expect(relativeLuminance(overlay(BANK_SOIL, DUSK_AIR_WASH))).toBeCloseTo(0.1603, 4);
    expect(relativeLuminance(overlay(SOIL_DETAIL, DUSK_AIR_WASH))).toBeCloseTo(0.1001, 4);
  });

  it('documents the dusk luminances and ratios the comments print', () => {
    const rows: readonly (readonly [string, string, number, number])[] = [
      ['water shallow', DUSK_WATER_SHALLOW, 0.6003, 8.91],
      ['water mid', DUSK_WATER_MID, 0.3442, 5.4],
      ['water deep', DUSK_WATER_DEEP, 0.1989, 3.41],
      ['bed top', DUSK_BED_TOP, 0.3002, 4.8],
      ['bed bottom', DUSK_BED_BOTTOM, 0.2181, 3.67],
      ['bed lip', DUSK_BED_LIP, 0.4994, 7.53],
      ['reed stalk', DUSK_REED_STALK, 0.1953, 3.36],
      ['reed stalk light', DUSK_REED_STALK_LIGHT, 0.2443, 4.03],
      ['reed leaf', DUSK_REED_LEAF, 0.3063, 4.88],
    ];
    for (const [name, hex, luminance, ratio] of rows) {
      expect(relativeLuminance(hex).toFixed(4), name).toBe(luminance.toFixed(4));
      expect(contrastRatio(hex, INK).toFixed(2), name).toBe(ratio.toFixed(2));
    }
    const mudOnBottom = overlay(DUSK_BED_BOTTOM, DUSK_MUD);
    expect(mudOnBottom).toBe('#8c7140');
    expect(relativeLuminance(mudOnBottom).toFixed(4)).toBe('0.1776');
    expect(contrastRatio(mudOnBottom, INK).toFixed(2)).toBe('3.12');
    expect(relativeLuminance(overlay(DUSK_WATER_DEEP, DUSK_HAZE)).toFixed(4)).toBe('0.2186');
  });
});

/** Count the draws `rand` gives a paint. */
function countingRand(seed: number): { rand: () => number; count: () => number } {
  const inner = seeded(seed);
  let n = 0;
  return {
    rand: () => {
      n++;
      return inner();
    },
    count: () => n,
  };
}

/** A recording's calls with the `n`th fillRect of `args` left out. */
function withoutFillRect(rec: Recording, args: readonly number[], n: number): [string, unknown[]][] {
  let seen = 0;
  return rec.calls.filter(([name, callArgs]) => {
    if (name !== 'fillRect' || JSON.stringify(callArgs) !== JSON.stringify(args)) return true;
    seen++;
    return seen !== n;
  });
}

const SKY_RECT = [0, 0, VIEW_W, SURF + 6] as const;

describe('dusk background chunk', () => {
  const DUSK_CASES: readonly (readonly [string, Omit<ChunkOptions, 'rand' | 'look'>, number])[] = [
    ['single, sun, bank, stream, both edges', { index: 0, hasSun: true, hasBank: true, bankCapLeft: true, stream: true, edgeLeft: true, edgeRight: true }, 1],
    ['top, bank capped right, stream', { row: 'top', index: 1, hasSun: false, hasBank: true, bankCapRight: true, stream: true }, 3],
    ['middle', { row: 'middle', index: 1, hasSun: false, hasBank: false }, 4],
    ['bottom, both edges', { row: 'bottom', index: 3, hasSun: false, hasBank: false, edgeLeft: true, edgeRight: true }, 5],
  ];

  it.each(DUSK_CASES)('%s: the same random draws and shapes as the pond, plus the wash on a sky row', (_name, opts, seed) => {
    const pondRand = countingRand(seed);
    const duskRand = countingRand(seed);
    const pond = record((ctx) => paintBackgroundChunk(ctx, { ...opts, look: 'pond', rand: pondRand.rand }));
    const dusk = record((ctx) => paintBackgroundChunk(ctx, { ...opts, look: 'pond-dusk', rand: duskRand.rand }));
    expect(duskRand.count()).toBe(pondRand.count());
    expect(duskRand.count() > 0).toBe(opts.row !== 'middle');
    const hasSky = opts.row === undefined || opts.row === 'top';
    // The wash is the second fill of the sky rectangle (the first is the sky itself).
    expect(hashString(JSON.stringify(hasSky ? withoutFillRect(dusk, SKY_RECT, 2) : dusk.calls))).toBe(fingerprint(pond));
    expect(dusk.ops.filter((o) => o.fillStyle === DUSK_AIR_WASH)).toHaveLength(hasSky ? 1 : 0);
  });

  it('paints the dusk sky and water, and lays the wash after the bank and before the water', () => {
    const rec = chunk({ index: 0, hasSun: true, hasBank: true, bankCapLeft: true, look: 'pond-dusk' });
    expect(gradientStops(rec, 0)).toEqual([DUSK_SKY_TOP, DUSK_SKY_HORIZON]);
    expect(gradientStops(rec, 1)).toEqual([DUSK_WATER_SHALLOW, DUSK_WATER_MID, DUSK_WATER_DEEP]);
    expect(gradientStops(rec, rec.gradients.length - 1)).toEqual([DUSK_BED_TOP, DUSK_BED_BOTTOM]);
    const wash = rec.ops.findIndex((o) => o.fillStyle === DUSK_AIR_WASH);
    expect(rec.ops[wash]).toMatchObject({ op: 'fillRect', args: [...SKY_RECT], globalAlpha: 1 });
    const lastBankSoil = rec.ops.map((o) => o.fillStyle).lastIndexOf(BANK_SOIL);
    expect(lastBankSoil).toBeGreaterThan(-1);
    expect(lastBankSoil).toBeLessThan(wash);
    const water = rec.ops.findIndex(
      (o) => o.op === 'fillRect' && JSON.stringify(o.fillStyle).includes(DUSK_WATER_SHALLOW),
    );
    expect(water).toBeGreaterThan(wash);
    // Nothing of the pond's or canal's own colours is left.
    const colours = JSON.stringify(rec.ops);
    for (const other of [POND_WATER_SHALLOW, POND_WATER_DEEP, POND_BED_TOP, POND_BED_BOTTOM, SKY_TOP, SKY_HORIZON]) {
      expect(colours).not.toContain(other);
    }
  });

  it('dims the light rays to 0.6 of the pond rays', () => {
    const opts: Omit<ChunkOptions, 'rand'> = { row: 'top', index: 2, hasSun: false, hasBank: false };
    const rayAlphas = (rec: Recording): number[] =>
      rec.gradients.filter((g) => g.stops.length === 2 && g.stops[1][1] === 'rgba(255,255,255,0)').map((g) => parseRgba(g.stops[0][1]).alpha);
    const pond = rayAlphas(chunk({ ...opts, look: 'pond' }));
    const dusk = rayAlphas(chunk({ ...opts, look: 'pond-dusk' }));
    expect(pond).toHaveLength(3);
    expect(dusk).toHaveLength(3);
    dusk.forEach((a, i) => expect(a).toBeCloseTo(pond[i] * 0.6, 2));
  });

  it('a tall dusk row is flat dusk deep water, and the bed and edge reeds take the dusk colours', () => {
    const middle = chunk({ row: 'middle', index: 1, hasSun: false, hasBank: false, look: 'pond-dusk' });
    expect(middle.ops).toHaveLength(1);
    expect(middle.ops[0].fillStyle).toBe(DUSK_WATER_DEEP);
    const bottom = chunk({ row: 'bottom', index: 0, hasSun: false, hasBank: false, look: 'pond-dusk', edgeLeft: true });
    expect(bottom.ops.filter((o) => o.op === 'fill' && o.fillStyle === DUSK_MUD)).toHaveLength(22);
    const reedColours = new Set(bottom.ops.filter((o) => o.op === 'stroke').map((o) => o.strokeStyle));
    for (const c of [DUSK_REED_STALK, DUSK_REED_STALK_LIGHT, DUSK_REED_LEAF]) expect(reedColours.has(c)).toBe(true);
    expect(reedColours.has(POND_REED_STALK)).toBe(false);
    expect(bottom.ops.some((o) => o.strokeStyle === DUSK_BED_LIP)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fake scene for the bakes
// ---------------------------------------------------------------------------

interface MadeCanvas {
  readonly pxW: number;
  readonly pxH: number;
  readonly rec: Recording;
}

function withFakeScene<T>(run: (scene: never, made: Map<string, MadeCanvas>) => T): T {
  vi.stubGlobal('Path2D', LogPath);
  const made = new Map<string, MadeCanvas>();
  const scene = {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string, pxW: number, pxH: number) => {
        const rec = recordingContext();
        made.set(key, { pxW, pxH, rec });
        return { context: rec.ctx, refresh: () => undefined };
      },
    },
  } as never;
  try {
    return run(scene, made);
  } finally {
    vi.unstubAllGlobals();
  }
}

// ---------------------------------------------------------------------------
// Area scenery bake
// ---------------------------------------------------------------------------

const AREA: AreaSceneryOptions = {
  keyPrefix: 'pond-',
  bakeScale: 2,
  bgScale: 1,
  screensWide: 5,
  screensTall: 1,
  bankChunks: [],
  sunChunk: 0,
  rand: seeded(11),
  reeds: [],
  pads: [],
};

describe('bakeAreaScenery look and stream', () => {
  const bakeArea = (extra: Partial<AreaSceneryOptions>): Map<string, MadeCanvas> =>
    withFakeScene((scene, made) => {
      bakeAreaScenery(scene, { ...AREA, rand: seeded(11), ...extra });
      return made;
    });

  it('defaults to the canal look: same bake with and without look "canal"', () => {
    const plainBake = bakeArea({});
    const canalBake = bakeArea({ look: 'canal' });
    expect([...plainBake.keys()]).toEqual([...canalBake.keys()]);
    for (const [key, made] of plainBake) expect(fingerprint(made.rec)).toBe(fingerprint(canalBake.get(key)!.rec));
  });

  it('bakes a 5 x 1 pond with edge reeds on the first and last chunk and the stream on the last', () => {
    const made = bakeArea({ look: 'pond', stream: true });
    const chunkRec = (c: number): Recording => made.get(areaBgKey('pond-', 0, c))!.rec;
    const translates = (rec: Recording): number => reedBaseXs(rec).length;
    expect(translates(chunkRec(0))).toBe(6);
    expect(translates(chunkRec(4))).toBe(6);
    for (const c of [1, 2, 3]) expect(translates(chunkRec(c))).toBe(0);
    const streams = (rec: Recording): number => rec.gradients.filter((g) => g.coords.length === 4 && g.coords[1] === 0 && g.coords[3] === 0).length;
    expect(streams(chunkRec(4))).toBe(1);
    for (const c of [0, 1, 2, 3]) expect(streams(chunkRec(c))).toBe(0);
    for (const c of [0, 1, 2, 3, 4]) {
      expect(gradientStops(chunkRec(c), 1)).toEqual([POND_WATER_SHALLOW, POND_WATER_MID, POND_WATER_DEEP]);
    }
  });

  it('bakes no stream when the flag is off', () => {
    const made = bakeArea({ look: 'pond' });
    const last = made.get(areaBgKey('pond-', 0, 4))!.rec;
    expect(last.gradients.some((g) => g.coords[2] === VIEW_W && g.coords[1] === 0)).toBe(false);
  });

  it('bakes a dusk pond from its look: dusk water, the stream on the last chunk, edge reeds and the bank under the wash', () => {
    const dusk = habitatLook('pond-dusk');
    const made = bakeArea({ look: dusk.id, stream: dusk.stream, bankChunks: [2] });
    const chunkRec = (c: number): Recording => made.get(areaBgKey('pond-', 0, c))!.rec;
    for (const c of [0, 1, 2, 3, 4]) {
      expect(gradientStops(chunkRec(c), 0)).toEqual([DUSK_SKY_TOP, DUSK_SKY_HORIZON]);
      expect(gradientStops(chunkRec(c), 1)).toEqual([DUSK_WATER_SHALLOW, DUSK_WATER_MID, DUSK_WATER_DEEP]);
      expect(chunkRec(c).ops.filter((o) => o.fillStyle === DUSK_AIR_WASH)).toHaveLength(1);
    }
    const streams = (rec: Recording): number =>
      rec.gradients.filter((g) => g.coords.length === 4 && g.coords[1] === 0 && g.coords[3] === 0).length;
    expect(streams(chunkRec(4))).toBe(1);
    expect(reedBaseXs(chunkRec(0))).toHaveLength(6);
    expect(reedBaseXs(chunkRec(4))).toHaveLength(6);
    const bank = chunkRec(2).ops;
    expect(bank.map((o) => o.fillStyle).lastIndexOf(BANK_SOIL)).toBeLessThan(bank.findIndex((o) => o.fillStyle === DUSK_AIR_WASH));
    expect(chunkRec(1).ops.some((o) => o.fillStyle === BANK_SOIL)).toBe(false);
  });

  it('a tall pond puts the stream on the top row and the edge reeds on the bottom row, with a shared flat middle', () => {
    const made = bakeArea({ look: 'pond', stream: true, screensWide: 3, screensTall: 3 });
    const top = made.get(areaBgKey('pond-', 0, 2))!.rec;
    const bottomFirst = made.get(areaBgKey('pond-', 2, 0))!.rec;
    const middle = made.get(areaDeepBgKey('pond-'))!.rec;
    expect(top.gradients.some((g) => g.coords.length === 4 && g.coords[1] === 0 && g.coords[3] === 0)).toBe(true);
    expect(reedBaseXs(top)).toHaveLength(0);
    expect(reedBaseXs(bottomFirst)).toHaveLength(6);
    expect(middle.ops[0].fillStyle).toBe(POND_WATER_DEEP);
    expect([...made.keys()].filter((k) => k.startsWith('pond-bg-')).length).toBe(3 + 3 + 1);
  });
});

// ---------------------------------------------------------------------------
// Stream mouth placement (issue #98)
// ---------------------------------------------------------------------------

/** The stream band gradient of a recording: the one running along x only. */
const streamGradients = (rec: Recording): Gradient[] =>
  rec.gradients.filter((g) => g.coords.length === 4 && g.coords[1] === 0 && g.coords[3] === 0 && g.coords[0] === g.coords[2] - STREAM_BAND.reach);
/** The flow line strokes of a recording: drawn at the stream line width. */
const flowStrokes = (rec: Recording): Op[] => rec.ops.filter((o) => o.op === 'stroke' && o.lineWidth === 2.4);
/** The mouth stone fills of a recording: 17 x 12 ellipses in the stone colours. */
const stoneFills = (rec: Recording): Op[] =>
  rec.ops.filter(
    (o) =>
      o.op === 'fill' &&
      (o.fillStyle === PEBBLE_D || o.fillStyle === PEBBLE_B) &&
      Array.isArray(o.args[0]) &&
      ellipsesOf(o).some((e) => e[2] === 17 && e[3] === 12),
  );

describe('stream mouth placement (issue #98)', () => {
  const bakeArea = (extra: Partial<AreaSceneryOptions>): Map<string, MadeCanvas> =>
    withFakeScene((scene, made) => {
      bakeAreaScenery(scene, { ...AREA, rand: seeded(11), ...extra });
      return made;
    });
  /** One hash over every chunk of a bake, colours included. */
  const bakeHash = (made: Map<string, MadeCanvas>): string =>
    hashString(JSON.stringify([...made.entries()].map(([key, canvas]) => [key, styledFingerprint(canvas.rec)])));
  const mouthOf = (column: number): number => (column + 1) * VIEW_W;

  it('pond-1: the mouth is the column holding the current end, the world right edge, as before', () => {
    const current = POND_LAYOUT.currents[0];
    const column = streamColumnFor(current.x1, POND_LAYOUT.screensWide);
    expect(column).toBe(4);
    expect(column).toBe(POND_LAYOUT.screensWide - 1);
    expect(mouthOf(column)).toBe(2400);
    expect(mouthOf(column)).toBe(POND_LAYOUT.screensWide * VIEW_W);
  });

  it('pond-2: the mouth is x 2400, just left of the root arch, inside the 2880 wide world', () => {
    const current = POND_2_LAYOUT.currents[0];
    const column = streamColumnFor(current.x1, POND_2_LAYOUT.screensWide);
    expect(column).toBe(4);
    expect(mouthOf(column)).toBe(2400);
    expect(mouthOf(column)).toBeLessThan(POND_2_LAYOUT.screensWide * VIEW_W);
    expect(mouthOf(column)).toBeGreaterThanOrEqual(current.x1);
    expect(mouthOf(column)).toBeLessThanOrEqual(POND_2_LAYOUT.cave.x0);
  });

  it('maps a current ending on a column edge to the column on its left, and throws outside the area', () => {
    expect(streamColumnFor(VIEW_W, 6)).toBe(0);
    expect(streamColumnFor(1, 6)).toBe(0);
    expect(streamColumnFor(2400, 6)).toBe(4);
    expect(streamColumnFor(2401, 6)).toBe(5);
    expect(streamColumnFor(2880, 6)).toBe(5);
    expect(() => streamColumnFor(0, 6)).toThrow(RangeError);
    expect(() => streamColumnFor(2881, 6)).toThrow(RangeError);
    expect(() => streamColumnFor(Number.NaN, 6)).toThrow(RangeError);
  });

  it('bakeAreaScenery throws on a stream column outside the area', () => {
    for (const streamColumn of [-1, 5, 1.5]) {
      expect(() => bakeArea({ look: 'pond', stream: true, streamColumn })).toThrow(RangeError);
    }
  });

  it('pond-1 bakes exactly what it did before the mouth was placed, in the pond and the dusk look', () => {
    const column = streamColumnFor(POND_LAYOUT.currents[0].x1, POND_LAYOUT.screensWide);
    /** Whole-bake hashes of a 5 x 1 area with the stream, painted by the code before streamColumn existed. */
    const before = { pond: '08c3af535436b3', 'pond-dusk': '0ec712b65edbfa' } as const;
    for (const look of ['pond', 'pond-dusk'] as const) {
      const placed = bakeArea({ look, stream: true, bankChunks: [1, 2], streamColumn: column });
      const plainBake = bakeArea({ look, stream: true, bankChunks: [1, 2] });
      expect(bakeHash(placed), look).toBe(before[look]);
      expect(bakeHash(plainBake), look).toBe(before[look]);
      const last = placed.get(areaBgKey('pond-', 0, 4))!.rec;
      expect(streamGradients(last)[0].stops).toHaveLength(2);
      expect(flowStrokes(last).every((o) => o.strokeStyle === 'rgba(255,255,255,0.6)')).toBe(true);
    }
  });

  it('tapers the band and the flow lines only when the mouth is before the world right edge', () => {
    const atEdge = bakeArea({ look: 'pond', stream: true, screensWide: 6, streamColumn: 5 });
    const closed = bakeArea({ look: 'pond', stream: true, screensWide: 6, streamColumn: 4 });
    const chunkOf = (made: Map<string, MadeCanvas>, c: number): Recording => made.get(areaBgKey('pond-', 0, c))!.rec;

    const open = streamGradients(chunkOf(atEdge, 5));
    expect(open).toHaveLength(1);
    expect(open[0].stops.map(([t]) => t)).toEqual([0, 1]);
    expect(flowStrokes(chunkOf(atEdge, 5)).every((o) => o.strokeStyle === 'rgba(255,255,255,0.6)')).toBe(true);
    for (const c of [0, 1, 2, 3, 4]) expect(streamGradients(chunkOf(atEdge, c)), `column ${c}`).toHaveLength(0);

    const band = streamGradients(chunkOf(closed, 4));
    expect(band).toHaveLength(1);
    expect(band[0].coords[2]).toBe(VIEW_W);
    expect(band[0].stops.map(([t]) => t)).toEqual([0, 1 - STREAM_TAPER / STREAM_BAND.reach, 1]);
    expect(band[0].stops.map(([, c]) => parseRgba(c).alpha)).toEqual([0, 0.3, 0]);
    const flow = flowStrokes(chunkOf(closed, 4));
    expect(flow).toHaveLength(10);
    for (const o of flow) {
      const style = o.strokeStyle as { gradient: number[]; stops: [number, string][] };
      expect(style.gradient).toEqual([VIEW_W - STREAM_TAPER, 0, VIEW_W, 0]);
      expect(style.stops.map(([, c]) => parseRgba(c).alpha)).toEqual([0.6, 0]);
    }
    expect(STREAM_TAPER).toBeGreaterThanOrEqual(40);
    expect(STREAM_TAPER).toBeLessThanOrEqual(60);
    for (const c of [0, 1, 2, 3, 5]) expect(streamGradients(chunkOf(closed, c)), `column ${c}`).toHaveLength(0);
  });

  it('paints the mouth stones that overflow a closed mouth into the next column, and nowhere else', () => {
    const closed = bakeArea({ look: 'pond', stream: true, screensWide: 6, streamColumn: 4 });
    const chunkOf = (c: number): Recording => closed.get(areaBgKey('pond-', 0, c))!.rec;
    const mouth = stoneFills(chunkOf(4));
    expect(mouth).toHaveLength(2);
    for (const o of mouth) {
      const [cx, , rx] = ellipsesOf(o)[0];
      expect(cx + rx - VIEW_W).toBe(STREAM_STONE_OVERFLOW);
    }
    const spill = chunkOf(5);
    expect(stoneFills(spill).map((o) => o.args)).toEqual(mouth.map((o) => o.args));
    expect(spill.calls.some(([name, args]) => name === 'translate' && args[0] === -VIEW_W && args[1] === 0)).toBe(true);
    for (const c of [0, 1, 2, 3]) expect(stoneFills(chunkOf(c)), `column ${c}`).toHaveLength(0);
    // At the world edge there is no next column, so nothing spills.
    const atEdge = bakeArea({ look: 'pond', stream: true, screensWide: 6, streamColumn: 5 });
    for (const c of [0, 1, 2, 3, 4]) expect(stoneFills(atEdge.get(areaBgKey('pond-', 0, c))!.rec), `column ${c}`).toHaveLength(0);
  });

  it('a spill draws no randomness and paints nothing on a row with no water', () => {
    const top: Omit<ChunkOptions, 'rand'> = { row: 'top', index: 5, hasSun: false, hasBank: false, look: 'pond' };
    const plainRand = countingRand(3);
    const spillRand = countingRand(3);
    record((ctx) => paintBackgroundChunk(ctx, { ...top, rand: plainRand.rand }));
    record((ctx) => paintBackgroundChunk(ctx, { ...top, streamSpill: true, rand: spillRand.rand }));
    expect(spillRand.count()).toBe(plainRand.count());
    const bottom: Omit<ChunkOptions, 'rand'> = { row: 'bottom', index: 5, hasSun: false, hasBank: false, look: 'pond' };
    expect(fingerprint(chunk({ ...bottom, streamSpill: true }))).toBe(fingerprint(chunk(bottom)));
  });

  it('the stream colours keep the dusk contrast rule on every dusk water colour, tapered or not', () => {
    const rec = chunk({ row: 'top', index: 4, hasSun: false, hasBank: false, look: 'pond-dusk', stream: true, streamClosed: true });
    const light = streamGradients(rec)[0].stops[1][1];
    const line = (flowStrokes(rec)[0].strokeStyle as { stops: [number, string][] }).stops[0][1];
    const lightRgba = parseRgba(light);
    const lineRgba = parseRgba(line);
    const dusk = habitatLook('pond-dusk');
    const water = sampleGradient(
      [
        [0, dusk.water.shallow],
        [dusk.water.stopMid, dusk.water.mid],
        [1, dusk.water.deep],
      ],
      GRADIENT_SAMPLES,
    );
    const steps = [0, 0.25, 0.5, 0.75, 1];
    for (const hex of water) {
      for (const bandT of steps) {
        const banded = mix(hex, lightRgba.rgb, lightRgba.alpha * bandT);
        for (const lineT of steps) {
          const lined = mix(banded, lineRgba.rgb, lineRgba.alpha * lineT);
          expect(relativeLuminance(lined), `${hex} band ${bandT} line ${lineT}`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
          expect(contrastRatio(INK, lined), `${hex} band ${bandT} line ${lineT}`).toBeGreaterThanOrEqual(PAIR_FLOOR);
        }
      }
    }
    for (const stone of [PEBBLE_D, PEBBLE_B]) {
      expect(relativeLuminance(stone), stone).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrastRatio(INK, stone), stone).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });
});

// ---------------------------------------------------------------------------
// Hollow log
// ---------------------------------------------------------------------------

describe('hollow log (guide 7b, 7e)', () => {
  const W = CAVE_W;
  const H = CAVE_H;
  const geo = logGeometry(W, H);

  it('is centred on x = 0, rests on the bed and fits the cave frame with its ink', () => {
    const frame = logTextureSize(W, H);
    expect(frame).toEqual(CAVE_TEX);
    const half = LW / 2;
    const left = geo.cx - geo.rx - half;
    const right = geo.cx + geo.dx + geo.rx + half;
    const top = geo.cy - geo.ry - half;
    const bottom = geo.cy + geo.ry + half;
    expect(left).toBeGreaterThanOrEqual(-frame.originX);
    expect(right).toBeLessThanOrEqual(frame.w - frame.originX);
    expect(top).toBeGreaterThanOrEqual(-frame.originY);
    expect(bottom).toBeLessThanOrEqual(frame.h - frame.originY);
    // The two ends are the same distance from the anchor, to within the ink; the foot is on the bed line.
    expect(Math.abs(left + right)).toBeLessThan(1);
    expect(bottom).toBeCloseTo(0, 5);
    expect(geo.holeRx).toBeLessThan(geo.rx);
    expect(geo.holeRy).toBeLessThan(geo.ry);
  });

  it('scales with w and h', () => {
    const small = logGeometry(90, 68);
    expect(small.rx).toBeCloseTo(geo.rx / 2, 5);
    expect(small.ry).toBeLessThan(geo.ry);
    const rec = record((ctx) => paintLogFront(ctx, 90, 68));
    expect(rec.ops.length).toBeGreaterThan(0);
  });

  it('back is one flat dark hollow, a little bigger than the hole, with no ink', () => {
    const { ops } = record((ctx) => paintLogBack(ctx, W, H));
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('fill');
    expect(ops[0].fillStyle).toBe(LOG_INTERIOR);
    const [cx, cy, rx, ry] = ellipsesOf(ops[0])[0];
    expect(cx).toBeCloseTo(geo.cx, 5);
    expect(cy).toBeCloseTo(geo.cy, 5);
    expect(rx).toBeGreaterThan(geo.holeRx);
    expect(ry).toBeGreaterThan(geo.holeRy);
    expect(rx).toBeLessThan(geo.rx);
  });

  it('front: ink bark body, then a cut end face with the hollow left open and inked', () => {
    const { ops, calls } = record((ctx) => paintLogFront(ctx, W, H));
    const barkFill = ops.findIndex((o) => o.op === 'fill' && o.fillStyle === LOG_BARK);
    expect(barkFill).toBe(0);
    expect(ops[1]).toMatchObject({ op: 'stroke', strokeStyle: INK, lineWidth: LW });
    // The end face is filled even-odd so the hollow shows what is behind.
    const evenOdd = calls.filter(([name, args]) => name === 'fill' && args[1] === 'evenodd');
    expect(evenOdd).toHaveLength(1);
    const face = ops.find((o) => o.op === 'fill' && o.fillStyle === LOG_CUT)!;
    const [outer, hole] = ellipsesOf(face);
    expect(outer[2]).toBeCloseTo(geo.rx, 5);
    expect(hole[2]).toBeCloseTo(geo.holeRx, 5);
    // Both edges of the face are inked at the same weight, so the hollow reads as a hole.
    const faceInk = ops.find((o) => o.op === 'stroke' && JSON.stringify(o.args[0]) === JSON.stringify(face.args[0]))!;
    expect(faceInk).toMatchObject({ strokeStyle: INK, lineWidth: LW });
    // Nothing paints the hollow itself.
    expect(ops.some((o) => o.fillStyle === LOG_INTERIOR)).toBe(false);
  });

  it('keeps every detail line off ink, and ink at the guide weight on the two outlines only', () => {
    const { ops } = record((ctx) => paintLogFront(ctx, W, H));
    const inked = ops.filter((o) => o.op === 'stroke' && o.strokeStyle === INK);
    expect(inked).toHaveLength(2);
    for (const o of inked) expect(o.lineWidth).toBe(LW);
    for (const o of ops.filter((o) => o.op === 'stroke' && o.strokeStyle !== INK)) expect(o.lineWidth).toBeLessThan(LW);
  });
});

// ---------------------------------------------------------------------------
// Plastic worm
// ---------------------------------------------------------------------------

describe('plastic worm (guide 3g, 10)', () => {
  const COLOURS: readonly PlasticWormColour[] = ['pink', 'blue'];
  const FILL: Readonly<Record<PlasticWormColour, string>> = { pink: PLASTIC_WORM_PINK, blue: PLASTIC_WORM_BLUE };

  it('uses the documented neon colours', () => {
    expect(PLASTIC_WORM_PINK).toBe('#ff3dae');
    expect(PLASTIC_WORM_BLUE).toBe('#1f8bff');
    expect(PLASTIC_WORM_GLINT).toBe('#ffffff');
  });

  it.each(COLOURS)('%s: a straight inked rod with a white glint', (colour) => {
    const { ops } = record((ctx) => paintPlasticWorm(ctx, colour));
    const strokes = ops.filter((o) => o.op === 'stroke');
    const inkTube = strokes.find((o) => o.strokeStyle === INK)!;
    const bodyTube = strokes.find((o) => o.strokeStyle === FILL[colour])!;
    expect(inkTube.lineWidth).toBeGreaterThan(bodyTube.lineWidth);
    expect(inkTube.lineWidth - bodyTube.lineWidth).toBeCloseTo(2 * 2.6, 5);
    // Straight: only a move and a line, level, no curve command at all.
    const names = cmdsOf(bodyTube).map((c) => c[0]);
    expect(names).toEqual(['moveTo', 'lineTo']);
    const [a, b] = cmdsOf(bodyTube);
    expect(a[2]).toBe(b[2]);
    expect(b[1] as number).toBeGreaterThan(a[1] as number);
    // The white glint: a streak and a dot.
    const glint = strokes.filter((o) => o.strokeStyle === WHITE);
    expect(glint).toHaveLength(1);
    expect(ops.filter((o) => o.op === 'fill' && o.fillStyle === WHITE)).toHaveLength(1);
    // No eyes, no ring marks.
    expect(ops.some((o) => o.fillStyle === EYE)).toBe(false);
    expect(strokes).toHaveLength(3);
  });

  it('is 3:1 or better against ink and has a white glint 3:1 or better against its body', () => {
    for (const colour of COLOURS) {
      expect(contrastRatio(FILL[colour], INK)).toBeGreaterThanOrEqual(PAIR_FLOOR);
      expect(contrastRatio(FILL[colour], WHITE)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('stays apart from the snack worm in greyscale (PRD X2): straight against wavy, dark against mid-tone, glint against none', () => {
    const snack = record((ctx) => paintWorm(ctx));
    const snackTube = snack.ops.find((o) => o.op === 'stroke' && o.strokeStyle === PEBBLE_E)!;
    // The snack is wavy (curves) with ring marks and bead eyes.
    expect(hasCmd(snackTube, 'bezierCurveTo')).toBe(true);
    expect(snack.ops.some((o) => o.fillStyle === EYE)).toBe(true);
    expect(snack.ops.filter((o) => o.op === 'stroke').length).toBeGreaterThan(5);
    const snackWhite = snack.ops.filter((o) => o.strokeStyle === WHITE);
    expect(snackWhite).toHaveLength(0);
    for (const colour of COLOURS) {
      const plasticRec = record((ctx) => paintPlasticWorm(ctx, colour));
      const tube = plasticRec.ops.find((o) => o.op === 'stroke' && o.strokeStyle === FILL[colour])!;
      // Shape: no curve, so a line of sight along the rod stays level at any size.
      expect(hasCmd(tube, 'bezierCurveTo') || hasCmd(tube, 'quadraticCurveTo')).toBe(false);
      // Tone: the body is a clearly different grey from the snack's.
      expect(contrastRatio(FILL[colour], PEBBLE_E)).toBeGreaterThanOrEqual(1.5);
      expect(relativeLuminance(FILL[colour])).toBeLessThan(relativeLuminance(PEBBLE_E));
      // Glint: white streak on the rod where the snack has only a small soft highlight.
      expect(plasticRec.ops.some((o) => o.op === 'stroke' && o.strokeStyle === WHITE)).toBe(true);
    }
  });

  it('pink and blue share one grey: the rod, the glint and the dark tone are the tell, not the hue', () => {
    expect(contrastRatio(PLASTIC_WORM_PINK, PLASTIC_WORM_BLUE)).toBeLessThan(1.2);
  });

  it('fits its frame, anchored at the rod centre', () => {
    const reach = 14 + 4 + 2.6;
    expect(PLASTIC_WORM_TEX.originX).toBeGreaterThanOrEqual(reach);
    expect(PLASTIC_WORM_TEX.w - PLASTIC_WORM_TEX.originX).toBeGreaterThanOrEqual(reach);
    expect(PLASTIC_WORM_TEX.originY).toBeGreaterThanOrEqual(4 + 2.6);
  });
});

// ---------------------------------------------------------------------------
// Queasy cheeks
// ---------------------------------------------------------------------------

describe('queasy cheek tint (guide 6j, ADR 0007)', () => {
  const zones = [
    ['near eye zone', NEAR_EYE_ZONE],
    ['far eye zone', FAR_EYE_ZONE],
    ['cheek heart zone', CHEEK_HEART_ZONE],
  ] as const;

  it('is two cheek patches', () => {
    expect(QUEASY_CHEEK_LOCAL).toHaveLength(2);
  });

  it.each(zones)('keeps every patch edge clear of the %s', (_name, zone) => {
    for (const c of QUEASY_CHEEK_LOCAL) {
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const x = c.x + c.rx * Math.cos(a);
        const y = c.y + c.ry * Math.sin(a);
        expect(Math.hypot(x - zone.x, y - zone.y)).toBeGreaterThan(zone.r);
      }
    }
  });

  it('draws soft green fills only: no ink, no stroke, partly see-through', () => {
    const { ops } = record((ctx) => paintQueasyCheeks(ctx));
    expect(ops.every((o) => o.op === 'fill')).toBe(true);
    expect(ops.map((o) => o.fillStyle)).toEqual([QUEASY_CHEEK_OUTER, QUEASY_CHEEK_INNER]);
    for (const o of ops) {
      const { rgb, alpha } = parseRgba(o.fillStyle as string);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(0.5);
      // A leaf green: the green channel leads, and it is never red or sick yellow.
      expect(rgb[1]).toBeGreaterThan(rgb[0]);
      expect(rgb[1]).toBeGreaterThan(rgb[2]);
      expect(o.globalAlpha).toBe(1);
    }
    expect(JSON.stringify(ops)).not.toContain(INK);
    // The middle of a patch: both layers over each other stay under 0.5.
    const centre = 1 - (1 - parseRgba(QUEASY_CHEEK_OUTER).alpha) * (1 - parseRgba(QUEASY_CHEEK_INNER).alpha);
    expect(centre).toBeLessThan(0.5);
  });

  it('paints both patches in two paths: outer then inner', () => {
    const { ops } = record((ctx) => paintQueasyCheeks(ctx));
    expect(ellipsesOf(ops[0])).toHaveLength(2);
    expect(ellipsesOf(ops[1])).toHaveLength(2);
    const [outer, inner] = [ellipsesOf(ops[0])[0], ellipsesOf(ops[1])[0]];
    expect(inner[2]).toBeLessThan(outer[2]);
    expect(inner[3]).toBeLessThan(outer[3]);
  });

  it('fits its frame and anchors at the axolotl local origin', () => {
    for (const c of QUEASY_CHEEK_LOCAL) {
      expect(c.x - c.rx).toBeGreaterThanOrEqual(-QUEASY_CHEEKS_TEX.originX);
      expect(c.x + c.rx).toBeLessThanOrEqual(QUEASY_CHEEKS_TEX.w - QUEASY_CHEEKS_TEX.originX);
      expect(c.y - c.ry).toBeGreaterThanOrEqual(-QUEASY_CHEEKS_TEX.originY);
      expect(c.y + c.ry).toBeLessThanOrEqual(QUEASY_CHEEKS_TEX.h - QUEASY_CHEEKS_TEX.originY);
    }
  });
});

// ---------------------------------------------------------------------------
// Root arch and firefly (issue #98)
// ---------------------------------------------------------------------------

type Point = readonly [number, number];

/** Points along a recorded path (moveTo, lineTo, quadratic and cubic curves; a closePath adds none), `steps` per segment. */
function samplePath(cmds: unknown[][], steps = 32): Point[] {
  const points: Point[] = [];
  let at: Point = [0, 0];
  for (const cmd of cmds) {
    const [name, ...a] = cmd as [string, ...number[]];
    if (name === 'closePath') continue;
    if (name === 'moveTo') {
      at = [a[0], a[1]];
      points.push(at);
      continue;
    }
    for (let i = 1; i <= steps; i++) points.push(curvePoint(name, at, a, i / steps));
    at = [a[a.length - 2], a[a.length - 1]];
  }
  return points;
}

/** The point at `t` of one path segment starting at `from`. */
function curvePoint(name: string, from: Point, a: readonly number[], t: number): Point {
  const m = 1 - t;
  if (name === 'lineTo') return [from[0] * m + a[0] * t, from[1] * m + a[1] * t];
  if (name === 'quadraticCurveTo') {
    return [m * m * from[0] + 2 * m * t * a[0] + t * t * a[2], m * m * from[1] + 2 * m * t * a[1] + t * t * a[3]];
  }
  if (name === 'bezierCurveTo') {
    const [b0, b1, b2, b3] = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
    return [b0 * from[0] + b1 * a[0] + b2 * a[2] + b3 * a[4], b0 * from[1] + b1 * a[1] + b2 * a[3] + b3 * a[5]];
  }
  throw new Error(`samplePath: no sampler for ${name}`);
}

/** Every point a recorded path is built from (curve control points included, ellipses as their box corners, arcs sampled). */
function hullPoints(cmds: unknown[][]): Point[] {
  return cmds.flatMap((cmd) => {
    const [name, ...a] = cmd as [string, ...number[]];
    if (name === 'ellipse') {
      const r = Math.max(a[2], a[3]);
      return [
        [a[0] - r, a[1] - r],
        [a[0] + r, a[1] + r],
      ] as Point[];
    }
    if (name === 'arc') return arcPoints(a);
    if (name === 'closePath') return [];
    const pairs: Point[] = [];
    for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]);
    return pairs;
  });
}

/** Points along a recorded arc(cx, cy, r, start, end, anticlockwise). */
function arcPoints([cx, cy, r, start, end, anticlockwise]: readonly number[]): Point[] {
  const turn = Math.PI * 2;
  let sweep = end - start;
  if (anticlockwise) while (sweep > 0) sweep -= turn;
  else while (sweep < 0) sweep += turn;
  return Array.from({ length: 33 }, (_, i) => {
    const angle = start + (sweep * i) / 32;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as Point;
  });
}

/** Even-odd point in polygon. */
function inside(polygon: readonly Point[], [x, y]: Point): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Every op's reach, ink included: each hull point grown by half its stroke width, inside [x0, x1] x [y0, y1]. */
function expectOpsWithin(ops: readonly Op[], x0: number, y0: number, x1: number, y1: number): void {
  for (const o of ops) {
    const grow = o.op === 'stroke' ? o.lineWidth / 2 : 0;
    for (const [x, y] of hullPoints(cmdsOf(o))) {
      expect(x - grow, `${o.op} ${String(o.strokeStyle)}`).toBeGreaterThanOrEqual(x0 - 1e-9);
      expect(x + grow).toBeLessThanOrEqual(x1 + 1e-9);
      expect(y - grow).toBeGreaterThanOrEqual(y0 - 1e-9);
      expect(y + grow).toBeLessThanOrEqual(y1 + 1e-9);
    }
  }
}

describe('root arch (the dusk pond cave, issue #98)', () => {
  const back = record(paintRootArchBack);
  const front = record(paintRootArchFront);
  /** The ink of each root tube (wider than the mat's outline), with half its width. */
  const tubes = front.ops
    .filter((o) => o.op === 'stroke' && o.strokeStyle === INK && o.lineWidth > LW)
    .map((o) => ({ points: samplePath(cmdsOf(o)), half: o.lineWidth / 2 }));
  const mat = front.ops.find((o) => o.op === 'fill' && o.fillStyle === ROOT_MAT)!;
  const matPolygon = samplePath(cmdsOf(mat));
  const covered = (p: Point): boolean =>
    inside(matPolygon, p) || tubes.some((t) => t.points.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) <= t.half - 0.5));

  it('has the cave frame size, anchored at the top centre under the bank', () => {
    expect(ROOT_ARCH_W).toBe(CAVE_W);
    expect(ROOT_ARCH_H).toBe(CAVE_H);
    expect(ROOT_ARCH_TEX.w).toBe(CAVE_TEX.w);
    expect(ROOT_ARCH_TEX.h).toBe(CAVE_TEX.h);
    expect(ROOT_ARCH_TEX).toEqual({ w: 184, h: 140, originX: 92, originY: 2 });
    expect(ROOT_ARCH_ANCHOR_Y).toBe(SURF + 3);
    const { top, w, h } = ROOT_ARCH_OPENING;
    expect(w).toBeLessThan(ROOT_ARCH_W);
    expect(top + h).toBeLessThan(ROOT_ARCH_H);
  });

  it('keeps every part, ink included, inside 180 x 136 below the anchor', () => {
    expectOpsWithin(front.ops, -ROOT_ARCH_W / 2, 0, ROOT_ARCH_W / 2, ROOT_ARCH_H);
    expectOpsWithin(back.ops, -ROOT_ARCH_W / 2, 0, ROOT_ARCH_W / 2, ROOT_ARCH_H);
    // The mat's top ink edge sits on the anchor line and its sides on the frame edge.
    const ys = hullPoints(cmdsOf(mat)).map(([, y]) => y);
    expect(Math.min(...ys) - LW / 2).toBeCloseTo(0, 5);
  });

  it('back: one flat dark U the size of the opening, with no ink', () => {
    expect(back.ops).toHaveLength(1);
    expect(back.ops[0]).toMatchObject({ op: 'fill', fillStyle: ROOT_ARCH_INTERIOR });
    expect(ROOT_ARCH_INTERIOR).toBe(LOG_INTERIOR);
    const arc = cmdsOf(back.ops[0]).find((c) => c[0] === 'arc')!;
    const { top, w, h } = ROOT_ARCH_OPENING;
    expect(arc.slice(1, 4)).toEqual([0, top + h - w / 2, w / 2]);
    // Round bottom: the arc runs from the left side, under, to the right side.
    expect(arc.slice(4)).toEqual([Math.PI, 0, true]);
  });

  it('front covers the hollow edge all round, so the dark never shows an uninked edge', () => {
    const { top, w, h } = ROOT_ARCH_OPENING;
    const r = w / 2;
    const cy = top + h - r;
    const edge: Point[] = [];
    for (let i = 0; i <= 40; i++) edge.push([-r + (w * i) / 40, top]);
    for (let i = 0; i <= 20; i++) edge.push([-r, top + ((cy - top) * i) / 20], [r, top + ((cy - top) * i) / 20]);
    for (let i = 0; i <= 60; i++) {
      const a = (Math.PI * i) / 60;
      edge.push([r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    for (const p of edge) expect(covered(p), `edge (${p[0].toFixed(1)}, ${p[1].toFixed(1)})`).toBe(true);
  });

  it('leaves an 80 x 48 clear hollow inside, so the axolotl hides in the dark, not behind roots', () => {
    for (let x = -40; x <= 40; x += 4) {
      for (let y = 44; y <= 92; y += 4) expect(covered([x, y]), `(${x}, ${y})`).toBe(false);
    }
  });

  it('roots are one merged inked group, then the soil mat with ink 3.5, then one shine; no glow', () => {
    const inkFirst = front.ops.findIndex((o) => o.op === 'stroke' && o.strokeStyle !== INK);
    const inkTubes = front.ops.slice(0, inkFirst);
    expect(inkTubes.length).toBe(tubes.length);
    expect(inkTubes.every((o) => o.strokeStyle === INK)).toBe(true);
    // Rim roots 12 wide, outer roots 7, rootlets 4, each with 2.6 of ink a side.
    expect([...new Set(inkTubes.map((o) => o.lineWidth))].sort((a, b) => a - b)).toEqual([4 + 5.2, 7 + 5.2, 12 + 5.2]);
    const colours = new Set(front.ops.filter((o) => o.op === 'stroke' && o.lineWidth < LW * 4).map((o) => o.strokeStyle));
    expect(colours.has(ROOT_BARK)).toBe(true);
    expect(colours.has(ROOT_ROOTLET)).toBe(true);
    const matIndex = front.ops.indexOf(mat);
    expect(matIndex).toBeGreaterThan(inkFirst);
    expect(front.ops[matIndex + 1]).toMatchObject({ op: 'stroke', strokeStyle: INK, lineWidth: LW });
    expect(ROOT_MAT).toBe(BANK_SOIL);
    const shines = front.ops.filter((o) => o.strokeStyle === ROOT_SHINE);
    expect(shines).toHaveLength(1);
    expect(shines[0].lineWidth).toBeLessThan(LW);
    expect(front.gradients).toHaveLength(0);
    expect(back.gradients).toHaveLength(0);
  });
});

describe('firefly (the dusk pond, issue #98)', () => {
  const firefly = record(paintFirefly);

  it('fits its frame with its ink, anchored at the glowing tail', () => {
    expect(FIREFLY_TEX).toEqual({ w: 24, h: 24, originX: 12, originY: 12 });
    expectOpsWithin(firefly.ops, -FIREFLY_TEX.originX, -FIREFLY_TEX.originY, FIREFLY_TEX.w - FIREFLY_TEX.originX, FIREFLY_TEX.h - FIREFLY_TEX.originY);
    const tail = firefly.ops.find((o) => o.op === 'fill' && o.fillStyle === FIREFLY_GLOW)!;
    const [cx, cy] = ellipsesOf(tail)[0];
    expect(Math.hypot(cx, cy)).toBeLessThan(1.5);
  });

  it('is a soft halo with no ink, then a head, a glowing tail and a wing, each inked', () => {
    expect(firefly.ops.slice(0, 2).map((o) => [o.op, o.fillStyle])).toEqual([
      ['fill', FIREFLY_HALO_OUTER],
      ['fill', FIREFLY_HALO_INNER],
    ]);
    const rest = firefly.ops.slice(2);
    expect(rest.map((o) => (o.op === 'fill' ? o.fillStyle : o.strokeStyle))).toEqual([
      FIREFLY_BODY,
      INK,
      FIREFLY_GLOW,
      INK,
      FIREFLY_WING,
      INK,
    ]);
    for (const o of firefly.ops) expect(o.globalAlpha).toBe(1);
    expect(firefly.gradients).toHaveLength(0);
  });

  it('reads in greyscale: a bright tail ringed in ink beside a dark head, brighter than the dusk sky, with a halo that lightens it', () => {
    expect(contrastRatio(FIREFLY_GLOW, INK)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(contrastRatio(FIREFLY_GLOW, FIREFLY_BODY)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(contrastRatio(FIREFLY_GLOW, FIREFLY_BODY).toFixed(2)).toBe('9.43');
    const sky = sampleGradient(
      [
        [0, DUSK_SKY_TOP],
        [1, DUSK_SKY_HORIZON],
      ],
      GRADIENT_SAMPLES,
    ).map((hex) => overlay(hex, DUSK_AIR_WASH));
    for (const hex of sky) {
      expect(relativeLuminance(FIREFLY_GLOW)).toBeGreaterThan(relativeLuminance(hex));
      expect(relativeLuminance(overlay(overlay(hex, FIREFLY_HALO_OUTER), FIREFLY_HALO_INNER))).toBeGreaterThan(relativeLuminance(hex));
    }
  });

  it('hovers above the water: the whole halo stays over the wave crest', () => {
    const haloR = ellipsesOf(firefly.ops[0])[0][2];
    expect(FIREFLY_BAND.y0).toBeLessThan(FIREFLY_BAND.y1);
    expect(FIREFLY_BAND.y0 - haloR).toBeGreaterThan(0);
    expect(FIREFLY_BAND.y1 + haloR).toBeLessThan(SURF - 2.4);
  });
});

// ---------------------------------------------------------------------------
// Pond bake
// ---------------------------------------------------------------------------

describe('bakePondTextures', () => {
  it('bakes the log in the cave frame, the two worms and the cheeks, with documented anchors', () => {
    const { baked, made } = withFakeScene((scene, made) => ({
      baked: bakePondTextures(scene, 2, { caveW: CAVE_W, caveH: CAVE_H }),
      made,
    }));
    expect(baked.logBack.key).toBe(POND_TEX.logBack);
    expect(baked.logFront.key).toBe(POND_TEX.logFront);
    expect(baked.plasticWorms.pink.key).toBe(POND_TEX.plasticWormPink);
    expect(baked.plasticWorms.blue.key).toBe(POND_TEX.plasticWormBlue);
    expect(baked.queasyCheeks.key).toBe(POND_TEX.queasyCheeks);
    expect(new Set([...made.keys()]).size).toBe(5);
    // Log back and front share the cave frame: anchor the base centre on the bed.
    for (const log of [baked.logBack, baked.logFront]) {
      expect(log.scale).toBe(2);
      expect(log.w).toBe(CAVE_TEX.w);
      expect(log.h).toBe(CAVE_TEX.h);
      expect(log.originX).toBe(CAVE_TEX.originX);
      expect(log.originY).toBe(CAVE_TEX.originY);
      expect(log.pxW).toBe(Math.ceil(CAVE_TEX.w * 2));
    }
    // The worms share one frame, anchor the rod centre; the cheeks anchor the axolotl origin.
    expect(baked.plasticWorms.pink.originX).toBe(PLASTIC_WORM_TEX.originX);
    expect(baked.plasticWorms.blue.originY).toBe(PLASTIC_WORM_TEX.originY);
    expect(baked.queasyCheeks.originX).toBe(QUEASY_CHEEKS_TEX.originX);
    expect(baked.queasyCheeks.originY).toBe(QUEASY_CHEEKS_TEX.originY);
    // Every texture was painted, and with no extras there is no root arch and no firefly.
    for (const [, canvas] of made) expect(canvas.rec.ops.length).toBeGreaterThan(0);
    expect(baked.rootArch).toBeNull();
    expect(baked.firefly).toBeNull();
  });

  it('bakes the root arch and the firefly when asked, in their own frames and anchors', () => {
    const { baked, made } = withFakeScene((scene, made) => ({
      baked: bakePondTextures(scene, 2, { caveW: CAVE_W, caveH: CAVE_H }, { rootArch: true, firefly: true }),
      made,
    }));
    expect(made.size).toBe(8);
    const arch = baked.rootArch!;
    expect(arch.back.key).toBe(POND_TEX.rootArchBack);
    expect(arch.front.key).toBe(POND_TEX.rootArchFront);
    for (const info of [arch.back, arch.front]) {
      expect(info).toMatchObject({ scale: 2, w: ROOT_ARCH_TEX.w, h: ROOT_ARCH_TEX.h, originX: ROOT_ARCH_TEX.originX, originY: ROOT_ARCH_TEX.originY });
      expect(info.originNormX).toBeCloseTo(0.5, 5);
      expect(made.get(info.key)!.pxW).toBe(ROOT_ARCH_TEX.w * 2);
    }
    expect(baked.firefly).toMatchObject({ key: POND_TEX.firefly, w: FIREFLY_TEX.w, h: FIREFLY_TEX.h, originX: FIREFLY_TEX.originX });
    expect(baked.firefly!.originNormY).toBeCloseTo(0.5, 5);
    for (const [, canvas] of made) expect(canvas.rec.ops.length).toBeGreaterThan(0);
    const one = withFakeScene((scene) => bakePondTextures(scene, 1, { caveW: CAVE_W, caveH: CAVE_H }, { firefly: true }));
    expect(one.rootArch).toBeNull();
    expect(one.firefly).not.toBeNull();
  });

  it('sizes the log by the cave size it is given', () => {
    const baked = withFakeScene((scene) => bakePondTextures(scene, 1, { caveW: 90, caveH: 68 }));
    expect(baked.logFront.w).toBe(logTextureSize(90, 68).w);
    expect(baked.logFront.h).toBe(logTextureSize(90, 68).h);
  });
});

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

describe('draw order', () => {
  it('queasyTint sits over the axolotl and under the bubbles, on a depth of its own', () => {
    expect(DEPTH.queasyTint).toBeGreaterThan(DEPTH.axolotl);
    expect(DEPTH.queasyTint).toBeLessThan(DEPTH.bubbles);
    expect(Object.values(DEPTH).filter((d) => d === DEPTH.queasyTint)).toHaveLength(1);
  });

  it('keeps the stranded friend, halo and tilapia behind the axolotl', () => {
    expect(DEPTH.friend).toBeLessThan(DEPTH.axolotl);
    expect(DEPTH.halo).toBeLessThan(DEPTH.axolotl);
    expect(DEPTH.tilapia).toBeLessThan(DEPTH.axolotl);
  });
});
