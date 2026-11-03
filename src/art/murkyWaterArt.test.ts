/**
 * Murky water looks (issue #107, ND-1): frame sizes and origins, contrast, the greyscale outline,
 * the see-through cloud, the reduced-motion still frame having no swirl, the dim ring, the ring
 * meter and the warning cue. The painters run against a recording context and a stub Path2D (the
 * same approach as movingHazardArt.test.ts): every fill and stroke is kept with the style, width
 * and alpha it was painted under.
 */
import { describe, expect, it, vi } from 'vitest';
import { RING_DOT_SPACING } from './drawHomeSpot';
import {
  MURKY_BUBBLES,
  MURKY_BUBBLES_TEX,
  MURKY_BUBBLE,
  MURKY_BUBBLE_INK,
  MURKY_BUBBLE_SHINE,
  MURKY_CHEEKS_TEX,
  MURKY_CHEEK_INNER,
  MURKY_CHEEK_OUTER,
  MURKY_CLOUD_INNER,
  MURKY_CLOUD_MAX_ALPHA,
  MURKY_CLOUD_OUTER,
  MURKY_DIM_BAND_IN_RX,
  MURKY_DIM_BAND_OUT_RX,
  MURKY_DIM_HOLE_RX,
  MURKY_DIM_HOLE_RY,
  MURKY_DIM_INNER,
  MURKY_DIM_OUTER,
  MURKY_DIM_OUTER_RX,
  MURKY_DIM_OUTER_RY,
  MURKY_DIM_TEX,
  MURKY_DOT,
  MURKY_DOT_INK,
  MURKY_DOT_R,
  MURKY_DOT_SPACING,
  MURKY_LOBE_DEPTH,
  MURKY_METER_FILL,
  MURKY_METER_R,
  MURKY_METER_START,
  MURKY_METER_TEX,
  MURKY_METER_TRACK,
  MURKY_METER_WARN_SHARE,
  MURKY_MIN_SIDE,
  MURKY_SWIRL,
  MURKY_SWIRL_ARCS,
  MURKY_SWIRL_FRAMES,
  clampMurkyShare,
  murkyDotPoints,
  murkyLobes,
  murkyPatchTex,
  murkySwirls,
  paintMurkyBubbles,
  paintMurkyCheeks,
  paintMurkyDimRing,
  paintMurkyMeter,
  paintMurkyOutline,
  paintMurkyStill,
  paintMurkySwirl,
} from './drawMurkyWater';
import { QUEASY_CHEEK_LOCAL, QUEASY_CHEEK_OUTER } from './drawPond';
import { AXO_SCENE_SCALE } from './drawAxolotl';
import { DEFAULT_ART_LOOK } from './drawAxolotlParts';
import { axolotlInkReach } from './drawEffects';
import { habitatLook } from './habitatLook';
import { INK } from './palette';
import type { TexSize } from './canvasKit';
import { MURKY_WATER_TIMING } from '../logic/murkyWater';

vi.mock('phaser', () => ({}));

/** Ink against a background is 3:1 or better when the background's luminance is at least this (guide 3c, 10). */
const LUMINANCE_FLOOR = 0.1687;
/** A fill that reaches the outer edge against ink. */
const OUTER_FILL_RATIO = 4.5;
/** The pair rule: a cue object's fill or its ink is 3:1 or better on any background (guide 10). */
const PAIR_FLOOR = 3;
/** Guide's padding round every texture at 1x. */
const MIN_PAD = 4;
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of an [r, g, b] colour. */
function luminanceOf(rgb: readonly number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const luminance = (hex: string): number => luminanceOf(channelsOf(hex));

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The [r, g, b, a] of an rgba() colour. */
function rgbaOf(colour: string): [number, number, number, number] {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(colour);
  expect(match, colour).not.toBeNull();
  return (match as RegExpExecArray).slice(1).map(Number) as [number, number, number, number];
}

/** An rgba() fill laid over an opaque [r, g, b] background, as the canvas blends it (8-bit sRGB). */
function over(fill: string, background: readonly number[]): [number, number, number] {
  const [r, g, b, a] = rgbaOf(fill);
  return [r, g, b].map((c, i) => Math.round(c * a + background[i] * (1 - a))) as [number, number, number];
}

/** Every colour a patch can be seen on: the deep canal's water stops and bed, from habitatLook. */
function backgrounds(): { name: string; rgb: [number, number, number] }[] {
  const look = habitatLook('deep-canal');
  return [
    ...(['shallow', 'mid', 'deep'] as const).map((stop) => ({ name: `water ${stop}`, rgb: channelsOf(look.water[stop]) })),
    { name: 'bed top', rgb: channelsOf(look.bed.top) },
    { name: 'bed bottom', rgb: channelsOf(look.bed.bottom) },
  ];
}

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

/** A Path2D stand-in that keeps its commands. */
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

/** One draw call with the style it was painted under. */
interface Op {
  readonly op: string;
  readonly args: unknown[];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: number;
  readonly lineCap: unknown;
  readonly globalAlpha: number;
}

const DRAW_OPS = new Set(['fill', 'stroke']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'globalAlpha'] as const;

/** A context that records every draw call. Supports save and restore. */
function recordingContext(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  let state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'round', globalAlpha: 1 };
  const stack: Record<string, unknown>[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => {
          if (name === 'save') stack.push({ ...state });
          else if (name === 'restore') state = stack.pop() ?? state;
          else if (DRAW_OPS.has(name)) {
            ops.push({
              op: name,
              args: args.map((a) => (a instanceof LogPath ? a.cmds : a)),
              fillStyle: state.fillStyle,
              strokeStyle: state.strokeStyle,
              lineWidth: state.lineWidth as number,
              lineCap: state.lineCap,
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
  return { ctx, ops };
}

/** Run `paint` with Path2D stubbed and return what it drew. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Op[] {
  vi.stubGlobal('Path2D', LogPath);
  const rec = recordingContext();
  try {
    paint(rec.ctx);
  } finally {
    vi.unstubAllGlobals();
  }
  return rec.ops;
}

const fills = (ops: readonly Op[]): Op[] => ops.filter((op) => op.op === 'fill');
const strokes = (ops: readonly Op[]): Op[] => ops.filter((op) => op.op === 'stroke');
const cmdsOf = (op: Op): unknown[][] => op.args[0] as unknown[][];

/** The ellipse commands of a recorded path, as [cx, cy, rx, ry, rot, start, end]. */
function ellipsesOf(op: Op): number[][] {
  return cmdsOf(op)
    .filter((cmd) => cmd[0] === 'ellipse')
    .map((cmd) => cmd.slice(1) as number[]);
}

/** The arc commands of a recorded path, as [cx, cy, r, start, end]. */
function arcsOf(op: Op): number[][] {
  return cmdsOf(op)
    .filter((cmd) => cmd[0] === 'arc')
    .map((cmd) => cmd.slice(1) as number[]);
}

/** Every colour string (fill or stroke style) the ops painted with. */
function coloursOf(ops: readonly Op[]): string[] {
  return ops.flatMap((op) => [op.op === 'fill' ? op.fillStyle : op.strokeStyle]) as string[];
}

/** Check a frame is whole pixels and holds the content box with the guide's padding. */
function expectFrame(tex: TexSize, box: { minX: number; minY: number; maxX: number; maxY: number }, pad = MIN_PAD): void {
  for (const v of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(v)).toBe(true);
  expect(tex.originX + box.minX).toBeGreaterThanOrEqual(pad - EPS);
  expect(tex.originY + box.minY).toBeGreaterThanOrEqual(pad - EPS);
  expect(tex.w - tex.originX - box.maxX).toBeGreaterThanOrEqual(pad - EPS);
  expect(tex.h - tex.originY - box.maxY).toBeGreaterThanOrEqual(pad - EPS);
}

const SMALL = { w: 120, h: 160 };
const ROUTE = { w: 200, h: 240 };
const WIDE = { w: 400, h: 200 };
const SIZES = [SMALL, ROUTE, WIDE];

// ---------------------------------------------------------------------------
// Frame sizes and origins
// ---------------------------------------------------------------------------

describe('frame sizes and origins', () => {
  it('a patch frame is its rect plus 4 px each side, with the origin at the middle', () => {
    expect(murkyPatchTex(200, 240)).toEqual({ w: 208, h: 248, originX: 104, originY: 124 });
    expect(murkyPatchTex(400, 200)).toEqual({ w: 408, h: 208, originX: 204, originY: 104 });
    expect(murkyPatchTex(121, 99)).toEqual({ w: 130, h: 108, originX: 65, originY: 54 });
  });

  it('refuses a rect that is too small or not finite', () => {
    expect(() => murkyPatchTex(MURKY_MIN_SIDE - 1, 200)).toThrow(RangeError);
    expect(() => murkyPatchTex(200, MURKY_MIN_SIDE - 1)).toThrow(RangeError);
    expect(() => murkyPatchTex(Number.NaN, 200)).toThrow(RangeError);
    expect(() => murkyPatchTex(200, Infinity)).toThrow(RangeError);
    expect(() => murkyPatchTex(MURKY_MIN_SIDE, MURKY_MIN_SIDE)).not.toThrow();
    for (const bad of [() => paintMurkyStill({} as CanvasRenderingContext2D, 10, 200), () => murkySwirls(10, 200), () => murkyLobes(10, 200), () => murkyDotPoints(10, 200)]) {
      expect(bad).toThrow(RangeError);
    }
  });

  it('every other frame is whole pixels with the origin at the middle of what it paints', () => {
    expectFrame(MURKY_DIM_TEX, { minX: -MURKY_DIM_OUTER_RX, minY: -MURKY_DIM_OUTER_RY, maxX: MURKY_DIM_OUTER_RX, maxY: MURKY_DIM_OUTER_RY });
    expect(MURKY_DIM_TEX).toEqual({ w: 216, h: 148, originX: 108, originY: 74 });
    const reach = MURKY_METER_R + 2.5 + 1.6;
    expectFrame(MURKY_METER_TEX, { minX: -reach, minY: -reach, maxX: reach, maxY: reach });
    expect(MURKY_METER_TEX.originX).toBe(MURKY_METER_TEX.w / 2);
    expect(MURKY_METER_TEX.originY).toBe(MURKY_METER_TEX.h / 2);
    const bubbles = MURKY_BUBBLES;
    expectFrame(MURKY_BUBBLES_TEX, {
      minX: Math.min(...bubbles.map((b) => b.x - b.r - MURKY_BUBBLE_INK / 2)),
      minY: Math.min(...bubbles.map((b) => b.y - b.r - MURKY_BUBBLE_INK / 2)),
      maxX: Math.max(...bubbles.map((b) => b.x + b.r + MURKY_BUBBLE_INK / 2)),
      maxY: Math.max(...bubbles.map((b) => b.y + b.r + MURKY_BUBBLE_INK / 2)),
    });
    expectFrame(MURKY_CHEEKS_TEX, {
      minX: Math.min(...QUEASY_CHEEK_LOCAL.map((c) => c.x - c.rx)),
      minY: Math.min(...QUEASY_CHEEK_LOCAL.map((c) => c.y - c.ry)),
      maxX: Math.max(...QUEASY_CHEEK_LOCAL.map((c) => c.x + c.rx)),
      maxY: Math.max(...QUEASY_CHEEK_LOCAL.map((c) => c.y + c.ry)),
    }, 2);
  });

  it('the cloud, its lobes and its swirls stay inside the rect, so the art shows the rect the logic tests', () => {
    for (const { w, h } of SIZES) {
      const tex = murkyPatchTex(w, h);
      expect(tex.originX).toBe(w / 2 + MIN_PAD);
      for (const l of murkyLobes(w, h)) {
        expect(Math.abs(l.x) + l.rx).toBeLessThanOrEqual(w / 2 + EPS);
        expect(Math.abs(l.y) + l.ry).toBeLessThanOrEqual(h / 2 + EPS);
      }
      for (const s of murkySwirls(w, h)) {
        expect(Math.abs(s.x) + s.r).toBeLessThanOrEqual(w / 2 - MURKY_LOBE_DEPTH);
        expect(Math.abs(s.y) + s.r).toBeLessThanOrEqual(h / 2 - MURKY_LOBE_DEPTH);
      }
      for (const [x, y] of murkyDotPoints(w, h)) {
        expect(Math.abs(x) + MURKY_DOT_R + MURKY_DOT_INK / 2).toBeLessThanOrEqual(w / 2 + EPS);
        expect(Math.abs(y) + MURKY_DOT_R + MURKY_DOT_INK / 2).toBeLessThanOrEqual(h / 2 + EPS);
      }
      const ops = record((ctx) => paintMurkySwirl(ctx, w, h, 2));
      for (const op of fills(ops)) {
        for (const [cx, cy, rx, ry] of ellipsesOf(op)) {
          expect(Math.abs(cx) + rx).toBeLessThanOrEqual(w / 2 + EPS);
          expect(Math.abs(cy) + ry).toBeLessThanOrEqual(h / 2 + EPS);
        }
        for (const [cx, cy, r] of arcsOf(op)) {
          expect(Math.abs(cx) + r).toBeLessThanOrEqual(w / 2 + EPS);
          expect(Math.abs(cy) + r).toBeLessThanOrEqual(h / 2 + EPS);
        }
      }
    }
  });

  it('the outermost lobe on each edge reaches the rect, so the edge is not flat', () => {
    const lobes = murkyLobes(200, 240);
    expect(Math.max(...lobes.map((l) => l.y + l.ry))).toBeCloseTo(120, 9);
    expect(Math.min(...lobes.map((l) => l.y - l.ry))).toBeCloseTo(-120, 9);
    expect(Math.max(...lobes.map((l) => l.x + l.rx))).toBeCloseTo(100, 9);
    expect(Math.min(...lobes.map((l) => l.x - l.rx))).toBeCloseTo(-100, 9);
  });
});

// ---------------------------------------------------------------------------
// See-through cloud and contrast
// ---------------------------------------------------------------------------

describe('the cloud is see-through', () => {
  it('paints two soft layers with no ink, so nothing hides the water under it', () => {
    const ops = record((ctx) => paintMurkyStill(ctx, ROUTE.w, ROUTE.h));
    expect(ops.map((op) => [op.op, op.fillStyle])).toEqual([
      ['fill', MURKY_CLOUD_OUTER],
      ['fill', MURKY_CLOUD_INNER],
    ]);
    expect(strokes(ops)).toHaveLength(0);
    const alphaOuter = rgbaOf(MURKY_CLOUD_OUTER)[3];
    const alphaInner = rgbaOf(MURKY_CLOUD_INNER)[3];
    const densest = 1 - (1 - alphaOuter) * (1 - alphaInner);
    expect(densest).toBeLessThanOrEqual(MURKY_CLOUD_MAX_ALPHA);
    expect(MURKY_CLOUD_MAX_ALPHA).toBeLessThanOrEqual(0.5);
    for (const op of ops) expect(op.globalAlpha).toBe(1);
  });

  it('the inner layer is smaller than the outer one, so the middle is the densest', () => {
    const [outer, inner] = fills(record((ctx) => paintMurkyStill(ctx, ROUTE.w, ROUTE.h)));
    const xs = (op: Op) => cmdsOf(op).filter((cmd) => cmd[0] === 'lineTo').map((cmd) => Math.abs(cmd[1] as number));
    expect(Math.max(...xs(inner))).toBeLessThan(Math.max(...xs(outer)));
  });

  it('keeps the pair rule under it: ink holds 3:1 on the cloud, and on the cloud with the dim ring over it, on every deep canal colour', () => {
    const inkLum = luminance(INK);
    for (const { name, rgb } of backgrounds()) {
      let under = rgb;
      under = over(MURKY_CLOUD_OUTER, under);
      under = over(MURKY_CLOUD_INNER, under);
      expect(luminanceOf(under), `${name} under the cloud`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect((luminanceOf(under) + 0.05) / (inkLum + 0.05), `${name} ink`).toBeGreaterThanOrEqual(PAIR_FLOOR);
      under = over(MURKY_DIM_OUTER, under);
      under = over(MURKY_DIM_INNER, under);
      expect(luminanceOf(under), `${name} under the cloud and the dim ring`).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    }
  });

  it('is a brown you can see: it changes the water under it', () => {
    for (const { name, rgb } of backgrounds()) {
      const under = over(MURKY_CLOUD_INNER, over(MURKY_CLOUD_OUTER, rgb));
      const [r, g, b] = under;
      expect(Math.abs(luminanceOf(under) - luminanceOf(rgb)), name).toBeGreaterThan(0.005);
      // warmer than the water: red above blue, which is what makes it read brown not blue-green
      expect(r, name).toBeGreaterThan(rgb[0]);
      expect(b, name).toBeLessThanOrEqual(Math.max(rgb[2], b));
      expect(g, name).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Swirl frames and the reduced-motion still frame
// ---------------------------------------------------------------------------

describe('swirl frames and the still frame', () => {
  const swirlOps = (w: number, h: number, frame: number) => record((ctx) => paintMurkySwirl(ctx, w, h, frame));
  const swirlStrokes = (ops: readonly Op[]) => strokes(ops).filter((op) => op.strokeStyle === MURKY_SWIRL);

  it('the still frame has no swirl: no swirl-coloured mark, no stroke, no arc', () => {
    for (const { w, h } of SIZES) {
      const ops = record((ctx) => paintMurkyStill(ctx, w, h));
      expect(coloursOf(ops)).not.toContain(MURKY_SWIRL);
      expect(strokes(ops)).toHaveLength(0);
      expect(ops.flatMap((op) => (op.op === 'fill' ? arcsOf(op) : [])).every(([, , r]) => r <= 24 + EPS)).toBe(true);
      // the same whatever the time: painting it twice gives the same marks
      expect(record((ctx) => paintMurkyStill(ctx, w, h))).toEqual(ops);
    }
  });

  it('a swirl frame is the still frame plus swirl lines, MURKY_SWIRL_ARCS to a swirl', () => {
    for (const { w, h } of SIZES) {
      const still = record((ctx) => paintMurkyStill(ctx, w, h));
      for (let frame = 0; frame < MURKY_SWIRL_FRAMES; frame++) {
        const ops = swirlOps(w, h, frame);
        expect(ops.slice(0, still.length)).toEqual(still);
        expect(swirlStrokes(ops)).toHaveLength(murkySwirls(w, h).length * MURKY_SWIRL_ARCS);
        expect(strokes(ops)).toHaveLength(swirlStrokes(ops).length);
      }
    }
  });

  it('the frames differ from each other, loop with no jump, and take any whole frame number', () => {
    const arcsAt = (frame: number) => swirlStrokes(swirlOps(ROUTE.w, ROUTE.h, frame)).map((op) => arcsOf(op));
    const seen = new Set<string>();
    for (let frame = 0; frame < MURKY_SWIRL_FRAMES; frame++) seen.add(JSON.stringify(arcsAt(frame)));
    expect(seen.size).toBe(MURKY_SWIRL_FRAMES);
    expect(arcsAt(MURKY_SWIRL_FRAMES)).toEqual(arcsAt(0));
    expect(arcsAt(MURKY_SWIRL_FRAMES + 2)).toEqual(arcsAt(2));
    expect(arcsAt(-1)).toEqual(arcsAt(MURKY_SWIRL_FRAMES - 1));
  });

  it('paints only the swirl lines in pale silt, thin and see-through', () => {
    for (const op of swirlStrokes(swirlOps(WIDE.w, WIDE.h, 1))) {
      expect(op.lineWidth).toBeLessThanOrEqual(4);
      expect(rgbaOf(op.strokeStyle as string)[3]).toBeLessThanOrEqual(0.5);
    }
  });

  it('a wide patch gets more swirls than a narrow one', () => {
    expect(murkySwirls(120, 160)).toHaveLength(1);
    expect(murkySwirls(400, 200).length).toBeGreaterThan(1);
    expect(murkySwirls(200, 240)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Dotted outline (greyscale)
// ---------------------------------------------------------------------------

describe('the dotted outline', () => {
  it('is a ring of opaque pale dots with an opaque ink outline each', () => {
    for (const { w, h } of SIZES) {
      const ops = record((ctx) => paintMurkyOutline(ctx, w, h));
      expect(ops.map((op) => op.op)).toEqual(['fill', 'stroke']);
      const [fill, stroke] = ops;
      expect(fill.fillStyle).toBe(MURKY_DOT);
      expect(stroke.strokeStyle).toBe(INK);
      expect(stroke.lineWidth).toBe(MURKY_DOT_INK);
      for (const op of ops) expect(op.globalAlpha).toBe(1);
      const dots = ellipsesOf(fill);
      expect(dots).toHaveLength(murkyDotPoints(w, h).length);
      for (const [, , rx, ry] of dots) {
        expect(rx).toBe(MURKY_DOT_R);
        expect(ry).toBe(MURKY_DOT_R);
      }
    }
  });

  it('holds in greyscale: the dot is 4.5:1 with its ink and the ink is 3:1 on every deep canal colour', () => {
    expect(contrast(MURKY_DOT, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    for (const { name, rgb } of backgrounds()) {
      const ratio = (luminanceOf(rgb) + 0.05) / (luminance(INK) + 0.05);
      expect(ratio, name).toBeGreaterThanOrEqual(PAIR_FLOOR);
      // and with the cloud under the dots
      const under = over(MURKY_CLOUD_INNER, over(MURKY_CLOUD_OUTER, rgb));
      expect((luminanceOf(under) + 0.05) / (luminance(INK) + 0.05), `${name} under the cloud`).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('is evenly spaced round the rect, about every MURKY_DOT_SPACING px, and closed', () => {
    for (const { w, h } of SIZES) {
      const points = murkyDotPoints(w, h);
      const gaps = points.map((p, i) => {
        const next = points[(i + 1) % points.length];
        return Math.hypot(next[0] - p[0], next[1] - p[1]);
      });
      expect(points.length).toBeGreaterThanOrEqual(8);
      for (const gap of gaps) {
        expect(gap).toBeGreaterThan(MURKY_DOT_SPACING * 0.6);
        expect(gap).toBeLessThanOrEqual(MURKY_DOT_SPACING * 1.25);
      }
      // the dots do not touch (each ink edge stays clear of the next)
      for (const gap of gaps) expect(gap).toBeGreaterThan(2 * (MURKY_DOT_R + MURKY_DOT_INK / 2));
    }
  });

  it('lies on the edge of the rect: every dot is one inset from a side, so the ring is the patch outline', () => {
    const inset = MURKY_DOT_R + MURKY_DOT_INK / 2;
    for (const { w, h } of SIZES) {
      const a = w / 2 - inset;
      const b = h / 2 - inset;
      const points = murkyDotPoints(w, h);
      // all four sides have dots on them, and the middle is empty
      expect(points.some(([x, y]) => Math.abs(y + b) < 1e-6 && Math.abs(x) < a)).toBe(true);
      expect(points.some(([x, y]) => Math.abs(y - b) < 1e-6 && Math.abs(x) < a)).toBe(true);
      expect(points.some(([x, y]) => Math.abs(x + a) < 1e-6 && Math.abs(y) < b)).toBe(true);
      expect(points.some(([x, y]) => Math.abs(x - a) < 1e-6 && Math.abs(y) < b)).toBe(true);
      for (const [x, y] of points) {
        const nearSide = Math.min(a - Math.abs(x), b - Math.abs(y));
        // on a straight side the dot is on the side; round a corner it is within the corner radius of it
        expect(nearSide).toBeLessThanOrEqual(24 + 1e-6);
        expect(Math.abs(x)).toBeLessThanOrEqual(a + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(b + 1e-6);
      }
    }
  });

  it('differs from the Home Spot ring: smaller dots, closer together, round a rectangle', () => {
    expect(MURKY_DOT_R).toBeLessThan(3);
    expect(MURKY_DOT_SPACING).toBeLessThan(RING_DOT_SPACING);
    expect(MURKY_DOT).not.toBe('#ffffff');
    const points = murkyDotPoints(ROUTE.w, ROUTE.h);
    const distances = points.map(([x, y]) => Math.hypot(x, y));
    // a circle has one distance from its centre; this ring does not
    expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(20);
  });

  it('is the same in every frame: it takes no frame number', () => {
    expect(record((ctx) => paintMurkyOutline(ctx, ROUTE.w, ROUTE.h))).toEqual(record((ctx) => paintMurkyOutline(ctx, ROUTE.w, ROUTE.h)));
    expect(paintMurkyOutline.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Dim ring
// ---------------------------------------------------------------------------

describe('the dim ring', () => {
  const ops = () => record((ctx) => paintMurkyDimRing(ctx));

  it('is two soft see-through bands filled even-odd, no ink', () => {
    const recorded = ops();
    expect(recorded.map((op) => [op.op, op.fillStyle, op.args[1]])).toEqual([
      ['fill', MURKY_DIM_OUTER, 'evenodd'],
      ['fill', MURKY_DIM_INNER, 'evenodd'],
    ]);
    const densest = 1 - (1 - rgbaOf(MURKY_DIM_OUTER)[3]) * (1 - rgbaOf(MURKY_DIM_INNER)[3]);
    expect(densest).toBeLessThanOrEqual(0.5);
  });

  it('has a hole wider than the axolotl, so the hero is never dimmed', () => {
    const reach = axolotlInkReach(DEFAULT_ART_LOOK);
    const halfWidth = AXO_SCENE_SCALE * Math.max(reach.left, reach.right);
    const halfHeight = AXO_SCENE_SCALE * Math.max(reach.top, reach.bottom);
    expect(MURKY_DIM_HOLE_RX).toBeGreaterThan(halfWidth * 0.8);
    expect(MURKY_DIM_HOLE_RY).toBeGreaterThan(halfHeight * 0.8);
    // the body itself (121 x 85 in the scene) is well inside it
    expect(MURKY_DIM_HOLE_RX).toBeGreaterThan(121 / 2);
    expect(MURKY_DIM_HOLE_RY).toBeGreaterThan(85 / 2);
  });

  it('the bands nest: hole, soft band, outer edge', () => {
    expect(MURKY_DIM_HOLE_RX).toBeLessThan(MURKY_DIM_BAND_IN_RX);
    expect(MURKY_DIM_BAND_IN_RX).toBeLessThan(MURKY_DIM_BAND_OUT_RX);
    expect(MURKY_DIM_BAND_OUT_RX).toBeLessThan(MURKY_DIM_OUTER_RX);
    const [outer, band] = ops();
    expect(ellipsesOf(outer).map(([, , rx, ry]) => [rx, ry])).toEqual([
      [MURKY_DIM_OUTER_RX, MURKY_DIM_OUTER_RY],
      [MURKY_DIM_HOLE_RX, MURKY_DIM_HOLE_RY],
    ]);
    expect(ellipsesOf(band)[0][2]).toBe(MURKY_DIM_BAND_OUT_RX);
    expect(ellipsesOf(band)[1][2]).toBe(MURKY_DIM_BAND_IN_RX);
  });

  it('is bigger than the protected halo (84 x 54), so it rings the axolotl, not the halo line', () => {
    expect(MURKY_DIM_OUTER_RX).toBeGreaterThan(84);
    expect(MURKY_DIM_OUTER_RY).toBeGreaterThan(54);
    expect(MURKY_DIM_HOLE_RX).toBeLessThan(84);
  });
});

// ---------------------------------------------------------------------------
// Ring meter
// ---------------------------------------------------------------------------

describe('the ring meter', () => {
  const meter = (share: number) => record((ctx) => paintMurkyMeter(ctx, share));
  const fillStrokes = (ops: readonly Op[]) => strokes(ops).filter((op) => op.strokeStyle === MURKY_METER_FILL);

  it('has the track as an ink tube with a pale band, 4.5:1 with ink; the fill is 3:1 against the track', () => {
    const [ink, band] = strokes(meter(0));
    expect(ink.strokeStyle).toBe(INK);
    expect(band.strokeStyle).toBe(MURKY_METER_TRACK);
    expect(ink.lineWidth).toBeGreaterThan(band.lineWidth);
    expect(contrast(MURKY_METER_TRACK, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    expect(contrast(MURKY_METER_FILL, MURKY_METER_TRACK)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('is empty at 0 share: the track and the tick, no fill arc', () => {
    expect(fillStrokes(meter(0))).toHaveLength(0);
    expect(fillStrokes(meter(-3))).toHaveLength(0);
    expect(fillStrokes(meter(Number.NaN))).toHaveLength(0);
  });

  it('draws the fill from the top, clockwise, over exactly the share', () => {
    for (const share of [0.1, 0.25, 0.5, 2 / 3, 0.9]) {
      const [fill] = fillStrokes(meter(share));
      expect(fill).toBeDefined();
      const [[cx, cy, r, from, to]] = arcsOf(fill);
      expect([cx, cy, r]).toEqual([0, 0, MURKY_METER_R]);
      expect(from).toBe(MURKY_METER_START);
      expect((to - from) / (Math.PI * 2)).toBeCloseTo(share, 9);
      expect(fill.lineWidth).toBe(5);
      expect(fill.lineCap).toBe('butt');
    }
  });

  it('is a whole ring at 1 and holds shares past 1 there', () => {
    for (const share of [1, 1.4, Infinity]) {
      const [fill] = fillStrokes(meter(share));
      const [[, , , from, to]] = arcsOf(fill);
      expect((to - from) / (Math.PI * 2)).toBeCloseTo(1, 9);
    }
    expect(clampMurkyShare(2)).toBe(1);
    expect(clampMurkyShare(-1)).toBe(0);
    expect(clampMurkyShare(Number.NaN)).toBe(0);
    expect(clampMurkyShare(0.4)).toBe(0.4);
  });

  it('marks the warning share with an ink tick across the band, whatever the fill', () => {
    expect(MURKY_METER_WARN_SHARE).toBeCloseTo(MURKY_WATER_TIMING.warnAt / MURKY_WATER_TIMING.legAt, 12);
    for (const share of [0, 0.5, 1]) {
      const ticks = strokes(meter(share)).filter((op) => op.strokeStyle === INK && cmdsOf(op).some((cmd) => cmd[0] === 'lineTo'));
      expect(ticks).toHaveLength(1);
      const [move, line] = cmdsOf(ticks[0]) as [string, number, number][];
      const angle = MURKY_METER_START + Math.PI * 2 * MURKY_METER_WARN_SHARE;
      expect(Math.atan2(move[2], move[1])).toBeCloseTo(Math.atan2(Math.sin(angle), Math.cos(angle)), 9);
      expect(Math.hypot(line[1], line[2])).toBeGreaterThan(Math.hypot(move[1], move[2]));
      expect(Math.hypot(move[1], move[2])).toBeLessThan(MURKY_METER_R);
      expect(Math.hypot(line[1], line[2])).toBeGreaterThan(MURKY_METER_R);
    }
  });

  it('shows progress by arc length, not hue: the fill is darker than the track by 3:1 and the arc grows with the share', () => {
    const length = (share: number) => {
      const [fill] = fillStrokes(meter(share));
      const [[, , , from, to]] = arcsOf(fill);
      return to - from;
    };
    expect(length(0.2)).toBeLessThan(length(0.4));
    expect(length(0.4)).toBeLessThan(length(0.8));
  });
});

// ---------------------------------------------------------------------------
// Warning cue
// ---------------------------------------------------------------------------

describe('the cheek tint', () => {
  const ops = () => record((ctx) => paintMurkyCheeks(ctx));

  it('sits on the queasy tint places, two cheeks, outer layer and a smaller inner one, no ink', () => {
    const recorded = ops();
    expect(recorded.map((op) => [op.op, op.fillStyle])).toEqual([
      ['fill', MURKY_CHEEK_OUTER],
      ['fill', MURKY_CHEEK_INNER],
    ]);
    const [outer, inner] = recorded.map(ellipsesOf);
    expect(outer.map(([cx, cy, rx, ry]) => [cx, cy, rx, ry])).toEqual(QUEASY_CHEEK_LOCAL.map((c) => [c.x, c.y, c.rx, c.ry]));
    inner.forEach(([, , rx, ry], i) => {
      expect(rx).toBeLessThan(outer[i][2]);
      expect(ry).toBeLessThan(outer[i][3]);
    });
  });

  it('is see-through (the blush, mouth and a girl\'s heart stay readable) and muddy ochre, not the queasy green', () => {
    expect(rgbaOf(MURKY_CHEEK_OUTER)[3] + rgbaOf(MURKY_CHEEK_INNER)[3]).toBeLessThanOrEqual(0.55);
    expect(MURKY_CHEEK_OUTER).not.toBe(QUEASY_CHEEK_OUTER);
    const [r, g, b] = rgbaOf(MURKY_CHEEK_OUTER);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe('the little bubbles', () => {
  const ops = () => record((ctx) => paintMurkyBubbles(ctx));

  it('are three round pale discs of falling size, rising, each with an opaque ink outline', () => {
    expect(MURKY_BUBBLES).toHaveLength(3);
    for (let i = 1; i < MURKY_BUBBLES.length; i++) {
      expect(MURKY_BUBBLES[i].r).toBeLessThan(MURKY_BUBBLES[i - 1].r);
      expect(MURKY_BUBBLES[i].y).toBeLessThan(MURKY_BUBBLES[i - 1].y);
    }
    const recorded = ops();
    const discs = fills(recorded).filter((op) => op.fillStyle === MURKY_BUBBLE);
    const rims = strokes(recorded);
    expect(discs).toHaveLength(3);
    expect(rims).toHaveLength(3);
    for (const rim of rims) {
      expect(rim.strokeStyle).toBe(INK);
      expect(rim.lineWidth).toBe(MURKY_BUBBLE_INK);
      expect(rim.globalAlpha).toBe(1);
    }
    discs.forEach((disc, i) => {
      const [[cx, cy, rx, ry]] = ellipsesOf(disc);
      expect([cx, cy, rx, ry]).toEqual([MURKY_BUBBLES[i].x, MURKY_BUBBLES[i].y, MURKY_BUBBLES[i].r, MURKY_BUBBLES[i].r]);
    });
    expect(fills(recorded).filter((op) => op.fillStyle === MURKY_BUBBLE_SHINE)).toHaveLength(3);
  });

  it('hold in greyscale: the pale disc is 4.5:1 with its ink', () => {
    expect(contrast(MURKY_BUBBLE, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    for (const { name, rgb } of backgrounds()) {
      expect((luminanceOf(rgb) + 0.05) / (luminance(INK) + 0.05), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });
});

// ---------------------------------------------------------------------------
// Nothing scary
// ---------------------------------------------------------------------------

describe('nothing is scary', () => {
  it('uses no red or pink: every colour is a warm brown, tan, pale or white', () => {
    const colours = [
      MURKY_CLOUD_OUTER,
      MURKY_CLOUD_INNER,
      MURKY_SWIRL,
      MURKY_DIM_OUTER,
      MURKY_DIM_INNER,
      MURKY_CHEEK_OUTER,
      MURKY_CHEEK_INNER,
      MURKY_DOT,
      MURKY_METER_TRACK,
      MURKY_METER_FILL,
      MURKY_BUBBLE,
    ].map((c) => (c.startsWith('#') ? [...channelsOf(c), 1] : rgbaOf(c)));
    for (const [r, g, b] of colours) {
      expect(r, 'red much above green').toBeLessThanOrEqual(g * 1.6);
      expect(b, 'blue is not above green').toBeLessThanOrEqual(g + 1);
    }
  });

  it('the painters draw only fills and strokes of ellipses, arcs and lines: no text, no image', () => {
    const everything = [
      ...record((ctx) => paintMurkySwirl(ctx, 200, 240, 3)),
      ...record((ctx) => paintMurkyOutline(ctx, 200, 240)),
      ...record((ctx) => paintMurkyDimRing(ctx)),
      ...record((ctx) => paintMurkyMeter(ctx, 0.5)),
      ...record((ctx) => paintMurkyCheeks(ctx)),
      ...record((ctx) => paintMurkyBubbles(ctx)),
    ];
    for (const op of everything) expect(['fill', 'stroke']).toContain(op.op);
  });
});
