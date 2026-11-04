/**
 * Drag net looks (issue #108, Area 10; ND-2): the net boats and their lean, the float line, the cork
 * floats, the lit floats (the reduced-motion warning), the mesh curtain with its outline, the safe
 * hollow shade and the wriggle-out strands, headless. The painters run against a recording context
 * and a stub Path2D (the same approach as bailingBucketArt.test.ts): every fill and stroke is kept
 * with the style, width and alpha it was painted under. The tests check the frames, the anchor
 * points, the ink on every light fill, the contrast on the deep canal water, the greyscale outlines
 * (dark, white, dark), that the billow only bows forward, that the art has no person, face, text or
 * trapping shape, and that the numbers match the logic's (src/logic/dragNets.ts).
 */
import { describe, expect, it, vi } from 'vitest';
// Loaded first on purpose: src/logic/zone.ts, lures.ts and trajineras.ts import each other, and only
// this order sets TRAJINERAS before lures.ts reads it (drawDeepCanal.ts pulls trajineras.ts in).
import '../logic/lures';
import { DRAG_NET } from '../logic/dragNets';
import {
  DRAG_NET_BOAT_TEX,
  DRAG_NET_BOW_MAX,
  DRAG_NET_CELL,
  DRAG_NET_CURTAIN_W,
  DRAG_NET_EDGE,
  DRAG_NET_FLOAT,
  DRAG_NET_FLOAT_LIT,
  DRAG_NET_FLOAT_LIT_TEX,
  DRAG_NET_FLOAT_RX,
  DRAG_NET_FLOAT_RY,
  DRAG_NET_FLOAT_SPACING,
  DRAG_NET_FLOAT_TEX,
  DRAG_NET_MESH,
  DRAG_NET_MOTION,
  DRAG_NET_ROPE,
  DRAG_NET_ROPE_OL,
  DRAG_NET_ROPE_W,
  DRAG_NET_SHADE_ALPHA,
  DRAG_NET_SINKER,
  DRAG_NET_SINKER_SPACING,
  DRAG_NET_STRANDS_TEX,
  DRAG_NET_SWAY_MAX,
  dragNetBoatLean,
  dragNetCurtainTex,
  dragNetFloatXs,
  dragNetHollowShadeTex,
  paintDragNetBoat,
  paintDragNetCurtain,
  paintDragNetFloat,
  paintDragNetFloatLine,
  paintDragNetFloatLit,
  paintDragNetHollowShade,
  paintDragNetStrands,
} from './drawDragNet';
import { BAILING_ROPE } from './drawBailingBucket';
import { DEEP_CANAL_SHADE_RGB } from './drawDeepCanal';
import { FISHING_BOAT_TEX, paintFishingBoat } from './drawFishingTrajinera';
import { POLE_WOOD } from './drawPuntingPole';
import { habitatLook } from './habitatLook';
import { EYE, INK, PEBBLE_A, WHITE } from './palette';
import type { TexSize } from './canvasKit';

vi.mock('phaser', () => ({}));

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
/** The curtain heights the tests paint: a short and a tall stretch, and the whole deep canal's height. */
const HEIGHTS: readonly number[] = [96, 240, 720];

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

/** A gradient stand-in that keeps its stops. */
interface Gradient {
  readonly kind: 'gradient';
  readonly args: number[];
  readonly stops: [number, string][];
  addColorStop(offset: number, colour: string): void;
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
  /** How many clips were active when the op was painted. */
  readonly clipped: number;
}

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'globalAlpha'] as const;

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
}

/** A context that records every draw call and path call. Supports save and restore, clips and radial gradients. */
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
  let clips = 0;
  const stack: { state: Record<string, unknown>; clips: number }[] = [];
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    save: () => void stack.push({ state: { ...state }, clips }),
    restore: () => {
      const top = stack.pop();
      if (top) {
        state = top.state;
        clips = top.clips;
      }
    },
    clip: () => void (clips += 1),
    createRadialGradient: (...args) => {
      const stops: [number, string][] = [];
      const gradient: Gradient = { kind: 'gradient', args: args as number[], stops, addColorStop: (o, c) => void stops.push([o, c]) };
      return gradient;
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
        clipped: clips,
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
  // the pen, so a quadratic curve can be measured exactly rather than by its control point
  let pen: [number, number] = [0, 0];
  for (const [name, ...args] of cmds) {
    const nums = args as number[];
    if (name === 'ellipse') grow(nums[0], nums[1], nums[2], nums[3]);
    else if (name === 'rect') {
      grow(nums[0], nums[1]);
      grow(nums[0] + nums[2], nums[1] + nums[3]);
    } else if (name === 'quadraticCurveTo') {
      const [cx, cy, x, y] = nums;
      grow(x, y);
      // each axis has at most one turning point, at t = (p0 - c) / (p0 - 2c + p1)
      for (const [p0, c, p1, axis] of [[pen[0], cx, x, 0], [pen[1], cy, y, 1]] as const) {
        const d = p0 - 2 * c + p1;
        const t = d === 0 ? -1 : (p0 - c) / d;
        if (t > 0 && t < 1) {
          const at = (1 - t) * (1 - t) * p0 + 2 * t * (1 - t) * c + t * t * p1;
          if (axis === 0) grow(at, pen[1]);
          else grow(pen[0], at);
        }
      }
    } else for (let i = 0; i + 1 < nums.length; i += 2) grow(nums[i], nums[i + 1]);
    if (nums.length >= 2 && name !== 'ellipse' && name !== 'rect') pen = [nums[nums.length - 2], nums[nums.length - 1]];
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

/**
 * Every op sits inside the frame with at least 4 px of padding. An op painted under a clip shows only
 * inside the clip, so the clip's own path is what is measured for it.
 */
function expectPadded(ops: readonly Op[], tex: TexSize, clips: readonly (readonly unknown[][])[] = []): void {
  const frame = frameBox(tex);
  for (const path of clips) {
    const box = tightBounds(path);
    expect(box.minX - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(box.minY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - box.maxX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - box.maxY).toBeGreaterThanOrEqual(MIN_PAD);
  }
  for (const op of ops) {
    if (op.clipped > 0) continue;
    const box = opBounds(op);
    expect(box.minX - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(box.minY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - box.maxX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - box.maxY).toBeGreaterThanOrEqual(MIN_PAD);
  }
}

/** The fill colours of ops, in paint order. */
const fillColours = (ops: readonly Op[]): unknown[] => ops.filter(isFill).map((op) => op.fillStyle);

/** Every colour the deep canal look is seen on: the water stops and the bed stops. */
function backgrounds(): { name: string; hex: string }[] {
  const look = habitatLook('deep-canal');
  const out: { name: string; hex: string }[] = [];
  for (const stop of ['shallow', 'mid', 'deep'] as const) out.push({ name: `deep canal water ${stop}`, hex: look.water[stop] });
  out.push({ name: 'deep canal bed top', hex: look.bed.top }, { name: 'deep canal bed bottom', hex: look.bed.bottom });
  return out;
}

/** The commands of a path with its closePath left out, as text: the edge a fill and its open ink line share. */
const edgeOf = (op: Op): string => JSON.stringify(cmdsOf(op).filter((cmd) => cmd[0] !== 'closePath'));

/** The calls of one name that a recording made. */
const callsOf = (rec: Recording, name: string): unknown[][] => rec.calls.filter(([n]) => n === name).map(([, args]) => args);

/** Blend a colour at `alpha` over a #rrggbb background, as a #rrggbb. */
function over(rgb: readonly number[], alpha: number, background: string): string {
  const bg = channelsOf(background);
  const out = bg.map((v, i) => Math.floor(v * (1 - alpha) + rgb[i] * alpha));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Each colour is within one in every channel of the colour written down. */
function expectNear(got: readonly string[], written: readonly string[]): void {
  expect(got).toHaveLength(written.length);
  got.forEach((hex, i) => {
    channelsOf(hex).forEach((v, c) => expect(Math.abs(v - channelsOf(written[i])[c]), `${hex} vs ${written[i]}`).toBeLessThanOrEqual(1));
  });
}

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
  { name: 'net boat', paint: paintDragNetBoat, tex: DRAG_NET_BOAT_TEX },
  { name: 'float', paint: paintDragNetFloat, tex: DRAG_NET_FLOAT_TEX },
  { name: 'lit float', paint: paintDragNetFloatLit, tex: DRAG_NET_FLOAT_LIT_TEX },
  { name: 'strands', paint: paintDragNetStrands, tex: DRAG_NET_STRANDS_TEX },
  ...HEIGHTS.flatMap((h) => [
    { name: `curtain ${h} px tall`, paint: (ctx: CanvasRenderingContext2D) => paintDragNetCurtain(ctx, h), tex: dragNetCurtainTex(h) },
    {
      name: `curtain ${h} px tall at full billow`,
      paint: (ctx: CanvasRenderingContext2D) => paintDragNetCurtain(ctx, h, DRAG_NET_BOW_MAX, DRAG_NET_SWAY_MAX),
      tex: dragNetCurtainTex(h),
    },
    {
      name: `curtain ${h} px tall at full sway back`,
      paint: (ctx: CanvasRenderingContext2D) => paintDragNetCurtain(ctx, h, DRAG_NET_BOW_MAX, -DRAG_NET_SWAY_MAX),
      tex: dragNetCurtainTex(h),
    },
  ]),
];

/** Colours drawn inside a silhouette or over the water, so they need no ink of their own. */
const INNER_COLOURS = new Set<unknown>([DRAG_NET_MESH, 'rgba(43,35,80,0.22)', 'rgba(255,255,255,0.5)']);

/** Every colour of the look, with the literal value written out here, never read from the source. */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['DRAG_NET_ROPE', DRAG_NET_ROPE, '#e8d3a0'],
  ['DRAG_NET_FLOAT', DRAG_NET_FLOAT, '#ecd7a8'],
  ['DRAG_NET_FLOAT_LIT', DRAG_NET_FLOAT_LIT, '#fff6c4'],
  ['DRAG_NET_EDGE', DRAG_NET_EDGE, '#ffffff'],
  ['DRAG_NET_MESH', DRAG_NET_MESH, 'rgba(255,255,255,0.5)'],
  ['DRAG_NET_SINKER', DRAG_NET_SINKER, '#d4cfe6'],
];

/** The fills that reach an outer edge, each with its written luminance and ratio against ink. */
const OUTER_FILLS: readonly (readonly [string, string, string, string])[] = [
  ['DRAG_NET_ROPE', DRAG_NET_ROPE, '0.6628', '9.77'],
  ['DRAG_NET_FLOAT', DRAG_NET_FLOAT, '0.6926', '10.18'],
  ['DRAG_NET_FLOAT_LIT', DRAG_NET_FLOAT_LIT, '0.9116', '13.18'],
  ['DRAG_NET_EDGE', DRAG_NET_EDGE, '1.0000', '14.39'],
  ['DRAG_NET_SINKER', DRAG_NET_SINKER, '0.6434', '9.50'],
];

describe('drag net colours are the values written down', () => {
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

  it('keeps the curtain\'s outline dark, white, dark: white and ink are 3.79:1 or better against any background', () => {
    for (const { name, hex } of backgrounds()) {
      expect(contrast(INK, hex) > contrast(WHITE, hex) ? contrast(INK, hex) : contrast(WHITE, hex), name).toBeGreaterThanOrEqual(3.79);
    }
  });

  it('lets the mesh only lighten the water: the floor holds through it on the three water stops', () => {
    const look = habitatLook('deep-canal');
    const lighter = ['shallow', 'mid', 'deep'].map((stop) => over([255, 255, 255], 0.5, look.water[stop as 'shallow' | 'mid' | 'deep']));
    // the guide's #a2d8e0, #94cad4 and #90c0cc, give or take one in a channel for rounding
    const written = ['#a2d8e0', '#94cad4', '#90c0cc'];
    expectNear(lighter, written);
    ['shallow', 'mid', 'deep'].forEach((stop, i) => {
      expect(luminance(lighter[i])).toBeGreaterThan(luminance(look.water[stop as 'shallow' | 'mid' | 'deep']));
      expect(luminance(lighter[i])).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    });
    // the guide's ratios with ink on the lightened stops: 9.21:1, 7.99:1 and 7.26:1
    expect(written.map((hex) => contrast(INK, hex).toFixed(2))).toEqual(['9.21', '7.99', '7.26']);
  });

  it('keeps the floor under the hollow shade on the three water stops, all over 0.1687', () => {
    const look = habitatLook('deep-canal');
    const dark = ['shallow', 'mid', 'deep'].map((stop) => over(DEEP_CANAL_SHADE_RGB, DRAG_NET_SHADE_ALPHA, look.water[stop as 'shallow' | 'mid' | 'deep']));
    const written = ['#3499a8', '#268a9c', '#228094'];
    expectNear(dark, written);
    expect(written.map((hex) => luminance(hex).toFixed(4))).toEqual(['0.2634', '0.2099', '0.1792']);
    for (const hex of dark) expect(luminance(hex)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
  });

  it('paints no outer fill with alpha: only the mesh lattice and the hull\'s seams and shine are see-through', () => {
    for (const { ops } of PARTS.map((p) => record(p.paint))) {
      for (const op of ops) {
        const colour = (isFill(op) ? op.fillStyle : op.strokeStyle) as string;
        if (colour.startsWith('rgba')) expect(INNER_COLOURS.has(colour), colour).toBe(true);
        expect(op.globalAlpha).toBe(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Frames and outlines
// ---------------------------------------------------------------------------

describe('frames and outlines (guide 4, 10)', () => {
  it.each(PARTS.map((p) => [p.name, p.paint, p.tex] as const))('fits the %s in its frame with its ink and at least 4 px of padding', (_name, paint, tex) => {
    const rec = record(paint);
    expectPadded(rec.ops, tex, callsOf(rec, 'clip').map(([path]) => (path as unknown as { cmds: unknown[][] }).cmds));
  });

  it.each(PARTS.map((p) => [p.name, p.tex] as const))('gives the %s a whole-pixel frame with its anchor point inside it', (_name, tex) => {
    for (const n of [tex.w, tex.h, tex.originX, tex.originY]) expect(Number.isInteger(n)).toBe(true);
    expect(tex.originX).toBeGreaterThan(0);
    expect(tex.originX).toBeLessThan(tex.w);
    expect(tex.originY).toBeGreaterThan(0);
    expect(tex.originY).toBeLessThan(tex.h);
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('paints the %s the same every time, so no time or randomness is in it', (_name, paint) => {
    const a = record(paint).ops;
    const b = record(paint).ops;
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('inks the %s with an opaque INK line, and draws no eye, text or image', (_name, paint) => {
    const { ops, calls } = record(paint);
    expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK && op.globalAlpha === 1)).toBe(true);
    expect(fillColours(ops)).not.toContain(EYE);
    expect(ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText' || op.op === 'drawImage')).toEqual([]);
    expect(calls.filter(([name]) => name === 'fillText' || name === 'strokeText')).toEqual([]);
  });

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('paints the %s from lines, curves and ellipses, round-capped: nothing pointed, no tooth, claw or hand', (_name, paint) => {
    for (const op of record(paint).ops) {
      for (const name of cmdNames(op)) expect(['moveTo', 'lineTo', 'quadraticCurveTo', 'ellipse', 'closePath', 'rect']).toContain(name);
      expect(op.lineCap).toBe('round');
    }
  });

  it('gives every light fill of the floats, the lit floats, the sinkers and the boats ink: an opaque INK line on the same edge', () => {
    for (const paint of [paintDragNetFloat, paintDragNetFloatLit, (ctx: CanvasRenderingContext2D) => paintDragNetCurtain(ctx, 240), paintDragNetBoat]) {
      const { ops } = record(paint);
      for (const op of ops.filter((o) => o.op === 'fill')) {
        const colour = op.fillStyle as string;
        if (colour === INK || colour === WHITE) continue;
        const inked = ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.globalAlpha === 1 && edgeOf(o) === edgeOf(op));
        expect(inked, `${colour}`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------

describe('the net boats (guide 7p)', () => {
  it('are the fishing trajinera\'s hull painted the same, with the same frame and anchor', () => {
    expect(DRAG_NET_BOAT_TEX).toBe(FISHING_BOAT_TEX);
    expect(JSON.stringify(record(paintDragNetBoat).ops)).toBe(JSON.stringify(record(paintFishingBoat).ops));
  });

  it('have no rod, no person and no net on the hull: no wood tube, no holder ring', () => {
    const { ops } = record(paintDragNetBoat);
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === POLE_WOOD)).toEqual([]);
    expect(ops.filter((op) => op.fillStyle === PEBBLE_A)).toEqual([]);
  });

  it('lean 0.12 rad in the warning, tops toward the way the net will sweep', () => {
    expect(DRAG_NET_MOTION.leanRad).toBe(0.12);
    // a positive rotation about the anchor tips the top (up, -y) toward +x
    expect(dragNetBoatLean('right')).toBe(0.12);
    expect(dragNetBoatLean('left')).toBe(-0.12);
    expect(dragNetBoatLean('up')).toBe(0);
    expect(dragNetBoatLean('down')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Float line and floats
// ---------------------------------------------------------------------------

describe('the float line and the floats (guide 7p)', () => {
  it('draws the rope as a tube 2.4 wide with 1.1 of ink a side, along the water line from its start', () => {
    expect([DRAG_NET_ROPE_W, DRAG_NET_ROPE_OL]).toEqual([2.4, 1.1]);
    expect(DRAG_NET_ROPE).toBe(BAILING_ROPE);
    const { ops } = record((ctx) => paintDragNetFloatLine(ctx, 280));
    expect(ops.map((op) => [op.strokeStyle, op.lineWidth])).toEqual([
      [INK, 2.4 + 2 * 1.1],
      ['#e8d3a0', 2.4],
    ]);
    expect(cmdsOf(ops[1])).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 280, 0],
    ]);
  });

  it('puts a cork float every 32 px from the stretch\'s edge, never on an end of the rope', () => {
    expect(DRAG_NET_FLOAT_SPACING).toBe(32);
    expect(dragNetFloatXs(200)).toEqual([32, 64, 96, 128, 160, 192]);
    expect(dragNetFloatXs(64)).toEqual([32]);
    expect(dragNetFloatXs(32)).toEqual([]);
    expect(dragNetFloatXs(0)).toEqual([]);
  });

  it('draws a float as an oval 14 x 9 in cork tan with ink 1.6, anchored on its centre', () => {
    expect([DRAG_NET_FLOAT_RX * 2, DRAG_NET_FLOAT_RY * 2]).toEqual([14, 9]);
    const { ops } = record(paintDragNetFloat);
    expect(ops).toHaveLength(2);
    expect(ops[0].fillStyle).toBe('#ecd7a8');
    expect(ellipsesOf(ops[0])[0].slice(0, 4)).toEqual([0, 0, 7, 4.5]);
    expect(ops[1].strokeStyle).toBe(INK);
    expect(ops[1].lineWidth).toBe(1.6);
    expect(edgeOf(ops[1])).toBe(edgeOf(ops[0]));
  });

  it('draws a lit float as the same oval in the lit fill, with a white ring 2 wide, 3 px out from its ink, inked 1 on its outside', () => {
    const { ops } = record(paintDragNetFloatLit);
    const oval = ops.find((op) => op.op === 'fill') as Op;
    expect(oval.fillStyle).toBe('#fff6c4');
    expect(ellipsesOf(oval)[0].slice(0, 4)).toEqual([0, 0, 7, 4.5]);
    const ring = ops.find((op) => isStroke(op) && op.strokeStyle === WHITE) as Op;
    expect(ring.lineWidth).toBe(2);
    const [rx, ry] = ellipsesOf(ring)[0].slice(2, 4);
    // the float's ink reaches 0.8 past its oval; the ring's inner edge is 3 px beyond that
    expect(rx - 1).toBeCloseTo(7 + 0.8 + 3, 9);
    expect(ry - 1).toBeCloseTo(4.5 + 0.8 + 3, 9);
    const ink = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1) as Op[];
    expect(ink).toHaveLength(1);
    const [irx, iry] = ellipsesOf(ink[0])[0].slice(2, 4);
    // the ink sits wholly outside the white: its inner edge is the ring's outer edge
    expect(irx - 0.5).toBeCloseTo(rx + 1, 9);
    expect(iry - 0.5).toBeCloseTo(ry + 1, 9);
    expect(ops.indexOf(ink[0])).toBeLessThan(ops.indexOf(ring));
  });

  it('tells lit from unlit by shape, not by value alone: they are only 1.29:1 apart, so the ring carries it', () => {
    expect(contrast(DRAG_NET_FLOAT_LIT, DRAG_NET_FLOAT).toFixed(2)).toBe('1.29');
    const unlit = record(paintDragNetFloat).ops;
    const lit = record(paintDragNetFloatLit).ops;
    expect(unlit.filter((op) => op.strokeStyle === WHITE)).toEqual([]);
    expect(lit.filter((op) => op.strokeStyle === WHITE)).toHaveLength(1);
    expect(allBounds(lit).maxX).toBeGreaterThan(allBounds(unlit).maxX + 5);
    expect(allBounds(lit).maxY).toBeGreaterThan(allBounds(unlit).maxY + 5);
  });

  it('holds the lit float steady: nothing in the painting is timed, and the ring is a whole closed ellipse', () => {
    const ring = record(paintDragNetFloatLit).ops.find((op) => op.strokeStyle === WHITE) as Op;
    expect(ellipsesOf(ring)[0].slice(5, 7)).toEqual([0, Math.PI * 2]);
  });
});

// ---------------------------------------------------------------------------
// Curtain
// ---------------------------------------------------------------------------

describe.each(HEIGHTS)('the mesh curtain of a stretch %s px tall (guide 7p)', (h) => {
  const rec = record((ctx) => paintDragNetCurtain(ctx, h));
  const { ops } = rec;
  const lattice = ops.find((op) => isStroke(op) && op.strokeStyle === DRAG_NET_MESH) as Op;
  const whites = ops.filter((op) => isStroke(op) && op.strokeStyle === DRAG_NET_EDGE);
  const inks = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth > 2);

  it('is a band 40 px wide, its leading edge at x = 0 from the water line down to the stretch\'s bottom edge', () => {
    expect(DRAG_NET_CURTAIN_W).toBe(40);
    const clip = (callsOf(rec, 'clip')[0][0] as unknown as { cmds: unknown[][] }).cmds;
    const box = tightBounds(clip);
    expect([box.minX, box.maxX, box.minY, box.maxY]).toEqual([-40, 0, 0, h]);
    const front = whites[1];
    expect(cmdsOf(front)[0]).toEqual(['moveTo', 0, 0]);
    expect(cmdsOf(front)[1]).toEqual(['quadraticCurveTo', 0, h / 2, 0, h]);
  });

  it('has a frame whose anchor is the top of the leading edge', () => {
    const tex = dragNetCurtainTex(h);
    expect(tex.originY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(tex.w - tex.originX).toBeGreaterThanOrEqual(DRAG_NET_BOW_MAX + MIN_PAD);
    expect(tex.originX).toBeGreaterThanOrEqual(DRAG_NET_CURTAIN_W + DRAG_NET_SWAY_MAX + MIN_PAD);
    expect(tex.h - tex.originY).toBeGreaterThanOrEqual(h + MIN_PAD);
  });

  it('is a see-through diamond lattice, a cell 12 px wide, white at half strength, 1.2 wide, with no ink, clipped to the band and painted first', () => {
    expect(DRAG_NET_CELL).toBe(12);
    expect(lattice.lineWidth).toBe(1.2);
    expect(lattice.clipped).toBe(1);
    expect(ops.indexOf(lattice)).toBe(0);
    const pairs = cmdsOf(lattice) as [string, number, number][];
    // the lines that run down to the right start on the water line at x apart by one cell
    const xs: number[] = [];
    for (let i = 0; i < pairs.length; i += 2) if (pairs[i + 1][1] > pairs[i][1]) xs.push(pairs[i][1]);
    expect(xs.length).toBeGreaterThan(2);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBe(12);
    // every line runs at 45 degrees
    const cmds = cmdsOf(lattice);
    for (let i = 0; i < cmds.length; i += 2) {
      const [, x0, y0] = cmds[i] as [string, number, number];
      const [, x1, y1] = cmds[i + 1] as [string, number, number];
      expect(Math.abs(x1 - x0)).toBe(Math.abs(y1 - y0));
    }
  });

  it('is outlined dark, white, dark: one ink group first, then the white, the top, foot and trailing edges 2.4 with 1.1 of ink a side and the front 3 with 1.4', () => {
    expect(inks.map((op) => op.lineWidth)).toEqual([2.4 + 2 * 1.1, 3 + 2 * 1.4]);
    expect(whites.map((op) => op.lineWidth)).toEqual([2.4, 3]);
    // all the ink is painted before any white, so the joints merge into one inked shape
    expect(ops.indexOf(inks[1])).toBeLessThan(ops.indexOf(whites[0]));
    expect(edgeOf(inks[0])).toBe(edgeOf(whites[0]));
    expect(edgeOf(inks[1])).toBe(edgeOf(whites[1]));
    for (const w of whites) expect(w.globalAlpha).toBe(1);
  });

  it('has a front edge heavier than the other edges, so the front is told in greyscale', () => {
    expect(whites[1].lineWidth).toBeGreaterThan(whites[0].lineWidth);
    expect(inks[1].lineWidth).toBeGreaterThan(inks[0].lineWidth);
  });

  it('runs its top, trailing and foot edges as one open path round the band\'s back', () => {
    expect(cmdsOf(whites[0])).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', -40, 0],
      ['lineTo', -40, h],
      ['lineTo', 0, h],
    ]);
  });

  it('hangs pebble A sinkers of radius 2.6 with ink 1.2 every 24 px along the foot, inside the band', () => {
    expect(DRAG_NET_SINKER_SPACING).toBe(24);
    const sinkers = ops.filter((op) => op.op === 'fill' && op.fillStyle === PEBBLE_A);
    expect(sinkers.map((op) => ellipsesOf(op)[0].slice(0, 4))).toEqual([
      [-12, h, 2.6, 2.6],
      [-36, h, 2.6, 2.6],
    ]);
    for (const op of sinkers) expect(ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.lineWidth === 1.2 && edgeOf(o) === edgeOf(op))).toBe(true);
    expect(ops.indexOf(sinkers[0])).toBeGreaterThan(ops.indexOf(whites[1]));
  });

  it('paints no fill over the water: the band is its lattice and its outline only, so the water and the snacks show through', () => {
    expect(ops.filter((op) => op.op === 'fill' && op.fillStyle !== PEBBLE_A)).toEqual([]);
    expect(ops.filter((op) => op.op === 'fillRect')).toEqual([]);
  });
});

describe('the billow bows only forward (guide 7p)', () => {
  const h = 240;
  const front = (bow: number, sway = 0): unknown[][] => cmdsOf(record((ctx) => paintDragNetCurtain(ctx, h, bow, sway)).ops.filter((op) => op.strokeStyle === DRAG_NET_EDGE)[1]);

  /** The x of the front's quadratic curve at t. */
  function frontX(cmds: unknown[][], t: number): number {
    const [, cx] = cmds[1] as [string, number, number, number, number];
    return 2 * t * (1 - t) * cx;
  }

  it.each([0, 1.5, 3, 6])('with a bow of %s px the front is that far forward at mid-depth and never behind the logic\'s front', (bow) => {
    const cmds = front(bow);
    expect(frontX(cmds, 0.5)).toBeCloseTo(bow, 9);
    for (let i = 0; i <= 100; i++) expect(frontX(cmds, i / 100)).toBeGreaterThanOrEqual(0);
    expect(cmds[0]).toEqual(['moveTo', 0, 0]);
    expect(cmds[1].slice(3)).toEqual([0, h]);
  });

  it.each([-5, -0.1, Number.NEGATIVE_INFINITY])('clamps a backward bow of %s to 0: what is drawn never falls short of what catches', (bow) => {
    expect(front(bow)).toEqual(front(0));
  });

  it('clamps a bow over 6 px to 6 px', () => {
    expect(front(99)).toEqual(front(DRAG_NET_BOW_MAX));
    expect(DRAG_NET_BOW_MAX).toBe(6);
  });

  it('sways the foot only, 3 px either way, and never the front: the front is the same at any sway', () => {
    expect(front(4, 3)).toEqual(front(4, -3));
    expect(front(4, 99)).toEqual(front(4, 3));
    const foot = (sway: number): unknown[][] => cmdsOf(record((ctx) => paintDragNetCurtain(ctx, h, 0, sway)).ops.filter((op) => op.strokeStyle === DRAG_NET_EDGE)[0]);
    expect(foot(3)[2]).toEqual(['lineTo', -37, h]);
    expect(foot(-3)[2]).toEqual(['lineTo', -43, h]);
    expect(foot(-99)[2]).toEqual(['lineTo', -43, h]);
    expect(foot(0)[3]).toEqual(['lineTo', 0, h]);
    expect(DRAG_NET_SWAY_MAX).toBe(3);
  });

  it('keeps the outline inside the frame at the full bow, and the frame is the same for every bow', () => {
    expect(dragNetCurtainTex(h)).toEqual(dragNetCurtainTex(h));
    for (const bow of [0, 6]) {
      const rec = record((ctx) => paintDragNetCurtain(ctx, h, bow, 3));
      expectPadded(rec.ops, dragNetCurtainTex(h), callsOf(rec, 'clip').map(([path]) => (path as unknown as { cmds: unknown[][] }).cmds));
    }
  });

  it('throws RangeError for a height that is not finite and greater than 0', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => dragNetCurtainTex(bad)).toThrow(RangeError);
      expect(() => record((ctx) => paintDragNetCurtain(ctx, bad))).toThrow(RangeError);
    }
  });
});

// ---------------------------------------------------------------------------
// Hollow shade
// ---------------------------------------------------------------------------

describe('the safe hollow shade (guide 3g, 7p)', () => {
  it('is a see-through wash over the hollow\'s rect from its top-left corner: the moored hulls\' shade at 0.5, no ink', () => {
    const { ops } = record((ctx) => paintDragNetHollowShade(ctx, 120, 64));
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('fillRect');
    expect(ops[0].args).toEqual([0, 0, 120, 64]);
    expect(ops[0].fillStyle).toBe('rgba(34,128,143,0.5)');
    expect(ops.filter(isStroke)).toEqual([]);
    expect(DRAG_NET_SHADE_ALPHA).toBe(0.5);
  });

  it('has a frame that is exactly the rect, anchored on its top-left corner', () => {
    expect(dragNetHollowShadeTex(120, 64)).toEqual({ w: 120, h: 64, originX: 0, originY: 0 });
    expect(() => dragNetHollowShadeTex(0, 64)).toThrow(RangeError);
    expect(() => dragNetHollowShadeTex(120, -1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Wriggle-out strands
// ---------------------------------------------------------------------------

describe('the wriggle-out strands (guide 7p)', () => {
  const { ops } = record(paintDragNetStrands);

  it('has the guide\'s frame, 64 x 48, anchored on the caught axolotl\'s centre', () => {
    expect(DRAG_NET_STRANDS_TEX).toEqual({ w: 64, h: 48, originX: 32, originY: 24 });
  });

  it('is four short white strands, 2 wide with 1 of ink a side, one in each quarter, ink first and then white', () => {
    expect(ops).toHaveLength(8);
    expect(ops.slice(0, 4).map((op) => [op.strokeStyle, op.lineWidth])).toEqual(Array(4).fill([INK, 4]));
    expect(ops.slice(4).map((op) => [op.strokeStyle, op.lineWidth])).toEqual(Array(4).fill([WHITE, 2]));
    const quarters = ops.slice(4).map((op) => {
      const box = tightBounds(cmdsOf(op));
      return [Math.sign(box.minX + box.maxX), Math.sign(box.minY + box.maxY)];
    });
    expect(quarters).toEqual([
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]);
  });

  it('draws only open strands, no fill: nothing closes round the axolotl, so it is never shown held or trapped', () => {
    expect(ops.filter(isFill)).toEqual([]);
    for (const op of ops) expect(cmdNames(op)).toEqual(['moveTo', 'quadraticCurveTo']);
    for (const op of ops) expect(cmdsOf(op).some((cmd) => cmd[0] === 'closePath')).toBe(false);
  });

  it('keeps clear of the centre, so no mesh line is drawn on the axolotl itself', () => {
    for (const op of ops) {
      const box = tightBounds(cmdsOf(op));
      expect(Math.min(Math.abs(box.minX), Math.abs(box.maxX))).toBeGreaterThanOrEqual(10);
    }
  });

  it('bends away from the centre: each strand ends further out than it starts, on both axes', () => {
    for (const op of ops.slice(4)) {
      const [[, sx, sy], [, , , ex, ey]] = cmdsOf(op) as [[string, number, number], [string, number, number, number, number]];
      expect(Math.abs(ex)).toBeGreaterThan(Math.abs(sx));
      expect(Math.abs(ey)).toBeGreaterThan(Math.abs(sy));
      expect(Math.sign(ex)).toBe(Math.sign(sx));
      expect(Math.sign(ey)).toBe(Math.sign(sy));
    }
  });
});

// ---------------------------------------------------------------------------
// Logic and motion numbers
// ---------------------------------------------------------------------------

describe('the numbers match the logic and the guide (src/logic/dragNets.ts)', () => {
  it('names the logic\'s element, the drag net', () => {
    expect(DRAG_NET.id).toBe('drag-net');
  });

  it('has the guide\'s motion numbers', () => {
    expect(DRAG_NET_MOTION).toEqual({
      quietBobPx: 1.5,
      quietBobPeriod: 2,
      riseLift: 5,
      riseFor: 0.4,
      leanRad: 0.12,
      billowPeriod: 0.8,
      liftFade: 0.3,
      settleFor: 0.4,
      catchWriggleFor: 0.8,
    });
  });
});
