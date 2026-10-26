/**
 * The Dash pot tip (PRD B11, issue #149): a one-time banner that tells a new player to Tail Dash
 * into a Dash pot to break it. Pure; the swim scene steps it and the HUD draws it in the first-trip
 * hint's banner (X10).
 *
 * It shows once per save, for the first Dash pot ever met: the first time the axolotl bumps a
 * sealed pot without dashing (`dashNeeded`) or comes within DASH_POT_TIP.nearPx of one, whichever
 * comes first. A player who already knows never sees it: one whose save has the tip seen, or who
 * has a Legendary banked (Legendaries always hide in Dash pots). Breaking a pot before the tip
 * shows counts as knowing too. It waits while the axolotl is in any threat's reach, and a threat
 * reaching the axolotl while it shows closes it. It pauses and slows nothing.
 */
import { treasureById } from './catalogue';
import { predatorSpecies, type EncounterContext } from './encounter';
import { shapeDistance } from './hazards';
import { movingHazardPhase, movingHazardSweep } from './movingHazards';
import type { PlacedFind } from './placement';
import type { TripEvent, TripState } from './trip';
import type { Point } from './zone';

/** Dash pot tip values: the near distance in px from the axolotl centre to a pot, and how long it shows in seconds. */
export const DASH_POT_TIP = Object.freeze({ nearPx: 120, holdS: 5 });

/** The input the tip names the Tail Dash control for. */
export type TipInput = 'keyboard' | 'touch';

/** The tip's words for each input: the key, or the touch button (PRD B11, X6). */
export const DASH_POT_TIP_TEXT: Readonly<Record<TipInput, string>> = Object.freeze({
  keyboard: 'Tail Dash into the pot to break it! Press Space.',
  touch: 'Tail Dash into the pot to break it! Tap Dash.',
});

/**
 * Where the tip is in a trip. 'unseen': not met yet. 'waiting': met, held until the axolotl is out
 * of every threat's reach. 'showing': up, with `leftS` seconds left. 'done': shown, closed or not
 * needed; it never shows again.
 */
export type DashPotTipState =
  | { phase: 'unseen' }
  | { phase: 'waiting' }
  | { phase: 'showing'; leftS: number }
  | { phase: 'done' };

/** What the HUD does with the tip after a step: show it, hide it, or nothing. */
export type DashPotTipCue = 'show' | 'hide' | null;

/** Result of a tip step. */
export interface DashPotTipStep {
  state: DashPotTipState;
  cue: DashPotTipCue;
}

/** The saved parts the tip reads: the banked ids and whether the tip was seen. */
export interface DashPotTipSave {
  readonly banked: readonly string[];
  readonly dashPotTipSeen: boolean;
}

const UNSEEN: DashPotTipState = Object.freeze({ phase: 'unseen' });
const WAITING: DashPotTipState = Object.freeze({ phase: 'waiting' });
const DONE: DashPotTipState = Object.freeze({ phase: 'done' });

/** The tip's words for `input`. */
export function dashPotTipText(input: TipInput): string {
  return DASH_POT_TIP_TEXT[input];
}

/** Whether the player already knows how to break a Dash pot: the tip was seen on this save, or a Legendary is banked. */
export function knowsDashPots(save: DashPotTipSave): boolean {
  return save.dashPotTipSeen || save.banked.some((id) => treasureById(id)?.rarity === 'legendary');
}

/** The tip state a trip starts with: 'done' when the player already knows, else 'unseen'. */
export function createDashPotTip(save: DashPotTipSave): DashPotTipState {
  return knowsDashPots(save) ? DONE : UNSEEN;
}

/** Whether the tip counts as seen for the save: showing or done. */
export function dashPotTipSeen(state: DashPotTipState): boolean {
  return state.phase === 'showing' || state.phase === 'done';
}

/** Whether a sealed Dash pot is within `nearPx` of `pos` (inclusive). */
export function nearSealedPot(
  placed: readonly PlacedFind[],
  pos: Point,
  nearPx: number = DASH_POT_TIP.nearPx,
): boolean {
  return placed.some((find) => find.sealed && Math.hypot(find.x - pos.x, find.y - pos.y) <= nearPx);
}

/**
 * Whether the axolotl at `pos` is in a threat's reach: any predator warning or striking, anywhere;
 * any other predator with `pos` within its species' lunge range (inclusive); or a moving hazard
 * warning, jabbing, holding or lifting with `pos` within its touch reach of the shaft's sweep.
 */
export function inThreatReach(trip: Pick<TripState, 'encounter'>, pos: Point, ctx?: EncounterContext): boolean {
  const encounter = trip.encounter;
  const predatorNear = encounter.predators.some((predator) => {
    if (predator.phase === 'telegraph' || predator.phase === 'lunge') return true;
    const reach = predatorSpecies(encounter, predator, ctx).tuning.lungeRange;
    return Math.hypot(predator.pos.x - pos.x, predator.pos.y - pos.y) <= reach;
  });
  if (predatorNear) return true;
  const hazardTime = encounter.hazardTime ?? 0;
  return (encounter.movingHazards ?? []).some(
    (spawn) =>
      movingHazardPhase(spawn, hazardTime).phase !== 'rest' &&
      shapeDistance(pos, movingHazardSweep(spawn)) <= spawn.type.touchReach,
  );
}

/** Input for one tip step: the trip after its step, that step's events, the axolotl centre and the step in seconds. */
export interface DashPotTipInput {
  trip: Pick<TripState, 'phase' | 'placed' | 'encounter'>;
  events: readonly TripEvent[];
  pos: Point;
  dt: number;
  ctx?: EncounterContext;
}

/**
 * Steps the tip. 'done' never changes. A pot broken this step makes any other state 'done', and
 * hides the tip when it shows. Only swimming steps with `dt` above 0 do anything else.
 * 'unseen' becomes 'waiting' on a `dashNeeded` event or with a sealed pot near (nearSealedPot).
 * 'waiting' (also on the step it was met) shows the tip when the axolotl is not in a threat's
 * reach (inThreatReach). 'showing' counts down by `dt` and hides the tip once no time is left or a
 * threat reaches the axolotl. Leaving 'swimming' while it shows hides it.
 */
export function stepDashPotTip(state: DashPotTipState, input: DashPotTipInput): DashPotTipStep {
  if (state.phase === 'done') return { state, cue: null };
  const showing = state.phase === 'showing';
  if (input.events.some((event) => event.type === 'containerBroken')) {
    return { state: DONE, cue: showing ? 'hide' : null };
  }
  if (input.trip.phase !== 'swimming') return showing ? { state: DONE, cue: 'hide' } : { state, cue: null };
  if (!(input.dt > 0) || !Number.isFinite(input.dt)) return { state, cue: null };
  if (state.phase === 'showing') {
    const leftS = state.leftS - input.dt;
    if (leftS <= 0 || inThreatReach(input.trip, input.pos, input.ctx)) return { state: DONE, cue: 'hide' };
    return { state: { phase: 'showing', leftS }, cue: null };
  }
  const met =
    state.phase === 'waiting' ||
    input.events.some((event) => event.type === 'dashNeeded') ||
    nearSealedPot(input.trip.placed, input.pos);
  if (!met) return { state, cue: null };
  if (inThreatReach(input.trip, input.pos, input.ctx)) return { state: WAITING, cue: null };
  return { state: { phase: 'showing', leftS: DASH_POT_TIP.holdS }, cue: 'show' };
}

/** The tip closed by the player (a tap or a key): 'done' with the tip hidden when it shows, else unchanged. */
export function closeDashPotTip(state: DashPotTipState): DashPotTipStep {
  return state.phase === 'showing' ? { state: DONE, cue: 'hide' } : { state, cue: null };
}
