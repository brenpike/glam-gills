/**
 * Treasure icon painters (guide 6i rarity ladder, 7e, 8): the twelve canal
 * Decorations and Wearables, the eleven pond ones (issue #75), the eleven pond
 * Area 3 ones (issue #98), the eleven chinampa Area 4 ones (issue #76), the eleven chinampa Area 5 ones
 * (issue #103), and one Paint shell per Dream colour.
 *
 * Each icon is authored in a 28-unit box centred on (0, 0) and scaled
 * uniformly, so the longest side is `size` with the ink included. A Decoration
 * wider than 80 tank units also has a Home Tank sprite authored on its own
 * width x 80 box (see paintWideDecoration). The ink never
 * scales: item silhouettes 2.8 (`shape`), tubes 3.2 with `ol` 2.4, glasses band
 * 3.5 (colour 1.5 plus 1.0 each side), Paint shell 2.6, small inner details
 * 1.6 to 2.4. Round joins and caps everywhere.
 *
 * Revealed icons are cue objects (guide 10): every fill on the outer silhouette
 * is at least 9:1 with ink (see treasurePalette.ts for the ratios). Trims,
 * gems, stars and patterns are inside the silhouette and may be any colour.
 *
 * Rarity ladder (6i): Common is one flat colour plus one shine. Rare adds one
 * trim band. Epic adds one gem (r 2.5). Legendary adds #ffc12e trim and one
 * static 4-point star (R 3).
 *
 * Flat mode (the unfound-treasure silhouette): every outer silhouette fill and
 * tube colour becomes TREASURE_SILHOUETTE_FILL, every detail inside the
 * silhouette (inner bands, shine, gem, star, stripes, ridges, lens tint, the
 * Paint shell cup and blob) is skipped, and the outer ink is unchanged.
 *
 * Painters are still frames: no time, no randomness, no game state, so each is
 * also the reduced-motion version. Presentational only: no Phaser. Every value
 * is derived (provisional).
 */
import { INK, PEBBLE_A } from './palette';
import { TAU, ell, frameFromBounds, inkMany, line, seg, shape, type Seg, type TexSize } from './canvasKit';
import { roundedPolygon, type Pt } from './drawBadges';
import {
  BOAT_CANOPY,
  BOAT_HULL,
  BOAT_TRIM,
  BOW_FILL,
  BOW_GEM,
  CASTLE_GEM,
  CASTLE_STONE,
  CASTLE_TRIM,
  CASTLE_WINDOW,
  CATTAIL_HEAD,
  CATTAIL_STEM,
  DIVING_TANK_FILL,
  DIVING_TANK_STRAP,
  DRAGONFLY_FRAME,
  DRAGONFLY_WING,
  DREAM_DIVIDER,
  DREAM_RIM,
  DECOY_BEAK,
  DECOY_BODY,
  DREAM_STAR,
  DREAM_SWATCH,
  FEATHER_CAP_FILL,
  FEATHER_FILL,
  FIREFLY_BULB,
  FIREFLY_CAPE_FILL,
  FIREFLY_GLOW,
  FIREFLY_HOOK,
  FIREFLY_JAR_GLASS,
  FIREFLY_JAR_LID,
  FIREFLY_SOCKET,
  FROG_STATUE_STONE,
  FROGGY_BOOT,
  GEM_GLINT,
  GLASSES_FRAME,
  GLASSES_GEM,
  GLASSES_LENS,
  GOLDEN_LOTUS_BASE,
  GOLDEN_LOTUS_PETAL,
  GOLDEN_LOTUS_SEAT,
  FLIPPER_CUFF,
  FLIPPER_FILL,
  FLIPPER_RIDGE,
  GOLD_TRIM,
  HAT_FILL,
  LADYBUG_SHELL,
  LILY_CROWN_FLOWER,
  LILY_CROWN_LEAF,
  LILY_PAD_FILL,
  LILY_PAD_SOCK_FILL,
  LOTUS_LANTERN_BODY,
  LOTUS_PETAL,
  NECKLACE_CORD,
  NECKLACE_SHELL,
  PAINT_SHELL_FILL,
  PAINT_SHELL_RIDGE,
  PEARL_CHARM_CORD,
  PEARL_FILL,
  PLANT_LEAF,
  POND_WEED_SCARF,
  PYRAMID_GEM,
  RAINCOAT_FILL,
  PYRAMID_STONE,
  REED_BUNDLE_STALK,
  SOCK_FILL,
  TANK_TOP_FILL,
  TREASURE_SHINE,
  TREASURE_SILHOUETTE_FILL,
  TREASURE_STAR,
  WATER_LILY_BLOSSOM,
  WATER_LILY_SHIRT_FILL,
  type DreamSwatchId,
} from './treasurePalette';

export type { DreamSwatchId } from './treasurePalette';

// ---------------------------------------------------------------------------
// Chinampa Area 4 fills (issue #76)
// ---------------------------------------------------------------------------
//
// Outer silhouette fills of the eleven chinampa icons, each 9:1 or more with ink (relative luminance 0.607
// or more) and none a rarity badge fill. They live here, next to the painters, because treasurePalette.ts
// is outside this step's file scope; the worn looks of the five chinampa Wearables import these same
// names, never the hex, so icon and worn look cannot drift. Move them to treasurePalette.ts later if
// wanted (the names and values stay). Ratios are fill against ink #2b2350. Aliases of a shipped colour
// say so. Details inside the silhouette (kernel lines, spots) are free and carry no ratio.

/** Clay flowerpot, pale terracotta (a light clay, since the true clay orange fails 9:1). 9.30:1. */
export const CLAY_FLOWERPOT_FILL = '#ffc3a0';
/** Clay flowerpot sprout, the reed leaf green. Alias of PLANT_LEAF. 9.25:1. */
export const CLAY_FLOWERPOT_SPROUT = PLANT_LEAF;
/** Corn husk doll, Scarecrow head and straw hands, a pale husk. 11.35:1. */
export const CORN_HUSK_FILL = '#f6e3b4';
/** Straw sun hat, a pale straw. 10.69:1. */
export const STRAW_HAT_FILL = '#f3dd96';
/** Marigold necklace blossoms, a pale marigold orange (the true marigold fails 9:1). 9.93:1. */
export const MARIGOLD_PETAL = '#ffd06a';
/** Scarecrow shirt, pale ladybug red. Alias of LADYBUG_SHELL. 9.05:1. */
export const SCARECROW_SHIRT = LADYBUG_SHELL;
/** Scarecrow post and arm bar, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const SCARECROW_POST = DECOY_BODY;
/** Scarecrow hat, sun yellow. Alias of HAT_FILL. 11.05:1. */
export const SCARECROW_HAT = HAT_FILL;
/** Papel picado banner, first and every other flag, the lotus lantern pink. Alias of LOTUS_PETAL. 9.90:1. */
export const PAPEL_PICADO_PINK = LOTUS_PETAL;
/** Papel picado banner, the flags between the pink ones, the raincoat's pale apricot. Alias of RAINCOAT_FILL. 9.52:1. */
export const PAPEL_PICADO_APRICOT = RAINCOAT_FILL;
/** Papel picado banner hook rings, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const PAPEL_PICADO_HOOK = FIREFLY_HOOK;
/** Garden overalls, a pale denim periwinkle. 9.46:1. */
export const GARDEN_OVERALLS_FILL = '#bcd2ff';
/** Willow swing fronds, the pond-weed spring green. Alias of POND_WEED_SCARF. 10.40:1. */
export const WILLOW_FROND = POND_WEED_SCARF;
/** Willow swing seat, the decoy's pale carved wood. Alias of DECOY_BODY. 10.59:1. */
export const WILLOW_SEAT = DECOY_BODY;
/** Willow swing hook ring, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const WILLOW_HOOK = FIREFLY_HOOK;
/** Monarch hair clip and Monarch wings, a pale monarch orange (the true monarch orange fails 9:1). 9.25:1. */
export const MONARCH_WING = '#ffc487';
/** Monarch hair clip body and clip bar, and the Monarch wings harness, pebble A. 9.50:1. */
export const MONARCH_BODY = PEBBLE_A;
/** Golden corn kernels, a pale corn gold. 10.53:1. */
export const GOLDEN_CORN_KERNEL = '#ffd966';
/** Golden corn husk leaves, the reed leaf green. Alias of PLANT_LEAF. 9.25:1. */
export const GOLDEN_CORN_HUSK = PLANT_LEAF;
/** Golden corn plinth, pebble C. Alias of GOLDEN_LOTUS_BASE. 10.70:1. */
export const GOLDEN_CORN_BASE = GOLDEN_LOTUS_BASE;
/** Golden corn kernel rows, a darker corn gold; an internal line inside the ear, not ink and not an outer fill. */
export const GOLDEN_CORN_ROW = '#e0a830';
/** Monarch wing spots, a cream white (not the pure white of a gem glint, so a spot is never counted as a gem); internal. */
export const MONARCH_SPOT = '#fff3d6';

// ---------------------------------------------------------------------------
// Chinampa Area 5 fills (issue #103)
// ---------------------------------------------------------------------------
//
// Outer silhouette fills of the eleven Area 5 icons, each 9:1 or more with ink (relative luminance 0.607 or
// more) and none a rarity badge fill. Like the Area 4 fills they live here, next to the painters; the worn
// looks of the six Area 5 Wearables import these same names, never the hex. Ratios are fill against ink
// #2b2350. Aliases of a shipped colour say so. Details inside the silhouette (patterns, embroidery, stripes,
// dots, lenses) are free and carry no ratio.

/** Watering can tin and rose, a pale sky tin (the true tin grey fails 9:1). 10.27:1. */
export const WATERING_CAN_FILL = '#a8e2ff';
/** Floating gourd, a pale bottle-gourd green. 11.71:1. */
export const GOURD_FILL = '#e2f08e';
/** Floating gourd anchor weight, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const GOURD_WEIGHT = FIREFLY_HOOK;
/** Bee headband band, antennae and bobbles, a bee yellow. 11.41:1. */
export const BEE_HEADBAND_FILL = '#ffe566';
/** Bandana, a pale orchid, neither red nor a rarity colour. 9.93:1. */
export const BANDANA_FILL = '#f2c8ff';
/** Bandana dots, a cream white; internal. Alias of MONARCH_SPOT. */
export const BANDANA_DOT = MONARCH_SPOT;
/** Pinata star wedges, the lotus lantern pink. Alias of LOTUS_PETAL. 9.90:1. */
export const PINATA_PINK = LOTUS_PETAL;
/** Pinata star wedges, a pale sky blue. 10.72:1. */
export const PINATA_SKY = '#bfe3ff';
/** Pinata star wedges, the raincoat's pale apricot. Alias of RAINCOAT_FILL. 9.52:1. */
export const PINATA_APRICOT = RAINCOAT_FILL;
/** Pinata hook ring, pebble A. Alias of FIREFLY_HOOK. 9.50:1. */
export const PINATA_HOOK = FIREFLY_HOOK;
/** Sunflower sunglasses frame and sunflower petals, a pale sunflower yellow. 12.10:1. */
export const SUNFLOWER_FRAME = '#ffed7a';
/** The sunflower's centre, a seed brown: an internal detail inside the sunflower's own ink, so free. */
export const SUNFLOWER_CENTRE = '#a8682a';
/** Embroidered shirt, a warm cream blouse. 13.18:1. */
export const EMBROIDERED_SHIRT_FILL = '#fff4dc';
/** The embroidered hem band (the Rare trim band), a teal thread. 9.17:1. */
export const EMBROIDERY_BAND = '#7ee0c8';
/** The five petal threads of the chest flower: pink, orange, yellow, sky and lilac; internal, so free. */
export const EMBROIDERY_PETALS: readonly string[] = ['#ff8fc0', '#ffb347', '#ffe14a', '#7fc4ff', '#a99cff'];
/** Talavera fountain tile white, a pale blue-white glaze. 13.56:1. */
export const TALAVERA_TILE = '#f6f8ff';
/** Talavera fountain water, a pale aqua. 11.51:1. */
export const TALAVERA_WATER = '#c4ecff';
/** Talavera fountain tile blue, a cobalt glaze; internal, so free. */
export const TALAVERA_COBALT = '#3f63c8';
/** Hummingbird tail ribbon, an iridescent mint-teal. 10.57:1. */
export const HUMMINGBIRD_RIBBON_FILL = '#9eecd6';
/** Alebrije statue body and legs, a pale carved-wood orange. 9.35:1. */
export const ALEBRIJE_BODY = '#ffc58f';
/** Alebrije statue wing, a pale turquoise. 10.98:1. */
export const ALEBRIJE_WING = '#9ff0e0';
/** Alebrije statue head, snout and horns, a pale lemon. 12.39:1. */
export const ALEBRIJE_HEAD = '#fff08a';
/** Alebrije statue tail, a pale magenta. 9.74:1. */
export const ALEBRIJE_TAIL = '#ffc2ee';
/** Alebrije statue plinth, pebble C. Alias of GOLDEN_CORN_BASE. 10.70:1. */
export const ALEBRIJE_BASE = GOLDEN_CORN_BASE;
/** Alebrije statue dots and wing lines: magenta, blue, green and violet; internal, so free. */
export const ALEBRIJE_MARKS: readonly string[] = ['#e8359a', '#2f6fe0', '#2fb870', '#8a4fd8'];
/** Rainbow serape cape, a pale sand. 12.77:1. */
export const SERAPE_FILL = '#fff0d0';
/** The Rainbow serape cape's six stripes, left to right: pink, orange, yellow, green, blue and violet, none red; internal, so free. */
export const SERAPE_STRIPES: readonly string[] = ['#ffc6e4', '#ffc487', '#ffe14a', '#a2f58c', '#9fd8ff', '#d8caff'];

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/** The seventeen Dream swatches in guide 3f order (Poppy red, issue #76, Plum, issue #103, then Moonstone, issue #77, last). */
export const DREAM_SWATCH_IDS: readonly DreamSwatchId[] = [
  'mint',
  'sky-blue',
  'lavender',
  'sunset-orange',
  'bubblegum',
  'midnight-blue',
  'hearts',
  'tie-dye',
  'iridescent',
  'rainbow',
  'galaxy',
  'tie-dye-galaxy',
  'lily-green',
  'firefly-gold',
  'poppy-red',
  'plum',
  'moonstone',
];

/**
 * The Decoration and Wearable slugs: the twelve canal ones (the text after `canal/`), then the
 * eleven pond ones and the eleven pond Area 3 ones (the text after `pond/`), then the eleven chinampa
 * Area 4 ones and the eleven chinampa Area 5 ones (the text after `chinampa/`), in catalogue order.
 */
export type TreasureItemSlug =
  | 'pond-plant'
  | 'toy-boat'
  | 'castle-tower'
  | 'sun-pyramid'
  | 'sun-hat'
  | 'shell-necklace'
  | 'heart-glasses'
  | 'golden-bow'
  | 'tank-top'
  | 'diving-tank'
  | 'stripy-socks'
  | 'flippers'
  | 'lily-pad'
  | 'cattail-clump'
  | 'frog-statue'
  | 'lotus-lantern'
  | 'lily-flower-crown'
  | 'pond-weed-scarf'
  | 'dragonfly-glasses'
  | 'raincoat'
  | 'ladybug-backpack'
  | 'rainbow-dragonfly-wings'
  | 'froggy-boots'
  | 'reed-bundle'
  | 'drifting-feather'
  | 'wooden-duck-decoy'
  | 'firefly-string-lights'
  | 'firefly-jar'
  | 'golden-lotus-throne'
  | 'feather-cap'
  | 'lily-pad-socks'
  | 'water-lily-shirt'
  | 'pearl-tail-charm'
  | 'firefly-cape'
  | 'clay-flowerpot'
  | 'corn-husk-doll'
  | 'straw-sun-hat'
  | 'marigold-necklace'
  | 'scarecrow'
  | 'papel-picado-banner'
  | 'garden-overalls'
  | 'willow-swing'
  | 'monarch-hair-clip'
  | 'golden-corn'
  | 'monarch-wings'
  | 'watering-can'
  | 'floating-gourd'
  | 'bee-headband'
  | 'bandana'
  | 'pinata'
  | 'sunflower-sunglasses'
  | 'embroidered-shirt'
  | 'talavera-fountain'
  | 'hummingbird-tail-ribbon'
  | 'alebrije-statue'
  | 'rainbow-serape-cape';

export type TreasureIconSlug = TreasureItemSlug | `paint-shell-${DreamSwatchId}`;

const ITEM_SLUGS: readonly TreasureItemSlug[] = [
  'pond-plant',
  'toy-boat',
  'castle-tower',
  'sun-pyramid',
  'sun-hat',
  'shell-necklace',
  'heart-glasses',
  'golden-bow',
  'tank-top',
  'diving-tank',
  'stripy-socks',
  'flippers',
  'lily-pad',
  'cattail-clump',
  'frog-statue',
  'lotus-lantern',
  'lily-flower-crown',
  'pond-weed-scarf',
  'dragonfly-glasses',
  'raincoat',
  'ladybug-backpack',
  'rainbow-dragonfly-wings',
  'froggy-boots',
  'reed-bundle',
  'drifting-feather',
  'wooden-duck-decoy',
  'firefly-string-lights',
  'firefly-jar',
  'golden-lotus-throne',
  'feather-cap',
  'lily-pad-socks',
  'water-lily-shirt',
  'pearl-tail-charm',
  'firefly-cape',
  'clay-flowerpot',
  'corn-husk-doll',
  'straw-sun-hat',
  'marigold-necklace',
  'scarecrow',
  'papel-picado-banner',
  'garden-overalls',
  'willow-swing',
  'monarch-hair-clip',
  'golden-corn',
  'monarch-wings',
  'watering-can',
  'floating-gourd',
  'bee-headband',
  'bandana',
  'pinata',
  'sunflower-sunglasses',
  'embroidered-shirt',
  'talavera-fountain',
  'hummingbird-tail-ribbon',
  'alebrije-statue',
  'rainbow-serape-cape',
];

/**
 * All seventy-three icon slugs: the twelve canal items, the eleven pond items, the eleven pond Area 3
 * items, the eleven chinampa Area 4 items, the eleven chinampa Area 5 items, then the seventeen Paint shells
 * in Dream order.
 */
export const TREASURE_ICON_SLUGS: readonly TreasureIconSlug[] = [
  ...ITEM_SLUGS,
  ...DREAM_SWATCH_IDS.map((id): TreasureIconSlug => `paint-shell-${id}`),
];

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Design box side at scale 1 (guide 7e: 28 px on the longest side). */
const ICON_BOX = 28;
/** Room around the box for antialiasing. */
const FRAME_PAD = 1;

/** Item silhouette ink (guide 4b, `shape`). */
const ITEM_LW = 2.8;
/** Paint shell ink (guide 4b). */
const SHELL_LW = 2.6;
/** Small parts inside an icon: gems, window, star. */
const DETAIL_LW = 1.6;
/** Thin ink lines on each side of a trim band. */
const BAND_LW = 1.2;
/** Small shells strung on the necklace. */
const SMALL_SHELL_LW = 2;
/** Paint blob ink on the Paint shell. */
const BLOB_LW = 2.4;
/** 4-point star outline (guide 4b, 4e). */
const STAR_LW = 1.6;
/** Tube colour width and outline per side (guide 4b: wearable tubes). */
const TUBE_W = 3.2;
const TUBE_OL = 2.4;
/** Glasses band: colour 1.5 with 1.0 ink each side, 3.5 in all (guide 4b, 6i). */
const GLASSES_W = 1.5;
const GLASSES_OL = 1.0;
/** Gem radius and Legendary star radius (guide 6i). */
const GEM_R = 2.5;
const LEGEND_STAR_R = 3;
/** Paint blob radius at 28 px (guide 7e). */
const BLOB_R = 6;

/** How far the outer ink reaches beyond the fill edge, per icon family. */
const INK_OUT_SHAPE = ITEM_LW / 2;
/** A merged (`blob`) silhouette has all of its ink outside the fill. */
const INK_OUT_BLOB = ITEM_LW;
const INK_OUT_TUBE = TUBE_W / 2 + TUBE_OL;
const INK_OUT_GLASSES = GLASSES_W / 2 + GLASSES_OL;
const INK_OUT_SHELL = SHELL_LW / 2;

/** Diving tank fill height, design units (guide 7e); its blob ink adds INK_OUT_BLOB each side. */
const DIVING_TANK_FILL_H = 25.2;

/** Texture frame for an icon of `size`. Anchor is the icon centre. */
export function treasureIconTextureSize(size: number): TexSize {
  const half = size / 2;
  return frameFromBounds(-half, -half, half, half, FRAME_PAD);
}

/**
 * Lowest fill edge below the icon centre, design units, for the Decorations (guide 7e): the root
 * ellipse of the Pond plant, the hull of the Toy boat, the Castle tower and the Sun pyramid; the
 * mud mound of the Cattail clump and the plinth of the Frog statue (Floor items, anchored at their
 * lowest ink edge); the root tuber of the Lily pad and the tassel bead of the Lotus lantern
 * (Floating items, anchored at the bottom centre of the 80 box, so these two are the box edge).
 * The six Area 3 Decorations (issue #98) all end on the 12.6 edge: the flat foot of the Reed bundle,
 * the Golden lotus throne base, the Firefly jar and the middle bulb of the Firefly string lights (so a
 * Hanging item's icon box edge is its lowest fill edge too), and the quill nib of the Drifting feather
 * and the anchor weight of the Wooden duck decoy (Floating items, so the box edge again).
 * The six chinampa Area 4 Decorations (issue #76) end on the same 12.6 edge: the flat foot of the Clay
 * flowerpot, the Corn husk doll skirt, the Scarecrow post and the Golden corn plinth (Floor items), and the
 * middle flag of the Papel picado banner and the Willow swing seat (Hanging items, so the box edge again).
 * The five chinampa Area 5 Decorations (issue #103) end on the same 12.6 edge: the foot of the Watering can, the
 * Talavera fountain plinth and the Alebrije statue plinth (Floor items), the weight of the Floating gourd (a
 * Floating item, so the box edge) and the lower tips of the Pinata star (a Hanging item).
 */
const DECORATION_FILL_BOTTOM: Readonly<Partial<Record<TreasureIconSlug, number>>> = {
  'pond-plant': 12.3,
  'toy-boat': 11.2,
  'castle-tower': 12.4,
  'sun-pyramid': 11.8,
  'lily-pad': 11.2,
  'cattail-clump': 12.6,
  'frog-statue': 12.6,
  'lotus-lantern': 12.6,
  'reed-bundle': 12.6,
  'drifting-feather': 12.6,
  'wooden-duck-decoy': 12.6,
  'firefly-string-lights': 12.6,
  'firefly-jar': 12.6,
  'golden-lotus-throne': 12.6,
  'clay-flowerpot': 12.6,
  'corn-husk-doll': 12.6,
  scarecrow: 12.6,
  'papel-picado-banner': 12.6,
  'willow-swing': 12.6,
  'golden-corn': 12.6,
  'watering-can': 12.6,
  'floating-gourd': 12.6,
  pinata: 12.6,
  'talavera-fountain': 12.6,
  'alebrije-statue': 12.6,
};

/** How far the outer ink reaches past the fill, for the Decorations whose painter is not a plain `shape`. */
const DECORATION_INK_OUT: Readonly<Partial<Record<TreasureIconSlug, number>>> = {
  'lily-pad': INK_OUT_BLOB,
};

/**
 * Distance from the icon centre (0, 0) down to the lowest ink edge, logical px,
 * for a Decoration of `size`, so a scene can seat it on a floor (base anchor). Other
 * icons return half the size, the bottom of the icon box.
 */
export function decorationBaseOffset(slug: TreasureIconSlug, size: number): number {
  const bottom = DECORATION_FILL_BOTTOM[slug];
  if (bottom === undefined) return size / 2;
  const inkOut = DECORATION_INK_OUT[slug] ?? INK_OUT_SHAPE;
  return bottom * fitScale(size, inkOut) + inkOut;
}

/**
 * Uniform scale that makes the longest side `size` with ink included, given
 * that the 28-unit design box also includes its ink (`inkOut` per side).
 */
function fitScale(size: number, inkOut: number): number {
  return (size - 2 * inkOut) / (ICON_BOX - 2 * inkOut);
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface Pen {
  readonly ctx: CanvasRenderingContext2D;
  /** Geometry scale. Ink widths are never multiplied by it. */
  readonly k: number;
  /** Multiplies the width of pattern marks (spiral bands). Default 1. Never applies to ink. */
  readonly markScale?: number;
  /** Flat silhouette mode: outer fills in TREASURE_SILHOUETTE_FILL, no inner details. Default false. */
  readonly flat?: boolean;
}

/** The fill of an outer silhouette part: `fill`, or TREASURE_SILHOUETTE_FILL in flat mode. */
function outerFill(pen: Pen, fill: string): string {
  return pen.flat ? TREASURE_SILHOUETTE_FILL : fill;
}

/** Paint a detail inside the silhouette (shine, gem, star, ridges, tint); skipped in flat mode. */
function detail(pen: Pen, paint: () => void): void {
  if (!pen.flat) paint();
}

/** An outer silhouette part as a `shape` (fill, then centred ink), filled through {@link outerFill}. */
function outerShape(pen: Pen, body: Path2D, fill: string, lw: number): void {
  shape(pen.ctx, body, outerFill(pen, fill), lw);
}

/** An outer tube of {@link inkMany}, its colour filled through {@link outerFill}. */
function outerSeg(pen: Pen, p: Path2D, w: number, colour: string, ol: number): Seg {
  return seg(p, w, outerFill(pen, colour), ol);
}

/** Copy of `p` placed at (x, y) design units, rotated by `rot`, scaled by `k * scale`. */
function place(p: Path2D, k: number, x = 0, y = 0, rot = 0, scale = 1): Path2D {
  const s = k * scale;
  const out = new Path2D();
  out.addPath(p, { a: s * Math.cos(rot), b: s * Math.sin(rot), c: -s * Math.sin(rot), d: s * Math.cos(rot), e: x * k, f: y * k });
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  ell(p, cx, cy, rx, ry, rot);
  return p;
}

function pts(...xy: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
  return out;
}

/**
 * Fill a silhouette, paint `inner` clipped to it, then stroke the ink on top so
 * inner details never hide the outline.
 */
function silhouette(pen: Pen, body: Path2D, fill: string, lw: number, inner?: () => void): void {
  const { ctx } = pen;
  ctx.fillStyle = outerFill(pen, fill);
  ctx.fill(body);
  if (inner && !pen.flat) {
    ctx.save();
    ctx.clip(body);
    inner();
    ctx.restore();
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke(body);
}

/**
 * One trim band: a coloured strip between two thin ink lines, y0 to y1 in design units. Clipped by the
 * caller. `half` is how far the strip reaches either side of x = 0 (the icon box by default; a wide tank
 * sprite passes its own half width).
 */
function trimBand(pen: Pen, y0: number, y1: number, colour: string, half: number = ICON_BOX): void {
  const { ctx, k } = pen;
  ctx.fillStyle = colour;
  ctx.fillRect(-half * k, y0 * k, 2 * half * k, (y1 - y0) * k);
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  for (const y of [y0, y1]) {
    ctx.beginPath();
    ctx.moveTo(-half * k, y * k);
    ctx.lineTo(half * k, y * k);
    ctx.stroke();
  }
}

/** The one white shine, small, upper left of the object. */
function shine(pen: Pen, x: number, y: number, rx: number, ry: number, rot = 0): void {
  detail(pen, () => {
    pen.ctx.fillStyle = TREASURE_SHINE;
    pen.ctx.fill(ellipse(x * pen.k, y * pen.k, rx * pen.k, ry * pen.k, rot));
  });
}

/** A round gem of radius 2.5 with a small glint. */
function gem(pen: Pen, x: number, y: number, fill: string): void {
  const { ctx, k } = pen;
  detail(pen, () => {
    shape(ctx, ellipse(x * k, y * k, GEM_R * k, GEM_R * k), fill, DETAIL_LW);
    ctx.fillStyle = GEM_GLINT;
    ctx.fill(ellipse((x - 0.8) * k, (y - 0.9) * k, 0.8 * k, 0.5 * k, -0.7));
  });
}

/**
 * Concave 4-point star (guide 4e), outer radius `r` in absolute units (not
 * scaled again), inner 0.38 r, tips rounded by 0.15 r.
 */
function star4Path(cx: number, cy: number, r: number): Path2D {
  const pt: Pt[] = [];
  const radii: number[] = [];
  for (let i = 0; i < 8; i++) {
    const outer = i % 2 === 0;
    const ang = -Math.PI / 2 + (i * TAU) / 8;
    const rr = outer ? r : r * 0.38;
    pt.push({ x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) });
    radii.push(outer ? r * 0.15 : r * 0.08);
  }
  return roundedPolygon(pt, radii);
}

/** The Legendary static 4-point star: white fill, ink 1.6, R 3. */
function legendStar(pen: Pen, x: number, y: number): void {
  detail(pen, () => shape(pen.ctx, star4Path(x * pen.k, y * pen.k, LEGEND_STAR_R * pen.k), TREASURE_STAR, STAR_LW));
}

/** Heart outline of width `w` and height `h` centred on (cx, cy), tip down. */
function heartPath(cx: number, cy: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx, cy - 0.28 * h);
  p.bezierCurveTo(cx - 0.12 * w, cy - 0.5 * h, cx - 0.5 * w, cy - 0.5 * h, cx - 0.5 * w, cy - 0.12 * h);
  p.bezierCurveTo(cx - 0.5 * w, cy + 0.2 * h, cx - 0.15 * w, cy + 0.35 * h, cx, cy + 0.5 * h);
  p.bezierCurveTo(cx + 0.15 * w, cy + 0.35 * h, cx + 0.5 * w, cy + 0.2 * h, cx + 0.5 * w, cy - 0.12 * h);
  p.bezierCurveTo(cx + 0.5 * w, cy - 0.5 * h, cx + 0.12 * w, cy - 0.5 * h, cx, cy - 0.28 * h);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Scallop shell (Paint shell and the necklace shells)
// ---------------------------------------------------------------------------

const SCALLOP_RX = 12.2;
const SCALLOP_RY = 10.2;
const SCALLOP_CY = 0.1;
const SCALLOP_BUMPS = 5;
/** Control offset of each scalloped edge bump beyond the ellipse. */
const SCALLOP_BULGE = 2.2;
const SCALLOP_HINGE = { x: 3.2, y: 10.2 } as const;

/** Point on the scallop's fan arc at parameter t (PI is the left side, 2 PI the right). */
function fanPoint(t: number, rx = SCALLOP_RX, ry = SCALLOP_RY): Pt {
  return { x: rx * Math.cos(t), y: SCALLOP_CY + ry * Math.sin(t) };
}

/**
 * Scallop shell about 25.4 wide and 22.5 tall, hinge at the bottom, five
 * rounded bumps along the top. Centred on (0, 0).
 */
function scallopPath(): Path2D {
  const p = new Path2D();
  const left = fanPoint(Math.PI);
  p.moveTo(-SCALLOP_HINGE.x, SCALLOP_HINGE.y);
  p.quadraticCurveTo(-10.6, 8.2, left.x, left.y);
  for (let i = 0; i < SCALLOP_BUMPS; i++) {
    const t0 = Math.PI + (i * Math.PI) / SCALLOP_BUMPS;
    const t1 = Math.PI + ((i + 1) * Math.PI) / SCALLOP_BUMPS;
    const mid = fanPoint((t0 + t1) / 2, SCALLOP_RX + SCALLOP_BULGE, SCALLOP_RY + SCALLOP_BULGE);
    const end = fanPoint(t1);
    p.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
  }
  p.quadraticCurveTo(10.6, 8.2, SCALLOP_HINGE.x, SCALLOP_HINGE.y);
  p.quadraticCurveTo(0, 12.4, -SCALLOP_HINGE.x, SCALLOP_HINGE.y);
  p.closePath();
  return p;
}

/** Ridge lines from the hinge to the middle of each bump, `count` of them. */
function scallopRidges(count: number, reach: number): Path2D {
  const p = new Path2D();
  const hx = 0;
  const hy = SCALLOP_HINGE.y - 1.8;
  for (let i = 0; i < count; i++) {
    const t = Math.PI + ((i + 0.5) * Math.PI) / count;
    const edge = fanPoint(t);
    p.moveTo(hx, hy);
    p.lineTo(hx + (edge.x - hx) * reach, hy + (edge.y - hy) * reach);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** Leaf: an ellipse that starts at (bx, by) and leans `lean` radians from upright (+ is left). */
function leafPath(bx: number, by: number, len: number, wid: number, lean: number): Path2D {
  const a = len / 2;
  const dx = -Math.sin(lean);
  const dy = -Math.cos(lean);
  return ellipse(bx + a * dx, by + a * dy, a, wid / 2, Math.atan2(dy, dx));
}

/** Common: three rounded leaves fanning from a small root, one shine. */
function paintPondPlant(pen: Pen): void {
  const { k } = pen;
  const root = place(ellipse(0, 10.4, 2.4, 1.9), k);
  outerShape(pen, root, PLANT_LEAF, ITEM_LW);
  const baseY = 9.8;
  const leaves = [
    leafPath(0, baseY, 15.6, 8.4, 0.85),
    leafPath(0, baseY, 15.6, 8.4, -0.85),
    leafPath(0, baseY, 21, 8.8, 0),
  ];
  for (const leaf of leaves) outerShape(pen, place(leaf, k), PLANT_LEAF, ITEM_LW);
  shine(pen, -2.3, -4.8, 0.9, 3.0, 0.1);
}

/** Rare: a little trajinera boat, pink hull with one yellow trim band and a rounded white canopy. */
function paintToyBoat(pen: Pen): void {
  const { k } = pen;
  const canopy = roundedPolygon(pts(-7.4, 0.4, -7.4, -10.2, 7.4, -10.2, 7.4, 0.4), [0, 6, 6, 0]);
  outerShape(pen, place(canopy, k), BOAT_CANOPY, ITEM_LW);
  const hullPath = new Path2D();
  hullPath.moveTo(-12.3, -2.4);
  hullPath.quadraticCurveTo(-11.2, 0.4, -7.8, 0.4);
  hullPath.lineTo(7.8, 0.4);
  hullPath.quadraticCurveTo(11.2, 0.4, 12.3, -2.4);
  hullPath.lineTo(10, 9.4);
  hullPath.quadraticCurveTo(9.7, 11.2, 8, 11.2);
  hullPath.lineTo(-8, 11.2);
  hullPath.quadraticCurveTo(-9.7, 11.2, -10, 9.4);
  hullPath.closePath();
  silhouette(pen, place(hullPath, k), BOAT_HULL, ITEM_LW, () => trimBand(pen, 4.2, 7.6, BOAT_TRIM));
  shine(pen, -4.4, -6.4, 1.0, 2.4, 0.2);
}

/** Epic: rounded tower, rounded crenellations, a round window, one trim band, one gem. */
function paintCastleTower(pen: Pen): void {
  const { ctx, k } = pen;
  const pt = pts(
    -8.2, 12.4, -8.2, -2.4, -10.4, -2.4, -10.4, -12.4, -6.0, -12.4, -6.0, -7.6, -2.2, -7.6, -2.2, -12.4,
    2.2, -12.4, 2.2, -7.6, 6.0, -7.6, 6.0, -12.4, 10.4, -12.4, 10.4, -2.4, 8.2, -2.4, 8.2, 12.4,
  );
  const radii = [2.4, 0.9, 1, 1.4, 1.4, 0.9, 0.9, 1.4, 1.4, 0.9, 0.9, 1.4, 1.4, 1, 0.9, 2.4];
  const body = place(roundedPolygon(pt, radii), k);
  silhouette(pen, body, CASTLE_STONE, ITEM_LW, () => trimBand(pen, 0, 3.6, CASTLE_TRIM));
  detail(pen, () => shape(ctx, place(ellipse(0, 8.6, 2.3, 2.3), k), CASTLE_WINDOW, DETAIL_LW));
  gem(pen, 0, 1.8, CASTLE_GEM);
  shine(pen, -5.4, 7.2, 0.9, 2.3);
}

/** Legendary: stepped rounded pyramid, gold trim band, one gem, one 4-point star. */
function paintSunPyramid(pen: Pen): void {
  const pt = pts(
    -12, 11.8, -12, 4.6, -8.6, 4.6, -8.6, -2, -5.2, -2, -5.2, -8.8, 5.2, -8.8, 5.2, -2, 8.6, -2, 8.6, 4.6, 12,
    4.6, 12, 11.8,
  );
  const radii = [2.4, 1.6, 1, 1.6, 1, 1.8, 1.8, 1, 1.6, 1, 1.6, 2.4];
  const body = place(roundedPolygon(pt, radii), pen.k);
  silhouette(pen, body, PYRAMID_STONE, ITEM_LW, () => trimBand(pen, 6.8, 10.2, GOLD_TRIM));
  gem(pen, 0, -5.2, PYRAMID_GEM);
  shine(pen, -5.8, 1.2, 0.9, 1.9);
  legendStar(pen, 9.8, -9.2);
}

/** Common: wide-brim rounded sun hat, one shine. */
function paintSunHat(pen: Pen): void {
  const { k } = pen;
  outerShape(pen, place(ellipse(0, 5.6, 12.4, 4.6, 0), k), HAT_FILL, ITEM_LW);
  const crown = new Path2D();
  crown.moveTo(-7.6, 4.8);
  crown.bezierCurveTo(-8.2, -2, -6.2, -9.6, 0, -9.6);
  crown.bezierCurveTo(6.2, -9.6, 8.2, -2, 7.6, 4.8);
  crown.quadraticCurveTo(0, 8.6, -7.6, 4.8);
  crown.closePath();
  outerShape(pen, place(crown, k), HAT_FILL, ITEM_LW);
  shine(pen, -3.4, -4.6, 1.0, 2.6, 0.3);
}

/** Rare: an open loop of cord (second colour, the trim) with three small shells strung at the bottom. */
function paintShellNecklace(pen: Pen): void {
  const { ctx, k } = pen;
  const cy = -4.4;
  const rx = 7.6;
  const ry = 7.4;
  const cord = new Path2D();
  cord.ellipse(0, cy, rx, ry, 0, Math.PI / 2 - 2.3, Math.PI / 2 + 2.3);
  inkMany(ctx, [outerSeg(pen, place(cord, k), TUBE_W, NECKLACE_CORD, TUBE_OL)]);
  const fan = scallopPath();
  const ridges = scallopRidges(3, 0.8);
  const scale = 0.44;
  // Shells sit on the loop at the bottom and 40 degrees either side, fan pointing outward.
  for (const a of [-0.7, 0.7, 0]) {
    const px = rx * Math.sin(a);
    const py = cy + ry * Math.cos(a);
    const nx = Math.sin(a) / rx;
    const ny = Math.cos(a) / ry;
    const len = Math.hypot(nx, ny);
    const rot = Math.atan2(nx / len, -ny / len);
    const x = px + (nx / len) * 3.8;
    const y = py + (ny / len) * 3.8;
    outerShape(pen, place(fan, k, x, y, rot, scale), NECKLACE_SHELL, SMALL_SHELL_LW);
    detail(pen, () => {
      ctx.strokeStyle = PAINT_SHELL_RIDGE;
      ctx.lineWidth = 1.2;
      ctx.stroke(place(ridges, k, x, y, rot, scale));
    });
  }
}

/** Epic: two heart-shaped lens frames joined, clear lenses, one gem at the bridge. */
function paintHeartGlasses(pen: Pen): void {
  const { ctx, k } = pen;
  const left = place(heartPath(-6.3, 0.3, 11.6, 12.4), k);
  const right = place(heartPath(6.3, 0.3, 11.6, 12.4), k);
  detail(pen, () => {
    ctx.fillStyle = GLASSES_LENS;
    ctx.fill(left);
    ctx.fill(right);
  });
  inkMany(ctx, [
    outerSeg(pen, left, GLASSES_W, GLASSES_FRAME, GLASSES_OL),
    outerSeg(pen, right, GLASSES_W, GLASSES_FRAME, GLASSES_OL),
  ]);
  shine(pen, -9.2, -2.6, 0.8, 1.9, 0.4);
  gem(pen, 0, -1.6, GLASSES_GEM);
}

/** A vertical trim band between two thin ink lines, x0 to x1 in design units. Clipped by the caller. */
function trimBandX(pen: Pen, x0: number, x1: number, colour: string): void {
  const { ctx, k } = pen;
  ctx.fillStyle = colour;
  ctx.fillRect(x0 * k, -ICON_BOX * k, (x1 - x0) * k, 2 * ICON_BOX * k);
  ctx.strokeStyle = INK;
  ctx.lineWidth = BAND_LW;
  for (const x of [x0, x1]) {
    ctx.beginPath();
    ctx.moveTo(x * k, -ICON_BOX * k);
    ctx.lineTo(x * k, ICON_BOX * k);
    ctx.stroke();
  }
}

/** One piece of a merged silhouette (see {@link mergedSilhouette}). */
interface Piece {
  readonly path: Path2D;
  readonly fill: string;
  readonly inner?: () => void;
}

/**
 * A group of overlapping pieces drawn as one inked shape with no line across
 * the joints (the `blob` technique, guide 4c): all the ink first at twice the
 * width, then every fill. The visible ink is `lw` wide, all outside the fills.
 */
function mergedSilhouette(pen: Pen, pieces: readonly Piece[], lw: number): void {
  const { ctx } = pen;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * lw;
  for (const piece of pieces) ctx.stroke(piece.path);
  for (const piece of pieces) {
    ctx.fillStyle = outerFill(pen, piece.fill);
    ctx.fill(piece.path);
    if (piece.inner && !pen.flat) {
      ctx.save();
      ctx.clip(piece.path);
      piece.inner();
      ctx.restore();
    }
  }
}

/** Legendary: two rounded loops, two short tails, gold trim, one gem, one 4-point star. */
function paintGoldenBow(pen: Pen): void {
  const { k } = pen;
  const mirror = (xy: number[]): number[] => xy.map((v, i) => (i % 2 === 0 ? -v : v));
  const tailL = [-1.2, 1.2, -10.2, 7.2, -6.4, 10.6, 1.2, 4.6];
  const loopL = [-1, -1.6, -10.8, -8.2, -10.9, 2.6, -1, 0.4];
  const pieces: Piece[] = [];
  for (const xy of [tailL, mirror(tailL)]) {
    pieces.push({
      path: place(roundedPolygon(pts(...xy), [1, 2.2, 2.2, 1]), k),
      fill: BOW_FILL,
      inner: () => trimBand(pen, 6.8, 9, GOLD_TRIM),
    });
  }
  for (const [lo, hi, xy] of [
    [-8.6, -6.2, loopL],
    [6.2, 8.6, mirror(loopL)],
  ] as const) {
    pieces.push({
      path: place(roundedPolygon(pts(...xy), [1.2, 3.6, 3.6, 1.2]), k),
      fill: BOW_FILL,
      inner: () => trimBandX(pen, lo, hi, GOLD_TRIM),
    });
  }
  pieces.push({ path: place(ellipse(0, -0.4, 3.2, 3.6), k), fill: BOW_FILL });
  mergedSilhouette(pen, pieces, ITEM_LW);
  gem(pen, 0, -0.4, BOW_GEM);
  shine(pen, -5.4, -4.4, 1.6, 0.7, 0.55);
  legendStar(pen, 0, -10.2);
}

/**
 * Common: one merged `shape` silhouette (2.8): a body with two rounded straps, a neck
 * scoop cut between the straps and an armhole notch cut at each side. One shine.
 */
function paintTankTop(pen: Pen): void {
  const { k } = pen;
  const body = new Path2D();
  const strapCapR = 2.2;
  const scoopCy = -10.6;
  const scoopR = 5.2;
  const holeCx = 10;
  const holeCy = -4.6;
  const holeR = 3.4;
  const strapOut = 9.6;
  // Where the straight strap edge meets the armhole circle.
  const holeDy = Math.sqrt(holeR * holeR - (holeCx - strapOut) ** 2);
  const holeTop = holeCy - holeDy;
  // Angle of that meeting point seen from the right and from the left armhole centre.
  const rightEdge = Math.atan2(-holeDy, strapOut - holeCx);
  const leftEdge = Math.atan2(-holeDy, holeCx - strapOut);
  body.moveTo(-strapOut, -10.4);
  body.arc(-7.4, -10.4, strapCapR, Math.PI, TAU, false);
  body.lineTo(-5.2, scoopCy);
  body.arc(0, scoopCy, scoopR, Math.PI, 0, true);
  body.lineTo(5.2, -10.4);
  body.arc(7.4, -10.4, strapCapR, Math.PI, TAU, false);
  body.lineTo(strapOut, holeTop);
  body.arc(holeCx, holeCy, holeR, rightEdge, Math.PI / 2 - TAU, true);
  body.lineTo(holeCx, 8);
  body.arcTo(holeCx, 12.6, holeCx - 4.6, 12.6, 4.6);
  body.arcTo(-holeCx, 12.6, -holeCx, 8, 4.6);
  body.lineTo(-holeCx, holeCy + holeR);
  body.arc(-holeCx, holeCy, holeR, Math.PI / 2, leftEdge, true);
  body.closePath();
  outerShape(pen, place(body, k), TANK_TOP_FILL, ITEM_LW);
  shine(pen, -5, 2.6, 0.9, 2.6, 0.1);
}

/**
 * Common: one merged `shape` silhouette (2.8) of an upright leg, a round heel and a
 * foot to the right. Three stripes at ink alpha 0.30, clipped to the leg. One shine.
 */
function paintStripySocks(pen: Pen): void {
  const { ctx, k } = pen;
  const sock = new Path2D();
  sock.moveTo(-8.4 + 1.6, -12.6);
  sock.arcTo(3.6, -12.6, 3.6, -12.6 + 1.6, 1.6);
  sock.lineTo(3.6, 3.6 - 1.5);
  sock.arcTo(3.6, 3.6, 3.6 + 1.5, 3.6, 1.5);
  sock.lineTo(8.1, 3.6);
  sock.arc(8.1, 8.1, 4.5, -Math.PI / 2, Math.PI / 2, false);
  sock.lineTo(-8.4 + 5, 12.6);
  sock.arcTo(-8.4, 12.6, -8.4, 12.6 - 5, 5);
  sock.lineTo(-8.4, -12.6 + 1.6);
  sock.arcTo(-8.4, -12.6, -8.4 + 1.6, -12.6, 1.6);
  sock.closePath();
  silhouette(pen, place(sock, k), SOCK_FILL, ITEM_LW, () => {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = INK;
    for (const y of [-8.8, -5, -1.2]) ctx.fillRect(-9 * k, (y - 1.1) * k, 13 * k, 2.2 * k);
    ctx.globalAlpha = 1;
  });
  shine(pen, -4.8, -9.6, 0.9, 2.2, 0.1);
}

/**
 * Rare: one merged `blob` silhouette (2.8, all outside the fill) of an upright capsule
 * tank, a valve neck and a valve knob, with one yellow strap band. One shine.
 * The fill is 25.2 tall and the blob ink adds 2.8 each side, so it is scaled to the
 * whole 28-unit box rather than by `fitScale`, which would leave the ink outside it.
 */
function paintDivingTank(pen: Pen): void {
  const { k } = pen;
  const capsule = roundedPolygon(pts(-6.4, -8.2, 6.4, -8.2, 6.4, 12.6, -6.4, 12.6), 6.4);
  const neck = roundedPolygon(pts(-2.6, -12.6, 2.6, -12.6, 2.6, -6, -2.6, -6), [1.4, 1.4, 0, 0]);
  const pieces: Piece[] = [
    { path: place(capsule, k), fill: DIVING_TANK_FILL, inner: () => trimBand(pen, 0.6, 4.2, DIVING_TANK_STRAP) },
    { path: place(neck, k), fill: DIVING_TANK_FILL },
    { path: place(ellipse(4.4, -10.4, 2.2, 2.2), k), fill: DIVING_TANK_FILL },
  ];
  mergedSilhouette(pen, pieces, ITEM_LW);
  shine(pen, -3.4, -3.6, 0.9, 2.4, 0.1);
}

/**
 * Rare: one merged `shape` silhouette (2.8) of a flipper pointing up: an ankle block
 * widening to a rounded fan. One pink cuff band, three internal fan ridges. One shine.
 */
function paintFlippers(pen: Pen): void {
  const { ctx, k } = pen;
  const flipper = roundedPolygon(
    pts(-4.2, 12.6, 4.2, 12.6, 4.2, 5.6, 12.4, -5, 12.4, -12.6, -12.4, -12.6, -12.4, -5, -4.2, 5.6),
    [1.2, 1.2, 0.8, 1.5, 6, 6, 1.5, 0.8],
  );
  silhouette(pen, place(flipper, k), FLIPPER_FILL, ITEM_LW, () => {
    trimBand(pen, 6.4, 9.6, FLIPPER_CUFF);
    const ridges = new Path2D();
    for (const [x, y] of [
      [-7, -7],
      [0, -9],
      [7, -7],
    ]) {
      ridges.moveTo(0, 3 * k);
      ridges.lineTo(x * k, y * k);
    }
    ctx.strokeStyle = FLIPPER_RIDGE;
    ctx.lineWidth = 1.6;
    ctx.stroke(ridges);
  });
  shine(pen, -7.4, -6.4, 0.9, 2.4, 0.4);
}

// ---------------------------------------------------------------------------
// Pond items (issue #75)
// ---------------------------------------------------------------------------
//
// The same ladder and ink as the canal items. Every outer fill is one of the
// pond fills of treasurePalette.ts (9:1 or more with ink); internal details
// reuse existing palette values, and no new colour is introduced.

/** The pale grey-lilac of the ladybug head and the wing harness: pebble A, 9.50:1 with ink. */
const POND_NEUTRAL_FILL = PEBBLE_A;

/** Floating Decorations (guide 7e): the waterline is this far below the top of the 80 px tank box. */
const FLOAT_WATERLINE_PX = 20;
/** The tank box of a Decoration, logical px. */
const FLOAT_BOX_PX = 80;

/** Design y of the waterline of a Floating icon whose painter has `inkOut` of outer ink per side. */
function waterlineY(inkOut: number): number {
  return (FLOAT_WATERLINE_PX - FLOAT_BOX_PX / 2) / fitScale(FLOAT_BOX_PX, inkOut);
}

/**
 * A pointed petal from (bx, by), `deg` degrees off straight up (+ is right), `len` long and `wid`
 * wide at the middle.
 */
function pointedPetal(bx: number, by: number, deg: number, len: number, wid: number): Path2D {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const mx = bx + (dx * len) / 2;
  const my = by + (dy * len) / 2;
  const p = new Path2D();
  p.moveTo(bx, by);
  p.quadraticCurveTo(mx - dy * wid, my + dx * wid, bx + dx * len, by + dy * len);
  p.quadraticCurveTo(mx + dy * wid, my - dx * wid, bx, by);
  p.closePath();
  return p;
}

/**
 * A blossom of outer radius `r` centred on (cx, cy): five round petals round a centre, one pointing up,
 * outlined as one shape (round lobes with a cusp between them, never a star).
 */
function blossomPath(cx: number, cy: number, r: number): Path2D {
  const petals = 5;
  const reach = 0.55 * r;
  const radius = 0.45 * r;
  const p = new Path2D();
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    let rr = 0;
    for (let j = 0; j < petals; j++) {
      // Where a ray at angle `a` leaves the round petal centred `reach` out at angle `phi`.
      const delta = a - (j * TAU) / petals;
      const across = reach * Math.sin(delta);
      if (Math.abs(across) <= radius) rr = Math.max(rr, reach * Math.cos(delta) + Math.sqrt(radius * radius - across * across));
    }
    // Angle 0 is up: x = sin, y = -cos.
    const x = cx + rr * Math.sin(a);
    const y = cy - rr * Math.cos(a);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/**
 * A tapering root: a ribbon along a quadratic curve from (x0, y0) to (x1, y1) through (cx, cy), `w0` wide
 * at the start and `w1` wide at the end.
 */
function rootRibbon(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number): Path2D {
  const steps = 14;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const len = Math.hypot(dx, dy);
    const half = (w0 + (w1 - w0) * t) / 2;
    left.push({ x: x - (dy / len) * half, y: y + (dx / len) * half });
    right.push({ x: x + (dy / len) * half, y: y - (dx / len) * half });
  }
  const p = new Path2D();
  const outline = [...left, ...right.reverse()];
  p.moveTo(outline[0].x, outline[0].y);
  for (const { x, y } of outline.slice(1)) p.lineTo(x, y);
  p.closePath();
  return p;
}

/**
 * Common, Floating: one merged `blob` silhouette (2.8, all outside the fill) of a flat pad with a wedge
 * notch on the right, centred on the waterline 20 below the top of the 80 box, and two thin tapering
 * roots hanging below it. All one green. One shine on the pad. The longest root is the lowest fill edge.
 */
function paintLilyPad(pen: Pen): void {
  const { k } = pen;
  const wy = waterlineY(INK_OUT_BLOB);
  const notch = 0.75;
  const start = 0.2;
  const pad = new Path2D();
  pad.moveTo(0, wy);
  pad.ellipse(0, wy, 11.2, 4.4, 0, start, start + TAU - notch);
  pad.closePath();
  const pieces: Piece[] = [
    { path: place(rootRibbon(-1.6, wy + 2, -4.2, 2.4, -2.4, 11.2, 2.4, 0), k), fill: LILY_PAD_FILL },
    { path: place(rootRibbon(3.6, wy + 2, 6.4, 3.4, 4.8, 8, 2, 0), k), fill: LILY_PAD_FILL },
    { path: place(pad, k), fill: LILY_PAD_FILL },
  ];
  mergedSilhouette(pen, pieces, ITEM_LW);
  shine(pen, -4.6, wy - 1.2, 2.4, 0.75, -0.08);
}

/** One cattail standing at the origin: a stem `len` tall (5.2 wide) under a head 6.4 wide and 10.4 tall. */
function cattailParts(len: number): { readonly stem: Path2D; readonly head: Path2D } {
  return {
    stem: roundedPolygon(pts(-2.6, 0, 2.6, 0, 2.6, -len, -2.6, -len), 2.6),
    head: roundedPolygon(pts(-3.2, -len, 3.2, -len, 3.2, 10.4 - len, -3.2, 10.4 - len), 3.2),
  };
}

/**
 * Common, Floor: three cattails (green stems, tan heads) leaning out of a flat mud mound, one shine on
 * the tallest head. The mound is the lowest fill edge.
 */
function paintCattailClump(pen: Pen): void {
  const { k } = pen;
  const baseY = 10.6;
  const cattails = [
    { x: -5, rot: -0.22, len: 17 },
    { x: 5.2, rot: 0.24, len: 15.4 },
    { x: 0, rot: 0, len: 23.2 },
  ];
  for (const { x, rot, len } of cattails) {
    const { stem, head } = cattailParts(len);
    outerShape(pen, place(stem, k, x, baseY, rot), CATTAIL_STEM, ITEM_LW);
    outerShape(pen, place(head, k, x, baseY, rot), CATTAIL_HEAD, ITEM_LW);
  }
  outerShape(pen, place(ellipse(0, 10.8, 9, 1.8), k), CATTAIL_STEM, ITEM_LW);
  shine(pen, -0.9, -8.4, 0.6, 2.2, 0.05);
}

/**
 * Rare, Floor: a stone frog sitting on a plinth. Two eye bumps and a round body in pale mossy stone, one
 * yellow trim band across the plinth, ink pupils and a smile, one shine. The plinth is the lowest fill edge.
 */
function paintFrogStatue(pen: Pen): void {
  const { ctx, k } = pen;
  const plinth = roundedPolygon(pts(-11, 12.6, -11, 6, 11, 6, 11, 12.6), [1.6, 1.2, 1.2, 1.6]);
  silhouette(pen, place(plinth, k), FROG_STATUE_STONE, ITEM_LW, () => trimBand(pen, 8.6, 11, BOAT_TRIM));
  for (const x of [-5.2, 5.2]) outerShape(pen, place(ellipse(x, -9.2, 3.4, 3.4), k), FROG_STATUE_STONE, ITEM_LW);
  outerShape(pen, place(ellipse(0, -0.2, 9.8, 7.2), k), FROG_STATUE_STONE, ITEM_LW);
  detail(pen, () => {
    ctx.fillStyle = INK;
    for (const x of [-5.2, 5.2]) ctx.fill(place(ellipse(x, -9.8, 1, 1), k));
    const smile = new Path2D();
    smile.moveTo(-3.8, 0.4);
    smile.quadraticCurveTo(0, 3.8, 3.8, 0.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(smile, k));
  });
  shine(pen, -5.8, -1.4, 0.9, 2.2, 0.3);
}

/**
 * Epic, Floating: a lotus lantern: four pink petals cupping a glowing yellow egg body, a pink cord and
 * bead hanging below. One pink band round the egg, on the waterline 20 below the top of the 80 box, one
 * aqua gem below it, one shine. The bead is the lowest fill edge.
 */
function paintLotusLantern(pen: Pen): void {
  const { ctx, k } = pen;
  const wy = waterlineY(INK_OUT_SHAPE);
  inkMany(ctx, [outerSeg(pen, place(line(0, 3.2, 0, 8.4), k), TUBE_W, LOTUS_PETAL, TUBE_OL)]);
  outerShape(pen, place(ellipse(0, 10.2, 2.4, 2.4), k), LOTUS_PETAL, ITEM_LW);
  const petals: readonly (readonly [number, number, number])[] = [
    [-68, 12.4, 6.4],
    [68, 12.4, 6.4],
    [-36, 12.6, 6],
    [36, 12.6, 6],
  ];
  for (const [deg, len, wid] of petals) {
    outerShape(pen, place(pointedPetal(0, 2.6, deg, len, wid), k), LOTUS_PETAL, ITEM_LW);
  }
  silhouette(pen, place(ellipse(0, -4.4, 5.6, 8.2), k), LOTUS_LANTERN_BODY, ITEM_LW, () =>
    trimBand(pen, wy - 1.1, wy + 1.1, CASTLE_TRIM),
  );
  gem(pen, 0, -1.2, CASTLE_GEM);
  shine(pen, -1.8, -9.6, 0.7, 1.2, 0.25);
}

/**
 * Common: an open wreath (a green tube, ink 3.2 with 2.4 outline, open at the bottom) with three blush
 * six-lobed blossoms pinned to its upper half. One shine on the top blossom.
 */
function paintLilyFlowerCrown(pen: Pen): void {
  const { ctx, k } = pen;
  const ring = new Path2D();
  ring.ellipse(0, 0, 10, 10, 0, Math.PI / 2 + 0.55, Math.PI / 2 + TAU - 0.55);
  inkMany(ctx, [outerSeg(pen, place(ring, k), TUBE_W, LILY_CROWN_LEAF, TUBE_OL)]);
  for (const [x, y] of [
    [-6.2, -3.6],
    [0, -7],
    [6.2, -3.6],
  ]) {
    outerShape(pen, place(blossomPath(x, y, 3.4), k), LILY_CROWN_FLOWER, ITEM_LW);
  }
  shine(pen, -0.9, -7.4, 0.55, 1.1, 0.4);
}

/**
 * Common: a green scarf draped in a sagging band, with two forked tails hanging from it, all one colour
 * in `shape` 2.8. One shine on the band.
 */
function paintPondWeedScarf(pen: Pen): void {
  const { k } = pen;
  const tailL = roundedPolygon(pts(-5.6, -5, 0.8, -5, 0.8, 8.4, -2.4, 5.4, -5.6, 8.4), [1, 1, 1.4, 1, 1.4]);
  const tailR = roundedPolygon(pts(2.4, -5, 9, -5, 9, 12.6, 5.7, 9.4, 2.4, 12.6), [1, 1, 1.4, 1, 1.4]);
  const drape = new Path2D();
  drape.moveTo(-12.6, -10.4);
  drape.bezierCurveTo(-8, -10.4, -6, -5.4, 0, -5.4);
  drape.bezierCurveTo(6, -5.4, 8, -10.4, 12.6, -10.4);
  drape.lineTo(12.6, -4.6);
  drape.bezierCurveTo(8, -4.6, 6, 0.6, 0, 0.6);
  drape.bezierCurveTo(-6, 0.6, -8, -4.6, -12.6, -4.6);
  drape.closePath();
  for (const body of [tailL, tailR, drape]) outerShape(pen, place(body, k), POND_WEED_SCARF, ITEM_LW);
  shine(pen, -7.6, -6.8, 1.8, 0.7, 0.35);
}

/**
 * Rare: two tilted oval lens frames (band colour 1.5 in pale aqua with 1.0 ink each side, 3.5 in all), like
 * a dragonfly's wings, joined by an arched yellow bridge (the one trim band, colour 2.6 with 1.0 ink each
 * side). Clear lens tint, one shine.
 */
function paintDragonflyGlasses(pen: Pen): void {
  const { ctx, k } = pen;
  const left = place(ellipse(-6.9, 0.8, 5.6, 4, 0.5), k);
  const right = place(ellipse(6.9, 0.8, 5.6, 4, -0.5), k);
  const bridge = new Path2D();
  bridge.moveTo(-2.4, -0.2);
  bridge.quadraticCurveTo(0, -3.8, 2.4, -0.2);
  detail(pen, () => {
    ctx.fillStyle = GLASSES_LENS;
    ctx.fill(left);
    ctx.fill(right);
  });
  inkMany(ctx, [
    outerSeg(pen, left, GLASSES_W, DRAGONFLY_FRAME, GLASSES_OL),
    outerSeg(pen, right, GLASSES_W, DRAGONFLY_FRAME, GLASSES_OL),
    outerSeg(pen, place(bridge, k), 2.6, BOAT_TRIM, GLASSES_OL),
  ]);
  shine(pen, -9, -1.2, 0.8, 1.6, 0.5);
}

/**
 * Rare: a hooded raincoat in `shape` 2.8: a hood dome over a T-shaped coat with two sleeves, one yellow
 * hem band, a zip line down the front. One shine.
 */
function paintRaincoat(pen: Pen): void {
  const { ctx, k } = pen;
  outerShape(pen, place(ellipse(0, -8.4, 6.6, 4.2), k), RAINCOAT_FILL, ITEM_LW);
  const coat = roundedPolygon(
    pts(-5, -8.2, 5, -8.2, 12.4, -5, 12.4, 5, 6.6, 5, 6.6, 12.6, -6.6, 12.6, -6.6, 5, -12.4, 5, -12.4, -5),
    [1.6, 1.6, 3, 2, 1, 3, 3, 1, 2, 3],
  );
  silhouette(pen, place(coat, k), RAINCOAT_FILL, ITEM_LW, () => {
    trimBand(pen, 8.4, 10.8, BOAT_TRIM);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(line(0, -7, 0, 13), k));
  });
  shine(pen, -9.2, -1.6, 0.9, 2.4, 0.1);
}

/**
 * Epic: a ladybug backpack in `shape` 2.8: a round pale-red shell with a small pale head peeking above it,
 * a yellow pocket band, a centre seam, four ink spots and one aqua gem on the seam. One shine.
 */
function paintLadybugBackpack(pen: Pen): void {
  const { ctx, k } = pen;
  outerShape(pen, place(ellipse(0, -9, 5, 3.6), k), POND_NEUTRAL_FILL, ITEM_LW);
  silhouette(pen, place(ellipse(0, 2.8, 11.4, 9.8), k), LADYBUG_SHELL, ITEM_LW, () => {
    trimBand(pen, 8.4, 10.8, BOAT_TRIM);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(line(0, -8, 0, 13), k));
    ctx.fillStyle = INK;
    for (const [x, y] of [
      [-6.4, 1.2],
      [6.4, 1.2],
      [-5.2, 5.4],
      [5.2, 5.4],
    ]) {
      ctx.fill(place(ellipse(x, y, 1.5, 1.5), k));
    }
  });
  gem(pen, 0, 1.6, CASTLE_GEM);
  shine(pen, -6.2, -4, 0.9, 2.2, 0.55);
}

/** Radii of the four rainbow arcs in a wing, from the wing root, design units. */
const WING_ARCS_UPPER = [4.2, 5.8, 7.4, 9] as const;
const WING_ARCS_LOWER = [3.4, 4.8, 6.2, 7.6] as const;

/**
 * Legendary: two pairs of pale sky wings (an upper and a lower on each side, `shape` 2.8) swept out from a
 * small harness, each crossed by four concentric rainbow arcs. One gold band on the harness, one pink gem
 * where the wings meet, one 4-point star above, one shine.
 */
function paintRainbowDragonflyWings(pen: Pen): void {
  const { ctx, k } = pen;
  const marks = DREAM_SWATCH.rainbow.marks;
  const arcs = [marks[0], marks[1], marks[3], marks[4]];
  const wing = (s: 1 | -1, rootY: number, theta: number, half: number, wid: number, radii: readonly number[]): void => {
    const rootX = s * 2;
    const centre = ellipse(rootX + s * half * Math.cos(theta), rootY + half * Math.sin(theta), half, wid, s * theta);
    silhouette(pen, place(centre, k), DRAGONFLY_WING, ITEM_LW, () => {
      ctx.lineWidth = 1.4;
      radii.forEach((r, i) => {
        ctx.strokeStyle = arcs[i];
        ctx.stroke(place(ellipse(rootX, rootY, r, r), k));
      });
    });
  };
  for (const s of [-1, 1] as const) wing(s, 2, 0.5, 5.2, 3.7, WING_ARCS_LOWER);
  for (const s of [-1, 1] as const) wing(s, -0.2, -0.62, 6, 4.4, WING_ARCS_UPPER);
  const harness = roundedPolygon(pts(-3.2, -4.6, 3.2, -4.6, 3.2, 6.6, -3.2, 6.6), 2.4);
  silhouette(pen, place(harness, k), POND_NEUTRAL_FILL, ITEM_LW, () => trimBand(pen, 2.6, 4.8, GOLD_TRIM));
  gem(pen, 0, -1.2, BOW_GEM);
  shine(pen, -8.6, -6, 2, 0.7, 0.62);
  legendStar(pen, 0, -10);
}

/**
 * Legendary: one froggy boot in `shape` 2.8: a minty boot with two frog-eye bumps on the toe (ink pupils),
 * a gold cuff band, one pink gem on the shaft and a 4-point star above the toe. One shine.
 */
function paintFroggyBoots(pen: Pen): void {
  const { ctx, k } = pen;
  for (const x of [6.6, 9.4]) outerShape(pen, place(ellipse(x, 0.8, 3.2, 3.2), k), FROGGY_BOOT, ITEM_LW);
  const boot = roundedPolygon(pts(-9, -12.6, 2, -12.6, 2, 4.4, 12.4, 4.4, 12.4, 12.6, -9, 12.6), [1.8, 1.8, 1.2, 4, 4.6, 2]);
  silhouette(pen, place(boot, k), FROGGY_BOOT, ITEM_LW, () => trimBand(pen, -9.2, -6.6, GOLD_TRIM));
  detail(pen, () => {
    ctx.fillStyle = INK;
    for (const x of [6.6, 9.4]) ctx.fill(place(ellipse(x, 0, 1, 1), k));
  });
  gem(pen, -3.6, -1.8, PYRAMID_GEM);
  shine(pen, -6.4, -4.8, 0.8, 2, 0.1);
  legendStar(pen, 8.4, -8.4);
}

// ---------------------------------------------------------------------------
// Pond Area 3 items (issue #98)
// ---------------------------------------------------------------------------
//
// The same ladder and ink as the canal and pond items. Every outer fill is one of the Area 3 fills of
// treasurePalette.ts (9:1 or more with ink), which the worn looks of the five Wearables import too.
// Shape carries the meaning: stalks tied with a band, a notched quill, a duck on a cord, bulbs on a
// swag, a lidded jar, a petal throne, a cap with a plume, a sock with a pad mark, a shirt with a
// blossom, a pearl on a chain, a cape with glowing dots.

/** The lowest fill edge of every Area 3 Decoration, design units below the icon centre. */
const AREA3_FOOT_Y = 12.6;

/**
 * Common, Floor: a sheaf of four straw reed stalks tied round the waist with one band, flaring out above
 * the tie (tips pointed) and a little below it, the feet cut flat on one line. One colour and one shine.
 * The feet are the lowest fill edge.
 */
function paintReedBundle(pen: Pen): void {
  const { k } = pen;
  const waistY = 2.9;
  // [foot x, waist x, tip x, tip y] of each stalk, back to front.
  const stalks: readonly (readonly [number, number, number, number])[] = [
    [-7.4, -2.6, -7.8, -9.2],
    [7.4, 2.6, 7.6, -8],
    [2.8, 0.9, 2.6, -12.6],
    [-2.8, -0.9, -2.8, -14.18],
  ];
  for (const [fx, wx, tx, ty] of stalks) {
    const stalk = roundedPolygon(
      pts(
        fx - 2.1, AREA3_FOOT_Y, wx - 2.1, waistY, tx - 2.1, ty + 6.5, tx, ty,
        tx + 2.1, ty + 6.5, wx + 2.1, waistY, fx + 2.1, AREA3_FOOT_Y,
      ),
      [0.8, 1, 1.2, 0.7, 1.2, 1, 0.8],
    );
    outerShape(pen, place(stalk, k), REED_BUNDLE_STALK, ITEM_LW);
  }
  const tie = roundedPolygon(pts(-6.4, 1.2, 6.4, 1.2, 6.4, 4.6, -6.4, 4.6), 1.6);
  outerShape(pen, place(tie, k), REED_BUNDLE_STALK, ITEM_LW);
  shine(pen, -3.2, -4.4, 0.7, 2.4, -0.1);
}

/** Length of the Drifting feather, quill nib to tip, design units. */
const FEATHER_LEN = 29.5;

/** A feather standing at the origin, the quill nib at (0, 0) and the tip at (0, -FEATHER_LEN), one split in the right vane. */
function featherPath(): Path2D {
  const p = new Path2D();
  const len = FEATHER_LEN;
  p.moveTo(0, -4);
  p.bezierCurveTo(-3.8, -0.27 * len, -7.4, -0.58 * len, 0, -len);
  p.bezierCurveTo(4.6, -0.84 * len, 7.4, -0.6 * len, 6, -0.49 * len);
  p.lineTo(2.8, -0.42 * len);
  p.lineTo(6.4, -0.34 * len);
  p.bezierCurveTo(6, -0.22 * len, 3.4, -0.14 * len, 0, -4);
  p.closePath();
  return p;
}

/**
 * Common, Floating: a feather leaning on the water, a bold ink quill stub dipped below the waterline and
 * the tip in the air, a split in one vane and a thin ink quill line. One pale colour and one shine. The
 * stub end is the lowest edge, the box edge of the 80 box.
 */
function paintDriftingFeather(pen: Pen): void {
  const { ctx, k } = pen;
  const rot = 0.55;
  const x0 = -7.4;
  const y0 = AREA3_FOOT_Y;
  ctx.strokeStyle = INK;
  ctx.lineWidth = ITEM_LW;
  ctx.stroke(place(line(0, 0, 0, -6), k, x0, y0, rot));
  silhouette(pen, place(featherPath(), k, x0, y0, rot), FEATHER_FILL, ITEM_LW, () => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(line(0, -4, 0, -FEATHER_LEN + 2.4), k, x0, y0, rot));
  });
  // The shine sits on the left vane, in the feather's own frame.
  const lx = -2.6;
  const ly = -0.6 * FEATHER_LEN;
  const wx = x0 + lx * Math.cos(rot) - ly * Math.sin(rot);
  const wy = y0 + lx * Math.sin(rot) + ly * Math.cos(rot);
  shine(pen, wx, wy, 0.8, 2.6, rot);
}

/**
 * Rare, Floating: a carved wooden duck sitting on the water with a yellow beak, an upturned tail and an ink
 * eye, one yellow band across its body, a wavy ink anchor cord and a round anchor weight hanging below. One
 * shine. The weight is the lowest fill edge, the box edge of the 80 box.
 */
function paintWoodenDuckDecoy(pen: Pen): void {
  const { ctx, k } = pen;
  const bodyY = waterlineY(INK_OUT_SHAPE) + 2.4;
  const headR = 3.1;
  const headX = 6.2;
  const headY = -AREA3_FOOT_Y + headR;
  const weightR = 1.7;
  const weightY = AREA3_FOOT_Y - weightR;
  const cord = new Path2D();
  cord.moveTo(-0.6, bodyY + 3);
  cord.bezierCurveTo(-4.2, 3.4, 3.2, 5.6, -0.6, weightY - weightR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(cord, k));
  outerShape(pen, place(ellipse(-0.6, weightY, weightR, weightR), k), DECOY_BODY, ITEM_LW);
  const tail = roundedPolygon(pts(-7.8, bodyY - 1.6, -12.4, bodyY - 6.2, -11, bodyY + 1.8), [1, 1.2, 1]);
  outerShape(pen, place(tail, k), DECOY_BODY, ITEM_LW);
  silhouette(pen, place(ellipse(-0.6, bodyY, 9.8, 4.6), k), DECOY_BODY, ITEM_LW, () =>
    trimBand(pen, bodyY - 1.1, bodyY + 0.9, BOAT_TRIM),
  );
  const beak = roundedPolygon(pts(headX + 1.6, headY - 1.7, 13, headY + 0.2, headX + 1.6, headY + 1.7), [0.8, 1, 0.8]);
  outerShape(pen, place(beak, k), DECOY_BEAK, ITEM_LW);
  outerShape(pen, place(ellipse(headX, headY, headR, headR), k), DECOY_BODY, ITEM_LW);
  detail(pen, () => {
    ctx.fillStyle = INK;
    ctx.fill(place(ellipse(headX + 0.9, headY - 0.6, 0.8, 0.8), k));
  });
  shine(pen, -5.6, bodyY - 2.4, 1.8, 0.7, -0.2);
}

/**
 * Rare, Hanging: a thin ink wire swagged between two hook rings with three round glowing bulbs hanging
 * from pink sockets, the one trim. One shine on the middle bulb. The middle bulb is the lowest fill edge.
 * Authored in the 28 box for the icon; the 144 wide tank sprite is a wider swag of the same parts.
 */
function paintFireflyStringLights(pen: Pen): void {
  const { ctx, k } = pen;
  const endX = 10.8;
  const endY = -10.2;
  const ctrlX = 7.2;
  const ctrlY = 7.667;
  const at = (t: number): { x: number; y: number } => {
    const u = 1 - t;
    return {
      x: -endX * (u ** 3 + t ** 3 * -1) + 3 * u * u * t * -ctrlX + 3 * u * t * t * ctrlX,
      y: (u ** 3 + t ** 3) * endY + 3 * u * t * (u + t) * ctrlY,
    };
  };
  const wire = new Path2D();
  wire.moveTo(-endX, endY);
  wire.bezierCurveTo(-ctrlX, ctrlY, ctrlX, ctrlY, endX, endY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(wire, k));
  for (const x of [-endX, endX]) {
    shape(ctx, place(ellipse(x, endY, 1.8, 1.8), k), outerFill(pen, FIREFLY_HOOK), DETAIL_LW);
  }
  const socketW = 1.9;
  const socketH = 2.2;
  for (const [t, r] of [
    [0.2, 3],
    [0.8, 3],
    [0.5, 3.6],
  ] as const) {
    const { x, y } = at(t);
    const socket = roundedPolygon(pts(x - socketW, y, x + socketW, y, x + socketW, y + socketH, x - socketW, y + socketH), 0.6);
    shape(ctx, place(socket, k), outerFill(pen, FIREFLY_SOCKET), DETAIL_LW);
    outerShape(pen, place(ellipse(x, y + socketH + r, r, r), k), FIREFLY_BULB, ITEM_LW);
  }
  const mid = at(0.5);
  shine(pen, mid.x - 1.4, mid.y + socketH + 2.4, 0.7, 1.3, 0.2);
}

/**
 * Epic, Hanging: a glass jar on a pale wood lid with a hook ring, three glowing fireflies (an ink body in a
 * yellow glow) inside, one aqua gem on the lid and one glass shine. The flat jar base is the lowest fill edge.
 */
function paintFireflyJar(pen: Pen): void {
  const { ctx, k } = pen;
  shape(ctx, place(ellipse(0, -11.3, 1.3, 1.3), k), outerFill(pen, FIREFLY_HOOK), DETAIL_LW);
  const body = new Path2D();
  body.moveTo(-4.6, -2.4);
  body.lineTo(4.6, -2.4);
  body.bezierCurveTo(10.6, -1.6, 10.8, 2.4, 10.8, 5.6);
  body.lineTo(10.8, 8.6);
  body.bezierCurveTo(10.8, 11.6, 9.4, AREA3_FOOT_Y, 6.8, AREA3_FOOT_Y);
  body.lineTo(-6.8, AREA3_FOOT_Y);
  body.bezierCurveTo(-9.4, AREA3_FOOT_Y, -10.8, 11.6, -10.8, 8.6);
  body.lineTo(-10.8, 5.6);
  body.bezierCurveTo(-10.8, 2.4, -10.6, -1.6, -4.6, -2.4);
  body.closePath();
  silhouette(pen, place(body, k), FIREFLY_JAR_GLASS, ITEM_LW, () => {
    for (const [x, y] of [
      [-4.2, 3.4],
      [4.6, 0.8],
      [1, 8.4],
    ]) {
      ctx.fillStyle = FIREFLY_GLOW;
      ctx.fill(place(ellipse(x, y, 2.9, 2.9), k));
      ctx.fillStyle = INK;
      ctx.fill(place(ellipse(x, y, 1.1, 0.9), k));
    }
  });
  const lid = roundedPolygon(pts(-5.8, -5.2, 5.8, -5.2, 5.8, -2.4, -5.8, -2.4), 1.2);
  outerShape(pen, place(lid, k), FIREFLY_JAR_LID, ITEM_LW);
  gem(pen, 0, -6.9, CASTLE_GEM);
  shine(pen, -7.2, 2.6, 0.9, 3.2, 0.05);
}

/**
 * Legendary, Floor: a throne of pale gold lotus petals, five fanning behind a pink cushion on a stone base
 * with one gold band, one aqua-pink gem on the tall petal and one 4-point star. One shine. The base is the
 * lowest fill edge.
 */
function paintGoldenLotusThrone(pen: Pen): void {
  const { k } = pen;
  const petals: readonly (readonly [number, number, number])[] = [
    [-64, 12, 5.6],
    [64, 12, 5.6],
    [-34, 12.6, 5.6],
    [34, 12.6, 5.6],
    [0, 17.2, 8],
  ];
  for (const [deg, len, wid] of petals) {
    outerShape(pen, place(pointedPetal(0, 4.6, deg, len, wid), k), GOLDEN_LOTUS_PETAL, ITEM_LW);
  }
  const base = roundedPolygon(pts(-8.6, AREA3_FOOT_Y, -7.4, 6.8, 7.4, 6.8, 8.6, AREA3_FOOT_Y), [1.8, 1.4, 1.4, 1.8]);
  silhouette(pen, place(base, k), GOLDEN_LOTUS_BASE, ITEM_LW, () => trimBand(pen, 9, 11.2, GOLD_TRIM));
  outerShape(pen, place(ellipse(0, 4.8, 8.6, 2.7), k), GOLDEN_LOTUS_SEAT, ITEM_LW);
  gem(pen, 0, -5.6, PYRAMID_GEM);
  shine(pen, -1.9, -8.4, 0.8, 2.2, 0.2);
  legendStar(pen, 9.8, -9.8);
}

/**
 * Common: a sky-blue beanie with a rolled cuff and a pale feather plume tucked into the right side of the
 * cuff and sweeping up past the dome, an ink quill line down the plume. One shine.
 */
function paintFeatherCap(pen: Pen): void {
  const { ctx, k } = pen;
  silhouette(pen, place(pointedPetal(3.2, 3, 30, 17.4, 7.4), k), FEATHER_FILL, ITEM_LW, () => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(line(3.2, 3, 11, -10.6), k));
  });
  const dome = new Path2D();
  dome.moveTo(-12.2, 4);
  dome.bezierCurveTo(-12.8, -3.6, -8.2, -8.6, -2.2, -8.6);
  dome.bezierCurveTo(3.8, -8.6, 7.8, -3.6, 7.4, 4);
  dome.closePath();
  outerShape(pen, place(dome, k), FEATHER_CAP_FILL, ITEM_LW);
  const cuff = roundedPolygon(pts(-12.6, 2.6, 8.6, 2.6, 8.6, 8.6, -12.6, 8.6), 2.6);
  outerShape(pen, place(cuff, k), FEATHER_CAP_FILL, ITEM_LW);
  shine(pen, -6.8, -3.8, 1, 2.6, 0.3);
}

/** A lily pad of radius `r` at (cx, cy) with a wedge notch on the right, as a single path. */
function notchedPadPath(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  const notch = 0.75;
  const start = 0.2;
  p.moveTo(cx, cy);
  p.ellipse(cx, cy, r, r * 0.78, 0, start, start + TAU - notch);
  p.closePath();
  return p;
}

/**
 * Common: one `shape` silhouette (2.8) of an upright leg, a round heel and a foot to the right, as the Stripy
 * socks, in pale pad green with two notched lily-pad marks (ink at alpha 0.30), clipped to the sock. One shine.
 */
function paintLilyPadSocks(pen: Pen): void {
  const { ctx, k } = pen;
  const sock = new Path2D();
  sock.moveTo(-8.4 + 1.6, -12.6);
  sock.arcTo(3.6, -12.6, 3.6, -12.6 + 1.6, 1.6);
  sock.lineTo(3.6, 3.6 - 1.5);
  sock.arcTo(3.6, 3.6, 3.6 + 1.5, 3.6, 1.5);
  sock.lineTo(8.1, 3.6);
  sock.arc(8.1, 8.1, 4.5, -Math.PI / 2, Math.PI / 2, false);
  sock.lineTo(-8.4 + 5, 12.6);
  sock.arcTo(-8.4, 12.6, -8.4, 12.6 - 5, 5);
  sock.lineTo(-8.4, -12.6 + 1.6);
  sock.arcTo(-8.4, -12.6, -8.4 + 1.6, -12.6, 1.6);
  sock.closePath();
  silhouette(pen, place(sock, k), LILY_PAD_SOCK_FILL, ITEM_LW, () => {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = INK;
    ctx.fill(place(notchedPadPath(-2.4, -3.6, 4.2), k));
    ctx.fill(place(notchedPadPath(-1.6, 7.6, 3.2), k));
    ctx.globalAlpha = 1;
  });
  shine(pen, -5.4, -9.8, 0.9, 2.2, 0.1);
}

/**
 * Rare: a short-sleeved shirt in `shape` 2.8 in pale water blue with an ink neck scoop, a blush white
 * five-petal water-lily blossom on the chest and one yellow hem band. One shine.
 */
function paintWaterLilyShirt(pen: Pen): void {
  const { ctx, k } = pen;
  const shirt = roundedPolygon(
    pts(-4.4, -12.4, 4.4, -12.4, 11.2, -9.6, 12.6, -3.2, 8.4, -1.6, 8.4, 12.6, -8.4, 12.6, -8.4, -1.6, -12.6, -3.2, -11.2, -9.6),
    [1.4, 1.4, 1.8, 1.6, 1, 2, 2, 1, 1.6, 1.8],
  );
  silhouette(pen, place(shirt, k), WATER_LILY_SHIRT_FILL, ITEM_LW, () => {
    trimBand(pen, 8.8, 11.2, BOAT_TRIM);
    const scoop = new Path2D();
    scoop.ellipse(0, -12.4, 4.4, 3.6, 0, 0, Math.PI);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(scoop, k));
  });
  detail(pen, () => {
    shape(ctx, place(blossomPath(0, 1.2, 5.6), k), WATER_LILY_BLOSSOM, DETAIL_LW);
    ctx.fillStyle = BOAT_TRIM;
    ctx.fill(place(ellipse(0, 1.2, 1.2, 1.2), k));
  });
  shine(pen, -6.6, -6.6, 0.8, 2.2, 0.15);
}

/**
 * Epic: a large pearl on a short chain under one aqua gem, with two pink ribbon tails hanging from it. One
 * shine on the pearl.
 */
function paintPearlTailCharm(pen: Pen): void {
  const { k } = pen;
  for (const deg of [-160, 160]) {
    outerShape(pen, place(pointedPetal(0, 6, deg, 7, 3.2), k), PEARL_CHARM_CORD, ITEM_LW);
  }
  const chain = roundedPolygon(pts(-1.2, -8, 1.2, -8, 1.2, -4.6, -1.2, -4.6), 0.6);
  outerShape(pen, place(chain, k), PEARL_CHARM_CORD, ITEM_LW);
  outerShape(pen, place(ellipse(0, 0.4, 6.4, 6.4), k), PEARL_FILL, ITEM_LW);
  gem(pen, 0, -9.8, CASTLE_GEM);
  shine(pen, -2.4, -2.4, 1, 2, 0.5);
}

/**
 * Legendary: a flowing cape in pale night periwinkle with shoulders, a neck scoop, a scalloped hem, a gold band
 * above the hem, one pink gem at the clasp, four glowing dots (a yellow glow round an ink body) and one 4-point star. One shine.
 */
function paintFireflyCape(pen: Pen): void {
  const { ctx, k } = pen;
  const cape = new Path2D();
  cape.moveTo(-7.4, -11.8);
  cape.quadraticCurveTo(0, -7.6, 7.4, -11.8);
  cape.bezierCurveTo(10.4, -6, 12.4, 2, 12.4, 10.4);
  cape.quadraticCurveTo(8.27, 14.8, 4.13, 10.4);
  cape.quadraticCurveTo(0, 14.8, -4.13, 10.4);
  cape.quadraticCurveTo(-8.27, 14.8, -12.4, 10.4);
  cape.bezierCurveTo(-12.4, 2, -10.4, -6, -7.4, -11.8);
  cape.closePath();
  silhouette(pen, place(cape, k), FIREFLY_CAPE_FILL, ITEM_LW, () => {
    trimBand(pen, 5.8, 8.6, GOLD_TRIM);
    for (const [x, y] of [
      [-6.4, -0.4],
      [6, -3.4],
      [-2.2, 2.2],
      [4.4, 2.4],
    ]) {
      ctx.fillStyle = FIREFLY_GLOW;
      ctx.fill(place(ellipse(x, y, 2.2, 2.2), k));
      ctx.fillStyle = INK;
      ctx.fill(place(ellipse(x, y, 0.8, 0.7), k));
    }
  });
  gem(pen, 0, -5.4, BOW_GEM);
  shine(pen, -7.2, -5.2, 0.8, 2.4, 0.2);
  legendStar(pen, 9.8, -9.8);
}

// ---------------------------------------------------------------------------
// Chinampa Area 4 items (issue #76)
// ---------------------------------------------------------------------------
//
// The same ladder and ink as the earlier icons. Every outer fill is one of the chinampa fills above (9:1 or
// more with ink); the five Wearables' worn looks import the same names. Shape carries the meaning: a pot
// with a sprout, a faceless husk doll with an arm bar, a post figure in a hat, bunting with a zigzag hem, a
// swing under willow fronds, an ear of corn on a plinth, a flat-crowned straw hat, a loop of blossoms,
// overalls with a bib and two legs, a butterfly on a clip, and a pair of butterfly wings.

/** Mirror a flat [x, y, ...] list across x = 0. */
function mirrorX(xy: readonly number[]): number[] {
  return xy.map((v, i) => (i % 2 === 0 ? -v : v));
}

/**
 * Common, Floor: a pale terracotta pot (a tapering body under a wider rim) with a green sprout of three
 * leaves. Two colours, one shine. The pot foot is the lowest fill edge.
 */
function paintClayFlowerpot(pen: Pen): void {
  const { k } = pen;
  for (const [lean, len] of [
    [0.8, 10.2],
    [-0.8, 10.2],
    [0, 11.2],
  ] as const) {
    outerShape(pen, place(leafPath(0, -1.2, len, 5.6, lean), k), CLAY_FLOWERPOT_SPROUT, ITEM_LW);
  }
  const body = roundedPolygon(pts(-8.6, 2, 8.6, 2, 6.2, 12.6, -6.2, 12.6), [0, 0, 2.4, 2.4]);
  outerShape(pen, place(body, k), CLAY_FLOWERPOT_FILL, ITEM_LW);
  const rim = roundedPolygon(pts(-10.2, -1.4, 10.2, -1.4, 10.2, 3.4, -10.2, 3.4), 1.6);
  outerShape(pen, place(rim, k), CLAY_FLOWERPOT_FILL, ITEM_LW);
  shine(pen, -4.6, 7.8, 0.9, 2.4, 0.15);
}

/**
 * Common, Floor: a faceless corn husk doll in one pale husk colour: a round head over a small bodice with
 * two slanted arms, a waist tie and a flared bell skirt with a flat hem. One shine. The skirt hem is the
 * lowest fill edge.
 */
function paintCornHuskDoll(pen: Pen): void {
  const { k } = pen;
  const skirt = roundedPolygon(pts(-3.6, 1.2, 3.6, 1.2, 10.4, 12.6, -10.4, 12.6), [1.2, 1.2, 2.2, 2.2]);
  outerShape(pen, place(skirt, k), CORN_HUSK_FILL, ITEM_LW);
  for (const s of [-1, 1]) {
    outerShape(pen, place(ellipse(s * 6.6, -2.6, 5.4, 2, s * 0.62), k), CORN_HUSK_FILL, ITEM_LW);
  }
  const bodice = roundedPolygon(pts(-3.8, -6.2, 3.8, -6.2, 3.2, 2, -3.2, 2), 1.2);
  outerShape(pen, place(bodice, k), CORN_HUSK_FILL, ITEM_LW);
  const tie = roundedPolygon(pts(-4.4, 0.4, 4.4, 0.4, 4.4, 3.2, -4.4, 3.2), 1.2);
  outerShape(pen, place(tie, k), CORN_HUSK_FILL, ITEM_LW);
  outerShape(pen, place(ellipse(0, -9, 3.6, 3.6), k), CORN_HUSK_FILL, ITEM_LW);
  shine(pen, -5, 8, 0.8, 2.4, 0.22);
}

/**
 * Rare, Floor: a scarecrow on a post: a wooden post and arm bar with a straw tuft at each hand, a pale red
 * shirt with one yellow band, a husk head with two ink eyes and a stitched smile under a yellow straw hat.
 * One shine. The post foot is the lowest fill edge.
 */
function paintScarecrow(pen: Pen): void {
  const { ctx, k } = pen;
  const post = roundedPolygon(pts(-1.8, -4, 1.8, -4, 1.8, 12.6, -1.8, 12.6), [0.8, 0.8, 1, 1]);
  outerShape(pen, place(post, k), SCARECROW_POST, ITEM_LW);
  const arms = roundedPolygon(pts(-9.2, -3.8, 9.2, -3.8, 9.2, -0.6, -9.2, -0.6), 1.4);
  outerShape(pen, place(arms, k), SCARECROW_POST, ITEM_LW);
  for (const s of [-1, 1]) {
    for (const deg of [74, 106]) {
      outerShape(pen, place(pointedPetal(s * 8.2, -2.2, s * deg, 4.4, 3.2), k), CORN_HUSK_FILL, ITEM_LW);
    }
  }
  const shirt = roundedPolygon(pts(-5.4, -4.4, 5.4, -4.4, 7, 7.4, -7, 7.4), [1.8, 1.8, 1.4, 1.4]);
  silhouette(pen, place(shirt, k), SCARECROW_SHIRT, ITEM_LW, () => trimBand(pen, 2.4, 4.8, BOAT_TRIM));
  outerShape(pen, place(ellipse(0, -6.4, 3.5, 3.5), k), CORN_HUSK_FILL, ITEM_LW);
  detail(pen, () => {
    ctx.fillStyle = INK;
    for (const x of [-1.4, 1.4]) ctx.fill(place(ellipse(x, -6.6, 0.6, 0.6), k));
    const smile = new Path2D();
    smile.moveTo(-1.6, -4.7);
    smile.quadraticCurveTo(0, -3.7, 1.6, -4.7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = BAND_LW;
    ctx.stroke(place(smile, k));
  });
  outerShape(pen, place(ellipse(0, -9.4, 7, 1.9), k), SCARECROW_HAT, ITEM_LW);
  const crown = roundedPolygon(pts(-3.8, -9.2, -3.2, -12.6, 3.2, -12.6, 3.8, -9.2), [0.6, 1.6, 1.6, 0.6]);
  outerShape(pen, place(crown, k), SCARECROW_HAT, ITEM_LW);
  shine(pen, -3.6, 0.2, 0.7, 1.6, 0.12);
}

/** Papel picado flag colours, left to right: pink, apricot, pink, apricot. */
const PAPEL_FLAG_FILLS = [PAPEL_PICADO_PINK, PAPEL_PICADO_APRICOT] as const;

/**
 * A paper flag hanging from its top edge at (cx, top): `w` wide and `len` long, the hem cut into `teeth`
 * zigzag teeth `toothH` deep. The lowest point is `top + len`.
 */
function paperFlagPath(cx: number, top: number, w: number, len: number, teeth: number, toothH: number): Path2D {
  const half = w / 2;
  const bottom = top + len;
  const step = w / (2 * teeth);
  const points: Pt[] = [
    { x: cx - half, y: top },
    { x: cx + half, y: top },
  ];
  const radii: number[] = [0.6, 0.6];
  for (let i = 0; i <= 2 * teeth; i++) {
    points.push({ x: cx + half - i * step, y: i % 2 === 0 ? bottom : bottom - toothH });
    radii.push(i % 2 === 0 ? 0.7 : 0.5);
  }
  return roundedPolygon(points, radii);
}

/** Paper flag width and length in the 28 box, and its hem. */
const PAPEL_FLAG_W = 6.2;
const PAPEL_FLAG_LEN = 9.4;

/**
 * Rare, Hanging: a thin ink wire swagged between two hook rings (pebble A) with three paper flags hanging
 * from it, each a pale pink or apricot with a zigzag hem and one yellow band just under the wire (the one
 * trim, at the same offset on every flag). One shine on the left flag. The middle flag is the lowest fill
 * edge. Authored in the 28 box for the icon; the 144 wide tank sprite is a wider swag of the same parts.
 */
function paintPapelPicadoBanner(pen: Pen): void {
  const { ctx, k } = pen;
  const endX = 10.8;
  const endY = -10.2;
  const ctrlX = 7.2;
  const ctrlY = 7.667;
  const at = (t: number): { x: number; y: number } => {
    const u = 1 - t;
    return { x: -endX * (u ** 3 - t ** 3) + 3 * u * t * (t - u) * ctrlX, y: (u ** 3 + t ** 3) * endY + 3 * u * t * ctrlY };
  };
  const wire = new Path2D();
  wire.moveTo(-endX, endY);
  wire.bezierCurveTo(-ctrlX, ctrlY, ctrlX, ctrlY, endX, endY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(wire, k));
  for (const x of [-endX, endX]) {
    shape(ctx, place(ellipse(x, endY, 1.8, 1.8), k), outerFill(pen, PAPEL_PICADO_HOOK), DETAIL_LW);
  }
  [0.2, 0.5, 0.8].forEach((t, i) => {
    const { x, y } = at(t);
    const flag = place(paperFlagPath(x, y, PAPEL_FLAG_W, PAPEL_FLAG_LEN, 2, 2.2), k);
    silhouette(pen, flag, PAPEL_FLAG_FILLS[i % 2], ITEM_LW, () => trimBand(pen, y + 1.4, y + 3.2, BOAT_TRIM));
  });
  const left = at(0.2);
  shine(pen, left.x - 1.2, left.y + 5.2, 0.6, 1.4, 0.1);
}

/**
 * Epic, Hanging: a swing under a weeping willow: a pebble A hook ring on top, five pale willow fronds hanging
 * from it like a skirt, two thin ink ropes to a pale wood seat, one aqua gem on the seat. One shine on the
 * seat. The seat is the lowest fill edge.
 */
function paintWillowSwing(pen: Pen): void {
  const { ctx, k } = pen;
  const ropes = new Path2D();
  for (const s of [-1, 1]) {
    ropes.moveTo(s * 1.4, -9.2);
    ropes.lineTo(s * 6.4, 7.6);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(ropes, k));
  for (const [deg, len, wid] of [
    [-116, 9.6, 4],
    [116, 9.6, 4],
    [-154, 16.4, 4],
    [154, 16.4, 4],
  ] as const) {
    outerShape(pen, place(pointedPetal(0, -9.2, deg, len, wid), k), WILLOW_FROND, ITEM_LW);
  }
  shape(ctx, place(ellipse(0, -11.3, 1.3, 1.3), k), outerFill(pen, WILLOW_HOOK), DETAIL_LW);
  const seat = roundedPolygon(pts(-9.6, 7, 9.6, 7, 9.6, 12.6, -9.6, 12.6), 2);
  outerShape(pen, place(seat, k), WILLOW_SEAT, ITEM_LW);
  gem(pen, 0, 9.8, CASTLE_GEM);
  shine(pen, -5.8, 8.8, 1.6, 0.6, 0);
}

/** An ear of corn standing at the origin: a spindle from the tip at (0, -12.6) to the base at (0, 8.6). */
function cornEarPath(): Path2D {
  const p = new Path2D();
  p.moveTo(0, -12.6);
  p.bezierCurveTo(3.6, -11.6, 5.7, -7.2, 5.6, -2);
  p.bezierCurveTo(5.5, 3, 4.6, 6.4, 0, 8.6);
  p.bezierCurveTo(-4.6, 6.4, -5.5, 3, -5.6, -2);
  p.bezierCurveTo(-5.7, -7.2, -3.6, -11.6, 0, -12.6);
  p.closePath();
  return p;
}

/**
 * Legendary, Floor: an ear of golden corn (a pale gold spindle with kernel rows) between two green husk
 * leaves, standing on a stone plinth with one gold band, one pink gem on the ear and one 4-point star. One
 * shine. The plinth is the lowest fill edge.
 */
function paintGoldenCorn(pen: Pen): void {
  const { ctx, k } = pen;
  silhouette(pen, place(cornEarPath(), k), GOLDEN_CORN_KERNEL, ITEM_LW, () => {
    const rows = new Path2D();
    for (const x of [-2.8, 0, 2.8]) {
      rows.moveTo(x, -13);
      rows.lineTo(x, 9);
    }
    for (const y of [-9, -6, -3, 0, 3, 6]) {
      rows.moveTo(-7, y);
      rows.lineTo(7, y);
    }
    ctx.strokeStyle = GOLDEN_CORN_ROW;
    ctx.lineWidth = 1;
    ctx.stroke(place(rows, k));
  });
  for (const deg of [-18, 18]) {
    outerShape(pen, place(pointedPetal(0, 7.8, deg, 11.6, 4.2), k), GOLDEN_CORN_HUSK, ITEM_LW);
  }
  const plinth = roundedPolygon(pts(-8.4, 12.6, -7, 8, 7, 8, 8.4, 12.6), [1.8, 1.4, 1.4, 1.8]);
  silhouette(pen, place(plinth, k), GOLDEN_CORN_BASE, ITEM_LW, () => trimBand(pen, 9.4, 11.4, GOLD_TRIM));
  gem(pen, 0, -5.4, PYRAMID_GEM);
  shine(pen, -2.6, -9, 0.8, 1.8, 0.15);
  legendStar(pen, 9.8, -9.8);
}

/**
 * Common: a straw sombrero in one pale straw colour: a wide brim with upturned edges under a tall tapering
 * crown. Two woven bands across the crown (ink at alpha 0.30, clipped to it: the same colour darkened, not a
 * second colour). One shine.
 */
function paintStrawSunHat(pen: Pen): void {
  const { ctx, k } = pen;
  const brim = new Path2D();
  brim.moveTo(-12.6, 2.2);
  brim.quadraticCurveTo(0, 8.6, 12.6, 2.2);
  brim.quadraticCurveTo(0, 15.6, -12.6, 2.2);
  brim.closePath();
  outerShape(pen, place(brim, k), STRAW_HAT_FILL, ITEM_LW);
  const crown = roundedPolygon(pts(-6.8, 5.6, -3.8, -9.8, 3.8, -9.8, 6.8, 5.6), [1.2, 3.2, 3.2, 1.2]);
  silhouette(pen, place(crown, k), STRAW_HAT_FILL, ITEM_LW, () => {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = INK;
    for (const y of [-5, -0.8]) ctx.fillRect(-9 * k, (y - 1.1) * k, 18 * k, 2.2 * k);
    ctx.globalAlpha = 1;
  });
  shine(pen, -3, -6, 0.8, 2.2, 0.2);
}

/**
 * Common: a lei of seven pale marigold blossoms (five round petals each, `shape` 2.8) strung in an open
 * loop that hangs from the top, each overlapping the next. One shine on a lower blossom.
 */
function paintMarigoldNecklace(pen: Pen): void {
  const { k } = pen;
  const ringR = 8;
  // Degrees clockwise from the top: both ends first, the bottom blossom last so it lies over its neighbours.
  for (const deg of [315, 45, 270, 90, 225, 135, 180]) {
    const a = (deg * Math.PI) / 180;
    outerShape(pen, place(blossomPath(ringR * Math.sin(a), -ringR * Math.cos(a), 4.6), k), MARIGOLD_PETAL, ITEM_LW);
  }
  const a = (225 * Math.PI) / 180;
  shine(pen, ringR * Math.sin(a) - 1.2, -ringR * Math.cos(a) - 1.4, 0.7, 1.5, 0.5);
}

/**
 * Rare: bib overalls in pale denim: two straps, a bib with a pocket outline and two ink buttons, a hip and
 * two legs apart. One yellow cuff band across both legs. One shine.
 */
function paintGardenOveralls(pen: Pen): void {
  const { ctx, k } = pen;
  const overalls = roundedPolygon(
    pts(
      -7, -12.6, -3.8, -12.6, -3.6, -5.6, 3.6, -5.6, 3.8, -12.6, 7, -12.6, 7.4, -5.8, 8.6, -1, 8.6, 12.6,
      1.1, 12.6, 1.1, 5.4, -1.1, 5.4, -1.1, 12.6, -8.6, 12.6, -8.6, -1, -7.4, -5.8,
    ),
    [1.4, 1.4, 1.2, 1.2, 1.4, 1.4, 1.2, 2, 1.6, 0.8, 0.8, 0.8, 0.8, 1.6, 2, 1.2],
  );
  silhouette(pen, place(overalls, k), GARDEN_OVERALLS_FILL, ITEM_LW, () => trimBand(pen, 8.6, 10.8, BOAT_TRIM));
  detail(pen, () => {
    const pocket = roundedPolygon(pts(-2.6, -3.4, 2.6, -3.4, 2.6, 0.8, -2.6, 0.8), 0.8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(pocket, k));
    ctx.fillStyle = INK;
    for (const x of [-3, 3]) ctx.fill(place(ellipse(x, -4.6, 0.8, 0.8), k));
  });
  shine(pen, -5.8, 2.6, 0.8, 2.2, 0.1);
}

/** Right-hand corners of a monarch's upper and lower wing as [x, y, ...] and their corner radii, design units. */
const MONARCH_CLIP_UPPER = [1.6, -1.4, 4.4, -11.4, 10.8, -12.4, 12.6, -6.4, 8.4, 0.2] as const;
const MONARCH_CLIP_UPPER_RADII = [1, 3.4, 3.6, 3.6, 2.6] as const;
const MONARCH_CLIP_LOWER = [1.6, 1, 9.4, 1.6, 10, 6.4, 6.2, 9.8, 2.8, 8.2] as const;
const MONARCH_CLIP_LOWER_RADII = [1, 2.6, 3, 3, 1.6] as const;
const MONARCH_WINGS_UPPER = [2.6, -1.2, 6.2, -10.6, 11.6, -11.8, 12.6, -5.4, 8.8, 0.6] as const;
const MONARCH_WINGS_UPPER_RADII = [1.2, 3.4, 3.6, 3.4, 2.6] as const;
const MONARCH_WINGS_LOWER = [2.6, 1.6, 9.4, 2.2, 10.8, 7.4, 6.6, 11.6, 3.2, 8.6] as const;
const MONARCH_WINGS_LOWER_RADII = [1.2, 2.8, 3.2, 3.2, 1.8] as const;

/**
 * One monarch wing on side `s` (1 right, -1 left): a rounded pale orange panel in `shape` 2.8 with thin ink
 * veins fanning from the wing root and cream spots near its edge. Veins and spots sit inside the silhouette.
 */
function monarchWing(
  pen: Pen,
  s: 1 | -1,
  corners: readonly number[],
  radii: readonly number[],
  root: readonly [number, number],
  veins: readonly (readonly [number, number])[],
  spots: readonly (readonly [number, number])[],
): void {
  const { ctx, k } = pen;
  const xy = s === 1 ? [...corners] : mirrorX(corners);
  silhouette(pen, place(roundedPolygon(pts(...xy), radii), k), MONARCH_WING, ITEM_LW, () => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = BAND_LW;
    for (const [x, y] of veins) ctx.stroke(place(line(s * root[0], root[1], s * x, y), k));
    ctx.fillStyle = MONARCH_SPOT;
    for (const [x, y] of spots) ctx.fill(place(ellipse(s * x, y, 0.8, 0.8), k));
  });
}

/**
 * Epic: a monarch butterfly hair clip: a pebble A clip bar under two pairs of pale orange wings (thin ink
 * veins, cream spots) round a slim body with two antennae, one aqua gem on the thorax. One shine.
 */
function paintMonarchHairClip(pen: Pen): void {
  const { ctx, k } = pen;
  const bar = roundedPolygon(pts(-10.6, 8.4, 10.6, 8.4, 10.6, 12.4, -10.6, 12.4), 1.8);
  outerShape(pen, place(bar, k), MONARCH_BODY, ITEM_LW);
  for (const s of [-1, 1] as const) {
    monarchWing(pen, s, MONARCH_CLIP_LOWER, MONARCH_CLIP_LOWER_RADII, [1.8, 0.6], [[7.6, 5.4], [4.6, 8.2]], [[7.8, 3.8]]);
  }
  for (const s of [-1, 1] as const) {
    monarchWing(pen, s, MONARCH_CLIP_UPPER, MONARCH_CLIP_UPPER_RADII, [1.8, -0.6], [[9.4, -9.4], [11, -4.6]], [[10.2, -7.6], [7.6, -10.4]]);
  }
  const body = roundedPolygon(pts(-1.9, -8.6, 1.9, -8.6, 1.9, 9.4, -1.9, 9.4), 1.9);
  outerShape(pen, place(body, k), MONARCH_BODY, ITEM_LW);
  const feelers = new Path2D();
  for (const s of [-1, 1]) {
    feelers.moveTo(s * 0.9, -8.2);
    feelers.quadraticCurveTo(s * 1.8, -11.4, s * 4.2, -12.2);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(feelers, k));
  gem(pen, 0, -0.4, CASTLE_GEM);
  shine(pen, -7.4, -7.6, 0.8, 2.2, -0.5);
}

/**
 * Legendary: a pair of monarch wings (an upper and a lower on each side, `shape` 2.8) in pale orange with thin
 * ink veins and cream spots, swept out from a small pebble A harness. One gold band on the harness, one pink
 * gem where the wings meet, one 4-point star above, one shine.
 */
function paintMonarchWings(pen: Pen): void {
  for (const s of [-1, 1] as const) {
    monarchWing(pen, s, MONARCH_WINGS_LOWER, MONARCH_WINGS_LOWER_RADII, [2.6, 1.2], [[8.6, 6], [5.4, 9.4]], [[9, 4.6], [6.4, 8.8]]);
  }
  for (const s of [-1, 1] as const) {
    monarchWing(pen, s, MONARCH_WINGS_UPPER, MONARCH_WINGS_UPPER_RADII, [2.6, -0.4], [[9.8, -9.2], [11.8, -5]], [[10.4, -7.4], [8.2, -10]]);
  }
  const harness = roundedPolygon(pts(-2.8, -5, 2.8, -5, 2.8, 6.8, -2.8, 6.8), 2.4);
  silhouette(pen, place(harness, pen.k), MONARCH_BODY, ITEM_LW, () => trimBand(pen, 2.6, 4.8, GOLD_TRIM));
  gem(pen, 0, -1.4, PYRAMID_GEM);
  shine(pen, -8.4, -6.6, 0.8, 2.2, -0.5);
  legendStar(pen, 0, -10.2);
}

// ---------------------------------------------------------------------------
// Chinampa Area 5 items (issue #103)
// ---------------------------------------------------------------------------
//
// The same ladder and ink as the earlier icons. Every outer fill is one of the Area 5 fills above (9:1 or more
// with ink); the six Wearables' worn looks import the same names. Shape carries the meaning: a can with a
// sprinkler rose, a bottle gourd lying on the water, antennae on a band, a knotted triangle, a hanging star, a
// pair of flower lenses, a blouse with flared sleeves, a tiled fountain, a forked ribbon, a winged friendly
// creature on a plinth, and a fringed striped cape.

/** Degrees to radians. */
function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** A closed polygon path with straight corners. */
function polygonPath(...xy: number[]): Path2D {
  return roundedPolygon(pts(...xy), 0);
}

/**
 * Common, Floor: a pale sky-blue watering can: a tapering body with an open top, a wide arched handle on the
 * right and a spout rising to the left with a round sprinkler rose, three ink holes in the rose. One colour and
 * one shine. The flat foot of the body is the lowest fill edge.
 */
function paintWateringCan(pen: Pen): void {
  const { ctx, k } = pen;
  const handle = new Path2D();
  handle.ellipse(4.8, 4.6, 7.8, 7.8, 0, rad(-100), rad(72));
  handle.ellipse(4.8, 4.6, 4, 4, 0, rad(72), rad(-100), true);
  handle.closePath();
  outerShape(pen, place(handle, k), WATERING_CAN_FILL, ITEM_LW);
  const spout = roundedPolygon(pts(-6.8, 10.8, -11.8, -6.2, -8.6, -7, -6.8, 4.8), [1, 1, 1, 1]);
  outerShape(pen, place(spout, k), WATERING_CAN_FILL, ITEM_LW);
  outerShape(pen, place(ellipse(-9.8, -8.3, 2.6, 1.9, -0.26), k), WATERING_CAN_FILL, ITEM_LW);
  const body = roundedPolygon(pts(-6.8, -2.4, 5.6, -2.4, 6.4, 12.6, -7.6, 12.6), [1.4, 1.4, 2.2, 2.2]);
  outerShape(pen, place(body, k), WATERING_CAN_FILL, ITEM_LW);
  outerShape(pen, place(ellipse(-0.6, -2.4, 6.2, 1.7), k), WATERING_CAN_FILL, ITEM_LW);
  detail(pen, () => {
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.3;
    ctx.fill(place(ellipse(-0.6, -2.3, 4.4, 0.9), k));
    ctx.globalAlpha = 1;
    for (const [x, y] of [
      [-10.8, -8.5],
      [-9.4, -9],
      [-8.6, -7.9],
    ]) {
      ctx.fill(place(ellipse(x, y, 0.55, 0.55), k));
    }
  });
  shine(pen, -4.2, 5.4, 0.9, 2.8, 0.08);
}

/**
 * Common, Floating: a bottle gourd lying on the water, a big round lobe and a small one joined at a waist, a
 * curled stem on the small end, a bold ink crease at the waist and a thin ink cord down to a pebble weight. One
 * green and one shine. The body sits across the waterline, 20 below the top of the 80 box; the weight is the
 * lowest fill edge, the box edge.
 */
function paintFloatingGourd(pen: Pen): void {
  const { ctx, k } = pen;
  const cy = waterlineY(INK_OUT_SHAPE) + 2.4;
  const weightR = 1.7;
  const weightY = AREA3_FOOT_Y - weightR;
  const cord = new Path2D();
  cord.moveTo(-4.8, cy + 5.4);
  cord.bezierCurveTo(-8.4, cy + 8, -1.4, cy + 10, -4.8, weightY - weightR);
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  ctx.stroke(place(cord, k));
  outerShape(pen, place(ellipse(-4.8, weightY, weightR, weightR), k), GOURD_WEIGHT, ITEM_LW);
  outerShape(pen, place(ellipse(10.3, cy - 3.6, 1.5, 3.2, 0.55), k), GOURD_FILL, ITEM_LW);
  const gourd = new Path2D();
  gourd.moveTo(-12.4, cy);
  gourd.bezierCurveTo(-12.4, cy - 5.8, -8.4, cy - 6.2, -4.8, cy - 6.2);
  gourd.bezierCurveTo(-1.6, cy - 6.2, 0.4, cy - 3.4, 2.4, cy - 3.2);
  gourd.bezierCurveTo(4.2, cy - 3, 5, cy - 4.8, 7.4, cy - 4.8);
  gourd.bezierCurveTo(10.6, cy - 4.8, 11.6, cy - 2.4, 11.6, cy);
  gourd.bezierCurveTo(11.6, cy + 2.4, 10.6, cy + 4.8, 7.4, cy + 4.8);
  gourd.bezierCurveTo(5, cy + 4.8, 4.2, cy + 3, 2.4, cy + 3.2);
  gourd.bezierCurveTo(0.4, cy + 3.4, -1.6, cy + 6.2, -4.8, cy + 6.2);
  gourd.bezierCurveTo(-8.4, cy + 6.2, -12.4, cy + 5.8, -12.4, cy);
  gourd.closePath();
  silhouette(pen, place(gourd, k), GOURD_FILL, ITEM_LW, () => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(line(2.4, cy - 3.4, 2.4, cy + 3.4), k));
  });
  shine(pen, -8.2, cy - 2.8, 0.9, 2.4, 0.5);
}

/** Vertices of a star with `n` points centred on (cx, cy): outer radius `outer`, inner `inner`, one tip straight up. */
function starVertices(cx: number, cy: number, outer: number, inner: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** Wedge colours of the Pinata star, one per tip, clockwise from the top. */
const PINATA_WEDGES = [PINATA_PINK, PINATA_SKY, PINATA_APRICOT, PINATA_PINK, PINATA_SKY] as const;

/**
 * Rare, Hanging: a star pinata hanging from a pebble A hook ring on its top tip: five rounded tips, each wedge a
 * pale pink, sky blue or apricot paper, with one yellow sash across the middle (the one trim). Gentle and festive:
 * nothing to hit. One shine. The two lower tips are the lowest fill edge.
 */
function paintPinata(pen: Pen): void {
  const { ctx, k } = pen;
  const cy = 2.16;
  const verts = starVertices(0, cy, 14, 6.6, 5);
  const body = roundedPolygon(verts, verts.map((_, i) => (i % 2 === 0 ? 0.9 : 0.7)));
  silhouette(pen, place(body, k), PINATA_PINK, ITEM_LW, () => {
    for (let i = 0; i < 5; i++) {
      const before = verts[(2 * i + 9) % 10];
      const tip = verts[2 * i];
      const after = verts[2 * i + 1];
      ctx.fillStyle = PINATA_WEDGES[i];
      ctx.fill(place(polygonPath(0, cy, before.x, before.y, tip.x, tip.y, after.x, after.y), k));
    }
    trimBand(pen, 0.2, 3.2, BOAT_TRIM);
  });
  shape(ctx, place(ellipse(0, -11.3, 1.3, 1.3), k), outerFill(pen, PINATA_HOOK), DETAIL_LW);
  shine(pen, -5.2, -1.6, 0.8, 2, 0.6);
}

/**
 * Epic, Floor: a tiered fountain of blue-and-white tile: a wide bowl on a plinth, a pillar, a small upper bowl
 * and three jets of water (a tall one and two arcing out and down, outlined thinner at 1.6), the bowl rims
 * showing water. A cobalt rim and a row of cobalt diamonds are painted
 * on the white glaze; one aqua gem on the lower bowl. One shine. The plinth is the lowest fill edge.
 */
function paintTalaveraFountain(pen: Pen): void {
  const { ctx, k } = pen;
  const plinth = roundedPolygon(pts(-10.6, 9.4, 10.6, 9.4, 10.6, 12.6, -10.6, 12.6), 1.4);
  outerShape(pen, place(plinth, k), TALAVERA_TILE, ITEM_LW);
  const lower = new Path2D();
  lower.moveTo(-12.2, 3.4);
  lower.lineTo(12.2, 3.4);
  lower.bezierCurveTo(12.2, 8.4, 7.6, 9.8, 3.6, 9.8);
  lower.lineTo(-3.6, 9.8);
  lower.bezierCurveTo(-7.6, 9.8, -12.2, 8.4, -12.2, 3.4);
  lower.closePath();
  silhouette(pen, place(lower, k), TALAVERA_TILE, ITEM_LW, () => {
    ctx.fillStyle = TALAVERA_COBALT;
    ctx.fillRect(-13 * k, 3.4 * k, 26 * k, 1.8 * k);
    for (const x of [-8.8, -5.2, 5.2, 8.8]) {
      ctx.fill(place(polygonPath(x, 5.6, x + 1.5, 7.2, x, 8.8, x - 1.5, 7.2), k));
    }
  });
  outerShape(pen, place(ellipse(0, 3.4, 12.2, 2), k), TALAVERA_WATER, ITEM_LW);
  const pillar = roundedPolygon(pts(-2.4, -1.4, 2.4, -1.4, 3.2, 3.6, -3.2, 3.6), [1, 1, 1, 1]);
  outerShape(pen, place(pillar, k), TALAVERA_TILE, ITEM_LW);
  const upper = new Path2D();
  upper.moveTo(-7, -2.8);
  upper.lineTo(7, -2.8);
  upper.bezierCurveTo(7, 0.4, 4, 1.4, 0, 1.4);
  upper.bezierCurveTo(-4, 1.4, -7, 0.4, -7, -2.8);
  upper.closePath();
  silhouette(pen, place(upper, k), TALAVERA_TILE, ITEM_LW, () => {
    ctx.fillStyle = TALAVERA_COBALT;
    ctx.fillRect(-8 * k, -2.8 * k, 16 * k, 1.4 * k);
  });
  outerShape(pen, place(ellipse(0, -2.8, 7, 1.4), k), TALAVERA_WATER, ITEM_LW);
  const jet = (path: Path2D): void => shape(ctx, place(path, k), outerFill(pen, TALAVERA_WATER), DETAIL_LW);
  for (const side of [-1, 1]) jet(rootRibbon(side * 0.8, -10.4, side * 5, -12.6, side * 7, -4, 2.6, 3));
  jet(rootRibbon(0, -2.6, 0, -7, 0, -11.4, 3.2, 2.2));
  gem(pen, 0, 6.8, CASTLE_GEM);
  shine(pen, -8.6, 5.4, 0.8, 2, 0.1);
}

/**
 * Legendary, Floor: a friendly alebrije: a carved wooden creature with a round orange body, a lemon head with
 * two horns and a smile, a turquoise wing, a curling pink tail and four short legs, standing on a stone plinth
 * with one gold band. Bright dots and feather lines in four colours; one pink gem on the shoulder and one
 * 4-point star above. One shine. The plinth is the lowest fill edge.
 */
function paintAlebrijeStatue(pen: Pen): void {
  const { ctx, k } = pen;
  const [pink, blue, green, violet] = ALEBRIJE_MARKS;
  silhouette(pen, place(pointedPetal(-1.4, -0.4, -24, 12.6, 5.2), k), ALEBRIJE_WING, ITEM_LW, () => {
    ctx.strokeStyle = violet;
    ctx.lineWidth = BAND_LW;
    for (const deg of [-14, -26, -38]) {
      const a = rad(deg);
      ctx.stroke(place(line(-1.4, -0.4, -1.4 + 10.6 * Math.sin(a), -0.4 - 10.6 * Math.cos(a)), k));
    }
    ctx.fillStyle = pink;
    ctx.fill(place(ellipse(-4.4, -6, 0.9, 0.9), k));
    ctx.fillStyle = blue;
    ctx.fill(place(ellipse(-5.8, -9, 0.9, 0.9), k));
  });
  silhouette(pen, place(pointedPetal(-6.8, 2, -52, 7.2, 3.4), k), ALEBRIJE_TAIL, ITEM_LW, () => {
    ctx.fillStyle = blue;
    ctx.fill(place(ellipse(-10.2, -0.8, 0.9, 0.9), k));
  });
  for (const x of [-4.6, 3.4]) {
    const leg = roundedPolygon(pts(x - 1.6, 3.6, x + 1.6, 3.6, x + 1.6, 9, x - 1.6, 9), 0.8);
    silhouette(pen, place(leg, k), ALEBRIJE_BODY, ITEM_LW, () => {
      ctx.fillStyle = green;
      ctx.fillRect((x - 2) * k, 6.6 * k, 4 * k, 1.2 * k);
    });
  }
  const plinth = roundedPolygon(pts(-9.4, 12.6, -8.4, 8.2, 8.4, 8.2, 9.4, 12.6), [1.8, 1.4, 1.4, 1.8]);
  silhouette(pen, place(plinth, k), ALEBRIJE_BASE, ITEM_LW, () => trimBand(pen, 9.6, 11.4, GOLD_TRIM));
  silhouette(pen, place(ellipse(-0.6, 1.6, 8.2, 4.6), k), ALEBRIJE_BODY, ITEM_LW, () => {
    const dots = [
      [-5.4, 0.6, pink],
      [-2.6, 3.4, blue],
      [-1.4, -0.6, green],
      [1.8, 3.6, violet],
      [-6, 3.2, green],
      [4.4, 0.4, blue],
    ] as const;
    for (const [x, y, colour] of dots) {
      ctx.fillStyle = colour;
      ctx.fill(place(ellipse(x, y, 0.95, 0.95), k));
    }
  });
  for (const [deg, len, x] of [
    [-14, 6, 5],
    [16, 5.4, 8.2],
  ] as const) {
    outerShape(pen, place(pointedPetal(x, -5.8, deg, len, 2.6), k), ALEBRIJE_HEAD, ITEM_LW);
  }
  outerShape(pen, place(ellipse(6.4, -3.4, 4.4, 3.7), k), ALEBRIJE_HEAD, ITEM_LW);
  outerShape(pen, place(ellipse(9.5, -2.1, 2.9, 2.1), k), ALEBRIJE_HEAD, ITEM_LW);
  detail(pen, () => {
    ctx.fillStyle = INK;
    ctx.fill(place(ellipse(7.2, -4.6, 0.8, 0.8), k));
    ctx.fillStyle = pink;
    ctx.fill(place(ellipse(6.2, -1.6, 1.1, 0.8), k));
    const smile = new Path2D();
    smile.moveTo(9.2, -1);
    smile.quadraticCurveTo(10.4, -0.3, 11.6, -1.3);
    ctx.strokeStyle = INK;
    ctx.lineWidth = BAND_LW;
    ctx.stroke(place(smile, k));
  });
  gem(pen, 1.4, 1.8, PYRAMID_GEM);
  shine(pen, -4.8, 5, 0.8, 1.4, 0.4);
  legendStar(pen, -1, -10.2);
}

/**
 * Common: a bee-yellow headband arching over the head, two short antennae each ending in a round bobble, and
 * three bee stripes (ink at alpha 0.30, clipped) across the band and a stripe on each bobble. One shine.
 */
function paintBeeHeadband(pen: Pen): void {
  const { ctx, k } = pen;
  const band = new Path2D();
  band.ellipse(0, 9.4, 12.6, 12.6, 0, rad(-180), rad(0));
  band.ellipse(0, 9.4, 9.2, 9.2, 0, rad(0), rad(-180), true);
  band.closePath();
  for (const s of [-1, 1]) {
    const stem = roundedPolygon(pts(s * 3.6 - 1, -2.4, s * 3.6 + 1, -2.4, s * 6.8 + 1, -9.4, s * 6.8 - 1, -9.4), 0.8);
    outerShape(pen, place(stem, k), BEE_HEADBAND_FILL, ITEM_LW);
  }
  silhouette(pen, place(band, k), BEE_HEADBAND_FILL, ITEM_LW, () => {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = INK;
    for (const x of [-10.4, -1.2, 8]) ctx.fillRect(x * k, -8 * k, 2.4 * k, 20 * k);
    ctx.globalAlpha = 1;
  });
  for (const s of [-1, 1]) {
    silhouette(pen, place(ellipse(s * 7.2, -9.6, 3, 3), k), BEE_HEADBAND_FILL, ITEM_LW, () => {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = INK;
      ctx.fillRect((s * 7.2 - 0.7) * k, -13 * k, 1.4 * k, 7 * k);
      ctx.globalAlpha = 1;
    });
  }
  shine(pen, -9, 3.6, 0.8, 2.2, 0.7);
}

/**
 * Common: a triangular bandana in pale orchid, knotted at the top with a small square knot and two short ends,
 * dotted with cream dots. One shine.
 */
function paintBandana(pen: Pen): void {
  const { ctx, k } = pen;
  const cloth = new Path2D();
  cloth.moveTo(-12, -8.6);
  cloth.bezierCurveTo(-5, -6.4, 5, -6.4, 12, -8.6);
  cloth.lineTo(1.8, 11.2);
  cloth.quadraticCurveTo(0, 14, -1.8, 11.2);
  cloth.closePath();
  silhouette(pen, place(cloth, k), BANDANA_FILL, ITEM_LW, () => {
    ctx.fillStyle = BANDANA_DOT;
    for (const [x, y] of [
      [-7.6, -4.6],
      [-2.6, -3.6],
      [3, -3.6],
      [7.6, -4.6],
      [-4.2, 1.6],
      [0.6, 0.6],
      [4.4, 1.8],
      [-1.2, 6],
      [1.8, 7.2],
    ]) {
      ctx.fill(place(ellipse(x, y, 1.15, 1.15), k));
    }
  });
  for (const s of [-1, 1]) {
    const tail = roundedPolygon(pts(s * 1.6, -10.4, s * 6.4, -12.4, s * 5.2, -7.8), [0.8, 1, 0.8]);
    outerShape(pen, place(tail, k), BANDANA_FILL, ITEM_LW);
  }
  const knot = roundedPolygon(pts(-3, -12.2, 3, -12.2, 3, -6.8, -3, -6.8), 1.6);
  outerShape(pen, place(knot, k), BANDANA_FILL, ITEM_LW);
  shine(pen, -7, 0.2, 0.8, 2, 0.3);
}

/** A sunflower of `petals` pointed petals centred on (cx, cy): one `shape` outline, outer radius `r`. */
function sunflowerPath(cx: number, cy: number, r: number, petals: number): Path2D {
  return roundedPolygon(
    starVertices(cx, cy, r, r * 0.74, petals),
    Array.from({ length: 2 * petals }, (_, i) => (i % 2 === 0 ? 0.7 : 0.5)),
  );
}

/**
 * Rare: round glasses in a sunflower-yellow frame (two lenses with a clear tint, never dark, joined by a bridge)
 * with a sunflower perched on the bridge: eight yellow petals round a seed-brown centre. The sunflower is the one
 * Rare detail, so there is no trim band. One shine on the left lens.
 */
function paintSunflowerSunglasses(pen: Pen): void {
  const { ctx, k } = pen;
  const left = place(ellipse(-6.9, 2.6, 5.35, 4.6), k);
  const right = place(ellipse(6.9, 2.6, 5.35, 4.6), k);
  const bridge = new Path2D();
  bridge.moveTo(-1.7, 1.6);
  bridge.quadraticCurveTo(0, -0.6, 1.7, 1.6);
  detail(pen, () => {
    ctx.fillStyle = GLASSES_LENS;
    ctx.fill(left);
    ctx.fill(right);
  });
  inkMany(ctx, [
    outerSeg(pen, left, GLASSES_W, SUNFLOWER_FRAME, GLASSES_OL),
    outerSeg(pen, right, GLASSES_W, SUNFLOWER_FRAME, GLASSES_OL),
    outerSeg(pen, place(bridge, k), 2.6, SUNFLOWER_FRAME, GLASSES_OL),
  ]);
  outerShape(pen, place(sunflowerPath(0, -6.4, 4.8, 8), k), SUNFLOWER_FRAME, ITEM_LW);
  detail(pen, () => shape(ctx, place(ellipse(0, -6.4, 2, 2), k), SUNFLOWER_CENTRE, BAND_LW));
  shine(pen, -9, 0.2, 0.8, 1.6, 0.5);
}

/**
 * Rare: a flared-sleeve blouse in warm cream with a square neckline, one chest flower of five coloured thread
 * petals round a yellow heart, and one teal hem band (the one trim band) with a row of ink stitches. One shine.
 */
function paintEmbroideredShirt(pen: Pen): void {
  const { ctx, k } = pen;
  const shirt = roundedPolygon(
    pts(-5.2, -12.6, 5.2, -12.6, 12.6, -9.6, 12.6, -2.4, 8.2, -3.4, 9.8, 12.6, -9.8, 12.6, -8.2, -3.4, -12.6, -2.4, -12.6, -9.6),
    [1.4, 1.4, 2, 2, 1, 2, 2, 1, 2, 2],
  );
  silhouette(pen, place(shirt, k), EMBROIDERED_SHIRT_FILL, ITEM_LW, () => {
    trimBand(pen, 8.4, 11.2, EMBROIDERY_BAND);
    ctx.strokeStyle = INK;
    ctx.lineWidth = DETAIL_LW;
    ctx.stroke(place(polygonPath(-4.6, -12.8, -4.6, -9.4, 4.6, -9.4, 4.6, -12.8), k));
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.3;
    for (const x of [-6, -2, 2, 6]) ctx.fill(place(ellipse(x, 9.8, 0.55, 0.55), k));
    ctx.globalAlpha = 1;
    EMBROIDERY_PETALS.forEach((colour, i) => {
      const a = -Math.PI / 2 + (i * TAU) / EMBROIDERY_PETALS.length;
      shape(ctx, place(ellipse(2.9 * Math.cos(a), 0.4 + 2.9 * Math.sin(a), 2.2, 2.2), k), colour, BAND_LW);
    });
    shape(ctx, place(ellipse(0, 0.4, 1.5, 1.5), k), BOAT_TRIM, BAND_LW);
  });
  shine(pen, -7.4, -6.8, 0.8, 2, 0.15);
}

/**
 * Epic: a hummingbird tail ribbon in mint-teal: two loops, two forked tails hanging down (each end notched like
 * a hummingbird's tail), a knot, and one pink gem on the knot. One shine on a loop.
 */
function paintHummingbirdTailRibbon(pen: Pen): void {
  const { ctx, k } = pen;
  const tails: readonly (readonly number[])[] = [
    [-0.6, -3, 2.2, -2, -4.8, 12.6, -6.8, 8.4, -11.6, 10.6],
    [0.6, -3, 11.4, 8.6, 7.4, 12.6, 6.2, 8.2, -2.2, -2],
  ];
  for (const xy of tails) outerShape(pen, place(roundedPolygon(pts(...xy), 1), k), HUMMINGBIRD_RIBBON_FILL, ITEM_LW);
  for (const deg of [-80, 80]) {
    silhouette(pen, place(pointedPetal(0, -4.6, deg, 12.6, 5.4), k), HUMMINGBIRD_RIBBON_FILL, ITEM_LW, () => {
      ctx.strokeStyle = INK;
      ctx.lineWidth = BAND_LW;
      const a = rad(deg);
      ctx.stroke(place(line(0, -4.6, 10 * Math.sin(a), -4.6 - 10 * Math.cos(a)), k));
    });
  }
  outerShape(pen, place(ellipse(0, -4.6, 4.2, 3.9), k), HUMMINGBIRD_RIBBON_FILL, ITEM_LW);
  gem(pen, 0, -4.6, BOW_GEM);
  shine(pen, -7.4, -7.4, 0.8, 1.8, -0.5);
}

/**
 * Legendary: a serape cape of six upright rainbow stripes (pink to violet, none red) on pale sand, narrow at
 * the neck and wide at the hem, a gold band above the hem, five fringe tassels along the bottom, one pink gem at
 * the clasp and one 4-point star. One shine.
 */
function paintRainbowSerapeCape(pen: Pen): void {
  const { ctx, k } = pen;
  const hemY = 7.6;
  for (let i = 0; i < 5; i++) {
    const x = -10.4 + i * 5.2;
    const tassel = roundedPolygon(pts(x - 1.7, hemY - 1, x + 1.7, hemY - 1, x + 1.7, 12.6, x - 1.7, 12.6), [0.4, 0.4, 1.2, 1.2]);
    outerShape(pen, place(tassel, k), SERAPE_FILL, ITEM_LW);
  }
  const cape = new Path2D();
  cape.moveTo(-7.4, -11.8);
  cape.quadraticCurveTo(0, -7.6, 7.4, -11.8);
  cape.bezierCurveTo(10.4, -6, 12.4, 1, 12.4, hemY);
  cape.lineTo(-12.4, hemY);
  cape.bezierCurveTo(-12.4, 1, -10.4, -6, -7.4, -11.8);
  cape.closePath();
  silhouette(pen, place(cape, k), SERAPE_FILL, ITEM_LW, () => {
    const w = 25 / SERAPE_STRIPES.length;
    SERAPE_STRIPES.forEach((colour, i) => {
      ctx.fillStyle = colour;
      ctx.fill(place(polygonPath(-12.5 + i * w, -13, -12.5 + (i + 1) * w + 0.3, -13, -12.5 + (i + 1) * w + 0.3, hemY, -12.5 + i * w, hemY), k));
    });
    trimBand(pen, hemY - 2.4, hemY, GOLD_TRIM);
  });
  gem(pen, 0, -7.4, PYRAMID_GEM);
  shine(pen, -7.4, -5.6, 0.8, 2.2, 0.2);
  legendStar(pen, 9.8, -9.8);
}

// ---------------------------------------------------------------------------
// Paint shell and the Dream blob
// ---------------------------------------------------------------------------

/** Points on an Archimedean spiral of `turns` turns out to `rMax`, stroked in `colours` by half-turn. */
function strokeSpiral(
  ctx: CanvasRenderingContext2D,
  k: number,
  cx: number,
  cy: number,
  rMax: number,
  turns: number,
  colours: readonly string[],
  width: number,
): void {
  const steps = Math.round(turns * 24);
  const total = turns * TAU;
  ctx.lineWidth = width;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * total;
    const a1 = ((i + 1) / steps) * total;
    const r0 = 0.5 + ((rMax - 0.5) * a0) / total;
    const r1 = 0.5 + ((rMax - 0.5) * a1) / total;
    ctx.strokeStyle = colours[Math.floor(a0 / Math.PI) % colours.length];
    ctx.beginPath();
    ctx.moveTo((cx + r0 * Math.cos(a0)) * k, (cy + r0 * Math.sin(a0)) * k);
    ctx.lineTo((cx + r1 * Math.cos(a1)) * k, (cy + r1 * Math.sin(a1)) * k);
    ctx.stroke();
  }
}

/** A white 4-point star with no outline, for the dark Dream bodies. */
function dreamStar(pen: Pen, x: number, y: number, r: number): void {
  pen.ctx.fillStyle = DREAM_STAR;
  pen.ctx.fill(star4Path(x * pen.k, y * pen.k, r * pen.k));
}

/** The pattern inside the blob, centred on (cx, cy), clipped by the caller. */
function paintDreamPattern(pen: Pen, id: DreamSwatchId, cx: number, cy: number): void {
  const { ctx, k } = pen;
  const look = DREAM_SWATCH[id];
  const m = look.marks;
  switch (look.pattern) {
    case 'plain':
      shine(pen, cx - 2.2, cy - 2.4, 1.7, 0.8, -0.7);
      break;
    case 'hearts':
      ctx.fillStyle = m[0];
      ctx.fill(place(heartPath(0, 0.3, 6.8, 6.2), k, cx, cy));
      break;
    case 'spiral':
      strokeSpiral(ctx, k, cx, cy, 4.3, 2, m, 1.5 * (pen.markScale ?? 1));
      break;
    case 'stripes':
      ctx.save();
      ctx.translate(cx * k, cy * k);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = m[0];
      ctx.fillRect(-9 * k, -2.9 * k, 18 * k, 2.6 * k);
      ctx.fillStyle = m[1];
      ctx.fillRect(-9 * k, 0.4 * k, 18 * k, 1.8 * k);
      ctx.restore();
      break;
    case 'bands': {
      const w = (2 * BLOB_R * k) / m.length;
      for (let i = 0; i < m.length; i++) {
        ctx.fillStyle = m[i];
        ctx.fillRect((cx - BLOB_R) * k + i * w, (cy - BLOB_R) * k, w + 0.5, 2 * BLOB_R * k);
      }
      ctx.fillStyle = DREAM_DIVIDER;
      for (let i = 1; i < m.length; i++) {
        ctx.fillRect((cx - BLOB_R) * k + i * w - 0.5, (cy - BLOB_R) * k, 1, 2 * BLOB_R * k);
      }
      break;
    }
    case 'stars':
      ctx.fillStyle = m[0];
      ctx.fill(place(ellipse(-0.6, 0.5, 4.4, 2.6, -0.2), k, cx, cy));
      dreamStar(pen, cx - 1.8, cy - 1.6, 2.1);
      dreamStar(pen, cx + 2.2, cy + 0.3, 1.7);
      dreamStar(pen, cx - 0.4, cy + 2.7, 1.3);
      break;
    case 'spiral-stars':
      strokeSpiral(ctx, k, cx, cy, 3.4, 2, m, 1.5 * (pen.markScale ?? 1));
      dreamStar(pen, cx - 2.9, cy - 2.3, 1.4);
      dreamStar(pen, cx + 2.8, cy + 2.6, 1.2);
      break;
  }
}

/** Paint shell: scallop 26 x 22, five ridges, and a round Dream blob in its opening. */
function paintPaintShell(pen: Pen, id: DreamSwatchId): void {
  const { ctx, k } = pen;
  const body = place(scallopPath(), k);
  silhouette(pen, body, PAINT_SHELL_FILL, SHELL_LW, () => {
    ctx.strokeStyle = PAINT_SHELL_RIDGE;
    ctx.lineWidth = 1.6;
    ctx.stroke(place(scallopRidges(5, 0.9), k));
  });
  detail(pen, () => paintDreamBlob(pen, id));
}

/** The Paint shell opening: a soft cup, the Dream blob with its pattern and ink, and the dark-body rim. */
function paintDreamBlob(pen: Pen, id: DreamSwatchId): void {
  const { ctx, k } = pen;

  // The opening: a soft cup in the ridge colour for the blob to sit in.
  ctx.fillStyle = PAINT_SHELL_RIDGE;
  ctx.fill(place(ellipse(0, 0.8, BLOB_R + 2.2, BLOB_R + 1.4), k));

  const look = DREAM_SWATCH[id];
  const cx = 0;
  const cy = -0.4;
  const blob = place(ellipse(cx, cy, BLOB_R, BLOB_R), k);
  ctx.fillStyle = look.body;
  ctx.fill(blob);
  ctx.save();
  ctx.clip(blob);
  paintDreamPattern(pen, id, cx, cy);
  ctx.restore();
  ctx.lineWidth = BLOB_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(blob);

  if (look.dark) {
    // Rim light along the top of the blob, just inside the ink.
    const rr = BLOB_R * k - BLOB_LW / 2 - 1.2;
    ctx.strokeStyle = DREAM_RIM;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx * k, cy * k, rr, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Dream swatch tile (guide 8)
// ---------------------------------------------------------------------------

/** Swatch tile design side, logical px (guide 8: rounded square 32 x 32). */
const SWATCH_BOX = 32;
/** Swatch corner radius at the outer ink edge (guide 8). */
const SWATCH_RADIUS = 8;
/** Swatch outline (guide 8), constant at every size. */
const SWATCH_LW = 2.6;
/** Dark-tile rim arc width (guide 3g). */
const SWATCH_RIM_LW = 1.2;
/** Blob patterns are authored for a radius-6 blob; the tile fills about 2.1 times that. */
const SWATCH_PATTERN_K = 2.1;

/** Texture frame for a Dream swatch tile of side `size`. Anchor is the tile centre. */
export function dreamSwatchTextureSize(size: number): TexSize {
  const half = size / 2;
  return frameFromBounds(-half, -half, half, half, FRAME_PAD);
}

/** Rounded square centred on (0, 0): half side `half`, corner radius `r`. */
function swatchTilePath(half: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(-half + r, -half);
  p.arcTo(half, -half, half, half, r);
  p.arcTo(half, half, -half, half, r);
  p.arcTo(-half, half, -half, -half, r);
  p.arcTo(-half, -half, half, -half, r);
  p.closePath();
  return p;
}

/**
 * Paint the Dream swatch tile for `id` centred at local (0, 0): a rounded
 * square `size` px on a side to the outer ink edge (corner radius 8 and outline
 * 2.6 at size 32), the body colour, and a simplified pattern clipped to the
 * tile (guide 8). Hearts: one heart about 14 px. Tie-dye: a two-turn spiral.
 * Iridescent: the stripe pair. Rainbow: six vertical bands with dividers.
 * Galaxy: nebula and three stars. Tie-dye galaxy: a spiral and two stars. Solid
 * tiles are plain with one shine. Dark colours get the DREAM_RIM arc along the
 * top, just inside the ink. The name label always sits beside the tile (the
 * scene's job), so this is never colour alone. The geometry scales with `size`;
 * the ink does not. Still frame, so also the reduced-motion version.
 */
export function paintDreamSwatch(ctx: CanvasRenderingContext2D, id: DreamSwatchId, size: number): void {
  const look = DREAM_SWATCH[id];
  const s = size / SWATCH_BOX;
  const half = size / 2 - SWATCH_LW / 2;
  const tile = swatchTilePath(half, Math.max(1, SWATCH_RADIUS * s - SWATCH_LW / 2));

  ctx.fillStyle = look.body;
  ctx.fill(tile);

  ctx.save();
  ctx.clip(tile);
  if (look.pattern === 'bands') {
    const m = look.marks;
    const w = size / m.length;
    for (let i = 0; i < m.length; i++) {
      ctx.fillStyle = m[i];
      ctx.fillRect(-size / 2 + i * w, -size / 2, w + 0.5, size);
    }
    ctx.fillStyle = DREAM_DIVIDER;
    const dw = 1.6;
    for (let i = 1; i < m.length; i++) {
      ctx.fillRect(-size / 2 + i * w - dw / 2, -size / 2, dw, size);
    }
  } else {
    const k = SWATCH_PATTERN_K * s;
    paintDreamPattern({ ctx, k, markScale: SWATCH_PATTERN_K * s }, id, 0, 0);
  }
  ctx.restore();

  ctx.lineWidth = SWATCH_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(tile);

  if (look.dark) {
    // Rim light along the top, just inside the ink: a thin arc over the top edge and corners.
    const hi = size / 2 - SWATCH_LW - SWATCH_RIM_LW / 2;
    const rr = Math.max(1, SWATCH_RADIUS * s - SWATCH_LW - SWATCH_RIM_LW / 2);
    const drop = rr * 0.9;
    const rim = new Path2D();
    rim.moveTo(-hi, -hi + rr + drop);
    rim.lineTo(-hi, -hi + rr);
    rim.arcTo(-hi, -hi, -hi + rr, -hi, rr);
    rim.lineTo(hi - rr, -hi);
    rim.arcTo(hi, -hi, hi, -hi + rr, rr);
    rim.lineTo(hi, -hi + rr + drop);
    ctx.lineWidth = SWATCH_RIM_LW;
    ctx.strokeStyle = DREAM_RIM;
    ctx.stroke(rim);
  }
}

// ---------------------------------------------------------------------------
// Wide Decoration tank sprites
// ---------------------------------------------------------------------------
// A Decoration wider than the 80 box (catalogue `width`) has its Home Tank sprite authored in tank
// units on its width x 80 box, centred on (0, 0), and scaled uniformly by decorationPx / 80. The ink
// never scales. Its tray and Chest icons stay the 28-box icon above.

/** Hook ring line of the wide Firefly string lights, tank units: the rings' ink touches the box top. */
const WIDE_LIGHTS_HOOK_Y = -FLOAT_BOX_PX / 2 + DETAIL_LW / 2 + 3.2;
/** Wire ends and the centre hook, x in tank units: two swags, each from an end ring to the centre ring. */
const WIDE_LIGHTS_END_X = 66;
const WIDE_LIGHTS_SOCKET_W = 3.2;
const WIDE_LIGHTS_SOCKET_H = 6;
/** Bulb radius at the middle of each swag (the biggest) and at its sides, tank units. */
const WIDE_LIGHTS_MID_R = 8.4;
const WIDE_LIGHTS_SIDE_R = 7;
/** Bulbs per swag, left to right: [t along the swag, bulb radius]. */
const WIDE_LIGHTS_BULBS = [
  [0.2, WIDE_LIGHTS_SIDE_R],
  [0.5, WIDE_LIGHTS_MID_R],
  [0.8, WIDE_LIGHTS_SIDE_R],
] as const;
/** Wire y at the middle of each swag: its socket and middle bulb hang from it, their ink ending on the box bottom. */
const WIDE_LIGHTS_MID_Y = FLOAT_BOX_PX / 2 - ITEM_LW / 2 - 2 * WIDE_LIGHTS_MID_R - WIDE_LIGHTS_SOCKET_H;
/** Cubic control y of each swag that puts its middle at WIDE_LIGHTS_MID_Y (the middle is 1/4 end and 3/4 control). */
const WIDE_LIGHTS_SAG_Y = (WIDE_LIGHTS_MID_Y - WIDE_LIGHTS_HOOK_Y / 4) / (3 / 4);

/** A point at `t` on a swag from (x0, y) to (x1, y) whose cubic controls sit a third of the way in at `sagY`. */
function swagPointAt(t: number, x0: number, x1: number, y: number, sagY: number): { x: number; y: number } {
  const spread = 3 * (1 - t) * t;
  return { x: x0 + (x1 - x0) * t, y: (1 - spread) * y + spread * sagY };
}

/** A swag path from (x0, y) to (x1, y) with its cubic controls a third of the way in at `sagY`. */
function swagPath(x0: number, x1: number, y: number, sagY: number): Path2D {
  const p = new Path2D();
  p.moveTo(x0, y);
  p.bezierCurveTo(x0 + (x1 - x0) / 3, sagY, x1 - (x1 - x0) / 3, sagY, x1, y);
  return p;
}

/**
 * Rare, Hanging, 144 wide: the icon's parts on a wider swag. A thin ink wire in two swags strung from three
 * hook rings on the box top (the ends and the centre hook), three round glowing bulbs on pink sockets
 * hanging from each swag, the middle one of each the biggest. The pink sockets are the one trim; one shine,
 * on the left middle bulb. The two middle bulbs are the lowest fill edge, on the box bottom with their ink.
 */
function paintWideFireflyStringLights(pen: Pen): void {
  const { ctx, k } = pen;
  const hookY = WIDE_LIGHTS_HOOK_Y;
  const swags = [
    [-WIDE_LIGHTS_END_X, 0],
    [0, WIDE_LIGHTS_END_X],
  ] as const;
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  for (const [x0, x1] of swags) ctx.stroke(place(swagPath(x0, x1, hookY, WIDE_LIGHTS_SAG_Y), k));
  for (const x of [-WIDE_LIGHTS_END_X, 0, WIDE_LIGHTS_END_X]) {
    shape(ctx, place(ellipse(x, hookY, 3.2, 3.2), k), outerFill(pen, FIREFLY_HOOK), DETAIL_LW);
  }
  const socketW = WIDE_LIGHTS_SOCKET_W;
  const socketH = WIDE_LIGHTS_SOCKET_H;
  for (const [x0, x1] of swags) {
    for (const [t, r] of WIDE_LIGHTS_BULBS) {
      const { x, y } = swagPointAt(t, x0, x1, hookY, WIDE_LIGHTS_SAG_Y);
      const socket = roundedPolygon(pts(x - socketW, y, x + socketW, y, x + socketW, y + socketH, x - socketW, y + socketH), 1.2);
      shape(ctx, place(socket, k), outerFill(pen, FIREFLY_SOCKET), DETAIL_LW);
      outerShape(pen, place(ellipse(x, y + socketH + r, r, r), k), FIREFLY_BULB, ITEM_LW);
    }
  }
  const mid = swagPointAt(0.5, -WIDE_LIGHTS_END_X, 0, hookY, WIDE_LIGHTS_SAG_Y);
  shine(pen, mid.x - 3.4, mid.y + socketH + WIDE_LIGHTS_MID_R - 2.8, 1.8, 3.4, 0.2);
}

/** Flag size of the wide Papel picado banner, tank units: 16 wide, 25 long, a three-tooth hem 4 deep. */
const WIDE_BANNER_FLAG_W = 16;
const WIDE_BANNER_FLAG_LEN = 25;
const WIDE_BANNER_TEETH = 3;
const WIDE_BANNER_TOOTH_H = 4;
/** Wire y at the middle of each swag: the middle flag hangs from it, its hem ink ending on the box bottom. */
const WIDE_BANNER_MID_Y = FLOAT_BOX_PX / 2 - ITEM_LW / 2 - WIDE_BANNER_FLAG_LEN;
/** Cubic control y of each swag that puts its middle at WIDE_BANNER_MID_Y (the middle is 1/4 end and 3/4 control). */
const WIDE_BANNER_SAG_Y = (WIDE_BANNER_MID_Y - WIDE_LIGHTS_HOOK_Y / 4) / (3 / 4);
/** Half width the yellow band of a flag reaches either side of x = 0: the whole 144 box. */
const WIDE_BANNER_BAND_HALF = 72;

/**
 * Rare, Hanging, 144 wide: the icon's parts on a wider swag. A thin ink wire in two swags strung from three
 * hook rings on the box top (the ends and the centre hook), three paper flags hanging from each swag (pink and
 * apricot in turn, a zigzag hem of three teeth), each with one yellow band just under the wire. One shine, on
 * the left middle flag. The two middle flags are the lowest fill edge, their ink on the box bottom.
 */
function paintWidePapelPicadoBanner(pen: Pen): void {
  const { ctx, k } = pen;
  const hookY = WIDE_LIGHTS_HOOK_Y;
  const swags = [
    [-WIDE_LIGHTS_END_X, 0],
    [0, WIDE_LIGHTS_END_X],
  ] as const;
  ctx.strokeStyle = INK;
  ctx.lineWidth = DETAIL_LW;
  for (const [x0, x1] of swags) ctx.stroke(place(swagPath(x0, x1, hookY, WIDE_BANNER_SAG_Y), k));
  for (const x of [-WIDE_LIGHTS_END_X, 0, WIDE_LIGHTS_END_X]) {
    shape(ctx, place(ellipse(x, hookY, 3.2, 3.2), k), outerFill(pen, PAPEL_PICADO_HOOK), DETAIL_LW);
  }
  let index = 0;
  for (const [x0, x1] of swags) {
    for (const t of [0.2, 0.5, 0.8]) {
      const { x, y } = swagPointAt(t, x0, x1, hookY, WIDE_BANNER_SAG_Y);
      const flag = place(
        paperFlagPath(x, y, WIDE_BANNER_FLAG_W, WIDE_BANNER_FLAG_LEN, WIDE_BANNER_TEETH, WIDE_BANNER_TOOTH_H),
        k,
      );
      silhouette(pen, flag, PAPEL_FLAG_FILLS[index % 2], ITEM_LW, () =>
        trimBand(pen, y + 4, y + 8, BOAT_TRIM, WIDE_BANNER_BAND_HALF),
      );
      index += 1;
    }
  }
  const mid = swagPointAt(0.5, -WIDE_LIGHTS_END_X, 0, hookY, WIDE_BANNER_SAG_Y);
  shine(pen, mid.x - 3.4, mid.y + 12, 1.6, 3.4, 0.1);
}

/** The wide tank sprites by slug: the catalogue width in tank units each is authored at, and its painter. */
const WIDE_DECORATIONS: Readonly<Partial<Record<TreasureIconSlug, { readonly width: number; readonly paint: (pen: Pen) => void }>>> = {
  'firefly-string-lights': { width: 144, paint: paintWideFireflyStringLights },
  'papel-picado-banner': { width: 144, paint: paintWidePapelPicadoBanner },
};

/**
 * Texture frame for the tank sprite of a Decoration `width` tank units wide, at `decorationPx` high: its
 * width x 80 box scaled to `decorationPx`, plus 1 px each side. Anchor is the box centre.
 */
export function wideDecorationTextureSize(width: number, decorationPx: number): TexSize {
  const halfW = (width * decorationPx) / FLOAT_BOX_PX / 2;
  const halfH = decorationPx / 2;
  return frameFromBounds(-halfW, -halfH, halfW, halfH, FRAME_PAD);
}

/**
 * Paint the tank sprite of the wide Decoration `slug` centred at local (0, 0), on its `width` x 80 box
 * (tank units) scaled to `decorationPx` high. Ink widths do not change with size. Throws when `slug` has
 * no tank sprite authored at `width`.
 */
export function paintWideDecoration(ctx: CanvasRenderingContext2D, slug: TreasureIconSlug, width: number, decorationPx: number): void {
  const art = WIDE_DECORATIONS[slug];
  if (art === undefined || art.width !== width) throw new Error(`no ${width} wide tank sprite for "${slug}"`);
  art.paint({ ctx, k: decorationPx / FLOAT_BOX_PX });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const PAINT_SHELL_PREFIX = 'paint-shell-';

/**
 * Paint the treasure icon for `slug` centred at local (0, 0). The longest side
 * is `size` logical px with the ink included. Ink widths do not change with size.
 */
export function paintTreasureIcon(ctx: CanvasRenderingContext2D, slug: TreasureIconSlug, size: number): void {
  paintIcon(ctx, slug, size, false);
}

/** Paint the icon for `slug` at `size`, in flat silhouette mode when `flat` (see {@link Pen}). */
function paintIcon(ctx: CanvasRenderingContext2D, slug: TreasureIconSlug, size: number, flat: boolean): void {
  if (slug.startsWith(PAINT_SHELL_PREFIX)) {
    const id = slug.slice(PAINT_SHELL_PREFIX.length) as DreamSwatchId;
    paintPaintShell({ ctx, k: fitScale(size, INK_OUT_SHELL), flat }, id);
    return;
  }
  switch (slug as TreasureItemSlug) {
    case 'pond-plant':
      paintPondPlant({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'toy-boat':
      paintToyBoat({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'castle-tower':
      paintCastleTower({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'sun-pyramid':
      paintSunPyramid({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'sun-hat':
      paintSunHat({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'shell-necklace':
      paintShellNecklace({ ctx, k: fitScale(size, INK_OUT_TUBE), flat });
      break;
    case 'heart-glasses':
      paintHeartGlasses({ ctx, k: fitScale(size, INK_OUT_GLASSES), flat });
      break;
    case 'golden-bow':
      paintGoldenBow({ ctx, k: fitScale(size, INK_OUT_BLOB), flat });
      break;
    case 'tank-top':
      paintTankTop({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'diving-tank':
      paintDivingTank({ ctx, k: (size - 2 * INK_OUT_BLOB) / DIVING_TANK_FILL_H, flat });
      break;
    case 'stripy-socks':
      paintStripySocks({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'flippers':
      paintFlippers({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'lily-pad':
      paintLilyPad({ ctx, k: fitScale(size, INK_OUT_BLOB), flat });
      break;
    case 'cattail-clump':
      paintCattailClump({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'frog-statue':
      paintFrogStatue({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'lotus-lantern':
      paintLotusLantern({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'lily-flower-crown':
      paintLilyFlowerCrown({ ctx, k: fitScale(size, INK_OUT_TUBE), flat });
      break;
    case 'pond-weed-scarf':
      paintPondWeedScarf({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'dragonfly-glasses':
      paintDragonflyGlasses({ ctx, k: fitScale(size, INK_OUT_GLASSES), flat });
      break;
    case 'raincoat':
      paintRaincoat({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'ladybug-backpack':
      paintLadybugBackpack({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'rainbow-dragonfly-wings':
      paintRainbowDragonflyWings({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'froggy-boots':
      paintFroggyBoots({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'reed-bundle':
      paintReedBundle({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'drifting-feather':
      paintDriftingFeather({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'wooden-duck-decoy':
      paintWoodenDuckDecoy({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'firefly-string-lights':
      paintFireflyStringLights({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'firefly-jar':
      paintFireflyJar({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'golden-lotus-throne':
      paintGoldenLotusThrone({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'feather-cap':
      paintFeatherCap({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'lily-pad-socks':
      paintLilyPadSocks({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'water-lily-shirt':
      paintWaterLilyShirt({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'pearl-tail-charm':
      paintPearlTailCharm({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'firefly-cape':
      paintFireflyCape({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'clay-flowerpot':
      paintClayFlowerpot({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'corn-husk-doll':
      paintCornHuskDoll({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'straw-sun-hat':
      paintStrawSunHat({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'marigold-necklace':
      paintMarigoldNecklace({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'scarecrow':
      paintScarecrow({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'papel-picado-banner':
      paintPapelPicadoBanner({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'garden-overalls':
      paintGardenOveralls({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'willow-swing':
      paintWillowSwing({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'monarch-hair-clip':
      paintMonarchHairClip({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'golden-corn':
      paintGoldenCorn({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'monarch-wings':
      paintMonarchWings({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'watering-can':
      paintWateringCan({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'floating-gourd':
      paintFloatingGourd({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'bee-headband':
      paintBeeHeadband({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'bandana':
      paintBandana({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'pinata':
      paintPinata({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'sunflower-sunglasses':
      paintSunflowerSunglasses({ ctx, k: fitScale(size, INK_OUT_GLASSES), flat });
      break;
    case 'embroidered-shirt':
      paintEmbroideredShirt({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'talavera-fountain':
      paintTalaveraFountain({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'hummingbird-tail-ribbon':
      paintHummingbirdTailRibbon({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'alebrije-statue':
      paintAlebrijeStatue({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
    case 'rainbow-serape-cape':
      paintRainbowSerapeCape({ ctx, k: fitScale(size, INK_OUT_SHAPE), flat });
      break;
  }
}

// ---------------------------------------------------------------------------
// Unfound silhouettes
// ---------------------------------------------------------------------------

/**
 * Ink "?" proportions, authored 26 tall in the glyph's own units: a local copy
 * of the unfound-morph "?" geometry in drawMorphs.ts (hook centre y -6, hook
 * radius 6.5, stem end y 3.4, dot y 10.5, dot radius 0.55 of the tube width).
 * Keep the two in step.
 */
const Q_HOOK_Y = -6;
const Q_HOOK_R = 6.5;
const Q_STEM_END_Y = 3.4;
const Q_DOT_Y = 10.5;
const Q_DOT_R_PER_LW = 0.55;
/** Glyph geometry scale per logical px of the icon: size / 64. */
const UNFOUND_Q_SCALE_PER_PX = 1 / 64;
/** "?" tube width, constant at every size. */
const UNFOUND_Q_LW = 2.4;

/**
 * Rounded ink "?" (round-capped tube and dot, no font) for an unfound icon of
 * `size`, centred so the middle of its ink extent sits on (0, 0). The geometry
 * scales with `size`; the tube width does not.
 */
function paintUnfoundMark(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size * UNFOUND_Q_SCALE_PER_PX;
  const lw = UNFOUND_Q_LW;
  const dr = lw * Q_DOT_R_PER_LW;
  const top = (Q_HOOK_Y - Q_HOOK_R) * s - lw / 2;
  const bottom = Q_DOT_Y * s + dr;
  const cx = 0;
  const cy = -(top + bottom) / 2;
  const hookY = cy + Q_HOOK_Y * s;
  const hookR = Q_HOOK_R * s;
  const end = 0.5;
  const ex = cx + hookR * Math.cos(end);
  const ey = hookY + hookR * Math.sin(end);
  const q = new Path2D();
  q.arc(cx, hookY, hookR, Math.PI, TAU + end, false);
  q.bezierCurveTo(
    ex - Math.sin(end) * 2.5 * s,
    ey + Math.cos(end) * 2.5 * s,
    cx,
    cy + 0.6 * s,
    cx,
    cy + Q_STEM_END_Y * s,
  );
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke(q);

  const dot = new Path2D();
  ell(dot, cx, cy + Q_DOT_Y * s, dr, dr);
  ctx.fillStyle = INK;
  ctx.fill(dot);
}

/**
 * Paint the unfound silhouette of `slug` centred at local (0, 0): the icon in
 * flat mode (outer fills in TREASURE_SILHOUETTE_FILL, no inner details, the
 * same outer ink), then an ink "?" at the icon centre. Same frame as the icon.
 */
export function paintTreasureSilhouette(ctx: CanvasRenderingContext2D, slug: TreasureIconSlug, size: number): void {
  paintIcon(ctx, slug, size, true);
  paintUnfoundMark(ctx, size);
}

/**
 * Paint the unfound Dream swatch tile centred at local (0, 0): the swatch tile
 * path at `size`, filled with TREASURE_SILHOUETTE_FILL, ink 2.6, no pattern or
 * shine, then an ink "?" at the tile centre. Same frame as the swatch tile.
 */
export function paintDreamSwatchSilhouette(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / SWATCH_BOX;
  const half = size / 2 - SWATCH_LW / 2;
  const tile = swatchTilePath(half, Math.max(1, SWATCH_RADIUS * s - SWATCH_LW / 2));
  ctx.fillStyle = TREASURE_SILHOUETTE_FILL;
  ctx.fill(tile);
  ctx.lineWidth = SWATCH_LW;
  ctx.strokeStyle = INK;
  ctx.stroke(tile);
  paintUnfoundMark(ctx, size);
}
