import type * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import type { SpringCaveTextures } from '../art/springCaveTextures';
import type { TexInfo } from '../art/textures';
import { flowStep, pulsePhase, ventMouth, type PulseMotion, type PulsingCurrentSpawn } from '../logic/pulsingCurrents';
import type { Point } from '../logic/zone';
import type { GameAssets } from './BootScene';

/** Warning bubbles per vent. */
const BUBBLES_PER_VENT = 5;
/** Surge streaks per vent. */
const STREAKS_PER_VENT = 6;
/** Px the warning bubbles rise from the mouth into the band by the end of the warning, with full motion. */
const BUBBLE_RISE = 46;
/** Px across the mouth the bubbles spread. */
const BUBBLE_SPREAD = 34;
/** Speed in px/s the surge streaks move along the flow. */
const STREAK_SPEED = 240;
/** Ink of the band's outline while it surges, the greyscale cue (guide 10). */
const BAND_OUTLINE = 0x2b2350;
/** Outline width in px of the surging band. */
const BAND_OUTLINE_W = 3;
/** Fill of the band while it surges under reduced motion: a darker spring blue. */
const BAND_DARKEN = 0x1c2d45;
/** Alpha of the band's darkening under reduced motion. */
const BAND_DARKEN_ALPHA = 0.28;
/** Alpha of the band's faint fill while it surges with full motion, under the streaks. */
const BAND_SURGE_ALPHA = 0.12;

/** One frame of pulsing current rendering input. */
export interface PulsingCurrentFrame {
  /** The trip's element time, which the vents' cycles run on. */
  elementTime: number;
  /** The pulsing current motion for the reduced-motion preference (pulseMotion). */
  motion: Readonly<PulseMotion>;
}

/** One vent's reused sprites. */
interface VentDrawing {
  vent: Readonly<PulsingCurrentSpawn>;
  /** The unit step of its flow. */
  step: Readonly<Point>;
  /** Where its water comes out. */
  mouthAt: Readonly<Point>;
  band: Phaser.GameObjects.Rectangle;
  mouth: Phaser.GameObjects.Image;
  bubbles: Phaser.GameObjects.Image[];
  streaks: Phaser.GameObjects.Image[];
}

function texturesFor(assets: GameAssets): SpringCaveTextures {
  if (assets.springCave === null) throw new Error('PulsingCurrentView: vents need the baked spring cave textures');
  return assets.springCave;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(DEPTH.pulsingCurrent);
}

/** The rotation in radians that turns art drawn along +x to point along `step`. */
function angleOf(step: Readonly<Point>): number {
  return Math.atan2(step.y, step.x);
}

/**
 * Draws the pulsing vents (issue #105, ND-7) at DEPTH.pulsingCurrent: each vent's rock mouth at the
 * band's upstream edge; during the warning, bubbles building at the mouth, rising into the band with
 * full motion and held still under reduced motion; while it surges, streaks flowing along the band
 * with full motion, or the band darkened under reduced motion, and in both an ink outline round the
 * band so the surge reads in greyscale. Every sprite is made once per trip and reused, so a frame
 * allocates nothing. Visual only: nothing here changes game state. Throws when the spring cave
 * textures are missing.
 */
export class PulsingCurrentView {
  private readonly vents: VentDrawing[];

  constructor(scene: Phaser.Scene, assets: GameAssets, vents: readonly Readonly<PulsingCurrentSpawn>[]) {
    const textures = texturesFor(assets);
    this.vents = vents.map((vent): VentDrawing => {
      const { x0, x1, y0, y1 } = vent.shape;
      const step = flowStep(vent.pulse.flow);
      const mouthAt = ventMouth(vent);
      const band = scene.add
        .rectangle(x0, y0, x1 - x0, y1 - y0, BAND_DARKEN, 0)
        .setOrigin(0, 0)
        .setDepth(DEPTH.pulsingCurrent)
        .setVisible(false);
      const mouth = bakedImage(scene, textures.ventMouth, mouthAt.x, mouthAt.y).setRotation(angleOf(step) + Math.PI);
      const bubbles = Array.from({ length: BUBBLES_PER_VENT }, () => bakedImage(scene, textures.ventBubble, mouthAt.x, mouthAt.y).setVisible(false));
      const streaks = Array.from({ length: STREAKS_PER_VENT }, () =>
        bakedImage(scene, textures.surgeStreak, mouthAt.x, mouthAt.y).setRotation(angleOf(step)).setVisible(false),
      );
      return { vent, step, mouthAt, band, mouth, bubbles, streaks };
    });
  }

  /** Draws one frame. */
  render(frame: PulsingCurrentFrame): void {
    for (const drawing of this.vents) this.renderVent(drawing, frame);
  }

  destroy(): void {
    for (const drawing of this.vents) {
      drawing.band.destroy();
      drawing.mouth.destroy();
      for (const bubble of drawing.bubbles) bubble.destroy();
      for (const streak of drawing.streaks) streak.destroy();
    }
  }

  private renderVent(drawing: VentDrawing, frame: PulsingCurrentFrame): void {
    const phase = pulsePhase(drawing.vent.pulse, frame.elementTime);
    this.renderBubbles(drawing, phase.phase === 'warn' ? phase.progress : null, frame.motion);
    this.renderSurge(drawing, phase.phase === 'surge' ? phase.progress : null, frame);
  }

  /** Shows the warning bubbles, `progress` through the warning, or hides them for null. */
  private renderBubbles(drawing: VentDrawing, progress: number | null, motion: Readonly<PulseMotion>): void {
    const { step, mouthAt } = drawing;
    const across = { x: -step.y, y: step.x };
    const shown = progress === null ? 0 : Math.ceil(progress * BUBBLES_PER_VENT);
    drawing.bubbles.forEach((bubble, index) => {
      if (index >= Math.max(shown, progress === null ? 0 : 1)) {
        bubble.setVisible(false);
        return;
      }
      const spread = (index / (BUBBLES_PER_VENT - 1) - 0.5) * BUBBLE_SPREAD;
      const rise = motion.bubbles === 'rise' && progress !== null ? ((progress * BUBBLES_PER_VENT - index) / BUBBLES_PER_VENT) * BUBBLE_RISE : 8;
      bubble
        .setVisible(true)
        .setPosition(mouthAt.x + step.x * (10 + Math.max(0, rise)) + across.x * spread, mouthAt.y + step.y * (10 + Math.max(0, rise)) + across.y * spread);
    });
  }

  /** Shows the surge, `progress` through it, or hides it for null. */
  private renderSurge(drawing: VentDrawing, progress: number | null, frame: PulsingCurrentFrame): void {
    const { band, streaks, vent, step } = drawing;
    if (progress === null) {
      band.setVisible(false);
      for (const streak of streaks) streak.setVisible(false);
      return;
    }
    const darken = frame.motion.surge === 'darken';
    band
      .setVisible(true)
      .setFillStyle(BAND_DARKEN, darken ? BAND_DARKEN_ALPHA : BAND_SURGE_ALPHA)
      .setStrokeStyle(BAND_OUTLINE_W, BAND_OUTLINE, 1);
    const { x0, x1, y0, y1 } = vent.shape;
    const length = step.x !== 0 ? x1 - x0 : y1 - y0;
    const width = step.x !== 0 ? y1 - y0 : x1 - x0;
    streaks.forEach((streak, index) => {
      if (darken) {
        streak.setVisible(false);
        return;
      }
      const lane = (index + 0.5) / streaks.length;
      const along = (((frame.elementTime * STREAK_SPEED + (index * length) / 2.7) % length) + length) % length;
      const fromUp = step.x > 0 || step.y > 0 ? along : length - along;
      const x = step.x !== 0 ? x0 + fromUp : x0 + lane * width;
      const y = step.x !== 0 ? y0 + lane * width : y0 + fromUp;
      streak.setVisible(true).setPosition(x, y);
    });
  }
}
