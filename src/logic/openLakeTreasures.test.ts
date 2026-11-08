import { describe, expect, it } from 'vitest';
import {
  ALL_TREASURES,
  DEEP_CANAL_4_TREASURES,
  DREAM_COLOURS,
  OBSIDIAN,
  OPEN_LAKE_2_TREASURES,
  OPEN_LAKE_TREASURES,
  PERK_VALUES,
  PITCH_BLACK,
  RARITIES,
  TULE_GREEN,
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

function isWearable(treasure: Treasure): treasure is Wearable {
  return treasure.category === 'wearable';
}

function isPaintShell(treasure: Treasure): treasure is PaintShell {
  return treasure.category === 'paintShell';
}

describe('OPEN_LAKE_TREASURES', () => {
  it('holds the open lake Area 12 treasures in rarity order, the 4 Commons then the 8 Rares (issue #214, ND-3)', () => {
    expect(OPEN_LAKE_TREASURES).toEqual([
      {
        id: 'open-lake/windsock',
        name: 'Windsock',
        rarity: 'common',
        category: 'decoration',
        placement: 'hanging',
      },
      { id: 'open-lake/pinwheel', name: 'Pinwheel', rarity: 'common', category: 'decoration' },
      {
        id: 'open-lake/wave-socks',
        name: 'Wave socks',
        rarity: 'common',
        category: 'wearable',
        slot: 'socks',
        perk: { type: 'speed', value: 4 },
      },
      {
        id: 'open-lake/paint-shell-tule-green',
        name: 'Tule green Paint shell',
        rarity: 'common',
        category: 'paintShell',
        dreamColour: 'tule-green',
      },
      {
        id: 'open-lake/little-pelican',
        name: 'Little pelican',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      { id: 'open-lake/twin-volcanoes', name: 'Twin volcanoes', rarity: 'rare', category: 'decoration' },
      {
        id: 'open-lake/little-sailboat',
        name: 'Little sailboat',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'open-lake/cloud-scarf',
        name: 'Cloud scarf',
        rarity: 'rare',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'open-lake/pelican-swim-ring',
        name: 'Pelican swim ring',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'open-lake/surfboard',
        name: 'Surfboard',
        rarity: 'rare',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'dash', value: 15 },
      },
      {
        id: 'open-lake/pelican-slippers',
        name: 'Pelican slippers',
        rarity: 'rare',
        category: 'wearable',
        slot: 'feet',
        perk: { type: 'snackMagnet', value: 40 },
      },
      {
        id: 'open-lake/paint-shell-obsidian',
        name: 'Obsidian Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'obsidian',
      },
    ]);
    expect(Object.isFrozen(OPEN_LAKE_TREASURES)).toBe(true);
  });

  it('has 4 Commons and 8 Rares, no Epic or Legendary, in rarity order', () => {
    expect(OPEN_LAKE_TREASURES).toHaveLength(12);
    expect(RARITIES.map((rarity) => OPEN_LAKE_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 8, 0, 0]);
    const rarityIndexes = OPEN_LAKE_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
  });

  it('has 5 Decorations, 5 Wearables and 2 Paint shells', () => {
    expect(OPEN_LAKE_TREASURES.filter(isDecoration).map((decoration) => decoration.id)).toEqual([
      'open-lake/windsock',
      'open-lake/pinwheel',
      'open-lake/little-pelican',
      'open-lake/twin-volcanoes',
      'open-lake/little-sailboat',
    ]);
    expect(OPEN_LAKE_TREASURES.filter(isWearable).map((wearable) => wearable.id)).toEqual([
      'open-lake/wave-socks',
      'open-lake/cloud-scarf',
      'open-lake/pelican-swim-ring',
      'open-lake/surfboard',
      'open-lake/pelican-slippers',
    ]);
    expect(OPEN_LAKE_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'open-lake/paint-shell-tule-green',
      'open-lake/paint-shell-obsidian',
    ]);
  });

  it('places the Windsock Hanging, the Pinwheel and Twin volcanoes on the Floor and the Little pelican and Little sailboat Floating, each at the standard width', () => {
    const kinds = OPEN_LAKE_TREASURES.filter(isDecoration).map((decoration) => [
      decoration.id,
      placementKind(decoration),
      decoration.width,
    ]);
    expect(kinds).toEqual([
      ['open-lake/windsock', 'hanging', undefined],
      ['open-lake/pinwheel', 'floor', undefined],
      ['open-lake/little-pelican', 'floating', undefined],
      ['open-lake/twin-volcanoes', 'floor', undefined],
      ['open-lake/little-sailboat', 'floating', undefined],
    ]);
  });

  it('makes the Little pelican a Rare Floating Decoration found by id', () => {
    const pelican = treasureById('open-lake/little-pelican');
    expect(pelican?.rarity).toBe('rare');
    expect(pelican !== undefined && isDecoration(pelican) && placementKind(pelican)).toBe('floating');
    expect(pelican !== undefined && categoryName(pelican.category)).toBe('Decoration');
  });

  it('gives every Area 12 Wearable its PERK_VALUES value, no set, and a perk type no other Area 12 Wearable has', () => {
    const wearables = OPEN_LAKE_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(Object.keys(wearable.perk).sort(), wearable.id).toEqual(['type', 'value']);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
    expect(wearables.map((wearable) => [wearable.slot, wearable.perk.type, wearable.perk.value])).toEqual([
      ['socks', 'speed', 4],
      ['neck', 'treasureSense', 25],
      ['shirt', 'regrowth', 15],
      ['back', 'dash', 15],
      ['feet', 'snackMagnet', 40],
    ]);
  });

  it('links each Paint shell to its Area 12 Dream colour at that colour rarity', () => {
    const shells = OPEN_LAKE_TREASURES.filter(isPaintShell);
    expect(shells.map((shell) => dreamColourById(shell.dreamColour))).toEqual([TULE_GREEN, OBSIDIAN]);
    for (const shell of shells) {
      expect(shell.rarity, shell.id).toBe(dreamColourById(shell.dreamColour)?.rarity);
      expect(shell.name, shell.id).toBe(`${dreamColourById(shell.dreamColour)?.name} Paint shell`);
    }
    const area13ColourStart = DREAM_COLOURS.indexOf(PITCH_BLACK);
    expect(DREAM_COLOURS.slice(area13ColourStart - 2, area13ColourStart)).toEqual([TULE_GREEN, OBSIDIAN]);
    const allShells = ALL_TREASURES.filter(isPaintShell);
    const area13ShellStart = allShells.indexOf(OPEN_LAKE_2_TREASURES.filter(isPaintShell)[0]);
    expect(allShells.slice(area13ShellStart - 2, area13ShellStart)).toEqual(shells);
  });

  it('keeps both Area 12 Dream colours solid and Common or Rare (B3)', () => {
    for (const colour of [TULE_GREEN, OBSIDIAN]) {
      expect(colour.kind, colour.id).toBe('solid');
      expect(['common', 'rare'], colour.id).toContain(colour.rarity);
      expect(dreamRarityAllowed(colour), colour.id).toBe(true);
    }
  });

  it('uses ids under open-lake/ whose ids, slugs and names no other treasure has', () => {
    const lakeIds = new Set(OPEN_LAKE_TREASURES.map((treasure) => treasure.id));
    const others = ALL_TREASURES.filter((treasure) => !lakeIds.has(treasure.id));
    const otherSlugs = new Set(others.map((treasure) => treasureSlug(treasure.id)));
    const otherNames = new Set(others.map((treasure) => treasure.name));
    expect(lakeIds.size).toBe(OPEN_LAKE_TREASURES.length);
    for (const treasure of OPEN_LAKE_TREASURES) {
      expect(treasure.id).toMatch(/^open-lake\/[a-z0-9-]+$/);
      expect(otherSlugs.has(treasureSlug(treasure.id)), treasure.id).toBe(false);
      expect(otherNames.has(treasure.name), treasure.id).toBe(false);
      expect(treasureById(treasure.id), treasure.id).toBe(treasure);
    }
  });

  it("sits in ALL_TREASURES just before Area 13's list, after every earlier area list unchanged", () => {
    const area13Start = ALL_TREASURES.indexOf(OPEN_LAKE_2_TREASURES[0]);
    const area12Start = area13Start - OPEN_LAKE_TREASURES.length;
    expect(ALL_TREASURES.slice(area12Start, area13Start)).toEqual(OPEN_LAKE_TREASURES);
    expect(ALL_TREASURES.at(area12Start - 1)).toBe(DEEP_CANAL_4_TREASURES.at(-1));
    expect(DEEP_CANAL_4_TREASURES).toHaveLength(14);
    expect(DEEP_CANAL_4_TREASURES.at(-1)?.id).toBe('deep-canal/paint-shell-lagoon-shine');
  });
});
