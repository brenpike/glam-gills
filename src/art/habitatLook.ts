/**
 * Habitat looks (guide 3c, 7a, 7b): the colours and counts that change from one
 * habitat to the next, so the background painters read one table instead of the
 * canal constants. The canal entry is exactly today's palette constants. The pond
 * entry is new and derived (provisional): a warmer green water and a soft mud bed.
 * Presentational only: no game state, no Phaser.
 *
 * Pond contrast rule (guide 10, the pair method): every pond background colour,
 * water stops, bed stops and edge reeds included, has relative luminance 0.1687 or
 * more. Ink #2b2350 (luminance 0.0229) is then 3:1 or better against it, so any cue
 * object keeps its ink outline at 3:1 on every pond background, whatever its fill.
 * The canal cannot promise this: its deep water and bed bottom sit in the band where
 * both ink and a light fill fall under 3:1 (the recorded Leucistic residual).
 *
 * Chinampa contrast rule (issue #76): the chinampa look keeps the same rule. Every
 * chinampa background colour, water stops, bed stops, mud dots, the bed lip and the
 * haze-lightened deep water included, has relative luminance 0.1687 or more. The
 * bottom row of Area 4 is the darker one (the deep stop and the bed bottom), and it
 * is also held above the floor. Ink is then 3:1 or better on all of it.
 *
 * Chinampa bank, gap and props (issue #76): a look also says how its banks are drawn (`bank`:
 * the canal's willow bank, or the chinampa's garden plots with crops above the surface and ahuejote
 * roots in the water), whether the gap between two chinampas gets its edges (`currentGap`) and
 * whether the chinampa props are baked for it (`chinampaProps`). The canal, pond and dusk pond say
 * 'willows', false and false, so their bakes are unchanged.
 *
 * Spring cave contrast rule (issue #77): the spring cave look keeps the same rule. Every
 * background colour, the cave-ceiling sky stops, the water stops, the bed stops, the rock chips and
 * the haze-lightened deep water included, has relative luminance 0.1687 or more, so ink is 3:1 or
 * better on all of it. The dark cave of Area 6 is a separate layer; this look is the lit water
 * under it. Its water is a clear, cold blue and its rock a grey-blue.
 *
 * Spring cave rows and props (issue #77): a look also says what it paints over its chunks
 * (`rowDetails`: nothing, or the spring cave's rock roof with its sky opening and lit pool, rock
 * walls at the ends of a row and the rock bed, drawSpringCave.ts) and whether the spring cave props
 * are baked for it (`springCaveProps`: the side grotto, the rock ledges, the outflow marks, the
 * glow-plants and the soft light, springCaveTextures.ts). A look with the spring cave props draws
 * the zone's bank overhangs as rock ledges. The canal, pond, dusk pond and chinampa say 'none' and
 * false, so their bakes are unchanged.
 *
 * Deep canal props (issue #78): a look also says whether the deep canal props are baked for it
 * (`deepCanalProps`: the gliding trajinera hull and its shadow, the moored hulls and the sunken hull
 * cave, deepCanalTextures.ts). A look with the deep canal props draws the zone's bank overhangs as
 * moored hulls. Every look so far says false, so its bakes are unchanged.
 *
 * Area looks (issue #98): an area may use a variant of its habitat's look, such as
 * the pond at dusk ('pond-dusk', Area 3). A variant is a whole palette baked into the
 * background, haze and surface, never an overlay over gameplay depths. The dusk pond
 * keeps the pond contrast rule above. Each look also says what its area needs beside
 * colours (stream, cave, pond props, fireflies), so callers read properties and never
 * compare look ids.
 *
 * Golden hour (issue #112, Area 11): the deep canal at golden hour ('deep-canal-golden') is the deep
 * canal look with a warm peach and coral sky and wash, warm shallow and mid water fading to the same
 * deep teal, a warm haze and surface line, and warm, more slanted light rays (`rayTint`,
 * `raySlant`). It also lights its lower row (`lowerRowLight`), paints its decorations into its chunks
 * (`goldenDecor`, drawGoldenCanal.ts) and lets at most one marigold petal per screen sink (`sinkingPetalsPerScreen`, ND-13).
 * Every other look says white rays at the day slant, false, false and 0, so its bakes are unchanged.
 * The golden look keeps the deep canal contrast rule: every water stop, haze blend and bed colour has
 * relative luminance 0.1687 or more.
 *
 * Open lake (issue #211, Area 12): the open lake look ('open-lake') and its windy variant for Area 12
 * ('open-lake-windy'); issue #212 adds Area 13's still variant ('open-lake-still': a grey overcast sky and
 * air wash, rays at half strength, ordinary clouds). The lake is wide open water under a wide sky, with the two volcanoes small on
 * the horizon. Its sky, water bands, haze and silt come from drawLake.ts. A look also says whether
 * the lakebed is painted into its chunks (`lakebed`: silt, smooth stones and tule roots with a light
 * lip on every top edge), whether its water is drawn by depth band (`depthBands`), whether the
 * volcanoes stand on its horizon (`volcanoHorizon`) and whether its clouds stream in the wind
 * (`streamingClouds`, the windy variant only). Every other look says false for all four, so its
 * bakes are unchanged. Issue #213 adds Area 14's late-afternoon variant ('open-lake-late': a warm apricot
 * and peach sky under a warm wash, the golden hour's rays at the golden slant, ordinary clouds) and
 * `pitShafts`, long lighten-only shafts of light down into band 2 of the pits; every other look says false. The lake keeps the contrast rule: band 1 and band 2 water, every haze blend,
 * the sky, the mountains and the silt have relative luminance 0.1687 or more.
 */
import {
  BED_BOTTOM,
  BED_LIP,
  BED_TOP,
  HAZE,
  MUD,
  PEBBLE_COLOURS,
  PEBBLE_SHINE,
  SKY_HORIZON,
  SKY_TOP,
  SURFACE_LINE,
  SURFACE_LINE_WIDTH,
  WATER_DEEP,
  WATER_GRADIENT_END_Y,
  WATER_MID,
  WATER_SHALLOW,
  WATER_STOP_MID,
} from './palette';
import {
  LAKE_LIP,
  LAKE_SILT_BOTTOM,
  LAKE_SILT_FLECK_DARK,
  LAKE_SILT_TOP,
  LAKE_SKY_HORIZON,
  LAKE_SKY_TOP,
  lakeWaterBand,
} from './drawLake';

/** Look ids shipped so far. Must match the logic layer's Habitat.look values. */
export type HabitatLookId = 'canal' | 'pond' | 'chinampa' | 'spring-cave' | 'deep-canal' | 'open-lake';

/** Every look an area can use: a habitat's own look, or a variant of it for one area (the pond at dusk, Area 3; the deep canal at golden hour, Area 11; the open lake in the wind, Area 12; the open lake overcast and still, Area 13; the open lake in the late afternoon, Area 14). */
export type AreaLookId = HabitatLookId | 'pond-dusk' | 'deep-canal-golden' | 'open-lake-windy' | 'open-lake-still' | 'open-lake-late';

/** Sky gradient (guide 7a): `top` at y 0 down to `horizon` at the surface. */
export interface SkyLook {
  readonly top: string;
  readonly horizon: string;
}

/**
 * The hiding place an area's cave is drawn as (guide 7e): the canal's rocks, the pond's hollow log,
 * the dusk pond's root arch, the chinampa's tangle of ahuejote roots, the spring cave's side grotto,
 * the deep canal's sunken old trajinera hull, or the open lake's smooth stones (scenery only: the lake
 * has no hiding place, ND-17).
 */
export type CaveKind = 'rocks' | 'log' | 'rootArch' | 'rootTangle' | 'grotto' | 'sunkenHull';
/** Where a cave hangs: base centre on the bed, or top centre under the bank at the waterline. */
export type CaveAnchor = 'bed' | 'bank';

/**
 * How the banks of the top row are drawn (guide 7a, 7b): the canal's soil block with a grass cap under
 * willows, or the chinampa's garden plots (crops above the surface, ahuejote roots in the water).
 */
export type BankStyle = 'willows' | 'plots';

/**
 * What a look paints over its chunks after the water, the rays and the bed: nothing, or the spring
 * cave's rows (drawSpringCave.ts paintSpringRowDetails). A 'springCave' top row is a rock roof with
 * no sun and no clouds: the sky shows only through its opening.
 */
export type RowDetails = 'none' | 'springCave';

export interface CaveLook {
  readonly kind: CaveKind;
  readonly anchor: CaveAnchor;
}

/** Water gradient (guide 3c): shallow at the surface, mid at `stopMid`, deep at `gradientEndY` and below. */
export interface WaterLook {
  readonly shallow: string;
  readonly mid: string;
  readonly deep: string;
  /** Gradient stop position of `mid`, 0..1. */
  readonly stopMid: number;
  /** y where the gradient ends (the deep stop). */
  readonly gradientEndY: number;
}

/** The bed: gradient, lip line, mud dots and pebbles. Counts are the number of random draws of each kind. */
export interface BedLook {
  readonly top: string;
  readonly bottom: string;
  readonly lip: string;
  /** Mud dot fill, alpha allowed (it is a fill inside the bed). */
  readonly mud: string;
  readonly mudCount: number;
  readonly pebbles: readonly string[];
  readonly pebbleShine: string;
  readonly pebbleCount: number;
}

/** Colours of the reeds and cattails painted at the area edges of a look. */
export interface EdgeReedLook {
  readonly stalk: string;
  readonly stalkLight: string;
  readonly leaf: string;
  readonly cattail: string;
}

export interface HabitatLook {
  readonly id: AreaLookId;
  /** Sky gradient above the water. */
  readonly sky: SkyLook;
  /**
   * Wash laid over the sky, sun, clouds, bank and willows, inside the background chunk
   * only (above the water, where no cue object goes). `null` lays none. Baked, never a
   * layer over gameplay depths.
   */
  readonly airWash: string | null;
  /** Multiplies the light ray alpha (guide 7a). 1 is full strength. */
  readonly rayAlphaScale: number;
  readonly water: WaterLook;
  /** Haze laid over the water of every row (guide 3c). */
  readonly haze: string;
  /** Fill of the wave polygon at the surface. */
  readonly surfaceFill: string;
  readonly surfaceLine: string;
  readonly surfaceLineWidth: number;
  readonly bed: BedLook;
  /** Reeds and cattails silhouetted at the left and right area edges. `null` paints none (the canal). */
  readonly edgeReeds: EdgeReedLook | null;
  /** Bake the stream flowing in at the area's last column, top row (guide 7a). */
  readonly stream: boolean;
  /** What the area's cave is drawn as, and where it hangs. */
  readonly cave: CaveLook;
  /** The area needs the pond props (hollow log, plastic worms, queasy cheeks; pondTextures.ts). */
  readonly pondProps: boolean;
  /** Fireflies hovering above the water, per screen of area width. 0 shows none. */
  readonly firefliesPerScreen: number;
  /** How the banks (the chunks in `bankChunks`, top row) are drawn. */
  readonly bank: BankStyle;
  /** Draw a chinampa edge on each side of the area's currents (the gap between two chinampas; chinampaTextures.ts). */
  readonly currentGap: boolean;
  /** The area needs the chinampa props (bank overhangs, gap edges, ghost nets, snag cue; chinampaTextures.ts). */
  readonly chinampaProps: boolean;
  /** What is painted over the chunks after the water, the rays and the bed. */
  readonly rowDetails: RowDetails;
  /**
   * The area needs the spring cave props (side grotto, rock ledges, outflow marks, glow-plants, soft
   * light; springCaveTextures.ts). Its bank overhangs are drawn as rock ledges.
   */
  readonly springCaveProps: boolean;
  /**
   * The area needs the deep canal props (gliding trajinera hull and shadow, moored hulls, sunken hull
   * cave; deepCanalTextures.ts). Its bank overhangs are drawn as moored hulls.
   */
  readonly deepCanalProps: boolean;
  /**
   * Paint the old canal-bed stones (drawDeepCanal.ts paintCanalBedStones) over the bed of its bottom
   * and single chunks. Only the deep canal does.
   */
  readonly bedStones: boolean;
  /** Colour of the light rays as [r, g, b] (guide 7a). White is the day light. */
  readonly rayTint: RgbTriple;
  /** How far, px, each light ray runs left between the surface and its end (RAY_END_Y). DAY_RAY_SLANT is the day slant. */
  readonly raySlant: number;
  /**
   * Light the bottom row (drawGoldenCanal.ts paintLitLowerRow): lighten-only light shafts and a glow
   * over the bed, clear at the chunk's top edge so the rows meet with no seam.
   */
  readonly lowerRowLight: boolean;
  /**
   * Paint the golden-hour decorations into the chunks (drawGoldenCanal.ts paintGoldenDecor): papel
   * picado banners, marigold petal patches, water hyacinth rafts, chinampa walls with ahuejote root
   * curtains, and sunken trajinera arches. Scenery only: none of it is cover or a cue.
   */
  readonly goldenDecor: boolean;
  /** Marigold petals sinking slowly through the water, per screen of area width (drawGoldenCanal.ts paintSinkingPetal). 0 shows none. */
  readonly sinkingPetalsPerScreen: number;
  /**
   * Paint the lakebed into the chunks (drawLake.ts paintLakebed): silt with flecks, smooth stones and
   * tule roots, and a light lip on every top edge. Only the open lake does.
   */
  readonly lakebed: boolean;
  /** Draw the water by depth band (drawLake.ts lakeWaterBand: sunlit blue-green, then dusky blue). Only the open lake does. */
  readonly depthBands: boolean;
  /** Stand Popocatepetl and Iztaccihuatl on the horizon, over the sky and before the water (drawLake.ts paintLakeVolcanoes). Only the open lake does. */
  readonly volcanoHorizon: boolean;
  /** Paint streaming clouds drawn out by the wind (drawLake.ts paintStreamingClouds). Only the windy open lake does. */
  readonly streamingClouds: boolean;
  /**
   * Paint long, lighten-only light shafts down into band 2 of the pits (drawLake.ts paintPitShafts),
   * faded to nothing by y 720 so band 3 stays black. Only the late-afternoon open lake (Area 14) does.
   */
  readonly pitShafts: boolean;
}

/** A colour as [r, g, b], each 0 to 255. */
export type RgbTriple = readonly [number, number, number];

/** Day light rays: white, at the prototype slant (guide 7a). */
export const DAY_RAY_TINT: RgbTriple = Object.freeze([255, 255, 255] as const);
export const DAY_RAY_SLANT = 70;

/** Sky of the daytime looks: the prototype sky (guide 7a). */
const DAY_SKY: SkyLook = Object.freeze({ top: SKY_TOP, horizon: SKY_HORIZON });

/** Canal look: today's palette constants, unchanged. */
const CANAL_LOOK: HabitatLook = Object.freeze({
  id: 'canal',
  sky: DAY_SKY,
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: WATER_SHALLOW,
    mid: WATER_MID,
    deep: WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: HAZE,
  surfaceFill: WATER_SHALLOW,
  surfaceLine: SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: BED_TOP,
    bottom: BED_BOTTOM,
    lip: BED_LIP,
    mud: MUD,
    mudCount: 12,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 16,
  }),
  edgeReeds: null,
  stream: false,
  cave: Object.freeze({ kind: 'rocks', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Pond water (guide 3c, derived, provisional): a warmer, yellower green than the
 * canal teal, with the same stops and the same stack order. Luminance 0.653, 0.404
 * and 0.2095. Deep #2f8f58 is 3.56:1 with ink, shallow #a4e57a is 9.64:1.
 */
export const POND_WATER_SHALLOW = '#a4e57a';
export const POND_WATER_MID = '#58bf6a';
export const POND_WATER_DEEP = '#2f8f58';
/** Pond haze: a soft leaf green. Lightens every water stop, so the contrast rule above still holds. */
export const POND_HAZE = 'rgba(130,210,90,0.12)';
/** Pond surface line: the canal line warmed toward cream. */
export const POND_SURFACE_LINE = 'rgba(246,255,226,0.95)';
/**
 * Pond mud bed (guide 7a, derived, provisional): soft olive mud, lighter than the
 * canal bed. Top #b8a064 (luminance 0.3625), bottom #9a8450 (0.2395, 3.97:1 with
 * ink), lip #d9c48c. Mud dots #78602f at 0.45 over the bottom stop blend to a
 * luminance of about 0.18, still 3:1 or better with ink.
 */
export const POND_BED_TOP = '#b8a064';
export const POND_BED_BOTTOM = '#9a8450';
export const POND_BED_LIP = '#d9c48c';
export const POND_MUD = 'rgba(120,96,47,0.45)';
/**
 * Pond edge reeds (guide 7a, derived, provisional): darker, cooler greens than the
 * water, with a warm cattail head. Stalk #3a8a40 (luminance 0.1945), light stalk
 * #4a9a44, leaf #58a843, cattail #a8693a (0.1873). All are 3:1 or better with ink.
 */
export const POND_REED_STALK = '#3a8a40';
export const POND_REED_STALK_LIGHT = '#4a9a44';
export const POND_REED_LEAF = '#58a843';
export const POND_CATTAIL = '#a8693a';

const POND_LOOK: HabitatLook = Object.freeze({
  id: 'pond',
  sky: DAY_SKY,
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: POND_WATER_SHALLOW,
    mid: POND_WATER_MID,
    deep: POND_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: POND_HAZE,
  surfaceFill: POND_WATER_SHALLOW,
  surfaceLine: POND_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: POND_BED_TOP,
    bottom: POND_BED_BOTTOM,
    lip: POND_BED_LIP,
    mud: POND_MUD,
    // Soft mud: many dots, few pebbles.
    mudCount: 22,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 5,
  }),
  edgeReeds: Object.freeze({
    stalk: POND_REED_STALK,
    stalkLight: POND_REED_STALK_LIGHT,
    leaf: POND_REED_LEAF,
    cattail: POND_CATTAIL,
  }),
  stream: true,
  cave: Object.freeze({ kind: 'log', anchor: 'bed' }),
  pondProps: true,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Dusk pond sky (guide 7a, derived, provisional): lavender at the top to peach at the
 * horizon, under the dusk wash. Seen through the wash: #c29acf (luminance 0.3909) and
 * #f0bd96 (0.5712).
 */
export const DUSK_SKY_TOP = '#c9a6e0';
export const DUSK_SKY_HORIZON = '#ffcf9e';
/**
 * Dusk wash over the sky, sun, clouds, bank and willows: a dim rose. Exception to the
 * contrast rule, recorded here: under it the bank soil #a2623a falls from luminance
 * 0.1672 (already under 0.1687 in every look) to 0.1603, and the soil detail #7f4a2a
 * stays under too (0.1001). Nothing a kid must find sits there: the bank is above the
 * water, and every cue object stays in the water.
 */
export const DUSK_AIR_WASH = 'rgba(150,80,100,0.14)';
/** Dusk light rays: dimmer, at 0.6 of the day alpha. */
export const DUSK_RAY_ALPHA_SCALE = 0.6;
/**
 * Dusk pond water (guide 3c, derived, provisional): the pond green turned warmer
 * (hue 81 / 106 / 130 against the pond's 96 / 130 / 146) and dimmer. Luminance 0.6003,
 * 0.3442 and 0.1989. Deep #428a4e is 3.41:1 with ink, shallow #b4d872 8.91:1.
 */
export const DUSK_WATER_SHALLOW = '#b4d872';
export const DUSK_WATER_MID = '#6fae5c';
export const DUSK_WATER_DEEP = '#428a4e';
/** Dusk haze: a warm amber. Over the deep stop it lightens it (to luminance 0.2186), so the contrast rule holds. */
export const DUSK_HAZE = 'rgba(225,170,95,0.12)';
/** Dusk surface line: a warmer cream than the pond's. */
export const DUSK_SURFACE_LINE = 'rgba(255,236,204,0.95)';
/**
 * Dusk mud bed (guide 7a, derived, provisional): the pond mud, warmer and dimmer.
 * Top #b09060 (luminance 0.3002), bottom #9a7c4c (0.2181, 3.67:1 with ink), lip
 * #d4b884 (0.4994). Mud dots #78602f at 0.40 (the pond's 0.45, so the dimmer bed
 * keeps the rule) over the bottom stop blend to #8c7140, luminance 0.1776 (3.12:1).
 */
export const DUSK_BED_TOP = '#b09060';
export const DUSK_BED_BOTTOM = '#9a7c4c';
export const DUSK_BED_LIP = '#d4b884';
export const DUSK_MUD = 'rgba(120,96,47,0.40)';
/**
 * Dusk edge reeds (guide 7a, derived, provisional): the pond reeds a little warmer.
 * Stalk #4a8848 (luminance 0.1953), light stalk #5a9646 (0.2443), leaf #68a644
 * (0.3063), and the pond cattail #a8693a (0.1873). All are 3:1 or better with ink.
 */
export const DUSK_REED_STALK = '#4a8848';
export const DUSK_REED_STALK_LIGHT = '#5a9646';
export const DUSK_REED_LEAF = '#68a644';
/** Fireflies per screen of a dusk area (issue #98: a few above the water). */
export const DUSK_FIREFLIES_PER_SCREEN = 2;

const POND_DUSK_LOOK: HabitatLook = Object.freeze({
  id: 'pond-dusk',
  sky: Object.freeze({ top: DUSK_SKY_TOP, horizon: DUSK_SKY_HORIZON }),
  airWash: DUSK_AIR_WASH,
  rayAlphaScale: DUSK_RAY_ALPHA_SCALE,
  water: Object.freeze({
    shallow: DUSK_WATER_SHALLOW,
    mid: DUSK_WATER_MID,
    deep: DUSK_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: DUSK_HAZE,
  surfaceFill: DUSK_WATER_SHALLOW,
  surfaceLine: DUSK_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: DUSK_BED_TOP,
    bottom: DUSK_BED_BOTTOM,
    lip: DUSK_BED_LIP,
    mud: DUSK_MUD,
    mudCount: 22,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 5,
  }),
  edgeReeds: Object.freeze({
    stalk: DUSK_REED_STALK,
    stalkLight: DUSK_REED_STALK_LIGHT,
    leaf: DUSK_REED_LEAF,
    cattail: POND_CATTAIL,
  }),
  stream: true,
  cave: Object.freeze({ kind: 'rootArch', anchor: 'bank' }),
  pondProps: true,
  firefliesPerScreen: DUSK_FIREFLIES_PER_SCREEN,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Chinampa water (guide 3c, derived, provisional): a clear green-teal, cooler than the
 * pond's yellow-green and still greener than the canal's aqua and blue (hue 153 / 165 /
 * 171 against the pond's 96 / 130 / 146 and the canal's 175 / 187 / 207). Luminance
 * 0.6561, 0.4072 and 0.1863. Deep #1e8676, the darker bottom row's water, is 3.24:1
 * with ink, shallow #7ee8b8 is 9.68:1.
 */
export const CHINAMPA_WATER_SHALLOW = '#7ee8b8';
export const CHINAMPA_WATER_MID = '#3dbf9e';
export const CHINAMPA_WATER_DEEP = '#1e8676';
/** Chinampa haze: a cool sea green. Lightens the mid and deep stops (deep to luminance 0.2113); over shallow it dims 0.6561 to about 0.63, far above the floor. */
export const CHINAMPA_HAZE = 'rgba(70,200,160,0.12)';
/** Chinampa surface line: the canal line cooled toward a pale mint. */
export const CHINAMPA_SURFACE_LINE = 'rgba(232,255,244,0.95)';
/**
 * Chinampa silt bed (guide 7a, derived, provisional): dark garden silt in a mossy olive,
 * greener than the pond's tan mud. Top #9aa268 (luminance 0.3371, 5.31:1 with ink),
 * bottom #7d8a54 (0.2318, 3.86:1), lip #c9cf8e (0.5900). Mud dots #687642 at 0.45 over
 * the bottom stop blend to #74814c, luminance 0.1994 (3.4:1 or better with ink, 0.2216
 * under the haze).
 */
export const CHINAMPA_BED_TOP = '#9aa268';
export const CHINAMPA_BED_BOTTOM = '#7d8a54';
export const CHINAMPA_BED_LIP = '#c9cf8e';
export const CHINAMPA_MUD = 'rgba(104,118,66,0.45)';

const CHINAMPA_LOOK: HabitatLook = Object.freeze({
  id: 'chinampa',
  sky: DAY_SKY,
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: CHINAMPA_WATER_SHALLOW,
    mid: CHINAMPA_WATER_MID,
    deep: CHINAMPA_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: CHINAMPA_HAZE,
  surfaceFill: CHINAMPA_WATER_SHALLOW,
  surfaceLine: CHINAMPA_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: CHINAMPA_BED_TOP,
    bottom: CHINAMPA_BED_BOTTOM,
    lip: CHINAMPA_BED_LIP,
    mud: CHINAMPA_MUD,
    // Rich garden silt: many dots, few pebbles.
    mudCount: 20,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 4,
  }),
  // No reeds at the edges: the chinampa banks, crops and willow roots carry the edges.
  edgeReeds: null,
  stream: false,
  cave: Object.freeze({ kind: 'rootTangle', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  // Garden plots with crops and ahuejote roots, not the canal's willow bank; the gap between two
  // chinampas gets its edges; the overhangs, gap edges, ghost nets and snag cue are baked for it.
  bank: 'plots',
  currentGap: true,
  chinampaProps: true,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Spring cave water (issue #77, derived, provisional): clear, cold blue, paler and greyer than the
 * canal's aqua-to-deep-blue (hue 198 / 202 / 205 against the canal's 175 / 187 / 207). Luminance
 * 0.7069, 0.4623 and 0.2652. Deep #4f93c4 is 4.32:1 with ink, shallow #b4e2f5 is 10.38:1.
 */
export const SPRING_CAVE_WATER_SHALLOW = '#b4e2f5';
export const SPRING_CAVE_WATER_MID = '#7cbde3';
export const SPRING_CAVE_WATER_DEEP = '#4f93c4';
/** Spring cave haze: a cold pale blue. Lightens every water stop (deep to luminance 0.2940), so the contrast rule above still holds. */
export const SPRING_CAVE_HAZE = 'rgba(150,205,240,0.12)';
/** Spring cave surface line: the canal line cooled toward an icy white. */
export const SPRING_CAVE_SURFACE_LINE = 'rgba(240,250,255,0.95)';
/**
 * Spring cave ceiling (issue #77, derived, provisional): the sky band is the cave's grey-blue
 * rock roof, darker at the top and paler at the waterline. Top #9fb2c8 (luminance 0.4338, 6.63:1
 * with ink) and horizon #c3d1df (0.6253, 9.26:1).
 */
export const SPRING_CAVE_SKY_TOP = '#9fb2c8';
export const SPRING_CAVE_SKY_HORIZON = '#c3d1df';
/**
 * Spring cave rock bed (issue #77, derived, provisional): grey-blue rock. Top #93a5ba (luminance
 * 0.3666, 5.71:1 with ink), bottom #7a8da6 (0.2594, 4.24:1), lip #bccadb (0.5805). Rock chips
 * #46587a at 0.35 over the bottom stop blend to #687a97, luminance 0.1910 (3.30:1 with ink).
 */
export const SPRING_CAVE_BED_TOP = '#93a5ba';
export const SPRING_CAVE_BED_BOTTOM = '#7a8da6';
export const SPRING_CAVE_BED_LIP = '#bccadb';
export const SPRING_CAVE_MUD = 'rgba(70,88,122,0.35)';

/**
 * Spring cave look (issue #77): clear cold blue water over a grey-blue rock bed, under a rock
 * ceiling. No stream, no reeds, no bank in the water chunks, no pond props. The hiding place is the
 * side grotto on the bed; the rows get the spring cave details and the props are the spring cave's.
 */
export const SPRING_CAVE_LOOK: HabitatLook = Object.freeze({
  id: 'spring-cave',
  sky: Object.freeze({ top: SPRING_CAVE_SKY_TOP, horizon: SPRING_CAVE_SKY_HORIZON }),
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: SPRING_CAVE_WATER_SHALLOW,
    mid: SPRING_CAVE_WATER_MID,
    deep: SPRING_CAVE_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: SPRING_CAVE_HAZE,
  surfaceFill: SPRING_CAVE_WATER_SHALLOW,
  surfaceLine: SPRING_CAVE_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: SPRING_CAVE_BED_TOP,
    bottom: SPRING_CAVE_BED_BOTTOM,
    lip: SPRING_CAVE_BED_LIP,
    mud: SPRING_CAVE_MUD,
    // Bare rock: a few chips, a good many pebbles.
    mudCount: 10,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 12,
  }),
  edgeReeds: null,
  stream: false,
  cave: Object.freeze({ kind: 'grotto', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'springCave',
  springCaveProps: true,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Deep canal water (issue #78, derived, provisional): a deep, dark blue-green, bluer and darker than
 * the chinampa's green-teal and the canal's bright aqua (hue 187 / 191 / 194 against the chinampa's
 * 153 / 165 / 171). Luminance 0.3695, 0.2489 and 0.1809. Deep #21809a, the floor of the rule, is
 * 3.17:1 with ink, shallow #46b2c0 is 5.75:1. The light sage bass (#b9d97a) is 2.87:1 against the
 * deep stop and 2.22:1 against the mid stop, and its ink outline carries the rest.
 */
export const DEEP_CANAL_WATER_SHALLOW = '#46b2c0';
export const DEEP_CANAL_WATER_MID = '#2a95aa';
export const DEEP_CANAL_WATER_DEEP = '#21809a';
/** Deep canal haze: a cool, murky teal. Lightens every water stop (deep to luminance 0.1969), so the contrast rule above still holds. */
export const DEEP_CANAL_HAZE = 'rgba(60,170,200,0.12)';
/** Deep canal surface line: the canal line cooled toward a pale aqua. */
export const DEEP_CANAL_SURFACE_LINE = 'rgba(224,248,252,0.95)';
/**
 * Deep canal old-stone bed (issue #78, derived, provisional): a blue-grey silt over old paving, cooler
 * and bluer than the sage stones painted on it (drawDeepCanal.ts), so the stones still read. Top
 * #6d8ca0 (luminance 0.2455, 4.05:1 with ink), bottom #5c7d94 (0.1908, 3.30:1), lip #a9c0cc (0.5049).
 * Silt dots #506c84 at 0.4 over the bottom stop blend to #57768e, luminance 0.1694 (3.01:1 with ink).
 */
export const DEEP_CANAL_BED_TOP = '#6d8ca0';
export const DEEP_CANAL_BED_BOTTOM = '#5c7d94';
export const DEEP_CANAL_BED_LIP = '#a9c0cc';
export const DEEP_CANAL_MUD = 'rgba(80,108,132,0.4)';

/**
 * Deep canal look (issue #78): dark blue-green water over a blue-grey old-stone bed, under the day
 * sky. No stream, no reeds, no spring cave rows, no pond props. The banks keep the canal's willow
 * soil, and the zone's bank overhangs are drawn as moored hulls. The hiding place is the sunken old
 * trajinera hull on the bed; the old canal-bed stones are painted into the bottom chunks.
 */
export const DEEP_CANAL_LOOK: HabitatLook = Object.freeze({
  id: 'deep-canal',
  sky: DAY_SKY,
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: DEEP_CANAL_WATER_SHALLOW,
    mid: DEEP_CANAL_WATER_MID,
    deep: DEEP_CANAL_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: DEEP_CANAL_HAZE,
  surfaceFill: DEEP_CANAL_WATER_SHALLOW,
  surfaceLine: DEEP_CANAL_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: DEEP_CANAL_BED_TOP,
    bottom: DEEP_CANAL_BED_BOTTOM,
    lip: DEEP_CANAL_BED_LIP,
    mud: DEEP_CANAL_MUD,
    // Old paving under silt: a few dots, a few pebbles; the stones carry the bed.
    mudCount: 8,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 6,
  }),
  edgeReeds: null,
  stream: false,
  cave: Object.freeze({ kind: 'sunkenHull', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: true,
  bedStones: true,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: false,
  depthBands: false,
  volcanoHorizon: false,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Golden-hour sky (issue #112, derived, provisional): coral at the top to peach at the horizon, under
 * a warm wash. Seen through the wash: #f2a78c (luminance 0.4841) and #ffd1a1 (0.6943).
 */
export const GOLDEN_SKY_TOP = '#f0a890';
export const GOLDEN_SKY_HORIZON = '#ffd8a8';
/** Golden-hour wash over the sky, sun, clouds, bank and willows: a soft warm coral. */
export const GOLDEN_AIR_WASH = 'rgba(255,160,110,0.12)';
/**
 * Golden-hour water (issue #112, derived, provisional): the low sun warms the shallow water to a soft
 * gold-green and the mid water to a warmer teal, fading to the deep canal's own deep stop, so the
 * lower rows and the flat middle chunks keep their colour. Luminance 0.5062, 0.3124 and 0.1809 (the
 * deep stop, 3.17:1 with ink). Shallow #c2bf8c stays under the Leucistic body (0.5963), so the hero
 * stays the brightest thing in the water.
 */
export const GOLDEN_WATER_SHALLOW = '#c2bf8c';
export const GOLDEN_WATER_MID = '#5fa3a2';
export const GOLDEN_WATER_DEEP = DEEP_CANAL_WATER_DEEP;
/** Golden-hour haze: a warm cream. Lightens every water stop (deep to #3b8a9a, luminance 0.2144) and the bed, so the contrast rule holds. */
export const GOLDEN_HAZE = 'rgba(250,210,150,0.12)';
/** Golden-hour surface line: the canal line warmed toward a soft gold cream. */
export const GOLDEN_SURFACE_LINE = 'rgba(255,240,206,0.95)';
/** Golden-hour light rays: a warm gold, slanting further than the day rays (the sun is low). */
export const GOLDEN_RAY_TINT: RgbTriple = Object.freeze([255, 222, 160] as const);
export const GOLDEN_RAY_SLANT = 130;
/** Marigold petals sinking through the water, per screen of area width (issue #112, ND-13: at most one). */
export const GOLDEN_SINKING_PETALS_PER_SCREEN = 1;

/**
 * Deep canal at golden hour (issue #112, Area 11): the deep canal look with the golden sky, wash,
 * water, haze, surface line and rays, its lower row lit, its decorations painted into its chunks and
 * at most one sinking petal per screen. The bed, the bed stones, the sunken hull cave, the deep canal props and the
 * willow bank are the deep canal's own.
 */
export const DEEP_CANAL_GOLDEN_LOOK: HabitatLook = Object.freeze({
  ...DEEP_CANAL_LOOK,
  id: 'deep-canal-golden',
  sky: Object.freeze({ top: GOLDEN_SKY_TOP, horizon: GOLDEN_SKY_HORIZON }),
  airWash: GOLDEN_AIR_WASH,
  water: Object.freeze({
    shallow: GOLDEN_WATER_SHALLOW,
    mid: GOLDEN_WATER_MID,
    deep: GOLDEN_WATER_DEEP,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: GOLDEN_HAZE,
  surfaceFill: GOLDEN_WATER_SHALLOW,
  surfaceLine: GOLDEN_SURFACE_LINE,
  rayTint: GOLDEN_RAY_TINT,
  raySlant: GOLDEN_RAY_SLANT,
  lowerRowLight: true,
  goldenDecor: true,
  sinkingPetalsPerScreen: GOLDEN_SINKING_PETALS_PER_SCREEN,
});

/**
 * Open lake water (issue #211, ND-15): band 1, the sunlit blue-green of the shallows (drawLake.ts
 * LAKE_WATER_BANDS), is the look's own water; band 2, the dusky blue, is drawn by depth. Every stop
 * and every haze blend is at the luminance floor 0.1687 or more.
 */
const LAKE_BAND_1 = lakeWaterBand(1);
/** Open lake surface line: the canal line cooled toward a pale aqua-white. */
export const OPEN_LAKE_SURFACE_LINE = 'rgba(236,252,250,0.95)';

/**
 * Open lake look (issue #211, Area 12; owner look decision Q10): a wide open sky with the volcanoes
 * small on the horizon, band 1 water, and a lakebed of silt, smooth stones and tule roots. No stream,
 * no reeds at the edges, no bank, no pond props. The cave kind is smooth stones: scenery only, never
 * a hiding place (ND-17).
 */
export const OPEN_LAKE_LOOK: HabitatLook = Object.freeze({
  id: 'open-lake',
  sky: Object.freeze({ top: LAKE_SKY_TOP, horizon: LAKE_SKY_HORIZON }),
  airWash: null,
  rayAlphaScale: 1,
  water: Object.freeze({
    shallow: LAKE_BAND_1.shallow,
    mid: LAKE_BAND_1.mid,
    deep: LAKE_BAND_1.deep,
    stopMid: WATER_STOP_MID,
    gradientEndY: WATER_GRADIENT_END_Y,
  }),
  haze: LAKE_BAND_1.haze,
  surfaceFill: LAKE_BAND_1.shallow,
  surfaceLine: OPEN_LAKE_SURFACE_LINE,
  surfaceLineWidth: SURFACE_LINE_WIDTH,
  bed: Object.freeze({
    top: LAKE_SILT_TOP,
    bottom: LAKE_SILT_BOTTOM,
    lip: LAKE_LIP,
    mud: LAKE_SILT_FLECK_DARK,
    // The lakebed painter draws the bed (silt, stones, roots); these counts are for the canal bed painter, unused here.
    mudCount: 10,
    pebbles: PEBBLE_COLOURS,
    pebbleShine: PEBBLE_SHINE,
    pebbleCount: 4,
  }),
  edgeReeds: null,
  stream: false,
  cave: Object.freeze({ kind: 'rocks', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
  rowDetails: 'none',
  springCaveProps: false,
  deepCanalProps: false,
  bedStones: false,
  rayTint: DAY_RAY_TINT,
  raySlant: DAY_RAY_SLANT,
  lowerRowLight: false,
  goldenDecor: false,
  sinkingPetalsPerScreen: 0,
  lakebed: true,
  depthBands: true,
  volcanoHorizon: true,
  streamingClouds: false,
  pitShafts: false,
});

/** Open lake in the wind (issue #211, Area 12): the open lake look with its clouds streaming out to the left. */
export const OPEN_LAKE_WINDY_LOOK: HabitatLook = Object.freeze({
  ...OPEN_LAKE_LOOK,
  id: 'open-lake-windy',
  streamingClouds: true,
});

/**
 * Open lake still (issue #212, Area 13; guide 7a): the open lake overcast and still. An overcast
 * grey-blue sky, #8a9bad (luminance 0.3186) at the top to #c4ced8 (0.6084) at the horizon, and a flat cool
 * grey air wash over the sky band only. Through the wash the sky is #8a9aab (0.3155) and #bbc5cf (0.5503).
 */
export const OPEN_LAKE_STILL_SKY_TOP = '#8a9bad';
export const OPEN_LAKE_STILL_SKY_HORIZON = '#c4ced8';
export const OPEN_LAKE_STILL_AIR_WASH = 'rgba(140,150,160,0.16)';
/** The still lake's light rays, at half the open lake's strength (guide 7a). */
export const OPEN_LAKE_STILL_RAY_ALPHA_SCALE = 0.5;

/**
 * Open lake, overcast and still (issue #212, Area 13): the open lake look with the grey sky and wash,
 * rays at half strength and the three ordinary day clouds (no streaming clouds). Water by depth band, haze,
 * surface line, lakebed, volcano horizon and the day sun are the open lake's own.
 */
export const OPEN_LAKE_STILL_LOOK: HabitatLook = Object.freeze({
  ...OPEN_LAKE_LOOK,
  id: 'open-lake-still',
  sky: Object.freeze({ top: OPEN_LAKE_STILL_SKY_TOP, horizon: OPEN_LAKE_STILL_SKY_HORIZON }),
  airWash: OPEN_LAKE_STILL_AIR_WASH,
  rayAlphaScale: OPEN_LAKE_STILL_RAY_ALPHA_SCALE,
  streamingClouds: false,
  pitShafts: false,
});

/**
 * Open lake late (issue #213, Area 14; owner look decision Q10, ND-2): the open lake in the late
 * afternoon. A warm sky, apricot #f4b393 (luminance 0.5358) at the top to peach #ffd9ae (0.7394) at
 * the horizon, under a soft warm wash. Through the wash the sky is #f5b28f (0.5324) and #ffd4a8 (0.7117).
 * The rays are the golden hour's (warm gold, the longer golden slant), and the pit shafts carry them
 * down into band 2 of the pits.
 */
export const OPEN_LAKE_LATE_SKY_TOP = '#f4b393';
export const OPEN_LAKE_LATE_SKY_HORIZON = '#ffd9ae';
export const OPEN_LAKE_LATE_AIR_WASH = 'rgba(255,165,110,0.10)';

/**
 * Open lake, late afternoon (issue #213, Area 14): the open lake look with the warm sky and wash, the
 * golden rays at the golden slant, pit shafts, and the three ordinary day clouds (no streaming clouds).
 * Water by depth band, haze, surface line, lakebed, volcano horizon and the day sun are the open lake's own.
 */
export const OPEN_LAKE_LATE_LOOK: HabitatLook = Object.freeze({
  ...OPEN_LAKE_LOOK,
  id: 'open-lake-late',
  sky: Object.freeze({ top: OPEN_LAKE_LATE_SKY_TOP, horizon: OPEN_LAKE_LATE_SKY_HORIZON }),
  airWash: OPEN_LAKE_LATE_AIR_WASH,
  rayTint: GOLDEN_RAY_TINT,
  raySlant: GOLDEN_RAY_SLANT,
  streamingClouds: false,
  pitShafts: true,
});

const LOOKS: Readonly<Record<AreaLookId, HabitatLook>> = {
  canal: CANAL_LOOK,
  pond: POND_LOOK,
  chinampa: CHINAMPA_LOOK,
  'pond-dusk': POND_DUSK_LOOK,
  'spring-cave': SPRING_CAVE_LOOK,
  'deep-canal': DEEP_CANAL_LOOK,
  'deep-canal-golden': DEEP_CANAL_GOLDEN_LOOK,
  'open-lake': OPEN_LAKE_LOOK,
  'open-lake-windy': OPEN_LAKE_WINDY_LOOK,
  'open-lake-still': OPEN_LAKE_STILL_LOOK,
  'open-lake-late': OPEN_LAKE_LATE_LOOK,
};

/** Every shipped habitat look id, in habitat order. Area-map markers are keyed by these. */
export const HABITAT_LOOK_IDS: readonly HabitatLookId[] = ['canal', 'pond', 'chinampa', 'spring-cave', 'deep-canal', 'open-lake'];

/** Every shipped area look id: the habitat looks, then the per-area variants. */
export const AREA_LOOK_IDS: readonly AreaLookId[] = [...HABITAT_LOOK_IDS, 'pond-dusk', 'deep-canal-golden', 'open-lake-windy', 'open-lake-still', 'open-lake-late'];

export function isHabitatLookId(id: string): id is HabitatLookId {
  return (HABITAT_LOOK_IDS as readonly string[]).includes(id);
}

export function isAreaLookId(id: string): id is AreaLookId {
  return (AREA_LOOK_IDS as readonly string[]).includes(id);
}

/**
 * The look for a habitat's `look` id or an area's look variant id. Throws a RangeError
 * for an unknown id, so a typo never falls back to the canal.
 */
export function habitatLook(id: string): HabitatLook {
  if (!isAreaLookId(id)) throw new RangeError(`unknown habitat look "${id}"`);
  return LOOKS[id];
}
