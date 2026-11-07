/**
 * The open lake's Area 12 (issue #211), as area data: 9 screens across, 2 down, a bowl (3x1, 3x2,
 * 3x1). Solid rock fills both shelves under y 318, columns 0 to 2 and 6 to 8, with one small terrace
 * step on each side of the deep middle. The Home Spot and its safe area sit in the middle shallows.
 * The main path is no left-to-right run: west across the left shelf and back, down through the bowl
 * under the Home Spot and up again, then east along the right shelf to the exit at its far end, its
 * gate on the shelf rock. Two lines of American white pelicans glide over the shelves and the
 * shallows, out of step, and wind and waves blow across the whole surface band. The two tilapia and
 * four carp patrol the middle band only, one step up the predator ladder from Area 11. Common spots
 * hide in tule beds on the shelves by the main path, Rare spots in tule beds on the terrace steps
 * and the bowl floor, off it. The pelican line is its one new threat.
 */
import type { AreaExit } from './areas';
import { OPEN_LAKE_TREASURES } from './catalogue';
import { DEEP_CANAL_4_CARP, DEEP_CANAL_4_TILAPIA } from './deepCanal4Layout';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import type { RockWall } from './pebble';
import { pelicanLineSpawn, type PelicanLineSpawn } from './pelicanLine';
import { CARP_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import type { TilapiaTuning } from './tuning';
import { windSpawn, type WindSpawn } from './wind';
import { BED_TOP as SHELF_TOP, SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type Point, type ReedBed } from './zone';

export const OPEN_LAKE_AREA_ID = 'open-lake-1';

/** Area 12's size: 9 screens across, 2 down. */
const SIZE = areaSize(9, 2);

/** Where the axolotl centre may be in Area 12, which every pelican line's span keeps inside. */
const BOUNDS = swimBounds(SIZE);

/** Top of each terrace step in the deep middle: 560, 118 px above the bowl floor. */
const STEP_TOP = 560;

/** The left shelf: solid rock under the shallows of columns 0 to 2, from y 318 down (ND-3). */
const LEFT_SHELF: Readonly<RockWall> = Object.freeze({ x0: 0, x1: 1440, y0: SHELF_TOP, y1: SIZE.height });

/** The right shelf: solid rock under the shallows of columns 6 to 8, from y 318 down (ND-3). */
const RIGHT_SHELF: Readonly<RockWall> = Object.freeze({ x0: 2880, x1: SIZE.width, y0: SHELF_TOP, y1: SIZE.height });

/** The left terrace step, against the left shelf at the foot of the bowl. */
const LEFT_STEP: Readonly<RockWall> = Object.freeze({ x0: 1440, x1: 1600, y0: STEP_TOP, y1: SIZE.height });

/** The right terrace step, against the right shelf at the foot of the bowl. */
const RIGHT_STEP: Readonly<RockWall> = Object.freeze({ x0: 2720, x1: 2880, y0: STEP_TOP, y1: SIZE.height });

/** The exit (PRD X9) at the far east end of the right shelf, its gate on the shelf rock. */
export const OPEN_LAKE_EXIT: Readonly<AreaExit> = Object.freeze({ x: 4180, y: 270, radius: 40 });

/**
 * Area 12's tilapia, one step up the predator ladder from Area 11's (ND-19): a 520 px/s strike
 * reaching 175 px, a 1.4 s cooldown and an 80 px/s patrol. Every other value, the 0.8 s warning and
 * the full-bar chase included, stays Area 11's.
 */
export const OPEN_LAKE_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...DEEP_CANAL_4_TILAPIA,
  lungeSpeed: 520,
  lungeRange: 175,
  cooldown: 1.4,
  patrolSpeed: 80,
});

/**
 * Area 12's common carp, one step up the predator ladder from Area 11's (ND-19): a 1.3 s cooldown
 * and a 75 px/s patrol, with Area 11's other values and chase.
 */
export const OPEN_LAKE_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...DEEP_CANAL_4_CARP.tuning, cooldown: 1.3, patrolSpeed: 75 }),
);

/** Area 12's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 11's (ND-8). */
const OPEN_LAKE_TADPOLE = tadpoleRule(72);

/** Area 12's shrimp rule, Area 11's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s (ND-8). */
const OPEN_LAKE_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/** The tadpole wander loops' turn points, west to east, all in the bowl, where the water is deep enough for a home box. */
const OPEN_LAKE_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[1530, 110], [1880, 110], [1850, 260], [1690, 192.5]] as const),
  Object.freeze([[1990, 400], [2330, 400], [2300, 550], [2140, 482.5]] as const),
  Object.freeze([[2330, 620], [1990, 620], [2020, 470], [2180, 537.5]] as const),
  Object.freeze([[2790, 110], [2440, 110], [2470, 260], [2630, 192.5]] as const),
]);

/** The shrimp homes' hop spots, west to east, on the shelves above the reach of the band 2 threats. */
const OPEN_LAKE_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[120, 160], [180, 130], [160, 200]] as const),
  Object.freeze([[380, 150], [440, 120], [420, 190]] as const),
  Object.freeze([[880, 160], [940, 130], [920, 200]] as const),
  Object.freeze([[1120, 150], [1180, 120], [1160, 190]] as const),
  Object.freeze([[1320, 160], [1380, 130], [1360, 200]] as const),
  Object.freeze([[3000, 160], [3060, 130], [3040, 200]] as const),
  Object.freeze([[3240, 150], [3300, 120], [3280, 190]] as const),
  Object.freeze([[3700, 160], [3760, 130], [3740, 200]] as const),
  Object.freeze([[3900, 150], [3960, 120], [3940, 190]] as const),
  Object.freeze([[4140, 150], [4200, 120], [4180, 190]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 12's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / OPEN_LAKE_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(OPEN_LAKE_TADPOLE, points, (index * lapSeconds(points)) / OPEN_LAKE_LOOPS.length);
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One pelican line, id `open-lake-1/pelican-line-<n>`, gliding over `x0..x1`, its cycle starting at `offset` seconds. */
function pelicanLineAt(index: number, offset: number, x0: number, x1: number): Readonly<PelicanLineSpawn> {
  return Object.freeze(pelicanLineSpawn(`${OPEN_LAKE_AREA_ID}/pelican-line-${index}`, offset, { x0, x1 }, BOUNDS));
}

/** One tule bed: its columns and one row of spots per [y, rarity, tag], standing on the floor at `baseY` (absent: the bowl floor). */
function tuleBed(columns: readonly number[], rows: readonly (readonly [number, 'common' | 'rare', string])[], baseY?: number): Readonly<ReedBed> {
  return Object.freeze({
    columns: Object.freeze([...columns]),
    rows: Object.freeze(rows.map(([y, rarity, tag]) => Object.freeze({ y, rarity, tag }))),
    ...(baseY === undefined ? {} : { baseY }),
  });
}

/** The wind and waves over the whole surface band, its first gust blowing right. */
const OPEN_LAKE_WIND: Readonly<WindSpawn> = Object.freeze(
  windSpawn(`${OPEN_LAKE_AREA_ID}/wind-1`, 0, { x0: BOUNDS.minX, x1: BOUNDS.maxX, direction: 'right' }),
);

/** The open lake's Area 12, as area data: 9 screens across, 2 down, a bowl. */
export const OPEN_LAKE_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: OPEN_LAKE_AREA_ID,
  screensWide: 9,
  screensTall: 2,
  start: Object.freeze({ x: 2160, y: 200 }),
  /** The middle shallows: the Home Spot's column of the top row, inside its screen. */
  safeArea: Object.freeze({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  depthBanded: true,
  /** The two shelves, then the two terrace steps (ND-3): the bowl's stepped floor. */
  rockWalls: Object.freeze([LEFT_SHELF, RIGHT_SHELF, LEFT_STEP, RIGHT_STEP]),
  /**
   * Tule beds (ND-18): on the left shelf by the far end of the main path and on the right shelf by the
   * exit, each standing on the shelf rock, with Common spots by the path; then on the left terrace step,
   * the bowl floor either side of the dive, and the right terrace step, with Rare spots off the path,
   * each just past the strike of the nearest tilapia or carp.
   */
  reedBeds: Object.freeze([
    tuleBed([760, 820, 880], [[250, 'common', 'shelf']], SHELF_TOP),
    tuleBed([3980, 4040], [[250, 'common', 'shelf']], SHELF_TOP),
    tuleBed([1470], [[450, 'rare', 'high'], [520, 'rare', 'low']], STEP_TOP),
    tuleBed([1990], [[580, 'rare', 'high'], [640, 'rare', 'low']]),
    tuleBed([2330], [[560, 'rare', 'high'], [620, 'rare', 'low']]),
    tuleBed([2840], [[400, 'rare', 'top'], [470, 'rare', 'high'], [530, 'rare', 'low']], STEP_TOP),
  ]),
  caveSpots: Object.freeze([]),
  currentSpots: Object.freeze([]),
  currents: Object.freeze([]),
  /** A smooth-stone hollow on the bowl floor under the Home Spot: scenery, with no spot in it. */
  cave: Object.freeze({ id: `${OPEN_LAKE_AREA_ID}/cave`, x0: 2120, x1: 2260, y0: 610, y1: SIZE.bedTop }),
  /**
   * Two tilapia in band 2 only (ND-19): `tilapia-0` west of the dive, from the top of band 2 to its
   * floor, and `tilapia-1` east of the climb, deep enough to stay out of strike of the main path above.
   */
  tilapiaRoutes: Object.freeze([
    Object.freeze([
      Object.freeze([1760, 384] as const),
      Object.freeze([1800, 384] as const),
      Object.freeze([1800, 632] as const),
      Object.freeze([1760, 632] as const),
    ]),
    Object.freeze([
      Object.freeze([2540, 480] as const),
      Object.freeze([2580, 480] as const),
      Object.freeze([2580, 632] as const),
      Object.freeze([2540, 632] as const),
    ]),
  ]),
  /**
   * Four carp in band 2 only (ND-19), the carp target for 12 screens of water: on each side of the
   * bowl one high and one by the floor, the high one west of the dive reaching the top of band 2.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', OPEN_LAKE_CARP, [[1620, 384], [1700, 384], [1700, 460], [1620, 460]]),
    loopRoute('carp-1', OPEN_LAKE_CARP, [[1640, 600], [1720, 600], [1720, 640], [1640, 640]]),
    loopRoute('carp-2', OPEN_LAKE_CARP, [[2640, 440], [2680, 440], [2680, 520], [2640, 520]]),
    loopRoute('carp-3', OPEN_LAKE_CARP, [[2620, 600], [2680, 600], [2680, 640], [2620, 640]]),
  ]),
  movingHazards: Object.freeze([]),
  hazards: Object.freeze([]),
  elements: Object.freeze([OPEN_LAKE_WIND]),
  /**
   * Two lines of three pelicans (ND-5), half a 5.5 s cycle out of step: one over the left shelf and
   * the shallows west of the safe area, one over the shallows east of it and the right shelf, short of
   * the exit. Each dips to y 300, in the shelf water and out of band 2.
   */
  pelicanLines: Object.freeze([pelicanLineAt(1, 0, 40, 1900), pelicanLineAt(2, 2.75, 2420, 3900)]),
  /**
   * No left-to-right run: west from the Home Spot over the shallows, down to the shelf floor and along
   * it to the tule bed near its far end; back east and up over the shallows; down through the bowl
   * under the Home Spot into band 2 and up again; then east along the right shelf floor to the exit.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 2160, y: 200 }),
    Object.freeze({ x: 1520, y: 200 }),
    Object.freeze({ x: 1380, y: 296 }),
    Object.freeze({ x: 700, y: 296 }),
    Object.freeze({ x: 1380, y: 296 }),
    Object.freeze({ x: 1520, y: 200 }),
    Object.freeze({ x: 1940, y: 200 }),
    Object.freeze({ x: 2080, y: 540 }),
    Object.freeze({ x: 2240, y: 540 }),
    Object.freeze({ x: 2440, y: 296 }),
    Object.freeze({ x: OPEN_LAKE_EXIT.x, y: OPEN_LAKE_EXIT.y }),
  ]),
  /** Fixed stranding places (PRD C2) in band 2, each at least 80 px from every predator route and clear of every spot. */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${OPEN_LAKE_AREA_ID}/strand-1`, x: 1560, y: 520 }),
    Object.freeze({ id: `${OPEN_LAKE_AREA_ID}/strand-2`, x: 2080, y: 630 }),
    Object.freeze({ id: `${OPEN_LAKE_AREA_ID}/strand-3`, x: 2280, y: 440 }),
    Object.freeze({ id: `${OPEN_LAKE_AREA_ID}/strand-4`, x: 2760, y: 420 }),
  ]),
  /**
   * Area 12's own 4 Common and 8 Rare treasures (issue #214, ND-3), each hiding in any spot of its
   * rarity (issue #214, ND-7): the Commons share the 5 band 1 Common spots, the Rares the 9 band 2
   * Rare spots.
   */
  treasures: OPEN_LAKE_TREASURES,
  /** 4 tadpoles and 10 shrimp to 3 worms and 3 bugs: 14 of 20 snacks mobile, 70% (the later snack ramp row, ND-8). */
  snackWorms: 3,
  snackBugs: 3,
  snacksInCurrent: 0,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: OPEN_LAKE_TILAPIA,
  mobileSnacks: mobileSnackMix({
    tadpole: OPEN_LAKE_TADPOLE,
    wanders: OPEN_LAKE_LOOPS.map(wanderAt),
    shrimp: OPEN_LAKE_SHRIMP,
    homes: OPEN_LAKE_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
