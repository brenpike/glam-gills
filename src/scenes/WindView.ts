import type * as Phaser from 'phaser';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { TexInfo } from '../art/textures';
import { windPose, type WindPose, type WindSpawn } from '../logic/wind';
import { SURF, inSafeArea, type Point, type SafeArea } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

/** Px between two ripple marks along a wind's span. */
const RIPPLE_SPACING = 180;
/** Px below SURF of the ripple marks' anchor, so the arcs sit on the surface. */
const RIPPLE_DEPTH = 8;
/** Px the ripple marks drift the gust's way over the warning, with full motion. */
const RIPPLE_DRIFT = 24;
/** Px between two gust streaks along a row. */
const STREAK_SPACING = 240;
/** Px below SURF of each row of gust streaks; a row at or below the span's fade depth is left out. */
const STREAK_ROW_DEPTHS: readonly number[] = [36, 110, 190];
/** Speed in px/s the gust streaks flow the gust's way, with full motion. */
const STREAK_SPEED = 160;
/** Alpha of a streak at the fade depth; it rises to 1 at SURF, as the push does. */
const STREAK_MIN_ALPHA = 0.3;
/** Px outside the camera view a mark still shows, so none pops in at the edge. */
const VIEW_MARGIN = 80;

/** One frame of wind rendering input. */
export interface WindFrame {
  /** The trip's element time, which the winds' cycles run on. */
  elementTime: number;
  /** True under reduced motion: the ripples and streaks hold still. */
  reduced: boolean;
  /** The camera's world view; marks outside it, past VIEW_MARGIN, are hidden. */
  view: Readonly<Phaser.Geom.Rectangle>;
}

/** One reused mark: its sprite and its place before any flow. */
interface Mark {
  image: Phaser.GameObjects.Image;
  baseX: number;
  y: number;
}

/** One wind's reused marks. */
interface WindDrawing {
  wind: Readonly<WindSpawn>;
  ripples: Mark[];
  streaks: Mark[];
}

function texturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('WindView: wind and waves need the baked lake textures');
  return assets.lake;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

/** Share in [0, 1] of the surface push left at `y` for a span fading to nothing at `fadeY`. */
function pushShare(y: number, fadeY: number): number {
  return Math.min(1, Math.max(0, (fadeY - y) / (fadeY - SURF)));
}

/** `x` moved by `shift` and wrapped back into `x0..x1`. */
function wrapInto(x: number, shift: number, x0: number, x1: number): number {
  const span = x1 - x0;
  return x0 + ((((x - x0 + shift) % span) + span) % span);
}

/**
 * Draws Area 12's wind and waves (issue #211, ND-10, ND-11) from each wind's pose at the trip's
 * element time. Calm shows nothing. The warning shows ripple arcs on the surface across the span at
 * DEPTH.windRipple, facing the coming gust's way; the gust shows rows of streaks with chevrons through
 * the surface band at DEPTH.windStreak, facing the gust's way and fainter with depth, as the push is.
 * The two read apart by shape in greyscale: curved arcs against straight lines ending in a chevron.
 * With full motion the ripples drift and the streaks flow the gust's way; under reduced motion both
 * hold still, but still show, since the push is gameplay. No mark shows inside the safe area, where
 * the wind never pushes. Every sprite is made once per trip and reused; a frame allocates only
 * windPose's result per wind. Visual only: nothing here changes game state. Throws when the lake
 * textures are missing.
 */
export class WindView {
  private readonly winds: WindDrawing[];
  private readonly textures: LakeTextures;
  private readonly safeArea: Readonly<SafeArea>;
  /** Reused for each mark's safe area test. */
  private readonly markPoint: Point = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, assets: GameAssets, winds: readonly Readonly<WindSpawn>[], safeArea: Readonly<SafeArea>) {
    this.textures = texturesFor(assets);
    this.safeArea = safeArea;
    this.winds = winds.map((wind) => this.createWind(scene, wind));
  }

  /** Draws one frame. */
  render(frame: WindFrame): void {
    for (const drawing of this.winds) {
      const pose = windPose(drawing.wind, frame.elementTime, frame.reduced);
      this.renderRipples(drawing, pose, frame);
      this.renderStreaks(drawing, pose, frame);
    }
  }

  destroy(): void {
    for (const drawing of this.winds) {
      for (const mark of drawing.ripples) mark.image.destroy();
      for (const mark of drawing.streaks) mark.image.destroy();
    }
  }

  private createWind(scene: Phaser.Scene, wind: Readonly<WindSpawn>): WindDrawing {
    const { x0, x1, fadeY } = wind.wind;
    const rippleCount = Math.max(1, Math.floor((x1 - x0) / RIPPLE_SPACING));
    const ripples = Array.from({ length: rippleCount }, (_, i): Mark => ({
      image: bakedImage(scene, this.textures.windRipple, DEPTH.windRipple),
      baseX: x0 + (i + 0.5) * RIPPLE_SPACING,
      y: SURF + RIPPLE_DEPTH,
    }));
    const streakCount = Math.max(1, Math.floor((x1 - x0) / STREAK_SPACING));
    const rows = STREAK_ROW_DEPTHS.map((depth) => SURF + depth).filter((y) => y < fadeY);
    const streaks = rows.flatMap((y, row) =>
      Array.from({ length: streakCount }, (_, i): Mark => {
        const image = bakedImage(scene, this.textures.windStreak, DEPTH.windStreak);
        image.setAlpha(STREAK_MIN_ALPHA + (1 - STREAK_MIN_ALPHA) * pushShare(y, fadeY));
        return { image, baseX: x0 + (i + 0.5 + row / rows.length) * STREAK_SPACING, y };
      }),
    );
    return { wind, ripples, streaks };
  }

  /** The ripple arcs through the warning, drifting the gust's way with full motion; hidden otherwise. */
  private renderRipples(drawing: WindDrawing, pose: Readonly<WindPose>, frame: WindFrame): void {
    const shown = pose.phase === 'warn';
    const facing = pose.direction === 'right' ? 1 : -1;
    const drift = pose.motion === 'flow' ? facing * pose.warn * RIPPLE_DRIFT : 0;
    const info = this.textures.windRipple;
    const { x0, x1 } = drawing.wind.wind;
    for (const mark of drawing.ripples) {
      const x = wrapInto(mark.baseX, drift, x0, x1);
      if (!shown || !this.markShows(x, mark.y, frame.view)) {
        mark.image.setVisible(false);
        continue;
      }
      mark.image.setVisible(true).setPosition(x, mark.y);
      faceSprite(mark.image, facing, 1 / info.scale);
    }
  }

  /** The gust streaks through the gust, flowing the gust's way with full motion; hidden otherwise. */
  private renderStreaks(drawing: WindDrawing, pose: Readonly<WindPose>, frame: WindFrame): void {
    const shown = pose.phase === 'gust';
    const facing = pose.direction === 'right' ? 1 : -1;
    const flow = pose.motion === 'flow' ? facing * frame.elementTime * STREAK_SPEED : 0;
    const info = this.textures.windStreak;
    const { x0, x1 } = drawing.wind.wind;
    for (const mark of drawing.streaks) {
      const x = wrapInto(mark.baseX, flow, x0, x1);
      if (!shown || !this.markShows(x, mark.y, frame.view)) {
        mark.image.setVisible(false);
        continue;
      }
      mark.image.setVisible(true).setPosition(x, mark.y);
      faceSprite(mark.image, facing, 1 / info.scale);
    }
  }

  /** True when a mark at (`x`, `y`) is near the camera view and outside the safe area. */
  private markShows(x: number, y: number, view: Readonly<Phaser.Geom.Rectangle>): boolean {
    if (x < view.x - VIEW_MARGIN || x > view.x + view.width + VIEW_MARGIN) return false;
    this.markPoint.x = x;
    this.markPoint.y = y;
    return !inSafeArea(this.markPoint, this.safeArea);
  }
}
