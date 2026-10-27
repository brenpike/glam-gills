import * as Phaser from 'phaser';
import type { MorphTextures } from '../art/morphTextures';
import { HOME_TANK_WALL, UI_PANEL } from '../art/palette';
import type { BakedTextures, TexInfo } from '../art/textures';
import type { TreasureTextures } from '../art/treasureTextures';
import {
  BOOK_FEATURE,
  COLLECTION_BOOK_TITLE,
  bookFeaturePage,
  bookListing,
  bookPages,
  nextPageIndex,
  previousPageIndex,
  type BookCategory,
  type BookDreamColourEntry,
  type BookFactCardEntry,
  type BookFeatureMeasure,
  type BookMorphEntry,
  type BookPage,
  type BookSection,
} from '../logic/collectionBook';
import type { Rect, Size } from '../logic/hudLayout';
import type { RealMorphId } from '../logic/morphs';
import { CLOSE_LABEL, NEXT_PAGE_LABEL, PREVIOUS_PAGE_LABEL } from '../logic/tankText';
import { CHEST_BUTTON, UI, chestLayout, nextFocusIndex, rowsPerPage, type ChestLayout, type TankKey } from '../logic/tankUi';
import { pageText } from '../logic/treasureChest';
import { playSound } from '../platform/soundPlayer';
import { createButton, cssColor, drawPanel, uiTextStyle, type SceneView, type UiButton } from './BootScene';

const TITLE_PX = 28;
const HEADING_PX = 18;
const PAGE_TEXT_PX = 18;
const DREAM_NAME_PX = 20;
const DREAM_LABEL_PX = 18;
const SWATCH_PX = 32;
const SWATCH_GAP = 8;
const BADGE_PX = 24;
const BACKDROP_COVER = 8192;
const BACK_INDEX = 0;
const CLOSE_INDEX = 1;
const NEXT_INDEX = 2;

/** Textures the Collection Book draws with. */
export interface CollectionBookTextures {
  baked: BakedTextures;
  morph: MorphTextures;
  treasure: TreasureTextures;
}

/** A featured picture width bakes exist for: the portrait, silhouette and tilapia picture sizes. */
type PictureSize = 64 | 112;

/** What a featured page (a morph or a fact card) shows: its name, text, badge and picture at a size. */
interface FeatureSpec {
  name: string;
  text: string;
  badge: TexInfo | null;
  pictureAt: ((size: PictureSize) => TexInfo) | null;
}

/** The texts of one Dream colour row, and its swatch (null in the measuring probe). */
interface DreamRowParts {
  swatch: Phaser.GameObjects.Image | null;
  name: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

/** Adds a centre-anchored image showing `info` at its logical size. */
function addCentredImage(scene: Phaser.Scene, info: TexInfo): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale);
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

/** The baked picture size of a featured picture rect. Throws for a width bookFeaturePage() never gives. */
function pictureSizeOf(rect: Rect): PictureSize {
  if (rect.w === 112) return 112;
  if (rect.w === 64) return 64;
  throw new Error(`CollectionBookView: no picture baked at ${rect.w} px`);
}

/**
 * Lays out one Dream colour row `rowW` wide from its top-left and returns its height: the 32 px
 * swatch at the left, the name beside it and the not-found-in-nature label under the name.
 */
function arrangeDreamRow(parts: DreamRowParts, rowW: number): number {
  const textX = SWATCH_PX + SWATCH_GAP;
  const textW = rowW - textX;
  const name = wrappedSize(parts.name, textW);
  const label = wrappedSize(parts.label, textW);
  parts.name.setPosition(textX, 0);
  parts.label.setPosition(textX, name.h);
  parts.swatch?.setPosition(SWATCH_PX / 2, SWATCH_PX / 2);
  return Math.max(SWATCH_PX, name.h + label.h);
}

/**
 * Collection Book over the Home Tank (PRD C12, C13, C14): an opaque Home Tank wall backdrop that
 * takes every press, a white panel with the title, the section heading, one page, the page text,
 * and the Back, Close and Next buttons, in the Treasure Chest layout. A morph page shows its
 * portrait, name, 24 px badge and fun fact, or the silhouette, "???" and the rescue hint. Dream
 * colour pages list swatch rows with the not-found-in-nature label, as many as fit. The fact card
 * page shows the tilapia picture, name and fact, or "???" and the hint with no picture. A morph or
 * fact card page whose text does not fit under the title on a small canvas (the plastic worm card)
 * hides the "Collection Book" title and moves the section heading up to the title's top, giving the
 * list the room (bookFeaturePage()); the card's own name stays visible. Dream colour pages always
 * show the title, and every page restores the title and the heading position, also when the book is
 * laid out again. Paging wraps. Appears and leaves at once. Keys: left and right page, next and previous move focus over
 * Back, Close and Next, confirm presses the focused button, cancel closes. Closing calls `onClose`.
 */
export class CollectionBookView {
  private readonly scene: Phaser.Scene;
  private readonly morph: MorphTextures;
  private readonly treasure: TreasureTextures;
  private readonly onClose: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly pageLabel: Phaser.GameObjects.Text;
  private readonly featureName: Phaser.GameObjects.Text;
  private readonly featureText: Phaser.GameObjects.Text;
  private readonly probe: DreamRowParts;
  private readonly buttons: readonly UiButton[];
  private view: SceneView;
  private dpr: number;
  private sections: readonly BookSection[] = [];
  private pages: BookPage[] = [];
  private pageIndex = 0;
  private perPage = 1;
  private rowH = SWATCH_PX;
  private book: ChestLayout | null = null;
  private pageItems: Phaser.GameObjects.GameObject[] = [];
  private pageTexts: Phaser.GameObjects.Text[] = [];
  private focusIndex = NEXT_INDEX;

  constructor(
    scene: Phaser.Scene,
    textures: CollectionBookTextures,
    view: SceneView,
    depth: number,
    onClose: () => void,
  ) {
    this.scene = scene;
    this.morph = textures.morph;
    this.treasure = textures.treasure;
    this.onClose = onClose;
    this.view = view;
    this.dpr = view.fit.dpr;
    const backdrop = scene.add
      .rectangle(-BACKDROP_COVER / 2, -BACKDROP_COVER / 2, BACKDROP_COVER, BACKDROP_COVER, cssColor(HOME_TANK_WALL).color, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, COLLECTION_BOOK_TITLE, uiTextStyle(TITLE_PX, this.dpr));
    this.heading = scene.add.text(0, 0, '', uiTextStyle(HEADING_PX, this.dpr));
    this.pageLabel = scene.add.text(0, 0, '', uiTextStyle(PAGE_TEXT_PX, this.dpr, false));
    this.featureName = scene.add.text(0, 0, '', uiTextStyle(BOOK_FEATURE.namePx, this.dpr));
    this.featureText = scene.add.text(0, 0, '', uiTextStyle(BOOK_FEATURE.textPx, this.dpr, false));
    this.probe = this.createDreamRowParts(null);
    for (const text of this.probeTexts()) {
      text.setVisible(false);
    }
    this.buttons = [
      this.createBookButton(textures.baked, PREVIOUS_PAGE_LABEL, 'left', BACK_INDEX),
      this.createBookButton(textures.baked, CLOSE_LABEL, 'close', CLOSE_INDEX),
      this.createBookButton(textures.baked, NEXT_PAGE_LABEL, 'right', NEXT_INDEX),
    ];
    this.container = scene.add
      .container(0, 0, [
        backdrop,
        this.panel,
        this.title,
        this.heading,
        this.pageLabel,
        this.featureName,
        this.featureText,
        ...this.buttons.map((button) => button.container),
      ])
      .setDepth(depth)
      .setVisible(false);
    this.setFocus(NEXT_INDEX);
  }

  /** Whether the book is on screen. */
  isOpen(): boolean {
    return this.container.visible;
  }

  /** Shows the book at once for these found morphs and hazards met, on the first morph page with Next focused. */
  open(foundMorphs: readonly RealMorphId[], metHazards: readonly string[]): void {
    this.sections = bookListing(foundMorphs, metHazards);
    this.pages = [];
    this.pageIndex = 0;
    this.setFocus(NEXT_INDEX);
    this.container.setVisible(true);
    this.layout(this.view);
  }

  /** Hides the book at once. Does not call `onClose`; the Close button and the cancel key do. */
  close(): void {
    this.container.setVisible(false);
    this.clearPage();
  }

  /**
   * Lays the book out for `view` with chestLayout(), measures the tallest Dream colour row at the
   * list width, and pages the listing with as many Dream colour rows as fit, staying on the same
   * entry. Safe to call while closed; the next open() uses `view`.
   */
  layout(view: SceneView): void {
    this.view = view;
    if (!this.isOpen()) return;
    const category = this.currentCategory();
    const firstEntry = this.firstEntryIndex();
    this.pageLabel.setText(pageText(this.pageIndex + 1, Math.max(1, this.pages.length)));
    const [back, close, next] = this.buttons.map((button): Size => ({ w: button.width, h: button.height }));
    const book = chestLayout(view, {
      titleAt: (wrapW) => wrappedSize(this.title, wrapW),
      headingAt: (wrapW) => this.measureHeadings(wrapW),
      pageText: textSize(this.pageLabel),
      close,
      back,
      next,
    });
    this.book = book;
    this.rowH = this.measureDreamRowHeight(book.list.w);
    this.perPage = rowsPerPage(book.list.h, this.rowH, UI.gap);
    this.pages = bookPages(this.sections, this.perPage);
    this.pageIndex = this.pageIndexFor(category, firstEntry);
    drawPanel(this.panel, book.panel.x, book.panel.y, book.panel.w, book.panel.h, UI_PANEL);
    this.title.setPosition(book.title.x, book.title.y);
    this.heading.setPosition(book.heading.x, book.heading.y);
    this.buttons[BACK_INDEX].container.setPosition(book.back.x, book.back.y);
    this.buttons[CLOSE_INDEX].container.setPosition(book.close.x, book.close.y);
    this.buttons[NEXT_INDEX].container.setPosition(book.next.x, book.next.y);
    this.showPage();
  }

  setResolution(dpr: number): void {
    this.dpr = dpr;
    const fixedTexts = [this.title, this.heading, this.pageLabel, this.featureName, this.featureText];
    for (const text of [...fixedTexts, ...this.probeTexts(), ...this.pageTexts]) {
      text.setResolution(dpr);
    }
    for (const button of this.buttons) {
      button.setResolution(dpr);
    }
  }

  /**
   * Handles a Home Tank key while open: left and right page, next and previous move focus, confirm
   * presses the focused button, cancel closes. Other keys, and every key while closed, do nothing.
   */
  handleKey(key: TankKey): void {
    if (!this.isOpen()) return;
    if (key === 'left') this.turnPage(-1);
    else if (key === 'right') this.turnPage(1);
    else if (key === 'next') this.setFocus(nextFocusIndex(this.focusIndex, this.buttons.length, 1));
    else if (key === 'previous') this.setFocus(nextFocusIndex(this.focusIndex, this.buttons.length, -1));
    else if (key === 'confirm') this.pressButton(this.focusIndex);
    else if (key === 'cancel') this.requestClose();
  }

  destroy(): void {
    this.clearPage();
    for (const text of this.probeTexts()) {
      text.destroy();
    }
    this.container.destroy();
  }

  private probeTexts(): Phaser.GameObjects.Text[] {
    return [this.probe.name, this.probe.label];
  }

  private createBookButton(
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

  private createDreamRowParts(swatch: Phaser.GameObjects.Image | null): DreamRowParts {
    return {
      swatch,
      name: this.scene.add.text(0, 0, '', uiTextStyle(DREAM_NAME_PX, this.dpr)),
      label: this.scene.add.text(0, 0, '', uiTextStyle(DREAM_LABEL_PX, this.dpr, false)),
    };
  }

  /** Widest and tallest of every section heading wrapped at `wrapW`, so the page area keeps one size on every page. */
  private measureHeadings(wrapW: number): Size {
    let size: Size = { w: 0, h: 0 };
    for (const section of this.sections) {
      this.heading.setText(section.heading);
      const measured = wrappedSize(this.heading, wrapW);
      size = { w: Math.max(size.w, measured.w), h: Math.max(size.h, measured.h) };
    }
    return size;
  }

  /** Height of the tallest Dream colour row at `rowW`; the swatch height when there are none. */
  private measureDreamRowHeight(rowW: number): number {
    let height = SWATCH_PX;
    for (const section of this.sections) {
      if (section.category !== 'dreamColour') continue;
      for (const entry of section.entries) {
        this.probe.name.setText(entry.name);
        this.probe.label.setText(entry.label);
        height = Math.max(height, arrangeDreamRow(this.probe, rowW));
      }
    }
    return height;
  }

  /** Section of the current page; Morphs before the first paging. */
  private currentCategory(): BookCategory {
    return this.pages[this.pageIndex]?.section.category ?? 'morph';
  }

  /** Entries on one page of `category`: one morph or fact card, or the Dream colour rows that fit. */
  private entriesPerPage(category: BookCategory): number {
    return category === 'dreamColour' ? this.perPage : 1;
  }

  /** Index, within its section, of the first entry on the current page. */
  private firstEntryIndex(): number {
    const category = this.currentCategory();
    const earlierPages = this.pages
      .slice(0, this.pageIndex)
      .filter((page) => page.section.category === category).length;
    return earlierPages * this.entriesPerPage(category);
  }

  /** Page of `category` that holds its entry `entryIndex`, or its last page when it has fewer entries. */
  private pageIndexFor(category: BookCategory, entryIndex: number): number {
    const first = this.pages.findIndex((page) => page.section.category === category);
    if (first < 0) throw new Error(`CollectionBookView: no page for section ${category}`);
    const count = this.pages.filter((page) => page.section.category === category).length;
    return first + Math.min(count - 1, Math.floor(entryIndex / this.entriesPerPage(category)));
  }

  /**
   * Draws the current page: heading, page text, and its morph, Dream colour rows or fact card. Starts
   * from the title shown and the heading at its layout position; a featured page may hide the title.
   */
  private showPage(): void {
    const book = this.book;
    const page = this.pages[this.pageIndex];
    if (book === null || page === undefined) throw new Error('CollectionBookView.showPage: not laid out');
    this.title.setVisible(true);
    this.heading.setText(page.section.heading).setPosition(book.heading.x, book.heading.y);
    this.pageLabel.setText(pageText(this.pageIndex + 1, this.pages.length));
    this.pageLabel.setPosition(book.pageText.x + (book.pageText.w - this.pageLabel.width) / 2, book.pageText.y);
    this.clearPage();
    this.featureName.setVisible(false);
    this.featureText.setVisible(false);
    switch (page.section.category) {
      case 'morph':
        this.showFeature(this.morphSpec(page.entries[0] as BookMorphEntry), book);
        return;
      case 'dreamColour':
        this.showDreamRows(page.entries as readonly BookDreamColourEntry[], book.list);
        return;
      case 'factCard':
        this.showFeature(this.factCardSpec(page.entries[0] as BookFactCardEntry), book);
        return;
    }
  }

  /** A found morph's portrait, name, badge and fun fact; an unfound morph's silhouette, "???" and hint. */
  private morphSpec(entry: BookMorphEntry): FeatureSpec {
    if (!entry.found) {
      return { name: entry.name, text: entry.text, badge: null, pictureAt: (size) => this.morph.silhouettes[size] };
    }
    return {
      name: entry.name,
      text: entry.text,
      badge: this.morph.badges[BADGE_PX][entry.badge],
      pictureAt: (size) => this.morph.portraits[entry.id][size],
    };
  }

  /** A found fact card's picture, name and body; an unfound one's "???" and hint with no picture. */
  private factCardSpec(entry: BookFactCardEntry): FeatureSpec {
    const pictureAt = entry.hasPicture ? (size: PictureSize) => this.morph.tilapiaPictures[size] : null;
    return { name: entry.name, text: entry.text, badge: null, pictureAt };
  }

  /**
   * Lays one featured entry out in `book` with bookFeaturePage(), measured with the real texts, and
   * sets the title's visibility and the heading's position from the result.
   */
  private showFeature(spec: FeatureSpec, book: ChestLayout): void {
    this.featureName.setText(spec.name);
    this.featureText.setText(spec.text).setMaxLines(0);
    const measure: BookFeatureMeasure = {
      hasPicture: spec.pictureAt !== null,
      hasBadge: spec.badge !== null,
      nameAt: (wrapW) => wrappedSize(this.featureName, wrapW),
      textAt: (wrapW) => wrappedSize(this.featureText, wrapW),
      textLineH: this.featureText.getTextMetrics().fontSize,
    };
    const { showsTitle, heading, feature } = bookFeaturePage(book, measure);
    this.title.setVisible(showsTitle);
    this.heading.setPosition(heading.x, heading.y);
    wrappedSize(this.featureName, feature.nameWrapW);
    wrappedSize(this.featureText, feature.textWrapW);
    this.featureText.setMaxLines(feature.fits ? 0 : feature.textLines);
    this.featureName.setPosition(feature.name.x, feature.name.y).setVisible(true);
    this.featureText.setPosition(feature.text.x, feature.text.y).setVisible(feature.textLines > 0);
    if (feature.picture !== null && spec.pictureAt !== null) {
      this.addPageImage(spec.pictureAt(pictureSizeOf(feature.picture)), feature.picture);
    }
    if (feature.badge !== null && spec.badge !== null) this.addPageImage(spec.badge, feature.badge);
  }

  /** Adds a centre-anchored image centred on `rect` to the current page. */
  private addPageImage(info: TexInfo, rect: Rect): void {
    const image = addCentredImage(this.scene, info).setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2);
    this.container.add(image);
    this.pageItems.push(image);
  }

  /** Adds one Dream colour row per entry down `list`, `UI.gap` apart. */
  private showDreamRows(entries: readonly BookDreamColourEntry[], list: Rect): void {
    entries.forEach((entry, index) => {
      this.buildDreamRow(entry, list.x, list.y + index * (this.rowH + UI.gap), list.w);
    });
  }

  /** Adds one Dream colour row at (`x`, `y`), `rowW` wide: its Treasure Chest swatch, name and label. */
  private buildDreamRow(entry: BookDreamColourEntry, x: number, y: number, rowW: number): void {
    const swatch = addCentredImage(this.scene, this.treasure.swatches[entry.id]);
    const parts = this.createDreamRowParts(swatch);
    parts.name.setText(entry.name);
    parts.label.setText(entry.label);
    arrangeDreamRow(parts, rowW);
    const row = this.scene.add.container(x, y, [swatch, parts.name, parts.label]);
    this.container.add(row);
    this.pageItems.push(row);
    this.pageTexts.push(parts.name, parts.label);
  }

  private clearPage(): void {
    for (const item of this.pageItems) {
      item.destroy();
    }
    this.pageItems = [];
    this.pageTexts = [];
  }

  /** Shows the page after (`step` 1) or before (`step` -1) the current one, wrapping past either end. */
  private turnPage(step: 1 | -1): void {
    const count = this.pages.length;
    this.pageIndex = step > 0 ? nextPageIndex(this.pageIndex, count) : previousPageIndex(this.pageIndex, count);
    this.showPage();
    playSound('pageTurn');
  }

  private setFocus(index: number): void {
    this.focusIndex = index;
    this.buttons.forEach((button, buttonIndex) => button.setFocused(buttonIndex === index));
  }

  /** Focuses the button and does its action: Back and Next turn the page, Close closes. Ignored while closed. */
  private pressButton(index: number): void {
    if (!this.isOpen()) return;
    this.setFocus(index);
    if (index === BACK_INDEX) this.turnPage(-1);
    else if (index === NEXT_INDEX) this.turnPage(1);
    else this.requestClose();
  }

  /** Closes the book, then tells the owner through `onClose`. */
  private requestClose(): void {
    this.close();
    this.onClose();
  }
}
