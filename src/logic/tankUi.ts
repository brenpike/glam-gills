/**
 * Home Tank UI rules: the keyboard map, focus stepping, and the CSS px layouts of the hub, decorate
 * and Treasure Chest screens (PRD C7, C9, C11, X5); the Collection Book reuses the chest layout (C12). Sizes come in measured; nothing here shrinks a
 * control or its text. The hub and decorate controls keep clear of the Floating and Hanging band
 * (issue #95) by choosing between their full and compact sizes, both at least PRD X5.
 */
import type { HudView, Rect, Size } from './hudLayout';
import { decorationBandTop, lidTopCss, topKeepClearCss, type TankFrame } from './tank';
import {
  CLOSE_LABEL,
  COLLECTION_BOOK_LABEL,
  DECORATE_LABEL,
  DONE_LABEL,
  GO_EXPLORING_LABEL,
  NEXT_PAGE_LABEL,
  PREVIOUS_PAGE_LABEL,
  REFUGE_LABEL,
  SOUND_LABEL,
  TREASURE_CHEST_LABEL,
} from './tankText';

/** A Home Tank keyboard action. */
export type TankKey = 'left' | 'right' | 'up' | 'down' | 'next' | 'previous' | 'confirm' | 'cancel' | 'putAway';

/** Home Tank UI constants in CSS px: edge margin, gap between targets, and panel padding. */
export const UI = Object.freeze({ margin: 16, gap: 12, pad: 12 });

/** Side of one decorate tray square, in CSS px. */
export const TRAY_PX = 64;

/** Side of one compact decorate tray square, in CSS px (PRD X5: at least 48). */
export const COMPACT_TRAY_PX = 48;

/** Most rows of tray squares on one decorate tray page (PRD C9, open question 198). */
export const TRAY_PAGE_ROWS = 2;

/** A compact icon-only tile button in CSS px: a 48 x 48 body (PRD X5) round a 32 px icon, no label. */
export const ICON_TILE = Object.freeze({ w: 48, h: 48, iconPx: 32 });

/**
 * A wide button at size 1, in CSS px, as createButton (src/scenes/BootScene.ts) builds it: the
 * BUTTON_WIDE body and ICON_SIZE icon of src/art/drawUi.ts, the gap between icon and label, and the
 * label size from size 1 up. src/logic must not import art or scenes, so these are copies.
 */
export const WIDE_BUTTON = Object.freeze({ w: 200, h: 64, iconPx: 32, iconGap: 8, labelPx: 24 });

/** Bold label advance per em used to size buttons; errs wide (the cardCopyFit text estimate). */
export const LABEL_BOLD_EM = 0.6;

/**
 * A square tile button at size 1, in CSS px, as createButton (src/scenes/BootScene.ts) builds it: the
 * BUTTON_SQUARE body of src/art/drawUi.ts and the SQUARE_LABEL_PX label, drawn under the icon.
 * src/logic must not import art or scenes, so these are copies.
 */
export const TILE_BUTTON = Object.freeze({ w: 64, h: 64, labelPx: 22 });

/** Least room between a label-sized button's content row and each side of its body, in CSS px. */
export const BUTTON_LABEL_PAD = 6;

/** `px` rounded up to a whole CSS px, ignoring float noise just over a whole number. */
function wholePxUp(px: number): number {
  return Math.ceil(px - 1e-6);
}

/**
 * Body width of a label-sized size-1 wide button labelled `label`: just enough for the icon, the gap
 * and the label (estimated wide) with BUTTON_LABEL_PAD each side, in whole CSS px. No minimum body.
 */
export function labelButtonWidth(label: string): number {
  const labelW = label.length * LABEL_BOLD_EM * WIDE_BUTTON.labelPx;
  return wholePxUp(WIDE_BUTTON.iconPx + WIDE_BUTTON.iconGap + labelW + 2 * BUTTON_LABEL_PAD);
}

/**
 * Body width of a size-1 wide button labelled `label`: at least WIDE_BUTTON.w, and enough for the
 * icon, the gap and the label (estimated wide) with BUTTON_LABEL_PAD each side, in whole CSS px.
 */
export function wideButtonWidth(label: string): number {
  return Math.max(WIDE_BUTTON.w, labelButtonWidth(label));
}

/** The compact Done button: a label-sized wide button, 64 px tall (PRD X5 primary). */
export const COMPACT_DONE: Size = Object.freeze({ w: labelButtonWidth(DONE_LABEL), h: WIDE_BUTTON.h });

/**
 * Body width of a size-1 square tile labelled `label`: at least TILE_BUTTON.w, and enough for the
 * label (estimated wide; the icon sits above it) with BUTTON_LABEL_PAD each side, in whole CSS px.
 */
export function tileButtonWidth(label: string): number {
  const labelW = label.length * LABEL_BOLD_EM * TILE_BUTTON.labelPx;
  return wholePxUp(Math.max(TILE_BUTTON.w, labelW + 2 * BUTTON_LABEL_PAD));
}

/** A Home Tank hub action id. */
export type HubActionId = 'goExploring' | 'decorate' | 'treasureChest' | 'collectionBook' | 'refuge' | 'sound';

/** One hub action button: its id, its label, and whether it is the primary action. */
export interface HubButtonSpec {
  id: HubActionId;
  label: string;
  primary: boolean;
}

/**
 * The hub actions in focus and layout order, Go exploring first (PRD C7), then Refuge (PRD N2) and
 * Sound last, which opens the Sound card with the music and sounds switches (PRD M8, S14).
 */
export const HUB_BUTTONS: readonly HubButtonSpec[] = Object.freeze([
  Object.freeze({ id: 'goExploring', label: GO_EXPLORING_LABEL, primary: true }),
  Object.freeze({ id: 'decorate', label: DECORATE_LABEL, primary: false }),
  Object.freeze({ id: 'treasureChest', label: TREASURE_CHEST_LABEL, primary: false }),
  Object.freeze({ id: 'collectionBook', label: COLLECTION_BOOK_LABEL, primary: false }),
  Object.freeze({ id: 'refuge', label: REFUGE_LABEL, primary: false }),
  Object.freeze({ id: 'sound', label: SOUND_LABEL, primary: false }),
]);

/** How a hub button is drawn: its createButton shape and its size-1 body in CSS px. */
export interface HubButtonLook {
  shape: 'wide' | 'square';
  w: number;
  h: number;
}

/**
 * The look of a hub button: the primary is a wide button and the others square tiles, each a
 * size-1 body widened to hold its label (PRD X5: the primary stays 64 px tall).
 */
export function hubButtonLook(spec: Pick<HubButtonSpec, 'label' | 'primary'>): HubButtonLook {
  if (spec.primary) return { shape: 'wide', w: wideButtonWidth(spec.label), h: WIDE_BUTTON.h };
  return { shape: 'square', w: tileButtonWidth(spec.label), h: TILE_BUTTON.h };
}

/** How a hub button is drawn when the hub is compact: its shape and its body in CSS px. */
export interface HubCompactLook {
  shape: 'wide' | 'icon';
  w: number;
  h: number;
}

/**
 * The compact look of a hub button: the primary keeps its wide labelled body (PRD X5: 64 px tall);
 * the others become ICON_TILE icon-only tiles, named by the hub focus caption.
 */
export function hubButtonCompactLook(spec: Pick<HubButtonSpec, 'label' | 'primary'>): HubCompactLook {
  if (spec.primary) return { shape: 'wide', w: wideButtonWidth(spec.label), h: WIDE_BUTTON.h };
  return { shape: 'icon', w: ICON_TILE.w, h: ICON_TILE.h };
}

/** Size of every Treasure Chest button: square tiles wide enough for the widest of Back, Close and Next. */
export const CHEST_BUTTON: Size = Object.freeze({
  w: Math.max(...[PREVIOUS_PAGE_LABEL, CLOSE_LABEL, NEXT_PAGE_LABEL].map(tileButtonWidth)),
  h: TILE_BUTTON.h,
});

/** One hub action button to place: its id, its measured full size and its measured compact size (the full size when absent). */
export interface HubAction {
  id: string;
  w: number;
  h: number;
  compact?: Size;
}

/** A band of canvas y the hub and decorate controls may use, in CSS px. */
export interface TankRoom {
  top: number;
  bottom: number;
}

/** Where a hub action goes. */
export interface HubActionPlacement {
  id: string;
  rect: Rect;
}

/**
 * The hub layout: the title (null when it does not fit), the action buttons in input order, whether
 * they use their compact sizes, whether their rows reach over the floor Decorations (into the reach
 * rooms), and the room of the last row (the first room when there are none).
 */
export interface HubLayout {
  title: Rect | null;
  actions: HubActionPlacement[];
  compact: boolean;
  reach: boolean;
  room: TankRoom;
}

/** Measured compact sizes of Put away, Done and the tray page buttons (an ICON_TILE when absent). */
export interface DecorateCompactSizes {
  putAway: Size;
  done: Size;
  pageButton?: Size;
}

/**
 * Measured sizes of the decorate controls; `caption` is null when there is no caption. `pageButton`
 * (Back and Next) defaults to CHEST_BUTTON. `compact` defaults to an ICON_TILE Put away and page
 * buttons and COMPACT_DONE.
 */
export interface DecorateSizes {
  putAway: Size;
  done: Size;
  caption: Size | null;
  pageButton?: Size;
  compact?: DecorateCompactSizes;
}

/**
 * The decorate layout: one square per tray item on the shown page, the Put away slot, Done, the Back
 * and Next page buttons (null when the tray has one page), the caption (null when hidden), whether
 * the controls use their compact sizes, and the room of their last row. `page` is the shown page
 * (clamped), of `pageCount`; its squares are the tray items from `trayStart`, at most `pageSize` of them.
 */
export interface DecorateLayout {
  tray: Rect[];
  putAway: Rect;
  done: Rect;
  previousPage: Rect | null;
  nextPage: Rect | null;
  caption: Rect | null;
  compact: boolean;
  room: TankRoom;
  page: number;
  pageCount: number;
  trayStart: number;
  pageSize: number;
}

/** Treasure Chest measurements: wrapped text blocks at a wrap width, and fixed sizes. */
export interface ChestMeasure {
  titleAt: (wrapW: number) => Size;
  headingAt: (wrapW: number) => Size;
  pageText: Size;
  close: Size;
  back: Size;
  next: Size;
}

/** The Treasure Chest layout. `list` is the room for entry rows. */
export interface ChestLayout {
  panel: Rect;
  title: Rect;
  heading: Rect;
  pageText: Rect;
  list: Rect;
  close: Rect;
  back: Rect;
  next: Rect;
}

const KEY_ACTIONS: Readonly<Record<string, TankKey>> = Object.freeze({
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'cancel',
  Delete: 'putAway',
  Backspace: 'putAway',
});

/**
 * The Home Tank action for a `KeyboardEvent.key` value: arrows move, Tab is next and Shift+Tab
 * previous, Enter and Space confirm, Escape cancels, Delete and Backspace put away. Else null.
 */
export function tankKeyFor(key: string, shiftKey: boolean): TankKey | null {
  if (key === 'Tab') return shiftKey ? 'previous' : 'next';
  return Object.hasOwn(KEY_ACTIONS, key) ? KEY_ACTIONS[key] : null;
}

/**
 * The focus index `step` places from `current`, wrapping over `count` targets. -1 when there are no
 * targets. From no valid focus, a forward or zero step gives the first and a backward step the last.
 */
export function nextFocusIndex(current: number, count: number, step: number): number {
  if (!(count > 0)) return -1;
  const total = Math.floor(count);
  if (!Number.isInteger(current) || current < 0 || current >= total) return step < 0 ? total - 1 : 0;
  const move = Number.isFinite(step) ? Math.trunc(step) : 0;
  return (((current + move) % total) + total) % total;
}

/** Whole entry rows of height `rowH` with `gap` between them that fit `listH`; at least 1. */
export function rowsPerPage(listH: number, rowH: number, gap: number): number {
  if (!(rowH > 0) || !Number.isFinite(listH)) return 1;
  const spacing = Number.isFinite(gap) && gap > 0 ? gap : 0;
  return Math.max(1, Math.floor((listH + spacing) / (rowH + spacing)));
}

/** One flow row: the items from `start` up to `end` (exclusive), their width with gaps between, and the tallest height. */
interface FlowRow {
  start: number;
  end: number;
  w: number;
  h: number;
}

/** Splits `sizes` into rows that each take items in order while they fit `maxW` with `UI.gap` between. */
function splitRows(sizes: readonly Size[], maxW: number): FlowRow[] {
  const rows: FlowRow[] = [];
  let start = 0;
  while (start < sizes.length) {
    let end = start + 1;
    let rowW = sizes[start].w;
    while (end < sizes.length && rowW + UI.gap + sizes[end].w <= maxW) {
      rowW += UI.gap + sizes[end].w;
      end++;
    }
    rows.push({ start, end, w: rowW, h: Math.max(...sizes.slice(start, end).map((size) => size.h)) });
    start = end;
  }
  return rows;
}

/** Rects for `rows` of `sizes`: each row centred on `centreX` at its top in `tops`, its items centred vertically. */
function placeRows(sizes: readonly Size[], rows: readonly FlowRow[], centreX: number, tops: readonly number[]): Rect[] {
  const rects: Rect[] = [];
  rows.forEach((row, index) => {
    let x = centreX - row.w / 2;
    for (const size of sizes.slice(row.start, row.end)) {
      rects.push({ x, y: tops[index] + (row.h - size.h) / 2, w: size.w, h: size.h });
      x += size.w + UI.gap;
    }
  });
  return rects;
}

/** Row tops stacking `rows` from `top`, `UI.gap` apart. */
function stackTops(rows: readonly FlowRow[], top: number): number[] {
  const tops: number[] = [];
  let rowTop = top;
  for (const row of rows) {
    tops.push(rowTop);
    rowTop += row.h + UI.gap;
  }
  return tops;
}

/**
 * Lays `sizes` out in rows from `top`: each row takes items in order while they fit `maxW` with
 * `UI.gap` between, is centred on `centreX`, and centres its items vertically. Rows are `UI.gap` apart.
 */
function flowRows(sizes: readonly Size[], centreX: number, maxW: number, top: number): Rect[] {
  const rows = splitRows(sizes, maxW);
  return placeRows(sizes, rows, centreX, stackTops(rows, top));
}

/** Bottom edge of the lowest rect, or `fallback` when there are none. */
function bottomOfAll(rects: readonly Rect[], fallback: number): number {
  return rects.reduce((bottom, rect) => Math.max(bottom, rect.y + rect.h), fallback);
}

/** Lowest bottom edge the tank screens' controls may reach: a gap above the Decorations and the edge margin. */
function controlsLimit(view: HudView, frame: TankFrame): number {
  return Math.min(decorationBandTop(frame) - UI.gap, view.cssH - UI.margin);
}

/** Top of the open water: a gap under the band kept clear for Floating and Hanging items. */
function openWaterTop(frame: TankFrame): number {
  return topKeepClearCss(frame).y1 + UI.gap;
}

/** The wall above the tank lid and the open water, before short rooms are dropped. */
function roomCandidates(view: HudView, frame: TankFrame): [TankRoom, TankRoom] {
  return [
    { top: UI.margin, bottom: lidTopCss(frame) - UI.gap },
    { top: openWaterTop(frame), bottom: controlsLimit(view, frame) },
  ];
}

/**
 * The rooms the hub and decorate controls may use, top first: the wall (from the top margin to a gap
 * above the tank lid) and the open water (from a gap under the Floating and Hanging keep-clear band to
 * a gap above the floor Decorations, inside the bottom margin). Rooms under ICON_TILE.h tall are dropped.
 */
export function tankRooms(view: HudView, frame: TankFrame): TankRoom[] {
  return roomCandidates(view, frame).filter((room) => room.bottom - room.top >= ICON_TILE.h);
}

/** The tallest of `rooms` (the first on a tie), or the open water when there are none. */
function tallestRoom(view: HudView, frame: TankFrame, rooms: readonly TankRoom[]): TankRoom {
  const candidates = rooms.length > 0 ? rooms : [roomCandidates(view, frame)[1]];
  return candidates.reduce((best, room) => (room.bottom - room.top > best.bottom - best.top ? room : best));
}

/** Row tops down the rooms and the room of the last row. */
interface RoomFill {
  tops: number[];
  room: TankRoom;
}

/** `rows` placed down `rooms` in order, each row whole inside one room; null when they do not all fit. */
function fillRooms(rows: readonly FlowRow[], rooms: readonly TankRoom[]): RoomFill | null {
  if (rooms.length === 0) return null;
  const tops: number[] = [];
  let index = 0;
  let rowTop = rooms[0].top;
  for (const row of rows) {
    while (rowTop + row.h > rooms[index].bottom) {
      index++;
      if (index >= rooms.length) return null;
      rowTop = rooms[index].top;
    }
    tops.push(rowTop);
    rowTop += row.h + UI.gap;
  }
  return { tops, room: rooms[index] };
}

/** Which look (index into the looks tried) the controls use and the rooms their rows fill in order. */
interface RowPlan {
  look: number;
  rooms: readonly TankRoom[];
}

/**
 * Where control rows go, tried in order: each look (full first) in one room, the wall then the water;
 * then the last (compact) look split across the rooms in order; else the last look from the top of
 * the tallest room.
 */
function planRows(view: HudView, frame: TankFrame, looks: readonly (readonly Size[])[]): RowPlan {
  const rooms = tankRooms(view, frame);
  const maxW = view.cssW - 2 * UI.margin;
  for (let look = 0; look < looks.length; look++) {
    const rows = splitRows(looks[look], maxW);
    const room = rooms.find((candidate) => fillRooms(rows, [candidate]) !== null);
    if (room !== undefined) return { look, rooms: [room] };
  }
  const last = looks.length - 1;
  if (fillRooms(splitRows(looks[last], maxW), rooms) !== null) return { look: last, rooms };
  return { look: last, rooms: [tallestRoom(view, frame, rooms)] };
}

/** `rows` down the plan's rooms, or stacked from the top of its first room when they do not fit. */
function fillPlan(rows: readonly FlowRow[], plan: RowPlan): RoomFill {
  return fillRooms(rows, plan.rooms) ?? { tops: stackTops(rows, plan.rooms[0].top), room: plan.rooms[0] };
}

/** A rect of `size` centred across the view at `top`. */
function centredAt(view: HudView, size: Size, top: number): Rect {
  return { x: (view.cssW - size.w) / 2, y: top, w: size.w, h: size.h };
}

/** True when `a` and `b` are at least `UI.gap` apart across or down. */
function isApart(a: Rect, b: Rect): boolean {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy) >= UI.gap - 1e-9;
}

/** A rect of `size` centred across the view at `top`, dropped a gap below each obstacle it comes within a gap of. */
function centredClearOf(view: HudView, size: Size, top: number, obstacles: readonly Rect[]): Rect {
  let rect = centredAt(view, size, top);
  let hit = obstacles.find((obstacle) => !isApart(rect, obstacle));
  while (hit !== undefined) {
    rect = centredAt(view, size, hit.y + hit.h + UI.gap);
    hit = obstacles.find((obstacle) => !isApart(rect, obstacle));
  }
  return rect;
}

/**
 * Where a caption of `size` goes: centred a gap under the controls (lowest edge `controlsBottom`)
 * inside their `room`; else in the open water from the lower of that and the water top, possibly over
 * the floor Decorations, inside the bottom margin. Never in the Floating and Hanging keep-clear band,
 * and a gap from every obstacle (dropping below one it would touch). Null when it fits neither place.
 */
function captionRect(
  view: HudView,
  frame: TankFrame,
  controlsBottom: number,
  room: TankRoom,
  size: Size,
  obstacles: readonly Rect[],
): Rect | null {
  if (size.w > view.cssW - 2 * UI.margin) return null;
  const top = controlsBottom + UI.gap;
  const inRoom = centredClearOf(view, size, top, obstacles);
  if (inRoom.y + inRoom.h <= room.bottom) return inRoom;
  const inWater = centredClearOf(view, size, Math.max(top, openWaterTop(frame)), obstacles);
  return inWater.y + inWater.h <= view.cssH - UI.margin ? inWater : null;
}

/** The measured full size of a hub action. */
function fullSize(action: HubAction): Size {
  return { w: action.w, h: action.h };
}

/**
 * The hub layout. The actions take the first of: their full sizes in one room (the wall, then the
 * water); their compact sizes in one room; compact rows split across the rooms in order; compact rows
 * in the reach rooms (trayReachRooms) by the same order of tries, over the floor Decorations (`reach`);
 * compact rows from the top of the tallest room. The title (measured at `cssW - 2 * UI.margin`) sits
 * at the top of a single room, above the actions, only when it fits across and the actions still fit
 * that room; never when the rows reach.
 */
export function hubLayout(view: HudView, frame: TankFrame, actions: readonly HubAction[], title: Size | null): HubLayout {
  const full = actions.map(fullSize);
  const compact = actions.map((action) => action.compact ?? fullSize(action));
  const plan = planRows(view, frame, [full, compact]);
  const sizes = plan.look === 0 ? full : compact;
  const rows = splitRows(sizes, view.cssW - 2 * UI.margin);
  const isCompact = plan.look === 1;
  const titled = plan.rooms.length === 1 ? titledFill(view, rows, plan.rooms[0], title) : null;
  const reached = titled === null ? reachFill(view, frame, rows, plan) : null;
  const fill = titled ?? reached ?? fillPlan(rows, plan);
  const rects = placeRows(sizes, rows, view.cssW / 2, fill.tops);
  return {
    title: titled !== null && title !== null ? centredAt(view, title, plan.rooms[0].top) : null,
    actions: placeActions(actions, rects),
    compact: isCompact,
    reach: reached !== null,
    room: fill.room,
  };
}

/** `rows` in the reach rooms when they fit none of the plan's rooms; null when they fit the plan or not the reach rooms either. */
function reachFill(view: HudView, frame: TankFrame, rows: readonly FlowRow[], plan: RowPlan): RoomFill | null {
  if (fillRooms(rows, plan.rooms) !== null) return null;
  return fillReach(rows, trayReachRooms(view, frame));
}

/** `rows` under `title` at the top of `room`; null without a title or when it and the rows do not fit across and down. */
function titledFill(view: HudView, rows: readonly FlowRow[], room: TankRoom, title: Size | null): RoomFill | null {
  if (title === null || title.w > view.cssW - 2 * UI.margin || room.top + title.h > room.bottom) return null;
  const fill = fillRooms(rows, [{ top: room.top + title.h + UI.gap, bottom: room.bottom }]);
  return fill === null ? null : { tops: fill.tops, room };
}

/** Pairs each action id with its rect. */
function placeActions(actions: readonly HubAction[], rects: readonly Rect[]): HubActionPlacement[] {
  return actions.map((action, index) => ({ id: action.id, rect: rects[index] }));
}

/**
 * Where the hub focus caption (the focused button's label, which names the compact icon-only tiles)
 * of size `caption` goes, a gap from every obstacle such as the best-stars badge: centred a gap under
 * the hub inside the room of its last row; else in the open water from the lower of that and the
 * water top, possibly over the floor Decorations, inside the bottom margin; never in the Floating and
 * Hanging keep-clear band. Null when there is no place.
 */
export function hubCaptionRect(
  view: HudView,
  frame: TankFrame,
  hub: HubLayout,
  caption: Size,
  obstacles: readonly Rect[],
): Rect | null {
  const rects = hub.actions.map((action) => action.rect);
  if (hub.title !== null) rects.push(hub.title);
  return captionRect(view, frame, bottomOfAll(rects, hub.room.top - UI.gap), hub.room, caption, obstacles);
}

/** A tray count as a whole number of squares; 0 for negative or non-finite counts. */
function wholeTrayCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** One decorate look: whether it is compact, the tray square side, and the Put away, Done and page button sizes. */
interface DecorateLook {
  compact: boolean;
  trayPx: number;
  putAway: Size;
  done: Size;
  pageButton: Size;
}

/**
 * The rooms a tray of more than 4 (art guide 7f) and hub rows that fit no room may reach into, top first: the wall down to a gap
 * above the Floating and Hanging keep-clear band, and the open water down to the bottom margin, over
 * the floor Decorations. Rooms under ICON_TILE.h tall are dropped.
 */
function trayReachRooms(view: HudView, frame: TankFrame): TankRoom[] {
  const [wall, water] = roomCandidates(view, frame);
  const reach = [
    { top: wall.top, bottom: topKeepClearCss(frame).y0 - UI.gap },
    { top: water.top, bottom: view.cssH - UI.margin },
  ];
  return reach.filter((room) => room.bottom - room.top >= ICON_TILE.h);
}

/** `rows` in the reach rooms by the hub's order of tries: one room, top first, then split down them in order. */
function fillReach(rows: readonly FlowRow[], reach: readonly TankRoom[]): RoomFill | null {
  for (const room of reach) {
    const fill = fillRooms(rows, [room]);
    if (fill !== null) return fill;
  }
  return fillRooms(rows, reach);
}

/** The decorate controls in flow order for `count` tray squares: the squares, Put away, then Done. */
function decorateFlow(look: DecorateLook, count: number): Size[] {
  return [...traySquares(look, count), look.putAway, look.done];
}

/** `count` tray squares of the look. */
function traySquares(look: DecorateLook, count: number): Size[] {
  const square: Size = { w: look.trayPx, h: look.trayPx };
  return Array.from({ length: count }, () => square);
}

/** The full and compact decorate looks for `sizes`. */
function decorateLooks(sizes: DecorateSizes): [DecorateLook, DecorateLook] {
  const compactSizes = sizes.compact ?? { putAway: { w: ICON_TILE.w, h: ICON_TILE.h }, done: COMPACT_DONE };
  return [
    { compact: false, trayPx: TRAY_PX, putAway: sizes.putAway, done: sizes.done, pageButton: sizes.pageButton ?? CHEST_BUTTON },
    {
      compact: true,
      trayPx: COMPACT_TRAY_PX,
      putAway: compactSizes.putAway,
      done: compactSizes.done,
      pageButton: compactSizes.pageButton ?? { w: ICON_TILE.w, h: ICON_TILE.h },
    },
  ];
}

/** The decorate layout without its caption and look. */
type DecorateControls = Omit<DecorateLayout, 'caption' | 'compact'>;

/**
 * The whole tray on one page by the tray rule: `count` squares, Put away and Done in rows down the
 * plan's rooms, else the reach rooms. Null when they fit neither.
 */
function onePageControls(view: HudView, frame: TankFrame, look: DecorateLook, count: number, plan: RowPlan): DecorateControls | null {
  const flow = decorateFlow(look, count);
  const rows = splitRows(flow, view.cssW - 2 * UI.margin);
  const fill = fillRooms(rows, plan.rooms) ?? fillReach(rows, trayReachRooms(view, frame));
  if (fill === null) return null;
  const rects = placeRows(flow, rows, view.cssW / 2, fill.tops);
  return {
    tray: rects.slice(0, count),
    putAway: rects[count],
    done: rects[count + 1],
    previousPage: null,
    nextPage: null,
    room: fill.room,
    page: 0,
    pageCount: 1,
    trayStart: 0,
    pageSize: count,
  };
}

/** Sizes and rows of one tray page: `squares` tray squares in rows, then the control row (Back and Next when `paged`, Put away, Done). */
interface PageFlow {
  sizes: Size[];
  rows: FlowRow[];
  trayRows: number;
}

/** One tray page's flow: rows of `squares` squares, then the controls in rows of their own. */
function pageFlow(look: DecorateLook, squares: number, paged: boolean, maxW: number): PageFlow {
  const tray = traySquares(look, squares);
  const pageButtons = paged ? [look.pageButton, look.pageButton] : [];
  const controls = [...pageButtons, look.putAway, look.done];
  const trayRows = splitRows(tray, maxW);
  const controlRows = splitRows(controls, maxW).map((row) => ({ ...row, start: row.start + squares, end: row.end + squares }));
  return { sizes: [...tray, ...controls], rows: [...trayRows, ...controlRows], trayRows: trayRows.length };
}

/** How a paged tray sits: its rows of squares a page, squares a row, and the row tops of a full page. */
interface PagePlan {
  rows: number;
  perRow: number;
  fill: RoomFill;
}

/** `rows` by the hub's order of tries in the rooms, then in the reach rooms; null when they fit neither. */
function fillTankRows(view: HudView, frame: TankFrame, rows: readonly FlowRow[]): RoomFill | null {
  return fillReach(rows, tankRooms(view, frame)) ?? fillReach(rows, trayReachRooms(view, frame));
}

/**
 * The paged tray plan: as many squares a row as fit across, and the most rows a page, up to
 * TRAY_PAGE_ROWS, for which a full page with Back and Next fits the rooms (else the reach rooms);
 * else one row a page stacked from the top of the tallest room.
 */
function pagePlan(view: HudView, frame: TankFrame, look: DecorateLook): PagePlan {
  const maxW = view.cssW - 2 * UI.margin;
  const perRow = Math.max(1, Math.floor((maxW + UI.gap) / (look.trayPx + UI.gap)));
  for (let rows = TRAY_PAGE_ROWS; rows >= 1; rows--) {
    const fill = fillTankRows(view, frame, pageFlow(look, rows * perRow, true, maxW).rows);
    if (fill !== null) return { rows, perRow, fill };
  }
  const room = tallestRoom(view, frame, tankRooms(view, frame));
  return { rows: 1, perRow, fill: { tops: stackTops(pageFlow(look, perRow, true, maxW).rows, room.top), room } };
}

/** `page` as a whole page index from 0 to `pageCount - 1`; 0 when not finite. */
function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 0;
  return Math.min(pageCount - 1, Math.max(0, Math.floor(page)));
}

/**
 * The tray in pages by `pagePlan`: page `page` (clamped) of `count` squares, with Back, Next, Put away
 * and Done in the row under them. Back and Next show only when there is more than one page. Every
 * page uses the row tops of a full page, so the control row holds still as the pages turn.
 */
function pagedControls(view: HudView, frame: TankFrame, look: DecorateLook, count: number, page: number): DecorateControls {
  const plan = pagePlan(view, frame, look);
  const pageSize = plan.rows * plan.perRow;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const shown = clampPage(page, pageCount);
  const trayStart = shown * pageSize;
  const squares = Math.min(pageSize, count - trayStart);
  const paged = pageCount > 1;
  const flow = pageFlow(look, squares, paged, view.cssW - 2 * UI.margin);
  const tops = flow.rows.map((_, index) => plan.fill.tops[index < flow.trayRows ? index : plan.rows + index - flow.trayRows]);
  const rects = placeRows(flow.sizes, flow.rows, view.cssW / 2, tops);
  const controls = rects.slice(squares);
  const [previousPage, nextPage] = paged ? controls : [null, null];
  const [putAway, done] = controls.slice(paged ? 2 : 0);
  return { tray: rects.slice(0, squares), putAway, done, previousPage, nextPage, room: plan.fill.room, page: shown, pageCount, trayStart, pageSize };
}

/** Every control rect of `controls`: the tray squares, Put away, Done, and Back and Next when shown. */
function controlRects(controls: DecorateControls): Rect[] {
  const pageButtons = [controls.previousPage, controls.nextPage].filter((rect): rect is Rect => rect !== null);
  return [...controls.tray, controls.putAway, controls.done, ...pageButtons];
}

/**
 * The decorate layout: tray squares, the Put away slot (always reserved) and Done in centred rows.
 * The look (full: TRAY_PX squares and the measured sizes; compact: COMPACT_TRAY_PX squares and the
 * compact sizes) and the rooms come from `maxTrayCount` squares (at least `trayCount`) by the hub's
 * order of tries, so they hold still as the tray empties; then `trayCount` squares are laid out
 * there. Rows that fit none of those rooms (a tray of more than 4) take the same order of tries in
 * the reach rooms (trayReachRooms). A tray that fits neither goes in pages (PRD C9, open question
 * 198): up to TRAY_PAGE_ROWS rows of squares a page, then Back, Next, Put away and Done in a row, by
 * the same order of tries, showing page `page` (clamped). The caption (measured at
 * `cssW - 2 * UI.margin`) goes by the hub focus caption rule.
 */
export function decorateLayout(
  view: HudView,
  frame: TankFrame,
  trayCount: number,
  sizes: DecorateSizes,
  maxTrayCount: number = trayCount,
  page = 0,
): DecorateLayout {
  const count = wholeTrayCount(trayCount);
  const maxCount = Math.max(count, wholeTrayCount(maxTrayCount));
  const looks = decorateLooks(sizes);
  const plan = planRows(view, frame, looks.map((candidate) => decorateFlow(candidate, maxCount)));
  const look = looks[plan.look];
  const controls = onePageControls(view, frame, look, count, plan) ?? pagedControls(view, frame, look, count, page);
  const caption = sizes.caption;
  const controlsBottom = bottomOfAll(controlRects(controls), controls.room.top);
  return {
    ...controls,
    caption: caption === null ? null : captionRect(view, frame, controlsBottom, controls.room, caption, []),
    compact: look.compact,
  };
}

/** The page of `layout`'s tray that holds the tray item at `itemIndex`, clamped to its pages. */
export function trayPageOf(layout: Pick<DecorateLayout, 'pageCount' | 'pageSize'>, itemIndex: number): number {
  if (!(layout.pageSize > 0)) return 0;
  return clampPage(itemIndex / layout.pageSize, layout.pageCount);
}

/**
 * The Treasure Chest layout: a panel inside the edge margins with `UI.pad` inside it, the title and
 * the heading at the top left and the entry list below them. Landscape (`cssW > cssH`): a right
 * column with Close at the top and Back over Next at the bottom, and the page text under the list.
 * Portrait: the page text above a bottom row of Back, Next and Close (wrapping when it must).
 * Titles and headings are measured at the content width.
 */
export function chestLayout(view: HudView, measure: ChestMeasure): ChestLayout {
  const panel: Rect = {
    x: UI.margin,
    y: UI.margin,
    w: Math.max(0, view.cssW - 2 * UI.margin),
    h: Math.max(0, view.cssH - 2 * UI.margin),
  };
  const inner: Rect = {
    x: panel.x + UI.pad,
    y: panel.y + UI.pad,
    w: Math.max(0, panel.w - 2 * UI.pad),
    h: Math.max(0, panel.h - 2 * UI.pad),
  };
  return view.cssW > view.cssH ? landscapeChest(panel, inner, measure) : portraitChest(panel, inner, measure);
}

/** A rect of `size` centred across a column from `x` that is `columnW` wide, at `top`. */
function inColumn(size: Size, x: number, columnW: number, top: number): Rect {
  return { x: x + (columnW - size.w) / 2, y: top, w: size.w, h: size.h };
}

/** Title, heading and list in the content area from `inner.y` down to `listBottom`. */
function chestContent(
  inner: Rect,
  contentW: number,
  listBottom: number,
  measure: ChestMeasure,
): Pick<ChestLayout, 'title' | 'heading' | 'list'> {
  const titleSize = measure.titleAt(contentW);
  const headingSize = measure.headingAt(contentW);
  const title: Rect = { x: inner.x, y: inner.y, w: titleSize.w, h: titleSize.h };
  const heading: Rect = { x: inner.x, y: title.y + title.h + UI.gap, w: headingSize.w, h: headingSize.h };
  const listTop = heading.y + heading.h + UI.gap;
  return { title, heading, list: { x: inner.x, y: listTop, w: contentW, h: Math.max(0, listBottom - listTop) } };
}

/** Landscape chest: the content and the page text on the left, the button column on the right. */
function landscapeChest(panel: Rect, inner: Rect, measure: ChestMeasure): ChestLayout {
  const { close, back, next, pageText } = measure;
  const columnW = Math.max(close.w, back.w, next.w);
  const columnX = inner.x + inner.w - columnW;
  const contentW = Math.max(0, inner.w - columnW - UI.gap);
  const bottom = inner.y + inner.h;
  const nextRect = inColumn(next, columnX, columnW, bottom - next.h);
  const pageRect = inColumn(pageText, inner.x, contentW, bottom - pageText.h);
  const content = chestContent(inner, contentW, pageRect.y - UI.gap, measure);
  return {
    panel,
    ...content,
    pageText: pageRect,
    close: inColumn(close, columnX, columnW, inner.y),
    back: inColumn(back, columnX, columnW, nextRect.y - UI.gap - back.h),
    next: nextRect,
  };
}

/** Portrait chest: the content above the page text and the bottom button rows. */
function portraitChest(panel: Rect, inner: Rect, measure: ChestMeasure): ChestLayout {
  const centreX = inner.x + inner.w / 2;
  const buttons = flowRows([measure.back, measure.next, measure.close], centreX, inner.w, 0);
  const buttonsH = bottomOfAll(buttons, 0);
  const shift = inner.y + inner.h - buttonsH;
  const [back, next, close] = buttons.map((rect) => ({ ...rect, y: rect.y + shift }));
  const pageTop = shift - UI.gap - measure.pageText.h;
  const pageText: Rect = { ...measure.pageText, x: centreX - measure.pageText.w / 2, y: pageTop };
  const content = chestContent(inner, inner.w, pageTop - UI.gap, measure);
  return { panel, ...content, pageText, close, back, next };
}

/**
 * Whether the Treasure Chest title shows: only when an entry row `rowH` tall fits the list height
 * the title leaves (`listH`). False when either is not finite.
 */
export function chestShowsTitle(listH: number, rowH: number): boolean {
  return Number.isFinite(listH) && Number.isFinite(rowH) && rowH <= listH;
}

/**
 * `chest` with its title hidden (PRD C11, as the Collection Book does in C14): the heading moves up
 * to `chest.title.y` (same x, width and height) and the list grows upward by
 * `chest.heading.y - chest.title.y`. Everything else is unchanged.
 */
export function hideChestTitle(chest: ChestLayout): ChestLayout {
  const lift = chest.heading.y - chest.title.y;
  return {
    ...chest,
    heading: { ...chest.heading, y: chest.title.y },
    list: { ...chest.list, y: chest.list.y - lift, h: chest.list.h + lift },
  };
}
