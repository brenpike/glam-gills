/**
 * The deep canal's Area 11 (issue #112), as area data: 10 screens across, 2 down, a U-turn at golden
 * hour. The Home Spot is top left, and the safe area is its column of the top row. The main path runs
 * east along the top row, over the high carp by the Home Spot, deeper than y 300 under the three
 * cormorants and up under the moored row past `cormorant-1`, drops down in the last column, and runs
 * back west along the bottom row, over three mud seeps and through a narrow murky patch, to the exit
 * low in the first column under the Home Spot. Six more carp patrol between the top and bottom rows'
 * ways, and the tilapia and the black bass guard the treasure water east of the way down: the
 * side-canal inflow up top and the sunken hull cave on the bed. Two fishing trajineras hang three
 * lures, and four anchor drops hang between the cormorants. The cormorant is its one new threat.
 */
import { DEEP_CANAL_4_TREASURES } from './catalogue';
import { DEEP_CANAL_3_BASS, DEEP_CANAL_3_CARP, DEEP_CANAL_3_TILAPIA } from './deepCanal3Layout';
import { fishingBoatSpawn, type FishingBoatSpawn, type LurePlace } from './lures';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { ANCHOR_DROP, MUD_SEEP, movingHazardSpawn, type MovingHazardSpawn, type MovingHazardType } from './movingHazards';
import { murkyPatchSpawn, type MurkyPatchSpawn } from './murkyWater';
import { BLACK_BASS_SPECIES, CARP_SPECIES, CORMORANT_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CORMORANT, CORMORANT_CHASE, type TilapiaTuning } from './tuning';
import { SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const DEEP_CANAL_4_AREA_ID = 'deep-canal-4';

/** Area 11's size: 10 screens across, 2 down. */
const SIZE = areaSize(10, 2);

/** Top of the bed of the bottom row: 678. */
const BED_TOP = SIZE.bedTop;

/** Where the axolotl centre may be in Area 11, which every lure's whole path keeps inside. */
const BOUNDS = swimBounds(SIZE);

/** Bottom of the water under each moored row, the bank cover of its spots (B5). */
const MOORED_HULL_Y = 140;

/** y of each cormorant's stretch at the top of the swim water (PRD N3): it dives no deeper than y 274. */
const CORMORANT_STRETCH_Y = 94;

/**
 * Area 11's tilapia, one step up the predator ladder from Area 10's (issue #112): a 500 px/s strike
 * reaching 170 px, a 1.5 s cooldown and a 75 px/s patrol. Every other value, the 0.8 s warning and
 * the full-bar chase included, stays Area 10's.
 */
export const DEEP_CANAL_4_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...DEEP_CANAL_3_TILAPIA,
  lungeSpeed: 500,
  lungeRange: 170,
  cooldown: 1.5,
  patrolSpeed: 75,
});

/**
 * Area 11's common carp, one step up the predator ladder from Area 10's (issue #112): a 1.4 s
 * cooldown and a 70 px/s patrol, with Area 10's other values and chase.
 */
export const DEEP_CANAL_4_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...DEEP_CANAL_3_CARP.tuning, cooldown: 1.4, patrolSpeed: 70 }),
);

/**
 * Area 11's black bass, one step up the predator ladder from Area 10's (issue #112): a 540 px/s lunge
 * reaching 190 px, a 1.2 s cooldown and a 75 px/s patrol, with Area 10's other values and the bass
 * chase.
 */
export const DEEP_CANAL_4_BASS: Readonly<PredatorSpecies> = tunedSpecies(
  BLACK_BASS_SPECIES,
  Object.freeze({ ...DEEP_CANAL_3_BASS.tuning, lungeSpeed: 540, lungeRange: 190, cooldown: 1.2, patrolSpeed: 75 }),
);

/**
 * Area 11's cormorant, its first step on the predator ladder (PRD open question 545): CORMORANT's
 * 1.0 s warning, 180 px dive at 450 px/s, 2.5 s cooldown and 40 px/s drift, with the cormorant chase
 * along its stretch.
 */
export const DEEP_CANAL_4_CORMORANT: Readonly<PredatorSpecies> = tunedSpecies(
  CORMORANT_SPECIES,
  Object.freeze({ ...CORMORANT, chase: CORMORANT_CHASE }),
);

/** Area 11's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 10's (ND-8). */
const DEEP_CANAL_4_TADPOLE = tadpoleRule(72);

/** Area 11's shrimp rule, Area 10's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s (ND-8). */
const DEEP_CANAL_4_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The sixteen tadpole wander loops' turn points, west to east, placed after the threats, each clear
 * of the Home Spot, the safe area, the inflow and every murky patch, lure and line by
 * SNACK_HAZARD_CLEARANCE, with at least half of each loop out of every strike.
 */
const DEEP_CANAL_4_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[40, 364], [360, 364], [330, 514], [170, 446.5]] as const),
  Object.freeze([[460, 654], [780, 654], [750, 504], [590, 571.5]] as const),
  Object.freeze([[680, 264], [1000, 264], [970, 114], [810, 181.5]] as const),
  Object.freeze([[1120, 504], [1440, 504], [1410, 654], [1250, 586.5]] as const),
  Object.freeze([[1220, 294], [1540, 294], [1510, 144], [1350, 211.5]] as const),
  Object.freeze([[1560, 304], [1880, 304], [1850, 454], [1690, 386.5]] as const),
  Object.freeze([[1820, 504], [2140, 504], [2110, 654], [1950, 586.5]] as const),
  Object.freeze([[2120, 94], [2440, 94], [2410, 244], [2250, 176.5]] as const),
  Object.freeze([[2240, 334], [2560, 334], [2530, 484], [2370, 416.5]] as const),
  Object.freeze([[2520, 654], [2840, 654], [2810, 504], [2650, 571.5]] as const),
  Object.freeze([[2840, 94], [3160, 94], [3130, 244], [2970, 176.5]] as const),
  Object.freeze([[3140, 294], [3460, 294], [3430, 444], [3270, 376.5]] as const),
  Object.freeze([[3600, 654], [3920, 654], [3890, 504], [3730, 571.5]] as const),
  Object.freeze([[3680, 94], [4000, 94], [3970, 244], [3810, 176.5]] as const),
  Object.freeze([[3980, 654], [4300, 654], [4270, 504], [4110, 571.5]] as const),
  Object.freeze([[4200, 304], [4520, 304], [4490, 454], [4330, 386.5]] as const),
]);

/**
 * The sixteen shrimp homes' hop spots, west to east, each starting on a spot out of every threat's
 * strike and clear of the inflow and every murky patch, lure and line by SNACK_HAZARD_CLEARANCE.
 */
const DEEP_CANAL_4_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[60, 604], [120, 574], [100, 644]] as const),
  Object.freeze([[340, 604], [400, 574], [380, 644]] as const),
  Object.freeze([[1080, 334], [1140, 304], [1120, 374]] as const),
  Object.freeze([[1240, 354], [1300, 324], [1280, 394]] as const),
  Object.freeze([[1960, 294], [2020, 264], [2000, 334]] as const),
  Object.freeze([[2140, 294], [2200, 264], [2180, 334]] as const),
  Object.freeze([[2500, 144], [2560, 114], [2540, 184]] as const),
  Object.freeze([[2820, 294], [2880, 264], [2860, 334]] as const),
  Object.freeze([[3000, 454], [3060, 424], [3040, 494]] as const),
  Object.freeze([[3200, 144], [3260, 114], [3240, 184]] as const),
  Object.freeze([[3560, 324], [3620, 294], [3600, 364]] as const),
  Object.freeze([[3720, 294], [3780, 264], [3760, 334]] as const),
  Object.freeze([[3940, 294], [4000, 264], [3980, 334]] as const),
  Object.freeze([[4120, 344], [4180, 314], [4160, 384]] as const),
  Object.freeze([[4160, 144], [4220, 114], [4200, 184]] as const),
  Object.freeze([[4320, 204], [4380, 174], [4360, 244]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 11's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / DEEP_CANAL_4_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(DEEP_CANAL_4_TADPOLE, points, (index * lapSeconds(points)) / DEEP_CANAL_4_LOOPS.length);
}

/** The water under one moored row at the surface, the bank cover (B5). */
function mooredRow(x0: number, x1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0: SURF, y1: MOORED_HULL_Y });
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One cormorant's straight stretch at the top of the swim water, from `x0` to `x1`, two waypoints. */
function cormorantStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  return loopRoute(`cormorant-${index}`, DEEP_CANAL_4_CORMORANT, [
    [x0, CORMORANT_STRETCH_Y],
    [x1, CORMORANT_STRETCH_Y],
  ]);
}

/** One anchor drop, id `deep-canal-4/anchor-drop-<n>`, at `x`, lowered `depth` px, its cycle starting at `offset` seconds. */
function anchorDropAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return moverAt(ANCHOR_DROP, index, x, offset, depth);
}

/** One mud seep, id `deep-canal-4/mud-seep-<n>`, on the bed at `x`, its column `height` px, its cycle starting at `offset` seconds. */
function mudSeepAt(index: number, x: number, offset: number, height: number): Readonly<MovingHazardSpawn> {
  return moverAt(MUD_SEEP, index, x, offset, height, BED_TOP);
}

/** One moving hazard of `type`, id `deep-canal-4/<type id>-<n>`, at `x`, reaching `depth` px from its base. */
function moverAt(
  type: Readonly<MovingHazardType>,
  index: number,
  x: number,
  offset: number,
  depth: number,
  baseY?: number,
): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${DEEP_CANAL_4_AREA_ID}/${type.id}-${index}`, type, x, offset, depth, baseY));
}

/** One murky patch, id `deep-canal-4/murky-water-<n>`, over the rect. */
function murkyPatchAt(index: number, x0: number, x1: number, y0: number, y1: number): Readonly<MurkyPatchSpawn> {
  const patch = murkyPatchSpawn(`${DEEP_CANAL_4_AREA_ID}/murky-water-${index}`, { x0, x1, y0, y1 });
  Object.freeze(patch.shape);
  return Object.freeze(patch);
}

/**
 * One fishing trajinera, id `deep-canal-4/fishing-trajinera-<n>`, drifting over `x0..x1` with its
 * lures, its drift starting at `offset` seconds.
 */
function fishingBoatAt(index: number, offset: number, x0: number, x1: number, lures: readonly LurePlace[]): Readonly<FishingBoatSpawn> {
  const spawn = fishingBoatSpawn(`${DEEP_CANAL_4_AREA_ID}/fishing-trajinera-${index}`, offset, { x0, x1, lures }, BOUNDS);
  for (const lure of spawn.lures) Object.freeze(lure);
  Object.freeze(spawn.lures);
  return Object.freeze(spawn);
}

/** The deep canal's Area 11, as area data: 10 screens across, 2 down. */
export const DEEP_CANAL_4_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: DEEP_CANAL_4_AREA_ID,
  screensWide: 10,
  screensTall: 2,
  start: Object.freeze({ x: 180, y: 200 }),
  /** The Home Spot's column of the top row, from the surface down to y 360. */
  safeArea: Object.freeze({ x0: 40, x1: 330, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /**
   * The sunken hull cave (B6), under the wide murky patch: an open Legendary spot within half
   * `tilapia-1`'s strike, and two Epic spots farther off, one at each end of the hull.
   */
  caveSpots: Object.freeze([
    Object.freeze([4540, 630, 'legendary', false] as const),
    Object.freeze([4470, 640, 'epic', false] as const),
    Object.freeze([4730, 630, 'epic', false] as const),
  ]),
  /**
   * Just past the side-canal inflow, east of the way down: two open Legendary spots, within half the
   * strike of `tilapia-0` and of `bass-0`, then an Epic spot farther off, then a third open Legendary
   * spot low by the inflow's edge, within half the strike of `tilapia-0`. No Dash pot: each Legendary
   * spot is deep and near a threat (ADR 0032).
   */
  currentSpots: Object.freeze([
    Object.freeze([4580, 180, 'legendary', false] as const),
    Object.freeze([4640, 200, 'legendary', false] as const),
    Object.freeze([4530, 140, 'epic', false] as const),
    Object.freeze([4505, 295, 'legendary', false] as const),
  ]),
  /** The side-canal inflow east of the way down, flowing left at Area 10's 72 px/s, which one leg beats by 18 px/s (B6). */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 4400, x1: 4500, y0: 110, y1: 300, force: Object.freeze({ x: -72, y: 0 }) }),
  ]),
  /** The sunken hull, a dead end on the bed east of the way down, under the wide murky patch (B6). */
  cave: Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/cave`, x0: 4440, x1: 4740, y0: 600, y1: BED_TOP }),
  /**
   * Two tilapia east of the way down, each loop reaching two depth bands, its strike off the way down:
   * `tilapia-0` past the inflow, from the surface band into the middle band, and `tilapia-1` over the
   * sunken hull, from the middle band into the floor band.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([4560, 255] as const),
      Object.freeze([4600, 255] as const),
      Object.freeze([4600, 455] as const),
      Object.freeze([4560, 455] as const),
    ]),
    Object.freeze([
      Object.freeze([4600, 420] as const),
      Object.freeze([4640, 420] as const),
      Object.freeze([4640, 640] as const),
      Object.freeze([4600, 640] as const),
    ]),
  ]),
  /**
   * Seven carp: `carp-0` high by the Home Spot, from the surface band into the middle band, under the
   * main path's rise out of it, and six more between the top row's way east and the bottom row's way
   * west, from the middle band into the floor band, each strike 1 px short of both ways. Then the
   * black bass on one loop through all three bands at the east end, and the three cormorants floating
   * at y 94 between the anchor drops and the moored rows, each over the main path where it runs
   * deeper than y 300.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', DEEP_CANAL_4_CARP, [[400, 250], [540, 250], [540, 330], [400, 330]]),
    loopRoute('carp-1', DEEP_CANAL_4_CARP, [[560, 441], [960, 441], [960, 497], [560, 497]]),
    loopRoute('carp-2', DEEP_CANAL_4_CARP, [[1400, 441], [1680, 441], [1680, 497], [1400, 497]]),
    loopRoute('carp-3', DEEP_CANAL_4_CARP, [[2120, 441], [2260, 441], [2260, 497], [2120, 497]]),
    loopRoute('carp-4', DEEP_CANAL_4_CARP, [[2700, 441], [2840, 441], [2840, 497], [2700, 497]]),
    loopRoute('carp-5', DEEP_CANAL_4_CARP, [[3280, 441], [3420, 441], [3420, 497], [3280, 497]]),
    loopRoute('carp-6', DEEP_CANAL_4_CARP, [[3700, 441], [4000, 441], [4000, 497], [3700, 497]]),
    loopRoute('bass-0', DEEP_CANAL_4_BASS, [[4680, 120], [4720, 120], [4720, 520], [4680, 520]]),
    cormorantStretch(0, 980, 1140),
    cormorantStretch(1, 1930, 2090),
    cormorantStretch(2, 3420, 3580),
  ]),
  /**
   * Four anchor drops lowered 160 px between the cormorants, each over a carp's reach so no quiet
   * water passes under it, all clear of the main path's way east at y 305. Then three mud seeps on
   * the bed, 78 px tall, each 40 px under a rise in the bottom row's way west.
   */
  movingHazards: Object.freeze([
    anchorDropAt(1, 1500, 0, 160),
    anchorDropAt(2, 2620, 1.2, 160),
    anchorDropAt(3, 2990, 2.4, 160),
    anchorDropAt(4, 4040, 3.6, 160),
    mudSeepAt(1, 1200, 0, 78),
    mudSeepAt(2, 2480, 1.4, 78),
    mudSeepAt(3, 4170, 2.8, 78),
  ]),
  /**
   * The two murky patches (carried forward): a narrow one, 120 px wide, over the bottom row's way
   * west, then a wide one over the sunken hull's dead end.
   */
  hazards: Object.freeze([murkyPatchAt(1, 3000, 3120, 590, 656), murkyPatchAt(2, 4440, 4740, 590, 656)]),
  elements: Object.freeze([]),
  /**
   * The U-turn: from the Home Spot up under the high carp and down to y 305, east along the top row
   * under the cormorants, up under the moored row past `cormorant-1` and back down, on to the last
   * column; down past the treasure water; then west along the bottom row over the mud seeps and
   * through the narrow murky patch to the exit under the Home Spot.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 180, y: 200 }),
    Object.freeze({ x: 250, y: 110 }),
    Object.freeze({ x: 620, y: 110 }),
    Object.freeze({ x: 720, y: 305 }),
    Object.freeze({ x: 2200, y: 305 }),
    Object.freeze({ x: 2300, y: 170 }),
    Object.freeze({ x: 2540, y: 170 }),
    Object.freeze({ x: 2560, y: 305 }),
    Object.freeze({ x: 4340, y: 305 }),
    Object.freeze({ x: 4340, y: 640 }),
    Object.freeze({ x: 4250, y: 640 }),
    Object.freeze({ x: 4200, y: 520 }),
    Object.freeze({ x: 4140, y: 520 }),
    Object.freeze({ x: 4090, y: 640 }),
    Object.freeze({ x: 2580, y: 640 }),
    Object.freeze({ x: 2530, y: 520 }),
    Object.freeze({ x: 2430, y: 520 }),
    Object.freeze({ x: 2380, y: 640 }),
    Object.freeze({ x: 1300, y: 640 }),
    Object.freeze({ x: 1250, y: 520 }),
    Object.freeze({ x: 1150, y: 520 }),
    Object.freeze({ x: 1100, y: 640 }),
    Object.freeze({ x: 260, y: 640 }),
    Object.freeze({ x: 180, y: 620 }),
  ]),
  /**
   * Fixed stranding places (PRD C2): each at least 80 px from every predator route, clear of every
   * sweep by the touch and rescue reach, and out of the inflow, every murky patch, lure and line.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-1`, x: 700, y: 114 }),
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-2`, x: 1500, y: 654 }),
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-3`, x: 2340, y: 654 }),
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-4`, x: 3300, y: 114 }),
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-5`, x: 3880, y: 654 }),
    Object.freeze({ id: `${DEEP_CANAL_4_AREA_ID}/strand-6`, x: 4340, y: 134 }),
  ]),
  treasures: DEEP_CANAL_4_TREASURES,
  snackWorms: 7,
  snackBugs: 7,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  /** Top-row columns whose banks show the golden hour's ahuejote decoration: none holds a cormorant or a moored row. */
  bankChunks: Object.freeze([1, 3, 6]),
  sunChunk: 0,
  tilapia: DEEP_CANAL_4_TILAPIA,
  /**
   * Moored rows at the surface (B5): one past `cormorant-1` over the main path's rise and on past
   * `anchor-drop-2`, one by `anchor-drop-4`, and one over the side-canal inflow's mouth.
   */
  bankOverhangs: Object.freeze([mooredRow(2280, 2720), mooredRow(3900, 4180), mooredRow(4360, 4500)]),
  /**
   * Under the moored rows (B5): Common spots by the main path's rise, Rare spots either side of
   * `anchor-drop-2`, by `anchor-drop-4`, and over the inflow's mouth, in reach of `tilapia-0`.
   */
  bankSpots: Object.freeze([
    Object.freeze([2340, 136, 'common', false] as const),
    Object.freeze([2400, 136, 'common', false] as const),
    Object.freeze([2460, 136, 'common', false] as const),
    Object.freeze([2520, 136, 'common', false] as const),
    Object.freeze([3980, 110, 'rare', false] as const),
    Object.freeze([4100, 110, 'rare', false] as const),
    Object.freeze([2565, 100, 'rare', false] as const),
    Object.freeze([2650, 96, 'rare', false] as const),
    Object.freeze([2700, 140, 'rare', false] as const),
    Object.freeze([4410, 100, 'rare', false] as const),
    Object.freeze([4475, 96, 'rare', false] as const),
  ]),
  /**
   * The two fishing trajineras (carried forward), 4 s out of step, each hanging its lures from the
   * ends of its hull above the main path's way east, out of every predator's strike and never over
   * another surface boat or a cormorant's stretch.
   */
  fishingBoats: Object.freeze([
    fishingBoatAt(1, 0, 1620, 1760, [{ along: 0, depth: 140 }, { along: 120, depth: 120 }]),
    fishingBoatAt(2, 4, 2740, 2870, [{ along: 0, depth: 130 }]),
  ]),
  /** 16 tadpoles and 16 shrimp to 7 worms and 7 bugs: 32 of 46 snacks mobile, 69.6% (the later snack ramp row, ND-8). */
  mobileSnacks: mobileSnackMix({
    tadpole: DEEP_CANAL_4_TADPOLE,
    wanders: DEEP_CANAL_4_LOOPS.map(wanderAt),
    shrimp: DEEP_CANAL_4_SHRIMP,
    homes: DEEP_CANAL_4_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
