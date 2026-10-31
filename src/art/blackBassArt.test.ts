/**
 * Black bass colours, sizes, anchors, poses, face and greyscale cue (guide 3g, 10), headless.
 * The painter runs against a recording context and a stub Path2D (the same approach as
 * predatorArt.test.ts): every fill and stroke is kept with the style, width and alpha it was
 * painted under. The greyscale checks rasterise the recorded ellipses, so they read what was
 * painted, not what the geometry says.
 */
import { describe, expect, it, vi } from 'vitest';
import { BLACK_BASS } from '../logic/tuning';
import {
  BASS_BELLY,
  BASS_BODY,
  BASS_BODY_RX,
  BASS_BODY_RY,
  BASS_EYE_R,
  BASS_FIN,
  BASS_FLASH_BODY,
  BASS_FLASH_FIN,
  BASS_SHINE,
  BASS_STRIPE,
  BLACK_BASS_FRAMES,
  BLACK_BASS_SWIM_FRAMES,
  BLACK_BASS_TEX,
  blackBassColours,
  blackBassGeometry,
  blackBassHasFlash,
  blackBassNoseTip,
  blackBassOuterEllipses,
  paintBlackBass,
  type BassEllipse,
  type BlackBassFrame,
} from './drawBlackBass';
import { EYE, INK, LEGS_FILL, LW, TILAPIA_BODY, TILAPIA_MOUTH, WHITE } from './palette';
import type { TexSize } from './canvasKit';

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
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

/** The hero's belly: no bass fill is lighter (guide 7c hierarchy). */
const HERO_BELLY = '#ffe3ed';
/** Luminance a fill needs for 9:1 against INK (guide 10). */
const MIN_LUMINANCE_9_TO_1 = 0.607;
/** The least padding round a sprite at 1x (guide 11). */
const MIN_PAD = 4;
/** The least a body fill, fin fill or stripe must differ from its neighbour: the greyscale cues (guide 10). */
const FIN_RATIO = 1.1;
const FLASH_RATIO = 1.2;
const STRIPE_RATIO = 3;
const BELLY_RATIO = 1.25;

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
const same = (a: Op, b: Op): boolean => JSON.stringify(a.cmds) === JSON.stringify(b.cmds);

/** Every fill that `blob` paints straight after an ink stroke of 2 x LW on the same path. */
function blobPairs(ops: readonly Op[]): { ink: Op; fill: Op }[] {
  const pairs: { ink: Op; fill: Op }[] = [];
  for (let i = 1; i < ops.length; i++) {
    const prev = ops[i - 1];
    if (isFill(ops[i]) && isStroke(prev) && prev.strokeStyle === INK && Math.abs(prev.lineWidth - 2 * LW) < 1e-9 && same(prev, ops[i])) {
      pairs.push({ ink: prev, fill: ops[i] });
    }
  }
  return pairs;
}

/** The recorded `[cx, cy, rx, ry, rot]` of every ellipse in a path. */
function ellipsesOf(op: Op): number[][] {
  return op.cmds.filter((cmd) => cmd[0] === 'ellipse').map((cmd) => (cmd.slice(1, 6) as number[]));
}

/** The recorded parts of a painted frame. */
function partsOf(frame: BlackBassFrame): { ops: Op[]; blobs: { ink: Op; fill: Op }[]; mouth: Op } {
  const ops = record((ctx) => paintBlackBass(ctx, frame));
  const mouths = ops.filter(
    (op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 && op.cmds.some((cmd) => cmd[0] === 'quadraticCurveTo'),
  );
  expect(mouths).toHaveLength(1);
  return { ops, blobs: blobPairs(ops), mouth: mouths[0] };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Whether (x, y) is inside an ellipse, grown by `grow` px (negative shrinks). */
function inside(e: BassEllipse | readonly number[], x: number, y: number, grow = 0): boolean {
  const [cx, cy, rx, ry, rot] = Array.isArray(e) ? (e as number[]) : [(e as BassEllipse).cx, (e as BassEllipse).cy, (e as BassEllipse).rx, (e as BassEllipse).ry, (e as BassEllipse).rot];
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(rot) + dy * Math.sin(rot);
  const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
  return (u / (rx + grow)) ** 2 + (v / (ry + grow)) ** 2 <= 1;
}

/** Whether (x, y) is inside the merged body and head of a frame, shrunk by `margin` px. */
function insideBody(frame: BlackBassFrame, x: number, y: number, margin: number): boolean {
  const g = blackBassGeometry(frame);
  return inside(g.body, x, y, -margin) || inside(g.head, x, y, -margin);
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounds of a recorded path: ellipses exact, curves by their control points. */
function tightBounds(cmds: readonly unknown[][]): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (x: number, y: number, hx = 0, hy = hx): void => {
    box.minX = Math.min(box.minX, x - hx);
    box.minY = Math.min(box.minY, y - hy);
    box.maxX = Math.max(box.maxX, x + hx);
    box.maxY = Math.max(box.maxY, y + hy);
  };
  for (const [name, ...args] of cmds) {
    const nums = args as number[];
    if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = nums;
      grow(cx, cy, Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot)), Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot)));
    } else for (let i = 0; i + 1 < nums.length; i += 2) grow(nums[i], nums[i + 1]);
  }
  return box;
}

/** Every op sits inside the frame with at least 4 px of padding. */
function expectPadded(ops: readonly Op[], tex: TexSize): void {
  const frame: Box = { minX: -tex.originX, minY: -tex.originY, maxX: tex.w - tex.originX, maxY: tex.h - tex.originY };
  for (const op of ops) {
    const b = tightBounds(op.cmds);
    const half = isStroke(op) ? op.lineWidth / 2 : 0;
    expect(b.minX - half - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(b.minY - half - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - (b.maxX + half)).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - (b.maxY + half)).toBeGreaterThanOrEqual(MIN_PAD);
  }
}

// ---------------------------------------------------------------------------
// Greyscale: rasterise what was painted
// ---------------------------------------------------------------------------

/** What a frame looks like with the hue taken out, read from its recorded painting. */
interface Grey {
  /** Silhouette (ink and fill) height and width, px. */
  readonly height: number;
  readonly width: number;
  /** Silhouette area over its bounding box. */
  readonly solidity: number;
  /** Silhouette area, px squared. */
  readonly area: number;
  /** Mean luminance of the fills that show (ink excluded). */
  readonly meanFill: number;
}

/**
 * Rasterise the painted ellipses at 1 px: each ink blob grows its ellipses by LW in INK, each
 * hex fill covers its ellipses in its own luminance, back to front. Alpha fills and the gill,
 * smile and pectoral lines are inside the silhouette, so they are left out.
 */
function greyOf(frame: BlackBassFrame): Grey {
  const { ops, blobs } = partsOf(frame);
  const W = 160;
  const H = 120;
  const ox = 90;
  const oy = 60;
  const lum: (number | null)[] = new Array(W * H).fill(null);
  const isInk: boolean[] = new Array(W * H).fill(false);
  const paintOp = (ellipses: number[][], grow: number, value: number | null, ink: boolean): void => {
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x = px - ox + 0.5;
        const y = py - oy + 0.5;
        if (ellipses.some((e) => inside(e, x, y, grow))) {
          lum[py * W + px] = value;
          isInk[py * W + px] = ink;
        }
      }
    }
  };
  for (const op of ops) {
    const ellipses = ellipsesOf(op);
    if (ellipses.length === 0) continue;
    if (blobs.some((b) => b.ink === op)) paintOp(ellipses, LW, relativeLuminance(INK), true);
    else if (isFill(op) && typeof op.fillStyle === 'string' && op.fillStyle.startsWith('#') && !op.cmds.some((c) => c[0] === 'arc')) {
      // the eye bead is a fill too; it is dark and tiny, and counts as the fill it is
      paintOp(ellipses, 0, relativeLuminance(op.fillStyle), false);
    }
  }
  const rows: number[] = [];
  const cols: number[] = [];
  let area = 0;
  let sum = 0;
  let fills = 0;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const v = lum[py * W + px];
      if (v === null) continue;
      area++;
      rows.push(py);
      cols.push(px);
      if (!isInk[py * W + px]) {
        sum += v;
        fills++;
      }
    }
  }
  const height = Math.max(...rows) - Math.min(...rows) + 1;
  const width = Math.max(...cols) - Math.min(...cols) + 1;
  return { height, width, solidity: area / (height * width), area, meanFill: sum / fills };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('black bass colours (guide 3g, 10)', () => {
  it('uses the colours the guide records', () => {
    expect([BASS_BODY, BASS_FIN, BASS_BELLY, BASS_STRIPE, BASS_FLASH_BODY, BASS_FLASH_FIN, BASS_SHINE]).toEqual([
      '#b9d97a',
      '#cfe69a',
      '#e0efb4',
      '#4f7a3c',
      '#d6eba6',
      '#dcefb0',
      'rgba(255,255,255,0.55)',
    ]);
  });

  it('prints the contrast ratios the guide prints, to 2 decimals', () => {
    const rows: readonly (readonly [string, string, number])[] = [
      [BASS_BODY, INK, 9.09],
      [BASS_FIN, INK, 10.58],
      [BASS_BELLY, INK, 11.77],
      [BASS_FLASH_BODY, INK, 11.17],
      [BASS_FLASH_FIN, INK, 11.66],
      [BASS_FLASH_FIN, BASS_FIN, 1.1],
      [BASS_BODY, BASS_STRIPE, 3.17],
      [BASS_FLASH_BODY, BASS_BODY, 1.23],
      [BASS_FIN, BASS_BODY, 1.16],
      [BASS_BELLY, BASS_BODY, 1.29],
    ];
    for (const [a, b, printed] of rows) expect(contrastRatio(a, b).toFixed(2)).toBe(printed.toFixed(2));
    expect(relativeLuminance(BASS_BODY).toFixed(4)).toBe('0.6135');
    expect(relativeLuminance(BASS_STRIPE).toFixed(4)).toBe('0.1591');
  });

  it('every fill that reaches the outer edge is 9:1 or better against INK, so it passes on any background by the pair method', () => {
    for (const fill of [BASS_BODY, BASS_FIN, BASS_FLASH_BODY, BASS_FLASH_FIN]) {
      expect(relativeLuminance(fill)).toBeGreaterThanOrEqual(MIN_LUMINANCE_9_TO_1);
      expect(contrastRatio(fill, INK)).toBeGreaterThanOrEqual(9);
      // the worst case on any background is the square root of the pair: 3:1 or better
      expect(Math.sqrt(contrastRatio(fill, INK))).toBeGreaterThanOrEqual(3);
    }
  });

  it('no fill is lighter than the hero belly, and the belly and flash are lighter than the body', () => {
    for (const fill of [BASS_BODY, BASS_FIN, BASS_BELLY, BASS_FLASH_BODY, BASS_FLASH_FIN]) {
      expect(relativeLuminance(fill)).toBeLessThan(relativeLuminance(HERO_BELLY));
    }
    expect(contrastRatio(BASS_BELLY, BASS_BODY)).toBeGreaterThanOrEqual(BELLY_RATIO);
    expect(contrastRatio(BASS_FIN, BASS_BODY)).toBeGreaterThanOrEqual(FIN_RATIO);
    expect(relativeLuminance(BASS_FIN)).toBeGreaterThan(relativeLuminance(BASS_BODY));
    expect(contrastRatio(BASS_FLASH_BODY, BASS_BODY)).toBeGreaterThanOrEqual(FLASH_RATIO);
    expect(relativeLuminance(BASS_FLASH_BODY)).toBeGreaterThan(relativeLuminance(BASS_BODY));
    expect(relativeLuminance(BASS_FLASH_FIN)).toBeGreaterThan(relativeLuminance(BASS_FIN));
  });

  it('the dark lateral stripe is 3:1 or better against the body and against the flash body: the greyscale identity', () => {
    expect(contrastRatio(BASS_BODY, BASS_STRIPE)).toBeGreaterThanOrEqual(STRIPE_RATIO);
    expect(contrastRatio(BASS_FLASH_BODY, BASS_STRIPE)).toBeGreaterThanOrEqual(STRIPE_RATIO);
    expect(relativeLuminance(BASS_STRIPE)).toBeLessThan(relativeLuminance(BASS_BODY));
  });

  it('is a green, nowhere near red: not the hero pink, not a mouth red', () => {
    const [r, g, b] = channelsOf(BASS_BODY);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    for (const frame of BLACK_BASS_FRAMES) {
      for (const op of partsOf(frame).ops) {
        for (const colour of [op.fillStyle, op.strokeStyle]) {
          expect(colour).not.toBe(TILAPIA_MOUTH);
          expect(colour).not.toBe(LEGS_FILL);
        }
      }
    }
  });

  it('is told from the tilapia by hue and size, not value: the bodies are within 0.01 luminance', () => {
    expect(Math.abs(relativeLuminance(BASS_BODY) - relativeLuminance(TILAPIA_BODY))).toBeLessThan(0.01);
    const [, tg, tb] = channelsOf(TILAPIA_BODY);
    const [, bg, bb] = channelsOf(BASS_BODY);
    expect(bg - bb).toBeGreaterThan(tg - tb);
  });

  it('the shine is a see-through white, so it never reaches the edge', () => {
    const [r, g, b, a] = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(BASS_SHINE)!.slice(1).map(Number);
    expect([r, g, b]).toEqual([255, 255, 255]);
    expect(a).toBeLessThan(1);
  });
});

describe('black bass anchors and sizes', () => {
  it('lists six frames: three swim frames, the warning, the strike and the reduced motion still', () => {
    expect([...BLACK_BASS_FRAMES]).toEqual(['swim0', 'swim1', 'swim2', 'warn', 'strike', 'still']);
    expect([...BLACK_BASS_SWIM_FRAMES]).toEqual(['swim0', 'swim1', 'swim2']);
  });

  it('shares one integer frame between every frame, with the anchor inside it and the tail behind it', () => {
    expect(Number.isInteger(BLACK_BASS_TEX.w) && Number.isInteger(BLACK_BASS_TEX.h)).toBe(true);
    expect(BLACK_BASS_TEX.originX).toBeGreaterThan(0);
    expect(BLACK_BASS_TEX.originX).toBeLessThan(BLACK_BASS_TEX.w);
    expect(BLACK_BASS_TEX.originY).toBeGreaterThan(0);
    expect(BLACK_BASS_TEX.originY).toBeLessThan(BLACK_BASS_TEX.h);
    expect(BLACK_BASS_TEX.originX).toBeGreaterThan(BLACK_BASS_TEX.w - BLACK_BASS_TEX.originX);
  });

  it.each(BLACK_BASS_FRAMES)('%s: every part fits BLACK_BASS_TEX with its ink and at least 4 px of padding', (frame) => {
    expectPadded(partsOf(frame).ops, BLACK_BASS_TEX);
  });

  it('is a big fish: the frame is longer than twice the body radius plus a tail, and its anchor is the body centre', () => {
    expect(BLACK_BASS_TEX.w).toBeGreaterThan(2 * BLACK_BASS.bodyRadius + 40);
    expect(BLACK_BASS_TEX.w).toBeLessThan(2 * BLACK_BASS.contactRadius + 40);
  });

  it('the body is the size the rules use: its half-length is the body radius, centred on the anchor', () => {
    expect(BASS_BODY_RX).toBe(BLACK_BASS.bodyRadius);
    expect([BASS_BODY_RX, BASS_BODY_RY]).toEqual([28, 17]);
    for (const frame of BLACK_BASS_SWIM_FRAMES) {
      const { cx, cy, rx, ry, rot } = blackBassGeometry(frame).body;
      expect([cx, cy, rx, ry, rot]).toEqual([0, 0, 28, 17, 0]);
    }
  });

  it('the nose, with its ink, stays inside the contact radius and reaches the hit radius: a strike that lands is a snout that reaches', () => {
    for (const frame of BLACK_BASS_FRAMES) {
      const nose = blackBassNoseTip(frame);
      const reach = Math.hypot(nose.x, nose.y);
      expect(reach + LW).toBeLessThanOrEqual(BLACK_BASS.contactRadius);
      expect(reach).toBeGreaterThanOrEqual(BLACK_BASS.hitRadius - 8);
      expect(reach).toBeLessThanOrEqual(BLACK_BASS.hitRadius);
    }
    expect(BLACK_BASS.hitRadius).toBeLessThan(BLACK_BASS.contactRadius);
  });

  it('the body and head, with their ink, fit inside the contact circle', () => {
    for (const frame of BLACK_BASS_FRAMES) {
      const g = blackBassGeometry(frame);
      for (const e of [g.body, g.head]) {
        for (let a = 0; a < 6.3; a += 0.1) {
          const u = e.rx * Math.cos(a);
          const v = e.ry * Math.sin(a);
          const x = e.cx + u * Math.cos(e.rot) - v * Math.sin(e.rot);
          const y = e.cy + u * Math.sin(e.rot) + v * Math.cos(e.rot);
          expect(Math.hypot(x, y) + LW).toBeLessThanOrEqual(BLACK_BASS.contactRadius);
        }
      }
    }
  });
});

describe('black bass poses', () => {
  it('the three swim frames only differ in the tail: the tail fan steps down, the body and the fins stay put', () => {
    const [a, b, c] = BLACK_BASS_SWIM_FRAMES.map(blackBassGeometry);
    expect(a.tailFin.cy).toBeLessThan(b.tailFin.cy);
    expect(b.tailFin.cy).toBeLessThan(c.tailFin.cy);
    for (const g of [a, c]) {
      expect(g.body).toEqual(b.body);
      expect(g.head).toEqual(b.head);
      expect(g.dorsal).toEqual(b.dorsal);
      expect(g.pelvic).toEqual(b.pelvic);
      expect(g.pectoral).toEqual(b.pectoral);
      expect(g.eye).toEqual(b.eye);
      expect(g.mouth).toEqual(b.mouth);
    }
  });

  it('warn: stopped with the head up and the fins flared, so the dorsal fin stands taller and the pelvic fin hangs lower than in any swim frame', () => {
    const warn = blackBassGeometry('warn');
    const swim = blackBassGeometry('swim1');
    expect(blackBassNoseTip('warn').y).toBeLessThan(blackBassNoseTip('swim1').y);
    expect(warn.body.rot).toBeLessThan(0);
    expect(warn.body.rot).toBeGreaterThan(-0.2);
    const top = (g: ReturnType<typeof blackBassGeometry>): number => Math.min(...g.dorsal.map((e) => e.cy - e.ry));
    const bottom = (g: ReturnType<typeof blackBassGeometry>): number => g.pelvic.cy + g.pelvic.ry;
    expect(top(warn)).toBeLessThan(top(swim) - 8);
    expect(bottom(warn)).toBeGreaterThan(bottom(swim) + 8);
    expect(warn.tailFin.ry).toBeGreaterThan(swim.tailFin.ry);
    expect(warn.pectoral.rx).toBeGreaterThan(swim.pectoral.rx);
  });

  it('strike: the fins are tucked flat like a swim frame, the tail is swung wide, and the mouth stays closed', () => {
    const strike = blackBassGeometry('strike');
    const swim = blackBassGeometry('swim1');
    expect(strike.dorsal.map((e) => e.ry)).toEqual(swim.dorsal.map((e) => e.ry));
    expect(strike.pelvic.ry).toBe(swim.pelvic.ry);
    expect(strike.pectoral.rx).toBe(swim.pectoral.rx);
    for (const frame of BLACK_BASS_SWIM_FRAMES) {
      expect(Math.abs(strike.tailFin.cy)).toBeGreaterThan(Math.abs(blackBassGeometry(frame).tailFin.cy) + 6);
    }
    expect(Math.abs(strike.body.rot)).toBeLessThan(0.15);
    expect(partsOf('strike').mouth.cmds.map(([name]) => name)).toEqual(['moveTo', 'quadraticCurveTo']);
  });

  it('still: the fins flared like the warning, everything level, no flash and no tail swing', () => {
    const still = blackBassGeometry('still');
    const warn = blackBassGeometry('warn');
    expect(still.dorsal[0].ry).toBe(warn.dorsal[0].ry);
    expect(still.pelvic.ry).toBe(warn.pelvic.ry);
    expect(still.body.rot).toBe(0);
    expect(still.tailFin.cy).toBeCloseTo(0, 9);
    expect(blackBassHasFlash('still')).toBe(false);
    expect(blackBassHasFlash('warn')).toBe(true);
    for (const frame of ['swim0', 'swim1', 'swim2', 'strike'] as const) expect(blackBassHasFlash(frame)).toBe(false);
  });

  it('every frame is drawn differently', () => {
    const drawn = BLACK_BASS_FRAMES.map((frame) => JSON.stringify(partsOf(frame).ops.map((op) => op.cmds)));
    expect(new Set(drawn).size).toBe(BLACK_BASS_FRAMES.length);
  });
});

describe('black bass warning in greyscale (guide 10): the flared fins change the silhouette and the flash lightens it', () => {
  const grey = Object.fromEntries(BLACK_BASS_FRAMES.map((f) => [f, greyOf(f)])) as Record<BlackBassFrame, Grey>;
  const patrol = BLACK_BASS_SWIM_FRAMES;

  it('the warning silhouette is much taller than any patrol frame, and larger in area', () => {
    for (const frame of patrol) {
      expect(grey.warn.height).toBeGreaterThanOrEqual(grey[frame].height * 1.4);
      expect(grey.warn.area).toBeGreaterThanOrEqual(grey[frame].area * 1.15);
    }
  });

  it('the warning silhouette has more gaps in its bounding box than any patrol frame: the fins are lobes, not a smooth oval', () => {
    for (const frame of patrol) expect(grey.warn.solidity).toBeLessThan(grey[frame].solidity - 0.04);
  });

  it('the warning is lighter on average than any patrol frame, by the flash alone as well', () => {
    for (const frame of patrol) {
      expect((grey.warn.meanFill + 0.05) / (grey[frame].meanFill + 0.05)).toBeGreaterThanOrEqual(1.1);
    }
    expect(blackBassColours('warn')).toEqual({ body: BASS_FLASH_BODY, fin: BASS_FLASH_FIN });
    expect(blackBassColours('swim1')).toEqual({ body: BASS_BODY, fin: BASS_FIN });
  });

  it('the still frame keeps the flared silhouette (taller than patrol) without the flash (as dark as patrol, within 5%)', () => {
    for (const frame of patrol) {
      expect(grey.still.height).toBeGreaterThanOrEqual(grey[frame].height * 1.4);
      expect((grey.still.meanFill + 0.05) / (grey[frame].meanFill + 0.05)).toBeLessThan(1.05);
    }
    expect(grey.still.meanFill).toBeLessThan(grey.warn.meanFill);
  });

  it('the strike is a different shape from the warning: low and streamlined, not tall', () => {
    expect(grey.strike.height).toBeLessThan(grey.warn.height * 0.75);
  });

  it('the patrol frames are a smooth low oval: height within 10% of each other', () => {
    const heights = patrol.map((f) => grey[f].height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(Math.min(...heights) * 0.1);
  });
});

describe('black bass body (round, inked, no points)', () => {
  it.each(BLACK_BASS_FRAMES)('%s: tail fan, stalk, dorsal fin, pelvic fin and body are five inked rounded paths, back to front', (frame) => {
    const { blobs } = partsOf(frame);
    const { body, fin } = blackBassColours(frame);
    expect(blobs).toHaveLength(5);
    expect(blobs.map((b) => b.fill.fillStyle)).toEqual([fin, body, fin, fin, body]);
    expect(blobs.map((b) => ellipsesOf(b.fill).length)).toEqual([1, 1, 2, 1, 2]);
    for (const { ink } of blobs) {
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeCloseTo(2 * LW, 9);
    }
    for (const { fill } of blobs) {
      for (const [cx, cy, rx, ry] of ellipsesOf(fill)) {
        expect([cx, cy, rx, ry].every(Number.isFinite)).toBe(true);
        expect(Math.min(rx, ry)).toBeGreaterThanOrEqual(3.5);
      }
    }
  });

  it.each(BLACK_BASS_FRAMES)('%s: every ellipse that reaches the outer edge is one the painter reports', (frame) => {
    const { blobs } = partsOf(frame);
    const painted = blobs.flatMap((b) => ellipsesOf(b.fill));
    const reported = blackBassOuterEllipses(frame).map((e) => [e.cx, e.cy, e.rx, e.ry, e.rot]);
    expect(painted).toEqual(reported);
  });

  it.each(BLACK_BASS_FRAMES)('%s: the belly and the stripe stay inside the body, and the stripe is 3 px or more from every edge', (frame) => {
    const { ops } = partsOf(frame);
    const g = blackBassGeometry(frame);
    const belly = ops.find((op) => isFill(op) && op.fillStyle === BASS_BELLY)!;
    expect(ellipsesOf(belly)).toEqual([[g.belly.cx, g.belly.cy, g.belly.rx, g.belly.ry, g.belly.rot]]);
    const stripe = ops.find((op) => isFill(op) && op.fillStyle === BASS_STRIPE)!;
    expect(ellipsesOf(stripe)).toEqual([[g.stripe.cx, g.stripe.cy, g.stripe.rx, g.stripe.ry, g.stripe.rot]]);
    for (const [e, margin] of [
      [g.belly, 2],
      [g.stripe, 3],
    ] as const) {
      for (let a = 0; a < 6.3; a += 0.2) {
        const u = e.rx * Math.cos(a);
        const v = e.ry * Math.sin(a);
        const x = e.cx + u * Math.cos(e.rot) - v * Math.sin(e.rot);
        const y = e.cy + u * Math.sin(e.rot) + v * Math.cos(e.rot);
        expect(insideBody(frame, x, y, margin)).toBe(true);
      }
    }
    expect(ops.filter((op) => isFill(op) && op.fillStyle === BASS_SHINE)).toHaveLength(1);
  });
});

describe('black bass face (never scary, never biting)', () => {
  it.each(BLACK_BASS_FRAMES)('%s: one closed ink smile line, inside the body and head, and no mouth interior', (frame) => {
    const { ops, mouth } = partsOf(frame);
    expect(mouth.cmds.map(([name]) => name)).toEqual(['moveTo', 'quadraticCurveTo']);
    const [start, curve] = mouth.cmds as unknown as [string, ...number[]][];
    for (const [x, y] of [
      [start[1], start[2]],
      [curve[3], curve[4]],
    ]) {
      expect(insideBody(frame, x, y, 1)).toBe(true);
    }
    // the only fills are body colours, the belly, the stripe, the shine, the eye and its glints
    const { body, fin } = blackBassColours(frame);
    const fills = new Set(ops.filter(isFill).map((op) => op.fillStyle));
    expect(fills).toEqual(new Set([fin, body, BASS_BELLY, BASS_STRIPE, BASS_SHINE, EYE, WHITE]));
  });

  it.each(BLACK_BASS_FRAMES)('%s: one big bead eye with two glints, above the smile and inside the head', (frame) => {
    const { ops } = partsOf(frame);
    const g = blackBassGeometry(frame);
    const bead = ops.find((op) => isFill(op) && op.fillStyle === EYE)!;
    const [ex, ey, r] = ellipsesOf(bead)[0];
    expect(r).toBe(BASS_EYE_R);
    expect(r).toBeGreaterThan(4);
    expect([ex, ey]).toEqual([g.eye[0], g.eye[1]]);
    expect(inside(g.head, ex, ey, -r)).toBe(true);
    expect(ellipsesOf(ops.find((op) => isFill(op) && op.fillStyle === WHITE)!)).toHaveLength(2);
    // the smile's lowest point is below the eye
    expect(g.mouth[1][1]).toBeGreaterThan(ey);
  });

  it.each(BLACK_BASS_FRAMES)('%s: paints only bass colours, ink, the eye and white glints', (frame) => {
    const { ops } = partsOf(frame);
    const { body, fin } = blackBassColours(frame);
    const styles = new Set(ops.flatMap((op) => (isFill(op) ? [op.fillStyle] : [op.strokeStyle])));
    expect(styles).toEqual(new Set([INK, fin, body, BASS_BELLY, BASS_STRIPE, BASS_SHINE, EYE, WHITE]));
  });

  it.each(BLACK_BASS_FRAMES)('%s: keeps ink and every outer fill at alpha 1 (guide 10, Alpha)', (frame) => {
    const { ops, blobs } = partsOf(frame);
    for (const { ink, fill } of blobs) expect([ink.globalAlpha, fill.globalAlpha]).toEqual([1, 1]);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
  });
});
