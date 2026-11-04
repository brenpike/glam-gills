/**
 * Cormorant colours, rim light, sizes, poses, closed bill and greyscale cues (guide 3g, 7n, 10),
 * headless. The painter runs against a recording context and a stub Path2D (the same approach as
 * blackBassArt.test.ts): every fill and stroke is kept with the style, width and alpha it was
 * painted under. The greyscale checks rasterise the recorded paths, so they read what was painted,
 * not what the geometry says.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  CORMORANT_BILL,
  CORMORANT_BILL_INK,
  CORMORANT_BOB,
  CORMORANT_EYE_R,
  CORMORANT_EYE_RING,
  CORMORANT_FEATHER,
  CORMORANT_FLOAT_FRAMES,
  CORMORANT_FRAMES,
  CORMORANT_HEAD_R,
  CORMORANT_NECK_W,
  CORMORANT_RIM,
  CORMORANT_RIM_W,
  CORMORANT_SHINE,
  CORMORANT_TEX,
  CORMORANT_WARN_TILT,
  CORMORANT_WING_LINE,
  cormorantBillTip,
  cormorantGeometry,
  paintCormorant,
  type CormorantFrame,
} from './drawCormorant';
import { HERON_BEAK } from './drawHeron';
import { DEEP_CANAL_WATER_DEEP, DEEP_CANAL_WATER_MID, DEEP_CANAL_WATER_SHALLOW } from './habitatLook';
import { DREAM_RIM_LIGHT, EYE, INK, LEGS_FILL, LW, TILAPIA_MOUTH, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of an sRGB channel triple. */
function luminanceOf([r, g, b]: readonly number[]): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  return luminanceOf(channelsOf(hex));
}

const ratioOf = (la: number, lb: number): number => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrastRatio(a: string, b: string): number {
  return ratioOf(relativeLuminance(a), relativeLuminance(b));
}

/** The hero's belly: no cormorant fill is lighter (guide 7n hierarchy). */
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

/** Run `paint` with Path2D stubbed and return every fill and stroke it made. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Op[] {
  vi.stubGlobal('Path2D', LogPath);
  const ops: Op[] = [];
  const state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  const ctx = new Proxy(
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
  try {
    paint(ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return ops;
}

const isFill = (op: Op): boolean => op.op === 'fill';
const isStroke = (op: Op): boolean => op.op === 'stroke';
const opsOf = (frame: CormorantFrame): Op[] => record((ctx) => paintCormorant(ctx, frame));
/** The colour an op paints with. */
const styleOf = (op: Op): unknown => (isFill(op) ? op.fillStyle : op.strokeStyle);

/** The recorded `[cx, cy, rx, ry, rot]` of every ellipse in a path. */
function ellipsesOf(op: Op): number[][] {
  return op.cmds.filter((cmd) => cmd[0] === 'ellipse').map((cmd) => cmd.slice(1, 6) as number[]);
}

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

/** A frame rasterised at 1 px over CORMORANT_TEX: per pixel the opaque style on top, or null. */
interface Raster {
  readonly w: number;
  readonly h: number;
  readonly style: (string | null)[];
}

/** Paint the opaque (#rrggbb) ops of a frame back to front. See-through ops are internal details and left out. */
function rasterOf(frame: CormorantFrame): Raster {
  const { w, h, originX, originY } = CORMORANT_TEX;
  const style: (string | null)[] = new Array(w * h).fill(null);
  for (const op of opsOf(frame)) {
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

const rasters = new Map<CormorantFrame, Raster>();
function rasterFor(frame: CormorantFrame): Raster {
  if (!rasters.has(frame)) rasters.set(frame, rasterOf(frame));
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

/** The greyscale image of a raster: per pixel the luminance of the style on top, or null. */
function greyOf(r: Raster): (number | null)[] {
  return r.style.map((s) => (s === null ? null : relativeLuminance(s)));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cormorant colours (guide 3g, 10)', () => {
  it('uses the colours the guide records', () => {
    expect([CORMORANT_FEATHER, CORMORANT_RIM, CORMORANT_BILL, CORMORANT_EYE_RING, CORMORANT_WING_LINE, CORMORANT_SHINE]).toEqual([
      '#4b4a66',
      '#cec9f0',
      '#ffd98a',
      '#55e4d8',
      'rgba(206,201,240,0.4)',
      'rgba(255,255,255,0.5)',
    ]);
    expect(CORMORANT_RIM).toBe(DREAM_RIM_LIGHT.colour);
    expect(CORMORANT_BILL).toBe(HERON_BEAK);
    expect([CORMORANT_RIM_W, CORMORANT_BILL_INK, LW]).toEqual([2, 2.4, 3.5]);
  });

  it('prints the contrast ratios and luminances the guide prints, to 2 decimals', () => {
    const rows: readonly (readonly [string, string, number])[] = [
      [CORMORANT_FEATHER, INK, 1.69],
      [CORMORANT_BILL, INK, 10.65],
      [CORMORANT_RIM, INK, 9.07],
      [CORMORANT_RIM, CORMORANT_FEATHER, 5.36],
      [CORMORANT_EYE_RING, EYE, 11.18],
      [CORMORANT_EYE_RING, CORMORANT_FEATHER, 5.45],
    ];
    for (const [a, b, printed] of rows) expect(contrastRatio(a, b).toFixed(2)).toBe(printed.toFixed(2));
    expect(relativeLuminance(CORMORANT_FEATHER).toFixed(4)).toBe('0.0735');
    expect(relativeLuminance(CORMORANT_BILL).toFixed(4)).toBe('0.7272');
    expect(relativeLuminance(CORMORANT_RIM).toFixed(3)).toBe('0.612');
  });

  it('ink alone does not hold the feathers edge, but ink or rim is 3:1 or better on any background', () => {
    // the feathers against ink: the worst background sits between them
    expect(Math.sqrt(contrastRatio(CORMORANT_FEATHER, INK))).toBeLessThan(EDGE_FLOOR);
    expect(Math.sqrt(contrastRatio(CORMORANT_RIM, INK)).toFixed(2)).toBe('3.01');
    const ink = relativeLuminance(INK);
    const rim = relativeLuminance(CORMORANT_RIM);
    for (let i = 0; i <= 1000; i++) {
      const bg = i / 1000;
      expect(Math.max(ratioOf(bg, ink), ratioOf(bg, rim))).toBeGreaterThanOrEqual(EDGE_FLOOR);
    }
  });

  it.each([
    ['shallow', DEEP_CANAL_WATER_SHALLOW],
    ['mid', DEEP_CANAL_WATER_MID],
    ['deep', DEEP_CANAL_WATER_DEEP],
  ])('ink or rim is 3:1 or better on the %s deep canal water', (_name, water) => {
    expect(Math.max(contrastRatio(water, INK), contrastRatio(water, CORMORANT_RIM))).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('the bill and throat patch pass on any background on their own', () => {
    expect(Math.sqrt(contrastRatio(CORMORANT_BILL, INK))).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('no fill is lighter than the hero belly', () => {
    for (const fill of [CORMORANT_FEATHER, CORMORANT_RIM, CORMORANT_BILL, CORMORANT_EYE_RING]) {
      expect(relativeLuminance(fill)).toBeLessThan(relativeLuminance(HERO_BELLY));
    }
  });

  it.each(CORMORANT_FRAMES)('%s: paints only cormorant colours, ink, the eye and white glints, never a red', (frame) => {
    const styles = new Set(opsOf(frame).map(styleOf));
    expect(styles).toEqual(
      new Set([INK, CORMORANT_FEATHER, CORMORANT_RIM, CORMORANT_BILL, CORMORANT_EYE_RING, CORMORANT_WING_LINE, CORMORANT_SHINE, EYE, WHITE]),
    );
    expect(styles.has(TILAPIA_MOUTH)).toBe(false);
    expect(styles.has(LEGS_FILL)).toBe(false);
  });

  it.each(CORMORANT_FRAMES)('%s: keeps every op at alpha 1 (guide 10, Alpha)', (frame) => {
    expect(opsOf(frame).every((op) => op.globalAlpha === 1)).toBe(true);
  });
});

describe('cormorant rim light (guide 7n, 10)', () => {
  it.each(CORMORANT_FRAMES)('%s: every feather ellipse is inked LW outside, filled with the rim, and its core 2 px in with the feathers', (frame) => {
    const ops = opsOf(frame);
    const g = cormorantGeometry(frame);
    const all = [...g.wings, ...g.featherEllipses].map((e) => [e.cx, e.cy, e.rx, e.ry, e.rot]);
    const inked = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 * LW).flatMap(ellipsesOf);
    const rims = ops.filter((op) => isFill(op) && op.fillStyle === CORMORANT_RIM).flatMap(ellipsesOf);
    const cores = ops.filter((op) => isFill(op) && op.fillStyle === CORMORANT_FEATHER).flatMap(ellipsesOf);
    expect(rims).toEqual(all);
    expect(inked).toEqual(all);
    expect(cores).toEqual(all.map(([cx, cy, rx, ry, rot]) => [cx, cy, rx - CORMORANT_RIM_W, ry - CORMORANT_RIM_W, rot]));
  });

  it.each(CORMORANT_FRAMES)('%s: the neck tube is inked LW each side, then the rim, then a feather core 2 px in each side', (frame) => {
    const ops = opsOf(frame);
    const isNeck = (op: Op): boolean => isStroke(op) && op.cmds.some((cmd) => cmd[0] === 'bezierCurveTo');
    const widths = ops.filter(isNeck).map((op) => [op.strokeStyle, op.lineWidth]);
    expect(widths).toEqual([
      [INK, CORMORANT_NECK_W + 2 * LW],
      [CORMORANT_RIM, CORMORANT_NECK_W],
      [CORMORANT_FEATHER, CORMORANT_NECK_W - 2 * CORMORANT_RIM_W],
    ]);
  });

  it.each(CORMORANT_FRAMES)('%s: no feather pixel is within ink plus rim of the outside, so the dark body never meets the water bare', (frame) => {
    const r = rasterFor(frame);
    const reach = Math.floor(LW + CORMORANT_RIM_W) - 1;
    for (let py = 0; py < r.h; py++) {
      for (let px = 0; px < r.w; px++) {
        if (r.style[py * r.w + px] !== CORMORANT_FEATHER) continue;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            if (Math.hypot(dx, dy) > reach) continue;
            const x = px + dx;
            const y = py + dy;
            const outside = x < 0 || y < 0 || x >= r.w || y >= r.h || r.style[y * r.w + x] === null;
            expect(outside).toBe(false);
          }
        }
      }
    }
  });

  it.each(CORMORANT_FRAMES)('%s: every outermost painted pixel is ink, so the rim sits inside the ink', (frame) => {
    const r = rasterFor(frame);
    for (let py = 0; py < r.h; py++) {
      for (let px = 0; px < r.w; px++) {
        const s = r.style[py * r.w + px];
        if (s === null) continue;
        const edge = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => r.style[(py + dy) * r.w + (px + dx)] === null);
        if (edge) expect(s).toBe(INK);
      }
    }
  });
});

describe('cormorant anchors and sizes', () => {
  it('lists five frames: the two float frames, the warning crouch, the dive and the drying wings', () => {
    expect([...CORMORANT_FRAMES]).toEqual(['floatA', 'floatB', 'warn', 'dive', 'dry']);
    expect([...CORMORANT_FLOAT_FRAMES]).toEqual(['floatA', 'floatB']);
  });

  it('shares one integer frame between every frame, with the anchor inside it', () => {
    expect(Number.isInteger(CORMORANT_TEX.w) && Number.isInteger(CORMORANT_TEX.h)).toBe(true);
    expect(CORMORANT_TEX.originX).toBeGreaterThan(0);
    expect(CORMORANT_TEX.originX).toBeLessThan(CORMORANT_TEX.w);
    expect(CORMORANT_TEX.originY).toBeGreaterThan(0);
    expect(CORMORANT_TEX.originY).toBeLessThan(CORMORANT_TEX.h);
  });

  it.each(CORMORANT_FRAMES)('%s: everything painted fits CORMORANT_TEX with at least 4 px of padding', (frame) => {
    const { originX, originY, w, h } = CORMORANT_TEX;
    for (const op of opsOf(frame)) {
      const half = isStroke(op) ? op.lineWidth / 2 : 0;
      for (const [x, y] of polylinesOf(op.cmds).flat()) {
        expect(x - half + originX).toBeGreaterThanOrEqual(MIN_PAD);
        expect(y - half + originY).toBeGreaterThanOrEqual(MIN_PAD);
        expect(w - (x + half + originX)).toBeGreaterThanOrEqual(MIN_PAD);
        expect(h - (y + half + originY)).toBeGreaterThanOrEqual(MIN_PAD);
      }
    }
  });

  it('the anchor is the body centre: the float body is centred on it, the tail trails toward -x and the bill points +x', () => {
    const g = cormorantGeometry('floatA');
    const body = g.featherEllipses[g.featherEllipses.length - 2];
    expect([body.cx, body.cy, body.rot]).toEqual([0, 0, 0]);
    expect(g.featherEllipses[0].cx).toBeLessThan(-body.rx / 2);
    for (const frame of CORMORANT_FRAMES) expect(cormorantBillTip(frame).x).toBeGreaterThan(body.rx);
  });
});

describe('cormorant poses (guide 7n)', () => {
  it('floatB is floatA moved down by the 1.5 px bob, and nothing else', () => {
    expect(CORMORANT_BOB).toBe(1.5);
    const a = opsOf('floatA');
    const b = opsOf('floatB');
    expect(b.map(styleOf)).toEqual(a.map(styleOf));
    const ya = polylinesOf(a.flatMap((op) => op.cmds)).flat();
    const yb = polylinesOf(b.flatMap((op) => op.cmds)).flat();
    expect(yb).toHaveLength(ya.length);
    yb.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(ya[i][0], 9);
      expect(y - ya[i][1]).toBeCloseTo(CORMORANT_BOB, 9);
    });
  });

  it('float: the head is up and the bill level', () => {
    const g = cormorantGeometry('floatA');
    expect(g.billAngle).toBe(0);
    expect(g.head[1]).toBeLessThan(-20);
  });

  it('warn: the body tipped about 0.35 rad nose down, the tail up and the bill at the water', () => {
    const warn = cormorantGeometry('warn');
    const float = cormorantGeometry('floatA');
    const bodyOf = (g: ReturnType<typeof cormorantGeometry>) => g.featherEllipses[g.featherEllipses.length - 2];
    expect(bodyOf(warn).rot).toBe(CORMORANT_WARN_TILT);
    expect(CORMORANT_WARN_TILT).toBe(0.35);
    expect(warn.featherEllipses[0].cy).toBeLessThan(float.featherEllipses[0].cy - 4);
    expect(warn.head[1]).toBeGreaterThan(float.head[1] + 15);
    expect(warn.billAngle).toBeGreaterThan(0.4);
    // the bill tip is at the water line, level with the body centre, give or take a few px
    expect(Math.abs(cormorantBillTip('warn').y)).toBeLessThanOrEqual(8);
  });

  it('dive: the neck straight, the head level with the body and no wings out', () => {
    const g = cormorantGeometry('dive');
    expect(g.billAngle).toBe(0);
    expect(g.head[1]).toBe(0);
    expect(g.neck.every((c) => c[1] === 0 && c[3] === 0 && c[5] === 0)).toBe(true);
    expect(g.wings).toHaveLength(0);
  });

  it('dry: two wings held out to either side with rounded ends; every other frame has none', () => {
    const g = cormorantGeometry('dry');
    expect(g.wings).toHaveLength(2);
    const [back, front] = g.wings;
    expect(back.cx).toBeLessThan(0);
    expect(front.cx).toBeGreaterThan(0);
    for (const wing of g.wings) expect(wing.cy).toBeLessThan(0);
    for (const frame of ['floatA', 'floatB', 'warn', 'dive'] as const) expect(cormorantGeometry(frame).wings).toHaveLength(0);
  });

  it('every frame is drawn differently', () => {
    const drawn = CORMORANT_FRAMES.map((frame) => JSON.stringify(opsOf(frame).map((op) => op.cmds)));
    expect(new Set(drawn).size).toBe(CORMORANT_FRAMES.length);
  });
});

describe('cormorant face and bill (never scary, never grabbing)', () => {
  it.each(CORMORANT_FRAMES)('%s: the bill is one closed path with a round tip, so it is never open', (frame) => {
    const ops = opsOf(frame);
    const bills = ops.filter((op) => isFill(op) && op.fillStyle === CORMORANT_BILL && op.cmds.some((cmd) => cmd[0] === 'arc'));
    expect(bills).toHaveLength(1);
    expect(bills[0].cmds.map(([name]) => name)).toEqual(['moveTo', 'lineTo', 'arc', 'lineTo', 'closePath']);
    // a round tip: the arc is a half circle sweeping through the bill direction
    const [, cx, cy, r, start, end, ccw] = bills[0].cmds[2] as [string, number, number, number, number, number, boolean];
    expect(r).toBeGreaterThanOrEqual(2);
    expect(start - end).toBeCloseTo(Math.PI, 9);
    expect(ccw).toBe(true);
    const tip = cormorantBillTip(frame);
    expect(Math.hypot(tip.x - cx, tip.y - cy)).toBeCloseTo(r, 9);
    // its ink sits just behind it, CORMORANT_BILL_INK outside
    const ink = ops[ops.indexOf(bills[0]) - 1];
    expect([ink.op, ink.strokeStyle, ink.lineWidth]).toEqual(['stroke', INK, 2 * CORMORANT_BILL_INK]);
    expect(ink.cmds).toEqual(bills[0].cmds);
  });

  it.each(CORMORANT_FRAMES)('%s: one throat patch, inked, on the head', (frame) => {
    const ops = opsOf(frame);
    const g = cormorantGeometry(frame);
    const patches = ops.filter((op) => isFill(op) && op.fillStyle === CORMORANT_BILL && ellipsesOf(op).length > 0);
    expect(patches).toHaveLength(1);
    const [cx, cy, rx] = ellipsesOf(patches[0])[0];
    expect(Math.hypot(cx - g.head[0], cy - g.head[1]) + rx).toBeLessThanOrEqual(CORMORANT_HEAD_R + 1);
  });

  it.each(CORMORANT_FRAMES)('%s: one bead eye with two glints and a teal ring, inside the head', (frame) => {
    const ops = opsOf(frame);
    const g = cormorantGeometry(frame);
    const bead = ops.filter((op) => isFill(op) && op.fillStyle === EYE);
    expect(bead).toHaveLength(1);
    const [ex, ey, r] = ellipsesOf(bead[0])[0];
    expect(r).toBe(CORMORANT_EYE_R);
    expect([ex, ey]).toEqual([g.eye[0], g.eye[1]]);
    expect(ellipsesOf(ops.find((op) => isFill(op) && op.fillStyle === WHITE)!)).toHaveLength(2);
    const rings = ops.filter((op) => isStroke(op) && op.strokeStyle === CORMORANT_EYE_RING);
    expect(rings).toHaveLength(1);
    const [rx, ry, ringR] = ellipsesOf(rings[0])[0];
    expect([rx, ry]).toEqual([ex, ey]);
    expect(Math.hypot(ex - g.head[0], ey - g.head[1]) + ringR + rings[0].lineWidth / 2).toBeLessThanOrEqual(CORMORANT_HEAD_R);
  });

  it.each(CORMORANT_FRAMES)('%s: one shine and no pointed part: every outer part is an ellipse or a round-capped tube', (frame) => {
    const ops = opsOf(frame);
    expect(ops.filter((op) => isFill(op) && op.fillStyle === CORMORANT_SHINE)).toHaveLength(1);
    for (const op of ops.filter((o) => isStroke(o) && o.strokeStyle === INK)) {
      const names = new Set(op.cmds.map(([name]) => name));
      for (const name of names) expect(['moveTo', 'ellipse', 'bezierCurveTo', 'lineTo', 'arc', 'closePath']).toContain(name);
    }
  });
});

describe('cormorant in greyscale (guide 10): each phase is a change of shape', () => {
  const sil = Object.fromEntries(CORMORANT_FRAMES.map((f) => [f, silhouetteOf(rasterFor(f))])) as Record<
    CormorantFrame,
    ReturnType<typeof silhouetteOf>
  >;

  it('the silhouettes of every two frames differ', () => {
    for (let i = 0; i < CORMORANT_FRAMES.length; i++) {
      for (let j = i + 1; j < CORMORANT_FRAMES.length; j++) {
        const a = CORMORANT_FRAMES[i];
        const b = CORMORANT_FRAMES[j];
        const floats = CORMORANT_FLOAT_FRAMES.includes(a) && CORMORANT_FLOAT_FRAMES.includes(b);
        expect(silhouetteDifference(rasterFor(a), rasterFor(b))).toBeGreaterThan(floats ? 0 : 0.2);
      }
    }
  });

  it('the float frames are the same shape a bob apart: the same size, the top one row or two lower', () => {
    expect(sil.floatB.width).toBe(sil.floatA.width);
    expect(Math.abs(sil.floatB.height - sil.floatA.height)).toBeLessThanOrEqual(1);
    expect(sil.floatB.top - sil.floatA.top).toBeGreaterThanOrEqual(1);
    expect(sil.floatB.top - sil.floatA.top).toBeLessThanOrEqual(2);
  });

  it('warn is a low hump: much shorter than the upright float, its top lower', () => {
    expect(sil.warn.height).toBeLessThan(sil.floatA.height * 0.8);
    expect(sil.warn.top).toBeGreaterThan(sil.floatA.top + 10);
  });

  it('dive is a long slim shape: at least three times as wide as tall, unlike the float', () => {
    expect(sil.dive.width / sil.dive.height).toBeGreaterThanOrEqual(3);
    expect(sil.floatA.width / sil.floatA.height).toBeLessThan(2);
  });

  it('dry is a wide T: wider than the float by a fifth or more', () => {
    expect(sil.dry.width).toBeGreaterThanOrEqual(sil.floatA.width * 1.2);
    expect(sil.dry.area).toBeGreaterThan(sil.floatA.area * 1.2);
  });

  it.each(CORMORANT_FRAMES)('%s: a dark body traced by a pale rim: the feathers are the darkest fill and the rim lights them', (frame) => {
    const grey = greyOf(rasterFor(frame));
    const feather = relativeLuminance(CORMORANT_FEATHER);
    const rim = relativeLuminance(CORMORANT_RIM);
    const count = (v: number): number => grey.filter((g) => g !== null && Math.abs(g - v) < 1e-9).length;
    expect(count(feather)).toBeGreaterThan(0);
    expect(count(rim)).toBeGreaterThan(0);
    expect(ratioOf(rim, feather)).toBeGreaterThanOrEqual(5);
  });
});
