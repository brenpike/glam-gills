/**
 * Mud turtle colours, contrast on the lake's near-black water, sizes, poses, closed empty beak and
 * greyscale cues (issue #212; guide 7t, 3g, 10), headless. The painters run against a recording
 * context and a stub Path2D (the same approach as pelicanArt.test.ts): every fill and stroke is kept
 * with the style, width and alpha it was painted under. The silhouette and rim checks rasterise the
 * recorded paths, so they read what was painted, not what the geometry says. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MUD_TURTLE_BEAK,
  MUD_TURTLE_BEAK_INK,
  MUD_TURTLE_BEAK_TIP_R,
  MUD_TURTLE_BODY_BOB,
  MUD_TURTLE_CRAWL_FRAMES,
  MUD_TURTLE_EYE_R,
  MUD_TURTLE_FRAMES,
  MUD_TURTLE_HEAD_R,
  MUD_TURTLE_HEAD_TEX,
  MUD_TURTLE_HEAD_TO_TIP,
  MUD_TURTLE_KEYS,
  MUD_TURTLE_NECK_LEN,
  MUD_TURTLE_NECK_TEX,
  MUD_TURTLE_NECK_W,
  MUD_TURTLE_RIM,
  MUD_TURTLE_RIM_W,
  MUD_TURTLE_SCUTE,
  MUD_TURTLE_SHELL,
  MUD_TURTLE_SHELL_BASE_Y,
  MUD_TURTLE_SHELL_RX,
  MUD_TURTLE_SHELL_RY,
  MUD_TURTLE_SHINE,
  MUD_TURTLE_SKIN,
  MUD_TURTLE_STUMP,
  MUD_TURTLE_SWING,
  MUD_TURTLE_TEX,
  mudTurtleGeometry,
  mudTurtleHeadPieceGeometry,
  paintMudTurtle,
  paintMudTurtleHead,
  paintMudTurtleNeck,
  type MudTurtleFrame,
} from './drawMudTurtle';
import { EYE, INK, LEGS_FILL, LEUCISTIC, LW, TILAPIA_MOUTH, WHITE } from './palette';
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

/** The hero's belly: no turtle fill is lighter (guide 2). */
const HERO_BELLY = '#ffe3ed';
/** The least padding round a sprite at 1x (guide 11). */
const MIN_PAD = 4;
/** The guide's floor for an edge against its background (10). */
const EDGE_FLOOR = 3;
/** The lake's band 3 (dark indigo) and band 4 (near-black) water stops, shallow, mid, deep (drawLake.ts, guide 3c). */
const BAND_3 = ['#1f2d7a', '#1a2468', '#141a52'] as const;
const BAND_4 = ['#0b1030', '#070a1e', '#04060f'] as const;
/** The memory guard for lake sprites, logical units (lakeTextures.ts). */
const LAKE_TEX_MAX_W = 128;
const LAKE_TEX_MAX_H = 112;

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
const opsOf = (frame: MudTurtleFrame): Op[] => record((ctx) => paintMudTurtle(ctx, frame));
const headOps = (): Op[] => record(paintMudTurtleHead);
const neckOps = (): Op[] => record(paintMudTurtleNeck);

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

const rasters = new Map<string, Raster>();
function frameRaster(frame: MudTurtleFrame): Raster {
  if (!rasters.has(frame)) rasters.set(frame, rasterOf(opsOf(frame), MUD_TURTLE_TEX));
  return rasters.get(frame)!;
}

/** The silhouette's bounds and area, px. */
function silhouetteOf(r: Raster): { width: number; height: number; area: number; top: number; bottom: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let area = 0;
  for (let py = 0; py < r.h; py++) {
    for (let px = 0; px < r.w; px++) {
      if (r.style[py * r.w + px] === null) continue;
      area++;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1, area, top: minY, bottom: maxY };
}

/** Pixels in one silhouette but not the other, over the pixels in either. */
function silhouetteDifference(a: Raster, b: Raster): number {
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

/** The pixels of a raster that are on its outer edge, each with the direction of an open neighbour. */
function outerEdge(r: Raster): { px: number; py: number; dx: number; dy: number }[] {
  const edge: { px: number; py: number; dx: number; dy: number }[] = [];
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let py = 0; py < r.h; py++) {
    for (let px = 0; px < r.w; px++) {
      if (r.style[py * r.w + px] === null) continue;
      for (const [dx, dy] of dirs) {
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || y < 0 || x >= r.w || y >= r.h || r.style[y * r.w + x] === null) {
          edge.push({ px, py, dx, dy });
          break;
        }
      }
    }
  }
  return edge;
}

/** Every raster the turtle has: the five body frames, the head piece and the neck piece. */
function allRasters(): { name: string; raster: Raster }[] {
  return [
    ...MUD_TURTLE_FRAMES.map((frame) => ({ name: frame, raster: frameRaster(frame) })),
    { name: 'head', raster: rasterOf(headOps(), MUD_TURTLE_HEAD_TEX) },
    { name: 'neck', raster: rasterOf(neckOps(), MUD_TURTLE_NECK_TEX) },
  ];
}

const ALLOWED = [INK, MUD_TURTLE_SHELL, MUD_TURTLE_RIM, MUD_TURTLE_SKIN, MUD_TURTLE_BEAK, MUD_TURTLE_SCUTE, MUD_TURTLE_SHINE, EYE, WHITE];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mud turtle colours and contrast (guide 3g, 7t, 10)', () => {
  it('uses the colours the file records', () => {
    expect([MUD_TURTLE_SHELL, MUD_TURTLE_RIM, MUD_TURTLE_SKIN, MUD_TURTLE_BEAK]).toEqual(['#5a4a2c', '#e6dcb0', '#8c8650', '#d8cda0']);
    expect([MUD_TURTLE_SCUTE, MUD_TURTLE_SHINE]).toEqual(['rgba(230,220,176,0.45)', 'rgba(255,255,255,0.35)']);
    expect([MUD_TURTLE_BEAK_INK, MUD_TURTLE_RIM_W, LW]).toEqual([2.4, 2, 3.5]);
  });

  it('prints the contrast ratios and luminances the guide prints, to 2 decimals', () => {
    const rows: readonly (readonly [string, number, number])[] = [
      [MUD_TURTLE_SHELL, 0.0725, 1.68],
      [MUD_TURTLE_RIM, 0.7114, 10.44],
      [MUD_TURTLE_SKIN, 0.232, 3.87],
      [MUD_TURTLE_BEAK, 0.608, 9.02],
    ];
    for (const [colour, luminance, ratio] of rows) {
      expect(relativeLuminance(colour)).toBeCloseTo(luminance, 3);
      expect(contrastRatio(colour, INK)).toBeCloseTo(ratio, 1);
    }
  });

  it('hierarchy: no fill is lighter than the hero belly, and rim > beak > skin > shell', () => {
    const lumas = [MUD_TURTLE_RIM, MUD_TURTLE_BEAK, MUD_TURTLE_SKIN, MUD_TURTLE_SHELL].map(relativeLuminance);
    for (const l of lumas) expect(l).toBeLessThan(relativeLuminance(HERO_BELLY));
    expect([...lumas].sort((a, b) => b - a)).toEqual(lumas);
  });

  it('the rim and the beak hold against ink at 9:1 or better, so the pair method passes on any background', () => {
    expect(contrastRatio(MUD_TURTLE_RIM, INK)).toBeGreaterThanOrEqual(9);
    expect(contrastRatio(MUD_TURTLE_BEAK, INK)).toBeGreaterThanOrEqual(9);
    // the ink on the lightest lit lake water is 3:1 or better (drawLake.ts)
    expect(contrastRatio(INK, '#5cc8c4')).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('on near-black water the rim carries the edge: 8.88 to 11.72 on band 3 and 13.46 to 14.67 on band 4, every stop', () => {
    const band3 = BAND_3.map((stop) => contrastRatio(MUD_TURTLE_RIM, stop));
    const band4 = BAND_4.map((stop) => contrastRatio(MUD_TURTLE_RIM, stop));
    expect(band3[0]).toBeCloseTo(8.88, 1);
    expect(band3[1]).toBeCloseTo(10.18, 1);
    expect(band3[2]).toBeCloseTo(11.72, 1);
    expect(band4[0]).toBeCloseTo(13.46, 1);
    expect(band4[1]).toBeCloseTo(14.22, 1);
    expect(band4[2]).toBeCloseTo(14.67, 1);
    for (const ratio of [...band3, ...band4]) expect(ratio).toBeGreaterThanOrEqual(7);
  });

  it('ink alone is under the floor on band 4 (1.41:1 on the deepest stop), which is why the rim is there', () => {
    expect(contrastRatio(INK, '#04060f')).toBeCloseTo(1.41, 1);
    expect(contrastRatio(INK, '#04060f')).toBeLessThan(EDGE_FLOOR);
  });

  it('the shell alone is 2.17:1 to 2.36:1 on band 4, and the rim is 6.21:1 against the shell', () => {
    const ratios = BAND_4.map((stop) => contrastRatio(MUD_TURTLE_SHELL, stop));
    expect(Math.min(...ratios)).toBeCloseTo(2.17, 1);
    expect(Math.max(...ratios)).toBeCloseTo(2.36, 1);
    expect(contrastRatio(MUD_TURTLE_RIM, MUD_TURTLE_SHELL)).toBeCloseTo(6.21, 1);
  });

  it('a warm sand rim, told from the cormorant by hue: red-leaning, not lavender', () => {
    const [r, g, b] = channelsOf(MUD_TURTLE_RIM);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it('no turtle colour is red, and none is an axolotl or leg colour', () => {
    for (const colour of [MUD_TURTLE_SHELL, MUD_TURTLE_RIM, MUD_TURTLE_SKIN, MUD_TURTLE_BEAK]) {
      const [r, g] = channelsOf(colour);
      expect(r).toBeLessThan(1.4 * g);
    }
  });

  it.each(MUD_TURTLE_FRAMES)('%s: paints only turtle colours, ink, the eye and white glints, never an axolotl or leg colour or a red', (frame) => {
    const styles = new Set(opsOf(frame).map(styleOf));
    for (const style of styles) expect(ALLOWED).toContain(style);
    expect(styles.has(TILAPIA_MOUTH)).toBe(false);
    expect(styles.has(LEGS_FILL)).toBe(false);
    for (const colour of Object.values(LEUCISTIC)) {
      if (typeof colour === 'string' && colour !== EYE && colour !== WHITE) expect(styles.has(colour)).toBe(false);
    }
  });

  it.each(MUD_TURTLE_FRAMES)('%s: keeps every op at alpha 1 (guide 10, Alpha); only the scute lines and the shine are see-through colours', (frame) => {
    const ops = opsOf(frame);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    const seeThrough = new Set(ops.map(styleOf).filter((s) => typeof s === 'string' && !s.startsWith('#')));
    expect([...seeThrough].sort()).toEqual([MUD_TURTLE_SCUTE, MUD_TURTLE_SHINE].sort());
  });

  it('the scute lines are three curved lines 1.6 wide and the shine one ellipse, all inside the shell core', () => {
    const ops = opsOf('still');
    const scute = ops.filter((op) => isStroke(op) && op.strokeStyle === MUD_TURTLE_SCUTE);
    expect(scute).toHaveLength(3);
    for (const op of scute) {
      expect(op.lineWidth).toBe(1.6);
      expect(op.cmds.map((c) => c[0])).toEqual(['moveTo', 'quadraticCurveTo']);
    }
    expect(ops.filter((op) => isFill(op) && op.fillStyle === MUD_TURTLE_SHINE)).toHaveLength(1);
    const core = mudTurtleGeometry('still').shell.core;
    const g = mudTurtleGeometry('still').shell;
    const inside = (p: Pt): boolean => {
      const x = (p[0] - core.cx) / core.rx;
      const y = (p[1] - core.cy) / core.ry;
      return x * x + y * y < 1 && p[1] < MUD_TURTLE_SHELL_BASE_Y;
    };
    for (const line of g.scuteLines) for (const p of line) expect(inside([p[0], p[1]])).toBe(true);
    expect(inside([g.shine.cx, g.shine.cy])).toBe(true);
    expect(g.shine.cx).toBeLessThan(0);
  });
});

describe('mud turtle outline and rim on near-black water', () => {
  it.each(MUD_TURTLE_FRAMES)('%s: every outer edge pixel is ink', (frame) => {
    const edge = outerEdge(frameRaster(frame));
    expect(edge.length).toBeGreaterThan(100);
    for (const { px, py } of edge) expect(frameRaster(frame).style[py * frameRaster(frame).w + px]).toBe(INK);
  });

  it('the pieces are inked on every outer edge too', () => {
    for (const { raster } of allRasters().filter((r) => r.name === 'head' || r.name === 'neck')) {
      for (const { px, py } of outerEdge(raster)) expect(raster.style[py * raster.w + px]).toBe(INK);
    }
  });

  it('the pale rim runs all round every part: the nearest non-ink colour behind every outer ink edge is the rim (or the beak), never a dark fill', () => {
    const reach = 6;
    for (const { name, raster } of allRasters()) {
      for (const { px, py } of outerEdge(raster)) {
        let best = Infinity;
        let found: string | null = null;
        for (let y = py - reach; y <= py + reach; y++) {
          for (let x = px - reach; x <= px + reach; x++) {
            if (x < 0 || y < 0 || x >= raster.w || y >= raster.h) continue;
            const here = raster.style[y * raster.w + x];
            if (here === null || here === INK) continue;
            const d = Math.hypot(x - px, y - py);
            if (d < best) {
              best = d;
              found = here;
            }
          }
        }
        expect(found === MUD_TURTLE_RIM || found === MUD_TURTLE_BEAK, `${name} edge at ${px},${py}: ${found}`).toBe(true);
      }
    }
  });

  it('no skin or shell pixel touches ink on an outer edge: rim and beak only meet the ink', () => {
    for (const { name, raster } of allRasters()) {
      for (const { px, py, dx, dy } of outerEdge(raster)) {
        const inner = raster.style[(py - dy) * raster.w + (px - dx)];
        expect(inner === null || inner === INK || inner === MUD_TURTLE_RIM || inner === MUD_TURTLE_BEAK, `${name} ${px},${py}`).toBe(true);
      }
    }
  });

  it('every part but the beak is one rim group: all inks, then all rims, then all cores', () => {
    for (const frame of MUD_TURTLE_FRAMES) {
      const styles = opsOf(frame).map(styleOf);
      const firstRim = styles.indexOf(MUD_TURTLE_RIM);
      const lastInkBeforeRim = styles.slice(0, firstRim).lastIndexOf(INK);
      expect(styles.slice(0, firstRim).every((s) => s === INK)).toBe(true);
      expect(lastInkBeforeRim).toBe(firstRim - 1);
      const lastRim = styles.lastIndexOf(MUD_TURTLE_RIM);
      expect(styles.slice(firstRim, lastRim + 1).every((s) => s === MUD_TURTLE_RIM)).toBe(true);
      // the cores come next: skin and the shell
      expect(styles[lastRim + 1]).toBe(MUD_TURTLE_SKIN);
    }
  });

  it('the rim is 2 px: each core is 2 px smaller than its part on every side', () => {
    const g = mudTurtleGeometry('still');
    expect(g.shell.outer.rx - g.shell.core.rx).toBe(2);
    expect(g.shell.outer.ry - g.shell.core.ry).toBe(2 * MUD_TURTLE_RIM_W);
    expect(g.shell.outer.cy - g.shell.core.cy).toBe(2);
    // ellipse parts: the rim fills the outer size and the core fill is 2 px smaller
    const fills = opsOf('still').filter((op) => isFill(op));
    const radii = (colour: string): number[][] =>
      fills.filter((op) => op.fillStyle === colour).flatMap((op) => op.cmds.filter((c) => c[0] === 'ellipse').map((c) => [c[3], c[4]] as number[]));
    // the rim fills are the six skin ovals and then the shell dome, which has its own core colour
    const rim = radii(MUD_TURTLE_RIM).slice(0, -1);
    const skin = radii(MUD_TURTLE_SKIN);
    expect(rim.length).toBe(skin.length);
    for (let i = 0; i < rim.length; i++) {
      expect(rim[i][0] - skin[i][0]).toBe(2);
      expect(rim[i][1] - skin[i][1]).toBe(2);
    }
    // the neck tube: rim width 7, core width 3
    const [rimStroke] = neckOps().filter((op) => isStroke(op) && op.strokeStyle === MUD_TURTLE_RIM);
    const [skinStroke] = neckOps().filter((op) => isStroke(op) && op.strokeStyle === MUD_TURTLE_SKIN);
    expect(rimStroke.lineWidth).toBe(MUD_TURTLE_NECK_W);
    expect(skinStroke.lineWidth).toBe(MUD_TURTLE_NECK_W - 4);
  });
});

describe('mud turtle anchors, sizes and no paint outside the texture', () => {
  it('lists five body frames: the two crawl frames, the warning, the snap and the still', () => {
    expect(MUD_TURTLE_FRAMES).toEqual(['crawlA', 'crawlB', 'warn', 'snap', 'still']);
    expect(MUD_TURTLE_CRAWL_FRAMES).toEqual(['crawlA', 'crawlB']);
  });

  it('names the frame keys of guide 7t', () => {
    expect(MUD_TURTLE_KEYS).toEqual({
      crawlA: 'mud-turtle-crawl-a',
      crawlB: 'mud-turtle-crawl-b',
      warn: 'mud-turtle-warn',
      snap: 'mud-turtle-snap',
      still: 'mud-turtle-still',
      head: 'mud-turtle-head',
      neck: 'mud-turtle-neck',
    });
    for (const frame of MUD_TURTLE_FRAMES) expect(MUD_TURTLE_KEYS[frame]).toMatch(/^mud-turtle-/);
  });

  it('every texture frame is an integer size with its anchor inside, and small (the small-sprites rule)', () => {
    for (const tex of [MUD_TURTLE_TEX, MUD_TURTLE_HEAD_TEX, MUD_TURTLE_NECK_TEX]) {
      for (const v of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(v)).toBe(true);
      expect(tex.originX).toBeGreaterThan(0);
      expect(tex.originX).toBeLessThan(tex.w);
      expect(tex.originY).toBeGreaterThan(0);
      expect(tex.originY).toBeLessThan(tex.h);
      expect(tex.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
      expect(tex.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
    }
  });

  it('the shared body frame is about 82 x 47 (the guide), and the shell centre is its anchor', () => {
    expect(Math.abs(MUD_TURTLE_TEX.w - 82)).toBeLessThanOrEqual(4);
    expect(Math.abs(MUD_TURTLE_TEX.h - 47)).toBeLessThanOrEqual(4);
    expect(mudTurtleGeometry('still').shell.base).toEqual([0, MUD_TURTLE_SHELL_BASE_Y]);
  });

  it.each(MUD_TURTLE_FRAMES)('%s: paints nothing outside the texture and leaves at least 4 px of padding', (frame) => {
    const b = paintedBounds(opsOf(frame));
    const { w, h, originX, originY } = MUD_TURTLE_TEX;
    expect(b.minX).toBeGreaterThanOrEqual(-originX + MIN_PAD);
    expect(b.minY).toBeGreaterThanOrEqual(-originY + MIN_PAD);
    expect(b.maxX).toBeLessThanOrEqual(w - originX - MIN_PAD);
    expect(b.maxY).toBeLessThanOrEqual(h - originY - MIN_PAD);
  });

  it('the head piece and the neck piece paint nothing outside their textures', () => {
    for (const [ops, tex] of [
      [headOps(), MUD_TURTLE_HEAD_TEX],
      [neckOps(), MUD_TURTLE_NECK_TEX],
    ] as const) {
      const b = paintedBounds(ops);
      expect(b.minX).toBeGreaterThanOrEqual(-tex.originX + MIN_PAD);
      expect(b.minY).toBeGreaterThanOrEqual(-tex.originY + MIN_PAD);
      expect(b.maxX).toBeLessThanOrEqual(tex.w - tex.originX - MIN_PAD);
      expect(b.maxY).toBeLessThanOrEqual(tex.h - tex.originY - MIN_PAD);
    }
  });

  it('the shell is a low dome: 40 wide, 13 tall on a flat base at y +4, at least three times as wide as tall', () => {
    const { outer } = mudTurtleGeometry('still').shell;
    expect(outer.rx * 2).toBe(40);
    expect(outer.ry).toBe(13);
    expect(outer.cy).toBe(4);
    expect(outer.cy - outer.ry).toBe(-9);
    expect((MUD_TURTLE_SHELL_RX * 2) / MUD_TURTLE_SHELL_RY).toBeGreaterThanOrEqual(3);
    // painted as the upper half of the ellipse, closed along a flat base
    const [dome] = opsOf('still').filter((op) => isFill(op) && op.fillStyle === MUD_TURTLE_RIM && op.cmds.some((c) => c[0] === 'closePath'));
    expect(dome.cmds.map((c) => c[0])).toEqual(['ellipse', 'closePath']);
    expect(dome.cmds[0].slice(6, 8)).toEqual([Math.PI, 2 * Math.PI]);
  });

  it('the head is a circle of radius 7, the legs rounded ovals about 5 x 3.5 and the feet reach about 8 below the anchor', () => {
    const g = mudTurtleGeometry('still');
    expect(g.head!.head.rx).toBe(MUD_TURTLE_HEAD_R);
    expect(g.head!.head.ry).toBe(MUD_TURTLE_HEAD_R);
    expect(MUD_TURTLE_HEAD_R).toBe(7);
    for (const leg of [...g.farLegs, ...g.nearLegs]) {
      expect(leg.rx).toBe(5);
      expect(leg.ry).toBe(3.5);
    }
    expect(Math.max(...g.nearLegs.map((l) => l.cy + l.ry))).toBeCloseTo(8, 9);
  });

  it('the anchor is the shell centre: the tail trails toward -x and the beak points +x', () => {
    const g = mudTurtleGeometry('still');
    expect(g.tail.cx).toBeLessThan(-g.shell.outer.rx + 4);
    expect(g.head!.beakTip[0]).toBeGreaterThan(g.head!.head.cx);
    expect(g.head!.eye[0]).toBeGreaterThan(g.head!.head.cx);
  });

  it('the head piece is centred on its anchor with the beak pointing +x; the neck piece is a tube from its top end down by its length', () => {
    const h = mudTurtleHeadPieceGeometry();
    expect([h.head.cx, h.head.cy]).toEqual([0, 0]);
    expect(h.beakAngle).toBe(0);
    expect(h.beakTip).toEqual([MUD_TURTLE_HEAD_TO_TIP, 0]);
    expect(MUD_TURTLE_NECK_LEN).toBe(48);
    const [stroke] = neckOps().filter((op) => isStroke(op) && op.strokeStyle === MUD_TURTLE_SKIN);
    expect(stroke.cmds).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 0, MUD_TURTLE_NECK_LEN],
    ]);
  });
});

describe('mud turtle poses', () => {
  it('crawlB is crawlA with the shell 1 px lower and the diagonal leg pairs swung the other way', () => {
    expect(MUD_TURTLE_BODY_BOB).toBe(1);
    expect(MUD_TURTLE_SWING).toBe(3);
    const a = mudTurtleGeometry('crawlA');
    const b = mudTurtleGeometry('crawlB');
    expect(b.shell.base[1] - a.shell.base[1]).toBe(1);
    expect(b.shell.outer.rot).toBe(a.shell.outer.rot);
    expect(b.head).toEqual(a.head);
    expect(b.neck).toEqual(a.neck);
    // the pairs: near front with far back, near back with far front
    const [farBackA, farFrontA] = a.farLegs;
    const [nearBackA, nearFrontA] = a.nearLegs;
    const [farBackB, farFrontB] = b.farLegs;
    const [nearBackB, nearFrontB] = b.nearLegs;
    expect(nearFrontA.cx - nearFrontB.cx).toBe(2 * MUD_TURTLE_SWING);
    expect(farBackA.cx - farBackB.cx).toBe(2 * MUD_TURTLE_SWING);
    expect(nearBackB.cx - nearBackA.cx).toBe(2 * MUD_TURTLE_SWING);
    expect(farFrontB.cx - farFrontA.cx).toBe(2 * MUD_TURTLE_SWING);
    // the two frames are never the same picture
    expect(JSON.stringify(opsOf('crawlA'))).not.toBe(JSON.stringify(opsOf('crawlB')));
  });

  it('crawl and still: the shell level, the head out level and a little low at (21, -1) on a short neck, the beak level', () => {
    for (const frame of ['crawlA', 'crawlB', 'still'] as const) {
      const g = mudTurtleGeometry(frame);
      expect(g.shell.outer.rot).toBe(0);
      expect([g.head!.head.cx, g.head!.head.cy]).toEqual([21, -1]);
      expect(g.head!.beakAngle).toBe(0);
      expect(g.head!.beakTip[1]).toBeCloseTo(-1, 9);
    }
  });

  it('still: the legs level and the head level; nothing in it suggests motion', () => {
    const g = mudTurtleGeometry('still');
    expect(g.shell.outer.rot).toBe(0);
    expect(g.shell.base[1]).toBe(MUD_TURTLE_SHELL_BASE_Y);
    const a = mudTurtleGeometry('crawlA');
    const b = mudTurtleGeometry('crawlB');
    // the still legs sit midway between the two crawl swings
    for (let i = 0; i < 2; i++) {
      expect(g.nearLegs[i].cx).toBeCloseTo((a.nearLegs[i].cx + b.nearLegs[i].cx) / 2, 9);
      expect(g.farLegs[i].cx).toBeCloseTo((a.farLegs[i].cx + b.farLegs[i].cx) / 2, 9);
    }
  });

  it('warn: the shell tipped 0.08 rad nose up, the front legs wide, the head up at (23, -14) with the beak tipped up 0.35 rad, closed', () => {
    const w = mudTurtleGeometry('warn');
    const s = mudTurtleGeometry('still');
    expect(w.shell.outer.rot).toBeCloseTo(-0.08, 9);
    expect([w.head!.head.cx, w.head!.head.cy]).toEqual([23, -14]);
    expect(w.head!.beakAngle).toBeCloseTo(-0.35, 9);
    expect(w.head!.beakTip[1]).toBeLessThan(w.head!.head.cy);
    expect(w.nearLegs[1].cx).toBeGreaterThan(s.nearLegs[1].cx);
    expect(w.farLegs[1].cx).toBeGreaterThan(s.farLegs[1].cx);
    // the head stands well above the dome: its centre is clear of the shell top by more than 4 px
    const domeTop = w.shell.outer.cy - w.shell.outer.ry;
    expect(w.head!.head.cy).toBeLessThan(domeTop - 4);
  });

  it('snap: the shell tipped 0.05 rad nose down, the legs braced and a neck stump at (17, -3); no head in the body frame', () => {
    const g = mudTurtleGeometry('snap');
    expect(g.shell.outer.rot).toBeCloseTo(0.05, 9);
    expect(g.head).toBeNull();
    expect([g.neck[4], g.neck[5]]).toEqual([...MUD_TURTLE_STUMP]);
    expect(MUD_TURTLE_STUMP).toEqual([17, -3]);
    expect(opsOf('snap').some((op) => op.fillStyle === MUD_TURTLE_BEAK)).toBe(false);
    expect(opsOf('snap').some((op) => op.fillStyle === EYE)).toBe(false);
    // the head piece carries the beak, the eye and the head
    const head = headOps();
    expect(head.some((op) => op.fillStyle === MUD_TURTLE_BEAK)).toBe(true);
    expect(head.some((op) => op.fillStyle === EYE)).toBe(true);
  });

  it('the silhouettes read apart in greyscale: still is a low round dome, warn is taller with a raised head, snap is a long low shape with a stump', () => {
    const still = silhouetteOf(frameRaster('still'));
    const warn = silhouetteOf(frameRaster('warn'));
    const snap = silhouetteOf(frameRaster('snap'));
    expect(warn.height - still.height).toBeGreaterThanOrEqual(10);
    expect(warn.top).toBeLessThan(still.top - 10);
    // the snap has no head: it is shorter than the still on the right
    expect(snap.area).toBeLessThan(still.area);
    for (const [a, b] of [
      ['still', 'warn'],
      ['still', 'snap'],
      ['warn', 'snap'],
    ] as const) {
      expect(silhouetteDifference(frameRaster(a), frameRaster(b))).toBeGreaterThan(0.08);
    }
    // the two crawls and the still are near each other but not the same picture
    expect(silhouetteDifference(frameRaster('crawlA'), frameRaster('crawlB'))).toBeGreaterThan(0);
  });

  it('every frame is drawn differently', () => {
    const drawn = MUD_TURTLE_FRAMES.map((frame) => JSON.stringify(opsOf(frame)));
    expect(new Set(drawn).size).toBe(MUD_TURTLE_FRAMES.length);
  });

  it('is deterministic: the same frame paints the same ops every time', () => {
    for (const frame of MUD_TURTLE_FRAMES) expect(JSON.stringify(opsOf(frame))).toBe(JSON.stringify(opsOf(frame)));
    expect(JSON.stringify(headOps())).toBe(JSON.stringify(headOps()));
    expect(JSON.stringify(neckOps())).toBe(JSON.stringify(neckOps()));
  });
});

describe('mud turtle face and no forbidden shapes (guide 7t, ADR 0007, ADR 0008)', () => {
  const faceFrames = MUD_TURTLE_FRAMES.filter((f) => f !== 'snap');

  it.each(faceFrames)('%s: the beak is one closed path with a round tip, filled once and inked 2.4 outside', (frame) => {
    // blob: one ink stroke and one fill, the same path
    const ops = opsOf(frame);
    const fill = ops.filter((op) => isFill(op) && op.fillStyle === MUD_TURTLE_BEAK);
    expect(fill).toHaveLength(1);
    const names = fill[0].cmds.map((c) => c[0]);
    expect(names).toEqual(['moveTo', 'lineTo', 'arc', 'lineTo', 'closePath']);
    expect(names.filter((n) => n === 'moveTo')).toHaveLength(1);
    const arc = fill[0].cmds.find((c) => c[0] === 'arc')!;
    expect(arc[3]).toBe(MUD_TURTLE_BEAK_TIP_R);
    const index = ops.indexOf(fill[0]);
    const ink = ops[index - 1];
    expect(isStroke(ink)).toBe(true);
    expect(ink.strokeStyle).toBe(INK);
    expect(ink.lineWidth).toBe(2 * MUD_TURTLE_BEAK_INK);
    expect(ink.cmds).toEqual(fill[0].cmds);
  });

  it('the beak is a short blunt nub: its length past the head is 4 px, its tip radius 2.5, no point', () => {
    expect(MUD_TURTLE_BEAK_TIP_R).toBe(2.5);
    expect(MUD_TURTLE_HEAD_TO_TIP - MUD_TURTLE_HEAD_R).toBe(4);
    const h = mudTurtleHeadPieceGeometry();
    // the beak leaves the head by at most a short step; its widest point is the root, not the tip
    expect(h.beakTip[0] - h.head.rx).toBeLessThanOrEqual(5);
  });

  it.each(faceFrames)('%s: the face is a bead eye of radius 2.2 with two white glints and one 1.6 ink smile; nothing else', (frame) => {
    const ops = opsOf(frame);
    const bead = ops.filter((op) => isFill(op) && op.fillStyle === EYE);
    expect(bead).toHaveLength(1);
    expect(bead[0].cmds.filter((c) => c[0] === 'ellipse')[0][3]).toBe(MUD_TURTLE_EYE_R);
    const glints = ops.filter((op) => isFill(op) && op.fillStyle === WHITE);
    expect(glints).toHaveLength(1);
    expect(glints[0].cmds.filter((c) => c[0] === 'ellipse')).toHaveLength(2);
    const smiles = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1.6);
    expect(smiles).toHaveLength(1);
    expect(smiles[0].cmds.map((c) => c[0])).toEqual(['moveTo', 'quadraticCurveTo']);
    // nothing after the face: the eye and glints are the last things painted
    expect(ops[ops.length - 1]).toBe(glints[0]);
  });

  it('the snap frame has no face, no beak and no eye: the head piece carries them', () => {
    const ops = opsOf('snap');
    expect(ops.some((op) => op.fillStyle === EYE || op.fillStyle === WHITE || op.fillStyle === MUD_TURTLE_BEAK)).toBe(false);
    expect(ops.some((op) => isStroke(op) && op.lineWidth === 1.6 && op.strokeStyle === INK)).toBe(false);
  });

  it('no frame draws a mouth open, a tooth, a tongue, a brow or a red', () => {
    const everything = [...MUD_TURTLE_FRAMES.flatMap(opsOf), ...headOps(), ...neckOps()];
    for (const op of everything) {
      const style = styleOf(op);
      expect(ALLOWED).toContain(style);
    }
    // the only polygon with straight sides is the dome base and the beak: no triangle or spike command sequence
    for (const op of everything) {
      const lineTos = op.cmds.filter((c) => c[0] === 'lineTo').length;
      expect(lineTos).toBeLessThanOrEqual(2);
    }
  });

  it('nothing is drawn on, round or over anything else: the beak overlaps no shell, leg or tail, and each frame has one head at most', () => {
    for (const frame of faceFrames) {
      const g = mudTurtleGeometry(frame);
      const h = g.head!;
      const tipX = h.beakTip[0];
      const rightOfShell = g.shell.outer.cx + g.shell.outer.rx;
      expect(tipX - MUD_TURTLE_HEAD_TO_TIP).toBeGreaterThan(rightOfShell - 8);
      // the beak's root is past the head centre, its tip past the head's edge, all in front of the shell's right edge
      const beakLeft = h.head.cx + 4;
      expect(beakLeft).toBeGreaterThan(rightOfShell);
      for (const leg of [...g.farLegs, ...g.nearLegs, g.tail]) {
        expect(Math.hypot(leg.cx - h.beakTip[0], leg.cy - h.beakTip[1])).toBeGreaterThan(leg.rx + MUD_TURTLE_BEAK_INK + MUD_TURTLE_BEAK_TIP_R);
      }
    }
    // the beak is painted after the rim group and before the shell shine and the face
    for (const frame of faceFrames) {
      const styles = opsOf(frame).map(styleOf);
      expect(styles.indexOf(MUD_TURTLE_BEAK)).toBeGreaterThan(styles.lastIndexOf(MUD_TURTLE_SHELL));
    }
  });

  it('is the only thing in the sprite: no axolotl, snack or held thing; the frame is one rim group, one beak, the details and the face', () => {
    for (const frame of MUD_TURTLE_FRAMES) {
      const ops = opsOf(frame);
      const known = ops.filter((op) => ALLOWED.includes(styleOf(op) as string));
      expect(known).toHaveLength(ops.length);
      // the rim group: ink and rim and core per part
      const parts = 2 /* far legs */ + 1 /* tail */ + 2 /* near legs */ + 1 /* neck */ + (mudTurtleGeometry(frame).head ? 1 : 0) + 1; /* shell */
      expect(ops.filter((op) => styleOf(op) === MUD_TURTLE_RIM)).toHaveLength(parts);
      expect(ops.filter((op) => isStroke(op) && styleOf(op) === INK && op.lineWidth > 2 * LW - 0.001 && op.lineWidth !== 2 * MUD_TURTLE_BEAK_INK)).toHaveLength(parts);
    }
  });
});
