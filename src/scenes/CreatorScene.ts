import * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import { HOME_TANK_WALL } from '../art/palette';
import { GAME_EVENTS, REGISTRY_KEYS, type ReducedMotionPayload } from '../logic/gameEvents';
import { motionProfile, type MotionProfile } from '../logic/motion';
import { creatorStart, type StylerAxolotl } from '../logic/styler';
import { setMusicScreen } from '../platform/musicPlayer';
import { AxolotlStyler } from './AxolotlStyler';
import { SCENE_KEYS, readSceneView, useCssCamera, type GameAssets, type SceneView } from './BootScene';
import { finishCreator } from './sceneFlow';

const CAPTURED_KEYS: readonly number[] = [
  Phaser.Input.Keyboard.KeyCodes.TAB,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
  Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
];

/**
 * The first-launch character creator (PRD F1 to F3, F16, F17): the axolotl styler's step-by-step
 * creator on the Home Tank wall colour, with no cancel. It starts from creatorStart(): the default
 * look with a random boy or girl, a random suggested name that fits, and the starter morph. Done on
 * the last step hands the name, look and morph to the scene flow, once, which makes them the starter
 * and opens the Home Tank. Session only: nothing is saved to the device.
 */
export class CreatorScene extends Phaser.Scene {
  private assets!: GameAssets;
  private motion!: MotionProfile;
  private view!: SceneView;
  private styler!: AxolotlStyler;
  private finishing = false;

  constructor() {
    super(SCENE_KEYS.creator);
  }

  init(assets: GameAssets): void {
    this.assets = assets;
    this.finishing = false;
  }

  create(): void {
    setMusicScreen('creator');
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    useCssCamera(this.cameras.main, this.view.fit.dpr);
    this.cameras.main.setBackgroundColor(HOME_TANK_WALL);

    this.styler = new AxolotlStyler(this, this.assets, this.view, DEPTH.ui, {
      mode: 'creator',
      motion: () => this.motion,
      initial: creatorStart(Math.random),
      onDone: (axolotl) => this.finish(axolotl),
    });
    this.bindInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(time: number, deltaMs: number): void {
    this.styler.update(time, deltaMs);
  }

  /**
   * One keydown handler routed to the styler; Tab, arrows, Space and Backspace are captured while it
   * runs. The styler pauses Phaser's key capture itself while its name field is open, so those keys type.
   */
  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture([...CAPTURED_KEYS]);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.styler.handleKey(event);
  }

  /** Done, once: the scene flow makes the starter of the chosen morph and opens the Home Tank. */
  private finish(axolotl: StylerAxolotl): void {
    if (this.finishing) return;
    this.finishing = true;
    finishCreator(this, this.assets, { name: axolotl.name, look: axolotl.look }, axolotl.morph);
  }

  /** Switches the motion profile; the styler reads it every frame, so its preview stills at once. */
  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const dpr = this.view.fit.dpr;
    useCssCamera(this.cameras.main, dpr);
    this.styler.setResolution(dpr);
    this.styler.layout(this.view);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.styler.destroy();
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
    keyboard.removeCapture([...CAPTURED_KEYS]);
  }
}
