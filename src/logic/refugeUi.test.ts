import { describe, expect, it } from 'vitest';
import { CARD, SMALLEST_CANVAS, cardTightTextWidth, factCardBodyWrapWidths, isSupportedCanvas, type TextFit } from './cardFit';
import type { HudView, Rect, Size } from './hudLayout';
import { refugeSections } from './refuge';
import {
  REFUGE_AREA_LINE_GAP_PX,
  REFUGE_AREA_LINE_PAD_X,
  REFUGE_AREA_LINE_PAD_Y,
  REFUGE_BACK_BUTTON,
  REFUGE_NEXT_LABEL,
  REFUGE_NEXT_TILE,
  REFUGE_PAN_STEP,
  REFUGE_PAN_TOP_MIN_W,
  REFUGE_PART_GAP_PX,
  REFUGE_PICTURE,
  REFUGE_PICTURE_TOP_BAND_H,
  REFUGE_PREV_LABEL,
  REFUGE_PREV_TILE,
  REFUGE_SECTION_W,
  REFUGE_SEE_AGAIN_TILE,
  REFUGE_SLOT_H,
  clampRefugeScroll,
  fitMilestoneCard,
  initialRefugeScroll,
  maxRefugeScroll,
  milestoneCardSections,
  panRefugeScroll,
  refugeFocusTarget,
  refugeKey,
  refugeLayout,
  scrollToRefugeFocus,
  type MilestoneCardSize,
  type RefugeEntry,
  type RefugeLayout,
  type RefugeMeasure,
} from './refugeUi';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

const TITLE_PX = 28;
const NAME_PX = 18;
const HINT_PX = 18;
const AREA_LINE_PX = 18;
const MARGIN = 16;
const GAP = 12;
const MIN_TARGET_PX = 48;
const PRIMARY_PX = 64;
const BUTTON_H = 64;
/** A square tile's label size and the pad each side of a label-sized body (art guide 8, Button width). */
const TILE_LABEL_PX = 22;
const LABEL_PAD = 6;
const EPS = 1e-6;

const TITLE_TEXT = 'Xochimilco refuge';
const HIDDEN_NAME = '???';
const HINT_TEXT = 'Beat Area 10';

/** The habitat names of the PRD N2 area table, by section id. */
const HABITAT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  canal: 'Canal',
  pond: 'Lily pad pond',
  chinampa: 'Chinampa gardens',
  cave: 'Spring cave',
  deep: 'Deep canal',
});

/** The area line of each section id: today's areas, then made-up future ones, the last the widest. */
const AREA_LINES: Readonly<Record<string, string>> = Object.freeze({
  canal: 'Area 1',
  pond: 'Areas 2 and 3',
  chinampa: 'Areas 4 and 5',
  cave: 'Areas 6 and 7',
  deep: 'Areas 8 to 10',
});

/** Height of a one-line area line panel: 18 px text and the 2 px padding above and below. */
const AREA_LINE_H = AREA_LINE_PX * LINE_HEIGHT_EM + 2 * REFUGE_AREA_LINE_PAD_Y;

/** Height of a section with one-line names and no area-line row: name 30.5, 8, picture 96, 8, slot 64. */
const SECTION_H = 206.5;

/** Height of a section with one-line names and the area-line row: SECTION_H, 4, then the 26.5 px row. */
const SECTION_WITH_ROW_H = SECTION_H + REFUGE_AREA_LINE_GAP_PX + AREA_LINE_H;

/** The tankUi.test canvas grid (art guide 1). */
const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

const SMALL_LANDSCAPE: HudView = SMALLEST_CANVAS.landscape;
const SMALL_PORTRAIT: HudView = SMALLEST_CANVAS.portrait;
const LARGE: HudView = { cssW: 1280, cssH: 720 };

/** Supported canvases from the width and height grid. */
function supportedCanvases(): HudView[] {
  return CANVAS_WIDTHS.flatMap((cssW) =>
    CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
  );
}

/** Greedy word wrap of `text` at `px` and `em` per letter at `wrapW`; a word longer than wrapW gets its own line. */
function wrapSize(text: string, px: number, wrapW: number, em: number): Size {
  const charW = em * px;
  const lines: number[] = [];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    const joined = last >= 0 ? lines[last] + 1 + word.length : Infinity;
    if (joined * charW <= wrapW) lines[last] = joined;
    else lines.push(word.length);
  }
  return { w: Math.max(...lines) * charW, h: lines.length * px * LINE_HEIGHT_EM };
}

/** A bold text panel at most `wrapW` wide: the text wrapped inside its padding (`padX` across, `padY` down), plus the padding. */
function panelSize(text: string, px: number, wrapW: number, padX: number, padY: number): Size {
  const textSize = wrapSize(text, px, wrapW - 2 * padX, BOLD_EM);
  return { w: textSize.w + 2 * padX, h: textSize.h + 2 * padY };
}

/** An area line panel as the scene draws it: 18 px text padded 8 across and 2 down. */
function areaLineSize(id: string, wrapW: number): Size {
  return panelSize(AREA_LINES[id], AREA_LINE_PX, wrapW, REFUGE_AREA_LINE_PAD_X, REFUGE_AREA_LINE_PAD_Y);
}

/**
 * Panels as the scene draws them: the title padded 8 all round, names and hints 8 across and 4 down,
 * area lines 8 across and 2 down. The canal and clean sections show; the others are "???", with no
 * area line.
 */
function measureFor(entries: readonly RefugeEntry[]): RefugeMeasure {
  const shown = new Set(entries.filter((entry) => entry.seeAgain).map((entry) => entry.id));
  const shows = (id: string): boolean => id === 'canal' || shown.has(id);
  return {
    title: (wrapW) => panelSize(TITLE_TEXT, TITLE_PX, wrapW, 8, 8),
    name: (id, wrapW) => panelSize(shows(id) ? HABITAT_NAMES[id] : HIDDEN_NAME, NAME_PX, wrapW, 8, 4),
    hint: (id, wrapW) => (id === 'canal' ? null : panelSize(HINT_TEXT, HINT_PX, wrapW, 8, 4)),
    areaLine: (id, wrapW) => (shows(id) ? areaLineSize(id, wrapW) : null),
  };
}

/** The measure without area lines, as before issue #113. */
function measureWithoutAreaLines(entries: readonly RefugeEntry[]): RefugeMeasure {
  const { title, name, hint } = measureFor(entries);
  return { title, name, hint };
}

/** Every habitat named and every area line shown, so the widest names and area lines are measured. */
const NAMED_MEASURE: RefugeMeasure = {
  ...measureFor([]),
  name: (id, wrapW) => panelSize(HABITAT_NAMES[id], NAME_PX, wrapW, 8, 4),
  areaLine: areaLineSize,
};

/** The five PRD N2 habitat sections; the first `clean` of them show "See it again". */
function fiveSections(clean: number): RefugeEntry[] {
  return Object.keys(HABITAT_NAMES).map((id, index) => ({ id, seeAgain: index < clean }));
}

/** Today's sections, one per habitat in the area table; the first `clean` of them show "See it again". */
function todaysSections(clean: number): RefugeEntry[] {
  return refugeSections({}).map((section, index) => ({ id: section.habitatId, seeAgain: index < clean }));
}

const ONE_SECTION: readonly RefugeEntry[] = [{ id: 'canal', seeAgain: false }];
const ENTRY_SETS: readonly (readonly RefugeEntry[])[] = [
  ONE_SECTION,
  todaysSections(0),
  todaysSections(1),
  todaysSections(3),
  fiveSections(0),
  fiveSections(2),
  fiveSections(5),
];

/** Room between two rects: the larger of the horizontal and vertical gaps (negative when they overlap). */
function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** Whether `inner` lies inside `outer`. */
function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS
  );
}

/** Every pair of `rects` at least `least` apart. */
function expectApart(rects: readonly Rect[], least: number): void {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) expect(gapBetween(rects[i], rects[j])).toBeGreaterThanOrEqual(least - EPS);
  }
}

/** The fixed screen parts that show: Back, Prev, Next and the title when shown. */
function fixedParts(layout: RefugeLayout): Rect[] {
  return [layout.back, layout.prev, layout.next, ...(layout.title === null ? [] : [layout.title])];
}

/** The rect of content rect `rect` on screen at `scroll`. */
function onScreen(layout: RefugeLayout, rect: Rect, scroll: number): Rect {
  return { x: layout.viewport.x + rect.x - scroll, y: layout.viewport.y + rect.y, w: rect.w, h: rect.h };
}

/** Whether section `index` shows whole inside the viewport's side margins at `scroll`. */
function sectionShows(layout: RefugeLayout, index: number, scroll: number): boolean {
  const rect = onScreen(layout, layout.sections[index].rect, scroll);
  const inner = { x: MARGIN, y: layout.viewport.y, w: layout.viewport.w - 2 * MARGIN, h: layout.viewport.h };
  return inside(rect, inner);
}

/** Every layout case: each supported canvas with each entry set. */
const CASES = supportedCanvases().flatMap((view) => ENTRY_SETS.map((entries) => ({ view, entries })));

/** The layout of one case. */
function layoutOf(view: HudView, entries: readonly RefugeEntry[]): RefugeLayout {
  return refugeLayout(view, entries, measureFor(entries));
}

describe('refuge section parts', () => {
  it('draws the picture 200 x 96, as wide as a section', () => {
    expect(REFUGE_PICTURE).toEqual({ w: 200, h: 96 });
    expect(REFUGE_SECTION_W).toBe(200);
  });

  it('sizes the tiles and Back: See it again 171 x 64, Previous 118 x 64, Next 65 x 64, Back 200 x 64', () => {
    expect(REFUGE_SEE_AGAIN_TILE).toEqual({ w: 171, h: PRIMARY_PX });
    expect(REFUGE_PREV_TILE).toEqual({ w: 118, h: PRIMARY_PX });
    expect(REFUGE_NEXT_TILE).toEqual({ w: 65, h: PRIMARY_PX });
    expect(REFUGE_BACK_BUTTON).toEqual({ w: 200, h: PRIMARY_PX });
    expect(REFUGE_SLOT_H).toBe(PRIMARY_PX);
    expect(REFUGE_SEE_AGAIN_TILE.w).toBeLessThanOrEqual(REFUGE_SECTION_W);
  });

  it('labels the pan tiles Previous and Next, as wide as their labels need (art guide 8, Button width)', () => {
    expect(REFUGE_PREV_LABEL).toBe('Previous');
    expect(REFUGE_NEXT_LABEL).toBe('Next');
    for (const [label, tile] of [
      [REFUGE_PREV_LABEL, REFUGE_PREV_TILE],
      [REFUGE_NEXT_LABEL, REFUGE_NEXT_TILE],
    ] as const) {
      expect(tile.w).toBe(Math.max(PRIMARY_PX, Math.ceil(label.length * BOLD_EM * TILE_LABEL_PX + 2 * LABEL_PAD - EPS)));
    }
  });

  it('puts the pan tiles beside Back from 439 px wide: 16 + Back 200 + 12 + Previous 118 + 12 + Next 65 + 16', () => {
    expect(REFUGE_PAN_TOP_MIN_W).toBe(439);
    expect(refugeLayout({ cssW: 439, cssH: 440 }, ONE_SECTION, measureFor(ONE_SECTION)).panAtBottom).toBe(false);
    expect(refugeLayout({ cssW: 438, cssH: 440 }, ONE_SECTION, measureFor(ONE_SECTION)).panAtBottom).toBe(true);
  });
});

describe('refugeLayout', () => {
  it('throws for no sections or two sections sharing an id', () => {
    expect(() => refugeLayout(LARGE, [], NAMED_MEASURE)).toThrow(RangeError);
    expect(() => refugeLayout(LARGE, [ONE_SECTION[0], ONE_SECTION[0]], NAMED_MEASURE)).toThrow(RangeError);
  });

  it('fits every PRD N2 habitat name on one line in a section', () => {
    for (const name of Object.values(HABITAT_NAMES)) {
      expect(panelSize(name, NAME_PX, REFUGE_SECTION_W, 8, 4).h).toBeCloseTo(NAME_PX * LINE_HEIGHT_EM + 8);
    }
    expect(refugeLayout(SMALL_LANDSCAPE, fiveSections(0), NAMED_MEASURE).fits).toBe(true);
  });

  it.each(CASES)('fits $view.cssW x $view.cssH with $entries.length section(s)', ({ view, entries }) => {
    const layout = layoutOf(view, entries);
    expect(layout.fits).toBe(true);
    expect(layout.sections.map((section) => section.id)).toEqual(entries.map((entry) => entry.id));
    expect(layout.tiles.map((tile) => tile.id)).toEqual(entries.filter((entry) => entry.seeAgain).map((entry) => entry.id));
    for (const rect of [layout.back, layout.prev, layout.next, ...layout.tiles.map((tile) => tile.rect)]) {
      expect(rect.w).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(rect.h).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
  });

  it.each(CASES)('keeps $view.cssW x $view.cssH with $entries.length section(s) apart and in bounds', ({ view, entries }) => {
    const layout = layoutOf(view, entries);
    const screen = { x: 0, y: 0, w: view.cssW, h: view.cssH };
    const inMargins = { x: MARGIN, y: MARGIN, w: view.cssW - 2 * MARGIN, h: view.cssH - 2 * MARGIN };
    const fixed = fixedParts(layout);
    for (const part of fixed) expect(inside(part, inMargins)).toBe(true);
    expectApart(fixed, GAP);
    expect(inside(layout.viewport, screen)).toBe(true);
    expect(inside(layout.viewport, { x: 0, y: MARGIN, w: view.cssW, h: view.cssH - 2 * MARGIN })).toBe(true);
    for (const part of fixed) expect(gapBetween(part, layout.viewport)).toBeGreaterThanOrEqual(GAP - EPS);

    expect(layout.content.h).toBe(layout.viewport.h);
    expect(layout.content.w).toBeGreaterThanOrEqual(layout.viewport.w);
    const inner = { x: MARGIN, y: 0, w: layout.content.w - 2 * MARGIN, h: layout.content.h };
    const blocks = [...layout.sections.map((section) => section.rect), layout.teaser];
    for (const block of blocks) expect(inside(block, inner)).toBe(true);
    expectApart(blocks, GAP);
    expectApart(
      layout.tiles.map((tile) => tile.rect),
      GAP,
    );
  });

  it.each(CASES)('places the area lines on $view.cssW x $view.cssH with $entries.length section(s) (issue #113, ND-8)', ({ view, entries }) => {
    const measure = measureFor(entries);
    const layout = refugeLayout(view, entries, measure);
    const pictureYs = new Set(layout.sections.map((section) => section.picture.y - section.rect.y));
    expect(pictureYs.size).toBe(1);
    for (const section of layout.sections) {
      const expected = measure.areaLine?.(section.id, REFUGE_SECTION_W) ?? null;
      if (expected === null || section.areaLine === null) {
        expect(section.areaLine).toBe(expected);
        continue;
      }
      expect({ w: section.areaLine.w, h: section.areaLine.h }).toEqual(expected);
      expect(section.areaLine.h).toBeGreaterThanOrEqual(AREA_LINE_PX);
      expect(inside(section.areaLine, section.rect)).toBe(true);
      expect(section.areaLine.x - section.rect.x).toBeCloseTo(section.rect.x + section.rect.w - (section.areaLine.x + section.areaLine.w));
      const nameRowEnd = section.rect.y + section.name.h;
      expect(section.areaLine.y).toBeGreaterThanOrEqual(nameRowEnd - EPS);
      expect(gapBetween(section.areaLine, section.slot)).toBeGreaterThanOrEqual(REFUGE_PART_GAP_PX - EPS);
      if (layout.areaLineOnPicture) {
        expect(section.areaLine.y).toBeCloseTo(nameRowEnd);
        expect(section.areaLine.y + section.areaLine.h).toBeLessThanOrEqual(section.picture.y + REFUGE_PICTURE_TOP_BAND_H + EPS);
      } else {
        expect(section.areaLine.y - nameRowEnd).toBeGreaterThanOrEqual(REFUGE_AREA_LINE_GAP_PX - EPS);
        expect(section.picture.y - (section.areaLine.y + section.areaLine.h)).toBeGreaterThanOrEqual(REFUGE_PART_GAP_PX - EPS);
      }
    }
  });

  it.each(supportedCanvases())('puts the area lines on the pictures only on the 320 and 340 px tall canvases: $cssW x $cssH', (view) => {
    const layout = layoutOf(view, todaysSections(1));
    expect(layout.areaLineOnPicture).toBe(view.cssH <= 340);
    expect(layout.sections[0].rect.h).toBeCloseTo(layout.areaLineOnPicture ? SECTION_H : SECTION_WITH_ROW_H);
    expect(layout.sections[0].rect.h).toBeLessThanOrEqual(layout.viewport.h);
    expect(layout.fits).toBe(true);
  });

  it.each(CASES)('stacks each section on $view.cssW x $view.cssH: name, 8, picture, 8, slot', ({ view, entries }) => {
    const layout = layoutOf(view, entries);
    for (const section of layout.sections) {
      expect(section.rect.w).toBe(REFUGE_SECTION_W);
      expect(inside(section.name, section.rect)).toBe(true);
      expect(section.picture).toEqual({ x: section.rect.x, y: section.picture.y, w: 200, h: 96 });
      expect(section.picture.y - (section.name.y + section.name.h)).toBeGreaterThanOrEqual(8 - EPS);
      expect(section.slot.y).toBe(section.picture.y + section.picture.h + 8);
      expect(section.slot.y + section.slot.h).toBe(section.rect.y + section.rect.h);
      expect(section.slot.h).toBe(REFUGE_SLOT_H);
      const filled = section.seeAgain ?? section.hint;
      if (filled !== null) expect(inside(filled, section.slot)).toBe(true);
      expect(section.seeAgain !== null && section.hint !== null).toBe(false);
    }
    expect(layout.teaser.w).toBe(REFUGE_SECTION_W);
    expect(layout.teaser.h).toBe(layout.sections[0].rect.h);
    expect(layout.teaser.y).toBe(layout.sections[0].rect.y);
  });

  it('shows the See it again tile only on clean sections, and the hint on the others that have one', () => {
    const entries = fiveSections(2);
    const layout = layoutOf(SMALL_LANDSCAPE, entries);
    expect(layout.sections.map((section) => section.seeAgain !== null)).toEqual([true, true, false, false, false]);
    expect(layout.sections.map((section) => section.hint !== null)).toEqual([false, false, true, true, true]);
    const canalOnly = layoutOf(SMALL_LANDSCAPE, ONE_SECTION);
    expect(canalOnly.sections[0].hint).toBeNull();
    expect(canalOnly.tiles).toEqual([]);
  });

  it('runs the sections along x 12 px apart, then the teaser', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(0));
    expect(layout.sections[0].rect.x).toBe(MARGIN);
    layout.sections.forEach((section, index) => expect(section.rect.x).toBe(MARGIN + index * REFUGE_PAN_STEP));
    expect(layout.teaser.x).toBe(MARGIN + 5 * REFUGE_PAN_STEP);
    expect(layout.content.w).toBe(layout.teaser.x + layout.teaser.w + MARGIN);
  });

  it('centres a refuge narrower than the viewport, so it does not scroll', () => {
    const layout = layoutOf(LARGE, ONE_SECTION);
    expect(layout.content.w).toBe(layout.viewport.w);
    const left = layout.sections[0].rect.x;
    const right = layout.content.w - (layout.teaser.x + layout.teaser.w);
    expect(left).toBeCloseTo(right);
    expect(maxRefugeScroll(layout)).toBe(0);
  });

  it('hides the title when it does not fit beside Back and shows it when it does', () => {
    expect(layoutOf(SMALL_LANDSCAPE, ONE_SECTION).title).toBeNull();
    expect(layoutOf(SMALL_PORTRAIT, ONE_SECTION).title).toBeNull();
    const wide = layoutOf(LARGE, ONE_SECTION);
    if (wide.title === null) throw new Error('expected the title to show');
    expect(wide.title.x).toBeGreaterThanOrEqual(wide.back.x + wide.back.w + GAP - EPS);
    expect(wide.title.x + wide.title.w).toBeLessThanOrEqual(wide.prev.x - GAP + EPS);
    expect(wide.title.h).toBeLessThanOrEqual(wide.back.h);
  });

  it('reports a section taller than the viewport', () => {
    expect(refugeLayout({ cssW: 460, cssH: 300 }, ONE_SECTION, NAMED_MEASURE).fits).toBe(false);
  });

  it('shows no area line and no row when the measure has no area lines', () => {
    for (const view of [LARGE, SMALL_LANDSCAPE, SMALL_PORTRAIT]) {
      const entries = fiveSections(2);
      const layout = refugeLayout(view, entries, measureWithoutAreaLines(entries));
      expect(layout.sections.map((section) => section.areaLine)).toEqual([null, null, null, null, null]);
      expect(layout.areaLineOnPicture).toBe(false);
      expect(layout.sections[0].rect.h).toBeCloseTo(SECTION_H);
      expect(layout.fits).toBe(true);
    }
  });

  it('shows no area line and no row when no section shows one', () => {
    const entries = fiveSections(0);
    const measure: RefugeMeasure = { ...measureFor(entries), areaLine: () => null };
    const layout = refugeLayout(LARGE, entries, measure);
    expect(layout.sections.every((section) => section.areaLine === null)).toBe(true);
    expect(layout.areaLineOnPicture).toBe(false);
    expect(layout.sections[0].rect.h).toBeCloseTo(SECTION_H);
  });

  it('gives every section the area-line row, a "???" section an empty one', () => {
    const entries = fiveSections(2);
    const layout = layoutOf(LARGE, entries);
    expect(layout.areaLineOnPicture).toBe(false);
    expect(layout.sections.map((section) => section.areaLine !== null)).toEqual([true, true, false, false, false]);
    for (const section of layout.sections) {
      expect(section.rect.h).toBeCloseTo(SECTION_WITH_ROW_H);
      expect(section.picture.y - section.rect.y).toBeCloseTo(30.5 + REFUGE_AREA_LINE_GAP_PX + AREA_LINE_H + REFUGE_PART_GAP_PX);
    }
    const [canal] = layout.sections;
    expect(canal.areaLine).toEqual({
      x: canal.rect.x + (REFUGE_SECTION_W - areaLineSize('canal', REFUGE_SECTION_W).w) / 2,
      y: canal.rect.y + 30.5 + REFUGE_AREA_LINE_GAP_PX,
      w: areaLineSize('canal', REFUGE_SECTION_W).w,
      h: AREA_LINE_H,
    });
    expect(layout.teaser.h).toBeCloseTo(SECTION_WITH_ROW_H);
  });

  it('keeps the row as tall as the tallest area line panel, each one centred in it', () => {
    const entries = fiveSections(5);
    const measure: RefugeMeasure = {
      ...measureFor(entries),
      areaLine: (id, wrapW) => (id === 'pond' ? { w: 120, h: 40 } : areaLineSize(id, wrapW)),
    };
    const layout = refugeLayout(LARGE, entries, measure);
    const [canal, pond] = layout.sections;
    expect(canal.rect.h).toBeCloseTo(SECTION_H + REFUGE_AREA_LINE_GAP_PX + 40);
    expect(pond.areaLine?.y).toBeCloseTo(pond.rect.y + 30.5 + REFUGE_AREA_LINE_GAP_PX);
    expect(canal.areaLine?.y).toBeCloseTo(canal.rect.y + 30.5 + REFUGE_AREA_LINE_GAP_PX + (40 - AREA_LINE_H) / 2);
  });

  it('reports an area line panel wider than a section', () => {
    const measure: RefugeMeasure = { ...NAMED_MEASURE, areaLine: () => ({ w: REFUGE_SECTION_W + 1, h: AREA_LINE_H }) };
    expect(refugeLayout(LARGE, fiveSections(0), measure).fits).toBe(false);
    expect(refugeLayout(SMALL_LANDSCAPE, fiveSections(0), measure).fits).toBe(false);
  });

  it('reports an area line panel over the picture that ends below its top band', () => {
    const tall = 8 + REFUGE_PICTURE_TOP_BAND_H;
    const fitting: RefugeMeasure = { ...NAMED_MEASURE, areaLine: () => ({ w: 150, h: tall }) };
    const fittingLayout = refugeLayout(SMALL_LANDSCAPE, fiveSections(0), fitting);
    expect(fittingLayout.areaLineOnPicture).toBe(true);
    expect(fittingLayout.fits).toBe(true);
    const tooTall: RefugeMeasure = { ...NAMED_MEASURE, areaLine: () => ({ w: 150, h: tall + 1 }) };
    const tooTallLayout = refugeLayout(SMALL_LANDSCAPE, fiveSections(0), tooTall);
    expect(tooTallLayout.areaLineOnPicture).toBe(true);
    expect(tooTallLayout.fits).toBe(false);
  });

  it('keeps the picture top band clear of the trash (picture y 25) and plants (picture y 22), with room for an 18 px area line', () => {
    expect(REFUGE_PICTURE_TOP_BAND_H).toBe(20);
    expect(REFUGE_PICTURE_TOP_BAND_H).toBeLessThanOrEqual(22);
    expect(AREA_LINE_H - REFUGE_PART_GAP_PX).toBeLessThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
    expect(REFUGE_AREA_LINE_PAD_X).toBe(8);
    expect(REFUGE_AREA_LINE_PAD_Y).toBe(2);
    expect(REFUGE_AREA_LINE_GAP_PX).toBe(4);
  });

  it('reports a hint panel too tall for its slot', () => {
    const measure: RefugeMeasure = { ...NAMED_MEASURE, hint: () => ({ w: 100, h: REFUGE_SLOT_H + 1 }) };
    expect(refugeLayout(LARGE, fiveSections(0), measure).fits).toBe(false);
  });
});

describe('refugeLayout at the smallest canvases', () => {
  it('shows two whole sections at 460 x 320: viewport 460 x 212, section 206.5 tall, pan tiles top-right', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(0));
    expect(layout.viewport).toEqual({ x: 0, y: 92, w: 460, h: 212 });
    expect(layout.sections[0].rect.h).toBeCloseTo(206.5);
    expect(layout.areaLineOnPicture).toBe(true);
    expect(layout.fits).toBe(true);
    expect(layout.panAtBottom).toBe(false);
    expect(layout.prev).toEqual({ x: 249, y: MARGIN, w: 118, h: 64 });
    expect(layout.next).toEqual({ x: 379, y: MARGIN, w: 65, h: 64 });
    expect(layout.title).toBeNull();
    expect(sectionShows(layout, 0, 0)).toBe(true);
    expect(sectionShows(layout, 1, 0)).toBe(true);
    expect(sectionShows(layout, 2, 0)).toBe(false);
  });

  it('puts the area lines over the pictures at 460 x 320, straight under the names, within the top band', () => {
    const entries = fiveSections(5);
    const layout = layoutOf(SMALL_LANDSCAPE, entries);
    expect(layout.viewport).toEqual({ x: 0, y: 92, w: 460, h: 212 });
    expect(layout.areaLineOnPicture).toBe(true);
    expect(layout.fits).toBe(true);
    for (const section of layout.sections) {
      expect(section.rect.h).toBeCloseTo(SECTION_H);
      const areaLine = section.areaLine;
      if (areaLine === null) throw new Error(`expected an area line on ${section.id}`);
      expect(areaLine.y).toBeCloseTo(section.picture.y - REFUGE_PART_GAP_PX);
      expect(areaLine.h).toBeCloseTo(26.5);
      expect(areaLine.y + areaLine.h - section.picture.y).toBeCloseTo(18.5);
      expect(areaLine.y + areaLine.h - section.picture.y).toBeLessThanOrEqual(REFUGE_PICTURE_TOP_BAND_H);
    }
  });

  it('shows one whole section at 320 x 440: viewport 320 x 256, pan tiles in a bottom row', () => {
    const layout = layoutOf(SMALL_PORTRAIT, fiveSections(0));
    expect(layout.viewport).toEqual({ x: 0, y: 92, w: 320, h: 256 });
    expect(layout.areaLineOnPicture).toBe(false);
    expect(layout.sections[0].rect.h).toBeCloseTo(237);
    expect(layout.sections[0].rect.h).toBeLessThanOrEqual(256);
    expect(layout.sections[0].areaLine).not.toBeNull();
    expect(layout.sections[1].areaLine).toBeNull();
    expect(layout.panAtBottom).toBe(true);
    expect(layout.prev).toEqual({ x: 62.5, y: 360, w: 118, h: 64 });
    expect(layout.next).toEqual({ x: 192.5, y: 360, w: 65, h: 64 });
    expect(sectionShows(layout, 0, 0)).toBe(true);
    expect(sectionShows(layout, 1, 0)).toBe(false);
  });

  it.each([SMALL_LANDSCAPE, SMALL_PORTRAIT])(
    "fits today's three sections at $cssW x $cssH, clean or not, and shows the last one whole two pans on",
    (view) => {
      for (const clean of [0, 1, 2, 3]) {
        const entries = todaysSections(clean);
        const layout = layoutOf(view, entries);
        expect(layout.fits, `clean=${clean}`).toBe(true);
        expect(layout.sections.map((section) => section.id)).toEqual(['canal', 'pond', 'chinampa']);
        const twoPans = panRefugeScroll(layout, panRefugeScroll(layout, 0, 1), 1);
        expect(sectionShows(layout, 2, twoPans), `clean=${clean}`).toBe(true);
      }
    },
  );
});

describe('refugeFocusTarget', () => {
  const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(2));

  it('orders the See it again tiles, then Prev, Next and Back', () => {
    expect(refugeFocusTarget(layout, 0)).toEqual({ kind: 'seeAgain', id: 'canal', sectionIndex: 0 });
    expect(refugeFocusTarget(layout, 1)).toEqual({ kind: 'seeAgain', id: 'pond', sectionIndex: 1 });
    expect(refugeFocusTarget(layout, 2)).toEqual({ kind: 'prev' });
    expect(refugeFocusTarget(layout, 3)).toEqual({ kind: 'next' });
    expect(refugeFocusTarget(layout, 4)).toEqual({ kind: 'back' });
  });

  it('throws for a focus past Back', () => {
    expect(() => refugeFocusTarget(layout, 5)).toThrow(RangeError);
    expect(() => refugeFocusTarget(layout, -1)).toThrow(RangeError);
    expect(() => refugeFocusTarget(layout, 0.5)).toThrow(RangeError);
  });
});

describe('refugeKey', () => {
  const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(2));
  const prev = 2;
  const next = 3;
  const back = 4;
  const noTiles = layoutOf(SMALL_LANDSCAPE, fiveSections(0));

  it('cycles Tab and Shift+Tab through the tiles, then Prev, Next and Back, wrapping', () => {
    expect(refugeKey(0, 'next', false, layout)).toEqual({ focus: 1, action: 'none' });
    expect(refugeKey(1, 'next', false, layout)).toEqual({ focus: prev, action: 'none' });
    expect(refugeKey(prev, 'next', false, layout)).toEqual({ focus: next, action: 'none' });
    expect(refugeKey(next, 'next', false, layout)).toEqual({ focus: back, action: 'none' });
    expect(refugeKey(back, 'next', false, layout)).toEqual({ focus: 0, action: 'none' });
    expect(refugeKey(0, 'previous', false, layout)).toEqual({ focus: back, action: 'none' });
    expect(refugeKey(prev, 'previous', false, layout)).toEqual({ focus: 1, action: 'none' });
  });

  it('cycles Prev, Next and Back when no section is clean', () => {
    expect(refugeKey(0, 'next', false, noTiles)).toEqual({ focus: 1, action: 'none' });
    expect(refugeKey(2, 'next', false, noTiles)).toEqual({ focus: 0, action: 'none' });
    expect(refugeKey(0, 'previous', false, noTiles)).toEqual({ focus: 2, action: 'none' });
    expect(refugeKey(2, 'confirm', false, noTiles).action).toBe('back');
  });

  it('pans with Left and Right from any focus, on key repeat too, keeping the focus', () => {
    for (const focus of [0, prev, next, back]) {
      expect(refugeKey(focus, 'left', false, layout)).toEqual({ focus, action: 'panPrev' });
      expect(refugeKey(focus, 'right', false, layout)).toEqual({ focus, action: 'panNext' });
      expect(refugeKey(focus, 'left', true, layout)).toEqual({ focus, action: 'panPrev' });
      expect(refugeKey(focus, 'right', true, layout)).toEqual({ focus, action: 'panNext' });
    }
  });

  it('presses the focused control with Enter or Space', () => {
    expect(refugeKey(1, 'confirm', false, layout)).toEqual({ focus: 1, action: 'seeAgain' });
    expect(refugeKey(prev, 'confirm', false, layout)).toEqual({ focus: prev, action: 'panPrev' });
    expect(refugeKey(next, 'confirm', false, layout)).toEqual({ focus: next, action: 'panNext' });
    expect(refugeKey(back, 'confirm', false, layout)).toEqual({ focus: back, action: 'back' });
  });

  it('ignores a repeated Enter or Space', () => {
    for (const focus of [0, prev, next, back]) expect(refugeKey(focus, 'confirm', true, layout)).toEqual({ focus, action: 'none' });
  });

  it('goes back on Escape from anywhere, on key repeat too', () => {
    for (const focus of [0, prev, next, back]) {
      expect(refugeKey(focus, 'cancel', false, layout)).toEqual({ focus, action: 'back' });
      expect(refugeKey(focus, 'cancel', true, layout)).toEqual({ focus, action: 'back' });
    }
  });

  it('keeps the focus for other keys', () => {
    expect(refugeKey(1, null, false, layout)).toEqual({ focus: 1, action: 'none' });
    expect(refugeKey(1, 'up', false, layout)).toEqual({ focus: 1, action: 'none' });
    expect(refugeKey(1, 'down', false, layout)).toEqual({ focus: 1, action: 'none' });
    expect(refugeKey(1, 'putAway', false, layout)).toEqual({ focus: 1, action: 'none' });
  });

  it('throws for a focus past Back', () => {
    expect(() => refugeKey(back + 1, 'next', false, layout)).toThrow(RangeError);
  });
});

describe('refuge scroll', () => {
  /** Every scroll the pan stops at, panning on from 0 until it stops moving. */
  function panStops(layout: RefugeLayout): number[] {
    const stops = [0];
    for (;;) {
      const next = panRefugeScroll(layout, stops[stops.length - 1], 1);
      if (next === stops[stops.length - 1]) return stops;
      stops.push(next);
    }
  }

  it.each([SMALL_LANDSCAPE, SMALL_PORTRAIT])('pans one section at a time on $cssW x $cssH, then stops at the end', (view) => {
    const layout = layoutOf(view, fiveSections(5));
    const max = maxRefugeScroll(layout);
    expect(max).toBeGreaterThan(0);
    const stops = panStops(layout);
    expect(stops[stops.length - 1]).toBeCloseTo(max);
    for (let i = 1; i < stops.length - 1; i += 1) expect(stops[i] - stops[i - 1]).toBeCloseTo(REFUGE_PAN_STEP);
    expect(panRefugeScroll(layout, max, 1)).toBe(max);
    expect(panRefugeScroll(layout, 0, -1)).toBe(0);
  });

  it.each([SMALL_LANDSCAPE, SMALL_PORTRAIT])('pans back the way it came on $cssW x $cssH', (view) => {
    const layout = layoutOf(view, fiveSections(5));
    const stops = panStops(layout);
    for (let i = stops.length - 1; i > 0; i -= 1) expect(panRefugeScroll(layout, stops[i], -1)).toBeCloseTo(stops[i - 1]);
  });

  it('pans from between stops to the next stop each way', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    expect(panRefugeScroll(layout, 100, 1)).toBe(REFUGE_PAN_STEP);
    expect(panRefugeScroll(layout, 100, -1)).toBe(0);
  });

  it('lines each pan stop up with a section start at the margin, except the clamped end', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    const stops = panStops(layout);
    stops.slice(0, -1).forEach((stop, index) => expect(onScreen(layout, layout.sections[index].rect, stop).x).toBe(MARGIN));
  });

  it('does not pan a refuge that fits', () => {
    const layout = layoutOf(LARGE, ONE_SECTION);
    expect(panRefugeScroll(layout, 0, 1)).toBe(0);
    expect(panRefugeScroll(layout, 0, -1)).toBe(0);
  });

  it('clamps the scroll to the content and rejects one that is not finite', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    const max = maxRefugeScroll(layout);
    expect(max).toBe(layout.content.w - layout.viewport.w);
    expect(clampRefugeScroll(layout, -10)).toBe(0);
    expect(clampRefugeScroll(layout, max + 10)).toBe(max);
    expect(clampRefugeScroll(layout, 50)).toBe(50);
    expect(() => clampRefugeScroll(layout, Number.NaN)).toThrow(RangeError);
    expect(() => panRefugeScroll(layout, Number.POSITIVE_INFINITY, 1)).toThrow(RangeError);
    expect(() => scrollToRefugeFocus(layout, 0, Number.NaN)).toThrow(RangeError);
  });

  it.each(supportedCanvases())('follows the focus to every See it again tile on $cssW x $cssH', (view) => {
    const layout = layoutOf(view, fiveSections(5));
    for (let focus = 0; focus < layout.tiles.length; focus += 1) {
      const fromStart = scrollToRefugeFocus(layout, focus, 0);
      expect(sectionShows(layout, layout.tiles[focus].sectionIndex, fromStart)).toBe(true);
      const fromEnd = scrollToRefugeFocus(layout, focus, maxRefugeScroll(layout));
      expect(sectionShows(layout, layout.tiles[focus].sectionIndex, fromEnd)).toBe(true);
    }
  });

  it('keeps the scroll when the focused tile already shows, and for Prev, Next and Back', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    expect(scrollToRefugeFocus(layout, 1, 0)).toBe(0);
    for (const focus of [5, 6, 7]) expect(scrollToRefugeFocus(layout, focus, 123)).toBe(123);
    expect(scrollToRefugeFocus(layout, 7, 99999)).toBe(maxRefugeScroll(layout));
  });

  it('opens at a given section, clamped to the content', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    expect(initialRefugeScroll(layout, 0)).toBe(0);
    expect(initialRefugeScroll(layout, 2)).toBe(2 * REFUGE_PAN_STEP);
    expect(sectionShows(layout, 2, initialRefugeScroll(layout, 2))).toBe(true);
    expect(initialRefugeScroll(layout, 4)).toBe(Math.min(4 * REFUGE_PAN_STEP, maxRefugeScroll(layout)));
    expect(sectionShows(layout, 4, initialRefugeScroll(layout, 4))).toBe(true);
    expect(initialRefugeScroll(layoutOf(LARGE, ONE_SECTION), 0)).toBe(0);
  });

  it('throws for an opening section that is not a section index', () => {
    const layout = layoutOf(SMALL_LANDSCAPE, fiveSections(5));
    expect(() => initialRefugeScroll(layout, 5)).toThrow(RangeError);
    expect(() => initialRefugeScroll(layout, -1)).toThrow(RangeError);
    expect(() => initialRefugeScroll(layout, 1.5)).toThrow(RangeError);
  });
});

describe('fitMilestoneCard', () => {
  const size: MilestoneCardSize = { titleH: 40, bodyVariants: [{ lines: 4, lineH: 25 }, { lines: 2, lineH: 25 }], actionsH: 64 };
  const pictureH = REFUGE_PICTURE.h;

  it('stacks the title, the 96 px picture, the body and the button', () => {
    expect(milestoneCardSections(40, size)).toEqual([
      { kind: 'fixed', height: 40 },
      { kind: 'fixed', height: 96 },
      { kind: 'body', variants: size.bodyVariants },
      { kind: 'actions', height: 64 },
    ]);
  });

  it('keeps the title when the card fits with it', () => {
    const { fit, showsTitle } = fitMilestoneCard(500, size);
    expect(showsTitle).toBe(true);
    expect(fit.clipped).toBe(false);
    expect(fit.bodyVariant).toBe(0);
    expect(fit.slots.map((slot) => slot.height)).toEqual([40, 96, 100, 64]);
  });

  it('keeps the title with the second body variant when only it fits with the title', () => {
    const { fit, showsTitle } = fitMilestoneCard(40 + pictureH + 50 + 64 + 5 * CARD.tightPad, size);
    expect(showsTitle).toBe(true);
    expect(fit.bodyVariant).toBe(1);
  });

  it('hides the title only when nothing fits with it, then tries the first body variant first', () => {
    const { fit, showsTitle } = fitMilestoneCard(40 + pictureH + 50 + 64 + 5 * CARD.tightPad - 1, size);
    expect(showsTitle).toBe(false);
    expect(fit.clipped).toBe(false);
    expect(fit.slots[0].height).toBe(0);
    expect(fit.slots[1].height).toBe(pictureH);
    expect(fit.bodyVariant).toBe(0);
  });

  it('reports a clip when even the untitled card is too tall', () => {
    const { fit, showsTitle } = fitMilestoneCard(150, size);
    expect(showsTitle).toBe(false);
    expect(fit.clipped).toBe(true);
  });
});

describe('fitMilestoneCard copy fit (representative wording)', () => {
  /** A long milestone: the longest axolotl name (12 letters) and the longest habitat name. */
  const LONG_TITLE = 'Chinampa gardens clean!';
  const LONG_BODY = 'You and Wwwwwwwwwwww cleaned up the Chinampa gardens! Real people in Xochimilco do this work too.';

  /** Lines `text` wraps to at `wrapW`, every character `em * px` wide. */
  function lineCount(text: string, px: number, wrapW: number, em: number): number {
    return Math.round(wrapSize(text, px, wrapW, em).h / (px * LINE_HEIGHT_EM));
  }

  /** The long milestone card's measured size on a `cssW` wide canvas, the fact card wrap rules. */
  function longSize(cssW: number): MilestoneCardSize {
    const bodyVariants: TextFit[] = factCardBodyWrapWidths(cssW).map((wrapW) => ({
      lines: lineCount(LONG_BODY, CARD.bodyPx, wrapW, REGULAR_EM),
      lineH: LINE_HEIGHT_EM * CARD.bodyPx,
    }));
    const titleLines = lineCount(LONG_TITLE, CARD.titlePx, cardTightTextWidth(cssW), BOLD_EM);
    return { titleH: titleLines * LINE_HEIGHT_EM * CARD.titlePx, bodyVariants, actionsH: BUTTON_H };
  }

  it.each(supportedCanvases())('shows the whole picture, body and button at $cssW x $cssH', (view) => {
    const availH = view.cssH - 2 * CARD.margin;
    const size = longSize(view.cssW);
    const { fit } = fitMilestoneCard(availH, size);
    expect(fit.clipped).toBe(false);
    expect(fit.bodyLines).toBe(size.bodyVariants[fit.bodyVariant].lines);
    expect(fit.slots[1].height).toBe(REFUGE_PICTURE.h);
    expect(fit.panelH).toBeLessThanOrEqual(availH);
  });

  it('fits the picture across the card on the narrowest canvas', () => {
    expect(REFUGE_PICTURE.w).toBeLessThanOrEqual(factCardBodyWrapWidths(SMALL_PORTRAIT.cssW)[0]);
  });
});
