/**
 * Pure trip sound mapping (PRD S3 to S11; issue #165, ND-7 to ND-13; issue #166, ND-2 to ND-16):
 * which sound, if any, each trip moment plays. The router in the scenes keeps one TripSoundState per
 * trip, passes each trip event, game event and frame through these rules, and plays the requests
 * they give, in the order given; it never builds notes. A trip event can also ask for a follow-on
 * sound after its own (the Paint shell after its find, the rescue's safe moment after its bank), and
 * each frame asks for the hazard edges from src/logic/hazardSounds.ts. Trip moments without a sound
 * play nothing.
 */
import type { CollectedPayload, DashStatePayload } from './gameEvents';
import { hazardSnapshot, hazardSoundEdges, type HazardSnapshot, type HazardSoundTrip, type ViewRect } from './hazardSounds';
import { isAxolotlFindId } from './morphs';
import { climbSnackLadder, isLastThreeSnack, NEW_SNACK_LADDER, type SnackLadder } from './snackLadder';
import { ONLY_VERSION, type SoundId } from './sounds';
import { starCount, type AreaStars } from './stars';
import type { DashPhase } from './tailDash';
import type { TripEvent } from './trip';
import type { CollectibleKind } from './zone';

/** A sound to play: its id, its version, and the seconds to wait before it starts. */
export interface SoundRequest {
  readonly id: SoundId;
  readonly version: string;
  readonly delayS: number;
}

/** The most finds the bank sound counts; more banked finds play bank 5 (S7). */
export const BANK_SOUND_MAX = 5;

/**
 * A trip's sound state: the snack ladder, the last Dash phase seen (undefined before the first),
 * whether the exit has played its sound, and the hazard snapshot of the last frame (undefined before
 * the first frame).
 */
export interface TripSoundState {
  readonly ladder: SnackLadder;
  readonly dashPhase: DashPhase | undefined;
  readonly exitOpened: boolean;
  readonly hazards: HazardSnapshot | undefined;
}

/** The sound state at the start of a trip. */
export const NEW_TRIP_SOUNDS: TripSoundState = Object.freeze({
  ladder: NEW_SNACK_LADDER,
  dashPhase: undefined,
  exitOpened: false,
  hazards: undefined,
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
 * finds banked, rescued axolotls included, up to BANK_SOUND_MAX (S7; ND-12). Issue #166: a
 * predator's warning plays the ripple (S9; ND-3), the Shell perk's block its own sound (ND-10), the
 * carry home the lullaby (S10; ND-11), a sealed Dash pot touched without dashing the wobble and a
 * broken one the Dash pot (ND-12), meeting a stranded axolotl the rescue meeting (ND-16), a plastic
 * worm spat out the bleh (S11; ND-8) and a ghost net's snag the snag (S11; ND-7). The strike, the
 * bump, the regrowth's start, the end of protected time and the arrival home play nothing.
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
      return soundRequest('ripple');
    case 'shellBlock':
      return soundRequest('shellBlock');
    case 'carryStart':
      return soundRequest('lullaby');
    case 'dashNeeded':
      return soundRequest('potWobble');
    case 'containerBroken':
      return soundRequest('dashPot');
    case 'rescued':
      return soundRequest('rescueMeet');
    case 'wormSpat':
      return soundRequest('bleh');
    case 'snagged':
      return soundRequest('snag');
    case 'lunge':
    case 'bump':
    case 'regrowStart':
    case 'protectedEnd':
    case 'arrivedHome':
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
 * The follow-on sound a trip event asks for after its own sound from tripEventSound, or null for
 * none (issue #166): a Paint shell picked up plays the painted shell after its find (ND-14), and a
 * bank that holds a rescued axolotl plays the rescue's safe moment after the bank (ND-16). The sound
 * queue gives each its turn after the sound ahead of it.
 */
export function tripEventFollowOnSound(event: Readonly<TripEvent>): SoundRequest | null {
  if (event.type === 'pickedUp' && event.found.category === 'paintShell') return soundRequest('paintShell');
  if (event.type === 'banked' && event.ids.some(isAxolotlFindId)) return soundRequest('rescueSafe');
  return null;
}

/**
 * What collectedSound reads of a snack eaten: the COLLECTED payload and the snack's kind (issue #166,
 * ND-2). An absent kind is a plain snack.
 */
export interface CollectedSoundInput extends Readonly<Pick<CollectedPayload, 'id' | 'collected' | 'total'>> {
  readonly kind?: CollectibleKind;
}

/**
 * A snack eaten at game time `now` (COLLECTED): one of the last 3 snacks plays the last-3 twinkle
 * and leaves the ladder as it is (ND-8); any other snack plays its ladder step and climbs (S3). A
 * tadpole or shrimp caught from its flick plays the catch on its ladder step instead (issue #166,
 * ND-2). The sound queue starts snacks eaten at the same moment SOUND_LEVELS.snackGapS apart (issue #165).
 */
export function collectedSound(state: Readonly<TripSoundState>, payload: Readonly<CollectedSoundInput>, now: number): TripSoundStep {
  if (isLastThreeSnack(payload)) return { state, request: soundRequest('lastThree') };
  const { step, ladder } = climbSnackLadder(state.ladder, now);
  const caught = payload.kind === 'tadpole' || payload.kind === 'shrimp';
  return { state: { ...state, ladder }, request: soundRequest(caught ? 'catchSnack' : 'snack', String(step)) };
}

/**
 * Every snack eaten (ALL_COLLECTED): the exit opens, once per trip (S8; ND-9). It is asked for at once,
 * after the last snack's own ask, and the sound queue starts it once the last snack's sound has rung
 * out on the audio clock (issue #165).
 */
export function allCollectedSound(state: Readonly<TripSoundState>): TripSoundStep {
  if (state.exitOpened) return { state, request: null };
  return { state: { ...state, exitOpened: true }, request: soundRequest('exitOpens') };
}

/**
 * A Dash state (DASH_STATE): Tail Dash plays only when the phase goes into 'dashing', once per Dash
 * (S6; ND-10), and Dash ready plays only when the phase goes from 'cooldown' to 'ready', once per
 * recharge (issue #166, ND-13). The first Dash state of a trip comes from no phase, so it is never a
 * recharge.
 */
export function dashStateSound(state: Readonly<TripSoundState>, payload: Readonly<DashStatePayload>): TripSoundStep {
  const next = { ...state, dashPhase: payload.phase };
  if (payload.phase === 'dashing' && state.dashPhase !== 'dashing') return { state: next, request: soundRequest('dash') };
  if (payload.phase === 'ready' && state.dashPhase === 'cooldown') return { state: next, request: soundRequest('dashReady') };
  return { state: next, request: null };
}

/** The exit still closed when the axolotl swims into it (EXIT_CLOSED; issue #166, ND-9). */
export function exitClosedSound(): SoundRequest {
  return soundRequest('exitClosed');
}

/** No sound requests. Shared, so a frame with none allocates nothing. */
const NO_REQUESTS: readonly SoundRequest[] = Object.freeze([]);

/** One shrimp flick for each shrimp in `ids` that starts a flick this step, in their order (issue #166, ND-15). */
export function shrimpFlickSounds(ids: readonly string[]): readonly SoundRequest[] {
  if (ids.length === 0) return NO_REQUESTS;
  return ids.map(() => soundRequest('shrimpFlick'));
}

/** A trip sound state after a frame, and the sounds the frame plays in order (empty for none). */
export interface TripFrameStep {
  state: TripSoundState;
  requests: readonly SoundRequest[];
}

/** Whether `events` hold a predator's warning, which asks for the ripple on its own. */
function hasTelegraph(events: readonly Readonly<TripEvent>[]): boolean {
  for (const event of events) if (event.type === 'telegraph') return true;
  return false;
}

/**
 * The hazard sounds of one frame of `trip` with the camera's world view `view` (issue #166, ND-4 to
 * ND-7): wriggle free when a snag ends, the ripple when an on-screen punting pole starts its warning,
 * and the mats opening, in that order, from the edges of hazardSoundEdges against the last frame's
 * snapshot. A frame whose trip events `events` hold a predator's warning already asked for the
 * ripple, so the pole adds none (Q2). The first frame of a trip plays nothing. The frame's snapshot
 * is recorded every frame, whatever the trip phase.
 */
export function tripFrameSounds(
  state: Readonly<TripSoundState>,
  trip: HazardSoundTrip,
  view: ViewRect,
  events: readonly Readonly<TripEvent>[],
): TripFrameStep {
  const edges = hazardSoundEdges(state.hazards, trip, view);
  const next = { ...state, hazards: hazardSnapshot(trip) };
  const ripple = edges.poleWarned && !hasTelegraph(events);
  if (!edges.snagEnded && !ripple && !edges.matsOpened) return { state: next, requests: NO_REQUESTS };
  const requests: SoundRequest[] = [];
  if (edges.snagEnded) requests.push(soundRequest('wriggleFree'));
  if (ripple) requests.push(soundRequest('ripple'));
  if (edges.matsOpened) requests.push(soundRequest('matsOpen'));
  return { state: next, requests };
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
