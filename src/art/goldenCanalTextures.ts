/**
 * Phaser glue for the golden-hour deep canal (issue #112, Area 11; ND-13): bakes the one sinking
 * marigold petal into a CanvasTexture, only when some look lets petals sink. The golden decorations
 * themselves are painted into the per-area background chunks (drawGoldenCanal.ts paintGoldenDecor,
 * sceneryCache.ts), so they have no texture here. Visual only. No game state, no input, no physics.
 *
 * Same rules as textures.ts: the texture is drawn at `bakeScale` through the context transform, so
 * the ink stays constant, and a sprite shows at logical size with setScale(1 / info.scale).
 */
import * as Phaser from 'phaser';
import { SINKING_PETAL_TEX, paintSinkingPetal } from './drawGoldenCanal';
import type { HabitatLook } from './habitatLook';
import { bake, type TexInfo } from './textures';

/** Texture key of the sinking marigold petal. */
export const GOLDEN_CANAL_TEX = {
  sinkingPetal: 'golden-sinking-petal',
} as const;

/** The baked golden-hour textures, ready for GameAssets.goldenCanal. */
export interface GoldenCanalTextures {
  /** One marigold petal (SINKING_PETAL_TEX), anchored on its centre. */
  readonly sinkingPetal: TexInfo;
}

/**
 * Bake the golden-hour textures at `bakeScale` texture pixels per logical unit: the one sinking
 * petal, only when some look in `looks` lets petals sink. Null when none does, and nothing is baked.
 */
export function bakeGoldenCanalTextures(
  scene: Phaser.Scene,
  bakeScale: number,
  looks: readonly HabitatLook[],
): GoldenCanalTextures | null {
  if (!looks.some((look) => look.sinkingPetalsPerScreen > 0)) return null;
  return {
    sinkingPetal: bake(scene, GOLDEN_CANAL_TEX.sinkingPetal, SINKING_PETAL_TEX, bakeScale, paintSinkingPetal),
  };
}
