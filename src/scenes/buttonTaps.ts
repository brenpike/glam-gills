/**
 * The button tap (PRD S15): every button press plays the soft tap, or the lower close or back tap
 * for a close or back button (issue #167, ND-2), by touch or by keyboard. createButton plays it on a
 * touch or click press. A key press goes through each scene's own press code instead, so one key
 * listener plays it when Enter or Space presses a button: whenever a shown button that taps has its
 * focus ring, it plays that button's tap or close or back tap. Keyboard focus moves stay silent (PRD
 * open question 443), and so does typing a name (S2).
 */
import type * as Phaser from 'phaser';
import type { SoundId } from '../logic/sounds';
import { tankKeyFor } from '../logic/tankUi';
import { playSound } from '../platform/soundPlayer';

/**
 * The buttons that tap and show their focus ring now, each with its press sound (the tap or the
 * close or back tap). INVARIANT: insertion order is focus order, so the most recently focused
 * button comes last.
 */
const focusedButtons = new Map<Phaser.GameObjects.Container, SoundId>();
let installed = false;

/**
 * Notes whether the tapping button `container` shows its focus ring, so a confirm key presses it,
 * and the `sound` its press plays: the tap, or the close or back tap.
 */
export function setTapFocus(container: Phaser.GameObjects.Container, focused: boolean, sound: SoundId = 'tap'): void {
  focusedButtons.delete(container);
  if (focused) focusedButtons.set(container, sound);
}

/** Forgets `container` when it goes away. */
export function forgetTapButton(container: Phaser.GameObjects.Container): void {
  focusedButtons.delete(container);
}

/**
 * Plays one sound when Enter or Space (not a key repeat) presses a focused button on a running, shown
 * scene: the tap, or the close or back tap, of the most recently focused shown button. Listens before the scenes do, so it sees the focus as it was when the key went down. Call
 * once, before the game starts.
 */
export function installKeyboardTaps(): void {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.repeat || isTyping(event.target) || tankKeyFor(event.key, event.shiftKey) !== 'confirm') return;
      const sound = latestShownSound();
      if (sound !== null) playSound(sound);
    },
    true,
  );
}

/** The press sound of the most recently focused shown button, or null when none shows. */
function latestShownSound(): SoundId | null {
  const shown = [...focusedButtons].filter(([container]) => isShown(container));
  return shown.at(-1)?.[1] ?? null;
}

/** Whether a key went to a text field, such as the name field (no tap while typing, S2). */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
}

/** Whether `container`, and every container it is in, shows on a running, shown scene. */
function isShown(container: Phaser.GameObjects.Container): boolean {
  const systems = container.scene?.sys;
  if (systems === undefined || !systems.isActive() || !systems.isVisible()) return false;
  for (let node: Phaser.GameObjects.Container | null = container; node !== null; node = node.parentContainer) {
    if (!node.visible) return false;
  }
  return true;
}
