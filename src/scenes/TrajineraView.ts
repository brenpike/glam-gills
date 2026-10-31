import type * as Phaser from 'phaser';
import type { DeepCanalTextures } from '../art/deepCanalTextures';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import type { HazardRect, TrajineraCrossing } from '../logic/hazards';
import type { MotionProfile } from '../logic/motion';
import {
  TRAJINERAS,
  trajineraBob,
  trajineraHull,
  trajineraShadow,
  type TrajineraPush,
  type TrajineraSpawn,
} from '../logic/trajineras';
import { SURF } from '../logic/zone';
import type { GameAssets } from './BootScene';
import { faceSprite } from './spriteFacing';

/** Seconds the push ripple shows: a one-time fade of 0.4 s or more. */
const PUSH_RING_LIFE_S = 0.5;
/** Full motion: the scale the push ripple spreads from; it reaches 1 at the end of its life. */
const PUSH_RING_GROW_FROM = 0.5;

/** One frame of trajinera rendering input: the trip's element time, the motion setting and dt. */
export interface TrajineraFrame {
  /** The trip's element clock (TripState.elementTime): it places every hull and shadow. */
  elementTime: number;
  motion: MotionProfile;
  dt: number;
}

/** The reused sprites and visual-only state of one gliding trajinera. */
interface TrajineraDrawing {
  boat: Readonly<TrajineraSpawn>;
  /** 1 for a boat gliding right (the art's way), -1 for one gliding left (mirrored). */
  facing: 1 | -1;
  /** The hull, anchored at the top-centre of its rect on the water line, cropped to the span. */
  hull: Phaser.GameObjects.Image;
  /** The leading shadow, the warning: same anchor as the hull, cropped to the span. */
  shadow: Phaser.GameObjects.Image;
  /** The push ripple, at the hull's face where it met the axolotl. */
  ring: Phaser.GameObjects.Image;
  /** Seconds since the last push; PUSH_RING_LIFE_S or more once the ripple has faded. */
  ringAge: number;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

function deepCanalTexturesFor(assets: GameAssets): DeepCanalTextures {
  if (assets.deepCanal === null) {
    throw new Error('TrajineraView: gliding trajineras need the baked deep canal textures');
  }
  return assets.deepCanal;
}

/**
 * World x of the middle of a hull-sized rect from its span-clipped rect (trajineraHull or
 * trajineraShadow). With a span at least a hull long, an end inside the span is never clipped: the
 * nose while it is still in the span, else the tail.
 */
function rectCentreX(crossing: Readonly<TrajineraCrossing>, rect: Readonly<HazardRect>): number {
  const half = TRAJINERAS.hullLength / 2;
  if (crossing.direction === 'right') return rect.x1 < crossing.x1 ? rect.x1 - half : rect.x0 + half;
  return rect.x0 > crossing.x0 ? rect.x0 + half : rect.x1 - half;
}

/**
 * Crops `image`, centred on world x `centreX` and facing `facing`, to the span's x0..x1, so only
 * the part of the hull or shadow inside the span is drawn. The crop is in texture pixels; a sprite
 * facing left is mirrored about its anchor, so the span is mirrored about the anchor too.
 */
function cropToSpan(
  image: Phaser.GameObjects.Image,
  info: TexInfo,
  centreX: number,
  facing: 1 | -1,
  crossing: Readonly<TrajineraCrossing>,
): void {
  const from = facing === 1 ? crossing.x0 - centreX : centreX - crossing.x1;
  const to = facing === 1 ? crossing.x1 - centreX : centreX - crossing.x0;
  const left = Math.min(info.pxW, Math.max(0, (from + info.originX) * info.scale));
  const right = Math.min(info.pxW, Math.max(0, (to + info.originX) * info.scale));
  image.setCrop(left, 0, right - left, info.pxH);
}

/** `value` held within `min`..`max`. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Draws each gliding trajinera (issue #78; PRD N2, ND-8, ND-9): its hull, its leading shadow and its
 * push ripple, from the boat's crossing and the trip's element time. Visual only: every place comes
 * from the logic at `elementTime` (trajineraHull, trajineraShadow), so the boats stop with the pause
 * and the carry home as the hulls do, and nothing here changes game state. The push itself (the
 * impulse) is the trip's: this view only shows where it happened.
 *
 * Mapping: the hull sprite's anchor (the top-centre of its rect) sits on the water line, SURF, at the
 * middle of the hull's rect, and is cropped to the span, so what is drawn is what blocks: a hull
 * glides in from the span's upstream end and out at the far end. A boat gliding left is mirrored
 * (faceSprite). Under full motion the drawn hull bobs by trajineraBob (2 px over 2.4 s, looks only:
 * the hull rect never bobs); under reduced motion it never bobs but still glides, as that is
 * gameplay. The greyscale hull outline is in the bake.
 *
 * Warning: the shadow is drawn where the hull will be TRAJINERAS.shadowLead seconds later, cropped
 * to the span the same way, under the hull. Under full motion it fades in over its first
 * `shadowLead` seconds in the span and out over its last (one-time fades of 0.6 s or longer, guide
 * 9, 10); under reduced motion it shows at full alpha. Its ink outline and chevrons are the
 * greyscale cue, in the bake.
 *
 * Push: startPush puts a ripple ring on the hull's face nearest the axolotl. Under full motion it
 * spreads and fades over PUSH_RING_LIFE_S; under reduced motion it shows at full size and fades
 * the same way. Its timer is driven by the frame `dt`, so it freezes with the scene. The boat is
 * never shown hitting the axolotl.
 *
 * It reuses its sprites. Per frame it allocates only trajineraHull's and trajineraShadow's results
 * for each boat. Build it only in an area with gliding trajineras; it throws when the deep canal
 * textures are missing or a boat's span is shorter than a hull, where the hull's place could not be
 * told from its clipped rect.
 */
export class TrajineraView {
  private readonly drawings: TrajineraDrawing[] = [];
  private readonly textures: DeepCanalTextures;
  private readonly ringInfo: TexInfo;

  /** `boats` holds the trip's gliding trajineras (TrajineraLane.boats). */
  constructor(scene: Phaser.Scene, assets: GameAssets, boats: readonly Readonly<TrajineraSpawn>[]) {
    this.textures = deepCanalTexturesFor(assets);
    this.ringInfo = assets.predator.garterRipple;
    for (const boat of boats) {
      const { x0, x1, direction } = boat.trajinera;
      if (x1 - x0 < TRAJINERAS.hullLength) {
        throw new Error(`TrajineraView: ${boat.id} span ${x1 - x0} px is shorter than the ${TRAJINERAS.hullLength} px hull`);
      }
      this.drawings.push({
        boat,
        facing: direction === 'right' ? 1 : -1,
        shadow: bakedImage(scene, this.textures.trajineraShadow, DEPTH.trajineraShadow),
        hull: bakedImage(scene, this.textures.trajineraHull, DEPTH.trajineraHull),
        ring: bakedImage(scene, this.ringInfo, DEPTH.fx),
        ringAge: PUSH_RING_LIFE_S,
      });
    }
  }

  /**
   * Starts the push ripple of the boat that pushed (TripStepResult.pushed), on its hull's face
   * nearest where the axolotl was, at the element time the trip pushed at. Throws when no drawn
   * boat has the push's id or its hull is out of its span at `elementTime`.
   */
  startPush(push: Readonly<TrajineraPush>, elementTime: number): void {
    const drawing = this.drawings.find((candidate) => candidate.boat.id === push.id);
    if (!drawing) {
      throw new Error(`TrajineraView: no gliding trajinera ${push.id} to show a push for`);
    }
    const hull = trajineraHull(drawing.boat, elementTime);
    if (hull === null) {
      throw new Error(`TrajineraView: ${push.id} pushed with its hull out of its span at ${elementTime}`);
    }
    drawing.ring.setPosition(clampNumber(push.from.x, hull.x0, hull.x1), clampNumber(push.from.y, hull.y0, hull.y1));
    drawing.ringAge = 0;
  }

  /** Draws one frame. */
  render(frame: TrajineraFrame): void {
    for (const drawing of this.drawings) {
      this.renderShadow(drawing, frame);
      this.renderHull(drawing, frame);
      this.renderRing(drawing, frame);
    }
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.shadow.destroy();
      drawing.hull.destroy();
      drawing.ring.destroy();
    }
  }

  private renderHull(drawing: TrajineraDrawing, frame: TrajineraFrame): void {
    const hull = trajineraHull(drawing.boat, frame.elementTime);
    if (hull === null) {
      drawing.hull.setVisible(false);
      return;
    }
    const info = this.textures.trajineraHull;
    const centreX = rectCentreX(drawing.boat.trajinera, hull);
    const bob = trajineraBob(drawing.boat, frame.elementTime, !frame.motion.ambient);
    drawing.hull.setVisible(true).setPosition(centreX, SURF + bob);
    faceSprite(drawing.hull, drawing.facing, 1 / info.scale);
    cropToSpan(drawing.hull, info, centreX, drawing.facing, drawing.boat.trajinera);
  }

  /**
   * The shadow sits where the hull will be, cropped to the span. Under full motion its alpha is the
   * share of `shadowLead` seconds of glide it has been in the span (in) or has left in it (out),
   * capped at 1; under reduced motion it is 1.
   */
  private renderShadow(drawing: TrajineraDrawing, frame: TrajineraFrame): void {
    const shadow = trajineraShadow(drawing.boat, frame.elementTime);
    if (shadow === null) {
      drawing.shadow.setVisible(false);
      return;
    }
    const info = this.textures.trajineraShadow;
    const centreX = rectCentreX(drawing.boat.trajinera, shadow);
    const leadWidth = TRAJINERAS.speed * TRAJINERAS.shadowLead;
    const alpha = frame.motion.ambient ? Math.min(1, (shadow.x1 - shadow.x0) / leadWidth) : 1;
    drawing.shadow.setVisible(true).setPosition(centreX, SURF).setAlpha(alpha);
    faceSprite(drawing.shadow, drawing.facing, 1 / info.scale);
    cropToSpan(drawing.shadow, info, centreX, drawing.facing, drawing.boat.trajinera);
  }

  /**
   * The push ripple ages by `dt` and fades over PUSH_RING_LIFE_S, then hides: spreading from
   * PUSH_RING_GROW_FROM under full motion, at full size under reduced motion.
   */
  private renderRing(drawing: TrajineraDrawing, frame: TrajineraFrame): void {
    if (drawing.ringAge >= PUSH_RING_LIFE_S) {
      drawing.ring.setVisible(false);
      return;
    }
    const share = drawing.ringAge / PUSH_RING_LIFE_S;
    const grow = frame.motion.ambient ? PUSH_RING_GROW_FROM + (1 - PUSH_RING_GROW_FROM) * share : 1;
    drawing.ring
      .setVisible(true)
      .setAlpha(1 - share)
      .setScale(grow / this.ringInfo.scale);
    drawing.ringAge = Math.min(drawing.ringAge + frame.dt, PUSH_RING_LIFE_S);
  }
}
