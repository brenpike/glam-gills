/**
 * Area map painters (issue #73, guide 8 "Area map", 4b, 7g, 10). The map shows
 * one marker per area on a winding path, so this file holds the parts the scene
 * stacks: the path tube, the marker disc (unlocked and locked), the padlock
 * badge, the "New!" pill, the focus ring, the star row and the text panels.
 *
 * Every painter is a still frame (no time, no randomness, no game state), so
 * each one is also the reduced-motion version. The path's draw-in, the pill's
 * bob and the scroll are the scene's job; {@link paintMapPath} takes a fraction
 * so a scene may re-bake a growing path, and {@link mapPathPolyline} gives the
 * points for a scene that strokes the growth itself.
 *
 * Text is not drawn here: the area number (bold ink 28 px), the "New!" word
 * (bold ink 18 px), the habitat labels (bold ink 20 px, on their tabs), the
 * title (bold ink 28 px) and the message line (bold ink 20 px) are scene text,
 * laid over these shapes, as for buttons (drawUi.ts). The sizes below are what
 * the guide fixes.
 *
 * Colours are the 3d set: backdrop #0c6a8c (LETTERBOX, the scene's), path
 * #55e4d8, unlocked marker #ffe14a, locked marker and every badge disc and
 * panel #ffffff, message #ffd9e6, "New!" pill #ff82bf, ink #2b2350; plus the
 * look marker fills below and one habitat tint per look ({@link MAP_HABITAT_TINTS}).
 *
 * Habitat panels (issue #113, ND-1, ND-4, ND-7): each run of a habitat's areas sits on a rounded
 * panel ({@link paintMapPanel}) in its look's tint, a light shade of the look's unlocked marker
 * fill, with the ink line; its label sits on a folder tab ({@link paintMapTab}) on the panel's top
 * edge, in the same tint, its open bottom merging into the panel. Grouping never reads by colour
 * alone (X2): the panel's ink outline, the tab label and the marker shapes carry it.
 *
 * Contrast and greyscale (guide 10): locked is told from unlocked by the padlock
 * badge, never by fill (#ffe14a and #ffffff are only 1.30:1 apart); earned is
 * told from missing by the filled against the dashed star; "New!" by its word.
 * Ink on the white badge disc is 14.39:1. Each marker edge passes 3:1 against
 * the backdrop by its fill (4.66:1 and 6.08:1), and the focus ring's white line
 * is 6.08:1. The path (3.90:1) is decorative: the numbers carry the order.
 *
 * The Lily pad pond marker (issue #75) is a notched lily pad in place of the
 * disc, same frame, anchor, size (64 to the ink edge) and ink (3.5). Unlocked it
 * is lily pad green {@link MAP_POND_PAD_FILL} (7.49:1 with ink, and 3.16:1 against
 * the backdrop, so the edge passes 3:1 by its fill as the canal markers do); locked
 * it is white, as the canal locked disc. The notch, a wedge cut into the lower rim,
 * is the shape cue apart from the disc (greyscale, guide 10); the padlock badge
 * still marks locked. It stops short of the number (bold ink 28 px, centred), so
 * ink on the fill stays 7.49:1 unlocked and 14.39:1 locked.
 *
 * The Chinampa gardens marker (issue #76) is a garden plot in place of the disc: a wide
 * rounded rectangle with three roots hanging from its lower edge, same frame, anchor and
 * ink (3.5). It reaches 60 wide and 48 tall to the ink edge, and the root tips about 31 below
 * the centre, so it stays inside the 64 px frame and clear of the focus ring (its corners reach
 * 33.7 from the centre, the ring's inner edge is 33.75) and the star row. Unlocked it is marigold orange {@link MAP_CHINAMPA_PLOT_FILL}
 * (7.80:1 with ink, and 3.29:1 against the backdrop, so the edge passes 3:1 by its fill);
 * locked it is white. The straight top and sides, the sharp corners and the hanging roots
 * are the shape cue apart from the round disc and the notched pad (greyscale, guide 10);
 * the padlock badge still marks locked.
 *
 * Sizes are to the outer ink edge, as the guide gives them. Every value is
 * `derived (provisional)`. Presentational only: no Phaser, and no import from
 * src/logic.
 */
import { TAU, ell, frameFromBounds, inkMany, seg, shape, type TexSize } from './canvasKit';
import { paintAreaStar } from './drawArea';
import { paintIcon } from './drawUi';
import type { HabitatLookId } from './habitatLook';
import { INK, LW, UI_ACCENT, UI_PANEL, UI_PANEL_PINK, UI_PRIMARY, UI_SECONDARY, WHITE } from './palette';

// ---------------------------------------------------------------------------
// Marker cell
// ---------------------------------------------------------------------------

/**
 * The room one marker needs, logical px, top-left origin: a 12 px slot for the
 * "New!" pill, the 64 px marker, 12 px, then the star row.
 */
export const MAP_CELL = { w: 80, h: 112 } as const;
/** Height of the slot above the marker that holds the "New!" pill. */
export const MAP_PILL_SLOT_H = 12;
/** Marker disc diameter to the outer ink edge. Its tap target is this square. */
export const MAP_MARKER_D = 64;
/** The marker centre in the cell (40, 44): the origin of the marker, ring and badge textures. */
export const MAP_MARKER_CENTRE = { x: MAP_CELL.w / 2, y: MAP_PILL_SLOT_H + MAP_MARKER_D / 2 } as const;
/** Gap between the marker's ink edge and the star row. */
export const MAP_MARKER_STAR_GAP = 12;

/** Area star size in the row (the 7g 24 box) and the gap between stars. */
export const MAP_STAR_SIZE = 24;
export const MAP_STAR_GAP = 4;
/** Stars on an area (PRD H5). */
export const MAP_STAR_COUNT = 3;
/** Star row width: three 24 px stars with two 4 px gaps, the cell width (80). */
export const MAP_STAR_ROW_W = MAP_STAR_COUNT * MAP_STAR_SIZE + (MAP_STAR_COUNT - 1) * MAP_STAR_GAP;
/** The star row centre in the cell (40, 100): the origin of the star row textures. */
export const MAP_STAR_ROW_CENTRE = {
  x: MAP_CELL.w / 2,
  y: MAP_MARKER_CENTRE.y + MAP_MARKER_D / 2 + MAP_MARKER_STAR_GAP + MAP_STAR_SIZE / 2,
} as const;

/** The padlock badge: a white disc r 12 to the outer ink edge, centred (24, -24) from the marker centre. */
export const MAP_BADGE_R = 12;
export const MAP_BADGE_OFFSET = { x: 24, y: -24 } as const;
/** The 7g lock icon box inside the badge. */
export const MAP_BADGE_ICON_SIZE = 18;
/** Ink ring of the badge, as the plus badge (4b). */
const BADGE_LW = 2.6;

/** The "New!" pill, 56 x 24 to the outer ink edge, centred on the marker's top ink edge, i.e. at (40, 12) in the cell. */
export const MAP_PILL = { w: 56, h: 24 } as const;
export const MAP_PILL_CENTRE = { x: MAP_CELL.w / 2, y: MAP_PILL_SLOT_H } as const;
/** Pill ink outline (`shape`), as the max mark (4b). */
const PILL_LW = 2.6;

/**
 * Focus ring (guide 8, double ring): circles about the marker centre, each a 3 px
 * line, white at radius 35.25 and ink at 38.25, both opaque. Drawn over the
 * marker and under its badge and pill.
 */
export const MAP_FOCUS_LW = 3;
export const MAP_FOCUS_WHITE_R = 35.25;
export const MAP_FOCUS_INK_R = 38.25;

/** Marker ink outline (`shape`), 4b. */
const MARKER_LW = LW;
/** Radius of the marker's outline centreline: the ink edge sits at 32. */
const MARKER_LINE_R = MAP_MARKER_D / 2 - MARKER_LW / 2;

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

/** Path tube (4b): colour width 10, outline 2.6 each side, #55e4d8. */
export const MAP_PATH_W = 10;
export const MAP_PATH_OL = 2.6;
/** Total ink width of the path (10 + 2 x 2.6). */
export const MAP_PATH_INK_W = MAP_PATH_W + 2 * MAP_PATH_OL;

/** A point in map space (the same space as the marker centres). */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A smooth curve through `points` in order (Catmull-Rom, passing through every
 * point), sampled as a polyline with `perSegment` steps between neighbours.
 * One point gives that point; none gives an empty list. Pure.
 */
export function mapPathPolyline(points: readonly MapPoint[], perSegment = 16): MapPoint[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: MapPoint[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 1; s <= perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

/** The part of a polyline within `fraction` (0..1) of its length from the start. */
function truncatePolyline(poly: readonly MapPoint[], fraction: number): MapPoint[] {
  if (fraction >= 1) return [...poly];
  let total = 0;
  for (let i = 1; i < poly.length; i++) total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  let left = Math.max(0, fraction) * total;
  const out: MapPoint[] = poly.length > 0 ? [poly[0]] : [];
  for (let i = 1; i < poly.length; i++) {
    const len = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
    if (left >= len) {
      out.push(poly[i]);
      left -= len;
      continue;
    }
    const k = len === 0 ? 0 : left / len;
    out.push({ x: poly[i - 1].x + (poly[i].x - poly[i - 1].x) * k, y: poly[i - 1].y + (poly[i].y - poly[i - 1].y) * k });
    break;
  }
  return out;
}

/**
 * Texture frame for the path through `points`. The anchor is map space (0, 0):
 * place the sprite at the map origin and the path lines up with the markers.
 */
export function mapPathTextureSize(points: readonly MapPoint[]): TexSize {
  const poly = mapPathPolyline(points);
  if (poly.length === 0) return { w: 1, h: 1, originX: 0, originY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const r = MAP_PATH_INK_W / 2;
  // originX / originY may be negative: the anchor is map space (0, 0), wherever the frame sits
  return frameFromBounds(minX - r, minY - r, maxX + r, maxY + r, 1);
}

/**
 * Paint the path tube through `points` (map space; use {@link mapPathTextureSize}
 * for the frame). `fraction` (default 1) paints only that share of the path's
 * length from the first marker, with a round end, for the draw-in. Under it the
 * markers; the tube is ink-outlined and the outline merges at bends (4c).
 */
export function paintMapPath(ctx: CanvasRenderingContext2D, points: readonly MapPoint[], fraction = 1): void {
  if (points.length < 2 || fraction <= 0) return;
  const poly = truncatePolyline(mapPathPolyline(points), fraction);
  const path = new Path2D();
  path.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) path.lineTo(poly[i].x, poly[i].y);
  inkMany(ctx, [seg(path, MAP_PATH_W, UI_SECONDARY, MAP_PATH_OL)]);
}

// ---------------------------------------------------------------------------
// Marker, ring, badge, pill
// ---------------------------------------------------------------------------

/** Texture frame for a marker disc. Anchor is the disc centre. */
export const MAP_MARKER_TEX: TexSize = frameFromBounds(
  -MAP_MARKER_D / 2,
  -MAP_MARKER_D / 2,
  MAP_MARKER_D / 2,
  MAP_MARKER_D / 2,
  1,
);

/**
 * Unlocked Lily pad pond marker fill: lily pad green, the pond art's #47ce5a
 * lightened a little so the marker edge reaches 3:1 against the #0c6a8c backdrop
 * (3.16:1; #47ce5a itself is 2.96:1). Ink 2b2350 on it is 7.49:1. Derived (provisional).
 */
export const MAP_POND_PAD_FILL = '#4fd462';

/**
 * The pad's notch (derived, provisional): a wedge cut into the rim, opening at
 * `centreAngle` (canvas radians, y down: PI / 2 is straight down, where nothing
 * else hangs but the star row 12 px away), `halfAngle` each side of it at the
 * rim, narrowing to a tip `tipR` from the centre. The tip stops 21 px out, 7 px
 * clear of the number's box (a two-digit number is about 34 x 28), so the
 * number never sits on the cut.
 */
export const MAP_POND_PAD_NOTCH = { centreAngle: Math.PI / 2, halfAngle: 0.5, tipR: 21 } as const;

/** The lily pad outline (centreline) as a closed path: the long way round the rim, in to the notch tip, out again. */
function lilyPadPath(): Path2D {
  const { centreAngle, halfAngle, tipR } = MAP_POND_PAD_NOTCH;
  const start = centreAngle + halfAngle;
  const p = new Path2D();
  p.moveTo(Math.cos(centreAngle) * tipR, Math.sin(centreAngle) * tipR);
  p.lineTo(Math.cos(start) * MARKER_LINE_R, Math.sin(start) * MARKER_LINE_R);
  p.arc(0, 0, MARKER_LINE_R, start, start + TAU - 2 * halfAngle);
  p.closePath();
  return p;
}

/**
 * Unlocked Chinampa gardens marker fill: marigold orange (cempasuchil), the flower of
 * the gardens. Ink 2b2350 on it is 7.80:1, and against the #0c6a8c backdrop it is
 * 3.29:1, so the marker edge passes 3:1 by its fill as the other markers do. Derived (provisional).
 */
export const MAP_CHINAMPA_PLOT_FILL = '#ffae42';

/**
 * The plot's outline, centreline, in marker units (derived, provisional): half width and half
 * height of the rectangle to the ink centreline (ink edge 30 and 24), the corner radius, and the
 * hanging roots, each `rootHalfW` either side of an `rootXs` centre and `rootDepth` deep at the
 * control points (a round tip about three quarters of that).
 */
export const MAP_CHINAMPA_PLOT = {
  halfW: 30 - MARKER_LW / 2,
  halfH: 24 - MARKER_LW / 2,
  corner: 10,
  rootXs: [12, 0, -12],
  rootHalfW: 4.5,
  rootDepth: 9,
} as const;

/** The garden plot outline (centreline) as a closed path: top edge, right side, bottom edge with its roots, left side. */
function gardenPlotPath(): Path2D {
  const { halfW, halfH, corner, rootXs, rootHalfW, rootDepth } = MAP_CHINAMPA_PLOT;
  const cx = halfW - corner;
  const cy = halfH - corner;
  const p = new Path2D();
  p.moveTo(-cx, -halfH);
  p.lineTo(cx, -halfH);
  p.arc(cx, -cy, corner, -Math.PI / 2, 0);
  p.lineTo(halfW, cy);
  p.arc(cx, cy, corner, 0, Math.PI / 2);
  // bottom edge, right to left: a rounded root tip hangs from it at each rootXs
  for (const x of rootXs) {
    p.lineTo(x + rootHalfW, halfH);
    p.bezierCurveTo(x + rootHalfW, halfH + rootDepth, x - rootHalfW, halfH + rootDepth, x - rootHalfW, halfH);
  }
  p.lineTo(-cx, halfH);
  p.arc(-cx, cy, corner, Math.PI / 2, Math.PI);
  p.lineTo(-halfW, -cy);
  p.arc(-cx, -cy, corner, Math.PI, (3 * Math.PI) / 2);
  p.closePath();
  return p;
}

type MarkerPainter = (ctx: CanvasRenderingContext2D, locked: boolean) => void;

/** Every look's marker painter. A new `HabitatLookId` fails to compile until it has its own marker, so no look falls back to the canal's. */
const MARKER_PAINTERS: Readonly<Record<HabitatLookId, MarkerPainter>> = {
  canal: (ctx, locked) => {
    const disc = new Path2D();
    ell(disc, 0, 0, MARKER_LINE_R, MARKER_LINE_R);
    shape(ctx, disc, locked ? WHITE : UI_PRIMARY, MARKER_LW);
  },
  pond: (ctx, locked) => shape(ctx, lilyPadPath(), locked ? WHITE : MAP_POND_PAD_FILL, MARKER_LW),
  chinampa: (ctx, locked) => shape(ctx, gardenPlotPath(), locked ? WHITE : MAP_CHINAMPA_PLOT_FILL, MARKER_LW),
};

/**
 * Paint a marker centred at local (0, 0), 64 px to the outer ink edge, ink 3.5 (the garden plot
 * is 60 x 48, with roots to about 31 below the centre). The canal look (default) is a disc:
 * #ffe14a unlocked, #ffffff locked. The pond look is the notched lily pad: {@link MAP_POND_PAD_FILL} unlocked, #ffffff
 * locked. The chinampa look is the garden plot with hanging roots: {@link MAP_CHINAMPA_PLOT_FILL}
 * unlocked, #ffffff locked. The number is scene text; the locked cue is the padlock badge, not
 * the fill. An unknown look throws a RangeError, so none falls back to the canal.
 */
export function paintMapMarker(ctx: CanvasRenderingContext2D, locked: boolean, look: HabitatLookId = 'canal'): void {
  if (!Object.hasOwn(MARKER_PAINTERS, look)) throw new RangeError(`unknown map marker look "${look}"`);
  MARKER_PAINTERS[look](ctx, locked);
}

const FOCUS_HALF = MAP_FOCUS_INK_R + MAP_FOCUS_LW / 2;

/** Texture frame for the focus ring. Anchor is the ring (and marker) centre. */
export const MAP_FOCUS_TEX: TexSize = frameFromBounds(-FOCUS_HALF, -FOCUS_HALF, FOCUS_HALF, FOCUS_HALF, 1);

/** Paint the double focus ring centred at local (0, 0): white 3 px at r 35.25, ink 3 px at r 38.25. */
export function paintMapFocusRing(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = MAP_FOCUS_LW;
  ctx.strokeStyle = WHITE;
  const inner = new Path2D();
  inner.arc(0, 0, MAP_FOCUS_WHITE_R, 0, TAU);
  ctx.stroke(inner);
  ctx.strokeStyle = INK;
  const outer = new Path2D();
  outer.arc(0, 0, MAP_FOCUS_INK_R, 0, TAU);
  ctx.stroke(outer);
}

/** Texture frame for the padlock badge. Anchor is the disc centre. */
export const MAP_BADGE_TEX: TexSize = frameFromBounds(-MAP_BADGE_R, -MAP_BADGE_R, MAP_BADGE_R, MAP_BADGE_R, 1);

/**
 * Paint the padlock badge centred at local (0, 0): a white disc r 12 to the
 * outer edge of its ink ring (2.6) holding the 18 px lock icon (ink 2.19).
 */
export function paintMapPadlockBadge(ctx: CanvasRenderingContext2D): void {
  const r = MAP_BADGE_R - BADGE_LW / 2;
  const disc = new Path2D();
  ell(disc, 0, 0, r, r);
  shape(ctx, disc, WHITE, BADGE_LW);
  ctx.save();
  ctx.translate(-MAP_BADGE_ICON_SIZE / 2, -MAP_BADGE_ICON_SIZE / 2);
  paintIcon(ctx, 'lock', MAP_BADGE_ICON_SIZE);
  ctx.restore();
}

/** Texture frame for the "New!" pill. Anchor is the pill centre. */
export const MAP_PILL_TEX: TexSize = frameFromBounds(-MAP_PILL.w / 2, -MAP_PILL.h / 2, MAP_PILL.w / 2, MAP_PILL.h / 2, 1);

/**
 * Paint the "New!" pill centred at local (0, 0): #ff82bf, ink 2.6, 56 x 24 to
 * the outer ink edge. The word "New!" (bold ink 18 px, padding 6) is scene
 * text drawn over it, so the pill can bob with its word.
 */
export function paintMapNewPill(ctx: CanvasRenderingContext2D): void {
  const w = MAP_PILL.w - PILL_LW;
  const h = MAP_PILL.h - PILL_LW;
  const r = h / 2;
  const p = new Path2D();
  p.moveTo(-w / 2 + r, -h / 2);
  p.lineTo(w / 2 - r, -h / 2);
  p.arc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  p.lineTo(-w / 2 + r, h / 2);
  p.arc(-w / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  p.closePath();
  shape(ctx, p, UI_ACCENT, PILL_LW);
}

// ---------------------------------------------------------------------------
// Star row
// ---------------------------------------------------------------------------

/** Centre x of star `i` (0..2) in the row, from the row centre. */
export function mapStarOffsetX(i: number): number {
  return (i - (MAP_STAR_COUNT - 1) / 2) * (MAP_STAR_SIZE + MAP_STAR_GAP);
}

/** Texture frame for the star row. Anchor is the row centre. */
export const MAP_STAR_ROW_TEX: TexSize = frameFromBounds(
  -MAP_STAR_ROW_W / 2,
  -MAP_STAR_SIZE / 2,
  MAP_STAR_ROW_W / 2,
  MAP_STAR_SIZE / 2,
  1,
);

/**
 * Paint the star row centred at local (0, 0): three 24 px Area stars (7g, the
 * same art as the Home Tank badge), the first `earned` filled and the rest
 * missing (dashed). A locked area shows `earned` 0.
 */
export function paintMapStarRow(ctx: CanvasRenderingContext2D, earned: number): void {
  for (let i = 0; i < MAP_STAR_COUNT; i++) {
    ctx.save();
    ctx.translate(mapStarOffsetX(i), 0);
    paintAreaStar(ctx, i < earned, MAP_STAR_SIZE);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Text panels
// ---------------------------------------------------------------------------

/** What the scene needs to size a panel or tab round a line of text. */
export interface MapTextSpec {
  /** Padding across, logical px. */
  readonly padX: number;
  /** Padding down, logical px. */
  readonly padY: number;
  /** Smallest panel height, logical px (0 for none). */
  readonly minH: number;
  /** Text size, bold ink, px. */
  readonly fontPx: number;
}

/** A text panel in one fill. */
export interface MapPanelSpec extends MapTextSpec {
  /** Fill. */
  readonly fill: string;
}

/**
 * Habitat label on its tab (issue #113, ND-1): bold ink 20 px, padding 8 across and 4 down, 32 tall
 * for one line, the same measure as areaMap's habitat label. The fill is the habitat's tint
 * ({@link mapHabitatTint}).
 */
export const MAP_TAB_TEXT: MapTextSpec = { padX: 8, padY: 4, minH: 32, fontPx: 20 };
/** Message line: bold ink 20 px on soft pink #ffd9e6 (11.19:1), padding 8 across and 4 down. */
export const MAP_MESSAGE_PANEL: MapPanelSpec = { padX: 8, padY: 4, minH: 0, fill: UI_PANEL_PINK, fontPx: 20 };
/** Title "Where to?": bold ink 28 px on white, padding 8 all round. */
export const MAP_TITLE_PANEL: MapPanelSpec = { padX: 8, padY: 8, minH: 0, fill: UI_PANEL, fontPx: 28 };

/** Panel size round a text block of `textW` x `textH` logical px. */
export function mapPanelSize(textW: number, textH: number, spec: MapTextSpec): { w: number; h: number } {
  return { w: textW + 2 * spec.padX, h: Math.max(spec.minH, textH + 2 * spec.padY) };
}

/** Largest corner radius of a panel (the scene panel style). */
const PANEL_MAX_RADIUS = 18;

/**
 * Texture frame for a w x h panel. The anchor is the panel's top-left corner,
 * as for buttons; the frame has room for the outline.
 */
export function mapPanelTextureSize(w: number, h: number): TexSize {
  return frameFromBounds(0, 0, w, h, Math.ceil(LW / 2) + 1);
}

/**
 * Paint a w x h panel with its top-left corner at local (0, 0): the fill, then
 * an ink 3.5 line on the edge, corner radius min(h / 2, 18). The same look as
 * the scenes' drawPanel, so a baked panel and a scene panel match.
 */
export function paintMapPanel(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string): void {
  const r = Math.min(h / 2, PANEL_MAX_RADIUS);
  const p = new Path2D();
  p.moveTo(r, 0);
  p.arcTo(w, 0, w, h, r);
  p.arcTo(w, h, 0, h, r);
  p.arcTo(0, h, 0, 0, r);
  p.arcTo(0, 0, w, 0, r);
  p.closePath();
  shape(ctx, p, fill, LW);
}

// ---------------------------------------------------------------------------
// Habitat panels and tabs
// ---------------------------------------------------------------------------

/**
 * Habitat tint by look (issue #113, ND-4): 30% of the look's unlocked marker fill over white, so
 * each tint is a light shade of its marker's hue. A new `HabitatLookId` fails to compile until it
 * has its tint. Ink on each is 4.5:1 or more and each is 3:1 or more against the #0c6a8c backdrop:
 * canal #fff6c9 (ink 13.21:1, backdrop 5.58:1), pond #caf2d0 (11.74:1, 4.95:1), chinampa #ffe7c6
 * (11.99:1, 5.06:1). Derived (provisional).
 */
export const MAP_HABITAT_TINTS: Readonly<Record<HabitatLookId, string>> = {
  canal: '#fff6c9',
  pond: '#caf2d0',
  chinampa: '#ffe7c6',
};

/** The habitat tint of `look`. An unknown look throws a RangeError, so none falls back to the canal's. */
export function mapHabitatTint(look: HabitatLookId): string {
  if (!Object.hasOwn(MAP_HABITAT_TINTS, look)) throw new RangeError(`unknown map habitat look "${look}"`);
  return MAP_HABITAT_TINTS[look];
}

/** A box in map space, top-left corner and size. */
export interface MapBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * How far below a tab's bottom edge each of its sides runs, to meet its panel's ink line: 0 where
 * the panel's top is straight, more where a side stands over one of the panel's rounded corners.
 */
export interface MapTabFeet {
  readonly left: number;
  readonly right: number;
}

/** Depth of the outline of a panel `panelH` tall below its top edge, `inset` px in from one of its sides. */
function panelEdgeDepth(inset: number, panelH: number): number {
  const r = Math.min(panelH / 2, PANEL_MAX_RADIUS);
  if (inset < 0 || inset >= r) return 0;
  return r - Math.sqrt(r * r - (r - inset) * (r - inset));
}

/**
 * The feet of the tab `tab` sitting on the top edge of `panel` (the tab's bottom on the panel's
 * top): each side runs down to the panel's outline beneath it. A side past the panel's end gets 0.
 */
export function mapTabFeet(tab: MapBox, panel: MapBox): MapTabFeet {
  return {
    left: panelEdgeDepth(tab.x - panel.x, panel.h),
    right: panelEdgeDepth(panel.x + panel.w - (tab.x + tab.w), panel.h),
  };
}

/** Texture frame for a w x h tab with `feet`. The anchor is the tab's top-left corner. */
export function mapTabTextureSize(w: number, h: number, feet: MapTabFeet): TexSize {
  return frameFromBounds(0, 0, w, h + Math.max(feet.left, feet.right) + LW, Math.ceil(LW / 2) + 1);
}

/**
 * Paint a w x h folder tab with its top-left corner at local (0, 0), to sit on a panel's top edge
 * (issue #113, ND-1): the fill with rounded top corners (radius min(h / 2, w / 2, 18)), an ink 3.5
 * line over the top and down both sides, and no line along the bottom. The fill reaches one line
 * width below the bottom, so it hides the panel's top line under the tab and the tab opens into the
 * panel; each side runs on to its foot ({@link mapTabFeet}), and the fill squares off the panel's
 * rounded corner there, so the tab and panel read as one shape.
 */
export function paintMapTab(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fill: string,
  feet: MapTabFeet = { left: 0, right: 0 },
): void {
  const r = Math.min(h / 2, w / 2, PANEL_MAX_RADIUS);
  const body = new Path2D();
  body.moveTo(0, h + LW);
  body.lineTo(0, r);
  body.arcTo(0, 0, r, 0, r);
  body.lineTo(w - r, 0);
  body.arcTo(w, 0, w, r, r);
  body.lineTo(w, h + LW);
  body.closePath();
  const cornerW = Math.min(w / 2, PANEL_MAX_RADIUS);
  if (feet.left > 0) body.rect(0, h, cornerW, feet.left + LW);
  if (feet.right > 0) body.rect(w - cornerW, h, cornerW, feet.right + LW);
  ctx.fillStyle = fill;
  ctx.fill(body);
  const outline = new Path2D();
  outline.moveTo(0, h + feet.left);
  outline.lineTo(0, r);
  outline.arcTo(0, 0, r, 0, r);
  outline.lineTo(w - r, 0);
  outline.arcTo(w, 0, w, r, r);
  outline.lineTo(w, h + feet.right);
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke(outline);
}
