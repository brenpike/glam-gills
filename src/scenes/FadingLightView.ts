import type * as Phaser from 'phaser';
import type { FadingLightFrame } from '../art/drawFadingLight';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { TexInfo } from '../art/textures';
import { fadingLightLeft, fadingLights, fadingLightShare, type FadingLightTimers } from '../logic/fadingLights';
import type { ElementSpawn, FadingLightSpot } from '../logic/hazards';
import type { GameAssets } from './BootScene';

const TAU = Math.PI * 2;
/** Hint pulse period in seconds: one slow breathe, never faster than 2.4 s (guide 10, Flashing). */
const HINT_PULSE_PERIOD_S = 3;
/** Lowest alpha of the hint pulse; the peak is 1. */
const HINT_PULSE_LOW = 0.25;
/** Most the hint sprite grows at the peak of the pulse, as a share of its size. */
const HINT_PULSE_GROW = 0.1;

/** One frame of fading light rendering input. */
export interface FadingLightViewFrame {
  /** Seconds left on each touched light, by element id (the trip's fading light timers). */
  timers: FadingLightTimers;
  /** The id of the fading light the hint points at (fadingLightHint), or null. */
  hint: string | null;
  /** True under reduced motion: the dimming holds at half and the hint is still. */
  reduced: boolean;
  /** Scene clock in seconds, for the hint pulse. */
  time: number;
}

/** One fading light's sprites and where it stands. */
interface LightDrawing {
  id: string;
  x: number;
  y: number;
  /** The out outline, always shown at alpha 1. */
  out: Phaser.GameObjects.Image;
  /** The lit frame over the out outline, at the light's share as alpha. */
  lit: Phaser.GameObjects.Image;
}

function lakeTexturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('FadingLightView: fading lights need the baked lake textures');
  return assets.lake;
}

function lightImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(DEPTH.glowPlant);
}

/**
 * Draws the fading lights (issue #212, ND-7 to ND-10; guide 7u) at DEPTH.glowPlant, just over the
 * dark layer, so the darkness never hides one. Every light shows its out outline at alpha 1 the
 * whole time, so it is never less visible than its outline; the lit frame sits over it at the
 * light's share (fadingLightShare) as alpha: 1 while fully lit, then under full motion a smooth
 * crossfade to 0 over the dimming, and under reduced motion a step to 0.5 held until out. A touch
 * relights it at once. The light the hint points at gets the hint sprite over it: under full motion
 * it pulses, alpha HINT_PULSE_LOW to 1 and up to HINT_PULSE_GROW larger over HINT_PULSE_PERIOD_S;
 * under reduced motion it is still at alpha 1 and its own size, so it simply brightens the outline.
 * Every frame shares one frame and anchor, so nothing moves. Allocates nothing per frame. Visual
 * only: nothing here changes game state. Throws when the lake textures are missing.
 */
export class FadingLightView {
  private readonly textures: LakeTextures;
  private readonly lights: LightDrawing[];
  private readonly hintImage: Phaser.GameObjects.Image;

  /** `elements` holds the trip's elements; only the fading lights are drawn. */
  constructor(scene: Phaser.Scene, assets: GameAssets, elements: readonly Readonly<ElementSpawn>[]) {
    this.textures = lakeTexturesFor(assets);
    this.lights = fadingLights(elements).map((light) => this.createLight(scene, light.id, light.fadingLight));
    this.hintImage = lightImage(scene, this.frameInfo('hint'), 0, 0).setVisible(false);
  }

  /** Draws one frame. */
  render(frame: FadingLightViewFrame): void {
    let hinted: LightDrawing | null = null;
    for (const light of this.lights) {
      const share = fadingLightShare(fadingLightLeft(frame.timers, light.id), frame.reduced);
      light.lit.setVisible(share > 0).setAlpha(share);
      if (light.id === frame.hint) hinted = light;
    }
    this.renderHint(hinted, frame);
  }

  destroy(): void {
    for (const light of this.lights) {
      light.out.destroy();
      light.lit.destroy();
    }
    this.hintImage.destroy();
  }

  private createLight(scene: Phaser.Scene, id: string, spot: Readonly<FadingLightSpot>): LightDrawing {
    return {
      id,
      x: spot.x,
      y: spot.y,
      out: lightImage(scene, this.frameInfo('out'), spot.x, spot.y),
      lit: lightImage(scene, this.frameInfo('lit'), spot.x, spot.y).setVisible(false),
    };
  }

  private frameInfo(frame: FadingLightFrame): TexInfo {
    return this.textures.fadingLight[frame];
  }

  /** Places the hint sprite over `light`, pulsing or still by the motion setting; hides it for null. */
  private renderHint(light: LightDrawing | null, frame: FadingLightViewFrame): void {
    if (light === null) {
      this.hintImage.setVisible(false);
      return;
    }
    const wave = frame.reduced ? 1 : 0.5 + 0.5 * Math.cos((TAU * frame.time) / HINT_PULSE_PERIOD_S);
    const alpha = frame.reduced ? 1 : HINT_PULSE_LOW + (1 - HINT_PULSE_LOW) * wave;
    const grow = frame.reduced ? 1 : 1 + HINT_PULSE_GROW * wave;
    this.hintImage
      .setVisible(true)
      .setPosition(light.x, light.y)
      .setAlpha(alpha)
      .setScale(grow / this.frameInfo('hint').scale);
  }
}
