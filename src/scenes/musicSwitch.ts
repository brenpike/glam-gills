/**
 * The music switch (PRD M8): a button whose icon and words show whether music is on, on the title
 * screen, in the Home Tank and on the trip pause screen. Pressing it turns music on or off for the
 * whole game and keeps the choice on the device (src/platform/musicPlayer.ts).
 */
import type * as Phaser from 'phaser';
import type { IconKind } from '../art/drawUi';
import type { BakedTextures } from '../art/textures';
import { MUSIC_OFF_LABEL, musicSwitchLabel } from '../logic/music';
import { TILE_BUTTON, tileButtonWidth } from '../logic/tankUi';
import { musicIsOn, setMusicOn } from '../platform/musicPlayer';
import { createButton, type UiButton } from './BootScene';

/** Body width of the music switch tile: wide enough for its longer label, "Music off". */
export const MUSIC_SWITCH_W = tileButtonWidth(MUSIC_OFF_LABEL);
/** Body height of the music switch tile. */
export const MUSIC_SWITCH_H = TILE_BUTTON.h;

/** The music switch's icon for music `on`. */
export function musicSwitchIcon(on: boolean): IconKind {
  return on ? 'musicOn' : 'musicOff';
}

/** Shows the current music state on `button`. */
export function showMusicState(button: UiButton): void {
  const on = musicIsOn();
  button.setLabel(musicSwitchLabel(on), musicSwitchIcon(on));
}

/** Turns music on or off and shows the new state on `button`. */
export function toggleMusic(button: UiButton): void {
  setMusicOn(!musicIsOn());
  showMusicState(button);
}

/** A labelled square music switch tile, showing the current state, that toggles music when pressed. */
export function createMusicSwitch(scene: Phaser.Scene, baked: BakedTextures, dpr: number): UiButton {
  const on = musicIsOn();
  const button: UiButton = createButton(scene, baked, {
    fill: 'secondary',
    shape: 'square',
    size: 1,
    width: MUSIC_SWITCH_W,
    label: musicSwitchLabel(on),
    icon: musicSwitchIcon(on),
    dpr,
    pressOnDown: false,
    onPress: () => toggleMusic(button),
  });
  return button;
}
