import { describe, expect, it } from 'vitest';
import {
  MUSIC_CUES,
  MUSIC_LEVELS,
  MUSIC_OFF_LABEL,
  MUSIC_ON_LABEL,
  MUSIC_STORAGE_KEY,
  SUNNY_TANK,
  arrangeStep,
  musicCueFor,
  musicSettingValue,
  musicSwitchLabel,
  noteMidi,
  parseMusicSetting,
  stepPlace,
  stepSeconds,
  stepsPerBar,
  stepsPerLoop,
  type MusicCue,
  type MusicNote,
  type MusicScreen,
} from './music';
import { SAVE_STORAGE_KEYS } from './save';

const HOME_SCREENS: readonly MusicScreen[] = ['title', 'homeTank', 'creator', 'areaMap', 'refuge'];
const SEED = 7;

/** Every note of `passes` passes of `cue` from step 0, step by step. */
function notesOf(cue: Readonly<MusicCue>, seed: number, passes = 4): MusicNote[][] {
  return Array.from({ length: stepsPerLoop(cue) * passes }, (_, index) => arrangeStep(cue, index, seed));
}

describe('noteMidi', () => {
  it('numbers notes with C4 as 60', () => {
    expect(noteMidi('C4')).toBe(60);
    expect(noteMidi('A4')).toBe(69);
    expect(noteMidi('F#5')).toBe(78);
    expect(noteMidi('Bb2')).toBe(46);
  });

  it('throws for a bad name', () => {
    expect(() => noteMidi('H4')).toThrow();
    expect(() => noteMidi('C')).toThrow();
  });
});

describe('musicCueFor (M1, M2)', () => {
  it('plays Sunny Tank on every Home-side screen, so moving between them never changes the cue', () => {
    for (const screen of HOME_SCREENS) expect(musicCueFor(screen)).toBe(SUNNY_TANK);
  });

  it('plays the Home cue on trips until the habitat cues are built (issue #153)', () => {
    expect(musicCueFor('trip')).toBe(SUNNY_TANK);
  });

  it('lists every cue it picks', () => {
    for (const screen of [...HOME_SCREENS, 'trip'] as const) {
      const cue = musicCueFor(screen);
      expect(MUSIC_CUES[cue.id]).toBe(cue);
    }
  });
});

describe('Sunny Tank data (docs/music-guide.md, section 4)', () => {
  it('is an 8-bar loop in G at 96 bpm, swung', () => {
    expect(SUNNY_TANK.bars).toHaveLength(8);
    expect(SUNNY_TANK.tune).toHaveLength(8);
    expect(SUNNY_TANK.bpm).toBe(96);
    expect(SUNNY_TANK.swing).toBeGreaterThan(0);
    expect(SUNNY_TANK.bars.map((chords) => chords.map((c) => c.name).join(' '))).toEqual([
      'G', 'Bm', 'C', 'D', 'G', 'E7', 'Am Cm', 'G D',
    ]);
  });

  it('keeps every tune note inside its bar', () => {
    const perBar = stepsPerBar(SUNNY_TANK);
    for (const tuneBar of SUNNY_TANK.tune) {
      for (const tuneNote of tuneBar) {
        expect(tuneNote.step).toBeGreaterThanOrEqual(0);
        expect(tuneNote.len).toBeGreaterThan(0);
        expect(tuneNote.step + tuneNote.len).toBeLessThanOrEqual(perBar);
      }
    }
  });

  it('times a step and a loop from the tempo', () => {
    expect(stepSeconds(SUNNY_TANK)).toBeCloseTo(60 / 96 / 2);
    expect(stepsPerLoop(SUNNY_TANK)).toBe(64);
  });
});

describe('stepPlace', () => {
  it('counts passes, bars and steps, and splits a two-chord bar at the half bar', () => {
    expect(stepPlace(SUNNY_TANK, 0)).toMatchObject({ pass: 0, bar: 0, step: 0, chordStarts: true });
    expect(stepPlace(SUNNY_TANK, 9)).toMatchObject({ pass: 0, bar: 1, step: 1, chordStarts: false });
    expect(stepPlace(SUNNY_TANK, 64)).toMatchObject({ pass: 1, bar: 0, step: 0 });
    const am = stepPlace(SUNNY_TANK, 6 * 8 + 3);
    const cm = stepPlace(SUNNY_TANK, 6 * 8 + 4);
    expect(am.chord.name).toBe('Am');
    expect(cm.chord.name).toBe('Cm');
    expect(cm.chordStarts).toBe(true);
  });
});

describe('arrangeStep (M10)', () => {
  it('plays the same notes for the same seed', () => {
    expect(notesOf(SUNNY_TANK, SEED)).toEqual(notesOf(SUNNY_TANK, SEED));
  });

  it('changes some notes from one pass to the next', () => {
    const steps = notesOf(SUNNY_TANK, SEED);
    const perLoop = stepsPerLoop(SUNNY_TANK);
    const passes = [0, 1, 2, 3].map((pass) => JSON.stringify(steps.slice(pass * perLoop, (pass + 1) * perLoop)));
    expect(new Set(passes).size).toBe(4);
  });

  it('changes some notes for another seed', () => {
    expect(notesOf(SUNNY_TANK, SEED)).not.toEqual(notesOf(SUNNY_TANK, SEED + 1));
  });

  it('plays the tune on its steps in the first pass', () => {
    const steps = notesOf(SUNNY_TANK, SEED, 1);
    SUNNY_TANK.tune.forEach((tuneBar, barIndex) => {
      for (const tuneNote of tuneBar) {
        const played = steps[barIndex * 8 + tuneNote.step].filter((n) => n.part === 'tune');
        expect(played.map((n) => n.midi)).toContain(tuneNote.midi);
      }
    });
  });

  it('rests the tune in the fourth pass, which makes up its own phrase', () => {
    const steps = notesOf(SUNNY_TANK, SEED);
    const fourth = steps.slice(3 * 64, 4 * 64).flat().filter((n) => n.part === 'tune');
    expect(fourth.length).toBeGreaterThan(0);
    const g5 = noteMidi('G5');
    for (const n of fourth) expect([0, 2, 4, 7, 9, 12]).toContain((n.midi ?? 0) - g5);
  });

  it('keeps every note in range, gentle, and on time', () => {
    for (const n of notesOf(SUNNY_TANK, SEED).flat()) {
      expect(n.velocity).toBeGreaterThan(0);
      expect(n.velocity).toBeLessThanOrEqual(0.5);
      expect(n.duration).toBeGreaterThan(0);
      expect(n.at).toBeGreaterThanOrEqual(0);
      expect(n.at).toBeLessThan(stepSeconds(SUNNY_TANK));
      if (n.voice === 'tap' || n.voice === 'shaker') expect(n.midi).toBeNull();
      else {
        expect(n.midi).not.toBeNull();
        expect(n.midi).toBeGreaterThanOrEqual(noteMidi('C2'));
        expect(n.midi).toBeLessThanOrEqual(noteMidi('C7'));
      }
    }
  });

  it('swings the odd steps late', () => {
    const swung = arrangeStep(SUNNY_TANK, 1, SEED);
    expect(Math.min(...swung.map((n) => n.at))).toBeCloseTo(stepSeconds(SUNNY_TANK) * SUNNY_TANK.swing);
    expect(Math.min(...arrangeStep(SUNNY_TANK, 0, SEED).map((n) => n.at))).toBe(0);
  });

  it('throws for a cue with no arrangement', () => {
    expect(() => arrangeStep({ ...SUNNY_TANK, id: 'nope' }, 0, SEED)).toThrow();
  });
});

describe('music switch (M8)', () => {
  it('is on at first launch and on unless stored off', () => {
    expect(parseMusicSetting(null)).toBe(true);
    expect(parseMusicSetting('on')).toBe(true);
    expect(parseMusicSetting('off')).toBe(false);
    expect(parseMusicSetting('garbled')).toBe(true);
  });

  it('round-trips its stored value', () => {
    for (const on of [true, false]) expect(parseMusicSetting(musicSettingValue(on))).toBe(on);
  });

  it('is kept outside the save, so Start over keeps it', () => {
    expect(SAVE_STORAGE_KEYS).not.toContain(MUSIC_STORAGE_KEY);
    expect(MUSIC_STORAGE_KEY.startsWith('glam-gills:')).toBe(true);
  });

  it('names the state in words', () => {
    expect(musicSwitchLabel(true)).toBe(MUSIC_ON_LABEL);
    expect(musicSwitchLabel(false)).toBe(MUSIC_OFF_LABEL);
    expect(MUSIC_ON_LABEL).toBe('Music on');
    expect(MUSIC_OFF_LABEL).toBe('Music off');
  });
});

describe('MUSIC_LEVELS (M9, M11)', () => {
  it('is gentle, softer while paused, and fades over about a second', () => {
    expect(MUSIC_LEVELS.master).toBeGreaterThan(0);
    expect(MUSIC_LEVELS.master).toBeLessThanOrEqual(0.5);
    expect(MUSIC_LEVELS.paused).toBeGreaterThan(0);
    expect(MUSIC_LEVELS.paused).toBeLessThan(1);
    expect(MUSIC_LEVELS.crossFadeS).toBe(1);
    expect(MUSIC_LEVELS.fadeInS).toBeGreaterThan(0);
  });
});
