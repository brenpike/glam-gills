import { stickLayout, type StickLayout, type StickView } from './stick';
import { VIEW } from './tuning';
import type { Vec2 } from './vec';
import { fitView } from './viewport';
import { BED_TOP, SURF, WORLD_H } from './zone';

/** Axis-aligned rectangle in CSS px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width and height in CSS px. */
export interface Size {
  w: number;
  h: number;
}

/** The water's top and bottom rows as drawn on screen, in CSS px from the top of the canvas. */
export interface ScreenWaterRows {
  top: number;
  bottom: number;
}

/**
 * CSS viewport size in px. `waterRows` is set only for an area whose camera scrolls vertically;
 * unset, the water rows are the canal's.
 */
export type HudView = StickView & { waterRows?: ScreenWaterRows };

/**
 * HUD layout constants, in CSS px (the values HudScene uses). Banners show their text at
 * bannerTextPx; a banner with no place at that size may show at bannerRetryTextPx instead, never
 * smaller.
 */
export const HUD = Object.freeze({
  margin: 16,
  gap: 12,
  panelPad: 6,
  ringGap: 8,
  ringTrackPx: 9,
  bannerPad: 12,
  bannerMinWrap: 120,
  bannerTextPx: 24,
  bannerRetryTextPx: 20,
});

/** Find toast layout constants, in CSS px (the values FindPopup uses). */
export const FIND_TOAST = Object.freeze({
  padX: 8,
  padY: 4,
  iconPx: 32,
  columnGap: 8,
  nameTextPx: 20,
  detailTextPx: 18,
  badgePx: 24,
  badgeGap: 6,
  nameMinW: 120,
  detailMinW: 90,
  nameWrapW: 360,
});

/**
 * Returns the water rows on screen for a vertically scrolling area, clamped to the canvas: from the
 * water line (`rows.surf`) or the screen top, whichever is lower, to the bed (`rows.bedTop`) or the
 * screen bottom, whichever is higher.
 *
 * `cameraTop` is the world y at the camera's top edge (Phaser `camera.worldView.y`) and `zoom` the
 * world-to-CSS-px zoom (fitView's `fitZoom`, not the device-pixel `zoom`). A world row y draws at
 * (y - cameraTop) * zoom, the same mapping playMiddle uses for the canal, where the camera top is
 * WORLD_H / 2 - cssH / (2 * fitZoom) (negative while letterboxed). Assumes some water is on
 * screen; with the water wholly off screen, bottom is above top.
 */
export function screenWaterRows(
  view: StickView,
  rows: { surf: number; bedTop: number },
  cameraTop: number,
  zoom: number,
): ScreenWaterRows {
  return {
    top: Math.max(0, (rows.surf - cameraTop) * zoom),
    bottom: Math.min(view.cssH, (rows.bedTop - cameraTop) * zoom),
  };
}

/**
 * The middle of the play area, where overlays cover only the status panels, as fractions of the
 * water as drawn on screen: 0 is the surface (SURF) and 1 the top of the bed (BED_TOP).
 */
export const PLAY_MIDDLE = Object.freeze({ topFraction: 0.3, bottomFraction: 0.7 });

/** Measured sizes of the HUD controls and status panels, in CSS px. */
export interface HudControlSizes {
  pause: Size;
  goHome: Size;
  dash: Size;
  /** Corner radius of the square Dash button. */
  dashCornerR: number;
  counter: Size;
  legs: Size;
}

/** The Dash button, its ring and the ring's outer bounds. */
export interface DashLayout {
  button: Rect;
  centre: Vec2;
  /** Ring stroke radius (the track centre line). */
  ringR: number;
  /** Square around the ring's outer edge. */
  bounds: Rect;
}

/** Resolved HUD control geometry in CSS px. */
export interface HudControls {
  counter: Rect;
  legs: Rect;
  pause: Rect;
  goHome: Rect;
  dash: DashLayout;
  stick: StickLayout;
  /** Square around the swim pad footprint (not the capture zone). */
  stickBounds: Rect;
}

/** Which controls show right now. */
export interface KeepOutOptions {
  goHomeVisible: boolean;
}

/** Text measurements for one find toast. */
export interface FindToastMeasure {
  /** Name block size when wrapped at `wrapW`. */
  nameAt: (wrapW: number) => Size;
  /** Detail line size (beside the badge) when wrapped at `wrapW`. */
  detailAt: (wrapW: number) => Size;
}

/** A find toast panel size and the wrap widths its name and detail were measured at. */
export interface FindToastBox extends Size {
  nameWrapW: number;
  detailWrapW: number;
}

/** The HUD overlays placed by placeHudOverlays(). */
export type HudOverlayId = 'findToast' | 'snackBanner' | 'hint';

/** Overlay priority, highest first: when not every overlay fits, earlier ones win the room. */
export const HUD_OVERLAY_PRIORITY: readonly HudOverlayId[] = Object.freeze(['findToast', 'snackBanner', 'hint']);

/** The overlays that may retry at HUD.bannerRetryTextPx: the banners, never the find toast. */
const RETRY_IDS: ReadonlySet<HudOverlayId> = new Set<HudOverlayId>(['snackBanner', 'hint']);

/** Where a placed overlay sits: the top edge, the bottom edge or over the status row in the top band. */
export type OverlayEdge = 'top' | 'bottom' | 'panel';

/** One overlay to place: its id and its panel size when at most `maxW` wide. */
export interface HudOverlayRequest {
  id: HudOverlayId;
  /** Panel size; for a banner, with the text at HUD.bannerTextPx. */
  boxAt: (maxW: number) => Size;
  /** Banners only: panel size with the text at HUD.bannerRetryTextPx. Ignored for the find toast. */
  retryBoxAt?: (maxW: number) => Size;
  /**
   * Rects this overlay alone must stay at least HUD.gap clear of, in every tier and in the final
   * check; other overlays ignore them. Unset, the overlay places as if given none.
   */
  avoid?: readonly Rect[];
}

/**
 * Where an overlay goes; `rect` and `edge` are null when it has no room. `textPx` is the text size
 * a placed banner was placed at (HUD.bannerTextPx or HUD.bannerRetryTextPx); null for the find
 * toast and for any overlay with no place.
 */
export interface HudOverlayPlacement {
  id: HudOverlayId;
  rect: Rect | null;
  edge: OverlayEdge | null;
  textPx: number | null;
}

/**
 * An overlay request with its panel sizes memoised per maxW for one call. `retrySizeAt` is null
 * when the request has no retry measure or its id may not retry; `avoid` is empty when unset.
 */
interface SizedRequest {
  id: HudOverlayId;
  sizeAt: (maxW: number) => Size;
  retrySizeAt: ((maxW: number) => Size) | null;
  avoid: readonly Rect[];
}

/**
 * One placement tier: the room an overlay may take, the obstacles it adds to the control keep-outs
 * and the placed overlays, and the preferred top-left for a panel of a given size.
 */
interface OverlayTier {
  edge: OverlayEdge;
  room: Rect;
  extraObstacles: readonly Rect[];
  anchorFor: (size: Size) => Vec2;
}

/** A placed overlay rect, the edge of the tier it was placed in and its banner text size. */
interface TieredRect {
  rect: Rect;
  edge: OverlayEdge;
  textPx: number | null;
}

/** A candidate position and its distance from the preferred spot. */
interface Candidate {
  rect: Rect;
  dy: number;
  dx: number;
}

const FIT_EPSILON_PX = 1e-6;

/** Returns `value` clamped to [min, max], or `min` when the range is empty. */
function clampTo(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Returns the bottom edge of a rect. */
function bottomOf(rect: Rect): number {
  return rect.y + rect.h;
}

/** Returns the square of half-side `half` around `centre`. */
function squareAround(centre: Vec2, half: number): Rect {
  return { x: centre.x - half, y: centre.y - half, w: 2 * half, h: 2 * half };
}

/** Returns the rect grown by `by` on every side. */
function growRect(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + 2 * by, h: rect.h + 2 * by };
}

/** Returns the overlap of two rects, zero-sized when they do not meet. */
function intersectRect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x);
  const h = Math.max(0, Math.min(bottomOf(a), bottomOf(b)) - y);
  return { x, y, w, h };
}

/** Returns the frame overlays must stay inside: the view inset by the margin. */
function overlayFrame(view: HudView): Rect {
  return { x: HUD.margin, y: HUD.margin, w: view.cssW - 2 * HUD.margin, h: view.cssH - 2 * HUD.margin };
}

/** Returns the Dash ring radius clearing the rounded corners of a square button `buttonW` wide. */
function dashRingRadius(buttonW: number, cornerR: number): number {
  return (buttonW / 2 - cornerR) * Math.SQRT2 + cornerR + HUD.ringGap;
}

/** The snack counter and legs panels on the top row. */
interface StatusPanels {
  counter: Rect;
  legs: Rect;
}

/** Returns the top of a row panel `panelH` tall: the margin, or centred down Pause's height when shorter. */
function rowPanelTop(panelH: number, pauseH: number): number {
  return HUD.margin + Math.max(0, (pauseH - panelH) / 2);
}

/** Puts the counter at the margin and the legs panel a gap to its right, on Pause's row. */
function statusPanelRects(sizes: HudControlSizes): StatusPanels {
  const { pause } = sizes;
  const counter = { x: HUD.margin, y: rowPanelTop(sizes.counter.h, pause.h), w: sizes.counter.w, h: sizes.counter.h };
  const legsX = counter.x + counter.w + HUD.gap;
  const legs = { x: legsX, y: rowPanelTop(sizes.legs.h, pause.h), w: sizes.legs.w, h: sizes.legs.h };
  return { counter, legs };
}

/** Returns the counter and legs panels as a list. */
function panelList(panels: StatusPanels): Rect[] {
  return [panels.counter, panels.legs];
}

/** Places Dash bottom-right with its ring's outer edge at the margin. */
function dashLayoutFor(view: HudView, sizes: HudControlSizes): DashLayout {
  const ringR = dashRingRadius(sizes.dash.w, sizes.dashCornerR);
  const outer = ringR + HUD.ringTrackPx / 2;
  const centre = { x: view.cssW - HUD.margin - outer, y: view.cssH - HUD.margin - outer };
  const button = { x: centre.x - sizes.dash.w / 2, y: centre.y - sizes.dash.h / 2, w: sizes.dash.w, h: sizes.dash.h };
  return { button, centre, ringR, bounds: squareAround(centre, outer) };
}

/**
 * Places Go home at the right margin: under Pause when its left edge is at least a gap right of the
 * legs panel, otherwise dropped as low as it fits a gap above the Dash ring, never above the spot
 * under Pause or into the status row. When neither fits above the Dash ring, it sits left of Pause
 * on the top row; when the top row has no room right of the legs panel either, it stacks right
 * under Pause.
 */
function goHomeRect(view: HudView, sizes: HudControlSizes, panels: StatusPanels, pause: Rect, dash: DashLayout): Rect {
  const { w, h } = sizes.goHome;
  const x = view.cssW - HUD.margin - w;
  const underPause = HUD.margin + pause.h + HUD.gap;
  const legsRight = panels.legs.x + panels.legs.w;
  const clearOfRow = x >= legsRight + HUD.gap;
  const lowest = Math.max(underPause, ...panelList(panels).map((panel) => bottomOf(panel) + HUD.gap));
  const y = clearOfRow ? underPause : dash.bounds.y - HUD.gap - h;
  if (y >= lowest - FIT_EPSILON_PX && y + h + HUD.gap <= dash.bounds.y + FIT_EPSILON_PX) return { x, y, w, h };
  const topRowX = pause.x - HUD.gap - w;
  if (topRowX >= legsRight + HUD.gap) return { x: topRowX, y: HUD.margin, w, h };
  return { x: Math.max(HUD.margin, x), y: underPause, w, h };
}

/** Returns the square around the swim pad footprint: the base or the knob's furthest reach. */
function stickFootprintRect(stick: StickLayout): Rect {
  return squareAround(stick.centre, Math.max(stick.baseR, stick.travel + stick.knobR));
}

/** Lays out the HUD controls the way HudScene does, from measured control and panel sizes. */
export function hudControls(view: HudView, sizes: HudControlSizes): HudControls {
  const panels = statusPanelRects(sizes);
  const pause = { x: view.cssW - HUD.margin - sizes.pause.w, y: HUD.margin, w: sizes.pause.w, h: sizes.pause.h };
  const dash = dashLayoutFor(view, sizes);
  const goHome = goHomeRect(view, sizes, panels, pause, dash);
  const rowBottom = Math.max(bottomOf(pause), ...panelList(panels).map(bottomOf));
  const reserveTop = Math.max(rowBottom, bottomOf(goHome));
  const reserveRight = HUD.margin + dash.bounds.w;
  const stick = stickLayout(view, { top: reserveTop, right: reserveRight });
  return { ...panels, pause, goHome, dash, stick, stickBounds: stickFootprintRect(stick) };
}

/** Returns the bounding box of the snack counter and legs panels. */
export function statusPanelsBox(controls: HudControls): Rect {
  const panels = panelList(controls);
  const left = Math.min(...panels.map((panel) => panel.x));
  const top = Math.min(...panels.map((panel) => panel.y));
  const right = Math.max(...panels.map((panel) => panel.x + panel.w));
  const bottom = Math.max(...panels.map(bottomOf));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Returns the canal's water rows on screen: SURF to BED_TOP, the whole world fitted in view. */
function canalWaterRows(view: StickView): ScreenWaterRows {
  const { fitZoom } = fitView(view.cssW, view.cssH, 1, { worldH: WORLD_H, ...VIEW });
  return {
    top: view.cssH / 2 + (SURF - WORLD_H / 2) * fitZoom,
    bottom: view.cssH / 2 + (BED_TOP - WORLD_H / 2) * fitZoom,
  };
}

/**
 * Returns the middle of the play area: the full margin-inset width, from topFraction to
 * bottomFraction of the water as drawn on screen, between the surface and the top of the bed.
 * Inside it an overlay may cover only the status panels themselves, never open water.
 *
 * INVARIANT: the canal never scrolls vertically. fitView keeps the whole world height in view
 * (fitZoom <= cssH / WORLD_H) and fitWorldCamera in src/scenes/BootScene.ts sets camera bounds
 * exactly one view tall, centred on the world, so world row y always draws at
 * cssH / 2 + (y - WORLD_H / 2) * fitZoom. A tall area scrolls, so it passes `view.waterRows`
 * (see screenWaterRows) and this canal formula is skipped.
 */
export function playMiddle(view: HudView): Rect {
  const { top: waterTop, bottom: waterBottom } = view.waterRows ?? canalWaterRows(view);
  const top = waterTop + PLAY_MIDDLE.topFraction * (waterBottom - waterTop);
  const bottom = waterTop + PLAY_MIDDLE.bottomFraction * (waterBottom - waterTop);
  return { x: HUD.margin, y: top, w: view.cssW - 2 * HUD.margin, h: bottom - top };
}

/** Returns the control areas overlays must keep a gap from; the swim pad capture zone is not one. */
export function controlKeepOuts(controls: HudControls, options: KeepOutOptions): Rect[] {
  const keepOuts = [controls.pause];
  if (options.goHomeVisible) keepOuts.push(controls.goHome);
  keepOuts.push(controls.dash.bounds, controls.stickBounds);
  return keepOuts;
}

/**
 * Returns the find toast panel size for a panel meant to be at most `maxW` wide: icon, then a
 * column of the name (wrapped at the column room clamped to [nameMinW, nameWrapW]) over the badge
 * and detail line (wrapped at the room beside the badge clamped to [detailMinW, nameWrapW]). The
 * size is the true panel around its content, so it is wider than `maxW` when the content cannot
 * fit; a room narrower than that must not take the toast. Also returns both wrap widths used.
 */
export function findToastBox(maxW: number, measure: FindToastMeasure): FindToastBox {
  const { padX, padY, iconPx, columnGap, badgePx, badgeGap } = FIND_TOAST;
  const columnMaxW = Math.max(0, maxW) - 2 * padX - iconPx - columnGap;
  const nameWrapW = clampTo(columnMaxW, FIND_TOAST.nameMinW, FIND_TOAST.nameWrapW);
  const detailWrapW = clampTo(columnMaxW - badgePx - badgeGap, FIND_TOAST.detailMinW, FIND_TOAST.nameWrapW);
  const name = measure.nameAt(nameWrapW);
  const detail = measure.detailAt(detailWrapW);
  const columnW = Math.max(name.w, badgePx + badgeGap + detail.w);
  const columnH = name.h + Math.max(badgePx, detail.h);
  const w = 2 * padX + iconPx + columnGap + columnW;
  const h = 2 * padY + Math.max(iconPx, columnH);
  return { w, h, nameWrapW, detailWrapW };
}

/**
 * Returns a pink banner panel size for a panel meant to be at most `maxW` wide; the text wraps at
 * bannerMinWrap or wider, and the size is the true panel around the text, never clamped to `maxW`.
 */
export function bannerBox(maxW: number, textAt: (wrapW: number) => Size): Size {
  const text = textAt(Math.max(HUD.bannerMinWrap, maxW - 2 * HUD.bannerPad));
  return { w: text.w + 2 * HUD.bannerPad, h: text.h + 2 * HUD.bannerPad };
}

/** Whether `rect` and `other` are at least `gap` apart on some axis. */
function isApart(rect: Rect, other: Rect, gap: number): boolean {
  return (
    rect.x + rect.w <= other.x - gap + FIT_EPSILON_PX ||
    other.x + other.w + gap <= rect.x + FIT_EPSILON_PX ||
    rect.y + rect.h <= other.y - gap + FIT_EPSILON_PX ||
    other.y + other.h + gap <= rect.y + FIT_EPSILON_PX
  );
}

/** Whether `rect` lies inside `frame`. */
function isInside(rect: Rect, frame: Rect): boolean {
  return (
    rect.x >= frame.x - FIT_EPSILON_PX &&
    rect.y >= frame.y - FIT_EPSILON_PX &&
    rect.x + rect.w <= frame.x + frame.w + FIT_EPSILON_PX &&
    rect.y + rect.h <= frame.y + frame.h + FIT_EPSILON_PX
  );
}

/**
 * Whether an overlay at `rect` clears: finite, inside the view inset by the margin, and at least
 * a gap away from every obstacle (the control keep-outs and the other placed overlays).
 */
export function clears(rect: Rect, view: HudView, obstacles: readonly Rect[]): boolean {
  const values = [rect.x, rect.y, rect.w, rect.h];
  if (!values.every(Number.isFinite) || rect.w < 0 || rect.h < 0) return false;
  if (!isInside(rect, overlayFrame(view))) return false;
  return obstacles.every((obstacle) => isApart(rect, obstacle, HUD.gap));
}

/** Wraps a panel-size function so it runs once per distinct maxW. */
function memoiseSize(boxAt: (maxW: number) => Size): (maxW: number) => Size {
  const sizesByMaxW = new Map<number, Size>();
  return (maxW: number): Size => {
    const cached = sizesByMaxW.get(maxW);
    if (cached !== undefined) return cached;
    const size = boxAt(maxW);
    sizesByMaxW.set(maxW, size);
    return size;
  };
}

/**
 * Wraps a request so each of its panel sizes is computed once per distinct maxW; keeps the retry
 * measure only for an id that may retry, and its own rects to avoid.
 */
function memoiseRequest(request: HudOverlayRequest): SizedRequest {
  const retryBoxAt = RETRY_IDS.has(request.id) ? request.retryBoxAt : undefined;
  return {
    id: request.id,
    sizeAt: memoiseSize(request.boxAt),
    retrySizeAt: retryBoxAt === undefined ? null : memoiseSize(retryBoxAt),
    avoid: request.avoid ?? [],
  };
}

/** Returns the requests ordered by `order`, keeping only the first request for each id. */
function orderRequests(requests: readonly SizedRequest[], order: readonly HudOverlayId[]): SizedRequest[] {
  const ordered: SizedRequest[] = [];
  for (const id of order) {
    const request = requests.find((candidate) => candidate.id === id);
    if (request !== undefined) ordered.push(request);
  }
  return ordered;
}

/** Returns the sorted distinct values, each clamped into [min, max]. */
function edgeStops(values: readonly number[], min: number, max: number): number[] {
  const clamped = values.map((value) => clampTo(value, min, max));
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Returns the parts of [left, right] not covered by any of `blocks` (each [start, end]). */
function freeSpans(left: number, right: number, blocks: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...blocks].sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [];
  let cursor = left;
  for (const [start, end] of sorted) {
    if (start > cursor) spans.push([cursor, Math.min(start, right)]);
    cursor = Math.max(cursor, end);
    if (cursor >= right) break;
  }
  if (cursor < right) spans.push([cursor, right]);
  return spans.filter(([start, end]) => end > start);
}

/** Returns the sorted distinct top and bottom edges of `frame` and of `blocks`, clamped into `frame`. */
function rowStops(frame: Rect, blocks: readonly Rect[]): number[] {
  const top = frame.y;
  const bottom = bottomOf(frame);
  return edgeStops([top, bottom, ...blocks.flatMap((rect) => [rect.y, bottomOf(rect)])], top, bottom);
}

/** Returns the rects in `frame` from `bandTop` to `bandBottom` that no block in that band covers. */
function freeInBand(frame: Rect, blocks: readonly Rect[], bandTop: number, bandBottom: number): Rect[] {
  const spans = blocks
    .filter((rect) => rect.y < bandBottom && bottomOf(rect) > bandTop)
    .map((rect): [number, number] => [rect.x, rect.x + rect.w]);
  return freeSpans(frame.x, frame.x + frame.w, spans).map(([left, right]) => ({
    x: left,
    y: bandTop,
    w: right - left,
    h: bandBottom - bandTop,
  }));
}

/**
 * Returns rectangles inside `frame` that touch none of the `grown` obstacles: for each band between
 * two obstacle (or frame) edges, the horizontal spans no obstacle in that band covers.
 */
function freeRects(frame: Rect, grown: readonly Rect[]): Rect[] {
  if (!(frame.w > 0) || !(frame.h > 0)) return [];
  const stops = rowStops(frame, grown);
  const rects: Rect[] = [];
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) rects.push(...freeInBand(frame, grown, stops[i], stops[j]));
  }
  return rects;
}

/**
 * Returns the open water of the play middle: the parts of it the snack counter and legs panels do
 * not cover, one rect per span between two panel edges. Overlays never touch these.
 */
function openMiddleRects(view: HudView, controls: HudControls): Rect[] {
  const middle = playMiddle(view);
  if (!(middle.w > 0) || !(middle.h > 0)) return [];
  const panels = panelList(controls);
  const stops = rowStops(middle, panels);
  const rects: Rect[] = [];
  for (let i = 0; i + 1 < stops.length; i++) rects.push(...freeInBand(middle, panels, stops[i], stops[i + 1]));
  return rects;
}

/** Whether `rect` covers none of the open middle: inside the play middle, only the status panels. */
function keepsOffOpenMiddle(rect: Rect, openMiddle: readonly Rect[]): boolean {
  return openMiddle.every((part) => {
    const overlap = intersectRect(rect, part);
    return overlap.w <= FIT_EPSILON_PX || overlap.h <= FIT_EPSILON_PX;
  });
}

/**
 * Returns the placement tiers in order: the top edge above the middle, clear of the status row; the
 * bottom edge below the middle; then the top band (the frame top to a gap above the middle) over
 * the status row, from the top-left. The control keep-outs bound every tier, so no tier covers a
 * control; inside the play middle no tier covers open water.
 */
function overlayTiers(view: HudView, controls: HudControls): OverlayTier[] {
  const frame = overlayFrame(view);
  const middle = playMiddle(view);
  const panels = panelList(controls);
  const centredX = (size: Size): number => view.cssW / 2 - size.w / 2;
  const topBottom = middle.y - HUD.gap;
  const bottomTop = bottomOf(middle) + HUD.gap;
  const topBand = { x: frame.x, y: frame.y, w: frame.w, h: topBottom - frame.y };
  return [
    {
      edge: 'top',
      room: topBand,
      extraObstacles: panels,
      anchorFor: (size) => ({ x: centredX(size), y: frame.y }),
    },
    {
      edge: 'bottom',
      room: { x: frame.x, y: bottomTop, w: frame.w, h: bottomOf(frame) - bottomTop },
      extraObstacles: panels,
      anchorFor: (size) => ({ x: centredX(size), y: bottomOf(frame) - size.h }),
    },
    {
      edge: 'panel',
      room: topBand,
      extraObstacles: [],
      anchorFor: () => ({ x: frame.x, y: frame.y }),
    },
  ];
}

/**
 * Returns a panel sized by `sizeAt` for `room` and moved as near the tier anchor as the room
 * allows; null when it does not fit.
 */
function candidateIn(room: Rect, sizeAt: (maxW: number) => Size, anchorFor: (size: Size) => Vec2): Candidate | null {
  const size = sizeAt(room.w);
  if (size.w > room.w + FIT_EPSILON_PX || size.h > room.h + FIT_EPSILON_PX) return null;
  const anchor = anchorFor(size);
  const x = clampTo(anchor.x, room.x, room.x + room.w - size.w);
  const y = clampTo(anchor.y, room.y, room.y + room.h - size.h);
  return { rect: { x, y, w: size.w, h: size.h }, dy: Math.abs(y - anchor.y), dx: Math.abs(x - anchor.x) };
}

/** Whether candidate `a` is nearer the preferred spot than `b`. */
function isNearer(a: Candidate, b: Candidate): boolean {
  if (a.dy !== b.dy) return a.dy < b.dy;
  return a.dx < b.dx;
}

/**
 * Returns the clearing spot nearest the tier anchor among the tier's free rooms, or null. The open
 * middle bounds the free rooms as a wall with no gap.
 */
function placeInTier(
  sizeAt: (maxW: number) => Size,
  view: HudView,
  tier: OverlayTier,
  obstacles: readonly Rect[],
  openMiddle: readonly Rect[],
): Rect | null {
  const tierObstacles = [...obstacles, ...tier.extraObstacles];
  const walls = [...tierObstacles.map((rect) => growRect(rect, HUD.gap)), ...openMiddle];
  let best: Candidate | null = null;
  for (const room of freeRects(tier.room, walls)) {
    const candidate = candidateIn(room, sizeAt, tier.anchorFor);
    if (candidate === null || !clears(candidate.rect, view, tierObstacles)) continue;
    if (!keepsOffOpenMiddle(candidate.rect, openMiddle)) continue;
    if (best === null || isNearer(candidate, best)) best = candidate;
  }
  return best?.rect ?? null;
}

/** Returns the spot in the first tier with room for a panel sized by `sizeAt`, or null when no tier has room. */
function placeInTiers(
  sizeAt: (maxW: number) => Size,
  view: HudView,
  tiers: readonly OverlayTier[],
  obstacles: readonly Rect[],
  openMiddle: readonly Rect[],
): { rect: Rect; edge: OverlayEdge } | null {
  for (const tier of tiers) {
    const rect = placeInTier(sizeAt, view, tier, obstacles, openMiddle);
    if (rect !== null) return { rect, edge: tier.edge };
  }
  return null;
}

/**
 * Returns the spot for `request`: every tier at its own size first; then, only for a banner with no
 * place and a retry measure, every tier at HUD.bannerRetryTextPx. The request's own `avoid` rects
 * join `obstacles` in every tier. The find toast's textPx is null.
 */
function placeRequest(
  request: SizedRequest,
  view: HudView,
  tiers: readonly OverlayTier[],
  obstacles: readonly Rect[],
  openMiddle: readonly Rect[],
): TieredRect | null {
  const isBanner = RETRY_IDS.has(request.id);
  const ownObstacles = [...obstacles, ...request.avoid];
  const placed = placeInTiers(request.sizeAt, view, tiers, ownObstacles, openMiddle);
  if (placed !== null) return { ...placed, textPx: isBanner ? HUD.bannerTextPx : null };
  if (request.retrySizeAt === null) return null;
  const retried = placeInTiers(request.retrySizeAt, view, tiers, ownObstacles, openMiddle);
  return retried === null ? null : { ...retried, textPx: HUD.bannerRetryTextPx };
}

/** Places overlays one by one in priority order, each a gap from the keep-outs and earlier overlays. */
function fitOverlays(
  view: HudView,
  tiers: readonly OverlayTier[],
  keepOuts: readonly Rect[],
  openMiddle: readonly Rect[],
  ordered: readonly SizedRequest[],
): Map<HudOverlayId, TieredRect> {
  const placed = new Map<HudOverlayId, TieredRect>();
  for (const request of ordered) {
    const obstacles = [...keepOuts, ...[...placed.values()].map((entry) => entry.rect)];
    const tiered = placeRequest(request, view, tiers, obstacles, openMiddle);
    if (tiered !== null) placed.set(request.id, tiered);
  }
  return placed;
}

/**
 * Places the requested overlays in priority order, each in the first tier with room: the top edge
 * above the play middle, clear of the status row; the bottom edge below it; then the top band over
 * the status row.
 * In every tier, inside the play middle an overlay covers only the status panels themselves.
 * A request's `avoid` rects bind only that request, in every tier and in the final check.
 * A banner (snackBanner or hint) with no place at HUD.bannerTextPx tries every tier again with its
 * retryBoxAt size at HUD.bannerRetryTextPx, if given; the find toast never retries or shrinks.
 * Returns one placement per request, in request order; a rect is null when that overlay has no
 * room (or its id was already answered), never clipped. Each placed banner reports the text size it
 * was placed at; textPx is null for the find toast and for any overlay with no place.
 */
export function placeHudOverlays(
  view: HudView,
  controls: HudControls,
  keepOuts: readonly Rect[],
  requests: readonly HudOverlayRequest[],
): HudOverlayPlacement[] {
  const sized = requests.map(memoiseRequest);
  const tiers = overlayTiers(view, controls);
  const openMiddle = openMiddleRects(view, controls);
  const ordered = orderRequests(sized, HUD_OVERLAY_PRIORITY);
  const fitted = fitOverlays(view, tiers, keepOuts, openMiddle, ordered);
  const avoidById = new Map(ordered.map((request) => [request.id, request.avoid]));
  const checked = checkPlacements(view, keepOuts, openMiddle, fitted, avoidById);
  const answered = new Set<HudOverlayId>();
  return requests.map((request) => {
    const tiered = answered.has(request.id) ? null : (checked.get(request.id) ?? null);
    answered.add(request.id);
    return {
      id: request.id,
      rect: tiered?.rect ?? null,
      edge: tiered?.edge ?? null,
      textPx: tiered?.textPx ?? null,
    };
  });
}

/**
 * Re-checks every placed rect with clears() and the middle rule (no open middle covered, whatever
 * the tier); each rect also checks against its own request's `avoid` rects. A rect that fails
 * becomes null.
 */
function checkPlacements(
  view: HudView,
  keepOuts: readonly Rect[],
  openMiddle: readonly Rect[],
  placed: ReadonlyMap<HudOverlayId, TieredRect>,
  avoidById: ReadonlyMap<HudOverlayId, readonly Rect[]>,
): Map<HudOverlayId, TieredRect | null> {
  const rects = [...placed.values()].map((entry) => entry.rect);
  const checked = new Map<HudOverlayId, TieredRect | null>();
  for (const [id, tiered] of placed) {
    const others = rects.filter((other) => other !== tiered.rect);
    const obstacles = [...keepOuts, ...others, ...(avoidById.get(id) ?? [])];
    const ok = clears(tiered.rect, view, obstacles) && keepsOffOpenMiddle(tiered.rect, openMiddle);
    checked.set(id, ok ? tiered : null);
  }
  return checked;
}
