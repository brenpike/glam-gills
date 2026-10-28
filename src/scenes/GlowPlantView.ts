import type * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import type { GlowPlantTextures } from '../art/springCaveTextures';
import type { TexInfo } from '../art/textures';
import { glowPlants, type GlowMotion } from '../logic/glowPlants';
import type { ElementSpawn } from '../logic/hazards';
import type { GameAssets } from './BootScene';

const TAU = Math.PI * 2;
/** Hint pulse period in seconds: one slow breathe, never faster than 2.4 s (guide 10, Flashing). */
const HINT_PULSE_PERIOD_S = 3;
/** Lowest alpha of the hint pulse; the peak is 1. */
const HINT_PULSE_LOW = 0.25;
/** Most the hint outline grows at the peak of the pulse, as a share of its size. */
const HINT_PULSE_GROW = 0.1;

/** One frame of glow-plant rendering input. */
export interface GlowPlantFrame {
  /** The glow-plant ids lit this trip (`TripState.litGlowPlants`). */
  lit: readonly string[];
  /** The unlit glow-plant the hint points at (`TripState.darkHint`), or null. */
  hint: string | null;
  /** The glow-plant motion for the reduced-motion preference (glowMotion). */
  motion: Readonly<GlowMotion>;
  /** Scene clock in seconds, for the hint pulse. */
  time: number;
}

/** One glow-plant's sprite and where it stands. */
interface PlantDrawing {
  id: string;
  x: number;
  y: number;
  image: Phaser.GameObjects.Image;
  lit: boolean;
}

function glowPlantTexturesFor(assets: GameAssets): GlowPlantTextures {
  if (assets.springCave === null) {
    throw new Error('GlowPlantView: glow-plants need the baked spring cave textures');
  }
  return assets.springCave.glowPlants;
}

function plantImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(DEPTH.glowPlant);
}

/** Shows `image` as the plant's `info` bake at logical size. */
function showBake(image: Phaser.GameObjects.Image, info: TexInfo): void {
  image.setTexture(info.key).setOrigin(info.originNormX, info.originNormY).setScale(1 / info.scale);
}

/**
 * Draws the glow-plants (issue #77, ND-8 and ND-18) at DEPTH.glowPlant, just over the dark layer, so
 * the darkness never hides one: each unlit plant as its dim outline and each lit plant as its bright
 * glow, swapped at once when the trip lights it. The plant the hint points at gets the hint outline
 * over it: under full motion it pulses gently, alpha HINT_PULSE_LOW to 1 and a little larger over
 * HINT_PULSE_PERIOD_S; under reduced motion it is still, so the outline simply brightens. Every bake
 * shares one frame and anchor, so a swap never moves a plant. Allocates nothing per frame. Visual
 * only: nothing here changes game state. Throws when the spring cave textures are missing.
 */
export class GlowPlantView {
  private readonly textures: GlowPlantTextures;
  private readonly plants: PlantDrawing[];
  private readonly hintImage: Phaser.GameObjects.Image;

  /** `elements` holds the trip's elements; only the glow-plants are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, elements: readonly Readonly<ElementSpawn>[]) {
    this.textures = glowPlantTexturesFor(assets);
    const unlit = this.textures.unlit;
    this.plants = glowPlants(elements).map(
      (plant): PlantDrawing => ({
        id: plant.id,
        x: plant.glowPlant.x,
        y: plant.glowPlant.y,
        image: plantImage(scene, unlit, plant.glowPlant.x, plant.glowPlant.y),
        lit: false,
      }),
    );
    this.hintImage = plantImage(scene, this.textures.hint, 0, 0).setVisible(false);
  }

  /** Draws one frame. */
  render(frame: GlowPlantFrame): void {
    let hinted: PlantDrawing | null = null;
    for (const plant of this.plants) {
      const lit = frame.lit.includes(plant.id);
      if (lit !== plant.lit) {
        plant.lit = lit;
        showBake(plant.image, lit ? this.textures.lit : this.textures.unlit);
      }
      if (!lit && plant.id === frame.hint) hinted = plant;
    }
    this.renderHint(hinted, frame);
  }

  destroy(): void {
    for (const plant of this.plants) plant.image.destroy();
    this.hintImage.destroy();
  }

  /** Places the hint outline over `plant`, pulsing or still by the motion setting; hides it for null. */
  private renderHint(plant: PlantDrawing | null, frame: GlowPlantFrame): void {
    if (plant === null) {
      this.hintImage.setVisible(false);
      return;
    }
    const wave = frame.motion.hint === 'pulse' ? 0.5 + 0.5 * Math.cos((TAU * frame.time) / HINT_PULSE_PERIOD_S) : 1;
    const alpha = frame.motion.hint === 'pulse' ? HINT_PULSE_LOW + (1 - HINT_PULSE_LOW) * wave : 1;
    const grow = frame.motion.hint === 'pulse' ? 1 + HINT_PULSE_GROW * wave : 1;
    this.hintImage
      .setVisible(true)
      .setPosition(plant.x, plant.y)
      .setAlpha(alpha)
      .setScale(grow / this.textures.hint.scale);
  }
}
