/**
 * The first-hit tip (PRD A23, issue #230): a one-time run of short banner pages that tells a new
 * player what the legs mean after the first hit that costs a leg. Pure; the swim scene steps it and
 * the HUD draws it.
 *
 * It shows once per save. A save with the tip seen starts 'done'. A hit that costs a leg meets it;
 * a hit a Shell perk blocks does not. A met tip waits until the axolotl swims free: out of protected
 * time, out of every threat's reach, and with no other tip on screen (`busy`). Each page shows for
 * FIRST_HIT_TIP.holdS seconds, then the next page follows, and the tip ends after the last. Its time
 * runs, and a page counts as seen, only while it is on screen: not while the HUD holds it for want
 * of room (X10). Leaving the swim, a threat, protected time, or another hit hides it; a tip whose
 * last page was not seen yet waits and shows that page again later.
 */
import { inThreatReach } from './dashPotTip';
import type { EncounterContext } from './encounter';
import { isProtected } from './legs';
import type { TripEvent, TripState } from './trip';
import { LEGS, type LegTuning } from './tuning';
import type { Point } from './zone';

/** First-hit tip values: how long each page is on screen, in seconds. */
export const FIRST_HIT_TIP = Object.freeze({ holdS: 4 });

/** The tip's pages, in order, with the regrowth numbers from `tuning` (rounded to whole seconds). */
export function firstHitTipPages(
  tuning: Pick<LegTuning, 'regrowTime' | 'snackSpeedUp'> = LEGS,
): readonly string[] {
  const regrowS = Math.round(tuning.regrowTime);
  const snackS = Math.max(1, Math.round(tuning.snackSpeedUp * tuning.regrowTime));
  return Object.freeze([
    'Your legs up top are your health!',
    `Lost legs grow back in about ${regrowS} seconds.`,
    `Each snack takes about ${snackS} seconds off!`,
    'Regrowth Wearables grow legs back faster.',
    'Shell Wearables block one hit a trip!',
  ]);
}

/** The tip's pages with the game's leg tuning. */
export const FIRST_HIT_TIP_PAGES: readonly string[] = firstHitTipPages(LEGS);

const LAST_PAGE = FIRST_HIT_TIP_PAGES.length - 1;

/**
 * Where the tip is in a trip. 'unseen': no hit yet. 'waiting': met, held at `page` until the
 * axolotl swims free. 'showing': `page` up, with `leftS` seconds left; `seen` once it was on screen
 * for a step (not held for want of room). 'done': seen or not needed; it never shows again.
 */
export type FirstHitTipState =
  | { phase: 'unseen' }
  | { phase: 'waiting'; page: number }
  | { phase: 'showing'; page: number; leftS: number; seen: boolean }
  | { phase: 'done' };

/** What the HUD does with the tip after a step: show it, turn to the next page, hide it, or nothing. */
export type FirstHitTipCue = 'show' | 'page' | 'hide' | null;

/** Result of a tip step or press. */
export interface FirstHitTipStep {
  state: FirstHitTipState;
  cue: FirstHitTipCue;
}

/** The saved part the tip reads: whether the tip was seen. */
export interface FirstHitTipSave {
  readonly firstHitTipSeen: boolean;
}

/**
 * Input for one tip step: the trip after its step, that step's events, the axolotl centre, the step
 * in seconds, whether the HUD holds the tip off screen for want of room (`held`, absent false), and
 * whether another tip is on screen (`busy`, absent false).
 */
export interface FirstHitTipInput {
  trip: Pick<TripState, 'phase' | 'encounter'>;
  events: readonly TripEvent[];
  pos: Point;
  dt: number;
  held?: boolean;
  busy?: boolean;
  ctx?: EncounterContext;
}

type WaitingTip = Extract<FirstHitTipState, { phase: 'waiting' }>;
type ShowingTip = Extract<FirstHitTipState, { phase: 'showing' }>;

const UNSEEN: FirstHitTipState = Object.freeze({ phase: 'unseen' });
const DONE: FirstHitTipState = Object.freeze({ phase: 'done' });

/** The tip state a trip starts with: 'done' when the save has the tip seen, else 'unseen'. */
export function createFirstHitTip(save: FirstHitTipSave): FirstHitTipState {
  return save.firstHitTipSeen ? DONE : UNSEEN;
}

/** Whether the tip counts as seen for the save: done, or showing its last page already on screen. */
export function firstHitTipSeen(state: FirstHitTipState): boolean {
  return state.phase === 'done' || (state.phase === 'showing' && state.page === LAST_PAGE && state.seen);
}

/** A showing page `page` with its whole hold time, not seen yet. */
function showPage(page: number): FirstHitTipState {
  return { phase: 'showing', page, leftS: FIRST_HIT_TIP.holdS, seen: false };
}

/** The tip hidden from showing: done once its last page was seen, else waiting at the same page. */
function hideShowing(state: ShowingTip): FirstHitTipStep {
  return { state: firstHitTipSeen(state) ? DONE : { phase: 'waiting', page: state.page }, cue: 'hide' };
}

/** The tip after a page's time runs out or the player presses on: the next page, or done after the last. */
function turnPage(page: number): FirstHitTipStep {
  return page >= LAST_PAGE ? { state: DONE, cue: 'hide' } : { state: showPage(page + 1), cue: 'page' };
}

/** Whether the axolotl cannot take the tip now: protected time runs or a threat has it in reach. */
function inDanger(input: FirstHitTipInput): boolean {
  return isProtected(input.trip.encounter.legs) || inThreatReach(input.trip, input.pos, input.ctx);
}

/** Steps a showing tip: hides it, holds it, counts it down, or turns its page. */
function stepShowing(state: ShowingTip, input: FirstHitTipInput): FirstHitTipStep {
  if (input.trip.phase !== 'swimming') return hideShowing(state);
  if (input.events.some((event) => event.type === 'hit' || event.type === 'shellBlock')) return hideShowing(state);
  if (!(input.dt > 0) || !Number.isFinite(input.dt)) return { state, cue: null };
  if (inDanger(input)) return hideShowing(state);
  if (input.held === true) return { state, cue: null };
  const leftS = state.leftS - input.dt;
  if (leftS <= 0) return turnPage(state.page);
  return { state: { phase: 'showing', page: state.page, leftS, seen: true }, cue: null };
}

/**
 * Steps the tip. 'done' never changes. A 'hit' event turns 'unseen' into 'waiting' at page 0; a
 * 'shellBlock' event does not. 'waiting' (also on the step it was met) shows its page only on a
 * swimming step with a finite `dt` above 0, out of protected time, out of every threat's reach
 * (inThreatReach), and not `busy`. 'showing' counts down by `dt` only while not `held`, and its page
 * becomes seen on the first such step; once no time is left the next page shows (cue 'page'), or
 * the tip ends after the last (cue 'hide'). Leaving 'swimming', a threat, protected time, or a 'hit'
 * or 'shellBlock' event hides a showing tip: 'done' when its last page was seen, else 'waiting' at
 * the same page.
 */
export function stepFirstHitTip(state: FirstHitTipState, input: FirstHitTipInput): FirstHitTipStep {
  if (state.phase === 'done') return { state, cue: null };
  if (state.phase === 'showing') return stepShowing(state, input);
  const met = state.phase === 'waiting' || input.events.some((event) => event.type === 'hit');
  if (!met) return { state, cue: null };
  const waiting: WaitingTip = state.phase === 'waiting' ? state : { phase: 'waiting', page: 0 };
  if (input.trip.phase !== 'swimming') return { state: waiting, cue: null };
  if (!(input.dt > 0) || !Number.isFinite(input.dt)) return { state: waiting, cue: null };
  if (input.busy === true || inDanger(input)) return { state: waiting, cue: null };
  return { state: showPage(waiting.page), cue: 'show' };
}

/** The player presses the tip (a tap or a key): the next page, or done after the last; other states unchanged. */
export function pressFirstHitTip(state: FirstHitTipState): FirstHitTipStep {
  return state.phase === 'showing' ? turnPage(state.page) : { state, cue: null };
}
