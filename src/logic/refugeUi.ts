/**
 * Refuge screen (PRD N2; issue #74): the screen, opened from the Home Tank, where the Xochimilco
 * refuge grows one section per habitat. The pure CSS px layout of its sections, its "More to come"
 * teaser, title, Back and pan tiles, its focus, key and scroll rules, and the fit of the habitat
 * milestone card. Text comes in measured as panel sizes (RefugeMeasure); nothing here reads the
 * habitats or the stars, so the scene passes one RefugeEntry per section, in habitat order.
 *
 * Fixed parts. Back, the standard wide button (REFUGE_BACK_BUTTON, 64 px tall), sits top-left inside
 * the 16 px margins. The Prev and Next pan tiles (REFUGE_PREV_TILE and REFUGE_NEXT_TILE: labelled
 * square tiles, 64 px tall, the left or right icon over the label "Previous" or "Next") sit
 * top-right, Prev 12 px before Next, when the canvas is at least REFUGE_PAN_TOP_MIN_W wide; else
 * they sit in a bottom row on the bottom margin, centred, 12 px apart. The title panel
 * sits 12 px beside Back, centred on the canvas where it can be and centred down Back, only when it
 * fits there (as wide as the room up to 12 px before Prev, or to the right margin when the pan tiles
 * are in the bottom row, and no taller than Back); else it hides. These parts are in screen CSS px
 * and never scroll.
 *
 * Scrolling parts. `viewport` is the screen rect between the fixed parts (12 px clear of them, the
 * full canvas width, and down to the bottom margin when the pan tiles are at the top) that the
 * refuge scrolls in, along x only. The sections and teaser are in content CSS px, with the origin at
 * the content's top-left; scrolled by `s`, content point (cx, cy) shows on screen at
 * (viewport.x + cx - s, viewport.y + cy). The content is as tall as the viewport, with the sections
 * centred down it. Content narrower than the viewport takes the viewport's width, with the sections
 * centred in it, so it does not scroll.
 *
 * Section. Each section is REFUGE_SECTION_W wide. From the top: the name row (as tall as the tallest
 * name label, each label centred in it; the label is the habitat name, or "???" before the section
 * shows), the area-line row when there is one (below), REFUGE_PART_GAP_PX, the REFUGE_PICTURE,
 * REFUGE_PART_GAP_PX, then the REFUGE_SLOT_H slot. The slot holds the "See it again" tile
 * (REFUGE_SEE_AGAIN_TILE) when the section is clean, else the hint panel when the section has one,
 * either centred in the slot. Sections run along x UI.gap apart, starting UI.margin in from the
 * content's left edge, then the "More to come" teaser, the size of a section, UI.gap after the last
 * section, then UI.margin to the content's right edge.
 *
 * Area lines (issue #113, ND-8). A section that shows (not "???") has an area line panel, such as
 * "Areas 2 and 3", measured by RefugeMeasure.areaLine. When any section has one, every section gets
 * one area-line row, REFUGE_AREA_LINE_GAP_PX under the name row and as tall as the tallest area line
 * panel, each panel centred in it. When that row would make the sections taller than the viewport
 * (the 320 and 340 px tall canvases), there is no row: each area line panel sits straight under the
 * name row, centred across, over the top of its picture, and must end within the picture's top
 * REFUGE_PICTURE_TOP_BAND_H px, which the art keeps clear (areaLineOnPicture). Text, gaps, the
 * picture and the slot never shrink.
 *
 * Focus and keys. Focus indices 0 to k-1 are the "See it again" tiles in entry order (k of them),
 * then k is Prev, k + 1 is Next and k + 2 is Back. Tab and Shift+Tab step through them, wrapping.
 * Left and Right pan one section back and on, on key repeat too. Enter and Space press the focused
 * control, ignoring key repeat: a tile shows its section's milestone again, Prev and Next pan, and
 * Back goes back. Escape is Back, on key repeat too, as on the area map.
 *
 * Milestone card. A habitat milestone card stacks its title, the section's clean REFUGE_PICTURE (96
 * px tall), its body and its one button, fitted by fitCard; the title hides when nothing fits with
 * it, as on the Start over card.
 */
import { fitCard, type CardFit, type CardSection, type TextFit } from './cardFit';
import type { HudView, Rect, Size } from './hudLayout';
import { REFUGE_SEE_AGAIN_LABEL } from './refuge';
import { BACK_LABEL } from './stylerText';
import { TILE_BUTTON, UI, WIDE_BUTTON, nextFocusIndex, tileButtonWidth, wideButtonWidth, type TankKey } from './tankUi';

/** A section's picture of its habitat, and the milestone card's picture, in CSS px (the art step draws it this size). */
export const REFUGE_PICTURE: Size = Object.freeze({ w: 200, h: 96 });

/** Width of one refuge section, in CSS px: its picture's width. */
export const REFUGE_SECTION_W = REFUGE_PICTURE.w;

/** Room between a section's name row and its picture, and between its picture and its slot, in CSS px. */
export const REFUGE_PART_GAP_PX = 8;

/** Room between a section's name row and its area-line row, in CSS px (issue #113, ND-8). */
export const REFUGE_AREA_LINE_GAP_PX = 4;

/**
 * Height of the band at the top of a section's picture, in picture px, that the art keeps clear of
 * trash and plants: an area line drawn over the picture ends within it (issue #113, ND-8).
 */
export const REFUGE_PICTURE_TOP_BAND_H = 20;

/** Padding across each side of an area line panel's text, in CSS px (issue #113, ND-8). */
export const REFUGE_AREA_LINE_PAD_X = 8;

/** Padding above and below an area line panel's text, in CSS px: small enough for the picture's top band (issue #113, ND-8). */
export const REFUGE_AREA_LINE_PAD_Y = 2;

/** Height of the slot under a section's picture that holds its "See it again" tile or its hint, in CSS px. */
export const REFUGE_SLOT_H = TILE_BUTTON.h;

/** The "See it again" tile: a size-1 square tile widened to hold its label, 64 px tall. */
export const REFUGE_SEE_AGAIN_TILE: Size = Object.freeze({ w: tileButtonWidth(REFUGE_SEE_AGAIN_LABEL), h: TILE_BUTTON.h });

/** Label of the button that leaves the refuge. */
export const REFUGE_BACK_LABEL = BACK_LABEL;

/** Back: the standard wide button, 64 px tall, sized to its label. */
export const REFUGE_BACK_BUTTON: Size = Object.freeze({ w: wideButtonWidth(REFUGE_BACK_LABEL), h: WIDE_BUTTON.h });

/** Label of the pan tile that pans one section back. */
export const REFUGE_PREV_LABEL = 'Previous';

/** Label of the pan tile that pans one section on. */
export const REFUGE_NEXT_LABEL = 'Next';

/** The Prev pan tile: a size-1 square tile, the left icon over its label, widened to hold the label, 64 px tall. */
export const REFUGE_PREV_TILE: Size = Object.freeze({ w: tileButtonWidth(REFUGE_PREV_LABEL), h: TILE_BUTTON.h });

/** The Next pan tile: a size-1 square tile, the right icon over its label, widened to hold the label, 64 px tall. */
export const REFUGE_NEXT_TILE: Size = Object.freeze({ w: tileButtonWidth(REFUGE_NEXT_LABEL), h: TILE_BUTTON.h });

/** Least canvas width with room for Back, Prev and Next along the top, 12 px apart inside the margins, in CSS px. */
export const REFUGE_PAN_TOP_MIN_W =
  2 * UI.margin + REFUGE_BACK_BUTTON.w + 2 * UI.gap + REFUGE_PREV_TILE.w + REFUGE_NEXT_TILE.w;

/** Distance along x from one section's start to the next: a section and the gap, in CSS px. */
export const REFUGE_PAN_STEP = REFUGE_SECTION_W + UI.gap;

/** One refuge section, in habitat order: its habitat id and whether its "See it again" tile shows (the section is clean). */
export interface RefugeEntry {
  readonly id: string;
  readonly seeAgain: boolean;
}

/** Measured panel sizes in CSS px, each panel with its padding and at most `wrapW` wide. */
export interface RefugeMeasure {
  /** The screen title panel. */
  title: (wrapW: number) => Size;
  /** The name label panel of section `id`: its habitat name, or "???" before it shows. */
  name: (id: string, wrapW: number) => Size;
  /** The hint panel of section `id` (such as "Beat Area 4"), or null when it shows none. */
  hint: (id: string, wrapW: number) => Size | null;
  /**
   * The area line panel of section `id` (such as "Areas 2 and 3"), or null when it shows none (a "???"
   * section). Absent means no section shows an area line (issue #113, ND-8).
   */
  areaLine?: (id: string, wrapW: number) => Size | null;
}

/**
 * One section, in content CSS px: its entry id, the whole section, its name label, its area line panel
 * (null when it shows none), its picture, its slot, and the "See it again" tile or the hint panel in
 * the slot (null when absent).
 */
export interface RefugeSection {
  id: string;
  rect: Rect;
  name: Rect;
  areaLine: Rect | null;
  picture: Rect;
  slot: Rect;
  seeAgain: Rect | null;
  hint: Rect | null;
}

/** One "See it again" tile in focus order: its section's entry id and index, and the tile rect in content CSS px. */
export interface RefugeTile {
  id: string;
  sectionIndex: number;
  rect: Rect;
}

/**
 * The refuge layout (module doc). `title` (null when hidden), `back`, `prev`, `next` and `viewport`
 * are fixed screen rects; `sections` (in entry order), `teaser` and `tiles` (the "See it again"
 * tiles, in focus order) are in content CSS px within `content`. `panAtBottom` is whether the pan
 * tiles sit in the bottom row. `areaLineOnPicture` is whether the area lines sit over the pictures
 * for want of room for their row (module doc). `fits` is false when the sections are taller than the
 * viewport, or a name label or area line panel is wider than a section, or an area line panel over a
 * picture ends below its top band, or a hint panel does not fit its slot.
 */
export interface RefugeLayout {
  viewport: Rect;
  content: Size;
  sections: RefugeSection[];
  teaser: Rect;
  tiles: RefugeTile[];
  title: Rect | null;
  back: Rect;
  prev: Rect;
  next: Rect;
  panAtBottom: boolean;
  areaLineOnPicture: boolean;
  fits: boolean;
}

/** What a focus index points at: a "See it again" tile (its entry id and section index), Prev, Next or Back. */
export type RefugeFocusTarget =
  | { kind: 'seeAgain'; id: string; sectionIndex: number }
  | { kind: 'prev' }
  | { kind: 'next' }
  | { kind: 'back' };

/** What a key asks the scene to do: nothing, show the focused tile's milestone again, pan back or on, or go back. */
export type RefugeAction = 'none' | 'seeAgain' | 'panPrev' | 'panNext' | 'back';

/** The focus after a key, and what the scene must do. */
export interface RefugeKeyResult {
  focus: number;
  action: RefugeAction;
}

/** Measured heights of a milestone card: the title, the body wrap variants (from factCardBodyWrapWidths) and the button. */
export interface MilestoneCardSize {
  titleH: number;
  bodyVariants: TextFit[];
  actionsH: number;
}

/** A fitted milestone card and whether its title shows. */
export interface MilestoneFit {
  fit: CardFit;
  showsTitle: boolean;
}

/** Scroll difference below which two scrolls count as the same, in CSS px. */
const SCROLL_EPS = 1e-6;

/** The fixed parts: Back, the pan tiles, the title (null when hidden), and the viewport between them. */
interface RefugeFrame {
  back: Rect;
  prev: Rect;
  next: Rect;
  title: Rect | null;
  viewport: Rect;
  panAtBottom: boolean;
}

/** Throws a RangeError when there is no entry or two entries share an id. */
function checkEntries(entries: readonly RefugeEntry[]): void {
  if (entries.length === 0) throw new RangeError('refugeLayout: no section');
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) throw new RangeError('refugeLayout: two sections share an id');
}

/** Throws a RangeError unless `focus` is a tile index, Prev, Next or Back (0 to tileCount + 2). */
function checkFocus(focus: number, tileCount: number): void {
  const last = tileCount + 2;
  if (!Number.isInteger(focus) || focus < 0 || focus > last) {
    throw new RangeError(`refuge focus must be a whole number from 0 to ${last}: ${focus}`);
  }
}

/** Throws a RangeError unless `scroll` is finite. */
function checkScroll(scroll: number): void {
  if (!Number.isFinite(scroll)) throw new RangeError(`refuge scroll must be finite: ${scroll}`);
}

/** Returns `value` clamped to [min, max], or `min` when the range is empty. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** A rect of `size` centred in `box`. */
function centredIn(size: Size, box: Rect): Rect {
  return { x: box.x + (box.w - size.w) / 2, y: box.y + (box.h - size.h) / 2, w: size.w, h: size.h };
}

/** Places Prev and Next top-right when the canvas is wide enough for them beside Back, else in a bottom row, centred. */
function panTiles(view: HudView): { prev: Rect; next: Rect; panAtBottom: boolean } {
  const prevW = REFUGE_PREV_TILE.w;
  const nextW = REFUGE_NEXT_TILE.w;
  const h = TILE_BUTTON.h;
  if (view.cssW >= REFUGE_PAN_TOP_MIN_W) {
    const nextX = view.cssW - UI.margin - nextW;
    return {
      prev: { x: nextX - UI.gap - prevW, y: UI.margin, w: prevW, h },
      next: { x: nextX, y: UI.margin, w: nextW, h },
      panAtBottom: false,
    };
  }
  const prevX = (view.cssW - (prevW + UI.gap + nextW)) / 2;
  const y = view.cssH - UI.margin - h;
  return { prev: { x: prevX, y, w: prevW, h }, next: { x: prevX + prevW + UI.gap, y, w: nextW, h }, panAtBottom: true };
}

/** The title beside Back, centred on the canvas where it can be and down Back, when it fits the room up to `roomEnd`; else null. */
function titleBeside(view: HudView, back: Rect, roomEnd: number, measure: RefugeMeasure): Rect | null {
  const besideX = back.x + back.w + UI.gap;
  const room = roomEnd - besideX;
  if (room <= 0) return null;
  const size = measure.title(room);
  if (size.w > room || size.h > back.h) return null;
  const x = clamp((view.cssW - size.w) / 2, besideX, roomEnd - size.w);
  return { x, y: back.y + (back.h - size.h) / 2, w: size.w, h: size.h };
}

/** Places Back, the pan tiles and the title, and the viewport between them (module doc). */
function refugeFrame(view: HudView, measure: RefugeMeasure): RefugeFrame {
  const back: Rect = { x: UI.margin, y: UI.margin, w: REFUGE_BACK_BUTTON.w, h: REFUGE_BACK_BUTTON.h };
  const { prev, next, panAtBottom } = panTiles(view);
  const roomEnd = panAtBottom ? view.cssW - UI.margin : prev.x - UI.gap;
  const title = titleBeside(view, back, roomEnd, measure);
  const top = back.y + back.h + UI.gap;
  const bottom = panAtBottom ? prev.y - UI.gap : view.cssH - UI.margin;
  const viewport: Rect = { x: 0, y: top, w: Math.max(0, view.cssW), h: Math.max(0, bottom - top) };
  return { back, prev, next, title, viewport, panAtBottom };
}

/** Measured panels of one section: its name label, area line (null when none) and hint (null when none). */
interface SectionPanels {
  name: Size;
  areaLine: Size | null;
  hint: Size | null;
}

/** Heights shared by every section: the name row and the area-line row (0 when there is none). */
interface SectionRows {
  nameRowH: number;
  areaRowH: number;
}

/** Room the area-line row takes, its gap included: 0 when there is none. */
function areaRowSpan(rows: SectionRows): number {
  return rows.areaRowH > 0 ? REFUGE_AREA_LINE_GAP_PX + rows.areaRowH : 0;
}

/** Height of every section with these rows: name row, area-line row, picture and slot with their gaps. */
function sectionHeight(rows: SectionRows): number {
  return rows.nameRowH + areaRowSpan(rows) + 2 * REFUGE_PART_GAP_PX + REFUGE_PICTURE.h + REFUGE_SLOT_H;
}

/** The area line panel `size` at content x `x` under the name row ending at `nameRowEnd`: centred in its row, else straight under the name row. */
function placeAreaLine(size: Size | null, x: number, nameRowEnd: number, areaRowH: number): Rect | null {
  if (size === null) return null;
  if (areaRowH > 0) return centredIn(size, { x, y: nameRowEnd + REFUGE_AREA_LINE_GAP_PX, w: REFUGE_SECTION_W, h: areaRowH });
  return { x: x + (REFUGE_SECTION_W - size.w) / 2, y: nameRowEnd, w: size.w, h: size.h };
}

/** The section of `entry` at content x `x` and y `top`, with the shared `rows` and its measured panels. */
function placeSection(entry: RefugeEntry, x: number, top: number, rows: SectionRows, panels: SectionPanels): RefugeSection {
  const { nameRowH } = rows;
  const { name, hint } = panels;
  const nameRow: Rect = { x, y: top, w: REFUGE_SECTION_W, h: nameRowH };
  const pictureY = top + nameRowH + areaRowSpan(rows) + REFUGE_PART_GAP_PX;
  const picture: Rect = { x, y: pictureY, w: REFUGE_PICTURE.w, h: REFUGE_PICTURE.h };
  const slot: Rect = { x, y: picture.y + picture.h + REFUGE_PART_GAP_PX, w: REFUGE_SECTION_W, h: REFUGE_SLOT_H };
  const seeAgain = entry.seeAgain ? centredIn(REFUGE_SEE_AGAIN_TILE, slot) : null;
  const hintRect = entry.seeAgain || hint === null ? null : centredIn(hint, slot);
  return {
    id: entry.id,
    rect: { x, y: top, w: REFUGE_SECTION_W, h: slot.y + slot.h - top },
    name: centredIn(name, nameRow),
    areaLine: placeAreaLine(panels.areaLine, x, top + nameRowH, rows.areaRowH),
    picture,
    slot,
    seeAgain,
    hint: hintRect,
  };
}

/** Whether every name label is no wider than a section and every hint panel fits its slot. */
function partsFit(names: readonly Size[], hints: readonly (Size | null)[]): boolean {
  const namesFit = names.every((name) => name.w <= REFUGE_SECTION_W);
  const hintsFit = hints.every((hint) => hint === null || (hint.w <= REFUGE_SECTION_W && hint.h <= REFUGE_SLOT_H));
  return namesFit && hintsFit;
}

/** Whether every area line is no wider than a section and, over a picture, ends within its top band. */
function areaLinesFit(sections: readonly RefugeSection[], onPicture: boolean): boolean {
  return sections.every(({ areaLine, picture }) => {
    if (areaLine === null) return true;
    const inBand = !onPicture || areaLine.y + areaLine.h <= picture.y + REFUGE_PICTURE_TOP_BAND_H;
    return areaLine.w <= REFUGE_SECTION_W && inBand;
  });
}

/** The tallest of the area line panels, or 0 when none shows. */
function tallestAreaLine(areaLines: readonly (Size | null)[]): number {
  return Math.max(0, ...areaLines.map((areaLine) => areaLine?.h ?? 0));
}

/**
 * Lays out the refuge for the CSS canvas `view` (module doc). `entries` holds at least one section,
 * ids unique; else throws RangeError.
 */
export function refugeLayout(view: HudView, entries: readonly RefugeEntry[], measure: RefugeMeasure): RefugeLayout {
  checkEntries(entries);
  const frame = refugeFrame(view, measure);
  const { viewport } = frame;
  const names = entries.map((entry) => measure.name(entry.id, REFUGE_SECTION_W));
  const hints = entries.map((entry) => (entry.seeAgain ? null : measure.hint(entry.id, REFUGE_SECTION_W)));
  const areaLines = entries.map((entry) => measure.areaLine?.(entry.id, REFUGE_SECTION_W) ?? null);
  const nameRowH = Math.max(...names.map((name) => name.h));
  const withRow: SectionRows = { nameRowH, areaRowH: tallestAreaLine(areaLines) };
  const rowFits = sectionHeight(withRow) <= viewport.h;
  const rows: SectionRows = rowFits ? withRow : { nameRowH, areaRowH: 0 };
  const areaLineOnPicture = !rowFits && withRow.areaRowH > 0;
  const sectionH = sectionHeight(rows);

  const used = 2 * UI.margin + (entries.length + 1) * REFUGE_SECTION_W + entries.length * UI.gap;
  const contentW = Math.max(viewport.w, used);
  const left = UI.margin + (contentW - used) / 2;
  const top = Math.max(0, (viewport.h - sectionH) / 2);

  const sections = entries.map((entry, index) =>
    placeSection(entry, left + index * REFUGE_PAN_STEP, top, rows, {
      name: names[index],
      areaLine: areaLines[index],
      hint: hints[index],
    }),
  );
  const tiles: RefugeTile[] = [];
  sections.forEach((section, sectionIndex) => {
    if (section.seeAgain !== null) tiles.push({ id: section.id, sectionIndex, rect: section.seeAgain });
  });

  return {
    viewport,
    content: { w: contentW, h: viewport.h },
    sections,
    teaser: { x: left + entries.length * REFUGE_PAN_STEP, y: top, w: REFUGE_SECTION_W, h: sectionH },
    tiles,
    title: frame.title,
    back: frame.back,
    prev: frame.prev,
    next: frame.next,
    panAtBottom: frame.panAtBottom,
    areaLineOnPicture,
    fits: sectionH <= viewport.h && partsFit(names, hints) && areaLinesFit(sections, areaLineOnPicture),
  };
}

/** What focus index `focus` points at (module doc). Throws RangeError for an index past Back. */
export function refugeFocusTarget(layout: RefugeLayout, focus: number): RefugeFocusTarget {
  const count = layout.tiles.length;
  checkFocus(focus, count);
  if (focus < count) return { kind: 'seeAgain', id: layout.tiles[focus].id, sectionIndex: layout.tiles[focus].sectionIndex };
  if (focus === count) return { kind: 'prev' };
  return focus === count + 1 ? { kind: 'next' } : { kind: 'back' };
}

/** What a press of the focused control asks for. */
function pressAction(target: RefugeFocusTarget): RefugeAction {
  switch (target.kind) {
    case 'seeAgain':
      return 'seeAgain';
    case 'prev':
      return 'panPrev';
    case 'next':
      return 'panNext';
    default:
      return 'back';
  }
}

/**
 * Applies one key to the refuge focus (module doc). `key` is the tankKeyFor action of the key press
 * (Tab is next, Shift+Tab previous, Enter and Space confirm, Escape cancel), or null for any other
 * key; `repeat` is whether the press is a key repeat. Keys with no refuge meaning give 'none' and keep
 * the focus. `focus` must be a tile index, Prev, Next or Back (layout.tiles.length + 2 at most); else
 * throws RangeError.
 */
export function refugeKey(focus: number, key: TankKey | null, repeat: boolean, layout: RefugeLayout): RefugeKeyResult {
  const target = refugeFocusTarget(layout, focus);
  switch (key) {
    case 'next':
    case 'previous':
      return { focus: nextFocusIndex(focus, layout.tiles.length + 3, key === 'next' ? 1 : -1), action: 'none' };
    case 'left':
      return { focus, action: 'panPrev' };
    case 'right':
      return { focus, action: 'panNext' };
    case 'confirm':
      return { focus, action: repeat ? 'none' : pressAction(target) };
    case 'cancel':
      return { focus, action: 'back' };
    default:
      return { focus, action: 'none' };
  }
}

/** The largest scroll: the content width less the viewport width, 0 when the content fits. */
export function maxRefugeScroll(layout: RefugeLayout): number {
  return Math.max(0, layout.content.w - layout.viewport.w);
}

/** `scroll` clamped to 0 through maxRefugeScroll. Throws RangeError for a scroll that is not finite. */
export function clampRefugeScroll(layout: RefugeLayout, scroll: number): number {
  checkScroll(scroll);
  return clamp(scroll, 0, maxRefugeScroll(layout));
}

/** The scroll that puts the start of `rect` UI.margin in from the viewport's left edge, clamped. */
function scrollToStart(layout: RefugeLayout, rect: Rect): number {
  return clamp(rect.x - UI.margin, 0, maxRefugeScroll(layout));
}

/**
 * The scroll after panning one section from `scroll` (itself first clamped): `step` 1 to the first
 * section or teaser start past the one at the viewport's left margin, -1 to the last one before it,
 * clamped to the content. At either end the scroll stays put, so Prev and Next do nothing there.
 * Throws RangeError for a scroll that is not finite.
 */
export function panRefugeScroll(layout: RefugeLayout, scroll: number, step: 1 | -1): number {
  const from = clampRefugeScroll(layout, scroll);
  const stops = [...layout.sections.map((section) => section.rect), layout.teaser].map((rect) => scrollToStart(layout, rect));
  const found = step > 0 ? stops.find((stop) => stop > from + SCROLL_EPS) : [...stops].reverse().find((stop) => stop < from - SCROLL_EPS);
  return found ?? from;
}

/**
 * The scroll that shows the focused tile's whole section with UI.margin round it, moving as little as
 * it can from `scroll` (itself first clamped), and clamped to the content. Prev, Next and Back are
 * fixed on screen, so focusing them returns `scroll` clamped. Throws RangeError for a focus past Back
 * or a scroll that is not finite.
 */
export function scrollToRefugeFocus(layout: RefugeLayout, focus: number, scroll: number): number {
  const target = refugeFocusTarget(layout, focus);
  const from = clampRefugeScroll(layout, scroll);
  if (target.kind !== 'seeAgain') return from;
  const rect = layout.sections[target.sectionIndex].rect;
  const start = rect.x - UI.margin;
  const end = rect.x + rect.w + UI.margin;
  let next = from;
  if (end > next + layout.viewport.w) next = end - layout.viewport.w;
  if (start < next) next = start;
  return clamp(next, 0, maxRefugeScroll(layout));
}

/**
 * The scroll the refuge opens at: section `sectionIndex` UI.margin in from the viewport's left edge,
 * clamped to the content. Throws RangeError unless `sectionIndex` is a section index.
 */
export function initialRefugeScroll(layout: RefugeLayout, sectionIndex: number): number {
  const count = layout.sections.length;
  if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex >= count) {
    throw new RangeError(`refuge section index must be a whole number from 0 to ${count - 1}: ${sectionIndex}`);
  }
  return scrollToStart(layout, layout.sections[sectionIndex].rect);
}

/** Card sections of a milestone card with a title `titleH` px tall (0 hides it): title, picture, body, button. */
export function milestoneCardSections(titleH: number, size: MilestoneCardSize): CardSection[] {
  return [
    { kind: 'fixed', height: titleH },
    { kind: 'fixed', height: REFUGE_PICTURE.h },
    { kind: 'body', variants: size.bodyVariants },
    { kind: 'actions', height: size.actionsH },
  ];
}

/**
 * Fits a habitat milestone card into `availH` CSS px: title, the REFUGE_PICTURE, body, one button.
 * When nothing fits with the title, the title hides and the card is fitted again without it.
 */
export function fitMilestoneCard(availH: number, size: MilestoneCardSize): MilestoneFit {
  const withTitle = fitCard(availH, milestoneCardSections(size.titleH, size));
  if (!withTitle.clipped) return { fit: withTitle, showsTitle: true };
  return { fit: fitCard(availH, milestoneCardSections(0, size)), showsTitle: false };
}
