/**
 * Treasure Chest filters (PRD C11, C12): which chips are on, which entries match them, and how many
 * treasures each area holds and has given up. Pure data; the Filter screen's layout and drawing live
 * elsewhere.
 */
import { AREAS, type AreaData } from './areas';
import { areaLabel } from './areaText';
import type { Rarity } from './catalogue';
import {
  foundCountText,
  type ChestCategory,
  type ChestEntry,
  type ChestSection,
  type ChestSectionOf,
} from './treasureChest';

/** Label of the chest's Filter tile. */
export const FILTER_LABEL = 'Filter';

/** Label of the button that turns every chip off. */
export const SHOW_ALL_LABEL = 'Show all';

/** Count line of an area chip when every treasure the area holds is found. */
export const AREA_ALL_FOUND = 'All found!';

/** The one page the chest shows when no entry matches the filter. */
export const NO_MATCH_TEXT = 'No treasures match. Try other filters!';

/** The one page the chest shows when no entry matches and only Not found is on in the Found group. */
export const ALL_FOUND_TEXT = 'You found them all!';

/** A Found group chip. */
export type FoundChip = 'found' | 'notFound';

/** Every Found group chip in display order. */
export const FOUND_CHIPS: readonly FoundChip[] = Object.freeze(['found', 'notFound']);

/**
 * Chips that are on, one list per group. Chips in one group widen the list (OR); groups narrow it
 * together (AND). A group with no chip on does not limit the list.
 */
export interface ChestFilter {
  readonly types: readonly ChestCategory[];
  readonly found: readonly FoundChip[];
  readonly rarities: readonly Rarity[];
  readonly areaIds: readonly string[];
}

/** A filter group. */
export type FilterGroup = keyof ChestFilter;

/** Every filter group in display order. */
export const FILTER_GROUPS: readonly FilterGroup[] = Object.freeze(['types', 'found', 'rarities', 'areaIds']);

/** Group name shown over each group's chips. */
export const FILTER_GROUP_LABELS: Readonly<Record<FilterGroup, string>> = Object.freeze({
  types: 'Type',
  found: 'Found?',
  rarities: 'Rarity',
  areaIds: 'Area',
});

/** Type chip labels, the same words as the chest's section headings. */
export const TYPE_CHIP_LABELS: Readonly<Record<ChestCategory, string>> = Object.freeze({
  decoration: 'Decorations',
  wearable: 'Wearables',
  dreamColour: 'Dream colours',
});

/** Found chip labels. */
export const FOUND_CHIP_LABELS: Readonly<Record<FoundChip, string>> = Object.freeze({
  found: 'Found',
  notFound: 'Not found',
});

/** The filter with no chip on: the whole listing shows. */
export const NO_FILTER: Readonly<ChestFilter> = Object.freeze({
  types: Object.freeze([]),
  found: Object.freeze([]),
  rarities: Object.freeze([]),
  areaIds: Object.freeze([]),
});

/** How many of the treasures an area holds are found, counted on the unfiltered listing. */
export interface AreaProgress {
  readonly areaId: string;
  readonly number: number;
  readonly label: string;
  readonly found: number;
  readonly total: number;
  readonly complete: boolean;
  /** The area chip's count line: 'X of Y', or AREA_ALL_FOUND when complete. */
  readonly countText: string;
}

/** A new filter with `value` turned on in `group` when it was off, or off when it was on. */
export function toggleFilter<G extends FilterGroup>(
  filter: Readonly<ChestFilter>,
  group: G,
  value: ChestFilter[G][number],
): ChestFilter {
  const chips: readonly ChestFilter[G][number][] = filter[group];
  const toggled = chips.includes(value) ? chips.filter((chip) => chip !== value) : [...chips, value];
  return { ...filter, [group]: toggled };
}

/** The filter with every chip off (Show all). */
export function clearFilter(): Readonly<ChestFilter> {
  return NO_FILTER;
}

/** True when any group has a chip on. */
export function isFilterActive(filter: Readonly<ChestFilter>): boolean {
  return FILTER_GROUPS.some((group) => filter[group].length > 0);
}

/** The Found chip an entry matches. */
function foundChipOf(entry: ChestEntry): FoundChip {
  return entry.found ? 'found' : 'notFound';
}

/** True when `chips` is empty or holds `value`. */
function groupAllows<T>(chips: readonly T[], value: T): boolean {
  return chips.length === 0 || chips.includes(value);
}

/** True when `entry` matches every group of `filter` with a chip on. An entry no area holds fails any Area chip. */
export function entryMatches(entry: ChestEntry, filter: Readonly<ChestFilter>): boolean {
  return (
    groupAllows(filter.types, entry.category) &&
    groupAllows(filter.found, foundChipOf(entry)) &&
    groupAllows(filter.rarities, entry.rarity) &&
    (filter.areaIds.length === 0 || (entry.areaId !== null && filter.areaIds.includes(entry.areaId)))
  );
}

function filterSection<C extends ChestCategory, E extends ChestEntry>(
  section: ChestSectionOf<C, E>,
  filter: Readonly<ChestFilter>,
): ChestSectionOf<C, E> {
  const entries = section.entries.filter((entry) => entryMatches(entry, filter));
  const found = entries.filter((entry) => entry.found).length;
  return { ...section, entries, found, total: entries.length, countText: foundCountText(found, entries.length) };
}

function filterAnySection(section: ChestSection, filter: Readonly<ChestFilter>): ChestSection {
  switch (section.category) {
    case 'decoration':
      return filterSection(section, filter);
    case 'wearable':
      return filterSection(section, filter);
    case 'dreamColour':
      return filterSection(section, filter);
  }
}

/**
 * The sections with only the entries that match `filter`, in section and catalogue order. Each kept
 * section's found, total and countText count its matches only; a section with no match is dropped.
 */
export function filterSections(sections: readonly ChestSection[], filter: Readonly<ChestFilter>): ChestSection[] {
  return sections
    .map((section) => filterAnySection(section, filter))
    .filter((section) => section.entries.length > 0);
}

/** What the one empty-result page says: ALL_FOUND_TEXT when only Not found is on in the Found group, else NO_MATCH_TEXT. */
export function noMatchText(filter: Readonly<ChestFilter>): string {
  return filter.found.length === 1 && filter.found[0] === 'notFound' ? ALL_FOUND_TEXT : NO_MATCH_TEXT;
}

/** An area chip's count line, e.g. '2 of 5', or AREA_ALL_FOUND when every treasure there is found. */
export function areaCountText(found: number, total: number): string {
  return total > 0 && found === total ? AREA_ALL_FOUND : `${found} of ${total}`;
}

function createAreaProgress(area: Readonly<AreaData>, entries: readonly ChestEntry[]): AreaProgress {
  const held = entries.filter((entry) => entry.areaId === area.id);
  const found = held.filter((entry) => entry.found).length;
  return {
    areaId: area.id,
    number: area.number,
    label: areaLabel(area.number),
    found,
    total: held.length,
    complete: held.length > 0 && found === held.length,
    countText: areaCountText(found, held.length),
  };
}

/**
 * One item per area in `areas` order: how many of the entries it holds are found. Pass the
 * unfiltered listing, so no other group changes an area's count.
 */
export function areaProgress(
  sections: readonly ChestSection[],
  areas: readonly Readonly<AreaData>[] = AREAS,
): AreaProgress[] {
  const entries = sections.flatMap((section): readonly ChestEntry[] => section.entries);
  return areas.map((area) => createAreaProgress(area, entries));
}
