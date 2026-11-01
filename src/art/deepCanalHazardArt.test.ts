/**
 * Anchor drop and mud seep looks (issue #194): the bow, shadow (warning cue), shaft and ring of
 * each, headless. The painters run against a recording context and a stub Path2D (the same approach
 * as movingHazardArt.test.ts): every fill and stroke is kept with the style, width and alpha it was
 * painted under. The tests check the frames, the shaft widths and lengths, the anchor points and the
 * way the art runs, the ink on every light fill, the contrast on the deep canal and chinampa water,
 * and that the cue shapes differ from every other cue in the game.
 *
 * No logic types are imported: the logic's widths and depths are written out here as local
 * constants (the anchor drop's halfWidth 5 and deepest depth 320, the mud seep's halfWidth 10 and
 * deepest depth 260). The cross-checks against the logic belong to the look-table tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ANCHOR_ART_DEPTH,
  ANCHOR_BOAT_RIM,
  ANCHOR_BOAT_SEAM,
  ANCHOR_BOAT_WOOD,
  ANCHOR_BOW_DIP,
  ANCHOR_BOW_HALF_L,
  ANCHOR_BOW_RISE,
  ANCHOR_BOW_TEX,
  ANCHOR_CHAIN_W,
  ANCHOR_CUE_ALONG,
  ANCHOR_CUE_TEX,
  ANCHOR_LINK_COUNT,
  ANCHOR_LINK_CUE,
  ANCHOR_LINK_PITCH,
  ANCHOR_METAL,
  ANCHOR_REST_BACK,
  ANCHOR_RING,
  ANCHOR_RING_ALONG,
  ANCHOR_RING_LINES,
  ANCHOR_RING_TEX,
  ANCHOR_RUST,
  ANCHOR_SHAFT_LENGTH,
  ANCHOR_SHAFT_PAST_BASE,
  ANCHOR_SHAFT_TEX,
  paintAnchorBow,
  paintAnchorCue,
  paintAnchorRing,
  paintAnchorShaft,
} from './drawAnchorDrop';
import {
  MUD_ART_DEPTH,
  MUD_BUBBLE_COUNT,
  MUD_BUBBLE_HALF_WIDTH,
  MUD_BUBBLE_R,
  MUD_BUBBLE_SPACING,
  MUD_COLUMN_LENGTH,
  MUD_COLUMN_TEX,
  MUD_FLAKES,
  MUD_FLAKES_TEX,
  MUD_FOOT_DROP,
  MUD_FOOT_HALF_W,
  MUD_MOUND_TEX,
  MUD_MOUTH_HALF_W,
  MUD_MOUTH_RISE,
  MUD_REST_BACK,
  MUD_RING_ALONG,
  MUD_RING_POINTS,
  MUD_RING_RX,
  MUD_RING_RY,
  MUD_RING_TEX,
  MUD_SEEP_BUBBLE,
  MUD_SEEP_CRACK,
  MUD_SEEP_FLAKE,
  MUD_SEEP_MOUND,
  MUD_SEEP_MOUND_LIGHT,
  MUD_SEEP_MOUTH,
  MUD_SEEP_RING,
  MUD_SEEP_SHINE,
  MUD_SHADOW_ALONG,
  MUD_SHAFT_PAST_BASE,
  mudRingCorners,
  paintMudColumn,
  paintMudFlakes,
  paintMudMound,
  paintMudRing,
} from './drawMudSeep';
import { paintCarpPuff, paintCarpPuffStill } from './drawCarp';
import { paintTrajineraHull } from './drawDeepCanal';
import { paintProtectedHalo } from './drawEffects';
import { paintGarterRipple } from './drawGarterSnake';
import { paintGeyserBubbles, paintGeyserRing } from './drawGeyserVent';
import { paintVentBubble } from './drawPebbleRoom';
import { BOAT_FLOWER_CENTRE, BOAT_HULL, BOAT_ORANGE, BOAT_PINK, BOAT_TEAL, BOAT_YELLOW, paintPuntingBow, paintPuntingRing, paintPuntingShadow } from './drawPuntingPole';
import { paintDripDrop, paintDripRing } from './drawStalactite';
import { habitatLook } from './habitatLook';
import { EYE, INK, WHITE } from './palette';
import type { TexSize } from './canvasKit';

vi.mock('phaser', () => ({}));

/** The logic's numbers, written out (STEP-004 cross-checks them against the logic). */
const ANCHOR_HALF_WIDTH = 5;
const ANCHOR_DEEPEST = 320;
const MUD_HALF_WIDTH = 10;
const MUD_DEEPEST = 260;

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
const EPS = 1e-9;

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

/**
 * Every colour the two looks are seen on, the water stops of the deep canal and the chinampa, and
 * their bed stops (the mound, the crack ring and the flakes sit on the bed; guide 3c, 10).
 */
function backgrounds(): { name: string; hex: string; water: boolean }[] {
  const out: { name: string; hex: string; water: boolean }[] = [];
  for (const id of ['deep-canal', 'chinampa']) {
    const look = habitatLook(id);
    for (const stop of ['shallow', 'mid', 'deep'] as const) out.push({ name: `${id} water ${stop}`, hex: look.water[stop], water: true });
    out.push({ name: `${id} bed top`, hex: look.bed.top, water: false }, { name: `${id} bed bottom`, hex: look.bed.bottom, water: false });
  }
  return out;
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
const cmdsOf = (op: Op): unknown[][] => op.args[0] as unknown[][];
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

const ANCHOR_PARTS: readonly Part[] = [
  { name: 'anchor bow', paint: paintAnchorBow, tex: ANCHOR_BOW_TEX },
  { name: 'anchor cue', paint: paintAnchorCue, tex: ANCHOR_CUE_TEX },
  { name: 'anchor shaft', paint: paintAnchorShaft, tex: ANCHOR_SHAFT_TEX },
  { name: 'anchor ripple lines', paint: paintAnchorRing, tex: ANCHOR_RING_TEX },
];

const MUD_PARTS: readonly Part[] = [
  { name: 'mud mound', paint: paintMudMound, tex: MUD_MOUND_TEX },
  { name: 'mud flakes', paint: paintMudFlakes, tex: MUD_FLAKES_TEX },
  { name: 'mud column', paint: paintMudColumn, tex: MUD_COLUMN_TEX },
  { name: 'mud crack ring', paint: paintMudRing, tex: MUD_RING_TEX },
];

const PARTS: readonly Part[] = [...ANCHOR_PARTS, ...MUD_PARTS];

/** Colours drawn inside a silhouette, so they need no ink of their own. */
const INNER_COLOURS = new Set<unknown>([
  ANCHOR_BOAT_RIM,
  ANCHOR_BOAT_SEAM,
  ANCHOR_RUST,
  MUD_SEEP_MOUND_LIGHT,
  MUD_SEEP_CRACK,
  MUD_SEEP_MOUTH,
  MUD_SEEP_SHINE,
]);

/** Every colour of the two looks, with the literal value written out here, never read from the source. */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['ANCHOR_BOAT_WOOD', ANCHOR_BOAT_WOOD, '#ecd4a2'],
  ['ANCHOR_BOAT_RIM', ANCHOR_BOAT_RIM, '#fbf0d2'],
  ['ANCHOR_BOAT_SEAM', ANCHOR_BOAT_SEAM, 'rgba(120,84,44,0.55)'],
  ['ANCHOR_METAL', ANCHOR_METAL, '#d3dae4'],
  ['ANCHOR_RUST', ANCHOR_RUST, '#b98f6c'],
  ['ANCHOR_LINK_CUE', ANCHOR_LINK_CUE, '#ffffff'],
  ['ANCHOR_RING', ANCHOR_RING, '#ffffff'],
  ['MUD_SEEP_MOUND', MUD_SEEP_MOUND, '#e2cfa6'],
  ['MUD_SEEP_MOUND_LIGHT', MUD_SEEP_MOUND_LIGHT, '#f2e6c8'],
  ['MUD_SEEP_CRACK', MUD_SEEP_CRACK, '#a9895b'],
  ['MUD_SEEP_MOUTH', MUD_SEEP_MOUTH, '#4a3626'],
  ['MUD_SEEP_BUBBLE', MUD_SEEP_BUBBLE, '#efe3c4'],
  ['MUD_SEEP_SHINE', MUD_SEEP_SHINE, 'rgba(255,255,255,0.9)'],
  ['MUD_SEEP_FLAKE', MUD_SEEP_FLAKE, '#ead9b4'],
  ['MUD_SEEP_RING', MUD_SEEP_RING, '#f1e6c8'],
];

/** The fills that reach an outer edge, each with its written luminance and ratio against ink. */
const OUTER_FILLS: readonly (readonly [string, string, string, string])[] = [
  ['ANCHOR_BOAT_WOOD', ANCHOR_BOAT_WOOD, '0.6753', '9.94'],
  ['ANCHOR_METAL', ANCHOR_METAL, '0.6959', '10.23'],
  ['ANCHOR_LINK_CUE', ANCHOR_LINK_CUE, '1.0000', '14.39'],
  ['ANCHOR_RING', ANCHOR_RING, '1.0000', '14.39'],
  ['MUD_SEEP_MOUND', MUD_SEEP_MOUND, '0.6355', '9.40'],
  ['MUD_SEEP_BUBBLE', MUD_SEEP_BUBBLE, '0.7727', '11.28'],
  ['MUD_SEEP_FLAKE', MUD_SEEP_FLAKE, '0.7041', '10.34'],
  ['MUD_SEEP_RING', MUD_SEEP_RING, '0.7946', '11.58'],
];

describe('anchor drop and mud seep colours are the values written down', () => {
  it.each(DOCUMENTED_COLOURS)('%s is %s', (_name, constant, documented) => {
    expect(constant).toBe(documented);
  });
});

// ---------------------------------------------------------------------------
// Contrast (guide 3c, 10)
// ---------------------------------------------------------------------------

describe('contrast on the deep canal and the chinampa (guide 3c, 10)', () => {
  it.each(OUTER_FILLS)('%s reaches the outer edge: luminance %s, %s:1 with ink, 9:1 or better so it passes on any background', (_name, fill, lum, ratio) => {
    expect(luminance(fill).toFixed(4)).toBe(lum);
    expect(contrast(fill, INK).toFixed(2)).toBe(ratio);
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(ANY_BACKGROUND_RATIO);
  });

  it('holds ink at 3:1 or better on every water stop of the deep canal and the chinampa, and on their beds', () => {
    const all = backgrounds();
    expect(all).toHaveLength(10);
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

  it('keeps the pale fills lighter than every water stop and bed stop but the two light shallow waters, where the ink outline carries them', () => {
    for (const { name, hex } of backgrounds().filter((b) => luminance(b.hex) < 0.6)) {
      for (const fill of [MUD_SEEP_BUBBLE, MUD_SEEP_FLAKE, MUD_SEEP_MOUND, MUD_SEEP_RING, ANCHOR_METAL, ANCHOR_BOAT_WOOD]) {
        expect(luminance(fill), name).toBeGreaterThan(luminance(hex));
      }
    }
  });

  it('paints no outer fill with alpha: only fills inside a silhouette are see-through', () => {
    for (const { ops } of PARTS.map((p) => record(p.paint))) {
      expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
      for (const op of ops.filter(isFill)) {
        const colour = op.fillStyle as string;
        if (colour.startsWith('rgba')) expect(INNER_COLOURS.has(colour), colour).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

describe('frames (guide 10)', () => {
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
      const colour = isFill(op) ? op.fillStyle : isStroke(op) ? op.strokeStyle : null;
      if (typeof colour !== 'string' || !colour.startsWith('#') || colour === INK || INNER_COLOURS.has(colour)) continue;
      if (luminance(colour) < 0.4) continue;
      const inked = ops.some((o) => isStroke(o) && o.strokeStyle === INK && o.globalAlpha === 1 && edgeOf(o) === edgeOf(op));
      expect(inked, `${colour} ${op.op}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Anchor drop: bow
// ---------------------------------------------------------------------------

describe('the canoe bow (anchor drop; guide 4, 5, 10; ADR 0007)', () => {
  const { ops, calls } = record(paintAnchorBow);
  const hull = ops.find((op) => isFill(op) && op.fillStyle === ANCHOR_BOAT_WOOD) as Op;

  it('is one plain wooden hull: its own palette only, no painted bands, flowers, arch, person or face', () => {
    const palette = new Set<unknown>([ANCHOR_BOAT_WOOD]);
    for (const colour of fillColours(ops)) expect(palette.has(colour), String(colour)).toBe(true);
    expect(ops.filter((op) => op.op === 'fillRect')).toEqual([]);
    expect(calls.filter(([name]) => name === 'clip')).toHaveLength(1);
    expect(fillColours(ops)).toHaveLength(1);
  });

  it('shares no colour with the punting pole\'s trajinera bow or Area 8\'s gliding trajinera', () => {
    const boat = new Set<unknown>([BOAT_HULL, BOAT_PINK, BOAT_ORANGE, BOAT_TEAL, BOAT_YELLOW, BOAT_FLOWER_CENTRE]);
    expect(boat.has(ANCHOR_BOAT_WOOD)).toBe(false);
    for (const other of [paintPuntingBow, paintTrajineraHull]) {
      const theirs = new Set(record(other).ops.map((op) => (isFill(op) ? op.fillStyle : op.strokeStyle)));
      const mine = new Set(ops.map((op) => (isFill(op) ? op.fillStyle : op.strokeStyle)));
      for (const colour of mine) {
        if (colour === INK) continue;
        expect(theirs.has(colour), String(colour)).toBe(false);
      }
    }
  });

  it('is a double-ended canoe: both ends rise to the same point, 68 px apart, and the top edge dips between them', () => {
    const cmds = cmdsOf(hull);
    const [, startX, startY] = cmds[0] as [string, number, number];
    const lastCurve = cmds[cmds.length - 2] as [string, number, number, number, number];
    const [, controlX, controlY, endX, endY] = lastCurve;
    // the last curve runs from the right end back to the left; the one before it ends at the right end
    const rightCurve = cmds[3] as [string, number, number, number, number];
    expect([startX, startY]).toEqual([-ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE]);
    expect([endX, endY]).toEqual([startX, startY]);
    expect([rightCurve[3], rightCurve[4]]).toEqual([ANCHOR_BOW_HALF_L, -ANCHOR_BOW_RISE]);
    expect(ANCHOR_BOW_HALF_L * 2).toBe(68);
    // the top edge's middle: a quadratic curve's midpoint is 0.25 start + 0.5 control + 0.25 end
    const midY = 0.25 * rightCurve[4] + 0.5 * controlY + 0.25 * endY;
    expect(controlX).toBe(0);
    expect(midY).toBeLessThanOrEqual(-10);
    expect(midY).toBeGreaterThan(-ANCHOR_BOW_RISE);
  });

  it('has a flat bottom that dips just below the water line and a hull that rises well above it', () => {
    const box = tightBounds(cmdsOf(hull));
    expect(box.maxY).toBe(ANCHOR_BOW_DIP);
    expect(box.maxY).toBeGreaterThan(0);
    expect(box.minY).toBe(-ANCHOR_BOW_RISE);
    expect([box.minX, box.maxX]).toEqual([-ANCHOR_BOW_HALF_L, ANCHOR_BOW_HALF_L]);
    expect(cmdNames(hull)).toContain('lineTo');
  });

  it('is longer than it is tall, and not the trajinera\'s shape: the ends are as high as each other', () => {
    expect(ANCHOR_BOW_TEX.w).toBeGreaterThan(ANCHOR_BOW_TEX.h);
    const [, , startY] = cmdsOf(hull)[0] as [string, number, number];
    const rightEnd = cmdsOf(hull)[3] as [string, number, number, number, number];
    expect(rightEnd[4]).toBe(startY);
  });

  it('inks its outline all round, last, with an opaque INK line of 2.8', () => {
    const last = ops[ops.length - 1];
    expect(isStroke(last)).toBe(true);
    expect(last.strokeStyle).toBe(INK);
    expect(last.lineWidth).toBeCloseTo(2.8, 9);
    expect(JSON.stringify(cmdsOf(last))).toBe(JSON.stringify(cmdsOf(hull)));
  });

  it('is anchored on the water line: more art above it than below, and the middle of the frame is the hull\'s middle', () => {
    expect(ANCHOR_BOW_TEX.originY).toBeGreaterThan(ANCHOR_BOW_TEX.h - ANCHOR_BOW_TEX.originY);
    expect(ANCHOR_BOW_TEX.originX).toBe(ANCHOR_BOW_TEX.w - ANCHOR_BOW_TEX.originX);
  });

  it('hides the top of the chain: the hull\'s top edge is above the chain\'s top and ink at the chain\'s width', () => {
    const cmds = cmdsOf(hull);
    const right = cmds[3] as [string, number, number, number, number];
    const left = cmds[4] as [string, number, number, number, number];
    const x0 = ANCHOR_BOW_HALF_L;
    const reach = ANCHOR_CHAIN_W / 2 + 1.2 + 1;
    const t = (1 - reach / x0) / 2;
    const topY = (1 - t) ** 2 * right[4] + 2 * t * (1 - t) * left[2] + t ** 2 * left[4];
    expect(topY).toBeLessThan(-ANCHOR_SHAFT_PAST_BASE - 1.2);
    expect(ANCHOR_SHAFT_PAST_BASE).toBeGreaterThan(0);
    expect(ANCHOR_REST_BACK).toBe(ANCHOR_SHAFT_PAST_BASE);
  });
});

// ---------------------------------------------------------------------------
// Anchor drop: shaft
// ---------------------------------------------------------------------------

describe('the old anchor and chain (anchor drop shaft)', () => {
  const { ops } = record(paintAnchorShaft);
  /** The colour strokes of the chain's links: ANCHOR_METAL tubes on a closed rounded-square path. */
  const links = ops.filter((op) => isStroke(op) && op.strokeStyle === ANCHOR_METAL && cmdNames(op).includes('closePath'));

  it('is a chain of links ANCHOR_CHAIN_W px wide, 10 px, twice the logic\'s halfWidth 5', () => {
    expect(ANCHOR_CHAIN_W).toBe(2 * ANCHOR_HALF_WIDTH);
    expect(links).toHaveLength(ANCHOR_LINK_COUNT);
    for (const link of links) {
      const box = opBounds(link);
      expect(box.maxX - box.minX).toBeCloseTo(ANCHOR_CHAIN_W, 9);
      expect(box.maxX + box.minX).toBeCloseTo(0, 9);
    }
  });

  it('inks each link: an INK tube of 1.2 a side drawn first on the same path, with a hole through it', () => {
    for (const link of links) {
      const ink = ops.find((o) => isStroke(o) && o.strokeStyle === INK && JSON.stringify(o.args) === JSON.stringify(link.args)) as Op;
      expect(ink).toBeDefined();
      expect(ops.indexOf(ink)).toBeLessThan(ops.indexOf(link));
      expect(ink.lineWidth).toBeCloseTo(link.lineWidth + 2 * 1.2, 9);
      // a hole: the tube is narrower than the path's half width, so water shows inside it
      expect(link.lineWidth).toBeLessThan(ANCHOR_CHAIN_W / 2);
      expect(link.lineCap).toBe('round');
    }
  });

  it('has a link every ANCHOR_LINK_PITCH px, each overlapping the next, with no gap anywhere in the chain', () => {
    const boxes = links.map(opBounds).sort((a, b) => b.maxY - a.maxY);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i - 1].maxY - boxes[i].maxY).toBeCloseTo(ANCHOR_LINK_PITCH, 9);
      expect(boxes[i].maxY).toBeGreaterThan(boxes[i - 1].minY);
    }
  });

  it('is never narrower than 2 x halfWidth along its whole length: the art spans 10 px or more at every height', () => {
    for (let y = 0.5; y < ANCHOR_SHAFT_LENGTH; y += 0.5) {
      expect(extentAt(ops, -y), `y -${y}`).toBeGreaterThanOrEqual(2 * ANCHOR_HALF_WIDTH);
    }
    for (const link of links) {
      const box = opBounds(link);
      for (let y = box.minY; y <= box.maxY; y += 0.5) expect(box.maxX - box.minX).toBeGreaterThanOrEqual(2 * ANCHOR_HALF_WIDTH);
    }
  });

  it('is long enough for the deepest drop, 320 px, plus the px that hide behind the hull', () => {
    expect(ANCHOR_ART_DEPTH).toBe(ANCHOR_DEEPEST);
    expect(ANCHOR_SHAFT_LENGTH).toBeGreaterThanOrEqual(ANCHOR_DEEPEST + ANCHOR_SHAFT_PAST_BASE);
    expect(ANCHOR_SHAFT_LENGTH - (ANCHOR_DEEPEST + ANCHOR_SHAFT_PAST_BASE)).toBeLessThan(ANCHOR_LINK_PITCH);
    expect(-allBounds(ops).minY).toBeGreaterThanOrEqual(ANCHOR_SHAFT_LENGTH);
    expect(ANCHOR_SHAFT_TEX.originY).toBeGreaterThanOrEqual(ANCHOR_SHAFT_LENGTH);
    expect(ANCHOR_SHAFT_LENGTH).toBe(29 + (ANCHOR_LINK_COUNT - 1) * ANCHOR_LINK_PITCH + 16);
  });

  it('has the anchor\'s lowest point on the anchor point, local y 0, and the art running UP from it', () => {
    const colour = ops.filter((op) => isStroke(op) && op.strokeStyle === ANCHOR_METAL);
    expect(Math.max(...colour.map((op) => opBounds(op).maxY))).toBeCloseTo(0, 9);
    // only ink (under 2 px) and padding are below the anchor point
    expect(allBounds(ops).maxY).toBeLessThanOrEqual(2 + EPS);
    expect(allBounds(ops).minY).toBeLessThan(-ANCHOR_DEEPEST);
    expect(ANCHOR_SHAFT_TEX.h - ANCHOR_SHAFT_TEX.originY).toBeLessThanOrEqual(2 + MIN_PAD + 1);
    expect(ANCHOR_SHAFT_TEX.originX).toBe(ANCHOR_SHAFT_TEX.w - ANCHOR_SHAFT_TEX.originX);
  });

  it('is an old anchor at its foot: a ring, a cross bar, a shank, two arms, two flukes and rust, all in ANCHOR_METAL but the rust', () => {
    const lowest = ops.filter((op) => opBounds(op).minY > -40);
    const tubes = lowest.filter((op) => isStroke(op) && op.strokeStyle === ANCHOR_METAL && !cmdNames(op).includes('closePath'));
    // shank, two arms, cross bar, ring
    expect(tubes).toHaveLength(5);
    expect(tubes.filter((op) => ellipsesOf(op).length === 1)).toHaveLength(1);
    expect(lowest.filter((op) => isFill(op) && op.fillStyle === ANCHOR_METAL)).toHaveLength(2);
    expect(lowest.filter((op) => isFill(op) && op.fillStyle === ANCHOR_RUST)).toHaveLength(2);
    // the two arms are mirror images
    const arms = tubes.filter((op) => cmdNames(op).filter((n) => n === 'quadraticCurveTo').length === 1);
    expect(arms).toHaveLength(2);
    const [a, b] = arms.map(opBounds);
    expect(a.minX + b.maxX).toBeCloseTo(0, 9);
  });

  it('is centred, and nothing in it is wider than the anchor\'s flukes', () => {
    const box = allBounds(ops);
    expect(box.maxX - box.minX).toBeLessThan(2 * 19 + 1);
    expect(box.maxX + box.minX).toBeCloseTo(0, 9);
  });
});

// ---------------------------------------------------------------------------
// Anchor drop: cue and ripple lines
// ---------------------------------------------------------------------------

describe('the chain-link cue (anchor drop shadow; guide 10)', () => {
  const { ops } = record(paintAnchorCue);
  const colours = ops.filter((op) => isStroke(op) && op.strokeStyle === ANCHOR_LINK_CUE);

  it('is two white upright links, each an INK tube drawn under a white tube of the same path', () => {
    expect(ops).toHaveLength(4);
    expect(colours).toHaveLength(2);
    for (const colour of colours) {
      const ink = ops.find((o) => isStroke(o) && o.strokeStyle === INK && JSON.stringify(o.args) === JSON.stringify(colour.args)) as Op;
      expect(ink).toBeDefined();
      expect(ops.indexOf(ink)).toBeLessThan(ops.indexOf(colour));
      expect(ink.lineWidth).toBeCloseTo(colour.lineWidth + 2 * 1.6, 9);
      expect(ink.globalAlpha).toBe(1);
      expect(colour.globalAlpha).toBe(1);
    }
    expect(ops.filter(isFill)).toEqual([]);
  });

  it('is 14 px wide and 24 px tall for each link, overlapping, so the pair is taller than twice its width', () => {
    for (const colour of colours) {
      const box = opBounds(colour);
      expect(box.maxX - box.minX).toBeCloseTo(14, 9);
      expect(box.maxY - box.minY).toBeCloseTo(24, 9);
    }
    const whole = allBounds(colours);
    expect((whole.maxY - whole.minY) / (whole.maxX - whole.minX)).toBeGreaterThan(2);
    const [upper, lower] = colours.map(opBounds).sort((a, b) => a.minY - b.minY);
    expect(upper.maxY).toBeGreaterThan(lower.minY);
  });

  it('is centred on the anchor point and fits its frame with at least 4 px of padding', () => {
    const whole = allBounds(ops);
    expect(whole.minX + whole.maxX).toBeCloseTo(0, 9);
    expect(whole.minY + whole.maxY).toBeCloseTo(0, 9);
    expectPadded(ops, ANCHOR_CUE_TEX);
  });
});

describe('the ripple lines (anchor drop ring; guide 7k, 10)', () => {
  const { ops } = record(paintAnchorRing);
  const colours = ops.filter((op) => isStroke(op) && op.strokeStyle === ANCHOR_RING);

  it('is three open wavy white lines, each with an ink line each side, ink first and then the white', () => {
    expect(ops).toHaveLength(6);
    expect(colours).toHaveLength(3);
    expect(ops.slice(0, 3).every((op) => op.strokeStyle === INK)).toBe(true);
    expect(ops.slice(3).every((op) => op.strokeStyle === ANCHOR_RING)).toBe(true);
    for (const colour of colours) {
      expect(cmdNames(colour)).not.toContain('closePath');
      expect(cmdNames(colour)).not.toContain('ellipse');
      expect(cmdNames(colour).filter((n) => n === 'quadraticCurveTo').length).toBeGreaterThanOrEqual(2);
      expect(colour.lineWidth).toBe(2.4);
    }
    for (const ink of ops.slice(0, 3)) expect(ink.lineWidth).toBeCloseTo(2.4 + 2 * 1.1, 9);
  });

  it('stacks the lines 8 px apart, 48, 32 and 16 px wide, centred, the widest on top', () => {
    expect(ANCHOR_RING_LINES.map(([hw]) => 2 * hw)).toEqual([48, 32, 16]);
    expect(ANCHOR_RING_LINES.map(([, y]) => y)).toEqual([-8, 0, 8]);
    colours.forEach((colour, i) => {
      const box = tightBounds(cmdsOf(colour));
      expect(box.minX).toBe(-ANCHOR_RING_LINES[i][0]);
      expect(box.maxX).toBe(ANCHOR_RING_LINES[i][0]);
    });
  });

  it('keeps the lines apart: a line\'s wave and ink reach 3.5 px from its level, and the levels are 8 px apart', () => {
    // the curve bulges half its control point's offset (2.4), 1.2; the ink adds 2.4 / 2 + 1.1 = 2.3
    const reach = 2.4 / 2 + (2.4 / 2 + 1.1);
    expect(8 - 2 * reach).toBeGreaterThan(0);
  });

  it('is not a closed ellipse: no ellipse in it and no closed path', () => {
    expect(ops.filter((op) => cmdNames(op).includes('ellipse'))).toEqual([]);
    expect(ops.filter((op) => cmdNames(op).includes('closePath'))).toEqual([]);
    expect(ops.filter(isFill)).toEqual([]);
  });

  it('fits ANCHOR_RING_TEX and is centred on the anchor point', () => {
    expectPadded(ops, ANCHOR_RING_TEX);
    expect(ANCHOR_RING_TEX.originX).toBe(ANCHOR_RING_TEX.w - ANCHOR_RING_TEX.originX);
  });
});

describe('where the anchor drop\'s parts sit', () => {
  it('puts the ripple lines clear under the hull, and the cue clear under the ripple lines', () => {
    const hull = allBounds(record(paintAnchorBow).ops);
    const ring = allBounds(record(paintAnchorRing).ops);
    const cue = allBounds(record(paintAnchorCue).ops);
    expect(ANCHOR_RING_ALONG + ring.minY).toBeGreaterThan(hull.maxY);
    expect(ANCHOR_CUE_ALONG + cue.minY).toBeGreaterThan(ANCHOR_RING_ALONG + ring.maxY);
  });
});

// ---------------------------------------------------------------------------
// Mud seep: bow
// ---------------------------------------------------------------------------

describe('the mud mound (mud seep bow; guide 4, 5, 10; ADR 0007)', () => {
  const { ops, calls } = record(paintMudMound);
  const heap = ops.find((op) => isFill(op) && op.fillStyle === MUD_SEEP_MOUND) as Op;
  const inkLine = ops[ops.length - 1];

  it('is one low heap, 80 px across at its foot and 12 px high, flat on top: nothing tall, no point, no fire or steam', () => {
    const box = tightBounds(cmdsOf(heap));
    expect([box.minX, box.maxX]).toEqual([-MUD_FOOT_HALF_W, MUD_FOOT_HALF_W]);
    expect(MUD_FOOT_HALF_W * 2).toBe(80);
    expect(box.minY).toBe(-MUD_MOUTH_RISE);
    expect(box.maxY).toBe(MUD_FOOT_DROP);
    expect(MUD_MOUTH_RISE).toBeLessThanOrEqual(14);
    // the top is one straight line between two points at the same height
    const lines = cmdsOf(heap).filter((cmd) => cmd[0] === 'lineTo') as [string, number, number][];
    expect(lines).toEqual([['lineTo', MUD_MOUTH_HALF_W, -MUD_MOUTH_RISE]]);
    // the heap is wider than it is high, many times over
    expect((box.maxX - box.minX) / (MUD_MOUTH_RISE + MUD_FOOT_DROP)).toBeGreaterThan(2);
  });

  it('uses only mud colours: pale mud, a dark opening, a lighter streak and thin cracks, and no hot colour', () => {
    const palette = new Set<unknown>([MUD_SEEP_MOUND, MUD_SEEP_MOUTH]);
    for (const colour of fillColours(ops)) expect(palette.has(colour), String(colour)).toBe(true);
    const strokes = new Set(ops.filter(isStroke).map((op) => op.strokeStyle));
    expect(strokes).toEqual(new Set([MUD_SEEP_MOUND_LIGHT, MUD_SEEP_CRACK, INK]));
    for (const colour of [MUD_SEEP_MOUND, MUD_SEEP_MOUND_LIGHT, MUD_SEEP_CRACK, MUD_SEEP_MOUTH]) {
      const [r, g, b] = channelsOf(colour);
      // a mud brown: red over green over blue, and no strong red or orange
      expect(r).toBeGreaterThanOrEqual(g);
      expect(g).toBeGreaterThanOrEqual(b);
      expect(r - b).toBeLessThan(110);
    }
    expect(fillColours(ops)).not.toContain(EYE);
  });

  it('has a dark seep opening on its flat top, inside the heap', () => {
    const mouth = ops.find((op) => isFill(op) && op.fillStyle === MUD_SEEP_MOUTH) as Op;
    const box = opBounds(mouth);
    expect(box.minX).toBeGreaterThan(-MUD_MOUTH_HALF_W);
    expect(box.maxX).toBeLessThan(MUD_MOUTH_HALF_W);
    expect(box.minY).toBeLessThan(-MUD_MOUTH_RISE + 2);
    expect(box.maxY).toBeLessThan(0);
    expect(ops.indexOf(mouth)).toBeGreaterThan(ops.indexOf(heap));
  });

  it('clips its streak and cracks to the heap, then inks its top and sides, none across the foot', () => {
    expect(calls.filter(([name]) => name === 'clip')).toHaveLength(1);
    expect(isStroke(inkLine)).toBe(true);
    expect(inkLine.strokeStyle).toBe(INK);
    expect(inkLine.lineWidth).toBeCloseTo(2.8, 9);
    expect(cmdNames(inkLine)).not.toContain('closePath');
    expect(edgeOf(inkLine)).toBe(edgeOf(heap));
    const [first, last] = [cmdsOf(inkLine)[0], cmdsOf(inkLine)[cmdsOf(inkLine).length - 1]] as [string, number, number][];
    expect(first[2]).toBe(MUD_FOOT_DROP);
    expect(last[last.length - 1]).toBe(MUD_FOOT_DROP);
  });

  it('sits on the bed: its foot sunk MUD_FOOT_DROP px below the bed top, deeper than the mound is high', () => {
    expect(MUD_MOUND_TEX.originY).toBeGreaterThan(0);
    expect(MUD_FOOT_DROP).toBeGreaterThan(MUD_MOUTH_RISE);
    expect(MUD_MOUND_TEX.originX).toBe(MUD_MOUND_TEX.w - MUD_MOUND_TEX.originX);
  });

  it('hides the column\'s bottom: wider than the column at the column\'s foot depth and its flat top is as wide as the column', () => {
    expect(MUD_SHAFT_PAST_BASE).toBeLessThanOrEqual(MUD_FOOT_DROP);
    expect(MUD_REST_BACK).toBe(MUD_SHAFT_PAST_BASE);
    expect(2 * MUD_MOUTH_HALF_W).toBeGreaterThanOrEqual(2 * MUD_BUBBLE_R);
  });
});

// ---------------------------------------------------------------------------
// Mud seep: shaft
// ---------------------------------------------------------------------------

describe('the bubble column (mud seep shaft)', () => {
  const { ops } = record(paintMudColumn);
  const bubbles = ops.filter((op) => isFill(op) && op.fillStyle === MUD_SEEP_BUBBLE);

  it('is a stack of MUD_BUBBLE_COUNT bubbles of radius 12, drawn bottom first so the top bubble is whole', () => {
    expect(bubbles).toHaveLength(MUD_BUBBLE_COUNT);
    const centres = bubbles.map((op) => ellipsesOf(op)[0]);
    for (const [cx, , rx, ry] of centres) expect([cx, rx, ry]).toEqual([0, MUD_BUBBLE_R, MUD_BUBBLE_R]);
    const ys = centres.map(([, cy]) => cy);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1] - ys[i]).toBe(MUD_BUBBLE_SPACING);
    expect(ys[ys.length - 1]).toBe(MUD_BUBBLE_R);
  });

  it('is the logic column: 10 px a side, so 20 px across, and the art is never narrower: the bubbles overlap and their necks are over 20 px', () => {
    expect(MUD_BUBBLE_HALF_WIDTH).toBe(MUD_HALF_WIDTH);
    expect(MUD_BUBBLE_SPACING).toBeLessThan(2 * MUD_BUBBLE_R);
    // where two bubbles meet, the column is as wide as the chord their edges cross at
    const neck = 2 * Math.sqrt(MUD_BUBBLE_R ** 2 - (MUD_BUBBLE_SPACING / 2) ** 2);
    expect(neck).toBeGreaterThanOrEqual(2 * MUD_HALF_WIDTH);
    expect(neck).toBeLessThan(2 * MUD_BUBBLE_R);
    // the widest, at each bubble's middle, and the ink sits outside the logic's touch width
    expect(2 * MUD_BUBBLE_R).toBeGreaterThan(2 * MUD_HALF_WIDTH);
    for (let y = 0.25; y < MUD_COLUMN_LENGTH; y += 0.25) expect(extentAt(ops, y), `y ${y}`).toBeGreaterThanOrEqual(2 * MUD_HALF_WIDTH);
  });

  it('is long enough for the deepest seep, 260 px, plus the px drawn inside the mound', () => {
    expect(MUD_ART_DEPTH).toBe(MUD_DEEPEST);
    expect(MUD_COLUMN_LENGTH).toBeGreaterThanOrEqual(MUD_DEEPEST + MUD_SHAFT_PAST_BASE);
    expect(MUD_COLUMN_LENGTH - (MUD_DEEPEST + MUD_SHAFT_PAST_BASE)).toBeLessThan(MUD_BUBBLE_SPACING);
    expect(MUD_COLUMN_TEX.h - MUD_COLUMN_TEX.originY).toBeGreaterThanOrEqual(MUD_COLUMN_LENGTH);
    expect(MUD_COLUMN_LENGTH).toBe(2 * MUD_BUBBLE_R + (MUD_BUBBLE_COUNT - 1) * MUD_BUBBLE_SPACING);
  });

  it('has the top bubble\'s top edge on the anchor point, local y 0, and the art running DOWN from it', () => {
    const fillBox = allBounds(bubbles);
    expect(fillBox.minY).toBeCloseTo(0, 9);
    expect(fillBox.maxY).toBeCloseTo(MUD_COLUMN_LENGTH, 9);
    // only ink (1 px) and padding are above the anchor point
    expect(MUD_COLUMN_TEX.originY).toBeLessThanOrEqual(1 + MIN_PAD + 1);
    expect(allBounds(ops).minY).toBeGreaterThanOrEqual(-1 - EPS);
    expect(MUD_COLUMN_TEX.originX).toBe(MUD_COLUMN_TEX.w - MUD_COLUMN_TEX.originX);
  });

  it('inks each bubble with an opaque INK outline 2 wide on its edge, and gives it one soft shine low on its left', () => {
    for (const bubble of bubbles) {
      const idx = ops.indexOf(bubble);
      const outline = ops[idx + 1];
      expect(isStroke(outline)).toBe(true);
      expect(outline.strokeStyle).toBe(INK);
      expect(outline.lineWidth).toBe(2);
      expect(outline.globalAlpha).toBe(1);
      expect(JSON.stringify(outline.args)).toBe(JSON.stringify(bubble.args));
      const shine = ops[idx + 2];
      expect(shine.fillStyle).toBe(MUD_SEEP_SHINE);
      const [shineX, shineY] = ellipsesOf(shine)[0];
      expect(shineX).toBeLessThan(0);
      expect(shineY).toBeGreaterThan(ellipsesOf(bubble)[0][1]);
    }
    expect(ops).toHaveLength(MUD_BUBBLE_COUNT * 3);
  });

  it('is not a smooth tube like the geyser column: it has no stroked tube, only discs with an ink line across each overlap', () => {
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle !== INK)).toEqual([]);
    expect(ops.filter((op) => isStroke(op) && cmdNames(op).includes('lineTo'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mud seep: cue and crack ring
// ---------------------------------------------------------------------------

describe('the silt flakes (mud seep shadow; guide 10)', () => {
  const { ops } = record(paintMudFlakes);
  const flakes = ops.filter((op) => isFill(op) && op.fillStyle === MUD_SEEP_FLAKE);

  it('is five tilted diamonds, each with an opaque INK outline 2 wide on the same edge and a thin crease inside', () => {
    expect(MUD_FLAKES).toHaveLength(5);
    expect(flakes).toHaveLength(5);
    for (const flake of flakes) {
      const idx = ops.indexOf(flake);
      const outline = ops[idx + 1];
      expect(outline.strokeStyle).toBe(INK);
      expect(outline.lineWidth).toBe(2);
      expect(outline.globalAlpha).toBe(1);
      expect(JSON.stringify(outline.args)).toBe(JSON.stringify(flake.args));
      const crease = ops[idx + 2];
      expect(crease.strokeStyle).toBe(MUD_SEEP_CRACK);
      expect(crease.lineWidth).toBeLessThan(2);
    }
    expect(ops).toHaveLength(15);
  });

  it('has straight edges and four corners each: moveTo, three lineTo and a closePath, with no curve and no ellipse', () => {
    for (const flake of flakes) {
      expect(cmdNames(flake)).toEqual(['moveTo', 'lineTo', 'lineTo', 'lineTo', 'closePath']);
    }
    expect(ops.filter((op) => cmdNames(op).some((n) => n === 'ellipse' || n === 'quadraticCurveTo' || n === 'arc'))).toEqual([]);
  });

  it('tilts the flakes differently, so they sit loose and not in a row, and each is twice as long as it is wide or nearly', () => {
    const rots = new Set(MUD_FLAKES.map((f) => f.rot));
    expect(rots.size).toBe(MUD_FLAKES.length);
    for (const f of MUD_FLAKES) expect(f.halfLong / f.halfShort).toBeGreaterThan(1.3);
    // none is on top of another: centres more than 6 px apart
    for (let i = 0; i < MUD_FLAKES.length; i++) {
      for (let j = i + 1; j < MUD_FLAKES.length; j++) {
        expect(Math.hypot(MUD_FLAKES[i].x - MUD_FLAKES[j].x, MUD_FLAKES[i].y - MUD_FLAKES[j].y)).toBeGreaterThan(6);
      }
    }
  });

  it('fits MUD_FLAKES_TEX, and the cluster is centred near the anchor point', () => {
    const box = allBounds(ops);
    expect(Math.abs(box.minX + box.maxX) / 2).toBeLessThan(3);
    expect(Math.abs(box.minY + box.maxY) / 2).toBeLessThan(3);
    expectPadded(ops, MUD_FLAKES_TEX);
  });

  it('sits clear over the mound\'s flat top', () => {
    const box = allBounds(ops);
    expect(MUD_SHADOW_ALONG + box.minY).toBeGreaterThan(0);
    expect(MUD_SHADOW_ALONG - box.maxY).toBeGreaterThan(MUD_MOUTH_RISE + 1.4);
  });
});

describe('the jagged crack ring (mud seep ring; guide 7k, 10)', () => {
  const { ops } = record(paintMudRing);
  const colour = ops.find((op) => isStroke(op) && op.strokeStyle === MUD_SEEP_RING) as Op;
  const ink = ops.find((op) => isStroke(op) && op.strokeStyle === INK) as Op;

  it('is one closed zigzag, a pale line with an ink line each side, ink first, so it reads dark, pale, dark', () => {
    expect(ops).toHaveLength(2);
    expect(ops.indexOf(ink)).toBeLessThan(ops.indexOf(colour));
    expect(colour.lineWidth).toBe(2.6);
    expect(ink.lineWidth).toBeCloseTo(2.6 + 2 * 1.3, 9);
    expect(ink.globalAlpha).toBe(1);
    expect(JSON.stringify(ink.args)).toBe(JSON.stringify(colour.args));
    expect(ops.filter(isFill)).toEqual([]);
  });

  it('has straight sides only and a tooth every point: MUD_RING_POINTS corners, no curve and no ellipse', () => {
    const names = cmdNames(colour);
    expect(names[0]).toBe('moveTo');
    expect(names.filter((n) => n === 'lineTo')).toHaveLength(MUD_RING_POINTS - 1);
    expect(names[names.length - 1]).toBe('closePath');
    expect(names.filter((n) => n === 'ellipse' || n === 'quadraticCurveTo' || n === 'arc')).toEqual([]);
    expect(mudRingCorners()).toHaveLength(MUD_RING_POINTS);
  });

  it('zigzags: the corners alternate out and in from the flat ellipse, so no three in a row lie on one line', () => {
    const corners = mudRingCorners();
    const level = (x: number, y: number): number => (x / MUD_RING_RX) ** 2 + (y / MUD_RING_RY) ** 2;
    corners.forEach(([x, y], k) => {
      if (k % 2 === 0) expect(level(x, y)).toBeGreaterThan(1);
      else expect(level(x, y)).toBeLessThan(1);
    });
    for (let k = 0; k < corners.length; k++) {
      const [a, b, c] = [corners[k], corners[(k + 1) % corners.length], corners[(k + 2) % corners.length]];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      expect(Math.abs(cross), `corner ${k}`).toBeGreaterThan(1);
    }
  });

  it('is a flat ring, 104 px wide, wider than the mound\'s foot, centred on the anchor point', () => {
    const box = tightBounds(cmdsOf(colour));
    expect(box.maxX - box.minX).toBeGreaterThan(2 * MUD_RING_RX - 1);
    expect(box.maxX + box.minX).toBeCloseTo(0, 1);
    expect(MUD_RING_RX).toBeGreaterThan(MUD_FOOT_HALF_W);
    expect((box.maxX - box.minX) / (box.maxY - box.minY)).toBeGreaterThan(4);
    expectPadded(ops, MUD_RING_TEX);
    expect(MUD_RING_TEX.originX).toBe(MUD_RING_TEX.w - MUD_RING_TEX.originX);
    expect(MUD_RING_ALONG).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Cue shapes differ
// ---------------------------------------------------------------------------

interface Facts {
  readonly cmds: Set<string>;
  readonly aspect: number;
  readonly outerFills: number;
}

/** What a painter's shape is made of: the path commands it uses, the width over the height of all of it and its fill count. */
function factsOf(paint: Painter): Facts {
  const { ops } = record(paint);
  const cmds = new Set<string>();
  for (const op of ops) for (const name of cmdNames(op)) cmds.add(name);
  const box = allBounds(ops);
  return { cmds, aspect: (box.maxX - box.minX) / (box.maxY - box.minY), outerFills: ops.filter(isFill).length };
}

const sameSet = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && [...a].every((x) => b.has(x));

/** Every other moving hazard and predator cue, and the protected ring, as still frames. */
const OTHER_CUES: readonly (readonly [string, Painter])[] = [
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
  ['anchor chain-link cue', paintAnchorCue],
  ['anchor ripple lines', paintAnchorRing],
  ['mud silt flakes', paintMudFlakes],
  ['mud crack ring', paintMudRing],
];

describe('the cues read apart in greyscale and when still (guide 10)', () => {
  const others = OTHER_CUES.map(([name, paint]) => [name, factsOf(paint)] as const);

  /** Two shapes differ when they are made of different path commands, or one is 1.5 times flatter than the other. */
  function differ(a: Facts, b: Facts): boolean {
    return !sameSet(a.cmds, b.cmds) || Math.abs(Math.log(a.aspect / b.aspect)) >= Math.log(1.5);
  }

  it.each(MY_CUES)('%s differs in make or in proportion from every other moving hazard and predator cue and the protected ring', (_name, paint) => {
    const mine = factsOf(paint);
    for (const [otherName, theirs] of others) expect(differ(mine, theirs), otherName).toBe(true);
  });

  it('keeps the four new cues apart from each other', () => {
    const mine = MY_CUES.map(([name, paint]) => [name, factsOf(paint)] as const);
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) expect(differ(mine[i][1], mine[j][1]), `${mine[i][0]} and ${mine[j][0]}`).toBe(true);
    }
  });

  it('makes the chain-link cue the only cue taller than it is wide, 2 to 1 or more', () => {
    const cue = factsOf(paintAnchorCue);
    expect(cue.aspect).toBeLessThan(0.5);
    for (const [name, theirs] of others) expect(theirs.aspect, name).toBeGreaterThan(0.5);
    for (const [name, paint] of MY_CUES.filter(([n]) => n !== 'anchor chain-link cue')) expect(factsOf(paint).aspect, name).toBeGreaterThan(0.5);
  });

  it('makes the ripple lines and the crack ring the only open or sharp rings: no other ring is wavy or has corners', () => {
    const wavy = factsOf(paintAnchorRing);
    const sharp = factsOf(paintMudRing);
    expect(wavy.cmds.has('ellipse')).toBe(false);
    expect(sharp.cmds.has('ellipse')).toBe(false);
    for (const [name, theirs] of others.filter(([n]) => n.includes('ring') || n.includes('shimmer'))) {
      expect(theirs.cmds.has('ellipse'), name).toBe(true);
    }
  });

  it('makes the silt flakes the only cue made of straight-edged shapes: every other bubble, drop or puff is round', () => {
    const flakes = factsOf(paintMudFlakes);
    expect(flakes.cmds.has('lineTo')).toBe(true);
    expect(flakes.cmds.has('ellipse')).toBe(false);
    expect(flakes.outerFills).toBe(5);
    for (const [name, paint] of OTHER_CUES.filter(([n]) => /bubble|puff|drop|shadow/.test(n))) {
      const facts = factsOf(paint);
      const straight = facts.cmds.has('lineTo') && !facts.cmds.has('ellipse') && !facts.cmds.has('quadraticCurveTo');
      expect(straight, name).toBe(false);
    }
  });

  it('shows each cue still: the same ops every time, with no time or random in them', () => {
    for (const [, paint] of MY_CUES) expect(JSON.stringify(record(paint).ops)).toBe(JSON.stringify(record(paint).ops));
  });
});

describe('white stays the protected ring\'s and the rings\' colour', () => {
  it('uses the same white as the pole\'s, the drip\'s and the geyser\'s rings for the cue and ripple lines', () => {
    expect(ANCHOR_LINK_CUE).toBe(WHITE);
    expect(ANCHOR_RING).toBe(WHITE);
  });
});
