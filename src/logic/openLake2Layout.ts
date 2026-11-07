/**
 * The open lake's Area 13 (issue #212), as area data: 10 screens across, 3 down, a trench (3x1,
 * 1x2, 2x3, 2x2, 2x1). Solid rock fills the left shelf under y 318 in columns 0 to 2, the left step
 * under y 678 in column 3, the right step under y 678 in columns 6 and 7 and the right shelf under
 * y 318 in columns 8 and 9, with one small terrace step on each side of the pit floor in columns 4
 * and 5 (ND-2). The Home Spot and its safe area sit in the middle shallows over the pit (ND-3). The
 * main path is no left-to-right run (ND-4): west over the shallows to the left shelf beds and back,
 * down onto the left step floor, east across band 2 over the pit to the right step, up onto the
 * right shelf and along it and back, then down into the pitch-black pit to the exit on its floor
 * (ND-5). Band 3 is dark water (ND-6), lit only by four fading lights (ND-8), and two mud turtles
 * creep its floor (ND-12), the deep's only predator. Two tilapia and six carp patrol band 2, two
 * cormorants float over columns 3, 6 and 7 and dive into band 2, and two pelican lines glide over the
 * shelves, each one step up the predator ladder from Area 12 (ND-19). No wind and waves (ND-16).
 */
import type { AreaExit } from './areas';
import { DEEP_CANAL_4_TREASURES, type Rarity, type Treasure } from './catalogue';
import { fadingLightSpawn } from './fadingLights';
import type { ElementSpawn } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { OPEN_LAKE_CARP, OPEN_LAKE_TILAPIA } from './openLakeLayout';
import type { RockWall } from './pebble';
import { PELICAN_LINE, pelicanLineSpawn, type PelicanLineSpawn, type PelicanLineTuning } from './pelicanLine';
import { CARP_SPECIES, CORMORANT_SPECIES, MUD_TURTLE_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CORMORANT, CORMORANT_CHASE, type TilapiaTuning } from './tuning';
import { BED_TOP as SHELF_TOP, SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type Point, type ReedBed } from './zone';

export const OPEN_LAKE_2_AREA_ID = 'open-lake-2';

/** Area 13's size: 10 screens across, 3 down; its bed top is y 1038. */
const SIZE = areaSize(10, 3);

/** Where the axolotl centre may be in Area 13, which every pelican line's span keeps inside. */
const BOUNDS = swimBounds(SIZE);

/** Top of the left and right steps, the floor of band 2 in columns 3, 6 and 7 (ND-2). */
const STEP_TOP = areaSize(1, 2).bedTop;

/** Top of each pit terrace step, 118 px above the pit floor (ND-2). */
const TERRACE_TOP = 920;

/** y of each cormorant's stretch at the top of the swim water (ND-19). */
const CORMORANT_STRETCH_Y = 94;

/** y of each mud turtle's stretch on the pit floor, its body clear of the bed (ND-12). */
const TURTLE_FLOOR_Y = 1012;

/** The left shelf: solid rock under the shallows of columns 0 to 2, from y 318 down (ND-2). */
const LEFT_SHELF: Readonly<RockWall> = Object.freeze({ x0: 0, x1: 1440, y0: SHELF_TOP, y1: SIZE.height });

/** The left step: solid rock under band 2 of column 3, from y 678 down (ND-2). */
const LEFT_STEP: Readonly<RockWall> = Object.freeze({ x0: 1440, x1: 1920, y0: STEP_TOP, y1: SIZE.height });

/** The west pit terrace step, against the left step at the foot of the pit (ND-2). */
const WEST_TERRACE: Readonly<RockWall> = Object.freeze({ x0: 1920, x1: 2080, y0: TERRACE_TOP, y1: SIZE.height });

/** The east pit terrace step, against the right step at the foot of the pit (ND-2). */
const EAST_TERRACE: Readonly<RockWall> = Object.freeze({ x0: 2720, x1: 2880, y0: TERRACE_TOP, y1: SIZE.height });

/** The right step: solid rock under band 2 of columns 6 and 7, from y 678 down (ND-2). */
const RIGHT_STEP: Readonly<RockWall> = Object.freeze({ x0: 2880, x1: 3840, y0: STEP_TOP, y1: SIZE.height });

/** The right shelf: solid rock under the shallows of columns 8 and 9, from y 318 down (ND-2). */
const RIGHT_SHELF: Readonly<RockWall> = Object.freeze({ x0: 3840, x1: SIZE.width, y0: SHELF_TOP, y1: SIZE.height });

/**
 * The exit (PRD X9, ND-5) on the east side of the pit floor, east of the turtles, its gate on the
 * bed and clear of the east terrace step (issue #212, ND-5).
 */
export const OPEN_LAKE_2_EXIT: Readonly<AreaExit> = Object.freeze({ x: 2650, y: 940, radius: 40 });

/** Where a trip in Area 13 starts: the Home Spot in the middle shallows over the pit (ND-3). */
export const OPEN_LAKE_2_START: Readonly<Point> = Object.freeze({ x: 2160, y: 200 });

/** The special treasure Area 13 gives until its own come (issue #212, Q1): the Lagoon shine Paint shell, Legendary. */
export const OPEN_LAKE_2_SPECIAL_TREASURE_ID = 'deep-canal/paint-shell-lagoon-shine';

/**
 * Area 13's tilapia, one step up the predator ladder from Area 12's (ND-19): a 540 px/s strike
 * reaching 180 px, a 1.3 s cooldown and an 85 px/s patrol. Every other value, the 0.8 s warning and
 * the full-bar chase included, stays Area 12's.
 */
export const OPEN_LAKE_2_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...OPEN_LAKE_TILAPIA,
  lungeSpeed: 540,
  lungeRange: 180,
  cooldown: 1.3,
  patrolSpeed: 85,
});

/**
 * Area 13's common carp, one step up the predator ladder from Area 12's (ND-19): a 1.2 s cooldown
 * and an 80 px/s patrol, with Area 12's other values and chase.
 */
export const OPEN_LAKE_2_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...OPEN_LAKE_CARP.tuning, cooldown: 1.2, patrolSpeed: 80 }),
);

/**
 * Area 13's cormorant, one step up the predator ladder from Area 11's (ND-19): a 290 px dive, to
 * y 384 in band 2, at 470 px/s, its dive capped at 1.8 s, a 2.4 s cooldown and a 45 px/s drift, with
 * the cormorant chase along its stretch seeing 320 px, past its 290 px reach. Every other value,
 * the 1.0 s warning included, stays Area 11's.
 */
export const OPEN_LAKE_2_CORMORANT: Readonly<PredatorSpecies> = tunedSpecies(
  CORMORANT_SPECIES,
  Object.freeze({
    ...CORMORANT,
    lungeRange: 290,
    lungeSpeed: 470,
    lungeDuration: 1.8,
    cooldown: 2.4,
    patrolSpeed: 45,
    chase: Object.freeze({ ...CORMORANT_CHASE, sight: 320 }),
  }),
);

/**
 * Area 13's pelican lines, one step up from Area 12's (ND-19): a 2.8 s glide, so a 5.3 s cycle, with
 * every other value PELICAN_LINE's, the dip to y 300 included.
 */
export const OPEN_LAKE_2_PELICAN_LINE: Readonly<PelicanLineTuning> = Object.freeze({ ...PELICAN_LINE, glideFor: 2.8 });

/**
 * The treasures Area 13 hides until its own come (issue #212, Q1, ND-17): Area 11's whole set, 3
 * Common, 6 Rare, 2 Epic and 3 Legendary, the Lagoon shine Paint shell among them, in catalogue order.
 */
export const OPEN_LAKE_2_SHARED_TREASURES: readonly Treasure[] = DEEP_CANAL_4_TREASURES;

/** Area 13's tadpole rule, the top of the later snack ramp row: 72 px/s, as Area 12's (ND-20). */
const OPEN_LAKE_2_TADPOLE = tadpoleRule(72);

/** Area 13's shrimp rule, Area 12's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s (ND-20). */
const OPEN_LAKE_2_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/** The tadpole wander loops' turn points, west to east: over the pit in band 2, east of the safe area in band 1, and between `cormorant-1` and the right shelf. */
const OPEN_LAKE_2_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[2020, 370], [2340, 370], [2310, 520], [2150, 452.5]] as const),
  Object.freeze([[2400, 100], [2720, 100], [2690, 250], [2530, 182.5]] as const),
  Object.freeze([[2400, 380], [2720, 380], [2690, 530], [2530, 462.5]] as const),
  Object.freeze([[3340, 110], [3660, 110], [3630, 260], [3470, 192.5]] as const),
]);

/**
 * The shrimp homes' hop spots, west to east: four on the left shelf, one in the shallows of column 3
 * by the left shelf's edge, one on each pit terrace step by its fading light (ND-20), one in the
 * shallows of column 7 and two on the right shelf.
 */
const OPEN_LAKE_2_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[120, 160], [180, 130], [160, 200]] as const),
  Object.freeze([[600, 150], [660, 120], [640, 190]] as const),
  Object.freeze([[1000, 160], [1060, 130], [1040, 200]] as const),
  Object.freeze([[1240, 150], [1300, 120], [1280, 190]] as const),
  Object.freeze([[1480, 200], [1540, 170], [1500, 230]] as const),
  Object.freeze([[2020, 820], [2080, 790], [2060, 829]] as const),
  Object.freeze([[2740, 820], [2780, 790], [2760, 829]] as const),
  Object.freeze([[3700, 150], [3760, 120], [3740, 190]] as const),
  Object.freeze([[3960, 150], [4020, 120], [4000, 190]] as const),
  Object.freeze([[4600, 150], [4660, 120], [4640, 190]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 13's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / OPEN_LAKE_2_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(OPEN_LAKE_2_TADPOLE, points, (index * lapSeconds(points)) / OPEN_LAKE_2_LOOPS.length);
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One cormorant's straight stretch at the top of the swim water, from `x0` to `x1`, two waypoints. */
function cormorantStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  return loopRoute(`cormorant-${index}`, OPEN_LAKE_2_CORMORANT, [
    [x0, CORMORANT_STRETCH_Y],
    [x1, CORMORANT_STRETCH_Y],
  ]);
}

/** One mud turtle's straight stretch on the pit floor, from `x0` to `x1`, two waypoints (ND-12). */
function turtleStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  return loopRoute(`mud-turtle-${index}`, MUD_TURTLE_SPECIES, [
    [x0, TURTLE_FLOOR_Y],
    [x1, TURTLE_FLOOR_Y],
  ]);
}

/** One rectangular band 2 loop, x0..x1 by y0..y1, clockwise from its top left. */
function boxLoop(x0: number, x1: number, y0: number, y1: number): readonly (readonly [number, number])[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** One tilapia loop as area data: the box x0..x1 by y0..y1, every point frozen. */
function tilapiaLoop(x0: number, x1: number, y0: number, y1: number): readonly (readonly [number, number])[] {
  return Object.freeze(boxLoop(x0, x1, y0, y1).map((point) => Object.freeze([...point] as const)));
}

/** One pelican line, id `open-lake-2/pelican-line-<n>`, gliding over `x0..x1`, its cycle starting at `offset` seconds. */
function pelicanLineAt(index: number, offset: number, x0: number, x1: number): Readonly<PelicanLineSpawn> {
  return Object.freeze(pelicanLineSpawn(`${OPEN_LAKE_2_AREA_ID}/pelican-line-${index}`, offset, { x0, x1 }, BOUNDS, OPEN_LAKE_2_PELICAN_LINE));
}

/** One fading light, id `open-lake-2/fading-light-<n>`, centred on (`x`, `y`) (ND-8). */
function fadingLightAt(index: number, x: number, y: number): Readonly<ElementSpawn> {
  const spawn = fadingLightSpawn(`${OPEN_LAKE_2_AREA_ID}/fading-light-${index}`, { x, y });
  Object.freeze(spawn.fadingLight);
  return Object.freeze(spawn);
}

/** One tule bed: its columns and one row of spots per [y, rarity, tag], standing on the floor at `baseY` (absent: the pit floor). */
function tuleBed(columns: readonly number[], rows: readonly (readonly [number, Rarity, string])[], baseY?: number): Readonly<ReedBed> {
  return Object.freeze({
    columns: Object.freeze([...columns]),
    rows: Object.freeze(rows.map(([y, rarity, tag]) => Object.freeze({ y, rarity, tag }))),
    ...(baseY === undefined ? {} : { baseY }),
  });
}

/** Seconds into its cycle the second pelican line starts: half a 5.3 s cycle, so the lines are out of step. */
const PELICAN_HALF_CYCLE =
  (OPEN_LAKE_2_PELICAN_LINE.glideFor +
    OPEN_LAKE_2_PELICAN_LINE.warnFor +
    OPEN_LAKE_2_PELICAN_LINE.plungeFor +
    OPEN_LAKE_2_PELICAN_LINE.holdFor +
    OPEN_LAKE_2_PELICAN_LINE.riseFor) /
  2;

/** The open lake's Area 13, as area data: 10 screens across, 3 down, a trench. */
export const OPEN_LAKE_2_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: OPEN_LAKE_2_AREA_ID,
  screensWide: 10,
  screensTall: 3,
  start: OPEN_LAKE_2_START,
  /** The middle shallows over the pit, from the surface down to y 360 (ND-3). */
  safeArea: Object.freeze({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  depthBanded: true,
  /** The two shelves, the two steps, then the two pit terrace steps (ND-2): the trench's stepped floor. */
  rockWalls: Object.freeze([LEFT_SHELF, LEFT_STEP, WEST_TERRACE, EAST_TERRACE, RIGHT_STEP, RIGHT_SHELF]),
  /**
   * Tule beds (ND-18): on the left shelf and on the right shelf by the far ends of the main path, with
   * Common spots by the path; on the left and right steps, with Rare spots off the path, each just
   * past the strike of the nearest carp; and on the pit floor, with Epic spots just past half a
   * turtle's snap and Legendary spots within it, each within 200 px of a fading light. The left step's
   * bed reaches the column 3 shallows, so the main path west hides from `cormorant-0` in it.
   */
  reedBeds: Object.freeze([
    tuleBed([1000, 1060, 1120], [[250, 'common', 'shelf']], SHELF_TOP),
    tuleBed([4100, 4160], [[250, 'common', 'shelf']], SHELF_TOP),
    tuleBed([1660, 1720, 1780, 1840, 1900], [[655, 'rare', 'step']], STEP_TOP),
    tuleBed([3110, 3170, 3230], [[655, 'rare', 'step']], STEP_TOP),
    tuleBed([3520, 3580], [[655, 'rare', 'step']], STEP_TOP),
    tuleBed([2190], [[905, 'epic', 'high']]),
    tuleBed([2170, 2230, 2290], [[975, 'legendary', 'floor']]),
    tuleBed([2370], [[940, 'epic', 'floor']]),
    tuleBed([2440], [[965, 'legendary', 'floor']]),
    tuleBed([2560], [[940, 'epic', 'floor']]),
  ]),
  caveSpots: Object.freeze([]),
  currentSpots: Object.freeze([]),
  currents: Object.freeze([]),
  /** A smooth-stone hollow on the pit floor by the west terrace step: scenery, with no spot in it (ND-18). */
  cave: Object.freeze({ id: `${OPEN_LAKE_2_AREA_ID}/cave`, x0: 2090, x1: 2140, y0: 990, y1: SIZE.bedTop }),
  /**
   * Two tilapia in band 2 only (ND-19): `tilapia-0` over the pit at the foot of band 2, under the main
   * path's way over the pit, and `tilapia-1` over the right step at the top of band 2, over its way
   * along the right step.
   */
  tilapiaRoutes: Object.freeze([tilapiaLoop(2280, 2440, 681, 696), tilapiaLoop(3300, 3420, 384, 419)]),
  /**
   * Six carp in band 2 only (ND-19), the carp target for 17 screens of water: two over the left step
   * between the main path's way west in band 1 and its way east in band 2, two over the pit under its
   * way over the pit, `carp-2` at the foot of band 2, and two over the right step at the top of band 2,
   * over its way along the right step. Then the two cormorants floating at y 94 over column 3 and over
   * columns 6 and 7, and the two mud turtles creeping the pit floor in its west and east halves (ND-12).
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', OPEN_LAKE_2_CARP, boxLoop(1620, 1690, 428, 464)),
    loopRoute('carp-1', OPEN_LAKE_2_CARP, boxLoop(1800, 1870, 428, 464)),
    loopRoute('carp-2', OPEN_LAKE_2_CARP, boxLoop(2210, 2290, 636, 696)),
    loopRoute('carp-3', OPEN_LAKE_2_CARP, boxLoop(2600, 2650, 576, 640)),
    loopRoute('carp-4', OPEN_LAKE_2_CARP, boxLoop(3130, 3200, 384, 464)),
    loopRoute('carp-5', OPEN_LAKE_2_CARP, boxLoop(3500, 3600, 384, 464)),
    cormorantStretch(0, 1800, 1900),
    cormorantStretch(1, 2880, 3080),
    turtleStretch(0, 2120, 2340),
    turtleStretch(1, 2400, 2480),
  ]),
  movingHazards: Object.freeze([]),
  hazards: Object.freeze([]),
  /** Four fading lights in the pit (ND-8): one on each terrace step and two on the floor, 240 px apart. */
  elements: Object.freeze([fadingLightAt(1, 2000, 896), fadingLightAt(2, 2280, 1000), fadingLightAt(3, 2520, 1000), fadingLightAt(4, 2800, 896)]),
  /** Two lines of three pelicans (ND-19), half a 5.3 s cycle out of step, over the left and right shelves, each dipping to y 300. */
  pelicanLines: Object.freeze([pelicanLineAt(1, 0, 40, 1420), pelicanLineAt(2, PELICAN_HALF_CYCLE, 3860, 4740)]),
  /** The pitch-black pit (ND-6): from y 720 to the bed, between the steps. */
  darkWater: Object.freeze({ x0: 1440, x1: 3840, y0: 720, y1: SIZE.bedTop }),
  /**
   * No left-to-right run (ND-4): west from the Home Spot over the shallows to the left shelf beds and
   * back; down onto the left step floor; east across band 2, over the pit, to the right step; up onto
   * the right shelf and along it to its beds and back; then back west and down into the pit to the
   * exit.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 2160, y: 200 }),
    Object.freeze({ x: 1960, y: 292 }),
    Object.freeze({ x: 1480, y: 292 }),
    Object.freeze({ x: 960, y: 292 }),
    Object.freeze({ x: 1480, y: 292 }),
    Object.freeze({ x: 1480, y: 600 }),
    Object.freeze({ x: 1980, y: 600 }),
    Object.freeze({ x: 2060, y: 440 }),
    Object.freeze({ x: 2760, y: 440 }),
    Object.freeze({ x: 2880, y: 600 }),
    Object.freeze({ x: 3780, y: 600 }),
    Object.freeze({ x: 3790, y: 292 }),
    Object.freeze({ x: 4200, y: 292 }),
    Object.freeze({ x: 3790, y: 292 }),
    Object.freeze({ x: 3780, y: 600 }),
    Object.freeze({ x: 2880, y: 600 }),
    Object.freeze({ x: 2830, y: 640 }),
    Object.freeze({ x: 2830, y: 860 }),
    Object.freeze({ x: 2700, y: 900 }),
    Object.freeze({ x: OPEN_LAKE_2_EXIT.x, y: OPEN_LAKE_2_EXIT.y }),
  ]),
  /** Fixed stranding places (PRD C2, ND-21) in band 2 over the steps, each at least 80 px from every route and clear of every spot. */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${OPEN_LAKE_2_AREA_ID}/strand-1`, x: 1520, y: 400 }),
    Object.freeze({ id: `${OPEN_LAKE_2_AREA_ID}/strand-2`, x: 1560, y: 540 }),
    Object.freeze({ id: `${OPEN_LAKE_2_AREA_ID}/strand-3`, x: 3000, y: 400 }),
    Object.freeze({ id: `${OPEN_LAKE_2_AREA_ID}/strand-4`, x: 3720, y: 450 }),
  ]),
  treasures: Object.freeze([]),
  sharedTreasures: OPEN_LAKE_2_SHARED_TREASURES,
  /** 4 tadpoles and 10 shrimp to 3 worms and 3 bugs: 14 of 20 snacks mobile, 70% (the later snack ramp row, ND-20). */
  snackWorms: 3,
  snackBugs: 3,
  snacksInCurrent: 0,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: OPEN_LAKE_2_TILAPIA,
  mobileSnacks: mobileSnackMix({
    tadpole: OPEN_LAKE_2_TADPOLE,
    wanders: OPEN_LAKE_2_LOOPS.map(wanderAt),
    shrimp: OPEN_LAKE_2_SHRIMP,
    homes: OPEN_LAKE_2_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
