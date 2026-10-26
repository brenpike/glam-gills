import { describe, expect, it } from 'vitest';
import * as tankText from './tankText';
import {
  ALL_DECORATIONS_PLACED,
  DECORATE_HINT,
  GO_EXPLORING_LABEL,
  HOME_TANK_NAME,
  NO_DECORATIONS_TO_PLACE,
  REFUGE_LABEL,
} from './tankText';

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
  'fish tank',
];

const exportedStrings = Object.entries(tankText as Record<string, unknown>).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

describe('tank text', () => {
  it('exports every Home Tank string by name', () => {
    expect(exportedStrings.map(([name]) => name).sort()).toEqual([
      'ALL_DECORATIONS_PLACED',
      'CLOSE_LABEL',
      'COLLECTION_BOOK_LABEL',
      'DECORATE_HINT',
      'DECORATE_LABEL',
      'DONE_LABEL',
      'GO_EXPLORING_LABEL',
      'HOME_TANK_NAME',
      'NEXT_PAGE_LABEL',
      'NO_DECORATIONS_TO_PLACE',
      'PREVIOUS_PAGE_LABEL',
      'PUT_AWAY_LABEL',
      'REFUGE_LABEL',
      'SOUND_LABEL',
      'TREASURE_CHEST_LABEL',
    ]);
  });

  it.each(exportedStrings)('%s avoids harsh or gamey words', (_name, text) => {
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it.each(exportedStrings)('%s says "Home Tank" whenever it names the tank', (_name, text) => {
    const tankMentions = text.match(/\btank\b/gi) ?? [];
    const homeTankMentions = text.match(/Home Tank/g) ?? [];
    expect(tankMentions.length).toBe(homeTankMentions.length);
  });

  it('names the hub "Home Tank" and the explore button "Go exploring"', () => {
    expect(HOME_TANK_NAME).toBe('Home Tank');
    expect(GO_EXPLORING_LABEL).toBe('Go exploring');
  });

  it('names the refuge button "Refuge"', () => {
    expect(REFUGE_LABEL).toBe('Refuge');
  });

  it('teaches decorating by touch and by keyboard', () => {
    expect(DECORATE_HINT.toLowerCase()).toContain('drag');
    expect(DECORATE_HINT.toLowerCase()).toContain('arrow keys');
  });

  it('names the Home Tank in the decorating messages', () => {
    expect(NO_DECORATIONS_TO_PLACE).toContain('Home Tank');
    expect(ALL_DECORATIONS_PLACED).toContain('Home Tank');
  });
});
