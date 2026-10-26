import * as Phaser from 'phaser';
import { LEG_ICON_SIZE } from '../art/drawLegIcons';
import { BUTTON_SQUARE, STICK_BASE_R, STICK_KNOB_R, buttonRadius } from '../art/drawUi';
import { DEPTH } from '../art/layers';
import { INK, UI_PANEL, UI_PANEL_PINK, WHITE } from '../art/palette';
import { iconKey, type TexInfo } from '../art/textures';
import { exitClosedText, snacksLeftLabel } from '../logic/areaText';
import { sourceFactCards } from '../logic/areas';
import type { FactCard as FactCardData } from '../logic/factCards';
import { pickToastAnnouncement } from '../logic/findToast';
import {
  GAME_EVENTS,
  REGISTRY_KEYS,
  type CollectedPayload,
  type DashStatePayload,
  type ExitClosedPayload,
  type ReducedMotionPayload,
  type SnackBoostPayload,
  type SteerPayload,
} from '../logic/gameEvents';
import {
  HUD,
  bannerBox,
  controlKeepOuts,
  hudControls,
  placeHudOverlays,
  screenWaterRows,
  type HudControlSizes,
  type HudControls,
  type HudOverlayId,
  type HudOverlayRequest,
  type HudView,
  type Rect,
  type ScreenWaterRows,
  type Size,
} from '../logic/hudLayout';
import type { LegStatus } from '../logic/legs';
import { motionProfile, type MotionProfile } from '../logic/motion';
import { stickSteer } from '../logic/stick';
import { idleTripSnapshot } from '../logic/trip';
import {
  TRIP_EVENTS,
  TRIP_REGISTRY_KEYS,
  type LegSlotSnapshot,
  type RescueSnapshot,
  type TripSnapshot,
} from '../logic/tripEvents';
import {
  ALL_SNACKS_BANNER,
  BANKING_HINT,
  GHOST_NET_BANNER,
  GO_HOME_LABEL,
  LEGS_LABEL,
  PLASTIC_WORM_BANNER,
  TRIP_BAG_LABEL,
  tripBagStatus,
} from '../logic/tripText';
import { LEGS } from '../logic/tuning';
import { add, clampLen } from '../logic/vec';
import { SURF, WORLD_H, type ZoneLayout } from '../logic/zone';
import { BankingCard } from './BankingCard';
import {
  SCENE_KEYS,
  createButton,
  cssColor,
  drawPanel,
  readSceneView,
  uiTextStyle,
  useCssCamera,
  zoneFor,
  type GameAssets,
  type SceneView,
  type SwimStart,
  type UiButton,
} from './BootScene';
import { FactCard } from './FactCard';
import { FindPopup } from './FindPopup';
import { addMotionTween, settleMotionTweens } from './motionTweens';
import { createMusicSwitch, toggleMusic } from './musicSwitch';

const MARGIN = 16;
const GAP = 12;
const PANEL_PAD = 12;
const COUNTER_ICON_PX = 32;
const COUNTER_TEXT_PX = 22;
const PAUSE_BUTTON_SIZE = 0.8;
const DASH_BUTTON_SIZE = 1.25;
const RESUME_BUTTON_SIZE = 1.3;
const RING_TRACK_PX = 9;
const RING_ARC_PX = 6;
const NOT_READY_ALPHA = 0.6;
const OVERLAY_ALPHA = 0.45;
const OVERLAY_COVER = 8192;
const OVERLAY_PAD = 24;
const OVERLAY_TITLE_PX = 34;
const BANNER_MS = 3000;
const BANNER_FADE_MS = 250;
const STICK_IDLE_ALPHA = 0.8;
const STICK_ACTIVE_ALPHA = 1;
const STICK_RECENTER_MS = 90;
const STEER_EPSILON = 0.01;
const LEGS_ICON_PX = 32;
const LEGS_ICON_GAP = 4;
const LEGS_TEXT_PX = 22;
const LEG_DISPLAY_RANK: Readonly<Record<LegStatus, number>> = { present: 0, regrowing: 1, lost: 2 };
const BOOST_BADGE_PX = 16;
const BOOST_HOLD_MS = 1200;
const BOOST_FADE_MS = 400;
const BAG_ICON_PX = 32;
const BAG_TEXT_PX = 22;
const BAG_STATUS_PX = 18;
const BAG_GAP = 6;
const HINT_HOLD_MS = 6000;
const HINT_FADE_MS = 400;
// INVARIANT: the find toast sits above the banners and below the banking card.
const FIND_POPUP_DEPTH = DEPTH.ui + 6;
const BANKING_CARD_DEPTH = DEPTH.ui + 8;
const FACT_CARD_DEPTH = DEPTH.ui + 9;
const OVERLAY_DEPTH = DEPTH.ui + 10;
// INVARIANT: the capture zone sits below every HUD button in depth so Pause, Dash and the pause overlay win the press.
const STICK_ZONE_DEPTH = DEPTH.ui - 1;
/** Tall areas: a move of the water band on screen, in CSS px, that re-places the overlays at once. */
const OVERLAY_REPLACE_PX = 8;
/** Tall areas: after a smaller move of the water band, the overlays are re-placed once this many ms have passed since the last placing. */
const OVERLAY_SETTLE_MS = 100;

/**
 * Event names the HUD sends to the swim scene. Values never repeat a `GAME_EVENTS` or
 * `TRIP_EVENTS` value.
 */
export const HUD_EVENTS = Object.freeze({
  /** The player closed a fact card; payload FactCardSeenPayload. */
  FACT_CARD_SEEN: 'fact-card-seen',
} as const);

/** Payload of HUD_EVENTS.FACT_CARD_SEEN: the id of the fact card closed. */
export interface FactCardSeenPayload {
  id: string;
}

/** One legs-display icon: dashed outline, present fill (cropped bottom-up while regrowing) and the regrow sparkle. */
interface LegIconView {
  outline: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Image;
}

/** Trip display state for a swimming, whole axolotl, used until the swim scene publishes one. */
function createSwimmingTrip(): TripSnapshot {
  return idleTripSnapshot();
}

/** Returns the widest width `text` takes for any of `values`, leaving `text` showing the last one. */
function widestText(text: Phaser.GameObjects.Text, values: readonly string[]): number {
  let widest = 0;
  for (const value of values) {
    widest = Math.max(widest, text.setText(value).width);
  }
  return widest;
}

/** A pink banner panel size and the text wrap width and text size that produced it. */
interface WrappedBox {
  size: Size;
  wrapW: number;
  textPx: number;
}

/** Sets `text` to `textPx` and to wrap at `wrapW`, and returns its size. */
function measureWrapped(text: Phaser.GameObjects.Text, wrapW: number, textPx: number): Size {
  text.setFontSize(textPx);
  text.setWordWrapWidth(wrapW, true);
  return { w: text.width, h: text.height };
}

/**
 * Returns the bannerBox() size of `text` at `textPx` for `maxW` and records it in `boxes` with its
 * wrap width and text size.
 */
function measureBanner(text: Phaser.GameObjects.Text, maxW: number, textPx: number, boxes: WrappedBox[]): Size {
  let wrapW: number = HUD.bannerMinWrap;
  const textAt = (atW: number): Size => {
    wrapW = atW;
    return measureWrapped(text, atW, textPx);
  };
  const size = bannerBox(maxW, textAt);
  boxes.push({ size, wrapW, textPx });
  return size;
}

/**
 * Overlay request for the pink banner `id` showing `text`, measured at HUD.bannerTextPx with a retry
 * at HUD.bannerRetryTextPx; every size it measures lands in `boxes`.
 */
function bannerRequest(id: HudOverlayId, text: Phaser.GameObjects.Text, boxes: WrappedBox[]): HudOverlayRequest {
  return {
    id,
    boxAt: (maxW) => measureBanner(text, maxW, HUD.bannerTextPx, boxes),
    retryBoxAt: (maxW) => measureBanner(text, maxW, HUD.bannerRetryTextPx, boxes),
  };
}

/**
 * Shows a pink banner with its panel drawn to `rect` and its text centred inside, at `textPx` and
 * wrapped as it was when measured at that size; hides it when `rect` is null. Throws when `rect` and
 * `textPx` are not a size and text size in `boxes`.
 */
function placeTopBanner(
  container: Phaser.GameObjects.Container,
  panel: Phaser.GameObjects.Graphics,
  text: Phaser.GameObjects.Text,
  rect: Rect | null,
  textPx: number | null,
  boxes: readonly WrappedBox[],
): void {
  if (rect === null) {
    container.setVisible(false);
    return;
  }
  const match = boxes.find((box) => box.textPx === textPx && box.size.w === rect.w && box.size.h === rect.h);
  if (match === undefined) throw new Error('placeTopBanner: rect is not a measured banner size');
  measureWrapped(text, match.wrapW, match.textPx);
  drawPanel(panel, rect.x, rect.y, rect.w, rect.h, UI_PANEL_PINK);
  text.setPosition(rect.x + (rect.w - text.width) / 2, rect.y + HUD.bannerPad);
  container.setVisible(true);
}

/**
 * Pauses `timer` (TimerEvent.paused) while its overlay is held for want of room. Separate from the
 * HUD clock pause (Clock.paused), so either one alone stops the timer.
 */
function holdTimer(timer: Phaser.Time.TimerEvent | null, held: boolean): void {
  if (timer) timer.paused = held;
}

/**
 * Whether the overlays placed for the water band `placed` (null when none were placed yet) need
 * placing again for the band `now` on a canvas `cssH` tall, `ageMs` after they were placed: never
 * when the band has not moved; else when either edge moved by OVERLAY_REPLACE_PX or more, when an
 * edge reached or left the canvas edge it is clamped to, or once OVERLAY_SETTLE_MS have passed.
 */
function waterBandMoved(placed: ScreenWaterRows | null, now: ScreenWaterRows, cssH: number, ageMs: number): boolean {
  if (placed === null) return true;
  const shift = Math.max(Math.abs(now.top - placed.top), Math.abs(now.bottom - placed.bottom));
  if (shift === 0) return false;
  const clampChanged = (now.top <= 0) !== (placed.top <= 0) || (now.bottom >= cssH) !== (placed.bottom >= cssH);
  return shift >= OVERLAY_REPLACE_PX || clampChanged || ageMs >= OVERLAY_SETTLE_MS;
}

/**
 * Screen-space UI over the swim scene: snack counter, legs display, Trip Bag display, Pause, Dash,
 * the contextual Go home button, swim pad, pause overlay, the snack and first-trip hint
 * banners, the find pop-up and the banking card. When the trip ends the swim scene stops this
 * scene and opens the Home Tank, which shows the tank arrival card.
 */
export class HudScene extends Phaser.Scene {
  private assets!: GameAssets;
  /** The zone of the area being swum, from the swim start. */
  private zone!: ZoneLayout;
  private view!: SceneView;
  /** Tall areas: the water band on screen when the overlays were last placed; null until placed. */
  private overlayWaterRows: ScreenWaterRows | null = null;
  /** Tall areas: ms since the overlays were last placed. */
  private overlayAgeMs = 0;
  private motion!: MotionProfile;
  private paused = false;
  private collected = 0;
  private total = 0;
  private dashState: DashStatePayload = { phase: 'ready', charge: 1 };

  private counterPanel!: Phaser.GameObjects.Graphics;
  private counterIcon!: Phaser.GameObjects.Image;
  private counterText!: Phaser.GameObjects.Text;
  private pauseButton!: UiButton;
  private dashButton!: UiButton;
  private dashRing!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Container;
  private overlayPanel!: Phaser.GameObjects.Graphics;
  private overlayTitle!: Phaser.GameObjects.Text;
  private resumeButton!: UiButton;
  /** The music switch on the pause overlay (PRD M8). */
  private musicButton!: UiButton;
  /** Whether the pause overlay's focus is on the music switch instead of Keep swimming. */
  private musicFocused = false;
  private banner!: Phaser.GameObjects.Container;
  private bannerPanel!: Phaser.GameObjects.Graphics;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerTimer: Phaser.Time.TimerEvent | null = null;
  /** Whether the snack banner is up, fading included, whether or not it has room. */
  private bannerActive = false;
  /** Whether placement found no room for the banner, so it is hidden and its timer paused. */
  private bannerHeld = false;
  private stickBase!: Phaser.GameObjects.Image;
  private stickKnob!: Phaser.GameObjects.Image;
  private stickZone!: Phaser.GameObjects.Zone;
  private controls!: HudControls;
  private stickPointer: Phaser.Input.Pointer | null = null;
  private stickDownTime = 0;
  private lastSteer: SteerPayload = { x: 0, y: 0 };
  private trip: TripSnapshot = createSwimmingTrip();
  private legsPanel!: Phaser.GameObjects.Graphics;
  private legsLabel!: Phaser.GameObjects.Text;
  private legIcons: LegIconView[] = [];
  /** Small snack icon at the corner of the leg icon a snack just helped (PRD A19). */
  private boostBadge!: Phaser.GameObjects.Image;
  private boostTimer: Phaser.Time.TimerEvent | null = null;
  /** Whether the speed-up badge is up, fading included. */
  private boostActive = false;
  /** Slot index of the leg the latest snack helped; the badge follows this slot's icon. */
  private boostLeg: number | null = null;
  private bagPanel!: Phaser.GameObjects.Graphics;
  private bagIcon!: Phaser.GameObjects.Image;
  private bagLabel!: Phaser.GameObjects.Text;
  private bagCount!: Phaser.GameObjects.Text;
  private bagStatus!: Phaser.GameObjects.Text;
  /** Width of the Trip Bag count slot, sized for its widest value. */
  private bagCountW = 0;
  private goHomeButton!: UiButton;
  private hint!: Phaser.GameObjects.Container;
  private hintPanel!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  /** Whether the first-trip hint is up, fading included, whether or not it has room. */
  private hintActive = false;
  /** Whether placement found no room for the hint, so it is hidden and its timer paused. */
  private hintHeld = false;
  private bankingCard!: BankingCard;
  private foundPopup!: FindPopup;
  /** How many of the trip's finds the pop-up has been given. */
  private announcedCount = 0;
  private factCard!: FactCard;
  /** Ids of the fact cards shown this trip, so each shows at most once while still due. */
  private factCardsShown: string[] = [];

  constructor() {
    super(SCENE_KEYS.hud);
  }

  init(data: SwimStart): void {
    this.assets = data.assets;
    this.zone = zoneFor(data.assets, data.areaId);
    this.overlayWaterRows = null;
    this.overlayAgeMs = 0;
    this.paused = false;
    this.bannerTimer = null;
    this.bannerActive = false;
    this.bannerHeld = false;
    this.dashState = { phase: 'ready', charge: 1 };
    this.stickPointer = null;
    this.lastSteer = { x: 0, y: 0 };
    this.trip = createSwimmingTrip();
    this.boostTimer = null;
    this.boostActive = false;
    this.boostLeg = null;
    this.hintTimer = null;
    this.hintActive = false;
    this.hintHeld = false;
    this.announcedCount = 0;
    this.factCardsShown = [];
  }

  create(): void {
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    this.collected = Number(this.registry.get(REGISTRY_KEYS.collected) ?? 0);
    this.total = Number(this.registry.get(REGISTRY_KEYS.total) ?? 0);
    this.trip = (this.registry.get(TRIP_REGISTRY_KEYS.state) as TripSnapshot | undefined) ?? createSwimmingTrip();
    this.announcedCount = this.trip.found.length;
    useCssCamera(this.cameras.main, this.view.fit.dpr);

    this.buildCounter();
    this.buildLegs();
    this.buildTripBag();
    this.buildButtons();
    this.buildStick();
    this.buildOverlay();
    this.buildBanner();
    this.buildHint();
    this.foundPopup = new FindPopup(
      this,
      this.assets,
      this.view,
      FIND_POPUP_DEPTH,
      () => this.motion,
      () => this.layoutOverlays(),
    );
    this.bankingCard = new BankingCard(this, this.assets, this.view, BANKING_CARD_DEPTH);
    this.factCard = new FactCard(this, this.assets, this.view, FACT_CARD_DEPTH, () => this.closeFactCard());
    this.bindKeys();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    this.game.events.on(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    this.game.events.on(GAME_EVENTS.EXIT_CLOSED, this.handleExitClosed, this);
    this.game.events.on(GAME_EVENTS.PLASTIC_WORM_SPAT, this.handlePlasticWormSpat, this);
    this.game.events.on(GAME_EVENTS.GHOST_NET_SNAGGED, this.handleGhostNetSnagged, this);
    this.game.events.on(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
    this.game.events.on(GAME_EVENTS.REQUEST_PAUSE, this.pauseSwim, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.game.events.on(GAME_EVENTS.SNACK_BOOST, this.handleSnackBoost, this);
    this.game.events.on(TRIP_EVENTS.STATE, this.handleTripState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.layout();
    this.drawLegs();
    this.refreshControls();
    if (this.trip.phase === 'banked') this.showBankingCard();
    this.showHintOnce();
  }

  update(_time: number, deltaMs: number): void {
    this.updateStick();
    this.foundPopup.update(deltaMs);
    if (this.scrollsVertically()) this.followWaterBand(deltaMs);
  }

  // ---- view ----------------------------------------------------------------

  /** Whether the area is taller than one screen, so the swim camera may scroll vertically. */
  private scrollsVertically(): boolean {
    return this.zone.height > WORLD_H;
  }

  /** World y at the swim camera's top edge. */
  private swimCameraTop(): number {
    return this.scene.get(SCENE_KEYS.swim).cameras.main.worldView.y;
  }

  /** Tall areas: the water band on screen now, from where the swim camera shows the water. */
  private swimWaterRows(): ScreenWaterRows {
    const rows = { surf: SURF, bedTop: this.zone.bedTop };
    return screenWaterRows(this.view, rows, this.swimCameraTop(), this.view.fit.fitZoom);
  }

  /**
   * The view the HUD layout reads. A one-screen-tall area leaves `waterRows` unset (the canal's
   * rows); a taller area sets them from where the swim camera shows the water now.
   */
  private hudView(): HudView {
    if (!this.scrollsVertically()) return this.view;
    const { cssW, cssH } = this.view;
    return { cssW, cssH, waterRows: this.swimWaterRows() };
  }

  /**
   * Tall areas only: re-places the overlays as the swim camera scrolls the water band on screen.
   * Placing re-wraps the banner text and redraws the panels, so it is throttled rather than run on
   * every scrolled frame: at once when the band moved by OVERLAY_REPLACE_PX or more, or an edge
   * reached or left the canvas edge it is clamped to; after a smaller move, once OVERLAY_SETTLE_MS
   * have passed since the last placing, so the overlays settle on the exact band as scrolling slows.
   * A band that has not moved never re-places them.
   */
  private followWaterBand(deltaMs: number): void {
    this.overlayAgeMs += Math.max(0, deltaMs);
    if (waterBandMoved(this.overlayWaterRows, this.swimWaterRows(), this.view.cssH, this.overlayAgeMs)) {
      this.layoutOverlays();
    }
  }

  // ---- build ---------------------------------------------------------------

  private buildCounter(): void {
    const dpr = this.view.fit.dpr;
    const iconInfo = this.assets.baked.icons.snack;
    this.counterPanel = this.add.graphics().setDepth(DEPTH.ui);
    this.counterIcon = this.add
      .image(0, 0, iconKey('snack'))
      .setOrigin(0, 0)
      .setScale(COUNTER_ICON_PX / iconInfo.w / iconInfo.scale)
      .setDepth(DEPTH.ui);
    this.counterText = this.add.text(0, 0, '', uiTextStyle(COUNTER_TEXT_PX, dpr)).setDepth(DEPTH.ui);
  }

  /** Legs panel: label plus one outline, fill and sparkle image per leg slot, laid out by layoutLegs(). */
  private buildLegs(): void {
    const { legIcons, regrowMark } = this.assets.predator;
    this.legsPanel = this.add.graphics().setDepth(DEPTH.ui);
    this.legsLabel = this.add.text(0, 0, LEGS_LABEL, uiTextStyle(LEGS_TEXT_PX, this.view.fit.dpr)).setDepth(DEPTH.ui);
    this.legIcons = [];
    for (let i = 0; i < LEGS.count; i++) {
      this.legIcons.push({
        outline: this.addLegImage(legIcons.outline),
        fill: this.addLegImage(legIcons.present),
        mark: this.addLegImage(regrowMark),
      });
    }
    const snackInfo = this.assets.baked.icons.snack;
    this.boostBadge = this.add
      .image(0, 0, iconKey('snack'))
      .setOrigin(0, 0)
      .setScale(BOOST_BADGE_PX / snackInfo.w / snackInfo.scale)
      .setDepth(DEPTH.ui)
      .setVisible(false);
  }

  /** Adds a top-left anchored legs-display image at the LEGS_ICON_PX scale. */
  private addLegImage(info: TexInfo): Phaser.GameObjects.Image {
    return this.add
      .image(0, 0, info.key)
      .setOrigin(info.originNormX, info.originNormY)
      .setScale(LEGS_ICON_PX / LEG_ICON_SIZE / info.scale)
      .setDepth(DEPTH.ui);
  }

  /** Trip Bag panel: bag icon, label, count and status, laid out by layoutTripBag(). */
  private buildTripBag(): void {
    const dpr = this.view.fit.dpr;
    const iconInfo = this.assets.baked.icons.bag;
    this.bagPanel = this.add.graphics().setDepth(DEPTH.ui);
    this.bagIcon = this.add
      .image(0, 0, iconKey('bag'))
      .setOrigin(0, 0)
      .setScale(BAG_ICON_PX / iconInfo.w / iconInfo.scale)
      .setDepth(DEPTH.ui);
    this.bagLabel = this.add.text(0, 0, TRIP_BAG_LABEL, uiTextStyle(BAG_TEXT_PX, dpr)).setDepth(DEPTH.ui);
    this.bagCount = this.add.text(0, 0, '', uiTextStyle(BAG_TEXT_PX, dpr)).setDepth(DEPTH.ui);
    this.bagStatus = this.add.text(0, 0, '', uiTextStyle(BAG_STATUS_PX, dpr, false)).setDepth(DEPTH.ui);
  }

  private buildButtons(): void {
    const dpr = this.view.fit.dpr;
    this.pauseButton = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: PAUSE_BUTTON_SIZE,
      label: 'Pause',
      icon: 'pause',
      dpr,
      pressOnDown: false,
      onPress: () => this.pauseSwim(),
    });
    this.pauseButton.container.setDepth(DEPTH.ui);

    this.dashRing = this.add.graphics().setDepth(DEPTH.ui);
    this.dashButton = createButton(this, this.assets.baked, {
      fill: 'primary',
      shape: 'square',
      size: DASH_BUTTON_SIZE,
      label: 'Dash',
      icon: 'dash',
      dpr,
      pressOnDown: true,
      onPress: () => this.requestDash(),
    });
    this.dashButton.container.setDepth(DEPTH.ui);

    this.goHomeButton = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: 1,
      label: GO_HOME_LABEL,
      icon: 'home',
      dpr,
      pressOnDown: false,
      onPress: () => this.requestGoHome(),
    });
    this.goHomeButton.container.setDepth(DEPTH.ui).setVisible(false);
  }

  /** Swim pad: fixed base, moving knob and an invisible capture zone laid out by layoutStick(). */
  private buildStick(): void {
    const { base, knob } = this.assets.baked.stick;
    this.stickBase = this.add
      .image(0, 0, base.key)
      .setOrigin(base.originNormX, base.originNormY)
      .setAlpha(STICK_IDLE_ALPHA)
      .setDepth(DEPTH.ui);
    this.stickKnob = this.add
      .image(0, 0, knob.key)
      .setOrigin(knob.originNormX, knob.originNormY)
      .setAlpha(STICK_IDLE_ALPHA)
      .setDepth(DEPTH.ui);
    this.stickZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(STICK_ZONE_DEPTH).setInteractive();
    this.stickZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.captureStick, this);
  }

  /** Full-screen ink dim that swallows presses so nothing under a modal card reacts. */
  private addScreenDim(): Phaser.GameObjects.Rectangle {
    const ink = cssColor(INK);
    return this.add
      .rectangle(-OVERLAY_COVER / 2, -OVERLAY_COVER / 2, OVERLAY_COVER, OVERLAY_COVER, ink.color, OVERLAY_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
  }

  private buildOverlay(): void {
    const dpr = this.view.fit.dpr;
    const dim = this.addScreenDim();
    this.overlayPanel = this.add.graphics();
    this.overlayTitle = this.add.text(0, 0, 'Paused', uiTextStyle(OVERLAY_TITLE_PX, dpr));
    this.resumeButton = createButton(this, this.assets.baked, {
      fill: 'primary',
      shape: 'wide',
      size: RESUME_BUTTON_SIZE,
      label: 'Keep swimming',
      icon: 'play',
      dpr,
      pressOnDown: false,
      onPress: () => this.resumeSwim(),
    });
    this.musicButton = createMusicSwitch(this, this.assets.baked, dpr);
    this.refreshPauseFocus();
    this.overlay = this.add
      .container(0, 0, [dim, this.overlayPanel, this.overlayTitle, this.resumeButton.container, this.musicButton.container])
      .setDepth(OVERLAY_DEPTH)
      .setVisible(false);
  }

  private buildBanner(): void {
    this.bannerPanel = this.add.graphics();
    this.bannerText = this.add.text(0, 0, ALL_SNACKS_BANNER, {
      ...uiTextStyle(HUD.bannerTextPx, this.view.fit.dpr),
      align: 'center',
    });
    this.banner = this.add
      .container(0, 0, [this.bannerPanel, this.bannerText])
      .setDepth(DEPTH.ui + 5)
      .setVisible(false);
  }

  /** First-trip hint banner: pink panel and the banking hint, placed with the other overlays by layoutOverlays(). */
  private buildHint(): void {
    this.hintPanel = this.add.graphics();
    this.hintText = this.add.text(0, 0, BANKING_HINT, {
      ...uiTextStyle(HUD.bannerTextPx, this.view.fit.dpr),
      align: 'center',
    });
    this.hint = this.add
      .container(0, 0, [this.hintPanel, this.hintText])
      .setDepth(DEPTH.ui + 5)
      .setVisible(false);
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-P', this.togglePause, this);
    keyboard.on('keydown-ESC', this.togglePause, this);
    keyboard.on('keydown-ENTER', this.handleConfirmKey, this);
    keyboard.on('keydown-SPACE', this.handleConfirmKey, this);
    keyboard.on('keydown-LEFT', this.handleFocusKey, this);
    keyboard.on('keydown-RIGHT', this.handleFocusKey, this);
    keyboard.on('keydown-TAB', this.handleFocusKey, this);
    keyboard.on('keydown-H', this.handleGoHomeKey, this);
  }

  // ---- layout --------------------------------------------------------------

  // INVARIANT: every HUD control is positioned from hudControls() and every HUD overlay from placeHudOverlays().
  private layout(): void {
    this.layoutControls();
    this.layoutOverlay();
    this.bankingCard.layout(this.view);
    this.factCard.layout(this.view);
    this.layoutOverlays();
  }

  /** Measures the status panels and buttons, lays them out through hudControls() and positions every control. */
  private layoutControls(): void {
    this.controls = hudControls(this.hudView(), this.measureControls());
    this.placeCounter(this.controls.counter);
    this.placeLegs(this.controls.legs);
    this.placeTripBag(this.controls.bag);
    this.placeButtons();
    this.layoutStick();
    this.drawDashRing();
  }

  /** Measured sizes of the status panels and buttons, for hudControls(). */
  private measureControls(): HudControlSizes {
    return {
      pause: { w: this.pauseButton.width, h: this.pauseButton.height },
      goHome: { w: this.goHomeButton.width, h: this.goHomeButton.height },
      dash: { w: this.dashButton.width, h: this.dashButton.height },
      dashCornerR: buttonRadius(BUTTON_SQUARE.h) * DASH_BUTTON_SIZE,
      counter: this.measureCounter(),
      legs: this.measureLegs(),
      bag: this.measureTripBag(),
    };
  }

  private counterLabel(): string {
    return snacksLeftLabel(this.total - this.collected);
  }

  /** Sets the snack counter text and returns the counter panel size. */
  private measureCounter(): Size {
    this.counterText.setText(this.counterLabel());
    const contentH = Math.max(COUNTER_ICON_PX, this.counterText.height);
    return {
      w: PANEL_PAD + COUNTER_ICON_PX + GAP / 2 + this.counterText.width + PANEL_PAD,
      h: contentH + 2 * PANEL_PAD,
    };
  }

  /** Draws the snack counter panel at `rect`: icon, then the count. */
  private placeCounter(rect: Rect): void {
    const contentH = rect.h - 2 * PANEL_PAD;
    drawPanel(this.counterPanel, rect.x, rect.y, rect.w, rect.h, UI_PANEL);
    this.counterIcon.setPosition(rect.x + PANEL_PAD, rect.y + PANEL_PAD + (contentH - COUNTER_ICON_PX) / 2);
    this.counterText.setPosition(
      rect.x + PANEL_PAD + COUNTER_ICON_PX + GAP / 2,
      rect.y + PANEL_PAD + (contentH - this.counterText.height) / 2,
    );
  }

  /** Returns the legs panel size: label, then the icons. */
  private measureLegs(): Size {
    const label = this.legsLabel;
    const contentH = Math.max(LEGS_ICON_PX, label.height);
    const iconsW = LEGS.count * LEGS_ICON_PX + (LEGS.count - 1) * LEGS_ICON_GAP;
    return { w: PANEL_PAD + label.width + GAP / 2 + iconsW + PANEL_PAD, h: contentH + 2 * PANEL_PAD };
  }

  /** Draws the legs panel at `rect`: label, then the icons in display order. */
  private placeLegs(rect: Rect): void {
    const label = this.legsLabel;
    const contentH = rect.h - 2 * PANEL_PAD;
    drawPanel(this.legsPanel, rect.x, rect.y, rect.w, rect.h, UI_PANEL);
    label.setPosition(rect.x + PANEL_PAD, rect.y + PANEL_PAD + (contentH - label.height) / 2);
    const iconsX = rect.x + PANEL_PAD + label.width + GAP / 2;
    const iconY = rect.y + PANEL_PAD + (contentH - LEGS_ICON_PX) / 2;
    this.legIcons.forEach((icon, index) => {
      const iconX = iconsX + index * (LEGS_ICON_PX + LEGS_ICON_GAP);
      icon.outline.setPosition(iconX, iconY);
      icon.fill.setPosition(iconX, iconY);
      icon.mark.setPosition(iconX + LEGS_ICON_PX - icon.mark.displayWidth, iconY);
    });
    this.placeBoostBadge();
  }

  /**
   * Shows the speed-up badge at the bottom-right of the icon of the leg the latest snack helped,
   * found by its slot in display order, only while a boost is up and the trip is swimming. A leg a
   * snack finishes keeps the badge on its now-present icon, not on the next leg it starts. Hides it otherwise.
   */
  private placeBoostBadge(): void {
    const icon = this.boostLeg === null ? undefined : this.legIcons[this.legDisplayOrder().indexOf(this.boostLeg)];
    if (!this.boostActive || this.trip.phase !== 'swimming' || icon === undefined) {
      this.boostBadge.setVisible(false);
      return;
    }
    this.boostBadge
      .setPosition(icon.outline.x + LEGS_ICON_PX - BOOST_BADGE_PX, icon.outline.y + LEGS_ICON_PX - BOOST_BADGE_PX)
      .setVisible(true);
  }

  /**
   * Returns the Trip Bag panel size: icon, label, count, status. The count and status slots are
   * sized for their widest values (every find plus a following axolotl), so the panel never changes
   * width as the bag fills.
   */
  private measureTripBag(): Size {
    this.bagCountW = widestText(
      this.bagCount,
      Array.from({ length: this.zone.finds.length + 2 }, (_, count) => String(count)),
    );
    const statusW = widestText(this.bagStatus, [tripBagStatus(0), tripBagStatus(1)]);
    this.drawTripBag();
    const contentH = Math.max(BAG_ICON_PX, this.bagLabel.height, this.bagCount.height, this.bagStatus.height);
    const contentW = BAG_ICON_PX + BAG_GAP + this.bagLabel.width + BAG_GAP + this.bagCountW + BAG_GAP + statusW;
    return { w: PANEL_PAD + contentW + PANEL_PAD, h: contentH + 2 * PANEL_PAD };
  }

  /** Draws the Trip Bag panel at `rect`: icon, label, count, status. */
  private placeTripBag(rect: Rect): void {
    const labelX = rect.x + PANEL_PAD + BAG_ICON_PX + BAG_GAP;
    const countX = labelX + this.bagLabel.width + BAG_GAP;
    const statusX = countX + this.bagCountW + BAG_GAP;
    drawPanel(this.bagPanel, rect.x, rect.y, rect.w, rect.h, UI_PANEL);
    const middleY = rect.y + rect.h / 2;
    this.bagIcon.setPosition(rect.x + PANEL_PAD, middleY - BAG_ICON_PX / 2);
    this.bagLabel.setPosition(labelX, middleY - this.bagLabel.height / 2);
    this.bagCount.setPosition(countX, middleY - this.bagCount.height / 2);
    this.bagStatus.setPosition(statusX, middleY - this.bagStatus.height / 2);
  }

  /** Shows the Trip Bag count and status for the current snapshot. */
  private drawTripBag(): void {
    const count = this.trip.bag.length;
    this.bagCount.setText(String(count));
    this.bagStatus.setText(tripBagStatus(count));
  }

  /** Positions Pause, Dash and Go home from the control layout. */
  private placeButtons(): void {
    const { pause, dash, goHome } = this.controls;
    this.pauseButton.container.setPosition(pause.x, pause.y);
    this.dashButton.container.setPosition(dash.button.x, dash.button.y);
    this.goHomeButton.container.setPosition(goHome.x, goHome.y);
  }

  /** Places the swim pad from the control layout. Keeps any capture. */
  private layoutStick(): void {
    const { centre, baseR, knobR, zone } = this.controls.stick;
    const { base, knob } = this.assets.baked.stick;
    this.stickBase.setPosition(centre.x, centre.y).setScale(baseR / STICK_BASE_R / base.scale);
    this.stickKnob.setScale(knobR / STICK_KNOB_R / knob.scale);
    this.tweens.killTweensOf(this.stickKnob);
    this.stickKnob.setPosition(centre.x, centre.y);
    this.stickZone.setPosition(zone.x, zone.y).setSize(zone.w, zone.h);
    if (this.stickPointer) this.updateStick();
  }

  /** The pause overlay: the Paused title, Keep swimming under it, and the music switch under that (PRD M8). */
  private layoutOverlay(): void {
    const { cssW, cssH } = this.view;
    const button = this.resumeButton;
    const music = this.musicButton;
    const contentW = Math.max(button.width, music.width, this.overlayTitle.width);
    const panelW = Math.min(cssW - 2 * MARGIN, contentW + 2 * OVERLAY_PAD);
    const panelH = this.overlayTitle.height + button.height + GAP + music.height + 3 * OVERLAY_PAD;
    const panelX = (cssW - panelW) / 2;
    const panelY = (cssH - panelH) / 2;
    drawPanel(this.overlayPanel, panelX, panelY, panelW, panelH, UI_PANEL);
    this.overlayTitle.setPosition((cssW - this.overlayTitle.width) / 2, panelY + OVERLAY_PAD);
    const buttonY = panelY + 2 * OVERLAY_PAD + this.overlayTitle.height;
    button.container.setPosition((cssW - button.width) / 2, buttonY);
    music.container.setPosition((cssW - music.width) / 2, buttonY + button.height + GAP);
  }

  /** Shows the pause overlay's focus ring on Keep swimming or the music switch. */
  private refreshPauseFocus(): void {
    this.resumeButton.setFocused(!this.musicFocused);
    this.musicButton.setFocused(this.musicFocused);
  }

  /**
   * Places the active overlays through placeHudOverlays(), clear of the visible controls: the hint
   * while active, the snack banner while active and the find toast while it has a find. An
   * overlay with no room is held: hidden, with its timer (the toast's clock) paused, until a later
   * call places it.
   */
  private layoutOverlays(): void {
    const hintBoxes: WrappedBox[] = [];
    const bannerBoxes: WrappedBox[] = [];
    const requests: HudOverlayRequest[] = [];
    if (this.hintActive) requests.push(bannerRequest('hint', this.hintText, hintBoxes));
    if (this.bannerActive) requests.push(bannerRequest('snackBanner', this.bannerText, bannerBoxes));
    if (this.foundPopup.hasFind()) requests.push({ id: 'findToast', boxAt: (maxW) => this.foundPopup.box(maxW) });
    const keepOuts = controlKeepOuts(this.controls, { goHomeVisible: this.goHomeButton.container.visible });
    const view = this.hudView();
    if (view.waterRows !== undefined) {
      this.overlayWaterRows = view.waterRows;
      this.overlayAgeMs = 0;
    }
    for (const { id, rect, textPx } of placeHudOverlays(view, this.controls, keepOuts, requests)) {
      this.placeOverlay(id, rect, textPx, id === 'hint' ? hintBoxes : bannerBoxes);
    }
  }

  /**
   * Draws overlay `id` at `rect`, or holds it when `rect` is null; `textPx` is the text size the
   * solver placed a banner at and `boxes` are a banner's measured sizes.
   */
  private placeOverlay(id: HudOverlayId, rect: Rect | null, textPx: number | null, boxes: readonly WrappedBox[]): void {
    if (id === 'findToast') {
      this.foundPopup.place(rect);
      return;
    }
    if (id === 'hint') {
      this.hintHeld = rect === null;
      placeTopBanner(this.hint, this.hintPanel, this.hintText, rect, textPx, boxes);
      holdTimer(this.hintTimer, this.hintHeld);
      return;
    }
    this.bannerHeld = rect === null;
    placeTopBanner(this.banner, this.bannerPanel, this.bannerText, rect, textPx, boxes);
    holdTimer(this.bannerTimer, this.bannerHeld);
  }

  /** Shows each leg icon for the current snapshot, sorted present, regrowing, lost. */
  private drawLegs(): void {
    const slots = this.trip.legs.slots;
    const order = this.legDisplayOrder();
    this.legIcons.forEach((icon, index) => this.drawLegIcon(icon, slots[order[index]]));
    this.placeBoostBadge();
  }

  /** Slot indices in leg-icon order: present, regrowing, lost. The sort is stable, so slot order holds within a status. */
  private legDisplayOrder(): number[] {
    const slots = this.trip.legs.slots;
    return slots
      .map((_, index) => index)
      .sort((a, b) => LEG_DISPLAY_RANK[slots[a].status] - LEG_DISPLAY_RANK[slots[b].status]);
  }

  /**
   * Present: solid fill. Lost: dashed outline. Regrowing: outline, fill cropped to the bottom
   * `progress` fraction, and the sparkle (composition per src/art/drawLegIcons.ts).
   */
  private drawLegIcon(icon: LegIconView, slot: LegSlotSnapshot | undefined): void {
    const status = slot?.status;
    const regrowing = status === 'regrowing';
    icon.outline.setVisible(status === 'lost' || regrowing);
    icon.mark.setVisible(regrowing);
    icon.fill.setVisible(status === 'present' || regrowing);
    if (!regrowing) {
      icon.fill.setCrop();
      return;
    }
    const progress = Phaser.Math.Clamp(slot?.progress ?? 0, 0, 1);
    const frameW = icon.fill.frame.width;
    const frameH = icon.fill.frame.height;
    const cropTop = frameH * (1 - progress);
    icon.fill.setCrop(0, cropTop, frameW, frameH - cropTop);
  }

  private drawDashRing(): void {
    const ring = this.dashRing;
    const button = this.dashButton;
    const { x: centreX, y: centreY } = this.controls.dash.centre;
    const radius = this.controls.dash.ringR;
    const ready = this.dashState.phase === 'ready';
    const start = -Math.PI / 2;
    ring.clear();
    ring.lineStyle(RING_TRACK_PX, cssColor(WHITE).color, 0.85);
    ring.strokeCircle(centreX, centreY, radius);
    ring.lineStyle(RING_ARC_PX, cssColor(INK).color, 1);
    if (ready) {
      ring.strokeCircle(centreX, centreY, radius);
    } else if (this.dashState.charge > 0) {
      ring.beginPath();
      ring.arc(centreX, centreY, radius, start, start + Math.PI * 2 * this.dashState.charge, false);
      ring.strokePath();
    }
    button.container.setAlpha(ready ? 1 : NOT_READY_ALPHA);
  }

  // ---- actions -------------------------------------------------------------

  private requestDash(): void {
    if (this.paused || this.trip.phase !== 'swimming') return;
    this.game.events.emit(GAME_EVENTS.REQUEST_DASH);
  }

  /** Asks the swim scene to end the trip, only while swimming inside the Home Spot ring and not paused. */
  private requestGoHome(): void {
    if (this.paused || this.trip.phase !== 'swimming' || !this.trip.inHomeSpot) return;
    this.game.events.emit(TRIP_EVENTS.REQUEST_GO_HOME);
  }

  /**
   * Shows Pause unless paused, a banking card is up or the trip has ended, and Go home only while
   * swimming inside the Home Spot ring and not paused. Places the overlays again when Go home
   * shows or hides, since it is a keep-out only while visible.
   */
  private refreshControls(): void {
    const phase = this.trip.phase;
    const modal = phase === 'banked' || phase === 'ended';
    const goHomeWasVisible = this.goHomeButton.container.visible;
    const goHomeVisible = !this.paused && phase === 'swimming' && this.trip.inHomeSpot;
    this.pauseButton.container.setVisible(!this.paused && !modal);
    this.goHomeButton.container.setVisible(goHomeVisible);
    if (goHomeVisible !== goHomeWasVisible) this.layoutOverlays();
  }

  /** P or Esc: closes the fact card when it is up (ignoring key repeat), otherwise toggles Pause. */
  private togglePause(event: KeyboardEvent): void {
    if (this.pressFactCardKey(event)) return;
    if (this.paused) {
      this.resumeSwim();
      return;
    }
    this.pauseSwim();
  }

  private captureStick(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.trip.phase !== 'swimming' || this.stickPointer) return;
    this.stickPointer = pointer;
    this.stickDownTime = pointer.downTime;
    this.tweens.killTweensOf(this.stickKnob);
    this.stickBase.setAlpha(STICK_ACTIVE_ALPHA);
    this.stickKnob.setAlpha(STICK_ACTIVE_ALPHA);
    this.updateStick();
  }

  /** Moves the knob toward the captured pointer and emits the steer it implies; releases once the press ends. */
  private updateStick(): void {
    const pointer = this.stickPointer;
    if (!pointer) return;
    if (!pointer.isDown || pointer.downTime !== this.stickDownTime) {
      this.releaseStick();
      return;
    }
    const { centre, travel } = this.controls.stick;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const offset = { x: point.x - centre.x, y: point.y - centre.y };
    const knobAt = add(centre, clampLen(offset, travel));
    this.stickKnob.setPosition(knobAt.x, knobAt.y);
    this.emitSteer(stickSteer(offset, travel));
  }

  /** Drops any capture, sends a zero steer and recentres the knob, eased only when `animate` is set. */
  private releaseStick(animate: boolean = this.motion.ambient): void {
    this.stickPointer = null;
    this.emitSteer({ x: 0, y: 0 });
    this.stickBase.setAlpha(STICK_IDLE_ALPHA);
    this.stickKnob.setAlpha(STICK_IDLE_ALPHA);
    this.tweens.killTweensOf(this.stickKnob);
    const { centre } = this.controls.stick;
    if (!animate) {
      this.stickKnob.setPosition(centre.x, centre.y);
      return;
    }
    addMotionTween(this, {
      targets: this.stickKnob,
      props: { x: centre.x, y: centre.y },
      duration: STICK_RECENTER_MS,
      ease: 'Sine.easeOut',
    });
  }

  /** Emits GAME_EVENTS.STEER only when the steer differs from the last one sent. */
  private emitSteer(steer: SteerPayload): void {
    const last = this.lastSteer;
    if (Math.abs(steer.x - last.x) < STEER_EPSILON && Math.abs(steer.y - last.y) < STEER_EPSILON) {
      const settledToZero = steer.x === 0 && steer.y === 0 && (last.x !== 0 || last.y !== 0);
      if (!settledToZero) return;
    }
    this.lastSteer = { x: steer.x, y: steer.y };
    this.game.events.emit(GAME_EVENTS.STEER, this.lastSteer);
  }

  private pauseSwim(): void {
    if (this.paused || this.trip.phase === 'ended') return;
    this.holdSwim();
    this.musicFocused = false;
    this.refreshPauseFocus();
    // Tab moves the focus between Keep swimming and the music switch, not out of the game.
    this.input.keyboard?.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.overlay.setVisible(true);
    this.game.events.emit(GAME_EVENTS.PAUSED);
  }

  /** Pauses play under a HUD card: drops the swim pad, freezes the HUD clock and the swim scene, hides Pause. */
  private holdSwim(): void {
    this.paused = true;
    this.releaseStick(false);
    this.setHudClockPaused(true);
    this.scene.pause(SCENE_KEYS.swim);
    this.refreshControls();
  }

  /**
   * Shows the fact card the snapshot says is due with play paused, as Pause does but with the card
   * in place of the pause overlay: once per id per trip, while swimming and not already paused.
   */
  private showFactCardWhenDue(snapshot: TripSnapshot): void {
    const dueId = snapshot.factCardDue;
    if (dueId === null || this.factCardsShown.includes(dueId) || this.paused || snapshot.phase !== 'swimming') return;
    const card = this.zoneFactCard(dueId);
    this.factCardsShown.push(dueId);
    this.holdSwim();
    this.factCard.show(card);
    this.game.events.emit(GAME_EVENTS.PAUSED);
  }

  /** The fact card of hazard, predator or element `id` in this zone. Throws when the zone has no such card. */
  private zoneFactCard(id: string): Readonly<FactCardData> {
    const { ids, cards } = sourceFactCards(this.zone);
    const index = ids.indexOf(id);
    if (index < 0) throw new Error(`HudScene: no hazard, predator or element ${id} in the zone`);
    return cards[index];
  }

  /** After OK on the fact card: tells the swim scene that card was seen, then resumes play. */
  private closeFactCard(): void {
    const shownId = this.factCardsShown[this.factCardsShown.length - 1];
    if (shownId === undefined) throw new Error('HudScene: a fact card closed before any was shown');
    const payload: FactCardSeenPayload = { id: shownId };
    this.game.events.emit(HUD_EVENTS.FACT_CARD_SEEN, payload);
    this.resumeSwim();
  }

  /** Presses OK on the fact card for a key that is not a repeat. Returns whether the card is up. */
  private pressFactCardKey(event: KeyboardEvent): boolean {
    if (!this.factCard.isShowing()) return false;
    if (!event.repeat) this.factCard.press();
    return true;
  }

  private resumeSwim(): void {
    if (!this.paused) return;
    this.paused = false;
    this.musicFocused = false;
    if (this.overlay.visible && this.trip.phase !== 'banked') {
      this.input.keyboard?.removeCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    }
    this.overlay.setVisible(false);
    this.refreshControls();
    this.setHudClockPaused(false);
    this.scene.resume(SCENE_KEYS.swim);
    this.game.events.emit(GAME_EVENTS.RESUMED);
  }

  /**
   * Hands back a pause this HUD made when the HUD goes away, so a new HUD never shows live
   * controls over a frozen swim scene. Resumes now (not queued) and only a swim scene that is
   * still paused, so a swim scene that has stopped is never woken.
   */
  private releaseSwimPause(): void {
    if (!this.paused) return;
    this.paused = false;
    const scenes = this.game.scene;
    if (!scenes.isPaused(SCENE_KEYS.swim)) return;
    scenes.resume(SCENE_KEYS.swim);
    this.game.events.emit(GAME_EVENTS.RESUMED);
  }

  /**
   * Freezes or thaws every HUD timer and tween (banners, banking card, swim pad and any added later)
   * and the find toast's own clock, so pause stops HUD motion as well as the swim scene. The pause
   * overlay and its buttons use neither. Only the scene clock (Clock.paused) changes: a timer an
   * overlay hold paused (TimerEvent.paused) stays paused until its overlay is placed again.
   */
  private setHudClockPaused(paused: boolean): void {
    this.time.paused = paused;
    this.foundPopup.setPaused(paused);
    if (paused) {
      this.tweens.pauseAll();
    } else {
      this.tweens.resumeAll();
    }
  }

  /**
   * Enter or Space: closes the fact card when it is up (ignoring key repeat); resumes when paused;
   * otherwise presses the focused banking card button, ignoring key repeat.
   */
  private handleConfirmKey(event: KeyboardEvent): void {
    if (this.pressFactCardKey(event)) return;
    if (this.paused) {
      if (!this.musicFocused) this.resumeSwim();
      else if (!event.repeat) toggleMusic(this.musicButton);
      return;
    }
    if (event.repeat) return;
    if (this.trip.phase === 'banked') this.bankingCard.pressFocused();
  }

  /**
   * Left, Right or Tab: moves the pause overlay's focus between Keep swimming and the music switch,
   * or the banking card focus to the other button, ignoring key repeat.
   */
  private handleFocusKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (this.paused && this.overlay.visible) {
      this.musicFocused = !this.musicFocused;
      this.refreshPauseFocus();
      return;
    }
    if (this.paused || this.trip.phase !== 'banked') return;
    this.bankingCard.moveFocus();
  }

  /** H: Go home from the banking card, or from the Home Spot while swimming. Ignores key repeat. */
  private handleGoHomeKey(event: KeyboardEvent): void {
    if (this.paused || event.repeat) return;
    if (this.trip.phase === 'banked') {
      this.bankingCard.pressGoHome();
      return;
    }
    this.requestGoHome();
  }

  // ---- game events ---------------------------------------------------------

  /** Updates the snack count; its width can move the controls and the overlays. */
  private handleCollected(payload: CollectedPayload): void {
    this.collected = payload.collected;
    this.total = payload.total;
    this.layoutControls();
    this.layoutOverlays();
  }

  /** Shows the all-snacks message in the snack banner. */
  private handleAllCollected(): void {
    this.showSnackBanner(ALL_SNACKS_BANNER);
  }

  /** Shows the closed-exit message, with the snacks still left, in the snack banner. */
  private handleExitClosed(payload: ExitClosedPayload): void {
    this.showSnackBanner(exitClosedText(payload.left));
  }

  /** Shows the "bleh" message in the snack banner when a plastic worm is spat out (issue #75). */
  private handlePlasticWormSpat(): void {
    this.showSnackBanner(PLASTIC_WORM_BANNER);
  }

  /** Shows the snag message in the snack banner when a ghost net snags the explorer (issue #76). */
  private handleGhostNetSnagged(): void {
    this.showSnackBanner(GHOST_NET_BANNER);
  }

  /**
   * Shows `text` in the snack banner, fading in unless motion is reduced, for BANNER_MS on the HUD
   * clock. A new message replaces the one up and restarts the timer.
   */
  private showSnackBanner(text: string): void {
    if (this.bannerTimer) this.time.removeEvent(this.bannerTimer);
    this.tweens.killTweensOf(this.banner);
    this.bannerText.setText(text);
    this.bannerActive = true;
    this.banner.setAlpha(this.motion.ambient ? 0 : 1);
    this.layoutOverlays();
    if (this.motion.ambient) {
      addMotionTween(this, { targets: this.banner, props: { alpha: 1 }, duration: BANNER_FADE_MS });
    }
    this.bannerTimer = this.time.delayedCall(BANNER_MS, this.hideBanner, [], this);
    holdTimer(this.bannerTimer, this.bannerHeld);
  }

  private hideBanner(): void {
    this.bannerTimer = null;
    if (!this.motion.ambient) {
      this.dropBanner();
      return;
    }
    addMotionTween(this, {
      targets: this.banner,
      props: { alpha: 0 },
      duration: BANNER_FADE_MS,
      onComplete: () => this.dropBanner(),
    });
  }

  /** Hides the snack banner and places the other overlays again. */
  private dropBanner(): void {
    this.bannerActive = false;
    this.bannerHeld = false;
    this.banner.setVisible(false);
    this.layoutOverlays();
  }

  /**
   * Shows the speed-up badge on the helped leg for BOOST_HOLD_MS on the HUD clock (so pause freezes
   * it), then fades it over BOOST_FADE_MS. A new boost restarts the hold. Leaves at once under reduced motion.
   * The helped leg is the last slot in `payload.legs`, the leg the latest snack eaten helped.
   */
  private handleSnackBoost(payload: SnackBoostPayload): void {
    if (this.boostTimer) this.time.removeEvent(this.boostTimer);
    this.tweens.killTweensOf(this.boostBadge);
    this.boostBadge.setAlpha(1);
    this.boostLeg = payload.legs[payload.legs.length - 1] ?? null;
    this.boostActive = true;
    this.placeBoostBadge();
    this.boostTimer = this.time.delayedCall(BOOST_HOLD_MS, this.fadeBoostBadge, [], this);
  }

  private fadeBoostBadge(): void {
    this.boostTimer = null;
    if (!this.motion.ambient) {
      this.dropBoostBadge();
      return;
    }
    addMotionTween(this, {
      targets: this.boostBadge,
      props: { alpha: 0 },
      duration: BOOST_FADE_MS,
      onComplete: () => this.dropBoostBadge(),
    });
  }

  /** Hides the speed-up badge at once. */
  private dropBoostBadge(): void {
    if (this.boostTimer) this.time.removeEvent(this.boostTimer);
    this.boostTimer = null;
    this.tweens.killTweensOf(this.boostBadge);
    this.boostActive = false;
    this.boostLeg = null;
    this.boostBadge.setVisible(false).setAlpha(1);
  }

  private handleDashState(payload: DashStatePayload): void {
    this.dashState = payload;
    this.drawDashRing();
  }

  /**
   * Redraws the legs and Trip Bag from the snapshot, announces new finds and a newly following
   * axolotl (the rescue wins when both come in one snapshot), shows the tilapia fact card when it
   * is due, and follows its phase: leaving 'swimming' drops the swim pad, the hint and the speed-up
   * badge, into 'banked' or 'ended' clears the find toast, into 'banked' shows the banking card,
   * and leaving 'banked' hides it.
   */
  private handleTripState(snapshot: TripSnapshot): void {
    const previousPhase = this.trip.phase;
    const previousRescue = this.trip.rescue;
    this.trip = snapshot;
    this.drawLegs();
    this.drawTripBag();
    this.refreshControls();
    this.announceToast(previousRescue, snapshot);
    this.showFactCardWhenDue(snapshot);
    if (snapshot.phase === previousPhase) return;
    if (previousPhase === 'banked') this.hideBankingCard();
    if (snapshot.phase !== 'swimming') {
      this.releaseStick();
      this.hideHint();
      this.dropBoostBadge();
    }
    if (snapshot.phase === 'banked' || snapshot.phase === 'ended') this.foundPopup.clear();
    if (snapshot.phase === 'banked') this.showBankingCard();
  }

  /**
   * Shows on the find toast what pickToastAnnouncement() picks for `snapshot`: a newly following
   * axolotl, else the latest find since the last snapshot, only while swimming.
   */
  private announceToast(previousRescue: RescueSnapshot | null, snapshot: TripSnapshot): void {
    const announcement = pickToastAnnouncement(this.announcedCount, previousRescue, snapshot);
    this.announcedCount = announcement.announcedCount;
    if (announcement.item !== null) this.foundPopup.show(announcement.item);
  }

  /** Shows the banking card and captures Tab so it moves focus between the card buttons. */
  private showBankingCard(): void {
    this.input.keyboard?.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.bankingCard.show(this.trip, this.motion);
  }

  private hideBankingCard(): void {
    this.input.keyboard?.removeCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.bankingCard.hide();
  }

  /**
   * Shows the banking hint once per session, at the start of the first trip: fades in, holds for
   * HINT_HOLD_MS on the HUD clock (so pause freezes it, as does a hold for want of room), then fades
   * out. Appears and leaves at once under reduced motion.
   */
  private showHintOnce(): void {
    if (this.registry.get(TRIP_REGISTRY_KEYS.bankingHintShown) === true || this.trip.phase !== 'swimming') return;
    this.registry.set(TRIP_REGISTRY_KEYS.bankingHintShown, true);
    this.hintActive = true;
    this.hint.setAlpha(this.motion.ambient ? 0 : 1);
    this.layoutOverlays();
    if (this.motion.ambient) {
      addMotionTween(this, { targets: this.hint, props: { alpha: 1 }, duration: HINT_FADE_MS });
    }
    this.hintTimer = this.time.delayedCall(HINT_FADE_MS + HINT_HOLD_MS, this.fadeOutHint, [], this);
    holdTimer(this.hintTimer, this.hintHeld);
  }

  private fadeOutHint(): void {
    this.hintTimer = null;
    if (!this.motion.ambient) {
      this.hideHint();
      return;
    }
    addMotionTween(this, {
      targets: this.hint,
      props: { alpha: 0 },
      duration: HINT_FADE_MS,
      onComplete: () => this.hideHint(),
    });
  }

  /** Hides the hint at once and places the other overlays again. */
  private hideHint(): void {
    if (this.hintTimer) this.time.removeEvent(this.hintTimer);
    this.hintTimer = null;
    if (!this.hintActive) return;
    this.hintActive = false;
    this.hintHeld = false;
    this.tweens.killTweensOf(this.hint);
    this.hint.setVisible(false).setAlpha(1);
    this.layoutOverlays();
  }

  /**
   * Switches the HUD motion profile. When reduced motion turns on, ends every running motion tween
   * in this scene at its end state: the banners, the hint, the banking card and the swim pad. The
   * find toast reads the profile on its next update() and settles there.
   */
  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
    if (!this.motion.ambient) settleMotionTweens(this);
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    const dpr = this.view.fit.dpr;
    useCssCamera(this.cameras.main, dpr);
    const texts = [
      this.counterText,
      this.legsLabel,
      this.bagLabel,
      this.bagCount,
      this.bagStatus,
      this.overlayTitle,
      this.bannerText,
      this.hintText,
    ];
    for (const text of texts) {
      text.setResolution(dpr);
    }
    for (const button of [this.pauseButton, this.dashButton, this.goHomeButton, this.resumeButton, this.musicButton]) {
      button.setResolution(dpr);
    }
    this.foundPopup.setResolution(dpr);
    this.bankingCard.setResolution(dpr);
    this.factCard.setResolution(dpr);
    this.layout();
  }

  private handleShutdown(): void {
    this.releaseStick(false);
    this.input.keyboard?.removeCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    // The scene clock keeps `paused` across a restart, so thaw it here.
    this.setHudClockPaused(false);
    this.releaseSwimPause();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.COLLECTED, this.handleCollected, this);
    this.game.events.off(GAME_EVENTS.ALL_COLLECTED, this.handleAllCollected, this);
    this.game.events.off(GAME_EVENTS.EXIT_CLOSED, this.handleExitClosed, this);
    this.game.events.off(GAME_EVENTS.PLASTIC_WORM_SPAT, this.handlePlasticWormSpat, this);
    this.game.events.off(GAME_EVENTS.GHOST_NET_SNAGGED, this.handleGhostNetSnagged, this);
    this.game.events.off(GAME_EVENTS.DASH_STATE, this.handleDashState, this);
    this.game.events.off(GAME_EVENTS.REQUEST_PAUSE, this.pauseSwim, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.game.events.off(GAME_EVENTS.SNACK_BOOST, this.handleSnackBoost, this);
    this.game.events.off(TRIP_EVENTS.STATE, this.handleTripState, this);
  }
}
