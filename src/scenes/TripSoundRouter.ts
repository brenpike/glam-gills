/**
 * The per-trip sound router (PRD S3 to S8, S11; issue #165, ND-5 and ND-7). SwimScene makes one each
 * trip and feeds it every trip and encounter event it dispatches; the router also hears the snack and
 * Dash game events. It asks src/logic/tripSounds.ts what each moment plays and plays it as the trip's
 * own sounds (ownSounds), so the trip's sounds still waiting their turn drop when it ends; it never
 * builds notes. Trip moments without a sound in this slice play nothing.
 */
import type * as Phaser from 'phaser';
import { GAME_EVENTS, type CollectedPayload, type DashStatePayload } from '../logic/gameEvents';
import type { TripEvent } from '../logic/trip';
import {
  NEW_TRIP_SOUNDS,
  allCollectedSound,
  collectedSound,
  dashStateSound,
  tripEventSound,
  type SoundRequest,
  type TripSoundState,
  type TripSoundStep,
} from '../logic/tripSounds';
import { ownSounds, type SoundOwner } from '../platform/soundPlayer';

/** Plays one trip's sounds. Call destroy when the trip's scene shuts down. */
export class TripSoundRouter {
  private state: TripSoundState = NEW_TRIP_SOUNDS;
  /** The trip's sounds, so the ones still waiting their turn can be dropped when the trip ends. */
  private readonly sounds: SoundOwner = ownSounds();

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
  }

  /** Plays the sound of each trip or encounter event that has one (S4, S5, S7). */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      const request = tripEventSound(event);
      if (request !== null) this.playRequest(request);
    }
  }

  /**
   * Stops listening and drops the trip's sounds still waiting their turn, the exit's included (S3, S4,
   * S8; issue #165). Its sounds that have started ring out.
   */
  destroy(): void {
    this.scene.game.events.off(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    this.scene.game.events.off(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    this.scene.game.events.off(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
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

  private applyStep(step: TripSoundStep): void {
    this.state = step.state;
    if (step.request !== null) this.playRequest(step.request);
  }

  /** Asks the sound queue for `request` as one of the trip's sounds; the queue gives it its turn. */
  private playRequest(request: SoundRequest): void {
    this.sounds.play(request.id, request.version);
  }
}
