import type * as Phaser from 'phaser';
import { poleShaftPieceCount, poleShaftPieceFrom, poleShaftPieceLift, poleShaftPieceTo } from '../art/drawPuntingPole';
import { DEPTH } from '../art/layers';
import {
  movingHazardLookPlace,
  movingHazardLookTextures,
  type MovingHazardLookPlace,
  type MovingHazardLookTextures,
  type MovingHazardTextures,
} from '../art/movingHazardTextures';
import type { TexInfo } from '../art/textures';
import type { EncounterState } from '../logic/encounter';
import type { MotionProfile } from '../logic/motion';
import {
  movingHazardBaseY,
  movingHazardDepth,
  movingHazardDirection,
  movingHazardPhase,
  movingHazardTipDepth,
  type MovingHazardPhaseName,
  type MovingHazardSpawn,
} from '../logic/movingHazards';
import type { GameAssets } from './BootScene';

/** Full motion: share of the warning over which the tip comes out from its rest place to the base. */
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
  /** Where the look's parts sit along the shaft's way. */
  place: Readonly<MovingHazardLookPlace>;
  /** World y of the base: the surface, a roof line or the floor. */
  baseY: number;
  /** Which way the shaft goes from the base, as a sign of y: 1 down, -1 up. */
  direction: 1 | -1;
  /** The warning cue (a boat's shadow, a drop, bubbles), centred `place.shadowAlong` px along from the base. */
  shadow: Phaser.GameObjects.Image;
  /** The shaft, anchored at its tip and cropped to the drawn length (to POLE_TILE_TO when stacked). */
  shaft: Phaser.GameObjects.Image;
  /** The spawn's longest drawn shaft, px from the tip back: its own depth plus `place.shaftPastBase`. */
  fullLength: number;
  /**
   * The stacked shaft pieces past `shaft`, one per piece the spawn needs at `fullLength` (none
   * when it fits the art, as at the default depth). Added after the shaft and before the bow.
   */
  tiles: Phaser.GameObjects.Image[];
  /** The bow at the base over the shaft. Added after the shaft, so it draws over the shaft's base end. */
  bow: Phaser.GameObjects.Image;
  /** The ripple or shimmer ring of the warning, centred `place.ringAlong` px along from the base. */
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
 * Draws each moving hazard (issue #117; PRD N3, A2, ND-8, ND-9; issue #77, ND-3) from its spawn and
 * the encounter's `hazardTime`, with the textures baked for its type's `look` (four parts: bow,
 * shadow, shaft and ring) placed by the look's place. Visual only: nothing here changes game state,
 * and every place comes from the logic at `hazardTime`, so the drawing stops with the pause and the
 * carry home as the hazard does.
 *
 * Mapping: the bow sits on the base (movingHazardBaseY: the surface, the underside of the rock a
 * stalactite hangs from, or the floor) at the shaft's x. The shaft's tip is drawn at the logic tip (the base plus movingHazardTipDepth the
 * way the shaft goes, down or up) through the jab, the hold and the lift, so what is drawn is what
 * touches; the shaft is cropped to run back from the tip to `shaftPastBase` px past the base,
 * behind the bow, at the spawn's own depth (movingHazardDepth). For a pole, when that needs more
 * than the art's POLE_SHAFT_LENGTH (issue #118, ND-4), extra shaft sprites made up front stack
 * copies of the art's middle above the base one (poleShaftPieceCount), with the node spacing kept;
 * a pole at the default depth is one cropped sprite. A look that does not stack must fit its art.
 * At rest the tip is held `restBack` px back toward the base: a pole lifted over the surface; a
 * drip stream or a column, held back as far as it runs past the base, is not shown at all.
 *
 * Warning (movingHazardPhase 'warn'): under full motion the warning cue darkens or swells in (its
 * alpha goes 0 to 1 over the warning), the tip comes out from its rest place to the base over the
 * first DIP_SHARE of the warning (a pole dips to the surface), and then the ring grows
 * `place.ringAlong` px along from the base (on the water, under the drop, or at the vent's mouth).
 * The cue holds through the jab and the hold and fades over the lift. Under reduced motion the cue
 * shows still at full alpha from the warning through the lift, the tip is at the base for
 * the whole warning and the ring shows still at full size for the whole warning; the jab, hold and
 * lift still move, as they are gameplay. The greyscale outlines are in the bakes. No hazard is ever
 * shown hitting or pinning the axolotl: a hit shows only PredatorView's shared leg-loss poof.
 *
 * It reuses its sprites. Per frame it allocates only movingHazardPhase's result for each spawn.
 * Build it only in an area with moving hazards; it throws when the moving hazard textures are
 * missing, a spawn's look has none baked or a spawn does not fit a look that does not stack, and
 * on render when the encounter has no `hazardTime`.
 */
export class MovingHazardView {
  private readonly drawings: MovingHazardDrawing[] = [];

  /** `spawns` holds the encounter's moving hazards (EncounterState.movingHazards). */
  constructor(scene: Phaser.Scene, assets: GameAssets, spawns: readonly Readonly<MovingHazardSpawn>[]) {
    const baked = movingHazardTexturesFor(assets);
    for (const spawn of spawns) {
      const textures = movingHazardLookTextures(baked, spawn.type.look);
      const place = movingHazardLookPlace(spawn.type.look);
      const fullLength = movingHazardDepth(spawn) + place.shaftPastBase;
      if (!place.stacks && fullLength > place.shaftLength) {
        throw new Error(`MovingHazardView: ${spawn.id} needs ${fullLength} px of shaft, over the ${place.shaftLength} px of "${spawn.type.look}"`);
      }
      const baseY = movingHazardBaseY(spawn);
      const direction = movingHazardDirection(spawn);
      const shadow = bakedImage(scene, textures.shadow, DEPTH.movingHazard).setPosition(spawn.x, baseY + direction * place.shadowAlong);
      const shaft = bakedImage(scene, textures.shaft, DEPTH.movingHazard);
      const tiles: Phaser.GameObjects.Image[] = [];
      const pieces = place.stacks ? poleShaftPieceCount(fullLength, fullLength) : 1;
      for (let i = 1; i < pieces; i++) {
        tiles.push(bakedImage(scene, textures.shaft, DEPTH.movingHazard).setVisible(false));
      }
      const ringY = baseY + direction * place.ringAlong;
      this.drawings.push({
        spawn,
        textures,
        place,
        baseY,
        direction,
        shadow,
        shaft,
        fullLength,
        tiles,
        bow: bakedImage(scene, textures.bow, DEPTH.movingHazard).setPosition(spawn.x, baseY),
        ring: bakedImage(scene, textures.ring, DEPTH.fx).setPosition(spawn.x, ringY).setVisible(false),
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
      this.placeShaft(drawing, depth - this.heldBack(drawing.place, phase, progress, ambient));
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
   * Px the drawn tip is held back toward the base, on top of the logic tip depth (0 at rest and in
   * the warning): `restBack` at rest; in the warning, coming out to 0 over DIP_SHARE under full
   * motion, 0 at once under reduced motion; 0 in the jab, the hold and the lift.
   */
  private heldBack(place: Readonly<MovingHazardLookPlace>, phase: MovingHazardPhaseName, progress: number, ambient: boolean): number {
    if (phase === 'rest') return place.restBack;
    if (phase !== 'warn' || !ambient) return 0;
    return place.restBack * (1 - Math.min(1, progress / DIP_SHARE));
  }

  /**
   * Puts the shaft's tip `out` px from the base the way the shaft goes and crops it to run back to
   * `shaftPastBase` px past the base, so its base end stays behind the bow at every depth (the
   * whole art at its longest). Hides it when nothing is left to draw. A pole deeper than the art
   * fits shows its stacked pieces above the base one (poleShaftPieceCount).
   */
  private placeShaft(drawing: MovingHazardDrawing, out: number): void {
    const { place, direction } = drawing;
    const info = drawing.textures.shaft;
    const length = out + place.shaftPastBase;
    const tipY = drawing.baseY + direction * out;
    if (length <= 0) {
      drawing.shaft.setVisible(false);
      for (const tile of drawing.tiles) tile.setVisible(false);
      return;
    }
    drawing.shaft.setPosition(drawing.spawn.x, tipY).setVisible(true);
    if (direction === -1) {
      const cropBottom = Math.min(info.pxH, (info.originY + Math.min(place.shaftLength, length)) * info.scale);
      drawing.shaft.setCrop(0, 0, info.pxW, cropBottom);
      return;
    }
    const shown = place.stacks ? poleShaftPieceTo(0, length, drawing.fullLength) : Math.min(place.shaftLength, length);
    const cropTop = Math.max(0, (info.originY - shown) * info.scale);
    drawing.shaft.setCrop(0, cropTop, info.pxW, info.pxH - cropTop);
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
   * The warning cue's alpha: 0 at rest; 1 from the warning through the hold, and through the lift
   * under reduced motion. Under full motion it comes in 0 to 1 over the warning and fades over the lift.
   */
  private shadowAlpha(phase: MovingHazardPhaseName, progress: number, ambient: boolean): number {
    if (phase === 'rest') return 0;
    if (!ambient) return 1;
    if (phase === 'warn') return progress;
    if (phase === 'lift') return 1 - progress;
    return 1;
  }

  /**
   * The ring shows only in the warning: under full motion once the tip reaches the base, growing to
   * full size by the warning's end; under reduced motion still at full size for the whole warning.
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
