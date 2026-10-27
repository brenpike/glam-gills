import { describe, expect, it } from 'vitest';
import { SPARKLE_SNACKS_LEFT } from './collectibles';
import { climbSnackLadder, isLastThreeSnack, NEW_SNACK_LADDER, SNACK_LADDER, type SnackLadder } from './snackLadder';
import { SOUNDS } from './sounds';

/** The steps played by snacks eaten at each of `times`, from a new ladder. */
function stepsAt(times: readonly number[]): number[] {
  let ladder: SnackLadder = NEW_SNACK_LADDER;
  const steps: number[] = [];
  for (const now of times) {
    const climb = climbSnackLadder(ladder, now);
    steps.push(climb.step);
    ladder = climb.ladder;
  }
  return steps;
}

describe('the snack ladder (S3; issue #165, ND-5)', () => {
  it('starts at step 0 and climbs one step per snack', () => {
    expect(stepsAt([0, 0.5, 1, 1.5])).toEqual([0, 1, 2, 3]);
  });

  it('stops at step 9', () => {
    const times = Array.from({ length: 14 }, (_, i) => i * 0.3);
    expect(stepsAt(times)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9, 9]);
    expect(SNACK_LADDER.topStep).toBe(9);
  });

  it('has a snack version for every step it plays', () => {
    for (let step = 0; step <= SNACK_LADDER.topStep; step++) expect(SOUNDS.snack.versions[String(step)]).toBeDefined();
  });

  it('starts again at step 0 after more than 2.2 seconds without a ladder snack', () => {
    expect(SNACK_LADDER.resetS).toBe(2.2);
    expect(stepsAt([0, 1, 3, 5.5, 6])).toEqual([0, 1, 2, 0, 1]);
  });

  it('keeps climbing at exactly 2.2 seconds', () => {
    expect(stepsAt([0, 2.2])).toEqual([0, 1]);
  });

  it('climbs one step for each of several snacks eaten in one frame', () => {
    expect(stepsAt([4, 4, 4])).toEqual([0, 1, 2]);
  });

  it('plays the ladder step and climbs when the last snack was within 2.2 seconds of game time', () => {
    const climb = climbSnackLadder({ step: 4, lastAt: 7 }, 8);
    expect(climb).toEqual({ step: 4, ladder: { step: 5, lastAt: 8 } });
  });

  it('leaves the ladder it is given unchanged', () => {
    const ladder: SnackLadder = { step: 2, lastAt: 1 };
    climbSnackLadder(ladder, 1.5);
    expect(ladder).toEqual({ step: 2, lastAt: 1 });
  });
});

describe('the last 3 snacks (S3, H3; issue #165, ND-8)', () => {
  it('is only each snack that was sparkling when eaten, not the 4th-from-last that starts the sparkle', () => {
    expect(SPARKLE_SNACKS_LEFT).toBe(3);
    expect(isLastThreeSnack({ collected: 7, total: 10 })).toBe(false);
    expect(isLastThreeSnack({ collected: 8, total: 10 })).toBe(true);
    expect(isLastThreeSnack({ collected: 9, total: 10 })).toBe(true);
    expect(isLastThreeSnack({ collected: 10, total: 10 })).toBe(true);
  });

  it('is every snack of an area with 3 or fewer', () => {
    for (let collected = 1; collected <= 3; collected++) expect(isLastThreeSnack({ collected, total: 3 })).toBe(true);
  });

  it('is exactly 3 snacks of a bigger area', () => {
    const total = 20;
    const lastThree = Array.from({ length: total }, (_, i) => isLastThreeSnack({ collected: i + 1, total })).filter(Boolean);
    expect(lastThree).toHaveLength(SPARKLE_SNACKS_LEFT);
  });
});
