import type * as Phaser from 'phaser';
import {
  PELICAN_BILL_HEAD_BACK,
  PELICAN_FRAME_OF_PHASE,
  PELICAN_NECK_LEN,
  PELICAN_NECK_TOP_Y,
  PELICAN_NECK_X,
  type PelicanFrame,
} from '../art/drawPelican';
import { DEPTH } from '../art/layers';
import type { LakeTextures } from '../art/lakeTextures';
import type { TexInfo } from '../art/textures';
import { PELICAN_PHASES, pelicanBirdCount, pelicanPose, type PelicanLineSpawn, type PelicanPose } from '../logic/pelicanLine';
import { SURF } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

/** One frame of pelican line rendering input. */
export interface PelicanLineFrame {
  /** The trip's element time, which the lines' cycles run on. */
  elementTime: number;
  /** True under reduced motion: the birds glide and dip without bobbing. */
  reduced: boolean;
}

/** One bird's reused sprites. */
interface BirdDrawing {
  line: Readonly<PelicanLineSpawn>;
  /** Index of the bird in its line, first (leftmost) first. */
  index: number;
  /** Body frame, anchored on the water line under the body centre. */
  body: Phaser.GameObjects.Image;
  /** Neck piece, anchored on its top end centre, stretched along y. Added before `bill`, so the head draws over its end. */
  neck: Phaser.GameObjects.Image;
  /** Head and bill piece for the dip, anchored on the round bill tip. */
  bill: Phaser.GameObjects.Image;
  /** Scoop splash, anchored on the water line where the bill goes in. */
  splash: Phaser.GameObjects.Image;
}

function texturesFor(assets: GameAssets): LakeTextures {
  if (assets.lake === null) throw new Error('PelicanLineView: pelican lines need the baked lake textures');
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

/** The body frame for a pose: the phase's frame, with `floatB` while a gliding bird bobs below SURF. */
function bodyFrameOf(pose: Readonly<PelicanPose>): PelicanFrame {
  const phase = PELICAN_PHASES[pose.frame];
  if (phase === undefined) throw new Error(`PelicanLineView: pose frame ${pose.frame} is not a pelican phase`);
  const frame = PELICAN_FRAME_OF_PHASE[phase];
  return frame === 'floatA' && pose.pos.y > SURF ? 'floatB' : frame;
}

/** True for the stump body frames, whose head is the bill piece below them. */
function dips(frame: PelicanFrame): boolean {
  return frame === 'scoop' || frame === 'rise';
}

/**
 * Draws Area 12's pelican lines (issue #211, ND-5, ND-6) from each line's pose at the trip's element
 * time: every bird's body frame floating on the water line at DEPTH.pelicanBody, and through the
 * plunge, hold and rise the neck piece and the head and bill piece hanging down to the bill's depth at
 * DEPTH.pelicanBill, with the scoop splash at the water line through the plunge and hold
 * (DEPTH.pelicanSplash). The warning reads by shape in greyscale: the tall straight neck and the open
 * empty pouch of the `warn` frame; the dip by the body tipped nose down and the neck going under.
 * Under reduced motion the birds glide and dip with no bob, so the body holds `floatA`; with full
 * motion `floatB` shows while a bird bobs below SURF. The bill layer is under the axolotl, and no
 * piece ever shows the axolotl, a grab or a carry: a scoop is only a bump away from the bill (ADR
 * 0007). Every sprite is made once per trip and reused; a frame allocates only pelicanPose's result
 * per bird, bounded by the area's bird count. Visual only: nothing here changes game state. Throws
 * when the lake textures are missing.
 */
export class PelicanLineView {
  private readonly birds: BirdDrawing[] = [];
  private readonly textures: LakeTextures;

  constructor(scene: Phaser.Scene, assets: GameAssets, lines: readonly Readonly<PelicanLineSpawn>[]) {
    this.textures = texturesFor(assets);
    for (const line of lines) {
      for (let index = 0; index < pelicanBirdCount(line); index++) this.birds.push(this.createBird(scene, line, index));
    }
  }

  /** Draws one frame. */
  render(frame: PelicanLineFrame): void {
    for (const bird of this.birds) this.renderBird(bird, frame);
  }

  destroy(): void {
    for (const bird of this.birds) {
      bird.body.destroy();
      bird.neck.destroy();
      bird.bill.destroy();
      bird.splash.destroy();
    }
  }

  private createBird(scene: Phaser.Scene, line: Readonly<PelicanLineSpawn>, index: number): BirdDrawing {
    const art = this.textures;
    return {
      line,
      index,
      body: bakedImage(scene, art.pelican.floatA, DEPTH.pelicanBody),
      neck: bakedImage(scene, art.pelicanNeck, DEPTH.pelicanBill),
      bill: bakedImage(scene, art.pelicanBill, DEPTH.pelicanBill),
      splash: bakedImage(scene, art.pelicanSplash, DEPTH.pelicanSplash),
    };
  }

  private renderBird(bird: BirdDrawing, frame: PelicanLineFrame): void {
    const pose = pelicanPose(bird.line, bird.index, frame.elementTime, frame.reduced);
    const bodyFrame = bodyFrameOf(pose);
    const info = this.textures.pelican[bodyFrame];
    bird.body.setTexture(info.key).setVisible(true).setPosition(pose.pos.x, pose.pos.y);
    faceSprite(bird.body, pose.facing, 1 / info.scale);

    const neckX = pose.pos.x + pose.facing * PELICAN_NECK_X;
    const phase = PELICAN_PHASES[pose.frame];
    bird.splash.setVisible(phase === 'plunge' || phase === 'hold').setPosition(neckX, SURF);
    if (!dips(bodyFrame)) {
      bird.neck.setVisible(false);
      bird.bill.setVisible(false);
      return;
    }
    this.renderDip(bird, pose, neckX);
  }

  /**
   * The dip: the bill piece's round tip at the bill's depth below SURF, and the neck piece from the
   * stump to the head centre, its top at the higher of the two, stretched to the distance between them.
   */
  private renderDip(bird: BirdDrawing, pose: Readonly<PelicanPose>, neckX: number): void {
    const billInfo = this.textures.pelicanBill;
    bird.bill.setVisible(true).setPosition(neckX, SURF + pose.billDepth);
    faceSprite(bird.bill, pose.facing, 1 / billInfo.scale);

    const stumpY = pose.pos.y + PELICAN_NECK_TOP_Y;
    const headY = SURF + pose.billDepth - PELICAN_BILL_HEAD_BACK;
    const length = Math.abs(headY - stumpY);
    const neckInfo = this.textures.pelicanNeck;
    bird.neck.setVisible(length > 0).setPosition(neckX, Math.min(stumpY, headY));
    faceSprite(bird.neck, pose.facing, 1 / neckInfo.scale, length / PELICAN_NECK_LEN / neckInfo.scale);
  }
}
