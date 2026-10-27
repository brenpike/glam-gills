import * as Phaser from 'phaser';
import type { IconKind } from '../art/drawUi';
import { INK, UI_PANEL } from '../art/palette';
import {
  axolotlChoicesLayout,
  choiceButtonSizes,
  choiceLabel,
  choicesReady,
  openAxolotlChoices,
  reduceAxolotlChoices,
  type AxolotlChoiceId,
  type AxolotlChoicesAction,
  type AxolotlChoicesButton,
  type AxolotlChoicesEffect,
  type AxolotlChoicesMeasure,
  type AxolotlChoicesState,
} from '../logic/axolotlChoices';
import { CARD } from '../logic/cardFit';
import type { Rect, Size } from '../logic/hudLayout';
import type { StylerStep } from '../logic/stylerSteps';
import { tankKeyFor } from '../logic/tankUi';
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

/** Each card button's icon: the art guide's Pencil, Shirt, Paint drop and Left chevron icons (8). */
const CHOICE_ICONS: Readonly<Record<AxolotlChoicesButton, IconKind>> = Object.freeze({
  restyle: 'pencil',
  outfit: 'shirt',
  dream: 'paintDrop',
  back: 'left',
});

/** What the card shows and who hears its presses. */
export interface AxolotlChoicesCardOptions {
  /** The axolotl's name, shown as the title. */
  name: string;
  /** How many Dream colours the hub owns: Dream colour shows when at least one. */
  ownedDreamCount: number;
  /** A choice: open the styler on `startStep`. Called at most once; the card then ignores input. */
  onChoose: (choice: AxolotlChoiceId, startStep: StylerStep) => void;
  /** Back or Escape: close the card. Called at most once; the card then ignores input. */
  onBack: () => void;
}

/** The parts of a keydown the card reads. */
export type AxolotlChoicesKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'repeat'>;

/** Sets `text` to wrap at `wrapW` and returns its size. */
function wrappedSize(text: Phaser.GameObjects.Text, wrapW: number): Size {
  text.setWordWrapWidth(Math.max(1, wrapW), true);
  return { w: text.width, h: text.height };
}

/** Wraps `text` to the measured `rect` (with 1 px slack, so it breaks as measured) and centres it there. */
function placeTextIn(text: Phaser.GameObjects.Text, rect: Rect): void {
  text.setWordWrapWidth(rect.w + 1, true);
  text.setPosition(rect.x + (rect.w - text.width) / 2, rect.y + (rect.h - text.height) / 2).setVisible(true);
}

/**
 * The axolotl choices card (PRD F6, F16; art guide 8 "Axolotl choices card", 9, 10), over the Home
 * Tank: an ink dim at 0.45 that takes every press and a white panel laid out by
 * axolotlChoicesLayout(), with the axolotl's name as the title and Restyle, Outfit, Dream colour (when
 * a Dream colour is owned) and Back as square tiles. Every press, key and the press wait go through
 * reduceAxolotlChoices(); it appears, changes and leaves at once, with no tweens or motion, so it is
 * the same under reduced motion. The focused button has the double focus ring, so nothing reads by
 * colour alone. It shows from construction; the owner destroys it to leave. After a choice or Back it
 * ignores further input.
 */
export class AxolotlChoicesCard {
  private readonly onChoose: (choice: AxolotlChoiceId, startStep: StylerStep) => void;
  private readonly onBack: () => void;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly buttons: UiButton[];
  private state: AxolotlChoicesState;
  private view: SceneView;
  private finished = false;

  constructor(scene: Phaser.Scene, assets: GameAssets, view: SceneView, depth: number, options: AxolotlChoicesCardOptions) {
    this.view = view;
    this.onChoose = options.onChoose;
    this.onBack = options.onBack;
    this.state = openAxolotlChoices(options.ownedDreamCount);
    const dpr = view.fit.dpr;

    const dim = scene.add
      .rectangle(-DIM_COVER / 2, -DIM_COVER / 2, DIM_COVER, DIM_COVER, cssColor(INK).color, DIM_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, options.name, { ...uiTextStyle(CARD.titlePx, dpr, true), align: 'center' });
    const sizes = choiceButtonSizes(this.state.buttons);
    this.buttons = this.state.buttons.map((button, index) =>
      createButton(scene, assets.baked, {
        fill: 'secondary',
        shape: 'square',
        size: 1,
        width: sizes[index].w,
        label: choiceLabel(button),
        icon: CHOICE_ICONS[button],
        dpr,
        pressOnDown: false,
        backTap: button === 'back',
        onPress: () => this.dispatch({ type: 'press', button }),
      }),
    );

    this.container = scene.add
      .container(0, 0, [dim, this.panel, this.title, ...this.buttons.map((button) => button.container)])
      .setDepth(depth);
    this.layout(view);
  }

  /**
   * Handles a keydown through the card reducer: Tab, Shift+Tab and the arrows move the focus,
   * wrapping; Enter and Space press the focused button, ignoring key repeat; Escape is Back. Returns
   * true when the card took the key, false for keys it does not read and after a choice or Back.
   */
  handleKey(event: AxolotlChoicesKeyEvent): boolean {
    if (this.finished) return false;
    const intent = tankKeyFor(event.key, event.shiftKey);
    if (intent === null || intent === 'putAway') return false;
    this.dispatch({ type: 'key', key: event.key, shiftKey: event.shiftKey, repeat: event.repeat });
    return true;
  }

  /** Counts `deltaMs` towards the press wait. Call every frame from the scene update. */
  update(_time: number, deltaMs: number): void {
    if (this.finished || choicesReady(this.state)) return;
    this.state = reduceAxolotlChoices(this.state, { type: 'elapse', ms: Math.max(0, deltaMs) }).state;
  }

  /** Lays the card out for `view` with axolotlChoicesLayout() and redraws it. */
  layout(view: SceneView): void {
    this.view = view;
    this.relayout();
  }

  /** Sets the text and button resolution to `dpr`. Call layout() straight after, as a resize does. */
  setResolution(dpr: number): void {
    this.title.setResolution(dpr);
    for (const button of this.buttons) {
      button.setResolution(dpr);
    }
  }

  /** Removes every object; the card then ignores input. */
  destroy(): void {
    this.finished = true;
    this.container.destroy();
  }

  /** Runs one action through the reducer, redraws, then acts on its effect. Ignored once finished. */
  private dispatch(action: AxolotlChoicesAction): void {
    if (this.finished) return;
    const result = reduceAxolotlChoices(this.state, action);
    this.state = result.state;
    this.refresh();
    this.applyEffect(result.effect);
  }

  /** Calls the owner for an effect, finishing the card first so the owner may destroy it. */
  private applyEffect(effect: AxolotlChoicesEffect | undefined): void {
    if (effect === undefined) return;
    this.finished = true;
    if (effect.type === 'choose') this.onChoose(effect.choice, effect.startStep);
    else this.onBack();
  }

  /** The layout measures, each title wrap width measured once per layout. */
  private measureFor(): AxolotlChoicesMeasure {
    const titles = new Map<number, Size>();
    const titleAt = (wrapW: number): Size => {
      const known = titles.get(wrapW) ?? wrappedSize(this.title, wrapW);
      titles.set(wrapW, known);
      return known;
    };
    return { titleAt };
  }

  /** Lays the card out, places the panel, the title and the buttons, then redraws the focus. */
  private relayout(): void {
    const placed = axolotlChoicesLayout(this.view, this.state.buttons, this.measureFor());
    const { panel } = placed;
    drawPanel(this.panel, panel.x, panel.y, panel.w, panel.h, UI_PANEL);
    if (placed.title === null) this.title.setVisible(false);
    else placeTextIn(this.title, placed.title);
    this.buttons.forEach((button, index) => {
      const rect = placed.buttons[index];
      button.container.setPosition(rect.x, rect.y);
    });
    this.refresh();
  }

  /** Redraws the state: the focus ring on the focused button. */
  private refresh(): void {
    this.buttons.forEach((button, index) => button.setFocused(index === this.state.focus));
  }
}
