import { describe, expect, it } from 'vitest';
import {
  ALL_TREASURES,
  CANAL_DREAM_COLOURS,
  CANAL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHOCOLATE,
  CHINAMPA_TREASURES,
  CONFETTI_SHINE,
  CRYSTAL_SHINE,
  DEEP_CANAL_2_TREASURES,
  DEEP_CANAL_3_TREASURES,
  DEEP_CANAL_4_TREASURES,
  DEEP_CANAL_TREASURES,
  DREAM_COLOURS,
  FIESTA_SHINE,
  FIREFLY_GOLD,
  GALAXY,
  GLOWWORM,
  GOLDEN_HOUR_SHINE,
  GRANDFATHERED_EPIC_DREAM_IDS,
  HYACINTH,
  JADE,
  LAGOON_SHINE,
  LANTERN_SHINE,
  LILY_GREEN,
  LIME,
  MARIGOLD,
  MOONSTONE,
  OBSIDIAN,
  OLIVE,
  OPEN_LAKE_2_TREASURES,
  OPEN_LAKE_TREASURES,
  PEACH,
  PERK_VALUES,
  PITCH_BLACK,
  PLUM,
  POND_2_TREASURES,
  POND_TREASURES,
  POPPY_RED,
  RAINBOW,
  RARITIES,
  SPRING_CAVE_2_TREASURES,
  SPRING_CAVE_TREASURES,
  TIE_DYE_GALAXY,
  TREASURE_CATEGORIES,
  TRENCH_SHINE,
  TULE_GREEN,
  WEARABLE_SLOTS,
  categoryName,
  dreamColourById,
  dreamRarityAllowed,
  isDecoration,
  ownedDreamColours,
  placementKind,
  treasureById,
  treasureSlug,
  type Decoration,
  type DreamKind,
  type PaintShell,
  type Rarity,
  type Treasure,
  type Wearable,
} from './catalogue';
import { DEV_DECORATIONS } from './devDecorations';

function isWearable(treasure: Treasure): treasure is Wearable {
  return treasure.category === 'wearable';
}

function isPaintShell(treasure: Treasure): treasure is PaintShell {
  return treasure.category === 'paintShell';
}

const WEARABLES = CANAL_TREASURES.filter(isWearable);
const PAINT_SHELLS = CANAL_TREASURES.filter(isPaintShell);
const DECORATIONS = CANAL_TREASURES.filter((treasure) => treasure.category === 'decoration');
const ALL_WEARABLES = ALL_TREASURES.filter(isWearable);
const ALL_DECORATIONS = ALL_TREASURES.filter(isDecoration);

describe('catalogue enums', () => {
  it('has 3 categories in order', () => {
    expect(TREASURE_CATEGORIES).toEqual(['decoration', 'wearable', 'paintShell']);
  });

  it('has 4 rarities in rarity order', () => {
    expect(RARITIES).toEqual(['common', 'rare', 'epic', 'legendary']);
  });

  it('has 8 wearable slots in order', () => {
    expect(WEARABLE_SLOTS).toEqual(['head', 'neck', 'face', 'shirt', 'back', 'tail', 'socks', 'feet']);
  });
});

describe('CANAL_TREASURES', () => {
  it('has unique ids of the form canal/<slug>', () => {
    const ids = CANAL_TREASURES.map((treasure) => treasure.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^canal\/[a-z0-9-]+$/);
    }
  });

  it('has unique names', () => {
    const names = CANAL_TREASURES.map((treasure) => treasure.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has a treasure at every rarity, a Decoration at every rarity and a Wearable at every rarity but Legendary', () => {
    for (const rarity of RARITIES) {
      expect(CANAL_TREASURES.some((treasure) => treasure.rarity === rarity), rarity).toBe(true);
      expect(DECORATIONS.some((treasure) => treasure.rarity === rarity), rarity).toBe(true);
    }
    expect([...new Set(WEARABLES.map((wearable) => wearable.rarity))].sort()).toEqual(['common', 'epic', 'rare']);
  });

  it('has exactly 1 Legendary, the Sun pyramid (issue #146)', () => {
    expect(CANAL_TREASURES.filter((treasure) => treasure.rarity === 'legendary').map((treasure) => treasure.id)).toEqual([
      'canal/sun-pyramid',
    ]);
  });

  it('has a Wearable for every wearable slot but Tail, since the Golden bow moved to the pond (issue #146)', () => {
    const slots = new Set(WEARABLES.map((wearable) => wearable.slot));
    expect([...slots].sort()).toEqual(WEARABLE_SLOTS.filter((slot) => slot !== 'tail').sort());
  });

  it('has exactly 4 Decorations, 7 Wearables, 9 Paint shells and 20 treasures in total', () => {
    expect(DECORATIONS).toHaveLength(4);
    expect(WEARABLES).toHaveLength(7);
    expect(PAINT_SHELLS).toHaveLength(9);
    expect(CANAL_TREASURES).toHaveLength(20);
  });

  it('has no Wearable in a set yet', () => {
    for (const wearable of WEARABLES) {
      expect(wearable.setId).toBeUndefined();
    }
  });

  it('keeps every canal id in the same order (issue #75)', () => {
    expect(CANAL_TREASURES.map((treasure) => treasure.id)).toEqual([
      'canal/pond-plant',
      'canal/toy-boat',
      'canal/castle-tower',
      'canal/sun-pyramid',
      'canal/sun-hat',
      'canal/shell-necklace',
      'canal/heart-glasses',
      'canal/paint-shell-mint',
      'canal/paint-shell-sky-blue',
      'canal/paint-shell-lavender',
      'canal/paint-shell-sunset-orange',
      'canal/paint-shell-bubblegum',
      'canal/paint-shell-midnight-blue',
      'canal/paint-shell-hearts',
      'canal/paint-shell-tie-dye',
      'canal/paint-shell-iridescent',
      'canal/tank-top',
      'canal/diving-tank',
      'canal/stripy-socks',
      'canal/flippers',
    ]);
  });

  it('has exactly 9 Paint shells, one per canal Dream colour', () => {
    expect(PAINT_SHELLS).toHaveLength(9);
    const colours = PAINT_SHELLS.map((shell) => shell.dreamColour);
    expect(colours).toEqual(CANAL_DREAM_COLOURS.map((colour) => colour.id));
  });

  it('uses the exact B3 colour-to-rarity mapping', () => {
    const expected: Record<string, Rarity> = {
      mint: 'common',
      'sky-blue': 'common',
      lavender: 'common',
      'sunset-orange': 'rare',
      bubblegum: 'rare',
      'midnight-blue': 'rare',
      hearts: 'epic',
      'tie-dye': 'epic',
      iridescent: 'epic',
    };
    const colourRarities = Object.fromEntries(CANAL_DREAM_COLOURS.map((colour) => [colour.id, colour.rarity]));
    expect(colourRarities).toEqual(expected);
    for (const shell of PAINT_SHELLS) {
      expect(shell.rarity).toBe(expected[shell.dreamColour]);
    }
  });

  it('names and ids each Paint shell after its Dream colour', () => {
    expect(treasureById('canal/paint-shell-mint')?.name).toBe('Mint Paint shell');
    expect(treasureById('canal/paint-shell-iridescent')?.name).toBe('Iridescent Paint shell');
  });

  it('gives every Wearable exactly one perk at its PERK_VALUES value', () => {
    for (const wearable of WEARABLES) {
      expect(Object.keys(wearable.perk).sort()).toEqual(['type', 'value']);
      expect(wearable.perk.value).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('puts Shell perks only on Epic or Legendary Wearables', () => {
    for (const wearable of WEARABLES.filter((item) => item.perk.type === 'shell')) {
      expect(['epic', 'legendary']).toContain(wearable.rarity);
    }
    expect(PERK_VALUES.shell.common).toBeUndefined();
    expect(PERK_VALUES.shell.rare).toBeUndefined();
  });
});

describe('POND_TREASURES', () => {
  it('holds exactly the pond treasures, in order (issue #75)', () => {
    expect(POND_TREASURES).toEqual([
      { id: 'pond/lily-pad', name: 'Lily pad', rarity: 'common', category: 'decoration', placement: 'floating' },
      { id: 'pond/cattail-clump', name: 'Cattail clump', rarity: 'common', category: 'decoration' },
      { id: 'pond/frog-statue', name: 'Frog statue', rarity: 'rare', category: 'decoration' },
      {
        id: 'pond/lotus-lantern',
        name: 'Lotus lantern',
        rarity: 'epic',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'pond/lily-flower-crown',
        name: 'Lily flower crown',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'regrowth', value: 10 },
      },
      {
        id: 'pond/pond-weed-scarf',
        name: 'Pond-weed scarf',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'snackMagnet', value: 30 },
      },
      {
        id: 'pond/dragonfly-glasses',
        name: 'Dragonfly glasses',
        rarity: 'rare',
        category: 'wearable',
        slot: 'face',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'pond/raincoat',
        name: 'Raincoat',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'speed', value: 6 },
      },
      {
        id: 'pond/ladybug-backpack',
        name: 'Ladybug backpack',
        rarity: 'epic',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'shell', value: 1 },
      },
      {
        id: 'pond/rainbow-dragonfly-wings',
        name: 'Rainbow dragonfly wings',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'dash', value: 25 },
      },
      {
        id: 'pond/froggy-boots',
        name: 'Froggy boots',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'feet',
        perk: { type: 'speed', value: 10 },
      },
      {
        id: 'pond/paint-shell-lily-green',
        name: 'Lily green Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'lily-green',
      },
      {
        id: 'canal/golden-bow',
        name: 'Golden bow',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'shell', value: 1 },
      },
    ]);
  });

  it('gives every pond Wearable its PERK_VALUES value', () => {
    for (const wearable of POND_TREASURES.filter(isWearable)) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
  });
});

describe('POND_2_TREASURES', () => {
  it('holds exactly the pond Area 3 treasures, in order (issue #98)', () => {
    expect(POND_2_TREASURES).toEqual([
      { id: 'pond/reed-bundle', name: 'Reed bundle', rarity: 'common', category: 'decoration' },
      {
        id: 'pond/drifting-feather',
        name: 'Drifting feather',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'pond/wooden-duck-decoy',
        name: 'Wooden duck decoy',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'pond/firefly-string-lights',
        name: 'Firefly string lights',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
        width: 144,
      },
      { id: 'pond/firefly-jar', name: 'Firefly jar', rarity: 'epic', category: 'decoration', placement: 'hanging' },
      { id: 'pond/golden-lotus-throne', name: 'Golden lotus throne', rarity: 'legendary', category: 'decoration' },
      {
        id: 'pond/feather-cap',
        name: 'Feather cap',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'speed', value: 4 },
      },
      {
        id: 'pond/lily-pad-socks',
        name: 'Lily-pad socks',
        rarity: 'common',
        category: 'wearable',
        slot: 'socks',
        perk: { type: 'snackMagnet', value: 30 },
      },
      {
        id: 'pond/water-lily-shirt',
        name: 'Water-lily shirt',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'pond/pearl-tail-charm',
        name: 'Pearl tail charm',
        rarity: 'epic',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'shell', value: 1 },
      },
      {
        id: 'pond/firefly-cape',
        name: 'Firefly cape',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'treasureSense', value: 50 },
      },
      {
        id: 'pond/paint-shell-firefly-gold',
        name: 'Firefly gold Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'firefly-gold',
      },
      {
        id: 'canal/paint-shell-galaxy',
        name: 'Galaxy Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'galaxy',
      },
    ]);
    expect(Object.isFrozen(POND_2_TREASURES)).toBe(true);
  });

  it('gives every pond Area 3 Wearable its PERK_VALUES value and no set', () => {
    for (const wearable of POND_2_TREASURES.filter(isWearable)) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
  });

  it('has 6 Decorations, 5 Wearables and the Firefly gold and Galaxy Paint shells', () => {
    expect(POND_2_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(POND_2_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(POND_2_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'pond/paint-shell-firefly-gold',
      'canal/paint-shell-galaxy',
    ]);
  });

  it('keeps the canal and pond lists unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_TREASURES.at(-1)?.id).toBe('canal/golden-bow');
  });
});

describe('CHINAMPA_TREASURES', () => {
  it('holds exactly the chinampa gardens Area 4 treasures, in order (issue #76)', () => {
    expect(CHINAMPA_TREASURES).toEqual([
      { id: 'chinampa/clay-flowerpot', name: 'Clay flowerpot', rarity: 'common', category: 'decoration' },
      { id: 'chinampa/corn-husk-doll', name: 'Corn husk doll', rarity: 'common', category: 'decoration' },
      {
        id: 'chinampa/straw-sun-hat',
        name: 'Straw sun hat',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'treasureSense', value: 15 },
      },
      {
        id: 'chinampa/marigold-necklace',
        name: 'Marigold necklace',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'regrowth', value: 10 },
      },
      { id: 'chinampa/scarecrow', name: 'Scarecrow', rarity: 'rare', category: 'decoration' },
      {
        id: 'chinampa/papel-picado-banner',
        name: 'Papel picado banner',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
        width: 144,
      },
      {
        id: 'chinampa/garden-overalls',
        name: 'Garden overalls',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'snackMagnet', value: 40 },
      },
      {
        id: 'chinampa/paint-shell-poppy-red',
        name: 'Poppy red Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'poppy-red',
      },
      {
        id: 'chinampa/willow-swing',
        name: 'Willow swing',
        rarity: 'epic',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'chinampa/monarch-hair-clip',
        name: 'Monarch hair clip',
        rarity: 'epic',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'dash', value: 20 },
      },
      { id: 'chinampa/golden-corn', name: 'Golden corn', rarity: 'legendary', category: 'decoration' },
      {
        id: 'chinampa/monarch-wings',
        name: 'Monarch wings',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'speed', value: 10 },
      },
      {
        id: 'canal/paint-shell-rainbow',
        name: 'Rainbow Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'rainbow',
      },
    ]);
    expect(Object.isFrozen(CHINAMPA_TREASURES)).toBe(true);
  });

  it('gives every chinampa Wearable its PERK_VALUES value and no set', () => {
    for (const wearable of CHINAMPA_TREASURES.filter(isWearable)) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
  });

  it('has 6 Decorations, 5 Wearables and the Poppy red and Rainbow Paint shells', () => {
    expect(CHINAMPA_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(CHINAMPA_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(CHINAMPA_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'chinampa/paint-shell-poppy-red',
      'canal/paint-shell-rainbow',
    ]);
  });

  it('keeps the canal, pond and pond Area 3 lists unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES.at(-1)?.id).toBe('canal/paint-shell-galaxy');
  });

  it('gives the straw sun hat its own slug, apart from the canal sun hat', () => {
    expect(treasureSlug('chinampa/straw-sun-hat')).toBe('straw-sun-hat');
    expect(treasureById('canal/sun-hat')?.name).toBe('Sun hat');
    expect(treasureById('chinampa/sun-hat')).toBeUndefined();
  });
});

describe('CHINAMPA_2_TREASURES', () => {
  it('holds exactly the chinampa gardens Area 5 treasures, in order (issue #103)', () => {
    expect(CHINAMPA_2_TREASURES).toEqual([
      { id: 'chinampa/watering-can', name: 'Watering can', rarity: 'common', category: 'decoration' },
      {
        id: 'chinampa/floating-gourd',
        name: 'Floating gourd',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'chinampa/bee-headband',
        name: 'Bee headband',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'snackMagnet', value: 30 },
      },
      {
        id: 'chinampa/bandana',
        name: 'Bandana',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'speed', value: 4 },
      },
      { id: 'chinampa/pinata', name: 'Piñata', rarity: 'rare', category: 'decoration', placement: 'hanging' },
      {
        id: 'chinampa/sunflower-sunglasses',
        name: 'Sunflower sunglasses',
        rarity: 'rare',
        category: 'wearable',
        slot: 'face',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'chinampa/embroidered-shirt',
        name: 'Embroidered shirt',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'chinampa/paint-shell-plum',
        name: 'Plum Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'plum',
      },
      { id: 'chinampa/talavera-fountain', name: 'Talavera fountain', rarity: 'epic', category: 'decoration' },
      {
        id: 'chinampa/hummingbird-tail-ribbon',
        name: 'Hummingbird tail ribbon',
        rarity: 'epic',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'speed', value: 8 },
      },
      { id: 'chinampa/alebrije-statue', name: 'Alebrije statue', rarity: 'legendary', category: 'decoration' },
      {
        id: 'chinampa/rainbow-serape-cape',
        name: 'Rainbow serape cape',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'shell', value: 1 },
      },
      {
        id: 'canal/paint-shell-tie-dye-galaxy',
        name: 'Tie-dye galaxy Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'tie-dye-galaxy',
      },
    ]);
    expect(Object.isFrozen(CHINAMPA_2_TREASURES)).toBe(true);
  });

  it('gives every chinampa Area 5 Wearable its PERK_VALUES value and no set', () => {
    for (const wearable of CHINAMPA_2_TREASURES.filter(isWearable)) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
  });

  it('has 5 Decorations, 6 Wearables and the Plum and Tie-dye galaxy Paint shells', () => {
    expect(CHINAMPA_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_2_TREASURES.filter(isDecoration)).toHaveLength(5);
    expect(CHINAMPA_2_TREASURES.filter(isWearable)).toHaveLength(6);
    expect(CHINAMPA_2_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'chinampa/paint-shell-plum',
      'canal/paint-shell-tie-dye-galaxy',
    ]);
  });

  it('keeps the canal, pond, pond Area 3 and chinampa Area 4 lists unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES.at(-1)?.id).toBe('canal/paint-shell-rainbow');
  });
});

describe('SPRING_CAVE_TREASURES', () => {
  it('holds exactly the spring cave Area 6 treasures, in rarity order, then the Crystal shine Paint shell (issue #77)', () => {
    expect(SPRING_CAVE_TREASURES).toEqual([
      { id: 'spring-cave/pebble-stack', name: 'Pebble stack', rarity: 'common', category: 'decoration' },
      {
        id: 'spring-cave/glow-moss-ball',
        name: 'Glow moss ball',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'spring-cave/miners-headlamp',
        name: "Miner's headlamp",
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'treasureSense', value: 15 },
      },
      {
        id: 'spring-cave/crystal-pendant',
        name: 'Crystal pendant',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'regrowth', value: 10 },
      },
      { id: 'spring-cave/fossil-ammonite', name: 'Fossil ammonite', rarity: 'rare', category: 'decoration' },
      {
        id: 'spring-cave/crystal-wind-chime',
        name: 'Crystal wind chime',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'spring-cave/explorer-vest',
        name: 'Explorer vest',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'dash', value: 15 },
      },
      {
        id: 'spring-cave/paint-shell-moonstone',
        name: 'Moonstone Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'moonstone',
      },
      { id: 'spring-cave/geode-lamp', name: 'Geode lamp', rarity: 'epic', category: 'decoration' },
      {
        id: 'spring-cave/crystal-tail-cuff',
        name: 'Crystal tail cuff',
        rarity: 'epic',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'snackMagnet', value: 50 },
      },
      { id: 'spring-cave/crystal-arch', name: 'Crystal arch', rarity: 'legendary', category: 'decoration' },
      {
        id: 'spring-cave/crystal-crown',
        name: 'Crystal crown',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'speed', value: 10 },
      },
      {
        id: 'spring-cave/paint-shell-crystal-shine',
        name: 'Crystal shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'crystal-shine',
      },
    ]);
    expect(Object.isFrozen(SPRING_CAVE_TREASURES)).toBe(true);
  });

  it('gives every spring cave Wearable its PERK_VALUES value, no set, and perks that are not all the same', () => {
    const wearables = SPRING_CAVE_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBeGreaterThan(1);
  });

  it('has 6 Decorations, 5 Wearables and the Moonstone and Crystal shine Paint shells, in rarity order', () => {
    expect(SPRING_CAVE_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(SPRING_CAVE_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(SPRING_CAVE_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'spring-cave/paint-shell-moonstone',
      'spring-cave/paint-shell-crystal-shine',
    ]);
    const rarityIndexes = SPRING_CAVE_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => SPRING_CAVE_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
  });

  it('keeps the canal, pond, pond Area 3, chinampa Area 4 and chinampa Area 5 lists unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES).toHaveLength(13);
    expect(CHINAMPA_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_2_TREASURES.at(-1)?.id).toBe('canal/paint-shell-tie-dye-galaxy');
  });
});

describe('SPRING_CAVE_2_TREASURES', () => {
  it("holds exactly the spring cave Area 7 treasures, the owner's 12 in rarity order, then the Glowworm Paint shell (issue #105)", () => {
    expect(SPRING_CAVE_2_TREASURES).toEqual([
      { id: 'spring-cave/mossy-rock', name: 'Mossy rock', rarity: 'common', category: 'decoration' },
      { id: 'spring-cave/bubble-stone', name: 'Bubble stone', rarity: 'common', category: 'decoration' },
      {
        id: 'spring-cave/climbing-helmet',
        name: 'Climbing helmet',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'dash', value: 10 },
      },
      {
        id: 'spring-cave/pebble-necklace',
        name: 'Pebble necklace',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'regrowth', value: 10 },
      },
      { id: 'spring-cave/ancient-clay-pot', name: 'Ancient clay pot', rarity: 'rare', category: 'decoration' },
      {
        id: 'spring-cave/glowing-stalactite',
        name: 'Glowing stalactite',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'spring-cave/cave-goggles',
        name: 'Cave goggles',
        rarity: 'rare',
        category: 'wearable',
        slot: 'face',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'spring-cave/paint-shell-chocolate',
        name: 'Chocolate Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'chocolate',
      },
      { id: 'spring-cave/bubble-machine', name: 'Bubble machine', rarity: 'epic', category: 'decoration' },
      {
        id: 'spring-cave/glow-tail-lantern',
        name: 'Glow tail lantern',
        rarity: 'epic',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'snackMagnet', value: 50 },
      },
      { id: 'spring-cave/underground-waterfall', name: 'Underground waterfall', rarity: 'legendary', category: 'decoration' },
      {
        id: 'spring-cave/gemstone-cape',
        name: 'Gemstone cape',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'shell', value: 1 },
      },
      {
        id: 'spring-cave/paint-shell-glowworm',
        name: 'Glowworm Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'glowworm',
      },
    ]);
    expect(Object.isFrozen(SPRING_CAVE_2_TREASURES)).toBe(true);
  });

  it('gives every Area 7 Wearable its PERK_VALUES value, no set, and a perk type no other Area 7 Wearable has (ND-13)', () => {
    const wearables = SPRING_CAVE_2_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
  });

  it('has 6 Decorations, 5 Wearables and the Chocolate and Glowworm Paint shells, in rarity order, with the Ancient clay pot Rare', () => {
    expect(SPRING_CAVE_2_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_2_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(SPRING_CAVE_2_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(SPRING_CAVE_2_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'spring-cave/paint-shell-chocolate',
      'spring-cave/paint-shell-glowworm',
    ]);
    const rarityIndexes = SPRING_CAVE_2_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => SPRING_CAVE_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    expect(treasureById('spring-cave/ancient-clay-pot')?.rarity).toBe('rare');
  });

  it('keeps every earlier area list unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES).toHaveLength(13);
    expect(CHINAMPA_2_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_TREASURES.at(-1)?.id).toBe('spring-cave/paint-shell-crystal-shine');
  });
});

describe('DEEP_CANAL_TREASURES', () => {
  it("holds exactly the deep canal Area 8 treasures, the owner's 12 in rarity order, then the Fiesta shine Paint shell (issue #78)", () => {
    expect(DEEP_CANAL_TREASURES).toEqual([
      {
        id: 'deep-canal/flower-garland',
        name: 'Flower garland',
        rarity: 'common',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'deep-canal/paper-boat',
        name: 'Paper boat',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/sailor-cap',
        name: 'Sailor cap',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'speed', value: 4 },
      },
      {
        id: 'deep-canal/striped-scarf',
        name: 'Striped scarf',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'regrowth', value: 10 },
      },
      {
        id: 'deep-canal/little-trajinera',
        name: 'Little trajinera',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      { id: 'deep-canal/painted-oar', name: 'Painted oar', rarity: 'rare', category: 'decoration' },
      {
        id: 'deep-canal/mariachi-jacket',
        name: 'Mariachi jacket',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'dash', value: 15 },
      },
      {
        id: 'deep-canal/paint-shell-jade',
        name: 'Jade Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'jade',
      },
      { id: 'deep-canal/trajinera-flower-arch', name: 'Trajinera flower arch', rarity: 'epic', category: 'decoration' },
      {
        id: 'deep-canal/captains-hat',
        name: "Captain's hat",
        rarity: 'epic',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'treasureSense', value: 35 },
      },
      {
        id: 'deep-canal/floating-flower-market',
        name: 'Floating flower market',
        rarity: 'legendary',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/rainbow-fin-streamers',
        name: 'Rainbow fin streamers',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'snackMagnet', value: 60 },
      },
      {
        id: 'deep-canal/paint-shell-fiesta-shine',
        name: 'Fiesta shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'fiesta-shine',
      },
    ]);
    expect(Object.isFrozen(DEEP_CANAL_TREASURES)).toBe(true);
  });

  it('gives every Area 8 Wearable its PERK_VALUES value, no set, and a perk type no other Area 8 Wearable has (ND-14)', () => {
    const wearables = DEEP_CANAL_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
  });

  it('has 6 Decorations, 5 Wearables and the Jade and Fiesta shine Paint shells, in rarity order, with the Little trajinera Rare', () => {
    expect(DEEP_CANAL_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(DEEP_CANAL_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(DEEP_CANAL_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'deep-canal/paint-shell-jade',
      'deep-canal/paint-shell-fiesta-shine',
    ]);
    const rarityIndexes = DEEP_CANAL_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => DEEP_CANAL_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    expect(treasureById('deep-canal/little-trajinera')?.rarity).toBe('rare');
  });

  it('keeps every earlier area list unchanged ahead of it', () => {
    expect(CANAL_TREASURES).toHaveLength(20);
    expect(POND_TREASURES).toHaveLength(13);
    expect(POND_2_TREASURES).toHaveLength(13);
    expect(CHINAMPA_TREASURES).toHaveLength(13);
    expect(CHINAMPA_2_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_2_TREASURES).toHaveLength(13);
    expect(SPRING_CAVE_2_TREASURES.at(-1)?.id).toBe('spring-cave/paint-shell-glowworm');
  });
});

describe('DEEP_CANAL_2_TREASURES', () => {
  it("holds exactly the deep canal Area 9 treasures, the owner's 12 in rarity order, then the Lantern shine Paint shell (issue #107)", () => {
    expect(DEEP_CANAL_2_TREASURES).toEqual([
      { id: 'deep-canal/clay-jug', name: 'Clay jug', rarity: 'common', category: 'decoration' },
      {
        id: 'deep-canal/floating-cork',
        name: 'Floating cork',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/bucket-hat',
        name: 'Bucket hat',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'treasureSense', value: 15 },
      },
      {
        id: 'deep-canal/rope-necklace',
        name: 'Rope necklace',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'snackMagnet', value: 30 },
      },
      { id: 'deep-canal/little-bailing-bucket', name: 'Little bailing bucket', rarity: 'rare', category: 'decoration' },
      {
        id: 'deep-canal/painted-name-sign',
        name: 'Painted name sign',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'deep-canal/poncho',
        name: 'Poncho',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'deep-canal/paint-shell-olive',
        name: 'Olive Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'olive',
      },
      {
        id: 'deep-canal/paper-lantern-boat',
        name: 'Paper lantern boat',
        rarity: 'epic',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/tail-bell',
        name: 'Tail bell',
        rarity: 'epic',
        category: 'wearable',
        slot: 'tail',
        perk: { type: 'speed', value: 8 },
      },
      {
        id: 'deep-canal/floating-music-stage',
        name: 'Floating music stage',
        rarity: 'legendary',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/golden-boatman-cape',
        name: 'Golden boatman cape',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'dash', value: 25 },
      },
      {
        id: 'deep-canal/paint-shell-lantern-shine',
        name: 'Lantern shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'lantern-shine',
      },
    ]);
    expect(Object.isFrozen(DEEP_CANAL_2_TREASURES)).toBe(true);
  });

  it('gives every Area 9 Wearable its PERK_VALUES value, no set, and a perk type no other Area 9 Wearable has (ND-4)', () => {
    const wearables = DEEP_CANAL_2_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
  });

  it('has 6 Decorations, 5 Wearables and the Olive and Lantern shine Paint shells, in rarity order, with the Little bailing bucket a Rare Floor Decoration', () => {
    expect(DEEP_CANAL_2_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_2_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(DEEP_CANAL_2_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(DEEP_CANAL_2_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'deep-canal/paint-shell-olive',
      'deep-canal/paint-shell-lantern-shine',
    ]);
    const rarityIndexes = DEEP_CANAL_2_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => DEEP_CANAL_2_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    const bucket = treasureById('deep-canal/little-bailing-bucket');
    expect(bucket?.rarity).toBe('rare');
    expect(bucket !== undefined && isDecoration(bucket) && placementKind(bucket)).toBe('floor');
  });

  it('keeps every slug apart from the Area 8 slugs it shares the deep-canal/ prefix with', () => {
    const area8Ids = new Set(DEEP_CANAL_TREASURES.map((treasure) => treasure.id));
    for (const treasure of DEEP_CANAL_2_TREASURES) {
      expect(treasure.id).toMatch(/^deep-canal\/[a-z0-9-]+$/);
      expect(area8Ids.has(treasure.id), treasure.id).toBe(false);
    }
  });

  it('keeps every earlier area list unchanged ahead of it', () => {
    expect(DEEP_CANAL_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_TREASURES.at(-1)?.id).toBe('deep-canal/paint-shell-fiesta-shine');
  });
});

describe('DEEP_CANAL_3_TREASURES', () => {
  it("holds exactly the deep canal Area 10 treasures, the owner's 12 in rarity order, then the Confetti shine Paint shell (issue #108)", () => {
    expect(DEEP_CANAL_3_TREASURES).toEqual([
      {
        id: 'deep-canal/festival-flag-string',
        name: 'Festival flag string',
        rarity: 'common',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'deep-canal/floating-candle',
        name: 'Floating candle',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/party-hat',
        name: 'Party hat',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'dash', value: 10 },
      },
      {
        id: 'deep-canal/confetti-scarf',
        name: 'Confetti scarf',
        rarity: 'common',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'treasureSense', value: 15 },
      },
      { id: 'deep-canal/axolotl-statue', name: 'Axolotl statue', rarity: 'rare', category: 'decoration' },
      {
        id: 'deep-canal/marigold-boat',
        name: 'Marigold boat',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/festival-shirt',
        name: 'Festival shirt',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'speed', value: 6 },
      },
      {
        id: 'deep-canal/paint-shell-peach',
        name: 'Peach Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'peach',
      },
      { id: 'deep-canal/mariachi-band-figures', name: 'Mariachi band figures', rarity: 'epic', category: 'decoration' },
      {
        id: 'deep-canal/hero-medal',
        name: 'Hero medal',
        rarity: 'epic',
        category: 'wearable',
        slot: 'neck',
        perk: { type: 'shell', value: 1 },
      },
      { id: 'deep-canal/refuge-snow-globe', name: 'Refuge snow globe', rarity: 'legendary', category: 'decoration' },
      {
        id: 'deep-canal/champion-crown',
        name: 'Champion crown',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'regrowth', value: 25 },
      },
      {
        id: 'deep-canal/paint-shell-confetti-shine',
        name: 'Confetti shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'confetti-shine',
      },
    ]);
    expect(Object.isFrozen(DEEP_CANAL_3_TREASURES)).toBe(true);
  });

  it('gives every Area 10 Wearable its PERK_VALUES value, no set, and a perk type no other Area 10 Wearable has (ND-5)', () => {
    const wearables = DEEP_CANAL_3_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
  });

  it('has 6 Decorations, 5 Wearables and the Peach and Confetti shine Paint shells, in rarity order, with the Axolotl statue a Rare Floor Decoration', () => {
    expect(DEEP_CANAL_3_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_3_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(DEEP_CANAL_3_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(DEEP_CANAL_3_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'deep-canal/paint-shell-peach',
      'deep-canal/paint-shell-confetti-shine',
    ]);
    const rarityIndexes = DEEP_CANAL_3_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => DEEP_CANAL_3_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 3]);
    const statue = treasureById('deep-canal/axolotl-statue');
    expect(statue?.rarity).toBe('rare');
    expect(statue !== undefined && isDecoration(statue) && placementKind(statue)).toBe('floor');
  });

  it('keeps every slug apart from the Area 8 and Area 9 slugs it shares the deep-canal/ prefix with', () => {
    const earlierIds = new Set([...DEEP_CANAL_TREASURES, ...DEEP_CANAL_2_TREASURES].map((treasure) => treasure.id));
    for (const treasure of DEEP_CANAL_3_TREASURES) {
      expect(treasure.id).toMatch(/^deep-canal\/[a-z0-9-]+$/);
      expect(earlierIds.has(treasure.id), treasure.id).toBe(false);
    }
  });

  it('keeps every earlier area list unchanged ahead of it', () => {
    expect(DEEP_CANAL_2_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_2_TREASURES.at(-1)?.id).toBe('deep-canal/paint-shell-lantern-shine');
  });
});

describe('DEEP_CANAL_4_TREASURES', () => {
  it('holds the deep canal Area 11 treasures: the Little cormorant, then the Marigold Paint shell, then the Golden shine one (issue #112), then the owner\'s 11 ending with the Lagoon shine one (issue #207)', () => {
    expect(DEEP_CANAL_4_TREASURES).toEqual([
      {
        id: 'deep-canal/little-cormorant',
        name: 'Little cormorant',
        rarity: 'rare',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/paint-shell-marigold',
        name: 'Marigold Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'marigold',
      },
      {
        id: 'deep-canal/paint-shell-golden-hour-shine',
        name: 'Golden shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'golden-hour-shine',
      },
      {
        id: 'deep-canal/flower-raft',
        name: 'Flower raft',
        rarity: 'common',
        category: 'decoration',
        placement: 'floating',
      },
      {
        id: 'deep-canal/propeller-cap',
        name: 'Propeller cap',
        rarity: 'common',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'speed', value: 4 },
      },
      {
        id: 'deep-canal/paint-shell-lime',
        name: 'Lime Paint shell',
        rarity: 'common',
        category: 'paintShell',
        dreamColour: 'lime',
      },
      {
        id: 'deep-canal/festival-kite',
        name: 'Festival kite',
        rarity: 'rare',
        category: 'decoration',
        placement: 'hanging',
      },
      {
        id: 'deep-canal/star-sunglasses',
        name: 'Star sunglasses',
        rarity: 'rare',
        category: 'wearable',
        slot: 'face',
        perk: { type: 'treasureSense', value: 25 },
      },
      {
        id: 'deep-canal/robot-suit',
        name: 'Robot suit',
        rarity: 'rare',
        category: 'wearable',
        slot: 'shirt',
        perk: { type: 'regrowth', value: 15 },
      },
      {
        id: 'deep-canal/paint-shell-hyacinth',
        name: 'Hyacinth Paint shell',
        rarity: 'rare',
        category: 'paintShell',
        dreamColour: 'hyacinth',
      },
      { id: 'deep-canal/carousel', name: 'Carousel', rarity: 'epic', category: 'decoration' },
      {
        id: 'deep-canal/jetpack',
        name: 'Jetpack',
        rarity: 'epic',
        category: 'wearable',
        slot: 'back',
        perk: { type: 'dash', value: 20 },
      },
      {
        id: 'deep-canal/wizard-hat',
        name: 'Wizard hat',
        rarity: 'legendary',
        category: 'wearable',
        slot: 'head',
        perk: { type: 'shell', value: 1 },
      },
      {
        id: 'deep-canal/paint-shell-lagoon-shine',
        name: 'Lagoon shine Paint shell',
        rarity: 'legendary',
        category: 'paintShell',
        dreamColour: 'lagoon-shine',
      },
    ]);
    expect(Object.isFrozen(DEEP_CANAL_4_TREASURES)).toBe(true);
  });

  it('makes the Little cormorant a Rare Floating Decoration with the standard width, ahead of the Paint shells, in rarity order', () => {
    const cormorant = treasureById('deep-canal/little-cormorant');
    expect(cormorant?.rarity).toBe('rare');
    expect(cormorant !== undefined && isDecoration(cormorant) && placementKind(cormorant)).toBe('floating');
    expect(cormorant !== undefined && isDecoration(cormorant) && cormorant.width).toBeUndefined();
    expect(cormorant !== undefined && categoryName(cormorant.category)).toBe('Decoration');
    expect(DEEP_CANAL_4_TREASURES.at(0)?.id).toBe('deep-canal/little-cormorant');
    const rarityIndexes = DEEP_CANAL_4_TREASURES.slice(0, 3).map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
  });

  it('adds the owner\'s 11 after the Golden shine Paint shell, in rarity order: 3 Decorations, 5 Wearables and the Lime, Hyacinth and Lagoon shine Paint shells (issue #207)', () => {
    expect(DEEP_CANAL_4_TREASURES).toHaveLength(14);
    expect(DEEP_CANAL_4_TREASURES.at(2)?.id).toBe('deep-canal/paint-shell-golden-hour-shine');
    const added = DEEP_CANAL_4_TREASURES.slice(3);
    expect(added).toHaveLength(11);
    const rarityIndexes = added.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => added.filter((treasure) => treasure.rarity === rarity).length)).toEqual([3, 4, 2, 2]);
    expect(RARITIES.map((rarity) => DEEP_CANAL_4_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([3, 6, 2, 3]);
    expect(DEEP_CANAL_4_TREASURES.filter(isDecoration).map((decoration) => decoration.id)).toEqual([
      'deep-canal/little-cormorant',
      'deep-canal/flower-raft',
      'deep-canal/festival-kite',
      'deep-canal/carousel',
    ]);
    expect(DEEP_CANAL_4_TREASURES.filter(isWearable).map((wearable) => wearable.id)).toEqual([
      'deep-canal/propeller-cap',
      'deep-canal/star-sunglasses',
      'deep-canal/robot-suit',
      'deep-canal/jetpack',
      'deep-canal/wizard-hat',
    ]);
    expect(DEEP_CANAL_4_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual([
      'deep-canal/paint-shell-marigold',
      'deep-canal/paint-shell-golden-hour-shine',
      'deep-canal/paint-shell-lime',
      'deep-canal/paint-shell-hyacinth',
      'deep-canal/paint-shell-lagoon-shine',
    ]);
    expect(DEEP_CANAL_4_TREASURES.at(-1)?.id).toBe('deep-canal/paint-shell-lagoon-shine');
  });

  it('places the Flower raft Floating, the Festival kite Hanging and the Carousel on the Floor, each at the standard width (issue #207)', () => {
    const placements = ['deep-canal/flower-raft', 'deep-canal/festival-kite', 'deep-canal/carousel'].map((id) => {
      const decoration = treasureById(id);
      expect(decoration !== undefined && isDecoration(decoration), id).toBe(true);
      expect(decoration !== undefined && isDecoration(decoration) && decoration.width, id).toBeUndefined();
      return decoration !== undefined && isDecoration(decoration) ? placementKind(decoration) : undefined;
    });
    expect(placements).toEqual(['floating', 'hanging', 'floor']);
  });

  it('gives every Area 11 Wearable its PERK_VALUES value, no set, and a perk type no other Area 11 Wearable has (issue #207)', () => {
    const wearables = DEEP_CANAL_4_TREASURES.filter(isWearable);
    for (const wearable of wearables) {
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
      expect(wearable.setId, wearable.id).toBeUndefined();
    }
    expect(new Set(wearables.map((wearable) => wearable.perk.type)).size).toBe(wearables.length);
    expect(wearables.map((wearable) => [wearable.slot, wearable.perk.type])).toEqual([
      ['head', 'speed'],
      ['face', 'treasureSense'],
      ['shirt', 'regrowth'],
      ['back', 'dash'],
      ['head', 'shell'],
    ]);
  });

  it('keeps every slug apart from the Area 8, Area 9 and Area 10 slugs it shares the deep-canal/ prefix with', () => {
    const earlierIds = new Set([...DEEP_CANAL_TREASURES, ...DEEP_CANAL_2_TREASURES, ...DEEP_CANAL_3_TREASURES].map((treasure) => treasure.id));
    for (const treasure of DEEP_CANAL_4_TREASURES) {
      expect(treasure.id).toMatch(/^deep-canal\/[a-z0-9-]+$/);
      expect(earlierIds.has(treasure.id), treasure.id).toBe(false);
    }
  });

  it('keeps every earlier area list unchanged ahead of it', () => {
    expect(DEEP_CANAL_3_TREASURES).toHaveLength(13);
    expect(DEEP_CANAL_3_TREASURES.at(-1)?.id).toBe('deep-canal/paint-shell-confetti-shine');
  });
});

describe('ALL_TREASURES', () => {
  it('is the canal, pond, pond Area 3, chinampa Area 4, chinampa Area 5, spring cave Area 6, spring cave Area 7, deep canal Area 8, deep canal Area 9, deep canal Area 10, deep canal Area 11, open lake Area 12 and open lake Area 13 treasures, in that order', () => {
    expect(ALL_TREASURES).toEqual([
      ...CANAL_TREASURES,
      ...POND_TREASURES,
      ...POND_2_TREASURES,
      ...CHINAMPA_TREASURES,
      ...CHINAMPA_2_TREASURES,
      ...SPRING_CAVE_TREASURES,
      ...SPRING_CAVE_2_TREASURES,
      ...DEEP_CANAL_TREASURES,
      ...DEEP_CANAL_2_TREASURES,
      ...DEEP_CANAL_3_TREASURES,
      ...DEEP_CANAL_4_TREASURES,
      ...OPEN_LAKE_TREASURES,
      ...OPEN_LAKE_2_TREASURES,
    ]);
    expect(Object.isFrozen(ALL_TREASURES)).toBe(true);
    expect(Object.isFrozen(POND_TREASURES)).toBe(true);
  });

  it('has 179 treasures: 72 Decorations, 72 Wearables and 35 Paint shells', () => {
    expect(ALL_TREASURES).toHaveLength(179);
    expect(ALL_DECORATIONS).toHaveLength(72);
    expect(ALL_WEARABLES).toHaveLength(72);
    expect(ALL_TREASURES.filter(isPaintShell)).toHaveLength(35);
  });

  it('puts Shell perks only on Epic or Legendary Wearables', () => {
    const shellWearables = ALL_WEARABLES.filter((wearable) => wearable.perk.type === 'shell');
    expect(shellWearables.map((wearable) => wearable.id)).toEqual([
      'pond/ladybug-backpack',
      'canal/golden-bow',
      'pond/pearl-tail-charm',
      'chinampa/rainbow-serape-cape',
      'spring-cave/gemstone-cape',
      'deep-canal/hero-medal',
      'deep-canal/wizard-hat',
      'open-lake/mini-submarine',
    ]);
    for (const wearable of shellWearables) {
      expect(['epic', 'legendary'], wearable.id).toContain(wearable.rarity);
    }
  });

  it('keeps every treasure slug apart from the dev Decoration slugs', () => {
    const slugs = new Set(ALL_TREASURES.map((treasure) => treasureSlug(treasure.id)));
    for (const decoration of DEV_DECORATIONS) {
      expect(slugs.has(treasureSlug(decoration.id)), decoration.id).toBe(false);
    }
  });

  it('has unique ids of the form <area>/<slug>, unique names and unique slugs', () => {
    const ids = ALL_TREASURES.map((treasure) => treasure.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^(canal|pond|chinampa|spring-cave|deep-canal|open-lake)\/[a-z0-9-]+$/);
    }
    const names = ALL_TREASURES.map((treasure) => treasure.name);
    expect(new Set(names).size).toBe(names.length);
    const slugs = ids.map(treasureSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('meets the B3 minimums', () => {
    for (const rarity of RARITIES) {
      expect(ALL_DECORATIONS.some((treasure) => treasure.rarity === rarity), rarity).toBe(true);
      expect(ALL_WEARABLES.some((treasure) => treasure.rarity === rarity), rarity).toBe(true);
    }
    for (const slot of WEARABLE_SLOTS) {
      expect(ALL_WEARABLES.some((wearable) => wearable.slot === slot), slot).toBe(true);
    }
    expect(ALL_DECORATIONS.length).toBeGreaterThanOrEqual(4);
    expect(ALL_WEARABLES.length).toBeGreaterThanOrEqual(8);
  });

  it('gives every Wearable exactly one perk at its PERK_VALUES value', () => {
    for (const wearable of ALL_WEARABLES) {
      expect(Object.keys(wearable.perk).sort()).toEqual(['type', 'value']);
      expect(wearable.perk.value, wearable.id).toBe(PERK_VALUES[wearable.perk.type][wearable.rarity]);
    }
  });

  it('has one Paint shell per Dream colour, at its colour rarity', () => {
    const shells = ALL_TREASURES.filter(isPaintShell);
    expect(shells.map((shell) => shell.dreamColour)).toEqual(DREAM_COLOURS.map((colour) => colour.id));
    for (const shell of shells) {
      expect(shell.rarity, shell.id).toBe(dreamColourById(shell.dreamColour)?.rarity);
    }
  });
});

describe('Dream colours', () => {
  it('lists the colours in area order: the canal 9, Lily green, Firefly gold, Galaxy, Poppy red, Rainbow, Plum, Tie-dye galaxy, Moonstone, Crystal shine, Chocolate, Glowworm, Jade, Fiesta shine, Olive, Lantern shine, Peach, Confetti shine, Marigold, Golden shine, Lime, Hyacinth, Lagoon shine, Tule green, Obsidian, Pitch black, Trench shine', () => {
    expect(CANAL_DREAM_COLOURS).toHaveLength(9);
    expect(DREAM_COLOURS).toEqual([
      ...CANAL_DREAM_COLOURS,
      LILY_GREEN,
      FIREFLY_GOLD,
      GALAXY,
      POPPY_RED,
      RAINBOW,
      PLUM,
      TIE_DYE_GALAXY,
      MOONSTONE,
      CRYSTAL_SHINE,
      CHOCOLATE,
      GLOWWORM,
      JADE,
      FIESTA_SHINE,
      OLIVE,
      LANTERN_SHINE,
      PEACH,
      CONFETTI_SHINE,
      MARIGOLD,
      GOLDEN_HOUR_SHINE,
      LIME,
      HYACINTH,
      LAGOON_SHINE,
      TULE_GREEN,
      OBSIDIAN,
      PITCH_BLACK,
      TRENCH_SHINE,
    ]);
    expect(DREAM_COLOURS).toHaveLength(35);
    expect(Object.isFrozen(DREAM_COLOURS)).toBe(true);
  });

  it('makes Firefly gold a rare solid', () => {
    expect(FIREFLY_GOLD).toEqual({ id: 'firefly-gold', name: 'Firefly gold', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(FIREFLY_GOLD)).toBe(true);
    expect(dreamColourById('firefly-gold')).toBe(FIREFLY_GOLD);
  });

  it('keeps every solid Dream colour Common or Rare', () => {
    const solids = DREAM_COLOURS.filter((colour) => colour.kind === 'solid');
    expect(solids.map((colour) => colour.id)).toEqual([
      'mint',
      'sky-blue',
      'lavender',
      'sunset-orange',
      'bubblegum',
      'midnight-blue',
      'lily-green',
      'firefly-gold',
      'poppy-red',
      'plum',
      'moonstone',
      'chocolate',
      'jade',
      'olive',
      'peach',
      'marigold',
      'lime',
      'hyacinth',
      'tule-green',
      'obsidian',
      'pitch-black',
    ]);
    for (const colour of solids) {
      expect(['common', 'rare'], colour.id).toContain(colour.rarity);
    }
  });

  it('makes Poppy red a rare solid with a name no other Dream colour has', () => {
    expect(POPPY_RED).toEqual({ id: 'poppy-red', name: 'Poppy red', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(POPPY_RED)).toBe(true);
    expect(dreamColourById('poppy-red')).toBe(POPPY_RED);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Plum a rare solid with a name no other Dream colour has (issue #103)', () => {
    expect(PLUM).toEqual({ id: 'plum', name: 'Plum', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(PLUM)).toBe(true);
    expect(dreamColourById('plum')).toBe(PLUM);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Moonstone a rare solid, the seventeenth Dream colour, with a name no other Dream colour has (issue #77)', () => {
    expect(MOONSTONE).toEqual({ id: 'moonstone', name: 'Moonstone', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(MOONSTONE)).toBe(true);
    expect(dreamColourById('moonstone')).toBe(MOONSTONE);
    expect(DREAM_COLOURS.at(16)).toBe(MOONSTONE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Chocolate a rare solid, the nineteenth Dream colour, with a name no other Dream colour has (issue #105)', () => {
    expect(CHOCOLATE).toEqual({ id: 'chocolate', name: 'Chocolate', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(CHOCOLATE)).toBe(true);
    expect(dreamColourById('chocolate')).toBe(CHOCOLATE);
    expect(DREAM_COLOURS.at(18)).toBe(CHOCOLATE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Crystal shine a Legendary sheen, the eighteenth Dream colour, with a name no other Dream colour has', () => {
    expect(CRYSTAL_SHINE).toEqual({ id: 'crystal-shine', name: 'Crystal shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(CRYSTAL_SHINE)).toBe(true);
    expect(dreamColourById('crystal-shine')).toBe(CRYSTAL_SHINE);
    expect(DREAM_COLOURS.at(17)).toBe(CRYSTAL_SHINE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Glowworm a Legendary patterned colour, the twentieth Dream colour, with a name no other Dream colour has', () => {
    expect(GLOWWORM).toEqual({ id: 'glowworm', name: 'Glowworm', rarity: 'legendary', kind: 'patterned' });
    expect(Object.isFrozen(GLOWWORM)).toBe(true);
    expect(dreamColourById('glowworm')).toBe(GLOWWORM);
    expect(DREAM_COLOURS.at(19)).toBe(GLOWWORM);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Jade a rare solid, the twenty-first Dream colour, with a name no other Dream colour has (issue #78)', () => {
    expect(JADE).toEqual({ id: 'jade', name: 'Jade', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(JADE)).toBe(true);
    expect(dreamColourById('jade')).toBe(JADE);
    expect(DREAM_COLOURS.at(20)).toBe(JADE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Fiesta shine a Legendary sheen, the twenty-second Dream colour, with a name no other Dream colour has (issue #78)', () => {
    expect(FIESTA_SHINE).toEqual({ id: 'fiesta-shine', name: 'Fiesta shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(FIESTA_SHINE)).toBe(true);
    expect(dreamColourById('fiesta-shine')).toBe(FIESTA_SHINE);
    expect(DREAM_COLOURS.at(21)).toBe(FIESTA_SHINE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Olive a rare solid, the twenty-third Dream colour, with a name no other Dream colour has (issue #107)', () => {
    expect(OLIVE).toEqual({ id: 'olive', name: 'Olive', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(OLIVE)).toBe(true);
    expect(dreamColourById('olive')).toBe(OLIVE);
    expect(DREAM_COLOURS.at(22)).toBe(OLIVE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Lantern shine a Legendary sheen, the twenty-fourth Dream colour, with a name no other Dream colour has (issue #107)', () => {
    expect(LANTERN_SHINE).toEqual({ id: 'lantern-shine', name: 'Lantern shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(LANTERN_SHINE)).toBe(true);
    expect(dreamColourById('lantern-shine')).toBe(LANTERN_SHINE);
    expect(DREAM_COLOURS.at(23)).toBe(LANTERN_SHINE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Peach a rare solid, the twenty-fifth Dream colour, with a name no other Dream colour has (issue #108)', () => {
    expect(PEACH).toEqual({ id: 'peach', name: 'Peach', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(PEACH)).toBe(true);
    expect(dreamColourById('peach')).toBe(PEACH);
    expect(DREAM_COLOURS.at(24)).toBe(PEACH);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Confetti shine a Legendary sheen, the twenty-sixth Dream colour, with a name no other Dream colour has (issue #108)', () => {
    expect(CONFETTI_SHINE).toEqual({ id: 'confetti-shine', name: 'Confetti shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(CONFETTI_SHINE)).toBe(true);
    expect(dreamColourById('confetti-shine')).toBe(CONFETTI_SHINE);
    expect(DREAM_COLOURS.at(25)).toBe(CONFETTI_SHINE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Marigold a rare solid, the twenty-seventh Dream colour, with a name no other Dream colour has (issue #112)', () => {
    expect(MARIGOLD).toEqual({ id: 'marigold', name: 'Marigold', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(MARIGOLD)).toBe(true);
    expect(dreamColourById('marigold')).toBe(MARIGOLD);
    expect(DREAM_COLOURS.at(26)).toBe(MARIGOLD);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Golden shine a Legendary sheen, the twenty-eighth Dream colour, with a name no other Dream colour has (issue #112)', () => {
    expect(GOLDEN_HOUR_SHINE).toEqual({ id: 'golden-hour-shine', name: 'Golden shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(GOLDEN_HOUR_SHINE)).toBe(true);
    expect(dreamColourById('golden-hour-shine')).toBe(GOLDEN_HOUR_SHINE);
    expect(DREAM_COLOURS.at(27)).toBe(GOLDEN_HOUR_SHINE);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Lime a Common solid, the twenty-ninth Dream colour, with a name no other Dream colour has (issue #207)', () => {
    expect(LIME).toEqual({ id: 'lime', name: 'Lime', rarity: 'common', kind: 'solid' });
    expect(Object.isFrozen(LIME)).toBe(true);
    expect(dreamColourById('lime')).toBe(LIME);
    expect(DREAM_COLOURS.at(28)).toBe(LIME);
    expect(dreamRarityAllowed(LIME)).toBe(true);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Hyacinth a Rare solid, the thirtieth Dream colour, with a name no other Dream colour has (issue #207)', () => {
    expect(HYACINTH).toEqual({ id: 'hyacinth', name: 'Hyacinth', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(HYACINTH)).toBe(true);
    expect(dreamColourById('hyacinth')).toBe(HYACINTH);
    expect(DREAM_COLOURS.at(29)).toBe(HYACINTH);
    expect(dreamRarityAllowed(HYACINTH)).toBe(true);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Lagoon shine a Legendary sheen, the thirty-first Dream colour, with a name no other Dream colour has (issue #207)', () => {
    expect(LAGOON_SHINE).toEqual({ id: 'lagoon-shine', name: 'Lagoon shine', rarity: 'legendary', kind: 'sheen' });
    expect(Object.isFrozen(LAGOON_SHINE)).toBe(true);
    expect(dreamColourById('lagoon-shine')).toBe(LAGOON_SHINE);
    expect(DREAM_COLOURS.at(30)).toBe(LAGOON_SHINE);
    expect(dreamRarityAllowed(LAGOON_SHINE)).toBe(true);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Tule green a Common solid, the thirty-second Dream colour, with a name no other Dream colour has (issue #214, ND-2)', () => {
    expect(TULE_GREEN).toEqual({ id: 'tule-green', name: 'Tule green', rarity: 'common', kind: 'solid' });
    expect(Object.isFrozen(TULE_GREEN)).toBe(true);
    expect(dreamColourById('tule-green')).toBe(TULE_GREEN);
    expect(DREAM_COLOURS.at(31)).toBe(TULE_GREEN);
    expect(dreamRarityAllowed(TULE_GREEN)).toBe(true);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes Obsidian a Rare solid, the thirty-third Dream colour and the last of Area 12, with a name no other Dream colour has (issue #214, ND-2)', () => {
    expect(OBSIDIAN).toEqual({ id: 'obsidian', name: 'Obsidian', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(OBSIDIAN)).toBe(true);
    expect(dreamColourById('obsidian')).toBe(OBSIDIAN);
    expect(DREAM_COLOURS.at(32)).toBe(OBSIDIAN);
    expect(DREAM_COLOURS.at(DREAM_COLOURS.indexOf(PITCH_BLACK) - 1)).toBe(OBSIDIAN);
    expect(dreamRarityAllowed(OBSIDIAN)).toBe(true);
    const names = DREAM_COLOURS.map((colour) => colour.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the three moved Legendary colours patterned, frozen and findable by id (issue #146)', () => {
    expect(GALAXY).toEqual({ id: 'galaxy', name: 'Galaxy', rarity: 'legendary', kind: 'patterned' });
    expect(RAINBOW).toEqual({ id: 'rainbow', name: 'Rainbow', rarity: 'legendary', kind: 'patterned' });
    expect(TIE_DYE_GALAXY).toEqual({ id: 'tie-dye-galaxy', name: 'Tie-dye galaxy', rarity: 'legendary', kind: 'patterned' });
    for (const colour of [GALAXY, RAINBOW, TIE_DYE_GALAXY]) {
      expect(Object.isFrozen(colour), colour.id).toBe(true);
      expect(dreamColourById(colour.id), colour.id).toBe(colour);
    }
  });

  it('makes Lily green a rare solid', () => {
    expect(LILY_GREEN).toEqual({ id: 'lily-green', name: 'Lily green', rarity: 'rare', kind: 'solid' });
    expect(dreamColourById('lily-green')).toBe(LILY_GREEN);
  });
});

describe('dreamRarityAllowed', () => {
  it('holds for every Dream colour and every Paint shell', () => {
    for (const colour of DREAM_COLOURS) {
      expect(dreamRarityAllowed(colour), colour.id).toBe(true);
    }
    for (const shell of ALL_TREASURES.filter(isPaintShell)) {
      const colour = dreamColourById(shell.dreamColour);
      expect(colour, shell.id).toBeDefined();
      expect(dreamRarityAllowed({ ...colour!, rarity: shell.rarity }), shell.id).toBe(true);
    }
  });

  it('grandfathers exactly Hearts, Tie-dye and Iridescent as the Epic patterned and sheen colours', () => {
    expect(GRANDFATHERED_EPIC_DREAM_IDS).toEqual(['hearts', 'tie-dye', 'iridescent']);
    expect(Object.isFrozen(GRANDFATHERED_EPIC_DREAM_IDS)).toBe(true);
    const epicIds = DREAM_COLOURS.filter((colour) => colour.rarity === 'epic').map((colour) => colour.id);
    expect(epicIds).toEqual(GRANDFATHERED_EPIC_DREAM_IDS);
  });

  it.each<[DreamKind, Rarity]>([
    ['patterned', 'common'],
    ['patterned', 'rare'],
    ['patterned', 'epic'],
    ['sheen', 'common'],
    ['sheen', 'rare'],
    ['sheen', 'epic'],
  ])('rejects a new %s colour at %s', (kind, rarity) => {
    expect(dreamRarityAllowed({ id: 'glowworm', kind, rarity })).toBe(false);
  });

  it.each<Rarity>(['epic', 'legendary'])('rejects a solid colour at %s', (rarity) => {
    expect(dreamRarityAllowed({ id: 'chocolate', kind: 'solid', rarity })).toBe(false);
  });

  it.each<Rarity>(['common', 'rare', 'legendary'])('rejects a grandfathered colour at %s', (rarity) => {
    expect(dreamRarityAllowed({ id: 'hearts', kind: 'patterned', rarity })).toBe(false);
  });
});

describe('lookups', () => {
  it('treasureById finds a known id and returns undefined for an unknown one', () => {
    expect(treasureById('canal/sun-hat')).toMatchObject({ name: 'Sun hat', category: 'wearable', slot: 'head' });
    expect(treasureById('canal/no-such-thing')).toBeUndefined();
  });

  it('treasureById finds pond ids', () => {
    expect(treasureById('pond/raincoat')).toMatchObject({ name: 'Raincoat', category: 'wearable', slot: 'shirt' });
    expect(treasureById('pond/paint-shell-lily-green')).toMatchObject({ dreamColour: 'lily-green', rarity: 'rare' });
    expect(treasureById('pond/sun-hat')).toBeUndefined();
  });

  it('treasureById finds pond Area 3 ids', () => {
    expect(treasureById('pond/firefly-cape')).toMatchObject({ name: 'Firefly cape', category: 'wearable', slot: 'back' });
    expect(treasureById('pond/paint-shell-firefly-gold')).toMatchObject({
      dreamColour: 'firefly-gold',
      rarity: 'rare',
    });
  });

  it('treasureById finds chinampa Area 4 ids', () => {
    expect(treasureById('chinampa/scarecrow')).toMatchObject({ name: 'Scarecrow', category: 'decoration', rarity: 'rare' });
    expect(treasureById('chinampa/paint-shell-poppy-red')).toMatchObject({ dreamColour: 'poppy-red', rarity: 'rare' });
  });

  it('treasureById finds chinampa Area 5 ids', () => {
    expect(treasureById('chinampa/pinata')).toMatchObject({ name: 'Piñata', category: 'decoration', rarity: 'rare' });
    expect(treasureById('chinampa/paint-shell-plum')).toMatchObject({
      name: 'Plum Paint shell',
      dreamColour: 'plum',
      rarity: 'rare',
    });
  });

  it('treasureById finds spring cave Area 6 ids', () => {
    expect(treasureById('spring-cave/fossil-ammonite')).toMatchObject({ name: 'Fossil ammonite', category: 'decoration', rarity: 'rare' });
    expect(treasureById('spring-cave/paint-shell-moonstone')).toMatchObject({
      name: 'Moonstone Paint shell',
      dreamColour: 'moonstone',
      rarity: 'rare',
    });
    expect(treasureSlug('spring-cave/miners-headlamp')).toBe('miners-headlamp');
  });

  it('treasureSlug returns the text after the first slash', () => {
    expect(treasureSlug('canal/sun-hat')).toBe('sun-hat');
    expect(treasureSlug('canal/paint-shell-tie-dye')).toBe('paint-shell-tie-dye');
    expect(treasureSlug('a/b/c')).toBe('b/c');
  });

  it('categoryName gives display names', () => {
    expect(categoryName('decoration')).toBe('Decoration');
    expect(categoryName('wearable')).toBe('Wearable');
    expect(categoryName('paintShell')).toBe('Paint shell');
  });

  it('dreamColourById finds a known id and returns undefined for an unknown one', () => {
    expect(dreamColourById('galaxy')).toEqual({ id: 'galaxy', name: 'Galaxy', rarity: 'legendary', kind: 'patterned' });
    expect(dreamColourById('plaid')).toBeUndefined();
  });
});

describe('Decoration placement kinds', () => {
  it('floats the Lily pad and Lotus lantern and stands the other pond Decorations on the floor', () => {
    const kinds = POND_TREASURES.filter(isDecoration).map((decoration) => [decoration.id, placementKind(decoration)]);
    expect(kinds).toEqual([
      ['pond/lily-pad', 'floating'],
      ['pond/cattail-clump', 'floor'],
      ['pond/frog-statue', 'floor'],
      ['pond/lotus-lantern', 'floating'],
    ]);
    for (const decoration of POND_TREASURES.filter(isDecoration)) {
      expect(decoration.width, decoration.id).toBeUndefined();
    }
  });

  it('places the pond Area 3 Decorations and gives only the string lights a wide footprint (issue #98)', () => {
    const kinds = POND_2_TREASURES.filter(isDecoration).map((decoration) => [
      decoration.id,
      placementKind(decoration),
      decoration.width,
    ]);
    expect(kinds).toEqual([
      ['pond/reed-bundle', 'floor', undefined],
      ['pond/drifting-feather', 'floating', undefined],
      ['pond/wooden-duck-decoy', 'floating', undefined],
      ['pond/firefly-string-lights', 'hanging', 144],
      ['pond/firefly-jar', 'hanging', undefined],
      ['pond/golden-lotus-throne', 'floor', undefined],
    ]);
  });

  it('places the chinampa Area 4 Decorations and gives only the Papel picado banner a wide footprint (issue #76)', () => {
    const kinds = CHINAMPA_TREASURES.filter(isDecoration).map((decoration) => [
      decoration.id,
      placementKind(decoration),
      decoration.width,
    ]);
    expect(kinds).toEqual([
      ['chinampa/clay-flowerpot', 'floor', undefined],
      ['chinampa/corn-husk-doll', 'floor', undefined],
      ['chinampa/scarecrow', 'floor', undefined],
      ['chinampa/papel-picado-banner', 'hanging', 144],
      ['chinampa/willow-swing', 'hanging', undefined],
      ['chinampa/golden-corn', 'floor', undefined],
    ]);
  });

  it('places the chinampa Area 5 Decorations, every one with the standard width (issue #103)', () => {
    const kinds = CHINAMPA_2_TREASURES.filter(isDecoration).map((decoration) => [
      decoration.id,
      placementKind(decoration),
      decoration.width,
    ]);
    expect(kinds).toEqual([
      ['chinampa/watering-can', 'floor', undefined],
      ['chinampa/floating-gourd', 'floating', undefined],
      ['chinampa/pinata', 'hanging', undefined],
      ['chinampa/talavera-fountain', 'floor', undefined],
      ['chinampa/alebrije-statue', 'floor', undefined],
    ]);
  });

  it('places the spring cave Area 6 Decorations, every one with the standard width (issue #77)', () => {
    const kinds = SPRING_CAVE_TREASURES.filter(isDecoration).map((decoration) => [
      decoration.id,
      placementKind(decoration),
      decoration.width,
    ]);
    expect(kinds).toEqual([
      ['spring-cave/pebble-stack', 'floor', undefined],
      ['spring-cave/glow-moss-ball', 'floating', undefined],
      ['spring-cave/fossil-ammonite', 'floor', undefined],
      ['spring-cave/crystal-wind-chime', 'hanging', undefined],
      ['spring-cave/geode-lamp', 'floor', undefined],
      ['spring-cave/crystal-arch', 'floor', undefined],
    ]);
  });

  it('makes every canal Decoration a Floor item with the standard width (issue #95)', () => {
    expect(DECORATIONS.map((decoration) => decoration.name)).toEqual([
      'Pond plant',
      'Toy boat',
      'Castle tower',
      'Sun pyramid',
    ]);
    for (const decoration of CANAL_TREASURES.filter(isDecoration)) {
      expect(decoration.placement).toBeUndefined();
      expect(decoration.width).toBeUndefined();
      expect(placementKind(decoration)).toBe('floor');
    }
  });

  it('placementKind returns the given kind and reads an absent one as floor', () => {
    const base: Decoration = { id: 'test/item', name: 'Item', rarity: 'common', category: 'decoration' };
    expect(placementKind(base)).toBe('floor');
    expect(placementKind({ ...base, placement: 'floor' })).toBe('floor');
    expect(placementKind({ ...base, placement: 'floating' })).toBe('floating');
    const wide: Decoration = { ...base, placement: 'hanging', width: 144 };
    expect(placementKind(wide)).toBe('hanging');
  });

  it('isDecoration picks only Decorations', () => {
    expect(CANAL_TREASURES.filter(isDecoration)).toEqual(DECORATIONS);
    expect(WEARABLES.some(isDecoration)).toBe(false);
    expect(PAINT_SHELLS.some(isDecoration)).toBe(false);
  });
});

describe('ownedDreamColours', () => {
  it('returns nothing for no banked ids', () => {
    expect(ownedDreamColours([])).toEqual([]);
  });

  it('de-duplicates, ignores non-shell and unknown ids, and keeps DREAM_COLOURS order', () => {
    const banked = [
      'canal/paint-shell-galaxy',
      'canal/sun-hat',
      'canal/paint-shell-mint',
      'canal/unknown',
      'canal/paint-shell-galaxy',
      'canal/pond-plant',
      'canal/paint-shell-plaid',
      'canal/paint-shell-hearts',
    ];
    expect(ownedDreamColours(banked)).toEqual(['mint', 'hearts', 'galaxy']);
  });

  it('owns Lily green from the pond Paint shell, after the canal colours', () => {
    const banked = ['pond/paint-shell-lily-green', 'pond/raincoat', 'canal/paint-shell-mint', 'canal/paint-shell-lily-green'];
    expect(ownedDreamColours(banked)).toEqual(['mint', 'lily-green']);
  });

  it('owns Firefly gold from the pond Area 3 Paint shell, after Lily green', () => {
    const banked = ['pond/paint-shell-firefly-gold', 'pond/paint-shell-lily-green', 'pond/firefly-cape'];
    expect(ownedDreamColours(banked)).toEqual(['lily-green', 'firefly-gold']);
  });

  it('owns Poppy red from the chinampa Area 4 Paint shell, after Firefly gold', () => {
    const banked = ['chinampa/paint-shell-poppy-red', 'chinampa/scarecrow', 'pond/paint-shell-firefly-gold'];
    expect(ownedDreamColours(banked)).toEqual(['firefly-gold', 'poppy-red']);
  });

  it('owns Plum from the chinampa Area 5 Paint shell, after Poppy red', () => {
    const banked = ['chinampa/paint-shell-plum', 'chinampa/pinata', 'chinampa/paint-shell-poppy-red'];
    expect(ownedDreamColours(banked)).toEqual(['poppy-red', 'plum']);
  });

  it('owns Moonstone from the spring cave Area 6 Paint shell, after Plum', () => {
    const banked = ['spring-cave/paint-shell-moonstone', 'spring-cave/crystal-crown', 'chinampa/paint-shell-plum'];
    expect(ownedDreamColours(banked)).toEqual(['plum', 'moonstone']);
  });

  it('owns Jade and Fiesta shine from the deep canal Area 8 Paint shells, after Glowworm', () => {
    const banked = [
      'deep-canal/paint-shell-fiesta-shine',
      'deep-canal/little-trajinera',
      'deep-canal/paint-shell-jade',
      'spring-cave/paint-shell-glowworm',
    ];
    expect(ownedDreamColours(banked)).toEqual(['glowworm', 'jade', 'fiesta-shine']);
  });

  it('owns Olive and Lantern shine from the deep canal Area 9 Paint shells, after Fiesta shine', () => {
    const banked = [
      'deep-canal/paint-shell-lantern-shine',
      'deep-canal/little-bailing-bucket',
      'deep-canal/paint-shell-olive',
      'deep-canal/paint-shell-fiesta-shine',
    ];
    expect(ownedDreamColours(banked)).toEqual(['fiesta-shine', 'olive', 'lantern-shine']);
  });

  it('owns Peach and Confetti shine from the deep canal Area 10 Paint shells, after Lantern shine', () => {
    const banked = [
      'deep-canal/paint-shell-confetti-shine',
      'deep-canal/axolotl-statue',
      'deep-canal/paint-shell-peach',
      'deep-canal/paint-shell-lantern-shine',
    ];
    expect(ownedDreamColours(banked)).toEqual(['lantern-shine', 'peach', 'confetti-shine']);
  });

  it('owns Marigold and Golden shine from the deep canal Area 11 Paint shells, after Confetti shine', () => {
    const banked = [
      'deep-canal/paint-shell-golden-hour-shine',
      'deep-canal/paint-shell-marigold',
      'deep-canal/axolotl-statue',
      'deep-canal/paint-shell-confetti-shine',
    ];
    expect(ownedDreamColours(banked)).toEqual(['confetti-shine', 'marigold', 'golden-hour-shine']);
  });

  it('owns Lime, Hyacinth and Lagoon shine from the newer deep canal Area 11 Paint shells, after Golden shine', () => {
    const banked = [
      'deep-canal/paint-shell-lagoon-shine',
      'deep-canal/paint-shell-hyacinth',
      'deep-canal/carousel',
      'deep-canal/paint-shell-lime',
      'deep-canal/paint-shell-golden-hour-shine',
    ];
    expect(ownedDreamColours(banked)).toEqual(['golden-hour-shine', 'lime', 'hyacinth', 'lagoon-shine']);
  });

  it('owns Tule green and Obsidian from the open lake Area 12 Paint shells, after Lagoon shine (issue #214, ND-3)', () => {
    const banked = [
      'open-lake/paint-shell-obsidian',
      'open-lake/little-pelican',
      'open-lake/paint-shell-tule-green',
      'deep-canal/paint-shell-lagoon-shine',
    ];
    expect(ownedDreamColours(banked)).toEqual(['lagoon-shine', 'tule-green', 'obsidian']);
  });
});
