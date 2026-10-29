import type * as Phaser from 'phaser';
import { CRAYFISH_FOOT_Y, type CrayfishFrame } from '../art/drawCrayfish';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import { CRAYFISH_SPECIES, type PredatorState } from '../logic/predators';
import type { Point } from '../logic/zone';
import type { GameAssets } from './BootScene';
import type { PredatorFrame } from './PredatorView';
import { faceSprite } from './spriteFacing';

/** Full motion: seconds each walk frame shows while the crayfish walks. */
const WALK_FRAME_S = 0.18;
/** Full motion: the leg cycle while the crayfish walks, one frame per WALK_FRAME_S. */
const WALK_CYCLE: readonly CrayfishFrame[] = ['walkA', 'stand', 'walkB', 'stand'];
/** The one walk pose held under reduced motion. */
const STILL_WALK_FRAME: CrayfishFrame = 'stand';
/** Full motion: seconds the claws take to open at the start of the warning. */
const CLAW_OPEN_S = 0.2;
/** Full motion: the scale the `warn` pose grows from as the claws open; it reaches 1 after CLAW_OPEN_S. */
const CLAW_OPEN_FROM = 0.85;

/** One frame of crayfish rendering input: the encounter, motion and dt, and the axolotl's logic position. */
export type CrayfishViewFrame = Pick<PredatorFrame, 'encounter' | 'motion' | 'dt'> & {
  axolotl: Readonly<Point>;
};

/** The encounter predator a crayfish is drawn from: its species and route id. */
export type CrayfishSource = Pick<PredatorState, 'species' | 'routeId'>;

/** The sprite and visual-only state of one crayfish. */
interface CrayfishDrawing {
  /** Index of the crayfish in the encounter's `predators`. */
  index: number;
  /** The crayfish, anchored at the shell centre (the logic point), its tail trailing behind it. */
  body: Phaser.GameObjects.Image;
  /** Seconds the crayfish has walked under full motion; picks the walk frame. */
  walkTime: number;
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
 * Draws each crayfish (issue #77; PRD N2, N3; ND-5, ND-15, ND-18) from its encounter state. Visual
 * only: it reads the encounter, the axolotl's position and the motion setting each frame, the walk
 * cycle is driven by the frame `dt` and the claw opening by the warning's own elapsed time, so both
 * freeze with the scene, and nothing here changes game state. It reuses its sprites and allocates
 * nothing per frame.
 *
 * Mapping: the sprite's anchor is the shell centre, placed on the logic point (`state.pos`), which
 * walks the floor lane, so the feet (CRAYFISH_FOOT_Y below the anchor) rest on the floor. It faces
 * `state.facing`, except in cooldown, where it turns away from the axolotl, like the tilapia and
 * the carp, so it is never shown holding on.
 *
 * Phases: patrol and cooldown step the leg frames (walkA, stand, walkB, stand) while the crayfish
 * moves; the warning shows the `warn` pose, claws raised and opened wide, for the whole warning
 * (0.8 s, tuning); the strike shows the `pinch` pose, carried by the logic point along the
 * pinch's aim, which may lift it off the floor toward the axolotl. Under full motion the claws open over the first CLAW_OPEN_S of the warning: the `warn`
 * pose grows from CLAW_OPEN_FROM to full size about the feet, so the feet stay on the floor. Under
 * reduced motion the crayfish still walks but holds one pose (stand), and the claws snap open: the
 * `warn` pose at full size at once, with no animation. The pinch pose switches at once in both
 * modes. No "!" bubble and no glint, and the mouth is always closed. A hit shows only
 * PredatorView's shared leg-loss poof.
 */
export class CrayfishView {
  private readonly crayfish: CrayfishDrawing[] = [];
  private readonly assets: GameAssets;

  /** `predators` holds every encounter predator, in `predators` order; only the crayfish are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, predators: readonly CrayfishSource[]) {
    this.assets = assets;
    predators.forEach((predator, index) => {
      if (predator.species === CRAYFISH_SPECIES.id) this.crayfish.push(this.createCrayfish(scene, index));
    });
  }

  /** Draws one frame. */
  render(frame: CrayfishViewFrame): void {
    for (const drawing of this.crayfish) {
      const state = frame.encounter.predators[drawing.index];
      if (!state || state.species !== CRAYFISH_SPECIES.id) {
        throw new Error(`CrayfishView: encounter predator ${drawing.index} is not a crayfish`);
      }
      this.renderBody(drawing, state, frame);
    }
  }

  destroy(): void {
    for (const drawing of this.crayfish) drawing.body.destroy();
  }

  private createCrayfish(scene: Phaser.Scene, index: number): CrayfishDrawing {
    const body = bakedImage(scene, this.assets.predator.crayfish[STILL_WALK_FRAME], DEPTH.tilapia);
    return { index, body, walkTime: 0, lastX: Number.NaN, lastY: Number.NaN };
  }

  private renderBody(drawing: CrayfishDrawing, state: PredatorState, frame: CrayfishViewFrame): void {
    const moved = state.pos.x !== drawing.lastX || state.pos.y !== drawing.lastY;
    drawing.lastX = state.pos.x;
    drawing.lastY = state.pos.y;
    const info = this.assets.predator.crayfish[this.bodyFrame(drawing, state, frame, moved)];
    const grow = this.clawOpenScale(state, frame);
    drawing.body
      .setTexture(info.key)
      .setVisible(true)
      .setPosition(state.pos.x, state.pos.y + CRAYFISH_FOOT_Y * (1 - grow));
    faceSprite(drawing.body, this.crayfishFacing(state, frame.axolotl), grow / info.scale);
  }

  /**
   * The strike shows the pinch and the warning the open claws. Patrol and cooldown step the leg
   * frames under full motion, advancing only while the crayfish moves, and hold stand under
   * reduced motion.
   */
  private bodyFrame(
    drawing: CrayfishDrawing,
    state: PredatorState,
    frame: CrayfishViewFrame,
    moved: boolean,
  ): CrayfishFrame {
    if (state.phase === 'lunge') return 'pinch';
    if (state.phase === 'telegraph') return 'warn';
    if (!frame.motion.ambient) return STILL_WALK_FRAME;
    if (moved) drawing.walkTime += frame.dt;
    return WALK_CYCLE[Math.floor(drawing.walkTime / WALK_FRAME_S) % WALK_CYCLE.length];
  }

  /**
   * The sprite's scale share: under full motion the `warn` pose grows from CLAW_OPEN_FROM to 1 over
   * the warning's first CLAW_OPEN_S; every other pose, and every pose under reduced motion, is 1.
   */
  private clawOpenScale(state: PredatorState, frame: CrayfishViewFrame): number {
    if (state.phase !== 'telegraph' || !frame.motion.ambient) return 1;
    const share = Math.min(1, Math.max(0, state.elapsed / CLAW_OPEN_S));
    return CLAW_OPEN_FROM + (1 - CLAW_OPEN_FROM) * share;
  }

  /** In cooldown the crayfish turns away from the axolotl, so it is never shown holding on. */
  private crayfishFacing(state: PredatorState, axolotl: Readonly<Point>): -1 | 1 {
    if (state.phase !== 'cooldown') return state.facing;
    const away = Math.sign(state.pos.x - axolotl.x);
    if (away > 0) return 1;
    if (away < 0) return -1;
    return state.facing;
  }
}
