import type * as Phaser from 'phaser';
import type { SceneryTextures } from '../art/textures';
import { CANAL_AREA_ID } from '../logic/zone';

/** Removes every texture of `scenery` from the game's texture manager. */
function removeScenery(scene: Phaser.Scene, scenery: SceneryTextures): void {
  const keys = new Set([...scenery.bg.flat(), ...scenery.reeds, ...scenery.pads].map((info) => info.key));
  for (const key of keys) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}

/**
 * Area scenery, baked on demand. It holds the canal's scenery (part of the boot bake) and the
 * scenery of at most one other area: asking for a new area removes the last one's textures first.
 * Each area's scenery is many full-screen chunks, and baking every area's at boot used more memory
 * than iOS Safari gives a page, so Safari reloaded the page until it gave up.
 * Only the swim scene shows area scenery, so the old area's images are gone by the time it asks.
 */
export class SceneryCache {
  private held: { readonly areaId: string; readonly scenery: SceneryTextures } | null = null;

  constructor(
    private readonly canal: SceneryTextures,
    private readonly bakeArea: (scene: Phaser.Scene, areaId: string) => SceneryTextures,
  ) {}

  get(scene: Phaser.Scene, areaId: string): SceneryTextures {
    if (areaId === CANAL_AREA_ID) return this.canal;
    if (this.held?.areaId === areaId) return this.held.scenery;
    if (this.held !== null) removeScenery(scene, this.held.scenery);
    this.held = null;
    const scenery = this.bakeArea(scene, areaId);
    this.held = { areaId, scenery };
    return scenery;
  }
}
