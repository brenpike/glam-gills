/**
 * Pure find wait rule (PRD S4): only one find sound plays at a time, and a second waits for the first
 * to end. From the end of the last find's slot and the current time, gives when the next find starts
 * and when its slot ends. Times are in seconds on one clock, such as the audio clock.
 */

/** One find sound's slot: when it starts and when it ends, in seconds. */
export interface FindSlot {
  readonly startAt: number;
  readonly endsAt: number;
}

/**
 * The slot of a find sound `seconds` long asked for at `now`, after a last find slot that ends at
 * `lastEndsAt` (undefined if no find has played). It starts at `now`, or when the last find ends if
 * that is later, and ends `seconds` after its start.
 */
export function nextFindSlot(lastEndsAt: number | undefined, now: number, seconds: number): FindSlot {
  const startAt = lastEndsAt === undefined ? now : Math.max(now, lastEndsAt);
  return { startAt, endsAt: startAt + seconds };
}
