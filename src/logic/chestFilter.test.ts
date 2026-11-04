import { describe, expect, it } from 'vitest';
import { AREAS, CANAL_AREA, POND_AREA, type AreaData } from './areas';
import { ALL_TREASURES, DREAM_COLOURS, RARITIES, type Treasure } from './catalogue';
import * as chestFilter from './chestFilter';
import {
  ALL_FOUND_TEXT,
  AREA_ALL_FOUND,
  FILTER_GROUPS,
  FILTER_GROUP_LABELS,
  FILTER_LABEL,
  FOUND_CHIPS,
  FOUND_CHIP_LABELS,
  NO_FILTER,
  NO_MATCH_TEXT,
  SHOW_ALL_LABEL,
  TYPE_CHIP_LABELS,
  areaCountText,
  areaProgress,
  clearFilter,
  entryMatches,
  filterSections,
  isFilterActive,
  noMatchText,
  toggleFilter,
  type ChestFilter,
} from './chestFilter';
import {
  CHEST_CATEGORIES,
  chestListing,
  chestPages,
  foundCountText,
  type ChestEntry,
  type ChestSection,
} from './treasureChest';

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

const exportedStrings = Object.entries(chestFilter as Record<string, unknown>).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

const ALL_IDS = ALL_TREASURES.map((treasure) => treasure.id);

function isListedTreasure(treasure: Treasure): boolean {
  return treasure.category === 'decoration' || treasure.category === 'wearable';
}

/** Ids of every other Decoration and Wearable, and every other Paint shell: about half found. */
const HALF_IDS = ALL_TREASURES.filter((_, index) => index % 2 === 0).map((treasure) => treasure.id);

const NONE_FOUND = chestListing([]);
const HALF_FOUND = chestListing(HALF_IDS);
const ALL_FOUND = chestListing(ALL_IDS);

function filterWith(changes: Partial<ChestFilter>): ChestFilter {
  return { ...NO_FILTER, ...changes };
}

function allEntries(sections: readonly ChestSection[]): ChestEntry[] {
  return sections.flatMap((section): readonly ChestEntry[] => section.entries);
}

function entryKeys(sections: readonly ChestSection[]): string[] {
  return allEntries(sections).map((entry) => `${entry.category}:${entry.id}`);
}

/** Ids of the treasures and Paint shell colours a layout holds. */
function layoutEntryKeys(area: Readonly<AreaData>): string[] {
  return area.layout.treasures.map((treasure) =>
    treasure.category === 'paintShell' ? `dreamColour:${treasure.dreamColour}` : `${treasure.category}:${treasure.id}`,
  );
}

describe('chest filter text', () => {
  it('exports every Filter string by name', () => {
    expect(exportedStrings.map(([name]) => name).sort()).toEqual([
      'ALL_FOUND_TEXT',
      'AREA_ALL_FOUND',
      'FILTER_LABEL',
      'NO_MATCH_TEXT',
      'SHOW_ALL_LABEL',
    ]);
  });

  it('uses the planned wording', () => {
    expect(FILTER_LABEL).toBe('Filter');
    expect(SHOW_ALL_LABEL).toBe('Show all');
    expect(AREA_ALL_FOUND).toBe('All found!');
    expect(NO_MATCH_TEXT).toBe('No treasures match. Try other filters!');
    expect(ALL_FOUND_TEXT).toBe('You found them all!');
    expect(FILTER_GROUP_LABELS).toEqual({ types: 'Type', found: 'Found?', rarities: 'Rarity', areaIds: 'Area' });
    expect(FOUND_CHIP_LABELS).toEqual({ found: 'Found', notFound: 'Not found' });
  });

  it('names the type chips like the section headings', () => {
    for (const section of NONE_FOUND) expect(TYPE_CHIP_LABELS[section.category]).toBe(section.heading);
    expect(Object.keys(TYPE_CHIP_LABELS)).toEqual([...CHEST_CATEGORIES]);
  });

  it('lists the groups and Found chips in display order', () => {
    expect(FILTER_GROUPS).toEqual(['types', 'found', 'rarities', 'areaIds']);
    expect(FOUND_CHIPS).toEqual(['found', 'notFound']);
  });

  it('keeps every string and helper output free of harsh or gamey words', () => {
    const outputs = [
      ...exportedStrings.map(([, text]) => text),
      ...Object.values(FILTER_GROUP_LABELS),
      ...Object.values(TYPE_CHIP_LABELS),
      ...Object.values(FOUND_CHIP_LABELS),
      ...areaProgress(HALF_FOUND).flatMap((item) => [item.label, item.countText]),
      ...areaProgress(ALL_FOUND).map((item) => item.countText),
      ...filterSections(HALF_FOUND, filterWith({ found: ['found'] })).map((section) => section.countText),
    ];
    for (const output of outputs) {
      const lower = output.toLowerCase();
      for (const word of BANNED) expect(lower).not.toContain(word);
    }
  });
});

describe('toggleFilter, clearFilter and isFilterActive', () => {
  it('starts with no chip on', () => {
    expect(isFilterActive(NO_FILTER)).toBe(false);
    for (const group of FILTER_GROUPS) expect(NO_FILTER[group]).toEqual([]);
  });

  it('turns a chip on, then off, without changing the old filter', () => {
    const on = toggleFilter(NO_FILTER, 'rarities', 'epic');
    expect(on.rarities).toEqual(['epic']);
    expect(NO_FILTER.rarities).toEqual([]);
    expect(isFilterActive(on)).toBe(true);
    const off = toggleFilter(on, 'rarities', 'epic');
    expect(off.rarities).toEqual([]);
    expect(on.rarities).toEqual(['epic']);
    expect(isFilterActive(off)).toBe(false);
  });

  it('leaves other groups alone', () => {
    const filter = toggleFilter(toggleFilter(NO_FILTER, 'types', 'wearable'), 'areaIds', POND_AREA.id);
    expect(filter).toEqual({ types: ['wearable'], found: [], rarities: [], areaIds: [POND_AREA.id] });
  });

  it('clears every group', () => {
    const filter = toggleFilter(toggleFilter(NO_FILTER, 'found', 'found'), 'types', 'decoration');
    expect(isFilterActive(filter)).toBe(true);
    expect(clearFilter()).toEqual(NO_FILTER);
    expect(isFilterActive(clearFilter())).toBe(false);
  });
});

describe('filterSections', () => {
  it('returns the whole listing unchanged with no filter', () => {
    for (const listing of [NONE_FOUND, HALF_FOUND, ALL_FOUND]) {
      expect(filterSections(listing, NO_FILTER)).toEqual([...listing]);
    }
  });

  it('keeps listing and paging exactly as today with no filter', () => {
    expect(chestPages(filterSections(NONE_FOUND, NO_FILTER), 3)).toEqual(chestPages(NONE_FOUND, 3));
  });

  it('treats Found plus Not found the same as neither', () => {
    const both = filterWith({ found: ['found', 'notFound'] });
    expect(filterSections(HALF_FOUND, both)).toEqual(filterSections(HALF_FOUND, NO_FILTER));
    const bothEpic = filterWith({ found: ['notFound', 'found'], rarities: ['epic'] });
    expect(filterSections(HALF_FOUND, bothEpic)).toEqual(filterSections(HALF_FOUND, filterWith({ rarities: ['epic'] })));
  });

  it('widens the list with more chips in one group (OR)', () => {
    const common = allEntries(filterSections(HALF_FOUND, filterWith({ rarities: ['common'] })));
    const rare = allEntries(filterSections(HALF_FOUND, filterWith({ rarities: ['rare'] })));
    const either = allEntries(filterSections(HALF_FOUND, filterWith({ rarities: ['common', 'rare'] })));
    expect(either.length).toBe(common.length + rare.length);
    expect(either.every((entry) => entry.rarity === 'common' || entry.rarity === 'rare')).toBe(true);
    expect(common.length).toBeGreaterThan(0);
    expect(rare.length).toBeGreaterThan(0);
  });

  it('narrows the list with chips in more groups (AND)', () => {
    const filter = filterWith({ types: ['wearable'], found: ['notFound'], areaIds: [CANAL_AREA.id] });
    const entries = allEntries(filterSections(HALF_FOUND, filter));
    const expected = allEntries(HALF_FOUND).filter(
      (entry) => entry.category === 'wearable' && !entry.found && entry.areaId === CANAL_AREA.id,
    );
    expect(entries).toEqual(expected);
    for (const entry of allEntries(HALF_FOUND)) {
      expect(entryMatches(entry, filter)).toBe(expected.includes(entry));
    }
  });

  it('keeps section and catalogue order', () => {
    const filter = filterWith({ rarities: ['rare', 'common'] });
    const kept = filterSections(HALF_FOUND, filter);
    const order = entryKeys(HALF_FOUND);
    const keptKeys = entryKeys(kept);
    const positions = keptKeys.map((key) => order.indexOf(key));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(kept.map((section) => section.category)).toEqual([...CHEST_CATEGORIES]);
  });

  it("recounts each kept section's found, total and countText for its matches", () => {
    const filter = filterWith({ areaIds: [POND_AREA.id, CANAL_AREA.id] });
    const kept = filterSections(HALF_FOUND, filter);
    expect(kept.length).toBeGreaterThan(0);
    for (const section of kept) {
      const original = HALF_FOUND.find((candidate) => candidate.category === section.category);
      const matches = original?.entries.filter((entry) => entryMatches(entry, filter)) ?? [];
      const found = matches.filter((entry) => entry.found).length;
      expect(section.entries).toEqual(matches);
      expect(section.total).toBe(matches.length);
      expect(section.found).toBe(found);
      expect(section.countText).toBe(foundCountText(found, matches.length));
      expect(section.heading).toBe(original?.heading);
      expect(section.line).toBe(original?.line);
      expect(section.shortLine).toBe(original?.shortLine);
    }
  });

  it('counts every match as found under the Found chip', () => {
    for (const section of filterSections(HALF_FOUND, filterWith({ found: ['found'] }))) {
      expect(section.found).toBe(section.total);
    }
  });

  it('drops sections with no match', () => {
    const kept = filterSections(HALF_FOUND, filterWith({ types: ['dreamColour', 'decoration'] }));
    expect(kept.map((section) => section.category)).toEqual(['decoration', 'dreamColour']);
    expect(filterSections(ALL_FOUND, filterWith({ found: ['notFound'] }))).toEqual([]);
    expect(filterSections(NONE_FOUND, filterWith({ found: ['found'] }))).toEqual([]);
  });

  it('drops an entry no area holds under any area filter', () => {
    const noAreas: readonly AreaData[] = [];
    const listing = chestListing([], noAreas);
    expect(allEntries(listing).every((entry) => entry.areaId === null)).toBe(true);
    expect(filterSections(listing, filterWith({ areaIds: [CANAL_AREA.id] }))).toEqual([]);
    expect(entryKeys(filterSections(listing, NO_FILTER))).toEqual(entryKeys(listing));
  });

  it('splits the listing across the rarity chips', () => {
    const kept = RARITIES.flatMap((rarity) => allEntries(filterSections(NONE_FOUND, filterWith({ rarities: [rarity] }))));
    expect(kept.length).toBe(allEntries(NONE_FOUND).length);
  });

  it('pages an empty result without throwing', () => {
    expect(() => chestPages(filterSections(ALL_FOUND, filterWith({ found: ['notFound'] })), 3)).not.toThrow();
  });
});

describe('noMatchText', () => {
  it('says the player found them all only when Not found alone is on', () => {
    expect(noMatchText(filterWith({ found: ['notFound'] }))).toBe(ALL_FOUND_TEXT);
    expect(noMatchText(filterWith({ found: ['notFound'], rarities: ['epic'] }))).toBe(ALL_FOUND_TEXT);
    expect(noMatchText(NO_FILTER)).toBe(NO_MATCH_TEXT);
    expect(noMatchText(filterWith({ found: ['found'] }))).toBe(NO_MATCH_TEXT);
    expect(noMatchText(filterWith({ found: ['found', 'notFound'] }))).toBe(NO_MATCH_TEXT);
  });
});

describe('areaProgress', () => {
  it('gives one item per area in AREAS order', () => {
    const progress = areaProgress(NONE_FOUND);
    expect(progress.map((item) => item.areaId)).toEqual(AREAS.map((area) => area.id));
    expect(progress.map((item) => item.number)).toEqual(AREAS.map((area) => area.number));
    expect(progress.map((item) => item.label)).toEqual(AREAS.map((area) => `Area ${area.number}`));
  });

  it('sums area totals to the whole catalogue, each treasure in exactly one area', () => {
    const catalogueCount = ALL_TREASURES.filter(isListedTreasure).length + DREAM_COLOURS.length;
    const total = areaProgress(NONE_FOUND).reduce((sum, item) => sum + item.total, 0);
    expect(allEntries(NONE_FOUND).length).toBe(catalogueCount);
    expect(total).toBe(catalogueCount);
    const holders = new Map<string, number>();
    for (const area of AREAS) for (const key of layoutEntryKeys(area)) holders.set(key, (holders.get(key) ?? 0) + 1);
    for (const key of entryKeys(NONE_FOUND)) expect(holders.get(key), key).toBe(1);
  });

  it('counts found treasures per area', () => {
    for (const item of areaProgress(HALF_FOUND)) {
      const held = allEntries(HALF_FOUND).filter((entry) => entry.areaId === item.areaId);
      expect(item.total).toBe(held.length);
      expect(item.found).toBe(held.filter((entry) => entry.found).length);
      expect(item.total).toBeGreaterThan(0);
    }
  });

  it('marks an area complete only when every treasure there is found', () => {
    expect(areaProgress(NONE_FOUND).every((item) => !item.complete)).toBe(true);
    expect(areaProgress(ALL_FOUND).every((item) => item.complete)).toBe(true);
    const canalIds = layoutEntryKeys(CANAL_AREA).length;
    const canalOnly = chestListing(CANAL_AREA.layout.treasures.map((treasure) => treasure.id));
    const progress = areaProgress(canalOnly);
    expect(progress.find((item) => item.areaId === CANAL_AREA.id)).toMatchObject({
      found: canalIds,
      total: canalIds,
      complete: true,
      countText: AREA_ALL_FOUND,
    });
    expect(progress.filter((item) => item.areaId !== CANAL_AREA.id).every((item) => !item.complete)).toBe(true);
  });

  it('never marks an area with no treasures complete', () => {
    const progress = areaProgress([], AREAS);
    expect(progress.every((item) => item.total === 0 && !item.complete)).toBe(true);
    expect(progress.every((item) => item.countText === '0 of 0')).toBe(true);
  });

  it("writes each area chip's count line", () => {
    expect(areaCountText(2, 5)).toBe('2 of 5');
    expect(areaCountText(0, 5)).toBe('0 of 5');
    expect(areaCountText(5, 5)).toBe(AREA_ALL_FOUND);
    expect(areaCountText(0, 0)).toBe('0 of 0');
    for (const item of areaProgress(HALF_FOUND)) {
      expect(item.countText).toBe(item.complete ? AREA_ALL_FOUND : `${item.found} of ${item.total}`);
    }
  });
});
