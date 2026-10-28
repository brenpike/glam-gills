import { describe, expect, it } from 'vitest';
import {
  ALL_TREASURES,
  CANAL_DREAM_COLOURS,
  CANAL_TREASURES,
  CHINAMPA_2_TREASURES,
  CHINAMPA_TREASURES,
  DREAM_COLOURS,
  FIREFLY_GOLD,
  GALAXY,
  LILY_GREEN,
  MOONSTONE,
  PERK_VALUES,
  PLUM,
  POND_2_TREASURES,
  POND_TREASURES,
  POPPY_RED,
  RAINBOW,
  RARITIES,
  SPRING_CAVE_TREASURES,
  TIE_DYE_GALAXY,
  TREASURE_CATEGORIES,
  WEARABLE_SLOTS,
  categoryName,
  dreamColourById,
  dreamKindAllowed,
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
  it('holds exactly the spring cave Area 6 treasures, in rarity order (issue #77)', () => {
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

  it('has 6 Decorations, 5 Wearables and the Moonstone Paint shell, in rarity order', () => {
    expect(SPRING_CAVE_TREASURES).toHaveLength(12);
    expect(SPRING_CAVE_TREASURES.filter(isDecoration)).toHaveLength(6);
    expect(SPRING_CAVE_TREASURES.filter(isWearable)).toHaveLength(5);
    expect(SPRING_CAVE_TREASURES.filter(isPaintShell).map((shell) => shell.id)).toEqual(['spring-cave/paint-shell-moonstone']);
    const rarityIndexes = SPRING_CAVE_TREASURES.map((treasure) => RARITIES.indexOf(treasure.rarity));
    expect(rarityIndexes).toEqual([...rarityIndexes].sort((left, right) => left - right));
    expect(RARITIES.map((rarity) => SPRING_CAVE_TREASURES.filter((treasure) => treasure.rarity === rarity).length)).toEqual([4, 4, 2, 2]);
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

describe('ALL_TREASURES', () => {
  it('is the canal, pond, pond Area 3, chinampa Area 4, chinampa Area 5 and spring cave Area 6 treasures, in that order', () => {
    expect(ALL_TREASURES).toEqual([
      ...CANAL_TREASURES,
      ...POND_TREASURES,
      ...POND_2_TREASURES,
      ...CHINAMPA_TREASURES,
      ...CHINAMPA_2_TREASURES,
      ...SPRING_CAVE_TREASURES,
    ]);
    expect(Object.isFrozen(ALL_TREASURES)).toBe(true);
    expect(Object.isFrozen(POND_TREASURES)).toBe(true);
  });

  it('has 84 treasures: 31 Decorations, 36 Wearables and 17 Paint shells', () => {
    expect(ALL_TREASURES).toHaveLength(84);
    expect(ALL_DECORATIONS).toHaveLength(31);
    expect(ALL_WEARABLES).toHaveLength(36);
    expect(ALL_TREASURES.filter(isPaintShell)).toHaveLength(17);
  });

  it('puts Shell perks only on Epic or Legendary Wearables', () => {
    const shellWearables = ALL_WEARABLES.filter((wearable) => wearable.perk.type === 'shell');
    expect(shellWearables.map((wearable) => wearable.id)).toEqual([
      'pond/ladybug-backpack',
      'canal/golden-bow',
      'pond/pearl-tail-charm',
      'chinampa/rainbow-serape-cape',
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
      expect(id).toMatch(/^(canal|pond|chinampa|spring-cave)\/[a-z0-9-]+$/);
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
  it('lists the colours in area order: the canal 9, Lily green, Firefly gold, Galaxy, Poppy red, Rainbow, Plum, Tie-dye galaxy, Moonstone', () => {
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
    ]);
    expect(DREAM_COLOURS).toHaveLength(17);
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

  it('makes Moonstone a rare solid, the seventeenth and last Dream colour, with a name no other Dream colour has (issue #77)', () => {
    expect(MOONSTONE).toEqual({ id: 'moonstone', name: 'Moonstone', rarity: 'rare', kind: 'solid' });
    expect(Object.isFrozen(MOONSTONE)).toBe(true);
    expect(dreamColourById('moonstone')).toBe(MOONSTONE);
    expect(DREAM_COLOURS.at(-1)).toBe(MOONSTONE);
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

describe('dreamKindAllowed', () => {
  it('holds for every Dream colour and every Paint shell', () => {
    for (const colour of DREAM_COLOURS) {
      expect(dreamKindAllowed(colour.kind, colour.rarity)).toBe(true);
    }
    for (const shell of ALL_TREASURES.filter(isPaintShell)) {
      const colour = dreamColourById(shell.dreamColour);
      expect(colour).toBeDefined();
      expect(dreamKindAllowed(colour!.kind, shell.rarity)).toBe(true);
    }
  });

  it.each<[DreamKind, Rarity]>([
    ['patterned', 'common'],
    ['patterned', 'rare'],
    ['sheen', 'common'],
    ['sheen', 'rare'],
    ['solid', 'epic'],
    ['solid', 'legendary'],
  ])('rejects %s at %s', (kind, rarity) => {
    expect(dreamKindAllowed(kind, rarity)).toBe(false);
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
});
