import * as Phaser from 'phaser';
import { createAxolotlRigBake, createAxolotlRigView, type AxolotlRigBake, type AxolotlRigView } from '../art/axolotlRig';
import type { AxolotlPose } from '../art/drawAxolotl';
import { dreamSheenAt } from '../art/drawDreamOverlay';
import { REFUGE_NUDGE_INSET } from '../art/drawRefuge';
import { artOutfit } from '../art/drawWearables';
import { DEPTH } from '../art/layers';
import {
  axolotlPalette,
  HOME_TANK_WALL,
  INK,
  LW,
  SURFACE_LINE,
  SURFACE_LINE_WIDTH,
  T_STATIC,
  UI_PANEL,
  WHITE,
} from '../art/palette';
import type { IconKind } from '../art/drawUi';
import type { TexInfo } from '../art/textures';
import { areaLabel } from '../logic/areaText';
import { areaById, habitatById, type AreaData } from '../logic/areas';
import { ownedDreamColours, type Decoration } from '../logic/catalogue';
import { dueFirstFindCards, tryItNowAxolotlId, type FirstFindKind } from '../logic/firstFind';
import { GAME_EVENTS, REGISTRY_KEYS, type ReducedMotionPayload } from '../logic/gameEvents';
import { restyleSound } from '../logic/homeSounds';
import type { Rect, Size } from '../logic/hudLayout';
import { motionProfile, type MotionProfile } from '../logic/motion';
import { wornIds } from '../logic/outfit';
import { outfitPerks } from '../logic/perks';
import { hasPendingCleanUps, withoutMilestone } from '../logic/refuge';
import { spriteFrameBounds } from '../logic/spriteAnchor';
import {
  areaMemory,
  bestStars,
  canRescueMore,
  chooseExplorer,
  explorerAxolotl,
  markFirstFindSeen,
  restyleAxolotl,
  setDreamColour,
  setOutfit,
  setTankLayout,
  type OwnedAxolotl,
  type Session,
} from '../logic/session';
import { hubStarsBadgeRect, hubStarsBadgeShape } from '../logic/starsUi';
import { restyleStart, type RestyleOptions, type StylerWearer } from '../logic/styler';
import type { StylerStep } from '../logic/stylerSteps';
import { SHIPPED_DECORATIONS, TANK, tankFrame, tankToCss, type TankFrame, type TankLayout } from '../logic/tank';
import {
  axolotlFocusIndex,
  nameTagRect,
  stepTankFocus,
  tankFocusTarget,
  touchHitRect,
  type TankFocusTarget,
} from '../logic/tankPick';
import { tankSwimPose } from '../logic/tankSwim';
import { HOME_TANK_NAME } from '../logic/tankText';
import {
  HUB_BUTTONS,
  ICON_TILE,
  TILE_BUTTON,
  UI,
  hubButtonCompactLook,
  hubButtonLook,
  hubCaptionRect,
  hubLayout,
  tankKeyFor,
  type HubAction,
  type HubActionId,
  type HubButtonSpec,
  type HubLayout,
  type TankKey,
} from '../logic/tankUi';
import type { TripEnding } from '../logic/tripEvents';
import { SURF, waveY } from '../logic/zone';
import { setMusicScreen } from '../platform/musicPlayer';
import { playSound } from '../platform/soundPlayer';
import { AxolotlStyler, type StyledAxolotl } from './AxolotlStyler';
import {
  SCENE_KEYS,
  blinkAt,
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
import { AreaStarsBadge } from './AreaStarsBadge';
import { AxolotlChoicesCard } from './AxolotlChoicesCard';
import { CollectionBookView } from './CollectionBookView';
import { ExplorerCard, type ExplorerCardAxolotl } from './ExplorerCard';
import { settleMotionTweens } from './motionTweens';
import { RefugeMilestoneCard } from './RefugeMilestoneCard';
import { SoundCard } from './SoundCard';
import {
  goExploring,
  openRefuge,
  readRefugePending,
  readSession,
  writeRefugePending,
  writeSession,
  type HomeTankStart,
} from './sceneFlow';
import { faceSprite } from './spriteFacing';
import { TankArrivalCard, type ArrivalAreaStars } from './TankArrivalCard';
import { TankDecorator, createDecorationArtResolver } from './TankDecorator';
import { TreasureChestView } from './TreasureChestView';

const TAU = Math.PI * 2;
const TITLE_PX = 34;
const SURFACE_STEP = 8;
const GO_EXPLORING_INDEX = 0;
const CAPTURED_KEYS: readonly number[] = [
  Phaser.Input.Keyboard.KeyCodes.TAB,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
  Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
];
const NAME_TAG_PX = 18;
/** createButton size of a square tile that makes the ICON_TILE body of a compact hub tile. */
const ICON_TILE_SIZE = ICON_TILE.w / TILE_BUTTON.w;
/** Double focus ring round a focused axolotl, as on the decorate footprints (art guide 7f, 8). */
const RING_RADIUS_PX = 18;
const RING_LINE_PX = 3;
const RING_INNER_PX = LW / 2 + 1.5;
const RING_OUTER_PX = LW / 2 + 4.5;

/** The icon on each hub action button. */
const HUB_ICONS: Readonly<Record<HubActionId, IconKind>> = Object.freeze({
  goExploring: 'play',
  decorate: 'decorate',
  treasureChest: 'chest',
  collectionBook: 'book',
  refuge: 'refuge',
  sound: 'soundsOn',
});

/**
 * Home Tank draw order (art guide 7f): back layer (wall to gravel), placed Decorations, glass shine,
 * axolotls, surface line, tank outline and lid front, hub UI (with the Refuge tile's nudge badge, a
 * focused axolotl's ring and name tag) and the decorate toolbar, the Treasure Chest, the Collection
 * Book, the explorer card, the choices card or the restyle screen (never open together), then the
 * tank arrival card or a refuge milestone card (never open together) on top.
 */
const TANK_DEPTH = Object.freeze({
  back: DEPTH.bg,
  decorations: DEPTH.reeds,
  glass: DEPTH.haze,
  axolotls: DEPTH.axolotl,
  surface: DEPTH.surface,
  front: DEPTH.fx,
  hub: DEPTH.ui,
  chest: DEPTH.ui + 8,
  book: DEPTH.ui + 8,
  arrival: DEPTH.ui + 9,
  milestone: DEPTH.ui + 9,
  sound: DEPTH.ui + 9,
  restyle: DEPTH.ui + 8,
  explorer: DEPTH.ui + 8,
  choices: DEPTH.ui + 8,
});

/**
 * What the Home Tank is showing and where keys go, in priority order: the tank arrival card, a
 * refuge milestone card (PRD N2), the Sound card (PRD M8, S14), the Treasure Chest, the Collection Book, decorate mode, restyling
 * an axolotl (PRD F6), the explorer card (PRD F7), the axolotl choices card (PRD F6), or the hub.
 */
type TankMode =
  | 'arrival'
  | 'milestone'
  | 'sound'
  | 'chest'
  | 'book'
  | 'decorate'
  | 'restyle'
  | 'explorer'
  | 'choices'
  | 'hub';

/** Where a restyle was opened from, and so where Done or Cancel goes back to: the hub, or the explorer card's Change outfit. */
type RestyleFrom = 'hub' | 'explorer';

/**
 * One hub action: its full button and, for a secondary tile, its icon-only compact variant (null for
 * the primary, whose compact look is its full one). Only the variant hubLayout picks shows.
 */
interface HubButton {
  id: HubActionId;
  full: UiButton;
  compact: UiButton | null;
}

/**
 * One owned axolotl swimming in the tank: its own rig bake (its look, its morph's colours or its
 * Dream colour's over its morph, and its outfit), the rig view showing it, and its tap area.
 */
interface TankSwimmer {
  id: string;
  bake: AxolotlRigBake;
  view: AxolotlRigView;
  /**
   * Tap area on the view's root in texture px from the anchor (the root's local origin), kept at
   * least the touch target size (touchHitRect).
   */
  hitArea: Phaser.Geom.Rectangle;
  /** The bake version the tap area was sized for; a re-bake (a size change) sizes it again. */
  hitVersion: number;
  /** Whether a press began on this axolotl, so only a press and release on it picks it. */
  pressed: boolean;
}

/** The double focus ring (art guide 8) round `rect`: inner white, outer ink, both opaque. */
function strokeAxolotlRing(graphics: Phaser.GameObjects.Graphics, rect: Rect): void {
  for (const [outset, colour] of [
    [RING_INNER_PX, WHITE],
    [RING_OUTER_PX, INK],
  ] as const) {
    graphics.lineStyle(RING_LINE_PX, cssColor(colour).color, 1);
    graphics.strokeRoundedRect(
      rect.x - outset,
      rect.y - outset,
      rect.w + 2 * outset,
      rect.h + 2 * outset,
      RING_RADIUS_PX + outset,
    );
  }
}

/** Focus step for a hub key: next, right and down step forward; previous, left and up step back; else 0. */
function hubFocusStep(action: TankKey): number {
  if (action === 'next' || action === 'right' || action === 'down') return 1;
  if (action === 'previous' || action === 'left' || action === 'up') return -1;
  return 0;
}

/** The area of the zone with id `areaId`. Throws when there is no such area. */
function zoneArea(areaId: string): Readonly<AreaData> {
  const area = areaById(areaId);
  if (area === undefined) throw new Error(`HomeTankScene: no area ${areaId}`);
  return area;
}

/** The explorer card entry of an owned axolotl: its id, name, worn perks (outfitPerks) and what its picture shows. */
function explorerCardAxolotl(axolotl: OwnedAxolotl): ExplorerCardAxolotl {
  const { id, name, morph, look, dreamColour, outfit } = axolotl;
  return { id, name, worn: outfitPerks(outfit), morph, look, dreamColour, outfit };
}

/** Who wears each Wearable among the owned axolotls other than `axolotlId`, by Wearable id, for the restyle Outfit tab. */
function wearersBesides(axolotls: readonly OwnedAxolotl[], axolotlId: string): Map<string, StylerWearer> {
  const wearers = new Map<string, StylerWearer>();
  for (const other of axolotls) {
    if (other.id === axolotlId) continue;
    for (const wearableId of wornIds(other.outfit)) wearers.set(wearableId, { axolotlId: other.id, name: other.name });
  }
  return wearers;
}

/** Places a full-frame tank layer (480 x 360, origin top-left) on the tank frame. */
function placeTankLayer(image: Phaser.GameObjects.Image, info: TexInfo, frame: TankFrame): void {
  image.setPosition(frame.x, frame.y).setScale(frame.scale / info.scale);
}

/**
 * The Home Tank hub (PRD C7, C8): the tank on the wall, every owned axolotl swimming on its own
 * in its morph's colours and its own look (still poses under reduced motion), the animated surface
 * line, the hub actions Go exploring, Decorate, Treasure Chest, Collection Book and Refuge, by touch
 * and by keyboard, and the best-stars badge of the area (H7), stacked when the hub rows reach over
 * the floor Decorations. Every axolotl wears its outfit (PRD C10, F8). Refuge opens the Xochimilco
 * refuge (PRD N2), whose Back opens this scene with the Refuge tile focused (HomeTankStart focus);
 * the Refuge tile wears the nudge badge while a clean-up is pending.
 * Go exploring opens the explorer card (PRD F7), even with one axolotl, and Go! there opens the
 * area map (PRD N2), whose Back opens this scene with the card open again (HomeTankStart
 * openExplorer); its Change outfit opens the restyle Outfit tab and comes back to the card. After a trip
 * the tank arrival card shows first and takes every key and press until it closes; after beating
 * the area it is the "Area beaten" card, and closing it leaves the player in the hub. Each pending
 * refuge milestone (a habitat newly clean) then shows as its own milestone card naming the explorer,
 * one at a time in habitat order, before the hub takes the input (or "Try it now!" opens restyle);
 * with no arrival card they show at once on create. The hub focus
 * runs over the hub buttons and then the axolotls, and a tap on an axolotl, or Enter or Space on a
 * focused one, opens the axolotl choices card for it (PRD F6), whose Restyle, Outfit and Dream colour
 * open the restyle screen on that step and whose Back comes back to the hub with that axolotl focused.
 */
export class HomeTankScene extends Phaser.Scene {
  private assets!: GameAssets;
  private arrival: TripEnding | null = null;
  /** Id of the area the arrival card is about, from the start data. */
  private arrivalAreaId = '';
  /** Whether the explorer card opens at once (Back on the area map), from the start data. */
  private openExplorerOnCreate = false;
  /** Whether the hub opens with the Refuge tile focused (Back in the refuge), from the start data. */
  private focusRefugeOnCreate = false;
  private session!: Session;
  private area!: Readonly<AreaData>;
  private motion!: MotionProfile;
  private view!: SceneView;
  private frame!: TankFrame;
  private clock = 0;
  private mode: TankMode = 'hub';
  private exploring = false;
  /** Whether Refuge was pressed, so the refuge opens once. */
  private openingRefuge = false;
  private focusIndex = GO_EXPLORING_INDEX;

  private back!: Phaser.GameObjects.Image;
  private glass!: Phaser.GameObjects.Image;
  private front!: Phaser.GameObjects.Image;
  private surface!: Phaser.GameObjects.Graphics;
  private surfaceLine = { color: 0, alpha: 1 };
  private swimmers: TankSwimmer[] = [];

  private titlePanel!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private hubButtons: HubButton[] = [];
  /** Whether the hub uses its compact variants, as the last hubLayout picked. */
  private hubCompact = false;
  /** The last hub layout and best-stars badge rect, for the hub focus caption; null before the first layout. */
  private hubPlan: HubLayout | null = null;
  private hubBadgeRect: Rect | null = null;
  private hubCaptionPanel!: Phaser.GameObjects.Graphics;
  private hubCaptionText!: Phaser.GameObjects.Text;
  /** The nudge badge on the shown Refuge tile variant, while a refuge clean-up is pending. */
  private refugeNudge!: Phaser.GameObjects.Image;
  /** The refuge milestone card showing, if any. */
  private milestoneCard: RefugeMilestoneCard | null = null;
  /** The Sound card showing, if any (PRD M8, S14). */
  private soundCard: SoundCard | null = null;
  /** The Decorations the tank uses: the shipped ones plus the dev pack's (page session only). */
  private tankCatalogue: readonly Decoration[] = SHIPPED_DECORATIONS;
  private titleFits = false;
  private starsBadge!: AreaStarsBadge;
  private decorator!: TankDecorator;
  private chest!: TreasureChestView;
  private book!: CollectionBookView;
  private arrivalCard!: TankArrivalCard;
  private pickRing!: Phaser.GameObjects.Graphics;
  private nameTagPanel!: Phaser.GameObjects.Graphics;
  private nameTagText!: Phaser.GameObjects.Text;
  private restyler: AxolotlStyler | null = null;
  private explorerCard: ExplorerCard | null = null;
  private choicesCard: AxolotlChoicesCard | null = null;

  constructor() {
    super(SCENE_KEYS.homeTank);
  }

  init(data: HomeTankStart): void {
    this.assets = data.assets;
    this.arrival = data.arrival;
    this.arrivalAreaId = data.areaId;
    this.openExplorerOnCreate = data.openExplorer === true;
    this.focusRefugeOnCreate = data.focus === 'refuge';
    this.clock = 0;
    this.mode = 'hub';
    this.exploring = false;
    this.openingRefuge = false;
    this.focusIndex = GO_EXPLORING_INDEX;
    this.swimmers = [];
    this.hubButtons = [];
    this.hubCompact = false;
    this.hubPlan = null;
    this.hubBadgeRect = null;
    this.titleFits = false;
    this.restyler = null;
    this.explorerCard = null;
    this.choicesCard = null;
    this.milestoneCard = null;
    this.soundCard = null;
  }

  create(): void {
    setMusicScreen('homeTank');
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    this.session = readSession(this.registry);
    this.area = zoneArea(areaById(this.arrivalAreaId) ? this.arrivalAreaId : this.session.hub.lastAreaId);
    this.frame = tankFrame(this.view.cssW, this.view.cssH);
    useCssCamera(this.cameras.main, this.view.fit.dpr);
    this.cameras.main.setBackgroundColor(HOME_TANK_WALL);
    this.tankCatalogue = [...SHIPPED_DECORATIONS, ...(this.assets.devDecor?.decorations ?? [])];

    this.buildTank();
    this.buildDecorator();
    this.buildSwimmers();
    this.buildHub();
    this.buildStarsBadge();
    this.buildPickFocus();
    this.chest = new TreasureChestView(
      this,
      { baked: this.assets.baked, treasure: this.assets.treasure },
      this.view,
      TANK_DEPTH.chest,
      () => this.closeChest(),
    );
    this.book = new CollectionBookView(
      this,
      { baked: this.assets.baked, morph: this.assets.morph, treasure: this.assets.treasure },
      this.view,
      TANK_DEPTH.book,
      () => this.closeBook(),
    );
    this.arrivalCard = new TankArrivalCard(
      this,
      this.assets,
      this.view,
      TANK_DEPTH.arrival,
      () => this.motion,
      { onClose: (tryItNow) => this.closeArrival(tryItNow), onFirstFindSeen: (kind) => this.saveFirstFindSeen(kind) },
    );
    this.bindInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.layout();
    this.animate(0);
    if (this.arrival !== null) this.showArrival(this.arrival);
    else this.showMilestones(() => this.openStartView());
    this.refreshHubFocus();
  }

  /**
   * With no arrival card, once the milestone cards closed: the explorer card (Back on the area map),
   * else the hub with the Refuge tile (Back in the refuge) or Go exploring focused.
   */
  private openStartView(): void {
    if (this.openExplorerOnCreate) {
      this.openExplorerCard('go', this.session.hub.explorerId);
      return;
    }
    this.showHub(this.focusRefugeOnCreate ? this.hubIndexOf('refuge') : GO_EXPLORING_INDEX);
  }

  /**
   * Animates the tank, or only the styler while the restyle screen's opaque backdrop covers the tank,
   * so hidden axolotls are not posed (art guide 9). The tank picks up where it left off.
   * An open explorer card counts its Go! wait, and an open choices card its press wait, while the
   * tank animates behind its dim.
   */
  update(time: number, deltaMs: number): void {
    if (this.restyler !== null) {
      this.restyler.update(time, deltaMs);
      return;
    }
    this.explorerCard?.update(time, deltaMs);
    this.choicesCard?.update(time, deltaMs);
    this.animate(Math.min(Math.max(deltaMs / 1000, 0), 0.05));
  }

  // ---- build ---------------------------------------------------------------

  private buildTank(): void {
    const tank = this.assets.tank;
    this.back = this.add.image(0, 0, tank.back.key).setOrigin(0, 0).setDepth(TANK_DEPTH.back);
    this.glass = this.add.image(0, 0, tank.glass.key).setOrigin(0, 0).setDepth(TANK_DEPTH.glass);
    this.surface = this.add.graphics().setDepth(TANK_DEPTH.surface);
    this.surfaceLine = cssColor(SURFACE_LINE);
    this.front = this.add.image(0, 0, tank.front.key).setOrigin(0, 0).setDepth(TANK_DEPTH.front);
  }

  /**
   * The placed Decorations, always drawn, and decorate mode, entered from the hub. With a dev
   * Decoration pack, its Decorations join the tank catalogue and count as owned, for this page
   * session only.
   */
  private buildDecorator(): void {
    const { baked, treasure, tank, devDecor } = this.assets;
    this.decorator = new TankDecorator(
      {
        scene: this,
        textures: { baked, treasure, tank },
        art: createDecorationArtResolver(tank, treasure, devDecor?.textures ?? null),
        catalogue: this.tankCatalogue,
        depths: { decorations: TANK_DEPTH.decorations, ui: TANK_DEPTH.hub },
        dpr: this.view.fit.dpr,
        onLayoutChange: (layout) => this.saveTankLayout(layout),
        onDone: () => this.stopDecorating(),
      },
      this.session.hub.tank,
      this.tankOwnedIds(this.session.hub.banked),
    );
  }

  /** The ids the tank counts as owned: `banked` plus every dev pack Decoration (page session only). */
  private tankOwnedIds(banked: readonly string[]): string[] {
    const devIds = this.assets.devDecor?.decorations.map((decoration) => decoration.id) ?? [];
    return [...banked, ...devIds];
  }

  /**
   * One swimmer per owned axolotl in its morph's colours (or its Dream colour), its own look and its
   * outfit, each with its own rig bake and view so their poses never share a frame. Baked at the
   * boot bake scale; the look's size factor is applied by the bake.
   */
  private buildSwimmers(): void {
    const bakeScale = this.assets.axolotl.bakeScale;
    this.swimmers = this.session.hub.axolotls.map((axolotl, index): TankSwimmer => {
      const bake = createAxolotlRigBake(this, `tank-axolotl-${axolotl.id}`, bakeScale, {
        look: axolotl.look,
        palette: axolotlPalette(axolotl.morph, axolotl.dreamColour),
        outfit: artOutfit(axolotl.outfit),
      });
      const view = createAxolotlRigView(this, bake);
      view.root.setDepth(TANK_DEPTH.axolotls);
      const swimmer: TankSwimmer = {
        id: axolotl.id,
        bake,
        view,
        hitArea: new Phaser.Geom.Rectangle(0, 0, bake.info.pxW, bake.info.pxH),
        hitVersion: -1,
        pressed: false,
      };
      this.fitSwimmerHitArea(swimmer);
      this.bindSwimmerTap(swimmer, index);
      return swimmer;
    });
  }

  /**
   * A press and release on an axolotl, in the hub, picks it; leaving it first cancels the press.
   * The tap area sits on the view's root Container, which hit-tests in its local space from its
   * origin (a Container's display origin is 0 while it has no size), with a negative x scale
   * mirrored back, so a left-facing axolotl hits its mirrored art.
   */
  private bindSwimmerTap(swimmer: TankSwimmer, index: number): void {
    const { root } = swimmer.view;
    root.setInteractive({
      hitArea: swimmer.hitArea,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    root.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      swimmer.pressed = this.mode === 'hub';
    });
    root.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      swimmer.pressed = false;
    });
    root.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.releaseSwimmer(swimmer, index));
  }

  /** The focused axolotl's double focus ring and its name tag (a white panel with the name in bold ink 18 px). */
  private buildPickFocus(): void {
    this.pickRing = this.add.graphics().setDepth(TANK_DEPTH.hub);
    this.nameTagPanel = this.add.graphics().setDepth(TANK_DEPTH.hub);
    this.nameTagText = this.add.text(0, 0, '', uiTextStyle(NAME_TAG_PX, this.view.fit.dpr)).setDepth(TANK_DEPTH.hub);
  }

  /**
   * The hub actions in focus order (Go exploring first), the Home Tank name panel, the Refuge tile's
   * nudge badge (over the tiles), and the hub focus caption that names a focused icon-only tile (a
   * white panel with the label in bold ink 18 px, like the name tag).
   */
  private buildHub(): void {
    const dpr = this.view.fit.dpr;
    this.titlePanel = this.add.graphics().setDepth(TANK_DEPTH.hub);
    this.titleText = this.add.text(0, 0, HOME_TANK_NAME, uiTextStyle(TITLE_PX, dpr)).setDepth(TANK_DEPTH.hub);
    this.hubButtons = HUB_BUTTONS.map((spec) => this.addHubButton(spec));
    const nudge = this.assets.refuge.nudge;
    this.refugeNudge = this.add
      .image(0, 0, nudge.key)
      .setOrigin(nudge.originNormX, nudge.originNormY)
      .setScale(1 / nudge.scale)
      .setDepth(TANK_DEPTH.hub)
      .setVisible(false);
    this.hubCaptionPanel = this.add.graphics().setDepth(TANK_DEPTH.hub);
    this.hubCaptionText = this.add.text(0, 0, '', uiTextStyle(NAME_TAG_PX, dpr)).setDepth(TANK_DEPTH.hub);
  }

  /** The best-stars badge of the area, under the hub, showing the best stars this session (H7). */
  private buildStarsBadge(): void {
    this.starsBadge = new AreaStarsBadge(
      this,
      this.assets.area.stars,
      areaLabel(this.area.number),
      TANK_DEPTH.hub,
      this.view.fit.dpr,
    );
    this.refreshStarsBadge();
  }

  /** Shows the area's best stars from the session on the badge. */
  private refreshStarsBadge(): void {
    this.starsBadge.setStars(bestStars(this.session, this.area.id));
  }

  /**
   * A hub button in the shape and size-1 body width hubButtonLook() gives, to hold its icon and label,
   * and, when hubButtonCompactLook() makes it an icon tile, its icon-only ICON_TILE variant.
   */
  private addHubButton(spec: HubButtonSpec): HubButton {
    const { id, label, primary } = spec;
    const look = hubButtonLook(spec);
    const common = {
      fill: primary ? 'primary' : 'secondary',
      label,
      icon: HUB_ICONS[id],
      dpr: this.view.fit.dpr,
      pressOnDown: false,
      onPress: () => this.runHubAction(id),
    } as const;
    const full = createButton(this, this.assets.baked, { ...common, shape: look.shape, size: 1, width: look.w });
    full.container.setDepth(TANK_DEPTH.hub);
    if (hubButtonCompactLook(spec).shape !== 'icon') return { id, full, compact: null };
    const compact = createButton(this, this.assets.baked, {
      ...common,
      shape: 'square',
      size: ICON_TILE_SIZE,
      iconOnly: true,
    });
    compact.container.setDepth(TANK_DEPTH.hub).setVisible(false);
    return { id, full, compact };
  }

  /** The variant of `hubButton` the hub shows now: the compact one when the hub is compact and it has one. */
  private shownHubButton(hubButton: HubButton): UiButton {
    return this.hubCompact && hubButton.compact !== null ? hubButton.compact : hubButton.full;
  }

  /** One keydown handler for every Home Tank key; Tab, arrows, Space and Backspace are captured while it runs. */
  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture([...CAPTURED_KEYS]);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
  }

  // ---- modes ---------------------------------------------------------------

  /** Shows the arrival card for the trip that ended; after beating the area, with its best stars. */
  private showArrival(ending: TripEnding): void {
    this.mode = 'arrival';
    this.refreshStarsBadge();
    const areaStars: ArrivalAreaStars | undefined =
      ending.reason === 'areaBeaten'
        ? { area: this.area, best: bestStars(this.session, this.area.id), rescueOpen: canRescueMore(this.session) }
        : undefined;
    this.arrivalCard.show(
      ending,
      this.session.hub.banked.length,
      areaStars,
      areaMemory(this.session, this.area.id).waitingStranded,
      dueFirstFindCards(this.session.hub.banked, this.session.hub.firstFindsSeen),
    );
    this.refreshHubFocus();
  }

  /**
   * The arrival card and its first-find cards closed: the pending milestone cards show first, then
   * the arrival card's way on (finishArrival), "Try it now!" included.
   */
  private closeArrival(tryItNow = false): void {
    this.showMilestones(() => this.finishArrival(tryItNow));
  }

  /**
   * After the arrival card, its first-find cards and the milestone cards: after "Try it now!" opens
   * restyle on the Dream colour step for the explorer (else the first owned axolotl); otherwise, or
   * with no such swimmer, back to the hub with Go exploring focused.
   */
  private finishArrival(tryItNow: boolean): void {
    if (tryItNow) {
      const { explorerId, axolotls } = this.session.hub;
      const id = tryItNowAxolotlId(explorerId, axolotls.map((axolotl) => axolotl.id));
      const index = this.swimmers.findIndex((swimmer) => swimmer.id === id);
      if (index !== -1) {
        this.openRestyle(index, 'hub', 'dream');
        return;
      }
    }
    this.showHub(GO_EXPLORING_INDEX);
  }

  /**
   * Shows the first pending refuge milestone (PRD N2, in habitat order) as a milestone card naming
   * the explorer, playing the refuge sound as it shows (issue #167, ND-8), which takes every key and
   * press until it closes; with none pending, runs `then` and plays nothing. Throws when a pending
   * milestone names no habitat.
   */
  private showMilestones(then: () => void): void {
    this.destroyMilestoneCard();
    const habitatId = readRefugePending(this.registry).milestones[0];
    if (habitatId === undefined) {
      then();
      return;
    }
    const habitat = habitatById(habitatId);
    if (habitat === undefined) throw new Error(`HomeTankScene: no habitat ${habitatId}`);
    this.mode = 'milestone';
    this.applyHubVisibility();
    this.refreshHubFocus();
    const explorerName = explorerAxolotl(this.session).name;
    this.milestoneCard = new RefugeMilestoneCard(
      this,
      this.assets,
      this.view,
      TANK_DEPTH.milestone,
      habitat,
      explorerName,
      () => this.closeMilestone(habitatId, then),
    );
    playSound('refuge');
  }

  /** A milestone card closed: drops its milestone from the pending ones, then shows the next or runs `then`. */
  private closeMilestone(habitatId: string, then: () => void): void {
    writeRefugePending(this.registry, withoutMilestone(readRefugePending(this.registry), habitatId));
    this.showMilestones(then);
  }

  /** Removes the milestone card, if any. */
  private destroyMilestoneCard(): void {
    this.milestoneCard?.destroy();
    this.milestoneCard = null;
  }

  /** A first-find card closed: remembers its kind as seen and saves it (PRD C15, D1). */
  private saveFirstFindSeen(kind: FirstFindKind): void {
    this.session = markFirstFindSeen(readSession(this.registry), kind);
    writeSession(this.registry, this.session);
  }

  /** Gives the hub the input again, showing its buttons with the focus on `focusIndex`. */
  private showHub(focusIndex: number): void {
    this.mode = 'hub';
    this.focusIndex = focusIndex;
    this.applyHubVisibility();
    this.refreshHubFocus();
  }

  /**
   * Leaves the hub for the Treasure Chest, the Collection Book, decorate mode, restyle, the explorer
   * card or the choices card: its buttons and name panel hide.
   */
  private leaveHub(mode: 'chest' | 'book' | 'decorate' | 'restyle' | 'explorer' | 'choices'): void {
    this.mode = mode;
    this.applyHubVisibility();
    this.refreshHubFocus();
  }

  /** Index of the hub button `id`. Throws when the hub has no such button. */
  private hubIndexOf(id: HubActionId): number {
    const index = this.hubButtons.findIndex((hubButton) => hubButton.id === id);
    if (index === -1) throw new Error(`HomeTankScene: no hub button ${id}`);
    return index;
  }

  /** Runs a hub action, only while the hub has the input. Throws for an action with no case. */
  private runHubAction(id: HubActionId): void {
    if (this.mode !== 'hub') return;
    switch (id) {
      case 'goExploring':
        this.openExplorerCard('go', this.session.hub.explorerId);
        return;
      case 'treasureChest':
        this.openChest();
        return;
      case 'decorate':
        this.startDecorating();
        return;
      case 'collectionBook':
        this.openBook();
        return;
      case 'refuge':
        this.startRefuge();
        return;
      case 'sound':
        this.openSoundCard();
        return;
      default: {
        const unhandled: never = id;
        throw new Error(`HomeTankScene: no hub action ${String(unhandled)}`);
      }
    }
  }

  /**
   * Sound: opens the Sound card with the music and sounds switches over the hub (PRD M8, S14), which
   * takes every key and press until it closes; the focus then comes back to Sound.
   */
  private openSoundCard(): void {
    this.destroySoundCard();
    this.mode = 'sound';
    this.refreshHubFocus();
    this.soundCard = new SoundCard(this, this.assets, this.view, TANK_DEPTH.sound, () => this.closeSoundCard());
    this.soundCard.open();
  }

  private closeSoundCard(): void {
    this.destroySoundCard();
    this.showHub(this.hubIndexOf('sound'));
  }

  /** Removes the Sound card, if any. */
  private destroySoundCard(): void {
    this.soundCard?.destroy();
    this.soundCard = null;
  }

  /** Refuge, once: opens the Xochimilco refuge (PRD N2) through the scene flow (openRefuge). */
  private startRefuge(): void {
    if (this.openingRefuge) return;
    this.openingRefuge = true;
    openRefuge(this, this.assets);
  }

  /**
   * Opens the explorer card (PRD F7) over the hub with every owned axolotl, its worn perks and its
   * outfit, `explorerId` chosen (the first axolotl when null or not owned) and `focus` focused. Every
   * key goes to the card until Go!, Change outfit or Back.
   */
  private openExplorerCard(focus: 'go' | 'changeOutfit', explorerId: string | null): void {
    this.leaveHub('explorer');
    this.explorerCard = new ExplorerCard(this, this.assets, this.view, TANK_DEPTH.explorer, {
      axolotls: this.session.hub.axolotls.map(explorerCardAxolotl),
      explorerId,
      focus,
      onChoose: (id) => this.saveExplorer(id),
      onGo: (id) => this.startExploring(id),
      onChangeOutfit: (id) => this.changeOutfit(id),
      onBack: () => this.closeExplorerCard(),
    });
  }

  /** Removes the explorer card, if open. */
  private destroyExplorerCard(): void {
    this.explorerCard?.destroy();
    this.explorerCard = null;
  }

  /** A new axolotl chosen on the explorer card: remembers it as the explorer and saves it (PRD F7, D1). */
  private saveExplorer(id: string): void {
    this.session = chooseExplorer(readSession(this.registry), id);
    writeSession(this.registry, this.session);
  }

  /** Go! on the explorer card, once: removes the card and goes on with `id` as the explorer through the scene flow (goExploring). */
  private startExploring(id: string): void {
    if (this.exploring) return;
    this.exploring = true;
    this.destroyExplorerCard();
    goExploring(this, this.assets, id);
  }

  /** Change outfit on the explorer card: removes the card and opens the restyle Outfit tab for `id`. */
  private changeOutfit(id: string): void {
    this.destroyExplorerCard();
    const index = this.swimmers.findIndex((swimmer) => swimmer.id === id);
    if (index === -1) throw new Error(`HomeTankScene: no swimmer for axolotl ${id}`);
    this.openRestyle(index, 'explorer');
  }

  /** Back or Escape on the explorer card: removes it and goes back to the hub with Go exploring focused. */
  private closeExplorerCard(): void {
    this.destroyExplorerCard();
    this.showHub(GO_EXPLORING_INDEX);
  }

  /** Opens the Treasure Chest over the hub (PRD C11) with the treasures banked so far. */
  private openChest(): void {
    this.leaveHub('chest');
    this.chest.open(this.session.hub.banked);
  }

  /** The Treasure Chest closed: back to the hub with Treasure Chest focused. */
  private closeChest(): void {
    this.showHub(this.hubIndexOf('treasureChest'));
  }

  /** Opens the Collection Book over the hub (PRD C12, C14) with the found morphs and the hazards met. */
  private openBook(): void {
    this.leaveHub('book');
    this.book.open(this.session.hub.book.foundMorphs, this.session.hub.metHazards);
  }

  /** The Collection Book closed: back to the hub with Collection Book focused. */
  private closeBook(): void {
    this.showHub(this.hubIndexOf('collectionBook'));
  }

  /** Starts decorate mode (PRD C9); the hub hides while the decorate toolbar shows. */
  private startDecorating(): void {
    this.leaveHub('decorate');
    this.decorator.enter();
  }

  /** Done or cancel in decorate mode: ends it and goes back to the hub with Decorate focused. */
  private stopDecorating(): void {
    this.decorator.exit();
    this.showHub(this.hubIndexOf('decorate'));
  }

  /**
   * Stores a placement, move or put away in the session, so the Home Tank keeps it between trips.
   * Dev pack placements stay in the page session only; the save keeps shipped Decorations only.
   */
  private saveTankLayout(layout: TankLayout): void {
    const session = readSession(this.registry);
    this.session = setTankLayout(session, layout, {
      catalogue: this.tankCatalogue,
      owned: this.tankOwnedIds(session.hub.banked),
    });
    writeSession(this.registry, this.session);
  }

  /** Picks the axolotl when the press began on it and the hub still has the input: opens its choices card. */
  private releaseSwimmer(swimmer: TankSwimmer, index: number): void {
    const wasPressed = swimmer.pressed;
    swimmer.pressed = false;
    if (wasPressed && this.mode === 'hub') this.openAxolotlChoices(index);
  }

  /**
   * Opens the axolotl choices card (PRD F6) over the hub for the axolotl at `index`, with Dream colour
   * when the hub owns at least one. Every key goes to the card until a choice or Back.
   */
  private openAxolotlChoices(index: number): void {
    const axolotl = this.swimmerAxolotl(index);
    this.leaveHub('choices');
    this.choicesCard = new AxolotlChoicesCard(this, this.assets, this.view, TANK_DEPTH.choices, {
      name: axolotl.name,
      ownedDreamCount: ownedDreamColours(this.session.hub.banked).length,
      onChoose: (_choice, startStep) => this.chooseFromCard(index, startStep),
      onBack: () => this.closeAxolotlChoices(index),
    });
  }

  /** Removes the choices card, if open. */
  private destroyChoicesCard(): void {
    this.choicesCard?.destroy();
    this.choicesCard = null;
  }

  /**
   * A choice on the choices card: removes the card and opens restyle on `startStep`; Done or Cancel
   * come back to the hub with that axolotl focused.
   */
  private chooseFromCard(index: number, startStep: StylerStep): void {
    this.destroyChoicesCard();
    this.openRestyle(index, 'hub', startStep);
  }

  /** Back or Escape on the choices card: removes it and goes back to the hub with the axolotl at `index` focused. */
  private closeAxolotlChoices(index: number): void {
    this.destroyChoicesCard();
    this.showHub(axolotlFocusIndex(index, this.hubButtons.length));
  }

  /** The owned axolotl the swimmer at `index` shows. Throws when the session does not own it. */
  private swimmerAxolotl(index: number): OwnedAxolotl {
    const id = this.swimmers[index]?.id;
    const axolotl = this.session.hub.axolotls.find((owned) => owned.id === id);
    if (axolotl === undefined) throw new Error(`HomeTankScene: no owned axolotl for swimmer ${index}`);
    return axolotl;
  }

  /**
   * Opens the restyle screen (PRD F6) for the axolotl at `index`, starting from its name, look,
   * morph (shown read-only), Dream colour and outfit, offering the Dream colours the hub owns and,
   * on the Outfit tab, the banked Wearables with who else wears each (PRD C10). From the explorer
   * card it opens on the Outfit tab, otherwise on `startStep` when given (a choice on the axolotl
   * choices card, or "Try it now!" on the Dream colour step). The hub hides and every key goes to the
   * styler until Done or Cancel.
   */
  private openRestyle(index: number, from: RestyleFrom = 'hub', startStep?: StylerStep): void {
    const axolotl = this.swimmerAxolotl(index);
    const banked = this.session.hub.banked;
    const options: RestyleOptions = {
      banked,
      wearers: wearersBesides(this.session.hub.axolotls, axolotl.id),
      startStep: startStep ?? (from === 'explorer' ? 'outfit' : undefined),
    };
    this.leaveHub('restyle');
    this.restyler = new AxolotlStyler(this, this.assets, this.view, TANK_DEPTH.restyle, {
      mode: 'restyle',
      motion: () => this.motion,
      initial: restyleStart(
        {
          name: axolotl.name,
          look: axolotl.look,
          morph: axolotl.morph,
          dreamColour: axolotl.dreamColour,
          outfit: axolotl.outfit,
        },
        ownedDreamColours(banked),
        options,
      ),
      onDone: (styled) => this.finishRestyle(index, styled, from),
      onCancel: () => this.closeRestyle(index, from),
    });
  }

  /**
   * Done in restyle: stores the new name, look, Dream colour and outfit (the morph and every other
   * field stay; a Wearable put on comes off any other axolotl), saving once (D1). Plays this
   * axolotl's restyle sound, or the tap when the restyle has none (issue #167, ND-4, ND-5). Re-bakes
   * that axolotl's swimmer in them, and any other swimmer whose outfit changed, then goes back to
   * where the restyle was opened from.
   */
  private finishRestyle(index: number, styled: StyledAxolotl, from: RestyleFrom): void {
    const { id, dreamColour, outfit } = this.swimmerAxolotl(index);
    playSound(restyleSound({ dreamColour, outfit }, styled) ?? 'tap');
    let next = restyleAxolotl(readSession(this.registry), id, { name: styled.name, look: styled.look });
    next = setDreamColour(next, id, styled.dreamColour);
    next = setOutfit(next, id, styled.outfit);
    this.session = next;
    writeSession(this.registry, this.session);
    const axolotl = this.swimmerAxolotl(index);
    this.swimmers[index].bake.setAppearance({
      look: axolotl.look,
      palette: axolotlPalette(axolotl.morph, axolotl.dreamColour),
    });
    this.refreshSwimmerOutfits();
    this.closeRestyle(index, from);
  }

  /**
   * Done or Cancel in restyle: removes the styler, then goes back to the hub with the axolotl at
   * `index` focused, or from Change outfit to a new explorer card with that axolotl chosen and
   * Change outfit focused.
   */
  private closeRestyle(index: number, from: RestyleFrom): void {
    this.restyler?.destroy();
    this.restyler = null;
    if (from === 'explorer') {
      this.openExplorerCard('changeOutfit', this.swimmerAxolotl(index).id);
      return;
    }
    this.showHub(axolotlFocusIndex(index, this.hubButtons.length));
  }

  /**
   * Gives every swimmer the outfit its owned axolotl wears now. The bake re-bakes only a swimmer
   * whose outfit changed.
   */
  private refreshSwimmerOutfits(): void {
    for (const [index, swimmer] of this.swimmers.entries()) {
      swimmer.bake.setAppearance({ outfit: artOutfit(this.swimmerAxolotl(index).outfit) });
    }
  }

  /**
   * Sizes a swimmer's tap area to its bake's frame, at least the touch target size at the current
   * tank scale, moved so the anchor (the view root's local origin) sits where the frame puts it.
   */
  private fitSwimmerHitArea(swimmer: TankSwimmer): void {
    const { info } = swimmer.bake;
    const area = touchHitRect({ w: info.pxW, h: info.pxH }, swimmer.bake.displayScale(this.frame.scale));
    swimmer.hitArea.setTo(
      area.x - info.originNormX * info.pxW,
      area.y - info.originNormY * info.pxH,
      area.w,
      area.h,
    );
    swimmer.hitVersion = swimmer.bake.version;
  }

  // ---- input ---------------------------------------------------------------

  /**
   * Routes a key to what has the input: the restyle screen (every key, as is), the explorer card or
   * the choices card (every key; each reads its own), the arrival card, a milestone card, the Treasure
   * Chest, the Collection Book, decorate mode, or the hub. Unmapped keys are ignored, and so is a held
   * confirm outside the hub.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (this.mode === 'restyle') {
      this.restyler?.handleKey(event);
      return;
    }
    if (this.mode === 'explorer') {
      this.explorerCard?.handleKey(event);
      return;
    }
    if (this.mode === 'choices') {
      this.choicesCard?.handleKey(event);
      return;
    }
    const action = tankKeyFor(event.key, event.shiftKey);
    if (action === null) return;
    switch (this.mode) {
      case 'arrival':
        this.handleArrivalKey(action, event);
        return;
      case 'milestone':
        this.milestoneCard?.handleKey(action, event.repeat);
        return;
      case 'sound':
        this.soundCard?.handleKey(action, event.repeat);
        return;
      case 'chest':
        if (action !== 'confirm' || !event.repeat) this.chest.handleKey(action);
        return;
      case 'book':
        if (action !== 'confirm' || !event.repeat) this.book.handleKey(action);
        return;
      case 'decorate':
        if (action !== 'confirm' || !event.repeat) this.decorator.handleKey(action);
        return;
      case 'hub':
        this.handleHubKey(action, event);
        return;
    }
  }

  /** Every key goes to the arrival card, which passes it to a showing first-find card or presses OK. */
  private handleArrivalKey(action: TankKey, event: KeyboardEvent): void {
    this.arrivalCard.handleKey(action, event.repeat);
  }

  /**
   * Confirm presses the focused hub button or opens the choices card for the focused axolotl,
   * ignoring key repeat; the arrows and Tab move the focus over the hub buttons, then the axolotls.
   */
  private handleHubKey(action: TankKey, event: KeyboardEvent): void {
    if (action === 'confirm') {
      if (!event.repeat) this.pressFocused();
      return;
    }
    const step = hubFocusStep(action);
    if (step === 0) return;
    this.focusIndex = stepTankFocus(this.focusIndex, this.hubButtons.length, this.swimmers.length, step);
    this.refreshHubFocus();
  }

  /** What the hub focus is on: a hub button or an axolotl, or null when nothing is focused. */
  private focusTarget(): TankFocusTarget | null {
    return tankFocusTarget(this.focusIndex, this.hubButtons.length, this.swimmers.length);
  }

  /** Presses the focused hub button, or opens the choices card for the focused axolotl. */
  private pressFocused(): void {
    const target = this.focusTarget();
    if (target === null) return;
    if (target.kind === 'hub') {
      this.runHubAction(this.hubButtons[target.i].id);
      return;
    }
    this.openAxolotlChoices(target.i);
  }

  /**
   * Shows the focus ring on the shown variant of the focused hub button, only while the hub has the
   * input (a hidden variant never shows focus), with the hub focus caption, and lets the axolotls take
   * taps only then.
   */
  private refreshHubFocus(): void {
    this.hubButtons.forEach((hubButton, index) => {
      const focused = this.mode === 'hub' && index === this.focusIndex;
      const shown = this.shownHubButton(hubButton);
      hubButton.full.setFocused(focused && shown === hubButton.full);
      hubButton.compact?.setFocused(focused && shown === hubButton.compact);
    });
    this.applySwimmerInput();
    this.renderPickFocus();
    this.renderHubCaption();
  }

  /**
   * Axolotls take taps only in the hub, so they never block a Decoration press in decorate mode;
   * a press in progress is dropped when the hub loses the input.
   */
  private applySwimmerInput(): void {
    const enabled = this.mode === 'hub';
    for (const swimmer of this.swimmers) {
      if (enabled) {
        swimmer.view.root.setInteractive();
      } else {
        swimmer.view.root.disableInteractive();
        swimmer.pressed = false;
      }
    }
  }

  // ---- events --------------------------------------------------------------

  /** Switches the motion profile. Running motion tweens end at once; still poses and upright plants show now (C8). */
  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
    if (!this.motion.ambient) settleMotionTweens(this);
    this.animate(0);
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const dpr = this.view.fit.dpr;
    useCssCamera(this.cameras.main, dpr);
    this.titleText.setResolution(dpr);
    this.starsBadge.setResolution(dpr);
    for (const hubButton of this.hubButtons) {
      hubButton.full.setResolution(dpr);
      hubButton.compact?.setResolution(dpr);
    }
    this.hubCaptionText.setResolution(dpr);
    this.decorator.setResolution(dpr);
    this.chest.setResolution(dpr);
    this.book.setResolution(dpr);
    this.arrivalCard.setResolution(dpr);
    this.nameTagText.setResolution(dpr);
    this.restyler?.setResolution(dpr);
    this.explorerCard?.setResolution(dpr);
    this.choicesCard?.setResolution(dpr);
    this.milestoneCard?.setResolution(dpr);
    this.soundCard?.setResolution(dpr);
    this.layout();
    this.animate(0);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.decorator.destroy();
    this.chest.destroy();
    this.book.destroy();
    this.restyler?.destroy();
    this.restyler = null;
    this.destroyExplorerCard();
    this.destroyChoicesCard();
    this.destroyMilestoneCard();
    this.destroySoundCard();
    this.releaseSwimmers();
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
    keyboard.removeCapture([...CAPTURED_KEYS]);
  }

  /**
   * Removes each axolotl's rig view and then its bake's textures, which the texture manager would
   * otherwise keep for the whole canal trip, then forgets the axolotls (scene shutdown).
   */
  private releaseSwimmers(): void {
    for (const swimmer of this.swimmers) {
      swimmer.view.destroy();
      swimmer.bake.destroy();
    }
    this.swimmers = [];
  }

  // ---- layout --------------------------------------------------------------

  /**
   * Fits the tank to the canvas, sizes the axolotl tap areas, then places the Decorations, the hub,
   * the Treasure Chest, the Collection Book, the arrival card, an open restyle screen, an open
   * explorer card, an open choices card and a showing milestone card.
   */
  private layout(): void {
    this.frame = tankFrame(this.view.cssW, this.view.cssH);
    const tank = this.assets.tank;
    placeTankLayer(this.back, tank.back, this.frame);
    placeTankLayer(this.glass, tank.glass, this.frame);
    placeTankLayer(this.front, tank.front, this.frame);
    for (const swimmer of this.swimmers) {
      this.fitSwimmerHitArea(swimmer);
    }
    this.decorator.layout(this.view, this.frame);
    this.layoutHub();
    this.chest.layout(this.view);
    this.book.layout(this.view);
    this.arrivalCard.layout(this.view);
    this.restyler?.layout(this.view);
    this.explorerCard?.layout(this.view);
    this.choicesCard?.layout(this.view);
    this.milestoneCard?.layout(this.view);
    this.soundCard?.layout(this.view);
  }

  /**
   * Shows the hub buttons (only the variant hubLayout picked; a hidden variant takes no press) and the
   * best-stars badge unless the Treasure Chest, the Collection Book, decorate mode, restyle, the
   * explorer card or the choices card is up, the name panel only when it fits, and the Refuge tile's
   * nudge badge only while a refuge clean-up is pending.
   */
  private applyHubVisibility(): void {
    const shown = this.mode === 'hub' || this.mode === 'arrival' || this.mode === 'milestone' || this.mode === 'sound';
    for (const hubButton of this.hubButtons) {
      const active = this.shownHubButton(hubButton);
      hubButton.full.container.setVisible(shown && active === hubButton.full);
      hubButton.compact?.container.setVisible(shown && active === hubButton.compact);
    }
    this.starsBadge.setVisible(shown);
    this.titlePanel.setVisible(shown && this.titleFits);
    this.titleText.setVisible(shown && this.titleFits);
    this.refugeNudge.setVisible(shown && hasPendingCleanUps(readRefugePending(this.registry)));
  }

  /**
   * Puts the nudge badge's centre at the top-right corner of the shown Refuge tile variant, pulled in
   * REFUGE_NUDGE_INSET on each axis (the full tile or the icon-only tile).
   */
  private placeRefugeNudge(): void {
    const tile = this.shownHubButton(this.hubButtons[this.hubIndexOf('refuge')]);
    const { x, y } = tile.container;
    this.refugeNudge.setPosition(x + tile.width - REFUGE_NUDGE_INSET, y + REFUGE_NUDGE_INSET);
  }

  /**
   * Places the hub buttons through hubLayout() in the full or compact variants it picks, the Refuge
   * tile's nudge badge on the shown variant, the best-stars badge in the shape hubStarsBadgeShape()
   * picks under them (or in the corner) through hubStarsBadgeRect(), the name panel only when it
   * fits, then the focus and the hub focus caption.
   */
  private layoutHub(): void {
    const actions = this.hubButtons.map((hubButton): HubAction => {
      const { full, compact } = hubButton;
      const compactSize: Size = compact === null ? { w: full.width, h: full.height } : { w: compact.width, h: compact.height };
      return { id: hubButton.id, w: full.width, h: full.height, compact: compactSize };
    });
    const titleSize: Size = { w: this.titleText.width + 2 * UI.pad, h: this.titleText.height + 2 * UI.pad };
    const hub = hubLayout(this.view, this.frame, actions, titleSize);
    this.hubPlan = hub;
    this.hubCompact = hub.compact;
    hub.actions.forEach((placement, index) => {
      this.shownHubButton(this.hubButtons[index]).container.setPosition(placement.rect.x, placement.rect.y);
    });
    this.placeRefugeNudge();
    this.starsBadge.setShape(hubStarsBadgeShape(hub));
    this.hubBadgeRect = hubStarsBadgeRect(this.view, this.frame, hub, this.starsBadge.measure());
    this.starsBadge.layout(this.hubBadgeRect);
    const title = hub.title;
    this.titleFits = title !== null;
    this.applyHubVisibility();
    if (title !== null) {
      drawPanel(this.titlePanel, title.x, title.y, title.w, title.h, UI_PANEL);
      this.titleText.setPosition(title.x + UI.pad, title.y + UI.pad);
    }
    this.refreshHubFocus();
  }

  /**
   * The hub focus caption: a white panel (padding 12) naming the focused hub tile in bold ink 18 px,
   * shown only in the hub while that tile shows icon-only, where hubCaptionRect() puts it, clear of the
   * best-stars badge; hidden when there is no place.
   */
  private renderHubCaption(): void {
    const rect = this.hubCaptionPlace();
    this.hubCaptionPanel.setVisible(rect !== null);
    this.hubCaptionText.setVisible(rect !== null);
    if (rect === null) return;
    drawPanel(this.hubCaptionPanel, rect.x, rect.y, rect.w, rect.h, UI_PANEL);
    this.hubCaptionText.setPosition(rect.x + UI.pad, rect.y + UI.pad);
  }

  /** Sets the hub focus caption text and returns its rect, or null when it hides. */
  private hubCaptionPlace(): Rect | null {
    const target = this.mode === 'hub' ? this.focusTarget() : null;
    const hubButton = target?.kind === 'hub' ? this.hubButtons[target.i] : undefined;
    const plan = this.hubPlan;
    if (hubButton === undefined || plan === null || this.shownHubButton(hubButton) !== hubButton.compact) return null;
    this.hubCaptionText.setText(hubButton.compact.label);
    const size: Size = { w: this.hubCaptionText.width + 2 * UI.pad, h: this.hubCaptionText.height + 2 * UI.pad };
    const obstacles = this.hubBadgeRect === null ? [] : [this.hubBadgeRect];
    return hubCaptionRect(this.view, this.frame, plan, size, obstacles);
  }

  // ---- rendering -----------------------------------------------------------

  /** Advances the clock and draws the swimmers, the focused axolotl's ring and tag, the surface and plant sway. */
  private animate(dt: number): void {
    this.clock += dt;
    const t = this.motion.ambient ? this.clock : T_STATIC;
    this.swimmers.forEach((swimmer, index) => this.renderSwimmer(swimmer, index, t));
    this.renderPickFocus();
    this.renderSurface(t);
    this.decorator.update(this.clock, this.motion);
  }

  /**
   * Draws the double focus ring round the focused axolotl's sprite bounds and its name tag, kept on
   * the canvas by nameTagRect(), so both follow it every frame. Both hide unless the hub has the
   * input and the focus is on an axolotl.
   */
  private renderPickFocus(): void {
    const target = this.mode === 'hub' ? this.focusTarget() : null;
    const swimmer = target?.kind === 'axolotl' ? this.swimmers[target.i] : undefined;
    this.pickRing.clear();
    this.nameTagPanel.setVisible(swimmer !== undefined);
    this.nameTagText.setVisible(swimmer !== undefined);
    if (target === null || swimmer === undefined) return;
    const rect: Rect = spriteFrameBounds(swimmer.view.spriteFrame());
    strokeAxolotlRing(this.pickRing, rect);
    this.nameTagText.setText(this.swimmerAxolotl(target.i).name);
    const tagSize: Size = { w: this.nameTagText.width + 2 * UI.pad, h: this.nameTagText.height + 2 * UI.pad };
    const tag = nameTagRect(rect, tagSize, this.view);
    drawPanel(this.nameTagPanel, tag.x, tag.y, tag.w, tag.h, UI_PANEL);
    this.nameTagText.setPosition(tag.x + UI.pad, tag.y + UI.pad);
  }

  /**
   * Poses one axolotl and places it from its tank pose (still under reduced motion); a re-bake since
   * its tap area was sized sizes it again.
   */
  private renderSwimmer(swimmer: TankSwimmer, index: number, t: number): void {
    const pose: AxolotlPose = {
      swimPhase: (TAU * t) / 1.2,
      gillPhase: this.motion.gillFlutter ? (TAU * t) / 0.8 : (TAU * T_STATIC) / 0.8,
      blink: this.motion.ambient ? blinkAt(t) : 1,
      tailAmp: 1,
      sparkle: 0,
      sheen: this.motion.ambient ? dreamSheenAt(t) : undefined,
    };
    swimmer.view.setPose(pose);
    if (swimmer.hitVersion !== swimmer.bake.version) this.fitSwimmerHitArea(swimmer);
    const swim = tankSwimPose(swimmer.id, index, this.clock, !this.motion.ambient);
    const at = tankToCss(this.frame, { x: swim.x, y: swim.y });
    faceSprite(
      swimmer.view.root.setPosition(at.x, at.y).setRotation(swim.tilt),
      swim.facing,
      swimmer.bake.displayScale(this.frame.scale),
    );
  }

  /** The surface line across the glass at the tank water top, with the canal wave (still under reduced motion). */
  private renderSurface(t: number): void {
    const { x0, x1 } = TANK.glass;
    const steps = Math.max(1, Math.ceil((x1 - x0) / SURFACE_STEP));
    const graphics = this.surface;
    graphics.clear();
    graphics.lineStyle(SURFACE_LINE_WIDTH * this.frame.scale, this.surfaceLine.color, this.surfaceLine.alpha);
    graphics.beginPath();
    for (let step = 0; step <= steps; step++) {
      const x = Math.min(x0 + step * SURFACE_STEP, x1);
      const at = tankToCss(this.frame, { x, y: TANK.waterTop + waveY(x, t) - SURF });
      if (step === 0) {
        graphics.moveTo(at.x, at.y);
      } else {
        graphics.lineTo(at.x, at.y);
      }
    }
    graphics.strokePath();
  }
}
