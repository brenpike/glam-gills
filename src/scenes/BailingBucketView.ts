import type * as Phaser from 'phaser';
import {
  BAILING_BOAT_POST_TOP_Y,
  BAILING_BUCKET_H,
  BAILING_RIPPLES_ALONG,
  BAILING_ROPE_TOP_Y,
  BAILING_SHADOW_ALONG,
} from '../art/drawBailingBucket';
import type { BailingBucketTextures } from '../art/deepCanalTextures';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import { BAILING_BUCKETS, bucketPhase, tossStart, type BailingBoatSpawn } from '../logic/bailingBuckets';
import type { MotionProfile } from '../logic/motion';
import type { BucketToss, TripEvent } from '../logic/trip';
import { SURF, type Point } from '../logic/zone';
import type { GameAssets } from './BootScene';

/** Seconds the landing splash shows: a one-time fade. */
const SPLASH_LIFE_S = 0.6;
/** Full motion: the scale the landing splash spreads from; it reaches 1 at the end of its life. */
const SPLASH_GROW_FROM = 0.6;
/** The share of a toss for which the bucket stays at the surface with the axolotl peeking from it. */
const PEEK_SHARE = 0.5;
/**
 * Where the dip starts and ends: the rim's place when the top of the bucket's rope is level with
 * the boat's post top, where it ties on.
 */
const DIP_TOP_RIM_Y = SURF + BAILING_BOAT_POST_TOP_Y - BAILING_ROPE_TOP_Y;
/** The deepest the rim goes: the bucket's bottom at the floor of the catch box. */
const DIP_BOTTOM_RIM_Y = SURF + BAILING_BUCKETS.catchDepth - BAILING_BUCKET_H;

/** One frame of bailing bucket rendering input. SwimScene reuses one object for every frame. */
export interface BailingBucketFrame {
  /** The trip's element clock (TripState.elementTime): it places every bucket in its cycle. */
  elementTime: number;
  /** The bailing bucket toss under way (TripState.toss), or null. */
  toss: Readonly<BucketToss> | null;
  motion: MotionProfile;
  dt: number;
}

/** The reused sprites and visual-only state of one bailing boat. */
interface BoatDrawing {
  boat: Readonly<BailingBoatSpawn>;
  hull: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  ripples: Phaser.GameObjects.Image;
  bucket: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  splash: Phaser.GameObjects.Image;
  /** Where the bucket's rim sits in the peek: the toss start (tossStart). */
  peekAt: Readonly<Point>;
  /** Seconds since the last splash-down at this boat's landing point; SPLASH_LIFE_S or more once faded. */
  splashAge: number;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

function bailingTexturesFor(assets: GameAssets): BailingBucketTextures {
  if (assets.deepCanal === null) {
    throw new Error('BailingBucketView: bailing boats need the baked deep canal textures');
  }
  return assets.deepCanal.bailingBucket;
}

/** Seconds into the boat's cycle at element time `t`, 0 up to its period, as bucketPhase counts them. */
function cycleSeconds(boat: Readonly<BailingBoatSpawn>, t: number): number {
  const { period } = boat.type;
  return (((t - boat.offset) % period) + period) % period;
}

/** `value` held within 0..1. */
function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Draws Area 9's bailing boats (issue #107, ND-2): each moored boat, its bucket's warning (a shadow
 * and ripples on the water), the bucket's dip, the peek and the landing splash. Visual only: the
 * cycle is the logic's (bucketPhase at the trip's element time) and the toss is the trip's, so the
 * buckets stop with the pause and nothing here changes game state. The trip draws the tossed
 * axolotl itself (tripTossPose): along the arc, or faded out at the bucket and in at the landing.
 *
 * Boat: the whole hull sits at the middle of its span on the water line, never stretched and never
 * bobbing. Rest: only the boat shows. Warning: the shadow sits BAILING_SHADOW_ALONG px under the
 * surface over the bucket's x and the ripples BAILING_RIPPLES_ALONG px under it; under full motion
 * both fade in over the warning, under reduced motion they show at full alpha. Dip: the bucket comes
 * down from DIP_TOP_RIM_Y to DIP_BOTTOM_RIM_Y and back up over the dip under full motion; under
 * reduced motion it holds at the bottom for the whole dip. It is always inside the catch box, which
 * catches only now.
 *
 * Peek: from the catch on, for PEEK_SHARE of the toss, the catching boat's bucket sits with its rim
 * on the toss start (tossStart) and its front wall and rim over it, above the axolotl: the player's
 * own rig shows over the back of the rim and is covered by the front wall. Under full motion the
 * axolotl leaves on the arc; under reduced motion it fades out there. The bucket's own dip is not
 * drawn while it peeks.
 *
 * Splash: handleEvents starts it at the landing point on `splashDown`. It fades out over
 * SPLASH_LIFE_S, spreading from SPLASH_GROW_FROM under full motion and at full size under reduced
 * motion. Its timer is driven by the frame `dt`, so it freezes with the scene. No sound plays (ND-5).
 *
 * It reuses its sprites and allocates nothing per frame. Build it only in an area with bailing
 * boats; it throws when the deep canal textures are missing.
 */
export class BailingBucketView {
  private readonly drawings: BoatDrawing[];
  private readonly textures: BailingBucketTextures;

  /** `boats` holds the trip's bailing boats (TripState.bailingBoats). */
  constructor(scene: Phaser.Scene, assets: GameAssets, boats: readonly Readonly<BailingBoatSpawn>[]) {
    this.textures = bailingTexturesFor(assets);
    this.drawings = boats.map((boat) => this.createBoat(scene, boat));
  }

  /** Starts the landing splash of each `splashDown` in `events`. Throws when no drawn boat has its id. */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type !== 'splashDown') continue;
      const drawing = this.drawingFor(event.boatId);
      drawing.splash.setPosition(event.at.x, event.at.y);
      drawing.splashAge = 0;
    }
  }

  /** Draws one frame. */
  render(frame: Readonly<BailingBucketFrame>): void {
    for (const drawing of this.drawings) {
      const peeking = this.peeking(drawing, frame.toss);
      this.renderWarning(drawing, frame);
      if (peeking) this.renderPeek(drawing);
      else this.renderDip(drawing, frame);
      this.renderSplash(drawing, frame);
    }
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.hull.destroy();
      drawing.shadow.destroy();
      drawing.ripples.destroy();
      drawing.bucket.destroy();
      drawing.front.destroy();
      drawing.splash.destroy();
    }
  }

  /** The boat's sprites; only the hull shows from the start, at the middle of its span on SURF. */
  private createBoat(scene: Phaser.Scene, boat: Readonly<BailingBoatSpawn>): BoatDrawing {
    const art = this.textures;
    const { x0, x1, bucketX } = boat.bailing;
    return {
      boat,
      hull: bakedImage(scene, art.boat, DEPTH.bailingBoat).setPosition((x0 + x1) / 2, SURF).setVisible(true),
      shadow: bakedImage(scene, art.shadow, DEPTH.bailingShadow).setPosition(bucketX, SURF + BAILING_SHADOW_ALONG),
      ripples: bakedImage(scene, art.ripples, DEPTH.fx).setPosition(bucketX, SURF + BAILING_RIPPLES_ALONG),
      bucket: bakedImage(scene, art.bucket, DEPTH.bailingBucket),
      front: bakedImage(scene, art.front, DEPTH.bailingBucketFront),
      splash: bakedImage(scene, art.splash, DEPTH.fx),
      peekAt: tossStart(boat),
      splashAge: SPLASH_LIFE_S,
    };
  }

  /** The drawing of boat `boatId`. Throws when no drawn boat has that id. */
  private drawingFor(boatId: string): BoatDrawing {
    for (const drawing of this.drawings) {
      if (drawing.boat.id === boatId) return drawing;
    }
    throw new Error(`BailingBucketView: no bailing boat ${boatId} to draw`);
  }

  /** True while `toss` is this boat's and in its first PEEK_SHARE. */
  private peeking(drawing: BoatDrawing, toss: Readonly<BucketToss> | null): boolean {
    return toss !== null && toss.boatId === drawing.boat.id && toss.elapsed < BAILING_BUCKETS.tossFor * PEEK_SHARE;
  }

  /** The shadow and ripples in the warning: fading in over it under full motion, full alpha under reduced motion. */
  private renderWarning(drawing: BoatDrawing, frame: Readonly<BailingBucketFrame>): void {
    const { boat } = drawing;
    const warning = bucketPhase(boat, frame.elementTime) === 'warn';
    if (!warning) {
      drawing.shadow.setVisible(false);
      drawing.ripples.setVisible(false);
      return;
    }
    const into = cycleSeconds(boat, frame.elementTime) - BAILING_BUCKETS.restFor;
    const alpha = frame.motion.ambient ? clampShare(into / BAILING_BUCKETS.warnFor) : 1;
    drawing.shadow.setVisible(true).setAlpha(alpha);
    drawing.ripples.setVisible(true).setAlpha(alpha);
  }

  /**
   * The bucket in the dip: down and back up over the dip under full motion, held at the bottom under
   * reduced motion; hidden in the rest and the warning. Its front wall shows only in the peek.
   */
  private renderDip(drawing: BoatDrawing, frame: Readonly<BailingBucketFrame>): void {
    const { boat } = drawing;
    drawing.front.setVisible(false);
    if (bucketPhase(boat, frame.elementTime) !== 'dip') {
      drawing.bucket.setVisible(false);
      return;
    }
    const into = cycleSeconds(boat, frame.elementTime) - BAILING_BUCKETS.restFor - BAILING_BUCKETS.warnFor;
    const reach = frame.motion.ambient ? Math.sin(Math.PI * clampShare(into / BAILING_BUCKETS.dipFor)) : 1;
    const rimY = DIP_TOP_RIM_Y + (DIP_BOTTOM_RIM_Y - DIP_TOP_RIM_Y) * reach;
    drawing.bucket.setVisible(true).setPosition(boat.bailing.bucketX, rimY);
  }

  /** The bucket and its front wall with the rim on the toss start, over the peeking axolotl. */
  private renderPeek(drawing: BoatDrawing): void {
    const start = drawing.peekAt;
    drawing.bucket.setVisible(true).setPosition(start.x, start.y);
    drawing.front.setVisible(true).setPosition(start.x, start.y);
  }

  /** The splash ages by `dt` and fades over SPLASH_LIFE_S, then hides. */
  private renderSplash(drawing: BoatDrawing, frame: Readonly<BailingBucketFrame>): void {
    if (drawing.splashAge >= SPLASH_LIFE_S) {
      drawing.splash.setVisible(false);
      return;
    }
    const share = drawing.splashAge / SPLASH_LIFE_S;
    const grow = frame.motion.ambient ? SPLASH_GROW_FROM + (1 - SPLASH_GROW_FROM) * share : 1;
    drawing.splash
      .setVisible(true)
      .setAlpha(1 - share)
      .setScale(grow / this.textures.splash.scale);
    drawing.splashAge = Math.min(drawing.splashAge + frame.dt, SPLASH_LIFE_S);
  }
}
