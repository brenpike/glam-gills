/**
 * The golden-hour decorations (drawGoldenCanal.ts) placed against the Area 11 layout (issue #112):
 * every banner, marigold patch, hyacinth raft, bank wall with its root curtains and sunken arch is
 * painted into the area's real background chunks (its bank chunks and its edges), each draw is
 * measured as a world box, and each box is checked against the layout's cormorants, surface boats,
 * lures and gameplay places. The sinking petals' columns under the patches (PetalView) are checked
 * the same way. The painters run against a measuring context and a stub Path2D. No Phaser is loaded.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEEP_CANAL_4_AREA } from '../logic/areas';
import { DEEP_CANAL_4_CORMORANT, DEEP_CANAL_4_LAYOUT } from '../logic/deepCanal4Layout';
import { exitGateBase } from '../logic/exitGate';
import { lureLinePath, lurePath } from '../logic/lures';
import { movingHazardSweep, type MovingHazardSpawn } from '../logic/movingHazards';
import { murkyPatches } from '../logic/murkyWater';
import { areaSize, swimBounds } from '../logic/zone';
import { CORMORANT_TEX } from './drawCormorant';
import { GATE_ARCH_W, GATE_H } from './drawArea';
import { MOORED_HULL_TEX } from './drawDeepCanal';
import { FISHING_BOAT_TEX } from './drawFishingTrajinera';
import {
  BANK_WALLS,
  GOLDEN_DECOR_FILLS,
  HYACINTH_RAFTS,
  MARIGOLD_PATCHES,
  PAPEL_PICADO_BANNERS,
  SINKING_PETAL_TEX,
  SUNKEN_ARCHES,
  paintGoldenDecor,
  type GoldenChunk,
} from './drawGoldenCanal';
import { bedEdgeY } from './drawScenery';
import { MOVING_HAZARD_LOOKS } from './movingHazardTextures';
import { SURF, VIEW_H, VIEW_W } from './palette';
import { SURFACE_BOAT_GAP, surfaceBoatSpans } from './surfaceBoats';

vi.mock('phaser', () => ({}));

const LAYOUT = DEEP_CANAL_4_LAYOUT;
const SIZE = areaSize(LAYOUT.screensWide, LAYOUT.screensTall);
const BOUNDS = swimBounds(SIZE);

/** Least clear water in px between a decoration and a gameplay place (hiding spot, cave, current, exit, Home Spot, murky patch, sweep). */
const PLACE_CLEARANCE = 80;
/** Least sky in px between a banner's flags and the top of a floating cormorant's frame. */
const BANNER_CLEARANCE = 8;
/** Least water in px past a cormorant's frame, at either end of its stretch, kept free of decorations. */
const CORMORANT_CLEARANCE = 16;
/** Least water in px between a sunken arch and the sunken hull cave: one screen. */
const ARCH_CAVE_CLEARANCE = VIEW_W;
/** Widest bare stretch in px allowed between neighbouring decorations along a row. */
const MAX_BARE_STRETCH = VIEW_W * 1.5;
/** Farthest apart in px two neighbouring marigold patches may be, so the petals reach every stretch of the way east. */
const MAX_PATCH_GAP = VIEW_W * 2.5;

/** PetalView's sinking petal: it starts START_DROP px under the surface, fades out FADE_OUT px lower and sways SWAY px either way. */
const PETAL_START_DROP = 12;
const PETAL_FADE_OUT = 120;
const PETAL_SWAY = 3;

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A stub Path2D that keeps the box round every point, ellipse and arc added to it. */
class BoxPath {
  readonly xs: number[] = [];
  readonly ys: number[] = [];

  private add(x: number, y: number): void {
    this.xs.push(x);
    this.ys.push(y);
  }

  moveTo(x: number, y: number): void {
    this.add(x, y);
  }

  lineTo(x: number, y: number): void {
    this.add(x, y);
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.add(cx, cy);
    this.add(x, y);
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.add(c1x, c1y);
    this.add(c2x, c2y);
    this.add(x, y);
  }

  arc(cx: number, cy: number, r: number): void {
    this.add(cx - r, cy - r);
    this.add(cx + r, cy + r);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number): void {
    const halfW = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
    const halfH = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
    this.add(cx - halfW, cy - halfH);
    this.add(cx + halfW, cy + halfH);
  }

  closePath(): void {}

  /** The box round the path, grown by `pad` on every side. */
  boxOf(pad: number): Box {
    return { x0: Math.min(...this.xs) - pad, x1: Math.max(...this.xs) + pad, y0: Math.min(...this.ys) - pad, y1: Math.max(...this.ys) + pad };
  }
}

/** One measured draw: its world box, its fill colour (null for a stroke) and whether it is a papel picado flag. */
interface Draw {
  readonly box: Box;
  readonly fill: string | null;
  readonly flag: boolean;
}

/** Paint one chunk's decorations and measure every draw, as world boxes (the chunk sits at `rowY` in the world). */
function measureChunk(chunk: GoldenChunk, rowY: number): Draw[] {
  const draws: Draw[] = [];
  const flags = new Set<BoxPath>();
  const toWorld = (b: Box): Box => ({ x0: b.x0 + chunk.index * VIEW_W, x1: b.x1 + chunk.index * VIEW_W, y0: b.y0 + rowY, y1: b.y1 + rowY });
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fill(path: BoxPath, rule?: string): void {
      if (rule === 'evenodd') flags.add(path);
      draws.push({ box: toWorld(path.boxOf(0)), fill: String(this.fillStyle), flag: flags.has(path) });
    },
    stroke(path: BoxPath): void {
      draws.push({ box: toWorld(path.boxOf(this.lineWidth / 2)), fill: null, flag: flags.has(path) });
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      draws.push({ box: toWorld({ x0: x, x1: x + w, y0: y, y1: y + h }), fill: String(this.fillStyle), flag: false });
    },
  };
  vi.stubGlobal('Path2D', BoxPath);
  try {
    paintGoldenDecor(ctx as unknown as CanvasRenderingContext2D, chunk);
  } finally {
    vi.unstubAllGlobals();
  }
  return draws;
}

const BANK_SET = new Set(LAYOUT.bankChunks);

/** Area 11's chunk at column `index` in the top or bottom row, its bank as textures.ts bakes it, its edges as asked. */
function areaChunk(row: 'top' | 'bottom', index: number, edges: boolean): GoldenChunk {
  const hasBank = row === 'top' && BANK_SET.has(index);
  return {
    index,
    hasSky: row === 'top',
    hasBed: row === 'bottom',
    bank: hasBank ? { capLeft: !BANK_SET.has(index - 1), capRight: !BANK_SET.has(index + 1) } : null,
    edgeLeft: edges && index === 0,
    edgeRight: edges && index === LAYOUT.screensWide - 1,
    bedEdge: (x) => bedEdgeY(index * VIEW_W + x),
  };
}

/** Every decoration draw of one row of Area 11, its edge walls left out. */
function measureRow(row: 'top' | 'bottom'): Draw[] {
  const rowY = row === 'top' ? 0 : VIEW_H;
  return Array.from({ length: LAYOUT.screensWide }, (_, index) => measureChunk(areaChunk(row, index, false), rowY)).flat();
}

/** The edge wall draws alone of one row: the edge chunk painted with its edge, less the same chunk painted without. */
function measureEdgeWalls(row: 'top' | 'bottom'): Draw[] {
  const rowY = row === 'top' ? 0 : VIEW_H;
  return [0, LAYOUT.screensWide - 1].flatMap((index) => {
    const plainCount = measureChunk(areaChunk(row, index, false), rowY).length;
    return measureChunk(areaChunk(row, index, true), rowY).slice(plainCount);
  });
}

const TOP = measureRow('top');
const BOTTOM = measureRow('bottom');
const EDGE_WALLS = [...measureEdgeWalls('top'), ...measureEdgeWalls('bottom')];

/** Where each sinking petal can be: the column under each marigold patch, its frame and sway included. */
const PETAL_COLUMNS: readonly Box[] = MARIGOLD_PATCHES.map((patch) => {
  const reachX = Math.max(SINKING_PETAL_TEX.originX, SINKING_PETAL_TEX.w - SINKING_PETAL_TEX.originX) + PETAL_SWAY;
  const top = SURF + PETAL_START_DROP;
  return {
    x0: patch.x - reachX,
    x1: patch.x + reachX,
    y0: top - SINKING_PETAL_TEX.originY,
    y1: top + PETAL_FADE_OUT + SINKING_PETAL_TEX.h - SINKING_PETAL_TEX.originY,
  };
});

/** Every in-water decoration box (edge walls left out) and every petal column, each named for messages. */
const IN_WATER: readonly (readonly [string, Box])[] = [
  ...[...TOP, ...BOTTOM].map((draw) => [`decoration ${describeBox(draw.box)}`, draw.box] as const),
  ...PETAL_COLUMNS.map((box) => [`petal column ${describeBox(box)}`, box] as const),
];

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function describeBox(b: Box): string {
  return `x ${b.x0.toFixed(1)}..${b.x1.toFixed(1)} y ${b.y0.toFixed(1)}..${b.y1.toFixed(1)}`;
}

/** The clear distance between two boxes: 0 when they touch or overlap. */
function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

/** The clear distance between a box and a circle's edge (a point when `r` is 0). */
function circleGap(b: Box, cx: number, cy: number, r: number): number {
  const dx = Math.max(0, b.x0 - cx, cx - b.x1);
  const dy = Math.max(0, b.y0 - cy, cy - b.y1);
  return Math.hypot(dx, dy) - r;
}

/** A gameplay place to keep clear of: its name and its distance from a box. */
interface KeepOut {
  readonly name: string;
  readonly gap: (b: Box) => number;
}

const boxKeepOut = (name: string, place: Box): KeepOut => ({ name, gap: (b) => boxGap(b, place) });
const circleKeepOut = (name: string, cx: number, cy: number, r: number): KeepOut => ({ name, gap: (b) => circleGap(b, cx, cy, r) });

/** How far a moving hazard's art reaches either side of its x: its widest part frame. */
function movingHazardArtReach(spawn: Readonly<MovingHazardSpawn>): number {
  const look = MOVING_HAZARD_LOOKS[spawn.type.look];
  return Math.max(...Object.values(look.parts).map(({ tex }) => Math.max(tex.originX, tex.w - tex.originX)));
}

/** The cormorants' stretches, as [x0, x1, y] world px. */
const CORMORANT_STRETCHES = LAYOUT.predatorRoutes
  .filter((route) => route.species === DEEP_CANAL_4_CORMORANT)
  .map((route) => [Math.min(...route.waypoints.map((p) => p.x)), Math.max(...route.waypoints.map((p) => p.x)), route.waypoints[0].y] as const);

/** A floating cormorant's frame reaches this far either side of its x: it faces either way. */
const CORMORANT_HALF_W = Math.max(CORMORANT_TEX.originX, CORMORANT_TEX.w - CORMORANT_TEX.originX);

/**
 * Each cormorant's water: its stretch widened by its frame's half width and CORMORANT_CLEARANCE,
 * from the sky's top down to the bottom of its frame at the bottom of its dive.
 */
const CORMORANT_WATER: readonly Box[] = CORMORANT_STRETCHES.map(([x0, x1, y]) => ({
  x0: x0 - CORMORANT_HALF_W - CORMORANT_CLEARANCE,
  x1: x1 + CORMORANT_HALF_W + CORMORANT_CLEARANCE,
  y0: 0,
  y1: y + DEEP_CANAL_4_CORMORANT.tuning.lungeRange + CORMORANT_TEX.h - CORMORANT_TEX.originY + CORMORANT_CLEARANCE,
}));

/**
 * The surface boats' art: each boat's span (surfaceBoatSpans) from the sky's top, which a fishing
 * rod and an anchor canoe's bow rise into, down to the bottom of a hull frame; each lure's line and
 * path; and each moored row from the top of its hull frame down to the bottom of its shade.
 */
const SURFACE_BOATS: readonly KeepOut[] = [
  ...surfaceBoatSpans(LAYOUT).map((span) =>
    boxKeepOut(span.id, { x0: span.x0, x1: span.x1, y0: 0, y1: SURF + FISHING_BOAT_TEX.h - FISHING_BOAT_TEX.originY }),
  ),
  ...(LAYOUT.fishingBoats ?? []).flatMap((boat) =>
    boat.lures.flatMap((_, index) => [
      boxKeepOut(`${boat.id} line ${index}`, lureLinePath(boat, index)),
      boxKeepOut(`${boat.id} lure ${index}`, lurePath(boat, index)),
    ]),
  ),
  ...(LAYOUT.bankOverhangs ?? []).map((rect) =>
    boxKeepOut(`moored row ${rect.x0}..${rect.x1}`, { x0: rect.x0, x1: rect.x1, y0: SURF - MOORED_HULL_TEX.originY, y1: rect.y1 }),
  ),
];

const EXIT = DEEP_CANAL_4_AREA.exit;
const GATE_BASE = exitGateBase(EXIT, { bedTop: SIZE.bedTop });

/** Every gameplay place a decoration stays PLACE_CLEARANCE from. */
const PLACES: readonly KeepOut[] = [
  ...[...LAYOUT.caveSpots, ...LAYOUT.currentSpots, ...(LAYOUT.bankSpots ?? [])].map(([x, y, rarity]) =>
    circleKeepOut(`${rarity} hiding spot at ${x}, ${y}`, x, y, 0),
  ),
  ...(LAYOUT.cave === undefined ? [] : [boxKeepOut('the cave', LAYOUT.cave)]),
  ...(LAYOUT.currents ?? []).map((current) => boxKeepOut(current.id, current)),
  circleKeepOut('the exit', EXIT.x, EXIT.y, EXIT.radius),
  boxKeepOut('the exit gate', { x0: GATE_BASE.x - GATE_ARCH_W / 2, x1: GATE_BASE.x + GATE_ARCH_W / 2, y0: GATE_BASE.y - GATE_H, y1: GATE_BASE.y }),
  circleKeepOut('the Home Spot ring', LAYOUT.start.x, LAYOUT.start.y, LAYOUT.homeSpotRadius),
  ...murkyPatches(LAYOUT.hazards).map((patch) => boxKeepOut(patch.id, patch.shape)),
  ...(LAYOUT.movingHazards ?? []).map((spawn) => {
    const sweep = movingHazardSweep(spawn);
    const reach = movingHazardArtReach(spawn);
    return boxKeepOut(`${spawn.id} sweep`, { x0: spawn.x - reach, x1: spawn.x + reach, y0: sweep.y0, y1: sweep.y1 });
  }),
];

/** Every (thing, keep-out) pair closer than `least`, named with the distance. */
function findCrowded(things: readonly (readonly [string, Box])[], keepOuts: readonly KeepOut[], least: number): string[] {
  const crowded: string[] = [];
  for (const [name, box] of things) {
    for (const keepOut of keepOuts) {
      const gap = keepOut.gap(box);
      if (gap < least) crowded.push(`${name} is ${gap.toFixed(1)} px from ${keepOut.name}`);
    }
  }
  return crowded;
}

/** The widest stretch along x, from `from` to `to`, that no box covers. */
function widestBareStretch(boxes: readonly Box[], from: number, to: number): number {
  const sorted = [...boxes].sort((a, b) => a.x0 - b.x0);
  let reached = from;
  let widest = 0;
  for (const box of sorted) {
    widest = Math.max(widest, box.x0 - reached);
    reached = Math.max(reached, box.x1);
  }
  return Math.max(widest, to - reached);
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

describe('golden-hour decorations on the Area 11 layout (issue #112)', () => {
  it('measures the decorations of the real chunks: banners, patches, rafts, bank walls, arches and edge walls', () => {
    expect(TOP.filter((draw) => draw.flag).length).toBeGreaterThan(20);
    expect(TOP.length).toBeGreaterThan(PAPEL_PICADO_BANNERS.length + MARIGOLD_PATCHES.length + HYACINTH_RAFTS.length + BANK_WALLS.length);
    expect(BOTTOM.length).toBeGreaterThan(SUNKEN_ARCHES.length);
    expect(EDGE_WALLS.length).toBeGreaterThan(0);
    expect(CORMORANT_STRETCHES).toHaveLength(3);
  });

  it('hangs every banner\'s flags above the top of a floating cormorant\'s frame, with a margin', () => {
    const flagBottom = Math.max(...TOP.filter((draw) => draw.flag).map((draw) => draw.box.y1));
    for (const [, , y] of CORMORANT_STRETCHES) {
      expect(flagBottom).toBeLessThanOrEqual(y - CORMORANT_TEX.originY - BANNER_CLEARANCE);
    }
  });

  it('keeps every banner, patch, raft, bank wall, root curtain and sinking petal out of each cormorant\'s stretch, float and dive', () => {
    expect(findCrowded(IN_WATER, CORMORANT_WATER.map((water) => boxKeepOut(`cormorant water ${describeBox(water)}`, water)), Number.MIN_VALUE)).toEqual([]);
  });

  it('keeps every decoration and sinking petal SURFACE_BOAT_GAP off the moored rows, the fishing trajineras, their lures and lines', () => {
    expect(SURFACE_BOATS.length).toBeGreaterThan(0);
    expect(findCrowded(IN_WATER, SURFACE_BOATS, SURFACE_BOAT_GAP)).toEqual([]);
  });

  it('keeps every decoration and sinking petal 80 px from every hiding spot, the cave, the current, the exit and its gate, the Home Spot ring, the murky patches and the moving hazards\' sweeps', () => {
    expect(PLACES.length).toBeGreaterThan(10);
    expect(findCrowded(IN_WATER, PLACES, PLACE_CLEARANCE)).toEqual([]);
  });

  it('stands every sunken arch a screen or more from the cave, with no fill over its opening', () => {
    const cave = LAYOUT.cave!;
    for (const draw of BOTTOM) expect(boxGap(draw.box, cave), describeBox(draw.box)).toBeGreaterThanOrEqual(ARCH_CAVE_CLEARANCE);
    for (const draw of BOTTOM.filter((d) => d.fill !== null)) expect(GOLDEN_DECOR_FILLS, describeBox(draw.box)).toContain(draw.fill);
    for (const arch of SUNKEN_ARCHES) {
      const opening = { x: arch.x, y: VIEW_H + bedEdgeY(arch.x) - 30 };
      const covering = BOTTOM.filter((d) => d.fill !== null && circleGap(d.box, opening.x, opening.y, 0) === 0);
      expect(covering.map((d) => describeBox(d.box)), String(arch.x)).toEqual([]);
    }
  });

  it('stands the edge walls outside the swim bounds, at the area\'s two ends', () => {
    for (const draw of EDGE_WALLS) {
      const { x0, x1 } = draw.box;
      const outside = x1 < BOUNDS.minX || x0 > BOUNDS.maxX;
      expect(outside, describeBox(draw.box)).toBe(true);
    }
  });

  it('keeps the top row and the bed decorated across the area: no bare stretch wider than a screen and a half', () => {
    expect(widestBareStretch(TOP.map((d) => d.box), 0, SIZE.width)).toBeLessThanOrEqual(MAX_BARE_STRETCH);
    const arches = BOTTOM.map((d) => d.box);
    const first = Math.min(...arches.map((b) => b.x0));
    const last = Math.max(...arches.map((b) => b.x1));
    expect(widestBareStretch(arches, first, last)).toBeLessThanOrEqual(MAX_BARE_STRETCH);
  });

  it('spreads the marigold patches, and so the sinking petals, along the way east: one in the first screen, none far from the next', () => {
    const xs = MARIGOLD_PATCHES.map((patch) => patch.x);
    expect(xs[0]).toBeLessThan(VIEW_W);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${xs[i - 1]} to ${xs[i]}`).toBeLessThanOrEqual(MAX_PATCH_GAP);
  });

  it('paints a bank wall only along a bank chunk\'s willow bank', () => {
    for (const wall of BANK_WALLS) {
      const index = Math.floor(wall.x / VIEW_W);
      expect(BANK_SET.has(index), String(wall.x)).toBe(true);
      expect(Math.floor((wall.x - wall.w / 2) / VIEW_W), String(wall.x)).toBe(index);
      expect(Math.floor((wall.x + wall.w / 2) / VIEW_W), String(wall.x)).toBe(index);
    }
  });
});
