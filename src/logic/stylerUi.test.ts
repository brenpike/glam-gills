import { describe, expect, it } from 'vitest';
import { LOOK_FIELD_OPTIONS, LOOK_FIELDS } from './axolotlLook';
import { NAME_MAX, SUGGESTED_NAMES, suggestedNamesFor } from './axolotlNames';
import { isSupportedCanvas } from './cardFit';
import { ALL_TREASURES, DREAM_COLOURS, PERK_VALUES, WEARABLE_SLOTS, type Wearable } from './catalogue';
import { MAX_DREAM_OPTIONS } from './dreamPaint';
import type { HudView, Rect, Size } from './hudLayout';
import { REAL_MORPHS } from './morphs';
import { MAX_STEP_OPTIONS, RESTYLE_STEPS, STYLER_STEPS, type StylerStep } from './stylerSteps';
import {
  BACK_LABEL,
  BACK_TO_SLOTS_LABEL,
  CANCEL_LABEL,
  DONE_LABEL,
  MORE_COLOURS_LABEL,
  MORE_NAMES_LABEL,
  MORE_SLOTS_LABEL,
  MORE_WEARABLES_LABEL,
  NEXT_LABEL,
  NONE_LABEL,
  REAL_COLOUR_LABEL,
  SURPRISE_ME_LABEL,
  outfitHelper,
  outfitSlotCaption,
  stepHeading,
  stepHelper,
  stepTabLabel,
  stepTitle,
  surpriseHelper,
  surpriseShown,
  wornOnLabel,
} from './stylerText';
import {
  BACK_BUTTON,
  BACK_TO_SLOTS_BUTTON,
  CANCEL_BUTTON,
  DONE_BUTTON,
  MORE_COLOURS_BUTTON,
  MORE_NAMES_BUTTON,
  MORE_SLOTS_BUTTON,
  MORE_WEARABLES_BUTTON,
  MAX_OUTFIT_CHOICES,
  NAME_BOX,
  NAME_CURSOR,
  NAME_PENCIL_PX,
  NAME_TEXT_PX,
  NAME_TILE,
  NEXT_BUTTON,
  OUTFIT_LABEL_MAX_PX,
  OUTFIT_SLOT_COUNT,
  PICTURE_PX,
  PREVIEW_SCALE,
  SURPRISE_BUTTON,
  TAB_H,
  TAB_TEXT_PX,
  TEXT_GAP,
  nameBoxParts,
  nameCursorShown,
  stylerLayout,
  tabWidth,
  type StylerLayout,
  type StylerMeasure,
  type OutfitView,
  type StylerMode,
  type StylerScreen,
} from './stylerUi';
import { UI } from './tankUi';
import { perkText, slotName } from './treasureChest';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

const MIN_TARGET_PX = 48;
const PRIMARY_H = 64;
const MIN_TEXT_PX = 18;

/** Text sizes the scene measures with, mirrored here: heading, helper, caption and option labels. */
const HEADING_PX = 28;
const HELPER_PX = 18;
const CAPTION_PX = 18;
const OPTION_LABEL_PX = 18;

/** The axolotl texture frame, mirroring AXO_TEX (src/art/drawAxolotl.ts). */
const PREVIEW_FRAME = Object.freeze({ w: 166, h: 142, originX: 102, originY: 79 });

/** The largest size scale, mirroring AXO_SIZE_SCALE.large (src/art/drawAxolotlParts.ts); sizes are 0.72, 0.85 and 1. */
const PREVIEW_LARGEST_SIZE = 1;

/** Every option label the steps show today: every look option and every real morph name. */
const OPTION_LABELS: readonly string[] = [
  ...LOOK_FIELDS.flatMap((field) => LOOK_FIELD_OPTIONS[field].map((option) => option.label)),
  ...REAL_MORPHS.map((morph) => morph.name),
];

/** Every option label the Dream colour step may show, on top of OPTION_LABELS: Real colour and every Dream colour name. */
const DREAM_OPTION_LABELS: readonly string[] = [
  ...OPTION_LABELS,
  REAL_COLOUR_LABEL,
  ...DREAM_COLOURS.map((colour) => colour.name),
];

const SMALLEST: readonly HudView[] = [
  { cssW: 460, cssH: 320 },
  { cssW: 320, cssH: 440 },
];

const MODES: readonly StylerMode[] = ['creator', 'restyle'];

/** Option counts every picture step is laid out for, up to MAX_STEP_OPTIONS. */
const OPTION_COUNTS: readonly number[] = [2, 3, 4, 5, MAX_STEP_OPTIONS];

/** Option counts the Dream colour step is laid out for: Real colour alone up to every Dream colour owned. */
const DREAM_COUNTS: readonly number[] = Array.from({ length: MAX_DREAM_OPTIONS }, (_unused, index) => index + 1);

/** Suggested names fitting a boy or a girl: the most the Name step pages through. */
const NAME_COUNT = Math.max(suggestedNamesFor('boy').length, suggestedNamesFor('girl').length);

/** The every-canvas matrix is heavy; give it room when the whole suite runs in parallel. */
const MATRIX_TIMEOUT_MS = 30_000;

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932];

/** Lines `text` wraps to at `wrapW`, splitting greedily on ' ', every character `em * px` wide. */
function estimateLines(text: string, px: number, wrapW: number): number {
  const charW = BOLD_EM * px;
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

/** Estimated size of `text` wrapped at `wrapW`: its widest line and its lines. */
function textSize(text: string, px: number, wrapW: number): Size {
  const lines = estimateLines(text, px, wrapW);
  const widestWord = Math.max(...text.split(' ').map((word) => word.length)) * BOLD_EM * px;
  const w = lines === 1 ? text.length * BOLD_EM * px : Math.max(widestWord, Math.min(wrapW, text.length * BOLD_EM * px));
  return { w, h: lines * LINE_HEIGHT_EM * px };
}

/** The tallest and widest of `texts` wrapped at `wrapW`. */
function boundsOf(texts: readonly string[], px: number, wrapW: number): Size {
  const sizes = texts.map((text) => textSize(text, px, wrapW));
  return { w: Math.max(...sizes.map((size) => size.w)), h: Math.max(...sizes.map((size) => size.h)) };
}

/** `sizeAt` remembering each wrap width it was asked for. */
function memoByWidth(sizeAt: (wrapW: number) => Size): (wrapW: number) => Size {
  const known = new Map<number, Size>();
  return (wrapW) => {
    const size = known.get(wrapW) ?? sizeAt(wrapW);
    known.set(wrapW, size);
    return size;
  };
}

/** Every catalogue Wearable, every area. */
const WEARABLES: readonly Wearable[] = ALL_TREASURES.filter(
  (treasure): treasure is Wearable => treasure.category === 'wearable',
);

/** Choice counts the Outfit choices view is laid out for: None alone up to every catalogue Wearable of a slot. */
const OUTFIT_CHOICE_COUNTS: readonly number[] = Array.from({ length: MAX_OUTFIT_CHOICES }, (_unused, index) => index + 1);

/** The perk icon and the room after it at the start of a perk line, in CSS px (art guide 8, Wearable display). */
const PERK_ICON_ROOM = 24 + 6;

/** Height of a perk line: the 24 px perk icon or the text, whichever is taller. */
const PERK_ICON_PX = 24;

/** The longest axolotl name a "On <name>" mark may carry: NAME_MAX wide letters. */
const LONGEST_NAME = 'W'.repeat(NAME_MAX);

/** The max mark after a capped perk row: 8 px, then the "max" pill (bold 18 px, padding 6 across). */
const MAX_MARK_W = 8 + 'max'.length * BOLD_EM * 18 + 2 * 6;

/** Room between outfit summary rows: 6 px stacked, 12 px across when flowed (art guide 8). */
const SUMMARY_GAP = Object.freeze({ down: 6, across: 12 });

/** Every perk type's largest worn text, one summary row each, with the max mark: the tallest and widest summary. */
const SUMMARY_TEXTS: readonly string[] = (Object.keys(PERK_VALUES) as (keyof typeof PERK_VALUES)[]).map((type) =>
  perkText({ type, value: Math.max(...Object.values(PERK_VALUES[type])) * 2 }),
);

/** One Outfit choices label block at `wrapW`: the name, the perk line and the "On <name>" mark, stacked. */
function choiceLabelSize(lines: readonly string[], perk: string | null, wrapW: number): Size {
  const sizes = lines.map((line) => textSize(line, OPTION_LABEL_PX, wrapW));
  if (perk !== null) {
    const perkSize = textSize(perk, OPTION_LABEL_PX, wrapW - PERK_ICON_ROOM);
    sizes.push({ w: PERK_ICON_ROOM + perkSize.w, h: Math.max(PERK_ICON_PX, perkSize.h) });
  }
  return { w: Math.max(...sizes.map((size) => size.w)), h: sizes.reduce((sum, size) => sum + size.h, 0) };
}

/** The tallest and widest Outfit choices label block at `wrapW`: None, and every Wearable worn on a longest-named axolotl. */
function choiceLabelBounds(wrapW: number): Size {
  const sizes = [
    choiceLabelSize([NONE_LABEL], null, wrapW),
    ...WEARABLES.map((wearable) => choiceLabelSize([wearable.name, wornOnLabel(LONGEST_NAME)], perkText(wearable.perk), wrapW)),
  ];
  return { w: Math.max(...sizes.map((size) => size.w)), h: Math.max(...sizes.map((size) => size.h)) };
}

/** One outfit summary row at `wrapW`: the perk icon, the text and the max mark. */
function summaryRowSize(text: string, wrapW: number): Size {
  const textPart = textSize(text, OPTION_LABEL_PX, Math.max(1, wrapW - PERK_ICON_ROOM - MAX_MARK_W));
  return { w: PERK_ICON_ROOM + textPart.w + MAX_MARK_W, h: Math.max(PERK_ICON_PX, textPart.h) };
}

/** The outfit summary at `wrapW` with a row for every perk type: stacked, or flowed side by side in whole rows. */
function summarySize(wrapW: number, flowed: boolean): Size {
  const rows = SUMMARY_TEXTS.map((text) => summaryRowSize(text, wrapW));
  if (!flowed) {
    return { w: Math.max(...rows.map((row) => row.w)), h: rows.reduce((sum, row) => sum + row.h, 0) + SUMMARY_GAP.down * (rows.length - 1) };
  }
  const lines: Size[] = [];
  for (const row of rows) {
    const line = lines[lines.length - 1];
    if (line !== undefined && line.w + SUMMARY_GAP.across + row.w <= wrapW) {
      lines[lines.length - 1] = { w: line.w + SUMMARY_GAP.across + row.w, h: Math.max(line.h, row.h) };
    } else {
      lines.push(row);
    }
  }
  return { w: Math.max(...lines.map((line) => line.w)), h: lines.reduce((sum, line) => sum + line.h, 0) + SUMMARY_GAP.down * (lines.length - 1) };
}

/** The longest Outfit slots view caption: every slot empty and every Wearable worn. */
const LONGEST_SLOT_CAPTION = [
  ...WEARABLE_SLOTS.map((slot) => outfitSlotCaption(slot, null)),
  ...WEARABLES.map((wearable) => outfitSlotCaption(wearable.slot, wearable)),
].reduce((longest, caption) => (caption.length > longest.length ? caption : longest), '');

/** The longest word of `texts`, in characters. */
function longestWordOf(texts: readonly string[]): number {
  return Math.max(...texts.flatMap((text) => text.split(' ').map((word) => word.length)));
}

/** The Outfit step measure for `outfitView`, as the scene measures it. */
function outfitMeasureFor(outfitView: OutfitView): StylerMeasure {
  const slotNames = WEARABLE_SLOTS.map(slotName);
  const helpers =
    outfitView === 'slots' ? [outfitHelper(null, 0)] : WEARABLE_SLOTS.flatMap((slot) => [outfitHelper(slot, 0), outfitHelper(slot, 1)]);
  const choiceWords = longestWordOf([NONE_LABEL, ...WEARABLES.map((wearable) => wearable.name), wornOnLabel(LONGEST_NAME)]);
  const perkWord = PERK_ICON_ROOM + longestWordOf(WEARABLES.map((wearable) => perkText(wearable.perk))) * BOLD_EM * OPTION_LABEL_PX;
  return {
    headingAt: (wrapW) => textSize(stepTitle('outfit'), HEADING_PX, wrapW),
    helperAt: (wrapW) => boundsOf(helpers, HELPER_PX, wrapW),
    captionAt: (wrapW) => textSize(LONGEST_SLOT_CAPTION, CAPTION_PX, wrapW),
    optionLabelAt: memoByWidth((wrapW) => (outfitView === 'slots' ? boundsOf(slotNames, OPTION_LABEL_PX, wrapW) : choiceLabelBounds(wrapW))),
    optionLabelMinW:
      outfitView === 'slots'
        ? longestWordOf(slotNames) * BOLD_EM * OPTION_LABEL_PX
        : Math.max(choiceWords * BOLD_EM * OPTION_LABEL_PX, perkWord),
    previewFrame: PREVIEW_FRAME,
    previewLargestSize: PREVIEW_LARGEST_SIZE,
    outfitSummaryAt: summarySize,
  };
}

/** The steps of `mode`: the creator steps, or the restyle steps with Dream colour and Outfit. */
function stepsOf(mode: StylerMode): readonly StylerStep[] {
  return mode === 'restyle' ? RESTYLE_STEPS : STYLER_STEPS;
}

/** The helper line of `step` in `mode` with `ownedDreamCount` Dream colours, without its Surprise me sentence. */
function helperWithoutSurprise(mode: StylerMode, step: StylerStep, ownedDreamCount: number): string {
  const helper = stepHelper(mode, step, ownedDreamCount);
  const sentence = surpriseHelper(mode, step);
  if (sentence === null) return helper;
  if (!helper.endsWith(` ${sentence}`)) throw new Error(`${mode} ${step}: the helper does not end with its Surprise me sentence`);
  return helper.slice(0, helper.length - sentence.length - 1);
}

/**
 * The styler measure for `step` in `mode`, as the scene measures it, with every option label (on Dream
 * colour, the Dream colour labels too) and the taller of its helpers with no and with every Dream colour.
 * `withSurprise` false measures the helpers without their Surprise me sentence.
 */
function measureFor(mode: StylerMode, step: StylerStep, outfitView?: OutfitView, withSurprise = true): StylerMeasure {
  if (step === 'outfit') return outfitMeasureFor(outfitView ?? 'slots');
  const index = STYLER_STEPS.indexOf(step);
  const labels = step === 'dream' ? DREAM_OPTION_LABELS : OPTION_LABELS;
  const helperOf = withSurprise ? stepHelper : helperWithoutSurprise;
  const helpers = [helperOf(mode, step, 0), helperOf(mode, step, DREAM_COLOURS.length)];
  const longestLabel = labels.reduce((longest, label) => (label.length > longest.length ? label : longest), '');
  const longestWord = Math.max(...labels.flatMap((label) => label.split(' ').map((word) => word.length)));
  return {
    headingAt: (wrapW, full) =>
      textSize(full ? stepHeading(index, STYLER_STEPS.length, step) : stepTitle(step), HEADING_PX, wrapW),
    helperAt: (wrapW) => boundsOf(helpers, HELPER_PX, wrapW),
    captionAt: (wrapW) => textSize(longestLabel, CAPTION_PX, wrapW),
    optionLabelAt: memoByWidth((wrapW) => boundsOf(labels, OPTION_LABEL_PX, wrapW)),
    optionLabelMinW: longestWord * BOLD_EM * OPTION_LABEL_PX,
    previewFrame: PREVIEW_FRAME,
    previewLargestSize: PREVIEW_LARGEST_SIZE,
  };
}

/** The Outfit view of `step`: `outfitView` on Outfit (the slots view when not given), else none. */
function outfitViewOf(step: StylerStep, outfitView: OutfitView | undefined): OutfitView | undefined {
  return step === 'outfit' ? (outfitView ?? 'slots') : undefined;
}

/**
 * The screen for `step` with `optionCount` options (on Name, every name that fits; on the Outfit slots
 * view, every slot).
 */
function screenFor(mode: StylerMode, step: StylerStep, optionCount: number, outfitView?: OutfitView): StylerScreen {
  const view = outfitViewOf(step, outfitView);
  if (view !== undefined) {
    return { mode, step, optionCount: view === 'slots' ? OUTFIT_SLOT_COUNT : optionCount, tabPage: null, outfitView: view };
  }
  return { mode, step, optionCount: step === 'name' ? NAME_COUNT : optionCount, tabPage: null };
}

const MEASURES = new Map<string, StylerMeasure>();

/** The measure for `step` in `mode` (and the Outfit view), made once. */
function sharedMeasure(mode: StylerMode, step: StylerStep, outfitView?: OutfitView): StylerMeasure {
  const key = `${mode} ${step} ${outfitViewOf(step, outfitView) ?? ''}`;
  const measure = MEASURES.get(key) ?? measureFor(mode, step, outfitView);
  MEASURES.set(key, measure);
  return measure;
}

const LAYOUTS = new Map<string, StylerLayout>();

/**
 * The layout of `step` with `optionCount` options in `mode` on `view` (on Outfit, in `outfitView`, the
 * slots view when not given), made once and shared by the matrix tests.
 */
function layoutFor(view: HudView, mode: StylerMode, step: StylerStep, optionCount: number, outfitView?: OutfitView): StylerLayout {
  const key = `${view.cssW}x${view.cssH} ${mode} ${step} ${optionCount} ${outfitViewOf(step, outfitView) ?? ''}`;
  const layout =
    LAYOUTS.get(key) ??
    stylerLayout(view, screenFor(mode, step, optionCount, outfitView), sharedMeasure(mode, step, outfitView));
  LAYOUTS.set(key, layout);
  return layout;
}

/** Supported canvases from the width and height grid (art guide 1). */
function supportedCanvases(): HudView[] {
  return CANVAS_WIDTHS.flatMap((cssW) =>
    CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
  );
}

/** One screen case: the step, its option count, and on Outfit its view. */
type ScreenCase = [StylerStep, number, OutfitView?];

/**
 * The screen cases of `step`: every name once on Name, DREAM_COUNTS on Dream colour, the slots view
 * and every choice count of the choices view on Outfit, else OPTION_COUNTS.
 */
function casesOf(step: StylerStep): ScreenCase[] {
  if (step === 'name') return [[step, NAME_COUNT]];
  if (step === 'outfit') {
    return [[step, OUTFIT_SLOT_COUNT, 'slots'], ...OUTFIT_CHOICE_COUNTS.map((count): ScreenCase => [step, count, 'choices'])];
  }
  return (step === 'dream' ? DREAM_COUNTS : OPTION_COUNTS).map((count): ScreenCase => [step, count]);
}

/** Every screen of `mode`'s steps, with each option count of the step (and each Outfit view). */
function screensOf(mode: StylerMode): ScreenCase[] {
  return stepsOf(mode).flatMap(casesOf);
}

/** Larger of the horizontal and vertical clearances between two rects; negative when they overlap. */
function clearance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** True when `rect` lies inside `bounds`. */
function isInside(rect: Rect, bounds: Rect): boolean {
  return (
    rect.x >= bounds.x - 1e-9 &&
    rect.y >= bounds.y - 1e-9 &&
    rect.x + rect.w <= bounds.x + bounds.w + 1e-9 &&
    rect.y + rect.h <= bounds.y + bounds.h + 1e-9
  );
}

/** The view inside the 16 px edge margins. */
function marginBounds(view: HudView): Rect {
  return { x: UI.margin, y: UI.margin, w: view.cssW - 2 * UI.margin, h: view.cssH - 2 * UI.margin };
}

/** The panel less its padding. */
function panelInner(layout: StylerLayout): Rect {
  const { panel } = layout;
  return { x: panel.x + UI.pad, y: panel.y + UI.pad, w: panel.w - 2 * UI.pad, h: panel.h - 2 * UI.pad };
}

/** The primary step buttons shown, by name (with Back to slots on the Outfit choices view). */
function primariesOf(layout: StylerLayout): [string, Rect][] {
  const { back, next, done, surprise, cancel } = layout.nav;
  const named: [string, Rect | null][] = [
    ['back', back],
    ['next', next],
    ['done', done],
    ['surprise', surprise],
    ['cancel', cancel],
    ['backToSlots', layout.outfit?.backToSlots ?? null],
  ];
  return named.filter((entry): entry is [string, Rect] => entry[1] !== null);
}

/** Every touch target of a layout, by name. */
function targetsOf(layout: StylerLayout): [string, Rect][] {
  const targets: [string, Rect][] = [...primariesOf(layout)];
  layout.options.forEach((rect, index) => targets.push([`option ${index}`, rect]));
  if (layout.tabs) {
    layout.tabs.tabs.forEach((tab) => targets.push([`tab ${tab.step}`, tab.rect]));
    if (layout.tabs.prevPage) targets.push(['prevPage', layout.tabs.prevPage]);
    if (layout.tabs.nextPage) targets.push(['nextPage', layout.tabs.nextPage]);
  }
  if (layout.name) {
    targets.push(['nameBox', layout.name.box]);
    layout.name.tiles.forEach((rect, index) => targets.push([`nameTile ${index}`, rect]));
    if (layout.name.moreNames) targets.push(['moreNames', layout.name.moreNames]);
  }
  if (layout.dream?.moreColours) targets.push(['moreColours', layout.dream.moreColours]);
  if (layout.outfit?.more) targets.push(['moreOutfit', layout.outfit.more]);
  return targets;
}

/** Every non-interactive part of a layout, by name: text, dots and the preview. */
function othersOf(layout: StylerLayout): [string, Rect][] {
  const others: [string, Rect][] = layout.heading ? [['heading', layout.heading]] : [];
  if (layout.helper) others.push(['helper', layout.helper]);
  if (layout.caption) others.push(['caption', layout.caption]);
  if (layout.outfit?.summary) others.push(['summary', layout.outfit.summary]);
  if (layout.preview) others.push(['preview', layout.preview.rect]);
  layout.optionLabels.forEach((rect, index) => others.push([`optionLabel ${index}`, rect]));
  layout.dots?.forEach((rect, index) => others.push([`dot ${index}`, rect]));
  return others;
}

/** Every problem with one layout: outside the panel, too close, small targets, no preview before fit step 5, or no heading before fit step 6. */
function layoutProblems(view: HudView, mode: StylerMode, [step, optionCount, outfitView]: ScreenCase): string[] {
  const label = `${mode} ${step}${outfitView ? ` ${outfitView}` : ''} x${optionCount} ${view.cssW}x${view.cssH}`;
  const layout = layoutFor(view, mode, step, optionCount, outfitView);
  const inner = panelInner(layout);
  const targets = targetsOf(layout);
  const parts = [...targets.map(([name, rect]): [string, Rect, boolean] => [name, rect, true]), ...othersOf(layout).map(([name, rect]): [string, Rect, boolean] => [name, rect, false])];
  const problems: string[] = [];
  if (!isInside(layout.panel, marginBounds(view))) problems.push(`${label}: panel outside the margins`);
  for (const [name, rect] of parts) {
    if (!isInside(rect, inner)) problems.push(`${label}: ${name} outside the panel padding`);
  }
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const least = parts[i][2] && parts[j][2] ? UI.gap : TEXT_GAP;
      if (clearance(parts[i][1], parts[j][1]) < least - 1e-9) {
        problems.push(`${label}: ${parts[i][0]} and ${parts[j][0]} closer than ${least}`);
      }
    }
  }
  for (const [name, rect] of targets) {
    if (rect.w < MIN_TARGET_PX - 1e-9 || rect.h < MIN_TARGET_PX - 1e-9) problems.push(`${label}: ${name} under ${MIN_TARGET_PX} px`);
  }
  for (const [name, rect] of primariesOf(layout)) {
    if (rect.h < PRIMARY_H) problems.push(`${label}: ${name} under ${PRIMARY_H} px tall`);
  }
  for (const rect of layout.options) {
    if (rect.w !== rect.h) problems.push(`${label}: a picture button is not square`);
  }
  if (layout.preview === null && layout.fitStep < 5) problems.push(`${label}: no preview before fit step 5`);
  if (layout.heading === null && layout.fitStep < 6) problems.push(`${label}: no heading before fit step 6`);
  const shownCount = step === 'dream' ? layout.dream?.perPage : step === 'outfit' ? layout.outfit?.perPage : optionCount;
  if (step !== 'name' && layout.options.length !== shownCount) problems.push(`${label}: ${layout.options.length} options`);
  return problems;
}

/** True when `screenCase` is the Outfit choices view, which its own tests check (see the Outfit step tests). */
function isOutfitChoicesCase([step, , outfitView]: ScreenCase): boolean {
  return step === 'outfit' && outfitView === 'choices';
}

/** Problems with every screen of every step in both modes on `views`, except the Outfit choices view. */
function problemsOn(views: readonly HudView[]): string[] {
  return views.flatMap((view) =>
    MODES.flatMap((mode) =>
      screensOf(mode)
        .filter((screenCase) => !isOutfitChoicesCase(screenCase))
        .flatMap((screenCase) => layoutProblems(view, mode, screenCase)),
    ),
  );
}

/** Problems with the Outfit choices view, with each choice count, on `views`. */
function choicesProblemsOn(views: readonly HudView[]): string[] {
  return views.flatMap((view) =>
    OUTFIT_CHOICE_COUNTS.flatMap((count) => layoutProblems(view, 'restyle', ['outfit', count, 'choices'])),
  );
}

describe('styler sizes', () => {
  it('keeps every text size at 18 px or more', () => {
    for (const px of [HEADING_PX, HELPER_PX, CAPTION_PX, OPTION_LABEL_PX, TAB_TEXT_PX, NAME_TEXT_PX]) {
      expect(px).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    }
  });

  it('sizes the primary buttons to their labels, at least 48 wide and 64 tall', () => {
    const buttons: [string, Size][] = [
      [BACK_LABEL, BACK_BUTTON],
      [NEXT_LABEL, NEXT_BUTTON],
      [DONE_LABEL, DONE_BUTTON],
      [SURPRISE_ME_LABEL, SURPRISE_BUTTON],
      [CANCEL_LABEL, CANCEL_BUTTON],
    ];
    for (const [text, size] of buttons) {
      expect(size.h).toBeGreaterThanOrEqual(PRIMARY_H);
      expect(size.w).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(size.w).toBeGreaterThanOrEqual(text.length * BOLD_EM * 22);
      expect(size.w).toBeLessThan(200);
    }
  });

  it('fits a 12-character name in the name box and every suggested name in a name tile at 20 px', () => {
    expect(NAME_MAX).toBe(12);
    expect(NAME_BOX.w).toBeGreaterThanOrEqual(NAME_MAX * BOLD_EM * NAME_TEXT_PX);
    for (const name of SUGGESTED_NAMES) expect(NAME_TILE.w).toBeGreaterThanOrEqual(name.length * BOLD_EM * NAME_TEXT_PX);
    expect(MORE_NAMES_BUTTON.w).toBeGreaterThanOrEqual(MORE_NAMES_LABEL.length * BOLD_EM * NAME_TEXT_PX);
    for (const size of [NAME_BOX, NAME_TILE, MORE_NAMES_BUTTON]) expect(size.h).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it('sizes More slots, More wearables and Back to slots to their labels (art guide 8)', () => {
    expect(MORE_SLOTS_BUTTON).toEqual({ w: 132, h: MIN_TARGET_PX });
    expect(MORE_WEARABLES_BUTTON).toEqual({ w: 180, h: MIN_TARGET_PX });
    expect(BACK_TO_SLOTS_BUTTON).toEqual({ w: 184, h: PRIMARY_H });
    expect(MORE_SLOTS_BUTTON.w).toBeGreaterThanOrEqual(MORE_SLOTS_LABEL.length * BOLD_EM * NAME_TEXT_PX);
    expect(MORE_WEARABLES_BUTTON.w).toBeGreaterThanOrEqual(MORE_WEARABLES_LABEL.length * BOLD_EM * NAME_TEXT_PX);
    expect(BACK_TO_SLOTS_BUTTON.w).toBeGreaterThanOrEqual(BACK_TO_SLOTS_LABEL.length * BOLD_EM * 22);
  });

  it('fits the More colours label in its button at 20 px, 48 px tall or more', () => {
    expect(MORE_COLOURS_BUTTON.w).toBeGreaterThanOrEqual(MORE_COLOURS_LABEL.length * BOLD_EM * NAME_TEXT_PX);
    expect(MORE_COLOURS_BUTTON.w).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(MORE_COLOURS_BUTTON.h).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it('widens the name box to hold the pencil icon beside a 12-character name', () => {
    expect(NAME_PENCIL_PX).toBe(20);
    expect(NAME_BOX).toEqual({ w: 192, h: MIN_TARGET_PX });
    expect(NAME_BOX.w).toBeGreaterThanOrEqual(NAME_MAX * BOLD_EM * NAME_TEXT_PX + 2 * UI.pad + NAME_PENCIL_PX + TEXT_GAP);
  });

  it('fits each tab label in its tab, 48 px tall or more', () => {
    expect(TAB_H).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    for (const step of RESTYLE_STEPS) {
      expect(tabWidth(step)).toBeGreaterThanOrEqual(stepTabLabel(step).length * BOLD_EM * TAB_TEXT_PX);
      expect(tabWidth(step)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
  });

  it('starts picture buttons at the 48 px least target and shrinks the preview to 0.6', () => {
    expect(PICTURE_PX.min).toBe(MIN_TARGET_PX);
    expect(PREVIEW_SCALE.shrunk / PREVIEW_SCALE.full).toBeCloseTo(0.6);
  });
});

describe('stylerLayout', () => {
  it.each(SMALLEST)('fits every step with 2, 3, 4, 5 and 8 options, Dream colour with 1 to 21 and the Name step in both modes on %j', (view) => {
    expect(problemsOn([view])).toEqual([]);
  });

  it('fits every step in both modes on every supported canvas', () => {
    expect(problemsOn(supportedCanvases())).toEqual([]);
  }, MATRIX_TIMEOUT_MS);

  it('shows everything with room to spare', () => {
    for (const mode of MODES) {
      for (const [step, count, outfitView] of screensOf(mode)) {
        const layout = layoutFor({ cssW: 1280, cssH: 800 }, mode, step, count, outfitView);
        expect(layout.fitStep).toBe(0);
        expect(layout.helper).not.toBeNull();
        expect(layout.preview?.scale).toBe(PREVIEW_SCALE.full);
        expect(layout.labelsShown).toBe(step !== 'name');
      }
    }
  });

  it('takes the fit steps in the PRD F1 order', () => {
    for (const view of [...SMALLEST, ...supportedCanvases()]) {
      for (const mode of MODES) {
        for (const [step, count, outfitView] of screensOf(mode)) {
          const layout = layoutFor(view, mode, step, count, outfitView);
          const { fitStep } = layout;
          const labelsHide = step !== 'name' && step !== 'dream' && step !== 'outfit';
          const slotCaption = outfitView === 'slots' && fitStep === 0 && layout.outfit?.summary === null;
          expect(layout.helper !== null).toBe(fitStep < 1);
          if (labelsHide) expect(layout.labelsShown).toBe(fitStep < 2);
          if (!slotCaption) expect(layout.caption !== null).toBe(labelsHide && fitStep >= 2);
          if (fitStep < 5) expect(layout.preview?.scale).toBe(fitStep >= 3 ? PREVIEW_SCALE.shrunk : PREVIEW_SCALE.full);
          expect(layout.headingFull).toBe(mode === 'creator' && fitStep < 4);
          expect(layout.heading === null).toBe(fitStep >= 6);
        }
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('hides the heading at fit step 6 in restyle only, and never in the creator', () => {
    const views = [...SMALLEST, ...supportedCanvases()];
    let restyleHides = 0;
    for (const view of views) {
      for (const [step, count] of screensOf('creator')) {
        const creator = layoutFor(view, 'creator', step, count);
        expect(creator.fitStep).toBeLessThanOrEqual(5);
        expect(creator.heading).not.toBeNull();
      }
      for (const [step, count, outfitView] of screensOf('restyle')) {
        const restyle = layoutFor(view, 'restyle', step, count, outfitView);
        expect(restyle.fitStep).toBeLessThanOrEqual(6);
        expect(restyle.heading === null).toBe(restyle.fitStep === 6);
        if (restyle.fitStep === 6) {
          restyleHides += 1;
          // The Outfit choices view may hide the tab row to fit; Back to slots then shows where the player is.
          if (restyle.tabs === null) expect(restyle.outfit?.backToSlots).not.toBeNull();
          else expect(restyle.tabs.tabs.map((tab) => tab.step)).toContain(step);
        }
      }
    }
    expect(restyleHides).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('keeps the heading at its measured size', () => {
    const view = { cssW: 460, cssH: 320 };
    for (const mode of MODES) {
      for (const step of stepsOf(mode)) {
        const layout = layoutFor(view, mode, step, MAX_STEP_OPTIONS);
        if (layout.heading === null) continue;
        const measured = measureFor(mode, step).headingAt(panelInner(layout).w, layout.headingFull);
        expect({ w: layout.heading.w, h: layout.heading.h }).toEqual(measured);
      }
    }
  });

  it('sizes the preview box to hold a Large axolotl at the preview scale, anchored at the frame origin', () => {
    for (const view of [{ cssW: 1280, cssH: 800 }, { cssW: 844, cssH: 390 }, ...SMALLEST]) {
      for (const mode of MODES) {
        const preview = layoutFor(view, mode, 'eyes', 3).preview;
        if (preview === null) continue;
        const unit = PREVIEW_LARGEST_SIZE * preview.scale;
        expect(preview.rect.w).toBeCloseTo(PREVIEW_FRAME.w * unit);
        expect(preview.rect.h).toBeCloseTo(PREVIEW_FRAME.h * unit);
        expect(preview.anchor.x).toBeCloseTo(preview.rect.x + PREVIEW_FRAME.originX * unit);
        expect(preview.anchor.y).toBeCloseTo(preview.rect.y + PREVIEW_FRAME.originY * unit);
      }
    }
  });

  it('gives the creator progress dots and Back from step 2, Next before the last step and Done on it', () => {
    const view = { cssW: 844, cssH: 390 };
    const first = layoutFor(view, 'creator', 'colour', 4);
    expect(first.dots).toHaveLength(STYLER_STEPS.length);
    expect(first.tabs).toBeNull();
    expect(first.nav.back).toBeNull();
    expect(first.nav.next).not.toBeNull();
    expect(first.nav.done).toBeNull();
    expect(first.nav.cancel).toBeNull();
    const middle = layoutFor(view, 'creator', 'eyes', 5);
    expect(middle.nav.back).not.toBeNull();
    expect(middle.nav.surprise).toEqual(first.nav.surprise);
    expect(middle.nav.next).toEqual(first.nav.next);
    const last = layoutFor(view, 'creator', 'name', NAME_COUNT);
    expect(last.nav.next).toBeNull();
    expect(last.nav.done).not.toBeNull();
  });

  it('gives restyle a tab row, Done, Surprise me and Cancel, and no dots, Back or Next', () => {
    for (const view of [{ cssW: 844, cssH: 390 }, ...SMALLEST]) {
      const layout = layoutFor(view, 'restyle', 'eyes', 5);
      expect(layout.dots).toBeNull();
      expect(layout.tabs).not.toBeNull();
      expect(layout.nav.back).toBeNull();
      expect(layout.nav.next).toBeNull();
      expect(layout.nav.done).not.toBeNull();
      expect(layout.nav.cancel).not.toBeNull();
    }
  });

  it('pages the tabs with 48 px page buttons when they do not all fit, and shows the current step', () => {
    for (const view of supportedCanvases()) {
      for (const step of RESTYLE_STEPS) {
        const tabs = layoutFor(view, 'restyle', step, 3).tabs;
        if (tabs === null) throw new Error('restyle has tabs');
        expect(tabs.pages.flat()).toEqual(RESTYLE_STEPS);
        expect(tabs.tabs.map((tab) => tab.step)).toEqual(tabs.pages[tabs.page]);
        expect(tabs.tabs.map((tab) => tab.step)).toContain(step);
        expect(tabs.prevPage === null).toBe(tabs.pages.length === 1);
        expect(tabs.nextPage === null).toBe(tabs.pages.length === 1);
      }
    }
  });

  it('shows the asked tab page, wrapping at both ends', () => {
    const view = { cssW: 460, cssH: 320 };
    const at = (tabPage: number): StylerLayout =>
      stylerLayout(view, { mode: 'restyle', step: 'eyes', optionCount: 5, tabPage }, measureFor('restyle', 'eyes'));
    const pageCount = at(0).tabs?.pages.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
    expect(at(pageCount).tabs?.page).toBe(0);
    expect(at(-1).tabs?.page).toBe(pageCount - 1);
  });

  it('pages suggested names with no name cut, and shows More names only when they do not all fit', () => {
    for (const view of [...SMALLEST, ...supportedCanvases()]) {
      for (const mode of MODES) {
        const name = layoutFor(view, mode, 'name', NAME_COUNT).name;
        if (name === null) throw new Error('the Name step has name controls');
        expect(name.namesPerPage).toBeGreaterThanOrEqual(1);
        expect(name.namesPerPage).toBeLessThanOrEqual(MAX_STEP_OPTIONS);
        expect(name.tiles).toHaveLength(name.namesPerPage);
        expect(name.moreNames !== null).toBe(NAME_COUNT > name.namesPerPage);
        for (const tile of name.tiles) expect(tile).toMatchObject(NAME_TILE);
        expect(name.box).toMatchObject(NAME_BOX);
      }
    }
    const few = stylerLayout(
      { cssW: 1280, cssH: 800 },
      { mode: 'creator', step: 'name', optionCount: 3, tabPage: null },
      measureFor('creator', 'name'),
    );
    expect(few.name?.moreNames).toBeNull();
    expect(few.name?.namesPerPage).toBe(3);
  });

  it('keeps the creator step buttons in the same place on every step of a canvas', () => {
    for (const view of [...SMALLEST, { cssW: 844, cssH: 390 }]) {
      const places = STYLER_STEPS.map((step) => layoutFor(view, 'creator', step, MAX_STEP_OPTIONS).nav.surprise);
      for (const place of places) expect(place).toEqual(places[0]);
    }
  });

  it('rejects an option count outside 1 to 8, and a tab page that is not a whole number', () => {
    const view = { cssW: 844, cssH: 390 };
    const measure = measureFor('creator', 'eyes');
    expect(() => stylerLayout(view, { mode: 'creator', step: 'eyes', optionCount: 0, tabPage: null }, measure)).toThrow(RangeError);
    expect(() => stylerLayout(view, { mode: 'creator', step: 'eyes', optionCount: 9, tabPage: null }, measure)).toThrow(RangeError);
    expect(() => stylerLayout(view, { mode: 'restyle', step: 'eyes', optionCount: 9, tabPage: null }, measure)).toThrow(RangeError);
    expect(() => stylerLayout(view, { mode: 'restyle', step: 'eyes', optionCount: 3, tabPage: 0.5 }, measure)).toThrow(RangeError);
  });

  it('rejects a Dream colour option count outside 1 to 21, and the Dream colour step in the creator', () => {
    const view = { cssW: 844, cssH: 390 };
    const measure = measureFor('restyle', 'dream');
    const at = (mode: StylerMode, optionCount: number): StylerLayout =>
      stylerLayout(view, { mode, step: 'dream', optionCount, tabPage: null }, measure);
    expect(MAX_DREAM_OPTIONS).toBe(21);
    expect(() => at('restyle', 0)).toThrow(RangeError);
    expect(() => at('restyle', MAX_DREAM_OPTIONS + 1)).toThrow(RangeError);
    expect(() => at('restyle', 2.5)).toThrow(RangeError);
    expect(() => at('creator', 3)).toThrow(RangeError);
    expect(at('restyle', 1).dream?.perPage).toBe(1);
    expect(at('restyle', MAX_DREAM_OPTIONS).dream).not.toBeNull();
  });
});

describe('stylerLayout Dream colour step', () => {
  /** The canvases the Dream colour matrix runs on: the smallest, then every supported canvas. */
  const DREAM_VIEWS: readonly HudView[] = [...SMALLEST, ...supportedCanvases()];

  /** The Dream colour layout with `count` options on `view`. */
  function dreamOn(view: HudView, count: number): StylerLayout {
    return layoutFor(view, 'restyle', 'dream', count);
  }

  /** Options per page on `view` with `count` options. */
  function perPageOn(view: HudView, count: number): number {
    const dream = dreamOn(view, count).dream;
    if (dream === null) throw new Error('the Dream colour step has dream controls');
    return dream.perPage;
  }

  it('fits 1 to 18 options with labels always shown and no caption on every supported canvas', () => {
    expect(problemsOn(DREAM_VIEWS).filter((problem) => problem.includes(' dream '))).toEqual([]);
    for (const view of DREAM_VIEWS) {
      for (const count of DREAM_COUNTS) {
        const layout = dreamOn(view, count);
        expect(layout.labelsShown).toBe(true);
        expect(layout.optionLabels).toHaveLength(layout.options.length);
        expect(layout.caption).toBeNull();
        expect(layout.name).toBeNull();
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('shows at most 8 options per page, with More colours exactly when they do not all show', () => {
    for (const view of DREAM_VIEWS) {
      for (const count of DREAM_COUNTS) {
        const dream = dreamOn(view, count).dream;
        if (dream === null) throw new Error('the Dream colour step has dream controls');
        expect(dream.perPage).toBeGreaterThanOrEqual(1);
        expect(dream.perPage).toBeLessThanOrEqual(Math.min(MAX_STEP_OPTIONS, count));
        expect(dreamOn(view, count).options).toHaveLength(dream.perPage);
        expect(dream.moreColours !== null).toBe(count > dream.perPage);
        if (dream.moreColours !== null) {
          expect(dream.moreColours).toMatchObject(MORE_COLOURS_BUTTON);
          expect(dream.moreColours.h).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        }
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('keeps More colours 12 px from every other target and under the options', () => {
    for (const view of DREAM_VIEWS) {
      for (const count of DREAM_COUNTS) {
        const layout = dreamOn(view, count);
        const more = layout.dream?.moreColours;
        if (!more) continue;
        for (const [name, rect] of targetsOf(layout)) {
          if (name === 'moreColours') continue;
          expect(clearance(more, rect)).toBeGreaterThanOrEqual(UI.gap - 1e-9);
        }
        for (const option of layout.options) expect(more.y).toBeGreaterThan(option.y + option.h);
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('shows fewer options per page only when no fit level or frame fits more', () => {
    for (const view of DREAM_VIEWS) {
      const mostPerPage = perPageOn(view, MAX_DREAM_OPTIONS);
      for (const count of DREAM_COUNTS) {
        const perPage = perPageOn(view, count);
        const allShown = Math.min(MAX_STEP_OPTIONS, count);
        if (count > MAX_STEP_OPTIONS) expect(perPage).toBe(mostPerPage);
        else expect([allShown, mostPerPage]).toContain(perPage);
        if (perPage < allShown) expect(perPage).toBe(mostPerPage);
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('pages every Dream colour as 11 pages of 2 on the smallest canvases', () => {
    for (const view of SMALLEST) {
      expect(perPageOn(view, MAX_DREAM_OPTIONS), JSON.stringify(view)).toBe(2);
      expect(Math.ceil(MAX_DREAM_OPTIONS / perPageOn(view, MAX_DREAM_OPTIONS)), JSON.stringify(view)).toBe(11);
    }
  });

  it('shows 8 options and More colours with everything shown on a large canvas', () => {
    const layout = dreamOn({ cssW: 1280, cssH: 800 }, MAX_DREAM_OPTIONS);
    expect(layout.fitStep).toBe(0);
    expect(layout.dream?.perPage).toBe(MAX_STEP_OPTIONS);
    expect(layout.dream?.moreColours).not.toBeNull();
    const few = dreamOn({ cssW: 1280, cssH: 800 }, 3);
    expect(few.dream).toEqual({ perPage: 3, moreColours: null });
  });

  it('leaves dream null on every other step', () => {
    for (const mode of MODES) {
      for (const [step, count, outfitView] of screensOf(mode)) {
        if (step !== 'dream') expect(layoutFor({ cssW: 844, cssH: 390 }, mode, step, count, outfitView).dream).toBeNull();
      }
    }
  });
});

describe('stylerLayout Outfit step', () => {
  /** The canvases the Outfit matrix runs on: the smallest, then every supported canvas. */
  const OUTFIT_VIEWS: readonly HudView[] = [...SMALLEST, ...supportedCanvases()];

  /** The Outfit slots view on `view`. */
  function slotsOn(view: HudView): StylerLayout {
    return layoutFor(view, 'restyle', 'outfit', OUTFIT_SLOT_COUNT, 'slots');
  }

  /** The Outfit choices view with `count` choices on `view`. */
  function choicesOn(view: HudView, count: number): StylerLayout {
    return layoutFor(view, 'restyle', 'outfit', count, 'choices');
  }

  /** The Outfit controls of `layout`, which the Outfit step always has. */
  function outfitOf(layout: StylerLayout): NonNullable<StylerLayout['outfit']> {
    if (layout.outfit === null) throw new Error('the Outfit step has outfit controls');
    return layout.outfit;
  }

  /**
   * The band width of a choices `layout` with the tab row hidden: the panel padding across, less the
   * right step button column (Surprise me's place, Cancel, Done) and UI.gap on a landscape canvas.
   */
  function besideBandW(layout: StylerLayout): number {
    const inner = panelInner(layout);
    if (layout.panel.w <= layout.panel.h) return inner.w;
    return inner.w - Math.max(SURPRISE_BUTTON.w, CANCEL_BUTTON.w, DONE_BUTTON.w) - UI.gap;
  }

  /**
   * True when a choices `layout` is the last fit stage: one picture with More wearables beside it,
   * UI.gap away and level with it, and the label block under the two.
   */
  function moreBesideOf(layout: StylerLayout): boolean {
    const more = outfitOf(layout).more;
    const [option] = layout.options;
    const [label] = layout.optionLabels;
    if (more === null || layout.options.length !== 1) return false;
    const besidePicture = Math.abs(more.x - (option.x + option.w + UI.gap)) < 1e-9 && more.y < option.y + option.h && option.y < more.y + more.h;
    return besidePicture && label.y >= Math.max(option.y + option.h, more.y + more.h) + TEXT_GAP - 1e-9;
  }

  it('derives its counts from the catalogue: eight slots, and None plus the most Wearables of one slot (Head: None and nine)', () => {
    expect(OUTFIT_SLOT_COUNT).toBe(WEARABLE_SLOTS.length);
    expect(OUTFIT_SLOT_COUNT).toBe(MAX_STEP_OPTIONS);
    const perSlot = WEARABLE_SLOTS.map((slot) => WEARABLES.filter((wearable) => wearable.slot === slot).length);
    expect(MAX_OUTFIT_CHOICES).toBe(1 + Math.max(...perSlot));
    expect(WEARABLES.filter((wearable) => wearable.slot === 'head')).toHaveLength(9);
    expect(WEARABLES.filter((wearable) => wearable.slot === 'back')).toHaveLength(7);
    expect(MAX_OUTFIT_CHOICES).toBe(10);
  });

  it.each(SMALLEST)('fits the slots view on %j', (view) => {
    expect(layoutProblems(view, 'restyle', ['outfit', OUTFIT_SLOT_COUNT, 'slots'])).toEqual([]);
  });

  it('fits the slots view on every supported canvas', () => {
    expect(OUTFIT_VIEWS.flatMap((view) => layoutProblems(view, 'restyle', ['outfit', OUTFIT_SLOT_COUNT, 'slots']))).toEqual([]);
  }, MATRIX_TIMEOUT_MS);

  it.each(SMALLEST)('fits the choices view with every choice count on %j', (view) => {
    expect(choicesProblemsOn([view])).toEqual([]);
  });

  it('fits the choices view with every choice count on every supported canvas', () => {
    expect(choicesProblemsOn(OUTFIT_VIEWS)).toEqual([]);
  }, MATRIX_TIMEOUT_MS);

  it.each(SMALLEST)('fits the choices view on %j with the worst-case label block (three wrapped lines, a longest-named axolotl)', (view) => {
    const measure = outfitMeasureFor('choices');
    const worst = measure.optionLabelAt(OUTFIT_LABEL_MAX_PX);
    expect(worst.h).toBeGreaterThanOrEqual(3 * LINE_HEIGHT_EM * OPTION_LABEL_PX);
    for (const count of OUTFIT_CHOICE_COUNTS) {
      const layout = choicesOn(view, count);
      const outfit = outfitOf(layout);
      const inner = panelInner(layout);
      expect(layout.labelsShown).toBe(true);
      expect(outfit.perPage).toBeGreaterThanOrEqual(1);
      expect(outfit.more !== null).toBe(count > outfit.perPage);
      const wideH = measure.optionLabelAt(besideBandW(layout) - PICTURE_PX.min - UI.gap).h;
      const bandH = measure.optionLabelAt(besideBandW(layout)).h;
      for (const label of layout.optionLabels) {
        const wrappedWide = outfit.labelsBeside && label.w > OUTFIT_LABEL_MAX_PX + 1e-9;
        expect(label.h).toBeCloseTo(moreBesideOf(layout) ? bandH : wrappedWide ? wideH : worst.h, 6);
        expect(isInside(label, inner)).toBe(true);
      }
      const { done, cancel, surprise } = layout.nav;
      expect(surprise).toBeNull();
      for (const rect of [outfit.backToSlots, done, cancel]) {
        if (rect === null) throw new Error('Back to slots, Done and Cancel all show');
        expect(isInside(rect, inner)).toBe(true);
        expect(rect.h).toBeGreaterThanOrEqual(PRIMARY_H);
      }
    }
  });

  it('shows one choice alone on the smallest canvases, its label block under it at 460 x 320 and beside it at 320 x 440, and pages two to the most choices one a page with More wearables', () => {
    for (const view of SMALLEST) {
      for (const count of OUTFIT_CHOICE_COUNTS.slice(1)) {
        const choices = choicesOn(view, count);
        expect(outfitOf(choices).perPage, `${JSON.stringify(view)} ${count}`).toBe(1);
        expect(outfitOf(choices).more, `${JSON.stringify(view)} ${count}`).toMatchObject(MORE_WEARABLES_BUTTON);
      }
    }
    for (const view of SMALLEST) {
      const single = choicesOn(view, 1);
      expect(outfitOf(single).perPage, JSON.stringify(view)).toBe(1);
      expect(outfitOf(single).more, JSON.stringify(view)).toBeNull();
      expect(outfitOf(single).labelsBeside, JSON.stringify(view)).toBe(view.cssW < view.cssH);
    }
  });

  it('puts Back to slots first in the body when the tab row hides, and sets labels beside their pictures only then', () => {
    let hidden = 0;
    let beside = 0;
    for (const view of OUTFIT_VIEWS) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        const outfit = outfitOf(layout);
        const back = outfit.backToSlots;
        if (back === null) throw new Error('the choices view has Back to slots');
        if (outfit.labelsBeside) expect(layout.tabs).toBeNull();
        if (layout.tabs !== null) continue;
        hidden += 1;
        if (outfit.labelsBeside) beside += 1;
        expect(layout.cancelInTabRow).toBe(false);
        // Back to slots leads the body: above every picture and its label, and 12 px clear of the pictures.
        for (const option of layout.options) expect(option.y).toBeGreaterThanOrEqual(back.y + back.h + UI.gap - 1e-9);
        for (const label of layout.optionLabels) expect(label.y).toBeGreaterThanOrEqual(back.y + back.h + TEXT_GAP - 1e-9);
        if (outfit.labelsBeside) {
          layout.options.forEach((option, index) => {
            expect(layout.optionLabels[index].x).toBeGreaterThanOrEqual(option.x + option.w + TEXT_GAP - 1e-9);
          });
        }
      }
    }
    expect(hidden).toBeGreaterThan(0);
    expect(beside).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('keeps the tab row and labels under the pictures when the choices fit that way', () => {
    for (const view of [{ cssW: 1280, cssH: 800 }, { cssW: 844, cssH: 390 }, { cssW: 390, cssH: 844 }]) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        expect(layout.tabs).not.toBeNull();
        expect(outfitOf(layout).labelsBeside).toBe(false);
      }
    }
  });

  it('sets More wearables beside the one picture at 320 x 440 with two to the most choices, the label block under them wrapped at the band', () => {
    const view = { cssW: 320, cssH: 440 };
    const measure = outfitMeasureFor('choices');
    const single = choicesOn(view, 1);
    for (const count of OUTFIT_CHOICE_COUNTS.slice(1)) {
      const layout = choicesOn(view, count);
      const outfit = outfitOf(layout);
      const inner = panelInner(layout);
      const { cancel, done } = layout.nav;
      if (outfit.more === null || cancel === null || done === null) throw new Error('More wearables, Cancel and Done all show');
      const [option] = layout.options;
      const [label] = layout.optionLabels;
      expect(moreBesideOf(layout), String(count)).toBe(true);
      expect(layout.tabs).toBeNull();
      expect(outfit).toMatchObject({ perPage: 1, labelsBeside: false });
      expect(outfit.more).toMatchObject(MORE_WEARABLES_BUTTON);
      expect(option.w).toBeGreaterThanOrEqual(PICTURE_PX.min);
      expect(option.w + UI.gap + outfit.more.w).toBeLessThanOrEqual(inner.w + 1e-9);
      expect(label.w).toBeGreaterThan(OUTFIT_LABEL_MAX_PX);
      expect(label.w).toBeLessThanOrEqual(inner.w + 1e-9);
      expect(label.h).toBeCloseTo(measure.optionLabelAt(inner.w).h, 6);
      expect(clearance(outfit.more, cancel)).toBeGreaterThanOrEqual(UI.gap - 1e-9);
      expect(clearance(label, cancel)).toBeGreaterThanOrEqual(TEXT_GAP - 1e-9);
      expect(cancel).toEqual(single.nav.cancel);
      expect(done).toEqual(single.nav.done);
      expect(layoutProblems(view, 'restyle', ['outfit', count, 'choices'])).toEqual([]);
    }
  });

  it('sets More wearables beside the picture only where nothing before it fits, and keeps every other choices layout', () => {
    const used: string[] = [];
    for (const view of supportedCanvases()) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        if (moreBesideOf(choicesOn(view, count))) used.push(`${view.cssW}x${view.cssH} ${count}`);
      }
    }
    expect(used).toEqual(OUTFIT_CHOICE_COUNTS.slice(1).map((count) => `320x440 ${count}`));
    const expectRect = (rect: Rect | null, x: number, y: number, w: number, h: number): void => {
      if (rect === null) throw new Error('the pinned part shows');
      expect([rect.x, rect.y, rect.w, rect.h].map((value) => Math.round(value * 100) / 100)).toEqual([x, y, w, h]);
    };
    const beside = choicesOn({ cssW: 320, cssH: 440 }, 1);
    expect(outfitOf(beside)).toMatchObject({ perPage: 1, more: null, labelsBeside: true });
    expectRect(beside.options[0], 28, 140, 84, 84);
    expectRect(beside.optionLabels[0], 124, 125.75, 168, 112.5);
    expectRect(outfitOf(beside).backToSlots, 68, 57.75, 184, 64);
    const landscape = choicesOn({ cssW: 460, cssH: 320 }, 3);
    expect(landscape.tabs).toBeNull();
    expect(outfitOf(landscape)).toMatchObject({ perPage: 1, labelsBeside: true });
    expectRect(landscape.options[0], 28, 141, 54, 54);
    expectRect(landscape.optionLabels[0], 94, 111.75, 168, 112.5);
    expectRect(outfitOf(landscape).more, 55, 228.25, 180, 48);
    const tall = choicesOn({ cssW: 390, cssH: 844 }, 7);
    expect(tall.fitStep).toBe(3);
    expect(outfitOf(tall)).toMatchObject({ perPage: 2, labelsBeside: false });
    expectRect(tall.options[0], 203.8, 127, 86, 86);
    expectRect(tall.optionLabels[1], 162.8, 423.5, 168, 112.5);
    expectRect(outfitOf(tall).more, 156.8, 540, 180, 48);
    const wide = choicesOn({ cssW: 844, cssH: 390 }, 5);
    expect(wide.fitStep).toBe(5);
    expect(outfitOf(wide)).toMatchObject({ perPage: 3, labelsBeside: false });
    expectRect(wide.options[2], 479, 143.25, 50, 50);
    expectRect(outfitOf(wide).more, 234, 313.75, 180, 48);
  }, MATRIX_TIMEOUT_MS);

  it('never sets labels beside the pictures in the slots view', () => {
    for (const view of OUTFIT_VIEWS) {
      expect(outfitOf(slotsOn(view)).labelsBeside).toBe(false);
      expect(slotsOn(view).tabs).not.toBeNull();
    }
  }, MATRIX_TIMEOUT_MS);

  it('fits the choices view with everything shown on a large canvas', () => {
    expect(choicesProblemsOn([{ cssW: 1280, cssH: 800 }, { cssW: 844, cssH: 390 }])).toEqual([]);
    for (const count of OUTFIT_CHOICE_COUNTS) expect(choicesOn({ cssW: 1280, cssH: 800 }, count).fitStep).toBe(0);
  });

  it('never hides the labels, and gives every picture button one', () => {
    for (const view of OUTFIT_VIEWS) {
      for (const layout of [slotsOn(view), ...OUTFIT_CHOICE_COUNTS.map((count) => choicesOn(view, count))]) {
        expect(layout.labelsShown).toBe(true);
        expect(layout.optionLabels).toHaveLength(layout.options.length);
        expect(layout.name).toBeNull();
        expect(layout.dream).toBeNull();
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('shows at most 8 slots per page, with More slots exactly when they do not all show', () => {
    for (const view of OUTFIT_VIEWS) {
      const layout = slotsOn(view);
      const outfit = outfitOf(layout);
      expect(outfit.view).toBe('slots');
      expect(outfit.perPage).toBeGreaterThanOrEqual(1);
      expect(outfit.perPage).toBeLessThanOrEqual(MAX_STEP_OPTIONS);
      expect(layout.options).toHaveLength(outfit.perPage);
      expect(outfit.more !== null).toBe(outfit.perPage < OUTFIT_SLOT_COUNT);
      if (outfit.more !== null) expect(outfit.more).toMatchObject(MORE_SLOTS_BUTTON);
      expect(outfit.backToSlots).toBeNull();
    }
  }, MATRIX_TIMEOUT_MS);

  it('shows every slot on one page with the summary stacked on a large canvas', () => {
    const layout = slotsOn({ cssW: 1280, cssH: 800 });
    expect(layout.fitStep).toBe(0);
    expect(layout.helper).not.toBeNull();
    expect(layout.preview?.scale).toBe(PREVIEW_SCALE.full);
    expect(layout.caption).toBeNull();
    expect(outfitOf(layout)).toMatchObject({ view: 'slots', perPage: OUTFIT_SLOT_COUNT, more: null, summaryFlowed: false });
    expect(outfitOf(layout).summary).not.toBeNull();
  });

  it('puts the summary or caption under the slot buttons and any More slots', () => {
    for (const view of OUTFIT_VIEWS) {
      const layout = slotsOn(view);
      const under = layout.outfit?.summary ?? layout.caption;
      if (under === null) continue;
      for (const option of layout.options) expect(under.y).toBeGreaterThan(option.y + option.h);
      const more = layout.outfit?.more;
      if (more) expect(under.y).toBeGreaterThan(more.y + more.h);
    }
  }, MATRIX_TIMEOUT_MS);

  it('hides the summary, then the caption, before fit step 1, and never shows both', () => {
    let captions = 0;
    let flowed = 0;
    for (const view of OUTFIT_VIEWS) {
      const layout = slotsOn(view);
      const outfit = outfitOf(layout);
      expect(outfit.summary !== null && layout.caption !== null).toBe(false);
      if (outfit.summary !== null || layout.caption !== null) expect(layout.fitStep).toBe(0);
      if (layout.fitStep > 0) {
        expect(outfit.summary).toBeNull();
        expect(layout.caption).toBeNull();
      }
      if (!outfit.summary) expect(outfit.summaryFlowed).toBe(false);
      if (outfit.summaryFlowed) flowed += 1;
      if (layout.caption !== null) captions += 1;
    }
    expect(captions).toBeGreaterThan(0);
    expect(flowed + captions).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('flows the summary side by side only when stacked rows do not fit', () => {
    for (const view of OUTFIT_VIEWS) {
      const layout = slotsOn(view);
      const outfit = outfitOf(layout);
      if (!outfit.summaryFlowed || outfit.summary === null) continue;
      const stacked = summarySize(panelInner(layout).w, false);
      expect(outfit.summary.h).toBeLessThan(stacked.h);
    }
  }, MATRIX_TIMEOUT_MS);

  it('puts Back to slots first among the step buttons in the choices view only', () => {
    for (const view of [{ cssW: 1280, cssH: 800 }, { cssW: 844, cssH: 390 }, { cssW: 390, cssH: 844 }]) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        const back = outfitOf(layout).backToSlots;
        if (back === null) throw new Error('the choices view has Back to slots');
        expect(back).toMatchObject(BACK_TO_SLOTS_BUTTON);
        const { cancel, done } = layout.nav;
        if (cancel === null || done === null) throw new Error('the choices view has Cancel and Done');
        const next = layout.cancelInTabRow ? done : cancel;
        const before = back.y + back.h <= next.y + 1e-9 || (Math.abs(back.y - next.y) < 1e-9 && back.x < next.x);
        expect(before).toBe(true);
      }
    }
  });

  it('pages the choices with More wearables exactly when they do not all show', () => {
    for (const view of OUTFIT_VIEWS) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        const outfit = outfitOf(layout);
        expect(outfit.view).toBe('choices');
        expect(outfit.perPage).toBeGreaterThanOrEqual(1);
        expect(outfit.perPage).toBeLessThanOrEqual(Math.min(MAX_STEP_OPTIONS, count));
        expect(layout.options).toHaveLength(outfit.perPage);
        expect(outfit.more !== null).toBe(count > outfit.perPage);
        if (outfit.more !== null) expect(outfit.more).toMatchObject(MORE_WEARABLES_BUTTON);
        expect(outfit.summary).toBeNull();
        expect(layout.caption).toBeNull();
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('wraps each choices label block at 168 px or less under its picture, at the band less 60 px or less beside it, and at the band or less under its picture and More wearables, never cutting a word', () => {
    const measure = outfitMeasureFor('choices');
    expect(OUTFIT_LABEL_MAX_PX).toBe(168);
    expect(PICTURE_PX.min + UI.gap).toBe(60);
    expect(measure.optionLabelMinW).toBeLessThanOrEqual(OUTFIT_LABEL_MAX_PX);
    for (const view of OUTFIT_VIEWS) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        const besideMaxW = outfitOf(layout).labelsBeside ? Math.max(OUTFIT_LABEL_MAX_PX, besideBandW(layout) - 60) : OUTFIT_LABEL_MAX_PX;
        const maxW = moreBesideOf(layout) ? besideBandW(layout) : besideMaxW;
        for (const label of layout.optionLabels) {
          expect(label.w, JSON.stringify(view)).toBeLessThanOrEqual(maxW + 1e-9);
          expect(label.w).toBeGreaterThanOrEqual(measure.optionLabelMinW - 1e-9);
        }
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('wraps the label blocks beside the pictures wider than 168 px only when they take fewer lines, and under them only with More wearables beside the picture', () => {
    const measure = outfitMeasureFor('choices');
    let wider = 0;
    for (const view of OUTFIT_VIEWS) {
      for (const count of OUTFIT_CHOICE_COUNTS) {
        const layout = choicesOn(view, count);
        const label = layout.optionLabels[0];
        if (label.w <= OUTFIT_LABEL_MAX_PX + 1e-9 || moreBesideOf(layout)) continue;
        wider += 1;
        expect(outfitOf(layout).labelsBeside).toBe(true);
        expect(label.h).toBeLessThan(measure.optionLabelAt(OUTFIT_LABEL_MAX_PX).h);
      }
    }
    expect(wider).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('leaves outfit null on every other step', () => {
    for (const mode of MODES) {
      for (const [step, count, outfitView] of screensOf(mode)) {
        if (step !== 'outfit') expect(layoutFor({ cssW: 844, cssH: 390 }, mode, step, count, outfitView).outfit).toBeNull();
      }
    }
  });

  it('rejects Outfit in the creator, a missing or stray Outfit view, and a wrong option count', () => {
    const view = { cssW: 844, cssH: 390 };
    const slots = outfitMeasureFor('slots');
    const choices = outfitMeasureFor('choices');
    const at = (screen: StylerScreen, measure: StylerMeasure): StylerLayout => stylerLayout(view, screen, measure);
    const outfit = (optionCount: number, outfitView?: OutfitView): StylerScreen => ({
      mode: 'restyle',
      step: 'outfit',
      optionCount,
      tabPage: null,
      ...(outfitView ? { outfitView } : {}),
    });
    expect(() => at({ ...outfit(OUTFIT_SLOT_COUNT, 'slots'), mode: 'creator' }, slots)).toThrow(RangeError);
    expect(() => at(outfit(OUTFIT_SLOT_COUNT), slots)).toThrow(RangeError);
    expect(() => at({ mode: 'restyle', step: 'eyes', optionCount: 3, tabPage: null, outfitView: 'slots' }, measureFor('restyle', 'eyes'))).toThrow(RangeError);
    expect(() => at(outfit(OUTFIT_SLOT_COUNT - 1, 'slots'), slots)).toThrow(RangeError);
    expect(() => at(outfit(OUTFIT_SLOT_COUNT + 1, 'slots'), slots)).toThrow(RangeError);
    expect(() => at(outfit(0, 'choices'), choices)).toThrow(RangeError);
    expect(() => at(outfit(MAX_OUTFIT_CHOICES + 1, 'choices'), choices)).toThrow(RangeError);
    expect(() => at(outfit(1.5, 'choices'), choices)).toThrow(RangeError);
    expect(at(outfit(1, 'choices'), choices).outfit?.perPage).toBe(1);
  });

  it('needs the outfit summary measure on the slots view only', () => {
    const view = { cssW: 844, cssH: 390 };
    const withoutSummary = (outfitView: OutfitView): StylerMeasure => ({ ...outfitMeasureFor(outfitView), outfitSummaryAt: undefined });
    const screen = (outfitView: OutfitView, optionCount: number): StylerScreen => ({ mode: 'restyle', step: 'outfit', optionCount, tabPage: null, outfitView });
    expect(() => stylerLayout(view, screen('slots', OUTFIT_SLOT_COUNT), withoutSummary('slots'))).toThrow(Error);
    expect(stylerLayout(view, screen('choices', 1), withoutSummary('choices')).outfit?.view).toBe('choices');
  });
});

describe('restyle tab strip with the Outfit tab', () => {
  it('holds every restyle tab, Outfit right after Dream colour, on the smallest canvases and pages it', () => {
    for (const view of SMALLEST) {
      for (const step of RESTYLE_STEPS) {
        const tabs = layoutFor(view, 'restyle', step, 3).tabs;
        if (tabs === null) throw new Error('restyle has tabs');
        const order = tabs.pages.flat();
        expect(order).toEqual(RESTYLE_STEPS);
        expect(order.indexOf('outfit')).toBe(order.indexOf('dream') + 1);
        expect(tabs.pages.length).toBeGreaterThan(1);
        expect(tabs.prevPage).not.toBeNull();
        expect(tabs.nextPage).not.toBeNull();
        expect(tabs.tabs.map((tab) => tab.step)).toContain(step);
      }
    }
  });

  it('keeps every tab page inside the room between the page buttons, 12 px from them', () => {
    for (const view of [...SMALLEST, ...supportedCanvases()]) {
      const tabs = layoutFor(view, 'restyle', 'outfit', OUTFIT_SLOT_COUNT, 'slots').tabs;
      if (tabs === null) throw new Error('restyle has tabs');
      for (const tab of tabs.tabs) {
        if (tabs.prevPage) expect(clearance(tab.rect, tabs.prevPage)).toBeGreaterThanOrEqual(UI.gap - 1e-9);
        if (tabs.nextPage) expect(clearance(tab.rect, tabs.nextPage)).toBeGreaterThanOrEqual(UI.gap - 1e-9);
      }
    }
  }, MATRIX_TIMEOUT_MS);

  it('shows the Outfit tab on the page it opens on, wrapping the asked page at both ends', () => {
    const view = { cssW: 460, cssH: 320 };
    const at = (tabPage: number | null): StylerLayout =>
      stylerLayout(view, { mode: 'restyle', step: 'outfit', optionCount: OUTFIT_SLOT_COUNT, tabPage, outfitView: 'slots' }, outfitMeasureFor('slots'));
    const home = at(null).tabs;
    if (home === null) throw new Error('restyle has tabs');
    expect(home.tabs.map((tab) => tab.step)).toContain('outfit');
    expect(at(home.pages.length + home.page).tabs?.page).toBe(home.page);
    expect(at(-1).tabs?.page).toBe(home.pages.length - 1);
  });
});

describe('nameBoxParts', () => {
  /** Name boxes to split: the bare size at the origin, off whole px, and every laid-out name box on the smallest canvases. */
  function nameBoxes(): Rect[] {
    const laidOut = SMALLEST.flatMap((view) => MODES.map((mode) => layoutFor(view, mode, 'name', NAME_COUNT).name?.box));
    return [
      { x: 0, y: 0, ...NAME_BOX },
      { x: 37.5, y: 101.25, ...NAME_BOX },
      ...laidOut.filter((box): box is Rect => box !== undefined),
    ];
  }

  it('leaves room for a 12-character name at 20 px', () => {
    for (const box of nameBoxes()) {
      const { text } = nameBoxParts(box);
      expect(text.w).toBeGreaterThanOrEqual(NAME_MAX * BOLD_EM * NAME_TEXT_PX - 1e-9);
      expect(text.x).toBeCloseTo(box.x + UI.pad);
      expect(text.y).toBe(box.y);
      expect(text.h).toBe(box.h);
    }
  });

  it('puts a 20 px pencil inside the box, UI.pad in from the right edge and centred down it', () => {
    for (const box of nameBoxes()) {
      const { pencil } = nameBoxParts(box);
      expect(pencil.w).toBe(NAME_PENCIL_PX);
      expect(pencil.h).toBe(NAME_PENCIL_PX);
      expect(isInside(pencil, box)).toBe(true);
      expect(pencil.x + pencil.w).toBeCloseTo(box.x + box.w - UI.pad);
      expect(pencil.y + pencil.h / 2).toBeCloseTo(box.y + box.h / 2);
    }
  });

  it('keeps the text and the pencil at least TEXT_GAP apart, never overlapping', () => {
    for (const box of nameBoxes()) {
      const { text, pencil } = nameBoxParts(box);
      expect(isInside(text, box)).toBe(true);
      expect(clearance(text, pencil)).toBeGreaterThanOrEqual(TEXT_GAP - 1e-9);
      expect(clearance(text, pencil)).toBeGreaterThan(0);
    }
  });
});

describe('nameCursorShown', () => {
  it('blinks at 1 Hz, under 3 flashes a second', () => {
    expect(NAME_CURSOR).toEqual({ onS: 0.5, offS: 0.5 });
    expect(Object.isFrozen(NAME_CURSOR)).toBe(true);
    const periodS = NAME_CURSOR.onS + NAME_CURSOR.offS;
    expect(1 / periodS).toBe(1);
    expect(1 / periodS).toBeLessThan(3);
  });

  it('shows the cursor for the first half of each second', () => {
    for (const start of [0, 1, 7]) {
      for (const seconds of [0, 0.1, 0.25, 0.4, 0.49]) expect(nameCursorShown(start + seconds, true)).toBe(true);
    }
  });

  it('hides the cursor for the second half of each second', () => {
    for (const start of [0, 1, 7]) {
      for (const seconds of [0.5, 0.6, 0.75, 0.9, 0.99]) expect(nameCursorShown(start + seconds, true)).toBe(false);
    }
  });

  it('keeps the cursor steady when not blinking', () => {
    for (const seconds of [0, 0.25, 0.5, 0.75, 0.99, 3.6]) expect(nameCursorShown(seconds, false)).toBe(true);
  });

  it('shows the cursor at a negative or not-a-number time', () => {
    for (const seconds of [-0.75, -0.25, Number.NaN, Number.POSITIVE_INFINITY]) expect(nameCursorShown(seconds, true)).toBe(true);
  });
});

describe('restyle Surprise me', () => {
  /** Every canvas the Surprise me checks run on: the smallest, then every supported canvas. */
  const VIEWS: readonly HudView[] = [...SMALLEST, ...supportedCanvases()];

  /** True on the restyle steps that hide Surprise me: Colour, Boy or girl, Dream colour and Outfit. */
  function hidesSurprise(step: StylerStep): boolean {
    return step === 'colour' || step === 'sex' || step === 'dream' || step === 'outfit';
  }

  /** Every restyle screen layout on `view`, with its screen case. */
  function restyleLayoutsOn(view: HudView): [ScreenCase, StylerLayout][] {
    return screensOf('restyle').map((screenCase): [ScreenCase, StylerLayout] => {
      const [step, count, outfitView] = screenCase;
      return [screenCase, layoutFor(view, 'restyle', step, count, outfitView)];
    });
  }

  /** Back to slots when it is a step button (the Outfit choices view with the tab row shown), else null. */
  function leadButtonOf(layout: StylerLayout): Rect | null {
    return layout.tabs === null ? null : (layout.outfit?.backToSlots ?? null);
  }

  /**
   * Where the step buttons go when Surprise me keeps its place: Back to slots (when it is a step
   * button), Surprise me, Cancel (unless it ends the tab row) and Done, in greedy centred rows at the
   * bottom of the panel padding or, on a landscape canvas, stacked in a right column ending there.
   */
  function reservedPlaces(view: HudView, layout: StylerLayout): Rect[] {
    const inner = panelInner(layout);
    const sizes: Size[] = [
      ...(leadButtonOf(layout) === null ? [] : [BACK_TO_SLOTS_BUTTON]),
      SURPRISE_BUTTON,
      ...(layout.cancelInTabRow ? [] : [CANCEL_BUTTON]),
      DONE_BUTTON,
    ];
    const bottom = inner.y + inner.h;
    if (view.cssW > view.cssH) return columnPlaces(sizes, inner.x + inner.w, bottom);
    return rowPlaces(sizes, inner.x + inner.w / 2, inner.w, bottom);
  }

  /** `sizes` stacked UI.gap apart in a right column ending at `right` and `bottom`, each centred in it. */
  function columnPlaces(sizes: readonly Size[], right: number, bottom: number): Rect[] {
    const columnW = Math.max(...sizes.map((size) => size.w));
    let y = bottom - sizes.reduce((sum, size) => sum + size.h, 0) - UI.gap * (sizes.length - 1);
    return sizes.map((size) => {
      const rect = { x: right - columnW + (columnW - size.w) / 2, y, w: size.w, h: size.h };
      y += size.h + UI.gap;
      return rect;
    });
  }

  /** `sizes` in greedy rows UI.gap apart that fit `maxW`, each centred on `centreX`, the last ending at `bottom`. */
  function rowPlaces(sizes: readonly Size[], centreX: number, maxW: number, bottom: number): Rect[] {
    const rows: Size[][] = [];
    for (const size of sizes) {
      const row = rows[rows.length - 1];
      const rowW = row === undefined ? 0 : row.reduce((sum, item) => sum + item.w + UI.gap, 0);
      if (row !== undefined && rowW + size.w <= maxW) row.push(size);
      else rows.push([size]);
    }
    const rowsH = rows.reduce((sum, row) => sum + Math.max(...row.map((size) => size.h)) + UI.gap, -UI.gap);
    let rowTop = bottom - rowsH;
    return rows.flatMap((row) => {
      const rowH = Math.max(...row.map((size) => size.h));
      let x = centreX - (row.reduce((sum, size) => sum + size.w, 0) + UI.gap * (row.length - 1)) / 2;
      const rects = row.map((size) => {
        const rect = { x, y: rowTop + (rowH - size.h) / 2, w: size.w, h: size.h };
        x += size.w + UI.gap;
        return rect;
      });
      rowTop += rowH + UI.gap;
      return rects;
    });
  }

  it('shows exactly where surpriseShown says, in both modes and on every step', () => {
    for (const step of RESTYLE_STEPS) expect(surpriseShown('restyle', step)).toBe(!hidesSurprise(step));
    for (const step of STYLER_STEPS) expect(surpriseShown('creator', step)).toBe(true);
  });

  it('is null on restyle Colour, Boy or girl, Dream colour and Outfit, and shows on every other step', () => {
    let tabRowHidden = 0;
    let tabRowShown = 0;
    for (const view of VIEWS) {
      for (const [[step, count, outfitView], layout] of restyleLayoutsOn(view)) {
        const label = `${view.cssW}x${view.cssH} ${step}${outfitView ? ` ${outfitView}` : ''} x${count}`;
        expect(`${label}: ${layout.nav.surprise === null}`).toBe(`${label}: ${hidesSurprise(step)}`);
        if (outfitView === 'choices' && layout.tabs === null) tabRowHidden += 1;
        if (outfitView === 'choices' && layout.tabs !== null) tabRowShown += 1;
      }
      for (const [step, count] of screensOf('creator')) {
        expect(layoutFor(view, 'creator', step, count).nav.surprise).not.toBeNull();
      }
    }
    expect(tabRowHidden).toBeGreaterThan(0);
    expect(tabRowShown).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('keeps the Surprise me place where it hides, so Back to slots, Cancel and Done never move', () => {
    let hidden = 0;
    for (const view of VIEWS) {
      for (const [[step], layout] of restyleLayoutsOn(view)) {
        const places = reservedPlaces(view, layout);
        const lead = leadButtonOf(layout);
        const surpriseIndex = lead === null ? 0 : 1;
        const others = [...(lead === null ? [] : [lead]), ...(layout.cancelInTabRow ? [] : [layout.nav.cancel]), layout.nav.done];
        expect(others).toEqual(places.filter((_place, index) => index !== surpriseIndex));
        if (hidesSurprise(step)) hidden += 1;
        else expect(layout.nav.surprise).toEqual(places[surpriseIndex]);
      }
    }
    expect(hidden).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it('leaves Done, and Cancel among the step buttons, where a tab with Surprise me puts them', () => {
    let compared = 0;
    for (const view of VIEWS) {
      const eyes = layoutFor(view, 'restyle', 'eyes', MAX_STEP_OPTIONS);
      for (const [[step], layout] of restyleLayoutsOn(view)) {
        if (!hidesSurprise(step) || leadButtonOf(layout) !== null || layout.cancelInTabRow !== eyes.cancelInTabRow) continue;
        if (!layout.cancelInTabRow) expect(layout.nav.cancel).toEqual(eyes.nav.cancel);
        expect(layout.nav.done).toEqual(eyes.nav.done);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
  }, MATRIX_TIMEOUT_MS);

  it.each(SMALLEST)('never changes the fit step with the Surprise me helper sentence on %j', (view) => {
    for (const mode of MODES) {
      for (const [step, count] of screensOf(mode)) {
        if (step === 'outfit') continue;
        const screen = screenFor(mode, step, count);
        const withSentence = stylerLayout(view, screen, measureFor(mode, step, undefined, true)).fitStep;
        const withoutSentence = stylerLayout(view, screen, measureFor(mode, step, undefined, false)).fitStep;
        expect(`${mode} ${step} x${count}: ${withSentence}`).toBe(`${mode} ${step} x${count}: ${withoutSentence}`);
      }
    }
  });
});
