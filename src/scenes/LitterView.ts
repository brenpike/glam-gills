import type * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { HazardSpawn } from '../logic/hazards';
import { litters, type LitterSpawn } from '../logic/litter';
import type { GameAssets } from './BootScene';

function lakeTexturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('LitterView: sharp litter needs the baked lake textures');
  return assets.lake;
}

/** A still sprite of `litter`'s kind, centred on its circle centre at DEPTH.litter. */
function litterSprite(scene: Phaser.Scene, textures: LakeTextures, litter: Readonly<LitterSpawn>): Phaser.GameObjects.Image {
  const info = textures.litter[litter.litter];
  return scene.add
    .image(litter.shape.x, litter.shape.y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(DEPTH.litter);
}

/**
 * Draws the sharp litter (issue #213) as still frames at DEPTH.litter, over the dark layer, so the
 * darkness never hides it: one sprite per piece of litter, its kind's frame (`can` or `bottle`)
 * centred on the litter's circle centre, its logic point. Litter never moves, so every sprite is
 * placed once and nothing is drawn per frame. Visual only: nothing here changes game state. Build it
 * only in an area with sharp litter; it throws when the lake textures are missing.
 */
export class LitterView {
  private readonly sprites: Phaser.GameObjects.Image[];

  /** `hazards` holds the trip's hazards; only the sharp litter is drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, hazards: readonly Readonly<HazardSpawn>[]) {
    const textures = lakeTexturesFor(assets);
    this.sprites = litters(hazards).map((litter) => litterSprite(scene, textures, litter));
  }

  destroy(): void {
    for (const sprite of this.sprites) sprite.destroy();
  }
}
