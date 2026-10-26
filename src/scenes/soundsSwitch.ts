/**
 * The sounds switch (PRD S14): a button whose icon and words show whether sounds are on, beside the
 * music switch on the title screen and the trip pause screen, and in the Home Tank's Sound card.
 * Pressing it turns sounds on or off for the whole game and keeps the choice on the device
 * (src/platform/soundPlayer.ts). Turning sounds on plays a short sample in place of the button tap;
 * turning them off plays nothing (S15).
 */
import type * as Phaser from 'phaser';
import type { IconKind } from '../art/drawUi';
import type { BakedTextures } from '../art/textures';
import { SOUNDS_OFF_LABEL, soundsSwitchLabel } from '../logic/sounds';
import { TILE_BUTTON, tileButtonWidth } from '../logic/tankUi';
import { setSoundsOn, soundsAreOn } from '../platform/soundPlayer';
import { createButton, type UiButton } from './BootScene';

/** Body width of the sounds switch tile: wide enough for its longer label, "Sounds off". */
export const SOUNDS_SWITCH_W = tileButtonWidth(SOUNDS_OFF_LABEL);
/** Body height of the sounds switch tile. */
export const SOUNDS_SWITCH_H = TILE_BUTTON.h;

/** The sounds switch's icon for sounds `on`. */
export function soundsSwitchIcon(on: boolean): IconKind {
  return on ? 'soundsOn' : 'soundsOff';
}

/** Shows the current sounds state on `button`. */
export function showSoundsState(button: UiButton): void {
  const on = soundsAreOn();
  button.setLabel(soundsSwitchLabel(on), soundsSwitchIcon(on));
}

/** Turns sounds on or off and shows the new state on `button`. */
export function toggleSounds(button: UiButton): void {
  setSoundsOn(!soundsAreOn());
  showSoundsState(button);
}

/**
 * A labelled square sounds switch tile, showing the current state, that toggles sounds when pressed.
 * It plays no button tap: its own sample, or silence, says what it did (S15).
 */
export function createSoundsSwitch(scene: Phaser.Scene, baked: BakedTextures, dpr: number): UiButton {
  const on = soundsAreOn();
  const button: UiButton = createButton(scene, baked, {
    fill: 'secondary',
    shape: 'square',
    size: 1,
    width: SOUNDS_SWITCH_W,
    label: soundsSwitchLabel(on),
    icon: soundsSwitchIcon(on),
    dpr,
    pressOnDown: false,
    taps: false,
    onPress: () => toggleSounds(button),
  });
  return button;
}
