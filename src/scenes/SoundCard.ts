import type * as Phaser from 'phaser';
import { INK, UI_PANEL } from '../art/palette';
import { CARD } from '../logic/cardFit';
import { SOUND_CARD_FOCUS, soundCardLayout } from '../logic/soundCard';
import { CLOSE_LABEL, SOUND_LABEL } from '../logic/tankText';
import { nextFocusIndex, wideButtonWidth, type TankKey } from '../logic/tankUi';
import { createButton, cssColor, drawPanel, uiTextStyle, type GameAssets, type SceneView, type UiButton } from './BootScene';
import { createMusicSwitch, toggleMusic } from './musicSwitch';
import { createSoundsSwitch, toggleSounds } from './soundsSwitch';

const DIM_ALPHA = 0.45;
const DIM_COVER = 8192;

/**
 * The Home Tank's Sound card (PRD M8, S14; open question 429), which the "Sound" hub tile opens: an
 * ink dim that swallows every press, a white panel with the bold title "Sound", the music switch with
 * the sounds switch beside it (under it on a narrow screen) and Close under them. Focus starts on the
 * music switch; next, previous, left and right move it, wrapping, confirm presses the focused button
 * (ignoring key repeat), and cancel or Close closes the card and calls `onClose`. Appears and leaves
 * at once in both motion modes.
 */
export class SoundCard {
  private readonly onClose: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly music: UiButton;
  private readonly sounds: UiButton;
  private readonly close: UiButton;
  private view: SceneView;
  private focusIndex = 0;

  constructor(scene: Phaser.Scene, assets: GameAssets, view: SceneView, depth: number, onClose: () => void) {
    this.view = view;
    this.onClose = onClose;
    const dpr = view.fit.dpr;
    const ink = cssColor(INK);
    const dim = scene.add
      .rectangle(-DIM_COVER / 2, -DIM_COVER / 2, DIM_COVER, DIM_COVER, ink.color, DIM_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, SOUND_LABEL, uiTextStyle(CARD.titlePx, dpr));
    this.music = createMusicSwitch(scene, assets.baked, dpr);
    this.sounds = createSoundsSwitch(scene, assets.baked, dpr);
    this.close = createButton(scene, assets.baked, {
      fill: 'primary',
      shape: 'wide',
      size: 1,
      width: wideButtonWidth(CLOSE_LABEL),
      label: CLOSE_LABEL,
      icon: 'close',
      dpr,
      pressOnDown: false,
      backTap: true,
      onPress: () => this.hide(),
    });
    this.container = scene.add
      .container(0, 0, [dim, this.panel, this.title, this.music.container, this.sounds.container, this.close.container])
      .setDepth(depth)
      .setVisible(false);
  }

  /** Whether the card is on screen. */
  isShowing(): boolean {
    return this.container.visible;
  }

  /** Shows the card at once with the focus on the music switch. */
  open(): void {
    this.setFocus(0);
    this.layout(this.view);
    this.container.setVisible(true);
  }

  /** Handles a key while the card shows; every key while hidden does nothing. */
  handleKey(action: TankKey, repeat: boolean): void {
    if (!this.isShowing()) return;
    const count = SOUND_CARD_FOCUS.length;
    if (action === 'next' || action === 'right' || action === 'down') this.setFocus(nextFocusIndex(this.focusIndex, count, 1));
    else if (action === 'previous' || action === 'left' || action === 'up') this.setFocus(nextFocusIndex(this.focusIndex, count, -1));
    else if (action === 'confirm' && !repeat) this.pressFocused();
    else if (action === 'cancel') this.hide();
  }

  setResolution(dpr: number): void {
    this.title.setResolution(dpr);
    for (const button of this.buttons()) button.setResolution(dpr);
  }

  /** Centres the card on `view` (soundCardLayout). Safe to call while hidden. */
  layout(view: SceneView): void {
    this.view = view;
    const size = (button: UiButton) => ({ w: button.width, h: button.height });
    const layout = soundCardLayout(view, {
      title: { w: this.title.width, h: this.title.height },
      music: size(this.music),
      sounds: size(this.sounds),
      close: size(this.close),
    });
    const { panel } = layout;
    drawPanel(this.panel, panel.x, panel.y, panel.w, panel.h, UI_PANEL);
    this.title.setPosition(layout.title.x, layout.title.y);
    this.music.container.setPosition(layout.music.x, layout.music.y);
    this.sounds.container.setPosition(layout.sounds.x, layout.sounds.y);
    this.close.container.setPosition(layout.close.x, layout.close.y);
  }

  destroy(): void {
    this.container.destroy();
  }

  /** The card's buttons in SOUND_CARD_FOCUS order. */
  private buttons(): UiButton[] {
    return [this.music, this.sounds, this.close];
  }

  private pressFocused(): void {
    const focused = SOUND_CARD_FOCUS[this.focusIndex];
    if (focused === 'music') toggleMusic(this.music);
    else if (focused === 'sounds') toggleSounds(this.sounds);
    else this.hide();
  }

  private hide(): void {
    if (!this.isShowing()) return;
    this.container.setVisible(false);
    for (const button of this.buttons()) button.setFocused(false);
    this.onClose();
  }

  private setFocus(index: number): void {
    this.focusIndex = index;
    this.buttons().forEach((button, i) => button.setFocused(i === index));
  }
}
