/**
 * Home Tank picking (PRD F6): which hub button or owned axolotl the hub focus is on, the touch target
 * round a swimming axolotl, and where a focused axolotl's name tag goes (art guide 8). Hub buttons
 * come first in the focus order, then the axolotls, so a new hub button fits in without changes here.
 */
import type { HudView, Rect, Size } from './hudLayout';
import { UI, nextFocusIndex } from './tankUi';

/** Least touch target side, in CSS px (art guide 8). */
export const TOUCH_TARGET_PX = 48;

/** Room between a focused axolotl's sprite bounds and its name tag, in CSS px; clears the focus ring. */
export const NAME_TAG_GAP = UI.gap;

/** What one hub focus index points at: the `i`-th hub button or the `i`-th owned axolotl. */
export type TankFocusTarget = { kind: 'hub'; i: number } | { kind: 'axolotl'; i: number };

/** `count` as a whole number of targets: 0 for anything not finite and positive. */
function wholeCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/** `value` held inside `min` to `max`; `min` wins when the range is empty. */
function clampInto(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** How many hub focus targets there are: every hub button, then every owned axolotl. */
export function tankFocusCount(hubCount: number, axolotlCount: number): number {
  return wholeCount(hubCount) + wholeCount(axolotlCount);
}

/**
 * What focus `index` points at: the hub buttons take the first `hubCount` indices and the axolotls
 * the rest. Null when `index` is not a whole number inside the count.
 */
export function tankFocusTarget(index: number, hubCount: number, axolotlCount: number): TankFocusTarget | null {
  if (!Number.isInteger(index) || index < 0 || index >= tankFocusCount(hubCount, axolotlCount)) return null;
  const hubs = wholeCount(hubCount);
  return index < hubs ? { kind: 'hub', i: index } : { kind: 'axolotl', i: index - hubs };
}

/** Focus index of the `i`-th owned axolotl, after `hubCount` hub buttons. Throws unless `i` is a whole number from 0. */
export function axolotlFocusIndex(i: number, hubCount: number): number {
  if (!Number.isInteger(i) || i < 0) throw new RangeError(`axolotlFocusIndex: invalid axolotl index ${i}`);
  return wholeCount(hubCount) + i;
}

/** The focus index `step` places from `current` over the hub buttons then the axolotls, wrapping (nextFocusIndex). */
export function stepTankFocus(current: number, hubCount: number, axolotlCount: number, step: number): number {
  return nextFocusIndex(current, tankFocusCount(hubCount, axolotlCount), step);
}

/**
 * The focus index `step` places from `current` while the hub menu is folded (PRD C16, issue #148,
 * ND-6): over the Menu button at hub index `menuIndex` and the axolotls only, wrapping; the folded
 * actions are skipped. From a focus off those targets, a forward or zero step gives the Menu button
 * and a backward step the last axolotl (nextFocusIndex). Throws unless `menuIndex` is a whole number
 * inside the hub buttons.
 */
export function stepFoldedTankFocus(
  current: number,
  menuIndex: number,
  hubCount: number,
  axolotlCount: number,
  step: number,
): number {
  if (!Number.isInteger(menuIndex) || menuIndex < 0 || menuIndex >= wholeCount(hubCount)) {
    throw new RangeError(`stepFoldedTankFocus: invalid Menu button index ${menuIndex}`);
  }
  const axolotlIndices = Array.from({ length: wholeCount(axolotlCount) }, (_, i) => axolotlFocusIndex(i, hubCount));
  const targets = [menuIndex, ...axolotlIndices];
  return targets[nextFocusIndex(targets.indexOf(current), targets.length, step)];
}

/**
 * The tap area of a sprite whose frame is `size` (in frame units, origin top-left): the whole frame,
 * grown about its centre to at least TOUCH_TARGET_PX CSS px each way. `cssPerUnit` is the CSS px one
 * frame unit shows at; when it is not finite and positive the frame is used as it is.
 */
export function touchHitRect(size: Size, cssPerUnit: number): Rect {
  const minUnits = Number.isFinite(cssPerUnit) && cssPerUnit > 0 ? TOUCH_TARGET_PX / cssPerUnit : 0;
  const w = Math.max(size.w, minUnits);
  const h = Math.max(size.h, minUnits);
  return { x: (size.w - w) / 2, y: (size.h - h) / 2, w, h };
}

/**
 * Where a name tag of `tag` size goes for a focused axolotl with sprite bounds `target`: centred
 * across it, NAME_TAG_GAP above it, or the same gap below it when above would cross the top margin.
 * Then it is held inside the canvas less the UI.margin edge margins; the left and top margins win
 * when the tag is wider or taller than the room.
 */
export function nameTagRect(target: Rect, tag: Size, view: HudView): Rect {
  const above = target.y - NAME_TAG_GAP - tag.h;
  const y = above >= UI.margin ? above : target.y + target.h + NAME_TAG_GAP;
  const x = target.x + (target.w - tag.w) / 2;
  return {
    x: clampInto(x, UI.margin, view.cssW - UI.margin - tag.w),
    y: clampInto(y, UI.margin, view.cssH - UI.margin - tag.h),
    w: tag.w,
    h: tag.h,
  };
}
