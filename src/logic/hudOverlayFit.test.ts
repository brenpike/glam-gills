import { describe, expect, it } from 'vitest';
import { exitClosedText, snacksLeftLabel } from './areaText';
import { ALL_TREASURES, categoryName, type Treasure } from './catalogue';
import { isSupportedCanvas } from './cardFit';
import { DASH_POT_TIP_TEXT } from './dashPotTip';
import { rarityName } from './hints';
import {
  FIND_TOAST,
  HUD,
  HUD_OVERLAY_PRIORITY,
  bannerBox,
  clears,
  controlKeepOuts,
  findToastBox,
  hudControls,
  placeHudOverlays,
  playMiddle,
  type FindToastMeasure,
  type HudControls,
  type HudControlSizes,
  type HudOverlayId,
  type HudOverlayPlacement,
  type HudOverlayRequest,
  type HudView,
  type Rect,
  type Size,
} from './hudLayout';
import { REAL_MORPHS, RESCUE_POPUP_DETAIL } from './morphs';
import {
  ALL_SNACKS_BANNER,
  BANKING_HINT,
  GHOST_NET_BANNER,
  LEGS_LABEL,
  PLASTIC_WORM_BANNER,
  TRIP_BAG_LABEL,
  tripBagStatus,
} from './tripText';
import { LEGS } from './tuning';
import { buildCanalZone } from './zone';

/**
 * Text size estimate that errs wide. Measured with Phaser's wrap rule against Segoe UI, Verdana and
 * DejaVu Sans: line height <= 1.21 em, average advance <= 0.51 em regular and <= 0.57 em bold.
 */
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

/**
 * Control sizes from src/art/drawUi.ts and src/scenes/HudScene.ts (logic tests must not import art):
 * Pause is BUTTON_WIDE (200 x 64) at PAUSE_BUTTON_SIZE 0.8, Go home is BUTTON_WIDE at size 1, Dash is
 * BUTTON_SQUARE (64 x 64) at DASH_BUTTON_SIZE 1.25 with corner buttonRadius(64) * 1.25 = 19.2 * 1.25.
 */
const PAUSE_SIZE: Size = { w: 160, h: 51.2 };
const GO_HOME_SIZE: Size = { w: 200, h: 64 };
const DASH_SIZE: Size = { w: 80, h: 80 };
const DASH_CORNER_R = 24;

/**
 * Status panel metrics from src/scenes/HudScene.ts: 12 px padding round a 32 px icon row, so every
 * panel is 56 tall; the counter reads snacksLeftLabel() at every width.
 */
const PANEL_H = 56;
const PANEL_PAD = 12;
const PANEL_ICON_PX = 32;
const PANEL_TEXT_PX = 22;
const COUNTER_ICON_GAP = 6;
const LEGS_ICON_PX = 32;
const LEGS_ICON_GAP = 4;
const LEGS_LABEL_GAP = 6;
const BAG_STATUS_PX = 18;
const BAG_GAP = 6;

/** Panel label advance per em: narrow and wide, so every Go home tier is covered. */
const PANEL_EMS: Readonly<Record<PanelWidth, number>> = { narrow: 0.45, wide: 0.6 };
const PANEL_WIDTHS: readonly PanelWidth[] = ['narrow', 'wide'];

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

const ZONE = buildCanalZone();
const SNACK_TOTAL = ZONE.collectibles.length;
const FIND_TOTAL = ZONE.finds.length;

/** One find toast's text: the bold name over the bold detail line beside the badge. */
interface ToastText {
  name: string;
  detail: string;
}

/** One find toast per catalogue treasure, every area. */
const TREASURE_TOASTS: readonly ToastText[] = ALL_TREASURES.map((treasure: Treasure) => ({
  name: treasure.name,
  detail: `${rarityName(treasure.rarity)} ${categoryName(treasure.category)}`,
}));
const RESCUE_TOASTS: readonly ToastText[] = REAL_MORPHS.map((morph) => ({
  name: morph.displayName,
  detail: RESCUE_POPUP_DETAIL,
}));
const ALL_TOASTS: readonly ToastText[] = [...TREASURE_TOASTS, ...RESCUE_TOASTS];

const SORTED_TOASTS: readonly ToastText[] = [...ALL_TOASTS].sort(
  (left, right) => right.name.length - left.name.length,
);
const LONGEST_DETAIL_TOAST: ToastText = [...ALL_TOASTS].sort(
  (left, right) => right.detail.length - left.detail.length,
)[0];
const COMBINATION_TOASTS: readonly ToastText[] = [...new Set([...SORTED_TOASTS.slice(0, 3), LONGEST_DETAIL_TOAST])];

/** Two-digit snacks-left count: the longest closed-exit message the snack banner shows. */
const MOST_SNACKS_LEFT = 16;
const EXIT_CLOSED_BANNER = exitClosedText(MOST_SNACKS_LEFT);

/** Every message the snack banner shows: the closed exit, the last snack, the plastic worm and the ghost net. */
const SNACK_BANNER_TEXTS: readonly string[] = [
  EXIT_CLOSED_BANNER,
  ALL_SNACKS_BANNER,
  PLASTIC_WORM_BANNER,
  GHOST_NET_BANNER,
];

/** The longest snack banner message: the worst case the fit runs. */
const LONGEST_SNACK_BANNER = SNACK_BANNER_TEXTS.reduce((longest, text) => (text.length > longest.length ? text : longest));

/** Every message the hint banner shows: the banking hint and the Dash pot tip for each input (PRD B11). */
const HINT_TEXTS: readonly string[] = [BANKING_HINT, ...Object.values(DASH_POT_TIP_TEXT)];

/** The longest hint banner message: the worst case the fit runs. */
const LONGEST_HINT = HINT_TEXTS.reduce((longest, text) => (text.length > longest.length ? text : longest));

type BannerId = Exclude<HudOverlayId, 'findToast'>;

const BANNER_TEXTS: Readonly<Record<BannerId, string>> = {
  hint: LONGEST_HINT,
  snackBanner: LONGEST_SNACK_BANNER,
};
const BANNER_IDS: readonly BannerId[] = ['snackBanner', 'hint'];

const FIT_TIMEOUT_MS = 30000;
const EPSILON = 1e-6;

type PanelWidth = 'narrow' | 'wide';

interface Canvas {
  cssW: number;
  cssH: number;
}

/** One HUD state: canvas, panel widths, Go home visibility and the resolved controls. */
interface HudCase {
  label: string;
  view: HudView;
  controls: HudControls;
  goHomeVisible: boolean;
  keepOuts: Rect[];
}

/** One set of active overlays; the toast shows `toast` when it is active. */
interface OverlaySet {
  ids: HudOverlayId[];
  toast: ToastText | null;
}

/** One placement run: a HUD state, an overlay set and the solver's answer. */
interface OverlayCase {
  label: string;
  hud: HudCase;
  set: OverlaySet;
  requests: HudOverlayRequest[];
  placements: HudOverlayPlacement[];
}

/** Widths of the lines `text` wraps to at `wrapW`, splitting on '\n' then greedily on ' ', every character `em * px` wide. */
function wrapLineWidths(text: string, px: number, wrapW: number, em: number): number[] {
  const charW = em * px;
  const widths: number[] = [];
  for (const paragraph of text.split('\n')) {
    let lineW = 0;
    for (const word of paragraph.split(' ')) {
      const wordW = word.length * charW;
      if (lineW > 0 && lineW + charW + wordW > wrapW) {
        widths.push(lineW);
        lineW = wordW;
      } else {
        lineW += (lineW > 0 ? charW : 0) + wordW;
      }
    }
    widths.push(lineW);
  }
  return widths;
}

/** Lines `text` wraps to at `wrapW`, splitting on '\n' then greedily on ' ', every character `em * px` wide. */
function estimateLines(text: string, px: number, wrapW: number, em: number): number {
  return wrapLineWidths(text, px, wrapW, em).length;
}

/** Estimated text block size when wrapped at `wrapW` (Infinity for unwrapped text). */
function estimateSize(text: string, px: number, wrapW: number, em: number): Size {
  const widths = wrapLineWidths(text, px, wrapW, em);
  return { w: Math.max(...widths), h: widths.length * LINE_HEIGHT_EM * px };
}

/** Estimated unwrapped text width. */
function textWidth(text: string, px: number, em: number): number {
  return estimateSize(text, px, Infinity, em).w;
}

/** Supported canvases from the width and height grid. */
function supportedCanvases(): Canvas[] {
  const canvases: Canvas[] = [];
  for (const cssW of CANVAS_WIDTHS) {
    for (const cssH of CANVAS_HEIGHTS) {
      if (isSupportedCanvas(cssW, cssH)) canvases.push({ cssW, cssH });
    }
  }
  return canvases;
}

/** Snack counter, legs and Trip Bag panel sizes the way HudScene lays them out, labels at `em`. */
function panelSizes(em: number): Pick<HudControlSizes, 'counter' | 'legs' | 'bag'> {
  const counterLabel = snacksLeftLabel(SNACK_TOTAL);
  const counterW = 2 * PANEL_PAD + PANEL_ICON_PX + COUNTER_ICON_GAP + textWidth(counterLabel, PANEL_TEXT_PX, em);
  const iconsW = LEGS.count * LEGS_ICON_PX + (LEGS.count - 1) * LEGS_ICON_GAP;
  const legsW = 2 * PANEL_PAD + textWidth(LEGS_LABEL, PANEL_TEXT_PX, em) + LEGS_LABEL_GAP + iconsW;
  const countW = textWidth(String(FIND_TOTAL), PANEL_TEXT_PX, em);
  const statusW = Math.max(textWidth(tripBagStatus(0), BAG_STATUS_PX, em), textWidth(tripBagStatus(1), BAG_STATUS_PX, em));
  const bagLabelW = textWidth(TRIP_BAG_LABEL, PANEL_TEXT_PX, em);
  const bagW = 2 * PANEL_PAD + PANEL_ICON_PX + 3 * BAG_GAP + bagLabelW + countW + statusW;
  return {
    counter: { w: counterW, h: PANEL_H },
    legs: { w: legsW, h: PANEL_H },
    bag: { w: bagW, h: PANEL_H },
  };
}

/** Builds one HUD state. */
function makeHudCase(canvas: Canvas, panelWidth: PanelWidth, goHomeVisible: boolean): HudCase {
  const view: HudView = { cssW: canvas.cssW, cssH: canvas.cssH };
  const sizes: HudControlSizes = {
    pause: PAUSE_SIZE,
    goHome: GO_HOME_SIZE,
    dash: DASH_SIZE,
    dashCornerR: DASH_CORNER_R,
    ...panelSizes(PANEL_EMS[panelWidth]),
  };
  const controls = hudControls(view, sizes);
  const label = `${canvas.cssW}x${canvas.cssH} ${panelWidth} panels, Go home ${goHomeVisible ? 'visible' : 'hidden'}`;
  return { label, view, controls, goHomeVisible, keepOuts: controlKeepOuts(controls, { goHomeVisible }) };
}

/** Every HUD state on one canvas: both panel widths, Go home visible and hidden. */
function canvasHudCases(canvas: Canvas): HudCase[] {
  return PANEL_WIDTHS.flatMap((panelWidth) => [true, false].map((visible) => makeHudCase(canvas, panelWidth, visible)));
}

/** Find toast text measure for `toast`: bold name 20 and bold detail 18. */
function toastMeasure(toast: ToastText): FindToastMeasure {
  return {
    nameAt: (wrapW) => estimateSize(toast.name, FIND_TOAST.nameTextPx, wrapW, BOLD_EM),
    detailAt: (wrapW) => estimateSize(toast.detail, FIND_TOAST.detailTextPx, wrapW, BOLD_EM),
  };
}

/** Builds the overlay requests for one set. */
function requestsFor(set: OverlaySet): HudOverlayRequest[] {
  return set.ids.map((id): HudOverlayRequest => {
    if (id === 'findToast') {
      if (set.toast === null) throw new Error('requestsFor: the find toast needs its text');
      const measure = toastMeasure(set.toast);
      return { id, boxAt: (maxW) => findToastBox(maxW, measure) };
    }
    return { id, boxAt: bannerBoxAt(id, HUD.bannerTextPx), retryBoxAt: bannerBoxAt(id, HUD.bannerRetryTextPx) };
  });
}

/** Panel size function for banner `id` with its text at `px`. */
function bannerBoxAt(id: BannerId, px: number): (maxW: number) => Size {
  const text = BANNER_TEXTS[id];
  return (maxW) => bannerBox(maxW, (wrapW) => estimateSize(text, px, wrapW, BOLD_EM));
}

/** Expands overlay id sets into overlay sets, one per toast text when the toast is active. */
function expandSets(idSets: readonly HudOverlayId[][], toasts: readonly ToastText[]): OverlaySet[] {
  return idSets.flatMap((ids): OverlaySet[] =>
    ids.includes('findToast') ? toasts.map((toast) => ({ ids, toast })) : [{ ids, toast: null }],
  );
}

/** Every overlay id set of `size` overlays, in priority order. */
function idSetsOfSize(size: number): HudOverlayId[][] {
  const sets: HudOverlayId[][] = [];
  for (let mask = 1; mask < 1 << HUD_OVERLAY_PRIORITY.length; mask++) {
    const ids = HUD_OVERLAY_PRIORITY.filter((_, index) => (mask & (1 << index)) !== 0);
    if (ids.length === size) sets.push(ids);
  }
  return sets;
}

/** Single overlays with every toast, and 2 or 3 overlays with the longest toasts. */
function allOverlaySets(): OverlaySet[] {
  return [
    ...expandSets(idSetsOfSize(1), ALL_TOASTS),
    ...expandSets([...idSetsOfSize(2), ...idSetsOfSize(3)], COMBINATION_TOASTS),
  ];
}

/** Runs the solver for one HUD state and overlay set. */
function runCase(hud: HudCase, set: OverlaySet): OverlayCase {
  const requests = requestsFor(set);
  const placements = placeHudOverlays(hud.view, hud.controls, hud.keepOuts, requests);
  const name = set.toast === null ? '' : ` "${set.toast.name}"`;
  return { label: `${hud.label} [${set.ids.join(', ')}]${name}`, hud, set, requests, placements };
}

/** The placement for `id` in one case, or null when it has none. */
function rectFor(overlayCase: OverlayCase, id: HudOverlayId): Rect | null {
  return overlayCase.placements.find((placement) => placement.id === id)?.rect ?? null;
}

/** Problems with one case: a placed rect that does not clear the keep-outs and the other overlays. */
function clearProblems(overlayCase: OverlayCase): string[] {
  const placed = overlayCase.placements.flatMap(({ id, rect }) => (rect === null ? [] : [{ id, rect }]));
  return placed.flatMap((placement) => {
    const others = placed.filter((other) => other !== placement).map((other) => other.rect);
    const ok = clears(placement.rect, overlayCase.hud.view, [...overlayCase.hud.keepOuts, ...others]);
    return ok ? [] : [`${overlayCase.label}: ${placement.id} does not clear`];
  });
}

/** The rect and text size of overlay `id` in one case, both null when it has no placement. */
function fitFor(overlayCase: OverlayCase, id: HudOverlayId): Pick<HudOverlayPlacement, 'rect' | 'textPx'> {
  const placement = overlayCase.placements.find((entry) => entry.id === id);
  return { rect: placement?.rect ?? null, textPx: placement?.textPx ?? null };
}

/**
 * Problems with one case: a placed banner not at 24 or 20 px (never under 20, X6), a find toast
 * with a text size, or an overlay with no place that reports one.
 */
function textPxProblems(overlayCase: OverlayCase): string[] {
  return overlayCase.placements.flatMap(({ id, rect, textPx }) => {
    const allowed: (number | null)[] = rect === null || id === 'findToast' ? [null] : [HUD.bannerTextPx, HUD.bannerRetryTextPx];
    return allowed.includes(textPx) ? [] : [`${overlayCase.label}: ${id} at textPx ${textPx}`];
  });
}

/**
 * Problems with one case: a banner placed at 20 px that would have a place at 24 px. Each such
 * banner is placed again with its retry removed and the other requests the same; it must then have
 * no place.
 */
function shrinkProblems(overlayCase: OverlayCase): string[] {
  const { view, controls, keepOuts } = overlayCase.hud;
  return overlayCase.placements.flatMap(({ id, textPx }) => {
    if (textPx !== HUD.bannerRetryTextPx) return [];
    const requests = overlayCase.requests.map((request) => (request.id === id ? { id, boxAt: request.boxAt } : request));
    const unretried = placeHudOverlays(view, controls, keepOuts, requests).find((placement) => placement.id === id);
    return unretried?.rect === null ? [] : [`${overlayCase.label}: ${id} shrank to ${textPx} px with room at 24 px`];
  });
}

/** Problems with one case: overlay `id` has no room. */
function unplacedProblems(overlayCase: OverlayCase, id: HudOverlayId): string[] {
  return rectFor(overlayCase, id) === null ? [`${overlayCase.label}: ${id} not placed`] : [];
}

/** Sorted distinct cut points: `lo`, `hi` and every edge strictly between them. */
function cutsBetween(lo: number, hi: number, edges: readonly number[]): number[] {
  return [...new Set([lo, hi, ...edges.filter((edge) => edge > lo && edge < hi)])].sort((a, b) => a - b);
}

/**
 * Whether the part of `rect` inside the play middle lies on the snack counter, legs and Trip Bag
 * panels themselves (no open water): every cell of the grid cut at the panel edges has its centre
 * on a panel.
 */
function coversOnlyPanelsInMiddle(rect: Rect, view: HudView, controls: HudControls): boolean {
  const middle = playMiddle(view);
  const panels = [controls.counter, controls.legs, controls.bag];
  const left = Math.max(rect.x, middle.x);
  const right = Math.min(rect.x + rect.w, middle.x + middle.w);
  const top = Math.max(rect.y, middle.y);
  const bottom = Math.min(rect.y + rect.h, middle.y + middle.h);
  if (right - left <= EPSILON || bottom - top <= EPSILON) return true;
  const xs = cutsBetween(left, right, panels.flatMap((panel) => [panel.x, panel.x + panel.w]));
  const ys = cutsBetween(top, bottom, panels.flatMap((panel) => [panel.y, panel.y + panel.h]));
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      if (xs[i + 1] - xs[i] <= EPSILON || ys[j + 1] - ys[j] <= EPSILON) continue;
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const onPanel = panels.some((p) => cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h);
      if (!onPanel) return false;
    }
  }
  return true;
}

/** Problems with one case: a placed rect over open water in the play middle, whatever its place. */
function middleProblems(overlayCase: OverlayCase): string[] {
  const { view, controls } = overlayCase.hud;
  return overlayCase.placements.flatMap(({ id, rect }) => {
    if (rect === null || coversOnlyPanelsInMiddle(rect, view, controls)) return [];
    return [`${overlayCase.label}: ${id} at ${JSON.stringify(rect)} covers open water in the middle`];
  });
}

/** What waits when shown alone in one HUD state: each held toast by name, then each held banner id. */
function aloneWaits(hud: HudCase): string[] {
  const toasts = ALL_TOASTS.filter((toast) => rectFor(runCase(hud, { ids: ['findToast'], toast }), 'findToast') === null);
  const banners = BANNER_IDS.filter((id) => rectFor(runCase(hud, { ids: [id], toast: null }), id) === null);
  return [...toasts.map((toast) => `findToast "${toast.name}"`), ...banners];
}

/** Problems with one case: the toast is not on the top edge at the margin. */
function topEdgeProblems(overlayCase: OverlayCase): string[] {
  const placement = overlayCase.placements.find((entry) => entry.id === 'findToast');
  if (placement?.edge === 'top' && placement.rect?.y === HUD.margin) return [];
  return [`${overlayCase.label}: toast at ${JSON.stringify(placement)}`];
}

/** Every HUD state on every supported canvas. */
function allHudCases(): HudCase[] {
  return supportedCanvases().flatMap(canvasHudCases);
}

describe('estimateLines', () => {
  it('wraps greedily on spaces and keeps over-long words alone', () => {
    expect(estimateLines('', 10, 100, 1)).toBe(1);
    expect(estimateLines('aaaa bbbb', 10, 90, 1)).toBe(1);
    expect(estimateLines('aaaa bbbb', 10, 89, 1)).toBe(2);
    expect(estimateLines('aaaaaaaaaaaa b', 10, 50, 1)).toBe(2);
    expect(estimateLines('a\nb', 10, 100, 1)).toBe(2);
  });

  it('sizes a wrapped block by its widest line', () => {
    expect(estimateSize('aaaa bbbb cc', 10, 90, 1)).toEqual({ w: 90, h: 25 });
    expect(estimateSize('aaaa bbbb', 10, Infinity, 1)).toEqual({ w: 90, h: 12.5 });
  });
});

describe('HUD overlay fit', () => {
  it('runs a find toast for every catalogue treasure and the longest snack banner, plastic worm and ghost net included', () => {
    expect(TREASURE_TOASTS.map((toast) => toast.name)).toEqual(ALL_TREASURES.map((treasure) => treasure.name));
    expect(SNACK_BANNER_TEXTS).toContain(PLASTIC_WORM_BANNER);
    expect(SNACK_BANNER_TEXTS).toContain(GHOST_NET_BANNER);
    for (const text of SNACK_BANNER_TEXTS) expect(BANNER_TEXTS.snackBanner.length).toBeGreaterThanOrEqual(text.length);
  });

  it.each(['Firefly gold Paint shell', 'Firefly string lights', 'Golden lotus throne'])(
    'places the Area 3 "%s" find toast alone on every supported canvas without Go home',
    (name) => {
      const toast = TREASURE_TOASTS.find((candidate) => candidate.name === name);
      if (toast === undefined) throw new Error(`no find toast ${name}`);
      const problems = allHudCases()
        .filter((hud) => !hud.goHomeVisible)
        .flatMap((hud) => unplacedProblems(runCase(hud, { ids: ['findToast'], toast }), 'findToast'));
      expect(problems).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it(
    'keeps every placed overlay clear of the controls, the other overlays and the middle, at its text size, on every supported canvas',
    () => {
      const sets = allOverlaySets();
      const cases = allHudCases().flatMap((hud) => sets.map((set) => runCase(hud, set)));
      expect(cases.length).toBeGreaterThan(0);
      expect(cases.flatMap(clearProblems)).toEqual([]);
      expect(cases.flatMap(middleProblems)).toEqual([]);
      expect(cases.flatMap(textPxProblems)).toEqual([]);
      expect(cases.some(({ placements }) => placements.some(({ textPx }) => textPx === HUD.bannerRetryTextPx))).toBe(true);
      expect(cases.flatMap(shrinkProblems)).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it(
    'places each banner alone on every supported canvas, and each toast alone at least 375 tall or 520 wide',
    () => {
      // A banner with no place at 24 px retries at 20 px, so every banner alone finds a place on
      // every supported canvas. The toast never shrinks: below 375 tall and 520 wide (460 and 480
      // wide, 360 tall or less on this grid) a long toast may have no place outside the open
      // middle and wait (X10); the next test pins those waits. Long pond names wait the same way:
      // with Go home visible at 460 x 320 and 460 x 340, "Rainbow dragonfly wings" waits as
      // Area 5's "Tie-dye galaxy Paint shell" does, never overlapping. A toast with Go home visible
      // is unreachable: trip.ts banks a non-empty bag inside the ring in the same step, and
      // HudScene clears the toast on 'banked'.
      const huds = allHudCases();
      const roomy = huds.filter(({ view }) => view.cssH >= 375 || view.cssW >= 520);
      const toastCases = roomy
        .filter((hud) => !hud.goHomeVisible)
        .flatMap((hud) => ALL_TOASTS.map((toast) => runCase(hud, { ids: ['findToast'], toast })));
      const bannerCases = huds.flatMap((hud) => BANNER_IDS.map((id) => runCase(hud, { ids: [id], toast: null })));
      const problems = [
        ...toastCases.flatMap((overlayCase) => unplacedProblems(overlayCase, 'findToast')),
        ...bannerCases.flatMap((overlayCase) => unplacedProblems(overlayCase, overlayCase.set.ids[0])),
      ];
      expect(roomy.length).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it.each([
    {
      cssW: 460,
      cssH: 320,
      shown: ['findToast "Rainbow dragonfly wings"', 'findToast "Tie-dye galaxy Paint shell"'],
      hidden: [],
    },
    {
      cssW: 460,
      cssH: 340,
      shown: ['findToast "Rainbow dragonfly wings"', 'findToast "Tie-dye galaxy Paint shell"'],
      hidden: [],
    },
    { cssW: 460, cssH: 360, shown: [], hidden: [] },
    { cssW: 480, cssH: 320, shown: [], hidden: [] },
    { cssW: 480, cssH: 340, shown: [], hidden: [] },
    { cssW: 480, cssH: 360, shown: [], hidden: [] },
    { cssW: 320, cssH: 440, shown: [], hidden: [] },
    { cssW: 390, cssH: 440, shown: [], hidden: [] },
    { cssW: 667, cssH: 375, shown: [], hidden: [] },
    { cssW: 844, cssH: 360, shown: [], hidden: [] },
    { cssW: 1024, cssH: 360, shown: [], hidden: [] },
  ])(
    'holds exactly these messages, each shown alone, at $cssW x $cssH',
    ({ cssW, cssH, shown, hidden }) => {
      for (const panelWidth of PANEL_WIDTHS) {
        for (const goHomeVisible of [true, false]) {
          const hud = makeHudCase({ cssW, cssH }, panelWidth, goHomeVisible);
          expect(aloneWaits(hud), hud.label).toEqual(goHomeVisible ? shown : hidden);
        }
      }
    },
    FIT_TIMEOUT_MS,
  );

  it(
    'gives the highest-priority overlay of every 2 or 3 overlay combination the place it takes alone',
    () => {
      const sets = expandSets([...idSetsOfSize(2), ...idSetsOfSize(3)], COMBINATION_TOASTS);
      const cases = allHudCases().flatMap((hud) => sets.map((set) => runCase(hud, set)));
      const problems = cases.flatMap((overlayCase) => {
        const top = HUD_OVERLAY_PRIORITY.find((id) => overlayCase.set.ids.includes(id));
        if (top === undefined) return [`${overlayCase.label}: no active overlay`];
        const toast = top === 'findToast' ? overlayCase.set.toast : null;
        const alone = fitFor(runCase(overlayCase.hud, { ids: [top], toast }), top);
        const placed = fitFor(overlayCase, top);
        return JSON.stringify(placed) === JSON.stringify(alone) ? [] : [`${overlayCase.label}: ${top} moved or held`];
      });
      expect(problems).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])(
    'puts every toast on the top edge at the margin at $cssW x $cssH',
    (canvas) => {
      const sets = allOverlaySets().filter((set) => set.ids.includes('findToast'));
      const cases = canvasHudCases(canvas).flatMap((hud) => sets.map((set) => runCase(hud, set)));
      expect(cases.flatMap(topEdgeProblems)).toEqual([]);
    },
    FIT_TIMEOUT_MS,
  );

  it('keeps every placed toast clear of the swim pad and the Dash ring at 460x320 (PR #35 r4309441325)', () => {
    for (const panelWidth of PANEL_WIDTHS) {
      const hud = makeHudCase({ cssW: 460, cssH: 320 }, panelWidth, false);
      const rects = SORTED_TOASTS.map((toast) => rectFor(runCase(hud, { ids: ['findToast'], toast }), 'findToast'));
      const placed = rects.filter((rect): rect is Rect => rect !== null);
      expect(placed.length).toBeGreaterThan(0);
      for (const rect of placed) {
        expect(clears(rect, hud.view, [hud.controls.stickBounds, hud.controls.dash.bounds])).toBe(true);
      }
    }
  });
});
