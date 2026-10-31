import { CANAL_TREASURES, type Rarity, type Treasure } from './catalogue';
import { snackWander, type SnackWander } from './collectibles';
import {
  elementSweep,
  hazardSweep,
  shapeDistance,
  type ElementSpawn,
  type ElementType,
  type HazardRect,
  type HazardSpawn,
} from './hazards';
import type { DarkWater } from './glowPlants';
import type { MobileSnackMix } from './mobileSnacks';
import type { RockWall } from './pebble';
import { movingHazardSweep, type MovingHazardSpawn } from './movingHazards';
import type { PredatorRoute } from './predators';
import { mulberry32 } from './rng';
import { trajineraHullBand, type TrajineraSpawn } from './trajineras';
import { FINDS, type TilapiaTuning } from './tuning';

/** Height of one screen in world px; the canal is one screen tall. */
export const WORLD_H = 360;
/** Water surface y in every area. */
export const SURF = 80;
/** Top of the bed in a one-screen-tall area such as the canal. */
export const BED_TOP = 318;
/** Width of one screen in world px. */
export const SCREEN_W = 480;
/** Depth of the bed below the water in every area: WORLD_H - BED_TOP. */
export const BED_DEPTH = WORLD_H - BED_TOP;
/** Screens across the canal. */
export const ZONE_SCREENS = 4;
/** Width of the canal in world px. */
export const ZONE_W = SCREEN_W * ZONE_SCREENS;

export const DEFAULT_ZONE_SEED = 0xa70107;
export const CANAL_AREA_ID = 'canal';

const TAU = Math.PI * 2;
const REED_SPREAD = 20;
const REED_PATCH_PAD = 10;
const REED_DRAG_MUL = 2.5;
const REED_BASE_Y = 326;
const SNACK_MIN_SPACING = 40;
const SNACK_START_CLEARANCE = 90;
const SNACK_MAX_ATTEMPTS = 400;
/**
 * Minimum distance in px from every snack start to every hazard's drift sweep (hazardSweep), every
 * element sweep, every moving hazard's sweep and every gliding trajinera's hull band.
 */
export const SNACK_HAZARD_CLEARANCE = 80;
const SPOT_HOME_CLEARANCE = FINDS.pickupRadius + 8;

/** One row of reed hiding spots: a spot at this depth in every column of its bed. */
export interface ReedSpotRow {
  y: number;
  rarity: Rarity;
  tag: string;
}

/** A reed bed: the first reeds stand on its columns, and its hiding spots sit on them. */
export interface ReedBed {
  columns: readonly number[];
  rows: readonly ReedSpotRow[];
}

/** A fixed hiding spot as area data: x, y, rarity and whether a Dash pot sits there. */
export type FixedSpotData = readonly [number, number, Rarity, boolean];

/** A tilapia patrol loop as area data: its waypoints as [x, y] pairs. */
export type RoutePoints = readonly (readonly [number, number])[];

/** Structural 2D point; matches any `{ x, y }` vector shape. */
export interface Point {
  x: number;
  y: number;
}

export interface ReedSpec {
  id: string;
  bx: number;
  by: number;
  tipY: number;
  lean: number;
  bend: number;
  phase: number;
  amp: number;
  cat: boolean;
  leafU: number;
  leafDir: -1 | 1;
  light: boolean;
}

export interface ReedPatch {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  dragMul: number;
}

export interface CurrentZone {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  force: Point;
}

export type CollectibleKind = 'worm' | 'bug' | 'tadpole' | 'shrimp';

export interface CollectibleSpawn {
  id: string;
  kind: CollectibleKind;
  x: number;
  y: number;
  /** A tadpole's wander loop from x and y (issue #131, ND-13); absent on every other snack. */
  wander?: SnackWander;
  /** A shrimp's hop spots in world px, the first at x and y (issue #131, ND-13); absent on every other snack. */
  home?: Point[];
}

export interface PadSpec {
  x: number;
  rx: number;
  flower: boolean;
}

/**
 * A lily pad at a fixed place, as area data. `spot` puts a hiding spot under it at depth `y`,
 * id `spot-pad-<tag>`; that spot is area data and never dropped.
 */
export interface FixedPadData {
  readonly x: number;
  readonly rx: number;
  readonly flower: boolean;
  readonly spot?: Readonly<{ y: number; rarity: 'common' | 'rare'; tag: string }>;
}

export interface SwimBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Home Spot safe area; the tilapia never enters it. Inclusive edges. */
export interface SafeArea {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Home Spot bank zone: the drawn ring, a circle centred on the zone start (provisional radius).
 * The axolotl is at the Home Spot when its centre is inside or on the circle. The tilapia
 * keep-out stays the rectangular SafeArea; the ring sits strictly inside it, so the tilapia
 * never enters the ring. Every find sits outside the SafeArea, so a trip always carries risk.
 * Rejected: banking anywhere in the SafeArea (no visible edge, larger bank zone) and a circular
 * SafeArea (rewrites the tilapia keep-out for no benefit).
 */
export interface HomeSpot {
  x: number;
  y: number;
  radius: number;
}

/** A catalogue treasure id plus the ids of every hiding spot it may be placed in. */
export interface FindSpawn {
  id: string;
  pool: string[];
}

/** Declared cover label of a hiding spot. */
export type HidingCover = 'reeds' | 'pad' | 'cave' | 'pastCurrent' | 'bank';

/**
 * One place a treasure may be hidden. `cover` and `rarity` are declared labels; the hiding rules
 * in hiding.ts check them against the geometry. `container` means a Dash pot sits here when a
 * treasure is placed.
 */
export interface HidingSpot {
  id: string;
  cover: HidingCover;
  rarity: Rarity;
  container: boolean;
  x: number;
  y: number;
}

/** Cave rectangle; inclusive edges. */
export interface CaveArea {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** An overhanging bank rectangle; what is under it is hidden. Inclusive edges. */
export interface BankOverhang {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** A fixed place where a stranded axolotl may wait to be rescued (PRD C2). */
export interface StrandingPlace {
  id: string;
  x: number;
  y: number;
}

/** Tilapia patrol loop: visits waypoints in order, then wraps to the first. */
export interface TilapiaRoute {
  id: string;
  waypoints: Point[];
}

export interface ZoneLayout {
  areaId: string;
  width: number;
  height: number;
  /** Top of the bed: height - BED_DEPTH. */
  bedTop: number;
  /** Screens across. */
  chunks: number;
  /** Screens down. */
  rows: number;
  start: Point;
  reeds: ReedSpec[];
  reedPatches: ReedPatch[];
  currents: CurrentZone[];
  collectibles: CollectibleSpawn[];
  pads: PadSpec[];
  bankChunks: number[];
  sunChunk: number;
  safeArea: SafeArea;
  tilapiaRoutes: TilapiaRoute[];
  predatorRoutes: PredatorRoute[];
  hazards: HazardSpawn[];
  elements: ElementSpawn[];
  homeSpot: HomeSpot;
  finds: FindSpawn[];
  spots: HidingSpot[];
  cave: CaveArea;
  mainPath: Point[];
  strandingPlaces: StrandingPlace[];
  /** The area's own tilapia tuning; absent means TILAPIA. */
  tilapia?: Readonly<TilapiaTuning>;
  /** Overhanging bank rectangles, the bank cover; absent means none. */
  bankOverhangs?: BankOverhang[];
  /** Moving hazards (ND-8); absent means none. */
  movingHazards?: MovingHazardSpawn[];
  /** Mobile snacks (ND-23); absent means none. Their spawns are in `collectibles`. */
  mobileSnacks?: MobileSnackMix;
  /** The dark part of the area (issue #77, ND-7); absent means the whole area is lit. */
  darkWater?: DarkWater;
  /** Solid rock walls (issue #105, ND-8); absent means none. */
  rockWalls?: RockWall[];
  /** Walled side rooms behind a pebble (issue #105, ND-8); absent means none. */
  sideRooms?: RockWall[];
  /** Gliding trajineras (issue #78, ND-8); absent means none. Never in `elements`. */
  trajineras?: TrajineraSpawn[];
}

/** An area's size in world px. */
export interface AreaSize {
  width: number;
  height: number;
  bedTop: number;
}

/**
 * Everything buildZone reads to build one area's layout. Fixed data only: the seed adds the reed
 * shapes, snacks and the seeded pads.
 */
export interface AreaLayoutData {
  /** Area id; prefixes the hiding spot ids. */
  readonly id: string;
  readonly screensWide: number;
  readonly screensTall: number;
  readonly start: Readonly<Point>;
  /** Home Spot safe area; no predator enters it. */
  readonly safeArea: Readonly<SafeArea>;
  readonly homeSpotRadius: number;
  readonly reedBeds: readonly Readonly<ReedBed>[];
  readonly caveSpots: readonly FixedSpotData[];
  readonly currentSpots: readonly FixedSpotData[];
  readonly currents: readonly Readonly<CurrentZone>[];
  readonly cave: Readonly<CaveArea>;
  readonly tilapiaRoutes: readonly RoutePoints[];
  readonly predatorRoutes: readonly Readonly<PredatorRoute>[];
  readonly hazards: readonly Readonly<HazardSpawn>[];
  readonly elements: readonly Readonly<ElementSpawn>[];
  readonly mainPath: readonly Readonly<Point>[];
  readonly strandingPlaces: readonly Readonly<StrandingPlace>[];
  /** Catalogue treasures hidden in this area, in catalogue order. */
  readonly treasures: readonly Treasure[];
  readonly snackWorms: number;
  readonly snackBugs: number;
  /**
   * How many snacks are placed inside the first current on purpose; 0 when the area has no current.
   * A floor, not an exact count: stripe snacks may also start there (ADR 0022).
   */
  readonly snacksInCurrent: number;
  /** How many seeded pads; 0 makes none and no rand() draws. */
  readonly padCount: number;
  /** Index of the seeded pad with a hiding spot under it; null when no seeded pad has one. */
  readonly padSpotIndex: number | null;
  readonly padSpotY: number;
  /** Pads at fixed places, after the seeded pads; absent means none. */
  readonly fixedPads?: readonly Readonly<FixedPadData>[];
  readonly bankChunks: readonly number[];
  readonly sunChunk: number;
  /** The area's own tilapia tuning; absent means TILAPIA. */
  readonly tilapia?: Readonly<TilapiaTuning>;
  /** Overhanging bank rectangles, the bank cover; absent means none. Never derived from bankChunks. */
  readonly bankOverhangs?: readonly Readonly<BankOverhang>[];
  /** Fixed hiding spots under the overhanging bank, ids `spot-bank-<n>`, after the fixed pads; absent means none. */
  readonly bankSpots?: readonly FixedSpotData[];
  /** Moving hazards, built with movingHazardSpawn() (ND-8); absent means none. */
  readonly movingHazards?: readonly Readonly<MovingHazardSpawn>[];
  /**
   * Mobile snacks, built with mobileSnackMix() (ND-23): fixed area data, never seeded. Absent means
   * none.
   */
  readonly mobileSnacks?: Readonly<MobileSnackMix>;
  /** The dark part of the area (issue #77, ND-7): fixed area data, never seeded. Absent means none. */
  readonly darkWater?: Readonly<DarkWater>;
  /**
   * Solid rock walls (issue #105, ND-8): fixed area data, never seeded. The axolotl's body never
   * enters one (blockAtRock), and no snack starts within SNACK_HAZARD_CLEARANCE of one. Absent means none.
   */
  readonly rockWalls?: readonly Readonly<RockWall>[];
  /**
   * Walled side rooms behind a pebble (issue #105, ND-8): the water inside the walls, reached only
   * once the pebble rolls. No snack starts within SNACK_HAZARD_CLEARANCE of one, so the exit never
   * needs the pebble. Absent means none.
   */
  readonly sideRooms?: readonly Readonly<RockWall>[];
  /**
   * Gliding trajineras, built with trajineraSpawn() (issue #78, ND-8): fixed area data, never seeded
   * and never in `elements`. No snack starts within SNACK_HAZARD_CLEARANCE of a boat's hull band
   * (trajineraHullBand). Absent means none.
   */
  readonly trajineras?: readonly Readonly<TrajineraSpawn>[];
}

/** The canal cave. */
export const CAVE: Readonly<CaveArea> = Object.freeze({ id: `${CANAL_AREA_ID}/cave`, x0: 1480, x1: 1640, y0: 200, y1: 318 });

/** The main swim path: the middle of the canal from the Home Spot to the far end. */
export const MAIN_PATH: readonly Readonly<Point>[] = Object.freeze([
  Object.freeze({ x: 120, y: 200 }),
  Object.freeze({ x: 1840, y: 200 }),
]);

/**
 * Fixed canal stranding places (PRD C2), left to right: near the start above the first reeds, on
 * the bed under the current, in the open water above the reeds between the past-current stones and
 * the cave, and at the far end. Every place is at least 80 px from every tilapia route. Area data,
 * never seeded.
 */
export const STRANDING_PLACES: readonly Readonly<StrandingPlace>[] = Object.freeze([
  Object.freeze({ id: `${CANAL_AREA_ID}/strand-1`, x: 320, y: 110 }),
  Object.freeze({ id: `${CANAL_AREA_ID}/strand-2`, x: 880, y: 292 }),
  Object.freeze({ id: `${CANAL_AREA_ID}/strand-3`, x: 1340, y: 220 }),
  Object.freeze({ id: `${CANAL_AREA_ID}/strand-4`, x: 1860, y: 260 }),
]);

/** The canal, Area 1, as area data: 4 screens across, 1 down. */
export const CANAL_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: CANAL_AREA_ID,
  screensWide: ZONE_SCREENS,
  screensTall: 1,
  start: Object.freeze({ x: 120, y: 200 }),
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: BED_TOP }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([
    Object.freeze({
      columns: Object.freeze([316, 372, 428, 484]),
      rows: Object.freeze([
        Object.freeze({ y: 172, rarity: 'common', tag: 'a' }),
        Object.freeze({ y: 228, rarity: 'common', tag: 'b' }),
      ]),
    }),
    Object.freeze({
      columns: Object.freeze([580, 640] as const),
      rows: Object.freeze([Object.freeze({ y: 110, rarity: 'rare', tag: 'top' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1316, 1376, 1436]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
    Object.freeze({
      columns: Object.freeze([1700]),
      rows: Object.freeze([Object.freeze({ y: 288, rarity: 'rare', tag: 'deep' })]),
    }),
  ]),
  caveSpots: Object.freeze([
    Object.freeze([1492, 206, 'legendary', true] as const),
    Object.freeze([1552, 206, 'legendary', true] as const),
    Object.freeze([1612, 206, 'legendary', true] as const),
    Object.freeze([1492, 266, 'epic', false] as const),
    Object.freeze([1552, 266, 'epic', false] as const),
    Object.freeze([1612, 266, 'epic', false] as const),
  ]),
  currentSpots: Object.freeze([
    Object.freeze([1200, 140, 'legendary', true] as const),
    Object.freeze([1200, 200, 'legendary', true] as const),
    Object.freeze([1200, 260, 'legendary', true] as const),
    Object.freeze([1260, 140, 'epic', false] as const),
    Object.freeze([1260, 200, 'epic', false] as const),
    Object.freeze([1260, 260, 'epic', false] as const),
  ]),
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 760, x1: 1160, y0: 120, y1: 280, force: Object.freeze({ x: -70, y: 0 }) }),
  ]),
  cave: CAVE,
  /**
   * Three fixed patrol loops, left to right along the canal. The closest two, `tilapia-1` and
   * `tilapia-2`, are 287 px apart, more than twice the lunge range of 140 px.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([700, 262] as const),
      Object.freeze([790, 262] as const),
      Object.freeze([790, 296] as const),
      Object.freeze([700, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1080, 100] as const),
      Object.freeze([1145, 100] as const),
      Object.freeze([1145, 296] as const),
      Object.freeze([1080, 296] as const),
    ]),
    Object.freeze([
      Object.freeze([1432, 110] as const),
      Object.freeze([1588, 110] as const),
      Object.freeze([1588, 144] as const),
      Object.freeze([1432, 144] as const),
    ]),
  ]),
  predatorRoutes: Object.freeze([]),
  hazards: Object.freeze([]),
  elements: Object.freeze([]),
  mainPath: MAIN_PATH,
  strandingPlaces: STRANDING_PLACES,
  treasures: CANAL_TREASURES,
  snackWorms: 10,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 6,
  padSpotIndex: 2,
  padSpotY: 100,
  bankChunks: Object.freeze([1, 3] as const),
  sunChunk: 0,
} satisfies AreaLayoutData);

/** Minimum distance between two hiding spots, so one pickup radius never reaches two spots. */
export const SPOT_MIN_SPACING = 2 * FINDS.pickupRadius + 8;

/** Water surface height at world x and time t (seconds); ported from prototypes/art-styles/cartoon.js. */
export function waveY(x: number, t: number): number {
  return SURF + 1.6 * Math.sin(x * 0.045 + t * 1.6) + 0.8 * Math.sin(x * 0.11 - t * 1.1);
}

/** Size in world px of an area `wide` screens across and `tall` screens down. */
export function areaSize(wide: number, tall: number): AreaSize {
  const height = WORLD_H * tall;
  return { width: SCREEN_W * wide, height, bedTop: height - BED_DEPTH };
}

/**
 * Which part of the water a row of screens shows: 'single' for a one-row area, else 'top' for the
 * first row, 'bottom' for the last and 'middle' for every row between.
 */
export type AreaRowKind = 'single' | 'top' | 'middle' | 'bottom';

/** The kind of row `row` (0 on top) in an area `rows` screens tall. Throws a RangeError for a row outside the area. */
export function areaRowKind(row: number, rows: number): AreaRowKind {
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= rows) {
    throw new RangeError(`areaRowKind: row ${row} is not one of ${rows} rows`);
  }
  if (rows === 1) return 'single';
  if (row === 0) return 'top';
  return row === rows - 1 ? 'bottom' : 'middle';
}

const CANAL_SIZE: Readonly<AreaSize> = Object.freeze(areaSize(ZONE_SCREENS, 1));

/** Rectangle the axolotl centre may occupy inside an area; the canal when no size is given. */
export function swimBounds(size: Pick<ZoneLayout, 'width' | 'bedTop'> = CANAL_SIZE): SwimBounds {
  return { minX: 40, maxX: size.width - 40, minY: SURF + 14, maxY: size.bedTop - 22 };
}

/** Whether a point lies inside a current zone (inclusive edges). */
export function isInsideCurrent(pos: Point, zone: CurrentZone): boolean {
  return pos.x >= zone.x0 && pos.x <= zone.x1 && pos.y >= zone.y0 && pos.y <= zone.y1;
}

/** Whether a point lies inside the safe area (inclusive edges). */
export function inSafeArea(point: Point, safeArea: SafeArea): boolean {
  return (
    point.x >= safeArea.x0 && point.x <= safeArea.x1 && point.y >= safeArea.y0 && point.y <= safeArea.y1
  );
}

/** Whether a point is at the Home Spot: centre distance at most the radius (inclusive). */
export function inHomeSpot(pos: Point, spot: HomeSpot): boolean {
  return Math.hypot(pos.x - spot.x, pos.y - spot.y) <= spot.radius;
}

/**
 * One reed's base x: the first reeds stand on the bed's columns, the rest anywhere from
 * REED_SPREAD before the first column to REED_SPREAD past the last. Always makes exactly one draw.
 */
function reedBaseX(rand: () => number, bed: ReedBed, index: number): number {
  const draw = rand();
  if (index < bed.columns.length) {
    return bed.columns[index];
  }
  const left = Math.min(...bed.columns) - REED_SPREAD;
  const right = Math.max(...bed.columns) + REED_SPREAD;
  return left + draw * (right - left);
}

function buildReedCluster(rand: () => number, bed: ReedBed, firstIndex: number, baseOffset: number): ReedSpec[] {
  // INVARIANT: each bed makes the same rand() draws in the same order as the old jittered clusters
  // (one spare draw where the jitter was, the count, then 11 per reed), so snacks and pads stay
  // identical for every seed.
  rand();
  const count = rand() < 0.5 ? 5 : 6;
  const reeds: ReedSpec[] = [];
  for (let i = 0; i < count; i++) {
    reeds.push({
      id: `reed-${firstIndex + i}`,
      bx: reedBaseX(rand, bed, i),
      by: REED_BASE_Y + baseOffset + rand() * 8,
      tipY: 34 + rand() * 38,
      lean: (rand() - 0.5) * 16,
      bend: (rand() - 0.5) * 10,
      phase: rand() * TAU,
      amp: 4 + rand() * 3.5,
      cat: rand() < 0.5,
      leafU: 0.25 + rand() * 0.4,
      leafDir: rand() < 0.5 ? -1 : 1,
      light: rand() < 0.5,
    });
  }
  return reeds;
}

function patchAroundReeds(reeds: ReedSpec[], bedTop: number): ReedPatch {
  const xs = reeds.flatMap((reed) => [reed.bx, reed.bx + reed.lean]);
  return {
    x0: Math.min(...xs) - REED_PATCH_PAD,
    x1: Math.max(...xs) + REED_PATCH_PAD,
    y0: SURF,
    y1: bedTop,
    dragMul: REED_DRAG_MUL,
  };
}

function shuffleKinds(rand: () => number, data: AreaLayoutData): CollectibleKind[] {
  const kinds: CollectibleKind[] = [
    ...Array.from({ length: data.snackWorms }, (): CollectibleKind => 'worm'),
    ...Array.from({ length: data.snackBugs }, (): CollectibleKind => 'bug'),
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const swapIndex = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[swapIndex]] = [kinds[swapIndex], kinds[i]];
  }
  return kinds;
}

function isSnackSpotClear(
  candidate: Point,
  placed: Point[],
  start: Point,
  hazards: readonly Readonly<HazardSpawn>[],
  sweeps: readonly HazardRect[],
): boolean {
  if (Math.hypot(candidate.x - start.x, candidate.y - start.y) < SNACK_START_CLEARANCE) {
    return false;
  }
  const spaced = placed.every(
    (other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= SNACK_MIN_SPACING,
  );
  return (
    spaced &&
    hazards.every((hazard) => shapeDistance(candidate, hazardSweep(hazard)) >= SNACK_HAZARD_CLEARANCE) &&
    sweeps.every((sweep) => shapeDistance(candidate, sweep) >= SNACK_HAZARD_CLEARANCE)
  );
}

function pickSnackSpot(
  rand: () => number,
  area: SwimBounds,
  placed: Point[],
  data: AreaLayoutData,
  sweeps: readonly HazardRect[],
): Point {
  for (let attempt = 0; attempt < SNACK_MAX_ATTEMPTS; attempt++) {
    const candidate = {
      x: area.minX + rand() * (area.maxX - area.minX),
      y: area.minY + rand() * (area.maxY - area.minY),
    };
    if (isSnackSpotClear(candidate, placed, data.start, data.hazards, sweeps)) {
      return candidate;
    }
  }
  throw new Error(
    `buildZone: no clear snack spot in x ${area.minX}..${area.maxX}, y ${area.minY}..${area.maxY}`,
  );
}

/**
 * Where each snack is picked: `snacksInCurrent` in the first current, then one vertical stripe of
 * the swim bounds per remaining snack. An area with no current puts every snack in a stripe.
 * The stripes span the full swim height, so a stripe may cross a current.
 */
function snackAreas(data: AreaLayoutData, current: CurrentZone | undefined, bounds: SwimBounds): SwimBounds[] {
  const inCurrentCount = current ? data.snacksInCurrent : 0;
  const inCurrent: SwimBounds[] = current
    ? Array.from({ length: inCurrentCount }, () => ({
        minX: Math.max(current.x0, bounds.minX),
        maxX: Math.min(current.x1, bounds.maxX),
        minY: Math.max(current.y0, bounds.minY),
        maxY: Math.min(current.y1, bounds.maxY),
      }))
    : [];
  const strataCount = data.snackWorms + data.snackBugs - inCurrentCount;
  const strataWidth = (bounds.maxX - bounds.minX) / strataCount;
  const strata = Array.from({ length: strataCount }, (_, i): SwimBounds => ({
    minX: bounds.minX + i * strataWidth,
    maxX: bounds.minX + (i + 1) * strataWidth,
    minY: bounds.minY,
    maxY: bounds.maxY,
  }));
  return [...inCurrent, ...strata];
}

/** A rock wall or side room as a rect shape. */
function rockRect(rock: Readonly<RockWall>): HazardRect {
  return { kind: 'rect', x0: rock.x0, x1: rock.x1, y0: rock.y0, y1: rock.y1 };
}

/**
 * The sweep of every element that has geometry, then of every moving hazard, then every rock wall
 * and side room (issue #105, ND-8), then every gliding trajinera's hull band (issue #78, ND-8), in
 * data order.
 */
function snackSweeps(data: Readonly<AreaLayoutData>): HazardRect[] {
  const elementSweeps = data.elements.flatMap((element) => {
    const sweep = elementSweep(element);
    return sweep ? [sweep] : [];
  });
  const rock = [...(data.rockWalls ?? []), ...(data.sideRooms ?? [])].map(rockRect);
  const hullBands = (data.trajineras ?? []).map((boat) => trajineraHullBand(boat));
  return [...elementSweeps, ...(data.movingHazards ?? []).map(movingHazardSweep), ...rock, ...hullBands];
}

/**
 * Snack starts, each SNACK_HAZARD_CLEARANCE px or more from every hazard's drift sweep, element
 * sweep, moving hazard sweep and trajinera hull band. Only candidates near one are redrawn, so an area with none makes
 * the same draws.
 */
function buildSnacks(
  rand: () => number,
  data: AreaLayoutData,
  current: CurrentZone | undefined,
  bounds: SwimBounds,
): CollectibleSpawn[] {
  const kinds = shuffleKinds(rand, data);
  const sweeps = snackSweeps(data);
  const placed: Point[] = [];
  for (const area of snackAreas(data, current, bounds)) {
    placed.push(pickSnackSpot(rand, area, placed, data, sweeps));
  }
  return placed
    .sort((a, b) => a.x - b.x)
    .map((spot, i) => ({ id: `snack-${i}`, kind: kinds[i], x: spot.x, y: spot.y }));
}

/** The tadpole spawns, in data order, each at its loop's first point carrying its wander loop (issue #131, ND-13). */
function tadpoleSpawns(mix: Readonly<MobileSnackMix>): CollectibleSpawn[] {
  const rule = mix.tadpole;
  if (mix.wanders.length === 0) return [];
  if (!rule) throw new RangeError('buildZone: tadpole wander loops need a tadpole rule');
  return mix.wanders.map((wander, i): CollectibleSpawn => ({
    id: `snack-tadpole-${i + 1}`,
    kind: 'tadpole',
    x: wander.points[0].x,
    y: wander.points[0].y,
    wander: snackWander(wander.points, rule.speed, wander.offset),
  }));
}

/** The shrimp spawns, in data order, each at its home's first hop spot carrying a copy of its hop spots (issue #131, ND-13). */
function shrimpSpawns(mix: Readonly<MobileSnackMix>): CollectibleSpawn[] {
  if (mix.homes.length > 0 && !mix.shrimp) throw new RangeError('buildZone: shrimp homes need a shrimp rule');
  return mix.homes.map((home, i): CollectibleSpawn => ({
    id: `snack-shrimp-${i + 1}`,
    kind: 'shrimp',
    x: home.points[0].x,
    y: home.points[0].y,
    home: home.points.map((spot) => ({ x: spot.x, y: spot.y })),
  }));
}

/**
 * The mobile snack spawns (ND-22, ND-23; issue #131, ND-1), appended after the seeded snacks with
 * no rand() draw: tadpoles, then shrimp, in data order, ids `snack-tadpole-<n>` and
 * `snack-shrimp-<n>` from 1. Throws RangeError for wander loops without a tadpole rule or homes
 * without a shrimp rule.
 */
function mobileSnackSpawns(mix: Readonly<MobileSnackMix> | undefined): CollectibleSpawn[] {
  if (!mix) return [];
  const shrimps = shrimpSpawns(mix);
  return [...tadpoleSpawns(mix), ...shrimps];
}

function buildPads(rand: () => number, padCount: number, width: number): PadSpec[] {
  const slotWidth = width / padCount;
  const pads = Array.from({ length: padCount }, (_, i): PadSpec => ({
    x: i * slotWidth + 60 + rand() * (slotWidth - 120),
    rx: 21 + rand() * 5,
    flower: rand() < 0.35,
  }));
  if (padCount > 0 && !pads.some((pad) => pad.flower)) {
    pads[Math.floor(rand() * padCount)].flower = true;
  }
  return pads;
}

/**
 * The area's fixed tilapia patrol loops, ids `tilapia-0` upward in data order. In the canal they
 * run left to right, and the closest two routes, `tilapia-1` and `tilapia-2`, are 287 px apart,
 * more than twice the lunge range of 140 px.
 */
function buildTilapiaRoutes(routes: readonly RoutePoints[]): TilapiaRoute[] {
  return routes.map((points, i) => ({
    id: `tilapia-${i}`,
    waypoints: points.map(([x, y]) => ({ x, y })),
  }));
}

function copyPredatorRoute(route: Readonly<PredatorRoute>): PredatorRoute {
  return {
    id: route.id,
    waypoints: route.waypoints.map((point) => ({ x: point.x, y: point.y })),
    species: route.species,
  };
}

function fixedSpots(
  areaId: string,
  points: readonly FixedSpotData[],
  prefix: string,
  cover: HidingCover,
): HidingSpot[] {
  return points.map(([x, y, rarity, container], i) => ({
    id: `${areaId}/spot-${prefix}-${i + 1}`,
    cover,
    rarity,
    container,
    x,
    y,
  }));
}

/** One bed's reed hiding spots: one per row and column, ids `spot-reeds-<bed>-<column>-<tag>`. */
function bedSpots(areaId: string, bed: ReedBed, bedIndex: number): HidingSpot[] {
  return bed.rows.flatMap((row) =>
    bed.columns.map((column): HidingSpot => ({
      id: `${areaId}/spot-reeds-${bedIndex}-${column}-${row.tag}`,
      cover: 'reeds',
      rarity: row.rarity,
      container: false,
      x: column,
      y: row.y,
    })),
  );
}

function padSpot(data: AreaLayoutData, pads: PadSpec[], padIndex: number): HidingSpot {
  return {
    id: `${data.id}/spot-pad-${padIndex}`,
    cover: 'pad',
    rarity: 'rare',
    container: false,
    x: pads[padIndex].x,
    y: data.padSpotY,
  };
}

/** The spots under the area's fixed pads, ids `spot-pad-<tag>`, in data order. */
function fixedPadSpots(data: AreaLayoutData): HidingSpot[] {
  return (data.fixedPads ?? []).flatMap((pad): HidingSpot[] =>
    pad.spot
      ? [{ id: `${data.id}/spot-pad-${pad.spot.tag}`, cover: 'pad', rarity: pad.spot.rarity, container: false, x: pad.x, y: pad.spot.y }]
      : [],
  );
}

function isSpotClear(
  candidate: HidingSpot,
  accepted: HidingSpot[],
  bounds: SwimBounds,
  safeArea: SafeArea,
  homeSpot: HomeSpot,
): boolean {
  const inBounds =
    candidate.x >= bounds.minX && candidate.x <= bounds.maxX && candidate.y >= bounds.minY && candidate.y <= bounds.maxY;
  const clearOfHome =
    Math.hypot(candidate.x - homeSpot.x, candidate.y - homeSpot.y) >= homeSpot.radius + SPOT_HOME_CLEARANCE;
  const spaced = accepted.every(
    (other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= SPOT_MIN_SPACING,
  );
  return inBounds && !inSafeArea(candidate, safeArea) && clearOfHome && spaced;
}

/**
 * Hiding spots: the fixed cave, past-current and reed spots (area data, never dropped), then the
 * spot under seeded pad `padSpotIndex` when it is not null, whose x comes from this seed's pads,
 * then the spots under the fixed pads, then the bank spots (both area data, never dropped). The
 * seeded pad spot is dropped if it is out of the water, in the safe area, near the ring or too
 * close to an accepted spot.
 */
function buildSpots(
  data: AreaLayoutData,
  pads: PadSpec[],
  bounds: SwimBounds,
  safeArea: SafeArea,
  homeSpot: HomeSpot,
): HidingSpot[] {
  const spots = [
    ...fixedSpots(data.id, data.caveSpots, 'cave', 'cave'),
    ...fixedSpots(data.id, data.currentSpots, 'current', 'pastCurrent'),
    ...data.reedBeds.flatMap((bed, bedIndex) => bedSpots(data.id, bed, bedIndex)),
  ];
  if (data.padSpotIndex !== null) {
    const candidate = padSpot(data, pads, data.padSpotIndex);
    if (isSpotClear(candidate, spots, bounds, safeArea, homeSpot)) {
      spots.push(candidate);
    }
  }
  spots.push(...fixedPadSpots(data));
  spots.push(...fixedSpots(data.id, data.bankSpots ?? [], 'bank', 'bank'));
  return spots;
}

/** One find per area treasure, in catalogue order; its pool is every spot of the same rarity. */
function buildFinds(treasures: readonly Treasure[], spots: HidingSpot[]): FindSpawn[] {
  return treasures.map((treasure) => ({
    id: treasure.id,
    pool: spots.filter((spot) => spot.rarity === treasure.rarity).map((spot) => spot.id),
  }));
}

function copyElementType(type: Readonly<ElementType>): ElementType {
  return { ...type, ...(type.fact ? { fact: { ...type.fact } } : {}) };
}

/** A copy of the element sharing no object with the data; optional parts copied only when set. */
function copyElement(element: Readonly<ElementSpawn>): ElementSpawn {
  return {
    ...element,
    type: copyElementType(element.type),
    ...(element.matPair ? { matPair: { ...element.matPair } } : {}),
    ...(element.glowPlant ? { glowPlant: { ...element.glowPlant } } : {}),
    ...(element.pebble ? { pebble: { ...element.pebble } } : {}),
    ...(element.trajinera ? { trajinera: { ...element.trajinera } } : {}),
  };
}

/** A copy of the mix sharing no object with the data; optional rules copied only when set. */
function copyMobileSnackMix(mix: Readonly<MobileSnackMix>): MobileSnackMix {
  return {
    ...(mix.tadpole ? { tadpole: { ...mix.tadpole } } : {}),
    wanders: mix.wanders.map((wander) => ({ points: wander.points.map((point) => ({ ...point })), offset: wander.offset })),
    ...(mix.shrimp ? { shrimp: { ...mix.shrimp } } : {}),
    homes: mix.homes.map((home) => ({ points: home.points.map((spot) => ({ ...spot })) })),
  };
}

/** A copy of the hazard sharing no object with the data; its drift and pulse copied only when set. */
function copyHazard(hazard: Readonly<HazardSpawn>): HazardSpawn {
  return {
    ...hazard,
    shape: { ...hazard.shape },
    ...(hazard.drift ? { drift: { ...hazard.drift } } : {}),
    ...(hazard.pulse ? { pulse: { ...hazard.pulse } } : {}),
  };
}

/** A copy of the boat sharing no object with the data. */
function copyTrajinera(boat: Readonly<TrajineraSpawn>): TrajineraSpawn {
  return { ...boat, type: copyElementType(boat.type), trajinera: { ...boat.trajinera } };
}

/** The layout's optional fields, each copied only when its data is set. */
function optionalLayoutParts(
  data: Readonly<AreaLayoutData>,
): Pick<
  ZoneLayout,
  'tilapia' | 'bankOverhangs' | 'movingHazards' | 'mobileSnacks' | 'darkWater' | 'rockWalls' | 'sideRooms' | 'trajineras'
> {
  return {
    ...(data.tilapia ? { tilapia: { ...data.tilapia } } : {}),
    ...(data.bankOverhangs ? { bankOverhangs: data.bankOverhangs.map((overhang) => ({ ...overhang })) } : {}),
    ...(data.movingHazards ? { movingHazards: data.movingHazards.map((spawn) => ({ ...spawn })) } : {}),
    ...(data.mobileSnacks ? { mobileSnacks: copyMobileSnackMix(data.mobileSnacks) } : {}),
    ...(data.darkWater ? { darkWater: { ...data.darkWater } } : {}),
    ...(data.rockWalls ? { rockWalls: data.rockWalls.map((wall) => ({ ...wall })) } : {}),
    ...(data.sideRooms ? { sideRooms: data.sideRooms.map((room) => ({ ...room })) } : {}),
    ...(data.trajineras ? { trajineras: data.trajineras.map(copyTrajinera) } : {}),
  };
}

/**
 * Deterministically builds an area's zone layout from its data and a mulberry32 seed. The rules
 * read the layout's width, height and bedTop, never the canal constants. The optional tilapia
 * tuning, bank overhangs, bank spots, moving hazards, mobile snacks, dark water, rock walls, side
 * rooms and gliding trajineras make no rand() draws; only snack starts near a drifting net's path, a
 * moving hazard's sweep, a rock wall, a side room or a trajinera's hull band are redrawn.
 */
export function buildZone(data: Readonly<AreaLayoutData>, seed: number): ZoneLayout {
  const rand = mulberry32(seed);
  const size = areaSize(data.screensWide, data.screensTall);
  const bounds = swimBounds(size);
  const start: Point = { x: data.start.x, y: data.start.y };

  const reeds: ReedSpec[] = [];
  const reedPatches: ReedPatch[] = [];
  for (const bed of data.reedBeds) {
    const cluster = buildReedCluster(rand, bed, reeds.length, size.height - WORLD_H);
    reeds.push(...cluster);
    reedPatches.push(patchAroundReeds(cluster, size.bedTop));
  }

  const currents: CurrentZone[] = data.currents.map((current) => ({ ...current, force: { ...current.force } }));

  const collectibles = [...buildSnacks(rand, data, currents[0], bounds), ...mobileSnackSpawns(data.mobileSnacks)];
  const pads = [
    ...buildPads(rand, data.padCount, size.width),
    ...(data.fixedPads ?? []).map((pad): PadSpec => ({ x: pad.x, rx: pad.rx, flower: pad.flower })),
  ];
  const safeArea: SafeArea = { ...data.safeArea };
  const homeSpot: HomeSpot = { x: start.x, y: start.y, radius: data.homeSpotRadius };
  const spots = buildSpots(data, pads, bounds, safeArea, homeSpot);

  return {
    areaId: data.id,
    width: size.width,
    height: size.height,
    bedTop: size.bedTop,
    chunks: data.screensWide,
    rows: data.screensTall,
    start,
    reeds,
    reedPatches,
    currents,
    collectibles,
    pads,
    bankChunks: [...data.bankChunks],
    sunChunk: data.sunChunk,
    safeArea,
    tilapiaRoutes: buildTilapiaRoutes(data.tilapiaRoutes),
    predatorRoutes: data.predatorRoutes.map(copyPredatorRoute),
    hazards: data.hazards.map(copyHazard),
    elements: data.elements.map(copyElement),
    homeSpot,
    finds: buildFinds(data.treasures, spots),
    spots,
    cave: { ...data.cave },
    mainPath: data.mainPath.map((point) => ({ ...point })),
    strandingPlaces: data.strandingPlaces.map((place) => ({ ...place })),
    ...optionalLayoutParts(data),
  };
}

/** Deterministically builds the 4-screen canal zone layout from a mulberry32 seed. */
export function buildCanalZone(seed: number = DEFAULT_ZONE_SEED): ZoneLayout {
  return buildZone(CANAL_LAYOUT, seed);
}
