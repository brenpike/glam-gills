/**
 * Xochimilco refuge art (issue #74; guide 8, 10). Headless: the painters run against a
 * recording context and a stub Path2D, and the Phaser bake runs against a fake scene.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HABITATS } from '../logic/areas';
import { REFUGE_PICTURE, REFUGE_PICTURE_TOP_BAND_H } from '../logic/refugeUi';
import {
  REFUGE_ART_STATES,
  REFUGE_COB,
  REFUGE_CORN,
  REFUGE_HIDDEN_FILL,
  REFUGE_LETTUCE,
  REFUGE_MARIGOLD,
  REFUGE_MURK,
  REFUGE_NUDGE_FILL,
  REFUGE_NUDGE_INSET,
  REFUGE_NUDGE_SIZE,
  REFUGE_NUDGE_TEX,
  REFUGE_PICTURE_TEX,
  REFUGE_PLANTS_BASE,
  REFUGE_PLANTS_TEX,
  REFUGE_PLOT_SOIL,
  REFUGE_PLOT_TOP,
  REFUGE_PLANTS_PAINTERS,
  REFUGE_SECTION_PAINTERS,
  REFUGE_SPARKLE_TEX,
  REFUGE_TRASH_TEX,
  REFUGE_TRASH_VARIANTS,
  blendHex,
  paintRefugeHidden,
  paintRefugeNudge,
  paintRefugePlants,
  paintRefugeSection,
  paintRefugeSparkle,
  paintRefugeTeaser,
  paintRefugeTrash,
  refugeBackdropColours,
  refugeCleanWater,
  refugeDirtyWater,
  refugeTrashSlots,
  refugeTrashVariantAt,
  type RefugeArtState,
  type RefugeTrashVariant,
} from './drawRefuge';
import {
  REFUGE_HIDDEN_KEY,
  REFUGE_NUDGE_KEY,
  REFUGE_SPARKLE_KEY,
  REFUGE_TEASER_KEY,
  bakeRefugeTextures,
  refugePlantsKey,
  refugeSectionKey,
  refugeTrashKey,
} from './refugeTextures';
import { paintIcon, type IconKind } from './drawUi';
import { HABITAT_LOOK_IDS, isHabitatLookId, type HabitatLookId } from './habitatLook';
import { ROOT_TANGLE_BARK } from './drawChinampa';
import { EYE, INK, LW, UI_ACCENT, WHITE, WILLOW_FOLIAGE, WILLOW_STRAND, WILLOW_TRUNK } from './palette';
import texturesSource from './textures.ts?raw';

vi.mock('phaser', () => ({}));

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const isHex = (s: string): boolean => /^#[0-9a-f]{6}$/i.test(s);

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

interface Painted {
  readonly op: 'fill' | 'stroke';
  readonly cmds: Cmd[];
  readonly style: string;
  readonly lineWidth: number;
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const gradient = { addColorStop: () => undefined, toString: () => 'gradient' };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => gradient;
      return (path?: LogPath) => {
        if ((name === 'fill' || name === 'stroke') && path !== undefined) {
          out.push({
            op: name,
            cmds: path.cmds,
            style: String(name === 'fill' ? target.fillStyle : target.strokeStyle),
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
  paint(ctx);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

/** The y values a path command reaches or bends towards, with how far its round parts reach up. */
function commandYs(cmd: Cmd): number[] {
  const [name, ...a] = cmd;
  if (name === 'arc') return [a[1] - a[2]];
  if (name === 'ellipse') return [a[1] - Math.max(a[2], a[3])];
  if (name === 'rect') return [a[1]];
  return a.filter((_, i) => i % 2 === 1);
}

/**
 * The highest point `paint` puts ink or fill at, in its local y (down is +): every path point and
 * control point, less half the line width of a stroke. Follows translate, save and restore; a
 * rotate or scale fails the measure, as it would bend the points.
 */
function paintedTop(paint: (ctx: CanvasRenderingContext2D) => void): number {
  vi.stubGlobal('Path2D', LogPath);
  const offsets: number[] = [0];
  let top = Infinity;
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ops: Record<string, (...args: unknown[]) => void> = {
    save: () => void offsets.push(offsets[offsets.length - 1]),
    restore: () => void offsets.pop(),
    translate: (_x, y) => void (offsets[offsets.length - 1] += y as number),
    rotate: () => {
      throw new Error('paintedTop cannot follow a rotate');
    },
    scale: () => {
      throw new Error('paintedTop cannot follow a scale');
    },
    fill: (path) => {
      for (const cmd of (path as LogPath).cmds) top = Math.min(top, offsets[offsets.length - 1] + Math.min(...commandYs(cmd)));
    },
    stroke: (path) => {
      const half = (state.lineWidth as number) / 2;
      for (const cmd of (path as LogPath).cmds) {
        top = Math.min(top, offsets[offsets.length - 1] + Math.min(...commandYs(cmd)) - half);
      }
    },
  };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => ({ addColorStop: () => undefined });
      return ops[name] ?? (() => undefined);
    },
    set: (target, key, value) => {
      target[String(key)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return top;
}

const strokes = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'stroke');
const fills = (painted: Painted[]): Painted[] => painted.filter((p) => p.op === 'fill');
/** The op names and numbers of every painted path, in order: a fingerprint of the drawn shapes. */
const signature = (painted: Painted[]): string => JSON.stringify(painted.map((p) => [p.op, p.cmds]));
const opNames = (painted: Painted[]): Set<string> => new Set(painted.flatMap((p) => p.cmds.map((c) => c[0])));

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
              get: (_t, key) =>
                key === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined,
              set: () => true,
            },
          ),
          refresh: () => undefined,
        };
      },
    },
  } as never;
}

// ---------------------------------------------------------------------------
// Section pictures
// ---------------------------------------------------------------------------

describe('section pictures', () => {
  it('has art for every habitat look, in both states', () => {
    expect(HABITATS.length).toBeGreaterThan(0);
    for (const habitat of HABITATS) {
      expect(isHabitatLookId(habitat.look)).toBe(true);
      const look = habitat.look as HabitatLookId;
      for (const state of REFUGE_ART_STATES) {
        const painted = record((ctx) => REFUGE_SECTION_PAINTERS[look][state](ctx));
        expect(fills(painted).length).toBeGreaterThan(5);
        expect(strokes(painted).some((s) => s.style === INK)).toBe(true);
      }
      const plants = record((ctx) => REFUGE_PLANTS_PAINTERS[look](ctx));
      expect(strokes(plants).some((s) => s.style === INK)).toBe(true);
    }
  });

  it('has an entry for every shipped look id and refuses an unknown look', () => {
    for (const look of HABITAT_LOOK_IDS) {
      expect(REFUGE_SECTION_PAINTERS[look]).toBeDefined();
      expect(REFUGE_PLANTS_PAINTERS[look]).toBeDefined();
    }
    expect(() => record((ctx) => paintRefugeSection(ctx, 'volcano' as HabitatLookId, 'clean'))).toThrow(RangeError);
    expect(() => record((ctx) => paintRefugePlants(ctx, 'volcano' as HabitatLookId))).toThrow(RangeError);
  });

  it('is 200 x 96 to the outer ink edge, in one frame shared with the silhouette and the teaser', () => {
    expect(REFUGE_PICTURE).toEqual({ w: 200, h: 96 });
    expect(REFUGE_PICTURE_TEX.w - 2 * REFUGE_PICTURE_TEX.originX).toBe(200);
    expect(REFUGE_PICTURE_TEX.h - 2 * REFUGE_PICTURE_TEX.originY).toBe(96);
    // The ink frame is the last stroke: its centreline sits half a line inside the 200 x 96 box.
    for (const paint of [
      (ctx: CanvasRenderingContext2D) => paintRefugeSection(ctx, 'canal', 'clean'),
      (ctx: CanvasRenderingContext2D) => paintRefugeSection(ctx, 'pond', 'dirty'),
      (ctx: CanvasRenderingContext2D) => paintRefugeSection(ctx, 'chinampa', 'clean'),
      paintRefugeHidden,
      paintRefugeTeaser,
    ]) {
      const frame = strokes(record(paint)).filter((s) => s.style === INK && s.lineWidth === LW).pop()!;
      const arcs = frame.cmds.filter((c) => c[0] === 'arcTo');
      expect(arcs.length).toBe(4);
      const xs = frame.cmds.flatMap((c) => (c.length > 2 ? [c[1], c[3] ?? c[1]] : []));
      const ys = frame.cmds.flatMap((c) => (c.length > 2 ? [c[2], c[4] ?? c[2]] : []));
      expect(Math.max(...xs) + LW / 2).toBeCloseTo(200, 6);
      expect(Math.max(...ys) + LW / 2).toBeCloseTo(96, 6);
      expect(Math.min(...xs) - LW / 2).toBeCloseTo(0, 6);
      expect(Math.min(...ys) - LW / 2).toBeCloseTo(0, 6);
    }
  });

  it('tells dirty from clean by shape: dirty has murk blotches, clean has plants and resting axolotls', () => {
    for (const look of HABITAT_LOOK_IDS) {
      const dirty = record((ctx) => paintRefugeSection(ctx, look, 'dirty'));
      const clean = record((ctx) => paintRefugeSection(ctx, look, 'clean'));
      expect(signature(dirty)).not.toBe(signature(clean));
      // The clean picture draws more ink shapes: plants, grass and two axolotls.
      expect(strokes(clean).length).toBeGreaterThan(strokes(dirty).length);
      // Resting axolotls: the Leucistic body fill appears only when clean.
      expect(fills(clean).some((f) => f.style === '#ffb7cf')).toBe(true);
      expect(fills(dirty).some((f) => f.style === '#ffb7cf')).toBe(false);
    }
  });

  it('looks different from one habitat to the next', () => {
    for (const state of REFUGE_ART_STATES) {
      const canal = record((ctx) => paintRefugeSection(ctx, 'canal', state));
      const pond = record((ctx) => paintRefugeSection(ctx, 'pond', state));
      const chinampa = record((ctx) => paintRefugeSection(ctx, 'chinampa', state));
      expect(signature(canal)).not.toBe(signature(pond));
      expect(signature(chinampa)).not.toBe(signature(canal));
      expect(signature(chinampa)).not.toBe(signature(pond));
    }
  });

  it('paints the chinampa as garden plots: bare when dirty, corn, marigolds and lettuce when clean', () => {
    const colours = (state: RefugeArtState): string[] =>
      fills(record((ctx) => paintRefugeSection(ctx, 'chinampa', state))).map((f) => f.style);
    const strokesOf = (state: RefugeArtState): string[] =>
      strokes(record((ctx) => paintRefugeSection(ctx, 'chinampa', state))).map((s) => s.style);
    for (const state of REFUGE_ART_STATES) {
      // Two plots (left and its mirror), each a soil body and a sunlit top, in both states.
      expect(colours(state).filter((c) => c === REFUGE_PLOT_SOIL)).toHaveLength(2);
      expect(colours(state).filter((c) => c === REFUGE_PLOT_TOP)).toHaveLength(2);
      // Willow roots reach into the water in both states.
      expect(strokesOf(state)).toContain(ROOT_TANGLE_BARK);
      expect(strokesOf(state)).toContain(WILLOW_TRUNK);
    }
    const crops = [REFUGE_CORN, REFUGE_COB, REFUGE_MARIGOLD, REFUGE_LETTUCE, WILLOW_FOLIAGE];
    const cropStyles = (state: RefugeArtState): string[] => [...colours(state), ...strokesOf(state)];
    for (const c of crops) {
      expect(cropStyles('dirty'), `dirty ${c}`).not.toContain(c);
      expect(cropStyles('clean'), `clean ${c}`).toContain(c);
    }
    expect(strokesOf('clean')).toContain(WILLOW_STRAND);
    expect(strokesOf('dirty')).not.toContain(WILLOW_STRAND);
    // The plots own no canal stone and no lily pad.
    expect(colours('clean')).not.toContain('#47ce5a');
    expect(colours('dirty').some((c) => ['#d4cfe6', '#a9bfd6', '#efdcba'].includes(c))).toBe(false);
  });

  it('paints the canal with stone banks and the pond with lily pads and cattails', () => {
    // Stones are ink ellipses in the pebble colours; the canal has sixteen, the pond none.
    const stones = (look: HabitatLookId): number =>
      fills(record((ctx) => paintRefugeSection(ctx, look, 'dirty'))).filter(
        (f) => ['#d4cfe6', '#a9bfd6', '#efdcba'].includes(f.style) && f.cmds.some((c) => c[0] === 'ellipse'),
      ).length;
    expect(stones('canal')).toBe(16);
    expect(stones('pond')).toBe(0);
    // Lily pads: green #47ce5a ellipses. The clean pond has four, the dirty pond two, the canal none.
    const pads = (look: HabitatLookId, state: RefugeArtState): number =>
      fills(record((ctx) => paintRefugeSection(ctx, look, state))).filter((f) => f.style === '#47ce5a').length;
    expect(pads('pond', 'clean')).toBe(4);
    expect(pads('pond', 'dirty')).toBe(2);
    expect(pads('canal', 'clean')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Contrast and tint
// ---------------------------------------------------------------------------

describe('section contrast (guide 10)', () => {
  it('keeps every colour that meets the ink frame at 3:1 or more with ink', () => {
    for (const look of HABITAT_LOOK_IDS) {
      for (const state of REFUGE_ART_STATES) {
        const colours = refugeBackdropColours(look, state);
        expect(colours.length).toBeGreaterThanOrEqual(5);
        for (const c of colours) {
          expect(isHex(c)).toBe(true);
          expect(contrast(INK, c), `${look} ${state} ${c}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('lists the chinampa plot colours as frame colours, each 3:1 or more with ink in both states', () => {
    for (const state of REFUGE_ART_STATES) {
      const colours = refugeBackdropColours('chinampa', state);
      for (const c of [REFUGE_PLOT_SOIL, REFUGE_PLOT_TOP, WILLOW_TRUNK, ROOT_TANGLE_BARK, WILLOW_FOLIAGE]) {
        expect(colours).toContain(c);
      }
    }
    // Printed in the soil comment: soil 3.90, plot top 5.38, trunk 3.24, roots 3.03.
    expect(contrast(INK, REFUGE_PLOT_SOIL).toFixed(2)).toBe('3.90');
    expect(contrast(INK, REFUGE_PLOT_TOP).toFixed(2)).toBe('5.38');
    expect(contrast(INK, WILLOW_TRUNK).toFixed(2)).toBe('3.24');
    expect(contrast(INK, ROOT_TANGLE_BARK).toFixed(2)).toBe('3.03');
  });

  it('keeps every colour a chinampa picture paints at 3:1 or more with ink, the murk blotches apart', () => {
    for (const state of REFUGE_ART_STATES) {
      const painted = record((ctx) => paintRefugeSection(ctx, 'chinampa', state));
      // The murk blotches stay inside the water, 14 px or more from the frame (as in every look),
      // and the bead eyes of the resting axolotls are dark by design.
      for (const f of fills(painted).filter((p) => isHex(p.style) && p.style !== REFUGE_MURK && p.style !== EYE)) {
        expect(contrast(INK, f.style), `${state} ${f.style}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('tints the dirty water grey-brown, away from the look clear water', () => {
    for (const look of HABITAT_LOOK_IDS) {
      const dirty = refugeDirtyWater(look);
      const clean = refugeCleanWater(look);
      for (const c of [dirty.top, dirty.bottom]) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
        expect(r).toBeGreaterThanOrEqual(b);
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(60);
      }
      expect(dirty.top).not.toBe(clean.top);
      expect(dirty.bottom).not.toBe(clean.bottom);
    }
  });

  it('blends a tint over a colour', () => {
    expect(blendHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(blendHex('#102030', '#102030', 0.9)).toBe('#102030');
  });
});

// ---------------------------------------------------------------------------
// Plants layer
// ---------------------------------------------------------------------------

describe('plants layer', () => {
  it('grows from its base: all the ink is above local y 0 (plus the base cap), and it differs per look', () => {
    const sigs = new Set<string>();
    for (const look of HABITAT_LOOK_IDS) {
      const painted = record((ctx) => paintRefugePlants(ctx, look));
      sigs.add(signature(painted));
      expect(strokes(painted).length).toBeGreaterThan(3);
    }
    expect(sigs.size).toBe(HABITAT_LOOK_IDS.length);
  });

  it('stands bottom-centre on the bed of a picture', () => {
    expect(REFUGE_PLANTS_BASE.x).toBe(REFUGE_PICTURE.w / 2);
    expect(REFUGE_PLANTS_BASE.y).toBeGreaterThan(78);
    expect(REFUGE_PLANTS_BASE.y).toBeLessThan(REFUGE_PICTURE.h);
  });

  it('keeps clear of the picture top band an area line may cover (issue #113, ND-8)', () => {
    // The plants frame (to its 60 px bound, before its padding) and every look's ink end below the band.
    expect(REFUGE_PLANTS_BASE.y - 60).toBeGreaterThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
    expect(REFUGE_PLANTS_TEX.originY).toBeLessThanOrEqual(64);
    for (const look of HABITAT_LOOK_IDS) {
      const top = paintedTop((ctx) => paintRefugePlants(ctx, look));
      expect(top, look).toBeGreaterThanOrEqual(-60);
      expect(REFUGE_PLANTS_BASE.y + top, look).toBeGreaterThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
    }
  });
});

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

describe('trash batches', () => {
  const batch = (variant: RefugeTrashVariant): Painted[] => record((ctx) => paintRefugeTrash(ctx, variant));

  it('has three variants that differ by shape (path operations), not colour alone', () => {
    expect([...REFUGE_TRASH_VARIANTS]).toEqual(['cans', 'bottles', 'bags']);
    const sigs = REFUGE_TRASH_VARIANTS.map((v) => signature(batch(v)));
    expect(new Set(sigs).size).toBe(3);
    const ops = Object.fromEntries(REFUGE_TRASH_VARIANTS.map((v) => [v, opNames(batch(v))]));
    // Cans: straight sides and an ellipse rim, no curves.
    expect(ops.cans.has('lineTo')).toBe(true);
    expect(ops.cans.has('ellipse')).toBe(true);
    expect(ops.cans.has('bezierCurveTo')).toBe(false);
    expect(ops.cans.has('quadraticCurveTo')).toBe(false);
    expect(ops.cans.has('arcTo')).toBe(false);
    // Bottles: a shoulder curve and a rounded base.
    expect(ops.bottles.has('quadraticCurveTo')).toBe(true);
    expect(ops.bottles.has('arcTo')).toBe(true);
    expect(ops.bottles.has('bezierCurveTo')).toBe(false);
    // Bags: a sack of bezier curves with handle loops.
    expect(ops.bags.has('bezierCurveTo')).toBe(true);
    expect(ops.bags.has('ellipse')).toBe(true);
    expect(ops.bags.has('arcTo')).toBe(false);
  });

  it('outlines every object in ink and keeps ink at 3:1 or more with every fill', () => {
    for (const variant of REFUGE_TRASH_VARIANTS) {
      const painted = batch(variant);
      const inks = strokes(painted).filter((s) => s.style === INK);
      expect(inks.length).toBeGreaterThanOrEqual(3);
      for (const s of inks) expect(s.lineWidth).toBeGreaterThanOrEqual(1.6);
      const solid = fills(painted).filter((f) => isHex(f.style));
      expect(solid.length).toBeGreaterThanOrEqual(3);
      for (const f of solid) expect(contrast(INK, f.style), `${variant} ${f.style}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('cycles the variants by batch index', () => {
    expect([0, 1, 2, 3, 4, 5].map(refugeTrashVariantAt)).toEqual(['cans', 'bottles', 'bags', 'cans', 'bottles', 'bags']);
    expect(refugeTrashVariantAt(-1)).toBe('bags');
  });

  it('gives slots in picture coordinates: left to right, in the water, clear of each other up to three', () => {
    expect(refugeTrashSlots(0)).toEqual([]);
    expect(refugeTrashSlots(-2)).toEqual([]);
    expect(refugeTrashSlots(Number.NaN)).toEqual([]);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const slots = refugeTrashSlots(n);
      expect(slots).toHaveLength(n);
      expect(slots).toEqual(refugeTrashSlots(n));
      for (const s of slots) {
        // The whole frame of a batch stays in the water: below the surface (22), above the bed (78), off the edges.
        expect(s.x - REFUGE_TRASH_TEX.originX).toBeGreaterThanOrEqual(0);
        expect(s.x + (REFUGE_TRASH_TEX.w - REFUGE_TRASH_TEX.originX)).toBeLessThanOrEqual(REFUGE_PICTURE.w);
        expect(s.y - 17).toBeGreaterThanOrEqual(22);
        expect(s.y + 17).toBeLessThanOrEqual(78);
      }
      for (let i = 1; i < n; i++) expect(slots[i].x).toBeGreaterThan(slots[i - 1].x);
    }
    expect(refugeTrashSlots(1)[0].x).toBe(100);
    const three = refugeTrashSlots(3);
    for (let i = 1; i < three.length; i++) expect(three[i].x - three[i - 1].x).toBeGreaterThanOrEqual(44);
  });

  it('keeps every trash and sparkle frame at rest below the picture top band an area line may cover (issue #113, ND-8)', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      for (const s of refugeTrashSlots(n)) {
        expect(s.y - REFUGE_TRASH_TEX.originY).toBeGreaterThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
        expect(s.y - REFUGE_SPARKLE_TEX.originY).toBeGreaterThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Hidden silhouette, teaser, sparkle
// ---------------------------------------------------------------------------

describe('hidden silhouette, teaser and sparkle', () => {
  it('draws the hidden section as one flat pebble tone with an ink "?" and no habitat', () => {
    const painted = record(paintRefugeHidden);
    const flat = fills(painted).filter((f) => isHex(f.style));
    expect(flat.map((f) => f.style)).toContain(REFUGE_HIDDEN_FILL);
    expect(contrast(INK, REFUGE_HIDDEN_FILL)).toBeGreaterThanOrEqual(9);
    // The "?" is an ink hook (arc and bezier) and a dot.
    expect(strokes(painted).some((s) => s.style === INK && s.cmds.some((c) => c[0] === 'arc') && s.cmds.some((c) => c[0] === 'bezierCurveTo'))).toBe(true);
    expect(fills(painted).some((f) => f.style === INK && f.cmds.some((c) => c[0] === 'ellipse'))).toBe(true);
    // No habitat shows through: nothing is painted in any look's water or bed colour.
    for (const look of HABITAT_LOOK_IDS) {
      for (const state of REFUGE_ART_STATES) {
        const colours = refugeBackdropColours(look, state).filter((c) => c !== REFUGE_HIDDEN_FILL);
        for (const f of fills(painted)) expect(colours).not.toContain(f.style);
      }
    }
    expect(signature(painted)).not.toBe(signature(record((ctx) => paintRefugeSection(ctx, 'canal', 'clean'))));
  });

  it('draws the teaser with a dashed ink outline, which no picture or silhouette has', () => {
    const seen: number[][] = [];
    vi.stubGlobal('Path2D', LogPath);
    const ctx = new Proxy({ lineWidth: 1, fillStyle: '', strokeStyle: '' } as Record<string, unknown>, {
      get: (t, k) => {
        const name = String(k);
        if (name in t) return t[name];
        if (name === 'setLineDash') return (d: number[]) => void seen.push(d);
        return () => undefined;
      },
      set: (t, k, v) => {
        t[String(k)] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    paintRefugeTeaser(ctx);
    expect(seen).toContainEqual([8, 6]);
    const painted = record(paintRefugeTeaser);
    expect(strokes(painted).some((s) => s.style === INK && s.lineWidth === LW)).toBe(true);
    expect(fills(painted).some((f) => f.style === WHITE)).toBe(true);
    // The silhouette and the pictures never dash.
    const dashed: number[][] = [];
    const plain = new Proxy({ lineWidth: 1, fillStyle: '', strokeStyle: '' } as Record<string, unknown>, {
      get: (t, k) => {
        const name = String(k);
        if (name in t) return t[name];
        if (name === 'setLineDash') return (d: number[]) => void dashed.push(d);
        if (name === 'createLinearGradient') return () => ({ addColorStop: () => undefined });
        return () => undefined;
      },
      set: (t, k, v) => {
        t[String(k)] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    paintRefugeHidden(plain);
    paintRefugeSection(plain, 'canal', 'dirty');
    paintRefugeSection(plain, 'pond', 'clean');
    paintRefugeSection(plain, 'chinampa', 'dirty');
    paintRefugeSection(plain, 'chinampa', 'clean');
    expect(dashed).toEqual([]);
  });

  it('draws the sparkle as a white 4-point star with an ink outline', () => {
    const painted = record(paintRefugeSparkle);
    expect(fills(painted).map((f) => f.style)).toEqual([WHITE]);
    const outline = strokes(painted)[0];
    expect(outline.style).toBe(INK);
    expect(outline.lineWidth).toBe(1.8);
    // Four rounded tips: four quadratic curves; four straight inner corners.
    expect(outline.cmds.filter((c) => c[0] === 'quadraticCurveTo')).toHaveLength(4);
    expect(contrast(INK, WHITE)).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Nudge badge
// ---------------------------------------------------------------------------

describe('refuge grew nudge badge (guide 10)', () => {
  const painted = record(paintRefugeNudge);

  it('has an ink outline: a pink disc inside an ink ring of 2.6 or more', () => {
    const disc = fills(painted).find((f) => f.style === REFUGE_NUDGE_FILL)!;
    expect(REFUGE_NUDGE_FILL).toBe(UI_ACCENT);
    expect(disc.cmds.some((c) => c[0] === 'ellipse')).toBe(true);
    const ring = strokes(painted).find((s) => s.cmds.some((c) => c[0] === 'ellipse'))!;
    expect(ring.style).toBe(INK);
    expect(ring.lineWidth).toBeGreaterThanOrEqual(2.6);
    // The ink edge is the badge size: radius of the centreline plus half the line.
    const ellipse = ring.cmds.find((c) => c[0] === 'ellipse')!;
    expect(ellipse[3] + ring.lineWidth / 2).toBeCloseTo(REFUGE_NUDGE_SIZE / 2, 6);
    expect(REFUGE_NUDGE_TEX.w - REFUGE_NUDGE_TEX.originX).toBeGreaterThanOrEqual(REFUGE_NUDGE_SIZE / 2);
  });

  it('reads without colour: a solid ink star on the disc, 4.5:1 or more, and ink on the pink', () => {
    const star = fills(painted).find((f) => f.style === INK)!;
    expect(star.cmds.filter((c) => c[0] === 'quadraticCurveTo')).toHaveLength(4);
    expect(contrast(INK, REFUGE_NUDGE_FILL)).toBeGreaterThanOrEqual(4.5);
  });

  it('fits the full hub tile and the 48 px icon-only tile, clear of the 32 px icon', () => {
    const r = REFUGE_NUDGE_SIZE / 2;
    for (const tile of [48, 64]) {
      const cx = tile - REFUGE_NUDGE_INSET;
      const cy = REFUGE_NUDGE_INSET;
      // Distance from the badge centre to the tile centre, minus the badge radius: the badge stays 8 px or more from the centre of the icon.
      const room = Math.hypot(tile / 2 - cx, tile / 2 - cy) - r;
      expect(room).toBeGreaterThanOrEqual(8);
    }
    // The badge is at least 20 px, so it stays readable on a 48 px tile.
    expect(REFUGE_NUDGE_SIZE).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Refuge icon
// ---------------------------------------------------------------------------

describe('refuge icon', () => {
  const icon = (kind: IconKind): Painted[] => record((ctx) => paintIcon(ctx, kind, 32));

  it('is painted in ink only, with strokes and no fills', () => {
    const painted = icon('refuge');
    expect(painted.length).toBeGreaterThanOrEqual(2);
    expect(fills(painted)).toHaveLength(0);
    for (const s of strokes(painted)) {
      expect(s.style).toBe(INK);
      expect(s.lineWidth).toBeGreaterThanOrEqual(3);
    }
  });

  it('differs from the home and decorate icons', () => {
    const refuge = signature(icon('refuge'));
    expect(refuge).not.toBe(signature(icon('home')));
    expect(refuge).not.toBe(signature(icon('decorate')));
  });

  it('is baked with the other icons', () => {
    expect(texturesSource).toMatch(/ICON_KINDS[^=]*=\s*\[[^\]]*'refuge'/);
  });
});

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

describe('bakeRefugeTextures', () => {
  it('bakes every part under its own key, 200 x 96 pictures in one frame', () => {
    const created: { key: string; w: number; h: number }[] = [];
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeRefugeTextures(fakeScene(created), 2);

    const keys = created.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    // 2 states + 1 plants per look, 3 trash, then hidden, teaser, sparkle and nudge.
    expect(keys).toHaveLength(HABITAT_LOOK_IDS.length * 3 + REFUGE_TRASH_VARIANTS.length + 4);
    for (const k of keys) expect(k.startsWith('refuge-')).toBe(true);

    const expected: string[] = [REFUGE_HIDDEN_KEY, REFUGE_TEASER_KEY, REFUGE_SPARKLE_KEY, REFUGE_NUDGE_KEY];
    for (const look of HABITAT_LOOK_IDS) {
      expected.push(refugePlantsKey(look));
      for (const state of REFUGE_ART_STATES) expected.push(refugeSectionKey(look, state));
    }
    for (const v of REFUGE_TRASH_VARIANTS) expected.push(refugeTrashKey(v));
    expect([...keys].sort()).toEqual([...expected].sort());

    const pictures = [
      art.hidden,
      art.teaser,
      ...HABITAT_LOOK_IDS.flatMap((look) => REFUGE_ART_STATES.map((state) => art.sections[look][state])),
    ];
    for (const info of pictures) {
      expect(info.w - 2 * info.originX).toBe(200);
      expect(info.h - 2 * info.originY).toBe(96);
      expect(info.pxW).toBe(pictures[0].pxW);
      expect(info.pxH).toBe(pictures[0].pxH);
      expect(info.originX).toBe(pictures[0].originX);
      expect(info.originY).toBe(pictures[0].originY);
    }
    expect(pictures[0].scale).toBe(2);
  });

  it('anchors the plants at the base and the trash, sparkle and badge at their centres', () => {
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeRefugeTextures(fakeScene([]), 2);
    for (const look of HABITAT_LOOK_IDS) {
      const info = art.plants[look];
      expect(info.originNormX).toBeCloseTo(0.5, 2);
      // The base is near the bottom of the frame: only the cap of the stalks is below it.
      expect(info.originNormY).toBeGreaterThan(0.85);
      expect(info.originNormY).toBeLessThan(1);
    }
    for (const v of REFUGE_TRASH_VARIANTS) {
      expect(art.trash[v].originNormX).toBeCloseTo(0.5, 1);
      expect(art.trash[v].originNormY).toBeCloseTo(0.5, 1);
    }
    expect(art.sparkle.originNormX).toBeCloseTo(0.5, 1);
    expect(art.nudge.originNormX).toBeCloseTo(0.5, 1);
    expect(art.nudge.originNormY).toBeCloseTo(0.5, 1);
  });
});
