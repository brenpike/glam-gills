/**
 * Pure sound effect rules (PRD N7, S1 to S16; ADR 0026; docs/sound-guide.md): the sound recipes and
 * their levels, the key each cue's sounds play in, the notes a recipe plays in a key, the repeat
 * limit, and the sounds switch's stored value and labels. The voices that play the notes are browser
 * glue in src/platform/audioVoices.ts, and src/platform/soundPlayer.ts plays a sound on the sounds bus.
 */
import { MUSIC_LEVELS, noteMidi, type MusicCue, type SoundKey } from './music';

/**
 * A sound the synth makes for a sound effect: the music's voices plus the sounds' own swoosh, puff,
 * glide, clay knock and glass chime (ADR 0026).
 */
export type SoundVoice =
  | 'kalimba'
  | 'marimba'
  | 'musicBox'
  | 'glass'
  | 'whistle'
  | 'firefly'
  | 'pluck'
  | 'strumPluck'
  | 'pad'
  | 'bubble'
  | 'boing'
  | 'woodBlock'
  | 'shaker'
  | 'swoosh'
  | 'puff'
  | 'glide'
  | 'clay';

/** Voices whose notes are steps of the key's scale (S12). The others are unpitched and never change with the key. */
export const PITCHED_SOUND_VOICES: readonly SoundVoice[] = Object.freeze([
  'kalimba',
  'marimba',
  'musicBox',
  'glass',
  'whistle',
  'firefly',
  'pluck',
  'strumPluck',
  'pad',
]);

/** A plucked string: ukulele, nylon guitar or plucked strings, as in the music. */
export type SoundPluck = 'ukulele' | 'guitar' | 'strings';

/** One note of a sound's recipe, timed from the sound's start. */
export interface SoundNote {
  voice: SoundVoice;
  /** Seconds after the sound starts, at least 0. */
  at: number;
  /** Loudness before the sound's level, above 0 and at most 1. */
  velocity: number;
  /**
   * Steps of the key's major pentatonic (section 3 of the sound guide): one for a note, or a chord
   * low to high for `strumPluck` and `pad`. Empty for an unpitched voice.
   */
  steps: readonly number[];
  /**
   * Seconds held or rung, for the voices that take it: the whistle and pad's hold, the glass chime's
   * ring, and the shaker, swoosh, puff and glide's length.
   */
  seconds?: number;
  /**
   * An unpitched voice's pitches in Hz: the bubble's start (random when absent), the boing's low,
   * high and end, the wood block's base, the swoosh's and glide's from and to, the puff's top.
   */
  hz?: readonly number[];
  /** The swoosh's band width (filter Q). */
  q?: number;
  /** The glide's wave shape. */
  wave?: 'sine' | 'triangle';
  /** The glide's wobble, in Hz. */
  wobble?: number;
  /** The plucked string of `pluck` and `strumPluck`. */
  pluck?: SoundPluck;
  /** Seconds between the strings of a `strumPluck`, low to high. */
  gap?: number;
}

/** A note to play: a recipe note with its steps turned into MIDI numbers in a key. */
export interface PlayedSoundNote extends Omit<SoundNote, 'steps'> {
  /** MIDI numbers, low to high; empty for an unpitched voice. */
  midis: readonly number[];
}

/** One version of a sound (such as a rarity or a count): its notes, its level and its length. */
export interface SoundVersion {
  /**
   * The sound's level in dB of gain, set by measuring it so it lands at its kind's loudness target
   * (S13; docs/sound-guide.md, section 4).
   */
  levelDb: number;
  /** Seconds from the start until the sound has rung out. */
  seconds: number;
  notes: readonly SoundNote[];
}

/** The id of every sound. */
export type SoundId = 'tap' | 'soundsOn';

/** The version of a sound that has only one. */
export const ONLY_VERSION = 'only';

/** A sound: whether it is a touch sound (3 dB under the event sounds, S13) and its versions by name. */
export interface SoundRecipe {
  id: SoundId;
  touch: boolean;
  versions: Readonly<Record<string, Readonly<SoundVersion>>>;
}

function only(levelDb: number, seconds: number, notes: readonly SoundNote[]): Readonly<Record<string, Readonly<SoundVersion>>> {
  return Object.freeze({ [ONLY_VERSION]: Object.freeze({ levelDb, seconds, notes: Object.freeze(notes.map((n) => Object.freeze(n))) }) });
}

/**
 * Every sound's recipe by id (docs/sound-guide.md, section 5), ported from the approved sketches
 * (prototypes/sound-effects/sketches.html) with their measured levels.
 */
export const SOUNDS: Readonly<Record<SoundId, Readonly<SoundRecipe>>> = Object.freeze({
  /** A soft bubble with a light wood tick, on every button press (S15). */
  tap: Object.freeze({
    id: 'tap',
    touch: true,
    versions: only(19, 0.12, [
      { voice: 'bubble', at: 0, velocity: 0.07, steps: [], hz: [700] },
      { voice: 'woodBlock', at: 0, velocity: 0.035, steps: [], hz: [880 * 1.3] },
    ]),
  }),
  /** Two kalimba notes up, when the sounds switch turns sounds on, so the player hears the level (S15). */
  soundsOn: Object.freeze({
    id: 'soundsOn',
    touch: false,
    versions: only(2, 0.3, [
      { voice: 'kalimba', at: 0, velocity: 0.14, steps: [2] },
      { voice: 'kalimba', at: 0.08, velocity: 0.16, steps: [5] },
    ]),
  }),
});

/** Loudness targets, K-weighted over a sound's loudest 0.2 seconds (S13; docs/sound-guide.md, section 4). */
export const SOUND_TARGETS = Object.freeze({
  event: -18,
  /** Touch sounds sit 3 dB under the event sounds. */
  touch: -21,
});

/** The loudness `recipe` is measured to: the touch target for a touch sound, the event target otherwise. */
export function soundTarget(recipe: Readonly<SoundRecipe>): number {
  return recipe.touch ? SOUND_TARGETS.touch : SOUND_TARGETS.event;
}

/** Sound levels and timing (PRD Tuning values; S1, S13). */
export const SOUND_LEVELS = Object.freeze({
  /** The sounds bus's volume, of full: the same as the music's master volume (S13). */
  bus: MUSIC_LEVELS.master,
  /** The sounds' send to the shared room reverb (the music's is 0.32). */
  reverbSend: 0.18,
  /** Seconds after it is asked for that a sound starts. */
  startDelayS: 0.02,
  /** The same sound (and version) plays at most once in this many seconds (S13). */
  repeatS: 0.06,
});

/** The key of the sounds while `cue` plays, or would play with music off (S12). */
export function soundKeyFor(cue: Readonly<MusicCue>): SoundKey {
  return cue.soundKey;
}

/** The major pentatonic, in semitones above the home note. */
const PENTATONIC: readonly number[] = Object.freeze([0, 2, 4, 7, 9]);

/**
 * The MIDI number of scale step `step` in `key` (docs/sound-guide.md, section 3): step 0 is the home
 * note in octave 5 (G5, F5 or D5), step 5 an octave up, step −5 an octave down.
 */
export function scaleMidi(key: SoundKey, step: number): number {
  if (!Number.isInteger(step)) throw new Error(`sounds: scale step ${step} is not a whole number`);
  const octave = Math.floor(step / PENTATONIC.length);
  const degree = step - octave * PENTATONIC.length;
  return noteMidi(`${key}5`) + octave * 12 + PENTATONIC[degree];
}

/** The home chord: the home note, its third and its fifth, an octave down (steps −5, −3, −2). */
export const HOME_CHORD_STEPS: readonly number[] = Object.freeze([-5, -3, -2]);

/** Whether MIDI number `midi` is a note of `key`'s major pentatonic, in any octave. */
export function inSoundKey(key: SoundKey, midi: number): boolean {
  const above = (((midi - noteMidi(`${key}5`)) % 12) + 12) % 12;
  return PENTATONIC.includes(above);
}

/** Version `version` of sound `id`. Throws for a version the sound does not have. */
export function soundVersion(id: SoundId, version: string = ONLY_VERSION): Readonly<SoundVersion> {
  const found = SOUNDS[id].versions[version];
  if (found === undefined) throw new Error(`sounds: sound ${id} has no version ${version}`);
  return found;
}

/** The notes version `version` of sound `id` plays in `key`, with every scale step turned into a MIDI number (S12). */
export function soundNotes(id: SoundId, version: string, key: SoundKey): PlayedSoundNote[] {
  return soundVersion(id, version).notes.map(({ steps, ...rest }) => ({
    ...rest,
    midis: steps.map((step) => scaleMidi(key, step)),
  }));
}

/** A level in dB as a gain. */
export function soundGain(levelDb: number): number {
  return Math.pow(10, levelDb / 20);
}

/** The key the repeat limit keeps the last start time of: the sound and its version. */
export function repeatKey(id: SoundId, version: string): string {
  return `${id}:${version}`;
}

/**
 * The repeat limit (S13): whether a sound last started at `lastAt` seconds (undefined if never) may
 * start again at `now`.
 */
export function passesRepeatLimit(lastAt: number | undefined, now: number): boolean {
  return lastAt === undefined || now - lastAt >= SOUND_LEVELS.repeatS;
}

/** Device storage key of the sounds switch, outside the save so "Start over" keeps it (S14; ADR 0026). */
export const SOUNDS_STORAGE_KEY = 'glam-gills:sounds';

/** Stored value of the sounds switch. */
export type SoundsSettingValue = 'on' | 'off';

/** Whether sounds are on, from the stored value: on unless it says `'off'`, so on at first launch (S14). */
export function parseSoundsSetting(raw: string | null): boolean {
  return raw !== 'off';
}

/** The stored value for sounds `on`. */
export function soundsSettingValue(on: boolean): SoundsSettingValue {
  return on ? 'on' : 'off';
}

/** Label of the sounds switch while sounds are on. */
export const SOUNDS_ON_LABEL = 'Sounds on';
/** Label of the sounds switch while sounds are off. */
export const SOUNDS_OFF_LABEL = 'Sounds off';

/** The sounds switch's label for sounds `on` (S14): it names the state. */
export function soundsSwitchLabel(on: boolean): string {
  return on ? SOUNDS_ON_LABEL : SOUNDS_OFF_LABEL;
}
