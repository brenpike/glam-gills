/**
 * Area map marker art (issue #75, #76; guide 8 "Area map", 10). The Lily pad pond marker
 * is a notched lily pad in the disc's frame, and the Chinampa gardens marker is a garden
 * plot with hanging roots. Each habitat's panel and folder tab take its look's tint (issue #113,
 * ND-1, ND-4). Headless: the painters run against a
 * recording context and a stub Path2D, and the Phaser bake runs against a fake scene.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAP_BADGE_OFFSET,
  MAP_BADGE_R,
  MAP_CHINAMPA_PLOT,
  MAP_CHINAMPA_PLOT_FILL,
  MAP_FOCUS_WHITE_R,
  MAP_FOCUS_LW,
  MAP_HABITAT_TINTS,
  MAP_MARKER_D,
  MAP_MARKER_TEX,
  MAP_POND_PAD_FILL,
  MAP_POND_PAD_NOTCH,
  MAP_TAB_TEXT,
  mapHabitatTint,
  mapPanelSize,
  mapTabFeet,
  mapTabTextureSize,
  paintMapMarker,
  paintMapTab,
} from './drawAreaMap';
import {
  areaMapChinampaMarkerKey,
  areaMapMarkerKey,
  areaMapPondMarkerKey,
  areaMapTabKey,
  bakeAreaMapTab,
  bakeAreaMapTextures,
} from './areaMapTextures';
import { HABITAT_LOOK_IDS, type HabitatLookId } from './habitatLook';
import { INK, LW, UI_PRIMARY, WHITE } from './palette';

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

/** Hue of `hex` in degrees, 0 to 360. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  if (max === r) return ((((g - b) / d) % 6) * 60 + 360) % 360;
  if (max === g) return (((b - r) / d + 2) * 60 + 360) % 360;
  return (((r - g) / d + 4) * 60 + 360) % 360;
}

/** The map's page backdrop (guide 3d). */
const BACKDROP = '#0c6a8c';

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

/** Paint a marker and return every fill and stroke with the style it was made under. */
function paintMarker(locked: boolean, look?: HabitatLookId): Painted[] {
  return record((ctx) => paintMapMarker(ctx, locked, look));
}

/** Run `paint` against a recording context and return every fill and stroke with the style it was made under. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Painted[] {
  vi.stubGlobal('Path2D', LogPath);
  const out: Painted[] = [];
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ctx = new Proxy(state, {
    get: (target, key) => {
      const name = String(key);
      if (name in target) return target[name];
      return (path: LogPath) => {
        if (name === 'fill' || name === 'stroke') {
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

const fillOf = (painted: Painted[]): Painted => painted.find((p) => p.op === 'fill')!;
const strokeOf = (painted: Painted[]): Painted => painted.find((p) => p.op === 'stroke')!;

// ---------------------------------------------------------------------------
// Geometry: the pad outline as a polygon
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

/** The recorded outline as a polygon (arcs sampled every 0.01 rad). */
function polygonOf(cmds: Cmd[]): Pt[] {
  const pts: Pt[] = [];
  for (const [name, ...a] of cmds) {
    if (name === 'moveTo' || name === 'lineTo') pts.push([a[0], a[1]]);
    if (name === 'bezierCurveTo') {
      const [x0, y0] = pts[pts.length - 1];
      const [c1x, c1y, c2x, c2y, x1, y1] = a;
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        pts.push([
          u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
          u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
        ]);
      }
    }
    if (name === 'arc') {
      const [cx, cy, r, from, to] = a;
      const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 0.01));
      for (let i = 0; i <= steps; i++) {
        const t = from + ((to - from) * i) / steps;
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
    }
  }
  return pts;
}

function areaOf(poly: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function inside(poly: readonly Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Ink edge of the outline: centreline radius plus half the stroke. */
const RIM_R = MAP_MARKER_D / 2 - LW / 2;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('paintMapMarker look', () => {
  it('keeps the canal disc unchanged: full ellipse, #ffe14a unlocked and #ffffff locked, ink 3.5', () => {
    for (const look of [undefined, 'canal'] as const) {
      const unlocked = paintMarker(false, look);
      const locked = paintMarker(true, look);
      expect(fillOf(unlocked).style).toBe(UI_PRIMARY);
      expect(fillOf(locked).style).toBe(WHITE);
      for (const painted of [unlocked, locked]) {
        expect(strokeOf(painted).style).toBe(INK);
        expect(strokeOf(painted).lineWidth).toBe(LW);
        const ellipse = fillOf(painted).cmds.find((c) => c[0] === 'ellipse')!;
        expect(ellipse.slice(1, 4)).toEqual([0, 0, RIM_R]);
      }
    }
  });

  it('paints the pond pad in lily pad green unlocked and white locked, with ink 3.5', () => {
    const unlocked = paintMarker(false, 'pond');
    const locked = paintMarker(true, 'pond');
    expect(fillOf(unlocked).style).toBe(MAP_POND_PAD_FILL);
    expect(fillOf(locked).style).toBe(WHITE);
    for (const painted of [unlocked, locked]) {
      expect(strokeOf(painted).style).toBe(INK);
      expect(strokeOf(painted).lineWidth).toBe(LW);
      expect(strokeOf(painted).cmds).toEqual(fillOf(painted).cmds);
    }
  });

  it('keeps the pad as a green, not the disc yellow', () => {
    expect(MAP_POND_PAD_FILL).not.toBe(UI_PRIMARY);
    expect(luminance(MAP_POND_PAD_FILL)).toBeLessThan(luminance(UI_PRIMARY));
  });
});

describe('pond marker frame', () => {
  const pad = fillOf(paintMarker(false, 'pond')).cmds;
  const poly = polygonOf(pad);

  it('reaches 64 px to the ink edge, centred on (0, 0), inside the disc frame', () => {
    const arc = pad.find((c) => c[0] === 'arc')!;
    expect(arc.slice(1, 4)).toEqual([0, 0, RIM_R]);
    expect(RIM_R + LW / 2).toBe(MAP_MARKER_D / 2);
    // Rim points on the opposite side from the notch reach the full radius.
    const farthest = Math.max(...poly.map(([x, y]) => Math.hypot(x, y)));
    expect(farthest).toBeCloseTo(RIM_R, 6);
    // The frame is the disc's, so the pad's ink edge fits it and the anchor is the centre.
    expect(MAP_MARKER_TEX.originX).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
    expect(MAP_MARKER_TEX.originY).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
    expect(MAP_MARKER_TEX.w - MAP_MARKER_TEX.originX).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
    expect(MAP_MARKER_TEX.h - MAP_MARKER_TEX.originY).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
  });

  it('bakes pond and canal markers into one frame and anchor', () => {
    const baked: { key: string; w: number; h: number }[] = [];
    const scene = {
      textures: {
        exists: () => false,
        remove: () => undefined,
        createCanvas: (key: string, w: number, h: number) => {
          baked.push({ key, w, h });
          return {
            context: new Proxy({}, { get: () => () => undefined, set: () => true }),
            refresh: () => undefined,
          };
        },
      },
    };
    vi.stubGlobal('Path2D', LogPath);
    const art = bakeAreaMapTextures(scene as never, 2);
    const { canal, pond, chinampa } = art.markersByLook;
    expect(canal.unlocked).toBe(art.markerUnlocked);
    expect(canal.locked).toBe(art.markerLocked);
    expect(canal.unlocked.key).toBe(areaMapMarkerKey(false));
    expect(canal.locked.key).toBe(areaMapMarkerKey(true));
    expect(pond.unlocked.key).toBe(areaMapPondMarkerKey(false));
    expect(pond.locked.key).toBe(areaMapPondMarkerKey(true));
    expect(chinampa.unlocked.key).toBe(areaMapChinampaMarkerKey(false));
    expect(chinampa.locked.key).toBe(areaMapChinampaMarkerKey(true));
    expect(Object.keys(art.markersByLook).sort()).toEqual([...HABITAT_LOOK_IDS].sort());
    expect(new Set(baked.map((b) => b.key)).size).toBe(baked.length);
    for (const info of [pond.unlocked, pond.locked, canal.locked, chinampa.unlocked, chinampa.locked]) {
      expect(info.w).toBe(canal.unlocked.w);
      expect(info.h).toBe(canal.unlocked.h);
      expect(info.pxW).toBe(canal.unlocked.pxW);
      expect(info.pxH).toBe(canal.unlocked.pxH);
      expect(info.originX).toBe(canal.unlocked.originX);
      expect(info.originY).toBe(canal.unlocked.originY);
      expect(info.originNormX).toBe(canal.unlocked.originNormX);
      expect(info.originNormY).toBe(canal.unlocked.originNormY);
    }
  });
});

describe('pond marker contrast (guide 10)', () => {
  it('keeps the bold ink number at 4.5:1 or more on both fills', () => {
    expect(contrast(INK, MAP_POND_PAD_FILL)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('passes 3:1 against the backdrop by its fill, as the canal markers do', () => {
    expect(contrast(MAP_POND_PAD_FILL, BACKDROP)).toBeGreaterThanOrEqual(3);
    expect(contrast(WHITE, BACKDROP)).toBeGreaterThanOrEqual(3);
  });

  it('is a lily pad green: hue between 100 and 150 degrees, the pad greens of the pond art', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(MAP_POND_PAD_FILL.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    expect(max).toBe(g);
    const hue = (((b - r) / d + 2) * 60 + 360) % 360;
    expect(hue).toBeGreaterThan(100);
    expect(hue).toBeLessThan(150);
  });
});

describe('pond marker notch (greyscale shape cue)', () => {
  const pad = fillOf(paintMarker(false, 'pond')).cmds;
  const poly = polygonOf(pad);
  const discArea = Math.PI * RIM_R * RIM_R;

  it('cuts a real wedge: the arc stops short of a full turn and the outline runs in to a tip', () => {
    const { centreAngle, halfAngle, tipR } = MAP_POND_PAD_NOTCH;
    const arc = pad.find((c) => c[0] === 'arc')!;
    expect(arc[5] - arc[4]).toBeCloseTo(Math.PI * 2 - 2 * halfAngle, 9);
    expect(pad.some((c) => c[0] === 'lineTo')).toBe(true);
    expect(pad[0][0]).toBe('moveTo');
    expect(pad[0][1]).toBeCloseTo(Math.cos(centreAngle) * tipR, 9);
    expect(pad[0][2]).toBeCloseTo(Math.sin(centreAngle) * tipR, 9);
    expect(pad[pad.length - 1][0]).toBe('closePath');
  });

  it('removes at least 5% of the disc, so the silhouette differs from the disc without colour', () => {
    const removed = 1 - areaOf(poly) / discArea;
    expect(removed).toBeGreaterThanOrEqual(0.05);
    // Not so much that it stops reading as a round pad.
    expect(removed).toBeLessThanOrEqual(0.2);
  });

  it('opens a gap in the rim wide enough to see after the ink strokes either side', () => {
    const { halfAngle } = MAP_POND_PAD_NOTCH;
    const opening = 2 * RIM_R * Math.sin(halfAngle);
    expect(opening).toBeGreaterThanOrEqual(2 * LW + 8);
  });

  it('is empty at the notch and filled at the opposite rim', () => {
    const { centreAngle, tipR } = MAP_POND_PAD_NOTCH;
    const probe = (r: number, angle: number): boolean => inside(poly, Math.cos(angle) * r, Math.sin(angle) * r);
    const midway = (tipR + RIM_R) / 2;
    expect(probe(midway, centreAngle)).toBe(false);
    expect(probe(RIM_R - 1, centreAngle)).toBe(false);
    expect(probe(RIM_R - 1, centreAngle + Math.PI)).toBe(true);
    expect(probe(tipR - 2, centreAngle)).toBe(true);
  });

  it('leaves the number box (a two-digit number, 34 x 28, centred) wholly on the fill, inked tip included', () => {
    const { tipR } = MAP_POND_PAD_NOTCH;
    for (const [x, y] of [
      [-17, -14],
      [17, -14],
      [-17, 14],
      [17, 14],
      [0, 0],
    ] as const) {
      expect(inside(poly, x, y)).toBe(true);
    }
    // The inked tip reaches tipR - LW / 2 from the centre; the box bottom edge is at y 14.
    expect(tipR - LW / 2).toBeGreaterThan(14);
  });

  it('keeps the notch clear of the padlock badge (upper right) and the New! pill (top)', () => {
    const { centreAngle } = MAP_POND_PAD_NOTCH;
    // Straight down is the angle PI / 2; the badge sits at -45 degrees and the pill at -90.
    expect(Math.sin(centreAngle)).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// Chinampa gardens marker (issue #76)
// ---------------------------------------------------------------------------

describe('chinampa marker look', () => {
  it('paints the garden plot in marigold orange unlocked and white locked, with ink 3.5', () => {
    const unlocked = paintMarker(false, 'chinampa');
    const locked = paintMarker(true, 'chinampa');
    expect(fillOf(unlocked).style).toBe(MAP_CHINAMPA_PLOT_FILL);
    expect(fillOf(locked).style).toBe(WHITE);
    for (const painted of [unlocked, locked]) {
      expect(strokeOf(painted).style).toBe(INK);
      expect(strokeOf(painted).lineWidth).toBe(LW);
      expect(strokeOf(painted).cmds).toEqual(fillOf(painted).cmds);
    }
  });

  it('is its own marker: not the canal disc and not the lily pad, for every look', () => {
    const sigs = HABITAT_LOOK_IDS.map((look) => JSON.stringify(fillOf(paintMarker(false, look)).cmds));
    expect(new Set(sigs).size).toBe(HABITAT_LOOK_IDS.length);
    const chinampa = fillOf(paintMarker(false, 'chinampa')).cmds;
    // No ellipse (the disc) and no full-radius arc round the centre (the pad): straight edges, corner arcs and root curves.
    expect(chinampa.some((c) => c[0] === 'ellipse')).toBe(false);
    expect(chinampa.filter((c) => c[0] === 'arc').every((c) => c[3] === MAP_CHINAMPA_PLOT.corner)).toBe(true);
    expect(chinampa.filter((c) => c[0] === 'bezierCurveTo')).toHaveLength(MAP_CHINAMPA_PLOT.rootXs.length);
    // Every look has a marker painter: an unknown look throws and never falls back to the canal.
    expect(() => paintMarker(false, 'volcano' as HabitatLookId)).toThrow(RangeError);
  });

  it('keeps the plot orange, not the disc yellow or the pad green', () => {
    expect(MAP_CHINAMPA_PLOT_FILL).not.toBe(UI_PRIMARY);
    expect(MAP_CHINAMPA_PLOT_FILL).not.toBe(MAP_POND_PAD_FILL);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(MAP_CHINAMPA_PLOT_FILL.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    expect(max).toBe(r);
    const hue = (((g - b) / d) * 60 + 360) % 360;
    expect(hue).toBeGreaterThan(20);
    expect(hue).toBeLessThan(45);
  });
});

describe('chinampa marker contrast (guide 10)', () => {
  it('keeps the bold ink number at 4.5:1 or more on both fills', () => {
    expect(contrast(INK, MAP_CHINAMPA_PLOT_FILL)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK, MAP_CHINAMPA_PLOT_FILL).toFixed(2)).toBe('7.80');
  });

  it('passes 3:1 against the backdrop by its fill, as the other markers do', () => {
    expect(contrast(MAP_CHINAMPA_PLOT_FILL, BACKDROP)).toBeGreaterThanOrEqual(3);
    expect(contrast(MAP_CHINAMPA_PLOT_FILL, BACKDROP).toFixed(2)).toBe('3.29');
    expect(contrast(WHITE, BACKDROP)).toBeGreaterThanOrEqual(3);
  });
});

describe('chinampa marker frame and silhouette (greyscale shape cue)', () => {
  const plot = fillOf(paintMarker(false, 'chinampa')).cmds;
  const poly = polygonOf(plot);
  const { halfW, halfH, rootXs, rootHalfW } = MAP_CHINAMPA_PLOT;
  const discArea = Math.PI * RIM_R * RIM_R;

  it('fits the 64 px frame: ink edges 60 wide and 48 tall, roots about 31 below the centre', () => {
    expect(halfW + LW / 2).toBe(30);
    expect(halfH + LW / 2).toBe(24);
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    expect(Math.max(...xs) + LW / 2).toBeCloseTo(30, 6);
    expect(Math.min(...xs) - LW / 2).toBeCloseTo(-30, 6);
    expect(Math.min(...ys) - LW / 2).toBeCloseTo(-24, 6);
    expect(Math.max(...ys) + LW / 2).toBeGreaterThan(30);
    expect(Math.max(...ys) + LW / 2).toBeLessThanOrEqual(MAP_MARKER_D / 2);
    // Every point of the inked outline sits inside the frame the disc uses.
    expect(MAP_MARKER_TEX.originX).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
    expect(MAP_MARKER_TEX.originY).toBeGreaterThanOrEqual(MAP_MARKER_D / 2);
  });

  it('stays clear of the focus ring: every outline point and its ink is inside the ring white line', () => {
    const ringInner = MAP_FOCUS_WHITE_R - MAP_FOCUS_LW / 2;
    const farthest = Math.max(...poly.map(([x, y]) => Math.hypot(x, y))) + LW / 2;
    expect(farthest).toBeLessThanOrEqual(ringInner);
  });

  it('is clear of the padlock badge where it matters: the badge covers the upper right corner as it does the disc', () => {
    // The corner point of the plot's top right is inside the badge disc, like the disc's 45 degree point.
    const corner = { x: halfW, y: -halfH };
    const d = Math.hypot(corner.x - MAP_BADGE_OFFSET.x, corner.y - MAP_BADGE_OFFSET.y);
    expect(d).toBeLessThanOrEqual(MAP_BADGE_R + LW / 2 + 2);
  });

  it('is a clearly different silhouette from the disc: straight sides, corners and roots, in area and extent', () => {
    // Wider than tall in its body, which a disc never is.
    expect(2 * halfW).toBeGreaterThan(2 * halfH);
    const area = areaOf(poly);
    expect(area).toBeLessThan(0.9 * discArea);
    expect(area).toBeGreaterThan(0.6 * discArea);
    // The rim of the disc is at the full radius all round; the plot's top edge is one flat line, 8 px or more inside it at the middle.
    expect(poly[0][1]).toBe(-halfH);
    expect(poly[1][1]).toBe(-halfH);
    expect(poly[1][0] - poly[0][0]).toBeGreaterThan(30);
    expect(RIM_R - halfH).toBeGreaterThanOrEqual(6);
  });

  it('hangs three roots below the bottom edge, each wide enough to see after the ink strokes either side', () => {
    expect(rootXs).toHaveLength(3);
    for (const x of rootXs) {
      const rootBottom = Math.max(...poly.filter(([px]) => Math.abs(px - x) < 0.5).map(([, y]) => y));
      expect(rootBottom - halfH).toBeGreaterThanOrEqual(6);
      expect(2 * rootHalfW).toBeGreaterThanOrEqual(LW + 4);
      expect(inside(poly, x, halfH + 2)).toBe(true);
    }
    // Between two roots the outline stays on the bottom edge.
    expect(inside(poly, (rootXs[0] + rootXs[1]) / 2, halfH + 2)).toBe(false);
    // The roots stay clear of the plot's corner arcs.
    for (const x of rootXs) expect(Math.abs(x) + rootHalfW).toBeLessThanOrEqual(halfW - MAP_CHINAMPA_PLOT.corner);
  });

  it('leaves the number box (a two-digit number, 34 x 28, centred) wholly on the fill, inked edge included', () => {
    for (const [x, y] of [
      [-17, -14],
      [17, -14],
      [-17, 14],
      [17, 14],
      [0, 0],
    ] as const) {
      expect(inside(poly, x, y)).toBe(true);
    }
    // The inked top and bottom edges are 3.5 / 2 inside the outline; the box is 14 from the centre.
    expect(halfH - LW / 2).toBeGreaterThan(14);
    expect(halfW - LW / 2).toBeGreaterThan(17);
  });
});

// ---------------------------------------------------------------------------
// Habitat panels and tabs (issue #113)
// ---------------------------------------------------------------------------

describe('habitat tints (issue #113, ND-4; guide 10)', () => {
  const markerFill = (look: HabitatLookId): string => fillOf(paintMarker(false, look)).style;

  it('has one tint per habitat look, each a hex colour, and mapHabitatTint returns it', () => {
    expect(Object.keys(MAP_HABITAT_TINTS).sort()).toEqual([...HABITAT_LOOK_IDS].sort());
    for (const look of HABITAT_LOOK_IDS) {
      expect(MAP_HABITAT_TINTS[look]).toMatch(/^#[0-9a-f]{6}$/);
      expect(mapHabitatTint(look)).toBe(MAP_HABITAT_TINTS[look]);
    }
    expect(new Set(Object.values(MAP_HABITAT_TINTS)).size).toBe(HABITAT_LOOK_IDS.length);
  });

  it('throws for an unknown look, so none falls back to the canal tint', () => {
    expect(() => mapHabitatTint('volcano' as HabitatLookId)).toThrow(RangeError);
  });

  it('keeps the bold ink label at 4.5:1 or more on every tint', () => {
    for (const look of HABITAT_LOOK_IDS) {
      expect(contrast(INK, mapHabitatTint(look)), look).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps every tint at 3:1 or more against the backdrop, so each panel edge passes by its fill', () => {
    for (const look of HABITAT_LOOK_IDS) {
      expect(contrast(mapHabitatTint(look), BACKDROP), look).toBeGreaterThanOrEqual(3);
    }
  });

  it('makes each tint a lighter shade of its own unlocked marker fill, hue within 5 degrees', () => {
    for (const look of HABITAT_LOOK_IDS) {
      const tint = mapHabitatTint(look);
      const fill = markerFill(look);
      expect(luminance(tint), look).toBeGreaterThan(luminance(fill));
      const apart = Math.abs(hueOf(tint) - hueOf(fill));
      expect(Math.min(apart, 360 - apart), look).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the tab label measure: bold ink 20 px, padding 8 across and 4 down, 32 tall or more', () => {
    expect(MAP_TAB_TEXT).toEqual({ padX: 8, padY: 4, minH: 32, fontPx: 20 });
    expect(mapPanelSize(100, 24, MAP_TAB_TEXT)).toEqual({ w: 116, h: 32 });
    expect(mapPanelSize(100, 48, MAP_TAB_TEXT)).toEqual({ w: 116, h: 56 });
  });
});

describe('habitat folder tab (issue #113, ND-1)', () => {
  const W = 160;
  const H = 32;
  const tint = MAP_HABITAT_TINTS.pond;
  const tab = (feet = { left: 0, right: 0 }): Painted[] => record((ctx) => paintMapTab(ctx, W, H, tint, feet));

  it('fills in the tint and strokes one ink 3.5 line', () => {
    const painted = tab();
    expect(painted.filter((p) => p.op === 'fill')).toHaveLength(1);
    expect(painted.filter((p) => p.op === 'stroke')).toHaveLength(1);
    expect(fillOf(painted).style).toBe(tint);
    expect(strokeOf(painted).style).toBe(INK);
    expect(strokeOf(painted).lineWidth).toBe(LW);
  });

  it('rounds the top corners and leaves the bottom open: the ink runs up one side, over the top and down the other', () => {
    const line = strokeOf(tab()).cmds;
    expect(line[0]).toEqual(['moveTo', 0, H]);
    expect(line[line.length - 1]).toEqual(['lineTo', W, H]);
    expect(line.some((c) => c[0] === 'closePath')).toBe(false);
    expect(line.filter((c) => c[0] === 'arcTo')).toHaveLength(2);
    const poly = polygonOf(line);
    // No ink along the bottom: only the two side ends sit at the bottom edge.
    expect(poly.filter(([, y]) => y >= H)).toHaveLength(2);
    expect(Math.min(...poly.map(([, y]) => y))).toBe(0);
  });

  it('fills one line width past the bottom, so it hides the panel top line under the tab', () => {
    const body = fillOf(tab()).cmds;
    expect(body.some((c) => c[0] === 'closePath')).toBe(true);
    const ys = polygonOf(body).map(([, y]) => y);
    expect(Math.max(...ys)).toBe(H + LW);
    expect(body.some((c) => c[0] === 'rect')).toBe(false);
  });

  it('runs each side down to its foot and squares off the panel corner under it', () => {
    const feet = { left: 18, right: 5 };
    const painted = tab(feet);
    const line = strokeOf(painted).cmds;
    expect(line[0]).toEqual(['moveTo', 0, H + feet.left]);
    expect(line[line.length - 1]).toEqual(['lineTo', W, H + feet.right]);
    const rects = fillOf(painted).cmds.filter((c) => c[0] === 'rect');
    expect(rects).toEqual([
      ['rect', 0, H, 18, feet.left + LW],
      ['rect', W - 18, H, 18, feet.right + LW],
    ]);
  });

  it('gives a foot only where a side stands over a rounded panel corner', () => {
    const panel = { x: 100, y: 200, w: 400, h: 140 };
    const flushLeft = mapTabFeet({ x: 100, y: 168, w: 200, h: 32 }, panel);
    expect(flushLeft.left).toBeCloseTo(18, 9);
    expect(flushLeft.right).toBe(0);
    const flushBoth = mapTabFeet({ x: 100, y: 168, w: 400, h: 32 }, panel);
    expect(flushBoth.left).toBeCloseTo(18, 9);
    expect(flushBoth.right).toBeCloseTo(18, 9);
    const nearRight = mapTabFeet({ x: 100, y: 168, w: 390, h: 32 }, panel);
    expect(nearRight.right).toBeCloseTo(18 - Math.sqrt(18 * 18 - 8 * 8), 9);
    // A tab wider than its panel has no foot past the panel's end.
    expect(mapTabFeet({ x: 100, y: 168, w: 420, h: 32 }, panel).right).toBe(0);
    // A short panel's corner radius is half its height.
    expect(mapTabFeet({ x: 0, y: 0, w: 50, h: 32 }, { x: 0, y: 32, w: 200, h: 20 }).left).toBeCloseTo(10, 9);
  });

  it('bakes under its role key in a frame that holds the feet and the ink, anchored at the top-left corner', () => {
    const baked: { key: string; w: number; h: number }[] = [];
    const scene = {
      textures: {
        exists: () => false,
        remove: () => undefined,
        createCanvas: (key: string, w: number, h: number) => {
          baked.push({ key, w, h });
          return {
            context: new Proxy({}, { get: () => () => undefined, set: () => true }),
            refresh: () => undefined,
          };
        },
      },
    };
    vi.stubGlobal('Path2D', LogPath);
    const feet = { left: 18, right: 0 };
    const info = bakeAreaMapTab(scene as never, areaMapTabKey('habitat-0'), tint, W, H, feet, 2);
    expect(info.key).toBe('area-map-tab-habitat-0');
    expect(baked.map((b) => b.key)).toEqual([info.key]);
    const frame = mapTabTextureSize(W, H, feet);
    expect(frame.originX).toBeGreaterThanOrEqual(LW / 2);
    expect(frame.originY).toBeGreaterThanOrEqual(LW / 2);
    expect(frame.w - frame.originX).toBeGreaterThanOrEqual(W + LW / 2);
    expect(frame.h - frame.originY).toBeGreaterThanOrEqual(H + feet.left + LW);
    expect(info.originX).toBe(frame.originX);
    expect(info.originY).toBe(frame.originY);
  });
});
