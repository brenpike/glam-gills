/**
 * Drifting island colours, size, half-mat seam, brightness under the hero and difference from the
 * water hyacinth mats (issue #213; guide 7w, 3g, 10), headless. The painter runs against a recording
 * context and a stub Path2D (the same approach as litterArt.test.ts). No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRIFTING_ISLAND_HALF_TEX,
  DRIFTING_ISLAND_HALF_W,
  DRIFTING_ISLAND_INK,
  DRIFTING_ISLAND_KEY,
  DRIFTING_ISLAND_MAT,
  DRIFTING_ISLAND_REED,
  DRIFTING_ISLAND_REEDS,
  DRIFTING_ISLAND_ROOT,
  DRIFTING_ISLAND_ROOTS,
  DRIFTING_ISLAND_SEED,
  DRIFTING_ISLAND_SLAB_RX,
  DRIFTING_ISLAND_STRAW,
  driftingIslandSeedHead,
  paintDriftingIslandHalf,
} from './drawDriftingIsland';
import { DEPTH } from './layers';
import { LAKE_TEX, LAKE_TEX_MAX_H, LAKE_TEX_MAX_W, LAKE_TEX_SIZES } from './lakeTextures';
import { INK } from './palette';

vi.mock('phaser', () => ({}));

function channelsOf(colour: string): [number, number, number] {
  expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(colour.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function relativeLuminance(colour: string): number {
  const [lr, lg, lb] = channelsOf(colour).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** The hero's belly: no island fill is as light (guide 2). */
const HERO_BELLY = '#ffe3ed';
/** Area 5's water hyacinth mat colours (guide 3g, ADR 0020): the island uses none of them. */
const HYACINTH_COLOURS = ['#3fa84f', '#78d46a', '#c8a8f2', '#ffe14a', '#86a070', '#a8bc8c', '#bba6d4', '#e4cc90'];

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
          if (name.includes('Gradient')) throw new Error('the island must not use gradients');
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

function paintOps(): Op[] {
  vi.stubGlobal('Path2D', LogPath);
  const ops: Op[] = [];
  paintDriftingIslandHalf(recordingContext(ops));
  return ops;
}

const colourOf = (op: Op): string => (op.op === 'fill' ? op.fillStyle : op.strokeStyle);

/** Bounds of a path's points (controls included, a safe over-estimate), grown by half the stroke width. */
function boundsOf(op: Op): { minX: number; minY: number; maxX: number; maxY: number } {
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
  for (const [name, ...a] of op.cmds as [string, ...number[]][]) {
    if (name === 'ellipse') {
      const r = Math.max(a[2], a[3]);
      add(a[0] - (a[4] ? r : a[2]), a[1] - (a[4] ? r : a[3]));
      add(a[0] + (a[4] ? r : a[2]), a[1] + (a[4] ? r : a[3]));
    } else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(name)) {
      for (let i = 0; i + 1 < a.length; i += 2) add(a[i], a[i + 1]);
    }
  }
  const grow = op.op === 'stroke' ? op.lineWidth / 2 : 0;
  return { minX: minX - grow, minY: minY - grow, maxX: maxX + grow, maxY: maxY + grow };
}

const PALETTE = [DRIFTING_ISLAND_MAT, DRIFTING_ISLAND_STRAW, DRIFTING_ISLAND_REED, DRIFTING_ISLAND_SEED, DRIFTING_ISLAND_ROOT];

describe('drifting island size and frame', () => {
  it('has one baked half mat in the lake texture set, at the painter frame', () => {
    expect(DRIFTING_ISLAND_KEY).toBe('drifting-island-half');
    expect(LAKE_TEX.driftingIslandHalf).toBe(DRIFTING_ISLAND_KEY);
    expect(LAKE_TEX_SIZES[DRIFTING_ISLAND_KEY]).toBe(DRIFTING_ISLAND_HALF_TEX);
  });

  it('fits the lake small-sprite caps (128 x 112) while two halves make a 240 px island', () => {
    expect(DRIFTING_ISLAND_HALF_TEX.w).toBeLessThanOrEqual(LAKE_TEX_MAX_W);
    expect(DRIFTING_ISLAND_HALF_TEX.h).toBeLessThanOrEqual(LAKE_TEX_MAX_H);
    expect(DRIFTING_ISLAND_HALF_W * 2).toBe(240);
    expect(DRIFTING_ISLAND_SLAB_RX + DRIFTING_ISLAND_INK).toBe(DRIFTING_ISLAND_HALF_W);
  });

  it('is anchored on the centre line at the water line: the left edge, with the reeds above and the roots below', () => {
    expect(DRIFTING_ISLAND_HALF_TEX.originX).toBe(0);
    expect(DRIFTING_ISLAND_HALF_TEX.originY).toBeGreaterThan(0);
    expect(DRIFTING_ISLAND_HALF_TEX.h - DRIFTING_ISLAND_HALF_TEX.originY).toBeGreaterThan(DRIFTING_ISLAND_HALF_TEX.originY);
  });

  it('paints every shape inside the frame, and the slab reaches 120 px from the centre line', () => {
    const ops = paintOps();
    expect(ops.length).toBeGreaterThan(0);
    const { w, h, originY } = DRIFTING_ISLAND_HALF_TEX;
    let maxX = -Infinity;
    for (const op of ops) {
      const b = boundsOf(op);
      expect(b.maxX).toBeLessThanOrEqual(w);
      expect(b.minY).toBeGreaterThanOrEqual(-originY);
      expect(b.maxY).toBeLessThanOrEqual(h - originY);
      maxX = Math.max(maxX, b.maxX);
    }
    expect(maxX).toBeGreaterThanOrEqual(DRIFTING_ISLAND_HALF_W - 1);
    expect(maxX).toBeLessThanOrEqual(DRIFTING_ISLAND_HALF_W + 1);
  });

  it('keeps 6 px or more between the centre line and the first reed and the first root, so the mirrored seam is clean', () => {
    expect(Math.min(...DRIFTING_ISLAND_REEDS.map((r) => r.x))).toBeGreaterThanOrEqual(6);
    expect(Math.min(...DRIFTING_ISLAND_ROOTS.map((r) => r.x))).toBeGreaterThanOrEqual(6);
  });

  it('has reeds standing above the water line and roots trailing below it', () => {
    expect(DRIFTING_ISLAND_REEDS.length).toBeGreaterThanOrEqual(6);
    expect(DRIFTING_ISLAND_ROOTS.length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...DRIFTING_ISLAND_REEDS.map((r) => r.h))).toBeGreaterThan(20);
    expect(Math.max(...DRIFTING_ISLAND_ROOTS.map((r) => r.len))).toBeGreaterThan(40);
    expect(DRIFTING_ISLAND_REEDS.some((r) => r.head)).toBe(true);
    const head = driftingIslandSeedHead(DRIFTING_ISLAND_REEDS.find((r) => r.head)!);
    expect(head.cy).toBeLessThan(0);
  });
});

describe('drifting island stays under the hero', () => {
  it('has no fill as light as the hero belly', () => {
    for (const c of PALETTE) expect(relativeLuminance(c), c).toBeLessThan(relativeLuminance(HERO_BELLY) * 0.5);
  });

  it('keeps the roots the darkest and dullest fill, so the axolotl reads over them', () => {
    const root = relativeLuminance(DRIFTING_ISLAND_ROOT);
    expect(root).toBeLessThanOrEqual(0.15);
    for (const c of PALETTE.filter((p) => p !== DRIFTING_ISLAND_ROOT)) expect(relativeLuminance(c), c).toBeGreaterThan(root);
    const [r, g, b] = channelsOf(DRIFTING_ISLAND_ROOT);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(50);
  });

  it('paints only the island palette and ink', () => {
    for (const op of paintOps()) expect([...PALETTE, INK]).toContain(colourOf(op));
  });

  it('paints the roots first, so the slab and every other part cover their tops', () => {
    const ops = paintOps();
    const lastRoot = ops.map((op, i) => (colourOf(op) === DRIFTING_ISLAND_ROOT ? i : -1)).reduce((a, b) => Math.max(a, b));
    const firstSlab = ops.findIndex((op) => op.op === 'fill' && op.fillStyle === DRIFTING_ISLAND_MAT);
    expect(lastRoot).toBeLessThan(firstSlab);
  });
});

describe('drifting island is not a water hyacinth mat', () => {
  it('uses none of the hyacinth colours and no violet or lilac (blue never beats green)', () => {
    for (const c of PALETTE) {
      expect(HYACINTH_COLOURS).not.toContain(c);
      const [, g, b] = channelsOf(c);
      expect(b, c).toBeLessThanOrEqual(g);
    }
  });

  it('is a flat slab: the longest ellipse is far wider than tall, with no scalloped leaf circles', () => {
    const ellipses = paintOps()
      .filter((op) => op.op === 'fill' && op.fillStyle === DRIFTING_ISLAND_MAT)
      .map((op) => op.cmds.find(([n]) => n === 'ellipse') as unknown as [string, number, number, number, number]);
    expect(ellipses.length).toBeGreaterThan(1);
    for (const [, , , rx, ry] of ellipses) expect(rx / ry).toBeGreaterThan(3);
  });
});

describe('drifting island painter', () => {
  it('paints the same ops on every run (no time, no randomness)', () => {
    expect(JSON.stringify(paintOps())).toBe(JSON.stringify(paintOps()));
  });

  it('uses no gradient (the recording context throws on one) and only moves, lines, curves and ellipses', () => {
    for (const op of paintOps()) {
      for (const [name] of op.cmds) expect(['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse']).toContain(name);
    }
  });
});

describe('drifting island draw depth', () => {
  it('has a depth of its own: above the haze and the heron body, under the pelican body, every cue object and the axolotl', () => {
    expect(Object.values(DEPTH).filter((d) => d === DEPTH.driftingIsland)).toHaveLength(1);
    expect(DEPTH.driftingIsland).toBeGreaterThan(DEPTH.haze);
    expect(DEPTH.driftingIsland).toBeGreaterThan(DEPTH.heronBody);
    expect(DEPTH.driftingIsland).toBeLessThan(DEPTH.pelicanBody);
    expect(DEPTH.driftingIsland).toBeLessThan(DEPTH.homeSpot);
    expect(DEPTH.driftingIsland).toBeLessThan(DEPTH.axolotl);
  });
});
