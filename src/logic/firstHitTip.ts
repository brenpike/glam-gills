/**
 * The first-hit tip (PRD A23, issue #230): a one-time card that pauses the swim, like a fact card,
 * and tells a new player what the legs mean after the first hit that costs a leg. Pure; the swim
 * scene steps it and the HUD draws it.
 *
 * It shows once per save. A save with the tip seen starts 'done'. A hit that costs a leg meets it;
 * a hit a Shell perk blocks does not. A met tip waits until the axolotl swims free: out of protected
 * time, out of every threat's reach, and with no fact card due. Closing the card ends it.
 */
import { CARD } from './cardFit';
import { inThreatReach } from './dashPotTip';
import type { EncounterContext } from './encounter';
import { HUD, type Rect } from './hudLayout';
import { isProtected } from './legs';
import { factCardDue, type TripEvent, type TripState } from './trip';
import { LEGS, type LegTuning } from './tuning';
import type { Point } from './zone';

/** `count` with "second" or "seconds" after it. */
function secondsText(count: number): string {
  return count === 1 ? '1 second' : `${count} seconds`;
}

/** The tip card's lines, in order, with the regrowth numbers from `tuning` (rounded to whole seconds). */
export function firstHitTipLines(
  tuning: Pick<LegTuning, 'regrowTime' | 'snackSpeedUp'> = LEGS,
): readonly string[] {
  const regrowS = Math.round(tuning.regrowTime);
  const snackS = Math.max(1, Math.round(tuning.snackSpeedUp * tuning.regrowTime));
  return Object.freeze([
    'Legs are your health!',
    `Lost legs grow back in ${secondsText(regrowS)}.`,
    `Each snack takes ${secondsText(snackS)} off!`,
    'Regrowth Wearables speed it up!',
    'Shell Wearables block one hit!',
  ]);
}

/** The tip card's lines with the game's leg tuning. */
export const FIRST_HIT_TIP_LINES: readonly string[] = firstHitTipLines(LEGS);

/** The tip card's body text: its lines, one per row. */
export const FIRST_HIT_TIP_BODY: string = FIRST_HIT_TIP_LINES.join('\n');

/** Where the tip card may sit: from `top` down, `availH` px tall, in CSS px. */
export interface FirstHitTipCardRoom {
  top: number;
  availH: number;
}

/**
 * The room for the tip card on a `cssH` px tall screen: from HUD.gap below the legs panel `legs`
 * down to CARD.margin above the bottom edge, never below 0 tall.
 */
export function firstHitTipCardRoom(cssH: number, legs: Rect): FirstHitTipCardRoom {
  const top = legs.y + legs.h + HUD.gap;
  return { top, availH: Math.max(0, cssH - top - CARD.margin) };
}

/**
 * Where the tip is in a save. 'unseen': no hit yet. 'waiting': met, shown whenever the axolotl
 * swims free, until closed. 'done': closed or not needed; it never shows again.
 */
export type FirstHitTipState = 'unseen' | 'waiting' | 'done';

/** Result of a tip step: the next state, and whether the card shows on this step. */
export interface FirstHitTipStep {
  state: FirstHitTipState;
  show: boolean;
}

/** The saved part the tip reads: whether the tip was seen. */
export interface FirstHitTipSave {
  readonly firstHitTipSeen: boolean;
}

/** Input for one tip step: the trip after its step, that step's events, the axolotl centre, and the step in seconds. */
export interface FirstHitTipInput {
  trip: Pick<TripState, 'phase' | 'encounter' | 'met' | 'factCardsSeen'>;
  events: readonly TripEvent[];
  pos: Point;
  dt: number;
  ctx?: EncounterContext;
}

/** The tip state a save starts with: 'done' when the save has the tip seen, else 'unseen'. */
export function createFirstHitTip(save: FirstHitTipSave): FirstHitTipState {
  return save.firstHitTipSeen ? 'done' : 'unseen';
}

/** Whether the tip counts as seen for the save: only once done. */
export function firstHitTipSeen(state: FirstHitTipState): boolean {
  return state === 'done';
}

/** Whether the axolotl swims free for the card: a live swimming step, out of danger, no fact card due. */
function swimsFree(input: FirstHitTipInput): boolean {
  if (input.trip.phase !== 'swimming') return false;
  if (!(input.dt > 0) || !Number.isFinite(input.dt)) return false;
  if (isProtected(input.trip.encounter.legs)) return false;
  if (inThreatReach(input.trip, input.pos, input.ctx)) return false;
  return factCardDue(input.trip) === null;
}

/**
 * Steps the tip. 'done' never changes. A 'hit' event turns 'unseen' into 'waiting'; a 'shellBlock'
 * event does not. A 'waiting' tip (also on the step it was met) shows only on a swimming step with
 * a finite `dt` above 0, out of protected time, out of every threat's reach (inThreatReach), and
 * with no fact card due (factCardDue); it stays 'waiting' while it shows, until closed.
 */
export function stepFirstHitTip(state: FirstHitTipState, input: FirstHitTipInput): FirstHitTipStep {
  if (state === 'done') return { state, show: false };
  const met = state === 'waiting' || input.events.some((event) => event.type === 'hit');
  if (!met) return { state, show: false };
  return { state: 'waiting', show: swimsFree(input) };
}

/** The player closes the card: 'waiting' becomes 'done'; other states unchanged. */
export function closeFirstHitTip(state: FirstHitTipState): FirstHitTipState {
  return state === 'waiting' ? 'done' : state;
}
