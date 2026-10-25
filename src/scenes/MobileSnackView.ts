import type * as Phaser from 'phaser';
import type { MobileSnackTextures } from '../art/mobileSnackTextures';
import type { TexInfo } from '../art/textures';
import type { Collectible, SnackFrame } from '../logic/collectibles';
import {
  SHRIMP_FLICK_FRAME,
  mobileSnackPose,
  type MobileSnackPose,
  type MobileSnackPoseScene,
  type ShrimpPoseState,
} from '../logic/mobileSnacks';
import { createShrimpPoseLookup, readShrimpPose, type ShrimpFlickState } from '../logic/shrimpFlick';
import { faceSprite } from './spriteFacing';

/**
 * Poses the mobile snacks (issue #117; PRD H4, ND-24, ND-25, ND-30): each frame it sets each
 * uncollected tadpole's and shrimp's sprite frame, facing (faceSprite) and rotation (tilt plus body
 * sway; issue #131, ND-4) from mobileSnackPose. Visual only: nothing here changes game state. It
 * makes no new textures (ND-10).
 *
 * It owns no sprites. SwimScene keeps every snack sprite, worms and bugs too, in its one snack map
 * by snack id, so the eat pop and the last-3 stars work unchanged: it creates a tadpole sprite from
 * `textures.tadpole[0]` and a shrimp sprite from `textures.shrimp.rest` (origin and 1 / scale as
 * for any baked snack, at DEPTH.collectibles), sets every sprite's position (drawnSnackX,
 * drawnSnackY) as today, and calls `render` once a frame with the same items, map and snack frame.
 * Worms, bugs and snacks with no sprite (eaten) are skipped.
 *
 * Under reduced motion (`scene.reduced`) a tadpole shows tail frame 0 with no sway and its tilt
 * changes at once (issue #131, ND-11), and a shrimp shows its rest frame. A shrimp's facing and
 * frame use its flick, its rest after a flick and its last hop's x sign from the trip's flick state
 * (issue #131, ND-10), read from one id-indexed lookup refilled only when the state changes. It
 * allocates nothing per frame: the lookup, the shrimp state and the pose are reused objects.
 */
export class MobileSnackView {
  private readonly textures: MobileSnackTextures;
  /** Reused for every snack's pose each frame. */
  private readonly pose: MobileSnackPose = { frame: 0, facing: 1, sway: 0, tilt: 0 };
  /** Reused for every snack's shrimp flick state each frame. */
  private readonly shrimp: ShrimpPoseState = { flicking: false, afterFlick: false, hopSign: 0 };
  /** Reused id-indexed view of the trip's shrimp flick state. */
  private readonly shrimpLookup = createShrimpPoseLookup();

  /** `textures` is GameAssets.mobileSnacks; the caller throws when that is null in an area with mobile snacks. */
  constructor(textures: MobileSnackTextures) {
    this.textures = textures;
  }

  /**
   * Poses one frame. `items` are the trip's snacks in index order (the index feeds the pose, as it
   * feeds drawnSnackX), `sprites` SwimScene's snack sprites by id, `frame` this frame's snack frame,
   * `scene` the scene clock, reduced motion and the head reach centre, and `flicks` the trip's
   * shrimp flick state, or null in an area with no shrimp.
   */
  render(
    items: readonly Collectible[],
    sprites: ReadonlyMap<string, Phaser.GameObjects.Image>,
    frame: SnackFrame,
    scene: MobileSnackPoseScene,
    flicks: ShrimpFlickState | null,
  ): void {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (item.kind !== 'tadpole' && item.kind !== 'shrimp') continue;
      const sprite = sprites.get(item.id);
      if (!sprite) continue;
      const shrimp = this.readShrimpState(item, flicks);
      const pose = mobileSnackPose(item, index, frame, scene, shrimp, this.pose);
      const info = this.poseTexture(item, pose);
      if (sprite.texture.key !== info.key) sprite.setTexture(info.key);
      faceSprite(sprite, pose.facing, 1 / info.scale).setRotation(pose.tilt + pose.sway);
    }
  }

  /** Writes the shrimp flick state of `item` into the reused object: none for a tadpole or with no flick state. */
  private readShrimpState(item: Collectible, flicks: ShrimpFlickState | null): ShrimpPoseState {
    const shrimp = this.shrimp;
    if (item.kind === 'shrimp' && flicks !== null) return readShrimpPose(this.shrimpLookup, flicks, item.id, shrimp);
    shrimp.flicking = false;
    shrimp.afterFlick = false;
    shrimp.hopSign = 0;
    return shrimp;
  }

  /** The texture of a tadpole's tail frame or a shrimp's rest or flick frame. Throws on a tail frame with no bake. */
  private poseTexture(item: Collectible, pose: MobileSnackPose): TexInfo {
    if (item.kind === 'shrimp') {
      return pose.frame === SHRIMP_FLICK_FRAME ? this.textures.shrimp.flick : this.textures.shrimp.rest;
    }
    const info: TexInfo | undefined = this.textures.tadpole[pose.frame];
    if (info === undefined) throw new Error(`MobileSnackView: no tadpole tail frame ${pose.frame}`);
    return info;
  }
}
