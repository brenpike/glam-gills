/**
 * The per-trip sound router (PRD S3 to S8, S11; issue #165, ND-5 and ND-7). SwimScene makes one each
 * trip and feeds it every trip and encounter event it dispatches; the router also hears the snack and
 * Dash game events. It asks src/logic/tripSounds.ts what each moment plays and plays it; it never
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
import { dropWaitingFinds, playSound } from '../platform/soundPlayer';

/** Plays one trip's sounds. Call destroy when the trip's scene shuts down. */
export class TripSoundRouter {
  private state: TripSoundState = NEW_TRIP_SOUNDS;
  /** A delayed sound waiting on the scene's clock: the exit sound until the last snack's sound rings out. */
  private pendingSound: Phaser.Time.TimerEvent | null = null;

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

  /** Stops listening, drops a waiting delayed sound, and drops the trip's finds still waiting to play (S4). */
  destroy(): void {
    this.scene.game.events.off(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    this.scene.game.events.off(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    this.scene.game.events.off(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
    this.pendingSound?.remove();
    this.pendingSound = null;
    dropWaitingFinds();
  }

  private handleCollected(payload: CollectedPayload): void {
    this.applyStep(collectedSound(this.state, payload, this.gameTime()));
  }

  private handleAllCollected(): void {
    this.applyStep(allCollectedSound(this.state, this.gameTime()));
  }

  private handleDashState(payload: DashStatePayload): void {
    this.applyStep(dashStateSound(this.state, payload));
  }

  private applyStep(step: TripSoundStep): void {
    this.state = step.state;
    if (step.request !== null) this.playRequest(step.request);
  }

  /** Plays `request` now, or after its delay on the scene's clock, which stops while paused or hidden. */
  private playRequest(request: SoundRequest): void {
    if (request.delayS <= 0) {
      playSound(request.id, request.version);
      return;
    }
    this.pendingSound?.remove();
    this.pendingSound = this.scene.time.delayedCall(request.delayS * 1000, this.playDelayed, [request], this);
  }

  private playDelayed(request: SoundRequest): void {
    this.pendingSound = null;
    playSound(request.id, request.version);
  }
}
