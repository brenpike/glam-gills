/**
 * Wind and waves marks (issue #211, Area 12; ND-10, ND-11; guide 4 and 10), headless: the surface
 * ripple arcs of the warning and the gust streaks with chevrons, and their lake bake. The painters
 * run against a recording context and a stub Path2D (the same approach as cormorantArt.test.ts):
 * every fill and stroke is kept with the style, width and alpha it was painted under. The shape
 * checks rasterise the recorded paths, so they read what was painted, not what the geometry says. No
 * Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WIND_CHEVRON,
  WIND_LINE_INK,
  WIND_LINE_W,
  WIND_MARK,
  WIND_RIPPLE_ARCS,
  WIND_RIPPLE_TEX,
  WIND_STREAK_LEN,
  WIND_STREAK_TEX,
  WIND_STREAK_TRAILS,
  paintWindRipple,
  paintWindStreak,
} from './drawWind';
import { LAKE_TEX, LAKE_TEX_MAX_H, LAKE_TEX_MAX_W, LAKE_TEX_SIZES, bakeLakeTextures } from './lakeTextures';
import { INK } from './palette';
import type { TexSize } from './canvasKit';

vi.mock('phaser', () => ({}));

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const [lr, lg, lb] = channelsOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The hero's belly: no wind mark is lighter (guide 2). */
const HERO_BELLY = '#ffe3ed';
/** The least padding round a sprite at 1x (guide 11). */
const MIN_PAD = 4;
/** The guide's floor for an edge against its background (10). */
const EDGE_FLOOR = 3;

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

/** A Path2D stand-in that keeps its commands. */
class LogPath {
  readonly cmds: unknown[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) =>
        key === 'cmds' ? target.cmds : (...args: unknown[]) => void target.cmds.push([String(key), ...args]),
    });
  }
}

/** One draw call with the style it was painted under. */
interface Op {
  readonly op: string;
  readonly cmds: unknown[][];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly globalAlpha: number;
}

const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

/** A context that records every fill and stroke into `ops`. */
function recordingContext(ops: Op[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => {
          if (name === 'createRadialGradient') return { addColorStop: () => undefined };
          if (name === 'fill' || name === 'stroke') {
            ops.push({
              op: name,
              cmds: (args[0] as LogPath).cmds as unknown[][],
              fillStyle: state.fillStyle,
              strokeStyle: state.strokeStyle,
              lineWidth: state.lineWidth as number,
              globalAlpha: state.globalAlpha as number,
            });
          }
        };
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Run `paint` with Path2D stubbed and return every fill and stroke it made. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Op[] {
  vi.stubGlobal('Path2D', LogPath);
  const ops: Op[] = [];
  try {
    paint(recordingContext(ops));
  } finally {
    vi.unstubAllGlobals();
  }
  return ops;
}

const isFill = (op: Op): boolean => op.op === 'fill';
const isStroke = (op: Op): boolean => op.op === 'stroke';
const styleOf = (op: Op): unknown => (isFill(op) ? op.fillStyle : op.strokeStyle);
const rippleOps = (): Op[] => record(paintWindRipple);
const streakOps = (): Op[] => record(paintWindStreak);

// ---------------------------------------------------------------------------
// Rasterise what was painted
// ---------------------------------------------------------------------------

type Pt = [number, number];

/** Sample a recorded path into polylines, one per sub-path. */
function polylinesOf(cmds: readonly unknown[][]): Pt[][] {
  const lines: Pt[][] = [];
  let current: Pt[] = [];
  const last = (): Pt => current[current.length - 1];
  for (const [name, ...args] of cmds) {
    const n = args as number[];
    if (name === 'moveTo') {
      if (current.length > 0) lines.push(current);
      current = [[n[0], n[1]]];
    } else if (name === 'lineTo') {
      current.push([n[0], n[1]]);
    } else if (name === 'closePath') {
      if (current.length > 0) current.push(current[0]);
    } else if (name === 'bezierCurveTo' || name === 'quadraticCurveTo') {
      const p0 = last();
      for (let i = 1; i <= 24; i++) current.push(curvePoint(p0, n, i / 24));
    } else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot, start, end] = n;
      for (let i = 0; i <= 72; i++) current.push(ellipsePoint(cx, cy, rx, ry, rot, start + ((end - start) * i) / 72));
    } else if (name === 'arc') {
      const [cx, cy, r, start, end] = n;
      const ccw = Boolean(args[5]);
      let sweep = ccw ? start - end : end - start;
      while (sweep <= 0) sweep += Math.PI * 2;
      for (let i = 0; i <= 24; i++) {
        const a = start + ((ccw ? -sweep : sweep) * i) / 24;
        current.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function curvePoint(p0: Pt, n: readonly number[], t: number): Pt {
  const u = 1 - t;
  if (n.length === 4) {
    return [u * u * p0[0] + 2 * u * t * n[0] + t * t * n[2], u * u * p0[1] + 2 * u * t * n[1] + t * t * n[3]];
  }
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [a * p0[0] + b * n[0] + c * n[2] + d * n[4], a * p0[1] + b * n[1] + c * n[3] + d * n[5]];
}

function ellipsePoint(cx: number, cy: number, rx: number, ry: number, rot: number, a: number): Pt {
  const u = rx * Math.cos(a);
  const v = ry * Math.sin(a);
  return [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)];
}

/** Even-odd point in polygon. */
function insidePolygon(poly: readonly Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToPolyline(line: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** Whether an op covers the point: a fill by any of its sub-paths, a stroke within half its width. */
function covers(op: Op, lines: readonly Pt[][], x: number, y: number): boolean {
  if (isFill(op)) return lines.some((poly) => insidePolygon(poly, x, y));
  return lines.some((line) => distanceToPolyline(line, x, y) <= op.lineWidth / 2);
}

/** A sprite rasterised at 1 px over its texture frame: per pixel the opaque style on top, or null. */
interface Raster {
  readonly w: number;
  readonly h: number;
  readonly style: (string | null)[];
}

/** Paint the opaque (#rrggbb) ops back to front. See-through ops are internal details and left out. */
function rasterOf(ops: readonly Op[], tex: TexSize): Raster {
  const { w, h, originX, originY } = tex;
  const style: (string | null)[] = new Array(w * h).fill(null);
  for (const op of ops) {
    const colour = styleOf(op);
    if (typeof colour !== 'string' || !colour.startsWith('#')) continue;
    const lines = polylinesOf(op.cmds);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        if (covers(op, lines, px - originX + 0.5, py - originY + 0.5)) style[py * w + px] = colour;
      }
    }
  }
  return { w, h, style };
}


/** The painted extent of a set of ops in logical units, ink included: strokes reach half their width past the path. */
function paintedBounds(ops: readonly Op[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const op of ops) {
    const reach = isStroke(op) ? op.lineWidth / 2 : 0;
    for (const lineOfPoints of polylinesOf(op.cmds)) {
      for (const [x, y] of lineOfPoints) {
        minX = Math.min(minX, x - reach);
        minY = Math.min(minY, y - reach);
        maxX = Math.max(maxX, x + reach);
        maxY = Math.max(maxY, y + reach);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/** The mirror of a raster about the anchor's column. */
function mirrored(r: Raster, tex: TexSize): Raster {
  const style: (string | null)[] = new Array(r.w * r.h).fill(null);
  for (let py = 0; py < r.h; py++) {
    for (let px = 0; px < r.w; px++) {
      // mirror about x = 0 in logical space: column px covers x = px - originX + 0.5
      const mx = Math.round(2 * tex.originX - px - 1);
      if (mx >= 0 && mx < r.w) style[py * r.w + mx] = r.style[py * r.w + px];
    }
  }
  return { w: r.w, h: r.h, style };
}

/** Pixels in one raster but not the other, over the pixels in either. */
function difference(a: Raster, b: Raster): number {
  let either = 0;
  let one = 0;
  for (let i = 0; i < a.style.length; i++) {
    const inA = a.style[i] !== null;
    const inB = b.style[i] !== null;
    if (inA || inB) either++;
    if (inA !== inB) one++;
  }
  return one / either;
}

/** Mean x in logical units of the painted pixels, relative to the anchor. */
function centreX(r: Raster, tex: TexSize): number {
  let sum = 0;
  let n = 0;
  for (let py = 0; py < r.h; py++) {
    for (let px = 0; px < r.w; px++) {
      if (r.style[py * r.w + px] === null) continue;
      sum += px - tex.originX + 0.5;
      n++;
    }
  }
  return sum / n;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wind mark colour and outline contrast (guide 10)', () => {
  it('uses the colour and widths the file records', () => {
    expect([WIND_MARK, WIND_LINE_W, WIND_LINE_INK]).toEqual(['#cfeaf5', 2.6, 2]);
    expect(relativeLuminance(WIND_MARK)).toBeCloseTo(0.787, 3);
    expect(contrastRatio(WIND_MARK, INK)).toBeCloseTo(11.47, 1);
  });

  it('the pale mark holds against its ink at 4.5:1 and the ink holds the edge on the lightest lit lake water', () => {
    expect(contrastRatio(WIND_MARK, INK)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(INK, '#5cc8c4')).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('no mark is lighter than the hero belly', () => {
    expect(relativeLuminance(WIND_MARK)).toBeLessThan(relativeLuminance(HERO_BELLY));
  });

  it.each([
    ['ripple', rippleOps],
    ['streak', streakOps],
  ] as const)('%s: paints only the pale mark and ink, at alpha 1, with no fill', (_name, opsOf) => {
    const ops = opsOf();
    expect(new Set(ops.map(styleOf))).toEqual(new Set([INK, WIND_MARK]));
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    expect(ops.every(isStroke)).toBe(true);
  });

  it.each([
    ['ripple', rippleOps, WIND_RIPPLE_TEX],
    ['streak', streakOps, WIND_STREAK_TEX],
  ] as const)('%s: every outer edge pixel is ink', (_name, opsOf, tex) => {
    const r = rasterOf(opsOf(), tex);
    let edge = 0;
    for (let py = 0; py < r.h; py++) {
      for (let px = 0; px < r.w; px++) {
        const here = r.style[py * r.w + px];
        if (here === null) continue;
        const open = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ].some(([x, y]) => x < 0 || y < 0 || x >= r.w || y >= r.h || r.style[y * r.w + x] === null);
        if (!open) continue;
        edge++;
        expect(here).toBe(INK);
      }
    }
    expect(edge).toBeGreaterThan(40);
  });
});

describe('wind mark sizes and no paint outside the texture', () => {
  it.each([
    ['ripple', WIND_RIPPLE_TEX],
    ['streak', WIND_STREAK_TEX],
  ] as const)('%s: an integer frame with the anchor inside it, and small', (_name, tex) => {
    for (const v of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(v)).toBe(true);
    expect(tex.originX).toBeGreaterThan(0);
    expect(tex.originX).toBeLessThan(tex.w);
    expect(tex.originY).toBeGreaterThan(0);
    expect(tex.originY).toBeLessThan(tex.h);
    expect(tex.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
    expect(tex.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
  });

  it.each([
    ['ripple', rippleOps, WIND_RIPPLE_TEX],
    ['streak', streakOps, WIND_STREAK_TEX],
  ] as const)('%s: paints nothing outside the texture and leaves at least 4 px of padding', (_name, opsOf, tex) => {
    const b = paintedBounds(opsOf());
    expect(b.minX).toBeGreaterThanOrEqual(-tex.originX + MIN_PAD);
    expect(b.minY).toBeGreaterThanOrEqual(-tex.originY + MIN_PAD);
    expect(b.maxX).toBeLessThanOrEqual(tex.w - tex.originX - MIN_PAD);
    expect(b.maxY).toBeLessThanOrEqual(tex.h - tex.originY - MIN_PAD);
  });

  it('is deterministic: the same painter paints the same ops every time', () => {
    expect(JSON.stringify(rippleOps())).toBe(JSON.stringify(rippleOps()));
    expect(JSON.stringify(streakOps())).toBe(JSON.stringify(streakOps()));
  });
});

describe('wind marks read by shape without colour (guide 10)', () => {
  it('the ripple is three arcs, each a curve bowing toward +x, growing larger toward +x', () => {
    const curves = rippleOps().filter((op) => op.strokeStyle === WIND_MARK);
    expect(curves).toHaveLength(3);
    expect(WIND_RIPPLE_ARCS).toHaveLength(3);
    const sizes = curves.map((op) => {
      const [move, quad] = op.cmds as [[string, number, number], [string, number, number, number, number]];
      expect(move[0]).toBe('moveTo');
      expect(quad[0]).toBe('quadraticCurveTo');
      // the control point is right of both ends, so the curve bows toward +x
      expect(quad[1]).toBeGreaterThan(move[1]);
      expect(quad[1]).toBeGreaterThan(quad[3]);
      // symmetric about the arc's middle row
      expect(quad[4]).toBeCloseTo(-move[2], 9);
      return quad[4];
    });
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(3);
    const xs = WIND_RIPPLE_ARCS.map((a) => a.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('the ripple leans to its way: its mirror is a different picture', () => {
    const ripple = rasterOf(rippleOps(), WIND_RIPPLE_TEX);
    expect(difference(ripple, mirrored(ripple, WIND_RIPPLE_TEX))).toBeGreaterThan(0.15);
  });

  it('the streak ends in a chevron at its anchor pointing +x: two arms behind and above and below the tip', () => {
    const [upper, tip, lower] = WIND_CHEVRON;
    expect(tip).toEqual([0, 0]);
    expect(upper[0]).toBeLessThan(0);
    expect(lower[0]).toBeLessThan(0);
    expect(upper[1]).toBeLessThan(0);
    expect(lower[1]).toBeGreaterThan(0);
    expect(upper[1]).toBeCloseTo(-lower[1], 9);
    const chevrons = streakOps().filter((op) => op.strokeStyle === WIND_MARK && op.cmds.filter(([n]) => n === 'lineTo').length === 2);
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].cmds).toEqual([
      ['moveTo', ...upper],
      ['lineTo', ...tip],
      ['lineTo', ...lower],
    ]);
  });

  it('the streak is three straight lines and a chevron; the long line leads to the chevron and the trails are shorter and behind it', () => {
    const lines = streakOps().filter((op) => op.strokeStyle === WIND_MARK);
    expect(lines).toHaveLength(4);
    expect(WIND_STREAK_TRAILS).toHaveLength(2);
    for (const [x0, x1] of WIND_STREAK_TRAILS) {
      expect(x1 - x0).toBeLessThan(WIND_STREAK_LEN);
      expect(x1).toBeLessThan(0);
    }
  });

  it('the streak is heavier behind its anchor than in front, so it points the other way when mirrored', () => {
    const streak = rasterOf(streakOps(), WIND_STREAK_TEX);
    expect(centreX(streak, WIND_STREAK_TEX)).toBeLessThan(-15);
    expect(difference(streak, mirrored(streak, WIND_STREAK_TEX))).toBeGreaterThan(0.4);
  });

  it('the ripple and the streak are different shapes, so the warning and the gust differ in greyscale', () => {
    expect(JSON.stringify(rippleOps())).not.toBe(JSON.stringify(streakOps()));
    expect(WIND_STREAK_TEX.w).toBeGreaterThan(WIND_RIPPLE_TEX.w);
    expect(WIND_STREAK_TEX.h).toBeLessThan(WIND_RIPPLE_TEX.h + 10);
  });

  it('draws no face, no letter, no fill and no pointed part: only round-capped tubes', () => {
    for (const op of [...rippleOps(), ...streakOps()]) {
      for (const [name] of op.cmds) expect(['moveTo', 'lineTo', 'quadraticCurveTo']).toContain(name);
    }
  });
});

describe('wind marks in the lake bake', () => {
  it('bakes the ripple and the streak at the painter frame times the bake scale', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made = new Map<string, { w: number; h: number; ops: Op[] }>();
    const scene = {
      textures: {
        exists: () => false,
        remove: () => undefined,
        createCanvas: (key: string, w: number, h: number) => {
          const ops: Op[] = [];
          made.set(key, { w, h, ops });
          return { context: recordingContext(ops), refresh: () => undefined };
        },
      },
    } as never;
    const lake = bakeLakeTextures(scene, 3);
    for (const [key, tex, info] of [
      [LAKE_TEX.windRipple, WIND_RIPPLE_TEX, lake.windRipple],
      [LAKE_TEX.windStreak, WIND_STREAK_TEX, lake.windStreak],
    ] as const) {
      expect(LAKE_TEX_SIZES[key]).toBe(tex);
      expect([made.get(key)!.w, made.get(key)!.h]).toEqual([tex.w * 3, tex.h * 3]);
      expect(made.get(key)!.ops.length).toBeGreaterThan(0);
      expect([info.key, info.scale, info.originX, info.originY]).toEqual([key, 3, tex.originX, tex.originY]);
    }
  });
});
