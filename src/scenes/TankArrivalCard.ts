import * as Phaser from 'phaser';
import { INK, UI_PANEL } from '../art/palette';
import { iconKey } from '../art/textures';
import type { TreasureTextures } from '../art/treasureTextures';
import { areaLabel } from '../logic/areaText';
import type { AreaData } from '../logic/areas';
import { CARD, cardIconRowWidth, cardTextWidth, fitCard, homeTitleWrapWidth, iconRowsSize } from '../logic/cardFit';
import { treasureById } from '../logic/catalogue';
import type { DueFirstFind, FirstFindKind } from '../logic/firstFind';
import { arrivalSound } from '../logic/homeSounds';
import type { MotionProfile } from '../logic/motion';
import { morphById, rescueMorphsIn } from '../logic/morphs';
import type { WaitingStranded } from '../logic/rescue';
import { NO_STARS, type AreaStars } from '../logic/stars';
import { STAR_ROW, starRowSize } from '../logic/starsUi';
import type { TankKey } from '../logic/tankUi';
import { foundInfos } from '../logic/trip';
import type { TripEnding } from '../logic/tripEvents';
import { areaBeatenSound } from '../logic/tripSounds';
import { ARRIVAL_OK_LABEL, arrivalText, type ArrivalStars, type WaitingAxolotl } from '../logic/tripText';
import { playSound } from '../platform/soundPlayer';
import { addAreaStar, showAreaStar, starFlags, type AreaStarTextures } from './AreaStarsBadge';
import {
  createButton,
  cssColor,
  drawPanel,
  uiTextStyle,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';
import { addGlowingTreasureIcon, placeIconRows } from './FindPopup';
import { FirstFindCard, type FirstFindOutcome } from './FirstFindCard';
import { addMotionTween } from './motionTweens';

const TREASURE_ICON_PX = 32;
const DIM_ALPHA = 0.45;
const DIM_COVER = 8192;
const FADE_MS = 400;
const MIN_SHOW_MS = 800;

/**
 * The area beaten and its best stars so far, for the "Area beaten" card (PRD H5, H7). `rescueOpen`
 * is whether any axolotl is still left to rescue (PRD H6).
 */
export interface ArrivalAreaStars {
  area: Readonly<AreaData>;
  best: AreaStars;
  rescueOpen: boolean;
}

/**
 * What the arrival card reports to the Home Tank: `onClose` once the arrival card and every queued
 * first-find card have closed (`tryItNow` when "Try it now!" closed the Paint shell card), and
 * `onFirstFindSeen` as soon as each first-find card closes, so it is saved even if the next one is
 * never seen.
 */
export interface TankArrivalCallbacks {
  onClose(tryItNow: boolean): void;
  onFirstFindSeen(kind: FirstFindKind): void;
}

/** The treasure ids the card body names: returned when carried home, otherwise banked this trip. */
function namedTreasureIds(ending: TripEnding): readonly string[] {
  return ending.reason === 'carriedHome' ? ending.returned : ending.bankedThisTrip;
}

/**
 * The star text input for the "Area beaten" card: the area label, its special treasure name, the
 * stars earned this trip, the best and whether a rescue is still open. Undefined for any other
 * ending. Throws when the area was beaten without its stars, or the special treasure is not in the
 * catalogue.
 */
function arrivalStars(ending: TripEnding, areaStars: ArrivalAreaStars | undefined): ArrivalStars | undefined {
  if (ending.reason !== 'areaBeaten') return undefined;
  if (ending.stars === undefined || areaStars === undefined) {
    throw new Error('TankArrivalCard: the area was beaten with no stars');
  }
  const { area, best, rescueOpen } = areaStars;
  const special = treasureById(area.specialTreasureId);
  if (special === undefined) throw new Error(`TankArrivalCard: no catalogue treasure ${area.specialTreasureId}`);
  return { areaLabel: areaLabel(area.number), specialName: special.name, earned: ending.stars, best, rescueOpen };
}

/** Display names of the rescued axolotls among find ids, e.g. 'Wild axolotl'; other ids are ignored. */
function rescuedDisplayNames(ids: readonly string[]): string[] {
  return rescueMorphsIn(ids).map((morph) => morphById(morph).displayName);
}

/**
 * The axolotls carried home that swam back to where they were found: each rescued axolotl among the
 * returned ids, with its display name and the sex from the waiting record. Empty unless carried
 * home. Throws when a returned axolotl has no matching waiting record.
 */
function waitingAxolotls(ending: TripEnding, waiting: WaitingStranded | null): WaitingAxolotl[] {
  if (ending.reason !== 'carriedHome') return [];
  return rescueMorphsIn(ending.returned).map((morph) => {
    if (waiting === null || waiting.morph !== morph) {
      throw new Error(`TankArrivalCard: returned axolotl ${morph} has no waiting record`);
    }
    return { name: morphById(morph).displayName, sex: waiting.sex };
  });
}

/** Number of wrapped lines `text` would draw for `content` at its current wrap width; 0 for no text. */
function wrappedLineCount(text: Phaser.GameObjects.Text, content: string): number {
  return content === '' ? 0 : text.getWrappedText(content).length;
}

/**
 * Tank arrival card, shown over the Home Tank after a trip: an ink dim that swallows presses, a white
 * panel with the house icon, title, body (with the banked line as its last line), a wrapping icon row
 * of the treasures the body names, and the OK button. After beating the area ("Area beaten", PRD H5)
 * the head icon is the earned Area star and a row of 3 stars, earned or missing this trip, sits under
 * the head. Built only from the trip ending, the banked total and the area stars through
 * arrivalText(); the body also names axolotls rescued into the Home Tank and, when carried home,
 * those waiting where they were found (PRD C4, C5). The icon row shows treasures only. The body has a
 * full and a short wording; layout() lets fitCard() pick whichever fits the canvas, drop icon rows,
 * or clip the body. OK hides the card, then shows the first-find cards due one after another
 * (PRD C15) before calling `onClose`.
 */
export class TankArrivalCard {
  private readonly scene: Phaser.Scene;
  private readonly treasure: TreasureTextures;
  private readonly starTextures: AreaStarTextures;
  private readonly motion: () => MotionProfile;
  private readonly callbacks: TankArrivalCallbacks;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly headStar: Phaser.GameObjects.Image;
  private readonly starRow: Phaser.GameObjects.Image[];
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly button: UiButton;
  private readonly firstFindCard: FirstFindCard;
  private view: SceneView;
  private treasureIcons: Phaser.GameObjects.Container[] = [];
  private firstFinds: DueFirstFind[] = [];
  private bodyOptions: readonly string[] = [''];
  private showsStars = false;
  private shownAt = 0;

  constructor(
    scene: Phaser.Scene,
    assets: GameAssets,
    view: SceneView,
    depth: number,
    motion: () => MotionProfile,
    callbacks: TankArrivalCallbacks,
  ) {
    this.scene = scene;
    this.view = view;
    this.treasure = assets.treasure;
    this.starTextures = assets.area.stars;
    this.motion = motion;
    this.callbacks = callbacks;
    const dpr = view.fit.dpr;
    const ink = cssColor(INK);
    const dim = scene.add
      .rectangle(-DIM_COVER / 2, -DIM_COVER / 2, DIM_COVER, DIM_COVER, ink.color, DIM_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    const iconInfo = assets.baked.icons.home;
    this.icon = scene.add
      .image(0, 0, iconKey('home'))
      .setOrigin(0, 0)
      .setScale(CARD.headIconPx / iconInfo.w / iconInfo.scale);
    this.headStar = addAreaStar(scene, this.starTextures, CARD.headIconPx);
    showAreaStar(this.headStar, this.starTextures, true, CARD.headIconPx);
    this.starRow = starFlags(NO_STARS).map(() => addAreaStar(scene, this.starTextures, STAR_ROW.starPx));
    this.title = scene.add.text(0, 0, '', uiTextStyle(CARD.titlePx, dpr));
    this.body = scene.add.text(0, 0, '', { ...uiTextStyle(CARD.bodyPx, dpr, false), align: 'center' });
    this.button = createButton(scene, assets.baked, {
      fill: 'primary',
      shape: 'wide',
      size: 1,
      label: ARRIVAL_OK_LABEL,
      icon: 'check',
      dpr,
      pressOnDown: false,
      onPress: () => this.press(),
    });
    this.button.setFocused(true);
    this.container = scene.add
      .container(0, 0, [
        dim,
        this.panel,
        this.icon,
        this.headStar,
        ...this.starRow,
        this.title,
        this.body,
        this.button.container,
      ])
      .setDepth(depth)
      .setVisible(false);
    this.firstFindCard = new FirstFindCard(scene, assets, view, depth, (kind, outcome) =>
      this.closeFirstFind(kind, outcome),
    );
    this.showStars(undefined);
  }

  /** Whether the arrival card or one of its first-find cards is on screen. */
  isShowing(): boolean {
    return this.container.visible || this.firstFindCard.isShowing();
  }

  /**
   * Shows the card for a trip ending and the banked total, faded in unless motion is reduced. After
   * beating the area, `areaStars` gives the area and its best stars. `waiting` is the stranded
   * axolotl left waiting after the trip, which gives the sex of a returned axolotl. `firstFinds` are
   * the first-find cards to show, in order, after OK. Throws when the
   * area was beaten without `areaStars` or the ending's stars, or a returned axolotl has no matching
   * waiting record.
   */
  show(
    ending: TripEnding,
    bankedTotal: number,
    areaStars: ArrivalAreaStars | undefined,
    waiting: WaitingStranded | null,
    firstFinds: readonly DueFirstFind[],
  ): void {
    this.firstFinds = [...firstFinds];
    const stars = arrivalStars(ending, areaStars);
    const text = arrivalText({
      reason: ending.reason,
      returnedNames: foundInfos(ending.returned).map((info) => info.name),
      bankedThisTripNames: foundInfos(ending.bankedThisTrip).map((info) => info.name),
      bankedTotal,
      rescuedNames: rescuedDisplayNames(ending.bankedThisTrip),
      waiting: waitingAxolotls(ending, waiting),
      stars,
    });
    this.showStars(stars);
    const arrivalSoundId = arrivalSound(ending.reason);
    if (arrivalSoundId !== null) playSound(arrivalSoundId);
    if (ending.reason === 'areaBeaten' && stars !== undefined) playSound('areaBeaten', areaBeatenSound(stars.earned).version);
    this.title.setText(text.title);
    this.bodyOptions = [`${text.body}\n${text.bankedLine}`, `${text.shortBody}\n${text.bankedLine}`];
    this.buildTreasureRow(foundInfos(namedTreasureIds(ending)).map((info) => info.id));
    this.shownAt = this.scene.time.now;
    this.layout(this.view);
    this.scene.tweens.killTweensOf(this.container);
    const ambient = this.motion().ambient;
    this.container.setVisible(true).setAlpha(ambient ? 0 : 1);
    if (ambient) {
      addMotionTween(this.scene, { targets: this.container, props: { alpha: 1 }, duration: FADE_MS });
    }
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(false).setAlpha(1);
  }

  /**
   * OK: once the card has shown for MIN_SHOW_MS, hides it, then shows the first queued first-find
   * card, or calls `onClose(false)` when none is queued. Ignored while hidden.
   */
  press(): void {
    if (!this.container.visible) return;
    if (this.scene.time.now - this.shownAt < MIN_SHOW_MS) return;
    this.hide();
    this.showNextFirstFind();
  }

  /**
   * Handles a key: a showing first-find card gets every key; otherwise confirm presses OK, ignoring
   * key repeat. Other keys do nothing.
   */
  handleKey(key: TankKey, repeat: boolean): void {
    if (this.firstFindCard.isShowing()) {
      this.firstFindCard.handleKey(key, repeat);
      return;
    }
    if (key === 'confirm' && !repeat) this.press();
  }

  setResolution(dpr: number): void {
    for (const text of [this.title, this.body]) {
      text.setResolution(dpr);
    }
    this.button.setResolution(dpr);
    this.firstFindCard.setResolution(dpr);
  }

  /**
   * Centres the panel on a canvas that has room for it. fitCard() sizes it from the head, the star
   * row (no room unless the area was beaten), the body (full or short wording, clipped only when
   * nothing fits), the treasure icon row and the button:
   * it tightens the padding on a short screen, shows only the icon rows that fit (hiding the other
   * icons) and keeps the button inside the canvas. The icon row wraps to cardIconRowWidth() (the text
   * width, or wider on a canvas over 500 px wide) and takes no room (nor padding) when empty or
   * hidden. Safe to call before show() and after hide().
   */
  layout(view: SceneView): void {
    this.view = view;
    const { cssW, cssH } = view;
    const textW = cardTextWidth(cssW);
    const iconRowW = cardIconRowWidth(cssW);
    this.title.setWordWrapWidth(homeTitleWrapWidth(textW), true);
    this.body.setWordWrapWidth(textW, true);
    const lineH = this.body.getTextMetrics().fontSize;
    const variants = this.bodyOptions.map((option) => ({ lines: wrappedLineCount(this.body, option), lineH }));
    const headH = Math.max(CARD.headIconPx, this.title.height);
    const availH = cssH - 2 * CARD.margin;
    const starRow = starRowSize();
    const fit = fitCard(availH, [
      { kind: 'fixed', height: headH },
      { kind: 'fixed', height: this.showsStars ? starRow.h : 0 },
      { kind: 'body', variants },
      { kind: 'icons', count: this.treasureIcons.length, maxW: iconRowW },
      { kind: 'actions', height: this.button.height },
    ]);
    const [headSlot, starRowSlot, bodySlot, iconsSlot, actionsSlot] = fit.slots;
    this.body.setText(this.bodyOptions[fit.bodyVariant]);
    this.body.setVisible(fit.bodyLines > 0);
    this.body.setMaxLines(fit.clipped ? fit.bodyLines : 0);
    this.treasureIcons.forEach((icon, index) => icon.setVisible(index < fit.iconCount));
    const { width: rowW } = iconRowsSize(fit.iconCount, iconRowW);
    const headW = CARD.headIconPx + CARD.headIconGap + this.title.width;
    const bodyW = fit.bodyLines > 0 ? this.body.width : 0;
    const starRowW = this.showsStars ? starRow.w : 0;
    const panelW = Math.min(
      cssW - 2 * CARD.margin,
      Math.max(headW, starRowW, bodyW, rowW, this.button.width) + 2 * CARD.pad,
    );
    const panelY = CARD.margin + Math.max(0, (availH - fit.panelH) / 2);
    drawPanel(this.panel, (cssW - panelW) / 2, panelY, panelW, fit.panelH, UI_PANEL);
    const headX = (cssW - headW) / 2;
    const headY = panelY + headSlot.top;
    this.icon.setPosition(headX, headY + (headH - CARD.headIconPx) / 2);
    this.headStar.setPosition(headX + CARD.headIconPx / 2, headY + headH / 2);
    this.placeStarRow((cssW - starRow.w) / 2, panelY + starRowSlot.top);
    this.title.setPosition(headX + CARD.headIconPx + CARD.headIconGap, headY + (headH - this.title.height) / 2);
    this.body.setPosition((cssW - this.body.width) / 2, panelY + bodySlot.top);
    if (fit.iconCount > 0) {
      placeIconRows(this.treasureIcons.slice(0, fit.iconCount), cssW / 2, panelY + iconsSlot.top, iconRowW);
    }
    this.button.container.setPosition((cssW - this.button.width) / 2, panelY + actionsSlot.top);
    this.firstFindCard.layout(view);
  }

  /** Shows the next queued first-find card, or calls `onClose(false)` when the queue is empty. */
  private showNextFirstFind(): void {
    const next = this.firstFinds.shift();
    if (next === undefined) {
      this.callbacks.onClose(false);
      return;
    }
    this.firstFindCard.show(next);
  }

  /**
   * A first-find card closed: reports its kind as seen at once, then calls `onClose(true)` (dropping
   * the rest of the queue) after "Try it now!", else shows the next card or calls `onClose(false)`.
   */
  private closeFirstFind(kind: FirstFindKind, outcome: FirstFindOutcome): void {
    this.callbacks.onFirstFindSeen(kind);
    if (outcome === 'tryItNow') {
      this.firstFinds = [];
      this.callbacks.onClose(true);
      return;
    }
    this.showNextFirstFind();
  }

  /**
   * Shows the earned Area star as the head icon and the star row, each star earned or missing, when
   * `stars` is set; otherwise the house icon and no star row.
   */
  private showStars(stars: ArrivalStars | undefined): void {
    this.showsStars = stars !== undefined;
    this.icon.setVisible(!this.showsStars);
    this.headStar.setVisible(this.showsStars);
    const earned = starFlags(stars?.earned ?? NO_STARS);
    this.starRow.forEach((star, index) => {
      showAreaStar(star, this.starTextures, earned[index], STAR_ROW.starPx);
      star.setVisible(this.showsStars);
    });
  }

  /** Places the star row's 40 px stars, 12 px apart, from the row's top-left corner. */
  private placeStarRow(left: number, top: number): void {
    this.starRow.forEach((star, index) =>
      star.setPosition(left + index * (STAR_ROW.starPx + STAR_ROW.gap) + STAR_ROW.starPx / 2, top + STAR_ROW.starPx / 2),
    );
  }

  /** Replaces the treasure icon row with one 32 px icon over its rarity glow per id. */
  private buildTreasureRow(ids: readonly string[]): void {
    for (const icon of this.treasureIcons) {
      icon.destroy();
    }
    this.treasureIcons = ids.map((id) => addGlowingTreasureIcon(this.scene, this.treasure, TREASURE_ICON_PX, id));
    this.container.add(this.treasureIcons);
  }
}
