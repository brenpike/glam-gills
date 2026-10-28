import type * as Phaser from 'phaser';
import { PEBBLE_HINT_LENGTH } from '../art/drawPebbleRoom';
import { DEPTH } from '../art/layers';
import { rockWallSizeKey, type SpringCaveTextures } from '../art/springCaveTextures';
import type { TexInfo } from '../art/textures';
import type { ElementSpawn, PebbleGroove } from '../logic/hazards';
import { pebbleCentre, pebbles, rollDirection, type PebbleState, type RockWall } from '../logic/pebble';
import type { GameAssets } from './BootScene';

/** Px between the pebble's edge and the hint arrow's tip, behind the pebble. */
const HINT_GAP = 10;

/** One frame of pebble room rendering input. */
export interface PebbleRoomFrame {
  /** Each pebble's trip state (stepPebbles), in element order. */
  pebbles: readonly PebbleState[];
  /** Whether the hint arrow shows (pebbleHintShown). */
  hint: boolean;
}

/** One pebble's reused sprites. */
interface PebbleDrawing {
  id: string;
  groove: Readonly<PebbleGroove>;
  image: Phaser.GameObjects.Image;
  hint: Phaser.GameObjects.Image;
}

function texturesFor(assets: GameAssets): SpringCaveTextures {
  if (assets.springCave === null) throw new Error('PebbleRoomView: the pebble room needs the baked spring cave textures');
  return assets.springCave;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(DEPTH.rock);
}

/**
 * Draws the solid rock walls and the pebbles (issue #105, ND-8) at DEPTH.rock: each wall baked once
 * at its own size and placed at its rect; each pebble at its centre along its groove, turned as it
 * rolls; and, while the hint shows, a still arrow behind the pebble that has not rolled, pointing the
 * way to push. The hint is still under reduced motion too, and the pebble turns only as it rolls,
 * which is gameplay, so reduced motion changes nothing here. Every sprite is made once per trip and
 * reused; a frame allocates only each pebble's centre point. Visual only: nothing here changes game
 * state. Throws when the spring cave textures or a wall's bake are missing.
 */
export class PebbleRoomView {
  private readonly walls: Phaser.GameObjects.Image[];
  private readonly pebbles: PebbleDrawing[];

  constructor(scene: Phaser.Scene, assets: GameAssets, walls: readonly Readonly<RockWall>[], elements: readonly Readonly<ElementSpawn>[]) {
    const textures = texturesFor(assets);
    this.walls = walls.map((wall) => {
      const info = textures.rockWalls.get(rockWallSizeKey(wall.x1 - wall.x0, wall.y1 - wall.y0));
      if (info === undefined) throw new Error(`PebbleRoomView: no rock wall baked at ${wall.x1 - wall.x0} x ${wall.y1 - wall.y0}`);
      return bakedImage(scene, info, wall.x0, wall.y0);
    });
    this.pebbles = pebbles(elements).map((element): PebbleDrawing => {
      const groove = element.pebble;
      const centre = pebbleCentre(groove, 0);
      const dir = rollDirection(groove);
      const tail = PEBBLE_HINT_LENGTH + HINT_GAP + groove.radius;
      const hint = bakedImage(scene, textures.pebbleHint, centre.x - dir.x * tail, centre.y - dir.y * tail)
        .setRotation(Math.atan2(dir.y, dir.x))
        .setVisible(false);
      return { id: element.id, groove, image: bakedImage(scene, textures.pebble, centre.x, centre.y), hint };
    });
  }

  /** Draws one frame. */
  render(frame: PebbleRoomFrame): void {
    for (const drawing of this.pebbles) {
      const state = frame.pebbles.find((candidate) => candidate.id === drawing.id);
      const along = state?.along ?? 0;
      const centre = pebbleCentre(drawing.groove, along);
      drawing.image.setPosition(centre.x, centre.y).setRotation(along / drawing.groove.radius);
      drawing.hint.setVisible(frame.hint && along === 0);
    }
  }

  destroy(): void {
    for (const wall of this.walls) wall.destroy();
    for (const drawing of this.pebbles) {
      drawing.image.destroy();
      drawing.hint.destroy();
    }
  }
}
