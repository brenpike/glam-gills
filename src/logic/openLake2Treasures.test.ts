import { describe, expect, it } from 'vitest';
import {
  ALL_TREASURES,
  DREAM_COLOURS,
  OBSIDIAN,
  OPEN_LAKE_2_TREASURES,
  OPEN_LAKE_TREASURES,
  PERK_VALUES,
  PITCH_BLACK,
  RARITIES,
  TRENCH_SHINE,
  categoryName,
  dreamColourById,
  dreamRarityAllowed,
  isDecoration,
  placementKind,
  treasureById,
  treasureSlug,
  type PaintShell,
  type Treasure,
  type Wearable,
} from './catalogue';

const AREA_13_COLOURS = [PITCH_BLACK, TRENCH_SHINE];

function isWearable(treasure: Treasure): treasure is Wearable {
  return treasure.category === 'wearable';
}

function isPaintShell(treasure: Treasure): treasure is PaintShell {
  return treasure.category === 'paintShell';
}

describe('OPEN_LAKE_2_TREASURES', () => {
  it('holds the open lake Area 13 treasures in rarity order, the 4 Commons, 7 Rares, 2 Epics then 3 Legendaries (issue #215)', () => {
    expect(OPEN_LAKE_2_TREASURES).toEqual([
      { id: 'open-lake/stone-stack', name: 'Stone stack', rarity: 'common', category: 'decoration' },
      {
        id: 'open-lake/lake-buoy',
        name: 'Lake buoy',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'open-lake/raincloud-mobile',
        name: 'Raincloud mobile',
        rarity: 'common',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'open-lake/turtle-socks',
        name: 'Turtle socks',
        rarity: 'common',
        category: 'wearable',
        slot: 'socks',
        perk: { type: 'snackMagnet', value: 30 },
      },
      { id: 'open-lake/little-lighthouse', name: 'Little lighthouse', rarity: 'rare', category: 'decoration' },
      {
        id: 'open-lake/glow-flower-lamp',
        name: 'Glow-flower lamp',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
      },
      { id: 'open-lake/diving-bell', name: 'Diving bell', rarity: 'rare', category: 'decoration' },
      {
        id: 'open-lake/diving-goggles',
        name: 'Diving goggles',
        rarity: 'rare',
        category: 'wearable',
        slot: 'face',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'open-lake/turtle-shell-backpack',
        name: 'Turtle shell backpack',
        rarity: 'rare',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'open-lake/lantern-tail-charm',
        name: 'Lantern tail charm',
        rarity: 'rare',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'dash', value: 15 },
      },
      {
        id: 'open-lake/paint-shell-pitch-black',
        name: 'Pitch black Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'pitch-black',
      },
      { id: 'open-lake/little-mud-turtle', name: 'Little mud turtle', rarity: 'epic', category: 'decoration' },
      {
        id: 'open-lake/mini-submarine',
        name: 'Mini submarine',
        rarity: 'epic',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'shell', value: 1 },
      },
      { id: 'open-lake/fading-light-garden', name: 'Fading light garden', rarity: 'legendary', category: 'decoration' },
      {
        id: 'open-lake/diving-suit',
        name: 'Diving suit',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'speed', value: 10 },
      },
      {
        id: 'open-lake/paint-shell-trench-shine',
        name: 'Trench shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'trench-shine',
      },
    ]);
    expect(Object.isFrozen(OPEN_LAKE_2_TREASURES)).toBe(true);
  });

  it('has 4 Commons, 7 Rares, 2 Epics and 3 Legendaries, in rarity order', () => {
    expect(OPEN_LAKE_2_TREASURES).toHaveLength(16);
    expect(RARITIES.map((rarity) => OPEN_LAKE_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 7, 2, 3]);
    const rarityIndexes = OPEN_LAKE_2_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
  });

  it('has 8 Decorations, 6 Wearables and 2 Paint shells', () => {
    expect(OPEN_LAKE_2_TREASURES.filter(isDecoration).map((decoration) => decoration.id)).toEqual([
      'open-lake/stone-stack',
      'open-lake/lake-buoy',
      'open-lake/raincloud-mobile',
      'open-lake/little-lighthouse',
      'open-lake/glow-flower-lamp',
      'open-lake/diving-bell',
      'open-lake/little-mud-turtle',
      'open-lake/fading-light-garden',
    ]);
    expect(OPEN_LAKE_2_TREASURES.filter(isWearable).map((wearable) => wearable.id)).toEqual([
      'open-lake/turtle-socks',
      'open-lake/diving-goggles',
      'open-lake/turtle-shell-backpack',
      'open-lake/lantern-tail-charm',
      'open-lake/mini-submarine',
      'open-lake/diving-suit',
    ]);
    expect(OPEN_LAKE_2_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'open-lake/paint-shell-pitch-black',
      'open-lake/paint-shell-trench-shine',
    ]);
  });

  it('places the Lake buoy Floating, the Raincloud mobile and Glow-flower lamp Hanging and every other Decoration on the Floor, each at the standard width', () => {
    const kinds = OPEN_LAKE_2_TREASURES.filter(isDecoration).map((decoration) => [decoration.id, placementKind(decoration), decoration.width]);
    expect(kinds).toEqual([
      ['open-lake/stone-stack', 'floor', undefined],
      ['open-lake/lake-buoy', 'floating', undefined],
      ['open-lake/raincloud-mobile', 'hanging', undefined],
      ['open-lake/little-lighthouse', 'floor', undefined],
      ['open-lake/glow-flower-lamp', 'hanging', undefined],
      ['open-lake/diving-bell', 'floor', undefined],
      ['open-lake/little-mud-turtle', 'floor', undefined],
      ['open-lake/fading-light-garden', 'floor', undefined],
    ]);
  });

  it("makes the Little mud turtle, Area 13's special treasure, an Epic Floor Decoration found by id", () => {
    const turtle = treasureById('open-lake/little-mud-turtle');
    expect(turtle?.rarity).toBe('epic');
    expect(turtle !== undefined && isDecoration(turtle) && placementKind(turtle)).toBe('floor');
    expect(turtle !== undefined && categoryName(turtle.category)).toBe('Decoration');
  });

  it('gives every Area 13 Wearable its PERK_VALUES value, no set, and a perk type no other Area 13 Wearable has', () => {
    const wearables = OPEN_LAKE_2_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(Object.keys(wearable.perk).sort(), wearable.id).toEqual(['type', 'value']);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
    expect(wearables.map((wearable) => [wearable.slot, wearable.perk.type, wearable.perk.value])).toEqual([
      ['socks', 'snackMagnet', 30],
      ['face', 'treasureSense', 25],
      ['back', 'regrowth', 15],
      ['tail', 'dash', 15],
      ['back', 'shell', 1],
      ['shirt', 'speed', 10],
    ]);
  });

  it('links each Paint shell to its Area 13 Dream colour at that colour rarity, the Trench shine Paint shell last', () => {
    const shells = OPEN_LAKE_2_TREASURES.filter(isPaintShell);
    expect(shells.map((shell) => dreamColourById(shell.dreamColour))).toEqual(AREA_13_COLOURS);
    for (const shell of shells) {
      expect(shell.rarity, shell.id).toBe(dreamColourById(shell.dreamColour)?.rarity);
      expect(shell.name, shell.id).toBe(`${dreamColourById(shell.dreamColour)?.name} Paint shell`);
    }
    expect(OPEN_LAKE_2_TREASURES.at(-1)).toBe(shells.at(-1));
    expect(ALL_TREASURES.filter(isPaintShell).slice(-shells.length)).toEqual(shells);
  });

  it('adds Pitch black and Trench shine last in DREAM_COLOURS, after Obsidian', () => {
    expect(DREAM_COLOURS.slice(-AREA_13_COLOURS.length)).toEqual(AREA_13_COLOURS);
    expect(DREAM_COLOURS.at(-AREA_13_COLOURS.length - 1)).toBe(OBSIDIAN);
    expect(new Set(DREAM_COLOURS.map((colour) => colour.id)).size).toBe(DREAM_COLOURS.length);
    for (const colour of AREA_13_COLOURS) expect(Object.isFrozen(colour), colour.id).toBe(true);
  });

  it('keeps Pitch black a solid Rare and Trench shine a Legendary sheen, at least one Legendary sheen among them (B3, ADR 0031)', () => {
    expect([PITCH_BLACK.kind, PITCH_BLACK.rarity]).toEqual(['solid', 'rare']);
    expect([TRENCH_SHINE.kind, TRENCH_SHINE.rarity]).toEqual(['sheen', 'legendary']);
    expect(AREA_13_COLOURS.filter((colour) => colour.kind === 'sheen' && colour.rarity === 'legendary').length).toBeGreaterThanOrEqual(1);
    for (const colour of AREA_13_COLOURS) expect(dreamRarityAllowed(colour), colour.id).toBe(true);
  });

  it('uses ids under open-lake/ whose ids, slugs and names no other treasure has', () => {
    const lakeIds = new Set(OPEN_LAKE_2_TREASURES.map((treasure) => treasure.id));
    const others = ALL_TREASURES.filter((treasure) => !lakeIds.has(treasure.id));
    const otherSlugs = new Set(others.map((treasure) => treasureSlug(treasure.id)));
    const otherNames = new Set(others.map((treasure) => treasure.name));
    expect(lakeIds.size).toBe(OPEN_LAKE_2_TREASURES.length);
    for (const treasure of OPEN_LAKE_2_TREASURES) {
      expect(treasure.id).toMatch(/^open-lake\/[a-z0-9-]+$/);
      expect(otherSlugs.has(treasureSlug(treasure.id)), treasure.id).toBe(false);
      expect(otherNames.has(treasure.name), treasure.id).toBe(false);
      expect(treasureById(treasure.id), treasure.id).toBe(treasure);
    }
  });

  it("comes last in ALL_TREASURES, right after Area 12's list unchanged", () => {
    expect(ALL_TREASURES.slice(-OPEN_LAKE_2_TREASURES.length)).toEqual(OPEN_LAKE_2_TREASURES);
    expect(ALL_TREASURES.at(-OPEN_LAKE_2_TREASURES.length - 1)).toBe(OPEN_LAKE_TREASURES.at(-1));
    const area12Start = ALL_TREASURES.length - OPEN_LAKE_2_TREASURES.length - OPEN_LAKE_TREASURES.length;
    expect(ALL_TREASURES.slice(area12Start, -OPEN_LAKE_2_TREASURES.length)).toEqual(OPEN_LAKE_TREASURES);
  });
});
