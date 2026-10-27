import { describe, expect, it } from 'vitest';
import { areaLabel } from './areaText';
import { isSupportedCanvas } from './cardFit';
import { hubFit, modeTankFrame, startHubMenu, stepHubMenu, type HubFit, type HubFitSizes, type HubMenuState } from './hubFit';
import type { HudView, Rect, Size } from './hudLayout';
import { HUB_STARS_BADGE } from './starsUi';
import { TANK, tankBoxCss, tankFrame, tankFrameAt, topKeepClearCss, type TankFrame } from './tank';
import { COLLECTION_BOOK_LABEL } from './tankText';
import { HUB_BUTTONS, MENU_BUTTON_LOOK, UI, hubButtonCompactLook, hubButtonLook, type HubAction } from './tankUi';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;
const TITLE_PX = 34;
const BODY_PX = 18;
const HUB_TITLE = 'Home Tank';

const MIN_TARGET_PX = 48;
const PRIMARY_H = 64;
const EPS = 1e-9;

/** The folded Refuge nudge's overhang past the Menu button's top-right corner: REFUGE_NUDGE_SIZE / 2 - REFUGE_NUDGE_INSET in src/art/drawRefuge.ts. */
const NUDGE_OVERHANG = 3;

/** The Menu button's body as the scene builds it: MENU_BUTTON_LOOK. */
const MENU_BUTTON: Size = { w: MENU_BUTTON_LOOK.w, h: MENU_BUTTON_LOOK.h };

/** The ND-4 named sizes (issue #148), each tried upright and turned sideways. */
const NAMED_SIZES: readonly [number, number][] = [
  [320, 568], [360, 640], [375, 667], [390, 844], [393, 852], [412, 915], [414, 896], [430, 932], [768, 1024],
  [810, 1080], [820, 1180], [460, 320], [320, 440], [340, 440], [480, 360], [1024, 768], [1280, 720],
  [1366, 768], [1440, 900], [1536, 864], [1920, 1080],
];

/** A hub button as the scene builds it: the bodies of hubButtonLook() and hubButtonCompactLook() for its label. */
function hubAction(id: string, label: string, primary: boolean): HubAction {
  const { w, h } = hubButtonLook({ label, primary });
  const compact = hubButtonCompactLook({ label, primary });
  return { id, w, h, compact: { w: compact.w, h: compact.h } };
}

const HUB_ACTIONS: readonly HubAction[] = HUB_BUTTONS.map(({ id, label, primary }) => hubAction(id, label, primary));

/** One line of bold text at `px`, estimated wide. */
function lineSize(text: string, px: number): Size {
  return { w: text.length * BOLD_EM * px, h: LINE_HEIGHT_EM * px };
}

/** The name panel as the scene measures it: one line at the margin width less the pad, plus the pad each side. */
function titleSize(view: HudView): Size {
  const line = lineSize(HUB_TITLE, TITLE_PX);
  return { w: Math.min(view.cssW - 2 * UI.margin - 2 * UI.pad, line.w) + 2 * UI.pad, h: line.h + 2 * UI.pad };
}

/** The longest hub focus caption at its drawn size. */
const HUB_CAPTION: Size = {
  w: lineSize(COLLECTION_BOOK_LABEL, BODY_PX).w + 2 * UI.pad,
  h: lineSize(COLLECTION_BOOK_LABEL, BODY_PX).h + 2 * UI.pad,
};

/** The best-stars badge showing `text`, in both shapes (the starsUi.test estimates). */
function badgeSizes(text: string): HubFitSizes['badge'] {
  const label = lineSize(text, HUB_STARS_BADGE.labelPx);
  const stars: Size = { w: 3 * HUB_STARS_BADGE.starPx + 2 * HUB_STARS_BADGE.starGap, h: HUB_STARS_BADGE.starPx };
  const pad = 2 * HUB_STARS_BADGE.pad;
  return {
    beside: { w: pad + label.w + HUB_STARS_BADGE.gap + stars.w, h: pad + Math.max(label.h, stars.h) },
    stacked: { w: pad + Math.max(label.w, stars.w), h: pad + label.h + HUB_STARS_BADGE.gap + stars.h },
  };
}

/** The shortest and the longest area labels the badge shows. */
const BADGE_LABELS: readonly string[] = [areaLabel(1), areaLabel(10)];

/** The hub sizes the scene measures on `view`, with the badge showing `badgeText`. */
function sizesOn(view: HudView, badgeText: string = areaLabel(1)): HubFitSizes {
  return {
    menu: MENU_BUTTON,
    nudgeOverhang: NUDGE_OVERHANG,
    actions: HUB_ACTIONS,
    title: titleSize(view),
    badge: badgeSizes(badgeText),
    caption: HUB_CAPTION,
  };
}

/** Every supported canvas from 320 to 1920 wide and 320 to 1080 tall in 20 px steps, then the named sizes upright and sideways. */
function sweepCanvases(): HudView[] {
  const views: HudView[] = [];
  for (let cssW = 320; cssW <= 1920; cssW += 20) {
    for (let cssH = 320; cssH <= 1080; cssH += 20) views.push({ cssW, cssH });
  }
  for (const [w, h] of NAMED_SIZES) views.push({ cssW: w, cssH: h }, { cssW: h, cssH: w });
  return views.filter((view) => isSupportedCanvas(view.cssW, view.cssH));
}

const SWEEP: readonly HudView[] = sweepCanvases();

/** True when `a` and `b` share area; touching does not count. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
}

/** Larger of the horizontal and vertical clearances between two rects; negative when they overlap. */
function clearance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** True when `rect` is inside the `UI.margin` edges of `view`. */
function insideMargins(view: HudView, rect: Rect): boolean {
  return (
    rect.x >= UI.margin - EPS &&
    rect.y >= UI.margin - EPS &&
    rect.x + rect.w <= view.cssW - UI.margin + EPS &&
    rect.y + rect.h <= view.cssH - UI.margin + EPS
  );
}

/** The Menu button rect in the bottom-left and top-left corners inside the margins. */
function cornerRects(view: HudView): Rect[] {
  return [
    { x: UI.margin, y: view.cssH - UI.margin - MENU_BUTTON.h, ...MENU_BUTTON },
    { x: UI.margin, y: UI.margin, ...MENU_BUTTON },
  ];
}

/** `menu` grown by the nudge overhang on its top and right. */
function withNudge(menu: Rect): Rect {
  return { x: menu.x, y: menu.y - NUDGE_OVERHANG, w: menu.w + NUDGE_OVERHANG, h: menu.h + NUDGE_OVERHANG };
}

/** True when some corner spot keeps the button and its nudge off the tank box of `frame`. */
function someCornerOffBox(view: HudView, frame: TankFrame): boolean {
  const box = tankBoxCss(frame);
  return cornerRects(view).some((menu) => !overlaps(withNudge(menu), box));
}

/** The canvases where no corner spot is off the tank box at the contain-fit scale: the shrunk set. */
function isShrunkCanvas(view: HudView): boolean {
  return !someCornerOffBox(view, tankFrame(view.cssW, view.cssH));
}

/** Every rect the open menu shows, named: the actions, the name panel, the badge and the caption room. */
function openMenuRects(fit: HubFit): [string, Rect][] {
  const rects = fit.hub.actions.map(({ id, rect }): [string, Rect] => [id, rect]);
  if (fit.hub.title !== null) rects.push(['namePanel', fit.hub.title]);
  rects.push(['badge', fit.badge]);
  if (fit.caption !== null) rects.push(['caption', fit.caption]);
  return rects;
}

/** Problems with the Menu button on one canvas, the same whether the menu is folded or open. */
function menuButtonProblems(label: string, view: HudView, fit: HubFit, folded: HubFit): string[] {
  const problems: string[] = [];
  const box = tankBoxCss(fit.frame);
  const band = topKeepClearCss(fit.frame);
  if (overlaps(withNudge(fit.menu), box)) problems.push(`${label}: Menu button or nudge on the tank box`);
  if (JSON.stringify(fit.menuFootprint) !== JSON.stringify(withNudge(fit.menu))) problems.push(`${label}: footprint`);
  if (!insideMargins(view, fit.menu)) problems.push(`${label}: Menu button outside the margins`);
  if (fit.menu.w < MIN_TARGET_PX || fit.menu.h < MIN_TARGET_PX) problems.push(`${label}: Menu button under 48 px`);
  if (!cornerRects(view).some((corner) => JSON.stringify(corner) === JSON.stringify(fit.menu))) problems.push(`${label}: not in a corner`);
  if (fit.menu.y < band.y1 - EPS && fit.menu.y + fit.menu.h > band.y0 + EPS) problems.push(`${label}: Menu button in the top band`);
  if (JSON.stringify(folded.menu) !== JSON.stringify(fit.menu)) problems.push(`${label}: Menu button moves when folded`);
  if (JSON.stringify(folded.frame) !== JSON.stringify(fit.frame)) problems.push(`${label}: frame changes when folded`);
  return problems;
}

/** Problems with the frame on one canvas: tankFrame outside the shrunk set, the largest freeing scale in it. */
function frameProblems(label: string, view: HudView, fit: HubFit): string[] {
  const full = tankFrame(view.cssW, view.cssH);
  const frame = fit.frame;
  const box = tankBoxCss(frame);
  const problems: string[] = [];
  if (box.x < -EPS || box.y < -EPS || box.x + box.w > view.cssW + EPS || box.y + box.h > view.cssH + EPS) {
    problems.push(`${label}: tank box outside the canvas`);
  }
  if (!isShrunkCanvas(view)) {
    if (JSON.stringify(frame) !== JSON.stringify(full)) problems.push(`${label}: frame is not tankFrame`);
    return problems;
  }
  if (!(frame.scale < full.scale)) problems.push(`${label}: not shrunk`);
  if (someCornerOffBox(view, tankFrameAt(view.cssW, view.cssH, frame.scale * (1 + 1e-6)))) {
    problems.push(`${label}: a larger scale frees a spot`);
  }
  if (Math.abs(frame.x - (view.cssW - frame.w) / 2) > EPS) problems.push(`${label}: not centred`);
  if (Math.abs(frame.y + frame.h - view.cssH) > EPS) problems.push(`${label}: not bottom-aligned`);
  if (Math.abs(frame.w - TANK.viewW * frame.scale) > EPS) problems.push(`${label}: frame width`);
  return problems;
}

/** Problems with the open menu on one canvas. */
function openMenuProblems(label: string, view: HudView, fit: HubFit): string[] {
  const problems: string[] = [];
  const box = tankBoxCss(fit.frame);
  const rects = openMenuRects(fit);
  for (const [name, rect] of rects) {
    if (fit.openByDefault && overlaps(rect, box)) problems.push(`${label}: ${name} on the tank box while open by default`);
    if (!insideMargins(view, rect)) problems.push(`${label}: ${name} outside the margins`);
    if (clearance(rect, fit.menuFootprint) < UI.gap - EPS) problems.push(`${label}: ${name} closer than ${UI.gap} to the Menu button`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlaps(rects[i][1], rects[j][1])) problems.push(`${label}: ${rects[i][0]} overlaps ${rects[j][0]}`);
    }
  }
  for (const { id, rect } of fit.hub.actions) {
    if (rect.w < MIN_TARGET_PX || rect.h < MIN_TARGET_PX) problems.push(`${label}: ${id} under 48 px`);
  }
  const go = fit.hub.actions.find((placement) => placement.id === 'goExploring');
  if (go === undefined || go.rect.h !== PRIMARY_H) problems.push(`${label}: Go exploring not ${PRIMARY_H} tall`);
  return problems;
}

describe('hubFit sweep (issue #148, ND-4)', () => {
  it('covers about 3,000 supported canvases', () => {
    expect(SWEEP.length).toBeGreaterThan(2900);
    expect(SWEEP.length).toBeLessThan(3300);
  });

  it('keeps the Menu button and its nudge off the tank box, in a corner, folded or open, on every canvas', () => {
    const problems: string[] = [];
    for (const view of SWEEP) {
      const fit = hubFit(view, sizesOn(view));
      const folded = hubFit(view, { ...sizesOn(view), actions: [], title: null });
      problems.push(...menuButtonProblems(`${view.cssW}x${view.cssH}`, view, fit, folded));
    }
    expect(problems).toEqual([]);
  });

  it('keeps tankFrame outside the shrunk set and shrinks only just enough inside it', () => {
    const problems: string[] = [];
    let smallestRatio = 1;
    for (const view of SWEEP) {
      const fit = hubFit(view, sizesOn(view));
      problems.push(...frameProblems(`${view.cssW}x${view.cssH}`, view, fit));
      smallestRatio = Math.min(smallestRatio, fit.frame.scale / tankFrame(view.cssW, view.cssH).scale);
    }
    expect(problems).toEqual([]);
    expect(smallestRatio).toBeGreaterThan(0.75);
    expect(smallestRatio).toBeLessThan(0.8);
  });

  it('lays out the open menu clear of the Menu button and of itself, opening by default only off the tank box', () => {
    const problems: string[] = [];
    for (const view of SWEEP) {
      for (const text of BADGE_LABELS) {
        problems.push(...openMenuProblems(`${view.cssW}x${view.cssH} "${text}"`, view, hubFit(view, sizesOn(view, text))));
      }
    }
    expect(problems).toEqual([]);
  });

  it('shrinks only near-square landscape canvases', () => {
    const shrunk = SWEEP.filter(isShrunkCanvas);
    expect(shrunk.length).toBeGreaterThan(0);
    expect(shrunk.every((view) => view.cssW > view.cssH)).toBe(true);
    expect(shrunk.every((view) => view.cssW / view.cssH < 1.8)).toBe(true);
    for (const [cssW, cssH] of [[1024, 768], [1440, 1080], [460, 320], [480, 360]]) {
      expect(isShrunkCanvas({ cssW, cssH })).toBe(true);
    }
    for (const [cssW, cssH] of [[1280, 720], [1366, 768], [1920, 1080], [844, 390], [390, 844], [768, 1024], [320, 440]]) {
      expect(isShrunkCanvas({ cssW, cssH })).toBe(false);
    }
  });
});

describe('hubFit', () => {
  it('puts the Menu button bottom-left of the full-size tank at 1280 x 720, with the menu folded', () => {
    const view = { cssW: 1280, cssH: 720 };
    const fit = hubFit(view, sizesOn(view));
    expect(fit.spot).toBe('bottomLeft');
    expect(fit.frame).toEqual(tankFrame(1280, 720));
    expect(fit.menu).toEqual({ x: 16, y: 720 - 16 - 64, w: 65, h: 64 });
    expect(fit.menuFootprint).toEqual({ x: 16, y: 637, w: 68, h: 67 });
    expect(fit.openByDefault).toBe(false);
  });

  it('puts the Menu button top-left above the full-size tank at 390 x 844, with the menu open', () => {
    const view = { cssW: 390, cssH: 844 };
    const fit = hubFit(view, sizesOn(view));
    expect(fit.spot).toBe('topLeft');
    expect(fit.frame).toEqual(tankFrame(390, 844));
    expect(fit.menu).toEqual({ x: 16, y: 16, w: 65, h: 64 });
    expect(fit.openByDefault).toBe(true);
  });

  it('shrinks the tank to scale 2 at 1024 x 768 so the Menu button sits above the lid', () => {
    const view = { cssW: 1024, cssH: 768 };
    const fit = hubFit(view, sizesOn(view));
    expect(fit.spot).toBe('topLeft');
    expect(fit.frame.scale).toBeCloseTo(2, 12);
    expect(fit.frame.scale / tankFrame(1024, 768).scale).toBeCloseTo(0.9375, 12);
    expect(tankBoxCss(fit.frame).y).toBeCloseTo(fit.menu.y + fit.menu.h, 9);
  });

  it('shrinks the tank to (320 - 80) / 344 at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const fit = hubFit(view, sizesOn(view));
    expect(fit.spot).toBe('topLeft');
    expect(fit.frame.scale).toBeCloseTo(240 / 344, 12);
  });

  it('frees the left strip first when it is the wider one', () => {
    const view = { cssW: 1100, cssH: 768 };
    const fit = hubFit(view, sizesOn(view));
    expect(fit.frame.scale).toBeCloseTo((550 - 84) / 224, 12);
    expect(fit.spot).toBe('bottomLeft');
  });

  it('never throws and keeps a positive scale on degenerate and unsupported canvases', () => {
    for (const view of [
      { cssW: 0, cssH: 0 },
      { cssW: Number.NaN, cssH: 600 },
      { cssW: -5, cssH: Number.POSITIVE_INFINITY },
      { cssW: 100, cssH: 100 },
      { cssW: 200, cssH: 2000 },
      { cssW: 4000, cssH: 200 },
    ]) {
      const fit = hubFit(view, sizesOn(view));
      expect(fit.frame.scale).toBeGreaterThan(0);
      expect(Number.isFinite(fit.frame.scale)).toBe(true);
      const rects = [fit.menu, fit.menuFootprint, ...fit.hub.actions.map((action) => action.rect), fit.badge];
      if (fit.hub.title !== null) rects.push(fit.hub.title);
      if (fit.caption !== null) rects.push(fit.caption);
      for (const rect of rects) {
        expect([rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)).toBe(true);
        expect(rect.w).toBeGreaterThanOrEqual(0);
        expect(rect.h).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('counts a zero, negative or not finite canvas size as 1 CSS px, as tankFrame does', () => {
    const one = hubFit({ cssW: 1, cssH: 1 }, sizesOn({ cssW: 1, cssH: 1 }));
    for (const view of [
      { cssW: 0, cssH: 0 },
      { cssW: -5, cssH: Number.NaN },
      { cssW: Number.POSITIVE_INFINITY, cssH: Number.NEGATIVE_INFINITY },
    ]) {
      expect(hubFit(view, sizesOn({ cssW: 1, cssH: 1 }))).toEqual(one);
    }
  });
});

describe('modeTankFrame (issue #148, ND-3)', () => {
  it('draws decorate mode on the full-size tankFrame and every other mode on the hub fit frame', () => {
    for (const [cssW, cssH] of [[1024, 768], [460, 320], [1280, 720], [390, 844]] as const) {
      const view = { cssW, cssH };
      const hubFrame = hubFit(view, sizesOn(view)).frame;
      expect(modeTankFrame(view, hubFrame, true)).toEqual(tankFrame(cssW, cssH));
      expect(modeTankFrame(view, hubFrame, false)).toBe(hubFrame);
    }
  });

  it('gives two frames only on the shrunk set', () => {
    for (const view of SWEEP) {
      const hubFrame = hubFit(view, sizesOn(view)).frame;
      const same = JSON.stringify(modeTankFrame(view, hubFrame, true)) === JSON.stringify(modeTankFrame(view, hubFrame, false));
      expect(same, `${view.cssW}x${view.cssH}`).toBe(!isShrunkCanvas(view));
    }
  });
});

describe('hub menu fold and open rules (PRD C16, ND-6)', () => {
  const OPEN: HubMenuState = { open: true, openByDefault: true };
  const FOLDED: HubMenuState = { open: false, openByDefault: false };
  const OPENED_BY_HAND: HubMenuState = { open: true, openByDefault: false };
  const FOLDED_BY_HAND: HubMenuState = { open: false, openByDefault: true };
  const STATES: readonly HubMenuState[] = [OPEN, FOLDED, OPENED_BY_HAND, FOLDED_BY_HAND];

  it('starts with the canvas default', () => {
    expect(startHubMenu(true)).toEqual(OPEN);
    expect(startHubMenu(false)).toEqual(FOLDED);
  });

  it('starts open where the fit opens the menu by default and folded where it does not', () => {
    for (const [cssW, cssH, open] of [[390, 844, true], [1280, 720, false]] as const) {
      const view = { cssW, cssH };
      expect(startHubMenu(hubFit(view, sizesOn(view)).openByDefault).open).toBe(open);
    }
  });

  it('opens the menu with the focus on the action, coming back from any menu action screen', () => {
    for (const state of STATES) {
      for (const { id } of HUB_BUTTONS) {
        expect(stepHubMenu(state, { kind: 'returnFromAction', id })).toEqual({
          state: { open: true, openByDefault: state.openByDefault },
          focus: id,
        });
      }
    }
  });

  it('keeps the state, coming back from a screen an axolotl opened', () => {
    for (const state of STATES) {
      expect(stepHubMenu(state, { kind: 'returnFromAxolotl' })).toEqual({ state, focus: null });
    }
  });

  it('takes the new default on a resize that changes it', () => {
    expect(stepHubMenu(OPEN, { kind: 'resize', openByDefault: false })).toEqual({ state: FOLDED, focus: null });
    expect(stepHubMenu(FOLDED, { kind: 'resize', openByDefault: true })).toEqual({ state: OPEN, focus: null });
    expect(stepHubMenu(OPENED_BY_HAND, { kind: 'resize', openByDefault: true })).toEqual({ state: OPEN, focus: null });
    expect(stepHubMenu(FOLDED_BY_HAND, { kind: 'resize', openByDefault: false })).toEqual({ state: FOLDED, focus: null });
  });

  it('changes nothing on a resize that keeps the default', () => {
    for (const state of STATES) {
      expect(stepHubMenu(state, { kind: 'resize', openByDefault: state.openByDefault })).toEqual({ state, focus: null });
    }
  });

  it('folds an open menu and opens a folded one on a Menu button press, keeping the default', () => {
    expect(stepHubMenu(OPEN, { kind: 'toggle' })).toEqual({ state: FOLDED_BY_HAND, focus: null });
    expect(stepHubMenu(FOLDED, { kind: 'toggle' })).toEqual({ state: OPENED_BY_HAND, focus: null });
    expect(stepHubMenu(OPENED_BY_HAND, { kind: 'toggle' })).toEqual({ state: FOLDED, focus: null });
    expect(stepHubMenu(FOLDED_BY_HAND, { kind: 'toggle' })).toEqual({ state: OPEN, focus: null });
  });

  it('never changes the state it is given', () => {
    const state: HubMenuState = Object.freeze({ open: false, openByDefault: false });
    stepHubMenu(state, { kind: 'toggle' });
    stepHubMenu(state, { kind: 'returnFromAction', id: 'refuge' });
    stepHubMenu(state, { kind: 'resize', openByDefault: true });
    expect(state).toEqual(FOLDED);
  });
});
