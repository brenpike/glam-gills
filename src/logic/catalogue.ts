/**
 * The treasure catalogue: rarities, categories, wearable slots, perks, Dream colours and the
 * treasures of every area: the canal, the pond, the pond's Area 3 and the chinampa gardens' Areas 4 and 5 (PRD B1 to B3,
 * F9).
 * Pure data plus lookups; nothing here applies perks.
 */

/** Treasure rarity, from most to least common. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Every rarity in rarity order. */
export const RARITIES: readonly Rarity[] = Object.freeze(['common', 'rare', 'epic', 'legendary']);

/** Treasure category. */
export type TreasureCategory = 'decoration' | 'wearable' | 'paintShell';

/** Every category in display order. */
export const TREASURE_CATEGORIES: readonly TreasureCategory[] = Object.freeze([
  'decoration',
  'wearable',
  'paintShell',
]);

/** Wearable slot on an axolotl; one item per slot. */
export type WearableSlot =
  | 'head'
  | 'neck'
  | 'face'
  | 'shirt'
  | 'back'
  | 'tail'
  | 'socks'
  | 'feet';

/** Every wearable slot in display order. */
export const WEARABLE_SLOTS: readonly WearableSlot[] = Object.freeze([
  'head',
  'neck',
  'face',
  'shirt',
  'back',
  'tail',
  'socks',
  'feet',
]);

/** Perk type a Wearable can give. */
export type PerkType = 'speed' | 'regrowth' | 'dash' | 'shell' | 'treasureSense' | 'snackMagnet';

/**
 * One Wearable perk. `value` units: speed, regrowth, dash and treasureSense are percent;
 * snackMagnet is px of pull radius; shell is hits blocked per trip.
 */
export interface Perk {
  readonly type: PerkType;
  readonly value: number;
}

/**
 * Perk value per type and rarity, from the PRD Tuning values. Shell has no Common or Rare value
 * because Shell perks appear only on Epic and Legendary Wearables (F9).
 */
export const PERK_VALUES: Readonly<Record<PerkType, Readonly<Partial<Record<Rarity, number>>>>> =
  Object.freeze({
    speed: Object.freeze({ common: 4, rare: 6, epic: 8, legendary: 10 }),
    regrowth: Object.freeze({ common: 10, rare: 15, epic: 20, legendary: 25 }),
    dash: Object.freeze({ common: 10, rare: 15, epic: 20, legendary: 25 }),
    treasureSense: Object.freeze({ common: 15, rare: 25, epic: 35, legendary: 50 }),
    snackMagnet: Object.freeze({ common: 30, rare: 40, epic: 50, legendary: 60 }),
    shell: Object.freeze({ epic: 1, legendary: 1 }),
  });

/** Stable id of one Dream colour. */
export type DreamColourId =
  | 'mint'
  | 'sky-blue'
  | 'lavender'
  | 'sunset-orange'
  | 'bubblegum'
  | 'midnight-blue'
  | 'hearts'
  | 'tie-dye'
  | 'iridescent'
  | 'rainbow'
  | 'galaxy'
  | 'tie-dye-galaxy'
  | 'lily-green'
  | 'firefly-gold'
  | 'poppy-red'
  | 'plum'
  | 'moonstone'
  | 'crystal-shine'
  | 'chocolate'
  | 'glowworm';

/** How a Dream colour is drawn. */
export type DreamKind = 'solid' | 'patterned' | 'sheen';

/** One Dream colour, held by exactly one Paint shell. */
export interface DreamColour {
  readonly id: DreamColourId;
  readonly name: string;
  readonly rarity: Rarity;
  readonly kind: DreamKind;
}

/** The 9 canal Dream colours with the PRD B3 rarities, in the canal Paint shell order. */
export const CANAL_DREAM_COLOURS: readonly DreamColour[] = Object.freeze([
  { id: 'mint', name: 'Mint', rarity: 'common', kind: 'solid' },
  { id: 'sky-blue', name: 'Sky blue', rarity: 'common', kind: 'solid' },
  { id: 'lavender', name: 'Lavender', rarity: 'common', kind: 'solid' },
  { id: 'sunset-orange', name: 'Sunset orange', rarity: 'rare', kind: 'solid' },
  { id: 'bubblegum', name: 'Bubblegum', rarity: 'rare', kind: 'solid' },
  { id: 'midnight-blue', name: 'Midnight blue', rarity: 'rare', kind: 'solid' },
  { id: 'hearts', name: 'Hearts', rarity: 'epic', kind: 'patterned' },
  { id: 'tie-dye', name: 'Tie-dye', rarity: 'epic', kind: 'patterned' },
  { id: 'iridescent', name: 'Iridescent', rarity: 'epic', kind: 'sheen' },
]);

/** Area 3's Legendary Dream colour, held by its second Paint shell; once a canal colour (issue #146). */
export const GALAXY: DreamColour = Object.freeze({
  id: 'galaxy',
  name: 'Galaxy',
  rarity: 'legendary',
  kind: 'patterned',
});

/** Area 4's Legendary Dream colour, held by its second Paint shell; once a canal colour (issue #146). */
export const RAINBOW: DreamColour = Object.freeze({
  id: 'rainbow',
  name: 'Rainbow',
  rarity: 'legendary',
  kind: 'patterned',
});

/** Area 5's Legendary Dream colour, held by its second Paint shell; once a canal colour (issue #146). */
export const TIE_DYE_GALAXY: DreamColour = Object.freeze({
  id: 'tie-dye-galaxy',
  name: 'Tie-dye galaxy',
  rarity: 'legendary',
  kind: 'patterned',
});

/** The pond's Dream colour, held by the pond's one Paint shell. */
export const LILY_GREEN: DreamColour = Object.freeze({
  id: 'lily-green',
  name: 'Lily green',
  rarity: 'rare',
  kind: 'solid',
});

/** The pond Area 3 Dream colour, held by that area's one Paint shell. */
export const FIREFLY_GOLD: DreamColour = Object.freeze({
  id: 'firefly-gold',
  name: 'Firefly gold',
  rarity: 'rare',
  kind: 'solid',
});

/** The chinampa gardens' Area 4 Dream colour, held by that area's one Paint shell. */
export const POPPY_RED: DreamColour = Object.freeze({
  id: 'poppy-red',
  name: 'Poppy red',
  rarity: 'rare',
  kind: 'solid',
});

/** The chinampa gardens' Area 5 Dream colour, held by that area's one Paint shell. */
export const PLUM: DreamColour = Object.freeze({
  id: 'plum',
  name: 'Plum',
  rarity: 'rare',
  kind: 'solid',
});

/** The spring cave's Area 6 Dream colour, a pale silvery white held by that area's one Paint shell (issue #77). */
export const MOONSTONE: DreamColour = Object.freeze({
  id: 'moonstone',
  name: 'Moonstone',
  rarity: 'rare',
  kind: 'solid',
});

/** The spring cave's Area 6 Legendary Dream colour, a crystal sheen held by that area's second Paint shell. */
export const CRYSTAL_SHINE: DreamColour = Object.freeze({
  id: 'crystal-shine',
  name: 'Crystal shine',
  rarity: 'legendary',
  kind: 'sheen',
});

/** The spring cave's Area 7 Dream colour, a solid brown held by that area's first Paint shell (issue #105). */
export const CHOCOLATE: DreamColour = Object.freeze({
  id: 'chocolate',
  name: 'Chocolate',
  rarity: 'rare',
  kind: 'solid',
});

/** The spring cave's Area 7 Legendary Dream colour, a glowworm pattern held by that area's second Paint shell. */
export const GLOWWORM: DreamColour = Object.freeze({
  id: 'glowworm',
  name: 'Glowworm',
  rarity: 'legendary',
  kind: 'patterned',
});

/**
 * Every Dream colour in area order: the canal's 9, then Lily green (Area 2), Firefly gold and Galaxy
 * (Area 3), Poppy red and Rainbow (Area 4), Plum and Tie-dye galaxy (Area 5), Moonstone and Crystal
 * shine (Area 6), then Chocolate and Glowworm (Area 7).
 */
export const DREAM_COLOURS: readonly DreamColour[] = Object.freeze([
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
]);

/** Fields every treasure has. `id` is stable forever, e.g. 'canal/sun-hat'. */
export interface TreasureBase {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
}

/**
 * Where a Decoration goes in the Home Tank: 'floor' stands on the gravel, 'floating' rests on the
 * water surface and 'hanging' hangs from the glass top. Floating and Hanging move left and right only.
 */
export type PlacementKind = 'floor' | 'floating' | 'hanging';

/**
 * A Home Tank item. `placement` absent means Floor. `width` is the footprint width in tank units;
 * absent means the standard square footprint (the tank rules resolve it).
 */
export interface Decoration extends TreasureBase {
  readonly category: 'decoration';
  readonly placement?: PlacementKind;
  readonly width?: number;
}

/** An outfit item for one slot, with exactly one perk and an optional set (Implementation Decision 12). */
export interface Wearable extends TreasureBase {
  readonly category: 'wearable';
  readonly slot: WearableSlot;
  readonly perk: Perk;
  readonly setId?: string;
}

/** A shell holding one Dream colour; banking it makes the colour owned. */
export interface PaintShell extends TreasureBase {
  readonly category: 'paintShell';
  readonly dreamColour: DreamColourId;
}

/** Any treasure. */
export type Treasure = Decoration | Wearable | PaintShell;

/** The Paint shell holding `colour`, with an id under the area `prefix`, e.g. 'canal'. */
function createPaintShell(colour: DreamColour, prefix: string): PaintShell {
  return {
    id: `${prefix}/paint-shell-${colour.id}`,
    name: `${colour.name} Paint shell`,
    rarity: colour.rarity,
    category: 'paintShell',
    dreamColour: colour.id,
  };
}

/** The perk of `type` at its PERK_VALUES value for `rarity`; throws when that rarity has no value for the type. */
function createPerk(type: PerkType, rarity: Rarity): Perk {
  const value = PERK_VALUES[type][rarity];
  if (value === undefined) {
    throw new Error(`No ${type} perk value at ${rarity} rarity`);
  }
  return { type, value };
}

/**
 * The canal treasures: 4 Decorations and 3 Wearables, then one Paint shell per canal Dream colour,
 * then 4 more Wearables. The newest entries come last so placement by seed stays the same for every
 * earlier treasure. The Sun pyramid is the canal's one Legendary (issue #146).
 */
export const CANAL_TREASURES: readonly Treasure[] = Object.freeze([
  { id: 'canal/pond-plant', name: 'Pond plant', rarity: 'common', category: 'decoration' },
  { id: 'canal/toy-boat', name: 'Toy boat', rarity: 'rare', category: 'decoration' },
  { id: 'canal/castle-tower', name: 'Castle tower', rarity: 'epic', category: 'decoration' },
  { id: 'canal/sun-pyramid', name: 'Sun pyramid', rarity: 'legendary', category: 'decoration' },
  {
    id: 'canal/sun-hat',
    name: 'Sun hat',
    rarity: 'common',
    category: 'wearable',
    slot: 'head',
    perk: { type: 'speed', value: 4 },
  },
  {
    id: 'canal/shell-necklace',
    name: 'Shell necklace',
    rarity: 'rare',
    category: 'wearable',
    slot: 'neck',
    perk: { type: 'regrowth', value: 15 },
  },
  {
    id: 'canal/heart-glasses',
    name: 'Heart glasses',
    rarity: 'epic',
    category: 'wearable',
    slot: 'face',
    perk: { type: 'treasureSense', value: 35 },
  },
  ...CANAL_DREAM_COLOURS.map((colour) => createPaintShell(colour, 'canal')),
  {
    id: 'canal/tank-top',
    name: 'Tank top',
    rarity: 'common',
    category: 'wearable',
    slot: 'shirt',
    perk: { type: 'regrowth', value: 10 },
  },
  {
    id: 'canal/diving-tank',
    name: 'Diving tank',
    rarity: 'rare',
    category: 'wearable',
    slot: 'back',
    perk: { type: 'dash', value: 15 },
  },
  {
    id: 'canal/stripy-socks',
    name: 'Stripy socks',
    rarity: 'common',
    category: 'wearable',
    slot: 'socks',
    perk: { type: 'snackMagnet', value: 30 },
  },
  {
    id: 'canal/flippers',
    name: 'Flippers',
    rarity: 'rare',
    category: 'wearable',
    slot: 'feet',
    perk: { type: 'speed', value: 6 },
  },
]);

/**
 * The pond treasures: 4 Decorations, 7 Wearables, the Lily green Paint shell, then the Golden bow
 * (issue #146). Every perk is the PERK_VALUES value for its type and rarity.
 */
export const POND_TREASURES: readonly Treasure[] = Object.freeze([
  {
    id: 'pond/lily-pad',
    name: 'Lily pad',
    rarity: 'common',
    category: 'decoration',
    placement: 'floating',
  },
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
  createPaintShell(LILY_GREEN, 'pond'),
  // Moved from the canal by issue #146; the id keeps its 'canal/' prefix so saves stay valid (ADR 0012).
  {
    id: 'canal/golden-bow',
    name: 'Golden bow',
    rarity: 'legendary',
    category: 'wearable',
    slot: 'tail',
    perk: { type: 'shell', value: 1 },
  },
]);

/**
 * The pond Area 3 treasures, with 'pond/' ids: 6 Decorations, 5 Wearables, the Firefly gold
 * Paint shell, then the Galaxy Paint shell, whose 'canal/' id predates its move here (issue #146). The Wooden duck decoy is the area's special treasure. Every perk is the PERK_VALUES
 * value for its type and rarity.
 */
export const POND_2_TREASURES: readonly Treasure[] = Object.freeze([
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
  {
    id: 'pond/firefly-jar',
    name: 'Firefly jar',
    rarity: 'epic',
    category: 'decoration',
    placement: 'hanging',
  },
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
  createPaintShell(FIREFLY_GOLD, 'pond'),
  // Moved from the canal by issue #146; the id keeps its 'canal/' prefix so saves stay valid (ADR 0012).
  createPaintShell(GALAXY, 'canal'),
]);

/**
 * The chinampa gardens' Area 4 treasures, with 'chinampa/' ids, by rarity: 6 Decorations, 5 Wearables
 * and the Poppy red Paint shell, then the Rainbow Paint shell, whose 'canal/' id predates its move
 * here (issue #146). The Scarecrow is the area's special treasure. Every perk is the
 * PERK_VALUES value for its type and rarity.
 */
export const CHINAMPA_TREASURES: readonly Treasure[] = Object.freeze([
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
  createPaintShell(POPPY_RED, 'chinampa'),
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
  // Moved from the canal by issue #146; the id keeps its 'canal/' prefix so saves stay valid (ADR 0012).
  createPaintShell(RAINBOW, 'canal'),
]);

/**
 * The chinampa gardens' Area 5 treasures, with 'chinampa/' ids, by rarity: 5 Decorations, 6 Wearables
 * and the Plum Paint shell, then the Tie-dye galaxy Paint shell, whose 'canal/' id predates its move
 * here (issue #146). The Piñata is the area's special treasure. Every perk comes from
 * PERK_VALUES for its type and rarity.
 */
export const CHINAMPA_2_TREASURES: readonly Treasure[] = Object.freeze([
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
    perk: createPerk('snackMagnet', 'common'),
  },
  {
    id: 'chinampa/bandana',
    name: 'Bandana',
    rarity: 'common',
    category: 'wearable',
    slot: 'neck',
    perk: createPerk('speed', 'common'),
  },
  {
    id: 'chinampa/pinata',
    name: 'Piñata',
    rarity: 'rare',
    category: 'decoration',
    placement: 'hanging',
  },
  {
    id: 'chinampa/sunflower-sunglasses',
    name: 'Sunflower sunglasses',
    rarity: 'rare',
    category: 'wearable',
    slot: 'face',
    perk: createPerk('treasureSense', 'rare'),
  },
  {
    id: 'chinampa/embroidered-shirt',
    name: 'Embroidered shirt',
    rarity: 'rare',
    category: 'wearable',
    slot: 'shirt',
    perk: createPerk('regrowth', 'rare'),
  },
  createPaintShell(PLUM, 'chinampa'),
  { id: 'chinampa/talavera-fountain', name: 'Talavera fountain', rarity: 'epic', category: 'decoration' },
  {
    id: 'chinampa/hummingbird-tail-ribbon',
    name: 'Hummingbird tail ribbon',
    rarity: 'epic',
    category: 'wearable',
    slot: 'tail',
    perk: createPerk('speed', 'epic'),
  },
  { id: 'chinampa/alebrije-statue', name: 'Alebrije statue', rarity: 'legendary', category: 'decoration' },
  {
    id: 'chinampa/rainbow-serape-cape',
    name: 'Rainbow serape cape',
    rarity: 'legendary',
    category: 'wearable',
    slot: 'back',
    perk: createPerk('shell', 'legendary'),
  },
  // Moved from the canal by issue #146; the id keeps its 'canal/' prefix so saves stay valid (ADR 0012).
  createPaintShell(TIE_DYE_GALAXY, 'canal'),
]);

/**
 * The spring cave Area 6 treasures, all new (issue #77): 6 Decorations, 5 Wearables and the
 * Moonstone Paint shell in rarity order, then the Crystal shine Paint shell. The Fossil ammonite is
 * the area's special treasure. Every perk comes from PERK_VALUES for its type and rarity, and no two
 * Wearables share a perk type. The newest entry comes last so placement by seed stays the same for
 * every earlier treasure.
 */
export const SPRING_CAVE_TREASURES: readonly Treasure[] = Object.freeze([
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
    perk: createPerk('treasureSense', 'common'),
  },
  {
    id: 'spring-cave/crystal-pendant',
    name: 'Crystal pendant',
    rarity: 'common',
    category: 'wearable',
    slot: 'neck',
    perk: createPerk('regrowth', 'common'),
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
    perk: createPerk('dash', 'rare'),
  },
  createPaintShell(MOONSTONE, 'spring-cave'),
  { id: 'spring-cave/geode-lamp', name: 'Geode lamp', rarity: 'epic', category: 'decoration' },
  {
    id: 'spring-cave/crystal-tail-cuff',
    name: 'Crystal tail cuff',
    rarity: 'epic',
    category: 'wearable',
    slot: 'tail',
    perk: createPerk('snackMagnet', 'epic'),
  },
  { id: 'spring-cave/crystal-arch', name: 'Crystal arch', rarity: 'legendary', category: 'decoration' },
  {
    id: 'spring-cave/crystal-crown',
    name: 'Crystal crown',
    rarity: 'legendary',
    category: 'wearable',
    slot: 'head',
    perk: createPerk('speed', 'legendary'),
  },
  createPaintShell(CRYSTAL_SHINE, 'spring-cave'),
]);

/**
 * The spring cave Area 7 treasures, all new (issue #105): the owner's 12 in rarity order, 6
 * Decorations, 5 Wearables and the Chocolate Paint shell, then the Glowworm Paint shell. The Ancient
 * clay pot is the area's special treasure. Every perk comes from PERK_VALUES for its type and rarity,
 * and no two Wearables share a perk type (ND-13). The newest entry comes last so placement by seed
 * stays the same for every earlier treasure.
 */
export const SPRING_CAVE_2_TREASURES: readonly Treasure[] = Object.freeze([
  { id: 'spring-cave/mossy-rock', name: 'Mossy rock', rarity: 'common', category: 'decoration' },
  { id: 'spring-cave/bubble-stone', name: 'Bubble stone', rarity: 'common', category: 'decoration' },
  {
    id: 'spring-cave/climbing-helmet',
    name: 'Climbing helmet',
    rarity: 'common',
    category: 'wearable',
    slot: 'head',
    perk: createPerk('dash', 'common'),
  },
  {
    id: 'spring-cave/pebble-necklace',
    name: 'Pebble necklace',
    rarity: 'common',
    category: 'wearable',
    slot: 'neck',
    perk: createPerk('regrowth', 'common'),
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
    perk: createPerk('treasureSense', 'rare'),
  },
  createPaintShell(CHOCOLATE, 'spring-cave'),
  { id: 'spring-cave/bubble-machine', name: 'Bubble machine', rarity: 'epic', category: 'decoration' },
  {
    id: 'spring-cave/glow-tail-lantern',
    name: 'Glow tail lantern',
    rarity: 'epic',
    category: 'wearable',
    slot: 'tail',
    perk: createPerk('snackMagnet', 'epic'),
  },
  { id: 'spring-cave/underground-waterfall', name: 'Underground waterfall', rarity: 'legendary', category: 'decoration' },
  {
    id: 'spring-cave/gemstone-cape',
    name: 'Gemstone cape',
    rarity: 'legendary',
    category: 'wearable',
    slot: 'back',
    perk: createPerk('shell', 'legendary'),
  },
  createPaintShell(GLOWWORM, 'spring-cave'),
]);

/**
 * Every treasure of every area: the canal's, then the pond's, then the pond Area 3's, then the
 * chinampa gardens' Area 4's, then the chinampa gardens' Area 5's, then the spring cave Area 6's,
 * then the spring cave Area 7's.
 */
export const ALL_TREASURES: readonly Treasure[] = Object.freeze([
  ...CANAL_TREASURES,
  ...POND_TREASURES,
  ...POND_2_TREASURES,
  ...CHINAMPA_TREASURES,
  ...CHINAMPA_2_TREASURES,
  ...SPRING_CAVE_TREASURES,
  ...SPRING_CAVE_2_TREASURES,
]);

const CATEGORY_NAMES: Readonly<Record<TreasureCategory, 'Decoration' | 'Wearable' | 'Paint shell'>> =
  Object.freeze({ decoration: 'Decoration', wearable: 'Wearable', paintShell: 'Paint shell' });

/** The treasure of any area with this id, or undefined when no treasure has it. */
export function treasureById(id: string): Treasure | undefined {
  return ALL_TREASURES.find((treasure) => treasure.id === id);
}

/**
 * The id text after the first '/', e.g. 'canal/sun-hat' gives 'sun-hat' and 'pond/raincoat' gives
 * 'raincoat'. Art texture keys use it, so slugs are unique across every area.
 */
export function treasureSlug(id: string): string {
  return id.slice(id.indexOf('/') + 1);
}

/** True when the treasure is a Decoration. */
export function isDecoration(treasure: Treasure): treasure is Decoration {
  return treasure.category === 'decoration';
}

/** The placement kind of a Decoration; an absent `placement` means 'floor'. */
export function placementKind(decoration: Pick<Decoration, 'placement'>): PlacementKind {
  return decoration.placement ?? 'floor';
}

/** Display name of a category. */
export function categoryName(category: TreasureCategory): 'Decoration' | 'Wearable' | 'Paint shell' {
  return CATEGORY_NAMES[category];
}

/** The Dream colour with this id, or undefined when none has it. */
export function dreamColourById(id: string): DreamColour | undefined {
  return DREAM_COLOURS.find((colour) => colour.id === id);
}

/** The patterned and sheen Dream colours that stay Epic; every other patterned or sheen colour is Legendary. */
export const GRANDFATHERED_EPIC_DREAM_IDS: readonly DreamColourId[] = Object.freeze(['hearts', 'tie-dye', 'iridescent']);

/**
 * PRD B3 rule: solid is Common or Rare only; patterned and sheen are Legendary only, except the
 * grandfathered colours in GRANDFATHERED_EPIC_DREAM_IDS, which are Epic only.
 */
export function dreamRarityAllowed(colour: Pick<DreamColour, 'id' | 'kind' | 'rarity'>): boolean {
  if (colour.kind === 'solid') {
    return colour.rarity === 'common' || colour.rarity === 'rare';
  }
  const allowedRarity: Rarity = GRANDFATHERED_EPIC_DREAM_IDS.includes(colour.id) ? 'epic' : 'legendary';
  return colour.rarity === allowedRarity;
}

/**
 * Dream colours owned through banked Paint shells of any area, de-duplicated, in DREAM_COLOURS
 * order. Ids that are unknown or not Paint shells are ignored.
 */
export function ownedDreamColours(banked: readonly string[]): DreamColourId[] {
  const owned = new Set<DreamColourId>();
  for (const id of banked) {
    const treasure = treasureById(id);
    if (treasure?.category === 'paintShell') {
      owned.add(treasure.dreamColour);
    }
  }
  return DREAM_COLOURS.filter((colour) => owned.has(colour.id)).map((colour) => colour.id);
}
