/**
 * Pure snack ladder rule (PRD S3; issue #165, ND-5 and ND-8): snacks eaten close together climb the
 * scale one step each, from step 0 up to step 9, and a pause starts the ladder again from step 0.
 * The ladder runs on the caller's game time in seconds, so it behaves the same with sounds off and
 * stops while the game is paused or hidden. Only the last 3 snacks, the ones that are themselves
 * sparkling when eaten (H3), play the last-3 twinkle instead and leave the ladder as it is; the
 * 4th-from-last snack, whose eating starts the sparkle, climbs the ladder like any other.
 */
import { SPARKLE_SNACKS_LEFT } from './collectibles';
import type { CollectedPayload } from './gameEvents';

/** Snack ladder tuning (S3). */
export const SNACK_LADDER = Object.freeze({
  /** The highest step; the ladder stays there until it starts again. */
  topStep: 9,
  /** Seconds of game time after the last ladder snack beyond which the ladder starts again at step 0. */
  resetS: 2.2,
});

/** The ladder: the step the next snack plays, and the game time of the last ladder snack (undefined if none). */
export interface SnackLadder {
  readonly step: number;
  readonly lastAt: number | undefined;
}

/** A ladder at the bottom, with no snack eaten yet: the ladder at each new trip. */
export const NEW_SNACK_LADDER: SnackLadder = Object.freeze({ step: 0, lastAt: undefined });

/** The step a ladder snack plays and the ladder after it. */
export interface SnackLadderClimb {
  step: number;
  ladder: SnackLadder;
}

/**
 * A ladder snack eaten at game time `now` on `ladder`: it plays the ladder's step, or step 0 when
 * more than SNACK_LADDER.resetS seconds have passed since the last ladder snack, and the ladder
 * climbs one step, stopping at SNACK_LADDER.topStep.
 */
export function climbSnackLadder(ladder: Readonly<SnackLadder>, now: number): SnackLadderClimb {
  const paused = ladder.lastAt !== undefined && now - ladder.lastAt > SNACK_LADDER.resetS;
  const step = paused ? 0 : ladder.step;
  return { step, ladder: { step: Math.min(step + 1, SNACK_LADDER.topStep), lastAt: now } };
}

/**
 * Whether the snack just eaten, from its COLLECTED payload, was one of the last 3 snacks: it was
 * sparkling when eaten (H3), so fewer than SPARKLE_SNACKS_LEFT snacks are left after it. The
 * 4th-from-last snack, whose eating starts the sparkle, is not one (issue #165, ND-8).
 */
export function isLastThreeSnack(payload: Readonly<Pick<CollectedPayload, 'collected' | 'total'>>): boolean {
  return payload.total - payload.collected < SPARKLE_SNACKS_LEFT;
}
