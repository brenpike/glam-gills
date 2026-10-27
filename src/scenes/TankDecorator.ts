import * as Phaser from 'phaser';
import { INK, LW, UI_PANEL, WHITE } from '../art/palette';
import {
  TANK_DECORATION_SLUGS,
  type ExtraDecorationIconSize,
  type ExtraDecorationTextures,
  type TankDecorationSlug,
  type TankTextures,
} from '../art/tankTextures';
import type { BakedTextures, TexInfo } from '../art/textures';
import type { RarityGlowSize, TreasureTextures } from '../art/treasureTextures';
import { treasureSlug, type Decoration } from '../logic/catalogue';
import { badgeShape } from '../logic/hints';
import type { Rect, Size } from '../logic/hudLayout';
import type { MotionProfile } from '../logic/motion';
import {
  cssToTank,
  decorationAnchor,
  decorationById,
  decorationFootprintFor,
  decorationMotion,
  drawOrder,
  isValidPlacementFor,
  moveDecoration,
  nudgeDecoration,
  ownedDecorations,
  placeDecoration,
  placementOf,
  putAway,
  snapPlacement,
  suggestSpot,
  tankToCss,
  type TankChange,
  type TankDirection,
  type TankFrame,
  type TankLayout,
  type TankResult,
} from '../logic/tank';
import {
  ALL_DECORATIONS_PLACED,
  DECORATE_HINT,
  DONE_LABEL,
  NEXT_PAGE_LABEL,
  NO_DECORATIONS_TO_PLACE,
  PREVIOUS_PAGE_LABEL,
  PUT_AWAY_LABEL,
} from '../logic/tankText';
import {
  CHEST_BUTTON,
  COMPACT_DONE,
  COMPACT_TRAY_PX,
  ICON_TILE,
  TILE_BUTTON,
  TRAY_PX,
  UI,
  decorateLayout,
  nextFocusIndex,
  trayPageOf,
  type DecorateLayout,
  type DecorateSizes,
  type TankKey,
} from '../logic/tankUi';
import type { Point } from '../logic/zone';
import { playSound } from '../platform/soundPlayer';
import { createButton, cssColor, drawPanel, uiTextStyle, type SceneView, type UiButton } from './BootScene';
import { addRarityGlow } from './FindPopup';

const CAPTION_PX = 18;
const PUT_AWAY_SIZE = 0.8;
/** createButton size of a square tile that makes the ICON_TILE body. */
const ICON_TILE_SIZE = ICON_TILE.w / TILE_BUTTON.w;
const DRAG_THRESHOLD_PX = 8;
const GHOST_ALPHA = 0.5;
const INVALID_GHOST_MS = 700;
const DEPTH_STEP = 0.01;
const RING_RADIUS_PX = 18;
const RING_LINE_PX = 3;
const RING_INNER_PX = LW / 2 + 1.5;
const RING_OUTER_PX = LW / 2 + 4.5;
const DASH_PX = 8;
const DASH_GAP_PX = 6;

/** A tray square look: its side in CSS px and the sizes of its icon and the rarity glow under it. */
interface TrayLook {
  squarePx: number;
  iconPx: ExtraDecorationIconSize;
  glowPx: RarityGlowSize;
}

/** Full tray square: 64 px, the 48 px icon over the 56 px glow. */
const FULL_TRAY: TrayLook = Object.freeze({ squarePx: TRAY_PX, iconPx: 48, glowPx: 56 });

/** Compact tray square: 48 px, the 32 px icon over the 40 px glow. */
const COMPACT_TRAY: TrayLook = Object.freeze({ squarePx: COMPACT_TRAY_PX, iconPx: 32, glowPx: 40 });

/** Textures the decorator draws with. */
export interface TankDecoratorTextures {
  baked: BakedTextures;
  treasure: TreasureTextures;
  tank: TankTextures;
}

/** The art of one Decoration. */
export interface DecorationArt {
  /** Tank sprite, anchored at the Decoration anchor (decorationAnchor). */
  readonly sprite: TexInfo;
  /** Tank rarity glow, with the sprite's anchor. */
  readonly glow: TexInfo;
  /** Centre-anchored tray icons by size. */
  readonly icons: Readonly<Record<ExtraDecorationIconSize, TexInfo>>;
}

/** The art of the Decoration `id`. Throws when there is none. */
export type DecorationArtResolver = (id: string) => DecorationArt;

/** Display depths: placed Decorations stack up from `decorations`; the toolbar, rings and ghost sit at `ui`. */
export interface TankDecoratorDepths {
  decorations: number;
  ui: number;
}

/** What the decorator needs from its scene. */
export interface TankDecoratorOptions {
  scene: Phaser.Scene;
  textures: TankDecoratorTextures;
  /** The art of every Decoration in `catalogue`. */
  art: DecorationArtResolver;
  /** The Decorations the tank rules use: the shipped ones, plus any page-only dev ones. */
  catalogue: readonly Decoration[];
  depths: TankDecoratorDepths;
  dpr: number;
  /** Called after every placement, move and put away with the new layout. */
  onLayoutChange: (layout: TankLayout) => void;
  /** Called when the player presses Done or cancels. */
  onDone: () => void;
}

/** A keyboard focus target in decorate mode. */
type FocusTarget = { kind: 'tray' | 'placed'; id: string } | { kind: 'previousPage' | 'nextPage' | 'putAway' | 'done' };

/** One placed Decoration image, its rarity glow just behind it, the textures they show, and its CSS anchor. */
interface DecorationSprite {
  decoration: Decoration;
  image: Phaser.GameObjects.Image;
  info: TexInfo;
  glow: Phaser.GameObjects.Image;
  glowInfo: TexInfo;
  /** CSS point of the Decoration anchor, before idle motion; null until the tank frame is known. */
  anchor: Point | null;
}

/** One tray square: a white panel with the treasure icon over its rarity glow, and a hit zone. */
interface TrayButton {
  id: string;
  container: Phaser.GameObjects.Container;
}

/** A control with its full and compact variants; only the one the layout picks shows. */
interface ButtonPair {
  full: UiButton;
  compact: UiButton;
}

/** A touch drag of a placed Decoration by its first pointer. */
interface DragState {
  id: string;
  pointerId: number;
  start: Point;
  grab: Point;
  moving: boolean;
  target: Point;
}

/** Stable string for a focus target, so targets compare by value. */
function focusKey(target: FocusTarget): string {
  return 'id' in target ? `${target.kind}:${target.id}` : target.kind;
}

/** Whether `slug` names a baked Home Tank Decoration. */
function isTankDecorationSlug(slug: string): slug is TankDecorationSlug {
  return (TANK_DECORATION_SLUGS as readonly string[]).includes(slug);
}

/** The Home Tank slug of the Decoration `id`. Throws when no tank texture is baked for its slug. */
function decorationSlug(id: string): TankDecorationSlug {
  const slug = treasureSlug(id);
  if (!isTankDecorationSlug(slug)) throw new Error(`TankDecorator: no tank texture for Decoration ${id}`);
  return slug;
}

/** The texture `key` in `record`. Throws naming `what` when it is missing. */
function requireTex(record: Readonly<Record<string, TexInfo | undefined>>, key: string, what: string): TexInfo {
  const info = record[key];
  if (info === undefined) throw new Error(`TankDecorator: no ${what} for Decoration ${key}`);
  return info;
}

/** The art of a shipped Decoration: the tank sprite and glow, and the treasure icons. */
function shippedDecorationArt(tank: TankTextures, treasure: TreasureTextures, id: string): DecorationArt {
  const slug = decorationSlug(id);
  return {
    sprite: tank.decorations[slug],
    glow: tank.decorationGlows[slug],
    icons: { 48: treasure.icons[48][slug], 32: treasure.icons[32][slug] },
  };
}

/** The art of an extra (dev pack) Decoration from its own textures. Throws for a missing texture. */
function extraDecorationArt(extra: ExtraDecorationTextures, id: string): DecorationArt {
  return {
    sprite: requireTex(extra.decorations, id, 'tank sprite'),
    glow: requireTex(extra.decorationGlows, id, 'tank glow'),
    icons: { 48: requireTex(extra.icons[48], id, '48 px icon'), 32: requireTex(extra.icons[32], id, '32 px icon') },
  };
}

/**
 * Resolves Decoration art: ids with a sprite in `extra` (a Decoration pack, such as the dev one) from
 * its textures, every other id from the shipped tank and treasure textures. The resolver throws for
 * an id with art in neither.
 */
export function createDecorationArtResolver(
  tank: TankTextures,
  treasure: TreasureTextures,
  extra: ExtraDecorationTextures | null,
): DecorationArtResolver {
  return (id) =>
    extra !== null && Object.hasOwn(extra.decorations, id)
      ? extraDecorationArt(extra, id)
      : shippedDecorationArt(tank, treasure, id);
}

/** Adds an image showing `info` at its baked origin (a Decoration's anchor, or an icon's centre). */
function addAnchoredImage(scene: Phaser.Scene, info: TexInfo): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, info.key).setOrigin(info.originNormX, info.originNormY);
}

/** Destroys a placed Decoration image and its glow. */
function destroyDecorationSprite(sprite: DecorationSprite): void {
  sprite.image.destroy();
  sprite.glow.destroy();
}

/** The body size of `button`. */
function buttonSize(button: UiButton): Size {
  return { w: button.width, h: button.height };
}

/**
 * Shows the variant of `pair` the layout picks at `rect` (when `shown`) with `focused`, and hides the
 * other one unfocused, so it takes no press and shows no focus.
 */
function placeButtonPair(pair: ButtonPair, rect: Rect, compact: boolean, shown: boolean, focused: boolean): void {
  const active = compact ? pair.compact : pair.full;
  const inactive = compact ? pair.full : pair.compact;
  active.container.setPosition(rect.x, rect.y).setVisible(shown);
  active.setFocused(focused);
  inactive.container.setVisible(false);
  inactive.setFocused(false);
}

/** Shows the variant of a tray page button `pair` the layout picks at `rect` with `focused`; hides both when `rect` is null. */
function placePageButtonPair(pair: ButtonPair, rect: Rect | null, compact: boolean, focused: boolean): void {
  if (rect !== null) return placeButtonPair(pair, rect, compact, true, focused);
  for (const button of [pair.full, pair.compact]) {
    button.container.setVisible(false);
    button.setFocused(false);
  }
}

/** Strokes a rounded rect `outset` px outside `rect` with the current line style. */
function strokeOutset(graphics: Phaser.GameObjects.Graphics, rect: Rect, outset: number): void {
  graphics.strokeRoundedRect(
    rect.x - outset,
    rect.y - outset,
    rect.w + 2 * outset,
    rect.h + 2 * outset,
    RING_RADIUS_PX + outset,
  );
}

/** The double focus ring (art guide 8) round `rect`: inner white, outer ink, both opaque. */
function strokeDoubleRing(graphics: Phaser.GameObjects.Graphics, rect: Rect): void {
  graphics.lineStyle(RING_LINE_PX, cssColor(WHITE).color, 1);
  strokeOutset(graphics, rect, RING_INNER_PX);
  graphics.lineStyle(RING_LINE_PX, cssColor(INK).color, 1);
  strokeOutset(graphics, rect, RING_OUTER_PX);
}

/** Strokes a dashed line from `from` to `to` with the current line style. */
function strokeDashedLine(graphics: Phaser.GameObjects.Graphics, from: Point, to: Point): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!(length > 0)) return;
  const unitX = (to.x - from.x) / length;
  const unitY = (to.y - from.y) / length;
  for (let along = 0; along < length; along += DASH_PX + DASH_GAP_PX) {
    const end = Math.min(length, along + DASH_PX);
    graphics.lineBetween(from.x + unitX * along, from.y + unitY * along, from.x + unitX * end, from.y + unitY * end);
  }
}

/** A dashed ink outline along the edges of `rect` (art guide 7f, invalid move). */
function strokeDashedRect(graphics: Phaser.GameObjects.Graphics, rect: Rect): void {
  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.w, y: rect.y };
  const bottomRight = { x: rect.x + rect.w, y: rect.y + rect.h };
  const bottomLeft = { x: rect.x, y: rect.y + rect.h };
  graphics.lineStyle(LW, cssColor(INK).color, 1);
  strokeDashedLine(graphics, topLeft, topRight);
  strokeDashedLine(graphics, topRight, bottomRight);
  strokeDashedLine(graphics, bottomRight, bottomLeft);
  strokeDashedLine(graphics, bottomLeft, topLeft);
}

/**
 * Draws the placed Decorations in the Home Tank and runs decorate mode (PRD C9, X5): a toolbar of
 * tray squares for owned Decorations not yet placed, Put away and Done, and a caption, each in its
 * full or compact look as decorateLayout picks. A tray that fits no room shows one page of squares
 * at a time, with Back and Next to turn the pages, wrapping past either end. Placing, moving and
 * putting away go through src/logic/tank with the decorator's catalogue, so a Decoration is placed at most once and only
 * where its kind may stand: Floor items on the gravel, Floating and Hanging items in the top band,
 * moving left and right only. Works by touch (tap, drag with a ghost) and by keyboard (focus cycling,
 * arrow nudges, confirm, cancel, put away). The scene owns layout persistence via onLayoutChange.
 */
export class TankDecorator {
  private readonly scene: Phaser.Scene;
  private readonly options: TankDecoratorOptions;
  /** Owned ids the tank rules check placements against: banked plus any page-only dev ids. */
  private readonly ownedIds: readonly string[];
  /** Owned Decoration ids in catalogue order. */
  private readonly owned: readonly string[];
  private readonly sprites = new Map<string, DecorationSprite>();
  private readonly toolbar: Phaser.GameObjects.Container;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly putAwayButtons: ButtonPair;
  private readonly doneButtons: ButtonPair;
  private readonly previousPageButtons: ButtonPair;
  private readonly nextPageButtons: ButtonPair;
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly ghostImage: Phaser.GameObjects.Image;
  private readonly ghostMarks: Phaser.GameObjects.Graphics;
  private readonly noIcon: Phaser.GameObjects.Image;
  private tankLayout: TankLayout;
  private trayButtons: TrayButton[] = [];
  private trayLook: TrayLook = FULL_TRAY;
  private view: SceneView | null = null;
  private frame: TankFrame | null = null;
  private decorate: DecorateLayout | null = null;
  /** The tray page asked for; decorateLayout clamps it to the pages there are. */
  private page = 0;
  private active = false;
  private focus: FocusTarget | null = null;
  private selection: string | null = null;
  private drag: DragState | null = null;
  private trayPressId: string | null = null;
  private invalidTimer: Phaser.Time.TimerEvent | null = null;
  private motionTimeS = 0;
  private motionStill = false;

  constructor(options: TankDecoratorOptions, layout: TankLayout, owned: readonly string[]) {
    this.scene = options.scene;
    this.options = options;
    this.tankLayout = layout;
    this.ownedIds = [...owned];
    this.owned = ownedDecorations(owned, options.catalogue);
    const { scene, depths, dpr } = options;
    this.caption = scene.add.text(0, 0, '', { ...uiTextStyle(CAPTION_PX, dpr, false), align: 'center' });
    this.putAwayButtons = this.createPutAwayButtons();
    this.doneButtons = this.createDoneButtons();
    this.previousPageButtons = this.createPageButtons(PREVIOUS_PAGE_LABEL, 'left', -1);
    this.nextPageButtons = this.createPageButtons(NEXT_PAGE_LABEL, 'right', 1);
    this.toolbar = scene.add
      .container(0, 0, [
        this.caption,
        ...this.buttonPairs().flatMap((pair) => [pair.full.container, pair.compact.container]),
      ])
      .setDepth(depths.ui)
      .setVisible(false);
    this.rings = scene.add.graphics().setDepth(depths.ui + DEPTH_STEP);
    const noIconInfo = options.textures.tank.noIcon;
    this.ghostImage = scene.add.image(0, 0, noIconInfo.key).setAlpha(GHOST_ALPHA).setDepth(depths.ui + 2 * DEPTH_STEP);
    this.ghostMarks = scene.add.graphics().setDepth(depths.ui + 3 * DEPTH_STEP);
    this.noIcon = scene.add
      .image(0, 0, noIconInfo.key)
      .setOrigin(noIconInfo.originNormX, noIconInfo.originNormY)
      .setScale(1 / noIconInfo.scale)
      .setDepth(depths.ui + 4 * DEPTH_STEP);
    this.hideGhost();
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.syncDecorations();
  }

  /** Places the Decorations and the toolbar for a new canvas size. Cancels any drag or ghost. */
  layout(view: SceneView, frame: TankFrame): void {
    this.view = view;
    this.frame = frame;
    this.cancelDrag();
    this.refresh();
  }

  setResolution(dpr: number): void {
    this.caption.setResolution(dpr);
    for (const pair of this.buttonPairs()) {
      pair.full.setResolution(dpr);
      pair.compact.setResolution(dpr);
    }
    this.relayoutToolbar();
  }

  /**
   * Idle motion at `timeS` seconds (decorationMotion): the Pond plant sways about its base, Floating
   * items bob and Hanging items sway about the hook, on each sprite and its glow. Everything stands
   * still at once when the reed sway is off (reduced motion). Transforms only.
   */
  update(timeS: number, motion: MotionProfile): void {
    this.motionTimeS = timeS;
    this.motionStill = !motion.reedSway;
    for (const sprite of this.sprites.values()) this.applyMotion(sprite);
  }

  /** Starts decorate mode on the first tray page: shows the toolbar and makes the placed Decorations pressable, with no focus yet. */
  enter(): void {
    this.active = true;
    this.selection = null;
    this.focus = null;
    this.page = 0;
    this.toolbar.setVisible(true);
    for (const sprite of this.sprites.values()) sprite.image.setInteractive({ useHandCursor: true });
    this.refresh();
  }

  /** Ends decorate mode: cancels any drag or ghost, clears focus and selection, hides the toolbar. */
  exit(): void {
    this.cancelDrag();
    this.active = false;
    this.selection = null;
    this.focus = null;
    this.trayPressId = null;
    this.toolbar.setVisible(false);
    for (const sprite of this.sprites.values()) sprite.image.disableInteractive();
    this.applyFocusVisuals();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Runs a Home Tank key in decorate mode; ignored when not active. */
  handleKey(key: TankKey): void {
    if (!this.active) return;
    switch (key) {
      case 'next':
        return this.stepFocus(1);
      case 'previous':
        return this.stepFocus(-1);
      case 'confirm':
        return this.confirmFocus();
      case 'cancel':
        return this.pressDone();
      case 'putAway':
        return this.putAwaySelected();
      default:
        return this.handleArrow(key);
    }
  }

  destroy(): void {
    this.cancelDrag();
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    for (const sprite of this.sprites.values()) destroyDecorationSprite(sprite);
    this.sprites.clear();
    this.trayButtons = [];
    this.toolbar.destroy();
    this.rings.destroy();
    this.ghostImage.destroy();
    this.ghostMarks.destroy();
    this.noIcon.destroy();
  }

  /** Put away: a wide secondary button at size 0.8, and an icon-only ICON_TILE when compact. */
  private createPutAwayButtons(): ButtonPair {
    const { scene, textures, dpr } = this.options;
    const common = {
      fill: 'secondary',
      label: PUT_AWAY_LABEL,
      icon: 'putAway',
      dpr,
      pressOnDown: false,
      onPress: () => this.putAwaySelected(),
    } as const;
    return {
      full: createButton(scene, textures.baked, { ...common, shape: 'wide', size: PUT_AWAY_SIZE }),
      compact: createButton(scene, textures.baked, { ...common, shape: 'square', size: ICON_TILE_SIZE, iconOnly: true }),
    };
  }

  /** Done: a wide primary button, and a label-sized COMPACT_DONE when compact. */
  private createDoneButtons(): ButtonPair {
    const { scene, textures, dpr } = this.options;
    const common = {
      fill: 'primary',
      shape: 'wide',
      size: 1,
      label: DONE_LABEL,
      icon: 'check',
      dpr,
      pressOnDown: false,
      onPress: () => this.pressDone(),
    } as const;
    return {
      full: createButton(scene, textures.baked, common),
      compact: createButton(scene, textures.baked, { ...common, width: COMPACT_DONE.w }),
    };
  }

  /** Back or Next: a square secondary tile CHEST_BUTTON wide, as in the Treasure Chest, and an icon-only ICON_TILE when compact. */
  private createPageButtons(label: string, icon: 'left' | 'right', step: number): ButtonPair {
    const { scene, textures, dpr } = this.options;
    const common = { fill: 'secondary', shape: 'square', label, icon, dpr, pressOnDown: false, onPress: () => this.turnPage(step) } as const;
    return {
      full: createButton(scene, textures.baked, { ...common, size: 1, width: CHEST_BUTTON.w }),
      compact: createButton(scene, textures.baked, { ...common, size: ICON_TILE_SIZE, iconOnly: true }),
    };
  }

  /** Every toolbar button pair: Put away, Done, Back and Next. */
  private buttonPairs(): ButtonPair[] {
    return [this.putAwayButtons, this.doneButtons, this.previousPageButtons, this.nextPageButtons];
  }

  /** The catalogue Decoration `id`. Throws when the catalogue has none. */
  private decorationOf(id: string): Decoration {
    const decoration = decorationById(id, this.options.catalogue);
    if (decoration === undefined) throw new Error(`TankDecorator: unknown Decoration ${id}`);
    return decoration;
  }

  /** Brings images, tray, toolbar and rings in line with the layout, selection and focus. */
  private refresh(): void {
    this.syncDecorations();
    if (this.selection !== null && placementOf(this.tankLayout, this.selection) === undefined) this.selection = null;
    const focus = this.focus;
    if (focus !== null && !this.focusTargets().some((target) => focusKey(target) === focusKey(focus))) {
      this.focus = null;
    }
    this.applyFocusVisuals();
  }

  /** One image per placement, stacked by drawOrder within the decorations depth, every kind behind the axolotls. */
  private syncDecorations(): void {
    for (const [id, sprite] of this.sprites) {
      if (placementOf(this.tankLayout, id) !== undefined) continue;
      destroyDecorationSprite(sprite);
      this.sprites.delete(id);
    }
    drawOrder(this.tankLayout, this.options.catalogue).forEach((placement, index) => {
      const sprite = this.sprites.get(placement.id) ?? this.addDecorationSprite(placement.id);
      const depth = this.options.depths.decorations + index * DEPTH_STEP;
      sprite.image.setDepth(depth);
      sprite.glow.setDepth(depth - DEPTH_STEP / 2);
      this.placeSprite(sprite, placement);
    });
  }

  private addDecorationSprite(id: string): DecorationSprite {
    const art = this.options.art(id);
    const glow = addAnchoredImage(this.scene, art.glow);
    const image = addAnchoredImage(this.scene, art.sprite);
    image.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.handleDecorationDown(id, pointer),
    );
    if (this.active) image.setInteractive({ useHandCursor: true });
    const sprite: DecorationSprite = {
      decoration: this.decorationOf(id),
      image,
      info: art.sprite,
      glow,
      glowInfo: art.glow,
      anchor: null,
    };
    this.sprites.set(id, sprite);
    return sprite;
  }

  /** CSS point of the anchor of `decoration` with its base point at `pos`, or null before the frame is known. */
  private anchorCss(decoration: Decoration, pos: Point): Point | null {
    const frame = this.frame;
    if (frame === null) return null;
    return tankToCss(frame, decorationAnchor(decoration, pos));
  }

  /** Scales a placed Decoration and its glow to the tank frame at the anchor for base point `pos`, with its idle motion. */
  private placeSprite(sprite: DecorationSprite, pos: Point): void {
    const frame = this.frame;
    if (frame === null) return;
    sprite.anchor = this.anchorCss(sprite.decoration, pos);
    sprite.image.setScale(frame.scale / sprite.info.scale);
    sprite.glow.setScale(frame.scale / sprite.glowInfo.scale);
    this.applyMotion(sprite);
  }

  /** Moves a placed Decoration and its glow by the current idle motion (bob down, sway angle) from its anchor. */
  private applyMotion(sprite: DecorationSprite): void {
    const frame = this.frame;
    const anchor = sprite.anchor;
    if (frame === null || anchor === null) return;
    const motion = decorationMotion(sprite.decoration, this.motionTimeS, this.motionStill);
    const y = anchor.y + motion.dy * frame.scale;
    sprite.image.setPosition(anchor.x, y).setRotation(motion.angle);
    sprite.glow.setPosition(anchor.x, y).setRotation(motion.angle);
  }

  /** Owned Decorations not in the tank, in catalogue order. */
  private trayIds(): string[] {
    return this.owned.filter((id) => placementOf(this.tankLayout, id) === undefined);
  }

  /** Rebuilds the tray squares when the set of unplaced Decorations or the tray look changes. */
  private syncTray(ids: readonly string[], look: TrayLook): void {
    const sameIds = ids.join('\n') === this.trayButtons.map((button) => button.id).join('\n');
    if (sameIds && look === this.trayLook) return;
    for (const button of this.trayButtons) button.container.destroy();
    this.trayPressId = null;
    this.trayLook = look;
    this.trayButtons = ids.map((id) => this.addTrayButton(id, look));
  }

  private addTrayButton(id: string, look: TrayLook): TrayButton {
    const scene = this.scene;
    const side = look.squarePx;
    const panel = scene.add.graphics();
    drawPanel(panel, 0, 0, side, side, UI_PANEL);
    const glow = addRarityGlow(scene, this.options.textures.treasure, look.glowPx, badgeShape(this.decorationOf(id).rarity));
    const iconInfo = this.options.art(id).icons[look.iconPx];
    const icon = addAnchoredImage(scene, iconInfo).setScale(1 / iconInfo.scale);
    const iconGroup = scene.add.container(side / 2, side / 2, [glow, icon]);
    const zone = scene.add.zone(0, 0, side, side).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.handleTrayDown(id));
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.handleTrayUp(id));
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.handleTrayOut(id));
    const container = scene.add.container(0, 0, [panel, iconGroup, zone]);
    this.toolbar.add(container);
    return { id, container };
  }

  /**
   * The caption: the focused item's name, or the label of the focused icon-only compact Put away,
   * Back or Next, else the hint or the empty-tray message.
   */
  private captionText(compact: boolean): string {
    const focus = this.focus;
    if (focus !== null && 'id' in focus) return this.decorationOf(focus.id).name;
    if (focus?.kind === 'putAway' && compact) return PUT_AWAY_LABEL;
    if (focus?.kind === 'previousPage' && compact) return PREVIOUS_PAGE_LABEL;
    if (focus?.kind === 'nextPage' && compact) return NEXT_PAGE_LABEL;
    if (this.owned.length === 0) return NO_DECORATIONS_TO_PLACE;
    if (this.trayIds().length === 0) return ALL_DECORATIONS_PLACED;
    return DECORATE_HINT;
  }

  /** Measured full and compact sizes of the decorate controls, with `caption`. */
  private decorateSizes(caption: Size | null): DecorateSizes {
    return {
      putAway: buttonSize(this.putAwayButtons.full),
      done: buttonSize(this.doneButtons.full),
      caption,
      pageButton: buttonSize(this.previousPageButtons.full),
      compact: {
        putAway: buttonSize(this.putAwayButtons.compact),
        done: buttonSize(this.doneButtons.compact),
        pageButton: buttonSize(this.previousPageButtons.compact),
      },
    };
  }

  /** The decorate layout of the tray as it is, on the page asked for, without a caption; null before the canvas is known. */
  private trayLayout(): DecorateLayout | null {
    const view = this.view;
    const frame = this.frame;
    if (view === null || frame === null) return null;
    return decorateLayout(view, frame, this.trayIds().length, this.decorateSizes(null), this.owned.length, this.page);
  }

  /** The tray ids on the shown page of `layout`, or every tray id when there is no layout yet. */
  private pageTrayIds(layout: DecorateLayout | null): string[] {
    const ids = this.trayIds();
    return layout === null ? ids : ids.slice(layout.trayStart, layout.trayStart + layout.tray.length);
  }

  /**
   * Lays the tray page, Put away, Done, Back, Next and the caption out with decorateLayout, its look
   * held still by the owned count, keeps the page it clamps to, and shows the full or compact variant
   * of each control as it picks.
   */
  private relayoutToolbar(): void {
    const view = this.view;
    const frame = this.frame;
    const plain = this.trayLayout();
    if (view === null || frame === null || plain === null) return;
    const ids = this.trayIds();
    this.caption.setWordWrapWidth(Math.max(1, view.cssW - 2 * UI.margin), true);
    this.caption.setText(this.captionText(plain.compact));
    const captionSize = { w: this.caption.width, h: this.caption.height };
    const decorate = decorateLayout(view, frame, ids.length, this.decorateSizes(captionSize), this.owned.length, this.page);
    this.decorate = decorate;
    this.page = decorate.page;
    this.syncTray(this.pageTrayIds(decorate), decorate.compact ? COMPACT_TRAY : FULL_TRAY);
    this.trayButtons.forEach((button, index) => {
      const rect = decorate.tray[index];
      button.container.setPosition(rect.x, rect.y);
    });
    const kind = this.focus?.kind;
    placeButtonPair(this.putAwayButtons, decorate.putAway, decorate.compact, this.selection !== null, kind === 'putAway');
    placeButtonPair(this.doneButtons, decorate.done, decorate.compact, true, kind === 'done');
    placePageButtonPair(this.previousPageButtons, decorate.previousPage, decorate.compact, kind === 'previousPage');
    placePageButtonPair(this.nextPageButtons, decorate.nextPage, decorate.compact, kind === 'nextPage');
    this.caption.setVisible(decorate.caption !== null);
    if (decorate.caption !== null) this.caption.setPosition(decorate.caption.x, decorate.caption.y);
  }

  /** The toolbar layout with its button focus states (the caption follows focus), then the rings. */
  private applyFocusVisuals(): void {
    this.relayoutToolbar();
    this.drawRings();
  }

  /** Double rings round the focused tray square, the focused placed Decoration and the selection. */
  private drawRings(): void {
    this.rings.clear();
    const decorate = this.decorate;
    if (!this.active || decorate === null) return;
    const focus = this.focus;
    if (focus?.kind === 'tray') {
      const index = this.trayButtons.findIndex((button) => button.id === focus.id);
      if (index !== -1) strokeDoubleRing(this.rings, decorate.tray[index]);
    }
    const ringed = new Set<string>();
    if (focus?.kind === 'placed') ringed.add(focus.id);
    if (this.selection !== null) ringed.add(this.selection);
    for (const id of ringed) {
      const placement = placementOf(this.tankLayout, id);
      if (placement !== undefined) strokeDoubleRing(this.rings, this.footprintCss(this.decorationOf(id), placement));
    }
  }

  /** The footprint of `decoration` (its own width) at base point `pos`, in CSS px. */
  private footprintCss(decoration: Decoration, pos: Point): Rect {
    const frame = this.frame;
    const footprint = decorationFootprintFor(decoration, pos);
    if (frame === null) return footprint;
    const topLeft = tankToCss(frame, footprint);
    return { x: topLeft.x, y: topLeft.y, w: footprint.w * frame.scale, h: footprint.h * frame.scale };
  }

  /** Focus order: tray items on the shown page, Back and Next when shown, placed Decorations back to front, Put away when shown, Done. */
  private focusTargets(): FocusTarget[] {
    const layout = this.trayLayout();
    const tray = this.pageTrayIds(layout).map((id): FocusTarget => ({ kind: 'tray', id }));
    const pageTargets: FocusTarget[] = layout !== null && layout.pageCount > 1 ? [{ kind: 'previousPage' }, { kind: 'nextPage' }] : [];
    const placed = drawOrder(this.tankLayout, this.options.catalogue).map(
      (placement): FocusTarget => ({ kind: 'placed', id: placement.id }),
    );
    const putAwayTarget: FocusTarget[] = this.selection !== null ? [{ kind: 'putAway' }] : [];
    return [...tray, ...pageTargets, ...placed, ...putAwayTarget, { kind: 'done' }];
  }

  private setFocus(target: FocusTarget | null): void {
    this.focus = target;
    this.applyFocusVisuals();
  }

  private stepFocus(step: number): void {
    const targets = this.focusTargets();
    const focus = this.focus;
    const current = focus === null ? -1 : targets.findIndex((target) => focusKey(target) === focusKey(focus));
    const next = nextFocusIndex(current, targets.length, step);
    this.setFocus(next === -1 ? null : targets[next]);
  }

  private confirmFocus(): void {
    const focus = this.focus;
    if (focus === null) return;
    switch (focus.kind) {
      case 'tray':
        return this.placeFromTray(focus.id);
      case 'placed':
        return this.selectPlaced(focus.id);
      case 'previousPage':
        return this.turnPage(-1);
      case 'nextPage':
        return this.turnPage(1);
      case 'putAway':
        return this.putAwaySelected();
      case 'done':
        return this.pressDone();
    }
  }

  /** Arrows nudge a focused placed Decoration; otherwise left and right step the focus. */
  private handleArrow(direction: TankDirection): void {
    const focus = this.focus;
    if (focus?.kind === 'placed') return this.nudgePlaced(focus.id, direction);
    if (direction === 'left') return this.stepFocus(-1);
    if (direction === 'right') return this.stepFocus(1);
  }

  /** Stores a successful change's layout; false (and nothing changes) for any other result. */
  private applyChange(change: TankChange, expected: TankResult): boolean {
    if (change.result !== expected) return false;
    this.tankLayout = change.layout;
    return true;
  }

  /** Redraws after a stored change and reports the new layout. */
  private finishChange(): void {
    this.refresh();
    this.options.onLayoutChange(this.tankLayout);
  }

  /** Places a tray Decoration at the spot suggested for its kind with the place sound, then selects and focuses it. */
  private placeFromTray(id: string): void {
    if (!this.active) return;
    const { catalogue } = this.options;
    const spot = suggestSpot(this.tankLayout, id, catalogue);
    const change = placeDecoration(this.tankLayout, this.ownedIds, id, spot, catalogue);
    if (!this.applyChange(change, 'placed')) return;
    playSound('place');
    this.selection = id;
    this.focus = { kind: 'placed', id };
    this.finishChange();
  }

  private selectPlaced(id: string): void {
    if (placementOf(this.tankLayout, id) === undefined) return;
    this.selection = id;
    this.setFocus({ kind: 'placed', id });
  }

  /** Puts the selection away; the tray turns to the page of its square, and focus moves there. */
  private putAwaySelected(): void {
    const id = this.selection;
    if (!this.active || id === null) return;
    if (!this.applyChange(putAway(this.tankLayout, id), 'putAway')) return;
    this.cancelDrag();
    this.selection = null;
    const layout = this.trayLayout();
    if (layout !== null) this.page = trayPageOf(layout, this.trayIds().indexOf(id));
    this.focus = { kind: 'tray', id };
    this.finishChange();
  }

  /** Shows the tray page `step` away, wrapping past either end; focus on a square of the old page clears. */
  private turnPage(step: number): void {
    const layout = this.trayLayout();
    if (!this.active || layout === null || layout.pageCount < 2) return;
    this.page = nextFocusIndex(layout.page, layout.pageCount, step);
    this.refresh();
  }

  private pressDone(): void {
    if (!this.active) return;
    this.options.onDone();
  }

  /**
   * One keyboard step for the Decoration's kind: moves when the new base point is valid, else shows
   * the invalid ghost briefly. Up and down on a Floating or Hanging item do nothing, with no cue.
   */
  private nudgePlaced(id: string, direction: TankDirection): void {
    const placement = placementOf(this.tankLayout, id);
    if (placement === undefined) return;
    const decoration = this.decorationOf(id);
    const candidate = nudgeDecoration(decoration, placement, direction);
    if (candidate === null) return;
    if (!isValidPlacementFor(decoration, candidate)) {
      this.showGhost(id, candidate);
      this.invalidTimer = this.scene.time.delayedCall(INVALID_GHOST_MS, this.hideGhost, [], this);
      return;
    }
    if (!this.applyChange(moveDecoration(this.tankLayout, id, candidate, this.options.catalogue), 'moved')) return;
    this.hideGhost();
    this.selection = id;
    this.finishChange();
  }

  private handleTrayDown(id: string): void {
    if (this.active) this.trayPressId = id;
  }

  private handleTrayUp(id: string): void {
    const pressed = this.trayPressId === id;
    this.trayPressId = null;
    if (pressed) this.placeFromTray(id);
  }

  private handleTrayOut(id: string): void {
    if (this.trayPressId === id) this.trayPressId = null;
  }

  /** CSS point under `pointer`. */
  private pointerCss(pointer: Phaser.Input.Pointer): Point {
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x, y: point.y };
  }

  /** Selects a pressed placed Decoration and readies a drag, for the first pointer only. */
  private handleDecorationDown(id: string, pointer: Phaser.Input.Pointer): void {
    const frame = this.frame;
    const placement = placementOf(this.tankLayout, id);
    if (!this.active || this.drag !== null || frame === null || placement === undefined) return;
    this.selectPlaced(id);
    const start = this.pointerCss(pointer);
    const base = tankToCss(frame, placement);
    this.drag = {
      id,
      pointerId: pointer.id,
      start,
      grab: { x: start.x - base.x, y: start.y - base.y },
      moving: false,
      target: { x: placement.x, y: placement.y },
    };
  }

  /**
   * Moves the ghost with the drag pointer once it passes the drag threshold, snapped for the
   * Decoration's kind (Floating and Hanging stay in the top band). Passing the threshold plays the
   * pick up sound once per drag.
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    const frame = this.frame;
    if (drag === null || frame === null || pointer.id !== drag.pointerId) return;
    const point = this.pointerCss(pointer);
    if (!drag.moving && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_THRESHOLD_PX) return;
    if (!drag.moving) playSound('pickUp');
    drag.moving = true;
    const base = cssToTank(frame, { x: point.x - drag.grab.x, y: point.y - drag.grab.y });
    drag.target = snapPlacement(this.decorationOf(drag.id), base);
    this.showGhost(drag.id, drag.target);
  }

  /** Ends the drag: moves the Decoration, with the place sound, only when the ghost is at a valid base point for its kind. */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (drag === null || pointer.id !== drag.pointerId) return;
    this.cancelDrag();
    if (!drag.moving || !isValidPlacementFor(this.decorationOf(drag.id), drag.target)) return;
    const change = moveDecoration(this.tankLayout, drag.id, drag.target, this.options.catalogue);
    if (!this.applyChange(change, 'moved')) return;
    playSound('place');
    this.finishChange();
  }

  private cancelDrag(): void {
    this.drag = null;
    this.hideGhost();
  }

  /**
   * The ghost at base point `pos` (art guide 7f): the still image at half alpha at its kind's anchor,
   * inside the double focus ring round its footprint; at an invalid point also a dashed ink outline
   * round the footprint and the "no" icon.
   */
  private showGhost(id: string, pos: Point): void {
    const sprite = this.sprites.get(id);
    if (sprite === undefined) return;
    const frame = this.frame;
    const anchor = this.anchorCss(sprite.decoration, pos);
    if (frame === null || anchor === null) return;
    this.hideGhost();
    const { info, decoration } = sprite;
    this.ghostImage
      .setTexture(info.key)
      .setOrigin(info.originNormX, info.originNormY)
      .setPosition(anchor.x, anchor.y)
      .setScale(frame.scale / info.scale)
      .setVisible(true);
    const footprint = this.footprintCss(decoration, pos);
    const valid = isValidPlacementFor(decoration, pos);
    if (!valid) strokeDashedRect(this.ghostMarks, footprint);
    strokeDoubleRing(this.ghostMarks, footprint);
    this.noIcon.setPosition(footprint.x + footprint.w, footprint.y).setVisible(!valid);
  }

  private hideGhost(): void {
    this.invalidTimer?.remove(false);
    this.invalidTimer = null;
    this.ghostImage.setVisible(false);
    this.ghostMarks.clear();
    this.noIcon.setVisible(false);
  }
}
