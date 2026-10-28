/**
 * Pure background music rules (PRD N6, M1 to M12; ADR 0025; docs/music-guide.md): cue data, the
 * arrangement that turns a cue, a step and a seed into the notes to play, the cue each screen plays,
 * the music switch's stored value and labels, and the music levels. The synth that plays the notes is
 * browser glue in src/platform/musicPlayer.ts. Nothing here reads danger, legs or trip state (M5).
 */
import { CANAL_HABITAT, CHINAMPA_HABITAT, POND_HABITAT, SPRING_CAVE_HABITAT, areaTimeOfDay, type AreaData } from './areas';
import { mulberry32 } from './rng';

/** A part of a cue, which the synth can mix on its own. */
export type MusicPart = 'tune' | 'chords' | 'bass' | 'percussion' | 'sparkles';

/** A sound the synth makes (docs/music-guide.md, section 2). */
export type MusicVoice =
  | 'kalimba'
  | 'marimba'
  | 'musicBox'
  | 'whistle'
  | 'ukulele'
  | 'guitar'
  | 'strings'
  | 'strum'
  | 'pad'
  | 'bass'
  | 'tap'
  | 'shaker'
  | 'kick'
  | 'slap'
  | 'guiro'
  | 'woodBlock'
  | 'bubble'
  | 'boing'
  | 'firefly'
  | 'glass'
  | 'drip';

/** Voices with no pitch: their notes carry a null MIDI number. A drip's fall is the synth's. */
export const UNPITCHED_VOICES: readonly MusicVoice[] = Object.freeze(['tap', 'shaker', 'kick', 'slap', 'guiro', 'boing', 'drip']);

/** Drum voices, which a dusk version never plays (M4). A faint shaker is not a drum. */
export const DRUM_VOICES: readonly MusicVoice[] = Object.freeze(['tap', 'kick', 'slap', 'guiro', 'woodBlock']);

/** One note to play, timed from the start of its step. */
export interface MusicNote {
  voice: MusicVoice;
  part: MusicPart;
  /** Seconds after the step starts, at least 0 (swing and strums play a little late). */
  at: number;
  /** MIDI note number; null for an unpitched voice (UNPITCHED_VOICES). */
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

/** How a cue is played: its own day arrangement, or the shared dusk rule (M4). */
export type MusicVersion = 'day' | 'dusk';

/** A habitat cue's dusk tempo and swing (PRD Tuning values). */
export interface DuskPace {
  bpm: number;
  swing: number;
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
  /**
   * Letter name of the key's home note, such as `'F'`, or for a mode its major key's, such as `'D'`
   * for E dorian; fireflies chime from its pentatonic notes.
   */
  tonic: string;
  /**
   * The key of the sounds while this cue plays, or would play with music off (PRD S12; ADR 0026):
   * pitched sounds use its major pentatonic. A dusk version keeps its day cue's.
   */
  soundKey: SoundKey;
  bpm: number;
  beatsPerBar: number;
  stepsPerBeat: number;
  swing: number;
  bars: readonly (readonly MusicChord[])[];
  tune: readonly (readonly TuneNote[])[];
  version: MusicVersion;
  /** A habitat cue's dusk pace, which its dusk version plays at; absent for the Home cue. */
  dusk?: Readonly<DuskPace>;
  /** For a dusk version, the id of the day cue it is made from. */
  dayId?: string;
  /**
   * How much of the cue goes to the music's echo, above 0 and at most 1; absent for no echo, so
   * only the shared room reverb. A dusk version keeps its day cue's.
   */
  echo?: number;
}

/** The home note of a sounds key: sounds play the major pentatonic on it (PRD S12; docs/sound-guide.md, section 3). */
export type SoundKey = 'G' | 'F' | 'D';

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
  tonic: 'G',
  soundKey: 'G',
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
  version: 'day',
});

/** Id of the canal's cue. */
export const CANAL_PADDLE_ID = 'canal-paddle';

const C = chord('C', 'G3 C4 E4', 'C3');

/**
 * Canal Paddle, the canal's cue (M3): bouncy and friendly, G major in a 6/8 lilt at 68 dotted-quarter
 * beats a minute, a marimba tune over strummed chords, with a 1-2 3-4 5-6 flip in bars 4 and 8.
 */
export const CANAL_PADDLE: Readonly<MusicCue> = Object.freeze({
  id: CANAL_PADDLE_ID,
  name: 'Canal Paddle',
  key: 'G major',
  tonic: 'G',
  soundKey: 'G',
  bpm: 68,
  beatsPerBar: 2,
  stepsPerBeat: 3,
  swing: 0,
  bars: Object.freeze([
    bar(G),
    bar(C),
    bar(D),
    bar(G),
    bar(C),
    bar(G),
    bar(chord('Am', 'A3 C4 E4', 'A2'), D),
    bar(G),
  ]),
  tune: Object.freeze([
    tuneBar([0, 'D5', 2], [2, 'B4', 1], [3, 'D5', 2], [5, 'G5', 1]),
    tuneBar([0, 'E5', 2], [2, 'C5', 1], [3, 'E5', 2], [5, 'G5', 1]),
    tuneBar([0, 'F#5', 1], [1, 'E5', 1], [2, 'D5', 1], [3, 'C5', 1], [4, 'B4', 1], [5, 'A4', 1]),
    tuneBar([0, 'B4', 3], [3, 'G4', 3]),
    tuneBar([0, 'E5', 2], [2, 'E5', 1], [3, 'G5', 2], [5, 'E5', 1]),
    tuneBar([0, 'D5', 2], [2, 'B4', 1], [3, 'G4', 2], [5, 'B4', 1]),
    tuneBar([0, 'C5', 1], [1, 'B4', 1], [2, 'A4', 1], [3, 'F#4', 1], [4, 'A4', 1], [5, 'C5', 1]),
    tuneBar([0, 'B4', 2], [2, 'A4', 1], [3, 'G4', 3]),
  ]),
  version: 'day',
  dusk: Object.freeze({ bpm: 54, swing: 0 }),
});

/** Id of the lily pad pond's cue. */
export const LILY_PAD_HOP_ID = 'lily-pad-hop';

const F = chord('F', 'F3 A3 C4', 'F2');

/**
 * Lily Pad Hop, the lily pad pond's cue (M3): leaps like a frog, F major at 104 bpm, a flute-like
 * whistle tune over plucked strings going oom-pah, wood block ticks, and a boing at phrase ends.
 */
export const LILY_PAD_HOP: Readonly<MusicCue> = Object.freeze({
  id: LILY_PAD_HOP_ID,
  name: 'Lily Pad Hop',
  key: 'F major',
  tonic: 'F',
  soundKey: 'F',
  bpm: 104,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0,
  bars: Object.freeze([
    bar(F),
    bar(chord('Dm', 'F3 A3 D4', 'D3')),
    bar(chord('Gm', 'G3 Bb3 D4', 'G2')),
    bar(C),
    bar(F),
    bar(chord('A7', 'G3 C#4 E4', 'A2')),
    bar(chord('Bb', 'F3 Bb3 D4', 'Bb2'), C),
    bar(F),
  ]),
  tune: Object.freeze([
    tuneBar([0, 'C5', 1], [1, 'F5', 1], [2, 'A5', 2], [4, 'G5', 1], [5, 'F5', 1], [6, 'C5', 2]),
    tuneBar([0, 'D5', 1], [1, 'F5', 1], [2, 'A5', 2], [4, 'F5', 2], [6, 'D5', 2]),
    tuneBar([0, 'Bb4', 1], [1, 'D5', 1], [2, 'G5', 2], [4, 'F5', 1], [5, 'D5', 1], [6, 'Bb4', 2]),
    tuneBar([0, 'C5', 2], [2, 'E5', 2], [4, 'G5', 4]),
    tuneBar([0, 'C5', 1], [1, 'F5', 1], [2, 'A5', 2], [4, 'C6', 2], [6, 'A5', 2]),
    tuneBar([0, 'C#5', 1], [1, 'E5', 1], [2, 'A5', 2], [4, 'G5', 2], [6, 'E5', 2]),
    tuneBar([0, 'D5', 2], [2, 'F5', 2], [4, 'E5', 2], [6, 'G5', 2]),
    tuneBar([0, 'F5', 3], [3, 'C5', 1], [4, 'F5', 4]),
  ]),
  version: 'day',
  dusk: Object.freeze({ bpm: 80, swing: 0.12 }),
});

/** Id of the chinampa gardens' cue. */
export const GARDEN_BOATS_ID = 'garden-boats';

const D_LOW = chord('D', 'F#3 A3 D4', 'D2');

/**
 * Garden Boats, the chinampa gardens' cue (M3): a sunny adventure, D mixolydian at 112 bpm on a
 * 3-3-2 beat, a marimba tune over nylon guitar strums, guiro scrapes, and a soft box-drum slap.
 */
export const GARDEN_BOATS: Readonly<MusicCue> = Object.freeze({
  id: GARDEN_BOATS_ID,
  name: 'Garden Boats',
  key: 'D mixolydian',
  tonic: 'D',
  soundKey: 'D',
  bpm: 112,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0.06,
  bars: Object.freeze([
    bar(D_LOW),
    bar(chord('C', 'E3 G3 C4', 'C3')),
    bar(G),
    bar(D_LOW),
    bar(chord('Bm', 'F#3 B3 D4', 'B2')),
    bar(G),
    bar(chord('Em', 'G3 B3 E4', 'E2'), chord('A', 'E3 A3 C#4', 'A2')),
    bar(D_LOW),
  ]),
  tune: Object.freeze([
    tuneBar([0, 'A4', 1], [1, 'D5', 1], [3, 'F#5', 2], [5, 'E5', 1], [6, 'D5', 2]),
    tuneBar([0, 'E5', 1], [1, 'G5', 1], [3, 'E5', 2], [5, 'D5', 1], [6, 'C5', 2]),
    tuneBar([0, 'B4', 1], [1, 'D5', 1], [3, 'G5', 2], [5, 'F#5', 1], [6, 'E5', 1], [7, 'D5', 1]),
    tuneBar([0, 'F#5', 3], [3, 'A5', 3], [6, 'F#5', 2]),
    tuneBar([0, 'F#5', 1], [1, 'F#5', 1], [3, 'D5', 2], [5, 'B4', 1], [6, 'D5', 2]),
    tuneBar([0, 'G5', 1], [1, 'F#5', 1], [3, 'E5', 2], [5, 'D5', 1], [6, 'B4', 2]),
    tuneBar([0, 'E5', 2], [2, 'G5', 2], [4, 'E5', 1], [5, 'C#5', 1], [6, 'A4', 2]),
    tuneBar([0, 'D5', 3], [3, 'A4', 1], [4, 'D5', 4]),
  ]),
  version: 'day',
  dusk: Object.freeze({ bpm: 86, swing: 0.12 }),
});

/** Id of the spring cave's cue. */
export const CENOTE_GLOW_ID = 'cenote-glow';

const EM9 = chord('Em9', 'E3 G3 B3 F#4', 'E2');
const A_OPEN = chord('A', 'E3 A3 C#4', 'A2');
const CMAJ7 = chord('Cmaj7', 'G3 B3 C4 E4', 'C3');

/**
 * Cenote Glow, the spring cave's cue (M3): calm and full of wonder, never spooky, E dorian at 66 bpm
 * in a slow, straight 4/4, glass bells over a soft pad and a deep bass, water drips, and an echo
 * (prototypes/music/sketches.html). E dorian uses D major's notes, so the sounds play in D.
 */
export const CENOTE_GLOW: Readonly<MusicCue> = Object.freeze({
  id: CENOTE_GLOW_ID,
  name: 'Cenote Glow',
  key: 'E dorian',
  tonic: 'D',
  soundKey: 'D',
  bpm: 66,
  beatsPerBar: 4,
  stepsPerBeat: 2,
  swing: 0,
  bars: Object.freeze([bar(EM9), bar(A_OPEN), bar(CMAJ7), bar(D_LOW), bar(EM9), bar(A_OPEN), bar(CMAJ7), bar(D_LOW)]),
  tune: Object.freeze([
    tuneBar([0, 'B4', 4], [4, 'E5', 4]),
    tuneBar([0, 'C#5', 6], [6, 'E5', 2]),
    tuneBar([0, 'G5', 4], [4, 'F#5', 2], [6, 'E5', 2]),
    tuneBar([0, 'F#5', 8]),
    tuneBar([0, 'B4', 4], [4, 'E5', 2], [6, 'F#5', 2]),
    tuneBar([0, 'A5', 4], [4, 'G5', 2], [6, 'F#5', 2]),
    tuneBar([0, 'E5', 4], [4, 'G5', 4]),
    tuneBar([0, 'F#5', 4], [4, 'D5', 4]),
  ]),
  version: 'day',
  dusk: Object.freeze({ bpm: 52, swing: 0 }),
  echo: 0.4,
});

/**
 * The dusk version of habitat cue `cue` (the dusk rule, M4): the same tune and chords at the cue's
 * dusk pace, played by the shared dusk arrangement. Throws for a cue with no dusk pace (the Home cue)
 * or one that is already a dusk version.
 */
export function duskVersion(cue: Readonly<MusicCue>): Readonly<MusicCue> {
  if (cue.version !== 'day' || cue.dusk === undefined) throw new Error(`music: no dusk version of cue ${cue.id}`);
  const { dusk, ...rest } = cue;
  return Object.freeze({
    ...rest,
    id: `${cue.id}-dusk`,
    name: `${cue.name} (dusk)`,
    bpm: dusk.bpm,
    swing: dusk.swing,
    version: 'dusk',
    dayId: cue.id,
  });
}

/** Each habitat's cue, by habitat id (M3). A new habitat adds its own here. */
export const HABITAT_CUES: Readonly<Record<string, Readonly<MusicCue>>> = Object.freeze({
  [CANAL_HABITAT.id]: CANAL_PADDLE,
  [POND_HABITAT.id]: LILY_PAD_HOP,
  [CHINAMPA_HABITAT.id]: GARDEN_BOATS,
  [SPRING_CAVE_HABITAT.id]: CENOTE_GLOW,
});

/** Each habitat cue's dusk version, by the day cue's id, made once so the same version is reused. */
const DUSK_CUES: Readonly<Record<string, Readonly<MusicCue>>> = Object.freeze(
  Object.fromEntries(Object.values(HABITAT_CUES).map((cue) => [cue.id, duskVersion(cue)])),
);

/** Every cue by id, dusk versions included. */
export const MUSIC_CUES: Readonly<Record<string, Readonly<MusicCue>>> = Object.freeze(
  Object.fromEntries(
    [SUNNY_TANK, ...Object.values(HABITAT_CUES), ...Object.values(DUSK_CUES)].map((cue) => [cue.id, cue]),
  ),
);

/** What the music rule reads of an area: its habitat and its look (M2, M4). */
export type MusicArea = Pick<AreaData, 'habitatId' | 'look'>;

/**
 * The cue a trip to `area` plays (M2, M4): its habitat's cue, in the dusk version when the area's
 * look is dusk or night. Throws for a habitat with no cue (M3 makes that a test failure).
 */
export function tripCueFor(area: Readonly<MusicArea>): Readonly<MusicCue> {
  const cue = HABITAT_CUES[area.habitatId];
  if (cue === undefined) throw new Error(`music: no cue for habitat ${area.habitatId}`);
  return areaTimeOfDay(area) === 'day' ? cue : DUSK_CUES[cue.id];
}

/**
 * The cue `screen` plays: the Home cue on the Home side (M1), and on a trip the cue for `area`
 * (M2, M4). A trip with no area, which the game never starts, plays the Home cue.
 */
export function musicCueFor(screen: MusicScreen, area?: Readonly<MusicArea>): Readonly<MusicCue> {
  switch (screen) {
    case 'title':
    case 'homeTank':
    case 'creator':
    case 'areaMap':
    case 'refuge':
      return SUNNY_TANK;
    case 'trip':
      return area === undefined ? SUNNY_TANK : tripCueFor(area);
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
/** Seconds between the notes of Canal Paddle's struck strum, which keeps every string as loud. */
const STRIKE_SPREAD_S = 0.012;
/** Seconds each voice rings, where its synth sets the length rather than the note. */
const RING_S = Object.freeze({
  kalimba: 1.3,
  marimba: 0.55,
  musicBox: 1.8,
  strings: 0.45,
  guitar: 1.6,
  strum: 0.28,
  firefly: 0.7,
  glass: 2.6,
});
/** Seconds a water drip lasts. */
const DRIP_S = 0.12;
/** Wood block pitches: the beat, and the higher off-beat tick. */
const WOOD_BLOCK_MIDI = Object.freeze({ beat: noteMidi('A5'), offBeat: noteMidi('D6') });
/** The pentatonic steps fireflies chime from, above the key's home note in octave 6. */
const FIREFLY_STEPS: readonly number[] = Object.freeze([0, 2, 4, 7, 9]);
/** Garden Boats' made-up phrases: the pentatonic steps plus the mixolydian flat 7th. */
const MIXOLYDIAN_STEPS: readonly number[] = Object.freeze([0, 2, 4, 7, 9, 10, 12]);
/** Cenote Glow's glass line: the minor pentatonic steps above E5, all in E dorian. */
const MINOR_PENTATONIC_STEPS: readonly number[] = Object.freeze([0, 3, 5, 7, 10, 12]);

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

function note(voice: MusicVoice, part: MusicPart, midi: number | null, velocity: number, duration: number, at = 0): MusicNote {
  return { voice, part, at, midi, velocity, duration };
}

/** A strum of `notes` on `voice`, low to high, each string a little later and (by default) softer. */
function strum(
  voice: MusicVoice,
  notes: readonly number[],
  velocity: number,
  duration: number,
  at: number,
  spread = STRUM_SPREAD_S,
  fade = STRUM_FADE,
): MusicNote[] {
  return notes.map((midi, i) => note(voice, 'chords', midi, velocity * (1 - i * fade), duration, at + i * spread));
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
    notes.push(note('kalimba', 'tune', hit.midi, 0.3, RING_S.kalimba, at));
    if (pass === 1) notes.push(note('whistle', 'tune', hit.midi + 12, 0.045, hit.len * stepS, at));
    if (pass === 2 && step % 4 === 0) notes.push(note('kalimba', 'tune', hit.midi - 5, 0.1, RING_S.kalimba, at));
  }
  if (pass === 3 && step % 2 === 0 && random() < 0.5) {
    notes.push(note('kalimba', 'tune', noteMidi('G5') + pick(random, PENTATONIC), 0.16, RING_S.kalimba, at));
  }
  if ((barIndex === 3 || barIndex === 7) && step === 7) notes.push(bubble(random, 0.07, at));
  else if (random() < 0.03) notes.push(bubble(random, 0.05, at));
  return notes;
}

/**
 * Canal Paddle's arrangement for one step. A struck strum on every step, accented on 1 and 4 of the
 * six, flipping to 1, 3 and 5 (the hemiola) in bars 4 and 8, where bubbles end the phrase. The
 * marimba tune; then a kalimba joins an octave up; then a harmony a third below; then a made-up
 * marimba phrase in the second half.
 */
function arrangeCanalPaddle(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const { bar: barIndex, step, chord: sounding } = place;
  const hemiola = barIndex === 3 || barIndex === 7;
  const accent = (hemiola ? [0, 2, 4] : [0, 3]).includes(step);
  notes.push(...strum('strum', sounding.notes, accent ? 0.13 : 0.045, RING_S.strum, at, STRIKE_SPREAD_S, 0));
  if (accent) {
    const fifth = step !== 0 && !(hemiola && step === 4);
    notes.push(note('bass', 'bass', sounding.root + (fifth ? 7 : 0), step === 0 ? 0.42 : 0.3, stepS * 2, at));
    notes.push(note('kick', 'percussion', null, step === 0 ? 0.32 : 0.16, 0.18, at));
  }
  notes.push(note('shaker', 'percussion', null, accent ? 0.06 : 0.028, 0.05, at));
  const pass = place.pass % 4;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  const improvise = pass === 3 && barIndex >= 4;
  if (hit !== undefined && !improvise) {
    notes.push(note('marimba', 'tune', hit.midi, 0.32, RING_S.marimba, at));
    if (pass === 1) notes.push(note('kalimba', 'tune', hit.midi + 12, 0.1, RING_S.kalimba, at));
    if (pass === 2 && step % 3 === 0) notes.push(note('marimba', 'tune', hit.midi - 4, 0.12, RING_S.marimba, at));
  }
  if (improvise && random() < 0.55) {
    notes.push(note('marimba', 'tune', noteMidi('G4') + pick(random, PENTATONIC), 0.24, RING_S.marimba, at));
  }
  if (hemiola && step === 5) {
    notes.push(bubble(random, 0.09, at), bubble(random, 0.07, at + stepS * 0.5));
  } else if (random() < 0.04) notes.push(bubble(random, 0.05, at));
  return notes;
}

/**
 * Lily Pad Hop's arrangement for one step. Plucked strings go oom-pah, the wood block ticks, and the
 * whistle leads; a marimba doubles it on the second and third passes; the fourth makes up a marimba
 * phrase while the tune rests. A boing ends bars 4 and 8.
 */
function arrangeLilyPadHop(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const { bar: barIndex, step, chord: sounding } = place;
  if (step % 4 === 0) notes.push(note('strings', 'bass', sounding.root + (step === 4 ? 7 : 0), 0.38, RING_S.strings, at));
  if (step === 7 && random() < 0.5) notes.push(note('strings', 'bass', sounding.root + 11, 0.2, RING_S.strings, at));
  if (step % 4 === 2) notes.push(...strum('strings', sounding.notes, 0.1, RING_S.strings, at));
  if (step % 2 === 0) {
    const beat = step % 4 === 0;
    notes.push(note('woodBlock', 'percussion', beat ? WOOD_BLOCK_MIDI.beat : WOOD_BLOCK_MIDI.offBeat, beat ? 0.06 : 0.035, 0.045, at));
  } else notes.push(note('shaker', 'percussion', null, 0.02, 0.05, at));
  const pass = place.pass % 4;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  if (hit !== undefined && pass !== 3) {
    notes.push(note('whistle', 'tune', hit.midi, 0.075, hit.len * stepS, at));
    if (pass !== 0) notes.push(note('marimba', 'tune', hit.midi, pass === 2 ? 0.16 : 0.1, RING_S.marimba, at));
  }
  if (pass === 3 && random() < 0.4) {
    notes.push(note('marimba', 'tune', noteMidi('F5') + pick(random, PENTATONIC), 0.22, RING_S.marimba, at));
  }
  if ((barIndex === 3 || barIndex === 7) && step === 6) notes.push(note('boing', 'sparkles', null, 0.08, 0.3, at));
  else if (random() < 0.03) notes.push(bubble(random, 0.05, at));
  return notes;
}

/**
 * Garden Boats' arrangement for one step. Bass and a full nylon guitar strum on the 3-3-2 beat
 * (steps 0, 3 and 6), light strums and guiro scrapes between, a soft kick, box-drum slaps and a
 * shaker. The marimba tune; a whistle joins on the second pass and an octave up on the third; the
 * fourth makes up a phrase in the second half. A bubble ends the loop.
 */
function arrangeGardenBoats(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const { bar: barIndex, step, chord: sounding } = place;
  if (step === 0 || step === 3 || step === 6) {
    const lift = step === 3 ? 7 : step === 6 ? 12 : 0;
    notes.push(note('bass', 'bass', sounding.root + lift, step === 0 ? 0.42 : 0.3, stepS * 2.5, at));
    notes.push(...strum('guitar', [...sounding.notes, sounding.notes[0] + 12], 0.15, RING_S.guitar, at));
  } else if (step === 1 || step === 5) {
    notes.push(...strum('guitar', sounding.notes.slice(1).map((midi) => midi + 12), 0.05, RING_S.guitar, at));
    notes.push(note('guiro', 'percussion', null, 0.05, stepS * 0.8, at));
  }
  if (step === 0) notes.push(note('kick', 'percussion', null, 0.3, 0.18, at));
  if (step === 2 || step === 6) notes.push(note('slap', 'percussion', null, 0.09, 0.09, at));
  if (step === 3 || step === 7) notes.push(note('shaker', 'percussion', null, 0.03, 0.05, at));
  const pass = place.pass % 4;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  const improvise = pass === 3 && barIndex >= 4;
  if (hit !== undefined && !improvise) {
    notes.push(note('marimba', 'tune', hit.midi, 0.3, RING_S.marimba, at));
    if (pass === 1 || pass === 2) notes.push(note('whistle', 'tune', hit.midi + (pass === 2 ? 12 : 0), 0.04, hit.len * stepS, at));
  }
  if (improvise && random() < 0.5) {
    notes.push(note('marimba', 'tune', noteMidi('D5') + pick(random, MIXOLYDIAN_STEPS), 0.24, RING_S.marimba, at));
  }
  if (barIndex === 7 && step === 6) notes.push(bubble(random, 0.08, at));
  else if (random() < 0.03) notes.push(bubble(random, 0.05, at));
  return notes;
}

/**
 * Cenote Glow's arrangement for one step. A soft pad and a deep bass hold each bar's chord, glass
 * bells sparkle an octave above the chord now and then, and glass bells play the tune; every third
 * pass the tune rests for a made-up glass line from the minor pentatonic. Water drips at random.
 */
function arrangeCenoteGlow(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const { bar: barIndex, step, chord: sounding } = place;
  if (step === 0) {
    for (const midi of sounding.notes) notes.push(note('pad', 'chords', midi, 0.055, stepS * 8.2, at));
    notes.push(note('bass', 'bass', sounding.root, 0.3, stepS * 6, at));
  }
  if (step % 2 === 1 && random() < 0.35) notes.push(note('glass', 'chords', pick(random, sounding.notes) + 12, 0.05, RING_S.glass, at));
  const line = place.pass % 3 === 2;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  if (hit !== undefined && !line) notes.push(note('glass', 'tune', hit.midi, 0.2, RING_S.glass, at));
  if (line && step % 4 === 0 && random() < 0.6) {
    notes.push(note('glass', 'tune', noteMidi('E5') + pick(random, MINOR_PENTATONIC_STEPS), 0.14, RING_S.glass, at));
  }
  if (random() < 0.1) notes.push(note('drip', 'sparkles', null, 0.07, DRIP_S, at + random() * stepS));
  return notes;
}

/**
 * The shared dusk rule (M4; docs/music-guide.md, section 5), for any habitat cue's dusk version: soft
 * held chords with the root under each chord change and a light kalimba on the other beats; a faint
 * shaker and no drums; the tune on a music box every pass (raised an octave when below C5), softer on
 * the third pass and with a few echoes an octave up on the second; and fireflies at random.
 */
function arrangeDusk(cue: Readonly<MusicCue>, place: StepPlace, random: () => number, at: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const stepS = stepSeconds(cue);
  const beat = cue.stepsPerBeat;
  const { bar: barIndex, step, chord: sounding } = place;
  const chordSteps = cue.bars[barIndex].length === 2 ? stepsPerBar(cue) / 2 : stepsPerBar(cue);
  if (place.chordStarts) {
    for (const midi of sounding.notes) notes.push(note('pad', 'chords', midi, 0.05, stepS * chordSteps * 1.02, at));
    notes.push(note('bass', 'bass', sounding.root, 0.28, stepS * Math.min(4, chordSteps), at));
  } else if (step % beat === 0) {
    notes.push(note('kalimba', 'chords', sounding.notes[1], 0.06, RING_S.kalimba, at));
    notes.push(note('kalimba', 'chords', sounding.notes[2], 0.05, RING_S.kalimba, at + 0.015));
  }
  if (step % beat === beat - 1) notes.push(note('shaker', 'percussion', null, 0.012, 0.05, at));
  const pass = place.pass % 4;
  const hit = cue.tune[barIndex].find((tuneNote) => tuneNote.step === step);
  if (hit !== undefined) {
    const midi = hit.midi < noteMidi('C5') ? hit.midi + 12 : hit.midi;
    notes.push(note('musicBox', 'tune', midi, pass === 2 ? 0.14 : 0.22, RING_S.musicBox, at));
    if (pass === 1 && random() < 0.4) notes.push(note('musicBox', 'tune', midi + 12, 0.06, RING_S.musicBox, at + stepS));
  }
  if (random() < 0.14) {
    const midi = noteMidi(`${cue.tonic}6`) + pick(random, FIREFLY_STEPS) + (random() < 0.3 ? 12 : 0);
    notes.push(note('firefly', 'sparkles', midi, 0.045, RING_S.firefly, at + random() * stepS));
  }
  return notes;
}

/**
 * The notes `cue` plays on step `index` (0 or more, from the cue's start), with `seed` choosing each
 * pass's small changes (M10). Odd steps swing late by `cue.swing` of a step. A dusk version plays the
 * shared dusk rule (M4). Throws for a cue with no arrangement.
 */
export function arrangeStep(cue: Readonly<MusicCue>, index: number, seed: number): MusicNote[] {
  const place = stepPlace(cue, index);
  const random = stepRandom(seed, place);
  const at = place.step % 2 === 1 ? stepSeconds(cue) * cue.swing : 0;
  if (cue.version === 'dusk') return arrangeDusk(cue, place, random, at);
  switch (cue.id) {
    case SUNNY_TANK_ID:
      return arrangeSunnyTank(cue, place, random, at);
    case CANAL_PADDLE_ID:
      return arrangeCanalPaddle(cue, place, random, at);
    case LILY_PAD_HOP_ID:
      return arrangeLilyPadHop(cue, place, random, at);
    case GARDEN_BOATS_ID:
      return arrangeGardenBoats(cue, place, random, at);
    case CENOTE_GLOW_ID:
      return arrangeCenoteGlow(cue, place, random, at);
    default:
      throw new Error(`music: no arrangement for cue ${cue.id}`);
  }
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
