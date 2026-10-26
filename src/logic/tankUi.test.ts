import { describe, expect, it } from 'vitest';
import { isSupportedCanvas } from './cardFit';
import type { HudView, Rect, Size } from './hudLayout';
import { SHIPPED_DECORATIONS, decorationBandTop, lidTopCss, tankFrame, topKeepClearCss } from './tank';
import { CLOSE_LABEL, COLLECTION_BOOK_LABEL, DONE_LABEL, NEXT_PAGE_LABEL, PREVIOUS_PAGE_LABEL, REFUGE_LABEL } from './tankText';
import {
  BUTTON_LABEL_PAD,
  CHEST_BUTTON,
  COMPACT_DONE,
  COMPACT_TRAY_PX,
  HUB_BUTTONS,
  ICON_TILE,
  LABEL_BOLD_EM,
  TILE_BUTTON,
  TRAY_PAGE_ROWS,
  TRAY_PX,
  UI,
  WIDE_BUTTON,
  chestLayout,
  chestShowsTitle,
  decorateLayout,
  hubButtonCompactLook,
  hubButtonLook,
  hubCaptionRect,
  hideChestTitle,
  hubLayout,
  labelButtonWidth,
  nextFocusIndex,
  rowsPerPage,
  tankKeyFor,
  tankRooms,
  tileButtonWidth,
  trayPageOf,
  wideButtonWidth,
  type ChestMeasure,
  type DecorateLayout,
  type DecorateSizes,
  type HubAction,
  type HubLayout,
  type TankKey,
  type TankRoom,
} from './tankUi';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

/** BUTTON_WIDE in src/art/drawUi.ts (logic tests must not import art). */
const WIDE: Size = { w: 200, h: 64 };
/** The Put away button: BUTTON_WIDE at the 0.8 size src/scenes/TankDecorator.ts builds it at. */
const PUT_AWAY: Size = { w: 160, h: 51.2 };

const MIN_TARGET_PX = 48;
/** Largest tray that keeps the room rule; a larger tray follows the art guide rule for trays of more than 4. */
const ROOM_RULE_TRAY_MAX = 4;
const PRIMARY_H = 64;
const TITLE_PX = 34;
const CHEST_TITLE_PX = 28;
const HEADING_PX = 18;
const BODY_PX = 18;
/** Chest entry row budget: a 32 px icon beside three 18 px lines (name and rarity, then two detail lines). */
const CHEST_ROW_H = 3 * LINE_HEIGHT_EM * BODY_PX;

const HUB_TITLE = 'Home Tank';
const DECORATE_CAPTION = 'Pick a Decoration to place it. Drag it or use the arrow keys to move it.';
const CHEST_TITLE = 'Treasure Chest';
const CHEST_HEADING = 'Dream colours: 15 of 15 found';
const CHEST_PAGE = 'Page 9 of 9';

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

/** A hub button as the scene builds it: the bodies of hubButtonLook() and hubButtonCompactLook() for its label. */
function hubAction(id: string, label: string, primary: boolean): HubAction {
  const { w, h } = hubButtonLook({ label, primary });
  const compact = hubButtonCompactLook({ label, primary });
  return { id, w, h, compact: { w: compact.w, h: compact.h } };
}

/** The hub actions the scene shows: Go exploring (primary), Decorate, Treasure Chest, Collection Book and Refuge. */
const HUB_ACTIONS: readonly HubAction[] = HUB_BUTTONS.map(({ id, label, primary }) => hubAction(id, label, primary));

/** Wide label width estimate of a size-1 tile labelled `label`. */
function tileLabelW(label: string): number {
  return label.length * LABEL_BOLD_EM * TILE_BUTTON.labelPx;
}

/** Lines `text` wraps to at `wrapW`, splitting on '\n' then greedily on ' ', every character `em * px` wide. */
function estimateLines(text: string, px: number, wrapW: number, em: number): number {
  const charW = em * px;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let lineW = 0;
    lines += 1;
    for (const word of paragraph.split(' ')) {
      const wordW = word.length * charW;
      if (lineW > 0 && lineW + charW + wordW > wrapW) {
        lines += 1;
        lineW = wordW;
      } else {
        lineW += (lineW > 0 ? charW : 0) + wordW;
      }
    }
  }
  return lines;
}

/** Estimated size of `text` wrapped at `wrapW`. */
function textSize(text: string, px: number, wrapW: number, em: number): Size {
  const lines = estimateLines(text, px, wrapW, em);
  return { w: Math.min(wrapW, text.length * em * px), h: lines * LINE_HEIGHT_EM * px };
}

const CHEST_MEASURE: ChestMeasure = {
  titleAt: (wrapW) => textSize(CHEST_TITLE, CHEST_TITLE_PX, wrapW, BOLD_EM),
  headingAt: (wrapW) => textSize(CHEST_HEADING, HEADING_PX, wrapW, BOLD_EM),
  pageText: textSize(CHEST_PAGE, BODY_PX, Infinity, REGULAR_EM),
  close: CHEST_BUTTON,
  back: CHEST_BUTTON,
  next: CHEST_BUTTON,
};

/** Supported canvases from the width and height grid (art guide 1). */
function supportedCanvases(): HudView[] {
  return CANVAS_WIDTHS.flatMap((cssW) =>
    CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
  );
}

function bottomOf(rect: Rect): number {
  return rect.y + rect.h;
}

/** Larger of the horizontal and vertical clearances between two rects; negative when they overlap. */
function clearance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** Problems with a set of named rects: outside `bounds`, or closer than UI.gap to another. */
function spacingProblems(label: string, bounds: Rect, rects: readonly [string, Rect][]): string[] {
  const problems: string[] = [];
  for (const [name, rect] of rects) {
    const inside =
      rect.x >= bounds.x - 1e-9 &&
      rect.y >= bounds.y - 1e-9 &&
      rect.x + rect.w <= bounds.x + bounds.w + 1e-9 &&
      rect.y + rect.h <= bounds.y + bounds.h + 1e-9;
    if (!inside) problems.push(`${label}: ${name} outside bounds`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (clearance(rects[i][1], rects[j][1]) < UI.gap - 1e-9) {
        problems.push(`${label}: ${rects[i][0]} and ${rects[j][0]} closer than ${UI.gap}`);
      }
    }
  }
  return problems;
}

/** Problems with touch targets smaller than 48 x 48. */
function targetProblems(label: string, targets: readonly [string, Rect][]): string[] {
  return targets
    .filter(([, rect]) => rect.w < MIN_TARGET_PX || rect.h < MIN_TARGET_PX)
    .map(([name]) => `${label}: ${name} under ${MIN_TARGET_PX} px`);
}

/** The view inside the 16 px edge margins. */
function marginBounds(view: HudView): Rect {
  return { x: UI.margin, y: UI.margin, w: view.cssW - 2 * UI.margin, h: view.cssH - 2 * UI.margin };
}

/** Problems with rects closer than a gap to the band kept clear for Floating and Hanging items. */
function keepClearProblems(label: string, view: HudView, rects: readonly [string, Rect][]): string[] {
  const band = topKeepClearCss(tankFrame(view.cssW, view.cssH));
  const isClear = (rect: Rect): boolean =>
    bottomOf(rect) <= band.y0 - UI.gap + 1e-9 || rect.y >= band.y1 + UI.gap - 1e-9;
  return rects.filter(([, rect]) => !isClear(rect)).map(([name]) => `${label}: ${name} near the top band`);
}

/**
 * The reach rooms (art guide 7f), recomputed: the wall from the top margin to a gap above the top
 * keep-clear band, and the open water from a gap under that band to the bottom margin, each at least
 * 48 px tall.
 */
function reachRooms(view: HudView): TankRoom[] {
  const band = topKeepClearCss(tankFrame(view.cssW, view.cssH));
  const rooms: TankRoom[] = [
    { top: UI.margin, bottom: band.y0 - UI.gap },
    { top: band.y1 + UI.gap, bottom: view.cssH - UI.margin },
  ];
  return rooms.filter((room) => room.bottom - room.top >= MIN_TARGET_PX);
}

/**
 * Problems with rects not inside one of the rooms (so not between a gap above the lid and a gap above
 * the floor Decorations), or of the reach rooms when `reach`.
 */
function roomProblems(label: string, view: HudView, rects: readonly [string, Rect][], reach = false): string[] {
  const rooms = reach ? reachRooms(view) : tankRooms(view, tankFrame(view.cssW, view.cssH));
  const isInRoom = (rect: Rect): boolean =>
    rooms.some((room) => rect.y >= room.top - 1e-9 && bottomOf(rect) <= room.bottom + 1e-9);
  return rects.filter(([, rect]) => !isInRoom(rect)).map(([name]) => `${label}: ${name} outside the rooms`);
}

/** The hub title panel as the scene measures it: the title text at the margin width less the pad, plus the pad each side. */
function hubTitle(view: HudView): Size {
  const text = textSize(HUB_TITLE, TITLE_PX, view.cssW - 2 * UI.margin - 2 * UI.pad, BOLD_EM);
  return { w: text.w + 2 * UI.pad, h: text.h + 2 * UI.pad };
}

/** The hub layout the scene asks for on `view`, with the title. */
function sceneHub(view: HudView): HubLayout {
  return hubLayout(view, tankFrame(view.cssW, view.cssH), HUB_ACTIONS, hubTitle(view));
}

/** The longest hub focus caption at its drawn size: one line of the longest hub label at the body size, plus the pad each side. */
const HUB_CAPTION: Size = {
  w: COLLECTION_BOOK_LABEL.length * BOLD_EM * BODY_PX + 2 * UI.pad,
  h: LINE_HEIGHT_EM * BODY_PX + 2 * UI.pad,
};

/** Every hub problem on one canvas with one action set. */
function hubProblems(view: HudView, actions: readonly HubAction[]): string[] {
  const label = `hub ${view.cssW}x${view.cssH} n=${actions.length}`;
  const layout = hubLayout(view, tankFrame(view.cssW, view.cssH), actions, hubTitle(view));
  const targets = layout.actions.map(({ id, rect }): [string, Rect] => [id, rect]);
  const all: [string, Rect][] = layout.title ? [['title', layout.title], ...targets] : targets;
  const problems = [
    ...spacingProblems(label, marginBounds(view), all),
    ...targetProblems(label, targets),
    ...keepClearProblems(label, view, all),
    ...roomProblems(label, view, all, layout.reach),
  ];
  if (layout.reach && layout.title !== null) problems.push(`${label}: title while reaching`);
  const go = layout.actions.find((placement) => placement.id === 'goExploring');
  if (!go || go.rect.h < PRIMARY_H) problems.push(`${label}: Go exploring under ${PRIMARY_H} px`);
  for (const { id, rect } of layout.actions) {
    if (go && id !== 'goExploring' && rect.h > go.rect.h) problems.push(`${label}: ${id} taller than Go exploring`);
  }
  return problems;
}

/** Decorate sizes with the caption measured at the margin width. */
function decorateSizes(view: HudView): DecorateSizes {
  return {
    putAway: PUT_AWAY,
    done: WIDE,
    caption: textSize(DECORATE_CAPTION, BODY_PX, view.cssW - 2 * UI.margin, REGULAR_EM),
  };
}

/** The tray squares, Put away, Done, and Back and Next when shown, of a decorate layout, named. */
function decorateTargets(layout: DecorateLayout): [string, Rect][] {
  const pageButtons: [string, Rect][] = [];
  if (layout.previousPage !== null) pageButtons.push(['previousPage', layout.previousPage]);
  if (layout.nextPage !== null) pageButtons.push(['nextPage', layout.nextPage]);
  return [
    ...layout.tray.map((rect, i): [string, Rect] => [`tray ${i}`, rect]),
    ['putAway', layout.putAway],
    ['done', layout.done],
    ...pageButtons,
  ];
}

/** Problems with a layout's page fields: the shown page's squares, its start, and Back and Next only with more than one page. */
function pageProblems(label: string, layout: DecorateLayout, trayCount: number): string[] {
  const problems: string[] = [];
  const expectedPages = layout.pageSize > 0 ? Math.max(1, Math.ceil(trayCount / layout.pageSize)) : 1;
  if (layout.pageCount !== expectedPages) problems.push(`${label}: ${layout.pageCount} pages, expected ${expectedPages}`);
  if (layout.trayStart !== layout.page * layout.pageSize) problems.push(`${label}: page starts at ${layout.trayStart}`);
  const expectedSquares = Math.min(layout.pageSize, trayCount - layout.trayStart);
  if (layout.tray.length !== expectedSquares) problems.push(`${label}: ${layout.tray.length} tray squares, expected ${expectedSquares}`);
  const paged = layout.pageCount > 1;
  if ((layout.previousPage !== null) !== paged || (layout.nextPage !== null) !== paged) {
    problems.push(`${label}: Back and Next ${paged ? 'missing' : 'shown'}`);
  }
  if (!paged && layout.tray.length !== trayCount) problems.push(`${label}: one page without every tray square`);
  return problems;
}

/** True when `row` spans an even width either side of the view's centre line. */
function isCentredRow(view: HudView, row: readonly Rect[]): boolean {
  const left = Math.min(...row.map((rect) => rect.x));
  const right = Math.max(...row.map((rect) => rect.x + rect.w));
  return Math.abs((left + right) / 2 - view.cssW / 2) < 1e-9;
}

/** Problems with rows not centred across the view; rects that share a vertical centre are one row. */
function centredRowProblems(label: string, view: HudView, rects: readonly [string, Rect][]): string[] {
  const rows = new Map<number, Rect[]>();
  for (const [, rect] of rects) {
    const centreKey = Math.round((rect.y + rect.h / 2) * 1e6);
    rows.set(centreKey, [...(rows.get(centreKey) ?? []), rect]);
  }
  return [...rows.entries()]
    .filter(([, row]) => !isCentredRow(view, row))
    .map(([centreKey]) => `${label}: row at y ${centreKey / 1e6} not centred`);
}

/**
 * Top of the caption by its rule (art guide 7f, decorate controls), or null when it hides: 12 px under
 * the controls inside their room, else in the open water (a gap under the top keep-clear band, maybe
 * over the floor Decorations) inside the bottom margin, and only when it fits across.
 */
function captionRuleTop(view: HudView, layout: DecorateLayout, caption: Size): number | null {
  if (caption.w > view.cssW - 2 * UI.margin + 1e-9) return null;
  const top = Math.max(...decorateTargets(layout).map(([, rect]) => bottomOf(rect))) + UI.gap;
  if (top + caption.h <= layout.room.bottom + 1e-9) return top;
  const waterTop = Math.max(top, topKeepClearCss(tankFrame(view.cssW, view.cssH)).y1 + UI.gap);
  return waterTop + caption.h <= view.cssH - UI.margin + 1e-9 ? waterTop : null;
}

/** Problems with a caption not placed, or not hidden, by its rule. */
function captionRuleProblems(label: string, view: HudView, layout: DecorateLayout, caption: Size | null): string[] {
  const expected = caption === null ? null : captionRuleTop(view, layout, caption);
  const actual = layout.caption === null ? null : layout.caption.y;
  const agrees = expected === null || actual === null ? expected === actual : Math.abs(expected - actual) < 1e-9;
  return agrees ? [] : [`${label}: caption at ${actual}, its rule gives ${expected}`];
}

/**
 * Every decorate problem on one canvas with one tray count out of `maxTrayCount`, on page `page`. Up
 * to ROOM_RULE_TRAY_MAX the controls stay inside the rooms and the caption always shows. A larger tray
 * follows the art guide rule for trays of more than 4: its rows may reach over the floor band and the
 * caption is placed or hidden by its rule; a tray that fits no room goes in pages, with Back and Next.
 */
function decorateProblems(view: HudView, trayCount: number, maxTrayCount: number, page = 0): string[] {
  const label = `decorate ${view.cssW}x${view.cssH} tray=${trayCount}/${maxTrayCount} page=${page}`;
  const frame = tankFrame(view.cssW, view.cssH);
  const sizes = decorateSizes(view);
  const layout = decorateLayout(view, frame, trayCount, sizes, maxTrayCount, page);
  const targets = decorateTargets(layout);
  const all: [string, Rect][] = layout.caption ? [...targets, ['caption', layout.caption]] : targets;
  const problems = [
    ...spacingProblems(label, marginBounds(view), all),
    ...targetProblems(label, targets),
    ...keepClearProblems(label, view, all),
    ...centredRowProblems(label, view, all),
  ];
  if (maxTrayCount <= ROOM_RULE_TRAY_MAX) {
    problems.push(...roomProblems(label, view, targets));
    if (layout.caption === null) problems.push(`${label}: no caption`);
  } else {
    problems.push(...captionRuleProblems(label, view, layout, sizes.caption));
  }
  problems.push(...pageProblems(label, layout, trayCount));
  if (layout.page !== page) problems.push(`${label}: shows page ${layout.page}`);
  if (layout.done.h < PRIMARY_H) problems.push(`${label}: Done under ${PRIMARY_H} px`);
  return problems;
}

/**
 * Every decorate problem on every page of one tray. pageProblems pins each page's start, square
 * count and the page count, so each tray item is on exactly one page.
 */
function trayPagesProblems(view: HudView, trayCount: number, maxTrayCount: number): string[] {
  const first = decorateLayout(view, tankFrame(view.cssW, view.cssH), trayCount, decorateSizes(view), maxTrayCount);
  return Array.from({ length: first.pageCount }, (_, page) => page).flatMap((page) => decorateProblems(view, trayCount, maxTrayCount, page));
}

/** Every chest problem on one canvas, including fewer than two rows per page. */
function chestProblems(view: HudView): string[] {
  const label = `chest ${view.cssW}x${view.cssH}`;
  const layout = chestLayout(view, CHEST_MEASURE);
  const inner: Rect = {
    x: layout.panel.x + UI.pad,
    y: layout.panel.y + UI.pad,
    w: layout.panel.w - 2 * UI.pad,
    h: layout.panel.h - 2 * UI.pad,
  };
  const targets: [string, Rect][] = [
    ['close', layout.close],
    ['back', layout.back],
    ['next', layout.next],
  ];
  const all: [string, Rect][] = [
    ['title', layout.title],
    ['heading', layout.heading],
    ['pageText', layout.pageText],
    ['list', layout.list],
    ...targets,
  ];
  const problems = [
    ...spacingProblems(label, marginBounds(view), [['panel', layout.panel]]),
    ...spacingProblems(label, inner, all),
    ...targetProblems(label, targets),
  ];
  const rows = rowsPerPage(layout.list.h, CHEST_ROW_H, UI.gap);
  if (rows < 2) problems.push(`${label}: ${rows} row per page`);
  return problems;
}

describe('tankKeyFor', () => {
  it.each<[string, boolean, TankKey | null]>([
    ['ArrowLeft', false, 'left'],
    ['ArrowRight', false, 'right'],
    ['ArrowUp', false, 'up'],
    ['ArrowDown', false, 'down'],
    ['ArrowLeft', true, 'left'],
    ['Tab', false, 'next'],
    ['Tab', true, 'previous'],
    ['Enter', false, 'confirm'],
    [' ', false, 'confirm'],
    ['Escape', false, 'cancel'],
    ['Delete', false, 'putAway'],
    ['Backspace', false, 'putAway'],
    ['a', false, null],
    ['Shift', true, null],
    ['toString', false, null],
    ['', false, null],
  ])('maps %j (shift %s) to %s', (key, shiftKey, expected) => {
    expect(tankKeyFor(key, shiftKey)).toBe(expected);
  });
});

describe('nextFocusIndex', () => {
  it('wraps both ways', () => {
    expect(nextFocusIndex(0, 3, 1)).toBe(1);
    expect(nextFocusIndex(2, 3, 1)).toBe(0);
    expect(nextFocusIndex(0, 3, -1)).toBe(2);
    expect(nextFocusIndex(1, 3, 0)).toBe(1);
  });

  it('is -1 with no targets', () => {
    expect(nextFocusIndex(0, 0, 1)).toBe(-1);
    expect(nextFocusIndex(-1, 0, -1)).toBe(-1);
  });

  it('starts at the first or last target from no focus', () => {
    expect(nextFocusIndex(-1, 4, 1)).toBe(0);
    expect(nextFocusIndex(-1, 4, -1)).toBe(3);
    expect(nextFocusIndex(9, 4, 1)).toBe(0);
  });
});

describe('rowsPerPage', () => {
  it('counts whole rows with gaps between, at least 1', () => {
    expect(rowsPerPage(100, 44, 12)).toBe(2);
    expect(rowsPerPage(99, 44, 12)).toBe(1);
    expect(rowsPerPage(10, 44, 12)).toBe(1);
    expect(rowsPerPage(0, 0, 12)).toBe(1);
    expect(rowsPerPage(Number.NaN, 44, 12)).toBe(1);
  });
});

describe('wideButtonWidth and tileButtonWidth', () => {
  it('sizes the wide and tile labels to whole CSS px', () => {
    expect(wideButtonWidth('Go exploring')).toBe(225);
    expect(tileButtonWidth('Decorate')).toBe(118);
    expect(tileButtonWidth('Treasure Chest')).toBe(197);
    expect(tileButtonWidth('Collection Book')).toBe(210);
    expect(tileButtonWidth('Refuge')).toBe(92);
    expect(tileButtonWidth('Close')).toBe(78);
  });

  it('keeps the minimum body and fits the wide label estimate with the pad each side', () => {
    for (const label of ['Go', 'Go exploring', 'Treasure Chest', 'Collection Book']) {
      const w = wideButtonWidth(label);
      const rowW = WIDE_BUTTON.iconPx + WIDE_BUTTON.iconGap + label.length * LABEL_BOLD_EM * WIDE_BUTTON.labelPx;
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(WIDE_BUTTON.w);
      expect(w).toBeGreaterThanOrEqual(rowW + 2 * BUTTON_LABEL_PAD);
    }
    for (const label of ['Go', 'Decorate', 'Treasure Chest', 'Collection Book', 'Refuge', 'Close', 'Back', 'Next']) {
      const w = tileButtonWidth(label);
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(TILE_BUTTON.w);
      expect(w).toBeGreaterThanOrEqual(tileLabelW(label) + 2 * BUTTON_LABEL_PAD);
    }
  });
});

describe('hubButtonLook', () => {
  it('makes Go exploring a 64 px wide button and the others 64 px square tiles', () => {
    expect(hubButtonLook({ label: 'Go exploring', primary: true })).toEqual({ shape: 'wide', w: 225, h: 64 });
    expect(hubButtonLook({ label: 'Decorate', primary: false })).toEqual({ shape: 'square', w: 118, h: 64 });
    expect(hubButtonLook({ label: 'Treasure Chest', primary: false })).toEqual({ shape: 'square', w: 197, h: 64 });
    expect(hubButtonLook({ label: 'Collection Book', primary: false })).toEqual({ shape: 'square', w: 210, h: 64 });
    expect(hubButtonLook({ label: 'Refuge', primary: false })).toEqual({ shape: 'square', w: 92, h: 64 });
  });

  it('makes the Refuge hub entry a 92 x 64 secondary tile, and a 48 x 48 icon tile when compact', () => {
    const refuge = HUB_BUTTONS.find((spec) => spec.id === 'refuge');
    expect(refuge).toEqual({ id: 'refuge', label: REFUGE_LABEL, primary: false });
    expect(hubButtonLook(refuge ?? { label: '', primary: true })).toEqual({ shape: 'square', w: 92, h: 64 });
    expect(hubButtonCompactLook(refuge ?? { label: '', primary: true })).toEqual({ shape: 'icon', w: 48, h: 48 });
  });

  it('makes the Collection Book hub entry a 210 x 64 secondary tile', () => {
    const book = HUB_BUTTONS.find((spec) => spec.id === 'collectionBook');
    expect(book).toEqual({ id: 'collectionBook', label: 'Collection Book', primary: false });
    expect(hubButtonLook(book ?? { label: '', primary: true })).toEqual({ shape: 'square', w: 210, h: 64 });
  });

  it('never makes a secondary taller than the primary', () => {
    const primary = HUB_BUTTONS.find((spec) => spec.primary);
    const primaryH = hubButtonLook({ label: primary?.label ?? '', primary: true }).h;
    for (const spec of HUB_BUTTONS.filter((button) => !button.primary)) {
      expect(hubButtonLook(spec).h).toBeLessThanOrEqual(primaryH);
    }
  });

  it('puts Go exploring first, Refuge then Sound last, and makes Go exploring the only primary', () => {
    expect(HUB_BUTTONS.map((spec) => spec.id)).toEqual([
      'goExploring',
      'decorate',
      'treasureChest',
      'collectionBook',
      'refuge',
      'sound',
    ]);
    expect(HUB_BUTTONS.filter((spec) => spec.primary).map((spec) => spec.id)).toEqual(['goExploring']);
  });
});

describe('compact looks', () => {
  it('sizes the compact controls at or above PRD X5', () => {
    expect(ICON_TILE).toEqual({ w: 48, h: 48, iconPx: 32 });
    expect(COMPACT_TRAY_PX).toBe(MIN_TARGET_PX);
    expect(labelButtonWidth(DONE_LABEL)).toBe(110);
    expect(COMPACT_DONE).toEqual({ w: 110, h: PRIMARY_H });
    expect(wideButtonWidth(DONE_LABEL)).toBe(WIDE_BUTTON.w);
    expect(TRAY_PX).toBe(64);
    expect(WIDE_BUTTON).toMatchObject({ w: 200, h: 64 });
    expect(TILE_BUTTON).toMatchObject({ w: 64, h: 64 });
  });

  it('keeps Go exploring a 225 x 64 labelled wide button and makes the others 48 x 48 icon tiles', () => {
    expect(hubButtonCompactLook({ label: 'Go exploring', primary: true })).toEqual({ shape: 'wide', w: 225, h: 64 });
    for (const spec of HUB_BUTTONS.filter((button) => !button.primary)) {
      expect(hubButtonCompactLook(spec)).toEqual({ shape: 'icon', w: 48, h: 48 });
    }
  });
});

describe('tankRooms', () => {
  it.each<[HudView, TankRoom[]]>([
    [{ cssW: 460, cssH: 320 }, [{ top: 108, bottom: 187.111 }]],
    [{ cssW: 320, cssH: 440 }, [{ top: 16, bottom: 198.667 }, { top: 284, bottom: 337.333 }]],
    [{ cssW: 1280, cssH: 720 }, [{ top: 228, bottom: 436 }]],
  ])('measures the wall and the open water at $cssW x $cssH', (view, expected) => {
    const rooms = tankRooms(view, tankFrame(view.cssW, view.cssH));
    expect(rooms).toHaveLength(expected.length);
    rooms.forEach((room, index) => {
      expect(room.top).toBeCloseTo(expected[index].top, 2);
      expect(room.bottom).toBeCloseTo(expected[index].bottom, 2);
    });
  });

  it('keeps every room a gap clear of the lid, the top band and the floor Decorations on every supported canvas', () => {
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const frame = tankFrame(view.cssW, view.cssH);
      const band = topKeepClearCss(frame);
      const rooms = tankRooms(view, frame);
      const label = `rooms ${view.cssW}x${view.cssH}`;
      if (rooms.length === 0) problems.push(`${label}: none`);
      for (const room of rooms) {
        if (room.bottom - room.top < MIN_TARGET_PX) problems.push(`${label}: room under ${MIN_TARGET_PX}`);
        const above = room.bottom <= Math.min(lidTopCss(frame), band.y0) - UI.gap + 1e-9;
        const below = room.top >= band.y1 + UI.gap - 1e-9 && room.bottom <= decorationBandTop(frame) - UI.gap + 1e-9;
        if (!above && !below) problems.push(`${label}: room ${room.top}-${room.bottom} not clear`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('hubLayout', () => {
  it('fits every hub action on every supported canvas', () => {
    expect(HUB_ACTIONS).toHaveLength(6);
    const problems = supportedCanvases().flatMap((view) => hubProblems(view, HUB_ACTIONS));
    expect(problems).toEqual([]);
  });

  it('reaches over the floor Decorations, untitled, only at 460 and 480 x 320 to 414 and 520 x 320 to 440', () => {
    const reaching = supportedCanvases().filter((view) => sceneHub(view).reach);
    expect(reaching.map((view) => `${view.cssW}x${view.cssH}`)).toEqual([
      ...[460, 480].flatMap((cssW) => [320, 340, 360, 375, 414].map((cssH) => `${cssW}x${cssH}`)),
      ...[320, 340, 360, 375, 414, 440].map((cssH) => `520x${cssH}`),
    ]);
    for (const view of reaching) {
      expect(sceneHub(view).title).toBeNull();
      expect(hubLayout(view, tankFrame(view.cssW, view.cssH), HUB_ACTIONS, null).reach).toBe(true);
    }
  });

  it('never reaches with the 4 actions before Refuge', () => {
    const four = HUB_ACTIONS.filter((action) => action.id !== 'refuge' && action.id !== 'sound');
    const reaching = supportedCanvases().filter((view) => hubLayout(view, tankFrame(view.cssW, view.cssH), four, hubTitle(view)).reach);
    expect(reaching).toEqual([]);
  });

  it('shows the title only when it fits above the actions in their room', () => {
    const wide = { cssW: 1024, cssH: 768 };
    expect(sceneHub(wide).title).not.toBeNull();
    expect(sceneHub({ cssW: 460, cssH: 320 }).title).toBeNull();
    expect(hubLayout(wide, tankFrame(wide.cssW, wide.cssH), HUB_ACTIONS, null).title).toBeNull();
  });

  it('keeps action order and uses the compact sizes when compact', () => {
    const view = { cssW: 460, cssH: 320 };
    const layout = hubLayout(view, tankFrame(view.cssW, view.cssH), HUB_ACTIONS, null);
    expect(layout.compact).toBe(true);
    expect(layout.actions.map((placement) => placement.id)).toEqual(HUB_ACTIONS.map((action) => action.id));
    const sizes = layout.actions.map((placement) => ({ w: placement.rect.w, h: placement.rect.h }));
    expect(sizes).toEqual(HUB_ACTIONS.map((action) => action.compact));
  });

  it('uses the full sizes as the compact ones when an action has none', () => {
    const view = { cssW: 460, cssH: 320 };
    const actions = HUB_ACTIONS.map(({ id, w, h }) => ({ id, w, h }));
    const layout = hubLayout(view, tankFrame(view.cssW, view.cssH), actions, null);
    expect(layout.compact).toBe(true);
    expect(layout.actions.map((placement) => placement.rect.w)).toEqual(actions.map((action) => action.w));
  });

  it('puts two compact rows in the open water, Refuge and Sound reaching over the floor Decorations, at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = sceneHub(view);
    expect(layout.compact).toBe(true);
    expect(layout.reach).toBe(true);
    expect(layout.title).toBeNull();
    expect(layout.actions.map((placement) => placement.rect)).toEqual([
      { x: 27.5, y: 108, w: 225, h: 64 },
      { x: 264.5, y: 116, w: 48, h: 48 },
      { x: 324.5, y: 116, w: 48, h: 48 },
      { x: 384.5, y: 116, w: 48, h: 48 },
      { x: 176, y: 184, w: 48, h: 48 },
      { x: 236, y: 184, w: 48, h: 48 },
    ]);
    expect(layout.room).toEqual({ top: 108, bottom: 304 });
    expect(bottomOf(layout.actions[4].rect)).toBeGreaterThan(decorationBandTop(frame));
    expect(bottomOf(layout.actions[5].rect)).toBeGreaterThan(decorationBandTop(frame));
  });

  it('puts two compact rows on the wall above the lid at 320 x 440', () => {
    const layout = sceneHub({ cssW: 320, cssH: 440 });
    expect(layout.compact).toBe(true);
    expect(layout.title).toBeNull();
    expect(layout.actions.map((placement) => placement.rect)).toEqual([
      { x: 17.5, y: 16, w: 225, h: 64 },
      { x: 254.5, y: 24, w: 48, h: 48 },
      { x: 46, y: 92, w: 48, h: 48 },
      { x: 106, y: 92, w: 48, h: 48 },
      { x: 166, y: 92, w: 48, h: 48 },
      { x: 226, y: 92, w: 48, h: 48 },
    ]);
    expect(layout.reach).toBe(false);
    expect(layout.room).toEqual({ top: UI.margin, bottom: lidTopCss(tankFrame(320, 440)) - UI.gap });
  });

  it('puts the full-size row under the title in the open water at 1280 x 720', () => {
    const view = { cssW: 1280, cssH: 720 };
    const layout = sceneHub(view);
    const title = hubTitle(view);
    expect(layout.compact).toBe(false);
    expect(layout.reach).toBe(false);
    expect(layout.title).toEqual({ x: (view.cssW - title.w) / 2, y: 228, w: title.w, h: 66.5 });
    expect(layout.actions.map((placement) => placement.rect)).toEqual([
      { x: 150, y: 306.5, w: 225, h: 64 },
      { x: 387, y: 306.5, w: 118, h: 64 },
      { x: 517, y: 306.5, w: 197, h: 64 },
      { x: 726, y: 306.5, w: 210, h: 64 },
      { x: 948, y: 306.5, w: 92, h: 64 },
      { x: 1052, y: 306.5, w: 78, h: 64 },
    ]);
    expect(1052 + 78 - 150).toBe(980);
    expect(layout.room).toEqual({ top: 228, bottom: 436 });
  });

  it('goes compact in one row in the open water at 844 x 320, the full row of 6 being too wide', () => {
    const view = { cssW: 844, cssH: 320 };
    const layout = sceneHub(view);
    expect(layout.compact).toBe(true);
    expect(layout.reach).toBe(false);
    expect(layout.actions.map((placement) => placement.rect.y)).toEqual([108, 116, 116, 116, 116, 116]);
    expect(layout.room).toEqual(tankRooms(view, tankFrame(view.cssW, view.cssH))[0]);
    expect(HUB_ACTIONS.reduce((rowW, action) => rowW + action.w, 0) + 5 * UI.gap).toBeGreaterThan(view.cssW - 2 * UI.margin);
  });

  it.each([
    { cssW: 414, cssH: 440 },
    { cssW: 430, cssH: 440 },
  ])('splits compact rows across the wall and the open water at $cssW x $cssH', (view) => {
    const frame = tankFrame(view.cssW, view.cssH);
    const [wall, water] = tankRooms(view, frame);
    const layout = sceneHub(view);
    expect(layout.compact).toBe(true);
    expect(layout.title).toBeNull();
    expect(layout.reach).toBe(false);
    const [go, decorate, chest, book, refuge, sound] = layout.actions.map((placement) => placement.rect);
    expect(go.y).toBe(wall.top);
    expect(decorate.y).toBe(chest.y);
    expect(bottomOf(chest)).toBeLessThanOrEqual(wall.bottom);
    expect(book.y).toBeCloseTo(water.top, 9);
    expect(refuge.y).toBeCloseTo(water.top, 9);
    expect(sound.y).toBeCloseTo(water.top, 9);
    expect(bottomOf(sound)).toBeLessThanOrEqual(water.bottom);
    expect(layout.room).toEqual(water);
  });
});

describe('hubCaptionRect', () => {
  it('has a place for the focus caption wherever the hub is compact', () => {
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const label = `hub caption ${view.cssW}x${view.cssH}`;
      const hub = sceneHub(view);
      if (!hub.compact) continue;
      const caption = hubCaptionRect(view, tankFrame(view.cssW, view.cssH), hub, HUB_CAPTION, []);
      if (caption === null) {
        problems.push(`${label}: no place`);
        continue;
      }
      const hubRects = hub.actions.map(({ id, rect }): [string, Rect] => [id, rect]);
      const all: [string, Rect][] = [...hubRects, ['caption', caption]];
      problems.push(...spacingProblems(label, marginBounds(view), all), ...keepClearProblems(label, view, all));
    }
    expect(problems).toEqual([]);
  });

  it('centres the caption a gap under the hub inside its room', () => {
    const view = { cssW: 320, cssH: 440 };
    const hub = sceneHub(view);
    const caption = hubCaptionRect(view, tankFrame(view.cssW, view.cssH), hub, HUB_CAPTION, []);
    expect(caption).toEqual({ x: (view.cssW - HUB_CAPTION.w) / 2, y: 152, ...HUB_CAPTION });
  });

  it('goes into the open water, over the floor Decorations, when the room under the hub is full', () => {
    const view = { cssW: 844, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = sceneHub(view);
    expect(hub.reach).toBe(false);
    const caption = hubCaptionRect(view, frame, hub, HUB_CAPTION, []);
    expect(caption).toEqual({ x: (view.cssW - HUB_CAPTION.w) / 2, y: 184, ...HUB_CAPTION });
    expect(184 + HUB_CAPTION.h).toBeGreaterThan(hub.room.bottom);
  });

  it('centres the caption a gap under reaching rows inside their reach room at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const hub = sceneHub(view);
    expect(hub.reach).toBe(true);
    const caption = hubCaptionRect(view, tankFrame(view.cssW, view.cssH), hub, HUB_CAPTION, []);
    expect(caption).toEqual({ x: 137, y: 244, w: 186, h: 46.5 });
    expect(bottomOf(caption ?? { x: 0, y: 0, w: 0, h: Infinity })).toBeLessThanOrEqual(hub.room.bottom);
  });

  it('drops below an obstacle and is null when nothing fits', () => {
    const view = { cssW: 320, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = sceneHub(view);
    const badge: Rect = { x: 100, y: 152, w: 120, h: 48 };
    const caption = hubCaptionRect(view, frame, hub, HUB_CAPTION, [badge]);
    expect(caption?.y).toBe(tankRooms(view, frame)[1].top);
    expect(hubCaptionRect(view, frame, hub, { w: view.cssW, h: 20 }, [])).toBeNull();
    expect(hubCaptionRect(view, frame, hub, { w: 100, h: 400 }, [])).toBeNull();
  });
});

describe('decorateLayout', () => {
  it('fits 0 to 4 tray items on every supported canvas', () => {
    const problems = supportedCanvases().flatMap((view) =>
      [0, 1, 2, 3, 4].flatMap((trayCount) => [
        ...decorateProblems(view, trayCount, 4),
        ...decorateProblems(view, trayCount, trayCount),
      ]),
    );
    expect(problems).toEqual([]);
  });

  it('fits every tray up to the shipped Decorations on every supported canvas, more than 4 by the tray rule, on every page', () => {
    expect(SHIPPED_DECORATIONS).toHaveLength(25);
    const maxCounts = Array.from({ length: SHIPPED_DECORATIONS.length + 1 }, (_, count) => count);
    const problems = supportedCanvases().flatMap((view) =>
      maxCounts.flatMap((maxTrayCount) =>
        maxCounts.filter((trayCount) => trayCount <= maxTrayCount).flatMap((trayCount) => trayPagesProblems(view, trayCount, maxTrayCount)),
      ),
    );
    expect(problems).toEqual([]);
  }, 30_000);

  it('uses 64 px tray squares and always reserves the Put away slot', () => {
    const view = { cssW: 800, cssH: 600 };
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 2, { ...decorateSizes(view), caption: null });
    for (const rect of layout.tray) expect({ w: rect.w, h: rect.h }).toEqual({ w: TRAY_PX, h: TRAY_PX });
    expect(layout.putAway).toBeDefined();
    expect(layout.caption).toBeNull();
    const empty = decorateLayout(view, tankFrame(view.cssW, view.cssH), 0, decorateSizes(view));
    expect(empty.tray).toEqual([]);
    expect(empty.putAway.w).toBe(PUT_AWAY.w);
  });

  it('lays out 4 tray items compact at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 4, decorateSizes(view), 4);
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([25, 85, 145, 205].map((x) => ({ x, y: 116, w: 48, h: 48 })));
    expect(layout.putAway).toEqual({ x: 265, y: 116, w: 48, h: 48 });
    expect(layout.done).toEqual({ x: 325, y: 108, w: 110, h: 64 });
  });

  it('lays out 4 tray items compact on the wall at 320 x 440', () => {
    const view = { cssW: 320, cssH: 440 };
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 4, decorateSizes(view), 4);
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([16, 76, 136, 196].map((x) => ({ x, y: 16, w: 48, h: 48 })));
    expect(layout.putAway).toEqual({ x: 256, y: 16, w: 48, h: 48 });
    expect(layout.done).toEqual({ x: 105, y: 76, w: 110, h: 64 });
    expect(layout.room).toEqual(tankRooms(view, tankFrame(view.cssW, view.cssH))[0]);
  });

  it('lays out 4 tray items full size in the open water at 1280 x 720', () => {
    const view = { cssW: 1280, cssH: 720 };
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 4, decorateSizes(view), 4);
    expect(layout.compact).toBe(false);
    expect(layout.tray).toEqual([302, 378, 454, 530].map((x) => ({ x, y: 228, w: 64, h: 64 })));
    expect(layout.putAway).toEqual({ x: 606, y: 234.4, w: 160, h: 51.2 });
    expect(layout.done).toEqual({ x: 778, y: 228, w: 200, h: 64 });
  });

  it('lays out a tray of 8 Decorations compact in two rows over the floor band at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = decorateLayout(view, frame, 8, decorateSizes(view), 8);
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([
      ...[26, 86, 146, 206, 266, 326, 386].map((x) => ({ x, y: 108, w: 48, h: 48 })),
      { x: 115, y: 176, w: 48, h: 48 },
    ]);
    expect(layout.putAway).toEqual({ x: 175, y: 176, w: 48, h: 48 });
    expect(layout.done).toEqual({ x: 235, y: 168, w: 110, h: 64 });
    expect(layout.tray[0].y).toBe(topKeepClearCss(frame).y1 + UI.gap);
    expect(bottomOf(layout.done)).toBeGreaterThan(decorationBandTop(frame));
    expect(layout.caption).toEqual({ x: 16, y: 244, w: 428, h: 45 });
  });

  it('lays out a tray of 8 Decorations compact in three rows on the wall, the caption in the water, at 320 x 440', () => {
    const view = { cssW: 320, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = decorateLayout(view, frame, 8, decorateSizes(view), 8);
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([
      ...[16, 76, 136, 196, 256].map((x) => ({ x, y: 16, w: 48, h: 48 })),
      ...[46, 106, 166].map((x) => ({ x, y: 76, w: 48, h: 48 })),
    ]);
    expect(layout.putAway).toEqual({ x: 226, y: 76, w: 48, h: 48 });
    expect(layout.done).toEqual({ x: 105, y: 136, w: 110, h: 64 });
    expect(bottomOf(layout.done)).toBeLessThanOrEqual(topKeepClearCss(frame).y0 - UI.gap);
    expect(layout.caption).toEqual({ x: 16, y: topKeepClearCss(frame).y1 + UI.gap, w: 288, h: 67.5 });
    expect(layout.caption?.y).toBe(284);
  });

  it('lays out a tray of 14 Decorations compact in three rows over the floor band, no room for the caption, at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = decorateLayout(view, frame, 14, decorateSizes(view), 14);
    const rowXs = [26, 86, 146, 206, 266, 326, 386];
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([
      ...rowXs.map((x) => ({ x, y: 108, w: 48, h: 48 })),
      ...rowXs.map((x) => ({ x, y: 168, w: 48, h: 48 })),
    ]);
    expect(layout.putAway).toEqual({ x: 145, y: 236, w: 48, h: 48 });
    expect(layout.done).toEqual({ x: 205, y: 228, w: 110, h: 64 });
    expect(layout.tray[0].y).toBe(topKeepClearCss(frame).y1 + UI.gap);
    expect(bottomOf(layout.done)).toBeGreaterThan(decorationBandTop(frame));
    expect(bottomOf(layout.done) + UI.gap + textSize(DECORATE_CAPTION, BODY_PX, view.cssW - 2 * UI.margin, REGULAR_EM).h).toBeGreaterThan(view.cssH - UI.margin);
    expect(layout.caption).toBeNull();
  });

  it('lays out a tray of 14 Decorations compact in three rows on the wall, Done in the water and no room for the caption, at 320 x 440', () => {
    const view = { cssW: 320, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = decorateLayout(view, frame, 14, decorateSizes(view), 14);
    const rowXs = [16, 76, 136, 196, 256];
    expect(layout.compact).toBe(true);
    expect(layout.tray).toEqual([
      ...rowXs.map((x) => ({ x, y: 16, w: 48, h: 48 })),
      ...rowXs.map((x) => ({ x, y: 76, w: 48, h: 48 })),
      ...rowXs.slice(0, 4).map((x) => ({ x, y: 136, w: 48, h: 48 })),
    ]);
    expect(layout.putAway).toEqual({ x: 256, y: 136, w: 48, h: 48 });
    expect(bottomOf(layout.putAway)).toBeLessThanOrEqual(topKeepClearCss(frame).y0 - UI.gap);
    expect(layout.done).toEqual({ x: 105, y: topKeepClearCss(frame).y1 + UI.gap, w: 110, h: 64 });
    expect(layout.done.y).toBe(284);
    expect(bottomOf(layout.done) + UI.gap + textSize(DECORATE_CAPTION, BODY_PX, view.cssW - 2 * UI.margin, REGULAR_EM).h).toBeGreaterThan(view.cssH - UI.margin);
    expect(layout.caption).toBeNull();
  });

  it('puts Done in the open water under the top band when the wall holds only the tray at 340 x 440', () => {
    const view = { cssW: 340, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const layout = decorateLayout(view, frame, 8, decorateSizes(view), 8);
    expect(layout.tray.map((rect) => rect.y)).toEqual([16, 16, 16, 16, 16, 76, 76, 76]);
    expect(layout.putAway.y).toBe(76);
    expect(layout.done).toEqual({ x: 115, y: topKeepClearCss(frame).y1 + UI.gap, w: 110, h: 64 });
  });

  it('chooses the look from the most tray items so it holds still as the tray empties', () => {
    const view = { cssW: 320, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const held = decorateLayout(view, frame, 0, decorateSizes(view), 4);
    expect(held.compact).toBe(true);
    expect(held.putAway).toMatchObject({ w: ICON_TILE.w, h: ICON_TILE.h });
    expect(held.done).toMatchObject(COMPACT_DONE);
    expect(decorateLayout(view, frame, 0, decorateSizes(view)).compact).toBe(false);
  });

  it('uses the measured compact sizes when given', () => {
    const view = { cssW: 460, cssH: 320 };
    const compact = { putAway: { w: 50, h: 50 }, done: { w: 120, h: 64 } };
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 1, { ...decorateSizes(view), compact }, 4);
    expect(layout.putAway).toMatchObject(compact.putAway);
    expect(layout.done).toMatchObject(compact.done);
  });

  it.each([
    { cssW: 460, cssH: 320 },
    { cssW: 320, cssH: 440 },
    { cssW: 1280, cssH: 720 },
  ])('keeps a dev tray of 7 clear of the top band and inside the canvas at $cssW x $cssH', (view) => {
    const label = `decorate ${view.cssW}x${view.cssH} tray=7`;
    const layout = decorateLayout(view, tankFrame(view.cssW, view.cssH), 7, decorateSizes(view), 7);
    const targets = decorateTargets(layout);
    const all: [string, Rect][] = layout.caption ? [...targets, ['caption', layout.caption]] : targets;
    expect(layout.tray).toHaveLength(7);
    expect([
      ...spacingProblems(label, marginBounds(view), all),
      ...targetProblems(label, targets),
      ...keepClearProblems(label, view, all),
    ]).toEqual([]);
  });
});

/** The decorate layout the fit test checks: `trayCount` of `maxTrayCount` on `page`, with the caption. */
function sceneDecorate(view: HudView, trayCount: number, maxTrayCount: number, page = 0): DecorateLayout {
  return decorateLayout(view, tankFrame(view.cssW, view.cssH), trayCount, decorateSizes(view), maxTrayCount, page);
}

/** Every tray count from `least` up to the shipped Decorations. */
function traysFrom(least: number): number[] {
  return Array.from({ length: SHIPPED_DECORATIONS.length - least + 1 }, (_, index) => least + index);
}

/** Canvases where a tray of 18 to 25 of the shipped Decorations fits no room and goes in pages, with the trays that page. */
const PAGED_TRAYS: readonly [HudView, readonly number[]][] = [
  [{ cssW: 320, cssH: 440 }, traysFrom(22)],
  [{ cssW: 320, cssH: 480 }, traysFrom(22)],
  [{ cssW: 340, cssH: 440 }, traysFrom(23)],
  [{ cssW: 340, cssH: 480 }, traysFrom(23)],
  [{ cssW: 360, cssH: 440 }, traysFrom(18)],
  [{ cssW: 360, cssH: 480 }, traysFrom(23)],
  [{ cssW: 375, cssH: 440 }, traysFrom(18)],
  [{ cssW: 375, cssH: 480 }, traysFrom(23)],
  [{ cssW: 390, cssH: 440 }, traysFrom(22)],
  [{ cssW: 430, cssH: 440 }, traysFrom(22)],
  ...[460, 480].flatMap((cssW) =>
    [320, 340, 360, 375].map((cssH): [HudView, readonly number[]] => [{ cssW, cssH }, traysFrom(19)]),
  ),
  [{ cssW: 480, cssH: 414 }, traysFrom(19)],
  ...[320, 340, 360, 375].map((cssH): [HudView, readonly number[]] => [{ cssW: 520, cssH }, traysFrom(22)]),
  ...[320, 340, 360, 375].map((cssH): [HudView, readonly number[]] => [{ cssW: 568, cssH }, traysFrom(25)]),
];

describe('decorate tray pages', () => {
  it('pages only trays of 18 or more at 360 and 375 x 440, 19 or more at 460 and 480 by 320 to 375 and 480 x 414, 22 or 23 or more on the other narrow canvases, and 25 at 568 wide', () => {
    const maxCounts = Array.from({ length: SHIPPED_DECORATIONS.length + 1 }, (_, count) => count);
    const paged = supportedCanvases().flatMap((view) => {
      const counts = maxCounts.filter((trayCount) => sceneDecorate(view, trayCount, SHIPPED_DECORATIONS.length).pageCount > 1);
      return counts.length > 0 ? [`${view.cssW}x${view.cssH}: ${counts.join(',')}`] : [];
    });
    expect(paged).toEqual(PAGED_TRAYS.map(([view, counts]) => `${view.cssW}x${view.cssH}: ${counts.join(',')}`));
  }, 30_000);

  it('keeps every one-page tray exactly as the tray rule lays it out, with no Back or Next, whatever page is asked for', () => {
    const problems = supportedCanvases().flatMap((view) =>
      Array.from({ length: 18 }, (_, trayCount) => trayCount).flatMap((trayCount) => {
        const label = `${view.cssW}x${view.cssH} tray=${trayCount}`;
        const layout = sceneDecorate(view, trayCount, SHIPPED_DECORATIONS.length);
        const shape = { page: 0, pageCount: 1, trayStart: 0, pageSize: trayCount, previousPage: null, nextPage: null };
        const fields = { page: layout.page, pageCount: layout.pageCount, trayStart: layout.trayStart, pageSize: layout.pageSize, previousPage: layout.previousPage, nextPage: layout.nextPage };
        const sameOnEveryPage = [1, -1, 7, Number.NaN].every((page) => JSON.stringify(sceneDecorate(view, trayCount, SHIPPED_DECORATIONS.length, page)) === JSON.stringify(layout));
        return [
          ...(JSON.stringify(fields) === JSON.stringify(shape) ? [] : [`${label}: paged`]),
          ...(sameOnEveryPage ? [] : [`${label}: changes with the page asked for`]),
        ];
      }),
    );
    expect(problems).toEqual([]);
  }, 30_000);

  it('lays out 20 Decorations at 460 x 320 in two pages of two rows of 7, with Back, Next, Put away and Done in one row under them', () => {
    const view = { cssW: 460, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const rowXs = [26, 86, 146, 206, 266, 326, 386];
    const first = sceneDecorate(view, 20, 20);
    const second = sceneDecorate(view, 20, 20, 1);
    expect(first).toMatchObject({ compact: true, page: 0, pageCount: 2, trayStart: 0, pageSize: 14 });
    expect(first.tray).toEqual([
      ...rowXs.map((x) => ({ x, y: 108, w: 48, h: 48 })),
      ...rowXs.map((x) => ({ x, y: 168, w: 48, h: 48 })),
    ]);
    expect(second).toMatchObject({ page: 1, pageCount: 2, trayStart: 14, pageSize: 14 });
    expect(second.tray).toEqual([56, 116, 176, 236, 296, 356].map((x) => ({ x, y: 108, w: 48, h: 48 })));
    for (const layout of [first, second]) {
      expect(layout.previousPage).toEqual({ x: 85, y: 236, w: 48, h: 48 });
      expect(layout.nextPage).toEqual({ x: 145, y: 236, w: 48, h: 48 });
      expect(layout.putAway).toEqual({ x: 205, y: 236, w: 48, h: 48 });
      expect(layout.done).toEqual({ x: 265, y: 228, w: 110, h: 64 });
      expect(layout.tray[0].y).toBe(topKeepClearCss(frame).y1 + UI.gap);
      expect(bottomOf(layout.done)).toBeLessThanOrEqual(view.cssH - UI.margin);      expect(layout.caption).toBeNull();
    }
  });

  it('lays out 20 Decorations at 360 x 440 in two pages of two rows of 5 on the wall, with the control row in the open water', () => {
    const view = { cssW: 360, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const rowXs = [36, 96, 156, 216, 276];
    const expectedTray = [...rowXs.map((x) => ({ x, y: 16, w: 48, h: 48 })), ...rowXs.map((x) => ({ x, y: 76, w: 48, h: 48 }))];
    const first = sceneDecorate(view, 20, 20);
    const second = sceneDecorate(view, 20, 20, 1);
    expect(first).toMatchObject({ compact: true, page: 0, pageCount: 2, trayStart: 0, pageSize: 10 });
    expect(second).toMatchObject({ page: 1, pageCount: 2, trayStart: 10, pageSize: 10 });
    for (const layout of [first, second]) {
      expect(layout.tray).toEqual(expectedTray);
      expect(bottomOf(layout.tray[9])).toBeLessThanOrEqual(lidTopCss(frame) - UI.gap);
      expect(layout.previousPage).toEqual({ x: 35, y: 271, w: 48, h: 48 });
      expect(layout.nextPage).toEqual({ x: 95, y: 271, w: 48, h: 48 });
      expect(layout.putAway).toEqual({ x: 155, y: 271, w: 48, h: 48 });
      expect(layout.done).toEqual({ x: 215, y: 263, w: 110, h: 64 });
      expect(layout.done.y).toBe(topKeepClearCss(frame).y1 + UI.gap);      expect(layout.caption).toEqual({ x: 16, y: 339, w: 328, h: 67.5 });
    }
  });

  it('counts the pages and puts each tray item on exactly one page', () => {
    const view = { cssW: 360, cssH: 440 };
    expect([18, 19, 20].map((trayCount) => sceneDecorate(view, trayCount, 20).pageCount)).toEqual([2, 2, 2]);
    expect(sceneDecorate(view, 18, 20, 1)).toMatchObject({ trayStart: 10, pageSize: 10 });
    expect(sceneDecorate(view, 18, 20, 1).tray).toHaveLength(8);
    expect(sceneDecorate(view, 40, 40).pageCount).toBe(4);
    expect(sceneDecorate(view, 41, 41).pageCount).toBe(5);
    expect(sceneDecorate(view, 41, 41, 4).tray).toHaveLength(1);
  });

  it('clamps the page asked for to the pages there are, and as the tray empties', () => {
    const view = { cssW: 460, cssH: 320 };
    expect(sceneDecorate(view, 20, 20, 5).page).toBe(1);
    expect(sceneDecorate(view, 20, 20, -2).page).toBe(0);
    expect(sceneDecorate(view, 20, 20, Number.NaN).page).toBe(0);
    expect(sceneDecorate(view, 20, 20, Number.POSITIVE_INFINITY).page).toBe(0);
    expect(sceneDecorate(view, 20, 20, 1.7).page).toBe(1);
    expect(sceneDecorate(view, 20, 20, 5)).toEqual(sceneDecorate(view, 20, 20, 1));
    const emptied = sceneDecorate(view, 18, 20, 1);
    expect(emptied).toMatchObject({ page: 0, pageCount: 1, trayStart: 0, previousPage: null, nextPage: null });
    expect(emptied.tray).toHaveLength(18);
  });

  it('finds the page of a tray item, clamped to the pages there are', () => {
    const paged = sceneDecorate({ cssW: 460, cssH: 320 }, 20, 20);
    expect([0, 13, 14, 19, 99, -3].map((index) => trayPageOf(paged, index))).toEqual([0, 0, 1, 1, 1, 0]);
    const onePage = sceneDecorate({ cssW: 460, cssH: 320 }, 18, 20);
    expect([0, 17].map((index) => trayPageOf(onePage, index))).toEqual([0, 0]);
    expect(trayPageOf(sceneDecorate({ cssW: 460, cssH: 320 }, 0, 20), 0)).toBe(0);
  });

  it.each([
    { cssW: 360, cssH: 440 },
    { cssW: 460, cssH: 320 },
    { cssW: 480, cssH: 414 },
    { cssW: 1280, cssH: 720 },
  ])('keeps more Decorations than ship in pages of at most two rows, targets at least 48 px and clear of the top band, at $cssW x $cssH', (view) => {
    const counts = [40, 60, 200];
    expect(sceneDecorate(view, 200, 200).pageCount).toBeGreaterThan(1);
    const problems = counts.flatMap((trayCount) => {
      const first = sceneDecorate(view, trayCount, trayCount);
      return Array.from({ length: first.pageCount }, (_, page) => page).flatMap((page) => {
        const label = `decorate ${view.cssW}x${view.cssH} tray=${trayCount} page=${page}`;
        const layout = sceneDecorate(view, trayCount, trayCount, page);
        const targets = decorateTargets(layout);
        const all: [string, Rect][] = layout.caption ? [...targets, ['caption', layout.caption]] : targets;
        const trayRows = new Set(layout.tray.map((rect) => rect.y)).size;
        const controlCentres = new Set([layout.previousPage, layout.nextPage, layout.putAway, layout.done].map((rect) => rect && rect.y + rect.h / 2));
        const paged = layout.pageCount > 1;
        return [
          ...spacingProblems(label, marginBounds(view), all),
          ...targetProblems(label, targets),
          ...keepClearProblems(label, view, all),
          ...centredRowProblems(label, view, all),
          ...pageProblems(label, layout, trayCount),
          ...(!paged || trayRows <= TRAY_PAGE_ROWS ? [] : [`${label}: ${trayRows} tray rows`]),
          ...(!paged || controlCentres.size === 1 ? [] : [`${label}: Back, Next, Put away and Done not one row`]),
        ];
      });
    });
    expect(problems).toEqual([]);
  });
});

describe('chestLayout', () => {
  it('sizes every chest button to hold each chest label with the pad each side', () => {
    expect(CHEST_BUTTON).toEqual({ w: 78, h: TILE_BUTTON.h });
    for (const label of [PREVIOUS_PAGE_LABEL, CLOSE_LABEL, NEXT_PAGE_LABEL]) {
      expect(CHEST_BUTTON.w).toBeGreaterThanOrEqual(tileLabelW(label) + 2 * BUTTON_LABEL_PAD);
    }
  });

  it('fits on every supported canvas with at least two rows per page', () => {
    const problems = supportedCanvases().flatMap(chestProblems);
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 460, cssH: 320 },
    { cssW: 320, cssH: 440 },
  ])('shows at least two rows per page at the smallest canvas $cssW x $cssH', (view) => {
    const layout = chestLayout(view, CHEST_MEASURE);
    expect(rowsPerPage(layout.list.h, CHEST_ROW_H, UI.gap)).toBeGreaterThanOrEqual(2);
  });

  it('puts the buttons in a right column in landscape and a bottom row in portrait', () => {
    const landscape = chestLayout({ cssW: 460, cssH: 320 }, CHEST_MEASURE);
    const columnX = landscape.close.x;
    expect(landscape.back.x).toBe(columnX);
    expect(landscape.next.x).toBe(columnX);
    expect(landscape.close.y).toBeLessThan(landscape.back.y);
    expect(landscape.back.y).toBeLessThan(landscape.next.y);
    expect(columnX).toBeGreaterThan(landscape.list.x + landscape.list.w);

    const portrait = chestLayout({ cssW: 320, cssH: 440 }, CHEST_MEASURE);
    expect(portrait.back.y).toBe(portrait.next.y);
    expect(portrait.next.y).toBe(portrait.close.y);
    expect(portrait.back.x).toBeLessThan(portrait.next.x);
    expect(portrait.next.x).toBeLessThan(portrait.close.x);
    expect(portrait.close.y).toBeGreaterThan(bottomOf(portrait.list));
  });
});

describe('chestShowsTitle', () => {
  it.each<[number, number, boolean]>([
    [100, 80, true],
    [80, 80, true],
    [79, 80, false],
    [0, 32, false],
    [Number.NaN, 32, false],
    [100, Number.NaN, false],
    [Infinity, 32, false],
    [100, Infinity, false],
  ])('gives %s list px and a %s px row a shown title: %s', (listH, rowH, expected) => {
    expect(chestShowsTitle(listH, rowH)).toBe(expected);
  });
});

describe('hideChestTitle', () => {
  it.each([
    { cssW: 460, cssH: 320 },
    { cssW: 320, cssH: 440 },
    { cssW: 1024, cssH: 768 },
  ])('moves the heading to the title top and grows the list up by the same lift at $cssW x $cssH', (view) => {
    const chest = chestLayout(view, CHEST_MEASURE);
    const lift = chest.heading.y - chest.title.y;
    const hidden = hideChestTitle(chest);
    expect(lift).toBeGreaterThan(0);
    expect(hidden.heading).toEqual({ ...chest.heading, y: chest.title.y });
    expect(hidden.list).toEqual({ ...chest.list, y: chest.list.y - lift, h: chest.list.h + lift });
    expect(bottomOf(hidden.list)).toBe(bottomOf(chest.list));
    expect(hidden.list.y - bottomOf(hidden.heading)).toBe(chest.list.y - bottomOf(chest.heading));
    expect(hidden).toEqual({ ...chest, heading: hidden.heading, list: hidden.list });
  });

  it('leaves the chest it is given unchanged', () => {
    const chest = chestLayout({ cssW: 460, cssH: 320 }, CHEST_MEASURE);
    const copy = structuredClone(chest);
    hideChestTitle(chest);
    expect(chest).toEqual(copy);
  });
});
