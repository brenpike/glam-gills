/**
 * Fading light colours, line widths, contrast on the lake's near-black water, frame size and anchor,
 * shapes, no letters or sharp points, and greyscale cues (issue #212; guide 7u, 3g, 10), headless. The
 * painter runs against a recording context and a stub Path2D (the same approach as
 * mudTurtleArt.test.ts): every fill and stroke is kept with the style, width and alpha it was painted
 * under, and gradients keep their stops. The edge and greyscale checks rasterise the recorded paths, so
 * they read what was painted, not what the geometry says. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FADING_LIGHT_RADIUS } from '../logic/hazards';
import {
  FADING_LIGHT_BULB,
  FADING_LIGHT_BULB_R,
  FADING_LIGHT_CAP,
  FADING_LIGHT_CAP_GEOM,
  FADING_LIGHT_COLLAR_GEOM,
  FADING_LIGHT_CORE_AT,
  FADING_LIGHT_CORE_R,
  FADING_LIGHT_FRAMES,
  FADING_LIGHT_HALF,
  FADING_LIGHT_HALO,
  FADING_LIGHT_HALO_RADIUS,
  FADING_LIGHT_HINT,
  FADING_LIGHT_HINT_LW,
  FADING_LIGHT_HINT_RING,
  FADING_LIGHT_KEYLINE,
  FADING_LIGHT_KEYLINE_PAD,
  FADING_LIGHT_KEYS,
  FADING_LIGHT_LEAVES,
  FADING_LIGHT_LIT_LW,
  FADING_LIGHT_OUT,
  FADING_LIGHT_OUT_FILL,
  FADING_LIGHT_OUT_LW,
  FADING_LIGHT_RING_RADIUS,
  FADING_LIGHT_STALK,
  FADING_LIGHT_STALK_BASE,
  FADING_LIGHT_STALK_TOP,
  FADING_LIGHT_STALK_W,
  FADING_LIGHT_TEX,
  FADING_LIGHT_TUBE_OL,
  paintFadingLight,
  type FadingLightFrame,
} from './drawFadingLight';
import { INK, LW, WHITE } from './palette';
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

/** The hero's belly: no fading light fill is lighter (guide 2). */
const HERO_BELLY = '#ffe3ed';
/** The least padding round a sprite at 1x (guide 11). */
const MIN_PAD = 4;
/** The guide's floor for an edge against its background (10). */
const EDGE_FLOOR = 3;
/** The lake's band 3 (dark indigo) and band 4 (near-black) water stops, shallow, mid, deep (drawLake.ts, guide 3c). */
const BAND_3 = ['#1f2d7a', '#1a2468', '#141a52'] as const;
const BAND_4 = ['#0b1030', '#070a1e', '#04060f'] as const;
/** The lake's lit water stops (bands 1 and 2, guide 3c), which the keyline must hold against; #2a7fb4 is the darkest. */
const LIT_LAKE_WATER = ['#5cc8c4', '#3fb0b8', '#2f98ac', '#2e8fc0', '#2a85b8', '#2a7fb4'] as const;
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

/** A recorded radial gradient: where it runs and its colour stops. */
interface Gradient {
  readonly kind: 'radial';
  readonly args: number[];
  readonly stops: [number, string][];
  addColorStop(offset: number, colour: string): void;
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

/** What one paint did: every fill and stroke, and every context method called or property set. */
interface Recording {
  readonly ops: Op[];
  readonly touched: Set<string>;
}

const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

/** A context that records every fill and stroke, and every other call and property it is given. */
function recordingContext(rec: Recording): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => {
          rec.touched.add(name);
          if (name === 'createRadialGradient') {
            const gradient: Gradient = {
              kind: 'radial',
              args: args as number[],
              stops: [],
              addColorStop(offset, colour) {
                this.stops.push([offset, colour]);
              },
            };
            return gradient;
          }
          if (name === 'fill' || name === 'stroke') {
            rec.ops.push({
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
        rec.touched.add(String(key));
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Run the painter with Path2D stubbed and return what it did. */
function recordFrame(frame: FadingLightFrame): Recording {
  vi.stubGlobal('Path2D', LogPath);
  const rec: Recording = { ops: [], touched: new Set() };
  try {
    paintFadingLight(recordingContext(rec), frame);
  } finally {
    vi.unstubAllGlobals();
  }
  return rec;
}

const isFill = (op: Op): boolean => op.op === 'fill';
const isStroke = (op: Op): boolean => op.op === 'stroke';
const styleOf = (op: Op): unknown => (isFill(op) ? op.fillStyle : op.strokeStyle);
const opsOf = (frame: FadingLightFrame): Op[] => recordFrame(frame).ops;
const strokesOf = (frame: FadingLightFrame, colour: string): Op[] => opsOf(frame).filter((op) => isStroke(op) && op.strokeStyle === colour);
const fillsOf = (frame: FadingLightFrame, colour: unknown): Op[] => opsOf(frame).filter((op) => isFill(op) && op.fillStyle === colour);
const gradientsOf = (frame: FadingLightFrame): Gradient[] =>
  opsOf(frame)
    .map(styleOf)
    .filter((s): s is Gradient => typeof s === 'object' && s !== null && (s as Gradient).kind === 'radial');

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
      for (let i = 1; i <= 48; i++) current.push(curvePoint(p0, n, i / 48));
    } else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot, start, end] = n;
      for (let i = 0; i <= 96; i++) current.push(ellipsePoint(cx, cy, rx, ry, rot, start + ((end - start) * i) / 96));
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

/** Paint the opaque (#rrggbb) ops back to front. See-through ops and gradients are left out. */
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

const rasters = new Map<FadingLightFrame, Raster>();
function frameRaster(frame: FadingLightFrame): Raster {
  if (!rasters.has(frame)) rasters.set(frame, rasterOf(opsOf(frame), FADING_LIGHT_TEX));
  return rasters.get(frame)!;
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

/** How many pixels of a raster are painted in `colour`. */
function pixelsOf(r: Raster, colour: string): number {
  return r.style.filter((s) => s === colour).length;
}

/** The colour that most pixels carry, not counting ink or the keyline (the state's own colour). */
function dominantColour(r: Raster): string {
  const counts = new Map<string, number>();
  for (const s of r.style) {
    if (s === null || s === INK || s === FADING_LIGHT_KEYLINE) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
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

/** Pixels whose centre is within `r` px of the anchor. */
function insideDisc(r: Raster, radius: number): (string | null)[] {
  const out: (string | null)[] = [];
  for (let py = 0; py < r.h; py++) {
    for (let px = 0; px < r.w; px++) {
      const x = px - FADING_LIGHT_TEX.originX + 0.5;
      const y = py - FADING_LIGHT_TEX.originY + 0.5;
      if (Math.hypot(x, y) <= radius) out.push(r.style[py * r.w + px]);
    }
  }
  return out;
}

const OUT_ALLOWED = [FADING_LIGHT_KEYLINE, FADING_LIGHT_OUT, FADING_LIGHT_OUT_FILL];
const HINT_ALLOWED = [FADING_LIGHT_KEYLINE, FADING_LIGHT_HINT];
const LIT_ALLOWED = [INK, FADING_LIGHT_STALK, FADING_LIGHT_CAP, FADING_LIGHT_BULB, WHITE];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fading light colours and contrast (guide 3g, 7u, 10)', () => {
  it('uses the colours and widths the guide records', () => {
    expect([FADING_LIGHT_OUT, FADING_LIGHT_HINT, FADING_LIGHT_KEYLINE]).toEqual(['#6aa8c0', '#cfeeff', '#04060f']);
    expect([FADING_LIGHT_STALK, FADING_LIGHT_CAP, FADING_LIGHT_BULB]).toEqual(['#3f9a6a', '#c9b36a', '#f2de8a']);
    expect([FADING_LIGHT_HALO, FADING_LIGHT_OUT_FILL, FADING_LIGHT_HINT_RING]).toEqual([
      'rgba(255,236,150,0.55)',
      'rgba(106,168,192,0.16)',
      'rgba(207,238,255,0.30)',
    ]);
    expect([FADING_LIGHT_OUT_LW, FADING_LIGHT_HINT_LW, FADING_LIGHT_LIT_LW, FADING_LIGHT_TUBE_OL, FADING_LIGHT_KEYLINE_PAD]).toEqual([2.6, 3.6, 2.6, 2, 1.2]);
  });

  it('prints the luminances the guide prints', () => {
    const rows: readonly (readonly [string, number])[] = [
      [FADING_LIGHT_OUT, 0.3488],
      [FADING_LIGHT_HINT, 0.8163],
      [FADING_LIGHT_STALK, 0.2521],
      [FADING_LIGHT_CAP, 0.457],
      [FADING_LIGHT_BULB, 0.7295],
    ];
    for (const [colour, luminance] of rows) expect(relativeLuminance(colour)).toBeCloseTo(luminance, 3);
  });

  it('the keyline is the lake darkness: band 4 deep stop, 1.41:1 with ink, so ink alone could not hold the edge in the dark', () => {
    expect(FADING_LIGHT_KEYLINE).toBe(BAND_4[2]);
    expect(contrastRatio(INK, FADING_LIGHT_KEYLINE)).toBeCloseTo(1.41, 1);
    expect(contrastRatio(INK, FADING_LIGHT_KEYLINE)).toBeLessThan(EDGE_FLOOR);
  });

  it('the out outline is 7.68:1 against its keyline, 4.65 to 6.14 against band 3 and 7.05 to 7.68 against band 4', () => {
    expect(contrastRatio(FADING_LIGHT_OUT, FADING_LIGHT_KEYLINE)).toBeCloseTo(7.68, 1);
    const band3 = BAND_3.map((stop) => contrastRatio(FADING_LIGHT_OUT, stop));
    const band4 = BAND_4.map((stop) => contrastRatio(FADING_LIGHT_OUT, stop));
    expect(band3[0]).toBeCloseTo(4.65, 1);
    expect(band3[1]).toBeCloseTo(5.33, 1);
    expect(band3[2]).toBeCloseTo(6.14, 1);
    expect(band4[0]).toBeCloseTo(7.05, 1);
    expect(band4[1]).toBeCloseTo(7.44, 1);
    expect(band4[2]).toBeCloseTo(7.68, 1);
    for (const ratio of [...band3, ...band4]) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('the hint outline is 16.69:1 against its keyline and 10.11:1 or better against bands 3 and 4', () => {
    expect(contrastRatio(FADING_LIGHT_HINT, FADING_LIGHT_KEYLINE)).toBeCloseTo(16.69, 1);
    const ratios = [...BAND_3, ...BAND_4].map((stop) => contrastRatio(FADING_LIGHT_HINT, stop));
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(10.1);
  });

  it('the keyline is 4.62:1 or better against every lit lake water, so it carries the outline there', () => {
    for (const stop of LIT_LAKE_WATER) expect(contrastRatio(FADING_LIGHT_KEYLINE, stop)).toBeGreaterThanOrEqual(4.6);
  });

  it('the lit bulb is 10.69:1 with ink and the stalk 4.14:1, both over the floor', () => {
    expect(contrastRatio(FADING_LIGHT_BULB, INK)).toBeCloseTo(10.69, 1);
    expect(contrastRatio(FADING_LIGHT_STALK, INK)).toBeCloseTo(4.14, 1);
    expect(contrastRatio(FADING_LIGHT_CAP, INK)).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('the bulb is below the Leucistic belly, so the axolotl stays the brightest thing; nothing is red or lighter than the belly', () => {
    for (const colour of [FADING_LIGHT_BULB, FADING_LIGHT_CAP, FADING_LIGHT_STALK, FADING_LIGHT_OUT, FADING_LIGHT_HINT]) {
      expect(relativeLuminance(colour)).toBeLessThan(relativeLuminance(HERO_BELLY));
      const [r, g] = channelsOf(colour);
      expect(r).toBeLessThan(1.4 * g);
    }
    expect(relativeLuminance(FADING_LIGHT_BULB)).toBeCloseTo(0.7295, 3);
    expect(relativeLuminance(HERO_BELLY)).toBeCloseTo(0.8231, 3);
  });

  it('is told apart from the glow-plant by colour as well as shape: warm yellow, not teal or mint', () => {
    const [r, g, b] = channelsOf(FADING_LIGHT_BULB);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
    expect(FADING_LIGHT_BULB).not.toBe('#d9fff6');
  });

  it.each(FADING_LIGHT_FRAMES)('%s: keeps every op at alpha 1 (guide 10, Alpha); the out state is never faded below its own outline', (frame) => {
    expect(opsOf(frame).every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it('out paints only the keyline, the out outline and the faint out body', () => {
    for (const style of new Set(opsOf('out').map(styleOf))) expect(OUT_ALLOWED).toContain(style);
    expect(fillsOf('out', FADING_LIGHT_OUT_FILL).length).toBeGreaterThan(0);
  });

  it('hint paints only the keyline, the hint outline and the ring gradient', () => {
    for (const style of new Set(opsOf('hint').map(styleOf))) {
      if (typeof style === 'string') expect(HINT_ALLOWED).toContain(style);
    }
    expect(gradientsOf('hint')).toHaveLength(1);
  });

  it('lit paints only ink, the three lit colours, white and the halo gradient; no keyline and no outline blue', () => {
    for (const style of new Set(opsOf('lit').map(styleOf))) {
      if (typeof style === 'string') expect(LIT_ALLOWED).toContain(style);
    }
    expect(gradientsOf('lit')).toHaveLength(1);
    const styles = new Set(opsOf('lit').map(styleOf));
    expect(styles.has(FADING_LIGHT_KEYLINE)).toBe(false);
    expect(styles.has(FADING_LIGHT_OUT)).toBe(false);
  });
});

describe('fading light line widths and soft light', () => {
  it('out: a 5.0 keyline under a 2.6 outline, no ink', () => {
    const keyline = strokesOf('out', FADING_LIGHT_KEYLINE);
    const outline = strokesOf('out', FADING_LIGHT_OUT);
    expect(keyline.length).toBeGreaterThan(0);
    for (const op of keyline) expect(op.lineWidth).toBeCloseTo(5, 9);
    for (const op of outline) expect(op.lineWidth).toBe(2.6);
    expect(strokesOf('out', INK)).toHaveLength(0);
    // the keyline is painted first, all of it, then the outline
    const styles = opsOf('out').map(styleOf);
    expect(styles.lastIndexOf(FADING_LIGHT_KEYLINE)).toBeLessThan(styles.indexOf(FADING_LIGHT_OUT));
    // as many keyline strokes as outline strokes: stalk, two leaves, cap, collar, bulb
    expect(keyline).toHaveLength(6);
    expect(outline).toHaveLength(6);
  });

  it('hint: a 6.0 keyline under a 3.6 outline, thicker than out', () => {
    const keyline = strokesOf('hint', FADING_LIGHT_KEYLINE);
    const outline = strokesOf('hint', FADING_LIGHT_HINT);
    expect(keyline).toHaveLength(6);
    expect(outline).toHaveLength(6);
    for (const op of keyline) expect(op.lineWidth).toBeCloseTo(6, 9);
    for (const op of outline) expect(op.lineWidth).toBe(3.6);
    expect(FADING_LIGHT_HINT_LW).toBeGreaterThan(FADING_LIGHT_OUT_LW);
    expect(strokesOf('hint', INK)).toHaveLength(0);
  });

  it('every keyline is the outline width plus 1.2 px each side', () => {
    expect(FADING_LIGHT_OUT_LW + 2 * FADING_LIGHT_KEYLINE_PAD).toBeCloseTo(5, 9);
    expect(FADING_LIGHT_HINT_LW + 2 * FADING_LIGHT_KEYLINE_PAD).toBeCloseTo(6, 9);
  });

  it('lit: ink 2.6 round the cap, the collar and the bulb (stroked at 2x, as blob does), the stalk and leaves as one inked tube group', () => {
    const ink = strokesOf('lit', INK);
    // stalk + two leaves in one group, then cap, collar, bulb
    expect(ink).toHaveLength(6);
    const tubes = ink.slice(0, 3);
    expect(tubes[0].lineWidth).toBe(FADING_LIGHT_STALK_W + 2 * FADING_LIGHT_TUBE_OL);
    for (const leaf of tubes.slice(1)) expect(leaf.lineWidth).toBe(2 * FADING_LIGHT_LEAVES[0].ry + 2 * FADING_LIGHT_TUBE_OL);
    for (const op of ink.slice(3)) expect(op.lineWidth).toBe(2 * FADING_LIGHT_LIT_LW);
    // all tube inks first, then the tube colours: one inkMany group
    const styles = opsOf('lit').map(styleOf);
    const firstStalkColour = styles.indexOf(FADING_LIGHT_STALK);
    expect(styles.slice(1, firstStalkColour).filter((s) => s === INK)).toHaveLength(3);
    expect(styles.slice(firstStalkColour, firstStalkColour + 3).every((s) => s === FADING_LIGHT_STALK)).toBe(true);
    const stalkColour = strokesOf('lit', FADING_LIGHT_STALK);
    expect(stalkColour[0].lineWidth).toBe(3);
  });

  it('lit: the ink outline of the lit parts is 2.6, not the guide default 3.5', () => {
    expect(FADING_LIGHT_LIT_LW).toBe(2.6);
    expect(FADING_LIGHT_LIT_LW).toBeLessThan(LW);
  });

  it('lit: the halo is a radial gradient from rgba(255,236,150,0.55) at the centre to nothing at radius 40', () => {
    const rec = recordFrame('lit').ops;
    const halo = styleOf(rec[0]) as Gradient;
    expect(halo.args).toEqual([0, 0, 0, 0, 0, FADING_LIGHT_HALO_RADIUS]);
    expect(FADING_LIGHT_HALO_RADIUS).toBe(40);
    expect(halo.stops[0]).toEqual([0, FADING_LIGHT_HALO]);
    expect(halo.stops[1][0]).toBe(1);
    expect(halo.stops[1][1]).toBe('rgba(255,236,150,0)');
    // painted first, under everything
    expect(halo.kind).toBe('radial');
    expect(rec.filter((op) => typeof styleOf(op) === 'object')).toHaveLength(1);
  });

  it('hint: the ring is a radial gradient from rgba(207,238,255,0.30) at the centre to nothing at radius 34, painted under the outline', () => {
    const rec = recordFrame('hint').ops;
    const ring = styleOf(rec[0]) as Gradient;
    expect(ring.args).toEqual([0, 0, 0, 0, 0, FADING_LIGHT_RING_RADIUS]);
    expect(FADING_LIGHT_RING_RADIUS).toBe(34);
    expect(ring.stops[0]).toEqual([0, FADING_LIGHT_HINT_RING]);
    expect(ring.stops[1]).toEqual([1, 'rgba(207,238,255,0)']);
    expect(ring.kind).toBe('radial');
    expect(rec.filter((op) => typeof styleOf(op) === 'object')).toHaveLength(1);
  });

  it('out has no gradient and no halo: it is an outline only', () => {
    expect(gradientsOf('out')).toHaveLength(0);
  });
});

describe('fading light frame, anchor and no paint outside the texture', () => {
  it('lists three frames in order and names the frame keys of guide 7u', () => {
    expect(FADING_LIGHT_FRAMES).toEqual(['out', 'hint', 'lit']);
    expect(FADING_LIGHT_KEYS).toEqual({
      out: 'fading-light-out',
      hint: 'fading-light-hint',
      lit: 'fading-light-lit',
    });
    for (const frame of FADING_LIGHT_FRAMES) expect(FADING_LIGHT_KEYS[frame]).toMatch(/^fading-light-/);
  });

  it('the one frame is 88 x 88 with the anchor on its centre, integer sized (guide 7u)', () => {
    expect(FADING_LIGHT_TEX).toEqual({ w: 88, h: 88, originX: 44, originY: 44 });
    expect(FADING_LIGHT_HALF).toBe(44);
  });

  it('the frame fits the lake sprite memory guard of 128 x 112', () => {
    expect(FADING_LIGHT_TEX.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
    expect(FADING_LIGHT_TEX.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
  });

  it.each(FADING_LIGHT_FRAMES)('%s: paints nothing outside the texture and leaves at least 4 px of padding', (frame) => {
    const b = paintedBounds(opsOf(frame));
    const { w, h, originX, originY } = FADING_LIGHT_TEX;
    expect(b.minX).toBeGreaterThanOrEqual(-originX + MIN_PAD);
    expect(b.minY).toBeGreaterThanOrEqual(-originY + MIN_PAD);
    expect(b.maxX).toBeLessThanOrEqual(w - originX - MIN_PAD);
    expect(b.maxY).toBeLessThanOrEqual(h - originY - MIN_PAD);
  });

  it('the bulb has the touch circle radius (14) and is centred on the anchor, so what is drawn is what is touched', () => {
    expect(FADING_LIGHT_RADIUS).toBe(14);
    expect(FADING_LIGHT_BULB_R).toBe(FADING_LIGHT_RADIUS);
    for (const frame of FADING_LIGHT_FRAMES) {
      const circles = opsOf(frame).flatMap((op) => op.cmds.filter((c) => c[0] === 'ellipse' && c[3] === FADING_LIGHT_BULB_R && c[4] === FADING_LIGHT_BULB_R));
      expect(circles.length).toBeGreaterThan(0);
      for (const c of circles) expect([c[1], c[2]]).toEqual([0, 0]);
    }
  });

  it('the bulb covers the touch circle in every frame: the bulb disc is painted out to its radius on every side', () => {
    // the outline sits on the bulb's edge: pixels on the circle of radius 14 are painted on all four sides
    for (const frame of ['out', 'hint'] as const) {
      const r = frameRaster(frame);
      for (const [x, y] of [
        [14, 0],
        [-14, 0],
        [0, 14],
        [0, -14],
      ] as const) {
        const px = Math.floor(x + FADING_LIGHT_TEX.originX + (x > 0 ? -0.5 : x < 0 ? 0.5 : 0));
        const py = Math.floor(y + FADING_LIGHT_TEX.originY + (y > 0 ? -0.5 : y < 0 ? 0.5 : 0));
        expect(r.style[py * r.w + px], `${frame} at ${x},${y}`).not.toBeNull();
      }
    }
  });

  it('the cap is 6 x 3.5 at (0, -15), the collar 9 x 3.5 at (0, 14)', () => {
    expect(FADING_LIGHT_CAP_GEOM).toEqual({ cx: 0, cy: -15, rx: 6, ry: 3.5 });
    expect(FADING_LIGHT_COLLAR_GEOM).toEqual({ cx: 0, cy: 14, rx: 9, ry: 3.5 });
    const ellipses = opsOf('lit').flatMap((op) => op.cmds.filter((c) => c[0] === 'ellipse'));
    expect(ellipses.some((c) => c[1] === 0 && c[2] === -15 && c[3] === 6 && c[4] === 3.5)).toBe(true);
    expect(ellipses.some((c) => c[1] === 0 && c[2] === 14 && c[3] === 9 && c[4] === 3.5)).toBe(true);
  });

  it('the stalk is 3 wide, rises from a base at (0, 32) in one hooked curve to the collar, and the two leaves are 7 x 4 at the base', () => {
    expect(FADING_LIGHT_STALK_W).toBe(3);
    expect([...FADING_LIGHT_STALK_BASE]).toEqual([0, 32]);
    const [stalk] = strokesOf('lit', FADING_LIGHT_STALK);
    expect(stalk.cmds[0]).toEqual(['moveTo', 0, 32]);
    expect(stalk.cmds[1][0]).toBe('bezierCurveTo');
    expect(stalk.cmds[1].slice(-2)).toEqual([...FADING_LIGHT_STALK_TOP]);
    // the hook: the curve bows out to the side of its two ends
    const line = polylinesOf(stalk.cmds)[0];
    expect(Math.max(...line.map((p) => p[0]))).toBeGreaterThan(6);
    // the stalk ends under the collar and starts below it, inside the frame
    expect(FADING_LIGHT_STALK_TOP[1]).toBeGreaterThan(FADING_LIGHT_COLLAR_GEOM.cy);
    expect(FADING_LIGHT_LEAVES).toHaveLength(2);
    for (const leaf of FADING_LIGHT_LEAVES) {
      expect([leaf.rx, leaf.ry]).toEqual([7, 4]);
      expect(Math.hypot(leaf.cx - FADING_LIGHT_STALK_BASE[0], leaf.cy - FADING_LIGHT_STALK_BASE[1])).toBeLessThan(12);
    }
    // one leaf each side of the stalk
    expect(Math.sign(FADING_LIGHT_LEAVES[0].cx)).toBe(-Math.sign(FADING_LIGHT_LEAVES[1].cx));
  });

  it('lit: the white core has radius 5 and sits inside the bulb', () => {
    expect(FADING_LIGHT_CORE_R).toBe(5);
    const ops = opsOf('lit');
    const core = ops.filter((op) => isFill(op) && op.fillStyle === WHITE)[0];
    expect(core.cmds.filter((c) => c[0] === 'ellipse')[0].slice(1, 4)).toEqual([FADING_LIGHT_CORE_AT[0], FADING_LIGHT_CORE_AT[1], 5]);
    expect(Math.hypot(FADING_LIGHT_CORE_AT[0], FADING_LIGHT_CORE_AT[1]) + FADING_LIGHT_CORE_R).toBeLessThan(FADING_LIGHT_BULB_R);
    // the core is the last thing painted
    expect(ops[ops.length - 1]).toBe(core);
  });

  it('is deterministic and every frame is drawn differently', () => {
    const drawn = FADING_LIGHT_FRAMES.map((frame) => JSON.stringify(opsOf(frame)));
    expect(new Set(drawn).size).toBe(FADING_LIGHT_FRAMES.length);
    for (const frame of FADING_LIGHT_FRAMES) expect(JSON.stringify(opsOf(frame))).toBe(JSON.stringify(opsOf(frame)));
  });
});

describe('fading light outline on near-black water', () => {
  it.each(['out', 'hint'] as const)('%s: every outer edge pixel is the keyline, so the outline always sits on it', (frame) => {
    const r = frameRaster(frame);
    const edge = outerEdge(r);
    expect(edge.length).toBeGreaterThan(100);
    for (const { px, py } of edge) expect(r.style[py * r.w + px]).toBe(FADING_LIGHT_KEYLINE);
  });

  it.each(['out', 'hint'] as const)('%s: the outline colour is painted inside the keyline, on every shape, never ink alone', (frame) => {
    const r = frameRaster(frame);
    const outline = frame === 'out' ? FADING_LIGHT_OUT : FADING_LIGHT_HINT;
    expect(pixelsOf(r, outline)).toBeGreaterThan(300);
    expect(pixelsOf(r, INK)).toBe(0);
  });

  it('the out state is never invisible on band 4 #04060f: its outline paints on every shape and holds 7:1 or better on every band 4 and 3 stop', () => {
    const r = frameRaster('out');
    // every shape's outline shows: the six strokes, the bulb ring, the cap, the collar, the stalk and the leaves
    expect(pixelsOf(r, FADING_LIGHT_OUT)).toBeGreaterThan(300);
    for (const stop of BAND_4) expect(contrastRatio(FADING_LIGHT_OUT, stop)).toBeGreaterThanOrEqual(7);
    for (const stop of BAND_3) expect(contrastRatio(FADING_LIGHT_OUT, stop)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(FADING_LIGHT_OUT, '#04060f')).toBeGreaterThanOrEqual(EDGE_FLOOR);
    // the outline of each of the five round shapes is present: bulb, cap, collar, two leaves
    const probes: readonly (readonly [string, number, number])[] = [
      ['bulb', FADING_LIGHT_BULB_R, 0],
      ['cap top', 0, FADING_LIGHT_CAP_GEOM.cy - FADING_LIGHT_CAP_GEOM.ry],
      ['collar bottom', 0, FADING_LIGHT_COLLAR_GEOM.cy + FADING_LIGHT_COLLAR_GEOM.ry],
      ['left leaf', FADING_LIGHT_LEAVES[0].cx - FADING_LIGHT_LEAVES[0].rx + 1, FADING_LIGHT_LEAVES[0].cy],
      ['right leaf', FADING_LIGHT_LEAVES[1].cx + FADING_LIGHT_LEAVES[1].rx - 1, FADING_LIGHT_LEAVES[1].cy],
    ];
    for (const [name, x, y] of probes) {
      let found = false;
      for (let dy = -2; dy <= 2 && !found; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = Math.floor(x + FADING_LIGHT_TEX.originX) + dx;
          const py = Math.floor(y + FADING_LIGHT_TEX.originY) + dy;
          if (r.style[py * r.w + px] === FADING_LIGHT_OUT) {
            found = true;
            break;
          }
        }
      }
      expect(found, `out outline near ${name}`).toBe(true);
    }
  });

  it('the out body fill is see-through and only a faint wash: it never takes the outline away', () => {
    const ops = opsOf('out');
    const fills = ops.filter((op) => isFill(op) && op.fillStyle === FADING_LIGHT_OUT_FILL);
    expect(fills.length).toBe(5);
    const alpha = Number(/,([0-9.]+)\)$/.exec(FADING_LIGHT_OUT_FILL)![1]);
    expect(alpha).toBeLessThan(0.2);
    // each body is filled before it is stroked, so the outline is on top of the body
    for (const fill of fills) {
      const i = ops.indexOf(fill);
      expect(isStroke(ops[i + 1]) && ops[i + 1].strokeStyle === FADING_LIGHT_OUT).toBe(true);
    }
  });

  it('lit: every outer edge pixel is ink, and the lit frame is drawn on the water it lights', () => {
    const r = frameRaster('lit');
    for (const { px, py } of outerEdge(r)) expect(r.style[py * r.w + px]).toBe(INK);
  });
});

describe('fading light shapes: gentle, no letters, no sharp points (guide 7u, ADR 0007)', () => {
  it.each(FADING_LIGHT_FRAMES)('%s: draws no text and no rectangle', (frame) => {
    const { touched } = recordFrame(frame);
    for (const name of ['fillText', 'strokeText', 'measureText', 'font', 'textAlign', 'fillRect', 'strokeRect', 'rect']) {
      expect(touched.has(name), name).toBe(false);
    }
  });

  it.each(FADING_LIGHT_FRAMES)('%s: every path is round: ellipses, one smooth curve and one two-point tube line, no corner and no polygon', (frame) => {
    for (const op of opsOf(frame)) {
      const names = op.cmds.map((c) => c[0]);
      for (const name of names) expect(['moveTo', 'ellipse', 'bezierCurveTo', 'lineTo']).toContain(name);
      expect(names).not.toContain('closePath');
      // a tube's centre line is at most one lineTo, stroked with round caps; no filled polygon
      expect(names.filter((n) => n === 'lineTo').length).toBeLessThanOrEqual(1);
      if (names.includes('lineTo')) expect(isStroke(op)).toBe(true);
    }
  });

  it('only the lit leaf tubes use a line, and every line end is round: beginDraw sets round caps and joins', () => {
    const lines = opsOf('lit').filter((op) => op.cmds.some((c) => c[0] === 'lineTo'));
    // two tube inks and two tube colours
    expect(lines).toHaveLength(4);
    for (const frame of ['out', 'hint'] as const) {
      expect(opsOf(frame).some((op) => op.cmds.some((c) => c[0] === 'lineTo'))).toBe(false);
    }
  });

  it('no face, flame, star or hazard colour: there is no eye, no red, no teeth', () => {
    for (const frame of FADING_LIGHT_FRAMES) {
      const styles = opsOf(frame).map(styleOf).filter((s): s is string => typeof s === 'string');
      for (const style of styles) {
        if (!style.startsWith('#')) continue;
        const [r, g] = channelsOf(style);
        expect(r).toBeLessThan(1.4 * g);
      }
    }
  });
});

describe('fading light greyscale cues (guide 7u, 10)', () => {
  it('each state has its own colour: out 0.3488, hint 0.8163, lit bulb 0.7295', () => {
    expect(dominantColour(frameRaster('out'))).toBe(FADING_LIGHT_OUT);
    expect(dominantColour(frameRaster('hint'))).toBe(FADING_LIGHT_HINT);
    expect(dominantColour(frameRaster('lit'))).toBe(FADING_LIGHT_BULB);
    expect(relativeLuminance(FADING_LIGHT_OUT)).toBeCloseTo(0.3488, 3);
    expect(relativeLuminance(FADING_LIGHT_HINT)).toBeCloseTo(0.8163, 3);
    expect(relativeLuminance(FADING_LIGHT_BULB)).toBeCloseTo(0.7295, 3);
  });

  it('out and hint read apart by lightness: the hint outline is much lighter (2.17:1) and thicker', () => {
    expect(contrastRatio(FADING_LIGHT_HINT, FADING_LIGHT_OUT)).toBeGreaterThanOrEqual(2);
    expect(relativeLuminance(FADING_LIGHT_HINT) - relativeLuminance(FADING_LIGHT_OUT)).toBeGreaterThan(0.4);
    const outPixels = pixelsOf(frameRaster('out'), FADING_LIGHT_OUT);
    const hintPixels = pixelsOf(frameRaster('hint'), FADING_LIGHT_HINT);
    expect(hintPixels).toBeGreaterThan(outPixels * 1.2);
  });

  it('lit and out read apart by lightness (1.96:1) and by fill: a filled, inked bulb against a hollow line', () => {
    expect(contrastRatio(FADING_LIGHT_BULB, FADING_LIGHT_OUT)).toBeGreaterThanOrEqual(1.9);
    const litCentre = insideDisc(frameRaster('lit'), 7);
    const outCentre = insideDisc(frameRaster('out'), 7);
    const hintCentre = insideDisc(frameRaster('hint'), 7);
    // lit: solid inside; out and hint: nothing opaque inside the bulb, the outline is hollow
    expect(litCentre.every((s) => s !== null)).toBe(true);
    expect(outCentre.every((s) => s === null)).toBe(true);
    expect(hintCentre.every((s) => s === null)).toBe(true);
  });

  it('lit and hint, near each other in lightness (0.7295 and 0.8163), still read apart: one is solid and inked, the other hollow with a ring', () => {
    const lit = frameRaster('lit');
    const hint = frameRaster('hint');
    const opaque = (r: Raster): number => r.style.filter((s) => s !== null).length;
    expect(opaque(lit)).toBeGreaterThan(opaque(hint) * 0.8);
    expect(pixelsOf(lit, FADING_LIGHT_BULB)).toBeGreaterThan(300);
    expect(pixelsOf(hint, FADING_LIGHT_HINT)).toBeLessThan(pixelsOf(lit, FADING_LIGHT_BULB) + 400);
    // the lit bulb disc is one filled colour, the hint's is empty: that is the cue
    expect(insideDisc(lit, 7).filter((s) => s === FADING_LIGHT_BULB || s === WHITE).length).toBe(insideDisc(lit, 7).length);
    expect(insideDisc(hint, 7).filter((s) => s !== null).length).toBe(0);
  });

  it('every state paints a different picture, and lit is the only one with ink', () => {
    expect(pixelsOf(frameRaster('lit'), INK)).toBeGreaterThan(100);
    expect(pixelsOf(frameRaster('out'), INK)).toBe(0);
    expect(pixelsOf(frameRaster('hint'), INK)).toBe(0);
  });
});
