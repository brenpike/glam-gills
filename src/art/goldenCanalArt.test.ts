/**
 * The deep canal at golden hour (issue #112, Area 11; guide 2, 3c, 7a, 10), headless: the
 * 'deep-canal-golden' look, its warm rays, its decorations (drawGoldenCanal.ts) and its lit lower
 * row, painted into the background chunks. The painters run against a recording context and a stub
 * Path2D (the same approach as pondArt.test.ts): every fill and stroke is kept with the style, width,
 * alpha and blend it was painted under, and every context call is logged. No Phaser is loaded.
 */
import { describe, expect, it, vi } from 'vitest';
import { CANAL_STONE, CANAL_STONE_DARK, CANAL_STONE_LIGHT } from './drawDeepCanal';
import {
  BANNER_STRING,
  EDGE_WEAVE_STEP,
  GOLDEN_DECOR_FILLS,
  GOLDEN_LIGHT_RGB,
  HYACINTH_RAFTS,
  LIT_SHAFT_SPACING,
  MARIGOLD_PATCHES,
  MARIGOLD_PETAL,
  PAPEL_PICADO_BANNERS,
  PAPEL_PICADO_COLOURS,
  SINKING_PETAL_TEX,
  SUNKEN_ARCHES,
  WALL_BACK,
  WALL_STAKE,
  WALL_WEAVE,
  paintGoldenDecor,
  paintLitLowerRow,
  paintSinkingPetal,
  type GoldenChunk,
} from './drawGoldenCanal';
import { bedEdgeY, paintBackgroundChunk, type ChunkOptions, type ChunkRow } from './drawScenery';
import {
  AREA_LOOK_IDS,
  DAY_RAY_SLANT,
  DAY_RAY_TINT,
  DEEP_CANAL_GOLDEN_LOOK,
  DEEP_CANAL_LOOK,
  GOLDEN_AIR_WASH,
  GOLDEN_HAZE,
  GOLDEN_RAY_SLANT,
  GOLDEN_RAY_TINT,
  GOLDEN_SINKING_PETALS_PER_SCREEN,
  GOLDEN_SKY_HORIZON,
  GOLDEN_SKY_TOP,
  GOLDEN_SURFACE_LINE,
  GOLDEN_WATER_DEEP,
  GOLDEN_WATER_MID,
  GOLDEN_WATER_SHALLOW,
  HABITAT_LOOK_IDS,
  habitatLook,
  isAreaLookId,
  isHabitatLookId,
  type AreaLookId,
} from './habitatLook';
import { INK, LEUCISTIC, RAY_END_Y, SURF, VIEW_H, VIEW_W } from './palette';

vi.mock('phaser', () => ({}));

const LUMINANCE_FLOOR = 0.1687;

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

/** Hue in degrees, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function mix(a: string, b: Rgb, t: number): string {
  const ca = channelsOf(a);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - t) + b[i] * t) as unknown as Rgb);
}

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

// ---------------------------------------------------------------------------
// A recording canvas context
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

interface Gradient {
  readonly kind: 'gradient';
  readonly coords: number[];
  readonly stops: [number, string][];
  addColorStop(offset: number, colour: string): void;
}

interface Op {
  readonly op: string;
  readonly args: unknown[];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly globalAlpha: number;
  readonly blend: string;
}

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'globalCompositeOperation'] as const;

interface Recording {
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

/** Log one draw call with the state it was painted under. */
function logDraw(ops: Op[], name: string, args: unknown[], state: Record<string, unknown>): void {
  ops.push({
    op: name,
    args: args.map(plain),
    fillStyle: plain(state.fillStyle),
    strokeStyle: plain(state.strokeStyle),
    lineWidth: state.lineWidth as number,
    globalAlpha: state.globalAlpha as number,
    blend: state.globalCompositeOperation as string,
  });
}

function recordingContext(): { ctx: CanvasRenderingContext2D } & Recording {
  const ops: Op[] = [];
  const calls: [string, unknown[]][] = [];
  const gradients: Gradient[] = [];
  let state: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
  const stack: Record<string, unknown>[] = [];
  const method = (name: string) => (...args: unknown[]) => {
    if (name === 'save') stack.push({ ...state });
    else if (name === 'restore') state = stack.pop() ?? state;
    else if (name === 'createLinearGradient') return makeGradient(args as number[], gradients, calls);
    else {
      calls.push([name, args.map(plain)]);
      if (DRAW_OPS.has(name)) logDraw(ops, name, args, state);
    }
    return undefined;
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name) || name in state) return state[name];
        return method(name);
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, calls, gradients };
}

function makeGradient(coords: number[], gradients: Gradient[], calls: [string, unknown[]][]): Gradient {
  const g: Gradient = { kind: 'gradient', coords, stops: [], addColorStop: (offset, colour) => void g.stops.push([offset, colour]) };
  gradients.push(g);
  calls.push(['createLinearGradient', coords]);
  return g;
}

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

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A recording of one chunk and the number of random draws it took. */
function chunkWithDraws(opts: Omit<ChunkOptions, 'rand'>, seed: number): { rec: Recording; draws: number } {
  const inner = seeded(seed);
  let draws = 0;
  const rand = (): number => {
    draws++;
    return inner();
  };
  const rec = record((ctx) => paintBackgroundChunk(ctx, { ...opts, rand }));
  return { rec, draws };
}

/** A 53-bit string hash (cyrb53), as pondArt.test.ts. */
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

/**
 * Every context call plus the fill, stroke, width and alpha every draw was painted under: the same
 * digest as pondArt.test.ts styledFingerprint, so a pixel or colour change shows.
 */
function styledDigest(rec: Recording): string {
  const ops = rec.ops.map(({ op, args, fillStyle, strokeStyle, lineWidth, globalAlpha }) => ({ op, args, fillStyle, strokeStyle, lineWidth, globalAlpha }));
  return hashString(JSON.stringify([rec.calls, ops]));
}

// ---------------------------------------------------------------------------
// Path geometry
// ---------------------------------------------------------------------------

type Cmd = [string, ...number[]];

const pathOf = (op: Op): Cmd[] | null => (Array.isArray(op.args[0]) ? (op.args[0] as Cmd[]) : null);

/** The half width and half height of the box round an ellipse of radii rx, ry turned by `rot`. */
function ellipseHalfBox(rx: number, ry: number, rot: number): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [Math.hypot(rx * c, ry * s), Math.hypot(rx * s, ry * c)];
}

/** The x and y extent of a recorded op, stroke half-width included. */
function extentOf(op: Op): { minX: number; maxX: number; minY: number; maxY: number } {
  if (op.op === 'fillRect') {
    const [x, y, w, h] = op.args as number[];
    return { minX: x, maxX: x + w, minY: y, maxY: y + h };
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [name, ...a] of pathOf(op) ?? []) {
    if (name === 'ellipse' || name === 'arc') {
      const [hw, hh] = name === 'arc' ? [a[2], a[2]] : ellipseHalfBox(a[2], a[3], a[4]);
      xs.push(a[0] - hw, a[0] + hw);
      ys.push(a[1] - hh, a[1] + hh);
    } else {
      for (let i = 0; i + 1 < a.length; i += 2) {
        xs.push(a[i]);
        ys.push(a[i + 1]);
      }
    }
  }
  const pad = op.op === 'stroke' ? op.lineWidth / 2 : 0;
  return { minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad };
}

/** A path command moved `dx` along x: ellipse and arc lead with their centre, the rest are x, y pairs. */
function shiftCmd([name, ...a]: Cmd, dx: number): Cmd {
  if (name === 'ellipse' || name === 'arc') return [name, a[0] + dx, ...a.slice(1)];
  return [name, ...a.map((v, i) => (i % 2 === 0 ? v + dx : v))];
}

const round = (v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 + 0 : v);

/** An op's key in world coordinates: the chunk's left edge `wx0` added to every x. */
function worldKey(op: Op, wx0: number): string {
  let args: unknown;
  if (op.op === 'fillRect') {
    const [x, ...rest] = op.args as number[];
    args = [x + wx0, ...rest].map(round);
  } else {
    args = [(pathOf(op) ?? []).map((c) => shiftCmd(c, wx0).map(round)), ...op.args.slice(1)];
  }
  return JSON.stringify([op.op, args, ...drawnStyle(op)]);
}

/** What an op paints with: its stroke style and width for a stroke, its fill style otherwise, and its alpha and blend. */
function drawnStyle(op: Op): unknown[] {
  const style = op.op === 'stroke' ? [op.strokeStyle, op.lineWidth] : [op.fillStyle];
  return [...style, op.globalAlpha, op.blend];
}

/** The ops of a recording as what they paint, so leftover state an op does not use is left out. */
const drawn = (ops: readonly Op[]): string => JSON.stringify(ops.map((o) => [o.op, o.args, ...drawnStyle(o)]));

/** Each path command's straight direction, or null for a curve or a new subpath. Zero-length lines are left out. */
function straightDirs(cmds: readonly Cmd[]): ([number, number] | null)[] {
  const dirs: ([number, number] | null)[] = [];
  let start: [number, number] = [0, 0];
  let at: [number, number] = [0, 0];
  for (const [name, ...a] of cmds) {
    const to: [number, number] | null = name === 'lineTo' ? [a[0], a[1]] : name === 'closePath' ? start : null;
    if (to !== null) {
      const dir: [number, number] = [to[0] - at[0], to[1] - at[1]];
      if (Math.hypot(...dir) > 1e-9) dirs.push(dir);
      at = to;
      continue;
    }
    dirs.push(null);
    if (name === 'moveTo') start = [a[0], a[1]];
    if (name === 'arc') at = [a[0] + a[2] * Math.cos(a[4]), a[1] + a[2] * Math.sin(a[4])];
    else if (name !== 'ellipse') at = [a[a.length - 2], a[a.length - 1]];
  }
  return dirs;
}

/** The turn, degrees, at every corner where two straight segments of a path meet. */
function sharpCorners(cmds: readonly Cmd[]): number[] {
  const dirs = straightDirs(cmds);
  const corners: number[] = [];
  for (let i = 1; i < dirs.length; i++) {
    const a = dirs[i - 1];
    const b = dirs[i];
    if (a === null || b === null) continue;
    const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
    corners.push((Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI);
  }
  return corners;
}

/** Luminance of an op's solid fill or line colour; light (an rgba) and gradients count as the floor. */
function fillLuminance(op: Op): number {
  const style = op.op === 'stroke' ? op.strokeStyle : op.fillStyle;
  return typeof style === 'string' && style.startsWith('#') ? luminance(style) : LUMINANCE_FLOOR;
}

// ---------------------------------------------------------------------------
// Chunks
// ---------------------------------------------------------------------------

const GOLDEN: AreaLookId = 'deep-canal-golden';

function goldenChunk(row: ChunkRow, index: number, extra: Partial<GoldenChunk> = {}): GoldenChunk {
  const wx0 = index * VIEW_W;
  return {
    index,
    hasSky: row === 'single' || row === 'top',
    hasBed: row === 'single' || row === 'bottom',
    bank: null,
    edgeLeft: false,
    edgeRight: false,
    bedEdge: (x) => bedEdgeY(wx0 + x),
    ...extra,
  };
}

const decorOf = (chunk: GoldenChunk): Recording => record((ctx) => paintGoldenDecor(ctx, chunk));
const litOf = (index: number): Recording => record((ctx) => paintLitLowerRow(ctx, index, GOLDEN_RAY_SLANT));

/** Every decoration op of the top row and the bottom row of the 10-screen area, banks and edges included. */
function wholeAreaDecor(): { readonly top: Op[]; readonly bottom: Op[] } {
  const top: Op[] = [];
  const bottom: Op[] = [];
  for (let i = 0; i < 10; i++) {
    const edges = { edgeLeft: i === 0, edgeRight: i === 9 };
    top.push(...decorOf(goldenChunk('top', i, { ...edges, bank: { capLeft: i === 3, capRight: i === 5 } })).ops);
    bottom.push(...decorOf(goldenChunk('bottom', i, edges)).ops);
  }
  return { top, bottom };
}

// ---------------------------------------------------------------------------
// The look
// ---------------------------------------------------------------------------

describe('the golden-hour deep canal look (issue #112)', () => {
  const look = habitatLook(GOLDEN);

  it('is an area look variant after the dusk pond, never a habitat look, and resolves to its frozen entry', () => {
    expect(AREA_LOOK_IDS.slice(-5)).toEqual(['pond-dusk', 'deep-canal-golden', 'open-lake-windy', 'open-lake-still', 'open-lake-late']);
    expect(HABITAT_LOOK_IDS).not.toContain(GOLDEN);
    expect(isAreaLookId(GOLDEN)).toBe(true);
    expect(isHabitatLookId(GOLDEN)).toBe(false);
    expect(look).toBe(DEEP_CANAL_GOLDEN_LOOK);
    expect(look.id).toBe(GOLDEN);
    expect(Object.isFrozen(look)).toBe(true);
    expect(Object.isFrozen(look.water)).toBe(true);
    expect(Object.isFrozen(look.sky)).toBe(true);
  });

  it('is the deep canal look with the golden colours, rays, light and decorations', () => {
    const changed = new Set([
      'id',
      'sky',
      'airWash',
      'water',
      'haze',
      'surfaceFill',
      'surfaceLine',
      'rayTint',
      'raySlant',
      'lowerRowLight',
      'goldenDecor',
      'sinkingPetalsPerScreen',
    ]);
    for (const [key, value] of Object.entries(DEEP_CANAL_LOOK)) {
      if (!changed.has(key)) expect(look[key as keyof typeof look], key).toEqual(value);
    }
    expect(look.bed).toBe(DEEP_CANAL_LOOK.bed);
    expect(look.cave).toEqual({ kind: 'sunkenHull', anchor: 'bed' });
    expect(look.deepCanalProps).toBe(true);
    expect(look.bedStones).toBe(true);
    expect(look.bank).toBe('willows');
    expect(look.water.deep).toBe(DEEP_CANAL_LOOK.water.deep);
  });

  it('is the documented derived values', () => {
    expect(look.sky).toEqual({ top: '#f0a890', horizon: '#ffd8a8' });
    expect([GOLDEN_SKY_TOP, GOLDEN_SKY_HORIZON]).toEqual(['#f0a890', '#ffd8a8']);
    expect(look.airWash).toBe('rgba(255,160,110,0.12)');
    expect(GOLDEN_AIR_WASH).toBe(look.airWash);
    expect([look.water.shallow, look.water.mid, look.water.deep]).toEqual(['#c2bf8c', '#5fa3a2', '#21809a']);
    expect([GOLDEN_WATER_SHALLOW, GOLDEN_WATER_MID, GOLDEN_WATER_DEEP]).toEqual(['#c2bf8c', '#5fa3a2', '#21809a']);
    expect(look.surfaceFill).toBe(GOLDEN_WATER_SHALLOW);
    expect(look.haze).toBe('rgba(250,210,150,0.12)');
    expect(GOLDEN_HAZE).toBe(look.haze);
    expect(look.surfaceLine).toBe('rgba(255,240,206,0.95)');
    expect(GOLDEN_SURFACE_LINE).toBe(look.surfaceLine);
    expect(look.rayTint).toEqual([255, 222, 160]);
    expect(GOLDEN_RAY_TINT).toBe(look.rayTint);
    expect(look.raySlant).toBe(130);
    expect(GOLDEN_RAY_SLANT).toBeGreaterThan(DAY_RAY_SLANT);
    expect(look.rayAlphaScale).toBe(1);
    expect(look.lowerRowLight).toBe(true);
    expect(look.goldenDecor).toBe(true);
    expect(look.sinkingPetalsPerScreen).toBe(GOLDEN_SINKING_PETALS_PER_SCREEN);
    expect(GOLDEN_SINKING_PETALS_PER_SCREEN).toBe(1);
  });

  it('has warm shallow and mid water fading to the deep canal teal', () => {
    const deep = habitatLook('deep-canal').water;
    // Shallow: a warm gold-green, far warmer than the deep canal's aqua.
    expect(hueOf(look.water.shallow)).toBeGreaterThan(40);
    expect(hueOf(look.water.shallow)).toBeLessThan(70);
    // Mid: a teal, a little warmer than the deep canal's mid.
    expect(hueOf(look.water.mid)).toBeGreaterThan(160);
    expect(hueOf(look.water.mid)).toBeLessThan(hueOf(deep.mid));
    expect(luminance(look.water.shallow)).toBeGreaterThan(luminance(look.water.mid));
    expect(luminance(look.water.mid)).toBeGreaterThan(luminance(look.water.deep));
    // The hero stays the brightest thing in the water.
    expect(luminance(look.water.shallow)).toBeLessThan(luminance(LEUCISTIC.body));
    // The haze and the rays are warm: more red than blue.
    const haze = parseRgba(look.haze).rgb;
    expect(haze[0]).toBeGreaterThan(haze[2]);
    expect(look.rayTint[0]).toBeGreaterThan(look.rayTint[2]);
  });

  it('leaves every other look with white rays at the day slant, no lit row, no decorations and no petals', () => {
    expect(DAY_RAY_TINT).toEqual([255, 255, 255]);
    expect(DAY_RAY_SLANT).toBe(70);
    for (const id of AREA_LOOK_IDS.filter((other) => other !== GOLDEN)) {
      const other = habitatLook(id);
      // The late open lake (issue #213, Area 14) borrows the golden rays, but has no lit row, decorations or petals.
      if (id === 'open-lake-late') {
        expect(other.rayTint, id).toEqual(look.rayTint);
        expect(other.raySlant, id).toBe(look.raySlant);
      } else {
        expect(other.rayTint, id).toEqual([255, 255, 255]);
        expect(other.raySlant, id).toBe(70);
      }
      expect(other.lowerRowLight, id).toBe(false);
      expect(other.goldenDecor, id).toBe(false);
      expect(other.sinkingPetalsPerScreen, id).toBe(0);
    }
  });
});

describe('golden-hour contrast (guide 10, the deep canal contrast rule)', () => {
  const look = habitatLook(GOLDEN);
  const water = sampleGradient(
    [
      [0, look.water.shallow],
      [look.water.stopMid, look.water.mid],
      [1, look.water.deep],
    ],
    40,
  );
  const bed = sampleGradient(
    [
      [0, look.bed.top],
      [1, look.bed.bottom],
    ],
    40,
  );

  it('every water stop, haze blend and bed colour has luminance 0.1687 or more', () => {
    for (const hex of water) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(luminance(overlay(hex, look.haze)), `${hex} with haze`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
    for (const hex of bed) {
      for (const shown of [hex, overlay(hex, look.haze), overlay(hex, look.bed.mud), overlay(overlay(hex, look.bed.mud), look.haze)]) {
        expect(luminance(shown), shown).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      }
    }
    expect(luminance(look.bed.lip)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });

  it('the haze lightens every water stop', () => {
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      expect(luminance(overlay(look.water[stop], look.haze)), stop).toBeGreaterThan(luminance(look.water[stop]));
    }
  });

  it('documents the luminances the comments print', () => {
    const rows: readonly (readonly [string, number])[] = [
      [GOLDEN_WATER_SHALLOW, 0.5062],
      [GOLDEN_WATER_MID, 0.3124],
      [GOLDEN_WATER_DEEP, 0.1809],
      [overlay(GOLDEN_WATER_DEEP, GOLDEN_HAZE), 0.2144],
      [overlay(GOLDEN_SKY_TOP, GOLDEN_AIR_WASH), 0.4841],
      [overlay(GOLDEN_SKY_HORIZON, GOLDEN_AIR_WASH), 0.6943],
    ];
    for (const [hex, lum] of rows) expect(luminance(hex).toFixed(4), hex).toBe(lum.toFixed(4));
    expect(overlay(GOLDEN_WATER_DEEP, GOLDEN_HAZE)).toBe('#3b8a9a');
    expect(overlay(GOLDEN_SKY_TOP, GOLDEN_AIR_WASH)).toBe('#f2a78c');
    expect(overlay(GOLDEN_SKY_HORIZON, GOLDEN_AIR_WASH)).toBe('#ffd1a1');
  });
});

// ---------------------------------------------------------------------------
// Other looks stay as they were
// ---------------------------------------------------------------------------

const CASES: readonly (readonly [string, Omit<ChunkOptions, 'rand' | 'look'>, number])[] = [
  ['single', { index: 0, hasSun: true, hasBank: true, bankCapLeft: true, edgeLeft: true, edgeRight: true }, 1],
  ['top', { row: 'top', index: 1, hasSun: false, hasBank: true, bankCapRight: true, edgeLeft: true }, 3],
  ['middle', { row: 'middle', index: 1, hasSun: false, hasBank: false }, 4],
  ['bottom', { row: 'bottom', index: 3, hasSun: false, hasBank: false, edgeLeft: true, edgeRight: true }, 5],
];

describe('every other look paints exactly what it did on trunk', () => {
  /** Styled digests and random draw counts painted by trunk (afc94f8), before the golden look existed. The pond looks bake their stream. */
  const TRUNK: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
    canal: [
      ['18d47ad439a3db', 197],
      ['19571c25f534e8', 69],
      ['03839d6e81f3c4', 0],
      ['14f9012eaade3e', 128],
    ],
    pond: [
      ['00a54b1c245175', 266],
      ['06b622c482b30c', 69],
      ['0812d89af1afdf', 0],
      ['07130c1d7fd900', 197],
    ],
    'pond-dusk': [
      ['12f3625a1f74b9', 266],
      ['17e7c99e20b701', 69],
      ['0dcefaa3050023', 0],
      ['0d48dda275855c', 197],
    ],
    chinampa: [
      ['1f06da0aab2bc7', 175],
      ['0d00ad0ac579fd', 75],
      ['0f75d53b4a3b6b', 0],
      ['1bdb8929d7c2aa', 100],
    ],
    'spring-cave': [
      ['1e526c74bbee01', 163],
      ['08b23bfe762e1f', 63],
      ['13b81d896f08c8', 0],
      ['0782cda9651f14', 100],
    ],
    'deep-canal': [
      ['068514096cdc82', 131],
      ['169d5fd757b7cc', 69],
      ['06c16b56cd624d', 0],
      ['15a21ff789e079', 62],
    ],
  };

  const rows = Object.entries(TRUNK).flatMap(([look, pinned]) =>
    CASES.map(([name, opts, seed], i) => [`${look} ${name}`, look as AreaLookId, opts, seed, pinned[i][0], pinned[i][1]] as const),
  );

  it.each(rows)('%s: the same digest and random draws', (_name, look, opts, seed, digest, draws) => {
    const painted = chunkWithDraws({ ...opts, look, stream: look === 'pond' || look === 'pond-dusk' }, seed);
    expect(styledDigest(painted.rec)).toBe(digest);
    expect(painted.draws).toBe(draws);
  });

  it('covers every look from before the golden one and the open lake: the lake looks are new, so no trunk to match', () => {
    const lake: readonly AreaLookId[] = ['open-lake', 'open-lake-windy', 'open-lake-still', 'open-lake-late'];
    expect(Object.keys(TRUNK).sort()).toEqual(AREA_LOOK_IDS.filter((id) => id !== GOLDEN && !lake.includes(id)).sort());
  });

  it.each(CASES)('golden %s chunk: the same random draws as the deep canal; its painters draw none', (_name, opts, seed) => {
    expect(chunkWithDraws({ ...opts, look: GOLDEN }, seed).draws).toBe(chunkWithDraws({ ...opts, look: 'deep-canal' }, seed).draws);
  });
});

// ---------------------------------------------------------------------------
// Golden chunks
// ---------------------------------------------------------------------------

describe('golden-hour background chunks', () => {
  it('paints warm rays at the golden slant on a sky row', () => {
    const { rec } = chunkWithDraws({ row: 'top', index: 2, hasSun: false, hasBank: false, look: GOLDEN }, 3);
    const rays = rec.gradients.filter((g) => g.stops.length === 2 && g.stops[1][1] === 'rgba(255,222,160,0)');
    expect(rays).toHaveLength(3);
    for (const ray of rays) expect(ray.stops[0][1]).toMatch(/^rgba\(255,222,160,0\.\d{3}\)$/);
    const rayFills = rec.ops.filter((o) => o.op === 'fill' && rays.some((g) => JSON.stringify(o.fillStyle) === JSON.stringify(plain(g))));
    expect(rayFills).toHaveLength(3);
    for (const fill of rayFills) {
      const cmds = pathOf(fill)!;
      expect(cmds[2][2]).toBe(RAY_END_Y);
      expect((cmds[1][1] as number) - (cmds[2][1] as number)).toBeCloseTo(GOLDEN_RAY_SLANT, 6);
    }
  });

  it('paints its sky, water and wash from the golden look', () => {
    const { rec } = chunkWithDraws({ index: 0, hasSun: true, hasBank: true, bankCapLeft: true, look: GOLDEN }, 1);
    expect(rec.gradients[0].stops.map(([, c]) => c)).toEqual([GOLDEN_SKY_TOP, GOLDEN_SKY_HORIZON]);
    expect(rec.gradients[1].stops.map(([, c]) => c)).toEqual([GOLDEN_WATER_SHALLOW, GOLDEN_WATER_MID, GOLDEN_WATER_DEEP]);
    expect(rec.ops.filter((o) => o.fillStyle === GOLDEN_AIR_WASH)).toHaveLength(1);
  });

  it('paints the decorations after every deep canal step, and the lit row last on a bottom chunk', () => {
    const opts = { row: 'bottom', index: 4, hasSun: false, hasBank: false, edgeLeft: false, edgeRight: false } as const;
    const deep = chunkWithDraws({ ...opts, look: 'deep-canal' }, 5).rec;
    const golden = chunkWithDraws({ ...opts, look: GOLDEN }, 5).rec;
    const decor = decorOf(goldenChunk('bottom', 4)).ops;
    const lit = litOf(4).ops;
    expect(decor.length).toBeGreaterThan(0);
    expect(golden.ops).toHaveLength(deep.ops.length + decor.length + lit.length);
    expect(drawn(golden.ops.slice(0, deep.ops.length))).toBe(drawn(deep.ops));
    expect(drawn(golden.ops.slice(deep.ops.length, deep.ops.length + decor.length))).toBe(drawn(decor));
    expect(drawn(golden.ops.slice(-lit.length))).toBe(drawn(lit));
    const stoneAt = golden.ops.flatMap((o, i) => ([CANAL_STONE, CANAL_STONE_LIGHT, CANAL_STONE_DARK].includes(o.fillStyle as string) ? [i] : []));
    expect(stoneAt.length).toBeGreaterThan(0);
    expect(Math.max(...stoneAt)).toBeLessThan(deep.ops.length);
  });

  it('lights only a bottom row: a sky row and a middle row get no light', () => {
    for (const row of ['single', 'top', 'middle'] as const) {
      const { rec } = chunkWithDraws({ row, index: 2, hasSun: false, hasBank: false, look: GOLDEN }, 2);
      expect(rec.ops.filter((o) => o.blend === 'screen'), row).toHaveLength(0);
    }
  });

  it('paints nothing over a middle chunk, which every column of a tall area shares', () => {
    const middle = chunkWithDraws({ row: 'middle', index: 1, hasSun: false, hasBank: false, edgeLeft: true, look: GOLDEN }, 4).rec;
    expect(middle.ops).toHaveLength(1);
    expect(middle.ops[0].fillStyle).toBe(GOLDEN_WATER_DEEP);
  });

  it('paints the same chunk twice: no time and no extra randomness', () => {
    const opts = { row: 'top', index: 1, hasSun: false, hasBank: true, look: GOLDEN, edgeLeft: true } as const;
    expect(styledDigest(chunkWithDraws(opts, 9).rec)).toBe(styledDigest(chunkWithDraws(opts, 9).rec));
  });
});

// ---------------------------------------------------------------------------
// Readability and shape rules
// ---------------------------------------------------------------------------

describe('golden-hour decorations stay scenery (guide 2, 10)', () => {
  const { top, bottom } = wholeAreaDecor();
  const ops = [...top, ...bottom];

  it('every decoration fill is darker than the hero belly, less colourful than the default body and over the floor', () => {
    const bellyLum = luminance(LEUCISTIC.belly);
    const bodyChroma = oklchChroma(LEUCISTIC.body);
    for (const hex of GOLDEN_DECOR_FILLS) {
      expect(luminance(hex), hex).toBeLessThan(bellyLum);
      expect(oklchChroma(hex), hex).toBeLessThan(bodyChroma);
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
  });

  it('paints only those fills, and only ink or a decoration colour as a line', () => {
    const fills = new Set(ops.filter((o) => o.op === 'fill' || o.op === 'fillRect').map((o) => o.fillStyle));
    for (const fill of fills) expect(GOLDEN_DECOR_FILLS, String(fill)).toContain(fill);
    const strokes = new Set(ops.filter((o) => o.op === 'stroke').map((o) => o.strokeStyle));
    for (const stroke of strokes) expect([INK, BANNER_STRING, ...GOLDEN_DECOR_FILLS], String(stroke)).toContain(stroke);
    for (const o of ops) expect(o.globalAlpha).toBe(1);
  });

  it('never paints text: no letters on the banners or the name-boards', () => {
    const all = [...ops, ...litOf(3).ops, ...record(paintSinkingPetal).ops];
    expect(all.some((o) => o.op === 'fillText' || o.op === 'strokeText')).toBe(false);
  });

  it('has no pointed shapes: two straight edges never meet at a corner sharper than 30 degrees of turn', () => {
    for (const o of ops) {
      const cmds = pathOf(o);
      if (cmds === null) continue;
      for (const corner of sharpCorners(cmds)) expect(corner).toBeLessThan(30);
    }
  });

  it('cuts round holes in the papel picado flags (even-odd), and every flag hangs in the sky strip', () => {
    const flags = ops.filter((o) => o.op === 'fill' && o.args[1] === 'evenodd');
    expect(flags.length).toBeGreaterThan(20);
    for (const flag of flags) {
      expect(PAPEL_PICADO_COLOURS).toContain(flag.fillStyle);
      const holes = pathOf(flag)!.filter(([name]) => name === 'ellipse');
      expect(holes.length).toBeGreaterThanOrEqual(6);
      const { minY, maxY } = extentOf(flag);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxY).toBeLessThanOrEqual(86);
    }
  });

  it('floats the marigold patches just under the surface line, under the haze', () => {
    const patches = top.filter((o) => o.op === 'fill' && o.args.length === 1 && o.fillStyle === MARIGOLD_PETAL);
    expect(patches.length).toBeGreaterThanOrEqual(MARIGOLD_PATCHES.length);
    for (const patch of patches) {
      const { minY, maxY } = extentOf(patch);
      expect(minY).toBeGreaterThan(SURF);
      expect(maxY).toBeLessThan(SURF + 12);
    }
  });

  it('keeps the rafts and the patches apart, and every table in world order', () => {
    for (const raft of HYACINTH_RAFTS) {
      for (const patch of MARIGOLD_PATCHES) expect(Math.abs(raft.x - patch.x), `${raft.x} ${patch.x}`).toBeGreaterThan((raft.w + patch.w) / 2 + 20);
    }
    for (const xs of [
      PAPEL_PICADO_BANNERS.map((b) => b.x0),
      MARIGOLD_PATCHES.map((p) => p.x),
      HYACINTH_RAFTS.map((r) => r.x),
      SUNKEN_ARCHES.map((a) => a.x),
    ]) {
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    }
  });

  it('stands each sunken arch on its own bed edge, with no dark opening', () => {
    for (const arch of SUNKEN_ARCHES) {
      const index = Math.floor(arch.x / VIEW_W);
      const painted = decorOf(goldenChunk('bottom', index)).ops;
      const silt = painted.filter((o) => o.fillStyle === habitatLook('deep-canal').bed.top);
      expect(silt.length, String(arch.x)).toBeGreaterThan(0);
      const feet = silt.flatMap((o) => pathOf(o)!.filter(([name]) => name === 'ellipse'));
      expect(feet, String(arch.x)).toHaveLength(2);
      for (const [, , y] of feet) expect(Math.abs(y - (bedEdgeY(arch.x) + 5)), String(arch.x)).toBeLessThan(6);
      const darkest = Math.min(...painted.filter((o) => o.op !== 'stroke' || o.strokeStyle !== INK).map((o) => fillLuminance(o)));
      expect(darkest, String(arch.x)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
  });
});

// ---------------------------------------------------------------------------
// Seams
// ---------------------------------------------------------------------------

describe('golden-hour seams (guide 7a)', () => {
  /** Ops of one chunk that run past its right edge (or left edge), as world keys. */
  const crossing = (painted: readonly Op[], wx0: number, edge: 'left' | 'right'): string[] =>
    painted.filter((o) => (edge === 'right' ? extentOf(o).maxX > VIEW_W : extentOf(o).minX < 0)).map((o) => worldKey(o, wx0));

  const rowsOf = (i: number): (readonly [string, Op[]])[] => [
    ['top', decorOf(goldenChunk('top', i, { bank: { capLeft: false, capRight: false } })).ops],
    ['bottom', decorOf(goldenChunk('bottom', i)).ops],
    ['lit', litOf(i).ops],
  ];

  it('paints every decoration and shaft that crosses a chunk edge the same, in world coordinates, in both chunks', () => {
    let crossings = 0;
    for (let i = 0; i < 9; i++) {
      const left = rowsOf(i);
      const right = rowsOf(i + 1);
      for (let r = 0; r < left.length; r++) {
        const [row, leftOps] = left[r];
        const rightOps = right[r][1];
        const leftKeys = new Set(leftOps.map((o) => worldKey(o, i * VIEW_W)));
        const rightKeys = new Set(rightOps.map((o) => worldKey(o, (i + 1) * VIEW_W)));
        for (const key of crossing(leftOps, i * VIEW_W, 'right')) expect(rightKeys.has(key), `${row} ${i}: ${key}`).toBe(true);
        for (const key of crossing(rightOps, (i + 1) * VIEW_W, 'left')) expect(leftKeys.has(key), `${row} ${i + 1}: ${key}`).toBe(true);
        crossings += crossing(leftOps, i * VIEW_W, 'right').length;
      }
    }
    expect(crossings).toBeGreaterThan(50);
  });

  it('has at least one banner, patch, raft and arch that crosses a chunk edge', () => {
    const crosses = (x0: number, x1: number): boolean => Math.floor(x0 / VIEW_W) !== Math.floor(x1 / VIEW_W);
    expect(PAPEL_PICADO_BANNERS.some((b) => crosses(b.x0, b.x1))).toBe(true);
    expect(MARIGOLD_PATCHES.some((p) => crosses(p.x - p.w / 2, p.x + p.w / 2))).toBe(true);
    expect(HYACINTH_RAFTS.some((r) => crosses(r.x - r.w / 2, r.x + r.w / 2))).toBe(true);
    expect(SUNKEN_ARCHES.some((a) => crosses(a.x - 50, a.x + 50))).toBe(true);
    expect(LIT_SHAFT_SPACING % VIEW_W).not.toBe(0);
  });

  it('keeps every sky-row decoration clear of the row line and every bed-row decoration clear of the chunk top', () => {
    for (let i = 0; i < 10; i++) {
      for (const o of decorOf(goldenChunk('top', i, { bank: { capLeft: false, capRight: false } })).ops) {
        expect(extentOf(o).maxY, `top ${i}`).toBeLessThan(VIEW_H - 100);
      }
      for (const o of decorOf(goldenChunk('bottom', i)).ops) expect(extentOf(o).minY, `bottom ${i}`).toBeGreaterThan(100);
    }
  });

  it('lights the lower row with the screen blend only, clear at the chunk top so the rows meet', () => {
    const lit = litOf(5);
    expect(lit.ops.length).toBeGreaterThan(1);
    for (const o of lit.ops) {
      expect(o.blend).toBe('screen');
      const style = o.fillStyle as { gradient: number[]; stops: [number, string][] };
      expect(style.gradient[0]).toBe(style.gradient[2]);
      for (const [, colour] of style.stops) expect(parseRgba(colour).rgb).toEqual([...GOLDEN_LIGHT_RGB]);
      const { minY } = extentOf(o);
      if (minY <= 0) {
        expect(style.gradient[1]).toBe(0);
        expect(style.stops[0][0]).toBe(0);
        expect(parseRgba(style.stops[0][1]).alpha).toBe(0);
      }
      expect(minY).toBeGreaterThanOrEqual(0);
    }
  });

  it('runs an edge wall past the row line in both rows, on the same stakes and the same withy grid', () => {
    for (const side of ['edgeLeft', 'edgeRight'] as const) {
      const index = side === 'edgeLeft' ? 0 : 9;
      const wallOf = (row: ChunkRow): Op[] => {
        const plainOps = decorOf(goldenChunk(row, index)).ops;
        return decorOf(goldenChunk(row, index, { [side]: true })).ops.slice(plainOps.length);
      };
      const top = wallOf('top');
      const bottom = wallOf('bottom');
      const stakesOf = (ops: readonly Op[]): Op[] => ops.filter((o) => o.op === 'stroke' && o.strokeStyle === WALL_STAKE);
      const xsOf = (ops: readonly Op[]): string => JSON.stringify(ops.map((o) => [extentOf(o).minX, extentOf(o).maxX]));
      expect(stakesOf(top)).toHaveLength(3);
      expect(xsOf(stakesOf(top))).toBe(xsOf(stakesOf(bottom)));
      for (const o of stakesOf(top)) expect(extentOf(o).maxY).toBeGreaterThan(VIEW_H);
      for (const o of stakesOf(bottom)) expect(extentOf(o).minY).toBeLessThan(0);
      const backOf = (ops: readonly Op[]): Op => ops.find((o) => o.op === 'fillRect' && o.fillStyle === WALL_BACK)!;
      expect(extentOf(backOf(top)).maxY).toBeGreaterThan(VIEW_H);
      expect(extentOf(backOf(bottom)).minY).toBeLessThan(0);
      expect([extentOf(backOf(top)).minX, extentOf(backOf(top)).maxX]).toEqual([extentOf(backOf(bottom)).minX, extentOf(backOf(bottom)).maxX]);
      const withyYs = (ops: readonly Op[]): number[] =>
        ops.filter((o) => o.op === 'stroke' && o.strokeStyle === WALL_WEAVE).map((o) => (pathOf(o)![0][2] as number));
      expect(withyYs(top)).toContain(VIEW_H);
      expect(withyYs(bottom)).toContain(0);
      for (const y of [...withyYs(top), ...withyYs(bottom)]) expect(y % EDGE_WEAVE_STEP).toBe(0);
      expect(VIEW_H % EDGE_WEAVE_STEP).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Sinking petal
// ---------------------------------------------------------------------------

describe('sinking marigold petal (issue #112)', () => {
  const painted = record(paintSinkingPetal);

  it('is one round, thinly inked petal with a lighter fold line, inside its frame', () => {
    const fills = painted.ops.filter((o) => o.op === 'fill');
    expect(fills).toHaveLength(1);
    expect(fills[0].fillStyle).toBe(MARIGOLD_PETAL);
    expect(pathOf(fills[0])!.filter(([name]) => name === 'ellipse')).toHaveLength(1);
    for (const o of painted.ops) {
      const { minX, maxX, minY, maxY } = extentOf(o);
      expect(minX).toBeGreaterThanOrEqual(-SINKING_PETAL_TEX.originX);
      expect(minY).toBeGreaterThanOrEqual(-SINKING_PETAL_TEX.originY);
      expect(maxX).toBeLessThanOrEqual(SINKING_PETAL_TEX.w - SINKING_PETAL_TEX.originX);
      expect(maxY).toBeLessThanOrEqual(SINKING_PETAL_TEX.h - SINKING_PETAL_TEX.originY);
    }
  });

  it('is still: the same petal twice', () => {
    expect(styledDigest(record(paintSinkingPetal))).toBe(styledDigest(painted));
  });
});
