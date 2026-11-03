import * as Phaser from 'phaser';
import { HOME_TANK_WALL, UI_PANEL } from '../art/palette';
import type { BakedTextures, TexInfo } from '../art/textures';
import type { TreasureTextures } from '../art/treasureTextures';
import { treasureSlug, type Perk } from '../logic/catalogue';
import {
  FILTER_LABEL,
  areaProgress,
  filterSections,
  isFilterActive,
  noMatchText,
  type ChestFilter,
} from '../logic/chestFilter';
import type { Size } from '../logic/hudLayout';
import { CLOSE_LABEL, NEXT_PAGE_LABEL, PREVIOUS_PAGE_LABEL, TREASURE_CHEST_LABEL } from '../logic/tankText';
import {
  SECTION_LINE_GAP_PX,
  chestListing,
  chestPages,
  pageText,
  perkText,
  sectionLine,
  sectionLineLength,
  type ChestCategory,
  type ChestEntry,
  type ChestPage,
  type ChestSection,
  type DreamColourEntry,
  type SectionLineLength,
} from '../logic/treasureChest';
import {
  CHEST_BUTTON,
  ICON_TILE,
  TILE_BUTTON,
  UI,
  chestLayout,
  chestShowsTitle,
  hideChestTitle,
  nextFocusIndex,
  rowsPerPage,
  type ChestLayout,
  type ChestMeasure,
  type TankKey,
} from '../logic/tankUi';
import { playSound } from '../platform/soundPlayer';
import { createButton, cssColor, drawPanel, uiTextStyle, type SceneView, type UiButton } from './BootScene';
import { ChestFilterSheet, addTickIcon, drawTickBadge, readChestFilter, writeChestFilter } from './ChestFilterSheet';
import { addGlowingTreasureIcon, addRarityGlow } from './FindPopup';

const TITLE_PX = 28;
const HEADING_PX = 18;
const PAGE_TEXT_PX = 18;
const SECTION_LINE_PX = 18;
const NAME_PX = 20;
const RARITY_PX = 18;
const DETAIL_PX = 18;
const MESSAGE_PX = 18;
const LEAD_PX = 32;
/** Rarity glow under a found entry's 32 px icon or swatch. */
const LEAD_GLOW_PX = 40;
const LEAD_GAP = 8;
const BADGE_PX = 24;
const SLOT_PX = 18;
const PERK_PX = 18;
/** Perk icon box, the gap after it (guide 8, Wearable display: 24 px icon, 6 px, then the text). */
const PERK_ICON_PX = 24;
const PERK_ICON_GAP = 6;
/** Gap between the slot name and the perk icon when they share a line. */
const SLOT_GAP = 6;
/** Follows the slot name when the perk shares its line, e.g. 'Head ·'. */
const SLOT_SEPARATOR = ' ·';
const BADGE_GAP = 6;
const NAME_GAP = 8;
const BACKDROP_COVER = 8192;
const BACK_INDEX = 0;
const CLOSE_INDEX = 1;
const NEXT_INDEX = 2;
const FILTER_INDEX = 3;
/** createButton size of a square tile that makes the ICON_TILE body of the Filter tile. */
const ICON_TILE_SIZE = ICON_TILE.w / TILE_BUTTON.w;

/** Textures the Treasure Chest draws with. */
export interface TreasureChestTextures {
  baked: BakedTextures;
  treasure: TreasureTextures;
}

/**
 * The texts of one entry row, and its images (null in the measuring probe). A found Wearable's slot
 * and perk are `slot`, `perkIcon` and `perk`; an unfound entry's hint, and an unfound Wearable's slot,
 * is `detail`. The unused ones stay empty.
 */
interface RowParts {
  lead: Phaser.GameObjects.Image | Phaser.GameObjects.Container | null;
  badge: Phaser.GameObjects.Image | null;
  perkIcon: Phaser.GameObjects.Image | null;
  /** The slot name without the separator, e.g. 'Head'; empty for an entry that is not a found Wearable. */
  slotName: string;
  name: Phaser.GameObjects.Text;
  rarity: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  slot: Phaser.GameObjects.Text;
  perk: Phaser.GameObjects.Text;
}

/** One entry row on screen: its container and parts. */
interface ChestRow {
  container: Phaser.GameObjects.Container;
  parts: RowParts;
}

/** Adds a centre-anchored image showing `info` at its logical size. */
function addCentredImage(scene: Phaser.Scene, info: TexInfo): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale);
}

/** The 32 px unfound silhouette of the treasure `id`, centre-anchored. Throws when no silhouette has the id's slug. */
function addTreasureSilhouette(scene: Phaser.Scene, treasure: TreasureTextures, id: string): Phaser.GameObjects.Image {
  const bySlug: Readonly<Record<string, TexInfo | undefined>> = treasure.silhouettes;
  const info = bySlug[treasureSlug(id)];
  if (info === undefined) throw new Error(`addTreasureSilhouette: no silhouette for treasure ${id}`);
  return addCentredImage(scene, info);
}

/** A found Dream colour's swatch over its 40 px rarity glow, both centred on the container origin. */
function addGlowingSwatch(scene: Phaser.Scene, treasure: TreasureTextures, entry: DreamColourEntry): Phaser.GameObjects.Container {
  const glow = addRarityGlow(scene, treasure, LEAD_GLOW_PX, entry.badge);
  const swatch = addCentredImage(scene, treasure.swatches[entry.id]);
  return scene.add.container(0, 0, [glow, swatch]);
}

/**
 * The lead image of an entry row: a found treasure's icon or Dream colour swatch over its rarity
 * glow, or an unfound one's silhouette, which never glows.
 */
function addRowLead(
  scene: Phaser.Scene,
  treasure: TreasureTextures,
  entry: ChestEntry,
): Phaser.GameObjects.Image | Phaser.GameObjects.Container {
  if (entry.category === 'dreamColour') {
    return entry.found ? addGlowingSwatch(scene, treasure, entry) : addCentredImage(scene, treasure.swatchSilhouette);
  }
  return entry.found
    ? addGlowingTreasureIcon(scene, treasure, LEAD_PX, entry.id)
    : addTreasureSilhouette(scene, treasure, entry.id);
}

/** Heading text of a section, e.g. 'Dream colours: 2 of 13 found'. */
function headingText(section: ChestSection): string {
  return `${section.heading}: ${section.countText}`;
}

/** The perk of a found Wearable; null for any other entry. */
function perkOf(entry: ChestEntry): Perk | null {
  return 'perk' in entry ? entry.perk : null;
}

/**
 * Detail text of an entry. Unfound: its hint, then a Wearable's slot name, one per line. Found: none
 * (a found Wearable has the slot and perk line instead).
 */
function detailText(entry: ChestEntry): string {
  if (entry.found) return '';
  const second = 'detailText' in entry ? entry.detailText : '';
  return [entry.hint, second].filter((line) => line !== '').join('\n');
}

/** Returns the current CSS size of `text`. */
function textSize(text: Phaser.GameObjects.Text): Size {
  return { w: text.width, h: text.height };
}

/** Sets `text` to wrap at `wrapW` and returns its size. */
function wrappedSize(text: Phaser.GameObjects.Text, wrapW: number): Size {
  text.setWordWrapWidth(Math.max(1, wrapW), true);
  return textSize(text);
}

/**
 * Fills the row texts with the entry's name ('???' when unfound), rarity name, detail text, and a
 * found Wearable's slot and perk.
 */
function fillRowTexts(parts: RowParts, entry: ChestEntry): void {
  const perk = perkOf(entry);
  parts.name.setText(entry.name);
  parts.rarity.setText(entry.rarityName);
  parts.detail.setText(detailText(entry));
  parts.slotName = perk !== null && 'slotName' in entry ? entry.slotName : '';
  parts.slot.setText(parts.slotName);
  parts.perk.setText(perk !== null ? perkText(perk) : '');
}

/**
 * Lays a Wearable's slot and perk line in `availW` from `top` at `x`, and returns its height; 0 when
 * the entry is not a Wearable. The slot name comes first, then the 24 px perk icon, 6 px, then the
 * perk name and value. When that does not fit one line, the slot name takes its own line and the
 * perk icon and text go under it, the text wrapping beside the icon. Nothing shrinks or hides.
 */
function placePerkLine(parts: RowParts, x: number, top: number, availW: number): number {
  if (parts.slotName === '') return 0;
  const textOffset = PERK_ICON_PX + PERK_ICON_GAP;
  parts.slot.setText(`${parts.slotName}${SLOT_SEPARATOR}`);
  parts.slot.setWordWrapWidth(null);
  parts.perk.setWordWrapWidth(null);
  const sameLine = parts.slot.width + SLOT_GAP + textOffset + parts.perk.width <= availW;
  if (sameLine) {
    const lineH = Math.max(PERK_ICON_PX, parts.slot.height, parts.perk.height);
    const iconX = x + parts.slot.width + SLOT_GAP;
    parts.slot.setPosition(x, top + (lineH - parts.slot.height) / 2);
    parts.perkIcon?.setPosition(iconX + PERK_ICON_PX / 2, top + lineH / 2);
    parts.perk.setPosition(iconX + textOffset, top + (lineH - parts.perk.height) / 2);
    return lineH;
  }
  parts.slot.setText(parts.slotName);
  const slot = wrappedSize(parts.slot, availW);
  const perk = wrappedSize(parts.perk, availW - textOffset);
  const perkH = Math.max(PERK_ICON_PX, perk.h);
  parts.slot.setPosition(x, top);
  parts.perkIcon?.setPosition(x + PERK_ICON_PX / 2, top + slot.h + perkH / 2);
  parts.perk.setPosition(x + textOffset, top + slot.h + (perkH - perk.h) / 2);
  return slot.h + perkH;
}

/** Height `placePerkLine` would use in `availW` (it also places the parts; the caller places them again). */
function perkLineHeight(parts: RowParts, availW: number): number {
  return placePerkLine(parts, 0, 0, availW);
}

/**
 * Places the detail block at `top` and returns its bottom: beside the 32 px lead image (left edge
 * `textX`) or, when that ends higher, under it across the whole row. The block is the detail text or
 * a found Wearable's slot and perk line; an entry with neither adds nothing.
 */
function placeDetail(parts: RowParts, top: number, textX: number, rowW: number): number {
  const { detail } = parts;
  if (detail.text === '' && parts.slotName === '') return top;
  const underTop = Math.max(top, LEAD_PX);
  const blockH = (availW: number): number =>
    detail.text === '' ? perkLineHeight(parts, availW) : wrappedSize(detail, availW).h;
  const underBottom = underTop + blockH(rowW);
  const besideBottom = top + blockH(rowW - textX);
  const useBeside = besideBottom <= underBottom;
  const x = useBeside ? textX : 0;
  const y = useBeside ? top : underTop;
  const availW = useBeside ? rowW - textX : rowW;
  if (detail.text === '') placePerkLine(parts, x, y, availW);
  else {
    wrappedSize(detail, availW);
    detail.setPosition(x, y);
  }
  return useBeside ? besideBottom : underBottom;
}

/**
 * Lays out one entry row `rowW` wide from its top-left and returns its height. The 32 px icon or
 * swatch sits at the left with the name beside it; the 24 px badge and rarity name follow the name
 * on its line when they fit, else go under it; the detail line goes below.
 */
function arrangeRow(parts: RowParts, rowW: number): number {
  const textX = LEAD_PX + LEAD_GAP;
  const textW = rowW - textX;
  const name = wrappedSize(parts.name, textW);
  const groupW = BADGE_PX + BADGE_GAP + parts.rarity.width;
  const groupH = Math.max(BADGE_PX, parts.rarity.height);
  const sameLine = name.w + NAME_GAP + groupW <= textW;
  const lineH = sameLine ? Math.max(name.h, groupH) : name.h;
  const groupX = sameLine ? textX + name.w + NAME_GAP : textX;
  const groupY = sameLine ? (lineH - groupH) / 2 : name.h;
  parts.name.setPosition(textX, (lineH - name.h) / 2);
  parts.badge?.setPosition(groupX + BADGE_PX / 2, groupY + groupH / 2);
  parts.rarity.setPosition(groupX + BADGE_PX + BADGE_GAP, groupY + (groupH - parts.rarity.height) / 2);
  parts.lead?.setPosition(LEAD_PX / 2, LEAD_PX / 2);
  const headBottom = sameLine ? lineH : name.h + groupH;
  return Math.max(LEAD_PX, placeDetail(parts, headBottom, textX, rowW));
}

/**
 * Treasure Chest over the Home Tank: an opaque Home Tank wall backdrop that takes every press, a
 * white panel with the title (hidden when even the short lines leave no room for a whole row), the
 * section heading with its found count, the section line under it (the short lines when the full
 * ones leave no room for a whole row), one page of entry rows for every treasure that matches the
 * filter, found or not, the Filter tile and the page text, and the Close, Back and Next buttons.
 * Pages come from chestPages() of filterSections() at as many rows as fit the list, measured over
 * every entry so the list keeps its size; paging wraps. When no entry matches, one page shows
 * noMatchText(). The Filter tile (icon-only, named 'Filter', with the tick badge while a filter is
 * on) opens the Filter screen (ChestFilterSheet) in the same panel; Done or cancel there comes back
 * to the list, on its first page when the filter changed. The filter is remembered in the game
 * registry, never saved. Appears and leaves at once.
 * Keys: left and right page, next and previous move focus over Back, Close, Next and Filter, confirm
 * presses the focused button, cancel closes. Closing by button or key calls `onClose`.
 */
export class TreasureChestView {
  private readonly scene: Phaser.Scene;
  private readonly treasure: TreasureTextures;
  private readonly onClose: () => void;
  private readonly container: Phaser.GameObjects.Container;
  /** Everything of the list screen; hidden while the Filter screen shows. */
  private readonly listGroup: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly pageLabel: Phaser.GameObjects.Text;
  private readonly sectionLineText: Phaser.GameObjects.Text;
  /** The one line of the page shown when no entry matches the filter. */
  private readonly messageText: Phaser.GameObjects.Text;
  /** The Filter tile's tick badge disc and its tick, shown while a filter is on. */
  private readonly filterMark: Phaser.GameObjects.Graphics;
  private readonly filterTick: Phaser.GameObjects.Image;
  private readonly probe: RowParts;
  private readonly buttons: readonly UiButton[];
  private readonly sheet: ChestFilterSheet;
  private view: SceneView;
  private dpr: number;
  /** Every entry, unfiltered; rows are measured over it and the area counts come from it. */
  private listing: readonly ChestSection[] = [];
  private filter: Readonly<ChestFilter>;
  private sections: readonly ChestSection[] = [];
  private pages: ChestPage[] = [];
  private pageIndex = 0;
  private perPage = 1;
  private rowH = LEAD_PX;
  private lineLength: SectionLineLength = 'full';
  /** Height of the tallest section heading at the content width; the section line sits under it. */
  private headingH = 0;
  private chest: ChestLayout | null = null;
  private rows: ChestRow[] = [];
  private focusIndex = NEXT_INDEX;

  constructor(
    scene: Phaser.Scene,
    textures: TreasureChestTextures,
    view: SceneView,
    depth: number,
    onClose: () => void,
  ) {
    this.scene = scene;
    this.treasure = textures.treasure;
    this.onClose = onClose;
    this.view = view;
    this.dpr = view.fit.dpr;
    this.filter = readChestFilter(scene.registry);
    const backdrop = scene.add
      .rectangle(-BACKDROP_COVER / 2, -BACKDROP_COVER / 2, BACKDROP_COVER, BACKDROP_COVER, cssColor(HOME_TANK_WALL).color, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, TREASURE_CHEST_LABEL, uiTextStyle(TITLE_PX, this.dpr));
    this.heading = scene.add.text(0, 0, '', uiTextStyle(HEADING_PX, this.dpr));
    this.pageLabel = scene.add.text(0, 0, '', uiTextStyle(PAGE_TEXT_PX, this.dpr, false));
    this.sectionLineText = scene.add.text(0, 0, '', uiTextStyle(SECTION_LINE_PX, this.dpr, false));
    this.messageText = scene.add.text(0, 0, '', uiTextStyle(MESSAGE_PX, this.dpr, false)).setVisible(false);
    this.probe = this.createRowParts(null, null, null);
    for (const text of this.probeTexts()) {
      text.setVisible(false);
    }
    this.buttons = [
      this.createChestButton(textures.baked, PREVIOUS_PAGE_LABEL, 'left', BACK_INDEX),
      this.createChestButton(textures.baked, CLOSE_LABEL, 'close', CLOSE_INDEX),
      this.createChestButton(textures.baked, NEXT_PAGE_LABEL, 'right', NEXT_INDEX),
      this.createFilterTile(textures.baked),
    ];
    this.filterMark = scene.add.graphics();
    this.filterTick = addTickIcon(scene, textures.baked);
    this.listGroup = scene.add.container(0, 0, [
      this.panel,
      this.title,
      this.heading,
      this.pageLabel,
      this.sectionLineText,
      this.messageText,
      ...this.buttons.map((button) => button.container),
      this.filterMark,
      this.filterTick,
    ]);
    this.sheet = new ChestFilterSheet({
      scene,
      baked: textures.baked,
      treasure: textures.treasure,
      dpr: this.dpr,
      onChange: (filter) => this.changeFilter(filter),
      onDone: () => this.closeFilter(),
    });
    this.container = scene.add
      .container(0, 0, [backdrop, this.listGroup, this.sheet.container])
      .setDepth(depth)
      .setVisible(false);
    this.setFocus(NEXT_INDEX);
  }

  /** Whether the chest is on screen. */
  isOpen(): boolean {
    return this.container.visible;
  }

  /**
   * Shows the chest at once for these banked treasure ids, filtered by the remembered filter, on the
   * first page with Next focused.
   */
  open(banked: readonly string[]): void {
    this.listing = chestListing(banked);
    this.filter = readChestFilter(this.scene.registry);
    this.sections = filterSections(this.listing, this.filter);
    this.pages = [];
    this.pageIndex = 0;
    this.sheet.close();
    this.listGroup.setVisible(true);
    this.setFocus(NEXT_INDEX);
    this.container.setVisible(true);
    this.layout(this.view);
  }

  /** Hides the chest at once, the Filter screen too. Does not call `onClose`; the Close button and the cancel key do. */
  close(): void {
    this.sheet.close();
    this.listGroup.setVisible(true);
    this.container.setVisible(false);
    this.clearRows();
  }

  /**
   * Lays the chest out for `view` with chestLayout() and the full section lines, measures the tallest
   * entry row of the whole listing at the list width, lays it out again with the short lines when no
   * whole row fits, hides the title (hideChestTitle) when a whole row still does not fit, and pages
   * the filtered listing at as many rows as fit, staying in the current section. While the Filter
   * screen shows, lays that out instead. Safe to call while closed; the next open() uses `view`.
   */
  layout(view: SceneView): void {
    this.view = view;
    if (!this.isOpen()) return;
    if (this.sheet.isOpen()) {
      this.sheet.layout(view);
      return;
    }
    const category = this.currentCategory();
    const firstEntry = this.firstEntryIndex();
    this.pageLabel.setText(pageText(this.pageIndex + 1, Math.max(1, this.pages.length)));
    const full = chestLayout(view, this.chestMeasure('full'));
    this.rowH = this.measureRowHeight(full.list.w);
    this.lineLength = sectionLineLength(full.list.h, this.rowH);
    const lined = this.lineLength === 'full' ? full : chestLayout(view, this.chestMeasure('short'));
    const showsTitle = chestShowsTitle(lined.list.h, this.rowH);
    const chest = showsTitle ? lined : hideChestTitle(lined);
    const filterRect = chest.filter;
    if (filterRect === undefined) throw new Error('TreasureChestView.layout: no Filter tile place');
    this.chest = chest;
    this.perPage = rowsPerPage(chest.list.h, this.rowH, UI.gap);
    this.pages = chestPages(this.sections, this.perPage);
    this.pageIndex = this.pageIndexFor(category, firstEntry);
    drawPanel(this.panel, chest.panel.x, chest.panel.y, chest.panel.w, chest.panel.h, UI_PANEL);
    this.title.setPosition(chest.title.x, chest.title.y);
    this.title.setVisible(showsTitle);
    this.heading.setPosition(chest.heading.x, chest.heading.y);
    this.buttons[BACK_INDEX].container.setPosition(chest.back.x, chest.back.y);
    this.buttons[CLOSE_INDEX].container.setPosition(chest.close.x, chest.close.y);
    this.buttons[NEXT_INDEX].container.setPosition(chest.next.x, chest.next.y);
    this.buttons[FILTER_INDEX].container.setPosition(filterRect.x, filterRect.y);
    this.filterMark.clear();
    this.filterTick.setVisible(false);
    if (isFilterActive(this.filter)) drawTickBadge(this.filterMark, this.filterTick, filterRect);
    this.showPage();
  }

  setResolution(dpr: number): void {
    this.dpr = dpr;
    const rowTexts = this.rows.flatMap((row) => [
      row.parts.name,
      row.parts.rarity,
      row.parts.detail,
      row.parts.slot,
      row.parts.perk,
    ]);
    const listTexts = [this.title, this.heading, this.pageLabel, this.sectionLineText, this.messageText];
    for (const text of [...listTexts, ...this.probeTexts(), ...rowTexts]) {
      text.setResolution(dpr);
    }
    for (const button of this.buttons) {
      button.setResolution(dpr);
    }
    this.sheet.setResolution(dpr);
  }

  /**
   * Handles a Home Tank key while open: on the Filter screen, its keys (ChestFilterSheet.handleKey);
   * else left and right page, next and previous move focus, confirm presses the focused button,
   * cancel closes. Other keys, and every key while closed, do nothing.
   */
  handleKey(key: TankKey): void {
    if (!this.isOpen()) return;
    if (this.sheet.isOpen()) this.sheet.handleKey(key);
    else if (key === 'left') this.turnPage(-1);
    else if (key === 'right') this.turnPage(1);
    else if (key === 'next') this.setFocus(nextFocusIndex(this.focusIndex, this.buttons.length, 1));
    else if (key === 'previous') this.setFocus(nextFocusIndex(this.focusIndex, this.buttons.length, -1));
    else if (key === 'confirm') this.pressButton(this.focusIndex);
    else if (key === 'cancel') this.requestClose();
  }

  destroy(): void {
    this.clearRows();
    for (const text of this.probeTexts()) {
      text.destroy();
    }
    this.sheet.destroy();
    this.container.destroy();
  }

  private probeTexts(): Phaser.GameObjects.Text[] {
    return [this.probe.name, this.probe.rarity, this.probe.detail, this.probe.slot, this.probe.perk];
  }

  private createChestButton(
    baked: BakedTextures,
    label: string,
    icon: 'close' | 'left' | 'right',
    index: number,
  ): UiButton {
    return createButton(this.scene, baked, {
      fill: 'secondary',
      shape: 'square',
      size: 1,
      width: CHEST_BUTTON.w,
      label,
      icon,
      dpr: this.dpr,
      pressOnDown: false,
      taps: index === CLOSE_INDEX,
      backTap: index === CLOSE_INDEX,
      onPress: () => this.pressButton(index),
    });
  }

  /** The Filter tile: an icon-only ICON_TILE secondary tile with the funnel icon, named 'Filter' as the Pause tile is named. It taps. */
  private createFilterTile(baked: BakedTextures): UiButton {
    return createButton(this.scene, baked, {
      fill: 'secondary',
      shape: 'square',
      size: ICON_TILE_SIZE,
      label: FILTER_LABEL,
      icon: 'filter',
      iconOnly: true,
      dpr: this.dpr,
      pressOnDown: false,
      onPress: () => this.pressButton(FILTER_INDEX),
    });
  }

  private createRowParts(
    lead: Phaser.GameObjects.Image | Phaser.GameObjects.Container | null,
    badge: Phaser.GameObjects.Image | null,
    perkIcon: Phaser.GameObjects.Image | null,
  ): RowParts {
    return {
      lead,
      badge,
      perkIcon,
      slotName: '',
      name: this.scene.add.text(0, 0, '', uiTextStyle(NAME_PX, this.dpr)),
      rarity: this.scene.add.text(0, 0, '', uiTextStyle(RARITY_PX, this.dpr)),
      detail: this.scene.add.text(0, 0, '', uiTextStyle(DETAIL_PX, this.dpr, false)),
      slot: this.scene.add.text(0, 0, '', uiTextStyle(SLOT_PX, this.dpr)),
      perk: this.scene.add.text(0, 0, '', uiTextStyle(PERK_PX, this.dpr, false)),
    };
  }

  /** Chest measurements with the `length` section lines under the headings, and the Filter tile. */
  private chestMeasure(length: SectionLineLength): ChestMeasure {
    const [back, close, next, filter] = this.buttons.map((button): Size => ({ w: button.width, h: button.height }));
    return {
      titleAt: (wrapW) => wrappedSize(this.title, wrapW),
      headingAt: (wrapW) => this.measureHeadings(wrapW, length),
      pageText: textSize(this.pageLabel),
      close,
      back,
      next,
      filter,
    };
  }

  /**
   * The heading block of every section, of the whole listing and of the filtered one, wrapped at
   * `wrapW`, so the list keeps one size on every page: as wide as the widest heading or `length`
   * section line, and as tall as the tallest heading, the gap and the tallest section line.
   * Remembers the tallest heading height for placing the line.
   */
  private measureHeadings(wrapW: number, length: SectionLineLength): Size {
    let headingSize: Size = { w: 0, h: 0 };
    let lineSize: Size = { w: 0, h: 0 };
    for (const section of [...this.listing, ...this.sections]) {
      this.heading.setText(headingText(section));
      const heading = wrappedSize(this.heading, wrapW);
      this.sectionLineText.setText(sectionLine(section.category, length));
      const line = wrappedSize(this.sectionLineText, wrapW);
      headingSize = { w: Math.max(headingSize.w, heading.w), h: Math.max(headingSize.h, heading.h) };
      lineSize = { w: Math.max(lineSize.w, line.w), h: Math.max(lineSize.h, line.h) };
    }
    this.headingH = headingSize.h;
    return { w: Math.max(headingSize.w, lineSize.w), h: headingSize.h + SECTION_LINE_GAP_PX + lineSize.h };
  }

  /**
   * Height of the tallest entry row, found or unfound, of the whole listing at `rowW`, whatever the
   * filter; the lead image height when there are none.
   */
  private measureRowHeight(rowW: number): number {
    let height = LEAD_PX;
    for (const section of this.listing) {
      for (const entry of section.entries) {
        fillRowTexts(this.probe, entry);
        height = Math.max(height, arrangeRow(this.probe, rowW));
      }
    }
    return height;
  }

  /** Section of the current page; Decorations before the first paging. */
  private currentCategory(): ChestCategory {
    return this.pages[this.pageIndex]?.section.category ?? 'decoration';
  }

  /** Index, within its section, of the first entry on the current page. */
  private firstEntryIndex(): number {
    const category = this.currentCategory();
    const earlierPages = this.pages
      .slice(0, this.pageIndex)
      .filter((page) => page.section.category === category).length;
    return earlierPages * this.perPage;
  }

  /**
   * Page of `category` that holds its entry `entryIndex`, or its last page when it has fewer
   * entries; the first page when no page is of `category` (the filter left that section out, or
   * nothing matches).
   */
  private pageIndexFor(category: ChestCategory, entryIndex: number): number {
    const first = this.pages.findIndex((page) => page.section.category === category);
    if (first < 0) return 0;
    const count = this.pages.filter((page) => page.section.category === category).length;
    return first + Math.min(count - 1, Math.floor(entryIndex / this.perPage));
  }

  /**
   * Draws the current page: heading, the section line in the same place on every page, page text,
   * and its entry rows; with no page (nothing matches the filter), noMatchText() at the top of the
   * list as page 1 of 1.
   */
  private showPage(): void {
    const chest = this.chest;
    if (chest === null) throw new Error('TreasureChestView.showPage: not laid out');
    const page = this.pages[this.pageIndex];
    this.clearRows();
    this.heading.setVisible(page !== undefined);
    this.sectionLineText.setVisible(page !== undefined);
    this.messageText.setVisible(page === undefined);
    this.pageLabel.setText(pageText(this.pageIndex + 1, Math.max(1, this.pages.length)));
    this.pageLabel.setPosition(chest.pageText.x + (chest.pageText.w - this.pageLabel.width) / 2, chest.pageText.y);
    if (page === undefined) {
      if (this.pages.length > 0) throw new Error(`TreasureChestView.showPage: no page ${this.pageIndex}`);
      this.messageText.setText(noMatchText(this.filter));
      wrappedSize(this.messageText, chest.list.w);
      this.messageText.setPosition(chest.list.x, chest.list.y);
      return;
    }
    this.heading.setText(headingText(page.section));
    this.sectionLineText.setText(sectionLine(page.section.category, this.lineLength));
    wrappedSize(this.sectionLineText, chest.list.w);
    this.sectionLineText.setPosition(chest.heading.x, chest.heading.y + this.headingH + SECTION_LINE_GAP_PX);
    page.entries.forEach((entry, index) => {
      this.rows.push(this.buildRow(entry, chest.list.x, chest.list.y + index * (this.rowH + UI.gap), chest.list.w));
    });
  }

  /**
   * Adds one entry row at (`x`, `y`), `rowW` wide: its glowing icon or swatch, or unfound silhouette,
   * name, badge, rarity name and detail; a found Wearable's slot name, perk icon and perk text.
   */
  private buildRow(entry: ChestEntry, x: number, y: number, rowW: number): ChestRow {
    const lead = addRowLead(this.scene, this.treasure, entry);
    const badge = addCentredImage(this.scene, this.treasure.badges[BADGE_PX][entry.badge]);
    const perk = perkOf(entry);
    const perkIcon = perk !== null ? addCentredImage(this.scene, this.treasure.perks[PERK_ICON_PX][perk.type]) : null;
    const parts = this.createRowParts(lead, badge, perkIcon);
    fillRowTexts(parts, entry);
    arrangeRow(parts, rowW);
    const container = this.scene.add.container(x, y, [
      lead,
      badge,
      ...(perkIcon ? [perkIcon] : []),
      parts.name,
      parts.rarity,
      parts.detail,
      parts.slot,
      parts.perk,
    ]);
    this.listGroup.add(container);
    return { container, parts };
  }

  private clearRows(): void {
    for (const row of this.rows) {
      row.container.destroy();
    }
    this.rows = [];
  }

  /** Shows the page `step` away, wrapping past either end; the one no-match page stays. */
  private turnPage(step: number): void {
    this.pageIndex = Math.max(0, nextFocusIndex(this.pageIndex, this.pages.length, step));
    this.showPage();
    playSound('pageTurn');
  }

  private setFocus(index: number): void {
    this.focusIndex = index;
    this.buttons.forEach((button, buttonIndex) => button.setFocused(buttonIndex === index));
  }

  /**
   * Focuses the button and does its action: Back and Next turn the page, Close closes, Filter opens
   * the Filter screen. Ignored while closed.
   */
  private pressButton(index: number): void {
    if (!this.isOpen()) return;
    this.setFocus(index);
    if (index === BACK_INDEX) this.turnPage(-1);
    else if (index === NEXT_INDEX) this.turnPage(1);
    else if (index === FILTER_INDEX) this.openFilter();
    else this.requestClose();
  }

  /** Hides the list and shows the Filter screen in the same panel, with the area counts of the whole listing. */
  private openFilter(): void {
    this.listGroup.setVisible(false);
    this.clearRows();
    this.sheet.open(this.filter, areaProgress(this.listing), this.view);
  }

  /** Remembers `filter` in the registry, filters the listing again and goes back to its first page. */
  private changeFilter(filter: Readonly<ChestFilter>): void {
    this.filter = filter;
    writeChestFilter(this.scene.registry, filter);
    this.sections = filterSections(this.listing, filter);
    this.pages = [];
    this.pageIndex = 0;
  }

  /** Hides the Filter screen and shows the list again with the Filter tile focused. */
  private closeFilter(): void {
    this.sheet.close();
    this.listGroup.setVisible(true);
    this.setFocus(FILTER_INDEX);
    this.layout(this.view);
  }

  /** Closes the chest, then tells the owner through `onClose`. */
  private requestClose(): void {
    this.close();
    this.onClose();
  }
}
