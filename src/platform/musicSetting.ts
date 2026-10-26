/**
 * Browser glue for the music switch (PRD M8; ADR 0025). Reads and writes only `MUSIC_STORAGE_KEY` in
 * `localStorage`, outside the save, so "Start over" keeps it. Every storage access can throw (storage
 * turned off, blocked or full); a failed read counts as music on, and a failed write is ignored.
 */
import { MUSIC_STORAGE_KEY, musicSettingValue, parseMusicSetting } from '../logic/music';

/** Whether music is on, from device storage: on at first launch or when storage cannot be read. */
export function readMusicSetting(): boolean {
  try {
    return parseMusicSetting(window.localStorage.getItem(MUSIC_STORAGE_KEY));
  } catch {
    return true;
  }
}

/** Keeps music `on` in device storage. False when storage cannot be written. */
export function writeMusicSetting(on: boolean): boolean {
  try {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, musicSettingValue(on));
    return true;
  } catch {
    return false;
  }
}
