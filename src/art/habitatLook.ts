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
 * Area looks (issue #98): an area may use a variant of its habitat's look, such as
 * the pond at dusk ('pond-dusk', Area 3). A variant is a whole palette baked into the
 * background, haze and surface, never an overlay over gameplay depths. The dusk pond
 * keeps the pond contrast rule above. Each look also says what its area needs beside
 * colours (stream, cave, pond props, fireflies), so callers read properties and never
 * compare look ids.
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

/** Look ids shipped so far. Must match the logic layer's Habitat.look values. */
export type HabitatLookId = 'canal' | 'pond' | 'chinampa' | 'spring-cave';

/** Every look an area can use: a habitat's own look, or a variant of it for one area (the pond at dusk, Area 3). */
export type AreaLookId = HabitatLookId | 'pond-dusk';

/** Sky gradient (guide 7a): `top` at y 0 down to `horizon` at the surface. */
export interface SkyLook {
  readonly top: string;
  readonly horizon: string;
}

/**
 * The hiding place an area's cave is drawn as (guide 7e): the canal's rocks, the pond's hollow log,
 * the dusk pond's root arch, or the chinampa's tangle of ahuejote roots.
 */
export type CaveKind = 'rocks' | 'log' | 'rootArch' | 'rootTangle';
/** Where a cave hangs: base centre on the bed, or top centre under the bank at the waterline. */
export type CaveAnchor = 'bed' | 'bank';

/**
 * How the banks of the top row are drawn (guide 7a, 7b): the canal's soil block with a grass cap under
 * willows, or the chinampa's garden plots (crops above the surface, ahuejote roots in the water).
 */
export type BankStyle = 'willows' | 'plots';

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
}

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
 * ceiling. No stream, no reeds, no bank in the water chunks, no pond props. The hiding place is a
 * heap of rocks on the bed, like the canal's.
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
  cave: Object.freeze({ kind: 'rocks', anchor: 'bed' }),
  pondProps: false,
  firefliesPerScreen: 0,
  bank: 'willows',
  currentGap: false,
  chinampaProps: false,
});

const LOOKS: Readonly<Record<AreaLookId, HabitatLook>> = {
  canal: CANAL_LOOK,
  pond: POND_LOOK,
  chinampa: CHINAMPA_LOOK,
  'pond-dusk': POND_DUSK_LOOK,
  'spring-cave': SPRING_CAVE_LOOK,
};

/** Every shipped habitat look id, in habitat order. Area-map markers are keyed by these. */
export const HABITAT_LOOK_IDS: readonly HabitatLookId[] = ['canal', 'pond', 'chinampa', 'spring-cave'];

/** Every shipped area look id: the habitat looks, then the per-area variants. */
export const AREA_LOOK_IDS: readonly AreaLookId[] = [...HABITAT_LOOK_IDS, 'pond-dusk'];

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
