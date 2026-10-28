import { describe, expect, it } from 'vitest';
import { DREAM_COLOURS, type DreamColourId } from './catalogue';
import {
  MAX_DREAM_OPTIONS,
  REAL_COLOUR_OPTION_ID,
  canWearDream,
  dreamOptionIds,
  isDreamColourId,
  wornDreamOrNone,
} from './dreamPaint';

describe('REAL_COLOUR_OPTION_ID and MAX_DREAM_OPTIONS', () => {
  it('is never a Dream colour id', () => {
    expect(REAL_COLOUR_OPTION_ID).toBe('real-colour');
    expect(isDreamColourId(REAL_COLOUR_OPTION_ID)).toBe(false);
  });

  it('offers at most the real colour and all 17 Dream colours', () => {
    expect(MAX_DREAM_OPTIONS).toBe(18);
    expect(MAX_DREAM_OPTIONS).toBe(DREAM_COLOURS.length + 1);
  });
});

describe('isDreamColourId', () => {
  it('is true for every Dream colour id', () => {
    for (const colour of DREAM_COLOURS) expect(isDreamColourId(colour.id)).toBe(true);
  });

  it('is false for unknown ids and non-strings', () => {
    for (const value of ['plaid', '', 'Mint', 'canal/paint-shell-mint', 'wild', null, undefined, 3, {}, ['mint']]) {
      expect(isDreamColourId(value)).toBe(false);
    }
  });
});

describe('canWearDream (F14)', () => {
  it('always allows the real colour, even with nothing owned', () => {
    expect(canWearDream([], null)).toBe(true);
    expect(canWearDream(['mint'], null)).toBe(true);
  });

  it('allows a Dream colour only when it is owned', () => {
    expect(canWearDream(['mint', 'galaxy'], 'galaxy')).toBe(true);
    expect(canWearDream(['mint'], 'galaxy')).toBe(false);
    expect(canWearDream([], 'mint')).toBe(false);
  });
});

describe('wornDreamOrNone', () => {
  it('keeps an owned Dream colour', () => {
    expect(wornDreamOrNone('hearts', ['mint', 'hearts'])).toBe('hearts');
  });

  it('gives null for a missing, unknown or not owned value', () => {
    const owned: DreamColourId[] = ['mint'];
    for (const value of [undefined, null, 'plaid', REAL_COLOUR_OPTION_ID, 'galaxy', 7, { id: 'mint' }]) {
      expect(wornDreamOrNone(value, owned)).toBeNull();
    }
    expect(wornDreamOrNone('mint', [])).toBeNull();
  });
});

describe('dreamOptionIds (F14)', () => {
  it('is only the real colour when nothing is owned', () => {
    expect(dreamOptionIds([])).toEqual([REAL_COLOUR_OPTION_ID]);
  });

  it('puts the real colour first, then the owned colours in DREAM_COLOURS order', () => {
    expect(dreamOptionIds(['galaxy', 'mint', 'hearts'])).toEqual([REAL_COLOUR_OPTION_ID, 'mint', 'hearts', 'galaxy']);
  });

  it('de-duplicates and drops unknown ids', () => {
    expect(dreamOptionIds(['lavender', 'plaid', 'lavender', REAL_COLOUR_OPTION_ID, 'rainbow'])).toEqual([
      REAL_COLOUR_OPTION_ID,
      'lavender',
      'rainbow',
    ]);
  });

  it('offers MAX_DREAM_OPTIONS options when every Dream colour is owned', () => {
    const all = [...DREAM_COLOURS].reverse().map((colour) => colour.id);
    const options = dreamOptionIds(all);
    expect(options).toHaveLength(MAX_DREAM_OPTIONS);
    expect(options).toEqual([REAL_COLOUR_OPTION_ID, ...DREAM_COLOURS.map((colour) => colour.id)]);
  });
});
