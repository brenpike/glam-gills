/**
 * Moving hazard looks (issue #117, ND-8, ND-9, ND-18; issue #77, ND-3): the punting pole's, the
 * stalactite drip's and the geyser vent's contrast and greyscale cues, and the look table, its
 * places and its bake, headless. The painters run against a recording context and
 * a stub Path2D (the same approach as predatorArt.test.ts and chinampaArt.test.ts): every fill and
 * stroke is kept with the style, width and alpha it was painted under. The bake runs against a fake
 * scene whose canvases record.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BOAT_FLOWER_CENTRE,
  BOAT_HULL,
  BOAT_ORANGE,
  BOAT_PINK,
  BOAT_SHADOW,
  BOAT_TEAL,
  BOAT_YELLOW,
  POLE_FERRULE,
  POLE_NODE,
  POLE_NODE_COUNT,
  POLE_NODE_SPACING,
  POLE_RING,
  POLE_SHAFT_LENGTH,
  POLE_SHAFT_W,
  POLE_SHINE,
  POLE_TILE_FROM,
  POLE_TILE_TO,
  POLE_WOOD,
  PUNTING_BOW_TEX,
  PUNTING_RING_INNER_RX,
  PUNTING_RING_INNER_RY,
  PUNTING_RING_RX,
  PUNTING_RING_RY,
  PUNTING_RING_TEX,
  PUNTING_SHADOW_DROP,
  PUNTING_SHADOW_RX,
  PUNTING_SHADOW_RY,
  PUNTING_SHADOW_TEX,
  PUNTING_SHAFT_TEX,
  paintPuntingBow,
  paintPuntingRing,
  paintPuntingShadow,
  paintPuntingShaft,
  poleShaftPieceCount,
  poleShaftPieceFrom,
  poleShaftPieceLift,
  poleShaftPieceTo,
} from './drawPuntingPole';
import {
  GEYSER_BUBBLES_RISE,
  GEYSER_BUBBLES_TEX,
  GEYSER_CHIMNEY_TEX,
  GEYSER_COLUMN_LENGTH,
  GEYSER_COLUMN_TEX,
  GEYSER_COLUMN_W,
  GEYSER_FOOT_DROP,
  GEYSER_FROTH,
  GEYSER_MOUTH_RISE,
  GEYSER_RING,
  GEYSER_RING_TEX,
  GEYSER_WATER,
  paintGeyserBubbles,
  paintGeyserChimney,
  paintGeyserColumn,
  paintGeyserRing,
} from './drawGeyserVent';
import { SPRING_ROCK } from './drawSpringCave';
import {
  DRIP_COUNT,
  DRIP_DROP_ALONG,
  DRIP_DROP_R,
  DRIP_DROP_TEX,
  DRIP_HALF_W,
  DRIP_RING,
  DRIP_RING_ALONG,
  DRIP_RING_RY,
  DRIP_RING_TEX,
  DRIP_SHINE,
  DRIP_SPACING,
  DRIP_STREAM_LENGTH,
  DRIP_STREAM_TEX,
  DRIP_WATER,
  STALACTITE_HALF_W,
  STALACTITE_TEX,
  STALACTITE_TIP_Y,
  paintDripDrop,
  paintDripRing,
  paintDripStream,
  paintStalactite,
} from './drawStalactite';
import { habitatLook } from './habitatLook';
import {
  MOVING_HAZARD_LOOKS,
  MOVING_HAZARD_PARTS,
  bakeMovingHazardTextures,
  movingHazardLookPlace,
  movingHazardLookTextures,
  movingHazardTextureKey,
} from './movingHazardTextures';
import { EYE, INK, LW, WHITE } from './palette';
import type { TexSize } from './canvasKit';
import { GEYSER_VENT, PUNTING_POLE, STALACTITE_DRIP, movingHazardDepth } from '../logic/movingHazards';
import { SPRING_CAVE_LAYOUT } from '../logic/springCaveLayout';
import { PUNTING_POLES } from '../logic/tuning';
import { SURF } from '../logic/zone';

vi.mock('phaser', () => ({}));

/** Ink against a background is 3:1 or better when the background's luminance is at least this (guide 3c, 10). */
const LUMINANCE_FLOOR = 0.1687;
/** The pair rule: a cue object's fill or its ink is 3:1 or better on any background (guide 10). */
const PAIR_FLOOR = 3;
/** Fills that reach the outer edge against ink. */
const OUTER_FILL_RATIO = 4.5;
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

/** The [r, g, b, a] of an rgba() colour. */
function rgbaOf(colour: string): [number, number, number, number] {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(colour);
  expect(match, colour).not.toBeNull();
  return (match as RegExpExecArray).slice(1).map(Number) as [number, number, number, number];
}

/** An rgba() fill laid over an opaque #rrggbb background, as the canvas blends it (8-bit sRGB). */
function compositeOver(fill: string, background: string): string {
  const [r, g, b, a] = rgbaOf(fill);
  const mixed = channelsOf(background).map((under, i) => Math.round([r, g, b][i] * a + under * (1 - a)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Every colour a pole can be seen on, the water stops and the bed of each look that holds the
 * pond contrast rule (guide 3c, 10): the pond, the pond at dusk and the chinampa, from habitatLook.
 * The canal is left out on purpose: its deep water is darker than the rule's floor, and no pole is
 * placed there (the pole is for the pond and chinampa areas).
 */
function backgrounds(): { name: string; hex: string }[] {
  const out: { name: string; hex: string }[] = [];
  for (const id of ['pond', 'pond-dusk', 'chinampa']) {
    const look = habitatLook(id);
    for (const stop of ['shallow', 'mid', 'deep'] as const) out.push({ name: `${id} water ${stop}`, hex: look.water[stop] });
    out.push({ name: `${id} bed top`, hex: look.bed.top }, { name: `${id} bed bottom`, hex: look.bed.bottom });
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

/** Bounds of a draw op, half a stroke's width outside its path. A fillRect is its rectangle. */
function opBounds(op: Op): Box {
  if (op.op === 'fillRect') {
    const [x, y, w, h] = op.args as number[];
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }
  const box = tightBounds(cmdsOf(op));
  const half = isStroke(op) ? op.lineWidth / 2 : 0;
  return { minX: box.minX - half, minY: box.minY - half, maxX: box.maxX + half, maxY: box.maxY + half };
}

const frameBox = (tex: TexSize): Box => ({
  minX: -tex.originX,
  minY: -tex.originY,
  maxX: tex.w - tex.originX,
  maxY: tex.h - tex.originY,
});

/** Every op sits inside the frame with at least 4 px of padding. The bow's fillRects are clipped, so they are skipped. */
function expectPadded(ops: readonly Op[], tex: TexSize): void {
  const frame = frameBox(tex);
  for (const op of ops.filter((o) => o.op !== 'fillRect')) {
    const box = opBounds(op);
    expect(box.minX - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(box.minY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - box.maxX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - box.maxY).toBeGreaterThanOrEqual(MIN_PAD);
  }
}

/**
 * The tubes of an `inkMany` group: each non-ink stroke paired with the earlier INK stroke on the
 * same path. A tube's ink is as wide as its colour plus 2 x the outline it adds each side.
 */
function tubePairs(ops: readonly Op[]): { ink: Op; colour: Op }[] {
  const pairs: { ink: Op; colour: Op }[] = [];
  ops.forEach((op, i) => {
    if (!isStroke(op) || op.strokeStyle === INK) return;
    const ink = ops
      .slice(0, i)
      .find((o) => isStroke(o) && o.strokeStyle === INK && JSON.stringify(o.args) === JSON.stringify(op.args));
    if (ink) pairs.push({ ink, colour: op });
  });
  return pairs;
}

/** The fill colours of ops, in paint order. */
const fillColours = (ops: readonly Op[]): unknown[] => ops.filter(isFill).map((op) => op.fillStyle);

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Every colour this file's painters use, with the literal value written out here, never read from the source. */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['BOAT_HULL', BOAT_HULL, '#fff0c9'],
  ['BOAT_PINK', BOAT_PINK, '#ff6fa8'],
  ['BOAT_ORANGE', BOAT_ORANGE, '#ffa23a'],
  ['BOAT_TEAL', BOAT_TEAL, '#2fc7b8'],
  ['BOAT_YELLOW', BOAT_YELLOW, '#ffe14a'],
  ['BOAT_FLOWER_CENTRE', BOAT_FLOWER_CENTRE, '#ffffff'],
  ['POLE_WOOD', POLE_WOOD, '#d9b27a'],
  ['POLE_NODE', POLE_NODE, '#8a5a30'],
  ['POLE_FERRULE', POLE_FERRULE, '#7a5230'],
  ['POLE_SHINE', POLE_SHINE, 'rgba(255,255,255,0.5)'],
  ['BOAT_SHADOW', BOAT_SHADOW, 'rgba(12,38,78,0.55)'],
  ['POLE_RING', POLE_RING, '#ffffff'],
  ['DRIP_WATER', DRIP_WATER, '#dff7ff'],
  ['DRIP_SHINE', DRIP_SHINE, 'rgba(255,255,255,0.85)'],
  ['DRIP_RING', DRIP_RING, '#ffffff'],
  ['GEYSER_WATER', GEYSER_WATER, '#e3f9ff'],
  ['GEYSER_FROTH', GEYSER_FROTH, '#ffffff'],
  ['GEYSER_RING', GEYSER_RING, '#ffffff'],
];

describe('moving hazard colours are the values written down', () => {
  it.each(DOCUMENTED_COLOURS)('%s is %s', (_name, constant, documented) => {
    expect(constant).toBe(documented);
  });
});

describe('punting pole contrast (guide 3g, 10)', () => {
  const outerFills: readonly (readonly [string, string])[] = [
    ['BOAT_HULL', BOAT_HULL],
    ['BOAT_PINK', BOAT_PINK],
    ['BOAT_ORANGE', BOAT_ORANGE],
    ['BOAT_TEAL', BOAT_TEAL],
    ['BOAT_YELLOW', BOAT_YELLOW],
    ['POLE_WOOD', POLE_WOOD],
  ];

  it.each(outerFills)('%s reaches the outer edge, so it is 4.5:1 or better against INK', (_name, fill) => {
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
  });

  it('the hull is the lightest part of the boat, 9:1 against INK', () => {
    expect(contrast(BOAT_HULL, INK)).toBeGreaterThanOrEqual(9);
    for (const fill of [BOAT_PINK, BOAT_ORANGE, BOAT_TEAL, BOAT_YELLOW]) {
      expect(luminance(BOAT_HULL)).toBeGreaterThanOrEqual(luminance(fill));
    }
  });

  it('the pole is a light shaft with dark nodes and a dark tip: 2:1 darker than the wood in greyscale', () => {
    expect(contrast(POLE_WOOD, POLE_NODE)).toBeGreaterThanOrEqual(2);
    expect(contrast(POLE_WOOD, POLE_FERRULE)).toBeGreaterThanOrEqual(2);
    expect(luminance(POLE_NODE)).toBeLessThan(luminance(POLE_WOOD));
    expect(luminance(POLE_FERRULE)).toBeLessThan(luminance(POLE_WOOD));
  });

  it('every background has luminance 0.1687 or more, so the opaque ink outline is 3:1 or better on it', () => {
    const all = backgrounds();
    expect(all.length).toBe(15);
    for (const { name, hex } of all) {
      expect(luminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('the ring is white and ink: 14.39:1 as a pair, 3.79:1 or better on any background', () => {
    expect(contrast(POLE_RING, INK).toFixed(2)).toBe('14.39');
    expect(Math.sqrt(contrast(POLE_RING, INK))).toBeGreaterThanOrEqual(3.79);
    expect(POLE_RING).toBe(WHITE);
  });
});

// ---------------------------------------------------------------------------
// Shadow (the warning cue)
// ---------------------------------------------------------------------------

describe('boat shadow (the warning cue; guide 10)', () => {
  const { ops } = record(paintPuntingShadow);

  it('is one see-through dark fill and one opaque ink outline on the same ellipse', () => {
    expect(ops).toHaveLength(2);
    const [fill] = ops.filter(isFill);
    const [outline] = ops.filter(isStroke);
    expect(fill.fillStyle).toBe(BOAT_SHADOW);
    expect(rgbaOf(BOAT_SHADOW)[3]).toBeGreaterThan(0);
    expect(rgbaOf(BOAT_SHADOW)[3]).toBeLessThan(1);
    expect(outline.strokeStyle).toBe(INK);
    expect(outline.lineWidth).toBeGreaterThanOrEqual(2);
    expect(outline.globalAlpha).toBe(1);
    expect(JSON.stringify(fill.args)).toBe(JSON.stringify(outline.args));
  });

  it('is a wide, flat ellipse centred on the anchor, wider than the hull', () => {
    const ellipses = ellipsesOf(ops[0]);
    expect(ellipses).toHaveLength(1);
    const [cx, cy, rx, ry] = ellipses[0];
    expect([cx, cy]).toEqual([0, 0]);
    expect([rx, ry]).toEqual([PUNTING_SHADOW_RX, PUNTING_SHADOW_RY]);
    expect(rx / ry).toBeGreaterThan(5);
    expect(PUNTING_SHADOW_RX * 2).toBeGreaterThan(PUNTING_BOW_TEX.w * 0.9);
  });

  it('darkens the water under it by 1.5:1 or more on every water stop, so the shape reads by value', () => {
    for (const { name, hex } of backgrounds().filter((b) => b.name.includes('water'))) {
      expect(contrast(compositeOver(BOAT_SHADOW, hex), hex), name).toBeGreaterThanOrEqual(1.5);
      expect(luminance(compositeOver(BOAT_SHADOW, hex)), name).toBeLessThan(luminance(hex));
    }
  });

  it('holds its shape in greyscale by the ink outline: ink is 3:1 or better against every water stop', () => {
    for (const { name, hex } of backgrounds().filter((b) => b.name.includes('water'))) {
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('fits PUNTING_SHADOW_TEX with its outline and at least 4 px of padding, anchored at the centre', () => {
    expectPadded(ops, PUNTING_SHADOW_TEX);
    expect(PUNTING_SHADOW_TEX.originX).toBe(PUNTING_SHADOW_TEX.w - PUNTING_SHADOW_TEX.originX);
    expect(PUNTING_SHADOW_TEX.originY).toBe(PUNTING_SHADOW_TEX.h - PUNTING_SHADOW_TEX.originY);
  });

  it('sits below the hull bottom, not on the deck', () => {
    expect(PUNTING_SHADOW_DROP).toBeGreaterThan(PUNTING_SHADOW_RY);
  });
});

// ---------------------------------------------------------------------------
// Ring (the tip's dip)
// ---------------------------------------------------------------------------

describe('ripple ring (the warning cue; guide 7k, 10)', () => {
  const { ops } = record(paintPuntingRing);

  it('is two flat white lines, each with an ink line each side, so it reads dark, white, dark', () => {
    const tubes = tubePairs(ops);
    expect(ops).toHaveLength(4);
    expect(tubes).toHaveLength(2);
    for (const { ink, colour } of tubes) {
      expect(colour.strokeStyle).toBe(POLE_RING);
      expect(colour.lineWidth).toBe(3);
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeCloseTo(3 + 2 * 1.4, 9);
      expect(ink.globalAlpha).toBe(1);
      expect(colour.globalAlpha).toBe(1);
    }
    expect(ops.filter(isFill)).toEqual([]);
  });

  it('is an outer and an inner wide, flat ellipse centred on the anchor', () => {
    const [outer, inner] = tubePairs(ops).map(({ colour }) => ellipsesOf(colour)[0]);
    expect(outer.slice(0, 4)).toEqual([0, 0, PUNTING_RING_RX, PUNTING_RING_RY]);
    expect(inner.slice(0, 4)).toEqual([0, 0, PUNTING_RING_INNER_RX, PUNTING_RING_INNER_RY]);
    expect(PUNTING_RING_RX / PUNTING_RING_RY).toBeGreaterThan(2);
    expect(PUNTING_RING_INNER_RX).toBeLessThan(PUNTING_RING_RX);
    // the inner ink does not run into the outer line
    expect(PUNTING_RING_RX - PUNTING_RING_INNER_RX).toBeGreaterThan(3 + 2 * 1.4);
  });

  it('has no fill, so the ink outline is the only thing that holds it in greyscale', () => {
    expect(new Set(ops.map((op) => op.strokeStyle))).toEqual(new Set([INK, POLE_RING]));
  });

  it('fits PUNTING_RING_TEX with its ink and at least 4 px of padding, anchored at the centre', () => {
    expectPadded(ops, PUNTING_RING_TEX);
    expect(PUNTING_RING_TEX.originX).toBe(PUNTING_RING_TEX.w - PUNTING_RING_TEX.originX);
    expect(PUNTING_RING_TEX.originY).toBe(PUNTING_RING_TEX.h - PUNTING_RING_TEX.originY);
  });
});

// ---------------------------------------------------------------------------
// Shaft
// ---------------------------------------------------------------------------

describe('pole shaft (guide 10)', () => {
  const { ops } = record(paintPuntingShaft);

  it('is the logic pole: a 10 px colour width, twice the halfWidth, and it reaches the full depth', () => {
    expect(POLE_SHAFT_W).toBe(2 * PUNTING_POLE.halfWidth);
    expect(POLE_SHAFT_W).toBe(2 * PUNTING_POLES.halfWidth);
    expect(POLE_SHAFT_LENGTH).toBeGreaterThan(PUNTING_POLE.depth);
    const tubes = tubePairs(ops).filter(({ colour }) => colour.strokeStyle === POLE_WOOD || colour.strokeStyle === POLE_FERRULE);
    expect(tubes).toHaveLength(2);
    for (const { ink, colour } of tubes) {
      expect(colour.lineWidth).toBe(POLE_SHAFT_W);
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeCloseTo(POLE_SHAFT_W + 2 * 2.2, 9);
      expect(colour.lineCap).toBe('round');
    }
  });

  it('merges the wood and the worn end in one inked group: all ink first, then the colour', () => {
    const order = ops.filter(isStroke).map((op) => op.strokeStyle);
    expect(order.slice(0, 2)).toEqual([INK, INK]);
    expect(order.slice(2, 4)).toEqual([POLE_WOOD, POLE_FERRULE]);
  });

  it('has the tip at the anchor: the worn end\'s round cap ends at local y 0, and the art runs up from it', () => {
    const worn = tubePairs(ops).find(({ colour }) => colour.strokeStyle === POLE_FERRULE)?.colour as Op;
    expect(opBounds(worn).maxY).toBeCloseTo(0, 9);
    const wood = tubePairs(ops).find(({ colour }) => colour.strokeStyle === POLE_WOOD)?.colour as Op;
    expect(opBounds(wood).minY).toBeCloseTo(-POLE_SHAFT_LENGTH, 9);
    for (const op of ops) expect(opBounds(op).maxY).toBeLessThanOrEqual(2.2 + EPS);
  });

  it('has node rings straight across the wood every POLE_NODE_SPACING px, in POLE_NODE with no ink, so a crop still reads as one pole', () => {
    const nodes = ops.filter((op) => isStroke(op) && op.strokeStyle === POLE_NODE);
    expect(nodes).toHaveLength(POLE_NODE_COUNT);
    const ys = nodes.map((op) => (cmdsOf(op)[0].slice(1) as number[])[1]);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1] - ys[i]).toBe(POLE_NODE_SPACING);
    for (const op of nodes) {
      expect(op.lineCap).toBe('butt');
      const [[, x0, y0], [, x1, y1]] = cmdsOf(op) as [string, number, number][];
      expect(y0).toBe(y1);
      expect(x1 - x0).toBe(POLE_SHAFT_W);
    }
    expect(Math.min(...ys)).toBeGreaterThan(-POLE_SHAFT_LENGTH);
    expect(POLE_NODE_COUNT).toBeGreaterThanOrEqual(5);
  });

  it('has one soft see-through shine inside the silhouette and nothing else', () => {
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === POLE_SHINE)).toHaveLength(1);
    expect(new Set(ops.map((op) => op.strokeStyle))).toEqual(new Set([INK, POLE_WOOD, POLE_FERRULE, POLE_NODE, POLE_SHINE]));
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it('fits PUNTING_SHAFT_TEX with its ink and at least 4 px of padding, anchored at the tip centre', () => {
    expectPadded(ops, PUNTING_SHAFT_TEX);
    expect(PUNTING_SHAFT_TEX.originX).toBe(PUNTING_SHAFT_TEX.w - PUNTING_SHAFT_TEX.originX);
    // the anchor is at the bottom: only the ink and the padding are below it
    expect(PUNTING_SHAFT_TEX.h - PUNTING_SHAFT_TEX.originY).toBeLessThanOrEqual(2.2 + MIN_PAD + 1);
    expect(PUNTING_SHAFT_TEX.originY).toBeGreaterThanOrEqual(POLE_SHAFT_LENGTH);
  });
});

// ---------------------------------------------------------------------------
// Bow
// ---------------------------------------------------------------------------

describe('trajinera bow (guide 4, 5, 10; ADR 0007)', () => {
  const { ops, calls } = record(paintPuntingBow);

  it('uses only the boat palette: no eye, no ink-less outer fill, nothing a person or a face would need', () => {
    const palette = new Set<unknown>([BOAT_HULL, BOAT_PINK, BOAT_ORANGE, BOAT_TEAL, BOAT_YELLOW, BOAT_FLOWER_CENTRE]);
    for (const colour of fillColours(ops)) expect(palette.has(colour), String(colour)).toBe(true);
    expect(fillColours(ops)).not.toContain(EYE);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it('paints the hull cream and inks it with an opaque INK outline of 2 x LW', () => {
    const hull = ops.find((op) => isFill(op) && op.fillStyle === BOAT_HULL) as Op;
    expect(hull).toBeDefined();
    const idx = ops.indexOf(hull);
    const outline = ops[idx - 1];
    expect(isStroke(outline)).toBe(true);
    expect(outline.strokeStyle).toBe(INK);
    expect(outline.lineWidth).toBeCloseTo(2 * LW, 9);
    expect(JSON.stringify(outline.args)).toBe(JSON.stringify(hull.args));
  });

  it('paints three bands clipped to the hull, in pink, orange and teal', () => {
    expect(calls.filter(([name]) => name === 'clip')).toHaveLength(1);
    const bands = ops.filter((op) => op.op === 'fillRect');
    expect(bands.map((op) => op.fillStyle)).toEqual([BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]);
    // the bands stay within the hull's reach: nothing paints above the arch or below the hull bottom
    for (const band of bands) {
      const box = opBounds(band);
      expect(box.minY).toBeGreaterThanOrEqual(-12);
      expect(box.maxY).toBeLessThanOrEqual(8);
    }
  });

  it('draws the arch behind the hull, so its feet tuck behind the deck, and five flowers over it', () => {
    const arch = tubePairs(ops.slice(0, 2))[0];
    expect(arch.colour.strokeStyle).toBe(BOAT_TEAL);
    expect(ops.indexOf(arch.colour)).toBeLessThan(ops.findIndex((op) => isFill(op) && op.fillStyle === BOAT_HULL));
    const centres = ops.filter((op) => isFill(op) && op.fillStyle === BOAT_FLOWER_CENTRE);
    expect(centres).toHaveLength(5);
    const petals = ops.filter((op) => op.op === 'fill' && [BOAT_PINK, BOAT_YELLOW, BOAT_ORANGE].includes(op.fillStyle as string));
    // five flowers and the prow ball
    expect(petals).toHaveLength(6);
  });

  it('is a bright painted boat: three different painted colours plus a cream hull, on top of four ink-outlined fills of 4.5:1 or better', () => {
    expect(new Set(fillColours(ops).filter((c) => c !== BOAT_FLOWER_CENTRE)).size).toBeGreaterThanOrEqual(5);
  });

  it('has a flat bottom that dips just below the water line and a hull that rises well above it', () => {
    const hull = ops.find((op) => isFill(op) && op.fillStyle === BOAT_HULL) as Op;
    const box = tightBounds(cmdsOf(hull));
    expect(box.maxY).toBeGreaterThan(0);
    expect(box.maxY).toBeLessThanOrEqual(8);
    expect(box.minY).toBeLessThan(-15);
    // the prow is the raised end, toward +x
    const [, startX, startY] = cmdsOf(hull)[0] as [string, number, number];
    expect(startX).toBeLessThan(0);
    expect(startY).toBeGreaterThan(box.minY);
  });

  it('fits PUNTING_BOW_TEX with its ink and at least 4 px of padding, anchored on the water line', () => {
    expectPadded(ops, PUNTING_BOW_TEX);
    // the water line is local y 0: more art above it than below
    expect(PUNTING_BOW_TEX.originY).toBeGreaterThan(PUNTING_BOW_TEX.h - PUNTING_BOW_TEX.originY);
  });
});

describe('every painter', () => {
  const PAINTERS: readonly (readonly [string, (ctx: CanvasRenderingContext2D) => void])[] = [
    ['paintPuntingBow', paintPuntingBow],
    ['paintPuntingShadow', paintPuntingShadow],
    ['paintPuntingShaft', paintPuntingShaft],
    ['paintPuntingRing', paintPuntingRing],
    ['paintStalactite', paintStalactite],
    ['paintDripDrop', paintDripDrop],
    ['paintDripStream', paintDripStream],
    ['paintDripRing', paintDripRing],
    ['paintGeyserChimney', paintGeyserChimney],
    ['paintGeyserBubbles', paintGeyserBubbles],
    ['paintGeyserColumn', paintGeyserColumn],
    ['paintGeyserRing', paintGeyserRing],
  ];

  it.each(PAINTERS)('%s paints the same ops every time, so no time or randomness is in it', (_name, paint) => {
    const a = record(paint).ops;
    const b = record(paint).ops;
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it.each(PAINTERS)('%s never shows the axolotl: no eye bead, no poof, no text or image', (_name, paint) => {
    const { ops } = record(paint);
    expect(ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText' || op.op === 'drawImage')).toEqual([]);
    expect(fillColours(ops)).not.toContain(EYE);
  });
});

// ---------------------------------------------------------------------------
// The look table and the bake
// ---------------------------------------------------------------------------

interface Made {
  readonly made: Map<string, Recording>;
  readonly created: string[];
}

/** A scene stand-in whose canvas textures record what is painted on them. */
function withFakeScene<T>(run: (scene: never, made: Map<string, Recording>, created: string[]) => T): T {
  vi.stubGlobal('Path2D', LogPath);
  const made = new Map<string, Recording>();
  const created: string[] = [];
  const scene = {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string) => {
        const rec = recordingContext();
        made.set(key, rec);
        created.push(key);
        return { context: rec.ctx, refresh: () => undefined };
      },
    },
  } as never;
  try {
    return run(scene, made, created);
  } finally {
    vi.unstubAllGlobals();
  }
}

const bakeOnly = (looks: readonly string[], scale = 2): Made & { baked: ReturnType<typeof bakeMovingHazardTextures> } =>
  withFakeScene((scene, made, created) => ({ baked: bakeMovingHazardTextures(scene, scale, looks), made, created }));

const PUNTING_KEYS = ['punting-pole-bow', 'punting-pole-ring', 'punting-pole-shadow', 'punting-pole-shaft'];

describe('MOVING_HAZARD_LOOKS', () => {
  it("has 'punting-pole', and the logic's punting pole names it", () => {
    expect(Object.keys(MOVING_HAZARD_LOOKS)).toContain('punting-pole');
    expect(PUNTING_POLE.look).toBe('punting-pole');
    expect(MOVING_HAZARD_LOOKS['punting-pole'].id).toBe('punting-pole');
  });

  it('gives every look a painter and a frame for each of the four parts, keyed by its own id', () => {
    for (const [id, look] of Object.entries(MOVING_HAZARD_LOOKS)) {
      expect(look.id).toBe(id);
      expect(MOVING_HAZARD_PARTS).toEqual(['bow', 'shadow', 'shaft', 'ring']);
      for (const part of MOVING_HAZARD_PARTS) {
        expect(typeof look.parts[part].paint).toBe('function');
        expect(look.parts[part].tex.w).toBeGreaterThan(0);
        expect(look.parts[part].tex.h).toBeGreaterThan(0);
      }
    }
  });

  it('is frozen, so a look is added in the source and never at run time', () => {
    expect(Object.isFrozen(MOVING_HAZARD_LOOKS)).toBe(true);
  });

  it('builds a stable key from a look and a part', () => {
    expect(movingHazardTextureKey('punting-pole', 'bow')).toBe('punting-pole-bow');
    expect(movingHazardTextureKey('punting-pole', 'shadow')).toBe('punting-pole-shadow');
    expect(movingHazardTextureKey('punting-pole', 'shaft')).toBe('punting-pole-shaft');
    expect(movingHazardTextureKey('punting-pole', 'ring')).toBe('punting-pole-ring');
  });
});

describe('bakeMovingHazardTextures', () => {
  it('bakes the four punting pole textures under fixed keys, and returns them by look', () => {
    const { baked, made, created } = bakeOnly(['punting-pole']);
    expect([...created].sort()).toEqual(PUNTING_KEYS);
    expect(Object.keys(baked)).toEqual(['punting-pole']);
    const parts = baked['punting-pole'];
    expect(parts.bow.key).toBe('punting-pole-bow');
    expect(parts.shadow.key).toBe('punting-pole-shadow');
    expect(parts.shaft.key).toBe('punting-pole-shaft');
    expect(parts.ring.key).toBe('punting-pole-ring');
    for (const [, canvas] of made) expect(canvas.ops.length).toBeGreaterThan(0);
  });

  it('bakes each part at the bake scale and at its own size and anchor', () => {
    const { baked } = bakeOnly(['punting-pole'], 3);
    for (const [info, tex] of [
      [baked['punting-pole'].bow, PUNTING_BOW_TEX],
      [baked['punting-pole'].shadow, PUNTING_SHADOW_TEX],
      [baked['punting-pole'].shaft, PUNTING_SHAFT_TEX],
      [baked['punting-pole'].ring, PUNTING_RING_TEX],
    ] as const) {
      expect(info.scale).toBe(3);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([tex.w, tex.h, tex.originX, tex.originY]);
      expect(info.pxW).toBe(Math.ceil(tex.w * 3));
      expect(info.pxH).toBe(Math.ceil(tex.h * 3));
    }
  });

  it('paints each texture with its own painter', () => {
    const { made } = bakeOnly(['punting-pole'], 1);
    const bow = (made.get('punting-pole-bow') as Recording).ops;
    const shadow = (made.get('punting-pole-shadow') as Recording).ops;
    const shaft = (made.get('punting-pole-shaft') as Recording).ops;
    const ring = (made.get('punting-pole-ring') as Recording).ops;
    expect(fillColours(bow)).toContain(BOAT_HULL);
    expect(fillColours(shadow)).toEqual([BOAT_SHADOW]);
    expect(shaft.some((op) => isStroke(op) && op.strokeStyle === POLE_WOOD)).toBe(true);
    expect(ring.some((op) => isStroke(op) && op.strokeStyle === POLE_RING)).toBe(true);
    expect(JSON.stringify(shadow)).not.toBe(JSON.stringify(ring));
  });

  it('bakes only the looks it is given: none for an empty list', () => {
    const { baked, created } = bakeOnly([]);
    expect(created).toEqual([]);
    expect(baked).toEqual({});
  });

  it('bakes a look once however often it is listed', () => {
    const { baked, created } = bakeOnly(['punting-pole', 'punting-pole']);
    expect(created).toHaveLength(4);
    expect(new Set(created).size).toBe(4);
    expect(Object.keys(baked)).toEqual(['punting-pole']);
  });

  it('throws on an unknown look, and bakes nothing before it throws', () => {
    const created: string[] = [];
    expect(() =>
      withFakeScene((scene, _made, c) => {
        try {
          return bakeMovingHazardTextures(scene, 2, ['punting-pole', 'gondola']);
        } finally {
          created.push(...c);
        }
      }),
    ).toThrow(/unknown moving hazard look "gondola"/);
    expect(created).toEqual([]);
  });

  it('throws on an inherited name such as toString, not just a missing one', () => {
    expect(() => bakeOnly(['toString'])).toThrow(/unknown moving hazard look "toString"/);
    expect(() => bakeOnly([''])).toThrow(/unknown moving hazard look ""/);
  });
});

describe('movingHazardLookTextures', () => {
  it('returns the baked parts of a look', () => {
    const { baked } = bakeOnly(['punting-pole']);
    expect(movingHazardLookTextures(baked, 'punting-pole')).toBe(baked['punting-pole']);
  });

  it('throws when the look was not baked, so a view never draws a missing texture', () => {
    expect(() => movingHazardLookTextures({}, 'punting-pole')).toThrow(/no moving hazard look baked for "punting-pole"/);
    expect(() => movingHazardLookTextures({}, 'constructor')).toThrow(/no moving hazard look baked/);
  });
});

describe('the pole in the world', () => {
  it('is the pole the logic draws: its surface is the water line and its depth fits the shaft art', () => {
    expect(SURF).toBe(80);
    expect(PUNTING_POLE.depth).toBe(PUNTING_POLES.depth);
    // at full depth the art's top is still above the surface by more than the bow's deck
    expect(POLE_SHAFT_LENGTH - PUNTING_POLE.depth).toBeGreaterThanOrEqual(30);
  });
});

describe('the shaft in pieces at a spawn\'s own depth (issue #118, ND-4)', () => {
  const { ops } = record(paintPuntingShaft);
  /** Px of shaft above the surface: what MovingHazardView draws over the water at every depth. */
  const aboveSurface = POLE_SHAFT_LENGTH - PUNTING_POLE.depth;

  /** The pieces for a drawn length, as [from, to, lift]. */
  function piecesFor(length: number, fullLength: number): [number, number, number][] {
    const pieces: [number, number, number][] = [];
    for (let i = 0; i < poleShaftPieceCount(length, fullLength); i++) {
      pieces.push([poleShaftPieceFrom(i), poleShaftPieceTo(i, length, fullLength), poleShaftPieceLift(i)]);
    }
    return pieces;
  }

  it('is one piece cropped at the length, as before, when the full length fits the art (the default depth)', () => {
    expect(PUNTING_POLE.depth + aboveSurface).toBe(POLE_SHAFT_LENGTH);
    for (let length = 0; length <= POLE_SHAFT_LENGTH; length++) {
      expect(piecesFor(length, POLE_SHAFT_LENGTH)).toEqual([[0, Math.min(POLE_SHAFT_LENGTH, length), 0]]);
    }
  });

  it('copies rows midway between node rings, inside the wood and the shine, a whole number of node spacings apart', () => {
    const nodes = ops.filter((op) => isStroke(op) && op.strokeStyle === POLE_NODE);
    const nodeRows = nodes.map((op) => -(cmdsOf(op)[0].slice(1) as number[])[1]);
    for (const row of [POLE_TILE_FROM, POLE_TILE_TO]) {
      for (const [i, node] of nodes.entries()) {
        expect(Math.abs(row - nodeRows[i])).toBeGreaterThan(node.lineWidth / 2);
      }
    }
    const worn = tubePairs(ops).find(({ colour }) => colour.strokeStyle === POLE_FERRULE)?.colour as Op;
    const shine = ops.find((op) => isStroke(op) && op.strokeStyle === POLE_SHINE) as Op;
    const shinePath = tightBounds(cmdsOf(shine));
    expect(POLE_TILE_FROM).toBeGreaterThanOrEqual(-opBounds(worn).minY);
    expect(POLE_TILE_FROM).toBeGreaterThanOrEqual(-shinePath.maxY);
    expect(POLE_TILE_TO).toBeLessThanOrEqual(-shinePath.minY);
    expect(POLE_TILE_TO).toBeLessThan(POLE_SHAFT_LENGTH - POLE_SHAFT_W / 2);
    expect(POLE_TILE_TO).toBeGreaterThan(POLE_TILE_FROM);
    expect((POLE_TILE_TO - POLE_TILE_FROM) % POLE_NODE_SPACING).toBe(0);
  });

  it('stacks pieces that run from the tip to the length with no gap or overlap, each lifted by whole node spacings', () => {
    for (const depth of [340, 360, 400, 440]) {
      const fullLength = depth + aboveSurface;
      for (const length of [fullLength, fullLength - 1, fullLength - 100, 300, 200, 40, 10, 0]) {
        const pieces = piecesFor(length, fullLength);
        expect(pieces[0][0]).toBe(0);
        expect(pieces[0][2]).toBe(0);
        for (let i = 1; i < pieces.length; i++) {
          expect(pieces[i][2] + pieces[i][0]).toBe(pieces[i - 1][2] + pieces[i - 1][1]);
        }
        const last = pieces[pieces.length - 1];
        expect(last[2] + last[1]).toBe(length);
        for (const [from, to, lift] of pieces) {
          expect(lift % POLE_NODE_SPACING).toBe(0);
          expect(from).toBeGreaterThanOrEqual(0);
          expect(to).toBeLessThanOrEqual(POLE_SHAFT_LENGTH);
          expect(to).toBeGreaterThanOrEqual(from);
          if (pieces.length > 1) expect(to).toBeGreaterThan(from);
        }
      }
    }
  });

  it('draws a 440 px deep pole in three pieces', () => {
    const fullLength = 440 + aboveSurface;
    expect(poleShaftPieceCount(fullLength, fullLength)).toBe(3);
    expect(piecesFor(fullLength, fullLength)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Stalactite drip and geyser vent (issue #77, ND-3, option B)
// ---------------------------------------------------------------------------

/** Every part of the two spring cave looks, its painter and its frame. */
const SPRING_CAVE_PARTS: readonly (readonly [string, (ctx: CanvasRenderingContext2D) => void, TexSize])[] = [
  ['stalactite', paintStalactite, STALACTITE_TEX],
  ['drip drop', paintDripDrop, DRIP_DROP_TEX],
  ['drip stream', paintDripStream, DRIP_STREAM_TEX],
  ['drip rings', paintDripRing, DRIP_RING_TEX],
  ['geyser chimney', paintGeyserChimney, GEYSER_CHIMNEY_TEX],
  ['geyser bubbles', paintGeyserBubbles, GEYSER_BUBBLES_TEX],
  ['geyser column', paintGeyserColumn, GEYSER_COLUMN_TEX],
  ['geyser ring', paintGeyserRing, GEYSER_RING_TEX],
];

describe('stalactite drip and geyser vent contrast (guide 3c, 10)', () => {
  it.each([
    ['DRIP_WATER', DRIP_WATER],
    ['GEYSER_WATER', GEYSER_WATER],
    ['SPRING_ROCK', SPRING_ROCK],
  ])('%s reaches the outer edge, so it is 4.5:1 or better against INK', (_name, fill) => {
    expect(contrast(fill, INK)).toBeGreaterThanOrEqual(OUTER_FILL_RATIO);
  });

  it('the water is light and the rock is mid: the drips and the column read as light shapes in ink in greyscale', () => {
    expect(contrast(DRIP_WATER, INK)).toBeGreaterThanOrEqual(9);
    expect(contrast(GEYSER_WATER, INK)).toBeGreaterThanOrEqual(9);
    expect(luminance(DRIP_WATER)).toBeGreaterThan(luminance(SPRING_ROCK));
    expect(luminance(GEYSER_WATER)).toBeGreaterThan(luminance(SPRING_ROCK));
  });

  it('the rings are white and ink, as the pole ring is', () => {
    expect(DRIP_RING).toBe(WHITE);
    expect(GEYSER_RING).toBe(WHITE);
  });
});

describe('stalactite drip and geyser vent frames (guide 10)', () => {
  it.each(SPRING_CAVE_PARTS)('fits the %s in its frame with its ink and at least 4 px of padding', (_name, paint, tex) => {
    expectPadded(record(paint).ops, tex);
  });

  it.each(SPRING_CAVE_PARTS)('inks the %s: an opaque INK line is painted, and no eye, text or image', (_name, paint) => {
    const { ops } = record(paint);
    expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK && op.globalAlpha === 1)).toBe(true);
    expect(fillColours(ops)).not.toContain(EYE);
    expect(ops.filter((op) => op.op === 'fillText' || op.op === 'strokeText' || op.op === 'drawImage')).toEqual([]);
  });
});

describe('the stalactite (the bow of a roof hazard)', () => {
  const { ops } = record(paintStalactite);

  it('is one SPRING_ROCK cone hanging down from its anchor on the rock\'s underside to its tip, nothing of it over the rock', () => {
    const cone = ops.find((op) => isFill(op) && op.fillStyle === SPRING_ROCK) as Op;
    expect(cone).toBeDefined();
    const box = opBounds(cone);
    expect(box.minY).toBeCloseTo(0, 9);
    expect([box.minX, box.maxX]).toEqual([-STALACTITE_HALF_W, STALACTITE_HALF_W]);
    expect(box.maxY).toBeGreaterThan(STALACTITE_TIP_Y - 1);
    expect(box.maxY).toBeLessThanOrEqual(STALACTITE_TIP_Y + 1);
    expect(STALACTITE_TIP_Y).toBeGreaterThan(0);
    for (const op of ops) expect(opBounds(op).minY).toBeGreaterThanOrEqual(-STALACTITE_TEX.originY + MIN_PAD);
  });

  it('inks its sides and tip but not its root, so it grows out of the ledge\'s rock with no line across it', () => {
    const ink = ops.filter((op) => isStroke(op) && op.strokeStyle === INK);
    expect(ink).toHaveLength(1);
    const box = opBounds(ink[0]);
    expect(box.maxY).toBeGreaterThan(STALACTITE_TIP_Y - 1);
    expect(cmdsOf(ink[0]).map((cmd) => cmd[0])).not.toContain('closePath');
    expect(cmdsOf(ink[0])[0]).toEqual(['moveTo', -STALACTITE_HALF_W, 0]);
  });

  it('hangs the drop from its tip: its pointed top behind the stalactite, its round part below the tip, DRIP_DROP_ALONG px under the rock', () => {
    const drop = record(paintDripDrop).ops.find((op) => isFill(op) && op.fillStyle === DRIP_WATER) as Op;
    const box = opBounds(drop);
    expect(DRIP_DROP_ALONG).toBe(STALACTITE_TIP_Y + 2);
    expect(DRIP_DROP_ALONG + box.minY).toBeLessThan(STALACTITE_TIP_Y);
    expect(DRIP_DROP_ALONG + box.maxY).toBeGreaterThan(STALACTITE_TIP_Y);
  });

  it('grows the ripple rings just under the drop, clear of it', () => {
    expect(DRIP_RING_ALONG - DRIP_RING_RY).toBeGreaterThan(DRIP_DROP_ALONG + DRIP_DROP_R);
  });
});

describe('the drip stream (the shaft of a roof hazard)', () => {
  const { ops } = record(paintDripStream);

  it('is the logic stream: drips as wide as twice the halfWidth, the art reaching every Area 6 stalactite from its rock', () => {
    expect(2 * DRIP_HALF_W).toBe(2 * STALACTITE_DRIP.halfWidth);
    const place = movingHazardLookPlace(STALACTITE_DRIP.look);
    for (const spawn of (SPRING_CAVE_LAYOUT.movingHazards ?? []).filter((each) => each.type === STALACTITE_DRIP)) {
      expect(movingHazardDepth(spawn) + place.shaftPastBase, spawn.id).toBeLessThanOrEqual(DRIP_STREAM_LENGTH);
    }
  });

  it('has its lowest drip on the anchor and the art running up from it, a drip every DRIP_SPACING px', () => {
    const drips = ops.filter((op) => isFill(op) && op.fillStyle === DRIP_WATER);
    expect(drips).toHaveLength(DRIP_COUNT);
    const centres = drips.map((op) => ellipsesOf(op)[0][1]);
    for (let i = 1; i < centres.length; i++) expect(centres[i - 1] - centres[i]).toBeCloseTo(DRIP_SPACING, 9);
    for (const op of ops) expect(opBounds(op).maxY).toBeLessThanOrEqual(1 + EPS);
    expect(Math.min(...ops.map((op) => opBounds(op).minY))).toBeLessThan(-DRIP_STREAM_LENGTH);
  });
});

describe('the geyser chimney and column (the bow and shaft of a floor hazard)', () => {
  it('sits the chimney on the bed: its mouth GEYSER_MOUTH_RISE px up, its foot sunk GEYSER_FOOT_DROP px into the bed', () => {
    const cone = record(paintGeyserChimney).ops.find((op) => isFill(op) && op.fillStyle === SPRING_ROCK) as Op;
    const box = opBounds(cone);
    expect(box.maxY).toBeCloseTo(GEYSER_FOOT_DROP, 9);
    expect(box.minY).toBeLessThanOrEqual(-GEYSER_MOUTH_RISE);
    expect(box.minY).toBeGreaterThan(-GEYSER_MOUTH_RISE - 3);
  });

  it('is the logic column: as wide as twice the halfWidth, the art reaching the Area 6 geyser past the bed', () => {
    expect(GEYSER_COLUMN_W).toBe(2 * GEYSER_VENT.halfWidth);
    const place = movingHazardLookPlace(GEYSER_VENT.look);
    for (const spawn of (SPRING_CAVE_LAYOUT.movingHazards ?? []).filter((each) => each.type === GEYSER_VENT)) {
      expect(movingHazardDepth(spawn) + place.shaftPastBase, spawn.id).toBeLessThanOrEqual(GEYSER_COLUMN_LENGTH);
    }
  });

  it('has the column top at the anchor and the art running DOWN from it, as the column goes up from the bed', () => {
    const { ops } = record(paintGeyserColumn);
    const water = tubePairs(ops).find(({ colour }) => colour.strokeStyle === GEYSER_WATER)?.colour as Op;
    expect(water.lineWidth).toBe(GEYSER_COLUMN_W);
    expect(opBounds(water).minY).toBeCloseTo(0, 9);
    expect(opBounds(water).maxY).toBeCloseTo(GEYSER_COLUMN_LENGTH + GEYSER_COLUMN_W / 2, 9);
    expect(GEYSER_COLUMN_TEX.originY).toBeLessThanOrEqual(2 + MIN_PAD + 1);
  });

  it('puts the bubbles over the mouth, clear of the chimney', () => {
    expect(GEYSER_BUBBLES_RISE - GEYSER_BUBBLES_TEX.h + GEYSER_BUBBLES_TEX.originY).toBeGreaterThan(GEYSER_MOUTH_RISE - MIN_PAD);
  });
});

describe('look places (issue #77, ND-3)', () => {
  it('keeps the pole where it was: 44 px of shaft over the surface, lifted 24 px at rest, its shadow 14 px down, its ring on the water, stacking', () => {
    expect(movingHazardLookPlace('punting-pole')).toEqual({
      shaftPastBase: POLE_SHAFT_LENGTH - PUNTING_POLES.depth,
      restBack: 24,
      shadowAlong: PUNTING_SHADOW_DROP,
      ringAlong: 0,
      shaftLength: POLE_SHAFT_LENGTH,
      stacks: true,
    });
    expect(POLE_SHAFT_LENGTH - PUNTING_POLES.depth).toBe(44);
  });

  it('hides the drip stream and the geyser column at rest, so only the warning cues show before the strike', () => {
    for (const look of ['stalactite-drip', 'geyser-vent']) {
      const place = movingHazardLookPlace(look);
      expect(place.restBack, look).toBe(place.shaftPastBase);
      expect(place.stacks, look).toBe(false);
    }
    expect(movingHazardLookPlace('stalactite-drip')).toMatchObject({
      shaftPastBase: 0,
      shadowAlong: DRIP_DROP_ALONG,
      ringAlong: DRIP_RING_ALONG,
      shaftLength: DRIP_STREAM_LENGTH,
    });
    expect(movingHazardLookPlace('geyser-vent')).toMatchObject({ shadowAlong: GEYSER_BUBBLES_RISE, ringAlong: GEYSER_MOUTH_RISE, shaftLength: GEYSER_COLUMN_LENGTH });
  });

  it('names every logic type\'s look, and throws on an unknown one', () => {
    for (const type of [PUNTING_POLE, STALACTITE_DRIP, GEYSER_VENT]) expect(MOVING_HAZARD_LOOKS[type.look].id).toBe(type.look);
    expect(Object.keys(MOVING_HAZARD_LOOKS)).toEqual(['punting-pole', 'stalactite-drip', 'geyser-vent']);
    expect(() => movingHazardLookPlace('gondola')).toThrow(/unknown moving hazard look "gondola"/);
    expect(() => movingHazardLookPlace('toString')).toThrow(/unknown moving hazard look/);
  });

  it('bakes the four stalactite drip and geyser vent textures under their own keys', () => {
    const { baked, created } = bakeOnly(['stalactite-drip', 'geyser-vent']);
    expect([...created].sort()).toEqual(
      ['stalactite-drip', 'geyser-vent'].flatMap((look) => MOVING_HAZARD_PARTS.map((part) => movingHazardTextureKey(look, part))).sort(),
    );
    expect(Object.keys(baked)).toEqual(['stalactite-drip', 'geyser-vent']);
  });
});
