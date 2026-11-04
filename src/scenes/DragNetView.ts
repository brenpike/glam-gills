import type * as Phaser from 'phaser';
import { dragNetCurtainHeight, netHollowSizeKey, type DragNetTextures } from '../art/deepCanalTextures';
import { FISHING_BOAT_W } from '../art/drawFishingTrajinera';
import {
  DRAG_NET_CURTAIN_W,
  DRAG_NET_MOTION,
  DRAG_NET_ROPE,
  DRAG_NET_ROPE_OL,
  DRAG_NET_ROPE_W,
  DRAG_NET_SWAY_MAX,
  dragNetBoatLean,
  dragNetFloatXs,
} from '../art/drawDragNet';
import { DEPTH } from '../art/layers';
import { INK } from '../art/palette';
import type { TexInfo } from '../art/textures';
import { dragNetPeriod, type DragNetPhase, type DragNetSpawn } from '../logic/dragNets';
import type { DrawnAxolotl } from '../logic/drawnAxolotl';
import type { HazardRect } from '../logic/hazards';
import type { MotionProfile } from '../logic/motion';
import type { TripEvent } from '../logic/trip';
import type { DragNetSnapshot } from '../logic/tripEvents';
import { SURF } from '../logic/zone';
import { cssColor, type GameAssets } from './BootScene';

const TAU = Math.PI * 2;
/** How far past the stretch, px, the curtain's mask reaches each way: past the curtain's frame wherever the sweep puts it. */
const MASK_MARGIN = DRAG_NET_CURTAIN_W + DRAG_NET_SWAY_MAX + 24;
/** Seconds into a quiet after which the lift-out and the settle are both over. */
const SETTLED_AT_S = DRAG_NET_MOTION.liftFade + DRAG_NET_MOTION.settleFor;
/** The parked curtain's alpha through the warning under reduced motion: steady, no pulse. */
const WARN_CURTAIN_ALPHA = 0.45;
/** The parked curtain's lowest and highest alpha in its pulse through the warning under full motion. */
const WARN_PULSE_LOW = 0.35;
const WARN_PULSE_HIGH = 0.6;
/** Seconds per pulse of the parked curtain: two whole pulses in the 1 s warning, low at its start and end. */
const WARN_PULSE_PERIOD = 0.5;

/** One frame of drag net rendering input. SwimScene reuses one object for every frame. */
export interface DragNetFrame {
  /** The trip's drag nets as drawn this frame (tripFishingSnapshot's `nets`), in data order. */
  nets: readonly Readonly<DragNetSnapshot>[];
  /** The trip's element clock (TripState.elementTime): it places every net in its cycle. */
  elementTime: number;
  /** The axolotl as drawn this frame: the wriggle-out strands sit on its centre. */
  body: DrawnAxolotl;
  /** The axolotl's size factor (AXO_SIZE_SCALE for its look's size). */
  size: number;
  /** True while the trip is swimming: the strands show only then. */
  swimming: boolean;
  motion: MotionProfile;
  /** Scene clock in seconds, for the quiet bob. */
  time: number;
  dt: number;
}

/** The reused sprites and visual-only state of one drag-net stretch. */
interface NetDrawing {
  net: Readonly<DragNetSpawn>;
  /** 1 for a sweep to the right (the art's way), -1 for one to the left (the curtain mirrored). */
  heading: 1 | -1;
  leftBoat: Phaser.GameObjects.Image;
  rightBoat: Phaser.GameObjects.Image;
  rope: Phaser.GameObjects.Graphics;
  /** The rope's y as last drawn, so it is redrawn only when the floats' lift changes it. */
  ropeY: number;
  floats: Phaser.GameObjects.Image[];
  /** Whether the floats show the lit frame. */
  lit: boolean;
  curtain: Phaser.GameObjects.Image;
  maskShape: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
  shades: Phaser.GameObjects.Image[];
  /** The lit floats along the stretch's top edge, one per float on the rope: shown in the warning only. */
  markers: Phaser.GameObjects.Image[];
  /** Whether the markers show. */
  marked: boolean;
}

function bakedImage(scene: Phaser.Scene, info: TexInfo, depth: number): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setDepth(depth)
    .setVisible(false);
}

function dragNetTexturesFor(assets: GameAssets): DragNetTextures {
  if (assets.deepCanal === null || assets.deepCanal.dragNet === null) {
    throw new Error('DragNetView: drag nets need the baked drag net textures');
  }
  return assets.deepCanal.dragNet;
}

/** Puts a baked image's texture on `image` with its origin; the scale stays the image's own. */
function showFrame(image: Phaser.GameObjects.Image, info: TexInfo): void {
  image.setTexture(info.key).setOrigin(info.originNormX, info.originNormY);
}

/** `value` held within 0..1. */
function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Seconds into the net's cycle at element time `t`, 0 up to its period, as dragNetPhase counts them. */
function cycleSeconds(net: Readonly<DragNetSpawn>, t: number): number {
  const period = dragNetPeriod(net);
  return (((t - net.offset) % period) + period) % period;
}

/** 1 for a sweep to the right, -1 for one to the left. Throws for an up or down sweep, which has no curtain art. */
function headingFor(net: Readonly<DragNetSpawn>): 1 | -1 {
  const { sweep } = net.dragNet;
  if (sweep === 'right') return 1;
  if (sweep === 'left') return -1;
  throw new Error(`DragNetView: ${net.id} sweeps ${sweep}; only a left or right sweep has curtain art`);
}

/** The baked flat curtain of the net's height. Throws when that height was not baked. */
function curtainFor(textures: DragNetTextures, net: Readonly<DragNetSpawn>): TexInfo {
  const h = dragNetCurtainHeight(net);
  const info = textures.curtains.get(h);
  if (info === undefined) throw new Error(`DragNetView: no baked drag net curtain of height ${h} for ${net.id}`);
  return info;
}

/** The baked shade of the hollow's size. Throws when that size was not baked. */
function hollowShadeFor(textures: DragNetTextures, net: Readonly<DragNetSpawn>, hollow: Readonly<HazardRect>): TexInfo {
  const key = netHollowSizeKey(hollow.x1 - hollow.x0, hollow.y1 - hollow.y0);
  const info = textures.hollowShades.get(key);
  if (info === undefined) throw new Error(`DragNetView: no baked drag net hollow shade of size ${key} for ${net.id}`);
  return info;
}

/**
 * Fills `shape` with the curtain's mask: every place the curtain can be drawn, MASK_MARGIN past the
 * stretch and from MASK_MARGIN over the water line to MASK_MARGIN under the stretch's foot, but the
 * net's hollows. It is cut into rects with no overlap, one row per run between the hollows' top and
 * bottom edges, so the canvas clip and the WebGL stencil both read it the same way.
 */
function fillCurtainMask(shape: Phaser.GameObjects.Graphics, net: Readonly<DragNetSpawn>): void {
  const { stretch, hollows } = net.dragNet;
  const x0 = stretch.x0 - MASK_MARGIN;
  const x1 = stretch.x1 + MASK_MARGIN;
  const rowEdges = [SURF - MASK_MARGIN, stretch.y1 + MASK_MARGIN, ...hollows.flatMap((hollow) => [hollow.y0, hollow.y1])];
  const ys = [...new Set(rowEdges)].sort((a, b) => a - b);
  shape.fillStyle(0xffffff, 1);
  for (let row = 0; row + 1 < ys.length; row++) {
    const top = ys[row];
    const bottom = ys[row + 1];
    const middle = (top + bottom) / 2;
    const cuts = hollows.filter((hollow) => hollow.y0 <= middle && middle <= hollow.y1).sort((a, b) => a.x0 - b.x0);
    let from = x0;
    for (const cut of cuts) {
      if (cut.x0 > from) shape.fillRect(from, top, cut.x0 - from, bottom - top);
      from = Math.max(from, cut.x1);
    }
    if (x1 > from) shape.fillRect(from, top, x1 - from, bottom - top);
  }
}

/**
 * The share, 0 to 1, of the floats' rise and the boats' lean under full motion: rising over riseFor
 * from the start of the warning, held through the sweep, then held through the lift-out and settling
 * back over settleFor. A quiet with no sweep before it in this trip (element time `t` within the
 * first cycle's quiet) is settled.
 */
function raisedShare(net: Readonly<DragNetSpawn>, phase: DragNetPhase, local: number, t: number): number {
  const { quietFor } = net.dragNet.timing;
  if (phase === 'warn') return clampShare((local - quietFor) / DRAG_NET_MOTION.riseFor);
  if (phase === 'sweep') return 1;
  if (t <= local || local >= SETTLED_AT_S) return 0;
  return 1 - clampShare((local - DRAG_NET_MOTION.liftFade) / DRAG_NET_MOTION.settleFor);
}

/**
 * Draws Area 10's drag nets (issue #108, ND-2, guide 7p): each stretch's two boats, its float line
 * and floats, its safe hollows' shade, its mesh curtain in the sweep and, at a catch, the wriggle-out
 * strands round the axolotl. Visual only: the cycle is the logic's (the snapshot's phase and sweep
 * front at the trip's element time), so the nets stop with the pause and the banking card, and
 * nothing here moves, holds or traps the axolotl.
 *
 * Boats: one whole hull each side of the stretch on the water line, its inner end on the stretch's
 * edge. Floats: one every DRAG_NET_FLOAT_SPACING px on the rope between the boats. Quiet: the floats
 * sit on the rope and the boats are upright; under full motion each float bobs quietBobPx over
 * quietBobPeriod, out of step along the line. Warning, full motion: the floats and the rope lift
 * riseLift px over riseFor and hold with no bob, and both boats tip toward the sweep by leanRad
 * about their anchors (dragNetBoatLean). Warning and sweep, reduced motion: the lit floats replace
 * the floats and the boats show their lean at once, held, with no rise and no bob.
 *
 * Warning, inside the stretch: the surface is off-screen from a deep stretch (the view is one
 * WORLD_H tall), so the warning shows in the stretch too. The curtain hangs parked with its leading
 * edge on the edge the sweep starts from, masked out of the hollows as in the sweep, at
 * WARN_CURTAIN_ALPHA under reduced motion and pulsing between WARN_PULSE_LOW and WARN_PULSE_HIGH under
 * full motion; and the lit floats (markers) show still along the stretch's top edge, one per float on
 * the rope, in both motion modes, so the cue never relies on motion or colour. The sweep's front
 * starts on that same edge, so the curtain does not jump when the sweep starts.
 *
 * Sweep: the flat baked curtain hangs from the water line with its leading edge on the logic's
 * front, mirrored for a sweep to the left, in both motion modes. After the sweep it lifts out where
 * the front ended, fading over liftFade, and then the floats and boats settle back over settleFor
 * (at once under reduced motion). The curtain is masked out of the stretch's hollows, whose shade
 * shows under it in every phase, so a hollow is a clear pocket with no mesh in it. The curtain has
 * no billow: the bake is flat, so its front is drawn exactly on the logic's front.
 *
 * Catch (`netCatch`, handleEvents): the strands show on the axolotl's drawn centre for
 * catchWriggleFor while swimming, at full alpha under full motion while the axolotl does the snag
 * wriggle (wriggling), and fading over the same time under reduced motion, with no wriggle. The
 * axolotl stays where it is and is always drawn in front of the curtain.
 *
 * It reuses its sprites, draws each rope again only when its lift changes and allocates nothing per
 * frame. Build it only in an area with drag nets; it throws when the drag net textures, a curtain
 * height or a hollow size are missing, for an up or down sweep, when an event names a stretch it
 * does not draw, and when a snapshot's nets are not the ones it was built with, in order.
 */
export class DragNetView {
  private readonly textures: DragNetTextures;
  private readonly drawings: NetDrawing[];
  private readonly strands: Phaser.GameObjects.Image;
  private readonly inkColour: number;
  private readonly ropeColour: number;
  /** Seconds since the last catch; DRAG_NET_MOTION.catchWriggleFor or more once its strands are gone. */
  private catchAge: number = DRAG_NET_MOTION.catchWriggleFor;

  /** `nets` holds the trip's drag nets (TripState.dragNets), in data order. */
  constructor(scene: Phaser.Scene, assets: GameAssets, nets: readonly Readonly<DragNetSpawn>[]) {
    this.textures = dragNetTexturesFor(assets);
    this.inkColour = cssColor(INK).color;
    this.ropeColour = cssColor(DRAG_NET_ROPE).color;
    this.drawings = nets.map((net) => this.createNet(scene, net));
    this.strands = bakedImage(scene, this.textures.strands, DEPTH.fx);
  }

  /** Starts the strands of each `netCatch` in `events`. Throws when no drawn net has its stretch id. */
  handleEvents(events: readonly TripEvent[]): void {
    for (const event of events) {
      if (event.type !== 'netCatch') continue;
      if (!this.drawings.some((drawing) => drawing.net.id === event.stretchId)) {
        throw new Error(`DragNetView: no drag net ${event.stretchId} to draw`);
      }
      this.catchAge = 0;
    }
  }

  /** True while a catch's snag wriggle runs: SwimScene feeds it to the drawn axolotl, which wriggles under full motion only. */
  wriggling(): boolean {
    return this.catchAge < DRAG_NET_MOTION.catchWriggleFor;
  }

  /** Draws one frame. */
  render(frame: Readonly<DragNetFrame>): void {
    for (let index = 0; index < this.drawings.length; index++) {
      const drawing = this.drawings[index];
      const snapshot = frame.nets[index];
      if (snapshot === undefined || snapshot.id !== drawing.net.id) {
        throw new Error(`DragNetView: the fishing snapshot does not match drawn drag net ${drawing.net.id}`);
      }
      this.renderNet(drawing, snapshot, frame);
    }
    this.renderStrands(frame);
  }

  destroy(): void {
    for (const drawing of this.drawings) {
      drawing.leftBoat.destroy();
      drawing.rightBoat.destroy();
      drawing.rope.destroy();
      for (const float of drawing.floats) float.destroy();
      drawing.curtain.clearMask();
      drawing.curtain.destroy();
      drawing.mask.destroy();
      drawing.maskShape.destroy();
      for (const shade of drawing.shades) shade.destroy();
      for (const marker of drawing.markers) marker.destroy();
    }
    this.strands.destroy();
  }

  /**
   * The net's boats, rope, floats, hollow shades, masked curtain and stretch markers. The shades, the
   * curtain and the markers share a depth and are made in that order, so each draws over the one
   * before and the axolotl stays in front of all three; the rope is made before its floats.
   */
  private createNet(scene: Phaser.Scene, net: Readonly<DragNetSpawn>): NetDrawing {
    const art = this.textures;
    const { stretch, hollows } = net.dragNet;
    const heading = headingFor(net);
    const boatReach = FISHING_BOAT_W / 2;
    const shades = hollows.map((hollow) =>
      bakedImage(scene, hollowShadeFor(art, net, hollow), DEPTH.dragNetMesh).setPosition(hollow.x0, hollow.y0).setVisible(true),
    );
    const curtainInfo = curtainFor(art, net);
    const curtain = bakedImage(scene, curtainInfo, DEPTH.dragNetMesh).setScale(heading / curtainInfo.scale, 1 / curtainInfo.scale);
    const maskShape = scene.make.graphics({}, false);
    fillCurtainMask(maskShape, net);
    const mask = maskShape.createGeometryMask();
    curtain.setMask(mask);
    const rope = scene.add.graphics().setDepth(DEPTH.dragNetFloats);
    const floatXs = dragNetFloatXs(stretch.x1 - stretch.x0);
    const floats = floatXs.map((x) =>
      bakedImage(scene, art.float, DEPTH.dragNetFloats).setPosition(stretch.x0 + x, SURF).setVisible(true),
    );
    const markers = floatXs.map((x) =>
      bakedImage(scene, art.floatLit, DEPTH.dragNetMesh).setPosition(stretch.x0 + x, stretch.y0),
    );
    const drawing: NetDrawing = {
      net,
      heading,
      leftBoat: bakedImage(scene, art.boat, DEPTH.dragNetBoat).setPosition(stretch.x0 - boatReach, SURF).setVisible(true),
      rightBoat: bakedImage(scene, art.boat, DEPTH.dragNetBoat).setPosition(stretch.x1 + boatReach, SURF).setVisible(true),
      rope,
      ropeY: Number.NaN,
      floats,
      lit: false,
      curtain,
      maskShape,
      mask,
      shades,
      markers,
      marked: false,
    };
    this.drawRope(drawing, SURF);
    return drawing;
  }

  /** Draws the rope tube between the boats' inner ends at `y`: ink round a DRAG_NET_ROPE core. */
  private drawRope(drawing: NetDrawing, y: number): void {
    if (y === drawing.ropeY) return;
    drawing.ropeY = y;
    const { x0, x1 } = drawing.net.dragNet.stretch;
    drawing.rope
      .clear()
      .lineStyle(DRAG_NET_ROPE_W + 2 * DRAG_NET_ROPE_OL, this.inkColour, 1)
      .lineBetween(x0, y, x1, y)
      .lineStyle(DRAG_NET_ROPE_W, this.ropeColour, 1)
      .lineBetween(x0, y, x1, y);
  }

  /** One net: its floats, rope and boats for the phase and the motion mode, then its curtain. */
  private renderNet(drawing: NetDrawing, snapshot: Readonly<DragNetSnapshot>, frame: Readonly<DragNetFrame>): void {
    const { net } = drawing;
    const t = frame.elementTime;
    const local = cycleSeconds(net, t);
    const ambient = frame.motion.ambient;
    const raised = ambient ? raisedShare(net, snapshot.phase, local, t) : 0;
    const leaned = ambient ? raised : snapshot.phase === 'quiet' ? 0 : 1;
    const lean = dragNetBoatLean(net.dragNet.sweep) * leaned;
    drawing.leftBoat.setRotation(lean);
    drawing.rightBoat.setRotation(lean);
    const lift = DRAG_NET_MOTION.riseLift * raised;
    this.drawRope(drawing, SURF - lift);
    this.showLit(drawing, !ambient && snapshot.phase !== 'quiet');
    const bobs = ambient && snapshot.phase === 'quiet';
    for (let index = 0; index < drawing.floats.length; index++) {
      const bob = bobs
        ? (1 - raised) * DRAG_NET_MOTION.quietBobPx * Math.sin((TAU * frame.time) / DRAG_NET_MOTION.quietBobPeriod + index)
        : 0;
      drawing.floats[index].setY(SURF - lift + bob);
    }
    this.showMarkers(drawing, snapshot.phase === 'warn');
    this.renderCurtain(drawing, snapshot, local, t, ambient);
  }

  /** Shows or hides the net's stretch markers, only when that changes. */
  private showMarkers(drawing: NetDrawing, marked: boolean): void {
    if (marked === drawing.marked) return;
    drawing.marked = marked;
    for (const marker of drawing.markers) marker.setVisible(marked);
  }

  /** Swaps every float of the net to the lit frame or back, only when that changes. */
  private showLit(drawing: NetDrawing, lit: boolean): void {
    if (lit === drawing.lit) return;
    drawing.lit = lit;
    const info = lit ? this.textures.floatLit : this.textures.float;
    for (const float of drawing.floats) showFrame(float, info);
  }

  /**
   * The curtain: parked on the sweep's start edge through the warning, faint and, under full motion
   * (`ambient`), pulsing; on the logic's front through the sweep; then, in a quiet after a sweep this
   * trip, where the front ended, fading over liftFade; else hidden.
   */
  private renderCurtain(
    drawing: NetDrawing,
    snapshot: Readonly<DragNetSnapshot>,
    local: number,
    t: number,
    ambient: boolean,
  ): void {
    const { curtain, net } = drawing;
    const { x0, x1 } = net.dragNet.stretch;
    if (snapshot.phase === 'warn') {
      const startX = drawing.heading === 1 ? x0 : x1;
      const intoWarn = local - net.dragNet.timing.quietFor;
      const pulse = (1 - Math.cos((TAU * intoWarn) / WARN_PULSE_PERIOD)) / 2;
      const alpha = ambient ? WARN_PULSE_LOW + (WARN_PULSE_HIGH - WARN_PULSE_LOW) * pulse : WARN_CURTAIN_ALPHA;
      curtain.setVisible(true).setAlpha(alpha).setPosition(startX, SURF);
      return;
    }
    if (snapshot.phase === 'sweep') {
      if (snapshot.front === null) throw new Error(`DragNetView: drag net ${net.id} has no sweep front in its sweep`);
      curtain.setVisible(true).setAlpha(1).setPosition(snapshot.front, SURF);
      return;
    }
    if (t <= local || local >= DRAG_NET_MOTION.liftFade) {
      curtain.setVisible(false);
      return;
    }
    const endX = drawing.heading === 1 ? x1 : x0;
    curtain
      .setVisible(true)
      .setAlpha(1 - local / DRAG_NET_MOTION.liftFade)
      .setPosition(endX, SURF);
  }

  /** The strands on the axolotl's drawn centre while swimming within catchWriggleFor of a catch, fading under reduced motion only. */
  private renderStrands(frame: Readonly<DragNetFrame>): void {
    const share = this.catchAge / DRAG_NET_MOTION.catchWriggleFor;
    this.catchAge = Math.min(this.catchAge + frame.dt, DRAG_NET_MOTION.catchWriggleFor);
    if (!frame.swimming || share >= 1) {
      this.strands.setVisible(false);
      return;
    }
    const { body } = frame;
    this.strands
      .setVisible(true)
      .setPosition(body.x, body.y)
      .setScale(frame.size / this.textures.strands.scale)
      .setAlpha(frame.motion.ambient ? 1 : 1 - share);
  }
}
