import type * as Phaser from 'phaser';
import type { BlackBassFrame } from '../art/drawBlackBass';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import { BLACK_BASS_SPECIES, type PredatorState } from '../logic/predators';
import type { GameAssets } from './BootScene';
import type { PredatorFrame } from './PredatorView';
import { faceSprite } from './spriteFacing';

/** Full motion: seconds each swim frame shows while the bass patrols. */
const SWIM_FRAME_S = 0.24;
/** Full motion: the tail cycle while the bass patrols, one frame per SWIM_FRAME_S. */
const SWIM_CYCLE: readonly BlackBassFrame[] = ['swim0', 'swim1', 'swim2', 'swim1'];
/** The level swim pose: held under reduced motion and through the slow-turn glide. */
const LEVEL_SWIM_FRAME: BlackBassFrame = 'swim1';

/** One frame of black bass rendering input: the encounter, motion and dt. */
export type BlackBassViewFrame = Pick<PredatorFrame, 'encounter' | 'motion' | 'dt'>;

/** The encounter predator a black bass is drawn from: its species and route id. */
export type BlackBassSource = Pick<PredatorState, 'species' | 'routeId'>;

/** The sprite and visual-only state of one black bass. */
interface BlackBassDrawing {
  /** Index of the bass in the encounter's `predators`. */
  index: number;
  /** The bass, anchored at the body centre (the logic point), its tail trailing behind it. */
  body: Phaser.GameObjects.Image;
  /** Seconds the bass has swum on patrol under full motion; picks the swim frame. */
  swimTime: number;
  /** The logic point last drawn, to tell whether it moved this frame. */
  lastX: number;
  lastY: number;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

/**
 * Draws each black bass (issue #78; PRD N2, N3, ND-5) from its encounter state. Visual only: it
 * reads the encounter and the motion setting each frame, the swim cycle is driven by the frame
 * `dt`, so it freezes with the scene, and nothing here changes game state. It reuses its sprites
 * and allocates nothing per frame.
 *
 * Mapping: the sprite's anchor is the body centre, placed on the logic point (`state.pos`), and the
 * tail trails behind it. It always faces `state.facing`: with the `slowTurn` rule the logic keeps
 * the strike's facing through the cooldown, so the bass is drawn gliding on the way it struck and
 * turns only once the cooldown ends. That slow turn is the lesson (dodge sideways), so the view
 * never turns it early.
 *
 * Phases: patrol steps the tail frames (swim0, swim1, swim2, swim1) while the bass moves; the
 * warning shows the `warn` pose, stopped with the fins flared and the pale flash held steady for the
 * whole warning (never blinked: the art guide's photosensitivity rule); the strike shows the
 * `strike` pose; the cooldown holds the level swim1 pose while the bass glides to a stop. Under
 * reduced motion the bass still swims (it is gameplay) but holds swim1 on patrol, and the warning
 * shows the `still` pose, the fins flared with no flash and no tail swing. Poses switch at once in
 * both modes. No "!" bubble and no glint, and the mouth is always closed. A hit shows only
 * PredatorView's shared leg-loss poof.
 */
export class BlackBassView {
  private readonly bass: BlackBassDrawing[] = [];
  private readonly assets: GameAssets;

  /** `predators` holds every encounter predator, in `predators` order; only the black bass are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, predators: readonly BlackBassSource[]) {
    this.assets = assets;
    predators.forEach((predator, index) => {
      if (predator.species === BLACK_BASS_SPECIES.id) this.bass.push(this.createBass(scene, index));
    });
  }

  /** Draws one frame. Throws when a drawn index is no longer a black bass in the encounter. */
  render(frame: BlackBassViewFrame): void {
    for (const bass of this.bass) {
      const state = frame.encounter.predators[bass.index];
      if (!state || state.species !== BLACK_BASS_SPECIES.id) {
        throw new Error(`BlackBassView: encounter predator ${bass.index} is not a black bass`);
      }
      this.renderBody(bass, state, frame);
    }
  }

  destroy(): void {
    for (const bass of this.bass) bass.body.destroy();
  }

  private createBass(scene: Phaser.Scene, index: number): BlackBassDrawing {
    const body = bakedImage(scene, this.assets.predator.blackBass[LEVEL_SWIM_FRAME], DEPTH.tilapia);
    return { index, body, swimTime: 0, lastX: Number.NaN, lastY: Number.NaN };
  }

  private renderBody(bass: BlackBassDrawing, state: PredatorState, frame: BlackBassViewFrame): void {
    const moved = state.pos.x !== bass.lastX || state.pos.y !== bass.lastY;
    bass.lastX = state.pos.x;
    bass.lastY = state.pos.y;
    const info = this.assets.predator.blackBass[this.bodyFrame(bass, state, frame, moved)];
    bass.body.setTexture(info.key).setVisible(true).setPosition(state.pos.x, state.pos.y);
    faceSprite(bass.body, state.facing, 1 / info.scale);
  }

  /**
   * The strike shows the strike pose; the warning the flared `warn` pose, or the `still` pose under
   * reduced motion; the slow-turn cooldown the level swim1. Patrol steps the tail frames under full
   * motion, advancing only while the bass moves, and holds swim1 under reduced motion.
   */
  private bodyFrame(bass: BlackBassDrawing, state: PredatorState, frame: BlackBassViewFrame, moved: boolean): BlackBassFrame {
    const ambient = frame.motion.ambient;
    if (state.phase === 'lunge') return 'strike';
    if (state.phase === 'telegraph') return ambient ? 'warn' : 'still';
    if (state.phase === 'cooldown' || !ambient) return LEVEL_SWIM_FRAME;
    if (moved) bass.swimTime += frame.dt;
    return SWIM_CYCLE[Math.floor(bass.swimTime / SWIM_FRAME_S) % SWIM_CYCLE.length];
  }
}
