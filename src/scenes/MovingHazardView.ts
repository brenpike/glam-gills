import type * as Phaser from 'phaser';
import {
  POLE_SHAFT_LENGTH,
  PUNTING_SHADOW_DROP,
  poleShaftPieceCount,
  poleShaftPieceFrom,
  poleShaftPieceLift,
  poleShaftPieceTo,
} from '../art/drawPuntingPole';
import { DEPTH } from '../art/layers';
import {
  movingHazardLookTextures,
  type MovingHazardLookTextures,
  type MovingHazardTextures,
} from '../art/movingHazardTextures';
import type { TexInfo } from '../art/textures';
import type { EncounterState } from '../logic/encounter';
import type { MotionProfile } from '../logic/motion';
import {
  PUNTING_POLE,
  movingHazardDepth,
  movingHazardPhase,
  movingHazardTipDepth,
  type MovingHazardPhaseName,
  type MovingHazardSpawn,
} from '../logic/movingHazards';
import { SURF } from '../logic/zone';
import type { GameAssets } from './BootScene';

/** Px of shaft drawn above the surface, hidden behind the bow: the shaft art's length less the pole's full depth. */
const SHAFT_ABOVE_SURFACE_PX = POLE_SHAFT_LENGTH - PUNTING_POLE.depth;
/** Px the tip is held above the surface at rest, the pole lifted out of the water. */
const REST_LIFT_PX = 24;
/** Full motion: share of the warning over which the tip dips from its rest lift to the surface. */
const DIP_SHARE = 0.4;
/** Full motion: the scale the ripple ring grows from once the tip reaches the surface. */
const RING_GROW_FROM = 0.5;

/** One frame of moving hazard rendering input: the encounter (its `hazardTime`) and the motion setting. */
export interface MovingHazardFrame {
  /** The trip's encounter; its `hazardTime` places the hazards. */
  encounter: Pick<EncounterState, 'hazardTime'>;
  motion: MotionProfile;
}

/** The four reused sprites of one moving hazard spawn. */
interface MovingHazardDrawing {
  spawn: Readonly<MovingHazardSpawn>;
  textures: MovingHazardLookTextures;
  /** The boat's shadow on the water, centred PUNTING_SHADOW_DROP px under the surface at the shaft's x. */
  shadow: Phaser.GameObjects.Image;
  /** The shaft, anchored at its tip and cropped to the drawn length (to POLE_TILE_TO when stacked). */
  shaft: Phaser.GameObjects.Image;
  /** The spawn's longest drawn shaft, px from the tip up: its own depth plus SHAFT_ABOVE_SURFACE_PX. */
  fullLength: number;
  /**
   * The stacked shaft pieces above `shaft`, one per piece the spawn needs at `fullLength` (none
   * when it fits the art, as at the default depth). Added after the shaft and before the bow.
   */
  tiles: Phaser.GameObjects.Image[];
  /** The bow on the water line over the shaft. Added after the shaft, so it draws over the shaft's top. */
  bow: Phaser.GameObjects.Image;
  /** The ripple ring where the tip dips, on the water line at the shaft's x. */
  ring: Phaser.GameObjects.Image;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth);
}

function movingHazardTexturesFor(assets: GameAssets): MovingHazardTextures {
  if (assets.movingHazards === null) {
    throw new Error('MovingHazardView: moving hazards need the baked moving hazard textures');
  }
  return assets.movingHazards;
}

/**
 * Draws each moving hazard (issue #117; PRD N3, A2, ND-8, ND-9) from its spawn and the encounter's
 * `hazardTime`, with the textures baked for its type's `look` (four parts: bow, shadow, shaft and
 * ring). Visual only: nothing here changes game state, and every place comes from the logic at
 * `hazardTime`, so the drawing stops with the pause and the carry home as the hazard does.
 *
 * Mapping: the bow sits on the surface at the shaft's x. The shaft's tip is drawn at the logic tip
 * (the surface plus movingHazardTipDepth) through the jab, the hold and the lift, so what is drawn
 * is what touches; the shaft is cropped to run up from the tip to SHAFT_ABOVE_SURFACE_PX over the
 * surface, behind the bow, at the spawn's own depth (movingHazardDepth). When that needs more than
 * the art's POLE_SHAFT_LENGTH (issue #118, ND-4), extra shaft sprites made up front stack copies
 * of the art's middle above the base one (poleShaftPieceCount), with the node spacing kept; a pole
 * at the default depth is one cropped sprite. At rest the pole is lifted, its tip REST_LIFT_PX over
 * the surface.
 *
 * Warning (movingHazardPhase 'warn'): under full motion the boat's shadow darkens (its alpha goes
 * 0 to 1 over the warning), the tip dips from its rest lift to the surface over the first DIP_SHARE
 * of the warning, and then the ripple ring grows at the tip. The shadow holds through the jab and
 * the hold and lightens over the lift. Under reduced motion the shadow shows still at full alpha
 * from the warning through the lift, the tip is at the surface for the whole warning and the ring
 * shows still at full size for the whole warning; the jab, hold and lift still move, as they are
 * gameplay. The greyscale outlines are in the bakes. The pole is never shown hitting or pinning the
 * axolotl: a hit shows only PredatorView's shared leg-loss poof.
 *
 * It reuses its sprites. Per frame it allocates only movingHazardPhase's result for each spawn.
 * Build it only in an area with moving hazards; it throws when the moving hazard textures are
 * missing or a spawn's look has none baked, and on render when the encounter has no `hazardTime`.
 */
export class MovingHazardView {
  private readonly drawings: MovingHazardDrawing[] = [];

  /** `spawns` holds the encounter's moving hazards (EncounterState.movingHazards). */
  constructor(scene: Phaser.Scene, assets: GameAssets, spawns: readonly Readonly<MovingHazardSpawn>[]) {
    const baked = movingHazardTexturesFor(assets);
    for (const spawn of spawns) {
      const textures = movingHazardLookTextures(baked, spawn.type.look);
      const fullLength = movingHazardDepth(spawn) + SHAFT_ABOVE_SURFACE_PX;
      const shadow = bakedImage(scene, textures.shadow, DEPTH.movingHazard).setPosition(spawn.x, SURF + PUNTING_SHADOW_DROP);
      const shaft = bakedImage(scene, textures.shaft, DEPTH.movingHazard);
      const tiles: Phaser.GameObjects.Image[] = [];
      for (let i = 1; i < poleShaftPieceCount(fullLength, fullLength); i++) {
        tiles.push(bakedImage(scene, textures.shaft, DEPTH.movingHazard).setVisible(false));
      }
      this.drawings.push({
        spawn,
        textures,
        shadow,
        shaft,
        fullLength,
        tiles,
        bow: bakedImage(scene, textures.bow, DEPTH.movingHazard).setPosition(spawn.x, SURF),
        ring: bakedImage(scene, textures.ring, DEPTH.fx).setPosition(spawn.x, SURF).setVisible(false),
      });
    }
  }

  /** Draws one frame. Throws when the encounter has no `hazardTime`. */
  render(frame: MovingHazardFrame): void {
    const hazardTime = frame.encounter.hazardTime;
    if (hazardTime === undefined) {
      throw new Error('MovingHazardView: the encounter has no hazardTime');
    }
    const ambient = frame.motion.ambient;
    for (const drawing of this.drawings) {
      const { phase, progress } = movingHazardPhase(drawing.spawn, hazardTime);
      const depth = movingHazardTipDepth(drawing.spawn, hazardTime);
      this.placeShaft(drawing, SURF + depth - this.liftAboveSurface(phase, progress, ambient));
      drawing.shadow.setAlpha(this.shadowAlpha(phase, progress, ambient));
      this.placeRing(drawing, phase, progress, ambient);
    }
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.shadow.destroy();
      drawing.shaft.destroy();
      for (const tile of drawing.tiles) tile.destroy();
      drawing.bow.destroy();
      drawing.ring.destroy();
    }
  }

  /**
   * Px the drawn tip is held over the surface, on top of the logic tip depth (0 at rest and in the
   * warning): REST_LIFT_PX at rest; in the warning, dipping to 0 over DIP_SHARE under full motion,
   * 0 at once under reduced motion; 0 in the jab, the hold and the lift.
   */
  private liftAboveSurface(phase: MovingHazardPhaseName, progress: number, ambient: boolean): number {
    if (phase === 'rest') return REST_LIFT_PX;
    if (phase !== 'warn' || !ambient) return 0;
    return REST_LIFT_PX * (1 - Math.min(1, progress / DIP_SHARE));
  }

  /**
   * Puts the shaft's tip at `tipY` and crops it to run up to SHAFT_ABOVE_SURFACE_PX over the
   * surface, so its top stays behind the bow at every depth (the whole art at its longest). A spawn
   * deeper than the art fits shows its stacked pieces above the base one (poleShaftPieceCount).
   */
  private placeShaft(drawing: MovingHazardDrawing, tipY: number): void {
    const info = drawing.textures.shaft;
    const length = tipY - (SURF - SHAFT_ABOVE_SURFACE_PX);
    const cropTop = Math.max(0, (info.originY - poleShaftPieceTo(0, length, drawing.fullLength)) * info.scale);
    drawing.shaft.setPosition(drawing.spawn.x, tipY).setCrop(0, cropTop, info.pxW, info.pxH - cropTop);
    if (drawing.tiles.length === 0) return;
    const count = poleShaftPieceCount(length, drawing.fullLength);
    for (let i = 0; i < drawing.tiles.length; i++) {
      this.placeTile(drawing, drawing.tiles[i], i + 1, count, length, tipY);
    }
  }

  /** Shows stacked shaft piece `index` (1 or more) for the drawn `length`, or hides it when unused. */
  private placeTile(
    drawing: MovingHazardDrawing,
    tile: Phaser.GameObjects.Image,
    index: number,
    count: number,
    length: number,
    tipY: number,
  ): void {
    if (index >= count) {
      tile.setVisible(false);
      return;
    }
    const info = drawing.textures.shaft;
    const from = poleShaftPieceFrom(index);
    const to = poleShaftPieceTo(index, length, drawing.fullLength);
    tile
      .setPosition(drawing.spawn.x, tipY - poleShaftPieceLift(index))
      .setCrop(0, (info.originY - to) * info.scale, info.pxW, (to - from) * info.scale)
      .setVisible(true);
  }

  /**
   * The shadow's alpha: 0 at rest; 1 from the warning through the hold, and through the lift under
   * reduced motion. Under full motion it darkens 0 to 1 over the warning and lightens over the lift.
   */
  private shadowAlpha(phase: MovingHazardPhaseName, progress: number, ambient: boolean): number {
    if (phase === 'rest') return 0;
    if (!ambient) return 1;
    if (phase === 'warn') return progress;
    if (phase === 'lift') return 1 - progress;
    return 1;
  }

  /**
   * The ring shows only in the warning: under full motion once the tip reaches the surface, growing
   * to full size by the warning's end; under reduced motion still at full size for the whole warning.
   */
  private placeRing(drawing: MovingHazardDrawing, phase: MovingHazardPhaseName, progress: number, ambient: boolean): void {
    const dipped = phase === 'warn' && (!ambient || progress >= DIP_SHARE);
    if (!dipped) {
      drawing.ring.setVisible(false);
      return;
    }
    const share = ambient ? (progress - DIP_SHARE) / (1 - DIP_SHARE) : 1;
    const scale = RING_GROW_FROM + (1 - RING_GROW_FROM) * share;
    drawing.ring.setVisible(true).setScale(scale / drawing.textures.ring.scale);
  }
}
