import { describe, expect, it } from 'vitest';
import { areaLabel } from './areaText';
import { AREAS, CANAL_AREA, HABITATS, areaFactCards, type AreaData } from './areas';
import { NAME_MAX } from './axolotlNames';
import { ALL_TREASURES, treasureById } from './catalogue';
import {
  CARD,
  cardButtonsStacked,
  cardIconRowWidth,
  cardTextWidth,
  cardTightTextWidth,
  factCardBodyWrapWidths,
  fitCard,
  homeTitleWrapWidth,
  isSupportedCanvas,
  SMALLEST_CANVAS,
  type CardFit,
  type CardSection,
  type TextFit,
} from './cardFit';
import {
  CARP_FACT,
  PUNTING_POLE_FACT,
  REFUGE_FACT_CARDS,
  SHRIMP_FACT,
  TADPOLE_FACT,
  type FactCard,
} from './factCards';
import {
  FIRST_FIND_KINDS,
  FIRST_FIND_TEXT,
  firstFindButtonWidth,
  firstFindButtonsStacked,
  firstFindCardVariants,
  fitFirstFindCard,
  type FirstFindFit,
  type FirstFindKind,
  type FirstFindVariantSize,
} from './firstFind';
import { REAL_MORPHS } from './morphs';
import { KEEP_EXPLORING_LABEL, REFUGE_MILESTONE_TITLE, milestoneBody } from './refuge';
import { REFUGE_PICTURE, fitMilestoneCard, milestoneCardSections, type MilestoneCardSize, type MilestoneFit } from './refugeUi';
import {
  BANKED_TITLE,
  bankedBody,
  bankedBodyShort,
  arrivalText,
  type ArrivalReason,
  type ArrivalStars,
  type WaitingAxolotl,
} from './tripText';
import { NO_STARS } from './stars';
import { starRowSize } from './starsUi';
import {
  START_OVER_TEXT,
  fitStartOverCard,
  startOverBodyVariants,
  startOverButtonWidth,
  startOverButtonsStacked,
  type StartOverCardSize,
  type StartOverCardStep,
  type StartOverFit,
} from './startOver';

/**
 * Text size estimate that errs wide. Measured with Phaser's wrap rule against Segoe UI, Verdana and
 * DejaVu Sans: line height <= 1.21 em, average advance <= 0.51 em regular and <= 0.57 em bold.
 */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

/** Height of one wide button: BUTTON_WIDE.h in src/art/drawUi.ts (logic tests must not import art). */
const BUTTON_H = 64;

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];
const BANKED_TOTALS: readonly number[] = [0, 1, 9, 24, ALL_TREASURES.length];
const ARRIVAL_REASONS: readonly ArrivalReason[] = ['carriedHome', 'wentHome', 'areaBeaten'];

/** Catalogue name of an area's special treasure. Throws when the catalogue has no such treasure. */
function specialName(area: Readonly<AreaData>): string {
  const special = treasureById(area.specialTreasureId);
  if (special === undefined) throw new Error(`no catalogue treasure ${area.specialTreasureId}`);
  return special.name;
}

/**
 * Worst-case stars for the "Area beaten" card of `area`: every star missing gives the longest star
 * lines, with the area's label and its special treasure name from the catalogue. An open rescue
 * gives the longest missed star 3 line.
 */
function worstStars(area: Readonly<AreaData>): ArrivalStars {
  return {
    areaLabel: areaLabel(area.number),
    specialName: specialName(area),
    earned: NO_STARS,
    best: NO_STARS,
    rescueOpen: true,
  };
}

/**
 * Worst-case stars for an "Area beaten" card of `area` with these axolotls: worstStars, except that
 * a rescued axolotl keeps star 3 earned, since a rescue banked this trip always earns star 3 (PRD H6).
 */
function beatenStars(area: Readonly<AreaData>, axolotls: AxolotlCase): ArrivalStars {
  const worst = worstStars(area);
  if (axolotls.rescued.length === 0) return worst;
  return { ...worst, earned: { ...NO_STARS, legsOrRescue: true } };
}

/** Areas an arrival card is checked for: every area for "Area beaten", whose stars name the area; else the canal. */
function arrivalAreas(reason: ArrivalReason): readonly Readonly<AreaData>[] {
  return reason === 'areaBeaten' ? AREAS : [CANAL_AREA];
}

/**
 * Most treasures one tank arrival or banking card can name: a trip finds only its own area's
 * treasures, so one trip brings home at most the largest area catalogue (PRD A12, B9).
 */
const MAX_TRIP_FINDS = Math.max(...AREAS.map((area) => area.layout.treasures.length));

/** Every area's hazard and predator fact card, in area-table order. */
const AREA_FACT_CARDS: readonly Readonly<FactCard>[] = areaFactCards();

const SORTED_NAMES: readonly string[] = ALL_TREASURES.map((treasure) => treasure.name).sort(
  (left, right) => right.length - left.length,
);

const SORTED_AXOLOTL_NAMES: readonly string[] = REAL_MORPHS.map((morph) => morph.displayName).sort(
  (left, right) => right.length - left.length,
);

interface Canvas {
  cssW: number;
  cssH: number;
}

/**
 * Axolotls on a card: rescued ones banked this trip, and waiting ones returned when carried home. A
 * waiting girl reads "her. She's", longer than a boy's "him. He's", so the waiting case uses a girl.
 */
interface AxolotlCase {
  tag: string;
  rescued: readonly string[];
  waiting: readonly WaitingAxolotl[];
}

const NO_AXOLOTLS: AxolotlCase = { tag: '', rescued: [], waiting: [] };

/** A trip has at most one stranded axolotl (PRD C2): it is rescued, waiting, or absent. */
const ARRIVAL_AXOLOTL_CASES: readonly AxolotlCase[] = [
  NO_AXOLOTLS,
  { tag: ' rescued=1', rescued: SORTED_AXOLOTL_NAMES.slice(0, 1), waiting: [] },
  { tag: ' waiting=1', rescued: [], waiting: [{ name: SORTED_AXOLOTL_NAMES[0], sex: 'girl' }] },
];

const BANKING_AXOLOTL_CASES: readonly AxolotlCase[] = [
  NO_AXOLOTLS,
  { tag: ' rescued=1', rescued: SORTED_AXOLOTL_NAMES.slice(0, 1), waiting: [] },
];

/** One card layout input: which card, its canvas, the treasure count and the sections to fit. */
interface Combination {
  label: string;
  canvas: Canvas;
  count: number;
  availH: number;
  sections: CardSection[];
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

/** Wrapped body text as a fitCard text variant at the body size. */
function bodyFit(text: string, wrapW: number): TextFit {
  return { lines: estimateLines(text, CARD.bodyPx, wrapW, REGULAR_EM), lineH: LINE_HEIGHT_EM * CARD.bodyPx };
}

/** Height of a bold title wrapped at `wrapW`. */
function titleHeight(title: string, wrapW: number): number {
  return estimateLines(title, CARD.titlePx, wrapW, BOLD_EM) * LINE_HEIGHT_EM * CARD.titlePx;
}

/** Supported canvases `cssW` wide from the height grid. */
function supportedCanvasesOfWidth(cssW: number): Canvas[] {
  return CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH }));
}

/** Supported canvases from the width and height grid. */
function supportedCanvases(): Canvas[] {
  return CANVAS_WIDTHS.flatMap(supportedCanvasesOfWidth);
}

/**
 * Tank arrival card sections: head, body, icon rows, actions. The "Area beaten" card adds a fixed
 * star row (starRowSize) after the head and names the axolotls and treasures banked this trip, with
 * the stars of `area`.
 */
function arrivalSections(
  reason: ArrivalReason,
  names: readonly string[],
  total: number,
  cssW: number,
  axolotls: AxolotlCase = NO_AXOLOTLS,
  area: Readonly<AreaData> = CANAL_AREA,
): CardSection[] {
  const textW = cardTextWidth(cssW);
  const isBeaten = reason === 'areaBeaten';
  const text = arrivalText({
    reason,
    returnedNames: reason === 'carriedHome' ? names : [],
    bankedThisTripNames: reason === 'wentHome' || isBeaten ? names : [],
    bankedTotal: total,
    rescuedNames: axolotls.rescued,
    waiting: axolotls.waiting,
    stars: isBeaten ? beatenStars(area, axolotls) : undefined,
  });
  const starRow: CardSection[] = isBeaten ? [{ kind: 'fixed', height: starRowSize().h }] : [];
  return [
    { kind: 'fixed', height: Math.max(CARD.headIconPx, titleHeight(text.title, homeTitleWrapWidth(textW))) },
    ...starRow,
    {
      kind: 'body',
      variants: [bodyFit(`${text.body}\n${text.bankedLine}`, textW), bodyFit(`${text.shortBody}\n${text.bankedLine}`, textW)],
    },
    { kind: 'icons', count: names.length, maxW: cardIconRowWidth(cssW) },
    { kind: 'actions', height: BUTTON_H },
  ];
}

/** Banking card sections: title, icon rows, body, actions (stacked on narrow canvases). */
function bankingSections(
  names: readonly string[],
  total: number,
  cssW: number,
  axolotls: AxolotlCase = NO_AXOLOTLS,
): CardSection[] {
  const textW = cardTextWidth(cssW);
  const actionsH = cardButtonsStacked(cssW) ? BUTTON_H + CARD.buttonGap + BUTTON_H : BUTTON_H;
  const full = bankedBody(names, total, axolotls.rescued);
  const short = bankedBodyShort(names.length, total, axolotls.rescued.length);
  return [
    { kind: 'fixed', height: titleHeight(BANKED_TITLE, textW) },
    { kind: 'icons', count: names.length, maxW: cardIconRowWidth(cssW) },
    { kind: 'body', variants: [bodyFit(full, textW), bodyFit(short, textW)] },
    { kind: 'actions', height: actionsH },
  ];
}

/**
 * Fact card sections: bold title (wrapped at the tight width), body (the full body at each of
 * factCardBodyWrapWidths, body width first), one OK button.
 */
function factCardSections(card: Readonly<FactCard>, cssW: number): CardSection[] {
  return [
    { kind: 'fixed', height: titleHeight(card.title, cardTightTextWidth(cssW)) },
    { kind: 'body', variants: factCardBodyWrapWidths(cssW).map((wrapW) => bodyFit(card.body, wrapW)) },
    { kind: 'actions', height: BUTTON_H },
  ];
}

/** Builds one combination for a canvas and card. */
function makeCombination(label: string, canvas: Canvas, count: number, sections: CardSection[]): Combination {
  return { label, canvas, count, availH: canvas.cssH - 2 * CARD.margin, sections };
}

/** Tank arrival card combinations for one reason, area, treasure list and total, with and without axolotls. */
function arrivalAreaCombinations(
  canvas: Canvas,
  reason: ArrivalReason,
  area: Readonly<AreaData>,
  names: readonly string[],
  total: number,
): Combination[] {
  const size = `${canvas.cssW}x${canvas.cssH}`;
  return ARRIVAL_AXOLOTL_CASES.map((axolotls) =>
    makeCombination(
      `arrival ${reason} ${area.id} ${size} n=${names.length} total=${total}${axolotls.tag}`,
      canvas,
      names.length,
      arrivalSections(reason, names, total, canvas.cssW, axolotls, area),
    ),
  );
}

/** Tank arrival card combinations for one treasure list and total, for each reason and its areas. */
function arrivalCombinations(canvas: Canvas, names: readonly string[], total: number): Combination[] {
  return ARRIVAL_REASONS.flatMap((reason) =>
    arrivalAreas(reason).flatMap((area) => arrivalAreaCombinations(canvas, reason, area, names, total)),
  );
}

/** Banking card combinations for one treasure list and total, with and without a rescued axolotl. */
function bankingCombinations(canvas: Canvas, names: readonly string[], total: number): Combination[] {
  const size = `${canvas.cssW}x${canvas.cssH}`;
  return BANKING_AXOLOTL_CASES.map((axolotls) =>
    makeCombination(
      `banking ${size} n=${names.length} total=${total}${axolotls.tag}`,
      canvas,
      names.length,
      bankingSections(names, total, canvas.cssW, axolotls),
    ),
  );
}

/**
 * Every tank arrival card and banking card combination on one canvas, naming 0 to `maxCount` of the
 * longest catalogue names (the whole catalogue by default).
 */
function canvasCombinations(canvas: Canvas, maxCount: number = SORTED_NAMES.length): Combination[] {
  const combinations: Combination[] = [];
  for (let count = 0; count <= maxCount; count++) {
    const names = SORTED_NAMES.slice(0, count);
    for (const total of BANKED_TOTALS) {
      combinations.push(...arrivalCombinations(canvas, names, total));
      if (total < count) continue;
      combinations.push(...bankingCombinations(canvas, names, total));
    }
  }
  return combinations;
}

/** One fact card on one canvas. */
function factCardCombination(card: Readonly<FactCard>, canvas: Canvas): Combination {
  const label = `${card.id} fact ${canvas.cssW}x${canvas.cssH}`;
  return makeCombination(label, canvas, 0, factCardSections(card, canvas.cssW));
}

/** Problems with one fitted combination: clipped, or actions outside [0, availH]. */
function fitProblems(combination: Combination, fit: CardFit): string[] {
  const problems: string[] = [];
  const actions = fit.slots[fit.slots.length - 1];
  if (fit.clipped) problems.push(`${combination.label}: clipped`);
  if (actions.top < 0 || actions.top + actions.height > combination.availH) {
    problems.push(`${combination.label}: actions ${actions.top}+${actions.height} outside ${combination.availH}`);
  }
  return problems;
}

/** Problems when a combination drops to a shorter body or fewer icons. */
function downgradeProblems(combination: Combination, fit: CardFit): string[] {
  const problems: string[] = [];
  if (fit.bodyVariant !== 0) problems.push(`${combination.label}: body variant ${fit.bodyVariant}`);
  if (fit.iconCount !== combination.count) {
    problems.push(`${combination.label}: ${fit.iconCount} of ${combination.count} icons`);
  }
  return problems;
}

const FIT_TIMEOUT_MS = 20000;

describe('estimateLines', () => {
  it('wraps greedily on spaces and keeps over-long words alone', () => {
    expect(estimateLines('', 10, 100, 1)).toBe(1);
    expect(estimateLines('aaaa bbbb', 10, 90, 1)).toBe(1);
    expect(estimateLines('aaaa bbbb', 10, 89, 1)).toBe(2);
    expect(estimateLines('aaaaaaaaaaaa b', 10, 50, 1)).toBe(2);
    expect(estimateLines('a\nb', 10, 100, 1)).toBe(2);
  });
});

describe('card copy fit', () => {
  it('checks the longest axolotl name, Golden albino axolotl, of all the real morphs', () => {
    expect(SORTED_AXOLOTL_NAMES).toHaveLength(REAL_MORPHS.length);
    expect(SORTED_AXOLOTL_NAMES[0]).toBe('Golden albino axolotl');
  });

  it('brings home at most the 20 canal treasures on one trip, of the 111 in the catalogue', () => {
    expect(MAX_TRIP_FINDS).toBe(20);
    expect(SORTED_NAMES).toHaveLength(111);
  });

  it.each(CANVAS_WIDTHS)(
    'fits every wording combination, naming up to the whole catalogue, on every supported canvas %i wide without clipping',
    (cssW) => {
      const combinations = supportedCanvasesOfWidth(cssW).flatMap((canvas) => canvasCombinations(canvas));
      expect(combinations.length).toBeGreaterThan(0);
      const problems = combinations.flatMap((combination) =>
        fitProblems(combination, fitCard(combination.availH, combination.sections)),
      );
      expect(problems).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])(
    'shows the full body and every icon of one trip at $cssW x $cssH',
    (canvas) => {
      const problems = canvasCombinations(canvas, MAX_TRIP_FINDS).flatMap((combination) =>
        downgradeProblems(combination, fitCard(combination.availH, combination.sections)),
      );
      expect(problems).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it('fits the carried-home arrival card with 24 returned treasures at 480x360 (PR #35 r4309314686)', () => {
    const canvas = { cssW: 480, cssH: 360 };
    const names = SORTED_NAMES.slice(0, 24);
    for (const total of BANKED_TOTALS) {
      const combination = makeCombination(
        `arrival carriedHome 480x360 n=24 total=${total}`,
        canvas,
        names.length,
        arrivalSections('carriedHome', names, total, canvas.cssW),
      );
      const fit = fitCard(combination.availH, combination.sections);
      const actions = fit.slots[fit.slots.length - 1];
      expect(fit.clipped).toBe(false);
      expect(actions.top + actions.height).toBeLessThanOrEqual(combination.availH);
    }
  });
});

describe('area fact card copy fit', () => {
  it('checks every area fact card: the tilapia, the carp, the plastic worm, the tadpole, the shrimp, the heron, the ghost net, the punting pole, the garter snake, the water hyacinth, the crayfish, the stalactite, the geyser, the underwater springs and the black bass', () => {
    expect(AREA_FACT_CARDS.map((card) => card.id)).toEqual([
      'tilapia',
      'carp',
      'plastic-worm',
      'tadpole',
      'shrimp',
      'heron',
      'ghost-net',
      'punting-pole',
      'garter-snake',
      'water-hyacinth',
      'crayfish',
      'stalactite-drip',
      'geyser-vent',
      'pulsing-current',
      'black-bass',
    ]);
  });

  it('keeps the plastic worm title one line at 460 wide, which the body width would wrap', () => {
    const card = AREA_FACT_CARDS.find((candidate) => candidate.id === 'plastic-worm');
    if (card === undefined) throw new Error('no plastic worm fact card');
    expect(card.title).toBe('Plastic is not food');
    const cssW = SMALLEST_CANVAS.landscape.cssW;
    expect(estimateLines(card.title, CARD.titlePx, cardTightTextWidth(cssW), BOLD_EM)).toBe(1);
    expect(estimateLines(card.title, CARD.titlePx, cardTextWidth(cssW), BOLD_EM)).toBe(2);
    expect(titleHeight(card.title, cardTightTextWidth(cssW))).toBe(LINE_HEIGHT_EM * CARD.titlePx);
  });

  it('fits every area fact card on every supported canvas without clipping', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      AREA_FACT_CARDS.flatMap((card) => {
        const combination = factCardCombination(card, canvas);
        return fitProblems(combination, fitCard(combination.availH, combination.sections));
      }),
    );
    expect(problems).toEqual([]);
  });

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'shows every area fact card in full at $cssW x $cssH',
    (canvas) => {
      for (const card of AREA_FACT_CARDS) {
        const combination = factCardCombination(card, canvas);
        const fit = fitCard(combination.availH, combination.sections);
        const wrapW = factCardBodyWrapWidths(canvas.cssW)[fit.bodyVariant];
        expect(fit.clipped, card.id).toBe(false);
        expect(fit.bodyLines, card.id).toBe(bodyFit(card.body, wrapW).lines);
      }
    },
  );

  it('wraps every fact card body at the body width, except the shrimp, the heron and the water hyacinth at 320 x 440, which use the tight width', () => {
    const tightBodies = supportedCanvases().flatMap((canvas) =>
      AREA_FACT_CARDS.flatMap((card) => {
        const combination = factCardCombination(card, canvas);
        return fitCard(combination.availH, combination.sections).bodyVariant === 0 ? [] : [combination.label];
      }),
    );
    expect(tightBodies).toEqual(['shrimp fact 320x440', 'heron fact 320x440', 'water-hyacinth fact 320x440']);
  });

  it.each(['heron', 'water-hyacinth'])('fits the %s body at 320 x 440 only at the tight width', (id) => {
    const card = AREA_FACT_CARDS.find((candidate) => candidate.id === id);
    if (card === undefined) throw new Error(`no ${id} fact card`);
    const canvas = SMALLEST_CANVAS.portrait;
    const availH = canvas.cssH - 2 * CARD.margin;
    const [bodyW, tightW] = factCardBodyWrapWidths(canvas.cssW);
    const titleH = titleHeight(card.title, cardTightTextWidth(canvas.cssW));
    const fitAt = (wrapW: number): CardFit =>
      fitCard(availH, [
        { kind: 'fixed', height: titleH },
        { kind: 'body', variants: [bodyFit(card.body, wrapW)] },
        { kind: 'actions', height: BUTTON_H },
      ]);
    expect(fitAt(bodyW).clipped).toBe(true);
    expect(fitAt(tightW).clipped).toBe(false);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows the full body at $cssW x $cssH', (canvas) => {
    for (const card of AREA_FACT_CARDS) {
      const combination = factCardCombination(card, canvas);
      const fit = fitCard(combination.availH, combination.sections);
      expect(fit.clipped, card.id).toBe(false);
      expect(fit.bodyVariant, card.id).toBe(0);
    }
  });
});

describe('refuge fact card copy fit (C14)', () => {
  it('checks both refuge fact cards: the axolotl refuges and the canal clean-ups', () => {
    expect(REFUGE_FACT_CARDS.map((card) => card.id)).toEqual(['axolotl-refuges', 'canal-clean-ups']);
  });

  it('fits both refuge fact cards on every supported canvas without clipping', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      REFUGE_FACT_CARDS.flatMap((card) => {
        const combination = factCardCombination(card, canvas);
        return fitProblems(combination, fitCard(combination.availH, combination.sections));
      }),
    );
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows both refuge fact card bodies in full at the body width at $cssW x $cssH', (canvas) => {
    for (const card of REFUGE_FACT_CARDS) {
      const combination = factCardCombination(card, canvas);
      const fit = fitCard(combination.availH, combination.sections);
      expect(fit.clipped, card.id).toBe(false);
      expect(fit.bodyVariant, card.id).toBe(0);
    }
  });
});

/** The danger pass fact cards (C13): the carp, the punting pole, the tadpole and the shrimp. */
const DANGER_PASS_FACT_CARDS: readonly Readonly<FactCard>[] = [CARP_FACT, PUNTING_POLE_FACT, TADPOLE_FACT, SHRIMP_FACT];

describe('danger pass fact card copy fit (C13)', () => {
  it('checks the carp, the punting pole, the tadpole and the shrimp fact cards', () => {
    expect(DANGER_PASS_FACT_CARDS.map((card) => card.id)).toEqual(['carp', 'punting-pole', 'tadpole', 'shrimp']);
  });

  it('fits every danger pass fact card on every supported canvas without clipping', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      DANGER_PASS_FACT_CARDS.flatMap((card) => {
        const combination = factCardCombination(card, canvas);
        return fitProblems(combination, fitCard(combination.availH, combination.sections));
      }),
    );
    expect(problems).toEqual([]);
  });

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'shows every danger pass fact card in full at $cssW x $cssH',
    (canvas) => {
      for (const card of DANGER_PASS_FACT_CARDS) {
        const combination = factCardCombination(card, canvas);
        const fit = fitCard(combination.availH, combination.sections);
        const wrapW = factCardBodyWrapWidths(canvas.cssW)[fit.bodyVariant];
        expect(fit.clipped, card.id).toBe(false);
        expect(fit.bodyLines, card.id).toBe(bodyFit(card.body, wrapW).lines);
      }
    },
  );

  it('wraps every danger pass fact card body at the body width, except the shrimp at 320 x 440, which uses the tight width', () => {
    const tightBodies = supportedCanvases().flatMap((canvas) =>
      DANGER_PASS_FACT_CARDS.flatMap((card) => {
        const combination = factCardCombination(card, canvas);
        return fitCard(combination.availH, combination.sections).bodyVariant === 0 ? [] : [combination.label];
      }),
    );
    expect(tightBodies).toEqual(['shrimp fact 320x440']);
  });

  it('fits the shrimp body at 320 x 440 only at the tight width', () => {
    const canvas = SMALLEST_CANVAS.portrait;
    const availH = canvas.cssH - 2 * CARD.margin;
    const [bodyW, tightW] = factCardBodyWrapWidths(canvas.cssW);
    const titleH = titleHeight(SHRIMP_FACT.title, cardTightTextWidth(canvas.cssW));
    const fitAt = (wrapW: number): CardFit =>
      fitCard(availH, [
        { kind: 'fixed', height: titleH },
        { kind: 'body', variants: [bodyFit(SHRIMP_FACT.body, wrapW)] },
        { kind: 'actions', height: BUTTON_H },
      ]);
    expect(fitAt(bodyW).clipped).toBe(true);
    expect(fitAt(tightW).clipped).toBe(false);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows every danger pass fact card body in full at the body width at $cssW x $cssH', (canvas) => {
    for (const card of DANGER_PASS_FACT_CARDS) {
      const combination = factCardCombination(card, canvas);
      const fit = fitCard(combination.availH, combination.sections);
      expect(fit.clipped, card.id).toBe(false);
      expect(fit.bodyVariant, card.id).toBe(0);
    }
  });
});

/** The longest axolotl name: NAME_MAX wide letters, as the name tests use. */
const LONGEST_AXOLOTL_NAME = 'W'.repeat(NAME_MAX);

/** The longest habitat name in HABITATS. */
const LONGEST_HABITAT_NAME = [...HABITATS].sort((left, right) => right.name.length - left.name.length)[0].name;

/**
 * A habitat name longer than any in HABITATS; a forward check that a later habitat's name still fits.
 * The planned later habitats (Spring cave, Deep canal) are shorter than Chinampa gardens, so this is a
 * made-up longer name, to keep the check ahead of the longest real name.
 */
const FORWARD_HABITAT_NAME = 'Floating garden canals';

/** Habitat names the milestone card is checked with: the longest today, then the forward check. */
const MILESTONE_HABITAT_NAMES: readonly string[] = [LONGEST_HABITAT_NAME, FORWARD_HABITAT_NAME];

/**
 * Milestone card size on a `cssW` wide canvas for `habitatName`, named for the longest axolotl name:
 * the bold title at the tight width, the body at each of factCardBodyWrapWidths, one Keep exploring
 * button.
 */
function milestoneSize(habitatName: string, cssW: number): MilestoneCardSize {
  const body = milestoneBody(LONGEST_AXOLOTL_NAME, habitatName);
  return {
    titleH: titleHeight(REFUGE_MILESTONE_TITLE, cardTightTextWidth(cssW)),
    bodyVariants: factCardBodyWrapWidths(cssW).map((wrapW) => bodyFit(body, wrapW)),
    actionsH: BUTTON_H,
  };
}

/** The milestone card for `habitatName` fitted on one canvas. */
function fitMilestoneOn(habitatName: string, canvas: Canvas): MilestoneFit {
  return fitMilestoneCard(canvas.cssH - 2 * CARD.margin, milestoneSize(habitatName, canvas.cssW));
}

/** Problems with one fitted milestone card: clipped, body lines dropped, or actions outside availH. */
function milestoneProblems(habitatName: string, canvas: Canvas): string[] {
  const label = `milestone ${habitatName} ${canvas.cssW}x${canvas.cssH}`;
  const { fit } = fitMilestoneOn(habitatName, canvas);
  const variant = milestoneSize(habitatName, canvas.cssW).bodyVariants[fit.bodyVariant];
  const problems = fitProblems(makeCombination(label, canvas, 0, []), fit);
  if (fit.bodyLines !== variant.lines) problems.push(`${label}: ${fit.bodyLines} of ${variant.lines} body lines`);
  return problems;
}

describe('refuge milestone card copy fit (N2)', () => {
  it('checks the longest habitat name, Chinampa gardens, of all the habitats', () => {
    expect(LONGEST_HABITAT_NAME).toBe('Chinampa gardens');
    expect(FORWARD_HABITAT_NAME.length).toBeGreaterThan(LONGEST_HABITAT_NAME.length);
  });

  it('names a Keep exploring button and the refuge picture on the card', () => {
    expect(KEEP_EXPLORING_LABEL).toBe('Keep exploring');
    const sections = milestoneCardSections(1, milestoneSize(LONGEST_HABITAT_NAME, 800));
    expect(sections[1]).toEqual({ kind: 'fixed', height: REFUGE_PICTURE.h });
  });

  it('keeps the title one line at the tight and the body width on every supported canvas', () => {
    const twoLineTitles = supportedCanvases().filter(
      (canvas) =>
        estimateLines(REFUGE_MILESTONE_TITLE, CARD.titlePx, cardTightTextWidth(canvas.cssW), BOLD_EM) !== 1 ||
        estimateLines(REFUGE_MILESTONE_TITLE, CARD.titlePx, cardTextWidth(canvas.cssW), BOLD_EM) !== 1,
    );
    expect(twoLineTitles).toEqual([]);
  });

  it('fits on every supported canvas without clipping or dropping a body line', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      MILESTONE_HABITAT_NAMES.flatMap((habitatName) => milestoneProblems(habitatName, canvas)),
    );
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows the title and the full body at the body width at $cssW x $cssH', (canvas) => {
    for (const habitatName of MILESTONE_HABITAT_NAMES) {
      const { fit, showsTitle } = fitMilestoneOn(habitatName, canvas);
      expect(showsTitle, habitatName).toBe(true);
      expect(fit.bodyVariant, habitatName).toBe(0);
    }
  });
});

/** First-find card wording sizes on a `cssW` wide canvas: a head with the 32 px icon beside the title, and the body. */
function firstFindSizes(kind: FirstFindKind, cssW: number): FirstFindVariantSize[] {
  const textW = cardTextWidth(cssW);
  return firstFindCardVariants(kind).map((variant) => ({
    headH: Math.max(CARD.headIconPx, titleHeight(variant.title, homeTitleWrapWidth(textW))),
    body: bodyFit(variant.body, textW),
  }));
}

/** First-find card actions height: the Paint shell card's two buttons stack when too wide, the others have one. */
function firstFindActionsH(kind: FirstFindKind, cssW: number): number {
  const { primary, secondary } = FIRST_FIND_TEXT[kind];
  if (secondary === undefined) return BUTTON_H;
  const stacked = firstFindButtonsStacked(cssW, firstFindButtonWidth(primary), firstFindButtonWidth(secondary));
  return stacked ? BUTTON_H + CARD.buttonGap + BUTTON_H : BUTTON_H;
}

/** The first-find card for `kind` fitted on one canvas. */
function fitFirstFindOn(kind: FirstFindKind, canvas: Canvas): FirstFindFit {
  const availH = canvas.cssH - 2 * CARD.margin;
  return fitFirstFindCard(availH, firstFindSizes(kind, canvas.cssW), firstFindActionsH(kind, canvas.cssW));
}

/** Problems with one fitted first-find card: clipped, or actions outside availH. */
function firstFindProblems(kind: FirstFindKind, canvas: Canvas): string[] {
  const label = `first find ${kind} ${canvas.cssW}x${canvas.cssH}`;
  const { fit, variant } = fitFirstFindOn(kind, canvas);
  return fitProblems(makeCombination(`${label} variant ${variant}`, canvas, 0, []), fit);
}

describe('first-find card copy fit (C15)', () => {
  it('fits every kind on every supported canvas without clipping', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      FIRST_FIND_KINDS.flatMap((kind) => firstFindProblems(kind, canvas)),
    );
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows the full wording at $cssW x $cssH', (canvas) => {
    for (const kind of FIRST_FIND_KINDS) {
      const { fit, variant } = fitFirstFindOn(kind, canvas);
      expect(fit.clipped, kind).toBe(false);
      expect(variant, kind).toBe(0);
    }
  });

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'fits the Paint shell card at $cssW x $cssH',
    (canvas) => {
      const { fit } = fitFirstFindOn('paintShell', canvas);
      const actions = fit.slots[fit.slots.length - 1];
      expect(fit.clipped).toBe(false);
      expect(actions.top + actions.height).toBeLessThanOrEqual(canvas.cssH - 2 * CARD.margin);
    },
  );
});

describe('area beaten card copy fit (H5, H8)', () => {
  it('names each area special treasure from the catalogue', () => {
    expect(AREAS.map((area) => worstStars(area).specialName)).toEqual([
      'Toy boat',
      'Frog statue',
      'Wooden duck decoy',
      'Scarecrow',
      'Piñata',
      'Fossil ammonite',
      'Ancient clay pot',
      'Little trajinera',
    ]);
  });

  it.each(AREAS.map((area) => [area.id, area] as const))(
    'keeps the %s short body one line at 460x320',
    (_id, area) => {
      const text = arrivalText({
        reason: 'areaBeaten',
        returnedNames: [],
        bankedThisTripNames: SORTED_NAMES,
        bankedTotal: ALL_TREASURES.length,
        stars: worstStars(area),
      });
      expect(text.shortBody.length).toBeLessThanOrEqual(34);
      const textW = cardTextWidth(SMALLEST_CANVAS.landscape.cssW);
      expect(estimateLines(text.shortBody, CARD.bodyPx, textW, REGULAR_EM)).toBe(1);
    },
  );

  it('checks every catalogue treasure name, longest first', () => {
    expect(SORTED_NAMES).toHaveLength(ALL_TREASURES.length);
    expect(SORTED_NAMES[0]).toBe('Tie-dye galaxy Paint shell');
  });

  it('places the star row right after the head', () => {
    const sections = arrivalSections('areaBeaten', SORTED_NAMES.slice(0, 2), 2, 800);
    expect(sections.map((section) => section.kind)).toEqual(['fixed', 'fixed', 'body', 'icons', 'actions']);
    expect(sections[1]).toEqual({ kind: 'fixed', height: starRowSize().h });
  });
});

const START_OVER_STEPS: readonly StartOverCardStep[] = ['ask', 'confirm'];

/** Start over card size on a `cssW` wide canvas: bold title, body variants, keep and go buttons. */
function startOverSize(step: StartOverCardStep, cssW: number): StartOverCardSize {
  const textW = cardTextWidth(cssW);
  const text = START_OVER_TEXT[step];
  const stacked = startOverButtonsStacked(cssW, startOverButtonWidth(text.keep), startOverButtonWidth(text.go));
  return {
    titleH: titleHeight(text.title, textW),
    bodyVariants: startOverBodyVariants(step).map((body) => bodyFit(body, textW)),
    actionsH: stacked ? BUTTON_H + CARD.buttonGap + BUTTON_H : BUTTON_H,
  };
}

/** The Start over card for `step` fitted on one canvas. */
function fitStartOverOn(step: StartOverCardStep, canvas: Canvas): StartOverFit {
  return fitStartOverCard(canvas.cssH - 2 * CARD.margin, startOverSize(step, canvas.cssW));
}

/** Problems with one fitted Start over card: clipped, body lines dropped, or actions outside availH. */
function startOverProblems(step: StartOverCardStep, canvas: Canvas): string[] {
  const label = `start over ${step} ${canvas.cssW}x${canvas.cssH}`;
  const { fit } = fitStartOverOn(step, canvas);
  const variant = startOverSize(step, canvas.cssW).bodyVariants[fit.bodyVariant];
  const problems = fitProblems(makeCombination(label, canvas, 0, []), fit);
  if (fit.bodyLines !== variant.lines) problems.push(`${label}: ${fit.bodyLines} of ${variant.lines} body lines`);
  return problems;
}

describe('start over card copy fit (D7)', () => {
  it('fits both steps on every supported canvas without clipping or dropping a body line', () => {
    const problems = supportedCanvases().flatMap((canvas) =>
      START_OVER_STEPS.flatMap((step) => startOverProblems(step, canvas)),
    );
    expect(problems).toEqual([]);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('shows the title and the full body at $cssW x $cssH', (canvas) => {
    for (const step of START_OVER_STEPS) {
      const { fit, showsTitle } = fitStartOverOn(step, canvas);
      expect(showsTitle, step).toBe(true);
      expect(fit.bodyVariant, step).toBe(0);
    }
  });

  it.each([SMALLEST_CANVAS.landscape, SMALLEST_CANVAS.portrait])(
    'hides the title and shows the short ask wording with the grown-ups note at $cssW x $cssH',
    (canvas) => {
      const { fit, showsTitle } = fitStartOverOn('ask', canvas);
      expect(showsTitle).toBe(false);
      expect(fit.clipped).toBe(false);
      expect(fit.bodyVariant).toBe(1);
      expect(startOverBodyVariants('ask')[fit.bodyVariant]).toContain(START_OVER_TEXT.ask.note);
    },
  );
});
