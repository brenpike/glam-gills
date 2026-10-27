import { describe, expect, it } from 'vitest';
import { AREAS } from './areas';
import { CANAL_PADDLE, GARDEN_BOATS, LILY_PAD_HOP, MUSIC_CUES, MUSIC_LEVELS, SUNNY_TANK, musicCueFor, noteMidi } from './music';
import { RARITIES } from './catalogue';
import { SAVE_STORAGE_KEYS } from './save';
import {
  HOME_CHORD_STEPS,
  ONLY_VERSION,
  PITCHED_SOUND_VOICES,
  SOUNDS,
  SOUNDS_OFF_LABEL,
  SOUNDS_ON_LABEL,
  SOUNDS_STORAGE_KEY,
  SOUND_LEVELS,
  SOUND_TARGETS,
  inSoundKey,
  parseSoundsSetting,
  passesRepeatLimit,
  repeatKey,
  scaleMidi,
  soundGain,
  soundKeyFor,
  soundNotes,
  soundTarget,
  soundVersion,
  soundsSettingValue,
  soundsSwitchLabel,
  type PlayedSoundNote,
  type SoundId,
} from './sounds';

const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];
const KEYS = ['G', 'F', 'D'] as const;

describe('the key of every cue (S12)', () => {
  it('names a key for every cue, dusk versions included', () => {
    for (const cue of Object.values(MUSIC_CUES)) expect(KEYS).toContain(soundKeyFor(cue));
  });

  it('is G for Sunny Tank and Canal Paddle, F for Lily Pad Hop and D for Garden Boats', () => {
    expect(soundKeyFor(SUNNY_TANK)).toBe('G');
    expect(soundKeyFor(CANAL_PADDLE)).toBe('G');
    expect(soundKeyFor(LILY_PAD_HOP)).toBe('F');
    expect(soundKeyFor(GARDEN_BOATS)).toBe('D');
  });

  it("keeps the day cue's key in its dusk version", () => {
    for (const cue of Object.values(MUSIC_CUES)) {
      if (cue.dayId !== undefined) expect(soundKeyFor(cue)).toBe(soundKeyFor(MUSIC_CUES[cue.dayId]));
    }
  });

  it("is the home note of the cue's own key", () => {
    for (const cue of Object.values(MUSIC_CUES)) expect(soundKeyFor(cue)).toBe(cue.tonic);
  });

  it('gives every screen and every area a key, with music on or off', () => {
    for (const screen of ['title', 'homeTank', 'creator', 'areaMap', 'refuge'] as const) {
      expect(soundKeyFor(musicCueFor(screen))).toBe('G');
    }
    for (const area of AREAS) expect(KEYS).toContain(soundKeyFor(musicCueFor('trip', area)));
  });
});

describe('scaleMidi (S12; docs/sound-guide.md, section 3)', () => {
  it('puts step 0 on the home note in octave 5', () => {
    expect(scaleMidi('G', 0)).toBe(noteMidi('G5'));
    expect(scaleMidi('F', 0)).toBe(noteMidi('F5'));
    expect(scaleMidi('D', 0)).toBe(noteMidi('D5'));
  });

  it('walks the major pentatonic, an octave every 5 steps', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => scaleMidi('G', s))).toEqual(['G5', 'A5', 'B5', 'D6', 'E6', 'G6'].map(noteMidi));
    expect([0, 1, 2, 3, 4].map((s) => scaleMidi('D', s))).toEqual(['D5', 'E5', 'F#5', 'A5', 'B5'].map(noteMidi));
    expect(scaleMidi('F', -5)).toBe(noteMidi('F4'));
    expect(scaleMidi('F', -1)).toBe(noteMidi('D5'));
  });

  it('makes the home chord the major triad an octave down', () => {
    expect(HOME_CHORD_STEPS.map((s) => scaleMidi('G', s))).toEqual(['G4', 'B4', 'D5'].map(noteMidi));
    expect(HOME_CHORD_STEPS.map((s) => scaleMidi('F', s))).toEqual(['F4', 'A4', 'C5'].map(noteMidi));
  });

  it('refuses a step that is not whole', () => {
    expect(() => scaleMidi('G', 0.5)).toThrow();
  });
});

describe('sound recipes (S13, S15)', () => {
  it('gives every sound a recipe with at least one version, each with notes and a level', () => {
    expect(SOUND_IDS.length).toBeGreaterThan(0);
    for (const id of SOUND_IDS) {
      const recipe = SOUNDS[id];
      expect(recipe.id).toBe(id);
      const versions = Object.values(recipe.versions);
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        expect(version.notes.length).toBeGreaterThan(0);
        expect(Number.isFinite(version.levelDb)).toBe(true);
        expect(version.seconds).toBeGreaterThan(0);
        expect(version.seconds).toBeLessThanOrEqual(3);
      }
    }
  });

  it("keeps the sketches' measured levels (prototypes/sound-effects/sketches.html, LEVEL_DB)", () => {
    expect(soundVersion('tap').levelDb).toBe(19);
    expect(soundVersion('soundsOn').levelDb).toBe(2);
    expect(soundVersion('arrive').levelDb).toBe(4.5);
    expect(soundVersion('pickUp').levelDb).toBe(21.5);
    expect(soundVersion('place').levelDb).toBe(15.5);
    expect(soundVersion('wearOn').levelDb).toBe(9.5);
    expect(soundVersion('wearOff').levelDb).toBe(22.5);
    expect(soundVersion('dreamColour').levelDb).toBe(3.5);
    expect(soundVersion('factCard').levelDb).toBe(1.5);
    expect(soundVersion('pageTurn').levelDb).toBe(28);
    expect(soundVersion('refuge').levelDb).toBe(1.5);
    expect(soundVersion('unlock').levelDb).toBe(8.5);
    expect(soundVersion('back').levelDb).toBe(20.5);
    expect(soundVersion('surprise').levelDb).toBe(3);
    for (let step = 0; step <= 9; step++) expect(soundVersion('snack', String(step)).levelDb).toBe(6.5);
    expect(soundVersion('lastThree').levelDb).toBe(4);
    expect(soundVersion('find', 'common').levelDb).toBe(-1);
    expect(soundVersion('find', 'rare').levelDb).toBe(-3.5);
    expect(soundVersion('find', 'epic').levelDb).toBe(-4);
    expect(soundVersion('find', 'legendary').levelDb).toBe(-5.5);
    expect(soundVersion('dash').levelDb).toBe(20);
    expect(soundVersion('uhOh').levelDb).toBe(9);
    expect(soundVersion('regrow').levelDb).toBe(3);
    expect(soundVersion('bank', '1').levelDb).toBe(0);
    expect(soundVersion('bank', '2').levelDb).toBe(0.5);
    expect(soundVersion('bank', '3').levelDb).toBe(1);
    expect(soundVersion('bank', '4').levelDb).toBe(0.75);
    expect(soundVersion('bank', '5').levelDb).toBe(0.5);
    expect(soundVersion('exitOpens').levelDb).toBe(1);
    expect(soundVersion('areaBeaten', '1').levelDb).toBe(2.5);
    expect(soundVersion('areaBeaten', '2').levelDb).toBe(2.5);
    expect(soundVersion('areaBeaten', '3').levelDb).toBe(2);
  });

  it('makes the tap a touch sound, 3 dB under the event sounds', () => {
    expect(SOUNDS.tap.touch).toBe(true);
    expect(SOUNDS.soundsOn.touch).toBe(false);
    expect(soundTarget(SOUNDS.tap)).toBe(SOUND_TARGETS.touch);
    expect(soundTarget(SOUNDS.soundsOn)).toBe(SOUND_TARGETS.event);
    expect(SOUND_TARGETS.event).toBe(-18);
    expect(SOUND_TARGETS.event - SOUND_TARGETS.touch).toBe(3);
  });

  it('keeps every note in range and inside its version', () => {
    for (const id of SOUND_IDS) {
      for (const version of Object.values(SOUNDS[id].versions)) {
        for (const note of version.notes) {
          expect(note.at).toBeGreaterThanOrEqual(0);
          expect(note.at).toBeLessThan(version.seconds);
          expect(note.velocity).toBeGreaterThan(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gives pitched voices scale steps and unpitched voices none', () => {
    for (const id of SOUND_IDS) {
      for (const version of Object.values(SOUNDS[id].versions)) {
        for (const note of version.notes) {
          if (PITCHED_SOUND_VOICES.includes(note.voice)) expect(note.steps.length).toBeGreaterThan(0);
          else expect(note.steps).toEqual([]);
        }
      }
    }
  });

  it("plays every pitched note from the key's major pentatonic, in every key (S12)", () => {
    for (const key of KEYS) {
      for (const id of SOUND_IDS) {
        for (const version of Object.keys(SOUNDS[id].versions)) {
          for (const note of soundNotes(id, version, key)) {
            for (const midi of note.midis) expect(inSoundKey(key, midi)).toBe(true);
          }
        }
      }
    }
  });

  it('moves the sounds-on sample with the key and leaves the unpitched tap alone', () => {
    expect(soundNotes('soundsOn', ONLY_VERSION, 'G').map((n) => n.midis[0])).toEqual(['B5', 'G6'].map(noteMidi));
    expect(soundNotes('soundsOn', ONLY_VERSION, 'F').map((n) => n.midis[0])).toEqual(['A5', 'F6'].map(noteMidi));
    expect(soundNotes('tap', ONLY_VERSION, 'G')).toEqual(soundNotes('tap', ONLY_VERSION, 'D'));
  });

  it('rises from the lower note to the higher when sounds turn on', () => {
    const [first, second] = soundNotes('soundsOn', ONLY_VERSION, 'G');
    expect(second.at).toBeGreaterThan(first.at);
    expect(second.midis[0]).toBeGreaterThan(first.midis[0]);
  });

  it('refuses a version a sound does not have', () => {
    expect(() => soundVersion('tap', 'legendary')).toThrow();
  });

  it('turns a level in dB into a gain', () => {
    expect(soundGain(0)).toBe(1);
    expect(soundGain(20)).toBeCloseTo(10);
    expect(soundGain(-6)).toBeCloseTo(0.501, 3);
  });
});

describe('sound levels (S13)', () => {
  it('starts the sounds bus at the music volume', () => {
    expect(SOUND_LEVELS.bus).toBe(MUSIC_LEVELS.master);
  });

  it('sends the sounds to the room less than the music', () => {
    expect(SOUND_LEVELS.reverbSend).toBe(0.18);
  });
});

describe('the repeat limit (S13)', () => {
  it('lets a sound play the first time', () => {
    expect(passesRepeatLimit(undefined, 0)).toBe(true);
  });

  it('plays the same sound at most once every 60 ms', () => {
    expect(SOUND_LEVELS.repeatS).toBe(0.06);
    expect(passesRepeatLimit(1, 1)).toBe(false);
    expect(passesRepeatLimit(1, 1.059)).toBe(false);
    expect(passesRepeatLimit(1, 1.06)).toBe(true);
    expect(passesRepeatLimit(1, 2)).toBe(true);
  });

  it('keeps each sound and version apart', () => {
    expect(repeatKey('tap', ONLY_VERSION)).not.toBe(repeatKey('soundsOn', ONLY_VERSION));
    expect(repeatKey('tap', 'a')).not.toBe(repeatKey('tap', 'b'));
  });
});

describe('sounds switch (S14)', () => {
  it('is on at first launch and on unless stored off', () => {
    expect(parseSoundsSetting(null)).toBe(true);
    expect(parseSoundsSetting('on')).toBe(true);
    expect(parseSoundsSetting('off')).toBe(false);
    expect(parseSoundsSetting('garbled')).toBe(true);
  });

  it('round-trips its stored value', () => {
    for (const on of [true, false]) expect(parseSoundsSetting(soundsSettingValue(on))).toBe(on);
  });

  it('is kept outside the save, so Start over keeps it', () => {
    expect(SOUNDS_STORAGE_KEY).toBe('glam-gills:sounds');
    expect(SAVE_STORAGE_KEYS).not.toContain(SOUNDS_STORAGE_KEY);
  });

  it('names the state in words', () => {
    expect(soundsSwitchLabel(true)).toBe(SOUNDS_ON_LABEL);
    expect(soundsSwitchLabel(false)).toBe(SOUNDS_OFF_LABEL);
    expect(SOUNDS_ON_LABEL).toBe('Sounds on');
    expect(SOUNDS_OFF_LABEL).toBe('Sounds off');
  });
});

describe('Home Tank, book and menu sounds (issue #167)', () => {
  it('makes only pick up, take off, page turn and back touch sounds', () => {
    const touchIds: SoundId[] = ['pickUp', 'wearOff', 'pageTurn', 'back'];
    const eventIds: SoundId[] = ['arrive', 'place', 'wearOn', 'dreamColour', 'factCard', 'refuge', 'unlock', 'surprise'];
    for (const id of touchIds) expect(SOUNDS[id].touch).toBe(true);
    for (const id of eventIds) expect(SOUNDS[id].touch).toBe(false);
  });

  it('plays seven marimba notes on whole steps before the Surprise me strum and boing', () => {
    const notes = soundVersion('surprise').notes;
    const marimbas = notes.filter((note) => note.voice === 'marimba');
    expect(marimbas).toHaveLength(7);
    for (const note of marimbas) {
      expect(note.steps).toHaveLength(1);
      expect(Number.isInteger(note.steps[0])).toBe(true);
      expect(note.steps[0]).toBeGreaterThanOrEqual(0);
      expect(note.steps[0]).toBeLessThanOrEqual(7);
    }
    const strum = notes.find((note) => note.voice === 'strumPluck');
    const boing = notes.find((note) => note.voice === 'boing');
    expect(strum?.steps).toEqual([0, 2, 3]);
    const lastMarimbaAt = Math.max(...marimbas.map((note) => note.at));
    expect(strum!.at).toBeGreaterThan(lastMarimbaAt);
    expect(boing!.at).toBeGreaterThan(lastMarimbaAt);
  });
});

/** The pitched notes of a played sound, in recipe order. */
function pitchedNotes(notes: readonly PlayedSoundNote[]): PlayedSoundNote[] {
  return notes.filter((note) => note.midis.length > 0);
}

/** The pitched notes that start last. */
function lastPitchedNotes(notes: readonly PlayedSoundNote[]): PlayedSoundNote[] {
  const pitched = pitchedNotes(notes);
  const lastAt = Math.max(...pitched.map((note) => note.at));
  return pitched.filter((note) => note.at === lastAt);
}

/** Whether `midi` is the home note of `key`, in any octave. */
function isHomeNote(key: (typeof KEYS)[number], midi: number): boolean {
  return (((midi - scaleMidi(key, 0)) % 12) + 12) % 12 === 0;
}

/** Whether `midi` is a note of `key`'s home chord, in any octave (HOME_CHORD_STEPS). */
function isHomeChordNote(key: (typeof KEYS)[number], midi: number): boolean {
  return HOME_CHORD_STEPS.some((step) => (((midi - scaleMidi(key, step)) % 12) + 12) % 12 === 0);
}

describe('finds by rarity (S4)', () => {
  it('grow with rarity: more notes, a higher top note, and longer', () => {
    for (const key of KEYS) {
      for (let i = 1; i < RARITIES.length; i++) {
        const lower = soundNotes('find', RARITIES[i - 1], key);
        const higher = soundNotes('find', RARITIES[i], key);
        expect(higher.length).toBeGreaterThan(lower.length);
        expect(Math.max(...higher.flatMap((n) => n.midis))).toBeGreaterThan(Math.max(...lower.flatMap((n) => n.midis)));
        expect(soundVersion('find', RARITIES[i]).seconds).toBeGreaterThan(soundVersion('find', RARITIES[i - 1]).seconds);
      }
    }
  });

  it('are all under 2.5 seconds, Legendary included', () => {
    for (const rarity of RARITIES) expect(soundVersion('find', rarity).seconds).toBeLessThan(2.5);
    expect(Object.keys(SOUNDS.find.versions).sort()).toEqual([...RARITIES].sort());
  });
});

describe('a lost leg and a leg back (S5)', () => {
  it("drops the uh-oh's second note lower and leaves it off the home note", () => {
    for (const key of KEYS) {
      const pitched = pitchedNotes(soundNotes('uhOh', ONLY_VERSION, key));
      expect(pitched[1].midis[0]).toBeLessThan(pitched[0].midis[0]);
      expect(isHomeNote(key, pitched[pitched.length - 1].midis[0])).toBe(false);
    }
  });

  it('ends the regrowth on the home note', () => {
    for (const key of KEYS) {
      const pitched = pitchedNotes(soundNotes('regrow', ONLY_VERSION, key));
      expect(isHomeNote(key, pitched[pitched.length - 1].midis[0])).toBe(true);
    }
  });
});

describe('the wins end on the home chord (S7, S8; issue #165, ND-14)', () => {
  const WINS: readonly [SoundId, string][] = [
    ['bank', '1'],
    ['bank', '2'],
    ['bank', '3'],
    ['bank', '4'],
    ['bank', '5'],
    ['exitOpens', ONLY_VERSION],
    ['areaBeaten', '1'],
    ['areaBeaten', '2'],
    ['areaBeaten', '3'],
  ];

  it('plays only home chord notes, in any octave, in the pitched notes that start last', () => {
    for (const key of KEYS) {
      for (const [id, version] of WINS) {
        const last = lastPitchedNotes(soundNotes(id, version, key));
        expect(last.length).toBeGreaterThan(0);
        for (const note of last) for (const midi of note.midis) expect(isHomeChordNote(key, midi)).toBe(true);
      }
    }
  });

  it('has a version for every bank count from 1 to 5 and every star count from 1 to 3', () => {
    expect(Object.keys(SOUNDS.bank.versions).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(Object.keys(SOUNDS.areaBeaten.versions).sort()).toEqual(['1', '2', '3']);
  });
});
