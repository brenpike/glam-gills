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

// ---- Spring cave Area 6 silhouette fills (issue #77, ND-12; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Wearables share these (the worn looks import them from here, they
// never repeat the hex). Later steps may add only internal detail colours, never outer fills. The cave is
// cool and pale: grey-blue stone, a pale teal crystal and a pale amber lamp. None equals a BADGE_FILL
// rarity colour. Ratios are fill against ink. Aliases of a shipped colour say so.

/** Pebble stack stones, a pale river-stone grey-blue. 10.80:1. */
export const PEBBLE_STACK_FILL = '#d6e0ee';
/** Glow moss ball, the lily-pad socks' pale pad green. Alias of LILY_PAD_SOCK_FILL. 11.09:1. */
export const MOSS_BALL_FILL = LILY_PAD_SOCK_FILL;
/** Glow moss ball anchor weight, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const MOSS_BALL_WEIGHT = FIREFLY_HOOK;
/** Miner's headlamp helmet and lamp housing, a pale amber hard hat. 10.65:1. */
export const MINERS_HELMET_FILL = '#ffd98a';
/** Cave crystal, a pale teal: the pendant, the wind chime rods, the tail cuff points, the arch and the crown points. 11.99:1. */
export const CAVE_CRYSTAL_FILL = '#c9f3ea';
/** Fossil ammonite shell, a pale sandstone. 11.31:1. */
export const AMMONITE_FILL = '#f4e2c2';
/** Fossil ammonite slab, pebble A. 9.50:1. */
export const AMMONITE_SLAB = PEBBLE_A;
/** Crystal wind chime top bar, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const WIND_CHIME_BAR = DECOY_BODY;
/** Crystal wind chime hook ring, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const WIND_CHIME_HOOK = FIREFLY_HOOK;
/** Explorer vest, a pale khaki-green canvas. 11.62:1. */
export const EXPLORER_VEST_FILL = '#e4ecb4';
/** Geode lamp rock shell, a pale grey-brown stone. 10.37:1. */
export const GEODE_ROCK_FILL = '#e4d9cf';
/** Geode lamp base, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const GEODE_BASE_FILL = GOLDEN_LOTUS_BASE;
/** Crystal tail cuff band, pebble A. 9.50:1. */
export const CRYSTAL_CUFF_BAND = PEBBLE_A;
/** Crystal arch plinth, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const CRYSTAL_ARCH_BASE = GOLDEN_LOTUS_BASE;
/** Crystal crown base band, a pale silver-white (so the gold band across it reads in greyscale, 1.46:1). 12.96:1. */
export const CRYSTAL_CROWN_BAND = '#f0f3fa';

// ---- Spring cave Area 7 silhouette fills (issue #105, ND-13; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Area 7 Wearables share these (the worn looks import them from here, they
// never repeat the hex). The second cave area keeps Area 6's cool pale stone and adds a pale terracotta pot, a
// pale tangerine helmet, a pale glass green goggle frame, a pale lantern amber and a pale amethyst cape. None
// equals a BADGE_FILL rarity colour. Ratios are fill against ink. Aliases of a shipped colour say so.

/** Mossy rock stone, the pebble stack's pale river-stone grey-blue. Alias of PEBBLE_STACK_FILL. 10.80:1. */
export const MOSSY_ROCK_FILL = PEBBLE_STACK_FILL;
/** Mossy rock moss cap, the lily-pad socks' pale pad green. Alias of MOSS_BALL_FILL. 11.09:1. */
export const MOSSY_ROCK_MOSS = MOSS_BALL_FILL;
/** Bubble stone, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const BUBBLE_STONE_FILL = FIREFLY_HOOK;
/** Bubbles: the Bubble stone's and the Bubble machine's, a pale bubble aqua. 12.46:1. */
export const BUBBLE_FILL = '#d4f4ff';
/** Climbing helmet, a pale tangerine shell. 10.30:1. */
export const CLIMBING_HELMET_FILL = '#ffd2a6';
/** Pebble necklace cord, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const PEBBLE_NECKLACE_CORD = GOLDEN_LOTUS_BASE;
/** Pebble necklace pebbles, the pebble stack's grey-blue. Alias of PEBBLE_STACK_FILL. 10.80:1. */
export const PEBBLE_NECKLACE_STONE = PEBBLE_STACK_FILL;
/** Ancient clay pot, a pale terracotta (the true clay red-brown fails 9:1). 10.19:1. */
export const CLAY_POT_FILL = '#f8d2b4';
/** Glowing stalactite rock and its ceiling slab, a pale lilac-grey stone. 10.33:1. */
export const STALACTITE_ROCK = '#dcd8ec';
/** Glowing stalactite hook ring, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const STALACTITE_HOOK = FIREFLY_HOOK;
/** Cave goggles frames, a pale glass green. 11.38:1. */
export const GOGGLES_FRAME = '#c5f0c0';
/** Cave goggles strap, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const GOGGLES_STRAP = FIREFLY_HOOK;
/** Bubble machine body, the shell necklace cord's soft pink. Alias of NECKLACE_CORD. 11.19:1. */
export const BUBBLE_MACHINE_FILL = NECKLACE_CORD;
/** Bubble machine nozzle, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const BUBBLE_MACHINE_NOZZLE = FIREFLY_HOOK;
/** Glow tail lantern glass, a pale glowing amber. 12.62:1. */
export const LANTERN_GLASS = '#fff0b8';
/** Glow tail lantern cap, base and handle ring, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const LANTERN_FRAME = FIREFLY_HOOK;
/** Underground waterfall cliff, the stalactite's lilac-grey stone. Alias of STALACTITE_ROCK. 10.33:1. */
export const WATERFALL_ROCK = STALACTITE_ROCK;
/** Underground waterfall water and pool, the firefly jar's pale glass blue. Alias of FIREFLY_JAR_GLASS. 11.84:1. */
export const WATERFALL_WATER = FIREFLY_JAR_GLASS;
/** Underground waterfall plinth, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const WATERFALL_BASE = GOLDEN_LOTUS_BASE;
/** Gemstone cape, a pale amethyst. 11.00:1. */
export const GEMSTONE_CAPE_FILL = '#e6dcff';

// ---- Deep canal Area 8 silhouette fills (issue #78; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Area 8 Wearables share these (the worn looks import them from here, they
// never repeat the hex). The deep canal is the festival water: cream trajinera hulls, pale teal arches, pink and
// yellow blossoms and a pale rainbow. The Flower garland uses shipped colours alone (the lotus lantern pink and
// the marigold blossom of drawTreasures.ts, the reed leaf green and the firefly hook ring). None equals a
// BADGE_FILL rarity colour. Ratios are fill against ink. Aliases of a shipped colour say so.

/** Paper boat, a pale paper blue. 11.18:1. */
export const PAPER_BOAT_FILL = '#bfe9ff';
/** Paper boat and Floating flower market anchor weights, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const DEEP_CANAL_WEIGHT = FIREFLY_HOOK;
/** Little trajinera and Trajinera flower arch hull and deck, the trajinera's warm cream (guide 3g). 12.72:1. */
export const TRAJINERA_HULL = '#fff0c9';
/** Little trajinera and Trajinera flower arch ring, a pale teal. Also the Painted oar blade and the Floating flower market hull. 11.05:1. */
export const TRAJINERA_ARCH = '#a6f0dc';
/** Flower arch and flower market blossoms, the lotus lantern pink. Alias of LOTUS_PETAL. 9.90:1. */
export const TRAJINERA_BLOSSOM_PINK = LOTUS_PETAL;
/** Flower arch and flower market blossoms, sun yellow. Alias of HAT_FILL. 11.05:1. */
export const TRAJINERA_BLOSSOM_YELLOW = HAT_FILL;
/** Flower market leaves, the reed leaf green. Alias of PLANT_LEAF. 9.25:1. */
export const MARKET_LEAF = PLANT_LEAF;
/** Painted oar shaft and grip, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const PAINTED_OAR_WOOD = DECOY_BODY;
/** Painted oar blade, the trajinera arch's pale teal. Alias of TRAJINERA_ARCH. 11.05:1. */
export const PAINTED_OAR_BLADE = TRAJINERA_ARCH;
/** Floating flower market hull, the trajinera arch's pale teal. Alias of TRAJINERA_ARCH. 11.05:1. */
export const FLOWER_MARKET_HULL = TRAJINERA_ARCH;
/** Sailor cap, a pale blue-white. The same hex as the worn cap's own SAILOR_CAP_FILL in drawWearables.ts. 13.04:1. */
export const SAILOR_CAP_FILL = '#eef4ff';
/** Striped scarf, a pale apricot. The same hex as the worn scarf's own STRIPED_SCARF_FILL in drawWearables.ts. 10.97:1. */
export const STRIPED_SCARF_FILL = '#ffdbb0';
/** Mariachi jacket, a pale butter yellow. The same hex as the worn jacket's own MARIACHI_JACKET_FILL in drawWearables.ts. 12.53:1. */
export const MARIACHI_JACKET_FILL = '#fff0a8';
/** Captain's hat crown, band and visor, a pale cream (the band and the visor are the same colour darkened). The same hex as the worn cap's own CAPTAINS_HAT_FILL in drawWearables.ts. 13.34:1. */
export const CAPTAINS_HAT_FILL = '#fff6dc';
/**
 * Rainbow fin streamers, the six ribbons left to right: pink, orange, yellow, green, blue and violet, none red
 * (the Rainbow serape cape's six stripes, as outer fills here). 9.90:1, 9.25:1, 11.05:1, 10.95:1, 9.42:1 and 9.47:1.
 */
export const FIN_STREAMER_FILLS: readonly string[] = ['#ffc6e4', '#ffc487', '#ffe14a', '#a2f58c', '#9fd8ff', '#d8caff'];
/** Rainbow fin streamers tie, a pale silver-white (so the gold band across it reads in greyscale). Alias of CRYSTAL_CROWN_BAND. 12.96:1. */
export const FIN_STREAMER_KNOT = CRYSTAL_CROWN_BAND;

// ---- Deep canal Area 9 silhouette fills (issue #107; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Area 9 Wearables share these names. Area 9 is the same festival water seen
// from the working side: clay, rope, cork, tin, painted boards and paper lanterns, all pale. The Paper lantern boat
// reuses the trajinera hull and the Floating music stage reuses the blossom pink and the boat weight. None equals a
// BADGE_FILL rarity colour. Ratios are fill against ink. Aliases of a shipped colour say so.

/** Clay jug, a pale terracotta. 9.62:1. */
export const CLAY_JUG_FILL = '#ffc7ae';
/** Floating cork, a pale cork tan. 10.18:1. */
export const FLOATING_CORK_FILL = '#ecd7a8';
/** Little bailing bucket body, a pale tin. 11.61:1. */
export const BAILING_BUCKET_FILL = '#dfe8f0';
/** Little bailing bucket handle and Rope necklace cord, a pale hemp rope. 10.95:1. */
export const BAILING_BUCKET_ROPE = '#efe0b2';
/** Painted name sign board, a pale periwinkle. 10.94:1. */
export const NAME_SIGN_FILL = '#d6e0ff';
/** Paper lantern boat lantern, a pale amber paper. 10.75:1. */
export const LANTERN_BOAT_PAPER = '#ffd9a0';
/** Paper lantern boat hull, the trajinera's warm cream. Alias of TRAJINERA_HULL. 12.72:1. */
export const LANTERN_BOAT_HULL = TRAJINERA_HULL;
/** Floating music stage deck, a pale lilac. 10.89:1. */
export const MUSIC_STAGE_DECK = '#f0d8f8';
/** Floating music stage band shell, the lotus lantern pink. Alias of TRAJINERA_BLOSSOM_PINK. 9.90:1. */
export const MUSIC_STAGE_SHELL = TRAJINERA_BLOSSOM_PINK;
/** Bucket hat, a pale canvas khaki. 11.76:1. */
export const BUCKET_HAT_FILL = '#f3e9b8';
/** Rope necklace cord, knot and tails, the pale hemp rope. Alias of BAILING_BUCKET_ROPE. 10.95:1. */
export const ROPE_NECKLACE_CORD = BAILING_BUCKET_ROPE;
/** Poncho, a pale coral. 10.38:1. */
export const PONCHO_FILL = '#ffd0cc';
/** Tail bell, a pale brass. 11.61:1. */
export const TAIL_BELL_FILL = '#fbe6a2';
/** Tail bell clapper, pebble A. Alias of DEEP_CANAL_WEIGHT. 9.50:1. */
export const TAIL_BELL_CLAPPER = DEEP_CANAL_WEIGHT;
/** Golden boatman cape, a pale gold cream (the gold trim and the gem sit inside it). 12.78:1. */
export const BOATMAN_CAPE_FILL = '#fff2b8';

// ---- Deep canal Area 10 silhouette fills (issue #108; all at least 9:1 with ink) ----
// Icons and the worn looks of the five Area 10 Wearables share these names. Area 10 is the festival after the work:
// flags, candles, party hats, confetti, marigolds, music and a champion's prizes, all pale. Four fills are new (a
// pale party blue, a pale rose stone, a pale embroidered white and a pale crown gold); the rest are shipped colours
// reused by name. None equals a BADGE_FILL rarity colour. Ratios are fill against ink. Aliases of a shipped colour
// say so.

/** Party hat cone, a pale party blue. 11.41:1. */
export const PARTY_HAT_FILL = '#cfe8ff';
/** Axolotl statue stone, a pale rose stone. 10.69:1. */
export const AXOLOTL_STATUE_STONE = '#f6d6de';
/** Festival shirt, a pale embroidered white. 13.36:1. */
export const FESTIVAL_SHIRT_FILL = '#fbf4ff';
/** Champion crown, a pale crown gold. 12.01:1. */
export const CHAMPION_CROWN_FILL = '#ffeaa0';
/** Festival flag string flags, in turn the lotus lantern pink, the pale teal and the butter yellow. 9.90:1, 11.05:1 and 12.53:1. */
export const FESTIVAL_FLAG_FILLS: readonly string[] = [TRAJINERA_BLOSSOM_PINK, TRAJINERA_ARCH, MARIACHI_JACKET_FILL];
/** Floating candle wax, the captain's cream. Alias of CAPTAINS_HAT_FILL. 13.34:1. */
export const CANDLE_WAX_FILL = CAPTAINS_HAT_FILL;
/** Floating candle flower float, the lotus lantern pink. Alias of TRAJINERA_BLOSSOM_PINK. 9.90:1. */
export const CANDLE_FLOAT_FILL = TRAJINERA_BLOSSOM_PINK;
/** Floating candle flame, the firefly string light bulb yellow. Alias of FIREFLY_BULB. 11.84:1. */
export const CANDLE_FLAME_FILL = FIREFLY_BULB;
/** Marigold boat hull, the trajinera's warm cream. Alias of TRAJINERA_HULL. 12.72:1. */
export const MARIGOLD_BOAT_HULL = TRAJINERA_HULL;
/** Confetti scarf, the Gemstone cape's pale amethyst. Alias of GEMSTONE_CAPE_FILL. 11.00:1. */
export const CONFETTI_SCARF_FILL = GEMSTONE_CAPE_FILL;
/** Mariachi band figures' bodies and heads, soft pink. Alias of UI_PANEL_PINK. 11.19:1. */
export const BAND_FIGURE_BODY = UI_PANEL_PINK;
/** Mariachi band figures' sombreros, the butter yellow. Alias of MARIACHI_JACKET_FILL. 12.53:1. */
export const BAND_FIGURE_HAT = MARIACHI_JACKET_FILL;
/** Mariachi band figures' plinth and the Refuge snow globe's base, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const FESTIVAL_PLINTH = GOLDEN_LOTUS_BASE;
/** Hero medal disc, the gold cream. Alias of BOATMAN_CAPE_FILL. 12.78:1. */
export const HERO_MEDAL_FILL = BOATMAN_CAPE_FILL;
/** Hero medal ribbon, the pale teal. Alias of TRAJINERA_ARCH. 11.05:1. */
export const HERO_MEDAL_RIBBON = TRAJINERA_ARCH;
/** Refuge snow globe glass, the firefly jar glass. Alias of FIREFLY_JAR_GLASS. 11.84:1. */
export const SNOW_GLOBE_GLASS = FIREFLY_JAR_GLASS;
/** Refuge snow globe's resting axolotl, soft pink. Alias of UI_PANEL_PINK. 11.19:1; inside the glass, so free. */
export const SNOW_GLOBE_AXOLOTL = UI_PANEL_PINK;
/** Refuge snow globe's waterweed, the reed leaf green. Alias of PLANT_LEAF. 9.25:1; inside the glass, so free. */
export const SNOW_GLOBE_WEED = PLANT_LEAF;
/** Refuge snow globe's drifting flecks, a cream (never white, so a fleck is never read as a gem glint); inside the glass, so free. */
export const SNOW_GLOBE_FLECK = '#fff3d6';

// ---- Deep canal Area 11 silhouette fills (issue #112; all at least 9:1 with ink) ----
// The Little cormorant, Area 11's special treasure: a friendly toy of the area's diving bird, so pale where the real
// bird is dark. One fill is new (a pale dusk blue-grey); the bill reuses the shipped colour the cormorant's own bill
// uses (guide 7n). None equals a BADGE_FILL rarity colour. Ratios are fill against ink. Aliases of a shipped colour say
// so.

/** Little cormorant body, tail, neck and head, a pale dusk blue-grey. 10.60:1. */
export const LITTLE_CORMORANT_BODY = '#d9dcf2';
/** Little cormorant closed bill and throat patch, the cormorant's bill colour. Alias of MINERS_HELMET_FILL. 10.65:1. */
export const LITTLE_CORMORANT_BILL = MINERS_HELMET_FILL;

// ---- Deep canal Area 11 Wearable fills (issue #207; all at least 9:1 with ink) ----
// The five big, silly Wearables: a propeller cap, star sunglasses, a robot suit, a jetpack and a wizard hat. Three
// fills are new (a pale apple green, a pale silver and a pale starry violet); the rest reuse shipped colours by name.
// None equals a BADGE_FILL rarity colour, and none is red. Ratios are fill against ink. Aliases of a shipped colour
// say so.

/** Propeller cap dome and peak, a pale apple green. 12.03:1. */
export const PROPELLER_CAP_FILL = '#d6f5b0';
/** Propeller cap's two round-ended blades, hub and stalk, the lotus lantern pink. Alias of TRAJINERA_BLOSSOM_PINK. 9.90:1. */
export const PROPELLER_BLADE_FILL = TRAJINERA_BLOSSOM_PINK;
/** Star sunglasses' two soft-pointed star frames and bridge, the butter yellow. Alias of MARIACHI_JACKET_FILL. 12.53:1. */
export const STAR_SUNGLASSES_FRAME = MARIACHI_JACKET_FILL;
/** Robot suit body, shoulders and arms, a pale silver. 11.95:1. */
export const ROBOT_SUIT_FILL = '#e6eaf4';
/** Robot suit's round chest light and its soft glow, the dragonfly aqua. Alias of DRAGONFLY_FRAME; inside the suit, so free. */
export const ROBOT_SUIT_LIGHT = DRAGONFLY_FRAME;
/** Jetpack's two rounded rocket tanks, a pale apricot. Alias of STRIPED_SCARF_FILL. 10.97:1. */
export const JETPACK_TANK_FILL = STRIPED_SCARF_FILL;
/** Jetpack's middle plate and two nozzles, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const JETPACK_FRAME = FIREFLY_HOOK;
/** Jetpack's puffed bubbles (bubbles, never flames: ADR 0007), the bubble stone's bubble. Alias of BUBBLE_FILL. 12.46:1. */
export const JETPACK_BUBBLE = BUBBLE_FILL;
/** Wizard hat cone and brim, a pale starry violet. 10.38:1. */
export const WIZARD_HAT_FILL = '#ddd6ff';
/** Wizard hat's soft round tip on the curled point, the pale crown gold. Alias of CHAMPION_CROWN_FILL. 12.01:1. */
export const WIZARD_HAT_TIP = CHAMPION_CROWN_FILL;

// ---- Deep canal Area 11 Decoration fills (issue #207; all at least 9:1 with ink) ----
// The three festival Decorations: a flower raft, a festival kite and a carousel. One fill is new (a pale hyacinth
// lilac); the rest reuse shipped colours by name. None equals a BADGE_FILL rarity colour, and none is red. Ratios are
// fill against ink. Aliases of a shipped colour say so.

/** Flower raft's round water hyacinth leaves, the reed leaf green. Alias of PLANT_LEAF. 9.25:1. */
export const FLOWER_RAFT_LEAF = PLANT_LEAF;
/** Flower raft's bloom spike of five-lobed florets, a pale hyacinth lilac. 9.95:1. */
export const FLOWER_RAFT_BLOOM = '#e8ccff';
/** Flower raft florets' round eyes, the butter yellow. Alias of MARIACHI_JACKET_FILL; inside each floret, so free. */
export const FLOWER_RAFT_EYE = MARIACHI_JACKET_FILL;
/** Festival kite's diamond, the lotus lantern pink. Alias of TRAJINERA_BLOSSOM_PINK. 9.90:1. */
export const FESTIVAL_KITE_FILL = TRAJINERA_BLOSSOM_PINK;
/** Festival kite's two teal quarters, the pale teal. Alias of TRAJINERA_ARCH. 11.05:1; inside the kite, so free. */
export const FESTIVAL_KITE_PANEL = TRAJINERA_ARCH;
/** Festival kite's tail bows, in turn the butter yellow and the pale teal. 12.53:1 and 11.05:1. */
export const FESTIVAL_KITE_BOWS: readonly string[] = [MARIACHI_JACKET_FILL, TRAJINERA_ARCH];
/** Carousel's striped canopy, the pale teal. Alias of TRAJINERA_ARCH. 11.05:1. */
export const CAROUSEL_CANOPY = TRAJINERA_ARCH;
/** Carousel canopy's stripes, the captain's cream. Alias of CAPTAINS_HAT_FILL. 13.34:1; inside the canopy, so free. */
export const CAROUSEL_STRIPE = CAPTAINS_HAT_FILL;
/** Carousel's round finial on the canopy top, the butter yellow. Alias of MARIACHI_JACKET_FILL. 12.53:1. */
export const CAROUSEL_FINIAL = MARIACHI_JACKET_FILL;
/** Carousel's middle pole, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const CAROUSEL_POLE = FIREFLY_HOOK;
/** Carousel's two toy axolotl riders, soft pink. Alias of UI_PANEL_PINK. 11.19:1. */
export const CAROUSEL_RIDER = UI_PANEL_PINK;
/** Carousel's round turning platform, pebble C. Alias of FESTIVAL_PLINTH. 10.70:1. */
export const CAROUSEL_BASE = FESTIVAL_PLINTH;

// ---- Open lake Area 12 Decoration fills (issue #214, ND-8; all at least 9:1 with ink) ----
// The five lake Decorations: a windsock, a pinwheel, a little pelican (the area's special treasure), the twin volcanoes
// and a little sailboat. Two fills are new, both the pelican line's own (guide 7r): its soft white feathers and its pale
// orange pouch; the rest reuse shipped colours by name. None equals a BADGE_FILL rarity colour, and none is red. Ratios
// are fill against ink. Aliases of a shipped colour say so.

/** Windsock's tapering sock, the pale apricot. Alias of STRIPED_SCARF_FILL. 10.97:1. */
export const WINDSOCK_FILL = STRIPED_SCARF_FILL;
/** Windsock's round mouth hoop, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const WINDSOCK_HOOP = FIREFLY_HOOK;
/** Pinwheel's four blades, in turn the lotus lantern pink and the pale teal. 9.90:1 and 11.05:1. */
export const PINWHEEL_BLADES: readonly string[] = [TRAJINERA_BLOSSOM_PINK, TRAJINERA_ARCH];
/** Pinwheel's round middle pin, the butter yellow. Alias of MARIACHI_JACKET_FILL. 12.53:1. */
export const PINWHEEL_PIN = MARIACHI_JACKET_FILL;
/** Pinwheel's stick, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const PINWHEEL_STICK = DECOY_BODY;
/** Pinwheel's little round mound of sand, pebble C. Alias of FESTIVAL_PLINTH. 10.70:1. */
export const PINWHEEL_BASE = FESTIVAL_PLINTH;
/** Little pelican's body, neck, head and tail, the pelican line's soft white feathers (guide 7r). 11.54:1. */
export const LITTLE_PELICAN_BODY = '#e8e4f4';
/**
 * Little pelican's closed bill with its slim empty pouch, the pelican line's pale orange pouch (guide 7r). The real
 * bird's warm orange bill is 7.38:1, under 9:1, so the toy's whole bill takes the pouch colour. 9.51:1.
 */
export const LITTLE_PELICAN_BILL = '#ffc977';
/** Twin volcanoes' two mountains, the stalactite's pale lilac stone. Alias of STALACTITE_ROCK. 10.33:1. */
export const TWIN_VOLCANO_ROCK = STALACTITE_ROCK;
/** Twin volcanoes' snow caps, a pale silver-white. Alias of CRYSTAL_CROWN_BAND. 12.96:1; inside the mountains, so free. */
export const TWIN_VOLCANO_SNOW = CRYSTAL_CROWN_BAND;
/** Twin volcanoes' round lake plinth, the pale paper blue. Alias of PAPER_BOAT_FILL. 11.18:1. */
export const TWIN_VOLCANO_BASE = PAPER_BOAT_FILL;
/** Little sailboat's hull, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const LITTLE_SAILBOAT_HULL = DECOY_BODY;
/** Little sailboat's two sails, the pale blue-white. Alias of SAILOR_CAP_FILL. 13.04:1. */
export const LITTLE_SAILBOAT_SAIL = SAILOR_CAP_FILL;
/** Little sailboat's mast, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const LITTLE_SAILBOAT_MAST = FIREFLY_HOOK;

// ---- Open lake Area 12 Wearable fills (issue #214, ND-8; all at least 9:1 with ink) ----
// The five lake Wearables: wave socks, a cloud scarf, a pelican swim ring, a surfboard and pelican slippers. Every fill
// reuses a shipped colour by name (the two pelican items share the Little pelican's feathers and bill); the worn looks
// import these names. None equals a BADGE_FILL rarity colour, and none is red. Ratios are fill against ink.

/** Wave socks, the pale paper blue. Alias of PAPER_BOAT_FILL. 11.18:1. */
export const WAVE_SOCKS_FILL = PAPER_BOAT_FILL;
/** Cloud scarf's puffs and hanging tail, a pale silver-white. Alias of CRYSTAL_CROWN_BAND. 12.96:1. */
export const CLOUD_SCARF_FILL = CRYSTAL_CROWN_BAND;
/** Pelican swim ring's ring, neck and head, the Little pelican's feathers. Alias of LITTLE_PELICAN_BODY. 11.54:1. */
export const PELICAN_SWIM_RING_FILL = LITTLE_PELICAN_BODY;
/** Pelican swim ring's closed bill, the Little pelican's bill. Alias of LITTLE_PELICAN_BILL. 9.51:1. */
export const PELICAN_SWIM_RING_BILL = LITTLE_PELICAN_BILL;
/** Surfboard, the pale teal. Alias of TRAJINERA_ARCH. 11.05:1. */
export const SURFBOARD_FILL = TRAJINERA_ARCH;
/** Pelican slippers' puffy upper and round toe head, the Little pelican's feathers. Alias of LITTLE_PELICAN_BODY. 11.54:1. */
export const PELICAN_SLIPPER_FILL = LITTLE_PELICAN_BODY;
/** Pelican slippers' closed bill along the toe and the sole (the pelican's orange feet), the Little pelican's bill. Alias of LITTLE_PELICAN_BILL. 9.51:1. */
export const PELICAN_SLIPPER_BILL = LITTLE_PELICAN_BILL;

// ---- Open lake Area 13 Wearable fills (issue #215; all at least 9:1 with ink) ----
// The six trench Wearables: turtle socks, diving goggles, a turtle shell backpack, a lantern tail charm, a mini
// submarine and a diving suit. Each takes one new pale fill, no two alike and none near a shipped colour; the worn
// looks import these names. None equals a BADGE_FILL rarity colour, and none is red. Ratios are fill against ink.

/** Turtle socks, a pale turtle green. 12.15:1. */
export const TURTLE_SOCKS_FILL = '#b8fcc0';
/** Diving goggles' frame band, a pale diving blue. 9.84:1. */
export const DIVING_GOGGLES_FRAME = '#bad8ff';
/** Turtle shell backpack's shell, a pale sandy shell brown. 9.55:1. */
export const TURTLE_SHELL_FILL = '#e4cfba';
/** Lantern tail charm's round glass, a pale glowing aqua, lit softly and never flashing. 12.42:1. */
export const LANTERN_CHARM_FILL = '#9cfffc';
/** Mini submarine's hull, conning tower and periscope, a pale lime yellow. 12.31:1. */
export const MINI_SUBMARINE_FILL = '#f0f396';
/** Diving suit, a pale copper. 9.58:1. */
export const DIVING_SUIT_FILL = '#edccbd';

// ---- Trims, gems and details inside the silhouette (free) -----------------

/** Legendary trim (3e, 6i). */
export const GOLD_TRIM = '#ffc12e';
/** Wizard hat's little stars on the cone, the Legendary gold (never the white star, which is the one Legendary star). Alias of GOLD_TRIM. */
export const WIZARD_HAT_STAR = GOLD_TRIM;
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
/** The Mariachi jacket's turquoise braid, its one trim band (a yellow band would hide on the butter yellow jacket); inside the silhouette, so free. The same hex as the worn jacket's own MARIACHI_BRAID in drawWearables.ts. */
export const MARIACHI_BRAID = '#2fb5a8';
/** The Mariachi jacket's silver studs, pebble A; inside the silhouette, so free (the worn jacket paints them too). */
export const MARIACHI_STUD = PEBBLE_A;

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
 * Tie-dye galaxy, Plum, Chocolate, Glowworm, Confetti shine). 9.07:1 with ink (guide 3f).
 */
export const DREAM_RIM = '#cec9f0';
/** Thin divider between Rainbow and Tie-dye bands. */
export const DREAM_DIVIDER = 'rgba(255,255,255,0.8)';
/** Galaxy and Tie-dye galaxy stars: plain white, no outline, on a dark base. */
export const DREAM_STAR = WHITE;

/** The thirty-five Dream colour ids, in the order the guide lists them (3f). */
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
  | 'moonstone'
  | 'chocolate'
  | 'crystal-shine'
  | 'glowworm'
  | 'jade'
  | 'fiesta-shine'
  | 'olive'
  | 'lantern-shine'
  | 'peach'
  | 'confetti-shine'
  | 'marigold'
  | 'golden-hour-shine'
  | 'lime'
  | 'hyacinth'
  | 'lagoon-shine'
  | 'tule-green'
  | 'obsidian'
  | 'pitch-black'
  | 'trench-shine';

/** The simplified pattern drawn in the paint blob (guide 8). */
export type DreamPattern = 'plain' | 'hearts' | 'spiral' | 'stripes' | 'bands' | 'stars' | 'spiral-stars' | 'glow-dots';

export interface DreamSwatchLook {
  /** Body colour from the 3f table. */
  readonly body: string;
  readonly pattern: DreamPattern;
  /** Pattern colours: heart, spiral bands, stripe pair, rainbow bands, the nebula wash, or glow dot core then halo. */
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
  chocolate: { body: '#6c391d', pattern: 'plain', marks: [], dark: true },
  // Sheen: a white and an aqua stripe, both lighter than the teal body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'crystal-shine': {
    body: '#2f9a9a',
    pattern: 'stripes',
    marks: ['rgba(255,255,255,0.7)', 'rgba(150,250,245,0.75)'],
    dark: false,
  },
  // Glow dots: marks[0] is the dot core, marks[1] its soft halo. Dark body, so the rim light carries the outline.
  glowworm: {
    body: '#101c52',
    pattern: 'glow-dots',
    marks: ['#5ff2d2', 'rgba(95,242,210,0.3)'],
    dark: true,
  },
  jade: { body: '#3ec8a8', pattern: 'plain', marks: [], dark: false },
  // Sheen: a sunny yellow and a turquoise stripe, both lighter than the pink body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'fiesta-shine': {
    body: '#ff78c8',
    pattern: 'stripes',
    marks: ['rgba(255,225,74,0.85)', 'rgba(64,224,208,0.8)'],
    dark: false,
  },
  olive: { body: '#7c8d28', pattern: 'plain', marks: [], dark: false },
  // Sheen: a candle cream and a soft gold stripe, both lighter than the orange body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'lantern-shine': {
    body: '#e07800',
    pattern: 'stripes',
    marks: ['rgba(255,246,204,0.85)', 'rgba(255,214,102,0.8)'],
    dark: false,
  },
  peach: { body: '#ffa9a8', pattern: 'plain', marks: [], dark: false },
  // Dark sheen: a confetti pink and a confetti lemon stripe, both lighter than the grape-violet body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p). Dark body, so the rim light carries the outline.
  'confetti-shine': {
    body: '#6a008a',
    pattern: 'stripes',
    marks: ['rgba(255,128,204,0.85)', 'rgba(255,236,110,0.85)'],
    dark: true,
  },
  marigold: { body: '#ffb736', pattern: 'plain', marks: [], dark: false },
  // Sheen: a sunset rose and a pale gold stripe, both lighter than the deep gold body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'golden-hour-shine': {
    body: '#bea015',
    pattern: 'stripes',
    marks: ['rgba(255,176,196,0.85)', 'rgba(255,240,170,0.85)'],
    dark: false,
  },
  lime: { body: '#8ecb30', pattern: 'plain', marks: [], dark: false },
  hyacinth: { body: '#9b7cef', pattern: 'plain', marks: [], dark: false },
  // Sheen: a sea foam and a coral stripe, both lighter than the lagoon blue body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'lagoon-shine': {
    body: '#5cb7e0',
    pattern: 'stripes',
    marks: ['rgba(214,255,244,0.85)', 'rgba(255,190,176,0.85)'],
    dark: false,
  },
  'tule-green': { body: '#043d00', pattern: 'plain', marks: [], dark: true },
  obsidian: { body: '#1f2925', pattern: 'plain', marks: [], dark: true },
  'pitch-black': { body: '#1a1310', pattern: 'plain', marks: [], dark: true },
  // Sheen: a fading-light gold and a pale sky stripe (the fading light's bulb and hint), both lighter than the lake blue body, so ink reaches 3:1 on them and no pattern inset is needed (guide 6p).
  'trench-shine': {
    body: '#4a7fee',
    pattern: 'stripes',
    marks: ['rgba(242,222,138,0.85)', 'rgba(207,238,255,0.85)'],
    dark: false,
  },
};
