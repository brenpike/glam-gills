import { describe, expect, it } from 'vitest';
import { exitClosedText } from './areaText';
import { isSupportedCanvas } from './cardFit';
import {
  FIND_TOAST,
  HUD,
  HUD_OVERLAY_PRIORITY,
  bannerBox,
  clears,
  controlKeepOuts,
  findToastBox,
  hudControls,
  PLAY_MIDDLE,
  placeHudOverlays,
  playMiddle,
  screenWaterRows,
  statusPanelsBox,
  type FindToastMeasure,
  type HudControls,
  type HudControlSizes,
  type HudOverlayId,
  type HudOverlayPlacement,
  type HudOverlayRequest,
  type HudView,
  type Rect,
  type ScreenWaterRows,
  type Size,
} from './hudLayout';
import { ALL_SNACKS_BANNER } from './tripText';

/**
 * Control and panel sizes as HudScene lays them out: Pause is the 48 x 48 icon-only tile; the
 * counter is 6 + 28 + 6 + a two-digit count + 6 wide and the legs panel 6 + 4 x 28 + 3 x 4 + 6, both
 * 48 tall.
 */
const SIZES: HudControlSizes = {
  pause: { w: 48, h: 48 },
  goHome: { w: 200, h: 64 },
  dash: { w: 80, h: 80 },
  dashCornerR: 24,
  counter: { w: 70, h: 48 },
  legs: { w: 136, h: 48 },
};

const SMALLEST: HudView = { cssW: 460, cssH: 320 };
const PORTRAIT: HudView = { cssW: 320, cssH: 440 };
const EPSILON = 1e-6;

/** Fake text measure: `chars` characters at `px`, wrapped into lines no wider than `wrapW`. */
function textAt(chars: number, px: number): (wrapW: number) => Size {
  const charW = px * 0.55;
  const lineH = px * 1.25;
  return (wrapW) => {
    const lines = Math.max(1, Math.ceil((chars * charW) / wrapW));
    return { w: lines > 1 ? wrapW : chars * charW, h: lines * lineH };
  };
}

/** Text lengths for one overlay set. */
interface OverlayTexts {
  hint: number;
  snackBanner: number;
  name: number;
  detail: number;
}

const SMALL_TEXTS: OverlayTexts = { hint: 10, snackBanner: 8, name: 6, detail: 10 };
const REAL_TEXTS: OverlayTexts = {
  hint: 47,
  snackBanner: Math.max(exitClosedText(16).length, ALL_SNACKS_BANNER.length),
  name: 16,
  detail: 16,
};
const LARGE_TEXTS: OverlayTexts = { hint: 140, snackBanner: 90, name: 60, detail: 40 };

/** Builds a fake find toast text measure from fake text lengths. */
function toastMeasureFor(texts: OverlayTexts): FindToastMeasure {
  return {
    nameAt: textAt(texts.name, FIND_TOAST.nameTextPx),
    detailAt: textAt(texts.detail, FIND_TOAST.detailTextPx),
  };
}

/** The banner overlays: every overlay but the find toast. */
type BannerId = Exclude<HudOverlayId, 'findToast'>;

/** Builds the panel-size function for banner `id` with its text at `px`, from fake text lengths. */
function bannerBoxFor(id: BannerId, texts: OverlayTexts, px: number): (maxW: number) => Size {
  const text = textAt(texts[id], px);
  return (maxW) => bannerBox(maxW, text);
}

/** Builds the panel-size function for overlay `id` from fake text lengths. */
function boxFor(id: HudOverlayId, texts: OverlayTexts): (maxW: number) => Size {
  if (id === 'findToast') {
    const measure = toastMeasureFor(texts);
    return (maxW) => findToastBox(maxW, measure);
  }
  return bannerBoxFor(id, texts, HUD.bannerTextPx);
}

/** Builds overlay requests for `ids` from fake text lengths; banners also get a retry measure. */
function requestsFor(ids: readonly HudOverlayId[], texts: OverlayTexts): HudOverlayRequest[] {
  return ids.map((id) => {
    if (id === 'findToast') return { id, boxAt: boxFor(id, texts) };
    return { id, boxAt: boxFor(id, texts), retryBoxAt: bannerBoxFor(id, texts, HUD.bannerRetryTextPx) };
  });
}

/** A panel-size function that always returns `size` and logs each call as `label` to `log`. */
function loggedBox(size: Size, label: string, log: string[]): (maxW: number) => Size {
  return () => {
    log.push(label);
    return size;
  };
}

/** Text size problems: a toast with a textPx, a placed banner not at 24 or 20, an unplaced one with one. */
function textPxProblems(placement: HudOverlayPlacement): string[] {
  const { id, rect, textPx } = placement;
  if (rect === null || id === 'findToast') return textPx === null ? [] : [`${id}: textPx ${textPx}`];
  const sizes: number[] = [HUD.bannerTextPx, HUD.bannerRetryTextPx];
  return textPx !== null && sizes.includes(textPx) ? [] : [`${id}: placed at textPx ${String(textPx)}`];
}

/** Every non-empty subset of the overlays. */
const OVERLAY_SUBSETS: HudOverlayId[][] = [1, 2, 3, 4, 5, 6, 7].map((mask) =>
  HUD_OVERLAY_PRIORITY.filter((_, index) => (mask & (1 << index)) !== 0),
);

/** Asserts every non-null placement clears the keep-outs and the other placements. */
function expectAllClear(view: HudView, keepOuts: readonly Rect[], rects: readonly (Rect | null)[]): void {
  const placed = rects.filter((rect): rect is Rect => rect !== null);
  for (const rect of placed) {
    const others = placed.filter((other) => other !== rect);
    expect(clears(rect, view, [...keepOuts, ...others])).toBe(true);
  }
}

/** Whether `rect` lies inside `frame`. */
function liesInside(rect: Rect, frame: Rect): boolean {
  return (
    rect.x >= frame.x - EPSILON &&
    rect.y >= frame.y - EPSILON &&
    rect.x + rect.w <= frame.x + frame.w + EPSILON &&
    rect.y + rect.h <= frame.y + frame.h + EPSILON
  );
}

/** Whether `rect` and `other` overlap with positive area. */
function overlaps(rect: Rect, other: Rect): boolean {
  return (
    rect.x < other.x + other.w - EPSILON &&
    other.x < rect.x + rect.w - EPSILON &&
    rect.y < other.y + other.h - EPSILON &&
    other.y < rect.y + rect.h - EPSILON
  );
}

/** The status row place: the top band, from the margin frame top to a gap above the play middle. */
function topBand(view: HudView): Rect {
  const top = HUD.margin;
  return { x: HUD.margin, y: top, w: view.cssW - 2 * HUD.margin, h: playMiddle(view).y - HUD.gap - top };
}

/** Sorted distinct cut points: `lo`, `hi` and every edge strictly between them. */
function cutsBetween(lo: number, hi: number, edges: readonly number[]): number[] {
  return [...new Set([lo, hi, ...edges.filter((edge) => edge > lo && edge < hi)])].sort((a, b) => a - b);
}

/**
 * Whether the part of `rect` inside the play middle lies on the snack counter and legs panels
 * themselves (no open water): every cell of the grid cut at the panel edges has its centre on a
 * panel.
 */
function coversOnlyPanelsInMiddle(rect: Rect, view: HudView, controls: HudControls): boolean {
  const middle = playMiddle(view);
  const panels = [controls.counter, controls.legs];
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

/**
 * Problems with one placement: over open water in the middle, or over the counter or legs anywhere
 * but the status row place in the top band.
 */
function placementProblems(view: HudView, controls: HudControls, placement: HudOverlayPlacement): string[] {
  const { id, rect, edge } = placement;
  if (rect === null) return edge === null ? [] : [`${id}: edge ${edge} without a rect`];
  const problems: string[] = [];
  if (!coversOnlyPanelsInMiddle(rect, view, controls)) problems.push(`${id} over open water in the middle`);
  const overPanels = overlaps(rect, controls.counter) || overlaps(rect, controls.legs);
  if (overPanels && (edge !== 'panel' || !liesInside(rect, topBand(view)))) problems.push(`${id} over the counter or legs`);
  return problems;
}

describe('hudControls', () => {
  const controls = hudControls(SMALLEST, SIZES);

  it('places Pause top-right and drops Go home a gap above the Dash ring on the smallest canvas', () => {
    // Go home's left edge (244) is under a gap right of the legs panel (234), so it drops.
    expect(controls.pause).toEqual({ x: 396, y: 16, w: 48, h: 48 });
    expect(controls.goHome.x).toBeCloseTo(244, 9);
    expect(controls.goHome.y).toBeCloseTo(109.75, 2);
    expect(controls.goHome.y + controls.goHome.h + HUD.gap).toBeCloseTo(controls.dash.bounds.y, 9);
  });

  it('places Go home under Pause when it clears the legs panel by a gap', () => {
    const wide = hudControls({ cssW: 800, cssH: 600 }, SIZES);
    expect(wide.pause).toEqual({ x: 736, y: 16, w: 48, h: 48 });
    expect(wide.goHome).toEqual({ x: 584, y: 76, w: 200, h: 64 });
  });

  it('puts the counter at the margin and the legs a gap to its right, on one row', () => {
    expect(controls.counter).toEqual({ x: 16, y: 16, w: 70, h: 48 });
    expect(controls.legs).toEqual({ x: 98, y: 16, w: 136, h: 48 });
  });

  it('centres a panel shorter than Pause down Pause\'s height', () => {
    const short = hudControls(SMALLEST, { ...SIZES, counter: { w: 70, h: 40 } });
    expect(short.counter).toEqual({ x: 16, y: 20, w: 70, h: 40 });
    expect(short.legs).toEqual({ x: 98, y: 16, w: 136, h: 48 });
  });

  it('rings Dash clear of its rounded corners, outer edge at the margin', () => {
    const { dash } = controls;
    expect(dash.ringR).toBeCloseTo((40 - 24) * Math.SQRT2 + 24 + HUD.ringGap, 9);
    expect(dash.bounds.y).toBeCloseTo(185.75, 2);
    expect(dash.bounds.x + dash.bounds.w).toBeCloseTo(460 - HUD.margin, 9);
    expect(dash.bounds.y + dash.bounds.h).toBeCloseTo(320 - HUD.margin, 9);
    expect(dash.button.x + dash.button.w / 2).toBeCloseTo(dash.centre.x, 9);
  });

  it('shrinks the swim pad clear of the status row, Go home and the Dash ring', () => {
    // The reserve top is Go home's bottom, 173.75, so the pad footprint is (320 - 173.75 - 12 - 16) / 2.
    const { stick, stickBounds } = controls;
    expect(stick.centre.x).toBeCloseTo(75.13, 2);
    expect(stick.centre.y).toBeCloseTo(244.87, 2);
    expect(stickBounds.w / 2).toBeCloseTo(59.13, 2);
    expect(stickBounds.y).toBeCloseTo(185.75, 2);
  });

  it('moves Go home to the top row when under Pause would reach the Dash ring', () => {
    const short = hudControls({ cssW: 800, cssH: 280 }, SIZES);
    expect(short.goHome.y).toBe(HUD.margin);
    expect(short.goHome.x).toBeCloseTo(short.pause.x - HUD.gap - SIZES.goHome.w, 9);
  });

  it('stacks Go home right under Pause when dropping would put it above there and the top row has no room either', () => {
    const tight = hudControls({ cssW: 400, cssH: 260 }, SIZES);
    expect(tight.dash.bounds.y - HUD.gap - SIZES.goHome.h).toBeLessThan(HUD.margin + SIZES.pause.h + HUD.gap);
    expect(tight.goHome.x).toBe(400 - HUD.margin - SIZES.goHome.w);
    expect(tight.goHome.y).toBeCloseTo(HUD.margin + SIZES.pause.h + HUD.gap, 9);
  });
});

describe('controlKeepOuts', () => {
  const controls = hudControls(SMALLEST, SIZES);

  it('keeps out Go home only while it shows', () => {
    const shown = controlKeepOuts(controls, { goHomeVisible: true });
    const hidden = controlKeepOuts(controls, { goHomeVisible: false });
    expect(shown).toEqual([controls.pause, controls.goHome, controls.dash.bounds, controls.stickBounds]);
    expect(hidden).toEqual([controls.pause, controls.dash.bounds, controls.stickBounds]);
  });

  it('leaves out the swim pad capture zone', () => {
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
    expect(keepOuts).not.toContainEqual(controls.stick.zone);
  });
});

describe('overlay boxes', () => {
  it('sizes a banner around its text with the wrap at least bannerMinWrap', () => {
    const widths: number[] = [];
    const text = (wrapW: number): Size => {
      widths.push(wrapW);
      return { w: 100, h: 30 };
    };
    expect(bannerBox(400, text)).toEqual({ w: 124, h: 54 });
    expect(bannerBox(100, text)).toEqual({ w: 124, h: 54 });
    expect(widths).toEqual([376, HUD.bannerMinWrap]);
  });

  it('wraps the toast name and detail at the column room, clamped', () => {
    const nameWraps: number[] = [];
    const detailWraps: number[] = [];
    const measure: FindToastMeasure = {
      nameAt: (wrapW) => {
        nameWraps.push(wrapW);
        return { w: 90, h: 25 };
      },
      detailAt: (wrapW) => {
        detailWraps.push(wrapW);
        return { w: 70, h: 22.5 };
      },
    };
    expect(findToastBox(728, measure)).toEqual({ w: 8 + 32 + 8 + 100 + 8, h: 4 + 25 + 24 + 4, nameWrapW: 360, detailWrapW: 360 });
    expect(findToastBox(300, measure)).toMatchObject({ nameWrapW: 244, detailWrapW: 214 });
    expect(findToastBox(100, measure)).toMatchObject({ nameWrapW: FIND_TOAST.nameMinW, detailWrapW: FIND_TOAST.detailMinW });
    expect(nameWraps).toEqual([360, 244, FIND_TOAST.nameMinW]);
    expect(detailWraps).toEqual([360, 214, FIND_TOAST.detailMinW]);
  });

  it('sizes the toast around its content, never clamped to maxW, and at least the icon tall', () => {
    const measure: FindToastMeasure = { nameAt: () => ({ w: 300, h: 5 }), detailAt: () => ({ w: 10, h: 5 }) };
    const box = findToastBox(150, measure);
    expect(box.w).toBe(2 * FIND_TOAST.padX + FIND_TOAST.iconPx + FIND_TOAST.columnGap + 300);
    expect(box.w).toBeGreaterThan(150);
    expect(box.h).toBe(FIND_TOAST.iconPx + 2 * FIND_TOAST.padY);
  });

  it('widens the toast for a long detail line beside the badge', () => {
    const measure: FindToastMeasure = { nameAt: () => ({ w: 50, h: 25 }), detailAt: () => ({ w: 200, h: 45 }) };
    const box = findToastBox(728, measure);
    expect(box.w).toBe(2 * FIND_TOAST.padX + FIND_TOAST.iconPx + FIND_TOAST.columnGap + FIND_TOAST.badgePx + FIND_TOAST.badgeGap + 200);
    expect(box.h).toBe(2 * FIND_TOAST.padY + 25 + 45);
  });

  it('sizes a banner around its text even when that is wider than maxW', () => {
    const text = (): Size => ({ w: 200, h: 30 });
    expect(bannerBox(100, text).w).toBe(200 + 2 * HUD.bannerPad);
  });
});

describe('playMiddle', () => {
  it.each([
    { note: 'tiny, height-limited', view: { cssW: 120, cssH: 90 }, top: 37.85, bottom: 61.65 },
    { note: 'smallest landscape', view: { cssW: 460, cssH: 320 }, top: 6056 / 45, bottom: 219.2 },
    { note: 'height-limited', view: { cssW: 667, cssH: 375 }, top: 3785 / 24, bottom: 2055 / 8 },
    { note: 'height-limited', view: { cssW: 844, cssH: 360 }, top: 151.4, bottom: 246.6 },
    { note: 'height-limited', view: { cssW: 800, cssH: 600 }, top: 757 / 3, bottom: 411 },
    { note: 'zoom switch point', view: { cssW: 320, cssH: 360 }, top: 151.4, bottom: 246.6 },
    { note: 'just height-limited', view: { cssW: 321, cssH: 360 }, top: 151.4, bottom: 246.6 },
    { note: 'just width-limited', view: { cssW: 320, cssH: 361 }, top: 151.9, bottom: 247.1 },
    { note: 'smallest portrait, letterboxed', view: { cssW: 320, cssH: 440 }, top: 191.4, bottom: 286.6 },
    { note: 'portrait, letterboxed', view: { cssW: 390, cssH: 440 }, top: 29623 / 160, bottom: 48187 / 160 },
    { note: 'tall portrait, letterboxed', view: { cssW: 320, cssH: 800 }, top: 371.4, bottom: 466.6 },
    { note: 'tall portrait, letterboxed', view: { cssW: 414, cssH: 932 }, top: 343199 / 800, bottom: 441731 / 800 },
  ])(
    'spans 30% to 70% of the water on screen at $view.cssW x $view.cssH ($note)',
    ({ view, top, bottom }) => {
      const rect = playMiddle(view);
      expect(rect.x).toBe(HUD.margin);
      expect(rect.w).toBe(view.cssW - 2 * HUD.margin);
      expect(rect.y).toBeCloseTo(top, 9);
      expect(rect.y + rect.h).toBeCloseTo(bottom, 9);
    },
  );

  it('lies inside 30% to 70% of the canvas height on every supported canvas', () => {
    const widths = [320, 360, 390, 414, 460, 568, 667, 800, 844, 1024, 1280, 1920];
    const heights = [320, 340, 360, 375, 414, 440, 568, 600, 667, 768, 844, 932, 1080, 1366];
    const canvases = widths.flatMap((cssW) => heights.map((cssH) => ({ cssW, cssH })));
    const supported = canvases.filter(({ cssW, cssH }) => isSupportedCanvas(cssW, cssH));
    expect(supported.length).toBeGreaterThan(0);
    for (const view of supported) {
      const rect = playMiddle(view);
      expect(rect.y, `${view.cssW} x ${view.cssH}`).toBeGreaterThanOrEqual(0.3 * view.cssH - EPSILON);
      expect(rect.y + rect.h, `${view.cssW} x ${view.cssH}`).toBeLessThanOrEqual(0.7 * view.cssH + EPSILON);
      expect(rect.h).toBeGreaterThan(0);
    }
  });
});

describe('screenWaterRows', () => {
  const view = { cssW: 400, cssH: 300 };
  const tallRows = { surf: 80, bedTop: 678 };

  it('measures the water from the camera top at zoom 1', () => {
    expect(screenWaterRows(view, tallRows, 0, 1)).toEqual({ top: 80, bottom: 300 });
    expect(screenWaterRows(view, tallRows, 40, 1)).toEqual({ top: 40, bottom: 300 });
  });

  it('clamps the top to the screen top once the water line has scrolled off', () => {
    expect(screenWaterRows(view, tallRows, 200, 1)).toEqual({ top: 0, bottom: 300 });
    expect(screenWaterRows(view, tallRows, 80, 1).top).toBe(0);
  });

  it('puts the bed on screen once the camera reaches the bottom of the area', () => {
    expect(screenWaterRows(view, tallRows, 420, 1)).toEqual({ top: 0, bottom: 258 });
    expect(screenWaterRows(view, tallRows, 678, 1).bottom).toBe(0);
  });

  it('clamps the bottom to the screen bottom while the bed is below the view', () => {
    expect(screenWaterRows(view, tallRows, 378, 1).bottom).toBe(300);
    expect(screenWaterRows(view, tallRows, 379, 1).bottom).toBe(299);
  });

  it('scales world rows by the zoom', () => {
    expect(screenWaterRows(view, { surf: 80, bedTop: 400 }, 20, 0.5)).toEqual({ top: 30, bottom: 190 });
  });

  it('matches the canal rows when the camera is centred on the world, letterbox included', () => {
    for (const canvas of [{ cssW: 320, cssH: 440 }, { cssW: 800, cssH: 600 }, { cssW: 414, cssH: 932 }]) {
      const rows = { surf: 80, bedTop: 318 };
      const fitZoom = Math.min(canvas.cssH / 360, canvas.cssW / 320);
      const cameraTop = 180 - canvas.cssH / (2 * fitZoom);
      const water = screenWaterRows({ cssW: canvas.cssW, cssH: 100000 }, rows, cameraTop, fitZoom);
      const middle = playMiddle({ ...canvas, waterRows: water });
      const canal = playMiddle(canvas);
      expect(middle.y).toBeCloseTo(canal.y, 9);
      expect(middle.h).toBeCloseTo(canal.h, 9);
    }
  });
});

describe('playMiddle with scrolled water rows', () => {
  const view = { cssW: 400, cssH: 300 };
  const tallRows = { surf: 80, bedTop: 678 };

  /** The 30% to 70% band of a screen-water-rows pair. */
  function bandOf(waterRows: ScreenWaterRows): { top: number; bottom: number } {
    const span = waterRows.bottom - waterRows.top;
    return { top: waterRows.top + 0.3 * span, bottom: waterRows.top + 0.7 * span };
  }

  it.each([
    { note: 'top of a 2-screen-tall area', cameraTop: 0, top: 146, bottom: 234 },
    { note: 'middle of a 2-screen-tall area', cameraTop: 210, top: 90, bottom: 210 },
    { note: 'bottom of a 2-screen-tall area', cameraTop: 420, top: 77.4, bottom: 180.6 },
  ])('measures the middle on screen at the $note', ({ cameraTop, top, bottom }) => {
    const waterRows = screenWaterRows(view, tallRows, cameraTop, 1);
    const rect = playMiddle({ ...view, waterRows });
    expect(rect.x).toBe(HUD.margin);
    expect(rect.w).toBe(view.cssW - 2 * HUD.margin);
    expect(rect.y).toBeCloseTo(top, 9);
    expect(rect.y + rect.h).toBeCloseTo(bottom, 9);
    expect(rect.y).toBeCloseTo(bandOf(waterRows).top, 9);
  });

  it('puts the band fractions inside the water rows it is given', () => {
    const waterRows = { top: 50, bottom: 250 };
    const rect = playMiddle({ ...view, waterRows });
    expect(rect.y).toBeCloseTo(50 + PLAY_MIDDLE.topFraction * 200, 9);
    expect(rect.y + rect.h).toBeCloseTo(50 + PLAY_MIDDLE.bottomFraction * 200, 9);
    expect(rect.y).toBeGreaterThanOrEqual(waterRows.top);
    expect(rect.y + rect.h).toBeLessThanOrEqual(waterRows.bottom);
  });

  it('equals the canal result when waterRows is unset', () => {
    for (const canvas of [SMALLEST, PORTRAIT, { cssW: 800, cssH: 600 }, { cssW: 414, cssH: 932 }]) {
      expect(playMiddle({ ...canvas, waterRows: undefined })).toEqual(playMiddle(canvas));
    }
  });

  it('keeps overlays clear of the scrolled middle', () => {
    const waterRows = screenWaterRows({ cssW: 800, cssH: 600 }, tallRows, 210, 1);
    const tall = { cssW: 800, cssH: 600, waterRows };
    const controls = hudControls(tall, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: false });
    const placed = placeHudOverlays(tall, controls, keepOuts, requestsFor(HUD_OVERLAY_PRIORITY, SMALL_TEXTS));
    expectAllClear(tall, keepOuts, placed.map((entry) => entry.rect));
    expect(placed.flatMap((entry) => placementProblems(tall, controls, entry))).toEqual([]);
  });
});

describe('statusPanelsBox', () => {
  it('bounds the counter and legs', () => {
    expect(statusPanelsBox(hudControls(SMALLEST, SIZES))).toEqual({ x: 16, y: 16, w: 218, h: 48 });
  });
});

describe('placeHudOverlays', () => {
  it('lists the priority highest first', () => {
    expect(HUD_OVERLAY_PRIORITY).toEqual(['findToast', 'snackBanner', 'hint']);
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 1024, cssH: 768 },
  ])('puts the toast on the top edge at $cssW x $cssH, centred at the margin', (view) => {
    const controls = hudControls(view, SIZES);
    for (const goHomeVisible of [true, false]) {
      const keepOuts = controlKeepOuts(controls, { goHomeVisible });
      const [placed] = placeHudOverlays(view, controls, keepOuts, requestsFor(['findToast'], REAL_TEXTS));
      const rect = placed.rect as Rect;
      expect(placed.edge).toBe('top');
      expect(rect.y).toBe(HUD.margin);
      expect(rect.x + rect.w / 2).toBeCloseTo(view.cssW / 2, 9);
    }
  });

  it('puts the toast on the bottom edge when the top is blocked', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const topBlock = { x: 0, y: 0, w: 800, h: playMiddle(view).y };
    const keepOuts = [...controlKeepOuts(controls, { goHomeVisible: false }), topBlock];
    const [placed] = placeHudOverlays(view, controls, keepOuts, requestsFor(['findToast'], REAL_TEXTS));
    const rect = placed.rect as Rect;
    expect(placed.edge).toBe('bottom');
    expect(rect.y + rect.h).toBe(view.cssH - HUD.margin);
    expect(rect.x + rect.w / 2).toBeCloseTo(view.cssW / 2, 9);
  });

  it('puts a short toast over the status panels above the middle at 460 x 320', () => {
    const controls = hudControls(SMALLEST, SIZES);
    for (const goHomeVisible of [true, false]) {
      const keepOuts = controlKeepOuts(controls, { goHomeVisible });
      const [placed] = placeHudOverlays(SMALLEST, controls, keepOuts, requestsFor(['findToast'], SMALL_TEXTS));
      const rect = placed.rect as Rect;
      expect(placed.edge).toBe('panel');
      expect(liesInside(rect, topBand(SMALLEST))).toBe(true);
      expect(rect).toMatchObject({ x: HUD.margin, y: HUD.margin });
      expect(rect.y + rect.h).toBeLessThanOrEqual(playMiddle(SMALLEST).y);
    }
  });

  it('shows a real-length toast at 460 x 320 on one line over the status row, above the middle', () => {
    // The top band is 428 wide, so the 16-character name (176) and the badge and detail line
    // (24 + 6 + 158.4) need no wrap: 8 + 32 + 8 + 188.4 + 8 wide, 4 + 25 + 24 + 4 tall.
    const controls = hudControls(SMALLEST, SIZES);
    for (const goHomeVisible of [true, false]) {
      const keepOuts = controlKeepOuts(controls, { goHomeVisible });
      const [placed] = placeHudOverlays(SMALLEST, controls, keepOuts, requestsFor(['findToast'], REAL_TEXTS));
      const rect = placed.rect as Rect;
      expect(placed.edge).toBe('panel');
      expect(rect.x).toBe(HUD.margin);
      expect(rect.y).toBe(HUD.margin);
      expect(rect.w).toBeCloseTo(244.4, 9);
      expect(rect.h).toBe(57);
      expect(rect.y + rect.h).toBeLessThanOrEqual(playMiddle(SMALLEST).y);
    }
  });

  it('holds a toast at 460 x 320 rather than reach into the middle', () => {
    const controls = hudControls(SMALLEST, SIZES);
    const box = (): Size => ({ w: 206, h: 130 });
    for (const goHomeVisible of [true, false]) {
      const keepOuts = controlKeepOuts(controls, { goHomeVisible });
      const [placed] = placeHudOverlays(SMALLEST, controls, keepOuts, [{ id: 'findToast', boxAt: box }]);
      expect(placed).toEqual({ id: 'findToast', rect: null, edge: null, textPx: null });
    }
    const reaching = { x: HUD.margin, y: HUD.margin, w: 206, h: 130 };
    expect(reaching.y + reaching.h).toBeGreaterThan(playMiddle(SMALLEST).y);
    expect(coversOnlyPanelsInMiddle(reaching, SMALLEST, controls)).toBe(false);
  });

  it('never puts an overlay over open water in the middle from a panel place (finding a336ac95)', () => {
    // Before the fix, the status panels place took a box whose lower part covered the open water of
    // the middle. The panel place is now the top band, which ends a gap above the middle (179.4 at
    // 320 x 440), so this box, 180 tall from the margin, would reach the middle and has no place.
    const controls = hudControls(PORTRAIT, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: false });
    const box = (): Size => ({ w: 206, h: 180 });
    const [placed] = placeHudOverlays(PORTRAIT, controls, keepOuts, [{ id: 'findToast', boxAt: box }]);
    expect(placed).toEqual({ id: 'findToast', rect: null, edge: null, textPx: null });
    const offending = { x: HUD.margin, y: HUD.margin, w: 206, h: 180 };
    expect(coversOnlyPanelsInMiddle(offending, PORTRAIT, controls)).toBe(false);
  });

  it('shows a short toast at 320 x 440 on the top edge, centred, a gap under the status row', () => {
    const controls = hudControls(PORTRAIT, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: false });
    const [placed] = placeHudOverlays(PORTRAIT, controls, keepOuts, requestsFor(['findToast'], SMALL_TEXTS));
    const rect = placed.rect as Rect;
    expect(placed.edge).toBe('top');
    expect(rect).toEqual({ x: 67.5, y: 76, w: 185, h: 57 });
    expect(rect.y).toBe(controls.legs.y + controls.legs.h + HUD.gap);
    expect(rect.y + rect.h).toBeLessThanOrEqual(playMiddle(PORTRAIT).y - HUD.gap);
  });

  it('fills the top band over the status row, ending a gap above the middle, and no further', () => {
    const view = { cssW: 460, cssH: 320 };
    const controls = hudControls(view, SIZES);
    const band = topBand(view);
    const [placed] = placeHudOverlays(view, controls, [], [{ id: 'findToast', boxAt: () => ({ w: band.w, h: band.h }) }]);
    expect(placed.edge).toBe('panel');
    expect(placed.rect).toEqual(band);
    expect(band.y + band.h).toBeCloseTo(playMiddle(view).y - HUD.gap, 9);
    expect(overlaps(band, controls.counter) && overlaps(band, controls.legs)).toBe(true);
    const taller = (): Size => ({ w: band.w, h: band.h + 1 });
    const [held] = placeHudOverlays(view, controls, [], [{ id: 'findToast', boxAt: taller }]);
    expect(held).toEqual({ id: 'findToast', rect: null, edge: null, textPx: null });
  });

  it('answers in request order', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const placed = placeHudOverlays(view, controls, [], requestsFor(['hint', 'findToast'], SMALL_TEXTS));
    expect(placed.map((entry) => entry.id)).toEqual(['hint', 'findToast']);
    expect(placed.every((entry) => entry.rect !== null)).toBe(true);
  });

  it('answers a repeated id with null, so at most one toast shows', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const placed = placeHudOverlays(view, controls, [], requestsFor(['findToast', 'hint', 'findToast'], SMALL_TEXTS));
    expect(placed.map((entry) => entry.id)).toEqual(['findToast', 'hint', 'findToast']);
    expect(placed[0].rect).not.toBeNull();
    expect(placed[2]).toEqual({ id: 'findToast', rect: null, edge: null, textPx: null });
  });

  it('sizes each overlay once per maxW', () => {
    const controls = hudControls(SMALLEST, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
    const calls: number[] = [];
    const box = boxFor('findToast', LARGE_TEXTS);
    const counted = (maxW: number): Size => {
      calls.push(maxW);
      return box(maxW);
    };
    placeHudOverlays(SMALLEST, controls, keepOuts, [{ id: 'findToast', boxAt: counted }]);
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls).size).toBe(calls.length);
  });

  it('keeps every overlay clear of controls, overlays, the middle and the counter and legs across canvases', () => {
    const widths = [200, 320, 460, 568, 800, 1024, 1280];
    const heights = [150, 240, 320, 440, 600, 768, 960];
    for (const cssW of widths) {
      for (const cssH of heights) {
        const view = { cssW, cssH };
        const controls = hudControls(view, SIZES);
        for (const goHomeVisible of [true, false]) {
          const keepOuts = controlKeepOuts(controls, { goHomeVisible });
          for (const texts of [SMALL_TEXTS, REAL_TEXTS, LARGE_TEXTS]) {
            for (const ids of OVERLAY_SUBSETS) {
              const placed = placeHudOverlays(view, controls, keepOuts, requestsFor(ids, texts));
              expectAllClear(view, keepOuts, placed.map((entry) => entry.rect));
              expect(placed.flatMap((entry) => placementProblems(view, controls, entry))).toEqual([]);
            }
          }
        }
      }
    }
  });

  it('never places the toast in a rect narrower than its panel', () => {
    const widths = [200, 320, 460, 568, 800, 1024];
    const heights = [150, 240, 320, 440, 600, 768];
    for (const cssW of widths) {
      for (const cssH of heights) {
        const view = { cssW, cssH };
        const controls = hudControls(view, SIZES);
        for (const goHomeVisible of [true, false]) {
          const keepOuts = controlKeepOuts(controls, { goHomeVisible });
          for (const texts of [SMALL_TEXTS, REAL_TEXTS, LARGE_TEXTS]) {
            const measure = toastMeasureFor(texts);
            for (const ids of OVERLAY_SUBSETS.filter((subset) => subset.includes('findToast'))) {
              const placed = placeHudOverlays(view, controls, keepOuts, requestsFor(ids, texts));
              const rect = placed.find((entry) => entry.id === 'findToast')?.rect ?? null;
              if (rect === null) continue;
              const box = findToastBox(rect.w, measure);
              expect(rect.w).toBeGreaterThanOrEqual(box.w - EPSILON);
              expect(rect.h).toBeGreaterThanOrEqual(box.h - EPSILON);
            }
          }
        }
      }
    }
  });

  it('returns null on a tiny canvas instead of a clipped rect', () => {
    const view = { cssW: 120, cssH: 90 };
    const controls = hudControls(view, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: false });
    const placed = placeHudOverlays(view, controls, keepOuts, requestsFor(HUD_OVERLAY_PRIORITY, SMALL_TEXTS));
    expect(placed.map((entry) => [entry.rect, entry.edge])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it('gives the only room to the higher-priority overlay', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const keepOuts: Rect[] = [{ x: 0, y: 0, w: 800, h: 420 }];
    const box = (): Size => ({ w: 400, h: 140 });
    const ids: HudOverlayId[] = ['hint', 'snackBanner', 'findToast'];
    const all = placeHudOverlays(view, controls, keepOuts, ids.map((id) => ({ id, boxAt: box })));
    expect(all.map((entry) => entry.rect !== null)).toEqual([false, false, true]);
    const banners = placeHudOverlays(view, controls, keepOuts, [
      { id: 'hint', boxAt: box },
      { id: 'snackBanner', boxAt: box },
    ]);
    expect(banners.map((entry) => entry.rect !== null)).toEqual([false, true]);
  });

  it('tries every place at 24 px before any place at 20 px', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const keepOuts = [...controlKeepOuts(controls, { goHomeVisible: false }), { x: 0, y: 90, w: 800, h: 162 }];
    const log: string[] = [];
    const request: HudOverlayRequest = {
      id: 'snackBanner',
      boxAt: loggedBox({ w: 150, h: 120 }, 'box', log),
      retryBoxAt: loggedBox({ w: 150, h: 40 }, 'retry', log),
    };
    const [placed] = placeHudOverlays(view, controls, keepOuts, [request]);
    expect(placed.edge).toBe('bottom');
    expect(placed.textPx).toBe(HUD.bannerTextPx);
    expect(placed.rect).toMatchObject({ w: 150, h: 120 });
    expect(log).not.toContain('retry');
    const [onTop] = placeHudOverlays(view, controls, keepOuts, [{ id: 'snackBanner', boxAt: () => ({ w: 150, h: 40 }) }]);
    expect(onTop.edge).toBe('top');
  });

  it('never measures a banner at 20 px when it fits at 24 px', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
    for (const id of ['snackBanner', 'hint'] as const) {
      const log: string[] = [];
      const request = { id, boxAt: boxFor(id, REAL_TEXTS), retryBoxAt: loggedBox({ w: 10, h: 10 }, 'retry', log) };
      const [placed] = placeHudOverlays(view, controls, keepOuts, [request]);
      expect(placed.rect).not.toBeNull();
      expect(placed.textPx).toBe(HUD.bannerTextPx);
      expect(log).toEqual([]);
    }
  });

  it('places a banner at 20 px when it has no place at 24 px, after every 24 px try', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const keepOuts = [...controlKeepOuts(controls, { goHomeVisible: false }), { x: 0, y: 90, w: 800, h: 510 }];
    for (const id of ['snackBanner', 'hint'] as const) {
      const log: string[] = [];
      const request: HudOverlayRequest = {
        id,
        boxAt: loggedBox({ w: 150, h: 120 }, 'box', log),
        retryBoxAt: loggedBox({ w: 150, h: 40 }, 'retry', log),
      };
      const [placed] = placeHudOverlays(view, controls, keepOuts, [request]);
      expect(placed.edge).toBe('top');
      expect(placed.textPx).toBe(HUD.bannerRetryTextPx);
      expect(placed.rect).toMatchObject({ w: 150, h: 40 });
      expect(log.indexOf('retry')).toBeGreaterThan(log.lastIndexOf('box'));
    }
  });

  it('places a banner with real text at 20 px only where it has no place at 24 px', () => {
    // The block leaves a strip from the margin down to between the 20 px and 24 px heights at the
    // full frame width. Beside the status row the banner wraps to two lines at both sizes, too tall
    // for the strip, so only the status row place over the panels takes it, at 20 px.
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const stripW = view.cssW - 2 * HUD.margin;
    const box = boxFor('snackBanner', REAL_TEXTS)(stripW);
    const retryBox = bannerBoxFor('snackBanner', REAL_TEXTS, HUD.bannerRetryTextPx)(stripW);
    expect(retryBox.h).toBeLessThan(box.h);
    const stripH = (box.h + retryBox.h) / 2;
    const besideRowW = view.cssW - HUD.margin - (controls.legs.x + controls.legs.w + HUD.gap);
    expect(bannerBoxFor('snackBanner', REAL_TEXTS, HUD.bannerRetryTextPx)(besideRowW).h).toBeGreaterThan(stripH);
    const blockTop = HUD.margin + stripH + HUD.gap;
    const keepOuts = [{ x: 0, y: blockTop, w: view.cssW, h: view.cssH - blockTop }];
    const [placed] = placeHudOverlays(view, controls, keepOuts, requestsFor(['snackBanner'], REAL_TEXTS));
    expect(placed.edge).toBe('panel');
    expect(placed.textPx).toBe(HUD.bannerRetryTextPx);
    expect(placed.rect).toEqual({ x: HUD.margin, y: HUD.margin, w: retryBox.w, h: retryBox.h });
    const [held] = placeHudOverlays(view, controls, keepOuts, [{ id: 'snackBanner', boxAt: boxFor('snackBanner', REAL_TEXTS) }]);
    expect(held).toEqual({ id: 'snackBanner', rect: null, edge: null, textPx: null });
  });

  it('never shrinks the find toast, even when given a retry measure', () => {
    const view = { cssW: 800, cssH: 600 };
    const controls = hudControls(view, SIZES);
    const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
    const log: string[] = [];
    const request: HudOverlayRequest = {
      id: 'findToast',
      boxAt: () => ({ w: 2000, h: 2000 }),
      retryBoxAt: loggedBox({ w: 10, h: 10 }, 'retry', log),
    };
    const [placed] = placeHudOverlays(view, controls, keepOuts, [request]);
    expect(placed).toEqual({ id: 'findToast', rect: null, edge: null, textPx: null });
    expect(log).toEqual([]);
  });

  it('reports no text size for the toast and 24 or 20 px for placed banners across canvases', () => {
    const widths = [200, 320, 460, 800, 1024];
    const heights = [150, 240, 320, 440, 600];
    const textSizes = new Set<number | null>();
    for (const cssW of widths) {
      for (const cssH of heights) {
        const view = { cssW, cssH };
        const controls = hudControls(view, SIZES);
        const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
        for (const texts of [SMALL_TEXTS, REAL_TEXTS, LARGE_TEXTS]) {
          for (const ids of OVERLAY_SUBSETS) {
            const placed = placeHudOverlays(view, controls, keepOuts, requestsFor(ids, texts));
            expect(placed.flatMap(textPxProblems), `${cssW} x ${cssH}`).toEqual([]);
            for (const entry of placed) textSizes.add(entry.textPx);
          }
        }
      }
    }
    expect(textSizes).toContain(HUD.bannerTextPx);
  });

  it('gives the highest-priority overlay the place it gets alone', () => {
    const widths = [320, 460, 800, 1024];
    const heights = [320, 440, 600];
    for (const cssW of widths) {
      for (const cssH of heights) {
        const view = { cssW, cssH };
        const controls = hudControls(view, SIZES);
        const keepOuts = controlKeepOuts(controls, { goHomeVisible: true });
        for (const texts of [SMALL_TEXTS, REAL_TEXTS, LARGE_TEXTS]) {
          for (const ids of OVERLAY_SUBSETS) {
            const top = ids[0];
            const placed = placeHudOverlays(view, controls, keepOuts, requestsFor(ids, texts));
            const [alone] = placeHudOverlays(view, controls, keepOuts, requestsFor([top], texts));
            expect(placed.find((entry) => entry.id === top), `${cssW} x ${cssH} [${ids.join(', ')}]`).toEqual(alone);
          }
        }
      }
    }
  });
});

describe('clears', () => {
  const view = { cssW: 400, cssH: 300 };

  it('needs the rect inside the margin frame', () => {
    expect(clears({ x: 16, y: 16, w: 368, h: 268 }, view, [])).toBe(true);
    expect(clears({ x: 15, y: 16, w: 10, h: 10 }, view, [])).toBe(false);
    expect(clears({ x: 300, y: 16, w: 85, h: 10 }, view, [])).toBe(false);
  });

  it('needs a gap from every obstacle', () => {
    const obstacle = { x: 100, y: 100, w: 50, h: 50 };
    expect(clears({ x: 162, y: 100, w: 20, h: 20 }, view, [obstacle])).toBe(true);
    expect(clears({ x: 161, y: 100, w: 20, h: 20 }, view, [obstacle])).toBe(false);
  });

  it('rejects non-finite rects', () => {
    expect(clears({ x: Number.NaN, y: 20, w: 10, h: 10 }, view, [])).toBe(false);
  });
});
