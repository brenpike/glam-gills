/**
 * Sharp litter colours, size, pale rim, kid-safe shapes and frames (issue #213; guide 7v, 3g, 10),
 * headless. The painter runs against a recording context and a stub Path2D (the same approach as
 * mudTurtleArt.test.ts): every fill and stroke is kept with the style and width it was painted under.
 * No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LITTER_BOTTLE_BODY,
  LITTER_BOTTLE_RIM,
  LITTER_CAN_BODY,
  LITTER_CAN_RIM,
  LITTER_INK,
  LITTER_KEYS,
  LITTER_KINDS,
  LITTER_RIM_W,
  LITTER_TEX,
  paintLitter,
  type LitterKind,
} from './drawLitter';
import { DEPTH } from './layers';
import { LAKE_TEX, LAKE_TEX_MAX_H, LAKE_TEX_MAX_W, LAKE_TEX_SIZES } from './lakeTextures';
import { INK } from './palette';

vi.mock('phaser', () => ({}));

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

/** The red, green and blue of a #rrggbb or rgba() colour. */
function channelsOf(colour: string): [number, number, number] {
  const rgba = /^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/.exec(colour);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(colour.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a colour. */
function relativeLuminance(colour: string): number {
  const [lr, lg, lb] = channelsOf(colour).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2 contrast ratio of two colours. */
function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The hero's belly: no litter fill is lighter (guide 2). */
const HERO_BELLY = '#ffe3ed';
/** The lake's band 3 (dark indigo) and band 4 (near-black) deep stops (drawLake.ts, guide 3c). */
const BAND_3 = ['#1f2d7a', '#1a2468', '#141a52'] as const;
const BAND_4_DEEP = '#04060f';

// ---------------------------------------------------------------------------
// Recording context
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

interface Op {
  readonly op: 'fill' | 'stroke';
  readonly cmds: unknown[][];
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly lineWidth: number;
}

/** A context that records every fill and stroke, and throws on a gradient (the bake mocks lack them). */
function recordingContext(ops: Op[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key);
        if (name in state) return state[name];
        return (...args: unknown[]) => {
          if (name.includes('Gradient')) throw new Error('litter must not use gradients');
          if (name === 'fill' || name === 'stroke') {
            ops.push({
              op: name,
              cmds: (args[0] as LogPath).cmds as unknown[][],
              fillStyle: state.fillStyle as string,
              strokeStyle: state.strokeStyle as string,
              lineWidth: state.lineWidth as number,
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

function opsOf(kind: LitterKind): Op[] {
  vi.stubGlobal('Path2D', LogPath);
  const ops: Op[] = [];
  paintLitter(recordingContext(ops), kind);
  return ops;
}

/** The colour an op paints in. */
const colourOf = (op: Op): string => (op.op === 'fill' ? op.fillStyle : op.strokeStyle);

/** The bounds of the points of a path's commands (controls included, a safe over-estimate). */
function pathBounds(cmds: unknown[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const [name, ...a] of cmds as [string, ...number[]][]) {
    if (name === 'ellipse') {
      add(a[0] - a[2], a[1] - a[3]);
      add(a[0] + a[2], a[1] + a[3]);
    } else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(name)) {
      for (let i = 0; i + 1 < a.length; i += 2) add(a[i], a[i + 1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** The silhouette of a kind, ink included: the union of the ink strokes (the outer paths, LITTER_INK outside). */
function silhouette(kind: LitterKind): { w: number; h: number; minX: number; minY: number; maxX: number; maxY: number } {
  const inks = opsOf(kind).filter((op) => op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2 * LITTER_INK);
  expect(inks.length).toBeGreaterThan(0);
  const all = inks.map((op) => pathBounds(op.cmds));
  const minX = Math.min(...all.map((b) => b.minX)) - LITTER_INK;
  const maxX = Math.max(...all.map((b) => b.maxX)) + LITTER_INK;
  const minY = Math.min(...all.map((b) => b.minY)) - LITTER_INK;
  const maxY = Math.max(...all.map((b) => b.maxY)) + LITTER_INK;
  return { w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

const RIM: Readonly<Record<LitterKind, string>> = { can: LITTER_CAN_RIM, bottle: LITTER_BOTTLE_RIM };
const BODY: Readonly<Record<LitterKind, string>> = { can: LITTER_CAN_BODY, bottle: LITTER_BOTTLE_BODY };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sharp litter size and frame', () => {
  it('names two kinds with their own keys, both in the lake texture set at the shared frame', () => {
    expect(LITTER_KINDS).toEqual(['can', 'bottle']);
    expect(new Set(Object.values(LITTER_KEYS)).size).toBe(2);
    expect(LAKE_TEX.litterCan).toBe(LITTER_KEYS.can);
    expect(LAKE_TEX.litterBottle).toBe(LITTER_KEYS.bottle);
    for (const kind of LITTER_KINDS) expect(LAKE_TEX_SIZES[LITTER_KEYS[kind]]).toBe(LITTER_TEX);
  });

  it('fits the lake small-sprite caps', () => {
    expect(LITTER_TEX.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
    expect(LITTER_TEX.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
  });

  it.each(LITTER_KINDS)('%s: the silhouette is 20 to 28 px on its long side and sits inside the frame with 3 px or more to spare', (kind) => {
    const s = silhouette(kind);
    expect(Math.max(s.w, s.h)).toBeGreaterThanOrEqual(20);
    expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(28);
    expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(14);
    expect(LITTER_TEX.originX + s.minX).toBeGreaterThanOrEqual(3);
    expect(LITTER_TEX.originY + s.minY).toBeGreaterThanOrEqual(3);
    expect(LITTER_TEX.w - LITTER_TEX.originX - s.maxX).toBeGreaterThanOrEqual(3);
    expect(LITTER_TEX.h - LITTER_TEX.originY - s.maxY).toBeGreaterThanOrEqual(3);
  });

  it('is centred on its anchor, the logic point', () => {
    for (const kind of LITTER_KINDS) {
      const s = silhouette(kind);
      expect(Math.abs((s.minX + s.maxX) / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs((s.minY + s.maxY) / 2)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('sharp litter kinds', () => {
  it('paints the two kinds differently, and the bottle taller and slimmer than the can', () => {
    expect(JSON.stringify(opsOf('can'))).not.toBe(JSON.stringify(opsOf('bottle')));
    const can = silhouette('can');
    const bottle = silhouette('bottle');
    expect(bottle.h / bottle.w).toBeGreaterThan(can.h / can.w + 0.3);
  });

  it.each(LITTER_KINDS)('%s: paints the same ops on every run (no time, no randomness)', (kind) => {
    expect(JSON.stringify(opsOf(kind))).toBe(JSON.stringify(opsOf(kind)));
  });

  it.each(LITTER_KINDS)('%s: uses no gradient (the recording context throws on one)', (kind) => {
    expect(() => opsOf(kind)).not.toThrow();
  });
});

describe('sharp litter pale rim (a hazard stays visible in the dark)', () => {
  it.each(LITTER_KINDS)('%s: the rim is much lighter than the body and reads on band 3 and band 4', (kind) => {
    expect(relativeLuminance(RIM[kind])).toBeGreaterThanOrEqual(0.6);
    expect(relativeLuminance(RIM[kind])).toBeGreaterThan(relativeLuminance(BODY[kind]) * 2);
    expect(contrastRatio(RIM[kind], BAND_4_DEEP)).toBeGreaterThanOrEqual(7);
    for (const stop of BAND_3) expect(contrastRatio(RIM[kind], stop)).toBeGreaterThanOrEqual(4.5);
    // ink alone cannot hold the edge in the dark: it is under 3:1 against band 4
    expect(contrastRatio(INK, BAND_4_DEEP)).toBeLessThan(3);
  });

  it.each(LITTER_KINDS)('%s: paints inks first, then the rims, then the cores, so the rim runs all round', (kind) => {
    const ops = opsOf(kind);
    const lastInk = ops.map((op, i) => (op.op === 'stroke' && op.strokeStyle === INK && op.lineWidth === 2 * LITTER_INK ? i : -1)).reduce((a, b) => Math.max(a, b));
    const firstRim = ops.findIndex((op) => op.op === 'fill' && op.fillStyle === RIM[kind]);
    const lastRim = ops.map((op, i) => (op.op === 'fill' && op.fillStyle === RIM[kind] ? i : -1)).reduce((a, b) => Math.max(a, b));
    const firstCore = ops.findIndex((op) => op.op === 'fill' && op.fillStyle === BODY[kind]);
    expect(firstRim).toBeGreaterThan(lastInk);
    expect(firstCore).toBeGreaterThan(lastRim);
  });

  it.each(LITTER_KINDS)('%s: the core is inset by the rim width on each side of the body', (kind) => {
    const ops = opsOf(kind);
    const rimBody = pathBounds(ops.find((op) => op.op === 'fill' && op.fillStyle === RIM[kind])!.cmds);
    const core = pathBounds(ops.find((op) => op.op === 'fill' && op.fillStyle === BODY[kind])!.cmds);
    expect(core.minX - rimBody.minX).toBeGreaterThanOrEqual(LITTER_RIM_W - 0.01);
    expect(rimBody.maxX - core.maxX).toBeGreaterThanOrEqual(LITTER_RIM_W - 0.01);
    expect(rimBody.maxY - core.maxY).toBeGreaterThanOrEqual(LITTER_RIM_W - 0.01);
  });
});

describe('sharp litter is gentle: no red, nothing brighter than the hero, no shards', () => {
  it.each(LITTER_KINDS)('%s: no colour has red as its strongest channel', (kind) => {
    for (const op of opsOf(kind)) {
      const [r, g, b] = channelsOf(colourOf(op));
      expect(r, colourOf(op)).toBeLessThanOrEqual(Math.max(g, b));
    }
  });

  it.each(LITTER_KINDS)('%s: no fill is as light as the hero belly', (kind) => {
    // see-through detail (rgba) only lightens its own body, so it is judged with it, not alone
    for (const op of opsOf(kind).filter((o) => o.op === 'fill' && o.fillStyle.startsWith('#'))) {
      expect(relativeLuminance(op.fillStyle), op.fillStyle).toBeLessThan(relativeLuminance(HERO_BELLY));
    }
  });

  it.each(LITTER_KINDS)('%s: every path is moves, lines, quadratic curves and ellipses only, and every outline closes', (kind) => {
    for (const op of opsOf(kind)) {
      for (const [name] of op.cmds) expect(['moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'ellipse']).toContain(name);
    }
    for (const op of opsOf(kind).filter((o) => o.op === 'fill' && o.lineWidth !== 0)) {
      const names = op.cmds.map(([name]) => name);
      if (!names.includes('ellipse')) expect(names[names.length - 1]).toBe('closePath');
    }
  });

  it.each(LITTER_KINDS)('%s: every corner of the outline is rounded: a quadratic curve sits between every two lines that meet', (kind) => {
    const outline = opsOf(kind).find((op) => op.op === 'fill' && op.fillStyle === RIM[kind] && !op.cmds.some(([n]) => n === 'ellipse'))!;
    const names = outline.cmds.map(([name]) => name).filter((n) => n !== 'closePath');
    for (let i = 1; i < names.length; i += 1) {
      expect(names[i] === 'lineTo' && names[i - 1] === 'lineTo', `lineTo after lineTo at ${i}`).toBe(false);
    }
  });
});

describe('sharp litter chip and dent are smooth curves', () => {
  it('the can has a dent: a quadratic curve that bites inward from the right side', () => {
    const body = opsOf('can').find((op) => op.op === 'fill' && op.fillStyle === LITTER_CAN_RIM && !op.cmds.some(([n]) => n === 'ellipse'))!;
    const quads = body.cmds.filter(([n]) => n === 'quadraticCurveTo') as unknown as [string, number, number, number, number][];
    const bite = quads.find(([, cx, , ex]) => cx < ex - 3);
    expect(bite).toBeDefined();
  });

  it('the bottle neck is chipped: its lip is lower on the right than on the left, joined by round curves', () => {
    const outline = opsOf('bottle').find((op) => op.op === 'fill' && op.fillStyle === LITTER_BOTTLE_RIM)!;
    const points = outline.cmds.filter(([n]) => n === 'moveTo' || n === 'lineTo' || n === 'quadraticCurveTo').map((c) => {
      const a = c.slice(1) as number[];
      return [a[a.length - 2], a[a.length - 1]] as const;
    });
    const neck = points.filter(([, y]) => y < -6);
    const rightTop = Math.min(...neck.filter(([x]) => x > 1).map(([, y]) => y));
    const leftTop = Math.min(...neck.filter(([x]) => x < -1).map(([, y]) => y));
    expect(leftTop).toBeLessThan(rightTop - 1.5);
  });
});

describe('sharp litter draw depth', () => {
  it('has a depth of its own: above the dark layer and the fading lights, below the rock, every predator and the axolotl', () => {
    expect(Object.values(DEPTH).filter((d) => d === DEPTH.litter)).toHaveLength(1);
    expect(DEPTH.litter).toBeGreaterThan(DEPTH.darkWater);
    expect(DEPTH.litter).toBeGreaterThan(DEPTH.glowPlant);
    expect(DEPTH.litter).toBeLessThan(DEPTH.rock);
    expect(DEPTH.litter).toBeLessThan(DEPTH.tilapia);
    expect(DEPTH.litter).toBeLessThan(DEPTH.axolotl);
  });
});
