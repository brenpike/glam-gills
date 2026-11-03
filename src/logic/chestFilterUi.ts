/**
 * Treasure Chest Filter screen layout (PRD C11), in CSS px, inside the chest's panel with the same
 * margins and padding as chestLayout. The title and Show all sit at the top of the content column,
 * the four groups (Type, Found, Rarity, Area) below them, each a group name line over its chips.
 * Done sits where the chest's Close sits, Back and Next where the chest's Back and Next sit. When
 * the groups do not all fit, they go in pages: Type, Found and Rarity are never split across pages;
 * the Area group alone may split, only between whole chip rows, with its name line at the top of
 * each page it appears on. Sizes come in measured; nothing here shrinks a control or its text.
 */
import { FILTER_GROUPS, type FilterGroup } from './chestFilter';
import type { HudView, Rect, Size } from './hudLayout';
import { UI, chestLayout } from './tankUi';

/**
 * Filter chip sizes in CSS px: the padding round a chip's content, the least side of every chip
 * (PRD X5), the height of an Area chip (two 18 px lines: 'Area N' over its count line) and the
 * chip text size (body size, never smaller).
 */
export const FILTER_CHIP = Object.freeze({ padX: 12, padY: 6, minPx: 48, areaH: 64, textPx: 18 });

/** The one group whose chips may split across pages, between whole rows. */
const SPLIT_GROUP: FilterGroup = 'areaIds';

const NO_SIZE: Size = Object.freeze({ w: 0, h: 0 });

/**
 * Body of a chip (or the chip-style Show all button) round `content`: FILTER_CHIP padding each side,
 * at least FILTER_CHIP.minPx wide and at least `minH` tall (FILTER_CHIP.areaH for an Area chip).
 */
export function filterChipSize(content: Size, minH: number = FILTER_CHIP.minPx): Size {
  return {
    w: Math.max(FILTER_CHIP.minPx, content.w + 2 * FILTER_CHIP.padX),
    h: Math.max(minH, content.h + 2 * FILTER_CHIP.padY),
  };
}

/** Filter screen measurements: wrapped text blocks at a wrap width, and fixed sizes. */
export interface ChestFilterMeasure {
  /** The screen title (FILTER_LABEL). */
  titleAt: (wrapW: number) => Size;
  /** A group's name line (FILTER_GROUP_LABELS). */
  groupNameAt: (group: FilterGroup, wrapW: number) => Size;
  /** Each group's chip bodies in display order. */
  chips: Readonly<Record<FilterGroup, readonly Size[]>>;
  showAll: Size;
  done: Size;
  back: Size;
  next: Size;
}

/** One chip: its group, its index in that group's chips, and its rect. */
export interface FilterChipRect {
  group: FilterGroup;
  index: number;
  rect: Rect;
}

/** A group on one page: its name line and the chips of it that page shows. */
export interface FilterGroupPart {
  group: FilterGroup;
  name: Rect;
  chips: FilterChipRect[];
}

/** One Filter screen page: its group parts in group order. */
export interface FilterPage {
  parts: FilterGroupPart[];
}

/**
 * The Filter screen layout. Every page shares the title, Show all, Done, Back and Next rects; Back
 * and Next show only when `paged` (more than one page).
 */
export interface ChestFilterLayout {
  panel: Rect;
  title: Rect;
  showAll: Rect;
  done: Rect;
  back: Rect;
  next: Rect;
  pages: FilterPage[];
  paged: boolean;
}

/** A Filter screen focus target. */
export type FilterTarget =
  | { kind: 'chip'; group: FilterGroup; index: number }
  | { kind: 'showAll' }
  | { kind: 'back' }
  | { kind: 'next' }
  | { kind: 'done' };

/** One flow row: the chips from `start` up to `end` (exclusive), their width with gaps between, and the tallest height. */
interface ChipRow {
  start: number;
  end: number;
  w: number;
  h: number;
}

/** The pages built so far and the height used on the last one, from the top of the groups room. */
interface PageCursor {
  pages: FilterPage[];
  used: number;
}

/** Splits `sizes` into rows that each take chips in order while they fit `maxW` with `UI.gap` between; at least one chip a row. */
function splitChipRows(sizes: readonly Size[], maxW: number): ChipRow[] {
  const rows: ChipRow[] = [];
  let start = 0;
  while (start < sizes.length) {
    let end = start + 1;
    let rowW = sizes[start].w;
    while (end < sizes.length && rowW + UI.gap + sizes[end].w <= maxW + 1e-9) {
      rowW += UI.gap + sizes[end].w;
      end++;
    }
    rows.push({ start, end, w: rowW, h: Math.max(...sizes.slice(start, end).map((size) => size.h)) });
    start = end;
  }
  return rows;
}

/** Height of a group part: its name line, a gap, then `rows` `UI.gap` apart. */
function measurePartHeight(nameH: number, rows: readonly ChipRow[]): number {
  const rowsH = rows.reduce((sum, row) => sum + row.h, 0) + UI.gap * Math.max(0, rows.length - 1);
  return nameH + UI.gap + rowsH;
}

/** True when a part `partH` tall fits on the cursor's last page, a gap under what is already there. */
function fitsOnPage(cursor: PageCursor, partH: number, roomH: number): boolean {
  const top = cursor.used > 0 ? cursor.used + UI.gap : 0;
  return top + partH <= roomH + 1e-9;
}

/** Starts a new page unless the cursor's last page is still empty. */
function startPage(cursor: PageCursor): void {
  if (cursor.used === 0) return;
  cursor.pages.push({ parts: [] });
  cursor.used = 0;
}

/** Chip rects for `rows` of `sizes`, left-aligned at `x`, the first row at `top`, rows `UI.gap` apart and chips centred down each row. */
function placeChipRows(group: FilterGroup, sizes: readonly Size[], rows: readonly ChipRow[], x: number, top: number): FilterChipRect[] {
  const chips: FilterChipRect[] = [];
  let rowTop = top;
  for (const row of rows) {
    let chipX = x;
    for (let index = row.start; index < row.end; index++) {
      const size = sizes[index];
      chips.push({ group, index, rect: { x: chipX, y: rowTop + (row.h - size.h) / 2, w: size.w, h: size.h } });
      chipX += size.w + UI.gap;
    }
    rowTop += row.h + UI.gap;
  }
  return chips;
}

/** Places the name line and `rows` of `group` on the cursor's last page, a gap under what is already there. */
function placePart(
  cursor: PageCursor,
  room: Rect,
  group: FilterGroup,
  name: Size,
  sizes: readonly Size[],
  rows: readonly ChipRow[],
): void {
  const offset = cursor.used > 0 ? cursor.used + UI.gap : 0;
  const nameRect: Rect = { x: room.x, y: room.y + offset, w: name.w, h: name.h };
  const chips = placeChipRows(group, sizes, rows, room.x, nameRect.y + name.h + UI.gap);
  cursor.pages[cursor.pages.length - 1].parts.push({ group, name: nameRect, chips });
  cursor.used = offset + measurePartHeight(name.h, rows);
}

/** Most leading `rows` that fit on the cursor's last page under the name line; 0 when not even one does. */
function countRowsThatFit(cursor: PageCursor, nameH: number, rows: readonly ChipRow[], roomH: number): number {
  let count = 0;
  while (count < rows.length && fitsOnPage(cursor, measurePartHeight(nameH, rows.slice(0, count + 1)), roomH)) count++;
  return count;
}

/**
 * Places `rows` of the split group across pages, whole rows at a time, the name line over each
 * part. A row that does not fit even an empty page still goes on one, alone.
 */
function splitGroup(
  cursor: PageCursor,
  room: Rect,
  group: FilterGroup,
  name: Size,
  sizes: readonly Size[],
  rows: readonly ChipRow[],
): void {
  let start = 0;
  while (start < rows.length) {
    const count = countRowsThatFit(cursor, name.h, rows.slice(start), room.h);
    if (count === 0 && cursor.used > 0) {
      startPage(cursor);
      continue;
    }
    const take = Math.max(1, count);
    placePart(cursor, room, group, name, sizes, rows.slice(start, start + take));
    start += take;
    if (start < rows.length) startPage(cursor);
  }
}

/**
 * Places `group` on the cursor's last page when it fits whole there, else whole on a new page.
 * The split group goes whole on a new page only when it fits an empty one, else splits.
 */
function addGroup(cursor: PageCursor, room: Rect, group: FilterGroup, measure: ChestFilterMeasure): void {
  const sizes = measure.chips[group];
  const name = measure.groupNameAt(group, room.w);
  const rows = splitChipRows(sizes, room.w);
  const wholeH = measurePartHeight(name.h, rows);
  if (fitsOnPage(cursor, wholeH, room.h)) {
    placePart(cursor, room, group, name, sizes, rows);
    return;
  }
  if (group === SPLIT_GROUP && wholeH > room.h + 1e-9) {
    splitGroup(cursor, room, group, name, sizes, rows);
    return;
  }
  startPage(cursor);
  placePart(cursor, room, group, name, sizes, rows);
}

/**
 * The Filter screen layout on `view`. The panel, the content column and the Done, Back and Next
 * places are chestLayout's, with Done measured in Close's place. The title sits at the top left of
 * the content column with Show all beside it, both centred down a row as tall as the taller; the
 * title wraps at the column width left of Show all. The groups fill the rest of the column, in
 * FILTER_GROUPS order, `UI.gap` apart; their chips flow left-aligned in rows `UI.gap` apart.
 */
export function chestFilterLayout(view: HudView, measure: ChestFilterMeasure): ChestFilterLayout {
  const chest = chestLayout(view, {
    titleAt: () => NO_SIZE,
    headingAt: () => NO_SIZE,
    pageText: NO_SIZE,
    close: measure.done,
    back: measure.back,
    next: measure.next,
  });
  // INVARIANT: with a zero-size title, heading and page text, chestLayout puts the title at the
  // top of the content column and the page text at its bottom, in both orientations.
  const columnX = chest.list.x;
  const columnW = chest.list.w;
  const columnTop = chest.title.y;
  const columnBottom = chest.pageText.y;
  const titleSize = measure.titleAt(Math.max(0, columnW - measure.showAll.w - UI.gap));
  const rowH = Math.max(titleSize.h, measure.showAll.h);
  const title: Rect = { x: columnX, y: columnTop + (rowH - titleSize.h) / 2, w: titleSize.w, h: titleSize.h };
  const showAll: Rect = {
    x: title.x + title.w + UI.gap,
    y: columnTop + (rowH - measure.showAll.h) / 2,
    w: measure.showAll.w,
    h: measure.showAll.h,
  };
  const groupsTop = columnTop + rowH + UI.gap;
  const room: Rect = { x: columnX, y: groupsTop, w: columnW, h: Math.max(0, columnBottom - groupsTop) };
  const cursor: PageCursor = { pages: [{ parts: [] }], used: 0 };
  for (const group of FILTER_GROUPS) addGroup(cursor, room, group, measure);
  return {
    panel: chest.panel,
    title,
    showAll,
    done: chest.close,
    back: chest.back,
    next: chest.next,
    pages: cursor.pages,
    paged: cursor.pages.length > 1,
  };
}

/**
 * Focus order on page `pageIndex` of `layout`: that page's chips in group then chip order, Show
 * all, then Back and Next when the layout is paged, then Done. Throws a RangeError when the page
 * does not exist.
 */
export function filterFocusOrder(layout: Pick<ChestFilterLayout, 'pages' | 'paged'>, pageIndex: number): FilterTarget[] {
  const page = Number.isInteger(pageIndex) ? layout.pages[pageIndex] : undefined;
  if (page === undefined) {
    throw new RangeError(`filterFocusOrder: no page ${pageIndex} of ${layout.pages.length}`);
  }
  const chips = page.parts.flatMap((part) =>
    part.chips.map((chip): FilterTarget => ({ kind: 'chip', group: chip.group, index: chip.index })),
  );
  const paging: FilterTarget[] = layout.paged ? [{ kind: 'back' }, { kind: 'next' }] : [];
  return [...chips, { kind: 'showAll' }, ...paging, { kind: 'done' }];
}
