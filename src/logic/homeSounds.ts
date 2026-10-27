/**
 * Pure rules for which Home Tank, book and menu sound plays (issue #167): a button press, the arrival
 * home, a restyle, a Surprise me press and a new area on the map. The scenes play the sound returned.
 */
import type { AreaMapEntry } from './areaMap';
import { WEARABLE_SLOTS, type DreamColourId } from './catalogue';
import type { Outfit } from './outfit';
import type { SoundId } from './sounds';
import type { StylerAction, StylerState } from './styler';
import { surpriseShown } from './stylerText';
import { tankKeyFor } from './tankUi';
import type { TripEndReason } from './tripEvents';

/** A button's sound options: whether it taps at all (on when missing) and whether its tap is the back sound. */
export interface ButtonSoundOptions {
  readonly taps?: boolean;
  readonly backTap?: boolean;
}

/** The sound a button press plays: none when the button does not tap, else back or tap (issue #167, ND-2). */
export function buttonPressSound(opts: Readonly<ButtonSoundOptions>): SoundId | null {
  if (opts.taps === false) return null;
  return opts.backTap === true ? 'back' : 'tap';
}

/** The sound arriving in the Home Tank after a trip ending for `reason` plays, or none (issue #167, ND-11). */
export function arrivalSound(reason: TripEndReason): SoundId | null {
  return reason === 'areaBeaten' ? null : 'arrive';
}

/** What a restyle can change that has a sound: the Dream colour worn (null for none) and the outfit. */
export interface RestyleWear {
  readonly dreamColour: DreamColourId | null;
  readonly outfit: Readonly<Outfit>;
}

/**
 * The sound a restyle from `before` to `after` plays (issue #167, ND-4, ND-5): the Dream colour sound
 * for a new Dream colour, else the wear-on sound when any slot holds a different Wearable, else the
 * take-off sound when any slot was emptied, else none.
 */
export function restyleSound(before: Readonly<RestyleWear>, after: Readonly<RestyleWear>): SoundId | null {
  if (after.dreamColour !== null && after.dreamColour !== before.dreamColour) return 'dreamColour';
  if (WEARABLE_SLOTS.some((slot) => after.outfit[slot] !== null && after.outfit[slot] !== before.outfit[slot])) return 'wearOn';
  if (WEARABLE_SLOTS.some((slot) => before.outfit[slot] !== null && after.outfit[slot] === null)) return 'wearOff';
  return null;
}

/**
 * Whether `action` on `state` presses Surprise me (issue #167, ND-10): a Surprise me press, or a
 * confirm key while Surprise me has the focus, only where Surprise me shows.
 */
export function surprisePressed(state: Readonly<StylerState>, action: Readonly<StylerAction>): boolean {
  if (!surpriseShown(state.mode, state.step)) return false;
  if (action.type === 'surprise') return true;
  return action.type === 'key' && state.focus.kind === 'surprise' && tankKeyFor(action.key, action.shiftKey) === 'confirm';
}

/** The area map's sound for `entries`: the unlock sound when an unlocked area is new, else none (issue #167, ND-9). */
export function newAreaSound(entries: readonly AreaMapEntry[]): SoundId | null {
  return entries.some((entry) => entry.isNew && !entry.locked) ? 'unlock' : null;
}
