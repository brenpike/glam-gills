import { describe, expect, it } from 'vitest';
import { areaLabel } from './areaText';
import { isSupportedCanvas } from './cardFit';
import type { HudView, Rect, Size } from './hudLayout';
import { HUB_STARS_BADGE, STAR_ROW, hubStarsBadgeRect, hubStarsBadgeShape, starRowSize, type HubBadgeShape } from './starsUi';
import { tankFrame, topKeepClearCss } from './tank';
import { COLLECTION_BOOK_LABEL } from './tankText';
import {
  HUB_BUTTONS,
  UI,
  hubButtonCompactLook,
  hubButtonLook,
  hubCaptionRect,
  hubLayout,
  tankRooms,
  type HubAction,
  type HubLayout,
} from './tankUi';

/** Text size estimate that errs wide, the cardCopyFit.test constants. */
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

const TITLE_PX = 34;
const BODY_PX = 18;
const HUB_TITLE = 'Home Tank';

/** The tankUi.test canvas grid. */
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

const HUB_ACTIONS: readonly HubAction[] = HUB_BUTTONS.map(({ id, label, primary }) => hubAction(id, label, primary));

/** One line of bold text at `px`, estimated wide. */
function lineSize(text: string, px: number): Size {
  return { w: text.length * BOLD_EM * px, h: LINE_HEIGHT_EM * px };
}

/** The hub title panel as the scene measures it: one line at the margin width less the pad, plus the pad each side. */
function titleSize(view: HudView): Size {
  const line = lineSize(HUB_TITLE, TITLE_PX);
  return { w: Math.min(view.cssW - 2 * UI.margin - 2 * UI.pad, line.w) + 2 * UI.pad, h: line.h + 2 * UI.pad };
}

/** The longest hub focus caption at its drawn size: one line of the longest hub label at the body size, plus the pad each side. */
const HUB_CAPTION: Size = {
  w: lineSize(COLLECTION_BOOK_LABEL, BODY_PX).w + 2 * UI.pad,
  h: lineSize(COLLECTION_BOOK_LABEL, BODY_PX).h + 2 * UI.pad,
};

/** The shortest and the longest area labels the badge shows in this phase. */
const BADGE_LABELS: readonly string[] = [areaLabel(1), areaLabel(10)];

/** The 3 badge stars in a row. */
function badgeStarsSize(): Size {
  return { w: 3 * HUB_STARS_BADGE.starPx + 2 * HUB_STARS_BADGE.starGap, h: HUB_STARS_BADGE.starPx };
}

/** Badge with the area label `text` beside the stars. */
function besideBadge(text: string = areaLabel(1)): Size {
  const label = lineSize(text, HUB_STARS_BADGE.labelPx);
  const stars = badgeStarsSize();
  return {
    w: 2 * HUB_STARS_BADGE.pad + label.w + HUB_STARS_BADGE.gap + stars.w,
    h: 2 * HUB_STARS_BADGE.pad + Math.max(label.h, stars.h),
  };
}

/** Badge with the area label `text` above the stars. */
function stackedBadge(text: string = areaLabel(1)): Size {
  const label = lineSize(text, HUB_STARS_BADGE.labelPx);
  const stars = badgeStarsSize();
  return {
    w: 2 * HUB_STARS_BADGE.pad + Math.max(label.w, stars.w),
    h: 2 * HUB_STARS_BADGE.pad + label.h + HUB_STARS_BADGE.gap + stars.h,
  };
}

/** The badge of `shape` showing `text`. */
function badgeOf(shape: HubBadgeShape, text: string): Size {
  return shape === 'stacked' ? stackedBadge(text) : besideBadge(text);
}

/** The badges to try with `hub`: for each badge label, the one shape hubStarsBadgeShape(hub) picks, which is the shape the scene draws. The grid tests the shape the rule draws, not the other one. */
function badgesFor(hub: HubLayout): [string, Size][] {
  const shape = hubStarsBadgeShape(hub);
  return BADGE_LABELS.map((text): [string, Size] => [`${shape} "${text}"`, badgeOf(shape, text)]);
}

/** Supported canvases from the width and height grid (art guide 1). */
function supportedCanvases(): HudView[] {
  return CANVAS_WIDTHS.flatMap((cssW) =>
    CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
  );
}

/** Larger of the horizontal and vertical clearances between two rects; negative when they overlap. */
function clearance(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
}

/** True when `rect` is inside the 16 px edge margins. */
function insideMargins(view: HudView, rect: Rect): boolean {
  return (
    rect.x >= UI.margin - 1e-9 &&
    rect.y >= UI.margin - 1e-9 &&
    rect.x + rect.w <= view.cssW - UI.margin + 1e-9 &&
    rect.y + rect.h <= view.cssH - UI.margin + 1e-9
  );
}

/** True when `rect` is at least a gap clear of the band kept clear for Floating and Hanging items. */
function clearOfTopBand(view: HudView, rect: Rect): boolean {
  const band = topKeepClearCss(tankFrame(view.cssW, view.cssH));
  return rect.y + rect.h <= band.y0 - UI.gap + 1e-9 || rect.y >= band.y1 + UI.gap - 1e-9;
}

/** The hub title and action rects. */
function hubRects(hub: HubLayout): [string, Rect][] {
  const rects = hub.actions.map(({ id, rect }): [string, Rect] => [id, rect]);
  return hub.title ? [['title', hub.title], ...rects] : rects;
}

/** Every badge problem on one canvas for one hub and one badge. */
function badgeProblems(label: string, view: HudView, hub: HubLayout, badge: Size): string[] {
  const rect = hubStarsBadgeRect(view, tankFrame(view.cssW, view.cssH), hub, badge);
  const problems: string[] = [];
  if (!insideMargins(view, rect)) problems.push(`${label}: outside the margins`);
  if (rect.w !== badge.w || rect.h !== badge.h) problems.push(`${label}: resized`);
  if (!clearOfTopBand(view, rect)) problems.push(`${label}: near the top band`);
  for (const [name, other] of hubRects(hub)) {
    if (clearance(rect, other) < UI.gap - 1e-9) problems.push(`${label}: closer than ${UI.gap} to ${name}`);
  }
  return problems;
}

/** Every hub focus caption problem on one canvas for one hub and the badge rect: no place, outside the margins, in the top band, or within a gap of the hub or badge. */
function captionProblems(label: string, view: HudView, hub: HubLayout, badgeRect: Rect): string[] {
  const caption = hubCaptionRect(view, tankFrame(view.cssW, view.cssH), hub, HUB_CAPTION, [badgeRect]);
  if (caption === null) return [`${label}: no place`];
  const problems: string[] = [];
  if (!insideMargins(view, caption)) problems.push(`${label}: outside the margins`);
  if (!clearOfTopBand(view, caption)) problems.push(`${label}: near the top band`);
  for (const [name, other] of [...hubRects(hub), ['badge', badgeRect] as [string, Rect]]) {
    if (clearance(caption, other) < UI.gap - 1e-9) problems.push(`${label}: closer than ${UI.gap} to ${name}`);
  }
  return problems;
}

/** The hub on `view` with the 5 hub actions, with or without the title. */
function hubOn(view: HudView, withTitle: boolean): HubLayout {
  return hubLayout(view, tankFrame(view.cssW, view.cssH), HUB_ACTIONS, withTitle ? titleSize(view) : null);
}

/** The bottom-right corner rect of `badge` inside the edge margins. */
function cornerOf(view: HudView, badge: Size): Rect {
  return { x: view.cssW - UI.margin - badge.w, y: view.cssH - UI.margin - badge.h, w: badge.w, h: badge.h };
}

describe('starRowSize', () => {
  it('fits 3 stars of 40 px with 12 px gaps', () => {
    expect(STAR_ROW).toEqual({ starPx: 40, gap: 12 });
    expect(starRowSize()).toEqual({ w: 3 * 40 + 2 * 12, h: 40 });
  });
});

describe('hubStarsBadgeShape', () => {
  it('stacks the badge only when the hub rows reach over the floor Decorations', () => {
    for (const view of supportedCanvases()) {
      for (const withTitle of [true, false]) {
        const hub = hubOn(view, withTitle);
        expect(hubStarsBadgeShape(hub)).toBe(hub.reach ? 'stacked' : 'beside');
      }
    }
    expect(hubStarsBadgeShape(hubOn({ cssW: 460, cssH: 320 }, true))).toBe('stacked');
    expect(hubStarsBadgeShape(hubOn({ cssW: 1280, cssH: 720 }, true))).toBe('beside');
  });

  it('picks beside for every non-reach supported canvas and stacked for every reach canvas', () => {
    const problems: string[] = [];
    let reachCount = 0;
    let besideCount = 0;
    for (const view of supportedCanvases()) {
      for (const withTitle of [true, false]) {
        const hub = hubOn(view, withTitle);
        const expected: HubBadgeShape = hub.reach ? 'stacked' : 'beside';
        if (hub.reach) reachCount += 1;
        else besideCount += 1;
        if (hubStarsBadgeShape(hub) !== expected) problems.push(`${view.cssW}x${view.cssH} title=${withTitle}: not ${expected}`);
      }
    }
    expect(problems).toEqual([]);
    expect(reachCount).toBeGreaterThan(0);
    expect(besideCount).toBeGreaterThan(0);
  });

  it('keeps the badge text and star sizes', () => {
    expect(HUB_STARS_BADGE).toEqual({ starPx: 24, starGap: 4, labelPx: 18, pad: 12, gap: 8 });
    expect(stackedBadge(areaLabel(1))).toEqual({ w: 104, h: 78.5 });
    expect(stackedBadge(areaLabel(10))).toEqual({ w: 104, h: 78.5 });
  });
});

describe('hubStarsBadgeRect', () => {
  it('places the badge and leaves a place for the hub focus caption on every supported canvas with the 5 hub actions', () => {
    expect(HUB_ACTIONS).toHaveLength(6);
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      for (const withTitle of [true, false]) {
        const hub = hubOn(view, withTitle);
        for (const [badgeName, badge] of badgesFor(hub)) {
          const label = `badge ${badgeName} ${view.cssW}x${view.cssH} title=${withTitle} reach=${hub.reach}`;
          problems.push(...badgeProblems(label, view, hub, badge));
          const badgeRect = hubStarsBadgeRect(view, tankFrame(view.cssW, view.cssH), hub, badge);
          problems.push(...captionProblems(`caption ${label}`, view, hub, badgeRect));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('centres the badge a gap under the hub when it fits in the room of the hub', () => {
    const view = { cssW: 1366, cssH: 768 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubLayout(view, frame, HUB_ACTIONS, titleSize(view));
    const badge = besideBadge();
    const lowest = Math.max(...hubRects(hub).map(([, rect]) => rect.y + rect.h));
    const rect = hubStarsBadgeRect(view, frame, hub, badge);
    expect(hub.reach).toBe(false);
    expect(rect).toEqual({ x: (view.cssW - badge.w) / 2, y: lowest + UI.gap, w: badge.w, h: badge.h });
    expect(rect.y + rect.h).toBeLessThanOrEqual(hub.room.bottom);
  });

  it('puts the badge under the full-size row at 1280 x 720', () => {
    const view = { cssW: 1280, cssH: 720 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubLayout(view, frame, HUB_ACTIONS, titleSize(view));
    const badge = besideBadge();
    expect(hub.compact).toBe(false);
    expect(hub.actions[0].rect.y).toBe(306.5);
    expect(hubStarsBadgeRect(view, frame, hub, badge)).toEqual({
      x: (view.cssW - badge.w) / 2,
      y: 306.5 + 64 + UI.gap,
      w: badge.w,
      h: badge.h,
    });
  });

  it('falls back to the bottom-right corner when there is no room under the hub at 844 x 320', () => {
    const view = { cssW: 844, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubLayout(view, frame, HUB_ACTIONS, null);
    expect(hub.compact).toBe(true);
    expect(hub.reach).toBe(false);
    const badge = besideBadge();
    expect(hubStarsBadgeRect(view, frame, hub, badge)).toEqual(cornerOf(view, badge));
  });

  it.each([
    { cssW: 800, cssH: 600 },
    { cssW: 320, cssH: 440 },
  ])('sits at the top of the first room when the hub is empty at $cssW x $cssH', (view) => {
    const frame = tankFrame(view.cssW, view.cssH);
    const badge = besideBadge();
    const hub = hubLayout(view, frame, [], null);
    expect(hubStarsBadgeRect(view, frame, hub, badge).y).toBe(tankRooms(view, frame)[0].top);
  });

  it('always puts the badge in the bottom-right corner, never centred, when the hub rows reach', () => {
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      for (const withTitle of [true, false]) {
        const hub = hubOn(view, withTitle);
        if (!hub.reach) continue;
        for (const [badgeName, badge] of badgesFor(hub)) {
          const rect = hubStarsBadgeRect(view, tankFrame(view.cssW, view.cssH), hub, badge);
          const label = `${badgeName} ${view.cssW}x${view.cssH} title=${withTitle}`;
          if (JSON.stringify(rect) !== JSON.stringify(cornerOf(view, badge))) problems.push(`${label}: not in the corner`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('puts the stacked badge in the corner and the caption 17 px left of it at 460 x 320', () => {
    const view = { cssW: 460, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubOn(view, true);
    expect(hub.reach).toBe(true);
    const badge = hubStarsBadgeRect(view, frame, hub, stackedBadge());
    expect(badge).toEqual({ x: 340, y: 225.5, w: 104, h: 78.5 });
    const caption = hubCaptionRect(view, frame, hub, HUB_CAPTION, [badge]);
    expect(caption).toEqual({ x: 137, y: 244, w: 186, h: 46.5 });
    expect(clearance(caption ?? badge, badge)).toBe(17);
  });

  it('leaves 27 px between the caption and the corner badge at 480 x 320', () => {
    const view = { cssW: 480, cssH: 320 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubOn(view, true);
    expect(hub.reach).toBe(true);
    const badge = hubStarsBadgeRect(view, frame, hub, stackedBadge());
    const caption = hubCaptionRect(view, frame, hub, HUB_CAPTION, [badge]);
    expect(caption).not.toBeNull();
    expect(clearance(caption ?? badge, badge)).toBe(27);
  });

  it('keeps the badge in the corner at 480 x 414 though it would fit centred under the hub', () => {
    const view = { cssW: 480, cssH: 414 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubOn(view, true);
    expect(hub.reach).toBe(true);
    const badge = stackedBadge();
    const rect = hubStarsBadgeRect(view, frame, hub, badge);
    expect(rect).toEqual(cornerOf(view, badge));
    expect(rect.x).not.toBe((view.cssW - badge.w) / 2);
  });
});

/** A Menu button with its nudge in the top-left corner inside the margins (issue #148, ND-5): 65 x 64 plus a 3 px overhang. */
const TOP_LEFT_MENU: Rect = { x: UI.margin, y: UI.margin - 3, w: 65 + 3, h: 64 + 3 };

describe('hubStarsBadgeRect with the Menu button to keep clear of (issue #148, ND-5)', () => {
  it('places the badge exactly as without it when the button is far from everything', () => {
    const far: Rect = { x: -1000, y: -1000, w: 65, h: 64 };
    for (const view of supportedCanvases()) {
      for (const withTitle of [true, false]) {
        const hub = hubOn(view, withTitle);
        const frame = tankFrame(view.cssW, view.cssH);
        for (const [, badge] of badgesFor(hub)) {
          expect(hubStarsBadgeRect(view, frame, hub, badge, far)).toEqual(hubStarsBadgeRect(view, frame, hub, badge));
        }
      }
    }
  });

  it('keeps the badge a gap from the button and the hub on every supported canvas', () => {
    const problems: string[] = [];
    for (const view of supportedCanvases()) {
      const frame = tankFrame(view.cssW, view.cssH);
      const hub = hubLayout(view, frame, HUB_ACTIONS, titleSize(view), TOP_LEFT_MENU);
      for (const [badgeName, badge] of badgesFor(hub)) {
        const label = `${badgeName} ${view.cssW}x${view.cssH}`;
        const rect = hubStarsBadgeRect(view, frame, hub, badge, TOP_LEFT_MENU);
        if (!insideMargins(view, rect)) problems.push(`${label}: outside the margins`);
        if (clearance(rect, TOP_LEFT_MENU) < UI.gap - 1e-9) problems.push(`${label}: closer than ${UI.gap} to the button`);
        for (const [name, other] of hubRects(hub)) {
          if (clearance(rect, other) < UI.gap - 1e-9) problems.push(`${label}: closer than ${UI.gap} to ${name}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives up the centred place under the hub when it comes within a gap of the button', () => {
    const view = { cssW: 1366, cssH: 768 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubLayout(view, frame, HUB_ACTIONS, titleSize(view));
    const badge = besideBadge();
    const centred = hubStarsBadgeRect(view, frame, hub, badge);
    const onCentre: Rect = { x: centred.x - 70, y: centred.y, w: 68, h: 67 };
    expect(hubStarsBadgeRect(view, frame, hub, badge, onCentre)).toEqual(cornerOf(view, badge));
  });

  it('moves the corner badge to the top-right corner when the reaching rows come within a gap of the bottom one at 380 x 440', () => {
    const view = { cssW: 380, cssH: 440 };
    const frame = tankFrame(view.cssW, view.cssH);
    const hub = hubLayout(view, frame, HUB_ACTIONS, titleSize(view), TOP_LEFT_MENU);
    expect(hub.reach).toBe(true);
    const badge = stackedBadge();
    const corner = cornerOf(view, badge);
    expect(hubRects(hub).some(([, rect]) => clearance(corner, rect) < UI.gap)).toBe(true);
    expect(hubStarsBadgeRect(view, frame, hub, badge, TOP_LEFT_MENU)).toEqual({ ...corner, y: UI.margin });
  });
});
