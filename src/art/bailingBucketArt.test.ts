/**
 * Bailing bucket looks (issue #107, Area 9; ND-2): the bailing boat, the bucket on its rope, its
 * front wall and rim, the shadow and ripples (the warning) and the splash ring, headless. The
 * painters run against a recording context and a stub Path2D (the same approach as
 * deepCanalHazardArt.test.ts): every fill and stroke is kept with the style, width and alpha it was
 * painted under. The tests check the frames, the anchor points, the ink on every light fill, the
 * contrast on the deep canal water, that the art has no person, face or text, and that the cues read
 * apart from every other cue in the game.
 *
 * No logic types are imported: the catch box (48 px wide, 70 px deep) is written out here as local
 * constants. The cross-checks against the logic belong to the scene and look-table tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BAILING_BAIL_RISE,
  BAILING_BOAT_BANDS,
  BAILING_BOAT_DEPTH,
  BAILING_BOAT_POST_TOP_Y,
  BAILING_BOAT_RISE_END,
  BAILING_BOAT_RISE_MID,
  BAILING_BOAT_TEX,
  BAILING_BOAT_W,
  BAILING_BUCKET_BODY,
  BAILING_BUCKET_FRONT_TEX,
  BAILING_BUCKET_H,
  BAILING_BUCKET_INSIDE,
  BAILING_BUCKET_LIP,
  BAILING_BUCKET_RIM_RX,
  BAILING_BUCKET_RIM_RY,
  BAILING_BUCKET_SHINE,
  BAILING_BUCKET_TEX,
  BAILING_RIPPLE,
  BAILING_RIPPLE_RINGS,
  BAILING_RIPPLES_ALONG,
  BAILING_RIPPLES_TEX,
  BAILING_ROPE,
  BAILING_ROPE_LENGTH,
  BAILING_ROPE_TOP_Y,
  BAILING_SHADOW,
  BAILING_SHADOW_ALONG,
  BAILING_SHADOW_TEX,
  BAILING_SPLASH_DROPS,
  BAILING_SPLASH_DROP_R,
  BAILING_SPLASH_RX,
  BAILING_SPLASH_RY,
  BAILING_SPLASH_TEX,
  paintBailingBoat,
  paintBailingBucket,
  paintBailingBucketFront,
  paintBailingRipples,
  paintBailingShadow,
  paintBailingSplash,
} from './drawBailingBucket';
import { paintAnchorCue, paintAnchorRing } from './drawAnchorDrop';
import { paintCarpPuff, paintCarpPuffStill } from './drawCarp';
import { paintProtectedHalo } from './drawEffects';
import { paintGarterRipple } from './drawGarterSnake';
import { paintGeyserBubbles, paintGeyserRing } from './drawGeyserVent';
import { paintMudFlakes, paintMudRing } from './drawMudSeep';
import { paintVentBubble } from './drawPebbleRoom';
import { paintPuntingRing, paintPuntingShadow } from './drawPuntingPole';
import { paintDripDrop, paintDripRing } from './drawStalactite';
import { habitatLook } from './habitatLook';
import { EYE, INK } from './palette';
import type { TexSize } from './canvasKit';

vi.mock('phaser', () => ({}));

/** The logic's catch box, written out. */
const CATCH_WIDTH = 48;
const CATCH_DEPTH = 70;

/** Ink against a background is 3:1 or better when the background's luminance is at least this (guide 3c, 10). */
const LUMINANCE_FLOOR = 0.1687;
/** The pair rule: a cue object's fill or its ink is 3:1 or better on any background (guide 10). */
const PAIR_FLOOR = 3;
/** Fills that reach the outer edge against ink. */
const OUTER_FILL_RATIO = 4.5;
/** An outer fill this light against ink passes on any background by the pair method (guide 10). */
const ANY_BACKGROUND_RATIO = 9;
/** Guide's padding round every texture at 1x. */
const MIN_PAD = 4;

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function channelsOf(hex: string): [number, number, number] {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
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

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'globalAlpha'] as const;

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
}

/** A context that records every draw call and path call. Supports save and restore. */
function recordingContext(): Recording {
  const ops: Op[] = [];
  const calls: [string, unknown[]][] = [];
  let state: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    // beginDraw sets round joins and caps before every bake
    lineCap: 'round',
    globalAlpha: 1,
  };
  const stack: Record<string, unknown>[] = [];
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => void stack.push({ ...state }),
    restore: () => {
      state = stack.pop() ?? state;
    },
  };
  const recordCall = (name: string, args: unknown[]): unknown => {
    calls.push([name, args]);
    if (DRAW_OPS.has(name)) {
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
    return methods[name]?.(...args);
  };
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if ((STATE_KEYS as readonly string[]).includes(name)) return state[name];
        return (...args: unknown[]) => recordCall(name, args);
      },
      set: (_target, key, value) => {
        state[String(key)] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, calls };
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

const isFill = (op: Op): boolean => op.op.startsWith('fill');
const isStroke = (op: Op): boolean => op.op.startsWith('stroke');

/** The commands of an op's path. */
const cmdsOf = (op: Op): unknown[][] => {
  // a band is a filled rect: its corners stand in for a path
  if (op.op === 'fillRect') {
    const [x, y, w, h] = op.args as number[];
    return [
      ['moveTo', x, y],
      ['lineTo', x + w, y + h],
    ];
  }
  return op.args[0] as unknown[][];
};
const cmdNames = (op: Op): string[] => cmdsOf(op).map((cmd) => String(cmd[0]));

/** The ellipse commands of a recorded path, as [cx, cy, rx, ry, rot, start, end]. */
function ellipsesOf(op: Op): number[][] {
  return cmdsOf(op)
    .filter((cmd) => cmd[0] === 'ellipse')
    .map((cmd) => cmd.slice(1) as number[]);
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounds of a recorded path with ellipses exact; curves by their control points. */
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
    if (name === 'ellipse') grow(nums[0], nums[1], nums[2], nums[3]);
    else for (let i = 0; i + 1 < nums.length; i += 2) grow(nums[i], nums[i + 1]);
  }
  return box;
}

/** Bounds of a draw op, half a stroke's width outside its path. */
function opBounds(op: Op): Box {
  const box = tightBounds(cmdsOf(op));
  const half = isStroke(op) ? op.lineWidth / 2 : 0;
  return { minX: box.minX - half, minY: box.minY - half, maxX: box.maxX + half, maxY: box.maxY + half };
}

/** The bounds of everything an op list draws. */
function allBounds(ops: readonly Op[]): Box {
  const boxes = ops.map(opBounds);
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

const frameBox = (tex: TexSize): Box => ({
  minX: -tex.originX,
  minY: -tex.originY,
  maxX: tex.w - tex.originX,
  maxY: tex.h - tex.originY,
});

/** Every op sits inside the frame with at least 4 px of padding. */
function expectPadded(ops: readonly Op[], tex: TexSize): void {
  const frame = frameBox(tex);
  for (const op of ops) {
    const box = opBounds(op);
    expect(box.minX - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(box.minY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - box.maxX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - box.maxY).toBeGreaterThanOrEqual(MIN_PAD);
  }
}

/** The fill colours of ops, in paint order. */
const fillColours = (ops: readonly Op[]): unknown[] => ops.filter(isFill).map((op) => op.fillStyle);


/** Every colour Area 9 (the deep canal look) is seen on: the water stops and the bed stops. */
function backgrounds(): { name: string; hex: string }[] {
  const look = habitatLook('deep-canal');
  const out: { name: string; hex: string }[] = [];
  for (const stop of ['shallow', 'mid', 'deep'] as const) out.push({ name: `deep canal water ${stop}`, hex: look.water[stop] });
  out.push({ name: 'deep canal bed top', hex: look.bed.top }, { name: 'deep canal bed bottom', hex: look.bed.bottom });
  return out;
}

/** The y range every op covers, widest x extent of the ops whose box holds `y`. */
function extentAt(ops: readonly Op[], y: number): number {
  const boxes = ops.map(opBounds).filter((b) => b.minY <= y && y <= b.maxY);
  if (boxes.length === 0) return 0;
  return Math.max(...boxes.map((b) => b.maxX)) - Math.min(...boxes.map((b) => b.minX));
}

/** The commands of a path with its closePath left out, as text: the edge a fill and its open ink line share. */
const edgeOf = (op: Op): string => JSON.stringify(cmdsOf(op).filter((cmd) => cmd[0] !== 'closePath'));

// ---------------------------------------------------------------------------
// The painters
// ---------------------------------------------------------------------------

type Painter = (ctx: CanvasRenderingContext2D) => void;

interface Part {
  readonly name: string;
  readonly paint: Painter;
  readonly tex: TexSize;
}

const PARTS: readonly Part[] = [
  { name: 'bailing boat', paint: paintBailingBoat, tex: BAILING_BOAT_TEX },
  { name: 'bucket on its rope', paint: paintBailingBucket, tex: BAILING_BUCKET_TEX },
  { name: 'bucket front wall and rim', paint: paintBailingBucketFront, tex: BAILING_BUCKET_FRONT_TEX },
  { name: 'bucket shadow', paint: paintBailingShadow, tex: BAILING_SHADOW_TEX },
  { name: 'bucket ripples', paint: paintBailingRipples, tex: BAILING_RIPPLES_TEX },
  { name: 'splash ring', paint: paintBailingSplash, tex: BAILING_SPLASH_TEX },
];

/** Colours drawn inside a silhouette, so they need no ink of their own. */
const INNER_COLOURS = new Set<unknown>([BAILING_BUCKET_INSIDE, BAILING_BUCKET_SHINE]);

/** Every colour of the look, with the literal value written out here, never read from the source. */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['BAILING_BUCKET_BODY', BAILING_BUCKET_BODY, '#f8e7a6'],
  ['BAILING_BUCKET_LIP', BAILING_BUCKET_LIP, '#ffffff'],
  ['BAILING_BUCKET_INSIDE', BAILING_BUCKET_INSIDE, '#4a3626'],
  ['BAILING_BUCKET_SHINE', BAILING_BUCKET_SHINE, 'rgba(255,255,255,0.7)'],
  ['BAILING_ROPE', BAILING_ROPE, '#e8d3a0'],
  ['BAILING_SHADOW', BAILING_SHADOW, '#ffffff'],
  ['BAILING_RIPPLE', BAILING_RIPPLE, '#ffffff'],
];

/** The fills that reach an outer edge, each with its written luminance and ratio against ink. */
const OUTER_FILLS: readonly (readonly [string, string, string, string])[] = [
  ['BAILING_BUCKET_BODY', BAILING_BUCKET_BODY, '0.7986', '11.63'],
  ['BAILING_BUCKET_LIP', BAILING_BUCKET_LIP, '1.0000', '14.39'],
  ['BAILING_ROPE', BAILING_ROPE, '0.6628', '9.77'],
  ['BAILING_SHADOW', BAILING_SHADOW, '1.0000', '14.39'],
  ['BAILING_RIPPLE', BAILING_RIPPLE, '1.0000', '14.39'],
];

describe('bailing bucket colours are the values written down', () => {
  it.each(DOCUMENTED_COLOURS)('%s is %s', (_name, constant, documented) => {
    expect(constant).toBe(documented);
  });
});

// ---------------------------------------------------------------------------
// Contrast (guide 3c, 10)
// ---------------------------------------------------------------------------

describe('contrast on the deep canal (guide 3c, 10)', () => {
  it.each(OUTER_FILLS)('%s reaches the outer edge: luminance %s, %s:1 with ink, 9:1 or better so it passes on any background', (_name, fill, lum, ratio) => {
    expect(luminance(fill).toFixed(4)).toBe(lum);
    expect(contrast(fill, INK).toFixed(2)).toBe(ratio);
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(ANY_BACKGROUND_RATIO);
  });

  it('holds ink at 3:1 or better on every water stop and bed stop of the deep canal', () => {
    const all = backgrounds();
    expect(all).toHaveLength(5);
    for (const { name, hex } of all) {
      expect(luminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('gives every outer fill 3:1 or better from its ink or from itself on every one of those backgrounds', () => {
    for (const { name, hex } of backgrounds()) {
      for (const [fillName, fill] of OUTER_FILLS) {
        expect(Math.max(contrast(INK, hex), contrast(fill, hex)), `${fillName} on ${name}`).toBeGreaterThanOrEqual(PAIR_FLOOR);
      }
    }
  });

  it('keeps the hull bands 4.5:1 or better with ink, so the ink lines between them read in greyscale', () => {
    for (const band of BAILING_BOAT_BANDS) expect(contrast(band, INK), band).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
  });

  it('paints no outer fill with alpha: only fills inside a silhouette are see-through', () => {
    for (const { ops } of PARTS.map((p) => record(p.paint))) {
      for (const op of ops.filter(isFill)) {
        const colour = op.fillStyle as string;
        if (colour.startsWith('rgba')) expect(INNER_COLOURS.has(colour) || op.globalAlpha === 1, colour).toBe(true);
      }
      expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Frames and outlines
// ---------------------------------------------------------------------------

describe('frames and outlines (guide 4, 10)', () => {
  it.each(PARTS.map((p) => [p.name, p.paint, p.tex] as const))('fits the %s in its frame with its ink and at least 4 px of padding', (_name, paint, tex) => {
    expectPadded(record(paint).ops, tex);
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('inks the %s: an opaque INK line is painted, and no eye, text or image', (_name, paint) => {
    const { ops } = record(paint);
    expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK && op.globalAlpha === 1)).toBe(true);
    expect(fillColours(ops)).not.toContain(EYE);
    expect(ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText' || op.op === 'drawImage')).toEqual([]);
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('paints the %s the same every time, so no time or randomness is in it', (_name, paint) => {
    const a = record(paint).ops;
    const b = record(paint).ops;
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it.each(PARTS.map((p) => [p.name, p.tex] as const))('gives the %s a whole-pixel frame with its anchor point inside it', (_name, tex) => {
    for (const n of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(n)).toBe(true);
    expect(tex.originX).toBeGreaterThan(0);
    expect(tex.originX).toBeLessThan(tex.w);
    expect(tex.originY).toBeGreaterThan(0);
    expect(tex.originY).toBeLessThan(tex.h);
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('gives every light fill of the %s ink: an opaque INK line on the same edge', (_name, paint) => {
    const { ops } = record(paint);
    for (const op of ops) {
      // a band is a rectangle clipped to the hull, whose own fill is inked
      if (op.op === 'fillRect') continue;
      const colour = isFill(op) ? op.fillStyle : isStroke(op) ? op.strokeStyle : null;
      if (typeof colour !== 'string' || !colour.startsWith('#') || colour === INK || INNER_COLOURS.has(colour)) continue;
      if (luminance(colour) < 0.4) continue;
      const inked = ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.globalAlpha === 1 && edgeOf(o) === edgeOf(op));
      expect(inked, `${colour} ${op.op}`).toBe(true);
    }
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('paints the %s without a pointed part: no sharp-cornered fill, tooth, claw, hand or jaw', (_name, paint) => {
    // every path is made of lines, round-capped curves and ellipses; a bucket never reads as a grabbing predator
    const { ops } = record(paint);
    for (const op of ops) {
      for (const name of cmdNames(op)) expect(['moveTo', 'lineTo', 'quadraticCurveTo', 'ellipse', 'closePath']).toContain(name);
      expect(op.lineCap).toBe('round');
    }
  });
});

// ---------------------------------------------------------------------------
// Bailing boat
// ---------------------------------------------------------------------------

describe('the bailing boat (a whole moored trajinera hull; Q3 A)', () => {
  const { ops, calls } = record(paintBailingBoat);
  const hull = ops.find((op) => isFill(op) && op.op === 'fill' && op.fillStyle === '#fff0c9') as Op;

  it('is one whole hull wider than the catch box: it covers the span the bucket comes down in', () => {
    expect(hull).toBeDefined();
    expect(BAILING_BOAT_W).toBe(120);
    expect(BAILING_BOAT_W).toBeGreaterThan(CATCH_WIDTH);
    const box = tightBounds(cmdsOf(hull));
    expect([box.minX, box.maxX]).toEqual([-BAILING_BOAT_W / 2, BAILING_BOAT_W / 2]);
    expect(calls.filter(([name]) => name === 'clip')).toHaveLength(1);
  });

  it('floats: it rises above the water line and hangs below it, anchored on the water line in the middle', () => {
    const box = tightBounds(cmdsOf(hull));
    expect(box.minY).toBe(-BAILING_BOAT_RISE_END);
    expect(box.maxY).toBe(BAILING_BOAT_DEPTH);
    expect(BAILING_BOAT_RISE_END).toBeGreaterThan(BAILING_BOAT_RISE_MID);
    expect(BAILING_BOAT_RISE_MID).toBeGreaterThan(0);
    expect(BAILING_BOAT_TEX.originX).toBe(BAILING_BOAT_TEX.w - BAILING_BOAT_TEX.originX);
    expect(BAILING_BOAT_TEX.originY).toBeGreaterThan(BAILING_BOAT_TEX.h - BAILING_BOAT_TEX.originY);
  });

  it('has a post in the middle that rises above the hull to the rope tie, and the rope end is where the bucket art ends', () => {
    expect(BAILING_BOAT_POST_TOP_Y).toBeLessThan(-BAILING_BOAT_RISE_END);
    const post = ops.find((op) => isStroke(op) && op.strokeStyle === BAILING_ROPE) as Op;
    const box = tightBounds(cmdsOf(post));
    expect(box.minX).toBe(0);
    expect(box.maxX).toBe(0);
    expect(box.minY).toBe(BAILING_BOAT_POST_TOP_Y);
    expect(ops.indexOf(post)).toBeLessThan(ops.indexOf(hull));
  });

  it('has three painted bands under a cream rail, kept apart by ink lines, and a prow ball at each end', () => {
    const bands = ops.filter((op) => op.op === 'fillRect').map((op) => op.fillStyle);
    expect(bands).toEqual([...BAILING_BOAT_BANDS]);
    expect(new Set(bands).size).toBe(3);
    const inkLines = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 && cmdNames(op).join() === 'moveTo,lineTo');
    expect(inkLines).toHaveLength(3);
    const balls = ops.filter((op) => isFill(op) && op.fillStyle === '#ffa23a' && ellipsesOf(op).length === 1);
    expect(balls).toHaveLength(2);
  });

  it('inks the hull all round with an opaque INK line of 2.8 after the bands', () => {
    const outline = ops.find((op) => isStroke(op) && op.strokeStyle === INK && Math.abs(op.lineWidth - 2.8) < 1e-9) as Op;
    expect(outline).toBeDefined();
    expect(JSON.stringify(cmdsOf(outline))).toBe(JSON.stringify(cmdsOf(hull)));
    expect(ops.indexOf(outline)).toBeGreaterThan(ops.findIndex((op) => op.op === 'fillRect'));
  });

  it('shows no person, face, text or flower arch: no ellipse is bigger than the prow ball, and no text is drawn', () => {
    for (const op of ops) for (const e of ellipsesOf(op)) expect(e[2]).toBeLessThanOrEqual(4);
    expect(calls.filter(([name]) => name === 'fillText' || name === 'strokeText')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bucket, front wall and rim
// ---------------------------------------------------------------------------

describe('the bucket on its short rope (A11, ADR 0007, ADR 0008)', () => {
  const { ops } = record(paintBailingBucket);

  it('is anchored on the middle of the rim ellipse, with the body below and the handle and rope above', () => {
    const box = allBounds(ops);
    expect(box.maxY).toBeGreaterThan(BAILING_BUCKET_H);
    expect(box.minY).toBeLessThan(BAILING_ROPE_TOP_Y + 1);
    expect(BAILING_BUCKET_TEX.originX).toBe(BAILING_BUCKET_TEX.w - BAILING_BUCKET_TEX.originX);
    expect(BAILING_BUCKET_TEX.originY).toBeGreaterThan(BAILING_BUCKET_TEX.h - BAILING_BUCKET_TEX.originY);
  });

  it('is a plain round pail: the mouth is an open ellipse 40 px wide, inside the 48 px catch box, and the body narrows toward the bottom', () => {
    expect(BAILING_BUCKET_RIM_RX * 2).toBeLessThan(CATCH_WIDTH);
    expect(BAILING_BUCKET_RIM_RX).toBeGreaterThan(BAILING_BUCKET_RIM_RY);
    const mouth = ops.find((op) => isFill(op) && op.fillStyle === BAILING_BUCKET_INSIDE) as Op;
    expect(ellipsesOf(mouth).map((e) => e.slice(0, 7))).toEqual([[0, 0, BAILING_BUCKET_RIM_RX, BAILING_BUCKET_RIM_RY, 0, 0, Math.PI * 2]]);
    const body = tightBounds(cmdsOf(ops.find((op) => isFill(op) && op.fillStyle === BAILING_BUCKET_BODY) as Op));
    expect(body.maxY).toBe(BAILING_BUCKET_H);
    expect(extentAt(ops.filter((op) => op.strokeStyle === INK && op.lineWidth === 2.8), BAILING_BUCKET_H - 8)).toBeLessThan(BAILING_BUCKET_RIM_RX * 2);
  });

  it('hangs on a short rope: the rope is under 30 px and runs from the bail handle\'s top to BAILING_ROPE_TOP_Y', () => {
    expect(BAILING_ROPE_LENGTH).toBeLessThan(30);
    expect(BAILING_ROPE_TOP_Y).toBe(-(BAILING_BAIL_RISE + BAILING_ROPE_LENGTH));
    const rope = ops.find((op) => isStroke(op) && op.strokeStyle === BAILING_ROPE) as Op;
    const box = tightBounds(cmdsOf(rope));
    expect([box.minX, box.maxX]).toEqual([0, 0]);
    expect([box.minY, box.maxY]).toEqual([BAILING_ROPE_TOP_Y, -BAILING_BAIL_RISE]);
  });

  it('has a bail handle that arches up from the rim to the rope and does not reach the rope top', () => {
    const bail = ops.find((op) => isStroke(op) && op.strokeStyle === '#d3dae4') as Op;
    const cmds = cmdsOf(bail);
    const [, , control] = cmds[1] as [string, number, number, number, number];
    // a quadratic curve's top is half its control y
    expect(control / 2).toBe(-BAILING_BAIL_RISE);
    expect(BAILING_BAIL_RISE).toBeLessThan(-BAILING_ROPE_TOP_Y);
  });

  it('ends with the same strokes as the front wall and rim, so the overlay changes no pixel', () => {
    const front = record(paintBailingBucketFront).ops;
    const tail = ops.slice(ops.length - front.length);
    // what each call paints: the path and the one style that call uses
    const essence = (op: Op): unknown => [op.op, op.args, isFill(op) ? op.fillStyle : [op.strokeStyle, op.lineWidth]];
    expect(JSON.stringify(tail.map(essence))).toBe(JSON.stringify(front.map(essence)));
  });

  it('shows no person, face, text, hand, claw or tooth: only a pail, a handle and a rope', () => {
    expect(fillColours(ops).filter((c) => ![BAILING_BUCKET_INSIDE, BAILING_BUCKET_BODY].includes(c as string))).toEqual([]);
    for (const op of ops) for (const e of ellipsesOf(op)) expect(e[2]).toBeGreaterThanOrEqual(BAILING_BUCKET_RIM_RX);
  });
});

describe('the front wall and rim, drawn over the peeking axolotl', () => {
  const { ops } = record(paintBailingBucketFront);

  it('covers the body below the front of the mouth and none of the mouth behind it: the wall starts on the rim line', () => {
    const wall = ops.find((op) => isFill(op) && op.fillStyle === BAILING_BUCKET_BODY) as Op;
    const box = tightBounds(cmdsOf(wall));
    expect(box.minY).toBeLessThanOrEqual(0);
    expect(box.maxY).toBe(BAILING_BUCKET_H);
    const arc = ellipsesOf(wall);
    expect(arc.map((e) => e.slice(0, 7))).toEqual([[0, 0, BAILING_BUCKET_RIM_RX, BAILING_BUCKET_RIM_RY, 0, 0, Math.PI]]);
    expect(fillColours(ops)).not.toContain(BAILING_BUCKET_INSIDE);
  });

  it('shares the bucket\'s anchor point and its width, so the scene draws it at the bucket\'s position', () => {
    expect(BAILING_BUCKET_FRONT_TEX.originX).toBe(BAILING_BUCKET_TEX.originX);
    expect(BAILING_BUCKET_FRONT_TEX.w).toBe(BAILING_BUCKET_TEX.w);
    expect(BAILING_BUCKET_FRONT_TEX.h - BAILING_BUCKET_FRONT_TEX.originY).toBe(BAILING_BUCKET_TEX.h - BAILING_BUCKET_TEX.originY);
    expect(BAILING_BUCKET_FRONT_TEX.h).toBeLessThan(BAILING_BUCKET_TEX.h);
  });

  it('ends with the white lip as a dark, white, dark tube along the front half of the rim', () => {
    const colour = ops[ops.length - 1];
    const ink = ops[ops.length - 2];
    expect(colour.strokeStyle).toBe(BAILING_BUCKET_LIP);
    expect(ink.strokeStyle).toBe(INK);
    expect(ink.lineWidth).toBeGreaterThan(colour.lineWidth);
    expect(JSON.stringify(cmdsOf(ink))).toBe(JSON.stringify(cmdsOf(colour)));
  });

  it('keeps two dark hoop lines on the wall, so the pail reads in greyscale', () => {
    const hoops = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1.6);
    expect(hoops).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Shadow, ripples and splash
// ---------------------------------------------------------------------------

describe('the shadow and ripples (the warning)', () => {
  it('draws the shadow as a white pail silhouette that fits inside the 48 px catch box and the 70 px depth', () => {
    const { ops } = record(paintBailingShadow);
    const silhouette = ops.find((op) => isFill(op) && op.fillStyle === BAILING_SHADOW) as Op;
    expect(silhouette).toBeDefined();
    const box = allBounds(ops);
    expect(box.maxX - box.minX).toBeLessThanOrEqual(CATCH_WIDTH);
    expect(BAILING_SHADOW_ALONG + box.maxY).toBeLessThanOrEqual(CATCH_DEPTH);
    expect(BAILING_SHADOW_ALONG - -box.minY).toBeGreaterThan(0);
    // inked all round, then a mouth line and two hoop lines
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === INK)).toHaveLength(4);
    expect(edgeOf(ops[1])).toBe(edgeOf(silhouette));
  });

  it('draws four ripple arcs in two broken rings, each a dark, white, dark tube, none closed', () => {
    const { ops } = record(paintBailingRipples);
    const colours = ops.filter((op) => isStroke(op) && op.strokeStyle === BAILING_RIPPLE);
    expect(ops).toHaveLength(8);
    expect(colours).toHaveLength(4);
    for (const colour of colours) {
      const ink = ops.find((o) => isStroke(o) && o.strokeStyle === INK && JSON.stringify(o.args) === JSON.stringify(colour.args)) as Op;
      expect(ink).toBeDefined();
      expect(ops.indexOf(ink)).toBeLessThan(ops.indexOf(colour));
      expect(ink.lineWidth).toBeGreaterThan(colour.lineWidth);
      expect(cmdNames(colour)).not.toContain('closePath');
      const [, , , , , start, end] = ellipsesOf(colour)[0] as [number, number, number, number, number, number, number];
      expect(end - start).toBeLessThan(Math.PI);
    }
    expect(BAILING_RIPPLE_RINGS).toHaveLength(2);
    expect(BAILING_RIPPLE_RINGS[0][0]).toBeGreaterThan(BAILING_RIPPLE_RINGS[1][0]);
    expect(BAILING_RIPPLE_RINGS[0][0] * 2).toBeLessThanOrEqual(CATCH_WIDTH);
    expect(BAILING_RIPPLES_ALONG).toBeGreaterThan(0);
    expect(BAILING_RIPPLES_ALONG).toBeLessThan(BAILING_SHADOW_ALONG);
  });

  it('keeps the ripples and the shadow apart from the rim: the shadow sits deeper than the ripples, under the same x', () => {
    const shadow = allBounds(record(paintBailingShadow).ops);
    const ripples = allBounds(record(paintBailingRipples).ops);
    expect(shadow.minX + shadow.maxX).toBeCloseTo(0, 9);
    expect(ripples.minX + ripples.maxX).toBeCloseTo(0, 9);
    expect(BAILING_SHADOW_ALONG + shadow.minY).toBeGreaterThan(BAILING_RIPPLES_ALONG + ripples.maxY - 6);
  });
});

describe('the splash ring (the landing)', () => {
  const { ops } = record(paintBailingSplash);

  it('is one closed ring, a dark, white, dark tube, with five white drops above it', () => {
    const ring = ops.filter((op) => isStroke(op) && op.strokeStyle === BAILING_RIPPLE);
    expect(ring).toHaveLength(1);
    expect(ellipsesOf(ring[0]).map((e) => e.slice(0, 7))).toEqual([[0, 0, BAILING_SPLASH_RX, BAILING_SPLASH_RY, 0, 0, Math.PI * 2]]);
    const drops = ops.filter((op) => isFill(op) && op.fillStyle === BAILING_RIPPLE);
    expect(drops).toHaveLength(BAILING_SPLASH_DROPS.length);
    expect(BAILING_SPLASH_DROPS).toHaveLength(5);
    for (const drop of drops) {
      const [cx, cy, rx] = ellipsesOf(drop)[0];
      expect(rx).toBe(BAILING_SPLASH_DROP_R);
      expect(cy).toBeLessThan(0);
      expect(Math.abs(cx)).toBeLessThanOrEqual(BAILING_SPLASH_RX);
    }
  });

  it('inks every drop: an opaque INK line on the same edge', () => {
    for (const drop of ops.filter((op) => isFill(op))) {
      expect(ops.some((o) => isStroke(o) && o.strokeStyle === INK && edgeOf(o) === edgeOf(drop))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Cue shapes differ
// ---------------------------------------------------------------------------

interface Facts {
  readonly cmds: Set<string>;
  readonly aspect: number;
  readonly drawn: number;
}

/** What a painter's shape is made of: the path commands it uses, the width over the height of all of it and its draw count. */
function factsOf(paint: Painter): Facts {
  const { ops } = record(paint);
  const cmds = new Set<string>();
  for (const op of ops) for (const name of cmdNames(op)) cmds.add(name);
  const box = allBounds(ops);
  return { cmds, aspect: (box.maxX - box.minX) / (box.maxY - box.minY), drawn: ops.length };
}

const sameSet = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && [...a].every((x) => b.has(x));

/** Every other moving hazard and predator cue, and the protected ring, as still frames. */
const OTHER_CUES: readonly (readonly [string, Painter])[] = [
  ['anchor chain-link cue', paintAnchorCue],
  ['anchor ripple lines', paintAnchorRing],
  ['mud silt flakes', paintMudFlakes],
  ['mud crack ring', paintMudRing],
  ['pole shadow', paintPuntingShadow],
  ['pole ripple rings', paintPuntingRing],
  ['drip drop', paintDripDrop],
  ['drip ripple rings', paintDripRing],
  ['geyser bubbles', paintGeyserBubbles],
  ['geyser shimmer ring', paintGeyserRing],
  ['pulsing vent bubble', paintVentBubble],
  ['carp mud puff', paintCarpPuff],
  ['carp mud puff, still', paintCarpPuffStill],
  ['garter snake ring', paintGarterRipple],
  ['protected ring', paintProtectedHalo],
];

const MY_CUES: readonly (readonly [string, Painter])[] = [
  ['bucket shadow', paintBailingShadow],
  ['bucket ripples', paintBailingRipples],
  ['splash ring', paintBailingSplash],
];

describe('the cues read apart in greyscale and when still (guide 10)', () => {
  const others = OTHER_CUES.map(([name, paint]) => [name, factsOf(paint)] as const);

  /** Two shapes differ when they use different path commands, are drawn in a different number of strokes and fills, or one is 1.5 times flatter than the other. */
  function differ(a: Facts, b: Facts): boolean {
    return !sameSet(a.cmds, b.cmds) || a.drawn !== b.drawn || Math.abs(Math.log(a.aspect / b.aspect)) >= Math.log(1.5);
  }

  it.each(MY_CUES)('%s differs in make, count or proportion from every other cue and the protected ring', (_name, paint) => {
    const mine = factsOf(paint);
    for (const [otherName, theirs] of others) expect(differ(mine, theirs), otherName).toBe(true);
  });

  it('keeps the three bucket cues apart from each other', () => {
    const mine = MY_CUES.map(([name, paint]) => [name, factsOf(paint)] as const);
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) expect(differ(mine[i][1], mine[j][1]), `${mine[i][0]} and ${mine[j][0]}`).toBe(true);
    }
  });
});
