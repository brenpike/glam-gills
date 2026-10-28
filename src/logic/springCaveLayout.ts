/**
 * The spring cave, Area 6 (issue #77), as area data: 5 screens across, 3 down, the first descent
 * (issue #77, ND-2). The Home Spot is top left, and the safe area is its column in the top row
 * only. The main path only goes across or down: right along the top row under the rock ledges,
 * down through the gap between the second and third carp in the fourth column, back left along the
 * middle row, down through the gap between two carp in the second column, then right along the
 * bottom row, through the spring outflow, to the exit at the dark bottom right. The dark part is
 * the right half of the bottom row (issue #77, ND-7), with six glow-plants in it (ND-8). The grotto
 * on the bed and the Rare ledge over the second crayfish are dead ends in the dark that hold
 * treasure spots (ND-11). It meets the full danger bar with the whole-water test (ND-4): three
 * chasing crayfish on their own floor stretches, six chasing common carp patrolling every depth
 * and four punting poles jabbing down into the top row (ND-3, option A), with no tilapia; and its
 * snacks meet the later row of the snack ramp, 24 of its 36 mobile (ND-10).
 */
import { SPRING_CAVE_TREASURES } from './catalogue';
import { glowPlantSpawn } from './glowPlants';
import type { ElementSpawn } from './hazards';
import { mobileSnackMix, shrimpHome, shrimpRule, tadpoleRule, tadpoleWander, type TadpoleWander } from './mobileSnacks';
import { PUNTING_POLE, movingHazardSpawn, type MovingHazardSpawn } from './movingHazards';
import { CARP_SPECIES, CRAYFISH_SPECIES, tunedSpecies, type PredatorRoute, type PredatorSpecies } from './predators';
import { CARP, CARP_CHASE, CRAYFISH, CRAYFISH_CHASE } from './tuning';
import { SURF, WORLD_H, areaSize, type AreaLayoutData, type BankOverhang, type Point } from './zone';

export const SPRING_CAVE_AREA_ID = 'spring-cave-1';

/** Top of the bed of the bottom row: 1038. */
const SPRING_CAVE_BED_TOP = areaSize(5, 3).bedTop;

/** y of each crayfish's floor stretch: the bed top less 22, the floor lane, 1016 (issue #77, ND-5). */
export const CRAYFISH_FLOOR_Y = SPRING_CAVE_BED_TOP - 22;

/** Radius in px of each glow-plant's touch circle (issue #77, ND-8). */
export const GLOW_PLANT_RADIUS = 14;

/**
 * Area 6's crayfish, the crayfish's first step on the predator ladder: the owner's values in
 * CRAYFISH with its chase default, so it chases along its stretch only (issue #77, ND-5).
 */
export const SPRING_CAVE_CRAYFISH: Readonly<PredatorSpecies> = tunedSpecies(
  CRAYFISH_SPECIES,
  Object.freeze({ ...CRAYFISH, chase: CRAYFISH_CHASE }),
);

/**
 * Area 6's common carp, one step up the predator ladder from Area 5's: a 0.925 s warning, over the
 * 0.8 s floor, a sweep at 220 px/s for 0.6 s reaching 130 px, a 2.2 s cooldown, a 40 px/s patrol and
 * the carp's chase default (issue #77, ND-6).
 */
export const SPRING_CAVE_CARP: Readonly<PredatorSpecies> = tunedSpecies(
  CARP_SPECIES,
  Object.freeze({ ...CARP, windup: 0.925, lungeSpeed: 220, lungeDuration: 0.6, lungeRange: 130, cooldown: 2.2, patrolSpeed: 40, chase: CARP_CHASE }),
);

/** Area 6's tadpole rule, the top of the later snack ramp row: 72 px/s (issue #77, ND-10). */
const SPRING_CAVE_TADPOLE = tadpoleRule(72);

/**
 * Area 6's shrimp rule (issue #77, ND-10): Area 5's 60 px trigger, 1.2 s rest and 60 px flick, with
 * the flick one step quicker at 150 px/s. That keeps the shared catch limit, 1.2 x 70 >= 60 + 60 -
 * 36, which a 1.1 s rest with a 64 px flick would break.
 */
const SPRING_CAVE_SHRIMP = shrimpRule(60, 1.2, 60, 150);

/**
 * The thirteen tadpole wander loops' turn points (issue #77, ND-10), placed after the threats: five
 * in the top row, between the poles and over the carp; four in the middle row, under the safe
 * area, in the two gaps between the carp and down the right edge; and four in the bottom row, at
 * the bottom left, beside the lit part's crayfish, and two in the dark, over the Rare ledge and
 * round the exit.
 */
const SPRING_CAVE_LOOPS: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[470, 110], [790, 110], [760, 260], [600, 190]] as const),
  Object.freeze([[840, 110], [1130, 110], [1160, 260], [980, 190]] as const),
  Object.freeze([[1180, 110], [1500, 110], [1480, 260], [1320, 190]] as const),
  Object.freeze([[1520, 110], [1880, 110], [1860, 260], [1680, 190]] as const),
  Object.freeze([[1960, 110], [2300, 110], [2320, 260], [2120, 190]] as const),
  Object.freeze([[50, 380], [380, 370], [260, 450], [60, 530]] as const),
  Object.freeze([[970, 370], [1200, 370], [1290, 460], [1200, 540], [970, 540]] as const),
  Object.freeze([[1720, 370], [1960, 370], [2040, 460], [1960, 540], [1720, 540]] as const),
  Object.freeze([[2360, 570], [2350, 720], [2190, 720], [2040, 650], [2200, 600]] as const),
  Object.freeze([[60, 860], [400, 870], [350, 1010], [150, 1010]] as const),
  Object.freeze([[860, 866], [1190, 870], [1150, 1016], [950, 1016]] as const),
  Object.freeze([[1250, 770], [1560, 770], [1570, 920], [1300, 920]] as const),
  Object.freeze([[2040, 866], [2360, 870], [2330, 1016], [2150, 1016]] as const),
]);

/**
 * The eleven shrimp homes' hop spots (issue #77, ND-10): four in the top row, four in the middle
 * row and three in the bottom row, two of them in the dark. Each first spot is out of every
 * threat's reach.
 */
const SPRING_CAVE_HOMES: readonly (readonly (readonly [number, number])[])[] = Object.freeze([
  Object.freeze([[560, 160], [620, 130], [600, 200]] as const),
  Object.freeze([[1290, 160], [1350, 130], [1330, 200]] as const),
  Object.freeze([[1760, 160], [1820, 130], [1800, 200]] as const),
  Object.freeze([[2160, 160], [2220, 130], [2200, 200]] as const),
  Object.freeze([[100, 420], [160, 390], [140, 460]] as const),
  Object.freeze([[1040, 440], [1100, 410], [1080, 480]] as const),
  Object.freeze([[1760, 440], [1820, 410], [1800, 480]] as const),
  Object.freeze([[640, 620], [700, 590], [680, 660]] as const),
  Object.freeze([[300, 920], [360, 890], [340, 960]] as const),
  Object.freeze([[1440, 800], [1500, 770], [1480, 840]] as const),
  Object.freeze([[2240, 800], [2300, 770], [2280, 840]] as const),
]);

/** Seconds a tadpole takes round the closed loop through `points` at Area 6's tadpole speed. */
function springCaveLapSeconds(points: readonly (readonly [number, number])[]): number {
  let length = 0;
  points.forEach(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    length += Math.hypot(nextX - x, nextY - y);
  });
  return length / SPRING_CAVE_TADPOLE.speed;
}

/** Tadpole n of 13 (from 0) on its wander loop, n thirteenths of its own lap ahead, so the thirteen are out of step. */
function springCaveWander(points: readonly (readonly [number, number])[], index: number): Readonly<TadpoleWander> {
  return tadpoleWander(SPRING_CAVE_TADPOLE, points, (index * springCaveLapSeconds(points)) / SPRING_CAVE_LOOPS.length);
}

/** The water under one rock ledge, the bank cover (B5; issue #77, ND-11). */
function rockLedge(x0: number, x1: number, y0: number, y1: number): Readonly<BankOverhang> {
  return Object.freeze({ x0, x1, y0, y1 });
}

/** One crayfish's route, id `crayfish-<n>`: a straight floor stretch from `x0` to `x1` at CRAYFISH_FLOOR_Y, two waypoints (issue #77, ND-5). */
function crayfishStretch(index: number, x0: number, x1: number): Readonly<PredatorRoute> {
  const waypoints: Point[] = [Object.freeze({ x: x0, y: CRAYFISH_FLOOR_Y }), Object.freeze({ x: x1, y: CRAYFISH_FLOOR_Y })];
  return Object.freeze({ id: `crayfish-${index}`, waypoints: Object.freeze(waypoints) as Point[], species: SPRING_CAVE_CRAYFISH });
}

/** One common carp's route, id `carp-<n>`: a closed loop through `points`, each an [x, y] pair (issue #77, ND-4). */
function carpLoop(index: number, points: readonly (readonly [number, number])[]): Readonly<PredatorRoute> {
  const waypoints: Point[] = points.map(([x, y]) => Object.freeze({ x, y }));
  return Object.freeze({ id: `carp-${index}`, waypoints: Object.freeze(waypoints) as Point[], species: SPRING_CAVE_CARP });
}

/**
 * One punting pole, id `spring-cave-1/punting-pole-<n>`, at `x`, its cycle starting at `offset`
 * seconds, its tip reaching `depth` px below the surface (issue #77, ND-3).
 */
function puntingPoleAt(index: number, x: number, offset: number, depth: number): Readonly<MovingHazardSpawn> {
  return Object.freeze(movingHazardSpawn(`${SPRING_CAVE_AREA_ID}/punting-pole-${index}`, PUNTING_POLE, x, offset, depth));
}

/** One glow-plant, id `spring-cave-1/glow-plant-<n>`, centred on (`x`, `y`) (issue #77, ND-8). */
function glowPlantAt(index: number, x: number, y: number): Readonly<ElementSpawn> {
  const spawn = glowPlantSpawn(`${SPRING_CAVE_AREA_ID}/glow-plant-${index}`, { x, y, radius: GLOW_PLANT_RADIUS });
  Object.freeze(spawn.glowPlant);
  return Object.freeze(spawn);
}

/** The spring cave, Area 6, as area data: 5 screens across, 3 down. */
export const SPRING_CAVE_LAYOUT: Readonly<AreaLayoutData> = Object.freeze({
  id: SPRING_CAVE_AREA_ID,
  screensWide: 5,
  screensTall: 3,
  start: Object.freeze({ x: 120, y: 200 }),
  /** The Home Spot's column in the top row only (issue #77, ND-2). */
  safeArea: Object.freeze({ x0: 40, x1: 300, y0: SURF, y1: WORLD_H }),
  homeSpotRadius: 72,
  reedBeds: Object.freeze([]),
  /**
   * In the grotto on the bed in the dark, over the third crayfish's stretch: Legendary pots within
   * its pinch, Epic spots just above (issue #77, ND-11).
   */
  caveSpots: Object.freeze([
    Object.freeze([1960, 990, 'legendary', true] as const),
    Object.freeze([2020, 990, 'legendary', true] as const),
    Object.freeze([2080, 990, 'legendary', true] as const),
    Object.freeze([1990, 940, 'epic', false] as const),
    Object.freeze([2050, 940, 'epic', false] as const),
    Object.freeze([2110, 940, 'epic', false] as const),
  ]),
  /**
   * Just past the spring outflow, on its far side along the main path, under `carp-5`: Legendary
   * pots nearer it, Epic spots farther (issue #77, ND-11).
   */
  currentSpots: Object.freeze([
    Object.freeze([1900, 790, 'legendary', true] as const),
    Object.freeze([1960, 790, 'legendary', true] as const),
    Object.freeze([1930, 860, 'epic', false] as const),
    Object.freeze([1990, 860, 'epic', false] as const),
  ]),
  /**
   * The spring outflow in the dark, a gentle, steady flow to the left, about as strong as Area 5's,
   * against the main path coming right along the bottom row (issue #77, ND-11).
   */
  currents: Object.freeze([
    Object.freeze({ id: 'current-0', x0: 1700, x1: 1860, y0: 760, y1: 880, force: Object.freeze({ x: -73, y: 0 }) }),
  ]),
  /** The side grotto on the bed of the bottom row, in the dark, a dead end below the main path (B6; issue #77, ND-11). */
  cave: Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/cave`, x0: 1920, x1: 2140, y0: 935, y1: SPRING_CAVE_BED_TOP }),
  /** No tilapia: the spring cave is cold, clear water (issue #77). */
  tilapiaRoutes: Object.freeze([]),
  /**
   * Three chasing crayfish, each on its own floor stretch in the bottom row: one in the lit part and
   * two in the dark (issue #77, ND-5). Then six chasing common carp, each loop reaching into two
   * depth bands (ND-4): `carp-0`, `carp-1` and `carp-2` across the line between the top and middle
   * rows, `carp-3`, `carp-4` and `carp-5` across the line between the middle and bottom rows. The
   * whole-water test needs all six.
   */
  predatorRoutes: Object.freeze([
    crayfishStretch(0, 500, 800),
    crayfishStretch(1, 1300, 1640),
    crayfishStretch(2, 1880, 2160),
    carpLoop(0, [[600, 340], [830, 340], [830, 440], [600, 440]]),
    carpLoop(1, [[1350, 340], [1580, 340], [1580, 440], [1350, 440]]),
    carpLoop(2, [[2100, 340], [2300, 340], [2300, 440], [2100, 440]]),
    carpLoop(3, [[220, 600], [420, 600], [420, 740], [220, 740]]),
    carpLoop(4, [[1000, 680], [1250, 680], [1250, 740], [1000, 740]]),
    carpLoop(5, [[1700, 680], [2050, 680], [2050, 740], [1700, 740]]),
  ]),
  /**
   * Four punting poles jabbing down into the top row, where the spring opens to the sky, each sweep
   * farther than every predator's strike from its loop, 2 s out of step with the next (issue #77,
   * ND-3, option A). The third is short, over `carp-1`, and the main path passes between its tip
   * and that carp's strike.
   */
  movingHazards: Object.freeze([
    puntingPoleAt(1, 400, 0, 200),
    puntingPoleAt(2, 1150, 2, 200),
    puntingPoleAt(3, 1450, 0, 72),
    puntingPoleAt(4, 1900, 2, 200),
  ]),
  hazards: Object.freeze([]),
  /** Six glow-plants in the dark part, the area's puzzle element (issue #77, ND-8). */
  elements: Object.freeze([
    glowPlantAt(1, 1290, 770),
    glowPlantAt(2, 1560, 790),
    glowPlantAt(3, 1780, 940),
    glowPlantAt(4, 2060, 880),
    glowPlantAt(5, 2230, 780),
    glowPlantAt(6, 2340, 1000),
  ]),
  /**
   * The descent, only across or down (issue #77, ND-2): right along the top row past the Common
   * ledges, between the short pole's tip and `carp-1`, down between `carp-1` and `carp-2`, left
   * along the middle row, down between `carp-3` and `carp-4`, then right along the bottom row over
   * the Rare ledge, through the spring outflow and on to the exit in the dark.
   */
  mainPath: Object.freeze([
    Object.freeze({ x: 120, y: 200 }),
    Object.freeze({ x: 440, y: 200 }),
    Object.freeze({ x: 1760, y: 200 }),
    Object.freeze({ x: 1760, y: 560 }),
    Object.freeze({ x: 700, y: 560 }),
    Object.freeze({ x: 700, y: 830 }),
    Object.freeze({ x: 1900, y: 830 }),
    Object.freeze({ x: 2290, y: 940 }),
  ]),
  /**
   * Fixed stranding places (PRD C2), none in the dark: two in the top row, three in the middle row
   * and one in the lit part of the bottom row. Every place is at least 80 px from every crayfish
   * stretch and carp loop and clear of every pole sweep by the touch and rescue reach.
   */
  strandingPlaces: Object.freeze([
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-1`, x: 500, y: 140 }),
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-2`, x: 2300, y: 180 }),
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-3`, x: 500, y: 520 }),
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-4`, x: 1250, y: 560 }),
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-5`, x: 2000, y: 560 }),
    Object.freeze({ id: `${SPRING_CAVE_AREA_ID}/strand-6`, x: 900, y: 900 }),
  ]),
  treasures: SPRING_CAVE_TREASURES,
  /** 12 worms and bugs to 24 mobile snacks, 36 in all, Area 6's row of the snack ramp (issue #77, ND-10). */
  snackWorms: 6,
  snackBugs: 6,
  snacksInCurrent: 4,
  padCount: 0,
  padSpotIndex: null,
  padSpotY: 100,
  bankChunks: Object.freeze([]),
  sunChunk: 0,
  /**
   * Rock ledges, built as bank overhangs (B5; issue #77, ND-11): two over the main path in the top
   * row, holding the Common spots, and one in the dark over the second crayfish's stretch, a dead end
   * below the main path, holding the Rare spots.
   */
  bankOverhangs: Object.freeze([rockLedge(860, 1100, 110, 170), rockLedge(1610, 1730, 110, 170), rockLedge(1330, 1660, 895, 945)]),
  /**
   * Under the rock ledges: Common spots along the main path in the top row; Rare spots off it, on the
   * ledge in the dark, within the second crayfish's strike band, so the special treasure is in the
   * dark too (issue #77, ND-11).
   */
  bankSpots: Object.freeze([
    Object.freeze([880, 155, 'common', false] as const),
    Object.freeze([940, 155, 'common', false] as const),
    Object.freeze([1000, 155, 'common', false] as const),
    Object.freeze([1060, 155, 'common', false] as const),
    Object.freeze([1640, 155, 'common', false] as const),
    Object.freeze([1700, 155, 'common', false] as const),
    Object.freeze([1350, 920, 'rare', false] as const),
    Object.freeze([1408, 920, 'rare', false] as const),
    Object.freeze([1466, 920, 'rare', false] as const),
    Object.freeze([1524, 920, 'rare', false] as const),
    Object.freeze([1582, 920, 'rare', false] as const),
    Object.freeze([1640, 920, 'rare', false] as const),
  ]),
  /** The dark part: the right half of the bottom row, from x 1200 and y 720 down to the bed (issue #77, ND-7). */
  darkWater: Object.freeze({ x0: 1200, x1: 2400, y0: 720, y1: SPRING_CAVE_BED_TOP }),
  /**
   * Thirteen tadpoles on wander loops (SPRING_CAVE_LOOPS) and eleven shrimp on homes of 3 hop spots
   * (SPRING_CAVE_HOMES), over all three rows; every loop and home passes tadpoleWanderClear() and
   * shrimpHomeClear() (issue #77, ND-10).
   */
  mobileSnacks: mobileSnackMix({
    tadpole: SPRING_CAVE_TADPOLE,
    wanders: SPRING_CAVE_LOOPS.map(springCaveWander),
    shrimp: SPRING_CAVE_SHRIMP,
    homes: SPRING_CAVE_HOMES.map((points) => shrimpHome(points)),
  }),
} satisfies AreaLayoutData);
