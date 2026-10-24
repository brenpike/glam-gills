import { describe, expect, it } from 'vitest';
import * as areaText from './areaText';
import {
  AREA_BEATEN_TITLE,
  AREA_MAP_TITLE,
  NEW_AREA_LABEL,
  areaLabel,
  areaStarsText,
  areasLine,
  bestStarsLine,
  exitClosedText,
  habitatAreasLabel,
  lockedAreaText,
  snacksLeftLabel,
  starLines,
  starsShortLine,
} from './areaText';
import { AREAS, HABITATS, POND_2_AREA } from './areas';
import { ALL_TREASURES, treasureById } from './catalogue';
import { NO_STARS, STARS_PER_AREA, type AreaStars } from './stars';

/** The tripText.test banned list, plus "level" (areas are named "Area 1" in UI text). */
const BANNED = [
  'die',
  'dead',
  'death',
  'killed',
  'game over',
  'fail',
  'wipe',
  'injury',
  'wound',
  'damage',
  'monster',
  'invulnerab',
  'inventory',
  'checkpoint',
  'loot',
  ' base',
  'level',
];

/** The old compact snack counter label at its widest. */
const OLD_COMPACT_COUNTER = '16 / 16';

const SHORT_LINE_MAX = 34;

const EXIT_CLOSED_MAX = 49;

const SNACKS_LEFT_SAMPLES = [0, 1, 2, 3, 5, 16, 99];

/** Every catalogue treasure name, every area: any of them can be an area special. */
const SPECIAL_NAMES = ALL_TREASURES.map((treasure) => treasure.name);

const ALL_STARS: AreaStars = { exit: true, special: true, legsOrRescue: true };

const exportedStrings = Object.entries(areaText as Readonly<Record<string, unknown>>).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

/** Every AreaStars combination. */
function allStars(): AreaStars[] {
  const flags = [false, true];
  return flags.flatMap((exit) => flags.flatMap((special) => flags.map((legsOrRescue) => ({ exit, special, legsOrRescue }))));
}

/** Star lines for `earned` over every combination of rescued and rescueOpen. */
function allStarLines(earned: AreaStars, specialName: string): string[] {
  const flags = [false, true];
  return flags.flatMap((rescued) => flags.flatMap((rescueOpen) => starLines(earned, specialName, rescued, rescueOpen)));
}

/** Area number sets covering every areasLine form. */
const AREA_NUMBER_SAMPLES: readonly (readonly number[])[] = [[1], [2, 3], [1, 3], [5, 6, 7], [8, 9, 10], [1, 3, 8], [1, 2, 4]];

/** Every output of every text helper over the samples. */
function collectHelperOutputs(): string[] {
  const outputs: string[] = [areaLabel(1), areaLabel(12), lockedAreaText(2), lockedAreaText(12)];
  for (const numbers of AREA_NUMBER_SAMPLES) {
    outputs.push(areasLine(numbers));
    for (const habitat of HABITATS) outputs.push(habitatAreasLabel(habitat.name, numbers));
  }
  for (let count = 0; count <= STARS_PER_AREA; count += 1) outputs.push(areaStarsText(count));
  for (const left of SNACKS_LEFT_SAMPLES) outputs.push(snacksLeftLabel(left), exitClosedText(left));
  for (const earned of allStars()) {
    for (const name of SPECIAL_NAMES) outputs.push(...allStarLines(earned, name));
    outputs.push(bestStarsLine(areaLabel(1), earned));
    for (const best of allStars()) outputs.push(starsShortLine(earned, best));
  }
  return outputs;
}

describe('area text', () => {
  it.each(exportedStrings)('%s avoids harsh words and "level"', (_name, text) => {
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it('keeps every helper output free of harsh words and "level"', () => {
    for (const output of collectHelperOutputs()) {
      const lower = output.toLowerCase();
      for (const word of BANNED) expect(lower).not.toContain(word);
    }
  });

  it('names areas "Area N"', () => {
    expect(areaLabel(1)).toBe('Area 1');
    expect(AREA_BEATEN_TITLE).toBe('Area beaten!');
  });

  it('labels the snacks left no wider than the old compact counter', () => {
    expect(snacksLeftLabel(5)).toBe('5 left');
    for (const left of SNACKS_LEFT_SAMPLES) {
      expect(snacksLeftLabel(left).length).toBeLessThanOrEqual(OLD_COMPACT_COUNTER.length);
    }
  });

  it('says why the exit is closed, with singular and plural snacks', () => {
    expect(exitClosedText(5)).toBe('Eat every snack to open the exit! 5 snacks left.');
    expect(exitClosedText(1)).toBe('Eat every snack to open the exit! 1 snack left.');
    expect(exitClosedText(0)).toContain('0 snacks left.');
  });

  it('keeps the closed-exit text within 49 characters at 16 snacks left', () => {
    expect(exitClosedText(16).length).toBeLessThanOrEqual(EXIT_CLOSED_MAX);
  });
});

describe('starLines', () => {
  it('gives one line per star, praising earned stars', () => {
    const lines = starLines({ exit: true, special: true, legsOrRescue: true }, 'Sun hat', false, true);
    expect(lines).toEqual(['You reached the exit!', 'You found the Sun hat!', 'You kept all four legs!']);
  });

  it('says "next time" kindly for each missing star', () => {
    for (const rescueOpen of [false, true]) {
      const lines = starLines(NO_STARS, 'Sun hat', false, rescueOpen);
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(line).toContain('next time');
      expect(lines[1]).toContain('Sun hat');
    }
  });

  it('praises the rescue for an earned star 3 when an axolotl was rescued this trip', () => {
    for (const rescueOpen of [false, true]) {
      expect(starLines(ALL_STARS, 'Sun hat', true, rescueOpen)[2]).toBe('You rescued an axolotl friend!');
    }
  });

  it('praises the legs kept for an earned star 3 with no rescue this trip', () => {
    for (const rescueOpen of [false, true]) {
      expect(starLines(ALL_STARS, 'Sun hat', false, rescueOpen)[2]).toBe('You kept all four legs!');
    }
  });

  it('asks for a rescue or every leg for a missing star 3 while a rescue is open', () => {
    for (const rescued of [false, true]) {
      expect(starLines(NO_STARS, 'Sun hat', rescued, true)[2]).toBe('Rescue or keep every leg next time.');
    }
  });

  it('asks for all four legs only for a missing star 3 once no rescue is open', () => {
    for (const rescued of [false, true]) {
      expect(starLines(NO_STARS, 'Sun hat', rescued, false)[2]).toBe('Keep all four legs next time.');
    }
  });
});

describe('Area beaten card specials (H5, H8)', () => {
  it('names the Wooden duck decoy, the Area 3 special, in the star 2 lines', () => {
    expect(treasureById(POND_2_AREA.specialTreasureId)?.name).toBe('Wooden duck decoy');
    expect(SPECIAL_NAMES).toContain('Wooden duck decoy');
    expect(starLines(ALL_STARS, 'Wooden duck decoy', false, true)).toEqual([
      'You reached the exit!',
      'You found the Wooden duck decoy!',
      'You kept all four legs!',
    ]);
    expect(starLines(NO_STARS, 'Wooden duck decoy', false, true)).toEqual([
      'Reach the exit next time.',
      'Find the Wooden duck decoy next time.',
      'Rescue or keep every leg next time.',
    ]);
  });

  it('gives every area a catalogue special named in the star 2 line', () => {
    for (const area of AREAS) {
      const name = treasureById(area.specialTreasureId)?.name;
      if (name === undefined) throw new Error(`no catalogue special for ${area.id}`);
      expect(starLines(ALL_STARS, name, false, false)[1]).toBe(`You found the ${name}!`);
    }
  });
});

describe('star counts', () => {
  it('shows the best stars for an area', () => {
    expect(bestStarsLine('Area 1', { exit: true, special: false, legsOrRescue: true })).toBe('Area 1: 2 of 3 stars');
  });

  it('shows the stars earned and the best in a short line', () => {
    const earned: AreaStars = { exit: true, special: true, legsOrRescue: false };
    const best: AreaStars = { exit: true, special: true, legsOrRescue: true };
    expect(starsShortLine(earned, best)).toBe('2 of 3 stars! Best: 3 of 3.');
  });

  it('keeps the short line within 34 characters', () => {
    for (const earned of allStars()) {
      for (const best of allStars()) expect(starsShortLine(earned, best).length).toBeLessThanOrEqual(SHORT_LINE_MAX);
    }
  });
});

describe('area map text', () => {
  it('titles the map "Where to?" and tags new areas "New!"', () => {
    expect(AREA_MAP_TITLE).toBe('Where to?');
    expect(NEW_AREA_LABEL).toBe('New!');
  });

  it('names the area before the locked one', () => {
    expect(lockedAreaText(2)).toBe('Beat Area 1 to unlock!');
    expect(lockedAreaText(5)).toBe('Beat Area 4 to unlock!');
  });

  it.each([1, 0, -1, 2.5, Number.NaN])('rejects %s for the locked line', (areaNumber) => {
    expect(() => lockedAreaText(areaNumber)).toThrow(RangeError);
  });

  it('reads the stars count for a screen reader', () => {
    expect(areaStarsText(0)).toBe('0 of 3 stars');
    expect(areaStarsText(1)).toBe('1 of 3 stars');
    expect(areaStarsText(2)).toBe('2 of 3 stars');
    expect(areaStarsText(STARS_PER_AREA)).toBe('3 of 3 stars');
  });

  it.each([-1, STARS_PER_AREA + 1, 1.5, Number.NaN])('rejects %s for the stars text', (count) => {
    expect(() => areaStarsText(count)).toThrow(RangeError);
  });
});

describe('habitat area labels (issue #113, ND-6)', () => {
  it('names one area as areaLabel does', () => {
    expect(areasLine([1])).toBe('Area 1');
    expect(areasLine([4])).toBe(areaLabel(4));
  });

  it('joins two areas with "and"', () => {
    expect(areasLine([2, 3])).toBe('Areas 2 and 3');
    expect(areasLine([1, 3])).toBe('Areas 1 and 3');
  });

  it('gives three or more consecutive areas as a range', () => {
    expect(areasLine([5, 6, 7])).toBe('Areas 5 to 7');
    expect(areasLine([8, 9, 10])).toBe('Areas 8 to 10');
    expect(areasLine([1, 2, 3, 4, 5])).toBe('Areas 1 to 5');
  });

  it('lists any other set with commas and a last "and"', () => {
    expect(areasLine([1, 3, 8])).toBe('Areas 1, 3 and 8');
    expect(areasLine([1, 2, 4])).toBe('Areas 1, 2 and 4');
    expect(areasLine([1, 2, 3, 9])).toBe('Areas 1, 2, 3 and 9');
  });

  it('sorts the numbers ascending first', () => {
    expect(areasLine([3, 2])).toBe('Areas 2 and 3');
    expect(areasLine([7, 5, 6])).toBe('Areas 5 to 7');
    expect(areasLine([8, 1, 3])).toBe('Areas 1, 3 and 8');
  });

  it('does not change the list it is given', () => {
    const numbers = [3, 1, 2];
    areasLine(numbers);
    expect(numbers).toEqual([3, 1, 2]);
  });

  it('labels a habitat with its name and its areas', () => {
    expect(habitatAreasLabel('Canal', [1])).toBe('Canal: Area 1');
    expect(habitatAreasLabel('Lily pad pond', [2, 3])).toBe('Lily pad pond: Areas 2 and 3');
    expect(habitatAreasLabel('Chinampa gardens', [4, 5])).toBe('Chinampa gardens: Areas 4 and 5');
    expect(habitatAreasLabel('Spring cave', [5, 6, 7])).toBe('Spring cave: Areas 5 to 7');
  });

  it("labels today's habitats from the area table", () => {
    const labels = HABITATS.map((habitat) =>
      habitatAreasLabel(
        habitat.name,
        AREAS.filter((area) => area.habitatId === habitat.id).map((area) => area.number),
      ),
    );
    expect(labels).toEqual(['Canal: Area 1', 'Lily pad pond: Areas 2 and 3', 'Chinampa gardens: Areas 4 and 5']);
  });

  it('throws for an empty list', () => {
    expect(() => areasLine([])).toThrow(RangeError);
    expect(() => habitatAreasLabel('Canal', [])).toThrow(RangeError);
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('throws for the area number %s', (areaNumber) => {
    expect(() => areasLine([1, areaNumber])).toThrow(RangeError);
    expect(() => habitatAreasLabel('Canal', [areaNumber])).toThrow(RangeError);
  });

  it('throws for a number given twice', () => {
    expect(() => areasLine([2, 2])).toThrow(RangeError);
    expect(() => habitatAreasLabel('Lily pad pond', [2, 3, 2])).toThrow(RangeError);
  });
});
