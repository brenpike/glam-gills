import { describe, expect, it } from 'vitest';
import type { HudView, Rect, Size } from './hudLayout';
import {
  NAME_TAG_GAP,
  TOUCH_TARGET_PX,
  axolotlFocusIndex,
  nameTagRect,
  stepFoldedTankFocus,
  stepTankFocus,
  tankFocusCount,
  tankFocusTarget,
  touchHitRect,
} from './tankPick';
import { UI } from './tankUi';

const VIEW: HudView = { cssW: 800, cssH: 600 };
const TAG: Size = { w: 120, h: 40 };

/** Every focus target in order for `hubCount` hub buttons and `axolotlCount` axolotls. */
function allTargets(hubCount: number, axolotlCount: number): ReturnType<typeof tankFocusTarget>[] {
  return Array.from({ length: tankFocusCount(hubCount, axolotlCount) }, (_, index) =>
    tankFocusTarget(index, hubCount, axolotlCount),
  );
}

/** Whether `rect` sits inside the view less the edge margins. */
function insideMargins(rect: Rect, view: HudView): boolean {
  return (
    rect.x >= UI.margin &&
    rect.y >= UI.margin &&
    rect.x + rect.w <= view.cssW - UI.margin &&
    rect.y + rect.h <= view.cssH - UI.margin
  );
}

describe('tankFocusCount', () => {
  it('counts the hub buttons then the axolotls', () => {
    expect(tankFocusCount(3, 1)).toBe(4);
    expect(tankFocusCount(4, 1)).toBe(5);
    expect(tankFocusCount(3, 4)).toBe(7);
    expect(tankFocusCount(4, 0)).toBe(4);
  });

  it('treats a count that is not finite and positive as none', () => {
    expect(tankFocusCount(3, -2)).toBe(3);
    expect(tankFocusCount(Number.NaN, 2)).toBe(2);
    expect(tankFocusCount(3, Number.POSITIVE_INFINITY)).toBe(3);
  });
});

describe('tankFocusTarget', () => {
  it('maps three hub buttons first, then the axolotls', () => {
    expect(allTargets(3, 2)).toEqual([
      { kind: 'hub', i: 0 },
      { kind: 'hub', i: 1 },
      { kind: 'hub', i: 2 },
      { kind: 'axolotl', i: 0 },
      { kind: 'axolotl', i: 1 },
    ]);
  });

  it('fits a fourth hub button in before the axolotls', () => {
    expect(allTargets(4, 2)).toEqual([
      { kind: 'hub', i: 0 },
      { kind: 'hub', i: 1 },
      { kind: 'hub', i: 2 },
      { kind: 'hub', i: 3 },
      { kind: 'axolotl', i: 0 },
      { kind: 'axolotl', i: 1 },
    ]);
  });

  it('maps three hub buttons then eight axolotls, 11 in all', () => {
    expect(allTargets(3, 8)).toEqual([
      { kind: 'hub', i: 0 },
      { kind: 'hub', i: 1 },
      { kind: 'hub', i: 2 },
      ...Array.from({ length: 8 }, (_, i) => ({ kind: 'axolotl', i })),
    ]);
  });

  it('maps only hub buttons when no axolotl is owned', () => {
    expect(allTargets(3, 0).every((target) => target?.kind === 'hub')).toBe(true);
  });

  it('is null outside the count or for an index that is not whole', () => {
    expect(tankFocusTarget(-1, 3, 1)).toBeNull();
    expect(tankFocusTarget(4, 3, 1)).toBeNull();
    expect(tankFocusTarget(1.5, 3, 1)).toBeNull();
    expect(tankFocusTarget(Number.NaN, 3, 1)).toBeNull();
    expect(tankFocusTarget(0, 0, 0)).toBeNull();
  });
});

describe('axolotlFocusIndex', () => {
  it('is the hub button count plus the axolotl index, and maps back to that axolotl', () => {
    for (const hubCount of [3, 4]) {
      for (let i = 0; i < 3; i++) {
        const index = axolotlFocusIndex(i, hubCount);
        expect(index).toBe(hubCount + i);
        expect(tankFocusTarget(index, hubCount, 3)).toEqual({ kind: 'axolotl', i });
      }
    }
  });

  it('throws for an axolotl index that is not a whole number from 0', () => {
    expect(() => axolotlFocusIndex(-1, 3)).toThrow(RangeError);
    expect(() => axolotlFocusIndex(0.5, 3)).toThrow(RangeError);
  });
});

describe('stepTankFocus', () => {
  it('steps from the last hub button onto the first axolotl and back', () => {
    expect(stepTankFocus(2, 3, 2, 1)).toBe(3);
    expect(stepTankFocus(3, 3, 2, -1)).toBe(2);
    expect(stepTankFocus(3, 4, 2, 1)).toBe(4);
  });

  it('wraps from the last axolotl to the first hub button and back', () => {
    expect(stepTankFocus(4, 3, 2, 1)).toBe(0);
    expect(stepTankFocus(0, 3, 2, -1)).toBe(4);
    expect(stepTankFocus(5, 4, 2, 1)).toBe(0);
    expect(stepTankFocus(0, 4, 2, -1)).toBe(5);
  });

  it('wraps through all 11 targets for three hub buttons and eight axolotls', () => {
    const visited: number[] = [];
    let focus = 0;
    for (let step = 0; step < 11; step++) {
      visited.push(focus);
      focus = stepTankFocus(focus, 3, 8, 1);
    }
    expect(visited).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(focus).toBe(0);
    expect(stepTankFocus(0, 3, 8, -1)).toBe(10);
    expect(stepTankFocus(10, 3, 8, 1)).toBe(0);
    expect(stepTankFocus(3, 3, 8, -1)).toBe(2);
  });

  it('wraps over the hub buttons alone when no axolotl is owned', () => {
    expect(stepTankFocus(2, 3, 0, 1)).toBe(0);
    expect(stepTankFocus(0, 3, 0, -1)).toBe(2);
  });

  it('is -1 when there is nothing to focus', () => {
    expect(stepTankFocus(0, 0, 0, 1)).toBe(-1);
  });
});

describe('stepFoldedTankFocus', () => {
  it('steps from the Menu button onto the axolotls and wraps back, skipping the folded actions', () => {
    const visited: number[] = [];
    let focus = 6;
    for (let step = 0; step < 4; step++) {
      visited.push(focus);
      focus = stepFoldedTankFocus(focus, 6, 7, 3, 1);
    }
    expect(visited).toEqual([6, 7, 8, 9]);
    expect(focus).toBe(6);
    expect(stepFoldedTankFocus(6, 6, 7, 3, -1)).toBe(9);
    expect(stepFoldedTankFocus(7, 6, 7, 3, -1)).toBe(6);
  });

  it('works with the Menu button anywhere among the hub buttons', () => {
    expect(stepFoldedTankFocus(0, 0, 7, 2, 1)).toBe(7);
    expect(stepFoldedTankFocus(8, 0, 7, 2, 1)).toBe(0);
    expect(stepFoldedTankFocus(7, 3, 7, 2, -1)).toBe(3);
  });

  it('stays on the Menu button when no axolotl is owned', () => {
    expect(stepFoldedTankFocus(6, 6, 7, 0, 1)).toBe(6);
    expect(stepFoldedTankFocus(6, 6, 7, 0, -1)).toBe(6);
  });

  it('goes to the Menu button forward and the last axolotl backward from a folded action or no focus', () => {
    expect(stepFoldedTankFocus(2, 6, 7, 3, 1)).toBe(6);
    expect(stepFoldedTankFocus(2, 6, 7, 3, -1)).toBe(9);
    expect(stepFoldedTankFocus(-1, 6, 7, 3, 0)).toBe(6);
    expect(stepFoldedTankFocus(Number.NaN, 6, 7, 3, 1)).toBe(6);
  });

  it('throws for a Menu button index that is not a whole number inside the hub buttons', () => {
    expect(() => stepFoldedTankFocus(0, -1, 7, 3, 1)).toThrow(RangeError);
    expect(() => stepFoldedTankFocus(0, 7, 7, 3, 1)).toThrow(RangeError);
    expect(() => stepFoldedTankFocus(0, 0.5, 7, 3, 1)).toThrow(RangeError);
    expect(() => stepFoldedTankFocus(0, 0, 0, 3, 1)).toThrow(RangeError);
  });

  it('leaves stepTankFocus stepping over every target', () => {
    expect(stepTankFocus(6, 7, 3, 1)).toBe(7);
    expect(stepTankFocus(0, 7, 3, 1)).toBe(1);
  });
});

describe('touchHitRect', () => {
  it('is the whole frame when that is already a big enough target', () => {
    expect(touchHitRect({ w: 148, h: 125 }, 1)).toEqual({ x: 0, y: 0, w: 148, h: 125 });
  });

  it('grows a small frame about its centre to the touch target size in CSS px', () => {
    const rect = touchHitRect({ w: 20, h: 10 }, 0.5);
    const minUnits = TOUCH_TARGET_PX / 0.5;
    expect(rect.w).toBeCloseTo(minUnits);
    expect(rect.h).toBeCloseTo(minUnits);
    expect(rect.x + rect.w / 2).toBeCloseTo(10);
    expect(rect.y + rect.h / 2).toBeCloseTo(5);
  });

  it('keeps the frame for a CSS scale that is not finite and positive', () => {
    expect(touchHitRect({ w: 20, h: 10 }, 0)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(touchHitRect({ w: 20, h: 10 }, Number.NaN)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
  });
});

describe('nameTagRect', () => {
  it('centres the tag across the sprite, a gap above it', () => {
    const target: Rect = { x: 300, y: 200, w: 140, h: 120 };
    expect(nameTagRect(target, TAG, VIEW)).toEqual({
      x: 300 + (140 - TAG.w) / 2,
      y: 200 - NAME_TAG_GAP - TAG.h,
      w: TAG.w,
      h: TAG.h,
    });
  });

  it('goes a gap below the sprite when above would cross the top margin', () => {
    const target: Rect = { x: 300, y: 40, w: 140, h: 120 };
    expect(nameTagRect(target, TAG, VIEW).y).toBe(40 + 120 + NAME_TAG_GAP);
  });

  it('is held inside the left and right margins', () => {
    const left = nameTagRect({ x: -60, y: 200, w: 100, h: 80 }, TAG, VIEW);
    expect(left.x).toBe(UI.margin);
    const right = nameTagRect({ x: 760, y: 200, w: 100, h: 80 }, TAG, VIEW);
    expect(right.x).toBe(VIEW.cssW - UI.margin - TAG.w);
    expect(insideMargins(left, VIEW) && insideMargins(right, VIEW)).toBe(true);
  });

  it('is held inside the bottom margin when below runs off the canvas', () => {
    const rect = nameTagRect({ x: 300, y: 20, w: 140, h: 580 }, TAG, VIEW);
    expect(rect.y).toBe(VIEW.cssH - UI.margin - TAG.h);
    expect(insideMargins(rect, VIEW)).toBe(true);
  });

  it('stays inside the margins wherever the sprite is', () => {
    const view: HudView = { cssW: 320, cssH: 440 };
    for (let x = -100; x <= 400; x += 50) {
      for (let y = -100; y <= 500; y += 50) {
        expect(insideMargins(nameTagRect({ x, y, w: 80, h: 70 }, TAG, view), view)).toBe(true);
      }
    }
  });

  it('keeps the left and top margins when the tag is bigger than the room', () => {
    const view: HudView = { cssW: 100, cssH: 50 };
    const rect = nameTagRect({ x: 20, y: 10, w: 40, h: 20 }, TAG, view);
    expect(rect.x).toBe(UI.margin);
    expect(rect.y).toBe(UI.margin);
  });
});
