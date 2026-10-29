import * as Phaser from 'phaser';
import { GATE_H, SIGN_SIZE } from '../art/drawArea';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import type { AreaExit } from '../logic/areas';
import type { ExitArrowSide } from '../logic/exitArrow';
import type { MotionProfile } from '../logic/motion';
import type { Vec2 } from '../logic/vec';
import type { Point } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const TAU = Math.PI * 2;
/** Clear water between the gate's keystone top and the sign's lower edge. */
const SIGN_GAP_PX = 8;
const BURST_COUNT = 3;
const BURST_LIFE_S = 0.6;
const BURST_SPREAD_PX = 6;
/** Opening twinkles at about 12 px, like the crumble twinkles: the sparkle art is about 26 px across. */
const BURST_SCALE = 0.46;

interface Twinkle {
  image: Phaser.GameObjects.Image;
  offset: Vec2;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, x: number, y: number, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth);
}

function showBaked(image: Phaser.GameObjects.Image, info: TexInfo): void {
  image
    .setTexture(info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale);
}

/**
 * Draws the area exit: the gate standing at `base`, on the floor right under the exit centre (the
 * bed or the top of a rock wall, from `exitGateBase`), and the round sign above it, both closed (slats, padlock) or open (clear opening, arrow), and a twinkle
 * burst around the sign when it opens. The open sign's arrow points to `arrowSide`: the baked art
 * points right, so 'left' mirrors the open sign; the closed sign is never mirrored. Visual only: the burst is driven by the frame `dt`, so it freezes with the
 * scene, and nothing here changes game state. An exit already open when the view is built shows
 * open with no burst.
 */
export class ExitView {
  private readonly assets: GameAssets;
  private readonly gate: Phaser.GameObjects.Image;
  private readonly sign: Phaser.GameObjects.Image;
  private readonly signCentre: Vec2;
  private readonly arrowSide: ExitArrowSide;
  private readonly twinkles: Twinkle[];
  private open: boolean;
  private burstAge = BURST_LIFE_S;

  constructor(
    scene: Phaser.Scene,
    assets: GameAssets,
    exit: AreaExit,
    base: Point,
    open: boolean,
    arrowSide: ExitArrowSide,
  ) {
    this.assets = assets;
    this.open = open;
    this.arrowSide = arrowSide;
    const art = assets.area.exit;
    this.gate = bakedImage(scene, open ? art.gateOpen : art.gateClosed, base.x, base.y, DEPTH.homeSpot);
    this.signCentre = { x: base.x, y: base.y - GATE_H - SIGN_GAP_PX - SIGN_SIZE / 2 };
    this.sign = bakedImage(
      scene,
      open ? art.signOpen : art.signClosed,
      this.signCentre.x,
      this.signCentre.y,
      DEPTH.homeRing,
    );
    this.faceSign(open);
    this.twinkles = Array.from({ length: BURST_COUNT }, (_, k) => {
      const angle = (k / BURST_COUNT) * TAU - Math.PI / 2;
      return {
        image: bakedImage(scene, assets.baked.sparkle, 0, 0, DEPTH.fx).setVisible(false),
        offset: { x: Math.cos(angle), y: Math.sin(angle) },
      };
    });
  }

  /** Draws one frame; the frame the exit opens swaps the art and starts the burst. */
  render(open: boolean, motion: MotionProfile, dt: number): void {
    if (open !== this.open) this.showState(open);
    this.renderBurst(motion, dt);
  }

  private showState(open: boolean): void {
    this.open = open;
    const art = this.assets.area.exit;
    showBaked(this.gate, open ? art.gateOpen : art.gateClosed);
    showBaked(this.sign, open ? art.signOpen : art.signClosed);
    this.faceSign(open);
    this.burstAge = open ? 0 : BURST_LIFE_S;
  }

  /** Mirrors the open sign when its arrow points left; the closed sign keeps its baked facing. */
  private faceSign(open: boolean): void {
    const info = open ? this.assets.area.exit.signOpen : this.assets.area.exit.signClosed;
    const facing = open && this.arrowSide === 'left' ? -1 : 1;
    faceSprite(this.sign, facing, 1 / info.scale);
  }

  /**
   * Full motion: the twinkles move 6 px out from the sign's rim while fading. Still: they hold at
   * their end positions at full alpha. Either way they are gone after the burst life.
   */
  private renderBurst(motion: MotionProfile, dt: number): void {
    this.burstAge = Math.min(this.burstAge + dt, BURST_LIFE_S);
    const life = this.burstAge / BURST_LIFE_S;
    const active = life < 1;
    const ambient = motion.ambient;
    const reach = SIGN_SIZE / 2 + BURST_SPREAD_PX * (ambient ? life : 1);
    const scale = BURST_SCALE / this.assets.baked.sparkle.scale;
    for (const twinkle of this.twinkles) {
      twinkle.image
        .setVisible(active)
        .setPosition(this.signCentre.x + twinkle.offset.x * reach, this.signCentre.y + twinkle.offset.y * reach)
        .setScale(scale)
        .setAlpha(ambient ? 1 - life : 1);
    }
  }
}
