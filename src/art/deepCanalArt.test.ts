/**
 * Deep canal art (issue #78, STEP-006; guide 3g, 7 and 10), headless: the gliding trajinera hull and
 * its leading shadow, the moored hulls, the sunken old hull cave, the old canal-bed stones and the
 * reused side-canal inflow marks. The painters run against a recording context and a stub Path2D
 * (the same approach as springCaveArt.test.ts and movingHazardArt.test.ts): every fill and stroke is
 * kept with the style, width and fill rule it was painted under. The Phaser bakes (STEP-010) run
 * against a fake scene whose canvases record. No Phaser is loaded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOAT_SEAM,
  BOAT_SHINE,
  CANAL_BED_BLOCKS,
  CANAL_BED_EDGE_Y,
  CANAL_BED_SLABS,
  CANAL_STONE,
  CANAL_STONE_CRACK,
  CANAL_STONE_DARK,
  CANAL_STONE_LIGHT,
  CANAL_STONE_MOSS,
  CANAL_STONE_SHINE,
  DEEP_CANAL_SHADE_RGB,
  HULL_CAVE_ALGAE,
  HULL_CAVE_BODY,
  HULL_CAVE_FADED_ORANGE,
  HULL_CAVE_FADED_PINK,
  HULL_CAVE_FADED_TEAL,
  HULL_CAVE_H,
  HULL_CAVE_INTERIOR,
  HULL_CAVE_OPENING,
  HULL_CAVE_SEAM,
  HULL_CAVE_TEX,
  HULL_CAVE_W,
  HULL_CAVE_WOOD,
  HULL_CAVE_WOOD_DARK,
  HULL_CAVE_WOOD_LIGHT,
  MOORED_H,
  MOORED_HULLS,
  MOORED_HULL_DEPTH,
  MOORED_SHADE_STOPS,
  MOORED_TEX,
  RAIL_LINE_W,
  MOORED_W,
  SIDE_CANAL_INFLOW_TEX,
  TRAJINERA_HULL_H,
  TRAJINERA_HULL_TEX,
  TRAJINERA_HULL_W,
  TRAJINERA_SHADOW_ALPHA_BOTTOM,
  TRAJINERA_SHADOW_ALPHA_TOP,
  TRAJINERA_SHADOW_H,
  TRAJINERA_SHADOW_HALO,
  TRAJINERA_SHADOW_HALO_PAD,
  TRAJINERA_SHADOW_RGB,
  TRAJINERA_SHADOW_TEX,
  TRAJINERA_SHADOW_W,
  paintCanalBedStones,
  paintHullCaveBack,
  paintHullCaveFront,
  paintMooredHulls,
  paintSideCanalInflow,
  paintTrajineraHull,
  paintTrajineraShadow,
} from './drawDeepCanal';
import { BOAT_FLOWER_CENTRE, BOAT_HULL, BOAT_ORANGE, BOAT_PINK, BOAT_TEAL, BOAT_YELLOW, POLE_WOOD } from './drawPuntingPole';
import { OUTFLOW_TEX, paintSpringOutflow } from './drawSpringCave';
import { CAVE_TEX } from './drawFinds';
import type { TexSize } from './canvasKit';
import { TRAJINERAS } from '../logic/trajineras';
import { INK, LW, WHITE } from './palette';
import { DEEP_CANAL_TEX, bakeDeepCanalTextures } from './deepCanalTextures';
import { ROCK_WALL_KEY_PREFIX, bakeSpringCaveTextures, rockWallSizeKey } from './springCaveTextures';
import { BASS_BODY } from './drawBlackBass';
import {
  DEEP_CANAL_BED_BOTTOM,
  DEEP_CANAL_BED_LIP,
  DEEP_CANAL_BED_TOP,
  DEEP_CANAL_HAZE,
  DEEP_CANAL_LOOK,
  DEEP_CANAL_MUD,
  DEEP_CANAL_SURFACE_LINE,
  DEEP_CANAL_WATER_DEEP,
  DEEP_CANAL_WATER_MID,
  DEEP_CANAL_WATER_SHALLOW,
  AREA_LOOK_IDS,
  HABITAT_LOOK_IDS,
  type AreaLookId,
  habitatLook,
} from './habitatLook';
import { paintBackgroundChunk, bedEdgeY, type ChunkRow } from './drawScenery';
import { VIEW_W, WATER_GRADIENT_END_Y, WATER_STOP_MID } from './palette';
import { SKY_HORIZON, SKY_TOP } from './palette';
import { AREAS, DEEP_CANAL_AREA, habitatById } from '../logic/areas';

vi.mock('phaser', () => ({}));

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

function channelsOf(hex: string): Rgb {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

function toHex(c: Rgb): string {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
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

/** A colour with `rgb` laid over it at `alpha`, as a canvas mixes it in sRGB. */
function over(base: string, rgb: Rgb, alpha: number): string {
  const ca = channelsOf(base);
  return toHex([0, 1, 2].map((i) => ca[i] * (1 - alpha) + rgb[i] * alpha) as unknown as Rgb);
}

/** The pond contrast rule's floor: ink is 3:1 or better on any colour at or above it. */
const LUMINANCE_FLOOR = 0.1687;
const PAIR_FLOOR = 3;
/** The pair rule (guide 10): a fill 9:1 or better with ink holds 3:1 on any background. */
const PAIR_RULE = 9;
/** A colour exactly at the floor, as the darkest deep canal water the look may use: the deep canal shade, #22808f. */
const FLOOR_WATER = toHex(DEEP_CANAL_SHADE_RGB);

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

/** A gradient that remembers its kind, its extent and its stops. */
class GradientStub {
  readonly stops: [number, string][] = [];
  constructor(
    readonly kind: 'linear' | 'radial',
    readonly extent: readonly number[],
  ) {}
  addColorStop(t: number, colour: string): void {
    this.stops.push([t, colour]);
  }
  toString(): string {
    return `${this.kind}(${this.stops.map(([t, c]) => `${t}:${c}`).join(',')})`;
  }
}

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
  readonly rule: string;
  readonly gradient: GradientStub | null;
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const styleOf = (target: Record<string, unknown>, name: string): { style: string; gradient: GradientStub | null } => {
    const value = name === 'fill' || name === 'fillRect' ? target.fillStyle : target.strokeStyle;
    return { style: String(value), gradient: value instanceof GradientStub ? value : null };
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...a: number[]) => new GradientStub('linear', a);
      if (name === 'createRadialGradient') return (...a: number[]) => new GradientStub('radial', a);
      return (...args: unknown[]) => {
        const path = args[0] as LogPath | undefined;
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          out.push({
            op: name,
            cmds: path.cmds,
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
            rule: typeof args[1] === 'string' ? args[1] : 'nonzero',
          });
        } else if (name === 'fillRect') {
          out.push({
            op: 'fill',
            cmds: [['fillRect', ...(args as number[])]],
            ...styleOf(target, name),
            lineWidth: target.lineWidth as number,
            rule: 'nonzero',
          });
        }
      };
    },
    set: (target, key, value) => {
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

const strokes = (painted: readonly Painted[]): Painted[] => painted.filter((p) => p.op === 'stroke');
const fills = (painted: readonly Painted[]): Painted[] => painted.filter((p) => p.op === 'fill');
/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: readonly Painted[]): string =>
  JSON.stringify(painted.map((p) => [p.op, p.cmds, p.style, p.op === 'stroke' ? p.lineWidth : 0, p.rule]));
const styleSet = (painted: readonly Painted[]): Set<string> => new Set(painted.map((p) => p.style));
const isHex = (style: string): boolean => /^#[0-9a-f]{6}$/i.test(style);

/** The (x, y) points a recorded path visits; an ellipse counts as the two corners of its bounding box. */
function pointsOf(cmds: readonly Cmd[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const [name, ...a] of cmds) {
    if (name === 'moveTo' || name === 'lineTo') pts.push({ x: a[0], y: a[1] });
    else if (name === 'quadraticCurveTo') pts.push({ x: a[2], y: a[3] });
    else if (name === 'arc') {
      const [cx, cy, r, from, to] = a;
      const angles = [from, to];
      for (let q = Math.ceil(from / (Math.PI / 2)); q * (Math.PI / 2) <= to; q++) angles.push(q * (Math.PI / 2));
      for (const t of angles) pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    } else if (name === 'ellipse') {
      const [cx, cy, rx, ry, rot] = a;
      const hx = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
      const hy = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
      pts.push({ x: cx - hx, y: cy - hy }, { x: cx + hx, y: cy + hy });
    } else if (name === 'fillRect') pts.push({ x: a[0], y: a[1] }, { x: a[0] + a[2], y: a[1] + a[3] });
  }
  return pts;
}

interface Extent {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** The bounding box of the points of a recorded path. */
function extentOf(cmds: readonly Cmd[]): Extent {
  const pts = pointsOf(cmds);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Every paint of `painted` keeps its path and half its stroke inside `tex`, so no ink is cut by the texture edge. */
function expectInsideFrame(painted: readonly Painted[], tex: TexSize): void {
  for (const p of painted) {
    const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
    for (const pt of pointsOf(p.cmds)) {
      const label = `${p.op} ${p.style} ${JSON.stringify(pt)}`;
      expect(pt.x - half, label).toBeGreaterThanOrEqual(-tex.originX);
      expect(pt.x + half, label).toBeLessThanOrEqual(tex.w - tex.originX);
      expect(pt.y - half, label).toBeGreaterThanOrEqual(-tex.originY);
      expect(pt.y + half, label).toBeLessThanOrEqual(tex.h - tex.originY);
    }
  }
}

/** The 'rgba(r,g,b,a)' alpha of a style. */
function alphaOf(style: string): number {
  const m = /^rgba\(\d+,\d+,\d+,([\d.]+)\)$/.exec(style);
  expect(m, style).not.toBeNull();
  return Number(m![1]);
}

// ---------------------------------------------------------------------------
// The gliding hull
// ---------------------------------------------------------------------------

describe('gliding trajinera hull (guide 7b, 10; issue #78, ND-8)', () => {
  const painted = record(paintTrajineraHull);
  const hullFill = fills(painted).find((p) => p.style === BOAT_HULL)!;
  const hull = extentOf(hullFill.cmds);

  it('is sized from the logic: TRAJINERAS.hullLength wide and TRAJINERAS.hullDepth deep', () => {
    expect(TRAJINERA_HULL_W).toBe(TRAJINERAS.hullLength);
    expect(TRAJINERA_HULL_H).toBe(TRAJINERAS.hullDepth);
    expect(hull.minX).toBe(-TRAJINERAS.hullLength / 2);
    expect(hull.maxX).toBe(TRAJINERAS.hullLength / 2);
    // The body's lowest point is the depth the hull blocks; the water line is y 0.
    expect(hull.maxY).toBe(TRAJINERAS.hullDepth);
  });

  it('puts the only parts above the water line in the raised prow and rail, with the arch over them', () => {
    expect(hull.minY).toBeLessThan(0);
    expect(hull.minY).toBeGreaterThanOrEqual(-30);
    // The prow is at +x and the highest point of the deck.
    const prow = pointsOf(hullFill.cmds).find((p) => p.y === hull.minY)!;
    expect(prow.x).toBeGreaterThan(0);
    const arch = painted.find((p) => p.style === BOAT_TEAL && p.op === 'stroke')!;
    expect(extentOf(arch.cmds).minY).toBeLessThan(hull.minY);
  });

  it('is a 136 x 132 frame anchored at the middle of the hull length on the water line', () => {
    expect(TRAJINERA_HULL_TEX).toEqual({ w: 136, h: 132, originX: 68, originY: 64 });
    // The anchor is the hull rect's top-centre: the frame is symmetric about it.
    expect(TRAJINERA_HULL_TEX.originX).toBe(TRAJINERA_HULL_TEX.w - TRAJINERA_HULL_TEX.originX);
  });

  it('stays inside its frame, ink included', () => {
    expectInsideFrame(painted, TRAJINERA_HULL_TEX);
  });

  it('outlines the whole hull in ink LW all round, outside the silhouette', () => {
    const outline = strokes(painted).find((p) => p.style === INK && p.lineWidth === 2 * LW)!;
    expect(outline).toBeDefined();
    expect(outline.cmds).toEqual(hullFill.cmds);
    // The ink reaches LW past the hull rect on the sides and the bottom (the blob's outline).
    expect(extentOf(outline.cmds).maxY + outline.lineWidth / 2 - LW).toBe(TRAJINERAS.hullDepth);
    expect(painted.indexOf(outline)).toBeLessThan(painted.indexOf(hullFill));
  });

  it('paints three bands, pink, orange and teal, clipped to the hull, under a cream rail', () => {
    const bands = fills(painted).filter((p) => p.cmds[0][0] === 'fillRect' && [BOAT_PINK, BOAT_ORANGE, BOAT_TEAL].includes(p.style));
    expect(bands.map((b) => b.style)).toEqual([BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]);
    const ys = bands.map((b) => ({ top: b.cmds[0][2], bottom: b.cmds[0][2] + b.cmds[0][4] }));
    // Contiguous, top to bottom, the first below the water line (the cream rail is above), the last past the hull bottom (the clip trims it).
    expect(ys[0].top).toBeGreaterThan(0);
    expect(ys[1].top).toBe(ys[0].bottom);
    expect(ys[2].top).toBe(ys[1].bottom);
    expect(ys[2].bottom).toBeGreaterThanOrEqual(TRAJINERAS.hullDepth);
  });

  it('paints a row of white dots on the teal band, inside the hull', () => {
    const whites = fills(painted).filter((p) => p.style === WHITE && p.cmds[0][0] === 'moveTo' && p.cmds[1][0] === 'ellipse');
    // The flower centres are white too and sit above the water line; the dots are below it.
    const dots = whites.filter((p) => extentOf(p.cmds).minY > 0);
    expect(dots.length).toBeGreaterThanOrEqual(8);
    for (const dot of dots) {
      const e = extentOf(dot.cmds);
      expect(e.minX).toBeGreaterThan(hull.minX);
      expect(e.maxX).toBeLessThan(hull.maxX);
      expect(e.minY).toBeGreaterThan(30);
      expect(e.maxY).toBeLessThan(TRAJINERAS.hullDepth - 12);
    }
  });

  it('paints a flower arch of five flowers, a prow ball and no faces, people or text', () => {
    const petals = strokes(painted).filter((p) => p.style === INK && p.lineWidth === 2 * 2.4);
    // Five flowers and the prow ball are blobs with ink 2.4.
    expect(petals).toHaveLength(6);
    const centres = fills(painted).filter((p) => p.style === BOAT_FLOWER_CENTRE && extentOf(p.cmds).maxY < 0);
    expect(centres).toHaveLength(5);
    const fillStyles = styleSet(fills(painted));
    for (const hex of [BOAT_HULL, BOAT_PINK, BOAT_ORANGE, BOAT_TEAL, BOAT_YELLOW]) expect(fillStyles.has(hex), hex).toBe(true);
  });

  it('draws an ink gunwale line under the cream rail, clipped to the hull, so the rail reads light over dark in greyscale', () => {
    const rail = strokes(painted).find((p) => p.style === INK && p.lineWidth === RAIL_LINE_W)!;
    expect(rail).toBeDefined();
    const [a, b] = pointsOf(rail.cmds);
    expect(a.y).toBe(b.y);
    expect(a.y).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(hull.minX);
    expect(b.x).toBeGreaterThan(hull.maxX);
  });

  it('uses the punting pole boat colours, so one boat reads as one boat', () => {
    const fillStyles = styleSet(fills(painted));
    for (const hex of [BOAT_HULL, BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]) expect(fillStyles.has(hex), hex).toBe(true);
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    expect(signature(record(paintTrajineraHull))).toBe(signature(painted));
  });
});

// ---------------------------------------------------------------------------
// The leading shadow
// ---------------------------------------------------------------------------

describe('gliding trajinera shadow (guide 3g, 10; issue #78, ND-9)', () => {
  const painted = record(paintTrajineraShadow);
  const footprint = painted.find((p) => p.op === 'fill' && p.gradient !== null)!;

  it('has the footprint of the hull: TRAJINERAS.hullLength x TRAJINERAS.hullDepth', () => {
    expect(TRAJINERA_SHADOW_W).toBe(TRAJINERAS.hullLength);
    expect(TRAJINERA_SHADOW_H).toBe(TRAJINERAS.hullDepth);
    const e = extentOf(footprint.cmds);
    expect(e.minX).toBe(-TRAJINERAS.hullLength / 2);
    expect(e.maxX).toBe(TRAJINERAS.hullLength / 2);
    expect(e.minY).toBe(0);
    expect(e.maxY).toBe(TRAJINERAS.hullDepth);
  });

  it('is anchored like the hull (middle of its length, on the water line), inside a 140 x 80 frame with room for the halo', () => {
    expect(TRAJINERA_SHADOW_TEX).toEqual({ w: 140, h: 80, originX: 70, originY: 10 });
    expect(TRAJINERA_SHADOW_TEX.originX).toBe(TRAJINERA_SHADOW_TEX.w - TRAJINERA_SHADOW_TEX.originX);
    expectInsideFrame(painted, TRAJINERA_SHADOW_TEX);
    expect(TRAJINERA_SHADOW_HALO_PAD).toBeGreaterThan(0);
  });

  it('is a faint halo, then a see-through footprint that is darkest at the water line, then an ink outline', () => {
    const [halo, body, outline] = painted;
    expect(halo.style).toBe(TRAJINERA_SHADOW_HALO);
    expect(alphaOf(halo.style)).toBeLessThanOrEqual(0.2);
    expect(extentOf(halo.cmds).minX).toBe(extentOf(footprint.cmds).minX - TRAJINERA_SHADOW_HALO_PAD);
    expect(body).toBe(footprint);
    const [top, bottom] = footprint.gradient!.stops;
    const [r, g, b] = TRAJINERA_SHADOW_RGB;
    expect(top).toEqual([0, `rgba(${r},${g},${b},${TRAJINERA_SHADOW_ALPHA_TOP})`]);
    expect(bottom).toEqual([1, `rgba(${r},${g},${b},${TRAJINERA_SHADOW_ALPHA_BOTTOM})`]);
    expect(TRAJINERA_SHADOW_ALPHA_TOP).toBeLessThanOrEqual(0.5);
    expect(TRAJINERA_SHADOW_ALPHA_BOTTOM).toBeLessThan(TRAJINERA_SHADOW_ALPHA_TOP);
    expect(outline).toMatchObject({ op: 'stroke', style: INK, lineWidth: 2.4 });
    expect(outline.cmds).toEqual(footprint.cmds);
  });

  it('keeps the footprint see-through: no opaque fill', () => {
    for (const f of fills(painted)) expect(isHex(f.style) && f.style !== WHITE, f.style).toBe(false);
  });

  it('points two white chevrons, each with ink either side, the way the boat glides (+x)', () => {
    const chevrons = strokes(painted).filter((p) => p.cmds[0][0] === 'moveTo' && p.cmds.length === 3);
    // Two ink strokes, then two white strokes (one inkMany group).
    expect(chevrons.filter((c) => c.style === INK)).toHaveLength(2);
    const white = chevrons.filter((c) => c.style === WHITE);
    expect(white).toHaveLength(2);
    for (const c of white) {
      const [a, tip, b] = pointsOf(c.cmds);
      expect(tip.x).toBeGreaterThan(a.x);
      expect(tip.x).toBeGreaterThan(b.x);
      expect(a.y).toBeLessThan(tip.y);
      expect(b.y).toBeGreaterThan(tip.y);
    }
    // White and ink are 14.39:1, so the chevrons are 3.79:1 or better on any background.
    expect(contrast(WHITE, INK)).toBeGreaterThan(14);
  });

  it('keeps the ink outline 3:1 or better against the water outside it', () => {
    expect(luminance(FLOOR_WATER)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, FLOOR_WATER)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    expect(signature(record(paintTrajineraShadow))).toBe(signature(painted));
  });
});

// ---------------------------------------------------------------------------
// Moored hulls
// ---------------------------------------------------------------------------

describe('moored trajinera hulls (guide 7e, 10; issue #78)', () => {
  const painted = record(paintMooredHulls);

  it('is the bank overhang frame: 440 x 60 plus 4 px padding, anchored at the top-left corner of the rect', () => {
    expect(MOORED_W).toBe(440);
    expect(MOORED_H).toBe(60);
    expect(MOORED_TEX).toEqual({ w: 448, h: 68, originX: 4, originY: 4 });
  });

  it('stays inside its frame, ink included', () => {
    expectInsideFrame(painted, MOORED_TEX);
  });

  it('lays the shade first, from the deep blue-green, nearly solid over the spots and nothing at the bottom', () => {
    const shade = painted[0];
    expect(shade.op).toBe('fill');
    const [r, g, b] = DEEP_CANAL_SHADE_RGB;
    expect(shade.gradient!.stops).toEqual(MOORED_SHADE_STOPS.map(([t, a]) => [t, `rgba(${r},${g},${b},${a})`]));
    expect(MOORED_SHADE_STOPS[0][1]).toBeGreaterThanOrEqual(0.9);
    // The spots sit about 30 px down, at 0.5 of the height: still 0.8 solid there.
    expect(MOORED_SHADE_STOPS[1]).toEqual([0.8, 0.8]);
    expect(MOORED_SHADE_STOPS[MOORED_SHADE_STOPS.length - 1][1]).toBe(0);
  });

  it('keeps the shade, even at its most solid, over the luminance floor with ink 3:1 or better', () => {
    const solid = toHex(DEEP_CANAL_SHADE_RGB);
    expect(luminance(solid)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, solid)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    // Blue-green: green and blue both over red.
    const [r, g, b] = DEEP_CANAL_SHADE_RGB;
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('hangs three hulls from the water line, each inside the rect, 14 px apart, above the spots', () => {
    expect(MOORED_HULLS).toHaveLength(3);
    MOORED_HULLS.forEach((hull, i) => {
      expect(hull.x0).toBeGreaterThanOrEqual(0);
      expect(hull.x0 + hull.w).toBeLessThanOrEqual(MOORED_W);
      if (i > 0) expect(hull.x0 - (MOORED_HULLS[i - 1].x0 + MOORED_HULLS[i - 1].w)).toBe(14);
    });
    // The hull stops above where the spots sit (about 30 px down), so the shade, not the hull, covers them.
    expect(MOORED_HULL_DEPTH).toBeLessThan(30);
    const cream = fills(painted).filter((p) => p.style === BOAT_HULL);
    expect(cream).toHaveLength(3);
    for (const c of cream) {
      const e = extentOf(c.cmds);
      expect(e.minY).toBe(0);
      expect(e.maxY).toBe(MOORED_HULL_DEPTH);
    }
  });

  it('paints each hull brightly: a cream rail over three bands, each hull in its own order of pink, orange and teal', () => {
    const bands = fills(painted).filter((p) => p.cmds[0][0] === 'fillRect');
    expect(bands).toHaveLength(9);
    const orders = MOORED_HULLS.map((h) => h.bands.join());
    expect(new Set(orders).size).toBe(3);
    MOORED_HULLS.forEach((hull, i) => {
      expect(bands.slice(i * 3, i * 3 + 3).map((b) => b.style)).toEqual([...hull.bands]);
      for (const colour of hull.bands) expect([BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]).toContain(colour);
      expect(new Set(hull.bands).size).toBe(3);
    });
    // The bands start under the cream rail, below the water line.
    for (const b of bands) expect(b.cmds[0][2]).toBeGreaterThan(0);
  });

  it('inks each hull along its lower edge and both ends only, so no dark line crosses the surface', () => {
    const hullInk = strokes(painted).filter((p) => p.style === INK && p.lineWidth === LW * 0.8);
    expect(hullInk).toHaveLength(3);
    for (const s of hullInk) {
      expect(s.cmds.some(([name]) => name === 'closePath')).toBe(false);
      // The path runs from the water line down one end, along the bottom and up the other: only its two ends are at y 0.
      const atSurface = pointsOf(s.cmds).filter((p) => p.y === 0);
      expect(atSurface).toHaveLength(2);
    }
  });

  it('draws an ink gunwale line under each cream rail, so the rail reads light over dark in greyscale', () => {
    const rails = strokes(painted).filter((p) => p.style === INK && p.lineWidth === RAIL_LINE_W);
    expect(rails).toHaveLength(3);
    for (const rail of rails) {
      const [a, b] = pointsOf(rail.cmds);
      expect(a.y).toBe(b.y);
      expect(a.y).toBeGreaterThan(0);
    }
  });

  it('ties the hulls with two mooring ropes, a tan tube with ink each side', () => {
    const ropes = strokes(painted).filter((p) => p.style === POLE_WOOD);
    expect(ropes).toHaveLength(2);
    const ropeInk = strokes(painted).filter((p) => p.style === INK && p.lineWidth === 3 + 2 * 1.6);
    expect(ropeInk).toHaveLength(2);
  });

  it('puts internal detail in alpha lines only (seams and shines), and the prow balls in orange', () => {
    const detail = strokes(painted).filter((p) => p.style === BOAT_SEAM || p.style === BOAT_SHINE);
    expect(detail.length).toBeGreaterThan(0);
    expect(fills(painted).filter((p) => p.style === BOAT_ORANGE && p.cmds[0][0] === 'moveTo')).toHaveLength(3);
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    expect(signature(record(paintMooredHulls))).toBe(signature(painted));
  });
});

// ---------------------------------------------------------------------------
// Sunken old trajinera hull cave
// ---------------------------------------------------------------------------

describe('sunken old trajinera hull cave (guide 7e, 10; issue #78)', () => {
  it('shares the cave frame, so it bakes and places like the cave', () => {
    expect(HULL_CAVE_W).toBe(180);
    expect(HULL_CAVE_H).toBe(136);
    expect(HULL_CAVE_TEX).toEqual(CAVE_TEX);
  });

  it('paints the back as one near-black opening and nothing else, flat on the bed', () => {
    const painted = record(paintHullCaveBack);
    expect(painted).toHaveLength(1);
    expect(painted[0].style).toBe(HULL_CAVE_INTERIOR);
    expectInsideFrame(painted, HULL_CAVE_TEX);
    const ys = pointsOf(painted[0].cmds).map((pt) => pt.y);
    expect(Math.max(...ys)).toBe(0);
    expect(-Math.min(...ys)).toBeLessThanOrEqual(HULL_CAVE_TEX.originY - 2);
  });

  it('makes the back 2 px wider than the gap in the front, more than the ink reaches (1.75), so the ink covers its edge', () => {
    const back = extentOf(record(paintHullCaveBack)[0].cmds);
    expect(back.maxX).toBe(HULL_CAVE_OPENING.halfW + 2);
    expect(back.minX).toBe(-(HULL_CAVE_OPENING.halfW + 2));
    expect(2).toBeGreaterThan(3.5 / 2);
  });

  const front = record(paintHullCaveFront);
  const body = front[0];

  it('fills the hull with the even-odd rule, so the opening is a hole, and leaves the bed side open', () => {
    expect(body).toMatchObject({ op: 'fill', style: HULL_CAVE_WOOD, rule: 'evenodd' });
    expect(body.cmds.filter(([name]) => name === 'moveTo')).toHaveLength(2);
    expect(body.cmds.some(([name]) => name === 'closePath')).toBe(false);
    const ink = strokes(front).find((s) => s.style === INK && s.lineWidth === 3.5 && s.cmds === body.cmds)!;
    expect(ink).toBeDefined();
  });

  it('is an upturned boat: a flat keel on top, sides flared out to the bed, the opening round-topped between them', () => {
    const e = extentOf(body.cmds);
    expect(e.minY).toBe(HULL_CAVE_BODY.keelY);
    expect(e.maxY).toBe(0);
    expect(e.maxX).toBe(HULL_CAVE_BODY.baseHalfW);
    expect(e.minX).toBe(-HULL_CAVE_BODY.baseHalfW);
    expect(HULL_CAVE_BODY.keelHalfW).toBeLessThan(HULL_CAVE_BODY.shoulderHalfW);
    expect(HULL_CAVE_BODY.shoulderHalfW).toBeLessThan(HULL_CAVE_BODY.baseHalfW);
    // The keel's two ends are level.
    const keel = body.cmds.filter(([name, , y]) => name === 'lineTo' && y === HULL_CAVE_BODY.keelY);
    expect(keel).toHaveLength(1);
    // The opening's round top clears the keel by a hull's thickness.
    const top = HULL_CAVE_OPENING.rise + HULL_CAVE_OPENING.halfW;
    expect(-HULL_CAVE_BODY.keelY - top).toBeGreaterThanOrEqual(20);
  });

  it('keeps wood on both sides of the opening, at every height of it, so the hull frames the gap', () => {
    const { halfW, rise } = HULL_CAVE_OPENING;
    // The flare at a height y: the hull's half width there is at least the opening's half width plus a wall.
    for (let y = -rise; y <= 0; y += 2) {
      // The side's curve passes through (baseHalfW - 8, -70) as its control point: at any height the outer edge is at least the shoulder.
      expect(HULL_CAVE_BODY.shoulderHalfW, `y ${y}`).toBeGreaterThanOrEqual(halfW);
    }
    expect(HULL_CAVE_BODY.baseHalfW - halfW).toBeGreaterThanOrEqual(30);
  });

  it('stays inside its frame, ink included', () => {
    expectInsideFrame(front, HULL_CAVE_TEX);
  });

  it('clips faded paint, seams, algae, light and dark wood to the hull and paints them before the ink', () => {
    const bandFills = fills(front).filter((p) => p.cmds[0][0] === 'fillRect');
    const bandStyles = bandFills.map((p) => p.style);
    for (const hex of [HULL_CAVE_FADED_PINK, HULL_CAVE_FADED_ORANGE, HULL_CAVE_FADED_TEAL, HULL_CAVE_WOOD_LIGHT]) {
      expect(bandStyles, hex).toContain(hex);
    }
    const styles = styleSet(front);
    for (const hex of [HULL_CAVE_SEAM, HULL_CAVE_ALGAE, HULL_CAVE_WOOD_DARK]) expect(styles.has(hex), hex).toBe(true);
    const inkAt = front.indexOf(strokes(front).find((s) => s.cmds === body.cmds && s.style === INK)!);
    expect(front.findIndex((p) => p.style === HULL_CAVE_ALGAE)).toBeLessThan(inkAt);
    expect(front.findIndex((p) => p.style === HULL_CAVE_SEAM)).toBeLessThan(inkAt);
  });

  it('puts a faded prow ball on the keel and two stones at the feet, each inked', () => {
    const inked = strokes(front).filter((s) => s.style === INK);
    // The hull, the ball, and two stones.
    expect(inked).toHaveLength(4);
    expect(inked.filter((s) => s.lineWidth === 3.5)).toHaveLength(3);
    const ball = fills(front).find((p) => p.style === HULL_CAVE_FADED_ORANGE && p.cmds[0][0] === 'moveTo')!;
    expect(extentOf(ball.cmds).maxY).toBeLessThanOrEqual(HULL_CAVE_BODY.keelY + 2);
    const stones = fills(front).filter((p) => p.style === CANAL_STONE || p.style === CANAL_STONE_DARK);
    expect(stones).toHaveLength(2);
    for (const stone of stones) expect(extentOf(stone.cmds).maxY).toBeLessThanOrEqual(0);
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    expect(signature(record(paintHullCaveFront))).toBe(signature(front));
    expect(signature(record(paintHullCaveBack))).toBe(signature(record(paintHullCaveBack)));
  });
});

// ---------------------------------------------------------------------------
// Old canal-bed stones
// ---------------------------------------------------------------------------

describe('old canal-bed stones (guide 7a, 10; issue #78)', () => {
  const painted = record((ctx) => paintCanalBedStones(ctx));

  it('paints slabs and blocks as inked rounded masonry, in three weathered stone tones', () => {
    const inked = strokes(painted).filter((s) => s.style === INK);
    expect(inked).toHaveLength(CANAL_BED_SLABS.length + CANAL_BED_BLOCKS.length);
    for (const s of inked) expect(s.lineWidth).toBeCloseTo(LW * 0.6);
    const fillStyles = styleSet(fills(painted));
    for (const hex of [CANAL_STONE, CANAL_STONE_LIGHT, CANAL_STONE_DARK]) expect(fillStyles.has(hex), hex).toBe(true);
  });

  it('keeps every stone tone over the luminance floor, so its ink is 3:1 or better', () => {
    for (const hex of [CANAL_STONE, CANAL_STONE_LIGHT, CANAL_STONE_DARK]) {
      expect(luminance(hex), hex).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('keeps all the stones inside the chunk, x 6 to 474, ink included, so every bottom chunk paints the same', () => {
    for (const p of painted) {
      const half = p.op === 'stroke' ? p.lineWidth / 2 : 0;
      for (const pt of pointsOf(p.cmds)) {
        expect(pt.x - half).toBeGreaterThanOrEqual(6 - 1e-9);
        expect(pt.x + half).toBeLessThanOrEqual(474 + 1e-9);
      }
    }
  });

  it('lays the slabs under the bed edge and stands the blocks on it, mostly above', () => {
    const rects = fills(painted).filter((p) => [CANAL_STONE, CANAL_STONE_LIGHT, CANAL_STONE_DARK].includes(p.style));
    const slabs = rects.slice(0, CANAL_BED_SLABS.length);
    const blocks = rects.slice(CANAL_BED_SLABS.length);
    for (const slab of slabs) expect(extentOf(slab.cmds).minY).toBeGreaterThan(CANAL_BED_EDGE_Y);
    expect(blocks).toHaveLength(CANAL_BED_BLOCKS.length);
    for (const block of blocks) {
      const e = extentOf(block.cmds);
      expect(e.minY).toBeLessThan(CANAL_BED_EDGE_Y);
      // Two thirds of the block or more stands above the edge: it sits on the bed, not in it.
      expect(CANAL_BED_EDGE_Y - e.minY).toBeGreaterThan((e.maxY - e.minY) * 0.5);
    }
  });

  it('follows the bed edge it is given, and the canal edge by default', () => {
    const flat = record((ctx) => paintCanalBedStones(ctx, () => 300));
    expect(signature(flat)).not.toBe(signature(painted));
    const shifted = record((ctx) => paintCanalBedStones(ctx, (x) => CANAL_BED_EDGE_Y + 0 * x));
    expect(signature(shifted)).toBe(signature(painted));
    const blocks = fills(flat).filter((p) => p.style === CANAL_STONE_DARK || p.style === CANAL_STONE).slice(CANAL_BED_SLABS.length);
    for (const block of blocks) expect(extentOf(block.cmds).minY).toBeLessThan(300);
  });

  it('puts moss caps, cracks and shines inside the stones, in alpha lines or small fills with no ink', () => {
    const styles = styleSet(painted);
    for (const s of [CANAL_STONE_MOSS, CANAL_STONE_CRACK, CANAL_STONE_SHINE]) expect(styles.has(s), s).toBe(true);
    expect(luminance(CANAL_STONE_MOSS)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(fills(painted).filter((p) => p.style === CANAL_STONE_MOSS)).toHaveLength(CANAL_BED_BLOCKS.length);
  });

  it('uses no randomness: the same call draws the same shapes', () => {
    expect(signature(record((ctx) => paintCanalBedStones(ctx)))).toBe(signature(painted));
  });
});

describe('old canal-bed stones in the background chunks (issue #78)', () => {
  const CHUNK_INDEX = 2;
  const STONE_TONES = [CANAL_STONE, CANAL_STONE_LIGHT, CANAL_STONE_DARK];
  const chunkOf = (look: AreaLookId, row: ChunkRow): Painted[] => {
    let state = 12345;
    const rand = (): number => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    return record((ctx) => paintBackgroundChunk(ctx, { row, index: CHUNK_INDEX, hasSun: false, hasBank: false, look, rand }));
  };
  const stoneFills = (painted: readonly Painted[]): Painted[] => fills(painted).filter((p) => STONE_TONES.includes(p.style));

  it('says only the deep canal look paints bed stones', () => {
    for (const id of AREA_LOOK_IDS) expect(habitatLook(id).bedStones, id).toBe(id === 'deep-canal');
  });

  it('paints the stones last in a deep canal bottom and single chunk, on that chunk\'s own bed edge', () => {
    const expected = record((ctx) => paintCanalBedStones(ctx, (x) => bedEdgeY(CHUNK_INDEX * VIEW_W + x)));
    for (const row of ['bottom', 'single'] as const) {
      const painted = chunkOf('deep-canal', row);
      expect(stoneFills(painted), row).toHaveLength(CANAL_BED_SLABS.length + CANAL_BED_BLOCKS.length);
      expect(signature(painted.slice(-expected.length)), row).toBe(signature(expected));
    }
  });

  it('paints no stones in a top or middle deep canal chunk, which have no bed', () => {
    for (const row of ['top', 'middle'] as const) expect(stoneFills(chunkOf('deep-canal', row)), row).toHaveLength(0);
  });

  it('paints no stones in any other look', () => {
    for (const id of AREA_LOOK_IDS.filter((look) => look !== 'deep-canal')) {
      for (const row of ['bottom', 'single'] as const) expect(stoneFills(chunkOf(id, row)), `${id} ${row}`).toHaveLength(0);
    }
  });

  it('draws the same chunk twice: no time, no extra randomness', () => {
    expect(signature(chunkOf('deep-canal', 'bottom'))).toBe(signature(chunkOf('deep-canal', 'bottom')));
  });
});

// ---------------------------------------------------------------------------
// Side-canal inflow marks
// ---------------------------------------------------------------------------

describe('side-canal inflow marks (reused spring outflow, guide 7b)', () => {
  it('reuses the spring outflow painter and frame, with no new art', () => {
    expect(paintSideCanalInflow).toBe(paintSpringOutflow);
    expect(SIDE_CANAL_INFLOW_TEX).toBe(OUTFLOW_TEX);
  });

  it('only lightens the water: a white band and white flow lines, no ink and no opaque fill', () => {
    const painted = record(paintSideCanalInflow);
    expect(styleSet(painted).has(INK)).toBe(false);
    for (const p of painted) {
      if (p.gradient !== null) {
        for (const [, colour] of p.gradient.stops) expect(colour).toMatch(/^rgba\(232,251,255,/);
        expect(Math.max(...p.gradient.stops.map(([, c]) => alphaOf(c)))).toBeLessThanOrEqual(0.3);
      } else {
        expect(p.style).toMatch(/^rgba\(255,255,255,0\.\d+\)$/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Colours and the contrast rule, with the greyscale
// ---------------------------------------------------------------------------

describe('deep canal colours (guide 10, the pair method)', () => {
  const OPAQUE: readonly (readonly [string, string])[] = [
    ['old hull wood', HULL_CAVE_WOOD],
    ['light old wood', HULL_CAVE_WOOD_LIGHT],
    ['dark old wood', HULL_CAVE_WOOD_DARK],
    ['faded pink', HULL_CAVE_FADED_PINK],
    ['faded orange', HULL_CAVE_FADED_ORANGE],
    ['faded teal', HULL_CAVE_FADED_TEAL],
    ['hull cave algae', HULL_CAVE_ALGAE],
    ['canal stone', CANAL_STONE],
    ['light stone', CANAL_STONE_LIGHT],
    ['dark stone', CANAL_STONE_DARK],
    ['stone moss', CANAL_STONE_MOSS],
    ['moored shade, most solid', toHex(DEEP_CANAL_SHADE_RGB)],
  ];

  it.each(OPAQUE)('%s is at the luminance floor or more, so its ink outline is 3:1 or better', (_name, hex) => {
    expect(luminance(hex)).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
    expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it.each([
    ['cream hull', BOAT_HULL],
    ['pink band', BOAT_PINK],
    ['orange band', BOAT_ORANGE],
    ['teal band', BOAT_TEAL],
    ['yellow petals', BOAT_YELLOW],
  ])('%s is 3:1 or better with ink', (_name, hex) => {
    expect(contrast(INK, hex)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('holds the cream hull to the 9:1 pair rule, so its ink outline is 3:1 or better on any background', () => {
    expect(contrast(INK, BOAT_HULL)).toBeGreaterThanOrEqual(PAIR_RULE);
    // The worst case alone is the square root of the pair ratio.
    expect(Math.sqrt(contrast(INK, BOAT_HULL))).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('keeps ink 3:1 or better on the darkest deep canal water the floor allows', () => {
    expect(contrast(INK, FLOOR_WATER)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('keeps the hull cave interior far under the wood, so the opening reads in greyscale', () => {
    expect(luminance(HULL_CAVE_INTERIOR)).toBeLessThan(0.01);
    expect(contrast(HULL_CAVE_WOOD, HULL_CAVE_INTERIOR)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    expect(contrast(HULL_CAVE_WOOD_DARK, HULL_CAVE_INTERIOR)).toBeGreaterThanOrEqual(PAIR_FLOOR);
  });

  it('keeps the old hull cave from the live one by value: the faded bands are darker than a bright band, and the wood darker than the cream hull', () => {
    for (const [faded, bright] of [
      [HULL_CAVE_FADED_PINK, BOAT_PINK],
      [HULL_CAVE_FADED_ORANGE, BOAT_ORANGE],
      [HULL_CAVE_FADED_TEAL, BOAT_TEAL],
    ] as const) {
      // Both are mid values; the old paint is never lighter than the cream of a live hull.
      expect(luminance(faded)).toBeLessThan(luminance(BOAT_HULL));
      expect(luminance(bright)).toBeLessThan(luminance(BOAT_HULL));
    }
    expect(luminance(HULL_CAVE_WOOD)).toBeLessThan(luminance(BOAT_HULL) / 2);
  });
});

describe('deep canal greyscale (guide 10)', () => {
  it('reads the live hull as a cream rail lighter than every band, all held by an ink outline', () => {
    const inkL = luminance(INK);
    expect(inkL).toBeLessThan(0.03);
    for (const band of [BOAT_PINK, BOAT_ORANGE, BOAT_TEAL]) {
      expect(luminance(BOAT_HULL)).toBeGreaterThan(luminance(band));
      // The cream alone is only about 1.8:1 lighter than the lightest band, so a thin ink gunwale line under the rail (RAIL_LINE_W) makes it read as a rail in greyscale.
      expect(contrast(BOAT_HULL, band)).toBeGreaterThanOrEqual(1.7);
      expect(contrast(INK, band)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('outlines the gliding hull, the shadow, the moored hulls, the hull cave and the stones in ink', () => {
    for (const paint of [paintTrajineraHull, paintTrajineraShadow, paintMooredHulls, paintHullCaveFront, (c: CanvasRenderingContext2D) => paintCanalBedStones(c)]) {
      const inkStrokes = strokes(record(paint)).filter((s) => s.style === INK);
      expect(inkStrokes.length).toBeGreaterThan(0);
    }
  });

  it('composites the shadow at its darkest over the darkest water and keeps the outline readable against the water outside', () => {
    const [r, g, b] = TRAJINERA_SHADOW_RGB;
    const darkest = over(FLOOR_WATER, [r, g, b], TRAJINERA_SHADOW_ALPHA_TOP);
    const lightest = over(FLOOR_WATER, [r, g, b], TRAJINERA_SHADOW_ALPHA_BOTTOM);
    // The shadow darkens the water (it is a shadow) and darkens it less with depth.
    expect(luminance(darkest)).toBeLessThan(luminance(lightest));
    expect(luminance(lightest)).toBeLessThan(luminance(FLOOR_WATER));
    // The ink outline sits on the edge: the outside half is on plain water, 3:1 or better.
    expect(contrast(INK, FLOOR_WATER)).toBeGreaterThanOrEqual(PAIR_FLOOR);
    // The darkest composite is still visibly darker than the water (a 1.3:1 or better step), so the footprint shows without the outline too.
    expect(contrast(FLOOR_WATER, darkest)).toBeGreaterThanOrEqual(1.3);
  });
});

// ---------------------------------------------------------------------------
// The bakes (issue #78, STEP-010)
// ---------------------------------------------------------------------------

/** A fake scene that records every canvas texture created. */
function fakeScene(created: { key: string; w: number; h: number }[]): never {
  return {
    textures: {
      exists: () => false,
      remove: () => undefined,
      createCanvas: (key: string, w: number, h: number) => {
        created.push({ key, w, h });
        return {
          context: new Proxy(
            {},
            {
              get: (_target, name) =>
                name === 'createLinearGradient' || name === 'createRadialGradient'
                  ? () => new GradientStub('linear', [])
                  : () => undefined,
              set: () => true,
            },
          ),
          refresh: () => undefined,
        };
      },
    },
  } as never;
}

describe('bakeDeepCanalTextures', () => {
  const bakeAt = (scale: number) => {
    const created: { key: string; w: number; h: number }[] = [];
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeDeepCanalTextures(fakeScene(created), scale);
    return { art, created };
  };

  it('bakes every prop under its own fixed key', () => {
    const { created } = bakeAt(2);
    expect(created.map((c) => c.key).sort()).toEqual(Object.values(DEEP_CANAL_TEX).sort());
    expect(new Set(created.map((c) => c.key)).size).toBe(created.length);
    expect(DEEP_CANAL_TEX.trajineraHull).toBe('deep-canal-trajinera-hull');
    expect(DEEP_CANAL_TEX.mooredHulls).toBe('deep-canal-moored-hulls');
  });

  it('bakes each texture at the bake scale, its pixel size rounded up from its frame', () => {
    const { art, created } = bakeAt(3);
    const infos = [art.trajineraHull, art.trajineraShadow, art.mooredHulls, art.hullCave.back, art.hullCave.front];
    for (const info of infos) {
      expect(info.scale).toBe(3);
      expect(info.pxW).toBe(Math.ceil(info.w * 3 - 1e-6));
      expect(info.pxH).toBe(Math.ceil(info.h * 3 - 1e-6));
      expect(created.find((c) => c.key === info.key)).toEqual({ key: info.key, w: info.pxW, h: info.pxH });
    }
  });

  it('bakes the gliding hull and its shadow anchored on the water line at the middle of the hull, as their frames say', () => {
    const { art } = bakeAt(2);
    for (const [info, tex] of [
      [art.trajineraHull, TRAJINERA_HULL_TEX],
      [art.trajineraShadow, TRAJINERA_SHADOW_TEX],
    ] as const) {
      expect(info.w).toBe(tex.w);
      expect(info.h).toBe(tex.h);
      expect(info.originX).toBe(tex.originX);
      expect(info.originY).toBe(tex.originY);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
      expect(info.originNormY).toBeCloseTo(tex.originY / tex.h, 6);
    }
    expect(art.trajineraHull.key).toBe(DEEP_CANAL_TEX.trajineraHull);
    expect(art.trajineraShadow.key).toBe(DEEP_CANAL_TEX.trajineraShadow);
  });

  it('bakes the moored hulls anchored at the top-left corner of their rect, so they stretch like the bank overhang', () => {
    const info = bakeAt(2).art.mooredHulls;
    expect(info.w).toBe(MOORED_TEX.w);
    expect(info.h).toBe(MOORED_TEX.h);
    expect(info.w).toBe(MOORED_W + 8);
    expect(info.h).toBe(MOORED_H + 8);
    expect(info.originNormX).toBeCloseTo(4 / MOORED_TEX.w, 6);
    expect(info.originNormY).toBeCloseTo(4 / MOORED_TEX.h, 6);
  });

  it('bakes the hull cave back and front in the cave frame, anchored at the base centre', () => {
    const { art } = bakeAt(2);
    for (const info of [art.hullCave.back, art.hullCave.front]) {
      expect(info.w).toBe(CAVE_TEX.w);
      expect(info.h).toBe(CAVE_TEX.h);
      expect(info.originX).toBe(CAVE_TEX.originX);
      expect(info.originY).toBe(CAVE_TEX.originY);
      expect(info.originNormX).toBeCloseTo(0.5, 6);
      expect(info.originNormY).toBeCloseTo(CAVE_TEX.originY / CAVE_TEX.h, 6);
    }
    expect(art.hullCave.back.pxW).toBe(art.hullCave.front.pxW);
    expect(art.hullCave.back.pxH).toBe(art.hullCave.front.pxH);
    expect(art.hullCave.back.key).toBe(DEEP_CANAL_TEX.hullCaveBack);
    expect(art.hullCave.front.key).toBe(DEEP_CANAL_TEX.hullCaveFront);
  });
});

describe('which areas need the deep canal bake (issue #78)', () => {
  it('gives Area 8 gliding trajineras, so the deep canal props are baked whatever its look', () => {
    expect(DEEP_CANAL_AREA.layout.trajineras?.length ?? 0).toBeGreaterThan(0);
  });

  it('leaves Areas 1 to 7 with no trajineras, no sunken hull cave and no deep canal props, so they bake as before', () => {
    const earlier = AREAS.filter((area) => area.number < DEEP_CANAL_AREA.number);
    expect(earlier.map((area) => area.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const area of earlier) {
      const habitat = habitatById(area.habitatId);
      expect(habitat, area.id).toBeDefined();
      const look = habitatLook(area.look ?? habitat?.look ?? '');
      expect(look.deepCanalProps, area.id).toBe(false);
      expect(look.cave.kind, area.id).not.toBe('sunkenHull');
      expect(area.layout.trajineras ?? [], area.id).toHaveLength(0);
    }
  });

  it("bakes every size of Area 8's divider in the spring cave rock wall bake, one texture per size", () => {
    const walls = DEEP_CANAL_AREA.layout.rockWalls ?? [];
    expect(walls.length).toBeGreaterThan(0);
    const sizes = walls.map((wall) => [wall.x1 - wall.x0, wall.y1 - wall.y0] as const);
    const created: { key: string; w: number; h: number }[] = [];
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeSpringCaveTextures(fakeScene(created), 2, sizes);
    const unique = new Set(sizes.map(([w, h]) => rockWallSizeKey(w, h)));
    expect(art.rockWalls.size).toBe(unique.size);
    for (const [w, h] of sizes) {
      const info = art.rockWalls.get(rockWallSizeKey(w, h));
      expect(info, `${w}x${h}`).toBeDefined();
      expect(info?.key).toBe(`${ROCK_WALL_KEY_PREFIX}${rockWallSizeKey(w, h)}`);
    }
    expect(created.filter((c) => c.key.startsWith(ROCK_WALL_KEY_PREFIX))).toHaveLength(unique.size);
  });
});

// ---------------------------------------------------------------------------
// The deep canal look (issue #78, STEP-012)
// ---------------------------------------------------------------------------

/** The [r, g, b, a] of an rgba() colour. */
function rgbaOf(colour: string): readonly [number, number, number, number] {
  const match = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(colour);
  expect(match, colour).not.toBeNull();
  return (match as RegExpExecArray).slice(1).map(Number) as unknown as readonly [number, number, number, number];
}

/** An rgba() colour laid over an opaque #rrggbb, as the canvas mixes it in 8-bit sRGB. */
function overRgba(base: string, colour: string): string {
  const [r, g, b, a] = rgbaOf(colour);
  return over(base, [r, g, b], a);
}

/** Hue of a #rrggbb colour in degrees, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = channelsOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  if (max === r) return ((((g - b) / d) % 6) * 60 + 360) % 360;
  if (max === g) return (((b - r) / d + 2) * 60 + 360) % 360;
  return (((r - g) / d + 4) * 60 + 360) % 360;
}

describe('the deep canal look (issue #78)', () => {
  const look = habitatLook('deep-canal');

  it('is the last habitat look and an area look, and resolves to the frozen look table entry', () => {
    expect(HABITAT_LOOK_IDS[HABITAT_LOOK_IDS.length - 1]).toBe('deep-canal');
    expect(AREA_LOOK_IDS).toContain('deep-canal');
    expect(look).toBe(DEEP_CANAL_LOOK);
    expect(look.id).toBe('deep-canal');
    expect(Object.isFrozen(look)).toBe(true);
    expect(Object.isFrozen(look.water)).toBe(true);
    expect(Object.isFrozen(look.bed)).toBe(true);
  });

  it('boots Area 8: its habitat look id resolves, so areaLook no longer throws a RangeError', () => {
    expect(() => habitatLook(DEEP_CANAL_AREA.look ?? habitatById(DEEP_CANAL_AREA.habitatId)?.look ?? '')).not.toThrow();
  });

  it('is the documented derived values', () => {
    expect(look.water).toEqual({
      shallow: '#46b2c0',
      mid: '#2a95aa',
      deep: '#21809a',
      stopMid: WATER_STOP_MID,
      gradientEndY: WATER_GRADIENT_END_Y,
    });
    expect([DEEP_CANAL_WATER_SHALLOW, DEEP_CANAL_WATER_MID, DEEP_CANAL_WATER_DEEP]).toEqual(['#46b2c0', '#2a95aa', '#21809a']);
    expect(look.haze).toBe('rgba(60,170,200,0.12)');
    expect(look.haze).toBe(DEEP_CANAL_HAZE);
    expect(look.surfaceFill).toBe(DEEP_CANAL_WATER_SHALLOW);
    expect(look.surfaceLine).toBe('rgba(224,248,252,0.95)');
    expect(look.surfaceLine).toBe(DEEP_CANAL_SURFACE_LINE);
    expect(look.bed.top).toBe('#6d8ca0');
    expect(look.bed.bottom).toBe('#5c7d94');
    expect(look.bed.lip).toBe('#a9c0cc');
    expect(look.bed.mud).toBe('rgba(80,108,132,0.4)');
    expect([DEEP_CANAL_BED_TOP, DEEP_CANAL_BED_BOTTOM, DEEP_CANAL_BED_LIP, DEEP_CANAL_MUD]).toEqual([
      '#6d8ca0',
      '#5c7d94',
      '#a9c0cc',
      'rgba(80,108,132,0.4)',
    ]);
  });

  it('says what its area needs: the sunken hull on the bed, the moored hulls, and no pond, chinampa or spring cave props', () => {
    expect(look.cave).toEqual({ kind: 'sunkenHull', anchor: 'bed' });
    expect(look.deepCanalProps).toBe(true);
    expect(look.springCaveProps).toBe(false);
    expect(look.chinampaProps).toBe(false);
    expect(look.pondProps).toBe(false);
    expect(look.rowDetails).toBe('none');
    expect(look.stream).toBe(false);
    expect(look.edgeReeds).toBeNull();
    expect(look.firefliesPerScreen).toBe(0);
    expect(look.bank).toBe('willows');
    expect(look.currentGap).toBe(false);
    expect(look.airWash).toBeNull();
    expect(look.rayAlphaScale).toBe(1);
    expect(look.sky).toEqual({ top: SKY_TOP, horizon: SKY_HORIZON });
  });

  it('is the only look with the deep canal props or a sunken hull cave', () => {
    for (const id of AREA_LOOK_IDS.filter((other) => other !== 'deep-canal')) {
      expect(habitatLook(id).deepCanalProps, id).toBe(false);
      expect(habitatLook(id).cave.kind, id).not.toBe('sunkenHull');
    }
  });

  it('has deeper, darker blue-green water than the chinampa and the pond, stop by stop', () => {
    const chinampa = habitatLook('chinampa').water;
    const pond = habitatLook('pond').water;
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      expect(luminance(look.water[stop]), stop).toBeLessThan(luminance(chinampa[stop]));
      expect(luminance(look.water[stop]), stop).toBeLessThan(luminance(pond[stop]));
      // blue-green: the hue sits in the cyan band, bluer than the chinampa's green-teal
      expect(hueOf(look.water[stop]), stop).toBeGreaterThan(180);
      expect(hueOf(look.water[stop]), stop).toBeLessThan(200);
      expect(hueOf(look.water[stop]), stop).toBeGreaterThan(hueOf(chinampa[stop]));
    }
    expect(luminance(look.water.shallow)).toBeGreaterThan(luminance(look.water.mid));
    expect(luminance(look.water.mid)).toBeGreaterThan(luminance(look.water.deep));
  });

  it('has an old-stone bed in a cooler blue-grey than the sage stones painted on it, so the stones read', () => {
    for (const hex of [CANAL_STONE, CANAL_STONE_LIGHT]) {
      expect(luminance(hex), hex).toBeGreaterThan(luminance(look.bed.bottom));
    }
    expect(hueOf(look.bed.top)).toBeGreaterThan(hueOf(CANAL_STONE));
    expect(hueOf(look.bed.bottom)).toBeGreaterThan(hueOf(CANAL_STONE));
    expect(look.bed.pebbleCount).toBeGreaterThan(0);
    expect(look.bed.mudCount).toBeGreaterThan(0);
  });
});

describe('deep canal contrast (guide 10, the pond contrast rule)', () => {
  const look = habitatLook('deep-canal');

  /** Every background colour of the look, the haze laid over the water and the bed included. */
  function backgrounds(): { name: string; hex: string }[] {
    const out: { name: string; hex: string }[] = [
      { name: 'sky top', hex: look.sky.top },
      { name: 'sky horizon', hex: look.sky.horizon },
    ];
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      out.push({ name: `water ${stop}`, hex: look.water[stop] });
      out.push({ name: `water ${stop} under haze`, hex: overRgba(look.water[stop], look.haze) });
    }
    for (const stop of ['top', 'bottom', 'lip'] as const) {
      out.push({ name: `bed ${stop}`, hex: look.bed[stop] });
      out.push({ name: `bed ${stop} under haze`, hex: overRgba(look.bed[stop], look.haze) });
    }
    const mud = overRgba(look.bed.bottom, look.bed.mud);
    out.push({ name: 'mud on bed bottom', hex: mud }, { name: 'mud on bed bottom under haze', hex: overRgba(mud, look.haze) });
    return out;
  }

  it('every background has luminance 0.1687 or more, so ink is 3:1 or better on it', () => {
    const all = backgrounds();
    expect(all.length).toBe(16);
    for (const { name, hex } of all) {
      expect(luminance(hex), name).toBeGreaterThanOrEqual(LUMINANCE_FLOOR);
      expect(contrast(INK, hex), name).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('lets the haze only lighten the deep water and the bed, so the rule holds under it too', () => {
    expect(luminance(overRgba(look.water.deep, look.haze))).toBeGreaterThan(luminance(look.water.deep));
    expect(luminance(overRgba(look.bed.bottom, look.haze))).toBeGreaterThan(luminance(look.bed.bottom));
  });

  it('keeps the deep stop at the floor and within a hair of the moored shade, the darkest water the props are drawn for', () => {
    expect(luminance(look.water.deep)).toBeGreaterThanOrEqual(luminance(FLOOR_WATER) - 0.01);
    expect(Math.abs(luminance(look.water.deep) - luminance(FLOOR_WATER))).toBeLessThan(0.01);
  });

  it('documents the luminances and ratios the comments print', () => {
    const rows: readonly (readonly [string, string, string, string])[] = [
      ['water shallow', DEEP_CANAL_WATER_SHALLOW, '0.3695', '5.75'],
      ['water mid', DEEP_CANAL_WATER_MID, '0.2489', '4.10'],
      ['water deep', DEEP_CANAL_WATER_DEEP, '0.1809', '3.17'],
      ['bed top', DEEP_CANAL_BED_TOP, '0.2455', '4.05'],
      ['bed bottom', DEEP_CANAL_BED_BOTTOM, '0.1908', '3.30'],
      ['bed lip', DEEP_CANAL_BED_LIP, '0.5049', '7.61'],
    ];
    for (const [name, hex, lum, ratio] of rows) {
      expect(luminance(hex).toFixed(4), name).toBe(lum);
      expect(contrast(hex, INK).toFixed(2), name).toBe(ratio);
    }
    expect(luminance(overRgba(DEEP_CANAL_WATER_DEEP, DEEP_CANAL_HAZE)).toFixed(4)).toBe('0.1969');
    const mud = overRgba(DEEP_CANAL_BED_BOTTOM, DEEP_CANAL_MUD);
    expect(luminance(mud).toFixed(4)).toBe('0.1694');
    expect(contrast(mud, INK).toFixed(2)).toBe('3.01');
    expect(mud).toBe('#57768e');
  });

  it('keeps the light sage black bass readable on the water: lighter than every stop, 2.87:1 on the deep one, ink outline 3:1 on all', () => {
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      expect(luminance(BASS_BODY), stop).toBeGreaterThan(luminance(look.water[stop]));
      expect(contrast(INK, look.water[stop]), stop).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
    expect(contrast(BASS_BODY, look.water.deep).toFixed(2)).toBe('2.87');
    expect(contrast(BASS_BODY, look.water.mid).toFixed(2)).toBe('2.22');
    expect(contrast(BASS_BODY, look.water.shallow).toFixed(2)).toBe('1.58');
    // The pair method: the bass body or its ink outline is 3:1 or better against every background.
    for (const hex of [look.water.shallow, look.water.mid, look.water.deep, look.bed.top, look.bed.bottom]) {
      expect(Math.max(contrast(INK, hex), contrast(BASS_BODY, hex)), hex).toBeGreaterThanOrEqual(PAIR_FLOOR);
    }
  });

  it('shows the trajinera shadow as a step darker than every water stop: 1.5:1 or more at its most solid', () => {
    const [r, g, b] = TRAJINERA_SHADOW_RGB;
    for (const stop of ['shallow', 'mid', 'deep'] as const) {
      const shadowed = over(look.water[stop], [r, g, b], TRAJINERA_SHADOW_ALPHA_TOP);
      expect(luminance(shadowed), stop).toBeLessThan(luminance(look.water[stop]));
      expect(contrast(look.water[stop], shadowed), stop).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('keeps every moored hull, bank hull and pole colour above the water in value, so the boats read against it', () => {
    for (const hex of [BOAT_HULL, POLE_WOOD]) {
      for (const stop of ['shallow', 'mid', 'deep'] as const) {
        expect(luminance(hex), `${hex} on ${stop}`).toBeGreaterThan(luminance(look.water[stop]));
      }
    }
  });
});
