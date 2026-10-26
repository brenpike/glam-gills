/**
 * Browser glue for the sounds switch (PRD S14; ADR 0026). Reads and writes only `SOUNDS_STORAGE_KEY` in
 * `localStorage`, outside the save, so "Start over" keeps it. Every storage access can throw (storage
 * turned off, blocked or full); a failed read counts as sounds on, and a failed write is ignored.
 */
import { SOUNDS_STORAGE_KEY, soundsSettingValue, parseSoundsSetting } from '../logic/sounds';

/** Whether sounds are on, from device storage: on at first launch or when storage cannot be read. */
export function readSoundsSetting(): boolean {
  try {
    return parseSoundsSetting(window.localStorage.getItem(SOUNDS_STORAGE_KEY));
  } catch {
    return true;
  }
}

/** Keeps sounds `on` in device storage. False when storage cannot be written. */
export function writeSoundsSetting(on: boolean): boolean {
  try {
    window.localStorage.setItem(SOUNDS_STORAGE_KEY, soundsSettingValue(on));
    return true;
  } catch {
    return false;
  }
}
