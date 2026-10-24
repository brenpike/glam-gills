import { describe, expect, it } from 'vitest';
import { AREAS, CANAL_AREA, HABITATS, POND_2_AREA, POND_AREA, unlockedAreaIds, type AreaData } from './areas';
import { isSupportedCanvas } from './cardFit';
import {
  ALL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  DREAM_COLOURS,
  PERK_VALUES,
  RARITIES,
  WEARABLE_SLOTS,
  type PaintShell,
  type PerkType,
  type Rarity,
  type Treasure,
  type Wearable,
} from './catalogue';
import { badgeShape, rarityName } from './hints';
import type { HudView, Size } from './hudLayout';
import { REAL_MORPHS, axolotlFindId } from './morphs';
import type { AreaStarsRecord } from './stars';
import { CHEST_BUTTON, chestLayout, chestShowsTitle, hideChestTitle, type ChestLayout, type ChestMeasure } from './tankUi';
import * as treasureChest from './treasureChest';
import {
  CHEST_CATEGORIES,
  DREAM_COLOUR_LABEL,
  SECTION_LINES,
  SECTION_LINE_GAP_PX,
  SHORT_SECTION_LINES,
  UNFOUND_HINTS,
  UNFOUND_NAME,
  areaHint,
  chestListing,
  chestPages,
  dreamColourAreaOf,
  foundCountText,
  pageText,
  perkText,
  sectionLine,
  sectionLineLength,
  slotName,
  treasureAreaOf,
  unfoundHint,
  wearableDetailText,
  type ChestEntry,
  type ChestSection,
  type SectionLineLength,
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

const exportedStrings = Object.entries(treasureChest as Record<string, unknown>).filter(
  (entry): entry is [string, string] => typeof entry[1] === 'string',
);

function isWearable(treasure: Treasure): treasure is Wearable {
  return treasure.category === 'wearable';
}

function isPaintShell(treasure: Treasure): treasure is PaintShell {
  return treasure.category === 'paintShell';
}

const DECORATION_COUNT = ALL_TREASURES.filter((treasure) => treasure.category === 'decoration').length;
const WEARABLES = ALL_TREASURES.filter(isWearable);
const PAINT_SHELLS = ALL_TREASURES.filter(isPaintShell);
const ALL_IDS = ALL_TREASURES.map((treasure) => treasure.id);
const PERK_TYPES = Object.keys(PERK_VALUES) as PerkType[];
const ALL_BEATEN: AreaStarsRecord = Object.fromEntries(
  AREAS.map((area) => [area.id, { exit: true, special: true, legsOrRescue: true }]),
);

/** The area an entry's hint names: its Paint shell's area for a Dream colour, else its treasure's. */
function entryAreaOf(section: ChestSection, entry: ChestEntry, areas: readonly AreaData[] = AREAS): AreaData | undefined {
  return section.category === 'dreamColour' ? dreamColourAreaOf(entry.id, areas) : treasureAreaOf(entry.id, areas);
}

/** Every entry of `sections` with its id, found flag and hint. */
function entryHints(sections: readonly ChestSection[]): [string, boolean, string][] {
  return sections.flatMap((section) => section.entries.map((entry): [string, boolean, string] => [entry.id, entry.found, entry.hint]));
}

/** The hint of the entry with this id in `sections`. */
function hintOf(sections: readonly ChestSection[], id: string): string | undefined {
  return sections.flatMap((section): readonly ChestEntry[] => section.entries).find((entry) => entry.id === id)?.hint;
}

/** The Wearable detail text or Dream colour label of `entry`; none for a Decoration. */
function entryDetailTexts(entry: ChestEntry): string[] {
  if ('detailText' in entry) return [entry.detailText];
  if ('label' in entry) return [entry.label];
  return [];
}

function collectListingText(sections: readonly ChestSection[]): string[] {
  const texts: string[] = [];
  for (const section of sections) {
    texts.push(section.heading, section.countText, section.line, section.shortLine);
    for (const entry of section.entries) texts.push(entry.name, entry.rarityName, entry.hint, ...entryDetailTexts(entry));
  }
  return texts;
}

function collectHelperOutputs(): string[] {
  const outputs = [
    ...collectListingText(chestListing([])),
    ...collectListingText(chestListing(ALL_IDS)),
    pageText(1, 3),
    foundCountText(2, 4),
  ];
  for (const slot of WEARABLE_SLOTS) outputs.push(slotName(slot));
  for (const wearable of WEARABLES) outputs.push(wearableDetailText(wearable.slot, wearable.perk));
  for (const type of PERK_TYPES) outputs.push(perkText({ type, value: 2 }), perkText({ type, value: 1 }));
  for (const rarity of RARITIES) outputs.push(unfoundHint(rarity));
  for (const area of AREAS) for (const rarity of RARITIES) outputs.push(areaHint(area, rarity));
  for (const category of CHEST_CATEGORIES) outputs.push(sectionLine(category, 'full'), sectionLine(category, 'short'));
  return outputs;
}

describe('treasure chest text', () => {
  it('exports every Treasure Chest string by name', () => {
    expect(exportedStrings.map(([name]) => name).sort()).toEqual(['DREAM_COLOUR_LABEL', 'UNFOUND_NAME']);
  });

  it('labels Dream colours with the exact PRD wording and an em dash', () => {
    expect(DREAM_COLOUR_LABEL).toBe('Dream colour — not found in nature');
    expect(DREAM_COLOUR_LABEL).toContain('—');
  });

  it('keeps every string and helper output free of harsh or gamey words', () => {
    const outputs = [...exportedStrings.map(([, text]) => text), ...collectHelperOutputs()];
    for (const output of outputs) {
      const lower = output.toLowerCase();
      for (const word of BANNED) expect(lower).not.toContain(word);
    }
  });

  it('names unfound treasures ???', () => {
    expect(UNFOUND_NAME).toBe('???');
  });

  it('gives each rarity its B6 hint', () => {
    expect(UNFOUND_HINTS).toEqual({
      common: 'Look near the main swim path!',
      rare: 'Look off the main path!',
      epic: 'Look in a cave or log, or past the current!',
      legendary: 'Break a Dash pot with Tail Dash!',
    });
    for (const rarity of RARITIES) expect(unfoundHint(rarity)).toBe(UNFOUND_HINTS[rarity]);
  });

  it('gives each section its exact full and short line', () => {
    expect(SECTION_LINES).toEqual({
      decoration: "Things to put in your tank. Open the tank's decorate mode to place them.",
      wearable: 'Clothes for your axolotls. Each one gives a perk on trips. Dress up in Restyle.',
      dreamColour: 'Magic paints from Paint shells. Not found in nature! Put one on in Restyle.',
    });
    expect(SHORT_SECTION_LINES).toEqual({
      decoration: 'Place them in decorate mode.',
      wearable: 'Wear them in Restyle for perks.',
      dreamColour: 'Magic paints. Use in Restyle.',
    });
    for (const category of CHEST_CATEGORIES) {
      expect(sectionLine(category, 'full')).toBe(SECTION_LINES[category]);
      expect(sectionLine(category, 'short')).toBe(SHORT_SECTION_LINES[category]);
    }
  });

  it('puts the section line 4 px under the heading', () => {
    expect(SECTION_LINE_GAP_PX).toBe(4);
  });

  it('formats found counts and page positions', () => {
    expect(foundCountText(2, 4)).toBe('2 of 4 found');
    expect(pageText(1, 3)).toBe('Page 1 of 3');
  });
});

describe('chestListing', () => {
  it('always lists Decorations, Wearables, then Dream colours', () => {
    const sections = chestListing([]);
    expect(sections.map((section) => section.category)).toEqual([...CHEST_CATEGORIES]);
    expect(sections.map((section) => section.heading)).toEqual([
      'Decorations',
      'Wearables',
      'Dream colours',
    ]);
  });

  it('takes totals from the catalogue', () => {
    const [decorations, wearables, dreamColours] = chestListing([]);
    expect(decorations.total).toBe(DECORATION_COUNT);
    expect(wearables.total).toBe(WEARABLES.length);
    expect(dreamColours.total).toBe(DREAM_COLOURS.length);
  });

  it('shows 0 found and every treasure unfound when nothing is owned', () => {
    const sections = chestListing([]);
    expect(sections.map((section) => section.countText)).toEqual([
      '0 of 25 found',
      '0 of 31 found',
      '0 of 16 found',
    ]);
    for (const section of sections) {
      expect(section.found).toBe(0);
      expect(section.entries).toHaveLength(section.total);
      for (const entry of section.entries) expect(entry.found).toBe(false);
    }
  });

  it('gives each section its full and short line', () => {
    for (const section of chestListing([])) {
      expect(section.line).toBe(SECTION_LINES[section.category]);
      expect(section.shortLine).toBe(SHORT_SECTION_LINES[section.category]);
    }
  });

  it('lists found and unfound entries in every section in catalogue order whatever the banked order', () => {
    const banked = ['canal/paint-shell-galaxy', 'canal/flippers', 'canal/pond-plant', 'canal/paint-shell-mint', 'canal/sun-hat'];
    const [decorations, wearables, dreamColours] = chestListing(banked);
    expect(chestListing([...banked].reverse())).toEqual(chestListing(banked));
    expect(decorations.entries.map((entry) => entry.id)).toEqual(
      ALL_TREASURES.filter((treasure) => treasure.category === 'decoration').map((treasure) => treasure.id),
    );
    expect(wearables.entries.map((entry) => entry.id)).toEqual(WEARABLES.map((wearable) => wearable.id));
    expect(dreamColours.entries.map((entry) => entry.id)).toEqual(DREAM_COLOURS.map((colour) => colour.id));
    expect(decorations.entries.filter((entry) => entry.found).map((entry) => entry.id)).toEqual(['canal/pond-plant']);
    expect(wearables.entries.filter((entry) => entry.found).map((entry) => entry.id)).toEqual([
      'canal/sun-hat',
      'canal/flippers',
    ]);
    expect(dreamColours.entries.filter((entry) => entry.found).map((entry) => entry.id)).toEqual(['mint', 'galaxy']);
    expect([decorations, wearables, dreamColours].map((section) => section.countText)).toEqual([
      '1 of 25 found',
      '2 of 31 found',
      '2 of 16 found',
    ]);
  });

  it('names unfound entries ??? with their area hint, and found entries by name with no hint', () => {
    const banked = ['canal/sun-hat', 'canal/paint-shell-hearts', 'pond/frog-statue', 'pond/paint-shell-firefly-gold'];
    for (const section of chestListing(banked)) {
      for (const entry of section.entries) {
        const area = entryAreaOf(section, entry);
        expect(area).toBeDefined();
        if (entry.found) {
          expect(entry.name).not.toBe(UNFOUND_NAME);
          expect(entry.hint).toBe('');
        } else if (area !== undefined) {
          expect(entry.name).toBe(UNFOUND_NAME);
          expect(entry.hint).toBe(areaHint(area, entry.rarity));
        }
        expect(entry.rarityName).toBe(rarityName(entry.rarity));
        expect(entry.badge).toBe(badgeShape(entry.rarity));
      }
    }
  });

  it('gives an unfound entry of every rarity its area and rarity hint', () => {
    const hinted = new Map<Rarity, Set<string>>();
    for (const section of chestListing([])) {
      for (const entry of section.entries) {
        const hints = hinted.get(entry.rarity) ?? new Set<string>();
        hinted.set(entry.rarity, hints.add(entry.hint));
      }
    }
    expect([...hinted.keys()].sort()).toEqual([...RARITIES].sort());
    for (const [rarity, hints] of hinted) {
      const rarityHint = UNFOUND_HINTS[rarity];
      for (const hint of hints) {
        expect(hint).toMatch(new RegExp(`^(${HABITATS.map((habitat) => habitat.name).join('|')}): Area \\d+: `));
        expect(hint.endsWith(`: ${rarityHint.charAt(0).toLowerCase()}${rarityHint.slice(1)}`)).toBe(true);
      }
    }
  });

  it('shows an unfound Wearable with its slot and no perk', () => {
    const [, wearables] = chestListing([]);
    const sunHat = wearables.entries.find((entry) => entry.id === 'canal/sun-hat');
    expect(sunHat).toEqual({
      id: 'canal/sun-hat',
      name: UNFOUND_NAME,
      rarity: 'common',
      rarityName: 'Common',
      badge: 'circle',
      found: false,
      hint: 'Canal: Area 1: look near the main swim path!',
      slot: 'head',
      slotName: 'Head',
      perk: null,
      detailText: 'Head',
    });
    for (const entry of wearables.entries) {
      expect(entry.perk).toBeNull();
      expect(entry.detailText).toBe(entry.slotName);
    }
  });

  it('labels an unfound Dream colour', () => {
    const [, , dreamColours] = chestListing([]);
    for (const entry of dreamColours.entries) expect(entry.label).toBe(DREAM_COLOUR_LABEL);
  });

  it('shows everything found when everything is owned', () => {
    const sections = chestListing(ALL_IDS);
    expect(sections.map((section) => section.countText)).toEqual([
      '25 of 25 found',
      '31 of 31 found',
      '16 of 16 found',
    ]);
    for (const section of sections) expect(section.found).toBe(section.total);
  });

  it('lists every entry found in catalogue order whatever the banked order', () => {
    const [decorations, wearables, dreamColours] = chestListing([...ALL_IDS].reverse());
    for (const section of [decorations, wearables, dreamColours]) {
      for (const entry of section.entries) expect(entry.found).toBe(true);
    }
    expect(decorations.entries.map((entry) => entry.id)).toEqual(
      ALL_TREASURES.filter((treasure) => treasure.category === 'decoration').map((treasure) => treasure.id),
    );
    expect(wearables.entries.map((entry) => entry.id)).toEqual(WEARABLES.map((wearable) => wearable.id));
    expect(dreamColours.entries.map((entry) => entry.id)).toEqual(DREAM_COLOURS.map((colour) => colour.id));
  });

  it('counts duplicates once', () => {
    const [decorations, wearables, dreamColours] = chestListing([
      'canal/pond-plant',
      'canal/pond-plant',
      'canal/sun-hat',
      'canal/sun-hat',
      'canal/paint-shell-mint',
      'canal/paint-shell-mint',
    ]);
    const foundIds = (section: ChestSection): string[] =>
      section.entries.filter((entry) => entry.found).map((entry) => entry.id);
    expect(foundIds(decorations)).toEqual(['canal/pond-plant']);
    expect(foundIds(wearables)).toEqual(['canal/sun-hat']);
    expect(foundIds(dreamColours)).toEqual(['mint']);
    expect(dreamColours.countText).toBe('1 of 16 found');
  });

  it('ignores unknown and axolotl ids', () => {
    const axolotlIds = REAL_MORPHS.map((morph) => axolotlFindId(morph.id));
    const sections = chestListing(['canal/not-a-treasure', 'mint', '', ...axolotlIds]);
    for (const section of sections) expect(section.found).toBe(0);
    expect(sections).toEqual(chestListing([]));
  });

  it('marks a Paint shell\'s Dream colour found, not the shell', () => {
    const [decorations, wearables, dreamColours] = chestListing(['canal/paint-shell-hearts']);
    expect(decorations.found).toBe(0);
    expect(wearables.found).toBe(0);
    const ids = [...decorations.entries, ...wearables.entries, ...dreamColours.entries].map((entry) => entry.id);
    expect(ids).not.toContain('canal/paint-shell-hearts');
    expect(dreamColours.entries.filter((entry) => entry.found)).toEqual([
      {
        id: 'hearts',
        name: 'Hearts',
        rarity: 'epic',
        rarityName: 'Epic',
        badge: 'shield',
        found: true,
        hint: '',
        patterned: true,
        label: DREAM_COLOUR_LABEL,
      },
    ]);
  });

  it('gives each entry its name, rarity name and badge', () => {
    for (const section of chestListing(ALL_IDS)) {
      for (const entry of section.entries) {
        expect(entry.rarityName).toBe(rarityName(entry.rarity));
        expect(entry.badge).toBe(badgeShape(entry.rarity));
        expect(entry.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('shows the exact slot and perk for every catalogue Wearable', () => {
    const [, wearables] = chestListing(ALL_IDS);
    expect(wearables.entries.map((entry) => [entry.name, entry.slotName, entry.detailText])).toEqual([
      ['Sun hat', 'Head', 'Head · Speed +4%'],
      ['Shell necklace', 'Neck', 'Neck · Regrowth +15%'],
      ['Heart glasses', 'Face', 'Face · Treasure sense +35%'],
      ['Golden bow', 'Tail', 'Tail · Shell blocks 1 hit'],
      ['Tank top', 'Shirt', 'Shirt · Regrowth +10%'],
      ['Diving tank', 'Back', 'Back · Dash +15%'],
      ['Stripy socks', 'Socks', 'Socks · Snack magnet +30'],
      ['Flippers', 'Feet', 'Feet · Speed +6%'],
      ['Lily flower crown', 'Head', 'Head · Regrowth +10%'],
      ['Pond-weed scarf', 'Neck', 'Neck · Snack magnet +30'],
      ['Dragonfly glasses', 'Face', 'Face · Treasure sense +25%'],
      ['Raincoat', 'Shirt', 'Shirt · Speed +6%'],
      ['Ladybug backpack', 'Back', 'Back · Shell blocks 1 hit'],
      ['Rainbow dragonfly wings', 'Back', 'Back · Dash +25%'],
      ['Froggy boots', 'Feet', 'Feet · Speed +10%'],
      ['Feather cap', 'Head', 'Head · Speed +4%'],
      ['Lily-pad socks', 'Socks', 'Socks · Snack magnet +30'],
      ['Water-lily shirt', 'Shirt', 'Shirt · Regrowth +15%'],
      ['Pearl tail charm', 'Tail', 'Tail · Shell blocks 1 hit'],
      ['Firefly cape', 'Back', 'Back · Treasure sense +50%'],
      ['Straw sun hat', 'Head', 'Head · Treasure sense +15%'],
      ['Marigold necklace', 'Neck', 'Neck · Regrowth +10%'],
      ['Garden overalls', 'Shirt', 'Shirt · Snack magnet +40'],
      ['Monarch hair clip', 'Head', 'Head · Dash +20%'],
      ['Monarch wings', 'Back', 'Back · Speed +10%'],
      ['Bee headband', 'Head', 'Head · Snack magnet +30'],
      ['Bandana', 'Neck', 'Neck · Speed +4%'],
      ['Sunflower sunglasses', 'Face', 'Face · Treasure sense +25%'],
      ['Embroidered shirt', 'Shirt', 'Shirt · Regrowth +15%'],
      ['Hummingbird tail ribbon', 'Tail', 'Tail · Speed +8%'],
      ['Rainbow serape cape', 'Back', 'Back · Shell blocks 1 hit'],
    ]);
  });

  it('lists the pond Decorations after the canal ones, then the Area 3 ones, then the Area 4 ones, then the Area 5 ones', () => {
    const [decorations] = chestListing(['pond/frog-statue']);
    expect(decorations.entries.map((entry) => entry.id)).toEqual([
      'canal/pond-plant',
      'canal/toy-boat',
      'canal/castle-tower',
      'canal/sun-pyramid',
      'pond/lily-pad',
      'pond/cattail-clump',
      'pond/frog-statue',
      'pond/lotus-lantern',
      'pond/reed-bundle',
      'pond/drifting-feather',
      'pond/wooden-duck-decoy',
      'pond/firefly-string-lights',
      'pond/firefly-jar',
      'pond/golden-lotus-throne',
      'chinampa/clay-flowerpot',
      'chinampa/corn-husk-doll',
      'chinampa/scarecrow',
      'chinampa/papel-picado-banner',
      'chinampa/willow-swing',
      'chinampa/golden-corn',
      'chinampa/watering-can',
      'chinampa/floating-gourd',
      'chinampa/pinata',
      'chinampa/talavera-fountain',
      'chinampa/alebrije-statue',
    ]);
    expect(decorations.entries.filter((entry) => entry.found).map((entry) => entry.name)).toEqual(['Frog statue']);
    expect(decorations.countText).toBe('1 of 25 found');
  });

  it('shows Lily green as ??? with the Area 2 rare hint until the pond Paint shell is banked', () => {
    const canalShells = ALL_TREASURES.filter(isPaintShell)
      .filter((shell) => shell.id.startsWith('canal/'))
      .map((shell) => shell.id);
    const lilyGreen = (banked: readonly string[]): ChestEntry | undefined =>
      chestListing(banked)[2].entries.find((entry) => entry.id === 'lily-green');
    expect(lilyGreen(canalShells)).toMatchObject({
      name: UNFOUND_NAME,
      rarity: 'rare',
      found: false,
      hint: 'Lily pad pond: Area 2: look off the main path!',
      label: DREAM_COLOUR_LABEL,
    });
    expect(chestListing(canalShells)[2].countText).toBe('12 of 16 found');
    expect(lilyGreen(['pond/paint-shell-lily-green'])).toMatchObject({ name: 'Lily green', found: true, hint: '' });
  });

  it('marks patterned and sheen Dream colours as patterned, and labels all 16', () => {
    const [, , dreamColours] = chestListing(PAINT_SHELLS.map((shell) => shell.id));
    expect(dreamColours.entries).toHaveLength(DREAM_COLOURS.length);
    for (const [index, entry] of dreamColours.entries.entries()) {
      const colour = DREAM_COLOURS[index];
      expect(entry.id).toBe(colour.id);
      expect(entry.name).toBe(colour.name);
      expect(entry.patterned).toBe(colour.kind !== 'solid');
      expect(entry.label).toBe(DREAM_COLOUR_LABEL);
    }
  });
});

describe('area hints', () => {
  it('finds every catalogue treasure in exactly one area, the one treasureAreaOf gives', () => {
    for (const treasure of ALL_TREASURES) {
      const holders = AREAS.filter((area) => area.layout.treasures.some((held) => held.id === treasure.id));
      expect(holders.map((area) => area.id), treasure.id).toHaveLength(1);
      expect(treasureAreaOf(treasure.id)).toBe(holders[0]);
    }
  });

  it('finds every Dream colour\'s Paint shell in exactly one area, the one dreamColourAreaOf gives', () => {
    for (const colour of DREAM_COLOURS) {
      const holders = AREAS.filter((area) =>
        area.layout.treasures.some((held) => held.category === 'paintShell' && held.dreamColour === colour.id),
      );
      expect(holders.map((area) => area.id), colour.id).toHaveLength(1);
      expect(dreamColourAreaOf(colour.id)).toBe(holders[0]);
    }
  });

  it('gives no real entry the plain fallback hint', () => {
    const plainHints = new Set(Object.values(UNFOUND_HINTS));
    for (const [id, , hint] of entryHints(chestListing([]))) expect(plainHints.has(hint), id).toBe(false);
  });

  it('finds an area by its layout, never by the id prefix', () => {
    expect(treasureAreaOf('canal/toy-boat')).toBe(CANAL_AREA);
    expect(treasureAreaOf('pond/frog-statue')).toBe(POND_AREA);
    expect(treasureAreaOf('pond/reed-bundle')).toBe(POND_2_AREA);
    expect(treasureAreaOf('pond/paint-shell-firefly-gold')).toBe(POND_2_AREA);
    expect(treasureAreaOf('pond/not-a-treasure')).toBeUndefined();
    expect(treasureAreaOf('mint')).toBeUndefined();
    expect(dreamColourAreaOf('lily-green')).toBe(POND_AREA);
    expect(dreamColourAreaOf('firefly-gold')).toBe(POND_2_AREA);
    expect(dreamColourAreaOf('canal/paint-shell-mint')).toBeUndefined();
    expect(dreamColourAreaOf('not-a-colour')).toBeUndefined();
  });

  it('takes the first area that holds the treasure', () => {
    const copy: AreaData = { ...POND_2_AREA, id: 'copy', number: 9 };
    expect(treasureAreaOf('pond/reed-bundle', [copy, POND_2_AREA])).toBe(copy);
    expect(dreamColourAreaOf('firefly-gold', [POND_2_AREA, copy])).toBe(POND_2_AREA);
    expect(treasureAreaOf('pond/reed-bundle', [])).toBeUndefined();
  });

  it.each<[string, string]>([
    ['canal/pond-plant', 'Canal: Area 1: look near the main swim path!'],
    ['canal/toy-boat', 'Canal: Area 1: look off the main path!'],
    ['canal/castle-tower', 'Canal: Area 1: look in a cave or log, or past the current!'],
    ['canal/sun-pyramid', 'Canal: Area 1: break a Dash pot with Tail Dash!'],
    ['canal/sun-hat', 'Canal: Area 1: look near the main swim path!'],
    ['mint', 'Canal: Area 1: look near the main swim path!'],
    ['galaxy', 'Canal: Area 1: break a Dash pot with Tail Dash!'],
    ['pond/lily-pad', 'Lily pad pond: Area 2: look near the main swim path!'],
    ['pond/frog-statue', 'Lily pad pond: Area 2: look off the main path!'],
    ['pond/lotus-lantern', 'Lily pad pond: Area 2: look in a cave or log, or past the current!'],
    ['pond/rainbow-dragonfly-wings', 'Lily pad pond: Area 2: break a Dash pot with Tail Dash!'],
    ['lily-green', 'Lily pad pond: Area 2: look off the main path!'],
    ['pond/reed-bundle', 'Lily pad pond: Area 3: look near the main swim path!'],
    ['pond/wooden-duck-decoy', 'Lily pad pond: Area 3: look off the main path!'],
    ['pond/firefly-jar', 'Lily pad pond: Area 3: look in a cave or log, or past the current!'],
    ['pond/golden-lotus-throne', 'Lily pad pond: Area 3: break a Dash pot with Tail Dash!'],
    ['pond/firefly-cape', 'Lily pad pond: Area 3: break a Dash pot with Tail Dash!'],
    ['firefly-gold', 'Lily pad pond: Area 3: look off the main path!'],
    ['chinampa/scarecrow', 'Chinampa gardens: Area 4: look off the main path!'],
    ['poppy-red', 'Chinampa gardens: Area 4: look off the main path!'],
    ['chinampa/watering-can', 'Chinampa gardens: Area 5: look near the main swim path!'],
    ['chinampa/pinata', 'Chinampa gardens: Area 5: look off the main path!'],
    ['chinampa/talavera-fountain', 'Chinampa gardens: Area 5: look in a cave or log, or past the current!'],
    ['chinampa/alebrije-statue', 'Chinampa gardens: Area 5: break a Dash pot with Tail Dash!'],
    ['chinampa/rainbow-serape-cape', 'Chinampa gardens: Area 5: break a Dash pot with Tail Dash!'],
    ['plum', 'Chinampa gardens: Area 5: look off the main path!'],
  ])('hints at an unfound %s with "%s"', (id, expected) => {
    expect(hintOf(chestListing([]), id)).toBe(expected);
  });

  it('names the chinampa gardens and Area 4 in the hint of every unfound Area 4 treasure and Poppy red', () => {
    const chinampaIds = [...CHINAMPA_TREASURES.filter((treasure) => !isPaintShell(treasure)).map((treasure) => treasure.id), 'poppy-red'];
    expect(chinampaIds.length).toBeGreaterThan(1);
    for (const id of chinampaIds) expect(hintOf(chestListing([]), id), id).toMatch(/^Chinampa gardens: Area 4: /);
  });

  it('names the chinampa gardens and Area 5 in the hint of every unfound Area 5 treasure and Plum', () => {
    const chinampa2Ids = [...CHINAMPA_2_TREASURES.filter((treasure) => !isPaintShell(treasure)).map((treasure) => treasure.id), 'plum'];
    expect(chinampa2Ids).toHaveLength(12);
    for (const id of chinampa2Ids) expect(hintOf(chestListing([]), id), id).toMatch(/^Chinampa gardens: Area 5: /);
  });

  it('builds every area and rarity hint from the habitat name, area label and rarity hint (issue #113, ND-9)', () => {
    expect(RARITIES.map((rarity) => areaHint(POND_2_AREA, rarity))).toEqual([
      'Lily pad pond: Area 3: look near the main swim path!',
      'Lily pad pond: Area 3: look off the main path!',
      'Lily pad pond: Area 3: look in a cave or log, or past the current!',
      'Lily pad pond: Area 3: break a Dash pot with Tail Dash!',
    ]);
    expect(areaHint({ ...CANAL_AREA, number: 7 }, 'rare')).toBe('Canal: Area 7: look off the main path!');
  });

  it('gives an area of an unknown habitat the plain rarity hint', () => {
    const lost: AreaData = { ...POND_2_AREA, habitatId: 'not-a-habitat' };
    for (const rarity of RARITIES) expect(areaHint(lost, rarity)).toBe(unfoundHint(rarity));
    expect(hintOf(chestListing([], [lost]), 'pond/reed-bundle')).toBe(UNFOUND_HINTS.common);
  });

  it('hints at every area, locked or not, the same with no stars and with every area beaten', () => {
    expect(unlockedAreaIds({})).toEqual([CANAL_AREA.id]);
    expect(unlockedAreaIds(ALL_BEATEN)).toEqual(AREAS.map((area) => area.id));
    const noStars = chestListing([]);
    expect(hintOf(noStars, 'pond/reed-bundle')).toBe('Lily pad pond: Area 3: look near the main swim path!');
    expect(hintOf(noStars, 'firefly-gold')).toBe('Lily pad pond: Area 3: look off the main path!');
    expect(entryHints(chestListing([]))).toEqual(entryHints(noStars));
  });

  it('gives found entries an empty hint with any areas table', () => {
    for (const areas of [AREAS, [POND_2_AREA], []]) {
      for (const [id, found, hint] of entryHints(chestListing(ALL_IDS, areas))) {
        expect(found, id).toBe(true);
        expect(hint, id).toBe('');
      }
    }
  });

  it('hints from a custom areas table, and the plain rarity hint for an entry no area holds', () => {
    const onlyArea3 = chestListing([], [POND_2_AREA]);
    expect(hintOf(onlyArea3, 'pond/reed-bundle')).toBe('Lily pad pond: Area 3: look near the main swim path!');
    expect(hintOf(onlyArea3, 'firefly-gold')).toBe('Lily pad pond: Area 3: look off the main path!');
    expect(hintOf(onlyArea3, 'canal/toy-boat')).toBe('Look off the main path!');
    expect(hintOf(onlyArea3, 'lily-green')).toBe('Look off the main path!');
    const renumbered = chestListing([], [{ ...CANAL_AREA, number: 4 }]);
    expect(hintOf(renumbered, 'canal/pond-plant')).toBe('Canal: Area 4: look near the main swim path!');
    for (const section of chestListing([], [])) {
      for (const entry of section.entries) expect(entry.hint, entry.id).toBe(UNFOUND_HINTS[entry.rarity]);
    }
  });
});

describe('slotName', () => {
  it('names every Wearable slot', () => {
    expect(WEARABLE_SLOTS.map(slotName)).toEqual([
      'Head',
      'Neck',
      'Face',
      'Shirt',
      'Back',
      'Tail',
      'Socks',
      'Feet',
    ]);
  });
});

describe('perkText', () => {
  it('covers every perk type with its value and unit', () => {
    const texts = Object.fromEntries(PERK_TYPES.map((type) => [type, perkText({ type, value: 4 })]));
    expect(texts).toEqual({
      speed: 'Speed +4%',
      regrowth: 'Regrowth +4%',
      dash: 'Dash +4%',
      treasureSense: 'Treasure sense +4%',
      snackMagnet: 'Snack magnet +4',
      shell: 'Shell blocks 4 hits',
    });
  });

  it('uses the singular for a Shell that blocks one hit', () => {
    expect(perkText({ type: 'shell', value: 1 })).toBe('Shell blocks 1 hit');
  });

  it('shows catalogue perk values', () => {
    expect(perkText({ type: 'snackMagnet', value: PERK_VALUES.snackMagnet.common ?? 0 })).toBe(
      'Snack magnet +30',
    );
    expect(perkText({ type: 'dash', value: PERK_VALUES.dash.legendary ?? 0 })).toBe('Dash +25%');
  });
});

describe('wearableDetailText', () => {
  it('joins the slot and perk with a middle dot', () => {
    expect(wearableDetailText('head', { type: 'speed', value: 4 })).toBe('Head · Speed +4%');
  });
});

describe('chestPages', () => {
  it('splits 16 Dream colours at 3 per page into 5 full pages and 1 more', () => {
    const [, , dreamColours] = chestListing(PAINT_SHELLS.map((shell) => shell.id));
    const pages = chestPages([dreamColours], 3);
    expect(pages.map((page) => page.entries.length)).toEqual([3, 3, 3, 3, 3, 1]);
    for (const page of pages) expect(page.section).toBe(dreamColours);
    expect(pages.flatMap((page) => page.entries)).toEqual(dreamColours.entries);
  });

  it.each([
    ['nothing', [] as string[]],
    ['some', ['canal/sun-hat', 'canal/paint-shell-mint']],
    ['everything', ALL_IDS],
  ])('keeps section order and pages every treasure at 3 rows, 9 + 11 + 6 pages, with %s banked', (_, banked) => {
    const sections = chestListing(banked);
    const pages = chestPages(sections, 3);
    expect(pages.map((page) => [page.section.category, page.entries.length])).toEqual([
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 3],
      ['decoration', 1],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 3],
      ['wearable', 1],
      ['dreamColour', 3],
      ['dreamColour', 3],
      ['dreamColour', 3],
      ['dreamColour', 3],
      ['dreamColour', 3],
      ['dreamColour', 1],
    ]);
    for (const section of sections) {
      const listed = pages.filter((page) => page.section === section).flatMap((page) => page.entries);
      expect(listed).toEqual(section.entries);
    }
  });

  it.each([0, -1, 1.5, Number.NaN])('throws for %s rows per page', (rows) => {
    expect(() => chestPages(chestListing([]), rows)).toThrow(RangeError);
  });
});

describe('sectionLineLength', () => {
  it.each<[number, number, SectionLineLength]>([
    [100, 80, 'full'],
    [80, 80, 'full'],
    [79, 80, 'short'],
    [0, 32, 'short'],
    [Number.NaN, 32, 'short'],
    [100, Number.NaN, 'short'],
    [Infinity, 32, 'short'],
    [100, Infinity, 'short'],
  ])('gives %s list px and a %s px row the %s lines', (fullListH, rowH, expected) => {
    expect(sectionLineLength(fullListH, rowH)).toBe(expected);
  });
});

/** Text size estimate that errs wide, the tankUi.test constants. */
const REGULAR_EM = 0.55;
const BOLD_EM = 0.6;
const LINE_HEIGHT_EM = 1.25;

/** TreasureChestView sizes, CSS px. */
const CHEST_TITLE_PX = 28;
const HEADING_PX = 18;
const LINE_PX = 18;
const PAGE_TEXT_PX = 18;
const NAME_PX = 20;
const RARITY_PX = 18;
const DETAIL_PX = 18;
const LEAD_PX = 32;
const LEAD_GAP = 8;
const NAME_GAP = 8;
const BADGE_PX = 24;
const BADGE_GAP = 6;
const PERK_ICON_PX = 24;
const PERK_ICON_GAP = 6;
const SLOT_GAP = 6;
const CHEST_TITLE = 'Treasure Chest';
const ENTRY_COUNT = chestListing([]).reduce((count, section) => count + section.total, 0);
const LONGEST_PAGE_TEXT = pageText(ENTRY_COUNT, ENTRY_COUNT);

const CANVAS_WIDTHS: readonly number[] = [
  320, 340, 360, 375, 390, 414, 430, 459, 460, 480, 520, 568, 640, 667, 736, 800, 844, 1024, 1280, 1366,
];
const CANVAS_HEIGHTS: readonly number[] = [
  320, 340, 360, 375, 414, 440, 480, 568, 600, 667, 740, 768, 844, 932,
];

/** Lines `text` wraps to at `wrapW`, splitting on '\n' then greedily on ' ', every character `em * px` wide. */
function estimateLines(text: string, px: number, wrapW: number, em: number): number {
  const charW = em * px;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let lineW = 0;
    lines += 1;
    for (const word of paragraph.split(' ')) {
      const wordW = word.length * charW;
      if (lineW > 0 && lineW + charW + wordW > wrapW) {
        lines += 1;
        lineW = wordW;
      } else {
        lineW += (lineW > 0 ? charW : 0) + wordW;
      }
    }
  }
  return lines;
}

/** Estimated size of `text` wrapped at `wrapW`. */
function estimateSize(text: string, px: number, wrapW: number, em: number): Size {
  const lines = estimateLines(text, px, wrapW, em);
  return { w: Math.min(wrapW, text.length * em * px), h: lines * LINE_HEIGHT_EM * px };
}

/** Estimated height of `text` wrapped at `wrapW`. */
function estimateHeight(text: string, px: number, wrapW: number, em: number): number {
  return estimateSize(text, px, wrapW, em).h;
}

/** Widest and tallest of `texts` wrapped at `wrapW`. */
function largestSize(texts: readonly string[], px: number, wrapW: number, em: number): Size {
  const sizes = texts.map((text) => estimateSize(text, px, wrapW, em));
  return { w: Math.max(...sizes.map((size) => size.w)), h: Math.max(...sizes.map((size) => size.h)) };
}

/** The chest measure with every heading at its fullest count and the `length` section lines. */
function chestMeasure(length: SectionLineLength): ChestMeasure {
  const headings = chestListing(ALL_IDS).map((section) => `${section.heading}: ${section.countText}`);
  const lines = CHEST_CATEGORIES.map((category) => sectionLine(category, length));
  return {
    titleAt: (wrapW) => estimateSize(CHEST_TITLE, CHEST_TITLE_PX, wrapW, BOLD_EM),
    headingAt: (wrapW) => {
      const heading = largestSize(headings, HEADING_PX, wrapW, BOLD_EM);
      const line = largestSize(lines, LINE_PX, wrapW, REGULAR_EM);
      return { w: Math.max(heading.w, line.w), h: heading.h + SECTION_LINE_GAP_PX + line.h };
    },
    pageText: estimateSize(LONGEST_PAGE_TEXT, PAGE_TEXT_PX, Infinity, REGULAR_EM),
    close: CHEST_BUTTON,
    back: CHEST_BUTTON,
    next: CHEST_BUTTON,
  };
}

/** Height of the name line: the name, then the badge and rarity name beside it when they fit, else under it. */
function nameBlockHeight(entry: ChestEntry, textW: number): number {
  const nameW = entry.name.length * BOLD_EM * NAME_PX;
  const groupW = BADGE_PX + BADGE_GAP + entry.rarityName.length * BOLD_EM * RARITY_PX;
  const nameLineH = LINE_HEIGHT_EM * NAME_PX;
  if (nameW + NAME_GAP + groupW <= textW) return Math.max(nameLineH, BADGE_PX);
  return estimateLines(entry.name, NAME_PX, textW, BOLD_EM) * nameLineH + Math.max(BADGE_PX, LINE_HEIGHT_EM * RARITY_PX);
}

/** Height of a found Wearable's slot and perk line: one line when it fits, else the slot over the perk. */
function perkBlockHeight(slotText: string, perkLabel: string, textW: number): number {
  const slotW = `${slotText} ·`.length * BOLD_EM * DETAIL_PX;
  const perkW = perkLabel.length * REGULAR_EM * DETAIL_PX;
  if (slotW + SLOT_GAP + PERK_ICON_PX + PERK_ICON_GAP + perkW <= textW) return Math.max(PERK_ICON_PX, LINE_HEIGHT_EM * DETAIL_PX);
  const perkH = estimateHeight(perkLabel, DETAIL_PX, textW - PERK_ICON_PX - PERK_ICON_GAP, REGULAR_EM);
  return estimateHeight(slotText, DETAIL_PX, textW, BOLD_EM) + Math.max(PERK_ICON_PX, perkH);
}

/** Height of the detail blocks under the name line, each wrapped at `textW` beside the lead image. */
function detailBlocksHeight(entry: ChestEntry, textW: number): number {
  const detail = (text: string, em: number): number => estimateHeight(text, DETAIL_PX, textW, em);
  if (!entry.found) {
    const second = 'detailText' in entry ? detail(entry.detailText, BOLD_EM) : 'label' in entry ? detail(entry.label, REGULAR_EM) : 0;
    return detail(entry.hint, REGULAR_EM) + second;
  }
  if ('perk' in entry && entry.perk !== null) return perkBlockHeight(entry.slotName, perkText(entry.perk), textW);
  if ('label' in entry) return detail(entry.label, REGULAR_EM);
  return 0;
}

/** Conservative height of `entry`'s row at `rowW`: every block beside the 32 px lead image, none under it. */
function estimateRowHeight(entry: ChestEntry, rowW: number): number {
  const textW = rowW - LEAD_PX - LEAD_GAP;
  return Math.max(LEAD_PX, nameBlockHeight(entry, textW) + detailBlocksHeight(entry, textW));
}

/** Tallest row of every entry, found and unfound, at `rowW`. */
function tallestRowHeight(rowW: number): number {
  const entries = [...chestListing([]), ...chestListing(ALL_IDS)].flatMap((section): readonly ChestEntry[] => section.entries);
  return Math.max(...entries.map((entry) => estimateRowHeight(entry, rowW)));
}

/**
 * The chest as the view lays it out on `view`: full lines with the title, then short lines with the
 * title when a row does not fit, then short lines without the title when a row still does not fit.
 */
interface ChestFit {
  readonly length: SectionLineLength;
  readonly showsTitle: boolean;
  readonly layout: ChestLayout;
  readonly fullListH: number;
  readonly rowH: number;
}

function fitChest(view: HudView): ChestFit {
  const full = chestLayout(view, chestMeasure('full'));
  const fullRowH = tallestRowHeight(full.list.w);
  const length = sectionLineLength(full.list.h, fullRowH);
  const lined = length === 'full' ? full : chestLayout(view, chestMeasure('short'));
  const showsTitle = chestShowsTitle(lined.list.h, fullRowH);
  const layout = showsTitle ? lined : hideChestTitle(lined);
  return { length, showsTitle, layout, fullListH: full.list.h, rowH: tallestRowHeight(layout.list.w) };
}

/** Supported canvases from the width and height grid (art guide 1). */
function supportedCanvases(): HudView[] {
  return CANVAS_WIDTHS.flatMap((cssW) =>
    CANVAS_HEIGHTS.filter((cssH) => isSupportedCanvas(cssW, cssH)).map((cssH) => ({ cssW, cssH })),
  );
}

describe('Treasure Chest fit with every treasure listed', () => {
  it('fits at least one whole row, unfound silhouettes included, on every supported canvas', () => {
    const problems = supportedCanvases().flatMap((view) => {
      const fit = fitChest(view);
      return fit.rowH <= fit.layout.list.h
        ? []
        : [`${view.cssW}x${view.cssH} ${fit.length}: row ${fit.rowH} over list ${fit.layout.list.h}`];
    });
    expect(problems).toEqual([]);
  });

  it.each<[number, number, SectionLineLength, boolean]>([
    [460, 320, 'short', false],
    [320, 440, 'short', false],
    [340, 440, 'short', false],
    [360, 440, 'short', false],
    [320, 480, 'short', true],
    [375, 440, 'short', true],
    [460, 340, 'short', true],
    [460, 375, 'short', true],
    [800, 600, 'full', true],
    [1024, 768, 'full', true],
  ])('uses the %s x %s %s section lines, title shown: %s', (cssW, cssH, expected, showsTitle) => {
    const fit = fitChest({ cssW, cssH });
    expect(fit.length).toBe(expected);
    expect(fit.showsTitle).toBe(showsTitle);
  });

  it('hides the title only on 320x440, 340x440, 360x440 and 460x320, where the short lines still leave no room for a row', () => {
    const hidden = supportedCanvases().filter((view) => !fitChest(view).showsTitle);
    expect(hidden.map((view) => `${view.cssW}x${view.cssH}`)).toEqual(['320x440', '340x440', '360x440', '460x320']);
    for (const view of hidden) {
      const fit = fitChest(view);
      expect(fit.length).toBe('short');
      expect(fit.rowH).toBeGreaterThan(chestLayout(view, chestMeasure('short')).list.h);
      expect(fit.layout).toEqual(hideChestTitle(chestLayout(view, chestMeasure('short'))));
    }
  });
});
