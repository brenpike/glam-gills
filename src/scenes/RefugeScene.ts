import * as Phaser from 'phaser';
import { MAP_TITLE_PANEL, mapPanelSize, type MapPanelSpec } from '../art/drawAreaMap';
import { REFUGE_PLANTS_BASE, refugeTrashSlots, refugeTrashVariantAt } from '../art/drawRefuge';
import { isHabitatLookId, type HabitatLookId } from '../art/habitatLook';
import { LETTERBOX, UI_PANEL, UI_PANEL_PINK } from '../art/palette';
import type { TexInfo } from '../art/textures';
import { habitatById } from '../logic/areas';
import { refugeFactCardsDue, type FactCard as FactCardData } from '../logic/factCards';
import { GAME_EVENTS, REGISTRY_KEYS, type ReducedMotionPayload } from '../logic/gameEvents';
import type { Rect, Size } from '../logic/hudLayout';
import { motionProfile, type MotionProfile } from '../logic/motion';
import {
  REFUGE_HIDDEN_NAME,
  REFUGE_MORE_TO_COME,
  REFUGE_SEE_AGAIN_LABEL,
  REFUGE_TITLE,
  refugeAreaLine,
  refugeHiddenHint,
  refugeSections,
  withoutCleanUps,
  type RefugeBatch,
  type RefugeSection,
} from '../logic/refuge';
import {
  REFUGE_AREA_LINE_PAD_X,
  REFUGE_AREA_LINE_PAD_Y,
  REFUGE_BACK_BUTTON,
  REFUGE_BACK_LABEL,
  REFUGE_NEXT_LABEL,
  REFUGE_NEXT_TILE,
  REFUGE_PREV_LABEL,
  REFUGE_PREV_TILE,
  REFUGE_SEE_AGAIN_TILE,
  clampRefugeScroll,
  initialRefugeScroll,
  panRefugeScroll,
  refugeFocusTarget,
  refugeKey,
  refugeLayout,
  scrollToRefugeFocus,
  type RefugeAction,
  type RefugeEntry,
  type RefugeLayout,
  type RefugeMeasure,
  type RefugeSection as RefugeSectionRects,
} from '../logic/refugeUi';
import { explorerAxolotl, markFactCardFound } from '../logic/session';
import { tankKeyFor } from '../logic/tankUi';
import type { Vec2 } from '../logic/vec';
import {
  SCENE_KEYS,
  createButton,
  cssColor,
  drawPanel,
  readSceneView,
  uiTextStyle,
  useCssCamera,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';
import { FactCard } from './FactCard';
import { addMotionTween, settleMotionTweens } from './motionTweens';
import { RefugeMilestoneCard } from './RefugeMilestoneCard';
import {
  backFromRefuge,
  readRefugePending,
  readSession,
  writeRefugePending,
  writeSession,
  type RefugeStart,
} from './sceneFlow';

/** A section name label and the "More to come" label: bold ink 18 px on white, padding 8 across and 4 down. */
const NAME_PANEL: MapPanelSpec = { padX: 8, padY: 4, minH: 0, fill: UI_PANEL, fontPx: 18 };
/** A hidden section's hint ("Beat Area N"): bold ink 18 px on the area map's soft pink message fill, padding 8 across and 4 down. */
const HINT_PANEL: MapPanelSpec = { padX: 8, padY: 4, minH: 0, fill: UI_PANEL_PINK, fontPx: 18 };
/**
 * A section's area line ("Areas 2 and 3", issue #113, ND-8): bold ink 18 px on white, padding
 * REFUGE_AREA_LINE_PAD_X across and REFUGE_AREA_LINE_PAD_Y down, as refugeLayout measures it.
 */
const AREA_LINE_PANEL: MapPanelSpec = {
  padX: REFUGE_AREA_LINE_PAD_X,
  padY: REFUGE_AREA_LINE_PAD_Y,
  minH: 0,
  fill: UI_PANEL,
  fontPx: 18,
};
/** The "More to come" teaser picture shows dimmed. */
const TEASER_ALPHA = 0.5;
/** The fact cards and the milestone card sit above every refuge part. */
const CARD_DEPTH = 10;
/** The pending clean-ups start this long after the refuge shows (or its open cards close), so the trash is seen first. */
const CLEAN_UP_HOLD_MS = 600;
/** The trash floats up and fades over this long; the clean picture fades in and the plants grow over BLOOM_MS. */
const CLEAN_UP_MS = 900;
const BLOOM_MS = 900;
/** Under reduced motion the trash, the clean picture and the plants only fade, over this long. */
const QUICK_FADE_MS = 200;
/** The trash floats up this far as it fades, in CSS px; it stays put under reduced motion. */
const TRASH_FLOAT_PX = 24;
/** The sparkle over a batch grows from this share of its size to SPARKLE_END_SCALE while it flashes. */
const SPARKLE_START_SCALE = 0.6;
const SPARKLE_END_SCALE = 1.2;
/** A focus move or a pan scrolls the refuge over this long; at once under reduced motion. */
const SCROLL_MS = 300;
/** A press in the refuge becomes a drag once the pointer has moved this far, in CSS px (as on the area map). */
const DRAG_START_PX = 8;
const BACKDROP_COVER = 8192;
const CAPTURED_KEYS: readonly number[] = [
  Phaser.Input.Keyboard.KeyCodes.TAB,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
];

/**
 * Where the pending clean-ups are: none to show, waiting for the open cards to close, holding
 * before they start, running, or done.
 */
type CleanUpStage = 'none' | 'waiting' | 'holding' | 'running' | 'done';

/** A text panel: its Graphics body and its text. */
interface PanelParts {
  panel: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

/**
 * One trash batch on a section picture: its batch index in the section (its slot and variant), its
 * sprite, its sparkle (only on a batch that is cleaned up now), whether it is cleaned up now, and
 * where it rests (content CSS px).
 */
interface TrashParts {
  slot: number;
  image: Phaser.GameObjects.Image;
  sparkle: Phaser.GameObjects.Image | null;
  cleansNow: boolean;
  at: Vec2;
}

/**
 * One section's objects: its name label, its area line (every section but a hidden one), its
 * picture, the clean picture and plants layer (the clean picture only on a section that turns clean
 * now, the plants on every clean one), its trash, its hint (hidden sections) and its "See it again"
 * tile (clean sections).
 */
interface SectionParts {
  section: RefugeSection;
  name: PanelParts;
  areaLine: PanelParts | null;
  picture: Phaser.GameObjects.Image;
  pictureInfo: TexInfo;
  cleanPicture: Phaser.GameObjects.Image | null;
  plants: Phaser.GameObjects.Image | null;
  blooms: boolean;
  trash: TrashParts[];
  hint: PanelParts | null;
  seeAgain: UiButton | null;
}

/** A press in the refuge viewport: the pointer, where it went down (screen CSS px), the scroll then, and whether it is a drag. */
interface RefugePress {
  pointerId: number;
  down: Vec2;
  scrollAtDown: number;
  dragging: boolean;
}

/** The section look of `section` as a habitat look id. Throws a RangeError for an unknown look; it never falls back to the canal. */
function sectionLook(section: Readonly<RefugeSection>): HabitatLookId {
  if (!isHabitatLookId(section.look)) {
    throw new RangeError(`RefugeScene: no refuge look ${section.look} for habitat ${section.habitatId}`);
  }
  return section.look;
}

/** Shows the baked texture `info` at its logical size with its anchor at (`x`, `y`). */
function placeBaked(image: Phaser.GameObjects.Image, info: TexInfo, x: number, y: number): Phaser.GameObjects.Image {
  return image
    .setTexture(info.key)
    .setOrigin(info.originNormX, info.originNormY)
    .setScale(1 / info.scale)
    .setPosition(x, y);
}

/** Wraps `text` at `wrapW` less the padding across of `spec` and returns its panel size, in whole CSS px. */
function panelSizeFor(text: Phaser.GameObjects.Text, wrapW: number, spec: MapPanelSpec): Size {
  text.setWordWrapWidth(Math.max(1, wrapW - 2 * spec.padX), true);
  const size = mapPanelSize(text.width, text.height, spec);
  return { w: Math.ceil(size.w), h: Math.ceil(size.h) };
}

/** Draws the panel of `parts` at `rect` in the fill of `spec` and centres its text there (wrapped with 1 px slack, so it breaks as measured). */
function placePanel(parts: PanelParts, rect: Rect, spec: MapPanelSpec): void {
  drawPanel(parts.panel, rect.x, rect.y, rect.w, rect.h, spec.fill);
  parts.text.setWordWrapWidth(Math.max(1, rect.w - 2 * spec.padX + 1), true);
  parts.text.setPosition(rect.x + (rect.w - parts.text.width) / 2, rect.y + (rect.h - parts.text.height) / 2);
}

/** A rect of `size` centred in `box`. */
function centredIn(size: Size, box: Rect): Rect {
  return { x: box.x + (box.w - size.w) / 2, y: box.y + (box.h - size.h) / 2, w: size.w, h: size.h };
}

/** Whether `point` is inside `rect`, edges included. */
function rectContains(rect: Rect, point: Vec2): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/**
 * The Xochimilco refuge (PRD N2; issue #74), opened from the Home Tank: one section per habitat from
 * refugeSections(), then the dim "More to come" teaser, laid out by refugeLayout(). Back, the title
 * and the Prev and Next pan tiles are fixed on the main camera; the sections are drawn by a second
 * camera whose viewport is the layout's viewport, so they scroll along x by drag (1:1, no fling,
 * from 8 px), by the wheel, by Prev and Next (panRefugeScroll) and to follow the focus
 * (scrollToRefugeFocus). A third, full-canvas camera draws only the fact and milestone cards, last,
 * so a card and its dim cover the sections.
 *
 * A hidden section shows its silhouette, "???" and its hint ("Beat Area N"); every other section
 * shows its area line ("Areas 2 and 3") under its name, or over the top of its picture where the
 * layout has no row for it (issue #113, ND-8). A dirty section shows
 * its dirty picture with a trash batch for each area not yet beaten; a clean one its clean picture,
 * its plants and a "See it again" tile that shows its milestone card again, naming the current
 * explorer.
 *
 * On open the pending clean-ups are taken from the registry at once (withoutCleanUps), so leaving
 * early loses only the animation. Their batches show at first, then (after any open fact card)
 * float up and fade with a sparkle, together; a section that is clean now then fades to its clean
 * picture as its plants grow from their base. Under reduced motion every part only fades, quickly.
 * The refuge opens scrolled to the first section with a pending clean-up.
 *
 * The refuge fact cards due on open (refugeFactCardsDue) show first, "Axolotl refuges" then "Canal
 * clean-ups" (due once already cleared trash shows); after the clean-ups "Canal clean-ups" shows if
 * still not found. Each card is found (markFactCardFound) and saved (writeSession) on close.
 *
 * Keys go to the open card first, else through refugeKey(). Back or Escape goes back to the Home
 * Tank (backFromRefuge), once. Focus shows by the focused button visual, never by colour alone.
 */
export class RefugeScene extends Phaser.Scene {
  private assets!: GameAssets;
  private view!: SceneView;
  private motion!: MotionProfile;
  private sections: RefugeSection[] = [];
  private entries: RefugeEntry[] = [];
  private placed: RefugeLayout | null = null;
  /** Focus index (refugeFocusTarget): a "See it again" tile, Prev, Next or Back. */
  private focusIndex = 0;
  private leaving = false;
  private press: RefugePress | null = null;

  private mapCamera!: Phaser.Cameras.Scene2D.Camera;
  /** The full-canvas camera, added after the map camera, that draws only the open fact or milestone card. */
  private cardCamera!: Phaser.Cameras.Scene2D.Camera;
  private fixedLayer!: Phaser.GameObjects.Container;
  private mapLayer!: Phaser.GameObjects.Container;
  private title!: PanelParts;
  private backButton!: UiButton;
  private prevButton!: UiButton;
  private nextButton!: UiButton;
  private parts: SectionParts[] = [];
  private teaserPicture!: Phaser.GameObjects.Image;
  private teaserLabel!: PanelParts;

  private factCard!: FactCard;
  private cardQueue: Readonly<FactCardData>[] = [];
  private shownCard: Readonly<FactCardData> | null = null;
  private milestoneCard: RefugeMilestoneCard | null = null;

  private cleanUpStage: CleanUpStage = 'none';
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  /** Share of the trash clean-up done, 0 to 1; the clean-up tweens `progress`. */
  private readonly cleanUp = { progress: 0 };
  /** Share of the clean picture and plants grown in, 0 to 1; the bloom tweens `progress`. */
  private readonly bloom = { progress: 0 };
  /** Scroll along x, in content CSS px; the scroll tween tweens `value` towards `scrollGoal`. */
  private readonly scroll = { value: 0 };
  private scrollGoal = 0;
  private scrollTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super(SCENE_KEYS.refuge);
  }

  init(data: RefugeStart): void {
    this.assets = data.assets;
    this.sections = [];
    this.entries = [];
    this.placed = null;
    this.focusIndex = 0;
    this.leaving = false;
    this.press = null;
    this.parts = [];
    this.cardQueue = [];
    this.shownCard = null;
    this.milestoneCard = null;
    this.cleanUpStage = 'none';
    this.holdTimer = null;
    this.cleanUp.progress = 0;
    this.bloom.progress = 0;
    this.scroll.value = 0;
    this.scrollGoal = 0;
    this.scrollTween = null;
  }

  create(): void {
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    const hub = readSession(this.registry).hub;
    const pending = readRefugePending(this.registry);
    writeRefugePending(this.registry, withoutCleanUps(pending));
    const cleanUps = new Set(pending.cleanUps);
    const cleansNow = (batch: Readonly<RefugeBatch>): boolean => batch.cleared && cleanUps.has(batch.areaId);
    this.sections = refugeSections(hub.stars);
    this.entries = this.sections.map((section) => ({ id: section.habitatId, seeAgain: section.state === 'clean' }));
    useCssCamera(this.cameras.main, this.view.fit.dpr);
    this.cameras.main.setBackgroundColor(LETTERBOX);

    this.buildFixed();
    this.buildMap(cleansNow);
    this.mapCamera = this.cameras.add(0, 0, 1, 1);
    this.cardCamera = this.cameras.add();
    useCssCamera(this.cardCamera, this.view.fit.dpr);
    this.cameras.main.ignore(this.mapLayer);
    this.mapCamera.ignore(this.fixedLayer);
    this.cardCamera.ignore([this.fixedLayer, this.mapLayer]);
    this.factCard = this.onCardCamera(
      () => new FactCard(this, this.assets, this.view, CARD_DEPTH, () => this.closeFactCard()),
    );

    this.bindInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.focusIndex = this.backFocus();
    this.layout();
    this.openAtFirstCleanUp(cleansNow);

    const clearedShown = this.sections.some(
      (section) => section.state !== 'hidden' && section.batches.some((batch) => batch.cleared && !cleansNow(batch)),
    );
    this.cardQueue = refugeFactCardsDue(hub.metHazards, clearedShown);
    if (this.parts.some((parts) => parts.trash.some((trash) => trash.cleansNow))) this.cleanUpStage = 'waiting';
    this.advance();
  }

  /** Shows the tweened scroll and clean-up. */
  update(): void {
    this.syncMapCamera();
    this.applyCleanUp();
  }

  // ---- build ---------------------------------------------------------------

  /** The fixed parts on the main camera: the backdrop, the title, Back, Prev and Next. */
  private buildFixed(): void {
    const dpr = this.view.fit.dpr;
    const backdrop = this.add
      .rectangle(-BACKDROP_COVER / 2, -BACKDROP_COVER / 2, BACKDROP_COVER, BACKDROP_COVER, cssColor(LETTERBOX).color, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.title = this.addPanel(MAP_TITLE_PANEL.fontPx, REFUGE_TITLE);
    this.backButton = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: 1,
      width: REFUGE_BACK_BUTTON.w,
      label: REFUGE_BACK_LABEL,
      icon: 'left',
      dpr,
      pressOnDown: false,
      onPress: () => this.goBack(),
    });
    this.prevButton = this.createPanTile(REFUGE_PREV_LABEL, REFUGE_PREV_TILE.w, 'left', -1);
    this.nextButton = this.createPanTile(REFUGE_NEXT_LABEL, REFUGE_NEXT_TILE.w, 'right', 1);
    this.fixedLayer = this.add.container(0, 0, [
      backdrop,
      this.title.panel,
      this.title.text,
      this.backButton.container,
      this.prevButton.container,
      this.nextButton.container,
    ]);
  }

  /** A Prev or Next pan tile: a size-1 square tile `width` wide, its icon over `label`, panning one section by `step`. */
  private createPanTile(label: string, width: number, icon: 'left' | 'right', step: 1 | -1): UiButton {
    return createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'square',
      size: 1,
      width,
      label,
      icon,
      dpr: this.view.fit.dpr,
      pressOnDown: false,
      onPress: () => this.pressPan(step),
    });
  }

  /** The scrolling parts on the map camera: every section, then the teaser. */
  private buildMap(cleansNow: (batch: Readonly<RefugeBatch>) => boolean): void {
    this.parts = this.sections.map((section) => this.createSection(section, cleansNow));
    this.teaserPicture = this.add.image(0, 0, this.assets.refuge.teaser.key).setAlpha(TEASER_ALPHA);
    this.teaserLabel = this.addPanel(NAME_PANEL.fontPx, REFUGE_MORE_TO_COME);
    this.mapLayer = this.add.container(0, 0, [
      ...this.parts.flatMap((parts) => this.sectionObjects(parts)),
      this.teaserPicture,
      this.teaserLabel.panel,
      this.teaserLabel.text,
    ]);
  }

  /**
   * One section's objects. The picture is the hidden silhouette, the dirty picture (a dirty section,
   * or a section that turns clean now) or the clean one. Trash lies at refugeTrashSlots() for every
   * batch not yet cleared or cleaned up now, never on a hidden section (its silhouette only).
   */
  private createSection(section: RefugeSection, cleansNow: (batch: Readonly<RefugeBatch>) => boolean): SectionParts {
    const art = this.assets.refuge;
    const hidden = section.state === 'hidden';
    const look = hidden ? null : sectionLook(section);
    const blooms = section.state === 'clean' && section.batches.some(cleansNow);
    const showsClean = section.state === 'clean' && !blooms;
    const pictureInfo = look === null ? art.hidden : art.sections[look][showsClean ? 'clean' : 'dirty'];
    const areaLine = refugeAreaLine(section);
    const trash = hidden
      ? []
      : section.batches.flatMap((batch, index) =>
          batch.cleared && !cleansNow(batch) ? [] : [this.createTrash(index, cleansNow(batch))],
        );
    return {
      section,
      name: this.addPanel(NAME_PANEL.fontPx, hidden ? REFUGE_HIDDEN_NAME : section.habitatName),
      areaLine: areaLine === null ? null : this.addPanel(AREA_LINE_PANEL.fontPx, areaLine),
      picture: this.add.image(0, 0, pictureInfo.key),
      pictureInfo,
      cleanPicture: look !== null && blooms ? this.add.image(0, 0, art.sections[look].clean.key) : null,
      plants: look !== null && section.state === 'clean' ? this.add.image(0, 0, art.plants[look].key) : null,
      blooms,
      trash,
      hint: hidden ? this.addPanel(HINT_PANEL.fontPx, refugeHiddenHint(section.firstAreaNumber)) : null,
      seeAgain: section.state === 'clean' ? this.createSeeAgain(section) : null,
    };
  }

  /** The trash batch at slot `index`, in the variant of that slot, with a sparkle when it is cleaned up now. */
  private createTrash(index: number, cleansNow: boolean): TrashParts {
    const art = this.assets.refuge;
    const info = art.trash[refugeTrashVariantAt(index)];
    return {
      slot: index,
      image: this.add.image(0, 0, info.key),
      sparkle: cleansNow ? this.add.image(0, 0, art.sparkle.key).setVisible(false) : null,
      cleansNow,
      at: { x: 0, y: 0 },
    };
  }

  /** The "See it again" tile of clean section `section`. */
  private createSeeAgain(section: RefugeSection): UiButton {
    return createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'square',
      size: 1,
      width: REFUGE_SEE_AGAIN_TILE.w,
      label: REFUGE_SEE_AGAIN_LABEL,
      icon: 'play',
      dpr: this.view.fit.dpr,
      pressOnDown: false,
      onPress: () => this.tapSeeAgain(section.habitatId),
    });
  }

  /** A section's objects, back to front: pictures, plants, trash, sparkles, then its labels and tile. */
  private sectionObjects(parts: SectionParts): Phaser.GameObjects.GameObject[] {
    return [
      parts.picture,
      ...(parts.cleanPicture === null ? [] : [parts.cleanPicture]),
      ...(parts.plants === null ? [] : [parts.plants]),
      ...parts.trash.map((trash) => trash.image),
      ...parts.trash.flatMap((trash) => (trash.sparkle === null ? [] : [trash.sparkle])),
      parts.name.panel,
      parts.name.text,
      ...(parts.areaLine === null ? [] : [parts.areaLine.panel, parts.areaLine.text]),
      ...(parts.hint === null ? [] : [parts.hint.panel, parts.hint.text]),
      ...(parts.seeAgain === null ? [] : [parts.seeAgain.container]),
    ];
  }

  /** A panel body and its bold ink text `label` of `sizePx`, centred line by line. */
  private addPanel(sizePx: number, label: string): PanelParts {
    return {
      panel: this.add.graphics(),
      text: this.add.text(0, 0, label, { ...uiTextStyle(sizePx, this.view.fit.dpr), align: 'center' }),
    };
  }

  /**
   * Runs `build`, then keeps every object it added to the scene off the main and map cameras, so a
   * card shows once, on the card camera. The card camera renders after the map camera, so the card
   * and its dim cover the scrolling sections, and it takes the pointer first.
   */
  private onCardCamera<T>(build: () => T): T {
    const before = new Set(this.children.list);
    const built = build();
    const added = this.children.list.filter((child) => !before.has(child));
    this.cameras.main.ignore(added);
    this.mapCamera.ignore(added);
    return built;
  }

  /** One keydown handler for every refuge key, and the pointer and wheel handlers; Tab, Left, Right and Space are captured. */
  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture([...CAPTURED_KEYS]);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
  }

  // ---- layout --------------------------------------------------------------

  /** The parts of section `id`. Throws when there is none. */
  private partsOf(id: string): SectionParts {
    const parts = this.parts.find((each) => each.section.habitatId === id);
    if (parts === undefined) throw new Error(`RefugeScene: no section ${id}`);
    return parts;
  }

  /** The text measures the layout reads: each panel's size with its text wrapped at the width given. */
  private measure(): RefugeMeasure {
    return {
      title: (wrapW) => panelSizeFor(this.title.text, wrapW, MAP_TITLE_PANEL),
      name: (id, wrapW) => panelSizeFor(this.partsOf(id).name.text, wrapW, NAME_PANEL),
      hint: (id, wrapW) => {
        const hint = this.partsOf(id).hint;
        return hint === null ? null : panelSizeFor(hint.text, wrapW, HINT_PANEL);
      },
      areaLine: (id, wrapW) => {
        const areaLine = this.partsOf(id).areaLine;
        return areaLine === null ? null : panelSizeFor(areaLine.text, wrapW, AREA_LINE_PANEL);
      },
    };
  }

  /**
   * Lays the refuge out for the canvas with refugeLayout(), places the fixed parts, the sections
   * and the map camera, then scrolls at once to keep the focused tile in view.
   */
  private layout(): void {
    const placed = refugeLayout(this.view, this.entries, this.measure());
    this.placed = placed;
    this.layoutFixed(placed);
    placed.sections.forEach((rects, index) => this.layoutSection(this.parts[index], rects));
    this.layoutTeaser(placed);
    this.placeMapCamera(placed);
    this.stopScrollTween();
    this.applyScroll(scrollToRefugeFocus(placed, this.focusIndex, clampRefugeScroll(placed, this.scroll.value)));
    this.refreshFocus();
    this.applyCleanUp();
  }

  /** Places the title (hidden when the layout hides it), Back, Prev and Next. */
  private layoutFixed(placed: RefugeLayout): void {
    const title = placed.title;
    this.title.panel.setVisible(title !== null);
    this.title.text.setVisible(title !== null);
    if (title !== null) placePanel(this.title, title, MAP_TITLE_PANEL);
    this.backButton.container.setPosition(placed.back.x, placed.back.y);
    this.prevButton.container.setPosition(placed.prev.x, placed.prev.y);
    this.nextButton.container.setPosition(placed.next.x, placed.next.y);
  }

  /** Places one section's parts at its rects, in content CSS px. */
  private layoutSection(parts: SectionParts, rects: RefugeSectionRects): void {
    const picture = rects.picture;
    const art = this.assets.refuge;
    placeBaked(parts.picture, parts.pictureInfo, picture.x, picture.y);
    if (parts.cleanPicture !== null) {
      placeBaked(parts.cleanPicture, art.sections[sectionLook(parts.section)].clean, picture.x, picture.y);
    }
    if (parts.plants !== null) {
      const plantsInfo = art.plants[sectionLook(parts.section)];
      placeBaked(parts.plants, plantsInfo, picture.x + REFUGE_PLANTS_BASE.x, picture.y + REFUGE_PLANTS_BASE.y);
    }
    const slots = refugeTrashSlots(parts.section.batches.length);
    for (const trash of parts.trash) {
      trash.at = { x: picture.x + slots[trash.slot].x, y: picture.y + slots[trash.slot].y };
      placeBaked(trash.image, art.trash[refugeTrashVariantAt(trash.slot)], trash.at.x, trash.at.y);
      if (trash.sparkle !== null) placeBaked(trash.sparkle, art.sparkle, trash.at.x, trash.at.y);
    }
    placePanel(parts.name, rects.name, NAME_PANEL);
    if (parts.areaLine !== null && rects.areaLine !== null) placePanel(parts.areaLine, rects.areaLine, AREA_LINE_PANEL);
    if (parts.hint !== null && rects.hint !== null) placePanel(parts.hint, rects.hint, HINT_PANEL);
    if (parts.seeAgain !== null && rects.seeAgain !== null) {
      parts.seeAgain.container.setPosition(rects.seeAgain.x, rects.seeAgain.y);
    }
  }

  /**
   * Places the dim teaser picture level with the section pictures, and "More to come" in the name
   * row above it, level with the section names (the name row is centred on them, above any area line).
   */
  private layoutTeaser(placed: RefugeLayout): void {
    const first = placed.sections[0];
    const teaser = placed.teaser;
    placeBaked(this.teaserPicture, this.assets.refuge.teaser, teaser.x, first.picture.y);
    const nameRowH = 2 * (first.name.y + first.name.h / 2 - first.rect.y);
    const nameRow: Rect = { x: teaser.x, y: first.rect.y, w: teaser.w, h: nameRowH };
    const size = panelSizeFor(this.teaserLabel.text, teaser.w, NAME_PANEL);
    placePanel(this.teaserLabel, centredIn(size, nameRow), NAME_PANEL);
  }

  /** Points the map camera at the layout's viewport, in canvas px, at CSS px zoom. */
  private placeMapCamera(placed: RefugeLayout): void {
    const dpr = this.view.fit.dpr;
    const viewport = placed.viewport;
    this.mapCamera
      .setViewport(
        Math.round(viewport.x * dpr),
        Math.round(viewport.y * dpr),
        Math.max(1, Math.round(viewport.w * dpr)),
        Math.max(1, Math.round(viewport.h * dpr)),
      )
      .setOrigin(0, 0)
      .setZoom(dpr);
  }

  // ---- scroll and focus ----------------------------------------------------

  /** Opens scrolled to the first section with a clean-up now, if any (initialRefugeScroll). */
  private openAtFirstCleanUp(cleansNow: (batch: Readonly<RefugeBatch>) => boolean): void {
    const placed = this.placed;
    const index = this.sections.findIndex((section) => section.batches.some(cleansNow));
    if (placed === null || index < 0) return;
    this.applyScroll(initialRefugeScroll(placed, index));
  }

  /** Scrolls the refuge to `value`, clamped, at once. */
  private applyScroll(value: number): void {
    const placed = this.placed;
    this.scroll.value = placed === null ? 0 : clampRefugeScroll(placed, value);
    this.scrollGoal = this.scroll.value;
    this.syncMapCamera();
  }

  /** Shows the scroll on the map camera, along x. */
  private syncMapCamera(): void {
    if (this.placed === null) return;
    this.mapCamera.setScroll(this.scroll.value, 0);
  }

  /** Stops the scroll tween where it is, if it is running. */
  private stopScrollTween(): void {
    this.scrollTween?.stop();
    this.scrollTween = null;
    this.scrollGoal = this.scroll.value;
  }

  /** Scrolls to `target`: eased over SCROLL_MS from where the scroll is, or at once under reduced motion. */
  private scrollTo(target: number): void {
    if (target === this.scrollGoal) return;
    this.stopScrollTween();
    if (!this.motion.ambient) {
      this.applyScroll(target);
      return;
    }
    this.scrollGoal = target;
    this.scrollTween = addMotionTween(this, {
      targets: this.scroll,
      props: { value: target },
      duration: SCROLL_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scrollTween = null;
      },
    });
  }

  /** Focus index of Back: after every "See it again" tile, Prev and Next. */
  private backFocus(): number {
    return this.entries.filter((entry) => entry.seeAgain).length + 2;
  }

  /** Moves the focus to `index` and scrolls the refuge to show it. */
  private setFocus(index: number): void {
    this.focusIndex = index;
    this.refreshFocus();
    const placed = this.placed;
    if (placed !== null) this.scrollTo(scrollToRefugeFocus(placed, index, this.scrollGoal));
  }

  /** The focused button visual on the focused control; every other control unfocused. */
  private refreshFocus(): void {
    const placed = this.placed;
    if (placed === null) return;
    const target = refugeFocusTarget(placed, this.focusIndex);
    this.backButton.setFocused(target.kind === 'back');
    this.prevButton.setFocused(target.kind === 'prev');
    this.nextButton.setFocused(target.kind === 'next');
    for (const parts of this.parts) {
      parts.seeAgain?.setFocused(target.kind === 'seeAgain' && target.id === parts.section.habitatId);
    }
  }

  /** Pans one section back (-1) or on (1) from where the scroll is heading; nothing at either end. */
  private pan(step: 1 | -1): void {
    const placed = this.placed;
    if (placed === null) return;
    this.scrollTo(panRefugeScroll(placed, this.scrollGoal, step));
  }

  // ---- clean-up ------------------------------------------------------------

  /** Holds CLEAN_UP_HOLD_MS, then starts the clean-up unless a card has opened meanwhile (it then waits for the card). */
  private holdCleanUp(): void {
    this.cleanUpStage = 'holding';
    this.holdTimer = this.time.delayedCall(CLEAN_UP_HOLD_MS, () => this.endCleanUpHold());
  }

  private endCleanUpHold(): void {
    this.holdTimer = null;
    if (this.leaving) return;
    if (this.cardShowing()) {
      this.cleanUpStage = 'waiting';
      return;
    }
    this.cleanUpStage = 'running';
    addMotionTween(this, {
      targets: this.cleanUp,
      props: { progress: 1 },
      duration: this.motion.ambient ? CLEAN_UP_MS : QUICK_FADE_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.startBloom(),
    });
  }

  /** The trash is gone: sections clean now fade to their clean picture and grow their plants, if any. */
  private startBloom(): void {
    if (this.leaving) return;
    if (!this.parts.some((parts) => parts.blooms)) {
      this.finishCleanUp();
      return;
    }
    addMotionTween(this, {
      targets: this.bloom,
      props: { progress: 1 },
      duration: this.motion.ambient ? BLOOM_MS : QUICK_FADE_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.finishCleanUp(),
    });
  }

  /** The clean-ups are shown: the canal clean-ups card follows if it is still not found. */
  private finishCleanUp(): void {
    if (this.leaving) return;
    this.cleanUpStage = 'done';
    this.cardQueue.push(...refugeFactCardsDue(readSession(this.registry).hub.metHazards, true));
    this.advance();
  }

  /**
   * Shows the clean-up as far as it has gone. Trash cleaned up now fades as it floats up, with its
   * sparkle flashing and growing; under reduced motion it only fades. A section clean now fades in
   * its clean picture over its dirty one, and grows its plants from their base; under reduced
   * motion the plants only fade in.
   */
  private applyCleanUp(): void {
    const cleanUp = Math.max(0, Math.min(1, this.cleanUp.progress));
    const bloom = Math.max(0, Math.min(1, this.bloom.progress));
    const sparkleInfo = this.assets.refuge.sparkle;
    for (const parts of this.parts) {
      for (const trash of parts.trash) {
        if (!trash.cleansNow) continue;
        const rise = this.motion.ambient ? TRASH_FLOAT_PX * cleanUp : 0;
        trash.image.setPosition(trash.at.x, trash.at.y - rise).setAlpha(1 - cleanUp).setVisible(cleanUp < 1);
        trash.sparkle
          ?.setVisible(this.motion.ambient && cleanUp > 0 && cleanUp < 1)
          .setAlpha(Math.sin(Math.PI * cleanUp))
          .setScale((SPARKLE_START_SCALE + (SPARKLE_END_SCALE - SPARKLE_START_SCALE) * cleanUp) / sparkleInfo.scale);
      }
      if (!parts.blooms) continue;
      parts.cleanPicture?.setAlpha(bloom);
      this.growPlants(parts, bloom);
    }
  }

  /** The plants of a section clean now at `bloom` (0 to 1): scaled up from their base, or faded in under reduced motion. */
  private growPlants(parts: SectionParts, bloom: number): void {
    const plants = parts.plants;
    if (plants === null) return;
    const info = this.assets.refuge.plants[sectionLook(parts.section)];
    const grow = this.motion.ambient ? bloom : 1;
    plants.setScale(grow / info.scale).setAlpha(this.motion.ambient ? 1 : bloom).setVisible(bloom > 0);
  }

  // ---- cards ---------------------------------------------------------------

  /** Whether the fact card or the milestone card is open. */
  private cardShowing(): boolean {
    return this.factCard.isShowing() || this.milestoneCard !== null;
  }

  /**
   * With no card open: shows the next queued fact card, or else starts the pending clean-ups when
   * they are waiting.
   */
  private advance(): void {
    if (this.leaving || this.cardShowing()) return;
    const card = this.cardQueue.shift();
    if (card !== undefined) {
      this.shownCard = card;
      this.factCard.show(card);
      return;
    }
    if (this.cleanUpStage === 'waiting') this.holdCleanUp();
  }

  /** OK on a fact card: the card is found and saved, then the next card or the clean-ups follow. */
  private closeFactCard(): void {
    const card = this.shownCard;
    if (card === null) throw new Error('RefugeScene: a fact card closed before any was shown');
    this.shownCard = null;
    const current = readSession(this.registry);
    const next = markFactCardFound(current, card.id);
    if (next !== current) writeSession(this.registry, next);
    this.advance();
  }

  /** A press on the "See it again" tile of section `id`, unless it ended a drag or a card is open. */
  private tapSeeAgain(id: string): void {
    if (this.press?.dragging === true) return;
    this.showMilestone(id);
  }

  /** Shows the milestone card of section `id` again, naming the current explorer. Throws for an unknown habitat. */
  private showMilestone(id: string): void {
    if (this.leaving || this.cardShowing()) return;
    const habitat = habitatById(id);
    if (habitat === undefined) throw new Error(`RefugeScene: no habitat ${id}`);
    const explorerName = explorerAxolotl(readSession(this.registry)).name;
    this.milestoneCard = this.onCardCamera(
      () =>
        new RefugeMilestoneCard(this, this.assets, this.view, CARD_DEPTH, habitat, explorerName, () =>
          this.closeMilestone(),
        ),
    );
  }

  private closeMilestone(): void {
    this.milestoneCard?.destroy();
    this.milestoneCard = null;
    this.advance();
  }

  // ---- input ---------------------------------------------------------------

  /** Back or Escape: back to the Home Tank with the Refuge tile focused, once. */
  private goBack(): void {
    if (this.leaving) return;
    this.leaving = true;
    backFromRefuge(this, this.assets);
  }

  /** A press on Prev or Next; ignored while a card is open. */
  private pressPan(step: 1 | -1): void {
    if (this.leaving || this.cardShowing()) return;
    this.pan(step);
  }

  /** Runs what a key asked for. */
  private runAction(action: RefugeAction): void {
    const placed = this.placed;
    if (placed === null) return;
    if (action === 'back') this.goBack();
    else if (action === 'panPrev') this.pan(-1);
    else if (action === 'panNext') this.pan(1);
    else if (action === 'seeAgain') {
      const target = refugeFocusTarget(placed, this.focusIndex);
      if (target.kind === 'seeAgain') this.showMilestone(target.id);
    }
  }

  /**
   * Every refuge key: an open milestone card or fact card takes it first (Enter, Space or Escape
   * close it, ignoring key repeat on the fact card), else refugeKey(): Tab and Shift+Tab move the
   * focus (scrolling to it), Left and Right pan, Enter and Space press, Escape is Back.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.leaving) return;
    const key = tankKeyFor(event.key, event.shiftKey);
    if (key === null) return;
    if (this.milestoneCard !== null) {
      this.milestoneCard.handleKey(key, event.repeat);
      return;
    }
    if (this.factCard.isShowing()) {
      if (!event.repeat && (key === 'confirm' || key === 'cancel')) this.factCard.press();
      return;
    }
    const placed = this.placed;
    if (placed === null) return;
    const result = refugeKey(this.focusIndex, key, event.repeat, placed);
    if (result.focus !== this.focusIndex) this.setFocus(result.focus);
    this.runAction(result.action);
  }

  /** The pointer's position in screen CSS px. */
  private cssPoint(pointer: Phaser.Input.Pointer): Vec2 {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x, y: point.y };
  }

  /** A press in the viewport, with no card open, may become a drag. */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.leaving || this.press !== null || this.cardShowing()) return;
    const down = this.cssPoint(pointer);
    if (this.placed === null || !rectContains(this.placed.viewport, down)) return;
    this.press = { pointerId: pointer.id, down, scrollAtDown: this.scroll.value, dragging: false };
  }

  /** Once the press has moved DRAG_START_PX it drags the refuge 1:1 along x, with no fling. */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (press === null || pointer.id !== press.pointerId || this.leaving) return;
    const at = this.cssPoint(pointer);
    if (!press.dragging) {
      if (Math.hypot(at.x - press.down.x, at.y - press.down.y) < DRAG_START_PX) return;
      press.dragging = true;
      this.stopScrollTween();
    }
    this.applyScroll(press.scrollAtDown - (at.x - press.down.x));
  }

  /** The press ends, on the canvas or off it. A tile press already ran before this, unless it was a drag. */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.press?.pointerId === pointer.id) this.press = null;
  }

  /** The wheel scrolls the refuge along x by the larger of the two wheel deltas; ignored while a card is open. */
  private handleWheel(_pointer: Phaser.Input.Pointer, _over: unknown, deltaX: number, deltaY: number): void {
    if (this.placed === null || this.leaving || this.cardShowing()) return;
    this.stopScrollTween();
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    this.applyScroll(this.scroll.value + delta);
  }

  // ---- events --------------------------------------------------------------

  /** Switches the motion profile. Under reduced motion running tweens end at once. */
  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
    if (!this.motion.ambient) settleMotionTweens(this);
    this.syncMapCamera();
    this.applyCleanUp();
  }

  /** Every text object and button, for a resolution change. */
  private setResolution(dpr: number): void {
    const panels = [
      this.title,
      this.teaserLabel,
      ...this.parts.flatMap((parts) => [parts.name, ...(parts.areaLine ? [parts.areaLine] : []), ...(parts.hint ? [parts.hint] : [])]),
    ];
    for (const parts of panels) {
      parts.text.setResolution(dpr);
    }
    const buttons = [this.backButton, this.prevButton, this.nextButton, ...this.parts.flatMap((parts) => parts.seeAgain ?? [])];
    for (const button of buttons) {
      button.setResolution(dpr);
    }
    this.factCard.setResolution(dpr);
    this.milestoneCard?.setResolution(dpr);
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const dpr = this.view.fit.dpr;
    useCssCamera(this.cameras.main, dpr);
    useCssCamera(this.cardCamera, dpr);
    this.setResolution(dpr);
    this.layout();
    this.factCard.layout(this.view);
    this.milestoneCard?.layout(this.view);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    if (this.holdTimer) this.time.removeEvent(this.holdTimer);
    this.holdTimer = null;
    this.tweens.killAll();
    this.scrollTween = null;
    this.press = null;
    this.milestoneCard?.destroy();
    this.milestoneCard = null;
    this.cardQueue = [];
    this.shownCard = null;
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
    keyboard.removeCapture([...CAPTURED_KEYS]);
  }
}
