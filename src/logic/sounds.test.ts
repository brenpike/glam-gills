import { describe, expect, it } from 'vitest';
import { AREAS } from './areas';
import { CANAL_PADDLE, GARDEN_BOATS, LILY_PAD_HOP, MUSIC_CUES, MUSIC_LEVELS, SUNNY_TANK, musicCueFor, noteMidi } from './music';
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
        expect(version.seconds).toBeLessThan(2.5);
      }
    }
  });

  it("keeps the sketches' measured levels (prototypes/sound-effects/sketches.html, LEVEL_DB)", () => {
    expect(soundVersion('tap').levelDb).toBe(19);
    expect(soundVersion('soundsOn').levelDb).toBe(2);
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
