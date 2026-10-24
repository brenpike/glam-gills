import * as Phaser from 'phaser';
import {
  areaMapPanelKey,
  areaMapTabKey,
  bakeAreaMapPanel,
  bakeAreaMapPath,
  bakeAreaMapTab,
  type AreaMapMarkerPair,
  type AreaMapTextures,
} from '../art/areaMapTextures';
import {
  MAP_BADGE_OFFSET,
  MAP_MESSAGE_PANEL,
  MAP_PILL_CENTRE,
  MAP_STAR_ROW_CENTRE,
  MAP_TAB_TEXT,
  MAP_TITLE_PANEL,
  mapHabitatTint,
  mapPanelSize,
  mapTabFeet,
  type MapTextSpec,
} from '../art/drawAreaMap';
import { isHabitatLookId, type HabitatLookId } from '../art/habitatLook';
import { LETTERBOX } from '../art/palette';
import type { TexInfo } from '../art/textures';
import {
  AREA_MAP_BACK_BUTTON,
  AREA_MAP_BACK_LABEL,
  areaMapKey,
  areaMapLayout,
  initialFocus,
  scrollToFocus,
  type AreaMapAction,
  type AreaMapEntry,
  type AreaMapHabitat,
  type AreaMapLayout,
  type AreaMapMeasure,
  type AreaMapStars,
} from '../logic/areaMap';
import { AREA_MAP_TITLE, NEW_AREA_LABEL, lockedAreaText } from '../logic/areaText';
import { AREAS, habitatById, isAreaUnlocked, isNewArea, type AreaData } from '../logic/areas';
import { GAME_EVENTS, REGISTRY_KEYS, type ReducedMotionPayload } from '../logic/gameEvents';
import type { Rect, Size } from '../logic/hudLayout';
import { motionProfile, type MotionProfile } from '../logic/motion';
import { bestStarsFor, starCount, type AreaStarsRecord } from '../logic/stars';
import { UI, tankKeyFor } from '../logic/tankUi';
import type { Vec2 } from '../logic/vec';
import {
  SCENE_KEYS,
  createButton,
  cssColor,
  readSceneView,
  uiTextStyle,
  useCssCamera,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';
import { addMotionTween, settleMotionTweens } from './motionTweens';
import { backToExplorerCard, readSession, startTripIn, type AreaMapStart } from './sceneFlow';

/** The area number on a marker (art guide 8): bold ink 28 px. */
const NUMBER_PX = 28;
/** The word "New!" on its pill (art guide 8): bold ink 18 px. */
const NEW_WORD_PX = 18;
/** The markers ignore presses for this long after the map shows, so the press on Go! cannot start a trip (art guide 8, 9). */
const MARKER_WAIT_MS = 800;
/** The locked message holds until this long after it shows (art guide 8, 9). */
const MESSAGE_HOLD_MS = 3000;
/** The locked message fades in and out over this long; at once under reduced motion (art guide 9). */
const MESSAGE_FADE_MS = 250;
/** The path draws in over this long each time the map opens; whole at once under reduced motion (art guide 9). */
const PATH_DRAW_MS = 800;
/** A focus move scrolls the map over this long; at once under reduced motion (art guide 9). */
const FOCUS_SCROLL_MS = 300;
/** The "New!" pill bobs this far each way, in CSS px, over NEW_BOB_PERIOD_MS; still under reduced motion (art guide 9). */
const NEW_BOB_PX = 2;
const NEW_BOB_PERIOD_MS = 2400;
/** A press on the map becomes a drag once the pointer has moved this far, in CSS px (art guide 8). */
const DRAG_START_PX = 8;
/** Texture key of the baked path, baked again under the same key on every layout. */
const PATH_KEY = 'area-map-path';
/** Texture keys of the title and message panels, each baked again under the same key at every new size. */
const TITLE_PANEL_KEY = areaMapPanelKey('title');
const MESSAGE_PANEL_KEY = areaMapPanelKey('message');
/**
 * Texture keys of habitat `index`'s parts, each baked again under the same key at every new size: its
 * tinted backdrop panel, its folder tab, and its tab as a plain panel when the labels sit along the axis.
 */
const habitatPanelKey = (index: number): string => areaMapPanelKey(`habitat-${index}`);
const habitatTabKey = (index: number): string => areaMapTabKey(`habitat-${index}`);
const labelPanelKey = (index: number): string => areaMapPanelKey(`label-${index}`);
const BACKDROP_COVER = 8192;
const CAPTURED_KEYS: readonly number[] = [
  Phaser.Input.Keyboard.KeyCodes.TAB,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
];
/** Every star count a marker shows. */
const MAP_STARS: readonly AreaMapStars[] = Object.freeze([0, 1, 2, 3]);

/**
 * One area's map objects: its marker, number and star row, the padlock badge when it is locked, and
 * the "New!" pill and word, with where the pill rests (`pillAt`, content CSS px), when it is new.
 */
interface MarkerParts {
  marker: Phaser.GameObjects.Image;
  number: Phaser.GameObjects.Text;
  stars: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image | null;
  pill: Phaser.GameObjects.Image | null;
  pillWord: Phaser.GameObjects.Text | null;
  pillAt: Vec2;
}

/** One habitat run's objects (issue #113, ND-1): its tinted backdrop panel, its tab and its label text. */
interface HabitatParts {
  panel: Phaser.GameObjects.Image;
  tab: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
}

/**
 * A press on the map: the pointer, where it went down (screen CSS px), the scroll then, and whether
 * it has moved far enough to be a drag.
 */
interface MapPress {
  pointerId: number;
  down: Vec2;
  scrollAtDown: number;
  dragging: boolean;
}

/** The star count `count` as a marker star count. Throws when it is not 0 to 3. */
function mapStars(count: number): AreaMapStars {
  const stars = MAP_STARS.find((each) => each === count);
  if (stars === undefined) throw new RangeError(`AreaMapScene: an area cannot show ${count} stars`);
  return stars;
}

/** The map entry of `area` for the best stars `stars`: its number, habitat, best stars, and whether it is locked or new. */
function areaMapEntry(area: Readonly<AreaData>, stars: AreaStarsRecord): AreaMapEntry {
  const habitat = habitatById(area.habitatId);
  if (habitat === undefined) throw new Error(`AreaMapScene: no habitat ${area.habitatId} for area ${area.id}`);
  return {
    id: area.id,
    number: area.number,
    habitatId: habitat.id,
    habitatName: habitat.name,
    stars: mapStars(starCount(bestStarsFor(stars, area.id))),
    locked: !isAreaUnlocked(stars, area.id),
    isNew: isNewArea(stars, area.id),
  };
}

/** The habitat look of `habitatId`. Throws a RangeError for an unknown habitat or look; it never falls back to the canal. */
function habitatLookOf(habitatId: string): HabitatLookId {
  const look = habitatById(habitatId)?.look;
  if (look === undefined || !isHabitatLookId(look)) {
    throw new RangeError(`AreaMapScene: no map look ${String(look)} for habitat ${habitatId}`);
  }
  return look;
}

/** The marker pair of the habitat look of `habitatId` in `art`. Throws as habitatLookOf does. */
function markerPairFor(art: AreaMapTextures, habitatId: string): AreaMapMarkerPair {
  return art.markersByLook[habitatLookOf(habitatId)];
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
function panelSizeFor(text: Phaser.GameObjects.Text, wrapW: number, spec: MapTextSpec): Size {
  text.setWordWrapWidth(Math.max(1, wrapW - 2 * spec.padX), true);
  const size = mapPanelSize(text.width, text.height, spec);
  return { w: Math.ceil(size.w), h: Math.ceil(size.h) };
}

/** Wraps `text` to the panel `rect` less the padding of `spec` (with 1 px slack, so it breaks as measured) and centres it there. */
function placeTextInPanel(text: Phaser.GameObjects.Text, rect: Rect, spec: MapTextSpec): void {
  text.setWordWrapWidth(Math.max(1, rect.w - 2 * spec.padX + 1), true);
  text.setPosition(rect.x + (rect.w - text.width) / 2, rect.y + (rect.h - text.height) / 2);
}

/** Whether `point` is inside `rect`, edges included. */
function rectContains(rect: Rect, point: Vec2): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/**
 * The area map (PRD N2; art guide 8 "Area map", 9, 10), opened by Go! on the explorer card: one
 * marker per area in AREAS on a winding path, grouped by habitat, laid out by areaMapLayout(). The
 * opaque #0c6a8c backdrop takes every press. Each habitat run sits on a panel in its look's tint,
 * labelled on a folder tab on the panel's top edge, or on a tab inside the panel when the labels sit
 * along the axis (issue #113, ND-1); locked runs keep their label and panel. Back, the title and the
 * message line are fixed on the main camera; the map is drawn by a second camera whose viewport is the layout's viewport, so it
 * scrolls along the layout's axis by drag (1:1, no fling, from 8 px), by the wheel, and to follow
 * the focus (scrollToFocus).
 *
 * Focus starts on initialFocus() and keys go through areaMapKey(). A press, or Enter or Space, on an
 * unlocked marker starts the trip there (startTripIn); on a locked one it shows "Beat Area N to
 * unlock!" in the message line for 3 s (a new locked press restarts it, any other press clears it).
 * The markers ignore presses for the first 0.8 s. Back or Escape goes back to the explorer card
 * (backToExplorerCard). Locked reads by the padlock badge, stars by filled or dashed, "New!" by its
 * word and focus by the double ring, never by colour alone.
 *
 * Motion only through addMotionTween: the path draws in over 0.8 s, the focus scroll eases over
 * 0.3 s, the "New!" pill bobs and the message fades. Under reduced motion the path shows whole, the
 * scroll is instant, the pill is still and the message shows and hides at once.
 */
export class AreaMapScene extends Phaser.Scene {
  private assets!: GameAssets;
  private entries: AreaMapEntry[] = [];
  private view!: SceneView;
  private motion!: MotionProfile;
  private placed: AreaMapLayout | null = null;
  /** Focus index: a marker in entry order, or Back (entries.length). */
  private focusIndex = 0;
  /** Ms the map has shown, for the marker press wait. */
  private shownMs = 0;
  private leaving = false;
  private press: MapPress | null = null;

  private mapCamera!: Phaser.Cameras.Scene2D.Camera;
  private fixedLayer!: Phaser.GameObjects.Container;
  private mapLayer!: Phaser.GameObjects.Container;
  private titlePanel!: Phaser.GameObjects.Image;
  private titleText!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private messageLayer!: Phaser.GameObjects.Container;
  private messagePanel!: Phaser.GameObjects.Image;
  private messageText!: Phaser.GameObjects.Text;
  private messageProbe!: Phaser.GameObjects.Text;
  private labelProbe!: Phaser.GameObjects.Text;
  private path!: Phaser.GameObjects.Image;
  private focusRing!: Phaser.GameObjects.Image;
  private markers: MarkerParts[] = [];
  private habitats: HabitatParts[] = [];

  /** Number of the locked area the message line names, or 0 while it is hidden. */
  private messageArea = 0;
  private messageTimer: Phaser.Time.TimerEvent | null = null;
  /** Scroll along the layout axis, in content CSS px; the focus scroll tweens `value`. */
  private readonly scroll = { value: 0 };
  private scrollTween: Phaser.Tweens.Tween | null = null;
  /** Share of the path drawn in, 0 to 1; the draw-in tweens `fraction`. */
  private readonly pathDraw = { fraction: 0 };
  /** The path share the crop shows now; -1 forces the next crop. */
  private pathFractionShown = -1;
  /** The "New!" pill's bob offset down, in CSS px; the bob tweens `offset`. */
  private readonly bob = { offset: 0 };
  private bobbing = false;

  constructor() {
    super(SCENE_KEYS.areaMap);
  }

  init(data: AreaMapStart): void {
    this.assets = data.assets;
    this.entries = [];
    this.placed = null;
    this.focusIndex = 0;
    this.shownMs = 0;
    this.leaving = false;
    this.press = null;
    this.markers = [];
    this.habitats = [];
    this.messageArea = 0;
    this.messageTimer = null;
    this.scroll.value = 0;
    this.scrollTween = null;
    this.pathDraw.fraction = 0;
    this.pathFractionShown = -1;
    this.bob.offset = 0;
    this.bobbing = false;
  }

  create(): void {
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    const hub = readSession(this.registry).hub;
    this.entries = AREAS.map((area) => areaMapEntry(area, hub.stars));
    this.focusIndex = initialFocus(this.entries, hub.lastAreaId);
    useCssCamera(this.cameras.main, this.view.fit.dpr);
    this.cameras.main.setBackgroundColor(LETTERBOX);

    this.buildFixed();
    this.buildMap();
    this.mapCamera = this.cameras.add(0, 0, 1, 1);
    this.cameras.main.ignore(this.mapLayer);
    this.mapCamera.ignore(this.fixedLayer);

    this.bindInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.layout();
    this.startPathDraw();
    this.startBob();
  }

  /** Counts the marker press wait and shows the tweened scroll, path draw-in and pill bob. */
  update(_time: number, deltaMs: number): void {
    this.shownMs += Math.max(0, deltaMs);
    this.syncMapCamera();
    this.applyPathDraw();
    this.placeNewPills();
  }

  // ---- build ---------------------------------------------------------------

  /** The fixed parts on the main camera: the backdrop, the title, Back, the message line and the text probes. */
  private buildFixed(): void {
    const dpr = this.view.fit.dpr;
    const backdrop = this.add
      .rectangle(-BACKDROP_COVER / 2, -BACKDROP_COVER / 2, BACKDROP_COVER, BACKDROP_COVER, cssColor(LETTERBOX).color, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.titlePanel = this.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.titleText = this.addText(MAP_TITLE_PANEL.fontPx).setText(AREA_MAP_TITLE).setVisible(false);
    this.backButton = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: 1,
      width: AREA_MAP_BACK_BUTTON.w,
      label: AREA_MAP_BACK_LABEL,
      icon: 'left',
      dpr,
      pressOnDown: false,
      onPress: () => this.goBack(),
    });
    this.messagePanel = this.add.image(0, 0, '__DEFAULT');
    this.messageText = this.addText(MAP_MESSAGE_PANEL.fontPx);
    this.messageLayer = this.add.container(0, 0, [this.messagePanel, this.messageText]).setVisible(false).setAlpha(0);
    const largestLocked = Math.max(2, ...this.entries.map((entry) => entry.number));
    this.messageProbe = this.addText(MAP_MESSAGE_PANEL.fontPx).setText(lockedAreaText(largestLocked)).setVisible(false);
    this.labelProbe = this.addText(MAP_TAB_TEXT.fontPx).setVisible(false);
    this.fixedLayer = this.add.container(0, 0, [
      backdrop,
      this.titlePanel,
      this.titleText,
      this.backButton.container,
      this.messageLayer,
      this.messageProbe,
      this.labelProbe,
    ]);
  }

  /**
   * The map parts on the map camera, back to front (art guide 8): the path, the star rows, the
   * markers and their numbers, the focus ring, the padlock badges, then the "New!" pills and words.
   * The habitat parts are added at the first layout, which knows how many there are: the panels at
   * the back, the tabs and labels on top.
   */
  private buildMap(): void {
    const art = this.assets.areaMap;
    this.path = this.add.image(0, 0, '__DEFAULT');
    this.markers = this.entries.map((entry) => this.createMarker(entry));
    this.focusRing = placeBaked(this.add.image(0, 0, art.focusRing.key), art.focusRing, 0, 0).setVisible(false);
    this.mapLayer = this.add.container(0, 0, [
      this.path,
      ...this.markers.map((parts) => parts.stars),
      ...this.markers.map((parts) => parts.marker),
      ...this.markers.map((parts) => parts.number),
      this.focusRing,
      ...this.markers.flatMap((parts) => (parts.badge === null ? [] : [parts.badge])),
      ...this.markers.flatMap((parts) => (parts.pill === null ? [] : [parts.pill])),
      ...this.markers.flatMap((parts) => (parts.pillWord === null ? [] : [parts.pillWord])),
    ]);
  }

  /** One area's marker, number and star row, with the padlock badge when locked and the "New!" pill and word when new. */
  private createMarker(entry: AreaMapEntry): MarkerParts {
    const art = this.assets.areaMap;
    const markerPair = markerPairFor(art, entry.habitatId);
    const markerInfo = entry.locked ? markerPair.locked : markerPair.unlocked;
    const starsInfo = art.starRows[entry.locked ? 0 : entry.stars];
    const showsNew = entry.isNew && !entry.locked;
    return {
      marker: placeBaked(this.add.image(0, 0, markerInfo.key), markerInfo, 0, 0),
      number: this.addText(NUMBER_PX).setText(String(entry.number)).setOrigin(0.5, 0.5),
      stars: placeBaked(this.add.image(0, 0, starsInfo.key), starsInfo, 0, 0),
      badge: entry.locked ? placeBaked(this.add.image(0, 0, art.padlockBadge.key), art.padlockBadge, 0, 0) : null,
      pill: showsNew ? placeBaked(this.add.image(0, 0, art.newPill.key), art.newPill, 0, 0) : null,
      pillWord: showsNew ? this.addText(NEW_WORD_PX).setText(NEW_AREA_LABEL).setOrigin(0.5, 0.5) : null,
      pillAt: { x: 0, y: 0 },
    };
  }

  /**
   * Habitat `index`'s parts: its panel at the back of the map, after the earlier habitats' panels and
   * behind the path and every marker part, and its tab and label text on top of the map. None takes input.
   */
  private createHabitat(index: number): HabitatParts {
    const parts: HabitatParts = {
      panel: this.add.image(0, 0, '__DEFAULT'),
      tab: this.add.image(0, 0, '__DEFAULT'),
      text: this.addText(MAP_TAB_TEXT.fontPx),
    };
    this.mapLayer.addAt(parts.panel, index);
    this.mapLayer.add([parts.tab, parts.text]);
    return parts;
  }

  /** Bold ink UI text of `sizePx`, centred line by line. */
  private addText(sizePx: number): Phaser.GameObjects.Text {
    return this.add.text(0, 0, '', { ...uiTextStyle(sizePx, this.view.fit.dpr), align: 'center' });
  }

  /** One keydown handler for every map key, and the pointer and wheel handlers; Tab, arrows and Space are captured. */
  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUpOutside, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture([...CAPTURED_KEYS]);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
  }

  // ---- layout --------------------------------------------------------------

  /** The boot bake scale, which the panel textures must share (bakeAreaMapPanel). */
  private bakeScale(): number {
    return this.assets.areaMap.markerUnlocked.scale;
  }

  /** The text measures the layout reads: each panel's size with its text wrapped at the width given. */
  private measure(): AreaMapMeasure {
    return {
      title: (wrapW) => panelSizeFor(this.titleText, wrapW, MAP_TITLE_PANEL),
      habitat: (label, wrapW) => panelSizeFor(this.labelProbe.setText(label), wrapW, MAP_TAB_TEXT),
      message: (wrapW) => panelSizeFor(this.messageProbe, wrapW, MAP_MESSAGE_PANEL),
    };
  }

  /**
   * Lays the map out for the canvas with areaMapLayout(), places the fixed parts, the map parts and
   * the map camera, then scrolls at once to keep the focused marker in view.
   */
  private layout(): void {
    const placed = areaMapLayout(this.view, this.entries, this.measure());
    this.placed = placed;
    this.layoutFixed(placed);
    this.layoutMap(placed);
    this.placeMapCamera(placed);
    this.stopScrollTween();
    this.applyScroll(scrollToFocus(placed, this.focusIndex, this.clampScroll(this.scroll.value), placed.viewport));
    this.refreshFocus();
  }

  /** Places the title (hidden when the layout hides it), Back and, while it shows, the message line. */
  private layoutFixed(placed: AreaMapLayout): void {
    const title = placed.title;
    this.titlePanel.setVisible(title !== null);
    this.titleText.setVisible(title !== null);
    if (title !== null) {
      const info = bakeAreaMapPanel(this, TITLE_PANEL_KEY, MAP_TITLE_PANEL.fill, title.w, title.h, this.bakeScale());
      placeBaked(this.titlePanel, info, title.x, title.y);
      placeTextInPanel(this.titleText, title, MAP_TITLE_PANEL);
    }
    this.backButton.container.setPosition(placed.back.x, placed.back.y);
    this.placeMessage();
  }

  /** Bakes the path for the layout and places every marker part and habitat panel, tab and label in content CSS px. */
  private layoutMap(placed: AreaMapLayout): void {
    placeBaked(this.path, bakeAreaMapPath(this, PATH_KEY, placed.path, this.bakeScale()), 0, 0);
    this.pathFractionShown = -1;
    this.applyPathDraw();
    placed.nodes.forEach((node, index) => this.placeMarker(this.markers[index], node.cell, node.centre));
    while (this.habitats.length < placed.habitats.length) this.habitats.push(this.createHabitat(this.habitats.length));
    placed.habitats.forEach((habitat, index) => this.placeHabitat(this.habitats[index], index, habitat, placed.labelsAlong));
    this.placeNewPills();
  }

  /** Places one area's parts in its cell: marker, number and ring anchor on the centre, stars, badge and pill at their offsets. */
  private placeMarker(parts: MarkerParts, cell: Rect, centre: Vec2): void {
    parts.marker.setPosition(centre.x, centre.y);
    parts.number.setPosition(centre.x, centre.y);
    parts.stars.setPosition(cell.x + MAP_STAR_ROW_CENTRE.x, cell.y + MAP_STAR_ROW_CENTRE.y);
    parts.badge?.setPosition(centre.x + MAP_BADGE_OFFSET.x, centre.y + MAP_BADGE_OFFSET.y);
    parts.pillAt = { x: cell.x + MAP_PILL_CENTRE.x, y: cell.y + MAP_PILL_CENTRE.y };
  }

  /**
   * Places habitat `index` (issue #113, ND-1): its panel in its look's tint at `habitat.panel`, its
   * tab at `habitat.rect` in the same tint, a folder tab on the panel's top edge, or a plain panel
   * inside it when the labels sit along the axis, and its label centred on the tab.
   */
  private placeHabitat(parts: HabitatParts, index: number, habitat: Readonly<AreaMapHabitat>, labelsAlong: boolean): void {
    const tint = mapHabitatTint(habitatLookOf(habitat.id));
    const scale = this.bakeScale();
    const { panel, rect } = habitat;
    placeBaked(parts.panel, bakeAreaMapPanel(this, habitatPanelKey(index), tint, panel.w, panel.h, scale), panel.x, panel.y);
    const tabInfo = labelsAlong
      ? bakeAreaMapPanel(this, labelPanelKey(index), tint, rect.w, rect.h, scale)
      : bakeAreaMapTab(this, habitatTabKey(index), tint, rect.w, rect.h, mapTabFeet(rect, panel), scale);
    placeBaked(parts.tab, tabInfo, rect.x, rect.y);
    placeTextInPanel(parts.text.setText(habitat.label), rect, MAP_TAB_TEXT);
  }

  /** Puts the "New!" pills and words where they rest, moved down by the bob offset. */
  private placeNewPills(): void {
    for (const parts of this.markers) {
      parts.pill?.setPosition(parts.pillAt.x, parts.pillAt.y + this.bob.offset);
      parts.pillWord?.setPosition(parts.pillAt.x, parts.pillAt.y + this.bob.offset);
    }
  }

  /** Points the map camera at the layout's viewport, in canvas px, at CSS px zoom. */
  private placeMapCamera(placed: AreaMapLayout): void {
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

  /** `value` clamped to the scroll range: 0 to the content length less the viewport length along the axis. */
  private clampScroll(value: number): number {
    const placed = this.placed;
    if (placed === null) return 0;
    const room =
      placed.axis === 'x' ? placed.content.w - placed.viewport.w : placed.content.h - placed.viewport.h;
    return Math.max(0, Math.min(Math.max(0, room), value));
  }

  /** Scrolls the map to `value`, clamped, at once. */
  private applyScroll(value: number): void {
    this.scroll.value = this.clampScroll(value);
    this.syncMapCamera();
  }

  /** Shows the scroll on the map camera, along the layout axis. */
  private syncMapCamera(): void {
    const placed = this.placed;
    if (placed === null) return;
    const along = this.scroll.value;
    this.mapCamera.setScroll(placed.axis === 'x' ? along : 0, placed.axis === 'y' ? along : 0);
  }

  /** Stops the focus scroll where it is, if it is running. */
  private stopScrollTween(): void {
    this.scrollTween?.stop();
    this.scrollTween = null;
  }

  /** Moves the focus to `index` and scrolls the map to show it. */
  private setFocus(index: number): void {
    this.focusIndex = index;
    this.refreshFocus();
    this.followFocus();
  }

  /**
   * Scrolls as little as it can to show the focused marker (scrollToFocus): eased over
   * FOCUS_SCROLL_MS from where the scroll is, or at once under reduced motion.
   */
  private followFocus(): void {
    const placed = this.placed;
    if (placed === null) return;
    const target = scrollToFocus(placed, this.focusIndex, this.scroll.value, placed.viewport);
    if (target === this.scroll.value) return;
    this.stopScrollTween();
    if (!this.motion.ambient) {
      this.applyScroll(target);
      return;
    }
    this.scrollTween = addMotionTween(this, {
      targets: this.scroll,
      props: { value: target },
      duration: FOCUS_SCROLL_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scrollTween = null;
      },
    });
  }

  /** The double focus ring on the focused marker, or the focus ring on Back when it has the focus. */
  private refreshFocus(): void {
    const placed = this.placed;
    const node = placed?.nodes[this.focusIndex];
    this.backButton.setFocused(this.focusIndex === this.entries.length);
    this.focusRing.setVisible(node !== undefined);
    if (node !== undefined) this.focusRing.setPosition(node.centre.x, node.centre.y);
  }

  // ---- motion --------------------------------------------------------------

  /** Draws the path in from the first marker over PATH_DRAW_MS, or whole at once under reduced motion. */
  private startPathDraw(): void {
    this.pathDraw.fraction = this.motion.ambient ? 0 : 1;
    if (this.motion.ambient) {
      addMotionTween(this, { targets: this.pathDraw, props: { fraction: 1 }, duration: PATH_DRAW_MS, ease: 'Sine.easeOut' });
    }
    this.applyPathDraw();
  }

  /**
   * Crops the path to the drawn-in share of its length along the axis. The markers advance along the
   * axis in area order, so this grows the path from the first marker to the last.
   */
  private applyPathDraw(): void {
    const fraction = Math.max(0, Math.min(1, this.pathDraw.fraction));
    if (fraction === this.pathFractionShown) return;
    this.pathFractionShown = fraction;
    if (fraction >= 1) {
      this.path.setCrop();
      return;
    }
    const frame = this.path.frame;
    if (this.placed?.axis === 'y') this.path.setCrop(0, 0, frame.width, frame.height * fraction);
    else this.path.setCrop(0, 0, frame.width * fraction, frame.height);
  }

  /** Starts the "New!" bob when motion is full, a pill shows and it is not bobbing yet. */
  private startBob(): void {
    if (!this.motion.ambient || this.bobbing || !this.markers.some((parts) => parts.pill !== null)) return;
    this.bobbing = true;
    this.bobTo(NEW_BOB_PX, NEW_BOB_PERIOD_MS / 4);
  }

  /** One bob swing to `offset` over `durationMs`. */
  private bobTo(offset: number, durationMs: number): void {
    addMotionTween(this, {
      targets: this.bob,
      props: { offset },
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onComplete: () => this.continueBob(offset),
    });
  }

  /** A bob swing to `offset` ended: swings to the other side while motion is full, else the pill rests still. */
  private continueBob(offset: number): void {
    if (this.motion.ambient && !this.leaving) {
      this.bobTo(-offset, NEW_BOB_PERIOD_MS / 2);
      return;
    }
    this.bobbing = false;
    this.bob.offset = 0;
    this.placeNewPills();
  }

  // ---- message line --------------------------------------------------------

  /**
   * Shows "Beat Area N to unlock!" for locked area `areaNumber` in the message line, fading in
   * unless motion is reduced, until MESSAGE_HOLD_MS after it shows. A new locked press restarts it.
   */
  private showLockedMessage(areaNumber: number): void {
    if (this.messageTimer) this.time.removeEvent(this.messageTimer);
    this.tweens.killTweensOf(this.messageLayer);
    this.messageArea = areaNumber;
    this.messageText.setText(lockedAreaText(areaNumber));
    this.placeMessage();
    this.messageLayer.setVisible(true);
    if (this.motion.ambient) {
      addMotionTween(this, { targets: this.messageLayer, props: { alpha: 1 }, duration: MESSAGE_FADE_MS });
    } else {
      this.messageLayer.setAlpha(1);
    }
    this.messageTimer = this.time.delayedCall(MESSAGE_HOLD_MS, this.hideMessage, [], this);
  }

  /** The message hold ended: fades the line out, or hides it at once under reduced motion. */
  private hideMessage(): void {
    this.messageTimer = null;
    if (!this.motion.ambient) {
      this.dropMessage();
      return;
    }
    addMotionTween(this, {
      targets: this.messageLayer,
      props: { alpha: 0 },
      duration: MESSAGE_FADE_MS,
      onComplete: () => this.dropMessage(),
    });
  }

  /** Any press other than a locked marker clears the message line at once. */
  private clearMessage(): void {
    if (this.messageArea === 0) return;
    if (this.messageTimer) this.time.removeEvent(this.messageTimer);
    this.messageTimer = null;
    this.tweens.killTweensOf(this.messageLayer);
    this.dropMessage();
  }

  private dropMessage(): void {
    this.messageArea = 0;
    this.messageLayer.setVisible(false).setAlpha(0);
  }

  /**
   * Sizes the pink message panel to its text, wrapped at the canvas width less the margins, centred
   * across and resting on the bottom of the layout's message room. Nothing while it is hidden.
   */
  private placeMessage(): void {
    const placed = this.placed;
    if (placed === null || this.messageArea === 0) return;
    const size = panelSizeFor(this.messageText, this.view.cssW - 2 * UI.margin, MAP_MESSAGE_PANEL);
    const rect: Rect = {
      x: Math.max(UI.margin, (this.view.cssW - size.w) / 2),
      y: placed.message.y + placed.message.h - size.h,
      w: size.w,
      h: size.h,
    };
    const info = bakeAreaMapPanel(this, MESSAGE_PANEL_KEY, MAP_MESSAGE_PANEL.fill, rect.w, rect.h, this.bakeScale());
    placeBaked(this.messagePanel, info, rect.x, rect.y);
    placeTextInPanel(this.messageText, rect, MAP_MESSAGE_PANEL);
  }

  // ---- input ---------------------------------------------------------------

  /** Leaves the map once, through `go`; every later press and key is ignored. */
  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    go();
  }

  /** Back or Escape: back to the explorer card with the same axolotl chosen and Go! focused. */
  private goBack(): void {
    this.leave(() => backToExplorerCard(this, this.assets));
  }

  /**
   * A press on the marker at `index`, by tap or key, once the marker wait is over: a locked area shows
   * its message, an unlocked one starts the trip there.
   */
  private pressMarker(index: number): void {
    if (this.leaving || this.shownMs < MARKER_WAIT_MS) return;
    const entry = this.entries[index];
    if (entry.locked) {
      this.showLockedMessage(entry.number);
      return;
    }
    this.leave(() => startTripIn(this, this.assets, entry.id));
  }

  /** Runs what a key asked for: press the focused marker, or go back. */
  private runAction(action: AreaMapAction): void {
    if (action === 'choose' || action === 'locked') this.pressMarker(this.focusIndex);
    else if (action === 'back') this.goBack();
  }

  /**
   * Every map key through areaMapKey(): Tab, Shift+Tab and the arrows move the focus (scrolling to
   * it), Enter and Space press the focused control (ignoring key repeat), Escape is Back. Any key
   * but a press on a locked marker clears the message line.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.leaving) return;
    const key = tankKeyFor(event.key, event.shiftKey);
    if (key === null) return;
    const result = areaMapKey(this.focusIndex, key, event.repeat, this.entries);
    if (result.action !== 'locked') this.clearMessage();
    if (result.focus !== this.focusIndex) this.setFocus(result.focus);
    this.runAction(result.action);
  }

  /** The pointer's position in screen CSS px. */
  private cssPoint(pointer: Phaser.Input.Pointer): Vec2 {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: point.x, y: point.y };
  }

  /** The position of `point` along the layout axis. */
  private alongOf(point: Vec2): number {
    return this.placed?.axis === 'y' ? point.y : point.x;
  }

  /** The index of the marker whose tap target holds screen point `screen`, or -1. */
  private markerIndexAt(screen: Vec2): number {
    const placed = this.placed;
    if (placed === null) return -1;
    const content: Vec2 = {
      x: screen.x - placed.viewport.x + (placed.axis === 'x' ? this.scroll.value : 0),
      y: screen.y - placed.viewport.y + (placed.axis === 'y' ? this.scroll.value : 0),
    };
    return placed.nodes.findIndex((node) => rectContains(node.target, content));
  }

  /** A press in the map viewport may become a tap or a drag; any press outside it clears the message line. */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.leaving || this.press !== null) return;
    const down = this.cssPoint(pointer);
    if (this.placed === null || !rectContains(this.placed.viewport, down)) {
      this.clearMessage();
      return;
    }
    this.press = { pointerId: pointer.id, down, scrollAtDown: this.scroll.value, dragging: false };
  }

  /** Once the press has moved DRAG_START_PX it drags the map 1:1 along the axis, with no fling. */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (press === null || pointer.id !== press.pointerId || this.leaving) return;
    const at = this.cssPoint(pointer);
    if (!press.dragging) {
      if (Math.hypot(at.x - press.down.x, at.y - press.down.y) < DRAG_START_PX) return;
      press.dragging = true;
      this.clearMessage();
      this.stopScrollTween();
    }
    this.applyScroll(press.scrollAtDown - (this.alongOf(at) - this.alongOf(press.down)));
  }

  /** A press released before it became a drag is a tap where it went down. */
  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (press === null || pointer.id !== press.pointerId) return;
    this.press = null;
    if (!press.dragging) this.tapMap(press.down);
  }

  /** A press released off the canvas is dropped. */
  private handlePointerUpOutside(pointer: Phaser.Input.Pointer): void {
    if (this.press?.pointerId === pointer.id) this.press = null;
  }

  /**
   * A tap at screen point `screen` in the viewport: on a marker it focuses and presses it (after the
   * marker wait); anywhere else, or on an unlocked marker, it also clears the message line.
   */
  private tapMap(screen: Vec2): void {
    if (this.leaving) return;
    const index = this.markerIndexAt(screen);
    if (index < 0 || !this.entries[index].locked) this.clearMessage();
    if (index < 0 || this.shownMs < MARKER_WAIT_MS) return;
    this.setFocus(index);
    this.pressMarker(index);
  }

  /** The wheel scrolls the map along the axis: across by the larger of the two wheel deltas, down by the vertical one. */
  private handleWheel(_pointer: Phaser.Input.Pointer, _over: unknown, deltaX: number, deltaY: number): void {
    const placed = this.placed;
    if (placed === null || this.leaving) return;
    this.stopScrollTween();
    const delta = placed.axis === 'x' && Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    this.applyScroll(this.scroll.value + delta);
  }

  // ---- events --------------------------------------------------------------

  /** Switches the motion profile. Under reduced motion running tweens end at once; with full motion the pill bobs again. */
  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
    if (!this.motion.ambient) settleMotionTweens(this);
    else this.startBob();
    this.syncMapCamera();
    this.applyPathDraw();
    this.placeNewPills();
  }

  /** Every text object on the map, for a resolution change. */
  private texts(): Phaser.GameObjects.Text[] {
    return [
      this.titleText,
      this.messageText,
      this.messageProbe,
      this.labelProbe,
      ...this.markers.map((parts) => parts.number),
      ...this.markers.flatMap((parts) => (parts.pillWord === null ? [] : [parts.pillWord])),
      ...this.habitats.map((parts) => parts.text),
    ];
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const dpr = this.view.fit.dpr;
    useCssCamera(this.cameras.main, dpr);
    for (const text of this.texts()) {
      text.setResolution(dpr);
    }
    this.backButton.setResolution(dpr);
    this.layout();
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.press = null;
    this.messageTimer = null;
    this.scrollTween = null;
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
    keyboard.removeCapture([...CAPTURED_KEYS]);
  }
}
