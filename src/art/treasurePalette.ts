/**
 * Treasure, rarity badge and Paint shell colours (issue #11). Shared colours
 * are imported read-only from palette.ts; only genuinely new values live here.
 * Presentational only: no game state, no Phaser.
 *
 * Every value is derived (provisional) unless the comment says otherwise.
 *
 * Revealed treasure icons are cue objects (guide 10). Every fill on the outer
 * silhouette must reach 9:1 with ink #2b2350 (relative luminance 0.607 or
 * more), so ink or fill is 3:1 or better on any background. Ratios below are
 * fill against ink. Trims, gems and patterns inside the silhouette are free.
 */
import {
  EYE,
  FLOWER_PETAL,
  LILY_PAD_SHINE,
  PEBBLE_A,
  PEBBLE_C,
  PEBBLE_E,
  PEBBLE_SHINE,
  REED_LEAF,
  SUN,
  UI_PANEL_PINK,
  WATER_SHALLOW,
  WHITE,
} from './palette';

// ---- Rarity badge fills (guide 3e) ----------------------------------------

/** Badge shape strings; the same strings the logic uses. */
export type BadgeShape = 'circle' | 'diamond' | 'shield' | 'star';

/**
 * Rarity fill per badge shape (guide 3e). Ratios with ink: Common #1fb98d
 * 5.75:1 (relative luminance 0.369), Rare #5ab8ff 6.67:1, Epic #b07cff 4.92:1,
 * Legendary #ffc12e 8.86:1. Badges are UI on a panel, not cue objects, so 4.5:1
 * is enough.
 */
export const BADGE_FILL: Readonly<Record<BadgeShape, string>> = {
  circle: '#1fb98d',
  diamond: '#5ab8ff',
  shield: '#b07cff',
  star: '#ffc12e',
};

/** The one white shine on every badge and treasure (the pebble shine, 3a). */
export const TREASURE_SHINE = PEBBLE_SHINE;

/**
 * Peak alpha of the rarity glow behind a revealed treasure, as faint as the GFP
 * halo (guide 3b). The glow colour is the BADGE_FILL of the rarity's shape, so
 * one rarity has one colour.
 */
export const RARITY_GLOW_ALPHA = 0.35;

/** Flat fill of an unfound-treasure silhouette: pebble A #d4cfe6, 9.50:1 with ink. */
export const TREASURE_SILHOUETTE_FILL = PEBBLE_A;

// ---- Silhouette fills (all at least 9:1 with ink) -------------------------

/** Pond plant leaves, the reed leaf green. 9.25:1. */
export const PLANT_LEAF = REED_LEAF;
/** Toy boat hull, soft pink. 11.19:1. */
export const BOAT_HULL = UI_PANEL_PINK;
/** Toy boat canopy, pebble A, so the white shine shows. 9.50:1. */
export const BOAT_CANOPY = PEBBLE_A;
/** Castle tower stone, pebble A. 9.50:1. */
export const CASTLE_STONE = PEBBLE_A;
/** Sun pyramid stone, pebble C. 10.70:1. */
export const PYRAMID_STONE = PEBBLE_C;
/** Sun hat, sun yellow. 11.05:1. */
export const HAT_FILL = SUN;
/** Shell necklace shells, pebble C. 10.70:1. */
export const NECKLACE_SHELL = PEBBLE_C;
/**
 * Shell necklace cord, soft pink. 11.19:1. The cord is part of the outer
 * silhouette, so it must pass the 9:1 rule too.
 */
export const NECKLACE_CORD = UI_PANEL_PINK;
/**
 * Heart glasses frame colour band. Soft pink, 11.19:1. The task asked for
 * #ff82bf (6.30:1), which fails the 9:1 rule on the outer silhouette.
 */
export const GLASSES_FRAME = UI_PANEL_PINK;
/** Glasses lens tint: a white tint at 0.25, never opaque (guide 6i). */
export const GLASSES_LENS = 'rgba(255,255,255,0.25)';
/** Golden bow ribbon, soft pink. 11.19:1. */
export const BOW_FILL = UI_PANEL_PINK;
/** Tank top, the reed leaf green. 9.25:1. */
export const TANK_TOP_FILL = REED_LEAF;
/** Stripy socks, pebble C. 10.70:1. */
export const SOCK_FILL = PEBBLE_C;
/** Diving tank body, pebble A. 9.50:1. */
export const DIVING_TANK_FILL = PEBBLE_A;
/** Flippers, sun yellow. 11.05:1. */
export const FLIPPER_FILL = SUN;

// ---- Pond silhouette fills (issue #75; all at least 9:1 with ink) ---------
// Icons and worn looks share these. Later steps may add only internal detail
// colours, never outer fills. Legendary pond items reuse GOLD_TRIM (#ffc12e).
// None equals a BADGE_FILL rarity colour. Ratios are fill against ink.

/** Lily pad Decoration, pad fill: the lily pad shine green. 10.95:1. */
export const LILY_PAD_FILL = LILY_PAD_SHINE;
/** Cattail clump stems, the reed leaf green. 9.25:1. */
export const CATTAIL_STEM = REED_LEAF;
/** Cattail clump heads, a pale tan (a light cattail brown, since the true brown fails 9:1). 9.64:1. */
export const CATTAIL_HEAD = '#f0cf94';
/** Frog statue stone, a pale mossy green stone. 10.87:1. */
export const FROG_STATUE_STONE = '#cfe8b4';
/** Lotus lantern petals, pale pink. 9.90:1. */
export const LOTUS_PETAL = '#ffc6e4';
/** Lotus lantern glowing body, pale lantern yellow. 12.01:1. */
export const LOTUS_LANTERN_BODY = '#ffeaa0';
/** Lily flower crown blooms, blush white. 11.75:1. */
export const LILY_CROWN_FLOWER = '#ffe0ee';
/** Lily flower crown leaves, the lily pad shine green. 10.95:1. */
export const LILY_CROWN_LEAF = LILY_PAD_SHINE;
/** Pond-weed scarf, spring green. 10.40:1. */
export const POND_WEED_SCARF = '#b5ec6c';
/** Dragonfly glasses frame, pale aqua. 10.39:1. */
export const DRAGONFLY_FRAME = '#8fe8ff';
/** Raincoat, pale apricot. 9.52:1. */
export const RAINCOAT_FILL = '#ffc79a';
/** Ladybug backpack shell, pale ladybug red (a light red, since the true red fails 9:1). 9.05:1. */
export const LADYBUG_SHELL = '#ffbcc0';
/** Rainbow dragonfly wings, pale sky film. 12.48:1. */
export const DRAGONFLY_WING = '#d9f3ff';
/** Froggy boots, minty frog green. 10.34:1. */
export const FROGGY_BOOT = '#8cf0a0';

// ---- Pond Area 3 silhouette fills (issue #98; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Wearables share these (the worn looks import them from here, they
// never repeat the hex). Later steps may add only internal detail colours, never outer fills. Legendary
// items reuse GOLD_TRIM (#ffc12e). None equals a BADGE_FILL rarity colour. Ratios are fill against ink.

/** Reed bundle stalks, a pale straw. 10.69:1. */
export const REED_BUNDLE_STALK = '#e8e0a0';
/** Feather vane, a pale lilac-white. Shared by the Drifting feather and the Feather cap plume. 11.69:1. */
export const FEATHER_FILL = '#dde8ff';
/** Wooden duck decoy body and anchor weight, pale carved wood (the true wood brown fails 9:1). 10.59:1. */
export const DECOY_BODY = '#f6d9ae';
/** Wooden duck decoy beak, sun yellow. 11.05:1. */
export const DECOY_BEAK = SUN;
/** Firefly string lights bulbs, a pale glowing yellow. 11.84:1. */
export const FIREFLY_BULB = '#ffe98a';
/** Firefly string lights and Firefly jar hook rings, pebble A. 9.50:1. */
export const FIREFLY_HOOK = PEBBLE_A;
/** Firefly string lights sockets, soft pink (the one trim of the Rare). 11.19:1. */
export const FIREFLY_SOCKET = NECKLACE_CORD;
/** Firefly jar glass, a pale glass blue. 11.84:1. */
export const FIREFLY_JAR_GLASS = '#cdeeff';
/** Firefly jar lid, the decoy's pale wood. 10.59:1. */
export const FIREFLY_JAR_LID = DECOY_BODY;
/** Golden lotus throne petals, a pale gold. 11.68:1. */
export const GOLDEN_LOTUS_PETAL = '#ffe69a';
/** Golden lotus throne seat cushion, the lotus lantern petal pink. 9.90:1. */
export const GOLDEN_LOTUS_SEAT = LOTUS_PETAL;
/** Golden lotus throne base, pebble C. 10.70:1. */
export const GOLDEN_LOTUS_BASE = PEBBLE_C;
/** Feather cap, a pale sky blue. 11.04:1. */
export const FEATHER_CAP_FILL = '#c4e6ff';
/** Lily-pad socks, a pale pad green. 11.09:1. */
export const LILY_PAD_SOCK_FILL = '#bff0a0';
/** Water-lily shirt, a pale water blue. 11.74:1. */
export const WATER_LILY_SHIRT_FILL = '#d0ecff';
/** Water-lily shirt blossom, the lily flower crown blush white. 11.75:1. */
export const WATER_LILY_BLOSSOM = LILY_CROWN_FLOWER;
/** Pearl tail charm pearl, a pale pearl pink. 12.13:1. */
export const PEARL_FILL = '#fbe6f2';
/** Pearl tail charm chain and ribbon tails, soft pink. 11.19:1. */
export const PEARL_CHARM_CORD = NECKLACE_CORD;
/** Firefly cape, a pale night periwinkle (the true night blue fails 9:1). 10.40:1. */
export const FIREFLY_CAPE_FILL = '#d4d9ff';

// ---- Trims, gems and details inside the silhouette (free) -----------------

/** Legendary trim (3e, 6i). */
export const GOLD_TRIM = '#ffc12e';
/** Rare and Epic trim bands. */
export const BOAT_TRIM = SUN;
/** Diving tank strap band, the boat yellow (guide 7e). */
export const DIVING_TANK_STRAP = BOAT_TRIM;
/** Flippers cuff band, the castle pink (guide 7e). */
export const FLIPPER_CUFF = FLOWER_PETAL;
/** Flippers fan ridges, the Paint shell ridge colour; internal lines, not ink (guide 7e). */
export const FLIPPER_RIDGE = PEBBLE_E;
export const CASTLE_TRIM = FLOWER_PETAL;
export const CASTLE_GEM = WATER_SHALLOW;
export const CASTLE_WINDOW = EYE;
export const PYRAMID_GEM = '#ff5f8d';
export const GLASSES_GEM = WATER_SHALLOW;
export const BOW_GEM = '#ff5f8d';
/** The yellow glow round a firefly inside the Firefly jar and on the Firefly cape; inside the silhouette, so free. */
export const FIREFLY_GLOW = 'rgba(255,225,74,0.75)';
/** Glint inside a gem. */
export const GEM_GLINT = WHITE;
/** 4-point star on Legendary icons (guide 4e): white with an ink outline. */
export const TREASURE_STAR = WHITE;

// ---- Worn looks (guide 6a, 6i) ----------------------------------------------

/**
 * Far-leg Socks and Feet are the item colours mixed this far toward ink (guide 6a layer 2.5,
 * the far-side depth rule of 3f). Ink and shine stay as on the near pair.
 */
export const WORN_FAR_INK_MIX = 0.12;
/** Stripy socks: the three sleeve stripes are ink at this alpha (guide 6i), the same colour darkened. */
export const SOCK_STRIPE_ALPHA = 0.3;

// ---- Paint shell (guide 3g, 7e) --------------------------------------------

/** Paint shell fill. 10.70:1 with ink. */
export const PAINT_SHELL_FILL = PEBBLE_C;
/** Paint shell ridges and cup, an internal detail colour, not ink. */
export const PAINT_SHELL_RIDGE = PEBBLE_E;
/**
 * Rim light along the top of a dark Dream blob (Midnight blue, Galaxy,
 * Tie-dye galaxy). 9.07:1 with ink (guide 3f).
 */
export const DREAM_RIM = '#cec9f0';
/** Thin divider between Rainbow and Tie-dye bands. */
export const DREAM_DIVIDER = 'rgba(255,255,255,0.8)';
/** Galaxy and Tie-dye galaxy stars: plain white, no outline, on a dark base. */
export const DREAM_STAR = WHITE;

/** The seventeen Dream colour ids, in the order the guide lists them (3f). */
export type DreamSwatchId =
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
  | 'moonstone';

/** The simplified pattern drawn in the paint blob (guide 8). */
export type DreamPattern = 'plain' | 'hearts' | 'spiral' | 'stripes' | 'bands' | 'stars' | 'spiral-stars';

export interface DreamSwatchLook {
  /** Body colour from the 3f table. */
  readonly body: string;
  readonly pattern: DreamPattern;
  /** Pattern colours: heart, spiral bands, stripe pair, rainbow bands or the nebula wash. */
  readonly marks: readonly string[];
  /** True on the dark bodies, which get the DREAM_RIM along the top. */
  readonly dark: boolean;
}

/** Dream colour bodies and pattern colours, all from guide 3f. */
export const DREAM_SWATCH: Readonly<Record<DreamSwatchId, DreamSwatchLook>> = {
  mint: { body: '#a8f0cf', pattern: 'plain', marks: [], dark: false },
  'sky-blue': { body: '#9fd8ff', pattern: 'plain', marks: [], dark: false },
  lavender: { body: '#d6c5ff', pattern: 'plain', marks: [], dark: false },
  'sunset-orange': { body: '#ffc18e', pattern: 'plain', marks: [], dark: false },
  bubblegum: { body: '#ffb9e2', pattern: 'plain', marks: [], dark: false },
  'midnight-blue': { body: '#2f3a8f', pattern: 'plain', marks: [], dark: true },
  hearts: { body: '#fff0b3', pattern: 'hearts', marks: ['#ff5f8d'], dark: false },
  'tie-dye': { body: '#ffe9a8', pattern: 'spiral', marks: ['#ff7fbf', '#7fd4ff', '#ffe14a'], dark: false },
  iridescent: {
    body: '#d7ccff',
    pattern: 'stripes',
    marks: ['rgba(255,255,255,0.7)', 'rgba(143,127,224,0.6)'],
    dark: false,
  },
  rainbow: {
    body: '#ff6b6b',
    pattern: 'bands',
    marks: ['#ff6b6b', '#ffa64d', '#ffe14a', '#7fe07f', '#6cb8ff', '#b07cff'],
    dark: false,
  },
  galaxy: { body: '#2b2f7a', pattern: 'stars', marks: ['rgba(255,127,191,0.35)'], dark: true },
  'tie-dye-galaxy': {
    body: '#3a2f7a',
    pattern: 'spiral-stars',
    marks: ['rgba(255,127,191,0.75)', 'rgba(127,212,255,0.75)'],
    dark: true,
  },
  'lily-green': { body: '#ddf274', pattern: 'plain', marks: [], dark: false },
  'firefly-gold': { body: '#ffd52a', pattern: 'plain', marks: [], dark: false },
  'poppy-red': { body: '#e8402f', pattern: 'plain', marks: [], dark: false },
  plum: { body: '#933f93', pattern: 'plain', marks: [], dark: true },
  moonstone: { body: '#f5f7fc', pattern: 'plain', marks: [], dark: false },
};
