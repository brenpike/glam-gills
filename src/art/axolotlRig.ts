/**
 * Axolotl rig glue (issue #46): bakes the parts of axolotlRigParts.ts into
 * CanvasTextures once, and moves them live as children of one Container.
 * Visual only. No game state, no input, no physics.
 *
 * A bake (createAxolotlRigBake) owns every part texture of one appearance at
 * one scale, under `${key}:<part>` keys in the game texture manager. A view
 * (createAxolotlRigView) is a Container of part children placed per pose with
 * rigPlacement. Children are in bake texture pixels with local (0, 0) at the
 * texture anchor, so a root scaled by bake.displayScale(viewScale) shows the
 * axolotl exactly where today's sprite (origin at the anchor) shows it.
 *
 * Textures are painted and refreshed only while baking and never repaint after
 * a bake: setPose moves, turns, swaps frames and writes the tail ropes. The
 * only thing drawn live is the sheen Dream tail stripe (isSheenDream), a flat-colour vector
 * overlay (a Graphics between the 'under' tail and 'tail-over') with no
 * texture upload, redrawn only when the shown tail or the sheen step changes.
 * Legs are baked lazily, one texture per leg state. Destroy views before their bake.
 *
 * Baking is lazy too. Creating a bake, setAppearance and setBakeScale only
 * note the target appearance and scale; the whole rig re-bakes once, on the
 * next read of baked state (version, parts, a view's setPose) or at the game's
 * next POST_STEP (before the frame renders), however many changes came first.
 */
import * as Phaser from 'phaser';
import type { SpriteFrame } from '../logic/spriteAnchor';
import {
  RIG_STILL_POSE,
  SHEEN_STEPS,
  TAIL_STRIP_AMPS,
  TAIL_STRIP_PHASES,
  TWINKLE_BOX,
  TWINKLE_RADII,
  createRigPlacement,
  legStateKey,
  paintRigPart,
  paintTwinkleFrame,
  rigAppearanceKey,
  rigParts,
  rigPlacement,
  sheenStepValue,
  tailColumnXs,
  tailStripPose,
  type RigAppearance,
  type RigPartId,
  type RigPartSpec,
  type RigPartVariant,
  type RigPlacement,
  type RigRenderer,
  type RigTwinkle,
} from './axolotlRigParts';
import type { TailStripe } from './axolotlRigStripe';
import { beginDraw, type TexSize } from './canvasKit';
import { AXO_SCENE_SCALE, AXO_TEX, type AxolotlPose, type LegLook } from './drawAxolotl';
import { AXO_SIZE_SCALE, DEFAULT_ART_LOOK, type AxolotlArtLook } from './drawAxolotlParts';
import { isSheenDream } from './drawDreamOverlay';
import { NO_OUTFIT, type ArtOutfit } from './drawWearables';
import { LEUCISTIC, type DreamLookId, type MorphPalette } from './palette';
import { makeInfo, type TexInfo } from './textures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Largest side of one part texture, in pixels (frames are laid out in a grid within it); see textureSideLimit. */
const MAX_TEXTURE_SIDE = 4096;
/** Most twinkle sprites one view shows at once. */
const TWINKLE_POOL = 17;
/** Canvas tail strip frames: every swim phase at every amplitude. */
const TAIL_STRIP_FRAMES = TAIL_STRIP_PHASES * TAIL_STRIP_AMPS.length;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Every part texture of one axolotl appearance at one bake scale. */
export interface AxolotlRigBake {
  readonly key: string;
  /** Base bake scale, before the size factor. */
  readonly bakeScale: number;
  /** Texture pixels per local unit: bakeScale x AXO_SIZE_SCALE[look.size]. */
  readonly scale: number;
  readonly look: AxolotlArtLook;
  readonly palette: MorphPalette;
  readonly outfit: ArtOutfit;
  /** makeInfo(key, scale, AXO_TEX): the frame today's axolotl sprite has (anchorWorld, spriteFrameBounds). */
  readonly info: TexInfo;
  /**
   * Goes up on every re-bake. Reading it bakes any pending change first, so a
   * read between two setters bakes the in-between appearance too.
   */
  readonly version: number;
  readonly renderer: RigRenderer;
  /**
   * Merge into the appearance. Returns whether the bake is now out of date
   * (rigAppearanceKey differs from the baked one); it then re-bakes every part
   * once, on the next read or before the next frame.
   */
  setAppearance(appearance: Partial<RigAppearance>): boolean;
  /**
   * Change the base bake scale. Returns whether the bake is now out of date;
   * it then re-bakes once, on the next read or before the next frame.
   */
  setBakeScale(bakeScale: number): boolean;
  /** Root scale that shows the axolotl at its size: AXO_SCENE_SCALE x size factor x viewScale / scale. */
  displayScale(viewScale: number): number;
  /** Remove every texture this bake owns (its views are destroyed first if still alive). */
  destroy(): void;
}

/** One live axolotl built from a bake's parts. */
export interface AxolotlRigView {
  /** Place, scale (displayScale), face (faceSprite) and rotate this like today's sprite. */
  readonly root: Phaser.GameObjects.Container;
  readonly bake: AxolotlRigBake;
  /** Show a pose. Skips the work when the pose and the bake are unchanged. */
  setPose(pose: AxolotlPose): void;
  /** The root's transform with the bake's AXO_TEX frame, for anchorWorld and spriteFrameBounds. */
  spriteFrame(): SpriteFrame;
  /** Destroy the Container and its children (the bake's textures stay). */
  destroy(): void;
}

type RigPartKind = 'gill' | 'leg' | 'wear-leg' | 'tail' | 'tail-over' | 'body' | 'tail-item' | 'face' | 'eyes';

/** One baked part: its spec, and the size and anchor of one of its frames. */
interface RigSheet {
  readonly spec: RigPartSpec;
  readonly info: TexInfo;
}

/** One part child of a view. */
interface RigViewPart {
  readonly sheet: RigSheet;
  readonly kind: RigPartKind;
  /** Gill index 0..5 (far, then near) or leg index 0..3; 0 for other parts. */
  readonly index: number;
  readonly image: Phaser.GameObjects.Image;
  frame: number;
  textureKey: string;
}

/** The pose a view last showed, field by field. */
interface PoseMemo {
  shown: boolean;
  swimPhase: number;
  gillPhase: number;
  blink: number;
  tailAmp: number;
  sparkle: number;
  sheen: number | undefined;
  legCount: number;
  legStatus: string[];
  legProgress: number[];
}

/** What the stripe Graphics last drew: the bake version, the shown tail and the sheen step. */
interface StripeMemo {
  version: number;
  swimPhase: number;
  tailAmp: number;
  sheenFrame: number | null;
}

// ---------------------------------------------------------------------------
// Dev frame stats
// ---------------------------------------------------------------------------

let rigFrameMs = 0;
let rigBakeCount = 0;
let rigTimingDepth = 0;

/** Open a timed span; only the outermost open span is timed. Returns its start, or null when nested or in production. */
function startRigTiming(): number | null {
  if (!import.meta.env.DEV) return null;
  rigTimingDepth += 1;
  return rigTimingDepth === 1 ? performance.now() : null;
}

function stopRigTiming(started: number | null): void {
  if (!import.meta.env.DEV) return;
  rigTimingDepth -= 1;
  if (started !== null) rigFrameMs += performance.now() - started;
}

function countRigBake(): void {
  if (import.meta.env.DEV) rigBakeCount += 1;
}

/** Dev only: ms spent in setPose and in bakes since the last take. Always 0 in production. */
export function takeRigFrameMs(): number {
  if (!import.meta.env.DEV) return 0;
  const ms = rigFrameMs;
  rigFrameMs = 0;
  return ms;
}

/** Dev only: part textures baked since the last take. Always 0 in production. */
export function takeRigBakeCount(): number {
  if (!import.meta.env.DEV) return 0;
  const count = rigBakeCount;
  rigBakeCount = 0;
  return count;
}

// ---------------------------------------------------------------------------
// Baking
// ---------------------------------------------------------------------------

/** 'canvas' on the Canvas renderer, else 'webgl'. */
export function rigRendererOf(scene: Phaser.Scene): RigRenderer {
  return scene.sys.game.renderer.type === Phaser.CANVAS ? 'canvas' : 'webgl';
}

/** The palette's Dream colour when it is a sheen colour (isSheenDream), else null. */
function sheenDreamOf(palette: MorphPalette): DreamLookId | null {
  return palette.dream && isSheenDream(palette.dream.id) ? palette.dream.id : null;
}

function scaleFor(bakeScale: number, look: AxolotlArtLook): number {
  return bakeScale * AXO_SIZE_SCALE[look.size];
}

/** Size of one frame of a part, its anchor at the pivot; `grow` local units added above and below (bent tail frames). */
function partSize(spec: RigPartSpec, grow = 0): TexSize {
  return {
    w: spec.box.maxX - spec.box.minX,
    h: spec.box.maxY - spec.box.minY + 2 * grow,
    originX: spec.pivotOffset.x,
    originY: spec.pivotOffset.y + grow,
  };
}

/**
 * Bake `frames` frames into one CanvasTexture under `key` (replacing any
 * texture there), laid out in a grid, each frame `size` at `scale` and named
 * 0..frames - 1. `local` is local (0, 0) from a frame's top-left, local units.
 * Refreshes the texture once. Returns the info of one frame.
 */
function bakeSheet(
  scene: Phaser.Scene,
  key: string,
  size: TexSize,
  scale: number,
  local: { readonly x: number; readonly y: number },
  frames: number,
  paintFrame: (ctx: CanvasRenderingContext2D, frame: number) => void,
): TexInfo {
  const started = startRigTiming();
  try {
    return paintSheet(scene, key, size, scale, local, frames, paintFrame);
  } finally {
    stopRigTiming(started);
  }
}

/**
 * Largest side a part texture may have here: MAX_TEXTURE_SIDE, or less when
 * the WebGL renderer reports a smaller MAX_TEXTURE_SIZE (a texture over it
 * cannot upload). The Canvas renderer has no such limit to report.
 */
function textureSideLimit(scene: Phaser.Scene): number {
  const renderer = scene.sys.game.renderer as Partial<Pick<Phaser.Renderer.WebGL.WebGLRenderer, 'getMaxTextureSize'>>;
  const device = typeof renderer.getMaxTextureSize === 'function' ? renderer.getMaxTextureSize() : undefined;
  return device !== undefined && Number.isFinite(device) && device > 0 ? Math.min(MAX_TEXTURE_SIDE, device) : MAX_TEXTURE_SIDE;
}

function paintSheet(
  scene: Phaser.Scene,
  key: string,
  size: TexSize,
  scale: number,
  local: { readonly x: number; readonly y: number },
  frames: number,
  paintFrame: (ctx: CanvasRenderingContext2D, frame: number) => void,
): TexInfo {
  const info = makeInfo(key, scale, size);
  const side = textureSideLimit(scene);
  // Most columns that fit the width gives the fewest rows, so if this grid is too tall, every grid is.
  const columns = Math.min(frames, Math.max(1, Math.floor(side / info.pxW)));
  const rows = Math.ceil(frames / columns);
  if (info.pxW > side || rows * info.pxH > side) {
    throw new RangeError(`rig texture "${key}" needs ${frames} frames of ${info.pxW}x${info.pxH} px, over ${side} px`);
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, columns * info.pxW, rows * info.pxH);
  if (!tex) throw new Error(`could not create canvas texture "${key}"`);
  const ctx = tex.context;
  for (let frame = 0; frame < frames; frame++) {
    const cellX = (frame % columns) * info.pxW;
    const cellY = Math.floor(frame / columns) * info.pxH;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(cellX, cellY, info.pxW, info.pxH);
    ctx.clip();
    beginDraw(ctx, scale, cellX / scale + local.x, cellY / scale + local.y);
    paintFrame(ctx, frame);
    ctx.restore();
    tex.add(frame, 0, cellX, cellY, info.pxW, info.pxH);
  }
  tex.refresh();
  countRigBake();
  return info;
}

function isTailPart(id: RigPartId): boolean {
  return id === 'tail' || id === 'tail-over';
}

/**
 * The variant painted as frame `frame` of a part's main texture. The tail
 * parts: Canvas strip frame `frame` (tailStripPose), WebGL the straight tail;
 * a sheen Dream 'tail' bakes only its 'under' layers. Never a tail sheen.
 */
function partVariant(spec: RigPartSpec, frame: number, renderer: RigRenderer, sheenPalette: boolean): RigPartVariant {
  if (isTailPart(spec.id)) {
    const tailLayers = spec.id === 'tail' && sheenPalette ? 'under' : 'all';
    if (renderer === 'webgl') return spec.id === 'tail' ? { tailLayers } : {};
    const tailPose = tailStripPose(frame % TAIL_STRIP_PHASES, Math.floor(frame / TAIL_STRIP_PHASES));
    return spec.id === 'tail' ? { tailPose, tailLayers } : { tailPose };
  }
  if (spec.id === 'body') return sheenPalette && frame < SHEEN_STEPS ? { sheen: sheenStepValue(frame) } : {};
  return { frame };
}

/** How many frames a part's main texture holds. */
function partFrames(spec: RigPartSpec, renderer: RigRenderer, sheenPalette: boolean): number {
  if (isTailPart(spec.id)) return renderer === 'canvas' ? TAIL_STRIP_FRAMES : 1;
  if (spec.id === 'body') return sheenPalette ? SHEEN_STEPS + 1 : 1;
  return spec.frames;
}

function isLegPart(id: RigPartId): boolean {
  return id.startsWith('leg-') || id.startsWith('wear-leg-');
}

/** How many bakes hold each shared twinkle strip, per texture manager. */
const twinkleHolds = new WeakMap<Phaser.Textures.TextureManager, Map<string, number>>();

function twinkleHoldsOf(scene: Phaser.Scene): Map<string, number> {
  let holds = twinkleHolds.get(scene.textures);
  if (!holds) {
    holds = new Map();
    twinkleHolds.set(scene.textures, holds);
  }
  return holds;
}

/**
 * The shared twinkle strip at `scale` (TWINKLE_RADII frames), baked on first
 * hold and shared by every bake at that scale. Each hold is let go with
 * releaseTwinkleSheet; the strip is removed when its last holder lets go.
 */
function holdTwinkleSheet(scene: Phaser.Scene, scale: number): TexInfo {
  const key = `axo-rig-twinkle-${scale}`;
  const box = TWINKLE_BOX;
  const size: TexSize = { w: box.maxX - box.minX, h: box.maxY - box.minY, originX: -box.minX, originY: -box.minY };
  const info = scene.textures.exists(key)
    ? makeInfo(key, scale, size)
    : bakeSheet(scene, key, size, scale, { x: -box.minX, y: -box.minY }, TWINKLE_RADII.length, paintTwinkleFrame);
  const holds = twinkleHoldsOf(scene);
  holds.set(key, (holds.get(key) ?? 0) + 1);
  return info;
}

/** Let go of one hold on the twinkle strip `key`, removing it when no bake holds it. */
function releaseTwinkleSheet(scene: Phaser.Scene, key: string): void {
  const holds = twinkleHoldsOf(scene);
  const left = (holds.get(key) ?? 0) - 1;
  if (left > 0) {
    holds.set(key, left);
    return;
  }
  holds.delete(key);
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

class RigBake implements AxolotlRigBake {
  readonly key: string;
  readonly renderer: RigRenderer;
  private readonly scene: Phaser.Scene;
  /** Game-level events: the flush listens here, because a bake (BootScene's) can outlive the scene that made it. */
  private readonly gameEvents: Phaser.Events.EventEmitter;
  private appearance: RigAppearance;
  private base: number;
  private bakedKey = '';
  /** The appearance or scale differs from the baked one; the next flush re-bakes. */
  private stale = false;
  /** A flush is registered for the game's next POST_STEP. */
  private flushScheduled = false;
  private bakes = 0;
  private frameInfo: TexInfo;
  private sheetsById = new Map<RigPartId, RigSheet>();
  private partOrder: RigPartSpec[] = [];
  private stillTail: TexInfo | null = null;
  private twinkles: TexInfo | null = null;
  private sheenDreamId: DreamLookId | null = null;
  private readonly owned = new Set<string>();
  private readonly views = new Set<RigView>();
  private destroyed = false;

  constructor(scene: Phaser.Scene, key: string, bakeScale: number, appearance: Partial<RigAppearance>) {
    assertBakeScale(bakeScale);
    this.scene = scene;
    this.gameEvents = scene.sys.game.events;
    this.key = key;
    this.base = bakeScale;
    this.renderer = rigRendererOf(scene);
    this.appearance = {
      look: appearance.look ?? DEFAULT_ART_LOOK,
      palette: appearance.palette ?? LEUCISTIC,
      outfit: appearance.outfit ?? NO_OUTFIT,
    };
    this.frameInfo = makeInfo(key, this.scale, AXO_TEX);
    this.markStale();
  }

  get bakeScale(): number {
    return this.base;
  }

  get scale(): number {
    return scaleFor(this.base, this.appearance.look);
  }

  get look(): AxolotlArtLook {
    return this.appearance.look;
  }

  get palette(): MorphPalette {
    return this.appearance.palette;
  }

  get outfit(): ArtOutfit {
    return this.appearance.outfit;
  }

  get info(): TexInfo {
    return this.frameInfo;
  }

  get version(): number {
    this.flush();
    return this.bakes;
  }

  /** The parts in draw order (rigParts) at the current bake. */
  get parts(): readonly RigPartSpec[] {
    this.flush();
    return this.partOrder;
  }

  /** The baked palette's sheen Dream colour (isSheenDream), else null. */
  get sheenDream(): DreamLookId | null {
    this.flush();
    return this.sheenDreamId;
  }

  /**
   * The full still tail frame: on WebGL, and on Canvas for a sheen Dream tail
   * (whose strip bakes only 'under'); else null, and Canvas shows strip frame 0, the same pose.
   */
  get tailStill(): TexInfo | null {
    this.flush();
    return this.stillTail;
  }

  get twinkle(): TexInfo {
    this.flush();
    if (!this.twinkles) throw new Error(`rig bake "${this.key}" has no twinkle strip`);
    return this.twinkles;
  }

  /** Whether a change waits for its re-bake (on the next read of baked state, or at the game's next POST_STEP). */
  get rebakePending(): boolean {
    return this.stale && !this.destroyed;
  }

  setAppearance(appearance: Partial<RigAppearance>): boolean {
    this.assertAlive();
    const previousScale = this.scale;
    this.appearance = {
      look: appearance.look ?? this.appearance.look,
      palette: appearance.palette ?? this.appearance.palette,
      outfit: appearance.outfit ?? this.appearance.outfit,
    };
    this.refreshFrameInfo(previousScale);
    return this.markStale();
  }

  setBakeScale(bakeScale: number): boolean {
    this.assertAlive();
    assertBakeScale(bakeScale);
    const previousScale = this.scale;
    this.base = bakeScale;
    this.refreshFrameInfo(previousScale);
    return this.markStale();
  }

  displayScale(viewScale: number): number {
    return (AXO_SCENE_SCALE * AXO_SIZE_SCALE[this.appearance.look.size] * viewScale) / this.scale;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.unscheduleFlush();
    for (const view of [...this.views]) view.destroy();
    this.removeOwned();
    if (this.twinkles) releaseTwinkleSheet(this.scene, this.twinkles.key);
    this.twinkles = null;
    this.destroyed = true;
  }

  sheet(id: RigPartId): RigSheet {
    this.flush();
    const sheet = this.sheetsById.get(id);
    if (!sheet) throw new Error(`rig bake "${this.key}" has no part ${id}`);
    return sheet;
  }

  /** Texture key of a leg or wear-leg part in a leg state, baking it on first use (after any pending re-bake). */
  legTexture(id: RigPartId, leg: LegLook | undefined): string {
    this.assertAlive();
    this.flush();
    const texKey = `${this.key}:${id}:${legStateKey(leg)}`;
    if (this.owned.has(texKey)) return texKey;
    const { spec } = this.sheet(id);
    const appearance = this.appearance;
    const local = { x: -spec.box.minX, y: -spec.box.minY };
    bakeSheet(this.scene, texKey, partSize(spec), this.scale, local, 1, (ctx) =>
      paintRigPart(ctx, id, appearance, { leg }),
    );
    this.owned.add(texKey);
    return texKey;
  }

  register(view: RigView): void {
    this.assertAlive();
    this.views.add(view);
  }

  unregister(view: RigView): void {
    this.views.delete(view);
  }

  assertAlive(): void {
    if (this.destroyed) throw new Error(`rig bake "${this.key}" was destroyed`);
  }

  /** Recompute the AXO_TEX frame info when the scale moved off `previousScale`. */
  private refreshFrameInfo(previousScale: number): void {
    const scale = this.scale;
    if (scale !== previousScale) this.frameInfo = makeInfo(this.key, scale, AXO_TEX);
  }

  /** Whether the appearance and scale now differ from the baked ones; if so, flush at the game's next POST_STEP. */
  private markStale(): boolean {
    const wasStale = this.stale;
    this.stale = rigAppearanceKey(this.appearance, this.scale) !== this.bakedKey;
    if (this.stale && !this.flushScheduled) {
      this.gameEvents.once(Phaser.Core.Events.POST_STEP, this.flush, this);
      this.flushScheduled = true;
    }
    if (wasStale && !this.stale) {
      for (const view of this.views) view.resyncIfBehind();
    }
    return this.stale;
  }

  /** Re-bake a pending change now. Runs at POST_STEP and before every read of baked state. */
  private flush(): void {
    if (this.flushScheduled) this.unscheduleFlush();
    if (this.stale && !this.destroyed) this.rebake();
  }

  private unscheduleFlush(): void {
    this.gameEvents.off(Phaser.Core.Events.POST_STEP, this.flush, this);
    this.flushScheduled = false;
  }

  private rebake(): void {
    const started = startRigTiming();
    try {
      this.removeOwned();
      const scale = this.scale;
      this.partOrder = rigParts(this.appearance);
      this.sheenDreamId = sheenDreamOf(this.appearance.palette);
      this.sheetsById = new Map();
      this.stillTail = null;
      for (const spec of this.partOrder) this.sheetsById.set(spec.id, { spec, info: this.bakePart(spec) });
      const heldTwinkles = this.twinkles;
      this.twinkles = holdTwinkleSheet(this.scene, scale);
      this.frameInfo = makeInfo(this.key, scale, AXO_TEX);
      this.bakedKey = rigAppearanceKey(this.appearance, scale);
      this.bakes += 1;
      // INVARIANT: un-stale before any view resyncs, so the baked-state reads in resync never re-enter rebake.
      this.stale = false;
      for (const view of this.views) view.resync();
      // Hold the new strip before letting go of the old, so a strip this bake keeps is never removed and re-baked.
      if (heldTwinkles) releaseTwinkleSheet(this.scene, heldTwinkles.key);
    } finally {
      stopRigTiming(started);
    }
  }

  /** Bake a part's main texture (legs: only their frame info; their textures bake lazily). */
  private bakePart(spec: RigPartSpec): TexInfo {
    const texKey = `${this.key}:${spec.id}`;
    const scale = this.scale;
    const grow = isTailPart(spec.id) && this.renderer === 'canvas' ? spec.maxDy : 0;
    const size = partSize(spec, grow);
    if (isLegPart(spec.id)) return makeInfo(texKey, scale, size);
    const { renderer, appearance } = this;
    const sheenPalette = this.sheenDreamId !== null;
    if (spec.id === 'tail' && (renderer === 'webgl' || sheenPalette)) this.stillTail = this.bakeStillTail(spec);
    const local = { x: -spec.box.minX, y: -spec.box.minY + grow };
    const info = bakeSheet(this.scene, texKey, size, scale, local, partFrames(spec, renderer, sheenPalette), (ctx, f) =>
      paintRigPart(ctx, spec.id, appearance, partVariant(spec, f, renderer, sheenPalette)),
    );
    this.owned.add(texKey);
    return info;
  }

  /** The full tail ('all' layers) bent at the still pose, the frame the 'still' tail mode shows (see tailStill). */
  private bakeStillTail(spec: RigPartSpec): TexInfo {
    const texKey = `${this.key}:tail-still`;
    const appearance = this.appearance;
    const tailPose = { swimPhase: RIG_STILL_POSE.swimPhase, tailAmp: RIG_STILL_POSE.tailAmp };
    const local = { x: -spec.box.minX, y: -spec.box.minY + spec.maxDy };
    const info = bakeSheet(this.scene, texKey, partSize(spec, spec.maxDy), this.scale, local, 1, (ctx) =>
      paintRigPart(ctx, 'tail', appearance, { tailPose }),
    );
    this.owned.add(texKey);
    return info;
  }

  private removeOwned(): void {
    for (const texKey of this.owned) {
      if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
    }
    this.owned.clear();
  }
}

function assertBakeScale(bakeScale: number): void {
  if (!Number.isFinite(bakeScale) || bakeScale <= 0) throw new RangeError(`bake scale must be positive, got ${bakeScale}`);
}

/**
 * Bake every part of an appearance (defaults: DEFAULT_ART_LOOK, LEUCISTIC,
 * NO_OUTFIT) at `bakeScale` x the look's size factor, under `${key}:<part>`.
 * The first bake runs on the first read of baked state or before the next frame.
 */
export function createAxolotlRigBake(
  scene: Phaser.Scene,
  key: string,
  bakeScale: number,
  appearance: Partial<RigAppearance> = {},
): AxolotlRigBake {
  return new RigBake(scene, key, bakeScale, appearance);
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

function createPoseMemo(): PoseMemo {
  return {
    shown: false,
    swimPhase: 0,
    gillPhase: 0,
    blink: 0,
    tailAmp: 0,
    sparkle: 0,
    sheen: undefined,
    legCount: -1,
    legStatus: [],
    legProgress: [],
  };
}

function samePose(memo: PoseMemo, pose: AxolotlPose): boolean {
  if (!memo.shown) return false;
  if (
    memo.swimPhase !== pose.swimPhase ||
    memo.gillPhase !== pose.gillPhase ||
    memo.blink !== pose.blink ||
    memo.tailAmp !== pose.tailAmp ||
    memo.sparkle !== pose.sparkle ||
    memo.sheen !== pose.sheen
  ) {
    return false;
  }
  const legs = pose.legs;
  if ((legs?.length ?? -1) !== memo.legCount) return false;
  if (!legs) return true;
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].status !== memo.legStatus[i] || legs[i].progress !== memo.legProgress[i]) return false;
  }
  return true;
}

function rememberPose(memo: PoseMemo, pose: AxolotlPose): void {
  memo.shown = true;
  memo.swimPhase = pose.swimPhase;
  memo.gillPhase = pose.gillPhase;
  memo.blink = pose.blink;
  memo.tailAmp = pose.tailAmp;
  memo.sparkle = pose.sparkle;
  memo.sheen = pose.sheen;
  const legs = pose.legs;
  memo.legCount = legs?.length ?? -1;
  memo.legStatus.length = 0;
  memo.legProgress.length = 0;
  if (!legs) return;
  for (const leg of legs) {
    memo.legStatus.push(leg.status);
    memo.legProgress.push(leg.progress);
  }
}

/** A part's kind and its gill (0..5, far then near) or leg (0..3) index. */
function partKindOf(id: RigPartId): { kind: RigPartKind; index: number } {
  const last = Number(id.slice(-1));
  if (id.startsWith('gill-far-')) return { kind: 'gill', index: last };
  if (id.startsWith('gill-near-')) return { kind: 'gill', index: 3 + last };
  if (id.startsWith('wear-leg-')) return { kind: 'wear-leg', index: last };
  if (id.startsWith('leg-')) return { kind: 'leg', index: last };
  return { kind: id as Exclude<RigPartId, `gill-${string}` | `leg-${string}` | `wear-leg-${string}`>, index: 0 };
}

/** An Image showing frame `frame` of `info`'s texture, its origin at the frame's anchor, placed at local `at` (texture px). */
function makePartImage(
  scene: Phaser.Scene,
  textureKey: string,
  info: TexInfo,
  frame: number,
  at: { readonly x: number; readonly y: number },
): Phaser.GameObjects.Image {
  return new Phaser.GameObjects.Image(scene, at.x, at.y, textureKey, frame).setOrigin(info.originNormX, info.originNormY);
}

function createStripeMemo(): StripeMemo {
  return { version: -1, swimPhase: Number.NaN, tailAmp: Number.NaN, sheenFrame: null };
}

class RigView implements AxolotlRigView {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly owner: RigBake;
  private readonly placement: RigPlacement = createRigPlacement();
  private readonly memo: PoseMemo = createPoseMemo();
  private stripeMemo: StripeMemo = createStripeMemo();
  private lastPose: AxolotlPose = RIG_STILL_POSE;
  private syncedVersion = -1;
  private parts: RigViewPart[] = [];
  /** WebGL: the straight tail ('under' when sheen) and 'tail-over' bent along tailColumnXs. */
  private rope: Phaser.GameObjects.Rope | null = null;
  private overRope: Phaser.GameObjects.Rope | null = null;
  /** Canvas: the tail strip ('under' when sheen) and the 'tail-over' strip, both at stripFrame. */
  private stripImage: Phaser.GameObjects.Image | null = null;
  private overStripImage: Phaser.GameObjects.Image | null = null;
  private stripFrame = 0;
  /** The full still tail (bake.tailStill): WebGL always, Canvas when sheen. */
  private stillImage: Phaser.GameObjects.Image | null = null;
  /** The live sheen stripe pair between the tail and 'tail-over'. */
  private stripe: Phaser.GameObjects.Graphics | null = null;
  private twinkleImages: Phaser.GameObjects.Image[] = [];
  private twinkleFrames: number[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene, owner: RigBake) {
    this.scene = scene;
    this.owner = owner;
    this.root = scene.add.container(0, 0);
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => this.detach());
    owner.register(this);
    if (!owner.rebakePending) this.resync();
  }

  get bake(): AxolotlRigBake {
    return this.owner;
  }

  setPose(pose: AxolotlPose): void {
    if (this.destroyed) throw new Error('rig view was destroyed');
    this.owner.assertAlive();
    const started = startRigTiming();
    try {
      this.lastPose = pose;
      const version = this.owner.version;
      if (this.syncedVersion !== version) this.resync();
      else if (!samePose(this.memo, pose)) this.apply(pose);
    } finally {
      stopRigTiming(started);
    }
  }

  spriteFrame(): SpriteFrame {
    const { root } = this;
    const info = this.owner.info;
    return {
      x: root.x,
      y: root.y,
      scaleX: root.scaleX,
      scaleY: root.scaleY,
      rotation: root.rotation,
      width: info.pxW,
      height: info.pxH,
      displayOriginX: info.originNormX * info.pxW,
      displayOriginY: info.originNormY * info.pxH,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.root.destroy();
    this.detach();
  }

  /** Resync unless already showing the bake's current version (a view made while a re-bake was pending, then cancelled). */
  resyncIfBehind(): void {
    const version = this.owner.version;
    if (this.syncedVersion !== version) this.resync();
  }

  /** Rebuild every child from the bake's current textures and parts, and show the last pose. */
  resync(): void {
    this.root.removeAll(true);
    this.parts = [];
    this.rope = null;
    this.overRope = null;
    this.stripImage = null;
    this.overStripImage = null;
    this.stripFrame = 0;
    this.stillImage = null;
    this.stripe = null;
    this.stripeMemo = createStripeMemo();
    this.twinkleImages = [];
    this.twinkleFrames = [];
    for (const spec of this.owner.parts) this.addPart(spec);
    this.syncedVersion = this.owner.version;
    this.memo.shown = false;
    this.apply(this.lastPose);
  }

  private detach(): void {
    this.destroyed = true;
    this.owner.unregister(this);
  }

  private addPart(spec: RigPartSpec): void {
    const sheet = this.owner.sheet(spec.id);
    const { kind, index } = partKindOf(spec.id);
    if (kind === 'tail') {
      this.addTail(sheet);
      return;
    }
    if (kind === 'tail-over') {
      this.addTailOver(sheet);
      return;
    }
    const scale = this.owner.scale;
    const textureKey = this.partTextureKey(sheet, kind, index, this.lastPose);
    const image = makePartImage(this.scene, textureKey, sheet.info, 0, {
      x: spec.pivot.x * scale,
      y: spec.pivot.y * scale,
    });
    this.root.add(image);
    this.parts.push({ sheet, kind, index, image, frame: 0, textureKey });
  }

  private partTextureKey(sheet: RigSheet, kind: RigPartKind, index: number, pose: AxolotlPose): string {
    if (kind === 'leg') return this.owner.legTexture(sheet.spec.id, pose.legs?.[index]);
    if (kind === 'wear-leg') return this.owner.legTexture(sheet.spec.id, undefined);
    return sheet.info.key;
  }

  /** The tail children: WebGL a Rope on the straight tail, then the still Image; Canvas the strip Image, then the still Image when sheen. */
  private addTail(sheet: RigSheet): void {
    if (this.owner.renderer === 'canvas') {
      this.stripImage = this.addStripImage(sheet);
    } else {
      this.rope = this.addRope(sheet);
    }
    const still = this.owner.tailStill;
    if (!still) {
      if (this.owner.renderer === 'webgl') throw new Error(`rig bake "${this.owner.key}" has no still tail frame`);
      return;
    }
    const { spec } = sheet;
    const scale = this.owner.scale;
    this.stillImage = makePartImage(this.scene, still.key, still, 0, { x: spec.pivot.x * scale, y: spec.pivot.y * scale });
    this.root.add(this.stillImage);
  }

  /** The sheen Dream children over the tail: the stripe Graphics, then 'tail-over' as a Rope (WebGL) or strip Image (Canvas). */
  private addTailOver(sheet: RigSheet): void {
    const stripe = new Phaser.GameObjects.Graphics(this.scene);
    stripe.setVisible(false);
    this.stripe = stripe;
    this.root.add(stripe);
    if (this.owner.renderer === 'canvas') this.overStripImage = this.addStripImage(sheet);
    else this.overRope = this.addRope(sheet);
  }

  /** A Canvas strip Image of a tail part at strip frame 0, added to the root. */
  private addStripImage(sheet: RigSheet): Phaser.GameObjects.Image {
    const { spec, info } = sheet;
    const scale = this.owner.scale;
    const image = makePartImage(this.scene, info.key, info, 0, { x: spec.pivot.x * scale, y: spec.pivot.y * scale });
    this.root.add(image);
    return image;
  }

  /** A WebGL Rope on a tail part's straight frame, one point per tailColumnXs, added to the root. */
  private addRope(sheet: RigSheet): Phaser.GameObjects.Rope {
    const scale = this.owner.scale;
    const points = tailColumnXs(this.owner.look).map((x) => ({ x: x * scale, y: 0 }));
    const rope = new Phaser.GameObjects.Rope(this.scene, 0, 0, sheet.info.key, 0, points);
    this.writeRopeUvs(rope, sheet.spec);
    this.root.add(rope);
    return rope;
  }

  private apply(pose: AxolotlPose): void {
    const owner = this.owner;
    const placement = rigPlacement(owner.look, pose, owner.renderer, owner.sheenDream, this.placement);
    for (const part of this.parts) this.placePart(part, placement, pose);
    this.placeTail(placement);
    this.placeStripe(placement);
    this.placeTwinkles(placement.twinkles);
    rememberPose(this.memo, pose);
  }

  private placePart(part: RigViewPart, placement: RigPlacement, pose: AxolotlPose): void {
    const { image, index } = part;
    switch (part.kind) {
      case 'gill':
        showFrame(part, placement.gills[index].frame);
        image.rotation = placement.gills[index].rotation;
        return;
      case 'leg':
        this.showTexture(part, this.partTextureKey(part.sheet, 'leg', index, pose));
        image.rotation = placement.legs[index].rotation;
        return;
      case 'wear-leg':
        image.setVisible(placement.legs[index].wears);
        image.rotation = placement.legs[index].rotation;
        return;
      case 'body':
        showFrame(part, this.owner.sheenDream !== null ? (placement.sheenFrame ?? SHEEN_STEPS) : 0);
        return;
      case 'tail-item': {
        const scale = this.owner.scale;
        image.setPosition(placement.tailItem.x * scale, placement.tailItem.y * scale);
        image.rotation = placement.tailItem.rotation;
        return;
      }
      case 'eyes':
        showFrame(part, placement.eyesFrame);
        return;
      case 'face':
      case 'tail':
      case 'tail-over':
        return;
    }
  }

  private showTexture(part: RigViewPart, textureKey: string): void {
    if (part.textureKey === textureKey) return;
    part.image.setTexture(textureKey, 0);
    part.textureKey = textureKey;
    part.frame = 0;
  }

  /** Show the still Image on a still tail (when there is one), else the ropes or strips; tail-over only while moving. */
  private placeTail(placement: RigPlacement): void {
    const { tail } = placement;
    const moving = tail.mode !== 'still';
    const still = this.stillImage;
    still?.setVisible(!moving);
    const strip = this.stripImage;
    if (strip) {
      strip.setVisible(moving || !still);
      this.overStripImage?.setVisible(moving);
      const frame = moving ? tail.frame : 0;
      if (frame === this.stripFrame) return;
      strip.setFrame(frame);
      this.overStripImage?.setFrame(frame);
      this.stripFrame = frame;
      return;
    }
    const rope = this.rope;
    if (!rope) throw new Error('rig view has no tail');
    rope.setVisible(moving);
    this.overRope?.setVisible(moving);
    if (!moving) return;
    const { spec } = this.owner.sheet('tail');
    this.writeRopeVertices(rope, spec, tail.dy);
    if (this.overRope) this.writeRopeVertices(this.overRope, spec, tail.dy);
  }

  /** Show the stripe on a moving sheen Dream tail; redraw it only when the bake, the shown tail or the sheen step changed. */
  private placeStripe(placement: RigPlacement): void {
    const stripe = this.stripe;
    if (!stripe) return;
    const moving = placement.tail.mode !== 'still';
    stripe.setVisible(moving);
    if (!moving) return;
    const memo = this.stripeMemo;
    const { swimPhase, tailAmp } = placement.shownTail;
    const version = this.owner.version;
    if (
      memo.version === version &&
      memo.swimPhase === swimPhase &&
      memo.tailAmp === tailAmp &&
      memo.sheenFrame === placement.sheenFrame
    ) {
      return;
    }
    drawStripe(stripe, placement.stripe, this.owner.scale);
    memo.version = version;
    memo.swimPhase = swimPhase;
    memo.tailAmp = tailAmp;
    memo.sheenFrame = placement.sheenFrame;
  }

  /** Rope UVs: each column's x across the straight tail frame, top and bottom of the part box. */
  private writeRopeUvs(rope: Phaser.GameObjects.Rope, spec: RigPartSpec): void {
    const scale = this.owner.scale;
    const columns = tailColumnXs(this.owner.look);
    const { u0, v0, u1, v1, cutWidth, cutHeight } = rope.frame;
    const vBottom = v0 + (v1 - v0) * Math.min(1, ((spec.box.maxY - spec.box.minY) * scale) / cutHeight);
    const uv = rope.uv;
    for (let i = 0; i < columns.length; i++) {
      const across = Math.min(1, Math.max(0, ((columns[i] - spec.box.minX) * scale) / cutWidth));
      const u = u0 + (u1 - u0) * across;
      uv[i * 4] = u;
      uv[i * 4 + 1] = v0;
      uv[i * 4 + 2] = u;
      uv[i * 4 + 3] = vBottom;
    }
    rope.dirty = false;
  }

  /** Rope vertices relative to the anchor: each column's top and bottom of the part box, shifted by its dy. */
  private writeRopeVertices(rope: Phaser.GameObjects.Rope, spec: RigPartSpec, dy: readonly number[]): void {
    const scale = this.owner.scale;
    const columns = tailColumnXs(this.owner.look);
    if (dy.length !== columns.length) {
      throw new Error(`tail shear has ${dy.length} columns, the rope ${columns.length}`);
    }
    const vertices = rope.vertices;
    for (let i = 0; i < columns.length; i++) {
      const x = columns[i] * scale;
      vertices[i * 4] = x;
      vertices[i * 4 + 1] = (spec.box.minY + dy[i]) * scale;
      vertices[i * 4 + 2] = x;
      vertices[i * 4 + 3] = (spec.box.maxY + dy[i]) * scale;
    }
    rope.dirty = false;
  }

  private placeTwinkles(twinkles: readonly RigTwinkle[]): void {
    if (twinkles.length > TWINKLE_POOL) {
      throw new RangeError(`rig shows at most ${TWINKLE_POOL} twinkles, placement has ${twinkles.length}`);
    }
    const scale = this.owner.scale;
    for (let k = 0; k < twinkles.length; k++) {
      const twinkle = twinkles[k];
      const image = this.twinkleImages[k] ?? this.addTwinkle();
      image.setVisible(true).setPosition(twinkle.x * scale, twinkle.y * scale);
      if (this.twinkleFrames[k] !== twinkle.frame) image.setFrame(twinkle.frame);
      this.twinkleFrames[k] = twinkle.frame;
    }
    for (let k = twinkles.length; k < this.twinkleImages.length; k++) this.twinkleImages[k].setVisible(false);
  }

  private addTwinkle(): Phaser.GameObjects.Image {
    const info = this.owner.twinkle;
    const image = makePartImage(this.scene, info.key, info, 0, { x: 0, y: 0 });
    this.root.add(image);
    this.twinkleImages.push(image);
    this.twinkleFrames.push(0);
    return image;
  }
}

function showFrame(part: RigViewPart, frame: number): void {
  if (part.frame === frame) return;
  part.image.setFrame(frame);
  part.frame = frame;
}

/** Clear `graphics` and fill each band's polygons in its flat colour, local units x `scale` from the anchor. */
function drawStripe(graphics: Phaser.GameObjects.Graphics, stripe: TailStripe, scale: number): void {
  graphics.clear();
  for (const band of stripe) {
    graphics.fillStyle(band.colour, band.alpha);
    for (const polygon of band.polygons) {
      graphics.beginPath();
      graphics.moveTo(polygon[0] * scale, polygon[1] * scale);
      for (let i = 2; i < polygon.length; i += 2) graphics.lineTo(polygon[i] * scale, polygon[i + 1] * scale);
      graphics.closePath();
      graphics.fillPath();
    }
  }
}

/**
 * A live axolotl showing `bake`'s parts, added to `scene` at (0, 0). It shows
 * the still pose from its first sync: right away, or, while a re-bake is
 * pending, when that re-bake runs (before the next frame at the latest).
 */
export function createAxolotlRigView(scene: Phaser.Scene, bake: AxolotlRigBake): AxolotlRigView {
  if (!(bake instanceof RigBake)) throw new TypeError('createAxolotlRigView needs a bake from createAxolotlRigBake');
  return new RigView(scene, bake);
}
