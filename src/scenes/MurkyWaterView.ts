import type * as Phaser from 'phaser';
import { DEEP_CANAL_TEX, murkyPatchSizeKey, type MurkyPatchTextures, type MurkyWaterTextures } from '../art/deepCanalTextures';
import { AXO_SCENE_SCALE } from '../art/drawAxolotl';
import type { AxolotlArtLook } from '../art/drawAxolotlParts';
import { axolotlInkReach, protectedHaloLookScale } from '../art/drawEffects';
import {
  MURKY_DIM_OUTER_RY,
  MURKY_METER_R,
  MURKY_METER_TEX,
  MURKY_METER_W,
  MURKY_SWIRL_FRAMES,
  MURKY_SWIRL_PERIOD,
  paintMurkyMeter,
} from '../art/drawMurkyWater';
import { DEPTH } from '../art/layers';
import { bake, type TexInfo } from '../art/textures';
import { bodyPoint, type DrawnAxolotl } from '../logic/drawnAxolotl';
import type { MotionProfile } from '../logic/motion';
import { MURKY_WATER_TIMING, insideMurky, type MurkyPatchSpawn, type MurkyTimer } from '../logic/murkyWater';
import type { Vec2 } from '../logic/vec';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const TAU = Math.PI * 2;
/** The ring meter's fill steps: one baked frame per step from empty (0) to full (METER_STEPS). */
const METER_STEPS = 24;
/** Key prefix of the ring meter's step frames; each ends with its step number. */
const METER_STEP_KEY_PREFIX = `${DEEP_CANAL_TEX.murkyMeter}-step-`;
/**
 * How far above the axolotl's centre the meter's centre sits, px at the default look at Large: just
 * past the dim ring's outer edge, so the meter never covers the axolotl.
 */
const METER_ABOVE_PX = MURKY_DIM_OUTER_RY + MURKY_METER_R + MURKY_METER_W;
/** Where the warning bubbles start, in the axolotl's local units: above the head, in front of the gills. */
const BUBBLES_LOCAL_X = 40;
const BUBBLES_LOCAL_Y = -34;
/** Full motion: the warning bubbles lift this many px and settle back over BUBBLES_LIFT_PERIOD_S. */
const BUBBLES_LIFT_PX = 4;
const BUBBLES_LIFT_PERIOD_S = 1.6;

/** One frame of murky water rendering input. SwimScene reuses one object for every frame. */
export interface MurkyWaterFrame {
  /** The axolotl as drawn this frame (drawnAxolotl): the ring, the meter and the cue follow it. */
  body: DrawnAxolotl;
  /** The axolotl's centre as the trip tests it (the swim state's place): the ring shows while it is in a patch. */
  centre: Readonly<Vec2>;
  /** The axolotl's size factor (AXO_SIZE_SCALE for its look's size). */
  size: number;
  /** The trip's murky timer (TripState.murkyTimer). */
  timer: MurkyTimer;
  /** True while the trip is swimming and no bailing bucket toss runs: the ring, the meter and the cue show only then. */
  inWater: boolean;
  motion: MotionProfile;
  /** Scene clock in seconds, for the swirl loop and the bubbles' lift. */
  time: number;
}

/** The reused sprites of one murky patch and the swirl frame it shows. */
interface PatchDrawing {
  frames: MurkyPatchTextures;
  cloud: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  /** The swirl frame shown, or -1 for the still frame. */
  shown: number;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

function murkyTexturesFor(assets: GameAssets): MurkyWaterTextures {
  if (assets.deepCanal === null) {
    throw new Error('MurkyWaterView: murky water needs the baked deep canal textures');
  }
  return assets.deepCanal.murkyWater;
}

/** The baked frames of the patch's size. Throws when that size was not baked. */
function patchFramesFor(textures: MurkyWaterTextures, patch: Readonly<MurkyPatchSpawn>): MurkyPatchTextures {
  const { x0, x1, y0, y1 } = patch.shape;
  const key = murkyPatchSizeKey(x1 - x0, y1 - y0);
  const frames = textures.patches.get(key);
  if (frames === undefined) {
    throw new Error(`MurkyWaterView: no baked murky patch frames of size ${key} for ${patch.id}`);
  }
  return frames;
}

/**
 * The ring meter's frames, step 0 (the baked empty meter) to METER_STEPS (full), each step baked
 * once at the empty meter's bake scale under its own key.
 */
function bakeMeterSteps(scene: Phaser.Scene, empty: TexInfo): TexInfo[] {
  const steps: TexInfo[] = [empty];
  for (let step = 1; step <= METER_STEPS; step++) {
    const share = step / METER_STEPS;
    steps.push(bake(scene, `${METER_STEP_KEY_PREFIX}${step}`, MURKY_METER_TEX, empty.scale, (ctx) => paintMurkyMeter(ctx, share)));
  }
  return steps;
}

/** The meter step for built time `built`: its share of the hit time, rounded down to a whole step. */
function meterStep(built: number): number {
  const share = Math.min(1, Math.max(0, built / MURKY_WATER_TIMING.legAt));
  return Math.floor(share * METER_STEPS);
}

/** Puts a baked image's texture on `image` with its origin; the scale stays the image's own. */
function showFrame(image: Phaser.GameObjects.Image, info: TexInfo): void {
  image.setTexture(info.key).setOrigin(info.originNormX, info.originNormY);
}

/**
 * Draws Area 9's murky water (issue #107, ND-1): each patch's cloud and dotted outline, and, round
 * the axolotl, the dim ring while its centre is in a patch, the ring meter while the murky timer has
 * built time, and the warning cue (a cheek tint in the queasy tint's places and three little bubbles
 * over its head) from the warning time on. Visual only: the timer is the trip's, and nothing here
 * changes game state.
 *
 * Cloud: each patch's frames are the baked ones of its size, centred on its rect, at 1:1, so what is
 * drawn is the rect the logic tests. Under full motion the cloud loops through its MURKY_SWIRL_FRAMES
 * swirl frames once every MURKY_SWIRL_PERIOD seconds of the scene clock; under reduced motion it
 * shows the still frame, which has no swirl. The dotted outline is the same in every frame and holds
 * the patch's edge in greyscale.
 *
 * Round the axolotl: the ring, the meter and the cue show only in the water (`inWater`), never
 * during a bailing bucket toss or the carry. The dim ring sits on the axolotl's centre with its
 * rotation, sized like the protected halo (protectedHaloLookScale and the size factor), so its hole
 * stays wider than the axolotl. The meter shows built time over the hit time in METER_STEPS baked
 * steps, METER_ABOVE_PX over the axolotl's centre at the same scale, unrotated. The cheek tint
 * follows the body's place, rotation, facing and squash, in both motion modes, like the queasy
 * tint; the bubbles sit over the head and lift BUBBLES_LIFT_PX and back under full motion only.
 *
 * It reuses its sprites: the meter's steps are baked once when the view is built, and a frame
 * swaps textures only when the swirl frame or the meter step changes. Per frame it allocates
 * nothing but insideMurky's test. Build it only in an area with murky patches; it throws when the
 * deep canal textures or a patch size's frames are missing.
 */
export class MurkyWaterView {
  private readonly assets: GameAssets;
  private readonly textures: MurkyWaterTextures;
  private readonly patches: readonly Readonly<MurkyPatchSpawn>[];
  private readonly drawings: PatchDrawing[];
  private readonly dimRing: Phaser.GameObjects.Image;
  private readonly meter: Phaser.GameObjects.Image;
  private readonly meterSteps: readonly TexInfo[];
  private readonly cheeks: Phaser.GameObjects.Image;
  private readonly bubbles: Phaser.GameObjects.Image;
  private readonly bubblesAt: Vec2 = { x: 0, y: 0 };
  private meterShown = 0;
  private effectLook: AxolotlArtLook;
  private ringLookScale: number;

  /** `patches` holds the trip's murky patches (murkyPatches of the encounter hazards), in hazard order. */
  constructor(scene: Phaser.Scene, assets: GameAssets, patches: readonly Readonly<MurkyPatchSpawn>[]) {
    this.assets = assets;
    this.textures = murkyTexturesFor(assets);
    this.patches = patches;
    this.drawings = patches.map((patch) => this.createPatch(scene, patch));
    this.dimRing = bakedImage(scene, this.textures.dimRing, DEPTH.halo);
    this.meterSteps = bakeMeterSteps(scene, this.textures.meter);
    this.meter = bakedImage(scene, this.textures.meter, DEPTH.fx);
    this.cheeks = bakedImage(scene, this.textures.cheeks, DEPTH.queasyTint);
    this.bubbles = bakedImage(scene, this.textures.bubbles, DEPTH.bubbles);
    this.effectLook = assets.axolotl.look;
    this.ringLookScale = protectedHaloLookScale(axolotlInkReach(this.effectLook));
  }

  /** Draws one frame. Call after the axolotl rig root has its final transform for the frame. */
  render(frame: Readonly<MurkyWaterFrame>): void {
    for (const drawing of this.drawings) this.renderCloud(drawing, frame);
    this.refreshEffectLook();
    const { timer } = frame;
    const inside = frame.inWater && insideMurky(frame.centre, this.patches);
    this.renderDimRing(inside, frame);
    this.renderMeter(frame.inWater && timer.built > 0, frame);
    const warning = frame.inWater && timer.built >= MURKY_WATER_TIMING.warnAt;
    this.renderCheeks(warning, frame);
    this.renderBubbles(warning, frame);
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.cloud.destroy();
      drawing.outline.destroy();
    }
    this.dimRing.destroy();
    this.meter.destroy();
    this.cheeks.destroy();
    this.bubbles.destroy();
  }

  /** The cloud and the outline over it, centred on the patch's rect, showing the still frame. */
  private createPatch(scene: Phaser.Scene, patch: Readonly<MurkyPatchSpawn>): PatchDrawing {
    const frames = patchFramesFor(this.textures, patch);
    const { x0, x1, y0, y1 } = patch.shape;
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    return {
      frames,
      cloud: bakedImage(scene, frames.still, DEPTH.murkyCloud).setPosition(x, y).setVisible(true),
      outline: bakedImage(scene, frames.outline, DEPTH.murkyCloud).setPosition(x, y).setVisible(true),
      shown: -1,
    };
  }

  /** The swirl frame of the loop at the scene clock under full motion; the still frame (-1) under reduced motion. The clock is never negative. */
  private renderCloud(drawing: PatchDrawing, frame: Readonly<MurkyWaterFrame>): void {
    const loop = (frame.time % MURKY_SWIRL_PERIOD) / MURKY_SWIRL_PERIOD;
    const wanted = frame.motion.ambient ? Math.floor(loop * MURKY_SWIRL_FRAMES) % MURKY_SWIRL_FRAMES : -1;
    if (wanted === drawing.shown) return;
    drawing.shown = wanted;
    showFrame(drawing.cloud, wanted < 0 ? drawing.frames.still : drawing.frames.swirl[wanted]);
  }

  /** Works the ring's look scale out again only when the axolotl's look changed. */
  private refreshEffectLook(): void {
    const look = this.assets.axolotl.look;
    if (look === this.effectLook) return;
    this.effectLook = look;
    this.ringLookScale = protectedHaloLookScale(axolotlInkReach(look));
  }

  /** The dim ring on the axolotl's centre with its rotation, sized like the protected halo. */
  private renderDimRing(visible: boolean, frame: Readonly<MurkyWaterFrame>): void {
    if (!visible) {
      this.dimRing.setVisible(false);
      return;
    }
    const { body } = frame;
    this.dimRing
      .setVisible(true)
      .setPosition(body.x, body.y)
      .setRotation(body.rotation)
      .setScale((frame.size * this.ringLookScale) / this.textures.dimRing.scale);
  }

  /** The meter step for the built time, METER_ABOVE_PX over the axolotl's centre at the ring's scale. */
  private renderMeter(visible: boolean, frame: Readonly<MurkyWaterFrame>): void {
    if (!visible) {
      this.meter.setVisible(false);
      return;
    }
    const step = meterStep(frame.timer.built);
    if (step !== this.meterShown) {
      this.meterShown = step;
      showFrame(this.meter, this.meterSteps[step]);
    }
    const scale = frame.size * this.ringLookScale;
    const { body } = frame;
    this.meter
      .setVisible(true)
      .setPosition(body.x, body.y - METER_ABOVE_PX * scale)
      .setScale(scale / this.meterSteps[step].scale);
  }

  /** The cheek tint at the rig root with its rotation, facing and squash, in axolotl local units. */
  private renderCheeks(visible: boolean, frame: Readonly<MurkyWaterFrame>): void {
    if (!visible) {
      this.cheeks.setVisible(false);
      return;
    }
    const { body } = frame;
    const scale = (AXO_SCENE_SCALE * frame.size) / this.textures.cheeks.scale;
    faceSprite(
      this.cheeks.setVisible(true).setPosition(body.x, body.y).setRotation(body.rotation),
      body.facing,
      scale * body.squash,
      scale,
    );
  }

  /** The bubbles over the head, lifting and settling under full motion, still under reduced motion. */
  private renderBubbles(visible: boolean, frame: Readonly<MurkyWaterFrame>): void {
    if (!visible) {
      this.bubbles.setVisible(false);
      return;
    }
    const at = bodyPoint(frame.body, AXO_SCENE_SCALE * frame.size, BUBBLES_LOCAL_X, BUBBLES_LOCAL_Y, this.bubblesAt);
    const lift = frame.motion.ambient
      ? BUBBLES_LIFT_PX * 0.5 * (1 - Math.cos((TAU * frame.time) / BUBBLES_LIFT_PERIOD_S))
      : 0;
    this.bubbles.setVisible(true).setPosition(at.x, at.y - lift);
  }
}
