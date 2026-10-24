import { describe, expect, it, vi } from 'vitest';
import { SMALLEST_CANVAS, isSupportedCanvas } from './cardFit';
import { DREAM_COLOURS } from './catalogue';
import * as collectionBook from './collectionBook';
import {
  BOOK_FEATURE,
  COLLECTION_BOOK_TITLE,
  bookFeatureLayout,
  bookFeaturePage,
  bookListing,
  bookPages,
  nextPageIndex,
  previousPageIndex,
  type BookEntry,
  type BookFeatureLayout,
  type BookFeaturePage,
  type BookFeatureMeasure,
} from './collectionBook';
import {
  AXOLOTL_REFUGES_FACT,
  BOY_OR_GIRL_FACT,
  CANAL_CLEAN_UPS_FACT,
  CARP_FACT,
  FACT_CARD_UNFOUND_HINT,
  GARTER_SNAKE_FACT,
  GHOST_NET_FACT,
  HERON_FACT,
  PLASTIC_WORM_FACT,
  PUNTING_POLE_FACT,
  SHRIMP_FACT,
  TADPOLE_FACT,
  TILAPIA_FACT,
  WATER_HYACINTH_FACT,
  type FactCard,
} from './factCards';
import type { ElementType } from './hazards';
import type { HudView, Rect, Size } from './hudLayout';
import { MORPH_UNFOUND_HINT, MORPH_UNFOUND_NAME, REAL_MORPHS, type RealMorphId } from './morphs';
import { CHEST_BUTTON, UI, chestLayout, rowsPerPage, type ChestLayout, type ChestMeasure } from './tankUi';
import { DREAM_COLOUR_LABEL, pageText } from './treasureChest';

/** A synthetic mat pair element type with a fact card, found only in the test area added to AREAS. */
const { TEST_MATS, TEST_MATS_FACT } = vi.hoisted(() => {
  const fact: FactCard = { id: 'test-mats', name: 'Test mats', title: 'Meet the test mats', body: 'Test mats for tests.' };
  const mats: ElementType = {
    id: 'test-mats',
    name: 'Test mats',
    kind: 'cycle',
    period: 8,
    activeFor: 4,
    meetRange: 60,
    fact,
  };
  return { TEST_MATS: mats, TEST_MATS_FACT: fact };
});

vi.mock('./areas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./areas')>();
  const matPair = { x0: 600, x1: 700, rowTop: 100, rowBottom: 300, channelY: 200, openHeight: 60 };
  const layout = {
    ...actual.CANAL_AREA.layout,
    tilapiaRoutes: [],
    elements: [{ id: 'mats-0', type: TEST_MATS, offset: 0, matPair }],
  };
  const elementArea = { ...actual.CANAL_AREA, id: 'test-element-area', number: 99, habitatId: actual.POND_HABITAT.id, layout };
  return { ...actual, AREAS: [...actual.AREAS, elementArea] };
});

const BANNED = ['die', 'dead', 'death', 'killed', 'game over', 'level', 'fish tank'];

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

const CHEST_TITLE_PX = 28;
const HEADING_PX = 18;
const BODY_PX = 18;
/** Treasure Chest entry row text: the name in bold 20 px over the detail line in 18 px. */
const ROW_NAME_PX = 20;
/** Treasure Chest entry row lead (the Dream swatch tile) and the gap to the name. */
const ROW_LEAD_PX = 32;
const ROW_LEAD_GAP = 8;

const MIN_PICTURE_PX = 64;
const TEXT_LINE_H = LINE_HEIGHT_EM * BOOK_FEATURE.textPx;

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

const ALL_MORPHS: readonly RealMorphId[] = REAL_MORPHS.map((morph) => morph.id);

/**
 * Every hazard, predator, element and mobile snack met that has an area fact card: the canal's
 * tilapia, the pond's plastic worm, tadpole and shrimp, Area 3's heron, Area 4's carp, ghost net
 * and punting pole, and Area 5's garter snake and water hyacinth.
 */
const ALL_AREA_MET: readonly string[] = [
  'tilapia',
  'plastic-worm',
  'tadpole',
  'shrimp',
  'heron',
  'carp',
  'ghost-net',
  'punting-pole',
  'garter-snake',
  'water-hyacinth',
];

/** Every fact card found by playing: the area cards, then the two refuge cards. */
const ALL_MET: readonly string[] = [...ALL_AREA_MET, 'axolotl-refuges', 'canal-clean-ups'];

const exportedStrings = Object.entries(collectionBook as Record<string, unknown>).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

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

/** Widest word of `text`, estimated, so a word too long for its wrap width shows as overflow. */
function longestWordW(text: string, px: number, em: number): number {
  return Math.max(...text.split(/\s+/).map((word) => word.length * em * px));
}

/** Estimated size of `text` wrapped at `wrapW`. */
function textSize(text: string, px: number, wrapW: number, em: number): Size {
  const lines = estimateLines(text, px, wrapW, em);
  const w = Math.max(Math.min(wrapW, text.length * em * px), longestWordW(text, px, em));
  return { w, h: lines * LINE_HEIGHT_EM * px };
}

/** Every Collection Book listing, for each found state of every entry. */
function everyListing(): ReturnType<typeof bookListing>[] {
  return [
    bookListing([], []),
    bookListing(ALL_MORPHS, ['tilapia']),
    bookListing(ALL_MORPHS, ALL_MET),
    bookListing(['wild'], []),
  ];
}

/** A featured (morph or fact card) entry as the fit tests measure it. */
interface FeaturedEntry {
  id: string;
  found: boolean;
  name: string;
  text: string;
  hasPicture: boolean;
  hasBadge: boolean;
}

/** Every featured (morph or fact card) entry, found and unfound. */
function featuredEntries(): FeaturedEntry[] {
  const [unfoundMorphs, , unfoundCards] = bookListing([], []);
  const [foundMorphs, , foundCards] = bookListing(ALL_MORPHS, ALL_MET);
  const morphs = [...unfoundMorphs.entries, ...foundMorphs.entries].map((entry) => ({
    id: entry.id,
    found: entry.found,
    name: entry.name,
    text: entry.text,
    hasPicture: true,
    hasBadge: entry.badge !== null,
  }));
  const cards = [...unfoundCards.entries, ...foundCards.entries].map((entry) => ({
    id: entry.id,
    found: entry.found,
    name: entry.name,
    text: entry.text,
    hasPicture: entry.hasPicture,
    hasBadge: false,
  }));
  return [...morphs, ...cards];
}

function featureMeasure(entry: Pick<FeaturedEntry, 'name' | 'text' | 'hasPicture' | 'hasBadge'>): BookFeatureMeasure {
  return {
    hasPicture: entry.hasPicture,
    hasBadge: entry.hasBadge,
    nameAt: (wrapW) => textSize(entry.name, BOOK_FEATURE.namePx, wrapW, BOLD_EM),
    textAt: (wrapW) => textSize(entry.text, BOOK_FEATURE.textPx, wrapW, REGULAR_EM),
    textLineH: TEXT_LINE_H,
  };
}

/** The longest Collection Book heading before issue #121, with 9 fact cards: the heading room the fit tests were measured with. */
const NINE_CARD_HEADING = 'Fact cards: 9 of 9 found';

/** The longest heading any Collection Book listing shows. */
function longestHeading(): string {
  const headings = everyListing().flatMap((sections) => sections.map((section) => section.heading));
  return headings.reduce((longest, heading) => (heading.length > longest.length ? heading : longest));
}

/** The longest page text: every Dream colour on its own page. */
function longestPageText(): string {
  const pageCount = bookPages(bookListing([], []), 1).length;
  return pageText(pageCount, pageCount);
}

/** The longest heading, found once: every chest layout measures it. */
const LONGEST_HEADING = longestHeading();

const BOOK_MEASURE: ChestMeasure = {
  titleAt: (wrapW) => textSize(COLLECTION_BOOK_TITLE, CHEST_TITLE_PX, wrapW, BOLD_EM),
  headingAt: (wrapW) => textSize(LONGEST_HEADING, HEADING_PX, wrapW, BOLD_EM),
  pageText: textSize(longestPageText(), BODY_PX, Infinity, REGULAR_EM),
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

function isInside(rect: Rect, bounds: Rect): boolean {
  return (
    rect.x >= bounds.x - 1e-9 &&
    rect.y >= bounds.y - 1e-9 &&
    rect.x + rect.w <= bounds.x + bounds.w + 1e-9 &&
    rect.y + rect.h <= bounds.y + bounds.h + 1e-9
  );
}

/** Estimated height of a Dream colour row: name over the label, beside or under the 32 px swatch. */
function dreamRowHeight(name: string, label: string, listW: number): number {
  const wrapW = listW - ROW_LEAD_PX - ROW_LEAD_GAP;
  const nameH = estimateLines(name, ROW_NAME_PX, wrapW, BOLD_EM) * LINE_HEIGHT_EM * ROW_NAME_PX;
  const labelH = estimateLines(label, BODY_PX, wrapW, REGULAR_EM) * LINE_HEIGHT_EM * BODY_PX;
  return Math.max(ROW_LEAD_PX, nameH + labelH);
}

/** Problems with one featured layout: not fitting, clipped text, small picture, or rects outside `area`. */
function featureProblems(label: string, area: Rect, layout: BookFeatureLayout, measure: BookFeatureMeasure): string[] {
  const problems: string[] = [];
  if (!layout.fits) problems.push(`${label}: does not fit`);
  const fullLines = Math.round(measure.textAt(layout.textWrapW).h / TEXT_LINE_H);
  if (layout.textLines !== fullLines) problems.push(`${label}: text clipped`);
  if (measure.hasPicture && (layout.picture === null || layout.picture.w < MIN_PICTURE_PX)) {
    problems.push(`${label}: picture under ${MIN_PICTURE_PX}`);
  }
  const rects = [layout.picture, layout.name, layout.badge, layout.text].filter((rect): rect is Rect => rect !== null);
  if (!rects.every((rect) => isInside(rect, area))) problems.push(`${label}: outside the list`);
  return problems;
}

describe('collection book text', () => {
  it('exports every Collection Book string by name', () => {
    expect(exportedStrings.map(([name]) => name).sort()).toEqual(['COLLECTION_BOOK_TITLE']);
    expect(COLLECTION_BOOK_TITLE).toBe('Collection Book');
  });

  it('labels Dream colours with the exact PRD wording and an em dash', () => {
    const [, dreamColours] = bookListing([], []);
    for (const entry of dreamColours.entries) {
      expect(entry.label).toBe('Dream colour — not found in nature');
      expect(entry.label).toContain('—');
    }
  });

  it('keeps every string free of harsh or gamey words', () => {
    const outputs = [...exportedStrings.map(([, text]) => text)];
    for (const sections of everyListing()) {
      for (const section of sections) {
        outputs.push(section.heading);
        for (const entry of section.entries) outputs.push(...Object.values(entry).filter((value) => typeof value === 'string'));
      }
    }
    for (const output of outputs) {
      const lower = output.toLowerCase();
      for (const word of BANNED) expect(lower).not.toContain(word);
    }
  });
});

describe('bookListing', () => {
  it('always lists Morphs, Dream colours, then Fact cards', () => {
    const sections = bookListing([], []);
    expect(sections.map((section) => section.category)).toEqual(['morph', 'dreamColour', 'factCard']);
    expect(sections.map((section) => section.heading)).toEqual([
      'Morphs: 0 of 8 found',
      'Dream colours',
      'Facts: 1 of 13 found',
    ]);
  });

  it('counts found morphs and fact cards in the headings', () => {
    const [morphs, , factCards] = bookListing(['wild', 'melanoid', 'wild'], ['tilapia']);
    expect(morphs.heading).toBe('Morphs: 2 of 8 found');
    expect(factCards.heading).toBe('Facts: 2 of 13 found');
    expect(bookListing([], ALL_AREA_MET)[2].heading).toBe('Facts: 11 of 13 found');
    expect(bookListing([], ['axolotl-refuges'])[2].heading).toBe('Facts: 2 of 13 found');
    expect(bookListing([], ALL_MET)[2].heading).toBe('Facts: 13 of 13 found');
    expect(bookListing(ALL_MORPHS, ['tilapia'])[0].heading).toBe('Morphs: 8 of 8 found');
  });

  it('holds exactly the eight real morphs and no Dream colour id', () => {
    const dreamIds = new Set<string>(DREAM_COLOURS.map((colour) => colour.id));
    for (const [morphs] of everyListing()) {
      expect(morphs.entries.map((entry) => entry.id)).toEqual([
        'leucistic',
        'wild',
        'golden-albino',
        'white-albino',
        'copper',
        'piebald',
        'axanthic',
        'melanoid',
      ]);
      for (const entry of morphs.entries) expect(dreamIds.has(entry.id)).toBe(false);
    }
  });

  it('never shows a Dream colour as a morph', () => {
    const dreamNames = new Set(DREAM_COLOURS.map((colour) => colour.name));
    const [morphs, dreamColours] = bookListing(ALL_MORPHS, ['tilapia']);
    for (const entry of morphs.entries) expect(dreamNames.has(entry.name)).toBe(false);
    const morphIds = new Set<string>(ALL_MORPHS);
    for (const entry of dreamColours.entries) expect(morphIds.has(entry.id)).toBe(false);
  });

  it('shows a found morph with its name, badge and fact', () => {
    const [morphs] = bookListing(ALL_MORPHS, []);
    expect(morphs.entries).toEqual(
      REAL_MORPHS.map((morph) => ({
        id: morph.id,
        found: true,
        name: morph.name,
        badge: morph.badge,
        badgeName: morph.name,
        text: morph.fact,
      })),
    );
  });

  it('gives the eight found morphs eight distinct badges', () => {
    const [morphs] = bookListing(ALL_MORPHS, ['tilapia']);
    const badges = morphs.entries.map((entry) => entry.badge);
    expect(badges).toHaveLength(8);
    expect(badges).not.toContain(null);
    expect(new Set(badges).size).toBe(8);
  });

  it('shows an unfound morph as "???" with the hint and no badge', () => {
    const [morphs] = bookListing([], []);
    for (const entry of morphs.entries) {
      expect(entry).toEqual({ id: entry.id, found: false, name: '???', badge: null, text: MORPH_UNFOUND_HINT });
    }
    expect(MORPH_UNFOUND_NAME).toBe('???');
  });

  it('tells found and unfound apart by name, text and badge, not only colour', () => {
    const [found] = bookListing(ALL_MORPHS, ['tilapia']);
    const [unfound] = bookListing([], []);
    for (const [index, foundEntry] of found.entries.entries()) {
      const unfoundEntry = unfound.entries[index];
      expect(foundEntry.name).not.toBe(unfoundEntry.name);
      expect(foundEntry.text).not.toBe(unfoundEntry.text);
      expect(foundEntry.badge).not.toBeNull();
      expect(unfoundEntry.badge).toBeNull();
    }
    const [, , foundCards] = bookListing([], ['tilapia']);
    const [, , unfoundCards] = bookListing([], []);
    expect(foundCards.entries[0].name).not.toBe(unfoundCards.entries[0].name);
    expect(foundCards.entries[0].text).not.toBe(unfoundCards.entries[0].text);
  });

  it('lists every Dream colour in catalogue order, found or not', () => {
    for (const [, dreamColours] of everyListing()) {
      expect(dreamColours.entries).toEqual(
        DREAM_COLOURS.map((colour) => ({
          id: colour.id,
          name: colour.name,
          patterned: colour.kind !== 'solid',
          label: DREAM_COLOUR_LABEL,
        })),
      );
    }
  });

  it('holds the tilapia card only once the tilapia is met (C14)', () => {
    const [, , met] = bookListing([], ['tilapia']);
    expect(met.entries[0]).toEqual({ id: 'tilapia', found: true, name: 'Tilapia', text: TILAPIA_FACT.body, hasPicture: true });
    const [, , notMet] = bookListing(ALL_MORPHS, []);
    expect(notMet.entries[0]).toEqual({
      id: 'tilapia',
      found: false,
      name: '???',
      text: FACT_CARD_UNFOUND_HINT,
      hasPicture: false,
    });
  });

  it('holds the plastic worm card only once the plastic worm is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[1]).toEqual({
      id: 'plastic-worm',
      found: true,
      name: 'Plastic worm',
      text: PLASTIC_WORM_FACT.body,
      hasPicture: false,
    });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia']);
    expect(notMet.entries[1]).toEqual({
      id: 'plastic-worm',
      found: false,
      name: '???',
      text: 'Explore the lily pad pond to find this card.',
      hasPicture: false,
    });
  });

  it('holds the tadpole card only once the tadpole is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[2]).toEqual({ id: 'tadpole', found: true, name: 'Tadpole', text: TADPOLE_FACT.body, hasPicture: false });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm']);
    expect(notMet.entries[2]).toEqual({
      id: 'tadpole',
      found: false,
      name: '???',
      text: 'Explore the lily pad pond to find this card.',
      hasPicture: false,
    });
  });

  it('holds the shrimp card only once the shrimp is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[3]).toEqual({
      id: 'shrimp',
      found: true,
      name: 'Freshwater shrimp',
      text: SHRIMP_FACT.body,
      hasPicture: false,
    });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm', 'tadpole']);
    expect(notMet.entries[3]).toEqual({
      id: 'shrimp',
      found: false,
      name: '???',
      text: 'Explore the lily pad pond to find this card.',
      hasPicture: false,
    });
  });

  it('holds the heron card only once the heron is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[4]).toEqual({ id: 'heron', found: true, name: 'Heron', text: HERON_FACT.body, hasPicture: false });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm', 'tadpole', 'shrimp']);
    expect(notMet.entries[4]).toEqual({
      id: 'heron',
      found: false,
      name: '???',
      text: 'Explore the lily pad pond to find this card.',
      hasPicture: false,
    });
  });

  it('holds the carp card only once the carp is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[5]).toEqual({ id: 'carp', found: true, name: 'Common carp', text: CARP_FACT.body, hasPicture: false });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm', 'tadpole', 'shrimp', 'heron']);
    expect(notMet.entries[5]).toEqual({
      id: 'carp',
      found: false,
      name: '???',
      text: 'Explore the chinampa gardens to find this card.',
      hasPicture: false,
    });
  });

  it('holds the ghost net card only once the ghost net is met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[6]).toEqual({
      id: 'ghost-net',
      found: true,
      name: 'Ghost net',
      text: GHOST_NET_FACT.body,
      hasPicture: false,
    });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm', 'tadpole', 'shrimp', 'heron', 'carp']);
    expect(notMet.entries[6]).toEqual({
      id: 'ghost-net',
      found: false,
      name: '???',
      text: 'Explore the chinampa gardens to find this card.',
      hasPicture: false,
    });
  });

  it('holds the garter snake and water hyacinth cards only once met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries.slice(8, 10)).toEqual([
      { id: 'garter-snake', found: true, name: 'Garter snake', text: GARTER_SNAKE_FACT.body, hasPicture: false },
      { id: 'water-hyacinth', found: true, name: 'Water hyacinth', text: WATER_HYACINTH_FACT.body, hasPicture: false },
    ]);
    const [, , notMet] = bookListing(ALL_MORPHS, [
      'tilapia',
      'plastic-worm',
      'tadpole',
      'shrimp',
      'heron',
      'carp',
      'ghost-net',
      'punting-pole',
    ]);
    expect(notMet.entries.slice(8, 10)).toEqual([
      { id: 'garter-snake', found: false, name: '???', text: 'Explore the chinampa gardens to find this card.', hasPicture: false },
      { id: 'water-hyacinth', found: false, name: '???', text: 'Explore the chinampa gardens to find this card.', hasPicture: false },
    ]);
  });

  it('holds the punting pole card only once met, never with a picture (C14)', () => {
    const [, , met] = bookListing([], ALL_MET);
    expect(met.entries[7]).toEqual({
      id: 'punting-pole',
      found: true,
      name: 'Punting pole',
      text: PUNTING_POLE_FACT.body,
      hasPicture: false,
    });
    const [, , notMet] = bookListing(ALL_MORPHS, ['tilapia', 'plastic-worm', 'tadpole', 'shrimp', 'heron', 'carp', 'ghost-net']);
    expect(notMet.entries[7]).toEqual({
      id: 'punting-pole',
      found: false,
      name: '???',
      text: 'Explore the chinampa gardens to find this card.',
      hasPicture: false,
    });
  });

  it('hints each unfound area card with the habitat of the first area that has it', () => {
    const [, , factCards] = bookListing([], []);
    const hints = factCards.entries.filter((entry) => !entry.found).map((entry) => [entry.id, entry.text]);
    expect(hints).toEqual([
      ['tilapia', 'Explore the canal to find this card.'],
      ['plastic-worm', 'Explore the lily pad pond to find this card.'],
      ['tadpole', 'Explore the lily pad pond to find this card.'],
      ['shrimp', 'Explore the lily pad pond to find this card.'],
      ['heron', 'Explore the lily pad pond to find this card.'],
      ['carp', 'Explore the chinampa gardens to find this card.'],
      ['ghost-net', 'Explore the chinampa gardens to find this card.'],
      ['punting-pole', 'Explore the chinampa gardens to find this card.'],
      ['garter-snake', 'Explore the chinampa gardens to find this card.'],
      ['water-hyacinth', 'Explore the chinampa gardens to find this card.'],
      ['axolotl-refuges', 'Visit the refuge to find this card.'],
      ['canal-clean-ups', 'Beat an area, then visit the refuge to find this card.'],
    ]);
    expect(FACT_CARD_UNFOUND_HINT).toBe('Explore the canal to find this card.');
  });

  it('holds the refuge cards after the area cards, found once found, with their own hint and never a picture (C14)', () => {
    const [, , found] = bookListing([], ALL_MET);
    expect(found.entries.slice(10, 12)).toEqual([
      { id: 'axolotl-refuges', found: true, name: 'Axolotl refuges', text: AXOLOTL_REFUGES_FACT.body, hasPicture: false },
      { id: 'canal-clean-ups', found: true, name: 'Canal clean-ups', text: CANAL_CLEAN_UPS_FACT.body, hasPicture: false },
    ]);
    const [, , refugeOnly] = bookListing([], ['axolotl-refuges']);
    expect(refugeOnly.entries[10].found).toBe(true);
    expect(refugeOnly.entries[11]).toEqual({
      id: 'canal-clean-ups',
      found: false,
      name: '???',
      text: 'Beat an area, then visit the refuge to find this card.',
      hasPicture: false,
    });
  });

  it('hints an unfound element card with the habitat of the first area whose elements have it', () => {
    const [, , factCards] = bookListing([], [], [TEST_MATS_FACT]);
    expect(factCards.entries[0].text).toBe('Explore the lily pad pond to find this card.');
  });

  it('uses a card\'s own unfound hint before the habitat rule', () => {
    const tilapiaWithHint: FactCard = { ...TILAPIA_FACT, unfoundHint: 'Look under the lily pads.' };
    const [, , factCards] = bookListing([], [], [tilapiaWithHint]);
    expect(factCards.entries[0].text).toBe('Look under the lily pads.');
  });

  it('shows a picture only for the found tilapia card', () => {
    for (const [, , factCards] of everyListing()) {
      const pictured = factCards.entries.filter((entry) => entry.hasPicture).map((entry) => entry.id);
      expect(pictured).toEqual(factCards.entries[0].found ? ['tilapia'] : []);
    }
  });

  it('always holds the boy or girl card last, after every area card, found and with no picture (C14)', () => {
    const boyOrGirl = { id: 'boyOrGirl', found: true, name: 'Boy or girl?', text: BOY_OR_GIRL_FACT.body, hasPicture: false };
    for (const [, , factCards] of everyListing()) {
      expect(factCards.entries.map((entry) => entry.id)).toEqual([
        'tilapia',
        'plastic-worm',
        'tadpole',
        'shrimp',
        'heron',
        'carp',
        'ghost-net',
        'punting-pole',
        'garter-snake',
        'water-hyacinth',
        'axolotl-refuges',
        'canal-clean-ups',
        'boyOrGirl',
      ]);
      expect(factCards.entries[12]).toEqual(boyOrGirl);
    }
  });

  it('lists the given fact cards in order before the boy or girl card, found when met, a picture only with Book art', () => {
    const egret: FactCard = { id: 'egret', name: 'Egret', title: 'Meet the egret', body: 'Egrets wade and hunt.' };
    const [, , factCards] = bookListing([], ['egret', 'tilapia', 'moon'], [egret, TILAPIA_FACT]);
    expect(factCards.entries.map((entry) => entry.id)).toEqual(['egret', 'tilapia', 'boyOrGirl']);
    expect(factCards.entries[0]).toEqual({ id: 'egret', found: true, name: 'Egret', text: egret.body, hasPicture: false });
    expect(factCards.entries[1].hasPicture).toBe(true);
    expect(factCards.heading).toBe('Facts: 3 of 3 found');
    const [, , unmet] = bookListing([], [], [egret, TILAPIA_FACT]);
    expect(unmet.entries[0]).toEqual({ id: 'egret', found: false, name: '???', text: FACT_CARD_UNFOUND_HINT, hasPicture: false });
    expect(unmet.heading).toBe('Facts: 1 of 3 found');
  });
});

describe('bookPages', () => {
  it('gives each morph and fact card its own page and splits Dream colours by rows', () => {
    const sections = bookListing(['wild'], ['tilapia']);
    const pages = bookPages(sections, 5);
    expect(pages.map((page) => [page.section.category, page.entries.length])).toEqual([
      ...REAL_MORPHS.map(() => ['morph', 1]),
      ['dreamColour', 5],
      ['dreamColour', 5],
      ['dreamColour', 5],
      ['dreamColour', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
      ['factCard', 1],
    ]);
    const pageEntries: readonly BookEntry[] = pages.flatMap((page): readonly BookEntry[] => page.entries);
    const sectionEntries: readonly BookEntry[] = sections.flatMap((section): readonly BookEntry[] => section.entries);
    expect(pageEntries).toEqual(sectionEntries);
  });

  it('puts every Dream colour on its own page at one row per page', () => {
    expect(DREAM_COLOURS).toHaveLength(16);
    expect(bookPages(bookListing([], []), 1)).toHaveLength(REAL_MORPHS.length + 16 + 13);
  });

  it('gives an empty section one page', () => {
    const pages = bookPages([{ category: 'factCard', heading: 'Fact cards: 0 of 0 found', entries: [] }], 3);
    expect(pages).toHaveLength(1);
    expect(pages[0].entries).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])('throws for %s rows per page', (rows) => {
    expect(() => bookPages(bookListing([], []), rows)).toThrow(RangeError);
  });
});

describe('page turning', () => {
  it('steps forward and wraps from the last page to the first', () => {
    expect(nextPageIndex(0, 3)).toBe(1);
    expect(nextPageIndex(2, 3)).toBe(0);
  });

  it('steps back and wraps from the first page to the last', () => {
    expect(previousPageIndex(2, 3)).toBe(1);
    expect(previousPageIndex(0, 3)).toBe(2);
  });

  it('stays on a single page and gives -1 with no pages', () => {
    expect(nextPageIndex(0, 1)).toBe(0);
    expect(previousPageIndex(0, 1)).toBe(0);
    expect(nextPageIndex(0, 0)).toBe(-1);
    expect(previousPageIndex(0, 0)).toBe(-1);
  });
});

describe('bookFeatureLayout', () => {
  const morph: BookFeatureMeasure = featureMeasure({
    name: 'Leucistic',
    text: REAL_MORPHS[0].fact,
    hasPicture: true,
    hasBadge: true,
  });

  it('puts a 112 px picture left of the name, badge and text when there is room', () => {
    const area: Rect = { x: 10, y: 20, w: 600, h: 300 };
    const layout = bookFeatureLayout(area, morph);
    expect(layout.fits).toBe(true);
    expect(layout.picture).toEqual({ x: 10, y: 20, w: 112, h: 112 });
    expect(layout.name.x).toBe(10 + 112 + BOOK_FEATURE.pictureGap);
    expect(layout.badge?.x).toBe(layout.name.x + layout.name.w + BOOK_FEATURE.gap);
    expect(layout.badge?.w).toBe(BOOK_FEATURE.badgePx);
    expect(layout.text.x).toBe(layout.name.x);
    expect(layout.text.y).toBe(20 + layout.name.h + BOOK_FEATURE.gap);
    expect([layout.namePx, layout.badgePx, layout.textPx]).toEqual([22, 24, 18]);
  });

  /** A long text: 4000 px of text wrapped into whole lines of the wrap width. */
  const longText: BookFeatureMeasure = {
    hasPicture: true,
    hasBadge: true,
    nameAt: () => ({ w: 100, h: 27.5 }),
    textAt: (wrapW) => ({ w: wrapW, h: Math.ceil(4000 / wrapW) * TEXT_LINE_H }),
    textLineH: TEXT_LINE_H,
  };

  it('moves the text full width below the picture row when the column is too tall', () => {
    const area: Rect = { x: 0, y: 0, w: 400, h: 360 };
    const layout = bookFeatureLayout(area, longText);
    expect(layout.fits).toBe(true);
    expect(layout.picture).toEqual({ x: 0, y: 0, w: 112, h: 112 });
    expect(layout.name.x).toBe(112 + BOOK_FEATURE.pictureGap);
    expect(layout.text).toEqual({ x: 0, y: 112 + BOOK_FEATURE.pictureGap, w: 400, h: 10 * TEXT_LINE_H });
    expect(layout.textLines).toBe(10);
  });

  it('drops to a 64 px picture when 112 does not fit', () => {
    const area: Rect = { x: 0, y: 0, w: 400, h: 320 };
    const layout = bookFeatureLayout(area, longText);
    expect(layout.fits).toBe(true);
    expect(layout.picture?.w).toBe(64);
    expect(layout.text.y).toBe(64 + BOOK_FEATURE.pictureGap);
  });

  it('keeps a 64 px picture beside the text column before moving the text below', () => {
    const area: Rect = { x: 0, y: 0, w: 280, h: 140 };
    const layout = bookFeatureLayout(area, morph);
    expect(layout.fits).toBe(true);
    expect(layout.picture?.w).toBe(64);
    expect(layout.text.x).toBe(64 + BOOK_FEATURE.pictureGap);
  });

  it('places a card with no picture with its name at the top and its text under it', () => {
    const card = featureMeasure({ name: '???', text: FACT_CARD_UNFOUND_HINT, hasPicture: false, hasBadge: false });
    const layout = bookFeatureLayout({ x: 5, y: 5, w: 300, h: 200 }, card);
    expect(layout.fits).toBe(true);
    expect(layout.picture).toBeNull();
    expect(layout.badge).toBeNull();
    expect(layout.name.x).toBe(5);
    expect(layout.text).toEqual({ x: 5, y: 5 + layout.name.h + BOOK_FEATURE.gap, w: 300, h: layout.text.h });
  });

  it('never shrinks the text; with no room it cuts the text to whole lines', () => {
    const area: Rect = { x: 0, y: 0, w: 400, h: 200 };
    const layout = bookFeatureLayout(area, longText);
    expect(layout.fits).toBe(false);
    expect(layout.textPx).toBe(BOOK_FEATURE.textPx);
    expect(layout.picture?.w).toBe(64);
    expect(layout.textLines).toBe(5);
    expect(Number.isInteger(layout.textLines)).toBe(true);
    expect(layout.text.h).toBeCloseTo(layout.textLines * TEXT_LINE_H);
    expect(layout.text.y + layout.text.h).toBeLessThanOrEqual(area.y + area.h + 1e-9);
  });

  it('gives no text lines when there is no room at all', () => {
    const layout = bookFeatureLayout({ x: 0, y: 0, w: 200, h: 40 }, morph);
    expect(layout.fits).toBe(false);
    expect(layout.textLines).toBe(0);
    expect(layout.text.h).toBe(0);
  });
});

/** The featured page of `entry` on `view`, with the real chest layout and the estimated texts. */
function featurePageOf(view: HudView, entry: FeaturedEntry): { chest: ChestLayout; page: BookFeaturePage } {
  const chest = chestLayout(view, BOOK_MEASURE);
  return { chest, page: bookFeaturePage(chest, featureMeasure(entry)) };
}

/** Finds the featured entry with this id and found state. Throws when there is none. */
function featuredEntry(id: string, found: boolean): FeaturedEntry {
  const entry = featuredEntries().find((candidate) => candidate.id === id && candidate.found === found);
  if (entry === undefined) throw new Error(`no featured entry ${id} found=${found}`);
  return entry;
}

describe('bookFeaturePage', () => {
  /** A chest layout with the title above the heading above the list, in easy numbers. */
  const chest: ChestLayout = {
    panel: { x: 0, y: 0, w: 420, h: 300 },
    title: { x: 10, y: 10, w: 150, h: 34 },
    heading: { x: 10, y: 52, w: 140, h: 22 },
    pageText: { x: 10, y: 270, w: 100, h: 20 },
    list: { x: 10, y: 82, w: 300, h: 100 },
    close: { x: 320, y: 10, w: 80, h: 80 },
    back: { x: 320, y: 100, w: 80, h: 80 },
    next: { x: 320, y: 190, w: 80, h: 80 },
  };

  /** A picture-less entry whose text is `lines` whole lines at any width. */
  function cardOfLines(lines: number): BookFeatureMeasure {
    return {
      hasPicture: false,
      hasBadge: false,
      nameAt: () => ({ w: 100, h: 27.5 }),
      textAt: (wrapW) => ({ w: wrapW, h: lines * TEXT_LINE_H }),
      textLineH: TEXT_LINE_H,
    };
  }

  it('keeps the title, the heading and the list when the entry fits the list', () => {
    const page = bookFeaturePage(chest, cardOfLines(2));
    expect(page.showsTitle).toBe(true);
    expect(page.heading).toEqual(chest.heading);
    expect(page.list).toEqual(chest.list);
    expect(page.feature).toEqual(bookFeatureLayout(chest.list, cardOfLines(2)));
    expect(page.feature.fits).toBe(true);
  });

  it('hides the title, lifts the heading to the title top and grows the list upward when the list is too short', () => {
    const lift = chest.heading.y - chest.title.y;
    const measure = cardOfLines(4);
    expect(bookFeatureLayout(chest.list, measure).fits).toBe(false);
    const page = bookFeaturePage(chest, measure);
    expect(page.showsTitle).toBe(false);
    expect(page.heading).toEqual({ x: chest.heading.x, y: chest.title.y, w: chest.heading.w, h: chest.heading.h });
    expect(page.list).toEqual({ x: chest.list.x, y: chest.list.y - lift, w: chest.list.w, h: chest.list.h + lift });
    expect(page.list.y + page.list.h).toBe(chest.list.y + chest.list.h);
    expect(page.feature).toEqual(bookFeatureLayout(page.list, measure));
    expect(page.feature.fits).toBe(true);
    expect(page.feature.text.y).toBeLessThan(chest.list.y + 27.5);
  });

  it('falls back to the clipped layout in the taller list when the entry still does not fit', () => {
    const page = bookFeaturePage(chest, cardOfLines(40));
    expect(page.showsTitle).toBe(false);
    expect(page.feature.fits).toBe(false);
    expect(page.feature.textLines).toBeGreaterThan(0);
    expect(page.feature.textLines).toBeLessThan(40);
    expect(page.feature.text.y + page.feature.text.h).toBeLessThanOrEqual(page.list.y + page.list.h + 1e-9);
  });

  it('does not change the chest layout it is given', () => {
    const before = JSON.parse(JSON.stringify(chest)) as ChestLayout;
    bookFeaturePage(chest, cardOfLines(4));
    expect(chest).toEqual(before);
  });
});

describe('collection book fit', () => {
  it('fits every featured entry with a picture at least 64 wide and no clipping, on every supported canvas', () => {
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const chest = chestLayout(view, BOOK_MEASURE);
      for (const entry of featuredEntries()) {
        const measure = featureMeasure(entry);
        const { list, feature } = bookFeaturePage(chest, measure);
        problems.push(...featureProblems(`${view.cssW}x${view.cssH} ${entry.name}`, list, feature, measure));
      }
    }
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows the title for every featured entry at $cssW x $cssH', (view) => {
    for (const entry of featuredEntries()) {
      expect(featurePageOf(view, entry).page.showsTitle, `${entry.id} found=${entry.found}`).toBe(true);
    }
  });

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'keeps the title for the tilapia, the unfound plastic worm and heron, the carp, the ghost net, the unfound punting pole, and Boy or girl at $cssW x $cssH',
    (view) => {
      const entries = [
        featuredEntry('tilapia', true),
        featuredEntry('tilapia', false),
        featuredEntry('plastic-worm', false),
        featuredEntry('heron', false),
        featuredEntry('carp', true),
        featuredEntry('carp', false),
        featuredEntry('ghost-net', true),
        featuredEntry('ghost-net', false),
        featuredEntry('punting-pole', false),
        featuredEntry('boyOrGirl', true),
      ];
      for (const entry of entries) {
        expect(featurePageOf(view, entry).page.showsTitle, `${entry.id} found=${entry.found}`).toBe(true);
      }
    },
  );

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'keeps the title and the whole text for the refuge cards, found and unfound, at $cssW x $cssH',
    (view) => {
      for (const id of ['axolotl-refuges', 'canal-clean-ups']) {
        for (const found of [true, false]) {
          const entry = featuredEntry(id, found);
          const { page } = featurePageOf(view, entry);
          expect(page.showsTitle, `${id} found=${found}`).toBe(true);
          expect(featureProblems(id, page.list, page.feature, featureMeasure(entry))).toEqual([]);
        }
      }
    },
  );

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'hides the title for the found plastic worm at $cssW x $cssH and keeps its picture-less layout whole',
    (view) => {
      const entry = featuredEntry('plastic-worm', true);
      const { chest, page } = featurePageOf(view, entry);
      expect(page.showsTitle).toBe(false);
      expect(page.heading.y).toBe(chest.title.y);
      expect(page.list.h).toBe(chest.list.h + chest.heading.y - chest.title.y);
      expect(page.feature.fits).toBe(true);
    },
  );

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'hides the title for the found heron at $cssW x $cssH and shows its whole text with no picture',
    (view) => {
      const entry = featuredEntry('heron', true);
      expect(entry.hasPicture).toBe(false);
      const { chest, page } = featurePageOf(view, entry);
      expect(page.showsTitle).toBe(false);
      expect(page.heading.y).toBe(chest.title.y);
      expect(page.list.h).toBe(chest.list.h + chest.heading.y - chest.title.y);
      expect(page.feature.fits).toBe(true);
      expect(page.feature.picture).toBeNull();
      expect(featureProblems('heron', page.list, page.feature, featureMeasure(entry))).toEqual([]);
    },
  );

  it('hides the title only for the found plastic worm, shrimp, heron, punting pole and water hyacinth pages, and only below 520 x 360', () => {
    const hidden = supportedCanvases().flatMap((view) =>
      featuredEntries()
        .filter((entry) => !featurePageOf(view, entry).page.showsTitle)
        .map((entry) => `${view.cssW}x${view.cssH} ${entry.id} found=${entry.found}`),
    );
    expect(hidden).toEqual([
      '320x440 plastic-worm found=true',
      '320x440 shrimp found=true',
      '320x440 heron found=true',
      '320x440 punting-pole found=true',
      '320x440 water-hyacinth found=true',
      '340x440 shrimp found=true',
      '340x440 heron found=true',
      '460x320 plastic-worm found=true',
      '460x320 shrimp found=true',
      '460x320 heron found=true',
      '460x320 punting-pole found=true',
      '460x320 water-hyacinth found=true',
      '460x340 plastic-worm found=true',
      '460x340 shrimp found=true',
      '460x340 heron found=true',
      '460x340 punting-pole found=true',
      '460x340 water-hyacinth found=true',
      '480x320 shrimp found=true',
      '480x320 heron found=true',
      '480x320 water-hyacinth found=true',
      '480x340 shrimp found=true',
      '480x340 heron found=true',
      '480x340 water-hyacinth found=true',
    ]);
  });

  it('gives a 13-card book heading the same room as the 9-card heading on every supported canvas', () => {
    const cards = [
      TILAPIA_FACT,
      PLASTIC_WORM_FACT,
      TADPOLE_FACT,
      SHRIMP_FACT,
      HERON_FACT,
      GHOST_NET_FACT,
      GARTER_SNAKE_FACT,
      WATER_HYACINTH_FACT,
      CARP_FACT,
      PUNTING_POLE_FACT,
      AXOLOTL_REFUGES_FACT,
      CANAL_CLEAN_UPS_FACT,
    ];
    const listings = [bookListing([], [], cards), bookListing(ALL_MORPHS, cards.map((card) => card.id), cards)];
    const headings = listings.flatMap((sections) => sections.map((section) => section.heading));
    expect(headings).toContain('Facts: 13 of 13 found');
    const longest = headings.reduce((widest, heading) => (heading.length > widest.length ? heading : widest));
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const before = chestLayout(view, { ...BOOK_MEASURE, headingAt: (wrapW) => textSize(NINE_CARD_HEADING, HEADING_PX, wrapW, BOLD_EM) });
      const after = chestLayout(view, { ...BOOK_MEASURE, headingAt: (wrapW) => textSize(longest, HEADING_PX, wrapW, BOLD_EM) });
      if (after.heading.h !== before.heading.h || after.list.y !== before.list.y || after.list.h !== before.list.h) {
        problems.push(`${view.cssW}x${view.cssH}: heading ${after.heading.h} over ${before.heading.h}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('puts the heading at the top of the title whenever the title hides', () => {
    for (const view of supportedCanvases()) {
      for (const entry of featuredEntries()) {
        const { chest, page } = featurePageOf(view, entry);
        if (page.showsTitle) continue;
        expect(page.heading, `${view.cssW}x${view.cssH} ${entry.id}`).toEqual({ ...chest.heading, y: chest.title.y });
      }
    }
  });

  it('gives at least one whole Dream colour row per page on every supported canvas', () => {
    const [, dreamColours] = bookListing([], []);
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const { list } = chestLayout(view, BOOK_MEASURE);
      const rowH = Math.max(...dreamColours.entries.map((entry) => dreamRowHeight(entry.name, entry.label, list.w)));
      if (rowH > list.h || rowsPerPage(list.h, rowH, UI.gap) < 1) {
        problems.push(`${view.cssW}x${view.cssH}: row ${rowH} in list ${list.h}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
