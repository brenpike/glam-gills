import * as Phaser from 'phaser';
import { INK, LW, UI_PANEL, WHITE } from '../art/palette';
import { CARD, factCardBodyWrapWidths, fitCard } from '../logic/cardFit';
import { FACT_CARD_OK_LABEL } from '../logic/factCards';
import { FIRST_HIT_TIP_BODY, firstHitTipCardRoom } from '../logic/firstHitTip';
import type { Rect } from '../logic/hudLayout';
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
/** Corner radius drawPanel() gives a panel at least 36 px tall. */
const PANEL_RADIUS = 18;
/** Double focus ring just outside the 3.5 px outline, as on the baked buttons (art guide 8). */
const RING_LINE = 3;
const RING_INNER = LW / 2 + 1.5;
const RING_OUTER = LW / 2 + 4.5;

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

/**
 * The first-hit tip card over the paused swim scene (PRD A23, issue #230), like a fact card: an ink
 * dim that swallows every press, a white panel with the tip lines as a centred body and no title,
 * and one wide primary OK button that always shows the focus ring. A steady double focus ring, which
 * never pulses, circles the legs panel above the dim; the HUD lifts the legs display above the dim.
 * The panel sits below the legs panel. Appears and leaves at once in both motion modes. OK hides the
 * card and calls `onClose`; it ignores presses for the first MIN_SHOW_MS the card shows.
 */
export class FirstHitTipCard {
  private readonly scene: Phaser.Scene;
  private readonly onClose: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Text;
  private readonly button: UiButton;
  private view: SceneView;
  private legs: Rect = { x: 0, y: 0, w: 0, h: 0 };
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
    this.ring = scene.add.graphics();
    this.panel = scene.add.graphics();
    this.body = scene.add.text(0, 0, FIRST_HIT_TIP_BODY, { ...uiTextStyle(CARD.bodyPx, dpr, false), align: 'center' });
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
      .container(0, 0, [dim, this.ring, this.panel, this.body, this.button.container])
      .setDepth(depth)
      .setVisible(false);
  }

  /** Whether the card is on screen. */
  isShowing(): boolean {
    return this.container.visible;
  }

  /** Shows the card at once, laid out below the legs panel last given to layout(), and plays the fact card sound. */
  show(): void {
    this.shownAt = this.scene.time.now;
    this.layout(this.view, this.legs);
    this.container.setVisible(true);
    playSound('factCard');
  }

  hide(): void {
    this.container.setVisible(false);
  }

  /** OK: once the card has shown for MIN_SHOW_MS, hides it and calls `onClose`. Ignored while hidden. */
  press(): void {
    if (!this.container.visible) return;
    // The HUD clock is paused while the card shows, but time.now still advances: Phaser 3's
    // Clock.update sets `now` before its paused check. The fact card's wait relies on this too.
    if (this.scene.time.now - this.shownAt < MIN_SHOW_MS) return;
    this.hide();
    this.onClose();
  }

  setResolution(dpr: number): void {
    this.body.setResolution(dpr);
    this.button.setResolution(dpr);
  }

  /**
   * Draws the focus ring round the legs panel `legs` and centres the panel in the room below it
   * (firstHitTipCardRoom). fitCard() sizes the panel from the body (clipped to whole lines only when
   * nothing fits) and the button, wrapping the body at the first of factCardBodyWrapWidths() that
   * fits, and keeps the button inside the room. Safe to call before show() and after hide().
   */
  layout(view: SceneView, legs: Rect): void {
    this.view = view;
    this.legs = legs;
    const { cssW, cssH } = view;
    this.ring.clear();
    strokeFocusRing(this.ring, legs, Math.min(legs.h / 2, PANEL_RADIUS));
    const room = firstHitTipCardRoom(cssH, legs);
    this.body.setMaxLines(0);
    const lineH = this.body.getTextMetrics().fontSize;
    const wrapWidths = factCardBodyWrapWidths(cssW);
    const variants = wrapWidths.map((wrapW) => ({ lines: this.bodyLinesAt(wrapW), lineH }));
    const fit = fitCard(room.availH, [
      { kind: 'body', variants },
      { kind: 'actions', height: this.button.height },
    ]);
    const [bodySlot, actionsSlot] = fit.slots;
    this.body.setWordWrapWidth(wrapWidths[fit.bodyVariant], true);
    this.body.setVisible(fit.bodyLines > 0);
    this.body.setMaxLines(fit.clipped ? fit.bodyLines : 0);
    const bodyW = fit.bodyLines > 0 ? this.body.width : 0;
    const panelW = Math.min(cssW - 2 * CARD.margin, Math.max(bodyW, this.button.width) + 2 * CARD.pad);
    const panelY = room.top + Math.max(0, (room.availH - fit.panelH) / 2);
    drawPanel(this.panel, (cssW - panelW) / 2, panelY, panelW, fit.panelH, UI_PANEL);
    this.body.setPosition((cssW - this.body.width) / 2, panelY + bodySlot.top);
    this.button.container.setPosition((cssW - this.button.width) / 2, panelY + actionsSlot.top);
  }

  /** Lines the body wraps to at `wrapW`; leaves the body wrapping at `wrapW`. */
  private bodyLinesAt(wrapW: number): number {
    this.body.setWordWrapWidth(wrapW, true);
    return this.body.getWrappedText(this.body.text).length;
  }
}
