import * as Phaser from 'phaser';
import { ICON_SIZE } from '../art/drawUi';
import { INK, LW, UI_PANEL, WHITE } from '../art/palette';
import type { BakedTextures, TexInfo } from '../art/textures';
import type { TreasureTextures } from '../art/treasureTextures';
import { AREAS } from '../logic/areas';
import { areaLabel } from '../logic/areaText';
import { RARITIES } from '../logic/catalogue';
import {
  FILTER_GROUP_LABELS,
  FILTER_LABEL,
  FOUND_CHIPS,
  FOUND_CHIP_LABELS,
  NO_FILTER,
  SHOW_ALL_LABEL,
  TYPE_CHIP_LABELS,
  clearFilter,
  toggleFilter,
  type AreaProgress,
  type ChestFilter,
  type FilterGroup,
} from '../logic/chestFilter';
import {
  FILTER_CHIP,
  chestFilterLayout,
  filterChipSize,
  filterFocusOrder,
  type ChestFilterLayout,
  type ChestFilterMeasure,
  type FilterTarget,
} from '../logic/chestFilterUi';
import { badgeShape, rarityName } from '../logic/hints';
import type { Rect, Size } from '../logic/hudLayout';
import { DONE_LABEL, NEXT_PAGE_LABEL, PREVIOUS_PAGE_LABEL } from '../logic/tankText';
import { CHEST_BUTTON, nextFocusIndex, type TankKey } from '../logic/tankUi';
import { CHEST_CATEGORIES } from '../logic/treasureChest';
import { playSound } from '../platform/soundPlayer';
import { createButton, cssColor, drawPanel, uiTextStyle, type SceneView, type UiButton } from './BootScene';

/**
 * Game registry key of the remembered chest filter (PRD C12): kept while the game is open, outside
 * the session, never saved. Never equals a `REGISTRY_KEYS`, `TRIP_REGISTRY_KEYS`,
 * `SESSION_REGISTRY_KEY`, `SAVE_GATE_REGISTRY_KEY`, `REFUGE_REGISTRY_KEY`, `DEV_AREA_REGISTRY_KEY`
 * or `DEV_DECOR_REGISTRY_KEY` value.
 */
export const CHEST_FILTER_REGISTRY_KEY = 'chestFilter';

const TITLE_PX = 28;
const GROUP_NAME_PX = 18;
/** Rarity badge on a Rarity chip, then the gap to its name (the chest rows' badge). */
const BADGE_PX = 24;
const BADGE_GAP = 6;
const BOX_RADIUS = 18;
/** Double focus ring just outside the 3.5 px outline, as on the baked buttons (art guide 8). */
const RING_LINE = 3;
const RING_INNER = LW / 2 + 1.5;
const RING_OUTER = LW / 2 + 4.5;
/** Chip that is on: a thick ink ring just inside the outline, plus the tick badge (shape, not colour). */
const CHOSEN_RING_W = 5;
/**
 * Tick badge on a chip that is on, and on the Filter tile while a filter is on: a white disc with an
 * ink outline and the tick icon, centred 2 px in from the top-right corner so it overhangs the
 * corner and stays clear of the label (the creator's name buttons, art guide 8).
 */
const TICK_BADGE = Object.freeze({ r: 10, iconPx: 16, outline: 2.6, overhang: 2 });

/** The remembered chest filter in `registry`; NO_FILTER before any is stored. */
export function readChestFilter(registry: Phaser.Data.DataManager): Readonly<ChestFilter> {
  const stored = registry.get(CHEST_FILTER_REGISTRY_KEY) as Readonly<ChestFilter> | undefined;
  return stored ?? NO_FILTER;
}

/** Stores `filter` as the remembered chest filter in `registry`. */
export function writeChestFilter(registry: Phaser.Data.DataManager, filter: Readonly<ChestFilter>): void {
  registry.set(CHEST_FILTER_REGISTRY_KEY, filter);
}

/** The 16 px tick icon of the tick badge, top-left anchored and hidden; drawTickBadge places it. */
export function addTickIcon(scene: Phaser.Scene, baked: BakedTextures): Phaser.GameObjects.Image {
  const info = baked.icons.check;
  return scene.add
    .image(0, 0, info.key)
    .setOrigin(0, 0)
    .setScale(TICK_BADGE.iconPx / ICON_SIZE / info.scale)
    .setVisible(false);
}

/** Draws the tick badge's disc into `graphics` over the top-right corner of `rect` and shows `tick` on it. */
export function drawTickBadge(graphics: Phaser.GameObjects.Graphics, tick: Phaser.GameObjects.Image, rect: Rect): void {
  const centre = { x: rect.x + rect.w - TICK_BADGE.overhang, y: rect.y + TICK_BADGE.overhang };
  graphics.fillStyle(cssColor(WHITE).color, 1).fillCircle(centre.x, centre.y, TICK_BADGE.r);
  graphics.lineStyle(TICK_BADGE.outline, cssColor(INK).color, 1).strokeCircle(centre.x, centre.y, TICK_BADGE.r);
  tick.setPosition(centre.x - TICK_BADGE.iconPx / 2, centre.y - TICK_BADGE.iconPx / 2).setVisible(true);
}

/** What the Filter screen needs to build. */
export interface ChestFilterSheetOptions {
  scene: Phaser.Scene;
  baked: BakedTextures;
  treasure: TreasureTextures;
  dpr: number;
  /** A chip or Show all changed the filter to `filter`. */
  onChange: (filter: Readonly<ChestFilter>) => void;
  /** Done or the cancel key: back to the list. */
  onDone: () => void;
}

/**
 * One chip's objects. `value` is the filter value it toggles in `group`; `count` is an Area chip's
 * count line, `badge` a Rarity chip's badge, both null on other chips.
 */
interface FilterChipView {
  group: FilterGroup;
  index: number;
  value: string;
  zone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text | null;
  badge: Phaser.GameObjects.Image | null;
  tick: Phaser.GameObjects.Image;
}

/** A chip's filter value and the parts that set it apart. */
interface ChipSpec {
  value: string;
  label: string;
  count: boolean;
  badge: TexInfo | null;
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

/** Size of `text` on one line, never wrapped. */
function oneLineSize(text: Phaser.GameObjects.Text): Size {
  text.setWordWrapWidth(null);
  return { w: text.width, h: text.height };
}

/** Sets `text` to wrap at `wrapW` and returns its size. */
function wrappedSize(text: Phaser.GameObjects.Text, wrapW: number): Size {
  text.setWordWrapWidth(Math.max(1, wrapW), true);
  return { w: text.width, h: text.height };
}

/** Body of `chip`, measured from its real text: FILTER_CHIP padding round its content, never shrunk. */
function measureChip(chip: FilterChipView): Size {
  const label = oneLineSize(chip.label);
  if (chip.count !== null) {
    const count = oneLineSize(chip.count);
    return filterChipSize({ w: Math.max(label.w, count.w), h: label.h + count.h }, FILTER_CHIP.areaH);
  }
  if (chip.badge !== null) {
    return filterChipSize({ w: BADGE_PX + BADGE_GAP + label.w, h: Math.max(BADGE_PX, label.h) });
  }
  return filterChipSize(label);
}

/**
 * Places `chip`'s content centred in `rect`: an Area chip's name over its count line, a Rarity
 * chip's badge then its name, or the label alone.
 */
function placeChipContent(chip: FilterChipView, rect: Rect): void {
  const centreX = rect.x + rect.w / 2;
  const centreY = rect.y + rect.h / 2;
  const { label, count, badge } = chip;
  if (count !== null) {
    const top = centreY - (label.height + count.height) / 2;
    label.setPosition(centreX - label.width / 2, top);
    count.setPosition(centreX - count.width / 2, top + label.height).setVisible(true);
  } else if (badge !== null) {
    const left = centreX - (BADGE_PX + BADGE_GAP + label.width) / 2;
    badge.setPosition(left + BADGE_PX / 2, centreY).setVisible(true);
    label.setPosition(left + BADGE_PX + BADGE_GAP, centreY - label.height / 2);
  } else {
    label.setPosition(centreX - label.width / 2, centreY - label.height / 2);
  }
  label.setVisible(true);
}

function hideChip(chip: FilterChipView): void {
  placeZone(chip.zone, null);
  chip.label.setVisible(false);
  chip.count?.setVisible(false);
  chip.badge?.setVisible(false);
  chip.tick.setVisible(false);
}

/** True when `a` and `b` are the same focus target. */
function isSameTarget(a: FilterTarget, b: FilterTarget): boolean {
  if (a.kind === 'chip' && b.kind === 'chip') return a.group === b.group && a.index === b.index;
  return a.kind === b.kind;
}

/** Page of `layout` that shows the chip `target`, or -1 when none does. */
function pageOfChip(layout: ChestFilterLayout, target: FilterTarget): number {
  return layout.pages.findIndex((page) =>
    page.parts.some((part) => part.chips.some((chip) => isSameTarget(target, { kind: 'chip', group: chip.group, index: chip.index }))),
  );
}

/** Each group's chip specs in display order (the FILTER_GROUPS chips chestFilterUi measures). */
function chipSpecs(treasure: TreasureTextures): Record<FilterGroup, ChipSpec[]> {
  return {
    types: CHEST_CATEGORIES.map((category) => ({ value: category, label: TYPE_CHIP_LABELS[category], count: false, badge: null })),
    found: FOUND_CHIPS.map((chip) => ({ value: chip, label: FOUND_CHIP_LABELS[chip], count: false, badge: null })),
    rarities: RARITIES.map((rarity) => ({
      value: rarity,
      label: rarityName(rarity),
      count: false,
      badge: treasure.badges[BADGE_PX][badgeShape(rarity)],
    })),
    areaIds: AREAS.map((area) => ({ value: area.id, label: areaLabel(area.number), count: true, badge: null })),
  };
}

/**
 * The Treasure Chest's Filter screen (PRD C11), drawn inside the chest's panel from
 * chestFilterLayout(): the title and Show all, then the Type, Found, Rarity and Area groups of chips,
 * paged when they do not all fit, and Done, Back and Next where the chest's Close, Back and Next sit.
 * A chip that is on has the 5 px ink ring and the tick badge, never colour alone. Rarity chips show
 * their 24 px badge; Area chips show 'Area N' over the area's count line. Chips and Show all tap;
 * turning a page plays the page turn. Keys: next and previous move focus over the page's chips, Show
 * all, Back, Next and Done; confirm presses; left and right turn the pages; cancel is Done.
 */
export class ChestFilterSheet {
  readonly container: Phaser.GameObjects.Container;
  private readonly onChange: (filter: Readonly<ChestFilter>) => void;
  private readonly onDone: () => void;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly boxes: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly groupNames: Readonly<Record<FilterGroup, Phaser.GameObjects.Text>>;
  private readonly chips: Readonly<Record<FilterGroup, readonly FilterChipView[]>>;
  private readonly showAllZone: Phaser.GameObjects.Zone;
  private readonly showAllText: Phaser.GameObjects.Text;
  private readonly doneButton: UiButton;
  private readonly backButton: UiButton;
  private readonly nextButton: UiButton;
  private filter: Readonly<ChestFilter> = NO_FILTER;
  private sheetLayout: ChestFilterLayout | null = null;
  private pageIndex = 0;
  private focus: FilterTarget = { kind: 'done' };

  constructor(options: ChestFilterSheetOptions) {
    const { scene, baked, dpr } = options;
    this.onChange = options.onChange;
    this.onDone = options.onDone;
    this.panel = scene.add.graphics();
    this.boxes = scene.add.graphics();
    this.title = scene.add.text(0, 0, FILTER_LABEL, uiTextStyle(TITLE_PX, dpr));
    this.groupNames = {
      types: scene.add.text(0, 0, FILTER_GROUP_LABELS.types, uiTextStyle(GROUP_NAME_PX, dpr)),
      found: scene.add.text(0, 0, FILTER_GROUP_LABELS.found, uiTextStyle(GROUP_NAME_PX, dpr)),
      rarities: scene.add.text(0, 0, FILTER_GROUP_LABELS.rarities, uiTextStyle(GROUP_NAME_PX, dpr)),
      areaIds: scene.add.text(0, 0, FILTER_GROUP_LABELS.areaIds, uiTextStyle(GROUP_NAME_PX, dpr)),
    };
    const specs = chipSpecs(options.treasure);
    this.chips = {
      types: specs.types.map((spec, index) => this.createChip(scene, baked, dpr, 'types', index, spec)),
      found: specs.found.map((spec, index) => this.createChip(scene, baked, dpr, 'found', index, spec)),
      rarities: specs.rarities.map((spec, index) => this.createChip(scene, baked, dpr, 'rarities', index, spec)),
      areaIds: specs.areaIds.map((spec, index) => this.createChip(scene, baked, dpr, 'areaIds', index, spec)),
    };
    this.showAllZone = createTapZone(scene, () => this.pressTarget({ kind: 'showAll' }));
    this.showAllText = scene.add.text(0, 0, SHOW_ALL_LABEL, uiTextStyle(FILTER_CHIP.textPx, dpr, false));
    this.doneButton = this.createSheetButton(scene, baked, dpr, DONE_LABEL, 'check', { kind: 'done' });
    this.backButton = this.createSheetButton(scene, baked, dpr, PREVIOUS_PAGE_LABEL, 'left', { kind: 'back' });
    this.nextButton = this.createSheetButton(scene, baked, dpr, NEXT_PAGE_LABEL, 'right', { kind: 'next' });
    const allChips = this.allChips();
    this.container = scene.add
      .container(0, 0, [
        this.panel,
        this.boxes,
        this.title,
        ...Object.values(this.groupNames),
        this.showAllZone,
        this.showAllText,
        ...allChips.map((chip) => chip.zone),
        ...allChips.flatMap((chip) => [chip.label, ...(chip.count ? [chip.count] : []), ...(chip.badge ? [chip.badge] : [])]),
        ...allChips.map((chip) => chip.tick),
        this.doneButton.container,
        this.backButton.container,
        this.nextButton.container,
      ])
      .setVisible(false);
  }

  /** Whether the Filter screen is on screen. */
  isOpen(): boolean {
    return this.container.visible;
  }

  /**
   * Shows the screen on its first page with the first chip focused, with `filter`'s chips on and
   * each Area chip's count line from `progress` (areaProgress of the unfiltered listing).
   */
  open(filter: Readonly<ChestFilter>, progress: readonly AreaProgress[], view: SceneView): void {
    this.filter = filter;
    for (const chip of this.chips.areaIds) {
      const area = progress.find((item) => item.areaId === chip.value);
      if (area === undefined) throw new Error(`ChestFilterSheet.open: no progress for area ${chip.value}`);
      chip.count?.setText(area.countText);
    }
    this.pageIndex = 0;
    this.sheetLayout = null;
    this.focus = { kind: 'chip', group: 'types', index: 0 };
    this.container.setVisible(true);
    this.layout(view);
  }

  /** Hides the screen at once. Does not call `onDone`. */
  close(): void {
    this.container.setVisible(false);
    this.setButtonFocus();
  }

  /**
   * Lays the screen out for `view`, keeping its page (clamped to the new page count) and its focus:
   * a focused chip keeps the focus on the page that now shows it. Does nothing while closed.
   */
  layout(view: SceneView): void {
    if (!this.isOpen()) return;
    const placed = chestFilterLayout(view, this.measure());
    this.sheetLayout = placed;
    const chipPage = this.focus.kind === 'chip' ? pageOfChip(placed, this.focus) : -1;
    this.pageIndex = chipPage >= 0 ? chipPage : Math.min(this.pageIndex, placed.pages.length - 1);
    this.draw();
  }

  setResolution(dpr: number): void {
    const chipTexts = this.allChips().flatMap((chip) => [chip.label, ...(chip.count ? [chip.count] : [])]);
    for (const text of [this.title, ...Object.values(this.groupNames), this.showAllText, ...chipTexts]) {
      text.setResolution(dpr);
    }
    for (const button of [this.doneButton, this.backButton, this.nextButton]) {
      button.setResolution(dpr);
    }
  }

  /**
   * Handles a Home Tank key while open: next and previous move focus, confirm presses the focused
   * target, left and right turn the pages when there are more than one, cancel is Done. Other keys,
   * and every key while closed, do nothing.
   */
  handleKey(key: TankKey): void {
    if (!this.isOpen()) return;
    if (key === 'left') this.turnPage(-1);
    else if (key === 'right') this.turnPage(1);
    else if (key === 'next') this.moveFocus(1);
    else if (key === 'previous') this.moveFocus(-1);
    else if (key === 'confirm') this.pressTarget(this.focus);
    else if (key === 'cancel') this.pressTarget({ kind: 'done' });
  }

  destroy(): void {
    this.container.destroy();
  }

  private allChips(): FilterChipView[] {
    return [...this.chips.types, ...this.chips.found, ...this.chips.rarities, ...this.chips.areaIds];
  }

  private createChip(
    scene: Phaser.Scene,
    baked: BakedTextures,
    dpr: number,
    group: FilterGroup,
    index: number,
    spec: ChipSpec,
  ): FilterChipView {
    const style = uiTextStyle(FILTER_CHIP.textPx, dpr, false);
    const badge = spec.badge;
    return {
      group,
      index,
      value: spec.value,
      zone: createTapZone(scene, () => this.pressTarget({ kind: 'chip', group, index })),
      label: scene.add.text(0, 0, spec.label, style).setVisible(false),
      count: spec.count ? scene.add.text(0, 0, '', style).setVisible(false) : null,
      badge:
        badge === null
          ? null
          : scene.add.image(0, 0, badge.key).setOrigin(badge.originNormX, badge.originNormY).setScale(1 / badge.scale).setVisible(false),
      tick: addTickIcon(scene, baked),
    };
  }

  /** Done, Back or Next: a square secondary tile CHEST_BUTTON wide, as in the chest. Back and Next play the page turn, not the tap. */
  private createSheetButton(
    scene: Phaser.Scene,
    baked: BakedTextures,
    dpr: number,
    label: string,
    icon: 'check' | 'left' | 'right',
    target: FilterTarget,
  ): UiButton {
    return createButton(scene, baked, {
      fill: 'secondary',
      shape: 'square',
      size: 1,
      width: CHEST_BUTTON.w,
      label,
      icon,
      dpr,
      pressOnDown: false,
      taps: target.kind === 'done',
      onPress: () => this.pressTarget(target),
    });
  }

  /** Filter screen measurements from the real texts and buttons. */
  private measure(): ChestFilterMeasure {
    const sizesOf = (group: FilterGroup): Size[] => this.chips[group].map(measureChip);
    return {
      titleAt: (wrapW) => wrappedSize(this.title, wrapW),
      groupNameAt: (group, wrapW) => wrappedSize(this.groupNames[group], wrapW),
      chips: {
        types: sizesOf('types'),
        found: sizesOf('found'),
        rarities: sizesOf('rarities'),
        areaIds: sizesOf('areaIds'),
      },
      showAll: filterChipSize(oneLineSize(this.showAllText)),
      done: { w: this.doneButton.width, h: this.doneButton.height },
      back: { w: this.backButton.width, h: this.backButton.height },
      next: { w: this.nextButton.width, h: this.nextButton.height },
    };
  }

  /** Focus targets of the current page. */
  private focusOrder(): FilterTarget[] {
    if (this.sheetLayout === null) throw new Error('ChestFilterSheet.focusOrder: not laid out');
    return filterFocusOrder(this.sheetLayout, this.pageIndex);
  }

  /** Keeps the focus when the current page has it, else focuses the page's first target. */
  private keepFocusOnPage(): void {
    const order = this.focusOrder();
    if (!order.some((target) => isSameTarget(target, this.focus))) this.focus = order[0];
  }

  /**
   * Draws the current page: the panel, title, Show all, each group part's name line and chips (a chip
   * that is on with the chosen mark), Done, and Back and Next when paged; the focus ring on the focus.
   */
  private draw(): void {
    const placed = this.sheetLayout;
    const page = placed?.pages[this.pageIndex];
    if (placed === null || page === undefined) throw new Error('ChestFilterSheet.draw: not laid out');
    this.keepFocusOnPage();
    drawPanel(this.panel, placed.panel.x, placed.panel.y, placed.panel.w, placed.panel.h, UI_PANEL);
    this.boxes.clear();
    this.title.setPosition(placed.title.x, placed.title.y);
    for (const text of Object.values(this.groupNames)) {
      text.setVisible(false);
    }
    for (const chip of this.allChips()) {
      hideChip(chip);
    }
    for (const part of page.parts) {
      this.groupNames[part.group].setPosition(part.name.x, part.name.y).setVisible(true);
      for (const chipRect of part.chips) {
        this.drawChip(this.chips[part.group][chipRect.index], chipRect.rect);
      }
    }
    drawBox(this.boxes, placed.showAll, this.focus.kind === 'showAll');
    placeZone(this.showAllZone, placed.showAll);
    this.showAllText.setPosition(
      placed.showAll.x + (placed.showAll.w - this.showAllText.width) / 2,
      placed.showAll.y + (placed.showAll.h - this.showAllText.height) / 2,
    );
    this.doneButton.container.setPosition(placed.done.x, placed.done.y);
    this.backButton.container.setPosition(placed.back.x, placed.back.y).setVisible(placed.paged);
    this.nextButton.container.setPosition(placed.next.x, placed.next.y).setVisible(placed.paged);
    this.setButtonFocus();
  }

  /** One chip at `rect`: its box, the focus ring when focused, its content, and the chosen mark when on. */
  private drawChip(chip: FilterChipView, rect: Rect): void {
    const focus = this.focus;
    drawBox(this.boxes, rect, focus.kind === 'chip' && focus.group === chip.group && focus.index === chip.index);
    placeZone(chip.zone, rect);
    placeChipContent(chip, rect);
    const chips: readonly string[] = this.filter[chip.group];
    if (!chips.includes(chip.value)) return;
    strokeChosenRing(this.boxes, rect);
    drawTickBadge(this.boxes, chip.tick, rect);
  }

  /** Shows the focus ring on Done, Back or Next when one of them has the focus; none while closed. */
  private setButtonFocus(): void {
    const kind = this.isOpen() ? this.focus.kind : null;
    this.doneButton.setFocused(kind === 'done');
    this.backButton.setFocused(kind === 'back');
    this.nextButton.setFocused(kind === 'next');
  }

  private moveFocus(step: number): void {
    const order = this.focusOrder();
    const current = order.findIndex((target) => isSameTarget(target, this.focus));
    this.focus = order[nextFocusIndex(current, order.length, step)];
    this.draw();
  }

  /** Shows the page `step` away, wrapping, and plays the page turn; nothing when there is one page. */
  private turnPage(step: number): void {
    const placed = this.sheetLayout;
    if (placed === null || !placed.paged) return;
    this.pageIndex = nextFocusIndex(this.pageIndex, placed.pages.length, step);
    this.draw();
    playSound('pageTurn');
  }

  /**
   * Focuses `target` and does its action: a chip toggles and Show all clears every group (each with
   * the tap, by touch or key), Back and Next turn the page, Done goes back to the list. Ignored
   * while closed.
   */
  private pressTarget(target: FilterTarget): void {
    if (!this.isOpen()) return;
    this.focus = target;
    if (target.kind === 'chip') {
      const chip = this.chips[target.group][target.index];
      this.changeFilter(toggleFilter(this.filter, chip.group, chip.value));
    } else if (target.kind === 'showAll') this.changeFilter(clearFilter());
    else if (target.kind === 'back') this.turnPage(-1);
    else if (target.kind === 'next') this.turnPage(1);
    else this.onDone();
  }

  private changeFilter(filter: Readonly<ChestFilter>): void {
    playSound('tap');
    this.filter = filter;
    this.draw();
    this.onChange(filter);
  }
}
