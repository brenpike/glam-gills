import type * as Phaser from 'phaser';
import type { FishingTrajineraTextures } from '../art/deepCanalTextures';
import { FISHING_LINE_COLOUR, FISHING_LINE_W, FISHING_MOTION, FISHING_ROD_HOLDER, FISHING_ROD_TIP } from '../art/drawFishingTrajinera';
import { DEPTH } from '../art/layers';
import type { TexInfo } from '../art/textures';
import { LURES, type FishingBoatSpawn, type FishingLure } from '../logic/lures';
import type { MotionProfile } from '../logic/motion';
import type { TripEvent } from '../logic/trip';
import type { FishingBoatSnapshot, LureSnapshot } from '../logic/tripEvents';
import type { Vec2 } from '../logic/vec';
import { SURF } from '../logic/zone';
import { cssColor, type GameAssets } from './BootScene';

const TAU = Math.PI * 2;
/** Seconds after which a tug's jerk, wriggle and reduced-motion fade-out are all over. */
const TUG_DONE_S = Math.max(FISHING_MOTION.tugFor, FISHING_MOTION.wriggleFor, FISHING_MOTION.reducedFadeOut);
/** Seconds after which a returning lure's let-down and its reduced-motion fade-in are both over. */
const BACK_DONE_S = Math.max(FISHING_MOTION.lowerFor, FISHING_MOTION.reelFade, FISHING_MOTION.reducedFadeIn);

/** One frame of fishing trajinera rendering input. SwimScene reuses one object for every frame. */
export interface FishingTrajineraFrame {
  /** The trip's fishing boats as drawn this frame (tripFishingSnapshot's `boats`), in data order. */
  boats: readonly Readonly<FishingBoatSnapshot>[];
  motion: MotionProfile;
  /** Scene clock in seconds, for the hull bob. */
  time: number;
  dt: number;
}

/** The reused sprites and visual-only state of one lure, its rod and its bead. */
interface LureDrawing {
  id: string;
  /** -1 for a lure at the hull's left half (its rod mirrored), 1 for the right half. */
  side: 1 | -1;
  rod: Phaser.GameObjects.Image;
  bead: Phaser.GameObjects.Image;
  lure: Phaser.GameObjects.Image;
  /** Seconds since the last tug; TUG_DONE_S once it is over. */
  tugAge: number;
  /** Where the lure hung at the last tug: the reduced-motion fade-out shows there. */
  tugAt: Vec2;
  /** Seconds since the lure last came back down; BACK_DONE_S once it is settled. */
  backAge: number;
  /** Whether the lure was pulled up on the last frame drawn. */
  wasUp: boolean;
  /** The y the lure is drawn at this frame, for the line's lower end. */
  drawnY: number;
}

/** The reused sprites of one fishing trajinera and its lures. */
interface BoatDrawing {
  id: string;
  shadow: Phaser.GameObjects.Image;
  hull: Phaser.GameObjects.Image;
  lures: LureDrawing[];
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

function fishingTexturesFor(assets: GameAssets): FishingTrajineraTextures {
  if (assets.deepCanal === null || assets.deepCanal.fishingTrajinera === null) {
    throw new Error('FishingTrajineraView: fishing trajineras need the baked fishing trajinera textures');
  }
  return assets.deepCanal.fishingTrajinera;
}

/** `value` held within 0..1. */
function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The snapshot of boat `drawing` at `index`. Throws when the snapshot's boats are not the drawn ones, in order. */
function boatSnapshotFor(boats: readonly Readonly<FishingBoatSnapshot>[], index: number, drawing: BoatDrawing): Readonly<FishingBoatSnapshot> {
  const boat = boats[index];
  if (boat === undefined || boat.id !== drawing.id || boat.lures.length !== drawing.lures.length) {
    throw new Error(`FishingTrajineraView: the fishing snapshot does not match drawn boat ${drawing.id}`);
  }
  return boat;
}

/** One lure's rod (mirrored for the hull's left half), bead and lure, and its settled visual state. */
function createLure(scene: Phaser.Scene, textures: FishingTrajineraTextures, lure: Readonly<FishingLure>): LureDrawing {
  const side = lure.along < LURES.hullLength / 2 ? -1 : 1;
  const rod = bakedImage(scene, textures.rod, DEPTH.fishingBoat).setVisible(true);
  rod.setScale(side / textures.rod.scale, 1 / textures.rod.scale);
  return {
    id: lure.id,
    side,
    rod,
    bead: bakedImage(scene, textures.bead, DEPTH.fishingLure).setVisible(true),
    lure: bakedImage(scene, textures.lure, DEPTH.fishingLure),
    tugAge: TUG_DONE_S,
    tugAt: { x: 0, y: 0 },
    backAge: BACK_DONE_S,
    wasUp: false,
    drawnY: SURF,
  };
}

/**
 * Draws Area 10's fishing trajineras (issue #108, ND-1, guide 7p): each drifting hull with its
 * always-shown shadow, one rod per lure at its end of the hull, and each lure's line, float bead and
 * lure. Visual only: every place comes from the trip's fishing snapshot (tripFishingSnapshot), so the
 * boats stop with the pause, the banking card and the carry home, and nothing here changes game
 * state.
 *
 * Boat: the shadow, then the hull, then the rods, at the moving hazard band, the hull's middle on
 * the water line, never mirrored. Under full motion the hull and rods bob FISHING_MOTION.hullBobPx
 * over hullBobPeriod, out of step by boat; under reduced motion they are still. The shadow never
 * bobs.
 *
 * Lure: the line is drawn live as one upright ink line at the lure's x from the logic, from the rod
 * tip's height down to the lure, under the bead (on the water line) and the lure. The lure is drawn
 * where the snapshot puts it: its bob is the logic's, so it bobs under full motion only and its eat
 * position is where it is drawn. A tug (`lureTug`, handleEvents) under full motion jerks the lure
 * tugPx up and back over tugFor (one half sine) while the logic lifts it, and it fades out over the
 * last reelFade seconds of the lift at the bead; the axolotl does the snag wriggle for wriggleFor
 * (wriggling). While it is up only the rod, the line to the bead and the bead show. When the logic
 * brings it back it fades in at the bead and is let down to where it hangs over lowerFor. Under
 * reduced motion there is no jerk, no wriggle and no let-down: at the tug the lure fades out where
 * it hung over reducedFadeOut, and when it comes back it fades in where it hangs over reducedFadeIn.
 * The tug shows the same when the hit is blocked by the Shell or lands in protected time.
 *
 * It reuses its sprites and one Graphics for every line, redrawn each frame, and allocates nothing
 * per frame. Build it only in an area with fishing boats; it throws when the fishing trajinera
 * textures are missing, when an event names a lure it does not draw, and when a snapshot's boats are
 * not the ones it was built with, in order.
 */
export class FishingTrajineraView {
  private readonly drawings: BoatDrawing[];
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly lineColour: number;
  /** Seconds since the last tug's wriggle started; FISHING_MOTION.wriggleFor or more once over. */
  private wriggleAge: number = FISHING_MOTION.wriggleFor;

  /** `boats` holds the trip's fishing boats (TripState.fishingBoats), in data order. */
  constructor(scene: Phaser.Scene, assets: GameAssets, boats: readonly Readonly<FishingBoatSpawn>[]) {
    const textures = fishingTexturesFor(assets);
    this.lineColour = cssColor(FISHING_LINE_COLOUR).color;
    // INVARIANT: the lines are made before every bead and lure at the same depth, so they draw under them.
    this.lines = scene.add.graphics().setDepth(DEPTH.fishingLure);
    this.drawings = boats.map((boat) => this.createBoat(scene, textures, boat));
  }

  /** Starts the tug of each `lureTug` in `events`. Throws when no drawn lure has its id. */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type !== 'lureTug') continue;
      const drawing = this.lureDrawingFor(event.lureId);
      drawing.tugAge = 0;
      drawing.tugAt.x = event.at.x;
      drawing.tugAt.y = event.at.y;
      this.wriggleAge = 0;
    }
  }

  /** True while a tug's snag wriggle runs: SwimScene feeds it to the drawn axolotl, which wriggles under full motion only. */
  wriggling(): boolean {
    return this.wriggleAge < FISHING_MOTION.wriggleFor;
  }

  /** Draws one frame. */
  render(frame: Readonly<FishingTrajineraFrame>): void {
    this.lines.clear();
    this.lines.lineStyle(FISHING_LINE_W, this.lineColour, 1);
    for (let index = 0; index < this.drawings.length; index++) {
      const drawing = this.drawings[index];
      this.renderBoat(drawing, index, boatSnapshotFor(frame.boats, index, drawing), frame);
    }
    this.wriggleAge = Math.min(this.wriggleAge + frame.dt, FISHING_MOTION.wriggleFor);
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.shadow.destroy();
      drawing.hull.destroy();
      for (const lure of drawing.lures) {
        lure.rod.destroy();
        lure.bead.destroy();
        lure.lure.destroy();
      }
    }
    this.lines.destroy();
  }

  /** The boat's shadow, hull and rods, in that order at the same depth, so they draw in that order, and each lure's bead and lure. */
  private createBoat(scene: Phaser.Scene, textures: FishingTrajineraTextures, boat: Readonly<FishingBoatSpawn>): BoatDrawing {
    const shadow = bakedImage(scene, textures.shadow, DEPTH.fishingShadow).setVisible(true);
    const hull = bakedImage(scene, textures.boat, DEPTH.fishingBoat).setVisible(true);
    const lures = boat.lures.map((lure) => createLure(scene, textures, lure));
    return { id: boat.id, shadow, hull, lures };
  }

  /** The drawing of lure `lureId`. Throws when no drawn lure has that id. */
  private lureDrawingFor(lureId: string): LureDrawing {
    for (const boat of this.drawings) {
      for (const lure of boat.lures) {
        if (lure.id === lureId) return lure;
      }
    }
    throw new Error(`FishingTrajineraView: no lure ${lureId} to draw`);
  }

  /** The hull, its shadow and rods where the snapshot puts the hull, then each lure on its line. */
  private renderBoat(drawing: BoatDrawing, index: number, boat: Readonly<FishingBoatSnapshot>, frame: Readonly<FishingTrajineraFrame>): void {
    const middle = (boat.hull.x0 + boat.hull.x1) / 2;
    const bob = frame.motion.ambient
      ? FISHING_MOTION.hullBobPx * Math.sin((TAU * frame.time) / FISHING_MOTION.hullBobPeriod + index)
      : 0;
    drawing.shadow.setPosition(middle, SURF);
    drawing.hull.setPosition(middle, SURF + bob);
    for (let lureIndex = 0; lureIndex < drawing.lures.length; lureIndex++) {
      const lure = drawing.lures[lureIndex];
      lure.rod.setPosition(middle + lure.side * FISHING_ROD_HOLDER.x, SURF + FISHING_ROD_HOLDER.y + bob);
      this.renderLure(lure, boat.lures[lureIndex], frame, SURF + FISHING_ROD_TIP.y + bob);
    }
  }

  /** One lure: its sprite, its bead on the water line and its line from `lineTopY` down to the lure, or to the bead while the lure is hidden. */
  private renderLure(drawing: LureDrawing, lure: Readonly<LureSnapshot>, frame: Readonly<FishingTrajineraFrame>, lineTopY: number): void {
    if (lure.id !== drawing.id) {
      throw new Error(`FishingTrajineraView: the fishing snapshot does not match drawn lure ${drawing.id}`);
    }
    if (drawing.wasUp && !lure.up) drawing.backAge = 0;
    drawing.wasUp = lure.up;
    const x = lure.at.x;
    drawing.bead.setPosition(x, SURF);
    if (frame.motion.ambient) this.placeMovingLure(drawing, lure);
    else this.placeStillLure(drawing, lure);
    const onLine = drawing.lure.visible && (frame.motion.ambient || !lure.up);
    this.lines.lineBetween(x, lineTopY, x, onLine ? drawing.drawnY : SURF);
    drawing.tugAge = Math.min(drawing.tugAge + frame.dt, TUG_DONE_S);
    drawing.backAge = Math.min(drawing.backAge + frame.dt, BACK_DONE_S);
  }

  /**
   * Full motion: up, the lure where the logic lifts it, jerked up by the tug's half sine and fading
   * over the lift's last reelFade seconds; down, faded in at the bead and let down to where it hangs
   * over lowerFor. The line ends at the lure while it shows.
   */
  private placeMovingLure(drawing: LureDrawing, lure: Readonly<LureSnapshot>): void {
    const { at } = lure;
    let y: number;
    let alpha: number;
    if (lure.up) {
      const jerk = drawing.tugAge < FISHING_MOTION.tugFor ? FISHING_MOTION.tugPx * Math.sin((Math.PI * drawing.tugAge) / FISHING_MOTION.tugFor) : 0;
      y = Math.max(SURF, at.y - jerk);
      alpha = clampShare(((1 - lure.lift) * LURES.liftFor) / FISHING_MOTION.reelFade);
    } else {
      y = SURF + (at.y - SURF) * clampShare(drawing.backAge / FISHING_MOTION.lowerFor);
      alpha = clampShare(drawing.backAge / FISHING_MOTION.reelFade);
    }
    drawing.drawnY = y;
    drawing.lure.setPosition(at.x, y).setAlpha(alpha).setVisible(alpha > 0);
  }

  /**
   * Reduced motion: up, the lure fading out where it hung at the tug over reducedFadeOut, off its
   * line, which runs to the bead; down, where it hangs, fading in over reducedFadeIn.
   */
  private placeStillLure(drawing: LureDrawing, lure: Readonly<LureSnapshot>): void {
    if (lure.up) {
      const alpha = 1 - clampShare(drawing.tugAge / FISHING_MOTION.reducedFadeOut);
      drawing.lure.setPosition(drawing.tugAt.x, drawing.tugAt.y).setAlpha(alpha).setVisible(alpha > 0);
      return;
    }
    const alpha = clampShare(drawing.backAge / FISHING_MOTION.reducedFadeIn);
    drawing.drawnY = lure.at.y;
    drawing.lure.setPosition(lure.at.x, lure.at.y).setAlpha(alpha).setVisible(alpha > 0);
  }
}
