/**
 * Pelican colours, outline contrast, sizes, poses, closed bill, empty pouch and greyscale cues
 * (issue #211; guide 3g, 10), headless, plus the lake bake of the pelican textures. The painters run
 * against a recording context and a stub Path2D (the same approach as cormorantArt.test.ts): every
 * fill and stroke is kept with the style, width and alpha it was painted under. The greyscale and
 * outline checks rasterise the recorded paths, so they read what was painted, not what the geometry
 * says. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PELICAN_PHASES } from '../logic/pelicanLine';
import {
  PELICAN_BILL,
  PELICAN_BILL_HEAD_BACK,
  PELICAN_BILL_INK,
  PELICAN_BILL_TEX,
  PELICAN_BOB,
  PELICAN_EYE_R,
  PELICAN_FEATHER,
  PELICAN_FLOAT_FRAMES,
  PELICAN_FRAMES,
  PELICAN_FRAME_OF_PHASE,
  PELICAN_HEAD_R,
  PELICAN_HEAD_TO_TIP,
  PELICAN_NECK_LEN,
  PELICAN_NECK_TEX,
  PELICAN_NECK_TOP_Y,
  PELICAN_NECK_W,
  PELICAN_NECK_X,
  PELICAN_POUCH,
  PELICAN_POUCH_HOLLOW,
  PELICAN_SHINE,
  PELICAN_SPLASH,
  PELICAN_SPLASH_DROPS,
  PELICAN_SPLASH_TEX,
  PELICAN_TEX,
  PELICAN_WING_LINE,
  paintPelican,
  paintPelicanBill,
  paintPelicanNeck,
  paintPelicanSplash,
  pelicanBillPieceGeometry,
  pelicanBillTip,
  pelicanGeometry,
  type PelicanFrame,
} from './drawPelican';
import { LAKE_TEX, LAKE_TEX_MAX_H, LAKE_TEX_MAX_W, LAKE_TEX_SIZES, bakeLakeTextures } from './lakeTextures';
import { LEUCISTIC, EYE, INK, LEGS_FILL, LW, TILAPIA_MOUTH, WHITE } from './palette';
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

/** The hero's belly: no pelican fill is lighter (guide 2). */
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
const opsOf = (frame: PelicanFrame): Op[] => record((ctx) => paintPelican(ctx, frame));
const billOps = (): Op[] => record(paintPelicanBill);
const neckOps = (): Op[] => record(paintPelicanNeck);
const splashOps = (): Op[] => record(paintPelicanSplash);

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
function frameRaster(frame: PelicanFrame): Raster {
  if (!rasters.has(frame)) rasters.set(frame, rasterOf(opsOf(frame), PELICAN_TEX));
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pelican colours and outline contrast (guide 3g, 10)', () => {
  it('uses the colours the file records', () => {
    expect([PELICAN_FEATHER, PELICAN_BILL, PELICAN_POUCH, PELICAN_POUCH_HOLLOW, PELICAN_SPLASH]).toEqual([
      '#e8e4f4',
      '#ffa63d',
      '#ffc977',
      '#e8803a',
      '#cfeaf5',
    ]);
    expect([PELICAN_WING_LINE, PELICAN_SHINE]).toEqual(['rgba(120,110,170,0.45)', 'rgba(255,255,255,0.7)']);
    expect([PELICAN_BILL_INK, LW]).toEqual([2.4, 3.5]);
  });

  it('prints the contrast ratios and luminances the file prints, to 2 decimals', () => {
    const rows: readonly (readonly [string, number, number])[] = [
      [PELICAN_FEATHER, 0.7917, 11.54],
      [PELICAN_BILL, 0.4887, 7.38],
      [PELICAN_POUCH, 0.6437, 9.51],
      [PELICAN_POUCH_HOLLOW, 0.329, 5.2],
      [PELICAN_SPLASH, 0.787, 11.47],
    ];
    for (const [colour, luminance, ratio] of rows) {
      expect(relativeLuminance(colour)).toBeCloseTo(luminance, 3);
      expect(contrastRatio(colour, INK)).toBeCloseTo(ratio, 1);
    }
  });

  it('every fill holds against its ink at 4.5:1 or better, so the ink holds the edge on its own', () => {
    for (const fill of [PELICAN_FEATHER, PELICAN_BILL, PELICAN_POUCH, PELICAN_POUCH_HOLLOW, PELICAN_SPLASH]) {
      expect(contrastRatio(fill, INK)).toBeGreaterThanOrEqual(4.5);
    }
    // the ink against the lightest lit lake water and the sky horizon is 3:1 or better (drawLake.ts)
    expect(contrastRatio(INK, '#5cc8c4')).toBeGreaterThanOrEqual(EDGE_FLOOR);
  });

  it('the bird is white and orange: the feathers are light and the bill is orange', () => {
    const [r, g, b] = channelsOf(PELICAN_FEATHER);
    expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(0xe0);
    const [br, bg, bb] = channelsOf(PELICAN_BILL);
    expect(br).toBe(255);
    expect(br).toBeGreaterThan(bg);
    expect(bg).toBeGreaterThan(bb);
  });

  it('no fill is lighter than the hero belly', () => {
    for (const fill of [PELICAN_FEATHER, PELICAN_BILL, PELICAN_POUCH, PELICAN_POUCH_HOLLOW, PELICAN_SPLASH]) {
      expect(relativeLuminance(fill)).toBeLessThan(relativeLuminance(HERO_BELLY));
    }
  });

  it.each(PELICAN_FRAMES)('%s: paints only pelican colours, ink, the eye and white glints, never an axolotl or leg colour or a red', (frame) => {
    const styles = new Set(opsOf(frame).map(styleOf));
    for (const style of styles) {
      expect([INK, PELICAN_FEATHER, PELICAN_BILL, PELICAN_POUCH, PELICAN_POUCH_HOLLOW, PELICAN_WING_LINE, PELICAN_SHINE, EYE, WHITE]).toContain(style);
    }
    expect(styles.has(TILAPIA_MOUTH)).toBe(false);
    expect(styles.has(LEGS_FILL)).toBe(false);
    // none of the hero's own colours (the eye bead is the one shared ink-dark, and white the shared glint)
    for (const colour of Object.values(LEUCISTIC)) {
      if (typeof colour === 'string' && colour !== EYE && colour !== WHITE) expect(styles.has(colour)).toBe(false);
    }
  });

  it.each(PELICAN_FRAMES)('%s: keeps every op at alpha 1 (guide 10, Alpha)', (frame) => {
    expect(opsOf(frame).every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it.each(PELICAN_FRAMES)('%s: every outer edge pixel is ink', (frame) => {
    const r = frameRaster(frame);
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
    expect(edge).toBeGreaterThan(100);
  });

  it('the pieces and the splash are inked on every outer edge too', () => {
    for (const [ops, tex] of [
      [billOps(), PELICAN_BILL_TEX],
      [neckOps(), PELICAN_NECK_TEX],
      [splashOps(), PELICAN_SPLASH_TEX],
    ] as const) {
      const r = rasterOf(ops, tex);
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
          if (open) expect(here).toBe(INK);
        }
      }
    }
  });
});

describe('pelican anchors, sizes and no paint outside the texture', () => {
  it('lists five body frames: the two float frames, the warning, the scoop and the rise', () => {
    expect(PELICAN_FRAMES).toEqual(['floatA', 'floatB', 'warn', 'scoop', 'rise']);
    expect(PELICAN_FLOAT_FRAMES).toEqual(['floatA', 'floatB']);
  });

  it('holds a frame for every phase of the line', () => {
    expect(Object.keys(PELICAN_FRAME_OF_PHASE)).toEqual([...PELICAN_PHASES]);
    expect(PELICAN_FRAME_OF_PHASE).toEqual({ glide: 'floatA', warn: 'warn', plunge: 'scoop', hold: 'scoop', rise: 'rise' });
  });

  it('every texture frame is an integer size with its anchor inside, and small (the small-sprites rule)', () => {
    for (const tex of [PELICAN_TEX, PELICAN_BILL_TEX, PELICAN_NECK_TEX, PELICAN_SPLASH_TEX]) {
      for (const v of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(v)).toBe(true);
      expect(tex.originX).toBeGreaterThan(0);
      expect(tex.originX).toBeLessThan(tex.w);
      expect(tex.originY).toBeGreaterThan(0);
      expect(tex.originY).toBeLessThan(tex.h);
      expect(tex.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
      expect(tex.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
    }
  });

  it.each(PELICAN_FRAMES)('%s: paints nothing outside the texture and leaves at least 4 px of padding', (frame) => {
    const b = paintedBounds(opsOf(frame));
    const { w, h, originX, originY } = PELICAN_TEX;
    expect(b.minX).toBeGreaterThanOrEqual(-originX + MIN_PAD);
    expect(b.minY).toBeGreaterThanOrEqual(-originY + MIN_PAD);
    expect(b.maxX).toBeLessThanOrEqual(w - originX - MIN_PAD);
    expect(b.maxY).toBeLessThanOrEqual(h - originY - MIN_PAD);
  });

  it('the bill piece, the neck piece and the splash paint nothing outside their textures', () => {
    for (const [ops, tex] of [
      [billOps(), PELICAN_BILL_TEX],
      [neckOps(), PELICAN_NECK_TEX],
      [splashOps(), PELICAN_SPLASH_TEX],
    ] as const) {
      const b = paintedBounds(ops);
      expect(b.minX).toBeGreaterThanOrEqual(-tex.originX + MIN_PAD);
      expect(b.minY).toBeGreaterThanOrEqual(-tex.originY + MIN_PAD);
      expect(b.maxX).toBeLessThanOrEqual(tex.w - tex.originX - MIN_PAD);
      expect(b.maxY).toBeLessThanOrEqual(tex.h - tex.originY - MIN_PAD);
    }
  });

  it('the anchor is the water line under the body centre: the float body sits above it, the tail trails toward -x and the bill points +x', () => {
    const g = pelicanGeometry('floatA');
    const body = g.featherEllipses[1];
    expect(body.cx).toBe(0);
    expect(body.cy + body.ry).toBeLessThanOrEqual(LW);
    expect(body.cy - body.ry).toBeLessThan(-body.ry);
    expect(g.featherEllipses[0].cx).toBeLessThan(body.cx);
    expect(g.head!.billTip[0]).toBeGreaterThan(g.head!.head.cx);
    expect(pelicanBillTip('floatA')!.x).toBe(g.head!.billTip[0]);
    expect(pelicanBillTip('scoop')).toBeNull();
  });

  it('the bill piece hangs from its round bill tip at the anchor, pointing down, with the head centre above it', () => {
    const g = pelicanBillPieceGeometry();
    expect(g.billTip[0]).toBeCloseTo(0, 9);
    expect(g.billTip[1]).toBeCloseTo(0, 9);
    expect(g.head.cx).toBeCloseTo(0, 9);
    expect(g.head.cy).toBeCloseTo(-PELICAN_BILL_HEAD_BACK, 9);
    expect(PELICAN_BILL_HEAD_BACK).toBe(PELICAN_HEAD_TO_TIP);
    expect(g.billAngle).toBeCloseTo(Math.PI / 2, 9);
    // the face is on the +x side: the eye is right of the head centre
    expect(g.eye[0]).toBeGreaterThan(g.head.cx);
  });

  it('the neck piece is a tube from its top end centre down by its length; the stump frames meet it on the neck column', () => {
    const [stroke] = neckOps().filter((op) => isStroke(op) && op.strokeStyle === PELICAN_FEATHER);
    expect(stroke.lineWidth).toBe(PELICAN_NECK_W);
    expect(stroke.cmds).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 0, PELICAN_NECK_LEN],
    ]);
    for (const frame of ['scoop', 'rise'] as const) {
      const neck = pelicanGeometry(frame).neck;
      const end = neck[neck.length - 1];
      expect([end[4], end[5]]).toEqual([PELICAN_NECK_X, PELICAN_NECK_TOP_Y]);
    }
  });

  it('the splash is a low ring and a symmetric crown of five round drops, centred on the water line', () => {
    expect(PELICAN_SPLASH_DROPS).toHaveLength(5);
    const xs = PELICAN_SPLASH_DROPS.map((d) => d.x);
    expect(xs.map((x) => 0 - x).reverse().map((x) => x + 0)).toEqual(xs.map((x) => x + 0));
    expect(PELICAN_SPLASH_DROPS.every((d) => d.y < 0)).toBe(true);
    const fills = splashOps().filter((op) => isFill(op) && op.fillStyle === PELICAN_SPLASH);
    expect(fills).toHaveLength(6);
    expect(ellipsesOf(fills[0])[0].slice(0, 2)).toEqual([0, 0]);
  });
});

describe('pelican poses and the lake bake', () => {
  it('floatB is floatA moved down by the 1.5 px bob, and nothing else', () => {
    expect(PELICAN_BOB).toBe(1.5);
    const a = pelicanGeometry('floatA');
    const b = pelicanGeometry('floatB');
    for (const [ea, eb] of a.featherEllipses.map((e, i) => [e, b.featherEllipses[i]] as const)) {
      expect(eb.cx).toBe(ea.cx);
      expect(eb.cy - ea.cy).toBeCloseTo(PELICAN_BOB, 9);
    }
    expect(b.head!.billAngle).toBe(a.head!.billAngle);
    expect(b.head!.billTip[1] - a.head!.billTip[1]).toBeCloseTo(PELICAN_BOB, 9);
  });

  it('float: the head is up and the bill level or slightly down; the pouch is relaxed and slim', () => {
    const g = pelicanGeometry('floatA').head!;
    expect(g.head.cy).toBeLessThan(-PELICAN_HEAD_R);
    expect(Math.abs(g.billAngle)).toBeLessThan(0.3);
    expect(g.hollow).toBeNull();
    expect(g.pouch.ry).toBeLessThan(5);
  });

  it('warn: the neck stands straight up, the head is tipped back and the pouch is open with an empty hollow', () => {
    const w = pelicanGeometry('warn').head!;
    const f = pelicanGeometry('floatA').head!;
    expect(w.head.cy).toBeLessThan(f.head.cy - 15);
    expect(w.billAngle).toBeLessThan(0);
    expect(w.hollow).not.toBeNull();
    expect(w.pouch.ry).toBeGreaterThan(2 * f.pouch.ry);
    // the hollow lies inside the pouch and holds nothing: only pouch colours are painted on the head
    const hollow = w.hollow!;
    expect(Math.hypot(hollow.cx - w.pouch.cx, hollow.cy - w.pouch.cy) + hollow.rx).toBeLessThan(w.pouch.rx + 1);
    expect(opsOf('floatA').some((op) => op.fillStyle === PELICAN_POUCH_HOLLOW)).toBe(false);
    expect(opsOf('warn').filter((op) => isFill(op) && op.fillStyle === PELICAN_POUCH_HOLLOW)).toHaveLength(1);
  });

  it('scoop: the body is tipped nose down with the tail up, and there is no head; rise: nose up, two wings lifted, no head', () => {
    const scoop = pelicanGeometry('scoop');
    const rise = pelicanGeometry('rise');
    const float = pelicanGeometry('floatA');
    expect(scoop.head).toBeNull();
    expect(rise.head).toBeNull();
    expect(scoop.featherEllipses[1].rot).toBeGreaterThan(0.3);
    expect(scoop.featherEllipses[0].cy).toBeLessThan(float.featherEllipses[0].cy - 8);
    expect(rise.featherEllipses[1].rot).toBeLessThan(-0.1);
    expect(rise.wings).toHaveLength(2);
    expect(scoop.wings).toHaveLength(0);
    expect(float.wings).toHaveLength(0);
    expect(pelicanGeometry('warn').wings).toHaveLength(0);
  });

  it('every frame is drawn differently', () => {
    const drawn = PELICAN_FRAMES.map((frame) => JSON.stringify(opsOf(frame)));
    expect(new Set(drawn).size).toBe(PELICAN_FRAMES.length);
  });

  it('is deterministic: the same frame paints the same ops every time', () => {
    for (const frame of PELICAN_FRAMES) expect(JSON.stringify(opsOf(frame))).toBe(JSON.stringify(opsOf(frame)));
    expect(JSON.stringify(billOps())).toBe(JSON.stringify(billOps()));
    expect(JSON.stringify(neckOps())).toBe(JSON.stringify(neckOps()));
    expect(JSON.stringify(splashOps())).toBe(JSON.stringify(splashOps()));
  });

  /** A scene stand-in whose texture manager records each canvas texture made, its size and what was painted. */
  function fakeScene(made: Map<string, { w: number; h: number; ops: Op[] }>): never {
    return {
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
  }

  it('bakeLakeTextures bakes ten small textures once, each at the logical size times the bake scale', () => {
    vi.stubGlobal('Path2D', LogPath);
    const made = new Map<string, { w: number; h: number; ops: Op[] }>();
    const lake = bakeLakeTextures(fakeScene(made), 2);
    expect([...made.keys()].sort()).toEqual(Object.values(LAKE_TEX).sort());
    expect(Object.keys(lake.info).sort()).toEqual(Object.values(LAKE_TEX).sort());
    for (const [key, texture] of made) {
      const size = LAKE_TEX_SIZES[key];
      expect([texture.w, texture.h]).toEqual([Math.ceil(size.w * 2), Math.ceil(size.h * 2)]);
      expect(texture.ops.length).toBeGreaterThan(0);
      expect(lake.info[key].scale).toBe(2);
      expect([lake.info[key].w, lake.info[key].h]).toEqual([size.w, size.h]);
    }
  });

  it('bakeLakeTextures anchors every pelican texture where the painters say', () => {
    vi.stubGlobal('Path2D', LogPath);
    const lake = bakeLakeTextures(fakeScene(new Map()), 1);
    for (const frame of PELICAN_FRAMES) {
      expect([lake.pelican[frame].originX, lake.pelican[frame].originY]).toEqual([PELICAN_TEX.originX, PELICAN_TEX.originY]);
    }
    expect(lake.pelicanBill.originY).toBe(PELICAN_BILL_TEX.originY);
    expect(lake.pelicanNeck.originX).toBe(PELICAN_NECK_TEX.originX);
    expect(lake.pelicanSplash.originX).toBe(PELICAN_SPLASH_TEX.originX);
  });
});

describe('pelican closed bill and empty pouch (never scary, never grabbing)', () => {
  const headFrames: readonly PelicanFrame[] = ['floatA', 'floatB', 'warn'];

  it.each(headFrames)('%s: the bill is one closed path with a round tip, so it is never open', (frame) => {
    const ops = opsOf(frame);
    const bills = ops.filter((op) => isFill(op) && op.fillStyle === PELICAN_BILL);
    expect(bills).toHaveLength(1);
    expect(bills[0].cmds.map(([name]) => name)).toEqual(['moveTo', 'lineTo', 'arc', 'lineTo', 'closePath']);
    const [, cx, cy, r, start, end, ccw] = bills[0].cmds[2] as [string, number, number, number, number, number, boolean];
    expect(r).toBeGreaterThanOrEqual(2);
    expect(start - end).toBeCloseTo(Math.PI, 9);
    expect(ccw).toBe(true);
    const tip = pelicanBillTip(frame)!;
    expect(Math.hypot(tip.x - cx, tip.y - cy)).toBeCloseTo(r, 9);
    const ink = ops[ops.indexOf(bills[0]) - 1];
    expect([ink.op, ink.strokeStyle, ink.lineWidth]).toEqual(['stroke', INK, 2 * PELICAN_BILL_INK]);
    expect(ink.cmds).toEqual(bills[0].cmds);
  });

  it('the bill piece has one closed bill, and the pouch is behind it', () => {
    const ops = billOps();
    const bills = ops.filter((op) => isFill(op) && op.fillStyle === PELICAN_BILL);
    expect(bills).toHaveLength(1);
    expect(bills[0].cmds.map(([name]) => name)).toEqual(['moveTo', 'lineTo', 'arc', 'lineTo', 'closePath']);
    const pouch = ops.findIndex((op) => isFill(op) && op.fillStyle === PELICAN_POUCH);
    expect(pouch).toBeGreaterThanOrEqual(0);
    expect(pouch).toBeLessThan(ops.indexOf(bills[0]));
  });

  it.each(headFrames)('%s: the pouch is one empty sac: one pouch fill, painted before the feathers, nothing painted inside it', (frame) => {
    const ops = opsOf(frame);
    const pouches = ops.filter((op) => isFill(op) && op.fillStyle === PELICAN_POUCH);
    expect(pouches).toHaveLength(1);
    const sac = ellipsesOf(pouches[0])[0];
    // every opaque fill painted after the pouch that lies wholly inside the pouch is the hollow, and only that
    const after = ops.slice(ops.indexOf(pouches[0]) + 1).filter((op) => isFill(op) && typeof op.fillStyle === 'string' && op.fillStyle.startsWith('#'));
    const inside = after.filter((op) => {
      const e = ellipsesOf(op)[0];
      return e && Math.hypot(e[0] - sac[0], e[1] - sac[1]) + e[2] < sac[2];
    });
    for (const op of inside) expect(op.fillStyle).toBe(PELICAN_POUCH_HOLLOW);
  });

  it.each(PELICAN_FRAMES)('%s: no axolotl, no tooth, no talon and no brow: only ellipses, round-capped tubes and the bill', (frame) => {
    const ops = opsOf(frame);
    for (const op of ops) {
      const names = new Set(op.cmds.map(([name]) => name));
      for (const name of names) expect(['moveTo', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'lineTo', 'arc', 'closePath']).toContain(name);
    }
    expect(ops.filter((op) => isFill(op) && op.fillStyle === PELICAN_SHINE)).toHaveLength(1);
  });

  it.each(headFrames)('%s: one bead eye with two glints, inside the head', (frame) => {
    const ops = opsOf(frame);
    const g = pelicanGeometry(frame).head!;
    const bead = ops.filter((op) => isFill(op) && op.fillStyle === EYE);
    expect(bead).toHaveLength(1);
    const [ex, ey, r] = ellipsesOf(bead[0])[0];
    expect(r).toBe(PELICAN_EYE_R);
    expect([ex, ey]).toEqual([g.eye[0], g.eye[1]]);
    expect(ellipsesOf(ops.find((op) => isFill(op) && op.fillStyle === WHITE)!)).toHaveLength(2);
    expect(Math.hypot(ex - g.head.cx, ey - g.head.cy) + r).toBeLessThanOrEqual(PELICAN_HEAD_R);
  });

  it('the stump frames paint no eye and no bill', () => {
    for (const frame of ['scoop', 'rise'] as const) {
      const ops = opsOf(frame);
      expect(ops.some((op) => op.fillStyle === EYE)).toBe(false);
      expect(ops.some((op) => op.fillStyle === PELICAN_BILL)).toBe(false);
      expect(ops.some((op) => op.fillStyle === PELICAN_POUCH)).toBe(false);
    }
  });
});

describe('pelican in greyscale (guide 10): each phase is a change of shape', () => {
  it('the silhouettes of every two frames differ by a visible share, except the two float frames, a bob apart', () => {
    for (let i = 0; i < PELICAN_FRAMES.length; i++) {
      for (let j = i + 1; j < PELICAN_FRAMES.length; j++) {
        const diff = silhouetteDifference(frameRaster(PELICAN_FRAMES[i]), frameRaster(PELICAN_FRAMES[j]));
        if (PELICAN_FRAMES[i] === 'floatA' && PELICAN_FRAMES[j] === 'floatB') continue;
        expect(diff, `${PELICAN_FRAMES[i]} v ${PELICAN_FRAMES[j]}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('the float frames are the same shape a bob apart: the same size, the top one row or two lower', () => {
    const a = silhouetteOf(frameRaster('floatA'));
    const b = silhouetteOf(frameRaster('floatB'));
    expect(b.width).toBe(a.width);
    expect(Math.abs(b.area - a.area) / a.area).toBeLessThan(0.02);
    expect(b.top - a.top).toBeGreaterThanOrEqual(1);
    expect(b.top - a.top).toBeLessThanOrEqual(2);
  });

  it('warn has a different silhouette: much taller than the float, and its top is far above the float top', () => {
    const float = silhouetteOf(frameRaster('floatA'));
    const warn = silhouetteOf(frameRaster('warn'));
    expect(warn.height).toBeGreaterThanOrEqual(float.height * 1.3);
    expect(float.top - warn.top).toBeGreaterThanOrEqual(15);
    // the shape differs from every other frame by a quarter of its pixels or more
    for (const other of PELICAN_FRAMES.filter((f) => f !== 'warn')) {
      expect(silhouetteDifference(frameRaster('warn'), frameRaster(other)), other).toBeGreaterThan(0.2);
    }
  });

  it('scoop has no head, so it is shorter than the float and lies lower than the warning', () => {
    const scoop = silhouetteOf(frameRaster('scoop'));
    expect(scoop.height).toBeLessThan(silhouetteOf(frameRaster('floatA')).height);
    expect(scoop.height).toBeLessThan(silhouetteOf(frameRaster('warn')).height);
  });

  it('rise is wider across the top than the float: two wings lifted in a V', () => {
    const rise = silhouetteOf(frameRaster('rise'));
    expect(rise.height).toBeGreaterThanOrEqual(silhouetteOf(frameRaster('scoop')).height + 15);
  });
});
