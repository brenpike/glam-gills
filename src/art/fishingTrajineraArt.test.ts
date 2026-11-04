/**
 * Fishing trajinera looks (issue #108, Area 10; ND-1): the fishing hull, its rod, its shadow, the
 * float bead, the lure and the line frames (rest, bob and tug), headless. The painters run against a
 * recording context and a stub Path2D (the same approach as bailingBucketArt.test.ts): every fill and
 * stroke is kept with the style, width and alpha it was painted under. The tests check the frames,
 * the anchor points, the ink on every light fill, the contrast on the deep canal water, the
 * greyscale reading, that the art has no person, face, text or hook, and that the numbers match the
 * logic's (src/logic/lures.ts, src/logic/trajineras.ts).
 */
import { describe, expect, it, vi } from 'vitest';
// Loaded first on purpose: src/logic/zone.ts, lures.ts and trajineras.ts import each other, and only
// this order sets TRAJINERAS before lures.ts reads it (drawDeepCanal.ts pulls trajineras.ts in).
import { LURES, fishingBoatHull, fishingBoatSpawn, lureLine, lureStill } from '../logic/lures';
import {
  FISHING_BEAD_BOTTOM,
  FISHING_BEAD_R,
  FISHING_BEAD_TEX,
  FISHING_BEAD_TOP,
  FISHING_BOAT_BANDS,
  FISHING_BOAT_DEPTH,
  FISHING_BOAT_FLOWER_X,
  FISHING_BOAT_RISE_END,
  FISHING_BOAT_RISE_MID,
  FISHING_BOAT_TEX,
  FISHING_BOAT_W,
  FISHING_KNOT,
  FISHING_LINE_COLOUR,
  FISHING_LINE_W,
  FISHING_LURE_FRAME_DY,
  FISHING_LURE_TEX,
  FISHING_MOTION,
  FISHING_ROD_HOLDER,
  FISHING_ROD_TEX,
  FISHING_ROD_TIP,
  FISHING_SHADOW_ALPHA,
  FISHING_SHADOW_CY,
  FISHING_SHADOW_RX,
  FISHING_SHADOW_RY,
  FISHING_SHADOW_TEX,
  paintFishingBead,
  paintFishingBoat,
  paintFishingLine,
  paintFishingLure,
  paintFishingLureFrame,
  paintFishingRod,
  paintFishingShadow,
  type FishingLureFrame,
} from './drawFishingTrajinera';
import { ANCHOR_METAL } from './drawAnchorDrop';
import { TRAJINERA_SHADOW_RGB } from './drawDeepCanal';
import { paintBailingBoat } from './drawBailingBucket';
import { BOAT_ORANGE, BOAT_PINK, BOAT_TEAL, BOAT_YELLOW, POLE_WOOD } from './drawPuntingPole';
import { paintWorm, WORM_TEX } from './drawProps';
import { habitatLook } from './habitatLook';
import { EYE, INK, PEBBLE_A, PEBBLE_E, WHITE } from './palette';
import type { TexSize } from './canvasKit';
import { TRAJINERAS } from '../logic/trajineras';

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
  { name: 'fishing boat', paint: paintFishingBoat, tex: FISHING_BOAT_TEX },
  { name: 'fishing rod', paint: paintFishingRod, tex: FISHING_ROD_TEX },
  { name: 'float bead', paint: paintFishingBead, tex: FISHING_BEAD_TEX },
  { name: 'lure', paint: paintFishingLure, tex: FISHING_LURE_TEX },
];

const FRAMES: readonly FishingLureFrame[] = ['rest', 'bobUp', 'bobDown', 'tug'];

/** Every command a path in this look is made of: lines, curves and ellipses, with no spike, no hook and no arc. */
const ALLOWED_CMDS = ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'closePath', 'rect'];

/** Colours drawn inside a silhouette, so they need no ink of their own. */
const INNER_COLOURS = new Set<unknown>(['rgba(43,35,80,0.22)', 'rgba(255,255,255,0.5)']);

/** Every colour of the look, with the literal value written out here, never read from the source. */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['FISHING_BOAT_BANDS[0]', FISHING_BOAT_BANDS[0], '#ff6fa8'],
  ['FISHING_BOAT_BANDS[1]', FISHING_BOAT_BANDS[1], '#ffa23a'],
  ['FISHING_BOAT_BANDS[2]', FISHING_BOAT_BANDS[2], '#2fc7b8'],
  ['FISHING_BEAD_TOP', FISHING_BEAD_TOP, '#ffffff'],
  ['FISHING_BEAD_BOTTOM', FISHING_BEAD_BOTTOM, '#ff6fa8'],
  ['FISHING_LINE_COLOUR', FISHING_LINE_COLOUR, '#2b2350'],
  ['POLE_WOOD', POLE_WOOD, '#d9b27a'],
  ['PEBBLE_A', PEBBLE_A, '#d4cfe6'],
];

/** The fills that reach an outer edge, each with its written luminance and ratio against ink. */
const OUTER_FILLS: readonly (readonly [string, string, string, string])[] = [
  ['hull cream', '#fff0c9', '0.8718', '12.72'],
  ['bead top', FISHING_BEAD_TOP, '1.0000', '14.39'],
  ['rod wood', POLE_WOOD, '0.4800', '7.27'],
  ['lure worm', PEBBLE_E, '0.4999', '7.41'],
  ['holder ring', PEBBLE_A, '0.5911', '9.50'],
];

describe('fishing trajinera colours are the values written down', () => {
  it.each(DOCUMENTED_COLOURS)('%s is %s', (_name, constant, documented) => {
    expect(constant).toBe(documented);
  });
});

// ---------------------------------------------------------------------------
// Contrast (guide 3c, 10)
// ---------------------------------------------------------------------------

describe('contrast on the deep canal (guide 3c, 10)', () => {
  it.each(OUTER_FILLS)('%s reaches the outer edge: %s -> luminance %s, %s:1 with ink', (_name, fill, _lum, ratio) => {
    expect(contrast(fill, INK).toFixed(2)).toBe(ratio);
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
  });

  it('keeps the hull and the bead white 9:1 or better with ink, so they pass on any background', () => {
    expect(contrast('#fff0c9', INK)).toBeGreaterThanOrEqual(ANY_BACKGROUND_RATIO);
    expect(contrast(FISHING_BEAD_TOP, INK)).toBeGreaterThanOrEqual(ANY_BACKGROUND_RATIO);
  });

  it('holds ink at 3:1 or better on every water stop and bed stop of the deep canal', () => {
    const all = backgrounds();
    expect(all).toHaveLength(5);
    for (const { name, hex } of all) {
      expect(luminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('draws the line in ink 1.6 wide, opaque, 3:1 or better on every deep canal background', () => {
    const { ops } = record((ctx) => paintFishingLine(ctx, 0, -30, 0, 60));
    expect(ops).toHaveLength(1);
    expect(ops[0].strokeStyle).toBe(INK);
    expect(ops[0].lineWidth).toBe(1.6);
    expect(ops[0].globalAlpha).toBe(1);
    expect(FISHING_LINE_W).toBe(1.6);
    for (const { name, hex } of backgrounds()) expect(contrast(FISHING_LINE_COLOUR, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('gives every outer fill 3:1 or better from its ink or from itself on every deep canal background', () => {
    for (const { name, hex } of backgrounds()) {
      for (const [fillName, fill] of OUTER_FILLS) {
        expect(Math.max(contrast(INK, hex), contrast(fill, hex)), `${fillName} on ${name}`).toBeGreaterThanOrEqual(PAIR_FLOOR);
      }
    }
  });

  it('keeps the hull bands 4.5:1 or better with ink, so the ink lines between them read in greyscale', () => {
    for (const band of FISHING_BOAT_BANDS) expect(contrast(band, INK), band).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    expect(contrast(BOAT_YELLOW, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
  });

  it('paints no outer fill with alpha: only the seams and the shine inside the hull are see-through', () => {
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
    expectPadded(record(paint).ops, tex);
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

  it.each(PARTS.map((p) => [p.name, p.paint] as const))('inks the %s, and draws no eye of its own, text or image', (_name, paint) => {
    const { ops, calls } = record(paint);
    expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK && op.globalAlpha === 1)).toBe(true);
    // the lure is the snack worm, whose bead eyes are the snack's own
    if (paint !== paintFishingLure) expect(fillColours(ops)).not.toContain(EYE);
    expect(ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText' || op.op === 'drawImage')).toEqual([]);
    expect(calls.filter(([name]) => name === 'fillText' || name === 'strokeText')).toEqual([]);
  });

  it.each(PARTS.filter((p) => p.paint !== paintFishingLure).map((p) => [p.name, p.paint] as const))('gives every light fill of the %s ink: an opaque INK line on the same edge', (_name, paint) => {
    const { ops } = record(paint);
    for (const op of ops) {
      // a band is a rectangle clipped to the hull, whose own fill is inked
      if (op.op === 'fillRect') continue;
      const colour = isFill(op) ? op.fillStyle : isStroke(op) ? op.strokeStyle : null;
      if (typeof colour !== 'string' || !colour.startsWith('#') || colour === INK) continue;
      if (luminance(colour) < 0.4) continue;
      // the centre dots of the flowers and the tube colours are inked as a group below
      if (isStroke(op) && op.strokeStyle !== INK) {
        const wider = ops.some((o) => isStroke(o) && o.strokeStyle === INK && edgeOf(o) === edgeOf(op) && o.lineWidth > op.lineWidth);
        expect(wider, `${colour} tube`).toBe(true);
        continue;
      }
      if (colour === '#ffffff' && ellipsesOf(op)[0]?.[2] === 1.8) continue;
      const inked = ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.globalAlpha === 1 && edgeOf(o) === edgeOf(op));
      expect(inked, `${colour} ${op.op}`).toBe(true);
    }
  });

  it('paints every path of the whole look from lines, curves and ellipses, round-capped: nothing pointed', () => {
    for (const { paint } of PARTS) {
      for (const op of record(paint).ops) {
        for (const name of cmdNames(op)) expect(ALLOWED_CMDS, name).toContain(name);
        expect(op.lineCap).toBe('round');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Boat
// ---------------------------------------------------------------------------

describe('the fishing hull (guide 7p)', () => {
  const { ops, calls } = record(paintFishingBoat);
  const hull = ops.find((op) => op.op === 'fill' && op.fillStyle === '#fff0c9') as Op;

  it('is one whole hull as long as the gliding trajinera, middle-anchored on the water line', () => {
    expect(hull).toBeDefined();
    expect(FISHING_BOAT_W).toBe(120);
    expect(FISHING_BOAT_W).toBe(TRAJINERAS.hullLength);
    expect(FISHING_BOAT_W).toBe(LURES.hullLength);
    const box = tightBounds(cmdsOf(hull));
    expect([box.minX, box.maxX]).toEqual([-FISHING_BOAT_W / 2, FISHING_BOAT_W / 2]);
    expect(box.minY).toBe(-FISHING_BOAT_RISE_END);
    expect(box.maxY).toBe(FISHING_BOAT_DEPTH);
    expect(FISHING_BOAT_RISE_END).toBe(15);
    expect(FISHING_BOAT_RISE_MID).toBe(8);
    expect(calls.filter(([name]) => name === 'clip')).toHaveLength(1);
  });

  it('has the guide\'s frame, 132 x 62 with x -66 to 66 and y -38 to 24, the hull\'s anchor in it', () => {
    expect(FISHING_BOAT_TEX).toEqual({ w: 132, h: 62, originX: 66, originY: 38 });
    expect(frameBox(FISHING_BOAT_TEX)).toEqual({ minX: -66, minY: -38, maxX: 66, maxY: 24 });
  });

  it('has a gunwale that is 15 px up at the ends and 8 px up in the middle: its curve control point is -1', () => {
    const curve = cmdsOf(hull).filter((cmd) => cmd[0] === 'quadraticCurveTo').pop() as [string, number, number, number, number];
    expect(curve.slice(1)).toEqual([0, -1, 60, -15]);
    expect(0.5 * -15 + 0.5 * curve[2]).toBe(-FISHING_BOAT_RISE_MID);
  });

  it('has three bands, pink, orange and teal top to bottom, kept apart by three ink lines of 2', () => {
    const bands = ops.filter((op) => op.op === 'fillRect').map((op) => op.fillStyle);
    expect(bands).toEqual(['#ff6fa8', '#ffa23a', '#2fc7b8']);
    expect([...FISHING_BOAT_BANDS]).toEqual([BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]);
    const inkLines = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 && cmdNames(op).join() === 'moveTo,lineTo');
    expect(inkLines).toHaveLength(3);
    expect(inkLines.map((op) => (cmdsOf(op)[0] as number[])[2])).toEqual([-3, 3, 9]);
    // the bands, the seams and the lines are all clipped to the hull
    for (const op of ops.filter((o) => o.op === 'fillRect')) expect(op.clipped).toBe(1);
  });

  it('draws plank seams in alpha and never in ink', () => {
    const seams = ops.filter((op) => isStroke(op) && op.strokeStyle === 'rgba(43,35,80,0.22)');
    expect(seams).toHaveLength(4);
  });

  it('inks the hull all round with an opaque INK line of 2.8 after the bands', () => {
    const outline = ops.find((op) => isStroke(op) && op.strokeStyle === INK && Math.abs(op.lineWidth - 2.8) < 1e-9) as Op;
    expect(outline).toBeDefined();
    expect(JSON.stringify(cmdsOf(outline))).toBe(JSON.stringify(cmdsOf(hull)));
    expect(ops.indexOf(outline)).toBeGreaterThan(ops.findIndex((op) => op.op === 'fillRect'));
  });

  it('has one rail shine, in alpha', () => {
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === 'rgba(255,255,255,0.5)')).toHaveLength(1);
  });

  it('has three rail flowers at x -30, 0 and 30: radius 5, ink 2.4, pink, yellow and pink, with white centres of 1.8', () => {
    expect([...FISHING_BOAT_FLOWER_X]).toEqual([-30, 0, 30]);
    const petals = ops.filter((op) => op.op === 'fill' && ellipsesOf(op).length === 1 && ellipsesOf(op)[0][2] === 5 && op.fillStyle !== '#ffa23a');
    expect(petals.map((op) => op.fillStyle)).toEqual(['#ff6fa8', '#ffe14a', '#ff6fa8']);
    expect(petals.map((op) => ellipsesOf(op)[0][0])).toEqual([-30, 0, 30]);
    for (const op of petals) {
      const inked = ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.lineWidth === 2.4 && edgeOf(o) === edgeOf(op));
      expect(inked).toBe(true);
    }
    const centres = ops.filter((op) => op.op === 'fill' && op.fillStyle === WHITE && ellipsesOf(op)[0]?.[2] === 1.8);
    expect(centres).toHaveLength(3);
    // each flower sits on the rail, above the gunwale
    for (const op of petals) expect(ellipsesOf(op)[0][1]).toBeLessThan(-FISHING_BOAT_RISE_MID + 1);
  });

  it('has a prow ball on each end: radius 5, orange, ink 1.8, inside the hull\'s end', () => {
    const balls = ops.filter((op) => op.op === 'fill' && op.fillStyle === '#ffa23a' && ellipsesOf(op).length === 1);
    expect(balls).toHaveLength(2);
    expect(balls.map((op) => Math.sign(ellipsesOf(op)[0][0])).sort()).toEqual([-1, 1]);
    for (const op of balls) {
      expect(ellipsesOf(op)[0][2]).toBe(5);
      expect(Math.abs(ellipsesOf(op)[0][0]) + 5).toBeLessThanOrEqual(FISHING_BOAT_W / 2);
      expect(ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.lineWidth === 1.8 && edgeOf(o) === edgeOf(op))).toBe(true);
    }
  });

  it('has no post, no flower arch and no rod, so it is told from the gliding trajinera and the bailing boat by shape', () => {
    const box = allBounds(ops);
    // the bailing boat's post rises to -30 and the gliding arch to -49; nothing here rises above the rail flowers
    expect(box.minY).toBeGreaterThan(-20);
    expect(box.minY).toBeGreaterThan(allBounds(record(paintBailingBoat).ops).minY);
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === POLE_WOOD)).toEqual([]);
  });

  it('shows no person, hand, face or text: no ellipse is bigger than a flower or a prow ball', () => {
    for (const op of ops) for (const e of ellipsesOf(op)) expect(e[2]).toBeLessThanOrEqual(5);
    expect(calls.filter(([name]) => name === 'fillText' || name === 'strokeText')).toEqual([]);
  });

  it('is double-ended: the same either way round, so it is never mirrored', () => {
    const cmds = cmdsOf(hull);
    const xs = cmds.filter((cmd) => cmd[0] === 'moveTo' || cmd[0] === 'lineTo').map((cmd) => Math.abs(cmd[1] as number));
    expect(Math.max(...xs)).toBe(60);
    expect(ops.filter((op) => op.op === 'fill' && ellipsesOf(op).length === 1 && op.fillStyle === '#ffa23a')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Rod
// ---------------------------------------------------------------------------

describe('the fishing rod (guide 7p)', () => {
  const { ops } = record(paintFishingRod);

  it('is a straight wood tube 3 wide with 1.2 of ink a side, leaning to +x from the holder at the origin', () => {
    const ink = ops.find((op) => isStroke(op) && op.strokeStyle === INK) as Op;
    const wood = ops.find((op) => isStroke(op) && op.strokeStyle === POLE_WOOD) as Op;
    expect(wood.lineWidth).toBe(3);
    expect(ink.lineWidth).toBeCloseTo(3 + 2 * 1.2, 9);
    expect(cmdNames(wood)).toEqual(['moveTo', 'lineTo']);
    expect(cmdsOf(wood)).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 16, -18],
    ]);
    expect(ops.indexOf(ink)).toBeLessThan(ops.indexOf(wood));
  });

  it('rises at a slope of 1.125, its tip right over the hull\'s end and 30 px above the water line', () => {
    expect(FISHING_ROD_HOLDER).toEqual({ x: 44, y: -12 });
    expect(FISHING_ROD_TIP).toEqual({ x: 60, y: -30 });
    expect(FISHING_ROD_TIP.x).toBe(FISHING_BOAT_W / 2);
    expect(FISHING_ROD_HOLDER.x).toBe(FISHING_BOAT_W / 2 - 16);
    const wood = ops.find((op) => isStroke(op) && op.strokeStyle === POLE_WOOD) as Op;
    const [, [, x, y]] = cmdsOf(wood) as [unknown, [string, number, number]];
    expect(-y / x).toBeCloseTo(1.125, 9);
    expect(FISHING_ROD_HOLDER.x + x).toBe(FISHING_ROD_TIP.x);
    expect(FISHING_ROD_HOLDER.y + y).toBe(FISHING_ROD_TIP.y);
  });

  it('is held by a pebble A ring of radius 2 with ink 1.2 on the gunwale at the anchor', () => {
    const ring = ops.find((op) => op.op === 'fill') as Op;
    expect(ring.fillStyle).toBe(PEBBLE_A);
    expect(ellipsesOf(ring)[0].slice(0, 4)).toEqual([0, 0, 2, 2]);
    expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1.2 && edgeOf(op) === edgeOf(ring))).toBe(true);
    // the holder sits on the gunwale: 44 px from the middle, 12 px up (the gunwale is 11.8 up there)
    expect(FISHING_ROD_HOLDER.y).toBeGreaterThan(-FISHING_BOAT_RISE_END);
    expect(FISHING_ROD_HOLDER.y).toBeLessThan(-FISHING_BOAT_RISE_MID);
  });

  it('draws no reel, hand or hook: one inked tube and one inked ring, and nothing else', () => {
    expect(ops).toHaveLength(4);
    expect(ops.filter(isFill)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

describe('the fishing shadow (guide 3g, 7p)', () => {
  const rec = record(paintFishingShadow);

  it('is one see-through ellipse, radii 64 x 12, centred 32 px under the water line, from 20 to 44 px under it', () => {
    expect([FISHING_SHADOW_RX, FISHING_SHADOW_RY, FISHING_SHADOW_CY]).toEqual([64, 12, 32]);
    expect(rec.ops).toHaveLength(1);
    expect(rec.ops[0].op).toBe('fill');
    expect(callsOf(rec, 'translate')).toEqual([[0, 32]]);
    expect(callsOf(rec, 'scale')).toEqual([[1, 12 / 64]]);
    expect(ellipsesOf(rec.ops[0])[0].slice(0, 4)).toEqual([0, 0, 64, 64]);
    expect(FISHING_SHADOW_CY - FISHING_SHADOW_RY).toBe(20);
    expect(FISHING_SHADOW_CY + FISHING_SHADOW_RY).toBe(44);
  });

  it('fades from deep blue at alpha 0.32 in the middle to 0 at its rim, with no ink, halo or chevron', () => {
    const grad = rec.ops[0].fillStyle as Gradient;
    expect(grad.kind).toBe('gradient');
    expect(grad.args).toEqual([0, 0, 0, 0, 0, 64]);
    const [r, g, b] = TRAJINERA_SHADOW_RGB;
    expect(grad.stops).toEqual([
      [0, `rgba(${r},${g},${b},0.32)`],
      [1, `rgba(${r},${g},${b},0)`],
    ]);
    expect(FISHING_SHADOW_ALPHA).toBe(0.32);
    expect(rec.ops.filter(isStroke)).toEqual([]);
    expect(rec.calls.filter(([name]) => name === 'stroke')).toEqual([]);
  });

  it('has the guide\'s frame, 140 x 36, with the hull\'s anchor above it', () => {
    expect(FISHING_SHADOW_TEX).toEqual({ w: 140, h: 36, originX: 70, originY: -14 });
    const frame = frameBox(FISHING_SHADOW_TEX);
    expect(frame.minY).toBe(14);
    expect(frame.maxY).toBe(50);
    expect(FISHING_SHADOW_CY - FISHING_SHADOW_RY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - (FISHING_SHADOW_CY + FISHING_SHADOW_RY)).toBeGreaterThanOrEqual(MIN_PAD);
    expect(FISHING_SHADOW_RX + frame.minX).toBeLessThanOrEqual(-MIN_PAD + 2 * FISHING_SHADOW_RX);
    expect(frame.maxX - FISHING_SHADOW_RX).toBeGreaterThanOrEqual(MIN_PAD);
  });

  it('spans about the hull\'s own length: a line at a hull end crosses only its faded rim', () => {
    expect(FISHING_SHADOW_RX - FISHING_ROD_TIP.x).toBeLessThanOrEqual(4);
    // the pool's alpha where a hull-end line crosses its middle: the radial fade at FISHING_ROD_TIP.x
    expect(FISHING_SHADOW_ALPHA * (1 - FISHING_ROD_TIP.x / FISHING_SHADOW_RX)).toBeLessThan(0.03);
  });

  it('keeps the deep canal floor under it: over the shallow stop even its darkest point is above 0.1687', () => {
    const [r, g, b] = TRAJINERA_SHADOW_RGB;
    const [sr, sg, sb] = channelsOf(habitatLook('deep-canal').water.shallow);
    const blend = (bg: number, over: number): number => Math.round(bg * (1 - FISHING_SHADOW_ALPHA) + over * FISHING_SHADOW_ALPHA);
    const hex = `#${[blend(sr, r), blend(sg, g), blend(sb, b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    expect(luminance(hex)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });
});

// ---------------------------------------------------------------------------
// Float bead
// ---------------------------------------------------------------------------

describe('the float bead (guide 7p)', () => {
  const { ops } = record(paintFishingBead);

  it('is a ball of radius 4.5 at the anchor, white over pink, with ink 1.6 round it', () => {
    expect(FISHING_BEAD_R).toBe(4.5);
    const white = ops.find((op) => op.op === 'fill' && op.fillStyle === WHITE) as Op;
    expect(ellipsesOf(white)[0].slice(0, 4)).toEqual([0, 0, 4.5, 4.5]);
    const pink = ops.find((op) => op.op === 'fill' && op.fillStyle === BOAT_PINK) as Op;
    expect(edgeOf(pink)).toBe(edgeOf(white));
    expect(pink.clipped).toBe(1);
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1.6 && edgeOf(op) === edgeOf(white))).toHaveLength(2);
  });

  it('is split by an ink line of 1.2 across its middle, the pink below', () => {
    const split = ops.find((op) => isStroke(op) && op.lineWidth === 1.2) as Op;
    expect(split.strokeStyle).toBe(INK);
    expect(cmdsOf(split)).toEqual([
      ['moveTo', -4.5, 0],
      ['lineTo', 4.5, 0],
    ]);
    const rec = record(paintFishingBead);
    const clip = (callsOf(rec, 'clip')[0][0] as unknown as { cmds: unknown[][] }).cmds;
    const box = tightBounds(clip);
    expect(box.minY).toBe(0);
    expect(box.maxY).toBeGreaterThan(4.5);
  });

  it('has halves that are 2.60:1 apart, so the split reads in greyscale', () => {
    expect(contrast(FISHING_BEAD_TOP, FISHING_BEAD_BOTTOM).toFixed(2)).toBe('2.60');
    expect(contrast(FISHING_BEAD_TOP, INK).toFixed(2)).toBe('14.39');
    expect(contrast(FISHING_BEAD_BOTTOM, INK).toFixed(2)).toBe('5.55');
  });
});

// ---------------------------------------------------------------------------
// Lure and line frames
// ---------------------------------------------------------------------------

describe('the lure (guide 7p)', () => {
  const lure = record(paintFishingLure);
  const worm = record(paintWorm);

  it('is the snack worm as it is, plus one ink knot dot: the same strokes and fills first, one extra fill last', () => {
    expect(FISHING_LURE_TEX).toBe(WORM_TEX);
    expect(lure.ops).toHaveLength(worm.ops.length + 1);
    expect(JSON.stringify(lure.ops.slice(0, worm.ops.length))).toBe(JSON.stringify(worm.ops));
  });

  it('ties the line on with an ink knot dot of radius 1.4 at (1, -4.8), the top of the tube at its bend', () => {
    expect(FISHING_KNOT).toEqual({ x: 1, y: -4.8, r: 1.4 });
    const knot = lure.ops[lure.ops.length - 1];
    expect(knot.op).toBe('fill');
    expect(knot.fillStyle).toBe(INK);
    expect(ellipsesOf(knot)[0].slice(0, 4)).toEqual([1, -4.8, 1.4, 1.4]);
  });

  it('draws no hook, barb, point, spinner, weight or metal: only the worm\'s own curves and colours, and the knot', () => {
    const allowed = new Set<unknown>([...worm.ops.map((op) => (isFill(op) ? op.fillStyle : op.strokeStyle)), INK]);
    for (const op of lure.ops) {
      expect(allowed.has(isFill(op) ? op.fillStyle : op.strokeStyle)).toBe(true);
      for (const name of cmdNames(op)) expect(['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'ellipse']).toContain(name);
    }
    expect(JSON.stringify(lure.ops)).not.toContain(ANCHOR_METAL);
    // one knot only: exactly one ellipse is added to the worm's own
    const ellipses = (r: Recording): number => r.ops.reduce((n, op) => n + ellipsesOf(op).length, 0);
    expect(ellipses(lure) - ellipses(worm)).toBe(1);
  });

  it('is a mid-tone worm in greyscale, as every snack: between the dark line and the white bead', () => {
    expect(luminance(PEBBLE_E)).toBeGreaterThan(luminance(INK) + 0.3);
    expect(luminance(PEBBLE_E)).toBeLessThan(luminance(FISHING_BEAD_TOP) - 0.3);
  });
});

describe('the line and the lure frames: rest, bob and tug (guide 7p)', () => {
  it('names a lure frame by its offset along the line: rest 0, the bob\'s two ends and the tug 10 px up', () => {
    expect(FISHING_LURE_FRAME_DY.rest).toBe(0);
    expect(FISHING_LURE_FRAME_DY.bobUp).toBe(-FISHING_LURE_FRAME_DY.bobDown);
    expect(FISHING_LURE_FRAME_DY.bobDown).toBe(LURES.bobAmplitude);
    expect(FISHING_LURE_FRAME_DY.tug).toBe(-10);
    expect(FISHING_MOTION.tugPx).toBe(10);
    expect(FISHING_MOTION.bobPx).toBe(LURES.bobAmplitude);
    expect(FISHING_MOTION.bobPeriod).toBe(LURES.bobPeriod);
  });

  it('has the motion numbers of the guide: a 0.25 s jerk, a 0.4 s wriggle, the reel at 200 px/s and the reduced fades', () => {
    expect(FISHING_MOTION.tugFor).toBe(0.25);
    expect(FISHING_MOTION.wriggleFor).toBe(0.4);
    expect(FISHING_MOTION.reelSpeed).toBe(200);
    expect(FISHING_MOTION.reelFade).toBe(0.2);
    expect(FISHING_MOTION.reducedFadeOut).toBe(0.3);
    expect(FISHING_MOTION.reducedFadeIn).toBe(0.5);
    expect(FISHING_MOTION.hullBobPx).toBe(1.5);
    expect(FISHING_MOTION.hullBobPeriod).toBe(3);
  });

  it('puts the rod tip over a lure the logic hangs at a hull end, and draws the line at the lure\'s own x', () => {
    const bounds = { minX: 0, maxX: 2000, minY: 0, maxY: 1000 };
    const boat = fishingBoatSpawn('boat', 3, { x0: 400, x1: 700, lures: [{ along: 0, depth: 200 }, { along: LURES.hullLength, depth: 160 }] }, bounds);
    expect(FISHING_BOAT_W).toBe(LURES.hullLength);
    for (const t of [0, 4.5, 11]) {
      const hull = fishingBoatHull(boat, t);
      const middle = (hull.x0 + hull.x1) / 2;
      expect(lureStill(boat, 0, t).x - middle).toBe(-FISHING_ROD_TIP.x);
      expect(lureStill(boat, 1, t).x - middle).toBe(FISHING_ROD_TIP.x);
      // the logic's line is upright at the lure's x, as the art draws it: no fixed offset along the hull
      const status = { id: boat.lures[0].id, up: false, upLeft: 0 };
      const { from, to } = lureLine(boat, 0, status, t, true);
      expect(from.x).toBe(to.x);
      expect(from.x).toBe(lureStill(boat, 0, t).x);
    }
  });

  it.each(FRAMES)('draws the %s frame: one straight upright INK line from the rod tip to the lure, then the lure over its end', (frame) => {
    const rec = record((ctx) => paintFishingLureFrame(ctx, frame, 80));
    const dy = FISHING_LURE_FRAME_DY[frame];
    const first = rec.ops[0];
    expect(isStroke(first)).toBe(true);
    expect(first.strokeStyle).toBe(INK);
    expect(first.lineWidth).toBe(1.6);
    expect(first.globalAlpha).toBe(1);
    expect(cmdsOf(first)).toEqual([
      ['moveTo', 0, -80],
      ['lineTo', 0, dy],
    ]);
    // the lure follows the line, translated by the same offset, and nothing else is a line
    expect(callsOf(rec, 'translate')).toEqual([[0, dy]]);
    expect(rec.ops.length).toBe(1 + record(paintFishingLure).ops.length);
    expect(rec.ops.slice(1).filter((op) => isStroke(op) && op.strokeStyle === INK && cmdNames(op).join() === 'moveTo,lineTo')).toEqual([]);
  });

  it('keeps the line\'s top at the rod tip in every frame and shortens it as the lure goes up', () => {
    const lengths = FRAMES.map((frame) => {
      const first = record((ctx) => paintFishingLureFrame(ctx, frame, 80)).ops[0];
      const [[, , y0], [, , y1]] = cmdsOf(first) as [[string, number, number], [string, number, number]];
      expect(y0).toBe(-80);
      return y1 - y0;
    });
    // rest, bobUp, bobDown, tug
    expect(lengths[3]).toBeLessThan(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[0]);
    expect(lengths[0]).toBeLessThan(lengths[2]);
  });

  it('has no hook, point or weight on the line: no fill, no extra stroke and no curve in it', () => {
    const rec = record((ctx) => paintFishingLine(ctx, 0, -30, 0, 70));
    expect(rec.ops).toHaveLength(1);
    expect(cmdNames(rec.ops[0])).toEqual(['moveTo', 'lineTo']);
    expect(rec.ops.filter(isFill)).toEqual([]);
  });
});
