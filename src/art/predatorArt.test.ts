/**
 * Tilapia, heron, garter snake, carp, crayfish, protected ring and leg icon colour rules (guide 3g, 6q, 10), headless.
 * The painters run against a recording context and a stub Path2D (the same approach as
 * treasureArt.test.ts): every fill and stroke is kept with the style, width and alpha it
 * was painted under, and every context call is logged.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  CARP_BARBEL,
  CARP_BELLY,
  CARP_BODY,
  CARP_BODY_RX,
  CARP_BODY_RY,
  CARP_FIN,
  CARP_FRAMES,
  CARP_PUFF,
  CARP_PUFF_LOBES,
  CARP_PUFF_SPECKS,
  CARP_PUFF_TEX,
  CARP_SCALE,
  CARP_SHINE,
  CARP_SWIM_FRAMES,
  CARP_TEX,
  carpGeometry,
  carpNoseTip,
  paintCarp,
  paintCarpPuff,
  paintCarpPuffStill,
  type CarpFrame,
} from './drawCarp';
import {
  CRAYFISH_BELLY,
  CRAYFISH_CLAW,
  CRAYFISH_DARK,
  CRAYFISH_EYE_BALL_R,
  CRAYFISH_FOOT_Y,
  CRAYFISH_FRAMES,
  CRAYFISH_SHELL,
  CRAYFISH_SHELL_RX,
  CRAYFISH_SHELL_RY,
  CRAYFISH_SHINE,
  CRAYFISH_TEX,
  CRAYFISH_WALK_FRAMES,
  crayfishGeometry,
  paintCrayfish,
  type CrayfishFrame,
} from './drawCrayfish';
import { HALO_RX, HALO_RY, paintProtectedHalo } from './drawEffects';
import {
  HERON_BEAK,
  HERON_BEAK_REST_TIP,
  HERON_BODY_TEX,
  HERON_FEATHER,
  HERON_FEATHER_LINE,
  HERON_FEET_DROP,
  HERON_HEAD_CENTER,
  HERON_HEAD_TEX,
  HERON_HEAD_TIP,
  HERON_NECK_BASE,
  HERON_SHINE,
  HERON_STAB_HEAD_BACK,
  HERON_STAB_HEAD_TEX,
  HERON_STAB_NECK_LEN,
  HERON_STAB_NECK_TEX,
  HERON_WATER_LINE_Y,
  paintHeronBody,
  paintHeronHead,
  paintHeronStabHead,
  paintHeronStabNeck,
  type HeronBodyFrame,
  type HeronHeadPose,
} from './drawHeron';
import {
  GARTER_BODY,
  GARTER_NOSE_TIP,
  GARTER_RIPPLE_RX,
  GARTER_RIPPLE_RY,
  GARTER_RIPPLE_TEX,
  GARTER_SHINE,
  GARTER_SNAKE_FRAMES,
  GARTER_SNAKE_TEX,
  GARTER_STRIPE,
  GARTER_SWIM_FRAMES,
  paintGarterRipple,
  paintGarterSnake,
  type GarterSnakeFrame,
} from './drawGarterSnake';
import { DEPTH } from './layers';
import { paintLegIcon } from './drawLegIcons';
import { paintTilapia, type TilapiaPose } from './drawTilapia';
import {
  ALERT_FILL,
  CAVE_INTERIOR,
  BUBBLE_FILL,
  BUBBLE_STROKE,
  CARRY_RIM,
  EYE,
  INK,
  LEGS_FILL,
  LW,
  POOF_PUFF,
  POOF_SHINE,
  POOF_SPARKLE,
  PROTECTED_RING_GLINT,
  PROTECTED_RING_INNER,
  PROTECTED_RING_OUTER,
  TILAPIA_BARS,
  TILAPIA_BELLY,
  TILAPIA_BODY,
  TILAPIA_FIN,
  TILAPIA_LINE,
  TILAPIA_MOUTH,
  TILAPIA_SHINE,
  UI_PANEL,
  UI_PRIMARY,
  WHITE,
} from './palette';
import { PREDATOR_TEX, bakePredatorTextures, legIconKey, tilapiaKey } from './predatorTextures';
import type { TexSize } from './canvasKit';

vi.mock('phaser', () => ({}));

/** Every tilapia pose and whether its eye is the open bead (guide 7c); a missing pose is a type error. */
const POSE_EYE_OPEN: Readonly<Record<TilapiaPose, boolean>> = { swim: true, windup: true, lunge: true, rest: false };
const TILAPIA_POSES = Object.keys(POSE_EYE_OPEN) as TilapiaPose[];
/** Tilapia fills that reach the outer edge, against the ink outline (guide 3g). */
const TILAPIA_INK_RATIO = 9;
/** Luminance a fill needs for 9:1 against INK. */
const TILAPIA_MIN_LUMINANCE = 0.607;
/** Outer-edge blobs per pose: tail fin, dorsal fin, anal fin, body. */
const TILAPIA_BLOBS = 4;
/** Leg fill against the white HUD panel (guide 10, 3:1 for icons). */
const LEGS_PANEL_RATIO = 3;
/** Leg capsules: the leg and three toes. */
const LEG_PARTS = 4;
/** Legs display ink width, dash and gap (guide 6q, 12). */
const LEG_ICON_INK = 2.4;
const LEG_ICON_DASH = [2, 4.6];
/** Protected ring radii, widths, inset and glint (guide 6q). */
const RING_RX = 84;
const RING_RY = 54;
const RING_OUTER_W = 2.0;
const RING_INNER_W = 2.4;
const RING_INNER_INSET = 2.2;
const RING_GLINT_W = 3;
const RING_GLINT_INSET = 2.7;
const RING_GLINT_LEN = 0.5;
const RING_GLINT_MID = Math.PI * 1.25;
const TAU = Math.PI * 2;
const EPS = 1e-9;

/**
 * Every palette constant behind the tilapia, telegraph, legs display, leg-loss puff,
 * protected ring and carried-home bubble rows, with the literal value the guide prints
 * (3a, 3d, 3g, 7c). Written out here, never read from the palette, so a palette change
 * that the guide does not record fails.
 */
const DOCUMENTED_COLOURS: readonly (readonly [string, string, string])[] = [
  ['INK', INK, '#2b2350'],
  ['WHITE', WHITE, '#ffffff'],
  ['UI_PANEL', UI_PANEL, '#ffffff'],
  ['EYE (tilapia eye)', EYE, '#1b1535'],
  ['TILAPIA_BODY', TILAPIA_BODY, '#c2d2bb'],
  ['TILAPIA_FIN', TILAPIA_FIN, '#d4e0d0'],
  ['TILAPIA_BELLY', TILAPIA_BELLY, '#e3eadf'],
  ['TILAPIA_BARS', TILAPIA_BARS, 'rgba(70,95,80,0.22)'],
  ['TILAPIA_LINE', TILAPIA_LINE, 'rgba(70,95,80,0.4)'],
  ['TILAPIA_SHINE', TILAPIA_SHINE, 'rgba(255,255,255,0.6)'],
  ['TILAPIA_MOUTH', TILAPIA_MOUTH, '#e8567e'],
  ['ALERT_FILL (telegraph bubble)', ALERT_FILL, '#ffe14a'],
  ['LEGS_FILL', LEGS_FILL, '#e8567e'],
  ['UI_PRIMARY (regrowing mark)', UI_PRIMARY, '#ffe14a'],
  ['POOF_PUFF', POOF_PUFF, '#ffffff'],
  ['POOF_SHINE', POOF_SHINE, '#cfeeff'],
  ['POOF_SPARKLE', POOF_SPARKLE, '#ffe14a'],
  ['PROTECTED_RING_OUTER', PROTECTED_RING_OUTER, '#2b2350'],
  ['PROTECTED_RING_INNER', PROTECTED_RING_INNER, '#ffffff'],
  ['PROTECTED_RING_GLINT', PROTECTED_RING_GLINT, '#ffffff'],
  ['GARTER_BODY', GARTER_BODY, '#6f9a45'],
  ['GARTER_STRIPE', GARTER_STRIPE, '#efe49a'],
  ['GARTER_SHINE', GARTER_SHINE, 'rgba(255,255,255,0.55)'],
  ['CARP_BODY', CARP_BODY, '#c9973f'],
  ['CARP_BELLY', CARP_BELLY, '#f2dea0'],
  ['CARP_FIN', CARP_FIN, '#a66f2a'],
  ['CARP_BARBEL', CARP_BARBEL, '#8d5a1f'],
  ['CARP_SCALE', CARP_SCALE, 'rgba(120,75,20,0.4)'],
  ['CARP_SHINE', CARP_SHINE, 'rgba(255,255,255,0.5)'],
  ['CARP_PUFF', CARP_PUFF, '#d6c29a'],
  ['BUBBLE_FILL (carried-home bubble)', BUBBLE_FILL, 'rgba(255,255,255,0.38)'],
  ['CARRY_RIM', CARRY_RIM, 'rgba(255,255,255,0.9)'],
  ['BUBBLE_STROKE (carried-home bubble)', BUBBLE_STROKE, 'rgba(43,35,80,0.85)'],
];

/** Contrast ratios of the real constants, exactly as the guide prints them (3g, 10), to 2 decimals. */
const DOCUMENTED_RATIOS: readonly (readonly [string, string, string, number])[] = [
  ['TILAPIA_BODY vs INK', TILAPIA_BODY, INK, 9.07],
  ['TILAPIA_FIN vs INK', TILAPIA_FIN, INK, 10.54],
  ['TILAPIA_BELLY vs INK', TILAPIA_BELLY, INK, 11.72],
  ['EYE vs TILAPIA_BODY', EYE, TILAPIA_BODY, 10.98],
  ['ALERT_FILL vs INK', ALERT_FILL, INK, 11.05],
  ['LEGS_FILL vs UI_PANEL', LEGS_FILL, UI_PANEL, 3.46],
  ['LEGS_FILL vs INK', LEGS_FILL, INK, 4.16],
  ['UI_PRIMARY vs INK', UI_PRIMARY, INK, 11.05],
  ['POOF_PUFF vs INK', POOF_PUFF, INK, 14.39],
  ['POOF_SPARKLE vs INK', POOF_SPARKLE, INK, 11.05],
  ['PROTECTED_RING_INNER vs PROTECTED_RING_OUTER', PROTECTED_RING_INNER, PROTECTED_RING_OUTER, 14.39],
  ['GARTER_BODY vs INK', GARTER_BODY, INK, 4.38],
  ['GARTER_STRIPE vs INK', GARTER_STRIPE, INK, 11.13],
  ['GARTER_STRIPE vs GARTER_BODY', GARTER_STRIPE, GARTER_BODY, 2.54],
  ['CARP_BODY vs INK', CARP_BODY, INK, 5.47],
  ['CARP_BELLY vs INK', CARP_BELLY, INK, 10.78],
  ['CARP_FIN vs INK', CARP_FIN, INK, 3.38],
  ['CARP_BARBEL vs INK', CARP_BARBEL, INK, 2.48],
  ['CARP_PUFF vs INK', CARP_PUFF, INK, 8.25],
  ['CARP_BELLY vs CARP_BODY', CARP_BELLY, CARP_BODY, 1.97],
  ['CARP_BODY vs CARP_FIN', CARP_BODY, CARP_FIN, 1.62],
];

/**
 * "Fill or ink is X:1 or better on any background" (guide 3g, 10): the square root of the
 * pair ratio must be at least the printed value and within 0.01 of it.
 */
const DOCUMENTED_WORST_CASE: readonly (readonly [string, string, string, number])[] = [
  ['TILAPIA_BODY or INK', TILAPIA_BODY, INK, 3.01],
  ['TILAPIA_BELLY or INK', TILAPIA_BELLY, INK, 3.42],
  ['ALERT_FILL or INK', ALERT_FILL, INK, 3.32],
  ['protected ring, PROTECTED_RING_INNER or PROTECTED_RING_OUTER', PROTECTED_RING_INNER, PROTECTED_RING_OUTER, 3.79],
  ['garter snake ripple ring, WHITE or INK', WHITE, INK, 3.79],
];

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

// ---------------------------------------------------------------------------
// A recording canvas context
// ---------------------------------------------------------------------------

/** A Path2D stand-in that keeps its commands (nested paths inline). */
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
  readonly globalAlpha: number;
}

const DRAW_OPS = new Set(['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
const STATE_KEYS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha'] as const;

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  readonly ops: Op[];
  readonly calls: [string, unknown[]][];
}

/** A context that records every draw call and path call. Supports save and restore. */
function recordingContext(): Recording {
  const ops: Op[] = [];
  const calls: [string, unknown[]][] = [];
  let state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
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

/**
 * The outer-edge fills of a painting: fills that `blob` paints straight after an ink
 * stroke of 2 x LW on the same path, so the ink sits outside the fill.
 */
function blobPairs(ops: readonly Op[]): { ink: Op; fill: Op }[] {
  const pairs: { ink: Op; fill: Op }[] = [];
  for (let i = 1; i < ops.length; i++) {
    const prev = ops[i - 1];
    const op = ops[i];
    const isOutline = isStroke(prev) && Math.abs(prev.lineWidth - 2 * LW) < EPS;
    if (isFill(op) && isOutline && JSON.stringify(prev.args) === JSON.stringify(op.args)) {
      pairs.push({ ink: prev, fill: op });
    }
  }
  return pairs;
}

/** The single `ellipse` command of a recorded path, as [cx, cy, rx, ry, rot, start, end]. */
function ellipseOf(op: Op): number[] {
  const cmds = op.args[0] as unknown[][];
  const ellipses = cmds.filter((cmd) => cmd[0] === 'ellipse');
  expect(ellipses).toHaveLength(1);
  return ellipses[0].slice(1) as number[];
}

// ---------------------------------------------------------------------------
// Documented ratios
// ---------------------------------------------------------------------------

describe('palette values match the guide (3a, 3d, 3g, 7c)', () => {
  it.each(DOCUMENTED_COLOURS)('%s is %s as printed', (_name, constant, documented) => {
    expect(constant).toBe(documented);
  });
});

describe('contrast ratios match the guide (3g, 10)', () => {
  it.each(DOCUMENTED_RATIOS)('%s is %s:1 as printed', (_name, a, b, documented) => {
    expect(contrastRatio(a, b).toFixed(2)).toBe(documented.toFixed(2));
  });

  it.each(DOCUMENTED_WORST_CASE)('%s is %s:1 or better on any background', (_name, a, b, documented) => {
    const worst = Math.sqrt(contrastRatio(a, b));
    expect(worst).toBeGreaterThanOrEqual(documented);
    expect(worst).toBeLessThan(documented + 0.01);
  });
});

// ---------------------------------------------------------------------------
// Tilapia
// ---------------------------------------------------------------------------

describe('tilapia colours (guide 3g)', () => {
  it.each([
    ['TILAPIA_BODY', TILAPIA_BODY],
    ['TILAPIA_FIN', TILAPIA_FIN],
    ['TILAPIA_BELLY', TILAPIA_BELLY],
  ])('%s reaches the outer edge, so it is at least 9:1 against INK', (_name, fill) => {
    expect(relativeLuminance(fill)).toBeGreaterThanOrEqual(TILAPIA_MIN_LUMINANCE);
    expect(contrastRatio(fill, INK)).toBeGreaterThanOrEqual(TILAPIA_INK_RATIO);
  });

  it.each(TILAPIA_POSES)('%s: the belly band is an opaque TILAPIA_BELLY fill inside the body clip', (pose) => {
    const { ops, calls } = record((ctx) => paintTilapia(ctx, pose));
    const belly = ops.filter((op) => isFill(op) && op.fillStyle === TILAPIA_BELLY);
    expect(belly).toHaveLength(1);
    expect(belly[0].globalAlpha).toBe(1);
    expect(calls.map(([name]) => name)).toContain('clip');
  });

  it.each(TILAPIA_POSES)(
    '%s: bars, fin rays, gill line, shine and lunge mouth use their own palette values (7c)',
    (pose) => {
      const { ops } = record((ctx) => paintTilapia(ctx, pose));
      const strokesIn = (style: string): Op[] => ops.filter((op) => isStroke(op) && op.strokeStyle === style);
      const fillsIn = (style: string): Op[] => ops.filter((op) => isFill(op) && op.fillStyle === style);
      // three bars, 4.5 wide
      const bars = strokesIn(TILAPIA_BARS);
      expect(bars).toHaveLength(3);
      for (const op of bars) expect(op.lineWidth).toBeCloseTo(4.5, 9);
      // fin rays 1.5 (tail and dorsal) and the gill line 2
      expect(strokesIn(TILAPIA_LINE).map((op) => op.lineWidth).sort()).toEqual([1.5, 1.5, 2]);
      expect(fillsIn(TILAPIA_SHINE)).toHaveLength(1);
      expect(fillsIn(TILAPIA_MOUTH)).toHaveLength(pose === 'lunge' ? 1 : 0);
    },
  );

  it.each(TILAPIA_POSES)('%s: the eye bead is EYE only when the eye is open', (pose) => {
    const { ops } = record((ctx) => paintTilapia(ctx, pose));
    const beads = ops.filter((op) => isFill(op) && op.fillStyle === EYE);
    expect(beads).toHaveLength(POSE_EYE_OPEN[pose] ? 1 : 0);
  });

  it.each(TILAPIA_POSES)('%s: every outer-edge fill is TILAPIA_BODY or TILAPIA_FIN, inked in opaque INK', (pose) => {
    const { ops } = record((ctx) => paintTilapia(ctx, pose));
    const pairs = blobPairs(ops);
    expect(pairs).toHaveLength(TILAPIA_BLOBS);
    for (const { ink, fill } of pairs) {
      expect([TILAPIA_BODY, TILAPIA_FIN]).toContain(fill.fillStyle);
      expect(fill.globalAlpha).toBe(1);
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.globalAlpha).toBe(1);
    }
    expect(pairs.at(-1)?.fill.fillStyle).toBe(TILAPIA_BODY);
  });

  it.each(TILAPIA_POSES)('%s: every ink stroke is opaque INK at alpha 1', (pose) => {
    const { ops } = record((ctx) => paintTilapia(ctx, pose));
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    const inkStrokes = ops.filter((op) => isStroke(op) && op.strokeStyle === INK);
    expect(inkStrokes.length).toBeGreaterThanOrEqual(TILAPIA_BLOBS);
    expect(INK).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ---------------------------------------------------------------------------
// Protected ring
// ---------------------------------------------------------------------------

describe('protected ring (guide 6q)', () => {
  const rec = (): Recording => record((ctx) => paintProtectedHalo(ctx));

  it('strokes only opaque #rrggbb colours at alpha 1, with no fill and no dashes', () => {
    const { ops, calls } = rec();
    // the outer line, the inner line and the glint: nothing else
    expect(ops).toHaveLength(3);
    for (const op of ops) {
      expect(isStroke(op), op.op).toBe(true);
      expect(op.strokeStyle).toMatch(/^#[0-9a-f]{6}$/i);
      expect(op.globalAlpha).toBe(1);
    }
    const names = calls.map(([name]) => name);
    expect(names.filter((name) => name.startsWith('fill'))).toEqual([]);
    expect(names).not.toContain('setLineDash');
  });

  it('has an ink line, a white line set inside it, and a white glint', () => {
    const { ops } = rec();
    const outer = ops.find(
      (op) => op.strokeStyle === PROTECTED_RING_OUTER && Math.abs(op.lineWidth - RING_OUTER_W) < EPS,
    );
    const inner = ops.find(
      (op) => op.strokeStyle === PROTECTED_RING_INNER && Math.abs(op.lineWidth - RING_INNER_W) < EPS,
    );
    const glint = ops.find(
      (op) => op.strokeStyle === PROTECTED_RING_GLINT && Math.abs(op.lineWidth - RING_GLINT_W) < EPS,
    );
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(glint).toBeDefined();

    expect(HALO_RX).toBe(RING_RX);
    expect(HALO_RY).toBe(RING_RY);
    const [, , outerRx, outerRy, , outerStart, outerEnd] = ellipseOf(outer as Op);
    expect(outerRx).toBeCloseTo(RING_RX, 9);
    expect(outerRy).toBeCloseTo(RING_RY, 9);
    expect(outerEnd - outerStart).toBeCloseTo(TAU, 9);

    const [, , innerRx, innerRy, , innerStart, innerEnd] = ellipseOf(inner as Op);
    expect(outerRx - innerRx).toBeCloseTo(RING_INNER_INSET, 9);
    expect(outerRy - innerRy).toBeCloseTo(RING_INNER_INSET, 9);
    expect(innerEnd - innerStart).toBeCloseTo(TAU, 9);

    const [, , glintRx, glintRy, , glintStart, glintEnd] = ellipseOf(glint as Op);
    expect(outerRx - glintRx).toBeCloseTo(RING_GLINT_INSET, 9);
    expect(outerRy - glintRy).toBeCloseTo(RING_GLINT_INSET, 9);
    expect(glintEnd - glintStart).toBeCloseTo(RING_GLINT_LEN, 9);
    expect((glintStart + glintEnd) / 2).toBeCloseTo(RING_GLINT_MID, 9);
    // the glint's outer edge stays inside the ink line's inner edge
    expect(glintRx + RING_GLINT_W / 2).toBeLessThanOrEqual(outerRx - RING_OUTER_W / 2);
    expect(glintRy + RING_GLINT_W / 2).toBeLessThanOrEqual(outerRy - RING_OUTER_W / 2);
  });
});

// ---------------------------------------------------------------------------
// Leg icons
// ---------------------------------------------------------------------------

describe('leg icons (guide 3g, 10)', () => {
  it('LEGS_FILL is at least 3:1 against UI_PANEL', () => {
    expect(contrastRatio(LEGS_FILL, UI_PANEL)).toBeGreaterThanOrEqual(LEGS_PANEL_RATIO);
  });

  it("'present' fills every part with LEGS_FILL inside a solid ink outline", () => {
    const { ops, calls } = record((ctx) => paintLegIcon(ctx, 'present'));
    const fills = ops.filter(isFill);
    expect(fills).toHaveLength(LEG_PARTS);
    for (const op of fills) {
      expect(op.fillStyle).toBe(LEGS_FILL);
      expect(op.globalAlpha).toBe(1);
    }
    const inks = ops.filter((op) => isStroke(op) && op.strokeStyle === INK);
    expect(inks).toHaveLength(LEG_PARTS);
    // the fill covers the inner half of the stroke, so 2 x ink shows as ink 2.4 outside
    for (const op of inks) expect(op.lineWidth).toBeCloseTo(2 * LEG_ICON_INK, 9);
    expect(calls.map(([name]) => name)).not.toContain('setLineDash');
  });

  it("'outline' (the regrowing base) has no fill and a dashed ink edge, ink 2.4, dash 2, gap 4.6", () => {
    const { ops, calls } = record((ctx) => paintLegIcon(ctx, 'outline'));
    expect(ops.filter(isFill)).toEqual([]);
    const strokes = ops.filter(isStroke);
    expect(strokes).toHaveLength(LEG_PARTS);
    for (const op of strokes) {
      expect(op.strokeStyle).toBe(INK);
      expect(op.lineWidth).toBeCloseTo(LEG_ICON_INK, 9);
    }
    const dashes = calls.filter(([name]) => name === 'setLineDash').map(([, args]) => args[0]);
    expect(dashes).toContainEqual(LEG_ICON_DASH);
  });
});

// ---------------------------------------------------------------------------
// Heron
// ---------------------------------------------------------------------------

/**
 * Pond backgrounds the heron can stand in front of (guide 3c): water shallow, mid and
 * deep, bed top and bottom, and a grey at the pond floor, luminance 0.1687 (the darkest
 * any pond background may be). Written out, never read from habitatLook.
 */
const POND_BACKGROUNDS: readonly (readonly [string, string])[] = [
  ['water shallow', '#a4e57a'],
  ['water mid', '#58bf6a'],
  ['water deep', '#2f8f58'],
  ['bed top', '#b8a064'],
  ['bed bottom', '#9a8450'],
  ['pond floor grey', '#737373'],
];
/** The guide's least padding round a sprite at 1x. */
const MIN_PAD = 4;
/** The hero's belly: no heron fill is lighter (guide 7c hierarchy). */
const HERO_BELLY = '#ffe3ed';

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

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The frame as a box in local units. */
function frameBox(tex: TexSize): Box {
  return { minX: -tex.originX, minY: -tex.originY, maxX: tex.w - tex.originX, maxY: tex.h - tex.originY };
}

describe('heron colours (guide 3g, 10)', () => {
  it.each([
    ['HERON_FEATHER', HERON_FEATHER],
    ['HERON_BEAK', HERON_BEAK],
  ])('%s reaches the outer edge, so it is at least 9:1 against INK and not lighter than the hero belly', (_name, fill) => {
    expect(relativeLuminance(fill)).toBeGreaterThanOrEqual(TILAPIA_MIN_LUMINANCE);
    expect(contrastRatio(fill, INK)).toBeGreaterThanOrEqual(TILAPIA_INK_RATIO);
    expect(relativeLuminance(fill)).toBeLessThan(relativeLuminance(HERO_BELLY));
  });

  it('the head shine is a see-through white', () => {
    const [r, g, b, a] = rgbaOf(HERON_SHINE);
    expect([r, g, b]).toEqual([255, 255, 255]);
    expect(a).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Wading heron (issue #111; art guide 7h)
// ---------------------------------------------------------------------------

/** Every body frame and head pose; a missing one is a type error. */
const BODY_FRAME_LIST = Object.keys({ stand: 0, stepA: 0, stepB: 0 } satisfies Record<HeronBodyFrame, 0>) as HeronBodyFrame[];
const HEAD_POSE_LIST = Object.keys({ rest: 0, warn: 0 } satisfies Record<HeronHeadPose, 0>) as HeronHeadPose[];
/** Leg tube: colour 4, ink 2.6 each side. */
const LEG_W = 4;
const LEG_OL = 2.6;
/** Neck tube 9 and head capsule 18, ink LW each side. */
const NECK_W = 9;
const HEAD_W = 18;
/** The stretch line y 120 (HERON_STRETCH_Y in src/logic/pond2Layout.ts) and the art water line, written out. */
const STRETCH_Y = 120;
const ART_WATER_LINE_Y = 83;
/** The darkest the opaque ink may be on a heron background (guide 3c, 10). */
const INK_EDGE_RATIO = 3;
/** The recorded bank-soil exception (guide 3c): ink on the dusk bank soil, under the wash. */
const BANK_SOIL = '#a2623a';
const DUSK_WASH = 'rgba(150,80,100,0.14)';

/**
 * Backgrounds the wading heron stands in front of at dusk (guide 3c), written out, never
 * read from habitatLook: water shallow, mid and deep, bed top and bottom, the mud dots
 * over the bed bottom, and the sky through the air wash (top and horizon). The pond
 * ones are in POND_BACKGROUNDS.
 */
const DUSK_BACKGROUNDS: readonly (readonly [string, string])[] = [
  ['dusk water shallow', '#b4d872'],
  ['dusk water mid', '#6fae5c'],
  ['dusk water deep', '#428a4e'],
  ['dusk bed top', '#b09060'],
  ['dusk bed bottom', '#9a7c4c'],
  ['dusk mud dots over the bed bottom', '#8c7140'],
  ['dusk sky top through the wash', '#c29acf'],
  ['dusk sky horizon through the wash', '#f0bd96'],
];

/** Bounds of a recorded path with ellipses exact (rotation included); curves by their control points. */
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
    } else if (name === 'arc') grow(nums[0], nums[1], nums[2]);
    else for (let i = 0; i + 1 < nums.length; i += 2) grow(nums[i], nums[i + 1]);
  }
  return box;
}

/** Bounds of a draw op with ellipses exact, and half a stroke's width outside its path. */
function tightOpBounds(op: Op): Box {
  const box = tightBounds(op.args[0] as unknown[][]);
  const half = isStroke(op) ? op.lineWidth / 2 : 0;
  return { minX: box.minX - half, minY: box.minY - half, maxX: box.maxX + half, maxY: box.maxY + half };
}

/** Every op sits inside the frame with at least 4 px of padding. */
function expectPadded(ops: readonly Op[], tex: TexSize): void {
  const frame = frameBox(tex);
  for (const op of ops) {
    const box = tightOpBounds(op);
    expect(box.minX - frame.minX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(box.minY - frame.minY).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxX - box.maxX).toBeGreaterThanOrEqual(MIN_PAD);
    expect(frame.maxY - box.maxY).toBeGreaterThanOrEqual(MIN_PAD);
  }
}

/**
 * The tubes of an `inkMany` group: each non-ink stroke paired with the earlier INK stroke on
 * the same path. A tube's ink is as wide as its colour plus 2 x the outline it adds each side.
 */
function tubePairs(ops: readonly Op[]): { ink: Op; colour: Op }[] {
  const pairs: { ink: Op; colour: Op }[] = [];
  ops.forEach((op, i) => {
    if (!isStroke(op) || op.strokeStyle === INK) return;
    const ink = ops.slice(0, i).find((o) => isStroke(o) && o.strokeStyle === INK && JSON.stringify(o.args) === JSON.stringify(op.args));
    if (ink) pairs.push({ ink, colour: op });
  });
  return pairs;
}

/** The ink seam: the one lone INK stroke 2.0 wide. */
function seamsOf(ops: readonly Op[]): Op[] {
  return ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2);
}

/** The commands of an op's path. */
const cmdsOf = (op: Op): unknown[][] => op.args[0] as unknown[][];

/** The beak tip a recorded beak path points at: the round tip's centre plus its radius along the direction. */
function beakTipOf(beak: Op): { x: number; y: number; dir: [number, number] } {
  const arcs = cmdsOf(beak).filter((cmd) => cmd[0] === 'arc');
  expect(arcs).toHaveLength(1);
  const [, cx, cy, r, a0, a1] = arcs[0] as number[] & [string];
  const angle = (a0 + a1) / 2;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, dir: [Math.cos(angle), Math.sin(angle)] };
}

describe('wading heron colours (guide 3g, 10)', () => {
  it('HERON_FEATHER_LINE is an internal see-through line, not ink, and shows on the feather', () => {
    const [r, g, b, a] = rgbaOf(HERON_FEATHER_LINE);
    expect([r, g, b]).not.toEqual(channelsOf(INK));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    const over = compositeOver(HERON_FEATHER_LINE, HERON_FEATHER);
    expect(relativeLuminance(over)).toBeLessThan(relativeLuminance(HERON_FEATHER));
    expect(contrastRatio(over, HERON_FEATHER)).toBeGreaterThanOrEqual(1.3);
  });

  it.each([...POND_BACKGROUNDS, ...DUSK_BACKGROUNDS])('ink is 3:1 or better on %s (%s)', (_name, background) => {
    expect(contrastRatio(INK, background)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
  });

  it('records the bank-soil exception: ink is 2.88:1 on the dusk bank soil under the wash', () => {
    const soil = compositeOver(DUSK_WASH, BANK_SOIL);
    expect(relativeLuminance(soil)).toBeCloseTo(0.1603, 3);
    const ratio = contrastRatio(INK, soil);
    expect(ratio.toFixed(2)).toBe('2.88');
    expect(ratio).toBeLessThan(INK_EDGE_RATIO);
  });
});

describe('wading heron anchors and sizes', () => {
  it('the planted feet are on the logic point: the stretch line minus the art water line', () => {
    expect(HERON_WATER_LINE_Y).toBe(ART_WATER_LINE_Y);
    expect(HERON_FEET_DROP).toBe(STRETCH_Y - ART_WATER_LINE_Y);
  });

  it('the beak tip rests just above the water line and over the anchor, as neck base plus the rest tip', () => {
    expect(HERON_BEAK_REST_TIP.y).toBeGreaterThanOrEqual(-6);
    expect(HERON_BEAK_REST_TIP.y).toBeLessThanOrEqual(0);
    expect(HERON_BEAK_REST_TIP.x).toBeCloseTo(0, 9);
    expect(HERON_BEAK_REST_TIP.x).toBeCloseTo(HERON_NECK_BASE.x + HERON_HEAD_TIP.rest.x, 9);
    expect(HERON_BEAK_REST_TIP.y).toBeCloseTo(HERON_NECK_BASE.y + HERON_HEAD_TIP.rest.y, 9);
  });

  it('the body trails behind the beak: it lies at x 0 or less, the neck base inside its outline', () => {
    for (const frame of ['stand', 'stepA', 'stepB'] as const) {
      const { ops } = record((ctx) => paintHeronBody(ctx, frame));
      for (const op of ops) expect(tightOpBounds(op).minX).toBeLessThan(0);
      const body = blobPairs(ops)[0];
      expect(tightOpBounds(body.ink).maxX).toBeLessThanOrEqual(HERON_BEAK_REST_TIP.x);
    }
    const { ops } = record((ctx) => paintHeronBody(ctx, 'stand'));
    // the body ellipse is the first sub-path; the tail tuft follows
    const ellipse = cmdsOf(blobPairs(ops)[0].fill).find((cmd) => cmd[0] === 'ellipse');
    const [cx, cy, rx, ry, rot] = (ellipse as unknown[]).slice(1) as number[];
    const dx = HERON_NECK_BASE.x - cx;
    const dy = HERON_NECK_BASE.y - cy;
    const u = dx * Math.cos(rot) + dy * Math.sin(rot);
    const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
    expect((u / rx) ** 2 + (v / ry) ** 2).toBeLessThan(1);
  });

  it('the stab head is anchored at the beak tip, the head centre HERON_STAB_HEAD_BACK behind it', () => {
    expect(HERON_STAB_HEAD_BACK).toBeCloseTo(
      Math.hypot(HERON_HEAD_TIP.rest.x - HERON_HEAD_CENTER.rest.x, HERON_HEAD_TIP.rest.y - HERON_HEAD_CENTER.rest.y),
      9,
    );
    expect(HERON_STAB_NECK_LEN).toBeGreaterThan(0);
  });

  it('the anchors sit inside their frames', () => {
    for (const tex of [HERON_BODY_TEX, HERON_HEAD_TEX, HERON_STAB_HEAD_TEX, HERON_STAB_NECK_TEX]) {
      expect(tex.originX).toBeGreaterThan(0);
      expect(tex.originX).toBeLessThan(tex.w);
      expect(tex.originY).toBeGreaterThan(0);
      expect(tex.originY).toBeLessThan(tex.h);
      expect(Number.isInteger(tex.w) && Number.isInteger(tex.h)).toBe(true);
    }
  });
});

describe('wading heron body (still frames)', () => {
  const rec = (frame: HeronBodyFrame): Recording => record((ctx) => paintHeronBody(ctx, frame));

  it.each(BODY_FRAME_LIST)('%s: four HERON_BEAK leg tubes inked wider, then one HERON_FEATHER blob, then the wing line', (frame) => {
    const { ops } = rec(frame);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    const tubes = tubePairs(ops);
    expect(tubes).toHaveLength(4);
    for (const { ink, colour } of tubes) {
      expect(colour.strokeStyle).toBe(HERON_BEAK);
      expect(colour.lineWidth).toBe(LEG_W);
      expect(ink.lineWidth).toBeCloseTo(LEG_W + 2 * LEG_OL, 9);
    }
    const pairs = blobPairs(ops);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].fill.fillStyle).toBe(HERON_FEATHER);
    expect(pairs[0].ink.strokeStyle).toBe(INK);
    expect(pairs[0].ink.lineWidth).toBe(2 * LW);
    // legs first, then the body in front of them, then the internal wing line
    const bodyAt = ops.indexOf(pairs[0].ink);
    for (const { ink, colour } of tubes) {
      expect(ops.indexOf(ink)).toBeLessThan(bodyAt);
      expect(ops.indexOf(colour)).toBeLessThan(bodyAt);
    }
    const wing = ops.filter((op) => isStroke(op) && op.strokeStyle === HERON_FEATHER_LINE);
    expect(wing).toHaveLength(1);
    expect(wing[0].lineWidth).toBe(2);
    expect(ops.indexOf(wing[0])).toBeGreaterThan(bodyAt);
  });

  it.each(BODY_FRAME_LIST)('%s: no head, no eye, no mouth, no seam; the body outline is only ellipses', (frame) => {
    const { ops } = rec(frame);
    expect(new Set(ops.filter(isFill).map((op) => op.fillStyle))).toEqual(new Set([HERON_FEATHER]));
    expect(seamsOf(ops)).toHaveLength(0);
    const names = new Set(cmdsOf(blobPairs(ops)[0].fill).map(([name]) => name));
    expect(names).toEqual(new Set(['moveTo', 'ellipse']));
  });

  it('the body and tail are the same in every frame; only the legs change', () => {
    const body = (frame: HeronBodyFrame): string =>
      JSON.stringify([blobPairs(rec(frame).ops)[0].fill.args, rec(frame).ops.filter((op) => op.strokeStyle === HERON_FEATHER_LINE).map((op) => op.args)]);
    expect(body('stepA')).toBe(body('stand'));
    expect(body('stepB')).toBe(body('stand'));
    const legs = (frame: HeronBodyFrame): string => JSON.stringify(tubePairs(rec(frame).ops).map(({ colour }) => colour.args));
    expect(legs('stepA')).not.toBe(legs('stand'));
    expect(legs('stepB')).not.toBe(legs('stand'));
    expect(legs('stepA')).not.toBe(legs('stepB'));
  });

  /** The foot y of each leg: the end of the leg path, which is the start of its toe. */
  const footYs = (frame: HeronBodyFrame): number[] =>
    tubePairs(rec(frame).ops)
      .map(({ colour }) => cmdsOf(colour))
      .filter((cmds) => cmds[1][0] === 'quadraticCurveTo')
      .map((cmds) => (cmds[1] as number[])[4]);

  it('stand plants both feet on the logic point; each step lifts exactly one foot', () => {
    expect(footYs('stand')).toEqual([HERON_FEET_DROP, HERON_FEET_DROP]);
    for (const frame of ['stepA', 'stepB'] as const) {
      const ys = footYs(frame);
      expect(ys).toHaveLength(2);
      expect(ys.filter((y) => y === HERON_FEET_DROP)).toHaveLength(1);
      expect(ys.filter((y) => y < HERON_FEET_DROP)).toHaveLength(1);
      expect(Math.max(...ys)).toBe(HERON_FEET_DROP);
    }
  });

  it.each(BODY_FRAME_LIST)('%s: the legs reach into the water and the body, with its ink, is above it', (frame) => {
    const { ops } = rec(frame);
    const body = tightOpBounds(blobPairs(ops)[0].ink);
    expect(body.maxY).toBeLessThan(0);
    const legInk = tubePairs(ops).map(({ ink }) => tightOpBounds(ink));
    expect(Math.max(...legInk.map((box) => box.maxY))).toBeGreaterThan(HERON_FEET_DROP);
    expect(Math.min(...legInk.map((box) => box.minY))).toBeLessThan(body.maxY);
  });

  it.each(BODY_FRAME_LIST)('%s: fits HERON_BODY_TEX with its ink and at least 4 px of padding', (frame) => {
    expectPadded(rec(frame).ops, HERON_BODY_TEX);
  });
});

describe('wading heron head and neck (still frames)', () => {
  const rec = (pose: HeronHeadPose): Recording => record((ctx) => paintHeronHead(ctx, pose));
  /** The neck tube and the head capsule of a pose. */
  const tubesOf = (pose: HeronHeadPose): { neck: Op; head: Op } => {
    const tubes = tubePairs(rec(pose).ops);
    expect(tubes).toHaveLength(2);
    return { neck: tubes[0].colour, head: tubes[1].colour };
  };

  it.each(HEAD_POSE_LIST)('%s: the beak, then the neck and head as inked HERON_FEATHER tubes', (pose) => {
    const { ops } = rec(pose);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    const pairs = blobPairs(ops);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].fill.fillStyle).toBe(HERON_BEAK);
    expect(pairs[0].ink.strokeStyle).toBe(INK);
    expect(pairs[0].ink.lineWidth).toBe(2 * LW);
    const tubes = tubePairs(ops);
    expect(tubes.map(({ colour }) => colour.strokeStyle)).toEqual([HERON_FEATHER, HERON_FEATHER]);
    expect(tubes.map(({ colour }) => colour.lineWidth)).toEqual([NECK_W, HEAD_W]);
    for (const { ink, colour } of tubes) {
      expect(ink.lineWidth).toBeCloseTo(colour.lineWidth + 2 * LW, 9);
      expect(ops.indexOf(ink)).toBeGreaterThan(ops.indexOf(pairs[0].fill));
    }
  });

  it.each(HEAD_POSE_LIST)('%s: gentle: a closed beak with one ink seam, one bead eye with glints, no open mouth', (pose) => {
    const { ops } = rec(pose);
    expect(new Set(ops.filter(isFill).map((op) => op.fillStyle))).toEqual(
      new Set([HERON_BEAK, HERON_SHINE, EYE, WHITE]),
    );
    expect(ops.filter((op) => isFill(op) && op.fillStyle === EYE)).toHaveLength(1);
    expect(ops.filter((op) => isFill(op) && op.fillStyle === TILAPIA_MOUTH)).toHaveLength(0);
    expect(ops.filter((op) => isFill(op) && op.fillStyle === HERON_SHINE)).toHaveLength(1);
    expect(seamsOf(ops)).toHaveLength(1);
    // the beak is one closed path with a round tip
    const cmds = cmdsOf(blobPairs(ops)[0].fill);
    expect(cmds.at(-1)?.[0]).toBe('closePath');
    expect(cmds.filter((cmd) => cmd[0] === 'arc')).toHaveLength(1);
  });

  it.each(HEAD_POSE_LIST)('%s: the beak points at HERON_HEAD_TIP, the head is centred on HERON_HEAD_CENTER', (pose) => {
    const { ops } = rec(pose);
    const tip = beakTipOf(blobPairs(ops)[0].fill);
    expect(tip.x).toBeCloseTo(HERON_HEAD_TIP[pose].x, 9);
    expect(tip.y).toBeCloseTo(HERON_HEAD_TIP[pose].y, 9);
    const headCmds = cmdsOf(tubePairs(ops)[1].colour) as [string, number, number][];
    // the capsule runs from 2 behind the centre to 3 ahead of it
    expect(headCmds[0][1]).toBeCloseTo(HERON_HEAD_CENTER[pose].x - 2, 9);
    expect(headCmds[1][1]).toBeCloseTo(HERON_HEAD_CENTER[pose].x + 3, 9);
    expect(headCmds[0][2]).toBeCloseTo(HERON_HEAD_CENTER[pose].y, 9);
  });

  it.each(HEAD_POSE_LIST)('%s: the one ink seam lies down the closed beak, below the head', (pose) => {
    const { ops } = rec(pose);
    const tip = beakTipOf(blobPairs(ops)[0].fill);
    const seam = cmdsOf(seamsOf(ops)[0]) as [string, number, number][];
    expect(seam.map(([name]) => name)).toEqual(['moveTo', 'lineTo']);
    const along = (x: number, y: number): [number, number] => {
      const dx = tip.x - x;
      const dy = tip.y - y;
      // distance behind the tip along the beak, and off its axis
      return [dx * tip.dir[0] + dy * tip.dir[1], Math.abs(dx * tip.dir[1] - dy * tip.dir[0])];
    };
    const [aBehind, aOff] = along(seam[0][1], seam[0][2]);
    const [bBehind, bOff] = along(seam[1][1], seam[1][2]);
    expect(aOff).toBeLessThan(1e-9);
    expect(bOff).toBeLessThan(1e-9);
    expect(aBehind).toBeGreaterThanOrEqual(4);
    expect(bBehind).toBeGreaterThan(aBehind);
    // the seam stays on the beak: it ends before the head's ink begins
    const headCentre = HERON_HEAD_CENTER[pose];
    const headEdge = Math.hypot(tip.x - headCentre.x, tip.y - headCentre.y) - HEAD_W / 2 - LW;
    expect(bBehind).toBeLessThanOrEqual(headEdge + 1e-9);
  });

  it.each(HEAD_POSE_LIST)('%s: fits HERON_HEAD_TEX with its ink and at least 4 px of padding', (pose) => {
    expectPadded(rec(pose).ops, HERON_HEAD_TEX);
  });

  it('rest hangs the head low with the beak pointing down; warn lifts it high with the beak level', () => {
    const rest = HERON_HEAD_CENTER.rest;
    const warn = HERON_HEAD_CENTER.warn;
    expect(rest.y).toBeGreaterThan(0);
    expect(warn.y).toBeLessThan(0);
    expect(rest.y - warn.y).toBeGreaterThanOrEqual(40);
    const slope = (pose: HeronHeadPose): number => {
      const tip = HERON_HEAD_TIP[pose];
      return Math.atan2(tip.y - HERON_HEAD_CENTER[pose].y, tip.x - HERON_HEAD_CENTER[pose].x);
    };
    expect(slope('rest')).toBeGreaterThan(Math.PI / 4);
    expect(Math.abs(slope('warn'))).toBeLessThan(Math.PI / 6);
    // the lowest point and the highest point of the two poses are far apart
    const lows = HEAD_POSE_LIST.map((pose) => Math.max(...rec(pose).ops.map((op) => tightOpBounds(op).maxY)));
    const highs = HEAD_POSE_LIST.map((pose) => Math.min(...rec(pose).ops.map((op) => tightOpBounds(op).minY)));
    expect(Math.abs(lows[0] - lows[1])).toBeGreaterThanOrEqual(25);
    expect(Math.abs(highs[0] - highs[1])).toBeGreaterThanOrEqual(10);
  });

  it('the S-neck bends both ways (an S); the rest neck bends one way (a hook)', () => {
    /** Cross product of the chord from the neck start to the neck end with each cubic's control points: its sign is the side they lie on. */
    const sides = (pose: HeronHeadPose): number[][] => {
      const cmds = cmdsOf(tubesOf(pose).neck) as [string, ...number[]][];
      const end = cmds.at(-1) as number[];
      const cx = end[end.length - 2];
      const cy = end[end.length - 1];
      return cmds
        .slice(1)
        .map((cmd) => [cmd.slice(1, 3), cmd.slice(3, 5)] as number[][])
        .map((controls) => controls.map(([px, py]) => cx * py - cy * px));
    };
    const rest = sides('rest').flat();
    expect(new Set(rest.map(Math.sign)).size).toBe(1);
    expect(sides('rest')).toHaveLength(1);
    const warn = sides('warn');
    expect(warn).toHaveLength(2);
    // the two pieces bulge to opposite sides of the chord, summed over their control points
    const first = Math.sign(warn[0].reduce((a, b) => a + b, 0));
    const second = Math.sign(warn[1].reduce((a, b) => a + b, 0));
    expect(first * second).toBe(-1);
  });

  it('the S-neck pose is a different silhouette from rest: its head and neck bounds sit apart', () => {
    const box = (pose: HeronHeadPose): Box => {
      const boxes = rec(pose).ops.filter((op) => blobPairs(rec(pose).ops).some((pair) => pair.ink === op) || tubePairs(rec(pose).ops).some((pair) => pair.ink === op)).map(tightOpBounds);
      return {
        minX: Math.min(...boxes.map((b) => b.minX)),
        minY: Math.min(...boxes.map((b) => b.minY)),
        maxX: Math.max(...boxes.map((b) => b.maxX)),
        maxY: Math.max(...boxes.map((b) => b.maxY)),
      };
    };
    const rest = box('rest');
    const warn = box('warn');
    const overlapW = Math.min(rest.maxX, warn.maxX) - Math.max(rest.minX, warn.minX);
    const overlapH = Math.min(rest.maxY, warn.maxY) - Math.max(rest.minY, warn.minY);
    const intersection = Math.max(0, overlapW) * Math.max(0, overlapH);
    const union = (rest.maxX - rest.minX) * (rest.maxY - rest.minY) + (warn.maxX - warn.minX) * (warn.maxY - warn.minY) - intersection;
    // as boxes the two share at most half their area; the poses themselves share far less
    expect(intersection / union).toBeLessThan(0.5);
  });

  it('the S-neck top stays inside the sky band: the head with its ink is at world y 0 or lower than the top', () => {
    const { ops } = rec('warn');
    const top = Math.min(...ops.map((op) => tightOpBounds(op).minY));
    expect(HERON_WATER_LINE_Y + HERON_NECK_BASE.y + top).toBeGreaterThanOrEqual(0);
  });
});

describe('wading heron stab (still frames)', () => {
  it('the stab head: a closed beak pointing +x, tip at the anchor, one inked head tube behind it', () => {
    const { ops } = record((ctx) => paintHeronStabHead(ctx));
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    const pairs = blobPairs(ops);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].fill.fillStyle).toBe(HERON_BEAK);
    const tip = beakTipOf(pairs[0].fill);
    expect(tip.x).toBeCloseTo(0, 9);
    expect(tip.y).toBeCloseTo(0, 9);
    expect(tip.dir[0]).toBeCloseTo(1, 9);
    expect(tip.dir[1]).toBeCloseTo(0, 9);
    const tubes = tubePairs(ops);
    expect(tubes).toHaveLength(1);
    expect(tubes[0].colour.strokeStyle).toBe(HERON_FEATHER);
    expect(tubes[0].colour.lineWidth).toBe(HEAD_W);
    expect(tubes[0].ink.lineWidth).toBeCloseTo(HEAD_W + 2 * LW, 9);
    const headCmds = cmdsOf(tubes[0].colour) as [string, number, number][];
    expect((headCmds[0][1] + headCmds[1][1]) / 2 - 0.5).toBeCloseTo(-HERON_STAB_HEAD_BACK, 9);
  });

  it('the stab head is gentle: one seam on the closed beak, one bead eye, no mouth', () => {
    const { ops } = record((ctx) => paintHeronStabHead(ctx));
    expect(new Set(ops.filter(isFill).map((op) => op.fillStyle))).toEqual(
      new Set([HERON_BEAK, HERON_SHINE, EYE, WHITE]),
    );
    expect(ops.filter((op) => isFill(op) && op.fillStyle === EYE)).toHaveLength(1);
    expect(seamsOf(ops)).toHaveLength(1);
    const seam = cmdsOf(seamsOf(ops)[0]) as [string, number, number][];
    // level along the beak, behind the tip
    expect(seam[0][2]).toBeCloseTo(0, 9);
    expect(seam[1][2]).toBeCloseTo(0, 9);
    expect(seam[0][1]).toBeLessThan(0);
    expect(seam[1][1]).toBeLessThan(seam[0][1]);
  });

  it('the stab head fits HERON_STAB_HEAD_TEX with 4 px of padding', () => {
    expectPadded(record((ctx) => paintHeronStabHead(ctx)).ops, HERON_STAB_HEAD_TEX);
  });

  it('the stab neck: one inked HERON_FEATHER tube from (0, 0) to (HERON_STAB_NECK_LEN, 0), the same width as the neck', () => {
    const { ops } = record((ctx) => paintHeronStabNeck(ctx));
    expect(ops).toHaveLength(2);
    const [{ ink, colour }] = tubePairs(ops);
    expect(colour.strokeStyle).toBe(HERON_FEATHER);
    expect(colour.lineWidth).toBe(NECK_W);
    expect(ink.lineWidth).toBeCloseTo(NECK_W + 2 * LW, 9);
    expect(cmdsOf(colour)).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', HERON_STAB_NECK_LEN, 0],
    ]);
    expectPadded(ops, HERON_STAB_NECK_TEX);
  });
});

describe('wading heron depths (src/art/layers.ts)', () => {
  it('draws behind the halo, the stranded axolotl and the axolotl, so the hero is never covered', () => {
    for (const depth of [DEPTH.heronBody, DEPTH.heronStab]) {
      expect(depth).toBeLessThan(DEPTH.halo);
      expect(depth).toBeLessThan(DEPTH.friend);
      expect(depth).toBeLessThan(DEPTH.axolotl);
    }
  });

  it('the body and head sit above the haze and below every cue object; the stab is in front of the tilapia', () => {
    expect(DEPTH.heronBody).toBeGreaterThan(DEPTH.haze);
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.homeSpot);
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.treasure);
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.collectibles);
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.tilapia);
    expect(DEPTH.heronStab).toBeGreaterThan(DEPTH.tilapia);
    // the surface and the pads draw over the legs at the water line
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.surface);
    expect(DEPTH.heronBody).toBeLessThan(DEPTH.pads);
  });

  it('neither depth is shared with another layer, queasyTint or treasureGlow', () => {
    for (const key of ['heronBody', 'heronStab'] as const) {
      const shared = Object.entries(DEPTH).filter(([other, value]) => value === DEPTH[key] && other !== key);
      expect(shared).toEqual([]);
      expect(DEPTH[key]).not.toBe(DEPTH.queasyTint);
      expect(DEPTH[key]).not.toBe(DEPTH.treasureGlow);
    }
  });
});

// ---------------------------------------------------------------------------
// Garter snake (issue #103; art guide 7k)
// ---------------------------------------------------------------------------

/** The chinampa luminance floor (guide 3c, 10): ink is 3:1 or better on any background at or above it. */
const CHINAMPA_FLOOR = 0.1687;
/** Body tube geometry written out (guide 7k): 18 round-capped segments, then the head capsule. */
const SNAKE_SEGMENTS = 18;
const SNAKE_HEAD_R = 10;
const SNAKE_STRIPE_W = 2.4;
/** The least the stripes must be lighter than the body: the greyscale cue (guide 7k, 10). */
const SNAKE_STRIPE_RATIO = 2.5;
/** A recorded point of a tube path. */
type SnakePt = readonly [number, number];

/** Every snake frame; a missing one is a type error. */
const SNAKE_FRAME_LIST = Object.keys({
  swimA: 0,
  swimB: 0,
  swimC: 0,
  swimD: 0,
  hold: 0,
  dart: 0,
} satisfies Record<GarterSnakeFrame, 0>) as GarterSnakeFrame[];

/** The recorded segments of a painted snake: the body tubes in order from the head to the tail tip, and the head capsule. */
function snakeParts(frame: GarterSnakeFrame): {
  ops: Op[];
  body: { ink: Op; colour: Op; from: SnakePt; to: SnakePt }[];
  head: { ink: Op; colour: Op };
  stripes: Op[];
} {
  const { ops } = record((ctx) => paintGarterSnake(ctx, frame));
  const tubes = tubePairs(ops);
  expect(tubes).toHaveLength(SNAKE_SEGMENTS + 1);
  const body = tubes.slice(0, SNAKE_SEGMENTS).map(({ ink, colour }) => {
    const [move, lineTo] = cmdsOf(colour);
    return { ink, colour, from: [move[1], move[2]] as SnakePt, to: [lineTo[1], lineTo[2]] as SnakePt };
  });
  const stripes = ops.filter((op) => isStroke(op) && op.strokeStyle === GARTER_STRIPE);
  return { ops, body, head: tubes[SNAKE_SEGMENTS], stripes };
}

/** The centreline of a snake frame, head first: the start of each body tube, then the tail tip. */
function centrelineOf(frame: GarterSnakeFrame): SnakePt[] {
  const { body } = snakeParts(frame);
  return [...body.map((t) => t.from), body[body.length - 1].to];
}

describe('garter snake colours (guide 3g, 10)', () => {
  it('the stripes are not lighter than the hero belly, and reach the outer edge at 9:1 or more against INK', () => {
    expect(relativeLuminance(GARTER_STRIPE)).toBeGreaterThanOrEqual(TILAPIA_MIN_LUMINANCE);
    expect(contrastRatio(GARTER_STRIPE, INK)).toBeGreaterThanOrEqual(TILAPIA_INK_RATIO);
    expect(relativeLuminance(GARTER_STRIPE)).toBeLessThan(relativeLuminance(HERO_BELLY));
  });

  it('the body is at the chinampa luminance floor or more, so its ink is held by the floor like the ghost net, and it is no lighter than the hero', () => {
    expect(relativeLuminance(GARTER_BODY)).toBeGreaterThanOrEqual(CHINAMPA_FLOOR);
    expect(contrastRatio(GARTER_BODY, INK)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
    expect(relativeLuminance(GARTER_BODY)).toBeLessThan(relativeLuminance(HERO_BELLY));
  });

  it('tells the stripes from the body by value alone: 2.5:1 or more, the stripes lighter (the greyscale cue)', () => {
    expect(contrastRatio(GARTER_STRIPE, GARTER_BODY)).toBeGreaterThanOrEqual(SNAKE_STRIPE_RATIO);
    expect(relativeLuminance(GARTER_STRIPE)).toBeGreaterThan(relativeLuminance(GARTER_BODY));
  });

  it('is a green, nowhere near red: no part of the snake is the hero\'s warm pink or a mouth red', () => {
    const [r, g, b] = channelsOf(GARTER_BODY);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    for (const frame of SNAKE_FRAME_LIST) {
      const { ops } = snakeParts(frame);
      for (const op of ops) {
        for (const colour of [op.fillStyle, op.strokeStyle]) {
          expect(colour).not.toBe(TILAPIA_MOUTH);
          expect(colour).not.toBe(LEGS_FILL);
        }
      }
    }
  });

  it('the head shine is a see-through white', () => {
    const [r, g, b, a] = rgbaOf(GARTER_SHINE);
    expect([r, g, b]).toEqual([255, 255, 255]);
    expect(a).toBeLessThan(1);
  });
});

describe('garter snake anchors and sizes', () => {
  it('shares one integer frame between every frame, with the anchor inside it', () => {
    expect(Number.isInteger(GARTER_SNAKE_TEX.w) && Number.isInteger(GARTER_SNAKE_TEX.h)).toBe(true);
    expect(GARTER_SNAKE_TEX.originX).toBeGreaterThan(0);
    expect(GARTER_SNAKE_TEX.originX).toBeLessThan(GARTER_SNAKE_TEX.w);
    expect(GARTER_SNAKE_TEX.originY).toBeGreaterThan(0);
    expect(GARTER_SNAKE_TEX.originY).toBeLessThan(GARTER_SNAKE_TEX.h);
    // the head is at the front of the frame and the body trails to -x: far more frame behind the anchor than ahead of it
    expect(GARTER_SNAKE_TEX.originX).toBeGreaterThan(GARTER_SNAKE_TEX.w - GARTER_SNAKE_TEX.originX);
  });

  it('lists six frames: four swim frames, the held pose and the dart', () => {
    expect([...GARTER_SNAKE_FRAMES].sort()).toEqual([...SNAKE_FRAME_LIST].sort());
    expect([...GARTER_SWIM_FRAMES]).toEqual(['swimA', 'swimB', 'swimC', 'swimD']);
  });

  it.each(SNAKE_FRAME_LIST)('%s: the head capsule is centred on the anchor and the nose tip is GARTER_NOSE_TIP', (frame) => {
    const { head } = snakeParts(frame);
    const [move, lineTo] = cmdsOf(head.colour) as unknown as [string, number, number][];
    expect([move[1], move[2]]).toEqual([-3, 0]);
    expect([lineTo[1], lineTo[2]]).toEqual([4, 0]);
    expect(head.colour.lineWidth).toBe(2 * SNAKE_HEAD_R);
    expect(head.ink.lineWidth).toBe(2 * SNAKE_HEAD_R + 2 * LW);
    expect(GARTER_NOSE_TIP).toEqual({ x: 4 + SNAKE_HEAD_R, y: 0 });
  });

  it.each(SNAKE_FRAME_LIST)('%s: the body starts under the head and trails to -x, and the head never leaves the anchor', (frame) => {
    const points = centrelineOf(frame);
    expect(points).toHaveLength(SNAKE_SEGMENTS + 1);
    expect(points[0][0]).toBeCloseTo(0, 9);
    expect(points[0][1]).toBeCloseTo(0, 9);
    for (let i = 1; i < points.length; i++) expect(points[i][0]).toBeLessThan(points[i - 1][0]);
    // the wave grows from nothing, so the neck leaves the head level
    expect(Math.abs(points[1][1])).toBeLessThan(0.6);
  });

  it.each(SNAKE_FRAME_LIST)('%s: every part fits GARTER_SNAKE_TEX with its ink and at least 4 px of padding', (frame) => {
    expectPadded(snakeParts(frame).ops, GARTER_SNAKE_TEX);
  });
});

describe('garter snake body (still frames)', () => {
  it.each(SNAKE_FRAME_LIST)('%s: round-capped GARTER_BODY tubes inked LW a side, merged in one group, then the head capsule', (frame) => {
    const { ops, body, head } = snakeParts(frame);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
    for (const { ink, colour } of [...body, head]) {
      expect(colour.strokeStyle).toBe(GARTER_BODY);
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeCloseTo(colour.lineWidth + 2 * LW, 9);
    }
    // every ink stroke comes before every colour stroke, so the joints share no line
    const firstColour = Math.min(...[...body, head].map(({ colour }) => ops.indexOf(colour)));
    const lastInk = Math.max(...[...body, head].map(({ ink }) => ops.indexOf(ink)));
    expect(lastInk).toBeLessThan(firstColour);
  });

  it.each(SNAKE_FRAME_LIST)('%s: the body is thick and friendly and tapers to a thin tail, with a neck narrower than the head', (frame) => {
    const { body, head } = snakeParts(frame);
    const widths = body.map(({ colour }) => colour.lineWidth);
    expect(Math.max(...widths)).toBeGreaterThan(10);
    expect(widths[0]).toBeLessThan(head.colour.lineWidth);
    expect(widths[widths.length - 1]).toBeLessThan(Math.max(...widths) / 2);
    // never widening toward the tail once past the neck
    const peak = widths.indexOf(Math.max(...widths));
    for (let i = peak + 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1] + 1e-9);
  });

  it('the four swim frames are one gentle S-wiggle a quarter wave apart: swimA and swimC mirror each other, so do swimB and swimD', () => {
    const [a, b, c, d] = GARTER_SWIM_FRAMES.map(centrelineOf);
    for (let i = 0; i <= SNAKE_SEGMENTS; i++) {
      expect(a[i][1]).toBeCloseTo(-c[i][1], 9);
      expect(b[i][1]).toBeCloseTo(-d[i][1], 9);
      expect(a[i][0]).toBeCloseTo(c[i][0], 9);
    }
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(d));
  });

  it('the wiggle is gentle: no part of a swim frame bends away from the head line by more than 6 px, and no segment is steeper than 0.7', () => {
    for (const frame of GARTER_SWIM_FRAMES) {
      const points = centrelineOf(frame);
      expect(Math.max(...points.map((p) => Math.abs(p[1])))).toBeLessThanOrEqual(6);
      for (let i = 1; i < points.length; i++) {
        const slope = Math.abs(points[i][1] - points[i - 1][1]) / Math.abs(points[i][0] - points[i - 1][0]);
        expect(slope).toBeLessThan(0.7);
      }
    }
  });

  it('the held pose is one clear S, a deeper curve than any swim frame, with both a crest and a trough', () => {
    const swimDepth = Math.max(...GARTER_SWIM_FRAMES.flatMap(centrelineOf).map((p) => Math.abs(p[1])));
    const held = centrelineOf('hold');
    expect(Math.max(...held.map((p) => Math.abs(p[1])))).toBeGreaterThan(swimDepth);
    expect(Math.min(...held.map((p) => p[1]))).toBeLessThan(-2);
    expect(Math.max(...held.map((p) => p[1]))).toBeGreaterThan(2);
    for (const frame of GARTER_SWIM_FRAMES) expect(JSON.stringify(centrelineOf(frame))).not.toBe(JSON.stringify(held));
  });

  it('the dart is longer, thinner and nearly straight, mouth still closed', () => {
    const dart = centrelineOf('dart');
    const swim = centrelineOf('swimA');
    expect(-dart[dart.length - 1][0]).toBeGreaterThan(-swim[swim.length - 1][0] + 15);
    expect(Math.max(...dart.map((p) => Math.abs(p[1])))).toBeLessThan(1);
    const dartWidth = Math.max(...snakeParts('dart').body.map(({ colour }) => colour.lineWidth));
    const swimWidth = Math.max(...snakeParts('swimA').body.map(({ colour }) => colour.lineWidth));
    expect(dartWidth).toBeLessThan(swimWidth);
    expect(seamsOf(snakeParts('dart').ops)).toHaveLength(1);
  });

  it('every frame is a different painting', () => {
    const signatures = SNAKE_FRAME_LIST.map((frame) => JSON.stringify(snakeParts(frame).ops.map((op) => op.args)));
    expect(new Set(signatures).size).toBe(SNAKE_FRAME_LIST.length);
  });
});

describe('garter snake stripes (the greyscale cue)', () => {
  it.each(SNAKE_FRAME_LIST)('%s: two pale GARTER_STRIPE lines run along the body over the tubes, no ink, at full alpha', (frame) => {
    const { ops, stripes, head } = snakeParts(frame);
    expect(stripes).toHaveLength(2);
    const girth = frame === 'dart' ? 0.86 : 1;
    for (const stripe of stripes) {
      expect(stripe.lineWidth).toBeCloseTo(SNAKE_STRIPE_W * girth, 9);
      expect(stripe.globalAlpha).toBe(1);
      expect(ops.indexOf(stripe)).toBeGreaterThan(ops.indexOf(head.colour));
      // one polyline: a move, then lines
      expect(new Set(cmdsOf(stripe).map(([name]) => name))).toEqual(new Set(['moveTo', 'lineTo']));
    }
  });

  it.each(SNAKE_FRAME_LIST)('%s: the stripes stay inside the body, clear of the edge, and never cross: the back stripe is above the side stripe', (frame) => {
    const { body, stripes } = snakeParts(frame);
    const points = centrelineOf(frame);
    const [back, side] = stripes.map((stripe) => cmdsOf(stripe).map(([, x, y]) => [x, y] as unknown as SnakePt));
    expect(back).toHaveLength(side.length);
    back.forEach((p, k) => {
      const i = k + 2;
      const q = side[k];
      const halfBody = Math.min(body[i - 1].colour.lineWidth, body[i].colour.lineWidth) / 2;
      const offBack = Math.hypot(p[0] - points[i][0], p[1] - points[i][1]);
      const offSide = Math.hypot(q[0] - points[i][0], q[1] - points[i][1]);
      expect(offBack + SNAKE_STRIPE_W / 2).toBeLessThan(halfBody + 0.5);
      expect(offSide + SNAKE_STRIPE_W / 2).toBeLessThan(halfBody + 0.5);
      // the two stripes are separate lines with a gap between them
      expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThan(SNAKE_STRIPE_W * (frame === 'dart' ? 0.86 : 1) + 0.5);
      // the back stripe rides above the side stripe
      expect(p[1]).toBeLessThan(q[1]);
    });
  });

  it.each(SNAKE_FRAME_LIST)('%s: the stripes start at the back of the head, clear of the face, and stop short of the tail tip', (frame) => {
    const { stripes } = snakeParts(frame);
    const points = centrelineOf(frame);
    for (const stripe of stripes) {
      const cmds = cmdsOf(stripe) as unknown as [string, number, number][];
      // behind the eye and the smile, which sit ahead of x 3: they start on the back of the head capsule
      expect(cmds[0][1]).toBeLessThan(-8);
      expect(cmds[cmds.length - 1][1]).toBeGreaterThan(points[points.length - 1][0]);
    }
  });
});

describe('garter snake face (never scary, never biting)', () => {
  it.each(SNAKE_FRAME_LIST)('%s: a round head with one shine, one closed ink smile and one bead eye with two glints', (frame) => {
    const { ops } = snakeParts(frame);
    // fills: the shine, the bead, the glints; the tubes are strokes
    expect(ops.filter(isFill).map((op) => op.fillStyle)).toEqual([GARTER_SHINE, EYE, WHITE]);
    const smile = seamsOf(ops);
    expect(smile).toHaveLength(1);
    expect(cmdsOf(smile[0]).map(([name]) => name)).toEqual(['moveTo', 'quadraticCurveTo']);
    const bead = ops.find((op) => isFill(op) && op.fillStyle === EYE)!;
    const [, , r] = cmdsOf(bead).find((cmd) => cmd[0] === 'ellipse')!.slice(1) as number[];
    expect(r).toBeGreaterThan(3);
    expect(ops.filter(isFill).find((op) => op.fillStyle === WHITE)!.args[0]).toHaveLength(4);
  });

  it.each(SNAKE_FRAME_LIST)('%s: the smile is inside the head, below the eye, and it is a line, not an open mouth', (frame) => {
    const { ops } = snakeParts(frame);
    const smile = cmdsOf(seamsOf(ops)[0]) as unknown as [string, ...number[]][];
    const pts: SnakePt[] = [
      [smile[0][1], smile[0][2]],
      [smile[1][3], smile[1][4]],
    ];
    const bead = cmdsOf(ops.find((op) => isFill(op) && op.fillStyle === EYE)!).find((cmd) => cmd[0] === 'ellipse')!.slice(1) as number[];
    for (const [x, y] of pts) {
      // inside the head capsule: within the head radius of its centre line
      const nearest = Math.min(4, Math.max(-3, x));
      expect(Math.hypot(x - nearest, y)).toBeLessThan(SNAKE_HEAD_R);
      expect(y).toBeGreaterThan(bead[1]);
    }
    // the only fills are the shine, the eye and its glints: no mouth interior, no tongue, no fang, no tooth
    expect(styleOfFills(ops)).toEqual(new Set([GARTER_SHINE, EYE, WHITE]));
  });

  it.each(SNAKE_FRAME_LIST)('%s: paints only snake colours, ink, the eye and white glints', (frame) => {
    const { ops } = snakeParts(frame);
    const styles = new Set(ops.flatMap((op) => (isFill(op) ? [op.fillStyle] : [op.strokeStyle])));
    expect(styles).toEqual(new Set([INK, GARTER_BODY, GARTER_STRIPE, GARTER_SHINE, EYE, WHITE]));
  });
});

/** The set of fill styles of a painting. */
function styleOfFills(ops: readonly Op[]): Set<unknown> {
  return new Set(ops.filter(isFill).map((op) => op.fillStyle));
}

describe('garter snake ripple ring (the warning cue; guide 7k)', () => {
  const { ops } = record(paintGarterRipple);

  it('is one flat white line with an ink line each side, a single inked tube', () => {
    const tubes = tubePairs(ops);
    expect(ops).toHaveLength(2);
    expect(tubes).toHaveLength(1);
    expect(tubes[0].colour.strokeStyle).toBe(WHITE);
    expect(tubes[0].colour.lineWidth).toBe(3);
    expect(tubes[0].ink.strokeStyle).toBe(INK);
    expect(tubes[0].ink.lineWidth).toBeCloseTo(3 + 2 * 1.4, 9);
    expect(ops.every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it('is a wide, flat ellipse centred on the anchor, much flatter than the protected ring\'s double line round the axolotl', () => {
    const [cx, cy, rx, ry] = ellipseOf(tubePairs(ops)[0].colour);
    expect([cx, cy]).toEqual([0, 0]);
    expect([rx, ry]).toEqual([GARTER_RIPPLE_RX, GARTER_RIPPLE_RY]);
    expect(rx / ry).toBeGreaterThan(2);
    expect(rx / ry).toBeGreaterThan(RING_RX / RING_RY);
    // one line, not the protected ring's two
    expect(ops.filter((op) => isStroke(op) && op.strokeStyle === WHITE)).toHaveLength(1);
  });

  it('has no "!" bubble and no glint: the ring is the cue, as the heron\'s S-neck is', () => {
    expect(ops.filter(isFill)).toEqual([]);
    expect(new Set(ops.map((op) => op.strokeStyle))).toEqual(new Set([INK, WHITE]));
  });

  it('fits GARTER_RIPPLE_TEX with its ink and at least 4 px of padding, anchored at the centre', () => {
    expectPadded(ops, GARTER_RIPPLE_TEX);
    expect(GARTER_RIPPLE_TEX.originX).toBe(GARTER_RIPPLE_TEX.w - GARTER_RIPPLE_TEX.originX);
    expect(GARTER_RIPPLE_TEX.originY).toBe(GARTER_RIPPLE_TEX.h - GARTER_RIPPLE_TEX.originY);
  });

  it('keeps 3:1 on any background: white and ink are 9:1 or more as a pair', () => {
    expect(contrastRatio(WHITE, INK)).toBeGreaterThanOrEqual(TILAPIA_INK_RATIO);
  });
});

// ---------------------------------------------------------------------------
// Common carp (issue #117; PRD N2, N3)
// ---------------------------------------------------------------------------

/** The least the belly must be lighter than the body, and the body lighter than the fins: the greyscale cues (guide 10). */
const CARP_BELLY_RATIO = 1.9;
const CARP_FIN_RATIO = 1.5;
/** The puff reaches the outer edge, so it must be this much against INK (its ink line holds the rest). */
const CARP_PUFF_INK_RATIO = 8;
/** Longest a barbel's control polygon may be: they are short. */
const CARP_BARBEL_MAX_LEN = 13;

/** The recorded parts of a painted carp frame. */
function carpParts(frame: CarpFrame): {
  ops: Op[];
  blobs: { ink: Op; fill: Op }[];
  barbels: { ink: Op; colour: Op }[];
  mouth: Op;
} {
  const { ops } = record((ctx) => paintCarp(ctx, frame));
  const mouths = ops.filter(
    (op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 && cmdsOf(op).some((cmd) => cmd[0] === 'quadraticCurveTo'),
  );
  expect(mouths).toHaveLength(1);
  return { ops, blobs: blobPairs(ops), barbels: tubePairs(ops), mouth: mouths[0] };
}

/** Whether (x, y) is inside the carp frame's body ellipse, shrunk by `margin` px. */
function insideCarpBody(frame: CarpFrame, x: number, y: number, margin: number): boolean {
  const { cx, cy, rx, ry, rot } = carpGeometry(frame).body;
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(rot) + dy * Math.sin(rot);
  const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
  return (u / (rx - margin)) ** 2 + (v / (ry - margin)) ** 2 <= 1;
}

describe('carp colours (guide 3g, 10)', () => {
  it('the body is at the chinampa luminance floor or more, so its ink is held by the floor like the snake and the ghost net, and it is no lighter than the hero', () => {
    expect(relativeLuminance(CARP_BODY)).toBeGreaterThanOrEqual(CHINAMPA_FLOOR);
    expect(contrastRatio(CARP_BODY, INK)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
    expect(relativeLuminance(CARP_BODY)).toBeLessThan(relativeLuminance(HERO_BELLY));
  });

  it('every part that reaches the outer edge is 3:1 or better against INK', () => {
    expect(contrastRatio(CARP_FIN, INK)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
    expect(contrastRatio(CARP_BODY, INK)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
    expect(contrastRatio(CARP_PUFF, INK)).toBeGreaterThanOrEqual(CARP_PUFF_INK_RATIO);
  });

  it('tells the belly from the body, and the body from the fins, by value alone, the lighter above (the greyscale cue)', () => {
    expect(contrastRatio(CARP_BELLY, CARP_BODY)).toBeGreaterThanOrEqual(CARP_BELLY_RATIO);
    expect(relativeLuminance(CARP_BELLY)).toBeGreaterThan(relativeLuminance(CARP_BODY));
    expect(relativeLuminance(CARP_BELLY)).toBeLessThan(relativeLuminance(HERO_BELLY));
    expect(contrastRatio(CARP_BODY, CARP_FIN)).toBeGreaterThanOrEqual(CARP_FIN_RATIO);
    expect(relativeLuminance(CARP_BODY)).toBeGreaterThan(relativeLuminance(CARP_FIN));
  });

  it('reads apart from the tilapia by value: the carp body is much darker than the tilapia body', () => {
    expect(contrastRatio(CARP_BODY, TILAPIA_BODY)).toBeGreaterThanOrEqual(1.6);
    expect(relativeLuminance(CARP_BODY)).toBeLessThan(relativeLuminance(TILAPIA_BODY));
  });

  it('is a bronze-gold, nowhere near red: not the hero pink, not a mouth red', () => {
    const [r, g, b] = channelsOf(CARP_BODY);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    for (const frame of CARP_FRAMES) {
      for (const op of carpParts(frame).ops) {
        for (const colour of [op.fillStyle, op.strokeStyle]) {
          expect(colour).not.toBe(TILAPIA_MOUTH);
          expect(colour).not.toBe(LEGS_FILL);
        }
      }
    }
  });

  it('the shine and the scale marks are see-through, so they never reach the edge', () => {
    for (const colour of [CARP_SHINE, CARP_SCALE]) expect(rgbaOf(colour)[3]).toBeLessThan(1);
    expect(rgbaOf(CARP_SHINE).slice(0, 3)).toEqual([255, 255, 255]);
  });
});

describe('carp anchors and sizes', () => {
  it('shares one integer frame between every frame, with the anchor inside it and the tail behind it', () => {
    expect(Number.isInteger(CARP_TEX.w) && Number.isInteger(CARP_TEX.h)).toBe(true);
    expect(CARP_TEX.originX).toBeGreaterThan(0);
    expect(CARP_TEX.originX).toBeLessThan(CARP_TEX.w);
    expect(CARP_TEX.originY).toBeGreaterThan(0);
    expect(CARP_TEX.originY).toBeLessThan(CARP_TEX.h);
    expect(CARP_TEX.originX).toBeGreaterThan(CARP_TEX.w - CARP_TEX.originX);
  });

  it('lists five frames: three swim frames, the warning and the sweep', () => {
    expect([...CARP_FRAMES]).toEqual(['swim0', 'swim1', 'swim2', 'warn', 'sweep']);
    expect([...CARP_SWIM_FRAMES]).toEqual(['swim0', 'swim1', 'swim2']);
  });

  it.each(CARP_FRAMES)('%s: every part fits CARP_TEX with its ink and at least 4 px of padding', (frame) => {
    expectPadded(carpParts(frame).ops, CARP_TEX);
  });

  it('is a plump body about the size of the carp\'s 32 px body radius, centred on the anchor', () => {
    expect([CARP_BODY_RX, CARP_BODY_RY]).toEqual([32, 22]);
    for (const frame of ['swim0', 'swim1', 'swim2'] as const) {
      const { cx, cy, rx, ry, rot } = carpGeometry(frame).body;
      expect([cx, cy, rx, ry, rot]).toEqual([0, 0, 32, 22, 0]);
    }
  });
});

describe('carp poses', () => {
  it('the three swim frames only differ in the tail: the tail fan steps down, the body stays put', () => {
    const [a, b, c] = CARP_SWIM_FRAMES.map(carpGeometry);
    expect(a.tailFin.cy).toBeLessThan(b.tailFin.cy);
    expect(b.tailFin.cy).toBeLessThan(c.tailFin.cy);
    for (const g of [a, c]) {
      expect(g.body).toEqual(b.body);
      expect(g.eye).toEqual(b.eye);
      expect(g.mouth).toEqual(b.mouth);
    }
  });

  it('warn: the nose is tipped down, about 22 degrees, and the nose sits well below the anchor line', () => {
    const swimNose = carpNoseTip('swim1');
    const warnNose = carpNoseTip('warn');
    expect(swimNose).toEqual({ x: 32, y: 0 });
    expect(warnNose.y).toBeGreaterThan(8);
    expect(warnNose.x).toBeLessThan(swimNose.x);
    expect(carpGeometry('warn').body.rot).toBeGreaterThan(0.3);
    expect(carpGeometry('warn').body.rot).toBeLessThan(0.5);
    // the tail rises as the nose drops, and the eye drops with the head
    expect(carpGeometry('warn').tailFin.cy).toBeLessThan(carpGeometry('swim1').tailFin.cy);
    expect(carpGeometry('warn').eye[1]).toBeGreaterThan(carpGeometry('swim1').eye[1]);
  });

  it('sweep: the tail is swung much wider than any swim frame and the fan is opened', () => {
    const sweep = carpGeometry('sweep');
    const reach = (frame: CarpFrame): number => Math.abs(carpGeometry(frame).tailFin.cy);
    for (const frame of CARP_SWIM_FRAMES) expect(Math.abs(sweep.tailFin.cy)).toBeGreaterThan(reach(frame) + 10);
    expect(sweep.tailFin.ry).toBeGreaterThan(carpGeometry('swim1').tailFin.ry);
    // the body does not lunge: the head stays at the front, level to a few degrees (under 0.15 rad)
    expect(Math.abs(sweep.body.rot)).toBeLessThan(0.15);
  });

  it('every frame is drawn differently', () => {
    const drawn = CARP_FRAMES.map((frame) => JSON.stringify(carpParts(frame).ops.map((op) => op.args)));
    expect(new Set(drawn).size).toBe(CARP_FRAMES.length);
  });
});

describe('carp body (round, inked, no points)', () => {
  it.each(CARP_FRAMES)('%s: tail fan, stalk, dorsal fin and body are four inked ellipses, back to front', (frame) => {
    const { blobs } = carpParts(frame);
    expect(blobs).toHaveLength(4);
    expect(blobs.map((b) => b.fill.fillStyle)).toEqual([CARP_FIN, CARP_BODY, CARP_FIN, CARP_BODY]);
    for (const { ink } of blobs) {
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeCloseTo(2 * LW, 9);
    }
    for (const { fill } of blobs) {
      const [cx, cy, rx, ry] = ellipseOf(fill);
      expect([cx, cy, rx, ry].every(Number.isFinite)).toBe(true);
      expect(Math.min(rx, ry)).toBeGreaterThanOrEqual(5);
    }
  });

  it.each(CARP_FRAMES)('%s: the belly, the scale marks and the shine stay inside the body', (frame) => {
    const { ops } = carpParts(frame);
    const g = carpGeometry(frame);
    const belly = ops.find((op) => isFill(op) && op.fillStyle === CARP_BELLY)!;
    expect(ellipseOf(belly).slice(0, 4)).toEqual([g.belly.cx, g.belly.cy, g.belly.rx, g.belly.ry]);
    for (const angle of [0, 1, 2, 3, 4, 5, 6]) {
      const u = g.belly.rx * Math.cos(angle);
      const v = g.belly.ry * Math.sin(angle);
      const x = g.belly.cx + u * Math.cos(g.belly.rot) - v * Math.sin(g.belly.rot);
      const y = g.belly.cy + u * Math.sin(g.belly.rot) + v * Math.cos(g.belly.rot);
      expect(insideCarpBody(frame, x, y, 2)).toBe(true);
    }
    const marks = ops.filter((op) => isStroke(op) && op.strokeStyle === CARP_SCALE);
    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      for (const cmd of cmdsOf(mark)) {
        const nums = cmd.slice(1) as number[];
        for (let i = 0; i + 1 < nums.length; i += 2) expect(insideCarpBody(frame, nums[i], nums[i + 1], 3)).toBe(true);
      }
    }
    expect(ops.filter((op) => isFill(op) && op.fillStyle === CARP_SHINE)).toHaveLength(1);
  });
});

describe('carp face (never scary, never biting)', () => {
  it.each(CARP_FRAMES)('%s: one closed ink smile line, inside the body, and no mouth interior', (frame) => {
    const { ops, mouth } = carpParts(frame);
    expect(cmdsOf(mouth).map(([name]) => name)).toEqual(['moveTo', 'quadraticCurveTo']);
    const [start, curve] = cmdsOf(mouth) as unknown as [string, ...number[]][];
    for (const [x, y] of [
      [start[1], start[2]],
      [curve[3], curve[4]],
    ]) {
      expect(insideCarpBody(frame, x, y, 1)).toBe(true);
    }
    // the only fills are body colours, the belly, the shine, the eye and its glints: no mouth interior, no tooth, no tongue
    expect(styleOfFills(ops)).toEqual(new Set([CARP_FIN, CARP_BODY, CARP_BELLY, CARP_SHINE, EYE, WHITE]));
  });

  it.each(CARP_FRAMES)('%s: one bead eye with two glints, above the smile and inside the body', (frame) => {
    const { ops } = carpParts(frame);
    const bead = ops.find((op) => isFill(op) && op.fillStyle === EYE)!;
    const [ex, ey, r] = ellipseOf(bead);
    expect(r).toBeGreaterThan(4);
    expect(insideCarpBody(frame, ex, ey, r)).toBe(true);
    expect(ops.filter(isFill).find((op) => op.fillStyle === WHITE)!.args[0]).toHaveLength(4);
    const g = carpGeometry(frame);
    expect([ex, ey]).toEqual([g.eye[0], g.eye[1]]);
  });

  it.each(CARP_FRAMES)('%s: two short barbels in front of the snout, each a round-capped inked tube', (frame) => {
    const { ops, barbels } = carpParts(frame);
    expect(barbels).toHaveLength(2);
    const g = carpGeometry(frame);
    const bodyFill = ops.findIndex((op) => isFill(op) && op.fillStyle === CARP_BODY && cmdsOf(op).some((cmd) => cmd[0] === 'ellipse' && cmd[3] === CARP_BODY_RX));
    barbels.forEach(({ ink, colour }, i) => {
      expect(colour.strokeStyle).toBe(CARP_BARBEL);
      expect(colour.lineWidth).toBe(2.6);
      expect(ink.lineWidth).toBeCloseTo(2.6 + 2 * 1.4, 9);
      expect(ops.indexOf(colour)).toBeGreaterThan(bodyFill);
      const [a, b, c] = g.barbels[i];
      const poly = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]);
      expect(poly).toBeLessThanOrEqual(CARP_BARBEL_MAX_LEN);
      // the tip leaves the body: that is what makes a barbel read
      expect(insideCarpBody(frame, c[0], c[1], 0)).toBe(false);
    });
  });

  it.each(CARP_FRAMES)('%s: paints only carp colours, ink, the eye and white glints', (frame) => {
    const { ops } = carpParts(frame);
    const styles = new Set(ops.flatMap((op) => (isFill(op) ? [op.fillStyle] : [op.strokeStyle])));
    expect(styles).toEqual(new Set([INK, CARP_BODY, CARP_FIN, CARP_BELLY, CARP_BARBEL, CARP_SCALE, CARP_SHINE, EYE, WHITE]));
  });
});

/** Every fill straight after an INK stroke on the same path, whatever the ink's width. */
function inkedFills(ops: readonly Op[]): { ink: Op; fill: Op }[] {
  const pairs: { ink: Op; fill: Op }[] = [];
  for (let i = 1; i < ops.length; i++) {
    const prev = ops[i - 1];
    if (isFill(ops[i]) && isStroke(prev) && prev.strokeStyle === INK && JSON.stringify(prev.args) === JSON.stringify(ops[i].args)) {
      pairs.push({ ink: prev, fill: ops[i] });
    }
  }
  return pairs;
}

describe('carp mud puff (the warning cue; ink outline for greyscale)', () => {
  const moving = record(paintCarpPuff).ops;
  const still = record(paintCarpPuffStill).ops;

  it('the moving puff is one inked cloud of four lobes and two inked specks', () => {
    const pairs = inkedFills(moving);
    expect(pairs).toHaveLength(1 + CARP_PUFF_SPECKS.length);
    for (const { ink, fill } of pairs) {
      expect(fill.fillStyle).toBe(CARP_PUFF);
      expect(ink.strokeStyle).toBe(INK);
    }
    // the cloud's ink is LW outside, so in greyscale it reads as a dark-light-dark cloud
    expect(pairs[0].ink.lineWidth).toBeCloseTo(2 * LW, 9);
    expect(cmdsOf(pairs[0].fill).filter((cmd) => cmd[0] === 'ellipse')).toHaveLength(CARP_PUFF_LOBES.length);
    // each speck's ink is 1.6 each side, thinner than the cloud's
    expect(pairs.slice(1).map((pair) => pair.ink.lineWidth)).toEqual(CARP_PUFF_SPECKS.map(() => 3.2));
    expect(moving.every((op) => op.globalAlpha === 1)).toBe(true);
  });

  it('the still puff is the same inked cloud with no specks, so nothing in it suggests movement', () => {
    const pairs = blobPairs(still);
    expect(pairs).toHaveLength(1);
    expect(still).toHaveLength(2);
    expect(still[0].args).toEqual(moving[0].args);
    expect(still[1].args).toEqual(moving[1].args);
    expect(pairs[0].ink.lineWidth).toBeCloseTo(2 * LW, 9);
    expect(pairs[0].fill.fillStyle).toBe(CARP_PUFF);
  });

  it('is small: the cloud fits well inside 40 px and is centred near the anchor', () => {
    for (const [x, y, r] of CARP_PUFF_LOBES) expect(Math.hypot(x, y) + r).toBeLessThanOrEqual(16);
    const cloud = tightOpBounds(blobPairs(still)[0].ink);
    expect(cloud.maxX - cloud.minX).toBeLessThan(40);
    expect(cloud.maxY - cloud.minY).toBeLessThan(40);
  });

  it('has no "!" bubble and no glint: the nose-down pose with the puff is the cue', () => {
    expect(new Set(moving.map((op) => (isFill(op) ? op.fillStyle : op.strokeStyle)))).toEqual(new Set([INK, CARP_PUFF]));
  });

  it('fits CARP_PUFF_TEX with its ink and at least 4 px of padding, anchored on the main lobe', () => {
    expectPadded(moving, CARP_PUFF_TEX);
    expectPadded(still, CARP_PUFF_TEX);
    expect(CARP_PUFF_LOBES[0].slice(0, 2)).toEqual([0, 0]);
    expect(CARP_PUFF_TEX.originX).toBeGreaterThan(0);
    expect(CARP_PUFF_TEX.originY).toBeGreaterThan(0);
  });

  it('keeps 3:1 on any background: the ink line holds the edge and the puff is 8:1 against it', () => {
    expect(contrastRatio(CARP_PUFF, INK)).toBeGreaterThanOrEqual(CARP_PUFF_INK_RATIO);
  });
});

// ---------------------------------------------------------------------------
// Crayfish (issue #77; PRD N2, N3; ND-15, ND-18)
// ---------------------------------------------------------------------------

/** The least the claws must be lighter than the shell, the shell than the tail and legs, and the belly than the shell: the greyscale cues (guide 10). */
const CRAYFISH_CLAW_RATIO = 1.4;
const CRAYFISH_DARK_RATIO = 1.6;
const CRAYFISH_BELLY_RATIO = 1.9;
/** A claw is open at least this many radians wide in the warning, and closed under this many otherwise. */
const CRAYFISH_OPEN_GAPE = 1.2;
const CRAYFISH_CLOSED_GAPE = 0.3;
/** Silhouette grid step, px. */
const SIL_STEP = 1;

/** The recorded parts of a painted crayfish frame. */
function crayfishParts(frame: CrayfishFrame): { ops: Op[]; blobs: { ink: Op; fill: Op }[]; mouth: Op; seams: Op[] } {
  const { ops } = record((ctx) => paintCrayfish(ctx, frame));
  const mouths = ops.filter(
    (op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 2 && cmdsOf(op).some((cmd) => cmd[0] === 'quadraticCurveTo'),
  );
  expect(mouths).toHaveLength(1);
  const seams = ops.filter((op) => isStroke(op) && op.strokeStyle === INK && op.lineWidth === 1.6);
  return { ops, blobs: inkedFills(ops), mouth: mouths[0], seams };
}

/** Whether (x, y) is inside the frame's shell (carapace or head), shrunk by `margin` px. */
function insideCrayfishShell(frame: CrayfishFrame, x: number, y: number, margin: number): boolean {
  return crayfishGeometry(frame).shell.some(({ cx, cy, rx, ry, rot }) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(rot) + dy * Math.sin(rot);
    const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
    return (u / (rx - margin)) ** 2 + (v / (ry - margin)) ** 2 <= 1;
  });
}

type SilPoly = [number, number][];

/** A recorded path as polylines: ellipses sampled, curves sampled. */
function silPolys(cmds: readonly unknown[][]): SilPoly[] {
  const polys: SilPoly[] = [];
  let cur: SilPoly = [];
  for (const [name, ...args] of cmds) {
    const n = args as number[];
    if (name === 'moveTo') {
      cur = [[n[0], n[1]]];
      polys.push(cur);
    } else if (name === 'lineTo') cur.push([n[0], n[1]]);
    else if (name === 'quadraticCurveTo') {
      const [x0, y0] = cur[cur.length - 1];
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        cur.push([(1 - t) ** 2 * x0 + 2 * (1 - t) * t * n[0] + t * t * n[2], (1 - t) ** 2 * y0 + 2 * (1 - t) * t * n[1] + t * t * n[3]]);
      }
    } else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = n;
      const ring: SilPoly = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const x = rx * Math.cos(a);
        const y = ry * Math.sin(a);
        ring.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
      }
      polys.pop();
      polys.push(ring);
      cur = ring;
    }
  }
  return polys;
}

function insidePoly(poly: SilPoly, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) inside = !inside;
  }
  return inside;
}

function distToSegment(x: number, y: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/**
 * The silhouette of a frame: a grid of the pixels any fill or stroke touches (greyscale cannot see
 * which colour it was, only where there is something). Every painted op counts, so it is the
 * outer ink edge. Keyed [row][column] from the frame's top-left.
 */
function silhouetteOf(ops: readonly Op[]): boolean[][] {
  const w = Math.ceil(CRAYFISH_TEX.w / SIL_STEP);
  const h = Math.ceil(CRAYFISH_TEX.h / SIL_STEP);
  const grid = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  for (const op of ops) {
    const polys = silPolys(cmdsOf(op));
    const half = isStroke(op) ? op.lineWidth / 2 : 0;
    const all = polys.flat();
    const box = {
      x0: Math.min(...all.map((p) => p[0])) - half,
      x1: Math.max(...all.map((p) => p[0])) + half,
      y0: Math.min(...all.map((p) => p[1])) - half,
      y1: Math.max(...all.map((p) => p[1])) + half,
    };
    for (let row = 0; row < h; row++) {
      const y = row * SIL_STEP + SIL_STEP / 2 - CRAYFISH_TEX.originY;
      if (y < box.y0 || y > box.y1) continue;
      for (let col = 0; col < w; col++) {
        if (grid[row][col]) continue;
        const x = col * SIL_STEP + SIL_STEP / 2 - CRAYFISH_TEX.originX;
        if (x < box.x0 || x > box.x1) continue;
        const hit = isStroke(op)
          ? polys.some((poly) => poly.some((p, i) => i + 1 < poly.length && distToSegment(x, y, p, poly[i + 1]) <= half))
          : polys.some((poly) => insidePoly(poly, x, y));
        if (hit) grid[row][col] = true;
      }
    }
  }
  return grid;
}

interface Silhouette {
  /** Width and height of the box round everything painted, px. */
  readonly width: number;
  readonly height: number;
  /** Painted pixels over the box's pixels: lower means more gaps. */
  readonly solidity: number;
  /** Height of the rows painted out in front of the head (past x = 32): only the claws are there. */
  readonly clawSpan: number;
}

/** The measures of a frame's silhouette that the greyscale cue is read from. */
function silhouetteMeasures(frame: CrayfishFrame): Silhouette {
  const grid = silhouetteOf(crayfishParts(frame).ops);
  const rows = grid.flatMap((r, i) => (r.some(Boolean) ? [i] : []));
  const cols = grid[0].flatMap((_, c) => (grid.some((r) => r[c]) ? [c] : []));
  const height = (rows[rows.length - 1] - rows[0] + 1) * SIL_STEP;
  const width = (cols[cols.length - 1] - cols[0] + 1) * SIL_STEP;
  const painted = grid.flat().filter(Boolean).length;
  // columns past the head's front: only claws (and the pinch's arms) are out there
  const front = Math.floor((32 + CRAYFISH_TEX.originX) / SIL_STEP);
  const clawRows = grid.flatMap((r, i) => (r.slice(front).some(Boolean) ? [i] : []));
  const clawSpan = (clawRows[clawRows.length - 1] - clawRows[0] + 1) * SIL_STEP;
  return { width, height, solidity: painted / (width * height), clawSpan };
}

describe('crayfish colours (guide 3g, 10)', () => {
  it('uses the colours the guide records', () => {
    expect([CRAYFISH_SHELL, CRAYFISH_CLAW, CRAYFISH_DARK, CRAYFISH_BELLY, CRAYFISH_SHINE]).toEqual([
      '#8aa5c2',
      '#b4c8dc',
      '#617c9c',
      '#dbe6f0',
      'rgba(255,255,255,0.5)',
    ]);
    expect(relativeLuminance(CRAYFISH_SHELL)).toBeCloseTo(0.3621, 4);
    expect(relativeLuminance(CRAYFISH_CLAW)).toBeCloseTo(0.5618, 4);
    expect(relativeLuminance(CRAYFISH_DARK)).toBeCloseTo(0.1936, 4);
    expect(relativeLuminance(CRAYFISH_BELLY)).toBeCloseTo(0.7794, 4);
  });

  it('every part that reaches the outer edge is 3:1 or better against INK, and 3:1 or better against the darkest cave tone', () => {
    for (const colour of [CRAYFISH_SHELL, CRAYFISH_CLAW, CRAYFISH_DARK]) {
      expect(contrastRatio(colour, INK)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
      expect(contrastRatio(colour, CAVE_INTERIOR)).toBeGreaterThanOrEqual(INK_EDGE_RATIO);
    }
    expect(contrastRatio(CRAYFISH_SHELL, CAVE_INTERIOR)).toBeCloseTo(6.71, 2);
    expect(contrastRatio(CRAYFISH_SHELL, INK)).toBeCloseTo(5.65, 2);
    expect(contrastRatio(CRAYFISH_CLAW, INK)).toBeCloseTo(8.39, 2);
    expect(contrastRatio(CRAYFISH_DARK, INK)).toBeCloseTo(3.34, 2);
  });

  it('is no lighter than the hero, and no part is lighter than the hero belly', () => {
    for (const colour of [CRAYFISH_SHELL, CRAYFISH_CLAW, CRAYFISH_DARK, CRAYFISH_BELLY]) {
      expect(relativeLuminance(colour)).toBeLessThan(relativeLuminance(HERO_BELLY));
    }
  });

  it('tells the claws from the shell, the shell from the tail and legs, and the belly from the shell, by value alone (the greyscale cue)', () => {
    expect(contrastRatio(CRAYFISH_CLAW, CRAYFISH_SHELL)).toBeGreaterThanOrEqual(CRAYFISH_CLAW_RATIO);
    expect(relativeLuminance(CRAYFISH_CLAW)).toBeGreaterThan(relativeLuminance(CRAYFISH_SHELL));
    expect(contrastRatio(CRAYFISH_SHELL, CRAYFISH_DARK)).toBeGreaterThanOrEqual(CRAYFISH_DARK_RATIO);
    expect(relativeLuminance(CRAYFISH_SHELL)).toBeGreaterThan(relativeLuminance(CRAYFISH_DARK));
    expect(contrastRatio(CRAYFISH_BELLY, CRAYFISH_SHELL)).toBeGreaterThanOrEqual(CRAYFISH_BELLY_RATIO);
  });

  it('is a cool blue-grey, nowhere near red: not the hero pink, not a mouth red, not the carp bronze', () => {
    const [r, g, b] = channelsOf(CRAYFISH_SHELL);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    for (const frame of CRAYFISH_FRAMES) {
      for (const op of crayfishParts(frame).ops) {
        for (const colour of [op.fillStyle, op.strokeStyle]) {
          expect(colour).not.toBe(TILAPIA_MOUTH);
          expect(colour).not.toBe(LEGS_FILL);
          expect(colour).not.toBe(CARP_BODY);
        }
      }
    }
  });

  it('the shine is see-through white, so it never reaches the edge', () => {
    expect(rgbaOf(CRAYFISH_SHINE)[3]).toBeLessThan(1);
    expect(rgbaOf(CRAYFISH_SHINE).slice(0, 3)).toEqual([255, 255, 255]);
  });
});

describe('crayfish anchors and sizes', () => {
  it('shares one integer frame between every frame, with the anchor inside it and the tail behind it', () => {
    expect(Number.isInteger(CRAYFISH_TEX.w) && Number.isInteger(CRAYFISH_TEX.h)).toBe(true);
    expect(CRAYFISH_TEX.originX).toBeGreaterThan(0);
    expect(CRAYFISH_TEX.originX).toBeLessThan(CRAYFISH_TEX.w);
    expect(CRAYFISH_TEX.originY).toBeGreaterThan(0);
    expect(CRAYFISH_TEX.originY).toBeLessThan(CRAYFISH_TEX.h);
    // the tail trails well behind the anchor, toward -x, further than the 24 px body radius
    expect(CRAYFISH_TEX.originX).toBeGreaterThan(40);
  });

  it('lists five frames: stand, two walk frames, the warning and the pinch', () => {
    expect([...CRAYFISH_FRAMES]).toEqual(['stand', 'walkA', 'walkB', 'warn', 'pinch']);
    expect([...CRAYFISH_WALK_FRAMES]).toEqual(['walkA', 'walkB']);
  });

  it.each(CRAYFISH_FRAMES)('%s: every part fits CRAYFISH_TEX with its ink and at least 4 px of padding', (frame) => {
    expectPadded(crayfishParts(frame).ops, CRAYFISH_TEX);
  });

  it('is a plump shell about the size of the crayfish\'s 24 px body radius, centred on the anchor in the level frames', () => {
    expect([CRAYFISH_SHELL_RX, CRAYFISH_SHELL_RY]).toEqual([21, 14]);
    for (const frame of ['stand', 'walkA', 'walkB'] as const) {
      const [carapace] = crayfishGeometry(frame).shell;
      expect([carapace.cx, carapace.cy, carapace.rx, carapace.ry, carapace.rot]).toEqual([0, 0, 21, 14, 0]);
    }
  });

  it('plants its feet CRAYFISH_FOOT_Y below the anchor in the stand frame, and never lower in any frame', () => {
    const inkOf = (frame: CrayfishFrame): Box[] =>
      crayfishParts(frame)
        .ops.filter((op) => isStroke(op) && op.strokeStyle === INK && Math.abs(op.lineWidth - (3.6 + 2 * 2.2)) < 1e-9)
        .map(tightOpBounds)
        // the legs hang below the anchor; the two eye stalks (the same tube width) stand above it
        .filter((box) => box.maxY > 0);
    const stand = inkOf('stand');
    expect(stand).toHaveLength(4);
    expect(Math.max(...stand.map((b) => b.maxY))).toBeCloseTo(CRAYFISH_FOOT_Y, 9);
    for (const frame of CRAYFISH_FRAMES) {
      for (const box of inkOf(frame)) expect(box.maxY).toBeLessThanOrEqual(CRAYFISH_FOOT_Y + 1e-9);
    }
    for (const frame of ['warn', 'pinch'] as const) {
      expect(Math.max(...inkOf(frame).map((b) => b.maxY))).toBeCloseTo(CRAYFISH_FOOT_Y, 9);
    }
  });
});

describe('crayfish poses', () => {
  it('walkA and walkB swing the four feet opposite ways, lifting opposite feet, and bob the tail opposite ways; the shell stays put', () => {
    const a = crayfishGeometry('walkA');
    const b = crayfishGeometry('walkB');
    const stand = crayfishGeometry('stand');
    a.legs.forEach(([, footA], i) => {
      const footB = b.legs[i][1];
      const base = stand.legs[i][1][0];
      expect(Math.sign(footA[0] - a.legs[i][0][0])).toBe(-Math.sign(footB[0] - b.legs[i][0][0]));
      expect(footA[1]).not.toBe(footB[1]);
      expect(Math.abs(footA[0] - base)).toBeGreaterThan(2);
    });
    expect(Math.sign(a.tail[0].cy - stand.tail[0].cy)).toBe(-Math.sign(b.tail[0].cy - stand.tail[0].cy));
    for (const g of [a, b]) {
      expect(g.shell).toEqual(stand.shell);
      expect(g.eyes).toEqual(stand.eyes);
      expect(g.mouth).toEqual(stand.mouth);
      expect(g.far.gape).toBeLessThan(CRAYFISH_CLOSED_GAPE);
      expect(g.near.gape).toBeLessThan(CRAYFISH_CLOSED_GAPE);
    }
  });

  it('stand, walk and pinch keep both claws closed: a small mitten, gape under 0.3 radians', () => {
    for (const frame of ['stand', 'walkA', 'walkB', 'pinch'] as const) {
      const g = crayfishGeometry(frame);
      expect(g.far.gape).toBeLessThan(CRAYFISH_CLOSED_GAPE);
      expect(g.near.gape).toBeLessThan(CRAYFISH_CLOSED_GAPE);
    }
  });

  it('warn: both claws are opened wide (over 1.2 radians), raised above the closed claws, and the shell is reared a little', () => {
    const warn = crayfishGeometry('warn');
    const stand = crayfishGeometry('stand');
    for (const claw of [warn.far, warn.near]) expect(claw.gape).toBeGreaterThanOrEqual(CRAYFISH_OPEN_GAPE);
    expect(warn.far.palm.cy).toBeLessThan(stand.far.palm.cy - 15);
    expect(warn.near.palm.cy).toBeLessThan(stand.near.palm.cy - 5);
    // the claw is bigger open: its pincers are longer
    expect(warn.far.pincers[0].rx).toBeGreaterThan(stand.far.pincers[0].rx);
    const [carapace] = warn.shell;
    expect(carapace.rot).toBeLessThan(-0.05);
    expect(carapace.rot).toBeGreaterThan(-0.25);
    // the head and eyes rise with the shell, and the feet stay planted
    expect(warn.eyes[1][1]).toBeLessThan(stand.eyes[1][1] + 1);
    expect(warn.legs.map((leg) => leg[1][1])).toEqual(stand.legs.map((leg) => leg[1][1]));
  });

  it('pinch: both claws are closed and pushed straight forward, level along the floor, further out than any other frame', () => {
    const tip = (frame: CrayfishFrame): number =>
      Math.max(...[crayfishGeometry(frame).far, crayfishGeometry(frame).near].flatMap((claw) => claw.pincers.map((p) => p.cx + p.rx * Math.cos(p.rot))));
    const pinch = crayfishGeometry('pinch');
    for (const claw of [pinch.far, pinch.near]) {
      for (const pincer of claw.pincers) expect(Math.abs(pincer.rot)).toBeLessThan(0.3);
    }
    // both arms run level: the wrist is within 4 px of the shoulder's height, along the same line
    for (const claw of [pinch.far, pinch.near]) expect(Math.abs(claw.arm[1][1] - claw.arm[0][1])).toBeLessThan(4);
    for (const frame of ['stand', 'walkA', 'walkB'] as const) expect(tip('pinch')).toBeGreaterThan(tip(frame) + 8);
  });

  it('every frame is drawn differently', () => {
    const drawn = CRAYFISH_FRAMES.map((frame) => JSON.stringify(crayfishParts(frame).ops.map((op) => op.args)));
    expect(new Set(drawn).size).toBe(CRAYFISH_FRAMES.length);
  });
});

describe('crayfish warning in greyscale (guide 10): the open claws change the silhouette', () => {
  const measures = Object.fromEntries(CRAYFISH_FRAMES.map((f) => [f, silhouetteMeasures(f)])) as Record<CrayfishFrame, Silhouette>;

  it('the warning silhouette is much taller than any closed pose', () => {
    for (const frame of ['stand', 'walkA', 'walkB', 'pinch'] as const) {
      expect(measures.warn.height).toBeGreaterThanOrEqual(measures[frame].height * 1.35);
    }
  });

  it('the warning silhouette is wider than the standing one, and has more gaps in its bounding box', () => {
    expect(measures.warn.width).toBeGreaterThan(measures.stand.width);
    for (const frame of ['stand', 'walkA', 'walkB', 'pinch'] as const) {
      expect(measures.warn.solidity).toBeLessThan(measures[frame].solidity - 0.05);
    }
  });

  it('the claws out in front of the head spread over at least 1.6 times the height of the closed claws', () => {
    for (const frame of ['stand', 'walkA', 'walkB', 'pinch'] as const) {
      expect(measures.warn.clawSpan).toBeGreaterThanOrEqual(measures[frame].clawSpan * 1.6);
    }
  });

  it('the pinch is a different shape from the stand: the claws reach further forward on the level', () => {
    expect(measures.pinch.width).toBeGreaterThan(measures.stand.width);
    expect(Math.abs(measures.pinch.height - measures.stand.height)).toBeLessThanOrEqual(6);
  });

  it('closed frames paint two closing seams (ink lines along the claws); the open warning paints none', () => {
    for (const frame of ['stand', 'walkA', 'walkB', 'pinch'] as const) expect(crayfishParts(frame).seams).toHaveLength(2);
    expect(crayfishParts('warn').seams).toHaveLength(0);
  });
});

describe('crayfish body (round, inked, no points)', () => {
  it.each(CRAYFISH_FRAMES)('%s: the tail fan, three segments, six claw parts, the shell and two eye balls are inked rounded ellipses', (frame) => {
    const { blobs } = crayfishParts(frame);
    // 4 tail, 2 x (2 pincers + palm) claws, 1 shell, 2 eye balls
    expect(blobs).toHaveLength(4 + 6 + 1 + 2);
    for (const { ink, fill } of blobs) {
      expect(ink.strokeStyle).toBe(INK);
      expect(ink.lineWidth).toBeGreaterThanOrEqual(2 * 2 - 1e-9);
      for (const cmd of cmdsOf(fill).filter((c) => c[0] === 'ellipse')) {
        const [, cx, cy, rx, ry] = cmd as number[];
        expect([cx, cy, rx, ry].every(Number.isFinite)).toBe(true);
        expect(Math.min(rx, ry)).toBeGreaterThanOrEqual(3);
      }
    }
    expect(blobs.map((b) => b.fill.fillStyle)).toEqual([
      CRAYFISH_DARK,
      CRAYFISH_DARK,
      CRAYFISH_DARK,
      CRAYFISH_SHELL,
      CRAYFISH_CLAW,
      CRAYFISH_CLAW,
      CRAYFISH_CLAW,
      CRAYFISH_SHELL,
      CRAYFISH_CLAW,
      CRAYFISH_CLAW,
      CRAYFISH_CLAW,
      WHITE,
      WHITE,
    ]);
  });

  it.each(CRAYFISH_FRAMES)('%s: the shell is one merged path of two ellipses, outlined at the guide width', (frame) => {
    const { blobs } = crayfishParts(frame);
    const shell = blobs.find((b) => b.fill.fillStyle === CRAYFISH_SHELL && cmdsOf(b.fill).filter((c) => c[0] === 'ellipse').length === 2)!;
    expect(shell).toBeDefined();
    expect(shell.ink.lineWidth).toBeCloseTo(2 * LW, 9);
  });

  it.each(CRAYFISH_FRAMES)('%s: the belly and the shine stay inside the shell', (frame) => {
    const { ops } = crayfishParts(frame);
    const g = crayfishGeometry(frame);
    for (const [colour, e] of [
      [CRAYFISH_BELLY, g.belly],
      [CRAYFISH_SHINE, g.shine],
    ] as const) {
      const op = ops.find((o) => isFill(o) && o.fillStyle === colour)!;
      expect(ellipseOf(op).slice(0, 4)).toEqual([e.cx, e.cy, e.rx, e.ry]);
      for (const angle of [0, 1, 2, 3, 4, 5, 6]) {
        const u = e.rx * Math.cos(angle);
        const v = e.ry * Math.sin(angle);
        const x = e.cx + u * Math.cos(e.rot) - v * Math.sin(e.rot);
        const y = e.cy + u * Math.sin(e.rot) + v * Math.cos(e.rot);
        expect(insideCrayfishShell(frame, x, y, 1)).toBe(true);
      }
    }
  });
});

describe('crayfish face (round eyes, never scary, never hurting)', () => {
  it.each(CRAYFISH_FRAMES)('%s: one closed ink smile line, inside the shell, and no mouth interior', (frame) => {
    const { ops, mouth } = crayfishParts(frame);
    expect(cmdsOf(mouth).map(([name]) => name)).toEqual(['moveTo', 'quadraticCurveTo']);
    const [start, curve] = cmdsOf(mouth) as unknown as [string, ...number[]][];
    for (const [x, y] of [
      [start[1], start[2]],
      [curve[3], curve[4]],
    ]) {
      expect(insideCrayfishShell(frame, x, y, 0.5)).toBe(true);
    }
    // the only fills are shell colours, the belly, the shine, the eyes and their glints: no mouth interior, no tooth, no tongue
    expect(styleOfFills(ops)).toEqual(new Set([CRAYFISH_DARK, CRAYFISH_SHELL, CRAYFISH_CLAW, CRAYFISH_BELLY, CRAYFISH_SHINE, EYE, WHITE]));
  });

  it.each(CRAYFISH_FRAMES)('%s: two round eyes, each a white ball with a bead pupil and two glints, above the smile', (frame) => {
    const { ops } = crayfishParts(frame);
    const g = crayfishGeometry(frame);
    const beads = ops.filter((op) => isFill(op) && op.fillStyle === EYE);
    expect(beads).toHaveLength(2);
    beads.forEach((bead, i) => {
      const [px, py, r] = ellipseOf(bead);
      expect([px, py]).toEqual([g.pupils[i][0], g.pupils[i][1]]);
      expect(r).toBeGreaterThan(3);
      // the pupil sits inside its ball, and the ball is round
      expect(Math.hypot(px - g.eyes[i][0], py - g.eyes[i][1]) + r).toBeLessThan(CRAYFISH_EYE_BALL_R);
      expect(g.eyes[i][1]).toBeLessThan(g.mouth[0][1]);
    });
    const glints = ops.filter((op) => isFill(op) && op.fillStyle === WHITE && cmdsOf(op).filter((c) => c[0] === 'ellipse').length === 2);
    expect(glints).toHaveLength(2);
  });

  it.each(CRAYFISH_FRAMES)('%s: every claw tip is a rounded ellipse, with no points', (frame) => {
    const g = crayfishGeometry(frame);
    for (const claw of [g.far, g.near]) {
      for (const pincer of [...claw.pincers, claw.palm]) {
        expect(pincer.ry).toBeGreaterThanOrEqual(4);
        expect(pincer.ry / pincer.rx).toBeGreaterThanOrEqual(0.2);
      }
    }
  });

  it.each(CRAYFISH_FRAMES)('%s: paints only crayfish colours, ink, the eye and white', (frame) => {
    const { ops } = crayfishParts(frame);
    const styles = new Set(ops.flatMap((op) => (isFill(op) ? [op.fillStyle] : [op.strokeStyle])));
    expect(styles).toEqual(new Set([INK, CRAYFISH_SHELL, CRAYFISH_DARK, CRAYFISH_CLAW, CRAYFISH_BELLY, CRAYFISH_SHINE, EYE, WHITE]));
  });

  it('is never shown holding or hurting the axolotl: no frame paints the hero belly, the leg-loss sparkle, or the alert', () => {
    for (const frame of CRAYFISH_FRAMES) {
      const { ops } = crayfishParts(frame);
      for (const op of ops) {
        for (const colour of [op.fillStyle, op.strokeStyle]) {
          expect(colour).not.toBe(POOF_SPARKLE);
          expect(colour).not.toBe(ALERT_FILL);
          expect(colour).not.toBe(HERO_BELLY);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

/** A scene stand-in whose canvas textures record what is painted on them. */
function withFakeScene<T>(run: (scene: never, made: Map<string, Recording>) => T): T {
  vi.stubGlobal('Path2D', LogPath);
  const made = new Map<string, Recording>();
  const scene = {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string) => {
        const rec = recordingContext();
        made.set(key, rec);
        return { context: rec.ctx, refresh: () => undefined };
      },
    },
  } as never;
  try {
    return run(scene, made);
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('bakePredatorTextures', () => {
  const UNCHANGED = [
    ...(['swim', 'windup', 'lunge', 'rest'] as const).map(tilapiaKey),
    'tilapia-alert',
    'tilapia-glint',
    'fx-poof',
    'fx-halo',
    'fx-carry-bubble',
    ...(['present', 'outline'] as const).map(legIconKey),
    'leg-regrow-mark',
  ];
  /** The wading heron (issue #111). */
  const WADING_HERON = [
    'heron-body-stand',
    'heron-body-step-a',
    'heron-body-step-b',
    'heron-head-rest',
    'heron-head-warn',
    'heron-stab-head',
    'heron-stab-neck',
  ];

  /** The garter snake (issue #103): six frames and one ripple ring. */
  const GARTER_SNAKE = [
    'garter-snake-swim-a',
    'garter-snake-swim-b',
    'garter-snake-swim-c',
    'garter-snake-swim-d',
    'garter-snake-hold',
    'garter-snake-dart',
    'garter-snake-ripple',
  ];

  /** The common carp (issue #117): five frames and two mud puffs. */
  const CARP = [
    'carp-swim-0',
    'carp-swim-1',
    'carp-swim-2',
    'carp-warn',
    'carp-sweep',
    'carp-puff',
    'carp-puff-still',
  ];

  /** The crayfish (issue #77): five frames. */
  const CRAYFISH = ['crayfish-stand', 'crayfish-walk-a', 'crayfish-walk-b', 'crayfish-warn', 'crayfish-pinch'];

  it('keeps every tilapia, effect and leg texture, and bakes only the wading heron, the garter snake, the carp and the crayfish under fixed keys', () => {
    const { baked, made } = withFakeScene((scene, made) => ({ baked: bakePredatorTextures(scene, 2), made }));
    const all = [...UNCHANGED, ...WADING_HERON, ...GARTER_SNAKE, ...CARP, ...CRAYFISH].sort();
    expect([...made.keys()].sort()).toEqual(all);
    expect(Object.keys(baked.info).sort()).toEqual(all);
    for (const retired of ['heron-shadow', 'heron-shadow-warning', 'heron-beak-dip']) {
      expect(made.has(retired)).toBe(false);
      expect(Object.values(PREDATOR_TEX)).not.toContain(retired);
    }
    for (const [, canvas] of made) expect(canvas.ops.length).toBeGreaterThan(0);
  });

  it('bakes each wading heron frame under its own key at its own size', () => {
    const baked = withFakeScene((scene) => bakePredatorTextures(scene, 2));
    expect(PREDATOR_TEX.heronBodyStand).toBe('heron-body-stand');
    expect(PREDATOR_TEX.heronBodyStepA).toBe('heron-body-step-a');
    expect(PREDATOR_TEX.heronBodyStepB).toBe('heron-body-step-b');
    expect(PREDATOR_TEX.heronHeadRest).toBe('heron-head-rest');
    expect(PREDATOR_TEX.heronHeadWarn).toBe('heron-head-warn');
    expect(PREDATOR_TEX.heronStabHead).toBe('heron-stab-head');
    expect(PREDATOR_TEX.heronStabNeck).toBe('heron-stab-neck');
    expect(baked.heronBody.stand.key).toBe('heron-body-stand');
    expect(baked.heronBody.stepA.key).toBe('heron-body-step-a');
    expect(baked.heronBody.stepB.key).toBe('heron-body-step-b');
    expect(baked.heronHead.rest.key).toBe('heron-head-rest');
    expect(baked.heronHead.warn.key).toBe('heron-head-warn');
    expect(baked.heronStabHead.key).toBe('heron-stab-head');
    expect(baked.heronStabNeck.key).toBe('heron-stab-neck');
    for (const [info, tex] of [
      [baked.heronBody.stand, HERON_BODY_TEX],
      [baked.heronBody.stepA, HERON_BODY_TEX],
      [baked.heronBody.stepB, HERON_BODY_TEX],
      [baked.heronHead.rest, HERON_HEAD_TEX],
      [baked.heronHead.warn, HERON_HEAD_TEX],
      [baked.heronStabHead, HERON_STAB_HEAD_TEX],
      [baked.heronStabNeck, HERON_STAB_NECK_TEX],
    ] as const) {
      expect(info.scale).toBe(2);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([tex.w, tex.h, tex.originX, tex.originY]);
    }
  });

  it('paints each heron texture with its own painter and tone', () => {
    const made = withFakeScene((scene, made) => {
      bakePredatorTextures(scene, 1);
      return made;
    });
    const fillsOf = (key: string): unknown[] =>
      (made.get(key) as Recording).ops.filter(isFill).map((op) => op.fillStyle);
    for (const key of [PREDATOR_TEX.heronBodyStand, PREDATOR_TEX.heronBodyStepA, PREDATOR_TEX.heronBodyStepB]) {
      expect(fillsOf(key)).toEqual([HERON_FEATHER]);
    }
    for (const key of [PREDATOR_TEX.heronHeadRest, PREDATOR_TEX.heronHeadWarn, PREDATOR_TEX.heronStabHead]) {
      expect(fillsOf(key)).toContain(HERON_BEAK);
      expect(fillsOf(key)).toContain(EYE);
    }
    // the stab neck is only a tube: no fill, one HERON_FEATHER stroke
    const neck = (made.get(PREDATOR_TEX.heronStabNeck) as Recording).ops;
    expect(neck.filter(isFill)).toEqual([]);
    expect(neck.some((op) => isStroke(op) && op.strokeStyle === HERON_FEATHER)).toBe(true);
  });

  it('draws the head frames from different poses', () => {
    const made = withFakeScene((scene, made) => {
      bakePredatorTextures(scene, 1);
      return made;
    });
    const argsOf = (key: string): string => JSON.stringify((made.get(key) as Recording).ops.map((op) => op.args));
    expect(argsOf(PREDATOR_TEX.heronHeadRest)).not.toBe(argsOf(PREDATOR_TEX.heronHeadWarn));
    expect(argsOf(PREDATOR_TEX.heronBodyStand)).not.toBe(argsOf(PREDATOR_TEX.heronBodyStepA));
  });

  it('bakes each garter snake frame under its own key at its own size, and the ripple ring at the ring size', () => {
    const baked = withFakeScene((scene) => bakePredatorTextures(scene, 2));
    expect(PREDATOR_TEX.garterSnakeSwimA).toBe('garter-snake-swim-a');
    expect(PREDATOR_TEX.garterSnakeSwimB).toBe('garter-snake-swim-b');
    expect(PREDATOR_TEX.garterSnakeSwimC).toBe('garter-snake-swim-c');
    expect(PREDATOR_TEX.garterSnakeSwimD).toBe('garter-snake-swim-d');
    expect(PREDATOR_TEX.garterSnakeHold).toBe('garter-snake-hold');
    expect(PREDATOR_TEX.garterSnakeDart).toBe('garter-snake-dart');
    expect(PREDATOR_TEX.garterRipple).toBe('garter-snake-ripple');
    expect(baked.garterSnake.swimA.key).toBe('garter-snake-swim-a');
    expect(baked.garterSnake.swimB.key).toBe('garter-snake-swim-b');
    expect(baked.garterSnake.swimC.key).toBe('garter-snake-swim-c');
    expect(baked.garterSnake.swimD.key).toBe('garter-snake-swim-d');
    expect(baked.garterSnake.hold.key).toBe('garter-snake-hold');
    expect(baked.garterSnake.dart.key).toBe('garter-snake-dart');
    expect(baked.garterRipple.key).toBe('garter-snake-ripple');
    for (const frame of SNAKE_FRAME_LIST) {
      const info = baked.garterSnake[frame];
      expect(info.scale).toBe(2);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([
        GARTER_SNAKE_TEX.w,
        GARTER_SNAKE_TEX.h,
        GARTER_SNAKE_TEX.originX,
        GARTER_SNAKE_TEX.originY,
      ]);
    }
    expect(baked.garterRipple.scale).toBe(2);
    expect([baked.garterRipple.w, baked.garterRipple.h, baked.garterRipple.originX, baked.garterRipple.originY]).toEqual([
      GARTER_RIPPLE_TEX.w,
      GARTER_RIPPLE_TEX.h,
      GARTER_RIPPLE_TEX.originX,
      GARTER_RIPPLE_TEX.originY,
    ]);
  });

  it('paints each garter snake texture with its own painter and tone', () => {
    const made = withFakeScene((scene, made) => {
      bakePredatorTextures(scene, 1);
      return made;
    });
    const keys = [
      PREDATOR_TEX.garterSnakeSwimA,
      PREDATOR_TEX.garterSnakeSwimB,
      PREDATOR_TEX.garterSnakeSwimC,
      PREDATOR_TEX.garterSnakeSwimD,
      PREDATOR_TEX.garterSnakeHold,
      PREDATOR_TEX.garterSnakeDart,
    ];
    for (const key of keys) {
      const ops = (made.get(key) as Recording).ops;
      expect(ops.some((op) => isStroke(op) && op.strokeStyle === GARTER_BODY)).toBe(true);
      expect(ops.some((op) => isStroke(op) && op.strokeStyle === GARTER_STRIPE)).toBe(true);
      expect(ops.some((op) => isFill(op) && op.fillStyle === EYE)).toBe(true);
    }
    // the ripple is only a white tube: no fill, one white stroke
    const ring = (made.get(PREDATOR_TEX.garterRipple) as Recording).ops;
    expect(ring.filter(isFill)).toEqual([]);
    expect(ring.some((op) => isStroke(op) && op.strokeStyle === WHITE)).toBe(true);
    const argsOf = (key: string): string => JSON.stringify((made.get(key) as Recording).ops.map((op) => op.args));
    expect(new Set(keys.map(argsOf)).size).toBe(keys.length);
  });

  it('bakes each carp frame under its own key at its own size, and both puffs at the puff size', () => {
    const baked = withFakeScene((scene) => bakePredatorTextures(scene, 2));
    expect(PREDATOR_TEX.carpSwim0).toBe('carp-swim-0');
    expect(PREDATOR_TEX.carpSwim1).toBe('carp-swim-1');
    expect(PREDATOR_TEX.carpSwim2).toBe('carp-swim-2');
    expect(PREDATOR_TEX.carpWarn).toBe('carp-warn');
    expect(PREDATOR_TEX.carpSweep).toBe('carp-sweep');
    expect(PREDATOR_TEX.carpPuff).toBe('carp-puff');
    expect(PREDATOR_TEX.carpPuffStill).toBe('carp-puff-still');
    expect(baked.carp.swim0.key).toBe('carp-swim-0');
    expect(baked.carp.swim1.key).toBe('carp-swim-1');
    expect(baked.carp.swim2.key).toBe('carp-swim-2');
    expect(baked.carp.warn.key).toBe('carp-warn');
    expect(baked.carp.sweep.key).toBe('carp-sweep');
    expect(baked.carpPuff.key).toBe('carp-puff');
    expect(baked.carpPuffStill.key).toBe('carp-puff-still');
    for (const frame of CARP_FRAMES) {
      const info = baked.carp[frame];
      expect(info.scale).toBe(2);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([CARP_TEX.w, CARP_TEX.h, CARP_TEX.originX, CARP_TEX.originY]);
    }
    for (const info of [baked.carpPuff, baked.carpPuffStill]) {
      expect(info.scale).toBe(2);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([
        CARP_PUFF_TEX.w,
        CARP_PUFF_TEX.h,
        CARP_PUFF_TEX.originX,
        CARP_PUFF_TEX.originY,
      ]);
    }
  });

  it('paints each carp texture with its own painter and tone', () => {
    const made = withFakeScene((scene, made) => {
      bakePredatorTextures(scene, 1);
      return made;
    });
    const frameKeys = [
      PREDATOR_TEX.carpSwim0,
      PREDATOR_TEX.carpSwim1,
      PREDATOR_TEX.carpSwim2,
      PREDATOR_TEX.carpWarn,
      PREDATOR_TEX.carpSweep,
    ];
    for (const key of frameKeys) {
      const ops = (made.get(key) as Recording).ops;
      expect(ops.some((op) => isFill(op) && op.fillStyle === CARP_BODY)).toBe(true);
      expect(ops.some((op) => isStroke(op) && op.strokeStyle === CARP_BARBEL)).toBe(true);
      expect(ops.some((op) => isFill(op) && op.fillStyle === EYE)).toBe(true);
    }
    for (const key of [PREDATOR_TEX.carpPuff, PREDATOR_TEX.carpPuffStill]) {
      const ops = (made.get(key) as Recording).ops;
      expect(ops.some((op) => isFill(op) && op.fillStyle === CARP_PUFF)).toBe(true);
      expect(ops.some((op) => isStroke(op) && op.strokeStyle === INK)).toBe(true);
      expect(ops.some((op) => isFill(op) && op.fillStyle === EYE)).toBe(false);
    }
    const argsOf = (key: string): string => JSON.stringify((made.get(key) as Recording).ops.map((op) => op.args));
    expect(new Set(frameKeys.map(argsOf)).size).toBe(frameKeys.length);
    expect(argsOf(PREDATOR_TEX.carpPuff)).not.toBe(argsOf(PREDATOR_TEX.carpPuffStill));
  });

  it('bakes each crayfish frame under its own key at its own size', () => {
    const baked = withFakeScene((scene) => bakePredatorTextures(scene, 2));
    expect(PREDATOR_TEX.crayfishStand).toBe('crayfish-stand');
    expect(PREDATOR_TEX.crayfishWalkA).toBe('crayfish-walk-a');
    expect(PREDATOR_TEX.crayfishWalkB).toBe('crayfish-walk-b');
    expect(PREDATOR_TEX.crayfishWarn).toBe('crayfish-warn');
    expect(PREDATOR_TEX.crayfishPinch).toBe('crayfish-pinch');
    expect(baked.crayfish.stand.key).toBe('crayfish-stand');
    expect(baked.crayfish.walkA.key).toBe('crayfish-walk-a');
    expect(baked.crayfish.walkB.key).toBe('crayfish-walk-b');
    expect(baked.crayfish.warn.key).toBe('crayfish-warn');
    expect(baked.crayfish.pinch.key).toBe('crayfish-pinch');
    for (const frame of CRAYFISH_FRAMES) {
      const info = baked.crayfish[frame];
      expect(info.scale).toBe(2);
      expect([info.w, info.h, info.originX, info.originY]).toEqual([
        CRAYFISH_TEX.w,
        CRAYFISH_TEX.h,
        CRAYFISH_TEX.originX,
        CRAYFISH_TEX.originY,
      ]);
    }
  });

  it('paints each crayfish texture with its own painter and tone', () => {
    const made = withFakeScene((scene, made) => {
      bakePredatorTextures(scene, 1);
      return made;
    });
    const keys = [
      PREDATOR_TEX.crayfishStand,
      PREDATOR_TEX.crayfishWalkA,
      PREDATOR_TEX.crayfishWalkB,
      PREDATOR_TEX.crayfishWarn,
      PREDATOR_TEX.crayfishPinch,
    ];
    for (const key of keys) {
      const ops = (made.get(key) as Recording).ops;
      expect(ops.some((op) => isFill(op) && op.fillStyle === CRAYFISH_SHELL)).toBe(true);
      expect(ops.some((op) => isFill(op) && op.fillStyle === CRAYFISH_CLAW)).toBe(true);
      expect(ops.some((op) => isFill(op) && op.fillStyle === EYE)).toBe(true);
    }
    const argsOf = (key: string): string => JSON.stringify((made.get(key) as Recording).ops.map((op) => op.args));
    expect(new Set(keys.map(argsOf)).size).toBe(keys.length);
  });
});
