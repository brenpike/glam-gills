import type * as Phaser from 'phaser';
import type { DeepCanalTextures } from '../art/deepCanalTextures';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import type { GlideDirection, HazardRect } from '../logic/hazards';
import type { MotionProfile } from '../logic/motion';
import {
  TRAJINERAS,
  trajineraBob,
  trajineraHeading,
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
  /** The whole hull, anchored at the top-centre of its rect on the water line. */
  hull: Phaser.GameObjects.Image;
  /** The leading shadow, the warning: the whole shadow, same anchor as the hull. */
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

/** World x of the middle of a hull or shadow rect (trajineraHull or trajineraShadow). */
function rectMiddleX(rect: Readonly<HazardRect>): number {
  return (rect.x0 + rect.x1) / 2;
}

/** 1 for a boat heading right (the art's way), -1 for one heading left (mirrored). */
function facingFor(heading: GlideDirection): 1 | -1 {
  return heading === 'right' ? 1 : -1;
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
 * Mapping: the whole hull is always drawn, never cropped, so what is drawn is what blocks: the
 * hull sprite's anchor (the top-centre of its rect) sits at the middle of the hull's rect on the
 * water line, SURF, plus the bob. The boat shuttles back and forth over its span, resting at each
 * end, and faces its heading (trajineraHeading); a boat heading left is mirrored (faceSprite).
 * Under full motion the drawn hull bobs by trajineraBob (2 px over 2.4 s, looks only: the hull rect
 * never bobs); under reduced motion it never bobs but still glides, as that is gameplay. The
 * greyscale hull outline is in the bake.
 *
 * Warning: the whole shadow is drawn where the hull will be TRAJINERAS.shadowLead seconds later, at
 * the middle of that rect on SURF, under the hull, facing the heading at that time. It shows at full
 * alpha with no fade, under full and reduced motion: while the boat rests it hides under the hull,
 * and it shows by sliding out from under it `shadowLead` seconds before the boat moves. Its ink
 * outline and chevrons are the greyscale cue, in the bake.
 *
 * Push: startPush puts a ripple ring on the hull's face nearest the axolotl. Under full motion it
 * spreads and fades over PUSH_RING_LIFE_S; under reduced motion it shows at full size and fades
 * the same way. Its timer is driven by the frame `dt`, so it freezes with the scene. The boat is
 * never shown hitting the axolotl.
 *
 * It reuses its sprites. Per frame it allocates only trajineraHull's and trajineraShadow's results
 * for each boat. Build it only in an area with gliding trajineras; it throws when the deep canal
 * textures are missing.
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
      this.drawings.push({
        boat,
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
   * boat has the push's id.
   */
  startPush(push: Readonly<TrajineraPush>, elementTime: number): void {
    const drawing = this.drawings.find((candidate) => candidate.boat.id === push.id);
    if (!drawing) {
      throw new Error(`TrajineraView: no gliding trajinera ${push.id} to show a push for`);
    }
    const hull = trajineraHull(drawing.boat, elementTime);
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

  /** The whole hull sits at its rect's middle on SURF plus the bob, facing the boat's heading. */
  private renderHull(drawing: TrajineraDrawing, frame: TrajineraFrame): void {
    const hull = trajineraHull(drawing.boat, frame.elementTime);
    const bob = trajineraBob(drawing.boat, frame.elementTime, !frame.motion.ambient);
    const facing = facingFor(trajineraHeading(drawing.boat, frame.elementTime));
    drawing.hull.setVisible(true).setPosition(rectMiddleX(hull), SURF + bob);
    faceSprite(drawing.hull, facing, 1 / this.textures.trajineraHull.scale);
  }

  /**
   * The whole shadow sits where the hull will be, at that rect's middle on SURF, facing the heading
   * `shadowLead` seconds on, at full alpha.
   */
  private renderShadow(drawing: TrajineraDrawing, frame: TrajineraFrame): void {
    const shadow = trajineraShadow(drawing.boat, frame.elementTime);
    const facing = facingFor(trajineraHeading(drawing.boat, frame.elementTime + TRAJINERAS.shadowLead));
    drawing.shadow.setVisible(true).setPosition(rectMiddleX(shadow), SURF);
    faceSprite(drawing.shadow, facing, 1 / this.textures.trajineraShadow.scale);
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
