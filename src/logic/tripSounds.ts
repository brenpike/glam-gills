/**
 * Pure trip sound mapping (PRD S3 to S8, S11; issue #165, ND-7 to ND-13): which sound, if any, each
 * trip moment plays. The router in the scenes keeps one TripSoundState per trip, passes each trip
 * event and game event through these rules, and plays the requests they give; it never builds notes.
 * Trip moments without a sound in this slice play nothing.
 */
import type { CollectedPayload, DashStatePayload } from './gameEvents';
import { climbSnackLadder, isLastThreeSnack, NEW_SNACK_LADDER, type SnackLadder } from './snackLadder';
import { ONLY_VERSION, soundVersion, type SoundId } from './sounds';
import { snackTurnStart } from './soundQueue';
import { starCount, type AreaStars } from './stars';
import type { DashPhase } from './tailDash';
import type { TripEvent } from './trip';

/** A sound to play: its id, its version, and the seconds to wait before it starts. */
export interface SoundRequest {
  readonly id: SoundId;
  readonly version: string;
  readonly delayS: number;
}

/** The most finds the bank sound counts; more banked finds play bank 5 (S7). */
export const BANK_SOUND_MAX = 5;

/**
 * A trip's sound state: the snack ladder, the last Dash phase seen (undefined before the first), whether
 * the exit has played its sound, and when the last snack's sound starts and rings out, in game time
 * seconds (undefined before the first snack). Snacks eaten at the same moment start
 * SOUND_LEVELS.snackGapS apart (S3; issue #165).
 */
export interface TripSoundState {
  readonly ladder: SnackLadder;
  readonly dashPhase: DashPhase | undefined;
  readonly exitOpened: boolean;
  readonly snackStartsAt: number | undefined;
  readonly snackEndsAt: number | undefined;
}

/** The sound state at the start of a trip. */
export const NEW_TRIP_SOUNDS: TripSoundState = Object.freeze({
  ladder: NEW_SNACK_LADDER,
  dashPhase: undefined,
  exitOpened: false,
  snackStartsAt: undefined,
  snackEndsAt: undefined,
});

/** A trip sound state after a game event, and the sound the event plays (null for none). */
export interface TripSoundStep {
  state: TripSoundState;
  request: SoundRequest | null;
}

/** A request for version `version` of sound `id`, starting `delayS` seconds from now. */
function soundRequest(id: SoundId, version: string = ONLY_VERSION, delayS: number = 0): SoundRequest {
  return { id, version, delayS };
}

/**
 * The sound a trip event plays, or null for none: a find by its rarity (S4), the uh-oh for a hit
 * that costs a leg (S5; ND-11), the regrowth when a leg is back (S5), and banking by the number of
 * finds banked, rescued axolotls included, up to BANK_SOUND_MAX (S7; ND-12).
 */
export function tripEventSound(event: Readonly<TripEvent>): SoundRequest | null {
  switch (event.type) {
    case 'pickedUp':
      return soundRequest('find', event.found.rarity);
    case 'hit':
      return soundRequest('uhOh');
    case 'regrown':
      return soundRequest('regrow');
    case 'banked':
      return bankSound(event.ids.length);
    case 'telegraph':
    case 'lunge':
    case 'shellBlock':
    case 'bump':
    case 'regrowStart':
    case 'protectedEnd':
    case 'containerBroken':
    case 'dashNeeded':
    case 'rescued':
    case 'carryStart':
    case 'arrivedHome':
    case 'wormSpat':
    case 'snagged':
      return null;
    default: {
      const unhandled: never = event;
      throw new Error(`tripSounds: no rule for trip event ${JSON.stringify(unhandled)}`);
    }
  }
}

/** The bank sound for `count` banked finds, capped at BANK_SOUND_MAX; null when nothing was banked. */
function bankSound(count: number): SoundRequest | null {
  if (count < 1) return null;
  return soundRequest('bank', String(Math.min(count, BANK_SOUND_MAX)));
}

/**
 * A snack eaten at game time `now` (COLLECTED): one of the last 3 snacks plays the last-3 twinkle
 * and leaves the ladder as it is (ND-8); any other snack plays its ladder step and climbs (S3). Its
 * sound starts SOUND_LEVELS.snackGapS after the last snack's if that is later than `now` (issue #165).
 */
export function collectedSound(state: Readonly<TripSoundState>, payload: Readonly<CollectedPayload>, now: number): TripSoundStep {
  const startAt = snackTurnStart(state.snackStartsAt, now);
  if (isLastThreeSnack(payload)) {
    return {
      state: { ...state, snackStartsAt: startAt, snackEndsAt: startAt + soundVersion('lastThree').seconds },
      request: soundRequest('lastThree'),
    };
  }
  const { step, ladder } = climbSnackLadder(state.ladder, now);
  const version = String(step);
  return {
    state: { ...state, ladder, snackStartsAt: startAt, snackEndsAt: startAt + soundVersion('snack', version).seconds },
    request: soundRequest('snack', version),
  };
}

/**
 * Every snack eaten at game time `now` (ALL_COLLECTED): the exit opens, once per trip, starting once
 * the last snack's sound has rung out (S8; ND-9).
 */
export function allCollectedSound(state: Readonly<TripSoundState>, now: number): TripSoundStep {
  if (state.exitOpened) return { state, request: null };
  const delayS = state.snackEndsAt === undefined ? 0 : Math.max(0, state.snackEndsAt - now);
  return { state: { ...state, exitOpened: true }, request: soundRequest('exitOpens', ONLY_VERSION, delayS) };
}

/** A Dash state (DASH_STATE): Tail Dash plays only when the phase goes into 'dashing', once per Dash (S6; ND-10). */
export function dashStateSound(state: Readonly<TripSoundState>, payload: Readonly<DashStatePayload>): TripSoundStep {
  const starts = payload.phase === 'dashing' && state.dashPhase !== 'dashing';
  return { state: { ...state, dashPhase: payload.phase }, request: starts ? soundRequest('dash') : null };
}

/**
 * The area beaten with the stars earned this trip (S8; ND-13). Throws for no stars: a beaten area
 * always earns the exit star.
 */
export function areaBeatenSound(stars: Readonly<AreaStars>): SoundRequest {
  const count = starCount(stars);
  if (count < 1) throw new Error('tripSounds: a beaten area earns at least 1 star');
  return soundRequest('areaBeaten', String(count));
}
