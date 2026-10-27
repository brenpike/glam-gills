import { describe, expect, it } from 'vitest';
import { nextFindSlot, type FindSlot } from './findWait';

describe('nextFindSlot (S4)', () => {
  it('starts the first find at once', () => {
    expect(nextFindSlot(undefined, 3, 1.2)).toEqual({ startAt: 3, endsAt: 4.2 });
  });

  it('makes a second find wait until the first ends', () => {
    const first = nextFindSlot(undefined, 10, 2);
    const second = nextFindSlot(first.endsAt, 10.5, 1);
    expect(second).toEqual({ startAt: 12, endsAt: 13 });
  });

  it('plays a chain of finds one after another', () => {
    const lengths = [0.6, 1.1, 2.4, 0.9];
    const slots: FindSlot[] = [];
    let lastEndsAt: number | undefined;
    for (const seconds of lengths) {
      const slot = nextFindSlot(lastEndsAt, 5, seconds);
      slots.push(slot);
      lastEndsAt = slot.endsAt;
    }
    expect(slots[0].startAt).toBe(5);
    for (const [index, slot] of slots.entries()) {
      expect(slot.endsAt).toBeCloseTo(slot.startAt + lengths[index]);
      if (index > 0) expect(slot.startAt).toBe(slots[index - 1].endsAt);
    }
  });

  it('starts a find asked for after the last one ended at once', () => {
    expect(nextFindSlot(4, 6, 1.5)).toEqual({ startAt: 6, endsAt: 7.5 });
  });

  it('starts a find asked for exactly as the last one ends at once', () => {
    expect(nextFindSlot(6, 6, 1)).toEqual({ startAt: 6, endsAt: 7 });
  });

  it('never starts a find earlier than now', () => {
    const lastEnds: readonly (number | undefined)[] = [undefined, 0, 2, 4.99, 5, 5.01, 9];
    for (const lastEndsAt of lastEnds) {
      expect(nextFindSlot(lastEndsAt, 5, 1).startAt).toBeGreaterThanOrEqual(5);
    }
  });
});
