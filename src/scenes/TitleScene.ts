import * as Phaser from 'phaser';
import { createAxolotlRigView, type AxolotlRigView } from '../art/axolotlRig';
import { AXO_SCENE_SCALE, type AxolotlPose } from '../art/drawAxolotl';
import { NO_OUTFIT } from '../art/drawWearables';
import { DEPTH } from '../art/layers';
import { LEUCISTIC, T_STATIC, UI_PANEL } from '../art/palette';
import { motionProfile, type MotionProfile } from '../logic/motion';
import { GAME_EVENTS, REGISTRY_KEYS, type ReducedMotionPayload } from '../logic/gameEvents';
import { START_OVER_LABEL, showsStartOver } from '../logic/startOver';
import {
  BUTTON_LABEL_PAD,
  LABEL_BOLD_EM,
  TILE_BUTTON,
  WIDE_BUTTON,
  nextFocusIndex,
  tankKeyFor,
} from '../logic/tankUi';
import type { BuildManifest } from '../logic/updateCheck';
import { WORLD_H } from '../logic/zone';
import { setMusicScreen } from '../platform/musicPlayer';
import { applyUpdate, versionLabel, watchForUpdates } from '../platform/updates';
import {
  SCENE_KEYS,
  blinkAt,
  createButton,
  drawPanel,
  readSceneView,
  uiTextStyle,
  useCssCamera,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';
import { createMusicSwitch, toggleMusic } from './musicSwitch';
import { openHomeTank, readSession, startOver } from './sceneFlow';
import { StartOverCard, type StartOverOutcome } from './StartOverCard';

const TAU = Math.PI * 2;
const MARGIN = 16;
const PANEL_PAD = 16;
const PANEL_MAX_W = 560;
const TITLE_PX = 34;
const SUBTITLE_PX = 22;
const SUBTITLE_GAP = 4;
const BODY_PX = 18;
const VERSION_PX = 14;
const VERSION_GAP = 4;
const BUTTON_GAP = 12;
const AXO_WORLD_Y = 210;
const TITLE_TEXT = 'Glam Gills';
const SUBTITLE_TEXT = 'Find Your Flair';
const CONTROLS_TEXT =
  'Use the swim pad in the corner to swim. Press Dash to zoom.\n' +
  'Keys: arrows or WASD to swim, Space to dash, P to pause.\n' +
  'Find all the snacks!';
const UPDATE_PROMPT_TEXT = 'A new version is ready!';
const BUTTONS_BOTTOM_INSET = 8;
const START_OVER_SIZE = 0.8;
const CAPTURED_KEYS: readonly number[] = [
  Phaser.Input.Keyboard.KeyCodes.TAB,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
];

/** `buttons` split in order into rows that each fit `maxW` with BUTTON_GAP between. */
function splitButtonRows(buttons: readonly UiButton[], maxW: number): UiButton[][] {
  const rows: UiButton[][] = [];
  let rowW = Infinity;
  for (const button of buttons) {
    const last = rows[rows.length - 1];
    if (last !== undefined && rowW + BUTTON_GAP + button.width <= maxW) {
      last.push(button);
      rowW += BUTTON_GAP + button.width;
      continue;
    }
    rows.push([button]);
    rowW = button.width;
  }
  return rows;
}

/** The update prompt: a text panel and an Update button, shown once a newer build is published. */
interface UpdatePrompt {
  panel: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  button: UiButton;
}

/** The Start over button (PRD D7) and the two-step card it opens; built only once an axolotl is owned. */
interface StartOverControls {
  button: UiButton;
  card: StartOverCard;
}

/**
 * Label-sized body width of the size-0.8 Start over button (art guide 8, Button width): the scaled
 * icon, the gap and the label (estimated wide at its 22 px size) with BUTTON_LABEL_PAD each side, at
 * least the standard size-0.8 wide body, in whole CSS px.
 */
function startOverButtonBodyWidth(): number {
  const labelPx = Math.max(TILE_BUTTON.labelPx, Math.round(WIDE_BUTTON.labelPx * START_OVER_SIZE));
  const labelW = START_OVER_LABEL.length * LABEL_BOLD_EM * labelPx;
  const contentW = WIDE_BUTTON.iconPx * START_OVER_SIZE + WIDE_BUTTON.iconGap + labelW + 2 * BUTTON_LABEL_PAD;
  return Math.ceil(Math.max(WIDE_BUTTON.w * START_OVER_SIZE, contentW) - 1e-6);
}

/**
 * Title card: canal background, idle axolotl, game name and subtitle, controls, version label, a
 * Start button, the music switch (PRD M8), the Start over button with its card (PRD D7) and the
 * update prompt.
 */
export class TitleScene extends Phaser.Scene {
  private assets!: GameAssets;
  private motion!: MotionProfile;
  private view!: SceneView;
  private clock = 0;
  private axoBaseY = 0;
  private starting = false;
  private backgrounds: Phaser.GameObjects.Image[] = [];
  private axolotlView!: AxolotlRigView;
  private axolotl!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;
  private startButton!: UiButton;
  private musicButton!: UiButton;
  /** Whether the music switch shows: it hides only when the title panel would not fit above it (PRD open question 420). */
  private musicShown = true;
  private startOver: StartOverControls | null = null;
  private startOverShown = false;
  /** Index into focusOrder(); Start is 0. */
  private focusIndex = 0;
  private updating = false;
  private updateManifest: BuildManifest | null = null;
  private updatePrompt: UpdatePrompt | null = null;
  private stopUpdates: () => void = () => undefined;

  constructor() {
    super(SCENE_KEYS.title);
  }

  init(data: GameAssets): void {
    this.assets = data;
    this.clock = 0;
    this.starting = false;
    this.startOver = null;
    this.startOverShown = false;
    this.focusIndex = 0;
    this.updating = false;
    this.updateManifest = null;
    this.updatePrompt = null;
  }

  create(): void {
    this.view = readSceneView(this.scale);
    this.motion = motionProfile(this.registry.get(REGISTRY_KEYS.reducedMotion) === true);
    useCssCamera(this.cameras.main, this.view.fit.dpr);

    this.backgrounds = this.assets.baked.bg.map((info) =>
      this.add.image(0, 0, info.key).setOrigin(0, 0).setDepth(DEPTH.bg),
    );
    this.assets.axolotl.setAppearance({ palette: LEUCISTIC, outfit: NO_OUTFIT });
    this.axolotlView = createAxolotlRigView(this, this.assets.axolotl);
    this.axolotl = this.axolotlView.root.setDepth(DEPTH.axolotl);
    this.panel = this.add.graphics().setDepth(DEPTH.ui);
    this.title = this.add.text(0, 0, TITLE_TEXT, uiTextStyle(TITLE_PX, this.view.fit.dpr)).setDepth(DEPTH.ui);
    this.subtitle = this.add
      .text(0, 0, SUBTITLE_TEXT, uiTextStyle(SUBTITLE_PX, this.view.fit.dpr))
      .setDepth(DEPTH.ui);
    this.controls = this.add
      .text(0, 0, CONTROLS_TEXT, { ...uiTextStyle(BODY_PX, this.view.fit.dpr, false), align: 'center' })
      .setDepth(DEPTH.ui);
    this.versionText = this.add
      .text(0, 0, versionLabel(), uiTextStyle(VERSION_PX, this.view.fit.dpr, false))
      .setDepth(DEPTH.ui);
    this.startButton = createButton(this, this.assets.baked, {
      fill: 'primary',
      shape: 'wide',
      size: 1,
      label: 'Start',
      icon: 'play',
      dpr: this.view.fit.dpr,
      pressOnDown: false,
      onPress: () => this.openTank(),
    });
    this.startButton.container.setDepth(DEPTH.ui);
    this.musicButton = createMusicSwitch(this, this.assets.baked, this.view.fit.dpr);
    this.musicButton.container.setDepth(DEPTH.ui);
    setMusicScreen('title');
    if (showsStartOver(readSession(this.registry))) this.createStartOver();
    this.refreshFocus();

    this.bindInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.on(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.stopUpdates = watchForUpdates((manifest) => this.showUpdatePrompt(manifest));

    this.layout();
    this.animateAxolotl(0);
  }

  update(_time: number, deltaMs: number): void {
    this.animateAxolotl(Math.min(deltaMs / 1000, 0.05));
  }

  /** Start: opens the Home Tank hub (PRD C7). Ignored while the Start over card shows. */
  private openTank(): void {
    if (this.starting || this.startOverCardShowing()) return;
    this.starting = true;
    openHomeTank(this, this.assets);
  }

  /** Builds the Start over button, centred under Start, and its card over everything else (PRD D7). */
  private createStartOver(): void {
    const button = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: START_OVER_SIZE,
      width: startOverButtonBodyWidth(),
      label: START_OVER_LABEL,
      icon: 'close',
      dpr: this.view.fit.dpr,
      pressOnDown: false,
      onPress: () => this.openStartOverCard(),
    });
    button.container.setDepth(DEPTH.ui);
    const card = new StartOverCard(this, this.assets, this.view, DEPTH.ui + 1, (outcome) =>
      this.handleStartOverDone(outcome),
    );
    this.startOver = { button, card };
    this.startOverShown = true;
  }

  /** Opens the first Start over card; the title buttons lose the focus ring while it shows. */
  private openStartOverCard(): void {
    if (this.starting || this.startOver === null || !this.startOverShown) return;
    this.startOver.card.open();
    this.refreshFocus();
  }

  /** Keep puts the focus back on Start over (or Start when it is hidden); erase starts over once. */
  private handleStartOverDone(outcome: StartOverOutcome): void {
    if (outcome === 'erase') {
      if (this.starting) return;
      this.starting = true;
      startOver(this, this.assets);
      return;
    }
    this.focusIndex = this.startOverShown ? this.focusOrder().indexOf(this.startOver?.button ?? this.startButton) : 0;
    this.refreshFocus();
  }

  private startOverCardShowing(): boolean {
    return this.startOver?.card.isShowing() === true;
  }

  /** The title buttons that take the focus, in order: Start, Start over while it shows, then the music switch. */
  private focusOrder(): UiButton[] {
    const startOverButton = this.startOver !== null && this.startOverShown ? [this.startOver.button] : [];
    return [this.startButton, ...startOverButton, ...(this.musicShown ? [this.musicButton] : [])];
  }

  /** Shows the focus ring on the focused title button, only while the Start over card is hidden. */
  private refreshFocus(): void {
    const cardShowing = this.startOverCardShowing();
    const focused = this.focusOrder()[this.focusIndex];
    this.startButton.setFocused(!cardShowing && focused === this.startButton);
    this.musicButton.setFocused(!cardShowing && focused === this.musicButton);
    this.startOver?.button.setFocused(!cardShowing && focused === this.startOver.button);
  }

  /** One keydown handler for every title key; Tab, the arrows and Space are captured while it runs. */
  private bindInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.addCapture([...CAPTURED_KEYS]);
    keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
  }

  /**
   * While the Start over card shows, keys go to it. Otherwise Tab and Shift+Tab move the focus
   * between Start, Start over and the music switch, wrapping, and Enter and Space press the focused
   * button, ignoring key repeat.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const action = tankKeyFor(event.key, event.shiftKey);
    if (action === null) return;
    if (this.startOver !== null && this.startOver.card.isShowing()) {
      this.startOver.card.handleKey(action, event.repeat);
      return;
    }
    if (action === 'confirm') {
      if (!event.repeat) this.pressFocused();
      return;
    }
    if (action !== 'next' && action !== 'previous') return;
    this.focusIndex = nextFocusIndex(this.focusIndex, this.focusOrder().length, action === 'next' ? 1 : -1);
    this.refreshFocus();
  }

  private pressFocused(): void {
    const focused = this.focusOrder()[this.focusIndex];
    if (focused === this.musicButton) {
      toggleMusic(this.musicButton);
      return;
    }
    if (focused === this.startOver?.button) {
      this.openStartOverCard();
      return;
    }
    this.openTank();
  }

  /**
   * Shows the update prompt once; later builds only replace the target manifest. The Start over
   * button hides while the prompt shows (art guide section 12), and the focus moves to Start.
   */
  private showUpdatePrompt(manifest: BuildManifest): void {
    if (this.starting || this.updating) return;
    this.updateManifest = manifest;
    if (this.updatePrompt !== null) return;
    const dpr = this.view.fit.dpr;
    const panel = this.add.graphics().setDepth(DEPTH.ui);
    const text = this.add
      .text(0, 0, UPDATE_PROMPT_TEXT, { ...uiTextStyle(BODY_PX, dpr), align: 'center' })
      .setDepth(DEPTH.ui);
    const button = createButton(this, this.assets.baked, {
      fill: 'secondary',
      shape: 'wide',
      size: 1,
      label: 'Update',
      icon: 'dash',
      dpr,
      pressOnDown: false,
      onPress: () => this.updateNow(),
    });
    button.container.setDepth(DEPTH.ui);
    this.updatePrompt = { panel, text, button };
    this.input.keyboard?.on('keydown-U', this.updateNow, this);
    this.startOverShown = false;
    this.startOver?.button.container.setVisible(false);
    this.focusIndex = 0;
    this.refreshFocus();
    this.layout();
  }

  /** Reloads into the new build. Saved progress is untouched (ADR 0009). Ignored while the Start over card shows. */
  private updateNow(): void {
    if (this.updating || this.starting || this.updateManifest === null || this.startOverCardShowing()) return;
    this.updating = true;
    applyUpdate(this.updateManifest);
  }

  private handleResize(): void {
    this.view = readSceneView(this.scale);
    useCssCamera(this.cameras.main, this.view.fit.dpr);
    this.title.setResolution(this.view.fit.dpr);
    this.subtitle.setResolution(this.view.fit.dpr);
    this.controls.setResolution(this.view.fit.dpr);
    this.versionText.setResolution(this.view.fit.dpr);
    this.startButton.setResolution(this.view.fit.dpr);
    this.musicButton.setResolution(this.view.fit.dpr);
    this.startOver?.button.setResolution(this.view.fit.dpr);
    this.startOver?.card.setResolution(this.view.fit.dpr);
    this.updatePrompt?.text.setResolution(this.view.fit.dpr);
    this.updatePrompt?.button.setResolution(this.view.fit.dpr);
    this.layout();
    this.startOver?.card.layout(this.view);
  }

  private handleReducedMotion(payload: ReducedMotionPayload): void {
    this.motion = motionProfile(payload.reduced);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game.events.off(GAME_EVENTS.REDUCED_MOTION, this.handleReducedMotion, this);
    this.stopUpdates();
    this.axolotlView.destroy();
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.handleKeyDown, this);
    keyboard.removeCapture([...CAPTURED_KEYS]);
  }

  /** World units to CSS px for the background and axolotl. */
  private worldScale(): number {
    return this.view.fit.fitZoom;
  }

  private worldTop(): number {
    return (this.view.cssH - WORLD_H * this.worldScale()) / 2;
  }

  private layout(): void {
    const { cssW, cssH } = this.view;
    const zoom = this.worldScale();
    const top = this.worldTop();
    this.backgrounds.forEach((image, i) => {
      const info = this.assets.baked.bg[i];
      image.setPosition(i * info.w * zoom, top).setScale(zoom / info.scale);
    });

    const lowerTop = this.layoutLower(cssW, cssH);
    const panelBottom = this.layoutTitlePanel(cssW, lowerTop);

    const axoY = Math.min(top + AXO_WORLD_Y * zoom, lowerTop - 60 * zoom);
    this.axoBaseY = Math.max(panelBottom + 50 * zoom, axoY);
    this.axolotl.setPosition(cssW / 2, this.axoBaseY);
    this.axolotl.setScale((AXO_SCENE_SCALE * zoom) / this.assets.axolotl.scale);
  }

  /**
   * Places the buttons and the update prompt, and returns the top of the lower UI. The music switch
   * hides when its row would leave no room above for the title panel (name, subtitle and version),
   * as on a short screen with the update prompt showing, and shows again once there is room. The
   * focus moves off it when it hides.
   */
  private layoutLower(cssW: number, cssH: number): number {
    this.musicShown = true;
    let lowerTop = this.layoutPrompt(cssW, this.layoutButtons(cssW, cssH));
    if (MARGIN + this.titlePanelHeight(false) + BUTTON_GAP > lowerTop) {
      this.musicShown = false;
      lowerTop = this.layoutPrompt(cssW, this.layoutButtons(cssW, cssH));
    }
    this.musicButton.container.setVisible(this.musicShown);
    this.focusIndex = Math.min(this.focusIndex, this.focusOrder().length - 1);
    this.refreshFocus();
    return lowerTop;
  }

  /**
   * Places the buttons from the bottom: Start over centred at the bottom while it shows, and above it
   * the row of Update (while the prompt shows), Start and the music switch, in that order. The row
   * wraps onto more rows, each centred, when it is wider than the screen. Returns the top of the
   * topmost button.
   */
  private layoutButtons(cssW: number, cssH: number): number {
    let bottomY = cssH - MARGIN - BUTTONS_BOTTOM_INSET;
    if (this.startOver !== null && this.startOverShown) {
      const startOverButton = this.startOver.button;
      bottomY -= startOverButton.height;
      startOverButton.container.setPosition((cssW - startOverButton.width) / 2, bottomY);
      bottomY -= BUTTON_GAP;
    }
    const update = this.updatePrompt?.button;
    const music = this.musicShown ? [this.musicButton] : [];
    const items = [...(update === undefined ? [] : [update]), this.startButton, ...music];
    const rows = splitButtonRows(items, cssW - 2 * MARGIN);
    let rowBottom = bottomY;
    for (const row of [...rows].reverse()) {
      const rowH = Math.max(...row.map((button) => button.height));
      const rowW = row.reduce((sum, button) => sum + button.width, 0) + BUTTON_GAP * (row.length - 1);
      let x = (cssW - rowW) / 2;
      for (const button of row) {
        button.container.setPosition(x, rowBottom - rowH + (rowH - button.height) / 2);
        x += button.width + BUTTON_GAP;
      }
      rowBottom -= rowH + BUTTON_GAP;
    }
    return rowBottom + BUTTON_GAP;
  }

  /** Places the prompt text panel just above the buttons; returns its top, or `buttonsTop` with no prompt. */
  private layoutPrompt(cssW: number, buttonsTop: number): number {
    const prompt = this.updatePrompt;
    if (prompt === null) return buttonsTop;
    prompt.text.setWordWrapWidth(this.textWidth(cssW), true);
    const panelW = prompt.text.width + 2 * PANEL_PAD;
    const panelH = prompt.text.height + 2 * PANEL_PAD;
    const panelY = buttonsTop - BUTTON_GAP - panelH;
    drawPanel(prompt.panel, (cssW - panelW) / 2, panelY, panelW, panelH, UI_PANEL);
    prompt.text.setPosition((cssW - prompt.text.width) / 2, panelY + PANEL_PAD);
    return panelY;
  }

  /**
   * Draws the title panel (title, subtitle, controls, version label) and returns its bottom.
   * On a short screen the controls text hides whenever the full panel would not fit above the lower UI,
   * so the panels never overlap. The name, subtitle and version label always show.
   */
  private layoutTitlePanel(cssW: number, lowerTop: number): number {
    this.controls.setWordWrapWidth(this.textWidth(cssW), true);
    const showControls = MARGIN + this.titlePanelHeight(true) + BUTTON_GAP <= lowerTop;
    this.controls.setVisible(showControls);
    const panelH = this.titlePanelHeight(showControls);
    const contentW = Math.max(
      this.title.width,
      this.subtitle.width,
      showControls ? this.controls.width : 0,
      this.versionText.width,
    );
    const panelW = contentW + 2 * PANEL_PAD;
    drawPanel(this.panel, (cssW - panelW) / 2, MARGIN, panelW, panelH, UI_PANEL);
    this.title.setPosition((cssW - this.title.width) / 2, MARGIN + PANEL_PAD);
    const subtitleY = MARGIN + PANEL_PAD + this.title.height + SUBTITLE_GAP;
    this.subtitle.setPosition((cssW - this.subtitle.width) / 2, subtitleY);
    this.controls.setPosition((cssW - this.controls.width) / 2, subtitleY + this.subtitle.height + PANEL_PAD);
    const versionY = MARGIN + panelH - PANEL_PAD - this.versionText.height;
    this.versionText.setPosition((cssW - this.versionText.width) / 2, versionY);
    return MARGIN + panelH;
  }

  private titlePanelHeight(showControls: boolean): number {
    const controlsH = showControls ? this.controls.height + PANEL_PAD : 0;
    const headH = this.title.height + SUBTITLE_GAP + this.subtitle.height;
    return headH + controlsH + VERSION_GAP + this.versionText.height + 2 * PANEL_PAD;
  }

  private textWidth(cssW: number): number {
    return Math.min(cssW - 2 * (MARGIN + PANEL_PAD), PANEL_MAX_W);
  }

  private animateAxolotl(dt: number): void {
    this.clock += dt;
    const t = this.motion.ambient ? this.clock : T_STATIC;
    const pose: AxolotlPose = {
      swimPhase: (TAU * t) / 1.2,
      gillPhase: this.motion.gillFlutter ? (TAU * t) / 0.8 : (TAU * T_STATIC) / 0.8,
      blink: this.motion.ambient ? blinkAt(t) : 1,
      tailAmp: 1,
      sparkle: 0,
    };
    this.axolotlView.setPose(pose);
    const zoom = this.worldScale();
    this.axolotl.y = this.axoBaseY + this.motion.bob * Math.sin((TAU * t) / 3) * zoom;
    this.axolotl.rotation = this.motion.ambient ? 0.12 * Math.cos((TAU * t) / 3) : 0;
  }
}
