import * as Phaser from 'phaser';
import { INK, UI_PANEL } from '../art/palette';
import { CARD, cardTightTextWidth, factCardBodyWrapWidths, fitCard } from '../logic/cardFit';
import { FACT_CARD_OK_LABEL, type FactCard as FactCardData } from '../logic/factCards';
import { playSound } from '../platform/soundPlayer';
import {
  createButton,
  cssColor,
  drawPanel,
  uiTextStyle,
  type GameAssets,
  type SceneView,
  type UiButton,
} from './BootScene';

const DIM_ALPHA = 0.45;
const DIM_COVER = 8192;
const MIN_SHOW_MS = 800;

/**
 * A hazard or predator fact card over the paused swim scene (PRD A21): an ink dim that swallows every press, a
 * white panel with the bold title, the centred body and one wide primary OK button that always
 * shows the focus ring. Appears and leaves at once in both motion modes. OK hides the card and
 * calls `onClose`; it ignores presses for the first MIN_SHOW_MS the card shows.
 */
export class FactCard {
  private readonly scene: Phaser.Scene;
  private readonly onClose: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly button: UiButton;
  private view: SceneView;
  private shownAt = 0;

  constructor(scene: Phaser.Scene, assets: GameAssets, view: SceneView, depth: number, onClose: () => void) {
    this.scene = scene;
    this.view = view;
    this.onClose = onClose;
    const dpr = view.fit.dpr;
    const ink = cssColor(INK);
    const dim = scene.add
      .rectangle(-DIM_COVER / 2, -DIM_COVER / 2, DIM_COVER, DIM_COVER, ink.color, DIM_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', { ...uiTextStyle(CARD.titlePx, dpr), align: 'center' });
    this.body = scene.add.text(0, 0, '', { ...uiTextStyle(CARD.bodyPx, dpr, false), align: 'center' });
    this.button = createButton(scene, assets.baked, {
      fill: 'primary',
      shape: 'wide',
      size: 1,
      label: FACT_CARD_OK_LABEL,
      icon: 'check',
      dpr,
      pressOnDown: false,
      onPress: () => this.press(),
    });
    this.button.setFocused(true);
    this.container = scene.add
      .container(0, 0, [dim, this.panel, this.title, this.body, this.button.container])
      .setDepth(depth)
      .setVisible(false);
  }

  /** Whether the card is on screen. */
  isShowing(): boolean {
    return this.container.visible;
  }

  /** Shows `card` at once: its title and body, laid out from that text, and plays the fact card sound. */
  show(card: Readonly<FactCardData>): void {
    this.title.setText(card.title);
    this.body.setText(card.body);
    this.shownAt = this.scene.time.now;
    this.layout(this.view);
    this.container.setVisible(true);
    playSound('factCard');
  }

  hide(): void {
    this.container.setVisible(false);
  }

  /** OK: once the card has shown for MIN_SHOW_MS, hides it and calls `onClose`. Ignored while hidden. */
  press(): void {
    if (!this.container.visible) return;
    if (this.scene.time.now - this.shownAt < MIN_SHOW_MS) return;
    this.hide();
    this.onClose();
  }

  setResolution(dpr: number): void {
    for (const text of [this.title, this.body]) {
      text.setResolution(dpr);
    }
    this.button.setResolution(dpr);
  }

  /**
   * Centres the panel on a canvas that has room for it. fitCard() sizes it from the current title, the
   * current body (clipped to whole lines only when nothing fits) and the button: it tightens the padding on a
   * short screen and keeps the button inside the canvas. The title wraps at cardTightTextWidth(), so a long
   * title such as "Plastic is not food" stays on one line on a small canvas. The body wraps at the first of
   * factCardBodyWrapWidths() that fits: cardTextWidth(), else cardTightTextWidth(), so a long body such as the
   * heron's shows in full at 320 x 440. The panel width rule is unchanged, so the title and the body keep at
   * least 12 px of room at each side. The title always shows. Safe to call before show() and after hide().
   */
  layout(view: SceneView): void {
    this.view = view;
    const { cssW, cssH } = view;
    this.title.setWordWrapWidth(cardTightTextWidth(cssW), true);
    this.body.setMaxLines(0);
    const lineH = this.body.getTextMetrics().fontSize;
    const wrapWidths = factCardBodyWrapWidths(cssW);
    const variants = wrapWidths.map((wrapW) => ({ lines: this.bodyLinesAt(wrapW), lineH }));
    const availH = cssH - 2 * CARD.margin;
    const fit = fitCard(availH, [
      { kind: 'fixed', height: this.title.height },
      { kind: 'body', variants },
      { kind: 'actions', height: this.button.height },
    ]);
    const [titleSlot, bodySlot, actionsSlot] = fit.slots;
    this.body.setWordWrapWidth(wrapWidths[fit.bodyVariant], true);
    this.body.setVisible(fit.bodyLines > 0);
    this.body.setMaxLines(fit.clipped ? fit.bodyLines : 0);
    const bodyW = fit.bodyLines > 0 ? this.body.width : 0;
    const panelW = Math.min(
      cssW - 2 * CARD.margin,
      Math.max(this.title.width, bodyW, this.button.width) + 2 * CARD.pad,
    );
    const panelY = CARD.margin + Math.max(0, (availH - fit.panelH) / 2);
    drawPanel(this.panel, (cssW - panelW) / 2, panelY, panelW, fit.panelH, UI_PANEL);
    this.title.setPosition((cssW - this.title.width) / 2, panelY + titleSlot.top);
    this.body.setPosition((cssW - this.body.width) / 2, panelY + bodySlot.top);
    this.button.container.setPosition((cssW - this.button.width) / 2, panelY + actionsSlot.top);
  }

  /** Lines the current body wraps to at `wrapW`; leaves the body wrapping at `wrapW`. */
  private bodyLinesAt(wrapW: number): number {
    this.body.setWordWrapWidth(wrapW, true);
    return this.body.getWrappedText(this.body.text).length;
  }
}
