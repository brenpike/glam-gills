import * as Phaser from 'phaser';
import { AXO_PREVIEW_CROPS, type AxolotlPose } from '../art/drawAxolotl';
import { AXO_SIZE_SCALE } from '../art/drawAxolotlParts';
import { ICON_SIZE, type IconKind } from '../art/drawUi';
import { artOutfit, outfitKey } from '../art/drawWearables';
import { INK, LW, T_STATIC, UI_PANEL, WHITE, axolotlPalette } from '../art/palette';
import { bakeAxolotlStill, type BakedTextures } from '../art/textures';
import type { PerkIconSize, TreasureTextures } from '../art/treasureTextures';
import type { AxolotlLook } from '../logic/axolotlLook';
import { CARD } from '../logic/cardFit';
import type { DreamColourId } from '../logic/catalogue';
import {
  CHANGE_OUTFIT_BUTTON,
  CHANGE_OUTFIT_LABEL,
  EXPLORER_BACK_BUTTON,
  EXPLORER_BACK_LABEL,
  EXPLORER_PAGE_MAX,
  EXPLORER_TITLE,
  GO_BUTTON,
  GO_LABEL,
  MAX_MARK_LABEL,
  MORE_AXOLOTLS_LABEL,
  chosenSummary,
  explorerCardLayout,
  explorerPageIndexes,
  goReady,
  openExplorerCard,
  reduceExplorerCard,
  withExplorerPerPage,
  type ExplorerAxolotl,
  type ExplorerCardAction,
  type ExplorerCardEffect,
  type ExplorerCardLayout,
  type ExplorerCardMeasure,
  type ExplorerCardState,
} from '../logic/explorerCard';
import type { Rect, Size } from '../logic/hudLayout';
import type { RealMorphId } from '../logic/morphs';
import type { Outfit } from '../logic/outfit';
import { NO_PERKS_TEXT, outfitSummary, type OutfitSummary, type OutfitSummaryRow } from '../logic/perks';
import { NAME_TEXT_PX, OPTION_LABEL_TEXT_PX } from '../logic/stylerUi';
import { UI, tankKeyFor } from '../logic/tankUi';
import {
  createButton,
  cssColor,
  drawPanel,
  uiTextStyle,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';

const TAU = Math.PI * 2;
const DIM_ALPHA = 0.45;
const DIM_COVER = 8192;
const SWIM_PERIOD_S = 1.2;
const GILL_PERIOD_S = 0.8;
const BOX_RADIUS = 18;
/** Double focus ring just outside the 3.5 px outline, as on the baked buttons (art guide 8). */
const RING_LINE = 3;
const RING_INNER = LW / 2 + 1.5;
const RING_OUTER = LW / 2 + 4.5;
/** Chosen axolotl: a thick ink ring just inside the outline, plus the tick badge (shape, not colour). */
const CHOSEN_RING_W = 5;
/** Tick badge on the chosen axolotl: a white disc with an ink outline and the tick icon, 13 px in from the top-right corner. */
const TICK_BADGE = Object.freeze({ r: 10, iconPx: 16, outline: 2.6, inset: 3 });
/** Room between a picture button's edge and its picture, clear of the outline. */
const PICTURE_INSET = LW + 1;
/** Outfit summary rows (art guide 8): the 24 px perk icon, 6 px, the ink 18 px text, 8 px, the max mark; rows 6 px apart. */
const SUMMARY = Object.freeze({ iconGap: 6, markGap: 8, rowGap: 6, textPx: 18 });
const SUMMARY_ICON_PX: PerkIconSize = 24;
/** The max mark: a pill, white fill, ink 2.6 outline, bold ink 18 px "max", padding 6 across, 24 px tall. */
const MAX_MARK = Object.freeze({ h: 24, padX: 6, outline: 2.6 });
/** Still pose (art guide 9): tail and gills at t = T_STATIC, eyes open. */
const STILL_POSE: AxolotlPose = Object.freeze({
  swimPhase: (TAU * T_STATIC) / SWIM_PERIOD_S,
  gillPhase: (TAU * T_STATIC) / GILL_PERIOD_S,
  blink: 1,
  tailAmp: 1,
  sparkle: 0,
});
/** Change outfit's icon: the art guide's Shirt icon (8). */
const CHANGE_OUTFIT_ICON: IconKind = 'shirt';

let explorerCardCount = 0;

/**
 * One owned axolotl on the card: the explorerCard.ts axolotl (stable id, name, worn perks) plus what
 * its picture shows: its real morph, its look, the Dream colour it wears (null for its real colour)
 * and its outfit, the Wearable id in each slot.
 */
export interface ExplorerCardAxolotl extends ExplorerAxolotl {
  readonly morph: RealMorphId;
  readonly look: AxolotlLook;
  readonly dreamColour: DreamColourId | null;
  readonly outfit: Readonly<Outfit>;
}

/** What the card shows and who hears its presses. */
export interface ExplorerCardOptions {
  /** The owned axolotls, in hub order: at least one, ids unique (else openExplorerCard throws). */
  axolotls: readonly ExplorerCardAxolotl[];
  /** The remembered explorer, chosen when the card opens; the first axolotl when null or not owned. */
  explorerId: string | null;
  /** The control focused first: Go!, or Change outfit on the return from the Outfit tab. */
  focus?: 'go' | 'changeOutfit';
  /** A new axolotl was chosen: save it as the explorer. The card stays open. */
  onChoose: (id: string) => void;
  /** Go! after the wait: start the trip with `id`. Called at most once; the card then ignores input. */
  onGo: (id: string) => void;
  /** Change outfit: open the restyle Outfit tab for `id`. Called at most once; the card then ignores input. */
  onChangeOutfit: (id: string) => void;
  /** Back or Escape: close the card. Called at most once; the card then ignores input. */
  onBack: () => void;
}

/** The parts of a keydown the card reads. */
export type ExplorerKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'repeat'>;

/** One picture button's objects: its tap area, picture, name text and tick icon. */
interface PictureSlot {
  zone: Phaser.GameObjects.Zone;
  picture: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  tick: Phaser.GameObjects.Image;
}

/** One outfit summary row's objects: the perk icon, its text and the max mark word. */
interface SummaryRowParts {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  markText: Phaser.GameObjects.Text;
}

/** A measured summary row: its size, the wrap width and size of its text, and the max mark width (0 without the mark). */
interface SummaryRowSize {
  w: number;
  h: number;
  textRoom: number;
  textW: number;
  textH: number;
  markW: number;
}

/** Summary rows placed in a block: its size and each row's top left, relative to the block. */
interface SummaryBlock {
  w: number;
  h: number;
  spots: { x: number; y: number }[];
}

/** Sets `text` to wrap at `wrapW` and returns its size. */
function wrappedSize(text: Phaser.GameObjects.Text, wrapW: number): Size {
  text.setWordWrapWidth(Math.max(1, wrapW), true);
  return { w: text.width, h: text.height };
}

/** Wraps `text` to the measured `rect` (with 1 px slack, so it breaks as measured) and centres it there. */
function placeTextIn(text: Phaser.GameObjects.Text, rect: Rect): void {
  text.setWordWrapWidth(rect.w + 1, true);
  text.setPosition(rect.x + (rect.w - text.width) / 2, rect.y + (rect.h - text.height) / 2).setVisible(true);
}

/** Strokes the double focus ring (inner white, outer ink) around a rounded box of `radius`. */
function strokeFocusRing(graphics: Phaser.GameObjects.Graphics, rect: Rect, radius: number): void {
  graphics.lineStyle(RING_LINE, cssColor(WHITE).color, 1);
  graphics.strokeRoundedRect(
    rect.x - RING_INNER,
    rect.y - RING_INNER,
    rect.w + 2 * RING_INNER,
    rect.h + 2 * RING_INNER,
    radius + RING_INNER,
  );
  graphics.lineStyle(RING_LINE, cssColor(INK).color, 1);
  graphics.strokeRoundedRect(
    rect.x - RING_OUTER,
    rect.y - RING_OUTER,
    rect.w + 2 * RING_OUTER,
    rect.h + 2 * RING_OUTER,
    radius + RING_OUTER,
  );
}

function boxRadius(rect: Rect): number {
  return Math.min(rect.h / 2, BOX_RADIUS);
}

/** Draws one box in panel style (white, ink outline), with the focus ring when `focused`. */
function drawBox(graphics: Phaser.GameObjects.Graphics, rect: Rect, focused: boolean): void {
  const radius = boxRadius(rect);
  if (focused) strokeFocusRing(graphics, rect, radius);
  graphics.fillStyle(cssColor(UI_PANEL).color, 1);
  graphics.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
  graphics.lineStyle(LW, cssColor(INK).color, 1);
  graphics.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
}

/** Strokes the chosen mark's thick ink ring just inside a box's outline. */
function strokeChosenRing(graphics: Phaser.GameObjects.Graphics, rect: Rect): void {
  const inset = LW / 2 + CHOSEN_RING_W / 2;
  graphics.lineStyle(CHOSEN_RING_W, cssColor(INK).color, 1);
  graphics.strokeRoundedRect(
    rect.x + inset,
    rect.y + inset,
    rect.w - 2 * inset,
    rect.h - 2 * inset,
    Math.max(0, boxRadius(rect) - inset),
  );
}

/** A press and release on the zone calls `onTap`. */
function createTapZone(scene: Phaser.Scene, onTap: () => void): Phaser.GameObjects.Zone {
  const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  let pressed = false;
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
    pressed = true;
  });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
    pressed = false;
  });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
    const wasPressed = pressed;
    pressed = false;
    if (wasPressed) onTap();
  });
  return zone;
}

/** Moves a tap zone over `rect` and shows it, or hides it (no presses) when `rect` is null. */
function placeZone(zone: Phaser.GameObjects.Zone, rect: Rect | null): void {
  if (rect === null) {
    zone.setVisible(false);
    return;
  }
  zone.setPosition(rect.x, rect.y).setSize(rect.w, rect.h).setVisible(true);
}

/**
 * Summary rows of `sizes` in a block no wider than `maxW`: one row to a line, or when `flowed` side
 * by side in whole rows UI.gap apart across; lines SUMMARY.rowGap apart, each row at its line's top.
 */
function summaryBlockOf(sizes: readonly Size[], maxW: number, flowed: boolean): SummaryBlock {
  const spots: { x: number; y: number }[] = [];
  let lineEnd = 0;
  let lineTop = 0;
  let lineH = 0;
  let blockW = 0;
  for (const [index, size] of sizes.entries()) {
    const startsLine = index > 0 && (!flowed || lineEnd + UI.gap + size.w > maxW);
    if (startsLine) {
      lineTop += lineH + SUMMARY.rowGap;
      lineH = 0;
    }
    const left = index === 0 || startsLine ? 0 : lineEnd + UI.gap;
    spots.push({ x: left, y: lineTop });
    lineEnd = left + size.w;
    lineH = Math.max(lineH, size.h);
    blockW = Math.max(blockW, lineEnd);
  }
  return { w: blockW, h: lineTop + lineH, spots };
}

/**
 * The explorer card (PRD F7, F10, F11, F16; art guide 8 "Explorer card"), over the Home Tank: an
 * ink dim at 0.45 that takes every press and a white panel laid out by explorerCardLayout(), with the
 * title, the owned axolotls as picture buttons (each baked once in its own look, Dream colour and
 * outfit at the still pose, with its name), More axolotls when they take more than one page, the
 * chosen axolotl's outfit summary, and Go!, Change outfit and Back. Every press, key and the Go! wait
 * go through reduceExplorerCard(); changes show at once, with no tweens or motion, so it is the same
 * under reduced motion. The chosen axolotl has a thick ink ring and a tick, the focused control the
 * double focus ring, so nothing reads by colour alone. It shows from construction; the owner destroys
 * it to leave. After Go!, Change outfit or Back it ignores further input.
 */
export class ExplorerCard {
  private readonly scene: Phaser.Scene;
  private readonly baked: BakedTextures;
  private readonly treasure: TreasureTextures;
  private readonly axolotls: readonly ExplorerCardAxolotl[];
  private readonly summaries: readonly OutfitSummary[];
  private readonly onChoose: (id: string) => void;
  private readonly onGo: (id: string) => void;
  private readonly onChangeOutfit: (id: string) => void;
  private readonly onBack: () => void;
  /** The start of every picture texture key: one texture per axolotl. */
  private readonly pictureKeyStart: string;
  /** What each baked picture texture shows, by key. Each key is baked again in place, never added twice. */
  private readonly pictureSigs = new Map<string, string>();
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly boxes: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly nameProbe: Phaser.GameObjects.Text;
  private readonly summaryProbe: Phaser.GameObjects.Text;
  private readonly maxProbe: Phaser.GameObjects.Text;
  private readonly emptyText: Phaser.GameObjects.Text;
  private readonly moreText: Phaser.GameObjects.Text;
  private readonly moreZone: Phaser.GameObjects.Zone;
  private readonly slots: PictureSlot[];
  private readonly summaryRows: SummaryRowParts[];
  private readonly goButton: UiButton;
  private readonly changeOutfitButton: UiButton;
  private readonly backButton: UiButton;
  private readonly texts: Phaser.GameObjects.Text[];
  private state: ExplorerCardState;
  private view: SceneView;
  private dpr: number;
  private placed: ExplorerCardLayout | null = null;
  private finished = false;

  constructor(scene: Phaser.Scene, assets: GameAssets, view: SceneView, depth: number, options: ExplorerCardOptions) {
    this.scene = scene;
    this.baked = assets.baked;
    this.treasure = assets.treasure;
    this.view = view;
    this.dpr = view.fit.dpr;
    this.axolotls = options.axolotls;
    this.state = openExplorerCard(options.axolotls, options.explorerId, options.focus ?? 'go');
    this.summaries = options.axolotls.map((axolotl) => outfitSummary(axolotl.worn));
    this.onChoose = options.onChoose;
    this.onGo = options.onGo;
    this.onChangeOutfit = options.onChangeOutfit;
    this.onBack = options.onBack;
    this.pictureKeyStart = `explorer-picture-${explorerCardCount++}`;

    const dim = scene.add
      .rectangle(-DIM_COVER / 2, -DIM_COVER / 2, DIM_COVER, DIM_COVER, cssColor(INK).color, DIM_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.boxes = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.title = this.addText(CARD.titlePx, true).setText(EXPLORER_TITLE);
    this.nameProbe = this.addText(OPTION_LABEL_TEXT_PX, true).setVisible(false);
    this.summaryProbe = this.addText(SUMMARY.textPx, false).setAlign('left').setVisible(false);
    this.maxProbe = this.addText(SUMMARY.textPx, true).setText(MAX_MARK_LABEL).setVisible(false);
    this.emptyText = this.addText(SUMMARY.textPx, false).setText(NO_PERKS_TEXT).setVisible(false);
    this.moreText = this.addText(NAME_TEXT_PX, true).setText(MORE_AXOLOTLS_LABEL).setVisible(false);
    this.moreZone = createTapZone(scene, () => this.dispatch({ type: 'more' }));
    this.slots = Array.from({ length: EXPLORER_PAGE_MAX }, (_unused, slotIndex) => this.createSlot(slotIndex));
    const rowCount = Math.max(0, ...this.summaries.map((summary) => summary.rows.length));
    this.summaryRows = Array.from({ length: rowCount }, () => this.createSummaryRow());
    this.goButton = this.createCardButton('primary', 'wide', GO_BUTTON.w, GO_LABEL, 'play', { type: 'go' });
    this.changeOutfitButton = this.createCardButton(
      'secondary',
      'wide',
      CHANGE_OUTFIT_BUTTON.w,
      CHANGE_OUTFIT_LABEL,
      CHANGE_OUTFIT_ICON,
      { type: 'changeOutfit' },
    );
    this.backButton = this.createCardButton('secondary', 'square', EXPLORER_BACK_BUTTON.w, EXPLORER_BACK_LABEL, 'left', {
      type: 'back',
    });
    this.texts = [
      this.title,
      this.nameProbe,
      this.summaryProbe,
      this.maxProbe,
      this.emptyText,
      this.moreText,
      ...this.slots.map((slot) => slot.nameText),
      ...this.summaryRows.flatMap((row) => [row.text, row.markText]),
    ];

    this.container = scene.add
      .container(0, 0, [
        dim,
        this.panel,
        this.boxes,
        ...this.slots.map((slot) => slot.picture),
        ...this.summaryRows.map((row) => row.icon),
        this.marks,
        ...this.slots.map((slot) => slot.tick),
        ...this.texts,
        ...this.slots.map((slot) => slot.zone),
        this.moreZone,
        this.goButton.container,
        this.changeOutfitButton.container,
        this.backButton.container,
      ])
      .setDepth(depth);
    this.layout(view);
  }

  /**
   * Handles a keydown through the card reducer: Tab and Shift+Tab move the focus, wrapping; arrows
   * move in the pictures of the page (by the layout's columns); Enter and Space press the focused
   * control, ignoring key repeat; Escape is Back. Returns true when the card took the key, false for
   * keys it does not read and after Go!, Change outfit or Back.
   */
  handleKey(event: ExplorerKeyEvent): boolean {
    if (this.finished) return false;
    const intent = tankKeyFor(event.key, event.shiftKey);
    if (intent === null || intent === 'putAway') return false;
    this.dispatch({
      type: 'key',
      key: event.key,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      columns: this.placed?.columns ?? 1,
    });
    return true;
  }

  /** Counts `deltaMs` towards the Go! wait. Call every frame from the scene update. */
  update(_time: number, deltaMs: number): void {
    if (this.finished || goReady(this.state)) return;
    this.state = reduceExplorerCard(this.state, { type: 'elapse', ms: Math.max(0, deltaMs) }).state;
  }

  /**
   * Lays the card out for `view` with explorerCardLayout() and redraws it, fitting the pictures per
   * page; picture buttons are baked again only when their size or the resolution changed.
   */
  layout(view: SceneView): void {
    this.view = view;
    this.relayout();
  }

  /** Sets the text and button resolution to `dpr`. Call layout() straight after, as a resize does, to re-bake the pictures. */
  setResolution(dpr: number): void {
    this.dpr = dpr;
    for (const text of this.texts) {
      text.setResolution(dpr);
    }
    for (const button of [this.goButton, this.changeOutfitButton, this.backButton]) {
      button.setResolution(dpr);
    }
  }

  /** Removes every object and the picture textures; the card then ignores input. */
  destroy(): void {
    this.finished = true;
    this.container.destroy();
    for (const key of this.pictureSigs.keys()) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.pictureSigs.clear();
  }

  private addText(sizePx: number, bold: boolean): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, '', { ...uiTextStyle(sizePx, this.dpr, bold), align: 'center' });
  }

  private createSlot(slotIndex: number): PictureSlot {
    const checkInfo = this.baked.icons.check;
    return {
      zone: createTapZone(this.scene, () => this.pickSlot(slotIndex)),
      picture: this.scene.add.image(0, 0, '__DEFAULT').setVisible(false),
      nameText: this.addText(OPTION_LABEL_TEXT_PX, true).setVisible(false),
      tick: this.scene.add
        .image(0, 0, checkInfo.key)
        .setOrigin(0, 0)
        .setScale(TICK_BADGE.iconPx / ICON_SIZE / checkInfo.scale)
        .setVisible(false),
    };
  }

  private createSummaryRow(): SummaryRowParts {
    const info = this.treasure.perks[SUMMARY_ICON_PX].speed;
    return {
      icon: this.scene.add.image(0, 0, info.key).setVisible(false),
      text: this.addText(SUMMARY.textPx, false).setAlign('left').setVisible(false),
      markText: this.addText(SUMMARY.textPx, true).setText(MAX_MARK_LABEL).setVisible(false),
    };
  }

  private createCardButton(
    fill: 'primary' | 'secondary',
    shape: 'wide' | 'square',
    width: number,
    label: string,
    icon: IconKind,
    action: ExplorerCardAction,
  ): UiButton {
    return createButton(this.scene, this.baked, {
      fill,
      shape,
      size: 1,
      width,
      label,
      icon,
      dpr: this.dpr,
      pressOnDown: false,
      backTap: action.type === 'back',
      onPress: () => this.dispatch(action),
    });
  }

  /** A press on the picture in page slot `slotIndex`: chooses the axolotl shown there. */
  private pickSlot(slotIndex: number): void {
    const index = explorerPageIndexes(this.state)[slotIndex];
    if (index === undefined) return;
    this.dispatch({ type: 'pick', index });
  }

  /** Runs one action through the reducer, redraws, then acts on its effect. Ignored once finished. */
  private dispatch(action: ExplorerCardAction): void {
    if (this.finished) return;
    const result = reduceExplorerCard(this.state, action);
    this.state = result.state;
    this.refresh();
    this.applyEffect(result.effect);
  }

  /** Calls the owner for an effect. Go!, Change outfit and Back finish the card first, so the owner may destroy it. */
  private applyEffect(effect: ExplorerCardEffect | undefined): void {
    if (effect === undefined) return;
    if (effect.type === 'choose') {
      this.onChoose(effect.id);
      return;
    }
    this.finished = true;
    if (effect.type === 'go') this.onGo(effect.id);
    else if (effect.type === 'changeOutfit') this.onChangeOutfit(effect.id);
    else this.onBack();
  }

  /** Width the layout wraps the title and the summary at: the canvas less the margins and the padding. */
  private bandWidth(pad: number): number {
    return Math.max(0, this.view.cssW - 2 * CARD.margin - 2 * pad);
  }

  /** The widest and tallest name label of the owned axolotls, on one line. */
  private largestName(): Size {
    this.nameProbe.setWordWrapWidth(null);
    let largest: Size = { w: 0, h: 0 };
    for (const axolotl of this.axolotls) {
      this.nameProbe.setText(axolotl.name);
      largest = { w: Math.max(largest.w, this.nameProbe.width), h: Math.max(largest.h, this.nameProbe.height) };
    }
    return largest;
  }

  /** The max mark pill width: the bold "max" plus its padding. */
  private maxMarkWidth(): number {
    return this.maxProbe.width + 2 * MAX_MARK.padX;
  }

  /** One summary row measured at `wrapW`: the icon, the text wrapped in the room left, and the max mark when capped. */
  private summaryRowSize(row: OutfitSummaryRow, wrapW: number): SummaryRowSize {
    const markW = row.capReached ? this.maxMarkWidth() : 0;
    const markRoom = row.capReached ? SUMMARY.markGap + markW : 0;
    const textRoom = Math.max(1, wrapW - SUMMARY_ICON_PX - SUMMARY.iconGap - markRoom);
    const text = wrappedSize(this.summaryProbe.setText(row.text), textRoom);
    return {
      w: SUMMARY_ICON_PX + SUMMARY.iconGap + text.w + markRoom,
      h: Math.max(SUMMARY_ICON_PX, text.h, row.capReached ? MAX_MARK.h : 0),
      textRoom,
      textW: text.w,
      textH: text.h,
      markW,
    };
  }

  /** Size of `summary` at `wrapW`: its rows stacked or flowed, or the one "No perks yet" line. */
  private summarySize(summary: OutfitSummary, wrapW: number, flowed: boolean): Size {
    if (summary.empty) return wrappedSize(this.summaryProbe.setText(NO_PERKS_TEXT), wrapW);
    const sizes = summary.rows.map((row) => this.summaryRowSize(row, wrapW));
    const block = summaryBlockOf(sizes, wrapW, flowed);
    return { w: block.w, h: block.h };
  }

  /** The widest and tallest outfit summary of the owned axolotls at `wrapW`, so the layout is the same whichever is chosen. */
  private largestSummary(wrapW: number, flowed: boolean): Size {
    let largest: Size = { w: 0, h: 0 };
    for (const summary of this.summaries) {
      const size = this.summarySize(summary, wrapW, flowed);
      largest = { w: Math.max(largest.w, size.w), h: Math.max(largest.h, size.h) };
    }
    return largest;
  }

  /** The layout measures, each wrap width measured once per layout. */
  private measureFor(): ExplorerCardMeasure {
    const titles = new Map<number, Size>();
    const summaries = new Map<string, Size>();
    const titleAt = (wrapW: number): Size => {
      const known = titles.get(wrapW) ?? wrappedSize(this.title, wrapW);
      titles.set(wrapW, known);
      return known;
    };
    const summaryAt = (wrapW: number, flowed: boolean): Size => {
      const key = `${wrapW}|${flowed}`;
      const known = summaries.get(key) ?? this.largestSummary(wrapW, flowed);
      summaries.set(key, known);
      return known;
    };
    return { titleAt, nameSize: this.largestName(), summaryAt };
  }

  /** Lays the card out, fits the pictures per page to it, places the panel, the title and the buttons, then redraws the rest. */
  private relayout(): void {
    const placed = explorerCardLayout(this.view, this.axolotls.length, this.measureFor());
    this.placed = placed;
    this.state = withExplorerPerPage(this.state, placed.perPage);
    const { panel } = placed;
    drawPanel(this.panel, panel.x, panel.y, panel.w, panel.h, UI_PANEL);
    if (placed.title === null) this.title.setVisible(false);
    else placeTextIn(this.title, placed.title);
    this.goButton.container.setPosition(placed.go.x, placed.go.y);
    this.changeOutfitButton.container.setPosition(placed.changeOutfit.x, placed.changeOutfit.y);
    this.backButton.container.setPosition(placed.back.x, placed.back.y);
    this.refresh();
  }

  /** Redraws the state: the pictures with their names and marks, More axolotls, the summary and the button focus. */
  private refresh(): void {
    const placed = this.placed;
    if (placed === null) return;
    this.boxes.clear();
    this.marks.clear();
    this.drawPictures(placed);
    this.drawMore(placed.more);
    this.drawSummary(placed);
    const focus = this.state.focus.kind;
    this.goButton.setFocused(focus === 'go');
    this.changeOutfitButton.setFocused(focus === 'changeOutfit');
    this.backButton.setFocused(focus === 'back');
  }

  /** The picture buttons of the page shown, each with its name; the chosen one has the thick ring and the tick. */
  private drawPictures(placed: ExplorerCardLayout): void {
    const indexes = explorerPageIndexes(this.state);
    for (const [slotIndex, slot] of this.slots.entries()) {
      const index = indexes[slotIndex];
      const rect = placed.pictures[slotIndex];
      const nameRect = placed.names[slotIndex];
      if (index === undefined || rect === undefined || nameRect === undefined) this.hideSlot(slot);
      else this.showPicture(slot, index, rect, nameRect);
    }
  }

  private hideSlot(slot: PictureSlot): void {
    placeZone(slot.zone, null);
    slot.picture.setVisible(false);
    slot.nameText.setVisible(false);
    slot.tick.setVisible(false);
  }

  /** The picture button of the axolotl at `index`: box, focus ring, still picture, name and chosen mark. */
  private showPicture(slot: PictureSlot, index: number, rect: Rect, nameRect: Rect): void {
    const focus = this.state.focus;
    drawBox(this.boxes, rect, focus.kind === 'axolotl' && focus.index === index);
    placeZone(slot.zone, rect);
    const key = this.bakePicture(index, rect);
    slot.picture
      .setTexture(key)
      .setOrigin(0.5, 0.5)
      .setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2)
      .setScale(1 / this.dpr)
      .setVisible(true);
    placeTextIn(slot.nameText.setText(this.axolotls[index].name), nameRect);
    this.placeTick(slot, rect, index === this.state.chosen);
  }

  /** The chosen mark on `rect`: the thick ink ring and the tick badge 13 px in from the top-right corner; else none. */
  private placeTick(slot: PictureSlot, rect: Rect, chosen: boolean): void {
    slot.tick.setVisible(chosen);
    if (!chosen) return;
    strokeChosenRing(this.marks, rect);
    const offset = TICK_BADGE.inset + TICK_BADGE.r;
    const centre = { x: rect.x + rect.w - offset, y: rect.y + offset };
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, TICK_BADGE.r);
    this.marks.lineStyle(TICK_BADGE.outline, cssColor(INK).color, 1).strokeCircle(centre.x, centre.y, TICK_BADGE.r);
    slot.tick.setPosition(centre.x - TICK_BADGE.iconPx / 2, centre.y - TICK_BADGE.iconPx / 2);
  }

  /** More axolotls when the pictures take more than one page, else none. */
  private drawMore(rect: Rect | null): void {
    placeZone(this.moreZone, rect);
    if (rect === null) {
      this.moreText.setVisible(false);
      return;
    }
    drawBox(this.boxes, rect, this.state.focus.kind === 'more');
    placeTextIn(this.moreText, rect);
  }

  /**
   * The chosen axolotl's outfit summary in the layout's summary rect, wrapped at the width the layout
   * measured it at and centred across the rect: a row per perk type, or "No perks yet". None when the
   * layout hides it.
   */
  private drawSummary(placed: ExplorerCardLayout): void {
    for (const row of this.summaryRows) {
      this.hideSummaryRow(row);
    }
    this.emptyText.setVisible(false);
    const rect = placed.summary;
    if (rect === null) return;
    const summary = chosenSummary(this.state);
    const wrapW = this.bandWidth(placed.pad);
    if (summary.empty) {
      const size = wrappedSize(this.emptyText, wrapW);
      this.emptyText.setPosition(rect.x + (rect.w - size.w) / 2, rect.y).setVisible(true);
      return;
    }
    const sizes = summary.rows.map((row) => this.summaryRowSize(row, wrapW));
    const block = summaryBlockOf(sizes, wrapW, placed.summaryFlowed);
    const left = rect.x + (rect.w - block.w) / 2;
    summary.rows.forEach((row, rowIndex) => {
      const spot = block.spots[rowIndex];
      this.placeSummaryRow(this.summaryRows[rowIndex], row, sizes[rowIndex], left + spot.x, rect.y + spot.y);
    });
  }

  private hideSummaryRow(row: SummaryRowParts): void {
    row.icon.setVisible(false);
    row.text.setVisible(false);
    row.markText.setVisible(false);
  }

  /** One summary row with its top left at (`x`, `y`): the perk icon, the text and, when capped, the max mark pill. */
  private placeSummaryRow(parts: SummaryRowParts, row: OutfitSummaryRow, size: SummaryRowSize, x: number, y: number): void {
    const info = this.treasure.perks[SUMMARY_ICON_PX][row.type];
    parts.icon
      .setTexture(info.key)
      .setOrigin(info.originNormX, info.originNormY)
      .setScale(1 / info.scale)
      .setPosition(x + SUMMARY_ICON_PX / 2, y + size.h / 2)
      .setVisible(true);
    const textX = x + SUMMARY_ICON_PX + SUMMARY.iconGap;
    parts.text.setText(row.text).setWordWrapWidth(size.textRoom, true);
    parts.text.setPosition(textX, y + (size.h - size.textH) / 2).setVisible(true);
    if (!row.capReached) return;
    const markX = textX + size.textW + SUMMARY.markGap;
    const markY = y + (size.h - MAX_MARK.h) / 2;
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillRoundedRect(markX, markY, size.markW, MAX_MARK.h, MAX_MARK.h / 2);
    this.marks
      .lineStyle(MAX_MARK.outline, cssColor(INK).color, 1)
      .strokeRoundedRect(markX, markY, size.markW, MAX_MARK.h, MAX_MARK.h / 2);
    parts.markText.setPosition(markX + MAX_MARK.padX, markY + (MAX_MARK.h - parts.markText.height) / 2).setVisible(true);
  }

  /**
   * The texture key of the picture of the axolotl at `index`, baked first when it would show something
   * new: the whole axolotl in its look, morph, Dream colour and outfit at the still pose,
   * sized to fill the button inside its outline at the device pixel ratio, drawn at its size factor
   * (AXO_SIZE_SCALE) so axolotls of different Sizes look different. One key per axolotl, kept
   * until destroy(), so a page turn or a choice bakes nothing.
   */
  private bakePicture(index: number, rect: Rect): string {
    const axolotl = this.axolotls[index];
    const key = `${this.pictureKeyStart}-${index}`;
    const crop = AXO_PREVIEW_CROPS.whole;
    const inner = Math.max(1, rect.w - 2 * PICTURE_INSET);
    const scale = (inner / Math.max(crop.maxX - crop.minX, crop.maxY - crop.minY)) * this.dpr;
    const outfit = artOutfit(axolotl.outfit);
    const sig = JSON.stringify([axolotl.look, axolotl.morph, axolotl.dreamColour, outfitKey(outfit), scale]);
    if (this.pictureSigs.get(key) === sig) return key;
    bakeAxolotlStill(this.scene, key, {
      look: axolotl.look,
      palette: axolotlPalette(axolotl.morph, axolotl.dreamColour),
      pose: STILL_POSE,
      crop,
      scale,
      sizeFactor: AXO_SIZE_SCALE[axolotl.look.size],
      outfit,
    });
    this.pictureSigs.set(key, sig);
    return key;
  }
}
