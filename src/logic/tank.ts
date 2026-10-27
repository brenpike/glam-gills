/**
 * Home Tank rules (PRD C9): which Decorations are owned, where they may stand, placing, moving and
 * putting them away, and how the 480 x 360 tank scene fits a CSS canvas (art guide 7f). Floor items
 * stand on the gravel; Floating and Hanging items (issue #95) sit at one fixed base y in the top band
 * and move left and right only. Pure data plus functions; drawing lives in the art and scene layers.
 */
import { ALL_TREASURES, isDecoration, placementKind, type Decoration } from './catalogue';
import type { Rect } from './hudLayout';
import type { Point } from './zone';

/**
 * Home Tank geometry in tank units: the 480 x 360 reference viewport (art guide 1 and 7f).
 * `glass` is the tank rectangle, `waterTop` the surface line and `gravelTop` the gravel top.
 * A Decoration is a `decorationPx` square standing on its base point (bottom-centre); the base
 * stays at least `wallInset` from the glass sides plus half the footprint, and inside `floorBand`
 * (base y). `moveStep` is one keyboard nudge. `lidTop` is the top of the lid and `topBand` the
 * footprint band of Floating and Hanging items (just under the glass top).
 */
export const TANK = Object.freeze({
  viewW: 480,
  viewH: 360,
  glass: Object.freeze({ x0: 16, x1: 464, y0: 24, y1: 340 }),
  waterTop: 44,
  gravelTop: 300,
  decorationPx: 80,
  wallInset: 8,
  floorBand: Object.freeze({ y0: 304, y1: 332 }),
  moveStep: Object.freeze({ x: 16, y: 8 }),
  lidTop: 16,
  topBand: Object.freeze({ y0: 24, y1: 104 }),
});

/** Base y of every Floating and Hanging item: the bottom of the top band, in tank units. */
export const TOP_BASE_Y = TANK.topBand.y1;

/** Tank units the top band grows by on each side to cover the Floating bob and the Hanging sway. */
export const TOP_MOTION_MARGIN = 4;

/** The band of tank y that UI must keep clear for Floating and Hanging items, motion included. */
export const TOP_KEEP_CLEAR = Object.freeze({
  y0: TANK.topBand.y0 - TOP_MOTION_MARGIN,
  y1: TANK.topBand.y1 + TOP_MOTION_MARGIN,
});

/** The shipped Decorations of every area (canal then pond), in catalogue order. Tank functions use it by default. */
export const SHIPPED_DECORATIONS: readonly Decoration[] = Object.freeze(ALL_TREASURES.filter(isDecoration));

/** The parts of a Decoration that set where it may go and what it covers. */
export type DecorationShape = Pick<Decoration, 'placement' | 'width'>;

/** Shape used for ids missing from the catalogue: a standard Floor item, as every item was before kinds. */
const FLOOR_SHAPE: DecorationShape = Object.freeze({});

/** Pond plant sway: amplitude in radians and period in seconds, about the base. */
const PLANT_SWAY = Object.freeze({ rad: 0.05, periodS: 4 });

/** Floating bob: amplitude in tank units and period in seconds. */
const FLOAT_BOB = Object.freeze({ units: 3, periodS: 3 });

/** Hanging sway: amplitude in radians and period in seconds, about the hook. */
const HANG_SWAY = Object.freeze({ rad: 0.04, periodS: 5 });

/** Base y of every suggested spot, in tank units. */
export const SUGGEST_BASE_Y = 318;

/** Suggested spot x positions, in the order they are tried. */
export const SUGGEST_XS: readonly number[] = Object.freeze([240, 144, 336, 96, 384, 192, 288]);

/** Decorations that sway like reeds in the Home Tank; everything else is still (art guide 7f). */
export const TANK_SWAYING_DECORATIONS: readonly string[] = Object.freeze(['canal/pond-plant']);

/** One placed Decoration: its catalogue id and its base point (bottom-centre) in tank units. */
export interface TankPlacement {
  id: string;
  x: number;
  y: number;
}

/** The Home Tank layout: plain data keyed by catalogue id, so the save (#15) can store it as is. */
export interface TankLayout {
  placed: readonly TankPlacement[];
}

/** Outcome of a tank change. Every result except 'placed', 'moved' and 'putAway' changes nothing. */
export type TankResult =
  | 'placed'
  | 'moved'
  | 'putAway'
  | 'notOwned'
  | 'notDecoration'
  | 'alreadyPlaced'
  | 'notPlaced'
  | 'outside';

/** A tank change: the new layout, or the same layout object when `result` is a failure. */
export interface TankChange {
  layout: TankLayout;
  result: TankResult;
}

/** A keyboard nudge direction. */
export type TankDirection = 'left' | 'right' | 'up' | 'down';

/** Idle motion of a placed Decoration: `dy` in tank units (down is positive) and `angle` in radians. */
export interface DecorationMotion {
  dy: number;
  angle: number;
}

/** Where the tank scene sits on the canvas: CSS px per tank unit and the CSS top-left corner. */
export interface TankFrame {
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An empty Home Tank. */
export function createTankLayout(): TankLayout {
  return { placed: [] };
}

/** The Decoration with this id in `catalogue`, or undefined when it has none. */
export function decorationById(
  id: string,
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): Decoration | undefined {
  return catalogue.find((decoration) => decoration.id === id);
}

/** The shape of `id` in `catalogue`, with ids it lacks treated as a standard Floor item. */
function shapeOf(id: string, catalogue: readonly Decoration[]): DecorationShape {
  return decorationById(id, catalogue) ?? FLOOR_SHAPE;
}

/** Owned Decoration ids: banked ids that are Decorations in `catalogue`, de-duplicated, in catalogue order. */
export function ownedDecorations(
  banked: readonly string[],
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): string[] {
  const owned = new Set(banked);
  return catalogue.filter((decoration) => owned.has(decoration.id)).map((decoration) => decoration.id);
}

/** Footprint width of a Decoration in tank units; an absent `width` means `TANK.decorationPx`. */
export function decorationWidth(decoration: DecorationShape): number {
  return decoration.width ?? TANK.decorationPx;
}

/** The x range a base point may use: the glass sides less `wallInset` and half the footprint. */
export function placementXRange(): { x0: number; x1: number } {
  return placementXRangeFor(FLOOR_SHAPE);
}

/** The x range a base point of this Decoration may use: the glass sides less `wallInset` and half its width. */
export function placementXRangeFor(decoration: DecorationShape): { x0: number; x1: number } {
  const half = decorationWidth(decoration) / 2;
  return { x0: TANK.glass.x0 + TANK.wallInset + half, x1: TANK.glass.x1 - TANK.wallInset - half };
}

/** `x` clamped into `range` (inclusive). */
function clampToRange(range: { x0: number; x1: number }, x: number): number {
  return Math.min(range.x1, Math.max(range.x0, x));
}

/** True when the Decoration sits at a fixed base y (Floating and Hanging). */
function hasFixedBaseY(decoration: DecorationShape): boolean {
  return placementKind(decoration) !== 'floor';
}

/** True when `pos` is a finite base point inside the placement x range and the floor band (inclusive). */
export function isValidPlacement(pos: Point): boolean {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  const range = placementXRange();
  const band = TANK.floorBand;
  return pos.x >= range.x0 && pos.x <= range.x1 && pos.y >= band.y0 && pos.y <= band.y1;
}

/**
 * True when `pos` is a finite base point inside this Decoration's x range and, for Floor, inside the
 * floor band (inclusive); Floating and Hanging need y to be exactly `TOP_BASE_Y`.
 */
export function isValidPlacementFor(decoration: DecorationShape, pos: Point): boolean {
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  const range = placementXRangeFor(decoration);
  if (pos.x < range.x0 || pos.x > range.x1) return false;
  if (hasFixedBaseY(decoration)) return pos.y === TOP_BASE_Y;
  return pos.y >= TANK.floorBand.y0 && pos.y <= TANK.floorBand.y1;
}

/** The square a Decoration covers when its base point is at `pos`, in tank units. */
export function decorationFootprint(pos: Point): Rect {
  return decorationFootprintFor(FLOOR_SHAPE, pos);
}

/** The rectangle this Decoration covers when its base point is at `pos`: its width by `TANK.decorationPx` high. */
export function decorationFootprintFor(decoration: DecorationShape, pos: Point): Rect {
  const width = decorationWidth(decoration);
  const height = TANK.decorationPx;
  return { x: pos.x - width / 2, y: pos.y - height, w: width, h: height };
}

/** True when two Decorations' footprints share area at these base points; touching edges do not overlap. */
export function decorationsOverlap(a: DecorationShape, aPos: Point, b: DecorationShape, bPos: Point): boolean {
  const halfWidths = (decorationWidth(a) + decorationWidth(b)) / 2;
  return Math.abs(aPos.x - bPos.x) < halfWidths && Math.abs(aPos.y - bPos.y) < TANK.decorationPx;
}

/**
 * Where a dragged Decoration goes for the pointer point `pos`: Floating and Hanging keep `TOP_BASE_Y`
 * and clamp x into their x range; Floor follows `pos` as is (an invalid point shows the invalid cue).
 */
export function snapPlacement(decoration: DecorationShape, pos: Point): Point {
  if (!hasFixedBaseY(decoration)) return { x: pos.x, y: pos.y };
  return { x: clampToRange(placementXRangeFor(decoration), pos.x), y: TOP_BASE_Y };
}

/**
 * Sprite anchor of a Decoration whose base point is at `pos`: the base point for Floor and Floating,
 * the hook point one footprint above it (on the glass top) for Hanging.
 */
export function decorationAnchor(decoration: DecorationShape, pos: Point): Point {
  if (placementKind(decoration) === 'hanging') return { x: pos.x, y: pos.y - TANK.decorationPx };
  return { x: pos.x, y: pos.y };
}

/**
 * Idle motion at `timeS` seconds: the swaying pond plant rocks about its base, Floating items bob and
 * Hanging items sway about the hook. Everything is 0 when `still` (reduced motion).
 */
export function decorationMotion(
  decoration: Pick<Decoration, 'id' | 'placement'>,
  timeS: number,
  still: boolean,
): DecorationMotion {
  if (still) return { dy: 0, angle: 0 };
  switch (placementKind(decoration)) {
    case 'floating':
      return { dy: FLOAT_BOB.units * Math.sin((2 * Math.PI * timeS) / FLOAT_BOB.periodS), angle: 0 };
    case 'hanging':
      return { dy: 0, angle: HANG_SWAY.rad * Math.sin((2 * Math.PI * timeS) / HANG_SWAY.periodS) };
    case 'floor':
      if (!TANK_SWAYING_DECORATIONS.includes(decoration.id)) return { dy: 0, angle: 0 };
      return { dy: 0, angle: PLANT_SWAY.rad * Math.sin((2 * Math.PI * timeS) / PLANT_SWAY.periodS) };
  }
}

/** The placement of `id`, or undefined when it is not in the tank. */
export function placementOf(layout: TankLayout, id: string): TankPlacement | undefined {
  return layout.placed.find((placement) => placement.id === id);
}

/**
 * Places an owned Decoration at `pos`. Fails with 'notDecoration' for an id that is not a Decoration
 * in `catalogue`, 'notOwned' when it is not banked, 'alreadyPlaced' when it is in the tank, and
 * 'outside' for a base point invalid for its kind.
 */
export function placeDecoration(
  layout: TankLayout,
  banked: readonly string[],
  id: string,
  pos: Point,
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): TankChange {
  const decoration = decorationById(id, catalogue);
  if (decoration === undefined) return { layout, result: 'notDecoration' };
  if (!banked.includes(id)) return { layout, result: 'notOwned' };
  if (placementOf(layout, id) !== undefined) return { layout, result: 'alreadyPlaced' };
  if (!isValidPlacementFor(decoration, pos)) return { layout, result: 'outside' };
  return { layout: { placed: [...layout.placed, { id, x: pos.x, y: pos.y }] }, result: 'placed' };
}

/**
 * Moves a placed Decoration to `pos`. Fails with 'notPlaced' or 'outside' (invalid for its kind in
 * `catalogue`; ids it lacks use the Floor rules).
 */
export function moveDecoration(
  layout: TankLayout,
  id: string,
  pos: Point,
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): TankChange {
  if (placementOf(layout, id) === undefined) return { layout, result: 'notPlaced' };
  if (!isValidPlacementFor(shapeOf(id, catalogue), pos)) return { layout, result: 'outside' };
  const placed = layout.placed.map((placement) => (placement.id === id ? { id, x: pos.x, y: pos.y } : placement));
  return { layout: { placed }, result: 'moved' };
}

/** Takes a placed Decoration out of the tank. Fails with 'notPlaced'. */
export function putAway(layout: TankLayout, id: string): TankChange {
  if (placementOf(layout, id) === undefined) return { layout, result: 'notPlaced' };
  return { layout: { placed: layout.placed.filter((placement) => placement.id !== id) }, result: 'putAway' };
}

/**
 * A valid base point for the Decoration `id` (a standard Floor item when absent or not in
 * `catalogue`): the first suggested x whose footprint overlaps no placed one, else the suggested x
 * values in turn by how many are placed. Floor uses `SUGGEST_BASE_Y`; Floating and Hanging use
 * `TOP_BASE_Y`. Each x is clamped into the item's x range.
 */
export function suggestSpot(
  layout: TankLayout,
  id?: string,
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): Point {
  const shape = id === undefined ? FLOOR_SHAPE : shapeOf(id, catalogue);
  const y = hasFixedBaseY(shape) ? TOP_BASE_Y : SUGGEST_BASE_Y;
  const range = placementXRangeFor(shape);
  const xs = SUGGEST_XS.map((x) => clampToRange(range, x));
  const overlapsPlaced = (placement: TankPlacement, x: number): boolean =>
    decorationsOverlap(shape, { x, y }, shapeOf(placement.id, catalogue), placement);
  const isFree = (x: number): boolean => layout.placed.every((placement) => !overlapsPlaced(placement, x));
  const x = xs.find(isFree) ?? xs[layout.placed.length % xs.length];
  return { x, y };
}

/** `pos` moved one `TANK.moveStep` in `direction`. The result may be invalid; check it with isValidPlacement. */
export function nudge(pos: Point, direction: TankDirection): Point {
  const step = TANK.moveStep;
  switch (direction) {
    case 'left':
      return { x: pos.x - step.x, y: pos.y };
    case 'right':
      return { x: pos.x + step.x, y: pos.y };
    case 'up':
      return { x: pos.x, y: pos.y - step.y };
    case 'down':
      return { x: pos.x, y: pos.y + step.y };
  }
}

/**
 * `pos` moved one `TANK.moveStep` in `direction` for this Decoration's kind, or null when the kind
 * cannot move that way (up and down for Floating and Hanging): nothing moves and no invalid cue shows.
 * The result may be invalid; check it with isValidPlacementFor.
 */
export function nudgeDecoration(decoration: DecorationShape, pos: Point, direction: TankDirection): Point | null {
  if (hasFixedBaseY(decoration) && (direction === 'up' || direction === 'down')) return null;
  return nudge(pos, direction);
}

/** Catalogue index of an id, with unknown ids after every known one. */
function catalogueIndex(id: string, catalogue: readonly Decoration[]): number {
  const index = catalogue.findIndex((decoration) => decoration.id === id);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/** Placements back to front: by base y, then `catalogue` order. */
export function drawOrder(
  layout: TankLayout,
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): TankPlacement[] {
  return [...layout.placed].sort(
    (a, b) => a.y - b.y || catalogueIndex(a.id, catalogue) - catalogueIndex(b.id, catalogue),
  );
}

/**
 * The layout with only owned Decorations, each once (first kept), at valid base points. Use it on
 * any layout from outside the rules, such as a save (#15).
 */
export function sanitizeLayout(
  layout: TankLayout,
  banked: readonly string[],
  catalogue: readonly Decoration[] = SHIPPED_DECORATIONS,
): TankLayout {
  const owned = new Set(ownedDecorations(banked, catalogue));
  const seen = new Set<string>();
  const placed: TankPlacement[] = [];
  for (const placement of layout.placed) {
    if (!owned.has(placement.id) || seen.has(placement.id)) continue;
    if (!isValidPlacementFor(shapeOf(placement.id, catalogue), placement)) continue;
    seen.add(placement.id);
    placed.push({ id: placement.id, x: placement.x, y: placement.y });
  }
  return { placed };
}

/** Returns a positive finite value, or 1 for zero, negative or NaN input. */
function positiveOrOne(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * Fits the 480 x 360 tank scene into a CSS canvas: contain-fit scale, centred across, bottom-aligned
 * so the stand sits on the canvas bottom. Degenerate sizes count as 1 CSS px.
 */
export function tankFrame(cssW: number, cssH: number): TankFrame {
  return tankFrameAt(cssW, cssH, Number.POSITIVE_INFINITY);
}

/**
 * Places the 480 x 360 tank scene on a CSS canvas at `scale` CSS px per tank unit, capped at the
 * contain-fit scale, centred across and bottom-aligned as tankFrame does. A `scale` that is not
 * positive (or NaN) means the contain-fit scale. Degenerate sizes count as 1 CSS px.
 */
export function tankFrameAt(cssW: number, cssH: number, scale: number): TankFrame {
  const width = positiveOrOne(cssW);
  const height = positiveOrOne(cssH);
  const containScale = Math.min(width / TANK.viewW, height / TANK.viewH);
  return frameOf(width, height, scale > 0 ? Math.min(scale, containScale) : containScale);
}

/** The frame of the tank scene at `scale` on a `width` x `height` canvas: centred across, bottom-aligned. */
function frameOf(width: number, height: number, scale: number): TankFrame {
  const w = TANK.viewW * scale;
  const h = TANK.viewH * scale;
  return { scale, x: (width - w) / 2, y: height - h, w, h };
}

/** A tank point in CSS px. */
export function tankToCss(frame: TankFrame, pos: Point): Point {
  return { x: frame.x + pos.x * frame.scale, y: frame.y + pos.y * frame.scale };
}

/** A CSS point in tank units. */
export function cssToTank(frame: TankFrame, pos: Point): Point {
  return { x: (pos.x - frame.x) / frame.scale, y: (pos.y - frame.y) / frame.scale };
}

/** CSS y of the top of the tallest Decoration standing on the floor top; UI must stay above it. */
export function decorationBandTop(frame: TankFrame): number {
  return frame.y + (TANK.floorBand.y0 - TANK.decorationPx) * frame.scale;
}

/** CSS y of the top of the tank lid. */
export function lidTopCss(frame: TankFrame): number {
  return frame.y + TANK.lidTop * frame.scale;
}

/**
 * The tank box in CSS px (issue #148, ND-1): the glass and the lid, from `TANK.glass.x0` to
 * `TANK.glass.x1` across and from `TANK.lidTop` down to `TANK.glass.y1`, through `frame`.
 */
export function tankBoxCss(frame: TankFrame): Rect {
  return {
    x: frame.x + TANK.glass.x0 * frame.scale,
    y: frame.y + TANK.lidTop * frame.scale,
    w: (TANK.glass.x1 - TANK.glass.x0) * frame.scale,
    h: (TANK.glass.y1 - TANK.lidTop) * frame.scale,
  };
}

/** CSS y range of `TOP_KEEP_CLEAR`, the band UI must keep clear for Floating and Hanging items. */
export function topKeepClearCss(frame: TankFrame): { y0: number; y1: number } {
  return { y0: frame.y + TOP_KEEP_CLEAR.y0 * frame.scale, y1: frame.y + TOP_KEEP_CLEAR.y1 * frame.scale };
}
