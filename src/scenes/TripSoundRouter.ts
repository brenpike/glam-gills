/**
 * The per-trip sound router (PRD S3 to S11; issue #165, ND-5 and ND-7; issue #166). SwimScene makes
 * one each trip and feeds it every trip and encounter event it dispatches, the shrimp that start a
 * flick, and each frame's trip and camera view; the router also hears the snack, Dash and closed exit
 * game events. It asks src/logic/tripSounds.ts what each moment plays and plays it as the trip's own
 * sounds (ownSounds), so the trip's sounds still waiting their turn, a lullaby or a rescue's safe
 * moment included, drop when it ends; it never builds notes. Trip moments without a sound play
 * nothing.
 */
import type * as Phaser from 'phaser';
import { GAME_EVENTS, type CollectedPayload, type DashStatePayload } from '../logic/gameEvents';
import type { HazardSoundTrip, ViewRect } from '../logic/hazardSounds';
import type { TripEvent } from '../logic/trip';
import {
  NEW_TRIP_SOUNDS,
  allCollectedSound,
  collectedSound,
  dashStateSound,
  exitClosedSound,
  shrimpFlickSounds,
  tripEventFollowOnSound,
  tripEventSound,
  tripFrameSounds,
  type SoundRequest,
  type TripSoundState,
  type TripSoundStep,
} from '../logic/tripSounds';
import { ownSounds, type SoundOwner } from '../platform/soundPlayer';

/** No trip events. Shared, so a frame with no predator's warning allocates nothing. */
const NO_EVENTS: readonly TripEvent[] = Object.freeze([]);

/** Plays one trip's sounds. Call destroy when the trip's scene shuts down. */
export class TripSoundRouter {
  private state: TripSoundState = NEW_TRIP_SOUNDS;
  /** The trip's sounds, so the ones still waiting their turn can be dropped when the trip ends. */
  private readonly sounds: SoundOwner = ownSounds();
  /**
   * The trip events since the last frame that hold a predator's warning, which already asked for the
   * ripple (Q2); NO_EVENTS when none did.
   */
  private telegraphEvents: readonly TripEvent[] = NO_EVENTS;

  /**
   * Listens on `scene`'s game events for one trip. `gameTime` gives the trip's game time in seconds,
   * which stops while the game is paused or hidden.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gameTime: () => number,
  ) {
    scene.game.events.on(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    scene.game.events.on(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    scene.game.events.on(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
    scene.game.events.on(GAME_EVENTS.EXIT_CLOSED, this.handleExitClosed, this);
  }

  /**
   * Plays the sound of each trip or encounter event that has one, then its follow-on sound, in order
   * (S4, S5, S7, S9 to S11; issue #166), and notes a predator's warning for this frame's ripple.
   */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type === 'telegraph') this.telegraphEvents = events;
      const request = tripEventSound(event);
      if (request !== null) this.playRequest(request);
      const followOn = tripEventFollowOnSound(event);
      if (followOn !== null) this.playRequest(followOn);
    }
  }

  /** Plays a shrimp flick for each shrimp in `ids` that starts a flick this step (issue #166, ND-15). */
  handleShrimpFlicks(ids: readonly string[]): void {
    for (const request of shrimpFlickSounds(ids)) this.playRequest(request);
  }

  /**
   * Plays the hazard sounds of one frame of `trip` with the camera's world view `view` (S9, S11;
   * issue #166, ND-4 to ND-7). Call once a frame, right after the trip step.
   */
  handleFrame(trip: HazardSoundTrip, view: ViewRect): void {
    const step = tripFrameSounds(this.state, trip, view, this.telegraphEvents);
    this.state = step.state;
    this.telegraphEvents = NO_EVENTS;
    for (const request of step.requests) this.playRequest(request);
  }

  /**
   * Stops listening and drops the trip's sounds still waiting their turn, the exit's, a lullaby and a
   * rescue's safe moment included (S3, S4, S8, S10; issues #165 and #166). Its sounds that have
   * started ring out.
   */
  destroy(): void {
    this.scene.game.events.off(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    this.scene.game.events.off(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    this.scene.game.events.off(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
    this.scene.game.events.off(GAME_EVENTS.EXIT_CLOSED, this.handleExitClosed, this);
    this.sounds.dropWaiting();
  }

  private handleCollected(payload: CollectedPayload): void {
    this.applyStep(collectedSound(this.state, payload, this.gameTime()));
  }

  private handleAllCollected(): void {
    this.applyStep(allCollectedSound(this.state));
  }

  private handleDashState(payload: DashStatePayload): void {
    this.applyStep(dashStateSound(this.state, payload));
  }

  private handleExitClosed(): void {
    this.playRequest(exitClosedSound());
  }

  private applyStep(step: TripSoundStep): void {
    this.state = step.state;
    if (step.request !== null) this.playRequest(step.request);
  }

  /** Asks the sound queue for `request` as one of the trip's sounds; the queue gives it its turn. */
  private playRequest(request: SoundRequest): void {
    this.sounds.play(request.id, request.version);
  }
}
