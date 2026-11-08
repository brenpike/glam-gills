/**
 * The open lake's Area 14 (issue #213), as area data: 9 screens across, 3 down, twin trenches (2x1,
 * 2x3, 1x1, 2x3, 2x1). Solid rock fills the west shallows floor under y 318 in columns 0 and 1, the
 * west ledge under y 678 and the west terrace step under y 920 in column 2, the ridge under y 318 in
 * column 4, the east terrace step under y 920 and the east ledge under y 678 in column 6, and the
 * east shallows floor under y 318 in columns 7 and 8. Each pit steps down on its outer side and is
 * sheer on the ridge side. The Home Spot and its safe area sit on the ridge between the pits. The
 * main path is no left-to-right run: west to the west shallows beds and back, down to the west
 * ledge, back over the ridge, east through the east pit to the east shallows beds and back, then
 * down into the east pit to the exit on its floor. Band 3 is dark water, lit only by four fading
 * lights, two in each pit, where a mud turtle creeps each pit floor and a can and a bottle of sharp
 * litter lie on each, by its Legendary spots. Two tilapia and six carp patrol band 2, a cormorant
 * floats over each pit and dives into band 2, and two pelican lines glide over the shallows, each
 * one step up the predator ladder from Area 13. A drifting island floats under each pelican line.
 * No wind and waves.
 */
import type { AreaExit } from './areas';
import { DEEP_CANAL_3_TREASURES, type Rarity, type Treasure } from './catalogue';
import { driftingIslandSpawn, type DriftingIslandSpawn } from './driftingIslands';
import { fadingLightSpawn } from './fadingLights';
import type { ElementSpawn, LitterKind } from './hazards';
import { litterSpawn, type LitterSpawn } from './litter';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { OPEN_LAKE_2_CARP, OPEN_LAKE_2_CORMORANT, OPEN_LAKE_2_PELICAN_LINE, OPEN_LAKE_2_TILAPIA } from './openLake2Layout';
import type { RockWall } from './pebble';
import { pelicanLineSpawn, type PelicanLineSpawn, type PelicanLineTuning } from './pelicanLine';
import { CARP_SPECIES, CORMORANT_SPECIES, MUD_TURTLE_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CORMORANT_CHASE, MUD_TURTLE, type TilapiaTuning } from './tuning';
import { BED_TOP as SHALLOWS_TOP, SURF, WORLD_H, areaSize, swimBounds, type AreaLayoutData, type Point, type ReedBed } from './zone';

export const OPEN_LAKE_3_AREA_ID = 'open-lake-3';

/** Area 14's size: 9 screens across, 3 down; its bed top is y 1038. */
const SIZE = areaSize(9, 3);

/** Where the axolotl centre may be in Area 14, which every pelican line's span keeps inside. */
const BOUNDS = swimBounds(SIZE);

/** Top of the west and east ledges, the floor of band 2 at each pit's outer side. */
const LEDGE_TOP = areaSize(1, 2).bedTop;

/** Top of each pit terrace step, 118 px above the pit floor. */
const TERRACE_TOP = 920;

/** y of each cormorant's stretch at the top of the swim water. */
const CORMORANT_STRETCH_Y = 94;

/** y of each mud turtle's stretch on a pit floor, its body clear of the bed. */
const TURTLE_FLOOR_Y = 1012;

/** y of each piece of sharp litter: lying on a pit floor, its circle touching the bed. */
const LITTER_FLOOR_Y = SIZE.bedTop - 12;

/** The west shallows floor: solid rock under the shallows of columns 0 and 1, from y 318 down. */
const WEST_SHALLOWS: Readonly<RockWall> = Object.freeze({ x0: 0, x1: 960, y0: SHALLOWS_TOP, y1: SIZE.height });

/** The west ledge: solid rock under band 2 at the west pit's outer side, from y 678 down. */
const WEST_LEDGE: Readonly<RockWall> = Object.freeze({ x0: 960, x1: 1200, y0: LEDGE_TOP, y1: SIZE.height });

/** The west terrace step, against the west ledge at the foot of the west pit. */
const WEST_TERRACE: Readonly<RockWall> = Object.freeze({ x0: 1200, x1: 1360, y0: TERRACE_TOP, y1: SIZE.height });

/** The ridge between the pits: solid rock under the shallows of column 4, from y 318 down. */
const RIDGE: Readonly<RockWall> = Object.freeze({ x0: 1920, x1: 2400, y0: SHALLOWS_TOP, y1: SIZE.height });

/** The east terrace step, against the east ledge at the foot of the east pit. */
const EAST_TERRACE: Readonly<RockWall> = Object.freeze({ x0: 2960, x1: 3040, y0: TERRACE_TOP, y1: SIZE.height });

/** The east ledge: solid rock under band 2 at the east pit's outer side, from y 678 down. */
const EAST_LEDGE: Readonly<RockWall> = Object.freeze({ x0: 3040, x1: 3360, y0: LEDGE_TOP, y1: SIZE.height });

/** The east shallows floor: solid rock under the shallows of columns 7 and 8, from y 318 down. */
const EAST_SHALLOWS: Readonly<RockWall> = Object.freeze({ x0: 3360, x1: SIZE.width, y0: SHALLOWS_TOP, y1: SIZE.height });

/** The exit on the east pit floor, east of its mud turtle, its gate on the bed and clear of the east terrace step. */
export const OPEN_LAKE_3_EXIT: Readonly<AreaExit> = Object.freeze({ x: 2880, y: 940, radius: 40 });

/** Where a trip in Area 14 starts: the Home Spot on the ridge between the pits. */
export const OPEN_LAKE_3_START: Readonly<Point> = Object.freeze({ x: 2160, y: 200 });

/** The special treasure Area 14 gives until its own come (issue #213, Q1): the Refuge snow globe, Legendary. */
export const OPEN_LAKE_3_SPECIAL_TREASURE_ID = 'deep-canal/refuge-snow-globe';

/**
 * Area 14's tilapia, one step up the predator ladder from Area 13's: a 560 px/s strike reaching
 * 185 px, a 1.25 s cooldown and a 90 px/s patrol. Every other value, the warning and the chase
 * included, stays Area 13's.
 */
export const OPEN_LAKE_3_TILAPIA: Readonly<TilapiaTuning> = Object.freeze({
  ...OPEN_LAKE_2_TILAPIA,
  lungeSpeed: 560,
  lungeRange: 185,
  cooldown: 1.25,
  patrolSpeed: 90,
});

/** Area 14's common carp, one step up the predator ladder from Area 13's: a 1.15 s cooldown and an 85 px/s patrol, with Area 13's other values and chase. */
export const OPEN_LAKE_3_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...OPEN_LAKE_2_CARP.tuning, cooldown: 1.15, patrolSpeed: 85 }),
);

/**
 * Area 14's cormorant, one step up the predator ladder from Area 13's: a 300 px dive, to y 394 in
 * band 2, at 490 px/s, a 2.3 s cooldown and a 50 px/s drift, with the cormorant chase along its
 * stretch seeing 330 px, past its 300 px reach. Every other value, the 1.8 s dive cap and the 1.0 s
 * warning included, stays Area 13's.
 */
export const OPEN_LAKE_3_CORMORANT: Readonly<PredatorSpecies> = tunedSpecies(
  CORMORANT_SPECIES,
  Object.freeze({
    ...OPEN_LAKE_2_CORMORANT.tuning,
    lungeRange: 300,
    lungeSpeed: 490,
    cooldown: 2.3,
    patrolSpeed: 50,
    chase: Object.freeze({ ...CORMORANT_CHASE, sight: 330 }),
  }),
);

/** Area 14's mud turtle, one step up from Area 13's: a 22 px/s crawl and a 2.3 s cooldown, with every other MUD_TURTLE value and no chase. */
export const OPEN_LAKE_3_MUD_TURTLE: Readonly<PredatorSpecies> = tunedSpecies(
  MUD_TURTLE_SPECIES,
  Object.freeze({ ...MUD_TURTLE, patrolSpeed: 22, cooldown: 2.3 }),
);

/** Area 14's pelican lines, one step up from Area 13's: a 2.6 s glide, so a 5.1 s cycle, every other value Area 13's. */
export const OPEN_LAKE_3_PELICAN_LINE: Readonly<PelicanLineTuning> = Object.freeze({ ...OPEN_LAKE_2_PELICAN_LINE, glideFor: 2.6 });

/**
 * The treasures Area 14 hides until its own come (issue #213, Q1): Area 10's whole set, the Refuge
 * snow globe among them, in catalogue order.
 */
export const OPEN_LAKE_3_SHARED_TREASURES: readonly Treasure[] = DEEP_CANAL_3_TREASURES;

/** Area 14's tadpole rule, Area 13's: 72 px/s. */
const OPEN_LAKE_3_TADPOLE = tadpoleRule(72);

/** Area 14's shrimp rule, Area 13's: trigger 60 px, rest 1.2 s, flick 60 px at 150 px/s. */
const OPEN_LAKE_3_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/** The tadpole wander loops' turn points, west to east: two over the west pit in band 2, one over the east pit floor in band 3 and one over the east terrace step and ledge in band 1. */
const OPEN_LAKE_3_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[1060, 404], [1380, 404], [1350, 554], [1190, 486.5]] as const),
  Object.freeze([[1500, 334], [1820, 334], [1790, 484], [1630, 416.5]] as const),
  Object.freeze([[2520, 774], [2840, 774], [2810, 924], [2650, 856.5]] as const),
  Object.freeze([[2940, 94], [3260, 94], [3230, 244], [3070, 176.5]] as const),
]);

/** The shrimp homes' hop spots, west to east: three on the west shallows, one over the west pit by the ridge, one on the ridge by the safe area, one on the east pit floor, one over the east terrace step and three on the east shallows. */
const OPEN_LAKE_3_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[120, 164], [150, 134], [140, 204]] as const),
  Object.freeze([[560, 164], [590, 134], [580, 204]] as const),
  Object.freeze([[980, 164], [1010, 134], [1000, 204]] as const),
  Object.freeze([[1780, 404], [1810, 374], [1800, 444]] as const),
  Object.freeze([[1925, 150], [1940, 120], [1930, 190]] as const),
  Object.freeze([[2520, 884], [2550, 854], [2540, 924]] as const),
  Object.freeze([[3020, 234], [3050, 204], [3040, 274]] as const),
  Object.freeze([[3600, 164], [3630, 134], [3620, 204]] as const),
  Object.freeze([[3900, 164], [3930, 134], [3920, 204]] as const),
  Object.freeze([[4180, 164], [4210, 134], [4200, 204]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 14's tadpole speed. */
function lapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / OPEN_LAKE_3_TADPOLE.speed;
}

/** Tadpole n (from 0) on its wander loop, n parts of its own lap ahead, so the tadpoles are out of step. */
function wanderAt(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(OPEN_LAKE_3_TADPOLE, points, (index * lapSeconds(points)) / OPEN_LAKE_3_LOOPS.length);
}

/** One predator's route, id `<name>-<n>`: a closed loop through `points`, each an [x, y] pair. */
function loopRoute(id: string, species: Readonly<PredatorSpecies>, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id, waypoints: Object.freeze(waypoints) as Point[], species });
}

/** One cormorant's straight stretch at the top of the swim water, from `x0` to `x1`, two waypoints. */
function cormorantStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  return loopRoute(`cormorant-${index}`, OPEN_LAKE_3_CORMORANT, [
    [x0, CORMORANT_STRETCH_Y],
    [x1, CORMORANT_STRETCH_Y],
  ]);
}

/** One mud turtle's straight stretch on a pit floor, from `x0` to `x1`, two waypoints. */
function turtleStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  return loopRoute(`mud-turtle-${index}`, OPEN_LAKE_3_MUD_TURTLE, [
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

/** One pelican line, id `open-lake-3/pelican-line-<n>`, gliding over `x0..x1`, its cycle starting at `offset` seconds. */
function pelicanLineAt(index: number, offset: number, x0: number, x1: number): Readonly<PelicanLineSpawn> {
  return Object.freeze(pelicanLineSpawn(`${OPEN_LAKE_3_AREA_ID}/pelican-line-${index}`, offset, { x0, x1 }, BOUNDS, OPEN_LAKE_3_PELICAN_LINE));
}

/** One fading light, id `open-lake-3/fading-light-<n>`, centred on (`x`, `y`). */
function fadingLightAt(index: number, x: number, y: number): Readonly<ElementSpawn> {
  const spawn = fadingLightSpawn(`${OPEN_LAKE_3_AREA_ID}/fading-light-${index}`, { x, y });
  Object.freeze(spawn.fadingLight);
  return Object.freeze(spawn);
}

/** One drifting island, id `open-lake-3/island-<n>`, drifting over `x0..x1`, first heading `direction` from `offset` seconds. */
function driftingIslandAt(index: number, offset: number, x0: number, x1: number, direction: 'left' | 'right'): Readonly<DriftingIslandSpawn> {
  const spawn = driftingIslandSpawn(`${OPEN_LAKE_3_AREA_ID}/island-${index}`, offset, { x0, x1, direction });
  Object.freeze(spawn.island);
  return Object.freeze(spawn);
}

/** One piece of sharp litter, id `open-lake-3/litter-<n>`, lying on a pit floor at `x`. */
function litterAt(index: number, x: number, kind: LitterKind): Readonly<LitterSpawn> {
  const spawn = litterSpawn(`${OPEN_LAKE_3_AREA_ID}/litter-${index}`, { x, y: LITTER_FLOOR_Y }, kind);
  Object.freeze(spawn.shape);
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

/** Seconds into its cycle the second pelican line starts: half a 5.1 s cycle, so the lines are out of step. */
const PELICAN_HALF_CYCLE =
  (OPEN_LAKE_3_PELICAN_LINE.glideFor +
    OPEN_LAKE_3_PELICAN_LINE.warnFor +
    OPEN_LAKE_3_PELICAN_LINE.plungeFor +
    OPEN_LAKE_3_PELICAN_LINE.holdFor +
    OPEN_LAKE_3_PELICAN_LINE.riseFor) /
  2;

/** The open lake's Area 14, as area data: 9 screens across, 3 down, twin trenches. */
export const OPEN_LAKE_3_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: OPEN_LAKE_3_AREA_ID,
  screensWide: 9,
  screensTall: 3,
  start: OPEN_LAKE_3_START,
  /** The shallows over the ridge, from the surface down to y 360. */
  safeArea: Object.freeze({ x0: 1960, x1: 2360, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  depthBanded: true,
  /** West to east: the west shallows floor, ledge and terrace step, the ridge, then the east terrace step, ledge and shallows floor. */
  rockWalls: Object.freeze([WEST_SHALLOWS, WEST_LEDGE, WEST_TERRACE, RIDGE, EAST_TERRACE, EAST_LEDGE, EAST_SHALLOWS]),
  /**
   * Tule beds: on each shallows floor by the far ends of the main path, with Common spots by the
   * path; on each ledge, with Rare spots off the path, each just past the strike of the nearest carp;
   * and on each pit floor, with Epic spots just past half a turtle's snap and Legendary spots within
   * it, each within 200 px of a fading light. The deepest spot, on the east pit floor, is Legendary.
   */
  reedBeds: Object.freeze([
    tuleBed([800, 856, 912], [[250, 'common', 'shallows']], SHALLOWS_TOP),
    tuleBed([1086, 1144], [[595, 'rare', 'ledge-high'], [655, 'rare', 'ledge']], LEDGE_TOP),
    tuleBed([1615, 1675], [[905, 'epic', 'high']]),
    tuleBed([1584, 1706], [[957, 'legendary', 'floor']]),
    tuleBed([2575, 2645], [[905, 'epic', 'high']]),
    tuleBed([2544, 2676], [[957, 'legendary', 'floor']]),
    tuleBed([2610], [[975, 'legendary', 'deep']]),
    tuleBed([3100, 3156, 3212, 3268], [[655, 'rare', 'ledge']], LEDGE_TOP),
    tuleBed([3420, 3476, 3532], [[250, 'common', 'shallows']], SHALLOWS_TOP),
  ]),
  caveSpots: Object.freeze([]),
  currentSpots: Object.freeze([]),
  currents: Object.freeze([]),
  /** A smooth-stone hollow on the west pit floor by the ridge: scenery, with no spot in it. */
  cave: Object.freeze({ id: `${OPEN_LAKE_3_AREA_ID}/cave`, x0: 1840, x1: 1890, y0: 990, y1: SIZE.bedTop }),
  /** Two tilapia in band 2 only: `tilapia-0` at the foot of band 2 over the west pit, under the main path, and `tilapia-1` at the top of band 2 over the east pit, over it. */
  tilapiaRoutes: Object.freeze([tilapiaLoop(1440, 1600, 681, 696), tilapiaLoop(2620, 2825, 384, 399)]),
  /**
   * Six carp in band 2 only, the carp target for 17 screens of water: three over the west pit under
   * the main path's way across it, two over the east pit over its way through band 3, and one at the
   * top of band 2 over the east ledge, under its way along the ledge. Then a cormorant floating at
   * y 94 over each pit and a mud turtle creeping each pit floor.
   */
  predatorRoutes: Object.freeze([
    loopRoute('carp-0', OPEN_LAKE_3_CARP, boxLoop(1280, 1320, 600, 700)),
    loopRoute('carp-1', OPEN_LAKE_3_CARP, boxLoop(1480, 1560, 580, 640)),
    loopRoute('carp-2', OPEN_LAKE_3_CARP, boxLoop(1700, 1800, 620, 700)),
    loopRoute('carp-3', OPEN_LAKE_3_CARP, boxLoop(2600, 2700, 600, 660)),
    loopRoute('carp-4', OPEN_LAKE_3_CARP, boxLoop(2780, 2875, 600, 660)),
    loopRoute('carp-5', OPEN_LAKE_3_CARP, boxLoop(3160, 3260, 384, 500)),
    cormorantStretch(0, 1300, 1600),
    cormorantStretch(1, 2655, 2750),
    turtleStretch(0, 1560, 1730),
    turtleStretch(1, 2520, 2700),
  ]),
  movingHazards: Object.freeze([]),
  /** Four pieces of sharp litter, a can and a bottle on each pit floor, each by a Legendary spot. */
  hazards: Object.freeze([litterAt(1, 1496, 'can'), litterAt(2, 1794, 'bottle'), litterAt(3, 2456, 'can'), litterAt(4, 2764, 'bottle')]),
  /** Four fading lights, two in each pit: one on its terrace step and one on its floor. Then a drifting island under each pelican line, out of step. */
  elements: Object.freeze([
    fadingLightAt(1, 1280, 896),
    fadingLightAt(2, 1645, 1000),
    fadingLightAt(3, 2610, 1000),
    fadingLightAt(4, 3000, 896),
    driftingIslandAt(1, 0, 480, 1680, 'right'),
    driftingIslandAt(2, 30, 3080, 4280, 'left'),
  ]),
  /** Two lines of three pelicans, half a 5.1 s cycle out of step, one over the west shallows and pit and one over the east ledge and shallows, each dipping to y 300. */
  pelicanLines: Object.freeze([pelicanLineAt(1, 0, 40, 1820), pelicanLineAt(2, PELICAN_HALF_CYCLE, 3080, 4280)]),
  /** The pitch-black pits: from y 720 to the bed, from the west ledge to the east ledge. */
  darkWater: Object.freeze({ x0: 960, x1: 3360, y0: 720, y1: SIZE.bedTop }),
  /**
   * No left-to-right run: down the ridge's west wall and west across the west pit in band 2, up onto
   * the west shallows to their beds and back, down to the west ledge, back across the west pit and
   * over the ridge, down its east wall and east across the east pit in band 3, over its turtle, up
   * past the east terrace step and over the east ledge onto the east shallows to their beds and
   * back, then down past the terrace step to the exit on the east pit floor.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 2160, y: 200 }),
    Object.freeze({ x: 1890, y: 292 }),
    Object.freeze({ x: 1890, y: 440 }),
    Object.freeze({ x: 980, y: 440 }),
    Object.freeze({ x: 980, y: 292 }),
    Object.freeze({ x: 790, y: 292 }),
    Object.freeze({ x: 980, y: 292 }),
    Object.freeze({ x: 980, y: 440 }),
    Object.freeze({ x: 1030, y: 600 }),
    Object.freeze({ x: 980, y: 440 }),
    Object.freeze({ x: 1890, y: 440 }),
    Object.freeze({ x: 1890, y: 292 }),
    Object.freeze({ x: 2420, y: 292 }),
    Object.freeze({ x: 2430, y: 800 }),
    Object.freeze({ x: 3015, y: 800 }),
    Object.freeze({ x: 3015, y: 245 }),
    Object.freeze({ x: 3540, y: 245 }),
    Object.freeze({ x: 3015, y: 245 }),
    Object.freeze({ x: 3015, y: 800 }),
    Object.freeze({ x: OPEN_LAKE_3_EXIT.x, y: OPEN_LAKE_3_EXIT.y }),
  ]),
  /** Fixed stranding places in band 2 over the pits, each at least 80 px from every route and clear of every spot. */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${OPEN_LAKE_3_AREA_ID}/strand-1`, x: 1200, y: 520 }),
    Object.freeze({ id: `${OPEN_LAKE_3_AREA_ID}/strand-2`, x: 1700, y: 540 }),
    Object.freeze({ id: `${OPEN_LAKE_3_AREA_ID}/strand-3`, x: 2500, y: 520 }),
    Object.freeze({ id: `${OPEN_LAKE_3_AREA_ID}/strand-4`, x: 2950, y: 520 }),
  ]),
  treasures: Object.freeze([]),
  sharedTreasures: OPEN_LAKE_3_SHARED_TREASURES,
  /** 4 tadpoles and 10 shrimp to 3 worms and 3 bugs: 14 of 20 snacks mobile, 70% (the later snack ramp row). */
  snackWorms: 3,
  snackBugs: 3,
  snacksInCurrent: 0,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  tilapia: OPEN_LAKE_3_TILAPIA,
  mobileSnacks: mobileSnackMix({
    tadpole: OPEN_LAKE_3_TADPOLE,
    wanders: OPEN_LAKE_3_LOOPS.map(wanderAt),
    shrimp: OPEN_LAKE_3_SHRIMP,
    homes: OPEN_LAKE_3_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
