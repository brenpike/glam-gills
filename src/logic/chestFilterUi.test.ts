import { describe, expect, it } from 'vitest';
import { AREAS } from './areas';
import { areaLabel } from './areaText';
import { isSupportedCanvas } from './cardFit';
import { RARITIES } from './catalogue';
import {
  AREA_ALL_FOUND,
  FILTER_GROUPS,
  FILTER_GROUP_LABELS,
  FILTER_LABEL,
  FOUND_CHIPS,
  FOUND_CHIP_LABELS,
  SHOW_ALL_LABEL,
  TYPE_CHIP_LABELS,
  type FilterGroup,
} from './chestFilter';
import {
  FILTER_CHIP,
  chestFilterLayout,
  filterChipSize,
  filterFocusOrder,
  type ChestFilterLayout,
  type ChestFilterMeasure,
  type FilterChipRect,
  type FilterGroupPart,
} from './chestFilterUi';
import { rarityName } from './hints';
import type { HudView, Rect, Size } from './hudLayout';
import { CHEST_BUTTON, UI, chestLayout, type ChestMeasure } from './tankUi';
import { CHEST_CATEGORIES } from './treasureChest';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

const MIN_TARGET_PX = 48;
const CHEST_TITLE_PX = 28;
const HEADING_PX = 18;
/** Rarity badge beside a Rarity chip's label: the chest's badge size and the gap to the label. */
const BADGE_PX = 24;
const BADGE_GAP = 6;
/** Widest area count line: two-digit counts. */
const WIDEST_AREA_COUNT = '88 of 88';

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

/** Lines `text` wraps to at `wrapW`, splitting greedily on ' ', every character `em * px` wide. */
function estimateLines(text: string, px: number, wrapW: number, em: number): number {
  const charW = em * px;
  let lines = 1;
  let lineW = 0;
  for (const word of text.split(' ')) {
    const wordW = word.length * charW;
    if (lineW > 0 && lineW + charW + wordW > wrapW) {
      lines += 1;
      lineW = wordW;
    } else {
      lineW += (lineW > 0 ? charW : 0) + wordW;
    }
  }
  return lines;
}

/** Estimated size of `text` wrapped at `wrapW`. */
function textSize(text: string, px: number, wrapW: number, em: number): Size {
  const lines = estimateLines(text, px, wrapW, em);
  return { w: Math.min(wrapW, text.length * em * px), h: lines * LINE_HEIGHT_EM * px };
}

/** Estimated one-line chip label at the chip (body) text size. */
function chipText(label: string): Size {
  return textSize(label, FILTER_CHIP.textPx, Infinity, REGULAR_EM);
}

/** A Rarity chip's content: the badge, a gap, then the rarity name. */
function rarityContent(label: string): Size {
  const text = chipText(label);
  return { w: BADGE_PX + BADGE_GAP + text.w, h: Math.max(BADGE_PX, text.h) };
}

/** An Area chip's content: 'Area N' over the widest count line. */
function areaContent(areaNumber: number): Size {
  const lines = [areaLabel(areaNumber), AREA_ALL_FOUND, WIDEST_AREA_COUNT].map(chipText);
  return { w: Math.max(...lines.map((line) => line.w)), h: 2 * LINE_HEIGHT_EM * FILTER_CHIP.textPx };
}

const CHIPS: Readonly<Record<FilterGroup, readonly Size[]>> = {
  types: CHEST_CATEGORIES.map((category) => filterChipSize(chipText(TYPE_CHIP_LABELS[category]))),
  found: FOUND_CHIPS.map((chip) => filterChipSize(chipText(FOUND_CHIP_LABELS[chip]))),
  rarities: RARITIES.map((rarity) => filterChipSize(rarityContent(rarityName(rarity)))),
  areaIds: AREAS.map((area) => filterChipSize(areaContent(area.number), FILTER_CHIP.areaH)),
};

const MEASURE: ChestFilterMeasure = {
  titleAt: (wrapW) => textSize(FILTER_LABEL, CHEST_TITLE_PX, wrapW, BOLD_EM),
  groupNameAt: (group, wrapW) => textSize(FILTER_GROUP_LABELS[group], HEADING_PX, wrapW, BOLD_EM),
  chips: CHIPS,
  showAll: filterChipSize(chipText(SHOW_ALL_LABEL)),
  done: CHEST_BUTTON,
  back: CHEST_BUTTON,
  next: CHEST_BUTTON,
};

/** The chest measure with the same buttons, for comparing places. */
const CHEST_MEASURE: ChestMeasure = {
  titleAt: () => ({ w: 0, h: 0 }),
  headingAt: () => ({ w: 0, h: 0 }),
  pageText: { w: 0, h: 0 },
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

function rightOf(rect: Rect): number {
  return rect.x + rect.w;
}

/** Larger of the horizontal and vertical clearances between two rects; negative when they overlap. */
function clearance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - rightOf(a), a.x - rightOf(b));
  const dy = Math.max(b.y - bottomOf(a), a.y - bottomOf(b));
  return Math.max(dx, dy);
}

function isInside(rect: Rect, bounds: Rect): boolean {
  return (
    rect.x >= bounds.x - 1e-9 &&
    rect.y >= bounds.y - 1e-9 &&
    rightOf(rect) <= rightOf(bounds) + 1e-9 &&
    bottomOf(rect) <= bottomOf(bounds) + 1e-9
  );
}

/** The panel inside its UI.pad padding. */
function innerOf(panel: Rect): Rect {
  return { x: panel.x + UI.pad, y: panel.y + UI.pad, w: panel.w - 2 * UI.pad, h: panel.h - 2 * UI.pad };
}

function chipName(chip: FilterChipRect): string {
  return `${chip.group}[${chip.index}]`;
}

/** Every named rect page `pageIndex` shows, Back and Next only when paged. */
function pageRects(layout: ChestFilterLayout, pageIndex: number): [string, Rect][] {
  const parts = layout.pages[pageIndex].parts;
  return [
    ['title', layout.title],
    ['showAll', layout.showAll],
    ['done', layout.done],
    ...(layout.paged ? ([['back', layout.back], ['next', layout.next]] as [string, Rect][]) : []),
    ...parts.map((part): [string, Rect] => [`${part.group} name`, part.name]),
    ...parts.flatMap((part) => part.chips.map((chip): [string, Rect] => [chipName(chip), chip.rect])),
  ];
}

/** Touch targets page `pageIndex` shows. */
function pageTargets(layout: ChestFilterLayout, pageIndex: number): [string, Rect][] {
  const targetNames = new Set(['showAll', 'done', 'back', 'next']);
  return pageRects(layout, pageIndex).filter(([name]) => targetNames.has(name) || name.includes('['));
}

/** Problems on one page: rects outside the padded panel, targets under 48 x 48, rects closer than UI.gap. */
function pageProblems(label: string, layout: ChestFilterLayout, pageIndex: number): string[] {
  const where = `${label} page ${pageIndex + 1}`;
  const rects = pageRects(layout, pageIndex);
  const problems: string[] = [];
  const inner = innerOf(layout.panel);
  for (const [name, rect] of rects) {
    if (!isInside(rect, inner)) problems.push(`${where}: ${name} outside the panel`);
  }
  for (const [name, rect] of pageTargets(layout, pageIndex)) {
    if (rect.w < MIN_TARGET_PX || rect.h < MIN_TARGET_PX) problems.push(`${where}: ${name} under ${MIN_TARGET_PX} px`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (clearance(rects[i][1], rects[j][1]) < UI.gap - 1e-9) {
        problems.push(`${where}: ${rects[i][0]} and ${rects[j][0]} closer than ${UI.gap}`);
      }
    }
  }
  return problems;
}

/** Every page of `group` with the part it shows there. */
function partsOf(layout: ChestFilterLayout, group: FilterGroup): { pageIndex: number; part: FilterGroupPart }[] {
  return layout.pages.flatMap((page, pageIndex) =>
    page.parts.filter((part) => part.group === group).map((part) => ({ pageIndex, part })),
  );
}

/** Problems with how the groups sit on the pages: chips not on exactly one page, unsplit groups split, bad Area splits. */
function groupingProblems(label: string, layout: ChestFilterLayout): string[] {
  const problems: string[] = [];
  for (const group of FILTER_GROUPS) {
    const parts = partsOf(layout, group);
    const indices = parts.flatMap(({ part }) => part.chips.map((chip) => chip.index));
    const expected = MEASURE.chips[group].map((_, index) => index);
    if (JSON.stringify(indices) !== JSON.stringify(expected)) problems.push(`${label}: ${group} chips not each on one page in order`);
    if (new Set(parts.map(({ pageIndex }) => pageIndex)).size !== parts.length) problems.push(`${label}: ${group} twice on a page`);
    if (group !== 'areaIds' && parts.length !== 1) problems.push(`${label}: ${group} split across ${parts.length} pages`);
    for (const { pageIndex, part } of parts) {
      if (part.chips.some((chip) => chip.rect.y < bottomOf(part.name) + UI.gap - 1e-9)) {
        problems.push(`${label}: ${group} chips above its name line on page ${pageIndex + 1}`);
      }
    }
  }
  return [...problems, ...areaSplitProblems(label, layout)];
}

/** Problems with the Area split: a continuation part not first on its page, or a split inside a chip row. */
function areaSplitProblems(label: string, layout: ChestFilterLayout): string[] {
  const parts = partsOf(layout, 'areaIds');
  const contentRight = Math.max(...layout.pages.flatMap((page) => page.parts.flatMap((part) => part.chips.map((chip) => rightOf(chip.rect)))));
  const problems: string[] = [];
  for (let k = 1; k < parts.length; k++) {
    const { pageIndex, part } = parts[k];
    if (layout.pages[pageIndex].parts[0] !== part) problems.push(`${label}: Area name line not at the top of page ${pageIndex + 1}`);
    const before = parts[k - 1].part.chips;
    const last = before[before.length - 1];
    const first = part.chips[0];
    if (rightOf(last.rect) + UI.gap + first.rect.w <= contentRight + 1e-9) {
      problems.push(`${label}: Area split inside a chip row before chip ${first.index}`);
    }
  }
  return problems;
}

describe('filterChipSize', () => {
  it('pads the content 12 px each side and 6 px above and below', () => {
    expect(filterChipSize({ w: 100, h: 40 })).toEqual({ w: 124, h: 52 });
  });

  it('is at least 48 x 48', () => {
    expect(filterChipSize({ w: 10, h: 22.5 })).toEqual({ w: MIN_TARGET_PX, h: MIN_TARGET_PX });
  });

  it('makes an Area chip 64 tall round two 18 px lines', () => {
    expect(filterChipSize({ w: 90, h: 2 * LINE_HEIGHT_EM * 18 }, FILTER_CHIP.areaH).h).toBe(64);
  });

  it('keeps the chip text at the 18 px body size', () => {
    expect(FILTER_CHIP.textPx).toBe(18);
  });
});

describe('chestFilterLayout', () => {
  const canvases = supportedCanvases();

  it('keeps every target inside the panel, at least 48 x 48 and a gap from every other rect on every supported canvas', () => {
    const problems = canvases.flatMap((view) => {
      const layout = chestFilterLayout(view, MEASURE);
      return layout.pages.flatMap((_, pageIndex) => pageProblems(`${view.cssW}x${view.cssH}`, layout, pageIndex));
    });
    expect(problems).toEqual([]);
  });

  it('puts every chip on exactly one page and keeps Type, Found and Rarity whole on theirs on every supported canvas', () => {
    const problems = canvases.flatMap((view) => groupingProblems(`${view.cssW}x${view.cssH}`, chestFilterLayout(view, MEASURE)));
    expect(problems).toEqual([]);
  });

  it('leaves no page empty', () => {
    for (const view of canvases) {
      for (const page of chestFilterLayout(view, MEASURE).pages) expect(page.parts.length).toBeGreaterThan(0);
    }
  });

  it('shows the groups in Type, Found, Rarity, Area order', () => {
    for (const view of canvases) {
      const order = chestFilterLayout(view, MEASURE).pages.flatMap((page) => page.parts.map((part) => part.group));
      expect([...new Set(order)]).toEqual([...FILTER_GROUPS]);
    }
  });

  it('pins the page counts on the two smallest canvases', () => {
    expect(chestFilterLayout({ cssW: 460, cssH: 320 }, MEASURE).pages).toHaveLength(7);
    expect(chestFilterLayout({ cssW: 320, cssH: 440 }, MEASURE).pages).toHaveLength(6);
  });

  it('splits the Area group on the two smallest canvases, and keeps every group on one page on a large one', () => {
    expect(partsOf(chestFilterLayout({ cssW: 460, cssH: 320 }, MEASURE), 'areaIds').length).toBeGreaterThan(1);
    expect(partsOf(chestFilterLayout({ cssW: 320, cssH: 440 }, MEASURE), 'areaIds').length).toBeGreaterThan(1);
    const large = chestFilterLayout({ cssW: 1366, cssH: 932 }, MEASURE);
    expect(large.pages).toHaveLength(1);
    expect(large.paged).toBe(false);
  });

  it('is paged only with more than one page', () => {
    for (const view of canvases) {
      const layout = chestFilterLayout(view, MEASURE);
      expect(layout.paged).toBe(layout.pages.length > 1);
    }
  });

  it('puts Done in the chest Close place and Back and Next in the chest Back and Next places', () => {
    for (const view of canvases) {
      const layout = chestFilterLayout(view, MEASURE);
      const chest = chestLayout(view, CHEST_MEASURE);
      expect(layout.panel).toEqual(chest.panel);
      expect(layout.done).toEqual(chest.close);
      expect(layout.back).toEqual(chest.back);
      expect(layout.next).toEqual(chest.next);
    }
  });

  it('puts the title at the top left of the content column with Show all beside it', () => {
    for (const view of canvases) {
      const layout = chestFilterLayout(view, MEASURE);
      const inner = innerOf(layout.panel);
      expect(layout.title.x).toBe(inner.x);
      expect(Math.min(layout.title.y, layout.showAll.y)).toBeCloseTo(inner.y, 9);
      expect(layout.showAll.x).toBeCloseTo(rightOf(layout.title) + UI.gap, 9);
      expect(layout.showAll.y + layout.showAll.h / 2).toBeCloseTo(layout.title.y + layout.title.h / 2, 9);
      expect(layout.showAll.h).toBe(MIN_TARGET_PX);
    }
  });

  it('flows each group under its name line from the left of the content column', () => {
    const layout = chestFilterLayout({ cssW: 1366, cssH: 932 }, MEASURE);
    const inner = innerOf(layout.panel);
    for (const part of layout.pages[0].parts) {
      expect(part.name.x).toBe(inner.x);
      expect(part.chips[0].rect.x).toBe(inner.x);
      expect(part.chips[0].rect.y).toBeCloseTo(bottomOf(part.name) + UI.gap, 9);
    }
  });

  it('keeps every chip its measured size', () => {
    for (const view of canvases) {
      for (const page of chestFilterLayout(view, MEASURE).pages) {
        for (const chip of page.parts.flatMap((part) => part.chips)) {
          expect({ w: chip.rect.w, h: chip.rect.h }).toEqual(MEASURE.chips[chip.group][chip.index]);
        }
      }
    }
  });
});

describe('filterFocusOrder', () => {
  it('gives the shown page chips in group order, then Show all, Back, Next and Done when paged', () => {
    const layout = chestFilterLayout({ cssW: 460, cssH: 320 }, MEASURE);
    layout.pages.forEach((page, pageIndex) => {
      const chips = page.parts.flatMap((part) => part.chips.map((chip) => ({ kind: 'chip', group: chip.group, index: chip.index })));
      expect(filterFocusOrder(layout, pageIndex)).toEqual([
        ...chips,
        { kind: 'showAll' },
        { kind: 'back' },
        { kind: 'next' },
        { kind: 'done' },
      ]);
    });
  });

  it('leaves out Back and Next on a single page', () => {
    const layout = chestFilterLayout({ cssW: 1366, cssH: 932 }, MEASURE);
    const order = filterFocusOrder(layout, 0);
    const chipCount = FILTER_GROUPS.reduce((sum, group) => sum + MEASURE.chips[group].length, 0);
    expect(order).toHaveLength(chipCount + 2);
    expect(order.slice(-2)).toEqual([{ kind: 'showAll' }, { kind: 'done' }]);
  });

  it('throws on a page that does not exist', () => {
    const layout = chestFilterLayout({ cssW: 460, cssH: 320 }, MEASURE);
    expect(() => filterFocusOrder(layout, layout.pages.length)).toThrow(RangeError);
    expect(() => filterFocusOrder(layout, -1)).toThrow(RangeError);
    expect(() => filterFocusOrder(layout, 0.5)).toThrow(RangeError);
  });
});
