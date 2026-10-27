/**
 * Pure sound effect rules (PRD N7, S1 to S16; ADR 0026; docs/sound-guide.md): the sound recipes and
 * their levels, the key each cue's sounds play in, the notes a recipe plays in a key, the repeat
 * limit, and the sounds switch's stored value and labels. Slice 3 (issue #167) adds the Home Tank, book
 * and menu sounds. The voices that play the notes are browser
 * glue in src/platform/audioVoices.ts, and src/platform/soundPlayer.ts plays a sound on the sounds bus.
 * The trip's sounds (S3 to S8; issue #165) are here too: the snack ladder's notes, the last 3 snacks,
 * finds by rarity, Tail Dash, the uh-oh and the regrowth, banking, the exit opening and the stars.
 * src/logic/snackLadder.ts and src/logic/tripSounds.ts pick which of them a trip moment plays.
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
export type SoundId =
  | 'tap'
  | 'soundsOn'
  | 'arrive'
  | 'pickUp'
  | 'place'
  | 'wearOn'
  | 'wearOff'
  | 'dreamColour'
  | 'factCard'
  | 'pageTurn'
  | 'refuge'
  | 'unlock'
  | 'back'
  | 'surprise'
  | 'snack'
  | 'lastThree'
  | 'find'
  | 'dash'
  | 'uhOh'
  | 'regrow'
  | 'bank'
  | 'exitOpens'
  | 'areaBeaten';

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

/** The Surprise me sound's seven marimba steps, each in 0 to 7, fixed so the sound never changes. */
const SURPRISE_STEPS: readonly number[] = Object.freeze([2, 5, 0, 7, 3, 6, 4]);

/** A sound's versions by name, each frozen with its notes. */
function versionsOf(versions: Readonly<Record<string, SoundVersion>>): Readonly<Record<string, Readonly<SoundVersion>>> {
  const frozen: Record<string, Readonly<SoundVersion>> = {};
  for (const [name, { levelDb, seconds, notes }] of Object.entries(versions)) {
    frozen[name] = Object.freeze({ levelDb, seconds, notes: Object.freeze(notes.map((n) => Object.freeze({ ...n }))) });
  }
  return Object.freeze(frozen);
}

/** The home chord an octave up from HOME_CHORD_STEPS, the chord the wins strum. */
const STRUM_CHORD_STEPS: readonly number[] = Object.freeze([0, 2, 3]);

/** Steps of the snack ladder: one marimba note per step, 0 to 9 (S3). */
const SNACK_LADDER_STEPS = 10;

/** A snack on ladder step `step`: a low gulp and one marimba note (S3). */
function snackVersion(step: number): SoundVersion {
  return {
    levelDb: 6.5,
    seconds: 0.3,
    notes: [
      { voice: 'bubble', at: 0, velocity: 0.09, steps: [], hz: [260] },
      { voice: 'marimba', at: 0.03, velocity: 0.2, steps: [step] },
    ],
  };
}

/** Banking `count` finds: a bubble and kalimba note per find, climbing, then the home chord strum (S7). */
function bankVersion(levelDb: number, count: number): SoundVersion {
  const notes: SoundNote[] = [];
  for (let i = 0; i < count; i++) {
    notes.push({ voice: 'bubble', at: i * 0.12, velocity: 0.06, steps: [], hz: [500 + i * 60] });
    notes.push({ voice: 'kalimba', at: i * 0.12, velocity: 0.16, steps: [i + 2] });
  }
  const end = count * 0.12 + 0.05;
  notes.push({ voice: 'strumPluck', at: end, velocity: 0.12, steps: STRUM_CHORD_STEPS, pluck: 'ukulele', gap: 0.02 });
  notes.push({ voice: 'kalimba', at: end, velocity: 0.2, steps: [5] });
  return { levelDb, seconds: end + 1, notes };
}

/** The glass chimes of the stars, each higher (S8). */
const STAR_CHIME_STEPS: readonly number[] = Object.freeze([5, 7, 10]);

/** Beating an area with `stars` stars: a strum, one chime per star, then the home chord and bubbles (S8). */
function areaBeatenVersion(levelDb: number, stars: number): SoundVersion {
  const notes: SoundNote[] = [
    { voice: 'strumPluck', at: 0, velocity: 0.12, steps: STRUM_CHORD_STEPS, pluck: 'ukulele', gap: 0.025 },
  ];
  for (let i = 0; i < stars; i++) {
    const chime = STAR_CHIME_STEPS[i];
    notes.push({ voice: 'glass', at: 0.45 + i * 0.4, velocity: 0.14, steps: [chime], seconds: 1.4 });
    notes.push({ voice: 'firefly', at: 0.52 + i * 0.4, velocity: 0.04, steps: [chime + 5] });
  }
  const end = 0.45 + stars * 0.4 + 0.1;
  notes.push({ voice: 'strumPluck', at: end, velocity: 0.13, steps: STRUM_CHORD_STEPS, pluck: 'ukulele', gap: 0.03 });
  notes.push({ voice: 'kalimba', at: end, velocity: 0.16, steps: [5] });
  for (let k = 0; k < 3; k++) notes.push({ voice: 'bubble', at: end + 0.1 + k * 0.08, velocity: 0.05, steps: [] });
  return { levelDb, seconds: end + 1, notes };
}

/** The snack's versions, one per ladder step, named by the step. */
function snackVersions(): Record<string, SoundVersion> {
  const versions: Record<string, SoundVersion> = {};
  for (let step = 0; step < SNACK_LADDER_STEPS; step++) versions[String(step)] = snackVersion(step);
  return versions;
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
  /** Two bubbles and a kalimba note, when the player arrives back in the Home Tank. */
  arrive: Object.freeze({
    id: 'arrive',
    touch: false,
    versions: only(4.5, 0.6, [
      { voice: 'bubble', at: 0, velocity: 0.06, steps: [], hz: [300] },
      { voice: 'bubble', at: 0.09, velocity: 0.05, steps: [], hz: [420] },
      { voice: 'kalimba', at: 0.12, velocity: 0.14, steps: [5] },
    ]),
  }),
  /** A small bubble, when the player picks up a decoration. */
  pickUp: Object.freeze({
    id: 'pickUp',
    touch: true,
    versions: only(21.5, 0.12, [{ voice: 'bubble', at: 0, velocity: 0.06, steps: [], hz: [420] }]),
  }),
  /** A low bubble, a sand puff and a low marimba note, when a decoration settles in the tank. */
  place: Object.freeze({
    id: 'place',
    touch: false,
    versions: only(15.5, 0.3, [
      { voice: 'bubble', at: 0, velocity: 0.08, steps: [], hz: [200] },
      { voice: 'puff', at: 0.02, velocity: 0.05, steps: [], hz: [900], seconds: 0.18 },
      { voice: 'marimba', at: 0.04, velocity: 0.06, steps: [-3] },
    ]),
  }),
  /** A shaker and two fireflies, when a Wearable goes on. */
  wearOn: Object.freeze({
    id: 'wearOn',
    touch: false,
    versions: only(9.5, 0.6, [
      { voice: 'shaker', at: 0, velocity: 0.04, steps: [], seconds: 0.15 },
      { voice: 'firefly', at: 0.06, velocity: 0.06, steps: [7] },
      { voice: 'firefly', at: 0.14, velocity: 0.055, steps: [9] },
    ]),
  }),
  /** A short shaker, when a Wearable comes off. */
  wearOff: Object.freeze({
    id: 'wearOff',
    touch: true,
    versions: only(22.5, 0.2, [{ voice: 'shaker', at: 0, velocity: 0.035, steps: [], seconds: 0.12 }]),
  }),
  /** Nine glass notes up the scale over a swoosh, when a Dream colour goes on. */
  dreamColour: Object.freeze({
    id: 'dreamColour',
    touch: false,
    versions: only(3.5, 1.0, [
      ...Array.from({ length: 9 }, (_, i): SoundNote => ({
        voice: 'glass',
        at: i * 0.04,
        velocity: 0.07,
        steps: [i + 3],
        seconds: 0.8,
      })),
      { voice: 'swoosh', at: 0, velocity: 0.03, steps: [], seconds: 0.5, hz: [2500, 7000], q: 2 },
    ]),
  }),
  /** A swoosh and two music box notes, when a fact card opens. */
  factCard: Object.freeze({
    id: 'factCard',
    touch: false,
    versions: only(1.5, 0.9, [
      { voice: 'swoosh', at: 0, velocity: 0.04, steps: [], seconds: 0.14, hz: [2000, 6000], q: 1.5 },
      { voice: 'musicBox', at: 0.08, velocity: 0.14, steps: [3] },
      { voice: 'musicBox', at: 0.2, velocity: 0.16, steps: [5] },
    ]),
  }),
  /** A paper swoosh, when a book or chest page turns. */
  pageTurn: Object.freeze({
    id: 'pageTurn',
    touch: true,
    versions: only(28, 0.2, [{ voice: 'swoosh', at: 0, velocity: 0.035, steps: [], seconds: 0.16, hz: [2200, 6500], q: 1.5 }]),
  }),
  /** A marimba run up to a whistle and a ukulele chord, then bubbles, when the Refuge opens. */
  refuge: Object.freeze({
    id: 'refuge',
    touch: false,
    versions: only(1.5, 1.4, [
      { voice: 'marimba', at: 0, velocity: 0.18, steps: [0] },
      { voice: 'marimba', at: 0.12, velocity: 0.18, steps: [2] },
      { voice: 'marimba', at: 0.24, velocity: 0.18, steps: [4] },
      { voice: 'marimba', at: 0.36, velocity: 0.18, steps: [5] },
      { voice: 'marimba', at: 0.6, velocity: 0.18, steps: [7] },
      { voice: 'whistle', at: 0.6, velocity: 0.045, steps: [7], seconds: 0.45 },
      { voice: 'strumPluck', at: 0.6, velocity: 0.12, steps: [0, 2, 3], pluck: 'ukulele', gap: 0.02 },
      { voice: 'bubble', at: 0.75, velocity: 0.05, steps: [] },
      { voice: 'bubble', at: 0.83, velocity: 0.05, steps: [] },
      { voice: 'bubble', at: 0.91, velocity: 0.05, steps: [] },
      { voice: 'bubble', at: 0.99, velocity: 0.05, steps: [] },
    ]),
  }),
  /** A boing and two whistles up, when a new area unlocks on the area map. */
  unlock: Object.freeze({
    id: 'unlock',
    touch: false,
    versions: only(8.5, 0.8, [
      { voice: 'boing', at: 0, velocity: 0.06, steps: [] },
      { voice: 'whistle', at: 0.15, velocity: 0.05, steps: [5], seconds: 0.14 },
      { voice: 'whistle', at: 0.3, velocity: 0.05, steps: [7], seconds: 0.3 },
    ]),
  }),
  /** A lower bubble and wood tick than the tap, on a Back or Close press. */
  back: Object.freeze({
    id: 'back',
    touch: true,
    versions: only(20.5, 0.12, [
      { voice: 'bubble', at: 0, velocity: 0.06, steps: [], hz: [420] },
      { voice: 'woodBlock', at: 0, velocity: 0.03, steps: [], hz: [880 * 0.9] },
    ]),
  }),
  /**
   * Seven marimba notes on fixed scale steps, then a ukulele chord and a boing, on a Surprise me press.
   * The sketch picks the steps at random; here they are chosen once (issue #167, ND-10).
   */
  surprise: Object.freeze({
    id: 'surprise',
    touch: false,
    versions: only(3, 1.0, [
      ...SURPRISE_STEPS.map((step, i): SoundNote => ({ voice: 'marimba', at: i * 0.06, velocity: 0.14, steps: [step] })),
      { voice: 'strumPluck', at: 0.45, velocity: 0.12, steps: [0, 2, 3], pluck: 'ukulele', gap: 0.02 },
      { voice: 'boing', at: 0.5, velocity: 0.05, steps: [] },
    ]),
  }),
  /** A snack on the snack ladder, by its step '0' to '9' (S3). */
  snack: Object.freeze({ id: 'snack', touch: false, versions: versionsOf(snackVersions()) }),
  /** One of the last 3 snacks: the gulp on a high note with two firefly twinkles (S3). */
  lastThree: Object.freeze({
    id: 'lastThree',
    touch: false,
    versions: only(4, 0.5, [
      { voice: 'bubble', at: 0, velocity: 0.09, steps: [], hz: [260] },
      { voice: 'marimba', at: 0.03, velocity: 0.2, steps: [5] },
      { voice: 'firefly', at: 0.1, velocity: 0.06, steps: [9] },
      { voice: 'firefly', at: 0.18, velocity: 0.05, steps: [10] },
    ]),
  }),
  /** A treasure found, by its rarity: more notes, higher and longer as rarity goes up (S4). */
  find: Object.freeze({
    id: 'find',
    touch: false,
    versions: versionsOf({
      common: {
        levelDb: -1,
        seconds: 0.9,
        notes: [
          { voice: 'bubble', at: 0, velocity: 0.07, steps: [] },
          { voice: 'kalimba', at: 0, velocity: 0.22, steps: [3] },
          { voice: 'kalimba', at: 0.12, velocity: 0.24, steps: [5] },
        ],
      },
      rare: {
        levelDb: -3.5,
        seconds: 1.1,
        notes: [
          { voice: 'marimba', at: 0, velocity: 0.22, steps: [3] },
          { voice: 'marimba', at: 0.08, velocity: 0.22, steps: [5] },
          { voice: 'marimba', at: 0.16, velocity: 0.22, steps: [8] },
          { voice: 'kalimba', at: 0.16, velocity: 0.14, steps: [8] },
          { voice: 'bubble', at: 0.22, velocity: 0.06, steps: [] },
          { voice: 'bubble', at: 0.3, velocity: 0.05, steps: [] },
        ],
      },
      epic: {
        levelDb: -4,
        seconds: 1.6,
        notes: [
          { voice: 'musicBox', at: 0, velocity: 0.2, steps: [3] },
          { voice: 'musicBox', at: 0.085, velocity: 0.2, steps: [5] },
          { voice: 'musicBox', at: 0.17, velocity: 0.2, steps: [6] },
          { voice: 'musicBox', at: 0.255, velocity: 0.2, steps: [8] },
          { voice: 'glass', at: 0.34, velocity: 0.12, steps: [10], seconds: 1.6 },
          { voice: 'shaker', at: 0.3, velocity: 0.04, steps: [], seconds: 0.25 },
          { voice: 'bubble', at: 0.4, velocity: 0.05, steps: [] },
          { voice: 'bubble', at: 0.47, velocity: 0.05, steps: [] },
          { voice: 'bubble', at: 0.54, velocity: 0.05, steps: [] },
        ],
      },
      legendary: {
        levelDb: -5.5,
        seconds: 2.3,
        notes: [
          { voice: 'musicBox', at: 0, velocity: 0.16, steps: [3] },
          { voice: 'musicBox', at: 0.06, velocity: 0.16, steps: [4] },
          { voice: 'musicBox', at: 0.12, velocity: 0.16, steps: [5] },
          { voice: 'musicBox', at: 0.18, velocity: 0.16, steps: [6] },
          { voice: 'musicBox', at: 0.24, velocity: 0.16, steps: [7] },
          { voice: 'musicBox', at: 0.3, velocity: 0.16, steps: [8] },
          { voice: 'musicBox', at: 0.36, velocity: 0.16, steps: [9] },
          { voice: 'musicBox', at: 0.42, velocity: 0.16, steps: [10] },
          { voice: 'glass', at: 0.5, velocity: 0.09, steps: [8], seconds: 2 },
          { voice: 'glass', at: 0.5, velocity: 0.09, steps: [10], seconds: 2 },
          { voice: 'glass', at: 0.5, velocity: 0.09, steps: [12], seconds: 2 },
          { voice: 'pad', at: 0.45, velocity: 0.035, steps: STRUM_CHORD_STEPS, seconds: 1 },
          { voice: 'whistle', at: 0.5, velocity: 0.04, steps: [10], seconds: 0.6 },
          { voice: 'firefly', at: 0.9, velocity: 0.04, steps: [12] },
          { voice: 'firefly', at: 1.03, velocity: 0.04, steps: [13] },
          { voice: 'firefly', at: 1.16, velocity: 0.04, steps: [14] },
          { voice: 'firefly', at: 1.29, velocity: 0.04, steps: [12] },
          { voice: 'firefly', at: 1.42, velocity: 0.04, steps: [13] },
        ],
      },
    }),
  }),
  /** Tail Dash: a watery whoosh that rises, with a trail of three bubbles (S6). */
  dash: Object.freeze({
    id: 'dash',
    touch: false,
    versions: only(20, 0.45, [
      { voice: 'swoosh', at: 0, velocity: 0.11, steps: [], seconds: 0.28, hz: [500, 2600] },
      { voice: 'bubble', at: 0.12, velocity: 0.05, steps: [], hz: [450] },
      { voice: 'bubble', at: 0.18, velocity: 0.05, steps: [], hz: [570] },
      { voice: 'bubble', at: 0.24, velocity: 0.05, steps: [], hz: [690] },
    ]),
  }),
  /** A lost leg, the uh-oh: a soft puff and two low marimba notes falling, left unfinished (S5). */
  uhOh: Object.freeze({
    id: 'uhOh',
    touch: false,
    versions: only(9, 0.6, [
      { voice: 'puff', at: 0, velocity: 0.11, steps: [], hz: [1200] },
      { voice: 'marimba', at: 0.04, velocity: 0.13, steps: [-2] },
      { voice: 'marimba', at: 0.22, velocity: 0.11, steps: [-3] },
    ]),
  }),
  /** A leg grown back: three rising marimba notes ending on the home note, and a bubble (S5). */
  regrow: Object.freeze({
    id: 'regrow',
    touch: false,
    versions: only(3, 0.7, [
      { voice: 'marimba', at: 0, velocity: 0.18, steps: [2] },
      { voice: 'marimba', at: 0.1, velocity: 0.18, steps: [3] },
      { voice: 'marimba', at: 0.2, velocity: 0.18, steps: [5] },
      { voice: 'bubble', at: 0.3, velocity: 0.05, steps: [] },
    ]),
  }),
  /**
   * Banking, by the finds banked '1' to '5' (S7). The bank 2 and bank 4 levels are the means of their
   * measured neighbours (issue #165, ND-2).
   */
  bank: Object.freeze({
    id: 'bank',
    touch: false,
    versions: versionsOf({
      '1': bankVersion(0, 1),
      '2': bankVersion(0.5, 2),
      '3': bankVersion(1, 3),
      '4': bankVersion(0.75, 4),
      '5': bankVersion(0.5, 5),
    }),
  }),
  /** The exit opening, a tiny "ta-da": whistle and marimba up four notes, a strum and a boing (S8). */
  exitOpens: Object.freeze({
    id: 'exitOpens',
    touch: false,
    versions: only(1, 1.3, [
      { voice: 'whistle', at: 0, velocity: 0.05, steps: [0], seconds: 0.14 },
      { voice: 'marimba', at: 0, velocity: 0.16, steps: [0] },
      { voice: 'whistle', at: 0.14, velocity: 0.05, steps: [2], seconds: 0.14 },
      { voice: 'marimba', at: 0.14, velocity: 0.16, steps: [2] },
      { voice: 'whistle', at: 0.28, velocity: 0.05, steps: [4], seconds: 0.14 },
      { voice: 'marimba', at: 0.28, velocity: 0.16, steps: [4] },
      { voice: 'whistle', at: 0.42, velocity: 0.05, steps: [5], seconds: 0.5 },
      { voice: 'marimba', at: 0.42, velocity: 0.16, steps: [5] },
      { voice: 'strumPluck', at: 0.42, velocity: 0.12, steps: STRUM_CHORD_STEPS, pluck: 'ukulele', gap: 0.02 },
      { voice: 'boing', at: 0.75, velocity: 0.05, steps: [] },
    ]),
  }),
  /** Beating an area, by the stars earned this trip '1' to '3' (S8). */
  areaBeaten: Object.freeze({
    id: 'areaBeaten',
    touch: false,
    versions: versionsOf({
      '1': areaBeatenVersion(2.5, 1),
      '2': areaBeatenVersion(2.5, 2),
      '3': areaBeatenVersion(2, 3),
    }),
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
  /**
   * The same sound (and version) starts at most once in this many seconds, and one asked for sooner
   * waits (S13; issue #165).
   */
  repeatS: 0.06,
  /** Seconds between the starts of snacks eaten at the same moment (S3; issue #165). */
  snackGapS: 0.08,
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
