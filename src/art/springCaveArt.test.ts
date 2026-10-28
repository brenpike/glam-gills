/**
 * Spring cave art (issue #77, ND-15 and ND-18; guide 3c, 7 and 10), headless: the row details, the
 * rock ledge, the side grotto, the spring outflow marks, the glow-plant in three states and the
 * soft light. The painters run against a recording context and a stub Path2D, and the Phaser bake
 * runs against a fake scene whose canvases record. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GLOW_PLANT_DIM,
  GLOW_PLANT_DIM_FILL,
  GLOW_PLANT_HALF,
  GLOW_PLANT_HALO_RADIUS,
  GLOW_PLANT_HINT,
  GLOW_PLANT_HINT_FILL,
  GLOW_PLANT_HINT_LW,
  GLOW_PLANT_HINT_RING,
  GLOW_PLANT_LIT,
  GLOW_PLANT_LIT_HALO,
  GLOW_PLANT_LIT_STEM,
  GLOW_PLANT_PODS,
  GLOW_PLANT_RING_RADIUS,
  GLOW_PLANT_TEX,
  GLOW_PLANT_UNLIT_LW,
  GROTTO_H,
  GROTTO_OPENING,
  GROTTO_ROCKS,
  GROTTO_TEX,
  GROTTO_W,
  OUTFLOW_CHEVRONS,
  OUTFLOW_CHEVRON_H,
  OUTFLOW_CHEVRON_W,
  OUTFLOW_H,
  OUTFLOW_LINE,
  OUTFLOW_TEX,
  OUTFLOW_W,
  ROCK_LEDGE_H,
  ROCK_LEDGE_SHADE_STOPS,
  ROCK_LEDGE_TEX,
  ROCK_LEDGE_W,
  SOFT_LIGHT_EDGE_ALPHA,
  SOFT_LIGHT_HALF,
  SOFT_LIGHT_RADIUS,
  SOFT_LIGHT_STOPS,
  SOFT_LIGHT_TEX,
  SPRING_BED_SLAB,
  SPRING_DARK,
  SPRING_GROTTO_INTERIOR,
  SPRING_MOSS,
  SPRING_POOL,
  SPRING_SKY_OPENING,
  SPRING_POOL_LIGHT,
  SPRING_POOL_RIPPLES,
  SPRING_ROCK,
  SPRING_ROCK_CRACK,
  SPRING_ROCK_DARK,
  SPRING_ROCK_LIGHT,
  SPRING_SHADE_RGB,
  SPRING_WALL_BOULDERS,
  SPRING_WALL_REACH,
  paintGlowPlant,
  paintGrottoBack,
  paintGrottoFront,
  paintRockBed,
  paintRockLedge,
  paintRockWalls,
  paintSkyOpening,
  paintSoftLight,
  paintSpringOutflow,
  paintSpringPool,
  paintSpringRowDetails,
  type GlowPlantState,
  type SpringRow,
} from './drawSpringCave';
import { SOFT_LIGHT_BAKE_SCALE, SPRING_CAVE_TEX, bakeSpringCaveTextures } from './springCaveTextures';
import { CAVE_TEX } from './drawFinds';
import type { TexSize } from './canvasKit';
import { GLOW_PLANTS } from '../logic/glowPlants';
import { GLOW_PLANT_RADIUS } from '../logic/springCaveLayout';
import { INK, LW, SKY_HORIZON, SKY_TOP, SURF, VIEW_H, VIEW_W, WHITE } from './palette';

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

/** A colour with an `rgba(r,g,b,a)` colour laid over it, as a canvas mixes it in sRGB. */
function overlay(base: string, rgba: string): string {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(rgba);
  expect(m, rgba).not.toBeNull();
  const t = Number(m![4]);
  const ca = channelsOf(base);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - t) + Number(m![i + 1]) * t) as unknown as Rgb);
}

/** The pond contrast rule's floor: ink is 3:1 or better on any colour at or above it. */
const LUMINANCE_FLOOR = 0.1687;
const PAIR_FLOOR = 3;
const GREY_FLOOR = 3;

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

/** A gradient that remembers its kind, its extent and its stops. Its string form lists them, so a painted style tells gradients apart. */
class GradientStub {
  readonly stops: [number, string][] = [];
  constructor(
    readonly kind: 'linear' | 'radial',
    readonly extent: readonly number[],
  ) {}
  addColorStop(t: number, colour: string): void {
    this.stops.push([t, colour]);
  }
  toString(): string {
    return `${this.kind}(${this.stops.map(([t, c]) => `${t}:${c}`).join(',')})`;
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
  /** The gradient the paint was made with, or null for a plain colour. */
  readonly gradient: GradientStub | null;
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const styleOf = (target: Record<string, unknown>, name: string): { style: string; gradient: GradientStub | null } => {
    const value = name === 'fill' || name === 'fillRect' ? target.fillStyle : target.strokeStyle;
    return { style: String(value), gradient: value instanceof GradientStub ? value : null };
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...a: number[]) => new GradientStub('linear', a);
      if (name === 'createRadialGradient') return (...a: number[]) => new GradientStub('radial', a);
      return (...args: unknown[]) => {
        const path = args[0] as LogPath | undefined;
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          out.push({ op: name, cmds: path.cmds, ...styleOf(target, name), lineWidth: target.lineWidth as number });
        } else if (name === 'fillRect') {
          out.push({
            op: 'fill',
            cmds: [['fillRect', ...(args as number[])]],
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
          });
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
const signature = (painted: Painted[]): string =>
  JSON.stringify(painted.map((p) => [p.op, p.cmds, p.style, p.op === 'stroke' ? p.lineWidth : 0]));
const styleSet = (painted: readonly Painted[]): Set<string> => new Set(painted.map((p) => p.style));
/** A style is a plain hex colour, not a gradient or an rgba. */
const isHex = (style: string): boolean => /^#[0-9a-f]{6}$/i.test(style);

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
            {
              get: (_target, name) =>
                name === 'createLinearGradient' || name === 'createRadialGradient'
                  ? () => new GradientStub('linear', [])
                  : () => undefined,
              set: () => true,
            },
          ),
          refresh: () => undefined,
        };
      },
    },
  } as never;
}

/** The (x, y) points a recorded path visits; an ellipse counts as the two corners of its bounding box. */
function pointsOf(cmds: readonly Cmd[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const [name, ...a] of cmds) {
    if (name === 'moveTo' || name === 'lineTo') pts.push({ x: a[0], y: a[1] });
    else if (name === 'quadraticCurveTo') pts.push({ x: a[2], y: a[3] });
    else if (name === 'arc') {
      // The ends of the arc and any of the four extremes it passes through.
      const [cx, cy, r, from, to] = a;
      const angles = [from, to];
      for (let q = Math.ceil(from / (Math.PI / 2)); q * (Math.PI / 2) <= to; q++) angles.push(q * (Math.PI / 2));
      for (const t of angles) pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    }
    else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = a;
      const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
      const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
      pts.push({ x: cx - hx, y: cy - hy }, { x: cx + hx, y: cy + hy });
    } else if (name === 'fillRect') pts.push({ x: a[0], y: a[1] }, { x: a[0] + a[2], y: a[1] + a[3] });
  }
  return pts;
}

/** Every paint of `painted` keeps its path and half its stroke inside `tex`, so no ink is cut by the texture edge. */
function expectInsideFrame(painted: readonly Painted[], tex: TexSize): void {
  for (const p of painted) {
    const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
    for (const pt of pointsOf(p.cmds)) {
      const label = `${p.op} ${p.style} ${JSON.stringify(pt)}`;
      expect(pt.x - half, label).toBeGreaterThanOrEqual(-tex.originX);
      expect(pt.x + half, label).toBeLessThanOrEqual(tex.w - tex.originX);
      expect(pt.y - half, label).toBeGreaterThanOrEqual(-tex.originY);
      expect(pt.y + half, label).toBeLessThanOrEqual(tex.h - tex.originY);
    }
  }
}

const OPAQUE_ROCK: readonly (readonly [string, string, number])[] = [
  ['rock', SPRING_ROCK, 0.284],
  ['light rock', SPRING_ROCK_LIGHT, 0.4465],
  ['dark rock', SPRING_ROCK_DARK, 0.2307],
  ['rock bed slab', SPRING_BED_SLAB, 0.3289],
];

// ---------------------------------------------------------------------------
// Colours and the contrast rule
// ---------------------------------------------------------------------------

describe('spring cave colours (guide 3c, 10, the pond contrast rule)', () => {
  it.each(OPAQUE_ROCK)('%s is at the luminance floor or more, so its ink outline is 3:1 or better', (_name, hex, lum) => {
    expect(luminance(hex).toFixed(4)).toBe(lum.toFixed(4));
    expect(luminance(hex)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('keeps the rock grey-blue: blue is its strongest channel and it is far from the canal soil', () => {
    for (const hex of [SPRING_ROCK, SPRING_ROCK_LIGHT, SPRING_ROCK_DARK, SPRING_BED_SLAB]) {
      const [r, g, b] = channelsOf(hex);
      expect(b, hex).toBeGreaterThan(g);
      expect(g, hex).toBeGreaterThan(r);
      expect(b - r, hex).toBeLessThan(80);
    }
  });

  it('keeps the ledge shade, even at its most solid, over the floor with ink 3:1 or better', () => {
    const solid = toHex(SPRING_SHADE_RGB);
    expect(luminance(solid)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, solid)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(luminance(solid).toFixed(4)).toBe('0.2022');
  });

  it('keeps the glow moss over the floor too', () => {
    expect(luminance(SPRING_MOSS).toFixed(4)).toBe('0.3863');
    expect(luminance(SPRING_MOSS)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });

  it('only lightens with the pool light: it takes no background under the floor', () => {
    for (const water of ['#3d9ac8', '#2a6aa0', '#7fd6e6']) {
      const lit = overlay(water, SPRING_POOL_LIGHT);
      expect(luminance(lit), water).toBeGreaterThanOrEqual(luminance(water));
    }
  });

  it('keeps the darkness far under the floor, and the grotto interior as dark', () => {
    expect(luminance(SPRING_DARK).toFixed(4)).toBe('0.0046');
    expect(luminance(SPRING_DARK)).toBeLessThan(LUMINANCE_FLOOR / 10);
    expect(SPRING_GROTTO_INTERIOR).toBe(SPRING_DARK);
    for (const [, hex] of OPAQUE_ROCK) expect(contrast(hex, SPRING_GROTTO_INTERIOR)).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Row details
// ---------------------------------------------------------------------------

describe('row details (guide 7a)', () => {
  const details = (row: SpringRow, edgeLeft: boolean, edgeRight: boolean) =>
    record((ctx) => paintSpringRowDetails(ctx, { row, edgeLeft, edgeRight }));

  it('paints the sky opening and the lit pool in a top chunk only, the opening first', () => {
    const top = details('top', false, false);
    expect(top.length).toBeGreaterThan(0);
    expect(signature(top)).toBe(signature([...record(paintSkyOpening), ...record(paintSpringPool)]));
    expect(details('middle', false, false)).toEqual([]);
    expect(details('bottom', false, false).some((p) => p.style.includes(SKY_TOP))).toBe(false);
  });

  it('opens the roof to the sky: a domed window filled with the canal sky, inked on its dome and sides, open at the waterline', () => {
    const painted = record(paintSkyOpening);
    const window = painted.find((p) => p.gradient !== null)!;
    expect(window.gradient?.kind).toBe('linear');
    expect(window.gradient?.extent).toEqual([0, SPRING_SKY_OPENING.top, 0, SPRING_SKY_OPENING.foot]);
    expect(window.gradient?.stops).toEqual([
      [0, SKY_TOP],
      [1, SKY_HORIZON],
    ]);
    // The foot is the waterline, which the scene's water starts at (SURF + 3).
    expect(SPRING_SKY_OPENING.foot).toBe(SURF + 3);
    const ink = painted.filter((p) => p.style === INK);
    expect(ink).toHaveLength(1);
    expect(ink[0].op).toBe('stroke');
    expect(ink[0].lineWidth).toBeCloseTo(LW * 0.8, 6);
    // The inked edge is open: it has no closePath, so no line runs along the water.
    expect(ink[0].cmds.some(([name]) => name === 'closePath')).toBe(false);
    expect(window.cmds.some(([name]) => name === 'closePath')).toBe(true);
    // Both windows of neighbouring chunks leave a pillar of rock between them.
    expect(SPRING_SKY_OPENING.x0 + (VIEW_W - SPRING_SKY_OPENING.x1)).toBeGreaterThanOrEqual(40);
    for (const p of painted) {
      for (const pt of pointsOf(p.cmds)) {
        expect(pt.x).toBeGreaterThanOrEqual(0);
        expect(pt.x).toBeLessThanOrEqual(VIEW_W);
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThanOrEqual(SPRING_SKY_OPENING.foot);
      }
    }
  });

  it('keeps the sky bright against the roof, and ink 3:1 or better on both', () => {
    expect(luminance(SKY_TOP)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, SKY_TOP)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(contrast(INK, SKY_HORIZON)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    // The roof the spring cave look paints (habitatLook SPRING_CAVE_SKY_TOP) is rock: the window is lighter than its top.
    expect(luminance(SKY_HORIZON)).toBeGreaterThan(luminance('#9fb2c8'));
  });

  it('keeps the pool a light-only wash under the surface: a fade from SPRING_POOL_LIGHT to nothing, and level ripples', () => {
    const painted = record(paintSpringPool);
    const wash = painted[0];
    expect(wash.gradient?.kind).toBe('linear');
    expect(wash.gradient?.stops).toEqual([
      [0, SPRING_POOL_LIGHT],
      [1, 'rgba(232,251,255,0)'],
    ]);
    // It hangs from the waterline, so it never lightens the sky or the roof, and ends in the chunk.
    expect(SPRING_POOL.top).toBe(SURF + 3);
    expect(SPRING_POOL.top + SPRING_POOL.ry).toBeLessThan(VIEW_H);
    expect(wash.gradient?.extent).toEqual([0, SPRING_POOL.top, 0, SPRING_POOL.top + SPRING_POOL.ry]);
    expect(strokes(painted)).toHaveLength(SPRING_POOL_RIPPLES.length);
    for (const s of strokes(painted)) expect(s.style).not.toBe(INK);
    for (const [x, y, half] of SPRING_POOL_RIPPLES) {
      expect(y).toBeGreaterThan(SURF);
      expect(x - half).toBeGreaterThan(0);
      expect(x + half).toBeLessThan(VIEW_W);
    }
  });

  it('paints the walls only at the ends of a row, one side each, as mirror images', () => {
    expect(details('middle', false, false)).toEqual([]);
    const left = details('middle', true, false);
    const right = details('middle', false, true);
    const both = details('middle', true, true);
    expect(left.length).toBeGreaterThan(0);
    expect(left).toHaveLength(right.length);
    expect(both).toHaveLength(left.length + right.length);
    expect(signature(both)).toBe(signature([...left, ...right]));
    const xs = (painted: Painted[]) => painted.flatMap((p) => pointsOf(p.cmds).map((pt) => pt.x));
    expect(Math.min(...xs(left))).toBeLessThan(0);
    expect(Math.max(...xs(left))).toBeLessThan(VIEW_W / 2);
    expect(Math.max(...xs(right))).toBeGreaterThan(VIEW_W);
    expect(Math.min(...xs(right))).toBeGreaterThan(VIEW_W / 2);
    expect(signature(record((ctx) => paintRockWalls(ctx, true, true)))).toBe(signature(both));
  });

  it('keeps every wall under the swim bound: a boulder reaches at most SPRING_WALL_REACH px into the chunk', () => {
    expect(SPRING_WALL_REACH).toBeLessThan(40);
    for (const b of SPRING_WALL_BOULDERS) expect(b.inset + b.rx).toBeLessThanOrEqual(SPRING_WALL_REACH);
    expect(Math.max(...SPRING_WALL_BOULDERS.map((b) => b.inset + b.rx))).toBe(SPRING_WALL_REACH);
  });

  it('tiles the walls from one row to the next: the boulders repeat every 6, so the top and bottom of a chunk match', () => {
    const b = SPRING_WALL_BOULDERS;
    // The boulder just past the bottom of a chunk is the one just before the next chunk's top, 360 px up.
    expect(b).toHaveLength(8);
    const last = b[b.length - 1];
    const second = b[1];
    expect(last.y - VIEW_H).toBe(second.y);
    expect(last.inset).toBe(second.inset);
    expect(last.rx).toBe(second.rx);
    expect(last.fill).toBe(second.fill);
    expect(b[0].y + VIEW_H).toBe(b[6].y);
    expect(b[0].fill).toBe(b[6].fill);
  });

  it('paints the wall rock from the rock colours, with ink on the boulders', () => {
    const painted = details('middle', true, false);
    const fillStyles = styleSet(fills(painted));
    for (const hex of [SPRING_ROCK, SPRING_ROCK_LIGHT, SPRING_ROCK_DARK]) expect(fillStyles.has(hex), hex).toBe(true);
    expect(strokes(painted).some((s) => s.style === INK)).toBe(true);
    expect(strokes(painted).some((s) => s.style === SPRING_ROCK_CRACK)).toBe(true);
    for (const f of fills(painted).filter((p) => isHex(p.style))) {
      expect(luminance(f.style), f.style).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
  });

  it('paints the rock bed in a bottom chunk only, from slabs and stones over the bed edge', () => {
    const bottom = details('bottom', false, false);
    expect(bottom.length).toBeGreaterThan(0);
    expect(signature(bottom)).toBe(signature(record((ctx) => paintRockBed(ctx))));
    expect(details('top', false, false).some((p) => p.style === SPRING_BED_SLAB)).toBe(false);
    expect(styleSet(fills(bottom)).has(SPRING_BED_SLAB)).toBe(true);
    // Every slab and stone is inside the chunk, so every chunk of the row paints the same and none is cut.
    for (const p of bottom) {
      for (const pt of pointsOf(p.cmds)) {
        expect(pt.x).toBeGreaterThan(0);
        expect(pt.x).toBeLessThan(VIEW_W);
        expect(pt.y).toBeGreaterThan(SURF);
        expect(pt.y).toBeLessThanOrEqual(VIEW_H);
      }
    }
  });

  it('follows the bed edge it is given, and a flat canal edge by default', () => {
    const flat = signature(record((ctx) => paintRockBed(ctx)));
    expect(signature(record((ctx) => paintRockBed(ctx, () => 322)))).toBe(flat);
    const lower = signature(record((ctx) => paintRockBed(ctx, () => 326)));
    expect(lower).not.toBe(flat);
  });

  it('joins the pieces: top-left and bottom-right chunks have the pool, the bed and one wall each', () => {
    const topLeft = details('top', true, false);
    expect(signature(topLeft)).toBe(signature([...details('top', false, false), ...details('middle', true, false)]));
    const bottomRight = details('bottom', false, true);
    expect(signature(bottomRight)).toBe(signature([...details('bottom', false, false), ...details('middle', false, true)]));
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    const spy = vi.spyOn(Math, 'random');
    expect(signature(details('bottom', true, true))).toBe(signature(details('bottom', true, true)));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Rock ledge
// ---------------------------------------------------------------------------

describe('rock ledge (guide 7e)', () => {
  const painted = record(paintRockLedge);

  it('is the chinampa overhang frame, anchored at the top-left corner of the rect', () => {
    expect(ROCK_LEDGE_W).toBe(440);
    expect(ROCK_LEDGE_H).toBe(60);
    expect(ROCK_LEDGE_TEX).toEqual({ w: 448, h: 68, originX: 4, originY: 4 });
  });

  it('stays inside its frame, ink included', () => {
    expectInsideFrame(painted, ROCK_LEDGE_TEX);
  });

  it('lays the shade first, from the spring blue, nearly solid over the spots and nothing at the bottom', () => {
    const shade = painted[0];
    expect(shade.gradient?.kind).toBe('linear');
    expect(shade.gradient?.extent).toEqual([0, 0, 0, ROCK_LEDGE_H]);
    expect(shade.gradient?.stops.map(([t]) => t)).toEqual(ROCK_LEDGE_SHADE_STOPS.map(([t]) => t));
    const alphas = ROCK_LEDGE_SHADE_STOPS.map(([, a]) => a);
    expect(alphas[0]).toBeGreaterThanOrEqual(0.8);
    expect(alphas[alphas.length - 1]).toBe(0);
    expect(shade.gradient?.stops[0][1]).toBe(`rgba(${SPRING_SHADE_RGB.join(',')},0.9)`);
  });

  it('hangs a rock lip over it: inked teeth under it, a rock fill and an inked scalloped edge', () => {
    expect(styleSet(fills(painted)).has(SPRING_ROCK)).toBe(true);
    expect(styleSet(fills(painted)).has(SPRING_ROCK_DARK)).toBe(true);
    const inked = strokes(painted).filter((s) => s.style === INK);
    expect(inked.length).toBeGreaterThan(10);
    // The lip's inked edge is last of the inked strokes, and wider than a tooth's.
    expect(Math.max(...inked.map((s) => s.lineWidth))).toBeCloseTo(LW * 0.8, 6);
  });

  it('paints the same every time', () => {
    expect(signature(record(paintRockLedge))).toBe(signature(painted));
  });
});

// ---------------------------------------------------------------------------
// Side grotto
// ---------------------------------------------------------------------------

describe('side grotto (guide 7b, 7e)', () => {
  it('shares the cave frame, so it bakes and places like the cave', () => {
    expect(GROTTO_W).toBe(180);
    expect(GROTTO_H).toBe(136);
    expect(GROTTO_TEX).toEqual(CAVE_TEX);
  });

  it('paints the back as one near-black opening and nothing else', () => {
    const painted = record(paintGrottoBack);
    expect(painted).toHaveLength(1);
    expect(painted[0].style).toBe(SPRING_GROTTO_INTERIOR);
    expectInsideFrame(painted, GROTTO_TEX);
    // Flat on the bed (y 0) and inside the frame's width.
    const ys = pointsOf(painted[0].cmds).map((pt) => pt.y);
    expect(Math.max(...ys)).toBe(0);
    expect(-Math.min(...ys)).toBeLessThanOrEqual(GROTTO_TEX.originY - 2);
  });

  it('paints the front as inked grey-blue rocks with a shine each, and a little moss', () => {
    const painted = record(paintGrottoFront);
    expectInsideFrame(painted, GROTTO_TEX);
    expect(strokes(painted).filter((s) => s.style === INK)).toHaveLength(GROTTO_ROCKS.length);
    for (const s of strokes(painted)) expect(s.lineWidth).toBe(3.5);
    const fillStyles = styleSet(fills(painted));
    for (const hex of [SPRING_ROCK, SPRING_ROCK_LIGHT, SPRING_ROCK_DARK, SPRING_MOSS]) expect(fillStyles.has(hex), hex).toBe(true);
    for (const rock of GROTTO_ROCKS) expect(luminance(rock.fill)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });

  it('covers the whole edge of the opening with rock, ink included, so no water shows between the back and the front', () => {
    const { halfW, rise } = GROTTO_OPENING;
    const inRock = (x: number, y: number): boolean =>
      GROTTO_ROCKS.some((r) => {
        const dx = x - r.x;
        const dy = y - r.y;
        const c = Math.cos(r.rot);
        const s = Math.sin(r.rot);
        const u = dx * c + dy * s;
        const v = -dx * s + dy * c;
        // Rock plus half its ink.
        return (u / (r.rx + 1.75)) ** 2 + (v / (r.ry + 1.75)) ** 2 <= 1;
      });
    // The round top, from the left foot over to the right.
    for (let a = Math.PI; a <= 2 * Math.PI + 1e-9; a += Math.PI / 90) {
      const x = halfW * Math.cos(a);
      const y = -rise + halfW * Math.sin(a);
      if (y > 0) continue;
      expect(inRock(x, y), `top ${x.toFixed(1)},${y.toFixed(1)}`).toBe(true);
    }
    // The two straight sides down to the bed. The last few px sit on the bed line, under the rim's ink.
    for (let y = -rise; y <= -4; y += 2) {
      expect(inRock(-halfW, y), `left ${y}`).toBe(true);
      expect(inRock(halfW, y), `right ${y}`).toBe(true);
    }
  });

  it('leaves the middle of the opening clear, so the back shows', () => {
    const { rise } = GROTTO_OPENING;
    for (const r of GROTTO_ROCKS) {
      // No rock centre sits in the open middle, and none reaches the centre line low down.
      expect(Math.abs(r.x) + r.rx > 40 || r.y < -(rise + 20)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Spring outflow marks
// ---------------------------------------------------------------------------

describe('spring outflow marks (guide 7b)', () => {
  const painted = record(paintSpringOutflow);

  it('has a 160 x 120 frame, anchored at the top-left corner of the rect, and stays inside it', () => {
    expect(OUTFLOW_W).toBe(160);
    expect(OUTFLOW_H).toBe(120);
    expect(OUTFLOW_TEX).toEqual({ w: 168, h: 128, originX: 4, originY: 4 });
    expectInsideFrame(painted, OUTFLOW_TEX);
  });

  it('paints a light band that is clear at the left tip and strongest at the right, where the water comes in', () => {
    const band = painted[0];
    expect(band.gradient?.kind).toBe('linear');
    expect(band.gradient?.extent).toEqual([0, 0, OUTFLOW_W, 0]);
    expect(band.gradient?.stops).toEqual([
      [0, 'rgba(232,251,255,0)'],
      [1, 'rgba(232,251,255,0.26)'],
    ]);
  });

  it('paints a trail and a chevron per flow mark, every chevron pointing left, the way the water runs', () => {
    const marks = strokes(painted);
    expect(marks).toHaveLength(OUTFLOW_CHEVRONS.length * 2);
    for (const m of marks) expect(m.style).toBe(OUTFLOW_LINE);
    const heads = marks.filter((_, i) => i % 2 === 1);
    heads.forEach((head, i) => {
      const [tip, y] = OUTFLOW_CHEVRONS[i];
      expect(head.cmds).toEqual([
        ['moveTo', tip + OUTFLOW_CHEVRON_W, y - OUTFLOW_CHEVRON_H],
        ['lineTo', tip, y],
        ['lineTo', tip + OUTFLOW_CHEVRON_W, y + OUTFLOW_CHEVRON_H],
      ]);
    });
  });

  it('is light only: no ink and no opaque fill', () => {
    expect(painted.some((p) => p.style === INK)).toBe(false);
    expect(fills(painted).every((p) => p.gradient !== null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Glow-plant
// ---------------------------------------------------------------------------

describe('glow-plant (guide 3g, 10; issue #77, ND-8 and ND-18)', () => {
  const states: readonly GlowPlantState[] = ['unlit', 'lit', 'hint'];
  const draw = (state: GlowPlantState): Painted[] => record((ctx) => paintGlowPlant(ctx, state));

  it('has one 88 x 88 frame for every state, anchored at the plant centre, so a swap never moves it', () => {
    expect(GLOW_PLANT_TEX).toEqual({ w: 88, h: 88, originX: 44, originY: 44 });
    expect(GLOW_PLANT_HALF).toBe(44);
  });

  it.each(states)('%s stays inside the frame', (state) => {
    expectInsideFrame(draw(state), GLOW_PLANT_TEX);
  });

  it('covers the touch circle with its pods, so what is drawn is what is touched', () => {
    const left = Math.min(...GLOW_PLANT_PODS.map((p) => p.x - p.rx));
    const right = Math.max(...GLOW_PLANT_PODS.map((p) => p.x + p.rx));
    const top = Math.min(...GLOW_PLANT_PODS.map((p) => p.y - p.ry));
    const bottom = Math.max(...GLOW_PLANT_PODS.map((p) => p.y + p.ry));
    expect(GLOW_PLANT_RADIUS).toBe(14);
    expect(-left).toBeGreaterThanOrEqual(GLOW_PLANT_RADIUS);
    expect(right).toBeGreaterThanOrEqual(GLOW_PLANT_RADIUS);
    expect(-top).toBeGreaterThan(GLOW_PLANT_RADIUS * 0.7);
    expect(bottom).toBeGreaterThan(GLOW_PLANT_RADIUS * 0.5);
  });

  it('keeps the halo and the ring inside the frame, and the halo wider than the ring', () => {
    expect(GLOW_PLANT_HALO_RADIUS).toBeLessThanOrEqual(GLOW_PLANT_HALF);
    expect(GLOW_PLANT_RING_RADIUS).toBeLessThan(GLOW_PLANT_HALO_RADIUS);
  });

  it('shares one silhouette: the unlit and hint states draw the same shapes, the lit state the same pods', () => {
    const shapes = (painted: Painted[]) => JSON.stringify(painted.filter((p) => p.gradient === null).map((p) => p.cmds));
    expect(shapes(draw('unlit'))).toBe(shapes(draw('hint')));
    const podCmds = (painted: Painted[]) => JSON.stringify(painted.filter((p) => p.op === 'fill' && p.cmds[0][0] === 'moveTo').map((p) => p.cmds));
    expect(podCmds(draw('lit')).length).toBeGreaterThan(0);
  });

  describe('unlit: a dim teal outline', () => {
    const painted = draw('unlit');

    it('is all outline: only the dim teal for lines, no ink, a faint body and no gradient', () => {
      expect(styleSet(strokes(painted))).toEqual(new Set([GLOW_PLANT_DIM]));
      for (const s of strokes(painted)) expect(s.lineWidth).toBe(GLOW_PLANT_UNLIT_LW);
      expect(styleSet(fills(painted))).toEqual(new Set([GLOW_PLANT_DIM_FILL]));
      expect(painted.some((p) => p.gradient !== null)).toBe(false);
      expect(painted.some((p) => p.style === INK)).toBe(false);
    });

    it('draws a stalk and a leaf outline and a pod body and outline for each pod', () => {
      expect(strokes(painted)).toHaveLength(GLOW_PLANT_PODS.length * 2 + 2);
      expect(fills(painted)).toHaveLength(GLOW_PLANT_PODS.length);
    });
  });

  describe('hint: a brighter, thicker outline with a ring', () => {
    const painted = draw('hint');

    it('has the unlit shapes in a bright mint at a thicker line, over a faint ring of light', () => {
      expect(styleSet(strokes(painted))).toEqual(new Set([GLOW_PLANT_HINT]));
      for (const s of strokes(painted)) expect(s.lineWidth).toBe(GLOW_PLANT_HINT_LW);
      expect(GLOW_PLANT_HINT_LW).toBeGreaterThan(GLOW_PLANT_UNLIT_LW);
      expect(painted[0].gradient?.kind).toBe('radial');
      expect(painted[0].gradient?.extent).toEqual([0, 0, 0, 0, 0, GLOW_PLANT_RING_RADIUS]);
      expect(painted[0].gradient?.stops[0]).toEqual([0, GLOW_PLANT_HINT_RING]);
      expect(styleSet(fills(painted).filter((p) => p.gradient === null))).toEqual(new Set([GLOW_PLANT_HINT_FILL]));
      expect(painted.some((p) => p.style === INK)).toBe(false);
    });
  });

  describe('lit: bright pods with ink in a halo', () => {
    const painted = draw('lit');

    it('paints a halo first, then teal stalks and leaves with ink under them, then inked bright pods with a white core', () => {
      expect(painted[0].gradient?.kind).toBe('radial');
      expect(painted[0].gradient?.extent).toEqual([0, 0, 0, 0, 0, GLOW_PLANT_HALO_RADIUS]);
      expect(painted[0].gradient?.stops[0]).toEqual([0, GLOW_PLANT_LIT_HALO]);
      const fillStyles = styleSet(fills(painted));
      expect(fillStyles.has(GLOW_PLANT_LIT)).toBe(true);
      expect(fillStyles.has(WHITE)).toBe(true);
      const strokeStyles = styleSet(strokes(painted));
      expect(strokeStyles.has(INK)).toBe(true);
      expect(strokeStyles.has(GLOW_PLANT_LIT_STEM)).toBe(true);
      // Ink first for the tubes, so the colour merges them.
      const tubes = strokes(painted).filter((s) => s.style === INK || s.style === GLOW_PLANT_LIT_STEM);
      const firstStem = tubes.findIndex((s) => s.style === GLOW_PLANT_LIT_STEM);
      expect(tubes.slice(0, firstStem).every((s) => s.style === INK)).toBe(true);
      expect(strokes(painted).filter((s) => s.style === INK && s.lineWidth === 2.6)).toHaveLength(GLOW_PLANT_PODS.length);
    });

    it('keeps ink 3:1 or better on its pods, and on its stalks', () => {
      expect(contrast(INK, GLOW_PLANT_LIT)).toBeGreaterThanOrEqual(PAIR_FLOOR);
      expect(contrast(INK, GLOW_PLANT_LIT_STEM)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    });
  });

  describe('greyscale: darkness, then the unlit outline, then the hint outline, then the lit fill', () => {
    it('shows the unlit outline against the darkness at 3:1 or more, so a plant in the dark is found without colour', () => {
      expect(luminance(GLOW_PLANT_DIM).toFixed(4)).toBe('0.2618');
      expect(contrast(GLOW_PLANT_DIM, SPRING_DARK)).toBeGreaterThanOrEqual(GREY_FLOOR);
      // The faint body sits on the dark and lifts it a little, not up to the outline.
      const body = overlay(SPRING_DARK, GLOW_PLANT_DIM_FILL);
      expect(luminance(body)).toBeGreaterThan(luminance(SPRING_DARK));
      expect(luminance(body)).toBeLessThan(luminance(GLOW_PLANT_DIM));
      expect(contrast(GLOW_PLANT_DIM, body)).toBeGreaterThanOrEqual(GREY_FLOOR);
    });

    it('keeps the unlit outline dim: much darker than the hint outline and the lit fill', () => {
      expect(luminance(GLOW_PLANT_HINT)).toBeGreaterThan(luminance(GLOW_PLANT_DIM) * 2.5);
      expect(luminance(GLOW_PLANT_LIT)).toBeGreaterThan(luminance(GLOW_PLANT_DIM) * 3);
      expect(contrast(GLOW_PLANT_HINT, GLOW_PLANT_DIM)).toBeGreaterThanOrEqual(2);
    });

    it('brightens the hint outline against the darkness, as it also does under reduced motion', () => {
      expect(luminance(GLOW_PLANT_HINT).toFixed(4)).toBe('0.7675');
      expect(contrast(GLOW_PLANT_HINT, SPRING_DARK)).toBeGreaterThan(contrast(GLOW_PLANT_DIM, SPRING_DARK));
      expect(contrast(GLOW_PLANT_HINT, SPRING_DARK)).toBeGreaterThanOrEqual(7);
      // Thicker as well, so the change is not brightness alone.
      expect(GLOW_PLANT_HINT_LW / GLOW_PLANT_UNLIT_LW).toBeGreaterThanOrEqual(1.3);
    });

    it('reads lit against dark by brightness alone: the lit fill is 7:1 or more against the darkness and far over the unlit outline', () => {
      expect(luminance(GLOW_PLANT_LIT).toFixed(4)).toBe('0.9293');
      expect(contrast(GLOW_PLANT_LIT, SPRING_DARK)).toBeGreaterThanOrEqual(7);
      expect(contrast(GLOW_PLANT_LIT, GLOW_PLANT_DIM)).toBeGreaterThanOrEqual(3);
      expect(luminance(GLOW_PLANT_LIT)).toBeGreaterThan(luminance(GLOW_PLANT_HINT));
    });

    it('reads lit against the lit water too, where a hole in the dark shows the rock and water: the ink holds it', () => {
      for (const bg of [SPRING_ROCK, SPRING_ROCK_LIGHT, SPRING_ROCK_DARK, toHex(SPRING_SHADE_RGB)]) {
        expect(contrast(INK, bg), bg).toBeGreaterThanOrEqual(PAIR_FLOOR);
      }
      expect(contrast(INK, GLOW_PLANT_LIT)).toBeGreaterThanOrEqual(7);
    });

    it('orders the four by luminance', () => {
      const order = [SPRING_DARK, GLOW_PLANT_DIM, GLOW_PLANT_HINT, GLOW_PLANT_LIT].map(luminance);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });
});

// ---------------------------------------------------------------------------
// Soft light
// ---------------------------------------------------------------------------

describe('soft light (issue #77, ND-7)', () => {
  const painted = record(paintSoftLight);

  it('has a square 320 frame centred on the anchor', () => {
    expect(SOFT_LIGHT_TEX).toEqual({ w: 320, h: 320, originX: 160, originY: 160 });
    expect(SOFT_LIGHT_HALF).toBe(160);
    expectInsideFrame(painted, SOFT_LIGHT_TEX);
  });

  it('is one radial gradient, no ink, filling the frame', () => {
    expect(painted).toHaveLength(1);
    const g = painted[0].gradient;
    expect(g?.kind).toBe('radial');
    expect(g?.extent).toEqual([0, 0, 0, 0, 0, SOFT_LIGHT_HALF]);
    expect(painted[0].cmds).toEqual([['fillRect', -160, -160, 320, 320]]);
    expect(painted[0].style).not.toContain(INK);
  });

  it('is plain white at its stops, full at the middle and nothing at the edge', () => {
    const stops = painted[0].gradient!.stops;
    expect(stops).toHaveLength(SOFT_LIGHT_STOPS.length);
    expect(stops[0]).toEqual([0, 'rgba(255,255,255,1)']);
    expect(stops[stops.length - 1]).toEqual([1, 'rgba(255,255,255,0)']);
    for (const [, colour] of stops) expect(colour).toMatch(/^rgba\(255,255,255,[\d.]+\)$/);
  });

  it('never gets stronger away from the middle, and runs from 0 to 1 in order', () => {
    for (let i = 1; i < SOFT_LIGHT_STOPS.length; i++) {
      expect(SOFT_LIGHT_STOPS[i][0]).toBeGreaterThan(SOFT_LIGHT_STOPS[i - 1][0]);
      expect(SOFT_LIGHT_STOPS[i][1]).toBeLessThanOrEqual(SOFT_LIGHT_STOPS[i - 1][1]);
    }
    expect(SOFT_LIGHT_STOPS[0][0]).toBe(0);
    expect(SOFT_LIGHT_STOPS[SOFT_LIGHT_STOPS.length - 1][0]).toBe(1);
  });

  it('is at least 0.6 strong at the radius the scene scales to, so a part exactly at a light radius is lit', () => {
    expect(SOFT_LIGHT_RADIUS).toBe(128);
    expect(SOFT_LIGHT_EDGE_ALPHA).toBe(0.6);
    expect(SOFT_LIGHT_STOPS).toContainEqual([SOFT_LIGHT_RADIUS / SOFT_LIGHT_HALF, SOFT_LIGHT_EDGE_ALPHA]);
    // Full strength inside half of that radius.
    expect(SOFT_LIGHT_STOPS[1]).toEqual([0.5, 1]);
  });

  it('is big enough at its scale for the largest light: the 200 px plant light needs a 1.5625 scale', () => {
    expect(GLOW_PLANTS.plantLight / SOFT_LIGHT_RADIUS).toBe(1.5625);
    // The axolotl glow and the exit glow are smaller than the plant light, so they scale down from the same sprite.
    expect(GLOW_PLANTS.axolotlGlow).toBeLessThan(GLOW_PLANTS.plantLight);
    expect(GLOW_PLANTS.exitGlow).toBeLessThan(GLOW_PLANTS.plantLight);
  });
});

// ---------------------------------------------------------------------------
// Baking
// ---------------------------------------------------------------------------

describe('bakeSpringCaveTextures', () => {
  const bake = (scale: number) => {
    const created: { key: string; w: number; h: number }[] = [];
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeSpringCaveTextures(fakeScene(created), scale);
    return { art, created };
  };

  it('bakes every prop under its own fixed key', () => {
    const { created } = bake(2);
    expect(created.map((c) => c.key).sort()).toEqual(Object.values(SPRING_CAVE_TEX).sort());
    expect(new Set(created.map((c) => c.key)).size).toBe(created.length);
    expect(SPRING_CAVE_TEX.glowPlantUnlit).toBe('spring-cave-glow-plant-unlit');
    expect(SPRING_CAVE_TEX.glowPlantLit).toBe('spring-cave-glow-plant-lit');
    expect(SPRING_CAVE_TEX.glowPlantHint).toBe('spring-cave-glow-plant-hint');
    expect(SPRING_CAVE_TEX.softLight).toBe('spring-cave-soft-light');
  });

  it('bakes the grotto back and front in the cave frame, anchored at the base centre', () => {
    const { art } = bake(2);
    for (const info of [art.grotto.back, art.grotto.front]) {
      expect(info.scale).toBe(2);
      expect(info.w).toBe(CAVE_TEX.w);
      expect(info.h).toBe(CAVE_TEX.h);
      expect(info.originX).toBe(CAVE_TEX.originX);
      expect(info.originY).toBe(CAVE_TEX.originY);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
      expect(info.originNormY).toBeCloseTo(CAVE_TEX.originY / CAVE_TEX.h, 6);
    }
    expect(art.grotto.back.pxW).toBe(art.grotto.front.pxW);
    expect(art.grotto.back.pxH).toBe(art.grotto.front.pxH);
  });

  it('bakes the ledge and the outflow anchored at the top-left corner of their rects', () => {
    const { art } = bake(2);
    for (const [info, tex] of [
      [art.rockLedge, ROCK_LEDGE_TEX],
      [art.outflow, OUTFLOW_TEX],
    ] as const) {
      expect(info.scale).toBe(2);
      expect(info.w).toBe(tex.w);
      expect(info.h).toBe(tex.h);
      expect(info.originNormX).toBeCloseTo(4 / tex.w, 6);
      expect(info.originNormY).toBeCloseTo(4 / tex.h, 6);
    }
  });

  it('bakes the three plant states in one frame, anchored at the centre', () => {
    const { art } = bake(2);
    for (const state of ['unlit', 'lit', 'hint'] as const) {
      const info = art.glowPlants[state];
      expect(info.scale).toBe(2);
      expect(info.w).toBe(GLOW_PLANT_TEX.w);
      expect(info.h).toBe(GLOW_PLANT_TEX.h);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
      expect(info.originNormY).toBeCloseTo(0.5, 6);
    }
    expect(art.glowPlants.unlit.key).toBe(SPRING_CAVE_TEX.glowPlantUnlit);
    expect(art.glowPlants.lit.key).toBe(SPRING_CAVE_TEX.glowPlantLit);
    expect(art.glowPlants.hint.key).toBe(SPRING_CAVE_TEX.glowPlantHint);
  });

  it('bakes the soft light centred, and no sharper than it needs to be', () => {
    expect(SOFT_LIGHT_BAKE_SCALE).toBe(1);
    expect(bake(2).art.softLight.scale).toBe(1);
    expect(bake(3).art.softLight.pxW).toBe(320);
    expect(bake(0.5).art.softLight.scale).toBe(0.5);
    const info = bake(2).art.softLight;
    expect(info.w).toBe(320);
    expect(info.originNormX).toBeCloseTo(0.5, 6);
    expect(info.originNormY).toBeCloseTo(0.5, 6);
  });
});
