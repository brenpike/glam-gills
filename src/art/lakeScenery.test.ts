/**
 * Open lake scenery (issue #211, Area 12, ND-4), headless: the background chunk of the lake looks
 * (volcanoes, streaming clouds, water by depth band, lakebed in the solid rects) and the bake that
 * clips the area's rock walls to each chunk. The painters run against a recording context and a stub
 * Path2D (the same approach as lakeArt.test.ts); the bake runs against a fake scene whose canvases
 * record. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LAKE_LIP,
  LAKE_SKY_BAND_BOTTOM,
  LAKE_SNOW,
  LAKE_WATER_BANDS,
  STREAK_ROWS,
  lakeWaterBand,
  lakeWaterStops,
  type LakeBand,
  type LakeRect,
} from './drawLake';
import { BG_CHUNK, LAKE_FLOOR, clipRectsToChunk, paintBackgroundChunk, type ChunkOptions } from './drawScenery';
import { BED_TOP } from '../logic/zone';
import type { AreaLookId } from './habitatLook';
import { VIEW_H, VIEW_W } from './palette';
import { areaBgKey, areaDeepRowBgKey, bakeAreaScenery, type AreaSceneryOptions } from './textures';

vi.mock('phaser', () => ({}));

// ---------------------------------------------------------------------------
// Recording context
// ---------------------------------------------------------------------------

type Cmd = [string, ...number[]];

class LogPath {
  readonly cmds: Cmd[] = [];
  constructor() {
    return new Proxy(this, {
      get: (target, key) =>
        key === 'cmds' ? target.cmds : (...args: number[]) => void target.cmds.push([String(key), ...args]),
    });
  }
}

class GradientStub {
  readonly stops: [number, string][] = [];
  constructor(readonly extent: readonly number[]) {}
  addColorStop(t: number, colour: string): void {
    this.stops.push([t, colour]);
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly gradient: GradientStub | null;
  readonly lineWidth: number;
}

function recordCtx(): { ctx: CanvasRenderingContext2D; painted: Painted[] } {
  const painted: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const styleOf = (target: Record<string, unknown>, fill: boolean): { style: string; gradient: GradientStub | null } => {
    const value = fill ? target.fillStyle : target.strokeStyle;
    return { style: value instanceof GradientStub ? 'gradient' : String(value), gradient: value instanceof GradientStub ? value : null };
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...a: number[]) => new GradientStub(a);
      return (...args: unknown[]) => {
        const path = args[0] as LogPath | undefined;
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          painted.push({ op: name, cmds: path.cmds, ...styleOf(target, name === 'fill'), lineWidth: target.lineWidth as number });
        } else if (name === 'fillRect') {
          painted.push({
            op: 'fill',
            cmds: [['fillRect', ...(args as number[])]],
            ...styleOf(target, true),
            lineWidth: target.lineWidth as number,
          });
        }
      };
    },
    set: (target, key, value) => {
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, painted };
}

function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const rec = recordCtx();
  paint(rec.ctx);
  return rec.painted;
}

afterEach(() => vi.unstubAllGlobals());

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded rand that counts its draws. */
function counting(seed: number): { rand: () => number; count: () => number } {
  const inner = seeded(seed);
  let n = 0;
  return {
    rand: () => {
      n++;
      return inner();
    },
    count: () => n,
  };
}

const signature = (painted: readonly Painted[]): string =>
  JSON.stringify(painted.map((p) => [p.op, p.cmds, p.style, p.gradient?.stops ?? null, p.op === 'stroke' ? p.lineWidth : 0]));

type Base = Omit<ChunkOptions, 'rand'>;
const chunkOf = (opts: Base, seed = 5): Painted[] => record((ctx) => paintBackgroundChunk(ctx, { ...opts, rand: seeded(seed) }));
const base = (look: AreaLookId, extra: Partial<Base> = {}): Base => ({
  row: 'top',
  index: 4,
  hasSun: false,
  hasBank: false,
  look,
  ...extra,
});

/** The chunk that Popocatepetl and Iztaccihuatl reach (the world x of both is about 1960 to 2300). */
const VOLCANO_CHUNK = 4;
const SNOW_CLOUD_SHINE = 'rgba(207,238,255,0.9)';

const hasStyle = (painted: readonly Painted[], style: string): boolean => painted.some((p) => p.style === style);

/** The gradients of the full-width water fills of a chunk (a gradient fill taller than the sky band; the silt of a rect is narrower). */
const waterGradients = (painted: readonly Painted[]): GradientStub[] =>
  painted
    .filter((p) => p.gradient !== null && p.cmds[0][0] === 'fillRect' && p.cmds[0][1] === 0 && p.cmds[0][3] === VIEW_W)
    .filter((p) => p.cmds[0][4] > 100)
    .map((p) => p.gradient!);

// ---------------------------------------------------------------------------
// clipRectsToChunk
// ---------------------------------------------------------------------------

describe('clipRectsToChunk', () => {
  it('turns a wall inside the chunk into chunk coordinates', () => {
    const out = clipRectsToChunk([{ x0: 100, x1: 220, y0: 40, y1: 90 }], 0, 0);
    expect(out).toEqual([{ x: 100, y: 40, w: 120, h: 50 }]);
  });

  it('offsets by the chunk column and row', () => {
    const out = clipRectsToChunk([{ x0: 1000, x1: 1100, y0: 800, y1: 900 }], 2, 2);
    expect(out).toEqual([{ x: 40, y: 80, w: 100, h: 100 }]);
  });

  it('clips a wall that crosses a chunk edge to each side, and the parts meet at the edge', () => {
    const wall = { x0: 400, x1: 560, y0: 300, y1: 340 };
    const left = clipRectsToChunk([wall], 0, 0);
    const right = clipRectsToChunk([wall], 1, 0);
    expect(left).toEqual([{ x: 400, y: 300, w: VIEW_W - 400, h: 40 }]);
    expect(right).toEqual([{ x: 0, y: 300, w: 80, h: 40 }]);
    expect(left[0].x + left[0].w).toBe(BG_CHUNK.w);
    expect(left[0].w + right[0].w).toBe(wall.x1 - wall.x0);
  });

  it('clips a wall that crosses a row edge, and keeps every part inside the chunk', () => {
    const wall = { x0: 10, x1: 60, y0: 300, y1: 420 };
    const top = clipRectsToChunk([wall], 0, 0);
    const below = clipRectsToChunk([wall], 0, 1);
    expect(top).toEqual([{ x: 10, y: 300, w: 50, h: 60 }]);
    expect(below).toEqual([{ x: 10, y: 0, w: 50, h: 60 }]);
    for (const r of [...top, ...below]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(VIEW_W);
      expect(r.y + r.h).toBeLessThanOrEqual(VIEW_H);
    }
  });

  it('gives nothing for walls outside the chunk or only touching its edge', () => {
    const walls = [
      { x0: 500, x1: 600, y0: 0, y1: 100 },
      { x0: 480, x1: 560, y0: 0, y1: 100 },
      { x0: 0, x1: 100, y0: 360, y1: 400 },
      { x0: 50, x1: 50, y0: 10, y1: 100 },
    ];
    expect(clipRectsToChunk(walls, 0, 0)).toEqual([]);
  });

  it('keeps the walls in data order', () => {
    const out = clipRectsToChunk(
      [
        { x0: 300, x1: 320, y0: 10, y1: 20 },
        { x0: 100, x1: 120, y0: 10, y1: 20 },
      ],
      0,
      0,
    );
    expect(out.map((r) => r.x)).toEqual([300, 100]);
  });
});

// ---------------------------------------------------------------------------
// Volcanoes and clouds
// ---------------------------------------------------------------------------

describe('lake sky', () => {
  it.each<AreaLookId>(['open-lake', 'open-lake-windy', 'open-lake-still', 'open-lake-late'])('%s stands the volcanoes in the top row where they reach', (look) => {
    expect(hasStyle(chunkOf(base(look, { index: VOLCANO_CHUNK })), LAKE_SNOW)).toBe(true);
  });

  it('paints no volcano where they do not reach', () => {
    expect(hasStyle(chunkOf(base('open-lake', { index: 0 })), LAKE_SNOW)).toBe(false);
    expect(hasStyle(chunkOf(base('open-lake', { index: 9 })), LAKE_SNOW)).toBe(false);
  });

  it.each<ChunkOptions['row']>(['middle', 'bottom'])('paints no volcano in a %s row', (row) => {
    expect(hasStyle(chunkOf(base('open-lake', { row, index: VOLCANO_CHUNK })), LAKE_SNOW)).toBe(false);
  });

  it('paints volcanoes in no other look', () => {
    const others: AreaLookId[] = ['canal', 'pond', 'pond-dusk', 'chinampa', 'spring-cave', 'deep-canal', 'deep-canal-golden'];
    for (const look of others) {
      expect(hasStyle(chunkOf(base(look, { index: VOLCANO_CHUNK })), LAKE_SNOW), look).toBe(false);
    }
  });

  it('paints the volcanoes before the water', () => {
    const painted = chunkOf(base('open-lake', { index: VOLCANO_CHUNK }));
    const snow = painted.findIndex((p) => p.style === LAKE_SNOW);
    const water = painted.findIndex((p) => p.cmds[0][0] === 'fillRect' && p.cmds[0][2] === LAKE_SKY_BAND_BOTTOM - 3);
    expect(snow).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(snow);
  });

  it('streams the clouds only in the windy variant, two draws per cloud row, in place of the cloud draws', () => {
    const windy = chunkOf(base('open-lake-windy'));
    const plain = chunkOf(base('open-lake'));
    expect(hasStyle(windy, SNOW_CLOUD_SHINE)).toBe(true);
    expect(hasStyle(plain, SNOW_CLOUD_SHINE)).toBe(false);
    expect(hasStyle(chunkOf(base('canal')), SNOW_CLOUD_SHINE)).toBe(false);
    const windyRand = counting(5);
    const plainRand = counting(5);
    record((ctx) => paintBackgroundChunk(ctx, { ...base('open-lake-windy'), rand: windyRand.rand }));
    record((ctx) => paintBackgroundChunk(ctx, { ...base('open-lake'), rand: plainRand.rand }));
    expect(windyRand.count()).toBeGreaterThan(STREAK_ROWS.length * 2);
    expect(plainRand.count()).not.toBe(windyRand.count());
  });

  it('paints no clouds in a row without sky', () => {
    expect(hasStyle(chunkOf(base('open-lake-windy', { row: 'middle' })), SNOW_CLOUD_SHINE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Water by band
// ---------------------------------------------------------------------------

describe('lake water by row', () => {
  it('runs the top row through the stops of band 1 from the surface', () => {
    const grads = waterGradients(chunkOf(base('open-lake')));
    expect(grads).toHaveLength(1);
    expect(grads[0].stops).toEqual(lakeWaterStops(1).map(([t, c]) => [t, c]));
  });

  it('runs the top row through band 2 stops when told so', () => {
    const grads = waterGradients(chunkOf(base('open-lake', { band: 2 })));
    expect(grads[0].stops).toEqual(lakeWaterStops(2).map(([t, c]) => [t, c]));
  });

  it('starts a lower row on the deep colour of the band above and ends on its own deep colour', () => {
    for (const band of [2, 3, 4] as const) {
      const row = band === 4 ? 'bottom' : 'middle';
      const grads = waterGradients(chunkOf(base('open-lake', { row, band })));
      expect(grads).toHaveLength(1);
      const stops = grads[0].stops;
      expect(stops[0][1]).toBe(lakeWaterBand((band - 1) as LakeBand).deep);
      expect(stops[stops.length - 1][1]).toBe(lakeWaterBand(band).deep);
      expect(stops[1][1]).toBe(lakeWaterBand(band).mid);
    }
  });

  it('meets with no seam: each row ends on the colour the row below starts on', () => {
    const top = waterGradients(chunkOf(base('open-lake', { row: 'top', band: 1 })))[0].stops;
    const rows = [2, 3, 4].map((band) => waterGradients(chunkOf(base('open-lake', { row: 'middle', band: band as LakeBand })))[0].stops);
    const all = [top, ...rows];
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i][all[i].length - 1][1], `row ${i}`).toBe(all[i + 1][0][1]);
    }
  });

  it('uses only band colours, so a lower row never paints the flat deep colour of another look', () => {
    const colours = new Set(LAKE_WATER_BANDS.flatMap((b) => [b.shallow, b.mid, b.deep]));
    for (const band of [2, 3] as const) {
      const stops = waterGradients(chunkOf(base('open-lake', { row: 'middle', band })))[0].stops;
      for (const [, colour] of stops) expect(colours.has(colour)).toBe(true);
    }
  });

  it('is the same for a single-row chunk as for a top row', () => {
    expect(waterGradients(chunkOf(base('open-lake', { row: 'single' })))[0].stops).toEqual(
      waterGradients(chunkOf(base('open-lake', { row: 'top' })))[0].stops,
    );
  });
});

// ---------------------------------------------------------------------------
// Pit shafts (issue #213, Area 14)
// ---------------------------------------------------------------------------

describe('pit shafts in the chunks', () => {
  const isShaft = (p: Painted): boolean => p.gradient?.stops.some(([, c]) => c.startsWith('rgba(255,222,160,0.')) === true && p.cmds[0][0] === 'moveTo' && p.gradient.stops.length === 3;
  const shaftsIn = (painted: readonly Painted[]): Painted[] => painted.filter(isShaft);
  const lakeRows: readonly (readonly [ChunkOptions['row'], LakeBand])[] = [
    ['top', 1],
    ['middle', 2],
    ['bottom', 2],
  ];

  it.each(lakeRows)('paints shafts in a %s row of band %i for the late look', (row, band) => {
    expect(shaftsIn(chunkOf(base('open-lake-late', { row, band }))).length).toBeGreaterThan(0);
  });

  it.each([3, 4] as const)('paints no shaft in a row of band %i, so band 3 and 4 stay dark', (band) => {
    for (const row of ['middle', 'bottom'] as const) {
      expect(shaftsIn(chunkOf(base('open-lake-late', { row, band }))), `${row} ${band}`).toEqual([]);
    }
  });

  it('fades every shaft to nothing by y 720: a band 2 row ends its gradient on a clear stop at the chunk bottom', () => {
    for (const p of shaftsIn(chunkOf(base('open-lake-late', { row: 'middle', band: 2 })))) {
      expect(p.gradient!.extent[3]).toBe(VIEW_H);
      expect(p.gradient!.stops[2][1]).toBe('rgba(255,222,160,0.000)');
    }
  });

  it.each<AreaLookId>(['canal', 'pond', 'pond-dusk', 'chinampa', 'spring-cave', 'deep-canal', 'deep-canal-golden', 'open-lake', 'open-lake-windy', 'open-lake-still'])(
    'paints no shaft for %s',
    (look) => {
      for (const [row, band] of lakeRows) expect(shaftsIn(chunkOf(base(look, { row, band }))), `${row} ${band}`).toEqual([]);
    },
  );

  it('paints the shafts over the water and the rays, and before the lakebed, so a wall hides them', () => {
    const painted = chunkOf(base('open-lake-late', { row: 'bottom', band: 2, solids: [{ x: 100, y: 200, w: 160, h: 120 }] }));
    const firstShaft = painted.findIndex(isShaft);
    const lastShaft = painted.length - 1 - [...painted].reverse().findIndex(isShaft);
    const water = painted.findIndex((p) => p.gradient !== null && p.cmds[0][0] === 'fillRect' && p.cmds[0][3] === VIEW_W && p.cmds[0][4] > 100);
    const lip = painted.findIndex((p) => p.style === LAKE_LIP);
    expect(water).toBeGreaterThanOrEqual(0);
    expect(firstShaft).toBeGreaterThan(water);
    expect(lip).toBeGreaterThan(lastShaft);
  });

  it('draws no randomness, so the late look draws what the open lake draws', () => {
    for (const [row, band] of lakeRows) {
      const late = counting(5);
      const lake = counting(5);
      record((ctx) => paintBackgroundChunk(ctx, { ...base('open-lake-late', { row, band }), rand: late.rand }));
      record((ctx) => paintBackgroundChunk(ctx, { ...base('open-lake', { row, band }), rand: lake.rand }));
      expect(late.count(), `${row} ${band}`).toBe(lake.count());
    }
  });

  it('is the open lake chunk plus the shafts: the same marks, in the same order, apart from the shafts', () => {
    const late = chunkOf(base('open-lake-late', { row: 'middle', band: 2 }));
    const lake = chunkOf(base('open-lake', { row: 'middle', band: 2 }));
    expect(signature(late.filter((p) => !isShaft(p)))).toBe(signature(lake));
    expect(late.length).toBeGreaterThan(lake.length);
  });
});

// ---------------------------------------------------------------------------
// Lakebed
// ---------------------------------------------------------------------------

describe('lakebed in the chunks', () => {
  const rect: LakeRect = { x: 100, y: 200, w: 160, h: 120 };
  const withRects = (rects: readonly LakeRect[], extra: Partial<Base> = {}, seed = 5): Painted[] =>
    chunkOf(base('open-lake', { row: 'bottom', index: 1, solids: rects, band: 3, ...extra }), seed);

  /** Every point of every mark lies inside `r` (strokes may reach half their width past it). */
  const expectInside = (marks: readonly Painted[], r: LakeRect): void => {
    for (const p of marks) {
      const pts = p.cmds.flatMap((c) => {
        const a = c.slice(1) as number[];
        if (c[0] === 'moveTo' || c[0] === 'lineTo') return [{ x: a[0], y: a[1] }];
        if (c[0] === 'quadraticCurveTo') return [{ x: a[0], y: a[1] }, { x: a[2], y: a[3] }];
        if (c[0] === 'ellipse') return [{ x: a[0] - a[2], y: a[1] - a[3] }, { x: a[0] + a[2], y: a[1] + a[3] }];
        if (c[0] === 'fillRect') return [{ x: a[0], y: a[1] }, { x: a[0] + a[2], y: a[1] + a[3] }];
        return [];
      });
      const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
      for (const q of pts) {
        expect(q.x).toBeGreaterThanOrEqual(r.x - half - 1e-6);
        expect(q.x).toBeLessThanOrEqual(r.x + r.w + half + 1e-6);
        expect(q.y).toBeGreaterThanOrEqual(r.y - half - 1e-6);
        expect(q.y).toBeLessThanOrEqual(r.y + r.h + half + 1e-6);
      }
    }
  };

  it('paints nothing of the bed where a middle chunk has no solid parts', () => {
    const none = withRects([], { row: 'middle' });
    expect(hasStyle(none, LAKE_LIP)).toBe(false);
    expect(none).toHaveLength(1);
    const omitted = chunkOf(base('open-lake', { row: 'middle', index: 1, band: 3 }));
    expect(signature(omitted)).toBe(signature(none));
  });

  it('paints the bowl floor under the bed top of a row with the bed, with no solid parts, and no canal bed', () => {
    expect(LAKE_FLOOR).toEqual({ x: 0, y: BED_TOP, w: VIEW_W, h: VIEW_H - BED_TOP });
    for (const row of ['bottom', 'single'] as const) {
      const floor = withRects([], { row });
      expect(hasStyle(floor, LAKE_LIP), row).toBe(true);
      const omitted = chunkOf(base('open-lake', { row, index: 1, band: 3 }));
      expect(signature(omitted), row).toBe(signature(floor));
    }
    // A bottom chunk is the band water (one fill), then only the floor's lakebed, inside the floor.
    const bottom = withRects([]);
    expect(bottom.length).toBeGreaterThan(1);
    expectInside(bottom.slice(1), LAKE_FLOOR);
  });

  it('paints the lakebed on top of the water, and only inside the solid rects', () => {
    const none = withRects([]);
    const some = withRects([rect]);
    expect(some.length).toBeGreaterThan(none.length);
    expect(signature(some.slice(0, none.length))).toBe(signature(none));
    expectInside(some.slice(none.length), rect);
  });

  it('paints a lip on the top edge of a rect in a middle row too', () => {
    const middle = chunkOf(base('open-lake', { row: 'middle', index: 1, band: 2, solids: [rect] }));
    expect(hasStyle(middle, LAKE_LIP)).toBe(true);
  });

  it('paints the lakebed in the top row, after the water', () => {
    const top = chunkOf(base('open-lake', { row: 'top', index: 1, solids: [rect] }));
    const noRock = chunkOf(base('open-lake', { row: 'top', index: 1 }));
    expect(top.length).toBeGreaterThan(noRock.length);
    expect(signature(top.slice(0, noRock.length))).toBe(signature(noRock));
  });

  it('paints nothing else in the same way: the same rects and seed give the same pixels, another seed another', () => {
    expect(signature(withRects([rect], {}, 3))).toBe(signature(withRects([rect], {}, 3)));
    expect(signature(withRects([rect], {}, 3))).not.toBe(signature(withRects([rect], {}, 4)));
  });

  it('ignores the rects in every other look', () => {
    for (const look of ['canal', 'pond', 'chinampa', 'spring-cave', 'deep-canal'] as const) {
      for (const row of ['single', 'top', 'middle', 'bottom'] as const) {
        const plain = base(look, { row, index: 2 });
        const withOpts = { ...plain, solids: [rect], band: 3 as LakeBand };
        expect(signature(chunkOf(withOpts, 9)), `${look} ${row}`).toBe(signature(chunkOf(plain, 9)));
      }
    }
  });

  it('draws the same random numbers for an existing look with and without the new options', () => {
    const a = counting(2);
    const b = counting(2);
    const plain = base('pond', { row: 'single', index: 1, edgeLeft: true });
    record((ctx) => paintBackgroundChunk(ctx, { ...plain, rand: a.rand }));
    record((ctx) => paintBackgroundChunk(ctx, { ...plain, solids: [rect], band: 2, rand: b.rand }));
    expect(b.count()).toBe(a.count());
  });
});

// ---------------------------------------------------------------------------
// The bake
// ---------------------------------------------------------------------------

interface MadeCanvas {
  readonly painted: Painted[];
}

function bakeIn(opts: Partial<AreaSceneryOptions>): { made: Map<string, MadeCanvas>; scenery: ReturnType<typeof bakeAreaScenery> } {
  vi.stubGlobal('Path2D', LogPath);
  const made = new Map<string, MadeCanvas>();
  const scene = {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string) => {
        const rec = recordCtx();
        made.set(key, { painted: rec.painted });
        return { context: rec.ctx, refresh: () => undefined };
      },
    },
  } as never;
  const scenery = bakeAreaScenery(scene, {
    keyPrefix: 'lake:',
    bakeScale: 2,
    bgScale: 1,
    screensWide: 5,
    screensTall: 4,
    bankChunks: [],
    sunChunk: 0,
    rand: seeded(11),
    reeds: [],
    pads: [],
    look: 'open-lake',
    ...opts,
  }) ;
  return { made, scenery };
}

describe('bakeAreaScenery for the lake', () => {
  // A wall across the chunk edge between columns 1 and 2 of row 1, and one down through rows 2 and 3 of column 0.
  const WALLS = [
    { x0: 900, x1: 1020, y0: 600, y1: 700 },
    { x0: 40, x1: 100, y0: 800, y1: 1400 },
  ];

  it('bakes the same grid of chunks, adding no texture kinds', () => {
    const plain = bakeIn({ rockWalls: [] });
    const walled = bakeIn({ rockWalls: WALLS });
    expect(plain.scenery.bg).toHaveLength(4);
    for (const row of walled.scenery.bg) expect(row).toHaveLength(5);
    expect(walled.made.size).toBeLessThanOrEqual(5 * 4);
  });

  it('paints the lakebed only in the chunks the walls reach', () => {
    const { made, scenery } = bakeIn({ rockWalls: WALLS });
    const lipIn = (r: number, c: number): boolean => hasStyle(made.get(scenery.bg[r][c].key)!.painted, LAKE_LIP);
    expect(lipIn(1, 1)).toBe(true);
    expect(lipIn(1, 2)).toBe(true);
    expect(lipIn(2, 0)).toBe(true);
    expect(lipIn(3, 0)).toBe(true);
    expect(lipIn(1, 0)).toBe(false);
    expect(lipIn(1, 3)).toBe(false);
    expect(lipIn(0, 0)).toBe(false);
    expect(lipIn(2, 4)).toBe(false);
  });

  it('paints the bowl floor in every bottom-row chunk, walls or none', () => {
    const { made, scenery } = bakeIn({ rockWalls: WALLS });
    for (let c = 0; c < 5; c++) expect(hasStyle(made.get(scenery.bg[3][c].key)!.painted, LAKE_LIP), `column ${c}`).toBe(true);
  });

  it('shares one texture per banded middle row for chunks with no rock, and bakes rock chunks on their own', () => {
    const { scenery, made } = bakeIn({ rockWalls: WALLS });
    expect(scenery.bg[1][0].key).toBe(areaDeepRowBgKey('lake:', 1));
    expect(scenery.bg[1][3].key).toBe(areaDeepRowBgKey('lake:', 1));
    expect(scenery.bg[1][0]).toBe(scenery.bg[1][4]);
    expect(scenery.bg[1][1].key).toBe(areaBgKey('lake:', 1, 1));
    expect(scenery.bg[1][2].key).toBe(areaBgKey('lake:', 1, 2));
    expect(made.has(areaDeepRowBgKey('lake:', 2))).toBe(true);
    expect(scenery.bg[1][0]).not.toBe(scenery.bg[2][1]);
  });

  it('gives each row its band, with no seam where the rows meet', () => {
    const { made } = bakeIn({ rockWalls: [] });
    const stopsOf = (key: string): [number, string][] => waterGradients(made.get(key)!.painted)[0].stops;
    const rows = [
      stopsOf(areaBgKey('lake:', 0, 0)),
      stopsOf(areaDeepRowBgKey('lake:', 1)),
      stopsOf(areaDeepRowBgKey('lake:', 2)),
      stopsOf(areaBgKey('lake:', 3, 0)),
    ];
    expect(rows[0]).toEqual(lakeWaterStops(1).map(([t, c]) => [t, c]));
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i][rows[i].length - 1][1], `row ${i}`).toBe(rows[i + 1][0][1]);
    }
    expect(rows[3][rows[3].length - 1][1]).toBe(lakeWaterBand(4).deep);
  });

  it('puts the volcanoes in the top row only', () => {
    const { made } = bakeIn({ rockWalls: [] });
    expect(hasStyle(made.get(areaBgKey('lake:', 0, VOLCANO_CHUNK))!.painted, LAKE_SNOW)).toBe(true);
    expect(hasStyle(made.get(areaBgKey('lake:', 0, 0))!.painted, LAKE_SNOW)).toBe(false);
    for (const r of [1, 2, 3]) {
      for (const [key, m] of made) {
        if (key.startsWith(`lake:bg-${r}-`)) expect(hasStyle(m.painted, LAKE_SNOW), key).toBe(false);
      }
    }
  });

  it('is deterministic for the same walls and seed', () => {
    const a = bakeIn({ rockWalls: WALLS, rand: seeded(3) });
    const b = bakeIn({ rockWalls: WALLS, rand: seeded(3) });
    for (const [key, m] of a.made) expect(signature(m.painted), key).toBe(signature(b.made.get(key)!.painted));
  });

  it('bakes an existing look exactly as before: rockWalls change nothing', () => {
    for (const look of ['canal', 'pond', 'spring-cave', 'deep-canal'] as const) {
      const without = bakeIn({ look, screensTall: 3 });
      const withWalls = bakeIn({ look, screensTall: 3, rockWalls: WALLS });
      expect([...withWalls.made.keys()], look).toEqual([...without.made.keys()]);
      for (const [key, m] of without.made) {
        expect(signature(withWalls.made.get(key)!.painted), `${look} ${key}`).toBe(signature(m.painted));
      }
    }
  });
});
