/**
 * Treasure Chest listing (PRD C11, F10, F15): every Decoration, Wearable and Dream colour, found or
 * not, with found counts, section lines, entry text and pages. Pure data; drawing lives in the scene
 * and art layers.
 */
import { AREAS, habitatById, type AreaData } from './areas';
import { habitatAreasLabel } from './areaText';
import {
  ALL_TREASURES,
  DREAM_COLOURS,
  ownedDreamColours,
  type Decoration,
  type DreamColour,
  type DreamColourId,
  type Perk,
  type PerkType,
  type Rarity,
  type Treasure,
  type Wearable,
  type WearableSlot,
} from './catalogue';
import { badgeShape, rarityName, type BadgeShape } from './hints';

/** Label every Dream colour carries in the Treasure Chest (PRD C11, F15). */
export const DREAM_COLOUR_LABEL = 'Dream colour — not found in nature';

/** Name an unfound treasure shows in the Treasure Chest. */
export const UNFOUND_NAME = '???';

/**
 * Where to look for an unfound treasure of each rarity (PRD B6). Paint shells, and so Dream colours,
 * use their rarity's hint.
 */
export const UNFOUND_HINTS: Readonly<Record<Rarity, string>> = Object.freeze({
  common: 'Look near the main swim path!',
  rare: 'Look off the main path!',
  epic: 'Look in a cave or log, or past the current!',
  legendary: 'Break a Dash pot with Tail Dash!',
});

/** Treasure Chest section kind, in display order. */
export type ChestCategory = 'decoration' | 'wearable' | 'dreamColour';

/** Every Treasure Chest section kind in display order. */
export const CHEST_CATEGORIES: readonly ChestCategory[] = Object.freeze([
  'decoration',
  'wearable',
  'dreamColour',
]);

/** What each section holds and how to use it, under the section heading. */
export const SECTION_LINES: Readonly<Record<ChestCategory, string>> = Object.freeze({
  decoration: "Things to put in your tank. Open the tank's decorate mode to place them.",
  wearable: 'Clothes for your axolotls. Each one gives a perk on trips. Dress up in Restyle.',
  dreamColour: 'Magic paints from Paint shells. Not found in nature! Put one on in Restyle.',
});

/** Short section lines, used when the full ones leave no room for a whole entry row. */
export const SHORT_SECTION_LINES: Readonly<Record<ChestCategory, string>> = Object.freeze({
  decoration: 'Place them in decorate mode.',
  wearable: 'Wear them in Restyle for perks.',
  dreamColour: 'Magic paints. Use in Restyle.',
});

/** Gap between a section heading and its section line, CSS px. */
export const SECTION_LINE_GAP_PX = 4;

/** Which section lines the chest shows: SECTION_LINES or SHORT_SECTION_LINES. */
export type SectionLineLength = 'full' | 'short';

/** Display name of a Wearable slot. */
export type SlotName = 'Head' | 'Neck' | 'Face' | 'Shirt' | 'Back' | 'Tail' | 'Socks' | 'Feet';

/**
 * Fields every Treasure Chest entry has. An unfound entry is named UNFOUND_NAME and has its area's
 * hint (areaHint), or its rarity's plain hint when no area holds it; a found entry has its own name
 * and an empty hint. Rarity, rarity name and badge always show.
 */
export interface ChestEntryBase {
  readonly name: string;
  readonly rarity: Rarity;
  readonly rarityName: string;
  readonly badge: BadgeShape;
  readonly found: boolean;
  readonly hint: string;
}

/** One catalogue Decoration. `id` is its treasure id. */
export interface DecorationEntry extends ChestEntryBase {
  readonly id: string;
}

/**
 * One catalogue Wearable, with its slot and perk (F10), e.g. detailText 'Head · Speed +4%'. An
 * unfound Wearable shows its slot only: perk null, detailText the slot name, e.g. 'Head'.
 */
export interface WearableEntry extends ChestEntryBase {
  readonly id: string;
  readonly slot: WearableSlot;
  readonly slotName: SlotName;
  readonly perk: Perk | null;
  readonly detailText: string;
}

/**
 * One catalogue Dream colour, found or not; it always carries its label. `id` is the Dream colour id, which is also the swatch id the art layer
 * draws. `patterned` is true for patterned and sheen colours; solid colours show their name.
 */
export interface DreamColourEntry extends ChestEntryBase {
  readonly id: DreamColourId;
  readonly patterned: boolean;
  readonly label: string;
}

/** Any Treasure Chest entry. */
export type ChestEntry = DecorationEntry | WearableEntry | DreamColourEntry;

/**
 * One Treasure Chest section of one kind, with its "X of Y found" count, its full and short section
 * lines, and an entry for every catalogue treasure of the kind.
 */
export interface ChestSectionOf<C extends ChestCategory, E extends ChestEntry> {
  readonly category: C;
  readonly heading: string;
  readonly found: number;
  readonly total: number;
  readonly countText: string;
  readonly entries: readonly E[];
  readonly line: string;
  readonly shortLine: string;
}

/** The Decorations section. */
export type DecorationSection = ChestSectionOf<'decoration', DecorationEntry>;

/** The Wearables section. */
export type WearableSection = ChestSectionOf<'wearable', WearableEntry>;

/** The Dream colours section. */
export type DreamColourSection = ChestSectionOf<'dreamColour', DreamColourEntry>;

/** Any Treasure Chest section. */
export type ChestSection = DecorationSection | WearableSection | DreamColourSection;

/** One page of one section: the section and the slice of its entries shown on the page. */
export interface ChestPageOf<C extends ChestCategory, E extends ChestEntry> {
  readonly section: ChestSectionOf<C, E>;
  readonly entries: readonly E[];
}

/** Any Treasure Chest page. */
export type ChestPage =
  | ChestPageOf<'decoration', DecorationEntry>
  | ChestPageOf<'wearable', WearableEntry>
  | ChestPageOf<'dreamColour', DreamColourEntry>;

const SLOT_NAMES: Readonly<Record<WearableSlot, SlotName>> = Object.freeze({
  head: 'Head',
  neck: 'Neck',
  face: 'Face',
  shirt: 'Shirt',
  back: 'Back',
  tail: 'Tail',
  socks: 'Socks',
  feet: 'Feet',
});

const PERCENT_PERK_NAMES: Readonly<Record<Exclude<PerkType, 'snackMagnet' | 'shell'>, string>> =
  Object.freeze({
    speed: 'Speed',
    regrowth: 'Regrowth',
    dash: 'Dash',
    treasureSense: 'Treasure sense',
  });

const HEADINGS: Readonly<Record<ChestCategory, string>> = Object.freeze({
  decoration: 'Decorations',
  wearable: 'Wearables',
  dreamColour: 'Dream colours',
});

const DECORATIONS: readonly Decoration[] = ALL_TREASURES.filter(isDecoration);

const WEARABLES: readonly Wearable[] = ALL_TREASURES.filter(isWearable);

function isDecoration(treasure: Treasure): treasure is Decoration {
  return treasure.category === 'decoration';
}

function isWearable(treasure: Treasure): treasure is Wearable {
  return treasure.category === 'wearable';
}

/** Display name of a Wearable slot, e.g. 'Head'. */
export function slotName(slot: WearableSlot): SlotName {
  return SLOT_NAMES[slot];
}

/**
 * Perk text with its value (F10). Speed, regrowth, dash and treasure sense are percent, e.g.
 * 'Speed +4%'; snack magnet is px of pull, e.g. 'Snack magnet +30'; shell is hits blocked, e.g.
 * 'Shell blocks 1 hit'.
 */
export function perkText(perk: Perk): string {
  if (perk.type === 'snackMagnet') return `Snack magnet +${perk.value}`;
  if (perk.type === 'shell') return `Shell blocks ${perk.value} ${perk.value === 1 ? 'hit' : 'hits'}`;
  return `${PERCENT_PERK_NAMES[perk.type]} +${perk.value}%`;
}

/** Wearable slot and perk on one line, e.g. 'Head · Speed +4%'. */
export function wearableDetailText(slot: WearableSlot, perk: Perk): string {
  return `${slotName(slot)} · ${perkText(perk)}`;
}

/** Where to look for an unfound treasure of `rarity` (PRD B6), e.g. 'Look off the main path!'. */
export function unfoundHint(rarity: Rarity): string {
  return UNFOUND_HINTS[rarity];
}

/**
 * The first of `areas` whose layout holds the treasure with this id, or undefined when none does.
 * Found by layout, never by id prefix: Area 2 and Area 3 both use 'pond/' ids.
 */
export function treasureAreaOf(
  treasureId: string,
  areas: readonly Readonly<AreaData>[] = AREAS,
): Readonly<AreaData> | undefined {
  return areas.find((area) => area.layout.treasures.some((treasure) => treasure.id === treasureId));
}

/** The first of `areas` whose layout holds the Paint shell of this Dream colour, or undefined when none does. */
export function dreamColourAreaOf(
  colourId: string,
  areas: readonly Readonly<AreaData>[] = AREAS,
): Readonly<AreaData> | undefined {
  return areas.find((area) =>
    area.layout.treasures.some((treasure) => treasure.category === 'paintShell' && treasure.dreamColour === colourId),
  );
}

/** `text` with its first letter lower-cased, e.g. 'look near'. */
function lowerFirstLetter(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Where to look for an unfound treasure of `rarity` in `area` (PRD C11, B6; issue #113, ND-9): the
 * habitat and area, then the rarity hint, e.g. 'Lily pad pond: Area 3: look in a cave or log, or past
 * the current!'. The plain unfoundHint when the area's habitat is unknown.
 */
export function areaHint(area: Readonly<AreaData>, rarity: Rarity): string {
  const habitat = habitatById(area.habitatId);
  if (habitat === undefined) return unfoundHint(rarity);
  return `${habitatAreasLabel(habitat.name, [area.number])}: ${lowerFirstLetter(UNFOUND_HINTS[rarity])}`;
}

/** Hint of an unfound entry: its area's hint, or the plain unfoundHint when no area holds it. */
function unfoundEntryHint(area: Readonly<AreaData> | undefined, rarity: Rarity): string {
  return area === undefined ? unfoundHint(rarity) : areaHint(area, rarity);
}

/**
 * Section line length for the chest: 'full' when an entry row `rowH` tall fits the list height the
 * full lines leave (`fullListH`), else 'short'. 'short' when either is not finite.
 */
export function sectionLineLength(fullListH: number, rowH: number): SectionLineLength {
  return Number.isFinite(fullListH) && Number.isFinite(rowH) && rowH <= fullListH ? 'full' : 'short';
}

/** The `length` section line of `category`. */
export function sectionLine(category: ChestCategory, length: SectionLineLength): string {
  return length === 'full' ? SECTION_LINES[category] : SHORT_SECTION_LINES[category];
}

/** Found count of a section, e.g. '2 of 4 found'. */
export function foundCountText(found: number, total: number): string {
  return `${found} of ${total} found`;
}

/** Page position text, e.g. 'Page 1 of 3'. */
export function pageText(pageNumber: number, pageCount: number): string {
  return `Page ${pageNumber} of ${pageCount}`;
}

function createEntryBase(
  name: string,
  rarity: Rarity,
  found: boolean,
  area: Readonly<AreaData> | undefined,
): ChestEntryBase {
  return {
    name: found ? name : UNFOUND_NAME,
    rarity,
    rarityName: rarityName(rarity),
    badge: badgeShape(rarity),
    found,
    hint: found ? '' : unfoundEntryHint(area, rarity),
  };
}

function createDecorationEntry(
  decoration: Decoration,
  found: boolean,
  areas: readonly Readonly<AreaData>[],
): DecorationEntry {
  const area = treasureAreaOf(decoration.id, areas);
  return { id: decoration.id, ...createEntryBase(decoration.name, decoration.rarity, found, area) };
}

function createWearableEntry(wearable: Wearable, found: boolean, areas: readonly Readonly<AreaData>[]): WearableEntry {
  const area = treasureAreaOf(wearable.id, areas);
  return {
    id: wearable.id,
    ...createEntryBase(wearable.name, wearable.rarity, found, area),
    slot: wearable.slot,
    slotName: slotName(wearable.slot),
    perk: found ? wearable.perk : null,
    detailText: found ? wearableDetailText(wearable.slot, wearable.perk) : slotName(wearable.slot),
  };
}

function createDreamColourEntry(
  colour: DreamColour,
  found: boolean,
  areas: readonly Readonly<AreaData>[],
): DreamColourEntry {
  const area = dreamColourAreaOf(colour.id, areas);
  return {
    id: colour.id,
    ...createEntryBase(colour.name, colour.rarity, found, area),
    patterned: colour.kind !== 'solid',
    label: DREAM_COLOUR_LABEL,
  };
}

function createSection<C extends ChestCategory, E extends ChestEntry>(
  category: C,
  entries: readonly E[],
): ChestSectionOf<C, E> {
  const found = entries.filter((entry) => entry.found).length;
  return {
    category,
    heading: HEADINGS[category],
    found,
    total: entries.length,
    countText: foundCountText(found, entries.length),
    entries,
    line: SECTION_LINES[category],
    shortLine: SHORT_SECTION_LINES[category],
  };
}

/**
 * The Treasure Chest sections for these banked treasure ids, always Decorations, Wearables, then
 * Dream colours. Every catalogue treasure of a section is listed once, in catalogue order
 * (DREAM_COLOURS order for Dream colours), found when banked. A banked Paint shell marks its Dream
 * colour found; the shell itself is not listed. Unknown and axolotl ids are ignored. Every unfound
 * entry hints at the first of `areas` that holds it (a Dream colour, its Paint shell), locked or
 * not, else its plain rarity hint.
 */
export function chestListing(
  banked: readonly string[],
  areas: readonly Readonly<AreaData>[] = AREAS,
): readonly [DecorationSection, WearableSection, DreamColourSection] {
  const owned = new Set(banked);
  const ownedColours = new Set<DreamColourId>(ownedDreamColours(banked));
  return [
    createSection(
      'decoration',
      DECORATIONS.map((decoration) => createDecorationEntry(decoration, owned.has(decoration.id), areas)),
    ),
    createSection(
      'wearable',
      WEARABLES.map((wearable) => createWearableEntry(wearable, owned.has(wearable.id), areas)),
    ),
    createSection(
      'dreamColour',
      DREAM_COLOURS.map((colour) => createDreamColourEntry(colour, ownedColours.has(colour.id), areas)),
    ),
  ];
}

function slicePages<C extends ChestCategory, E extends ChestEntry>(
  section: ChestSectionOf<C, E>,
  rowsPerPage: number,
): ChestPageOf<C, E>[] {
  const pageCount = Math.max(1, Math.ceil(section.entries.length / rowsPerPage));
  return Array.from({ length: pageCount }, (_, index) => ({
    section,
    entries: section.entries.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
  }));
}

function sectionPages(section: ChestSection, rowsPerPage: number): ChestPage[] {
  switch (section.category) {
    case 'decoration':
      return slicePages(section, rowsPerPage);
    case 'wearable':
      return slicePages(section, rowsPerPage);
    case 'dreamColour':
      return slicePages(section, rowsPerPage);
  }
}

/**
 * Splits sections into pages of at most `rowsPerPage` entries, in section order. Every section
 * gets at least one page, even when it has no entries. Throws when `rowsPerPage` is not a
 * positive whole number.
 */
export function chestPages(sections: readonly ChestSection[], rowsPerPage: number): ChestPage[] {
  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw new RangeError(`rowsPerPage must be a positive whole number, got ${rowsPerPage}`);
  }
  return sections.flatMap((section) => sectionPages(section, rowsPerPage));
}
