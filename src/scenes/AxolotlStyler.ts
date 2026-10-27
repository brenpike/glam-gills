import * as Phaser from 'phaser';
import { createAxolotlRigBake, createAxolotlRigView, type AxolotlRigBake, type AxolotlRigView } from '../art/axolotlRig';
import type { TexSize } from '../art/canvasKit';
import { AXO_PREVIEW_CROPS, AXO_SCENE_SCALE, AXO_TEX, drawAxolotl, type AxolotlPose } from '../art/drawAxolotl';
import { AXO_SIZE_SCALE, type Bounds } from '../art/drawAxolotlParts';
import { dreamSheenAt } from '../art/drawDreamOverlay';
import { dreamSwatchTextureSize, paintDreamSwatch } from '../art/drawTreasures';
import { BUTTON_PRESS_OFFSET, ICON_SIZE, NAME_FIELD, type IconKind } from '../art/drawUi';
import { NO_OUTFIT, artOutfit, outfitKey, wornSlug, type ArtOutfit } from '../art/drawWearables';
import type { MorphTextures } from '../art/morphTextures';
import { OUTFIT_SLOT_CROPS, slotFootprintPaths } from '../art/outfitSlots';
import { HOME_TANK_WALL, INK, LW, T_STATIC, UI_PANEL, WHITE, axolotlPalette, type MorphPalette } from '../art/palette';
import {
  bake,
  bakeAxolotlStill,
  bakeSizedButton,
  buttonKey,
  iconKey,
  type BakedTextures,
  type ButtonFill,
  type ButtonShape,
  type ButtonVisual,
  type TexInfo,
} from '../art/textures';
import type { TreasureTextures } from '../art/treasureTextures';
import type { AxolotlLook, AxolotlSex, LookField } from '../logic/axolotlLook';
import { NAME_FIELD_RAW_MAX, fitNameEdit, suggestedNamesFor } from '../logic/axolotlNames';
import {
  WEARABLE_SLOTS,
  treasureById,
  type DreamColourId,
  type Perk,
  type PerkType,
  type Wearable,
  type WearableSlot,
} from '../logic/catalogue';
import { MAX_DREAM_OPTIONS, REAL_COLOUR_OPTION_ID } from '../logic/dreamPaint';
import { MAX_MARK_LABEL } from '../logic/explorerCard';
import { surprisePressed } from '../logic/homeSounds';
import type { Rect, Size } from '../logic/hudLayout';
import { morphById, type RealMorphId } from '../logic/morphs';
import type { MotionProfile } from '../logic/motion';
import { wornIds, type Outfit } from '../logic/outfit';
import { NO_PERKS_TEXT, PERK_ORDER, outfitSummary } from '../logic/perks';
import {
  NO_WEARABLE_OPTION_ID,
  chosenIndex,
  outfitOptionCount,
  reduceStyler,
  restyleStart,
  setName,
  stepIndex,
  stepOptions,
  withDreamsPerPage,
  withNamesPerPage,
  withOutfitPerPage,
  withTabsHidden,
  type RestyleOptions,
  type StylerAction,
  type StylerAxolotl,
  type StylerEffect,
  type StylerMode,
  type StylerOption,
  type StylerState,
} from '../logic/styler';
import { MAX_STEP_OPTIONS, RESTYLE_STEPS, STYLER_STEPS, stepLookField, type StylerStep } from '../logic/stylerSteps';
import {
  BACK_LABEL,
  BACK_TO_SLOTS_LABEL,
  CANCEL_LABEL,
  DONE_LABEL,
  MORE_COLOURS_LABEL,
  MORE_NAMES_LABEL,
  MORE_SLOTS_LABEL,
  MORE_WEARABLES_LABEL,
  NAME_FIELD_LABEL,
  NAME_PLACEHOLDER,
  NEXT_LABEL,
  SURPRISE_ME_LABEL,
  outfitHelper,
  outfitSlotCaption,
  stepHeading,
  stepHelper,
  stepTabLabel,
  stepTitle,
} from '../logic/stylerText';
import { perkText } from '../logic/treasureChest';
import {
  BACK_BUTTON,
  BACK_TO_SLOTS_BUTTON,
  CANCEL_BUTTON,
  CAPTION_TEXT_PX,
  DONE_BUTTON,
  HEADING_TEXT_PX,
  HELPER_TEXT_PX,
  NAME_CURSOR,
  NAME_PENCIL_PX,
  NAME_TEXT_PX,
  NEXT_BUTTON,
  OPTION_LABEL_TEXT_PX,
  PAGE_BUTTON_PX,
  SURPRISE_BUTTON,
  TAB_TEXT_PX,
  nameBoxParts,
  nameCursorShown,
  stylerLayout,
  type StylerLayout,
  type StylerMeasure,
  type StylerNav,
  type StylerPreview,
  type StylerScreen,
} from '../logic/stylerUi';
import { tankKeyFor } from '../logic/tankUi';
import { playSound } from '../platform/soundPlayer';
import { openTextEntry, type TextEntry, type TextEntryRect } from '../platform/textEntry';
import {
  blinkAt,
  createButton,
  cssColor,
  drawPanel,
  uiTextStyle,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';

const TAU = Math.PI * 2;
const BACKDROP_COVER = 8192;
const MAX_STEP_S = 0.05;
const SWIM_PERIOD_S = 1.2;
const GILL_PERIOD_S = 0.8;
const BOX_RADIUS = 18;
/** The largest size scale (art guide 6o): the preview always has room for it. */
const PREVIEW_LARGEST_SIZE = Math.max(...Object.values(AXO_SIZE_SCALE));
/** Double focus ring just outside the 3.5 px outline, as on the baked buttons (art guide 8). */
const RING_LINE = 3;
const RING_INNER = LW / 2 + 1.5;
const RING_OUTER = LW / 2 + 4.5;
/** Chosen option: a thick ink ring just inside the outline, plus the tick badge (shape, not colour). */
const CHOSEN_RING_W = 5;
/** Tick badge on the chosen option: a white disc with an ink outline and the tick icon. */
const TICK_BADGE = Object.freeze({ r: 10, iconPx: 16, outline: 2.6, inset: 3, overhang: 2 });
/** Room between a picture button's edge and its picture, clear of the outline. */
const PICTURE_INSET = LW + 1;
/** The Colour step's morph badge: 24 px, inside the picture button's lower-left corner. */
const MORPH_BADGE_PX = 24;
const MORPH_BADGE_INSET = 4;
/** The Boy or girl step's symbol, in the morph badge's spot: a white disc with an ink ring and the boy or girl icon. */
const SEX_SYMBOL = Object.freeze({ r: 12, outline: 2.6, iconPx: 18 });
/** Progress dots (creator): done is a filled dot, current a bigger ring with a filled centre, to-come a hollow ring. */
const DOT = Object.freeze({ doneR: 4.5, comeR: 4, comeLine: 2, currentR: 5.75, currentLine: 2.5, centreR: 2.5 });
/** The current restyle tab's thick ink bar, inside the tab's bottom edge. */
const TAB_BAR = Object.freeze({ h: 5, inset: 8, bottom: 4 });
/** Still pose (art guide 9): tail and gills at t = T_STATIC, eyes open. */
const STILL_POSE: AxolotlPose = Object.freeze({
  swimPhase: (TAU * T_STATIC) / SWIM_PERIOD_S,
  gillPhase: (TAU * T_STATIC) / GILL_PERIOD_S,
  blink: 1,
  tailAmp: 1,
  sparkle: 0,
});
/**
 * The perk line and the outfit summary (art guide 8): the 24 px perk icon, 6 px, then the text; summary
 * rows 6 px apart, or flowed side by side 12 px apart across; the max mark 8 px after the text, a pill
 * 24 px tall with 6 px of padding across and a 2.6 ink outline.
 */
const PERK_ROW = Object.freeze({ iconPx: 24, gap: 6, rowGap: 6, flowGap: 12, maxGap: 8, maxH: 24, maxPad: 6, maxOutline: 2.6 });
/** A worn slot's perk badge (art guide 8): a white disc r 12 with an ink ring 2.6 and the 18 px perk icon. */
const PERK_DISC = Object.freeze({ r: 12, outline: 2.6, iconPx: 18 });
/**
 * An empty slot's plus badge (art guide 8): a white disc r 10 with an ink ring 2.6 and the 16 px plus icon,
 * two strokes 18 long and 4.5 wide in the 32 icon box, so 9 long and 2.25 wide at 16 px.
 */
const PLUS_BADGE = Object.freeze({ r: 10, outline: 2.6, halfLength: 4.5, ink: 2.25 });
/** The empty-slot cue (art guide 8): the slot's footprint as an opaque dashed ink outline, in local units. */
const EMPTY_SLOT_CUE = Object.freeze({ ink: 2, dash: 3, gap: 3 });
/** What the preview and the pictures wear in the creator: nothing. */
const NO_PREVIEW_OUTFIT = Object.freeze({ art: NO_OUTFIT, key: outfitKey(NO_OUTFIT) });

let stylerCount = 0;

/** What Done hands back: the finished name, look and morph, the Dream colour (null for none) and the outfit. */
export type StyledAxolotl = StylerAxolotl & { readonly dreamColour: DreamColourId | null; readonly outfit: Outfit };

/**
 * How the styler is used, and who hears when it finishes. The RestyleOptions (`banked`, `wearers`,
 * `startStep`) go to restyleStart() with an axolotl handed in as `initial`; a whole state handed in
 * already holds them, so they must then be left out.
 */
export interface AxolotlStylerOptions extends RestyleOptions {
  /** The step-by-step character creator, or restyling an owned axolotl (adds tabs, Cancel and Escape). */
  mode: StylerMode;
  /** The current motion profile, read every frame, so turning reduced motion on stills the preview at once. */
  motion: () => MotionProfile;
  /**
   * Where the styler starts. Restyle: the owned axolotl's name, look, morph and outfit (it starts with
   * restyleStart()). The creator: a creatorStart() state; a restyle may pass a restyleStart() state too.
   */
  initial: StylerAxolotl | StylerState;
  /**
   * Done: the finished name, look, morph (the initial morph in restyle), Dream colour and outfit (empty
   * in the creator; a Wearable in it that another axolotl wears is for the owner to take off that one).
   * Called at most once.
   */
  onDone: (axolotl: StyledAxolotl) => void;
  /** Cancel or Escape in restyle: leave without keeping changes. Required in restyle. Called at most once. */
  onCancel?: () => void;
}

/** The parts of a keydown the styler reads. */
export type StylerKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'repeat'>;

/** A step button and how it is drawn. */
type NavControl = keyof StylerNav;

interface NavSpec {
  fill: ButtonFill;
  shape: ButtonShape;
  size: Size;
  label: string;
  icon: IconKind;
}

const NAV_SPECS: Readonly<Record<NavControl, NavSpec>> = Object.freeze({
  back: { fill: 'secondary', shape: 'square', size: BACK_BUTTON, label: BACK_LABEL, icon: 'left' },
  next: { fill: 'primary', shape: 'wide', size: NEXT_BUTTON, label: NEXT_LABEL, icon: 'right' },
  done: { fill: 'primary', shape: 'wide', size: DONE_BUTTON, label: DONE_LABEL, icon: 'check' },
  surprise: { fill: 'secondary', shape: 'square', size: SURPRISE_BUTTON, label: SURPRISE_ME_LABEL, icon: 'surprise' },
  cancel: { fill: 'secondary', shape: 'square', size: CANCEL_BUTTON, label: CANCEL_LABEL, icon: 'close' },
});

const NAV_CONTROLS: Readonly<Record<StylerMode, readonly NavControl[]>> = Object.freeze({
  creator: ['back', 'surprise', 'next', 'done'],
  restyle: ['surprise', 'cancel', 'done'],
});

/** A 48 px chevron page button: a secondary body with a left or right chevron, no label. */
interface Chevron {
  container: Phaser.GameObjects.Container;
  /** Shows the chevron and takes presses, or hides it and ignores them. */
  setEnabled(enabled: boolean): void;
}

/**
 * One option button's objects: its tap area, picture, label, name text, tick, morph badge (or a worn
 * slot's perk icon) and sex symbol, and an Outfit choice's perk line (icon and text) and "On <name>" mark.
 */
interface OptionSlot {
  zone: Phaser.GameObjects.Zone;
  picture: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  tick: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image;
  symbol: Phaser.GameObjects.Image;
  perkIcon: Phaser.GameObjects.Image;
  perkText: Phaser.GameObjects.Text;
  wornOnText: Phaser.GameObjects.Text;
}

/** An Outfit choice's label block (art guide 8): the name, the perk (none for None) and the "On <name>" mark. */
interface LabelBlock {
  name: string;
  perk: Perk | null;
  wornOn: string | null;
}

/** The texts a label block is set on: the bold name, the perk text and the bold "On <name>" mark. */
interface LabelBlockTexts {
  name: Phaser.GameObjects.Text;
  perk: Phaser.GameObjects.Text;
  wornOn: Phaser.GameObjects.Text;
}

/** One line of a label block: its top and size, from the block's top. */
interface BlockLine {
  y: number;
  w: number;
  h: number;
}

/** A label block wrapped at a width: its size, the name line, the perk line (with its text size) and the mark line. */
interface LabelBlockLayout {
  size: Size;
  name: BlockLine;
  perk: (BlockLine & { text: Size }) | null;
  wornOn: BlockLine | null;
}

/** One outfit summary row: the perk type (null for "No perks yet", which has no icon), its text and the max mark. */
interface SummaryRowSpec {
  type: PerkType | null;
  text: string;
  max: boolean;
}

/** One outfit summary row's objects: its 24 px perk icon, its text and the word in its max mark. */
interface SummaryRowParts {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  maxText: Phaser.GameObjects.Text;
}

/** Sets `text` to wrap at `wrapW` and returns its size. */
function wrappedSize(text: Phaser.GameObjects.Text, wrapW: number): Size {
  text.setWordWrapWidth(Math.max(1, wrapW), true);
  return { w: text.width, h: text.height };
}

/** The largest size of each of `strings` set on `text` and wrapped at `wrapW`; zero when there are none. */
function largestWrapped(text: Phaser.GameObjects.Text, strings: readonly string[], wrapW: number): Size {
  let largest: Size = { w: 0, h: 0 };
  for (const value of strings) {
    text.setText(value);
    const size = wrappedSize(text, wrapW);
    largest = { w: Math.max(largest.w, size.w), h: Math.max(largest.h, size.h) };
  }
  return largest;
}

/** The width of the longest word of `strings` set unwrapped on `text`. */
function longestWordWidth(text: Phaser.GameObjects.Text, strings: readonly string[]): number {
  text.setWordWrapWidth(null);
  let widest = 0;
  for (const word of strings.flatMap((value) => value.split(/\s+/))) {
    widest = Math.max(widest, text.setText(word).width);
  }
  return widest;
}

/** Wraps `text` to the measured `rect` (with 1 px slack, so it breaks as measured) and centres it there. */
function placeTextIn(text: Phaser.GameObjects.Text, rect: Rect): void {
  text.setWordWrapWidth(rect.w + 1, true);
  text.setPosition(rect.x + (rect.w - text.width) / 2, rect.y + (rect.h - text.height) / 2).setVisible(true);
}

/** Wraps `text` to `rect` (with 1 px slack) and places it at the left edge of `rect`, centred down it. */
function placeTextLeftIn(text: Phaser.GameObjects.Text, rect: Rect): void {
  text.setWordWrapWidth(rect.w + 1, true);
  text.setPosition(rect.x, rect.y + (rect.h - text.height) / 2).setVisible(true);
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

/**
 * Draws the name box (NAME_FIELD): the fill, the inset band along the top and left inside the outline,
 * then the ink outline, with the focus ring when `focused`.
 */
function drawNameBox(graphics: Phaser.GameObjects.Graphics, rect: Rect, focused: boolean): void {
  const { radius, insetW, outlineW } = NAME_FIELD;
  if (focused) strokeFocusRing(graphics, rect, radius);
  const edge = outlineW / 2;
  const innerR = Math.max(0, radius - edge);
  const inner: Rect = { x: rect.x + edge, y: rect.y + edge, w: rect.w - 2 * edge, h: rect.h - 2 * edge };
  graphics.fillStyle(cssColor(NAME_FIELD.inset).color, 1);
  graphics.fillRoundedRect(inner.x, inner.y, inner.w, inner.h, innerR);
  graphics.fillStyle(cssColor(NAME_FIELD.fill).color, 1);
  graphics.fillRoundedRect(inner.x + insetW, inner.y + insetW, inner.w - insetW, inner.h - insetW, innerR);
  graphics.lineStyle(outlineW, cssColor(NAME_FIELD.outline).color, 1);
  graphics.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
}

/** The Colour step's morph badge spot (and the Boy or girl step's symbol): inside a picture button's lower-left corner. */
function cornerBadgeRect(rect: Rect): Rect {
  return {
    x: rect.x + MORPH_BADGE_INSET,
    y: rect.y + rect.h - MORPH_BADGE_INSET - MORPH_BADGE_PX,
    w: MORPH_BADGE_PX,
    h: MORPH_BADGE_PX,
  };
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

/**
 * The tick badge centre: inside the top-right corner of a picture button, or over the top-right
 * corner of a name button, where it stays clear of the name.
 */
function tickCentre(rect: Rect, inside: boolean): { x: number; y: number } {
  if (!inside) return { x: rect.x + rect.w - TICK_BADGE.overhang, y: rect.y + TICK_BADGE.overhang };
  const offset = TICK_BADGE.inset + TICK_BADGE.r;
  return { x: rect.x + rect.w - offset, y: rect.y + offset };
}

/**
 * The picture crop for a step (art guide 6l, 6m): the face for Eyes and Mouth, the gills for Gills, the
 * spotted flank for Spots, else the whole axolotl.
 */
function pictureCropOf(step: StylerStep): keyof typeof AXO_PREVIEW_CROPS {
  if (step === 'eyes' || step === 'mouth') return 'face';
  if (step === 'spots') return 'spots';
  return step === 'gills' ? 'gills' : 'whole';
}

/** `look` with `field` set to the option `id` (an id of LOOK_FIELD_OPTIONS[field]). */
function lookWithOption(look: AxolotlLook, field: LookField, id: string): AxolotlLook {
  return { ...look, [field]: id } as AxolotlLook;
}

/** Texture px per local unit for a picture of `crop` filling `rect` inside its outline, at the device pixel ratio `dpr`. */
function pictureScaleOf(crop: Bounds, rect: Rect, dpr: number): number {
  const inner = Math.max(1, rect.w - 2 * PICTURE_INSET);
  return (inner / Math.max(crop.maxX - crop.minX, crop.maxY - crop.minY)) * dpr;
}

/** The texture frame of `crop`: its size, with local (0, 0) as the anchor. */
function cropFrame(crop: Bounds): TexSize {
  return { w: crop.maxX - crop.minX, h: crop.maxY - crop.minY, originX: -crop.minX, originY: -crop.minY };
}

/** The catalogue Wearable `id`. Throws when `id` is unknown or not a Wearable. */
function wearableOf(id: string): Wearable {
  const treasure = treasureById(id);
  if (treasure?.category !== 'wearable') throw new Error(`AxolotlStyler: not a Wearable: ${id}`);
  return treasure;
}

/** Strokes the empty-slot cue of `slot` on `look`: its footprint as an opaque dashed ink outline (art guide 8). */
function strokeEmptySlotCue(ctx: CanvasRenderingContext2D, slot: WearableSlot, look: AxolotlLook): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 1;
  ctx.lineWidth = EMPTY_SLOT_CUE.ink;
  ctx.lineJoin = 'round';
  ctx.setLineDash([EMPTY_SLOT_CUE.dash, EMPTY_SLOT_CUE.gap]);
  for (const path of slotFootprintPaths(slot, look, EMPTY_SLOT_CUE.ink / 2)) ctx.stroke(path);
  ctx.restore();
}

/** The Outfit picture of one slot: the axolotl at the still pose wearing `outfit`, with the empty-slot cue of `cueSlot`. */
function paintOutfitPicture(
  ctx: CanvasRenderingContext2D,
  look: AxolotlLook,
  palette: MorphPalette,
  outfit: ArtOutfit,
  cueSlot: WearableSlot | null,
): void {
  drawAxolotl(ctx, STILL_POSE, palette, look, outfit);
  if (cueSlot !== null) strokeEmptySlotCue(ctx, cueSlot, look);
}

/**
 * Sets `block` on `texts` wrapped at `wrapW` and stacks its lines: the name, then the perk line (the
 * 24 px icon, 6 px, the perk text wrapped in the room left, centred down a line as tall as the taller),
 * then the "On <name>" mark.
 */
function arrangeLabelBlock(texts: LabelBlockTexts, block: LabelBlock, wrapW: number): LabelBlockLayout {
  const nameSize = wrappedSize(texts.name.setText(block.name), wrapW);
  const name: BlockLine = { y: 0, ...nameSize };
  let bottom = name.h;
  let perk: LabelBlockLayout['perk'] = null;
  if (block.perk !== null) {
    const indent = PERK_ROW.iconPx + PERK_ROW.gap;
    const text = wrappedSize(texts.perk.setText(perkText(block.perk)), wrapW - indent);
    perk = { y: bottom, w: indent + text.w, h: Math.max(PERK_ROW.iconPx, text.h), text };
    bottom += perk.h;
  }
  let wornOn: BlockLine | null = null;
  if (block.wornOn !== null) {
    wornOn = { y: bottom, ...wrappedSize(texts.wornOn.setText(block.wornOn), wrapW) };
    bottom += wornOn.h;
  }
  const w = Math.max(name.w, perk?.w ?? 0, wornOn?.w ?? 0);
  return { size: { w, h: bottom }, name, perk, wornOn };
}

/** The largest size of each of `blocks` set on `texts` and wrapped at `wrapW`; zero when there are none. */
function largestBlock(texts: LabelBlockTexts, blocks: readonly LabelBlock[], wrapW: number): Size {
  let largest: Size = { w: 0, h: 0 };
  for (const block of blocks) {
    const { size } = arrangeLabelBlock(texts, block, wrapW);
    largest = { w: Math.max(largest.w, size.w), h: Math.max(largest.h, size.h) };
  }
  return largest;
}

/**
 * Places rows of `sizes` from (0, 0): one under another `PERK_ROW.rowGap` apart, or when `flowed` side
 * by side `PERK_ROW.flowGap` apart in whole rows that fit `wrapW`. Returns each row's rect and the size.
 */
function arrangeRows(sizes: readonly Size[], wrapW: number, flowed: boolean): { rects: Rect[]; size: Size } {
  const rects: Rect[] = [];
  let lineEnd = 0;
  let lineTop = 0;
  let lineH = 0;
  let width = 0;
  for (const size of sizes) {
    const startsLine = rects.length === 0 || !flowed || lineEnd + PERK_ROW.flowGap + size.w > wrapW;
    if (startsLine && rects.length > 0) {
      lineTop += lineH + PERK_ROW.rowGap;
      lineH = 0;
    }
    const x = startsLine ? 0 : lineEnd + PERK_ROW.flowGap;
    rects.push({ x, y: lineTop, w: size.w, h: size.h });
    lineEnd = x + size.w;
    lineH = Math.max(lineH, size.h);
    width = Math.max(width, lineEnd);
  }
  return { rects, size: { w: width, h: lineTop + lineH } };
}

/** Draws the plus badge of an empty slot on `graphics`: a white disc, an ink ring and the plus centred at `centre`. */
function drawPlusBadge(graphics: Phaser.GameObjects.Graphics, centre: { x: number; y: number }): void {
  const ink = cssColor(INK).color;
  graphics.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, PLUS_BADGE.r);
  graphics.lineStyle(PLUS_BADGE.outline, ink, 1).strokeCircle(centre.x, centre.y, PLUS_BADGE.r);
  const half = PLUS_BADGE.halfLength + PLUS_BADGE.ink / 2;
  const cap = PLUS_BADGE.ink / 2;
  graphics.fillStyle(ink, 1);
  graphics.fillRoundedRect(centre.x - cap, centre.y - half, PLUS_BADGE.ink, 2 * half, cap);
  graphics.fillRoundedRect(centre.x - half, centre.y - cap, 2 * half, PLUS_BADGE.ink, cap);
}

/** True when the styler was handed a whole state (creatorStart or restyleStart), not only an axolotl. */
function isStylerState(initial: StylerAxolotl | StylerState): initial is StylerState {
  return 'step' in initial;
}

/**
 * The starting state for `options`: the state handed in, or a restyle of the axolotl handed in with the
 * RestyleOptions. Throws when a whole state comes with RestyleOptions, which it already holds.
 */
function startStateOf(options: AxolotlStylerOptions): StylerState {
  const { initial, mode, banked, wearers, startStep } = options;
  if (isStylerState(initial)) {
    if (initial.mode !== mode) throw new Error(`AxolotlStyler: a ${initial.mode} state in ${mode} mode`);
    if (banked !== undefined || wearers !== undefined || startStep !== undefined) {
      throw new Error('AxolotlStyler: restyle options with a whole state, which already holds them');
    }
    return initial;
  }
  if (mode === 'restyle') return restyleStart(initial, [], { banked, wearers, startStep });
  throw new Error('AxolotlStyler: the creator starts from a creatorStart() state');
}

/** The layout key of `screen`: a change lays the screen out again. On Outfit it holds the view and the open slot. */
function screenKeyOf(screen: StylerScreen, outfitSlot: WearableSlot): string {
  const outfit = screen.outfitView === undefined ? '' : `|${screen.outfitView}|${outfitSlot}`;
  return `${screen.mode}|${screen.step}|${screen.optionCount}|${screen.tabPage}${outfit}`;
}

/** A press and release on the zone calls `onTap`, inside the pointer handler (so a text field can open). */
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
 * Builds a PAGE_BUTTON_PX square chevron button at (0, 0): the secondary body baked at that size (with
 * its pressed visual) and the 32 px chevron icon centred on it. Presses on release, as createButton does.
 */
function createChevron(scene: Phaser.Scene, baked: BakedTextures, icon: 'left' | 'right', onPress: () => void): Chevron {
  const bakeScale = baked.info[buttonKey('secondary', 'square', 'normal')].scale;
  const bodies = bakeSizedButton(scene, 'secondary', PAGE_BUTTON_PX, PAGE_BUTTON_PX, bakeScale);
  const body = scene.add
    .image(0, 0, bodies.normal.key)
    .setOrigin(bodies.normal.originNormX, bodies.normal.originNormY)
    .setScale(1 / bodies.normal.scale);
  const iconImage = scene.add
    .image(0, 0, iconKey(icon))
    .setOrigin(0, 0)
    .setScale(1 / baked.icons[icon].scale);
  const container = scene.add.container(0, 0, [body, iconImage]);
  const inset = (PAGE_BUTTON_PX - ICON_SIZE) / 2;
  let pressed = false;

  const refresh = (): void => {
    const visual: ButtonVisual = pressed ? 'pressed' : 'normal';
    body.setTexture(bodies[visual].key);
    iconImage.setPosition(inset, inset + (pressed ? BUTTON_PRESS_OFFSET : 0));
  };
  const release = (): void => {
    pressed = false;
    refresh();
  };
  const handleDown = (): void => {
    pressed = true;
    refresh();
  };
  const handleUp = (): void => {
    const wasPressed = pressed;
    release();
    if (wasPressed) onPress();
  };

  body.setInteractive({ useHandCursor: true });
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, handleDown);
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, handleUp);
  body.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
  refresh();

  return {
    container,
    setEnabled(enabled: boolean): void {
      if (enabled === container.visible) return;
      container.setVisible(enabled);
      if (!enabled) release();
    },
  };
}

/** Shows `badge`, or hides it when `info` or `rect` is null, centred in `rect` at its logical size. */
function placeBadge(badge: Phaser.GameObjects.Image, info: TexInfo | null, rect: Rect | null): void {
  if (info === null || rect === null) {
    badge.setVisible(false);
    return;
  }
  badge
    .setTexture(info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2)
    .setVisible(true);
}

/**
 * The axolotl styler, shared by the step-by-step character creator (PRD F1 to F3, F17) and the
 * restyle screen (PRD F6): an opaque #fff1d6 backdrop that takes every press and a white panel laid
 * out by stylerLayout(). Each step screen has its heading, the progress dots (creator) or the tab row
 * (restyle), the helper line, the live preview and the step's picture buttons (or, on Name, the name
 * box, the suggested names and More names), then Back, Next or Done, Surprise me, and Cancel in
 * restyle. Every press and key goes through reduceStyler(); changes show at once, with no tweens.
 * Each picture button is a still bake of the look so far with its option applied, repainted only
 * when the look, morph or draft outfit changes. Each step keeps its pictures until the styler is destroyed, so
 * going back to a step re-bakes only the pictures that changed. The chosen option has a thick ink ring and a tick; the focused
 * control the double focus ring (PRD F16). The preview idles, and is a still pose under reduced
 * motion. After Done or Cancel the styler ignores further input; the owner destroys it.
 * The restyle Outfit tab (PRD C10, F8 to F11; art guide 8) shows the axolotl in its draft outfit, in
 * the preview and in every picture of its slots view and choices view; every other restyle step's
 * preview and pictures wear the draft outfit too, and the creator draws none. Each slot picture is the slot's crop wearing the whole outfit, with the worn item's perk
 * badge or, when empty, the dashed footprint and the plus badge; each choice picture wears that
 * choice, with its label block (name, perk line, "On <name>" mark) under or beside it. The slots view
 * shows the outfit summary, or a caption in its place, and More slots; the choices view More
 * wearables and Back to slots. Outfit pictures are baked again only when the look, morph, Dream
 * colour, outfit (by outfitKey) or bake scale changes.
 */
export class AxolotlStyler {
  private readonly scene: Phaser.Scene;
  private readonly baked: BakedTextures;
  private readonly baseBakeScale: number;
  private readonly motion: () => MotionProfile;
  private readonly onDone: (axolotl: StyledAxolotl) => void;
  private readonly onCancel: (() => void) | undefined;
  /** The start of every picture texture key: one texture per picture step and option id. */
  private readonly pictureKeyStart: string;
  /** What each baked picture texture shows, by key. Each key is baked again in place, never added twice. */
  private readonly pictureSigs = new Map<string, string>();
  /** The Dream colour step's 24 px swatch tiles, by key: one per Dream colour, baked again when the resolution changes. */
  private readonly swatches = new Map<string, TexInfo>();
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly boxes: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly helper: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly labelProbe: Phaser.GameObjects.Text;
  /** Measures the perk text of Outfit label blocks (normal weight). */
  private readonly perkProbe: Phaser.GameObjects.Text;
  private readonly morphBadges: MorphTextures['badges'][typeof MORPH_BADGE_PX];
  private readonly perkIcons: TreasureTextures['perks'];
  private readonly summaryRows: SummaryRowParts[];
  private readonly moreOutfitText: Phaser.GameObjects.Text;
  private readonly moreOutfitZone: Phaser.GameObjects.Zone;
  /** Back to slots on the Outfit choices view (restyle only; null in the creator). */
  private readonly backToSlotsButton: UiButton | null;
  private readonly slots: OptionSlot[];
  private readonly tabTexts: Phaser.GameObjects.Text[];
  private readonly tabZones: Phaser.GameObjects.Zone[];
  private readonly prevPage: Chevron;
  private readonly nextPage: Chevron;
  private readonly nameBoxText: Phaser.GameObjects.Text;
  private readonly nameBoxPencil: Phaser.GameObjects.Image;
  private readonly nameCursor: Phaser.GameObjects.Rectangle;
  private readonly nameBoxZone: Phaser.GameObjects.Zone;
  private readonly moreNamesText: Phaser.GameObjects.Text;
  private readonly moreNamesZone: Phaser.GameObjects.Zone;
  private readonly moreColoursText: Phaser.GameObjects.Text;
  private readonly moreColoursZone: Phaser.GameObjects.Zone;
  private readonly buttons: Partial<Record<NavControl, UiButton>>;
  private readonly texts: Phaser.GameObjects.Text[];
  /** The live preview's part textures, re-baked only when its look, palette, outfit or bake scale changes. */
  private readonly previewBake: AxolotlRigBake;
  private readonly previewView: AxolotlRigView;
  private shownLook: AxolotlLook;
  /** The logic outfit the preview's art outfit was last made from, and that art outfit. */
  private shownOutfit: { source: Outfit | null; art: ArtOutfit; key: string } = { source: null, ...NO_PREVIEW_OUTFIT };
  private state: StylerState;
  private view: SceneView;
  private dpr: number;
  private placed: StylerLayout | null = null;
  private screenKey = '';
  private tabPage: number | null = null;
  private clock = 0;
  /** Real elapsed seconds (no MAX_STEP_S cap), so the name box cursor blinks on time at a low frame rate. */
  private cursorClock = 0;
  private entry: TextEntry | null = null;
  /** Whether the open name field's caret was last styled blinking (ambient motion) or steady. */
  private entryCaretBlinks = false;
  private nameBeforeTyping = '';
  private captureWasOn = false;
  private finished = false;

  constructor(scene: Phaser.Scene, assets: GameAssets, view: SceneView, depth: number, options: AxolotlStylerOptions) {
    if (options.mode === 'restyle' && options.onCancel === undefined) {
      throw new Error('AxolotlStyler: restyle needs onCancel');
    }
    this.scene = scene;
    this.baked = assets.baked;
    this.view = view;
    this.dpr = view.fit.dpr;
    this.motion = options.motion;
    this.onDone = options.onDone;
    this.onCancel = options.onCancel;
    this.state = startStateOf(options);
    this.baseBakeScale = assets.axolotl.bakeScale;
    const id = stylerCount++;
    this.pictureKeyStart = `styler-picture-${id}`;
    this.shownLook = this.state.look;
    this.previewBake = createAxolotlRigBake(scene, `styler-preview-${id}`, this.baseBakeScale, {
      look: this.shownLook,
      palette: axolotlPalette(this.state.morph, this.state.dreamColour),
      outfit: this.previewOutfit().art,
    });
    this.morphBadges = assets.morph.badges[MORPH_BADGE_PX];
    this.perkIcons = assets.treasure.perks;

    const backdrop = scene.add
      .rectangle(-BACKDROP_COVER / 2, -BACKDROP_COVER / 2, BACKDROP_COVER, BACKDROP_COVER, cssColor(HOME_TANK_WALL).color, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.boxes = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.previewView = createAxolotlRigView(scene, this.previewBake);
    this.heading = this.addText(HEADING_TEXT_PX, true);
    this.helper = this.addText(HELPER_TEXT_PX, false);
    this.caption = this.addText(CAPTION_TEXT_PX, true);
    this.labelProbe = this.addText(OPTION_LABEL_TEXT_PX, true).setVisible(false);
    this.perkProbe = this.addText(OPTION_LABEL_TEXT_PX, false).setVisible(false);
    this.slots = Array.from({ length: MAX_STEP_OPTIONS }, (_unused, index) => this.createSlot(index));
    this.summaryRows = PERK_ORDER.map(() => this.createSummaryRow());
    this.tabTexts = RESTYLE_STEPS.map((step) => this.addText(TAB_TEXT_PX, true).setText(stepTabLabel(step)));
    this.tabZones = RESTYLE_STEPS.map((step) => createTapZone(scene, () => this.dispatch({ type: 'tab', step })));
    this.prevPage = createChevron(scene, this.baked, 'left', () => this.turnTabPage(-1));
    this.nextPage = createChevron(scene, this.baked, 'right', () => this.turnTabPage(1));
    this.nameBoxText = this.addText(NAME_TEXT_PX, true).setAlign('left');
    const pencilInfo = this.baked.icons.pencil;
    this.nameBoxPencil = scene.add
      .image(0, 0, pencilInfo.key)
      .setOrigin(0, 0)
      .setScale(NAME_PENCIL_PX / ICON_SIZE / pencilInfo.scale)
      .setVisible(false);
    this.nameCursor = scene.add
      .rectangle(0, 0, NAME_FIELD.cursorW, NAME_FIELD.cursorH, cssColor(NAME_FIELD.cursor).color, 1)
      .setOrigin(0, 0)
      .setVisible(false);
    this.nameBoxZone = createTapZone(scene, () => this.dispatch({ type: 'nameTap' }));
    this.moreNamesText = this.addText(NAME_TEXT_PX, true).setText(MORE_NAMES_LABEL);
    this.moreNamesZone = createTapZone(scene, () => this.pressMoreNames());
    this.moreColoursText = this.addText(NAME_TEXT_PX, true).setText(MORE_COLOURS_LABEL);
    this.moreColoursZone = createTapZone(scene, () => this.pressMoreColours());
    this.moreOutfitText = this.addText(NAME_TEXT_PX, true);
    this.moreOutfitZone = createTapZone(scene, () => this.pressMoreOutfit());
    this.buttons = {};
    for (const control of NAV_CONTROLS[options.mode]) {
      this.buttons[control] = this.createNavButton(control);
    }
    this.backToSlotsButton = options.mode === 'restyle' ? this.createBackToSlotsButton() : null;
    this.texts = [
      this.heading,
      this.helper,
      this.caption,
      this.labelProbe,
      this.perkProbe,
      ...this.slots.flatMap((slot) => [slot.label, slot.nameText, slot.perkText, slot.wornOnText]),
      ...this.summaryRows.flatMap((row) => [row.text, row.maxText]),
      ...this.tabTexts,
      this.nameBoxText,
      this.moreNamesText,
      this.moreColoursText,
      this.moreOutfitText,
    ];
    const stepButtons = [...Object.values(this.buttons), ...(this.backToSlotsButton ? [this.backToSlotsButton] : [])];

    this.container = scene.add
      .container(0, 0, [
        backdrop,
        this.panel,
        this.boxes,
        this.previewView.root,
        ...this.slots.map((slot) => slot.picture),
        this.marks,
        ...this.slots.flatMap((slot) => [slot.tick, slot.badge, slot.symbol, slot.perkIcon]),
        ...this.summaryRows.map((row) => row.icon),
        ...this.texts,
        this.nameBoxPencil,
        this.nameCursor,
        ...this.slots.map((slot) => slot.zone),
        ...this.tabZones,
        this.nameBoxZone,
        this.moreNamesZone,
        this.moreColoursZone,
        this.moreOutfitZone,
        this.prevPage.container,
        this.nextPage.container,
        ...stepButtons.map((button) => button.container),
      ])
      .setDepth(depth);
    this.layout(view);
  }

  /** Whether the name text field is open. Keys go to the field, not the styler, while it is. */
  isTyping(): boolean {
    return this.entry !== null;
  }

  /**
   * Handles a keydown through the styler reducer: Tab and Shift+Tab move the focus; arrows move in the
   * picture buttons (by the layout's columns) or through the restyle tabs; Enter and Space press,
   * ignoring key repeat; Escape cancels in restyle. Ignored while typing and after Done or Cancel.
   */
  handleKey(event: StylerKeyEvent): void {
    if (this.finished || this.entry !== null) return;
    if (event.repeat && tankKeyFor(event.key, event.shiftKey) === 'confirm') return;
    this.dispatch({ type: 'key', key: event.key, shiftKey: event.shiftKey, columns: this.gridColumns() });
  }

  /** Advances the preview idle by `deltaMs`; under reduced motion it holds the still pose. Call every frame. */
  update(_time: number, deltaMs: number): void {
    const realDt = Math.max(deltaMs / 1000, 0);
    const dt = Math.min(realDt, MAX_STEP_S);
    this.clock += dt;
    this.cursorClock += realDt;
    if (this.placed?.preview) this.renderPreview();
    this.restyleEntryCaret();
    this.blinkNameCursor();
  }

  /**
   * Lays the current step screen out for `view` with stylerLayout() and redraws it. Re-bakes the
   * picture buttons and the preview when their size or the resolution changed (never upscaled), and
   * moves an open name field to the name box.
   */
  layout(view: SceneView): void {
    this.view = view;
    this.relayout();
  }

  /**
   * Sets the text and button resolution to `dpr`. Call layout() straight after, as a resize does: it
   * re-bakes the preview and the picture buttons for `dpr` once, for the new layout, so nothing is
   * baked for the old layout first.
   */
  setResolution(dpr: number): void {
    this.dpr = dpr;
    for (const text of this.texts) {
      text.setResolution(dpr);
    }
    for (const button of Object.values(this.buttons)) {
      button.setResolution(dpr);
    }
    this.backToSlotsButton?.setResolution(dpr);
  }

  /**
   * Closes the name field without callbacks, then removes every object, the preview, the picture
   * textures and the Dream swatch tiles.
   */
  destroy(): void {
    this.finished = true;
    this.closeEntry();
    this.container.destroy();
    this.previewBake.destroy();
    for (const key of [...this.pictureSigs.keys(), ...this.swatches.keys()]) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.pictureSigs.clear();
    this.swatches.clear();
  }

  private addText(sizePx: number, bold: boolean): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, '', { ...uiTextStyle(sizePx, this.dpr, bold), align: 'center' });
  }

  private createSlot(index: number): OptionSlot {
    const checkInfo = this.baked.icons.check;
    return {
      zone: createTapZone(this.scene, () => this.dispatch({ type: 'pick', index })),
      picture: this.scene.add.image(0, 0, '__DEFAULT').setVisible(false),
      label: this.addText(OPTION_LABEL_TEXT_PX, true),
      nameText: this.addText(NAME_TEXT_PX, true),
      tick: this.scene.add
        .image(0, 0, checkInfo.key)
        .setOrigin(0, 0)
        .setScale(TICK_BADGE.iconPx / ICON_SIZE / checkInfo.scale)
        .setVisible(false),
      badge: this.scene.add.image(0, 0, this.morphBadges.triangle.key).setVisible(false),
      symbol: this.scene.add.image(0, 0, this.baked.icons.boy.key).setOrigin(0, 0).setVisible(false),
      perkIcon: this.scene.add.image(0, 0, '__DEFAULT').setVisible(false),
      perkText: this.addText(OPTION_LABEL_TEXT_PX, false),
      wornOnText: this.addText(OPTION_LABEL_TEXT_PX, true),
    };
  }

  private createSummaryRow(): SummaryRowParts {
    return {
      icon: this.scene.add.image(0, 0, '__DEFAULT').setVisible(false),
      text: this.addText(OPTION_LABEL_TEXT_PX, false).setVisible(false),
      maxText: this.addText(OPTION_LABEL_TEXT_PX, true).setText(MAX_MARK_LABEL).setVisible(false),
    };
  }

  /**
   * A nav button. Back and Cancel play the close or back tap (issue #167, ND-2). Surprise me plays no
   * tap, since dispatch plays its own sound (ND-10), and nor does Restyle's Done, whose restyle sound
   * plays when the restyle finishes.
   */
  private createNavButton(control: NavControl): UiButton {
    const spec = NAV_SPECS[control];
    return createButton(this.scene, this.baked, {
      fill: spec.fill,
      shape: spec.shape,
      size: 1,
      width: spec.size.w,
      label: spec.label,
      icon: spec.icon,
      dpr: this.dpr,
      pressOnDown: false,
      taps: control !== 'surprise' && !(control === 'done' && this.state.mode === 'restyle'),
      backTap: control === 'back' || control === 'cancel',
      onPress: () => this.dispatch({ type: control }),
    });
  }

  /** Back to slots: a secondary tile with the left chevron over its label (art guide 8). */
  private createBackToSlotsButton(): UiButton {
    const button = createButton(this.scene, this.baked, {
      fill: 'secondary',
      shape: 'square',
      size: 1,
      width: BACK_TO_SLOTS_BUTTON.w,
      label: BACK_TO_SLOTS_LABEL,
      icon: 'left',
      dpr: this.dpr,
      pressOnDown: false,
      onPress: () => this.dispatch({ type: 'backToSlots' }),
    });
    button.container.setVisible(false);
    return button;
  }

  /**
   * The step screen stylerLayout() lays out: on Name, the option count is every suggested name that
   * fits; on Dream colour, the real colour and every owned Dream colour, over all pages; on Outfit, the
   * buttons of its view over all pages, with the view.
   */
  private screenOf(): StylerScreen {
    const { mode, step } = this.state;
    const screen: StylerScreen = { mode, step, optionCount: this.optionCountOf(step), tabPage: this.tabPage };
    return step === 'outfit' ? { ...screen, outfitView: this.state.outfitView } : screen;
  }

  private optionCountOf(step: StylerStep): number {
    if (step === 'name') return suggestedNamesFor(this.state.look.sex).length;
    if (step === 'dream') return 1 + this.state.ownedDreams.length;
    if (step === 'outfit') return outfitOptionCount(this.state);
    return stepOptions(this.state).length;
  }

  private isOutfitSlots(): boolean {
    return this.state.step === 'outfit' && this.state.outfitView === 'slots';
  }

  private isOutfitChoices(): boolean {
    return this.state.step === 'outfit' && this.state.outfitView === 'choices';
  }

  /** Every option of the Outfit step's current view, over all its pages. */
  private allOutfitOptions(): readonly StylerOption[] {
    return stepOptions({ ...this.state, outfitPage: 0, outfitPerPage: outfitOptionCount(this.state) });
  }

  /** The label block of the Outfit choice `option`: None has only its name. */
  private labelBlockOf(option: StylerOption): LabelBlock {
    if (option.id === NO_WEARABLE_OPTION_ID) return { name: option.label, perk: null, wornOn: null };
    return { name: option.label, perk: wearableOf(option.id).perk, wornOn: option.wornOnMark ?? null };
  }

  /** The Outfit slots view caption of `slot`: "Head: Sun hat, Speed +4%" or "Head: empty". */
  private slotCaption(slot: WearableSlot): string {
    const worn = this.state.outfit[slot];
    return outfitSlotCaption(slot, worn === null ? null : wearableOf(worn));
  }

  /**
   * The option labels to measure: none on Name, every page's labels on Dream colour and Outfit (so
   * each page lays out alike), else the step's.
   */
  private measuredLabels(): string[] {
    const { step } = this.state;
    if (step === 'name') return [];
    if (step === 'outfit') return this.allOutfitOptions().map((option) => option.label);
    const onOnePage = step === 'dream' ? { ...this.state, dreamPage: 0, dreamsPerPage: MAX_DREAM_OPTIONS } : this.state;
    return stepOptions(onOnePage).map((option) => option.label);
  }

  /** The helper line; on the Outfit choices view it names the slot, or says none of its Wearables is banked yet. */
  private helperText(): string {
    if (this.isOutfitChoices()) return outfitHelper(this.state.outfitSlot, outfitOptionCount(this.state) - 1);
    return stepHelper(this.state.mode, this.state.step, this.state.ownedDreams.length);
  }

  /** The heading text: "Step N of 11: ..." when `full` in the creator, else the step title. */
  private headingText(full: boolean): string {
    const { mode, step } = this.state;
    if (mode === 'creator' && full) return stepHeading(stepIndex(this.state), STYLER_STEPS.length, step);
    return stepTitle(step);
  }

  private measureFor(): StylerMeasure {
    if (this.isOutfitChoices()) return this.choicesMeasure();
    const labels = this.measuredLabels();
    const captions = this.isOutfitSlots() ? WEARABLE_SLOTS.map((slot) => this.slotCaption(slot)) : labels;
    return {
      headingAt: (wrapW, full) => wrappedSize(this.heading.setText(this.headingText(full)), wrapW),
      helperAt: (wrapW) => wrappedSize(this.helper.setText(this.helperText()), wrapW),
      captionAt: (wrapW) => largestWrapped(this.caption, captions, wrapW),
      optionLabelAt: (wrapW) => largestWrapped(this.labelProbe, labels, wrapW),
      optionLabelMinW: longestWordWidth(this.labelProbe, labels),
      previewFrame: AXO_TEX,
      previewLargestSize: PREVIEW_LARGEST_SIZE,
      outfitSummaryAt: (wrapW, flowed) => this.arrangeSummary(wrapW, flowed).size,
    };
  }

  /**
   * The Outfit choices view measure: the option labels are whole label blocks (name, perk line and
   * "On <name>" mark), and the narrowest a block wraps is its longest word, or the perk icon, the gap
   * and the perk text's longest word.
   */
  private choicesMeasure(): StylerMeasure {
    const blocks = this.allOutfitOptions().map((option) => this.labelBlockOf(option));
    const probes: LabelBlockTexts = { name: this.labelProbe, perk: this.perkProbe, wornOn: this.labelProbe };
    const boldWords = blocks.flatMap((block) => (block.wornOn === null ? [block.name] : [block.name, block.wornOn]));
    const perkTexts = blocks.flatMap((block) => (block.perk === null ? [] : [perkText(block.perk)]));
    const perkMinW = perkTexts.length === 0 ? 0 : PERK_ROW.iconPx + PERK_ROW.gap + longestWordWidth(this.perkProbe, perkTexts);
    const names = blocks.map((block) => block.name);
    return {
      headingAt: (wrapW, full) => wrappedSize(this.heading.setText(this.headingText(full)), wrapW),
      helperAt: (wrapW) => wrappedSize(this.helper.setText(this.helperText()), wrapW),
      captionAt: (wrapW) => largestWrapped(this.caption, names, wrapW),
      optionLabelAt: (wrapW) => largestBlock(probes, blocks, wrapW),
      optionLabelMinW: Math.max(longestWordWidth(this.labelProbe, boldWords), perkMinW),
      previewFrame: AXO_TEX,
      previewLargestSize: PREVIEW_LARGEST_SIZE,
    };
  }

  /**
   * Lays out the current step screen, fits the names per page to it on Name and the options per page
   * on Dream colour and Outfit, tells the state whether the tab row shows (restyle), places the panel,
   * the heading, the helper and the step buttons, then redraws everything else.
   */
  private relayout(): void {
    const screen = this.screenOf();
    const placed = stylerLayout(this.view, screen, this.measureFor());
    this.placed = placed;
    this.screenKey = screenKeyOf(screen, this.state.outfitSlot);
    if (placed.name !== null) this.state = withNamesPerPage(this.state, placed.name.namesPerPage);
    if (placed.dream !== null) this.state = withDreamsPerPage(this.state, placed.dream.perPage);
    if (placed.outfit !== null) this.state = withOutfitPerPage(this.state, placed.outfit.perPage);
    if (this.state.mode === 'restyle') this.state = withTabsHidden(this.state, placed.tabs === null);
    this.placeBackToSlots(placed.outfit?.backToSlots ?? null);
    const { panel } = placed;
    drawPanel(this.panel, panel.x, panel.y, panel.w, panel.h, UI_PANEL);
    this.placeHeading(placed);
    this.helper.setText(this.helperText());
    if (placed.helper === null) this.helper.setVisible(false);
    else placeTextIn(this.helper, placed.helper);
    for (const control of Object.keys(this.buttons) as NavControl[]) {
      this.placeNavButton(control, placed.nav[control]);
    }
    this.ensurePreviewBake(placed.preview);
    this.refresh();
    this.placeEntry();
  }

  /** The heading, as the layout shows it; none when the layout hides it (restyle fit step 6). */
  private placeHeading(placed: StylerLayout): void {
    this.heading.setText(this.headingText(placed.headingFull));
    if (placed.heading === null) {
      this.heading.setVisible(false);
      return;
    }
    placeTextIn(this.heading, placed.heading);
  }

  private placeNavButton(control: NavControl, rect: Rect | null): void {
    const button = this.buttons[control];
    if (button === undefined) return;
    button.container.setVisible(rect !== null);
    if (rect !== null) button.container.setPosition(rect.x, rect.y);
  }

  /** Back to slots at `rect` (a step button, or the body's first part once the tab row hides), or hidden. */
  private placeBackToSlots(rect: Rect | null): void {
    const button = this.backToSlotsButton;
    if (button === null) {
      if (rect !== null) throw new Error('AxolotlStyler: Back to slots outside restyle');
      return;
    }
    button.container.setVisible(rect !== null);
    if (rect !== null) button.container.setPosition(rect.x, rect.y);
  }

  /** Columns of the option grid for up and down: the picture columns, or the name buttons in the first row. */
  private gridColumns(): number {
    const placed = this.placed;
    if (placed === null) return 1;
    if (placed.columns > 0) return placed.columns;
    const tiles = placed.name?.tiles ?? [];
    return Math.max(1, tiles.filter((tile) => tile.y === tiles[0].y).length);
  }

  /**
   * Runs one action through the reducer, redraws, and acts on its effect. A press while typing
   * keeps the typed name first. The tab row goes back to the page holding the current step. A Surprise
   * me press, by button or by confirm key, plays the surprise sound once (issue #167, ND-10).
   */
  private dispatch(action: StylerAction): void {
    if (this.finished) return;
    this.closeEntry();
    if (surprisePressed(this.state, action)) playSound('surprise');
    const result = reduceStyler(this.state, action, Math.random);
    this.state = result.state;
    this.tabPage = null;
    this.refresh();
    this.applyEffect(result.effect);
  }

  private pressMoreNames(): void {
    this.dispatch({ type: 'moreNames', perPage: this.placed?.name?.namesPerPage ?? this.state.namesPerPage });
  }

  private pressMoreColours(): void {
    this.dispatch({ type: 'moreColours', perPage: this.placed?.dream?.perPage ?? this.state.dreamsPerPage });
  }

  private pressMoreOutfit(): void {
    this.dispatch({ type: 'moreOutfit', perPage: this.placed?.outfit?.perPage ?? this.state.outfitPerPage });
  }

  /** A page button: shows the next or previous page of restyle tabs, wrapping. Focus stays. */
  private turnTabPage(offset: number): void {
    const tabs = this.placed?.tabs;
    if (this.finished || !tabs) return;
    this.closeEntry();
    this.tabPage = tabs.page + offset;
    this.relayout();
  }

  private applyEffect(effect: StylerEffect | undefined): void {
    if (effect === undefined) return;
    if (effect.type === 'startTyping') {
      this.startTyping();
      return;
    }
    this.finished = true;
    this.blinkNameCursor();
    if (effect.type === 'done') {
      const { name, look, morph, dreamColour, outfit } = effect;
      this.onDone({ name, look, morph, dreamColour, outfit });
      return;
    }
    if (this.onCancel === undefined) throw new Error('AxolotlStyler: cancel without onCancel');
    this.onCancel();
  }

  /**
   * Opens the name field over the name box, synchronously, so a pointer or key gesture can raise
   * the on-screen keyboard. Phaser's global key capture pauses so Space and Backspace type.
   */
  private startTyping(): void {
    const keyboard = this.scene.input.keyboard;
    this.captureWasOn = keyboard?.manager.preventDefault === true;
    keyboard?.disableGlobalCapture();
    this.nameBeforeTyping = this.state.name;
    this.entryCaretBlinks = this.motion().ambient;
    this.entry = openTextEntry({
      value: this.state.name,
      maxRawLength: NAME_FIELD_RAW_MAX,
      fitEdit: fitNameEdit,
      ariaLabel: NAME_FIELD_LABEL,
      placeholder: NAME_PLACEHOLDER,
      caretBlinkMs: this.caretBlinkMs(this.entryCaretBlinks),
      onInput: (raw) => this.showTypedName(raw),
      onCommit: (raw) => this.commitTypedName(raw),
      onCancel: () => this.cancelTyping(),
    });
    this.placeEntry();
    this.blinkNameCursor();
  }

  /** The name field caret blink: the cursor's on time in ms when `blinking`, else null for a steady caret. */
  private caretBlinkMs(blinking: boolean): number | null {
    return blinking ? NAME_CURSOR.onS * 1000 : null;
  }

  /** Restyles an open name field's caret when reduced motion was turned on or off while it is open. */
  private restyleEntryCaret(): void {
    const blinking = this.motion().ambient;
    if (this.entry === null || blinking === this.entryCaretBlinks) return;
    this.entryCaretBlinks = blinking;
    this.entry.setCaretBlink(this.caretBlinkMs(blinking));
  }

  /** The styler with `raw` cleaned as its name, or the name from before typing when it cleans to nothing. */
  private withTypedName(raw: string): StylerState {
    return setName({ ...this.state, name: this.nameBeforeTyping }, raw);
  }

  private showTypedName(raw: string): void {
    this.state = this.withTypedName(raw);
    this.refresh();
  }

  private commitTypedName(raw: string): void {
    this.state = this.withTypedName(raw);
    this.closeEntry();
    this.refresh();
  }

  /** Escape in the field: the name goes back to what it was before typing. */
  private cancelTyping(): void {
    this.state = { ...this.state, name: this.nameBeforeTyping };
    this.closeEntry();
    this.refresh();
  }

  /** Closes the name field (no callbacks) and restores Phaser's key capture as it was. Safe when closed. */
  private closeEntry(): void {
    if (this.entry === null) return;
    this.entry.close();
    this.entry = null;
    if (this.captureWasOn) this.scene.input.keyboard?.enableGlobalCapture();
  }

  /** Moves an open name field over the name box, mapped from canvas CSS px to client px. */
  private placeEntry(): void {
    const box = this.placed?.name?.box;
    if (this.entry === null || box === undefined) return;
    this.entry.place(this.clientRectOf(box));
  }

  private clientRectOf(rect: Rect): TextEntryRect {
    const bounds = this.scene.game.canvas.getBoundingClientRect();
    const scaleX = this.view.cssW > 0 ? bounds.width / this.view.cssW : 1;
    const scaleY = this.view.cssH > 0 ? bounds.height / this.view.cssH : 1;
    return {
      left: bounds.left + rect.x * scaleX,
      top: bounds.top + rect.y * scaleY,
      width: rect.w * scaleX,
      height: rect.h * scaleY,
    };
  }

  /**
   * Redraws the state, laying the screen out again first when the step, its option count or the tab
   * page changed: dots or tabs, option buttons with their pictures, labels or caption, the Name
   * controls, the Outfit More button and summary, the step buttons' focus, and the preview look, morph
   * and outfit.
   */
  private refresh(): void {
    const placed = this.placed;
    if (placed === null) return;
    if (screenKeyOf(this.screenOf(), this.state.outfitSlot) !== this.screenKey) {
      this.relayout();
      return;
    }
    this.boxes.clear();
    this.marks.clear();
    this.drawDots(placed.dots);
    this.drawTabs(placed);
    this.drawOptions(placed);
    this.drawNameControls(placed);
    this.drawMoreColours(placed);
    this.drawMoreOutfit(placed);
    this.drawOutfitSummary(placed);
    for (const [control, button] of Object.entries(this.buttons)) {
      button.setFocused(this.state.focus.kind === control);
    }
    this.backToSlotsButton?.setFocused(this.state.focus.kind === 'backToSlots');
    this.refreshPreview(placed.preview);
  }

  /** Progress dots (creator): done a filled dot, current a bigger ring with a filled centre, to come a hollow ring. */
  private drawDots(dots: Rect[] | null): void {
    if (dots === null) return;
    const current = stepIndex(this.state);
    const ink = cssColor(INK).color;
    dots.forEach((dot, index) => {
      const x = dot.x + dot.w / 2;
      const y = dot.y + dot.h / 2;
      if (index < current) {
        this.boxes.fillStyle(ink, 1).fillCircle(x, y, DOT.doneR);
      } else if (index === current) {
        this.boxes.lineStyle(DOT.currentLine, ink, 1).strokeCircle(x, y, DOT.currentR);
        this.boxes.fillStyle(ink, 1).fillCircle(x, y, DOT.centreR);
      } else {
        this.boxes.lineStyle(DOT.comeLine, ink, 1).strokeCircle(x, y, DOT.comeR);
      }
    });
  }

  /**
   * The restyle tab row: each tab on the shown page as a box with its label; the current tab's label
   * is bold over a thick ink bar. Page buttons show only when the tabs page.
   */
  private drawTabs(placed: StylerLayout): void {
    const strip = placed.tabs;
    this.tabTexts.forEach((text) => text.setVisible(false));
    this.tabZones.forEach((zone) => placeZone(zone, null));
    this.placePageButton(this.prevPage, strip?.prevPage ?? null);
    this.placePageButton(this.nextPage, strip?.nextPage ?? null);
    if (!strip) return;
    const focus = this.state.focus;
    for (const tab of strip.tabs) {
      const index = RESTYLE_STEPS.indexOf(tab.step);
      const current = tab.step === this.state.step;
      drawBox(this.boxes, tab.rect, focus.kind === 'tab' && focus.step === tab.step);
      const text = this.tabTexts[index].setFontStyle(current ? 'bold' : 'normal');
      placeTextIn(text, tab.rect);
      placeZone(this.tabZones[index], tab.rect);
      if (current) this.drawTabBar(tab.rect);
    }
  }

  private drawTabBar(rect: Rect): void {
    this.marks.fillStyle(cssColor(INK).color, 1);
    this.marks.fillRect(
      rect.x + TAB_BAR.inset,
      rect.y + rect.h - TAB_BAR.bottom - TAB_BAR.h,
      rect.w - 2 * TAB_BAR.inset,
      TAB_BAR.h,
    );
  }

  private placePageButton(chevron: Chevron, rect: Rect | null): void {
    chevron.setEnabled(rect !== null);
    if (rect !== null) chevron.container.setPosition(rect.x, rect.y);
  }

  /**
   * The option buttons: picture buttons (with labels under them, else the caption) or, on Name, the
   * suggested-name buttons. Each is a panel-style box with the focus ring when focused, and the
   * chosen one has the thick ring and the tick badge.
   */
  private drawOptions(placed: StylerLayout): void {
    const isName = this.state.step === 'name';
    const options = stepOptions(this.state);
    const rects = isName ? (placed.name?.tiles ?? []) : placed.options;
    const chosen = chosenIndex(this.state);
    const focus = this.state.focus;
    this.slots.forEach((slot, index) => {
      const option = options[index];
      const rect = rects[index];
      if (option === undefined || rect === undefined) {
        this.hideSlot(slot);
        return;
      }
      drawBox(this.boxes, rect, focus.kind === 'option' && focus.index === index);
      placeZone(slot.zone, rect);
      this.placeTick(slot, rect, index === chosen, !isName);
      if (isName) this.showNameOption(slot, option, rect);
      else this.showPictureOption(slot, option, index, placed);
    });
    this.drawCaption(placed, options, chosen);
  }

  private hideSlot(slot: OptionSlot): void {
    placeZone(slot.zone, null);
    slot.picture.setVisible(false);
    slot.label.setVisible(false);
    slot.nameText.setVisible(false);
    slot.tick.setVisible(false);
    slot.badge.setVisible(false);
    slot.symbol.setVisible(false);
    this.hidePerkLine(slot);
  }

  /** Hides an Outfit choice's perk line and "On <name>" mark. */
  private hidePerkLine(slot: OptionSlot): void {
    slot.perkIcon.setVisible(false);
    slot.perkText.setVisible(false);
    slot.wornOnText.setVisible(false);
  }

  /** The chosen mark (thick ring and tick badge) on `rect`, or none. */
  private placeTick(slot: OptionSlot, rect: Rect, chosen: boolean, inside: boolean): void {
    slot.tick.setVisible(chosen);
    if (!chosen) return;
    strokeChosenRing(this.marks, rect);
    const centre = tickCentre(rect, inside);
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, TICK_BADGE.r);
    this.marks.lineStyle(TICK_BADGE.outline, cssColor(INK).color, 1).strokeCircle(centre.x, centre.y, TICK_BADGE.r);
    slot.tick.setPosition(centre.x - TICK_BADGE.iconPx / 2, centre.y - TICK_BADGE.iconPx / 2);
  }

  private showNameOption(slot: OptionSlot, option: StylerOption, rect: Rect): void {
    slot.picture.setVisible(false);
    slot.label.setVisible(false);
    slot.badge.setVisible(false);
    slot.symbol.setVisible(false);
    this.hidePerkLine(slot);
    placeTextIn(slot.nameText.setText(option.label), rect);
  }

  /**
   * A picture button: its still picture (re-baked when it shows something new), its label (on the
   * Outfit choices view the label block), the Colour step's morph badge, the Dream colour step's badge,
   * the Boy or girl step's symbol, and on the Outfit slots view the perk badge or the plus badge.
   */
  private showPictureOption(slot: OptionSlot, option: StylerOption, index: number, placed: StylerLayout): void {
    const rect = placed.options[index];
    slot.nameText.setVisible(false);
    const key = this.state.step === 'outfit' ? this.bakeOutfitPicture(option, rect) : this.bakePicture(option, rect);
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    slot.picture.setTexture(key).setOrigin(0.5, 0.5).setPosition(centre.x, centre.y);
    slot.picture.setScale(1 / this.dpr).setVisible(true);
    const labelRect = placed.labelsShown ? placed.optionLabels[index] : undefined;
    this.placeOptionLabel(slot, option, labelRect, placed.outfit?.labelsBeside === true);
    const badgeRect = cornerBadgeRect(rect);
    if (this.state.step === 'outfit') {
      slot.symbol.setVisible(false);
      this.placeSlotBadge(slot, option, rect, badgeRect);
      return;
    }
    placeBadge(slot.badge, this.cornerBadgeOf(option), badgeRect);
    this.placeSexSymbol(slot, option, badgeRect);
  }

  /** The option's label in `rect`, or none when the labels hide; on the Outfit choices view, its label block. */
  private placeOptionLabel(slot: OptionSlot, option: StylerOption, rect: Rect | undefined, beside: boolean): void {
    if (rect === undefined) {
      slot.label.setVisible(false);
      this.hidePerkLine(slot);
      return;
    }
    if (this.isOutfitChoices()) {
      this.placeLabelBlock(slot, this.labelBlockOf(option), rect, beside);
      return;
    }
    this.hidePerkLine(slot);
    placeTextIn(slot.label.setAlign('center').setText(option.label), rect);
  }

  /**
   * A label block in `rect`, wrapped to it (with 1 px slack, so it breaks as measured): under its
   * picture each line is centred and the block starts at the top; beside its picture each line starts
   * at the left and the block is centred down the row.
   */
  private placeLabelBlock(slot: OptionSlot, block: LabelBlock, rect: Rect, beside: boolean): void {
    const align = beside ? 'left' : 'center';
    const texts: LabelBlockTexts = {
      name: slot.label.setAlign(align),
      perk: slot.perkText.setAlign(align),
      wornOn: slot.wornOnText.setAlign(align),
    };
    const parts = arrangeLabelBlock(texts, block, rect.w + 1);
    const top = beside ? rect.y + (rect.h - parts.size.h) / 2 : rect.y;
    const lineX = (line: BlockLine): number => (beside ? rect.x : rect.x + (rect.w - line.w) / 2);
    slot.label.setPosition(lineX(parts.name), top + parts.name.y).setVisible(true);
    if (parts.perk === null || block.perk === null) {
      slot.perkIcon.setVisible(false);
      slot.perkText.setVisible(false);
    } else {
      const { perk } = parts;
      const x = lineX(perk);
      const iconRect: Rect = { x, y: top + perk.y + (perk.h - PERK_ROW.iconPx) / 2, w: PERK_ROW.iconPx, h: PERK_ROW.iconPx };
      placeBadge(slot.perkIcon, this.perkIcons[PERK_ROW.iconPx][block.perk.type], iconRect);
      slot.perkText.setPosition(x + PERK_ROW.iconPx + PERK_ROW.gap, top + perk.y + (perk.h - perk.text.h) / 2).setVisible(true);
    }
    if (parts.wornOn === null) slot.wornOnText.setVisible(false);
    else slot.wornOnText.setPosition(lineX(parts.wornOn), top + parts.wornOn.y).setVisible(true);
  }

  /**
   * On the Outfit slots view: a worn slot's perk icon on a white disc in the lower-left badge spot, or an
   * empty slot's plus badge where the tick sits on other screens. The choices view has neither.
   */
  private placeSlotBadge(slot: OptionSlot, option: StylerOption, rect: Rect, badgeRect: Rect): void {
    if (!this.isOutfitSlots()) {
      slot.badge.setVisible(false);
      return;
    }
    const worn = this.state.outfit[option.id as WearableSlot];
    if (worn === null) {
      slot.badge.setVisible(false);
      drawPlusBadge(this.marks, tickCentre(rect, true));
      return;
    }
    const centre = { x: badgeRect.x + badgeRect.w / 2, y: badgeRect.y + badgeRect.h / 2 };
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, PERK_DISC.r);
    this.marks.lineStyle(PERK_DISC.outline, cssColor(INK).color, 1).strokeCircle(centre.x, centre.y, PERK_DISC.r);
    placeBadge(slot.badge, this.perkIcons[PERK_DISC.iconPx][wearableOf(worn).perk.type], badgeRect);
  }

  /**
   * The badge in a picture button's lower-left corner: on Colour, the option's morph badge; on Dream
   * colour, the real morph's badge for the real colour, else the Dream colour's swatch tile; else none.
   */
  private cornerBadgeOf(option: StylerOption): TexInfo | null {
    const { step, morph } = this.state;
    if (step === 'colour') return this.morphBadges[morphById(option.id as RealMorphId).badge];
    if (step !== 'dream') return null;
    if (option.id === REAL_COLOUR_OPTION_ID) return this.morphBadges[morphById(morph).badge];
    return this.dreamSwatch(option.id as DreamColourId);
  }

  /** The MORPH_BADGE_PX swatch tile of the Dream colour `id`, baked once for it at the device pixel ratio. */
  private dreamSwatch(id: DreamColourId): TexInfo {
    const key = `${this.pictureKeyStart}-swatch-${id}`;
    const baked = this.swatches.get(key);
    if (baked !== undefined && baked.scale === this.dpr) return baked;
    const frame = dreamSwatchTextureSize(MORPH_BADGE_PX);
    const info = bake(this.scene, key, frame, this.dpr, (ctx) => paintDreamSwatch(ctx, id, MORPH_BADGE_PX));
    this.swatches.set(key, info);
    return info;
  }

  /** On the Boy or girl step, the white disc with an ink ring and the boy or girl icon centred in `rect`; else hidden. */
  private placeSexSymbol(slot: OptionSlot, option: StylerOption, rect: Rect): void {
    if (this.state.step !== 'sex') {
      slot.symbol.setVisible(false);
      return;
    }
    const centre = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, SEX_SYMBOL.r);
    this.marks.lineStyle(SEX_SYMBOL.outline, cssColor(INK).color, 1).strokeCircle(centre.x, centre.y, SEX_SYMBOL.r);
    const info = this.baked.icons[option.id as AxolotlSex];
    slot.symbol
      .setTexture(info.key)
      .setScale(SEX_SYMBOL.iconPx / ICON_SIZE / info.scale)
      .setPosition(centre.x - SEX_SYMBOL.iconPx / 2, centre.y - SEX_SYMBOL.iconPx / 2)
      .setVisible(true);
  }

  /**
   * The caption names the focused option, else the chosen one, once the labels hide. On the Outfit
   * slots view it shows in place of the outfit summary: the focused slot's caption, else the open slot's.
   */
  private drawCaption(placed: StylerLayout, options: readonly StylerOption[], chosen: number): void {
    const rect = placed.caption;
    const slotsCaption = this.isOutfitSlots();
    if (rect === null || (placed.labelsShown && !slotsCaption)) {
      this.caption.setVisible(false);
      return;
    }
    const focus = this.state.focus;
    const openSlot = options.findIndex((option) => option.id === this.state.outfitSlot);
    const unfocused = slotsCaption ? Math.max(openSlot, 0) : chosen;
    const option = options[focus.kind === 'option' ? focus.index : unfocused];
    const text = option === undefined ? '' : slotsCaption ? this.slotCaption(option.id as WearableSlot) : option.label;
    placeTextIn(this.caption.setText(text), rect);
  }

  /**
   * The Name step's name box (the name, or the placeholder when empty, the pencil and the text cursor)
   * and More names, or neither on other steps.
   */
  private drawNameControls(placed: StylerLayout): void {
    const name = placed.name;
    const focus = this.state.focus.kind;
    placeZone(this.nameBoxZone, name?.box ?? null);
    placeZone(this.moreNamesZone, name?.moreNames ?? null);
    if (name === null) {
      this.nameBoxText.setVisible(false);
      this.nameBoxPencil.setVisible(false);
      this.nameCursor.setVisible(false);
      this.moreNamesText.setVisible(false);
      return;
    }
    drawNameBox(this.boxes, name.box, focus === 'nameBox');
    this.placeNameBoxParts(name.box);
    if (name.moreNames === null) {
      this.moreNamesText.setVisible(false);
      return;
    }
    drawBox(this.boxes, name.moreNames, focus === 'moreNames');
    placeTextIn(this.moreNamesText, name.moreNames);
  }

  /** More colours under the Dream colour options, or none when every option fits on one page or on other steps. */
  private drawMoreColours(placed: StylerLayout): void {
    const rect = placed.dream?.moreColours ?? null;
    placeZone(this.moreColoursZone, rect);
    if (rect === null) {
      this.moreColoursText.setVisible(false);
      return;
    }
    drawBox(this.boxes, rect, this.state.focus.kind === 'moreColours');
    placeTextIn(this.moreColoursText, rect);
  }

  /** More slots or More wearables under the Outfit picture buttons, or none with one page or on other steps. */
  private drawMoreOutfit(placed: StylerLayout): void {
    const rect = placed.outfit?.more ?? null;
    placeZone(this.moreOutfitZone, rect);
    if (rect === null) {
      this.moreOutfitText.setVisible(false);
      return;
    }
    drawBox(this.boxes, rect, this.state.focus.kind === 'moreOutfit');
    this.moreOutfitText.setText(this.isOutfitSlots() ? MORE_SLOTS_LABEL : MORE_WEARABLES_LABEL);
    placeTextIn(this.moreOutfitText, rect);
  }

  /** The outfit summary rows of the draft outfit: one per perk type worn, in PRD order, or "No perks yet". */
  private summarySpecs(): SummaryRowSpec[] {
    const summary = outfitSummary(wornIds(this.state.outfit).map(wearableOf));
    if (summary.empty) return [{ type: null, text: NO_PERKS_TEXT, max: false }];
    return summary.rows.map((row) => ({ type: row.type, text: row.text, max: row.capReached }));
  }

  /**
   * Sets each summary row's text (unwrapped) and returns its size: the 24 px icon, 6 px, the text, and
   * the max mark 8 px after it when the cap is reached.
   */
  private summaryRowSizes(specs: readonly SummaryRowSpec[]): Size[] {
    return specs.map((spec, index) => this.summaryRowSize(this.summaryRows[index], spec));
  }

  private summaryRowSize(row: SummaryRowParts, spec: SummaryRowSpec): Size {
    const text = row.text.setWordWrapWidth(null).setText(spec.text);
    const iconW = spec.type === null ? 0 : PERK_ROW.iconPx + PERK_ROW.gap;
    const maxW = spec.max ? PERK_ROW.maxGap + this.maxMarkWidth(row) : 0;
    const h = Math.max(spec.type === null ? 0 : PERK_ROW.iconPx, text.height, spec.max ? PERK_ROW.maxH : 0);
    return { w: iconW + text.width + maxW, h };
  }

  private maxMarkWidth(row: SummaryRowParts): number {
    return row.maxText.setWordWrapWidth(null).width + 2 * PERK_ROW.maxPad;
  }

  /** The draft outfit's summary rows placed from (0, 0), stacked or flowed in whole rows across `wrapW`. */
  private arrangeSummary(wrapW: number, flowed: boolean): { rects: Rect[]; size: Size } {
    return arrangeRows(this.summaryRowSizes(this.summarySpecs()), wrapW, flowed);
  }

  /** The outfit summary under the Outfit slot buttons, when the layout has room for it; else hidden. */
  private drawOutfitSummary(placed: StylerLayout): void {
    for (const parts of this.summaryRows) {
      parts.icon.setVisible(false);
      parts.text.setVisible(false);
      parts.maxText.setVisible(false);
    }
    const outfit = placed.outfit;
    const rect = outfit?.summary ?? null;
    if (outfit === null || rect === null) return;
    const specs = this.summarySpecs();
    const rows = arrangeRows(this.summaryRowSizes(specs), rect.w + 1, outfit.summaryFlowed).rects;
    specs.forEach((spec, index) => {
      const row = rows[index];
      this.placeSummaryRow(this.summaryRows[index], spec, { ...row, x: rect.x + row.x, y: rect.y + row.y });
    });
  }

  /** One summary row in `rect`: its icon, its text and its max mark, each centred down the row. */
  private placeSummaryRow(parts: SummaryRowParts, spec: SummaryRowSpec, rect: Rect): void {
    const middle = rect.y + rect.h / 2;
    let x = rect.x;
    if (spec.type === null) {
      parts.icon.setVisible(false);
    } else {
      const iconRect: Rect = { x, y: middle - PERK_ROW.iconPx / 2, w: PERK_ROW.iconPx, h: PERK_ROW.iconPx };
      placeBadge(parts.icon, this.perkIcons[PERK_ROW.iconPx][spec.type], iconRect);
      x += PERK_ROW.iconPx + PERK_ROW.gap;
    }
    parts.text.setPosition(x, middle - parts.text.height / 2).setVisible(true);
    x += parts.text.width;
    if (!spec.max) {
      parts.maxText.setVisible(false);
      return;
    }
    const pill: Rect = { x: x + PERK_ROW.maxGap, y: middle - PERK_ROW.maxH / 2, w: this.maxMarkWidth(parts), h: PERK_ROW.maxH };
    const radius = PERK_ROW.maxH / 2;
    this.marks.fillStyle(cssColor(WHITE).color, 1).fillRoundedRect(pill.x, pill.y, pill.w, pill.h, radius);
    this.marks.lineStyle(PERK_ROW.maxOutline, cssColor(INK).color, 1).strokeRoundedRect(pill.x, pill.y, pill.w, pill.h, radius);
    placeTextIn(parts.maxText, pill);
  }

  /**
   * The name box's parts: the name left-aligned in the text room and centred down it (else the
   * placeholder, normal weight, in the placeholder colour), the pencil icon, and the text cursor at the
   * end of the name (the start of the text room when empty).
   */
  private placeNameBoxParts(box: Rect): void {
    const parts = nameBoxParts(box);
    const empty = this.state.name === '';
    this.nameBoxText
      .setText(empty ? NAME_PLACEHOLDER : this.state.name)
      .setColor(empty ? NAME_FIELD.placeholder : INK)
      .setFontStyle(empty ? 'normal' : 'bold');
    placeTextLeftIn(this.nameBoxText, parts.text);
    this.nameBoxPencil.setPosition(parts.pencil.x, parts.pencil.y).setVisible(true);
    const textEnd = empty ? parts.text.x : this.nameBoxText.x + this.nameBoxText.width;
    const cursorX = Math.min(textEnd, parts.text.x + parts.text.w);
    this.nameCursor.setPosition(cursorX, box.y + (box.h - NAME_FIELD.cursorH) / 2);
    this.blinkNameCursor();
  }

  /**
   * Shows the name box text cursor while the name box has the focus on the Name step, the name field
   * is closed and the styler is not finished: blinking with ambient motion, steady under reduced motion.
   */
  private blinkNameCursor(): void {
    const onNameStep = this.placed !== null && this.placed.name !== null;
    const active = onNameStep && !this.finished && this.entry === null && this.state.focus.kind === 'nameBox';
    this.nameCursor.setVisible(active && nameCursorShown(this.cursorClock, this.motion().ambient));
  }

  /**
   * The texture key of the picture of `option` on the current step, baked first when it would show
   * something new: the look so far with the option applied, in the applied Dream colour (on Colour,
   * in that morph's palette; on Dream colour, in that option's colour over the real morph), wearing
   * the draft outfit in restyle (previewOutfit), at the still pose, cropped for the step and sized to fill the button inside its outline at the device
   * pixel ratio. Whole-axolotl pictures are drawn at their size factor, so Size options look
   * different. Each step and option id has its own key, kept until destroy(), so going back to a step
   * or a Dream colour page bakes nothing that did not change; there is at most one key per option of
   * a step (on Dream colour, MAX_DREAM_OPTIONS).
   */
  private bakePicture(option: StylerOption, rect: Rect): string {
    const { step, look, morph } = this.state;
    const key = `${this.pictureKeyStart}-${step}-${option.id}`;
    const field = stepLookField(step);
    const pictureLook = field === null ? look : lookWithOption(look, field, option.id);
    const pictureMorph = step === 'colour' ? (option.id as RealMorphId) : morph;
    const pictureDream = this.pictureDreamOf(option);
    const cropName = pictureCropOf(step);
    const crop = AXO_PREVIEW_CROPS[cropName];
    const scale = pictureScaleOf(crop, rect, this.dpr);
    const sizeFactor = cropName === 'whole' ? AXO_SIZE_SCALE[pictureLook.size] : 1;
    const outfit = this.previewOutfit();
    const sig = JSON.stringify([pictureLook, pictureMorph, pictureDream, cropName, scale, outfit.key]);
    if (this.pictureSigs.get(key) === sig) return key;
    bakeAxolotlStill(this.scene, key, {
      look: pictureLook,
      palette: axolotlPalette(pictureMorph, pictureDream),
      pose: STILL_POSE,
      crop,
      scale,
      sizeFactor,
      outfit: outfit.art,
    });
    this.pictureSigs.set(key, sig);
    return key;
  }

  /**
   * The texture key of the Outfit picture of `option`, baked first when it would show something new:
   * the slot's crop (art guide 11) of the axolotl in its look and Dream colour at the still pose, at
   * x1.00, wearing the draft outfit (slots view) or the draft outfit with that choice in the open slot
   * (choices view), with the empty-slot cue when that slot is empty. One key per slot in the slots view
   * and per slot and choice in the choices view, kept until destroy().
   */
  private bakeOutfitPicture(option: StylerOption, rect: Rect): string {
    const { look, morph, dreamColour, outfitView } = this.state;
    const slot = outfitView === 'slots' ? (option.id as WearableSlot) : this.state.outfitSlot;
    const key =
      outfitView === 'slots' ? `${this.pictureKeyStart}-outfit-${slot}` : `${this.pictureKeyStart}-outfit-${slot}-${option.id}`;
    const outfit = artOutfit(outfitView === 'slots' ? this.state.outfit : this.outfitWithChoice(option));
    const cueSlot = wornSlug(outfit, slot) === undefined ? slot : null;
    const crop = OUTFIT_SLOT_CROPS[slot];
    const scale = pictureScaleOf(crop, rect, this.dpr);
    const sig = JSON.stringify([look, morph, dreamColour, scale, outfitKey(outfit), cueSlot]);
    if (this.pictureSigs.get(key) === sig) return key;
    const palette = axolotlPalette(morph, dreamColour);
    bake(this.scene, key, cropFrame(crop), scale, (ctx) => paintOutfitPicture(ctx, look, palette, outfit, cueSlot));
    this.pictureSigs.set(key, sig);
    return key;
  }

  /** The draft outfit with the Outfit choice `option` in the open slot (None leaves it empty). */
  private outfitWithChoice(option: StylerOption): Outfit {
    const worn = option.id === NO_WEARABLE_OPTION_ID ? null : option.id;
    return { ...this.state.outfit, [this.state.outfitSlot]: worn };
  }

  /** The Dream colour a picture shows: on Dream colour the option's (none for the real colour), else the applied one. */
  private pictureDreamOf(option: StylerOption): DreamColourId | null {
    if (this.state.step !== 'dream') return this.state.dreamColour;
    return option.id === REAL_COLOUR_OPTION_ID ? null : (option.id as DreamColourId);
  }

  /**
   * Re-bakes the preview at the preview scale x DPR texture px per local unit when that is above the
   * boot bake scale and differs from the current bake, so the preview is never upscaled.
   */
  private ensurePreviewBake(preview: StylerPreview | null): void {
    if (preview === null) return;
    this.previewBake.setBakeScale(Math.max(this.baseBakeScale, preview.scale * this.dpr));
  }

  /** Shows the look on the preview and places it, or hides it when the layout has no preview. */
  private refreshPreview(preview: StylerPreview | null): void {
    if (this.state.look !== this.shownLook) {
      this.shownLook = this.state.look;
      this.previewBake.setAppearance({ look: this.shownLook });
    }
    this.previewView.root.setVisible(preview !== null);
    if (preview === null) return;
    this.placePreview(preview);
    this.renderPreview();
  }

  /**
   * Places the preview root (local (0,0) at the texture anchor) at the anchor, at the preview scale
   * CSS px per local unit times the size scale (displayScale works in AXO_SCENE_SCALE units). A size
   * change re-bakes at a new scale, so the scale is applied every time.
   */
  private placePreview(preview: StylerPreview): void {
    this.previewView.root
      .setPosition(preview.anchor.x, preview.anchor.y)
      .setScale(this.previewBake.displayScale(preview.scale / AXO_SCENE_SCALE));
  }

  /**
   * Shows the preview in the chosen morph and Dream colour's palette and the draft outfit (both cached,
   * so setAppearance runs and re-bakes only when one changes), posed every call: the idle (with the Iridescent sheen gliding),
   * or under reduced motion the still frame (t = 1.0 s, eyes open, no sheen).
   */
  private renderPreview(): void {
    const motion = this.motion();
    const t = motion.ambient ? this.clock : T_STATIC;
    const pose: AxolotlPose = {
      swimPhase: (TAU * t) / SWIM_PERIOD_S,
      gillPhase: (TAU * (motion.gillFlutter ? t : T_STATIC)) / GILL_PERIOD_S,
      blink: motion.ambient ? blinkAt(t) : 1,
      tailAmp: 1,
      sparkle: 0,
      sheen: motion.ambient ? dreamSheenAt(this.clock) : undefined,
    };
    const palette = axolotlPalette(this.state.morph, this.state.dreamColour);
    const outfit = this.previewOutfit().art;
    if (palette !== this.previewBake.palette || outfit !== this.previewBake.outfit) {
      this.previewBake.setAppearance({ palette, outfit });
    }
    this.previewView.setPose(pose);
  }

  /**
   * What the owned axolotl wears in the preview and the picture buttons, with its outfitKey: in
   * restyle the draft outfit on every step, so it shows everywhere the axolotl is drawn; in the
   * creator nothing. Made again only when the draft outfit changes.
   */
  private previewOutfit(): { art: ArtOutfit; key: string } {
    if (this.state.mode !== 'restyle') return NO_PREVIEW_OUTFIT;
    if (this.shownOutfit.source !== this.state.outfit) {
      const art = artOutfit(this.state.outfit);
      this.shownOutfit = { source: this.state.outfit, art, key: outfitKey(art) };
    }
    return this.shownOutfit;
  }
}
