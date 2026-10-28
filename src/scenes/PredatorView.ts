import * as Phaser from 'phaser';
import type { AxolotlRigBake } from '../art/axolotlRig';
import { AXO_SCENE_SCALE, axolotlLegRoots } from '../art/drawAxolotl';
import type { AxolotlArtLook } from '../art/drawAxolotlParts';
import { axolotlInkReach, carryBubbleLookScale, protectedHaloLookScale } from '../art/drawEffects';
import type { TilapiaPose } from '../art/drawTilapia';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import type { EncounterState } from '../logic/encounter';
import { isProtected } from '../logic/legs';
import type { MotionProfile } from '../logic/motion';
import { TILAPIA_SPECIES } from '../logic/predators';
import { anchorWorld } from '../logic/spriteAnchor';
import { phaseProgress, type TilapiaPhase, type TilapiaState } from '../logic/tilapia';
import type { TripEvent } from '../logic/trip';
import type { TripPhase } from '../logic/tripEvents';
import type { Vec2 } from '../logic/vec';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

const POSE_BY_PHASE: Readonly<Record<TilapiaPhase, TilapiaPose>> = {
  patrol: 'swim',
  telegraph: 'windup',
  lunge: 'lunge',
  cooldown: 'rest',
};
const ALERT_OFFSET_Y = -62;
const GLINT_OFFSET_X = 46;
const GLINT_OFFSET_Y = -12;
const GLINT_GROW_FROM = 0.6;
const POOF_POOL = 2;
const POOF_LIFE_S = 0.6;
const POOF_SCALE = 0.8;
const POOF_GROW_FROM = 0.7;
const POOF_GROW_S = 0.36;
const POOF_FADE_S = 0.4;
const REGROW_POOL = 6;
const REGROW_PER_LEG = 3;
const REGROW_LIFE_S = 0.7;
const REGROW_SPREAD_PX = 12;
const REGROW_RISE_PX = 10;
const BOOST_POOL = 3;
const BOOST_STAR_R = 7;
const BOOST_LIFE_S = 1.2;
const BOOST_GROW_S = 0.3;
const BOOST_FADE_S = 0.4;
const BOOST_GROW_FROM = 0.6;
const BOOST_RISE_PX = 8;
/** Shell sparkle (guide 9): four twinkles round the torso centre, at 45, 135, 225 and 315 degrees. */
const SHELL_TWINKLE_ANGLES: readonly number[] = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
/** Torso centre the Shell twinkles sit round, in axolotl art local units. */
const SHELL_CENTRE: Vec2 = { x: -8, y: 4 };
/** Shell twinkle distance from the torso centre, in axolotl art local units. */
const SHELL_REACH = 26;
const SHELL_SPREAD_PX = 6;
const SHELL_LIFE_S = 0.5;
/** Shell twinkles at R 5: the sparkle art's arms reach R 9. */
const SHELL_TWINKLE_SCALE = 5 / 9;

/** One frame of predator rendering input. `phase` is the trip phase for this frame. */
export interface PredatorFrame {
  encounter: EncounterState;
  axolotl: Phaser.GameObjects.Container;
  motion: MotionProfile;
  dt: number;
  phase: TripPhase;
}

interface TilapiaSprites {
  body: Phaser.GameObjects.Image;
  alert: Phaser.GameObjects.Image;
  glint: Phaser.GameObjects.Image;
}

/** One Shell sparkle twinkle and where it sits on the axolotl, in art local units. */
interface ShellTwinkle {
  image: Phaser.GameObjects.Image;
  local: Vec2;
}

/** A short-lived effect pinned to one leg root of the axolotl. */
interface LegEffect {
  image: Phaser.GameObjects.Image;
  leg: number;
  age: number;
  life: number;
  offset: Vec2;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth);
}

function createLegEffect(image: Phaser.GameObjects.Image, life: number): LegEffect {
  return { image: image.setVisible(false), leg: 0, age: life, life, offset: { x: 0, y: 0 } };
}

/**
 * World position of an axolotl leg root for the look the bake currently shows, following the
 * rig root's position, scale and rotation. A root facing left has a negative `scaleX`, which
 * mirrors the leg root about the anchor.
 */
function legRootWorld(axolotl: Phaser.GameObjects.Container, bake: AxolotlRigBake, leg: number): Vec2 {
  const root = axolotlLegRoots(bake.look)[leg];
  if (!root) {
    throw new Error(`PredatorView: no leg root for leg ${leg}`);
  }
  return anchorWorld(axolotl, bake.scale, root);
}

/**
 * The axolotl's on-screen size factor (1 at Large), from the rig root's unsquashed scale and the
 * bake's pixels per local unit.
 */
function axolotlSizeFactor(axolotl: Phaser.GameObjects.Container, bake: AxolotlRigBake): number {
  return (axolotl.scaleY * bake.scale) / AXO_SCENE_SCALE;
}

/**
 * Draws the tilapia, its telegraph, the leg-loss poof (for a hit from any source: a predator, a
 * hazard or a moving hazard spawn, a crayfish pinch included), regrow sparkles, the snack speed-up star, the Shell sparkle,
 * the protected halo and the carry-home bubble. Visual only: every timer here is driven by the
 * frame `dt`, so it freezes with the scene, and nothing here changes game state.
 *
 * The poof and the halo never look up the hit's source: the poof sits at the lost leg's root and
 * the halo on the axolotl, so a hit whose `sourceId` is a moving hazard spawn id (not a predator
 * route id) draws exactly like a predator's.
 */
export class PredatorView {
  private readonly scene: Phaser.Scene;
  private readonly assets: GameAssets;
  /**
   * Sprites of each encounter predator, in `predators` order; null for every species but the
   * tilapia (HeronView, GarterSnakeView, CarpView and CrayfishView draw theirs).
   */
  private readonly predators: (TilapiaSprites | null)[];
  private readonly poofs: LegEffect[];
  private readonly regrowSparkles: LegEffect[];
  private readonly boostStars: LegEffect[];
  private readonly boostStarInfo: TexInfo;
  private readonly shellTwinkles: ShellTwinkle[];
  private readonly halo: Phaser.GameObjects.Image;
  private readonly carryBubble: Phaser.GameObjects.Image;
  private effectLook: AxolotlArtLook;
  private haloLookScale: number;
  private carryBubbleLookScale: number;
  private poofCursor = 0;
  private regrowCursor = 0;
  /** Seconds the Shell sparkle has shown; SHELL_LIFE_S when it is not showing. */
  private shellAge = SHELL_LIFE_S;

  /**
   * `speciesIds` holds the species id of each encounter predator, in `predators` order.
   * Only the tilapia gets sprites here; every other species is skipped, so a new species never gets
   * a tilapia sprite. Its own view draws it.
   */
  constructor(scene: Phaser.Scene, assets: GameAssets, speciesIds: readonly string[]) {
    this.scene = scene;
    this.assets = assets;
    const predator = assets.predator;
    this.predators = speciesIds.map((speciesId) => this.createPredatorSprites(speciesId));
    this.halo = bakedImage(scene, predator.halo, DEPTH.halo).setVisible(false);
    this.carryBubble = bakedImage(scene, predator.carryBubble, DEPTH.bubbles).setVisible(false);
    this.effectLook = assets.axolotl.look;
    const reach = axolotlInkReach(this.effectLook);
    this.haloLookScale = protectedHaloLookScale(reach);
    this.carryBubbleLookScale = carryBubbleLookScale(reach);
    this.poofs = Array.from({ length: POOF_POOL }, () =>
      createLegEffect(bakedImage(scene, predator.poof, DEPTH.fx), POOF_LIFE_S),
    );
    this.regrowSparkles = Array.from({ length: REGROW_POOL }, () =>
      createLegEffect(bakedImage(scene, assets.baked.sparkle, DEPTH.fx), REGROW_LIFE_S),
    );
    const starInfo: TexInfo | undefined = assets.baked.hiding.hintStars[BOOST_STAR_R];
    if (!starInfo) {
      throw new Error(`PredatorView: no hint star of radius ${BOOST_STAR_R} for the snack speed-up`);
    }
    this.boostStarInfo = starInfo;
    this.boostStars = Array.from({ length: BOOST_POOL }, () =>
      createLegEffect(bakedImage(scene, starInfo, DEPTH.fx), BOOST_LIFE_S),
    );
    this.shellTwinkles = SHELL_TWINKLE_ANGLES.map((angle) => ({
      image: bakedImage(scene, assets.baked.sparkle, DEPTH.fx).setVisible(false),
      local: { x: SHELL_CENTRE.x + SHELL_REACH * Math.cos(angle), y: SHELL_CENTRE.y + SHELL_REACH * Math.sin(angle) },
    }));
  }

  /**
   * Starts the effects for this step's trip events: a poof on a hit, sparkles on a regrown leg and
   * the Shell sparkle on a hit the Shell blocked (PRD A22). A hit is read by its leg only, whatever
   * its source (a predator route, a hazard or a moving hazard spawn).
   */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type === 'hit') this.startPoof(event.leg);
      if (event.type === 'regrown') this.startRegrowSparkles(event.leg);
      if (event.type === 'shellBlock') this.shellAge = 0;
    }
  }

  /**
   * Shows a speed-up star at each leg a snack helped regrow (PRD A19); a leg listed twice gets one
   * star. A star still holding is kept on longer; a fading one is left to fade under a fresh star.
   */
  startSnackBoost(legs: readonly number[]): void {
    for (const leg of new Set(legs)) this.startBoostStar(leg);
  }

  /** Draws one frame. Call after the axolotl rig root has its final transform for the frame. */
  render(frame: PredatorFrame): void {
    frame.encounter.predators.forEach((predator, i) => {
      const sprites = this.predators[i];
      if (sprites) this.renderTilapia(sprites, predator, frame);
    });
    this.refreshEffectLook();
    this.renderHalo(frame);
    this.renderCarryBubble(frame);
    this.renderPoofs(frame);
    this.renderRegrowSparkles(frame);
    this.renderBoostStars(frame);
    this.renderShellSparkle(frame);
  }

  /** Hides every short-lived effect, the halo and the carry bubble (new trip). */
  reset(): void {
    for (const effect of [...this.poofs, ...this.regrowSparkles, ...this.boostStars]) {
      effect.age = effect.life;
      effect.image.setVisible(false);
    }
    this.shellAge = SHELL_LIFE_S;
    for (const twinkle of this.shellTwinkles) twinkle.image.setVisible(false);
    this.halo.setVisible(false);
    this.carryBubble.setVisible(false);
  }

  private createPredatorSprites(speciesId: string): TilapiaSprites | null {
    if (speciesId !== TILAPIA_SPECIES.id) return null;
    const predator = this.assets.predator;
    return {
      body: bakedImage(this.scene, predator.tilapia.swim, DEPTH.tilapia),
      glint: bakedImage(this.scene, predator.glint, DEPTH.tilapia).setVisible(false),
      alert: bakedImage(this.scene, predator.alert, DEPTH.fx).setVisible(false),
    };
  }

  private renderTilapia(sprites: TilapiaSprites, tilapia: TilapiaState, frame: PredatorFrame): void {
    const info = this.assets.predator.tilapia[POSE_BY_PHASE[tilapia.phase]];
    const facing = this.tilapiaFacing(tilapia, frame.axolotl);
    const { x, y } = tilapia.pos;
    sprites.body
      .setTexture(info.key)
      .setOrigin(info.originNormX, info.originNormY)
      .setPosition(x, y);
    faceSprite(sprites.body, facing, 1 / info.scale);

    const telegraph = tilapia.phase === 'telegraph';
    sprites.alert.setVisible(telegraph).setPosition(x, y + ALERT_OFFSET_Y);
    const glintInfo = this.assets.predator.glint;
    const grow = frame.motion.ambient ? GLINT_GROW_FROM + (1 - GLINT_GROW_FROM) * phaseProgress(tilapia) : 1;
    sprites.glint
      .setVisible(telegraph)
      .setPosition(x + facing * GLINT_OFFSET_X, y + GLINT_OFFSET_Y)
      .setScale(grow / glintInfo.scale);
  }

  /** In cooldown the tilapia turns away from the axolotl, so it is never shown holding on. */
  private tilapiaFacing(tilapia: TilapiaState, axolotl: Phaser.GameObjects.Container): -1 | 1 {
    if (tilapia.phase !== 'cooldown') return tilapia.facing;
    const away = Math.sign(tilapia.pos.x - axolotl.x);
    if (away > 0) return 1;
    if (away < 0) return -1;
    return tilapia.facing;
  }

  /** Re-measures the halo and carry bubble look scales when the axolotl bake shows a new look. */
  private refreshEffectLook(): void {
    const look = this.assets.axolotl.look;
    if (look === this.effectLook) return;
    this.effectLook = look;
    const reach = axolotlInkReach(look);
    this.haloLookScale = protectedHaloLookScale(reach);
    this.carryBubbleLookScale = carryBubbleLookScale(reach);
  }

  /**
   * The halo is sized at Large for the default look, grown for a look that reaches further, and
   * scaled with the axolotl's size factor, so it keeps its clearance.
   */
  private renderHalo(frame: PredatorFrame): void {
    const visible = frame.phase === 'swimming' && isProtected(frame.encounter.legs);
    const sizeFactor = axolotlSizeFactor(frame.axolotl, this.assets.axolotl);
    this.halo
      .setVisible(visible)
      .setPosition(frame.axolotl.x, frame.axolotl.y)
      .setRotation(frame.axolotl.rotation)
      .setScale((sizeFactor * this.haloLookScale) / this.assets.predator.halo.scale);
  }

  /**
   * The carry bubble shows only in the 'carrying' phase, centred on the axolotl, sized at Large for
   * the default look, grown for a look that reaches further, and scaled with its size factor. Under
   * reduced motion the trip holds the axolotl still, so the bubble is static too.
   */
  private renderCarryBubble(frame: PredatorFrame): void {
    const visible = frame.phase === 'carrying';
    const sizeFactor = axolotlSizeFactor(frame.axolotl, this.assets.axolotl);
    this.carryBubble
      .setVisible(visible)
      .setPosition(frame.axolotl.x, frame.axolotl.y)
      .setScale((sizeFactor * this.carryBubbleLookScale) / this.assets.predator.carryBubble.scale);
  }

  private startPoof(leg: number): void {
    const poof = this.poofs[this.poofCursor];
    this.poofCursor = (this.poofCursor + 1) % this.poofs.length;
    poof.leg = leg;
    poof.age = 0;
  }

  private startRegrowSparkles(leg: number): void {
    for (let k = 0; k < REGROW_PER_LEG; k++) {
      const sparkle = this.regrowSparkles[this.regrowCursor];
      this.regrowCursor = (this.regrowCursor + 1) % this.regrowSparkles.length;
      const angle = (k / REGROW_PER_LEG) * Math.PI * 2;
      sparkle.leg = leg;
      sparkle.age = 0;
      sparkle.offset = { x: Math.cos(angle) * REGROW_SPREAD_PX, y: Math.sin(angle) * REGROW_SPREAD_PX };
    }
  }

  /**
   * Re-boosting a holding star sets it back to the start of its hold (a growing star is left
   * growing), so it never regrows or jumps. Otherwise the oldest pooled star starts fresh.
   */
  private startBoostStar(leg: number): void {
    const holding = this.boostStars.find((star) => star.leg === leg && star.age < BOOST_LIFE_S - BOOST_FADE_S);
    if (holding) {
      holding.age = Math.min(holding.age, BOOST_GROW_S);
      return;
    }
    const star = this.boostStars.reduce((oldest, candidate) => (candidate.age > oldest.age ? candidate : oldest));
    star.leg = leg;
    star.age = 0;
  }

  private renderPoofs(frame: PredatorFrame): void {
    const info = this.assets.predator.poof;
    for (const poof of this.poofs) {
      if (this.advanceEffect(poof, frame) === null) continue;
      const ambient = frame.motion.ambient;
      const grow = ambient ? POOF_GROW_FROM + (1 - POOF_GROW_FROM) * Math.min(1, poof.age / POOF_GROW_S) : 1;
      const fadeAge = poof.age - (POOF_LIFE_S - POOF_FADE_S);
      const fade = ambient && fadeAge > 0 ? 1 - fadeAge / POOF_FADE_S : 1;
      poof.image.setScale((POOF_SCALE * grow) / info.scale).setAlpha(fade);
    }
  }

  private renderRegrowSparkles(frame: PredatorFrame): void {
    const info = this.assets.baked.sparkle;
    for (const sparkle of this.regrowSparkles) {
      const life = this.advanceEffect(sparkle, frame);
      if (life === null) continue;
      const ambient = frame.motion.ambient;
      sparkle.image
        .setY(sparkle.image.y - (ambient ? REGROW_RISE_PX * life : 0))
        .setAlpha(ambient ? 1 - life : 1)
        .setScale(1 / info.scale);
    }
  }

  /**
   * Stars show only while swimming: any other phase ends them at once, as the HUD badge is hidden,
   * so they never resume after the banked card. Full motion: the star grows and rises over
   * BOOST_GROW_S, holds, then fades over the last BOOST_FADE_S. Reduced motion: full size at the
   * leg root, fully opaque, until it is hidden.
   */
  private renderBoostStars(frame: PredatorFrame): void {
    if (frame.phase !== 'swimming') {
      for (const star of this.boostStars) {
        star.age = star.life;
        star.image.setVisible(false);
      }
      return;
    }
    const baseScale = 1 / this.boostStarInfo.scale;
    for (const star of this.boostStars) {
      if (this.advanceEffect(star, frame) === null) continue;
      if (!frame.motion.ambient) {
        star.image.setScale(baseScale).setAlpha(1);
        continue;
      }
      const grow = Math.min(1, star.age / BOOST_GROW_S);
      const fadeAge = star.age - (BOOST_LIFE_S - BOOST_FADE_S);
      const fade = fadeAge > 0 ? 1 - fadeAge / BOOST_FADE_S : 1;
      star.image
        .setY(star.image.y - BOOST_RISE_PX * grow)
        .setScale((BOOST_GROW_FROM + (1 - BOOST_GROW_FROM) * grow) * baseScale)
        .setAlpha(fade);
    }
  }

  /**
   * Shell sparkle (guide 9), once per blocked hit: the four twinkles sit round the torso centre in
   * the axolotl's local space, so they turn and scale with it while keeping their own size. Full
   * motion: they move SHELL_SPREAD_PX out while their alpha goes 1 to 0 over SHELL_LIFE_S. Reduced
   * motion: still at their end positions, at full alpha, for SHELL_LIFE_S, then gone.
   */
  private renderShellSparkle(frame: PredatorFrame): void {
    this.shellAge = Math.min(this.shellAge + frame.dt, SHELL_LIFE_S);
    const life = this.shellAge / SHELL_LIFE_S;
    if (life >= 1) {
      for (const twinkle of this.shellTwinkles) twinkle.image.setVisible(false);
      return;
    }
    const ambient = frame.motion.ambient;
    const spread = SHELL_SPREAD_PX * (ambient ? life : 1);
    const textureScale = this.assets.axolotl.scale;
    const centre = anchorWorld(frame.axolotl, textureScale, SHELL_CENTRE);
    const scale = SHELL_TWINKLE_SCALE / this.assets.baked.sparkle.scale;
    for (const twinkle of this.shellTwinkles) {
      const at = anchorWorld(frame.axolotl, textureScale, twinkle.local);
      const distance = Math.hypot(at.x - centre.x, at.y - centre.y);
      const out = distance > 0 ? spread / distance : 0;
      twinkle.image
        .setVisible(true)
        .setPosition(at.x + (at.x - centre.x) * out, at.y + (at.y - centre.y) * out)
        .setScale(scale)
        .setAlpha(ambient ? 1 - life : 1);
    }
  }

  /**
   * Ages a leg effect and pins it to its leg root. Returns its life in [0, 1),
   * or null once it is over (it is then hidden).
   */
  private advanceEffect(effect: LegEffect, frame: PredatorFrame): number | null {
    effect.age += frame.dt;
    const life = effect.age / effect.life;
    if (life >= 1) {
      effect.image.setVisible(false);
      return null;
    }
    const root = legRootWorld(frame.axolotl, this.assets.axolotl, effect.leg);
    effect.image.setVisible(true).setPosition(root.x + effect.offset.x, root.y + effect.offset.y);
    return life;
  }
}
