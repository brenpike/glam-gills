import { describe, expect, it } from 'vitest';
import {
  AREAS,
  AREA_LOOK_TIMES,
  CANAL_AREA,
  CHINAMPA_2_AREA,
  CHINAMPA_AREA,
  HABITATS,
  POND_2_AREA,
  POND_AREA,
  SPRING_CAVE_HABITAT,
  areaTimeOfDay,
} from './areas';
import {
  CANAL_PADDLE,
  CENOTE_GLOW,
  DRUM_VOICES,
  GARDEN_BOATS,
  HABITAT_CUES,
  LILY_PAD_HOP,
  MUSIC_CUES,
  MUSIC_LEVELS,
  MUSIC_OFF_LABEL,
  MUSIC_ON_LABEL,
  MUSIC_STORAGE_KEY,
  SUNNY_TANK,
  UNPITCHED_VOICES,
  arrangeStep,
  duskVersion,
  musicCueFor,
  musicSettingValue,
  musicSwitchLabel,
  noteMidi,
  parseMusicSetting,
  stepPlace,
  stepSeconds,
  stepsPerBar,
  stepsPerLoop,
  tripCueFor,
  type MusicCue,
  type MusicNote,
  type MusicScreen,
} from './music';
import { SAVE_STORAGE_KEYS } from './save';
import { SOUNDS, inSoundKey, soundKeyFor, soundNotes, type SoundId } from './sounds';

const HOME_SCREENS: readonly MusicScreen[] = ['title', 'homeTank', 'creator', 'areaMap', 'refuge'];
const SEED = 7;
const DAY_HABITAT_CUES: readonly Readonly<MusicCue>[] = [CANAL_PADDLE, LILY_PAD_HOP, GARDEN_BOATS, CENOTE_GLOW];
/** Pitch classes of E dorian, which uses D major's notes, above C. */
const E_DORIAN_PITCHES: readonly number[] = ['E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'].map((name) => noteMidi(name) % 12);
const DUSK_HABITAT_CUES: readonly Readonly<MusicCue>[] = DAY_HABITAT_CUES.map((cue) => tripCueFor({ habitatId: habitatOf(cue), look: 'pond-dusk' }));
const ALL_CUES: readonly Readonly<MusicCue>[] = [SUNNY_TANK, ...DAY_HABITAT_CUES, ...DUSK_HABITAT_CUES];

function habitatOf(cue: Readonly<MusicCue>): string {
  const entry = Object.entries(HABITAT_CUES).find(([, habitatCue]) => habitatCue === cue);
  if (entry === undefined) throw new Error(`no habitat for ${cue.id}`);
  return entry[0];
}

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

  it("plays each area's habitat cue on a trip, and Area 3 Lily Pad Hop's dusk version", () => {
    expect(musicCueFor('trip', CANAL_AREA)).toBe(CANAL_PADDLE);
    expect(musicCueFor('trip', POND_AREA)).toBe(LILY_PAD_HOP);
    expect(musicCueFor('trip', CHINAMPA_AREA)).toBe(GARDEN_BOATS);
    expect(musicCueFor('trip', CHINAMPA_2_AREA)).toBe(GARDEN_BOATS);
    const area3 = musicCueFor('trip', POND_2_AREA);
    expect(area3.version).toBe('dusk');
    expect(area3.dayId).toBe(LILY_PAD_HOP.id);
    expect(area3.name).toBe('Lily Pad Hop (dusk)');
  });

  it('gives the same dusk version every time, so moving between dusk screens never restarts it', () => {
    expect(musicCueFor('trip', POND_2_AREA)).toBe(musicCueFor('trip', POND_2_AREA));
  });

  it("reads the area's time of day, not its look id: a night look plays the dusk version too (open question 406)", () => {
    expect(areaTimeOfDay(POND_2_AREA)).toBe('dusk');
    expect(AREA_LOOK_TIMES['pond-dusk']).toBe('dusk');
    for (const area of AREAS) {
      const cue = musicCueFor('trip', area);
      expect(cue.version).toBe(areaTimeOfDay(area) === 'day' ? 'day' : 'dusk');
      expect(cue.dayId ?? cue.id).toBe(HABITAT_CUES[area.habitatId].id);
    }
  });

  it('plays the Home cue on a trip with no area', () => {
    expect(musicCueFor('trip')).toBe(SUNNY_TANK);
  });

  it('throws for a habitat with no cue', () => {
    expect(() => tripCueFor({ habitatId: 'nowhere' })).toThrow();
  });

  it('lists every cue it picks', () => {
    for (const screen of HOME_SCREENS) expect(MUSIC_CUES[musicCueFor(screen).id]).toBe(musicCueFor(screen));
    for (const area of AREAS) expect(MUSIC_CUES[musicCueFor('trip', area).id]).toBe(musicCueFor('trip', area));
    expect(Object.keys(MUSIC_CUES)).toHaveLength(ALL_CUES.length);
  });
});

describe('habitat cues (M3)', () => {
  it('gives every habitat its own cue, none shared and none the Home cue', () => {
    const cues = HABITATS.map((habitat) => HABITAT_CUES[habitat.id]);
    for (const cue of cues) {
      expect(cue).toBeDefined();
      expect(cue).not.toBe(SUNNY_TANK);
      expect(cue.version).toBe('day');
      expect(cue.dusk).toBeDefined();
    }
    expect(new Set(cues.map((cue) => cue.id)).size).toBe(HABITATS.length);
    expect(Object.keys(HABITAT_CUES).sort()).toEqual(HABITATS.map((habitat) => habitat.id).sort());
  });

  it('matches the music guide: keys, tempos and chords (docs/music-guide.md, section 4)', () => {
    const chordNames = (cue: Readonly<MusicCue>): string[] => cue.bars.map((chords) => chords.map((c) => c.name).join(' '));
    expect([CANAL_PADDLE.key, CANAL_PADDLE.bpm, CANAL_PADDLE.beatsPerBar * CANAL_PADDLE.stepsPerBeat]).toEqual(['G major', 68, 6]);
    expect(chordNames(CANAL_PADDLE)).toEqual(['G', 'C', 'D', 'G', 'C', 'G', 'Am D', 'G']);
    expect([LILY_PAD_HOP.key, LILY_PAD_HOP.bpm]).toEqual(['F major', 104]);
    expect(chordNames(LILY_PAD_HOP)).toEqual(['F', 'Dm', 'Gm', 'C', 'F', 'A7', 'Bb C', 'F']);
    expect([GARDEN_BOATS.key, GARDEN_BOATS.bpm]).toEqual(['D mixolydian', 112]);
    expect(chordNames(GARDEN_BOATS)).toEqual(['D', 'C', 'G', 'D', 'Bm', 'G', 'Em A', 'D']);
    expect([CENOTE_GLOW.key, CENOTE_GLOW.bpm, CENOTE_GLOW.beatsPerBar, CENOTE_GLOW.stepsPerBeat, CENOTE_GLOW.swing]).toEqual(['E dorian', 66, 4, 2, 0]);
    expect(chordNames(CENOTE_GLOW)).toEqual(['Em9', 'A', 'Cmaj7', 'D', 'Em9', 'A', 'Cmaj7', 'D']);
  });

  it('plays Cenote Glow in the spring cave', () => {
    expect(HABITAT_CUES[SPRING_CAVE_HABITAT.id]).toBe(CENOTE_GLOW);
    expect(tripCueFor({ habitatId: SPRING_CAVE_HABITAT.id })).toBe(CENOTE_GLOW);
    expect(CENOTE_GLOW.name).toBe('Cenote Glow');
  });

  it('keeps each 6/8 bar of Canal Paddle to six steps', () => {
    expect(stepsPerBar(CANAL_PADDLE)).toBe(6);
    expect(stepSeconds(CANAL_PADDLE)).toBeCloseTo(60 / 68 / 3);
  });
});

describe('the dusk rule (M4)', () => {
  it('has no dusk version of the Home cue, or of a dusk version', () => {
    expect(() => duskVersion(SUNNY_TANK)).toThrow();
    for (const dusk of DUSK_HABITAT_CUES) expect(() => duskVersion(dusk)).toThrow();
  });

  it('keeps the tune and chords, and is slower: Canal Paddle 54, Lily Pad Hop 80, Garden Boats 86, Cenote Glow 52', () => {
    expect(DUSK_HABITAT_CUES.map((cue) => cue.bpm)).toEqual([54, 80, 86, 52]);
    expect(CENOTE_GLOW.dusk).toEqual({ bpm: 52, swing: 0 });
    DAY_HABITAT_CUES.forEach((day, i) => {
      const dusk = DUSK_HABITAT_CUES[i];
      expect(dusk.tune).toBe(day.tune);
      expect(dusk.bars).toBe(day.bars);
      expect(dusk.bpm).toBeLessThan(day.bpm);
      expect(stepSeconds(dusk)).toBeGreaterThan(stepSeconds(day));
    });
  });

  it('plays every tune note on its step on a music box, every pass, raised an octave when below C5', () => {
    for (const dusk of DUSK_HABITAT_CUES) {
      const steps = notesOf(dusk, SEED);
      const perBar = stepsPerBar(dusk);
      for (let pass = 0; pass < 4; pass++) {
        dusk.tune.forEach((tuneBar, barIndex) => {
          for (const tuneNote of tuneBar) {
            const played = steps[pass * stepsPerLoop(dusk) + barIndex * perBar + tuneNote.step].filter((n) => n.part === 'tune' && n.at < stepSeconds(dusk));
            const expected = tuneNote.midi < noteMidi('C5') ? tuneNote.midi + 12 : tuneNote.midi;
            expect(played.map((n) => [n.voice, n.midi])).toContainEqual(['musicBox', expected]);
          }
        });
      }
    }
  });

  it("holds each chord's notes softly on a pad from the chord's first step", () => {
    for (const dusk of DUSK_HABITAT_CUES) {
      notesOf(dusk, SEED, 1).forEach((notes, index) => {
        const place = stepPlace(dusk, index);
        const pads = notes.filter((n) => n.voice === 'pad');
        if (!place.chordStarts) {
          expect(pads).toHaveLength(0);
          return;
        }
        expect(pads.map((n) => n.midi)).toEqual([...place.chord.notes]);
        for (const n of pads) expect(n.velocity).toBeLessThanOrEqual(0.1);
      });
    }
  });

  it('plays no drums, only a faint shaker, and fireflies', () => {
    for (const dusk of DUSK_HABITAT_CUES) {
      const notes = notesOf(dusk, SEED).flat();
      for (const n of notes) {
        expect(DRUM_VOICES).not.toContain(n.voice);
        if (n.part === 'percussion') {
          expect(n.voice).toBe('shaker');
          expect(n.velocity).toBeLessThanOrEqual(0.02);
        }
      }
      expect(notes.some((n) => n.voice === 'firefly')).toBe(true);
      expect(notes.every((n) => n.part !== 'sparkles' || n.voice === 'firefly')).toBe(true);
    }
  });

  it('gives every day habitat cue but Cenote Glow drums, so the dusk version is what takes them away', () => {
    for (const day of DAY_HABITAT_CUES.filter((cue) => cue !== CENOTE_GLOW)) {
      expect(notesOf(day, SEED, 1).flat().some((n) => DRUM_VOICES.includes(n.voice))).toBe(true);
    }
  });
});

describe('music voices', () => {
  it('plays glass bells with a pitch and water drips without one, and neither is a drum', () => {
    expect(UNPITCHED_VOICES).not.toContain('glass');
    expect(UNPITCHED_VOICES).toContain('drip');
    expect(DRUM_VOICES).not.toContain('glass');
    expect(DRUM_VOICES).not.toContain('drip');
  });
});

describe('the music echo', () => {
  it('is 0.4 for Cenote Glow and its dusk version, and off for every other cue, which plays only the shared room reverb', () => {
    for (const cue of ALL_CUES) {
      const cenote = (cue.dayId ?? cue.id) === CENOTE_GLOW.id;
      expect(cue.echo, cue.id).toBe(cenote ? 0.4 : undefined);
    }
  });

  it("keeps a day cue's echo in its dusk version", () => {
    expect(duskVersion({ ...CANAL_PADDLE, echo: 0.4 }).echo).toBe(0.4);
    expect(duskVersion(CANAL_PADDLE).echo).toBeUndefined();
  });
});

describe('Cenote Glow (prototypes/music/sketches.html)', () => {
  const PER_LOOP = stepsPerLoop(CENOTE_GLOW);

  it('holds each bar on a soft pad and a deep bass from its first step', () => {
    notesOf(CENOTE_GLOW, SEED, 1).forEach((notes, index) => {
      const place = stepPlace(CENOTE_GLOW, index);
      const pads = notes.filter((n) => n.voice === 'pad');
      const basses = notes.filter((n) => n.voice === 'bass');
      if (place.step !== 0) {
        expect(pads).toHaveLength(0);
        expect(basses).toHaveLength(0);
        return;
      }
      expect(pads.map((n) => n.midi)).toEqual([...place.chord.notes]);
      expect(basses.map((n) => n.midi)).toEqual([place.chord.root]);
      for (const n of pads) expect(n.velocity).toBe(0.055);
    });
  });

  it('plays its tune on glass bells, resting every third pass for a glass line from the minor pentatonic above E5', () => {
    const steps = notesOf(CENOTE_GLOW, SEED, 6);
    const perBar = stepsPerBar(CENOTE_GLOW);
    for (let pass = 0; pass < 6; pass++) {
      const tune = steps.slice(pass * PER_LOOP, (pass + 1) * PER_LOOP).flat().filter((n) => n.part === 'tune');
      for (const n of tune) expect(n.voice).toBe('glass');
      if (pass % 3 !== 2) {
        CENOTE_GLOW.tune.forEach((tuneBar, barIndex) => {
          for (const tuneNote of tuneBar) {
            const played = steps[pass * PER_LOOP + barIndex * perBar + tuneNote.step].filter((n) => n.part === 'tune');
            expect(played.map((n) => n.midi)).toEqual([tuneNote.midi]);
          }
        });
        continue;
      }
      expect(tune.length).toBeGreaterThan(0);
      for (const n of tune) expect([0, 3, 5, 7, 10, 12]).toContain((n.midi ?? 0) - noteMidi('E5'));
    }
  });

  it('sparkles glass bells an octave above the chord on odd steps, drips water, and plays no drums', () => {
    const notes = notesOf(CENOTE_GLOW, SEED);
    notes.forEach((step, index) => {
      const place = stepPlace(CENOTE_GLOW, index);
      for (const n of step.filter((each) => each.part === 'chords' && each.voice === 'glass')) {
        expect(place.step % 2).toBe(1);
        expect(place.chord.notes.map((midi) => midi + 12)).toContain(n.midi);
      }
    });
    const flat = notes.flat();
    expect(flat.some((n) => n.part === 'chords' && n.voice === 'glass')).toBe(true);
    expect(flat.some((n) => n.voice === 'drip')).toBe(true);
    for (const n of flat) {
      expect(DRUM_VOICES).not.toContain(n.voice);
      expect(n.part).not.toBe('percussion');
      if (n.part === 'sparkles') expect(n.voice).toBe('drip');
    }
  });
});

describe('the key of Cenote Glow (S12)', () => {
  it("is D, the home note of E dorian's major key, in its dusk version too", () => {
    expect(CENOTE_GLOW.soundKey).toBe('D');
    expect(CENOTE_GLOW.tonic).toBe('D');
    expect(soundKeyFor(tripCueFor({ habitatId: SPRING_CAVE_HABITAT.id }))).toBe('D');
    expect(soundKeyFor(duskVersion(CENOTE_GLOW))).toBe('D');
  });

  it('plays every pitched sound from the D major pentatonic over it, which stays in E dorian', () => {
    const key = soundKeyFor(CENOTE_GLOW);
    for (const id of Object.keys(SOUNDS) as SoundId[]) {
      for (const version of Object.keys(SOUNDS[id].versions)) {
        for (const midi of soundNotes(id, version, key).flatMap((n) => n.midis)) {
          expect(inSoundKey(key, midi)).toBe(true);
          expect(E_DORIAN_PITCHES).toContain(midi % 12);
        }
      }
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
  it.each(ALL_CUES.map((cue) => [cue.name, cue] as const))('plays the same notes for the same seed: %s', (_, cue) => {
    expect(notesOf(cue, SEED)).toEqual(notesOf(cue, SEED));
  });

  it.each(ALL_CUES.map((cue) => [cue.name, cue] as const))('changes some notes from one pass to the next: %s', (_, cue) => {
    const steps = notesOf(cue, SEED);
    const perLoop = stepsPerLoop(cue);
    const passes = [0, 1, 2, 3].map((pass) => JSON.stringify(steps.slice(pass * perLoop, (pass + 1) * perLoop)));
    expect(new Set(passes).size).toBe(4);
  });

  it.each(ALL_CUES.map((cue) => [cue.name, cue] as const))('changes some notes for another seed: %s', (_, cue) => {
    expect(notesOf(cue, SEED)).not.toEqual(notesOf(cue, SEED + 1));
  });

  it.each([SUNNY_TANK, ...DAY_HABITAT_CUES].map((cue) => [cue.name, cue] as const))(
    'plays the tune on its steps in the first pass: %s',
    (_, cue) => {
      const steps = notesOf(cue, SEED, 1);
      const perBar = stepsPerBar(cue);
      cue.tune.forEach((tuneBar, barIndex) => {
        for (const tuneNote of tuneBar) {
          expect(tuneNote.step + tuneNote.len).toBeLessThanOrEqual(perBar);
          const played = steps[barIndex * perBar + tuneNote.step].filter((n) => n.part === 'tune');
          expect(played.map((n) => n.midi)).toContain(tuneNote.midi);
        }
      });
    },
  );

  it('rests the tune in the fourth pass, which makes up its own phrase', () => {
    const steps = notesOf(SUNNY_TANK, SEED);
    const fourth = steps.slice(3 * 64, 4 * 64).flat().filter((n) => n.part === 'tune');
    expect(fourth.length).toBeGreaterThan(0);
    const g5 = noteMidi('G5');
    for (const n of fourth) expect([0, 2, 4, 7, 9, 12]).toContain((n.midi ?? 0) - g5);
  });

  it.each(ALL_CUES.map((cue) => [cue.name, cue] as const))('keeps every note in range, gentle, and on time: %s', (_, cue) => {
    // A dusk echo or firefly may land up to a step late; every other note starts within its step.
    const latest = stepSeconds(cue) * (cue.version === 'dusk' ? 2 : 1);
    for (const n of notesOf(cue, SEED).flat()) {
      expect(n.velocity).toBeGreaterThan(0);
      expect(n.velocity).toBeLessThanOrEqual(0.5);
      expect(n.duration).toBeGreaterThan(0);
      expect(n.at).toBeGreaterThanOrEqual(0);
      expect(n.at).toBeLessThan(latest);
      if (UNPITCHED_VOICES.includes(n.voice)) expect(n.midi).toBeNull();
      else {
        expect(n.midi).not.toBeNull();
        expect(n.midi).toBeGreaterThanOrEqual(noteMidi('C2'));
        // Tunes and chords stay at or below C7; only the high, soft fireflies reach above it.
        expect(n.midi).toBeLessThanOrEqual(n.voice === 'firefly' ? noteMidi('E8') : noteMidi('C7'));
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
