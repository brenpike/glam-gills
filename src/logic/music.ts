/**
 * Pure background music rules (PRD N6, M1 to M12; ADR 0025; docs/music-guide.md): cue data, the
 * arrangement that turns a cue, a step and a seed into the notes to play, the cue each screen plays,
 * the music switch's stored value and labels, and the music levels. The synth that plays the notes is
 * browser glue in src/platform/musicPlayer.ts. Nothing here reads danger, legs or trip state (M5).
 */
import { mulberry32 } from './rng';

/** A part of a cue, which the synth can mix on its own. */
export type MusicPart = 'tune' | 'chords' | 'bass' | 'percussion' | 'sparkles';

/** A sound the synth makes (docs/music-guide.md, section 2). */
export type MusicVoice = 'kalimba' | 'whistle' | 'ukulele' | 'bass' | 'tap' | 'shaker' | 'bubble';

/** One note to play, timed from the start of its step. */
export interface MusicNote {
  voice: MusicVoice;
  part: MusicPart;
  /** Seconds after the step starts, at least 0 (swing and strums play a little late). */
  at: number;
  /** MIDI note number; null for an unpitched voice (tap, shaker). */
  midi: number | null;
  /** Loudness, above 0 and at most 1. */
  velocity: number;
  /** Seconds the note is held; plucked and struck voices ring on by themselves. */
  duration: number;
}

/** A chord: its name, its notes as MIDI numbers (low to high), and its bass root. */
export interface MusicChord {
  name: string;
  notes: readonly number[];
  root: number;
}

/** A tune note: its step in the bar, its MIDI number, and its length in steps. */
export interface TuneNote {
  step: number;
  midi: number;
  len: number;
}

/**
 * A cue: an 8-bar loop (docs/music-guide.md, sections 3 and 4). Each bar holds one chord, or two
 * split at the half bar. A step is one subdivision of a beat; `swing` delays every odd step by that
 * fraction of a step.
 */
export interface MusicCue {
  id: string;
  name: string;
  key: string;
  bpm: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  swing: number;
  bars: readonly (readonly MusicChord[])[];
  tune: readonly (readonly TuneNote[])[];
}

/** Where the player is, for choosing a cue (M1, M2). */
export type MusicScreen = 'title' | 'homeTank' | 'creator' | 'areaMap' | 'refuge' | 'trip';

const LETTERS: Readonly<Record<string, number>> = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

/** The MIDI number of a note name such as `'F#5'` or `'Bb2'` (C4 is 60). Throws for a bad name. */
export function noteMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (match === null) throw new Error(`music: bad note name ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + LETTERS[match[1]] + accidental;
}

function chord(name: string, notes: string, root: string): MusicChord {
  return Object.freeze({ name, notes: Object.freeze(notes.split(' ').map(noteMidi)), root: noteMidi(root) });
}

function bar(...chords: MusicChord[]): readonly MusicChord[] {
  return Object.freeze(chords);
}

function tuneBar(...notes: [number, string, number][]): readonly TuneNote[] {
  return Object.freeze(notes.map(([step, name, len]) => Object.freeze({ step, midi: noteMidi(name), len })));
}

/** Id of the Home cue. */
export const SUNNY_TANK_ID = 'sunny-tank';

const G = chord('G', 'G3 B3 D4', 'G2');
const D = chord('D', 'F#3 A3 D4', 'D3');

/**
 * Sunny Tank, the Home cue (M1): cozy but happy, G major, 96 bpm swung 4/4, a kalimba tune over a
 * ukulele strum (docs/music-guide.md, section 4; prototypes/music/sketches.html).
 */
export const SUNNY_TANK: Readonly<MusicCue> = Object.freeze({
  id: SUNNY_TANK_ID,
  name: 'Sunny Tank',
  key: 'G major',
  bpm: 96,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0.16,
  bars: Object.freeze([
    bar(G),
    bar(chord('Bm', 'F#3 B3 D4', 'B2')),
    bar(chord('C', 'G3 C4 E4', 'C3')),
    bar(D),
    bar(G),
    bar(chord('E7', 'G#3 B3 D4 E4', 'E2')),
    bar(chord('Am', 'A3 C4 E4', 'A2'), chord('Cm', 'G3 C4 Eb4', 'C3')),
    bar(G, D),
  ]),
  tune: Object.freeze([
    tuneBar([0, 'B4', 1], [1, 'D5', 1], [2, 'G5', 3], [5, 'F#5', 1], [6, 'G5', 2]),
    tuneBar([0, 'F#5', 2], [2, 'D5', 2], [4, 'B4', 3], [7, 'D5', 1]),
    tuneBar([0, 'E5', 1], [1, 'E5', 1], [2, 'G5', 2], [4, 'E5', 2], [6, 'C5', 2]),
    tuneBar([0, 'D5', 4], [4, 'A4', 2], [6, 'B4', 1], [7, 'C5', 1]),
    tuneBar([0, 'B4', 1], [1, 'D5', 1], [2, 'G5', 3], [5, 'A5', 1], [6, 'B5', 2]),
    tuneBar([0, 'G#5', 2], [2, 'E5', 2], [4, 'D5', 2], [6, 'B4', 2]),
    tuneBar([0, 'C5', 2], [2, 'E5', 2], [4, 'Eb5', 2], [6, 'C5', 2]),
    tuneBar([0, 'B4', 2], [2, 'G4', 2], [4, 'A4', 4]),
  ]),
});

/** Every cue by id. */
export const MUSIC_CUES: Readonly<Record<string, Readonly<MusicCue>>> = Object.freeze({ [SUNNY_TANK_ID]: SUNNY_TANK });

/**
 * The cue `screen` plays: the Home cue on the Home side (M1). Trips play it too until the habitat
 * cues are built (issue #153, M2).
 */
export function musicCueFor(screen: MusicScreen): Readonly<MusicCue> {
  switch (screen) {
    case 'title':
    case 'homeTank':
    case 'creator':
    case 'areaMap':
    case 'refuge':
    case 'trip':
      return SUNNY_TANK;
    default: {
      const unhandled: never = screen;
      throw new Error(`music: no cue for screen ${String(unhandled)}`);
    }
  }
}

/** Seconds in one step of `cue`. */
export function stepSeconds(cue: Readonly<MusicCue>): number {
  return 60 / cue.bpm / cue.stepsPerBeat;
}

/** Steps in one bar of `cue`. */
export function stepsPerBar(cue: Readonly<MusicCue>): number {
  return cue.beatsPerBar * cue.stepsPerBeat;
}

/** Steps in one pass of `cue`'s loop. */
export function stepsPerLoop(cue: Readonly<MusicCue>): number {
  return stepsPerBar(cue) * cue.bars.length;
}

/** Where a step falls: its pass of the loop, its bar, its step in the bar, and the chord sounding. */
export interface StepPlace {
  pass: number;
  bar: number;
  step: number;
  chord: MusicChord;
  /** Whether a chord starts on this step (the bar's first step, or the half bar of a split bar). */
  chordStarts: boolean;
}

/** Where step `index` (0 or more, counted from the cue's start) of `cue` falls. */
export function stepPlace(cue: Readonly<MusicCue>, index: number): StepPlace {
  const perBar = stepsPerBar(cue);
  const pass = Math.floor(index / stepsPerLoop(cue));
  const barIndex = Math.floor(index / perBar) % cue.bars.length;
  const step = index % perBar;
  const chords = cue.bars[barIndex];
  const split = chords.length === 2;
  const second = split && step >= perBar / 2;
  return {
    pass,
    bar: barIndex,
    step,
    chord: second ? chords[1] : chords[0],
    chordStarts: step === 0 || (split && step === perBar / 2),
  };
}

/** A seeded draw for one step: the same seed, pass, bar and step always give the same numbers (M10). */
function stepRandom(seed: number, place: StepPlace): () => number {
  const mixed = Math.imul(seed | 0, 0x9e3779b1) + place.pass * 977 + place.bar * 131 + place.step * 17;
  return mulberry32(mixed >>> 0);
}

/** The key's major pentatonic steps above its tonic, for made-up phrases and sparkles. */
const PENTATONIC: readonly number[] = Object.freeze([0, 2, 4, 7, 9, 12]);
/** Seconds between the notes of a strum, low to high. */
const STRUM_SPREAD_S = 0.014;
/** How much quieter each higher string of a strum is. */
const STRUM_FADE = 0.08;

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

function note(voice: MusicVoice, part: MusicPart, midi: number | null, velocity: number, duration: number, at = 0): MusicNote {
  return { voice, part, at, midi, velocity, duration };
}

/** A strum of `notes` on `voice`, low to high, each string a little later and softer. */
function strum(voice: MusicVoice, notes: readonly number[], velocity: number, duration: number, at: number): MusicNote[] {
  return notes.map((midi, i) => note(voice, 'chords', midi, velocity * (1 - i * STRUM_FADE), duration, at + i * STRUM_SPREAD_S));
}

/** A bubble pop, its pitch drawn from `random`. */
function bubble(random: () => number, velocity: number, at: number): MusicNote {
  return note('bubble', 'sparkles', 72 + Math.floor(random() * 7), velocity, 0.08, at);
}

/**
 * Sunny Tank's arrangement for one step (docs/music-guide.md, sections 3 and 4). Each pass of four
 * changes: the kalimba tune; then a whistle joins an octave up; then a low harmony; then a made-up
 * kalimba phrase while the tune rests.
 */
function arrangeSunnyTank(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const { bar: barIndex, step, chord: sounding } = place;
  const up = sounding.notes.map((midi) => midi + 12);
  if (step === 0 || step === 4) {
    const fifth = step === 4 && random() < 0.4;
    notes.push(note('bass', 'bass', sounding.root + (fifth ? 7 : 0), step === 0 ? 0.34 : 0.26, stepS * 3, at));
  }
  if (step === 3 || step === 7) notes.push(note('bass', 'bass', sounding.root + 12, 0.1, stepS, at));
  if (step === 2 || step === 6) {
    notes.push(...strum('ukulele', up, 0.14, 0.9, at));
    notes.push(note('tap', 'percussion', null, 0.12, 0.04, at));
  } else if (step % 2 === 1) {
    notes.push(...strum('ukulele', up.slice(1), 0.05, 0.9, at));
  }
  if (step % 2 === 1) notes.push(note('shaker', 'percussion', null, 0.022, 0.05, at));
  const pass = place.pass % 4;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  if (hit !== undefined && pass !== 3) {
    notes.push(note('kalimba', 'tune', hit.midi, 0.3, 1.3, at));
    if (pass === 1) notes.push(note('whistle', 'tune', hit.midi + 12, 0.045, hit.len * stepS, at));
    if (pass === 2 && step % 4 === 0) notes.push(note('kalimba', 'tune', hit.midi - 5, 0.1, 1.3, at));
  }
  if (pass === 3 && step % 2 === 0 && random() < 0.5) {
    notes.push(note('kalimba', 'tune', noteMidi('G5') + pick(random, PENTATONIC), 0.16, 1.3, at));
  }
  if ((barIndex === 3 || barIndex === 7) && step === 7) notes.push(bubble(random, 0.07, at));
  else if (random() < 0.03) notes.push(bubble(random, 0.05, at));
  return notes;
}

/**
 * The notes `cue` plays on step `index` (0 or more, from the cue's start), with `seed` choosing each
 * pass's small changes (M10). Odd steps swing late by `cue.swing` of a step. Throws for a cue with no
 * arrangement.
 */
export function arrangeStep(cue: Readonly<MusicCue>, index: number, seed: number): MusicNote[] {
  const place = stepPlace(cue, index);
  const random = stepRandom(seed, place);
  const at = place.step % 2 === 1 ? stepSeconds(cue) * cue.swing : 0;
  if (cue.id === SUNNY_TANK_ID) return arrangeSunnyTank(cue, place, random, at);
  throw new Error(`music: no arrangement for cue ${cue.id}`);
}

/** Device storage key of the music switch, outside the save so "Start over" keeps it (M8; ADR 0025). */
export const MUSIC_STORAGE_KEY = 'glam-gills:music';

/** Stored value of the music switch. */
export type MusicSettingValue = 'on' | 'off';

/** Whether music is on, from the stored value: on unless it says `'off'`, so on at first launch (M8). */
export function parseMusicSetting(raw: string | null): boolean {
  return raw !== 'off';
}

/** The stored value for music `on`. */
export function musicSettingValue(on: boolean): MusicSettingValue {
  return on ? 'on' : 'off';
}

/** Label of the music switch while music is on. */
export const MUSIC_ON_LABEL = 'Music on';
/** Label of the music switch while music is off. */
export const MUSIC_OFF_LABEL = 'Music off';

/** The music switch's label for music `on` (M8): it names the state. */
export function musicSwitchLabel(on: boolean): string {
  return on ? MUSIC_ON_LABEL : MUSIC_OFF_LABEL;
}

/** Music levels and fades (PRD Tuning values; M7, M9, M11). */
export const MUSIC_LEVELS = Object.freeze({
  /** Master volume, of full: the sketches' slider at 60. */
  master: 0.32,
  /** Volume while a trip is paused, of the master. */
  paused: 0.5,
  /** Seconds a change of cue cross-fades. */
  crossFadeS: 1,
  /** Seconds the music fades in after the first input. */
  fadeInS: 1.5,
  /** Seconds the music fades out or back in when switched off or on, or paused. */
  switchFadeS: 0.3,
});
