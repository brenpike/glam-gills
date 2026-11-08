import type * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { TexInfo } from '../art/textures';
import { driftingIslands, islandSpanAt, type DriftingIslandSpawn } from '../logic/driftingIslands';
import type { ElementSpawn } from '../logic/hazards';
import type { MotionProfile } from '../logic/motion';
import { SURF } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const TAU = Math.PI * 2;
/** Full motion: the islands bob this far up and down on the water line, px. */
const ISLAND_BOB_PX = 1.5;
/** Full motion: seconds per bob cycle. */
const ISLAND_BOB_PERIOD = 5;
/** Full motion: each island bobs out of step with the one before it by this phase, radians. */
const ISLAND_BOB_PHASE_STEP = 1.9;

/** One frame of drifting island rendering input: the trip's element clock, the motion setting and the scene clock. */
export interface DriftingIslandFrame {
  /** The trip's element time (`TripState.elementTime`), which places the islands. */
  elementTime: number;
  motion: MotionProfile;
  /** Scene clock in seconds, for the bob. */
  time: number;
}

/** The two half sprites of one island. */
interface IslandDrawing {
  island: Readonly<DriftingIslandSpawn>;
  /** The right half, facing right from the centre line. */
  right: Phaser.GameObjects.Image;
  /** The left half, the same art mirrored about the centre line. */
  left: Phaser.GameObjects.Image;
  /** Bob phase, radians. */
  phase: number;
}

function lakeTexturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('DriftingIslandView: drifting islands need the baked lake textures');
  return assets.lake;
}

/** A half mat sprite, anchored on the centre line at the water line, mirrored for `facing` -1. */
function halfImage(scene: Phaser.Scene, info: TexInfo, facing: 1 | -1): Phaser.GameObjects.Image {
  const image = scene.add
    .image(0, SURF, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setDepth(DEPTH.driftingIsland);
  return faceSprite(image, facing, 1 / info.scale);
}

/**
 * Draws the drifting islands (issue #213) at DEPTH.driftingIsland, under the pelicans and the
 * axolotl: each island is two half mat sprites on its centre line at the water line, the right half
 * as baked and the left half mirrored about the centre line (faceSprite, never Phaser's flip), so
 * together they span the DRIFTING_ISLANDS width. Each frame places the island where islandSpanAt puts
 * it at the trip's element time, so what is drawn is where the island shelters. The drift is
 * gameplay, so it carries on under reduced motion; under full motion each island also bobs a little
 * on the water line, out of step with its neighbours, and under reduced motion it does not bob.
 * Per frame it allocates only islandSpanAt's result per island, bounded by the area's island count.
 * Visual only: nothing here changes game state. Build it only in an area with drifting islands; it
 * throws when the lake textures are missing.
 */
export class DriftingIslandView {
  private readonly islands: IslandDrawing[];

  /** `elements` holds the trip's elements; only the drifting islands are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, elements: readonly Readonly<ElementSpawn>[]) {
    const half = lakeTexturesFor(assets).driftingIslandHalf;
    this.islands = driftingIslands(elements).map((island, index) => ({
      island,
      right: halfImage(scene, half, 1),
      left: halfImage(scene, half, -1),
      phase: index * ISLAND_BOB_PHASE_STEP,
    }));
  }

  /** Draws one frame. */
  render(frame: DriftingIslandFrame): void {
    for (const drawing of this.islands) {
      const span = islandSpanAt(drawing.island, frame.elementTime);
      const centreX = (span.x0 + span.x1) / 2;
      const bob = frame.motion.ambient
        ? ISLAND_BOB_PX * Math.sin((TAU * frame.time) / ISLAND_BOB_PERIOD + drawing.phase)
        : 0;
      drawing.right.setPosition(centreX, SURF + bob);
      drawing.left.setPosition(centreX, SURF + bob);
    }
  }

  destroy(): void {
    for (const drawing of this.islands) {
      drawing.right.destroy();
      drawing.left.destroy();
    }
  }
}
